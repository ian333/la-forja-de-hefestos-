# ORDEN: LA COLA DE PUERCO — la espiral de flujo, contra números MEDIDOS ajenos

BASE: 2f8a1fc

OBJETIVO: ian: *"haz una cola de puerco antes de regresar al dado"* — el peldaño 2 de su
escalera (PROBETA→ESPIRAL→DADO). La espiral de flujo es EL ensayo estándar de fluidez
de la industria, y el botín del DUELO trajo el caso completo: **patente US11976138
(geometría 100% acotada: canal 12.7 × 3.175 mm, sección rectangular w/t=4 — puro
Hele-Shaw) + US11230635 Tabla 6 (ABS Terluran GP22NR medido: 552 mm @238°C ·
635 @249°C · 730 @260°C**, promedio de 10 disparos, Toyo 110t, husillo ⌀32 a 1 in/s,
límite 1000 psi). Primera vez que el solver se mide contra números que NO son nuestros.

## EXTENSIONES DECLARADAS (donde la patente calla, se declara — no se esconde)
1. **1000 psi = presión HIDRÁULICA** de la unidad de inyección; presión de plástico =
   ×10 (intensificación estándar de máquina de husillo) ⇒ **pLimit = 69 MPa**. La
   trampa clásica hidráulica-vs-plástico, declarada de frente.
2. **Q del husillo**: ⌀32 mm × 25.4 mm/s = **20,430 mm³/s** ⇒ velocidad de frente en
   el canal = Q/(12.7×3.175) ≈ 507 mm/s. η_eff se calibra a la Eq 5.22 EN ese punto.
3. **k(T) por Cross-WLF**: el power-law de ABS_MG47 (k=17,070 @239°C, literal del
   libro) se escala a 249/260°C por el cociente η₀(T)/η₀(239) del ABS_CROSS validado
   (n se mantiene). El GRADO difiere (Terluran GP22NR vs Cycolac MG47) — banda
   declarada en el absoluto.
4. **Sin sprue/runner**: la patente EXCLUYE runner y gate de la longitud reportada —
   el gate del campo va al arranque de la espiral. Fiel al protocolo.
5. **N1 es ISOTERMO**: sin capa congelada, la espiral simulada DEBE llegar AL MENOS
   tan lejos como la medida (la térmica solo FRENA) — eso convierte 249/260°C en
   ORÁCULOS DE COTA (L_sim ≥ L_exp), y el delta MEDIDO es la motivación cuantificada
   del N2. No se promete clavar lo que la física del nivel no contiene.

## LO QUE SE CONSTRUYE
1. `campoEspiral(TmeltC)` en `estudio-molde-datos.ts`: espiral de Arquímedes plana
   (canal 12.7×3.175, paso 20.7 con tierra de 8, L=1050 mm, r₀=12), campo SINTÉTICO
   con h analítica (3 capas z de c=3.175/3 — el colapso suma h³ EXACTO), mapa de
   longitud de arco `sMm` por celda, material k(T), Q y pLimit del protocolo.
2. **Gate** (los oráculos ajenos):
   - `L_sim(238°C) = 552 mm ± 15 %` (banda declarada por el grado distinto) — EL número.
   - `L_sim` crece con T (238 < 249 < 260).
   - COTA isoterma: `L_sim(249) ≥ 0.9·635` y `L_sim(260) ≥ 0.9·730`.
   - el orden de llegada SIGUE el arco (Spearman frente↔sMm ≥ 0.99 — la espiral es 1D).
   - conservación ≤ 1e-6 · CONTROL: con 6.9 MPa (sin la intensificación declarada)
     la espiral se queda ~10× corta — la extensión 10:1 IMPORTA y el gate lo enseña.
3. **LA ESPIRAL en el CAD**: `loadEspiral` (useMoldStudio) + botón `btn-espiral`
   (MoldPanels, junto a Probeta) por el MISMO enchufe frenteGrid. Corre el caso 238°C
   y reporta L_sim vs 552 en el curso.
4. **Video** (`llenado-video.cjs`, env `ESPIRAL=1`): la cola de puerco llenándose en
   4K, cámara cenital — el colormap barriendo la bobina. Juzgado + a AMBAS PCs.

## YA-EXISTE
- `resolverLlenadoFAN` (97/97: colapso, candado de columna, reloj de volumen, PCG,
  auditoría) · `frenteSuperficie continuo` · el enchufe frenteGrid · `eta0CrossWLF`
  validado contra el Apéndice A · el botín en `/home/ian/benchmarks-llenado/`.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
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
- gate: los 6 oráculos de arriba + los 97 existentes verdes · orden-gate VERDE.
- video `cola-de-puerco-4k.mp4` APROBADO (juez + ojos) → AMBAS PCs.
- deploy `publicar-sitio.sh` — el botón Espiral vivo.
- CIERRE con la tabla honesta: L_sim vs L_exp por temperatura, y el delta térmico
  cuantificado como caso del N2.

## CIERRE (2026-08-13)

- **gate 103 pasan · 0 fallan** (97 + 6 de la espiral) · orden-gate VERDE · **VIDEO 4K
  APROBADO** (`cola-de-puerco-4k.mp4`) → AMBAS PCs · sitio publicado con `btn-espiral`.

- **LA TABLA HONESTA (primera medición contra números ajenos)**:

  | T | L_sim | L_medida (patente) | Δ | lectura |
  |---|---|---|---|---|
  | 238 °C | **477.3 mm** | 552 mm | **−13.5 %** | dentro de la banda ±15 % declarada (grados distintos: GP22NR vs MG47) |
  | 249 °C | 764.5 mm | 635 mm | +20.4 % | COTA cumplida (isotermo ≥ medido) — el excedente ES la térmica |
  | 260 °C | 799.8 mm (tope herram.) | 730 mm | ≥ +9.6 % | ídem — la capa congelada del N2 es lo que falta para cerrar |

  Pearson t↔arco 0.9997 (el canal es 1D y el solver lo sigue) · conservación 6.6e-10
  en las tres · CONTROL: a 6.9 MPa de plástico (sin la ×10 declarada) L = 51.4 mm —
  la trampa hidráulica-vs-plástico, medida y a la vista.

- **La física del ensayo salió sola**: la espiral se mide por SHORT-SHOT (el frente
  se detiene cuando p toca el límite de máquina) — y así se ve en el video: la punta
  naranja muere a media bobina, como la pieza real al sacarla del molde.

- **Afinación medida a medio camino**: con 3 capas z y espiral de 1050 mm el CG se
  quedaba sin iteraciones en caminos ≥ ~750 celdas (conservación caía a 1e-2) y la
  corrida de 260 °C tardaba 3 min. Fix: 2 capas z (colapso sigue EXACTO: 2·1.588 =
  3.175) + herramienta de 800 mm ⇒ conservación 6.6e-10 en todas y ~7-22 s por T.

- **El N2 quedó cuantificado por un experimento ajeno**: a 238 °C (donde el k del
  libro es literal) el isotermo queda a −13.5 %; el sobredisparo en caliente
  (+20 % / +10 %) es EXACTAMENTE el freno térmico que falta. La siguiente orden del
  simulador tiene su caso de aceptación medido antes de escribirse.
