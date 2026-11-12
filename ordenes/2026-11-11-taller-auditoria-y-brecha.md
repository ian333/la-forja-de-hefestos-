# ORDEN: EL TALLER — auditoría de uso (un «usuario» que la usa como ian) y la brecha contra Fusion/FreeCAD

BASE: 9de7a86

OBJETIVO: ian 11-10: «QUIERO TODAS LAS FUNCIONES QUE TIENE FUSION Y FREECAD… LA INTERFAZ DE USUARIO ESTÁ HORRIBLE… aún no
puedo ocupar la forja, solo tú… con herramientas de código abierto para no infringir». Dos agentes de solo lectura
(plan del 11-11): (1) uno USA el Taller como ian (mouse de verdad, a ojo) y anota cada tropiezo con captura; con eso deja
una PROPUESTA de barra de arriba para el laboratorio en una copia de iangpu — NO se fusiona: ian la ve y decide;
(2) otro cruza el corpus que YA existe contra lo que el Taller hace hoy y deja la lista ordenada de lo que falta.

## YA-EXISTE (prueba de ausencia)
- `docs/forja-research/` (memoria reference_forja_research_corpus: «NO re-correr esos workflows; leer de aquí primero»):
  `referencias-cad.md` (la biblia: Fusion/SolidWorks/Onshape/FreeCAD/Blender, doc oficial), `PLAN-MAESTRO-FORJA.md`,
  `ensambles-opensource.md`, `MOLDE-COMANDOS.md` (184 comandos), `AUDITORIA-VISUAL.md` (33 defectos, julio),
  `docs/forja-UI-AUDIT.md`. NADA de eso mira El Taller (tenazas, yunque: nacieron el 11-09/11-10). Por eso los dos
  documentos nuevos son sobre EL TALLER y citan el corpus en vez de repetirlo.

## TOCA
- (nada)

## CREA
- docs/forja-research/TALLER-AUDITORIA-DE-USO.md
- docs/forja-research/TALLER-BRECHA.md

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
- AUDITORÍA: hecha sobre forja-dev10 (mismo código que producción a313251; NO contra producción: no ensuciar la
  telemetría ni guardar versiones en rhea). Cada hallazgo con su captura (en `C:/Users/sebas/Downloads/taller-auditoria/`),
  qué esperaba un usuario de Fusion, y dónde está en el código (archivo:línea). Top 10 ordenado. Nada de «pasó»: a ojo.
- PROPUESTA de barra: antes/después a 1920×1080 y a 1536×864 en `Downloads/taller-propuesta/`; el archivo propuesto queda
  FUERA del repo (scratch + forja-dev10). No toca main.
- BRECHA: tabla función × (sólido del kernel / pieza del Taller) con archivo:símbolo de lo que YA existe, lo que falta y
  de qué depende; las 10 siguientes para rediseñar la base del laboratorio; licencias verificadas en su fuente SOLO de
  las librerías que se propongan. Sin tocar código.
- `node scripts/orden-gate.cjs` VERDE (solo los dos .md nuevos).

## CIERRE (se llena al terminar)
- orden vs entregado: los dos documentos, sin tocar código. Cada uno lleva arriba una nota del coordinador con lo que
  de su lista YA quedó arreglado esa misma noche.
- BRECHA (`TALLER-BRECHA.md`, agente de solo lectura, 354k tokens, 101 llamadas): 65 funciones en 12 familias. Sobre el
  sólido del kernel 44 sí / 11 a medias / 9 no; sobre una pieza del Taller (en a313251) 18 sí / 5 a medias / 4 en curso /
  38 no. El hueco es de CABLEADO, no de motor: la cinta le habla al sólido del kernel y no a lo agarrado; el boceto no
  recibe el contorno de la cara (no hay cota «desde el borde»); la pieza forjada tira su sólido. Trae «las 10
  siguientes» y licencias verificadas en su fuente. Aviso suyo que hay que confirmar: no encontró en el repo el aviso
  visible ni el texto de la licencia LGPL del kernel (opencascade.js). 121 citas archivo:símbolo verificadas por script
  (que el símbolo existe, no que se alcance desde la interfaz).
- AUDITORÍA (`TALLER-AUDITORIA-DE-USO.md`, forja-dev10, GPU real, 1920×1080 y 1536×864, 26 capturas en
  `C:/Users/sebas/Downloads/taller-auditoria/`): TOP 10 con archivo:línea. Cazó tres cosas que las suites no veían:
  con rayos X prendido la BASE y la CUBIERTA no se agarran (las pruebas solo golpeaban piezas del alambre); teclear 20
  en una cota daba 30.920; y Esc dentro del boceto no hacía nada con algo agarrado (defecto del 11-09, en producción).
- PROPUESTA de barra para el laboratorio (parte 2 del agente «usuario»): al escribir este cierre sigue en curso en
  forja-dev10; NO se integra. Se anota aquí abajo cuando entregue.
- gate: VERDE (solo los dos .md y esta orden). BASE se movió de a313251 a 9de7a86: los agentes leyeron a313251, pero
  los documentos se integran encima de los commits de esa noche y el juez compara contra BASE.
