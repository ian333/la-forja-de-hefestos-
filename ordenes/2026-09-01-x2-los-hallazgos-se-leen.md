# ORDEN: X2 · LOS HALLAZGOS SE LEEN — el dictamen deja de ser un muro

BASE: cad0b11
TIPO: imprevisto

OBJETIVO: ian, con su pieza en el visor y el Foco prendido: «el panel está lleno de demasiadas
cosas, no es mate, no se parece a una interfaz futurista como en Horizon». El X1 limpió el
encabezado y sacó lo que no puede correr. Queda **lo último que no parece Horizon**: la lista de
hallazgos debajo de la leyenda, que se lee así en su columna:

> «el alabeo lo decide la TOPOLOGÍA: un marco con ventana está desacoplado y no alabea; un área
> cerrada pandea si (s_borde − s_centro) > 0.44·(h/W)²»

…cortado en doce renglones de tres palabras.

## MEDIDO ANTES DE TOCAR (con `screw-cap-medical.stl`, la pieza de ian)

- **69 criterios · 18 duelen** (4 violan).
- El campo `criterio`, que hoy se usa como TÍTULO, mide **118 caracteres de mediana** (máx 145).
  Eso no es un título: es la regla completa del libro.
- El `detalle` mide **198 de mediana** (máx 392).
- La lista completa ocupa **~218 renglones ≈ 3,270 px** dentro de una caja de **340 px**.
  **Se ve el 10 %**; el resto vive en un scroll que nadie hace.

El diagnóstico no es "hay mucho texto": es que **falta el título**. La ficha de Horizon tiene
estado chiquito arriba, TÍTULO grande y corto, y el cuerpo en lenguaje natural. Aquí el cuerpo
está ocupando el lugar del título.

**Y el título ya existe en el dato, sin inventar nada:** los `id` son `subsistema-cosa`
(`feed-ciclo`, `agua-turbulento`, `vent-flujo-completo`). Derivado del id, el título mide
**8 caracteres de mediana, 19 el más largo**, y los 69 ids tienen sufijo — ninguno queda vacío.

## EJERCICIOS
- x2-titulo-del-dato · Cada criterio tiene nombre corto, derivado y verificable · `tituloCorto(id)` en mold-contratos · función PURA junto al tipo `Criterio`; el gate exige que los 69 den título no vacío y ≤ 24 caracteres
- x2-una-linea · Un hallazgo = un renglón · UI · la lista pasa de ~218 renglones a 18: ícono + TÍTULO + § por fila, sin el párrafo
- x2-abrir-uno · La regla y los números viven ADENTRO · acordeón · al hacer clic se abre ESE hallazgo con su `criterio` y su `detalle`; solo uno abierto a la vez, para que el panel no vuelva a crecer
- x2-mide-la-mejora · La mejora se MIDE, no se declara · números · el gate imprime renglones antes/después con la misma pieza y exige ≥5× de reducción
- x2-nada-se-esconde · Ningún hallazgo desaparece · conteo · siguen apareciendo los 18 que duelen y el botón de los 69; lo que cambia es el ALTO, no el contenido
- x2-sin-regresion · El dictamen sigue diciendo lo mismo · gate · `ciclo-dado-test.cjs` verde y el drive con la pieza de ian sin errores de consola

## YA-EXISTE (prueba de ausencia)
- `mold-contratos.ts` — el tipo `Criterio` ya trae `id`, `cita`, `criterio`, `detalle`, `estado`.
  **No se toca el contenido de ningún criterio**: se agrega una función que deriva el nombre.
- `RevisarPiezaPanel.tsx` — la lista ya ordena por severidad y ya tiene el toggle de "los 69".
  Se cambia cómo se PINTA cada fila, no qué filas hay.
- `PanelDeLentes` (X1) ya usa la anatomía de la ficha de Horizon (borde izquierdo duro, estado
  chiquito arriba, titular). **La lista debe hablar el mismo idioma** — hoy no lo habla.
- NO existe: ningún nombre corto de criterio en el dato, ni fila colapsable en el dictamen.

## TOCA
- src/forja/mold/mold-contratos.ts
- src/forja/mold/RevisarPiezaPanel.tsx
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- ordenes/2026-09-01-x2-los-hallazgos-se-leen.md
- public/evidencia/2026-09-01-x2-los-hallazgos-se-leen/resultados.json
- public/evidencia/2026-09-01-x2-los-hallazgos-se-leen/lista-cerrada.png
- public/evidencia/2026-09-01-x2-los-hallazgos-se-leen/hallazgo-abierto.png

## BORRA
- (nada)

## PREEXISTENTE
<!-- los dos de comando/ los reescribe la OTRA sesión (comando-scan del inventario de
     videos). No son de esta orden y no se commitean aquí. -->
- public/comando/catalogo.json
- public/comando/produccion.json
- docs/forja-research/datasheets-fuente-corriente/
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json

## EVIDENCIA (declarada ANTES de trabajar)
- los renglones ANTES y DESPUÉS con la MISMA pieza, impresos por el gate
- captura del panel con la pieza de ian: la lista cerrada, y un hallazgo abierto
- gate `ciclo-dado-test.cjs` verde
- entrega a `C:/Users/sebas/Downloads` — nada en /tmp
- deploy + verificación contra el bundle SERVIDO
- orden-gate VERDE · censo Canvas 8→8
