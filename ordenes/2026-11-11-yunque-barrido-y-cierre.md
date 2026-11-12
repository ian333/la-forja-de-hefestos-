# ORDEN: EL YUNQUE — barrido de las 30 piezas impresas y cierre (exportar, pasante, deshacer, golpear cuerpos nuevos)

BASE: a313251

OBJETIVO: ian 11-11: «te quiero dejar trabajando… dame un plan» (se va al gym; tokens hasta las 4). El yunque está en
producción pero unir/cortar solo se probó sobre UNA pieza («Empuje», del alambre) y a ian le dije que probara base y
columna. Al final: (1) unir y cortar corren en las 30 piezas impresas (tejas de ~1 MB de STEP y camas = compuestos) o
queda dicho cuál no y por qué; (2) lo que le falta al yunque para servir de verdad: bajar la pieza forjada (STL y STEP)
para imprimirla, corte PASANTE, Ctrl+Z / Ctrl+Y de golpes, y unir/cortar sobre un cuerpo nuevo.

## YA-EXISTE (prueba de ausencia)
- Motor del yunque, `Golpe`, `golpes` en el doc, LOS GOLPES, `__forgeBrep.yunque` (orden 2026-11-10-el-yunque, a313251).
  Todo esto es un DIFF sobre eso.
- Exportar: `exportSTL`/`exportSTEP` del sólido del KERNEL (ForgeBRepStudio.tsx, `stepBlobUrl`, botón del riel). No sirven
  a las piezas de referencia (no entran al kernel): se reusa `exportSTEP` de occt.ts sobre el sólido forjado y un
  escritor de STL binario sobre la malla (hay uno en scripts/laboratorio/cuerpo-solidos.cjs: `stlBinario`).
- Deshacer: `undo`/`redo` + `histRef` del estudio (ops/sketch/components). Se le agregan los golpes; no hay pila nueva.
- Sin QA para sembrar golpes sin mouse: se agrega `__forgeBrep.yunque.plano(key, cara)` (el mismo `planoDeCaraRef`).

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/yunque-verify.cjs

## CREA
- scripts/yunque-barrido.cjs

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
- ordenes/2026-11-11-yunque-barrido-y-cierre.md
- ordenes/2026-11-11-medir.md
- ordenes/2026-11-11-taller-auditoria-y-brecha.md
- ordenes/2026-11-11-mover-piezas.md

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- línea base antes de tocar nada (forja-dev8 reconstruida tras el reinicio de iangpu): taller 16/16, navegacion 15/15,
  yunque 15/15, con la carga actual de iangpu (otro trabajo ocupa 14 núcleos).
- `scripts/yunque-barrido.cjs` (iangpu, GPU real): por CADA una de las 30 piezas impresas, sobre su cara plana más grande,
  un «unir» (10×10 mm × 5) y un «cortar» (10×10 × 3): tiempo de forja, error del kernel si lo hay, ΔV contra lo esperado
  (unir = +500 mm³ ±2 %; cortar: 0 < −ΔV ≤ 300). Tabla completa en el CIERRE; lo que falle se arregla o se declara.
- `scripts/yunque-verify.cjs` crece: bajar STL (triángulos y volumen de la malla bajada = los de la pieza forjada), bajar
  STEP (empieza con ISO-10303 y reimportado da el mismo volumen ±0.5 %), corte pasante (atraviesa: el volumen baja lo
  mismo con cualquier profundidad mayor), Ctrl+Z quita el último golpe y Ctrl+Y lo regresa, unir sobre un cuerpo nuevo
  le sube el volumen área × prof.
- `taller-verify` 16/16 y `navegacion-verify` 15/15 siguen. tsc: 22 errores viejos, 0 nuevos. Censo igual. Gate VERDE.

## CIERRE (se llena al terminar)
- orden vs entregado: mismos archivos. Desviación declarada en la vara del barrido: los golpes de prueba quedaron en
  unir 10×10×5 y cortar 6×6×3 (no 10×10×3), y el ΔV se mide con el volumen EXACTO del kernel (el de la malla baila unos
  mm³ en piezas redondas al remallar: dio dos falsas fallas en la primera corrida).
- barrido (`scripts/yunque-barrido.cjs`, forja-dev8, RTX 4070 Ti, iangpu con ~10–15 núcleos ocupados por otra sesión):
  PASA 30/30. Las 30 piezas impresas (13 tejas, 12 camas-compuesto, 5 del alambre) aceptan unir y cortar sin error del
  kernel: unir = +500.00 mm³ en las 30; cortar entre −40.6 y −108 mm³ (menos de 108 donde la pared mide < 3 mm); todas
  regresan a su volumen al quitar los golpes; malla a 0.2 en todas (el respaldo de deflexión no hizo falta). Tiempo de la
  primera forja (lee el STEP): 0.15–6.5 s, mediana 2.3 s (la más lenta: base-fd); las siguientes 0.1–3.6 s, mediana 1.1 s.
  El hilo se bloquea ese rato (sale «⚒ forjando…»); no se movió a un worker.
- cierre del yunque (todo en ForgeBRepStudio.tsx): `baseDePieza`/`golpearSolido` (motor partido en dos piezas reusables),
  aviso cuando un golpe no toca material, `armarBajada`/`bajarCuerpo` + fila «bajar este cuerpo: STL · STEP» en la caja
  de lo agarrado, `pasante` por golpe (botón ⇥ en LOS GOLPES), golpes en el historial (`DocSnap`) → Ctrl+Z / Ctrl+Y,
  unir/cortar sobre cuerpos nuevos, borrar un cuerpo nuevo se lleva sus golpes (`sinGolpe`), el plano del boceto del
  yunque ya no pasa por `sketch.plane3d` (`yunquePlano`: no ensucia el historial), y API sin mouse en
  `__forgeBrep.yunque`: `caraMayor`, `golpear`, `limpiar`, `pasante`, `tiempos`, `forjables`, `bajada`, `volumenDeStep`.
- números: `yunque-verify` PASA 24/24 (STL bajado: 3,580 triángulos y 588,003 mm³ = lo que se ve; STEP bajado 1.8 MB,
  reimportado 587,977 mm³ = kernel; pasante quita 403.5 mm³ contra 36 del ciego; Ctrl+Z ×2 y Ctrl+Y; unir sobre cuerpo
  nuevo +80.00 mm³; cascada 3 → 1 golpe). `taller-verify` 16/16, `navegacion-verify` 15/15. tsc: 22 viejos, 0 nuevos.
- evidencia: forja-shots/yunque/{barrido.json, 07b-pasante.png, 07c-golpe-sobre-cuerpo-nuevo.png} en forja-dev8.
- tropiezo pagado: rsync de CUALQUIER archivo a una copia con vite DEV vivo recarga la página y mata la prueba que esté
  corriendo ahí (vite vigila también `scripts/`). No sincronizar durante una corrida.
- preguntas abiertas / lo que NO se hizo: la forja sigue en el hilo principal (hasta ~6 s congelado en las tejas grandes);
  no se puede reabrir el boceto de un golpe; el aviso de «la cara del golpe ya no existe» al regenerar el laboratorio
  sigue sin hacerse (hoy el golpe se aplica en sus coordenadas o avisa «no tocó material»).
