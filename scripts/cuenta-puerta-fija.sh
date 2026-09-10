#!/usr/bin/env bash
# cuenta-puerta-fija.sh — LA API DE COBRO ENTRA POR LA MISMA PUERTA QUE EL SITIO (URL fija).
#
# Por qué (2026-09-10): el túnel trycloudflare de junio MURIÓ (su DNS falla desde el 08-07) y
# precios.html apuntaba a él: nadie podía pagar. En vez de crear otro túnel con nombre (pide el
# panel de Cloudflare), el nginx de La Forja en ATLAS hace proxy de /api/cuenta/ al contenedor
# gaia_university_api. Mismo origen, sin CORS, URL que no cambia:
#     https://university.gaiaprime.com.mx/api/cuenta/health
# El bloque de nginx vive versionado en deploy/nginx-forja.conf (este script lo copia tal cual).
#
# Idempotente. Se corre DESDE LA LAPTOP (entra a ATLAS por ssh). Toca producción: lo corre ian.
#     bash scripts/cuenta-puerta-fija.sh
set -euo pipefail
ATLAS=ian@100.97.118.117
REPO=/home/ian/Orkesta/la-forja
CONF_LOCAL=$REPO/deploy/nginx-forja.conf                         # versionado
CONF_ATLAS=/home/ian/Orkesta/cluster/nginx-forja/default.conf     # montado en gaia_forja_atlas
URL=https://university.gaiaprime.com.mx/api/cuenta

grep -q 'location /api/cuenta/' "$CONF_LOCAL" || { echo "✗ $CONF_LOCAL no trae el bloque /api/cuenta/"; exit 1; }

echo "1) el contenedor de la API también vive en gaia_net (la red del nginx) — EN EL COMPOSE, no a mano"
# Un `docker network connect` a mano se PIERDE cuando compose recrea el contenedor (pasó el
# 2026-09-10: la API se recreó con el .env nuevo y salió de gaia_net → 502). Va en el compose.
ssh "$ATLAS" 'cd ~/university-api && python3 - <<"EOF"
import re,io
p="docker-compose.yml"; s=open(p).read()
if "gaia_net" not in s:
    s=s.replace("    networks: [uni_net]\n    # Sin `ports:`", "    networks: [uni_net, gaia_net]   # gaia_net: la red del nginx de La Forja (proxy /api/cuenta/)\n    # Sin `ports:`",1)
    s=s.rstrip("\n")+"\n  gaia_net:\n    external: true\n"
    open(p,"w").write(s); print("   compose parchado: university-api en uni_net + gaia_net")
else: print("   compose ya traía gaia_net")
EOF
docker compose up -d 2>&1 | tail -2
docker network inspect gaia_net --format "{{range .Containers}}{{.Name}} {{end}}" | tr " " "\n" | grep -qx gaia_university_api && echo "   ✓ gaia_university_api en gaia_net"'

echo "2) nginx: bloque /api/cuenta/ (copia del repo) + prueba + recarga"
# El archivo es de root y el montaje en el contenedor es de solo lectura: se escribe con sudo
# (ian tiene sudo sin contraseña en ATLAS) y se respalda con la convención de la carpeta.
ssh "$ATLAS" "sudo cp $CONF_ATLAS $CONF_ATLAS.bak.\$(date +%Y%m%d-%H%M) && sudo tee $CONF_ATLAS > /dev/null" < "$CONF_LOCAL"
ssh "$ATLAS" 'docker exec gaia_forja_atlas nginx -t 2>&1 | tail -1 && docker exec gaia_forja_atlas nginx -s reload && echo "   ✓ nginx recargado"'

echo "3) la API sabe su URL pública (API_BASE_URL) y se recrea con el .env nuevo"
ssh "$ATLAS" "cd ~/university-api && sed -i 's#^API_BASE_URL=.*#API_BASE_URL=$URL#' .env && grep -E '^API_BASE_URL=' .env && docker compose up -d 2>&1 | tail -1"
# el nginx resuelve por variable (resolver de Docker), así que la IP nueva la toma solo; la
# recarga de arriba no se repite.

echo "4) verificación por la puerta pública (Cloudflare → túnel de La Forja → nginx → API)"
sleep 4
curl -s -m 20 "$URL/health" | grep -q '"ok":true' && echo "   ✓ $URL/health" || { echo "✗ health no responde por la puerta pública"; exit 1; }
echo "   planes: $(curl -s -m 20 "$URL/plans" | head -c 300)"
echo "5) webhook de Stripe: la firma (STRIPE_WEBHOOK_SECRET) del .env local viaja a ATLAS si difiere"
# El endpoint se registra desde la laptop con la API de Stripe (modo prueba hoy; en vivo al cambiar
# STRIPE_MODE) y Stripe solo enseña la firma al crearlo: queda en university-api/.env local (600)
# y de ahí se copia a ATLAS. Nunca se imprime.
ENV_LOCAL=/home/ian/Orkesta/university-api/.env
SEC=$(grep -E '^STRIPE_WEBHOOK_SECRET=' "$ENV_LOCAL" | cut -d= -f2-)
if [ -n "$SEC" ]; then
  REMOTO=$(ssh "$ATLAS" "grep -E '^STRIPE_WEBHOOK_SECRET=' ~/university-api/.env | cut -d= -f2-")
  if [ "$REMOTO" != "$SEC" ]; then
    printf 'STRIPE_WEBHOOK_SECRET=%s\n' "$SEC" | ssh "$ATLAS" 'cd ~/university-api && read -r L && (grep -qE "^STRIPE_WEBHOOK_SECRET=" .env && sed -i "s#^STRIPE_WEBHOOK_SECRET=.*#$L#" .env || echo "$L" >> .env) && chmod 600 .env && docker compose up -d 2>&1 | tail -1'
    echo "   ✓ firma del webhook sincronizada a ATLAS (API recreada)"
  else echo "   ✓ firma del webhook ya estaba en ATLAS"; fi
else echo "   ⚠ sin STRIPE_WEBHOOK_SECRET en $ENV_LOCAL: el webhook no valida hasta registrarlo"; fi

echo "✓ puerta fija lista. Sigue: commit + release de la-forja (precios.html y cuenta.html ya apuntan aquí)."
