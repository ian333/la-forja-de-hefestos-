# ORDEN: EL AGUA DICE DOS COSAS — la lámina de la placa y el 3D del molde no dibujan el mismo circuito

ESTADO: proximo
PRIORIDAD: 5

BASE: a9331a7

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

## EJERCICIOS
- [ ] medir los dos caminos lado a lado para cubo, vaso y carcasa (tabla: D, H, W, n, plug, ΔT, Re).
- [ ] UNA fuente: `estacion8Circuito` como origen y la lámina leyendo sus segmentos (o al revés, según la
      decisión), con el cubo bit-igual o con su cambio DECLARADO y re-firmado.
- [ ] gate nuevo: «lámina y 3D dicen lo mismo» (D, H, W, n, plug) para las tres piezas.

## TOCA
- public/temis.json
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/estudio-molde-datos.ts
- scripts/ciclo-dado-test.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol; git status al registrar el ticket, 2026-09-17)
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

## EVIDENCIA (se declara ANTES de trabajar)
- La tabla de los dos caminos ANTES y DESPUÉS para las tres piezas.
- `ciclo-dado-test` verde (266/266 o el número nuevo, firmado y explicado).
- Captura de la lámina y del 3D del MISMO molde con los mismos números a la vista.

## CIERRE (se llena al terminar)
