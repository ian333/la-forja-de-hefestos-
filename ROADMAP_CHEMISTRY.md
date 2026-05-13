# Roadmap — Laboratorio Atómico de La Forja

> **Principio absoluto**: cada cosa que se vea o se simule debe corresponder a una fórmula publicada, con cita verificable. Si no puedo nombrar el paper o la tabla, no entra.

URL viva: https://university.gaiaprime.com.mx (tab **Lab** → GaiaLab)

---

## 0 · Estado actual (auditoría 2026-05-12)

### Motor (lo que YA está construido a nivel doctoral)

| Módulo | Archivo | Qué hace | Refs |
|---|---|---|---|
| Orbitales hidrogenoides | `src/lib/chem/quantum/orbitals.ts` | ψ_nlm(r,θ,φ) = R_nl·Y_lm exacto, Laguerre asociado + armónico esférico | Griffiths 3e ch.4; Pauling-Wilson 1985 |
| Tabla periódica | `src/lib/chem/quantum/periodic-table.ts` | 118 elementos, configuración Madelung con 20+ excepciones reales (Cr, Cu, Pd, Pt, Au, Ln, An) | IUPAC 2021; NIST ASD v5.10; Cordero *Dalton Trans.* 2008 |
| Átomos multi-electrón | `src/lib/chem/quantum/atom-builder.ts` | Construye Slater-Z efectiva, configuración electrónica | Slater 1930 |
| LCAO / MOs | `src/lib/chem/quantum/molecular-orbitals.ts` | ψ_MO = Σ cᵢφᵢ; coeficientes precalculados Slater-Z; bonding/antibonding/nonbonding | Coulson *Valence* 1961; Mulliken 1955 (Nobel 1966); Szabo-Ostlund 1996 |
| MD clásica | `src/lib/chem/quantum/md.ts` | Velocity Verlet + Lennard-Jones + Coulomb + PBC + Berendsen NVT | Verlet 1967; Swope 1982; Berendsen 1984; Allen-Tildesley 2017 |
| MD en GPU | `src/lib/chem/quantum/gpu-md.ts` | Compute shaders, miles de partículas | — |
| Cinética química | `src/lib/chem/kinetics.ts` + `stiff-solver.ts` | ODEs rígidas (Rosenbrock), Arrhenius | Hairer-Wanner II 1996 |
| Reacciones presets | `src/lib/chem/reactions.ts` | N2O5, Haber, Neutralización, H2O2, H2 combustión | (5 preset; faltan ~10) |
| Fotólisis | `src/lib/chem/photolysis.ts` | J-rates con cross-section solar | JPL Publication 19-5 (Burkholder et al.) |
| Reactores | `src/lib/chem/reactors.ts` | CSTR, PFR, batch | Levenspiel 3e |

### Moléculas con MO ya implementado

`H₂`, `H₂⁺`, `HeH⁺`, `He₂` (hipotético), `Li₂`, `N₂`, `O₂`, `HF`, `CO`. **9 diatómicas.**

### UI (lo que existe)

`GaiaLab.tsx` con 4 tabs: ψ Átomo · ⟮⟯ Enlace · ⇌ Reacción · ✧ Sandbox. Cada tab tiene su componente principal + paneles secundarios.

### Tests

**364 tests** en `src/lib/chem/__tests__/`. Cobertura masiva.

---

## El dolor inmediato (lo que motiva el roadmap)

> *"la animación debe de ser fluida pero es animación y no la puedes ver"*

Diagnóstico: los paneles laterales (BondTab, ReactionTab) compiten con el viewport 3D — el viewport está encajonado en una columna estrecha y los controles tapan la animación. **No es el motor; es el layout.**

> *"el visualizador de la tabla periódica es ley absoluta"*

PeriodicTable existe pero sólo se muestra en el tab Átomo, no es un dock permanente. Hay que elevarla a hero permanente.

> *"simulaciones reales de enlaces químicos lo más fieles a las fórmulas actuales"*

El motor LCAO ya es fiel. Faltan moléculas canónicas (H₂O, CH₄, NH₃, CO₂…) y un test harness que **compare contra NIST CCCBDB** automáticamente.

---

## Fase 1 · Layout chemistry-first ⏳

**Objetivo**: viewport 3D = héroe ocupa la mayor parte de la pantalla. PeriodicTable = dock lateral siempre visible. Paneles secundarios = sheets/overlays no-bloqueantes que el usuario puede cerrar.

### Cambios

1. `GaiaLab.tsx` — grid layout `[periodic-table-dock | hero-viewport | optional-side-panel]`. Header colapsable. Tabs reducidos a un picker compacto.
2. `PeriodicTable.tsx` — modo `compact` con cells de 28-32px que entran en sidebar 320px. Hover muestra orbital del átomo en una mini-canvas. Click → selecciona elemento para construir molécula.
3. `BondTab.tsx` / `ReactionTab.tsx` — los controles (energy slider, bond-length slider, presets) se mueven a un `<FloatingPanel>` colapsable en la esquina, sobre el viewport, no junto.
4. **Drag-to-canvas** desde PeriodicTable → arrastrar un elemento al viewport agrega un átomo a la molécula construida. (Para Fase 2 que necesita VSEPR live.)

### Verificación

- Smoke test screenshots con `scripts/physics-screenshots.cjs` extendido a `chem-screenshots.cjs`: capturar tab Átomo, Enlace, Reacción, Sandbox en viewport ≥1024×768. Validar que el `<canvas>` ocupa ≥60% del área.
- Console error budget = 0.

---

## Fase 2 · Moléculas canónicas faltantes 📚

**Objetivo**: cubrir el set mínimo de moléculas que aparecen en cualquier libro de química general, cada una con geometría correcta y MO real.

### Set obligatorio

| Molécula | Hibridación | Geometría | Bond length(s) | Bond angle | Ref CCCBDB |
|---|---|---|---|---|---|
| **H₂O** | O sp³ | bent | O-H = 0.9572 Å | 104.52° | CCCBDB exp. |
| **CH₄** | C sp³ | tetraédrica | C-H = 1.087 Å | 109.47° | CCCBDB exp. |
| **NH₃** | N sp³ | piramidal trigonal | N-H = 1.012 Å | 106.7° | CCCBDB exp. |
| **CO₂** | C sp | lineal | C=O = 1.162 Å | 180° | CCCBDB exp. |
| **C₂H₄** (eteno) | C sp² | trigonal plana | C=C = 1.339, C-H = 1.087 Å | H-C-H = 117.4° | CCCBDB exp. |
| **C₂H₂** (etino) | C sp | lineal | C≡C = 1.203, C-H = 1.062 Å | 180° | CCCBDB exp. |
| **HCl** | — | diatómica | H-Cl = 1.275 Å | — | CCCBDB exp. |
| **NaCl** (gas) | iónico | diatómica | Na-Cl = 2.36 Å | — | CCCBDB exp. |
| **C₆H₆** (benceno) | C sp² | hexágono plano | C-C = 1.397, C-H = 1.084 Å | 120° | CCCBDB exp. |

### Cómo construir cada una (no hardcoded)

1. **VSEPR engine** (`src/lib/chem/quantum/vsepr.ts` — nuevo): dado un átomo central con N pares enlazantes + M pares libres, devuelve geometría idealizada (linear, trigonal, tetraedral, trigonal-bipiramidal, octaédrica) con vectores unitarios.
   - Ref: Gillespie & Nyholm, *Q. Rev. Chem. Soc.* 11, 339 (1957); Gillespie & Hargittai, *The VSEPR Model of Molecular Geometry*, Allyn & Bacon 1991.
2. **Hibridación** (`src/lib/chem/quantum/hybridization.ts` — nuevo): genera orbitales sp, sp², sp³ como combinación de orbitales atómicos hidrogenoides. Cada orbital híbrido es ψ_hyb = (1/√n)·(s + λ·p_x …).
   - Ref: Pauling, *J. Am. Chem. Soc.* 53, 1367 (1931) — paper original de hibridación.
3. **Builder** (`buildMolecule(formula, geometry?)`): combina VSEPR + hibridación + bond lengths de tabla para construir `Molecule3D` con posiciones reales.

### Verificación

Test `src/lib/chem/__tests__/canonical-molecules.test.ts`:

```ts
for (const M of CANONICAL) {
  const mol = buildMolecule(M.formula);
  expect(measureBondLength(mol, M.bondPair)).toBeCloseTo(M.refLength, 2);
  expect(measureBondAngle(mol, M.angleTriple)).toBeCloseTo(M.refAngle, 1);
}
```

Refs por bondlength/angle: NIST CCCBDB experimental values (`cccbdb.nist.gov`).

---

## Fase 3 · Verificación visual de fidelidad 🧪

**Objetivo**: hacer mecánica la comparación contra tablas reales.

### Componentes

1. **`scripts/chem-fidelity-check.cjs`**: para cada molécula del catálogo, renderiza headless, mide geometría desde el DOM/scene graph, compara contra CCCBDB. Falla CI si error > 1% en bond length o > 1° en ángulo.
2. **Invariantes físicos** (`src/lib/chem/__tests__/invariants.test.ts`):
   - Bonding MO siempre tiene energía < antibonding (E_σ < E_σ*).
   - Suma de cargas parciales (Mulliken) = carga total de molécula.
   - Bond order de un MO diagram (B = (n_b - n_a)/2) coincide con el experimental.
   - VSEPR predice geometría observada para moléculas del set canónico.
3. **Energías de enlace** (`src/lib/chem/bond-energies.ts` — nuevo): tabla NIST de D₀ (bond dissociation energy) para los ~50 enlaces más comunes. Test que el MO calculado da E correcto a ±20% (cualitativo).

### Fuentes verificables

- NIST Computational Chemistry Comparison and Benchmark Database (CCCBDB) — `cccbdb.nist.gov`
- NIST WebBook — `webbook.nist.gov/chemistry/`
- CRC Handbook of Chemistry and Physics, 104th ed.
- Bordwell pKa table — `organicchemistrydata.org/hansreich/resources/pka/`

---

## Fase 4 · Reacciones clásicas con mecanismo 🔥

**Objetivo**: pasar de cinética macroscópica (ya tienes 5 presets) a mecanismo molecular paso-a-paso con MD reactiva.

### Reacciones obligatorias

| Reacción | Tipo | Mecanismo | Ref |
|---|---|---|---|
| CH₄ + 2 O₂ → CO₂ + 2 H₂O | combustión | radical en cadena | GRI-Mech 3.0 |
| HCl + NaOH → NaCl + H₂O | neutralización ácido-base | transferencia de protón | Brønsted-Lowry |
| 2 H₂ + O₂ → 2 H₂O | combustión H₂ | radical chain | Konnov 2004 |
| Fe + Cu²⁺ → Fe²⁺ + Cu | redox simple | transferencia electrónica | E° de tablas estándar |
| CH₃-Br + OH⁻ → CH₃-OH + Br⁻ | SN2 | concertado, backside attack | Ingold-Hughes 1933 |
| RCOOH + R'OH ⇌ RCOOR' + H₂O | esterificación (Fischer) | adición-eliminación | Fischer 1895 |

### Visualización

- **Antes**: barras de concentración (ConcentrationChart).
- **Después**: además, el viewport 3D anima las moléculas reaccionando — bonds rompiéndose, formándose, ψ_MO redistribuyéndose. Usar `md.ts` con `reaction-on-collision` que ya existe + barrera de activación Arrhenius.

### Verificación

- pKa de ácidos = pKa de Bordwell ± 0.5.
- E° de redox = E° de tabla CRC ± 0.05 V.
- Constantes de equilibrio K = exp(-ΔG/RT) con ΔG de NIST.

---

## Fase 5 · Espectros vibracionales (IR/Raman) 📡

**Objetivo**: dado una molécula, calcular modos normales y predecir espectro IR/Raman.

### Cómo

1. **Hessian**: matriz de segundas derivadas del potencial. Para LJ/Morse es analítico; para MO es numérico.
2. **Modos normales**: diagonalizar mass-weighted Hessian. Eigenvalues = ω² (frecuencias), eigenvectors = vectores de desplazamiento.
3. **Intensidades IR**: ∝ |∂μ/∂Q|² (derivada del momento dipolar respecto al modo).
4. **Visualización**: animar la molécula vibrando en cada modo + plot del espectro.

### Verificación

Comparar ν(H₂O) bend = 1595 cm⁻¹, ν(H₂O) asym stretch = 3756 cm⁻¹ (NIST). Comparar ν(CO₂) asym = 2349 cm⁻¹.

Refs: Wilson, Decius & Cross, *Molecular Vibrations*, Dover 1980.

---

## Fase 6 · Fusión nuclear ⚛️ (largo plazo)

**Objetivo**: simular fusión D+T → He + n y D+D → He³ + n / T + p con física real.

### Física

- **Coulomb barrier**: V_C(r) = Z₁Z₂e²/(4πε₀r). Para D+T es ~280 keV.
- **Tunelamiento WKB**: P_tunnel = exp(-2∫√(2m(V-E))/ℏ dr).
- **Sección eficaz**: σ(E) parametrizada (Bosch-Hale fits para D-T, D-D, D-He³).
- **Tasa de reacción**: <σv> integrando Maxwell-Boltzmann.
- **Lawson criterion** para break-even.

### Refs

- Bosch, H.S. & Hale, G.M., *Nucl. Fusion* 32, 611 (1992) — parametrizaciones σ(E).
- Atzeni & Meyer-ter-Vehn, *The Physics of Inertial Fusion*, Oxford UP 2004.

### Nota

Esto ya no es química — vive mejor en `src/physics/modules/nuclear/`. Reuso del solver MD para hot plasma (kT > eV, no química).

---

## Fase 7 · Drug discovery / docking molecular 💊 (largo plazo)

**Objetivo**: dado un target proteico (PDB) y un ligando (SMILES), predecir binding pose y afinidad.

### Componentes

| Pieza | Qué hace | Algoritmo / Ref |
|---|---|---|
| PDB parser | Leer estructura cristalográfica | RCSB PDB format spec |
| SMILES → 3D | Generar conformación inicial | RDKit-style ETKDG (Riniker & Landrum, *JCIM* 55, 2562) |
| Pocket detection | Encontrar cavidad | Fpocket (Le Guilloux 2009) |
| Scoring | Estimar ΔG_bind | Vinardo (Quiroga & Villarreal, *JCIM* 56, 1559) |
| Conformational search | Buscar mejor pose | Genetic algorithm + local minimization |

Ya existe `src/physics/modules/bio/Docking.tsx` — extender con scoring real.

---

## Convenciones del repo

- **Toda fórmula** llega con `Ref [Nombre-fuente]` en el comentario JSDoc del archivo o función.
- **Toda constante** con su valor en la unidad usada + cita.
- **Toda molécula** del catálogo con test que valida bond length/angle vs NIST CCCBDB.
- **Cualquier nuevo orbital, MO, geometría VSEPR** acompañado de un test que verifica simetría / propiedades del operador.
- **No hardcodear geometrías** que se pueden derivar de VSEPR o LCAO.

## Estado de fases (vivo)

- [x] **Fase 1** — Layout chemistry-first (commit 29d6986)
- [x] **Fase 2** — Moléculas canónicas H₂O, CH₄, NH₃, CO₂, C₂H₄, C₂H₂, HCl, NaCl, C₆H₆ (commit 29d6986)
- [x] **Fase 3** — Verificación visual + VSEPR + 28 tests NIST CCCBDB (commit 29d6986)
- [x] **Fase 4** — 4 reacciones clásicas (CH₄, Fe+CuSO₄, SN2, Fischer) con NIST/CRC (commit ad1c281, +27 tests)
- [x] **Fase 5** — IR/Raman Hessian + Jacobi + 5 moléculas vs NIST (commit 68b7554, +27 tests)
- [x] **Fase 6** — Bosch-Hale fusion + Gamow + Lawson (commit b25698a, +28 tests)
- [x] **Fase 7** — Vinardo + Monte Carlo conformational search (commit 564b60d, +18 tests)

**Suite total**: 814 tests pasando (baseline pre-Fase 4 = 714 → +100 nuevos).

---

*Última actualización: 2026-05-12 — Fases 1-7 completas.*
