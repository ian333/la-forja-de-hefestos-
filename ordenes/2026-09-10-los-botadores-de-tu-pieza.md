# ORDEN: LOS BOTADORES DE TU PIEZA — los expulsores (E10) sobre la pieza soltada; el paso 6 deja de estar a medias

ESTADO: proximo
PRIORIDAD: 4

BASE: 22674c9

OBJETIVO: ian (2026-09-10): «no veo los botadores». Los expulsores son la estación 10 y solo existen para el cubo
(`estacion10Dado`). Al final de esta orden los pines §11 (⌀ por catálogo, colocados por agarre §11.2.5 como ya
hace `revisarModelo` para el dictamen) se dibujan en la placa expulsora del molde de la pieza soltada, con su
carrera, y el paso 6 del camino queda COMPLETO en su promesa original (placas, colada, agua, expulsores).

## YA-EXISTE (prueba de ausencia)
- `revisarModelo` ya coloca pines por agarre (§11.2.5, Fig 11.11) para medir el ensamble — los puntos existen.
- `estacion10Dado`/`cicloEstacion10` dibujan los expulsores del CUBO; la lámina «Placa expulsora» ya los dibuja
  para la carcasa (22 pines ⌀10 en el BOM).
- NO existe: E10 para `ciclo.pieza`; el runner tiene el check «expulsores» en el paso 6 (hoy ✗).
## TOCA (probable; se confirma al empezar)
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/ForgeBRepStudio.tsx
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json
## CREA
- public/evidencia/2026-09-10-los-botadores-de-tu-pieza/resultados.json
- public/evidencia/2026-09-10-los-botadores-de-tu-pieza/botadores-en-el-molde.png
- public/evidencia/2026-09-10-los-botadores-de-tu-pieza/paseo-contactos.png
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
- Paso 6: el check `expulsores` del RUNNER pasa; con agua y expulsores el paso 6 sale «ok» y el camino 8/8 en su
  forma de hoy (dicho: el enfriamiento en el tiempo va en el paso 3).
- Los pines coinciden con los de la lámina «Placa expulsora» (misma fuente) y no atraviesan agua ni insertos.
- Paseo con los botadores visibles; video en ambas PCs; orden-gate VERDE.
## CIERRE (se llena al terminar)
