-- =========================================================
-- Migration 20261106000700: Etapa 4
-- =========================================================
-- Escrita a partir do estado real de produção (consulta de 06/11/2026), não do
-- schema_prod.json, que é anterior à Etapa 1.
--
-- O que muda:
--   1. tasks: status 'waiting' (Aguardando); colunas waiting_on_person_id
--      (fk people, on delete set null), waiting_on_text (até 120 caracteres) e
--      follow_up_date. Aguardando exige follow_up_date; pessoa e texto livre não
--      vêm juntos. Trigger task_waiting_fields: limpa os três campos quando o
--      status deixa de ser Aguardando e só aceita pessoa visível para quem grava.
--   2. projects: status 'idea' (Ideia).
--   3. projects: health_override ('green' | 'yellow' | 'red' | null),
--      health_override_at (trigger: data do ajuste; limpa quando volta a null),
--      next_action_task_id (fk tasks, on delete set null; precisa ser tarefa do
--      próprio projeto).
--   4. people: workspace_id (fk workspaces, on delete set null; o workspace
--      precisa ser do dono da pessoa).
-- Nenhuma policy é criada, alterada ou removida. A Caixa de entrada continua sem
-- poder mudar de status (protect_inbox_project, migration 000500), então não vira
-- Ideia.
--
-- Idempotente. Aborta (rollback) se as policies de tasks, projects, people ou
-- project_members não estiverem no estado de produção conhecido.
-- =========================================================

begin;

-- ---------- Pré-requisitos ----------
do $$
begin
  if to_regclass('public.workspaces') is null then
    raise exception 'public.workspaces não existe';
  end if;
  if to_regprocedure('public.can_view_person(uuid)') is null then
    raise exception 'public.can_view_person(uuid) não existe';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'protect_inbox_project'
                   and tgrelid = 'public.projects'::regclass and not tgisinternal) then
    raise exception 'trigger protect_inbox_project ausente (migration 000500)';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'tasks' and column_name = 'completed_at') then
    raise exception 'tasks.completed_at ausente (migration 000600)';
  end if;
end;
$$;

-- =========================================================
-- 1. Aguardando
-- =========================================================
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status = any (array[
  'pending', 'in_progress', 'waiting', 'blocked', 'completed', 'cancelled'
]::text[]));

alter table public.tasks add column if not exists waiting_on_person_id uuid;
alter table public.tasks add column if not exists waiting_on_text text;
alter table public.tasks add column if not exists follow_up_date date;

comment on column public.tasks.waiting_on_person_id is 'Aguardando: pessoa de quem se espera (people). Exclusivo com waiting_on_text.';
comment on column public.tasks.waiting_on_text is 'Aguardando: de quem se espera, em texto livre (até 120 caracteres).';
comment on column public.tasks.follow_up_date is 'Aguardando: data de cobrança. Obrigatória enquanto status = waiting.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_waiting_on_person_id_fkey'
                   and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_waiting_on_person_id_fkey
      foreign key (waiting_on_person_id) references public.people(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_waiting_on_text_length_check'
                   and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_waiting_on_text_length_check
      check (waiting_on_text is null or char_length(waiting_on_text) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_waiting_on_one_check'
                   and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_waiting_on_one_check
      check (waiting_on_person_id is null or waiting_on_text is null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_waiting_follow_up_check'
                   and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_waiting_follow_up_check
      check (status <> 'waiting' or follow_up_date is not null);
  end if;
end;
$$;

-- SECURITY INVOKER de propósito: a busca em people passa pelas policies de quem
-- grava, então ninguém aponta para uma pessoa que não pode ver.
create or replace function public.task_waiting_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from 'waiting' then
    new.waiting_on_person_id := null;
    new.waiting_on_text := null;
    new.follow_up_date := null;
    return new;
  end if;

  new.waiting_on_text := nullif(btrim(new.waiting_on_text), '');

  if new.waiting_on_person_id is not null
     and (tg_op = 'INSERT' or new.waiting_on_person_id is distinct from old.waiting_on_person_id)
     and current_user in ('anon', 'authenticated')
     and not exists (select 1 from people p where p.id = new.waiting_on_person_id) then
    raise exception using errcode = '42501',
      message = 'Pessoa não encontrada ou sem acesso';
  end if;
  return new;
end;
$$;

revoke all on function public.task_waiting_fields() from public;

drop trigger if exists task_waiting_fields on public.tasks;
create trigger task_waiting_fields
  before insert or update on public.tasks
  for each row execute function public.task_waiting_fields();

create index if not exists tasks_waiting_follow_up_idx
  on public.tasks (follow_up_date)
  where status = 'waiting';

create index if not exists tasks_waiting_on_person_id_idx
  on public.tasks (waiting_on_person_id)
  where waiting_on_person_id is not null;

-- =========================================================
-- 2. Ideia
-- =========================================================
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check check (status = any (array[
  'idea', 'planning', 'active', 'paused', 'completed', 'cancelled'
]::text[]));

-- =========================================================
-- 3. Saúde do projeto e próxima ação
-- =========================================================
alter table public.projects add column if not exists health_override text;
alter table public.projects add column if not exists health_override_at timestamptz;
alter table public.projects add column if not exists next_action_task_id uuid;

comment on column public.projects.health_override is 'Ajuste manual do semáforo (green/yellow/red); null = calculado no app.';
comment on column public.projects.health_override_at is 'Quando o ajuste manual foi feito. Mantido pelo trigger project_health_fields.';
comment on column public.projects.next_action_task_id is 'Próxima ação: tarefa do próprio projeto.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_health_override_check'
                   and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_health_override_check
      check (health_override is null or health_override in ('green', 'yellow', 'red'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_next_action_task_id_fkey'
                   and conrelid = 'public.projects'::regclass) then
    alter table public.projects add constraint projects_next_action_task_id_fkey
      foreign key (next_action_task_id) references public.tasks(id) on delete set null;
  end if;
end;
$$;

-- Índice da fk: excluir tarefa procura projetos que a usam como próxima ação
create index if not exists projects_next_action_task_id_idx
  on public.projects (next_action_task_id)
  where next_action_task_id is not null;

create or replace function public.project_health_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Data do ajuste manual: só o banco grava
  if tg_op = 'INSERT' then
    new.health_override_at := case when new.health_override is null then null else now() end;
  elsif new.health_override is distinct from old.health_override then
    new.health_override_at := case when new.health_override is null then null else now() end;
  else
    new.health_override_at := old.health_override_at;
  end if;

  -- Próxima ação precisa ser tarefa do próprio projeto
  if new.next_action_task_id is not null
     and (tg_op = 'INSERT' or new.next_action_task_id is distinct from old.next_action_task_id)
     and not exists (select 1 from tasks t where t.id = new.next_action_task_id and t.project_id = new.id) then
    raise exception using errcode = '23514',
      message = 'A próxima ação precisa ser uma tarefa deste projeto';
  end if;
  return new;
end;
$$;

revoke all on function public.project_health_fields() from public;

drop trigger if exists project_health_fields on public.projects;
create trigger project_health_fields
  before insert or update on public.projects
  for each row execute function public.project_health_fields();

-- =========================================================
-- 4. Pessoas por workspace
-- =========================================================
alter table public.people add column if not exists workspace_id uuid;

comment on column public.people.workspace_id is 'Workspace da pessoa; null = aparece em todos os workspaces do dono.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'people_workspace_id_fkey'
                   and conrelid = 'public.people'::regclass) then
    alter table public.people add constraint people_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete set null;
  end if;
end;
$$;

create index if not exists people_workspace_id_idx
  on public.people (workspace_id)
  where workspace_id is not null;

-- O workspace precisa ser do dono da pessoa. SECURITY DEFINER para conferir em
-- workspaces sem depender do RLS; só compara ids, não devolve dados.
create or replace function public.person_workspace_check()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.workspace_id is not null
     and (tg_op = 'INSERT' or new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id)
     and not exists (select 1 from workspaces w where w.id = new.workspace_id and w.user_id = new.user_id) then
    raise exception using errcode = '42501',
      message = 'Workspace não pertence ao dono da pessoa';
  end if;
  return new;
end;
$$;

revoke all on function public.person_workspace_check() from public;

drop trigger if exists person_workspace_check on public.people;
create trigger person_workspace_check
  before insert or update on public.people
  for each row execute function public.person_workspace_check();

-- ---------- Verificação final ----------
do $$
declare
  problems text[] := '{}';
  policies_now text;
  col text;
begin
  -- Policies: exatamente as de produção (06/11/2026), ignorando as de admin
  select string_agg(format('%s: "%s"', tablename, policyname), ', ' order by tablename, policyname)
    into policies_now
  from pg_policies
  where schemaname = 'public'
    and tablename in ('tasks', 'projects', 'people', 'project_members')
    and coalesce(qual, '') || coalesce(with_check, '') !~* '(is_admin|has_role)'
    and (tablename, policyname) not in (
      ('tasks',           'Project access select tasks'),
      ('tasks',           'Project access insert tasks'),
      ('tasks',           'Project access update tasks'),
      ('tasks',           'Project access delete tasks'),
      ('projects',        'Users can view own projects'),
      ('projects',        'Users can insert own projects'),
      ('projects',        'Users can update own projects'),
      ('projects',        'Users can delete own projects'),
      ('projects',        'Members can view accessible projects'),
      ('people',          'Users can view own people'),
      ('people',          'Users can insert own people'),
      ('people',          'Users can update own people'),
      ('people',          'Users can delete own people'),
      ('people',          'Members can view co-members'),
      ('project_members', 'Access can view project members'),
      ('project_members', 'Owner can add project members'),
      ('project_members', 'Owner can remove project members')
    );
  if policies_now is not null then
    problems := array_append(problems, 'policies inesperadas: ' || policies_now);
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'tasks'
        and roles = '{authenticated}' and policyname like 'Project access % tasks') <> 4 then
    problems := array_append(problems, 'faltam as 4 policies "Project access" de tasks (TO authenticated)');
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'projects'
        and policyname in ('Users can view own projects', 'Users can insert own projects', 'Users can update own projects',
                           'Users can delete own projects', 'Members can view accessible projects')) <> 5 then
    problems := array_append(problems, 'faltam policies de projects');
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'people'
        and policyname in ('Users can view own people', 'Users can insert own people', 'Users can update own people',
                           'Users can delete own people', 'Members can view co-members')) <> 5 then
    problems := array_append(problems, 'faltam policies de people');
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'project_members'
        and policyname in ('Access can view project members', 'Owner can add project members',
                           'Owner can remove project members')) <> 3 then
    problems := array_append(problems, 'faltam policies de project_members');
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname in ('tasks', 'projects', 'people', 'project_members')
               and not c.relrowsecurity) then
    problems := array_append(problems, 'RLS desligado em alguma das 4 tabelas');
  end if;

  foreach col in array array['tasks.waiting_on_person_id', 'tasks.waiting_on_text', 'tasks.follow_up_date',
                             'projects.health_override', 'projects.health_override_at', 'projects.next_action_task_id',
                             'people.workspace_id'] loop
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = split_part(col, '.', 1)
                     and column_name = split_part(col, '.', 2)) then
      problems := array_append(problems, 'coluna ' || col || ' ausente');
    end if;
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'tasks_status_check' and conrelid = 'public.tasks'::regclass
                   and pg_get_constraintdef(oid) like '%waiting%') then
    problems := array_append(problems, 'tasks_status_check sem waiting');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_status_check' and conrelid = 'public.projects'::regclass
                   and pg_get_constraintdef(oid) like '%idea%') then
    problems := array_append(problems, 'projects_status_check sem idea');
  end if;
  if (select count(*) from pg_constraint where conrelid = 'public.tasks'::regclass and conname in (
        'tasks_waiting_on_person_id_fkey', 'tasks_waiting_on_text_length_check',
        'tasks_waiting_on_one_check', 'tasks_waiting_follow_up_check')) <> 4 then
    problems := array_append(problems, 'constraints de Aguardando ausentes');
  end if;
  if (select count(*) from pg_constraint where conrelid = 'public.projects'::regclass and conname in (
        'projects_health_override_check', 'projects_next_action_task_id_fkey')) <> 2 then
    problems := array_append(problems, 'constraints de saúde/próxima ação ausentes');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'people_workspace_id_fkey' and conrelid = 'public.people'::regclass) then
    problems := array_append(problems, 'fk people_workspace_id_fkey ausente');
  end if;

  if (select count(*) from pg_trigger where not tgisinternal and (tgname, tgrelid) in (
        ('task_waiting_fields', 'public.tasks'::regclass),
        ('project_health_fields', 'public.projects'::regclass),
        ('person_workspace_check', 'public.people'::regclass),
        ('protect_inbox_project', 'public.projects'::regclass),
        ('set_task_completed_at', 'public.tasks'::regclass))) <> 5 then
    problems := array_append(problems, 'triggers ausentes');
  end if;

  if to_regclass('public.tasks_waiting_follow_up_idx') is null
     or to_regclass('public.projects_next_action_task_id_idx') is null
     or to_regclass('public.people_workspace_id_idx') is null then
    problems := array_append(problems, 'índices ausentes');
  end if;

  if array_length(problems, 1) > 0 then
    raise exception 'Migration 000700 abortada: %', array_to_string(problems, '; ');
  end if;
end;
$$;

commit;
