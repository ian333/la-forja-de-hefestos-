# ORDEN: EL REPARTO DE LA SEMANA 4 — lo que cacharon los clientes (N1 números, N2 papel) y, después, la revisión del molde de un tercero

ESTADO: hoy
PRIORIDAD: 1

BASE: d675896

OBJETIVO: ian (2026-11-05): «simula que le estás construyendo el software a clientes… no te pares, arranca y corrige todo lo que
puedas en iangpu». El panel de 8 clientes (`Downloads/la-forja-clientes/00-RESUMEN.md`) dejó una lista de defectos y un producto
que falta (revisar el molde DEL MOLDISTA). Se lanzan cuando la orden M esté fusionada: N1 (los números) y N2 (el papel). La orden R
(la revisión del molde de un tercero) se escribe con los moldes reales que se están descargando en `/mnt/d/moldes-terceros/`.

| Orden | Qué | Copia iangpu · puerto |
|---|---|---|
| N1 · los números que cacharon los clientes | contracción con la ficha, potencia del agua con el ciclo, presión de botadores, un ciclo con desglose | forja-dev5 · 5196 |
| N2 · el papel que cacharon los clientes | BOM completa, pilares y KO en la expulsora, corte con la caja hueca, escala, cuentas, jerga fuera | forja-dev6 · 5197 |

## TOCA
(este superticket solo coordina; lo que entra aquí entra POR FUSIÓN de una rama cuyo gate salió VERDE en su worktree)

## CREA
- ordenes/2026-11-05-n1-los-numeros-que-cacharon-los-clientes.md
- ordenes/2026-11-05-n2-el-papel-que-cacharon-los-clientes.md

## BORRA
- (nada)

## PREEXISTENTE
(sucios de otras sesiones en el árbol principal al crear el reparto; los worktrees nacen limpios)
- public/comando/analisis-ig.json
- public/comando/comentarios-analisis.json
- public/comando/comentarios.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- public/temis-deploy.json
- public/temis.json
- src/forja/brep/ForgeBRepStudio.tsx
- src/lib/physics/em.ts
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
- docs/PLAN-MVP-LA-PLUMA.md
- docs/investigacion-arco/00-CONTEXTO.md
- docs/investigacion-arco/03-atmosfera-con-campos.md
- models/step/banco-arco/CP_Radial_D30.0mm_P10.00mm_SnapIn.step
- models/step/banco-arco/CP_Radial_D35.0mm_P10.00mm_SnapIn.step
- models/step/banco-arco/C_Rect_L31.5mm_W13.0mm_P27.50mm_MKS4.step
- models/step/banco-arco/DIP-14_W7.62mm.step
- models/step/banco-arco/Fuseholder_Cylinder-6.3x32mm_Schurter_0031-8002_Horizontal_Open.step
- models/step/banco-arco/Heatsink_125x35x50mm_3xFixationM3.step
- models/step/banco-arco/LEEME.md
- models/step/banco-arco/LICENSE-pico2.txt
- models/step/banco-arco/LRS-1200-3D.stp
- models/step/banco-arco/TO-220-3_Vertical.step
- models/step/banco-arco/rpi_pico2.step
- ordenes/2026-11-04-banco-arco-biblioteca.md
- ordenes/2026-11-04-banco-arco-ensamble.md
- ordenes/2026-11-04-banco-arco-vivo.md
- public/comando/growth.json
- public/modelos/banco-arco/cap-35.bin
- public/modelos/banco-arco/disipador-125.bin
- public/modelos/banco-arco/lrs-1200.bin
- public/modelos/banco-arco/pelicula-mks4.bin
- public/modelos/banco-arco/pico2.bin
- public/modelos/banco-arco/portafusible.bin
- public/modelos/banco-arco/to220.bin
- public/precomputed/caroteno-gemelos-color.json
- public/precomputed/caroteno-gemelos-fisica.json
- public/precomputed/water-hexamer-geom.json
- public/precomputed/water-hexamer-prisma-geom.json
- scripts/arco-fisica-prueba.cjs
- scripts/canon/apuntar2.out
- scripts/canon/apuntar2.py
- scripts/canon/canales_gota.out
- scripts/canon/canales_gota.py
- scripts/canon/canon_corriente.out
- scripts/canon/canon_corriente.py
- scripts/canon/canon_gota.out
- scripts/canon/canon_gota.py
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/forja-multicuerpo-diag.cjs
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/guiones/caroteno-gemelos.txt
- scripts/investigacion-arco/01_ondas_control_optimo.py
- scripts/investigacion-arco/02_energia_en_la_punta.out
- scripts/investigacion-arco/02_energia_en_la_punta.py
- scripts/investigacion-arco/03_atmosfera_con_campos.out
- scripts/investigacion-arco/03_atmosfera_con_campos.py
- scripts/investigacion-arco/06_operador_canales_control.py
- scripts/investigacion-arco/07_charco_resonante.py
- scripts/investigacion-arco/09_campo_real_arc_blow.py
- scripts/investigacion-arco/10_estado_del_arte_seguridad.out
- scripts/investigacion-arco/10_estado_del_arte_seguridad.py
- scripts/investigacion-arco/__pycache__/01_ondas_control_optimo.cpython-310.pyc
- scripts/la-pluma/README.md
- scripts/la-pluma/extra.out
- scripts/la-pluma/extra.py
- scripts/la-pluma/extra2.out
- scripts/la-pluma/extra2.py
- scripts/la-pluma/la_pluma.out
- scripts/la-pluma/la_pluma.py
- scripts/la-pluma/netlist_referencia_D.cir
- scripts/operador-revision-impresora-2026-10-31.out
- scripts/operador-revision-impresora-2026-10-31.py
- scripts/playlist-tutoriales.py
- scripts/precompute-banco-arco.cjs
- scripts/precompute-caroteno-gemelos.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- src/forja/brep/ArcoVivo.tsx
- src/forja/brep/CampoReal.tsx
- src/forja/brep/arcoFisica.ts
- src/lib/physics/__tests__/em.test.ts
- src/lib/physics/campoB.worker.ts
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA
- cada orden cierra con su gate VERDE, su captura juzgada y su número; tras la fusión: tsc, cubo, banco, deploy verificado.

## CIERRE (se llena al terminar)
