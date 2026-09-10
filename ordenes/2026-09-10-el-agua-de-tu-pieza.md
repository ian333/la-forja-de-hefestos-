# ORDEN: EL AGUA DE TU PIEZA — las líneas de enfriamiento (E8) sobre la pieza soltada, no sobre el cubo

ESTADO: proximo
PRIORIDAD: 3

BASE: 22674c9

OBJETIVO: ian (2026-09-10): «NO VEO LOS BOTADORES NI LAS LÍNEAS DE ENFRIAMIENTO… yo preferiría que se vea todo el molde».
Hoy el molde de la carcasa termina en E5 (placas, insertos, bebedero); el agua es la estación 8 y solo está
cableada para el cubo (`estacion8Dado`, `cicloEstacion8`). Al final de esta orden las líneas de agua §9 (plug
JP-352, H = 4·D, paso W ∈ [H, 2H], que la hoja de análisis YA cotiza en números) se dibujan en el 3D del molde de
la pieza soltada, en su placa, respetando los insertos, y la leyenda del paso 6 pasa de «✗ agua (E8 cubo)» a «✓ agua».

## YA-EXISTE (prueba de ausencia)
- `estacion8Dado`/`cicloEstacion8` (useMoldStudio) dibujan el agua del CUBO; `mold-drawing-set` ya pone las líneas
  en la lámina de la placa; la hoja de análisis dice «JP-352 · ⌀9.53 · H 38.1 · W 66.7» para la carcasa: la
  geometría del circuito existe como números, no como acero.
- El ciclo por pieza (E1→E5 con `piezaSpec`) es el patrón a extender: E8 por pieza = misma función con la
  huella de la pieza y las placas de `colocacionEnLaBase`.
- NO existe: E8 para `ciclo.pieza`; el runner ya tiene el check «agua» en el paso 6 (hoy ✗).
## TOCA (probable; se confirma al empezar)
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/ForgeBRepStudio.tsx
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json
## CREA
- public/evidencia/2026-09-10-el-agua-de-tu-pieza/resultados.json
- public/evidencia/2026-09-10-el-agua-de-tu-pieza/agua-en-el-molde.png
- public/evidencia/2026-09-10-el-agua-de-tu-pieza/paseo-contactos.png
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
- Paso 6: el check `agua` del RUNNER pasa (rol `agua` en `data-roles`), sin quitar ningún check.
- Las líneas no atraviesan insertos ni pieza (`mold-interference`: 0 traslapes) y su paso cumple W ∈ [H, 2H].
- La lámina de la placa y el 3D dicen las MISMAS líneas (misma fuente).
- Paseo con el agua visible; video en ambas PCs; orden-gate VERDE.
## CIERRE (se llena al terminar)
