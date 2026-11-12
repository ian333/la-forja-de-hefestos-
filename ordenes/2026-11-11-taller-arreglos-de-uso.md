# ORDEN: EL TALLER — arreglos de uso (lo que BLOQUEA según la auditoría del «usuario»)

BASE: 0229b0a

OBJETIVO: la auditoría de uso (`docs/forja-research/TALLER-AUDITORIA-DE-USO.md`, orden 2026-11-11-taller-auditoria-y-brecha)
ordenó 10 tropiezos. Aquí van los que son DEFECTOS claros (no rediseño; la cinta y el panel quedan como propuesta para
ian). Parte 1 (no toca lo que edita el agente de Medir):
  #3 las teclas del kernel (F, E, V, D, R, C…) ensucian el documento con el laboratorio abierto y dentro del boceto;
  #4 Encuadrar / ISO / SUP / FRE / Sección apagados con el laboratorio (y Encuadrar no mira lo aislado);
  #9 la barra de estado dice «Lienzo vacío» con 226 cuerpos;
  #6 «⚒ forjando…» no alcanza a pintarse antes de que la forja congele el hilo, y «Terminar» forja a 10 mm sin
     preguntar (corregir la profundidad es OTRA forja de 3–7 s) → al terminar el boceto se pide profundidad (y pasante)
     ANTES de forjar, con el perfil dibujado sobre la cara;
  A3 «de fábrica: encadenada» no explica.
Parte 2 (después de integrar Medir, misma orden): #1 la base y la cubierta no se dejan agarrar con rayos X prendido
(«lo que ves, lo agarras»: el primer clic agarra lo de enfrente, otro clic en el mismo punto agarra lo de atrás);
M11 Esc dentro del boceto no suelta la cara; M10 el doble clic en una cara chica no mete la cámara entre las piezas.

## YA-EXISTE (prueba de ausencia)
- Todo es corregir lo que ya existe en ForgeBRepStudio.tsx: `KEYMAP` y su oyente, los botones del visor (`btn-fit`, ISO,
  SUP, FRE, `btn-section-tool`), `meshBBox`/`refBoxes` (ya cuentan las piezas de referencia), `estado-texto`, el motor
  del yunque (`respiro`), `onSketchFinish` (rama del yunque), `yunque-bar`, `RefMesh` (`agarrable`), `verDeFrente`.
- La profundidad al forjar: los golpes ya traen `depth` y `pasante` (orden 2026-11-11-yunque-barrido-y-cierre); solo se
  pregunta antes en vez de después.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/SketchEditor.tsx
- scripts/taller-verify.cjs
- scripts/yunque-verify.cjs
- scripts/boceto-verify.cjs
- scripts/navegacion-verify.cjs

## CREA
- scripts/uso-verify.cjs

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
- ordenes/2026-11-11-taller-arreglos-de-uso.md
- docs/forja-research/TALLER-AUDITORIA-DE-USO.md
- docs/forja-research/TALLER-BRECHA.md

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `scripts/uso-verify.cjs` (iangpu, GPU real) con el LABORATORIO abierto:
  - la barra de estado dice «Taller · N cuerpos…» (no «Lienzo vacío»);
  - oprimir F, E, V, X, R, C, G, D: el documento NO cambia (0 operaciones, 0 componentes, sin «Error:» en el estado, el
    dictamen no se abre); dentro de un boceto del yunque, R y C cambian la herramienta del boceto y nada más;
  - Encuadrar, ISO, SUP, FRE y Sección están prendidos; tras alejar la cámara, Encuadrar regresa el laboratorio al
    cuadro (su caja proyectada cabe en el visor); con una pieza aislada, Encuadrar la llena; Sección corta (menos
    triángulos visibles / plano de corte activo);
  - al terminar un boceto del yunque NO se forja: sale «profundidad» con 10 seleccionado; teclear 5 + Enter forja UNA vez
    a 5 mm (kernel: área × 5); «Descartar» no deja golpe; el aviso «forjando» está en pantalla durante la forja;
  - parte 2: con rayos X prendido, clic en la cubierta la agarra; otro clic en el mismo punto agarra lo de atrás; Esc
    dentro del boceto conserva la cara agarrada; doble clic en una cara chica deja la cámara fuera de la pieza.
- `taller`, `navegacion`, `yunque`, `mover`, `boceto` siguen pasando (ajustados a «profundidad antes de forjar» y, en
  la parte 2, a la regla nueva de rayos X). tsc: 22 viejos, 0 nuevos. Censo igual. Gate VERDE.

## CIERRE (se llena al terminar)
- PARTE 1 (este commit) — orden vs entregado: mismos archivos (navegacion-verify y taller-verify no hizo falta tocarlos
  en esta parte). En ForgeBRepStudio.tsx: `docTaller` (OJO: `modoTaller` YA existía y es `?taller=1`), el oyente de
  `KEYMAP` se calla con boceto abierto o documento de taller, los 6 `disabled` del visor aceptan `refGeos`,
  `encuadrarTaller` (Encuadrar y ◎ aislar), `estado-texto` con rama de taller, `pintado()` (dos cuadros) antes de
  congelar el hilo, `yunqueListo` + barra `yunque-listo` (`yunque-prof`, `yunque-pasante`, `yunque-forjar`,
  `yunque-descartar`) + `PerfilEnCara` (el perfil en cian sobre la cara mientras se elige), texto de pieza comprada.
- números parte 1: `uso-verify` PASA 14/14 (estado «Taller · 226 cuerpos…»; 12 teclas sin cambiar el documento;
  5 botones prendidos; Encuadrar 2076 → 1153 mm = 1.7 diagonales con el blanco en el centro; aislar encuadra a 704 mm;
  SUP mira desde arriba; Sección abre su control; teclas dentro del boceto no tocan el documento; al terminar NO forja
  y pide profundidad; Descartar; 5 + Enter = UNA forja a 5 mm con el aviso visto; pasante). `boceto` 14/14, `yunque`
  24/24, `mover` 13/13, `taller` 16/16, `navegacion` 15/15. tsc: 22 viejos, 0 nuevos.
- evidencia: forja-shots/uso/01…06 (forja-dev8), revisadas a ojo (la barra de profundidad y el perfil en cian se ven).
- PARTE 2 (segundo commit; se hizo ANTES de integrar Medir, sobre las mismas líneas se resolverá la fusión):
  · #1 «lo que ves, lo agarras»: `agarrable` ya no excluye a las fantasma; `turnoDeClic` (lo de enfrente gana; otro clic
    en el mismo punto con la misma tenaza pasa a lo de atrás; el segundo clic de un doble clic no avanza); aviso en la
    caja de lo agarrado cuando es fantasma. `taller-verify` G se reescribió a la regla nueva: primer clic = `cuerpo-base-fi`
    (fantasma), otro clic en el mismo punto = `hs1` (el disipador de atrás).
  · M11: `bocetoAbiertoRef` — Esc dentro del boceto ya no suelta la cara. M10: `verDeFrente(…, piso)` = 0.75 × el tamaño de
    la pieza. L2: la vista de llegada se PONE (dur 0), no se vuela.
  · hallazgos propios al probar: (a) el auto-encuadre (`lastFitSpan`) regresaba la cámara a la vista de llegada cuando la
    caja de la escena crecía > 20 % (mover una pieza lejos): ahora un documento de piezas de referencia se encuadra UNA vez
    (`fitDeRefs`); (b) el piso del zoom era 0.2 × el tamaño de la escena, así que mover una pieza 600 mm empujaba la
    cámara de 195 a 288 mm, y además no dejaba acercarse a un barreno: en un taller el piso es fijo (25 mm).
  · ENMIENDA de la orden: se agregó `SketchEditor.tsx` a TOCA por UNA línea de estilo — el título del boceto (que
    metió la orden del boceto) se angosta en pantallas chicas (`clamp(90px, 12vw, 240px)`); a 1536×864 la barra ya no cabía (M12).
- números parte 2: `uso-verify` PASA 17/17 (Esc conserva la cara; cara de 565 mm² en pieza de 260 mm → cámara a 195 mm;
  mover 600 mm: blanco 0.00 mm, misma dirección, misma distancia). `taller` 16/16, `navegacion` 15/15 tras el último
  cambio; `boceto` 14/14, `yunque` 24/24, `mover` 13/13 con todo menos el piso fijo del zoom (la regresión completa se
  corre al integrar Medir, antes de cualquier deploy). tsc: 22 viejos, 0 nuevos.
- lo que NO se hizo de la auditoría y queda para decisión de ian: la cinta de arriba y el panel El Taller (propuesta
  del agente, sin integrar), el panel «SUS JUECES» abierto al llegar, el blanco de la cámara corrido del modelo (L7),
  el laboratorio rotulado «ROBOT · plantilla» en el lobby (L1), el radial y la paleta S con herramientas del kernel.
