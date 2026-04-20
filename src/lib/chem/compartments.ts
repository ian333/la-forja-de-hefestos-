/**
 * ══════════════════════════════════════════════════════════════════════
 *  compartments — Sistema multi-caja con flujos acoplados
 * ══════════════════════════════════════════════════════════════════════
 *
 * Un compartimento (box, reservorio, caja) es una región bien mezclada
 * con su propia composición, temperatura y cinética interna. Los
 * compartimentos se conectan por flujos: advección, difusión, sedimentación,
 * deposición, emisión, evaporación.
 *
 * Esta es la pieza clave para pasar de "batch reactor" a:
 *   - Atmósfera multi-capa (troposfera + estratosfera + boundary layer)
 *   - Ocean-atmosphere coupling (gas flux, Henry's law)
 *   - Biosfera (hojas + tronco + suelo + atmósfera)
 *   - Planeta multi-latitud (celdas de Hadley, Ferrel, Polar)
 *
 * La abstracción es universal: cualquier sistema "con pedazos que hablan"
 * se modela como N compartimentos con flux(i→j).
 *
 * Ref [C1] Jacob, D.J. "Introduction to Atmospheric Chemistry", Princeton
 *          University Press, 1999. Capítulo 3 (box models).
 * Ref [C2] Seinfeld, J.H. & Pandis, S.N. "Atmospheric Chemistry and Physics",
 *          3rd ed., Wiley, 2016. Capítulo 25.
 */

import type { ReactionStep, Concentrations } from './kinetics';
import { derivatives } from './kinetics';
import type { OdeFn, StiffOptions } from './stiff-solver';
import { solveStiff } from './stiff-solver';

// ═══════════════════════════════════════════════════════════════
// Estructura de un compartimento
// ═══════════════════════════════════════════════════════════════

export interface Compartment {
  id: string;
  name: string;
  /** Volumen [L] o [m³] — debe ser consistente con C [mol/L] o [mol/m³] */
  volume: number;
  /** Temperatura interna [K] */
  T: number;
  /** Química interna de este compartimento (distintas cajas pueden tener
   *  cinéticas distintas — p.ej. en aerosol vs. gas) */
  steps: ReactionStep[];
  /** Concentraciones iniciales */
  initial: Concentrations;
  /** Emisión externa constante [mol/(L·s)] o [mol/(m³·s)] por especie */
  emission?: Concentrations;
  /** Deposición seca: k_dep·C, rate constante por especie [s⁻¹] */
  deposition?: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// Flujos entre compartimentos
// ═══════════════════════════════════════════════════════════════

export type FluxKind = 'diffusive' | 'advective';

export interface Flux {
  /** ID compartimento origen */
  from: string;
  /** ID compartimento destino */
  to: string;
  /** Coeficiente de transferencia [s⁻¹] */
  rate: number;
  /** Lista de especies sujetas al flujo (si vacío: todas) */
  species?: string[];
  /**
   * Tipo de flujo (default 'diffusive'):
   *
   *   'diffusive' — transferencia proporcional al gradiente:
   *        dC_from/dt = -rate · (C_from - C_to)
   *        dC_to/dt   = +rate · (C_from - C_to) · (V_from/V_to)
   *        Equilibrio ⇒ C_from = C_to.
   *        Ideal para atmósfera, turbulencia, mezcla.
   *
   *   'advective' — transferencia proporcional al contenido de origen:
   *        dC_from/dt = -rate · C_from
   *        dC_to/dt   = +rate · C_from · (V_from/V_to)
   *        Ideal para transporte unidireccional (drenaje, evaporación).
   */
  kind?: FluxKind;
}

// ═══════════════════════════════════════════════════════════════
// Sistema multi-caja
// ═══════════════════════════════════════════════════════════════

export interface MultiBoxSystem {
  compartments: Compartment[];
  fluxes: Flux[];
}

export interface MultiBoxTrajectory {
  t: number[];
  /** C[boxId][species] = serie temporal */
  C: Record<string, Record<string, number[]>>;
  species: string[];
  steps: number;
  rejected: number;
}

/**
 * Constructor del state vector:
 * y = [C_box1_sp1, C_box1_sp2, ..., C_box1_spN, C_box2_sp1, ...]
 *
 * Longitud = N_box × N_species. Usamos un orden de especies común a
 * todas las cajas (union de keys iniciales). Cualquier caja que no
 * especifique una especie la tiene en 0.
 */
function collectSpecies(sys: MultiBoxSystem): string[] {
  const s = new Set<string>();
  for (const box of sys.compartments) {
    for (const sp of Object.keys(box.initial)) s.add(sp);
    for (const step of box.steps) {
      for (const r of step.reactants) s.add(r.species);
      for (const p of step.products) s.add(p.species);
    }
  }
  return Array.from(s).sort();
}

/**
 * Simula un sistema multi-caja stiff con todos los acoplamientos.
 */
export function simulateMultiBox(
  sys: MultiBoxSystem,
  tFinal: number,
  opts: StiffOptions = {},
): MultiBoxTrajectory {
  const species = collectSpecies(sys);
  const nSp = species.length;
  const boxes = sys.compartments;
  const nBox = boxes.length;

  // Índice plano: box b, especie s → idx = b·nSp + s
  const idxOf = (b: number, s: number) => b * nSp + s;
  const boxById: Record<string, number> = {};
  boxes.forEach((box, i) => { boxById[box.id] = i; });

  // Construir vector inicial
  const y0 = new Array(nBox * nSp).fill(0);
  for (let b = 0; b < nBox; b++) {
    const box = boxes[b];
    for (let s = 0; s < nSp; s++) {
      y0[idxOf(b, s)] = box.initial[species[s]] ?? 0;
    }
  }

  // Precompute indexes of flux species
  const fluxSpecIdx: number[][] = sys.fluxes.map((f) => {
    if (!f.species || f.species.length === 0) {
      return species.map((_, i) => i);
    }
    return f.species
      .map((sp) => species.indexOf(sp))
      .filter((i) => i >= 0);
  });

  // ODE global
  const f: OdeFn = (_t: number, y: number[]): number[] => {
    const dy = new Array(y.length).fill(0);

    // 1) Cinética interna y emisión/deposición por caja
    for (let b = 0; b < nBox; b++) {
      const box = boxes[b];
      const C: Concentrations = {};
      for (let s = 0; s < nSp; s++) C[species[s]] = y[idxOf(b, s)];
      const dC = derivatives(box.steps, box.T, C);
      for (let s = 0; s < nSp; s++) {
        dy[idxOf(b, s)] += dC[species[s]] ?? 0;
        // Emisión
        const emit = box.emission?.[species[s]];
        if (emit) dy[idxOf(b, s)] += emit;
        // Deposición (pérdida lineal)
        const kdep = box.deposition?.[species[s]];
        if (kdep) dy[idxOf(b, s)] -= kdep * y[idxOf(b, s)];
      }
    }

    // 2) Flujos entre cajas: diffusive (default) o advective
    for (let fi = 0; fi < sys.fluxes.length; fi++) {
      const flux = sys.fluxes[fi];
      const bFrom = boxById[flux.from];
      const bTo   = boxById[flux.to];
      if (bFrom === undefined || bTo === undefined) continue;
      const Vfrom = boxes[bFrom].volume;
      const Vto   = boxes[bTo].volume;
      const ratio = Vfrom / Vto;
      const kind = flux.kind ?? 'diffusive';
      for (const s of fluxSpecIdx[fi]) {
        const cFrom = y[idxOf(bFrom, s)];
        const cTo   = y[idxOf(bTo,   s)];
        let flow: number;
        if (kind === 'diffusive') {
          flow = flux.rate * (cFrom - cTo);              // ∝ gradiente
        } else {
          flow = flux.rate * cFrom;                      // advectivo: sólo del from
        }
        dy[idxOf(bFrom, s)] -= flow;                      // source pierde
        dy[idxOf(bTo,   s)] += flow * ratio;              // sink gana (ajustado por V)
      }
    }

    return dy;
  };

  const res = solveStiff(f, 0, y0, tFinal, opts);

  // Des-multiplexar resultado
  const C: Record<string, Record<string, number[]>> = {};
  for (let b = 0; b < nBox; b++) {
    const box = boxes[b];
    C[box.id] = {};
    for (let s = 0; s < nSp; s++) {
      C[box.id][species[s]] = res.y.map((row) => row[idxOf(b, s)]);
    }
  }

  return { t: res.t, C, species, steps: res.steps, rejected: res.rejected };
}

// ═══════════════════════════════════════════════════════════════
// Helpers para casos comunes
// ═══════════════════════════════════════════════════════════════

/**
 * Difusión turbulenta entre dos cajas verticales (p.ej. PBL ↔ free trop).
 * kZ [m²/s] es la difusividad turbulenta. La tasa de intercambio es
 * kZ/H² donde H es la altura característica entre cajas.
 *
 * Genera UN flux difusivo (ambas cajas se equilibran automáticamente por
 * la formulación dC ∝ (C_from − C_to)).
 */
export function verticalDiffusion(
  boxLow: string,
  boxHigh: string,
  kZ: number,          // [m²/s]
  H: number,           // [m]
): Flux[] {
  const rate = kZ / (H * H);
  return [{ from: boxLow, to: boxHigh, rate, kind: 'diffusive' }];
}

/**
 * Flux gas↔aqueous (ley de Henry) simplificado: equilibrio rápido
 * entre fase gas y partición aqueous. Se modela como par de flujos
 * balanceados que tienden al cociente de Henry.
 */
export function henryExchange(
  gasBox: string,
  aqueousBox: string,
  speciesHenry: Record<string, number>, // K_H [M/atm] por especie
  rate = 1e-3,                           // tasa de acercamiento al equilibrio [s⁻¹]
): Flux[] {
  const out: Flux[] = [];
  for (const sp of Object.keys(speciesHenry)) {
    // Simplificado: dos flujos iguales; el equilibrio emerge de la
    // diferencia de concentraciones. Para rigor habría que parametrizar
    // K_H explícitamente en el rate — pendiente.
    out.push({ from: gasBox,     to: aqueousBox, rate, species: [sp] });
    out.push({ from: aqueousBox, to: gasBox,     rate, species: [sp] });
  }
  return out;
}
