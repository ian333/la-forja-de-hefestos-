#!/bin/bash
# video-capsula.sh — CÁPSULA REPRODUCIBLE de un video de la serie de enlaces.
#
# Lección aprendida a la mala: el O₂ viral (33K vistas) salió de un estado del
# código que nunca se congeló y JAMÁS se pudo recrear. Desde hoy cada master
# lleva su cápsula: código de la escena + scripts + simulación precomputada
# (.bin ab initio) + guion + timing + audio final + receta exacta de render.
# La cápsula se sube a la biblioteca junto al video (Comando → botón ⚙ código).
#
# Uso: bash scripts/video-capsula.sh <video-id> <mol> <narVer>
#  ej: bash scripts/video-capsula.sh mol-f2-paradoja f2 f2v2
set -euo pipefail
ID=$1; MOL=$2; NAR=$3
F="$(cd "$(dirname "$0")/.." && pwd)"
OUTDIR=$F/dist-video/_capsulas
STAGE=$OUTDIR/$ID
rm -rf "$STAGE"; mkdir -p "$STAGE"/{src/cinematic,src/lib/chem/quantum,scripts/guiones,narracion,precomputed}

# ── código de la escena (todo lo que carga cinematic-molecule.html) ──
cp "$F"/cinematic-molecule.html "$STAGE"/
cp "$F"/src/cinematic/cinematic-molecule-main.tsx "$F"/src/cinematic/CinematicMolecule.tsx \
   "$F"/src/cinematic/CinematicAtom.tsx "$F"/src/cinematic/CinematicCamera.tsx \
   "$F"/src/cinematic/CinematicPostFX.tsx "$F"/src/cinematic/catalog-data.ts "$STAGE"/src/cinematic/ 2>/dev/null || true
cp "$F"/src/lib/chem/quantum/*.ts "$STAGE"/src/lib/chem/quantum/ 2>/dev/null || true

# ── pipeline completo (física → voz → música → render → mux) ──
for s in o2-clip.cjs precompute-bond-abinitio.py precompute-pi-split.py precompute-atom-cloud.py \
         precompute-molecule.ts narracion-gen.py assemble-narracion.py karaoke-ass.py \
         musica-viaje.py musica-remap.py; do
  cp "$F"/scripts/$s "$STAGE"/scripts/ 2>/dev/null || true
done
cp "$F"/scripts/guiones/$NAR.txt "$STAGE"/scripts/guiones/

# ── narración/música/subtítulos con timing EXACTO + audio final del mux ──
for a in segs.json musica-fit.json $NAR-narracion.mp3 audio-final.wav $NAR-phrase-4k.ass $NAR-phrase-16x9.ass; do
  cp "$F"/dist-video/$NAR-narracion/$a "$STAGE"/narracion/ 2>/dev/null || true
done

# ── LA SIMULACIÓN (PySCF precomputado — el dato físico real del video) ──
for b in mol-$MOL.bin $MOL-abinitio.bin $MOL-atomcloud.bin $MOL-pisplit.bin $MOL-efield.bin; do
  cp "$F"/public/precomputed/$b "$STAGE"/precomputed/ 2>/dev/null || true
done

GITHASH=$(cd "$F" && git rev-parse --short HEAD 2>/dev/null || echo desconocido)
DIRTY=$(cd "$F" && git status --porcelain 2>/dev/null | wc -l)
cat > "$STAGE"/MANIFIESTO.md <<EOF
# Cápsula reproducible — $ID
Generada: $(date '+%Y-%m-%d %H:%M') · git $GITHASH (${DIRTY} archivos sin commit en el árbol al capturar)
Molécula: $MOL · narración: $NAR

## Por qué existe
El O₂ original (33K vistas) nunca se pudo recrear: su código no se congeló.
Esta cápsula contiene TODO lo que produjo este video, tal cual estaba.

## Cómo reproducir (en iangpu, GPU real)
1. Colocar src/, cinematic-molecule.html y scripts/ sobre un checkout de la-forja
   (o usar tal cual: la escena es autocontenida con estos archivos).
2. Colocar precomputed/*.bin en public/precomputed/ (la física YA está resuelta;
   para regenerarla: python3 scripts/precompute-bond-abinitio.py $MOL, etc).
3. Vite dev: npx vite --port 5010
4. Render 4K (por aspecto):
   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \\
   MOL=$MOL W=1080 H=1920 DPR=2 FPS=30 T0=0 T1=70 BATCH=60 RESUME=1 \\
   FRAMES_DIR=/dev/shm/${MOL}cap BASE_URL=http://localhost:5010 \\
   OUT=dist-video/$MOL-916-base.mp4 node scripts/o2-clip.cjs
   (16:9: W=1920 H=1080)
5. Mux con narracion/audio-final.wav + narracion/$NAR-phrase-4k.ass (9:16, 40M) o
   -16x9.ass (16:9, 50M): hevc_nvenc main10 p010le, fades in 0.4 / out 68.7, -t 70.
6. La voz NO se regenera (XTTS no es determinista): narracion/ trae los audios y
   el timing exacto (segs.json). Guion en scripts/guiones/$NAR.txt.
EOF

mkdir -p "$OUTDIR"
tar -czf "$OUTDIR/$ID-capsula.tar.gz" -C "$STAGE" .
rm -rf "$STAGE"
ls -la "$OUTDIR/$ID-capsula.tar.gz"
