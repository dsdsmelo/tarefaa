-- =========================================================
-- Migration 006: Atas de reunião (histórico)
-- =========================================================
-- Tabela para guardar as atas geradas por IA a partir de
-- transcrições. Segue o mesmo modelo de acesso das demais
-- tabelas do projeto (dono + participantes via can_access_project).
--
-- INSTRUÇÕES: rode no SQL Editor do Supabase (idempotente).
-- Requer a função public.can_access_project (migração 004).
-- =========================================================

create table if not exists public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  title text not null default 'Ata de Reunião',
  meeting_date date not null default current_date,
  transcript text,            -- transcrição original (fonte)
  content text,               -- HTML da ata gerada/editada
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meeting_minutes_project on public.meeting_minutes(project_id);

alter table public.meeting_minutes enable row level security;

drop policy if exists "Access can view meeting_minutes" on public.meeting_minutes;
create policy "Access can view meeting_minutes" on public.meeting_minutes
  for select using (public.can_access_project(project_id));

drop policy if exists "Access can insert meeting_minutes" on public.meeting_minutes;
create policy "Access can insert meeting_minutes" on public.meeting_minutes
  for insert with check (public.can_access_project(project_id));

drop policy if exists "Access can update meeting_minutes" on public.meeting_minutes;
create policy "Access can update meeting_minutes" on public.meeting_minutes
  for update using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

drop policy if exists "Access can delete meeting_minutes" on public.meeting_minutes;
create policy "Access can delete meeting_minutes" on public.meeting_minutes
  for delete using (public.can_access_project(project_id));
