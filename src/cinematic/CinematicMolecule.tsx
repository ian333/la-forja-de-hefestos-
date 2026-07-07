/**
 * CinematicMolecule — el salto de átomo a MOLÉCULA, con física real.
 *
 * Reusa la maquinaria cinematográfica de CinematicAtom (cuts de cámara, postFX,
 * núcleos, nube de electrones con movimiento). La nube electrónica NO se calcula
 * en el cliente: se PRECOMPUTA en iangpu muestreando la densidad LCAO real
 * (orbitales moleculares de canonical-molecules.ts) y se carga como .bin.
 *
 * Color por simetría del MO: cian = enlaces σ, rosa = pares libres (los que
 * causan el ángulo 104.5° del agua). Geometría VSEPR real.
 *
 * Tiempo determinista: window.__cinematicAtom.renderAt(t) ∈ [0, 15].
 */
import { useEffect, useMemo, useState, memo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, BrightnessContrast, HueSaturation, ToneMapping, Noise } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { elementByZ } from '@/lib/chem/quantum/periodic-table';
import { nucleusInfo } from '@/lib/chem/quantum/atom-builder';
import { vibrationalAnalysis, FF_H2O } from '@/lib/chem/quantum/vibrations';
import {
  Nucleus, ElectronCloud, FrameDriver, Letterbox, CinemaVignette, MagneticField, smoothstep, buildAtomBundle, type AtomBundle,
} from './CinematicAtom';
import { CATALOG_KEYS, CATALOG_FIELD, CATALOG_FIELD_SUB, CATALOG_META, CATALOG_SCALE } from './catalog-data';

const DURATION = 22;   // más largo: la escena RESPIRA (cámara lenta y lejana)
// SLOW-MO de la formación O₂: el choque de Morse REAL dura ~1.1s (rapidísimo a
// escala atómica). Para PODER VER cómo se forma el enlace lo vemos en cámara
// lenta ×3 (slow-motion de una dinámica real, no falseo): acercamiento ~3.3s +
// overshoot/vibración visible 3-7s. La física no cambia, solo el reloj de cámara.
// PELÍCULA de 30s (no reel rápido): el enlace se forma DESPACIO, contemplativo.
const O2_FILM_DURATION = 70;   // narración v5 ~65.7s + cola en silencio
const CARO_DURATION = 45;   // FLAGSHIP caroteno: la curva de retención dice que 70s
                            // pierde (solo 19% llega); 45s aprieta el ritmo, sube el % completado
const O2_SLOWMO = 10.0;   // punto dulce: dinámico desde el inicio pero sin atropellar
                          // (13.5 se veía muerto al arranque, 7 iba muy rápido)
// Escala de las nubes atómicas de O (buildAtomBundle ~3 bohr) para que se lean
// como DOS densidades separadas al inicio (núcleos a ±2.7 bohr) y se fundan.
const ATOM_CLOUD_SCALE = 0.82;
// FLASH de energía de enlace: al formarse el O₂ se liberan ~498 kJ/mol (energía
// del doble enlace). Físicamente la energía cinética de la caída al pozo de Morse
// se libera al pasar por re (primer overshoot) → destello + onda expansiva. El
// pico cae en el momento del choque (en tiempo de cámara lenta ≈ 3.5 s).
const O2_FLASH_T = 7.8;   // el choque cae a ~7.8s (con el Morse lento)
function o2Flash(t: number): number {
  const d = t - O2_FLASH_T;
  if (d < -0.9 || d > 6) return 0;
  // sube (gaussiana ancha) y decae lento — en la película el destello RESPIRA, no parpadea
  return d < 0 ? Math.exp(-(d * d) / (2 * 0.28 * 0.28)) : Math.exp(-d / 1.1);
}
// ── CATÁLOGO de enlaces AB INITIO (la serie): cada diatómica con su Re MEDIDO
// (bohr, para el drive de Morse) y mu = e⁻ desapareados (el imán; 0 = no magnético).
// El .bin <mol>-abinitio.bin lo genera scripts/precompute-bond-abinitio.py.
// swirl = giro del anillo π (rad/s) alrededor del eje de enlace — la firma hipnótica
// de los enlaces con π fuerte (el dónut de carga π circulando). Real: el sistema π es
// cilíndrico. El O₂ ya tiene su remolino (el campo magnético), así que swirl bajo.
// pi = color de la 3a nube en singletes = la densidad π REAL (los MO π del enlace
// múltiple), un anillo cian/frío alrededor del puente σ dorado. En O₂ la 3a nube es
// el ESPÍN (violeta, el imán); sin pi definido cae al violeta por defecto.
const BOND_ABINITIO: Record<string, { Re: number; mu: number; swirl: number; pi?: [number, number, number]; boost?: number; piColors?: [number, number, number][] }> = {
  o2: { Re: 2.283, mu: 2, swirl: 0.10, boost: 1.3 },   // doble enlace · paramagnético · boost: su nube de espín tiene la mitad de masa que el π de N₂ → más luz
  n2: { Re: 2.074, mu: 0, swirl: 0.55, pi: [0.80, 0.34, 1.0] },  // triple · anillo π VIOLETA (el violeta hipnótico de O₂ — dorado+rojos+morados)
  f2: { Re: 2.668, mu: 0, swirl: 0.0, boost: 1.35 },    // enlace simple · sin π (no gira)
  c2: { Re: 2.348, mu: 0, swirl: 0.5, boost: 1.35, pi: [0.45, 0.75, 1.0], piColors: [[0.62, 0.86, 1.0], [0.30, 0.52, 1.0]] },  // ¡doble enlace de PURO π! — dos anillos hielo/azul (diamante)
  h2: { Re: 1.401, mu: 0, swirl: 0.0, boost: 1.45 },    // solo σ · 2 electrones = la nube más tenue → más luz
};
const isBond = (k: string): boolean => k in BOND_ABINITIO;

type Vec3 = [number, number, number];

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function sph(dist: number, elev: number, azim: number): Vec3 {
  return [dist * Math.cos(elev) * Math.cos(azim), dist * Math.sin(elev), dist * Math.cos(elev) * Math.sin(azim)];
}
// órbita alrededor de un centro C (para el VIAJE: clavarse en un núcleo y orbitarlo)
function orbitAround(C: Vec3, r: number, elev: number, azim: number): Vec3 {
  const o = sph(r, elev, azim);
  return [C[0] + o[0], C[1] + o[1], C[2] + o[2]];
}

// ── helpers vectoriales para el marco principal de la molécula ──
const crossV = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normV = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Marco geométrico de la molécula: eje principal (a) + plano perpendicular (p1,p2),
// centroide (c), semilongitud (L) y radio perpendicular (Rp). `chain` = la molécula
// es ALARGADA (cadena) → la cámara la ATRAVIESA en vez de orbitarla.
interface Frame { ex: number; chain: boolean; L: number; Rp: number; a: Vec3; p1: Vec3; p2: Vec3; c: Vec3; planeN: Vec3; dna?: boolean; o2?: boolean; nucX?: number; mk?: string; }

function frameFromNuclei(nuclei: { pos: Vec3 }[], ex: number): Frame {
  const base: Frame = { ex, chain: false, L: ex, Rp: ex * 0.4, a: [1, 0, 0], p1: [0, 1, 0], p2: [0, 0, 1], c: [0, 0, 0], planeN: [0, 0, 1] };
  if (nuclei.length < 2) return base;
  let c: Vec3 = [0, 0, 0];
  nuclei.forEach(n => { c = [c[0] + n.pos[0], c[1] + n.pos[1], c[2] + n.pos[2]]; });
  c = [c[0] / nuclei.length, c[1] / nuclei.length, c[2] / nuclei.length];
  // covarianza (xx,yy,zz,xy,xz,yz) → eigenvector principal por power iteration
  const cov = [0, 0, 0, 0, 0, 0];
  nuclei.forEach(n => { const d = [n.pos[0] - c[0], n.pos[1] - c[1], n.pos[2] - c[2]];
    cov[0] += d[0] * d[0]; cov[1] += d[1] * d[1]; cov[2] += d[2] * d[2];
    cov[3] += d[0] * d[1]; cov[4] += d[0] * d[2]; cov[5] += d[1] * d[2]; });
  const mv = (x: Vec3): Vec3 => [cov[0] * x[0] + cov[3] * x[1] + cov[4] * x[2],
    cov[3] * x[0] + cov[1] * x[1] + cov[5] * x[2], cov[4] * x[0] + cov[5] * x[1] + cov[2] * x[2]];
  let v: Vec3 = [1, 0.41, 0.17];
  for (let i = 0; i < 28; i++) v = normV(mv(v));
  const a = v;
  const t: Vec3 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const p1 = normV(crossV(a, t)), p2 = normV(crossV(a, p1));
  let L = 0, Rp = 0, v1 = 0, v2 = 0;
  nuclei.forEach(n => { const dx = n.pos[0] - c[0], dy = n.pos[1] - c[1], dz = n.pos[2] - c[2];
    const s = Math.abs(dx * a[0] + dy * a[1] + dz * a[2]); const perp = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - s * s));
    L = Math.max(L, s); Rp = Math.max(Rp, perp);
    const a1 = dx * p1[0] + dy * p1[1] + dz * p1[2], a2 = dx * p2[0] + dy * p2[1] + dz * p2[2];
    v1 += a1 * a1; v2 += a2 * a2; });
  // normal del plano molecular = dirección perpendicular de MENOR dispersión (en
  // una cadena conjugada plana, el plano contiene el eje; la normal es la cara π).
  const planeN = v1 < v2 ? p1 : p2;
  const elong = L / Math.max(Rp, 1e-3);
  return { ex, chain: nuclei.length >= 6 && elong > 2.2, L: L || ex, Rp: Rp || ex * 0.3, a, p1, p2, c, planeN };
}

interface Shot { pos: Vec3; fov: number; target: Vec3; roll: number; }

export const DNA_DURATION = 26;   // el ADN dura más: es un VIAJE de escala

// ── Cámara de ADN: VIAJE DE ESCALA (Powers of Ten). Arranca PEGADA a un punto de
// la hélice (escala atómica, "lo mini") y se aleja EXPONENCIALMENTE — revelando un
// par de bases → una vuelta → la doble hélice → la estructura gigante. Espiral
// lenta de revelado, la mirada migra del detalle al conjunto. Un viaje hermoso. ──
function dnaCamera(t: number, f: Frame): Shot {
  const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
  const a = f.a, c = f.c, p1 = f.p1, p2 = f.p2;
  const Rp = Math.max(f.Rp, 1), L = Math.max(f.L, 1), ext = Math.hypot(L, Rp);
  const T = Math.max(0, Math.min(1, t / DNA_DURATION));
  const zoomT = Math.min(1, T / 0.76), k = ease(zoomT);   // el zoom-out ocupa el 76%
  const hold = Math.max(0, (T - 0.76) / 0.24);             // HOLD + órbita en la vista COMPLETA
  // punto focal: cerca de la superficie, a media altura — de ahí arranca (en un clúster)
  const fp: Vec3 = [c[0] + p1[0] * Rp * 0.45, c[1] + p1[1] * Rp * 0.45, c[2] + p1[2] * Rp * 0.45];
  // distancia EXPONENCIAL (Powers of Ten): de un CLÚSTER (Rp·0.32, no el vacío) a
  // la estructura COMPLETA con aire (ext·3.4) — bastante zoom out.
  const dmin = Rp * 0.32, dmax = ext * 3.4;
  const d = dmin * Math.pow(dmax / dmin, k);
  const ph = 0.5 + k * Math.PI * 1.4 + hold * 0.8;         // espiral + sigue girando lento en el hold
  const elev = k * 0.40;
  let dir: Vec3 = [
    p1[0] * Math.cos(ph) + p2[0] * Math.sin(ph) + a[0] * Math.sin(elev) * 1.3,
    p1[1] * Math.cos(ph) + p2[1] * Math.sin(ph) + a[1] * Math.sin(elev) * 1.3,
    p1[2] * Math.cos(ph) + p2[2] * Math.sin(ph) + a[2] * Math.sin(elev) * 1.3];
  const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1; dir = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
  const pos: Vec3 = [fp[0] + dir[0] * d, fp[1] + dir[1] * d, fp[2] + dir[2] * d];
  const target: Vec3 = [lerp(fp[0], c[0], k), lerp(fp[1], c[1], k), lerp(fp[2], c[2], k)];
  return { pos, fov: lerp(52, 32, k), target, roll: 0.04 * Math.sin(t * 0.3) };
}

// ── Cámara de molécula. Dos modos:
//   COMPACTA → orbit VIOLENTO: embiste, gira duro con banking, órbita rápida, asienta.
//   CADENA   → TRAVERSAL: entra por un extremo, ATRAVIESA el esqueleto tejiendo con
//              roll, sale por el otro extremo y se abre a la vista lateral heroica.
// FÍSICA REAL de la formación del enlace: oscilador de Morse AMORTIGUADO.
// V(x) = De(1 − e^{−a(x−1)})²   (x = r/re). Integra F = −dV/dx con amortiguamiento
// (la energía radiada al enlazar). Los dos átomos CAEN al pozo, SOBREPASAN re
// (comprimen), rebotan en la pared repulsiva y VIBRAN amortiguándose hasta asentarse
// en re — eso ES la formación del enlace. La forma (asimétrica: fall→overshoot→
// vibración→settle) es física real; la escala temporal es cinematográfica.
let _morseCache: Float32Array | null = null;
function morseR(t: number): number {
  if (!_morseCache) {
    const N = 1500, dt = 0.013, a = 2.4, De = 1.0, gamma = 0.30, tScale = 5.5;
    const arr = new Float32Array(N);
    let x = 2.18, v = -0.20;   // ARRANCAN LEJOS y en deriva lenta: primero se VEN como individuos.
    // gamma bajo (0.30): tras la captura el enlace REBOTA y vibra VISIBLE muchas veces
    // (±12% aún a los 30s de película) — el "entrelazamiento" se ve una y otra vez.
    for (let i = 0; i < N; i++) {
      arr[i] = x;
      const e = Math.exp(-a * (x - 1));
      const F = -2 * De * a * e * (1 - e);              // −dV/dx (Morse)
      const acc = (F - gamma * v) * tScale;             // amortiguado (energía liberada)
      v += acc * dt;
      x += v * dt * tScale;
      if (x < 0.5) { x = 0.5; v = Math.abs(v) * 0.4; }  // pared repulsiva dura
    }
    _morseCache = arr;
  }
  // interpolación LINEAL entre muestras → R(t) CONTINUO. Con floor() se ESCALONA
  // R en la aproximación (donde la cámara casi no se mueve): a 60fps cada valor se
  // repite ~10 cuadros y se ve TRABADO. Interpolar = advección suave, 60fps real.
  const dt = 0.013;
  const x = Math.max(0, t / dt);
  const i0 = Math.min(_morseCache.length - 1, Math.floor(x));
  const i1 = Math.min(_morseCache.length - 1, i0 + 1);
  const f = x - i0;
  return _morseCache[i0] * (1 - f) + _morseCache[i1] * f;
}

// ── bondR(t): la SEPARACIÓN y la UNIÓN suceden VARIAS VECES (espacio continuo,
// cero cortes). Llaves: abre FORMADA (el pico = frame 1) → se separa ante tus ojos
// → individuos → UNIÓN #1 en "se funden" (13.1) → rebote → UNIÓN #2 (17.6, queda
// formada para el explicador σ/π/π) → respira → UNIÓN #3 SNAP en "el agarre más
// fuerte" (27) → formada para el viaje. Catmull-Rom (suave, C1) + clamp al bin. ──
const BOND_KEYS: [number, number][] = [
  [0.0, 0.98], [1.2, 1.06], [5.5, 2.05], [9.0, 1.78], [12.2, 1.22],
  [13.05, 0.88], [13.7, 1.04], [15.3, 1.50], [17.15, 0.90], [17.9, 1.02],
  [23.3, 1.00], [24.4, 1.40], [25.55, 0.90], [26.3, 1.01], [28.0, 1.00],
];
function bondR(t: number, mol = 'n2'): number {
  if (mol === 'o2') return 1.0;   // la SECUELA no re-cuenta la formación: molécula formada SIEMPRE (zpv aparte)
  const K = BOND_KEYS;
  if (t <= K[0][0]) return K[0][1];
  if (t >= K[K.length - 1][0]) return K[K.length - 1][1];
  let i = 0;
  while (i < K.length - 2 && K[i + 1][0] < t) i++;
  const p0 = K[Math.max(0, i - 1)], p1 = K[i], p2 = K[i + 1], p3 = K[Math.min(K.length - 1, i + 2)];
  const dt = p2[0] - p1[0], u = (t - p1[0]) / dt;
  // Catmull-Rom (tangentes escaladas por el paso local)
  const m1 = dt * (p2[1] - p0[1]) / (p2[0] - p0[0]);
  const m2 = dt * (p3[1] - p1[1]) / (p3[0] - p1[0]);
  const u2 = u * u, u3 = u2 * u;
  const x = (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
  return Math.max(0.86, Math.min(2.15, x));
}

// TIME-WARP cinematográfico con DESPLOME (C1): deriva lenta 0–9s (los INDIVIDUOS,
// tensión) → el tiempo ACELERA 2× más rápido que O₂ en 10.5–13 (la CAÍDA se siente
// violenta: los velos se estrellan) → asienta a ritmo normal tras la fusión. La
// compresión máxima cae en "sus nubes se funden" (14.1s). Cache determinista.
let _tauCache: Float32Array | null = null;
function morseTau(t: number): number {
  const dt = 1 / 60;
  if (!_tauCache) {
    const N = Math.ceil(90 / dt);
    const arr = new Float32Array(N);
    const S = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    let tau = 0;
    for (let i = 0; i < N; i++) {
      arr[i] = tau;
      const tt = i * dt;
      const rate = (1 / 43) + (1 / 16 - 1 / 43) * S((tt - 9.0) / 2.5)    // acelera al desplome
                 + (1 / 12.3 - 1 / 16) * S((tt - 13.4) / 2.0);           // asienta tras el choque
      tau += rate * dt;
    }
    _tauCache = arr;
  }
  const x = Math.max(0, t / dt);
  const i0 = Math.min(_tauCache.length - 1, Math.floor(x));
  const i1 = Math.min(_tauCache.length - 1, i0 + 1);
  const f = x - i0;
  return _tauCache[i0] * (1 - f) + _tauCache[i1] * f;
}

function molCamera(t: number, f: Frame): Shot {
  if (f.dna) return dnaCamera(t, f);
  const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
  const P = (s: number, o1: number, o2: number): Vec3 => [
    f.c[0] + f.a[0] * s + f.p1[0] * o1 + f.p2[0] * o2,
    f.c[1] + f.a[1] * s + f.p1[1] * o1 + f.p2[1] * o2,
    f.c[2] + f.a[2] * s + f.p1[2] * o1 + f.p2[2] * o2];

  // ── CAROTENO FLAGSHIP: la cámara VIAJA a lo largo del río π (más espacio para
  // viajar). roll pone la cadena VERTICAL → llena el 9:16 (truco O₂). Timeline 45s
  // sincronizado al nacimiento del color: crecer(0-13) → IGNICIÓN(13-19) → héroe
  // volando por el río(19-33) → revelar cadena completa + loop(33-45). ──
  if (f.mk === 'caroteno') {
    const L = Math.max(f.L, 0.8), Rp = Math.max(f.Rp, 0.6);
    const stand = Math.max(Rp * 2.6, L * 0.42);      // standoff perpendicular (río llena el cuadro)
    const rollV = Math.PI / 2;                        // cadena VERTICAL en 9:16
    if (t < 13.0) {                                   // CRECE — volamos junto al frente que se extiende
      const k = ease(t / 13.0);
      const s = lerp(-L * 0.75, L * 0.55, k);         // seguimos el frente de crecimiento
      const off = lerp(stand * 1.35, stand, k), ph = 0.5 + k * 0.7;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: lerp(42, 36, k),
        target: P(s * 0.6, 0, 0), roll: rollV + 0.04 * Math.sin(t * 0.5) };
    } else if (t < 19.0) {                            // IGNICIÓN — el color NACE: cámara se acerca y contempla
      const k = ease((t - 13.0) / 6.0);
      const off = lerp(stand, stand * 0.82, k), ph = 1.2 + k * 0.5;
      return { pos: P(lerp(L * 0.55, 0, k), Math.cos(ph) * off, Math.sin(ph) * off), fov: lerp(36, 33, k),
        target: f.c, roll: rollV + 0.03 * Math.sin(t * 0.4) };
    } else if (t < 33.0) {                            // HÉROE — VUELA por el río de punta a punta (el viaje)
      const k = ease((t - 19.0) / 14.0);
      const s = lerp(-L * 0.9, L * 0.9, k);           // dolly a lo largo del cromóforo encendido
      const off = stand * (0.9 + 0.12 * Math.sin(k * Math.PI * 2.0)), ph = 0.8 + k * 2.4;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: 34,
        target: P(s + L * 0.12, 0, 0), roll: rollV + 0.10 * Math.sin(k * Math.PI * 2.0) };
    } else {                                          // REVELA TODO + LOOP — se abre a la cadena completa
      const k = ease((t - 33.0) / 12.0);
      const off = lerp(stand * 0.9, Math.max(L * 1.7, stand * 2.0), k), ph = 3.2 + k * 1.1;
      const s = lerp(L * 0.9, 0, Math.min(1, k * 1.4));
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: lerp(34, 40, k),
        target: f.c, roll: rollV + (1 - k) * 0.10 * Math.sin(k * Math.PI) };
    }
  }

  if (f.chain) {
    // DOLLY AL COSTADO, LENTO: la cámara viaja a lo largo de la cadena a un standoff
    // perpendicular GRANDE (cadena COMPLETA en cuadro) y orbita SUAVE — la cadena
    // pasa de lado como cuerda luminosa, con tiempo de respirar. Sin barril.
    const L = Math.max(f.L, 0.6), Rp = Math.max(f.Rp, 0.6);
    const stand = Math.max(Rp * 3.0, L * 0.7);
    if (t < 4.5) {                                  // ABRE — entra LENTO desde un extremo
      const k = ease(t / 4.5);
      const s = lerp(-L * 1.3, -L * 0.9, k), off = lerp(stand * 1.5, stand, k), ph = 0.4 + k * 0.5;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: lerp(40, 36, k),
        target: P(s * 0.5, 0, 0), roll: 0.06 * Math.sin(t * 0.6) };
    } else if (t < 12.0) {                           // VIAJA — dolly LENTO + órbita suave (pasa de lado)
      const k = ease((t - 4.5) / 7.5);
      const s = lerp(-L * 0.9, L * 0.9, k);
      const off = stand * (1.0 + 0.10 * Math.sin(k * Math.PI * 2.0)), ph = 0.7 + k * 2.6;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: 36,
        target: P(s + L * 0.15, 0, 0), roll: 0.12 * Math.sin(k * Math.PI * 2.0) };
    } else if (t < 18.0) {                           // REVELA — vista completa lateral (héroe), con calma
      const k = ease((t - 12.0) / 6.0);
      const s = lerp(L * 0.9, 0, k), off = lerp(stand, Math.max(L * 2.0, stand * 2.0), k), ph = 0.6 + k * 1.0;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: lerp(36, 32, k), target: f.c, roll: lerp(0.1, 0.0, k) };
    } else {                                         // ASIENTA — órbita lenta 3/4
      const k = ease((t - 18.0) / 4.0), off = Math.max(L * 2.0, stand * 2.0), ph = 1.6 + k * 0.5;
      return { pos: P(lerp(0, -L * 0.15, k), Math.cos(ph) * off, Math.sin(ph) * off), fov: 32, target: f.c, roll: 0 };
    }
  }

  // FORMACIÓN O₂ — cámara DEDICADA: los dos átomos GEMELOS apilados VERTICAL (roll=π/2
  // pone el eje de enlace en pantalla-vertical → llena el 9:16, cero void) cayendo uno
  // hacia el otro por Morse. Al enlazar (~3.5s) la cámara ROTA suave hacia la órbita
  // héroe — sin corte: al final (t=4.5) empata exactamente la rama CONTEMPLA de abajo.
  if (f.o2) {
    // PELÍCULA de 30s — cámara con PESO, lenta, contemplativa (cine, no reel arcade):
    //   0–9.5s   APROXIMACIÓN+ENLACE: dos átomos GEMELOS verticales, CERCA, cayendo
    //            despacio (roll=π/2 → eje vertical, llena 9:16); la cámara casi no se
    //            mueve (el movimiento lo hacen los átomos). Choque ~7.8s.
    //   9.5–14s  ASIENTA+REVELA: rota vertical→órbita y jala a standoff héroe (sin corte).
    //   14–30s   HÉROE: órbita LENTÍSIMA con peso, respira distancia y elevación.
    const ex0 = f.ex;
    const bx = Math.sin(t * 0.22) * 0.012;          // respiro lento (handheld con peso)
    const NX = f.nucX ?? 1.14;                       // x del núcleo objetivo (bohr) = Re/2
    const NUC: Vec3 = [-NX, 0, 0];                   // clavamos al átomo de la IZQUIERDA
    if (t < 9.5) {
      // VIAJE ENTRE LAS NUBES (in medias res): la cámara NACE rozando el velo del
      // átomo de abajo (looming — cerebro rápido), cruza el canal entre los dos con
      // parallax fuerte y se ABRE al two-shot. El átomo se mueve (Morse) y la cámara
      // lo sigue: viajas ENTRE los electrones, no los ves de lejos.
      const k = ease(t / 9.5);
      const xa = -NX * bondR(t, f.mk);                // el átomo de abajo, EN VIVO
      const m = ease(Math.max(0, (t - 4.0) / 5.5));  // la órbita migra: átomo → punto medio
      const cen: Vec3 = [lerp(xa, 0, m), 0, 0];
      const r = ex0 * lerp(0.50, 0.98, k) * (1 - 0.07 * Math.sin(k * Math.PI * 2));   // pegado al velo → two-shot; dolly con PULSO (violencia)
      const azim = Math.PI / 2 - 2.5 + k * 2.5 + bx; // barrido DOBLE = parallax violento entre los dos átomos
      const elev = lerp(-0.65, 0.02, k) + 0.10 * Math.sin(k * Math.PI * 1.7) * (1 - k);
      return { pos: orbitAround(cen, r, elev, azim), fov: lerp(50, 35, k), target: cen, roll: Math.PI / 2 };
    } else if (t < 14.0) {
      // EL DESPLOME visto de CERCA: la cámara se QUEDA pegada (1.26) mientras los
      // velos se estrellan y el enlace ENCIENDE llenando el cuadro; solo tras el
      // choque (12.6+) se abre al standoff del héroe. La FORMACIÓN es el show.
      const k = ease((t - 9.5) / 4.5);
      const kOut = ease(Math.max(0, (t - 12.6) / 1.4));
      const dist = ex0 * lerp(0.98, 1.32, kOut);
      const azim = lerp(Math.PI / 2, 0.7, k);
      const elev = lerp(0.02, 0.18, k);
      // roll SE QUEDA en π/2: el enlace VERTICAL llena el 9:16
      return { pos: sph(dist, elev, azim + bx), fov: lerp(35, 33, k), target: [0, 0, 0], roll: Math.PI / 2 };
    }
    // ── EL VIAJE DE ESCALA (Powers of Ten del enlace) — la molécula NO se entiende
    // desde afuera: los núcleos son 25000× más chicos que la nube. La cámara VIAJA:
    // contempla la molécula → SE CLAVA en un átomo (distancia EXPONENCIAL = escala
    // sentida) → órbita ÍNTIMA del núcleo (protones/neutrones GIGANTES, vibración de
    // punto cero visible) → SALE de regreso a la molécula entera. Todas las fases
    // empalman C0 (pos/target/fov continuos, cero cortes). Roll base continuo + swells
    // locales sin(kπ) que valen 0 en las costuras.
    // Fases SINCRONIZADAS a la narración v2 (beats desde segs.json REAL):
    //   "Ahora ven conmigo"=27.0 → clavado · "está el corazón"=39.3 → núcleo ·
    //   "Tú eres casi vacío"=52.2 → salida · "el candado sigue ahí"=56.3 → héroe final.
    const rollBase = 0.03 * Math.sin(t * 0.13);
    if (t < 26.6) {                                  // HÉROE — órbita VIVA, sujeto DOMINANTE (fill≥0.35)
      const k = ease((t - 14.0) / 12.6);
      const dist = ex0 * (lerp(1.32, 1.48, k) - 0.14 * Math.sin(k * Math.PI));   // PEGADO: el enlace LLENA la pantalla (mandato O₂)
      const azim = 0.7 + k * 1.6;                    // barrido amplio — nunca estática
      const elev = 0.18 + Math.sin(k * Math.PI * 1.3) * 0.16;
      return { pos: sph(dist, elev, azim + bx), fov: 33, target: [0, 0, 0], roll: Math.PI / 2 + rollBase };
    }
    // ── F₂: EL ACTO DE LA REPULSIÓN (el núcleo es de H₂ — aquí NO se repite). La
    // cámara se mete AL cinturón de pares libres, CRUZA el muro de carga tres veces
    // (locura con peso), recorre el callejón del enlace aplastado entre los dos
    // muros y sale. Costuras C0 exactas: k=0 de cada fase = k=1 de la anterior;
    // la salida aterriza en azim 9.1+2π ≡ 9.1 = el arranque del héroe final. ──
    if (f.mk === 'f2' && t < 56.0) {
      const ELEV0 = 0.18 + Math.sin(Math.PI * 1.3) * 0.16;   // elev exacta del fin del héroe
      if (t < 32.5) {                                // CLAVADO AL CINTURÓN (exponencial, sin llegar al núcleo)
        const k = ease((t - 26.6) / 5.9);
        const r = (ex0 * 1.48) * Math.pow(0.85 / (ex0 * 1.48), k);
        const m = ease(Math.min(1, k / 0.4));
        const cen: Vec3 = [lerp(0, NUC[0], m), 0, 0];
        return { pos: orbitAround(cen, r, lerp(ELEV0, -0.25, k), 2.3 + k * 2.6 + bx),
          fov: lerp(33, 44, k), target: cen, roll: Math.PI / 2 + rollBase + Math.sin(k * Math.PI) * 0.15 };
      } else if (t < 45.5) {                         // LOCURA — cruza el muro de carga 3 veces (A→B→A→B)
        const u = (t - 32.5) / 13.0;
        const cen: Vec3 = [-NX * Math.cos(Math.PI * 3 * u), 0, 0];
        const r = 0.85 + 0.20 * Math.sin(u * Math.PI * 2);
        const elev = -0.25 + Math.sin(u * Math.PI * 2) * 0.38;
        return { pos: orbitAround(cen, r, elev, 4.9 + u * 6.5 + bx),
          fov: 44 + Math.sin(u * Math.PI * 3) * 4, target: cen,
          roll: Math.PI / 2 + rollBase + Math.sin(u * Math.PI * 2) * 0.22 };
      } else if (t < 53.0) {                         // EL CALLEJÓN — B→A pegado al eje, muros a los lados
        const k = ease((t - 45.5) / 7.5);            // hasta 53.0: "aplastado entre dos muros" (l12 real 50.8-54.5) cae DENTRO
        const cen: Vec3 = [lerp(NX, -NX * 1.1, k), 0, 0];
        const r = lerp(0.85, 0.70, k) - 0.15 * Math.sin(k * Math.PI);
        return { pos: orbitAround(cen, r, lerp(-0.25, 0.10, k), 11.4 + k * 1.6 + bx),
          fov: 44, target: cen, roll: Math.PI / 2 + rollBase + Math.sin(k * Math.PI) * 0.10 };
      } else {                                       // SALIDA WARP → empata EXACTO el héroe final (t=56)
        const w = ease((t - 53.0) / 3.0);
        const r = 0.70 * Math.pow((ex0 * 1.25) / 0.70, w);
        const m = ease(Math.min(1, w / 0.6));
        const cen: Vec3 = [lerp(-NX * 1.1, 0, m), 0, 0];
        return { pos: orbitAround(cen, r, lerp(0.10, 0.20, w), lerp(13.0, 9.1 + Math.PI * 2, w) + bx),
          fov: lerp(44, 33, w), target: cen, roll: Math.PI / 2 + rollBase * (1 - w) };
      }
    }
    if (t < 39.0) {                                  // CLAVADO — caemos AL núcleo (exponencial, espiral)
      const k = ease((t - 26.6) / 12.4);
      const r = (ex0 * 1.48) * Math.pow(0.22 / (ex0 * 1.48), k);   // molécula → escala nuclear
      const azim = 2.3 + k * 2.2;                    // espiral al caer — viaje, no elevador
      const elev = lerp(0.18, 0.06, k);
      const m = ease(Math.min(1, k / 0.35));         // centro y mirada MIGRAN molécula→núcleo temprano
      const cen: Vec3 = [lerp(0, NUC[0], m), 0, 0];
      return { pos: orbitAround(cen, r, elev, azim + bx), fov: lerp(33, 42, k),
        target: cen, roll: Math.PI / 2 + rollBase + Math.sin(k * Math.PI) * 0.12 };
    } else if (t < 51.7) {                           // EL NÚCLEO — órbita íntima VIVA: nucleones GIGANTES, zpv visible
      const k = ease((t - 39.0) / 12.7);
      const r = lerp(0.22, 0.175, k) + 0.014 * Math.sin(k * Math.PI * 3);   // respira acercándose
      const azim = 4.5 + k * 3.4;                    // barrido amplio: el núcleo ROTA de verdad en cuadro
      const elev = 0.06 + Math.sin(k * Math.PI * 1.5) * 0.22;
      return { pos: orbitAround(NUC, r, elev, azim + bx), fov: 42, target: NUC,
        roll: Math.PI / 2 + rollBase + Math.sin(k * Math.PI) * 0.06 };
    } else if (t < 56.0) {                           // SALIDA — Powers of Ten de regreso (el átomo se hace chico)
      const k = ease((t - 51.7) / 4.3);
      // termina en 1.7·ex (no 2.4): la molécula ENLAZADA mide la mitad que los dos
      // átomos separados — más cerca para que siga DOMINANDO el cuadro al regresar
      const r = 0.175 * Math.pow((ex0 * 1.25) / 0.175, k);
      const azim = 7.9 + k * 1.2;
      const elev = lerp(-0.16, 0.20, k);
      const m = ease(Math.min(1, k / 0.6));          // la mirada regresa a la molécula completa
      const cen: Vec3 = [lerp(NUC[0], 0, m), 0, 0];
      return { pos: orbitAround(cen, r, elev, azim + bx), fov: lerp(42, 33, k),
        target: cen, roll: Math.PI / 2 + rollBase - Math.sin(k * Math.PI) * 0.10 };
    } else {                                         // HÉROE FINAL → LOOP: órbita viva y REGRESO al encuadre de apertura
      const k = (t - 56.0) / 14.0;
      // ret: los últimos ~7s VUELVEN a la composición de apertura (bond vertical
      // roll=π/2, elev −0.30, fov 42) → con el fade a negro, empalma con el frame 1.
      // dist 1.15·ex (no 1.65): la molécula enlazada es más chica que el par separado
      // — así el cierre LLENA el cuadro igual que la apertura (contraste sostenido).
      const ret = ease(Math.max(0, (t - 63.5) / 6.5));
      // FLYBY final: pasa CERCA (0.95·ex — dentro del polvo, la molécula LLENA el
      // cuadro) con barrido rápido; luego el regreso al encuadre de apertura (loop)
      const dive2 = ease(Math.min(1, k * 2.4));
      const dist = ex0 * lerp(lerp(1.25, 0.80, dive2) + 0.06 * Math.sin(k * Math.PI * 2), 0.95, ret);
      const azim = 9.1 + k * 2.6;
      const elev = lerp(0.20 + Math.sin(k * Math.PI * 1.2) * 0.12, -0.30, ret);
      const roll = Math.PI / 2 + (1 - ret) * 0.03 * Math.sin((t - 56.0) * 0.11);   // vertical SIEMPRE (9:16); el wobble muere al cierre
      return { pos: sph(dist, elev, azim + bx), fov: lerp(33, 42, ret), target: [0, 0, 0], roll };
    }
  }

  // ORBIT LENTO — compactas. Entra desde lejos (molécula COMPLETA), contempla con
  // calma, órbita lenta con peso, asienta. Respira. Cámara afuera (~2.3× extent).
  const ex = f.ex;
  const bx = Math.sin(t * 0.4) * 0.014 + Math.sin(t * 0.73) * 0.006;   // respiro suave (handheld lento)
  let dist: number, azim: number, elev: number, fov: number, roll: number;
  if (t < 0.28) {                                   // ESTALLIDO@frame0 — el campo revienta + looming
    const k = ease(t / 0.28);
    dist = ex * lerp(0.85, 0.6, k); azim = 0.15; elev = 0.05; fov = lerp(46, 40, k); roll = 0;
  } else if (t < 4.5) {                             // PULL-BACK revelador (cerca → órbita)
    const k = ease((t - 0.28) / 4.22);
    dist = ex * lerp(0.6, 2.25, k); azim = 0.15 + k * 0.55; elev = lerp(0.05, 0.16, k); fov = lerp(40, 33, k); roll = 0.04 * Math.sin(t * 0.5);
  } else if (t < 11.0) {                            // CONTEMPLA — barrido amplio y SUAVE
    const k = ease((t - 4.5) / 6.5);
    dist = ex * lerp(2.25, 2.35, k); azim = 0.7 + k * 1.7; elev = 0.16 + Math.sin(k * Math.PI) * 0.28; fov = 33; roll = 0.05 * Math.sin((t - 4.5) * 0.35);
  } else if (t < 17.5) {                            // ÓRBITA LENTA — con peso
    const k = ease((t - 11.0) / 6.5);
    dist = ex * lerp(2.35, 2.25, k); azim = 2.4 + k * 1.5; elev = 0.44 - Math.sin((t - 11.0) * 0.3) * 0.14; fov = 33; roll = 0.04 * Math.sin((t - 11.0) * 0.28);
  } else {                                          // ASIENTA — héroe, casi quieto
    const k = ease((t - 17.5) / 4.5);
    dist = ex * lerp(2.25, 2.30, k); azim = 3.9 + k * 0.25; elev = lerp(0.40, 0.30, k); fov = 33; roll = 0;
  }
  return { pos: sph(dist, elev, azim + bx), fov, target: [0, 0, 0], roll };
}

function MolCameraRig({ frame, time, vertical }: { frame: Frame; time: number; vertical: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    const { pos, fov, target, roll } = molCamera(time, frame);
    camera.position.set(pos[0], pos[1], pos[2]);
    // roll REAL alrededor del eje de vista (banking) — da violencia/energía
    const fwd = new THREE.Vector3(target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]).normalize();
    const up0 = new THREE.Vector3(0, 1, 0);
    if (Math.abs(fwd.dot(up0)) > 0.94) up0.set(0, 0, 1);
    const right = new THREE.Vector3().crossVectors(fwd, up0).normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const r = roll || 0;
    camera.up.copy(trueUp.multiplyScalar(Math.cos(r)).add(right.multiplyScalar(Math.sin(r))));
    camera.lookAt(target[0], target[1], target[2]);
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.fov !== undefined) {
      cam.fov = vertical ? Math.min(95, fov * 1.42) : fov;
      const d = Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
      cam.near = Math.max(0.01, d * 0.03);
      cam.far = Math.max(100, frame.ex * 24);
      cam.updateProjectionMatrix();
    }
  }, [time, frame, camera, vertical]);
  return null;
}

// ── PostFX de molécula — grado de cine (ACES como en V8 — el look aprobado). El
// bokeh lo hace el shader de la nube (uBokeh), no aquí. ──
function MolPostFX({ live = false }: { live?: boolean }) {
  // MSAA=0 en live: el combo multisampling + render target HDR-float revienta el
  // postFX a blanco en muchas GPUs (Intel, ANGLE, software) aunque la GPU de dev
  // lo renderee bien. Headless 4K (live=false) conserva MSAA=4. HDR buffer explícito.
  return (
    <EffectComposer multisampling={live ? 0 : 4} frameBufferType={THREE.HalfFloatType}>
      {/* receta O₂ ORIGINAL (la de los 160 likes): bloom suave envolviendo cada
          punto → densidad LUMINOSA continua, el look que hipnotiza */}
      <Bloom intensity={1.15} luminanceThreshold={0.20} luminanceSmoothing={0.6} radius={0.9} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <BrightnessContrast brightness={0.02} contrast={0.18} />
      <HueSaturation saturation={0.5} />
      <ChromaticAberration offset={new THREE.Vector2(0.0010, 0.0010)} radialModulation modulationOffset={0.35} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.05} />
      <Vignette eskil={false} offset={0.20} darkness={0.68} />
    </EffectComposer>
  );
}

// ── Modos vibracionales reales del agua (Hessian → modos normales) ──
// Los calculamos en la geometría canónica (mismo frame que la nube precomputada)
// para que los desplazamientos queden alineados con los núcleos.
interface VibMode { label: string; wavenumber: number; disp: Vec3[]; }

function computeWaterModes(): VibMode[] {
  const R = 0.9584; // Å
  const half = (104.5 / 2) * Math.PI / 180;
  const posAng: number[][] = [
    [0, 0, 0],
    [R * Math.sin(half), 0, R * Math.cos(half)],
    [-R * Math.sin(half), 0, R * Math.cos(half)],
  ];
  const masses = [15.9994, 1.00784, 1.00784];
  const va = vibrationalAnalysis(posAng, FF_H2O.ff, masses);
  const labels = ['Flexión', 'Estiramiento simétrico', 'Estiramiento asimétrico'];
  // El modeVector (forma del movimiento) viene del cálculo; el número que
  // CITAMOS es el experimental medido (NIST), no el del campo de fuerzas SVFF.
  const expWN = FF_H2O.experimentalWavenumbers;
  return va.vibrational.slice(0, 3).map((m, i) => {
    // desplazamiento cartesiano = mass-weighted / √masa, normalizado a |max|=1
    const cart: Vec3[] = [];
    let maxMag = 1e-6;
    for (let a = 0; a < 3; a++) {
      const v: Vec3 = [
        m.modeVector[3 * a] / Math.sqrt(masses[a]),
        m.modeVector[3 * a + 1] / Math.sqrt(masses[a]),
        m.modeVector[3 * a + 2] / Math.sqrt(masses[a]),
      ];
      cart.push(v);
      maxMag = Math.max(maxMag, Math.hypot(...v));
    }
    const disp = cart.map(v => [v[0] / maxMag, v[1] / maxMag, v[2] / maxMag] as Vec3);
    return { label: labels[i] ?? `Modo ${i + 1}`, wavenumber: expWN[i] ?? Math.round(Math.abs(m.wavenumber)), disp };
  });
}

// Timeline de modos: qué modo vibra en cada ventana (amplitud 0..1 por modo).
// 0 bend · 1 sym · 2 asym. La ventana final hace vibrar los 3 juntos.
const VIS_AMP = 0.42;      // amplitud visual del desplazamiento (bohr)
const VIS_FREQ = 1.7;      // Hz visual (para VER la oscilación; el audio va a su tono real)

function modeAmps(t: number): [number, number, number] {
  const bump = (a: number, b: number) =>
    smoothstep((t - a) / 0.5) * (1 - smoothstep((t - (b - 0.5)) / 0.5));
  const all = t >= 17.5 ? smoothstep((t - 17.5) / 0.8) : 0;
  return [
    Math.max(bump(5.0, 9.0), all * 0.7),
    Math.max(bump(9.0, 13.0), all * 0.7),
    Math.max(bump(13.0, 17.0), all * 0.7),
  ];
}

interface Nuc { pos: Vec3; protons: number; neutrons: number; }
interface MolData { bundle: AtomBundle; nuclei: Nuc[]; extent: number; bonds: [number, number][]; }

const BASE_META: Record<string, { name: string; formula: string; fact: string }> = {
  h2o:  { name: 'Agua', formula: 'H₂O', fact: 'Dos enlaces y dos pares libres: por eso el ángulo es 104.5°.' },
  ch4:  { name: 'Metano', formula: 'CH₄', fact: 'Cuatro enlaces perfectos a 109.5°: un tetraedro.' },
  nh3:  { name: 'Amoniaco', formula: 'NH₃', fact: 'Un par libre la vuelve una pirámide.' },
  co2:  { name: 'Dióxido de carbono', formula: 'CO₂', fact: 'Lineal y simétrica: 180° exactos.' },
  c2h4: { name: 'Etileno', formula: 'C₂H₄', fact: 'Un doble enlace: σ + π. Madura las frutas.' },
  c2h2: { name: 'Acetileno', formula: 'C₂H₂', fact: 'Un triple enlace: σ + 2π. Arde a 3000 °C.' },
  hcl:  { name: 'Cloruro de hidrógeno', formula: 'HCl', fact: 'Enlace polar: el ácido del estómago.' },
  nacl: { name: 'Sal', formula: 'NaCl', fact: 'Enlace iónico: un átomo le robó el electrón al otro.' },
  c6h6: { name: 'Benceno', formula: 'C₆H₆', fact: 'Seis electrones bailando en círculo: aromático.' },
  h2:   { name: 'Hidrógeno', formula: 'H₂', fact: 'El enlace más simple del universo.' },
  f2:   { name: 'Flúor', formula: 'F₂', fact: 'El elemento más violento — con el enlace más débil.' },
  c2:   { name: 'Carbono', formula: 'C₂', fact: 'Doble enlace de puro π: el carbono rompe las reglas.' },
  hehp: { name: 'Hidruro de helio', formula: 'HeH⁺', fact: 'La primera molécula que existió.' },
  li2:  { name: 'Dilitio', formula: 'Li₂', fact: 'El primer enlace entre dos metales.' },
  n2:   { name: 'Nitrógeno', formula: 'N₂', fact: 'Triple enlace, el candado más fuerte: 78% del aire.' },
  o2:   { name: 'Oxígeno', formula: 'O₂', fact: 'Doble enlace magnético: lo que te mantiene vivo.' },
  hf:   { name: 'Fluoruro de hidrógeno', formula: 'HF', fact: 'El puente de hidrógeno más fuerte.' },
  co:   { name: 'Monóxido de carbono', formula: 'CO', fact: 'El faro con el que vemos nacer estrellas.' },
  // ── CADENAS — la cámara las ATRAVIESA ──
  butane:       { name: 'Butano', formula: 'C₄H₁₀', fact: 'Cuatro carbonos en zig-zag: el gas del encendedor.' },
  pentane:      { name: 'Pentano', formula: 'C₅H₁₂', fact: 'Cinco carbonos: ya es líquido, base de la gasolina.' },
  hexane:       { name: 'Hexano', formula: 'C₆H₁₄', fact: 'El esqueleto del carbono: enlaces σ a 109.5°.' },
  heptane:      { name: 'Heptano', formula: 'C₇H₁₆', fact: 'Siete carbonos: el cero del octanaje de la gasolina.' },
  octane:       { name: 'Octano', formula: 'C₈H₁₈', fact: 'Ocho carbones en cadena: la energía de la gasolina.' },
  nonane:       { name: 'Nonano', formula: 'C₉H₂₀', fact: 'Nueve eslabones: ya entra en el diésel.' },
  decane:       { name: 'Decano', formula: 'C₁₀H₂₂', fact: 'Diez eslabones de carbono, puro enlace σ.' },
  dodecane:     { name: 'Dodecano', formula: 'C₁₂H₂₆', fact: 'Doce carbonos: queroseno, lo que vuela los aviones.' },
  pentadecane:  { name: 'Pentadecano', formula: 'C₁₅H₃₂', fact: 'Quince carbonos: en feromonas de insectos.' },
  hexadecane:   { name: 'Hexadecano', formula: 'C₁₆H₃₄', fact: 'Dieciséis carbonos: el patrón del diésel (cetano).' },
  heptadecane:  { name: 'Heptadecano', formula: 'C₁₇H₃₆', fact: 'Diecisiete carbonos: cera líquida.' },
  eicosane:     { name: 'Eicosano', formula: 'C₂₀H₄₂', fact: 'Veinte carbonos: ya es cera sólida, vaselina.' },
  hexatriene:   { name: 'Hexatrieno', formula: 'C₆H₈', fact: 'Tres dobles enlaces conjugados: los electrones π se sueltan.' },
  octatetraene: { name: 'Octatetraeno', formula: 'C₈H₁₀', fact: 'Cuatro dobles en fila: el río π se alarga.' },
  decapentaene: { name: 'Decapentaeno', formula: 'C₁₀H₁₂', fact: 'Cinco dobles en fila: un río de electrones π.' },
  dodecahexaene:{ name: 'Dodecahexaeno', formula: 'C₁₂H₁₄', fact: 'Seis dobles conjugados: ya empieza a tener color.' },
  tetradecaheptaene: { name: 'Tetradecaheptaeno', formula: 'C₁₄H₁₆', fact: 'Siete dobles: el río π más largo, casi rojo.' },
  hexadecaoctaene:   { name: 'Hexadecaoctaeno', formula: 'C₁₆H₁₈', fact: 'Ocho dobles conjugados: absorbe color visible.' },
  caroteno:     { name: 'Caroteno (cromóforo)', formula: 'cadena π', fact: 'La cadena conjugada que pinta la zanahoria — y la que te deja VER.' },
  // ── ADN — doble hélice B-form real ──
  brca1:    { name: 'ADN · BRCA1', formula: 'doble hélice', fact: 'Un trozo de tu gen BRCA1: cuando falla, aumenta el riesgo de cáncer.' },
  telomero: { name: 'ADN · telómero', formula: 'TTAGGG', fact: 'El extremo de tus cromosomas: se acorta cada vez que una célula se divide.' },
  tata:     { name: 'ADN · caja TATA', formula: 'promotor', fact: 'La señal donde la célula empieza a leer un gen.' },
};
const META: Record<string, { name: string; formula: string; fact: string }> = { ...BASE_META, ...CATALOG_META };

// Cadenas: se cargan de chain-<key>.bin y disparan la cámara TRAVERSAL.
const CHAIN_KEYS = new Set(['butane', 'pentane', 'hexane', 'heptane', 'octane', 'nonane', 'decane', 'dodecane', 'pentadecane', 'hexadecane', 'heptadecane', 'eicosane', 'hexatriene', 'octatetraene', 'decapentaene', 'dodecahexaene', 'tetradecaheptaene', 'hexadecaoctaene', 'caroteno']);
// Conjugadas (con sistema π): llevan campo de CARAS π (MEP). Los alcanos NO (apolares, planos eléctricamente → inertes).
const CONJUGATED_KEYS = new Set(['hexatriene', 'octatetraene', 'decapentaene', 'dodecahexaene', 'tetradecaheptaene', 'hexadecaoctaene', 'caroteno']);
// ADN: doble hélice B-form real (dna-<key>.bin). Alargada → cámara traversal vuela por el eje.
const DNA_KEYS = new Set(['brca1', 'telomero', 'tata']);

// ── Metadata pública para la galería del quimilab (montaje LIVE) ──
// nombre + fórmula de cualquier clave montable. Devuelve null si no la conocemos.
export function molMeta(key: string): { name: string; formula: string; fact: string } | null {
  return META[key] ?? null;
}

// Galería curada: SOLO claves con .bin precomputado (las que renderizan en vivo).
// El orden y agrupación reflejan el viaje conceptual: molécula → cadena → catálogo → vida.
export const MOLECULE_GALLERY: { label: string; hint: string; keys: string[] }[] = [
  { label: 'Moléculas', hint: 'geometría VSEPR · enlaces σ/π · pares libres',
    keys: ['h2o', 'co2', 'nh3', 'ch4', 'o2', 'n2', 'co', 'hcl', 'hf', 'nacl', 'hehp'] },
  { label: 'Cadenas · alcanos', hint: 'la cámara ATRAVIESA el esqueleto de carbono',
    keys: ['butane', 'pentane', 'hexane', 'heptane', 'octane', 'nonane', 'decane', 'dodecane', 'pentadecane', 'hexadecane', 'heptadecane', 'eicosane'] },
  { label: 'Cadenas · π conjugadas', hint: 'el río de electrones π — y el color',
    keys: ['hexatriene', 'octatetraene', 'decapentaene', 'dodecahexaene', 'tetradecaheptaene', 'hexadecaoctaene', 'caroteno'] },
  { label: 'Catálogo', hint: 'lo cotidiano: alcoholes, ácidos, gasolina, aromáticos',
    keys: ['metanol', 'etanol', 'isopropanol', 'acetona', 'acido-acetico', 'acido-formico', 'formaldehido', 'dimetileter', 'propano', 'isobutano', 'isooctano', 'ciclohexano', 'etileno', 'acetileno', 'benceno', 'butadieno', 'hcn', 'ch3nh2', 'h2o2', 'o3', 'so2'] },
  { label: 'ADN · la vida', hint: 'doble hélice B-form real — viaje de escala',
    keys: ['brca1', 'telomero', 'tata'] },
];

function parseBin(buf: ArrayBuffer): MolData {
  const dv = new DataView(buf);
  let off = 0;
  const N = dv.getInt32(off, true); off += 4;
  const K = dv.getInt32(off, true); off += 4;
  const extent = dv.getFloat32(off, true); off += 4;
  const nuclei: Nuc[] = [];
  const nucPos: Vec3[] = [];
  for (let i = 0; i < K; i++) {
    const x = dv.getFloat32(off, true); off += 4;
    const y = dv.getFloat32(off, true); off += 4;
    const z = dv.getFloat32(off, true); off += 4;
    const Z = dv.getFloat32(off, true); off += 4;
    const el = elementByZ(Math.round(Z));
    const info = el ? nucleusInfo(el) : { protons: Math.round(Z), neutrons: Math.round(Z) };
    nuclei.push({ pos: [x, y, z], protons: info.protons, neutrons: info.neutrons });
    nucPos.push([x, y, z]);
  }
  const positions = new Float32Array(buf, off, N * 3); off += N * 3 * 4;
  const colors = new Float32Array(buf, off, N * 3); off += N * 3 * 4;
  const sizes = new Float32Array(buf, off, N); off += N * 4;
  const shellIdx = new Float32Array(buf, off, N); off += N * 4;

  // enlaces POR DISTANCIA (no central→resto): conecta cada núcleo con sus vecinos
  // cercanos. Funciona para cadenas, anillos (benceno) y compactas por igual.
  // Umbral relativo a la distancia mínima (agnóstico a unidades bohr/Å).
  const bonds: [number, number][] = [];
  const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let dmin = Infinity;
  for (let i = 0; i < nucPos.length; i++) for (let j = i + 1; j < nucPos.length; j++) dmin = Math.min(dmin, dist(nucPos[i], nucPos[j]));
  const thr = (dmin === Infinity ? 1 : dmin) * 1.5;
  for (let i = 0; i < nucPos.length; i++) for (let j = i + 1; j < nucPos.length; j++) if (dist(nucPos[i], nucPos[j]) < thr) bonds.push([i, j]);

  const bundle: AtomBundle = {
    positions, colors, sizes, shellIdx,
    shells: [
      { label: 'core', n: 1, l: 0, color: new THREE.Color('#4FC3F7') },
      { label: 'enlaces', n: 2, l: 1, color: new THREE.Color('#8fe0ff') },
      { label: 'pares', n: 2, l: 1, color: new THREE.Color('#ff5da2') },
    ],
  };
  return { bundle, nuclei, extent, bonds };
}

// ═══ ENLACE O₂ AB INITIO — Δρ(r;R) de PySCF (UHF/cc-pVTZ, TRIPLETE real) ═══
// Generado por scripts/precompute-o2-abinitio.py: PySCF resuelve la Schrödinger
// electrónica del O₂ a cada separación R y guarda la DENSIDAD DE DEFORMACIÓN
// Δρ = ρ(O₂) − ρ(promolécula) — el ENLACE DESNUDO. Los cores 1s se CANCELAN, así
// que NO revienta a blanco como la ρ total (ese era el confeti). Tres nubes de
// partículas LAGRANGIANAS advectadas por R (semillas fijas → la carga FLUYE al
// enlace, no parpadea): acumulación (oro σ + ámbar π) · vaciado (azul frío) ·
// densidad de espín (violeta = los 2 e⁻ π* desapareados = el imán del O₂).
const O2AI_POSQ = 5000;           // bohr = posQ / O2AI_POSQ
interface O2AbInitio {
  accPos: Int16Array; depPos: Int16Array; spinPos: Int16Array;   // K*N*3 (cuantizadas)
  accColor: Uint8Array;                                          // Nacc*3 (oro→ámbar)
  Rvals: Float32Array;                                           // K (descendente Rmax→Rmin)
  bondMass: Float32Array;                                        // K (carga acumulada en el enlace → brillo)
  Nacc: number; Ndep: number; Nspin: number; K: number; Rmin: number; Rmax: number;
}
function parseO2AbInitio(buf: ArrayBuffer): O2AbInitio {
  const dv = new DataView(buf);
  let off = 0;
  const Nacc = dv.getInt32(off, true); off += 4;
  const Ndep = dv.getInt32(off, true); off += 4;
  const Nspin = dv.getInt32(off, true); off += 4;
  const K = dv.getInt32(off, true); off += 4;
  const Rmin = dv.getFloat32(off, true); off += 4;
  const Rmax = dv.getFloat32(off, true); off += 4;
  const Rvals = new Float32Array(buf.slice(off, off + K * 4)); off += K * 4;
  off += K * 4 * 3;                                    // accMass,depMass,spinMass (no usados en el render)
  const bondMass = new Float32Array(buf.slice(off, off + K * 4)); off += K * 4;  // carga del enlace → brillo
  const accColor = new Uint8Array(buf.slice(off, off + Nacc * 3)); off += Nacc * 3;
  const accPos = new Int16Array(buf.slice(off, off + K * Nacc * 3 * 2)); off += K * Nacc * 3 * 2;
  const depPos = new Int16Array(buf.slice(off, off + K * Ndep * 3 * 2)); off += K * Ndep * 3 * 2;
  const spinPos = new Int16Array(buf.slice(off, off + K * Nspin * 3 * 2)); off += K * Nspin * 3 * 2;
  return { accPos, depPos, spinPos, accColor, Rvals, bondMass, Nacc, Ndep, Nspin, K, Rmin, Rmax };
}

const O2FLOW_VERT = `
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vNear;
  varying float vW;
  uniform float uSize;
  uniform float uRing;
  uniform float uCoreThin;
  void main() {
    vColor = aColor;
    // ANILLO π EMERGENTE: las partículas REALES cerca del corazón del toro
    // (radio ≈1.05 bohr medido de la densidad π) brillan más — la estructura
    // emerge del polvo, no se dibuja encima. uRing=0 en las demás nubes.
    float dRing = length(vec2(length(position.yz) - 1.05, position.x * 0.8));
    vW = 1.0 + uRing * exp(-dRing * dRing / 0.16);
    // raleo del CORE: donde la suma ya es blanca, capas extra solo ENSUCIAN al
    // compresor — se atenúan las partículas pegadas al centro (la luz queda)
    vW *= 1.0 - uCoreThin * exp(-dot(position, position) / 0.30);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // el polvo SE APARTA del lente: al viajar DENTRO de la nube, las partículas
    // pegadas a cámara se desvanecen (vNear→0) pero el polvo cercano SÍ envuelve
    // (rango corto 0.85 bohr = inmersión al volar entre nubes); la pared blanca
    // del clavado la mata el transit-dim por fase, no este fade.
    vNear = smoothstep(0.22, 0.85, -mv.z);
    gl_PointSize = min(uSize * (300.0 / -mv.z), 64.0);
    gl_Position = projectionMatrix * mv;
  }`;
const O2FLOW_FRAG = `
  varying vec3 vColor;
  varying float vNear;
  varying float vW;
  uniform float uBright;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vNear;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * a * uBright * vW, a);
  }`;

// ═══ CAROTENO — el cromóforo que te deja VER. Reusa la DATA de chain-caroteno.bin
// (geometría + cintas π reales) pero la renderiza con el MOTOR de O₂: sprites
// grandes+tenues (densidad luminosa, no puntos), bloom, depth-fade. El WOW es
// FÍSICO: el color NACE del largo (partícula en una caja, E~1/L²). Cadena corta =
// frío/violeta (absorbe UV, "invisible"); al alargarse el salto HOMO-LUMO cae al
// visible → el río π ESTALLA en naranja (β-caroteno absorbe azul → lo ves naranja).
// Firma del viral: río CÁLIDO (figura) sobre campo FRÍO. ──
const CARO_VERT = `
  attribute float aAxis;    // 0..1 posición a lo largo del eje de la cadena
  attribute float aShell;   // 1 = espina σ · 2 = río π (el cromóforo)
  uniform float uSize;
  uniform float uReveal;     // frente de crecimiento de la cadena (0→1)
  uniform float uTime;
  varying float vNear;
  varying float vShell;
  varying float vFlow;
  varying float vTip;
  void main() {
    vShell = aShell;
    // REVELADO: lo que está más allá del frente de crecimiento aún no existe
    float shown = smoothstep(uReveal + 0.02, uReveal - 0.06, aAxis);
    vTip = smoothstep(uReveal - 0.12, uReveal, aAxis) * shown;   // el frente brilla (se está formando)
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNear = smoothstep(0.22, 0.95, -mv.z) * shown;
    // el río FLUYE: una onda de brillo corre a lo largo del eje (los e⁻ π viajando)
    vFlow = 0.5 + 0.5 * sin(aAxis * 34.0 - uTime * 2.6);
    gl_PointSize = min(uSize * (300.0 / -mv.z), 60.0);
    gl_Position = projectionMatrix * mv;
  }`;
const CARO_FRAG = `
  precision highp float;
  uniform float uBright;
  uniform float uWarm;       // 0 frío (UV, invisible) → 1 naranja (visible, el color nace)
  varying float vNear;
  varying float vShell;
  varying float vFlow;
  varying float vTip;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vNear;
    if (a < 0.004) discard;
    vec3 col;
    if (vShell > 1.5) {
      // RÍO π (figura): nace FRÍO (violeta, absorbe UV = "invisible") → ESTALLA
      // naranja al alargarse (el salto HOMO-LUMO cae al visible). El color del largo.
      col = mix(vec3(0.34, 0.18, 0.86), vec3(1.0, 0.46, 0.08), uWarm);
    } else {
      // ESPINA σ: SIEMPRE fría (cian) — el fondo frío que hace POP al río cálido
      // (firma del viral: figura cálida sobre campo frío = dual-cluster).
      col = vec3(0.24, 0.62, 1.0);
    }
    // el río π MANDA; la espina σ va tenue (no compite, no lava a blanco).
    // SATURACIÓN = menos brillo: el naranja se ve cuando NO revienta (más-luz-no-es-color).
    float shellB = (vShell > 1.5) ? (0.42 + 0.55 * vFlow) : (0.16 + 0.14 * vFlow);
    col += vec3(1.0, 0.85, 0.6) * vTip * 0.5;      // el frente de crecimiento chispea (tenue)
    gl_FragColor = vec4(col * a * uBright * shellB, a);
  }`;

function CarotenoFlow({ bundle, axis, cen, L, reveal, warm, bright, time }:
  { bundle: AtomBundle; axis: Vec3; cen: Vec3; L: number; reveal: number; warm: number; bright: number; time: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const N = bundle.sizes.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(bundle.positions, 3));
    // aAxis = proyección normalizada sobre el eje de la cadena (0 punta izq → 1 der)
    const aAxis = new Float32Array(N);
    const halfL = Math.max(L, 0.5);
    for (let i = 0; i < N; i++) {
      const dx = bundle.positions[i * 3] - cen[0], dy = bundle.positions[i * 3 + 1] - cen[1], dz = bundle.positions[i * 3 + 2] - cen[2];
      const s = dx * axis[0] + dy * axis[1] + dz * axis[2];
      aAxis[i] = Math.max(0, Math.min(1, 0.5 + s / (2 * halfL)));
    }
    g.setAttribute('aAxis', new THREE.BufferAttribute(aAxis, 1));
    g.setAttribute('aShell', new THREE.BufferAttribute(bundle.shellIdx, 1));
    return g;
  }, [bundle, axis, cen, L]);
  const uniforms = useMemo(() => ({
    uSize: { value: 0.30 }, uBright: { value: bright }, uReveal: { value: reveal },
    uWarm: { value: warm }, uTime: { value: time },
  }), []);
  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uBright.value = bright;
    matRef.current.uniforms.uReveal.value = reveal;
    matRef.current.uniforms.uWarm.value = warm;
    matRef.current.uniforms.uTime.value = time;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={CARO_VERT}
        fragmentShader={CARO_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// Una nube advectada: cada frame interpola las POSICIONES entre las dos separaciones
// que bracketean R(t) → las partículas se MUEVEN siguiendo la densidad (la carga
// fluye al enlace). El color es fijo por partícula (viene del .bin o constante).
function O2Cloud({ posQ, colors, Rvals, N, K, R, brightness, size, ring = 0, coreThin = 0 }:
  { posQ: Int16Array; colors: Float32Array; Rvals: Float32Array; N: number; K: number; R: number; brightness: number; size: number; ring?: number; coreThin?: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [colors, N]);
  const uniforms = useMemo(() => ({ uSize: { value: size }, uBright: { value: brightness }, uRing: { value: ring }, uCoreThin: { value: coreThin } }), []);
  useEffect(() => {
    // bracket en Rvals (descendente Rmax→Rmin). frac entre k y k+1.
    let k = 0;
    if (R >= Rvals[0]) k = 0;
    else if (R <= Rvals[K - 1]) k = K - 2;
    else { while (k < K - 2 && Rvals[k + 1] > R) k++; }
    const r0 = Rvals[k], r1 = Rvals[k + 1];
    const frac = r0 === r1 ? 0 : Math.max(0, Math.min(1, (r0 - R) / (r0 - r1)));
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const o0 = k * N * 3, o1 = (k + 1) * N * 3, inv = 1 / O2AI_POSQ, mf = 1 - frac;
    for (let i = 0; i < N * 3; i++) arr[i] = (posQ[o0 + i] * mf + posQ[o1 + i] * frac) * inv;
    pos.needsUpdate = true;
    if (matRef.current) { matRef.current.uniforms.uSize.value = size; matRef.current.uniforms.uBright.value = brightness; matRef.current.uniforms.uRing.value = ring; matRef.current.uniforms.uCoreThin.value = coreThin; }
  }, [posQ, Rvals, N, K, R, brightness, size, ring, coreThin, geo]);
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={O2FLOW_VERT}
        fragmentShader={O2FLOW_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ── Nube del ÁTOMO AISLADO (ρ atómica real, precompute-atom-cloud.py) ──
// El acto 1 de la película: DOS individuos, cada uno con su nube electrónica,
// que al acercarse SE ENTRELAZAN. Se desvanece cuando el enlace se forma (la
// atención pasa del átomo a la deformación Δρ = el enlace).
function AtomCloud({ posQ, x, brightness }:
  { posQ: Int16Array; x: number; brightness: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const N = posQ.length / 3;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const inv = 1 / O2AI_POSQ;
    for (let i = 0; i < N * 3; i++) pos[i] = posQ[i] * inv;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // COLOR POR CAPA (real): la densidad radial del átomo tiene DOS picos — core 1s
    // (capa K, pegada al núcleo) y valencia 2s/2p (capa L). Corazón CÁLIDO dorado +
    // velo AZUL de valencia. Al acercarse los átomos se ve la verdad del enlace:
    // SOLO las capas de valencia se unen; los cores nunca se tocan.
    const core: [number, number, number] = [1.0, 0.86, 0.55];
    const val: [number, number, number] = [0.62, 0.36, 1.0];
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      const s = smoothstep((r - 0.28) / 0.18);       // K→L alrededor del valle radial (~0.35 bohr)
      col[i * 3] = core[0] * (1 - s) + val[0] * s;
      col[i * 3 + 1] = core[1] * (1 - s) + val[1] * s;
      col[i * 3 + 2] = core[2] * (1 - s) + val[2] * s;
    }
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return g;
  }, [posQ, N]);
  const uniforms = useMemo(() => ({ uSize: { value: 0.20 }, uBright: { value: brightness }, uRing: { value: 0 }, uCoreThin: { value: 0 } }), []);
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uBright.value = brightness; }, [brightness]);
  return (
    <points geometry={geo} position={[x, 0, 0]} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={O2FLOW_VERT}
        fragmentShader={O2FLOW_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// La FORMACIÓN del enlace O₂ desde Δρ REAL: 3 nubes que fluyen al bajar R(t).
//   acumulación → color por partícula (oro σ en el eje → ámbar π): el ENLACE que nace.
//   vaciado     → azul frío tenue: de dónde salió la carga (bruma, no protagonista).
//   espín       → violeta: los 2 e⁻ π* desapareados = por qué el O₂ es magnético.
function O2BondFlow({ ai, R, swirl = 0, third, reveal = 1, aura = 1, RLag1 = 0, RLag2 = 0, ghost = 0, piSplit = null, sigmaMul = 1, pi1Mul = 1, pi2Mul = 1, spinMul = 1, boost = 1, piColors = null }:
  { ai: O2AbInitio; R: number; swirl?: number; third?: [number, number, number]; reveal?: number; aura?: number; RLag1?: number; RLag2?: number; ghost?: number; piSplit?: Uint8Array | null; sigmaMul?: number; pi1Mul?: number; pi2Mul?: number; spinMul?: number; boost?: number; piColors?: [number, number, number][] | null }) {
  const accColors = useMemo(() => {
    const c = new Float32Array(ai.Nacc * 3);
    for (let i = 0; i < c.length; i++) c[i] = ai.accColor[i] / 255;
    return c;
  }, [ai]);
  const depColors = useMemo(() => {
    const c = new Float32Array(ai.Ndep * 3);
    for (let i = 0; i < ai.Ndep; i++) { c[i * 3] = 0.18; c[i * 3 + 1] = 0.42; c[i * 3 + 2] = 0.95; }   // azul profundo (el teal 0.55-verde daba tinte verdoso)
    return c;
  }, [ai]);
  // 3a nube: violeta = espín (imán O₂) por defecto. Con piSplit (triple enlace):
  // la nube π se DIVIDE en sus dos MOs reales y perpendiculares → π¹ VIOLETA y
  // π² ROSA, cada uno prendible/apagable ("son tres a la vez" se VE).
  const spinColors = useMemo(() => {
    const [r, g, b] = third ?? [0.80, 0.34, 1.0];
    const c = new Float32Array(ai.Nspin * 3);
    for (let i = 0; i < ai.Nspin; i++) { c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; }
    return c;
  }, [ai, third]);
  const piAB = useMemo(() => {
    if (!piSplit || piSplit.length !== ai.Nspin) return null;
    const idxA: number[] = [], idxB: number[] = [];
    for (let i = 0; i < ai.Nspin; i++) (piSplit[i] > 127 ? idxA : idxB).push(i);
    const gather = (idx: number[]) => {
      const out = new Int16Array(ai.K * idx.length * 3);
      for (let k = 0; k < ai.K; k++) {
        const o = k * ai.Nspin * 3, oo = k * idx.length * 3;
        for (let j = 0; j < idx.length; j++) {
          const i3 = o + idx[j] * 3, j3 = oo + j * 3;
          out[j3] = ai.spinPos[i3]; out[j3 + 1] = ai.spinPos[i3 + 1]; out[j3 + 2] = ai.spinPos[i3 + 2];
        }
      }
      return out;
    };
    const cA = piColors?.[0] ?? [0.78, 0.36, 1.0];   // π¹ (default VIOLETA)
    const cB = piColors?.[1] ?? [1.0, 0.34, 0.62];   // π² (default ROSA)
    const colA = new Float32Array(idxA.length * 3); const colB = new Float32Array(idxB.length * 3);
    for (let j = 0; j < idxA.length; j++) { colA[j * 3] = cA[0]; colA[j * 3 + 1] = cA[1]; colA[j * 3 + 2] = cA[2]; }
    for (let j = 0; j < idxB.length; j++) { colB[j * 3] = cB[0]; colB[j * 3 + 1] = cB[1]; colB[j * 3 + 2] = cB[2]; }
    return { posA: gather(idxA), posB: gather(idxB), nA: idxA.length, nB: idxB.length, colA, colB };
  }, [ai, piSplit, piColors]);
  // BRILLO que se INTENSIFICA: la carga acumulada REAL en el enlace (bondMass ab initio,
  // normalizada) interpolada a R(t) → el enlace se ENCIENDE al formarse. Los electrones
  // NO aparecen/desaparecen (mismas partículas): solo brillan más donde la carga se junta.
  const bmNorm = useMemo(() => {
    let mx = 1e-6; for (let k = 0; k < ai.K; k++) mx = Math.max(mx, ai.bondMass[k]);
    const a = new Float32Array(ai.K); for (let k = 0; k < ai.K; k++) a[k] = ai.bondMass[k] / mx;
    return a;
  }, [ai]);
  let glow = 0;
  { const { Rvals, K } = ai; let k = 0;
    if (R >= Rvals[0]) k = 0; else if (R <= Rvals[K - 1]) k = K - 2;
    else { while (k < K - 2 && Rvals[k + 1] > R) k++; }
    const r0 = Rvals[k], r1 = Rvals[k + 1], f = r0 === r1 ? 0 : Math.max(0, Math.min(1, (r0 - R) / (r0 - r1)));
    glow = bmNorm[k] * (1 - f) + bmNorm[k + 1] * f; }
  const isPi = !!third;                    // 3a nube = anillo π (N₂) vs espín/imán (O₂)
  const accBright = (0.26 + 0.68 * glow) * boost;    // receta O₂: grandes+tenues = densidad LUMINOSA (no puntos duros)
  // el anillo π es la FIRMA de N₂ → más brillo y cuerpo que el espín, para que compita con
  // el puente σ dorado (como el violeta/cian competía en O₂). Ambos crecen con la carga.
  const spinBright = (isPi ? (0.55 + 0.72 * glow) : (0.34 + 0.42 * glow)) * boost;
  const spinSize = isPi ? 0.24 : 0.20;
  // sprites GRANDES y TENUES: se traslapan → densidad luminosa, no polvo. dep = bruma
  // sutil (bajita), spin/acc = brillo que crece con la carga (el enlace se enciende).
  // reveal gatea el acc (carga acumulada; esconde el artefacto RHF central a R grande).
  // aura = dep + π: la RIQUEZA que viste en O₂ desde el frame 1 — cada átomo trae su
  // aura azur (π atómica) y su bruma azul (vaciado) DESDE EL INICIO; al caer se ve la
  // carga FLUIR (advección) mientras el enlace enciende.
  return (
    <group>
      <O2Cloud posQ={ai.depPos} colors={depColors} Rvals={ai.Rvals} N={ai.Ndep} K={ai.K} R={R} brightness={0.26 * aura * boost} size={0.17} />
      {/* π REAL girando: el ANILLO emerge de sus propias partículas. Con split:
          los DOS π perpendiculares en violeta y rosa, prendibles por separado */}
      <group rotation={[swirl * 0.7, 0, 0]}>
        {piAB ? (
          <>
            <O2Cloud posQ={piAB.posA} colors={piAB.colA} Rvals={ai.Rvals} N={piAB.nA} K={ai.K} R={R} brightness={spinBright * aura * pi1Mul} size={spinSize} ring={2.4 * reveal} />
            <O2Cloud posQ={piAB.posB} colors={piAB.colB} Rvals={ai.Rvals} N={piAB.nB} K={ai.K} R={R} brightness={spinBright * aura * pi2Mul} size={spinSize} ring={2.4 * reveal} />
          </>
        ) : (
          <O2Cloud posQ={ai.spinPos} colors={spinColors} Rvals={ai.Rvals} N={ai.Nspin} K={ai.K} R={R} brightness={spinBright * aura * spinMul} size={spinSize} ring={2.4 * reveal} />
        )}
      </group>
      {/* ESTELAS DE FLUJO reales: doble exposición de la advección — cada partícula
          deja su fantasma en donde estaba hace 0.1s/0.2s → la dirección del flujo de
          carga se VE durante el desplome (motion-blur del dato, no dibujo) */}
      {ghost > 0.02 && RLag1 > 0 && (
        <O2Cloud posQ={ai.accPos} colors={accColors} Rvals={ai.Rvals} N={ai.Nacc} K={ai.K} R={RLag1} brightness={accBright * reveal * ghost * 0.5} size={0.20} />
      )}
      {ghost > 0.02 && RLag2 > 0 && (
        <O2Cloud posQ={ai.accPos} colors={accColors} Rvals={ai.Rvals} N={ai.Nacc} K={ai.K} R={RLag2} brightness={accBright * reveal * ghost * 0.25} size={0.18} />
      )}
      <group rotation={[swirl, 0, 0]}>
        <O2Cloud posQ={ai.accPos} colors={accColors} Rvals={ai.Rvals} N={ai.Nacc} K={ai.K} R={R} brightness={accBright * reveal * sigmaMul} size={0.22} coreThin={0.62} />
      </group>
    </group>
  );
}

// ── Enlace: tubo emisivo tenue entre dos núcleos ──
function Bond({ a, b, time }: { a: Vec3; b: Vec3; time: number }) {
  const { mid, len, quat } = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { mid: va.clone().add(vb).multiplyScalar(0.5), len: dir.length(), quat: q };
  }, [a, b]);
  const appear = smoothstep((time - 1.2) / 1.2);
  if (appear < 0.01) return null;
  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[len * 0.012, len * 0.012, len, 10, 1, true]} />
      <meshBasicMaterial color="#bfeaff" transparent opacity={0.14 * appear} depthWrite={false} />
    </mesh>
  );
}

// DENSIDAD DE ENLACE — el término de SOLAPE 2·φ_A·φ_B del LCAO: la carga electrónica
// que se ACUMULA entre los núcleos al solaparse los orbitales. ESTO es físicamente el
// enlace (no un crossfade de dos imágenes). Se construye en un marco normalizado:
// x∈[-1,1] = a lo largo del eje de enlace (se escala entre los núcleos); el componente
// σ se concentra en el eje, el π (doble enlace de O₂) en lóbulos fuera del eje.
function buildBondBundle(): AtomBundle {
  const N = 7200;
  const positions = new Float32Array(N * 3), colors = new Float32Array(N * 3);
  const sizes = new Float32Array(N), shellIdx = new Float32Array(N);
  let s = 0x9e3779b1 >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const cSigma = new THREE.Color('#e6f3ff'), cPi = new THREE.Color('#86b8ff');
  for (let i = 0; i < N; i++) {
    const isPi = rnd() < 0.40;                         // ~40% π (doble enlace), 60% σ
    let x = gauss() * (isPi ? 0.40 : 0.42);
    x = Math.max(-0.98, Math.min(0.98, x));
    let ry: number, rz: number;
    if (isPi) { const a = rnd() * Math.PI * 2, rad = 0.24 + Math.abs(gauss()) * 0.13; ry = Math.cos(a) * rad; rz = Math.sin(a) * rad; }
    else { ry = gauss() * 0.14; rz = gauss() * 0.14; }
    positions[i * 3] = x; positions[i * 3 + 1] = ry; positions[i * 3 + 2] = rz;
    const c = isPi ? cPi : cSigma;
    const b = 0.5 + 0.5 * Math.exp(-(x * x) / (2 * 0.38 * 0.38));   // brillo máx al CENTRO (pico de densidad de enlace)
    colors[i * 3] = c.r * b; colors[i * 3 + 1] = c.g * b; colors[i * 3 + 2] = c.b * b;
    sizes[i] = 0.028 + 0.03 * (1 - Math.abs(x));
    shellIdx[i] = 0;
  }
  return { positions, colors, sizes, shellIdx, shells: [{ label: 'bond', n: 1, l: 0, color: cSigma }] };
}

// ── Explicador de los 3 ENLACES (prender/apagar) + la CARGA. Sincronizado a la
// narración: "son tres a la vez" (l05) enciende σ → π¹ → π² por separado; y en el
// clavado explica POR QUÉ el centro brilla blanco (render aditivo = densidad real). ──
const BOND_BEATS_MOL: Record<string, { t0: number; t1: number; big: string; sub: string; color: string }[]> = {
  n2: [
    { t0: 17.7, t1: 19.6, big: 'σ', sub: 'el primero — de frente', color: '#ffd76e' },
    { t0: 19.6, t1: 21.5, big: 'π', sub: 'el segundo — un anillo', color: '#c77dff' },
    { t0: 21.5, t1: 23.4, big: 'π', sub: 'el tercero — cruzado', color: '#ff7ab0' },
    { t0: 30.4, t1: 34.9, big: '', sub: 'ese brillo ES la carga: miles de cargas sumando su luz', color: '#ffffff' },
  ],
  o2: [
    { t0: 6.2, t1: 11.3, big: 'O=O', sub: 'DOS enlaces a la vez — σ y π', color: '#ffd76e' },
    { t0: 11.9, t1: 16.4, big: 'π*', sub: 'dos electrones sin pareja — EL IMÁN', color: '#c77dff' },
    { t0: 30.4, t1: 34.9, big: '', sub: 'ese brillo ES la carga: miles de cargas sumando su luz', color: '#ffffff' },
  ],
  h2: [
    { t0: 17.7, t1: 21.5, big: 'σ', sub: 'el ÚNICO — el enlace más simple del universo', color: '#ffd76e' },
    { t0: 30.4, t1: 34.9, big: '', sub: 'ese brillo ES la carga: dos electrones compartidos', color: '#ffffff' },
  ],
  f2: [
    { t0: 17.7, t1: 19.6, big: 'σ', sub: 'el único enlace — de frente', color: '#ffd76e' },
    { t0: 19.6, t1: 23.4, big: '6×2', sub: 'doce electrones apretados EMPUJÁNDOSE — por eso es débil', color: '#ff7a6a' },
    { t0: 32.6, t1: 37.4, big: '', sub: 'las líneas de la fuerza — cargas iguales SE EMPUJAN', color: '#9fc0ff' },
  ],
  c2: [
    { t0: 17.7, t1: 19.6, big: '¿σ?', sub: 'de frente... NO HAY — el carbono rompe las reglas', color: '#ffd76e' },
    { t0: 19.6, t1: 21.5, big: 'π', sub: 'un anillo puro', color: '#7db8ff' },
    { t0: 21.5, t1: 23.4, big: 'π', sub: 'y el otro, cruzado — DOBLE enlace sin frontal', color: '#a5d3ff' },
    { t0: 30.4, t1: 34.9, big: '', sub: 'ese brillo ES la carga: miles de cargas sumando su luz', color: '#ffffff' },
  ],
};
function BondExplainer({ time, vertical, mol = 'n2' }: { time: number; vertical: boolean; mol?: string }) {
  const BOND_BEATS = BOND_BEATS_MOL[mol] ?? BOND_BEATS_MOL.n2;
  const b = BOND_BEATS.find(x => time >= x.t0 && time <= x.t1 + 0.35);
  if (!b) return null;
  const op = Math.min(1, Math.max(0, (time - b.t0) / 0.3)) * Math.min(1, Math.max(0, (b.t1 + 0.35 - time) / 0.35));
  if (op < 0.01) return null;
  return (
    <div style={{ position: 'absolute', top: vertical ? '16%' : '12%', left: 0, right: 0, zIndex: 11,
      pointerEvents: 'none', opacity: op, textAlign: 'center', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {b.big && <div style={{ fontSize: vertical ? '13vw' : '4vw', fontWeight: 200, color: b.color, lineHeight: 1,
        textShadow: `0 0 46px ${b.color}66, 0 3px 30px rgba(0,0,0,0.9)` }}>{b.big}</div>}
      <div style={{ fontSize: vertical ? '3.6vw' : '1.1vw', fontWeight: 500, color: b.big ? b.color : 'rgba(255,255,255,0.92)',
        letterSpacing: '0.12em', marginTop: vertical ? '1.2vw' : 8, textTransform: 'uppercase',
        textShadow: '0 2px 24px rgba(0,0,0,0.9)' }}>{b.sub}</div>
    </div>
  );
}

// ── F₂: LÍNEAS DE FUERZA de la repulsión (las guías). Campo E REAL de dos cargas
// IGUALES (+,+) en los núcleos, integrado numéricamente: las líneas que nacen
// mirando al otro átomo se DOBLAN lejos del plano medio — el muro de carga se VE
// (cero flujo cruza el plano entre cargas iguales, física exacta). Pulsos viajan
// a lo largo = la dirección del empujón. Tenue: guía, no protagonista. ──
const REP_NP = 8;   // pulsos por línea
function RepulsionField({ nx, time }: { nx: number; time: number }) {
  // los tamaños de punto van en PÍXELES del buffer: escalar con la resolución real
  // (a 4K los sprites fijos se hacen polvo — gotcha frame-vacío-por-tamaño)
  const { size, viewport } = useThree();
  const pxScale = Math.max(1, (size.height * viewport.dpr) / 960);
  const built = useMemo(() => {
    const a1 = new THREE.Vector3(-nx, 0, 0), a2 = new THREE.Vector3(nx, 0, 0);
    const E = (p: THREE.Vector3) => {
      const d1 = p.clone().sub(a1), d2 = p.clone().sub(a2);
      const r1 = Math.max(d1.length(), 0.08), r2 = Math.max(d2.length(), 0.08);
      return d1.multiplyScalar(1 / (r1 * r1 * r1)).add(d2.multiplyScalar(1 / (r2 * r2 * r2)));
    };
    const polys: Float32Array[] = [];
    for (const sgn of [-1, 1]) {
      const org = sgn < 0 ? a1 : a2;
      for (let j = 0; j < 10; j++) {
        const th = (0.55 + 0.90 * ((j % 5) / 4));               // 31°..83° del eje, hacia el OTRO átomo
        const ph = (j < 5 ? 0 : Math.PI / 5) + (j % 5) * (2 * Math.PI / 5);
        const dir = new THREE.Vector3(-sgn * Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph));
        const p = org.clone().add(dir.multiplyScalar(0.55));
        const pts: number[] = [p.x, p.y, p.z];
        for (let s = 0; s < 150; s++) {
          const e = E(p); const el = e.length();
          if (el < 1e-6) break;
          p.add(e.multiplyScalar(0.045 / el));
          pts.push(p.x, p.y, p.z);
          if (p.length() > 4.4) break;
        }
        if (pts.length >= 25 * 3) polys.push(new Float32Array(pts));
      }
    }
    // segmentos fusionados (p_i → p_{i+1}) con parámetro de arco para el fade
    let nseg = 0;
    for (const pl of polys) nseg += pl.length / 3 - 1;
    const pos = new Float32Array(nseg * 6), aS = new Float32Array(nseg * 2);
    let o = 0, os = 0;
    for (const pl of polys) {
      const n = pl.length / 3;
      for (let i = 0; i < n - 1; i++) {
        pos.set(pl.subarray(i * 3, i * 3 + 6), o); o += 6;
        aS[os++] = i / (n - 1); aS[os++] = (i + 1) / (n - 1);
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lineGeo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    const ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(polys.length * REP_NP * 3), 3));
    const lineMat = new THREE.ShaderMaterial({
      uniforms: { uOp: { value: 0 }, uCol: { value: new THREE.Color(0.55, 0.72, 1.0) } },
      vertexShader: `attribute float aS; varying float vS;
        void main(){ vS=aS; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uOp; uniform vec3 uCol; varying float vS;
        void main(){
          float s = clamp(vS, 0.0, 1.0);
          // max() blinda contra sin() microscópicamente negativo: pow(neg)=NaN y el
          // bloom del composer propaga UN NaN a todo el frame (frame negro total)
          float a = uOp*(0.05+0.60*pow(max(sin(3.14159*s), 0.0), 1.3));
          gl_FragColor = vec4(uCol*a*3.2, a); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true });
    const ptsMat = new THREE.ShaderMaterial({
      uniforms: { uOp: { value: 0 }, uScale: { value: 1 }, uCol: { value: new THREE.Color(0.78, 0.87, 1.0) } },
      vertexShader: `uniform float uScale; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize=min(44.0*uScale, 34.0*uScale/max(0.35,-mv.z)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uOp; uniform vec3 uCol;
        void main(){ vec2 q=gl_PointCoord-0.5; float a=uOp*exp(-dot(q,q)*14.0); gl_FragColor=vec4(uCol*a*1.6,a); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    return { polys, lineGeo, ptsGeo, lineMat, ptsMat };
  }, [nx]);
  const op = smoothstep((time - 31.8) / 1.6) * (1 - smoothstep((time - 53.6) / 1.4));
  if (op < 0.01) return null;
  built.lineMat.uniforms.uOp.value = 0.85 * op;
  built.ptsMat.uniforms.uOp.value = 1.15 * op;
  built.ptsMat.uniforms.uScale.value = pxScale;
  // pulsos: viajan del nacimiento (junto al átomo) hacia AFUERA = la dirección del empujón
  const parr = built.ptsGeo.attributes.position.array as Float32Array;
  let k3 = 0;
  built.polys.forEach((pl, i) => {
    const n = pl.length / 3;
    for (let j = 0; j < REP_NP; j++) {
      const s = ((time * 0.11 + j / REP_NP + i * 0.037) % 1 + 1) % 1;
      const x = s * (n - 1), i0 = Math.floor(x), fr = x - i0, i1 = Math.min(n - 1, i0 + 1);
      parr[k3++] = pl[i0 * 3] * (1 - fr) + pl[i1 * 3] * fr;
      parr[k3++] = pl[i0 * 3 + 1] * (1 - fr) + pl[i1 * 3 + 1] * fr;
      parr[k3++] = pl[i0 * 3 + 2] * (1 - fr) + pl[i1 * 3 + 2] * fr;
    }
  });
  built.ptsGeo.attributes.position.needsUpdate = true;
  return <group>
    <lineSegments geometry={built.lineGeo} material={built.lineMat} />
    <points geometry={built.ptsGeo} material={built.ptsMat} />
  </group>;
}

function MoleculeTitle({ mkey, time, vertical }: { mkey: string; time: number; vertical: boolean }) {
  const m = META[mkey] ?? META.h2o;
  const opacity = Math.min(1, Math.max(0, (time - 2.4) / 0.9)) * Math.min(1, Math.max(0, (21.3 - time) / 0.7));
  if (opacity < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', bottom: vertical ? '14%' : '16%', left: '7%',
      zIndex: 11, pointerEvents: 'none', opacity, fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontSize: vertical ? '11vw' : '3.1vw', fontWeight: 200, color: '#fff',
        letterSpacing: '-0.03em', lineHeight: 1, textShadow: '0 4px 40px rgba(0,0,0,0.85)' }}>{m.name}</div>
      <div style={{ fontSize: vertical ? '5vw' : '1.3vw', fontWeight: 500, color: 'rgba(127,212,255,0.9)',
        letterSpacing: '0.08em', marginTop: vertical ? '1.6vw' : 12,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{m.formula}</div>
    </div>
  );
}

// ── Placard "qué ves · la medida · qué significa" — elegante y entendible. Aparece
// en el VIAJE (cuando la nube es el foco); el campo toma el relevo en el revelado.
// Las medidas son REALES (NIST): longitudes y ángulos de enlace medidos. ──
interface ScaleInfo { what: string; measure: string; meaning: string; }
const BASE_SCALE: Record<string, ScaleInfo> = {
  // cadenas — alcanos (σ): todos comparten la misma medida de enlace
  ...Object.fromEntries(['butane', 'pentane', 'hexane', 'heptane', 'octane', 'nonane', 'decane', 'dodecane', 'pentadecane', 'hexadecane', 'heptadecane', 'eicosane'].map(k => [k,
    { what: 'Lo que ves: la nube de electrones', measure: 'enlace C–C · 1.54 Å', meaning: '1 Å = 0.1 nm, el tamaño de un átomo' }])),
  // cadenas — conjugadas (σ + π)
  ...Object.fromEntries(['hexatriene', 'octatetraene', 'decapentaene', 'dodecahexaene', 'tetradecaheptaene', 'hexadecaoctaene'].map(k => [k,
    { what: 'Lo que ves: la nube de electrones σ y π', measure: 'C=C 1.34 Å · C–C 1.45 Å', meaning: 'doble y simple alternados = "conjugado"' }])),
  caroteno: { what: 'Lo que ves: la nube π conjugada', measure: 'cadena π ≈ 2.4 nm', meaning: 'absorbe la luz azul → la ves naranja' },
  // ── ADN — medidas B-form reales (Arnott-Hukins 1972) ──
  ...Object.fromEntries(['brca1', 'telomero', 'tata'].map(k => [k,
    { what: 'Lo que ves: la doble hélice de tu ADN', measure: '3.4 Å por escalón · 10.5 bases/vuelta', meaning: 'dos metros de esto enrollados en CADA célula tuya' }])),
  // moléculas
  co2: { what: 'Lo que ves: la nube de electrones', measure: 'C=O · 1.16 Å · 180°', meaning: '1 Å = la diezmilmillonésima de un metro' },
  ch4: { what: 'Lo que ves: la nube de electrones', measure: 'C–H · 1.09 Å · 109.5°', meaning: 'cuatro enlaces: un tetraedro' },
  nh3: { what: 'Lo que ves: la nube de electrones', measure: 'N–H · 1.01 Å · 107°', meaning: 'el par libre la vuelve pirámide' },
  h2: { what: 'Lo que ves: la nube de electrones', measure: 'H–H · 0.74 Å', meaning: 'el primer enlace del universo' },
  f2: { what: 'Lo que ves: la nube de electrones', measure: 'F–F · 1.41 Å', meaning: 'el enlace más débil — por eso arde con todo' },
  c2: { what: 'Lo que ves: la nube de electrones', measure: 'C=C · 1.24 Å', meaning: 'doble enlace de puro π — sin enlace frontal' },
  n2: { what: 'Lo que ves: la nube de electrones', measure: 'N≡N · 1.10 Å', meaning: 'triple enlace: el candado del aire' },
  o2: { what: 'Lo que ves: la nube de electrones', measure: 'O=O · 1.21 Å', meaning: 'doble enlace — y es magnético' },
  co: { what: 'Lo que ves: la nube de electrones', measure: 'C≡O · 1.13 Å', meaning: '1 Å = el tamaño de un átomo' },
  hcl: { what: 'Lo que ves: la nube de electrones', measure: 'H–Cl · 1.27 Å', meaning: 'el cloro jala los electrones' },
  hf: { what: 'Lo que ves: la nube de electrones', measure: 'H–F · 0.92 Å', meaning: 'el enlace más polar que hay' },
  nacl: { what: 'Lo que ves: la nube de electrones', measure: 'Na···Cl · 2.36 Å', meaning: 'un átomo le robó el electrón al otro' },
};
const SCALE: Record<string, ScaleInfo> = { ...BASE_SCALE, ...CATALOG_SCALE };

function ScaleNote({ molKey, time, vertical }: { molKey: string; time: number; vertical: boolean }) {
  const s = SCALE[molKey];
  if (!s) return null;
  const opacity = smoothstep((time - 4.5) / 0.9) * (1 - smoothstep((time - 10.5) / 0.9));
  if (opacity < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', top: vertical ? '10.5%' : '9%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontWeight: 300, color: 'rgba(255,255,255,0.94)',
        fontSize: vertical ? '4.4vw' : '1.6vw', lineHeight: 1.25,
        textShadow: '0 2px 30px rgba(0,0,0,0.92)' }}>{s.what}</div>
      <div style={{ fontWeight: 600, color: 'rgba(127,212,255,0.96)', marginTop: vertical ? '1.7vw' : 8,
        fontSize: vertical ? '4.6vw' : '1.55vw', letterSpacing: '0.03em',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        textShadow: '0 2px 22px rgba(0,0,0,0.92)' }}>{s.measure}</div>
      <div style={{ fontWeight: 400, color: 'rgba(222,227,238,0.74)', marginTop: vertical ? '1.0vw' : 5,
        fontSize: vertical ? '3.1vw' : '1.05vw', lineHeight: 1.2,
        textShadow: '0 2px 20px rgba(0,0,0,0.92)' }}>{s.meaning}</div>
    </div>
  );
}

// Explica el SONIDO (solo ADN): la secuencia real convertida en música. Aparece
// tras el placard, para que el espectador sepa qué está oyendo.
function AudioNote({ time, vertical }: { time: number; vertical: boolean }) {
  const opacity = smoothstep((time - 12.5) / 0.9) * (1 - smoothstep((time - 19.0) / 0.9));
  if (opacity < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', top: vertical ? '10.5%' : '9%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontWeight: 300, color: 'rgba(255,255,255,0.94)',
        fontSize: vertical ? '4.4vw' : '1.6vw', lineHeight: 1.25,
        textShadow: '0 2px 30px rgba(0,0,0,0.92)' }}>♪ Lo que oyes: tu ADN hecho música</div>
      <div style={{ fontWeight: 600, color: 'rgba(127,212,255,0.96)', marginTop: vertical ? '1.7vw' : 8,
        fontSize: vertical ? '4.2vw' : '1.45vw', letterSpacing: '0.03em',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        textShadow: '0 2px 22px rgba(0,0,0,0.92)' }}>cada letra · A · T · G · C · es una nota</div>
      <div style={{ fontWeight: 400, color: 'rgba(222,227,238,0.74)', marginTop: vertical ? '1.0vw' : 5,
        fontSize: vertical ? '3.1vw' : '1.05vw', lineHeight: 1.2,
        textShadow: '0 2px 20px rgba(0,0,0,0.92)' }}>la melodía ES tu secuencia real, leída 5′→3′</div>
    </div>
  );
}

// Etiqueta del modo vibracional activo — "se entiende qué vibra con qué".
function ModeLabel({ modes, time, vertical }: { modes: VibMode[] | null; time: number; vertical: boolean }) {
  if (!modes) return null;
  if (time > 12.5 && time < 18.3) return null;     // cede el lugar a la etiqueta del campo
  const amps = modeAmps(time);
  let active = -1, best = 0.12;
  for (let i = 0; i < amps.length; i++) if (amps[i] > best) { best = amps[i]; active = i; }
  const allMode = time >= 17.5;
  let label = '', sub = '';
  if (allMode) { label = 'Los tres modos a la vez'; sub = 'así vibra el agua real'; }
  else if (active >= 0) { label = modes[active].label; sub = `${modes[active].wavenumber} cm⁻¹`; }
  else return null;
  const opacity = allMode ? smoothstep((time - 17.6) / 0.6) : smoothstep(best / 0.3);
  if (opacity < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', top: vertical ? '11%' : '10%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontWeight: 300, color: 'rgba(255,255,255,0.95)',
        fontSize: vertical ? '5.4vw' : '2vw', lineHeight: 1.2,
        textShadow: '0 2px 30px rgba(0,0,0,0.9)' }}>{label}</div>
      <div style={{ fontWeight: 500, color: 'rgba(127,212,255,0.9)', marginTop: '1vw',
        fontSize: vertical ? '3.6vw' : '1.3vw', letterSpacing: '0.06em',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>{sub}</div>
    </div>
  );
}

// Etiqueta del CAMPO ELECTROSTÁTICO — solo en moléculas POLARES (las que tienen
// campo). Sub-texto por molécula (NO el del agua en todas).
const BASE_FIELD_SUB: Record<string, string> = {
  h2o: 'por esto el agua disuelve todo',
  hcl: 'el cloro jala los electrones',
  hf: 'el enlace más polar que hay',
  nacl: 'casi un ion: un lado + y otro −',
  co: 'un dipolo sutil e invertido',
  nh3: 'el par libre la vuelve polar',
  co2: 'cada enlace es polar (pero se cancelan)',
  // conjugadas: el campo son las CARAS π (electrón-ricas)
  hexatriene: 'las caras π son ricas en electrones',
  decapentaene: 'por las caras π reacciona y se apila',
  caroteno: 'estas caras π atrapan la luz: por eso ves',
  // alcanos: nube σ suave y uniforme (sin caras) → inertes
  butane: 'la nube σ, suave y sin caras: por eso es inerte',
  hexane: 'puro enlace σ, sin zonas reactivas',
  octane: 'la nube σ envuelve la cadena, fría y pareja',
  decane: 'σ uniforme — el alcano casi no reacciona',
  pentane: 'la nube σ, suave y pareja: inerte',
  heptane: 'puro enlace σ, sin zonas reactivas',
  nonane: 'la nube σ envuelve la cadena, fría',
  dodecane: 'σ uniforme — cadena larga, sigue inerte',
  hexadecane: 'σ pareja de punta a punta',
  octatetraene: 'las caras π, más largas, más ricas',
  dodecahexaene: 'el río π ya casi tiene color propio',
  pentadecane: 'σ pareja, cadena larga: inerte',
  heptadecane: 'la nube σ envuelve toda la cadena',
  eicosane: 'σ uniforme de punta a punta: cera inerte',
  tetradecaheptaene: 'caras π largas: el río ya casi es rojo',
  hexadecaoctaene: 'el río π más largo, absorbe color',
};
const FIELD_SUB: Record<string, string> = { ...BASE_FIELD_SUB, ...CATALOG_FIELD_SUB };

function FieldLabel({ molKey, polar, time, vertical }: { molKey: string; polar: boolean; time: number; vertical: boolean }) {
  if (!polar) return null;
  const opacity = smoothstep((time - 12.5) / 0.8) * Math.min(1, Math.max(0, (18.5 - time) / 0.7));
  if (opacity < 0.01) return null;
  const sub = FIELD_SUB[molKey] ?? 'esta molécula es polar';
  const title = (CONJUGATED_KEYS.has(molKey) || CATALOG_FIELD[molKey] === 'pi') ? 'El campo de la nube π'
    : (CHAIN_KEYS.has(molKey) || CATALOG_FIELD[molKey] === 'sigma') ? 'El campo σ'
      : 'El campo electrostático';
  return (
    <div style={{
      position: 'absolute', top: vertical ? '11%' : '10%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontWeight: 300, color: 'rgba(255,255,255,0.96)',
        fontSize: vertical ? '5.4vw' : '2vw', lineHeight: 1.2,
        textShadow: '0 2px 30px rgba(0,0,0,0.9)' }}>{title}</div>
      <div style={{ fontWeight: 500, color: 'rgba(190,205,255,0.92)', marginTop: '1vw',
        fontSize: vertical ? '3.6vw' : '1.3vw', letterSpacing: '0.04em',
        textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>{sub}</div>
    </div>
  );
}

// Posiciones de núcleos animadas por los modos vibracionales activos.
function animatedNuclei(base: Vec3[], modes: VibMode[] | null, t: number): Vec3[] {
  if (!modes) return base;
  const amps = modeAmps(t);
  return base.map((p, i) => {
    let x = p[0], y = p[1], z = p[2];
    for (let m = 0; m < modes.length; m++) {
      const a = amps[m];
      if (a < 0.001) continue;
      const osc = Math.sin(2 * Math.PI * VIS_FREQ * t + m * 2.094);
      const d = modes[m].disp[i];
      x += VIS_AMP * a * osc * d[0];
      y += VIS_AMP * a * osc * d[1];
      z += VIS_AMP * a * osc * d[2];
    }
    return [x, y, z];
  });
}

// ── CAMPO ELÉCTRICO CONTINUO — el campo NO son líneas, es un CONTINUO que llena
// el espacio: en cada punto hay un valor (el potencial V), y eso se PINTA con
// color. Azul = potencial + (lado de los hidrógenos δ+), rojo = − (pares libres
// del O δ−), brillo = intensidad. Fluye a lo largo del campo E (de + a −). Por
// esto el agua disuelve todo. Honesto: solo aparece en moléculas POLARES — en
// H₂/N₂/O₂ las cargas son iguales (electronegatividad igual) → no hay campo.
function partialCharges(nuclei: Nuc[]): number[] {
  const en = nuclei.map(n => elementByZ(n.protons)?.electronegativity ?? 2.2);
  const k = 0.42, q = nuclei.map(() => 0);
  for (let i = 1; i < nuclei.length; i++) {       // ligandos enlazados al átomo central
    q[i] += k * (en[0] - en[i]);                  // el más electronegativo jala → −
    q[0] += k * (en[i] - en[0]);
  }
  return q;
}

// El campo se renderiza como PLASMA volumétrico (raymarch): un medio continuo,
// fluido, que fluye — no partículas. Como la corona del sol o una aurora.
const PLASMA_VERT = /* glsl */ `
varying vec3 vWorld;
void main(){
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const PLASMA_FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uOpacity, uRf;
uniform int uN;
uniform vec3 uPos[8];
uniform float uQ[8];
varying vec3 vWorld;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.02 + 1.7; a *= 0.5; } return s; }
void main(){
  vec3 ro = cameraPosition, rd = normalize(vWorld - cameraPosition);
  // ray-esfera (centro origen, radio uRf): el volumen del campo
  float b = dot(ro, rd), c = dot(ro, ro) - uRf * uRf, h = b * b - c;
  if (h < 0.0) discard; h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h;
  if (t1 <= t0) discard;
  float dt = (t1 - t0) / 26.0;
  // JITTER por pixel: rompe el banding del raymarch (los anillos/"líneas") en ruido
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 26; i++){
    float t = t0 + (float(i) + jit) * dt;
    vec3 p = ro + rd * t;
    float V = 0.0, near = 1e9;
    for (int k = 0; k < 8; k++){ if (k >= uN) break; float d = length(p - uPos[k]); near = min(near, d); V += uQ[k] / (d + 0.35); }
    float mag = clamp(abs(V) * 2.3, 0.0, 1.0);
    // HUECO: el plasma se abre donde vive la molécula (cerca de los núcleos) para
    // que la nube/enlaces se vean DENTRO de su campo.
    float shell = smoothstep(0.6, 1.6, near);
    float dens = mag * shell;
    if (dens < 0.025) continue;
    // PLASMA: turbulencia fbm que fluye con el tiempo, modulada por el campo
    float n = fbm(p * 1.5 + vec3(0.0, uTime * 0.22, 0.0) + V * 1.2);
    n = smoothstep(0.42, 0.98, n);
    vec3 col = V > 0.0 ? vec3(0.30, 0.62, 1.0) : vec3(1.0, 0.30, 0.42);  // azul + / rojo −
    acc += col * (n * dens) * dt * 2.7;
  }
  gl_FragColor = vec4(acc * uOpacity, 1.0);
}`;

function PlasmaField({ nuclei, time }: { nuclei: Nuc[]; time: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { Rf, uPos, uQ, n, ok } = useMemo(() => {
    const fail = { Rf: 1, uPos: [] as THREE.Vector3[], uQ: [] as number[], n: 0, ok: false };
    if (nuclei.length < 2) return fail;
    const q = partialCharges(nuclei);
    if (!q.some(v => Math.abs(v) > 0.05)) return fail;     // apolar → sin campo
    let core = 0; nuclei.forEach(nu => { core = Math.max(core, Math.hypot(nu.pos[0], nu.pos[1], nu.pos[2])); });
    const Rf = Math.max(2.5, (core || 1) * 3.6);
    const N = Math.min(8, nuclei.length);
    const uPos: THREE.Vector3[] = [], uQ: number[] = [];
    for (let i = 0; i < 8; i++) {
      if (i < N) { uPos.push(new THREE.Vector3(nuclei[i].pos[0], nuclei[i].pos[1], nuclei[i].pos[2])); uQ.push(q[i]); }
      else { uPos.push(new THREE.Vector3()); uQ.push(0); }
    }
    return { Rf, uPos, uQ, n: N, ok: true };
  }, [nuclei]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uOpacity: { value: 0 }, uRf: { value: Rf }, uN: { value: n },
    uPos: { value: uPos }, uQ: { value: uQ },
  }), [Rf, n, uPos, uQ]);
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = time;
    matRef.current.uniforms.uOpacity.value = smoothstep((time - 11.5) / 2.5) * 0.92;
  }, [time]);

  if (!ok) return null;
  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[Rf, 24, 24]} />
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={PLASMA_VERT} fragmentShader={PLASMA_FRAG}
        transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ── CAMPO DE CARAS π (cadenas CONJUGADAS) ─ El potencial electrostático molecular
// (MEP) real: la nube π vive ARRIBA y ABAJO del plano → esas caras son ricas en
// electrones = potencial NEGATIVO (violeta/rojo), la periferia (H) levemente +
// (azul). No es un dipolo inventado: es la razón física de que reaccionen, se
// apilen y absorban luz. Analítico (no point-charges) → barato y sin tope de 8.
const CHAINFIELD_FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uOpacity, uRf, uL, uRp, uOff, uAlkane;
uniform vec3 uC, uAxis, uN;
varying vec3 vWorld;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.02 + 1.7; a *= 0.5; } return s; }
void main(){
  vec3 ro = cameraPosition, rd = normalize(vWorld - cameraPosition);
  vec3 oc = ro - uC; float b = dot(oc, rd), c = dot(oc, oc) - uRf * uRf, h = b * b - c;
  if (h < 0.0) discard; h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h; if (t1 <= t0) discard;
  float dt = (t1 - t0) / 26.0;
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 26; i++){
    float t = t0 + (float(i) + jit) * dt; vec3 p = ro + rd * t;
    vec3 rel = p - uC;
    float s = dot(rel, uAxis), dN = dot(rel, uN);
    vec3 ip = rel - uAxis * s - uN * dN; float w = length(ip);
    float along = smoothstep(uL * 1.15, uL * 0.82, abs(s));              // solo dentro de la cadena
    float rperp = sqrt(w * w + dN * dN);
    float V; vec3 col;
    if (uAlkane > 0.5) {
      // ALCANO: nube σ — tubo suave alrededor del eje (sin caras ni dipolo). Cuerpo
      // δ− (electrones del enlace), H en la periferia δ+. Frío y uniforme = inerte.
      float tube = exp(-(rperp * rperp) / (uRp * uRp * 0.9)) * along;
      float edge = smoothstep(uRp * 0.85, uRp * 1.5, rperp) * exp(-pow(rperp - uRp * 1.25, 2.0) / (uRp * uRp * 0.5)) * along;
      V = -tube + 0.55 * edge;
      col = V < 0.0 ? vec3(0.28, 0.85, 0.95) : vec3(1.0, 0.66, 0.32);    // teal frío σ / ámbar tenue (H δ+)
    } else {
      // CONJUGADA: caras π (electrón-ricas) arriba/abajo del plano molecular
      float face = exp(-pow(abs(dN) - uOff, 2.0) / 0.30) * exp(-(w * w) / (uRp * uRp * 0.7));
      float edge = exp(-(dN * dN) / 0.26) * smoothstep(uRp * 0.8, uRp * 1.4, w);
      V = (-face + 0.4 * edge) * along;
      col = V < 0.0 ? vec3(0.92, 0.34, 0.86) : vec3(0.32, 0.6, 1.0);     // caras π magenta / periferia azul
    }
    float mag = clamp(abs(V) * 1.5, 0.0, 1.0);
    if (mag < 0.03) continue;
    float n = fbm(p * 1.6 + vec3(0.0, uTime * 0.22, 0.0) + V * 1.3);
    n = smoothstep(0.45, 0.98, n);
    acc += col * (n * mag) * dt * 1.35;
  }
  gl_FragColor = vec4(acc * uOpacity, 1.0);
}`;

function ChainField({ frame, time, alkane }: { frame: Frame; time: number; alkane: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const off = 1.25;                                            // bohr: donde pica la densidad π fuera del plano
  const Rf = Math.max(frame.L * 1.2, frame.Rp * 1.7, off + 3.0);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uOpacity: { value: 0 }, uRf: { value: Rf }, uL: { value: frame.L },
    uRp: { value: Math.max(frame.Rp, 1.2) }, uOff: { value: off }, uAlkane: { value: alkane ? 1 : 0 },
    uC: { value: new THREE.Vector3(...frame.c) }, uAxis: { value: new THREE.Vector3(...frame.a) },
    uN: { value: new THREE.Vector3(...frame.planeN) },
  }), [frame, Rf, alkane]);
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = time;
    // entra al REVELAR, cuando la cámara YA se alejó (no en el túnel cerrado) — sutil.
    // El campo σ del alcano es DÉBIL (más tenue); el de caras π es más presente.
    matRef.current.uniforms.uOpacity.value = smoothstep((time - 13.0) / 3.0) * (alkane ? 0.26 : 0.33);
  }, [time, alkane]);
  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[Rf, 24, 24]} />
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={PLASMA_VERT} fragmentShader={CHAINFIELD_FRAG}
        transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function CinematicMoleculeInner({ molKey, live = false }: { molKey: string; live?: boolean }) {
  const [data, setData] = useState<MolData | null>(null);
  const [o2ai, setO2ai] = useState<O2AbInitio | null>(null);   // Δρ ab initio del enlace (O₂)
  const [atomCloud, setAtomCloud] = useState<Int16Array | null>(null);   // nube del átomo AISLADO (individuos)
  const [piSplit, setPiSplit] = useState<Uint8Array | null>(null);       // ¿a cuál π pertenece cada partícula? (triple enlace)
  const [time, setTime] = useState(0);
  const modes = useMemo(() => (molKey === 'h2o' ? computeWaterModes() : null), [molKey]);
  const [vertical, setVertical] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth);
  const tv = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const v = parseFloat(new URLSearchParams(window.location.search).get('tv') || '0');
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  }, []);

  useEffect(() => {
    const onResize = () => setVertical(window.innerHeight > window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isChain = CHAIN_KEYS.has(molKey);
  const isCatalog = CATALOG_KEYS.has(molKey);
  const isDNA = DNA_KEYS.has(molKey);
  const catField = isCatalog ? CATALOG_FIELD[molKey] : null;   // 'pi' | 'sigma' | 'none'

  // Cargar la nube precomputada (cadenas → chain-…, catálogo → catalog-…, resto → mol-…)
  useEffect(() => {
    let alive = true;
    if (live) setData(null);   // al cambiar de molécula en el lab, no dejar la anterior visible
    const prefix = isDNA ? 'dna' : isCatalog ? 'catalog' : isChain ? 'chain' : 'mol';
    fetch(`/precomputed/${prefix}-${molKey}.bin`)
      .then(r => r.arrayBuffer())
      .then(buf => { if (alive) setData(parseBin(buf)); })
      .catch(e => console.error('mol load failed', e));
    // Enlaces AB INITIO (o2/n2/f2/h2): además la Δρ REAL de la formación (calculada)
    if (isBond(molKey)) {
      if (live) setO2ai(null);
      fetch(`/precomputed/${molKey}-abinitio.bin`)
        .then(r => r.arrayBuffer())
        .then(buf => { if (alive) setO2ai(parseO2AbInitio(buf)); })
        .catch(e => console.error('bond abinitio load failed', e));
      // nube del átomo AISLADO (acto 1: individuos que se entrelazan). Opcional (404 ok).
      setAtomCloud(null);
      fetch(`/precomputed/${molKey}-atomcloud.bin`)
        .then(r => (r.ok ? r.arrayBuffer() : null))
        .then(buf => { if (alive && buf) setAtomCloud(new Int16Array(buf.slice(4, 4 + new DataView(buf).getInt32(0, true) * 6))); })
        .catch(() => { /* opcional */ });
      // split π¹/π² (triple enlace — 3 colores para 3 enlaces). Opcional (404 ok).
      setPiSplit(null);
      fetch(`/precomputed/${molKey}-pisplit.bin`)
        .then(r => (r.ok ? r.arrayBuffer() : null))
        .then(buf => { if (alive && buf) setPiSplit(new Uint8Array(buf.slice(4, 4 + new DataView(buf).getInt32(0, true)))); })
        .catch(() => { /* opcional */ });
    }
    return () => { alive = false; };
  }, [molKey, isChain, isCatalog, isDNA, live]);

  // Marco geométrico (eje principal, elongación) → decide orbit vs traversal.
  const frame = useMemo<Frame>(() => ({ ...frameFromNuclei(data?.nuclei ?? [], data?.extent ?? 8), dna: isDNA, o2: isBond(molKey), nucX: isBond(molKey) ? BOND_ABINITIO[molKey].Re / 2 : undefined, mk: molKey }), [data, isDNA, molKey]);

  const isCaro = molKey === 'caroteno';
  const dur = isDNA ? DNA_DURATION : isBond(molKey) ? O2_FILM_DURATION : isCaro ? CARO_DURATION : DURATION;

  // API determinista (render headless) — ready solo cuando la nube cargó.
  // En modo `live` (montado en el quimilab) NO exponemos la API: corre el RAF.
  useEffect(() => {
    if (live) return;
    const api = {
      renderAt: (t: number) => setTime(Math.max(0, Math.min(dur, t))),
      ready: !!data, duration: dur, molecule: molKey,
    };
    (window as unknown as { __cinematicAtom: typeof api }).__cinematicAtom = api;
    return () => { delete (window as unknown as { __cinematicAtom?: unknown }).__cinematicAtom; };
  }, [molKey, data, live, dur]);

  // Modo vivo: loop continuo (cuando se monta interactivo en el lab).
  useEffect(() => {
    if (!live) return;
    let raf = 0, start = 0;
    const loop = (now: number) => { if (!start) start = now; setTime(((now - start) / 1000) % dur); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live, dur]);

  // En el lab se cambia de pestaña seguido; cada Canvas crea un contexto WebGL y
  // Chrome limita ~16 → si no se liberan al desmontar, el más viejo se pierde
  // ("Context Lost") y la escena se ennegrece. Al desmontar (solo live) forzamos
  // la liberación inmediata del contexto. El render headless 4K NO toca esto.
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  useEffect(() => () => { if (live) { try { glRef.current?.forceContextLoss(); glRef.current?.dispose(); } catch { /* noop */ } } }, [live]);

  void tv;
  return (
    <div style={{ position: live ? 'absolute' : 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        flat={!live}
        onCreated={({ gl }) => { glRef.current = gl; }}
        camera={{ position: [0, 0, (data?.extent ?? 8) * 0.5], fov: 35, near: 0.01, far: 400 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]} frameloop="always" style={{ background: '#000' }}
      >
        <color attach="background" args={['#000']} />
        <FrameDriver time={time} />
        {data && (() => {
          // FORMACIÓN DEL ENLACE (O₂) GUIADA POR LA FÍSICA: el oscilador de Morse
          // (morseR) da el acercamiento REAL — caen al pozo, sobrepasan re, rebotan
          // y vibran hasta asentarse. La nube/enlace/campo se forman cuando los
          // orbitales se SOLAPAN (r → re). Solo O₂ por ahora.
          const _base = animatedNuclei(data.nuclei.map(n => n.pos), modes, time);
          const _cen = _base.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]] as Vec3, [0, 0, 0] as Vec3).map(v => v / _base.length) as Vec3;
          // ESPACIO CONTINUO (cero cortes): abre FORMADA (el pico = frame 1) y la
          // separación/unión sucede VARIAS VECES en cámara (bondR coreografiado).
          const sceneT = time;
          // CAROTENO: el color NACE del largo. reveal = la cadena crece (0.5-13s);
          // warm = el salto HOMO-LUMO cae al visible cuando el largo pasa el umbral
          // (ignición 13-18s) → el río violeta ESTALLA naranja. bright con brío.
          const caroReveal = isCaro ? smoothstep((sceneT - 0.5) / 12.5) : 1;
          const caroWarm = isCaro ? smoothstep((sceneT - 13.0) / 5.0) : 1;
          const caroBright = 0.62;   // tenue a propósito: el aditivo del río satura a blanco si subes
          const mr = isBond(molKey) ? bondR(sceneT, molKey) : 1.0;
          const formed = isBond(molKey) ? smoothstep((1.4 - mr) / 0.25) : 1;
          // VIBRACIÓN DE PUNTO CERO: aun en el estado base la molécula respira (energía
          // vibracional ωe). El enlace vibra sutil ±1.2% sobre re — nunca está del todo quieta.
          const zpv = isBond(molKey) ? formed * 0.025 * Math.sin(sceneT * 4.0) : 0;   // ±2.5%: el enlace RESPIRA visible (zpv real, amplitud legible)
          // clamp al rango del bin (el rebote del Morse baja de Rmin un instante: que
          // núcleos y nube compriman JUNTOS, no el núcleo solo)
          const _appr = Math.max(0.85, mr + zpv);   // separación relativa: R(t) = Re·_appr (bohr)
          // TRANSIT DIM por FASE del viaje: dentro de la nube la columna σ apila miles
          // de sprites aditivos → pared BLANCA. Clavado (30–44) y salida (58.5–64.5)
          // = túnel tenue (0.12); órbita del núcleo = bokeh moderado (0.45) para que
          // los nucleones (mallas, no sprites) RESALTEN. Afuera, intacta. Rampas suaves.
          const _sw = (a: number, b: number) => smoothstep((sceneT - a) / (b - a));
          let transitDim = 1;
          if (isBond(molKey) && molKey === 'f2') {
            // F₂ NO baja al núcleo: el acto medio vive DENTRO del velo (cinturones de
            // pares libres + callejón). Dim moderado para que las partículas RESUELVAN
            // sin pared blanca, y las guías de repulsión se lean encima.
            // DENTRO del velo todo el acto (cinturón+locura+callejón): 0.32. OJO
            // calibrado A 4K REAL: el probe 540p tiene sprites 4× más gordos (cap
            // en px) → quema con la mitad de luz. A 4K, 0.16 daba pantalla NEGRA
            // (brillo medio 0.01-0.05) y 0.32 da el acto vivo sin lavar la columna.
            transitDim = lerp(1, 0.32, _sw(27.8, 30.2));    // entra al cinturón (cruza el velo ~28.7)
            transitDim = lerp(transitDim, 1.0, _sw(54.2, 56.2));  // el brillo regresa con la molécula
          } else if (isBond(molKey)) {
            // el dim entra cuando la cámara CRUZA el borde de la nube (~34.5s con el
            // clavado desde 1.95·ex) — NO antes: atenuar al sujeto en plano abierto
            // = pantalla muerta (lo cachó pantalla-verify: fill 0.06 en 30-35s)
            transitDim = lerp(1, 0.14, _sw(30.0, 32.5));    // entra a la nube
            transitDim = lerp(transitDim, 0.50, _sw(36.5, 39.0)); // llega al núcleo
            transitDim = lerp(transitDim, 0.15, _sw(51.2, 52.7)); // salida warp
            transitDim = lerp(transitDim, 1.0, _sw(53.9, 56.2));  // el BRILLO REGRESA con la molécula ("el candado sigue ahí" = 56.3 llegando a color)
          }
          const animPos = _base.map(p => [_cen[0] + (p[0] - _cen[0]) * _appr, _cen[1] + (p[1] - _cen[1]) * _appr, _cen[2] + (p[2] - _cen[2]) * _appr] as Vec3);
          // O₂: los núcleos DIBUJADOS se alinean con la densidad ab initio (eje X, ±R/2)
          // sin importar el eje del mol-o2.bin. R(t)=2.28·_appr bohr → ±1.14·_appr.
          const drawPos: Vec3[] = isBond(molKey)
            ? animPos.map((_, i) => [(i === 0 ? -1 : 1) * (BOND_ABINITIO[molKey].Re / 2) * _appr, 0, 0] as Vec3)
            : animPos;
          return <>
            <MolCameraRig frame={frame} time={isBond(molKey) ? sceneT : time} vertical={vertical} />
            {/* caroteno: el río π ES el protagonista; los nucleones (dots duros) sobran */}
            {!isCaro && data.nuclei.map((nuc, i) => (
              <group key={i} position={drawPos[i]}>
                <Nucleus protons={nuc.protons} neutrons={nuc.neutrons} time={time}
                  clusterRadius={0.022 + 0.009 * Math.cbrt(nuc.protons + nuc.neutrons)} />
              </group>
            ))}
            {/* CAROTENO FLAGSHIP: la cadena por el MOTOR de O₂ (sprites grandes+tenues,
                río π cálido naciendo del largo) — reemplaza ElectronCloud+ChainField */}
            {isCaro && <CarotenoFlow bundle={data.bundle} axis={frame.a} cen={frame.c}
              L={frame.L} reveal={caroReveal} warm={caroWarm} bright={caroBright} time={sceneT} />}
            {/* nube MOLECULAR precomputada — OTRAS moléculas (O₂ usa la densidad real abajo) */}
            {!isBond(molKey) && !isCaro && <ElectronCloud bundle={data.bundle} time={time} holeRadius={0.04}
              bokeh={0.8 / Math.max(1, data.extent)} rotRate={0} brightness={formed} />}
            {/* O₂: Δρ AB INITIO (PySCF UHF/cc-pVTZ, triplete). La DEFORMACIÓN Δρ=ρ(O₂)−ρ(átomos)
                = el enlace DESNUDO: oro/ámbar donde la carga se acumula (σ+π), azul de dónde se
                vació, violeta = los π* desapareados (el imán). Fluye al bajar R(t)=2.28·_appr bohr. */}
            {/* ACTO 1: dos ÁTOMOS INDIVIDUALES (ρ atómica real) que se entrelazan al
                acercarse. Electrones = cian-blanco frío (juego de color: frío el átomo,
                cálido el enlace). Se desvanecen al formarse el enlace (pasa la atención
                a Δρ) pero no mueren: la molécula conserva sus nubes. */}
            {/* HANDOFF continuo: conforme el campo del enlace ENCIENDE (reveal), la
                foto atómica congelada CEDE — se ve la unión, no dos nubes cruzándose. */}
            {isBond(molKey) && atomCloud && [-1, 1].map(s => (
              <AtomCloud key={s} posQ={atomCloud} x={s * (BOND_ABINITIO[molKey].Re / 2) * _appr}
                brightness={(0.55 - 0.36 * smoothstep((1.7 - mr) / 0.35) - 0.15 * formed) * transitDim * (BOND_ABINITIO[molKey].boost ?? 1)} />
            ))}
            {isBond(molKey) && o2ai && (() => {
              const mrL1 = Math.max(0.86, bondR(Math.max(0, sceneT - 0.10), molKey));
              const mrL2 = Math.max(0.86, bondR(Math.max(0, sceneT - 0.22), molKey));
              const flowSpeed = Math.abs(mr - mrL2) / 0.22;          // |dR/dt| real
              const ghost = Math.min(1, flowSpeed * 3.2);            // estelas ∝ velocidad del flujo
              // PRENDER/APAGAR enlaces — N₂: σ → π¹ → π² · O₂: doble enlace → EL IMÁN (π*)
              const _win = (a: number, b: number) => smoothstep((time - a) / 0.28) * (1 - smoothstep((time - b) / 0.28));
              const isO2x = molKey === 'o2';
              const wS = isO2x ? _win(6.2, 11.3) : _win(17.7, 19.6);
              const w1 = isO2x ? 0 : _win(19.6, 21.5);
              const w2 = isO2x ? 0 : _win(21.5, 23.4);
              const wM = isO2x ? _win(11.9, 16.4) : 0;           // el IMÁN (spin/π* solo)
              const solo = Math.max(wS, w1, w2, wM);
              // pisos O₂ más altos: el beat resalta SIN apagar la molécula (feedback colores)
              const fO = isO2x ? 0.34 : 0.14, fP = isO2x ? 0.30 : 0.10;
              const sigmaMul = lerp(1, 1.30 * wS + fO * (1 - wS), solo);
              const pi1Mul = lerp(1, 1.45 * w1 + fP * (1 - w1), solo);
              const pi2Mul = lerp(1, 1.45 * w2 + fP * (1 - w2), solo);
              const spinMul = isO2x ? lerp(1, 1.60 * wM + 0.35 * (1 - wM), solo) : 1;
              return <O2BondFlow ai={o2ai} R={BOND_ABINITIO[molKey].Re * _appr}
                swirl={(BOND_ABINITIO[molKey].swirl || 0) * sceneT} third={BOND_ABINITIO[molKey].pi}
                reveal={smoothstep((1.8 - mr) / 0.5) * transitDim}
                aura={Math.max(smoothstep((1.8 - mr) / 0.5), 0.45) * transitDim}
                RLag1={BOND_ABINITIO[molKey].Re * mrL1} RLag2={BOND_ABINITIO[molKey].Re * mrL2} ghost={ghost}
                piSplit={piSplit} sigmaMul={sigmaMul} pi1Mul={pi1Mul} pi2Mul={pi2Mul} spinMul={spinMul} boost={BOND_ABINITIO[molKey].boost ?? 1} piColors={BOND_ABINITIO[molKey].piColors ?? null} />;
            })()}
            {/* O₂ PARAMAGNÉTICO: campo DIPOLAR real de los 2 e⁻ π* desapareados (μ=2).
                El oxígeno es de los poquísimos gases magnéticos — el O₂ líquido se cuelga
                de un imán. Aparece al asentarse el enlace (los π* ya viven) y brilla en el
                héroe. Líneas r=L·sin²θ, brillo ∝ |B|. Es física, no adorno. */}
            {isBond(molKey) && BOND_ABINITIO[molKey].mu > 0 && (
              <MagneticField mu={BOND_ABINITIO[molKey].mu} time={time} radius={frame.ex * 0.42}
                op={Math.min(0.82, (smoothstep((time - 11.7) / 1.5) * (1 - smoothstep((time - 27.5) / 1.5))
                  + smoothstep((time - 54.5) / 2.0)) * 0.82)} />
            )}
            {/* F₂: las GUÍAS de la repulsión — líneas de fuerza del campo de dos cargas
                iguales (integración numérica real) durante el acto medio. El muro que
                debilita el enlace, visible; etiquetadas en el caption de 31s. */}
            {molKey === 'f2' && <RepulsionField nx={BOND_ABINITIO.f2.Re / 2} time={time} />}
            {/* cilindro de enlace para OTRAS moléculas; en O₂ el PUENTE de densidad ES el enlace */}
            {!isBond(molKey) && formed > 0.05 && data.bonds.map(([i, j], k) => (
              <Bond key={k} a={animPos[i]} b={animPos[j]} time={time} />
            ))}
            {/* CAMPO eléctrico como PLASMA volumétrico — moléculas POLARES (dipolo).
                Los alcanos son apolares (sin campo); las cadenas CONJUGADAS llevan
                el campo de CARAS π (MEP real, no dipolo inventado). */}
            {!isChain && !isCatalog && !isDNA && !isBond(molKey) && <PlasmaField nuclei={data.nuclei} time={time} />}
            {/* O₂ paramagnético: el imán NO se dibuja con anillos (eso era HUD falso) —
                EMERGE de la densidad real de los π* (los lóbulos violeta = los 2 e⁻
                desapareados). La física lo muestra sola. */}
            {isChain && !isCaro && <ChainField frame={frame} time={time} alkane={!CONJUGATED_KEYS.has(molKey)} />}
            {isCatalog && catField === 'pi' && <ChainField frame={frame} time={time} alkane={false} />}
            {isCatalog && catField === 'sigma' && <ChainField frame={frame} time={time} alkane={true} />}
          </>;
        })()}
        {/* live: sin EffectComposer (HDR-float+MSAA revienta a blanco en GPUs
            diversas). flat={!live} → tonemap ACES del renderer. PostFX solo headless. */}
        {!live && <MolPostFX />}
      </Canvas>
      <CinemaVignette />
      {!live && <>
        {!isCaro && !(isBond(molKey) && (BOND_BEATS_MOL[molKey] ?? []).some(b => time >= b.t0 - 0.4 && time <= b.t1 + 0.5)) &&
          <ScaleNote molKey={molKey} time={time} vertical={vertical} />}
        {isDNA && <AudioNote time={time} vertical={vertical} />}
        <ModeLabel modes={modes} time={time} vertical={vertical} />
        {!isCaro && <FieldLabel molKey={molKey} polar={isChain || (isCatalog && catField !== 'none') || (!isCatalog && !isDNA && !!data && partialCharges(data.nuclei).some(v => Math.abs(v) > 0.05))} time={time} vertical={vertical} />}
        {!isCaro && <MoleculeTitle mkey={molKey} time={time} vertical={vertical} />}
        {isBond(molKey) && <BondExplainer time={time} vertical={vertical} mol={molKey} />}
        <Letterbox vertical={vertical} />
      </>}
    </div>
  );
}

export default memo(CinematicMoleculeInner);
