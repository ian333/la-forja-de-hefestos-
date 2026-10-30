# ORDEN H: UN VEREDICTO — el dictamen se re-juzga con el molde real: el agua de la E6, la presión de la E5 y el bebedero que se corta

ESTADO: hoy
PRIORIDAD: 1

BASE: 54ea7ca

OBJETIVO: hoy hay DOS verdades sobre el mismo molde. El dictamen corre en el paso 4, ANTES del molde, con un agua que no existe
(`designCoolingLines({ nLines: Math.max(1, nCav) … })`, `moldmachine.ts:420`), con la presión de llenado ESTIMADA (la del FAN de la E5,
`ciclo.e5fan.pMaxMPa` = 18.9 MPa en la 1594C Box, no la usa nadie: la tubería `spec.fillMPaFan` la dejó la orden B y nadie la cablea)
y con el bebedero del paquete numérico (⌀11.94 → ⌀9.47, L 85.4) mientras la E5 CORTA otro (⌀8.62, L 69.2). Resultado visible: el
dictamen dice **CLARO ✗ (§9.2.7)** y la inspección (punto 3 del Foco) dice **3.49 ≥ 3.17 CUMPLE** — Kazmer (revisión de la película,
`/mnt/c/Users/sebas/Downloads/la-pelicula/kazmer/LA-INSPECCION-SEGUN-KAZMER.md` §1 punto 2): «uno de los dos mide otra cosa… mientras
no se aclare, el video no se publica».
Al terminar: cuando el molde existe, el dictamen se RE-JUZGA con el agua real de la E6, la p_fill de la E5 y el bebedero que se corta;
la pantalla (panel del dictamen + hoja de análisis) y el expediente enseñan DOS columnas «tu pieza sola (paso 4) · en el acero (con el
molde)»; y cada criterio tiene UN número en todo el sistema (dictamen = Foco = inspección = expediente).

## LO QUE SE CAMBIA (un cambio → medir → el siguiente)
1. **La presión de la E5**: cablear `fillMPaFan: ciclo.e5fan.pMaxMPa` (orden B, CIERRE «Pendientes (1)») y re-correr el dictamen
   cuando exista la E5. Medir DP antes → después en la 1594C Box (hoy 12.0 contra 9.45 MPa ✗ con la del FAN en node).
2. **El agua de la E6**: el dictamen juzga las líneas REALES de la E6 (número, ⌀, profundidad H, paso W, claro al acero), no
   `nLines = nCav`. CLARO (§9.2.7 p.216: «at least half a cooling diameter between the surface of the cooling line and the surface of
   any other mold component» — incluye la CAVIDAD y el plástico) sobre los MISMOS pares que mide el Foco/inspección. Si al medir
   resulta que el Foco no mide agua-contra-cavidad (Kazmer cree que eso es lo que difiere), el Foco lo agrega en la región que lo
   calcula y la inspección lo lee de ahí. Escribe en el CIERRE qué medía cada uno ANTES y por qué diferían.
3. **Un bebedero**: el que la E5 corta es el que juzga el dictamen (`feed-dp`, `feed-lazo`/COLADA VS CICLO). Un solo ⌀ y una sola L en
   dictamen, hoja, lámina y expediente.
4. **`agua-ciclo` deja de ser SIN-CABLEAR** (`mold-contratos.ts:~480-505`, la deuda está escrita ahí): la sección más gruesa viaja al
   paquete desde la lente ENFRIAMIENTO (`foco-lentes.ts`) CON SU FORMA — un poste es una barra (Eq 9.6, ≈ 65 s en los postes ⌀8 de la
   Box), una pared es una placa (Eq 9.5, 21.7 s); hoy `foco-lentes.ts:450` aplica la de placa a todo vóxel (134 s sobre los postes =
   cota superior, se rotula así). Kazmer §9.2.1 p.203: «consider the thickest section». Se juzga ciclo ≥ t_c(sección más gruesa).
5. **`llenado-area-proyectada`**: el cierre usa `projectedAreaMm2`, no L×W (orden B lo vio: 7,021 vs 7,029 en la caja; en piezas con
   ventanas sobrestima). El renglón deja de decir «descuento ya aplicado ✓» si no lo está.
6. **Las dos columnas** (dictamen del paso 4 y re-juicio con el molde) en el panel del dictamen, la hoja de análisis y el expediente.
   Par de control: una pieza SIN molde enseña solo la primera columna y lo dice («falta el molde: pulsa MOLDE»).

## YA-EXISTE (prueba de ausencia)
- `spec.fillMPaFan` y `presionesDelMolde` (moldmachine.ts, orden B); `ciclo.e5fan` (useMoldStudio.ts); el dictamen `revisar-modelo.ts`
  + `mold-contratos.ts`; la lente ENFRIAMIENTO por vóxel (`foco-lentes.ts`) con `coolingTimePlate`/`coolingTimeRod` (`cooling.ts`);
  la hoja de análisis «UNA SOLA VERDAD» (ForgeBRepStudio.tsx ~L4124) y el estado `dictamen` (~L3931); el expediente (`expediente.ts`).
- QA: `scripts/qa-huella.cjs`, `scripts/qa-dorados.cjs` (18 dorados ±5 %), `scripts/qa-banco.cjs`, el cubo `scripts/ciclo-dado-test.cjs`.

## TOCA
- src/forja/mold/moldmachine.ts
- src/forja/mold/mold-contratos.ts
- src/forja/mold/revisar-modelo.ts
- src/forja/mold/foco-lentes.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldPanels.tsx
- src/forja/mold/expediente.ts

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (otras órdenes trabajan EN PARALELO en los mismos archivos)
- moldmachine.ts: H = el paquete/dictamen (~L380-460). G toca el costo (~L256) y el material (~L376): no los toques.
- useMoldStudio.ts: H = el ciclo/re-juicio tras E5/E6. G toca el intake (~L612): no lo toques.
- ForgeBRepStudio.tsx: H = dictamen (~L3931) y hoja de análisis (~L4040-4140). I toca el paso 7/inspección; J la hoja de análisis
  SOLO en su maquetación (columna REF/§): si J y tú caen en el mismo renglón, tú mandas en el VALOR y J en el ancho.
- MoldPanels.tsx: H = el panel del dictamen. G toca el intake (~L590-610).
- expediente.ts: H = el bloque del dictamen. G toca el costo/tarifa.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE (touch esta orden antes).
- Tabla en el CIERRE, 1594C Box, ANTES → DESPUÉS: DP (MPa contra límite), COLADA VS CICLO (s contra s), CLARO (mm contra mm, y qué par),
  FREEZE, `agua-ciclo` (s contra s, con la forma), área proyectada, ⌀/L del bebedero en dictamen = hoja = lámina = expediente, ✗ totales.
- Captura 4K (§5 de las instrucciones) del panel del dictamen con las dos columnas y de la hoja de análisis, juzgadas con Read.
- Par de control: pieza sin molde → una sola columna, dicho en pantalla.
- `qa-dorados` en tu copia: los dorados que cambian A PROPÓSITO, listados (dorado · viejo · nuevo · por qué). NO los re-grabes: lo hace
  el coordinador en la fusión con tu razón. `qa-huella` ×3 estable en tu copia.
- El cubo 266/266, o ACTA R94 (check · viejo · nuevo · por qué) si cambia un literal.
- tsc sin errores nuevos contra tu línea base.

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
- evidencia:
- preguntas abiertas:
