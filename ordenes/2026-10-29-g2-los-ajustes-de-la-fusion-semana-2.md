# ORDEN G2: LOS AJUSTES DE LA FUSIÓN (semana 2) — la inspección lee el acero, una apertura, el signo del empaque y el camino que vuelve a pasar

ESTADO: hoy
PRIORIDAD: 1

BASE: a1fe7f9 (el worktree nació en origin/main, divergente y sin trabajo propio: `git reset --hard main` antes de tocar nada)

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

## CIERRE (2026-10-29 · MEDIDO, no contado)

**Orden vs entregado.** Los cinco, un cambio a la vez, cada uno medido en la APP REAL (forja-dev4 :5195, GPU `ANGLE … D3D12
(NVIDIA GeForce RTX 4070 Ti)`, 1594C Box por el camino hasta el portamoldes, 8 pines, capturas 3840×2160 juzgadas con Read) con
el arnés `mira-g2.cjs` (reúsa insp-v2/sonda-i de la orden I y mira-h de la H: lee el DOM y `__qaForja`/`__forgeBrep`):
ANTES (main a1fe7f9) → A (cambio 1) → B (+2) → C (+3, el código final).
1. **La inspección lee el ②** (`ForgeBRepStudio.tsx`, el paso 7): el recorrido se arma con `rejuicio?.rev ?? revision` (contratos
   Y pkg) leído del render vivo (`armarInspRef`; antes el efecto leía el `revision` del render en que se abrió, ~8 s antes) y se
   RE-ARMA si cambia la firma del juicio con la inspección abierta (conserva el punto). `inspeccion-recorrido.ts`: el punto del
   dictamen dice cuál juzga («re-juzgado con tu molde…» · «② en el acero»); «qué manda el ciclo» enseña `agua-ciclo` y
   `agua-paso` con su número contra su límite (antes `agua-ciclo` salía como «rojo sin vista»); la nota de «dos bebederos» lee
   el formato de H y sale sólo si el dictamen juzgó el del diseño (MEDIDO: tras la fusión de H el regex viejo ya no casaba y la
   nota se había apagado sola, también cuando debía salir); el cierre trae la decisión del libro para PASO y CICLO y la de CLARO
   ya no habla de «otra agua».
2. **Una apertura** (`moldmachine.ts`): con `spec.bebederoCortado` la colada que sale con la pieza es su `largoMm` (medido SOBRE
   la pieza; NO se le resta H — daría 119.2, la advertencia de I) → `seleccion.apertura.strokeMm` del ② = 2.5·33.3 + 69.2 = 152.5.
   Sin molde (paso 4, E2) se queda el estimado y se rotula. La hoja de análisis toma la máquina del paquete ② y dice la CARRERA
   («abre 152.5 mm») y el alto abierto con su cerrado ESTIMADO; la tarjeta TU PLANTA recibe `pkgMolde` (②) y dice «abre» = la
   carrera (antes «abre 447» era el alto abierto), con «(estimada…)» sin molde; el expediente la lleva en su hoja.
   Kazmer §6.3.1 p.123 + Tabla 6.1 p.129; los +10 mm, regla de Hefestos (sin cambio).
3. **El signo del empaque** (`estudio-molde-datos.ts`, E8): compara de verdad (≥ ✓ / < ✗ VIOLA) y el freeze del bebedero
   cortado se calcula con su ⌀ EXACTO (2·rBase), el mismo del ② (MEDIDO: mismas constantes del ABS en la E8 y en el motor;
   19.99 contra 20.01 era sólo el ⌀ redondeado a 8.62).
4. **El camino** (`caminos/la-carcasa-de-mitsubishi.md` + `scripts/camino-runner.cjs`): en el MODO CAMINO la navegación del
   producto es el riel de 9 pasos; el runner pulsa `riel-paso-3/5/6/8/9` (idempotentes: un reintento no apaga nada) en vez de la
   tira escondida (`parte-lente-*`, `pointer-events:none` a propósito). Y `--sin-tablero`: en las copias `forja-devN`
   `public/temis.json` es un ENLACE al repo principal — correr el tablero desde una copia lo reescribiría (el tablero es del
   coordinador). La app no se tocó para esto. `forja-drive.cjs`: en TOCA, sin tocar (no hizo falta).
5. **El banco** sobre la fusión: ver abajo.

**Números, 1594C Box, ANTES (main a1fe7f9) → DESPUÉS (esta rama).**
| qué | ANTES | DESPUÉS |
|---|---|---|
| dictamen que lee la inspección | ① paso 4: **4 de 69** (DP, COLADA VS CICLO, CICLO, FREEZE) — y el ② de la lámina ya decía 5 | **② en el acero: 5 de 69** (DP, COLADA VS CICLO, PASO, CICLO, FREEZE), «re-juzgado con tu molde» |
| colada (punto 2) | 8.7 MPa de 4.3 · 145 s contra 21.7 (bebedero ⌀11.94 × 85.4 del diseño) junto a la cota «bebedero sobre la pieza 69.20» del que se corta | **11.0 MPa de 9.3** (9.29) · **75.8 s** contra 21.7 — número y cota del MISMO bebedero; sin nota de «dos bebederos» |
| compuerta | se congela a los 8.3 s (edge gate supuesto) · pide 21.7 | **20.0 s** (20.01, la base del bebedero) · pide 21.7 |
| qué manda el ciclo | sin chips; `agua-ciclo` como punto «rojo sin vista» aparte (11 puntos) | ✗ PASO ✗ CICLO en su punto: «el ciclo con que se cotizó 41.0 s · lo más grueso pide 64.7» y «el paso real de la serpentina B 58.3 mm · 2.47·H · máx 2·H» (10 puntos) |
| agua más justa | (①: CLARO ✓ 3.76/3.17 en otro par) | «3.49 mm · mínimo 3.17 · de panzazo · el dictamen mide lo mismo: 3.49 contra 3.17» |
| el cierre | 4 rojos (la decisión de CICLO era el detalle crudo) | **5 rojos**, cada uno con su decisión del libro (PASO: Eq 9.24 p.214 · CICLO: §9.2.1 p.203 · §2.3.1) |
| apertura — pantalla (punto «abre, sale y empuja») | abre 152.5 «(El selector de máquina usó 135.4 con un bebedero estimado…)» | **abre 152.5**, sin nota |
| apertura — `animZ('clamp')` | 152.5 | **152.5** |
| apertura — motor `seleccion.apertura.strokeMm` | ① 135.4 · E2 135.4 · ② 135.4 | ① 135.4 · E2 135.4 (estimadas) · **② 152.5** |
| apertura — hoja de análisis | «abierto 447 de 1010 mm» | **«abre 152.5 mm · abierto 465 de 1010 mm (cerrado ≈ 312, estimado)»** |
| apertura — expediente (HTML descargado) | «abierto 447 de 1010 mm» | **«abre 152.5 mm · abierto 465 de 1010 mm…»** |
| apertura — tarjeta TU PLANTA | sin molde: «abre 447 de 1010» · con molde: «abre 447 de 1010» | sin molde: **«abre 135.4 mm (estimada: el bebedero se corta en el paso 6) · abierto 447»** (`data-apertura-fuente=estimada`) · con molde: **«abre 152.5 mm · abierto 465»** (`acero`) |
| la máquina, disparo | 20 % (colada del diseño) | 19.2 % en hoja/tarjeta/inspección (la colada que se corta); dorados (E2) sin cambio |
| E8, la cadena del bushing | «⌀8.62 → empaca 19.99s ≥ t_pack 21.70s ✓ pero ENFRÍA…» | **«⌀8.62 → empaca 20.01s < t_pack 21.70s ✗ VIOLA el empaque (rechupes): la base se congela antes de terminar de empacar y ENFRÍA en 75.7s…»** = FREEZE ② 20.01 de 21.70 |
| tsc | base 58 | **58, cero nuevos** (`comm -13` vacío) |
| el cubo | — | **270/270** (código final; sin ACTA: ningún literal se movió) |

**El camino de la carcasa** (runner en el MODO CAMINO, `riel-paso-*`, `--sin-tablero`, forja-dev4): **8/9 pasos** · el único
rojo es `p3-2`, el reloj del campo de enfriamiento (> 2.5 s), el MISMO rojo conocido desde el 2026-10-22 (8/9, 46/47); antes de
este cambio el runner se rompía en el paso 3 por el clic a la tira escondida. `## MEDIDO` reescrito. Log: iangpu
`/home/ian/el-plan-dev4/g2/camino.log`, cuadros en `g2/camino-evid/`.

**El banco** (`qa-banco.cjs` sobre esta rama, build de producción en la copia): **CONFIABLE · VERDE** — huella ×3 VERDE (su
control «pared 2.8» muerde; la carrera del reloj congelado no regresó), dorados VERDE (su control muerde), 0 de 5 piezas rotas
pasaron la puerta y el sano pasó. Acta: iangpu `/home/ian/el-plan-dev4/qa/g2/acta.html`. **Dorados que cambian: ninguno** — el
dorado `aperturaMm` lee la apertura de la E2 (135.4, estimada y así rotulada); la del acero (152.5) vive en el ②.

(Cierre completado por el coordinador el 2026-10-30 con los logs del agente: la sesión terminó antes de su commit.)
