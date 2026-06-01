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

const DURATION = 16;
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
interface Frame { ex: number; chain: boolean; L: number; Rp: number; a: Vec3; p1: Vec3; p2: Vec3; c: Vec3; }

function frameFromNuclei(nuclei: { pos: Vec3 }[], ex: number): Frame {
  const base: Frame = { ex, chain: false, L: ex, Rp: ex * 0.4, a: [1, 0, 0], p1: [0, 1, 0], p2: [0, 0, 1], c: [0, 0, 0] };
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
  let L = 0, Rp = 0;
  nuclei.forEach(n => { const dx = n.pos[0] - c[0], dy = n.pos[1] - c[1], dz = n.pos[2] - c[2];
    const s = Math.abs(dx * a[0] + dy * a[1] + dz * a[2]); const perp = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - s * s));
    L = Math.max(L, s); Rp = Math.max(Rp, perp); });
  const elong = L / Math.max(Rp, 1e-3);
  return { ex, chain: nuclei.length >= 6 && elong > 2.2, L: L || ex, Rp: Rp || ex * 0.3, a, p1, p2, c };
}

interface Shot { pos: Vec3; fov: number; target: Vec3; roll: number; }

// ── Cámara de molécula. Dos modos:
//   COMPACTA → orbit VIOLENTO: embiste, gira duro con banking, órbita rápida, asienta.
//   CADENA   → TRAVERSAL: entra por un extremo, ATRAVIESA el esqueleto tejiendo con
//              roll, sale por el otro extremo y se abre a la vista lateral heroica.
function molCamera(t: number, f: Frame): Shot {
  const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
  const P = (s: number, o1: number, o2: number): Vec3 => [
    f.c[0] + f.a[0] * s + f.p1[0] * o1 + f.p2[0] * o2,
    f.c[1] + f.a[1] * s + f.p1[1] * o1 + f.p2[1] * o2,
    f.c[2] + f.a[2] * s + f.p1[2] * o1 + f.p2[2] * o2];

  if (f.chain) {
    // DOLLY AL COSTADO: la cámara viaja a lo largo de la cadena a un standoff
    // perpendicular (FUERA de la densidad) y ORBITA, así la cadena pasa de lado
    // como una cuerda luminosa — sin mirar "por el barril" (eso apila densidad a
    // blanco). Violenta por la órbita rápida + banking.
    const L = Math.max(f.L, 0.6), Rp = Math.max(f.Rp, 0.6);
    const stand = Math.max(Rp * 2.7, L * 0.55);
    if (t < 3.0) {                                  // ABRE — entra desde un extremo hacia el costado
      const k = ease(t / 3.0);
      const s = lerp(-L * 1.25, -L * 0.85, k), off = lerp(stand * 1.6, stand, k), ph = 0.4 + k * 0.7;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: lerp(46, 40, k),
        target: P(s * 0.55, 0, 0), roll: 0.10 * Math.sin(t * 1.2) };
    } else if (t < 9.0) {                            // VIAJA — dolly a lo largo + órbita (pasa de lado)
      const k = ease((t - 3.0) / 6.0);
      const s = lerp(-L * 0.9, L * 0.9, k);
      const off = stand * (1.0 + 0.14 * Math.sin(k * Math.PI * 2.0)), ph = 0.8 + k * 4.2;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: 40,
        target: P(s + L * 0.18, 0, 0), roll: 0.24 * Math.sin(k * Math.PI * 3.0) };
    } else if (t < 13.0) {                           // REVELA — se abre a la vista completa lateral (héroe)
      const k = ease((t - 9.0) / 4.0);
      const s = lerp(L * 0.9, 0, k), off = lerp(stand, Math.max(L * 1.8, stand * 1.9), k), ph = 0.6 + k * 1.2;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: lerp(40, 34, k), target: f.c, roll: lerp(0.16, 0.0, k) };
    } else {                                         // ASIENTA — órbita lenta 3/4
      const k = ease((t - 13.0) / 3.0), off = Math.max(L * 1.8, stand * 1.9), ph = 1.7 + k * 0.6;
      return { pos: P(lerp(0, -L * 0.18, k), Math.cos(ph) * off, Math.sin(ph) * off), fov: 34, target: f.c, roll: 0 };
    }
  }

  // ORBIT VIOLENTO — compactas. Embiste bajo, gira con banking, órbita rápida.
  const ex = f.ex;
  const bx = Math.sin(t * 1.05) * 0.02 + Math.sin(t * 2.3) * 0.009;
  let dist: number, azim: number, elev: number, fov: number, roll: number;
  if (t < 3.0) {                                    // EMBISTE — push-in rápido y bajo
    const k = ease(t / 3.0);
    dist = ex * lerp(0.66, 0.30, k); azim = 0.1 + k * 1.2; elev = lerp(-0.06, 0.18, k); fov = lerp(58, 40, k); roll = 0.12 * Math.sin(t * 1.7);
  } else if (t < 7.5) {                             // GIRA DURO — barrido amplio con banking
    const k = ease((t - 3.0) / 4.5);
    dist = ex * lerp(0.30, 0.52, k); azim = 1.3 + k * 3.1; elev = 0.18 + Math.sin(k * Math.PI) * 0.52; fov = 40; roll = 0.30 * Math.sin((t - 3.0) * 0.9);
  } else if (t < 12.0) {                            // ÓRBITA RÁPIDA — con peso, contempla
    const k = ease((t - 7.5) / 4.5);
    dist = ex * lerp(0.52, 0.46, k); azim = 4.4 + k * 2.5; elev = 0.66 - Math.sin((t - 7.5) * 0.6) * 0.24; fov = 38; roll = 0.14 * Math.sin((t - 7.5) * 0.7);
  } else {                                          // ASIENTA — héroe
    const k = ease((t - 12.0) / 4.0);
    dist = ex * lerp(0.46, 0.50, k); azim = 6.9 + k * 0.5; elev = lerp(0.44, 0.30, k); fov = 37; roll = lerp(0.1, 0, k);
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
function MolPostFX() {
  return (
    <EffectComposer multisampling={4}>
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
  const all = t >= 12.5 ? smoothstep((t - 12.5) / 0.6) : 0;
  return [
    Math.max(bump(3.5, 6.4), all * 0.7),
    Math.max(bump(6.4, 9.3), all * 0.7),
    Math.max(bump(9.3, 12.2), all * 0.7),
  ];
}

interface Nuc { pos: Vec3; protons: number; neutrons: number; }
interface MolData { bundle: AtomBundle; nuclei: Nuc[]; extent: number; bonds: [number, number][]; }

const META: Record<string, { name: string; formula: string; fact: string }> = {
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
  hexane:       { name: 'Hexano', formula: 'C₆H₁₄', fact: 'El esqueleto del carbono: enlaces σ a 109.5°.' },
  octane:       { name: 'Octano', formula: 'C₈H₁₈', fact: 'Ocho carbones en cadena: la energía de la gasolina.' },
  decane:       { name: 'Decano', formula: 'C₁₀H₂₂', fact: 'Diez eslabones de carbono, puro enlace σ.' },
  hexatriene:   { name: 'Hexatrieno', formula: 'C₆H₈', fact: 'Tres dobles enlaces conjugados: los electrones π se sueltan.' },
  decapentaene: { name: 'Decapentaeno', formula: 'C₁₀H₁₂', fact: 'Cinco dobles en fila: un río de electrones π.' },
  caroteno:     { name: 'Caroteno (cromóforo)', formula: 'cadena π', fact: 'La cadena conjugada que pinta la zanahoria — y la que te deja VER.' },
};

// Cadenas: se cargan de chain-<key>.bin y disparan la cámara TRAVERSAL.
const CHAIN_KEYS = new Set(['butane', 'hexane', 'octane', 'decane', 'hexatriene', 'decapentaene', 'caroteno']);

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
  const opacity = Math.min(1, Math.max(0, (time - 2.2) / 0.8)) * Math.min(1, Math.max(0, (15.4 - time) / 0.6));
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

// Etiqueta del modo vibracional activo — "se entiende qué vibra con qué".
function ModeLabel({ modes, time, vertical }: { modes: VibMode[] | null; time: number; vertical: boolean }) {
  if (!modes) return null;
  if (time > 8.7 && time < 12.4) return null;     // cede el lugar a la etiqueta del campo
  const amps = modeAmps(time);
  let active = -1, best = 0.12;
  for (let i = 0; i < amps.length; i++) if (amps[i] > best) { best = amps[i]; active = i; }
  const allMode = time >= 12.5;
  let label = '', sub = '';
  if (allMode) { label = 'Los tres modos a la vez'; sub = 'así vibra el agua real'; }
  else if (active >= 0) { label = modes[active].label; sub = `${modes[active].wavenumber} cm⁻¹`; }
  else return null;
  const opacity = allMode ? smoothstep((time - 12.6) / 0.5) : smoothstep(best / 0.3);
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
const FIELD_SUB: Record<string, string> = {
  h2o: 'por esto el agua disuelve todo',
  hcl: 'el cloro jala los electrones',
  hf: 'el enlace más polar que hay',
  nacl: 'casi un ion: un lado + y otro −',
  co: 'un dipolo sutil e invertido',
  nh3: 'el par libre la vuelve polar',
  co2: 'cada enlace es polar (pero se cancelan)',
};
function FieldLabel({ molKey, polar, time, vertical }: { molKey: string; polar: boolean; time: number; vertical: boolean }) {
  if (!polar) return null;
  const opacity = smoothstep((time - 8.7) / 0.7) * Math.min(1, Math.max(0, (12.3 - time) / 0.6));
  if (opacity < 0.01) return null;
  const sub = FIELD_SUB[molKey] ?? 'esta molécula es polar';
  return (
    <div style={{
      position: 'absolute', top: vertical ? '11%' : '10%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontWeight: 300, color: 'rgba(255,255,255,0.96)',
        fontSize: vertical ? '5.4vw' : '2vw', lineHeight: 1.2,
        textShadow: '0 2px 30px rgba(0,0,0,0.9)' }}>El campo electrostático</div>
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
    matRef.current.uniforms.uOpacity.value = smoothstep((time - 8.0) / 1.8) * 0.92;
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

function CinematicMoleculeInner({ molKey }: { molKey: string }) {
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

  // Cargar la nube precomputada (cadenas → chain-<key>.bin)
  useEffect(() => {
    let alive = true;
    fetch(`/precomputed/${isChain ? 'chain' : 'mol'}-${molKey}.bin`)
      .then(r => r.arrayBuffer())
      .then(buf => { if (alive) setData(parseBin(buf)); })
      .catch(e => console.error('mol load failed', e));
    return () => { alive = false; };
  }, [molKey, isChain]);

  // Marco geométrico (eje principal, elongación) → decide orbit vs traversal.
  const frame = useMemo<Frame>(() => frameFromNuclei(data?.nuclei ?? [], data?.extent ?? 8), [data]);

  // API determinista — ready solo cuando la nube cargó
  useEffect(() => {
    const api = {
      renderAt: (t: number) => setTime(Math.max(0, Math.min(DURATION, t))),
      ready: !!data, duration: DURATION, molecule: molKey,
    };
    (window as unknown as { __cinematicAtom: typeof api }).__cinematicAtom = api;
    return () => { delete (window as unknown as { __cinematicAtom?: unknown }).__cinematicAtom; };
  }, [molKey, data]);

  void tv;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        flat
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
            {/* CAMPO eléctrico como PLASMA volumétrico — solo en moléculas POLARES
                (las cadenas de hidrocarburo son apolares: no hay campo dipolar). */}
            {!isChain && <PlasmaField nuclei={data.nuclei} time={time} />}
          </>;
        })()}
        <MolPostFX />
      </Canvas>
      <CinemaVignette />
      <ModeLabel modes={modes} time={time} vertical={vertical} />
      <FieldLabel molKey={molKey} polar={!isChain && !!data && partialCharges(data.nuclei).some(v => Math.abs(v) > 0.05)} time={time} vertical={vertical} />
      <MoleculeTitle mkey={molKey} time={time} vertical={vertical} />
      <Letterbox vertical={vertical} />
    </div>
  );
}

export default memo(CinematicMoleculeInner);
