#!/usr/bin/env bash
# =========================================================
# Deploy do Tarefaa no VPS
# =========================================================
# Uso (na raiz do repo no VPS):  bash deploy.sh
#
# Trata automaticamente:
#  - "drift" local de package.json/package-lock.json que trava o git pull
#    (o npm reescreve o lock; descartamos e usamos a versão do repo)
#  - binário nativo do @swc por plataforma: faz install limpo no Linux
#    (evita o erro "Failed to load native binding" ao usar lock do macOS)
# =========================================================
set -euo pipefail

REPO_DIR="/opt/repos/tarefaa"
WEB_DIR="/var/www/tarefaa"
SERVICE="tarefaa_tarefaa"

cd "$REPO_DIR"

echo "==> Descartando alterações locais em package.json / package-lock.json (se houver)"
git checkout -- package.json package-lock.json 2>/dev/null || true

echo "==> git pull origin main"
git pull origin main

echo "==> Instalação limpa de dependências (resolve binários nativos do Linux)"
rm -rf node_modules package-lock.json
npm install

echo "==> Build de produção"
npm run build

echo "==> Publicando dist em $WEB_DIR/dist (limpo, sem acumular bundles antigos)"
# valida que a build gerou saída
if [ ! -f dist/index.html ]; then
  echo "ERRO: dist/index.html não encontrado — a build falhou. Abortando." >&2
  exit 1
fi
mkdir -p "$WEB_DIR/dist"
# mantém o diretório (montado no container), só troca o conteúdo — evita
# aninhar dist/dist e remove bundles hasheados antigos
rm -rf "$WEB_DIR"/dist/*
cp -r dist/. "$WEB_DIR"/dist/

echo "==> Reiniciando serviço $SERVICE"
docker service update --force "$SERVICE"

echo "==> Deploy concluído com sucesso ✅"
