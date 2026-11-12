# ORDEN: EL RADIAL DEL TALLER — los dos clics derechos ofrecen lo del Taller (hoy ofrecen 8 herramientas del kernel)

BASE: c40232e

OBJETIVO: ian pidió el menú radial con dos clics derechos (11-10). La auditoría de uso (#5 y tabla del punto 6): con el
laboratorio abierto el radial trae «8 íconos sin letrero: Boceto, Extruir, Revolución, Barreno, Redondeo, Chaflán,
Patrón, Plano» — ninguno sirve ahí y varios ensucian el documento (sólidos sueltos, «Error: 16392824»). Mismo defecto
que las teclas (ya calladas en la orden de arreglos de uso). Al final, en un documento de taller: el radial ofrece
Encuadrar, Medir, Rayos X y Mostrar todo; con una CARA plana agarrada suma De frente, Cuerpo nuevo, Unir, Cortar; con
un CUERPO o PIEZA suma Aislar, Ocultar y Mover; cada ícono lleva su letrero. El chip «S atajos del taller» (que abría
la paleta del kernel) abre ese mismo radial. En un documento con sólido del kernel el radial queda como hoy (con
letreros).

## YA-EXISTE (prueba de ausencia)
- `RadialMenu.tsx` (anillo de `items` {id, label, glyph, onPick}) y su uso en ForgeBRepStudio.tsx con la lista fija del
  kernel. Las acciones del Taller ya existen todas: `encuadrarTaller`, `frenteAgarrada`, `bocetoEnCara`, `alternarMedir`,
  `setRefAislado`, `toggleRef`, `setMoverOn`, `setRefRayos`. Solo se cambia QUÉ lista se le pasa y se le pintan letreros.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/RadialMenu.tsx
- scripts/uso-verify.cjs

## CREA
- (nada)

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
- ordenes/2026-11-11-radial-del-taller.md

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `scripts/uso-verify.cjs` crece: con el laboratorio abierto, dos clics derechos al vacío → el radial NO trae
  `radial-extrude` ni `radial-revolve` y SÍ `radial-encuadrar`, `radial-medir`, `radial-rayos`, con letreros visibles;
  con una cara plana de una pieza impresa agarrada → `radial-frente|nuevo|unir|cortar`, y `radial-cortar` abre el boceto
  sobre esa cara; con un cuerpo agarrado → `radial-aislar|ocultar|mover`; `radial-rayos` cambia rayos X; el documento
  no cambia (0 operaciones, sin «Error»). El chip de abajo abre el mismo radial.
- `navegacion-verify` (abre el radial con dos clics derechos y lo cierra con Esc) sigue 15/15; las demás suites igual.
  tsc: 0 nuevos. Gate VERDE.

## CIERRE (se llena al terminar)
- orden vs entregado: mismos archivos. ForgeBRepStudio.tsx: la lista del radial depende de `docTaller` y de lo agarrado
  (`encuadrar`, `frente`/`nuevo`/`unir`/`cortar` con una cara plana, `aislar`/`ocultar` con algo agarrado, `mover` con
  cuerpo o pieza, `medir`, `rayos`, `todo`); el chip de abajo abre ese radial en un taller («⚒ menú del taller»).
  RadialMenu.tsx: cada ícono lleva su letrero (a los lados nace pegado al botón, hacia afuera).
- hallazgo al probar: el clic DERECHO al vacío soltaba lo agarrado (R3F llama `onPointerMissed` también con el botón
  derecho), así que el radial nunca veía la selección. Ahora solo el clic izquierdo al vacío suelta.
- números: `uso-verify` PASA 23/23 (radial sin nada: encuadrar/medir/rayos con letreros y nada del kernel; rayos X
  0 ↔ 25 fantasmas; con pieza: aislar/ocultar/mover; con cara plana impresa: frente/nuevo/unir/cortar y «Cortar» abre
  el boceto; el chip abre el mismo radial; el documento no cambia). Regresión: `navegacion` 15/15, `taller` 16/16,
  `yunque` 24/24, `mover` 13/13, `boceto` 17/17, `piezas` 10/10, `medir` 57/57. tsc: 22 viejos, 0 nuevos.
- evidencia: forja-shots/uso/01b-radial-del-taller.png (forja-dev8), revisada a ojo.
- lo que NO se hizo: la paleta de la tecla S sigue siendo la del kernel (en un taller ya no se abre: ni con la tecla
  ni con el chip); el radial del kernel conserva sus 8 herramientas (ahora con letrero).
