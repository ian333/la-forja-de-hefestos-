# ORDEN: LOS PINES EN LA CARA DEL MACHO — la punta donde el acero de verdad termina, la expulsión balanceada, la cabeza capturada

ESTADO: en-curso
PRIORIDAD: 1
AGENTE: Opus · worktree propio · iangpu forja-dev5 :5196

BASE: eca3df0

OBJETIVO: que cada pin expulse. Hoy la punta se coloca en `zPiso = zBaseCerrada − pared MEDIANA` (useMoldStudio.ts
cicloBotadoresPieza ~1412) y el piso real de la pieza NO es la pared mediana: en la tapa el piso mide 2.76 (pared 3.86) →
las 8 puntas quedan 1.06 mm HUNDIDAS bajo la cara del macho (botón de plástico); en 1557BGY 1.56 mm hundidas; en 1599HBK
1.04 mm METIDAS en la pieza. Y el agarre (`gripEjectorLayout`, eject-layout.ts:53) coloca por puntaje sin equilibrio: el
centroide de los 8 pines queda a 15.6 mm (carcasa: 6 de un lado, 2 del otro), 32.5 mm (1599HBK: 4 en fila sobre UNA orilla,
paso 12 mm) y 11.5 mm (1557BGY) del centro. Al final: punta en la cara REAL del macho (rayo sobre la malla), expulsión
balanceada con su regla y su cita, cabeza capturada en las láminas, mismo ⌀ de cuerpo en 3D y láminas, y las 4 piezas pasan.

## LO QUE SE MIDIÓ (plan de inspección 2026-09-21 + 4 revisores Opus)
- El check 6.1 del inspector era TAUTOLÓGICO (medía contra la misma fórmula): el verde era falso. La prueba real está en
  7.2: cada punta comparte 249–286 mm³ con el núcleo (= su radio) y en 1.1 (macho real vs piso calculado ±1.0–1.6 mm).
- Posiciones (arnés, marco de la base, centro en 0): carcasa x ±18/±20/±24, y +40/−38/+34/+26 → 6 arriba, 2 abajo.
  1599HBK: 4 esquinas + 4 en fila y=+34 con x −83/−71/−59/−47. 1557BGY: los 8 dentro de 54×40 en una pieza de 80×80.
- Láminas: alojamiento de cabeza ⌀5.381 **PASANTE** en la expulsora y la «retenedora (cabezas)» solo trae ⌀2.881 pasante →
  ninguna placa captura la cabeza. ⌀ de pin 2.511 / 2.881 / 5.381 según la hoja; el 3D lleva punta ⌀2.381 + cuerpo ⌀4.763:
  la lámina no conoce el escalonado (causa 3 de LAS 20 PIEZAS). Retornos ⌀12 en las esquinas de la expulsora caen
  dentro del inserto de núcleo (2.4; lo mueve LOS INSERTOS SE BARRENAN — coordina por DATOS, no por código: tú no toques
  los retornos).

## YA-EXISTE (prueba de ausencia)
- `gripEjectorLayout(mesh, {nPins, pinDiaMm, wallMm})` rasteriza la malla LOCAL y elige columnas de pared por puntaje (§11.2.5).
- La malla local ya se tesela en E7 (`OCC.tessellate(oc, ciclo.piezaShape, 0.5, 0.6)`): un rayo −Z por (x,y) de cada pin
  sobre esa malla da el piso REAL (la primera cara interior desde abajo = donde termina el macho).
- `estacion10Dado` (estudio-molde-datos.ts:3752) dimensiona punta/cuerpo/largo libre; la lámina barrena con
  `standardHoles(spec,'B'|'ejector'|'ejector-ret')` (mold-drawing-set.ts:555) por `spec.ejectors`.
- La estación 8 (portamoldes) ya pasa `cuerpoDiaMm` como ⌀ de barreno a la base; la lámina sigue con el ⌀ de la punta.
- NO existe: piso por rayo; regla de equilibrio; alojamiento ciego de cabeza; pin escalonado en la lámina.

## EJERCICIOS
- [ ] piso REAL: rayo −Z en (x,y) de cada pin sobre la malla local → z de la cara interior; la punta termina AHÍ (y el macho
      del kernel ya está ahí: Δ punta↔macho = 0 ± 0.05). Guardar `puntasVsCaraMm[]` en `ciclo.e10` y exponerlo en la tira
      (`data-puntas-vs-cara` en `molde-de-la-pieza`) para que el inspector lo lea.
- [ ] equilibrio: restricción en el agarre — centroide de pines dentro de 0.1·L del centroide del área proyectada Y cada pin a
      ≤ N mm de pared/costilla/poste (cita §11.2.x; si el libro no da el número, declararlo como regla nuestra con su razón).
- [ ] cabeza capturada: `standardHoles` de `ejector-ret` con alojamiento CIEGO (prof = cabeza + holgura) y `ejector`
      pasante al ⌀ del cuerpo; el escalonado (punta ⌀ / cuerpo ⌀) en las tablas y en la BOM.
- [ ] el juez pin↔agua con LISTA completa (todos los pares bajo ½D), no el mínimo — usa el circuito que haya (el agua la
      arregla otra orden en paralelo: NO toques cooling-design/coolinglines/estacion8Dado).
- [ ] las 4 piezas: puntas en la cara (|Δ| ≤ 0.05), centroide dentro de la regla, 7.2 sin pin↔núcleo (o con el barreno que
      LOS INSERTOS haga: reporta el mm³ que quede), capturas de la planta con pines + centroides.

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/eject-layout.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-drawing-set.ts
- scripts/ciclo-dado-test.cjs

## CREA
- public/evidencia/2026-09-21-los-pines-en-la-cara-del-macho/resultados.json
- public/evidencia/2026-09-21-los-pines-en-la-cara-del-macho/pines-en-la-cara.png

## BORRA
- (nada)

## PREEXISTENTE
- (nada — worktree limpio)

## EVIDENCIA (se declara ANTES de trabajar)
- 4/4 piezas: |punta − cara del macho| ≤ 0.05 mm en los 8 pines · centroide dentro de la regla · láminas con cabeza capturada;
  números antes → después; captura por pieza (planta con pines y los dos centroides; corte por un pin).
- tsc: cero errores nuevos contra la base de 66 · ciclo-dado-test 266/266 (el cubo tiene piso = pared: no debería cambiar;
  si cambia, acta) · orden-gate VERDE · sin deploy.

## CIERRE (se llena al terminar)
