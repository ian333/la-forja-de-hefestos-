#!/usr/bin/env bash
# forja-deploy.sh — DEPLOY AUTOMATIZADO Y COORDINADO de La Forja.
# Nace de deploy_gotchas ("nunca dos deploys encimados") + la coordinación por Redis que
# pidió ian. Un candado DISTRIBUIDO en Redis (no un lockfile local) impide que dos máquinas
# o dos sesiones desplieguen a la vez. El estado de despliegue lo lleva TEMIS (el tablero).
#
#   bash scripts/forja-deploy.sh                 # deploy manual (acción explícita de ian)
#   bash scripts/forja-deploy.sh --if-pending    # SOLO si hay trabajo cerrado sin desplegar
#                                                #   Y el sitio está limpio (para el cron)
#   bash scripts/forja-deploy.sh --force         # ignora el candado (last resort)
#
# El candado: SET forja:deploy:lock <quien> NX EX 2400 en Redis (vía ATLAS, que tiene la ruta
# y redis-cli; el password NUNCA se guarda en el repo — se lee del env del contenedor al vuelo).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
IF_PENDING=false; FORCE=false; LOCKCHECK=false; PASS=()
for a in "$@"; do case "$a" in
  --if-pending) IF_PENDING=true;; --force) FORCE=true;; --lock-check) LOCKCHECK=true;; *) PASS+=("$a");; esac; done
# El candado usa Tailscale (estable); la LAN 192.168.100.4 se cae intermitente y para ops
# chiquitas de Redis la latencia no importa. El rsync PESADO lo maneja deploy-atlas-build.sh.
A=100.97.118.117
RE=(ssh -o BatchMode=yes -o ConnectTimeout=10 ian@$A)
QUIEN="$(hostname):$$:$(date -u +%FT%TZ)"
LOCK=forja:deploy:lock


# redis-cli en ATLAS. El secreto vive en el server (env del contenedor), NUNCA en el repo.
# REDISCLI_AUTH + -h/-p (redis-cli -u mal-parsea passwords con caracteres especiales).
# Los args van por variable ARGS (heredoc CON comillas = cero expansion local, cero fugas).
redis() {
  # args como POSICIONALES a bash -s (ARGS="$*" se rompía: ssh reconcatena y el remoto
  # partía en el primer espacio → intentaba correr la KEY como comando). Ningún arg del
  # candado lleva espacios internos, así que ssh (que junta con espacios) los recompone igual.
  "${RE[@]}" bash -s "$@" <<'REMOTE'
U=$(sudo docker exec gaia_api_atlas printenv REDIS_URL 2>/dev/null)
HP=${U#*@}; H=${HP%%:*}; r=${HP#*:}; P=${r%%/*}; PW=${U#*://:}; PW=${PW%@*}
export REDISCLI_AUTH="$PW"
redis-cli -h "$H" -p "$P" "$@"
REMOTE
}

# ── AUTO-TEST del candado (no despliega): bash scripts/forja-deploy.sh --lock-check ──
if $LOCKCHECK; then
  echo "PING: $(redis PING | tr -d '\r')"
  redis DEL "$LOCK" >/dev/null
  a=$(redis SET "$LOCK" chk-A NX EX 20 | tr -d '\r')
  b=$(redis SET "$LOCK" chk-B NX EX 20 | tr -d '\r')
  g=$(redis GET "$LOCK" | tr -d '\r'); redis DEL "$LOCK" >/dev/null
  c=$(redis SET "$LOCK" chk-C NX EX 20 | tr -d '\r'); redis DEL "$LOCK" >/dev/null
  echo "candado → toma:[$a] bloquea-2a:[$b] dueño:[$g] re-toma:[$c]"
  [ "$a" = "OK" ] && [ -z "$b" ] && [ "$g" = "chk-A" ] && [ "$c" = "OK" ] && { echo "✓ candado SANO"; exit 0; } || { echo "✗ candado ROTO"; exit 1; }
fi

# ── candado ──
if ! $FORCE; then
  OK=$(redis SET "$LOCK" "'$QUIEN'" NX EX 2400 2>/dev/null | tr -d '\r')
  if [ "$OK" != "OK" ]; then
    echo "✗ DEPLOY BLOQUEADO — hay otro en curso: $(redis GET "$LOCK" 2>/dev/null)"
    echo "  (si estás seguro de que murió: bash scripts/forja-deploy.sh --force)"; exit 3
  fi
  trap 'redis DEL "'"$LOCK"'" >/dev/null 2>&1' EXIT
  echo "🔒 candado tomado: $QUIEN"
fi

# ── modo cron: SOLO si hay pendiente y el sitio está limpio ──
if $IF_PENDING; then
  node scripts/temis-deploy-stamp.cjs >/dev/null 2>&1 || true   # refresca estado vs lo desplegado
  SD=$(python3 -c "import json;print(json.load(open('public/temis.json'))['conteo']['sinDesplegar'])" 2>/dev/null || echo 0)
  if [ "$SD" = "0" ]; then echo "· sin trabajo pendiente de desplegar — nada que hacer."; exit 0; fi
  # NO empujar WIP: si hay cambios SIN commitear en archivos del SITIO, abortar (protege prod)
  if ! git diff --quiet -- src public ':(glob)*.html' vite.config.ts 2>/dev/null; then
    echo "✗ hay cambios del SITIO sin commitear — el cron NO despliega trabajo a medias."; exit 4
  fi
  echo "▶ $SD tarjeta(s) sin desplegar y árbol del sitio limpio → desplegando"
fi

# ── deploy real (estampa Temis solo, dentro) ──
echo "▶ deploy-atlas-build.sh ${PASS[*]:-}"
bash ./deploy-atlas-build.sh "${PASS[@]:-}"; rc=$?
if [ $rc -eq 0 ]; then
  redis SET forja:deploy:last "$(git rev-parse --short HEAD)@$(date -u +%FT%H:%MZ)" >/dev/null 2>&1 || true
  echo "✓ deploy OK"
else echo "✗ deploy falló (rc=$rc)"; fi
exit $rc
