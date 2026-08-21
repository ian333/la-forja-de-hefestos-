# ORDEN: EL VASO CON BOTADORES — hecho CON LA INTERFAZ

BASE: 62e12d8

OBJETIVO: encargo de ian — "usa la interfaz para hacer un molde, un vaso
simple, de tal manera que se usen BOTADORES y no strippers". Restricción
dura: **PROHIBIDO CREAR BOTONES**. Las funciones de CAD son sí o sí: si el
vaso no nace de operaciones del árbol, el usuario no tendrá manera de
modificarlo.

## POR QUÉ ESTE ENCARGO ES UNA PRUEBA, NO UN CAPRICHO
El criterio del libro está en el código: `chooseEjectorType` manda STRIPPER
cuando `fullPerimeter`, y `mold-ejection-auto.ts` lo enciende con
`fig.kind === 'cup' && fig.wallMm < 1.5` (§11.3.4: en pared delgada el
empuje puntual deforma). La flanera que YA existe tiene pared **1.2 mm** →
es precisamente el caso stripper. Para que el vaso lleve botadores hay que
**cambiarle la pared a ≥1.5 mm** — o sea, MODIFICAR LA PIEZA. Ese es el
punto de ian: hoy solo se pueden moldear piezas que nosotros hardcodeamos.

## LO QUE SE HACE (manejo, no código)
1. Manejar `forja-brep.html` en iangpu con gestos REALES
   (`scripts/forja-drive.cjs`, drive-by-sight: clic/arrastre a coordenadas
   decididas MIRANDO screenshots) para construir el vaso con las funciones
   del CAD que ya existen: **Boceto (círculo) → Extruir → Más▾ Cascarón →
   Más▾ Draft**. El espesor del vaso queda como PARÁMETRO del cascarón —
   la perilla que decide botador vs stripper.
2. Llevarlo por MOLD TOOLS (Escala → Move/Copy → Parting Line → Tooling
   Split → Guías) y correr la eyección.
3. **VERIFICAR con el juez, no con la vista**: `chooseEjectorType` sobre la
   figura real del vaso construido debe devolver `pin`, y con la pared de
   la flanera (1.2) debe devolver `stripper` — el mismo control negativo
   de siempre: si el veredicto no CAMBIA con la pared, el juez no mide.
4. Reportar el flujo COMPLETO con evidencia visual paso a paso, incluido
   **dónde se rompe** si se rompe. Un bloqueo encontrado y documentado vale
   más que un molde fabricado a escondidas por API.

## LO QUE NO SE HACE
- NO se crean botones (regla de ian).
- NO se construye el vaso llamando al kernel por API para "que salga":
  el arnés es drive-by-sight; si la interfaz no puede, eso ES el hallazgo.
- NO se toca código en esta orden. Si el flujo exige cableado nuevo, se
  PARA y se le pregunta a ian (la orden se enmienda, no se improvisa).

## TOCA
- (nada)

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- scripts/precompute-hemoglobin.py
- scripts/precompute-heme-approach.py
- scripts/salud-canarios.cjs
- scripts/salud.sh
- scripts/traer.sh
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/comando-scan.cjs
- scripts/render-clip.cjs
- scripts/narracion-gen.py
- scripts/reels-web.py
- scripts/video.sh
- scripts/guiones/
- scripts/video-subs.py
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- scripts/assemble-narracion.py
- videos/
- src/cinematic/
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- screenshots del flujo REAL paso a paso (no renders de API)
- el veredicto de eyección = **pin** para el vaso construido y **stripper**
  para pared 1.2 (control negativo)
- el punto exacto de ruptura, si lo hay, con su causa en el código
- orden-gate VERDE (esta orden no toca nada)

---

## CIERRE (lo que de verdad pasó)

**EL VASO SE HIZO CON LA INTERFAZ**, con gestos reales (`forja-drive.cjs`,
clic a coordenadas decididas mirando screenshots; cero construcción por API):

Boceto en XY → círculo dibujado A OJO → cota ⌀80 → ancla del centro →
**DOF 0, "totalmente restringido"** → Terminar → Extruir → altura → Más▾ →
Cascarón espesor → cara abierta = la de arriba. Cinco features en el árbol,
todas editables. El primer intento salió ⌀80×45 pared 2 (volumen del
cilindro 60,318.579 mm³ = π·40²·12 exacto en el paso previo); el definitivo
es **⌀80 × 20, pared 3**, con el anillo del borde midiendo **726 mm²** =
π(80²−74²)/4 — el número exacto que usó la comprobación de abajo.

**EL ENCARGO SE CUMPLE… Y AL VERIFICARLO SE CAE UN SUPUESTO NUESTRO.**
El veredicto CAMBIA de opinión, que es lo que se le pide a un juez:
- vaso pared **2.0** → `pin` · 28 pines ⌀10 · 37.8 kN
- flanera pared **1.2** → `stripper` (§11.3.4) · 35.1 kN  ← control negativo

Pero al preguntar *¿ese plan CABE en la pieza?* —barrido de 6 geometrías por
`ejection.plan`, área y perímetro de pin contra el anillo del borde— **cinco
de seis dicen "pin" con pines que NO caben**:

| H | pared | tipo | pines | área pines | área borde | ¿cabe? |
|---|---|---|---|---|---|---|
| 45 | 2.0 | pin | 28×⌀10 | 2199 mm² | 490 mm² | **NO** |
| 45 | 3.0 | pin | 18×⌀10 | 1414 | 726 | **NO** |
| 30 | 2.0 | pin | 19×⌀10 | 1492 | 490 | **NO** |
| 30 | 3.0 | pin | 12×⌀10 | 942 | 726 | **NO** |
| 20 | 2.0 | pin | 13×⌀10 | 1021 | 490 | **NO** |
| **20** | **3.0** | **pin** | **8×⌀10** | **628** | **726** | **SÍ** |

## LOS TRES HALLAZGOS (evidencia, no opinión)
1. **`chooseEjectorType` decide por espesor de pared y NADA MÁS**
   (`fullPerimeter = cup && wall < 1.5`). Nunca comprueba §11.2.5 —que los
   pines quepan contra la cara de empuje disponible—, así que emite planes
   IMPOSIBLES con cara de aprobados. El libro tiene razón: un vaso hondo y
   recto quiere stripper; el gate de 1.5 mm es un proxy burdo de esa verdad.
2. **`draft` no aplica a caras cilíndricas**: "draftFaces: ninguna cara
   aplicable (paredes ⊥ pullDir)". Un vaso —la pieza moldeada más clásica—
   no se puede desmoldear con las funciones del árbol tal como están.
3. **No hay puente de la pieza modelada al flujo de molde.** Con MI vaso en
   el árbol, MOLD TOOLS (Escala · Move/Copy · Parting Line · Tooling Split ·
   Guías) sale **DESHABILITADO** — se ve gris en el screenshot. `cursoEscala`
   consume `cursoRef.current.pieza`, que solo escriben `cursoInsertar`
   (percha), `cursoFlanera` (vaso PP), `loadDado` y `loadProbeta`: piezas
   HARDCODEADAS. Hoy solo se moldea lo que nosotros metimos al código.

**NO SE TOCÓ CÓDIGO NI SE CREÓ NINGÚN BOTÓN**, como manda la orden. El
cableado que hace falta se decide con ian; la orden se enmienda, no se
improvisa.
