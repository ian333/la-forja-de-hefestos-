#!/bin/bash
# publicar-3xdia.sh — Don Chuy a 3 por día (ian 2026-09-27: «sí a las 3»). Sigue videos/_calendario-don-chuy.json en orden:
# espera a que el salón termine cada video → segs.json (subtítulos) → master 4K CBR 24 Mbps → biblioteca (PRIME+ATLAS) →
# reel hospedado → cola de Instagram en PRIME (publica a la hora) → YouTube 9:16 programado (la cuota da ~5/día: lo que
# no cabe se reintenta cada hora, en orden del calendario). Idempotente: lo ya hecho se salta.
set -u
LIA=/home/ian/Orkesta/lia-video-engine; FORJA=/home/ian/Orkesta/la-forja; PY=/home/ian/pub-venv/bin/python
LOG=$FORJA/dist-video/publicar-3xdia.log; cd $FORJA
log(){ echo "$(date '+%m-%d %H:%M') $*" >> $LOG; }
m(){ python3 -c "import json,sys;d=json.load(open('videos/$1.json'));print(eval('d'+''.join(f'[\"{k}\"]' for k in '$2'.split('.'))) or '')" 2>/dev/null; }
enc(){ ffmpeg -v error -y -i "$1" -c:v h264_nvenc -preset p6 -rc cbr -b:v 24M -maxrate 24M -bufsize 48M -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$2"; }
segs(){ python3 - "$1" "$2" <<'PY'
import json,re,sys,os
w=json.load(open(sys.argv[1]))['palabras']; segs=[]; cur=[]
for x in w:
    cur.append(x)
    if re.search(r'[.?!…:]$',x['palabra']) or len(cur)>=8:
        segs.append({'start':round(cur[0]['inicio'],2),'end':round(cur[-1]['fin'],2),'text':' '.join(c['palabra'] for c in cur)}); cur=[]
if cur: segs.append({'start':round(cur[0]['inicio'],2),'end':round(cur[-1]['fin'],2),'text':' '.join(c['palabra'] for c in cur)})
os.makedirs(os.path.dirname(sys.argv[2]),exist_ok=True); json.dump(segs,open(sys.argv[2],'w'),ensure_ascii=False,indent=1)
PY
}
yt(){ # yt <id> <cuando>  — programado si la hora no pasó; público ya si pasó
  if [ "$(date -d "$2" +%s)" -gt "$(date +%s)" ]; then $PY scripts/subir-youtube.py "$1" --publico --programar "$2" >> $LOG 2>&1
  else $PY scripts/subir-youtube.py "$1" --publico >> $LOG 2>&1; fi; }
PEND=""
for par in $(python3 -c "import json;print(' '.join(x['id']+':'+x['slug']+':'+x['cuando'] for x in json.load(open('videos/_calendario-don-chuy.json'))))"); do
  IFS=: read -r id slug cuando_rest <<< "$par"; cuando="${par#*:*:}"
  O=$LIA/projects/economia/negocio/$slug/out; M=dist-video/masters/$id-4k.mp4
  if [ -z "$(m $id publicar.reel_url)" ]; then
    # 1. espera el video del motor
    until [ -s $O/short.mp4 ] && { grep -q "✓ video $slug" $LIA/projects/economia/_salon/salon.log 2>/dev/null || [ "${slug:0:2}" -le 12 ]; }; do sleep 120; done
    segs $LIA/projects/economia/negocio/$slug/words.json dist-video/$id-narracion/segs.json
    [ -s $M ] && [ $M -nt $O/short.mp4 ] || enc $O/short.mp4 $M || { log "✗ $id: encode"; continue; }
    python3 -c "
import json,subprocess;p='videos/$id.json';d=json.load(open(p))
d['formato']['dur']=round(float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0','$M'],capture_output=True,text=True).stdout),2)
json.dump(d,open(p,'w'),ensure_ascii=False,indent=1)"
    bash scripts/video.sh $id publicar >> $LOG 2>&1 || log "⚠ $id: biblioteca/catálogo con avisos"
    python3 scripts/reels-1080.py $id --subir >> $LOG 2>&1 || { log "✗ $id: no se hospedó el reel"; continue; }
  fi
  python3 scripts/cola-publicar.py armar $id >> $LOG 2>&1 && log "✓ $id: Instagram armado para $cuando" || log "✗ $id: Instagram NO armado"
  if [ -z "$(m $id publicar.subidas.yt.id)" ]; then yt $id "$cuando" && log "✓ $id: YouTube programado $cuando" || { log "⏳ $id: YouTube pendiente (cuota)"; PEND="$PEND $id:$cuando"; }; fi
done
log "todos armados en Instagram; YouTube pendientes: $(echo $PEND | wc -w)"
while [ -n "$(echo $PEND)" ]; do
  sleep 3600; R=""
  for x in $PEND; do id=${x%%:*}; c=${x#*:}; yt $id "$c" && log "✓ $id: YouTube programado (reintento)" || R="$R $x"; done
  PEND="$R"
done
log "FIN publicar-3xdia"
