# ORDEN: REGRESIÓN FUERA DEL TALLER — lo de la noche del 11-11 no rompe la pieza normal, las clases ni los otros bancos

BASE: ce31a5c

OBJETIVO: las ocho suites de la noche abren SIEMPRE el laboratorio, pero la noche tocó código que comparten todos los
documentos: `SketchEditor.tsx` (Cota con un clic en la línea, `confirmDim` que reemplaza, el oyente de teclas, Ctrl+Z en
captura), el oyente de teclas del estudio (callado con boceto abierto), `RadialMenu`, `onPointerMissed`, el encuadre de
llegada (una vez / dur 0) que también alcanza a BANCO DEL ARCO y BRAZO VIVO. El camino comercial es pieza del kernel,
moldes y clases. Antes de que ian despliegue: comprobar ESO, a tamaño de laptop también, y el build de producción.
Al final: una suite que maneja un documento del KERNEL con lo que cambió, las verificaciones viejas del kernel y tres
clases de croquis corridas contra el código de hoy, los otros dos bancos abiertos, y lo que haya salido, arreglado.

## YA-EXISTE (prueba de ausencia)
- `scripts/forja-brep-ui-verify.cjs` y `scripts/forja-sweep-loft-ui-verify.cjs` (las e2e de `forja-gate.cjs --ui`):
  extrude → barreno → fillet → shell por clics; NO bocetan a mano ni acotan. Se CORREN, no se tocan.
- `scripts/escuela/clase-drive.cjs` + `public/escuela/lecciones/*.json`: las clases acotan con el gancho `dimDist`
  (`dimline`), no con clics sobre la línea. Se corren tres (mec-u1-l1, mec-u2-l1, mec-u1-l3).
- No hay una prueba que, en un documento del kernel, dibuje un rectángulo, lo acote DANDO CLIC en sus lados, use las
  teclas E/F y el radial sobre el sólido: es lo que se crea.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/SketchEditor.tsx
- src/forja/brep/RadialMenu.tsx

## CREA
- scripts/fuera-del-taller-verify.cjs

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
- ordenes/2026-11-12-regresion-fuera-del-taller.md

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `scripts/fuera-del-taller-verify.cjs` (iangpu, GPU real):
  - documento nuevo del KERNEL: F agrega un redondeo y Ctrl+Z lo quita (las teclas del kernel SIGUEN vivas ahí); el
    radial de dos clics derechos trae las 8 del kernel, con letrero; Boceto → XY → rectángulo → Cota con clic en un lado
    → 30, el otro → 18 → Terminar → Extruir: el sólido mide 30 × 18 × 12 = 6,480 mm³ (±0.5 %); dentro del boceto C/R no
    tocan el documento y Ctrl+Z deshace el trazo, no el documento;
  - BANCO DEL ARCO v3 y BRAZO VIVO abren con todas sus piezas, sin errores de página, y la cámara los ENCUADRA (el
    blanco y la distancia son los de su vista de llegada; captura revisada a ojo).
- `forja-brep-ui-verify`, `forja-sweep-loft-ui-verify`, las tres clases (`CLASE_OK`, `checksFallidos=0`) y
  `yunque-barrido` 30/30 contra el código de hoy.
- `npx vite build` de la entrada del estudio en iangpu termina sin error (y, si el preview carga el kernel, `taller` y
  `uso` contra el bundle).
- capturas a 1536 × 864 revisadas a ojo: cuerpo agarrado con movida ≠ 0, Medir con A y B, la barra de profundidad, la
  barra del boceto con su título, el formulario de poner pieza. Lo que se vea cortado, se arregla aquí.
- las ocho suites de la noche siguen pasando si se toca código. tsc: 0 nuevos. Gate VERDE.

## CIERRE (se llena al terminar)
- `scripts/fuera-del-taller-verify.cjs` → `FUERA_DEL_TALLER_VERIFY: PASA (13/13)` en forja-dev8 (GPU real): en un documento
  del KERNEL las teclas siguen vivas (F redondea, Ctrl+Z lo quita), la Cota con clic en el lado deja 30 × 18, la extrusión
  mide 6,480 mm³, el radial trae las 8 del kernel con letrero y Esc lo cierra; BANCO DEL ARCO v3 y BRAZO VIVO abren y la
  cámara los encuadra (capturas vistas a ojo).
- Lo que SALIÓ y quedó arreglado aquí (cuatro defectos, ninguno lo veían las ocho suites):
  1. El radial se quedaba ABIERTO con Esc en un documento del kernel (su oyente se re-registraba en cada render y perdía
     la tecla): oyente estable en `RadialMenu.tsx`.
  2. Laptop 1536 × 864: la fila de «mover» no cabía en el riel; ✥ y ↺ quedaban FUERA de la caja y «133.5» se leía «133».
     Ahora son dos renglones («mover · ✥ flechas · ↺ regresar» y abajo X Y Z, sin flechitas de número).
  3. Con el árbol abierto, el formulario de «poner una pieza comprada» nacía abajo del borde del riel (parecía que el
     botón no hacía nada): al abrir se trae a la vista (`aLaVista`).
  4. El título del boceto («Cortar · <pieza>») iba en la barra de arriba y escondía cinco restricciones bajo
     Cancelar/Terminar: pasó ENTERO a la barra de estado de abajo.
- Regresión con el código final (forja-dev8): uso 23/23 · navegacion 15/15 · taller 16/16 · yunque 24/24 · mover 13/13 ·
  boceto 17/17 · piezas 10/10 · medir 57/57 · fuera-del-taller 13/13 · `yunque-barrido` 30/30 · tres clases `CLASE_OK`
  (mec-u1-l1, mec-u2-l1, mec-u1-l3; checksFallidos=0). tsc: los 22 errores viejos de `ForgeBRepStudio.tsx`, 0 nuevos,
  0 en `SketchEditor.tsx` y `RadialMenu.tsx`.
- `npx vite build --config vite.forja-only.config.ts` en iangpu con el código final: rc 0, «built in 16.10s».
- Capturas a 1536 × 864 revisadas a ojo (seis): `Downloads/taller-noche-11-11/laptop-1536x864/`.
- NO se hizo / queda dicho:
  - `forja-brep-ui-verify` y `forja-sweep-loft-ui-verify` dan timeout esperando `__forgeBrep.ready` TAMBIÉN en a313251
    (el estudio ya no arranca con sólido): están viejas desde antes de la noche. No se tocaron; `forja-gate.cjs --ui` las usa.
  - Las suites NO se corrieron contra el bundle de producción: con la config de una sola página el build no emite el wasm
    del kernel y `vite preview` no lo carga. Lo comprobado del bundle es que COMPILA.
  - A 1536 px la barra del boceto sigue dejando sus dos últimas herramientas (Fijar y Construcción) bajo
    Cancelar/Terminar; se alcanzan deslizando la barra. Es el diseño que ya tenía (barra que se desliza); va con la
    propuesta de cinta, no aquí.
