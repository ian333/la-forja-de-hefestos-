#!/bin/bash
# repaso-globos.sh — 10 capítulos rendidos ANTES del arreglo de los globos (b0db081): se re-rinden y, si ya estaban
# armados, se repone master → reel → cola de PRIME → YouTube (borra el privado viejo y sube el nuevo; la cuota se reintenta).
set -u
LIA=/home/ian/Orkesta/lia-video-engine; FORJA=/home/ian/Orkesta/la-forja; PY=/home/ian/pub-venv/bin/python
LOG=$FORJA/dist-video/repaso-globos.log; ENT=/mnt/c/Users/sebas/Downloads/DonChuy-60
log(){ echo "$(date '+%m-%d %H:%M') $*" >> $LOG; }
declare -A ID=( [05-a-cambio-de-que]=econ-yunus [08-parte-una-naranja]=econ-naranja [09-cincuenta-la-hora]=econ-hora )
CAPS="38-si-sale-agria-te-la-cambio 05-a-cambio-de-que 08-parte-una-naranja 09-cincuenta-la-hora 16-se-le-acabaron-a-mediodia 19-ya-lo-pago-y-debe 21-la-lata-llena-sin-cambio 26-el-billete-de-hace-un-ano 29-dijeron-que-si 30-el-domingo-que-no-se-repitio"
until grep -q "^FIN" $LIA/projects/economia/_salon/salon.log 2>/dev/null && grep -q "todos armados" $FORJA/dist-video/publicar-3xdia.log 2>/dev/null; do sleep 300; done
log "arranca el repaso (salón y publicador terminaron)"
PEND=""
for s in $CAPS; do id=${ID[$s]:-econ-$s}; O=$LIA/projects/economia/negocio/$s/out; M=$FORJA/dist-video/masters/$id-4k.mp4
  cd $LIA && ./lia render $s --forzar --lienzos 9x16 > .repaso-$s.log 2>&1 && ./lia post $s --forzar >> .repaso-$s.log 2>&1
  [ -s $O/short.mp4 ] && [ $O/short.mp4 -nt $O/crudo.mp4 ] || { log "✗ $s: render"; continue; }
  cp -f $O/short.mp4 $ENT/DonChuy-$s.mp4 2>/dev/null; log "✓ re-rendido $s"
  cd $FORJA
  ffmpeg -v error -y -i $O/short.mp4 -c:v h264_nvenc -preset p6 -rc cbr -b:v 24M -maxrate 24M -bufsize 48M -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart $M || { log "✗ $id: encode"; continue; }
  python3 -c "
import json;p='videos/$id.json';d=json.load(open(p));d['publicar'].pop('reel_url',None);json.dump(d,open(p,'w'),ensure_ascii=False,indent=1)"
  bash scripts/video.sh $id publicar >> $LOG 2>&1
  python3 scripts/reels-1080.py $id --subir >> $LOG 2>&1 && python3 scripts/cola-publicar.py armar $id >> $LOG 2>&1 && log "✓ $id: reel y cola repuestos" || log "✗ $id: reel/cola"
  if [ -n "$(python3 -c "import json;print((json.load(open('videos/$id.json'))['publicar'].get('subidas') or {}).get('yt',{}).get('id',''))")" ]; then
    $PY scripts/reemplazar-yt.py $id --si >> $LOG 2>&1 || log "⚠ $id: no se borró el YT viejo"
  fi
  C=$(python3 -c "import json;print(json.load(open('videos/$id.json'))['publicar'].get('programar',''))")
  $PY scripts/subir-youtube.py $id --publico --programar "$C" >> $LOG 2>&1 && log "✓ $id: YouTube repuesto" || PEND="$PEND $id"
done
while [ -n "$(echo $PEND)" ]; do sleep 3600; R=""; for id in $PEND; do C=$(python3 -c "import json;print(json.load(open('$FORJA/videos/$id.json'))['publicar'].get('programar',''))"); cd $FORJA && $PY scripts/subir-youtube.py $id --publico --programar "$C" >> $LOG 2>&1 && log "✓ $id: YouTube repuesto (reintento)" || R="$R $id"; done; PEND="$R"; done
log "FIN repaso"
