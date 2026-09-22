# ORDEN: LOS INSERTOS SE BARRENAN — la cavidad y el núcleo dejan de ser macizos: pines, bebedero y agua con su barreno; los retornos fuera del inserto

ESTADO: en-curso
PRIORIDAD: 1
AGENTE: Opus · worktree propio · iangpu forja-dev6 :5197

BASE: eca3df0

OBJETIVO: que los insertos del molde de TU pieza sean fabricables. Hoy `construirAceroE3` talla cavidad y núcleo de la pieza
y AHÍ se quedan macizos: los 8 pines atraviesan el núcleo (16 tramos, hasta 2.5 mm = su radio, 7.2 falla 4/4), el bebedero
comparte 3.4–4.5 mm con la cavidad, el agua A entra 1.6–2.2 mm al inserto de cavidad, y los 4 pines de retorno cruzan la
esquina del inserto de núcleo (15,000 mm³, 5.3 mm en la carcasa; 2.7 mm en la tapa). Al final: los insertos traen SUS
barrenos (bebedero en la cavidad; punta + hombro de cada pin en el núcleo; el agua que los cruce) y los retornos viven fuera
del inserto; el estudio de contacto da 0 mm³ inserto↔pin/colada/agua/retorno en las 4 piezas.

## LO QUE SE MIDIÓ (plan de inspección 2026-09-21 — resultados.json y `moldSolidCollisions`)
- nucleo↔pin-punta-k 286 mm³ · 1.12 mm; nucleo↔pin-cuerpo-k 154 mm³ · 2.19 mm (carcasa); cavidad↔colada 1111 mm³ · 3.88 mm;
  cavidad↔agua-A-* 1.56–2.15 mm; nucleo↔pines-retorno 15000 mm³ · 5.3 mm (carcasa), 3328 · 2.71 (tapa); 1599HBK y 1557BGY
  sin retorno↔núcleo (inserto más chico que el paquete).
- Los retornos se colocan en las esquinas de la EXPULSORA (mold-plano-set.ts buildFunctionalParts «2b) RETURN PINS»: 65+26,
  20+26) sin mirar el tamaño del inserto (`insertDims`).
- ORDEN DE LAS ESTACIONES: E3 talla los insertos ANTES de que existan el agua (E6) y los pines (E7). El barrenado tiene que
  ocurrir DESPUÉS de E7 (un paso de `cicloPortamoldesPieza`, E8, o un paso final de E7): «los insertos se barrenan con lo que
  ya se sabe». Consume las posiciones que haya en `ciclo.e10` (pines) y `ciclo.e8` (agua) EN EL MOMENTO: otras órdenes en
  paralelo mueven pines y agua — no dependas de sus valores, dependa del flujo de datos.

## YA-EXISTE (prueba de ausencia)
- `construirAceroE3` (estudio-molde-datos.ts:1799) devuelve `r.cavityPlate`, `r.corePlate`, `r.macho`, `dadoD`; el kernel
  tiene `K.cut`, `K.makeCylinder`, `K.drillHole` (mold-plano-set.ts:286 los usa para las placas).
- La estación 8 re-emite componentes por rol (`cursoSet(8, …, [...moldParts.filter(!roles.has), ...porta])`): reemplazar
  `cavidad`/`nucleo` por sus versiones barrenadas ahí es el mismo patrón.
- `cursoPart(shape, role, …)` tesela con piso angular 0.2 rad (medido: sin piso, una cavidad real = 6.2 M triángulos).
- Las holguras de barreno viven en `fits.ts` (LITERAL, ISO): usar `pillarClearanceFit`-like para pin y bebedero, no inventar.
- NO existe: barrenar insertos; retornos que miren el inserto.

## EJERCICIOS
- [ ] paso «barrenar insertos» después de E7: cavidad − bebedero (⌀ del sprue en la partición + holgura) − agua A que la cruce;
      núcleo − (punta ⌀ + holgura de fits.ts) por pin con asiento del hombro (cuerpo ⌀) bajo la partición − agua B que lo cruce.
      Re-teselar y REEMPLAZAR los roles `cavidad`/`nucleo`. Telemetría con su tiempo.
- [ ] retornos fuera del inserto: posición en función de `insertDims` y del paquete (≥ ⌀ al inserto, ≥ 1.5·⌀ al canto de la
      expulsora); si no caben, decirlo (no encimarlos en silencio).
- [ ] las 4 piezas: `moldSolidCollisions` con 0 pares inserto↔{pin, colada, agua, retorno} (o ≤ 0.6 mm = ruido de vóxel,
      declarado); captura del núcleo barrenado desde arriba y de la cavidad desde abajo (macho opaco, pieza oculta).
- [ ] tiempo: el barrenado no debe subir la estación 8 más de ~10 s en la carcasa (mide y anota).

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-plano-set.ts
- scripts/ciclo-dado-test.cjs

## CREA
- public/evidencia/2026-09-21-los-insertos-se-barrenan/resultados.json
- public/evidencia/2026-09-21-los-insertos-se-barrenan/insertos-barrenados.png

## BORRA
- (nada)

## PREEXISTENTE
- (nada — worktree limpio)

## EVIDENCIA (se declara ANTES de trabajar)
- 4/4 piezas: 7.2 ✓ y 2.4 ✓ (0 mm³ inserto↔pin/colada/agua/retorno), números antes → después; capturas.
- tsc: cero errores nuevos contra la base de 66 · ciclo-dado-test 266/266 (o acta si el cubo cambia) · orden-gate VERDE · sin deploy.

## CIERRE (se llena al terminar)
