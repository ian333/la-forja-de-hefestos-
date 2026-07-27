#!/bin/bash
# render-li2.sh — Dilitio 9:16 · render frames GPU + mux voz + quemar subtítulos + entregar.
# Uso:  DPR=1 bash scripts/render-li2.sh   (1080, rápido)
#       DPR=2 bash scripts/render-li2.sh   (4K 10-bit, entregable)
# Sirve contra vite preview (build fresco) en :4173. Voz+ASS ya generados en dist-video/li2-narracion.
set -e
D=/home/ian/Orkesta/la-forja
DPR=${DPR:-1}
FPS=${FPS:-30}
BASE=${BASE_URL:-http://localhost:4173}
NARR="$D/dist-video/li2-narracion/li2-narracion.mp3"
if [ "$DPR" = "2" ]; then
  ASS="$D/dist-video/li2-narracion/li2-4k.ass"
  SILENT="$D/dist-video/LI2-DILITIO-916-4K.mp4"
  VOZ="$D/dist-video/LI2-DILITIO-916-4K-VOZ.mp4"
  VENC=(-c:v hevc_nvenc -preset p7 -pix_fmt yuv420p10le -b:v 40M)
  FRAMES=/dev/shm/li2clip4k
else
  ASS="$D/dist-video/li2-narracion/li2.ass"
  SILENT="$D/dist-video/LI2-DILITIO-916-1080.mp4"
  VOZ="$D/dist-video/LI2-DILITIO-916-1080-VOZ.mp4"
  VENC=(-c:v h264_nvenc -preset p7 -cq 20 -pix_fmt yuv420p)
  FRAMES=/dev/shm/li2clip1080
fi
echo "=== [1/3] render frames + mp4 silente (DPR=$DPR, $FPS fps, 44s) ==="
DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
  MOL=li2 DPR=$DPR FPS=$FPS T0=0 T1=44 BATCH=75 BASE_URL=$BASE \
  FRAMES_DIR=$FRAMES OUT="$SILENT" node "$D/scripts/o2-clip.cjs"
echo "=== [2/3] mux voz + quemar subtítulos ($(basename "$ASS")) ==="
ffmpeg -y -i "$SILENT" -i "$NARR" -vf "subtitles=$ASS" \
  -map 0:v -map 1:a "${VENC[@]}" -c:a aac -b:a 192k "$VOZ" 2>&1 | tail -3 || true
echo "=== [3/3] entregar a iangpu Downloads ==="
cp "$VOZ" /mnt/c/Users/sebas/Downloads/ 2>/dev/null && echo "→ /mnt/c/Users/sebas/Downloads/$(basename "$VOZ")"
ffprobe -v error -select_streams v -show_entries stream=width,height,nb_frames -show_entries format=duration -of default=nw=1 "$VOZ" 2>/dev/null
echo "DONE: $VOZ ($(du -h "$VOZ" | cut -f1))"
