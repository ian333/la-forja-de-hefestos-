#!/bin/bash
# caro-peek.sh — CORRE EN IANGPU: reinicia vite (bustea cache, watch está off por el
# RIAN daemon que agota inotify) y saca stills del caroteno. Uso: bash caro-peek.sh "6,16,26,40" nombre
set -u
F=/home/ian/Orkesta/la-forja
TIMES=${1:-6,16,26,40}
NAME=${2:-caro}
cd "$F" || exit 1
fuser -k 5010/tcp 2>/dev/null; sleep 2
DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA VITE_NO_WATCH=1 \
  setsid npx vite --port 5010 --host >/tmp/vite-caro.log 2>&1 &
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5010/cinematic-molecule.html 2>/dev/null)
  [ "$code" = "200" ] && break; sleep 2
done
DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
  MOL=caroteno TIMES="$TIMES" NAME="$NAME" W=540 H=960 BASE_URL=http://localhost:5010 \
  node scripts/peek.cjs 2>&1 | tail -8
echo "STILLS EN: $F/dist-video/.peek/"
