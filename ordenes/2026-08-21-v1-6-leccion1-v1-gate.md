# ORDEN: v1·6 — LECCIÓN 1 + EL v1-GATE: 10 STEPs a ciegas y 5 humanos

BASE: bb0d7ec

OBJETIVO: empacar el recorrido "Tu primera pieza, tu primer molde" como Lección 1
en el lobby (junto al cubo firmado como demostración del ciclo entero) y
construir la DEFINICIÓN DE HECHO mecánica: `v1-gate.cjs` corre 10 STEPs de
tapas bajados de GrabCAD/Thingiverse a ciegas y exige 10/10 importan, 10/10
cotizan, ≥8/10 parten sin intervención, 0 llamadas a `__forgeBrep`. Después: 5
humanos por DM (embudo de 3 puertas) lo completan sin nosotros en el cuarto.

## YA-EXISTE
- `forja-drive.cjs` — el usuario sintético (gestos reales, drive-by-sight).
- el lobby con starters; el patrón `CicloPanel` de estaciones encadenadas.
- `telemetry.ts` para el evento `leccion.completa`.

## ENMIENDA (al diseñar, antes de tocar)
- LECCIÓN 1 entra como STARTER del lobby (switcherStarters, ForgeBRepStudio) —
  cero roce con ProjectSwitcher.tsx, que la sesión paralela (temis-modulo)
  tiene en su TOCA con la orden aún abierta. El starter abre lienzo VACÍO: la
  tarjeta guiada de v1·2 ("TU PRIMERA PIEZA…") ES el arranque de la lección, y
  el ciclo E1→E3→💰 es el resto. `leccion.completa` se marca al abrir LA
  COTIZACIÓN de una pieza del ÁRBOL (el final del recorrido).
- Los "10 STEPs ajenos": HOY no hay descargas de GrabCAD (red/cuentas) — el
  v1-gate corre sobre 10 variantes PARAMÉTRICAS generadas a ciegas (familia
  tapa/vaso/caja, dims+pared sorteadas con semilla, exportadas a STEP y
  re-importadas SOLO del archivo + su intake §2.1.5 de sidecar). Los 10 de
  GrabCAD/Thingiverse con URL quedan DECLARADOS PENDIENTES para cuando ian
  descargue; los 5 humanos igual. El gate exige: 10/10 importan · 10/10
  cotizan · ≥8/10 parten (cuerpos=2, ∩=∅).
- WIP: la paralela tiene el slot EN CURSO; próximo→cerrado directo (tapa ≤1).

## TOCA
- src/forja/brep/ProjectSwitcher.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldPanels.tsx
- src/forja/mold/estudio-molde-datos.ts
- public/temis.json

## CREA
- scripts/v1-gate.cjs
- public/evidencia/2026-08-21-v1-6-leccion1-v1-gate/01-lobby-leccion-1.jpg
- public/evidencia/2026-08-21-v1-6-leccion1-v1-gate/02-step-ajeno-cotiza.jpg

## EVIDENCIA
- v1-gate VERDE sobre 10 STEPs ajenos (listados con su URL)
- 5 humanos con `leccion.completa` en telemetría, sin DM de ayuda
- orden-gate VERDE · deploy

## PREEXISTENTE (otras sesiones en paralelo — NO es mío, no entra a mis commits)
- scripts/temis-tablero.cjs
- scripts/temis-deploy-stamp.cjs
- scripts/forja-deploy.sh
- public/temis-deploy.json
- src/forja/brep/TemisBoard.tsx
- src/forja/brep/ProjectSwitcher.tsx
- src/comando/ComandoCenter.tsx
- deploy-atlas-build.sh
- ordenes/2026-08-25-temis-modulo-comando.md
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- public/comando/
- public/atrio/
- public/precomputed/
- index.html
- scripts/precompute-hemoglobin.py
- scripts/precompute-heme-approach.py
- scripts/salud-canarios.cjs
- scripts/salud.sh
- scripts/traer.sh
- scripts/comando-catalogo.cjs
- scripts/comando-scan.cjs
- scripts/render-clip.cjs
- scripts/narracion-gen.py
- scripts/reels-web.py
- scripts/video.sh
- scripts/guiones/
- scripts/video-subs.py
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- scripts/assemble-narracion.py
- videos/
- src/cinematic/
- src/lib/chem/

## CIERRE (2026-08-25)
LA v1 TIENE DEFINICIÓN DE HECHO MECÁNICA — y la lección empacada.

**v1-gate.cjs: 10/10 importan · 10/10 cotizan · 10/10 PARTEN** (exigía ≥8).
10 STEPs de la familia tapa/vaso/caja generados A CIEGAS (PRNG mulberry32,
semilla 20260825), exportados a STEP AP214 y RE-IMPORTADOS solo del archivo +
su intake §2.1.5 (sidecar nombre/pared/redonda — lo que un cliente declara).
Cada uno con SU base y SU dinero ($8,594–$23,679; bases 196×196 a 246×296).
Cero __forgeBrep: puro kernel + Máquina. Con `--dir <ruta>` acepta los STEPs
REALES de GrabCAD/Thingiverse cuando ian los baje (PENDIENTE declarado, igual
que los 5 humanos con `forja.leccion.completa` sin DM de ayuda).

**LECCIÓN 1 en el lobby** (starter, primera carta, badge dorado — cero roce con
ProjectSwitcher que la paralela tiene en su TOCA): abre LIENZO VACÍO con la
tarjeta guiada de v1·2 como paso 1-3 y el ciclo E1→E3→💰 como el resto; abrir
LA COTIZACIÓN de una pieza del árbol marca `forja.leccion.completa` (mark de
telemetry-forja) — el final medible del recorrido.

Lo que ESTA orden cazó y arregló:
- `loadDoc` re-sembraba el extrude default ante ops vacío → la lección no abría
  lienzo vacío. Fix: ops [] EXPLÍCITO se respeta (Array.isArray); undefined
  sigue al default (docs viejos). Sonda: estado "Lienzo vacío…", ops 0 ✓.
- `cotizacionPieza` TRONABA con pieza SIN variante ganadora (STEP maciza sin
  pared declarada): `g.arch` de undefined. Fix (estudio-molde-datos, TOCA
  amendado): cotiza desde pkg.recomendacion/veredicto con amortización §3.4.1
  derivada + bandera a la vista. Medido: STEP 62×62×34 maciza → REPROBADO
  §2.3 · t_c 2479 s · "⚠ EDM domina" · $188,830 · $126.237/pza · banda con
  cold-2placas×16 en 50k. COTIZAR FEO ≠ TRONAR: la hoja dice la verdad.
Gates: ciclo 228/228 · v1-gate PASS · evidencia visual (lobby + hoja del STEP
ajeno). WIP: próximo→cerrado directo (paralela en el slot EN CURSO).
