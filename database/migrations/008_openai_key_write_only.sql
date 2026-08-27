-- =========================================================
-- Migration 008: Chave OpenAI write-only (cliente nunca lê o valor)
-- =========================================================
-- Remove o acesso direto do cliente à tabela user_ai_settings.
-- O cliente passa a usar apenas RPCs:
--   - set_openai_key(p_key): grava a chave (upsert)
--   - has_openai_key(): retorna se existe uma chave (boolean)
-- A Edge Function generate-meeting-minutes continua lendo via service role.
--
-- INSTRUÇÕES: rode no SQL Editor do Supabase (idempotente).
-- =========================================================

-- Sem políticas de acesso direto: com RLS habilitado e nenhuma policy,
-- o cliente não consegue SELECT/INSERT/UPDATE direto (nem ler a chave).
drop policy if exists "Users manage own ai settings" on public.user_ai_settings;
drop policy if exists "Users insert own ai key" on public.user_ai_settings;
drop policy if exists "Users update own ai key" on public.user_ai_settings;

-- Grava/atualiza a chave do próprio usuário (bypass de RLS via SECURITY DEFINER)
create or replace function public.set_openai_key(p_key text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.user_ai_settings (user_id, openai_key, updated_at)
  values (auth.uid(), nullif(p_key, ''), now())
  on conflict (user_id) do update
    set openai_key = nullif(p_key, ''), updated_at = now();
$$;

-- Indica apenas se há uma chave configurada (não expõe o valor)
create or replace function public.has_openai_key()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_ai_settings
    where user_id = auth.uid() and openai_key is not null and openai_key <> ''
  );
$$;

grant execute on function public.set_openai_key(text) to authenticated;
grant execute on function public.has_openai_key() to authenticated;
