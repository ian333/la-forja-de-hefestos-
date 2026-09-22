# ORDEN: LAS REGLAS DE HEFESTOS — la placa que se dobla guarda margen, los retornos caben y lo que es nuestro se llama por su nombre

ESTADO: hoy
PRIORIDAD: 2

BASE: 2b3ed99

OBJETIVO: aplicar las decisiones que ian firmó el 2026-09-22 (ACTA R93, preguntas 3 y 6, y el nombre): (a) la placa soporte
se dimensiona para doblarse **≤ 70 % del venteo por defecto, con tope duro de 85 %**; (b) los pines de retorno ⌀12 que no caben
fuera del inserto se resuelven **creciendo la placa expulsora**; (c) toda regla nuestra (sin número en Kazmer) se rotula
**«regla de Hefestos»** en pantalla, láminas y contratos — no «regla nuestra», no «de GAIA».

## DECISIÓN DE IAN (literal, 2026-09-22)
- Pregunta 3 (la placa que se dobla, hoy 0.0191/0.020 mm = 96 % en la base 396×296): «me mama… yo pondría default 70 como límite 85,
  ME GUSTA COMO REGLA DE HEFESTOS, no de gaia… acá es Hefestos el muchacho».
- Pregunta 6 (retornos ⌀12 no caben: banda 16.5 / 26 mm, piden 36 — carcasa y tapa): «sí» a «crece la expulsora».

## YA-EXISTE (prueba de ausencia)
- `platesizing.ts` `optimizeSupportPlate` / `sizeSupportPlate`: elige por acero mínimo con `flashOk = deflex ≤ venteo` (sin margen).
- `mold-contratos.ts:622` compara `flashOk` contra su propia medición (dos verdades → una).
- «REGLA NUESTRA» vive hoy en `cooling-design.ts:64` (piso maquinable), `estudio-molde-datos.ts` (equilibrio 0.1·L, filas del
  estudio), `ForgeBRepStudio.tsx:4047`, `eject-layout.ts` (el 0.1·L — ESE lo rotula la orden de LOS BOTADORES CON NOMBRE, no esta).
- Retornos: ver la orden cerrada LOS INSERTOS SE BARRENAN, pregunta 1, y la 2.4 del inspector (carcasa y tapa).

## EJERCICIOS
- [ ] soporte: factor de venteo 0.70 default / 0.85 tope, UNA constante con su rótulo «regla de Hefestos» y su razón; el optimizador
      elige el acero mínimo que cumple 70 %; si ninguna opción cumple 85 % el molde lo DICE (no lo esconde). 396×296 y las 4 piezas: antes → después.
- [ ] el contrato de mold-contratos mide contra la MISMA constante (una sola verdad).
- [ ] retornos: la placa expulsora crece lo necesario para que el retorno ⌀12 quede fuera del inserto con su holgura; 2.4 de carcasa y tapa ✓.
- [ ] rótulo: cada «regla nuestra / REGLA NUESTRA» fuera de eject-layout pasa a «regla de Hefestos» (UI, láminas, contratos, comentarios).
- [ ] cubo: si cambian literales, lista ACTA R94 en el CIERRE (check · viejo · nuevo · por qué).

## TOCA
- src/forja/mold/platesizing.ts
- src/forja/mold/mold-contratos.ts
- src/forja/mold/cooling-design.ts
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
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- flecha/venteo de la placa soporte en las 4 piezas antes → después (≤ 70 %), con la base elegida.
- inspector 2.4 en carcasa y tapa ✓ (tarjeta), ciclo-dado-test verde (o ACTA R94), tsc sin nuevos, orden-gate VERDE.
- grep: cero «regla nuestra» fuera de eject-layout/equilibrio; las explicaciones al estilo de feedback_explicar_el_molde.
