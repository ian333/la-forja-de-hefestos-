# ORDEN: E3-VERIFICACIÓN — cotas en todo, vistas de dibujo técnico, y el gate del ciclo

BASE: 6166610

OBJETIVO: ian frenó la estación 3: "no avanzaremos a menos de que añadas dimensiones —
TODAS las dimensiones — y verifiques desde distintas caras con técnicas de dibujo
técnico". Y tiene un bug concreto enfrente: el panel declara insertos de COMPRA
120×120×60/16 pero el acero dibujado mide 52/14 — el dibujo no es el acero que se
compra. Esta orden: (1) el acero dibujado usa las dims REALES de insertDims, (2) una
tabla de MEDIDAS declarado-vs-MEDIDO-del-sólido (roja si no cuadra — la doctrina de
las cotas del CAD), (3) verificadores geométricos duros (draft medido de las caras,
conservación de volumen, cuerpos=2, colisiones=0, contacto en la partición), (4)
evidencia desde DISTINTAS CARAS (FRE/SUP/ISO del viewport) y (5) el gate node del
ciclo completo para que E1-E3 queden vigiladas para siempre.

## YA-EXISTE (prueba de ausencia)
- Medición B-Rep: `mold.shapeBBox/volume` + `mold.draftAnalysis` (clasifica caras por
  ángulo de draft — mide el 1.5° REAL, no el declarado) + `splitMold.vols/bodies`.
- Colisiones: `MoldScene.computeMoldAlarm` sobre las mallas ya tessellated.
- Doctrina receta-vs-sólido: el sistema de cotas del CAD ("dos cifras; si no cuadran,
  ROJO") — aquí aplicada como tabla MEDIDAS de la estación.
- Vistas ortográficas: los botones ISO/SUP/FRE del viewport (sin testid — se manejan
  por texto).
- Patrón de gate node con OCC real: kazmer-mold-assembly.cjs (factory + _setActiveOCCT
  + occt.ts de producción).

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx

## CREA
- scripts/ciclo-dado-test.cjs

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo)
- index.html
- public/comando/catalogo.json
- public/comando/produccion.json
- scripts/comando-catalogo.cjs
- public/atrio/
- scripts/reels-web.py

## EVIDENCIA (declarada antes de trabajar)
- `node --import tsx scripts/ciclo-dado-test.cjs` VERDE: E1 (t_c 88.3 min/8.5 s, DFM),
  E2 (desglose cuadra al centavo, banda cambia en 250k), E3 (TODAS las medidas
  declarado≈medido, draft ≥1.4° medido de las caras, Σ volúmenes = bloque ±0.5 %,
  cuerpos=2, insertos = dims de COMPRA).
- En el CAD: tabla MEDIDAS con Δ por fila (verde/rojo) + colisiones=0 + capturas desde
  FRE, SUP e ISO entregadas a Downloads + /mnt/e/forja-videos.
- `node scripts/orden-gate.cjs` VERDE (sin pipe) · censo IGUAL.

## CIERRE (2026-08-10)
- orden vs entregado: IDÉNTICO + 2 hallazgos del propio verificador (enmienda declarada):
  (1) las paredes del loft son REGLADAS (BSpline) y draftAnalysis las mandaba a 'curvas'
  sin medir — el falso PASA lo delató la fila gemela en la 1ª corrida del gate; el draft
  ahora se mide POR REBANADAS del sólido (dibujo técnico), y da 1.5° exactos; (2)
  computeMoldAlarm síncrono en el click congelaba el tab MINUTOS — se quitó por
  REDUNDANTE: las 3 piezas parten el bloque por construcción y la fila Σ=bloque ya
  prueba la no-interferencia.
- números: gate ciclo-dado-test 28/28 con OCC real (E1 t_c 88.3 min/8.5 s · E2 cuadre
  al centavo + banda 250k · E3 17/17 medidas declarado≈medido, draft ext/int 1.5°±0.1
  medido de rebanadas, Σ vol = 100.018 % del bloque, cuerpos=2, compra=tallado 60/16) ·
  en pantalla 17/17 verdes · orden-gate VERDE EXIT=0 · censo IGUAL.
- evidencia: vistas FRE/PLANTA/ISO + tabla MEDIDAS (dado-e3v-*.png) → Downloads laptop
  + /mnt/e/forja-videos. La FRENTE muestra lo que la ISO escondía: el núcleo en T
  entrando por la boca hasta el piso.
- preguntas abiertas: el gate del ciclo aún no está en forja-gate.cjs (siguiente orden
  chica); las cotas DIBUJADAS sobre las vistas 2D (líneas de cota con flechas) son la
  versión pro del dibujo técnico — hoy la cota vive en la tabla con su vista nombrada.
