#!/bin/bash
# Fábrica de átomos: espera a que la pasada v4 termine (GPU) y produce cada átomo con el pipeline canónico (video.sh todo),
# uno a la vez; el master queda en dist-video/masters y la entrega en E:/Downloads de iangpu. NO publica.
cd /home/ian/Orkesta/la-forja; LOG=dist-video/fabrica-atomos.log
log(){ echo "$(date '+%m-%d %H:%M') $*" >> $LOG; }
until grep -qE "pasada terminada|FIN rerender" dist-video/rerender-don-chuy.log 2>/dev/null || ! pgrep -f "rerender-don-chuy.sh" >/dev/null; do sleep 120; done
log "arranca la fábrica (GPU libre)"
for id in atomo-cl atomo-mg atomo-n atomo-f; do
  [ -s dist-video/masters/$id-4k.mp4 ] && { log "· $id ya tiene master"; continue; }
  bash scripts/video.sh $id todo > dist-video/.fabrica-$id.log 2>&1 && log "✓ $id ($(ffprobe -v error -show_entries format=duration -of csv=p=0 dist-video/masters/$id-4k.mp4 2>/dev/null | cut -c1-4) s)" || log "✗ $id (ver dist-video/.fabrica-$id.log)"
done
log "FIN fábrica"
