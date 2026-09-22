# ORDEN: LOS BOTADORES CON NOMBRE — cada pin a su largo, con llave y etiqueta; y cuando chocan con el agua, se mueve el pin

ESTADO: hoy
PRIORIDAD: 2

BASE: 2b3ed99

OBJETIVO: aplicar las decisiones de ian del 2026-09-22 (preguntas 5, 7 y 8): (a) donde un pin cruza una línea de agua de la
placa B, **primero se mueve el pin**; baffles/bubblers (§9.3.5.2) solo si no queda lugar, y el molde dice cuál pasó; (b) en piezas
con el piso a varias alturas (1557BGY: 4 cotas, 173.60/.61/.62/.70) **cada pin a SU largo + llave (anti-giro) + etiqueta** (§11.2.6
*"the same length and diameter… to facilitate mold assembly"*, y si no, keyed y marcados); **cada pin con su identificador** ligado
a la pieza de GAIA, visible en la lámina, la BOM y la etiqueta 3D; (c) el 0.1·L del equilibrio se queda y se rotula **«regla de Hefestos»**.

## DECISIÓN DE IAN (literal, 2026-09-22)
- 5: «sí» a mover pines antes que baffles. 7: «ME GUSTA COMO REGLA DE HEFESTOS, no de gaia». 8: «hay una regla que me gusta…
  EL HUMANO ACEPTA EL STANDARD POR NATURALEZA, cada uno a su largo y etiqueta, cada pieza dentro de GAIA tendrá su identificador».

## YA-EXISTE (prueba de ausencia)
- `eject-layout.ts` (`gripEjectorLayout`, equilibrio 0.1·L, líneas 52/268/323), la punta por rayo en el piso real (orden LOS PINES
  EN LA CARA DEL MACHO, cerrada), el juez pin↔agua de la orden EL AGUA DICE DOS COSAS (lista de pares con su claro).
- Inspector: 2.3 (pines que cruzan agua B) falla en la tapa y la 1557BGY.

## EJERCICIOS
- [ ] pin↔agua: la colocación evita la línea de agua con su claro; tabla por pieza (pares antes → después); si queda alguno,
      baffle/bubbler declarado con su cita. 2.3 ✓ en las 4 piezas o la razón.
- [ ] largos: cada pin con su largo medido a SU piso; id (p. ej. `<pieza>-EP-01`) en BOM, lámina de la retenedora y rótulo 3D; la llave
      dibujada en la cabeza cuando los largos difieren.
- [ ] rótulo «regla de Hefestos» en el 0.1·L (eject-layout, estudio, ForgeBRepStudio fila de expulsión).
- [ ] equilibrio sigue ✓ tras mover pines; cubo verde (o ACTA R94).

## TOCA
- src/forja/mold/eject-layout.ts
- (el agente declara el resto al abrir, por ENMIENDA)

## CREA
- (nada)

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
- ordenes/2026-09-22-las-reglas-de-hefestos.md
- ordenes/2026-09-22-los-botadores-con-nombre.md
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- pares pin↔agua por pieza antes → después; tarjeta 2.3 de tapa y 1557BGY; lámina de la retenedora y BOM de la 1557BGY con los ids.
- ciclo-dado-test verde (o ACTA R94), tsc sin nuevos, orden-gate VERDE.
