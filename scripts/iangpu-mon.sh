#!/bin/bash
# iangpu-mon.sh — TELEMETRÍA del host WINDOWS de iangpu por la puerta SSH.
# Lee nvidia-smi + RAM del HOST (funciona aunque WSL esté colgado → cero punto ciego).
# Sirve para vigilar VRAM/temp DURANTE un render y abortar ANTES de que sature/reviente.
#
# Uso:  bash scripts/iangpu-mon.sh            (loop cada 6s, imprime + loguea)
#       INT=4 VRAM_WARN=10000 bash scripts/iangpu-mon.sh
IP=${IP:-100.116.134.86}
INT=${INT:-6}
LOG=${LOG:-/tmp/iangpu-mon.log}
VRAM_WARN=${VRAM_WARN:-10800}   # MB — 4070Ti tiene 12282; >10.8G = zona de peligro
TEMP_WARN=${TEMP_WARN:-83}
MISS=0
echo "# iangpu-mon $(date -u +%FT%TZ)  host=$IP  int=${INT}s  VRAM_WARN=${VRAM_WARN}MB" | tee -a "$LOG"
while true; do
  ts=$(date +%H:%M:%S)
  gpu=$(ssh -o ConnectTimeout=8 -o BatchMode=yes sebas@"$IP" \
    'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits' 2>/dev/null | tr -d '\r' | head -1)
  if [ -z "$gpu" ]; then
    MISS=$((MISS+1))
    msg="$ts  ⚠ sin respuesta del host Windows (intento $MISS)"
    echo "$msg" | tee -a "$LOG"
  else
    MISS=0
    IFS=',' read -r util vused vtot temp pwr <<< "$gpu"
    util=${util// /}; vused=${vused// /}; vtot=${vtot// /}; temp=${temp// /}; pwr=${pwr// /}
    flag=""
    [ "$vused" -gt "$VRAM_WARN" ] 2>/dev/null && flag="$flag ⚠VRAM-ALTA"
    [ "$temp" -gt "$TEMP_WARN" ] 2>/dev/null && flag="$flag ⚠TEMP-ALTA"
    pct=$(( vused * 100 / vtot ))
    msg="$ts  GPU ${util}%  VRAM ${vused}/${vtot}MB (${pct}%)  ${temp}°C  ${pwr}W$flag"
    echo "$msg" | tee -a "$LOG"
  fi
  sleep "$INT"
done
