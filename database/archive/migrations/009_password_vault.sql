-- =========================================================
-- Migration 009: Cofre de Senhas (zero-knowledge / E2E)
-- =========================================================
-- O conteúdo é criptografado NO NAVEGADOR (AES-GCM) com uma chave
-- derivada da SENHA MESTRA (Argon2id). O servidor guarda SOMENTE texto
-- cifrado — nunca a senha mestra, o código de recuperação, as chaves,
-- nem os dados em claro (nem os títulos).
--
-- vault_meta: material de chave por usuário (salt, params do KDF e a
--   "chave do cofre" embrulhada pela senha mestra E pelo código de
--   recuperação). RLS: só o dono.
-- vault_items: cada item é um blob cifrado (título/usuário/senha/URL
--   ficam TODOS dentro do cifrado). RLS: só o dono.
--
-- INSTRUÇÕES: rode no SQL Editor do Supabase (idempotente).
-- =========================================================

create table if not exists public.vault_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kdf text not null default 'argon2id',
  kdf_salt text not null,                 -- base64 (público, não secreto)
  kdf_mem integer not null,               -- KiB
  kdf_iter integer not null,
  kdf_par integer not null,
  protected_by_master text not null,      -- chave do cofre embrulhada pela senha mestra (base64 iv+ct)
  recovery_salt text,                     -- base64
  protected_by_recovery text,             -- chave do cofre embrulhada pelo código de recuperação
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blob text not null,                     -- JSON cifrado (base64 iv+ct): {title, username, password, url}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vault_items_user on public.vault_items(user_id);

alter table public.vault_meta enable row level security;
alter table public.vault_items enable row level security;

-- vault_meta: só o próprio dono acessa (ainda assim é só material cifrado)
drop policy if exists "Owner manages vault_meta" on public.vault_meta;
create policy "Owner manages vault_meta" on public.vault_meta
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- vault_items: só o próprio dono acessa
drop policy if exists "Owner manages vault_items" on public.vault_items;
create policy "Owner manages vault_items" on public.vault_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
