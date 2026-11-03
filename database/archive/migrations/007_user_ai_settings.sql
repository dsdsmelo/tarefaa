-- =========================================================
-- Migration 007: Chave da API de IA por usuário (dono)
-- =========================================================
-- Guarda a chave da OpenAI informada em Configurações. Só o
-- próprio dono acessa a sua linha (RLS user_id = auth.uid()).
-- A Edge Function lê a chave do DONO do projeto via service role.
--
-- INSTRUÇÕES: rode no SQL Editor do Supabase (idempotente).
-- =========================================================

create table if not exists public.user_ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  openai_key text,
  updated_at timestamptz not null default now()
);

alter table public.user_ai_settings enable row level security;

drop policy if exists "Users manage own ai settings" on public.user_ai_settings;
create policy "Users manage own ai settings" on public.user_ai_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
