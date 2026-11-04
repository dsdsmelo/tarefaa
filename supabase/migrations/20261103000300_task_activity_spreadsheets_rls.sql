-- =========================================================
-- Migration 20261103000300: RLS de task_activity e project_spreadsheets (item 1.6)
-- =========================================================
-- task_activity
--   Problema: SELECT era (auth.uid() = user_id) OR EXISTS(...): o ex-participante
--   continuava vendo as atividades que gerou. INSERT conferia só user_id, então
--   qualquer usuário gravava atividade em tarefa de projeto alheio.
--   Correção: SELECT depende só do acesso ao projeto da tarefa; INSERT exige
--   user_id = auth.uid() E acesso ao projeto da tarefa.
--
-- project_spreadsheets
--   Problema: "Owner manages spreadsheets" (ALL) não conferia o project_id: dava
--   para criar/mover planilha para projeto de outra pessoa.
--   Correção: mantém o modelo de dono; no WITH CHECK exige também que o projeto
--   seja do usuário. As tabelas spreadsheet_* herdam via owns_spreadsheet() e
--   owns_spreadsheet_row() (dono da planilha), então não mudam: só são auditadas.
--
-- Idempotente. Aborta (rollback) se sobrar policy fora do padrão.
-- Policies restritas a admin (is_admin/has_role) são preservadas.
-- =========================================================

begin;

-- ---------- Pré-requisitos ----------
do $$
begin
  if to_regprocedure('public.can_access_project(uuid)') is null then
    raise exception 'public.can_access_project(uuid) não existe';
  end if;
  if to_regclass('public.task_activity') is null then
    raise exception 'tabela public.task_activity não existe';
  end if;
  if to_regprocedure('public.owns_spreadsheet(uuid)') is null
     or to_regprocedure('public.owns_spreadsheet_row(uuid)') is null then
    raise exception 'owns_spreadsheet()/owns_spreadsheet_row() não existem';
  end if;
end;
$$;

-- ---------- Helper: acesso à tarefa = acesso ao projeto da tarefa ----------
-- SECURITY DEFINER para ler tasks sem depender do RLS de tasks (mesmo padrão
-- de can_access_project).
create or replace function public.can_access_task(_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from tasks t
    where t.id = _task_id and public.can_access_project(t.project_id)
  );
$$;

revoke all on function public.can_access_task(uuid) from public;
grant execute on function public.can_access_task(uuid) to authenticated, service_role;

-- ---------- task_activity ----------
alter table public.task_activity enable row level security;

-- Remove as policies de SELECT e INSERT atuais (qualquer nome), exceto as de admin
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'task_activity'
      and cmd in ('SELECT', 'INSERT')
      and coalesce(qual, '') || coalesce(with_check, '') !~* '(is_admin|has_role)'
  loop
    execute format('drop policy %I on public.task_activity', pol.policyname);
  end loop;
end;
$$;

create policy "Project access select task_activity" on public.task_activity
  for select to authenticated
  using (public.can_access_task(task_id));

create policy "Project access insert task_activity" on public.task_activity
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_task(task_id));

-- ---------- project_spreadsheets ----------
drop policy if exists "Owner manages spreadsheets" on public.project_spreadsheets;
create policy "Owner manages spreadsheets" on public.project_spreadsheets
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

-- Aviso (não bloqueia): planilhas já existentes em projeto de outra pessoa.
-- Continuam visíveis para o dono da planilha, mas não podem mais ser
-- renomeadas/movidas sem trocar para um projeto próprio.
do $$
declare
  orphans int;
begin
  select count(*) into orphans
  from public.project_spreadsheets ps
  join public.projects p on p.id = ps.project_id
  where p.user_id is distinct from ps.user_id;
  if orphans > 0 then
    raise notice 'Atenção: % planilha(s) estão em projeto que não é do dono da planilha', orphans;
  end if;
end;
$$;

-- ---------- Verificação final: nada fora do padrão ----------
do $$
declare
  leftovers text;
begin
  select string_agg(format('%s: "%s" (%s)', tablename, policyname, cmd), ', ' order by tablename, policyname)
    into leftovers
  from pg_policies
  where schemaname = 'public'
    and coalesce(qual, '') || coalesce(with_check, '') !~* '(is_admin|has_role)'
    and (tablename, policyname) not in (
      ('task_activity',        'Project access select task_activity'),
      ('task_activity',        'Project access insert task_activity'),
      ('project_spreadsheets', 'Owner manages spreadsheets'),
      ('spreadsheet_sheets',   'Owner manages sheets'),
      ('spreadsheet_columns',  'Owner manages columns'),
      ('spreadsheet_rows',     'Owner manages rows'),
      ('spreadsheet_merges',   'Owner manages merges'),
      ('spreadsheet_cells',    'Owner manages cells')
    )
    and tablename in ('task_activity', 'project_spreadsheets', 'spreadsheet_sheets',
                      'spreadsheet_columns', 'spreadsheet_rows', 'spreadsheet_merges',
                      'spreadsheet_cells');

  if leftovers is not null then
    raise exception 'Policies fora do padrão canônico (revise antes de aplicar): %', leftovers;
  end if;
end;
$$;

commit;
