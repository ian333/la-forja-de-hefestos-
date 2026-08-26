#!/usr/bin/env bash
# forja-release.sh — RELEASE PROGRAMADA de La Forja (la corre el cron; también sirve a mano).
#   · Solo despliega lo COMMITEADO en main (worktree limpio en /tmp/forja-release) — el árbol
#     de trabajo compartido, con WIP de varias sesiones, NUNCA se despliega solo.
#   · Solo si TEMIS reporta trabajo cerrado sin desplegar (forja-deploy.sh --if-pending).
#   · Con el candado distribuido en Redis (nunca dos deploys a la vez).
#   · Log en dist-video/_release.log (ext4, sobrevive).
# Cron sugerido (laptop, cada hora en punto):  0 * * * * bash /home/ian/Orkesta/la-forja/scripts/forja-release.sh
set -uo pipefail
REPO=/home/ian/Orkesta/la-forja; WT=/tmp/forja-release; LOG=$REPO/dist-video/_release.log
mkdir -p "$REPO/dist-video"; exec >>"$LOG" 2>&1
echo "══ $(date -u +%FT%TZ) release programada"
cd "$REPO" || exit 1
HEAD=$(git rev-parse --short main 2>/dev/null) || { echo "✗ sin rama main"; exit 1; }
# worktree limpio en main (crear o actualizar)
if [ ! -d "$WT/.git" ] && [ ! -f "$WT/.git" ]; then git worktree add -q --detach "$WT" main || { echo "✗ worktree"; exit 1; }; fi
# reset --hard SIEMPRE: el propio deploy (temis-deploy-stamp) reescribe public/temis*.json en el
# worktree; sin esto la siguiente release se ve a sí misma como "sucia".
git -C "$WT" checkout -q --detach main 2>/dev/null; git -C "$WT" reset -q --hard main
# "sucio" = archivos RASTREADOS modificados (WIP). Los espejados fuera de git (mp4) no cuentan.
[ -z "$(git -C "$WT" status --porcelain --untracked-files=no)" ] || { echo "✗ el worktree de release está SUCIO — no despliego"; exit 2; }
# ENTREGABLES FUERA DE GIT (política: *.mp4 nunca a git — reels del atrio, etc.). El deploy
# publica `dist/` con --delete: si el worktree limpio no los trae, la release los BORRARÍA de
# prod. Se espejan desde el árbol principal SOLO los ignorados bajo public/.
git -C "$REPO" ls-files --others --ignored --exclude-standard -- public/ | while read -r f; do
  mkdir -p "$WT/$(dirname "$f")"; cp -f "$REPO/$f" "$WT/$f"
done
echo "· entregables fuera de git espejados: $(git -C "$REPO" ls-files --others --ignored --exclude-standard -- public/ | wc -l)"
echo "· main=$HEAD · worktree limpio"
# node_modules del worktree: el deploy hace build REMOTO en ATLAS, no hace falta local.
# FORZAR=1 = release manual (Ian lo pide): despliega main aunque Temis no reporte pendientes.
if [ "${FORZAR:-0}" = "1" ]; then bash "$WT/scripts/forja-deploy.sh" --quiet; rc=$?
else bash "$WT/scripts/forja-deploy.sh" --if-pending --quiet; rc=$?; fi
echo "· rc=$rc"; exit $rc
