# ORDEN G: LOS DATOS DE TU PLANTA — tarifas en pesos, tus máquinas, tu resina y tu boquilla, capturados una vez y usados por un motor

ESTADO: hoy
PRIORIDAD: 1

BASE: 6655fdd (el worktree nació en origin/main, divergente y sin trabajo propio: se puso en main antes de tocar nada)

OBJETIVO: ian (2026-10-24, al congelar las estaciones nuevas): «me gusta, es la nuestra, descarga y configura todos sus datos». Hoy el
costo cobra `spec.machiningRateUSDh ?? 100` («EE.UU. por defecto», `moldmachine.ts:256`), toda resina que no sea ABS se vuelve PP
(`plastic === 'ABS' ? 'ABS' : 'PP'`, `moldmachine.ts:376`) y la máquina es la del taller. Al terminar, la planta captura UNA vez:
(a) sus tarifas en MXN/h por centro (fresado CNC, electroerosión, banco/ajuste, ingeniería); (b) sus inyectoras (tonelaje, ancho entre
barras, daylight mínimo y máximo, disparo en cc, radio y orificio de la boquilla); (c) su resina con su ficha; y UN solo motor las
usa: el costo de referencia, la selección de máquina (tonelaje, barras, daylight, disparo §4.3.3) y la contracción. Lo que FALTA se
dice («falta: tu tarifa de fresado») y el costo sale rotulado «referencia, Kazmer Apéndice D (USD)» — nunca un número inventado.
Los datos de la planta son suyos: se guardan en su navegador y se descargan/suben como un archivo de la planta; la telemetría deja de
mandar el nombre de la pieza (lo marcó el abogado del debate; orden D lo vio en `/api/telemetry/events`).

## CONTEXTO QUE DEBES LEER
- `/mnt/c/Users/sebas/Downloads/la-pelicula/debate-25-expertos/00-PLAN.md` y el juez B (`jueces/`, mercado-venta-soporte-ley): qué datos
  pide la planta y cómo se cobra la revisión (MXN 7,500 + IVA).
- `/mnt/c/Users/sebas/Downloads/la-forja-ataque/` (orden F): lo que se le promete a la planta.
- La inyectora del taller (FCS HT-150SV) ya está como dato en `src/forja/mold/machinesizing.ts` / `moldbase.ts`: es la primera máquina
  de la lista, no se borra.

## LO QUE SE CAMBIA
1. **La ficha de la planta** en el intake (DOM, `MoldPanels.tsx`; MODO CAMINO: que se vea solo en el paso que le toca): tarifas MXN/h,
   inyectoras, resina, boquilla. Guardar en localStorage (envuelto en try/catch) + botón descargar/subir el archivo de la planta.
2. **El costo**: con tarifa de la planta → MXN con su desglose (horas × tarifa por centro); sin tarifa → el de hoy, rotulado
   «referencia (Kazmer Apéndice D, USD) — falta tu tarifa». El expediente dice cuál de los dos es.
3. **La máquina**: la selección (`machinesizing.ts`) elige entre las inyectoras de la planta; si ninguna cabe, lo dice con el criterio
   que falla (tonelaje, barras con plugs, daylight, disparo), citando §4.3.3.
4. **La resina**: solo resinas con ficha completa del libro (las tablas de propiedades de Kazmer: busca en
   `docs/forja-research/libros/kazmer.md` y el PDF `/mnt/c/Users/sebas/Documents/David O. Kazmer (Auth.) - Injection Mold Design
   Engineering (Carl, Hanser Fachbuchverlag) - libgen.li.pdf`). Una resina sin ficha → se dice «sin ficha: no se calcula», no se
   convierte en PP. Mata el `'PP'` literal de `moldmachine.ts:376` y revisa los demás `?? 'PP'` por defecto (colada.ts, feed.ts,
   feed-layouts.ts, lamina-compuerta.ts): que lean la resina del intake.
5. **La telemetría** (`src/forja/telemetry-forja.ts`, `src/lib/telemetry.ts`): ningún evento lleva el nombre del archivo ni de la pieza.

## YA-EXISTE (prueba de ausencia)
- El intake (`useMoldStudio.ts` ~L612, campos en `MoldPanels.tsx` ~L590-610: pared, material, volumen, p_pack de la orden B).
- `materials.ts`, `ABS_KAZMER` (`cooling.ts`), `machinesizing.ts`, `moldbase.ts`, el costo en `moldmachine.ts` (~L256) y `expediente.ts`.

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/mold/moldmachine.ts
- src/forja/mold/machinesizing.ts
- src/forja/mold/expediente.ts
- src/forja/mold/materials.ts
- src/forja/mold/colada.ts
- src/forja/mold/feed.ts
- src/forja/mold/feed-layouts.ts
- src/forja/mold/lamina-compuerta.ts
- src/forja/telemetry-forja.ts
- src/lib/telemetry.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/moldcost-detailed.ts

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (otras órdenes trabajan EN PARALELO)
- moldmachine.ts: G = costo (~L256) y material (~L376). H re-juzga el dictamen (~L380-460): no lo toques.
- useMoldStudio.ts: G = el intake (~L612). H toca el ciclo/re-juicio tras E5/E6.
- MoldPanels.tsx: G = el intake (~L590-610). H toca el panel del dictamen.
- expediente.ts: G = costo/tarifa. H = el bloque del dictamen.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- Par de control con la 1594C Box: (1) sin ficha → costo de hoy, rotulado «referencia… falta tu tarifa» (mismo número que hoy);
  (2) con una ficha de prueba (tarifas y máquinas inventadas Y ROTULADAS «de prueba» en el CIERRE, nunca en el código) → costo en MXN
  con su desglose, y la máquina elegida entre las de la ficha; (3) una ficha cuya única inyectora no cierra → la pantalla dice cuál
  criterio falla.
- Una resina sin ficha → «sin ficha», no PP. La 1594C en ABS da los mismos números que hoy (`qa-dorados` en tu copia: los 18 dentro de
  ±5 %; si alguno cambia, explícalo).
- Captura 4K del intake con la ficha y del expediente con el costo en MXN, juzgadas con Read.
- grep del payload de la telemetría (o el evento capturado en la red) sin el nombre de la pieza.
- tsc sin errores nuevos; el cubo 266/266.

## ENMIENDA 2026-10-29 (agente G, antes de medir)
- **src/forja/brep/ForgeBRepStudio.tsx** — entra por tres regiones chicas que NO son de H, I ni J:
  (1) `specPieza` (~L4050, la línea que B ya tocó): la spec del dictamen lleva la resina del intake/planta y la ficha de la planta;
  sin esto el dictamen elegiría la máquina del taller y el molde la de la planta = dos verdades. (2) el costo del expediente
  (~L4170-4185, la tarjeta «COSTO DE REFERENCIA» ~L10200 y la sección 3 de `expedienteHTML` ~L10745): hoy el HTML del expediente
  se arma AQUÍ, no en expediente.ts; el cálculo a mano se cambia por `costoDeReferencia`/`costoReferenciaHTML` (expediente.ts).
  (3) una línea que pinta `<TarjetaPlanta>` en el paso 2 del MODO CAMINO, junto a la puerta (~L8140). Ni el dictamen, ni la hoja,
  ni el paso 7 se tocan.
- **src/forja/mold/moldcost-detailed.ts** — un campo opcional `resina?: {rhoKgM3, costKg}` en `PartCostInputs` (y una línea en
  `estimatePartCost`): el costo por pieza leía `PLASTICS[plastic]`, que no trae PS ni PA6 (con ellas la E2 TRONABA: `plc`
  undefined) y tiene el PP a mano (905 / 1.50 contra 929 / 1.43 del Apéndice A). Con el campo, la ρ y el κ salen de la ficha;
  el ABS da lo mismo (1044 · 2.16 = `PLASTICS.ABS`).
- CREA sigue en (nada): la ficha vive en el intake (useMoldStudio), sus tipos en machinesizing.ts, la tabla de resinas en
  materials.ts y la tarjeta en MoldPanels.tsx.

## CIERRE (2026-10-29 · MEDIDO, no contado)

**Orden vs entregado.**
1. **La ficha de la planta** → tarjeta «TU PLANTA · PASO 2» (`TarjetaPlanta`, MoldPanels.tsx; data-testid `ficha-planta`), a la
   derecha de LA PUERTA, SOLO en el paso 2 del MODO CAMINO (en el paso 6 ya no está: captura `03-molde`). Captura: tarifas MXN/h de
   fresado CNC, electroerosión, banco/ajuste e ingeniería; inyectoras (tonelaje, barras H×V, daylight mín/máx = cotas A/B de la
   Fig 4.24, disparo cc, boquilla radio y orificio §6.3.1, y opcionales presión máx y expulsión); cuánto sobresalen los conectores
   del agua (§4.3.3 «including cooling plugs»); la resina (solo las 16 con ficha del libro, u «otra» que dice «sin ficha»). Vive en
   `localStorage['forja.planta.v1']` (lectura y escritura en try/catch; sin él la ficha vive en la pestaña y en el archivo) y en un
   archivo `planta-<nombre>.json` (⬇ archivo de la planta / ⬆ subir archivo; `leeFichaDeLaPlanta` valida: lo que no es número > 0
   queda SIN DATO). Debajo, «LO QUE TU FICHA LE HACE A ESTA PIEZA», del MISMO `moldMachine` que el dictamen: la máquina elegida o el
   criterio que falla, y el costo. Lo que falta dice «falta: …». Botón «+ la del taller (FCS HT-150SV)» copia sus datos de catálogo
   (la máquina del taller sigue en el código, es la de siempre sin ficha).
2. **El costo** → `costoDeReferencia` (expediente.ts): horas del modelo de Kazmer (cap. 3, las mismas de `horasDelModelo`) ×
   la tarifa de SU centro: maquinado → fresado CNC (o electroerosión si el f_maq de la Tabla 3.4 es el de EDM; `factorDeMaquinado`,
   una sola función con moldMachine), acabado (Tabla 3.6) → banco/ajuste; ingeniería: el modelo no separa horas de diseño (§3.3.3
   las mete en la customización), se dice y no se inventan horas. Acero, base y customización NO se suman a los pesos (son compras
   en USD del libro; no hay tipo de cambio que no sea inventado): van en kg y factores. Sin tarifa: las MISMAS horas de hoy + la
   referencia del libro en USD, rotulada «referencia del libro (Kazmer §3.3, USD: 100 $/h de maquinado y 50 $/h de acabado del
   ejemplo; salario del Apéndice D ×3) — falta tu tarifa». OJO: el 100 $/h NO es «Apéndice D ×3» (eso da 71.82): es la tarifa que
   ASUME el ejemplo del bezel, §3.3.1.3 p.50; el comentario viejo se corrigió (`TARIFA_LIBRO_USDH`). La tarjeta del expediente, su
   pie y la sección 3 del HTML dicen cuál de los dos es.
3. **La máquina** → `selectInjectionMachine(…, planta)`: con inyectoras en la ficha elige SOLO entre ellas (la más chica que pasa,
   la misma regla que el mercado de referencia; §4.3.3 advierte del exceso de tonelaje); `juzgarMaquina` suma los conectores en
   las dos direcciones (regla de Hefestos: no sabemos por qué cara salen); sin dato en tonelaje, barras, daylight máx o disparo NO
   pasa («sin dato — captúralo»); sin presión/expulsión se avisa y no se juzga. Si ninguna pasa: «ninguna de tus inyectoras admite
   este molde (§4.3.3): <máquina>: clamp 39 t > 30 t». La boquilla: si la máquina elegida declara orificio, la colada se re-diseña
   UNA vuelta con él (§6.3.1, la entrada del bebedero sobre el orificio) y se re-juzga el disparo; el contrato `feed-boquilla` (H)
   deja de estar SIN-CABLEAR con una máquina que lo declara.
4. **La resina** → `RESINAS_KAZMER` (materials.ts): las 16 columnas del Apéndice A (p.390-393) sacadas del PDF con un script
   (pdftotext → columnas → JSON → TS, sin teclear; verificado contra `FEED_MATERIALS` ABS/PP y el texto crudo). `motorDeLaResina`
   (moldmachine.ts) arma de la ficha la power-law del llenado, el Tait, el calor, la expulsión (μ 0.5 = acero pulido §11.2, no la
   resina) y la colada. El ABS conserva los números con que el libro resuelve sus ejemplos (ABS_MG47 k 17,070; ABS_TAIT b3m 1.33e8
   de p.240; ABS_KAZMER; ABS_EJECT). Muerto el `plastic === 'ABS' ? 'ABS' : 'PP'`; `?? FEED_MATERIALS.PP` (feed.ts ×2),
   `plastic ?? 'PP'` (sprue), `includes('PP') ? 'PP' : 'ABS'` (colada.ts ×3), `?? 'ABS'`/`?? 'PP'` (feed-layouts.ts ×8) y
   `?? 'PP'` (lamina-compuerta.ts ×2) → `feedMaterial(resina)` estricto: sin ficha lanza `ResinaSinFicha` («PBT: sin ficha en el
   libro (Kazmer Apéndice A, p.390-393) — no se calcula: ni contracción, ni presión, ni máquina, ni costo»). Sin declarar:
   `RESINA_POR_DEFECTO` = ABS (la del taller y del cubo, visible en el intake). El select del intake ofrece las 16.
5. **La telemetría** → `lib/telemetry.ts`: el nombre del archivo que se suelta o se sube se registra como SECRETO en el `drop` /
   `change` (fase de captura, antes que la app) y cada evento se limpia antes de encolarse y otra vez al enviarse («‹archivo›»).
   `ocultarEnTelemetria(nombre)` agrega el nombre de la pieza del árbol. Los `mark` que mandaban nombre (`mold-build` ×2,
   `leccion.completa`) ya no lo llevan.

**Números.**
- **tsc** (forja-dev6): base 67 → 60 errores, **0 nuevos** (`comm -13` vacío); se fueron los 7 de feed-layouts (FeedMaterial →
  MeltMaterial, el mismo cast que feed.ts).
- **El cubo**: **270/270** después del último cambio de motor y otra vez con el código final (`cubo-final.log`). Sin ACTA: ningún literal se movió.
- **Dorados 1594C Box en la app** (qa-dorados, ABS, sin ficha): **18/18 al 0 %, VERDE** — antes (base 6655fdd) 18/18 al 0 %.
- **Motor base vs nuevo en node** (misma spec, `compara-motor.mjs`): ABS sin ficha BIT-IGUAL en arquitectura, cavidades, molde US$,
  $/pza, cierre, máquina, contracción, colada, gate, expulsión, placas — salvo `qTotalW` 405 → 471 W (caja) y 315 → 367 W (cubo):
  ρ y cp del calor por ciclo pasan de 1050/2000 a mano a 1044/2340 del Apéndice A; no toca ningún dorado (el plug de agua es el
  mismo). Por resina (caja, pared 3.2):
  | resina | base | nuevo |
  |---|---|---|
  | PP | contr 1.31 % · p_fill 8.6 (la del ABS) · F_exp 3,890 N (la del ABS) | contr 2.69 % · p_fill 4.2 · F_exp 8,759 N |
  | PS | **TRONABA** (`plc` undefined) | contr 0.32 % · p_fill 23.2 · sprue ⌀15.45 |
  | PC | contr 0.58 % · p_fill 8.6 (= ABS exacto) | contr 0.51 % · p_fill 66.6 · sprue ⌀15.55 |
  | POM | contr 0.58 % · p_fill 8.6 (= ABS exacto) | contr 4.78 % · p_fill 9.0 |
  | PA6 | **TRONABA** | contr 3.69 % · p_fill 7.2 |
  | PA66-GF33 | **TRONABA** | contr 3.80 % · p_fill 10.9 |
  | PBT (sin ficha) | TRONABA | «sin ficha: no se calcula» |
- **El par de control EN LA APP** (forja-dev6 :5197, GPU ANGLE D3D12 RTX 4070 Ti, 1594C Box, capturas 3840×2160 juzgadas con Read;
  números de los `data-*` de la tarjeta y de `__qaForja.ciclo.e2.pkg` del molde armado). La ficha se SUBE por el input real
  (`planta-subir-archivo`). Los datos de las dos fichas son **DE PRUEBA, inventados** (no viven en el código, solo en
  `el-plan-dev6/g/ficha-*.json`): «Prueba 250 t» (560×560, daylight 250/900, 600 cm³, boquilla R19.05 ⌀5.5, 190 MPa, 50 kN) y
  «Prueba 80 t» (410×410, 150/700, 180 cm³, R12.7 ⌀3.5, 200 MPa, 22 kN), conectores 35 mm/lado, tarifas fresado 950 · EDM 1,200 ·
  banco 450 · ingeniería 1,100 MXN/h; la que no cierra: una sola «Prueba 30 t» (410×410, 150/700, 180 cm³) y solo fresado y banco.
  | caso | máquina (paso 2 = molde E2) | costo (paso 2 = expediente paso 9) |
  |---|---|---|
  | (1) sin ficha | FCS HT-150SV (taller) · cierre 26.3 % de 150 t · disparo 20 % — igual que hoy | «61 h de insertos (Kazmer cap. 3) · referencia del libro US$ 11,827 (100 $/h) · falta tu tarifa» · tarjeta ◇ ámbar |
  | (2) ficha de prueba | **Prueba 80 t (tu planta)** · cierre 49.3 % de 80 t · disparo 33.6 % · abre 447 de 700 mm; la de 250 t también pasa (avisa disparo 10 %) y gana la más chica; orificio 3.5 → entrada del bebedero ⌀5.0 → **⌀4.0** | **MXN 50,030** = 45 h fresado CNC × $950 ($43,038) + 16 h banco × $450 ($6,992); ingeniería $1,100/h «sin horas en el modelo»; tarjeta ✓; sección 3 del HTML «CON TU TARIFA (MXN)» |
  | (3) su única inyectora no cierra | «◆ máquina: ninguna de tus inyectoras admite este molde (§4.3.3)» + «◆ Prueba 30 t (tu planta): clamp 39 t > 30 t» (pide 39.4 t: 131.4 %); el dictamen (paso 4) pasa de 4 a **5 no cumplen** con **✗ MAQUINA §4.3.3** | MXN 50,030 (sí capturó fresado y banco; «falta: electroerosión, ingeniería» en la línea de tarifas) |
  | resina sin ficha (PBT Valox 420) | tarjeta: «◆ resina: PBT Valox 420 — sin ficha en el libro (Kazmer Apéndice A): no se calcula» y «◆ … no se calcula: ni contracción, ni presión, ni máquina, ni costo» (sin máquina ni costo, `data-error=1`); el dictamen: «no se pudo revisar: PBT Valox 420: sin ficha en el libro…». Escrita en el editor («otra (sin ficha)…») y guardada: `localStorage` = `{"resina":"PBT Valox 420",…}` | — |
  Motor en node con la MISMA spec (pared 3.2): (1) FCS 26.3 % · US$ 11,827 · 61 h; (2) Prueba 80 t 49.3 % · MXN 50,030; (3) «ninguna
  de tus inyectoras admite este molde (§4.3.3): Prueba 30 t (tu planta): clamp 39 t > 30 t», MXN 50,030 (fresado + banco
  capturados); PBT: `ResinaSinFicha`.
- **Telemetría** (todo lo que la app mandó a `/api/telemetry/events`, interceptado en `sendBeacon`/`fetch` antes de que cargue):
  sin ficha 139 eventos / 37 lotes, **0 con «1594C»**; con ficha 144 eventos / 38 lotes, **0 con «1594C»**, y el CONTROL que muerde
  en la misma corrida: el clic en el título («1594C Box · Expediente») y un `console.warn` con «1594C Box.stp» salieron como
  «‹archivo›» (2 tachados), mientras el nombre de OTRA pieza («Otra Pieza 777.stp») sí pasó (1): el filtro quita el nombre del
  cliente, no apaga la telemetría.

**Evidencia (rutas).** iangpu `/home/ian/el-plan-dev6/g/`: `dorados.log` (18/18 VERDE), `cubo.log` y `cubo-final.log` (270/270),
`app-sin-ficha/` (01 paso 2 · 02 editor vacío · 03 molde E8 · 04 expediente · `resultado.json` · `telemetria.json`),
`app-ficha/` (01 tarjeta con MXN · 02 editor con la ficha · 03 molde · 04 expediente ✓ · `expediente.html` + 06 su sección 3 ·
`telemetria.json` con el control), `app-no-cierra/` (01 tarjeta ◆ · 05 dictamen ✗ MAQUINA), `app-resina/` (02 editor «otra» ·
01 tarjeta «sin ficha» · 05 dictamen), `ficha-de-prueba.json` y `ficha-no-cierra.json` (DE PRUEBA), `g-mira.cjs` y `corre-g2.sh`
(el arnés). `/home/ian/el-plan-dev6/g-node/`: `compara.json` (motor base vs nuevo, 9 casos) y `tres-casos.json` (el par de control
en el motor con la spec de la app). Base medida antes de tocar: `/home/ian/el-plan-dev6/g-base/dorados-base.log` (18/18 al 0 %).
tsc: `/tmp/tsc-dev6-base.txt` (67) contra `/tmp/tsc-dev6.txt` (60), `comm -13` vacío. La tabla del Apéndice A extraída del PDF:
scratchpad del agente (`apA.json`, `parse_apA.py`). Turno de GPU: todas las corridas dentro de `flock /home/ian/el-plan/gpu.lock`
(la primera tanda se perdió en la fila: el `timeout` envolvía la espera del candado; corregido poniendo el `timeout` dentro del flock).

**Preguntas para ian.**
1. *Las tarifas de TU taller para la demo.* Hoy, sin ficha, la caja sale «61 h de insertos · referencia del libro US$ 11,827
   (100 $/h)»: dólares de un taller gringo del libro. Con la ficha de prueba (inventada) sale en pesos por centro. Para la demo hace
   falta UNA ficha real: tu tarifa facturada (no el sueldo) por hora de **fresado CNC**, **electroerosión**, **banco/pulido** e
   **ingeniería**; y de la FCS HT-150SV, lo que el catálogo no dice: **qué tornillo trae** (A ⌀40 = 251 cm³, B ⌀44 = 304, C ⌀50 =
   393 — hoy se usa el B), el **orificio y el radio de la boquilla instalada**, y **cuánto sobresalen tus conectores de agua** por
   lado. ¿Me los pasas (o los capturas tú en la tarjeta del paso 2 y descargas el archivo)? **Recomiendo**: captúralos tú una vez
   y guarda el `planta-….json`; es lo mismo que le vamos a pedir a cada planta.
2. *El costo en dólares cuando no hay tarifa.* Sin ficha, la pantalla dice las horas (las mismas de hoy) y además «referencia del
   libro US$ 11,827», rotulado «falta tu tarifa». Es la cifra que la orden A había apagado. ¿Se queda rotulada o la apagamos y solo
   decimos horas? **Recomiendo** dejarla solo en el expediente descargado y apagarla en la tarjeta: en el demo siempre va con la
   tarifa de la planta.
3. *La contracción de los plásticos cristalinos sale más alta que su propia ficha.* La caja en PP: la fórmula del capítulo 10 da
   2.69 % y la ficha del libro dice 1.2–2.2 %; en POM 4.78 contra 1.4–2.6. En los amorfos (ABS, PC, PS) cae dentro. La pantalla ya
   lo dice al lado. ¿Abrimos una orden para que en las cristalinas el número del motor se acote con el rango de la ficha? **Recomiendo
   sí**, y mientras tanto demos solo con amorfas (ABS, PC, PS, PMMA).
4. *Las máquinas «de catálogo» IM-50 … IM-500 no son de nadie.* Sin ficha, si la pieza no cabe en la FCS, el motor propone una de
   ellas con números «representativos». Con ficha ya no aparecen. ¿Las borramos y decimos «no cabe en tu taller: captura tus
   inyectoras»? **Recomiendo sí** (próxima orden; aquí no las toqué para no mover dorados).
5. *Una resina que no está en el libro.* Hoy se detiene todo («sin ficha: no se calcula»). ¿Dejamos que la planta capture la ficha
   de su proveedor (con los 13 coeficientes de Tait y la Cross-WLF)? **Recomiendo** sí, pero solo con la ficha COMPLETA, igual que
   la del libro; si le falta un número, no se calcula.

**Visto, de otras órdenes o de módulos fuera de mi TOCA (no lo toqué).**
- **La contracción de las semicristalinas sale ARRIBA de lo que publica su propia ficha**: el Tait isotrópico de `shrinkage.ts`
  (cap 10) da PP 2.69 % (ficha 1.2–2.2), POM 4.78 % (1.4–2.6), PA6 3.69 % (0.2–1.7), PA66-GF33 3.80 % (0.3–1.0); las amorfas caen
  dentro (ABS 0.58 en 0.4–0.8, PC 0.51 en 0.4–0.8, PS 0.32 en 0.3–0.7). La tarjeta lo enseña al lado («contracción publicada
  X–Y % · el Tait da Z % (FUERA del rango…)»). Es del modelo, no de los datos.
- `ABS_TAIT` (shrinkage.ts) trae b3s 2.16e8 y b4s 4.14e-3; la tabla imprime 1.70e8 y 4.21e-3. No mueve números hoy (la B del
  sólido solo entra con presión en estado sólido y el ABS empaca fundido), pero no es literal.
- `gateFreezeCylS` (Tabla 7.4, ln(0.692·…)) da NEGATIVO en PA66-GF33 (−0.27 s): con no-flujo 254 °C cerca del fundido 288 °C el
  argumento del log cae bajo 1. Es de gating.ts.
- El paso 3 (lente de enfriamiento), la E5 (FAN), el agua y los botadores de la pieza soltada siguen calculando con ABS
  (`ABS_KAZMER`, `ABS_CROSS`, `ABS_EJECT` en estudio-molde-datos.ts, foco-lentes.ts, fan.ts, useMoldStudio E5-E7): con otra resina,
  el molde y el dictamen ya usan su ficha y esas estaciones todavía no. `PP_CROSS.tauStarPa` (filling.ts) = 5.30e3 es el k de la
  power-law; la tabla dice τ* 3.90e3.
- `INJECTION_MACHINES` (IM-50…IM-500, machinesizing.ts): «cifras representativas» sin fuente. Sin ficha, si la pieza no cabe en
  la FCS, el motor sigue proponiendo una de ellas. Con ficha ya no entran.
- `designFeedSystem` usa orificio de boquilla 4.5 mm por defecto (sin cita) cuando la máquina no lo declara (la FCS no lo declara).
- `estudio-molde-datos.ts:4461` divide entre `maq.ejectionForceKN`: con una inyectora de la ficha SIN expulsión capturada sale NaN %.
- El dictamen (panel de H) enseña la resina sin ficha como «⏳ no se pudo revisar … · MIDIENDO»: el reloj de arena y la etiqueta
  sugieren espera; es un NO definitivo («no se calcula»).
- `useMoldStudio.ts:1246` (E5, región de H): `FEED_MATERIALS[material] ? material : 'ABS'` — con las 16 ya no cae a ABS; con una
  resina sin ficha la E2 se detiene antes.

**Archivos tocados (para la fusión).**
- `src/forja/mold/materials.ts` — `FichaResina`, `RESINAS_KAZMER` (16, Apéndice A), `RESINA_POR_DEFECTO`, `fichaResina`,
  `fichaCompleta`, `ResinaSinFicha`, `fichaResinaOError` (al final del archivo).
- `src/forja/mold/feed.ts` — `FeedMaterial`, las 14 resinas nuevas en `FEED_MATERIALS` (ABS y PP intactos), `feedMaterial`,
  `designSprueFeed`/`designFeedSystem` estrictos, `sprueDesignFromCavity` sin `'PP'`.
- `src/forja/mold/feed-layouts.ts` — `feedPL` y sus 6 llamadas; `layoutForGrid` lee la resina.
- `src/forja/mold/colada.ts` — la resina de la pieza en `datumsColada` (3 sitios).
- `src/forja/mold/lamina-compuerta.ts` — `material` sin `'PP'`, `fichaResina` (2 sitios).
- `src/forja/mold/machinesizing.ts` — `nozzleRadiusMm`/`dePlanta` en `InjectionMachine`; la FICHA DE TU PLANTA (tipos,
  `FICHA_PLANTA_VACIA`, `plantaConDatos`, `leeFichaDeLaPlanta`, `maquinaDeLaPlanta`, `inyectoraDelTaller`); `MachineSelection.planta`;
  `juzgarMaquina` (sin dato + conectores); `selectInjectionMachine(…, planta)`; `seleccionEnLaPlanta` (al final).
- `src/forja/mold/moldmachine.ts` — imports; `MachineSpec.plastic` (doc) y `.planta`; `MotorDeLaResina`/`motorDeLaResina`,
  `TARIFA_LIBRO_USDH`, `factorDeMaquinado` (donde vivían PLASTIC_*); `moldMachine` (resina, tarifa, `estimatePartCost` con
  `resina`, bandera de máquina); `physicalDesign` (firma con `R`, colada, Tait, gate, calor, expulsión, máquina de la planta +
  boquilla); `buildCostInputs` (50 $/h con nombre). NO toqué el dictamen (~L380-460 de la base = región de H).
- `src/forja/mold/moldcost-detailed.ts` — `PartCostInputs.resina` + 1 línea (ENMIENDA).
- `src/forja/mold/expediente.ts` — imports; `CostoDeReferencia`, `costoDeReferencia`, `costoReferenciaLinea`,
  `costoReferenciaHTML`, `horasEnPesos`; las opciones de «arquitectura» con MXN. El bloque del dictamen (H) intacto.
- `src/forja/brep/useMoldStudio.ts` — imports; `mold-build` sin nombre (×2); material de `cursoPart`; la planta en el intake
  (`planta`, `setPlanta`, `resina`, localStorage); EL PUENTE (material, `ocultarEnTelemetria`, spec con planta); el bag (+3).
- `src/forja/brep/MoldPanels.tsx` — imports; `leccion.completa` sin nombre; el select de resina del intake; `TarjetaPlanta` (al final).
- `src/forja/brep/ForgeBRepStudio.tsx` — (ENMIENDA) 2 imports; `specPieza`; el costo del expediente (cálculo, tarjeta, pie, sección
  3 de `expedienteHTML`); 1 línea `<TarjetaPlanta>` en el paso 2.
- `src/forja/telemetry-forja.ts` — `ocultarEnTelemetria`. `src/lib/telemetry.ts` — `ocultar`, `limpia`, captura del drop/change.
- `ordenes/2026-10-29-g-los-datos-de-tu-planta.md` — BASE, TOCA, ENMIENDA, CIERRE.
