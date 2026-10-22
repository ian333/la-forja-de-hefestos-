# ORDEN: EL HAPPY PATH COMERCIAL — el camino de la carcasa al día (el Foco, el expediente que te llevas) y su paseo en video HD

ESTADO: hoy
PRIORIDAD: 1

BASE: 2a32e62

OBJETIVO: ian (2026-10-22): «dame el happy path para de ahí sacar el QA, y me gustaría verlo en video para poder revisarlo». El happy path
YA EXISTE (caminos/la-carcasa-de-mitsubishi.md, 8 pasos con runner; última medición 09-22: 6/8). Se pone al día con la versión
comercial — sueltas tu STEP → molde entero → EL FOCO te enseña dónde falla → te llevas el expediente — y se recorre grabado en tiempo
real a resolución real (la grabación del arnés sale en píxeles CSS 1600×1000: «la interfaz parece al 70 %»).

## YA-EXISTE (prueba de ausencia)
- caminos/la-carcasa-de-mitsubishi.md (PASOS + RUNNER + contrato de tiempo/encuadre/ruido/movimiento) y scripts/camino-runner.cjs (--paseo).
- scripts/forja-drive.cjs graba con recordVideo de Playwright (CSS px, 1×) — se agrega RECHD: screencast CDP a píxeles reales.
- El Foco del molde (Q, __forgeBrep.focoMolde) y el botón btn-expediente-descargar ya existen; el camino no los recorre.

## EJERCICIOS
- [ ] camino: paso nuevo EL FOCO (Q sobre el molde: pulso + 0 puntos débiles para la carcasa) y el expediente DESCARGABLE como cierre.
- [ ] forja-drive: RECHD=<dir> → cuadros reales (viewport 1536×864 @2.5) con su marca de tiempo → video en tiempo real.
- [ ] el runner sobre main en iangpu: medición + paseo grabado; video a Downloads (dos PCs), revisado con mis ojos antes de entregar.
- [ ] la lista de QA (paso → qué ve el cliente → criterio → presupuesto de tiempo → medido hoy) entregada junto al video.

## TOCA
- caminos/la-carcasa-de-mitsubishi.md
- scripts/forja-drive.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- docs/CANON-VIDEO.md
- public/comando/analisis-ig.json
- public/comando/comentarios.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- src/cinematic/CinematicMolecule.tsx
- src/cinematic/camera-shots.ts
- videos/atomo-c.json
- videos/atomo-ne.json
- videos/atomo-si.json
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
- public/comando/growth.json
- public/precomputed/caroteno-gemelos-color.json
- public/precomputed/caroteno-gemelos-fisica.json
- public/precomputed/conos-caseta.json
- public/precomputed/conos-paleta-torres.json
- public/precomputed/osm-juriquilla-calles.json
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/guiones/caroteno-gemelos.txt
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/precompute-caseta.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/conos-caseta-noche.json
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- salida del runner (N/9 pasos, checks) escrita en ## MEDIDO del camino; video del paseo revisado por cuadros; orden-gate VERDE.
