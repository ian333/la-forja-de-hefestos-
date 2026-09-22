# ORDEN: EL SEGUNDO REPARTO — cuatro órdenes en paralelo tras la firma del ACTA R93

ESTADO: hoy
PRIORIDAD: 1

BASE: 2b3ed99

OBJETIVO: trabajar en paralelo, con un agente Opus por orden (worktree propio + copia forja-devN en iangpu), lo que ian decidió el
2026-09-22, y fusionar en main UNA vez con tsc + cubo + inspección de las 4 piezas + camino de la carcasa; desplegar una vez.

## LAS CUATRO
- ordenes/2026-09-22-el-macho-de-la-caja-grande.md — dev3 :5199
- ordenes/2026-09-22-las-reglas-de-hefestos.md — dev4 :5195
- ordenes/2026-09-22-los-botadores-con-nombre.md — dev5 :5196
- ordenes/2026-09-22-el-corte-unico.md — dev6 :5197

## RIESGOS DE FUSIÓN (declarados)
- estudio-molde-datos.ts lo tocan el macho (E3), los botadores (colocación) y el corte (barrenarInsertos): regiones distintas.
- El rótulo «regla de Hefestos»: el 0.1·L es de LOS BOTADORES; el resto, de LAS REGLAS. mold-plano-set.ts: el corte (cutAll) y
  quizá los botadores (ids en láminas).
- Si dos órdenes cambian literales del cubo: ACTA R94 = la unión, re-medida sobre la fusión.

## TOCA
- ordenes/2026-09-22-el-macho-de-la-caja-grande.md
- ordenes/2026-09-22-las-reglas-de-hefestos.md
- ordenes/2026-09-22-los-botadores-con-nombre.md
- ordenes/2026-09-22-el-corte-unico.md
- ordenes/2026-09-21-el-reparto-de-la-inspeccion.md

## CREA
- ordenes/2026-09-22-las-reglas-de-hefestos.md
- ordenes/2026-09-22-los-botadores-con-nombre.md
- ordenes/2026-09-22-el-corte-unico.md
- ordenes/2026-09-22-el-segundo-reparto.md

## BORRA
- (nada)

## PREEXISTENTE
- docs/CANON-VIDEO.md
- public/comando/comentarios.json
- public/comando/respuestas-comentarios.json
- src/cinematic/CinematicMolecule.tsx
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
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- orden-gate VERDE en cada rama y en la fusión; tsc sin nuevos; ciclo-dado-test verde o ACTA R94 firmada por ian.
- inspección de las 4 piezas sobre la fusión: fallas 2/2/6/1 → menos; temis-deploy.json y bundle servido con el commit.
