# ORDEN: EL PASO 8 EXISTE — EL EXPEDIENTE de la pieza: dictamen, decisiones, cotización y planos en UN archivo

BASE: 0869ba7

OBJETIVO: golpe 5 de PARA CERRARLO. ian (2026-09-07): «COMPLETA EL HAPPY PATH».
Hoy el expediente §13.10 (decisiones + tryout) se calcula en `revisarModelo` pero solo se ve en el modo
lote; el dictamen de la pieza soltada no lo enseña ni lo exporta; la cotización vive en el panel del
ciclo; los planos en su overlay. Al final de esta orden, la pestaña EXPEDIENTE junta las cuatro cosas
en UN archivo HTML imprimible (dictamen → decisiones → cotización → planos → tryout), dice lo que falta
en vez de rellenarlo, y el runner mide el paso 8. El video del enfriamiento va después (ian, 09-04).
## EJERCICIOS
- expediente-gesto · Hay puerta para el expediente junto a la pieza · pestaña `parte-lente-expediente` · overlay con las 4 secciones en verde/rojo según existan
- dictamen-completo · El expediente recibe el dictamen ENTERO · `onRevision` en RevisarPiezaPanel · no solo la fila: criterios con § y detalle, y las decisiones §13.10 con opciones reales y firmas pendientes
- un-archivo · Dictamen → decisiones → cotización → planos → tryout en UN HTML imprimible · `expedienteHTML` + `btn-expediente-descargar` / `btn-expediente-imprimir` · lo que falta se DICE en el archivo («sin planos: no se generó…»), no se rellena
- cotizacion-de-la-pieza · La hoja de cotización es la de ESTA pieza · `cotizacionPieza(ciclo.pieza)` · la misma hoja que el panel del ciclo, adentro del archivo
- paso-8-verde · El runner mide el paso 8 · `## RUNNER` · gesto EXPEDIENTE + 3 checks (dictamen, cotización, ≥3 planos) → el camino queda 8/8 en su forma de hoy, con lo que falta dicho
- sin-regresion · Nada se rompe · gate · orden-gate VERDE, censo Canvas 8→8, cero pageerror
## YA-EXISTE (prueba de ausencia)
- `expediente.ts` decisionesDelPaquete/registrarDecision; `RevisionModelo.expediente` ya calculado en revisarModelo (revisar-modelo.ts:97); `cotizacionPieza/cotizacionSvg` (estudio-molde-datos 1289/1351); `RevisarLotePanel` lo pinta en modo lote. NO existía: expediente en el flujo de la pieza soltada ni exportable; `RevisarPiezaPanel` lo declaraba en su último renglón.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/RevisarPiezaPanel.tsx
- src/forja/brep/TemisBoard.tsx
- scripts/forja-drive.cjs
- scripts/camino-runner.cjs
- scripts/temis-tablero.cjs
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- ordenes/2026-09-07-el-paso-8-existe.md
- ordenes/2026-09-07-el-drop-conserva-el-solido.md
- ordenes/2026-09-07-el-paso-6-existe.md
- ordenes/2026-09-07-el-paso-7-existe.md
- public/evidencia/2026-09-07-el-drop-conserva-el-solido/resultados.json
- public/evidencia/2026-09-07-el-drop-conserva-el-solido/drop-con-solido.png
- public/evidencia/2026-09-07-el-paso-6-existe/resultados.json
- public/evidencia/2026-09-07-el-paso-6-existe/molde-de-la-pieza.png
- public/evidencia/2026-09-07-el-paso-6-existe/molde-antes-del-reencuadre.png
- public/evidencia/2026-09-07-el-paso-7-existe/resultados.json
- public/evidencia/2026-09-07-el-paso-7-existe/planos-del-molde.png
- public/evidencia/2026-09-07-el-paso-8-existe/resultados.json
- public/evidencia/2026-09-07-el-paso-8-existe/expediente-de-la-pieza.png
- public/evidencia/2026-09-07-el-paso-8-existe/paseo-v4-contactos.png

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol: videos, guiones, cine)
- src/cinematic/CinematicMolecule.tsx
- videos/CRONOGRAMA.json
- videos/atomo-ca.json
- videos/atomo-k.json
- videos/atomo-na.json
- videos/atomo-o.json
- videos/atomo-p.json
- videos/atomo-s.json
- videos/atomo-zn.json
- videos/mol-h2o-el-anillo-b.json
- videos/mol-h2o-el-hexamero-b.json
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
- videos/tutorial-19-bancos-estados-de-cuenta.json
- videos/tutorial-20-pdf-imprimir.json
- videos/tutorial-21-nota-de-credito.json
- videos/tutorial-22-gasto-operativo.json
- videos/tutorial-23-alta-de-proveedor.json
- videos/tutorial-24-buscar-clave-sat.json
- videos/tutorial-25-reportes-jugosos.json
- videos/tutorial-26-nota-venta-abarrotes.json
- videos/tutorial-27-corte-de-caja.json
- videos/tutorial-28-conteo-lector.json
- scripts/captions-pendientes.py
- scripts/guiones/butiricob.txt
- scripts/guiones/cuartetob.txt
- scripts/guiones/salb.txt
- scripts/guiones/sillab.txt
- scripts/guiones/sudorb.txt
- scripts/playlist-tutoriales.py
- scripts/reprogramar-yt.py
- videos/mol-h2o-el-cuarteto-b.json
- videos/mol-h2o-el-sudor-b.json
- videos/mol-h2o-la-sal-b.json
- videos/mol-h2o-la-silla-b.json

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- drive contra el dev aislado (symlinks) de iangpu: drop → MOLDE → PLANOS → EXPEDIENTE → overlay con 4 secciones en verde; el HTML descargado se abre y trae las 4
- runner completo · orden-gate VERDE · paseo regrabado

## CIERRE (se llena al terminar)
**6/6 EN VERDE · el expediente de la pieza en UN archivo · el runner mide el paso 8 OK (4/4) · el camino queda 7/8, 1 a medias.**

- orden vs entregado: idéntico. Dictamen completo (72/100 · 5 violan · 12 advierten) + 7 decisiones §13.10
  con opciones reales y 5 firmas pendientes + hoja de cotización de la pieza + 17 planos + plan de tryout,
  en un HTML imprimible que DICE lo que falta en vez de rellenarlo. El video del enfriamiento va después.
- números: runner 4/4 (overlay · dictamen · cotización · 17 planos). La primera corrida dio 3/4 porque
  cerrar el overlay de planos tiraba las láminas — arreglado en el paso 7.
- evidencia: expediente-de-la-pieza.png (4 tarjetas en verde) · resultados.json.
- lo que NO cumple (declarado): «8/8» no, porque el paso 6 es PARCIAL (agua/expulsores). El camino de la
  carcasa mide **7/8 · 1 a medias**, medido por la máquina, y así lo enseña Temis.
