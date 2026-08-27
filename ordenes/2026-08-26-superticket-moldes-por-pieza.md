# ORDEN: SUPERTICKET MOLDES · la Máquina de TU pieza (3 sprints con video)

BASE: c43a93a

OBJETIVO: ian (2026-08-26): «quiero un video funcionando de los 3 sprints que vas a
terminar». Los tres son las deudas que cualquiera topa en 5 minutos con SU pieza:
(1) la pieza del árbol muere en E3 («⏸ estación 4 sigue cableada al CUBO»);
(2) un STEP sin pared declarada se lee MACIZO y cotiza $188,830 — no hay intake
§2.1.5 en la UI; (3) la hoja dice «base 196×196 catálogo» pero el retículo es
sintético y sin fuente. Cada sprint es un EJERCICIO del superticket: código +
gate del ciclo + lección JSON de la escuela (video con voz por `clase-drive`)
+ oráculo del kernel + veredicto. Los videos se graban en iangpu SOLO cuando el
workflow de croquis (wf_87d3f684) suelte la GPU — nunca en paralelo.

## EJERCICIOS
- mol-s1-llenado-por-pieza · Tu pieza se LLENA: E4 (llenado) y E5 (alimentación) para la pieza del árbol · predicadoDeMalla measureFlowLength FAN · vol de vóxeles = vol del kernel ±5 % y 0 inalcanzables desde la boquilla
- mol-s2-intake · Declara tu pieza: intake §2.1.5 (pared · material · volumen anual) en la E1 · intake-pared intake-material intake-q · la cotización del STEP maciza ($188,830) cae a la del v1-gate al declarar la pared
- mol-s3-base-catalogo · La base se COMPRA: retículo HASCO/DME nominal con espesores de placa de catálogo · selectMoldBase cotizacionSvg · el cubo sigue en 196×196 (bit-igual) y una pieza chica cae en 156×156

## YA-EXISTE (prueba de ausencia)
- E4/E5 corren en `cicloEstacion4/5` (useMoldStudio) con el predicado
  `dentroDadoLocal` del CUBO y literales 40/20/39.5; `measureFlowLength`
  (flowlen.ts) acepta CUALQUIER predicado `inCavity(x,y,z)` — la figura la da el
  molde, no una fórmula. Falta el predicado de una malla arbitraria.
- El puente (v1·1) pasa `ArbolPiezaMeta` con wallMm/draft/fillet del árbol y
  `material: 'ABS'` fijo («intake de material: v1·5»).
- `moldbase.ts::STANDARD_BASES` = retículo 196..996 «estilo HASCO/DME» sin
  156/546 y sin fuente declarada; los espesores del stack (27/66/22…) ya coinciden
  con la serie de espesores HASCO.
- La escuela: lecciones JSON + `clase-drive.cjs` + `parrilla.sh` (voz, 4K,
  entrega). Los videos de moldes se autorizan como lecciones `mol-*`.

## ENMIENDA (al construir, antes de grabar)
- Sprint 1 medido: `predicadoDeMalla` (flowlen.ts, paridad de rayo +X con cubetas
  (y,z)) — vaso: vóxeles 27,312 vs kernel 27,417 (−0.4 %), 0 inalcanzables desde
  la boquilla; cubo: 64,000/64,000 celdas iguales al analítico. E4/E5 toman huella,
  pared y semilla de `pieza.local` (el cubo reproduce sus literales: bit-igual).
  La frontera honesta se movió: nota `ciclo-e6-bloqueada` (E6+ sigue del cubo).
- Sprint 2 va más lejos de lo declarado: la REOLOGÍA sigue al intake donde el
  Apéndice A tiene datos (ABS p.392 · PP p.393, `reologiaDe`); otros materiales
  caen a ABS y el panel E4 lo DICE (`e4-reologia`). Lo que NO cambia y se declara:
  `estacion5Dado`/`designSprueFeed` siguen con FEED_MATERIALS.ABS por dentro.
- Sprint 3 honesto: el retículo nominal HASCO/DME (156…996) con fuente declarada
  en la hoja y "números de pieza y precio del proveedor: PENDIENTES" — no se
  inventa catálogo. Espesores ya venían de `snapToCommercialPlate`.
- Gate del ciclo: 228 → **236/236** · v1-gate 10/10/10 intacto · esbuild OK en los
  5 archivos (no hay tsc local por regla de RAM).
- Las 3 lecciones usan `orbitTo` (main) SOLO para encuadrar la cámara (el molde
  vive en (98,98,146+) y btn-fit encuadra el CAD — deuda ya anotada); toda
  construcción y todo botón del ciclo son clicks reales.
- `clase-drive.cjs` ya detecta "Lienzo vacío" como kernel listo (parche de la
  sesión del workflow de croquis, mismo árbol de trabajo): mis lecciones lo usan
  tal cual, sin tocarlo.
- JUEZ CON OJOS, primera grabación (los 3 videos salieron 4K con voz, checks
  verdes, entregados a E:/PRIME — y REPROBADOS por la vista): (a) RITMO: la voz
  arrancaba con el clic y la escena llegaba 6-15 s después (E4 tarda ~15 s; la
  hoja ~6 s con el cursor deslizándose) → cada paso se partió en «clic» +
  «explicación» (la voz habla SOBRE la escena ya lista); (b) la hoja de
  cotización se veía como MINIATURA de ~150 px en el panel → clic en la
  miniatura = hoja a viewport completo (`cotizacion-grande`); (c) la hoja grande
  se cerraba sola — cerraba con CUALQUIER clic; ahora solo fondo o Esc (sonda:
  abierta a 0.3/1.5/3/6/10 s). Lo que se ve y se deja: las cotas 3D de la E3
  persisten sobre la E4/E5 (ruido, legible) y la jabonera trae 1/17 en rojo
  («caras PLANAS sin draft 0≠8») porque su árbol no tiene draft — honesto.
- JUEZ CON OJOS, segunda grabación: S1 APRUEBA (voz sobre E3→E4 pintada→E5 con
  colada, «reología: ABS Cycolac MG47» legible). S2/S3: la hoja grande seguía sin
  verse aunque el check `cotizacion-grande svg` daba VERDE — existía en el DOM pero
  no se PINTABA: `position: fixed` dentro del stacking context del panel queda
  atrapado (se veía como miniatura). Fix: la hoja sale por `createPortal` a
  `document.body` (sonda: parent === body, 1400×990 px, abierta 10 s; captura
  antes/después). Regla que se repite: el gate mira el DOM, la verdad está en el
  píxel — por eso el juez con ojos no es opcional. `clase-drive` además ejecuta
  los clicks al 78 % de la narración («primero se explica, luego se da click»),
  lo que explica los primeros frames «adelantados»: partir clic/explicación era
  correcto igual.

## TOCA
- src/forja/mold/flowlen.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/moldbase.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs
- scripts/escuela/parrilla.sh
- public/temis.json

## CREA
- public/escuela/lecciones/mol-s1-llenado-por-pieza.json
- public/escuela/lecciones/mol-s2-intake.json
- public/escuela/lecciones/mol-s3-base-catalogo.json
- public/evidencia/2026-08-26-superticket-moldes-por-pieza/resultados.json
- public/evidencia/2026-08-26-superticket-moldes-por-pieza/01-mol-s1-llenado-por-pieza-still.jpg
- public/evidencia/2026-08-26-superticket-moldes-por-pieza/01-mol-s2-intake-still.jpg
- public/evidencia/2026-08-26-superticket-moldes-por-pieza/01-mol-s3-base-catalogo-still.jpg

## BORRA
- (nada)

## PREEXISTENTE (otras sesiones en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
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
- public/comando/catalogo.json
- public/comando/produccion.json
- public/evidencia/2026-08-26-superticket-croquis-A-dibujar/01-mec-u2-l1-still.jpg
- public/evidencia/2026-08-26-superticket-croquis-A-dibujar/02-temis-superticket.jpg
- public/evidencia/2026-08-26-superticket-croquis-A-dibujar/resultados.json
- public/evidencia/2026-08-26-superticket-croquis-B-domar/01-mec-u2-l4-still.jpg
- public/evidencia/2026-08-26-superticket-croquis-B-domar/02-temis-superticket.jpg
- public/evidencia/2026-08-26-superticket-croquis-B-domar/resultados.json
- public/temis-deploy.json
- scripts/escuela/clase-drive.cjs
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
- scripts/temis-tablero.cjs
- scripts/video.sh
- src/forja/brep/TemisBoard.tsx
- videos/CRONOGRAMA.json
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

## EVIDENCIA
- gate del ciclo VERDE con los checks nuevos: predicado de malla vs kernel (vaso
  ±5 %), cubo bit-igual (predicado de malla ≈ dentroDadoLocal >98 % de celdas),
  intake cambia la cotización, base 156 para pieza chica / 196 para el cubo
- 3 lecciones con CLASE_OK (checks del kernel dentro del video) y 3 videos 4K
  con voz entregados a E: de iangpu y a PRIME (`/mnt/hdd/forja-videos/escuela/moldes/`)
- juez con ojos sobre los stills · orden-gate VERDE · Temis muestra 3/3

## CIERRE (2026-08-26)
**3/3 EJERCICIOS EN VERDE — con video, oráculo y juez.** `resultados.json`:
mol-s1 5/5 · mol-s2 5/5 · mol-s3 3/3 (checks del kernel dentro del video).

Videos 4K HEVC 10-bit con voz Matilda, en E: de iangpu
(`/mnt/e/forja-videos/escuela/moldes/`) y en PRIME (`/mnt/hdd/forja-videos/escuela/moldes/`):
- `LA-FORJA-MOLDES-S1-tu-pieza-se-llena-4K.mp4` — 221.5 s. Vaso del lobby → E1 →
  E2 → E3 (acero + 17 medidas) → **E4 llenado de SU malla** (vaso pintado por el
  frente, «reología: ABS Cycolac MG47 — Apéndice A») → **E5 alimentación** (una sola
  tubería desde la boquilla, 0 inalcanzables) → nota honesta: E6+ sigue del cubo.
- `LA-FORJA-MOLDES-S2-declara-tu-pieza-4K.mp4` — 153.8 s. Intake §2.1.5 con clicks
  reales: material → PP, volumen → 250,000 → la E1 se re-siembra (t_c 19.1 → 18.5 s)
  y la hoja GRANDE dice lo declarado: PP · 250,000 pzas · **base 396×396 · cold-2placas
  ×4 · $29,850 · $0.366/pza** (con ABS·100k era 196×196 ×1 · $11,342 · $0.715).
- `LA-FORJA-MOLDES-S3-la-base-se-compra-4K.mp4` — 151.4 s. Jabonera → E3 → hoja:
  **246×246 · retículo nominal HASCO/DME · «números de pieza y precio: PENDIENTES»** ·
  $19,361 · $0.649/pza.

Código (gate del ciclo **236/236**, v1-gate 10/10/10, esbuild OK):
- S1 `predicadoDeMalla` (flowlen.ts) + E4/E5 por pieza en useMoldStudio (cubo
  bit-igual por construcción: huella/semilla salen de DADO_PIEZA.local).
- S2 `intake`/`setIntake` en la bolsa del estudio + campos `intake-pared/material/q`
  en la E1 + `reologiaDe` (ABS/PP del Apéndice A; otros → ABS DECLARADO en `e4-reologia`).
- S3 `CATALOGO_BASES` + retículo 156…996 (moldbase.ts) + fuente y PENDIENTES en la hoja.
- Producto que nació del juez: la hoja de cotización GRANDE (`cotizacion-preview` →
  `cotizacion-grande` por portal, cierra con fondo/Esc).

Lo que el juez con ojos cazó en el camino (y por qué el gate no lo vio): (1) voz
adelantada a la escena → pasos partidos en clic + explicación; (2) hoja como
miniatura → hoja grande; (3) hoja «presente» en el DOM pero NO pintada (fixed
atrapado en el stacking context del panel) → portal. Tres defectos con checks en
verde: el gate mira el DOM, la verdad está en el píxel.

Deudas que quedan a la vista (no se esconden): las cotas 3D de la E3 persisten
sobre E4/E5 (ruido); el chyron tapa parte de los SUPUESTOS de la hoja en el último
paso; el tooltip «MOLD TOOLS — curso Alwis» se encima al panel; la jabonera trae
1/17 en rojo («caras PLANAS sin draft 0≠8» — su árbol no tiene draft, honesto);
`estacion5Dado`/`designSprueFeed` siguen con ABS por dentro; E6→E12 por pieza es el
siguiente sprint. Sin deploy: lo decide ian (los videos ya están en E: y PRIME).
