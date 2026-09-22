# ORDEN: EL AGUA DICE DOS COSAS — la lámina de la placa y el 3D del molde no dibujan el mismo circuito

ESTADO: hecho (ACTA R93 espera firma de ian)
PRIORIDAD: 1
AGENTE: Opus · worktree propio · iangpu forja-dev4 :5195

BASE: ae41a29   (el worktree se creó 33 commits atrás, en 860e073; se adelantó por fast-forward a main
      ANTES de tocar nada — la rama no tenía commits propios, así que no se perdió ni se fusionó nada)

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
- [x] una sola función del circuito (⌀, H, W, líneas por lado, tapones, serie/paralelo) que consuman `estacion8Dado` (3D) y
      `coolingCircuit`/`coolingCircuitDesign` (láminas); las dos vistas dan los mismos números en las 4 piezas.
- [x] la profundidad H contra las CARAS de la placa: acero ≥ ½D bajo/sobre la línea (cita §9.2.7); cero −1.14.
- [x] el juez del agua: caras · inserto · pines · retornos · KO · tornillos, lista completa; rojo detiene o mueve la línea.
- [x] el cubo: ACTA R93; ciclo-dado-test verde.
- [~] las 4 piezas: 2.1, 2.2 (contra el inserto), 2.5 ✓ y `laminaAguaVs3D` del arnés idéntico 4/4; **2.3 sigue ROJO**
      (los pines cruzan el agua en 3 de 4) — y ése es el entregable: el juez por fin los VE y los lista para la orden
      de los pines. El inspector de la APP no pudo correr (vite roto por cache compartido, ver CIERRE).

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/cooling-design.ts
- src/forja/mold/coolinglines.ts
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/mold-plano-set.ts
- src/forja/brep/useMoldStudio.ts
- scripts/ciclo-dado-test.cjs
- src/forja/mold/mold-assembly.ts

## ENMIENDA 2026-09-21 — entra `src/forja/mold/mold-assembly.ts` (ya agregado al TOCA de arriba)
POR QUÉ: `MoldAssemblySpec` vive ahí, y la fuente única necesita que el SPEC cargue dos datos del
disparo que hoy no viaja con él: `cooling.tcS` (el t_c que manda, §9.2.1 con la colada) y
`cooling.runnerVolCc` (Eq 9.10). Sin eso la lámina —que construye su spec con
`packageToAssemblySpec`, igual que el arnés— seguiría calculando su t_c con la pared sola
mientras el 3D usa el máximo: dos números, que es justo lo que esta orden viene a cerrar.
El cambio es SOLO la interfaz (dos campos opcionales) + el comentario que dice que `diaMm`
ya no es una entrada que compita con el motor, sino el ⌀ que el motor eligió.
NO se toca ninguna otra cosa de ese archivo.

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

## CIERRE (2026-09-21 · MEDIDO, no contado)

### ORDEN vs ENTREGADO
| pedido | entregado |
|---|---|
| una sola función del circuito que consuman el 3D y las láminas | `coolingCircuitDesign(s, D, o?)` es LA FUENTE ÚNICA. `estacion8Dado` dejó de llamar a `coolingDesign` por su cuenta; `coolingCircuit` dibuja con el ⌀ del motor (ya no con `s.cooling.diaMm`); la hoja de análisis dejó su `H = 4·D · W = 7·D` suelto y lee la fuente. **4/4 piezas: lámina ≡ 3D** (`laminaAguaVs3D` del arnés: idéntico) |
| H contra las CARAS de la placa · cero −1.14 | la ventana del lado B se calcula contra la cara INFERIOR de la placa B y la del lado A contra la cara SUPERIOR de A. **categoría `placa` del juez: 5/5 verde en las 4 piezas** |
| juez del agua: caras · inserto · pines · retornos · KO · tornillos, lista completa | 8 categorías, **1 019 pares** medidos en las 4 piezas, con la lista COMPLETA de los rojos (no el mínimo). Cada barreno se compara sólo contra el agua que comparte SU franja de z |
| el cubo: ACTA R93 | **266/266** (acta abajo) |
| las 4 piezas: 2.1/2.2/2.3/2.5 ✓ + capturas | 2.1 y 2.2 ✓ 4/4 · 2.5 ✓ salvo 4 retornos en 1599HBK · **2.3 (pines) sigue ROJO en 3 de 4 y ÉSE es el entregable**: el juez por fin los ve y los lista. El inspector de la app no pudo correr (abajo) |

### NÚMEROS · ANTES → DESPUÉS
**El mismo molde decía dos cosas. Ahora dice una:**

| pieza | ANTES lámina | ANTES 3D | DESPUÉS (las dos) |
|---|---|---|---|
| 1594C Box | ⌀9.53 · H 32 · W 64 · 3/lado · JP-352 · t_c 21.7 s | ⌀4.76 · H 19 · W 38.1 · 3/lado · JP-250 · t_c 75.7 s | **⌀6.35 · H 25.4 · W 50.8 · 4/lado · JP-251 · t_c 145.13 s** |
| 1594C Lid | ⌀6.35 · H 25.4 · W 50.8 · 3/lado | ⌀4.76 · H 19 · W 38.1 · 4/lado | **⌀6.35 · H 25.4 · W 50.8 · 3/lado** |
| 1599HBK | ⌀15.9 · H 32 · W 64 · 3/lado · JP-554 | ⌀4.76 · H 19 · W 38.1 · 7/lado | **⌀6.35 · H 25.4 · W 50.8 · 4/lado** |
| 1557BGY | ⌀6.35 · H 25.4 · W 50.8 · 3/lado | ⌀4.76 · H 19 · W 38.1 · 4/lado | **⌀6.35 · H 25.4 · W 50.8 · 3/lado** |

**El juez del agua (verde/total por categoría):**

| pieza | pares | placa | inserto | pin | retorno | KO | tornillo | colada | pieza |
|---|---|---|---|---|---|---|---|---|---|
| 1594C Box | 273 | 5/5 | 3/3 | **0/10** | — | — | — | 1/1 | 2/2 |
| 1594C Lid | 105 | 5/5 | 3/3 | — | — | — | — | 1/1 | 2/2 |
| 1599HBK | 501 | 5/5 | 3/3 | — | **0/4** | — | — | 1/1 | 2/2 |
| 1557BGY | 140 | 5/5 | 3/3 | **0/7** | — | — | — | 1/1 | 2/2 |

- **2.1 · agua B ↔ cara inferior de la placa B: −1.14 mm (4/4) → ≥ +3.17 mm (4/4)**. Dónde nacía el 6: `insertDims`
  hace el inserto de núcleo `placas.B − 6` de alto, o sea **6 mm de suelo** bajo su bolsillo, y ⌀4.76 pide
  2·(r+½⌀) = 9.52. El ruteo viejo se colgaba del PISO DEL BOLSILLO (`zB = pisoInsB − D`) y **nunca miraba la cara
  de la placa**: por eso la constante salía igual en las cuatro piezas. No era coincidencia, era una regla que faltaba.
- **2.2 · agua A ↔ el INSERTO de cavidad**: el ✓ era FALSO (medía la cara de la placa). Ahora el anillo A se acota
  también contra el techo del inserto Y la cara superior de A, y cuando cae dentro del inserto se DECLARA
  (`cruzaInserto.cavidad = true` en 4/4) para que LOS INSERTOS SE BARRENAN lo corte. Cero silencio.
- **2.3 · pines**: 10 rojos en 1594C Box (peor 0.16 mm), 7 en 1557BGY (peor −0.24 mm), 4 retornos en 1599HBK.
  Antes: invisibles. Las líneas B ya se CORREN en X buscando ½⌀ contra todo (rojo mueve la línea); donde el campo
  de expulsores tapiza la banda no hay hueco y ahí manda §9.3.5.2 (baffle/bubbler o mover los pines) → es de la
  orden de los pines, y se entrega con nombre, número y par.
- **agua ↔ pieza (kernel OCC)**: 0 invasiones en 4/4 (`interferencia.aguaVsPieza`).

### LO QUE SE DECIDIÓ Y POR QUÉ (con cita)
1. **Manda el caudal, con piso maquinable** (ian 2026-09-21). `PISO_MAQUINABLE_MM = 6.35` en `cooling-design.ts`,
   **declarado como regla NUESTRA, sin cita del libro** (razón: un ⌀4.76 a lo ancho de una placa de 246 mm es
   L/D 52 y no se taladra derecho). §9.2.5 elige D por el caudal y DESPUÉS verifica que quepa: el motor filtra la
   Tabla 9.2 al piso y toma el más chico que cumpla [D_min (Eq 9.17), D_max (Eq 9.15)]. `forceDiaMm` sigue
   existiendo para el oráculo del libro (`kazmer-enfriamiento-test`), pero el circuito real ya no lo usa.
   **Consecuencia honesta:** en estas 4 piezas la carga es tan chica que el caudal pediría MENOS que el piso ⇒ el
   flujo queda laminar (Re 871 en la carcasa) y el motor lo DICE en sus avisos; la E8 ya bombea por Re desde antes
   (extensión declarada). Si ian prefiere el ⌀ del caudal puro, se baja `PISO_MAQUINABLE_MM` y todo se recalcula.
2. **Un solo t_c: §9.2.1, el máximo sobre todas las secciones del disparo** («the cycle time can be dominated by
   the cooling of the cold runners»; Eq 9.10 ya suma el volumen de la colada). El spec lo transporta en
   `cooling.tcS` — por eso la lámina, que arma su spec con `packageToAssemblySpec` igual que el arnés, llega al
   mismo número sin acuerdos de palabra.
3. **La línea del lado B tiene DOS alojamientos posibles, en el orden del libro**: (1) dentro del inserto de núcleo
   (§4.2.1 Fig 4.13 dimensiona su respaldo PARA hospedarla) y (2) en la placa bajo el bolsillo — cada uno con su
   ventana de ½⌀ contra sus dos caras. Si no cabe en ninguno, la línea **cruza la costura inserto↔placa y se SELLA**
   (§9.3.2, O-ring), que es exactamente lo que este mismo circuito ya hacía con las extensiones del lado A. Un cruce
   de junta no es «poco acero»: es una junta, y se declara y se cuenta.
4. **El baffle se alimenta de una línea (§9.3.5.2)**: con n PAR ninguna línea pasa por el eje del macho y el bore
   quedaba colgado sin agua (apareció en cuanto el ⌀ subió y el cubo cayó de 3 líneas a 2). El trazo del lado B sube
   al siguiente IMPAR y lo dice en un recorte. Una línea de más nunca viola Eq 9.24: el paso sólo se cierra.

### ACTA R93 — literales del cubo (ciclo-dado-test 266/266) · **espera firma de ian**
La raíz de todo: el cubo pasa de **⌀4.76 (JP-250) · H 19 · W 38.1 · 3 líneas/lado** a **⌀6.35 (JP-251) · H 25.4 ·
W 50.8 · 2 líneas/lado de diseño (3 en el trazo, por el baffle)**. De ahí salen seis literales:

| # | check | viejo | nuevo | por qué |
|---|---|---|---|---|
| 1 | `E8 · RUTEO §9.2.7` | exigía `corrimiento > 0` (la línea del medio iba por el bebedero, Fig 9.9) | exige `ruteo.ok` **y** que el corrimiento dispare en el control de n IMPAR (`e8h`, H=1D ⇒ W 25.4 ⇒ n 3) | con n PAR ninguna línea se centra en el eje ⇒ la trampa NO existe. Exigirla era exigir que el defecto exista; el mecanismo se sigue probando donde sí aplica (0 mm → corrido 12.7 → 12.7 ≥ 10.49) |
| 2 | `E8b · CONEXIONES §9.1.6` | `sellos === 3` | `sellos === 6` | con ⌀6.35 la línea B no cabe entera ni en el inserto (16 mm) ni bajo su bolsillo: cruza la costura y cada una lleva su O-ring (§9.3.2). Los tapones siguen en 12 |
| 3 | `E8b · EL JUEZ` | `juez.ok` sobre **5 claros** | 8 categorías, **≥100 pares**, verde DURO en placa/inserto/colada/pieza y los rojos de pin/retorno LISTADOS | el juez viejo daba ✓ sin haber mirado las caras de las placas (de ahí el −1.14), ni pines, ni retornos, ni KO, ni tornillos. El nuevo mide 175 pares en el cubo y encuentra rojos REALES de pin: ése es el hallazgo que se le entrega a A-239, no un ✓ que no miró |
| 4 | `E8b · LOS RECORTES` | `recortes.length === 2` | `length >= 2` **y** todos citan `§` | cada causa habla por separado (techo del inserto A · costura del inserto B · línea impar para el baffle). El recorte del lado A no citaba § — ahora sí, con la cara de la placa incluida |
| 5 | `E8b · CONTROL NEGATIVO (escena E8a)` | brazo B: `claroBviejo < ½⌀` contra el BOLSILLO | brazo B: la regla vieja (`zB = pisoInsB − ⌀`) deja **−3.52 mm** de acero sobre la cara inferior de la placa B | con ⌀6.35 la escena vieja ya no reprueba contra el bolsillo, pero sí contra lo que esta orden arregló. Es EL −1.14 del plan de inspección, reproducido en el cubo |
| 6 | `E10 · CONTROL NEGATIVO` | pin forzado en el punto FIJO (60, 98) | pin forzado sobre la línea REAL del circuito (`B-linea0`, x 47.2) | un punto fijo mide suerte, no al juez: al moverse el ⌀ los carriles se mueven. Así el control no caduca |

Además, sin tocar su check: `E10 · A-239` mejoró solo (peor claro **2.43 → 8.03 mm**) porque con la línea central
de vuelta los pines vuelven a ceder el carril — que es lo que ese check siempre quiso decir.

### EVIDENCIA (rutas)
- `public/evidencia/2026-09-10-el-agua-dice-dos-cosas/resultados.json` — antes/después por pieza, `laminaAguaVs3D`
  del arnés, el juez completo con TODOS los rojos, recortes, y lo que queda abierto.
- `public/evidencia/2026-09-10-el-agua-dice-dos-cosas/el-agua-dice-una-cosa.png` — la tabla antes/después + la
  lámina de la Placa B de la carcasa con el circuito ya unificado (su rótulo: «serpentín §9.2 · ⌀6.35 JP-251 ·
  4 líneas/lado · H 25 (B) / 58 (A) · paso 51 · 146 W @ t_c 145.1 s · ⚠ 2 aviso(s)»).
- En iangpu: `/home/ian/el-plan-dev4/agua-ANTES.json`, `agua-DESPUES.json`, `verif-<pieza>/resultados.json` (arnés
  completo, 17 láminas + PDF por pieza), `/tmp/cubo-dev4.txt` (266/266), `/tmp/tsc-dev4b.txt` (66 errores).

### GATES
- `tsc` en iangpu: **66 errores = la base exacta, cero nuevos** (`comm -13` contra `/home/ian/la-entrada/tsc-head.txt`: vacío).
- `ciclo-dado-test`: **266 pasan · 0 fallan**.
- Arnés `verif-pieza.cjs` en las 4 piezas: 0 errores, 17 láminas cada una, **`laminaAguaVs3D` IDÉNTICO 4/4**.
- `orden-gate.cjs`: VERDE. Sin deploy, sin push, sin video.

### PREGUNTAS ABIERTAS PARA IAN
1. **Firma del ACTA R93**: el agua del cubo pasa de ⌀4.76 a ⌀6.35. Si prefieres que se quede en 4.76, se baja
   `PISO_MAQUINABLE_MM` y se revierte antes de fusionar (los 6 literales están listados arriba, uno por uno).
2. **El piso deja el flujo LAMINAR en las 4 piezas** (Re 871 en la carcasa): el caudal pide menos ⌀ del que el taller
   puede taladrar derecho. Hoy se bombea por turbulencia (extensión ya declarada en la E8) y el ΔT del agua sale
   regalado. ¿Se queda así, o para piezas chicas prefieres bajar el piso y aceptar barrenos más finos?
3. **Los pines siguen cruzando el agua** en 3 de 4 piezas. ¿Mover pines, o ir a baffles/bubblers (§9.3.5.2) donde el
   campo de expulsores tapiza la banda? El juez ya entrega la lista completa para decidirlo con números.

### VISTO, ES DE OTRA ORDEN (no se tocó)
- **Los pines sobre el agua** → orden de los pines / A-239. Se entrega la lista completa de pares con su claro.
- **Dos bebederos**: `feed.ts` (designFeedSystem) y `colada.ts` (datumsColada) declaran coladas distintas (carcasa:
  t_c 145.13 s vs 75.7 s). El circuito usa el del feed (el que viaja en el spec) y la E8 lo REPORTA en su fila `t_c`
  y en un anuncio nuevo a la E5. No se promedia, se dice.
- **El espesor de las placas** lo sigue eligiendo `coolinglines.designCoolingLines` desde `moldmachine.ts` (§4.2.1:
  t = prof + 3·⌀). No es el circuito, es el dimensionado del acero, y da un ⌀ igual o MAYOR que el del circuito en
  las 4 piezas (9.53 / 4.76 / 15.9 / 6.35 contra 6.35): placas sobradas, nunca cortas. Por eso `coolinglines.ts` no
  se tocó aunque estaba en el TOCA. Unificar también eso mueve TODAS las placas de TODOS los moldes: no cabe aquí.
- **El inspector de la APP no pudo correr**: revienta con `R3F: Hooks can only be used within the Canvas component!`
  desde `node_modules/.vite/deps`. `node_modules` de `forja-dev2..7` es un SYMLINK al del repo principal ⇒ las seis
  copias de vite comparten UN cache de prebundle y se lo pisan (dos copias del store de R3F). **No se limpió a
  propósito: hay otros 4 agentes corriendo sobre ese mismo cache.** No lo causa esta orden (cero archivos React/JSX
  en el commit). Lo que el inspector mide en 2.1/2.2/2.5 está medido aquí por el juez del agua, con número.

### ARCHIVOS TOCADOS (para la fusión)
- `src/forja/mold/cooling-design.ts` — `PISO_MAQUINABLE_MM` + `pisoDiaMm` (Tabla 9.2 recortada al piso).
- `src/forja/mold/mold-drawing-set.ts` — `coolingCircuitDesign` = la fuente única; `coolingCircuit` y la hoja de
  análisis leen de ella.
- `src/forja/mold/mold-plano-set.ts` — `packageToAssemblySpec` escribe en el spec el ⌀/plug que el motor eligió +
  `cooling.tcS` / `cooling.runnerVolCc`.
- `src/forja/mold/mold-assembly.ts` — **ENMIENDA**: dos campos opcionales en `MoldAssemblySpec.cooling`.
- `src/forja/mold/estudio-molde-datos.ts` — `estacion8Dado` consume la fuente única; `estacion8Circuito`: ventanas
  legales contra las caras, `cruzaInserto`, costura sellada, línea impar para el baffle, esquive en X y EL JUEZ.
- `scripts/ciclo-dado-test.cjs` — los 6 literales del ACTA R93.
- `ordenes/2026-09-10-el-agua-dice-dos-cosas.md` + `public/evidencia/2026-09-10-el-agua-dice-dos-cosas/*`.
