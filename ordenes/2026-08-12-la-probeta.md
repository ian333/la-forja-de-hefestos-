# ORDEN: LA PROBETA — el líquido moja la pared (el microscopio del solver)

BASE: ad10158

OBJETIVO: ian, viendo el video del FAN: *"siguen estando mal las posiciones… el líquido
no llega a las paredes, entonces no funciona como líquido, no está llenando nada…
¿cuáles son los problemas mínimos? ¿continuamos o volvemos a basics?"*. MEDIDO antes de
esta orden: a molde lleno el líquido SÍ toca la pared (hueco ±0.23 mm = ¼ de vóxel;
las posiciones están BIEN). Lo que su ojo caza es el FRENTE EN AVANCE: (1) las celdas
a medio llenar NO se pintan → anillo fantasma de ~1 celda en el borde: el líquido
"flota" sin mojar; (2) las TORRES (16 eventos medidos, esquinas): el race de esquina
empaquetado en lotes de tiempo. Decisión de ian: SIMPLIFICAR — bajar a la pieza mínima
donde cada falla se ve sola, y de ahí crecer (probeta → espiral → dado).

## LO QUE SE CONSTRUYE
1. **Frente CONTINUO** (`flowlen.ts` / `frenteSuperficie`): la celda frontera pesa por
   su FRACCIÓN de llenado estimada al instante t — arranca cuando su primer vecino
   llega (mín de `frente` de los 6 vecinos) y termina en su propia llegada; peso =
   ocupación × fracción. Fiel al modelo FAN (la frontera recibe flujo de los vecinos
   llegados). Mata el anillo fantasma: el frente PLANEA en vez de saltar celda a celda.
2. **Torres fuera** (`fan.ts`): tope de nodos completados por solve de presión
   (re-solve adaptivo) — la cascada de esquina se re-resuelve en vez de empaquetarse.
   Métrica formal de torre en el gate (cluster conexo por ventana de 1/150: ≥20 celdas
   con Δz≥10 mm y ≥2×Δxy = torre) → DEBE dar 0 en el dominio con esquina.
3. **LA PROBETA en el CAD** (`useMoldStudio.ts` + botón en `MoldPanels.tsx` —
   ENMIENDA: el ribbon de botones vive ahí, no en ForgeBRepStudio; mismo trabajo,
   archivo corregido): una placa sola (60×20×2 mm, gate en un extremo) por el MISMO
   enchufe de la E5 (frenteGrid/ocupación/FrenteSuperficie) — cero Canvas nuevo,
   cero pantalla nueva: un handler + un botón testid `btn-probeta`, como El DADO.
   `MoldScene.tsx` gana el flag `continuo: true` en su llamada a frenteSuperficie
   (ENMIENDA igual: la llamada vive ahí).
4. **Gate** (`ciclo-dado-test.cjs`): (a) MOJADO — hueco melt↔pared ≤ 0.6 mm en varias
   t (no solo t=1); (b) TORRES = 0 en dominio L (dos placas en esquina, EDT real);
   (c) el frente continuo es MONÓTONO (el volumen mojado nunca baja con t);
   (d) los 92 existentes siguen verdes.
5. **Video** (`llenado-video.cjs`, env `PROBETA=1`): la probeta llenando en 4K, cámara
   CERCA de la pared — se VE mojar. Y re-render del dado con el frente continuo.
   Juzgados + a AMBAS PCs.

## YA-EXISTE
- `fan.ts` (FAN/Hele-Shaw, 92/92) · `frenteSuperficie` (+ocupación) · el enchufe
  `frenteGrid` de la E5 · `llenado-video.cjs` (8 criterios) · la medición del hueco
  (±0.23 mm, script de sesión).

## TOCA
- src/forja/mold/fan.ts
- src/forja/mold/flowlen.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/MoldScene.tsx
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
- gate: MOJADO ≤0.6 mm en t∈{0.4, 0.7, 1.0} de la probeta · TORRES=0 en la esquina L
  (y el control: el fan SIN tope las produce) · monotonía del volumen mojado ·
  92 existentes verdes · orden-gate VERDE.
- video probeta 4K APROBADO (juez + mis ojos en crops 1:1: el frente PLANEA y MOJA)
  + dado re-renderizado — ambos a `Downloads\FORJA-DADO` de las 2 PCs.
- deploy con `publicar-sitio.sh` (la E5 viva gana el frente continuo).

## CIERRE (2026-08-13)

- **gate 97 pasan · 0 fallan** (los 92 + 5 de la probeta/torres) · orden-gate VERDE ·
  **2 VIDEOS 4K APROBADOS** (`probeta-4k.mp4` + `dado-llenado-4k.mp4` re-render),
  entregados a AMBAS PCs.

- **MOJADO: peor hueco 0.00 mm** — el frente continuo toca la pared analítica EXACTO
  en t∈{0.4, 0.7, 1.0}. Con OJOS en la probeta: la lengua curva clásica del gate
  puntual, mojando ambas paredes a su paso, flancos apenas rezagados (la pared frena
  — física, no artefacto). En el dado: la cortina del frente DRAPEA continua por las
  4 paredes, esquinas apenas adelante (race-tracking visible pero continuo).

- **TORRES: 0 eventos en el dado real — y el asesino resultó ser el CANDADO DE
  COLUMNA** (una columna colapsada no puede medir más celdas que el espesor que
  representa, h/c+1): con solo ese candado, 0 eventos; el tope temporal de nodos
  por solve quedó como seguro laxo (64 — a 12 el dado tardaba 26 s, medido).
  **CONTROL NEGATIVO: con `candadoColumna:false` reaparecen EXACTAMENTE los 16
  eventos que ian vio en el video.** El gate distingue lo roto.

- **La escalera de ian quedó instalada**: LA PROBETA es botón del ribbon
  (`btn-probeta`, junto a El DADO) por el MISMO enchufe de la E5 — cero Canvas
  nuevo. Siguiente peldaño: LA ESPIRAL (la geometría de la patente US11976138 contra
  sus 552/635/730 mm medidos — botín en `/home/ian/benchmarks-llenado/`), y el dado
  regresa al final.

- **Enmienda declarada a medio camino**: el botón vive en `MoldPanels.tsx` (ribbon)
  y la llamada de superficie en `MoldScene.tsx`, no en ForgeBRepStudio como decía la
  orden — mismo trabajo, archivos corregidos ANTES de tocarlos.

- Un tropiezo de infra: el vite :5178 de iangpu estaba muerto en el primer intento
  de render (ERR_CONNECTION_REFUSED) — relanzado con `lanza-vite.sh`, segunda
  corrida limpia.
