# ORDEN: SUPERTICKET CROQUIS B — DOMAR (fillet · chaflán · trim · patrón · restricciones · offset · espejo · escala)

BASE: 8655c3f

OBJETIVO: La postura: los ejercicios del libro (Bethune cap. 2) como MATRIZ herramienta ×
lección — A dibuja el perfil, B lo DOMA: redondeos, recortes, patrones, restricciones (⊥ ∥ =
tangente coincidente simetría hasta DOF=0), offset, espejo/copia y escala. Cada ejercicio =
video con voz (Matilda) + oráculo del kernel (volumen EXACTO o DOF=0) + veredicto verde/rojo,
escrito por la producción en `resultados.json` y leído por Temis. Esta corrida produce SOLO EL
PRIMER ejercicio (mec-u2-l4, redondeos de boceto: fillet R8 + chaflán 8, vol 23,542.45) para
probar el formato de superticket de punta a punta.

## YA-EXISTE (prueba de ausencia)
- La ESCUELA ya existe: `public/escuela/lecciones/mec-u2-l4.json` (+ l5, l6) con pasos `dice` +
  `gestos` + `check`; runner `scripts/escuela/clase-drive.cjs`; producción
  `scripts/escuela/parrilla.sh` (voz → drive → 4K → entrega). NO se reinventa: se corre.
- Temis (`scripts/temis-tablero.cjs` + `src/forja/brep/TemisBoard.tsx`) ya lee las órdenes; el
  DIFF es que entienda `## EJERCICIOS` + `resultados.json` (lo hace la orden A y esta a la vez:
  mismo código, dos supertickets).
- l5 (trim círculo-círculo) está APARCADA por LO-RECIO #7-8: el trim entre círculos del
  sketcher no cierra el lazo. Queda declarada y `pendiente`, no se fuerza en verde.
- Las lecciones l11..l14 (restricciones, offset, espejo/copia, escala) NO existen todavía: se
  declaran como NUEVA y quedan `pendiente`. No se crean en esta corrida.

## EJERCICIOS
- mec-u2-l4 · Redondeos de boceto (fillet R8 + chaflán 8) · line sfillet schamfer · vol 23,542.45 EXACTO
- mec-u2-l5 · El flat de la flecha (trim) · circle line trim · APARCADA: trim círculo-círculo (LO-RECIO #7-8)
- mec-u2-l6 · La brida (patrón polar) · circle array · vol 56,699
- mec-u2-l11 · El croquis domado (⊥ ∥ = tangente coincidente simetría, DOF=0) (NUEVA) · sk-con-* · DOF = 0
- mec-u2-l12 · El anillo por offset (NUEVA) · offset · vol exacto del anillo
- mec-u2-l13 · Espejo y copia (NUEVA) · mirror copy · oráculo por definir
- mec-u2-l14 · Escalar (NUEVA) · scale · vol ×2.25 exacto

## TOCA
- public/escuela/lecciones/mec-u2-l4.json
- scripts/escuela/parrilla.sh
- scripts/temis-tablero.cjs
- src/forja/brep/TemisBoard.tsx
- public/temis.json

## CREA
- public/evidencia/2026-08-26-superticket-croquis-B-domar/resultados.json
- public/evidencia/2026-08-26-superticket-croquis-B-domar/01-mec-u2-l4-still.jpg
- public/evidencia/2026-08-26-superticket-croquis-B-domar/02-temis-superticket.jpg

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
- public/evidencia/2026-08-26-superticket-croquis-A-dibujar/01-mec-u2-l1-still.jpg
- public/evidencia/2026-08-26-superticket-croquis-A-dibujar/02-temis-superticket.jpg
- public/evidencia/2026-08-26-superticket-croquis-A-dibujar/resultados.json
- public/temis-deploy.json
- scripts/ciclo-dado-test.cjs
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
- video de mec-u2-l4 entregado en 4K a E: (iangpu) y a PRIME; ruta en `resultados.json`
- oráculo del kernel VERDE en el drive: `meta.json` con todos los checks de la lección en
  pasa (vol 23,542.45 dentro de la ventana de la lección) → `"estado":"verde"`, `"checks":"n/N"`
- still del video (frame del sólido con fillet y chaflán) en `01-mec-u2-l4-still.jpg`
- tarjeta de Temis en el lobby con la barra `1/7 ejercicios` y la lista `temis-ejercicios` con
  una fila por ejercicio (verde l4, gris el resto) → captura `02-temis-superticket.jpg`
- `node scripts/temis-tablero.cjs` sale 0 y `public/temis.json` trae `superticket:true`,
  `ejercicios[7]` y `progreso:{verdes:1,total:7}` en esta tarjeta
- orden-gate VERDE con esta orden vigente
- censo esperado: igual (canvas 8 / vite 41 / html 46)

## CIERRE (2026-08-26)
**Ejercicio 1 (mec-u2-l4, redondeos de boceto) = ROJO.** El kernel dio 2/2 con el volumen
EXACTO (23,542.453 mm³ = 60×40×10 − 64·(1−π/4)·10 − 32·10) y el 4K está en E: y PRIME, pero
el JUEZ CON OJOS lo reprobó: el paso que enseña (el fillet y el chaflán) no se ve. Verde =
kernel Y ojos; aquí pasó uno. El formato de superticket quedó probado de punta a punta
(comparte código con la orden A: mismo `temis-tablero.cjs`/`TemisBoard.tsx`/`parrilla.sh`).

- **orden vs entregado**: desviaciones compartidas con A: `clase-drive.cjs` parchado (declarado
  en TOCA de A, un solo agente lo aplicó: ready-wait + timeout real); `mec-u2-l4.json` sin
  cambios (0 líneas: btn-sketch → chooser-plane-xy, sk-tool-line + sk-dyn-a/b/go,
  sk-tool-sfillet + sk-fillet-r, sk-tool-schamfer + sk-chamfer-d, sk-finish, btn-extrude,
  input-altura siguen vivos); still de `parrilla.sh` al 90 % (`PARRILLA_STILL_FRAC`) porque
  el 40 % caía a MEDIO trazo del rectángulo; barra de Temis con rojos.
- **sonda (laptop, prod, SOFTGL)**: runner del repo → CLASE_FATAL pasos=0 (mismo Timeout
  30000ms en clase-drive.cjs:115; probe de 130 s: `ready=false`, `error=null`, estado-texto
  "Lienzo vacío"). Con el parche: CLASE_OK 6/6 pasos, 2/2 checks (p02 rectángulo dof=4; p05
  vol 23542.45298511276 mm³ en la ventana 23300..23900), euler 2, ops [extrude]. Ritmo: en
  SwiftShader p02 tarda 216 s (18 gestos con glide); la clase ~7 min. El `probe` de p05
  imprime 28250.94 (altura default 12) antes de que asiente altura=10 — cosmético, el check
  reintenta y lo cacha.
- **grabación (iangpu, dev :5178, GPU real)**: voz XTTS 6 wavs → CLASE_OK intento 1, 2/2
  checks, 0 errores → 4K NVENC. Master: 87.57 s, 3840×2160, hevc yuv420p10le 30 fps + aac
  48 kHz mono, 23,581,119 bytes, md5 `7e08d4556fe668ebd9385ed60b623c20` idéntico en iangpu
  `dist-video/escuela/`, `/mnt/e/forja-videos/escuela/bethune/U02/ESCUELA-MECANICA-U2L4-redondeos-de-boceto-4K.mp4`
  y PRIME `/mnt/hdd/forja-videos/escuela/bethune/U02/`. Serie A→B en `/tmp/serie.sh`
  (setsid): A_FIN 21:13:06 exit 0 → B_FIN 21:15:58 exit 0. Log: iangpu `/home/ian/parrilla-mec-u2-l4.log`.
- **entrega**: mismo fallo de PRIME que A (`mkdir … /mnt/hdd/forja-videos: Permission
  denied`), misma cura (sudo -n + chown) y re-corrida reanudable → PRIME ok, md5 igual.
- **juez con ojos (stills 10/50/90 %) — REPRUEBA**: (1) en p03 el chyron manda "clic en la
  esquina de arriba a la derecha… radio de ocho" y en pantalla NO hay fillet, ni la
  herramienta activa, ni el campo `sk-fillet-r`; la entrada dinámica sigue en "punto
  inicial" y el cursor está en el botón ↵ a media pantalla de la esquina: voz e imagen no
  cuentan lo mismo. (2) El rectángulo 60×40 ocupa ~130×85 px de 1400 (~9 %): un fillet R8
  sería un arco de ~17 px, invisible. (3) La voz dice "sesenta por cuarenta" y no hay cota
  ni valor en el lienzo. (4) Apertura con la tarjeta de onboarding ("Cascarón + Draft")
  encimada al chyron: texto de OTRO contexto en una clase de redondeos. (5) Cierre: la
  pieza SÍ se ve con fillet y chaflán y el volumen cuadra (24000 − 137.4 − 320 = 23542.6),
  pero el dato vive en la barra de estado en letra chica y el panel EXTRUIR sigue abierto.
- **números**: `temis-tablero.cjs` sale 0; `temis.json` → `superticket:true`, `ejercicios[7]`,
  `progreso:{verdes:0,rojos:1,total:7}`; captura en iangpu (Chrome GPU 1900×1000): tablero con
  las 3 tarjetas superticket y sus barras ("0/7 ejercicios · 1 rojo" ×2, "0/3" la de
  moldes, ajena), detalle B con 7 filas (l4 rojo, l5 gris APARCADA, resto gris) y galería
  1 foto 1400×788. orden-gate VERDE; censo 8/41/46 (+0).
- **evidencia**: `public/evidencia/2026-08-26-superticket-croquis-B-domar/{resultados.json,
  01-mec-u2-l4-still.jpg (frame 90 %: la placa con fillet y chaflán), 02-temis-superticket.jpg
  (el tablero con las barras)}`.
- **NO se logró**: video APROBADO de mec-u2-l4. l5 sigue APARCADA (trim círculo-círculo,
  LO-RECIO #7-8), l6 pendiente, l11..l14 sin lección. `src/` intacto. Sin deploy.
- **preguntas abiertas (decisión de ian)**: (a) zoom-fit del croquis (gesto de lección vs
  auto-fit del sketcher); (b) sincronía voz↔gesto en p03: ¿la lección espera al gesto antes
  de la frase, o se captura el still a mitad del gesto para juzgarlo?; (c) quitar la tarjeta
  de onboarding cuando corre una lección (producto).
