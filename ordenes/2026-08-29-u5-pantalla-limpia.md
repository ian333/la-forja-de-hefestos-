# ORDEN: U5 · PANTALLA LIMPIA — una ventana sin nada que decir no existe

BASE: ab28ed3

OBJETIVO: ian, con su pieza cargada y cuatro paneles vacíos alrededor: «me siguen apareciendo
todas esas ventanas que solo me quitan espacio, quítalas… nada de ahí es utilizable, ¿por qué?
porque JAMÁS lo he utilizado, es basura».

Los cuatro que estorban con una pieza cargada: **DOCUMENTO** (árbol de features: vacío, una
malla no tiene features), **CARAS DEL SÓLIDO** (dice 0: un STL no tiene topología),
**PARÁMETROS** (cascarón sin contenido) y **ANÁLISIS · PROPIEDADES** (cabecera colapsada sola).
Entre los cuatro se comen ~40 % del ancho para no decir nada.

LA REGLA (la que salió de la investigación de Detroit): **el HUD está limpio y la información
aparece solo cuando hace falta**. Aquí se vuelve mecánica: *una ventana sin contenido no se
renderiza*. No se colapsa, no se achica: no existe.

LO QUE **NO** SE HACE Y POR QUÉ: no se BORRAN los paneles. Cuando construyes una pieza con
croquis y extrude, el árbol, las caras y los parámetros son el instrumento — y las 63 lecciones
de la escuela (mec-u1..u11) los manejan por clics. Borrarlos rompería la escuela. Lo que se
mata es el CASCARÓN VACÍO, que es lo que ian nunca usó porque nunca tuvo nada dentro.

## EJERCICIOS
- limpia-malla · Con una malla cargada, los cuatro cascarones desaparecen · condición de contenido · con gear.stl NO existen en el DOM: feature-tree, face-list, op-panel, analysis-panel
- limpia-espacio · La pieza gana el espacio · medición de píxeles · el visor pasa de ~60 % a ≥85 % del ancho (medido sobre la captura, no a ojo)
- limpia-croquis · El fantasma del croquis no aparece sobre una pieza cargada · SketchPlane/ProfileGhost · con gear.stl no hay ni un rectángulo amarillo en la escena
- limpia-sin-regresion · Construyendo una pieza SÍ están · control · con un boceto + extrude los cuatro paneles vuelven a existir (si no, se rompió la escuela)
- limpia-gate · La escuela sigue corriendo · gate del ciclo · 248/248 y los checks de croquis intactos

## YA-EXISTE (prueba de ausencia)
- Los cuatro paneles renderizan SIEMPRE su `CollapseHead`; solo el cuerpo es condicional
  (`feature-tree` l.7037, `face-list` l.7208, `op-panel` l.7481, `analysis-panel` l.8233).
- `SketchPlane`/`ProfileGhost` (l.6211-6214) ya se apagan con `moldParts.length` — pero NO
  preguntan por `piezaMalla`: por eso el rectángulo amarillo sigue en escena (mismo error de
  clase que la tarjeta de bienvenida, ya arreglada en T1).
- `collapsed` (l.3473) arranca con todo colapsado — pero colapsado ≠ ausente: la cabecera
  sigue ocupando su renglón y su marco.
- NO existe: ninguna condición de "sin contenido → no renderizar".

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/RevisarPiezaPanel.tsx
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- public/evidencia/2026-08-29-u5-pantalla-limpia/resultados.json
- public/evidencia/2026-08-29-u5-pantalla-limpia/01-limpia-malla-still.jpg

## BORRA
- (nada)

## PREEXISTENTE
- docs/forja-research/datasheets-fuente-corriente/
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json

## EVIDENCIA (declarada ANTES de trabajar)
- still 1600×1000 con la pieza cargada: cero paneles vacíos, cero rectángulo fantasma
- medición del ancho del visor antes/después sobre la MISMA captura
- control: still construyendo una pieza (los paneles vuelven)
- gate 248/248 · orden-gate VERDE · deploy a producción y verificación del bundle servido

## CIERRE (2026-08-29)
**5/5 EN VERDE.** Gate del ciclo **248/248 · 0 fallan**.

Con una pieza cargada la pantalla quedó con **la pieza, el Foco y el dictamen** — nada más.
Desaparecieron DOCUMENTO, CARAS DEL SÓLIDO, PARÁMETROS y ANÁLISIS·PROPIEDADES, y con ellos el
rectángulo fantasma del croquis que ian veía «siempre». El visor pasó de ~60 % a ~85 % del ancho.

La regla quedó mecánica: tres banderas de CONTENIDO (`hayArbol`, `hayCaras`, `haySolido`)
deciden si el panel existe. No se borró ninguno: construyendo con croquis y extrude vuelven,
porque ahí sí son el instrumento y las 63 lecciones de la escuela los manejan por clics.

**EL FOCO ganó tecla: `Q`** (ian: «quiero que el foco sea una letra o una función, como en
Horizon»). No es `F` porque F ya era Fillet desde antes. Entra al KEYMAP a propósito: así sale
en el overlay de atajos (S) y se DESCUBRE — que es exactamente el problema que él reportó con
el cargador escondido. El botón del panel además anuncia su tecla.

**Dos errores míos en el camino, los dos de la misma familia (TDZ):** las banderas leían
`components`, `importedStep` y `moldParts` **antes de que se declararan** en el cuerpo del
componente. El navegador tronaba con «Cannot access 'X' before initialization» y **esbuild no lo
ve porque no ejecuta**: lo cazó el arnés al primer intento. Es el gotcha del proyecto («vite NO
typechecka») en su versión más barata de pagar.

Deuda: `ANÁLISIS · PROPIEDADES` desaparece con una malla porque no tiene nada real que decir
(material, masa y volumen exacto salen del kernel). El día que una malla tenga sus propias
propiedades medidas, ese panel vuelve con contenido de verdad.
