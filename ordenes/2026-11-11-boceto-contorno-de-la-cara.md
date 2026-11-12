# ORDEN: EL BOCETO VE LA CARA — el contorno de la cara agarrada entra al boceto como referencia (acotar «desde el borde»)

BASE: 2a44f77

OBJETIVO: la brecha (`docs/forja-research/TALLER-BRECHA.md`, fila «Proyectar el contorno y las aristas de la pieza al
boceto» y #3 de «Las 10 siguientes») y la auditoría (M5: «la ventana se coloca a ojo: no hay forma de acotarla contra el
borde de la cara»). Es lo que pide el trabajo real de ian (ventanas para cables y soportes en la base: «a 12 mm de la
orilla»). Al final: al bocetar sobre una cara del laboratorio, su contorno (orilla y huecos) sale dibujado en el boceto
como geometría de REFERENCIA fija; los imanes se pegan a sus vértices y una cota entre un punto del boceto y un vértice
de la cara coloca la ventana exacta. La referencia no se extruye ni se mueve.

## YA-EXISTE (prueba de ausencia)
- El editor ya tiene líneas de CONSTRUCCIÓN (`SkLine.constr`: no se extruyen), puntos fijos (`SkPoint.fixed`: el
  resolvedor los salta), imanes a puntos (`computeSnap`) y cota entre dos puntos con ↔ / ↕ (`distX`/`distY`). Solo falta
  SEMBRARLE el contorno: `SketchEditor` recibe hoy `onFinish/onCancel/projScale/titulo` (nada de la cara).
- Las caras de una malla del laboratorio: `carasDeMalla` (triángulos por cara) y `planoDeCaraRef` (su plano). El contorno
  = las aristas de esos triángulos que no comparten dos triángulos de la misma cara. No existe esa función: se agrega
  `contornoDeCara` junto a `planoDeCaraRef`. El resolvedor (`sketch-solver.ts`) NO se toca.

## TOCA
- src/forja/brep/SketchEditor.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/boceto-verify.cjs

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
- ordenes/2026-11-11-boceto-contorno-de-la-cara.md

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `scripts/boceto-verify.cjs` crece (mismo boceto del yunque, mouse y teclado de verdad):
  - al abrir el boceto hay referencia: su caja mide lo que la cara (diagonal ±0.05 mm contra `yunque.cara.diag`) y sus
    puntos están fijos; el contador de grados de libertad no la cuenta;
  - Cota entre una esquina del rectángulo y un vértice de la referencia, con ↔ y 12 → esa esquina queda a 12.000 mm en X
    del vértice; con ↕ y 8 → a 8.000 en Y; la referencia no se movió;
  - el perfil que sale NO incluye la referencia (4 puntos) y el golpe cae donde dicen las cotas;
  - arrastrar un vértice de la referencia con Seleccionar no lo mueve; Cota sobre una línea de referencia no abre caja de
    largo (no se puede «acotar» lo fijo);
  - captura: el contorno se ve sobre la cara.
- Las demás suites siguen: `yunque` 24/24 (dibuja rectángulos con referencia presente), `taller`, `navegacion`, `mover`,
  `uso`, `medir`; vitest del resolvedor 18/18; el boceto del KERNEL (sin referencia) no cambia. tsc: 0 nuevos. Gate VERDE.

## CIERRE (se llena al terminar)
- orden vs entregado: mismos archivos, sin crear nada. ForgeBRepStudio.tsx: `contornoDeCara` (aristas de la cara que no
  comparten dos triángulos de la misma cara, encadenadas en lazos, vértices juntados por posición, puntos alineados
  fuera, tope de 1,500 puntos), `yunqueContorno` y la prop `referencia` al editor. SketchEditor.tsx: la referencia va
  PRIMERO en el modelo (puntos fijos `[0, nRefPts)`, líneas de construcción `[0, nRef)`), se pinta en cian sin bolitas,
  no se arrastra, no se recorta y no se «acota» (clic de Cota sobre una de sus líneas solo la selecciona: sirve para
  el ángulo contra otra); el pie y el QA cuentan solo lo que dibujó la mano (`nRef`, `nRefPts`, `lines()[i].ref`).
- números: `boceto-verify` PASA 17/17 — referencia de 4 líneas con diagonal 136.015 = la de la cara; cota ↔ 12 y ↕ 8
  contra un vértice de la cara → dx = 12.0000, dy = 8.0000 y el boceto queda «Totalmente restringido»; el vértice de la
  referencia se movió 0 al arrastrarlo; Cota sobre una línea de referencia no abre caja; el golpe sale de 20.00 × 12.00.
  Regresión: `yunque` 24/24, `taller` 16/16, `navegacion` 15/15, `mover` 13/13, `uso` 17/17, `medir` 57/57; vitest del
  resolvedor 18/18; tsc 22 viejos, 0 nuevos (SketchEditor 0).
- evidencia: forja-shots/boceto/03b-acotado-contra-el-borde.png (forja-dev8), revisada a ojo: el contorno en cian rodea
  la cara y el rectángulo queda blanco (restringido).
- lo que NO hace: solo se proyecta el contorno de LA cara agarrada (no las aristas de otras caras ni de otras piezas);
  un borde curvo entra como polilínea (sin imán a su centro); no hay cota punto-a-línea (se acota contra un VÉRTICE con
  ↔ / ↕); la prueba cubrió una cara rectangular simple, no una de cientos de vértices (para esas hay tope de 1,500).
