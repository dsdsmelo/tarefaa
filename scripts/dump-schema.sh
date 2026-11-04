#!/usr/bin/env bash
# =========================================================
# Gera a migration baseline a partir do schema de PRODUÇÃO, sem connection string.
#
# Pré-requisito (uma vez, no Mac): vincular o projeto com a senha do banco, que a
# CLI pede em prompt oculto e guarda no Keychain do macOS:
#   supabase link --project-ref khnsqupkdnouimonughn
# Nunca deixe a senha em branco: sem ela, a CLI cria um usuário temporário no
# banco (escrita em produção). Este script se recusa a rodar sem a senha no Keychain.
#
# Uso: bash scripts/dump-schema.sh
#
# Somente leitura: só roda `supabase db dump` (pg_dump, que abre transação READ ONLY).
# Nenhum psql, nenhuma escrita. Docker precisa estar aberto (a CLI roda o pg_dump num container).
# Saída: supabase/migrations/20261103000000_baseline_prod.sql (sem credenciais;
# conferido antes de gravar). Ver docs/DEPLOYMENT.md, seção 2.3.
# =========================================================
set -euo pipefail

EXPECTED_REF="khnsqupkdnouimonughn"
KEYCHAIN_SERVICE="Supabase CLI"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/supabase/migrations/20261103000000_baseline_prod.sql"
REF_FILE="$ROOT/supabase/.temp/project-ref"

die() { echo "ERRO: $*" >&2; exit 1; }

cd "$ROOT"

# 1. Projeto vinculado tem que ser o Tarefaa (evita dump de outro projeto)
[ -f "$REF_FILE" ] || die "projeto não vinculado. Rode: supabase link --project-ref $EXPECTED_REF"
REF="$(tr -d '[:space:]' < "$REF_FILE")"
[ "$REF" = "$EXPECTED_REF" ] || die "projeto vinculado é '$REF', esperado '$EXPECTED_REF'. Rode: supabase link --project-ref $EXPECTED_REF"

# 2. Senha do banco tem que estar no Keychain (só checa se existe; não lê a senha)
security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$REF" >/dev/null 2>&1 \
  || die "a senha do banco não está no Keychain. Rode: supabase link --project-ref $EXPECTED_REF (digite a senha; não deixe em branco)."

# 3. Credencial só pelo Keychain: ignora variáveis que a CLI usaria no lugar
unset SUPABASE_DB_PASSWORD PGPASSWORD SUPABASE_DB_URL DATABASE_URL

docker info >/dev/null 2>&1 || die "o Docker não está rodando (a CLI precisa dele para o pg_dump)."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo ">> $(supabase --version 2>/dev/null | head -1) | projeto $REF"

echo ">> 1/3 Schema do app (public e demais schemas não gerenciados)"
supabase db dump --linked -f "$TMP/public.sql"

echo ">> 2/3 Schemas auth e storage (só para extrair triggers e policies)"
supabase db dump --linked -s auth,storage -f "$TMP/auth_storage.sql"

echo ">> 3/3 Linhas de storage.buckets (sem arquivos)"
supabase db dump --linked --data-only -s storage \
  -x storage.objects,storage.prefixes,storage.s3_multipart_uploads,storage.s3_multipart_uploads_parts \
  -f "$TMP/storage_data.sql"

bash "$ROOT/scripts/dump-schema-assemble.sh" "$TMP/public.sql" "$TMP/auth_storage.sql" "$TMP/storage_data.sql" "$OUT"

echo ">> Baseline gerada: ${OUT#"$ROOT"/}"
echo ">> Revise com: git diff --stat -- supabase/migrations/"
