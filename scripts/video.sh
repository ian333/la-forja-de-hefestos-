#!/usr/bin/env bash
# video.sh — EL PIPELINE ÚNICO de la serie. Un video es un MANIFIESTO (videos/<id>.json),
# no un script propio. Reemplaza a wpair-full-pipeline.sh / wpairB-* / wpair-assemble.sh /
# wpair-capsula.sh / render-li2*.sh. Ver docs/CANON-VIDEO.md.
#
#   bash scripts/video.sh <id> [paso]      paso = salud|voz|campo|subs|render|ensamble|verificar|capsula|entrega|publicar|subir|todo
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
HTML=$(m escena.html); QUERY="${QUERY:-$(m escena.query)}"; HOOK=$(m escena.hook)
# QUERY se puede sobreescribir por entorno para variantes de CÁMARA de la MISMA pieza
# (p.ej. la versión 16:9: `QUERY="m=wsilla&cam=w" W=3840 H=2160`). El sufijo -WxH ya
# separa los frames y las salidas, así que la variante no pisa al vertical.
FRAMES="$ROOT/$(m render.frames)$SUF"; BATCH=$(m render.batch); SHARDS="${SHARDS:-$(m render.shards)}"
# CAPTURA (2026-08-17): cdp-jpeg por default = 3.8× por cuadro (ver render-clip.cjs).
# Se declara por pieza en render.captura o se fuerza con CAPTURA=. La extensión de los
# cuadros depende del modo, así que TODO glob de frames usa $FEXT, nunca .png a pelo.
CAPTURA="${CAPTURA:-$(m render.captura)}"; CAPTURA="${CAPTURA:-cdp-jpeg}"
FEXT=png; [ "$CAPTURA" = "cdp-jpeg" ] && FEXT=jpg
ADIR="$ROOT/$(m audio.dir)"; NARR=$(m audio.narracion); MUS=$(m audio.musica)
MVOL=$(m audio.musicaVol); MFIN=$(m audio.musicaFadeIn); MFOUT=$(m audio.musicaFadeOutAt)
# ventanas donde el cuadro es negro A PROPÓSITO (canon §LA MECÁNICA DEL O₂):
# sin esto el portero de cuadros negros las reintenta hasta 12 veces cada una.
NEGRAS="$(m render.ventanasNegras)"
SEGS="$ADIR/$(m audio.segs)"; ASS="$ADIR/$(m audio.ass)"
ODIR=$(m salida.dir)
# E: FUERA DEL CAMINO CRÍTICO (2026-08-17): un drvfs muerto rompía el ensamble en el último
# paso (pasó con la serie de verificación). salida.dir relativo vive en ext4 bajo ROOT; los
# discos de Windows son destinos del paso `entrega`, que ENCOLA si están muertos.
case "$ODIR" in /*) ;; *) ODIR="$ROOT/$ODIR" ;; esac
mkdir -p "$ODIR"
OMASTER="$ODIR/$(basename "$(m salida.master)" .mp4)$SUF.mp4"; OH264="$ODIR/$(basename "$(m salida.h264)" .mp4)$SUF.mp4"
NFRAMES=$(python3 -c "print(round($DUR*$FPS))")
BASE_URL="${BASE_URL:-http://localhost:5178}"
export DISPLAY=${DISPLAY:-:0} GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA

echo "▶ $ID · ${W}×${H} @${FPS} · ${DUR}s (${NFRAMES} frames) · shards=$SHARDS · paso=$PASO"

paso_subs() {
  echo "── SUBTÍTULOS (estilo canónico de la serie) ──"
  # audio.marginv (opcional): sube el subtítulo cuando la escena ya tiene texto abajo.
  # Sin él, el canon manda. Ver el comentario de --marginv en video-subs.py.
  local MV; MV=$(m audio.marginv)
  python3 "$ROOT/scripts/video-subs.py" "$SEGS" "$ASS" --w "$W" --h "$H" ${MV:+--marginv "$MV"}
}

paso_render() {
  echo "── RENDER 4K (paralelo, resumible) ──"
  mkdir -p "$FRAMES"
  # GUARDA DE DURACIÓN: render-clip.cjs es RESUMIBLE — salta todo frame que ya exista y no
  # sea negro (línea 100). Eso es lo que hace barato reintentar… y lo que MEZCLA dos versiones
  # si la duración del video cambió: los frames viejos sobreviven y el resultado es un
  # Frankenstein que nadie nota hasta verlo. Pasó el 2026-07-28 al cortar de 92 a 74.3 s.
  local marca="$FRAMES/.dur"
  if [ -f "$marca" ] && [ "$(cat "$marca")" != "$DUR" ]; then
    echo "   duración cambió ($(cat "$marca")s → ${DUR}s): BORRANDO frames viejos para no mezclar"
    rm -f "$FRAMES"/*.png "$FRAMES"/*.jpg
  fi
  # HUELLA DE LA ESCENA: la guarda de arriba sólo caza cambios de DURACIÓN. Si cambió la ESCENA
  # (cámara, capas, shaders) con la misma duración, el resume reusa los frames viejos.
  # Se creía que detectar eso era frágil y que bastaba con acordarse de exportar FRESH=1. No
  # basta: el 2026-08-05 se me olvidó y salió un 1080 MEZCLADO — y peor que "idéntico al
  # anterior", porque el criterio de reanudar es tamaño>BLACK: sobrevivieron justo los frames
  # PESADOS, que eran los de la pared de luz, y se re-rindieron sólo los oscuros. Un
  # Frankenstein donde la mitad mala es la que se conserva.
  # Un flag que hay que recordar no es una guarda. Esto sí: md5 de las fuentes de la escena y
  # del manifiesto. Barre de más (cualquier edición en src/cinematic/ tira los frames), y eso
  # está bien: después de tocar la escena, RE-RENDERIZAR es justo lo que se quiere.
  local huella="$FRAMES/.huella"
  local hoy; hoy=$( { cat "$ROOT"/src/cinematic/*.ts "$ROOT"/src/cinematic/*.tsx "$MF" 2>/dev/null; } | md5sum | cut -c1-12)
  if [ -f "$huella" ] && [ "$(cat "$huella")" != "$hoy" ]; then
    echo "   la ESCENA cambió ($(cat "$huella") → $hoy): BORRANDO frames viejos para no mezclar"
    rm -f "$FRAMES"/*.png "$FRAMES"/*.jpg
  fi
  echo "$hoy" > "$huella"
  if [ -n "${FRESH:-}" ]; then
    echo "   FRESH=1: borrando $(ls "$FRAMES"/*.png "$FRAMES"/*.jpg 2>/dev/null | wc -l) frames para renderizar de cero"
    rm -f "$FRAMES"/*.png "$FRAMES"/*.jpg
  fi
  echo "$DUR" > "$marca"
  local t0=$SECONDS
  for try in 1 2 3 4 5 6; do
    if [ "$SHARDS" -gt 1 ]; then
      local pids=()
      for k in $(seq 0 $((SHARDS-1))); do
        node "$ROOT/scripts/render-clip.cjs" --url "$BASE_URL/$HTML?$QUERY" --hook "$HOOK" --captura "$CAPTURA" --dur "$DUR" \
          --out "$FRAMES" --fps "$FPS" --w "$W" --h "$H" --batch "$BATCH" ${NEGRAS:+--negras "$NEGRAS"} \
          --nshards "$SHARDS" --shard "$k" > "/tmp/$ID-shard$k.log" 2>&1 &
        pids+=($!)
      done
      wait "${pids[@]}"
    else
      node "$ROOT/scripts/render-clip.cjs" --url "$BASE_URL/$HTML?$QUERY" --hook "$HOOK" --captura "$CAPTURA" --dur "$DUR" \
        --out "$FRAMES" --fps "$FPS" --w "$W" --h "$H" --batch "$BATCH"
    fi
    local nf; nf=$(ls "$FRAMES"/*.$FEXT 2>/dev/null | wc -l)
    echo "   intento $try: $nf/$NFRAMES ($((SECONDS-t0))s)"
    [ "$nf" -ge $((NFRAMES-2)) ] && break
    sleep 5
  done
  NF=$(ls "$FRAMES"/*.$FEXT 2>/dev/null | wc -l)
  echo "   frames: $NF/$NFRAMES en $((SECONDS-t0))s"
  [ "$NF" -ge $((NFRAMES-2)) ] || { echo "✗ RENDER INCOMPLETO"; return 1; }
  # ── GATE DE CUADRO NEGRO, POR PÍXELES ────────────────────────────────────────────────
  # render-clip.cjs detecta "negro" por TAMAÑO del archivo, y a 4K ESO NO FUNCIONA: el grano
  # de película vuelve el PNG incompresible y un cuadro 100 % negro pesa 200 KB, muy por
  # encima de cualquier umbral razonable. Medido el 2026-08-07: 162 cuadros negros (157
  # seguidos, 5.2 s) pasaron el guardián, pasaron el chequeo de corrupción —el PNG está bien
  # formado— y llegaron al ensamble. La única prueba que los caza es MIRAR LOS PÍXELES.
  python3 - "$FRAMES" <<'PYNEG'
import glob, os, sys
from PIL import Image
import numpy as np
fs = sorted(glob.glob(os.path.join(sys.argv[1], '*.png')) + glob.glob(os.path.join(sys.argv[1], '*.jpg')))
# QUÉ ES "NEGRO" — la definición importa, y la primera estuvo MAL (2026-08-11).
# El gate medía sólo la MEDIA (<0.5) y reprobó a atomo-cr y atomo-cu por los cuadros del
# pull-back: ahí el átomo es una chispa en un cuadro enorme y la media cae a 0.478… con
# max=255, 9 934 píxeles por encima de 200 y medio megabyte de PNG. O sea cuadros BUENOS,
# y una toma oscura no es un fallo — la doctrina de cine PIDE negro real de fondo.
# Un cuadro negro DE VERDAD es un fallo de WebGL: no tiene UN SOLO píxel encendido. Esa es
# la prueba específica. La media sola confunde "oscuro" con "vacío", y un gate que reprueba
# lo bueno se termina ignorando, que es peor que no tenerlo.
def vacio(f):
    a = np.asarray(Image.open(f).convert('L'), dtype=float)
    return int((a > 24).sum()) < 64          # <64 px encendidos en 8.3 Mpx = no se dibujó nada
negros = [os.path.basename(f) for f in fs if vacio(f)]
if negros:
    print(f'   ✗ {len(negros)} CUADROS NEGROS (primero {negros[0]}, último {negros[-1]})')
    sys.exit(1)
print(f'   ✓ cero cuadros negros ({len(fs)} verificados por píxeles)')
PYNEG
  [ $? -eq 0 ] || { echo "✗ hay cuadros negros — NO ensamblar"; return 1; }
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
                       [mix]loudnorm=I=-15:TP=-1.5:LRA=11,apad=whole_dur=$DUR[out]" \
      -map "[out]" -ar 48000 -c:a pcm_s16le "$mix" || return 1
  else
    ffmpeg -y -v error -i "$ADIR/$NARR" -af "loudnorm=I=-15:TP=-1.5:LRA=11,apad=whole_dur=$DUR" -ar 48000 -c:a pcm_s16le "$mix" || return 1
  fi
  # apad + -shortest: sin el pad, `-shortest` corta el VIDEO al largo de la narración y se
  # TIRAN los frames finales sin avisar. Medido el 2026-07-29: el anillo entregaba 2253 de
  # 2331 frames (75.1 s de 77.7) y el corte se comía justo la separación final. El pad deja
  # que -shortest recorte al VIDEO, que es la duración del manifiesto.
  echo "   master 4K 10-bit HEVC"
  ffmpeg -y -v error -framerate "$FPS" -i "$FRAMES/%05d.$FEXT" -i "$mix" -vf "ass=$ASS" \
    -c:v hevc_nvenc -preset p5 -rc vbr -cq 21 -b:v 55M -maxrate 90M -pix_fmt yuv420p10le \
    -c:a aac -b:a 224k -shortest "$OMASTER" || return 1
  echo "   entrega h264"
  ffmpeg -y -v error -framerate "$FPS" -i "$FRAMES/%05d.$FEXT" -i "$mix" -vf "ass=$ASS" \
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
  # AUDITORÍA. Dos preguntas DISTINTAS, y durante meses solo se hizo la primera:
  #   (a) ¿algún archivo presente está vacío?   (gotcha li2: narración de 0 bytes)
  #   (b) ¿FALTA algún archivo que debería estar?
  # El 2026-08-04 la cápsula de EL HEXÁGONO salió a PRIME y ATLAS con la carpeta narracion/
  # COMPLETAMENTE VACÍA — cero segs.json, cero .ass, cero voz, cero música — y la auditoría
  # dijo "archivos vacíos: 0", porque los `cp` de arriba llevan 2>/dev/null y no había nada
  # que copiar. Una cápsula sin voz NO es reproducible: XTTS no es determinista, esos takes
  # no vuelven. Ahora se exige la PRESENCIA de lo que hace a la cápsula una cápsula.
  local vac; vac=$(find "$S" -type f -size -1c | wc -l)
  local falta=0
  for f in "narracion/$(basename "$SEGS")" "narracion/$(basename "$ASS")" "narracion/$NARR" \
           "manifiesto.json" "scripts/guiones/$(m capsula.guion)"; do
    [ -s "$S/$f" ] || { echo "   ✗ FALTA (o vacío): $f"; falta=$((falta+1)); }
  done
  [ -f "$ADIR/$MUS" ] && { [ -s "$S/narracion/$MUS" ] || { echo "   ✗ FALTA: narracion/$MUS"; falta=$((falta+1)); }; }
  local nbin; nbin=$(ls "$S/precomputed" 2>/dev/null | wc -l)
  [ "$nbin" -gt 0 ] || { echo "   ✗ FALTA: los .bin de la simulación"; falta=$((falta+1)); }
  ( cd "$ROOT/dist-video/_capsulas" && tar -czf "$ID-capsula.tar.gz" "$ID" )
  echo "   $ID-capsula.tar.gz ($(du -m "$ROOT/dist-video/_capsulas/$ID-capsula.tar.gz" | cut -f1)MB) · vacíos: $vac · faltantes: $falta"
  [ "$vac" -eq 0 ] && [ "$falta" -eq 0 ] || { echo "   ✗ CÁPSULA INCOMPLETA — no publicar así"; return 1; }
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
fs = sorted(glob.glob(sys.argv[1] + "/*.png") + glob.glob(sys.argv[1] + "/*.jpg")); fs = fs[::max(1, len(fs)//24)]
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
  echo "── PUBLICAR (blindado: nombre RESUELTO + catálogo + verificación en vivo) ──"
  local PRIME=ian@100.110.244.20 ATLAS_LAN=ian@192.168.100.4 ATLAS=ian@100.97.118.117
  local RE="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=8"
  local BIB; BIB=$(m publicar.biblioteca); local CAPREL; CAPREL=$(m publicar.capsulaRel)
  local CAP="$ROOT/dist-video/_capsulas/$ID-capsula.tar.gz"
  local A=$ATLAS; ssh -o BatchMode=yes -o ConnectTimeout=5 $ATLAS_LAN true 2>/dev/null && A=$ATLAS_LAN
  # EL NOMBRE SE RESUELVE, NO SE INVENTA (2026-08-16: publicar a atomo-cr.mp4 creó una
  # pieza basura "El átomo de atomo-cr" DOS veces — la biblioteca nombra atom-NNN-Simbolo).
  # Si el destino NO existe en PRIME, solo pasa con publicar.nueva=true; si no, se aborta
  # mostrando los vecinos para encontrar el nombre correcto.
  if ! $RE $PRIME "test -f /mnt/hdd/biblioteca/$BIB" 2>/dev/null; then
    if [ "$(m publicar.nueva)" != "True" ] && [ "$(m publicar.nueva)" != "true" ]; then
      echo "   ✗ /mnt/hdd/biblioteca/$BIB NO existe en PRIME y publicar.nueva no es true."
      echo "     ¿Pieza nueva de verdad? → declara \"nueva\": true en publicar."
      echo "     ¿Reemplazo? → el nombre correcto anda entre estos vecinos:"
      $RE $PRIME "ls /mnt/hdd/biblioteca/$(dirname "$BIB")/ 2>/dev/null" | head -12 | sed 's/^/       /'
      return 1
    fi
    echo "   (pieza NUEVA declarada: $BIB)"
  else
    echo "   ✓ destino existe en PRIME → REEMPLAZO de $BIB"
  fi
  rsync -a -e "$RE" "$OH264" "$PRIME:/mnt/hdd/biblioteca/$BIB"              && echo "   ✓ PRIME video"
  rsync -a -e "$RE" "$OH264" "$A:/mnt/hdd/forja-dist/biblioteca/$BIB"       && echo "   ✓ ATLAS video"
  [ -f "$CAP" ] && { $RE $PRIME "mkdir -p /mnt/hdd/biblioteca/$(dirname "$CAPREL")"; $RE $A "mkdir -p /mnt/hdd/forja-dist/biblioteca/$(dirname "$CAPREL")"
                     rsync -a -e "$RE" "$CAP" "$PRIME:/mnt/hdd/biblioteca/$CAPREL" && echo "   ✓ PRIME cápsula"
                     rsync -a -e "$RE" "$CAP" "$A:/mnt/hdd/forja-dist/biblioteca/$CAPREL" && echo "   ✓ ATLAS cápsula"; }
  # CATÁLOGO SOLO (antes: "falta desde la laptop" = tres pasos manuales que se olvidaban)
  echo "   ▸ catálogo: scan + build + deploy + verificación en vivo"
  node "$ROOT/scripts/comando-scan.cjs" > /dev/null 2>&1 && node "$ROOT/scripts/comando-catalogo.cjs" | tail -1
  rsync -a -e "$RE" "$ROOT/public/comando/catalogo.json" "$ROOT/public/comando/produccion.json" "$A:/mnt/hdd/forja-dist/comando/" && echo "   ✓ JSONs en ATLAS"
  local PIEZA; PIEZA=$(m publicar.pieza)
  # el JSON en vivo puede venir MINIFICADO ("id":"x") o con espacio ("id": "x") según quién lo
  # sirvió (2026-09-04: la release de vite lo dejó minificado y este check frenó el programar de B
  # dos veces con la pieza YA en vivo) → las dos formas valen.
  if curl -s --max-time 10 "https://university.gaiaprime.com.mx/comando/catalogo.json" | grep -qE "\"id\": ?\"$PIEZA\""; then
    echo "   ✓ EN VIVO: la pieza $PIEZA está en el catálogo de producción"
  else
    echo "   ✗ la pieza $PIEZA NO aparece en producción — revisar"
    return 1
  fi
}

paso_salud() {
  echo "── SALUD (doctor + porteros de los ganadores) ──"
  bash "$ROOT/scripts/salud.sh"
}

paso_voz() {
  echo "── VOZ (fit-check → TTS con caché → ensamble → whisper) ──"
  # La voz vivía FUERA del pipeline: cada corrida era un script scratch distinto (6 en
  # una semana) y sus errores clásicos —guion que no cabe, wavs huérfanos, voz sin
  # verificar— se repetían. VOZ=0 la salta (p.ej. piezas sin narración).
  [ "${VOZ:-1}" = "0" ] && { echo "   (VOZ=0: saltada)"; return 0; }
  # AUDIO CONGELADO (2026-08-17): los ganadores declaran audio.congelada=true — su voz es
  # parte del ganador: ni se regenera ni se re-verifica con el canon de HOY (voz-check
  # reprobaba al anillo por "H2O"/"Esa": su voz embarcada dice eso, y GANÓ diciéndolo).
  if [ "$(m audio.congelada)" = "True" ]; then
    local NARR; NARR="$ROOT/$(m audio.dir)/$(m audio.narracion)"
    [ -s "$NARR" ] || { echo "   ✗ audio.congelada=true pero falta $NARR"; return 1; }
    echo "   (audio CONGELADO — se usa $(basename "$NARR") tal cual)"
    return 0
  fi
  # Ganadores viejos (puente/camB) NO declaran guion: su narración ya está construida y
  # congelada — regenerarla sería tocar al ganador. Sin declarar = saltar, NO error.
  # (Cazado por la corrida total 2026-08-17: voz tronaba con "no existe el guion $ROOT/".)
  local GREL; GREL="$(m guion.archivo)"
  [ -n "$GREL" ] || { echo "   (esta pieza no declara guion — narración congelada, nada que generar)"; return 0; }
  local GARCH; GARCH="$ROOT/$GREL"
  [ -f "$GARCH" ] || { echo "   ✗ no existe el guion $GARCH"; return 1; }
  local MOLV; MOLV=$(basename "$GARCH" .txt)
  local VEL; VEL=$(m audio.vel); VEL="${VEL:-1.0}"
  # FIT-CHECK ANTES DE GASTAR TTS: 0.455 s/palabra medido de los ensambles reales con
  # VEL=1.10 y gap 0.40. Un guion que no cabe = video CONGELADO en el último cuadro
  # (habría pasado en 3 de 4 átomos del lote del 2026-08-12; se cazó a mano — ahora es gate).
  # ⚠ el fit-check DIVIDE entre VEL (2026-09-04). Antes estimaba a 1.0 siempre y bloqueó el
  # brazo B del experimento de ritmo (149 palabras a VEL 1.25 = 54 s, no 68): es el mismo bug
  # que ritmo-pieza.py tuvo un día antes. 0.455 s/palabra está medido a VEL 1.0.
  python3 - "$GARCH" "$DUR" "$VEL" <<'PYFIT' || return 1
import sys
ls = [l.strip() for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
w = sum(len(l.split()) for l in ls)
vel = float(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] else 1.0
est = w * 0.455 / vel
tope = float(sys.argv[2]) - 1.5
print(f"   guion: {len(ls)} líneas · {w} palabras · VEL {vel} · voz estimada {est:.1f}s · cabe hasta {tope:.1f}s")
if est > tope:
    print(f"   ✗ NO CABE (se pasa {est-tope:.1f}s): recorta el guion o alarga formato.dur ANTES de gastar TTS")
    sys.exit(1)
PYFIT
  # TAKES=4 SIEMPRE (canon §VOZ): el default de narracion-gen es 1 = CERO selección (Gauss 2026-07-30).
  TAKES="${TAKES:-4}" VEL="$VEL" /home/ian/tts-venv/bin/python "$ROOT/scripts/narracion-gen.py" "$MOLV" 2>&1 | grep -E "CACHÉ|ELEGIDA|huérfano|FALTAN|✗" | tail -12
  python3 "$ROOT/scripts/assemble-narracion.py" "$MOLV" --gap 0.40 --lead 0.40 2>&1 | tail -1
  if ! /home/ian/tts-venv/bin/python "$ROOT/scripts/voz-check.py" "$MOLV" 2>&1 | tee /tmp/vozcheck-$ID.txt | grep -q "✓ la voz DICE el guion"; then
    echo "   ✗ LA VOZ NO DICE EL GUION — no se sigue:"; grep -E "DIFIERE|guion:|oído" /tmp/vozcheck-$ID.txt | head -8
    return 1
  fi
  echo "   ✓ voz verificada por transcripción"
}

paso_entrega() {
  echo "── ENTREGA (ext4 SIEMPRE; Windows si vive; encola si no) ──"
  [ -f "$OH264" ] || { echo "   ✗ no existe $OH264 — corre 'ensamble' primero"; return 1; }
  local STAGE="$ROOT/dist-video/entregas"; mkdir -p "$STAGE"
  local NOM; NOM=$(basename "$OH264")
  cp -f "$OH264" "$STAGE/$NOM" && md5sum "$STAGE/$NOM" | cut -d' ' -f1 > "$STAGE/$NOM.md5"
  echo "   ✓ ext4: dist-video/entregas/$NOM ($(stat -c%s "$STAGE/$NOM") bytes + md5)"
  # E: (masters) y C: (Downloads de iangpu) — con verificación de TAMAÑO EXACTO; la
  # lección de la entrega que "pasó" comparando contra el archivo viejo.
  local SZ; SZ=$(stat -c%s "$OH264")
  if ls /mnt/e/forja-videos >/dev/null 2>&1; then
    cp -f "$OH264" "/mnt/e/forja-videos/$NOM" && cp -f "$OMASTER" "/mnt/e/forja-videos/$(basename "$OMASTER")" 2>/dev/null
    [ "$(stat -c%s "/mnt/e/forja-videos/$NOM" 2>/dev/null)" = "$SZ" ] && echo "   ✓ E: verificado ($SZ bytes)" || echo "   ✗ E: copia NO verificada"
  else
    echo "   ⚠ E: muerto → queda encolado en ext4"; echo "$NOM" >> "$STAGE/PENDIENTES-E.txt"
  fi
  if ls "/mnt/c/Users/sebas/Downloads" >/dev/null 2>&1; then
    cp -f "$OH264" "/mnt/c/Users/sebas/Downloads/$NOM"
    [ "$(stat -c%s "/mnt/c/Users/sebas/Downloads/$NOM" 2>/dev/null)" = "$SZ" ] && echo "   ✓ Downloads iangpu: verificado" || echo "   ✗ Downloads iangpu: NO verificada"
  else
    echo "   ⚠ C: muerto → queda encolado (scripts/traer.sh lo jala desde la laptop)"
  fi
}

paso_subir() {
  # SUBIDA AUTOMATIZADA (orden 2026-08-26): API oficial de YouTube e Instagram. NADA se publica sin
  # publicar.autorizado en el manifiesto (el gate vive en scripts/pub_comun.py). Uso:
  #   bash scripts/video.sh <id> subir yt,ig      (PLAT en $3)
  echo "── SUBIR (API oficial · gate publicar.autorizado) ──"
  local PLAT="${3:-yt}"; local PY=/home/ian/pub-venv/bin/python
  [ -x "$PY" ] || { echo "   ✗ falta $PY (venv de publicación en iangpu)"; return 1; }
  case ",$PLAT," in *,yt,*) $PY "$ROOT/scripts/subir-youtube.py" "$ID" --publico ${PROGRAMAR:+--programar "$PROGRAMAR"} || return 1;; esac
  case ",$PLAT," in *,ig,*)
    [ -n "$(m publicar.reel_url)" ] || python3 "$ROOT/scripts/reels-1080.py" "$ID" --subir || return 1
    $PY "$ROOT/scripts/subir-instagram.py" "$ID" || return 1;; esac
}

paso_programar() {
  # EL CINE PROGRAMADO (orden 2026-09-04): la hora vive en el manifiesto (publicar.programar, ISO
  # con huso; canon 18:45 CDMX = public/comando/horarios.json) y las palabras de ian en
  # publicar.autorizado. YouTube se programa SOLO (publishAt, subir-youtube.py:57); Instagram no
  # tiene programación en la API → el reel se hospeda aquí (reels-1080.py --subir) y PRIME lo
  # publica a la hora por cron (scripts/cola-publicar.py tick). Corre en iangpu (venv + secretos).
  echo "── PROGRAMAR (YouTube con publishAt · reel hospedado · cola de PRIME para Instagram) ──"
  local CUANDO; CUANDO="$(m publicar.programar)"
  [ -n "$CUANDO" ] || { echo "   ✗ falta publicar.programar (p.ej. 2026-09-06T18:45:00-06:00)"; return 1; }
  [ -n "$(m publicar.autorizado)" ] || { echo "   ✗ falta publicar.autorizado (las palabras de ian)"; return 1; }
  local PY=/home/ian/pub-venv/bin/python
  [ -x "$PY" ] || { echo "   ✗ falta $PY (esto corre en iangpu)"; return 1; }
  paso_publicar || return 1
  [ -n "$(m publicar.subidas.yt.publishAt)" ] && echo "   (YouTube 9:16 ya programado: $(m publicar.subidas.yt.publishAt))" \
    || $PY "$ROOT/scripts/subir-youtube.py" "$ID" --publico --programar "$CUANDO" || return 1
  local H264="$ROOT/$(m salida.dir)/$(m salida.h264)"; local ANCHO="${H264%.mp4}-3840x2160.mp4"
  if [ -s "$ANCHO" ]; then
    [ -n "$(m publicar.subidas.yt16x9.publishAt)" ] && echo "   (YouTube 16:9 ya programado)" \
      || ARCHIVO="$ANCHO" CLAVE=yt16x9 $PY "$ROOT/scripts/subir-youtube.py" "$ID" --publico --programar "$CUANDO" || return 1
  else
    echo "   ⚠ sin master 16:9 ($(basename "$ANCHO")): YouTube ancho NO programado — renderízalo y vuelve a correr programar"
  fi
  [ -n "$(m publicar.reel_url)" ] || python3 "$ROOT/scripts/reels-1080.py" "$ID" --subir || return 1
  python3 "$ROOT/scripts/cola-publicar.py" armar "$ID" || return 1
}

paso_cosechar() {
  echo "── COSECHAR (lo que PRIME publicó → manifiesto + cronograma) ──"
  python3 "$ROOT/scripts/cola-publicar.py" cosechar "$ID"
}

paso_ritmo() {
  echo "── RITMO (portero de REGISTRO: la pieza declara su tratamiento) ──"
  # Auditoría del 2026-09-02: ningún portero exigía anotar CON QUÉ se hizo la pieza, y por eso
  # llevábamos 24 experimentos sin poder atribuir nada (canon §EL RITMO, §EL CAMINO CANON).
  # Este bloquea por NO DECLARAR, no por salirse del rango: el rango de afuera es referencia,
  # no un óptimo medido aquí.
  python3 "$ROOT/scripts/ritmo-pieza.py" "$ID" --escribir || return 1
}

case "$PASO" in
  salud)     paso_salud ;;
  ritmo)     paso_ritmo ;;
  voz)       paso_voz ;;
  entrega)   paso_entrega ;;
  subs)      paso_subs ;;
  render)    paso_render ;;
  ensamble)  paso_ensamble ;;
  capsula)   paso_capsula ;;
  campo)     paso_campo ;;
  verificar) paso_verificar ;;
  publicar)  paso_publicar ;;
  subir)     paso_subir "$@" ;;
  programar) paso_programar ;;
  cosechar)  paso_cosechar ;;
  todo)      paso_salud && paso_ritmo && paso_voz && paso_campo && paso_subs && paso_render && paso_ensamble && paso_verificar && paso_capsula && paso_entrega && echo "✔ $ID LISTO (publicar aparte)" ;;
  *) echo "paso inválido: $PASO (salud|ritmo|voz|subs|render|ensamble|verificar|capsula|publicar|subir|programar|cosechar|todo)"; exit 2 ;;
esac
