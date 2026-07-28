#!/usr/bin/env bash
# video.sh — EL PIPELINE ÚNICO de la serie. Un video es un MANIFIESTO (videos/<id>.json),
# no un script propio. Reemplaza a wpair-full-pipeline.sh / wpairB-* / wpair-assemble.sh /
# wpair-capsula.sh / render-li2*.sh. Ver docs/CANON-VIDEO.md.
#
#   bash scripts/video.sh <id> [paso]      paso = campo|subs|render|ensamble|verificar|capsula|publicar|todo
#   bash scripts/video.sh mol-h2o-el-puente todo
#   SHARDS=3 bash scripts/video.sh mol-h2o-el-puente render     # override puntual
#
# Para un video NUEVO: copia videos/<otro>.json → videos/<nuevo>.json y cambia valores.
# NO se crean scripts nuevos. NO se agregan constantes a la escena (las tomas van al
# registro CAMERA_SHOTS de CinematicMolecule.tsx = datos).
set -uo pipefail
ID="${1:?falta <id> (videos/<id>.json)}"; PASO="${2:-todo}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MF="$ROOT/videos/$ID.json"
[ -f "$MF" ] || { echo "✗ no existe $MF"; exit 1; }
cd "$ROOT"

# ── leer manifiesto (python3: sin dependencias) ──
m() { python3 -c "
import json,sys
d=json.load(open('$MF'))
for k in '$1'.split('.'):
    d=d.get(k,'') if isinstance(d,dict) else ''
print(' '.join(map(str,d)) if isinstance(d,list) else d)"; }

# PREVIEW: W/H por env (mismo patrón que SHARDS). El MASTER siempre es 4K — CLAUDE.md
# regla #1: "el 1080 solo existe como derivado/preview, jamás como entregable final".
# Si W/H difieren del manifiesto se le pone SUFIJO a los frames y a las salidas, para que
# un preview NUNCA sobrescriba el master 4K ya rendido.
W="${W:-$(m formato.w)}"; H="${H:-$(m formato.h)}"; FPS=$(m formato.fps); DUR=$(m formato.dur)
SUF=""; if [ "$W" != "$(m formato.w)" ] || [ "$H" != "$(m formato.h)" ]; then SUF="-${W}x${H}"; fi
HTML=$(m escena.html); QUERY=$(m escena.query); HOOK=$(m escena.hook)
FRAMES="$ROOT/$(m render.frames)$SUF"; BATCH=$(m render.batch); SHARDS="${SHARDS:-$(m render.shards)}"
ADIR="$ROOT/$(m audio.dir)"; NARR=$(m audio.narracion); MUS=$(m audio.musica)
MVOL=$(m audio.musicaVol); MFIN=$(m audio.musicaFadeIn); MFOUT=$(m audio.musicaFadeOutAt)
SEGS="$ADIR/$(m audio.segs)"; ASS="$ADIR/$(m audio.ass)"
ODIR=$(m salida.dir); OMASTER="$ODIR/$(basename "$(m salida.master)" .mp4)$SUF.mp4"; OH264="$ODIR/$(basename "$(m salida.h264)" .mp4)$SUF.mp4"
NFRAMES=$(python3 -c "print(round($DUR*$FPS))")
BASE_URL="${BASE_URL:-http://localhost:5178}"
export DISPLAY=${DISPLAY:-:0} GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA

echo "▶ $ID · ${W}×${H} @${FPS} · ${DUR}s (${NFRAMES} frames) · shards=$SHARDS · paso=$PASO"

paso_subs() {
  echo "── SUBTÍTULOS (estilo canónico de la serie) ──"
  python3 "$ROOT/scripts/video-subs.py" "$SEGS" "$ASS" --w "$W" --h "$H"
}

paso_render() {
  echo "── RENDER 4K (paralelo, resumible) ──"
  mkdir -p "$FRAMES"
  local t0=$SECONDS
  for try in 1 2 3 4 5 6; do
    if [ "$SHARDS" -gt 1 ]; then
      local pids=()
      for k in $(seq 0 $((SHARDS-1))); do
        node "$ROOT/scripts/render-clip.cjs" --url "$BASE_URL/$HTML?$QUERY" --hook "$HOOK" \
          --out "$FRAMES" --fps "$FPS" --w "$W" --h "$H" --batch "$BATCH" \
          --nshards "$SHARDS" --shard "$k" > "/tmp/$ID-shard$k.log" 2>&1 &
        pids+=($!)
      done
      wait "${pids[@]}"
    else
      node "$ROOT/scripts/render-clip.cjs" --url "$BASE_URL/$HTML?$QUERY" --hook "$HOOK" \
        --out "$FRAMES" --fps "$FPS" --w "$W" --h "$H" --batch "$BATCH"
    fi
    local nf; nf=$(ls "$FRAMES"/*.png 2>/dev/null | wc -l)
    echo "   intento $try: $nf/$NFRAMES ($((SECONDS-t0))s)"
    [ "$nf" -ge $((NFRAMES-2)) ] && break
    sleep 5
  done
  NF=$(ls "$FRAMES"/*.png 2>/dev/null | wc -l)
  echo "   frames: $NF/$NFRAMES en $((SECONDS-t0))s"
  [ "$NF" -ge $((NFRAMES-2)) ] || { echo "✗ RENDER INCOMPLETO"; return 1; }
}

paso_ensamble() {
  echo "── ENSAMBLE (audio + subs + NVENC 10-bit) ──"
  mkdir -p "$ODIR"
  local mix=/tmp/$ID-mix.wav
  if [ -f "$ADIR/$MUS" ]; then
    ffmpeg -y -v error -i "$ADIR/$NARR" -i "$ADIR/$MUS" \
      -filter_complex "[1:a]volume=$MVOL,afade=t=in:st=0:d=$MFIN,afade=t=out:st=$MFOUT:d=3.5[mus]; \
                       [0:a]volume=1.0[nar]; \
                       [nar][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]; \
                       [mix]loudnorm=I=-15:TP=-1.5:LRA=11[out]" \
      -map "[out]" -ar 48000 -c:a pcm_s16le "$mix" || return 1
  else
    ffmpeg -y -v error -i "$ADIR/$NARR" -af "loudnorm=I=-15:TP=-1.5:LRA=11" -ar 48000 -c:a pcm_s16le "$mix" || return 1
  fi
  echo "   master 4K 10-bit HEVC"
  ffmpeg -y -v error -framerate "$FPS" -i "$FRAMES/%05d.png" -i "$mix" -vf "ass=$ASS" \
    -c:v hevc_nvenc -preset p5 -rc vbr -cq 21 -b:v 55M -maxrate 90M -pix_fmt yuv420p10le \
    -c:a aac -b:a 224k -shortest "$OMASTER" || return 1
  echo "   entrega h264"
  ffmpeg -y -v error -framerate "$FPS" -i "$FRAMES/%05d.png" -i "$mix" -vf "ass=$ASS" \
    -c:v h264_nvenc -preset p5 -rc vbr -cq 23 -b:v 40M -maxrate 60M -pix_fmt yuv420p \
    -c:a aac -b:a 192k -shortest "$OH264" || return 1
  ls -la "$OMASTER" "$OH264" | awk '{print "   ",$5,$NF}'
}

paso_capsula() {
  echo "── CÁPSULA REPRODUCIBLE ──"
  local S="$ROOT/dist-video/_capsulas/$ID"
  rm -rf "$S"; mkdir -p "$S"/{src/cinematic,scripts/guiones,precomputed,narracion}
  cp "$ROOT/$HTML" "$S/" 2>/dev/null
  for f in $(m capsula.escenaSrc); do cp "$ROOT/src/cinematic/$f" "$S/src/cinematic/" 2>/dev/null; done
  for f in $(m capsula.scripts);  do cp "$ROOT/scripts/$f"        "$S/scripts/"        2>/dev/null; done
  cp "$ROOT/scripts/guiones/$(m capsula.guion)" "$S/scripts/guiones/" 2>/dev/null
  for b in $(m capsula.bins); do cp "$ROOT/public/precomputed/$b" "$S/precomputed/" 2>/dev/null; done
  cp "$SEGS" "$ASS" "$ADIR/$NARR" "$ADIR/$MUS" "$S/narracion/" 2>/dev/null
  cp "$MF" "$S/manifiesto.json"
  cat > "$S/MANIFIESTO.md" <<EOF
# $(m titulo) · cápsula reproducible

Regenerar (con el repo en este estado):  \`bash scripts/video.sh $ID todo\`
El video es DATOS: **manifiesto.json** (incluido). Cero scripts por-video.

- escena: $HTML?$QUERY  (hook $HOOK)
- formato: ${W}×${H} @${FPS}fps · ${DUR}s
- render: render-clip.cjs, shards=$SHARDS (paralelo, resumible)
- subtítulos: video-subs.py = estilo canónico de la serie (Outfit Thin SemiBold, frase abajo)
- git: $(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo sin-commit)

La voz NO se regenera (XTTS no es determinista): los audios finales van dentro.
EOF
  ( cd "$ROOT/dist-video/_capsulas" && tar -czf "$ID-capsula.tar.gz" "$ID" )
  # auditoría: ningún archivo clave vacío (gotcha li2: cápsula con narración VACÍA)
  local vac; vac=$(find "$S" -type f -size -1c | wc -l)
  echo "   $ID-capsula.tar.gz ($(du -m "$ROOT/dist-video/_capsulas/$ID-capsula.tar.gz" | cut -f1)MB) · archivos vacíos: $vac"
  [ "$vac" -eq 0 ] || echo "   ⚠ hay archivos vacíos en la cápsula — revisar"
}

paso_campo() {
  echo "── PORTERO DEL CAMPO (E hoy, B mañana) ──"
  local BIN REF
  BIN=$(m campo.bin); REF=$(m campo.referencia)
  [ -n "$BIN" ] || { echo "   (esta pieza no declara campo — nada que verificar)"; return 0; }
  python3 "$ROOT/scripts/verificar-campo.py" "$ROOT/public/precomputed/$BIN" \
    ${REF:+--ref "$ROOT/public/precomputed/$REF"} --png "$ROOT/dist-video/$ID-campo2d"
}

paso_verificar() {
  echo "── VERIFICADOR DE ATENCIÓN (economía de atención, docs/ECONOMIA-ATENCION.md) ──"
  [ -f "$OH264" ] || { echo "   ✗ no existe $OH264 — corre 'ensamble' primero"; return 1; }
  local J="$ROOT/dist-video/$ID-atencion.json"
  python3 "$ROOT/scripts/atencion-verify.py" "$OH264" --json "$J" || return 1
  echo "   → $J   (pegar las notas en videos/$ID.json § verificador.atencion)"
  # encuadre vs los GANADORES (no contra un umbral inventado — ver CANON §LEGIBILIDAD)
  [ -d "$FRAMES" ] && python3 - "$FRAMES" <<'EOF'
import sys, glob, numpy as np
from PIL import Image
fs = sorted(glob.glob(sys.argv[1] + "/*.png"))[::max(1, len(glob.glob(sys.argv[1]+"/*.png"))//24)]
bot=[]; fill=[]
for f in fs:
    a = np.asarray(Image.open(f).convert('L'), dtype=float)/255.0
    r = a.mean(axis=1); v = np.where(r > 0.012)[0]
    if len(v): bot.append(1 - v[-1]/len(r)); fill.append((a > 0.012).mean())
if bot:
    print(f"   encuadre: void↓ mediana {np.median(bot):.1%} max {max(bot):.1%} · fill {np.median(fill):.3f}")
    print(f"   referencia ganadores → O2 void_max 12.1%/fill .818 · puente 14.6%/.738 · h2o_v2 24.2%/.493")
EOF
}

paso_publicar() {
  echo "── PUBLICAR (PRIME + ATLAS) ──"
  local PRIME=ian@100.110.244.20 ATLAS_LAN=ian@192.168.100.4 ATLAS=ian@100.97.118.117
  local RE="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=8"
  local BIB; BIB=$(m publicar.biblioteca); local CAPREL; CAPREL=$(m publicar.capsulaRel)
  local CAP="$ROOT/dist-video/_capsulas/$ID-capsula.tar.gz"
  # ATLAS por LAN (9ms) si se puede; si no, por Tailscale. Ver reference_gaia_network_topology.
  local A=$ATLAS; ssh -o BatchMode=yes -o ConnectTimeout=5 $ATLAS_LAN true 2>/dev/null && A=$ATLAS_LAN
  rsync -a -e "$RE" "$OH264" "$PRIME:/mnt/hdd/biblioteca/$BIB"              && echo "   ✓ PRIME video"
  rsync -a -e "$RE" "$OH264" "$A:/mnt/hdd/forja-dist/biblioteca/$BIB"       && echo "   ✓ ATLAS video"
  [ -f "$CAP" ] && { rsync -a -e "$RE" "$CAP" "$PRIME:/mnt/hdd/biblioteca/$CAPREL" && echo "   ✓ PRIME cápsula"
                     rsync -a -e "$RE" "$CAP" "$A:/mnt/hdd/forja-dist/biblioteca/$CAPREL" && echo "   ✓ ATLAS cápsula"; }
  echo "   ▸ falta (desde la laptop): SPECIAL '$(m publicar.pieza)' en comando-catalogo.cjs →"
  echo "     node scripts/comando-scan.cjs && node scripts/comando-catalogo.cjs → rsync 2 JSONs a ATLAS"
}

case "$PASO" in
  subs)      paso_subs ;;
  render)    paso_render ;;
  ensamble)  paso_ensamble ;;
  capsula)   paso_capsula ;;
  campo)     paso_campo ;;
  verificar) paso_verificar ;;
  publicar)  paso_publicar ;;
  todo)      paso_campo && paso_subs && paso_render && paso_ensamble && paso_verificar && paso_capsula && echo "✔ $ID LISTO (publicar aparte)" ;;
  *) echo "paso inválido: $PASO (subs|render|ensamble|verificar|capsula|publicar|todo)"; exit 2 ;;
esac
