-- =========================================================
-- Migration 004: Acesso de participantes (convidados) por projeto
-- =========================================================
-- Objetivo: permitir que um usuário CONVIDADO acesse SOMENTE os
-- projetos em que é membro (via project_members), mantendo o dono
-- com acesso total ao que é dele. Também fecha duas brechas:
--   - project_members estava totalmente aberta (qual = true)
--   - planilhas (project_spreadsheets/spreadsheet_*) eram visíveis
--     a QUALQUER usuário autenticado (vazamento entre contas).
--
-- Modelo atual (confirmado em produção): isolamento por dono via
-- user_id = auth.uid(). Esta migração é ADITIVA para o dono
-- (as políticas existentes continuam valendo) e apenas ENDURECE
-- project_members e planilhas.
--
-- A "chave" do convidado: auth.uid() -> people.auth_user_id
--   -> project_members.person_id -> project_members.project_id
--
-- INSTRUÇÕES: rode este script inteiro no SQL Editor do Supabase.
-- É idempotente (pode rodar mais de uma vez).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Funções auxiliares (SECURITY DEFINER: ignoram RLS por dentro,
--    evitando recursão de políticas)
-- ---------------------------------------------------------

-- Dono do projeto OU membro (participante) do projeto
create or replace function public.can_access_project(_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1 from projects p
      where p.id = _project_id and p.user_id = auth.uid()
    )
    or exists (
      select 1
      from project_members pm
      join people pe on pe.id = pm.person_id
      where pm.project_id = _project_id
        and pe.auth_user_id = auth.uid()
    );
$$;

-- Uma pessoa é "visível" se for o próprio convidado ou se
-- compartilha algum projeto com o usuário atual
create or replace function public.can_view_person(_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1 from people me
      where me.id = _person_id and me.auth_user_id = auth.uid()
    )
    or exists (
      select 1
      from project_members pm_self
      join people pe_self on pe_self.id = pm_self.person_id
      join project_members pm_other on pm_other.project_id = pm_self.project_id
      where pe_self.auth_user_id = auth.uid()
        and pm_other.person_id = _person_id
    );
$$;

-- Dono da planilha (via project_spreadsheets.user_id)
create or replace function public.owns_spreadsheet(_spreadsheet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from project_spreadsheets ps
    where ps.id = _spreadsheet_id and ps.user_id = auth.uid()
  );
$$;

-- Dono via linha (spreadsheet_cells liga por row_id)
create or replace function public.owns_spreadsheet_row(_row_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from spreadsheet_rows r
    join project_spreadsheets ps on ps.id = r.spreadsheet_id
    where r.id = _row_id and ps.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------
-- 2) Políticas de PARTICIPANTE (aditivas; o dono mantém as dele)
--    RLS permissivo = as políticas se somam por OR.
-- ---------------------------------------------------------

-- PROJECTS: participante só VÊ o projeto (não edita/exclui)
drop policy if exists "Members can view accessible projects" on projects;
create policy "Members can view accessible projects" on projects
  for select using (public.can_access_project(id));

-- Macro auxiliar (repetido explicitamente por clareza/auditoria):
-- para cada tabela filha do projeto, participante e dono podem
-- SELECT/INSERT/UPDATE/DELETE nos dados de projetos que acessam.

-- TASKS
drop policy if exists "Project access select tasks" on tasks;
create policy "Project access select tasks" on tasks
  for select using (public.can_access_project(project_id));
drop policy if exists "Project access insert tasks" on tasks;
create policy "Project access insert tasks" on tasks
  for insert with check (public.can_access_project(project_id));
drop policy if exists "Project access update tasks" on tasks;
create policy "Project access update tasks" on tasks
  for update using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));
drop policy if exists "Project access delete tasks" on tasks;
create policy "Project access delete tasks" on tasks
  for delete using (public.can_access_project(project_id));

-- PHASES
drop policy if exists "Project access select phases" on phases;
create policy "Project access select phases" on phases
  for select using (public.can_access_project(project_id));
drop policy if exists "Project access insert phases" on phases;
create policy "Project access insert phases" on phases
  for insert with check (public.can_access_project(project_id));
drop policy if exists "Project access update phases" on phases;
create policy "Project access update phases" on phases
  for update using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));
drop policy if exists "Project access delete phases" on phases;
create policy "Project access delete phases" on phases
  for delete using (public.can_access_project(project_id));

-- MILESTONES
drop policy if exists "Project access select milestones" on milestones;
create policy "Project access select milestones" on milestones
  for select using (public.can_access_project(project_id));
drop policy if exists "Project access insert milestones" on milestones;
create policy "Project access insert milestones" on milestones
  for insert with check (public.can_access_project(project_id));
drop policy if exists "Project access update milestones" on milestones;
create policy "Project access update milestones" on milestones
  for update using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));
drop policy if exists "Project access delete milestones" on milestones;
create policy "Project access delete milestones" on milestones
  for delete using (public.can_access_project(project_id));

-- CUSTOM_COLUMNS
drop policy if exists "Project access select custom_columns" on custom_columns;
create policy "Project access select custom_columns" on custom_columns
  for select using (public.can_access_project(project_id));
drop policy if exists "Project access insert custom_columns" on custom_columns;
create policy "Project access insert custom_columns" on custom_columns
  for insert with check (public.can_access_project(project_id));
drop policy if exists "Project access update custom_columns" on custom_columns;
create policy "Project access update custom_columns" on custom_columns
  for update using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));
drop policy if exists "Project access delete custom_columns" on custom_columns;
create policy "Project access delete custom_columns" on custom_columns
  for delete using (public.can_access_project(project_id));

-- MEETING_NOTES (anotações)
drop policy if exists "Project access select meeting_notes" on meeting_notes;
create policy "Project access select meeting_notes" on meeting_notes
  for select using (public.can_access_project(project_id));
drop policy if exists "Project access insert meeting_notes" on meeting_notes;
create policy "Project access insert meeting_notes" on meeting_notes
  for insert with check (public.can_access_project(project_id));
drop policy if exists "Project access update meeting_notes" on meeting_notes;
create policy "Project access update meeting_notes" on meeting_notes
  for update using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));
drop policy if exists "Project access delete meeting_notes" on meeting_notes;
create policy "Project access delete meeting_notes" on meeting_notes
  for delete using (public.can_access_project(project_id));

-- PEOPLE: participante VÊ apenas quem compartilha projeto com ele
drop policy if exists "Members can view co-members" on people;
create policy "Members can view co-members" on people
  for select using (public.can_view_person(id));

-- ---------------------------------------------------------
-- 3) ENDURECER project_members (estava aberta: qual = true)
--    Quem acessa o projeto LÊ; só o DONO adiciona/remove.
-- ---------------------------------------------------------
drop policy if exists "Users can view project members" on project_members;
drop policy if exists "Users can insert project members" on project_members;
drop policy if exists "Users can delete project members" on project_members;

create policy "Access can view project members" on project_members
  for select using (public.can_access_project(project_id));
create policy "Owner can add project members" on project_members
  for insert with check (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  );
create policy "Owner can remove project members" on project_members
  for delete using (
    exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------
-- 4) FECHAR vazamento das PLANILHAS (eram "authenticated vê tudo").
--    Passa a ser só do DONO (participante não acessa planilhas na v1).
-- ---------------------------------------------------------

-- project_spreadsheets
drop policy if exists "Authenticated users can manage spreadsheets" on project_spreadsheets;
drop policy if exists "Authenticated users can view spreadsheets" on project_spreadsheets;
drop policy if exists "Users can manage own spreadsheets" on project_spreadsheets;
drop policy if exists "Users can view spreadsheets" on project_spreadsheets;
drop policy if exists "auth_spreadsheets" on project_spreadsheets;
create policy "Owner manages spreadsheets" on project_spreadsheets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- spreadsheet_sheets
drop policy if exists "Users can manage sheets of their spreadsheets" on spreadsheet_sheets;
create policy "Owner manages sheets" on spreadsheet_sheets
  for all using (public.owns_spreadsheet(spreadsheet_id))
  with check (public.owns_spreadsheet(spreadsheet_id));

-- spreadsheet_columns
drop policy if exists "Authenticated users can manage spreadsheet_columns" on spreadsheet_columns;
drop policy if exists "Authenticated users can view spreadsheet_columns" on spreadsheet_columns;
drop policy if exists "Users can manage spreadsheet_columns" on spreadsheet_columns;
drop policy if exists "Users can view spreadsheet_columns" on spreadsheet_columns;
drop policy if exists "auth_columns" on spreadsheet_columns;
create policy "Owner manages columns" on spreadsheet_columns
  for all using (public.owns_spreadsheet(spreadsheet_id))
  with check (public.owns_spreadsheet(spreadsheet_id));

-- spreadsheet_rows
drop policy if exists "Authenticated users can manage spreadsheet_rows" on spreadsheet_rows;
drop policy if exists "Authenticated users can view spreadsheet_rows" on spreadsheet_rows;
drop policy if exists "Users can manage spreadsheet_rows" on spreadsheet_rows;
drop policy if exists "Users can view spreadsheet_rows" on spreadsheet_rows;
drop policy if exists "auth_rows" on spreadsheet_rows;
create policy "Owner manages rows" on spreadsheet_rows
  for all using (public.owns_spreadsheet(spreadsheet_id))
  with check (public.owns_spreadsheet(spreadsheet_id));

-- spreadsheet_merges
drop policy if exists "Users can manage spreadsheet_merges" on spreadsheet_merges;
drop policy if exists "Users can view spreadsheet_merges" on spreadsheet_merges;
create policy "Owner manages merges" on spreadsheet_merges
  for all using (public.owns_spreadsheet(spreadsheet_id))
  with check (public.owns_spreadsheet(spreadsheet_id));

-- spreadsheet_cells (liga por row_id)
drop policy if exists "Authenticated users can manage spreadsheet_cells" on spreadsheet_cells;
drop policy if exists "Authenticated users can view spreadsheet_cells" on spreadsheet_cells;
drop policy if exists "Users can manage spreadsheet_cells" on spreadsheet_cells;
drop policy if exists "Users can view spreadsheet_cells" on spreadsheet_cells;
drop policy if exists "auth_cells" on spreadsheet_cells;
create policy "Owner manages cells" on spreadsheet_cells
  for all using (public.owns_spreadsheet_row(row_id))
  with check (public.owns_spreadsheet_row(row_id));

-- =========================================================
-- Fim da migração 004
-- =========================================================
