#!/usr/bin/env bash
# =========================================================
# Deploy do front do Tarefaa na VPS.
#
# Fonte versionada: deploy/deploy-tarefaa.sh (no repo).
# Instalado (manual, a cada mudança neste arquivo) em /opt/scripts:
#   sudo install -m 755 /opt/repos/tarefaa/deploy/deploy-tarefaa.sh /opt/scripts/deploy-tarefaa.sh
# Uso (como o usuário dono de /var/www/tarefaa, NÃO como root):
#   /opt/scripts/deploy-tarefaa.sh
#
# Garantias:
#   - nada é descartado em silêncio: se o repo tiver alteração local, para e mostra;
#   - dependências só com `npm ci` (instala exatamente o lockfile, não o altera);
#   - ao final do build, confere que nenhum arquivo versionado mudou;
#   - publicação atômica: o build vai para dist.new; a troca é feita com mv
#     (dist -> dist.old, dist.new -> dist); dist.old só é apagado depois que o
#     serviço reiniciou. Qualquer falha antes da troca deixa o dist no ar intacto.
# Ver docs/DEPLOYMENT.md, seção 5.3.
# =========================================================
set -euo pipefail

REPO_DIR="/opt/repos/tarefaa"
WEB_ROOT="/var/www/tarefaa"
LIVE="$WEB_ROOT/dist"
NEW="$WEB_ROOT/dist.new"
OLD="$WEB_ROOT/dist.old"
SERVICE="tarefaa_tarefaa"
BRANCH="main"
LOCK_FILE="/tmp/deploy-tarefaa.lock"

die() { echo "ERRO: $*" >&2; exit 1; }

echo "=== Deploy Tarefaa ==="

# ---------- Pré-checagens ----------
[ "$(id -u)" -ne 0 ] || die "não rode como root (os arquivos publicados ficariam do root). Rode como o dono de $WEB_ROOT."
[ -w "$WEB_ROOT" ] || die "sem permissão de escrita em $WEB_ROOT (usuário: $(id -un))."
[ ! -e "$OLD" ] || die "$OLD existe: um deploy anterior parou depois da troca. Confira o site e remova com: rm -rf $OLD"

# Um deploy por vez
exec 9>"$LOCK_FILE"
flock -n 9 || die "outro deploy está em andamento."

cd "$REPO_DIR"
echo ">> node $(node -v) / npm $(npm -v)"

# ---------- 1. Código ----------
current_branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$current_branch" = "$BRANCH" ] || die "o repo está na branch '$current_branch', esperado '$BRANCH'."

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "ERRO: o repo tem alterações locais em arquivos versionados:" >&2
  git status --short --untracked-files=no >&2
  echo "Nada foi descartado. Confira com 'git diff' e resolva antes de rodar de novo." >&2
  exit 1
fi

echo ">> Atualizando código (fast-forward)..."
git pull --ff-only origin "$BRANCH"

# ---------- 2. Dependências ----------
echo ">> Instalando dependências (npm ci)..."
npm ci --no-audit --no-fund

# ---------- 3. Build ----------
echo ">> Gerando build..."
npm run build
[ -f dist/index.html ] || die "o build não gerou dist/index.html."

# ---------- 4. Nenhum arquivo versionado pode ter mudado ----------
if ! git diff --quiet; then
  echo "ERRO: o deploy alterou arquivos versionados (nada foi publicado):" >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

# ---------- 5. Publicação atômica ----------
echo ">> Preparando $NEW..."
rm -rf "$NEW"
cp -r dist "$NEW"
[ -f "$NEW/index.html" ] || die "cópia incompleta em $NEW (o site no ar não mudou)."

echo ">> Trocando versões..."
if [ -e "$LIVE" ]; then
  mv "$LIVE" "$OLD"
fi
mv "$NEW" "$LIVE"

echo ">> Reiniciando serviço..."
if ! docker service update --force "$SERVICE"; then
  echo "ERRO: falha ao reiniciar $SERVICE. A versão anterior está em $OLD." >&2
  echo "Para voltar: mv $LIVE $WEB_ROOT/dist.failed && mv $OLD $LIVE && docker service update --force $SERVICE" >&2
  exit 1
fi

rm -rf "$OLD"

echo "=== Tarefaa atualizado: $(git log -1 --format='%h %s') ==="
