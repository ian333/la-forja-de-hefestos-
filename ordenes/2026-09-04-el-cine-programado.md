# ORDEN: EL CINE PROGRAMADO — cada video con su hora, sus rasgos y sus métricas; PRIME lo sube solo

BASE: 0588619

OBJETIVO: ian (2026-09-04): «quiero que estén los tickets con su cronograma, cada ticket es subir
un video… cada uno llevará sus características y métricas para que después podamos hacer machine
learning… dejar todo por adelantado, que se queden programados para que se suban desde prime o
atlas… ya identificaste el mejor horario, optimicemos todas las variables… lo mismo con TODOS los
videos que hemos hecho: la narrativa y velocidad, porque la belleza ya la tenemos».
Al final: el manifiesto trae `publicar.programar` (hora ISO con huso) + `publicar.autorizado`
(sus palabras); `video.sh <id> programar` sube YouTube 9:16 y 16:9 PRIVADOS con `publishAt`,
hospeda el reel y deja la entrada en la cola de PRIME; PRIME (cron cada 5 min, stdlib puro)
publica el reel a la hora; `video.sh <id> cosechar` registra el permalink. La tira 🎬 CINE de
TEMIS es el cronograma: hora, brazo, cortes/min, síl/s, VEL, marco, y lo que falta.

## YA-EXISTE (prueba de ausencia)
- `scripts/subir-youtube.py:57-58` ya acepta `--programar` → `privacyStatus=private` +
  `publishAt`. `video.sh:395` lo pasa por `$PROGRAMAR`. NADIE lo usaba: todos los `publishAt`
  de `videos/*.json` están vacíos. → se USA, no se reescribe.
- `scripts/reels-1080.py --subir` ya hospeda el reel en PRIME+ATLAS y verifica la URL por HEAD
  (cf-cache). Instagram DESCARGA esa URL (`subir-instagram.py:118-154`). → el publicador de PRIME
  solo necesita la URL + el token: cero ffprobe, cero venv.
- `videos/CRONOGRAMA.json` + `scripts/temis-tablero.cjs:277-320` + `TemisBoard.tsx:271-296` = la
  tira 🎬 CINE (una tarjeta por día, `publicado` derivado del manifiesto, `falta[]`). Estaba
  VENCIDA: paraba el 08-31 con 4 «próximos» que nunca salieron y sin lo que sí salió (ostrom,
  alcohol, los dos campos, de quién son). → se corrige y se extiende; no se crea otro tablero.
- `docs/SUBIDA-AUTOMATIZADA.md:59` PROMETÍA «programa si `publicar.programar` trae una fecha» y
  ningún código lo leía. → ahora es verdad.
- `public/comando/ritmo.json → horarios_latam` traía horarios de AFUERA (14-16 h, mié/jue). La
  telemetría propia (3,490 sesiones desde IG) dice otra cosa: 43 % Argentina, 15 % Chile, 15 %
  Colombia, 15 % México; pico 21-23 h local = 19-21 h CDMX; domingo y lunes fuertes. → se mide
  con script y se guarda en `public/comando/horarios.json`.
- No hay scheduler en ninguna máquina (grep programad/cron/publishAt: solo el crontab de la
  laptop con `ssh iangpu` para métricas). PRIME tiene python3 3.13 y cron activo.

## TOCA
- videos/mol-h2o-la-sal.json
- ordenes/2026-08-26-subida-automatizada.md
- videos/CRONOGRAMA.json
- scripts/video.sh
- scripts/temis-tablero.cjs
- src/forja/brep/TemisBoard.tsx
- docs/CANON-VIDEO.md
- docs/SUBIDA-AUTOMATIZADA.md
- public/temis.json
- videos/mol-h2o-los-dos-campos-b.json
- videos/mol-etoh-te-roba-el-agua.json
- videos/mol-h2o-eres-tu.json
- videos/mol-h2o-dos-gotas.json

## CREA
- ordenes/2026-09-04-el-cine-programado.md
- caminos/el-cine-programado.md
- scripts/cola-publicar.py
- scripts/horarios.py
- scripts/dataset-cine.py
- public/comando/horarios.json
- public/comando/dataset.json
- public/evidencia/2026-09-04-el-cine-programado/01-tira-cine.png
- public/evidencia/2026-09-04-el-cine-programado/02-cola-prime.png
- public/evidencia/2026-08-26-subida-automatizada/01-cine-chips-yt-ig.png

## BORRA
- (nada)

## PREEXISTENTE
- public/temis-deploy.json
- public/temis.json

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `node scripts/orden-gate.cjs` → VERDE
- `node scripts/temis-tablero.cjs` → exit 0, cero violaciones, `cine.dias` con hora y rasgos
  para las 4 piezas listas y la cola de recortes; UN solo `hoy` o ninguno
- `python3 scripts/cola-publicar.py tick --dry` en PRIME con una entrada de prueba → imprime
  «publicaría <id> a las <hora>» sin tocar la API
- `python3 scripts/horarios.py` → `public/comando/horarios.json` con n_sesiones, tz_pct,
  hora_local, hora_cdmx, dias y `recomendacion.hora_cdmx`
- captura de la tira 🎬 CINE del lobby (forja-brep.html → TEMIS) mostrando hora + rasgos
- censo esperado: canvas igual, vite igual, html igual

## CIERRE (2026-09-04)
- orden vs entregado: idéntico en lo prometido + dos cosas más: (1) la orden vieja SUBIDA
  AUTOMATIZADA (EN CURSO desde el 08-26, ya cumplida) se cerró con su CIERRE y evidencia para
  respetar la tapa de EN CURSO=1; (2) `videos/mol-h2o-la-sal.json` recibió su `subidas.ig`
  (estaba vacío) porque el dataset la tenía partida en dos filas.
  Lo que NO se hizo por ser decisión de ian: escribir `publicar.autorizado` (sus palabras) en
  las 4 piezas — `programar` ya está (09-05 B · 09-06 roba · 09-07 eres-tú · 09-08 dos gotas,
  18:45 CDMX) y la tira lo muestra como `⏰ programado · sin autorizar`.
- números: `orden-gate` VERDE (censo 8/41/46 igual) · `temis-tablero.cjs` exit 0, cero
  violaciones, 20 días en la tira (8 hechos, 12 próximos, 0 hoy), 4 con rasgos completos ·
  PRIME: `tick --dry` con entrada vencida por 2 min → «publicaría …» sin tocar la API; cron
  `*/5` instalado con flock · `horarios.json`: 3,490 sesiones IG, tz AR 43 % / CL 15 % / CO 15 %
  / MX 15 %, pico local [22, 23, 21], pico CDMX [20, 21, 19], días Sun 726 / Mon 685 ·
  `dataset.json`: 102 filas, 79 con IG, 30 con YT, 27 con manifiesto, 11 con ritmo declarado;
  uniones IG por id 3 / título 1 / sin unir 23 (21 nunca subidas a IG, 2 más nuevas que las
  fuentes) · build en iangpu 32.6 s.
- evidencia: public/evidencia/2026-09-04-el-cine-programado/01-tira-cine.png (la tira con hora +
  rasgos + chips) · 02-cola-prime.png (cron + tick en seco en PRIME) ·
  public/evidencia/2026-08-26-subida-automatizada/01-cine-chips-yt-ig.png.
- preguntas abiertas: (a) las palabras de autorización por pieza; (b) el orden/fechas propuestos
  son mi propuesta (domingo = roba por ser el día fuerte y el gancho más cotidiano); (c) los 8
  recortes al ritmo están CONDICIONADOS al veredicto A/B del 09-07 — si B pierde, van con brazo A
  y guion de revelación; (d) O₂, el puente y agua v2 (los tres más grandes) no tienen manifiesto:
  hay que resucitarlos desde cápsula antes de recortarlos; (e) los 16:9 de las 4 piezas están
  renderizando en iangpu (cola /tmp/ancho-cola.sh) — `programar` avisa «sin master 16:9» si no
  están al armar y se vuelve a correr después.
