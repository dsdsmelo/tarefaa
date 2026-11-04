#!/usr/bin/env bash
# =========================================================
# DESATIVADO. O deploy da VPS é feito só por /opt/scripts/deploy-tarefaa.sh
# (fonte versionada: deploy/deploy-tarefaa.sh). Ver docs/DEPLOYMENT.md, seção 5.3.
#
# Este script antigo apagava o package-lock.json e rodava `npm install`, o que
# deixava o lockfile da VPS diferente do commitado e travava o `git pull` seguinte.
# =========================================================
echo "ERRO: deploy.sh está desativado." >&2
echo "Use: /opt/scripts/deploy-tarefaa.sh" >&2
echo "(instalação: sudo install -m 755 /opt/repos/tarefaa/deploy/deploy-tarefaa.sh /opt/scripts/deploy-tarefaa.sh)" >&2
exit 1
