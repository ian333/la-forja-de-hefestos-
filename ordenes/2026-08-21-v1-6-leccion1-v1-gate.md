# ORDEN: v1·6 — LECCIÓN 1 + EL v1-GATE: 10 STEPs a ciegas y 5 humanos

ESTADO: proximo
PRIORIDAD: 6

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

## TOCA
- src/forja/brep/ProjectSwitcher.tsx
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- scripts/v1-gate.cjs

## EVIDENCIA
- v1-gate VERDE sobre 10 STEPs ajenos (listados con su URL)
- 5 humanos con `leccion.completa` en telemetría, sin DM de ayuda
- orden-gate VERDE · deploy
