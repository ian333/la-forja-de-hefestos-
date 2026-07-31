/**
 * atom-abinitio.ts — LA NUBE AB INITIO del átomo, leída del .bin.
 *
 * Los 118 elementos del laboratorio se dibujaban con orbitales HIDROGENOIDES + apantallamiento
 * de Slater: física legítima y citada (Slater, Phys. Rev. 36, 57, 1930) pero NO el mismo
 * estándar que las moléculas de la serie, que son ab initio. Esto lee lo que calcula
 * `scripts/precompute-atom-orbitals.py`: SCF real (RHF/UHF, def2-TZVP con ECP donde toca),
 * con la densidad de CADA SUBCAPA muestreada en malla 3D — sin promediar esféricamente, que
 * es lo que conserva los lóbulos.
 *
 * COBERTURA: 103 de 118. Del rutherfordio (Z=104) en adelante PySCF no trae base para nadie;
 * esos siguen con el modelo hidrogenoide y el laboratorio LO DICE. Un hueco declarado vale
 * más que un número inventado con cara de ab initio.
 *
 * Formato ATM1 (little-endian):
 *   'ATM1' · int32 Z, M, S, 0 · float32 POSQ, L
 *   S × (int32 n, int32 l, int32 electrones)
 *   M × int16[3] posiciones (bohr = valor/POSQ)
 *   M × uint8 índice de subcapa
 */
import * as THREE from 'three';
import { subshellColor, subshellLabel } from './atom-builder';

export interface AtomAbInitio {
  Z: number;
  L: number;                       // semi-lado de la caja del cálculo (bohr)
  shells: { n: number; l: number; electrons: number }[];
  pos: Float32Array;               // M×3 en bohr
  shellOf: Uint8Array;             // M
}

export function parseAtomBin(buf: ArrayBuffer): AtomAbInitio {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'ATM1') throw new Error(`bin de átomo con firma inesperada: ${magic}`);
  let o = 4;
  const Z = dv.getInt32(o, true); o += 4;
  const M = dv.getInt32(o, true); o += 4;
  const S = dv.getInt32(o, true); o += 8;      // +4 del reservado
  const POSQ = dv.getFloat32(o, true); o += 4;
  const L = dv.getFloat32(o, true); o += 4;

  const shells: AtomAbInitio['shells'] = [];
  for (let i = 0; i < S; i++) {
    shells.push({
      n: dv.getInt32(o, true),
      l: dv.getInt32(o + 4, true),
      electrons: dv.getInt32(o + 8, true),
    });
    o += 12;
  }
  const pos = new Float32Array(M * 3);
  for (let i = 0; i < M * 3; i++) { pos[i] = dv.getInt16(o, true) / POSQ; o += 2; }
  const shellOf = new Uint8Array(buf, o, M);
  return { Z, L, shells, pos, shellOf };
}

/**
 * Del .bin al formato que ya consume `ElectronCloud`. Mismo contrato que `buildAtomBundle`,
 * así que la escena no cambia.
 *
 * BRILLO UNIFORME A PROPÓSITO: los puntos ya vienen muestreados ∝ densidad (inverse-CDF sobre
 * la malla), así que la densidad SE VE como concentración de puntos. Modularle además el
 * brillo la contaría dos veces y quemaría el centro — es el mismo criterio que O2Cloud en los
 * videos de moléculas.
 */
export function bundleFromAbInitio(data: AtomAbInitio) {
  const { pos, shellOf, shells } = data;
  const M = shellOf.length;
  const paleta = shells.map(s => {
    const c = new THREE.Color(subshellColor(s.n, s.l));
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    // Saturación empujada y luminancia acotada: en aditivo el color ES la saturación
    // (sumar brillo lava a blanco). Mismo tratamiento que el camino hidrogenoide.
    return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.3), Math.min(0.60, hsl.l));
  });

  const positions = new Float32Array(M * 3);
  const colors = new Float32Array(M * 3);
  const sizes = new Float32Array(M);
  const shellIdx = new Float32Array(M);
  for (let i = 0; i < M; i++) {
    positions[i * 3] = pos[i * 3];
    positions[i * 3 + 1] = pos[i * 3 + 1];
    positions[i * 3 + 2] = pos[i * 3 + 2];
    const c = paleta[Math.min(shellOf[i], paleta.length - 1)];
    colors[i * 3] = c.r * 0.82;
    colors[i * 3 + 1] = c.g * 0.82;
    colors[i * 3 + 2] = c.b * 0.82;
    sizes[i] = 0.048;
    shellIdx[i] = shellOf[i];
  }
  return {
    positions, colors, sizes, shellIdx,
    shells: shells.map(s => ({
      label: subshellLabel(s.n, s.l),
      n: s.n, l: s.l,
      color: new THREE.Color(subshellColor(s.n, s.l)),
    })),
  };
}

const cache = new Map<number, AtomAbInitio | null>();

/** Carga la nube ab initio de Z. `null` = ese elemento no tiene .bin (hueco declarado). */
export async function loadAtomAbInitio(Z: number): Promise<AtomAbInitio | null> {
  if (cache.has(Z)) return cache.get(Z)!;
  try {
    const r = await fetch(`/precomputed/atoms/z${String(Z).padStart(3, '0')}.bin`);
    if (!r.ok) { cache.set(Z, null); return null; }
    const d = parseAtomBin(await r.arrayBuffer());
    cache.set(Z, d);
    return d;
  } catch {
    cache.set(Z, null);
    return null;
  }
}
