# ORDEN: CICLO DEL DADO — estación 2: ECONOMÍA (cap 3) · espléndida y explicada

BASE: 3cd6b52

OBJETIVO: desde la estación 1, un botón avanza a la 2 y aparecen EN 3D las familias
candidatas (×1 dorado ganador · ×2 y ×4 fantasmas perdedores — no se borran: se ve qué
NO elegir) + el panel con TODO explicado: la tabla de variantes con la amortización
DESGLOSADA por pieza (que el porqué sea aritmética visible, no un adjetivo), el
break-even A-049, la banda de sensibilidad A-050 (🟥 FALTA del índice — nace aquí:
5 volúmenes → dónde cambia el ganador) y la lectura de sobrediseño A-054. Mandato de
ian: "debemos ser espléndidos… todo debe de explicarse".

## YA-EXISTE (prueba de ausencia)
- La economía entera: `moldMachine` ya corre variantes (cold 2p/3p × 1..16, hot runner),
  `breakEvenReport` (A-049) y el veredicto — la estación es una VISTA + el sweep A-050
  (correr la Máquina en 5 volúmenes, cero fórmula nueva).
- El dado sólido: la booleana de loadDado — se extrae a un helper local y las familias
  son COPIAS transformadas del mismo shape (cursoPart), cero geometría nueva.
- Panel y stepper: CicloPanel (estación 1 ya vive ahí); el botón de avance es un handler
  del bag, como todos.
- Desglose explicable: amort/pza = molde$/Q (declarando que ignora el factor de
  mantenimiento) y resto/pza = total − amort. Aritmética a la vista, no caja negra.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — reels del agua)
- index.html
- public/comando/catalogo.json
- public/comando/produccion.json
- scripts/comando-catalogo.cjs
- public/atrio/
- scripts/reels-web.py

## EVIDENCIA (declarada antes de trabajar)
- Sonda node de estacion2Dado(): tabla con desglose amort+resto=total que CUADRA al
  centavo, ganador cold-2placas×1 ($5,787 · $0.436/pza), y la banda A-050 con el
  volumen donde el ganador CAMBIA (impreso).
- Capturas CAD (GPU): (1) las tres familias en 3D con el ganador dorado, (2) el panel
  E2 completo. Revisadas con ojos y entregadas a Downloads laptop + /mnt/e/forja-videos.
- `node scripts/orden-gate.cjs` VERDE (sin pipe) · censo IGUAL.

## CIERRE (2026-08-10)
- orden vs entregado: IDÉNTICO, sin enmiendas.
- números: gana cold-2placas×1 ($5,787 · $0.0579 amort + $0.3782 mat/proc = $0.4361/pza,
  CUADRA al centavo en las 5 filas) · A-050 estrenado: 50k→×1 · 100k→×1 · 250k→×2 ·
  500k→×4 · 1M→×4 — el ganador CAMBIA en ~250k · A-054: molde = 13 % del total → SANO ·
  chips ✓✓▶ · gate VERDE EXIT=0 · censo IGUAL · build iangpu ✓ 42 s.
- evidencia: forja-shots/dado-e2/{01-familias-3d,02-panel-e2}.png revisadas con ojos →
  Downloads laptop (dado-e2-*.png) + /mnt/e/forja-videos.
- preguntas abiertas: estación 3 — ARQUITECTURA (cap 4): nace el primer acero (partición,
  insertos, base, semáforos de máquina que YA existen). El draft declarado del dado se
  talla ahí.
