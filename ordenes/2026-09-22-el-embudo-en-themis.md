# ORDEN: El embudo de GAIA, como camino de Themis

> ian, 2026-09-22: «si puede vivir sin Meta entonces debemos dar herramientas gratuitas para
> que nos empiecen a usar, si podemos generar un chingo de videos debemos ir cerrando el
> funnel; añade un happy path a Themis del funnel y necesitamos un funnel en GAIA».

BASE: eb549f2

OBJETIVO: el embudo deja de ser un documento y pasa a ser un CAMINO medible en Themis:
cada estación con su evidencia y su comando, para que el tablero diga en qué punto se
rompe. Y la escalera de herramientas gratuitas queda decidida por escrito (una, no cinco).

## YA-EXISTE (prueba de ausencia)
- `caminos/el-cine-programado.md` y `caminos/la-carcasa-de-mitsubishi.md`: el formato
  (ACTOR/PROMESA/PIEZA/PASOS/RUNNER) que lee `scripts/temis-tablero.cjs` y recorre
  `scripts/camino-runner.cjs`. Se COPIA el formato, no se inventa otro.
- `docs/EL-EMBUDO-DE-DON-CHUY.md`: la experiencia de punta a punta (M0-M8). Se le AGREGA
  la sección de herramientas gratuitas; no se duplica el documento.
- `chuy.html` + `src/chuy/`: la libreta ya construida (sin desplegar).
- `scripts/dm-libreta.py`: el respondedor, con el hallazgo de las dos puertas.

## TOCA
- docs/EL-EMBUDO-DE-DON-CHUY.md
- public/temis.json

## CREA
- caminos/el-embudo-de-gaia.md

## BORRA
- (nada)

## PREEXISTENTE
- docs/CANON-VIDEO.md
- public/comando/comentarios.json
- public/comando/respuestas-comentarios.json
- src/cinematic/CinematicMolecule.tsx
- videos/econ-anotar.json
- videos/econ-credito.json
- videos/econ-descuento.json
- videos/econ-enfrente.json
- videos/econ-hora.json
- videos/econ-lata.json
- videos/econ-lluvia.json
- videos/econ-merma.json
- videos/econ-naranja.json
- videos/econ-precio.json
- videos/econ-yunus.json
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
- ordenes/2026-09-22-el-embudo-en-themis.md
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `node scripts/orden-gate.cjs` verde.
- El camino se parsea: `node scripts/temis-tablero.cjs` lo incluye sin error.
- Cada estación con estado HONESTO (ok/parcial/bloqueado) y un comando que lo comprueba.
- censo esperado: html igual, vite igual, canvas igual.

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
