#!/usr/bin/env bash
# ============================================================================
# mold-live.sh — CONEXIÓN DIRECTA a La Forja en producción (sesión compartida).
# Escribe el estado vivo del molde; el panel de la Máquina lo sondea cada 1.5 s
# y se actualiza SOLO en la pantalla del cliente (cotización + arquitectura, y si
# generate=true abre los planos). Así el operador remoto (Claude) y el cliente
# manejan el MISMO molde en realtime.
#
# Uso:
#   ./mold-live.sh '<preset>' [generate]      # preset: lego|sony|charola|tapa
#   ./mold-live.sh --spec '<json MachineSpec>' [generate]
# ============================================================================
set -euo pipefail
ATLAS_IP="100.97.118.117"; ATLAS_USER="ian"; DIST="/mnt/hdd/forja-dist/mold-live.json"

lego='{"name":"Ladrillo LEGO 2x4","Lmm":32,"Wmm":16,"Hmm":11,"surfaceMm2":3300,"volumeMm3":2500,"wallMm":1.5,"annualVolume":20000000,"plastic":"ABS","finish":"SPI A-3","feedPref":"hot-runner"}'
sony='{"name":"Carcasa de control Sony","Lmm":150,"Wmm":45,"Hmm":22,"surfaceMm2":43000,"volumeMm3":43000,"wallMm":2,"annualVolume":2000000,"plastic":"ABS","finish":"SPI B-3","feedPref":"hot-runner"}'
charola='{"name":"Charola contenedora","Lmm":90,"Wmm":90,"Hmm":35,"surfaceMm2":49000,"volumeMm3":49000,"wallMm":2,"annualVolume":200000,"plastic":"PP","finish":"SPI B-3"}'
tapa='{"name":"Tapa rosca","Lmm":40,"Wmm":40,"Hmm":15,"surfaceMm2":6500,"volumeMm3":2800,"wallMm":1.2,"annualVolume":8000000,"plastic":"PP","finish":"SPI A-3"}'

REV=$(date +%s)
if [ "${1:-}" = "clear" ]; then
  printf '{"rev":%s,"by":"Claude (remoto)","clear":true}' "$REV" | ssh -o ConnectTimeout=10 "${ATLAS_USER}@${ATLAS_IP}" "cat > $DIST"
  echo "✓ live rev=$REV · CLEAR → la escena vuelve a la pieza normal"; exit 0
fi
if [ "${1:-}" = "--spec" ]; then SPEC="$2"; GEN="${3:-false}";
else
  case "${1:-lego}" in lego) SPEC="$lego";; sony) SPEC="$sony";; charola) SPEC="$charola";; tapa) SPEC="$tapa";; *) echo "preset desconocido: ${1:-}"; exit 1;; esac
  GEN="${2:-false}"
fi
printf '{"rev":%s,"by":"Claude (remoto)","generate":%s,"spec":%s}' "$REV" "$GEN" "$SPEC" \
  | ssh -o ConnectTimeout=10 "${ATLAS_USER}@${ATLAS_IP}" "cat > $DIST"
echo "✓ live rev=$REV → La Forja arma el molde con primitivas y aparece en tu escena 3D (~4 s)"
