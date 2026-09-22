# ORDEN: EL CORTE ÚNICO — un solo lugar corta el acero, y un juez que avisa si una broca no quitó su material

ESTADO: hoy
PRIORIDAD: 2

BASE: 2b3ed99

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
- (el agente declara el resto al abrir, por ENMIENDA)

## CREA
- (nada)

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
