# ORDEN: X3 · LA FICHA VIVE EN LA PIEZA — el POC del primitivo

BASE: 2f6a3b0
TIPO: imprevisto

OBJETIVO: ian dictó la ley y aprobó el dibujo:

> «Todo lo que se trabaje FUERA del área de trabajo va fuera del área de trabajo, como
> seleccionar archivos y cargar proyectos. **TOOOOODO LO QUE ESTÉ DENTRO DEL ÁREA DE TRABAJO
> ESTARÁ DENTRO DEL ÁREA DE TRABAJO.** Solo quiero 1 quick win. ¿Definamos 3 tipos de pantallas
> o solo 1 reutilizable? Pero pensemos: **el Foco me encanta porque hay demasiada información —
> pero ¿cómo se llama? FOCO.**»

Ese último renglón es la doctrina y llevábamos días sin oírla. Un foco **no muestra: enfoca.**

> **EL FOCO NO AGREGA INFORMACIÓN: LA ATENÚA.** Todo está ahí siempre; lo que apuntas se
> enciende y lo demás baja.

Y por eso Horizon enseña UNA ficha a la vez: tiene retículo. Nosotros enseñábamos 12 renglones
apilados en una barra — un reporte. Horizon nunca te da un reporte.

## LA RESPUESTA A SU PREGUNTA: UNA sola, reutilizable

No son 3 pantallas: son **3 distancias al haz** del MISMO primitivo, **LA FICHA** — un texto
anclado a un punto de la pieza.

| estado | cuándo | qué se ve |
|---|---|---|
| **MARCA** | está ahí, no lo apuntas | el punto y su color. Cero texto. |
| **ETIQUETA** | el haz lo roza | punto + título corto + valor. Una línea. |
| **FICHA** | lo apuntas | § chiquito, título, cuerpo en español. **UNA a la vez.** |

Una cota es una FICHA en ETIQUETA. Un hallazgo será una MARCA hasta que lo apuntes. Lo único
que NO se ancla es la leyenda de la lente: describe todo el campo, no un punto — esa se queda
pegada al borde (**EL PARTE**).

## EL DATO QUE DECIDE EL ALCANCE (medido hoy)

**Los 69 hallazgos NO saben dónde ocurren.** `Criterio` trae id, cita, texto y números; cero
coordenadas. `CoordFinding` tampoco (`sev`, `check`, `detail`). El propio código lo confiesa:
*«necesitan coordenadas. Quien las tenga las pasa»* — y nadie las pasa.

Por eso este POC **no** saca los 69 al mundo: eso es un ticket grande y hoy es imposible. Saca
lo que SÍ tiene coordenada y ya vive en el visor: **LA MARCA de la lente** (`peor.punto`), que
hoy es una esferita muda mientras su frase vive en la barra lateral.

## LA PIEZA DE PRUEBA (controlada, a pedido de ian)

`test-parts/naturebytes-clip.stl` — **496 triángulos**, 21×35×29 mm, el campo resuelve en
**91 ms**, y la historia es la más limpia del banco: t_c mediana 10.8 s contra un máximo de
78.8 s = **7.3×**. Un solo punto manda el ciclo, y se ve.

## EJERCICIOS
- x3-primitivo · UNA ficha reutilizable con sus 3 estados · componente · `FichaEnElMundo` anclada a un punto 3D; el estado lo decide si la apuntas, no un panel
- x3-anclada · La ficha se queda PEGADA al punto al girar la pieza · proyección · usa el mismo `useFrame` + `project(camera)` de `CotaDriver`; se esconde si el punto queda detrás de la cámara
- x3-la-ley · El texto SE MUDA, no se duplica · arquitectura · el titular y el cuerpo salen del panel lateral y viven sobre la pieza; en el panel se queda SOLO la leyenda y las pestañas (describen el campo, no un punto)
- x3-anatomia · Se ve ficha de Horizon, no caja de formulario · CSS · borde izquierdo duro, SIN borde de caja, relleno con lluvia vertical, § chiquito arriba, título grande, cuerpo en español
- x3-se-enseña-sola · No hay que adivinar el mecanismo · UX · al prender una lente la ficha abre UNA vez; después se cierra al apuntar a otro lado y se reabre al apuntar la marca
- x3-sin-regresion · Nada de lo que ya servía se rompe · gate · `ciclo-dado-test.cjs` verde y el drive con la pieza controlada sin errores de consola

## YA-EXISTE (prueba de ausencia)
- `MoldCotas3D.tsx` → `CotaDriver`: proyecta un punto 3D al DOM por `useFrame` y escribe el
  `transform`. **Es la maquinaria de anclaje y se reusa** — no se escribe otra.
- `foco-lentes.ts` ya entrega `peor: { punto, valor }`, `titular`, `cuerpo`, `ref` y `origen`
  por lente. **Todo el contenido de la ficha ya existe**; hoy se pinta en el lugar equivocado.
- La MARCA ya se dibuja en el visor (esfera con `depthTest:false`, así que nunca la tapa la
  pieza). Solo le falta poder abrirse.
- Gotcha ya pagado: **NADA de `drei <Text>`** dentro de un Canvas con EffectComposer (crashea).
  La ficha es DOM proyectado, como las cotas.
- NO existe: ningún texto anclado a la geometría. Es literalmente el hueco de T3.

## LO QUE ESTE POC **NO** HACE (declarado, no escondido)
- **No** pone los 69 hallazgos en el mundo: no tienen coordenada (ver arriba). Es otro ticket.
- **No** inclina la ficha en perspectiva real como Horizon. Se ancla y se mueve con la pieza,
  que es la mitad que importa; el sesgo de cámara queda pendiente y se dice.
- **No** hay retículo todavía: el haz es el cursor.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/RevisarPiezaPanel.tsx
- public/temis.json

## CREA
- ordenes/2026-09-01-x3-la-ficha-vive-en-la-pieza.md
- public/evidencia/2026-09-01-x3-la-ficha-vive-en-la-pieza/resultados.json
- public/evidencia/2026-09-01-x3-la-ficha-vive-en-la-pieza/ficha-abierta-sobre-el-punto.png
- public/evidencia/2026-09-01-x3-la-ficha-vive-en-la-pieza/ficha-sigue-al-girar.png

## BORRA
- (nada)

## PREEXISTENTE
<!-- de la OTRA sesión de Claude, que está armando el video del CAMPO. No son de esta
     orden, no se tocan y no se commitean aquí. -->
- scripts/precompute-water-approach.py
- src/cinematic/CinematicMolecule.tsx
- scripts/guiones/campo.txt
- videos/mol-campo-los-dos-campos.json
- public/comando/catalogo.json
- public/comando/produccion.json
- docs/forja-research/datasheets-fuente-corriente/
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json

## EVIDENCIA (declarada ANTES de trabajar)
- captura con la pieza controlada: la ficha ABIERTA sobre el punto que manda el ciclo
- captura con la pieza girada: la ficha SIGUE pegada a su punto
- captura del panel: ya sin el titular, solo pestañas y leyenda
- gate `ciclo-dado-test.cjs` verde
- entrega a `C:/Users/sebas/Downloads` — nada en /tmp
- deploy + verificación contra el bundle SERVIDO
- orden-gate VERDE · censo Canvas 8→8
