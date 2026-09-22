# ORDEN: LOS INSERTOS SE BARRENAN — la cavidad y el núcleo dejan de ser macizos: pines, bebedero y agua con su barreno; los retornos fuera del inserto

ESTADO: en-curso
PRIORIDAD: 1
AGENTE: Opus · worktree propio · iangpu forja-dev6 :5197

BASE: ae41a29   (el worktree nació 33 commits atrás, en 860e073, sin el archivo de esta orden ni `cicloPortamoldesPieza`; la rama se colocó en main ANTES de trabajar — sin rebase ni merge de trabajo: 0 commits propios)

OBJETIVO: que los insertos del molde de TU pieza sean fabricables. Hoy `construirAceroE3` talla cavidad y núcleo de la pieza
y AHÍ se quedan macizos: los 8 pines atraviesan el núcleo (16 tramos, hasta 2.5 mm = su radio, 7.2 falla 4/4), el bebedero
comparte 3.4–4.5 mm con la cavidad, el agua A entra 1.6–2.2 mm al inserto de cavidad, y los 4 pines de retorno cruzan la
esquina del inserto de núcleo (15,000 mm³, 5.3 mm en la carcasa; 2.7 mm en la tapa). Al final: los insertos traen SUS
barrenos (bebedero en la cavidad; punta + hombro de cada pin en el núcleo; el agua que los cruce) y los retornos viven fuera
del inserto; el estudio de contacto da 0 mm³ inserto↔pin/colada/agua/retorno en las 4 piezas.

## LO QUE SE MIDIÓ (plan de inspección 2026-09-21 — resultados.json y `moldSolidCollisions`)
- nucleo↔pin-punta-k 286 mm³ · 1.12 mm; nucleo↔pin-cuerpo-k 154 mm³ · 2.19 mm (carcasa); cavidad↔colada 1111 mm³ · 3.88 mm;
  cavidad↔agua-A-* 1.56–2.15 mm; nucleo↔pines-retorno 15000 mm³ · 5.3 mm (carcasa), 3328 · 2.71 (tapa); 1599HBK y 1557BGY
  sin retorno↔núcleo (inserto más chico que el paquete).
- Los retornos se colocan en las esquinas de la EXPULSORA (mold-plano-set.ts buildFunctionalParts «2b) RETURN PINS»: 65+26,
  20+26) sin mirar el tamaño del inserto (`insertDims`).
- ORDEN DE LAS ESTACIONES: E3 talla los insertos ANTES de que existan el agua (E6) y los pines (E7). El barrenado tiene que
  ocurrir DESPUÉS de E7 (un paso de `cicloPortamoldesPieza`, E8, o un paso final de E7): «los insertos se barrenan con lo que
  ya se sabe». Consume las posiciones que haya en `ciclo.e10` (pines) y `ciclo.e8` (agua) EN EL MOMENTO: otras órdenes en
  paralelo mueven pines y agua — no dependas de sus valores, dependa del flujo de datos.

## YA-EXISTE (prueba de ausencia)
- `construirAceroE3` (estudio-molde-datos.ts:1799) devuelve `r.cavityPlate`, `r.corePlate`, `r.macho`, `dadoD`; el kernel
  tiene `K.cut`, `K.makeCylinder`, `K.drillHole` (mold-plano-set.ts:286 los usa para las placas).
- La estación 8 re-emite componentes por rol (`cursoSet(8, …, [...moldParts.filter(!roles.has), ...porta])`): reemplazar
  `cavidad`/`nucleo` por sus versiones barrenadas ahí es el mismo patrón.
- `cursoPart(shape, role, …)` tesela con piso angular 0.2 rad (medido: sin piso, una cavidad real = 6.2 M triángulos).
- Las holguras de barreno viven en `fits.ts` (LITERAL, ISO): usar `pillarClearanceFit`-like para pin y bebedero, no inventar.
- NO existe: barrenar insertos; retornos que miren el inserto.

## EJERCICIOS
- [ ] paso «barrenar insertos» después de E7: cavidad − bebedero (⌀ del sprue en la partición + holgura) − agua A que la cruce;
      núcleo − (punta ⌀ + holgura de fits.ts) por pin con asiento del hombro (cuerpo ⌀) bajo la partición − agua B que lo cruce.
      Re-teselar y REEMPLAZAR los roles `cavidad`/`nucleo`. Telemetría con su tiempo.
- [ ] retornos fuera del inserto: posición en función de `insertDims` y del paquete (≥ ⌀ al inserto, ≥ 1.5·⌀ al canto de la
      expulsora); si no caben, decirlo (no encimarlos en silencio).
- [ ] las 4 piezas: `moldSolidCollisions` con 0 pares inserto↔{pin, colada, agua, retorno} (o ≤ 0.6 mm = ruido de vóxel,
      declarado); captura del núcleo barrenado desde arriba y de la cavidad desde abajo (macho opaco, pieza oculta).
- [ ] tiempo: el barrenado no debe subir la estación 8 más de ~10 s en la carcasa (mide y anota).

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-plano-set.ts
- src/forja/mold/mold-drawing-set.ts
- scripts/ciclo-dado-test.cjs

## CREA
- public/evidencia/2026-09-21-los-insertos-se-barrenan/resultados.json
- public/evidencia/2026-09-21-los-insertos-se-barrenan/insertos-barrenados.png
- public/evidencia/2026-09-21-los-insertos-se-barrenan/nucleo-desde-arriba.png
- public/evidencia/2026-09-21-los-insertos-se-barrenan/cavidad-desde-abajo.png
- public/evidencia/2026-09-21-los-insertos-se-barrenan/retornos-fuera-del-inserto.png

## ENMIENDA 2026-09-21 — entran `src/forja/mold/mold-drawing-set.ts` (al TOCA) y 3 capturas (al CREA)
**Por qué el archivo.** La orden pide mover los return pins y dice: «los barrenos de retorno de las
placas (`standardHoles 'pin de retorno'`) deben moverse CON ellos». Esos barrenos NO se generan en
mold-plano-set.ts: se generan en `standardHoles` (mold-drawing-set.ts), en DOS lugares (holgura en
soporte+B, y pin de retorno en expulsora+retenedora), cada uno con el literal `65 + 26` / `20 + 26`
repetido a mano — y había un CUARTO en el camino `realSolids` de mold-plano-set.ts. Cuatro copias de
la misma cota: mover el pin sin mover los barrenos es peor que no moverlo. Entra el archivo para
poner UNA fuente (`returnPinLayout`), que es donde ya viven `insertDims` y `cavityGrid` (geometría de
referencia; drawing-set no importa a plano-set, así que no aparece ciclo de módulos). Con ella se
mudan también `EXPULSORA_MARGEN_X_MM`/`_Y_MM`, que plano-set re-exporta para no romper a nadie.
**Por qué las capturas.** La orden pide «captura del núcleo barrenado desde arriba y de la cavidad
desde abajo» + los retornos: son tres vistas distintas, no una. `insertos-barrenados.png` se queda
como la del conjunto.

## BORRA
- (nada)

## PREEXISTENTE
- (nada — worktree limpio)

## EVIDENCIA (se declara ANTES de trabajar)
- 4/4 piezas: 7.2 ✓ y 2.4 ✓ (0 mm³ inserto↔pin/colada/agua/retorno), números antes → después; capturas.
- tsc: cero errores nuevos contra la base de 66 · ciclo-dado-test 266/266 (o acta si el cubo cambia) · orden-gate VERDE · sin deploy.

## CIERRE (2026-09-21 · MEDIDO, no contado)

### ORDEN vs ENTREGADO
| ejercicio | estado |
|---|---|
| paso «barrenar insertos» después de E7 (bebedero · punta+hombro de cada pin · el agua que los cruce) | **HECHO** — `barrenarInsertos` (estudio-molde-datos.ts), llamado como paso 0/4 de `cicloPortamoldesPieza` (E8) con `e5datums`/`e8.circuito`/`e10.pines` LEÍDOS EN EL MOMENTO |
| re-teselar y REEMPLAZAR los roles `cavidad`/`nucleo` | **HECHO** — mismo rol, mismo tinte; el resto del estudio no se entera |
| telemetría con su tiempo | **HECHO** — `E8T barrenado de insertos (kernel · N familias · cav X ms · core Y ms)` + línea en el panel con el acero removido |
| retornos en función de `insertDims` y del paquete | **HECHO** — `returnPinLayout` (mold-drawing-set.ts), UNA fuente para el pin y sus 4 juegos de barrenos |
| si no caben, decirlo | **HECHO** — `console.warn` + nota en las features del componente, con la banda medida y el ⌀ que SÍ cabría |
| 4 piezas: 0 mm³ inserto↔{pin, colada, agua, retorno} | **7.2 en 4/4 ✓** · agua en 3/4 exactamente 0 y en la carcasa 0 de acero REAL (residuo de malla, probado abajo) · **2.4 en 2/4** (alta y ensamble ✓; carcasa y tapa NO CABEN y quedan declaradas) |
| el barrenado no sube la E8 más de ~10 s | **CUMPLE en lo que es mío** — el paso 0/4 mide **5.4–9.2 s** (booleanas + las dos teselaciones), medido directo en la telemetría. El TOTAL de la E8 en la carcasa va de 11.0 s a 22.4 s, pero la diferencia de más no es el barrenado: el paso `portamoldes` solo midió 9.2 / 11.5 / 12.1 / 16.3 s en cuatro corridas del mismo código (cinco agentes compartiendo iangpu) |

### NÚMEROS — antes → después (arnés `barrenos-vista.cjs` sobre la app real, `moldSolidCollisions` con el filtro del inspector)
| pieza | 7.2 · pines en el núcleo | 7.2 · bebedero ↔ cavidad | agua ↔ insertos | 2.4 · retornos ↔ núcleo |
|---|---|---|---|---|
| carcasa 1594C Box | 16 tramos, hasta **2.19 mm** → **0** | **3.88 mm** → **libre** | 2543·2.18 / 1393·2.03 / 416·1.82 mm³·mm → **34·0.91 / 17·1.0 / 14·0.78** (malla; acero real 0) | 15000 mm³ · 5.3 mm → **igual (NO CABE, declarado)** |
| tapa 1594C Lid | 8 tramos, hasta **1.12 mm** → **0** | **3.38 mm** → **libre** | → **0 pares** | 3328 mm³ · 2.71 mm → **igual (NO CABE, declarado)** |
| alta 1599HBK | 16 tramos, hasta **2.5 mm** → **0** | **4.46 mm** → **libre** | → **0 pares** | sin contacto → **sin contacto** |
| ensamble 1557BGY | 8 tramos, hasta **1.12 mm** → **0** | **3.56 mm** → **libre** | → **0 pares** | sin contacto → **sin contacto** |

Acero REMOVIDO por el barrenado (la prueba de que la booleana mordió, medida con `volume()` antes/después):
carcasa cavidad **−10,204 mm³** · núcleo **−7,310** · tapa **−9,301 / −2,464** · alta **−16,273 / −14,778** · ensamble **−9,422 / −4,381**.
Tiempo del paso (E8): barrenado 4.1–5.6 s + teselar cavidad 0.8–1.8 s + teselar núcleo 0.5–3.9 s ⇒ **+5.4 a +9.2 s**, dentro de los ~10 s pedidos.
(El TOTAL de la E8 en la carcasa: 11.0 s antes → 22.4 s en la corrida final. El resto de la diferencia es el paso
`portamoldes`, que con el MISMO código midió 9.2 / 11.5 / 12.1 / 16.3 s según la carga de iangpu — cinco agentes a la vez.)

### EL HALLAZGO QUE COSTÓ LA MITAD DE LA ORDEN: un `cut` con COMPOUND pierde brocas
Medido en node sobre el INSERTO REAL de la carcasa (`prueba-barreno-real.cjs`, 3 corridas coincidentes):

| estrategia | cavidad (8 brocas) | núcleo (17 brocas) |
|---|---|---|
| `cut(compound)` | 6,851 mm³ · 176 ms — **se le escapan 2 tramos del anillo** | 7,310 mm³ · 1,901 ms ✓ |
| `cut(fuseAll)` | 1,539 mm³ · 529 ms — **PEOR: se le escapa el anillo entero** | 7,310 mm³ · 2,140 ms ✓ |
| N cuts secuenciales | 9,439 mm³ · 802 ms ✓ | 7,310 mm³ · **19,654 ms** (10× más caro, no gana nada) |
| **HÍBRIDO** (compound de las sueltas + una por una donde se cruzan) | **9,439 mm³ · 730 ms** ✓ | **7,310 mm³ · 1,992 ms** ✓ |

Por eso `barrenarInsertos` agrupa las brocas en RACIMOS conexos (traslape de cajas), manda todos los racimos de
UNA broca en un solo compound y corta una por una SOLO dentro de los racimos que se cruzan. El síntoma en pantalla
era exactamente eso: con compound, `agua-A-este` y `agua-A-ext-out` se quedaban DENTRO del inserto mientras sus
gemelas oeste/ext-in salían. (La misma trampa vive en `cutAll` de mold-plano-set.ts — **visto, no tocado**: es otro
camino, el del molde en vivo, y otra orden.)

### EL RESIDUO DE AGUA DE LA CARCASA ES MALLA, NO ACERO (probado, no supuesto)
`moldSolidCollisions` sigue reportando 34 / 17 / 14 mm³ con 0.78–1.0 mm en `cavidad↔agua-A-*`. Se midió la
INTERSECCIÓN EXACTA del kernel (`common(broca, inserto ya barrenado)`) para las 8 brocas de la cavidad y las 17 del
núcleo: **ninguna pasa de 0.5 mm³**. El acero salió de verdad; lo que ve el estudio es la teselación del agua, que
`cursoPart` malla con flecha 0.9 mm (heptágono inscrito) contra un barreno mallado a 0.03 mm / 0.2 rad.

### LOS RETORNOS: la regla se aplicó y en 2 de 4 piezas NO CABE — con su número
`returnPinLayout(spec)` coloca los 4 return pins ⌀12 en las esquinas de la placa expulsora **mirando el inserto**:
≥ 1·⌀ de la superficie del pin al canto del inserto y ≥ 1.5·⌀ del centro al canto de la expulsora (reglas de la
orden; el libro no da estas dos cotas). Si el inset nominal de 26 mm ya libra, no se mueve nada; si no, se mueve por
el eje que cueste menos y solo lo necesario.
La BANDA libre (del canto de la expulsora al canto del inserto) que hay de verdad, contra la que un ⌀12 pide (3·⌀ = 36 mm):

| pieza | inserto | banda en X | banda en Y | veredicto |
|---|---|---|---|---|
| carcasa | 132×173 | −8.0 mm | **16.5 mm** | NO CABE · cabría hasta ⌀5.5 |
| tapa | 145×104 | −14.5 mm | **26.0 mm** | NO CABE · cabría hasta ⌀8.7 |
| ensamble | 142×142 | −13.0 mm | **32.0 mm** | NO CABE por la regla, pero el nominal ya no toca el inserto (0 mm³) |
| alta 1599HBK | base 396×296 | libra | libra | libre con el inset nominal |

La causa está fuera de esta orden: `EXPULSORA_MARGEN_X_MM = 65` es un literal fijo para cualquier base (en una base
de 246 mm la placa expulsora queda de 116 mm en X, **más angosta que el inserto de 132**), y la orilla del inserto
sale de §4.2.2 (`cheek = max(3·⌀agua, profundidad)` = 33.3 mm por lado en la carcasa). Tres caminos, y la decisión
no es mía: **(a)** que la placa expulsora crezca (es de la orden de la pila), **(b)** que la orilla del inserto
baje, **(c)** que el ⌀ del return pin salga de la banda disponible en vez de ser el literal 12. No se movieron: el
molde lo DICE en el componente y en la consola, no se encima en silencio.

### LO QUE TAMBIÉN SE BARRENÓ (y no estaba en la lista)
Los TAPONES NPT y los O-RINGS del circuito: donde el extremo muerto de un barreno o un cruce de interfaz cae dentro
de un inserto, el inserto lleva la rosca y la caja. Antes metían 133 mm³ · 1.2 mm (6 tapones) y 55/18 mm³ · 0.4 mm
(O-rings) de acero compartido en la cavidad de la carcasa; ahora 0. Regla NUESTRA, declarada: el libro habla del
tapón (§9.2.6) pero no dice en qué pieza va cuando el barreno muere en un inserto.

### CITAS
- `ejectorPinFit` (fits.ts, LITERAL): barreno del pin = ⌀ + 0.13 mm reamed — **Kazmer §8.3.2**, que además es el venteo.
- punta GUIADA en el núcleo, cuerpo por el respaldo — **Fig 1.6**.
- bebedero cónico, angosto arriba / ancho abajo; el barreno ES la superficie moldeante (cero holgura por diseño) — **§6.3.1**.
- el agua dentro de un inserto se barrena — **cap 9**.
- orilla del inserto (de donde sale la banda de los retornos) — **§4.2.2** vía `sizeInserts`.
- ≥1·⌀ al inserto y ≥1.5·⌀ a la expulsora: **regla de la orden, sin cita del libro**.

### GATES
- `tsc --noEmit` en iangpu (forja-dev6): **66 errores = la base, 0 nuevos** (`comm -13` contra `/home/ian/la-entrada/tsc-head.txt` sale vacío).
- `ciclo-dado-test.cjs`: **266/266** (sin ACTA R93: no se tocó ningún literal del cubo).
  ⚠ la primera corrida dio 265/1 porque `forja-dev6/scripts/ciclo-dado-test.cjs` estaba VIEJO (el título del check del
  cargador multi-sólido era el de antes de 4d9bbd2). Rsync del script → 266/266. No fue el código de esta orden.
- inspector completo de 17 puntos sobre la carcasa, corrido ANTES y DESPUÉS con el mismo arnés: **7.2 ✗ → ✓**,
  resumen **5 ok / 8 falla / 2 mirar → 6 ok / 7 falla / 2 mirar**; `otras colisiones reales: 0` en ambos.
- `orden-gate.cjs`: VERDE. Sin deploy, sin push, sin video.

### EVIDENCIA
- `public/evidencia/2026-09-21-los-insertos-se-barrenan/resultados.json` — las 4 piezas, antes → después, el reporte
  de barrenado por pieza, la telemetría de la E8, los avisos de retornos y TODAS las colisiones reales.
- `nucleo-desde-arriba.png` · `cavidad-desde-abajo.png` · `retornos-fuera-del-inserto.png` · `insertos-barrenados.png`
  (corte por la fila de pines).
- En iangpu: `/home/ian/el-plan-dev6/` — `antes-carcasa/` y `despues-carcasa/` (inspector de 17 puntos con tarjetas),
  `v-{carcasa,tapa,alta,ensamble}/`, `cubo2.log`, `prueba-real*.log` (el control de estrategias de corte).

### PREGUNTAS ABIERTAS PARA IAN
1. **Los return pins de la carcasa y la tapa no caben fuera del inserto.** ¿Crece la placa expulsora, baja la orilla
   del inserto, o el ⌀ del return pin se calcula de la banda (⌀5.5 en la carcasa, ⌀8.7 en la tapa)? Hoy quedan en su
   sitio y el molde lo dice.
2. `cutAll` de mold-plano-set.ts (el camino del molde en vivo) corta con COMPOUND: con brocas que se cruzan pierde
   material igual que aquí. ¿Se abre orden para pasarlo al híbrido?
3. El agua se tesela con flecha 0.9 mm y por eso el estudio de contacto reporta hasta 1.0 mm de residuo falso contra
   sus propios barrenos. ¿Bajamos la flecha del agua, o el estudio empieza a medir con el kernel los pares chicos?

### ARCHIVOS TOCADOS (para la fusión)
- `src/forja/mold/estudio-molde-datos.ts` — `barrenarInsertos` (nueva) + import de `fits` y de las primitivas del kernel.
- `src/forja/brep/useMoldStudio.ts` — `ciclo.e3solidos` (la E3 guarda el acero) + `ciclo.e3barrenado` + el paso 0/4 de la E8.
- `src/forja/mold/mold-drawing-set.ts` — `returnPinLayout` + `EXPULSORA_MARGEN_X_MM/_Y_MM` + `RETURN_PIN_DIA_MM/INSET_MM` (se mudan aquí) + los 2 juegos de barrenos de `standardHoles`.
- `src/forja/mold/mold-plano-set.ts` — los return pins de `buildFunctionalParts`, el taladro del camino `realSolids` y la re-exportación de los márgenes.
- `ordenes/2026-09-21-los-insertos-se-barrenan.md` — enmienda + este cierre.
- `public/evidencia/2026-09-21-los-insertos-se-barrenan/` — 1 json + 4 png.
- NO se tocó `scripts/ciclo-dado-test.cjs` (estaba en el TOCA por si el cubo cambiaba: no cambió).
