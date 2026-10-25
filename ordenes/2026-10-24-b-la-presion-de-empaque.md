# ORDEN B: LA PRESIÓN DE EMPAQUE — 50 MPa editable alimenta clamp, placa, pilares y expulsión; los artefactos del dictamen mueren

ESTADO: hoy
PRIORIDAD: 1

BASE: (el agente pone `git rev-parse --short HEAD` tras `git merge --ff-only main`)

OBJETIVO: hoy el tonelaje usa solo la presión de LLENADO, sin piso (`clampFor`, `moldmachine.ts:172-179`): la hoja dice «2.3 % de
150 t» cuando a los 50 MPa que cita el propio contrato `llenado-tonelaje` (Kazmer §5.5.3, Eq 5.29) son ≈ 36 t = 24 %. Con ese mismo
número se dimensiona la placa de soporte (`moldmachine.ts:359`), y salen dos ✗ falsos del dictamen: ✗ FUERZA (`eject-fuerza` divide
F_eject entre ese clamp, `mold-contratos.ts:504-516`: 11.5 % → con piso 1.1 %) y ✗ DP (límite ½·ΔP de la misma fórmula,
`mold-contratos.ts:171`). Además ✗ WARPAGE usa la ventana de proceso entera como Δs (`mold-contratos.ts:1172-1174`), ⚠ POSITIVA usa
100 MPa fijos (`shrinkage.ts:87`) y `agua-ciclo` CUMPLE con cualquier ciclo > 0 (`mold-contratos.ts:482`).

**DECISIÓN (ian la delegó a los expertos, 2026-10-24):** DOS presiones con nombre (juez C, D2):
- **p_pack** (presión de empaque/sostenimiento en cavidad): ENTRADA del intake, **50 MPa por defecto, editable**. Alimenta clamp
  (max(0.5·ΔP_fill, p_pack)·A_proy, Eq 5.29), placa de soporte, pilares, `eject-fuerza` y la contracción (Tait). Si la E6 pide más
  (p. ej. 66 MPa), se PROPONE en pantalla; no se cambia sola.
- **p_fill** (presión de llenado): `pMaxMPa` del solver FAN de la E5 cuando exista (ya viaja en `e5fan`, `useMoldStudio.ts:~724`);
  si no, la de `clampFor` rotulada «estimada (longitud de flujo ≈ largo)». Juzga `feed-dp`, el techo de llenado y la máquina.

## LO QUE SE CAMBIA
1. `moldmachine.ts`: clamp con p_pack; la placa y los pilares con ese clamp. Cuentas de referencia del juez C para la 1594C Box: área
   7,029 mm² → 351 kN = 36 t = 24 % de 150 t; flecha de la placa actual a 50 MPa 0.120 mm (= 6 venteos de 0.02) → placa ≈ 74 mm o 2
   pilares. Reproduce TÚ esas cuentas antes de tocar y escríbelas en el CIERRE.
2. `mold-contratos.ts`: `eject-fuerza` y `feed-dp` con la presión que les toca; `agua-ciclo` deja de aprobar cualquier ciclo > 0 (compara
   contra algo medible —p. ej. que el ciclo declarado no sea menor que el t_c calculado— o pasa a SIN-CABLEAR; decide con cita);
   WARPAGE (Eq 10.19 pide la caída de UN disparo, no la ventana) y POSITIVA (100 MPa fijos) pasan a SIN-CABLEAR hasta medirse de verdad,
   con su razón en el `detalle`.
3. `shrinkage.ts`/`revisar-modelo.ts`: donde hoy se usa 100 MPa o 66 MPa fijos para la contracción, que lean p_pack (declarado).
4. El intake (`useMoldStudio.ts` ~L612 y su campo en `MoldPanels.tsx` ~L590-610): campo «presión de empaque (MPa)» con 50 por defecto.

## YA-EXISTE
- `clampFor`, `llenado-tonelaje` (cita §5.5.3), `optimizeSupportPlate`, `e5fan.pMaxMPa`, el intake con pared/material/volumen.
- El test del cubo `scripts/ciclo-dado-test.cjs` (266 checks): esta orden CAMBIA literales del cubo a propósito (tonelaje, placa,
  expulsión) → van como **ACTA R94** en el CIERRE (check · valor viejo · valor nuevo · por qué).

## TOCA
- src/forja/mold/moldmachine.ts
- src/forja/mold/mold-contratos.ts
- src/forja/mold/shrinkage.ts
- src/forja/mold/revisar-modelo.ts
- src/forja/mold/platesizing.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA
- Gate VERDE; tsc sin errores nuevos; el cubo con ACTA R94 (o 266/266 si no cambió ningún literal).
- Captura 4K de la hoja de análisis (lámina 08) de la 1594C Box: «36 t · 24 % de 150 t» (o tu número reproducido) y la placa/pilares nuevos.
- Captura 4K del dictamen (04): de 6 ✗ a ≤ 4, cada uno con su número; DP y FUERZA leídos con la presión que les toca.
- Par de control: con p_pack = 4.8 MPa (el valor viejo) el tonelaje vuelve a ~2.3 % (el cambio es el piso, no otra cosa).

## CIERRE (se llena al terminar)
