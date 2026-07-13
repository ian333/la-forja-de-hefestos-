#!/bin/bash
# PARRILLA de producción de la Escuela de Mecánica — resumable.
# Por lección: voz (si falta) → drive con 3 reintentos → 4K → Downloads.
# Uso (iangpu): bash scripts/escuela/parrilla.sh [leccion1 leccion2 ...]
cd /home/ian/Orkesta/la-forja || exit 1

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
)
LECCIONES=("$@")
[ ${#LECCIONES[@]} -eq 0 ] && LECCIONES=(mec-u2-l1 mec-u2-l2 mec-u3-l1 mec-u3-l6 mec-u3-l7 mec-u4-l2)

for L in "${LECCIONES[@]}"; do
  echo "════════ $L ════════"
  # VOZ — solo si faltan WAVs (resumable).
  NW=$(ls "dist-video/$L-narracion/"*.wav 2>/dev/null | wc -l)
  NL=$(grep -c . "scripts/guiones/$L.txt")
  if [ "$NW" -lt "$NL" ]; then
    /home/ian/tts-venv/bin/python scripts/narracion-gen.py "$L" 2>&1 | tail -2
  else
    echo "voz: ya existe ($NW wavs)"
  fi
  # DRIVE con reintentos (recargas fantasma de la VM → exit≠0 → reintento).
  OK=0
  for t in 1 2 3; do
    echo "=== $L INTENTO $t ==="
    NODE_PATH=/home/ian/Orkesta/la-forja/node_modules \
    DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
    PACE=1.35 URL="${PARRILLA_URL:-http://localhost:5001/forja-brep.html}" \
      node scripts/escuela/clase-drive.cjs "public/escuela/lecciones/$L.json" \
        "dist-video/$L-narracion" "dist-video/escuela/$L-v1" && { OK=1; break; }
    sleep 6
  done
  if [ "$OK" = "1" ]; then
    node scripts/escuela/ensamblar-clase.cjs "dist-video/escuela/$L-v1" \
      "dist-video/$L-narracion" "dist-video/escuela/${NOMBRE[$L]}.mp4" 2>&1 | tail -1
    cp "dist-video/escuela/${NOMBRE[$L]}.mp4" /mnt/c/Users/sebas/Downloads/ && echo "ENTREGADO ${NOMBRE[$L]}"
  else
    echo "✗✗ $L NO PASÓ — requiere iteración"
  fi
done
echo PARRILLA_FIN
