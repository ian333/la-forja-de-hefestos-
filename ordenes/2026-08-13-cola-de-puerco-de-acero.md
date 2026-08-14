# ORDEN: LA COLA DE PUERCO DE ACERO — la forma con su CAUSA en cuadro

BASE: 1d4e4ae

OBJETIVO: ian, viendo la espiral: *"SE VE HORRIBLE… un líquido adquiere la forma del
RECIPIENTE — aquí es una mágica cola de puerco; el plástico a esa temperatura se
desparramaría. Si damos por bueno esto, habrá errores más difíciles de detectar."*
Tiene razón dos veces: (1) el video no enseña el acero (la CAUSA de la forma);
(2) lo profundo: el dominio de la espiral era un PREDICADO declarado, no un
recipiente tallado — y los gates del solver (conservación/monotonía/Pearson)
verifican al SOLVER sobre el dominio dado, NINGUNO verifica que el dominio sea el
recipiente real. El dado sí lo hace (cruce 14.10≈14.13 cc); la espiral no lo hacía.
Mandato de ian: **reusar lo que ya tenemos del dado**.

## LO QUE SE CONSTRUYE (todo REUSO de patrones del dado)
1. `espiralAcero(oc, esp)` en `estudio-molde-datos.ts`: el sólido del CANAL por el
   patrón de `dadoRectoShape` (occLoft de 2 secciones, polígono espiral ida-y-vuelta
   a Δθ=6°) y la PLACA tallada por `occCut` (caja − canal, canal hundido en la cara
   superior, abierto en la partición) + tapa plana fantasma. `campoEspiral` exporta
   su geo (cx, cy, r₀, b, θmax) para que acero y campo salgan de LA MISMA fórmula.
2. **REGLA NUEVA — ningún llenado sin acero** (el cruce del dado, retroactivo aquí):
   - 3 FUENTES (patrón V_colada): vol(canal OCC) ≈ analítico L·w·h ≈ vóxeles del
     campo (±3 %).
   - CAVIDAD↔ACERO (patrón cavidad-y-líquido): caja − vol(placa tallada) = el HUECO
     del acero ≈ volumen del campo (±3 %). El acero CONTABILIZA el dominio.
3. `loadEspiral` muestra el bloque REAL: placa tallada fantasma + tapa, el fundido
   ADENTRO — la causalidad en cuadro. La línea del curso reporta el cruce.
4. Video re-render (`ESPIRAL=1`, cámara más baja para ver el BLOQUE) — juzgado +
   ojos + AMBAS PCs. Deploy.

## YA-EXISTE (lo que se reusa, literal)
- `occLoft`/`occCut`/`occVolume` (dadoRectoShape/dadoUndercutShape/interseccionMitades)
- el patrón 3-fuentes (V_colada) y el cruce CAVIDAD↔LÍQUIDO del dado
- `campoEspiral`/`longitudEspiralMm`/los 6 oráculos de la espiral (la física NO cambia)
- el enchufe frenteGrid + FrenteSuperficie continuo + el arnés ESPIRAL=1

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/flowlen.ts
- src/forja/brep/useMoldStudio.ts
- scripts/ciclo-dado-test.cjs
- scripts/llenado-video.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/comando-scan.cjs
- scripts/reels-web.py
- scripts/guiones/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- videos/
- src/cinematic/
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- gate: 3 FUENTES ±3 % · CAVIDAD↔ACERO ±3 % · los 103 existentes verdes ·
  orden-gate VERDE.
- video `cola-de-puerco-4k.mp4` re-render APROBADO con el BLOQUE en cuadro (juez +
  ojos: se ve el acero, el canal tallado, y el líquido muriendo a 477 mm ADENTRO) →
  AMBAS PCs · deploy.

## ENMIENDA (2026-08-13, antes de cerrar — ian: "se ve pixelado el relleno, se ven
## los cuadrados")
La retícula del solver (c=1.59, la más gorda) asomaba en la SUPERFICIE: la ocupación
muestreada a novenos cuantiza la pared a ~0.5 mm. Fix = **LA PARED SALE DE LA
FÓRMULA, NO DE LA RETÍCULA**: `campoEspiral` gana `ocupacionSdf` — ocupación por
DISTANCIA FIRMADA analítica al canal (occ = clamp(0.5 − sdf/c)), el cruce iso-0.5
aterriza en la pared EXACTA a cualquier celda. Es el primer paso del programa de
precisión que pidió ian (la eficiencia del operador comprada en precisión; 0.01 mm
donde la derivada manda). El solver NO cambia (display + capacidad). TOCA gana
`flowlen.ts`: la celda de ACERO con rampa SDF lleva su valor (<0.5) para que el
cruce iso-0.5 aterrice en la pared EXACTA (solo acero; el frente usa su rampa).

## CIERRE (2026-08-13)

- **gate 105 pasan · 0 fallan** (103 + los 2 cruces del acero) · orden-gate VERDE ·
  **VIDEO 4K APROBADO** re-renderizado → AMBAS PCs · SITIO_PUBLICADO_OK.

- **El dominio quedó ATADO al sólido, por número**: canal OCC 32.20 cc = hueco
  tallado en la placa 32.20 cc (el cut contabiliza al decimal) ≈ analítico L·w·h
  32.26 ≈ vóxeles del campo 32.29 — cuatro representaciones de la misma forma,
  cruzadas. La MISMA fórmula r(θ)=r₀+bθ (`esp.geo`) talla el acero Y voxeliza el
  campo: una sola fuente de forma.

- **Con OJOS, lo que ian pedía**: el bloque translúcido con el canal HUNDIDO, la
  tierra entre vueltas, y — lo mejor — la vuelta exterior del canal VACÍA delante
  de la punta muerta: el short-shot ya tiene su causa en cuadro. El recipiente
  existe; el líquido llenó lo que 69 MPa dieron y se detuvo a 477 mm.

- **REUSO literal del dado** (mandato de ian): el canal por el patrón occLoft de
  `dadoRectoShape` (polígono espiral ida-exterior/vuelta-interior, Δθ=6°, sagita
  <0.1 mm), la placa por el occCut de `dadoUndercutShape`, los cruces por los
  patrones V_colada (3 fuentes) y CAVIDAD↔LÍQUIDO. Cero motor nuevo.

- **La regla queda escrita en el gate**: "ningún llenado sin acero" — el error que
  ian nombró (dominio declarado = operador inventado, invisible para los gates del
  solver) ahora tiene su clase de gate propia. La probeta debe ganar el suyo cuando
  se le talle placa (pendiente declarado).

- **ENMIENDA CERRADA ("se ve pixelado")**: con `ocupacionSdf` (pared por DISTANCIA
  FIRMADA analítica + la celda de acero llevando su rampa <0.5), las orillas del
  canal salen como CURVAS continuas en el crop 1:1 — la retícula de 1.59 mm ya no
  asoma en la pared. Residual DECLARADO: micro-sierra sub-milimétrica en el filo
  superior (el borde z de la última capa) — candidato para la siguiente vuelta de
  precisión, no se esconde. Video re-renderizado (tercera vez), APROBADO, entregado.

- **Tropiezo de infra CAZADO EN VIVO**: el timeout local de un ssh NO mata la
  cadena remota (Tailscale ssh sin tty) → quedaron DOS `publicar-sitio.sh`
  encimados — el gotcha exacto de la memoria, y además la cadena vieja rsync-eaba
  un dist que se RECONSTRUYÓ debajo (contenido mixto). Se mató la vieja por PID
  exacto y se dejó la limpia sola. Regla confirmada: deploy SIEMPRE como tarea de
  fondo sin timeout, jamás dos encimados.
