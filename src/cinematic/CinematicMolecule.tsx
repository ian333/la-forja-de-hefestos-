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
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, BrightnessContrast, HueSaturation, ToneMapping, Noise } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { elementByZ } from '@/lib/chem/quantum/periodic-table';
import { nucleusInfo } from '@/lib/chem/quantum/atom-builder';
import { vibrationalAnalysis, FF_H2O } from '@/lib/chem/quantum/vibrations';
import {
  Nucleus, ElectronCloud, FrameDriver, Letterbox, CinemaVignette, smoothstep, type AtomBundle,
} from './CinematicAtom';
import { CATALOG_KEYS, CATALOG_FIELD, CATALOG_FIELD_SUB, CATALOG_META, CATALOG_SCALE } from './catalog-data';

const DURATION = 22;   // más largo: la escena RESPIRA (cámara lenta y lejana)
type Vec3 = [number, number, number];

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function sph(dist: number, elev: number, azim: number): Vec3 {
  return [dist * Math.cos(elev) * Math.cos(azim), dist * Math.sin(elev), dist * Math.cos(elev) * Math.sin(azim)];
}

// ── helpers vectoriales para el marco principal de la molécula ──
const crossV = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normV = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Marco geométrico de la molécula: eje principal (a) + plano perpendicular (p1,p2),
// centroide (c), semilongitud (L) y radio perpendicular (Rp). `chain` = la molécula
// es ALARGADA (cadena) → la cámara la ATRAVIESA en vez de orbitarla.
interface Frame { ex: number; chain: boolean; L: number; Rp: number; a: Vec3; p1: Vec3; p2: Vec3; c: Vec3; planeN: Vec3; dna?: boolean; }

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
function molCamera(t: number, f: Frame): Shot {
  if (f.dna) return dnaCamera(t, f);
  const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
  const P = (s: number, o1: number, o2: number): Vec3 => [
    f.c[0] + f.a[0] * s + f.p1[0] * o1 + f.p2[0] * o2,
    f.c[1] + f.a[1] * s + f.p1[1] * o1 + f.p2[1] * o2,
    f.c[2] + f.a[2] * s + f.p1[2] * o1 + f.p2[2] * o2];

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

  // ORBIT LENTO — compactas. Entra desde lejos (molécula COMPLETA), contempla con
  // calma, órbita lenta con peso, asienta. Respira. Cámara afuera (~2.3× extent).
  const ex = f.ex;
  const bx = Math.sin(t * 0.4) * 0.014 + Math.sin(t * 0.73) * 0.006;   // respiro suave (handheld lento)
  let dist: number, azim: number, elev: number, fov: number, roll: number;
  if (t < 4.5) {                                    // ENTRA — empuje LENTO desde lejos
    const k = ease(t / 4.5);
    dist = ex * lerp(2.7, 2.25, k); azim = 0.2 + k * 0.5; elev = lerp(0.04, 0.16, k); fov = lerp(35, 33, k); roll = 0.04 * Math.sin(t * 0.5);
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

// ── PostFX de molécula — grado de cine (ACES, grano, contraste, lente). El
// bokeh lo hace el shader de la nube (uBokeh), no aquí. ──
function MolPostFX({ live = false }: { live?: boolean }) {
  // MSAA=0 en live: el combo multisampling + render target HDR-float revienta el
  // postFX a blanco en muchas GPUs (Intel, ANGLE, software) aunque la GPU de dev
  // lo renderee bien. Headless 4K (live=false) conserva MSAA=4. HDR buffer explícito.
  return (
    <EffectComposer multisampling={live ? 0 : 4} frameBufferType={THREE.HalfFloatType}>
      <Bloom intensity={0.9} luminanceThreshold={0.22} luminanceSmoothing={0.5} radius={0.82} mipmapBlur />
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
    return () => { alive = false; };
  }, [molKey, isChain, isCatalog, isDNA, live]);

  // Marco geométrico (eje principal, elongación) → decide orbit vs traversal.
  const frame = useMemo<Frame>(() => ({ ...frameFromNuclei(data?.nuclei ?? [], data?.extent ?? 8), dna: isDNA }), [data, isDNA]);

  const dur = isDNA ? DNA_DURATION : DURATION;

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
        flat
        onCreated={({ gl }) => { glRef.current = gl; }}
        camera={{ position: [0, 0, (data?.extent ?? 8) * 0.5], fov: 35, near: 0.01, far: 400 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]} frameloop="always" style={{ background: '#000' }}
      >
        <color attach="background" args={['#000']} />
        <FrameDriver time={time} />
        {data && (() => {
          const animPos = animatedNuclei(data.nuclei.map(n => n.pos), modes, time);
          return <>
            <MolCameraRig frame={frame} time={time} vertical={vertical} />
            {data.nuclei.map((nuc, i) => (
              <group key={i} position={animPos[i]}>
                <Nucleus protons={nuc.protons} neutrons={nuc.neutrons} time={time}
                  clusterRadius={0.022 + 0.009 * Math.cbrt(nuc.protons + nuc.neutrons)} />
              </group>
            ))}
            {/* nube con BOKEH (cámara acotada) y SIN rotación global (alineada a los núcleos) */}
            <ElectronCloud bundle={data.bundle} time={time} holeRadius={0.04}
              bokeh={0.8 / Math.max(1, data.extent)} rotRate={0} />
            {data.bonds.map(([i, j], k) => (
              <Bond key={k} a={animPos[i]} b={animPos[j]} time={time} />
            ))}
            {/* CAMPO eléctrico como PLASMA volumétrico — moléculas POLARES (dipolo).
                Los alcanos son apolares (sin campo); las cadenas CONJUGADAS llevan
                el campo de CARAS π (MEP real, no dipolo inventado). */}
            {!isChain && !isCatalog && !isDNA && <PlasmaField nuclei={data.nuclei} time={time} />}
            {isChain && <ChainField frame={frame} time={time} alkane={!CONJUGATED_KEYS.has(molKey)} />}
            {isCatalog && catField === 'pi' && <ChainField frame={frame} time={time} alkane={false} />}
            {isCatalog && catField === 'sigma' && <ChainField frame={frame} time={time} alkane={true} />}
          </>;
        })()}
        <MolPostFX live={live} />
      </Canvas>
      <CinemaVignette />
      {!live && <>
        <ScaleNote molKey={molKey} time={time} vertical={vertical} />
        {isDNA && <AudioNote time={time} vertical={vertical} />}
        <ModeLabel modes={modes} time={time} vertical={vertical} />
        <FieldLabel molKey={molKey} polar={isChain || (isCatalog && catField !== 'none') || (!isCatalog && !isDNA && !!data && partialCharges(data.nuclei).some(v => Math.abs(v) > 0.05))} time={time} vertical={vertical} />
        <MoleculeTitle mkey={molKey} time={time} vertical={vertical} />
        <Letterbox vertical={vertical} />
      </>}
    </div>
  );
}

export default memo(CinematicMoleculeInner);
