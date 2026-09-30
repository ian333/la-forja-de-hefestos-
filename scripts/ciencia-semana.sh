#!/bin/bash
# Ciencia 1 al día (ian 09-29 «SUBE 1 de ciencia»): master desde E: por symlink → biblioteca → reel → cola de PRIME → YouTube.
cd /home/ian/Orkesta/la-forja; PY=/home/ian/pub-venv/bin/python; LOG=dist-video/ciencia-semana.log
log(){ echo "$(date '+%m-%d %H:%M') $*" | tee -a $LOG; }
for id in atomo-ne atomo-si atomo-c; do
  M=dist-video/masters/$id-4k.mp4; [ -e $M ] || ln -s /mnt/e/forja-videos/$id-4k.mp4 $M
  [ -s $M ] || { log "✗ $id: sin master"; continue; }
  C=$(python3 -c "import json;print(json.load(open('videos/$id.json'))['publicar']['programar'])")
  bash scripts/video.sh $id publicar >> $LOG 2>&1 || log "⚠ $id: publicar con avisos"
  python3 scripts/reels-1080.py $id --subir >> $LOG 2>&1 && python3 scripts/cola-publicar.py armar $id >> $LOG 2>&1 && log "✓ $id: Instagram armado para $C" || log "✗ $id: Instagram NO armado"
  $PY scripts/subir-youtube.py $id --publico --programar "$C" >> $LOG 2>&1 && log "✓ $id: YouTube programado $C" || log "⏳ $id: YouTube pendiente (cuota) — reintentar: $PY scripts/subir-youtube.py $id --publico --programar $C"
done
