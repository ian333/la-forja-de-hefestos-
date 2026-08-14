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
import { subshellColor, subshellColorLive, subshellLabel } from './atom-builder';

export interface AtomAbInitio {
  Z: number;
  L: number;                       // semi-lado de la caja del cálculo (bohr)
  /** `m` >= 0 ⇒ el canal es UN ORBITAL (ATM3). `m` = -1 ⇒ la subcapa entera (ATM2). */
  shells: { n: number; l: number; electrons: number; m: number }[];
  pos: Float32Array;               // M×3 en bohr
  shellOf: Uint8Array;             // M
  dens: Uint8Array;                // M — densidad relativa (0-255), para tamaño y brillo
}

/** Nombre del canal: `2pₓ`, `3d_z²`… o `2p` si el bin trae la subcapa entera. */
export const ORB_M: Record<number, string[]> = {
  0: ['s'],
  1: ['pₓ', 'p_y', 'p_z'],
  2: ['d_xy', 'd_yz', 'd_z²', 'd_xz', 'd_x²−y²'],
  3: ['f₁', 'f₂', 'f₃', 'f_z³', 'f₅', 'f₆', 'f₇'],
};
export function orbLabel(n: number, l: number, m: number): string {
  if (m < 0) return subshellLabel(n, l);
  return `${n}${(ORB_M[l] ?? ['?'])[m] ?? '?'}`;
}

export function parseAtomBin(buf: ArrayBuffer): AtomAbInitio {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  // ATM1 → sin densidad. ATM2 → + densidad por punto, un canal por SUBCAPA.
  // ATM3 → un canal por ORBITAL (n,l,m): 16 bytes por canal en vez de 12.
  //
  // POR QUÉ EXISTE ATM3 (Ian, 2026-08-11: "son simples puntos en una nube circular, no hay
  // orbitales"). Tenía razón: el ATM2 guarda la densidad SUMADA sobre la subcapa, y una
  // subcapa llena es una ESFERA por el teorema de Unsöld. Con ese archivo el neón, el cromo
  // y el cobre no tenían UNA SOLA forma que enseñar. ATM3 guarda R_nl(r)·|Y_lm|² por
  // separado — la factorización es EXACTA para un átomo aislado, y la base real de m es la
  // convención del libro (pₓ/p_y/p_z, d_xy/d_z²/…), declarada como tal.
  if (magic !== 'ATM1' && magic !== 'ATM2' && magic !== 'ATM3') throw new Error(`bin de átomo con firma inesperada: ${magic}`);
  const porOrbital = magic === 'ATM3';
  let o = 4;
  const Z = dv.getInt32(o, true); o += 4;
  const M = dv.getInt32(o, true); o += 4;
  const S = dv.getInt32(o, true); o += 8;      // +4 del reservado (=1 en ATM3)
  const POSQ = dv.getFloat32(o, true); o += 4;
  const L = dv.getFloat32(o, true); o += 4;

  const shells: AtomAbInitio['shells'] = [];
  for (let i = 0; i < S; i++) {
    shells.push({
      n: dv.getInt32(o, true),
      l: dv.getInt32(o + 4, true),
      electrons: dv.getInt32(o + 8, true),
      m: porOrbital ? dv.getInt32(o + 12, true) : -1,
    });
    o += porOrbital ? 16 : 12;
  }
  // RUTA RÁPIDA: una vista Int16Array sobre el buffer en vez de 330 000 llamadas a
  // getInt16 (con 110 000 puntos eso son 3 lecturas por punto, una por una). El único
  // requisito es alineación a 2 bytes; el encabezado mide 28 + 12·S, siempre par, así que
  // se cumple — pero se comprueba y hay respaldo por si el formato cambia.
  const pos = new Float32Array(M * 3);
  if (o % 2 === 0) {
    const raw = new Int16Array(buf, o, M * 3);          // cero copias, cero DataView
    const inv = 1 / POSQ;
    for (let i = 0; i < M * 3; i++) pos[i] = raw[i] * inv;
    o += M * 6;
  } else {
    for (let i = 0; i < M * 3; i++) { pos[i] = dv.getInt16(o, true) / POSQ; o += 2; }
  }
  const shellOf = new Uint8Array(buf.slice(o, o + M)); o += M;
  // ATM2 y ATM3 traen densidad por punto; sólo el ATM1 viejo no (ahí se rellena plano).
  const dens = magic === 'ATM1' ? new Uint8Array(M).fill(160) : new Uint8Array(buf.slice(o, o + M));
  return { Z, L, shells, pos, shellOf, dens };
}

/**
 * Del .bin al formato que ya consume `ElectronCloud`. Mismo contrato que `buildAtomBundle`.
 *
 * ⚠ TAMAÑO Y BRILLO SE MODULAN POR DENSIDAD, IGUAL QUE EL VIDEO (2026-07-31):
 *     tamaño = 0.030 + 0.055·d        brillo = 0.70 + 0.20·d
 * Ese es el CANON DEL VIDEO y aquí se conserva intacto (`live=false`).
 *
 * ⚠⚠ PERO EN EL LABORATORIO (`live=true`) LA MODULACIÓN VA AL REVÉS. Por qué:
 * los puntos YA se muestrean ∝ |ψ|² (donde hay densidad hay MÁS PUNTOS), así que
 * multiplicar ADEMÁS tamaño y brillo por `d` pinta un mapa ∝ densidad². El halo vive en
 * d≈0.06 ⇒ le tocaba el tamaño MÍNIMO con brillo casi máximo = puntitos chiquitos y
 * fuertes, separados entre sí: la receta literal del CONFETI (medido: 30 % del anillo en
 * negro puro en C, 47 % en Fe). Dos jueces independientes midieron lo mismo y propusieron
 * invertirlo:
 *     tamaño = 0.085 − 0.048·d        brillo = 0.42 − 0.12·d
 * o sea GRANDE Y TENUE donde hay pocos puntos (tapan el hueco y se funden en nube) y
 * CHICO Y SOBRIO donde hay muchos (la masa la da la DENSIDAD, no la intensidad por
 * partícula — la misma ley que ya gobierna a O2Cloud en los videos ganadores).
 * En el video no se toca porque ahí la resolución 4K resuelve el punto y el look ya ganó.
 */
export function bundleFromAbInitio(data: AtomAbInitio, live = false) {
  const { pos, shellOf, shells, dens } = data;
  const M = shellOf.length;
  const hex = (n: number, l: number) => (live ? subshellColorLive(n, l) : subshellColor(n, l));
  const paleta = shells.map(s => {
    const c = new THREE.Color(hex(s.n, s.l));
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    // CADA ORBITAL SU MATIZ (Ian, 2026-08-14: "juguemos más con los colores"). Dentro de la
    // familia (todos los p rojos, todos los d verdes) cada m se corre un poco de tono:
    // pₓ/p_y/p_z ya no son el MISMO rojo — se ve que son tres cuartos distintos, que es
    // justo lo que el barrido enseña. Centrado en el tono de la familia (Σ corrimientos = 0)
    // para que la suma de la subcapa siga leyéndose del color canónico.
    const mShift = (s.m >= 0 && s.l > 0) ? (s.m - s.l) * 0.045 : 0;
    return new THREE.Color().setHSL((hsl.h + mShift + 1) % 1, Math.min(1, hsl.s * 1.3), Math.min(0.60, hsl.l));
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
    const bright = live ? 0.42 - 0.12 * d : 0.70 + 0.20 * d;
    colors[i * 3] = c.r * bright;
    colors[i * 3 + 1] = c.g * bright;
    colors[i * 3 + 2] = c.b * bright;
    sizes[i] = live ? 0.085 - 0.048 * d : 0.030 + 0.055 * d;
    shellIdx[i] = shellOf[i];
  }
  return {
    positions, colors, sizes, shellIdx,
    shells: shells.map(s => ({
      label: orbLabel(s.n, s.l, s.m),
      n: s.n, l: s.l, m: s.m,
      color: new THREE.Color(hex(s.n, s.l)),
      electrons: s.electrons,
    })),
  };
}

// v3 = un canal por ORBITAL (ATM3). Se INTENTA primero y se cae a v2 (por subcapa) para los
// elementos que todavía no se han recalculado: así el laboratorio nunca se queda sin nube, y
// los .bin viejos siguen sirviendo sin borrar nada.
const VERSIONES_BIN = [3, 2];
const cache = new Map<number, AtomAbInitio | null>();

/** Carga la nube ab initio de Z. `null` = ese elemento no tiene .bin (hueco declarado). */
export async function loadAtomAbInitio(Z: number): Promise<AtomAbInitio | null> {
  if (cache.has(Z)) return cache.get(Z)!;
  try {
    // La VERSIÓN va en el nombre porque estos archivos se sirven con caché inmutable de 30
    // días en el borde: reescribirlos no invalida nada (medido: tras recalcular los 118,
    // producción seguía entregando el formato viejo con cf-cache-status HIT). Subir este
    // número junto con VERSION_BIN de precompute-atom-orbitals.py.
    for (const v of VERSIONES_BIN) {
      const r = await fetch(`/precomputed/atoms/z${String(Z).padStart(3, '0')}-v${v}.bin`);
      if (!r.ok) continue;
      const d = parseAtomBin(await r.arrayBuffer());
      cache.set(Z, d);
      return d;
    }
    cache.set(Z, null);
    return null;
  } catch {
    cache.set(Z, null);
    return null;
  }
}
