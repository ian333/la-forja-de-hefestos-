# ORDEN G2: LOS AJUSTES DE LA FUSIÓN (semana 2) — la inspección lee el acero, una apertura, el signo del empaque y el camino que vuelve a pasar

ESTADO: hoy
PRIORIDAD: 1

BASE: 955383b

OBJETIVO: las cuatro órdenes de la semana 2 (H, J, I, G) ya están en main. Cada una pasó sola; juntas quedan cuatro costuras que
ninguna podía cerrar desde su región. Al terminar: la inspección (paso 7) enseña los números del ACERO (columna ② de H), la apertura
es UN número en pantalla, hoja, expediente, ficha de la planta y motor, la estación 8 no dice ✓ a un empaque que no alcanza, y el
camino de la carcasa vuelve a pasar en el MODO CAMINO. Todo medido sobre main fusionado.

## LO QUE SE CAMBIA (un cambio → medir → el siguiente)
1. **La inspección lee el ②.** `ForgeBRepStudio.tsx` (efecto del paso 7, ~L5609): hoy `const C = revision?.contratos` y el `dz`
   salen del dictamen del paso 4 (①). Con el molde hecho existe `rejuicio` (useMemo de la orden H, `rejuzgarConElMolde`): la
   inspección debe leer `rejuicio?.rev ?? revision` (contratos Y pkg) y re-armarse si cambia. Esperado en la 1594C Box (CIERRE de H):
   DP 11.0 de 9.29 MPa · COLADA VS CICLO 75.8 contra 21.7 s · FREEZE 20.01 de 21.70 s · CLARO ⚠ 3.49 de 3.17 · `agua-ciclo` ✗ 41.0
   contra 64.7 s · `agua-paso` ✗ 58.3 mm = 2.47·H → ✗ totales 5. Cada ✗ tiene su punto en su capítulo (los de agua-ciclo y agua-paso
   en «qué manda el ciclo» / el agua); el cierre dice 5. La nota «Dos bebederos… (los une la orden un veredicto)» del punto de la
   colada desaparece cuando el ② ya juzga el bebedero cortado (`inspeccion-recorrido.ts` ~L181).
2. **Una apertura.** Hoy: pantalla y `animZ('clamp')` 152.5 mm = 2.5·33.3 + 69.2 (el bebedero que la E5 corta, medido sobre la pieza);
   motor `seleccion.apertura.strokeMm` 135.4 = 2.5·33.3 + (85.4 − 33.3) con un bebedero ESTIMADO (`moldmachine.ts` ~L642,
   `sprueLenMm = base.plateAmm + 25.4`). Con `spec.bebederoCortado` presente, la colada que sale es su `largoMm` (¡NO la vuelvas a
   restar H: daría 119.2, la advertencia de la orden I!). La hoja de análisis, el expediente y la tarjeta TU PLANTA («abre 447 de 700»)
   leen la apertura del pkg del ② cuando existe; sin molde, la ① se rotula «estimada». Kazmer §6.3.1 p.123 + Tabla 6.1 p.129; los
   +10 mm son regla de Hefestos. Mide: pantalla = hoja = expediente = tarjeta = animZ.
3. **El signo del empaque.** `estudio-molde-datos.ts:3478` imprime «empaca ${freezeActualS}s ≥ t_pack …s ✓» fijo: con 19.99 contra
   21.70 dice ≥ y ✓. Que diga la comparación real (como la línea 3485 ya lo hace) y que coincida con FREEZE del ②.
4. **El camino de la carcasa vuelve a pasar.** El runner (`scripts/camino-runner.cjs` + `scripts/forja-drive.cjs`) se rompe en el paso 3
   desde el MODO CAMINO (4373705): `piel-futuro.ts:109` le pone `pointer-events:none` a la tira de lentes y el runner hace un clic de
   Playwright a `parte-lente-enfriamiento` que vence a los 15 s. El arreglo va en el RUNNER (clic por `eval`, o `tab-diseno` antes),
   NO en la app (el MODO CAMINO esconde a propósito). Corre el camino completo en tu copia y reescribe su `## MEDIDO`.
5. **El banco sobre la fusión** (`scripts/qa-banco.cjs`, ver `scripts/qa-LEEME.md`): huella ×3 + control «pared 2.8» que muerde +
   regresión del reloj congelado + los 5 rotos en rojo + el sano en verde + `VOLUMEN_GATE` de J + `qa-dorados`. Los dorados que
   cambien A PROPÓSITO (p. ej. `aperturaMm` 135.4 → ~152.5 por el cambio 2) se listan (dorado · viejo · nuevo · por qué); NO los
   re-grabes: lo hace el coordinador con tu razón.

## YA-EXISTE (prueba de ausencia)
- `rejuicio` (ForgeBRepStudio.tsx, orden H), `moldeRealDelCiclo` (useMoldStudio.ts), `rejuzgarConElMolde` (revisar-modelo.ts).
- `rojosDelDictamen`, `armarRecorrido`, `cierreDeLaInspeccion` (inspeccion-recorrido.ts, orden I). Los arneses de I en iangpu
  `/home/ian/el-plan-dev4/` (capturas por punto) y de H en `/home/ian/el-plan-dev5/h/` (`mira-h.cjs`, `mide-h.cjs`).
- `scripts/qa-banco.cjs`, `qa-huella.cjs` (con `VOLUMEN_GATE`), `qa-dorados.cjs`, `qa-fabrica-rotos.cjs`; el cubo `ciclo-dado-test.cjs`.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/inspeccion-recorrido.ts
- src/forja/mold/moldmachine.ts
- src/forja/mold/expediente.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/mold/estudio-molde-datos.ts
- scripts/camino-runner.cjs
- scripts/forja-drive.cjs
- caminos/la-carcasa-de-mitsubishi.md

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- Captura 4K (juzgada con Read) de: el punto de la colada con 11.0/9.29 y sin la nota de dos bebederos; el cierre con sus 5 rojos;
  la apertura en pantalla, hoja, expediente y tarjeta TU PLANTA con el mismo número.
- El texto de la estación 8 con el signo correcto (captura o lectura del DOM).
- El camino de la carcasa: N/N pasos y checks, con el `## MEDIDO` reescrito.
- El banco: su acta (ruta) con CONFIABLE o con lo que no lo es; dorados que cambian, con razón.
- tsc sin errores nuevos (base: 58 en main fusionado; guarda tu propia línea base antes del primer cambio); el cubo 270/270.

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
- evidencia:
- preguntas abiertas:
