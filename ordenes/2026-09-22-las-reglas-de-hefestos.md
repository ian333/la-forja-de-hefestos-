# ORDEN: LAS REGLAS DE HEFESTOS — la placa que se dobla guarda margen, los retornos caben y lo que es nuestro se llama por su nombre

ESTADO: listo-para-fusion
PRIORIDAD: 2

BASE: 2438d60

OBJETIVO: aplicar las decisiones que ian firmó el 2026-09-22 (ACTA R93, preguntas 3 y 6, y el nombre): (a) la placa soporte
se dimensiona para doblarse **≤ 70 % del venteo por defecto, con tope duro de 85 %**; (b) los pines de retorno ⌀12 que no caben
fuera del inserto se resuelven **creciendo la placa expulsora**; (c) toda regla nuestra (sin número en Kazmer) se rotula
**«regla de Hefestos»** en pantalla, láminas y contratos — no «regla nuestra», no «de GAIA».

## DECISIÓN DE IAN (literal, 2026-09-22)
- Pregunta 3 (la placa que se dobla, hoy 0.0191/0.020 mm = 96 % en la base 396×296): «me mama… yo pondría default 70 como límite 85,
  ME GUSTA COMO REGLA DE HEFESTOS, no de gaia… acá es Hefestos el muchacho».
- Pregunta 6 (retornos ⌀12 no caben: banda 16.5 / 26 mm, piden 36 — carcasa y tapa): «sí» a «crece la expulsora».

## YA-EXISTE (prueba de ausencia)
- `platesizing.ts` `optimizeSupportPlate` / `sizeSupportPlate`: elige por acero mínimo con `flashOk = deflex ≤ venteo` (sin margen).
- `mold-contratos.ts:622` compara `flashOk` contra su propia medición (dos verdades → una).
- «REGLA NUESTRA» vive hoy en `cooling-design.ts:64` (piso maquinable), `estudio-molde-datos.ts` (equilibrio 0.1·L, filas del
  estudio), `ForgeBRepStudio.tsx:4047`, `eject-layout.ts` (el 0.1·L — ESE lo rotula la orden de LOS BOTADORES CON NOMBRE, no esta).
- Retornos: ver la orden cerrada LOS INSERTOS SE BARRENAN, pregunta 1, y la 2.4 del inspector (carcasa y tapa).

## EJERCICIOS
- [ ] soporte: factor de venteo 0.70 default / 0.85 tope, UNA constante con su rótulo «regla de Hefestos» y su razón; el optimizador
      elige el acero mínimo que cumple 70 %; si ninguna opción cumple 85 % el molde lo DICE (no lo esconde). 396×296 y las 4 piezas: antes → después.
- [ ] el contrato de mold-contratos mide contra la MISMA constante (una sola verdad).
- [ ] retornos: la placa expulsora crece lo necesario para que el retorno ⌀12 quede fuera del inserto con su holgura; 2.4 de carcasa y tapa ✓.
- [ ] rótulo: cada «regla nuestra / REGLA NUESTRA» fuera de eject-layout pasa a «regla de Hefestos» (UI, láminas, contratos, comentarios).
- [ ] cubo: si cambian literales, lista ACTA R94 en el CIERRE (check · viejo · nuevo · por qué).

## ENMIENDA 2026-09-22 (el agente, al abrir — MEDIDO antes de tocar)

**Lo que midió el «antes»** (node, mismo camino que `verif-pieza.cjs` hasta E2; `/home/ian/el-plan-dev4/hefestos/antes/`):
- Las 4 piezas eligen HOY 22 mm con 1 pilar (carcasa, tapa, ensamble) y 3 pilares (1599HBK): **28.5 / 17.5 / 65.5 / 23.5 %**
  del venteo. El 96 % de la pregunta 3 (0.0191/0.020, 4 pilares, 396×296) salió de una carga de prueba de LA CARRERA CABE,
  no del paquete de la pieza: se reproduce aparte como caso sintético.
- **Dos venteos**: el dimensionador usa 0.020 (su default) y el contrato estructural compara contra el venteo de la E7
  (`ventDesign.hSpecMm` = **0.046–0.063 mm** en las 4 piezas). Coinciden solo porque ninguna placa cae entre los dos. Eso
  es lo que el ejercicio 2 llama «una sola verdad» y entra `moldmachine.ts` (la única llamada al optimizador del paquete).

**Entran al TOCA, y por qué:**
- `src/forja/mold/moldmachine.ts` — la llamada a `optimizeSupportPlate` pasa el venteo de referencia (el MISMO que juzga el contrato).
- `src/forja/mold/estudio-molde-datos.ts` — la fila «ALARMA MAESTRA (R70)» de la estación 11 juzga con la regla de Hefestos;
  y el rótulo del comentario de tapones (§9.2.6). Regiones E11 y 3b, no las de E3/colocación/barrenado de las otras órdenes.
- `src/forja/mold/mold-drawing-set.ts` — `expulsoraMargenes` (la expulsora CRECE en Y; es donde viven los márgenes y
  `returnPinLayout`), la lámina de la expulsora/retenedora a su tamaño real, y un rótulo.
- `src/forja/mold/mold-plano-set.ts` — el sólido de la expulsora (`buildPlateSolid`) y sus bloques (`portamoldesEnBloques`) leen los
  márgenes crecidos; un rótulo (+8). Regiones distintas de `cutAll` (EL CORTE ÚNICO).
- Rótulos «regla de Hefestos» (UI / comentarios): `src/forja/mold/thermal-steady.ts`, `src/forja/mold/plate-cost.ts`,
  `src/forja/brep/useMoldStudio.ts` (aviso §5.1), `src/forja/brep/ForgeBRepStudio.tsx` (comentario del +8), `scripts/inspecciona-molde.cjs`.
- `scripts/mold-platesizing-test.cjs` — reproduce el bezel del libro con `factorVenteo: 1` y agrega los checks de Hefestos
  (el check `s0Placa176` exigía el límite pelón del libro como default).
- `scripts/ciclo-dado-test.cjs` — solo si el cubo cambia (ACTA R94).
- **CREA** la evidencia: `public/evidencia/2026-09-22-las-reglas-de-hefestos/resultados.json` + capturas.

## TOCA
- src/forja/mold/platesizing.ts
- src/forja/mold/mold-contratos.ts
- src/forja/mold/cooling-design.ts
- src/forja/mold/moldmachine.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/mold-plano-set.ts
- src/forja/mold/thermal-steady.ts
- src/forja/mold/plate-cost.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/inspecciona-molde.cjs
- scripts/mold-platesizing-test.cjs
- scripts/ciclo-dado-test.cjs

## CREA
- public/evidencia/2026-09-22-las-reglas-de-hefestos/resultados.json
- public/evidencia/2026-09-22-las-reglas-de-hefestos/retornos-fuera-del-inserto.png
- public/evidencia/2026-09-22-las-reglas-de-hefestos/tarjetas-2.4.png

## BORRA
- (nada)

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
- ordenes/2026-09-22-las-reglas-de-hefestos.md
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- flecha/venteo de la placa soporte en las 4 piezas antes → después (≤ 70 %), con la base elegida.
- inspector 2.4 en carcasa y tapa ✓ (tarjeta), ciclo-dado-test verde (o ACTA R94), tsc sin nuevos, orden-gate VERDE.
- grep: cero «regla nuestra» fuera de eject-layout/equilibrio; las explicaciones al estilo de feedback_explicar_el_molde.

## ENMIENDA 2 · 2026-09-22 (a medio camino, MEDIDO): el cruce del agua B también se corre
La 1a corrida del inspector DESPUÉS de crecer la expulsora dio en la carcasa **2.5 ✗: agua-B-cruce-cerca-1 ↔ pines-retorno
2.65 mm** (antes ✓). Causa: los cruces del serpentín B vivían en `y = 20 / L−20` clavados (`estacion8Circuito`) y nunca
esquivaban nada — las LÍNEAS sí se corren en X para librar barrenos (§9.2.7, estrategia B), el cruce que las une no. Al sacar
el retorno del inserto cae en y ≈ 18.5, encima del cruce. Se arregla en su fuente: cada cruce busca el corrimiento MÁS CHICO en
Y con ½⌀ contra los barrenos de su franja y contra las paredes del bolsillo del inserto (§9.2.7 «any other mold component»).
Mismo archivo (`estudio-molde-datos.ts`, ya en el TOCA), región `estacion8Circuito`: ninguna de las otras 3 órdenes la toca.

## CIERRE (2026-09-22 · MEDIDO, no contado)

### ORDEN vs ENTREGADO
| ejercicio | estado |
|---|---|
| soporte: 70 % default / 85 % tope, UNA constante rotulada, el optimizador elige el acero mínimo al 70 %, si nada da el 85 lo DICE | **HECHO** · `REGLA_DE_HEFESTOS_FLECHA` + `juicioFlecha` (platesizing.ts); `sizeSupportPlate` despeja el espesor para 0.70·venteo; `optimizeSupportPlate` en escalones defecto → tope → «ninguna» con nota escrita |
| el contrato mide contra la MISMA constante | **HECHO** · `contratoEstructural` juzga con `juicioFlecha` y `venteoDeReferenciaMm`; y el dimensionador del paquete (`moldmachine`) recibe ESE mismo venteo — antes eran dos (0.020 vs 0.046–0.063 de la E7) |
| retornos: la expulsora crece lo necesario; 2.4 de carcasa y tapa ✓ | **HECHO** · `expulsoraMargenes` (crece en Y; en X no se puede: rieles). 2.4 **✗ → ✓** en carcasa y tapa, en la APP |
| rótulo «regla de Hefestos» fuera de eject-layout | **HECHO** · grep abajo |
| cubo: ACTA R94 si cambian literales | **no hace falta**: 266/266 sin tocar un literal (sí se mueve su geometría, ver abajo) |

### 1 · LA PLACA QUE SE DOBLA (node, mismo camino que el estudio hasta E2 · `hefestos/antes|despues/*.json`)
| pieza | base | antes | después |
|---|---|---|---|
| carcasa 1594C Box | 246×246 | 22 mm · 1 pilar · 0.0057 mm = **28.5 %** | igual · **CUMPLE** (t requerido 14.5 → 16.3, cae en el mismo 22) |
| tapa 1594C Lid | 246×196 | 22 · 1 · 0.0035 = **17.5 %** | igual · CUMPLE |
| alta 1599HBK | 396×296 | 22 · 3 pilares · 0.0131 = **65.5 %** | igual · CUMPLE (19.1 → 21.5, sigue en 22) |
| ensamble 1557BGY | 246×246 | 22 · 1 · 0.0047 = **23.5 %** | igual · CUMPLE |
| **el caso del 96 %** (396×296 con la carga de LA CARRERA CABE, 150.3 t) | 396×296 | 22 mm · 4 pilares · 0.0191 = **95.5 %** (hoy: VIOLA el tope) | **27 mm** · 4 pilares · 0.0103 = **51.5 %** · acero 13.9 → 16.7 kg |
| el bezel del libro (200 t, sin pilares) | — | 176 mm (δ ≤ venteo) | **196 mm** por defecto; con `factorVenteo: 1` sigue dando el 176 del libro |

**Ninguna de las 4 piezas reales cambia de placa**: el 96 % de la pregunta 3 salió de una carga de prueba, no del paquete de
la pieza; las 4 ya estaban bajo el 70 %. La regla muerde donde debe (el caso del 96 % pasa de 22 a 27 mm) y no toca lo que ya
tenía margen. **Las dos verdades del venteo**: la E7 especifica 0.046–0.063 mm (el aire de piezas grandes pide ranuras más
hondas) y el dimensionador usaba 0.020. Ahora los dos leen `venteoDeReferenciaMm` = la más estricta (0.020 en las 4 piezas y
en el cubo).

### 2 · LOS RETORNOS (node + APP real con el inspector de 17 puntos; ANTES = el código de BASE servido en la misma copia)
| pieza | expulsora (placa) | claro retorno ↔ inserto | inspector 2.4 | 2.5 | fallas del inspector |
|---|---|---|---|---|---|
| carcasa | 116×206 → **116×246** (margen Y 20 → 0) | −6 → **12 mm** | 15,000 mm³ · 5.3 mm **✗ → ✓** | ✓ → ✓ | **2 → 1** |
| tapa | 116×156 → **116×178** (20 → 9) | −6 → **12** | 3,328 mm³ · 2.71 mm **✗ → ✓** | ✓ → ✓ | **2 → 1** |
| ensamble | 116×206 → 116×214 (20 → 16) | 0 → **12** (ya no tocaba, pero sin su claro) | ✓ → ✓ | ✓ → ✓ | 1 → 1 |
| alta | sin cambio (ya cabía) | 12 → 12 | ✓ → ✓ | ✗ → ✗ (visto, abajo) | 6 → 6 |

Colisiones reales que desaparecen (app): carcasa `nucleo↔pines-retorno` 15,000 mm³ y los dos `cruce↔interlocks`; tapa
`nucleo↔pines-retorno` 3,328 mm³ y `cruce-lejos↔interlocks` 492 → 293 mm³. Cruces corridos: carcasa cerca-1 y 20 → 43 y
lejos-2 226 → 203 (entran al inserto, lejos de su pared); tapa 20 → 15.5 y 176 → 180.5; cubo 20 → 7.5 y 176 → 188.5.
**El agua dentro del inserto está barrenada de verdad**: intersección EXACTA del kernel (`common`) de cada segmento B con el
núcleo de la carcasa después de `barrenarInsertos` = **0 mm³ en los 9** (el cruce-cerca-1 compartía 1,608.8 mm³ antes de
barrenar). Lo que el estudio de contacto todavía dibuja (`nucleo↔cruce-cerca-1` 1.47 mm, `nucleo↔linea2` 1.28 mm) es malla
del agua (flecha 0.9 mm) — exactamente lo que EL CORTE ÚNICO va a teselar más fino.

### 3 · EL CUBO (266/266, sin ACTA R94)
Ningún literal del test cambió. Sí se mueve su geometría, y para bien: sus retornos **cruzaban el inserto** (claro −6 mm, nadie
lo medía); ahora su expulsora crece 156 → 192 mm en Y y quedan a 12 mm. Sus cruces se corren (arriba). El juez del agua del
cubo sigue en 4 rojos de retorno — los mismos 4 que en BASE (la línea central pasa ENTRE dos retornos a 14 mm; visto, abajo).
Vaso y jabonera crecen igual (margen 20 → 2 y 20 → 17).

### 4 · EL RÓTULO
`grep -rniE "regla(s)? nuestra|declarad[oa] nuestr|extensi[oó]n nuestra|es nuestr|son nuestr|cota nuestra|\+8 nuestro"` sobre
`src` y el inspector → solo quedan `eject-layout.ts:268/323`, `estudio-molde-datos.ts` (4 líneas del equilibrio) y
`ForgeBRepStudio.tsx:4047`: todos son el 0.1·L del EQUILIBRIO → **visto, es de LOS BOTADORES CON NOMBRE**. Pasaron a «regla
de Hefestos»: platesizing (fracciones del paquete, descanso 4, holgura 2, +8), cooling-design (piso maquinable, interpolación
del SCF), mold-contratos (piso 20 MPa), mold-drawing-set (claros del retorno), thermal-steady, plate-cost (texto de la BOM),
useMoldStudio (aviso §5.1), mold-plano-set y ForgeBRepStudio (+8), inspecciona-molde (7.1 y la cota del balance).

### GATES
- `ciclo-dado-test`: **266/266** (corrida DESPUÉS del último cambio).
- `mold-platesizing-test`: **21/21** (checks nuevos de Hefestos; el bezel del libro se reproduce con `factorVenteo: 1`).
- tsc en iangpu: 67 = los 66 de la base + **1 ajeno**: `src/comando/Logos.tsx: Cannot find namespace 'JSX'` (entró a main con
  LA CARA DE GAIA; no lo toqué). Cero errores nuevos en lo mío.
- `orden-gate.cjs`: VERDE. Sin deploy, sin push, sin video.

### EVIDENCIA
- `public/evidencia/2026-09-22-las-reglas-de-hefestos/resultados.json` — soporte (4 piezas + opciones + caso 96 %), retornos,
  inspector antes/después por pieza, el cubo, el agua exacta, la corrida que cazó el cruce.
- `tarjetas-2.4.png` — 2.4 ANTES/DESPUÉS en carcasa y tapa (✗ → ✓). `retornos-fuera-del-inserto.png` — 2.5 de carcasa y tapa
  DESPUÉS + 2.4 de ensamble y alta.
- En iangpu `/home/ian/el-plan-dev4/hefestos/`: `antes-*/` y `despues-*/` (inspector completo con tarjetas), `despues1-carcasa/`
  (la corrida que cazó el cruce), `*-sonda-*/sonda.json` (geometría de expulsora, retornos, agua), `caso-96.json`,
  `exacto-agua-carcasa.json`, `cubo.log` / `cubo-base.log`.

### VISTO, ES DE OTRA ORDEN (no lo toqué)
- El 0.1·L del equilibrio (rótulos) y 2.3 pin↔agua en tapa y alta → LOS BOTADORES CON NOMBRE.
- 1.1 / 6.1 / 6.2 de la alta (el macho no sube) → EL MACHO DE LA CAJA GRANDE.
- Residuo de malla del agua en el estudio de contacto (1.28–1.47 mm con 0 mm³ exactos) → EL CORTE ÚNICO.
- **Sin orden abierta:** (a) los `interlocks` chocan con el agua B en las 4 piezas (766 / 293 / 1,508 / 562 mm³): los coloca
  `planInterlocks` y el agua no los ve (no están en `standardHoles`). (b) En la alta las líneas 0 y 4 pasan a 1.5 / 1.1 mm de
  los retornos (igual en BASE): la búsqueda de la línea en X no halla hueco. (c) En el cubo la línea central pasa entre dos
  retornos a 14 mm (expulsora de 66 mm en X con margen fijo de 65). (d) `lamina-seccion.ts` (`mEj = 8`) y el esquema de
  `mold-assembly.ts` dibujan la expulsora con sus propias cotas. (e) La boca de cada cruce se taladra desde el canto y ese
  tramo no se modela ni se juzga.

### PREGUNTAS PARA IAN
1. **La placa de los botadores llega al borde del molde (carcasa).** Para que los pines de retorno salgan del bloque que forma
   la pieza, la placa que empuja los botadores creció a lo largo hasta quedar al ras del molde por los dos lados abiertos (de
   206 a 246 mm en una base de 246). No choca con nada — por esos lados la caja está abierta —, pero ya no le queda ceja de
   acero. Hoy: **0 mm** de ceja en la carcasa, 9 en la tapa, 16 en el ensamble (antes 20 en todas). **¿Aceptamos la placa al
   ras, o en ese caso crece la base?** Recomiendo aceptarla: crecer la base sube de talla el molde entero.
2. **Contra qué rendija se mide la placa que se dobla.** Las ranuras por donde sale el aire se diseñan de 0.05 mm en estas
   piezas porque el aire lo pide, pero el resto de la partición cierra a 0.02 mm. La placa hoy se juzga contra **0.02** (la más
   estricta); contra 0.05 podría salir más delgada o con menos pilares. **¿Seguimos midiendo contra 0.02?** Recomiendo que sí:
   la rebaba sale por cualquier punto de la partición, no solo por las ranuras.
3. **El agua se mete bajo la pieza (carcasa).** Al sacar los retornos, dos de los tubitos que conectan las líneas de agua ya no
   cabían entre el retorno y el borde, y se movieron DENTRO del bloque que forma la pieza: a 43 mm del borde en vez de 20. Enfría
   igual o mejor (pasa más cerca del plástico) y el bloque ya sale barrenado — medido: 0 mm³ de acero en el camino. **¿Te late
   así, o esos tubitos nunca deben entrar al bloque?** Recomiendo dejarlo: la otra salida es alejar los retornos de las esquinas.

### ARCHIVOS TOCADOS (para la fusión)
`src/forja/mold/platesizing.ts` · `src/forja/mold/mold-contratos.ts` · `src/forja/mold/moldmachine.ts` ·
`src/forja/mold/estudio-molde-datos.ts` (import línea 38 · comentario de tapones ~1954 · **cruces en `estacion8Circuito`
~3872–3920** · fila E11 del soporte ~4430–4510) · `src/forja/mold/mold-drawing-set.ts` (`expulsoraMargenes`, `returnPinLayout`,
lámina de expulsora/retenedora) · `src/forja/mold/mold-plano-set.ts` (import, `buildPlateSolid` ~130, `portamoldesEnBloques`
~1433, comentario ~1657) · `cooling-design.ts` · `thermal-steady.ts` · `plate-cost.ts` · `src/forja/brep/useMoldStudio.ts` (un
texto) · `src/forja/brep/ForgeBRepStudio.tsx` (un comentario) · `scripts/inspecciona-molde.cjs` · `scripts/mold-platesizing-test.cjs`
· `ordenes/2026-09-22-las-reglas-de-hefestos.md` · `public/evidencia/2026-09-22-las-reglas-de-hefestos/` (CREA).
RIESGO DE FUSIÓN: el import de la línea 38 de estudio-molde-datos (EL CORTE ÚNICO importa ahí también) y `returnPinLayout` /
`standardHoles` en mold-drawing-set si LOS BOTADORES tocan esa zona — regiones distintas, resolución a mano de una línea.
