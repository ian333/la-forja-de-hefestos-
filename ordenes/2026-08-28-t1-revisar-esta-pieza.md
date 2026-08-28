# ORDEN: T1 · REVISAR ESTA PIEZA — la revisión vive DENTRO del CAD, de una en una

BASE: 3f86e47

OBJETIVO: ian, con el panel de lote abierto encima del CAD: «ME ESTORBA Y NO ME SIRVE DE NADA
REVISAR EN VOLUMEN. PREFERIRÍA REVISAR DE 1 EN 1 Y ME GUSTARÍA SEGUIR DENTRO DE LA FORJA, NO EN
OTRA PANTALLA — pues ¿para qué hicimos un sistema CAD?».

Tiene razón en las tres cosas: el panel es `position:fixed; inset:0` (tapa el CAD entero), pinta
12 modelos que a él no le importan, y su pieza aparece como una FILA de tabla en vez de como la
pieza que está viendo. Un CAD que te saca del CAD para hablarte de tu pieza está mal hecho.

Al terminar: sueltas tu archivo y **se vuelve la pieza del visor**; la revisión aparece en el
panel lateral del CAD (donde ya viven MOLDE, ANÁLISIS y EL CICLO), ordenada por severidad, para
ESA pieza. El modo lote no muere: se degrada a un botón para regresiones (decisión de ian:
«B DEGRADA»), porque es lo único que corre las 20 Hammond de un jalón y ahí se midió el 2/20.

Es el contenedor de T2 (capas), T3 (texto con hilo), T4 (voz) y T5 (expediente): sin esto, los
otros no tienen dónde pararse.

## EJERCICIOS
- una-pieza-visor · Mi STL se vuelve la pieza del visor, orbitable · malla en el Canvas · gear.stl entra y el visor muestra 4,204+ triángulos girables (no una estampa); el bbox en pantalla = el bbox real ±2 %
- una-pieza-panel · La revisión vive en el panel lateral, no encima del CAD · RevisarPiezaPanel · con el panel abierto el viewport sigue visible y orbitando (área de canvas ≥60 % del cuadro)
- una-pieza-severidad · Los hallazgos de ESA pieza, del más grave al menos · fila por criterio · el engrane lista sus 7 violaciones antes que sus advertencias, con su § cada una
- una-pieza-step · Un STEP también se vuelve la pieza (camino del kernel) · importedStep · 1594C Lid.stp entra por la misma puerta y el volumen del visor = 33,294.3 mm³ ±0.5 %
- lote-degradado · El lote deja de ser la puerta y queda como botón de regresiones · demote · abrir "Abrir archivo" NUNCA abre el lote; el lote sigue disponible y sigue corriendo las 12+N piezas
- una-pieza-sin-regresion · Nada de lo que ya servía se rompe · gate del ciclo · 242/242 · 0 fallan y el cargador (6 checks) sigue verde

## YA-EXISTE (prueba de ausencia — medido hoy)
- **STEP → visor: YA FUNCIONA.** `ForgeBRepStudio.tsx:3761` — `mainShape = importedStep ?
  importSTEP(oc, importedStep) : …`: un STEP importado REEMPLAZA la pieza principal. El lobby ya
  puede mandarle el archivo (`importStepText`).
- **Malla → visor: NO existe.** El render principal se arma desde el `result` del kernel; una
  malla STL no es B-Rep y hoy no tiene forma de mostrarse. Ese es el hueco real de este ticket.
- El renderer de la pieza (≈l.2481-2509) ya acepta `mesh.positions` + `feaColors` por vértice:
  el sustrato para mostrar una malla cruda y (en T2) pintarla, existe.
- `revisarModelo({mesh|spec})` — el motor de la revisión de UNA pieza ya es de una pieza; el
  lote solo lo llama en bucle. No se reescribe nada de física.
- `RevisarLotePanel.tsx` — de aquí salen la tabla, el drill-down, las láminas y el expediente;
  el panel nuevo REUSA sus piezas (no se copia: se extrae lo compartido).
- `MoldPanels.tsx` ya hospeda paneles DOM dentro del CAD (MoldTreePanel, MoldAnalisisPanel,
  CicloPanel): ahí vive el nuevo, sin `<Canvas>` nuevo (regla #0.7).

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/ProjectSwitcher.tsx
- src/forja/mold/RevisarLotePanel.tsx
- src/forja/mold/stl.ts
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- src/forja/mold/RevisarPiezaPanel.tsx
- public/evidencia/2026-08-28-t1-revisar-esta-pieza/resultados.json
- public/evidencia/2026-08-28-t1-revisar-esta-pieza/01-una-pieza-visor-still.jpg
- public/evidencia/2026-08-28-t1-revisar-esta-pieza/02-una-pieza-panel-still.jpg

## BORRA
- (nada)

## PREEXISTENTE (otras sesiones + binarios fuera del repo — NO son míos)
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
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- scripts/guiones/ostrom.txt

## EVIDENCIA (declarada ANTES de trabajar)
- `node --import tsx scripts/ciclo-dado-test.cjs` VERDE (242 + los checks nuevos)
- juez con ojos: still del engrane de ian VIVO en el visor con el panel al lado (no encima)
- still del panel lateral con los hallazgos por severidad
- `node scripts/orden-gate.cjs --orden ordenes/2026-08-28-t1-revisar-esta-pieza.md` VERDE
- Temis VERDE con este superticket en su n/6
- censo esperado: canvas IGUAL (el panel es DOM; la malla va dentro del Canvas que ya existe)

## CIERRE (se llena al terminar)
