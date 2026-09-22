# ORDEN: LA CARRERA CABE — la pila del molde se dimensiona por LA PIEZA (caja expulsora, sujeciones, soporte) y la apertura saca la pieza CON su bebedero

ESTADO: listo-para-fusion
PRIORIDAD: 1
AGENTE: Opus · worktree propio · iangpu forja-dev3 :5199

BASE: ae41a29

OBJETIVO: que el molde de TU pieza pueda ABRIRSE y EXPULSARLA. Hoy `packageToAssemblySpec` (mold-plano-set.ts ~1614) clava
`bottomClamp: 36, ejectorHousing: 66, topClamp: 36` para cualquier pieza, y la apertura del 3D es `2.5 · H` sin contar el
bebedero. Al final de esta orden la pila sale de la pieza con su cita del libro, hay UNA función de carrera de apertura que
consumen el 3D, el selector de máquina y las láminas, y las 4 piezas del plan de inspección pasan 3.1 y 3.2.

## LO QUE SE MIDIÓ (el plan de inspección 2026-09-21, 4 piezas — public/evidencia/2026-09-21-el-plan-de-inspeccion/resultados.json)
- **3.2 falla 3/4:** libre = EH − 4 − 0.28·EH − 0.20·EH = **31 mm** contra pedida H + 8 = 41.3 (carcasa) · 43.5 (1599HBK) ·
  39.2 (1557BGY); la tapa (22.1) cabe. La retenedora entra 8–12 mm en el soporte en cada ciclo (video 35).
- **3.1 falla 4/4:** apertura 2.5·H = 83.3 / 35.2 / 88.8 / 78 mm contra pieza + bebedero + 10 = 112.5 / 82.5 / 132.5 / 102.5.
  El bebedero (sprue cónico de la partición a la cara de la sujeción) mide 58–87 mm y la regla 2.5·H (§6.3.2) no lo cuenta.
  La lámina de análisis dice «abierto 401 de 1010 ✓»: la MÁQUINA da de sobra; el fallo es de la REGLA del 3D.
- Soporte de **22 mm también en la base 396×296** (revisor Opus de 1599HBK): flecha ∝ P·L⁴/t³ → ×6.7 respecto a 246. Verificar
  qué hace `sizeSupportPlate` (platesizing.ts:100) y por qué sale 22 en ambas.
- El CUBO firmado (acta R92) tiene el mismo defecto: H 40 → carrera 48 > 31.

## DECISIÓN (ian 2026-09-21: «reparte el trabajo», sobre mi recomendación de UNA verdad)
La regla aplica a TODA la pila, cubo incluido. Los literales de `scripts/ciclo-dado-test.cjs` que cambien se actualizan y se
documentan en el CIERRE como **ACTA R93 — pendiente de firma de ian** (lista: check, número viejo, número nuevo, por qué).
Si ian dice que no, se revierte esa parte antes de fusionar. Nada de esto se despliega desde esta orden.

## YA-EXISTE (prueba de ausencia)
- `plateStackZ` y `plateDefs` (retH = max(12, 0.20·EH), ejH = max(15, 0.28·EH)); `COMMERCIAL_PLATE_THK` + `snapToCommercialPlate`
  (platesizing.ts:26-33); `sizeSupportPlate` (platesizing.ts:100).
- La apertura vive en TRES lugares: `openMm={moldOpenStrokeMm || 2.5 * alturaMm}` (ForgeBRepStudio.tsx:7137), `moldOpenStrokeMm`
  (useMoldStudio.ts:322) y el selector de máquina `daylightNeededMm(stackMm, openStrokeMm)` (machinesizing.ts:181). La expulsión:
  `ejectMm = alturaMm + 8` (ForgeBRepStudio.tsx:7138) y H + 8 en estacion10Dado.
- La estación 8 ya calcula `carreraLibreMm`/`carreraPedidaMm` y la tira avisa «la carrera no cabe» (useMoldStudio.ts
  cicloPortamoldesPieza); el camino tiene el check «la carrera cabe» en ROJO a propósito.
- NO existe: una regla que dimensione EH por la carrera; una función única de apertura; la cita del libro para el margen.

## EJERCICIOS
- [ ] la caja expulsora por la carrera: EH ≥ (carrera + descanso + holgura) / (1 − 0.28 − 0.20) → serie comercial. Cita Kazmer
      (cap 11 carrera de expulsión; Fig 1.6) para el descanso/holgura; NO inventar números: si el libro no da uno, declararlo.
- [ ] `carreraDeApertura(...)` = altura de pieza + bebedero + margen (cita §6.3.2 / daylight cap 4) en estudio-molde-datos.ts, y
      que la consuman el 3D (openMm, moldOpenStrokeMm), machinesizing y las láminas. UNA verdad.
- [ ] sujeciones (36) y soporte: si `sizeSupportPlate` ya dimensiona y algo lo pisa con 22, arreglar la fuente; si son literales,
      dimensionar por la base con cita.
- [ ] el cubo: ACTA R93 en el CIERRE; `ciclo-dado-test` verde con los literales nuevos.
- [ ] las 4 piezas: 3.1 ✓ (`__forgeBrep.animZ('clamp')` con `inspeccion.estado(1,0)` ≥ pieza + bebedero + margen) y 3.2 ✓
      (`data-carrera-libre ≥ data-carrera-pedida`) — captura de cada una abierta+expulsada con la retenedora SIN tocar el soporte.
- [ ] camino de la carcasa: «la carrera cabe» en verde; runner 8/8 salvo relojes (anota la carga del host si falla un reloj).

## ENMIENDA 2026-09-21 (el agente, ANTES de tocar: cuatro archivos más y UN cambio de casa)

1. **`carreraDeApertura` NO puede vivir en `estudio-molde-datos.ts`.** La orden la pedía ahí, pero ese archivo
   `import { moldMachine } from './moldmachine'` (línea 35) y `moldmachine` importa `machinesizing` (línea 32):
   si `machinesizing` importara `estudio-molde-datos` el ciclo se cierra, y ese ciclo YA nos explotó una vez
   («Cannot access 'kn' before initialization», TDZ, documentado en mold-drawing-set.ts:100). Se va a
   **`src/forja/mold/threeplate.ts`**, que es donde ya viven `OPEN_FACTOR`, `moldOpeningStrokeMm` («FUENTE
   ÚNICA», su propio comentario) y `daylightNeededMm`, y de donde ya importan lamina-apertura, machinesizing,
   moldbase y useMoldStudio. Cero aristas de import nuevas. **ENTRA al TOCA: `src/forja/mold/threeplate.ts`.**
2. **`src/forja/mold/mold-drawing-set.ts`** — `plateDefs` (línea 63) teclea otra vez `max(12, 0.20·EH)` y
   `max(15, 0.28·EH)`. Si la caja expulsora ahora se DIMENSIONA por esas fracciones y las fracciones viven en
   tres copias, una de las tres miente el día que cambie. Entra para que las lea de `platesizing`.
3. **`src/forja/mold/moldmachine.ts`** — línea 379 `moldOpeningStrokeMm(spec.Hmm)` es el ÚNICO lugar que le
   pasa la carrera al selector de máquina (y de ahí a la lámina de análisis y al semáforo `daylight` del
   estudio). Sin tocarlo, «que lo consuma machinesizing» no ocurre.
4. **`src/forja/mold/lamina-apertura.ts`** — la lámina L5 ya calculaba su propia `max(geométrica, §6.3.2)`
   (línea 807). Entra para que use la función única en vez de su copia.

## TOCA
(los cuatro primeros entran por la ENMIENDA de arriba: threeplate = casa de `carreraDeApertura`;
mold-drawing-set = `plateDefs`; moldmachine = `openStrokeMm`; lamina-apertura = la lámina L5)
- src/forja/mold/threeplate.ts
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/moldmachine.ts
- src/forja/mold/lamina-apertura.ts
- src/forja/mold/mold-plano-set.ts
- src/forja/mold/platesizing.ts
- src/forja/mold/machinesizing.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/ciclo-dado-test.cjs
- caminos/la-carcasa-de-mitsubishi.md

## CREA
- public/evidencia/2026-09-21-la-carrera-cabe/resultados.json
- public/evidencia/2026-09-21-la-carrera-cabe/la-carrera-cabe.png

## BORRA
- (nada)

## PREEXISTENTE
- (nada — worktree limpio)

## EVIDENCIA (se declara ANTES de trabajar)
- 4/4 piezas: 3.1 ✓ y 3.2 ✓ con sus números (antes → después) en resultados.json; una captura por pieza abierta + expulsada.
- tsc: cero errores nuevos contra la base de 66 · ciclo-dado-test verde (con acta R93) · orden-gate VERDE · sin deploy.

## CIERRE (2026-09-21 · MEDIDO, no contado)

### ORDEN VS ENTREGADO
| ejercicio de la orden | estado |
|---|---|
| la caja expulsora por la carrera → serie comercial, con cita | HECHO · `sizeEjectorHousing` (platesizing.ts) · §4.3.2 + Fig 4.22 LITERAL |
| `carreraDeApertura(...)` ÚNICA, consumida por el 3D, machinesizing y las láminas | HECHO · vive en `threeplate.ts`, no en estudio-molde-datos (ENMIENDA 1: ahí cerraba un ciclo de imports) |
| sujeciones (36) y soporte (22): arreglar la fuente o citar | MEDIDO · el soporte NO estaba roto; las sujeciones quedan en 36 CON cita (§12.1.1) |
| el cubo: ACTA R93 + `ciclo-dado-test` verde | HECHO · **266/266**, UN solo literal movido |
| las 4 piezas: 3.1 ✓ y 3.2 ✓ con captura | HECHO · **4/4 y 4/4**, medido en la APP |
| camino de la carcasa: «la carrera cabe» en verde | HECHO · `p6-12` **la carrera cabe: 46 mm libres para 41.3 pedidos** ✓ en las DOS corridas que llegaron al paso 6 (la primera abortó antes, por hilo bloqueado); el paso 6 queda 15/16 y su único rojo es el reloj `p6-5` (carga) |

### LAS DOS CITAS QUE MANDAN (literales del libro, no paráfrasis)
1. **§4.3.2 · Fig 4.22** — *"The travel of the ejector plate should be selected to eject the part from the mold.
   Often, the ejector travel is set to be equal to the depth of the molded part. **From the ejector travel, the
   height of the ejector housing, dimension 'C', is assigned** by the mold base supplier."*
   → manda LA CARRERA y la caja se le asigna. El código lo tenía al revés: `C = 66` clavado y la carrera salía de
   restarle las placas (`libre = 66 − 4 − 0.28·66 − 0.20·66 = 31 mm`, IGUAL para cualquier pieza).
2. **§6.3.2** — *"The free length of the stripper bolt must be sufficient to allow for the **ejection of the molded
   parts**. A typical mold open distance between the A and B plates is equal to two to three times the height of the
   molded parts"* **Y** *"the length of the X plate stripper bolt must be sufficient to allow for the **removal of the
   feed system**"* (§1.4.1 lo repite: *"a large mold opening stroke is needed to eject the cold runner"*).
   Son DOS términos del MISMO movimiento y el código solo contaba el primero →
   `carreraDeApertura = factor·H + colada`. **Con colada 0 se reduce EXACTAMENTE a la regla vieja**: donde no hay
   bebedero que sacar, nada cambia.

**Lo que NO tiene cita y queda DECLARADO NUESTRO** (el libro no da número — se dice, no se disfraza):
`EJECCION_MARGEN_MM = 8` (la carrera pedida es H + 8; §4.3.2 dice E = profundidad de la pieza, el +8 es para que
LIBRE el macho) · `EJECTOR_REST_MM = 4` (descanso donde van los stop pins, Fig 11.1) · `EJECTOR_CLEARANCE_MM = 2`
(acero entre retenedora y soporte al final de la carrera) · `EJECTOR_PLATE_FRAC 0.28` / `EJECTOR_RETAINER_FRAC 0.20`
(proporción de catálogo heredada del set de planos; §4.3.2 dice que la partición interna la asigna el proveedor).

### LAS 4 PIEZAS · ANTES → DESPUÉS (app real, iangpu forja-dev3 :5199 · `public/evidencia/2026-09-21-la-carrera-cabe/`)
Medido así: la apertura del 3D con `inspeccion.estado(1,0)` + `animZ('clamp')`; la expulsión con `estado(1,1)` +
`animZ('ejector-ret')`; el 3.2 con `data-carrera-libre` / `data-carrera-pedida` de la tira.

| pieza | H + bebedero | caja expulsora | **3.1** apertura (pide) | **3.2** libre (pide) | retenedora dentro del soporte | stack |
|---|---|---|---|---|---|---|
| 1594C Box (carcasa) | 33.3 + 69.2 | 66 → **96** | 83.3 → **152.5** (112.5) ✗→✓ | 31 → **46** (41.3) ✗→✓ | 10.3 → **0** mm | 262 → 292 |
| 1594C Lid (tapa) | 14.1 + 58.4 | 66 → **66** | 35.2 → **93.7** (82.5) ✗→✓ | 31 → **31** (22.1) ✓→✓ | 0 → **0** mm | 218 → 218 |
| 1599HBK (alta) | 35.5 + 87.0 | 66 → **96** | 88.8 → **175.8** (132.5) ✗→✓ | 31 → **46** (43.5) ✗→✓ | 12.5 → **0** mm | 302 → 332 |
| 1557BGY (ensamble) | 31.2 + 61.3 | 66 → **96** | 78.0 → **139.3** (102.5) ✗→✓ | 31 → **46** (39.2) ✗→✓ | 8.2 → **0** mm | 238 → 268 |

**3.1: 0/4 → 4/4. 3.2: 1/4 → 4/4.** La tapa es la prueba de que la regla no es un empujón global: su caja NO cambia
(ya cabía) y solo se corrige su apertura, que es donde SÍ estaba rota.

### EL SOPORTE NO ESTABA ROTO (la sospecha del revisor de 1599HBK, medida)
El revisor dedujo «22 mm también en 396×296 → flecha ×6.7». Medido con `optimizeSupportPlate` (los 5 candidatos de
cada base): el 22 es la respuesta del optimizador **con 4 pilares**, y en las DOS bases la deflexión queda bajo el
venteo — 246×246 → **0.0176 mm** y 396×296 → **0.0191 mm** contra 0.020 de venteo (`flashOk = true`). El ×6.7 sale de
comparar los LADOS de la base ignorando los pilares: el claro efectivo no es 246 ni 396 sino `0.6·min(w,l)/(n+1)` =
**29.6 y 35.6 mm**. `sizeSupportPlate` sí dimensiona; nada lo pisa. **Pero vale anotarlo:** con 4 pilares la 396×296
queda al **96 % del venteo** (0.0191/0.020) — cero margen. Eso es política de márgenes, no un bug, y no es de esta orden.
Las SUJECIONES quedan en 36 y ahora con su razón: §12.1.1 — *"the cavity inserts are directly supported by the top
clamp plate and the stationary platen… generally in a state of pure compression so very little out of plane bending
occurs"*. Sin criterio de deflexión no hay nada que despejar: es talla de catálogo, y queda DECLARADA (`CLAMP_PLATE_MM`).

### UNA VERDAD (lo que dejó de estar tecleado dos veces)
- La APERTURA vivía en 4 sitios (3D `openMm`, `useMoldStudio.moldOpenStrokeMm`, `moldmachine` → daylight, lámina L5).
  Ahora los 4 llaman a `carreraDeApertura`.
- La fracción del paquete expulsor estaba TECLEADA EN SEIS: `plateDefs`, `plateStackZ`, el contrataladro de cabezas de
  `buildPlateSolid`, `cicloPortamoldesPieza` y DOS veces en `estudio-molde-datos` (ahí además mal nombrada `retH`
  cuando es la EXPULSORA). Ahora todas leen `ejectorPlateMm` / `ejectorRetainerMm` / `EJECTOR_REST_MM`.
- La estación 8 MIDE con `carreraLibreEnCaja` y `carreraDeExpulsionMm`, o sea con las MISMAS funciones que
  dimensionaron la caja. Antes medía con su propia copia: un gate que se aprueba solo.

### ACTA R93 — pendiente de firma de ian
UN literal del cubo cambió. La pila del cubo se mueve (caja 66 → **106**, porque su carrera es H+8 = 48 mm) y con ella
la partición: **146 → 186 mm**. Todas las cotas del test que se comparan «declarado vs medido» siguieron solas (salen
del código); la única CLAVADA en coordenadas absolutas era ésta:

| check | valor viejo | valor nuevo | por qué |
|---|---|---|---|
| `CONICIDAD` y `CONTROL: la ocupación BINARIA…` — alturas de sondeo del cono del bebedero (`scripts/ciclo-dado-test.cjs`) | `[200, 215, 230]` mm absolutos | `dC.zGateMm + [14.5, 29.5, 44.5]` | eran absolutas y solo servían con la caja clavada en 66; al subir la pila 40 mm caían DENTRO de la pieza (medían 27.23 → 26.52 → 4.14 en vez del cono). Ahora cuelgan del datum que les toca, a las MISMAS distancias |

**Prueba de que no es re-calibrar para aprobar:** con la sonda relativa el check imprime EXACTAMENTE los números de
antes del cambio — fraccional `3.80 → 3.26 → 3.00` (Δmin 0.26) y binaria `4.00 → 3.26 → 3.26` (Δmin 0.00), idénticos
a la corrida base. Se movió la regla de medir, no el resultado.
Si ian dice que no a re-firmar el cubo: revertir `packageToAssemblySpec.plates.ejectorHousing` a 66 deja el cubo como
estaba y las 3 piezas rotas otra vez.

### EVIDENCIA
- `public/evidencia/2026-09-21-la-carrera-cabe/resultados.json` — antes (plan de inspección, mismo base ae41a29) vs
  después (app real), pieza por pieza, con las reglas y sus citas.
- `public/evidencia/2026-09-21-la-carrera-cabe/la-carrera-cabe.png` — las 4 piezas ABIERTAS + EXPULSADAS en corte por
  el eje, cada una rotulada con sus números. Se ve el bebedero FUERA del bushing y el paquete expulsor arriba sin
  tocar el soporte.
- tsc en iangpu: **66 errores, cero nuevos** contra `/home/ian/la-entrada/tsc-head.txt`.
- `ciclo-dado-test`: **266/266** (corrida DESPUÉS del último cambio).

### PREGUNTAS ABIERTAS PARA IAN
1. **ACTA R93**: ¿se re-firma el cubo con la pila nueva (partición 146 → 186)?
2. **`EJECTOR_CLEARANCE_MM = 2`**: con 1 mm la tapa bajaría de caja 66 → 56 y el ensamble 96 → 86 (menos acero,
   §12.1.3 *"minimize the size of the mold"*). Dejé 2 para que NINGUNA pieza que ya pasaba cambiara de caja. ¿Bajamos?
3. **El soporte al 96 % del venteo** en la base 396×296 (0.0191 contra 0.020 mm): el optimizador elige por acero mínimo
   y no guarda margen. ¿Queremos un factor sobre el venteo?
4. **El stack del selector de máquina** sigue siendo el ESTIMADO `A+B+soporte+200` de `physicalDesign`. Con la caja
   variable ese 200 deja de ser un techo garantizado para piezas muy hondas (hoy la geometría real da ≤178 y sigue
   conservador). El semáforo `daylight` ya IMPRIME la diferencia; unificarlo es otra orden.

### VISTO, ES DE OTRA ORDEN (no lo toqué)
- Las etiquetas rojas de cotas en la tarjeta de la tapa (`draft 0 ≠ 7.498`, `pared 3.86 ≠ 4.475`, `hueco`, `macho
  155.74 ≠ 156.8`) son de otros subsistemas, no de la carrera.
- `moldOpeningStrokeMm` sigue existiendo (es el primer sumando de `carreraDeApertura`) y la usa `threePlateLayout`.

### ARCHIVOS TOCADOS (para la fusión)
`src/forja/mold/threeplate.ts` (ENMIENDA 1 · `carreraDeApertura`) · `src/forja/mold/platesizing.ts` (la caja, las
fracciones, `CLAMP_PLATE_MM`) · `src/forja/mold/mold-plano-set.ts` (`packageToAssemblySpec.plates`, `plateStackZ`,
`coladaSobrePiezaMm`, contrataladro) · `src/forja/mold/mold-drawing-set.ts` (ENMIENDA 2 · `plateDefs`) ·
`src/forja/mold/moldmachine.ts` (ENMIENDA 3 · `openStrokeMm`) · `src/forja/mold/lamina-apertura.ts` (ENMIENDA 4) ·
`src/forja/mold/machinesizing.ts` (contrato documentado) · `src/forja/mold/estudio-molde-datos.ts` (2 copias de la
fracción) · `src/forja/brep/useMoldStudio.ts` (apertura + estación 8) · `src/forja/brep/ForgeBRepStudio.tsx`
(`openMm`/`ejectMm`/cota) · `scripts/ciclo-dado-test.cjs` (ACTA R93) · `caminos/la-carcasa-de-mitsubishi.md` ·
`ordenes/2026-09-21-la-carrera-cabe.md` · `public/evidencia/2026-09-21-la-carrera-cabe/` (CREA).
NO toqué `public/temis.json` ni `temis-deploy.json`. Sin deploy, sin push, sin video.

