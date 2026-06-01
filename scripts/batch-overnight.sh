#!/bin/bash
# batch-overnight.sh — Renderiza TODO lo construido en 4K nativo, calidad máxima,
# toda la noche. Reanudable (salta lo ya hecho). Lanzar DETACHED:
#   ssh iangpu 'setsid nohup bash /home/ian/Orkesta/la-forja/scripts/batch-overnight.sh >/tmp/overnight.log 2>&1 </dev/null &'
cd /home/ian/Orkesta/la-forja || exit 1
export DISPLAY=:0 GALLIUM_DRIVER=d3d12 GPU=1 VENC=h264_nvenc DPR=2
export BASE_URL=http://localhost:5012          # vite con la escena más reciente
export CQ=16 VBITRATE=28M JPGQ=97              # 4K nativo, calidad casi máxima

echo "═══ OVERNIGHT START $(date) ═══"
echo "── 1/3 CADENAS (14) ──"
node scripts/batch-chains.cjs
echo "── 2/3 CATÁLOGO (21) ──"
node scripts/batch-catalog.cjs
echo "── 3/3 ADN (3) ──"
node scripts/batch-dna.cjs
echo "═══ OVERNIGHT DONE $(date) ═══"
echo "Totales en dist-video:"
for d in chains catalog dna; do echo -n "  $d: "; ls dist-video/$d/*.mp4 2>/dev/null | wc -l; done
