# ORDEN: EL ENFRIAMIENTO SE VE — la escala con segundos junto a la pieza, y la pieza enfriándose en el tiempo

ESTADO: proximo
PRIORIDAD: 2

BASE: 22674c9

OBJETIVO: ian (2026-09-10): «aún no se puede cerrar el happy path si no veo una simulación real de la temperatura y el
enfriamiento… no me gustan los colores que usa, no entiendo, solo veo que cambia de color: falta la referencia
visual, o la simulación en el tiempo; nada de pantallas fijas». Hoy la lente ENFRIAMIENTO pinta el tiempo que
tarda cada punto en estar firme, sin escala a la vista y sin tiempo corriendo: un lila uniforme. Al final de
esta orden (DOS golpes, uno por día): (1) LA ESCALA — una barra de color con segundos, fija junto a la pieza,
y el campo mapeado a ella, con el punto que manda marcado; (2) EL TIEMPO — play: la pieza se enfría en pantalla
de 0 a su ciclo con el reloj corriendo, hasta que solo queda caliente el punto que manda. El runner exige
MOVIMIENTO (dos capturas a 1 s son distintas) y la escala presente. El paso 3 del camino cambia su promesa y
queda «a medias» hasta que esto exista (dicho, no fingido).

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
## TOCA (probable; se confirma al empezar)
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/foco-lentes.ts
- caminos/la-carcasa-de-mitsubishi.md
- scripts/camino-runner.cjs
- public/temis.json
- public/temis-deploy.json
## CREA
- public/evidencia/2026-09-10-el-enfriamiento-se-ve/resultados.json
- public/evidencia/2026-09-10-el-enfriamiento-se-ve/escala.png
- public/evidencia/2026-09-10-el-enfriamiento-se-ve/tiempo-0-50-100.png
- public/evidencia/2026-09-10-el-enfriamiento-se-ve/paseo-contactos.png
## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol)
- public/comando/historia.json
- public/comando/metricas.json
- scripts/captions-pendientes.py
- scripts/playlist-tutoriales.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
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

## EVIDENCIA (se declara ANTES de trabajar)
- Golpe 1 (escala): `testid:escala-enfriamiento` visible en el paso 3 con ≥ 3 marcas en segundos y el color de
  la pieza mapeado a esa barra; el punto que manda (233 s) señalado sobre la pieza con su valor.
- Golpe 2 (tiempo): `__forgeBrep.cambio(1000) ≥ 0.02` durante el play (la pieza cambia); un reloj `t / t_c`
  visible; al final solo el punto que manda queda caliente.
- Runner: paso 3 con ambos checks; paseo con el enfriamiento corriendo (línea de tiempo: cuadros distintos
  durante el play); video entregado en ambas PCs.
- orden-gate VERDE; censo igual; cero pageerror.
## CIERRE (se llena al terminar)
