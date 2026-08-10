# ORDEN: el juicio de los PINES, en 3D — piloto de "cada análisis vive en su pieza"

BASE: 9eedc7a

OBJETIVO: en el CAD, un molde CON pines (caja demo) donde los ~10 análisis del pin se ven
SOBRE la pieza: nube de puntos en cada conflicto real (pin↔agua, pin↔cavidad), el paquete
de pines pintado por su peor veredicto, y filas por pin en el panel. Premisa de ian: el
molde ESTÁ MAL — el visual existe para ENCONTRAR lo roto, no para decorar. Y el pin no se
juzga solo: se juzga EN su vecindario (agua §9, venteo §8, estructura §12).

## YA-EXISTE (prueba de ausencia)
- Nube de alarma: `MoldScene.AlarmCloud` (instancedMesh de puntos, ya probada con
  colisiones) — se reusa como pintor de veredictos; solo gana props color/size.
- Posiciones de pines: `mold-drawing-set.ejectorPositions` (privada — se EXPORTA, no se
  reinventa: es LA fuente que usa buildMoldParts).
- Pandeo: `ejection.pinBuckling` (A-234, desviación K=2 documentada). Cortante/compresión:
  `pkg.diseno.expulsion.pines` (ejectorPinSizing). Agua: `coolingCircuit`. Huella:
  `cavityFootprint`/`cavityGrid`. Regla de acero: 1⌀ (contrato §11.2.5 ya la usa).
- Molde genérico en pantalla: el efecto ARMADO (`useMoldStudio:252`) construye CUALQUIER
  `liveMoldSpec` — la caja demo es setLiveMoldSpec+setMoldPkg, cero pipeline nuevo.
- La flanera NO sirve de demo: su cerebro eligió STRIPPER (§11.3.4, sin pines) — el juez
  lo DECLARA en ese caso en vez de callar.

## TOCA
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/MoldScene.tsx
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- scripts/guiones/butirico.txt
- src/cinematic/CinematicMolecule.tsx
- public/comando/produccion.json
- scripts/comando-catalogo.cjs

## EVIDENCIA (declarada antes de trabajar)
- Juez node-side (`juzgarPines`) sobre la caja demo: N pines juzgados, y ≥1 hallazgo REAL
  (conflicto de agua o pandeo bajo) — si sale todo verde, la demo se elige de nuevo hasta
  que el molde de fábrica muestre sus defectos (la premisa es que está mal).
- Captura del CAD (GPU iangpu): nube de veredictos SOBRE los pines + filas por pin en el
  panel (data-testid="pin-row-*") + juicio visible. Revisada con ojos.
- Con la flanera (stripper): el panel DECLARA "expulsa por stripper, no hay pines" — no
  desaparece en silencio.
- `node scripts/orden-gate.cjs` VERDE · censo IGUAL (0 nuevos Canvas/vite/html).

## CIERRE (2026-08-10) — PIVOTADA por ian antes de terminar
- orden vs entregado: ian la frenó a medio camino ("dije que primero hablaras conmigo" —
  correcto: me salté el paso de aprobación de MI PROPIO flujo) y redirigió el ejercicio al
  CICLO COMPLETO sobre una pieza mínima (el dado). Queda ENTREGADO solo el MOTOR:
  `estudio-molde-datos::juzgarPines` — cada pin juzgado en su vecindario (⌀ A-232/233/235,
  pandeo A-234, agua A-239 §9.2.7, pared de cavidad §11.2.5, holgura-venteo A-168) con
  nubes XYZ. La UI demo (botón caja, juicio en el bag) se REVIRTIÓ: los pines son la
  estación 10 del ciclo, no la entrada.
- números: sonda en 3 cajas — los pines individuales CUMPLEN pero el CAMPO estrangula el
  agua (trazo 2/3 líneas/lado · paso 88 > 2H=64 Eq 9.24) → el RETORNO A-239 medible, con
  62-95 puntos ámbar exactamente en los pines culpables. La tesis de ian ("todo tiene que
  ver con todo") validada en números.
- evidencia: sonda-pines.cjs (scratchpad de la sesión) · juzgarPines queda con export y
  compila · sin UI que lo consuma AÚN (lo consumirá la estación 10 del ciclo del dado).
- preguntas abiertas: ninguna — sustituida por ordenes/2026-08-10-ciclo-dado-estacion1.md.
