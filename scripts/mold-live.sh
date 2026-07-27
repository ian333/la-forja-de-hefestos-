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

# EJEMPLOS DEL LIBRO (Kazmer) — se empujan como assemblySpec (molde ya resuelto)
cup='{"name":"Molde vaso (cup)","code":"MLD-CUP","widthMm":246,"plates":{"bottomClamp":36,"ejectorHousing":66,"support":46,"B":66,"A":66,"topClamp":36},"cavity":{"widthMm":60,"depthMm":58,"shape":"round"},"cooling":{"diaMm":6.35,"plug":"JP-251","insetMm":40},"ejectors":{"type":"pin","diaMm":4,"count":8},"core":{"diaMm":60,"material":"AISI P20"},"cavityMetal":"AISI P20","baseSteel":"1.1730 (C45)","clampTons":41,"nCav":1}'
lid='{"name":"Molde tapa (lid)","code":"MLD-LID","widthMm":246,"plates":{"bottomClamp":36,"ejectorHousing":66,"support":46,"B":56,"A":46,"topClamp":36},"cavity":{"widthMm":80,"depthMm":12,"shape":"round"},"cooling":{"diaMm":6.35,"plug":"JP-251","insetMm":42},"ejectors":{"type":"stripper","diaMm":6,"count":4},"core":{"diaMm":80,"material":"AISI P20"},"cavityMetal":"AISI P20","baseSteel":"1.1730 (C45)","clampTons":41,"nCav":1}'
jabonera='{"name":"Molde jabonera (box)","code":"MLD-BOX","widthMm":296,"plates":{"bottomClamp":36,"ejectorHousing":66,"support":56,"B":76,"A":56,"topClamp":36},"cavity":{"widthMm":120,"depthMm":30,"shape":"rect","lenMm":80},"cooling":{"diaMm":7.94,"plug":"JP-352","insetMm":50},"ejectors":{"type":"pin","diaMm":5,"count":8},"core":{"widthMm":116,"material":"AISI P20"},"cavityMetal":"AISI P20","baseSteel":"1.1730 (C45)","clampTons":61,"nCav":1}'
# BEZEL — cotas LITERALES del libro (Kazmer Figs 3.5/5.12/11.7, ver scripts/kazmer-bezel-mold.cjs):
#   pieza 240×160, pared T=1.5, altura pared HW=10, marco FR=20 · cooling ⌀6.35 (Eq 9.22 H=4D, Eq 9.24 W∈[H,2H])
#   expulsión: 20 pines ⌀mín 2.23 (pandeo) → ⌀3 estándar · 1M piezas → COLADA CALIENTE (break-even)
bezel='{"name":"Molde bezel laptop","code":"MLD-BEZEL","widthMm":381,"plates":{"bottomClamp":36,"ejectorHousing":66,"support":120,"B":76,"A":56,"topClamp":36},"cavity":{"widthMm":240,"depthMm":10,"shape":"rect","lenMm":160,"wallMm":1.5,"frameMm":20,"ribs":7},"cooling":{"diaMm":6.35,"plug":"JP-251","insetMm":70},"ejectors":{"type":"pin","diaMm":3,"count":20},"core":{"widthMm":240,"material":"AISI P20"},"cavityMetal":"AISI P20","baseSteel":"1.1730 (C45)","clampTons":200,"feed":"hot-runner","sideAction":{"aProjMm2":220,"pMeltMPa":200,"strokeMm":12},"nCav":1}'

REV=$(date +%s)
case "${1:-}" in
  cup|lid|jabonera|bezel)
    eval "ASM=\$$1"
    printf '{"rev":%s,"by":"Claude (remoto)","assemblySpec":%s}' "$REV" "$ASM" | ssh -o ConnectTimeout=10 "${ATLAS_USER}@${ATLAS_IP}" "cat > $DIST"
    echo "✓ live rev=$REV · LIBRO $1 → La Forja arma el molde con primitivas (~4 s)"; exit 0 ;;
esac
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
