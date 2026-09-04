# CAMINO: EL CINE PROGRAMADO

ACTOR: ian, con un master 4K verificado en Downloads y cero ganas de subir a mano
PROMESA: dice «autorizo X para el domingo» y el video sale SOLO a las 18:45 CDMX en YouTube (9:16 y 16:9) y en Instagram — y queda registrado con sus rasgos (brazo, cortes/min, síl/s, VEL, marco) y sus métricas a las 48 h, listo para el dataset
PIEZA: videos/mol-etoh-te-roba-el-agua.json (la primera que recorre el camino completo)
NOTA: la hora sale de la telemetría propia (public/comando/horarios.json): 43 % Argentina, 15 % Chile, 15 % Colombia, 15 % México; pico 21-23 h local = 19-21 h CDMX; domingo y lunes fuertes. YouTube se programa solo (`publishAt`); Instagram NO tiene programación, así que PRIME (fuera de casa, cron cada 5 min) publica el reel a la hora con un script de biblioteca estándar. iangpu solo trabaja al ARMAR (gates, ffprobe, hospedar el reel). La verdad vive en el manifiesto; la tira 🎬 CINE de TEMIS la refleja.

## PASOS
- 1 · RENDER + VERIFICAR + ENTREGAR (`video.sh <id> todo`) · master 4K en Downloads con MD5, stills sin bandera, subtítulos sobre su toma · ok · -
- 2 · AUTORIZAR (ian): `publicar.autorizado` con sus palabras + `publicar.programar` con la hora ISO · el manifiesto trae los dos campos; sin ellos nada se sube · parcial · 2026-09-04-el-cine-programado
- 3 · ARMAR (`video.sh <id> programar` en iangpu): biblioteca+catálogo, YouTube 9:16 y 16:9 subidos PRIVADOS con publishAt, reel hospedado y verificado por HEAD, entrada en la cola de PRIME con el token fresco · `publicar.subidas.yt.publishAt`, `publicar.reel_url`, `cola.json` en PRIME · parcial · 2026-09-04-el-cine-programado
- 4 · A LA HORA (PRIME, `cola-publicar.py tick` por cron): contenedor por URL → FINISHED → media_publish → permalink · `hecho/<id>.json` en PRIME con la URL del reel; YouTube se hace público solo · parcial · 2026-09-04-el-cine-programado
- 5 · COSECHAR (`video.sh <id> cosechar`): el permalink entra al manifiesto y el día pasa a hecho · `publicar.subidas.ig` registrado; la tira CINE muestra ● publicado sin «falta» · parcial · 2026-09-04-el-cine-programado
- 6 · A LAS 48 H: métricas (`metricas-instagram.py`, `metricas-youtube.py` por cron en iangpu) · skip3s, seg_vistos, c_por_mil, g_por_mil por pieza en metricas.json · parcial · -
- 7 · EL DATASET (`dataset-cine.py`): una fila por pieza publicada = rasgos (ritmo, copy, píxel, hora, día) + métricas · `public/comando/dataset.json` · parcial · 2026-09-04-el-cine-programado
- 8 · EL VEREDICTO A/B (brazo B vs REY): con n≥2 por brazo decide si los recortes van con B · nota en canon §EL RITMO con los números · bloqueado · -

## RUNNER
- 1 · ls /mnt/c/Users/sebas/Downloads/*-4K.mp4
- 2 · python3 -c "import json,sys;d=json.load(open('videos/mol-etoh-te-roba-el-agua.json'))['publicar'];sys.exit(0 if d.get('autorizado') and d.get('programar') else 1)"
- 3 · python3 scripts/cola-publicar.py estado
- 4 · ssh ian@100.110.244.20 'tail -3 /home/ian/forja-cola/cola.log'
- 5 · python3 -c "import json,sys;d=json.load(open('videos/mol-etoh-te-roba-el-agua.json'))['publicar'];sys.exit(0 if d.get('subidas',{}).get('ig',{}).get('url') else 1)"
- 6 · ls dist-video/metricas.json
- 7 · python3 scripts/dataset-cine.py --check
- 8 · grep -q "VEREDICTO A/B" docs/CANON-VIDEO.md
