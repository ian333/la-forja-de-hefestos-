# ORDEN: EL CARGADOR, DONDE SE BUSCA — abrir mi archivo desde el lobby

BASE: f5a581f

OBJETIVO: ian probó el cargador que se cerró hace una hora y **no lo encontró**: «primer error,
nunca encontré el botón para subirlo; le di click en ＋ Nuevo y solo abrió el panel, no pude
importar nada». Tiene razón y el defecto es de ubicación, no de motor: el cargador funciona
(6/6 en el gate) pero vive a TRES clics escondidos — pestaña SIMULACIÓN → desplegar el panel de
simulación (que arranca COLAPSADO) → `📋 REVISAR EN VOLUMEN` → y ahí sí, `＋ Tu pieza`. Él lo
buscó donde lo busca cualquiera: en el LOBBY, junto a `＋ Nuevo`, que es literalmente el botón
de "empezar algo".

Al terminar: en el lobby, al lado de `＋ Nuevo`, hay **`＋ Abrir archivo (.stl · .step)`**.
Eliges tu pieza del disco y la suite abre REVISAR EN VOLUMEN con ELLA ya cargada y seleccionada
— un clic, un archivo, resultados. El botón de adentro del panel se queda (es donde agregas la
segunda y la tercera).

Esto es una ENMIENDA de la orden `2026-08-28-cargador-mi-pieza.md` (cerrada, 6/6): el motor no
se toca, solo se mueve la puerta a donde el operador ya está parado.

## EJERCICIOS
- puerta-lobby · El botón vive junto a ＋ Nuevo, donde ian lo buscó · ps-abrir-archivo input-ps-archivo · captura del lobby con los DOS botones visibles sin desplegar nada
- puerta-un-clic · Elijo el archivo y la suite abre el panel con MI pieza seleccionada · onAbrirArchivo → revisarLoteOn · subir 1594C Lid.stp desde el lobby deja la fila "1594C Lid (tuya)" SELECCIONADA (score 70/100) sin tocar la pestaña SIMULACIÓN
- puerta-stl · Lo mismo con una malla · parseSTL por la misma puerta · rpi4-bottom.stl desde el lobby → fila "rpi4-bottom (tuya)" con 4,204 triángulos y score 75/100
- puerta-error · Un archivo que no sirve lo dice en el panel, no en silencio · rl-error-carga · basura.stl desde el lobby → barra roja "STL vacío o ilegible" y el lote sigue calculado
- puerta-sin-regresion · El camino viejo sigue vivo · gate del ciclo · `ciclo-dado-test.cjs` sigue en 242/242 y el botón de adentro del panel sigue cargando

## YA-EXISTE (prueba de ausencia)
- `src/forja/mold/stl.ts::mallaDesdeArchivo` — el motor del cargador, cerrado ayer: decide por
  extensión, cuenta sólidos, devuelve malla + notas. NO se toca.
- `src/forja/mold/RevisarLotePanel.tsx` — ya tiene `input-mi-pieza`, `mias`, `meshCache`,
  `rl-error-carga` y el aviso ámbar. Lo que NO tiene: recibir un archivo YA elegido desde fuera.
- `src/forja/brep/ProjectSwitcher.tsx` — el LOBBY. Tiene `＋ Nuevo` (`ps-new`, l.179) y el
  buscador; es presentacional puro (todo por props: `onNew`, `onPick`). Lo que NO tiene: una
  acción de abrir archivo.
- `src/forja/brep/ForgeBRepStudio.tsx` — monta el lobby (l.6703) y el panel (l.6527,
  `revisarLoteOn`). Es quien puede cablear uno con otro.
- El CAD ya tiene `Importar STEP` en el menú Opciones, pero va al ÁRBOL DE FEATURES (otro
  camino, otro propósito): por eso no sirve para esto y por eso confunde. Se deja como está.

## TOCA
- src/forja/brep/ProjectSwitcher.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/RevisarLotePanel.tsx
- public/temis.json

## CREA
- public/evidencia/2026-08-28-cargador-donde-se-busca/resultados.json
- public/evidencia/2026-08-28-cargador-donde-se-busca/01-puerta-lobby-still.jpg
- public/evidencia/2026-08-28-cargador-donde-se-busca/02-puerta-un-clic-still.jpg

## BORRA
- (nada)

## PREEXISTENTE (otras sesiones en paralelo + binarios fuera del repo — NO son míos)
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
- docs/CANON-VIDEO.md
- public/comando/analisis-ig.json
- scripts/analisis-reels.py
- src/comando/ComandoCenter.tsx

## EVIDENCIA (declarada ANTES de trabajar)
- Juez con ojos: captura del LOBBY donde se lee `＋ Abrir archivo` al lado de `＋ Nuevo` sin
  desplegar ni un panel (es el defecto exacto que ian reportó).
- Captura del panel abierto DESDE el lobby con la fila "(tuya)" seleccionada y su score.
- `node --import tsx scripts/ciclo-dado-test.cjs` sigue **242/242** (cero regresión del motor).
- `node scripts/orden-gate.cjs` VERDE · `node scripts/temis-tablero.cjs` VERDE con este
  superticket en su n/5.
- censo esperado: canvas/vite/html IGUAL.

## CIERRE (2026-08-28)
**5/5 EN VERDE.** El cargador ya vive donde ian lo buscó: en el LOBBY, junto a `＋ Nuevo`.

- `ProjectSwitcher.tsx`: prop `onAbrirArchivo` + `＋ Abrir archivo` (`ps-abrir-archivo`, input
  `input-ps-archivo`). En CONTORNO dorado, no relleno: se lee como hermana de `＋ Nuevo` sin
  competirle (crear sigue siendo la acción principal).
- `ForgeBRepStudio.tsx`: `archivoDelLobby` → abre `REVISAR EN VOLUMEN` y le pasa el archivo.
- `RevisarLotePanel.tsx`: prop `archivoInicial` + **una sola función `cargarArchivo`** para las
  DOS entradas (lobby y botón de adentro) — dos puertas, una verdad. La pieza además queda
  SELECCIONADA al cargarse (`setSel`): viniste a verla a ella, no a la primera de la lista.

Medido con ojos (arnés `forja-drive`, GPU real, 3/3 gestos sin error):
- El lobby muestra los DOS botones al abrirse, sin desplegar nada (01-puerta-lobby).
- `1594C Lid.stp` elegido DESDE el lobby → el panel abre con `1594C Lid (tuya)` seleccionada,
  score **70/100**, cold-2placas × 2 cav, con su planta del núcleo y los 5 pines ⌀10 mm
  (02-puerta-un-clic). **Nunca se tocó la pestaña SIMULACIÓN.**
- Gate del ciclo **242/242 · 0 fallan**: cero regresión (el motor no se tocó, solo la puerta).

Lo que ian reportó y queda resuelto: «nunca encontré el botón para subirlo; le di click en
＋ Nuevo y solo abrió el panel». Era verdad: el cargador estaba a tres clics escondidos
(pestaña → panel colapsado → REVISAR EN VOLUMEN). La lección para el canon: **un feature que
pasa su gate pero vive donde nadie lo busca, no existe.** El gate medía que cargara; nadie
medía que se ENCONTRARA.

Deudas que siguen (heredadas del ticket anterior, no se esconden): no se puede renombrar la
pieza ni declararle pared/material desde la UI; las cargadas viven en la sesión (sin
biblioteca); y **elegir cuál sólido moldear** sigue siendo el siguiente ticket — es la causa
medida de que el v1-gate con las 20 Hammond dé `parten 2/20`.
