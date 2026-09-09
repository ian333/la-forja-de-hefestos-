# ORDEN: UNA SOLA VERDAD — cavidades, ciclo y puntaje idénticos en dictamen, molde, hoja y expediente

BASE: 53f5681

OBJETIVO: crítica del moldista al paseo (2026-09-09): «El producto se contradice en LO PRIMERO que cotizo».
Medido en las capturas del runner: el dictamen dice «71/100 · cold-2placas × 2 cav · CICLO ✗»; la hoja de
análisis de los planos dice «cold-2placas × 1 · DFM 100/100 ✓ · 2 placas (bebedero + canales) ✓»; el título
del molde en E5 dice «SPRUE DIRECTO a la base»; el enfriamiento dice 233 s de ciclo. Tres pantallas, tres
moldes distintos: un cliente lo refuta con su primera pregunta («¿cuántas cavidades?»). Al final de esta
orden hay UN `MoldPackage` por pieza: la misma especificación alimenta al dictamen, al molde 3D, a la hoja y
al expediente; cada puntaje se llama por su nombre; la fila de la máquina trae números, no palomitas; y el
runner lo mide leyendo los tres lugares y exigiendo igualdad.

## LA RAÍZ (rastreada 2026-09-09, solo lectura)
- **Dos `moldMachine` con dos specs.** El dictamen construye su `MachineSpec` desde la MALLA en
  `revisar-modelo.ts:121-130` con `annualVolume = pieza.annualVolume ?? 200_000` (`RevisarPiezaPanel.tsx:100`;
  el studio nunca lo pasa) y la pared del ráster `dfm-mesh` (`revisar-modelo.ts:142-145`). La hoja/planos
  construyen otro desde el SÓLIDO OCC en `estudio-molde-datos.ts:1479-1486` con `annualVolume ?? 100_000` y
  la pared de la lente PARED (`ForgeBRepStudio.tsx:3746-3748`). El interruptor: `moldmachine.ts:215-219`,
  `nMin = ceil(Q · ciclo / (6000·3600))` → con 200 k sale 2 cavidades, con 100 k sale 1.
- **Dos puntajes con el mismo sufijo.** 71 = `contratos.score` (cumple/criterios de los 10 subsistemas,
  `mold-contratos.ts:1194-1204`, pintado en `RevisarPiezaPanel.tsx:158`). 100 = `pkg.dfm.score`
  (`100 − 15·errores − 5·avisos`, `dfm.ts:136`, fila en `ForgeBRepStudio.tsx:3783`). El DFM es la puerta 0
  (`moldmachine.ts:182`), no el juez.
- **Dos decisiones de alimentación sin relación.** La fila «bebedero + canales» lee `pkg.recomendacion.arch`
  (etiqueta ECONÓMICA, `mold-drawing-set.ts:449` ← `mold-plano-set.ts:1617`); el título «SPRUE DIRECTO» lo
  decide `datumsColada` (`colada.ts:116-140`) en `useMoldStudio.ts:1133` con `bocaHaciaElSprue:false` clavado
  (`useMoldStudio.ts:1049`), sin consultar `pkg.diseno.alimentacion` ni `recomendacion.nCav`.
- **Dos «CICLO».** 233 s = `pkg.diseno.enfriamiento.cicloS` = Eq 3.23, 4·pared² (`moldmachine.ts:334,379`).
  El CICLO ✗ del dictamen es `feed-ciclo` (congelamiento del sprue vs pieza, Eq 9.5, `mold-contratos.ts:190-198`):
  otra cosa con el mismo rótulo (`tituloCorto`, `mold-contratos.ts:101-105`).
- **La máquina «✓ ✓» sin números** es de la orden la-inyectora-del-taller (2026-09-08): la fila
  `ForgeBRepStudio.tsx:3781` pinta `pkg.maquina.nombre` + ok; `seleccion.clampUtilPct`, `shotPct`,
  `apertura.holguraMm` y `taller.issues` existen y no se pintan.

## YA-EXISTE (prueba de ausencia)
- `RevisionInput.spec` (`revisar-modelo.ts:114`) ya acepta una spec hecha: el camino para pasarle la del
  studio existe y nadie lo usa. `piezaDesdeArbol` ya deriva la spec del sólido.
- NO existe: una función única `specDeLaPieza(intake)` con los mismos defaults (Q, pared, área proyectada)
  para ambos consumidores; un check del runner que lea cavidades/ciclo/puntaje en los tres lugares.

## TOCA
- src/forja/mold/moldmachine.ts
- src/forja/mold/revisar-modelo.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/RevisarPiezaPanel.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/mold-contratos.ts
- src/forja/mold/mold-drawing-set.ts
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- public/evidencia/2026-09-09-una-sola-verdad/resultados.json
- public/evidencia/2026-09-09-una-sola-verdad/dictamen-y-hoja.png
- public/evidencia/2026-09-09-una-sola-verdad/maquina-con-numeros.png
- public/evidencia/2026-09-09-una-sola-verdad/paseo-contactos.png

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol: comando, tutoriales, YouTube)
- public/comando/historia.json
- public/comando/metricas.json
- scripts/captions-pendientes.py
- scripts/playlist-tutoriales.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- scripts/comentarios.py (commit 11cd9b9 de la otra sesión, entre mi BASE y HEAD: no es árbol sucio)
- videos/CRONOGRAMA.json
- videos/mol-h2o-dos-gotas.json
- videos/tutorial-01-nota-de-venta.json
- videos/tutorial-02-alta-de-producto.json
- videos/tutorial-03-alta-de-cliente.json
- videos/tutorial-04-cotizacion.json
- videos/tutorial-05-facturacion-portal.json
- videos/tutorial-06-remision.json
- videos/tutorial-07-editar-nota.json
- videos/tutorial-08-orden-de-compra.json
- videos/tutorial-09-cancelar-nota.json
- videos/tutorial-10-registrar-pago.json
- videos/tutorial-11-factura-desde-erp.json
- videos/tutorial-12-factura-global.json
- videos/tutorial-13-rep-complemento-pago.json
- videos/tutorial-14-calculadora-precios.json
- videos/tutorial-15-nota-de-venta-pro.json
- videos/tutorial-16-detalle-de-producto.json
- videos/tutorial-18-ajuste-masivo-inventario.json
- videos/tutorial-20-pdf-imprimir.json
- videos/tutorial-21-nota-de-credito.json
- videos/tutorial-22-gasto-operativo.json
- videos/tutorial-23-alta-de-proveedor.json
- videos/tutorial-24-buscar-clave-sat.json
- videos/tutorial-25-reportes-jugosos.json

## EVIDENCIA (se declara ANTES de trabajar)
- Un solo `moldMachine` por pieza soltada (contar llamadas en el paseo: 1). Dictamen, molde, hoja y
  expediente leen el mismo `pkg`.
- RUNNER: check en paso 4 y paso 7 que extrae «× n cav» del dictamen y de la hoja y exige n igual; el ciclo
  del enfriamiento y el «ciclo» de la hoja son el mismo número o se rotulan distinto («ciclo Eq 3.23» vs
  «congelamiento del sprue Eq 9.5»); ningún «/100» sin su nombre («contratos 71/100», «DFM 100/100»).
- Fila de la máquina con números: «FCS HT-150SV (taller) · clamp X t de 150 (Y %) · shot Z % del barril ·
  246 entre 462 · abierto W de 1010» y, cuando no cabe, el porqué (`taller.issues[0]`).
- El título de E5 y la fila de alimentación dicen lo mismo (sprue directo O bebedero + canales), decidido
  por `pkg.diseno.alimentacion`.
- El M6 de la hoja (tornillería §12.4 para 124 kg) se marca «por revisar contra el taller», no se inventa.
- `mold-machinesizing-test`, `mold-machine-test`, `mold-base-test` y `forja-gate` en verde; orden-gate
  VERDE; censo igual; runner ≥ 7/8 sin regresión.

## CIERRE (se llena al terminar)
- orden vs entregado: idéntico en TOCA/CREA/BORRA (CREA enmendada con `paseo-contactos.png`, la hoja de
  contactos del video, como en las órdenes anteriores). Lo hecho: `Q_ANUAL_ASUMIDA` (100 000) en UN lugar
  (moldmachine.ts) para el ciclo y el dictamen; el studio construye `specPieza` una vez del sólido del
  kernel (pared de la lente PARED + intake) y se la da al dictamen (`PiezaEnRevision.spec` → `revisarModelo`
  camino `spec`); el panel ya no fuerza `?? 200_000`; la hoja de análisis lleva «× n = dictamen ✓», la fila
  «Dictamen · contratos (el juez, 69 criterios) · 71/100 · 5 violan · 12 advierten», el DFM rotulado «la
  puerta 0, no el juez», la máquina con números (clamp %, shot %, abierto/daylight, y el porqué si no cabe),
  la alimentación según cavidades («sprue directo … sin canales» con 1 cav), el M6 «por revisar contra el
  taller»; `feed-ciclo` se rotula «COLADA VS CICLO». Runner: paso 4 captura las cavidades del dictamen y
  paso 7 exige las mismas en la hoja. NO se cableó E5 a `pkg.diseno.alimentacion` (hoy coincide porque
  nCav = 1; va con T6).
- números: mold-revisar-test 0 fallas · mold-machine-test pass · mold-machinesizing-test pass ·
  ciclo-dado-test 266/266 · runner 2026-09-09 18:06 UTC dev :5194 iangpu: **7/8 ok · 27 checks** ·
  p4-3 «1 cav en el dictamen, puntaje con nombre» · p7-5 «1 cav en la hoja = dictamen, puntajes con nombre»
  (antes: 2 y 1) · 6 a medias como antes (agua/expulsores) · orden-gate VERDE · censo 8→8 / 41→41 / 46→46.
- evidencia: `public/evidencia/2026-09-09-una-sola-verdad/` — dictamen-y-hoja.png (los dos lugares con el
  mismo número), maquina-con-numeros.png, paseo-contactos.png; video 26-UNA-SOLA-VERDAD-paseo.mp4 (228 s)
  en Downloads de ambas PCs y E:\forja-videos.
- HALLAZGO que destaparon los números (no se toca aquí, se registra): la fila de la máquina dice «clamp
  2.9 % de 150 t» (≈4 t) para una carcasa PP de 106×66 mm. El clamp requerido sale de la caída de presión de
  LLENADO × `CAVITY_PRESSURE_FACTOR` 0.5 (moldmachine.ts:170-179), no de la presión de EMPAQUE; un moldista
  esperaría 20-40 t. Validar contra Eq 5.29 del libro (cup: 50 MPa → 40 t) y contra la máquina real cuando
  dispare. Propuesta de ticket: LA PRESIÓN QUE CIERRA.
- gotchas pagados: el presupuesto `<=10000` del paso 6 iba al FINAL de sus checks y «pasó» en 3 ms porque
  su reloj arrancaba después de 120 s de otros checks — el `<=ms` se mide desde que empieza SU expect: va
  PRIMERO (corregido en el camino; la próxima medición lo pone en rojo). `pkill -f "…verdad…"` por ssh mató
  al propio ssh (tercera vez): el kill vive en un script en disco (`.runner/restart-verdad.sh`).
- preguntas abiertas: ¿abrimos LA PRESIÓN QUE CIERRA antes de EL PASO 6 SE VE TRABAJAR? (es física, no
  pantalla: sin ella el «cabe en la del taller» se decide con 4 t). El overflow de la fila de la máquina en
  la hoja (texto largo se sale de la columna) es de LO QUE HAY SE VE.
