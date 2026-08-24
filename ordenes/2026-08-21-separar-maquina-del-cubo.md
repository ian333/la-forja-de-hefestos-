# ORDEN: SEPARAR LA MÁQUINA DE MOLDES DEL CUBO (que sirva para cubo Y vaso)

BASE: 726841d

OBJETIVO: encargo de ian — "la máquina de moldes hay que separarla del cubo,
esa era la idea. Debe funcionar para AMBOS." La revisión del turno anterior
(REVISION-VASO-CICLO.md) mostró que E1→E12 es la máquina DEL CUBO. Este turno
introduce el CONTRATO DE PIEZA (`PiezaSpec`) y separa las dos estaciones más
acopladas (E1 DFM, E2 Economía) para que corran con CUALQUIER pieza — probado
con el cubo (sin cambiar su resultado) y con el vaso (números propios).

Regla del proyecto (memoria): PASO A PASO, 1 cambio a la vez, NUNCA un rewrite
de las 12 estaciones de golpe. Este turno = la FUNDACIÓN + E1/E2; E3→E12 siguen
el MISMO patrón en incrementos posteriores. La prueba de que la separación es
real: el cubo NO cambia (gate 181/181 por aliases) y el vaso SÍ entra a E1/E2.

## LO QUE SE CONSTRUYE
1. `PiezaSpec` en `estudio-molde-datos.ts` — el contrato que la máquina recibe
   en vez de leer el cubo: `spec: MachineSpec` (ya genérico: dims, pared,
   plástico, cavityShape round/rect) + los sólidos/predicados por-pieza
   (`solidRecto`, `solidDraft`, `inCavity`) + `dfmPart`/`dfmMacizo` (E1) +
   dims locales para colocación (semiX/semiY/bocaZ). Campos aterrizados en el
   intake del libro (§2.1.5, N-01: tamaño/espesor/cantidad/material).
2. `DADO_PIEZA` — captura el cubo EXACTO de hoy (spec=DADO_SPEC, dadoRectoShape,
   dadoDraftShape, dentroDadoLocal, la DFM part/macizo de estacion1Dado).
3. `VASO_PIEZA` — el vaso ⌀80×20 pared 3 redondo (cavityShape 'round', ABS).
4. `estacion1(pieza)` y `estacion2(pieza)` genéricas; `estacion1Dado()` y
   `estacion2Dado()` quedan como ALIAS `= () => estacionN(DADO_PIEZA)` — el
   cubo llama EXACTAMENTE el mismo camino (gate intacto).
5. **Gate**: los 181 del cubo verdes (aliases) + BLOQUE NUEVO del vaso:
   `estacion1(VASO_PIEZA)` reprueba su macizo y aprueba el vaso con SUS números
   (pared 3, sin draft ⇒ la advertencia real); `estacion2(VASO_PIEZA)` cotiza
   el vaso redondo por `moldMachine` (round, como la flanera). CONTROL: el
   veredicto/números del vaso ≠ los del cubo (si son iguales, no separó nada).

## LO QUE NO SE HACE ESTE TURNO (siguen igual, es incremental)
- E3→E12 NO se parametrizan aún (colocacionEnLaBase, inCavity en E5/E7,
  solidDraft en E3). Se dejan bindeadas al cubo; el PiezaSpec ya trae los
  campos para cuando les toque. Se DECLARA el orden de los siguientes pasos.
- El puente pieza-del-árbol → cursoRef.pieza (bloqueador #0) sigue pendiente.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- scripts/ciclo-dado-test.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- scripts/precompute-hemoglobin.py
- scripts/precompute-heme-approach.py
- scripts/salud-canarios.cjs
- scripts/salud.sh
- scripts/traer.sh
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
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
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- `PiezaSpec` + `DADO_PIEZA` + `VASO_PIEZA` en el código
- gate: 181 del cubo VERDES (aliases, cero cambio) + bloque del vaso (E1/E2
  con números PROPIOS ≠ cubo) · orden-gate VERDE
- repaso de pliegos citado en el diseño del contrato · deploy
