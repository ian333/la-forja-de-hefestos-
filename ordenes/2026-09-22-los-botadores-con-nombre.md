# ORDEN: LOS BOTADORES CON NOMBRE — cada pin a su largo, con llave y etiqueta; y cuando chocan con el agua, se mueve el pin

ESTADO: hecho (espera fusión)
PRIORIDAD: 2

BASE: 2438d60

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
- [x] pin↔agua: la colocación evita la línea de agua con su claro; tabla por pieza (pares antes → después); si queda alguno,
      baffle/bubbler declarado con su cita. 2.3 ✓ en las 4 piezas o la razón.
- [x] largos: cada pin con su largo medido a SU piso; id (p. ej. `<pieza>-EP-01`) en BOM, lámina de la retenedora y rótulo 3D; la llave
      dibujada en la cabeza cuando los largos difieren.
- [x] rótulo «regla de Hefestos» en el 0.1·L (eject-layout, estudio, ForgeBRepStudio fila de expulsión).
- [x] equilibrio sigue ✓ tras mover pines; cubo verde (o ACTA R94).

## TOCA
- src/forja/mold/eject-layout.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/mold-assembly.ts
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/mold-drawings.ts
- ordenes/2026-09-22-los-botadores-con-nombre.md

## CREA
- public/evidencia/2026-09-22-los-botadores-con-nombre/resultados.json
- public/evidencia/2026-09-22-los-botadores-con-nombre/botadores-con-nombre.png

## ENMIENDA 2026-09-22 (al abrir) — qué entra y POR QUÉ
- `estudio-molde-datos.ts` — `estacion10Dado` es el JUEZ pin↔agua y el dueño de `pines`: ahí nace la tabla de eyectores
  (id + largo a SU piso + llave) y el juez pasa a medir con la MISMA regla que la colocación (sección punta/cuerpo por z,
  contra la pared de su barreno). Región: E10 (no toca E3 del macho ni `barrenarInsertos` del corte).
- `useMoldStudio.ts` — `cicloBotadoresPieza` (E7) es quien coloca: el agarre recibe el veto del agua de la E6, pasa nombre y
  el «antes» a la E10, y dibuja la llave en la cabeza y el id en la ficha de cada pin.
- `ForgeBRepStudio.tsx` — la fila de expulsión de las láminas (0.1·L → «regla de Hefestos», la tabla baja a `aspec.ejectors`),
  los `data-*` de la tira para el inspector y el RÓTULO 3D de cada pin (id + largo, con COTAS).
- `mold-assembly.ts` — `MoldAssemblySpec.ejectors.tabla/llave` (campos opcionales) + la BOM del ensamble lista cada pin.
- `mold-drawing-set.ts` — `standardHoles('ejector-ret')` rotula cada barreno con el id de SU pin (§11.2.6 «matching location
  on the ejector retainer plate») y la hoja de análisis trae la tabla y la llave.
- `mold-drawings.ts` — `PlateHole.tag`: el rótulo JUNTO al barreno en la planta (una línea de SVG).

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

## CIERRE (2026-09-22 · MEDIDO, no contado)

### ORDEN vs ENTREGADO
| pedido | entregado |
|---|---|
| el pin se mueve antes que el agua; baffle/bubbler solo si no queda lugar, y el molde dice cuál pasó | `gripEjectorLayout(..., { evitar })`: los candidatos del agarre que caen sobre una línea quedan VETADOS y el reparto se rehace con los libres (siguen en la banda §11.2.5 de su pared). Si no queda ninguno, se usa el vetado y se DECLARA (`agua.forzados` → fila «baffle/bubbler declarado», §9.3.5.2–9.3.5.3). La E10 dice el camino: `nada que mover` · `se movieron pines` · `baffle/bubbler declarado` |
| tabla por pieza, pares antes → después; 2.3 ✓ en las 4 o la razón | tabla abajo · 2.3 ✓ en 3 de 4 por la regla del inspector; en la 1599HBK quedan 3 «cruces» que son un DEFECTO DEL INSPECTOR (medido abajo): con el radio real del cuerpo, 0 |
| cada pin a SU largo; id en BOM, lámina de la retenedora y rótulo 3D; llave cuando difieren | `tablaDeEyectores` (E10): id `<PIEZA>-EP-0k`, largo = retenedora → su piso por rayo. Llega a: BOM del ensamble (un renglón por pin), lámina de la retenedora (id junto a cada barreno + primero en la tabla), hoja de Análisis, ficha 3D de cada pin y RÓTULO 3D (con COTAS). Llave = plano en la cabeza, dibujado en el 3D |
| «regla de Hefestos» en el 0.1·L | eject-layout (nota + comentario), estudio (fila equilibrio), ForgeBRepStudio (fila de expulsión de las láminas) |
| equilibrio ✓ tras mover; cubo verde | 4/4 dentro de 0.1·L · cubo 266/266, sin ACTA R94 |

### NÚMEROS · ANTES → DESPUÉS (app real en iangpu, dev5 :5196, las 4 piezas)
| pieza | inspector 2.3 ANTES | pares bajo ½⌀ (juez E10) antes → después | camino | 2.3 DESPUÉS (caja / radio real) | equilibrio (tope 0.1·L) | largos | llave |
|---|---|---|---|---|---|---|---|
| 1594C Box (carcasa) | ✓ 0/72 | 0 → 0 | nada que mover | 0 / 0 | 3.84 / 10.65 ✓ | 1 (152.80) | no |
| 1594C Lid (tapa) | ✗ 4 (linea0↔punta-4/6 0 mm · linea2↔punta-5/7 0.31) | **4 → 0** | se movieron pines | **0 / 0** | 0.50 / 10.65 ✓ | 1 (98.80) | no |
| 1599HBK (alta) | ✗ 6 (5 cuerpos a 0 mm + 1 de caja) | **5 → 0** | se movieron pines | 3 / **0** | 16.0 / 22.0 ✓ (antes 13.26) | 1 (174.50) | no |
| 1557BGY (ensamble) | ✓ 0/40 | 0 → 0 | nada que mover | 0 / 0 | 2.50 / 8.00 ✓ | **4** (136.60/.61/.62/.70) | **sí, plano a 3.38 mm** |

- Ningún camino llegó a baffle/bubbler en estas 4 piezas: siempre hubo candidato libre. El camino forzado se probó en node
  (`prueba-veto.mts`, 10/10): todo vetado ⇒ los 8 forzados y la nota de baffle/bubbler; veto nulo ⇒ posiciones bit-iguales.
- **El 2.3 de la 1599HBK — la razón, medida:** el rol `pin-cuerpo-k` es cuerpo + CABEZA (⌀ cuerpo+4 = 10.35) y el inspector
  mide su CAJA, que toma el radio de la cabeza en toda la altura (la cabeza vive ~110 mm abajo, en la retenedora). Re-medido
  eje a eje con el radio del cuerpo (3.175): linea1↔cuerpo-2 1.52 → **3.65** · linea4↔cuerpo-0 2.33 → **4.45** ·
  linea2↔cuerpo-6 2.72 → **4.85**, todos ≥ ½D 3.1. Y el juez de la E10 (contra la pared del BARRENO ⌀cuerpo+0.5) da 0/80.
- **El juez de la E10 cambió de regla (solo la pieza soltada):** antes medía con el radio de la PUNTA en toda la altura y no
  veía el cuerpo (el conflicto viejo de la 1599HBK era `pin-cuerpo-5`); ahora `claroPinAgua` —la MISMA función con la que la
  E7 coloca— mira qué sección cruza la franja de z de cada línea y mide contra la pared de SU barreno (punta: `ejectorPinFit`;
  cuerpo: ⌀+0.5 §11.2.6). El cubo conserva su juez literal (bit-igual).
- **Largo 3D vs tabla: 0.000 mm en 32/32 pines** (`pin-punta.max z − pin-cuerpo.min z`). **Llave en el 3D:** la cabeza mide
  3.38 mm del eje hacia +X contra 4.27 hacia −X (1557BGY); sin llave, iguales (4.38/4.38 en las otras tres).
- Lámina de la retenedora de la 1557BGY: `1557BGY-EP-0k` junto a cada barreno y al frente de su renglón; el contrataladro dice
  `LLAVE: plano a 3.38 del eje (§11.2.6)`. BOM: renglones 11.1…11.8 `1557BGY-EP-0k · L 136.xx · ⌀2.381/4.763 · LLAVE`.

### CITAS Y REGLAS DE HEFESTOS
- §11.2.6 literal: "Whenever possible… the same length and diameter of ejector pins…" / "always avoid designing ejector pins
  that vary only slightly…" / "key and label each ejector pin and matching location on the ejector retainer plate".
  «Distintos» = distintos a la centésima (la cota que va al taller): la 1557BGY difiere 0.01–0.10 mm, justo el «vary only slightly».
- **Regla de Hefestos** (el libro pide la llave, no da la cota): plano a ½(r cuerpo + r cabeza) del eje.
- **Regla de Hefestos** (margen de colocación): al vetar, la franja de z se ensancha 2 mm porque el piso del candidato aún no
  se midió (el rayo corrigió la mediana hasta 1.56 mm); el juez de la E10 va con el piso real y sin margen.
- **Regla de Hefestos**: el 0.1·L del equilibrio (rotulado así en las 3 capas).

### GATES
- tsc (iangpu): 67 = los 66 de la base + `src/comando/Logos.tsx` TS2503 (vino de main con LA CARA DE GAIA) · **0 de esta orden**.
- `ciclo-dado-test`: **266/266** (dos corridas, la última después del último cambio de src) — sin ACTA R94.
- `orden-gate`: VERDE (abajo, antes del commit). Sin deploy, sin push.

### EVIDENCIA
- `public/evidencia/2026-09-22-los-botadores-con-nombre/resultados.json` — por pieza: 2.3 y 6.2 del inspector ANTES, la tira
  DESPUÉS, 2.3 por caja y corregido, tabla de ids, rótulos 3D, largo 3D − tabla, cabeza ±X, láminas con ids.
- `public/evidencia/2026-09-22-los-botadores-con-nombre/botadores-con-nombre.png` — tapa y 1599HBK antes/después, rótulo 3D y
  llave de la 1557BGY, su lámina de retenedora y su BOM.
- iangpu: `/home/ian/el-plan-dev5/bn-antes/` (inspector completo, 4 piezas), `bn-final/` y `bn-final2/` (arnés
  `mide-botadores.cjs`), `prueba-veto.mts`.

### VISTO, ES DE OTRA ORDEN (no se tocó)
- **La FUSIÓN**: ForgeBRepStudio.tsx (fila de equilibrio de las láminas, «REGLA NUESTRA» → «regla de Hefestos») la nombra
  también LAS REGLAS DE HEFESTOS; aquí se hizo el MISMO reemplazo en la misma línea — conflicto trivial.
- `barrenarInsertos` (E8 de la pieza) sigue barrenando la punta a `zBaseCerrada − pared MEDIANA`, no al piso por rayo → EL CORTE ÚNICO / LOS INSERTOS.
- Inspector 2.3: mide la caja de `pin-cuerpo-k` con la cabeza incluida (falso positivo arriba) → quien mantenga el inspector.
- Inspector 6.2 usa OTRA regla nuestra (5 % de la diagonal, contra el centro de la caja) que el 0.1·L (contra el centroide
  del área): en la 1599HBK dice ✗ 13.26 antes y dará ✗ 16.0 ahora, mientras el 0.1·L da ✓ → LAS REGLAS DE HEFESTOS (una sola regla).
- 1599HBK: el macho no sube (pines 31.5 mm «metidos») → EL MACHO DE LA CAJA GRANDE. Sus largos cambiarán cuando el macho suba.
- La llave del 3D es UN `OCC.cut` (cabeza − caja): entra en el inventario de EL CORTE ÚNICO.
- `mold-plano-set.ts` (el sólido de la placa de la Máquina) aún no rotula ids ni corta el plano de la llave en su contrataladro.

### PREGUNTAS PARA IAN
1. **Los pines de la caja grande se movieron y el empuje quedó un poco más cargado a un lado.** Para librar el agua, 1 pin
   de la 1599HBK cambió de lugar: el centro de los 8 pines quedó a 16.0 mm del centro de la pieza (antes 13.3). La regla de
   Hefestos permite 22 mm, así que pasa; la regla del inspector (5 % de la diagonal = 12.3 mm) ya fallaba antes y falla más.
   ¿Unificamos en UNA sola regla del equilibrio? Recomiendo el 0.1·L (se mide contra el área real de la pieza, no contra su caja).
2. **La llave de la 1557BGY: un plano en la cabeza.** Los 8 pines miden 4 largos que difieren apenas 0.01–0.10 mm: justo
   los que el libro dice que un ajustador confunde. Cada cabeza lleva un plano a 3.38 mm del eje y el mismo plano en su
   alojamiento, más su nombre grabado. ¿Plano en la cabeza (más barato) o pasador localizador (lo que usa el libro en pines
   contorneados)? Recomiendo el plano.
3. **Nombre de pieza en GAIA.** Hoy el id sale del nombre del archivo (`1594C-LID-EP-01`). ¿Hay un catálogo de ids de GAIA
   al que debamos atarlo (p. ej. el número de parte del cliente)? Recomiendo dejar el del archivo hasta que exista el catálogo.

### ARCHIVOS TOCADOS (para la fusión)
- `src/forja/mold/eject-layout.ts` — veto del agua en `gripEjectorLayout`, `claroPinAgua`, `slugPieza`/`idBotador`, `tablaDeEyectores`, rótulo Hefestos.
- `src/forja/mold/estudio-molde-datos.ts` — E10: juez por sección, `pines.tabla`, `pines.agua`, filas `agua-mueve`/`tabla`, fila equilibrio.
- `src/forja/brep/useMoldStudio.ts` — E7: veto, antes por rayo, nombre, llave en la cabeza, id en la ficha.
- `src/forja/brep/ForgeBRepStudio.tsx` — `aspec.ejectors.tabla/llave`, 2 filas de láminas, `data-pines-*`, rótulo 3D (`cotaPines`).
- `src/forja/mold/mold-assembly.ts` — `ejectors.tabla/llave` + BOM por pin.
- `src/forja/mold/mold-drawing-set.ts` — ids en la retenedora, filas de la tabla en Análisis.
- `src/forja/mold/mold-drawings.ts` — `PlateHole.tag` (rótulo en planta + primero en la tabla).
- este archivo + `public/evidencia/2026-09-22-los-botadores-con-nombre/*`.
