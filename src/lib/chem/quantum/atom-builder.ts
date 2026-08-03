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
  // Modo marca Gaia (gated por window.__GAIA_BRAND): paleta cyan→morado→magenta
  // para el intro de partículas. NO afecta los videos de química (no setean el flag).
  if (typeof globalThis !== 'undefined' && (globalThis as any).__GAIA_BRAND) {
    if (l === 0) return '#22d3ee';   // s: cyan (núcleo interno)
    if (l === 1) return '#a855f7';   // p: morado (lóbulos principales)
    if (l === 2) return '#d946ef';   // d: magenta
    if (l === 3) return '#d8b4fe';   // f: morado claro
    return '#8b5cf6';
  }
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

/**
 * PALETA SEGURA EN ADITIVO — solo para el LABORATORIO interactivo (`live`).
 *
 * ⚠ NO la usan los videos: `subshellColor` (arriba) es el canon de los reels y no se toca.
 *
 * EL DEFECTO QUE ARREGLA (medido, no opinado): azul de s `#4FC3F7` (79,195,247) + naranja de
 * p `#FF7043` (255,112,67) = RGB(334,307,314) → **blanco EXACTO**. Dos matices complementarios
 * SUMADOS dan gris a CUALQUIER nivel de exposición: el corazón del átomo se lavaba por
 * construcción de la paleta, no por estar sobreexpuesto. Y `1s` y `2s` compartían el mismo hex,
 * así que las dos primeras capas eran indistinguibles.
 *
 * LA REGLA: en TODOS los colores el canal VERDE queda por debajo del azul o del rojo. Ninguna
 * suma de esta paleta puede llegar a neutro — siempre queda un canal dominante, o sea CROMA.
 * Comprobado: azul(2s) + magenta(2p) = (285,218,402) → sigue siendo AZUL-VIOLETA, no blanco.
 *
 * Y el reparto se decidió MIRANDO capturas, no en el papel: la primera versión puso p en
 * violeta y en el silicio el 3p no se distinguía del 3s (60° de tono no alcanzan sobre negro
 * con bloom). p se movió a MAGENTA (130° del azul) y d se quedó con el violeta, que cae justo
 * entre los dos.
 *
 * ⚠ EL `n` CORRE EL TONO, NO LA LUMINANCIA. `bundleFromAbInitio` aplasta todo con
 * `min(0.60, l)` (anti-lavado del aditivo), así que un degradado hecho a base de claros se
 * COLAPSA: `#4FC3F7` y `#9BE0FF` tienen EXACTAMENTE el mismo tono (198.6°) y salían del cap
 * como el mismo pixel — 3s y 4s indistinguibles. Y el 1s no puede ser el más oscuro: en el
 * hidrógeno el 1s es TODO el átomo (medido: con el azul profundo el H se apagó de coreY 162
 * a 48). Por eso la rampa de s va cian(1s) → celeste(2s) → azul(3s) → azul profundo(4s+),
 * toda a luminancia alta.
 */
export function subshellColorLive(n: number, l: number): string {
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as Record<string, unknown>).__GAIA_BRAND) {
    return subshellColor(n, l);
  }
  if (l === 0) return n <= 1 ? '#4FC3F7' : n === 2 ? '#2F8BF0' : n === 3 ? '#5EB0D8' : '#6E9BE0';
  if (l === 1) return n <= 2 ? '#FF2E9A' : n === 3 ? '#FF5BD8' : '#FF3D6E';
  if (l === 2) return n <= 3 ? '#B84BFF' : '#D14BE8';
  if (l === 3) return '#6A4CFF';
  return '#8FA3C8';
}

/** Nombre legible del subshell */
export function subshellLabel(n: number, l: number): string {
  const labels = ['s', 'p', 'd', 'f', 'g', 'h'];
  return `${n}${labels[l] ?? 'x'}`;
}
