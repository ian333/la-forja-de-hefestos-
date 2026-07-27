#!/bin/bash
# render-li2-16x9.sh — Dilitio HORIZONTAL 16:9 4K · render frames GPU + mux voz + subs + entregar.
# 16:9 4K = W=1920 H=1080 DPR=2 → 3840×2160 (el engine detecta vertical=false por aspecto).
# Uso:  bash scripts/render-li2-16x9.sh
set -e
D=/home/ian/Orkesta/la-forja
FPS=${FPS:-30}
BASE=${BASE_URL:-http://localhost:4173}
NARR="$D/dist-video/li2-narracion/li2-narracion.mp3"
ASS="$D/dist-video/li2-narracion/li2-16x9.ass"
SILENT="$D/dist-video/LI2-DILITIO-16x9-4K.mp4"
VOZ="$D/dist-video/LI2-DILITIO-16x9-4K-VOZ.mp4"
FRAMES=/dev/shm/li2clip16x9
echo "=== [1/3] render frames 16:9 4K (3840×2160, $FPS fps, 44s) ==="
DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
  MOL=li2 W=1920 H=1080 DPR=2 FPS=$FPS T0=0 T1=44 BATCH=75 BASE_URL=$BASE \
  FRAMES_DIR=$FRAMES OUT="$SILENT" node "$D/scripts/o2-clip.cjs"
echo "=== [2/3] mux voz + quemar subtítulos (li2-16x9.ass) ==="
ffmpeg -y -i "$SILENT" -i "$NARR" -vf "subtitles=$ASS" \
  -map 0:v -map 1:a -c:v hevc_nvenc -preset p7 -pix_fmt yuv420p10le -b:v 40M \
  -c:a aac -b:a 192k "$VOZ" 2>&1 | tail -3 || true
echo "=== [3/3] entregar a iangpu Downloads ==="
cp "$VOZ" /mnt/c/Users/sebas/Downloads/ 2>/dev/null && echo "→ /mnt/c/Users/sebas/Downloads/$(basename "$VOZ")"
ffprobe -v error -select_streams v -show_entries stream=width,height,nb_frames -of default=nw=1 "$VOZ" 2>/dev/null
echo "DONE: $VOZ ($(du -h "$VOZ" | cut -f1))"
