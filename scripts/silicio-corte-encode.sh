#!/bin/bash
# silicio-corte-encode.sh — etapa C del corte definitivo: NVENC 10-bit + captions.
# Uso: bash scripts/silicio-corte-encode.sh [quick]
set -euo pipefail
cd "$(dirname "$0")/.."
D=dist-video/silicio-corte
FPS=24
INTER_THIN=/usr/share/fonts/opentype/inter/Inter-Thin.otf
INTER_MED=/usr/share/fonts/opentype/inter/Inter-Medium.otf
QUICK=${1:-}

# actos en segundos (fracciones 0.32/0.64/0.95 del guion × duración)
if [ "$QUICK" = "quick" ]; then DUR=15; else DUR=44; fi
T1=$(python3 -c "print(f'{0.32*$DUR:.2f}')")
T2=$(python3 -c "print(f'{0.64*$DUR:.2f}')")
T3=$(python3 -c "print(f'{0.95*$DUR:.2f}')")

# tamaños relativos al alto (quick 1280 vs full 3840)
if [ "$QUICK" = "quick" ]; then BIG=64; SUB=30; CAP=26; MX=50; MY1=200; MY2=120; MYC=290
else BIG=190; SUB=88; CAP=76; MX=150; MY1=600; MY2=360; MYC=870; fi

# captions: corte seco entre actos (doctrina), brand persistente desde 2.4s
VF="drawtext=fontfile=$INTER_THIN:text='El silicio':fontcolor=white:fontsize=$BIG:x=$MX:y=h-$MY1:enable='gte(t,2.4)',\
drawtext=fontfile=$INTER_MED:text='dopado · ab initio':fontcolor=0x7ce8ff:fontsize=$SUB:x=$MX:y=h-$MY2:enable='gte(t,2.4)',\
drawtext=fontfile=$INTER_MED:text='la carga que se movió al unirse — el enlace':fontcolor=white@0.92:fontsize=$CAP:x=(w-text_w)/2:y=h-$MYC:enable='between(t,1.0,$T1)',\
drawtext=fontfile=$INTER_MED:text='cambiamos UN átomo — la carga que sobra':fontcolor=white@0.92:fontsize=$CAP:x=(w-text_w)/2:y=h-$MYC:enable='between(t,$T1,$T2)',\
drawtext=fontfile=$INTER_MED:text='el electrón libre — densidad de espín':fontcolor=white@0.92:fontsize=$CAP:x=(w-text_w)/2:y=h-$MYC:enable='between(t,$T2,$T3)'"

# master HEVC 10-bit (NVENC) + entrega h264
ffmpeg -v error -framerate $FPS -i "$D/f%05d.png" -vf "$VF" \
  -c:v hevc_nvenc -preset p5 -rc vbr -cq 19 -b:v 0 -pix_fmt yuv420p10le \
  -y "$D/silicio-corte-916-hevc10.mp4"
ffmpeg -v error -framerate $FPS -i "$D/f%05d.png" -vf "$VF" \
  -c:v h264_nvenc -preset p5 -rc vbr -cq 21 -b:v 0 -pix_fmt yuv420p \
  -y "$D/silicio-corte-916.mp4"
ls -la "$D"/silicio-corte-916*.mp4 | awk '{print $5" bytes  "$9}'
echo "ENCODE_OK"
