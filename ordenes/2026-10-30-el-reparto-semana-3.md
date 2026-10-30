# ORDEN: EL REPARTO DE LA SEMANA 3 — el paquete estándar v1 (el molde en STEP con nombre ISO, el reporte de análisis)

ESTADO: hoy
PRIORIDAD: 1

BASE: 43c83c5

OBJETIVO: ian (2026-10-30): «hay normativas internacionales; empecemos por entregar los documentos estándar, validaciones
estándar y videos; ya estamos cerca» y «jalo al plan». La semana 3 del plan: (K) el molde en STEP con la BOM en términos ISO y el
cajetín ISO 7200; (L) el reporte de análisis por secciones como lo entrega la industria, después de arreglar el volumen de la
pieza que reciben la E5 y la E6. Después, cuando L esté fusionada (cambia los números con que se decide): (M) EL DECISOR, el
agente que resuelve las decisiones de ingeniería; y (N) los videos automáticos por pieza, con el formato que salga del debate
del primer video (`Downloads/la-forja-video-1/debate/`).

## LAS ÓRDENES
| Orden | Qué | Copia iangpu · puerto | Archivos (región) |
|---|---|---|---|
| K · el molde en STEP y con nombre ISO | STEP del ensamble (B-Rep por cuerpo), BOM con ISO 12165 y designaciones de norma, cajetín ISO 7200 | forja-dev7 · 5198 | occt.ts, mold-drawings.ts, mold-drawing-set.ts, mold-assembly.ts, expediente.ts (láminas/BOM/STEP), ForgeBRepStudio.tsx (descarga del STEP) |
| L · el reporte de análisis | el volumen del sólido en la E5/E6; el reporte por secciones con imagen, número, límite y cita | forja-dev5 · 5196 | useMoldStudio.ts, estudio-molde-datos.ts, expediente.ts (reporte), ForgeBRepStudio.tsx (reporte) |

| P · el modo película (video 1) | sin interfaz, cámara con fov, cortes térmicos por la raíz de los postes, acero opaco | forja-dev6 · 5197 | ForgeBRepStudio.tsx (modo película, cámara, material, cortes), piel-futuro.ts, FocoMolde3D.tsx, foco-lentes.ts (pintar el campo interior), filma-camino.cjs |

**DECISIONES DE IAN sobre el video 1 (2026-10-30):** «va el mismo canal, de GAIA PRIME; no salgo a cuadro; sí la puerta; apruebo la
política del archivo». Plan: `Downloads/la-forja-video-1/00-EL-VIDEO-1.md`.

## RIESGOS DE FUSIÓN (declarados)
- expediente.ts y ForgeBRepStudio.tsx: K y L en regiones distintas.
- L mueve números dorados y la huella A PROPÓSITO (el agua cambia con el volumen correcto): el banco sale ROJO justo ahí y el
  coordinador re-graba con la razón de L. Orden de fusión: K → L.

## TOCA
(este superticket solo coordina; lo que entra aquí entra POR FUSIÓN de una rama cuyo gate salió VERDE en su worktree)
- ordenes/2026-10-30-k-el-molde-en-step-y-con-nombre-iso.md
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/occt.ts
- src/forja/mold/mold-assembly.ts
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/mold-drawings.ts
- src/forja/mold/mold-plano-set.ts
- ordenes/2026-10-30-l-el-reporte-de-analisis.md
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/expediente.ts

## CREA
- ordenes/2026-10-30-k-el-molde-en-step-y-con-nombre-iso.md
- ordenes/2026-10-30-l-el-reporte-de-analisis.md
- ordenes/2026-10-30-p-el-modo-pelicula.md
- ordenes/2026-10-30-m-los-rojos-mal-juzgados-y-el-folio.md
- src/forja/mold/molde-step.ts

## BORRA
- (nada)

## PREEXISTENTE
(sucios de otras sesiones en el árbol principal al crear el reparto; los worktrees nacen limpios)
(y commiteados a main por la sesión de los reyes bajo su propia orden — 47f908b, 3717c01, ccd1509 — no son de este reparto)
- scripts/guiones/gelrey.txt
- scripts/guiones/gotarey.txt
- scripts/guiones/salrey.txt
- scripts/guiones/vasosuda.txt
- scripts/reels-1080.py
- videos/mol-etoh-el-gel-de-tus-manos.json
- videos/mol-h2o-el-vaso-suda.json
- videos/mol-h2o-la-gota-que-no-cae.json
- videos/mol-h2o-la-sal-no-desaparece.json
- public/comando/analisis-ig.json
- public/comando/comentarios-analisis.json
- public/comando/comentarios.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- scripts/comentarios.py
- scripts/metricas-instagram.py
- scripts/metricas-youtube.py
- scripts/video.sh
- scripts/voz-check.py
- src/cinematic/CinematicMolecule.tsx
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
- scripts/blender-a-cuadros.sh
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/guiones/caroteno-gemelos.txt
- scripts/guiones/hielof.txt
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/mol-h2o-el-hielo-flota.json
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA
- cada orden cierra con su gate VERDE, su captura 4K juzgada y su número; tras la fusión: tsc, el cubo, el banco con los dorados
  re-grabados con razón, y producción verificada (sello + bundle).

## CIERRE (se llena al terminar)
