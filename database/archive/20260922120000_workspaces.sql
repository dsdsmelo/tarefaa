-- =========================================================
-- Migration 20260922120000: Workspaces pessoais e corporativos
-- =========================================================
-- Esta migration é aditiva e foi desenhada para a base de produção
-- existente. Não execute database/schema.sql novamente.
--
-- Estratégia para dados legados:
--   1. Cria os workspaces padrão Pessoal e Corporativo por conta.
--   2. Associa todos os projetos existentes ao workspace Pessoal
--      do respectivo dono. A classificação corporativa deve ser feita
--      explicitamente pela interface após o deploy.
--   3. As tabelas filhas continuam vinculadas só ao project_id; ao
--      mover um projeto, todo o seu conteúdo muda de workspace junto.
-- =========================================================

begin;

-- Fail fast: produção já precisa ter o isolamento por user_id que o
-- frontend atual usa desde janeiro de 2026. Sem dono não há como
-- classificar um projeto legado com segurança.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'user_id'
  ) then
    raise exception 'projects.user_id não existe; interrompendo migration de workspaces';
  end if;

  if exists (select 1 from public.projects where user_id is null) then
    raise exception 'Existem projetos sem user_id; atribua um dono antes de executar a migration de workspaces';
  end if;
end;
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  kind text not null check (kind in ('personal', 'corporate')),
  color text not null default '#2563EB',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workspaces is 'Espaços de trabalho pessoais ou corporativos do dono dos projetos';
comment on column public.workspaces.kind is 'Classificação visual do workspace: personal ou corporate';
comment on column public.workspaces.is_default is 'Workspace padrão criado para cada tipo; não limita workspaces adicionais';

create unique index if not exists idx_workspaces_owner_name
  on public.workspaces (user_id, lower(name));

create unique index if not exists idx_workspaces_one_default_per_kind
  on public.workspaces (user_id, kind)
  where is_default;

create index if not exists idx_workspaces_owner on public.workspaces(user_id);

-- A função já existe na base atual. A guarda permite que a migration seja
-- aplicada apenas em bases que possuem o schema mínimo esperado.
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_updated_at_column'
  ) then
    raise exception 'Função public.update_updated_at_column() não existe; interrompendo migration de workspaces';
  end if;
end;
$$;

drop trigger if exists update_workspaces_updated_at on public.workspaces;
create trigger update_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.update_updated_at_column();

-- Garante os dois workspaces iniciais para todas as contas existentes,
-- inclusive contas sem projeto. ON CONFLICT sem alvo torna esta etapa
-- idempotente mesmo se a migration for executada novamente.
insert into public.workspaces (user_id, name, kind, color, is_default)
select u.id, 'Pessoal', 'personal', '#2563EB', true
from auth.users u
on conflict do nothing;

insert into public.workspaces (user_id, name, kind, color, is_default)
select u.id, 'Corporativo', 'corporate', '#7C3AED', true
from auth.users u
on conflict do nothing;

alter table public.projects
  add column if not exists workspace_id uuid;

-- Todo projeto legado entra no Pessoal. Não há heurística confiável que
-- determine se um projeto antigo era corporativo.
update public.projects p
set workspace_id = w.id
from public.workspaces w
where p.workspace_id is null
  and w.user_id = p.user_id
  and w.kind = 'personal'
  and w.is_default = true;

do $$
begin
  if exists (select 1 from public.projects where workspace_id is null) then
    raise exception 'Há projetos sem workspace após o backfill; migration cancelada';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_workspace_id_fkey'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_workspace_id_fkey
      foreign key (workspace_id)
      references public.workspaces(id)
      on delete restrict;
  end if;
end;
$$;

alter table public.projects
  alter column workspace_id set not null;

create index if not exists idx_projects_workspace_id
  on public.projects(workspace_id);

create index if not exists idx_projects_owner_workspace
  on public.projects(user_id, workspace_id);

-- Retorna (ou cria) o workspace padrão de um dono. É usado pelo trigger
-- abaixo para manter compatibilidade durante o rollout: uma versão antiga
-- do frontend que ainda não envia workspace_id continua criando projetos
-- no workspace Pessoal.
create or replace function public.default_workspace_for_user(
  p_user_id uuid,
  p_kind text default 'personal'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_name text;
  v_color text;
begin
  if p_user_id is null then
    raise exception 'Não é possível resolver workspace sem user_id';
  end if;

  if p_kind not in ('personal', 'corporate') then
    raise exception 'Tipo de workspace inválido: %', p_kind;
  end if;

  select id
    into v_workspace_id
  from public.workspaces
  where user_id = p_user_id
    and kind = p_kind
    and is_default = true
  limit 1;

  if v_workspace_id is null then
    v_name := case when p_kind = 'personal' then 'Pessoal' else 'Corporativo' end;
    v_color := case when p_kind = 'personal' then '#2563EB' else '#7C3AED' end;

    insert into public.workspaces (user_id, name, kind, color, is_default)
    values (p_user_id, v_name, p_kind, v_color, true)
    on conflict do nothing;

    select id
      into v_workspace_id
    from public.workspaces
    where user_id = p_user_id
      and kind = p_kind
      and is_default = true
    limit 1;
  end if;

  if v_workspace_id is null then
    raise exception 'Não foi possível criar ou localizar workspace padrão para %', p_user_id;
  end if;

  return v_workspace_id;
end;
$$;

-- Impede corrupção mesmo se uma política RLS antiga for mais permissiva do
-- que deveria. O dono do projeto não pode mudar e o workspace precisa ser
-- dele; somente o dono autenticado pode mover o projeto entre workspaces.
create or replace function public.enforce_project_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_owner uuid;
begin
  if new.user_id is null then
    raise exception 'Projetos devem possuir user_id';
  end if;

  if new.workspace_id is null then
    new.workspace_id := public.default_workspace_for_user(new.user_id, 'personal');
  end if;

  select user_id
    into v_workspace_owner
  from public.workspaces
  where id = new.workspace_id;

  if v_workspace_owner is null then
    raise exception 'Workspace % não existe', new.workspace_id;
  end if;

  if v_workspace_owner is distinct from new.user_id then
    raise exception 'O workspace selecionado não pertence ao dono do projeto';
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'O dono do projeto não pode ser alterado';
    end if;

    if new.workspace_id is distinct from old.workspace_id
      and auth.uid() is not null
      and auth.uid() is distinct from old.user_id then
      raise exception 'Somente o dono do projeto pode movê-lo de workspace';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_project_workspace on public.projects;
create trigger enforce_project_workspace
  before insert or update on public.projects
  for each row execute function public.enforce_project_workspace();

-- Cria os padrões de forma segura quando uma conta autenticada entra no app.
create or replace function public.ensure_default_workspaces()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  perform public.default_workspace_for_user(auth.uid(), 'personal');
  perform public.default_workspace_for_user(auth.uid(), 'corporate');
end;
$$;

grant execute on function public.ensure_default_workspaces() to authenticated;

-- Um participante só precisa enxergar o nome de um workspace se possuir
-- ao menos um projeto nele. A autorização de edição continua no projeto.
create or replace function public.can_access_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = p_workspace_id
      and w.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.projects p
    join public.project_members pm on pm.project_id = p.id
    join public.people pe on pe.id = pm.person_id
    where p.workspace_id = p_workspace_id
      and pe.auth_user_id = auth.uid()
  );
$$;

alter table public.workspaces enable row level security;

drop policy if exists "Workspace access by owner or project member" on public.workspaces;
create policy "Workspace access by owner or project member" on public.workspaces
  for select using (public.can_access_workspace(id));

drop policy if exists "Workspace owner creates workspaces" on public.workspaces;
create policy "Workspace owner creates workspaces" on public.workspaces
  for insert with check (user_id = auth.uid());

drop policy if exists "Workspace owner updates workspaces" on public.workspaces;
create policy "Workspace owner updates workspaces" on public.workspaces
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Workspace owner deletes workspaces" on public.workspaces;
create policy "Workspace owner deletes workspaces" on public.workspaces
  for delete using (user_id = auth.uid());

commit;

-- Pós-condições esperadas após a execução:
--   select count(*) from public.projects where workspace_id is null; -- 0
--   select user_id, kind, count(*) from public.workspaces group by 1, 2;
