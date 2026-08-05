#!/usr/bin/env bash
# publicar-sitio.sh — sube dist/ a ATLAS en el ORDEN correcto.
#
# EL ORDEN NO ES DETALLE (2026-08-05, lo rompí en vivo): un `rsync -a dist/` copia en el
# orden que se le da la gana, y el index.html nuevo aterrizó ANTES que /assets. Durante
# varios minutos producción sirvió un HTML que referenciaba un CSS con 404 — la app montaba
# SIN ESTILOS para gente real que venía de Instagram.
#
# La regla: primero lo que el HTML VA A PEDIR, al final el HTML que lo pide. Así, en todo
# momento, el HTML que se sirve apunta a archivos que YA existen. Como los assets llevan el
# hash del contenido en el nombre, los viejos siguen ahí y las pestañas abiertas no se rompen.
#
# NUNCA --delete: /mnt/hdd/forja-dist también guarda la biblioteca de videos, que no vive en dist/.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
DESTINO="${DESTINO:-ian@192.168.100.4}"           # LAN; si no responde, Tailscale
RE="ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"
$RE -o BatchMode=yes "$DESTINO" true 2>/dev/null || DESTINO="ian@100.97.118.117"
RAIZ=/mnt/hdd/forja-dist

[ -d dist ] || { echo "✗ no hay dist/ — corre 'npx vite build' primero"; exit 1; }
[ -f dist/index.html ] || { echo "✗ dist/ sin index.html"; exit 1; }

echo "▶ publicando a $DESTINO:$RAIZ"
echo "── 1/2 assets y todo lo demás (el HTML NO) ──"
# ⚠ EXCLUIR comando/*.json (2026-08-05, lo pisé): esos archivos son DATOS que genera
# comando-scan.cjs desde la laptop —inventario y telemetría en vivo— pero viven en public/,
# así que el build los copia a dist/. Como el build corre en iangpu, se hornea la copia VIEJA
# de iangpu y al publicar aplasta la buena: el tablero volvió a decir "telemetría sin
# conectar" media hora después de haberla arreglado. Un deploy de código no debe tocar datos.
rsync -a --info=stats2 -e "$RE" --exclude='*.html' --exclude='comando/*.json' dist/ "$DESTINO:$RAIZ/" | tail -3 || exit 1

echo "── 2/2 ahora sí el HTML ──"
rsync -a -e "$RE" --include='*.html' --include='*/' --exclude='*' dist/ "$DESTINO:$RAIZ/" || exit 1

echo "── verificación: lo que el HTML pide, ¿existe? ──"
faltan=0
for ref in $(grep -oE '/assets/[A-Za-z0-9_.-]+\.(js|css)' dist/index.html | sort -u); do
  code=$($RE "$DESTINO" "test -f $RAIZ$ref && echo ok || echo NO")
  [ "$code" = "ok" ] || { echo "   ✗ FALTA $ref"; faltan=$((faltan+1)); }
done
[ "$faltan" -eq 0 ] && echo "   ✓ todas las referencias del index existen en el servidor" || exit 1
echo "SITIO_PUBLICADO_OK"
