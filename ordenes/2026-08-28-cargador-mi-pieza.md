# ORDEN: SUPERTICKET CARGADOR · suelta TU pieza (.stl · .step) y la máquina corre

BASE: 29f6e54

OBJETIVO: ian (2026-08-28), después de ver el kit de piezas en su Downloads: «le entro a ese
cargador (soltar tu STL/STEP y que corra) — esto ya debería haber estado en Temis como un
ticket». Hoy NO hay forma de que ian cargue SU archivo al camino de molde: el CAD solo acepta
`.step/.stp` y los manda al árbol de features (no al panel de revisión), y el panel
`📋 REVISAR EN VOLUMEN` trae su lista **fija en el código** (`RevisarLotePanel.tsx`, const `LOTE`,
12 entradas). El parser de STL, el tesela del kernel y el motor de revisión YA EXISTEN y están
probados: lo único que falta es la plomería — un input de archivo que decida por extensión,
arme la `MeshLike` y llame al MISMO `revisarModelo` que ya corre el lote.

Al terminar: abres el panel, sueltas `rpi4-bottom.stl` o `1594C Lid.stp` desde
`Downloads/FORJA-MOLDES-PRUEBA/`, y tu pieza aparece como una fila más de la tabla, con sus
69 contratos de Kazmer, su DFM, su campo de flujo y su expediente — sin tocar código.

Lo que este ticket NO hace (y se declara): elegir CUÁL sólido moldear cuando el STEP trae varios
(1553B trae 10). Aquí solo se MIDE y se DICE en pantalla; escoger es el ticket siguiente
(`kazmer-s4-partir-tu-pieza`, sprint 1 de la lectura de Kazmer).

## EJERCICIOS
- carga-stl-binario · Sueltas un STL binario y la máquina lo revisa · input-mi-pieza parseSTL revisarModelo · rpi4-bottom.stl → 4,204 triángulos · volumen 17,036.2 mm³ ±0.5 % · área 24,028.3 mm² · aparece fila con score
- carga-stl-ascii · El MISMO sólido en ASCII entra igual · rama ASCII de parseSTL · el ASCII derivado del binario da 17,036.2 mm³ ±0.1 % (misma pieza, mismo número)
- carga-step-tesela · Sueltas un STEP y se tesela solo · getOCCT importSTEP tessellate · 1594C Lid.stp → malla 33,282.6 mm³ dentro de 0.5 % del volumen exacto del kernel 33,294.3 mm³ (medido: 0.04 %)
- carga-multisolido-declarado · Un STEP con varios sólidos lo DICE, no lo esconde · TopExp_Explorer SOLID · 1553B.stp → la nota dice "10 sólidos fusionados" y la malla da 74,775.5 mm³ ±0.5 % del kernel 74,920.6
- carga-basura · Un archivo corrupto da mensaje claro y el panel sigue vivo · manejo de error · un .stl de 40 bytes de basura → error legible en pantalla, cero excepción sin capturar, las otras filas siguen calculadas
- carga-con-ojos · El JUEZ CON OJOS ve tu pieza en la tabla · forja-drive upload + still 1600×1000 · captura donde se lee el nombre del archivo cargado y su score, sin que el panel tape la tabla

## YA-EXISTE (prueba de ausencia)
- `src/forja/mold/stl.ts::parseSTL` — binario y ASCII, browser y node, sin dependencias.
  Probado hoy: rpi4 4,204 tris / 17,036.2 mm³; phone-holder 1,436 / 41,149.3; tapa médica 5,614 / 4,342.6.
- `src/forja/brep/occt.ts::importSTEP` (l.1956) + `tessellate` (l.1744) + `getOCCT` (l.134, la
  instancia que el CAD ya arrancó en `ForgeBRepStudio.tsx:3717` vía `_setActiveOCCT`).
  Medido hoy: STEP→malla queda a 0.04–0.19 % del volumen exacto del kernel.
- `src/forja/mold/revisar-modelo.ts::revisarModelo` — acepta `{mesh, nombre, plastic,
  annualVolume, totalVolume, flowMaxVoxels}` (camino B) y devuelve fila + contratos + DFM +
  campo + expediente. Es el MISMO motor del lote: no se reescribe nada.
- `src/forja/mold/RevisarLotePanel.tsx` — la pantalla ya pinta tabla, drill-down, láminas y
  expediente; su `LOTE` es una const con 6 specs + 6 STL cableados por ruta de repo.
  Lo que NO tiene: un `<input type="file">`. Ese es el diff.
- `scripts/forja-drive.cjs` — arnés de gestos reales por `data-testid` (`tclick`, `fill`,
  `drag`) con screenshot por paso. Lo que NO tiene: subir un archivo (`setInputFiles`).
- `scripts/ciclo-dado-test.cjs` — el gate del molde (236/236 verde hoy en iangpu). Los checks
  del cargador van AQUÍ, no en un script nuevo.
- NO existe en el repo: ningún `<input type="file">` que acepte `.stl` (verificado con grep
  sobre `src/`: solo `input-import` .json e `input-import-step` .step, ambos del árbol del CAD).

## TOCA
- src/forja/mold/stl.ts
- src/forja/mold/RevisarLotePanel.tsx
- scripts/forja-drive.cjs
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- public/evidencia/2026-08-28-cargador-mi-pieza/resultados.json
- public/evidencia/2026-08-28-cargador-mi-pieza/01-carga-stl-binario-still.jpg
- public/evidencia/2026-08-28-cargador-mi-pieza/02-carga-step-tesela-still.jpg
- public/evidencia/2026-08-28-cargador-mi-pieza/03-carga-multisolido-declarado-still.jpg

## BORRA
- (nada)

## PREEXISTENTE (otras sesiones en paralelo + binarios que ian dejó fuera del repo — NO son míos)
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
- docs/la-fuente-esquematico.pdf
- docs/inyectora/LISTA-MATERIAL.md
- ml-resultados.json
- scripts/metricas-instagram.py
- scripts/subir-youtube.py
- src/cinematic/CinematicMolecule.tsx
- videos/mol-h2o-la-silla.json

## EVIDENCIA (declarada ANTES de trabajar)
- `node --import tsx scripts/ciclo-dado-test.cjs` en iangpu: VERDE con los checks nuevos del
  cargador (sube de 236; el número exacto se anota al cierre). Los 5 oráculos numéricos de
  arriba salen del gate, no de la vista.
- Juez con ojos: 3 stills 1600×1000 tomados con `forja-drive.cjs` subiendo archivos REALES
  desde `Downloads/FORJA-MOLDES-PRUEBA/` contra el vite dev de iangpu.
- `node scripts/orden-gate.cjs --orden ordenes/2026-08-28-cargador-mi-pieza.md` VERDE.
- `node scripts/temis-tablero.cjs` VERDE, este superticket visible con su n/6.
- censo esperado: canvas/vite/html IGUAL (cero pantallas nuevas — es un input en un panel que
  ya existe).

## CIERRE (2026-08-28)
**6/6 EJERCICIOS EN VERDE — con números y con ojos.** Gate del molde **236 → 242 · 0 fallan**.

Lo que quedó funcionando: en `📋 REVISAR EN VOLUMEN` hay un botón **`＋ Tu pieza (.stl · .step)`**.
Sueltas un archivo de tu disco y aparece como una fila más del lote, con sus contratos de Kazmer,
su DFM, su campo de flujo, sus láminas del libro y su expediente. Cero física nueva: la malla
entra al MISMO `revisarModelo` que ya corría el lote de arranque.

- `stl.ts::mallaDesdeArchivo` decide por extensión: `.stl` → `parseSTL` (rama ligera, sin kernel);
  `.step/.stp` → `getOCCT` + `importSTEP` + `tessellate` por import DINÁMICO (el módulo lo usan
  scripts de node que no arrancan OCCT). Devuelve malla + fuente + **sólidos contados** + volumen
  exacto del kernel + notas.
- `RevisarLotePanel.tsx`: `LOTE` (const) pasó a `piezas = [...LOTE, ...mias]`; la malla cargada se
  deja en `meshCache` y el corredor la toma de ahí (no re-fetch). Input oculto `input-mi-pieza`
  dentro de su label, barra de error `rl-error-carga`, aviso ámbar `rl-aviso-carga`.
- `forja-drive.cjs`: acción **`upload`** (`setInputFiles`) — el input vive `display:none` dentro
  del label, así que un clic no lo abre; se le alimenta el archivo como hace el navegador.
- `ciclo-dado-test.cjs`: 6 checks nuevos con los oráculos medidos ANTES de construir.

Números (los 3 primeros se midieron el 2026-08-28 antes de escribir una línea de UI):
- rpi4-bottom.stl → 4,204 tris · 17,036.2 mm³ · 24,028.3 mm² · score **75/100** en pantalla.
- el MISMO sólido en ASCII → 17,036.2 mm³ (idéntico).
- 1594C Lid.stp → 1 sólido · malla 33,282.6 vs kernel 33,294.3 = **0.04 %** · score 70/100.
- 1553B.stp → **10 sólidos** · aviso ámbar arriba: "se están midiendo FUSIONADOS… la cotización
  sale de más". (El intake del banco decía 8; el explorador del kernel cuenta 10 — el dato bueno
  es el del kernel.)
- basura de 40 bytes → barra roja "STL vacío o ilegible"; `.iges` → "extensión no soportada".

**Lo que cazó el JUEZ CON OJOS (y el gate no):**
1. El panel de simulación arranca COLAPSADO: `btn-revisar-lote` no existe hasta expandirlo. La
   primera corrida del arnés murió ahí (`TimeoutError`) — se vio en la captura, no en el log.
2. El aviso del multi-sólido existía pero vivía al FONDO del drill-down, bajo el pliegue: el
   operador habría cotizado un conjunto fusionado sin enterarse. El check del gate estaba VERDE
   porque miraba el objeto `notas`, no el píxel. Se subió al encabezado, en ámbar.

Deudas que se dejan a la vista (no se esconden):
- La barra superior se apretó: con 3 piezas cargadas el título se parte en dos líneas y los
  toggles empiezan a apilarse. Legible, pero no bonito.
- El nombre de la pieza es el del archivo (`1553B (tuya)`): no hay forma de renombrarla ni de
  declararle pared/material/volumen anual desde la UI (usa los defaults DECLARADOS del camino B).
- **Elegir cuál sólido moldear sigue pendiente** — es el siguiente ticket y ahora la pantalla lo
  dice en voz alta. Es la causa medida de que el v1-gate con piezas reales dé 2/20 parten.
- Las piezas cargadas viven en la sesión: al recargar la página se van (no hay biblioteca).
