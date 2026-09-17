# ORDEN: EL ENFRIAMIENTO SE VE — la escala con segundos junto a la pieza, y la pieza enfriándose en el tiempo

BASE: cd0c6b3

OBJETIVO: ian (2026-09-10): «aún no se puede cerrar el happy path si no veo una simulación real de la temperatura y el
enfriamiento… no me gustan los colores que usa, no entiendo, solo veo que cambia de color: falta la referencia
visual, o la simulación en el tiempo; nada de pantallas fijas». Hoy la lente ENFRIAMIENTO pinta el tiempo que
tarda cada punto en estar firme, sin escala a la vista y sin tiempo corriendo: un lila uniforme. Al final de
esta orden (DOS golpes, uno por día): (1) LA ESCALA — una barra de color con segundos, fija junto a la pieza,
y el campo mapeado a ella, con el punto que manda marcado; (2) EL TIEMPO — play: la pieza se enfría en pantalla
de 0 a su ciclo con el reloj corriendo, hasta que solo queda caliente el punto que manda. El runner exige
MOVIMIENTO (dos capturas a 1 s son distintas) y la escala presente. El paso 3 del camino cambia su promesa y
queda «a medias» hasta que esto exista (dicho, no fingido).

## LO QUE SE MIDIÓ AL ABRIR (2026-09-14, antes de tocar código)
- Revisión a ojo de la captura del paso 3 (runner 2026-09-10 22:03, 1600×1000): la «escala» son tres cuadritos de 14×8 px
  a 9.5 px en la tira de abajo, lejos de la pieza; la carcasa es lila parejo; el brillo blanco no es «un solo punto»
  como dice la ficha: es media cara degradada.
- Sonda numérica en node (misma carcasa, mismo `mallaDesdeArchivo` del drop, mismo `lentesDelFoco`): **el color miente
  por interpolación de triángulos grandes**. La malla del kernel trae aristas p90 21.5 mm y máx 115.5 mm contra celdas de
  1.4 mm; el color se pone por vértice y se degrada a lo largo de caras enteras. Superficie pintada «tarde»
  (color ≥ 60 % de la rampa): **16.6 %**; superficie tarde según el campo muestreado fino en cada triángulo: **2.2 %**.
  **34 %** del área tiene el color equivocado por más de un cuarto de la rampa. Una escala encima de eso sería una
  leyenda que miente en un tercio de la pieza → el golpe 1 empieza por pintar EL CAMPO por fragmento.
- El campo es bimodal: la mitad de la pieza a 15.9 s (p50 = mínimo) y los postes de esquina macizos a 233 s (p95 = máximo).
- La lente usa `ABS_KAZMER` por defecto; el intake de la carcasa es PP. Hallazgo registrado aquí, no se toca en esta
  orden (un cambio a la vez): va al CIERRE como pregunta.

## GOLPE 1 · LA ESCALA (2026-09-14, hecho y medido; el golpe 2, EL TIEMPO, sigue)
Tres cambios, cada uno medido antes del siguiente (triptico en `pintura-antes-despues.png`):
1. **El campo se pinta por PÍXEL, no por vértice.** `foco-lentes.ts` empaqueta el t_c en una textura 3D (R = valor
   normalizado, G = hay dato, orilla de 2 celdas hacia el acero) más la LUT de `colorDe`; `SolidMesh` lo muestrea en un
   `shaderMaterial` sin conversión de color, así la escala DOM (mismos bytes) describe lo pintado. Emulado en node
   sobre los mismos puntos finos: pintado «tarde» 16.6 % → **2.2 %** (= real), área con color equivocado 34.1 % →
   **0.3 %**, error medio 0.224 → **0.006** de la rampa. Luz de cámara que solo atenúa (70-100 %) para que la forma
   se lea; rampa térmica del cubo (azul listo pronto → rojo detiene el ciclo) en vez del violeta.
2. **La rejilla se afina a la pared.** El color honesto destapó que el CAMPO mentía: pared exacta por rayos 3.1 mm,
   espesor del vóxel 2.75 mm a media altura y 5.5 mm abajo (celda 1.375 mm), 37 % de los vóxeles inflados >1.5×.
   Barrido medido: celda 0.98 → 3.91 mm; 0.84 → 3.35 mm; **0.80 → 3.2 mm, 5.7 % inflado (los postes de verdad)**.
   Regla nueva: ≥4 celdas por pared estimada como 2·V/A (2.87 mm), tope 460 000 vóxeles. Declarado en el navegador:
   **2.0-2.1 s** (presupuesto del paso 3: 2.5 s). Consecuencias medidas: t_c p50 15.9 → **21.5 s** (Eq 9.5 con 3.1 mm:
   20.2 s); lo más lento 233 → **134 s**; la pared que la lente le da al molde 2.75 → **3.2 mm** (el kernel mide 3.109).
2b. **El frente no se paga dos veces.** En el paseo (grabando) la lente declaró 3.2 s. Por etapa, a 0.8 mm: vóxelizar
   0.85 s · distancia 0.1 · espesor local 0.05 · Dijkstra del frente 1.4 s (extracción del mínimo lineal). La lente
   corre ahora dos campos: el fino SIN frente (pared, enfriamiento) y el de siempre a 90 000 vóxeles con su Dijkstra
   (llenado, inalcanzables, avisos). A/B contra HEAD en tres piezas: la lente de LLENADO sale idéntica (0 valores y 0
   colores distintos, misma marca, mismo titular). Tiempo en node: carcasa 2.35-2.65 → **1.55-1.68 s**; tapa 0.87-0.91 s;
   rpi4 0.85 s. E4/E5/dictamen no pasan la opción: su campo no cambia.
3. **La marca cae donde se ve.** El máximo del campo son vóxeles a 0.4 mm de la cara inferior, bajo los 4 postes:
   la marca se dibujaba a través de la pared sobre una esquina azul. Ahora la lente da los vértices más lentos
   (superficie) y la escena elige, con un rayo desde la cámara, el que no tiene nada delante; la ficha dice
   «lo más lento: 134 s, en 4 lugares iguales» (antes «un solo punto»).
- La ESCALA: barra de 320 px junto a la pieza (proyecta la caja cada cuadro), marcas lineales en segundos
  (10.8 · 41.7 · 72.6 · 104 · 134 s), «◀ lo más lento: manda el ciclo» arriba y «◀ la mitad de tu pieza ya está
  firme» en el p50. `testid escala-enfriamiento` con `data-lo/hi/marcas`.
- números (corrida final 2026-09-14 22:38 UTC, dev :5194 iangpu): **6/8 · paso 3 = 5/6** (antes 4/6: p3-5 escala verde;
  p3-6 movimiento rojo = golpe 2) · lente **1.6 s declarados** en la medición Y en el paseo grabando (la corrida con el
  campo fino de un solo pase declaró 3.2 s grabando) · paso 6 con pared 3.2 mm sin regresión · 7 y 8 igual · GLITCH 0 ·
  SHOT_TIMEOUT 0 · ciclo-dado-test **266/266** (las 12 de LENTE en verde) · tsc A/B 27 → 27 en los 4 archivos.
- el video (29, 201 s) revisado a 0.5 fps entero y a 2 fps en el paso 3: «calculando» sobre la pieza 3.5 s → pintura y
  escala → la marca aparece ya sobre el poste visible (en la corrida anterior salía un cuadro en el poste tapado:
  corregido, la marca espera a la elección) → la ficha abre ahí. Queda 1 cuadro oscuro (~2 s) en el paso 6 entre la
  pieza y la base del molde (hallazgo del paso 6, no de esta orden).
- HALLAZGOS (registrados, no tocados):
  · PARED y LLENADO siguen pintándose por vértice: misma mentira de interpolación que tenía el enfriamiento.
  · La lente usa `ABS_KAZMER`; el intake de la carcasa es PP.
  · El hilo se bloquea al entrar a la lente (1.5 s en node tras 2b): una máquina de cliente lenta puede pasarse del
    presupuesto. Lo que queda: vóxelizar (pruebas punto-en-malla, 0.85 s) y el Dijkstra con extracción lineal, que
    E4/E5 siguen pagando (un montículo cambiaría el desempate de caminos iguales: va con EL FAN EN SU CARRIL).
  · El aviso «calculando» sobre la pieza no lo puede medir un check del arnés (se sondea con el hilo libre, cuando
    ya terminó): su evidencia es el video.
  · En iangpu, `scripts/ciclo-dado-test.cjs` estaba VIEJO (248 checks, sin las 18 de LENTE): toda corrida del
    cubo en iangpu debe usar la copia de la laptop.
  · Los escalones de 0.8 mm se ven a 3× en las fronteras de color; a escala normal no.
  · El acento de la ficha sigue violeta («SIMULADO») sobre la rampa térmica.

## GOLPE 2 · EL TIEMPO (2026-09-15, en curso; ian: «golpe 2, me mama cómo está quedando la interfaz flotante»)
Plan declarado ANTES de tocar (mismos TOCA; nada nuevo que crear salvo `tiempo-0-50-100.png`, ya en CREA):
- La temperatura en el tiempo sale de la MISMA Eq 9.5 (primer término de la serie, centro de la pared local):
  θ(t) = (T−T_agua)/(T_fundido−T_agua) = min(1, 4/π·exp(−L·t/t_c)), L = ln(4/π·(T_f−T_a)/(T_e−T_a)) = 1.80 (ABS de la
  lente). Cada punto llega a T_expulsión (97.6 °C) EXACTO en su t_c: el reloj y el mapa de segundos no se contradicen.
  Limitación dicha: el primer término mantiene el centro a temperatura de fundido el primer 13 % de su t_c.
- Shader: el t_c completo va en un tercer canal (B = √((t_c−mín)/(máx−mín))) y el color de θ en una LUT: azul si ya
  está firme (θ < θ_e), ámbar→blanco si sigue blando; el corte en θ_e es el frente de solidificación.
- Interfaz FLOTANTE junto a la pieza: barra en °C (fundido · 97.6 firme · agua), reloj «t = x s de 134 s · ×13» con
  marcas en 21.5 s (la mitad firme) y 134 s (abre el molde), pausa, y botón al mapa en segundos del golpe 1. Bucle:
  0 → t_c máx en 10 s, 2.5 s quieto al final, otra vez. `__forgeBrep.enfriamiento.fijar(t)` para capturas exactas.
- `__forgeBrep.cambio(ms)`: fracción de píxeles que cambian entre dos renders chicos → el p3-6 del runner.
- HALLAZGO al revisar el código antes de correrlo: el p3-6 del camino llamaba `cambio(1000).then(…)` dentro de un check
  que el arnés evalúa como `!!(expresión)`: una promesa es verdadera, así que en cuanto `cambio` existiera el check pasaría
  SIN medir (antes fallaba solo porque `cambio` no existía). Reescrito síncrono: la primera consulta arranca la medición,
  las siguientes leen `window.__cambioP` y se vuelve a medir si salió < 0.02.

## EJERCICIOS
- escala · una barra con segundos junto a la pieza y el campo mapeado a ella · testid escala-enfriamiento · el punto que manda señalado con su valor
- tiempo · la pieza se enfría en pantalla con el reloj corriendo · __forgeBrep.cambio(1000) ≥ 0.02 · al final solo el punto que manda sigue caliente
- movimiento-medido · el runner exige que dos capturas a 1 s sean distintas en todo paso que simule · cláusula MOVIMIENTO en el contrato del camino

## YA-EXISTE (prueba de ausencia)
- `lentes.lentes[enfriamiento]` (foco-lentes.ts) ya calcula por vóxel el tiempo a firme (§9.2, Eq 9.5): p50/p95,
  «15.9 s lista primero · 124 s a medio camino · 233 s tarde (p95)» en la tira EL PARTE, y `peor` (el punto).
- La térmica del cubo (`moldThermalSim`, `moldTc`, MoldTcPaint) ya anima temperatura en el tiempo — para el
  dado, no para la pieza soltada. F0-F3 (FDM multicapa, cap 9) existen en el kernel.
- `__forgeBrep.encuadre()` ya renderiza a un target chico: la medida de MOVIMIENTO (`cambio(ms)`: fracción de
  píxeles que cambian entre dos renders) se construye encima, sin canvas nuevo.
- NO existe: escala de color con números en pantalla; reloj del enfriamiento sobre la pieza soltada; check de
  movimiento en el runner.
## TOCA (confirmado 2026-09-14)
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/foco-lentes.ts
- caminos/la-carcasa-de-mitsubishi.md
- scripts/camino-runner.cjs
- public/temis.json
- public/temis-deploy.json
- src/forja/mold/flowlen.ts
- src/forja/mold/revisar-modelo.ts

ENMIENDA 2026-09-14 22:20 UTC (flowlen.ts y revisar-modelo.ts entran a TOCA, antes de tocarlos): en el paseo, bajo la
grabación, la lente declaró 3.2 s (presupuesto 2.5). Medido por etapa a celda 0.8 mm: vóxelizar 0.85 s · EDT 0.1 ·
espesor local 0.05 · Dijkstra del frente 1.4 s (58 %, extracción del mínimo LINEAL). El enfriamiento y la pared no usan
el frente. Cambio: `measureFlowLength` acepta `frente: false` (salta el Dijkstra; sin la opción, idéntico) y la lente
corre DOS campos: el fino sin frente (pared, enfriamiento) y el de siempre a 90 000 vóxeles con su Dijkstra intacto
(llenado, inalcanzables, avisos). E4/E5/dictamen no cambian: no pasan la opción.

## CREA
- public/evidencia/2026-09-10-el-enfriamiento-se-ve/resultados.json
- public/evidencia/2026-09-10-el-enfriamiento-se-ve/escala.png
- public/evidencia/2026-09-10-el-enfriamiento-se-ve/pintura-antes-despues.png
- public/evidencia/2026-09-10-el-enfriamiento-se-ve/tiempo-0-50-100.png
- public/evidencia/2026-09-10-el-enfriamiento-se-ve/paseo-contactos.png
## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol; lista tomada de git status al abrir)
- public/comando/historia.json
- public/comando/metricas.json
- public/precomputed/economia-colchon.json
- videos/mol-h2o-dos-gotas.json
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
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json
- scripts/cola-publicar.py
- scripts/comentarios.py
- scripts/primer-comentario.py
- videos/CRONOGRAMA.json
- videos/atomo-ca.json
- videos/atomo-p.json
- videos/atomo-s.json
- videos/atomo-zn.json
- public/comando/comentarios-analisis.json
- public/comando/comentarios-etiquetas.json
- public/comando/comentarios.json
- scripts/comentarios-ml.py
- public/comando/analisis-ig.json
- public/comando/respuestas-comentarios.json
- scripts/responder-comentarios.py
- scripts/guiones/econ-guardadito.txt
- videos/atomo-k.json
- videos/atomo-na.json
- videos/atomo-o.json
- videos/econ-colchon.json
- videos/mol-h2o-el-cuarteto-b.json
- videos/mol-h2o-el-sudor-b.json
- videos/mol-h2o-la-sal-b.json
- videos/mol-h2o-la-silla-b.json
- scripts/precompute-colchon.py
- src/cinematic/CinematicMolecule.tsx

## EVIDENCIA (se declara ANTES de trabajar)
- Golpe 1 (escala): `testid:escala-enfriamiento` visible en el paso 3 con ≥ 3 marcas en segundos y el color de
  la pieza mapeado a esa barra; el punto que manda (233 s) señalado sobre la pieza con su valor.
- Golpe 2 (tiempo): `__forgeBrep.cambio(1000) ≥ 0.02` durante el play (la pieza cambia); un reloj `t / t_c`
  visible; al final solo el punto que manda queda caliente.
- Runner: paso 3 con ambos checks; paseo con el enfriamiento corriendo (línea de tiempo: cuadros distintos
  durante el play); video entregado en ambas PCs.
- orden-gate VERDE; censo igual; cero pageerror.
## CIERRE (2026-09-17)
- orden vs entregado: TOCA idéntico más las dos ENMIENDAS declaradas antes de tocar (flowlen.ts y revisar-modelo.ts el
  09-14; nada nuevo el 09-17). CREA: los cuatro archivos declarados existen (resultados.json, escala.png,
  pintura-antes-despues.png, tiempo-0-50-100.png, paseo-contactos.png). BORRA nada.
- GOLPE 2 · EL TIEMPO, hecho y medido: la temperatura sale del MISMO primer término que da la Eq 9.5
  (θ(t) = min(1, 4/π·exp(−L·t/t_c)), L = 1.8019 con el ABS de la lente), así que cada punto cruza 97.6 °C EXACTO en su
  t_c: oráculo de la placa de 2 mm del libro (t_c 8.4 s → T = 97.6 = T_expulsión). El t_c completo viaja en un tercer
  canal de la textura (√ normalizada) y el color de θ en su propia LUT: azul si ya está firme, rojo→naranja→amarillo
  casi blanco mientras sigue blando, con el corte en θ_e como FRENTE de solidificación. Interfaz FLOTANTE junto a la
  pieza: barra en °C (239 fundido · 97.6 firme · 60 agua), reloj «t = x s de 134 s · tiempo ×13» con marcas en 21.5 s
  (la mitad firme) y 134 s (abre), pausa y botón al mapa en segundos del golpe 1. Bucle 0 → t_c máx en 10 s + 2.5 s
  quieto. `__forgeBrep.cambio(ms)` mide el MOVIMIENTO y `__forgeBrep.enfriamiento.fijar(t)` clava el reloj para capturas.
- números (runner limpio 2026-09-17 18:31 UTC, dev :5194 iangpu, máquina sin otra carga): **7/8 · paso 3 = 6/6**
  (antes 4/6) · lente 1.9 s declarados (presupuesto 2.5) · **p3-6 en verde por primera vez: 21.8 % de los píxeles
  cambian en 1 s** (grabando el paseo, 17.8 %) · primera placa del molde 0.40 s · GLITCH 0 · SHOT_TIMEOUT 0 ·
  video 30 de 219 s. Superficie firme medida con muestreo fino: 7.3 % a los 10.8 s · 80.2 % a los 21.5 s · 96.8 % a
  los 67 s · 100 % a los 134.5 s (la mediana por área también es 21.5 s: casi toda la carcasa es pared de 3.2 mm).
- el video revisado entero a 0.5 fps y el paso 3 a 2 fps: el enfriamiento se ve correr (amarillo casi blanco → naranja
  → rojo → azul con los postes calientes al final), el reloj avanza y la escala en °C queda junto a la pieza.
- HALLAZGOS (registrados, no tocados aquí):
  · **La cola del enfriamiento es física, no un defecto:** pasados ~40 s las paredes ya están a temperatura del agua y
    solo cambian los postes (el movimiento cae de 22 % a 0.2 % de píxeles por segundo). El check del camino vuelve a
    medir hasta 15 s y el ciclo dura 12.5, así que siempre alcanza el tramo vivo.
  · **p6-5 (colada) quedó al borde:** 60.9 s contra 60 de presupuesto porque E5 llegó a 85.5 s en la corrida limpia
    (varía 64-85 s según carga). Es el costo del solver FAN → EL FAN EN SU CARRIL, ya en PRÓXIMO.
  · PARED y LLENADO siguen pintándose por vértice (la mentira de interpolación del golpe 1 sigue ahí).
  · La lente usa ABS (Kazmer) y el intake de la carcasa es PP: la ficha y la barra lo DICEN, pero no es su material.
- gotchas pagados hoy:
  · **No medir con nada más corriendo en iangpu:** corrí los montajes de ffmpeg encima de una medición y salió
    lente 2.1 s + E5 79.8 s; con la máquina sola, 1.9 s y 7/8. Y matar los `chrome-headless-shell` que deja el arnés
    (por PID, nunca `pkill chrome`).
  · El p3-6 del camino llamaba `cambio(1000).then(…)` y el arnés evalúa `!!(expresión)`: una promesa siempre es
    verdadera, así que el check habría pasado SIN medir. Reescrito síncrono (`window.__cambioP`).
  · La rampa del reloj no era monótona (rojo a media rampa, amarillo al solidificar): en el video la pieza PARECÍA
    calentarse antes de enfriarse. Ahora baja en temperatura y en luminancia a la vez.
  · Glifos ⏸/▶ salían como cuadritos en esa fuente: los botones dicen «pausa» y «seguir» con palabras.
- iangpu: la VM de WSL no arrancaba (Wsl/Service/E_UNEXPECTED). Causa real: el ext4.vhdx de Ubuntu con «Filesystem
  error recorded from previous mount: IO failure». Reparado con `wsl --mount --vhd … --bare` + `e2fsck -f -y` desde el
  ssh de sebas (que SÍ es admin): journal + mapas de bloques de los grupos 373-374 + contadores; pasos 2-4 limpios,
  ningún archivo borrado, segunda revisión rc=0.
