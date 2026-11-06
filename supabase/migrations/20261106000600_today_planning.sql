-- =========================================================
-- Migration 20261106000600: Planejamento do dia (Etapa 3, página Hoje)
-- =========================================================
-- O que muda:
--   - tasks.planned_date (date): dia em que a tarefa será feita (end_date é o prazo);
--   - tasks.estimate_minutes (integer, 1 a 1440);
--   - tasks.today_order (integer): ordem manual dentro de "Planejadas para hoje";
--   - tasks.completed_at (timestamptz): gravado pelo trigger set_task_completed_at
--     quando o status passa a 'completed' (também no insert) e limpo quando sai.
--     Tarefas concluídas antes desta migration ficam com null;
--   - tabela user_planning_settings: capacidade em minutos por dia da semana,
--     RLS só para o próprio usuário (select, insert, update), TO authenticated;
--   - custom_columns_standard_field_check passa a aceitar 'plannedDate' e 'estimate'
--     (colunas padrão "Planejado para" e "Estimativa" da tabela de tarefas);
--   - índices parciais para as consultas da página Hoje.
-- Nenhuma policy de tasks é criada, alterada ou removida: os campos novos seguem
-- as policies atuais (can_access_project: dono do projeto ou participante).
--
-- Idempotente. Aborta (rollback) se as policies de tasks ou de
-- user_planning_settings não estiverem no estado esperado.
-- =========================================================

begin;

-- ---------- Pré-requisitos ----------
do $$
begin
  if to_regclass('public.tasks') is null or to_regclass('public.custom_columns') is null then
    raise exception 'tabelas public.tasks/public.custom_columns não existem';
  end if;
  if to_regprocedure('public.update_updated_at_column()') is null then
    raise exception 'public.update_updated_at_column() não existe';
  end if;
end;
$$;

-- ---------- Campos novos em tasks ----------
alter table public.tasks add column if not exists planned_date date;
alter table public.tasks add column if not exists estimate_minutes integer;
alter table public.tasks add column if not exists today_order integer;
alter table public.tasks add column if not exists completed_at timestamptz;

comment on column public.tasks.planned_date is 'Dia em que a tarefa será feita (planejamento). Diferente de end_date, que é o prazo.';
comment on column public.tasks.estimate_minutes is 'Estimativa em minutos (1 a 1440).';
comment on column public.tasks.today_order is 'Ordem manual dentro do dia planejado (página Hoje).';
comment on column public.tasks.completed_at is 'Quando a tarefa foi concluída. Mantido pelo trigger set_task_completed_at.';

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'tasks_estimate_minutes_check' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks
      add constraint tasks_estimate_minutes_check check (estimate_minutes between 1 and 1440);
  end if;
end;
$$;

-- ---------- completed_at automático ----------
-- Vale para qualquer role e qualquer tela: o app não precisa mandar a data.
create or replace function public.set_task_completed_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' then
      new.completed_at := now();
    else
      -- Continua concluída: mantém a data original
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.set_task_completed_at() from public;

drop trigger if exists set_task_completed_at on public.tasks;
create trigger set_task_completed_at
  before insert or update on public.tasks
  for each row execute function public.set_task_completed_at();

-- ---------- Índices da página Hoje ----------
create index if not exists tasks_open_planned_date_idx
  on public.tasks (planned_date)
  where planned_date is not null and status not in ('completed', 'cancelled');

create index if not exists tasks_open_end_date_idx
  on public.tasks (end_date)
  where end_date is not null and status not in ('completed', 'cancelled');

create index if not exists tasks_completed_at_idx
  on public.tasks (completed_at)
  where completed_at is not null;

-- ---------- Colunas padrão "Planejado para" e "Estimativa" ----------
alter table public.custom_columns drop constraint if exists custom_columns_standard_field_check;
alter table public.custom_columns
  add constraint custom_columns_standard_field_check check (standard_field = any (array[
    'name', 'description', 'responsible', 'status', 'priority',
    'startDate', 'endDate', 'progress', 'plannedDate', 'estimate'
  ]::text[]));

-- ---------- Capacidade por dia da semana ----------
create table if not exists public.user_planning_settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  mon_minutes integer not null default 360 constraint user_planning_settings_mon_check check (mon_minutes between 0 and 1440),
  tue_minutes integer not null default 360 constraint user_planning_settings_tue_check check (tue_minutes between 0 and 1440),
  wed_minutes integer not null default 360 constraint user_planning_settings_wed_check check (wed_minutes between 0 and 1440),
  thu_minutes integer not null default 360 constraint user_planning_settings_thu_check check (thu_minutes between 0 and 1440),
  fri_minutes integer not null default 360 constraint user_planning_settings_fri_check check (fri_minutes between 0 and 1440),
  sat_minutes integer not null default 0   constraint user_planning_settings_sat_check check (sat_minutes between 0 and 1440),
  sun_minutes integer not null default 0   constraint user_planning_settings_sun_check check (sun_minutes between 0 and 1440),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.user_planning_settings is
  'Capacidade de trabalho planejável por dia da semana, em minutos. Uma linha por usuário, criada no primeiro salvamento.';

alter table public.user_planning_settings enable row level security;

revoke all on table public.user_planning_settings from anon, public;
revoke all on table public.user_planning_settings from authenticated;
grant select, insert, update on table public.user_planning_settings to authenticated;

drop policy if exists "Own planning settings select" on public.user_planning_settings;
create policy "Own planning settings select" on public.user_planning_settings
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Own planning settings insert" on public.user_planning_settings;
create policy "Own planning settings insert" on public.user_planning_settings
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Own planning settings update" on public.user_planning_settings;
create policy "Own planning settings update" on public.user_planning_settings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists update_user_planning_settings_updated_at on public.user_planning_settings;
create trigger update_user_planning_settings_updated_at
  before update on public.user_planning_settings
  for each row execute function public.update_updated_at_column();

-- ---------- Verificação final ----------
do $$
declare
  problems text[] := '{}';
  policies_now text;
  col text;
begin
  -- Policies de tasks: exatamente as 4 por acesso ao projeto, deixadas pela
  -- migration 000100 (Etapa 1). Se as antigas "Users can ... own tasks" ainda
  -- existirem, a 000100 não foi aplicada: aborta.
  select string_agg(format('"%s"', policyname), ', ' order by policyname)
    into policies_now
  from pg_policies
  where schemaname = 'public' and tablename = 'tasks'
    and coalesce(qual, '') || coalesce(with_check, '') !~* '(is_admin|has_role)'
    and policyname not in (
      'Project access select tasks', 'Project access insert tasks',
      'Project access update tasks', 'Project access delete tasks'
    );
  if policies_now is not null then
    problems := array_append(problems, 'policies inesperadas em tasks: ' || policies_now);
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'tasks'
        and policyname in ('Project access select tasks', 'Project access insert tasks',
                           'Project access update tasks', 'Project access delete tasks')) <> 4 then
    problems := array_append(problems, 'faltam policies de tasks');
  end if;

  -- user_planning_settings: só as 3 policies do próprio usuário
  select string_agg(format('"%s"', policyname), ', ' order by policyname)
    into policies_now
  from pg_policies
  where schemaname = 'public' and tablename = 'user_planning_settings'
    and policyname not in ('Own planning settings select', 'Own planning settings insert',
                           'Own planning settings update');
  if policies_now is not null then
    problems := array_append(problems, 'policies inesperadas em user_planning_settings: ' || policies_now);
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'user_planning_settings'
        and roles = '{authenticated}'
        and policyname in ('Own planning settings select', 'Own planning settings insert',
                           'Own planning settings update')) <> 3 then
    problems := array_append(problems, 'faltam policies de user_planning_settings (TO authenticated)');
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.user_planning_settings'::regclass) then
    problems := array_append(problems, 'RLS desligado em user_planning_settings');
  end if;
  if has_table_privilege('anon', 'public.user_planning_settings', 'select')
     or has_table_privilege('anon', 'public.user_planning_settings', 'insert') then
    problems := array_append(problems, 'anon tem acesso a user_planning_settings');
  end if;
  if has_table_privilege('authenticated', 'public.user_planning_settings', 'delete') then
    problems := array_append(problems, 'authenticated pode excluir em user_planning_settings');
  end if;

  foreach col in array array['planned_date', 'estimate_minutes', 'today_order', 'completed_at'] loop
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'tasks' and column_name = col) then
      problems := array_append(problems, 'coluna tasks.' || col || ' ausente');
    end if;
  end loop;
  if not exists (select 1 from pg_constraint
                 where conname = 'tasks_estimate_minutes_check' and conrelid = 'public.tasks'::regclass) then
    problems := array_append(problems, 'check tasks_estimate_minutes_check ausente');
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'custom_columns_standard_field_check'
                   and conrelid = 'public.custom_columns'::regclass
                   and pg_get_constraintdef(oid) like '%plannedDate%'
                   and pg_get_constraintdef(oid) like '%estimate%') then
    problems := array_append(problems, 'custom_columns_standard_field_check sem plannedDate/estimate');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_task_completed_at'
                   and tgrelid = 'public.tasks'::regclass and not tgisinternal) then
    problems := array_append(problems, 'trigger set_task_completed_at ausente');
  end if;
  if to_regclass('public.tasks_open_planned_date_idx') is null
     or to_regclass('public.tasks_open_end_date_idx') is null
     or to_regclass('public.tasks_completed_at_idx') is null then
    problems := array_append(problems, 'índices da página Hoje ausentes');
  end if;

  if array_length(problems, 1) > 0 then
    raise exception 'Migration 000600 abortada: %', array_to_string(problems, '; ');
  end if;
end;
$$;

commit;
