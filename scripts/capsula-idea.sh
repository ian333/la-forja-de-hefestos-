#!/bin/bash
# capsula-idea.sh — CÁPSULA REPRODUCIBLE de un video de la serie
# "La economía son ideas" (cápsulas masterclass-cine de 30 s).
#
# Misma doctrina que video-capsula.sh (el O₂ viral jamás se pudo recrear):
# cada master congela código + guion + voz con timing + receta exacta.
# La serie vive en src/masterclass/cine (CineStage/NebulaWorld) — distinto
# stack que la serie de moléculas, por eso su propia cápsula.
#
# Uso: bash scripts/capsula-idea.sh <video-id> <slug> <id-escena>
#  ej: bash scripts/capsula-idea.sh idea-01-imprenta imprenta imprenta-capsula
#
# ⚠️ LA RECETA SE PASA POR ENV — no se hardcodea. Antes este script escribía
# SIEMPRE "END=31 MINBYTES=60000" (los valores de la imprenta) en el MANIFIESTO
# de CUALQUIER cápsula: una receta que no reproduce el master es exactamente el
# pecado del O₂. El transistor va a END=60 BATCH=120 MINBYTES=150000.
#   ej: END=60 MINBYTES=150000 BATCH=120 bash scripts/capsula-idea.sh ...
set -euo pipefail
ID=$1; SLUG=$2; ESCENA=$3
END=${END:?falta END (segundos del master; ej END=60)}
FPS=${FPS:-24}; FMT=${FMT:-916}; BATCH=${BATCH:-120}
MINBYTES=${MINBYTES:?falta MINBYTES (piso de frame REAL de este master)}
STILLS=${STILLS:-2,5,12,16,27}
F="$(cd "$(dirname "$0")/.." && pwd)"
STAGE=$F/dist-video/_capsulas/$ID
rm -rf "$STAGE"; mkdir -p "$STAGE"/{src/masterclass/cine/scenes,src/economia/labs,scripts/guiones,narracion}

# ── el mundo + framework cine COMPLETO (CineStage/CineCamera/NebulaWorld/HUD) ──
cp "$F"/src/masterclass/cine/*.tsx "$F"/src/masterclass/cine/*.ts "$STAGE"/src/masterclass/cine/ 2>/dev/null || true
# ── la escena de ESTA cápsula (todas las piezas cuyo nombre comparte raíz) ──
cp "$F"/src/masterclass/cine/scenes/*.tsx "$STAGE"/src/masterclass/cine/scenes/ 2>/dev/null || true
cp "$F"/src/economia/labs/registry.ts "$STAGE"/src/economia/labs/

# ── pipeline: guion → voz → ensamble por beats → stills → render ──
for s in narracion-gen.py assemble-offsets.py assemble-narracion.py render-clase.cjs shot-clase.cjs; do
  cp "$F"/scripts/$s "$STAGE"/scripts/ 2>/dev/null || true
done
# ── sound design de ESTA pieza (determinista: clics clavados a los beats) ──
cp "$F"/scripts/$SLUG-sound.py "$STAGE"/scripts/ 2>/dev/null || true
# ── gates de calidad: sin ellos no se sabe si un remake quedó igual de bueno ──
for s in detector-gancho.py atencion-verify.py; do
  cp "$F"/scripts/$s "$STAGE"/scripts/ 2>/dev/null || true
done
cp "$F"/scripts/guiones/$SLUG*.txt "$STAGE"/scripts/guiones/ 2>/dev/null || true

# ── assets de la cápsula (texturas LaTeX etc.: fuente .tex + png horneado) ──
mkdir -p "$STAGE"/public/textures
cp "$F"/scripts/$SLUG-*.tex "$STAGE"/scripts/ 2>/dev/null || true
cp "$F"/public/textures/$SLUG-*.png "$STAGE"/public/textures/ 2>/dev/null || true

# ── voz con timing exacto + wavs por línea ──
cp "$F"/public/audio/clase-$SLUG/narration.mp3 "$STAGE"/narracion/ 2>/dev/null || true
cp "$F"/dist-video/$SLUG-lineas-narracion/*.wav "$STAGE"/narracion/ 2>/dev/null || true

GITHASH=$(cd "$F" && git rev-parse --short HEAD 2>/dev/null || echo desconocido)
DIRTY=$(cd "$F" && git status --porcelain 2>/dev/null | wc -l)
cat > "$STAGE"/MANIFIESTO.md <<EOF
# Cápsula reproducible — $ID (serie "La economía son ideas")
Generada: $(date '+%Y-%m-%d %H:%M') · git $GITHASH (${DIRTY} archivos sin commit al capturar)
Escena: $ESCENA · slug: $SLUG

## Cómo reproducir (en iangpu, GPU real)
1. Colocar src/ sobre un checkout de la-forja (registry.ts registra '$ESCENA').
2. Voz: narracion/narration.mp3 → public/audio/clase-$SLUG/narration.mp3
   (para regenerar: TAKES=2 tts-venv narracion-gen.py $SLUG-lineas +
    assemble-offsets.py con los --times del guion).
3. npx vite build && stills de verificación (VER A OJO, no solo que no truene):
   ID=$ESCENA TIMES=$STILLS W=1080 H=1920 node scripts/shot-clase.cjs
4. Render (receta EXACTA de este master — 4K nativo, no pasar W/H):
   env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \\
       NODE_PATH=\$PWD/node_modules \\
       SLUG=$SLUG ID=$ESCENA END=$END FPS=$FPS FMT=$FMT \\
       BATCH=$BATCH MINBYTES=$MINBYTES AUDIO=auto \\
       node scripts/render-clase.cjs

## Trampas que costaron un día entero (léelas antes de tocar nada)
- **MINBYTES=$MINBYTES es el piso REAL de ESTE master**, medido de sus frames.
  Si lo subes de más, render-clase.cjs rechaza frames PERFECTOS y te miente con
  "frame VACÍO (context-lost)" — mandándote a cazar una GPU que está sana.
- **CULL detrás de cámara**: los vertex shaders expulsan el punto del clip
  (\`gl_Position = vec4(2,2,2,1)\`) en vez de maquillar con max()/clamp. Un
  \`gl_Position\` con w<0 rasteriza degenerado y CUELGA la GPU. Es la receta
  probada de CinematicAtom (118 videos). No la "simplifiques".
- **Piso de gl_PointSize**: NO poner mínimo > 0 en el clamp. Fuerza a dibujar
  puntos detrás de cámara y revienta Chrome.
- **Nunca \`pkill -x chrome\`**: iangpu la comparten varios agentes. Matar por
  grupo de procesos propio (setsid ⇒ pid == pgid).

## Gates que este master PASÓ (reproducir antes de publicar un remake)
   python3 scripts/detector-gancho.py <video.mp4> --perfil empirico  # cerebro rápido
   python3 scripts/atencion-verify.py <video.mp4>                    # cerebro lento
Marcas de este master: SCORE 62.1 (O₂ viral = 37.9) · firma de color 100%
· sync A/V 0.204 (2× el O₂) · loop 0.932 · 2ª mitad > 1ª.
EOF
echo "✓ cápsula: $STAGE"
