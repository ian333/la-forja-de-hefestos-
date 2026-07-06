#!/bin/bash
# atencion-batch.sh — CORRE EN PRIME: recorre toda la biblioteca y hace que
# IANGPU califique cada video con atencion-verify.py (economía de atención).
# Resumable: salta los que ya tienen JSON en iangpu. Suave con sshd (secuencial).
# Salida: iangpu:$F/dist-video/atencion/<familia__archivo>.json
set -u
IAN=ian@100.65.173.85
F=/home/ian/Orkesta/la-forja
LOG=/home/ian/atencion-batch.log
echo "== batch atencion inicio $(date)" >> "$LOG"
ssh -o ConnectTimeout=15 $IAN "mkdir -p $F/dist-video/atencion"
tot=$(find /mnt/hdd/biblioteca -name '*.mp4' | grep -cvE '_archivo|_masters|_code')
n=0
find /mnt/hdd/biblioteca -name '*.mp4' | grep -vE '_archivo|_masters|_code' | sort | while IFS= read -r v; do
  n=$((n+1))
  rel=${v#/mnt/hdd/biblioteca/}
  id=$(printf '%s' "$rel" | tr '/ ' '__' | sed 's/\.mp4$//')
  # OJO: ssh/rsync DENTRO de while-read deben llevar -n / </dev/null — si no,
  # se COMEN el stdin (la lista de videos) y el loop muere tras el primer item
  if ssh -n -o ConnectTimeout=15 $IAN "test -f $F/dist-video/atencion/$id.json" 2>/dev/null; then continue; fi
  echo "[$n/$tot] $rel $(date +%H:%M:%S)" >> "$LOG"
  if ! rsync -a --timeout=300 "$v" "$IAN:/dev/shm/atencion-in.mp4" < /dev/null; then
    echo "  rsync FAIL: $rel" >> "$LOG"; sleep 10; continue
  fi
  ssh -n -o ConnectTimeout=15 -o ServerAliveInterval=30 $IAN \
    "TMPDIR=/dev/shm python3 $F/scripts/atencion-verify.py /dev/shm/atencion-in.mp4 --json $F/dist-video/atencion/$id.json >/dev/null 2>&1; rm -f /dev/shm/atencion-in.mp4" \
    || echo "  verify FAIL: $rel" >> "$LOG"
done
echo "== BATCH TERMINADO $(date)" >> "$LOG"
