#!/bin/bash
# rerender-don-chuy.sh — pasada completa sobre videos/_calendario-don-chuy.json con el diseño NUEVO de ElPuesto
# (libreta + subtítulos por puntuación + globos arriba). Por capítulo: escaleta (storyboard nuevo) → render 9:16 → post →
# master 24 Mbps → biblioteca → reel (hash nuevo) → cola de PRIME (reemplaza) → YouTube (borra el privado viejo, sube el nuevo;
# la cuota se reintenta cada hora). Solo toca capítulos cuya hora de publicación sea FUTURA. Idempotente por marca .v4.
#   bash scripts/rerender-don-chuy.sh [--solo id1,id2]     (corre en iangpu, en tmux)
set -u
LIA=/home/ian/Orkesta/lia-video-engine; FORJA=/home/ian/Orkesta/la-forja; PY=/home/ian/pub-venv/bin/python
LOG=$FORJA/dist-video/rerender-don-chuy.log; ENT=/mnt/c/Users/sebas/Downloads/DonChuy-60; cd $FORJA
log(){ echo "$(date '+%m-%d %H:%M') $*" >> $LOG; }
SOLO=""; [ "${1:-}" = "--solo" ] && SOLO=",$2,"
# Espera a que el salón termine (no pelear la GPU) — los capítulos que el salón rinda después de .v4-desde ya son v4.
until grep -q "FIN del salón" $LIA/projects/economia/_salon/salon.log 2>/dev/null; do sleep 120; done
log "arranca la pasada v4 (salón terminado)"
PEND=""
for par in $(python3 -c "import json;print(' '.join(x['id']+':'+x['slug']+':'+x['cuando'] for x in json.load(open('videos/_calendario-don-chuy.json'))))"); do
  id=${par%%:*}; rest=${par#*:}; slug=${rest%%:*}; cuando=${rest#*:}
  [ -n "$SOLO" ] && [[ "$SOLO" != *",$id,"* ]] && continue
  [ "$(date -d "$cuando" +%s)" -gt "$(date +%s)" ] || { log "· $id ya se publicó ($cuando): no se toca"; continue; }
  O=$LIA/projects/economia/negocio/$slug/out; M=dist-video/masters/$id-4k.mp4
  [ -f $O/.v4 ] && continue
  [ -f $LIA/.v4-desde ] && [ -s $O/short.mp4 ] && [ $O/short.mp4 -nt $LIA/.v4-desde ] && { touch $O/.v4; log "· $slug ya es v4 (lo rindió el salón)"; continue; }
  ( cd $LIA && pipeline/.venv/bin/python pipeline/escaleta.py $slug && ./lia render $slug --forzar --lienzos 9x16 && ./lia post $slug --forzar ) > $LIA/.v4-$slug.log 2>&1
  [ -s $O/short.mp4 ] && [ $O/short.mp4 -nt $O/crudo.mp4 ] || { log "✗ $slug: render (ver $LIA/.v4-$slug.log)"; continue; }
  touch $O/.v4; cp -f $O/short.mp4 $ENT/DonChuy-$slug.mp4 2>/dev/null; log "✓ re-rendido $slug"
  ffmpeg -v error -y -i $O/short.mp4 -c:v h264_nvenc -preset p6 -rc cbr -b:v 24M -maxrate 24M -bufsize 48M -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart $M || { log "✗ $id: encode"; continue; }
  python3 -c "
import json;p='videos/$id.json';d=json.load(open(p));d['publicar'].pop('reel_url',None);d['publicar']['diseno']='v4 libreta';json.dump(d,open(p,'w'),ensure_ascii=False,indent=1)"
  bash scripts/video.sh $id publicar >> $LOG 2>&1
  python3 scripts/reels-1080.py $id --subir >> $LOG 2>&1 && python3 scripts/cola-publicar.py armar $id >> $LOG 2>&1 && log "✓ $id: reel y cola repuestos" || log "✗ $id: reel/cola"
  if [ -n "$(python3 -c "import json;print((json.load(open('videos/$id.json'))['publicar'].get('subidas') or {}).get('yt',{}).get('id',''))")" ]; then
    $PY scripts/reemplazar-yt.py $id --si >> $LOG 2>&1 || log "⚠ $id: no se borró el YT viejo"
  fi
  $PY scripts/subir-youtube.py $id --publico --programar "$cuando" >> $LOG 2>&1 && log "✓ $id: YouTube repuesto" || PEND="$PEND $id:$cuando"
done
log "pasada terminada; YouTube pendientes: $(echo $PEND | wc -w)"
while [ -n "$(echo $PEND)" ]; do sleep 3600; R=""; for x in $PEND; do id=${x%%:*}; c=${x#*:}; $PY scripts/subir-youtube.py $id --publico --programar "$c" >> $LOG 2>&1 && log "✓ $id: YouTube repuesto (reintento)" || R="$R $x"; done; PEND="$R"; done
log "FIN rerender-don-chuy"
