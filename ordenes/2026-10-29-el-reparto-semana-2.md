# ORDEN: EL REPARTO DE LA SEMANA 2 — un veredicto, la inspección según Kazmer, los datos de tu planta, el expediente limpio

ESTADO: hoy
PRIORIDAD: 1

BASE: 54ea7ca

OBJETIVO: ian (2026-10-29): «dale mi hermano, ya hay tokens de nuevo, lanza Opus para lo pesado y siempre verificación… estamos
cerca de terminar». El «va» es a lo que pidió Kazmer al ver la película (`Downloads/la-pelicula/kazmer/LA-INSPECCION-SEGUN-KAZMER.md`)
y a la semana 2 del plan del debate (G y H, ya decididas el 2026-10-24). Cuatro órdenes en paralelo, una por agente Opus en su
worktree y su copia de iangpu; el coordinador (esta sesión) fusiona, verifica con los ojos, refilma, le vuelve a enseñar la película
a Kazmer y despliega UNA vez.

## LAS CUATRO ÓRDENES
| Orden | Qué | Copia iangpu · puerto | Archivos (región) |
|---|---|---|---|
| H · un veredicto | el dictamen se re-juzga con el agua de la E6, la p_fill de la E5 y el bebedero que se corta; dos columnas | forja-dev5 · 5196 | moldmachine.ts (paquete ~L380-460), mold-contratos.ts, revisar-modelo.ts, foco-lentes.ts, useMoldStudio.ts (ciclo), ForgeBRepStudio.tsx (dictamen, hoja: valores), MoldPanels.tsx (dictamen), expediente.ts (dictamen) |
| I · la inspección según Kazmer | los rojos se ven, la pieza siempre presente, un corte por lo medido, cita §6.3.1, una apertura, 5 puntos nuevos | forja-dev4 · 5195 | inspeccion-recorrido.ts, FocoMolde3D.tsx, ForgeBRepStudio.tsx (paso 7), guiones/pelicula-camino.* |
| G · los datos de tu planta | tarifas MXN, inyectoras, resina con ficha, boquilla; un motor; telemetría sin nombre de pieza | forja-dev6 · 5197 | useMoldStudio.ts (intake), MoldPanels.tsx (intake), moldmachine.ts (costo ~L256, material ~L376), machinesizing.ts, expediente.ts (costo), materials.ts, colada/feed/feed-layouts/lamina-compuerta (resina), telemetría |
| J · el expediente limpio | KO dentro de la placa, pilares en BOM y lámina, tornillos del núcleo derechos, hoja sin encimarse, una guía | forja-dev7 · 5198 | mold-drawing-set.ts, mold-drawings.ts, ForgeBRepStudio.tsx (maquetación de la hoja), qa-huella.cjs (volumen > 0) |

## RIESGOS DE FUSIÓN (declarados)
- moldmachine.ts: H (paquete/dictamen) y G (costo, material): regiones distintas.
- useMoldStudio.ts: H (ciclo/re-juicio) y G (intake). MoldPanels.tsx: H (dictamen) y G (intake). expediente.ts: H (dictamen) y G (costo).
- ForgeBRepStudio.tsx: H (dictamen ~L3931, hoja ~L4040-4140: valores), J (hoja: maquetación), I (paso 7).
- I lee los rojos del dictamen VIVO: tras fusionar H, los rojos pueden cambiar (CLARO). La película se filma DESPUÉS de fusionar las cuatro.
- H y G mueven números dorados A PROPÓSITO: el banco sale ROJO justo ahí y el coordinador re-graba con la razón de cada orden.
- Orden de fusión: H → J → G → I (la verdad primero; la inspección al final, para que enseñe la verdad fusionada).

## DESPUÉS DE LA FUSIÓN (coordinador)
- tsc sin errores nuevos; el cubo; el banco (`qa-banco.cjs`: huella ×3, control, rotos, dorados re-grabados con razón).
- La película refilmada (`filma-camino.cjs` + guion), revisada por cuadros con los ojos; Kazmer (Opus con el libro) la vuelve a juzgar.
- Deploy (`FORZAR=1 bash scripts/forja-release.sh`) y verificación: `temis-deploy.json` + el bundle servido.
- Entregas en Downloads de los dos PCs.

## TOCA
(este superticket solo coordina; lo que entra aquí entra POR FUSIÓN de una rama cuyo gate salió VERDE en su worktree)
- ordenes/2026-10-29-h-un-veredicto.md
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/RevisarPiezaPanel.tsx
- src/forja/mold/expediente.ts
- src/forja/mold/foco-lentes.ts
- src/forja/mold/foco-molde.ts
- src/forja/mold/mold-assembly.ts
- src/forja/mold/mold-contratos.ts
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/moldmachine.ts
- src/forja/mold/revisar-modelo.ts
- ordenes/2026-10-29-j-el-expediente-limpio.md
- ordenes/2026-10-29-g2-los-ajustes-de-la-fusion-semana-2.md
- scripts/mold-assembly-test.cjs
- scripts/qa-huella.cjs
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-drawings.ts
- src/forja/mold/mold-heads.ts
- src/forja/mold/mold-plano-set.ts
- src/forja/mold/mold-threads.ts
- src/forja/mold/moldbase.ts
- ordenes/2026-10-29-i-la-inspeccion-segun-kazmer.md
- scripts/filma-camino.cjs
- scripts/guiones/pelicula-camino.json
- scripts/guiones/pelicula-camino.txt
- src/forja/brep/FocoMolde3D.tsx
- src/forja/mold/inspeccion-recorrido.ts
- ordenes/2026-10-29-g-los-datos-de-tu-planta.md
- src/forja/brep/MoldPanels.tsx
- src/forja/mold/colada.ts
- src/forja/mold/feed-layouts.ts
- src/forja/mold/feed.ts
- src/forja/mold/lamina-compuerta.ts
- src/forja/mold/machinesizing.ts
- src/forja/mold/materials.ts
- src/forja/mold/moldcost-detailed.ts
- src/forja/telemetry-forja.ts
- src/lib/telemetry.ts
- caminos/la-carcasa-de-mitsubishi.md
- scripts/camino-runner.cjs

## CREA
- ordenes/2026-10-29-g-los-datos-de-tu-planta.md
- ordenes/2026-10-29-h-un-veredicto.md
- ordenes/2026-10-29-i-la-inspeccion-segun-kazmer.md
- ordenes/2026-10-29-j-el-expediente-limpio.md

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
- cada orden cierra con su gate VERDE en su worktree, su captura 4K juzgada y su número;
- tras la fusión: lo de «DESPUÉS DE LA FUSIÓN», con producción verificada.

## CIERRE (se llena al terminar)
