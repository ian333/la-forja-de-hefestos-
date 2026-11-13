# ORDEN: GAIA 3D · 50 expresiones del títere y un video que las recorre (noche del 13-nov)

BASE: ce31a5cadcced77aed91b2b08b4831776ac464f7

OBJETIVO: que GAIA (títere 3D en Blender, iangpu) tenga unas 50 expresiones guardadas —lindas, coquetas, juguetonas, seductoras y de actuación—
hechas con los «músculos» del esqueleto, y un video que las enseñe todas, con nombre y número. Paso a paso, revisando cada lote con los ojos.
Pedido de ian (13-nov): «¿puedes rifarte toda la noche en generar unas 50 expresiones? quiero verlas todas en un video, obvio paso a paso».

## YA-EXISTE (prueba de ausencia)
Todo vive FUERA del repo, en iangpu `/mnt/d/gaia-3d/` (el repo no gana ni un archivo de código):
- `heroe/heroe.py` (base v23 + parches; `cara5(w)`, `heroe5()`), `heroe/parpadeo.py`, `heroe/boca.py` (músculos con puntos medidos).
- `instrumento/instrumento.py` (medir la piel sin fotos), `instrumento/cand.py` + `labios.py` (contorno de la boca y búsqueda con los controles finos GRP-Lip_*),
  `instrumento/carcajada.py` (la segunda cara, calcada hoy con el mismo método), dientes que siguen al labio (hueso Teeth.T).
- `expresiones/heroe_v5.json`, `expresiones/carcajada_v1.json` (501 canales por cara), 10 acciones viejas `GAIA_expr_*` en el blend.
- `video-fisica/video_heroe5.py` (cara como expresión + pelo con física, cabeza/cara/párpados a doses).
- Referencias: `GAIA-ESTUDIO/19-catalogo-cientifica/A-canon/A09-expresiones-12.png`, `A10-bocas-fonemas-es.png`, storyboard `03-storyboard-intro/`.
Lo nuevo es un DIFF sobre eso: una lista de 50 recetas + una herramienta que las arma con las piezas de arriba.

## TOCA
- (nada)

## CREA
- ordenes/2026-11-13-gaia-50-expresiones.md

## BORRA
- (nada)

## PREEXISTENTE
- ordenes/2026-11-05-el-reparto-semana-4.md
- public/comando/analisis-ig.json
- public/comando/comentarios-analisis.json
- public/comando/comentarios.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- public/temis-deploy.json
- public/temis.json
- src/forja/brep/RadialMenu.tsx
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
- ordenes/2026-11-12-regresion-fuera-del-taller.md
- public/comando/growth.json
- public/precomputed/caroteno-gemelos-color.json
- public/precomputed/caroteno-gemelos-fisica.json
- public/precomputed/water-hexamer-geom.json
- public/precomputed/water-hexamer-prisma-geom.json
- scripts/canon/
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/fuera-del-taller-verify.cjs
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/guiones/caroteno-gemelos.txt
- scripts/operador-revision-impresora-2026-10-31.out
- scripts/operador-revision-impresora-2026-10-31.py
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `node scripts/orden-gate.cjs` verde (el repo no cambia: solo esta orden).
- Hojas de contacto de las 50 caras (con pelo y la misma luz), 10 por hoja, cada una MIRADA por mí antes de darla por buena; las malas se rehacen o se marcan como malas.
- Chequeos medidos por cara: párpado sin pasar su tope, dientes centrados y sin encía a la vista cuando la boca abre.
- Un video mp4 (720, cabeza y cara a doses, pelo con física) que recorre todas con su nombre; revisado en cuadros sueltos antes de entregarlo.
- Entregables en `Downloads/GAIA-3D/` (laptop) y receta en `/mnt/d/gaia-3d/expresiones/lote50/`. No se publica nada. No se toca la base v23 ni la cara v5.

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
- evidencia:
- preguntas abiertas:
