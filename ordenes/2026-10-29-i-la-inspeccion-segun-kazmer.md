# ORDEN I: LA INSPECCIÓN SEGÚN KAZMER — los rojos se ven, la pieza siempre presente, un corte por lo medido

ESTADO: hoy
PRIORIDAD: 1

BASE: 6655fdd (worktree reseteado a main; la orden nació con 54ea7ca)

OBJETIVO: ian (2026-10-27): «que le preguntemos a Kazmer si le gusta el video, qué otras cosas debería verse en la inspección… se me
hace muy corto… deberíamos ver más datos, vistas más cerca». Kazmer (Opus con el libro, `/mnt/c/Users/sebas/Downloads/la-pelicula/kazmer/
LA-INSPECCION-SEGUN-KAZMER.md` — LÉELO COMPLETO, es tu especificación): «La película sí. La inspección todavía no: muestra cuatro
palomitas y se salta los cuatro rojos». ian dio el «va» (2026-10-29) a: los dos errores gratis + los rojos + los cinco puntos baratos
(S) + la regla de cámara. Al terminar, el paso 7 (la inspección) dura ≈ 2–3 min, enseña cada ✗ del dictamen en su capítulo, y cada
punto arranca con 2 s de contexto (molde completo, punto marcado) y luego el macro con la pieza presente y un corte por lo medido.

## LO QUE SE CAMBIA
0. **Gratis (lo primero que vería un comprador)**:
   - la cita del punto 4: §6.3.2 es el molde de TRES placas; para dos placas es **§6.3.1** (p.123) + **Tabla 6.1** (p.129)
     (`inspeccion-recorrido.ts:162` y `:179`); los +10 mm siguen como regla de Hefestos;
   - **UNA apertura**: el motor elige la máquina con 135.4 mm (`seleccion.apertura.strokeMm`, lo que lee `qa-huella`) y la pantalla dice
     «abre 152.5» (`animZ`). Mide de dónde sale cada uno, decide cuál es la física (lo que la máquina TIENE que abrir según §6.3.1 / §4.3.2)
     y que la pantalla, el expediente y la animación usen ese. Escribe en el CIERRE qué era cada número;
   - «945 pares» (cuadro 58.5) contra 915 en el resumen: una sola fuente, o quita el conteo (Kazmer §4: «al comprador le importa el peor par»).
1. **Los rojos se ven**: cada ✗ del dictamen VIVO tiene su punto en su capítulo (hoy DP y COLADA VS CICLO en colada, FREEZE en
   compuerta, CLARO en enfriamiento). Léelos del dictamen en tiempo de ejecución, NO fijes cuatro: la orden H re-juzga el dictamen en
   paralelo y CAMBIARÁ cuáles salen rojos (CLARO puede pasar a ✓). Si un ✗ no tiene vista 3D todavía (FREEZE: falta el sólido de la
   compuerta), va con su número contra el límite y la mejor vista que exista, rotulando lo que falta.
2. **Los cinco baratos** (Kazmer §3, los S; sus números ya los calcula el motor):
   1) la colada en UN corte por el eje del bebedero: ΔP contra su límite y los dos relojes (bebedero contra pared), §6.2.2/§6.4.7;
   2) qué manda el ciclo: corte por un poste con el campo térmico de ENFRIAMIENTO, y en el mismo corte el agua con su profundidad
      2D < H < 5D (Eq 9.22) y su paso H < W < 2H (Eq 9.24), acotados por línea;
   4) la placa de soporte contra el venteo: 0.0082 mm contra ≈ 0.02 (§12.1.2 p.304) con los 3 pilares bajo la cavidad (§12.2.3),
      deformada exagerada y rotulada «×N»;
   5) los botadores en su agarre: pieza en fantasma, cada pin tocando su poste o su pared con su fuerza (§11.2.5 p.273), y la fuerza
      total contra la de la máquina (§11.2.2; p.269 «typically 2% of the clamp tonnage»);
   8) la máquina HT-150SV con cotas: cierre (t y %), ancho entre barras «including cooling plugs», daylight, disparo dentro de la
      ventana cómoda (§4.3.3 p.82). En 3D NO (eso es M, otra orden).
3. **La regla de cámara de Kazmer**: la pieza SIEMPRE presente (sólida o fantasma) y un corte que pase por lo medido; 2 s de contexto
   y luego el macro; todo lo exagerado lleva «×N». Arregla los cuadros que Kazmer cazó flotando en el vacío (botadores ≈ 80 s y agua
   ≈ 92 s de la película de la semana 1: `/tmp/claude-1000/-home-ian-Gaia-la-forja/bec93bb9-09c0-4a0d-b030-b3f226c67838/scratchpad/
   kazmer/cuadros/`) y la cámara que al terminar la E8 queda pegada a la sujeción superior (orden B la vio).
4. **El cierre de la inspección**: los rojos, cada uno con la decisión que pide, y lo que NO se revisó.
5. **El guion** (`scripts/guiones/pelicula-camino.json` y `.txt`): el tramo de la inspección dice lo que la pantalla dice, una frase por
   punto nuevo, español mexicano, sin siglas. Lo que la voz dice tiene que verse en ese momento.
NO entra (son M, quedan para otra orden): el sólido de la compuerta, la anatomía del venteo, la contracción con la pieza nominal en
fantasma, el llenado animado, la máquina en 3D. Lista en el CIERRE qué haría falta para cada uno.

## YA-EXISTE (prueba de ausencia)
- `src/forja/mold/inspeccion-recorrido.ts` (183 líneas: los puntos del recorrido); lo usan `FocoMolde3D.tsx` y `ForgeBRepStudio.tsx`.
- `__forgeBrep.inspeccion.estado(apertura, expulsión)`, `inspeccion.corte(eje, mm)`, `moldGeom()`, `animZ(rol)`, `llenadoT(1)`.
- Los criterios del dictamen con id (`mold-contratos.ts`: `feed-dp`, `feed-lazo`, `gate-freeze`, `agua-profundidad`, `agua-paso`, …).
- La filmadora (`scripts/filma-camino.cjs`, reloj virtual) y el guion (`scripts/guiones/pelicula-camino.json`).
- Toda vista 3D vive en `ForgeBRepStudio.tsx`/`FocoMolde3D.tsx`: CERO `<Canvas>` nuevos.

## TOCA
- src/forja/mold/inspeccion-recorrido.ts
- src/forja/brep/FocoMolde3D.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/guiones/pelicula-camino.json
- scripts/guiones/pelicula-camino.txt
- scripts/filma-camino.cjs

## ENMIENDA 2026-10-29
- `scripts/filma-camino.cjs` entra al TOCA. POR QUÉ: la filmadora filmaba el paso 7 con una duración TECLEADA
  (`2.3 + 5.5 + 0.6 + 11 + 11 + 11 + 12.6` = los 4 puntos viejos). La inspección nueva tiene tantos puntos como rojos traiga el
  dictamen vivo, cada uno con su `dur`; con el número fijo la película cortaba a la mitad (y la EVIDENCIA pide medir la duración
  del paso 7 con la filmadora). Cambio: `cada(k)` puede devolver `'fin'` y el paso 7 filma hasta que el recorrido avisa
  `data-fin="1"` (tope 300 s); anota cuándo empieza cada punto en `inspeccion-puntos.json` (los «en» del guion). Nada más.

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (otras órdenes trabajan EN PARALELO)
- ForgeBRepStudio.tsx: I = el paso 7 / inspección / cámara de la inspección. H toca el dictamen (~L3931) y la hoja de análisis
  (~L4040-4140); J la maquetación de la hoja. No toques esas regiones.
- Si necesitas un número que hoy no viaja (p. ej. la fuerza por pin), léelo de donde ya se calcula; si hay que tocar otro archivo,
  ENMIENDA esta orden con el porqué.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- Por cada punto nuevo o arreglado: captura 4K de la app real (§5 de las instrucciones) que abres con Read y juzgas — ¿se ve la
  pieza?, ¿el corte pasa por lo medido?, ¿el número en pantalla = el del dictamen/`__forgeBrep`? Tabla en el CIERRE: punto · número
  en pantalla · número del motor · captura.
- Los dos errores gratis: grep de la cita y la apertura única leída en pantalla, en el expediente y en `animZ`.
- Par de control de «los rojos se ven»: una pieza cuyo dictamen tenga otro conjunto de ✗ (la 1594C Lid o una pieza del banco) enseña
  SUS rojos, no los de la Box.
- Una filmación de SOLO el paso 7 en tu copia (filmadora, una pieza, dentro del turno de GPU) para medir la duración (meta 2–3 min)
  y 1 cuadro por punto en `/home/ian/el-plan-dev4/inspeccion-v2/`. La película completa la monta el coordinador tras la fusión.
- El camino de la carcasa (runner) sigue pasando; tsc sin errores nuevos.

## CIERRE (2026-10-29 · MEDIDO, no contado)

**orden vs entregado**
- 0 · **la cita**: el punto «¿Abre, sale y empuja?» citaba §6.3.2 (molde de TRES placas) para lo que pide la apertura. Ahora:
  «§6.3.1 p.123: abre "sufficiently to remove the moldings"; el bebedero mide la sujeción superior + la placa A · Tabla 6.1 p.129:
  75 mm en el molde de dos placas del libro · + 10 mm de holgura (regla de Hefestos) · §4.3.2 p.81: "the ejector travel is set to be
  equal to the depth of the molded part"». §6.3.2 queda SOLO donde es suyo: el factor 2.5·H («two to three times the height», p.127)
  del comentario de `abreSaleEmpuja`. Citas verificadas en el PDF (pdftotext, página impresa): p.81, 82, 123, 127, 129, 132, 148,
  149, 203, 213, 214, 269, 273, 304, 312.
- 0 · **UNA apertura** — qué era cada número (medido con la sonda en la app, Box):
  - **152.5 mm** (pantalla y animación, `animZ('clamp')`) = `carreraDeApertura`: 2.5 × 33.3 (pieza, §6.3.2) + **69.2** de bebedero
    MEDIDO sobre la pieza en el acero dibujado (`coladaSobrePiezaMm`: colada z 222.8→292). Ese bebedero atraviesa la sujeción
    superior (36 = `CLAMP_PLATE_MM`) + la placa A (66) que se dibujan y se cortan.
  - **135.4 mm** (motor, `seleccion.apertura.strokeMm`, lo que lee `qa-huella` y la hoja «abierto 447 de 1010») = 2.5 × 33.3 +
    (85.4 − 33.3): un bebedero ESTIMADO en `moldmachine.ts:374` = placa A del catálogo (60) + «clamp de 1"» (25.4).
  - **La física es 152.5**: §6.3.1 p.123 «the length of the sprue is determined by the combined thicknesses of the top clamp plate
    and the A plate» — las que se cortan son 36 + 66, no 25.4 + 60. La pantalla y la animación ya usaban 152.5; el punto de la
    máquina juzga el daylight con ESE número y el alto medido (292 + 152.5 = 444.5 ≤ 1010; el motor: 312 estimado + 135.4 = 447.4 —
    la máquina no cambia, holgura > 560). El punto lo dice en pantalla: «(El selector de máquina usó 135.4 con un bebedero estimado;
    el que se corta es éste.)».
  - **Lo que NO entregué**: la hoja de análisis (expediente) y `qa-huella` siguen leyendo 135.4 del motor. Son región de H
    (`moldmachine.ts` paquete; hoja: valores) y H está uniendo «un bebedero». El arreglo de raíz es una línea en el motor: bebedero =
    `espesor(placas.cavidad) + CLAMP_PLATE_MM` (lo mismo que dibuja `plateStackZ`) → 152.0 (0.5 de la boca bajo la partición) y el
    stack con las placas que se dibujan (292, no 312). ⚠ para H: si su «un bebedero» mete la L de la E5 (69.2, medida SOBRE la
    pieza) en `sprueLenMm`, la línea 475 le vuelve a restar H y sale 119.2: una TERCERA apertura.
- 0 · **«945 pares» contra «915»**: el 945 era `foco.pares` de esa corrida (78 barrenos); el 915 venía de otra (76 barrenos, el
  MEDIDO del camino del 2026-10-22 y el ejemplo fijo de `scripts/revisor/captura.cjs:72`). Se quitó el conteo del Foco (Kazmer §4: «al
  comprador le importa el peor par»): ahora dice «78 barrenos identificados, cada uno medido eje a eje contra el agua» y «revisé el agua
  contra cada barreno vecino y la punta de cada pin · no revisé: …». El peor par sigue en la lista y en su punto.
- 1 · **los rojos se ven**: `rojosDelDictamen(revision.contratos)` en tiempo de ejecución (NO se fijan cuatro). Cada ✗ va como chip
  rojo en el punto de su capítulo; el que no tenga punto propio entra como `rojoSinVista` (su número contra su límite, su capítulo
  aislado y «este rojo todavía no tiene su vista en 3D»). Box: DP + COLADA VS CICLO → Colada · cap 6; FREEZE → Compuerta · cap 7
  (falta el sólido: rotulado); CLARO → Enfriamiento (el punto del agua dice los DOS números y por qué difieren: el dictamen juzgó
  otra agua, ⌀9.53 → 3.76 contra 4.76; el Foco mide la que se barrena, ⌀6.35 → 3.49 contra 3.17). El dictamen abre el recorrido
  («4 de 69 no cumplen») y el cierre los repite con la decisión que pide cada uno.
- 2 · **los cinco baratos**: colada (S1), qué manda el ciclo + el agua acotada línea por línea (S2), placa de soporte ×1,000 sobre
  sus pilares (S4), botadores en su agarre con su fuerza y su pared (S5), la HT-150SV con cotas (S8).
- 3 · **la regla de cámara**: 2 s de contexto (molde completo, el lugar marcado con un anillo que late; CORTE SECO de cámara, el vuelo
  atravesaba el acero) y luego el macro; la pieza SIEMPRE presente (si la vista no la trae entra en fantasma); lo exagerado lleva
  «×N». Cazado con los ojos: en los cortes en Y la cámara miraba el lado de AFUERA de lo que quedaba (az 0 = −Y): `azDelCorte` pone la
  cámara del lado de la cara cortada. El punto del agua conservaba el lado de la esquina y se llevaba la pieza: ahora conserva el lado
  de la pieza. El encuadre se corre para que lo mirado caiga en lo libre de la tarjeta (`orbitaLibre`). Botadores: solo las puntas,
  desde abajo, con la pieza en fantasma. El paso 7 arranca con el molde completo (la cámara pegada a la sujeción tras la E8).
- 4 · **el cierre**: cada ✗ con su decisión (DP y COLADA VS CICLO: el mismo diámetro; FREEZE: empaque → compuerta → pieza, §7.3.5;
  CLARO: qué agua juzga el dictamen) y lo NO revisado.
- 5 · **el guion**: el tramo 07 pasa de 9 a 14 frases, una por punto (y dos donde el punto tiene dos encuadres), sin siglas.

**números** (1594C Box, main 6655fdd + esta rama, copia dev4; pantalla = DOM `insp-*`/`cota-insp-*` leído por el arnés; motor = la
sonda sobre `__qaForja`/`__forgeBrep` en la MISMA app)

| punto | número en pantalla | número del motor | captura |
|---|---|---|---|
| 0 · el dictamen | 4 de 69 no cumplen (DP, COLADA VS CICLO, CLARO, FREEZE) | `revision.fila`: viola 4 / 69 | `v3-box/02-dictamen-*` |
| 1 · colada (cap 6) | 8.7 MPa · presupuesto 4.3 · reloj 145 s contra 21.7 · cota «bebedero sobre la pieza 69.20» | `feed-dp` 8.708/4.318 · `feed-ciclo` 145.13/21.70 · colada z 222.8→292 = 69.2 | `v3-box/03-colada-b-macro` |
| 2 · compuerta (cap 7) | se congela a los 8.3 s · pide 21.7 | `gate-freeze` 8.328/21.703 | `v3-box/04-compuerta-b-macro` |
| 3 · qué manda el ciclo (cap 9) | pared 21.5 s · poste 64.7 s (134 placa) · bebedero 145 s; H A 20.22 ✓ · H B-1/B-3 29.20 ✓ · H B-2 34.58 ✗ · W 50.80 ✓ · W A 86.00 ✗ · B-0/B-4 a 80 mm | lente `ciclo` 21.51/64.73/134.46 · ventana Eq 9.22 [12.7, 31.75] para ⌀6.35 · líneas B a x 13.9/72.2/123/173.8/232.1, A a 80/166 | `v3-box/05-ciclo-b-macro`, `-c-macro2` |
| 4 · menos acero junto al agua | 3.49 mm · mín 3.17 · CLARO del dictamen 3.76 contra 4.76 | Foco `masJusto` 3.49/3.17 (B-linea4 ↔ interlock 4) · `agua-claro` 3.76/4.765 | `v3-box/06-agua-justa-*` |
| 5 · botadores (cap 11) | 3.88 kN contra 39.2 · 2 % del cierre 29.4 · cada pin 485 N, pared a 3.4–5.7 mm | `e10.fuerza.fEjectN` 3882 · `fPorPinN` 485 · HT-150SV `ejectionForceKN` 39.2 | `v3-box/07-botadores-b-macro` |
| 6 · abre, sale y empuja | abre 152.5 · pide 112.5 · carrera 41.3 en caja 46 | `animZ('clamp')` 152.5 · `portamoldes` 41.3/46 (motor: `strokeMm` 135.4, ver arriba) | `v3-box/08-abre-sale-empuja-b-macro` |
| 7 · placa de soporte (cap 12) | 0.0082 mm = 41 % del venteo 0.02 · ×1,000 · 3 pilares | `placas.soporte` δ 0.0082, venteo 0.02, `hefestos.usoPct` 41, 3 pilares | `v3-box/09-placa-soporte-b-macro` |
| 8 · la máquina | 39.4 t de 150 (26 %) · 302 mm contra barras 462 · abierto 445 = 292 + 152.5 · disparo 20 % | `requerimientos.clampNeedTons` 39.42 · `clampUtilPct` 26.3 · acero dibujado x −27.9→273.9 · `shotPct` 20 | `v3-box/10-maquina-*` |
| 9 · el cierre | 4 por decidir · 8 puntos revisados · 50 de 50 rayos | los 4 VIOLA del dictamen | `v3-box/11-cierre-*` |

- **duración del paso 7**: antes **54.0 s** (2.3 cortina + 5.5 Foco + 0.6 + 4 puntos de 11/11/11/12.6, la filmadora lo tecleaba) →
  después **Σ = 2.3 + 5.5 + ≈0.8 + 129.5 = ≈138 s** (10 puntos: 6.5 · 15 · 11 · 18 · 12 · 15 · 14 · 13 · 13 · 12). En tiempo real
  en dev (con capturas 4K que bloquean el hilo): 157.8 s. **FILMADO** (filmadora, reloj virtual, 60 fps 4K, DESDE=7 HASTA=7, Box):
  **137.8 s = 2:18** (8,268 cuadros) — dentro de la meta de 2–3 min. Arranques medidos (`film7/inspeccion-puntos.json`): dictamen 8.2 ·
  colada 14.7 · compuerta 29.7 · ciclo 40.7 · agua 58.7 · botadores 70.7 · abre 85.8 · placa 99.8 · máquina 112.8 · cierre 125.8 s; los
  «en» del guion salen de ahí. Un cuadro de contexto y uno de macro (y el segundo encuadre) por punto: `/home/ian/el-plan-dev4/inspeccion-v2/`
  (25 cuadros, juzgados con Read).
- tsc: 67 errores = línea base (diferencia vacía). El cubo: 270 pasan · 0 fallan (`ciclo-dado-test.cjs` en dev4). Juez: VERDE.

**par de control de «los rojos se ven»**
- **la 1594C Lid NO sirve de control**: es «LA PIEZA QUE NO» de la orden C (6 contrasalidas, snaps): la puerta cierra los pasos 6–9 y no
  hay molde ni inspección (medido: 0 moldes tras 130 s, la corrida se detuvo por PID). Eso SÍ es un control: una pieza sin molde no
  enseña los rojos de la Box — no enseña ninguno.
- **control lógico (CPU, `control-rojos.ts` sobre el módulo real en dev4)**: con el dictamen de la Box (DP, COLADA VS CICLO, FREEZE,
  CLARO) salen sus chips en colada · compuerta · enfriamiento → PASA; con un dictamen de OTRA pieza (rojos: DEFLEXION VS VENTEO, ANCHO
  CON PLUGS; la colada y la compuerta cumplen) NO sale la compuerta, la colada va sin chips y los dos rojos entran en Estructura y en
  La máquina → PASA. Un recorrido con los cuatro fijos fallaría el segundo caso.
- **control en la app (1598B Bottom, del banco Hammond)**: encolado en el turno de GPU (`/home/ian/el-plan-dev4/v3-1598/`); al cerrar
  esta orden el turno lo tenía un render de Blender de otra sesión (`flock -w 14400 … rinde_p5_iangpu.sh`). La 1599HBK no llegó al
  enfriamiento en 180 s (dos mitades; se descartó).

**evidencia**
- capturas 4K de la app real, abiertas con Read y juzgadas (antes/después), en iangpu `/home/ian/el-plan-dev4/`: `sonda-box/` (la
  inspección VIEJA: 4 puntos, ~55 s), `v2-box/` (primera pasada: defectos cazados con los ojos — la cámara del lado de afuera del corte,
  el vuelo que atravesaba el acero, la pintura térmica lavada y plana, la tarjeta que se cortaba, el agua sin pieza), `v3-box/` (corregido:
  colada en corte con la pieza, compuerta al pie del bebedero, el poste ROJO en el corte con las líneas acotadas, botadores con fuerza y
  pared, placa ×1,000 sobre los pilares); `sonda-box/sonda.json` (los números del motor) y `v3-box/{recorrido,pantalla}.json` (lo que la
  pantalla dijo). Copia local: `<scratchpad>/kz-i/`.
- **lo que la filmación cazó DESPUÉS** (y se arregló sin volver a filmar): en el punto del agua (y tenue en los botadores) la pieza NO
  se veía aunque el punto la pide en fantasma: el ciclo del molde se detuvo a media inyección (`tFill < 1`) y mientras el frente «se
  anima» la malla de la pieza no se dibuja, y su pintura solo sale con la pieza ≥ 50 % opaca. Arreglo: la inspección deja la pieza llena
  (`setTFill(1)`). También: el cenital de la máquina con más aire (×2.7), el rótulo «◇ MANDA EL BEBEDERO», el ⌀ exacto del agua del
  dictamen (9.53, no 9.6) y cada punto reclama sus rojos (placa, máquina, botadores, agua) para que un rojo con vista no se repita como
  «sin vista». Verificación con los ojos encolada: `/home/ian/el-plan-dev4/v4-box/` (mismo turno de GPU, detrás del render de Blender).
  La película la refilma el coordinador tras la fusión.
- el juez: `node scripts/orden-gate.cjs` → VERDE. tsc 67 = base (diferencia vacía). El cubo 270/0.
- **el camino de la carcasa (runner)**: NO pasa, y no por esta orden: se rompe en el paso 3 (`tclick parte-lente-enfriamiento`, Timeout
  15 s) porque el MODO CAMINO (4373705, 2026-10-24) le pone `pointer-events:none` a la tira de lentes (`piel-futuro.ts:109`) y el runner
  hace un clic de Playwright. Pasos 1–2 OK; del 3 al 9 «el arnés no llegó». Es del camino / del runner (no está en mi TOCA): el runner
  necesita pulsar `tab-diseno` antes, o clic por `eval` como la filmadora.

**lo que quedó fuera (M) y qué falta para cada uno**
- **el sólido de la compuerta** (FREEZE en 3D): el paquete ya la dimensiona (`pkg.diseno.gate`: tipo, espesor, ancho, `freezeS`); falta
  que la E5 la CONSTRUYA como rol propio (`compuerta`) entre el pie del bebedero y la pieza — hoy el bebedero entra directo — y una
  vista que la corte con un reloj de la piel congelándose (`freezeS` contra `tPackNeededS`). Hoy el punto va al pie del bebedero, rotulado.
- **la anatomía del venteo**: la E7 ya trae el mapa (17 candidatos, 8 a maquinar, `vent-*`); falta tallar cada venteo en la partición
  (ranura con su h entre h_min y h_max, §8.2.3 p.189, exagerada ×N) y una vista que baje del último punto en llenar al plano de partición.
- **la contracción con la pieza nominal en fantasma**: la E9 escala el acero; falta poner la pieza NOMINAL en fantasma dentro de la
  cavidad escalada con la diferencia ×50 rotulada, y que la báscula de la E3 (Σ cavidad + macho + pieza = bloque, 0.04 %) diga si usa la
  pieza escalada o la nominal (Kazmer §1, punto 6).
- **el llenado animado**: el frente existe (`frenteGrid`, la estación 4) y la lente LLENADO marca el último punto; falta el punto que
  re-corra `llenadoT` sobre la pieza sola a 3/4 y termine marcando el último en llenar (§5.1, 18.9 MPa contra 100 con la presión del FAN).
- **la máquina en 3D**: hoy van sus números con cotas del molde; falta dibujar las platinas y las barras de la HT-150SV
  (`InjectionMachine`: tieH/V 462, daylight 130–1010) alrededor del molde, desde el operador y en cenital.

**visto, es de otra orden** (no lo arreglé de paso)
- **dos bebederos** (H): el dictamen juzga ⌀11.94 × 85.4 desde la partición; se corta ⌀8.62 × 69.2 sobre la pieza. El punto de la colada lo dice.
- **dos aguas** (H): el dictamen juzga ⌀9.53 (H 19.1 = 2.00·⌀, paso 33.4) y se barrena ⌀6.35; por eso CLARO sale ✗ en el dictamen
  (3.76 contra 4.76) y ✓ de panzazo en el Foco (3.49 contra 3.17). El punto del agua lo dice.
- **la E8 escribe «empaca 19.99s ≥ t_pack 21.70s ✓»** para el bebedero de la E5 (`estacion8Dado`, bushing.cadena): 19.99 < 21.70, el
  signo y la palomita están al revés (es del motor / H).
- **la apertura del motor** (H, ver arriba): `moldmachine.ts:374` estima el bebedero con placa A 60 + sujeción 25.4.

**preguntas abiertas para ian**
1. **Dos aperturas para una máquina.** Al abrir, la caja (33 mm de alto) sale del macho y su bebedero (69 mm: lo que miden juntas la
   sujeción superior y la placa A que se van a cortar) sale de la mitad fija; por eso el molde abre 152.5 mm. El selector de máquina la
   eligió pensando en un bebedero de 52 mm (placas de catálogo): 135.4. Hoy, abierto, el molde mide 444.5 mm y la HT-150SV abre hasta
   1,010: sobra, la máquina no cambia. **¿Hacemos que el motor elija la máquina con las placas que se dibujan (una línea, en la orden
   de «un veredicto»), para que la hoja diga lo mismo que la pantalla?** Recomiendo: sí.
2. **Los postes que mandan el ciclo.** Los 4 postes ⌀8 de la caja son macizos: tardan 65 s en ponerse firmes contra 21.5 s de la pared
   de 3.2 mm. Hoy el bebedero tarda todavía más; cuando se adelgace, mandarán los postes y el ciclo saldrá unas 3 veces el de la pared.
   **¿Le avisamos al cliente en el expediente que vaciar los postes bajaría el ciclo, o lo dejamos solo como dato?** Recomiendo: avisar
   con el número (Kazmer §9.2.1 p.203 y §2.3.1).
3. **El agua del macho, lejos de la pieza.** En el corte por el poste, dos líneas del macho quedan a 80 mm de la pieza (enfrían la
   placa, no la pieza) y otra a 34.6 mm, arriba del máximo de 31.75 (5 diámetros, Eq 9.22); las dos de la cavidad van a 86 mm una de
   otra contra un máximo de 40 (Eq 9.24). **¿Lo dejamos como aviso visible (reacomodar el agua es re-cortar acero, congelado 60 días) o
   lo metemos al dictamen como criterio medido en el acero?** Recomiendo: aviso visible ahora; criterio medido al terminar el congelamiento.

**archivos tocados** — src/forja/mold/inspeccion-recorrido.ts · src/forja/brep/FocoMolde3D.tsx · src/forja/brep/ForgeBRepStudio.tsx (solo
el paso 7: imports, el efecto de la inspección, la vista por punto, el avance, y las dos props en el JSX) · scripts/guiones/pelicula-camino.json ·
scripts/guiones/pelicula-camino.txt · scripts/filma-camino.cjs (ENMIENDA: el bloque del paso 7) · esta orden.
