# ORDEN: EL BOCETO — acotar sin pelearse (lo que tropezó al «usuario» al dibujar una ventana de 20 × 12)

BASE: 065e2b5

OBJETIVO: ian 11-10: «aún no puedo ocupar la forja porque no puedo usarla, solo tú». El agente que la usó como persona
(orden 2026-11-11-taller-auditoria-y-brecha, notas en vivo, tarea 4) no pudo dibujar una ventana de 20 × 12 mm exactos
sin pelear: (e15) la caja de cota trae «30.9» sin seleccionar y teclear 20 da «30.920»; (e10–e12) clic en una LÍNEA con
la herramienta Cota solo la selecciona (el letrero dice «clic en línea»); (e18) una segunda cota sobre lo mismo da
«conflicto» en rojo; (e17/e21) una cota no se puede cambiar ni quitar; (e07) el rectángulo no se ve entre el primer y el
segundo clic; (e20) Ctrl+Z no hace nada dentro del boceto (y deshace cosas del documento por detrás); (e05) nada dice
sobre qué pieza ni en qué modo se está bocetando. Al final: rectángulo con vista previa y medida viva → clic en un lado →
teclear 20 → Enter → clic en el otro → 12 → Enter; volver a dar clic al lado cambia o quita su cota; Ctrl+Z deshace el
último trazo; el boceto del yunque dice «Cortar · <pieza>».

## YA-EXISTE (prueba de ausencia)
- TODO esto es el editor que ya existe (`src/forja/brep/SketchEditor.tsx`): herramienta Cota (`tool === 'dim'`,
  `setDim`, `confirmDim`, caja `sk-dim-input`), rectángulo de dos clics (`rectC1`), previa de la LÍNEA (`lineCursor`) —
  la del rectángulo es la misma idea, que faltaba—, atajos de teclado. El resolvedor (`sketch-solver.ts`) NO se toca.
- El editor no tiene historial propio (grep `undo|hist` = 0 en SketchEditor.tsx): se agrega una pila chica en `commit`.
- El título del modo: el estudio ya sabe qué golpe se está bocetando (`yunquePend`); solo se lo pasa al editor.

## TOCA
- src/forja/brep/SketchEditor.tsx
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- scripts/boceto-verify.cjs

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
- ordenes/2026-11-11-boceto-acotar.md

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `scripts/boceto-verify.cjs` (iangpu, GPU real), con el mouse y el teclado de verdad, sobre un boceto del yunque en el
  LABORATORIO (y el mismo editor sirve al sólido del kernel):
  - el título dice el modo y la pieza; tras el primer clic del rectángulo, al mover el mouse se ve su previa con «ancho ×
    alto» (captura);
  - Cota + clic en un lado → sale la caja con su largo SELECCIONADO; teclear 20 + Enter → ese lado mide 20.00;
    lo mismo con el otro lado a 12 → el perfil que sale mide 20.00 × 12.00 y el golpe quita 20·12·prof (kernel, ±0.1 %);
  - clic otra vez en el mismo lado, teclear 25 + Enter → mide 25.00 y NO hay conflicto (una sola cota en ese lado);
    el botón de quitar la cota la quita;
  - clic en un lado y luego en el contiguo → la caja pasa a ser la del ÁNGULO (90);
  - Ctrl+Z dentro del boceto quita el último trazo y NO toca los golpes del documento.
- `yunque-verify` (dibuja rectángulos con la misma herramienta) 24/24, `taller` 16/16, `navegacion` 15/15, `mover` 13/13.
- `npx vitest run src/forja/brep/sketch-solver.test.ts` en iangpu sigue verde (el resolvedor no se tocó).
- tsc: 0 errores nuevos en los dos archivos. Censo igual. Gate VERDE.

## CIERRE (se llena al terminar)
- orden vs entregado: mismos archivos. SketchEditor.tsx: `titulo` (modo y pieza), previa del rectángulo con ancho × alto
  (`rectCursor`), Cota con UN clic en una línea (su largo) y clic en otra línea = ángulo (`dimDeAngulo`), la caja de cota
  abre con el valor SELECCIONADO, volver a acotar lo mismo REEMPLAZA la cota (`esLaCotaAbierta`) y el botón ✕ la quita,
  Ctrl+Z dentro del boceto (`histRef` en `commit`, oyente en captura que no deja pasar el Ctrl+Z al documento).
  ForgeBRepStudio.tsx: solo le pasa `titulo` al editor.
- hallazgo de fondo (estaba en producción desde el 11-09): dentro de un boceto con algo agarrado, ESC NO LLEGABA al
  editor. El oyente de teclas del editor se quitaba y se volvía a poner en cada render; el Esc del Taller (que suelta lo
  agarrado) provocaba un render a media tecla y el oyente recién puesto ya no recibía ESA tecla. Ahora se registra una
  vez y llama a lo último por un ref (`teclasRef`). Falta (toca la zona del agente de Medir, va después): que el Esc del
  Taller no suelte la cara mientras hay boceto abierto.
- números: `boceto-verify` PASA 14/14 (título «Cortar · Empuje…»; previa «27.1 × 16.9»; caja «26.8» enfocada y
  seleccionada → 20 → 20.000; 12 → 12.000 con 2 cotas; re-acotar a 25 sin conflicto y con ✕; ✕ deja 1 cota; ángulo 90.0;
  Esc cierra la caja; Ctrl+Z quita el círculo y deja el golpe del documento; el golpe sale de 20.000 × 12.000 y quita
  1,440 mm³). `yunque` 24/24, `mover` 13/13, `taller` 16/16, `navegacion` 15/15. vitest sketch-solver 18/18.
  tsc: SketchEditor 0 errores; estudio 22 viejos, 0 nuevos.
- evidencia: forja-shots/boceto/01…04 (forja-dev8), revisadas a ojo (la previa se ve; la caja de cota sale sobre el lado).
- preguntas abiertas / lo que NO se hizo (de la auditoría, tarea 4): teclear ancho y alto MIENTRAS se dibuja el
  rectángulo (cajas junto al cursor); acotar contra el borde de la cara (proyectar aristas); las etiquetas de cota son
  chicas y pálidas; a 1536×864 la barra del boceto no cabe; el botón derecho dentro del boceto dibuja (M13).
