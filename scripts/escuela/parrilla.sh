#!/bin/bash
# PARRILLA de producción de la Escuela de Mecánica — resumable.
# Por lección: voz (si falta) → drive con 3 reintentos → 4K → entrega E: + PRIME.
# Uso (iangpu): bash scripts/escuela/parrilla.sh [leccion1 leccion2 ...]
#
# Variables opcionales:
#   PARRILLA_ROOT     raíz del repo dueño (hay más de un checkout en iangpu).
#   PARRILLA_URL      URL de forja-brep.html (default http://localhost:5001/…).
#   PARRILLA_REDO=1   re-hace drive+4K aunque el mp4 final ya exista (por default,
#                     si el mp4 existe se salta a entrega+rastro: reanudable).
#   ENTREGA_ROOT      raíz en E: de iangpu (default /mnt/e/forja-videos).
#   ENTREGA_SUB       taxonomía bajo la raíz (default escuela/bethune/U02).
#   PRIME_HOST        nodo PRIME (default ian@100.110.244.20); PRIME_ROOT=/mnt/hdd/forja-videos.
#   WIN_SSH           sshd de Windows de iangpu para cuando /mnt/e da Input/output
#                     error (default sebas@100.116.134.86 → E:/forja-videos/…).
#   SUPERTICKET_SLUG  si viene, cada lección deja rastro para Temis en
#                     public/evidencia/<slug>/resultados.json (fusionado) +
#                     public/evidencia/<slug>/01-<id>-still.jpg (frame al 40%).
#   PARRILLA_SOLO_FUNCIONES=1  al hacer `source`, define las funciones y regresa
#                     (para probarlas sin correr la parrilla).
cd "${PARRILLA_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}" || exit 1
ROOT="$PWD"

declare -A NOMBRE=(
  [mec-u2-l1]="ESCUELA-MECANICA-U2L1-tuerca-hexagonal-4K"
  [mec-u2-l2]="ESCUELA-MECANICA-U2L2-biela-del-examen-4K"
  [mec-u3-l1]="ESCUELA-MECANICA-U3L1-angulo-de-salida-4K"
  [mec-u3-l6]="ESCUELA-MECANICA-U3L6-el-vaciado-4K"
  [mec-u3-l7]="ESCUELA-MECANICA-U3L7-el-resorte-4K"
  [mec-u4-l2]="ESCUELA-MECANICA-U4L2-plano-de-taller-4K"
  [mec-u4-l1]="ESCUELA-MECANICA-U4L1-proyeccion-ortografica-4K"
  [mec-u2-l4]="ESCUELA-MECANICA-U2L4-redondeos-de-boceto-4K"
  [mec-u2-l6]="ESCUELA-MECANICA-U2L6-la-brida-4K"
  [mec-u3-l3]="ESCUELA-MECANICA-U3L3-redondeo-3D-4K"
  [mec-u3-l5]="ESCUELA-MECANICA-U3L5-el-embudo-loft-4K"
  [mec-u11-l1]="ESCUELA-MECANICA-U11L1-cubo-contrarreloj-4K"
  [mec-u11-l2]="ESCUELA-MECANICA-U11L2-tecnica-del-examen-4K"
  [mec-u2-l5]="ESCUELA-MECANICA-U2L5-recortar-4K"
  [mec-u9-l1]="ESCUELA-MECANICA-U9L1-el-buje-4K"
  [mec-u10-l1]="ESCUELA-MECANICA-U10L1-engrane-a-tu-medida-4K"
  [mec-u4-l3]="ESCUELA-MECANICA-U4L3-ver-por-dentro-4K"
  [mec-u3-l8]="ESCUELA-MECANICA-U3L8-edita-la-historia-4K"
  [mec-u5-l1]="ESCUELA-MECANICA-U5L1-tu-primer-ensamble-4K"
  [mec-u10-l3]="ESCUELA-MECANICA-U10L3-relacion-de-transmision-4K"
  [mec-u10-l4]="ESCUELA-MECANICA-U10L4-transmitir-potencia-4K"
  [mec-u6-l1]="ESCUELA-MECANICA-U6L1-la-rosca-4K"
  [mec-u9-l2]="ESCUELA-MECANICA-U9L2-el-ajuste-4K"
  [mec-u3-l2]="ESCUELA-MECANICA-U3L2-el-costillado-4K"
  [mec-u9-l3]="ESCUELA-MECANICA-U9L3-el-apriete-4K"
  [mec-sim-l1]="ESCUELA-MECANICA-SIM1-aguanta-o-se-rompe-FEA-4K"
  [mec-u6-l2]="ESCUELA-MECANICA-U6L2-broca-para-machuelo-4K"
  [mec-u6-l4]="ESCUELA-MECANICA-U6L4-par-de-apriete-4K"
  [mec-u6-l5]="ESCUELA-MECANICA-U6L5-el-opresor-4K"
  [mec-u10-l5]="ESCUELA-MECANICA-U10L5-fusible-mecanico-4K"
  [mec-u8-l1]="ESCUELA-MECANICA-U8L1-tolerancias-mas-menos-4K"
  [mec-u8-l4]="ESCUELA-MECANICA-U8L4-ajuste-H7g6-4K"
  [mec-u2-l3]="ESCUELA-MECANICA-U2L3-llave-del-13-4K"
  [mec-u7-l1]="ESCUELA-MECANICA-U7L1-la-cota-es-una-orden-4K"
  [mec-u7-l2]="ESCUELA-MECANICA-U7L2-baseline-error-no-se-apila-4K"
  [mec-u8-l2]="ESCUELA-MECANICA-U8L2-tolerancia-angular-4K"
  [mec-u8-l3]="ESCUELA-MECANICA-U8L3-estudio-de-tolerancias-4K"
  [mec-u7-l3]="ESCUELA-MECANICA-U7L3-lenguaje-del-barreno-4K"
  [mec-u7-l4]="ESCUELA-MECANICA-U7L4-escala-unidades-redondeos-4K"
  # SUPERTICKET MOLDES (2026-08-26): los 3 sprints de la Máquina de TU pieza — se
  # entregan con ENTREGA_SUB=escuela/moldes (no en bethune/U02)
  [mol-s1-llenado-por-pieza]="LA-FORJA-MOLDES-S1-tu-pieza-se-llena-4K"
  [mol-s2-intake]="LA-FORJA-MOLDES-S2-declara-tu-pieza-4K"
  [mol-s3-base-catalogo]="LA-FORJA-MOLDES-S3-la-base-se-compra-4K"
  [mec-u7-l5]="ESCUELA-MECANICA-U7L5-taquigrafia-del-plano-4K"
  [mec-u5-l2]="ESCUELA-MECANICA-U5L2-bottom-up-4K"
  [mec-u5-l3]="ESCUELA-MECANICA-U5L3-vista-explosionada-4K"
  [mec-u5-l4]="ESCUELA-MECANICA-U5L4-el-BOM-4K"
  [mec-u5-l5]="ESCUELA-MECANICA-U5L5-el-cajetin-4K"
  [mec-u5-l6]="ESCUELA-MECANICA-U5L6-motion-study-4K"
  [mec-u4-l4]="ESCUELA-MECANICA-U4L4-vista-de-detalle-4K"
  [mec-u4-l5]="ESCUELA-MECANICA-U4L5-primer-angulo-4K"
  [mec-u8-l5]="ESCUELA-MECANICA-U8L5-Ra-la-piel-de-la-pieza-4K"
  [mec-u8-l6]="ESCUELA-MECANICA-U8L6-GDT-planitud-4K"
  [mec-u8-l7]="ESCUELA-MECANICA-U8L7-GDT-datums-4K"
  [mec-u8-l8]="ESCUELA-MECANICA-U8L8-GDT-posicion-MMC-4K"
  [mec-u10-l6]="ESCUELA-MECANICA-U10L6-pinon-cremallera-4K"
  [mec-u6-l3]="ESCUELA-MECANICA-U6L3-biblioteca-DIN-4K"
  [mec-u7-l6]="ESCUELA-MECANICA-U7L6-la-vista-completa-4K"
  [mec-u11-l3]="ESCUELA-MECANICA-U11L3-examen-forjador-4K"
  [a1-l1]="ESCUELA-AERO-U1L1-las-dos-manos-del-aire-4K"
  [a1-l4]="ESCUELA-AERO-U1L4-la-atmosfera-estandar-4K"
)

ENTREGA_ROOT="${ENTREGA_ROOT:-/mnt/e/forja-videos}"
ENTREGA_SUB="${ENTREGA_SUB:-escuela/bethune/U02}"
PRIME_HOST="${PRIME_HOST:-ian@100.110.244.20}"
PRIME_ROOT="${PRIME_ROOT:-/mnt/hdd/forja-videos}"
WIN_SSH="${WIN_SSH:-sebas@100.116.134.86}"

# ── checks n/N de un meta.json del drive (pasos con check / los que pasaron).
checks_de_meta() {  # $1 = dir del drive (…/escuela/<id>-v1)
  local m="$1/meta.json"
  [ -f "$m" ] || { echo "0/0"; return 1; }
  node -e '
    const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const c = (m.pasos || []).filter((p) => p.check);
    console.log(c.filter((p) => p.check.pass).length + "/" + c.length);
  ' "$m"
}

# ── still JPG de un mp4: frame al 90% de la duración (PARRILLA_STILL_FRAC; el 40% caía
#    a medio croquis, cazado por el juez con ojos: la evidencia pide el SÓLIDO terminado),
#    ≤1400 px de ancho, -q:v 5.
still_de_mp4() {  # $1 = mp4  $2 = out.jpg
  local mp4="$1" out="$2" dur t
  dur=$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$mp4" 2>/dev/null)
  [ -n "$dur" ] || { echo "still: ffprobe sin duración para $mp4"; return 1; }
  t=$(awk -v d="$dur" -v f="${PARRILLA_STILL_FRAC:-0.9}" 'BEGIN{printf "%.3f", d*f}')
  mkdir -p "$(dirname "$out")"
  ffmpeg -y -loglevel error -ss "$t" -i "$mp4" -frames:v 1 \
    -vf "scale='min(1400,iw)':-2" -q:v 5 "$out" && echo "still: $out (t=${t}s de ${dur}s)"
}

# ── still JPG desde un PNG (para rojos sin mp4: el último paso_*.png del drive).
still_de_png() {  # $1 = png  $2 = out.jpg
  mkdir -p "$(dirname "$2")"
  ffmpeg -y -loglevel error -i "$1" -vf "scale='min(1400,iw)':-2" -q:v 5 "$2" && echo "still: $2 (de $(basename "$1"))"
}

# ── fusiona {"<id>":{…}} en public/evidencia/<slug>/resultados.json (lo que haya se conserva).
resultado_superticket() {  # $1 slug $2 id $3 estado $4 checks $5 video $6 still $7 nota
  local dir="$ROOT/public/evidencia/$1" f
  mkdir -p "$dir"; f="$dir/resultados.json"
  node -e '
    const fs = require("fs");
    const [f, id, estado, checks, video, still, nota] = process.argv.slice(1);
    let cur = {};
    if (fs.existsSync(f)) {
      try { cur = JSON.parse(fs.readFileSync(f, "utf8")) || {}; }
      catch (e) { console.log("resultados.json ilegible, se reescribe: " + e.message); cur = {}; }
    }
    cur[id] = { estado, checks, video, still, nota };
    fs.writeFileSync(f, JSON.stringify(cur, null, 2) + "\n");
    console.log(`RASTRO ${f} ← ${id}: ${estado} ${checks}`);
  ' "$f" "$2" "$3" "$4" "$5" "$6" "$7"
}

# ── entrega con taxonomía: E: de iangpu (cp; si drvfs da EIO → scp al sshd de
#    Windows) + PRIME. Deja el resultado en dos globales (NO llamar en $(…)):
#    ENTREGA_FINAL = ruta final en E: (vacía si nada llegó) · ENTREGA_NOTA = detalle.
entregar() {  # $1 = mp4 local  $2 = nombre (sin .mp4)
  local mp4="$1" nombre="$2" dest="$ENTREGA_ROOT/$ENTREGA_SUB" final="" via=""
  ENTREGA_NOTA=""; ENTREGA_FINAL=""
  if timeout 30 mkdir -p "$dest" 2>/dev/null && timeout 900 cp "$mp4" "$dest/$nombre.mp4" 2>/dev/null; then
    final="$dest/$nombre.mp4"; via="E: cp"
  else
    echo "  /mnt/e no responde (EIO/timeout) → scp por sshd de Windows ($WIN_SSH)" >&2
    local winsub="${ENTREGA_SUB//\//\\}"
    ssh -o ConnectTimeout=15 "$WIN_SSH" "mkdir \"E:\\forja-videos\\$winsub\"" >/dev/null 2>&1 || true
    if scp -o ConnectTimeout=15 "$mp4" "$WIN_SSH:E:/forja-videos/$ENTREGA_SUB/$nombre.mp4" >&2; then
      final="E:/forja-videos/$ENTREGA_SUB/$nombre.mp4"; via="E: scp-win"
    else
      via="E: FALLÓ (cp y scp-win)"
    fi
  fi
  if ssh -o ConnectTimeout=15 "$PRIME_HOST" "mkdir -p '$PRIME_ROOT/$ENTREGA_SUB'" >&2 \
     && scp -o ConnectTimeout=15 "$mp4" "$PRIME_HOST:$PRIME_ROOT/$ENTREGA_SUB/$nombre.mp4" >&2; then
    via="$via · PRIME ok"
  else
    via="$via · PRIME FALLÓ"
  fi
  ENTREGA_NOTA="$via"; ENTREGA_FINAL="$final"
  echo "  ENTREGA $nombre → ${final:-(sin E:)} [$via]"
  [ -n "$final" ]
}

[ "${PARRILLA_SOLO_FUNCIONES:-0}" = "1" ] && return 0 2>/dev/null

LECCIONES=("$@")
[ ${#LECCIONES[@]} -eq 0 ] && LECCIONES=(mec-u2-l1 mec-u2-l2 mec-u3-l1 mec-u3-l6 mec-u3-l7 mec-u4-l2)

for L in "${LECCIONES[@]}"; do
  echo "════════ $L ════════"
  if [ -z "${NOMBRE[$L]}" ]; then echo "✗✗ $L sin NOMBRE en el mapa — agrégalo"; continue; fi
  DRV="dist-video/escuela/$L-v1"
  MP4="dist-video/escuela/${NOMBRE[$L]}.mp4"
  # VOZ — solo si faltan WAVs (resumable).
  NW=$(ls "dist-video/$L-narracion/"*.wav 2>/dev/null | wc -l)
  NL=$(grep -c . "scripts/guiones/$L.txt")
  if [ "$NW" -lt "$NL" ]; then
    /home/ian/tts-venv/bin/python scripts/narracion-gen.py "$L" 2>&1 | tail -2
  else
    echo "voz: ya existe ($NW wavs)"
  fi
  OK=0; INTENTO=0
  if [ -s "$MP4" ] && [ "${PARRILLA_REDO:-0}" != "1" ]; then
    echo "4K: ya existe $MP4 — salto a entrega (PARRILLA_REDO=1 para rehacer)"
    OK=1
  else
    # DRIVE con reintentos (recargas fantasma de la VM → exit≠0 → reintento).
    for t in 1 2 3; do
      echo "=== $L INTENTO $t ==="
      INTENTO=$t
      NODE_PATH=/home/ian/Orkesta/la-forja/node_modules \
      DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
      PACE=1.35 URL="${PARRILLA_URL:-http://localhost:5001/forja-brep.html}" \
        node scripts/escuela/clase-drive.cjs "public/escuela/lecciones/$L.json" \
          "dist-video/$L-narracion" "$DRV" && { OK=1; break; }
      sleep 6
    done
    if [ "$OK" = "1" ]; then
      rm -f "$MP4"
      node scripts/escuela/ensamblar-clase.cjs "$DRV" "dist-video/$L-narracion" "$MP4" 2>&1 | tail -1
      [ -s "$MP4" ] || { echo "✗✗ $L ensamble 4K FALLÓ (no existe $MP4)"; OK=0; ENSAMBLE_FALLO=1; }
    fi
  fi
  CHECKS=$(checks_de_meta "$DRV")
  if [ "$OK" = "1" ]; then
    entregar "$MP4" "${NOMBRE[$L]}"; FINAL="$ENTREGA_FINAL"
    NOTA="drive OK${INTENTO:+ (intento $INTENTO)} · checks $CHECKS · $ENTREGA_NOTA"
    [ "$INTENTO" = "0" ] && NOTA="mp4 previo reutilizado · checks $CHECKS · $ENTREGA_NOTA"
    ESTADO=verde
  else
    if [ "${ENSAMBLE_FALLO:-0}" = "1" ]; then NOTA="drive OK pero ensamble 4K falló · checks $CHECKS"
    else NOTA="drive NO PASÓ en $INTENTO intentos · checks $CHECKS$( [ -f "$DRV/meta.json" ] && node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(m.fatal) console.log(" · FATAL: "+m.fatal.split("\n")[0].slice(0,80))' "$DRV/meta.json")"; fi
    FINAL=""; ESTADO=rojo
    echo "✗✗ $L NO PASÓ — requiere iteración"
  fi
  unset ENSAMBLE_FALLO
  # RASTRO para Temis (superticket): resultados.json fusionado + still.
  if [ -n "$SUPERTICKET_SLUG" ]; then
    STILL_REL="evidencia/$SUPERTICKET_SLUG/01-$L-still.jpg"
    STILL_ABS="$ROOT/public/$STILL_REL"
    if [ "$ESTADO" = "verde" ]; then
      still_de_mp4 "$MP4" "$STILL_ABS" || STILL_REL=""
    else
      ULT=$(ls -t "$DRV"/paso_*.png 2>/dev/null | head -1)
      if [ -n "$ULT" ]; then still_de_png "$ULT" "$STILL_ABS" || STILL_REL=""; else STILL_REL=""; fi
    fi
    resultado_superticket "$SUPERTICKET_SLUG" "$L" "$ESTADO" "$CHECKS" "${FINAL:-$( [ "$ESTADO" = verde ] && echo "$ROOT/$MP4")}" "$STILL_REL" "$NOTA"
  fi
done
echo PARRILLA_FIN
