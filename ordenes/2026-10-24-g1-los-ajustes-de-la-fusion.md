# ORDEN G1: LOS AJUSTES DE LA FUSIÓN — lo que las órdenes A–E se encontraron entre sí

ESTADO: hoy
PRIORIDAD: 1

BASE: 8f530f0

OBJETIVO: al fusionar D (QA) sobre G0 (la carrera arreglada), el control de la huella deja de morder (reproducía justo esa carrera):
se parte en dos — «pared 2.8» debe dar otra huella y «reloj congelado» debe dar la MISMA (regresión de G0). D midió que la regla de
C «diagonal < 5 mm → ¿pulgadas?» no caza la 1594C Box en pulgadas (5.10 mm): sube a 10 mm (regla de Hefestos; el Hammond más chico
mide 35.3 mm). Y los dorados de D, grabados contra eeeb24e, deben re-grabarse con la razón de B (presión de empaque).

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/stl.ts
- scripts/qa-huella.cjs
- scripts/qa-banco.cjs
- scripts/qa-LEEME.md
- scripts/qa-dorados/1594C-Box.json

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- public/comando/analisis-ig.json
- public/comando/comentarios-analisis.json
- public/comando/comentarios.json
- public/comando/growth.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- public/precomputed/caroteno-gemelos-color.json
- public/precomputed/caroteno-gemelos-fisica.json
- public/precomputed/water-hexamer-geom.json
- public/precomputed/water-hexamer-prisma-geom.json
- scripts/blender-a-cuadros.sh
- scripts/captions-pendientes.py
- scripts/comentarios.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/guiones/caroteno-gemelos.txt
- scripts/guiones/hielof.txt
- scripts/metricas-instagram.py
- scripts/metricas-youtube.py
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/yt-pendientes.sh
- src/cinematic/CinematicMolecule.tsx
- videos/atomo-c.json
- videos/atomo-ne.json
- videos/atomo-si.json
- videos/mol-h2o-el-hielo-flota.json
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
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA
- HUELLA_GATE VERDE ×3 sobre main fusionado; PAR_DE_CONTROL MUERDE; REGRESION_CARRERA VERDE.
- DORADOS ROJO exactamente en clamp/soporte/pilares/flecha (la orden B) → re-grabados con la razón; luego VERDE.
- El banco de rotos: las 5 piezas rotas detenidas por la puerta (acta CONFIABLE).

## CIERRE (se llena al terminar)
- (parcial, 2026-10-24 23:30) código hecho y en el commit; la evidencia del banco (huella ×3 + control «pared» + regresión «reloj
  congelado» + los 5 rotos + dorados) corre en iangpu (`/home/ian/el-plan/qa/semana1/`, log `qa-semana1.log`) y se anota aquí al terminar;
  los dorados se re-graban con la razón de la orden B cuando el banco confirme que se movieron SOLO clamp/soporte/pilares/flecha.
