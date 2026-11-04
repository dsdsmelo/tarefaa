#!/usr/bin/env bash
# =========================================================
# Monta a baseline a partir dos três dumps gerados por scripts/dump-schema.sh.
# Só processa texto: não conecta em banco nenhum.
#
# Uso: dump-schema-assemble.sh <public.sql> <auth_storage.sql> <storage_data.sql> <saida.sql>
#
# Do dump de auth/storage aproveita só:
#   - triggers em auth.users que chamam funções public.* (ex.: criar perfil);
#   - policies de storage.objects (com DROP POLICY IF EXISTS antes).
# Do dump de dados do storage aproveita só o INSERT de storage.buckets
# (com ON CONFLICT DO NOTHING). Arquivos (storage.objects) nunca entram.
# =========================================================
set -euo pipefail

[ $# -eq 4 ] || { echo "uso: $0 <public.sql> <auth_storage.sql> <storage_data.sql> <saida.sql>" >&2; exit 2; }
PUBLIC_SQL="$1"; AUTH_STORAGE_SQL="$2"; STORAGE_DATA_SQL="$3"; OUT="$4"

die() { echo "ERRO: $*" >&2; exit 1; }

for f in "$PUBLIC_SQL" "$AUTH_STORAGE_SQL" "$STORAGE_DATA_SQL"; do
  [ -s "$f" ] || die "dump vazio ou ausente: $f"
done

# O dump do schema do app tem que ter as tabelas principais
for t in projects tasks profiles; do
  grep -q "^CREATE TABLE IF NOT EXISTS \"public\".\"$t\"" "$PUBLIC_SQL" \
    || die "o dump do schema não tem a tabela public.$t (projeto errado ou dump incompleto)."
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Triggers de auth.users que chamam funções do app (pg_dump: uma linha por trigger)
awk '
  /^CREATE (OR REPLACE )?TRIGGER / && / ON "auth"\."users" / && /EXECUTE (FUNCTION|PROCEDURE) "public"\./ {
    if ($0 !~ /;$/) { bad = 1 }
    print
  }
  END { if (bad) exit 3 }
' "$AUTH_STORAGE_SQL" > "$WORK/auth_triggers.sql" || die "trigger de auth.users em formato inesperado."

# Policies de storage.objects (podem ocupar mais de uma linha; terminam em ;)
awk '
  inside {
    print
    if ($0 ~ /;$/) inside = 0
    next
  }
  /^CREATE POLICY "/ && index($0, "\" ON \"storage\".\"objects\" ") > 0 {
    name = substr($0, 15, index($0, "\" ON \"storage\".\"objects\" ") - 14)
    print "DROP POLICY IF EXISTS " name " ON \"storage\".\"objects\";"
    print
    if ($0 !~ /;$/) inside = 1
  }
  END { if (inside) exit 3 }
' "$AUTH_STORAGE_SQL" > "$WORK/storage_policies.sql" || die "policy de storage.objects sem fim (;)."

# Buckets: um INSERT com várias linhas (--rows-per-insert); a última termina em );
awk '
  inside {
    if ($0 ~ /\);$/) { sub(/;$/, " ON CONFLICT (\"id\") DO NOTHING;"); print; inside = 0; done = 1 }
    else print
    next
  }
  /^INSERT INTO "storage"\."buckets" / {
    print
    inside = 1
  }
  END { if (inside) exit 3 }
' "$STORAGE_DATA_SQL" > "$WORK/buckets.sql" || die "INSERT de storage.buckets sem fim."

n_triggers=$(grep -c '' "$WORK/auth_triggers.sql" || true)
n_policies=$(grep -c '^DROP POLICY' "$WORK/storage_policies.sql" || true)
n_buckets=$(grep -cE "^[[:space:]]+\(" "$WORK/buckets.sql" || true)

{
  echo "-- ========================================================="
  echo "-- Baseline do schema de produção, gerada em $(date -u +%Y-%m-%dT%H:%MZ)"
  echo "-- por scripts/dump-schema.sh (supabase db dump, somente leitura)."
  echo "-- Para bancos VAZIOS. Em produção ela já está aplicada: NÃO execute lá."
  echo "-- ========================================================="
  echo
  cat "$PUBLIC_SQL"
  echo
  echo "-- ---------- Triggers em auth.users que chamam funções do app ----------"
  cat "$WORK/auth_triggers.sql"
  echo
  echo "-- ---------- Buckets do Storage ----------"
  cat "$WORK/buckets.sql"
  echo
  echo "-- ---------- Policies de storage.objects ----------"
  cat "$WORK/storage_policies.sql"
} > "$WORK/out.sql"

# Nenhuma credencial pode ir para o arquivo
if grep -qiE 'postgres(ql)?://|password=|PGPASSWORD' "$WORK/out.sql"; then
  die "o arquivo montado contém algo parecido com credencial; nada foi gravado."
fi

mv "$WORK/out.sql" "$OUT"
echo ">> Triggers de auth.users: $n_triggers | policies de storage.objects: $n_policies | buckets: $n_buckets"
[ "$n_triggers" -gt 0 ] || echo "AVISO: nenhum trigger de auth.users chamando public.* (esperado: o que cria o perfil)." >&2
