/**
 * ══════════════════════════════════════════════════════════════════════
 *  quantum/atom-builder — Un átomo multi-electrón desde su Z
 * ══════════════════════════════════════════════════════════════════════
 *
 * Dado un elemento (Z, configuración), produce la lista de sub-orbitales
 * que habitan sus electrones, cada uno con su Z efectiva (Slater) para
 * que el tamaño de la nube sea realista.
 *
 * Para visualización combinamos las nubes de cada sub-orbital — el
 * resultado es la densidad electrónica total del átomo. Para núcleos
 * con más de ~10 electrones los d y f comienzan a aparecer.
 *
 * Esto NO resuelve Hartree-Fock — es el esqueleto de orbitales
 * hidrogenoides con apantallamiento Slater. Suficientemente preciso
 * para enseñar forma y tendencias; para energías espectroscópicas
 * precisas se necesita HF o DFT (capa superior, no bloqueante).
 *
 * Ref [AB1] Slater, J.C. "Atomic Shielding Constants", Phys. Rev. 36, 57 (1930).
 * Ref [AB2] Clementi, E. & Raimondi, D.L., J. Chem. Phys. 38, 2686 (1963).
 * Ref [AB3] Szabo, A. & Ostlund, N.S. "Modern Quantum Chemistry", Dover, 1996.
 */

import {
  type Element,
  type Subshell,
  effectiveZ,
} from './periodic-table';
import {
  ORBITALS,
  sampleOrbital,
  type OrbitalKey,
  type SamplePoint,
} from './orbitals';

// ═══════════════════════════════════════════════════════════════
// MAPEO (n, l) → set de orbitales reales (sus "hijos" orientables)
// ═══════════════════════════════════════════════════════════════
//
// Un subshell con número cuántico azimutal l tiene 2l+1 orbitales reales
// equivalentes (px, py, pz para p; dz², dxy, dxz, dyz, dx²−y² para d).
// Cada uno alberga hasta 2 electrones (spin up, spin down).

export function realOrbitalsOf(n: number, l: number): OrbitalKey[] {
  // Para l=0 (s): un solo orbital
  // Para l=1 (p): 3 orbitales reales (px, py, pz)
  // Para l=2 (d): 5 orbitales reales — tenemos 4 codificados + 1 adicional (dyz)
  //               reutilizamos dxz para dyz hasta codificar los 5 completos
  // Para l=3 (f): 7 orbitales — por ahora fallback a mapeo esférico con s
  if (n === 1 && l === 0) return ['1s'];
  if (n === 2 && l === 0) return ['2s'];
  if (n === 2 && l === 1) return ['2px', '2py', '2pz'];
  if (n === 3 && l === 0) return ['3s'];
  if (n === 3 && l === 1) return ['3px', '3py', '3pz'];
  if (n === 3 && l === 2) return ['3dz2', '3dxy', '3dxz', '3dxz', '3dx2y2']; // 5 slots (dyz reutiliza dxz visualmente)
  // Para n>3: reutilizamos las mismas formas (aproximación visual — radial crece
  // pero la forma angular es idéntica, por lo que l correcto y nube mayor)
  if (l === 0) return ['3s'];                                    // 1 slot (ns→3s fallback)
  if (l === 1) return ['3px', '3py', '3pz'];                     // 3 slots
  if (l === 2) return ['3dz2', '3dxy', '3dxz', '3dxz', '3dx2y2'];// 5 slots
  // f: 7 slots, todos usando 3s esférico hasta codificar armónicos f
  return ['3s', '3s', '3s', '3s', '3s', '3s', '3s'];
}

// ═══════════════════════════════════════════════════════════════
// Construcción del átomo: lista de sub-orbitales poblados
// ═══════════════════════════════════════════════════════════════

export interface PopulatedOrbital {
  /** Identificador del orbital real (ej. '2px', '3dz2') */
  orbitalKey: OrbitalKey;
  /** Número cuántico principal original */
  n: number;
  /** l original */
  l: number;
  /** Z efectiva aplicable al sampling (tamaño de la nube) */
  Zeff: number;
  /** Electrones en este orbital real (0, 1 o 2) */
  electrons: number;
  /** Etiqueta compacta para UI: "2px↑↓" */
  label: string;
}

/**
 * Dado un elemento, devuelve la lista de orbitales reales poblados
 * (uno por cada forma spatial distinta) con su Z efectiva Slater.
 *
 * Estrategia de población: electrones del subshell se reparten equitativamente
 * entre los 2l+1 orbitales reales (regla de Hund: llenar paralelos primero),
 * después de pareja.
 */
export function populateAtom(element: Element): PopulatedOrbital[] {
  const out: PopulatedOrbital[] = [];
  for (const sub of element.config) {
    const realKeys = realOrbitalsOf(sub.n, sub.l);
    const maxPerReal = 2;
    const nReal = realKeys.length;
    const totalSlots = nReal * maxPerReal;
    if (sub.electrons > totalSlots) {
      // Overpopulated — no debería pasar con Madelung, pero por si acaso:
      const overflow = sub.electrons - totalSlots;
      console.warn(`Subshell ${sub.n}${sub.l} sobrepoblado (${sub.electrons} > ${totalSlots}); ignorando ${overflow}`);
    }

    // Regla de Hund: primero un electrón en cada orbital real, luego parear
    const perReal = new Array(nReal).fill(0);
    let remaining = Math.min(sub.electrons, totalSlots);
    // Ronda 1: un electrón en cada uno
    for (let i = 0; i < nReal && remaining > 0; i++) {
      perReal[i] += 1;
      remaining--;
    }
    // Ronda 2: segundo electrón (spin opuesto)
    for (let i = 0; i < nReal && remaining > 0; i++) {
      perReal[i] += 1;
      remaining--;
    }

    const Zeff = effectiveZ(element.Z, sub.n, sub.l);

    for (let i = 0; i < nReal; i++) {
      if (perReal[i] === 0) continue;
      out.push({
        orbitalKey: realKeys[i],
        n: sub.n,
        l: sub.l,
        Zeff,
        electrons: perReal[i],
        label: `${realKeys[i]}${perReal[i] === 1 ? '↑' : '↑↓'}`,
      });
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// Muestreo combinado: nube de densidad total del átomo
// ═══════════════════════════════════════════════════════════════

export interface AtomSample extends SamplePoint {
  /** Subshell (n, l) al que pertenece este electrón */
  n: number;
  l: number;
  /** Orbital real del que vino */
  orbitalKey: OrbitalKey;
}

/**
 * Muestrea todos los orbitales poblados del átomo, proporcional al
 * número de electrones en cada uno.
 */
export function sampleAtom(
  element: Element,
  totalPoints: number,
  seed = 42,
): AtomSample[] {
  const populated = populateAtom(element);
  const totalElectrons = populated.reduce((s, o) => s + o.electrons, 0);
  if (totalElectrons === 0) return [];

  const out: AtomSample[] = [];
  let remaining = totalPoints;

  for (let i = 0; i < populated.length; i++) {
    const orb = populated[i];
    const isLast = i === populated.length - 1;
    const npts = isLast
      ? remaining
      : Math.round((orb.electrons / totalElectrons) * totalPoints);
    remaining -= npts;
    if (npts <= 0) continue;

    const orbital = ORBITALS[orb.orbitalKey];
    if (!orbital) continue;

    const points = sampleOrbital(orbital, npts, orb.Zeff, seed + i * 17);
    for (const p of points) {
      out.push({ ...p, n: orb.n, l: orb.l, orbitalKey: orb.orbitalKey });
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// Métricas derivadas
// ═══════════════════════════════════════════════════════════════

/** Tamaño visual sugerido (bohrs) — radio al que la nube es relevante. */
export function atomExtent(element: Element): number {
  const populated = populateAtom(element);
  let maxExt = 3;
  for (const orb of populated) {
    const orbital = ORBITALS[orb.orbitalKey];
    if (!orbital) continue;
    const ext = orbital.extent / orb.Zeff;
    if (ext > maxExt) maxExt = ext;
  }
  return maxExt;
}

/** Núcleo: número de protones y (para isótopo más común) neutrones aproximados. */
export function nucleusInfo(element: Element): { protons: number; neutrons: number } {
  const mass = Math.round(element.mass);
  return {
    protons: element.Z,
    neutrons: Math.max(0, mass - element.Z),
  };
}

// ═══════════════════════════════════════════════════════════════
// Color por subshell — para UI diferenciando electrones
// ═══════════════════════════════════════════════════════════════

export function subshellColor(n: number, l: number): string {
  // Diferencia visual inmediata:
  //   s: azul cielo
  //   p: rojo-naranja (con variación por orientación)
  //   d: verde
  //   f: violeta
  if (l === 0) return n <= 2 ? '#4FC3F7' : n === 3 ? '#29B6F6' : '#0288D1';
  if (l === 1) return n === 2 ? '#FF7043' : n === 3 ? '#FF5722' : '#E64A19';
  if (l === 2) return '#66BB6A';
  if (l === 3) return '#AB47BC';
  return '#9E9E9E';
}

/** Nombre legible del subshell */
export function subshellLabel(n: number, l: number): string {
  const labels = ['s', 'p', 'd', 'f', 'g', 'h'];
  return `${n}${labels[l] ?? 'x'}`;
}
