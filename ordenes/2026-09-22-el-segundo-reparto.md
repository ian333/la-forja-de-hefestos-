# ORDEN: EL SEGUNDO REPARTO — cuatro órdenes en paralelo tras la firma del ACTA R93

ESTADO: hecho
PRIORIDAD: 1

BASE: 554d7e6

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
- public/evidencia/2026-09-22-el-segundo-reparto/inspeccion-fusion.json
- ordenes/2026-09-22-las-reglas-de-hefestos.md
- ordenes/2026-09-22-los-botadores-con-nombre.md
- ordenes/2026-09-22-el-corte-unico.md
- ordenes/2026-09-22-el-segundo-reparto.md

## BORRA
- (nada)

## PREEXISTENTE
- videos/econ-anotar.json
- videos/econ-credito.json
- videos/econ-descuento.json
- videos/econ-enfrente.json
- videos/econ-hora.json
- videos/econ-lata.json
- videos/econ-lluvia.json
- videos/econ-merma.json
- videos/econ-naranja.json
- videos/econ-precio.json
- videos/econ-yunus.json
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

## CIERRE (2026-09-22 · MEDIDO sobre la fusión)
Cuatro ramas fusionadas en main sin conflictos (1beeb98 macho · 923d421 reglas · cc0c37d botadores · 554d7e6 corte). BASE movida a
554d7e6 (la fusión) para juzgar solo este cierre; cada rama pasó su orden-gate VERDE en su worktree.
- tsc: 67 = 66 de la base + `src/comando/Logos.tsx` (de LA CARA DE GAIA, no del molde). Cero nuevos del molde.
- ciclo-dado-test: **266/266** sobre la fusión. Sin ACTA R94 (ningún literal cambió).
- Inspección de las 4 piezas (una por una; en paralelo se agotan los contextos WebGL y la 3.1 sale «sin animZ» — artefacto):
  fallas **2/2/6/1 → 1/0/4/0** (carcasa/tapa/caja grande/ensamble). Detalle: `public/evidencia/2026-09-22-el-segundo-reparto/inspeccion-fusion.json`.
  - carcasa: 5.1 (los postes gruesos mandan el ciclo, 6.2×) — es la PIEZA del cliente.
  - caja grande: 1.1 −56.9 → 0 mm ✓. Quedan 2.3 (el inspector mide el pin con el radio de la cabeza en toda su altura: +2.2 mm
    parejo; el juez de la E10 da 0/80, según LOS BOTADORES), 2.5 (agua B a 1.16/1.55 mm de los retornos: ya estaba en la base, sin
    orden), 5.1 (pieza del cliente) y 6.2 (dos reglas de equilibrio — pregunta a ian).
- Preguntas abiertas para ian (juntas): macho 1 ceja del ensamble · 2 postes de las torres; botadores 1 una sola regla de
  equilibrio · 2 plano o pasador · 3 id de pieza; corte 1 núcleo de la flanera suelto · 2 broca que pasa la esquina · 3 check 267
  (pesar las placas: el cubo tenía la placa B vacía y nadie lo veía); reglas 1 expulsora al ras · 2 venteo 0.02 · 3 agua bajo la pieza.
