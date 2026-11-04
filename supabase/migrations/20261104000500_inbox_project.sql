-- =========================================================
-- Migration 20261104000500: Caixa de entrada (Etapa 2)
-- =========================================================
-- tasks.project_id é obrigatório, então a caixa de entrada é um projeto marcado
-- com projects.is_inbox, um por usuário, no workspace Pessoal padrão, sempre
-- privado (sem participantes).
--
-- O que muda (exceção aprovada para projects e project_members):
--   - coluna projects.is_inbox (default false) e índice único parcial por user_id;
--   - função ensure_inbox_project(): cria ou devolve a caixa de entrada do usuário;
--   - trigger protect_inbox_project em projects: o app (roles anon/authenticated)
--     não cria caixa de entrada, não exclui, não renomeia, não move de workspace,
--     não muda o status e não liga/desliga is_inbox;
--   - trigger block_inbox_members em project_members: a caixa de entrada nunca
--     tem participantes.
-- Nenhuma policy é criada, alterada ou removida.
--
-- Quem não é anon/authenticated passa pelo trigger de projects: a própria
-- ensure_inbox_project (SECURITY DEFINER), a service role (exclusão de conta pelo
-- admin), o SQL Editor e a cascata de auth.users (roda como dono da tabela).
--
-- Idempotente. Aborta (rollback) se as policies de projects/project_members não
-- estiverem no estado esperado.
-- =========================================================

begin;

-- ---------- Pré-requisitos ----------
do $$
begin
  if to_regprocedure('public.default_workspace_for_user(uuid, text)') is null then
    raise exception 'public.default_workspace_for_user(uuid, text) não existe';
  end if;
  if to_regclass('public.workspaces') is null or to_regclass('public.project_members') is null then
    raise exception 'tabelas public.workspaces/public.project_members não existem';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'workspace_id'
  ) then
    raise exception 'public.projects.workspace_id não existe';
  end if;
end;
$$;

-- ---------- Coluna e unicidade ----------
alter table public.projects
  add column if not exists is_inbox boolean not null default false;

comment on column public.projects.is_inbox is
  'Caixa de entrada do usuário (uma por user_id). Criada só por ensure_inbox_project().';

create unique index if not exists projects_one_inbox_per_user
  on public.projects (user_id)
  where is_inbox;

-- ---------- Proteção da caixa de entrada em projects ----------
-- SECURITY INVOKER de propósito: current_user é a role de quem fez a operação.
create or replace function public.protect_inbox_project()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.is_inbox then
      raise exception using errcode = '42501',
        message = 'A caixa de entrada é criada automaticamente';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.is_inbox is distinct from old.is_inbox then
      raise exception using errcode = '42501',
        message = 'Não é possível marcar ou desmarcar um projeto como caixa de entrada';
    end if;
    if old.is_inbox and (
         new.name is distinct from old.name
      or new.workspace_id is distinct from old.workspace_id
      or new.status is distinct from old.status
    ) then
      raise exception using errcode = '42501',
        message = 'A caixa de entrada não pode ser renomeada, movida de workspace nem mudar de status';
    end if;
    return new;
  end if;

  -- DELETE
  if old.is_inbox then
    raise exception using errcode = '42501',
      message = 'A caixa de entrada não pode ser excluída';
  end if;
  return old;
end;
$$;

revoke all on function public.protect_inbox_project() from public;

drop trigger if exists protect_inbox_project on public.projects;
create trigger protect_inbox_project
  before insert or update or delete on public.projects
  for each row execute function public.protect_inbox_project();

-- ---------- Caixa de entrada sem participantes ----------
-- SECURITY DEFINER para ler projects sem depender do RLS; vale para qualquer role.
create or replace function public.block_inbox_members()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from projects p where p.id = new.project_id and p.is_inbox) then
    raise exception using errcode = '42501',
      message = 'A caixa de entrada é privada e não aceita participantes';
  end if;
  return new;
end;
$$;

revoke all on function public.block_inbox_members() from public;

drop trigger if exists block_inbox_members on public.project_members;
create trigger block_inbox_members
  before insert or update of project_id on public.project_members
  for each row execute function public.block_inbox_members();

-- ---------- Criar ou devolver a caixa de entrada ----------
create or replace function public.ensure_inbox_project()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_project uuid;
  v_workspace uuid;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Usuário não autenticado';
  end if;

  select id into v_project from projects where user_id = v_user and is_inbox;
  if v_project is not null then
    return v_project;
  end if;

  v_workspace := public.default_workspace_for_user(v_user, 'personal');

  insert into projects (user_id, workspace_id, name, status, is_inbox)
  values (v_user, v_workspace, 'Caixa de entrada', 'active', true)
  on conflict (user_id) where is_inbox do nothing
  returning id into v_project;

  -- Outra chamada simultânea criou primeiro
  if v_project is null then
    select id into v_project from projects where user_id = v_user and is_inbox;
  end if;

  return v_project;
end;
$$;

revoke all on function public.ensure_inbox_project() from public, anon;
grant execute on function public.ensure_inbox_project() to authenticated;

-- ---------- Verificação final ----------
do $$
declare
  problems text[] := '{}';
  policies_now text;
begin
  -- Policies de projects e project_members: exatamente as de antes (nada mudou)
  select string_agg(format('%s: "%s"', tablename, policyname), ', ' order by tablename, policyname)
    into policies_now
  from pg_policies
  where schemaname = 'public'
    and tablename in ('projects', 'project_members')
    and coalesce(qual, '') || coalesce(with_check, '') !~* '(is_admin|has_role)'
    and (tablename, policyname) not in (
      ('projects',        'Users can view own projects'),
      ('projects',        'Users can insert own projects'),
      ('projects',        'Users can update own projects'),
      ('projects',        'Users can delete own projects'),
      ('projects',        'Members can view accessible projects'),
      ('project_members', 'Access can view project members'),
      ('project_members', 'Owner can add project members'),
      ('project_members', 'Owner can remove project members')
    );
  if policies_now is not null then
    problems := array_append(problems, 'policies inesperadas: ' || policies_now);
  end if;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'projects'
        and policyname in ('Users can view own projects', 'Users can insert own projects',
                           'Users can update own projects', 'Users can delete own projects',
                           'Members can view accessible projects')) <> 5 then
    problems := array_append(problems, 'faltam policies de projects');
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'project_members'
        and policyname in ('Access can view project members', 'Owner can add project members',
                           'Owner can remove project members')) <> 3 then
    problems := array_append(problems, 'faltam policies de project_members');
  end if;

  if to_regclass('public.projects_one_inbox_per_user') is null then
    problems := array_append(problems, 'índice projects_one_inbox_per_user ausente');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'protect_inbox_project'
                   and tgrelid = 'public.projects'::regclass and not tgisinternal) then
    problems := array_append(problems, 'trigger protect_inbox_project ausente');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'block_inbox_members'
                   and tgrelid = 'public.project_members'::regclass and not tgisinternal) then
    problems := array_append(problems, 'trigger block_inbox_members ausente');
  end if;
  if has_function_privilege('anon', 'public.ensure_inbox_project()', 'execute') then
    problems := array_append(problems, 'anon pode executar ensure_inbox_project');
  end if;
  if not has_function_privilege('authenticated', 'public.ensure_inbox_project()', 'execute') then
    problems := array_append(problems, 'authenticated não pode executar ensure_inbox_project');
  end if;

  if array_length(problems, 1) > 0 then
    raise exception 'Migration 000500 abortada: %', array_to_string(problems, '; ');
  end if;
end;
$$;

commit;
