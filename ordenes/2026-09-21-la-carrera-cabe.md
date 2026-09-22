# ORDEN: LA CARRERA CABE — la pila del molde se dimensiona por LA PIEZA (caja expulsora, sujeciones, soporte) y la apertura saca la pieza CON su bebedero

ESTADO: en-curso
PRIORIDAD: 1
AGENTE: Opus · worktree propio · iangpu forja-dev3 :5199

BASE: eca3df0

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

## TOCA
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

## CIERRE (se llena al terminar)
