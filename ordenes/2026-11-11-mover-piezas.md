# ORDEN: MOVER PIEZAS — un cuerpo o una pieza del laboratorio se mueve con flechas o con número (y sus golpes van con ella)

BASE: 4ab5b62

OBJETIVO: ruta que le di a ian el 11-10 tras el yunque: «Mover piezas con las flechas»; plan del 11-11 (ian en el gym:
«te quiero dejar trabajando»). Al final, en el LABORATORIO: con un cuerpo o una pieza agarrados (tenaza Cuerpo / Pieza, o
el árbol), El Taller ofrece moverlo ΔX ΔY ΔZ en mm tecleando, o arrastrando las flechas en el visor; se guarda con el
documento, entra a Ctrl+Z, y los golpes del yunque siguen cayendo donde deben (antes y después de mover).
Solo TRASLACIÓN en esta orden: girar y los amarres (joints) van después.

## YA-EXISTE (prueba de ausencia)
- Las piezas de referencia se colocan con x/y/z + giro de su `RefPart` (`refPartMatrix`, `aplanarRefs`): eso es el dato
  GENERADO del laboratorio (laboratorio.json) y no se toca: lo movido a mano va ENCIMA, como los golpes (`movidas` en el
  doc), para que regenerar el laboratorio no borre lo que hizo la mano.
- MOVER ya existe para las placas del MOLDE: `moldMoveMode` + `moldOffset` + `moldMoveRef` y un `<TransformControls
  mode="translate">` de drei que envuelve al grupo de la placa agarrada y guarda su corrimiento al soltar
  (ForgeBRepStudio.tsx, «MOVER (Fusion)» en el render de `moldParts`). Es el patrón que se COPIA para las piezas de
  referencia: mismo gizmo, mismo «se guarda al soltar». `Move/Copy` de la cinta y `transformShape` mueven SÓLIDOS DEL
  KERNEL: no sirven a las mallas del laboratorio.
- Selección, árbol, caja de lo agarrado, historial (`DocSnap`), `serializeDoc`/`loadDoc`, golpes en el marco del doc: de
  las órdenes 11-09/11-10/11-11. Esto es un DIFF sobre eso.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- scripts/mover-verify.cjs

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
- ordenes/2026-11-11-medir.md
- ordenes/2026-11-11-taller-auditoria-y-brecha.md
- ordenes/2026-11-11-mover-piezas.md

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `scripts/mover-verify.cjs` (iangpu, GPU real) sobre el LABORATORIO:
  - teclear ΔX = 30 a una pieza (módulo) → la caja de TODOS sus cuerpos se corre 30.00 mm en X y nada más se mueve;
  - arrastrar la flecha X con el mouse → ΔX cambia, ΔY = ΔZ = 0 (va sobre su eje); soltar deja el número en la caja;
  - mover un cuerpo dentro de una pieza ya movida → los corrimientos se suman;
  - golpe DESPUÉS de mover (unir sobre una pieza impresa movida): el volumen sube lo esperado y el saliente aparece sobre
    la cara donde está AHORA la pieza (su caja crece del lado movido); mover DESPUÉS de golpear: la pieza forjada se va
    entera, mismo volumen;
  - Ctrl+Z regresa el movimiento; guardar (serializeDoc) → cargar → todo vuelve a su sitio movido; «regresar a su sitio»
    lo pone en 0.
  - capturas a 1920×1080 revisadas a ojo (flechas visibles sobre lo agarrado, pieza corrida).
- `taller-verify`, `navegacion-verify`, `yunque-verify` siguen pasando. tsc: 22 viejos, 0 nuevos. Censo igual. Gate VERDE.

## CIERRE (se llena al terminar)
- orden vs entregado: mismos archivos (ForgeBRepStudio.tsx + scripts/mover-verify.cjs). Solo traslación, como decía.
- qué quedó: `movidas` en el doc (por llave del Taller; el corrimiento de un cuerpo = la suma de su cadena:
  `corrimientoDe`), `refGeos` dibuja cada hoja corrida, fila «mover X Y Z ✥ ↺» en la caja de lo agarrado (cuerpo o
  pieza), flechas con el `TransformControls` de drei colgado del grupo de lo agarrado (`moverRef`, se guarda al soltar,
  al medio milímetro), golpes guardados en el marco SIN mover de su pieza (`marcoDeGolpe` + `planoCorrido`): viajan con
  ella; el STEP que se baja sale donde está la pieza ahora; `movidas` entra al historial y a guardar/cargar; QA
  `__forgeBrep.mover` (`movidas`, `de`, `mover`, `caja`, `pantalla`).
- hallazgo: el gizmo de drei NO se puede usar como envoltura dentro del grupo girado de la escena: se cuelga de su
  PROPIO grupo (no del hijo) y sale en el origen con ejes del visor. Va fuera del grupo girado, con `object={ref}` y
  `space="local"`. OJO: «MOVER (Fusion)» de las placas del molde usa el patrón de envoltura y lee la posición del HIJO al
  soltar (`moldMoveRef`): por lo mismo es probable que no guarde nada. No se tocó (fuera de esta orden); queda anotado.
- números: `mover-verify` PASA 13/13 (ΔX=30 → caja [30,0,0] y la otra pieza [0,0,0]; flecha X arrastrada 30 → 133 con
  ΔY=ΔZ=0; cuerpo dentro de pieza [30,0,12]; golpe tras mover +500 mm³ sin que la caja brinque; mover tras golpear
  [0,−20,0] mismo volumen; Ctrl+Z; guardar → limpio → cargar; regresar a su sitio). `taller` 16/16, `navegacion` 15/15,
  `yunque` 24/24 sobre lo fusionado. tsc: 22 viejos, 0 nuevos.
- evidencia: forja-shots/mover/01…05 (forja-dev8 y forja-dev11), revisadas a ojo: flechas en el centro del módulo con Z
  azul hacia arriba; el módulo corrido 133 mm.
- preguntas abiertas / lo que NO se hizo: girar; copiar; imanes al mover (pegar cara con cara = amarres); el árbol no
  marca qué está movido; mover no revisa choques.
