# ORDEN: LA BROCA HASTA EL PISO REAL — cada barreno de pin en el núcleo llega a donde llega SU punta

ESTADO: hoy
PRIORIDAD: 1

BASE: abcadec

OBJETIVO: el barrenado de los insertos corta el barreno de cada pin hasta «base − pared MEDIANA + 0.2» (useMoldStudio.ts:~1602 →
estudio-molde-datos.ts:~1928) mientras la punta del pin va al piso REAL medido por rayo bajo cada pin. Resultado: queda una piel de
acero sobre cada punta — **0.86 mm en los 8 pines de la tapa, 0.57–0.66 mm en el ensamble** (0 en carcasa y caja grande). El estudio
de contacto da 0 pares pin↔núcleo y el inspector dice CUMPLE: nadie lo veía. Que la broca de cada pin use EL MISMO piso que su punta
(una sola fuente), y que el contacto/inspector vea un pin metido en acero.

## LO MEDIDO (revisión cruzada 2026-09-28, app real dev5)
- focos/revision/corte.md + corte/tapa_7_2.png: rayo vertical en el eje de cada pin → barreno termina en z 155.94, acero hasta 156.8,
  punta en 156.8. Tapa: mediana 1.06 bajo el piso real − 0.2 = 0.86 (cuadra al centésimo).

## DECISIÓN DE IAN
- 2026-09-22: cada pin a SU largo (LOS BOTADORES CON NOMBRE). 2026-10-06: «repara los errores… juzga todo visualmente».

## EJERCICIOS
- [ ] una sola fuente del piso por pin para la punta Y para la broca; piel de acero sobre cada punta = 0 en las 4 piezas (rayo en el eje).
- [ ] el estudio de contacto / juez detecta pin↔acero del núcleo (prueba: con el código viejo lo marca; con el nuevo, 0).
- [ ] captura en corte por la fila de pines de la tapa, antes/después, juzgada con los ojos.
- [ ] cubo verde (o ACTA R94), tsc sin nuevos, orden-gate VERDE.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- (el agente declara el resto por ENMIENDA)

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- docs/CANON-VIDEO.md
- public/comando/analisis-ig.json
- public/comando/comentarios.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
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
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- piel de acero por pin (8 por pieza) antes → después; captura en corte de la tapa; ciclo-dado-test; tsc; orden-gate.
