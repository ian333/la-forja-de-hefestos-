#!/usr/bin/env bash
# brand-nebula.sh — funde el logo GAIA Prime (α dorada con glow) GIGANTE y PROFUNDO
# en un still de nebulosa. Blend SCREEN: el negro del logo se vuelve transparente y la
# α brilla DESDE DENTRO del gas (no pegada encima). "Que sepan qué show está hermoso."
#
# Uso: scripts/brand-nebula.sh <base.png> <salida.png> [logo.png] [escala%] [opacidad] [offsetY]
#   escala%  = ancho del logo como % del ancho del frame (def 70 = gigante)
#   opacidad = 0..1 del logo antes del screen (def 0.92; <1 deja que los filamentos brillen a través)
#   offsetY  = corrimiento vertical en px (def -300 = un pelo arriba del centro, en el gas denso)
set -euo pipefail
BASE="${1:?base.png}"; OUT="${2:?salida.png}"
LOGO="${3:-dist-video/brand/gaia-perfil-alfa.png}"
SCALEP="${4:-70}"; OP="${5:-0.92}"; OY="${6:--300}"

W=$(identify -format '%w' "$BASE")
LW=$(python3 -c "print(int($W*$SCALEP/100))")

# logo escalado a LWxLW, atenuado por opacidad (mantiene el glow), blend SCREEN centrado.
convert "$BASE" \
  \( "$LOGO" -resize "${LW}x${LW}" -channel RGB -evaluate multiply "$OP" +channel \) \
  -gravity center -geometry "+0${OY}" -compose screen -composite \
  -depth 8 "$OUT"
echo "[brand] $OUT  (logo ${LW}px ancho, op ${OP}, screen) ← $BASE"
