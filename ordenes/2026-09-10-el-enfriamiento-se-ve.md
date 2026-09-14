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

## EVIDENCIA (se declara ANTES de trabajar)
- Golpe 1 (escala): `testid:escala-enfriamiento` visible en el paso 3 con ≥ 3 marcas en segundos y el color de
  la pieza mapeado a esa barra; el punto que manda (233 s) señalado sobre la pieza con su valor.
- Golpe 2 (tiempo): `__forgeBrep.cambio(1000) ≥ 0.02` durante el play (la pieza cambia); un reloj `t / t_c`
  visible; al final solo el punto que manda queda caliente.
- Runner: paso 3 con ambos checks; paseo con el enfriamiento corriendo (línea de tiempo: cuadros distintos
  durante el play); video entregado en ambas PCs.
- orden-gate VERDE; censo igual; cero pageerror.
## CIERRE (se llena al terminar)
