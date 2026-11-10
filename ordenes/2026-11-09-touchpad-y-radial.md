# ORDEN: TOUCHPAD + RADIAL CON 2 CLICS DERECHOS — poder manipular el estudio sin mouse

BASE: 7a6fca3

OBJETIVO: ian 11-10: «pensemos en una manera para trabajar con el mousepad, con el mouse está cool… que el buscador se
abra con 2 clics derechos: uno es para mover, se abre siempre que dejas de mover el mouse» → «dale recio». Al final:
(1) el menú radial solo se abre con DOS clics derechos quietos (arrastrar con el derecho = mover, y ya);
(2) con touchpad: dos dedos = girar, Shift + dos dedos = mover, pellizco = zoom hacia el cursor; chip Auto/Mouse/Touchpad.
Con mouse nada cambia (salvo zoom hacia el cursor).

## YA-EXISTE (prueba de ausencia)
- Radial: `onContextMenu` del `.fb-viewport` (ForgeBRepStudio.tsx ~8700) → `setRadial`. En Windows `contextmenu` llega
  al SOLTAR el botón, y `OrbitControls` usa arrastre-derecho = pan → se abre tras cada pan. Se cambia ESE handler.
- Cámara: un solo `<OrbitControls makeDefault>` en `CadViewport` (~3696). La rueda es suya; no hay ningún manejo de
  touchpad (grep `deltaX|pointerType|ctrlKey.*wheel` = 0 en el estudio). El pellizco (ctrl+rueda) ya lo entiende
  OrbitControls. Se agrega un componente DENTRO del mismo Canvas que intercepta la rueda de dos dedos; nada de Canvas nuevo.
- En boceto la rueda es del croquis (`onWheel` → `setSketchZoom`) y los controles están apagados: no se toca.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- scripts/navegacion-verify.cjs

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
- public/precomputed/water-hexamer-geom.json
- public/precomputed/water-hexamer-prisma-geom.json
- scripts/canon/
- scripts/captions-pendientes.py
- scripts/estado-yt.py
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
- ordenes/2026-11-09-touchpad-y-radial.md

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- iangpu GPU real (forja-dev8, vite DEV :5009, Playwright) `scripts/navegacion-verify.cjs` sobre el LABORATORIO:
  - arrastre con el derecho mueve la vista y NO abre el radial; un clic derecho quieto tampoco; dos seguidos SÍ;
  - rueda de touchpad (deltas finos con deltaX) → la cámara GIRA (cambia el azimut, misma distancia y mismo blanco);
  - Shift + rueda de touchpad → MUEVE (cambia el blanco, misma dirección de vista);
  - pellizco (ctrl + rueda) → zoom (cambia la distancia);
  - rueda de mouse (±100, sin deltaX) en modo Auto sigue siendo zoom; el chip fuerza Mouse/Touchpad;
  - `scripts/taller-verify.cjs` sigue 16/16 (las tenazas no se rompen).
- censo igual: 0 `<Canvas` nuevos, 0 entradas vite, 0 html.
- `node scripts/orden-gate.cjs` VERDE.

## CIERRE (se llena al terminar)
- orden vs entregado: idéntico. TOCA solo ForgeBRepStudio.tsx (`navStore`, `ruedaEsTouchpad`, `NavegacionTouchpad` dentro
  del mismo Canvas, `zoomToCursor` en el OrbitControls, radial por doble clic derecho quieto en el `.fb-viewport`, chip
  `nav-modo`, QA `__forgeBrep.nav`); CREA solo scripts/navegacion-verify.cjs.
- números: `scripts/navegacion-verify.cjs` en iangpu (forja-dev8, vite DEV :5009, ANGLE D3D12 RTX 4070 Ti): PASA 15/15 —
  arrastre derecho mueve 144.9 mm sin radial, un clic no abre, dos sí, Esc cierra; rueda ±100 = zoom 1450→1243; touchpad
  gira 56.6° con la misma distancia y blanco; Shift mueve 122.1 mm sin girar; pellizco 1243→3468; chip Mouse 0° / chip
  Touchpad 38.9°. `scripts/taller-verify.cjs` sigue 16/16. tsc: los mismos 22 errores viejos de ForgeBRepStudio, 0 nuevos.
- evidencia: forja-shots/navegacion/01…03 (iangpu /home/ian/forja-dev8), revisadas a ojo.
- preguntas abiertas: el SENTIDO del giro/movimiento con dos dedos se probó con gestos simulados; si en el touchpad real
  de ian se siente al revés, es invertir un signo. La velocidad del pellizco es la de OrbitControls (rápida).
