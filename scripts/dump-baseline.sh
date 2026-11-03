#!/usr/bin/env bash
# =========================================================
# Gera a migration baseline a partir do schema de PRODUÇÃO (somente leitura).
#
# Uso (a connection string fica só na variável do shell; nunca em arquivo):
#   read -rs PROD_DB_URL && export PROD_DB_URL
#   bash scripts/dump-baseline.sh
#   unset PROD_DB_URL
#
# O que faz, tudo em leitura:
#   1. supabase db dump --schema-only: schemas do app (public etc.), com tabelas,
#      tipos, índices, constraints, funções, triggers, RLS, policies e grants.
#   2. Consultas read-only para o que o dump não traz:
#      - triggers em auth.users que chamam funções do app (ex.: criar perfil);
#      - buckets do Storage (linhas de storage.buckets);
#      - policies de storage.objects.
# Saída: supabase/migrations/20261103000000_baseline_prod.sql
#
# A baseline é para bancos VAZIOS (ambiente novo / local). Em produção ela já
# está aplicada: marque com `supabase migration repair --status applied 20261103000000`
# se um dia usar a CLI contra produção. Ver docs/DEPLOYMENT.md.
# =========================================================
set -euo pipefail

: "${PROD_DB_URL:?Defina PROD_DB_URL no shell (read -rs PROD_DB_URL && export PROD_DB_URL)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/supabase/migrations/20261103000000_baseline_prod.sql"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Toda sessão do psql abre em modo somente leitura
export PGOPTIONS='-c default_transaction_read_only=on'
PSQL=(psql "$PROD_DB_URL" -X -At -v ON_ERROR_STOP=1)

echo "==> Dump do schema (somente leitura)"
supabase db dump --db-url "$PROD_DB_URL" --schema-only -f "$TMP/schema.sql"

echo "==> Triggers de auth.users que chamam funções do app"
"${PSQL[@]}" > "$TMP/auth_triggers.sql" <<'SQL'
select format('drop trigger if exists %I on auth.users;', t.tgname) || E'\n' || pg_get_triggerdef(t.oid) || ';'
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_namespace pn on pn.oid = p.pronamespace
where n.nspname = 'auth' and not t.tgisinternal and pn.nspname = 'public'
order by t.tgname;
SQL

echo "==> Buckets do Storage"
"${PSQL[@]}" > "$TMP/buckets.sql" <<'SQL'
select format(
  'insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %s, %s) on conflict (id) do nothing;',
  id, name, public,
  coalesce(file_size_limit::text, 'null'),
  coalesce(quote_literal(allowed_mime_types::text) || '::text[]', 'null'))
from storage.buckets
order by id;
SQL

echo "==> Policies de storage.objects"
"${PSQL[@]}" > "$TMP/storage_policies.sql" <<'SQL'
select format('drop policy if exists %I on storage.objects;', policyname) || E'\n' ||
  format('create policy %I on storage.objects as %s for %s to %s%s%s;',
    policyname, permissive, cmd,
    array_to_string(roles, ', '),
    case when qual is not null then ' using (' || qual || ')' else '' end,
    case when with_check is not null then ' with check (' || with_check || ')' else '' end)
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
SQL

{
  echo "-- ========================================================="
  echo "-- Baseline do schema de produção — gerada em $(date -u +%Y-%m-%dT%H:%MZ)"
  echo "-- por scripts/dump-baseline.sh (somente leitura)."
  echo "-- Para bancos VAZIOS. Em produção, já aplicada: NÃO execute lá."
  echo "-- ========================================================="
  echo
  cat "$TMP/schema.sql"
  echo
  echo "-- ---------- Triggers em auth.users (fora do dump do schema public) ----------"
  cat "$TMP/auth_triggers.sql"
  echo
  echo "-- ---------- Buckets do Storage ----------"
  cat "$TMP/buckets.sql"
  echo
  echo "-- ---------- Policies de storage.objects ----------"
  cat "$TMP/storage_policies.sql"
} > "$OUT"

# Conferência: nenhuma credencial pode ter ido parar no arquivo
if grep -qiE 'postgres(ql)?://|password=' "$OUT"; then
  rm -f "$OUT"
  echo "ERRO: o arquivo gerado contém algo parecido com credencial; removido." >&2
  exit 1
fi

echo "==> Baseline gerada: $OUT"
