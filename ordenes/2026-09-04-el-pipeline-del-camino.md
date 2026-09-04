# ORDEN: EL PIPELINE DEL CAMINO — cada happy path lleva su video, y el video se sube

ESTADO: proximo
PRIORIDAD: 7

BASE: 4d28106

OBJETIVO: ian (2026-09-04), al ver el primer paseo: «QUE QUEDE COMO PIPELINE, CADA HAPPY PATH LLEVA
SU VIDEO… ya automatizamos Instagram y YouTube con su API, entonces estos videos se subirán». Al final
de esta orden, cada `caminos/<slug>.md` produce solo, sin que nadie lo pida: (1) su medición (runner
→ estados en el archivo → Temis), (2) su video paseo (`--paseo` → encode → `dist-video/caminos/
<slug>-<fecha>.mp4`), (3) su entrada en el catálogo de Comando para que SUBIDA AUTOMATIZADA lo suba
cuando ian diga «autorizado» — la puerta de publicar sigue siendo suya, pieza por pieza.

## DECISIONES DE IAN
- 4K: «no me preocupa aún lo del 4K, dejémoslo hasta el final» → el master del paseo sale escalado desde
  1080 y se declara; el 4K nativo del arnés vive en DESPUES-DE-V1.
- Primero se CUMPLE un happy path (el de la carcasa); el pipeline se arma con el camino ya verde o
  mientras se pone verde, pero no antes de que exista el gesto del paso 5.

## YA-EXISTE (prueba de ausencia)
- `camino-runner.cjs` mide y `--paseo` graba (orden el-runner-del-camino + el-video-del-camino).
- `encode-paseo.sh` (quita cuadros encogidos, recorta lead-in, escala, hevc NVENC) vive HOY en el
  scratchpad de la sesión — deuda: esta orden lo trae al repo como `scripts/encode-paseo.sh`.
- SUBIDA AUTOMATIZADA (orden 2026-08-26): un comando sube a IG/YT/TikTok con `publicar.autorizado`;
  el catálogo de Comando (`public/comando/catalogo.json`) es lo que Temis lee para «en vivo».
- `deploy-atlas-build.sh` ya corre pasos post-deploy (temis stamp): el disparador natural del pipeline
  es «después de cada deploy, desde iangpu» (o cron nocturno en iangpu si el deploy no debe esperar).
- NO existe: ningún disparador; ningún video de camino en `dist-video/`; ningún manifiesto de camino
  para el catálogo.

## TOCA
- scripts/camino-runner.cjs
- deploy-atlas-build.sh
- public/comando/catalogo.json

## CREA
- scripts/encode-paseo.sh
- scripts/camino-pipeline.sh

## BORRA
- (nada)

## PREEXISTENTE
- (se llena al abrir la orden)

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- un deploy termina y, sin tocar nada, aparecen: estados nuevos en el camino, `dist-video/caminos/
  la-carcasa-de-mitsubishi-<fecha>.mp4` y su entrada en el catálogo; Temis dice «medido <fecha>»
- el video se revisa con hoja de contactos ANTES de quedar en el catálogo (0 cuadros encogidos)
- la subida NO ocurre sin «autorizado» de ian (control negativo: sin autorización, no sube)
- orden-gate VERDE · censo igual

## CIERRE (se llena al terminar)
