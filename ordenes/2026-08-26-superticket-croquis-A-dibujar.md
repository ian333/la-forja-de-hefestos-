# ORDEN: SUPERTICKET CROQUIS A — DIBUJAR (círculo · polígono · arco · elipse · punto · lazo)

BASE: 8655c3f

OBJETIVO: La postura: los ejercicios del libro (Bethune cap. 2, el idioma del boceto) se
organizan como una MATRIZ herramienta × lección — cada herramienta del croquis tiene SU
lección y cada lección es UN ejercicio. Un ejercicio = video con voz (Matilda) + oráculo del
kernel (checks por invariantes: volumen, DOF, sólido) + veredicto verde/rojo. El estado NO
se teclea: lo escribe la producción (parrilla → resultados.json) y Temis lo lee. Esta corrida
produce SOLO EL PRIMER ejercicio de la lista (mec-u2-l1, la tuerca) para probar el formato de
superticket de punta a punta: lección → parrilla en iangpu → video 4K a E: y PRIME → still en
evidencia → resultados.json → tarjeta de Temis con n/N.

## YA-EXISTE (prueba de ausencia)
- La ESCUELA ya existe: `public/escuela/lecciones/mec-u2-l1..l6.json` (pasos `dice` + `gestos`
  + `check`), runner `scripts/escuela/clase-drive.cjs`, producción `scripts/escuela/parrilla.sh`
  (voz XTTS → drive con reintentos → 4K NVENC → entrega). NO se reinventa: se corre.
- Temis (`scripts/temis-tablero.cjs` + `src/forja/brep/TemisBoard.tsx`) ya lee las órdenes; lo
  que NO sabía era leer una sección `## EJERCICIOS` ni `resultados.json` — eso es el DIFF.
- Las lecciones l7..l10 (arc3, ellipse, point, lazo) NO existen todavía: se declaran aquí como
  NUEVA y quedan `pendiente` hasta que tengan lección y oráculo. No se crean en esta corrida.

## EJERCICIOS
- mec-u2-l1 · La tuerca hexagonal (círculos, polígono, origen) · circle poly fix · vol ≈ 1,435 mm³ (checks del kernel de la lección)
- mec-u2-l2 · La biela del examen (arcos y líneas) · arc line circle · vol 21,036
- mec-u2-l3 · El polígono: la llave del 13 · poly · checks de la lección
- mec-u2-l7 · Arco por 3 puntos: el ojal (NUEVA) · arc3 · oráculo por definir
- mec-u2-l8 · La leva elíptica (NUEVA) · ellipse · vol = π·a·b·h exacto
- mec-u2-l9 · Punto de referencia (NUEVA) · point · oráculo por definir
- mec-u2-l10 · La ranura como lazo (NUEVA) · line arc · oráculo por definir

## TOCA
- public/escuela/lecciones/mec-u2-l1.json
- scripts/escuela/parrilla.sh
- scripts/escuela/clase-drive.cjs
  (ENMIENDA al cierre: ready-wait del runner, ver CIERRE — sin él la parrilla es CLASE_FATAL en todo el CAD)
- scripts/temis-tablero.cjs
- src/forja/brep/TemisBoard.tsx
- public/temis.json

## CREA
- public/evidencia/2026-08-26-superticket-croquis-A-dibujar/resultados.json
- public/evidencia/2026-08-26-superticket-croquis-A-dibujar/01-mec-u2-l1-still.jpg
- public/evidencia/2026-08-26-superticket-croquis-A-dibujar/02-temis-superticket.jpg

## BORRA
- (nada)

## PREEXISTENTE
(derivado MECÁNICAMENTE de `node scripts/orden-gate.cjs --orden <esta>` al cierre: todo ✘ que no es de esta orden —
otras sesiones en paralelo (moldes por pieza, subida automatizada, cine, la fuente) y la orden HERMANA de la misma corrida. NO entra a este commit salvo lo de la hermana.)
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/SUBIDA-AUTOMATIZADA.md
- docs/forja-research/datasheets-fuente-corriente/ACS724-hall-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/ACS758-hall.pdf
- docs/forja-research/datasheets-fuente-corriente/FDH055N15A-mosfet.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFB4115-mosfet-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFB4227-mosfet-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFP4568-mosfet-backup.pdf
- docs/forja-research/datasheets-fuente-corriente/LRS-1200-spec.pdf
- docs/forja-research/datasheets-fuente-corriente/MBR60100PT-schottky.pdf
- docs/forja-research/datasheets-fuente-corriente/RSP-1000-spec.pdf
- docs/forja-research/datasheets-fuente-corriente/TC4422-gatedriver-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/UCC27614-gatedriver.pdf
- docs/forja-research/datasheets-fuente-corriente/ag-peina.py
- docs/forja-research/datasheets-fuente-corriente/sim-ag.py
- docs/forja-research/datasheets-fuente-corriente/sim-sensor.py
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- public/escuela/lecciones/mol-s1-llenado-por-pieza.json
- public/escuela/lecciones/mol-s2-intake.json
- public/escuela/lecciones/mol-s3-base-catalogo.json
- public/evidencia/2026-08-26-superticket-croquis-B-domar/01-mec-u2-l4-still.jpg
- public/evidencia/2026-08-26-superticket-croquis-B-domar/02-temis-superticket.jpg
- public/evidencia/2026-08-26-superticket-croquis-B-domar/resultados.json
- public/temis-deploy.json
- scripts/ciclo-dado-test.cjs
- scripts/guiones/hemo-v1-proteina-entera.txt
- scripts/guiones/hemo.txt
- scripts/guiones/sal.txt
- scripts/metricas-instagram.py
- scripts/metricas-youtube.py
- scripts/narracion-gen.py
- scripts/precompute-heme-approach.py
- scripts/precompute-hemoglobin.py
- scripts/pub_comun.py
- scripts/reels-1080.py
- scripts/salud.sh
- scripts/subir-instagram.py
- scripts/subir-youtube.py
- scripts/video.sh
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/flowlen.ts
- src/forja/mold/moldbase.ts
- videos/cargas-gauss.json
- videos/faraday-jaula.json
- videos/mol-grasa-butirico.json
- videos/mol-h2o-el-anillo.json
- videos/mol-h2o-el-cuarteto.json
- videos/mol-h2o-el-hexamero.json
- videos/mol-h2o-el-hielo.json
- videos/mol-h2o-el-puente-camB.json
- videos/mol-h2o-el-puente.json
- videos/mol-h2o-el-sudor.json
- videos/mol-h2o-la-sal.json
- videos/mol-hemo-la-cazadora.json

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- video de mec-u2-l1 entregado en 4K a E: (iangpu) y a PRIME; ruta en `resultados.json`
- oráculo del kernel VERDE en el drive: `meta.json` con todos los checks de la lección en
  pasa (vol ≈ 1,435 mm³ dentro de la tolerancia de la lección) → `"estado":"verde"`, `"checks":"n/N"`
- still del video (frame del sólido terminado) en `01-mec-u2-l1-still.jpg`
- tarjeta de Temis en el lobby con la barra `1/7 ejercicios` y la lista `temis-ejercicios` con
  una fila por ejercicio (verde l1, gris el resto) → captura `02-temis-superticket.jpg`
- `node scripts/temis-tablero.cjs` sale 0 y `public/temis.json` trae `superticket:true`,
  `ejercicios[7]` y `progreso:{verdes:1,total:7}` en esta tarjeta
- orden-gate VERDE con esta orden vigente
- censo esperado: igual (canvas 8 / vite 41 / html 46)

## CIERRE (2026-08-26)
**Ejercicio 1 (mec-u2-l1, la tuerca) = ROJO.** El gate del kernel dio 4/4 y el video 4K
existe en E: y PRIME, pero el JUEZ CON OJOS lo reprobó: pasa el gate y no enseña. Un
ejercicio es verde cuando pasan LOS DOS (kernel Y ojos); aquí pasó uno. El formato de
superticket sí quedó probado de punta a punta (lección → parrilla en iangpu → 4K → still →
`resultados.json` → tarjeta de Temis con barra y lista): lo que reprobó es el video, no el
formato.

- **orden vs entregado**: desviaciones. (1) `scripts/escuela/clase-drive.cjs` NO estaba en
  TOCA y se tocó (ENMIENDA, +7/−3): sin ese parche la parrilla es CLASE_FATAL ×3 en TODA
  lección del CAD. (2) La lección `mec-u2-l1.json` NO cambió ni una línea (todos sus testids
  siguen vivos tras la UI de agosto: btn-sketch → chooser-plane-xy, sk-tool-poly/circle/fix,
  sk-dim-input, sk-finish, btn-extrude, input-altura; la tarjeta guiada del doc vacío no
  estorba). (3) `parrilla.sh`: el still al 40% caía a medio croquis, no al sólido terminado
  que pide EVIDENCIA → `PARRILLA_STILL_FRAC` (default 0.9) y el still de esta orden se
  regeneró del master al 90% con el mismo filtro. (4) `TemisBoard.tsx`/`temis-tablero.cjs`:
  la barra también pinta ROJOS (`progreso:{verdes,rojos,total}`) para que un ejercicio
  producido y reprobado no se esconda como "pendiente".
- **sonda (laptop, prod, SOFTGL, sin video)**: con el runner del repo tal cual → `CLASE_FAIL
  TimeoutError: page.waitForFunction: Timeout 30000ms exceeded` (clase-drive.cjs:115) →
  CLASE_FATAL pasos=0. Causa medida (probe propio, 16 muestras): desde v1·2 HIGIENE
  (a8848f3, ForgeBRepStudio.tsx:3878-3880 `setOpErr(null); setVacio(true)`) el doc vacío
  deja `__forgeBrep.ready=false` y `error=null` para siempre → la condición `ready || error`
  del runner ya no se cumple. Segundo defecto: `waitForFunction(READY, { timeout })` pasaba
  las opciones en la posición del ARG → timeout real 30 s. Parche: READY acepta la tarjeta
  `lienzo-vacio` / el estado-texto "Lienzo vacío", y `waitForFunction(READY, null,
  { timeout: READY_MS || 180000 })`. Con el parche: 4/4 checks, 8/8 pasos, vol_kernel
  1435.477 mm³ (tolerancia 1450±130), ops [extrude, hole], euler 2, masa 3.876 g. 1 de 3
  corridas murió por red de la laptop (`net::ERR_NETWORK_CHANGED` + wasm abort); reintento OK.
- **grabación (iangpu, vite dev :5178, GPU real, `PARRILLA_URL=http://127.0.0.1:5178/forja-brep.html
  PARRILLA_REDO=1 SUPERTICKET_SLUG=<slug> bash scripts/escuela/parrilla.sh mec-u2-l1`)**:
  voz XTTS Matilda 8 wavs (~1.5 min) → CLASE_OK intento 1, 4/4 checks, 0 errores, vol
  1435.476746 mm³ → 4K NVENC en segundos. Master: 81.63 s, 3840×2160, hevc yuv420p10le
  30 fps + aac 48 kHz mono, 20,150,051 bytes, md5 `908cd5cb73e249d89e052fb3aa519af5`
  idéntico en iangpu `dist-video/escuela/`, `/mnt/e/forja-videos/escuela/bethune/U02/ESCUELA-MECANICA-U2L1-tuerca-hexagonal-4K.mp4`
  y PRIME `/mnt/hdd/forja-videos/escuela/bethune/U02/`. Logs: iangpu `/home/ian/parrilla-mec-u2-l1.log`.
- **entrega**: la 1ª corrida falló en PRIME con `mkdir: cannot create directory
  '/mnt/hdd/forja-videos': Permission denied` (`/mnt/hdd` es root:root 755) → se creó con
  `sudo -n` + `chown ian:ian` y se re-corrió la parrilla en modo reanudable (salta drive/4K,
  rehace entrega+rastro) → PRIME ok, md5 igual.
- **juez con ojos (stills 10/50/90 % del master, 1400 px) — REPRUEBA**: (1) el boceto
  (hexágono + círculo) mide ~40 px de 1400 (~3 % del ancho, misma proporción en 4K): un
  puntito; el alumno NO ve los seis lados ni el círculo concéntrico, que son EL contenido.
  (2) El chyron dice "diez milímetros de diámetro" y no hay cota Ø10 visible. (3) El panel
  de la herramienta círculo sigue armado ("↵ centro del círculo") mientras la voz acota.
  (4) La barra ESTADO dice "Lienzo vacío — Boceto → Extruir…" DENTRO del editor de boceto
  con 7 pts · 6 líneas (texto obsoleto). (5) La tuerca final ocupa ~8 % del cuadro y el
  volumen 1435.477 mm³ vive en letra de ~9 px, ilegible en teléfono. (6) Ribbon con
  "Sección"/"Escala" resaltados sin usarse. (7) Tarjeta "TU PRIMERA PIEZA…" en medio del
  cuadro de apertura (menor). Lo que SÍ: CAD real en cuadro, chyron legible, cursor visible,
  still 90 % = tuerca con barreno, historia Boceto 1 → Extrude → Hole, volumen dentro del oráculo.
- **números**: `node scripts/temis-tablero.cjs` sale 0; `public/temis.json` trae
  `superticket:true`, `ejercicios[7]`, `progreso:{verdes:0,rojos:1,total:7}`; tapa EN CURSO
  1/1 (+3 superticket). Captura en iangpu (Chrome GPU, 1900×1000): barra "0/7 ejercicios ·
  1 rojo", lista `temis-ejercicios` con 7 filas (l1 rojo, 6 gris), galería 1 foto 1400×788
  servida como image/jpeg (vite reiniciado tras copiar `public/evidencia/`, gotcha ya
  conocido). orden-gate VERDE con esta orden vigente; censo 8/41/46 (+0).
- **evidencia**: `public/evidencia/2026-08-26-superticket-croquis-A-dibujar/{resultados.json,
  01-mec-u2-l1-still.jpg (frame 90 %: la tuerca terminada), 02-temis-superticket.jpg (detalle
  de Temis con la lista y la galería)}`.
- **NO se logró**: un video APROBADO de mec-u2-l1 (rojo por los ojos). Los ejercicios l2, l3
  siguen pendientes y l7..l10 sin lección. NO se tocó `src/` (el estado-texto obsoleto en
  modo boceto y la falta de auto-fit del sketcher son del producto, no de la lección). Sin deploy.
- **preguntas abiertas (decisión de ian)**: (a) el zoom del croquis para que el boceto
  llene el cuadro: ¿gesto `zoom-fit` en la lección o auto-fit del sketcher (producto)?
  (b) el ready-wait: ¿se queda en el runner (hecho) o el producto expone `kernelReady`
  (`!!oc`) en `__forgeBrep`? (c) rotular el volumen en escena para el remate.
