# ORDEN: LA PRESIÓN QUE CIERRA — el clamp requerido con presión de empaque, validado contra el libro y la máquina

ESTADO: proximo
PRIORIDAD: 5

BASE: 12fd545

OBJETIVO: hallazgo de UNA SOLA VERDAD (2026-09-09), al poner números en la fila de la máquina: la carcasa
1594C sale con «clamp 2.9 % de 150 t» (≈4 t). Hoy `clampTons = P_cav × A_proy` con `P_cav = ΔP de LLENADO ×
CAVITY_PRESSURE_FACTOR (0.5)` (`moldmachine.ts` clampFor/physicalDesign, líneas ~165-179 y ~289): la presión
de EMPAQUE (la que de verdad abre el molde) no entra. Un moldista espera 20-40 t para una caja PP de 106×66 mm.
Mientras, «cabe en la del taller» se decide con 4 t y el expediente lo firma. Al final de esta orden el clamp
requerido sale de la presión de cavidad del LIBRO (Eq 5.29 con la presión de empaque/mantenimiento, cap 5),
se valida contra los dos ejemplos del libro (cup: 50 MPa → 400 kN; bezel: 36.46 MPa → 1 400 kN) SIN mover
esos tests, y la fila de la máquina y el dictamen muestran el número nuevo con su §.

## YA-EXISTE (prueba de ausencia)
- `machineRequirements` (`machinesizing.ts`) ya recibe `cavityPressureMPa` y calcula Eq 5.29 con SF 1.1;
  `mold-machinesizing-test` reproduce cup y bezel con las presiones del libro DADAS. Lo que falta es que
  `physicalDesign` le pase una presión de cavidad con empaque, no ½ del ΔP de llenado.
- `filling.ts` (`pressureDropSegment`, `convergeVelocityTraced`) da el ΔP de llenado; no hay módulo de
  empaque (§5.x del libro: presión de mantenimiento ~ 50-80 % de la de inyección; o P_cav empírica por material).
- NO existe: una presión de empaque en el paquete; un test que compare el clamp de la carcasa con un rango
  de taller (20-40 t) o con el disparo real cuando la máquina esté conectada.

## TOCA (probable; se confirma al empezar)
- src/forja/mold/moldmachine.ts
- src/forja/mold/machinesizing.ts
- scripts/mold-machine-test.cjs (solo si cambia la expectativa; cup/bezel NO se mueven)
- docs/MAQUINA-DEL-TALLER.md

## CREA
- public/evidencia/2026-09-09-la-presion-que-cierra/resultados.json

## BORRA
- (nada)

## EVIDENCIA (se declara ANTES de trabajar)
- cup y bezel del libro siguen dando 400 kN y 1 400 kN (tests intactos).
- La carcasa 1594C: clamp requerido en el rango 20-40 t con la fórmula del libro citada; la fila de la
  máquina dice «clamp X % de 150 t (§5.x, P_cav Y MPa con empaque)».
- Cuando la HT-150SV dispare: el clamp real (lectura del controlador) contra el calculado, en el doc.
- runner sin regresión; orden-gate VERDE.

## CIERRE (se llena al terminar)
