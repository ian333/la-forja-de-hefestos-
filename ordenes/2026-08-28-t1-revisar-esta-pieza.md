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
- videos/econ-ostrom.json

## EVIDENCIA (declarada ANTES de trabajar)
- `node --import tsx scripts/ciclo-dado-test.cjs` VERDE (242 + los checks nuevos)
- juez con ojos: still del engrane de ian VIVO en el visor con el panel al lado (no encima)
- still del panel lateral con los hallazgos por severidad
- `node scripts/orden-gate.cjs --orden ordenes/2026-08-28-t1-revisar-esta-pieza.md` VERDE
- Temis VERDE con este superticket en su n/6
- censo esperado: canvas IGUAL (el panel es DOM; la malla va dentro del Canvas que ya existe)

## CIERRE (2026-08-28)
**6/6 EN VERDE.** Gate del ciclo **242 → 245 · 0 fallan**.

Lo que quedó funcionando: sueltas tu archivo en `＋ Abrir archivo` y **tu pieza aparece en el
visor del CAD** (orbitable, con sección y con el canal de color por vértice listo para T2), y su
dictamen sale en el **costado**, no encima. El lote se degradó a `⋯ modo lote (regresiones)`.

- `stl.ts::mallaParaElVisor` — completa lo que el renderer del kernel exige (normales POR CARA,
  faceIds, faceGroups). Un STL no trae topología: se declara UNA cara en vez de inventarlas.
- `stl.ts::bboxDeMalla` — mide la pieza para encuadrar la cámara y para el gate.
- `RevisarPiezaPanel.tsx` (NUEVO, DOM puro — censo de Canvas intacto): score, hallazgos por
  severidad con su § y su detalle, avisos del cargador arriba, y **lo que falta dicho en voz
  alta** (T2-T5) para que el panel no parezca completo cuando no lo está.
- `ForgeBRepStudio.tsx`: estado `piezaMalla`, rama de render con el MISMO `SolidMesh`, panel
  montado en el aside de simulación, y el lobby ya no abre el lote.

Medido: gear.stl → 3,314 triángulos · bbox **22.0 × 57.0 × 10.0 mm** (diagonal 61.9) · dictamen
**64/100 · ✗7 ⚠15 ✓44 🔌1** — los mismos números en el gate y en la pantalla.

**Lo que cazó el juez con ojos (3 defectos, ninguno lo veía el gate):**
1. La tarjeta de bienvenida "TU PRIMERA PIEZA" seguía encima **tapando la pieza recién abierta**.
2. La barra de estado decía "Lienzo vacío" con una pieza cargada. Ahora dice la verdad:
   «gear — malla del operador (3,314 triángulos) · sin caras de kernel: para acotar o partir,
   importa un STEP».
3. **`orbitTo` recibe GRADOS, no radianes** (`ForgeBRepStudio:2981` hace `az*π/180`). Le pasé
   radianes y la cámara quedaba a medio grado del suelo: TODA pieza se veía "de canto" como un
   barril. Dos corridas creyendo que era el encuadre, hasta que medí la pieza (22×57×10 = una
   placa, no un cilindro) y fui a leer el rig. **Medir la pieza fue lo que destapó el bug de la
   cámara.**

Deudas declaradas (no escondidas):
- Un STEP entra como malla; todavía no se vuelve pieza del árbol de features (no se puede acotar
  ni partir desde ahí).
- "CARAS DEL SÓLIDO 0" con una malla: es correcto (no hay topología) pero se lee como roto.
- La pieza cargada vive en la sesión; al recargar se va.
- El panel dice qué le falta (T2-T5) porque le falta: capas sobre el sólido, hilo a la geometría,
  voz y expediente con consecuencia visible.
