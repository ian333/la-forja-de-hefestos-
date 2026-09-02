# ORDEN: X6 · LA LÁMINA VIVA — mirarla ya informa

BASE: 6152e3f
TIPO: imprevisto

OBJETIVO: ian, después de ver la lámina de papel y el acero café: «no me late. Preferiría
algo diferente, algo que considere todo el CAD industrial súper aburrido y tengamos pantallas
que **verdaderamente transmitan la información**. Como es un dictamen sí debe ser plana, pero
**no opaca al 100 %** — que se vea lo que hay al fondo, si hay alertas incluso. El fondo se
mueve como diapositiva y **dependiendo de la info cambia la animación**. Si le doy clic a algo
verde debe ponerse verde y abrirse; si le doy amarillo, animación amarilla. **Aquí no busco
funcionalidad: quiero que se vea bien verga y que el solo mirarla me dé información.**»

Pasa la línea de la doctrina porque **el movimiento es el dato**: el fondo no decora, respira al
ritmo de la severidad; el color de la ola no es adorno, es el estado de lo que tocaste.

## EJERCICIOS
- x6-cristal · La lámina es translúcida: la pieza y sus marcas se ven detrás · glass · fondo con alpha ≤0.45 + backdrop-filter; nada de placa opaca
- x6-tinte-es-estado · El color base LO PONE el dictamen · semántica · viola → rojizo, advierte → ámbar, limpia → verde; sobre una base pizarra fría (el «azul traslúcido» de ian), no navy-cian
- x6-respira · El fondo se mueve y su RITMO es la severidad · keyframes · 3 manchas difusas derivan; duración 9 s con ≥4 violaciones, 14 s con alguna, 20 s solo advertencias, 28 s limpia; más un barrido diagonal lento (el escaneo)
- x6-ola-del-clic · Tocar algo lo tiñe de SU color · interacción · al hacer clic en un hallazgo nace una ola desde el punto del clic con el color de su estado (verde/ámbar/rojo) y la sección se abre
- x6-de-un-vistazo · Sin leer, ya sabes cómo está la pieza · cabecera · chip con «6 VIOLAN» / «13 ADVIERTEN» / «LIMPIA» latiendo en su color
- x6-se-ve-moverse · La animación se verifica, no se declara · 3 cuadros · capturas a t=0 / 0.6 s / 1.6 s de abierta muestran el fondo en posiciones distintas; y a t=80 ms / 400 ms de un clic, la ola creciendo

## YA-EXISTE (prueba de ausencia)
- LA LÁMINA (X5) y `RevisarPiezaPanel` completo — se re-viste, no se reescribe. El panel solo
  gana un aviso (`onDictamen`) con los conteos que YA calcula (`rev.fila`).
- Los colores de estado ya están definidos en el panel (`COLOR`): se reusan tal cual.
- NO existe: ningún fondo animado, ningún tinte semántico, ninguna reacción de color al clic.

## LO QUE NO ES (declarado)
Cero funcionalidad nueva: no cambia qué dice el dictamen ni cómo se abre. Solo cómo se ve y
cómo se mueve. Regla #0.7: cero `<Canvas>` — todo es DOM + CSS keyframes.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/RevisarPiezaPanel.tsx
- public/temis.json

## CREA
- ordenes/2026-09-02-x6-la-lamina-viva.md
- public/evidencia/2026-09-02-x6-la-lamina-viva/resultados.json
- public/evidencia/2026-09-02-x6-la-lamina-viva/abierta-t0.png
- public/evidencia/2026-09-02-x6-la-lamina-viva/abierta-t1600.png
- public/evidencia/2026-09-02-x6-la-lamina-viva/clic-rojo-t80.png
- public/evidencia/2026-09-02-x6-la-lamina-viva/clic-verde-t400.png

## BORRA
- (nada)

## PREEXISTENTE
<!-- de la OTRA sesión (ritmo/señales de reels), no de esta orden -->
- public/comando/ritmo.json
- public/comando/senales.json
- scripts/ritmo.py
- scripts/senales.py
- public/comando/catalogo.json
- public/comando/produccion.json
- public/comando/analisis-rasgos.json
- public/comando/curvas-dia.json
- public/comando/rasgos-reels.json
- scripts/analisis-rasgos.py
- scripts/curvas-dia.py
- scripts/rasgos-reels.py
- scripts/iangpu.sh
- src/cinematic/CinematicMolecule.tsx
- videos/mol-h2o-los-dos-campos.json
- docs/forja-research/datasheets-fuente-corriente/
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json

## EVIDENCIA (declarada ANTES de trabajar)
- 3 cuadros de la lámina abierta (t=0 / 0.6 s / 1.6 s) — el fondo en posiciones distintas
- 2 cuadros tras un clic en un hallazgo (t=80 ms / 400 ms) — la ola creciendo en SU color
- hoja de contactos en Downloads; deploy solo con el visto de ian
- gate ciclo-dado verde · orden-gate VERDE · censo Canvas 8→8

## CIERRE (2026-09-02)
**6/6 EN VERDE · verificado a cuadros · gate 266/266.**

ian, al ver los cuadros: «me mama, ahora sí cierra este ticket y sube todo».

La lámina dejó de ser una placa: es cristal teñido por el dictamen (6 violaciones → rojizo,
chip «6 VIOLAN»), con un fondo que respira al ritmo de la severidad (medido: la mancha se
movió 371→374→378 px en 1.6 s) y una ola que nace del clic con el color de lo que tocaste
(rojo tras un ✗, verde tras un ✓) mientras la fila se tiñe. La pieza y sus marcas se ven
detrás; la ficha del punto baja a penumbra mientras la lámina está abierta.

Pasa la línea de la doctrina porque **nada decora: el color es el estado y el ritmo es la
severidad.** Cero funcionalidad nueva, cero Canvas — DOM + CSS.

Tres errores pagados, y los tres son el mismo: el navegador NORMALIZA lo que le das (hex →
rgb(), currentTarget → null en cuanto termina el handler) y yo asumía que me devolvía lo que
puse. Uno tiró la pantalla entera al ErrorBoundary; otro hizo nacer la ola invisible. Quedan
escritos junto al código.

Lo que queda para después, dicho: la ola sobre un cristal ya rojo sigue siendo la menos
visible de las tres (rojo sobre rojo); si molesta con uso real, la salida es un anillo más
claro, no más rojo.
