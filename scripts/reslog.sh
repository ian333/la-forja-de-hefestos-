#!/usr/bin/env bash
# reslog.sh — log de recursos de iangpu para diagnosticar reinicios bajo carga.
# Escribe CSV en /home/ian/iangpu-reslog.csv (DISCO, sobrevive reboot) y hace
# sync() cada línea → la ÚLTIMA línea antes de un crash captura las condiciones
# del reinicio (temp/potencia/VRAM/RAM al momento de caer). Cadencia ~5s.
#   GPU vía nvidia-smi de WSL; CPU/RAM vía vmstat/free.
set +e
NVSMI=/usr/lib/wsl/lib/nvidia-smi
[ -x "$NVSMI" ] || NVSMI=/mnt/c/Windows/System32/nvidia-smi.exe
OUT=/home/ian/iangpu-reslog.csv
COASE=/home/ian/Orkesta/la-forja/dist-video/clase-coase
[ -f "$OUT" ] || echo "ts,gpu_temp_C,gpu_power_W,gpu_plimit_W,gpu_util,vram_used_MB,vram_total_MB,sm_clk_MHz,cpu_idle,mem_used_MB,mem_total_MB,f916,f169,uptime_s" >> "$OUT"
# marca de arranque (un reboot deja un hueco temporal + uptime bajo en la línea)
echo "# BOOT $(date '+%F %T') uptime=$(awk '{print int($1)}' /proc/uptime)s" >> "$OUT"; sync
while true; do
  ts=$(date '+%F %T')
  g=$("$NVSMI" --query-gpu=temperature.gpu,power.draw,power.limit,utilization.gpu,memory.used,memory.total,clocks.sm --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d ' ')
  [ -z "$g" ] && g=",,,,,,"
  ci=$(vmstat 1 1 2>/dev/null | tail -1 | awk '{print $15}')
  m=$(free -m 2>/dev/null | awk '/Mem:/{print $3","$2}')
  f9=$(ls "$COASE/frames-916/" 2>/dev/null | wc -l)
  f1=$(ls "$COASE/frames-169/" 2>/dev/null | wc -l)
  up=$(awk '{print int($1)}' /proc/uptime)
  echo "$ts,$g,$ci,$m,$f9,$f1,$up" >> "$OUT"
  sync
  sleep 4
done
