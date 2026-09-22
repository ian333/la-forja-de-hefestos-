# ORDEN: EL CORTE ÚNICO — un solo lugar corta el acero, y un juez que avisa si una broca no quitó su material

ESTADO: hoy
PRIORIDAD: 2

BASE: 2438d60

OBJETIVO: que el error de «el corte que se come un barreno» NO pueda volver. Hoy el CAD corta con un COMPOUND de todas las
herramientas y, cuando dos brocas se cruzan, OCCT pierde material (agua-A-este y agua-A-ext-out se quedaban dentro del inserto).
LOS INSERTOS SE BARRENAN lo arregló SOLO en `barrenarInsertos` (racimos conexos: compound donde no se cruzan, una por una donde sí;
9,439 mm³ en 730 ms vs 19,654 ms uno por uno). La misma trampa sigue en `cutAll` (mold-plano-set.ts:982) y hay ~40 cortes
booleanos más repartidos (mold-plano-set 27, ForgeBRepStudio 7, useMoldStudio 6, timeline, mold-fea, occt).

## DECISIÓN DE IAN (literal, 2026-09-22)
- Pregunta 9: «el 9 lleva apareciendo varias veces, necesita una solución más robusta». Pregunta 10: «sí» a teselar más fino el
  agua en el estudio de contacto (hoy flecha 0.9 mm → hasta 1.0 mm de residuo falso), en vez de aflojar el juez.

## LO QUE SE PIDE (robusto = dos piezas)
1. **Una sola función** de corte de herramientas (el híbrido por racimos) en UN archivo existente, y todos los cortes de barrenos/
   cajas del molde pasan por ella: `cutAll`, `barrenarInsertos`, y los de useMoldStudio/ForgeBRepStudio/timeline que cortan herramientas.
2. **El juez del material quitado**: la función comprueba que CADA herramienta que toca el sólido quitó volumen
   (vol(s) − vol(s − herramienta) > ε, medido o por la suma de racimos) y, si alguna no quitó, reintenta esa sola y lo registra.
   Nunca devuelve en silencio el sólido intacto (hoy `catch { return s }` lo hace).
3. Agua del estudio de contacto teselada más fina: residuo falso < 0.1 mm contra sus propios barrenos.

## EJERCICIOS
- [ ] inventario de TODOS los cortes booleanos (archivo:línea, qué corta, cuántas herramientas) en el CIERRE.
- [ ] la función + juez; los caminos migrados; tiempo antes → después (el híbrido no puede ser 10× más lento).
- [ ] prueba: las 4 piezas + el cubo, cero herramientas que no quitaron material; volumen de cada placa antes → después.
- [ ] estudio de contacto: residuo del agua contra sus barrenos antes (≤1.0) → después (<0.1).

## TOCA
- src/forja/mold/mold-plano-set.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/occt.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/timeline.ts
- src/forja/mold/mold-fea.ts
- src/forja/mold/curso-flow.ts
- ordenes/2026-09-22-el-corte-unico.md

## CREA
- public/evidencia/2026-09-22-el-corte-unico/resultados.json
- public/evidencia/2026-09-22-el-corte-unico/agua-A-barrenada-4-piezas.png

## BORRA
- (nada)

## ENMIENDA 2026-09-22 — entran 6 archivos al TOCA (declarados al abrir, como pide la orden)
- `src/forja/brep/occt.ts` — AQUÍ vive la función única `cortarHerramientas` + su juez + la bitácora. Es el kernel:
  lo importan TODOS los que cortan (estudio, plano-set vía `K`, timeline vía `K`, el estudio del CAD). Ponerla en
  mold-plano-set obligaba a occt/timeline/ForgeBRepStudio a importar el constructor del molde para cortar una bolsa.
  `drillHole` (occt) también pasa por ella.
- `src/forja/brep/useMoldStudio.ts` — la flecha del agua del estudio de contacto (ejercicio 3: 0.9 → 0.05 mm).
- `src/forja/brep/ForgeBRepStudio.tsx` — `applyPocket` (la bolsa del CAD) corta herramientas: pasa por la función.
- `src/forja/mold/timeline.ts` — la feature `pocket` (receta del molde) corta herramientas; `holes` ya entra vía `drillHole`.
- `src/forja/mold/mold-fea.ts` — el bolsillo de la cavidad del modelo FEA es una caja que se corta: pasa por la función.
- `src/forja/mold/curso-flow.ts` — `guiasCurso`: los barrenos escalonados de las guías del curso (antes `cut(fuse(a,b))`).
- CREA: la evidencia que la propia orden declara («tabla por pieza» + «captura del inserto con el agua A barrenada
  en las 4 piezas»): un JSON y UNA lámina con las 4 capturas, en la carpeta de evidencia de la orden (como las anteriores).

## PREEXISTENTE
- docs/CANON-VIDEO.md
- public/comando/comentarios.json
- public/comando/respuestas-comentarios.json
- src/cinematic/CinematicMolecule.tsx
- videos/tutorial-01-nota-de-venta.json
- videos/tutorial-02-alta-de-producto.json
- videos/tutorial-03-alta-de-cliente.json
- videos/tutorial-04-cotizacion.json
- videos/tutorial-05-facturacion-portal.json
- videos/tutorial-06-remision.json
- videos/tutorial-07-editar-nota.json
- videos/tutorial-08-orden-de-compra.json
- videos/tutorial-09-cancelar-nota.json
- videos/tutorial-10-registrar-pago.json
- videos/tutorial-11-factura-desde-erp.json
- videos/tutorial-12-factura-global.json
- videos/tutorial-13-rep-complemento-pago.json
- videos/tutorial-14-calculadora-precios.json
- videos/tutorial-15-nota-de-venta-pro.json
- videos/tutorial-16-detalle-de-producto.json
- videos/tutorial-18-ajuste-masivo-inventario.json
- videos/tutorial-20-pdf-imprimir.json
- videos/tutorial-21-nota-de-credito.json
- videos/tutorial-22-gasto-operativo.json
- videos/tutorial-23-alta-de-proveedor.json
- videos/tutorial-24-buscar-clave-sat.json
- videos/tutorial-25-reportes-jugosos.json
- ordenes/2026-09-22-el-corte-unico.md
- ordenes/2026-09-22-las-reglas-de-hefestos.md
- ordenes/2026-09-22-los-botadores-con-nombre.md
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- tabla por pieza: herramientas · racimos · herramientas sin material (antes → después = 0) · ms.
- ciclo-dado-test verde, tsc sin nuevos, orden-gate VERDE; captura del inserto con el agua A barrenada en las 4 piezas.

## CIERRE (2026-09-22 · MEDIDO, no contado)

### ORDEN vs ENTREGADO
| ejercicio | estado |
|---|---|
| inventario de TODOS los cortes booleanos | **HECHO** — tabla abajo (BASE 2438d60, archivo:línea, qué corta, cuántas herramientas, migrado o por qué no) |
| UNA función + juez; los caminos migrados | **HECHO** — `cortarHerramientas` en `occt.ts`. Pasan por ella: `buildPlateSolid` (UNA llamada por placa en vez de ~12 `try{cut}catch{}` + un compound), `cutAll`, `barrenarInsertos`, asientos/canales de corredera, rieles, anillo, bujes, talón, insertos genéricos, `drillHole` (y con él los barrenos del CAD y de la receta), la bolsa del CAD y de la receta, el bolsillo FEA, las guías del curso y la espiral |
| el juez: cada herramienta que toca quitó material, reintento, nunca `catch { return s }` mudo | **HECHO** — historia de la booleana por herramienta (~0 ms) + `vol(resultado ∩ herramienta)` para las sospechosas + reintento sola + invariantes globales (volumen entre 0 y la suma de herramientas; no aparecen sólidos de más). Bitácora `globalThis.__forjaCortes` + `console.warn('CORTE ✗ …')` |
| tiempo antes → después (no 10× más lento) | **CUMPLE** — igual o más rápido; el cubo 10× MÁS RÁPIDO (tabla) |
| 4 piezas + cubo: cero herramientas sin material; volumen de cada placa | **HECHO** — 0 cortes con falla en las 4 piezas (21 cortes cada una en la app) + cubo + flanera; volúmenes abajo |
| residuo del agua contra sus barrenos < 0.1 mm | **HECHO: 0** en las 4 piezas (antes 0.40 mm en las 4 y 39 mm³ · 1.51 mm en el ensamble) |

### LA CAUSA DE FONDO (medida, no supuesta)
Un **compound pasado como UNA herramienta** le promete a OCCT que sus piezas no se tocan entre sí. Brocas que se
cruzan (el anillo de agua, contrataladros concéntricos, cabezas de pines vecinos) rompen la promesa, y el resultado
sale con sólidos sueltos y acero que no se fue — o al revés, se come la placa:

| caso (medido en node sobre el acero REAL) | compound | lista (SetTools) | híbrido por racimos | una por una |
|---|---|---|---|---|
| cavidad carcasa, 8 brocas (circuito de ae41a29) | 6,851 mm³ · **3 sólidos** ✗ | 9,439 · 196 ms ✓ | 9,439 · 589 ms ✓ | 9,439 · 402 ms ✓ |
| núcleo carcasa, 17 brocas | 7,310 · 750 ms | 7,310 · 720 ms ✓ | 7,310 · 2,456 ms | 7,310 · 10,264 ms |
| cavidad 1557BGY hoy, 8 brocas | 11,065 ✗ | **VACÍO** (851,970 = el inserto entero) ✗ | 14,683 ✓ | 14,683 ✓ |
| cubo, placa B, 45 herramientas | **827,554** ✗ (2.8× de más: placa hueca) | 297,369 · 16.3 s ✓ | 297,369 · 3.3 s ✓ | 297,369 · 3.5 s ✓ |
| cubo, retenedora, 50 herramientas | 206,716 · 105 s ✗ | 26,648 · 118.6 s ✓ | 26,648 · 3.6 s ✓ | 26,648 · 3.3 s ✓ |

Ninguna estrategia sola es buena siempre → TRES intentos y un JUEZ que elige. El orden sale de la DENSIDAD de
cruces (más de 3 pares cruzados por herramienta → primero el híbrido; si no, la lista) — **regla de Hefestos**, de
rendimiento; la corrección la decide el juez, no la regla. Medido: cubo 14.4 y 3.8 pares/herr (el híbrido gana 30× y
5×); alta 2.1 y carcasa 1.4 (la lista gana 2.5× y 1.7×).

### EL CÓDIGO VIEJO, TRAZADO (envolví `K.cut` sobre main, sin tocar nada)
- **1599HBK**: la placa expulsora, el soporte y la placa B salían con **24 sólidos** — los barrenos quedaban como
  TAPONES de acero dentro de la placa (expulsora: quitó 12,215 de 181,079 mm³ de brocas).
- **El cubo**: la placa B quedaba en **286 mm³**, el soporte en 1,142, la expulsora y la retenedora **VACÍAS (0)**.
  Nadie lo veía: `catch {}` mudo, y el cubo no mide el volumen de sus placas.

### NÚMEROS — antes (main 2438d60) → después
Portamoldes (`buildMoldParts` 'full', node, `placas.cjs`) — volumen de malla por rol (misma teselación en las dos):

| pieza | ms | cortes · herramientas | fallas del juez | placas que cambiaron (mm³) |
|---|---|---|---|---|
| cubo | **131,639 → 13,070** | 19 · 216 | 0 | B 285 → 543,188 · soporte 1,139 → 805,636 · expulsora (no existía) → 282,632 · retenedora (no existía) → 189,631 |
| carcasa 1594C Box | 6,581 → 6,610 | 19 · 208 | 0 | ninguna (ya cortaba bien) |
| tapa 1594C Lid | 5,029 → 7,024 (ruido de iangpu: 5,355 / 8,398 / 7,024 en tres corridas de código equivalente) | 19 · 152 | 0 | ninguna |
| alta 1599HBK | 20,724 → 20,977 | 19 · 334 | 0 | B 3,524,748 → 3,491,203 · soporte 2,594,469 → 2,435,794 · retenedora 1,223,280 → 1,142,719 · expulsora 1,844,174 → 1,640,441 (se fueron los tapones de acero) |
| ensamble 1557BGY | 6,816 → 4,660 | 19 · 183 | 0 | ninguna |
| flanera (molde vivo, `cutAll`) | 9,398 → 10,011 | 33 · 248 | 0 | ninguna — pero el juez DICE que la geometría parte el núcleo (pregunta 1) |

La app (el ciclo de la pieza hasta la E8, `corte-vista.cjs`, estudio de contacto `moldSolidCollisions` crudo, con
colisiones Y ajustes):

| pieza | cortes del juez en la app | agua ↔ inserto antes | agua ↔ inserto después | barrenado E8 antes → después |
|---|---|---|---|---|
| carcasa | 21 · 0 fallas | 0 mm³ · 0.40 mm (A-sur, A-ext-in) | **0 pares** | 4,116 → 3,923 ms |
| tapa | 21 · 0 fallas | 0 mm³ · 0.40 mm | **0 pares** | 2,952 → 2,160 ms |
| alta | 21 · 0 fallas | 0 mm³ · 0.40 mm | **0 pares** | 3,060 → 2,844 ms |
| ensamble | 21 · 0 fallas | **39.3 mm³ · 1.51 mm** (A-norte) + 39.3 · 1.21 (A-este) + 0.40 ×2 | **0 pares** | 12,402 → 8,435 ms |

Acero quitado del inserto de cavidad: carcasa 16,916 → 17,093 · tapa 15,669 → 15,845 · alta 27,475 → 27,651 ·
ensamble 15,809 → 15,943 (+134 a +177 mm³ = la broca que pasa el cruce, abajo). Núcleos idénticos.

### EL RESIDUO DEL ENSAMBLE NO ERA EL AGUA: era un HOYO en la malla del inserto
Con el agua a 0.05 mm el ensamble seguía en 52 mm³ · 1.46 mm. En node, con el kernel: `vol(tramo ∩ inserto) = 0.00`
en los 6 tramos, pero la malla del inserto tenía **39 aristas abiertas** en la esquina norte-este (169.8–173,
169.8–173, z 216–223), donde DOS tramos MUEREN en el mismo punto. Más fino o más grueso no la cierra (0.01 mm → 76
aristas; 0.1 → 27). Con la broca pasando el cruce un radio: **0 aristas abiertas, 0 mm³, 0 mm**, y la lista vuelve a
servir en esa cavidad (3,196 ms vs 4,576 en la app). **Regla de Hefestos**: +r en cada extremo de agua compartido
por dos tramos (el libro no la da; la broca real, con su punta cónica, siempre pasa del eje que busca).

### INVENTARIO (BASE 2438d60)
Migrados a `cortarHerramientas`:

| archivo:línea | qué corta | herramientas |
|---|---|---|
| mold-plano-set.ts:124 · 136 · 154 · 167 · 185 · 205 · 246 · 247 · 270 · 284 · 299 · 307 · 310 (+313 fallback `drillHole`) | `buildPlateSolid`: ranuras de sujeción, holguras de pilares, bores del stripper, agua del soporte, bolsa del inserto, agua A/B, asiento del buje + brida, hombro del poste, cabezas en la retenedora, cabezas SHCS, caja del sprue bushing, barrenos estándar + interlocks | ahora UNA llamada por placa: 23–91 |
| mold-plano-set.ts:634 | ID del buje guía | 1 por buje |
| mold-plano-set.ts:931 · 948 | impresión del inserto genérico · hueco del macho en la pieza | 1 · 1 |
| mold-plano-set.ts:982 (`cutAll`) | insertos reales (flanera): guías, colada, agua, pines, retornos | 8 por celda (cavidad) · ~8–20 (núcleo) |
| mold-plano-set.ts:1289 | talón de la corredera | 1 |
| mold-plano-set.ts:1346 | barrenos del riel | los tornillos de ese riel |
| mold-plano-set.ts:1367 · 1375 | anillo centrador · sprue bushing | 1 · 1 |
| mold-plano-set.ts:1481 · 1500 | asiento del inserto + canal de corredera en A/B | UNA llamada: celdas + canales |
| estudio-molde-datos.ts:1999 · 2003 | `barrenarInsertos` (el híbrido que nació aquí) | cavidad 8–16 · núcleo 16–20 |
| estudio-molde-datos.ts:2915 | espiral de enfriamiento | 1 |
| occt.ts:1311 `drillHole` | un barreno — y por él: ForgeBRepStudio.tsx:442 · 742 · 745 · 998 y timeline.ts:168 | 1 |
| ForgeBRepStudio.tsx:1076 `applyPocket` · timeline.ts:175 `pocket` · mold-fea.ts:41 | bolsa del CAD · de la receta · bolsillo FEA | 1 |
| curso-flow.ts:310 · 312 | guías del curso (antes `cut(fuse(pasante, caja))`) | 2 por guía |

No migrados (NO son herramientas de barreno/caja — se dice por qué):
- parting.ts:213 · 226 · 227 · 293 · 305 y mold.ts:154 · 156 · 196 · 199 · 200 — `splitMold`: tallar la impresión
  (bloque − pieza) y partir el molde. Ya tienen su juez: la E3 exige cuerpos = 2 y Σ cavidad+macho+pieza = bloque.
- curso-flow.ts:105 · 237 — la percha (common) y el split multi-cuerpo (tallado, ya secuencial).
- estudio-molde-datos.ts:1716 · 1733 · 2287 (forma del dado), 2087 · 2093 (rebanadas para MEDIR el draft), 2293 (common de verificación).
- useMoldStudio.ts:67 (el dado), 1949 (common de verificación), 2110 (fuseAll del disparo).
- ForgeBRepStudio.tsx:1159 · 1160 · 4319 · 4320 · 4331 · 4333 · 4336 — booleanas del ÁRBOL del usuario (unir/restar/
  restar-de/común entre cuerpos); 1380–1498 generadores del mecanismo cicloidal; 1684 · 1700 fuse; 1742 · 1879
  common de interferencia de engranes. No son acero del molde.
- colada.ts:292, mold-fea.ts:36 · 37, timeline.ts:161, thread.ts:107 · 123, din-bolt.ts:33, occt.ts:496 · 712 — uniones y sondas.

### EL CUBO — sin ACTA
`ciclo-dado-test.cjs`: **266/266** (corrida final, después del último cambio; 0 renglones `CORTE ✗` en su log). No
se cambió ningún literal del cubo. (Sus placas del portamoldes SÍ cambiaron — de vacías a enteras — pero el cubo no
las mide: pregunta 3.)

### GATES
- tsc (forja-dev6): 67 errores = los 66 de la base + `src/comando/Logos.tsx: Cannot find namespace 'JSX'`, que ya
  viene en main 2438d60 (LA CARA DE GAIA, no es de esta orden). **0 nuevos de esta orden.**
- `mold-timeline-test.cjs` ✓ y `tupper-test.cjs` ✓ (la bolsa y los barrenos de la receta pasan por el juez).
- `orden-gate.cjs`: VERDE. Sin deploy, sin push, sin video.

### EVIDENCIA
- `public/evidencia/2026-09-22-el-corte-unico/resultados.json` — estrategias medidas, trazas del código viejo, las 6
  corridas del portamoldes (volúmenes y bitácora) y las 4 piezas en la app (antes/después, telemetría E8, cortes).
- `public/evidencia/2026-09-22-el-corte-unico/agua-A-barrenada-4-piezas.png` — el inserto de cavidad translúcido con
  el anillo de agua A por sus barrenos, en las 4 piezas.
- En iangpu `/home/ian/el-plan-dev6/`: `placas-{antes,despues}.json`, `cu-{antes,despues}-<pieza>/`, `juez2.log`,
  `cubo-final.log`, y los arneses `placas.cjs`, `corte-vista.cjs`, `prueba-malla.cjs`, `traza-viejo.cjs`, `cubo-placas.cjs`.

### VISTO, ES DE OTRA ORDEN (no se tocó)
- `src/comando/Logos.tsx` rompe tsc (JSX) — es de LA CARA DE GAIA.
- Los return pins que no caben fuera del inserto (carcasa, tapa, ensamble; en el cubo cabría hasta ⌀6.0) — siguen
  avisando; es de LOS INSERTOS SE BARRENAN / la pila (su pregunta 1, abierta).

### PREGUNTAS PARA IAN
1. **El núcleo de la flanera sale en dos pedazos.** En el molde de demostración de la flanera (4 cavidades), al
   barrenar el inserto de núcleo con las guías, el agua y los retornos, un trozo de acero queda SUELTO: el juez lo
   confirmó con dos métodos distintos — 172,285 + **23,709 mm³** en dos de las cuatro celdas; la placa B también
   suelta un pedazo de 5,734 mm³. Un pedazo suelto es un inserto que no se puede fabricar (se cae al maquinarlo).
   Hoy el molde lo dice en la bitácora y sigue. ¿Abrimos orden para que las guías y el agua de la flanera no crucen
   su inserto así? Recomiendo **sí**: el juez ya no lo deja pasar callado, y la flanera es la que se enseña.
2. **La broca que pasa la esquina.** Donde dos líneas de agua se encuentran y las dos terminan en el mismo punto, el
   barreno ahora sigue 3.2 mm (un radio) más allá del cruce — como la broca real, cuya punta siempre pasa. Cuesta
   +134 a +177 mm³ de acero por inserto y quita un «agua dentro del acero» falso de 39 mm³ · 1.5 mm que el estudio
   veía en la caja de 19 sólidos. ¿La dejamos como regla de Hefestos? Recomiendo **sí**.
3. **Las placas del cubo estaban vacías y ningún check lo veía.** En el portamoldes del cubo, la placa B medía 286 mm³
   (debe ser 543,188), el soporte 1,142 (debe ser 805,636) y las dos placas del expulsor no existían. Hoy están
   completas, y el cubo arma su portamoldes en 13 s en vez de 132 s. Los 266 checks pasaron antes Y después: no miden
   el volumen de sus placas. ¿Le agrego al cubo un check «cada placa pesa lo que su caja menos sus barrenos» (sería
   el 267, va como ACTA R94)? Recomiendo **sí**: es justo el tipo de falla muda que esta orden vino a matar.

### ARCHIVOS TOCADOS (para la fusión)
- `src/forja/brep/occt.ts` — `cortarHerramientas` + `ReporteCorte` + `bitacoraDeCortes` (nuevas, junto a `common`); `drillHole` pasa por ella.
- `src/forja/mold/mold-plano-set.ts` — `buildPlateSolid` (herramientas en lista, UNA llamada; devuelve además `corte`), `cutAll`, bujes, insertos genéricos, talón, rieles, anillo, asiento + canal. Import de TIPO de occt.
- `src/forja/mold/estudio-molde-datos.ts` — `barrenarInsertos`: etiquetas por broca, la broca que pasa el cruce, el corte vía `cortarHerramientas` (sale `cortes` en el resultado); `espiralAcero`. (Región distinta de la del macho y la de los botadores.)
- `src/forja/brep/useMoldStudio.ts` — `AGUA_FLECHA_MM = 0.05` (agua, tapones, O-rings: 3 sitios × 2 ciclos).
- `src/forja/brep/ForgeBRepStudio.tsx` — `applyPocket` + el import.
- `src/forja/mold/timeline.ts`, `src/forja/mold/mold-fea.ts`, `src/forja/mold/curso-flow.ts` — una línea cada uno (+ import en curso-flow; se fue `fuse`).
- `ordenes/2026-09-22-el-corte-unico.md` — BASE, enmienda y este cierre.
- `public/evidencia/2026-09-22-el-corte-unico/` — 1 json + 1 png.
