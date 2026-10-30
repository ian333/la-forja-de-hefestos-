#!/usr/bin/env bash
# blender-a-cuadros.sh — convierte lo que Blender rinde BARATO en los cuadros que el montaje de video.sh espera.
# «El hielo flota» (2026-10-24): la laptop no aguanta 4K×96 muestras×545 cuadros (8-20 h por plano), así que
# Blender rinde (a) el GANCHO a 1440×2560 solo en cuadros IMPARES y (b) el CIERRE como UN still 4K; aquí se
# interpola a 30 fps (minterpolate, flujo de movimiento), se escala a 4K (lanczos) y el cierre se mueve con un
# paneo/zoom suave sobre el still. Todo determinista. Salidas = frame_%04d.png desde 1, como espera `montaje`.
#
#   bash scripts/blender-a-cuadros.sh gancho <dir_1440_impares> <dir_salida> [n_cuadros=165]
#   bash scripts/blender-a-cuadros.sh cierre <still_4k.png> <dir_salida> [n_cuadros=376]
set -euo pipefail
MODO="${1:?gancho|cierre}"; IN="${2:?entrada}"; OUT="${3:?salida}"; N="${4:-}"
mkdir -p "$OUT"
case "$MODO" in
  gancho)
    N="${N:-165}"
    SEQ="$(mktemp -d "${OUT}.seq.XXXX")"
    i=1; for f in $(ls "$IN"/frame_*.png | sort); do ln -sf "$(readlink -f "$f")" "$SEQ/$(printf 'seq_%04d.png' $i)"; i=$((i+1)); done
    echo "   $((i-1)) cuadros de entrada (impares) → $N a 30 fps + 4K"
    # 15 fps de entrada → 30 fps interpolados por compensación de movimiento; luego 4K lanczos
    ffmpeg -v error -y -framerate 15 -i "$SEQ/seq_%04d.png" \
      -vf "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,scale=2160:3840:flags=lanczos" \
      -frames:v "$N" -pix_fmt rgb24 "$OUT/frame_%04d.png"
    rm -rf "$SEQ"
    ;;
  cierre)
    N="${N:-376}"
    # paneo/zoom suave sobre el still: arranca 8 % cerrado y abre hasta el cuadro completo; los últimos ~90 cuadros quietos
    ffmpeg -v error -y -loop 1 -framerate 30 -i "$IN" \
      -vf "scale=2592:4608:flags=lanczos,zoompan=z='if(lte(on,$((N-90))),1.08-0.08*on/$((N-90)),1.0)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=2160x3840:fps=30" \
      -frames:v "$N" -pix_fmt rgb24 "$OUT/frame_%04d.png"
    ;;
  *) echo "modo desconocido: $MODO"; exit 1 ;;
esac
echo "   $(ls "$OUT"/frame_*.png | wc -l) cuadros en $OUT"
