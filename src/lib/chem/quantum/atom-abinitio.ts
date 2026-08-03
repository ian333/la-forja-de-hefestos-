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
  dens: Uint8Array;                // M — densidad relativa (0-255), para tamaño y brillo
}

export function parseAtomBin(buf: ArrayBuffer): AtomAbInitio {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  // ATM2 = ATM1 + un uint8 de densidad por punto. Se aceptan ambos: si llega un ATM1 viejo
  // se rellena con densidad media y se ve plano, pero no truena.
  if (magic !== 'ATM1' && magic !== 'ATM2') throw new Error(`bin de átomo con firma inesperada: ${magic}`);
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
  const shellOf = new Uint8Array(buf.slice(o, o + M)); o += M;
  const dens = magic === 'ATM2' ? new Uint8Array(buf.slice(o, o + M)) : new Uint8Array(M).fill(160);
  return { Z, L, shells, pos, shellOf, dens };
}

/**
 * Del .bin al formato que ya consume `ElectronCloud`. Mismo contrato que `buildAtomBundle`.
 *
 * ⚠ TAMAÑO Y BRILLO SE MODULAN POR DENSIDAD, IGUAL QUE EL VIDEO (corregido 2026-07-31).
 * La primera versión los dejaba CONSTANTES razonando que la densidad ya se ve como
 * concentración de puntos. Comparado lado a lado contra `cinematic-atom.html` eso resultó
 * falso: el video se ve como una masa luminosa continua y el lab como CONFETI (Ian: "no se
 * parecen en nada a nuestros videos"). Aquí se calca la fórmula de `buildAtomBundle`:
 *     tamaño = 0.030 + 0.055·d        brillo = 0.70 + 0.20·d
 * Junto con subir de 26 000 a 110 000 puntos, es lo que le da CUERPO a la nube.
 */
export function bundleFromAbInitio(data: AtomAbInitio) {
  const { pos, shellOf, shells, dens } = data;
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
    const d = dens[i] / 255;
    const bright = 0.70 + 0.20 * d;
    colors[i * 3] = c.r * bright;
    colors[i * 3 + 1] = c.g * bright;
    colors[i * 3 + 2] = c.b * bright;
    sizes[i] = 0.030 + 0.055 * d;
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

const VERSION_BIN = 2;   // debe coincidir con precompute-atom-orbitals.py
const cache = new Map<number, AtomAbInitio | null>();

/** Carga la nube ab initio de Z. `null` = ese elemento no tiene .bin (hueco declarado). */
export async function loadAtomAbInitio(Z: number): Promise<AtomAbInitio | null> {
  if (cache.has(Z)) return cache.get(Z)!;
  try {
    // La VERSIÓN va en el nombre porque estos archivos se sirven con caché inmutable de 30
    // días en el borde: reescribirlos no invalida nada (medido: tras recalcular los 118,
    // producción seguía entregando el formato viejo con cf-cache-status HIT). Subir este
    // número junto con VERSION_BIN de precompute-atom-orbitals.py.
    const r = await fetch(`/precomputed/atoms/z${String(Z).padStart(3, '0')}-v${VERSION_BIN}.bin`);
    if (!r.ok) { cache.set(Z, null); return null; }
    const d = parseAtomBin(await r.arrayBuffer());
    cache.set(Z, d);
    return d;
  } catch {
    cache.set(Z, null);
    return null;
  }
}
