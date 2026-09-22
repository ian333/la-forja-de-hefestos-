# ORDEN: EL AGUA DICE DOS COSAS — la lámina de la placa y el 3D del molde no dibujan el mismo circuito

ESTADO: en-curso
PRIORIDAD: 1
AGENTE: Opus · worktree propio · iangpu forja-dev4 :5195

BASE: eca3df0

OBJETIVO: hallazgo de EL AGUA DE TU PIEZA (2026-09-17, medido en node sobre la carcasa 1594C con pared 3.2):
el MISMO molde tiene DOS circuitos de agua distintos según quién lo dibuje. La lámina de la placa
(`coolingCircuitDesign` en mold-drawing-set.ts) dice **⌀9.53 · H 32 · W 64 · 5 líneas por lado · JP-352**;
el 3D del estudio (`estacion8Dado` → `estacion8Circuito`) dice **⌀4.76 · H 19 · W 38.1 · 3 líneas por lado ·
JP-250**. Los dos llaman al MISMO motor (`coolingDesign`) con entradas distintas: la lámina FUERZA el
diámetro del porta-molde (`forceDiaMm: s.cooling.diaMm`) y parte la línea en 2 tramos en serie por lado;
el 3D deja que el caudal elija el diámetro y usa la línea entera. Un cliente que compare su plano con la
vista 3D ve dos moldes. Al final de esta orden hay UNA sola fuente y las dos vistas dicen lo mismo.

## YA-EXISTE (prueba de ausencia)
- `coolingDesign` (cooling-design.ts) resuelve la cadena §9.2 completa y acepta `forceDiaMm` /
  `forceLinesPerSide` / `linesInSeries` / `sides`: el motor NO es el problema.
- `estacion8Circuito` ya entrega el circuito como GEOMETRÍA (segmentos, tapones, sellos, in/out, juez de
  claros) y desde 2026-09-17 sale de la pieza soltada, no del cubo.
- `coolingCircuit` (mold-drawing-set.ts) dibuja su propio serpentín para la lámina desde `MoldAssemblySpec`.
- NO existe: una función única que ambas vistas consuman; ni un gate que compare lámina vs 3D.

## POR QUÉ NO SE HIZO EN «EL AGUA DE TU PIEZA»
Unificar mueve al CUBO: si el 3D adopta el ⌀ del porta-molde (9.53) el ciclo del dado cambia de números y
`ciclo-dado-test` deja de dar 266/266. Esa decisión —cuál de los dos manda— se toma con ian, no de
contrabando dentro de otra orden.

## LA PREGUNTA QUE DECIDE (para ian)
¿Manda el **porta-molde** (el barreno ⌀9.53 que la placa comprada YA trae, y entonces el 3D se corrige) o
manda el **caudal** (el ⌀ que la térmica pide, y entonces la lámina y la spec del porta-molde se corrigen)?
El libro (§9.2.5) elige D por el caudal y DESPUÉS verifica que quepa; eso apunta al caudal, pero el acero
comprado es un hecho.


## LA RESPUESTA (ian 2026-09-21: «reparte el trabajo», sobre mi recomendación) y LO QUE EL PLAN DE INSPECCIÓN MIDIÓ
- **Manda el caudal con piso maquinable** (§9.2.5 elige D por el caudal y DESPUÉS verifica que quepa; el piso 6.35 «maquinable»
  que la lámina ya declara es el hecho del taller): D = max(⌀ del caudal, 6.35) → tapón del catálogo (JP-251/352/553…). La
  lámina y el 3D consumen EL MISMO circuito. El cubo cambia → **ACTA R93 pendiente de firma de ian** (literales de
  ciclo-dado-test actualizados y listados en el CIERRE). Si ian dice que no, se revierte antes de fusionar.
- Plan de inspección 2026-09-21 (4 piezas, public/evidencia/2026-09-21-el-plan-de-inspeccion/resultados.json):
  · **2.1 falla 4/4 con la MISMA constante:** el agua B queda −1.14 mm bajo la cara inferior de la placa B (una regla mal
    puesta, no una coincidencia): 6 mm bajo el bolsillo contra 9.52 que pide ⌀4.76 con ½⌀ por lado.
  · **2.5 falla 4/4:** las líneas B entran 0.40 mm al soporte; los tapones 1.14 mm; en 1599HBK dos RETORNOS ⌀12 cruzan agua B.
  · **2.2 dio ✓ FALSO:** medía contra la cara superior de A; el agua A entra 1.56–2.15 mm en el INSERTO de cavidad
    (cavidad↔agua-A-norte/sur/este/oeste/ext) — nadie lo miraba.
  · **2.3:** un pin cruza una línea B en 1599HBK (0 mm) y dos en 1557BGY; el juez del agua no lo detiene.
  · 3D ⌀4.76 vs lámina ⌀6.35 (tapa, 1557BGY) / 9.53 (carcasa) / 15.9 (1599HBK); «3 líneas/lado» vs 13; t_c 31.6 vs 48.4 s;
    las hojas de A y de B llevan el MISMO serpentín (revisores Opus, 4 de 4).
- El juez del agua debe medir contra: las CARAS de su placa (½D de acero mínimo), el asiento del inserto (si la línea cae
  dentro del inserto, o se mueve o se declara «cruza el inserto» para que LOS INSERTOS SE BARRENAN la corte — NO se deja
  en silencio), los barrenos móviles (pines, retornos, KO) y la tornillería. Con LISTA completa de pares, no el mínimo.

## EJERCICIOS
- [ ] una sola función del circuito (⌀, H, W, líneas por lado, tapones, serie/paralelo) que consuman `estacion8Dado` (3D) y
      `coolingCircuit`/`coolingCircuitDesign` (láminas); las dos vistas dan los mismos números en las 4 piezas.
- [ ] la profundidad H contra las CARAS de la placa: acero ≥ ½D bajo/sobre la línea (cita §9.2.7); cero −1.14.
- [ ] el juez del agua: caras · inserto · pines · retornos · KO · tornillos, lista completa; rojo detiene o mueve la línea.
- [ ] el cubo: ACTA R93; ciclo-dado-test verde.
- [ ] las 4 piezas: 2.1, 2.2 (contra el inserto), 2.3, 2.5 ✓ y `laminaAguaVs3D` del arnés idéntico; capturas.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/cooling-design.ts
- src/forja/mold/coolinglines.ts
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/mold-plano-set.ts
- src/forja/brep/useMoldStudio.ts
- scripts/ciclo-dado-test.cjs

## CREA
- public/evidencia/2026-09-10-el-agua-dice-dos-cosas/resultados.json
- public/evidencia/2026-09-10-el-agua-dice-dos-cosas/el-agua-dice-una-cosa.png

## BORRA
- (nada)

## PREEXISTENTE
- (nada — worktree limpio)

## EVIDENCIA (se declara ANTES de trabajar)
- 4/4 piezas: 2.1, 2.2, 2.3, 2.5 ✓ con números antes → después; lámina y 3D con el mismo ⌀/H/W/n; capturas por pieza.
- tsc: cero errores nuevos contra la base de 66 · ciclo-dado-test verde (con acta R93) · orden-gate VERDE · sin deploy.

## CIERRE (se llena al terminar)
