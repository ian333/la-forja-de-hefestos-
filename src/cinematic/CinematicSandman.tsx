/**
 * CinematicSandman v2 — LLUVIA-DEPOSICIÓN sobre figura riggeada (serie ECONOMÍA).
 *
 * La vara es el O2: polvo caliente (Planck) → ESTRUCTURA → nudo blanco. v2 sube
 * el detalle y la física de formación:
 *
 *  - FIGURA: mesh humano riggeado (Mixamo, 7.4k verts) muestreado EN SUPERFICIE
 *    con skinning CPU por frame → la figura tiene ropa/manos/cara y RESPIRA con
 *    la animación Idle. Producción fácil: cambiar GLB+clip = nuevo personaje.
 *  - FORMACIÓN: LLUVIA de granos con balística real (slow-mo de g, reloj de
 *    cámara). Cada grano cae desde el cielo, aterriza en SU punto del contorno
 *    (orden pies→cabeza, como arena llenando un molde invisible), FLASHEA al
 *    impacto y queda pegado siguiendo el skinning. 15k granos extra fallan y
 *    salpican el piso — la lluvia se VE caer.
 *  - SÁBANA: tela Verlet (240 Hz, strain-limit, colisión contra cápsulas de
 *    HUESOS) colgada del hueso de la mano derecha; una ráfaga del vórtice la
 *    hace ondear a mitad del clip.
 *  - COLOR: doctrina A1 (Planck por radio en el polvo libre, ámbar→blanco al
 *    condensar, cyan pálido para la tela, nudo blanco en la mano).
 *
 * Tiempo determinista: window.__cinematicAtom.renderAt(t) ∈ [0, 10].
 * (mixer.setTime(t) es puro; toda la lluvia es balística cerrada en t.)
 */
import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, BrightnessContrast, HueSaturation, ToneMapping, Noise } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { FrameDriver } from './CinematicAtom';

export const SANDMAN_DURATION = 10;
const RIG_URL = '/models/library/people/human-rigged.glb';
const CLIP_NAME = 'Idle';

type Vec3 = [number, number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
const sstep = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── DOCTRINA-COLOR A1: rampa Planck T→sRGB ──
const BB_ANCHORS: [number, [number, number, number]][] = [
  [1000, [1.00, 0.22, 0.00]], [1900, [1.00, 0.54, 0.07]], [2700, [1.00, 0.62, 0.36]],
  [3500, [1.00, 0.76, 0.55]], [4500, [1.00, 0.85, 0.72]], [5500, [1.00, 0.95, 0.94]],
  [6500, [1.00, 1.00, 1.00]], [8000, [0.89, 0.91, 1.00]], [10000, [0.80, 0.85, 1.00]],
  [15000, [0.72, 0.79, 1.00]],
];
function blackbodyRGB(T: number): [number, number, number] {
  if (T <= BB_ANCHORS[0][0]) return BB_ANCHORS[0][1];
  for (let i = 1; i < BB_ANCHORS.length; i++) {
    if (T <= BB_ANCHORS[i][0]) {
      const [t0, c0] = BB_ANCHORS[i - 1], [t1, c1] = BB_ANCHORS[i];
      const f = (T - t0) / (t1 - t0);
      return [lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)];
    }
  }
  return BB_ANCHORS[BB_ANCHORS.length - 1][1];
}
const CYAN: [number, number, number] = [0.42, 0.85, 1.0];
const WHITE_WARM: [number, number, number] = [1.0, 0.97, 0.90];

// ── VÓRTICE DE RANKINE (ambiente + viento de la tela) ──
const VORTEX = { rc: 0.85, omega: 1.9, w0: 0.34, sigma: 1.4, yWrap: 2.5 };
function vortexOmega(r: number): number {
  return r < VORTEX.rc ? VORTEX.omega : VORTEX.omega * Math.pow(VORTEX.rc / r, 1.6);
}
function vortexUpdraft(r: number): number {
  return VORTEX.w0 * Math.exp(-(r * r) / (VORTEX.sigma * VORTEX.sigma)) + 0.06;
}
// ráfaga: sube a mitad del clip → la capa ONDEA (drama del acto 3)
function gustAmp(t: number): number {
  return 1 + 1.7 * sstep((t - 4.2) / 1.5) * (0.55 + 0.45 * Math.sin(1.3 * (t - 4.2)));
}
function vortexVel(x: number, y: number, z: number, t: number, out: Vec3) {
  const r = Math.hypot(x, z) + 1e-4;
  const om = vortexOmega(r);
  const g = gustAmp(t);
  out[0] = -z * om; out[2] = x * om;
  out[1] = vortexUpdraft(r);
  out[0] += (0.22 * Math.sin(0.9 * t + y * 1.7) + 0.12 * Math.sin(1.7 * t + z * 2.3)) * g;
  out[2] += (0.20 * Math.sin(1.1 * t + x * 2.1 + 1.7)) * g;
  out[1] *= 0.6 + 0.4 * g;
}

// ═══ RIG — carga, normalización, muestreo de superficie, paths de huesos ═══
const BONE_NAMES = [
  'mixamorig:Hips', 'mixamorig:Spine2', 'mixamorig:Head',
  'mixamorig:LeftUpLeg', 'mixamorig:LeftLeg', 'mixamorig:LeftFoot',
  'mixamorig:RightUpLeg', 'mixamorig:RightLeg', 'mixamorig:RightFoot',
  'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand',
  'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand',
];
const B = (n: string) => BONE_NAMES.indexOf(n);
// colisionadores de la tela: cápsulas [huesoA, huesoB, radio]
const COLLIDERS: [number, number, number][] = [
  [B('mixamorig:Hips'), B('mixamorig:Spine2'), 0.16],
  [B('mixamorig:Spine2'), B('mixamorig:Head'), 0.12],
  [B('mixamorig:LeftUpLeg'), B('mixamorig:LeftLeg'), 0.085],
  [B('mixamorig:LeftLeg'), B('mixamorig:LeftFoot'), 0.06],
  [B('mixamorig:RightUpLeg'), B('mixamorig:RightLeg'), 0.085],
  [B('mixamorig:RightLeg'), B('mixamorig:RightFoot'), 0.06],
  [B('mixamorig:LeftArm'), B('mixamorig:LeftForeArm'), 0.055],
  [B('mixamorig:LeftForeArm'), B('mixamorig:LeftHand'), 0.05],
  [B('mixamorig:RightArm'), B('mixamorig:RightForeArm'), 0.055],
  [B('mixamorig:RightForeArm'), B('mixamorig:RightHand'), 0.05],
];
const HAND = B('mixamorig:RightHand');
const CHEST = B('mixamorig:Spine2');
const PATH_FPS = 60;

const NP = 130_000;      // granos de la figura
const RAIN_N = 15_000;   // granos que FALLAN (la lluvia visible que salpica)

interface Rig {
  root: THREE.Object3D;
  meshes: THREE.SkinnedMesh[];
  mixer: THREE.AnimationMixer;
  nVerts: number;
  vertOff: number[];             // offset de vértice por mesh (concatenado)
  skinned: Float32Array;         // nVerts*3 — posiciones skineadas MUNDO (frame actual)
  lastSkinT: number;
  // muestras de superficie (por partícula): 3 índices de vértice + barycentrics
  ia: Uint32Array; ib: Uint32Array; ic: Uint32Array;
  wa: Float32Array; wb: Float32Array; wc: Float32Array;
  restY: Float32Array;           // y de la muestra en t=0 (ordena la lluvia pies→cabeza)
  bonePath: Float32Array;        // K * NB * 3 — paths de huesos a 60 Hz (mundo)
  pathK: number;
  cloth: { frames: Float32Array; K: number; N: number };
}

function boneAt(rig: Rig, bone: number, t: number, out: Vec3) {
  const tc = Math.max(0, Math.min(t, (rig.pathK - 1) / PATH_FPS));
  const k = Math.min(rig.pathK - 2, Math.floor(tc * PATH_FPS));
  const f = tc * PATH_FPS - k;
  const NB = BONE_NAMES.length;
  const o0 = (k * NB + bone) * 3, o1 = ((k + 1) * NB + bone) * 3;
  out[0] = rig.bonePath[o0] * (1 - f) + rig.bonePath[o1] * f;
  out[1] = rig.bonePath[o0 + 1] * (1 - f) + rig.bonePath[o1 + 1] * f;
  out[2] = rig.bonePath[o0 + 2] * (1 - f) + rig.bonePath[o1 + 2] * f;
}

// skinning CPU de TODOS los vértices al tiempo actual del mixer (mundo)
function skinAll(rig: Rig) {
  const v = new THREE.Vector3();
  let off = 0;
  for (const mesh of rig.meshes) {
    const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
    mesh.skeleton.update();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      mesh.applyBoneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld);
      const o = (off + i) * 3;
      rig.skinned[o] = v.x; rig.skinned[o + 1] = v.y; rig.skinned[o + 2] = v.z;
    }
    off += posAttr.count;
  }
}
function setRigTime(rig: Rig, t: number) {
  if (rig.lastSkinT === t) return;
  rig.mixer.setTime(t);
  rig.root.updateMatrixWorld(true);
  skinAll(rig);
  rig.lastSkinT = t;
}
function sampleAt(rig: Rig, i: number, out: Vec3) {
  const a3 = rig.ia[i] * 3, b3 = rig.ib[i] * 3, c3 = rig.ic[i] * 3;
  const wa = rig.wa[i], wb = rig.wb[i], wc = rig.wc[i];
  const S = rig.skinned;
  out[0] = S[a3] * wa + S[b3] * wb + S[c3] * wc;
  out[1] = S[a3 + 1] * wa + S[b3 + 1] * wb + S[c3 + 1] * wc;
  out[2] = S[a3 + 2] * wa + S[b3 + 2] * wb + S[c3 + 2] * wc;
}

async function loadRig(): Promise<Rig> {
  const gltf = await new GLTFLoader().loadAsync(RIG_URL);
  const root = gltf.scene;
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh); });
  root.traverse(o => { o.visible = true; });   // el mesh NO se dibuja (no lo montamos), solo se muestrea
  const mixer = new THREE.AnimationMixer(root);
  const clip = gltf.animations.find(a => a.name === CLIP_NAME) ?? gltf.animations[0];
  mixer.clipAction(clip).play();

  const vertOff: number[] = []; let nVerts = 0;
  for (const m of meshes) { vertOff.push(nVerts); nVerts += (m.geometry.attributes.position as THREE.BufferAttribute).count; }

  const rig: Rig = {
    root, meshes, mixer, nVerts, vertOff,
    skinned: new Float32Array(nVerts * 3), lastSkinT: -1,
    ia: new Uint32Array(NP), ib: new Uint32Array(NP), ic: new Uint32Array(NP),
    wa: new Float32Array(NP), wb: new Float32Array(NP), wc: new Float32Array(NP),
    restY: new Float32Array(NP),
    bonePath: new Float32Array(0), pathK: 0,
    cloth: { frames: new Float32Array(0), K: 0, N: 0 },
  };

  // ── normaliza: pies al piso, centro XZ, altura 1.8 m ──
  setRigTime(rig, 0);
  let minY = 1e9, maxY = -1e9, cx = 0, cz = 0;
  for (let i = 0; i < nVerts; i++) {
    const y = rig.skinned[i * 3 + 1];
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    cx += rig.skinned[i * 3]; cz += rig.skinned[i * 3 + 2];
  }
  cx /= nVerts; cz /= nVerts;
  const s = 1.8 / Math.max(0.5, maxY - minY);
  root.scale.setScalar(s);
  root.position.set(-cx * s, -minY * s, -cz * s);
  root.rotation.y = 0.45;   // 3/4 hacia la cámara de apertura
  rig.lastSkinT = -1;
  setRigTime(rig, 0);

  // ── muestreo de superficie ponderado por ÁREA (semilla fija → determinista) ──
  const rnd = mulberry32(20260702);
  interface Tri { a: number; b: number; c: number; cum: number; }
  const tris: Tri[] = [];
  let acc = 0;
  for (let mi = 0; mi < meshes.length; mi++) {
    const g = meshes[mi].geometry;
    const idx = g.index as THREE.BufferAttribute;
    const off = vertOff[mi];
    const S = rig.skinned;
    for (let f = 0; f < idx.count; f += 3) {
      const a = off + idx.getX(f), b = off + idx.getX(f + 1), c = off + idx.getX(f + 2);
      const ax = S[a * 3], ay = S[a * 3 + 1], az = S[a * 3 + 2];
      const abx = S[b * 3] - ax, aby = S[b * 3 + 1] - ay, abz = S[b * 3 + 2] - az;
      const acx = S[c * 3] - ax, acy = S[c * 3 + 1] - ay, acz = S[c * 3 + 2] - az;
      const crx = aby * acz - abz * acy, cry = abz * acx - abx * acz, crz = abx * acy - aby * acx;
      const area = 0.5 * Math.hypot(crx, cry, crz);
      if (area > 1e-9) { acc += area; tris.push({ a, b, c, cum: acc }); }
    }
  }
  const totA = acc;
  const smp: Vec3 = [0, 0, 0];
  for (let i = 0; i < NP; i++) {
    // búsqueda binaria del triángulo por área acumulada
    const target = rnd() * totA;
    let lo = 0, hi = tris.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid].cum < target) lo = mid + 1; else hi = mid; }
    const tr = tris[lo];
    // barycentric uniforme (sqrt trick)
    const r1 = Math.sqrt(rnd()), r2 = rnd();
    rig.ia[i] = tr.a; rig.ib[i] = tr.b; rig.ic[i] = tr.c;
    rig.wa[i] = 1 - r1; rig.wb[i] = r1 * (1 - r2); rig.wc[i] = r1 * r2;
    sampleAt(rig, i, smp);
    rig.restY[i] = smp[1];
  }

  // ── paths de huesos a 60 Hz (para tela + nudo + corazón) ──
  const K = Math.floor(SANDMAN_DURATION * PATH_FPS) + 2;
  const NB = BONE_NAMES.length;
  rig.bonePath = new Float32Array(K * NB * 3);
  rig.pathK = K;
  const bones: (THREE.Object3D | null)[] = BONE_NAMES.map(n => {
    let found: THREE.Object3D | null = null;
    root.traverse(o => { if (o.name === n) found = o; });
    return found;
  });
  const wp = new THREE.Vector3();
  for (let k = 0; k < K; k++) {
    rig.lastSkinT = -1;
    rig.mixer.setTime(k / PATH_FPS);
    root.updateMatrixWorld(true);
    for (let bi = 0; bi < NB; bi++) {
      const bn = bones[bi];
      if (bn) { bn.getWorldPosition(wp); } else { wp.set(0, 1, 0); }
      const o = (k * NB + bi) * 3;
      rig.bonePath[o] = wp.x; rig.bonePath[o + 1] = wp.y; rig.bonePath[o + 2] = wp.z;
    }
  }
  rig.lastSkinT = -1;
  setRigTime(rig, 0);

  // ── tela precomputada, colgada del HUESO de la mano ──
  rig.cloth = simulateCloth(rig);
  return rig;
}

// ═══ SÁBANA — Verlet 240 Hz + strain-limit + colisión contra huesos ═══
// 1.35×0.95 m: colgada de la mano (~0.85 m) apenas roza el piso — la ráfaga la
// puede LEVANTAR entera (con 1.9 m se encharcaba entre los pies)
const CLOTH = { nx: 56, ny: 36, w: 1.35, h: 0.95, t0: 2.0, fps: 60, dt: 1 / 240, damp: 0.993, iters: 8 };
function simulateCloth(rig: Rig): { frames: Float32Array; K: number; N: number } {
  const { nx, ny, w, h, t0, fps, dt, damp, iters } = CLOTH;
  const N = nx * ny, dxs = w / (nx - 1), dys = h / (ny - 1);
  const rnd = mulberry32(777001);
  const pos = new Float32Array(N * 3), prev = new Float32Array(N * 3);
  const hand: Vec3 = [0, 0, 0];
  boneAt(rig, HAND, t0, hand);
  // cuelga de la mano: eU hacia abajo-afuera, eV horizontal
  const eU: Vec3 = [0.30, -0.88, 0.36], eV: Vec3 = [-0.66, 0.0, 0.75];
  const ul = Math.hypot(...eU), vl = Math.hypot(...eV);
  eU[0] /= ul; eU[1] /= ul; eU[2] /= ul; eV[0] /= vl; eV[1] /= vl; eV[2] /= vl;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = j * nx + i;
    const wr = 0.02 * Math.sin(i * 0.9 + j * 1.3) + 0.012 * (rnd() - 0.5);
    pos[n * 3] = hand[0] + eU[0] * i * dxs + eV[0] * (j - ny / 2) * dys + wr * 0.5;
    pos[n * 3 + 1] = hand[1] + eU[1] * i * dxs + eV[1] * (j - ny / 2) * dys + wr;
    pos[n * 3 + 2] = hand[2] + eU[2] * i * dxs + eV[2] * (j - ny / 2) * dys + wr * 0.7;
  }
  prev.set(pos);
  const pinA = (Math.floor(ny / 2)) * nx, pinB = (Math.floor(ny / 2) - 1) * nx;
  const gEff = -3.4;
  const steps = Math.round((SANDMAN_DURATION - t0) / dt);
  const K = Math.floor((SANDMAN_DURATION - t0) * fps) + 1;
  const frames = new Float32Array(K * N * 3);
  const wind: Vec3 = [0, 0, 0];
  const cap = new Float32Array(COLLIDERS.length * 7);
  const bA: Vec3 = [0, 0, 0], bB: Vec3 = [0, 0, 0];
  let kf = 0;
  for (let s = 0; s <= steps; s++) {
    const tSim = t0 + s * dt;
    boneAt(rig, HAND, tSim, hand);
    // cápsulas de colisión desde los paths de huesos
    for (let c = 0; c < COLLIDERS.length; c++) {
      boneAt(rig, COLLIDERS[c][0], tSim, bA);
      boneAt(rig, COLLIDERS[c][1], tSim, bB);
      cap.set([bA[0], bA[1], bA[2], bB[0], bB[1], bB[2], COLLIDERS[c][2]], c * 7);
    }
    for (let n = 0; n < N; n++) {
      const o3 = n * 3;
      const x = pos[o3], y = pos[o3 + 1], z = pos[o3 + 2];
      vortexVel(x, y, z, tSim, wind);
      const ax2 = wind[0] * 1.5, ay2 = gEff + wind[1] * 2.1, az2 = wind[2] * 1.5;
      const nxp = x + (x - prev[o3]) * damp + ax2 * dt * dt;
      const nyp = y + (y - prev[o3 + 1]) * damp + ay2 * dt * dt;
      const nzp = z + (z - prev[o3 + 2]) * damp + az2 * dt * dt;
      prev[o3] = x; prev[o3 + 1] = y; prev[o3 + 2] = z;
      pos[o3] = nxp; pos[o3 + 1] = nyp; pos[o3 + 2] = nzp;
    }
    for (let it = 0; it < iters; it++) {
      satisfy(pos, nx, ny, dxs, dys);
      pos[pinA * 3] = hand[0]; pos[pinA * 3 + 1] = hand[1]; pos[pinA * 3 + 2] = hand[2];
      pos[pinB * 3] = hand[0] + 0.015; pos[pinB * 3 + 1] = hand[1] + 0.02; pos[pinB * 3 + 2] = hand[2];
    }
    for (let sl = 0; sl < 6; sl++) {
      strainLimit(pos, nx, ny, dxs, dys, 1.10);
      pos[pinA * 3] = hand[0]; pos[pinA * 3 + 1] = hand[1]; pos[pinA * 3 + 2] = hand[2];
      pos[pinB * 3] = hand[0] + 0.015; pos[pinB * 3 + 1] = hand[1] + 0.02; pos[pinB * 3 + 2] = hand[2];
    }
    for (let n = 0; n < N; n++) {
      const o3 = n * 3;
      if (pos[o3 + 1] < 0.02) { pos[o3 + 1] = 0.02; prev[o3] = pos[o3]; prev[o3 + 2] = pos[o3 + 2]; }
      for (let c = 0; c < COLLIDERS.length; c++) pushOutCapsule(pos, o3, cap, c);
    }
    const perKf = Math.round(1 / (fps * dt));
    if (s % perKf === 0 && kf < K) { frames.set(pos, kf * N * 3); kf++; }
  }
  return { frames, K: kf, N };
}
function satisfy(pos: Float32Array, nx: number, ny: number, dxs: number, dys: number) {
  const dDiag = Math.hypot(dxs, dys);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = j * nx + i;
    if (i + 1 < nx) relax(pos, n, n + 1, dxs);
    if (j + 1 < ny) relax(pos, n, n + nx, dys);
    if (i + 1 < nx && j + 1 < ny) relax(pos, n, n + nx + 1, dDiag);
    if (i > 0 && j + 1 < ny) relax(pos, n, n + nx - 1, dDiag);
  }
}
function strainLimit(pos: Float32Array, nx: number, ny: number, dxs: number, dys: number, maxS: number) {
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = j * nx + i;
    if (i + 1 < nx) clampEdge(pos, n, n + 1, dxs * maxS);
    if (j + 1 < ny) clampEdge(pos, n, n + nx, dys * maxS);
  }
}
function clampEdge(pos: Float32Array, a: number, b: number, dMax: number) {
  const a3 = a * 3, b3 = b * 3;
  const dx = pos[b3] - pos[a3], dy = pos[b3 + 1] - pos[a3 + 1], dz = pos[b3 + 2] - pos[a3 + 2];
  const d = Math.hypot(dx, dy, dz);
  if (d <= dMax || d < 1e-6) return;
  const f = (d - dMax) / d * 0.5;
  pos[a3] += dx * f; pos[a3 + 1] += dy * f; pos[a3 + 2] += dz * f;
  pos[b3] -= dx * f; pos[b3 + 1] -= dy * f; pos[b3 + 2] -= dz * f;
}
function relax(pos: Float32Array, a: number, b: number, rest: number) {
  const a3 = a * 3, b3 = b * 3;
  const dx = pos[b3] - pos[a3], dy = pos[b3 + 1] - pos[a3 + 1], dz = pos[b3 + 2] - pos[a3 + 2];
  const d = Math.hypot(dx, dy, dz) || 1e-6;
  const f = (d - rest) / d * 0.5;
  pos[a3] += dx * f; pos[a3 + 1] += dy * f; pos[a3 + 2] += dz * f;
  pos[b3] -= dx * f; pos[b3 + 1] -= dy * f; pos[b3 + 2] -= dz * f;
}
function pushOutCapsule(pos: Float32Array, o3: number, cap: Float32Array, c: number) {
  const o = c * 7;
  const ax = cap[o], ay = cap[o + 1], az = cap[o + 2];
  const dx = cap[o + 3] - ax, dy = cap[o + 4] - ay, dz = cap[o + 5] - az;
  const L2 = dx * dx + dy * dy + dz * dz || 1e-9;
  let t = ((pos[o3] - ax) * dx + (pos[o3 + 1] - ay) * dy + (pos[o3 + 2] - az) * dz) / L2;
  t = Math.max(0, Math.min(1, t));
  const px = ax + dx * t, py = ay + dy * t, pz = az + dz * t;
  const vx = pos[o3] - px, vy = pos[o3 + 1] - py, vz = pos[o3 + 2] - pz;
  const d = Math.hypot(vx, vy, vz);
  const rr = cap[o + 6] + 0.018;
  if (d < rr && d > 1e-6) { const f = rr / d; pos[o3] = px + vx * f; pos[o3 + 1] = py + vy * f; pos[o3 + 2] = pz + vz * f; }
}

// ═══ PISCINA DE GRANOS DE LA FIGURA (lluvia-deposición) ═══
const G_RAIN = 6.0;   // g en slow-mo (reloj cinematográfico, balística real)
interface GrainPool {
  tL: Float32Array; Tf: Float32Array;          // aterrizaje + duración de caída
  offX: Float32Array; offZ: Float32Array;      // deriva horizontal del spawn
  jx: Float32Array; jy: Float32Array; jz: Float32Array;   // jitter fino sobre la superficie
  eroAmp: Float32Array; eroPh: Float32Array; eroFr: Float32Array;
  colR: Float32Array; colG: Float32Array; colB: Float32Array; bri: Float32Array;
  sizeMul: Float32Array;
}
function buildGrainPool(rig: Rig): GrainPool {
  const rnd = mulberry32(90210);
  const P: GrainPool = {
    tL: new Float32Array(NP), Tf: new Float32Array(NP),
    offX: new Float32Array(NP), offZ: new Float32Array(NP),
    jx: new Float32Array(NP), jy: new Float32Array(NP), jz: new Float32Array(NP),
    eroAmp: new Float32Array(NP), eroPh: new Float32Array(NP), eroFr: new Float32Array(NP),
    colR: new Float32Array(NP), colG: new Float32Array(NP), colB: new Float32Array(NP), bri: new Float32Array(NP),
    sizeMul: new Float32Array(NP),
  };
  for (let i = 0; i < NP; i++) {
    const yN = Math.max(0, Math.min(1, rig.restY[i] / 1.8));
    // molde que se LLENA pies→cabeza; botas ya puestas en t=0 (in medias res)
    P.tL[i] = -0.5 + 3.6 * yN + 0.45 * rnd();
    P.Tf[i] = 0.7 + 0.5 * rnd();
    const ang = rnd() * Math.PI * 2, rr = 0.15 + 0.45 * rnd();
    P.offX[i] = Math.cos(ang) * rr; P.offZ[i] = Math.sin(ang) * rr;
    P.jx[i] = (rnd() - 0.5) * 0.02; P.jy[i] = (rnd() - 0.5) * 0.02; P.jz[i] = (rnd() - 0.5) * 0.02;
    if (rnd() < 0.28) { P.eroAmp[i] = 1; P.eroPh[i] = rnd() * Math.PI * 2; P.eroFr[i] = 0.7 + 0.5 * rnd(); }
    const T = 2100 + 2600 * rnd() * rnd();
    const [cr, cg, cb] = blackbodyRGB(T);
    P.colR[i] = cr; P.colG[i] = cg; P.colB[i] = cb;
    P.bri[i] = 0.5 + 0.9 * Math.pow(rnd(), 4);
    P.sizeMul[i] = 0.6 + 1.3 * Math.pow(rnd(), 2.5) + (rnd() < 0.03 ? 1.6 * rnd() : 0);
  }
  return P;
}

// lluvia que FALLA: granos que caen, salpican el piso y reciclan (la lluvia se VE)
interface RainPool { x: Float32Array; z: Float32Array; per: Float32Array; ph: Float32Array; c: Float32Array; b: Float32Array; }
function buildRainPool(): RainPool {
  const rnd = mulberry32(431900);
  const P: RainPool = {
    x: new Float32Array(RAIN_N), z: new Float32Array(RAIN_N),
    per: new Float32Array(RAIN_N), ph: new Float32Array(RAIN_N),
    c: new Float32Array(RAIN_N * 3), b: new Float32Array(RAIN_N),
  };
  for (let i = 0; i < RAIN_N; i++) {
    const ang = rnd() * Math.PI * 2, r = 0.15 + 1.25 * Math.sqrt(rnd());
    P.x[i] = Math.cos(ang) * r; P.z[i] = Math.sin(ang) * r;
    P.per[i] = 1.1 + 0.6 * rnd(); P.ph[i] = rnd();
    const T = 2000 + 2400 * rnd() * rnd();
    const [cr, cg, cb] = blackbodyRGB(T);
    P.c[i * 3] = cr; P.c[i * 3 + 1] = cg; P.c[i * 3 + 2] = cb;
    P.b[i] = 0.35 + 0.6 * Math.pow(rnd(), 3);
  }
  return P;
}
// la lluvia amaina cuando el molde se llenó (residuo leve para vida)
function rainAmp(t: number): number { return 1 - 0.88 * sstep((t - 4.2) / 1.6); }

// puntos de render de la tela
interface ClothRender { n: number; gi: Float32Array; gj: Float32Array; t0: Float32Array; }
function buildClothRender(): ClothRender {
  const rnd = mulberry32(414243);
  const { nx, ny } = CLOTH;
  const cells = (nx - 1) * (ny - 1);
  const n = nx * ny + cells * 4;
  const R: ClothRender = { n, gi: new Float32Array(n), gj: new Float32Array(n), t0: new Float32Array(n) };
  let k = 0;
  const seedOne = (gi: number, gj: number) => { R.gi[k] = gi; R.gj[k] = gj; R.t0[k] = CLOTH.t0 + 0.2 + 1.0 * rnd(); k++; };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) seedOne(i, j);
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++)
    for (let s = 0; s < 4; s++) seedOne(i + rnd(), j + rnd());
  return R;
}

// ambiente lejano + falda de piso (ancla de escala)
function buildAmbient(n: number, rMin: number, rMax: number, seed: number) {
  const rnd = mulberry32(seed);
  const r = new Float32Array(n), th = new Float32Array(n), y = new Float32Array(n), c = new Float32Array(n * 3), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = rMin + (rMax - rMin) * Math.pow(rnd(), 0.8);
    th[i] = rnd() * Math.PI * 2;
    y[i] = rnd() * 3.2 - 0.1;
    const cold = rnd() < 0.35;
    if (cold) { c[i * 3] = 0.38; c[i * 3 + 1] = 0.44; c[i * 3 + 2] = 0.50; }
    else { c[i * 3] = 0.55; c[i * 3 + 1] = 0.45; c[i * 3 + 2] = 0.33; }
    b[i] = 0.025 + 0.06 * Math.pow(rnd(), 3);
  }
  return { r, th, y, c, b, n };
}
function buildFloorSkirt(n: number, seed: number) {
  const rnd = mulberry32(seed);
  const r = new Float32Array(n), th = new Float32Array(n), y = new Float32Array(n), c = new Float32Array(n * 3), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = 0.35 + 1.9 * Math.pow(rnd(), 0.6);
    th[i] = rnd() * Math.PI * 2;
    y[i] = 0.015 + 0.10 * Math.pow(rnd(), 2.5);
    const T = 1700 + 1600 * rnd();
    const [cr, cg, cb] = blackbodyRGB(T);
    c[i * 3] = cr; c[i * 3 + 1] = cg; c[i * 3 + 2] = cb;
    b[i] = (0.06 + 0.20 * Math.pow(rnd(), 2)) * Math.exp(-(r[i] - 0.35) / 1.0);
  }
  return { r, th, y, c, b, n };
}

// ═══ SHADER de puntos ═══
const PTS_VERT = `
  attribute vec3 aColor;
  attribute float aBright;
  attribute float aSize;
  varying vec3 vColor;
  varying float vNear;
  varying float vBright;
  uniform float uSize;
  void main() {
    vColor = aColor; vBright = aBright;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNear = smoothstep(0.22, 0.75, -mv.z);
    gl_PointSize = min(uSize * aSize * (300.0 / -mv.z), 42.0);
    gl_Position = projectionMatrix * mv;
  }`;
const PTS_FRAG = `
  varying vec3 vColor;
  varying float vNear;
  varying float vBright;
  uniform float uBright;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vNear;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * a * uBright * vBright, a);
  }`;

interface PtsProps { n: number; size: number; bright: number; update: (pos: Float32Array, col: Float32Array, bri: Float32Array, t: number) => void; time: number; sizes?: Float32Array; }
function DustPoints({ n, size, bright, update, time, sizes }: PtsProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aBright', new THREE.BufferAttribute(new Float32Array(n), 1));
    const sz = new Float32Array(n);
    if (sizes) sz.set(sizes.subarray(0, n)); else sz.fill(1);
    g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    return g;
  }, [n, sizes]);
  const uniforms = useMemo(() => ({ uSize: { value: size }, uBright: { value: bright } }), []);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const col = geo.getAttribute('aColor') as THREE.BufferAttribute;
    const bri = geo.getAttribute('aBright') as THREE.BufferAttribute;
    update(pos.array as Float32Array, col.array as Float32Array, bri.array as Float32Array, time);
    pos.needsUpdate = true; col.needsUpdate = true; bri.needsUpdate = true;
    if (matRef.current) { matRef.current.uniforms.uSize.value = size; matRef.current.uniforms.uBright.value = bright; }
  }, [time, geo, update, size, bright]);
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={PTS_VERT} fragmentShader={PTS_FRAG}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ═══ CÁMARA — beats con peso; contra-órbita a la ráfaga ═══
function sph(dist: number, elev: number, azim: number, cy: number): Vec3 {
  return [dist * Math.cos(elev) * Math.cos(azim), cy + dist * Math.sin(elev), dist * Math.cos(elev) * Math.sin(azim)];
}
function sandmanCamera(t: number): { pos: Vec3; target: Vec3; fov: number; roll: number } {
  const bx = Math.sin(t * 0.22) * 0.012 + Math.sin(t * 0.51) * 0.005;
  const CY = 1.02;
  if (t < 0.30) {                    // ESTALLIDO@frame0 — push-in a las botas bajo la lluvia
    const k = sstep(t / 0.30);
    return { pos: sph(lerp(1.60, 1.28, k), 0.10, -0.55 + bx, CY), target: [0, lerp(0.55, 0.48, k), 0], fov: lerp(44, 42, k), roll: 0 };
  } else if (t < 3.4) {              // REVELA — tilt-up con el molde llenándose
    const k = sstep((t - 0.30) / 3.1);
    const ty = k < 0.30 ? lerp(0.48, 0.45, sstep(k / 0.30)) : lerp(0.45, 1.02, sstep((k - 0.30) / 0.70));
    return { pos: sph(lerp(1.28, 3.0, k), lerp(0.10, 0.16, k), lerp(-0.55, 0.35, k) + bx, CY), target: [0, ty, 0], fov: lerp(42, 36, k), roll: 0.03 * Math.sin(t * 0.5) };
  } else if (t < 4.4) {              // ANTICIPA — push hacia la mano con la sábana
    const k = sstep((t - 3.4) / 1.0);
    const tx = lerp(0, 0.24, k), ty = lerp(1.02, 1.0, k), tz = lerp(0, 0.16, k);
    return { pos: sph(lerp(3.0, 2.35, k), 0.16, lerp(0.35, 0.55, k) + bx, CY), target: [tx, ty, tz], fov: 36, roll: 0.02 * Math.sin(t) };
  } else if (t < 7.4) {              // RÁFAGA — contra-órbita amplia (la capa ondea)
    const k = sstep((t - 4.4) / 3.0);
    const az = lerp(0.55, -1.85, k);
    const dist = 2.35 + 0.55 * Math.sin(k * Math.PI);
    const elev = 0.16 + 0.14 * Math.sin(k * Math.PI);
    const tx = lerp(0.24, 0, k), tz = lerp(0.16, 0, k);
    return { pos: sph(dist, elev, az + bx, CY), target: [tx, lerp(1.0, 1.05, k), tz], fov: 36 + 2 * Math.sin(k * Math.PI), roll: 0.05 * Math.sin(k * Math.PI * 2) };
  } else {                           // HÉROE — ángulo bajo, asienta
    const k = sstep((t - 7.4) / 2.6);
    return { pos: sph(lerp(2.35, 3.15, k), lerp(0.16, -0.05, k), lerp(-1.85, -2.35, k) + bx, CY), target: [0, lerp(1.05, 1.0, k), 0], fov: lerp(36, 34, k), roll: 0.02 * Math.sin(t * 0.3) };
  }
}
function CameraRig({ time, vertical }: { time: number; vertical: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    const { pos, target, fov, roll } = sandmanCamera(time);
    camera.position.set(pos[0], pos[1], pos[2]);
    const fwd = new THREE.Vector3(target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]).normalize();
    const up0 = new THREE.Vector3(0, 1, 0);
    if (Math.abs(fwd.dot(up0)) > 0.94) up0.set(0, 0, 1);
    const right = new THREE.Vector3().crossVectors(fwd, up0).normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    camera.up.copy(trueUp.multiplyScalar(Math.cos(roll)).add(right.multiplyScalar(Math.sin(roll))));
    camera.lookAt(target[0], target[1], target[2]);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = vertical ? Math.min(95, fov * 1.42) : fov;
    const d = Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
    cam.near = Math.max(0.01, d * 0.03);
    cam.far = 120;
    cam.updateProjectionMatrix();
  }, [time, camera, vertical]);
  return null;
}

function SandmanPostFX() {
  return (
    <EffectComposer multisampling={4} frameBufferType={THREE.HalfFloatType}>
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

// ═══ ESCENA ═══
function CinematicSandmanInner() {
  const [time, setTime] = useState(0);
  const [rig, setRig] = useState<Rig | null>(null);
  const [vertical] = useState(() => new URLSearchParams(window.location.search).get('h') !== '1');

  useEffect(() => { let ok = true; loadRig().then(r => { if (ok) setRig(r); }); return () => { ok = false; }; }, []);

  const pool = useMemo(() => rig ? buildGrainPool(rig) : null, [rig]);
  const rainP = useMemo(buildRainPool, []);
  const clothR = useMemo(buildClothRender, []);
  const ambient = useMemo(() => buildAmbient(4500, 3.0, 7.0, 990011), []);
  const skirt = useMemo(() => buildFloorSkirt(6000, 550055), []);

  useEffect(() => {
    const api = { renderAt: (t: number) => setTime(Math.max(0, Math.min(SANDMAN_DURATION, t))), ready: !!rig, duration: SANDMAN_DURATION, molecule: 'sandman' };
    (window as unknown as { __cinematicAtom: typeof api }).__cinematicAtom = api;
    return () => { delete (window as unknown as { __cinematicAtom?: unknown }).__cinematicAtom; };
  }, [rig]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('live') !== '1') return;
    let raf = 0, start = 0;
    const loop = (now: number) => { if (!start) start = now; setTime(((now - start) / 1000) % SANDMAN_DURATION); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── FIGURA: lluvia-deposición sobre la superficie skineada ──
  const updateFigure = useMemo(() => {
    if (!rig || !pool) return null;
    const tgt: Vec3 = [0, 0, 0];
    return (posA: Float32Array, colA: Float32Array, briA: Float32Array, t: number) => {
      setRigTime(rig, t);
      const globalEro = sstep((t - 8.7) / 1.3) * 0.35;
      for (let i = 0; i < NP; i++) {
        const o3 = i * 3;
        const tL = pool.tL[i], Tf = pool.Tf[i];
        const t0 = tL - Tf;
        if (t < t0) {                                       // aún en el cielo: invisible
          posA[o3] = 0; posA[o3 + 1] = 8 + (i % 97) * 0.01; posA[o3 + 2] = 0;
          briA[i] = 0;
          continue;
        }
        sampleAt(rig, i, tgt);
        tgt[0] += pool.jx[i]; tgt[1] += pool.jy[i]; tgt[2] += pool.jz[i];
        if (t < tL) {                                       // CAYENDO — balística real
          const dtL = tL - t;                               // tiempo restante al impacto
          const fallY = 0.5 * G_RAIN * dtL * dtL;           // altura restante (½gt²)
          const prog = 1 - dtL / Tf;                        // 0 spawn → 1 impacto
          const cv = sstep(prog);                           // converge horizontal al target
          posA[o3] = tgt[0] + pool.offX[i] * (1 - cv) + 0.03 * Math.sin(3.1 * t + i);
          posA[o3 + 1] = tgt[1] + fallY;
          posA[o3 + 2] = tgt[2] + pool.offZ[i] * (1 - cv) + 0.03 * Math.sin(2.7 * t + i * 1.3);
          colA[o3] = pool.colR[i]; colA[o3 + 1] = pool.colG[i]; colA[o3 + 2] = pool.colB[i];
          briA[i] = pool.bri[i] * 0.85;                     // ascua cayendo
        } else {                                            // ATERRIZÓ — pegado al contorno
          let ex = 0, ey = 0, ez = 0, dim = 0;
          if (pool.eroAmp[i] > 0) {                         // erosión: el viento muerde
            const s = Math.max(0, Math.sin(pool.eroFr[i] * t + pool.eroPh[i])) ** 3 * (0.12 + 0.9 * globalEro);
            const rr = Math.hypot(tgt[0], tgt[2]) + 1e-4;
            ex = (-tgt[2] / rr) * s; ez = (tgt[0] / rr) * s; ey = s * 0.35;
            dim = Math.min(0.6, s * 1.8);
          }
          posA[o3] = tgt[0] + ex; posA[o3 + 1] = tgt[1] + ey; posA[o3 + 2] = tgt[2] + ez;
          const flash = Math.exp(-(t - tL) / 0.22);         // impacto: destello que se enfría
          const wsh = 0.42 + 0.45 * flash;
          colA[o3] = lerp(pool.colR[i], WHITE_WARM[0], wsh);
          colA[o3 + 1] = lerp(pool.colG[i], WHITE_WARM[1], wsh);
          colA[o3 + 2] = lerp(pool.colB[i], WHITE_WARM[2], wsh);
          briA[i] = pool.bri[i] * (1.55 + 1.9 * flash) * (1 - dim);
        }
      }
    };
  }, [rig, pool]);

  // ── LLUVIA que falla: cae, salpica el piso, recicla ──
  const updateRain = useMemo(() => {
    return (posA: Float32Array, colA: Float32Array, briA: Float32Array, t: number) => {
      const amp = rainAmp(t);
      for (let i = 0; i < RAIN_N; i++) {
        const o3 = i * 3;
        const tau = ((t / rainP.per[i]) + rainP.ph[i]) % 1;
        const tFall = tau * rainP.per[i];
        // cae desde y0 = ½g·per² (el ciclo completo es una caída libre) y salpica en el piso
        const y0 = 0.5 * G_RAIN * rainP.per[i] * rainP.per[i];
        const yy = Math.max(0.02, y0 - 0.5 * G_RAIN * tFall * tFall);
        posA[o3] = rainP.x[i] + 0.02 * Math.sin(2.2 * t + i);
        posA[o3 + 1] = yy;
        posA[o3 + 2] = rainP.z[i] + 0.02 * Math.sin(1.9 * t + i * 1.7);
        colA[o3] = rainP.c[o3]; colA[o3 + 1] = rainP.c[o3 + 1]; colA[o3 + 2] = rainP.c[o3 + 2];
        const splash = yy < 0.09 ? 1.8 : 1.0;               // destello al salpicar
        briA[i] = rainP.b[i] * amp * splash;
      }
    };
  }, [rainP]);

  // ── SÁBANA (cache 60 Hz → lerp; shimmer ∝ |v|; nudo blanco en la mano) ──
  const updateCloth = useMemo(() => {
    if (!rig) return null;
    const { nx } = CLOTH;
    const cloth = rig.cloth;
    const hand: Vec3 = [0, 0, 0];
    return (posA: Float32Array, colA: Float32Array, briA: Float32Array, t: number) => {
      const tc = Math.max(0, Math.min(t - CLOTH.t0, (cloth.K - 1) / CLOTH.fps));
      const kf = Math.min(cloth.K - 2, Math.floor(tc * CLOTH.fps));
      const f = Math.min(1, tc * CLOTH.fps - kf);
      const o0 = kf * cloth.N * 3, o1 = (kf + 1) * cloth.N * 3;
      const F = cloth.frames;
      boneAt(rig, HAND, t, hand);
      for (let k = 0; k < clothR.n; k++) {
        const gi = clothR.gi[k], gj = clothR.gj[k];
        const i0 = Math.min(CLOTH.nx - 2, Math.floor(gi)), j0 = Math.min(CLOTH.ny - 2, Math.floor(gj));
        const fu = gi - i0, fv = gj - j0;
        const n00 = (j0 * nx + i0) * 3, n10 = n00 + 3, n01 = ((j0 + 1) * nx + i0) * 3, n11 = n01 + 3;
        const o3 = k * 3;
        let px = 0, py = 0, pz = 0, sx = 0, sy = 0, sz = 0;
        for (let d = 0; d < 3; d++) {
          const b00 = F[o0 + n00 + d] * (1 - f) + F[o1 + n00 + d] * f;
          const b10 = F[o0 + n10 + d] * (1 - f) + F[o1 + n10 + d] * f;
          const b01 = F[o0 + n01 + d] * (1 - f) + F[o1 + n01 + d] * f;
          const b11 = F[o0 + n11 + d] * (1 - f) + F[o1 + n11 + d] * f;
          const v = (b00 * (1 - fu) + b10 * fu) * (1 - fv) + (b01 * (1 - fu) + b11 * fu) * fv;
          const v2 = (F[o1 + n00 + d] - F[o0 + n00 + d]);
          if (d === 0) { px = v; sx = v2; } else if (d === 1) { py = v; sy = v2; } else { pz = v; sz = v2; }
        }
        // materializa CAYENDO también (la tela es polvo que llegó de la lluvia)
        const m = sstep((t - clothR.t0[k]) / 0.8);
        if (m < 0.999) {
          const drop = (1 - m) * (1 - m) * 1.6;
          py += drop;
        }
        posA[o3] = px; posA[o3 + 1] = py; posA[o3 + 2] = pz;
        const speed = Math.hypot(sx, sy, sz) * CLOTH.fps;
        const b = (0.55 + 0.55 * Math.min(1.6, speed * 0.9)) * m;
        const dxw = px - hand[0], dyw = py - hand[1], dzw = pz - hand[2];
        const dw = Math.hypot(dxw, dyw, dzw);
        const knot = sstep((t - CLOTH.t0 - 0.3) / 0.5) * Math.max(0, 1 - dw / 0.24);
        colA[o3] = lerp(CYAN[0], 1.0, knot);
        colA[o3 + 1] = lerp(CYAN[1], 0.98, knot);
        colA[o3 + 2] = lerp(CYAN[2], 0.92, knot);
        briA[k] = b + knot * 2.0;
      }
    };
  }, [rig, clothR]);

  // ── nudo blanco en la MANO (enciende cuando la tela llega) ──
  const knotOff = useMemo(() => {
    const rnd = mulberry32(313131);
    const off = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const u1 = rnd() || 1e-6, u2 = rnd(), u3 = rnd() || 1e-6, u4 = rnd();
      off[i * 3] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * 0.035;
      off[i * 3 + 1] = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2) * 0.035;
      off[i * 3 + 2] = Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4) * 0.035;
    }
    return off;
  }, []);
  const updateKnot = useMemo(() => {
    if (!rig) return null;
    const hand: Vec3 = [0, 0, 0];
    return (posA: Float32Array, colA: Float32Array, briA: Float32Array, t: number) => {
      boneAt(rig, HAND, t, hand);
      const ignite = sstep((t - CLOTH.t0 - 0.2) / 0.5);
      const flash = Math.exp(-((t - CLOTH.t0 - 0.55) ** 2) / (2 * 0.18 * 0.18));
      const b = ignite * (0.9 + 2.2 * flash + 0.25 * Math.sin(t * 7));
      for (let i = 0; i < 500; i++) {
        const o3 = i * 3;
        posA[o3] = hand[0] + knotOff[o3];
        posA[o3 + 1] = hand[1] + knotOff[o3 + 1];
        posA[o3 + 2] = hand[2] + knotOff[o3 + 2];
        colA[o3] = 1.0; colA[o3 + 1] = 0.98; colA[o3 + 2] = 0.92;
        briA[i] = b;
      }
    };
  }, [rig, knotOff]);

  // ── corazón (pecho, hueso Spine2): enciende cuando el torso se llena ──
  const heartOff = useMemo(() => {
    const rnd = mulberry32(616161);
    const off = new Float32Array(350 * 3);
    for (let i = 0; i < 350; i++) {
      const u1 = rnd() || 1e-6, u2 = rnd(), u3 = rnd() || 1e-6, u4 = rnd();
      off[i * 3] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * 0.05;
      off[i * 3 + 1] = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2) * 0.05;
      off[i * 3 + 2] = Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4) * 0.05;
    }
    return off;
  }, []);
  const updateHeart = useMemo(() => {
    if (!rig) return null;
    const chest: Vec3 = [0, 0, 0];
    return (posA: Float32Array, colA: Float32Array, briA: Float32Array, t: number) => {
      boneAt(rig, CHEST, t, chest);
      const on = sstep((t - 2.6) / 0.6);
      const b = on * (1.3 + 0.18 * Math.sin(t * 2.2));
      for (let i = 0; i < 350; i++) {
        const o3 = i * 3;
        posA[o3] = chest[0] + heartOff[o3]; posA[o3 + 1] = chest[1] + heartOff[o3 + 1]; posA[o3 + 2] = chest[2] + 0.04 + heartOff[o3 + 2];
        colA[o3] = WHITE_WARM[0]; colA[o3 + 1] = WHITE_WARM[1]; colA[o3 + 2] = WHITE_WARM[2];
        briA[i] = b;
      }
    };
  }, [rig, heartOff]);

  const updateAmbient = useMemo(() => {
    return (posA: Float32Array, colA: Float32Array, briA: Float32Array, t: number) => {
      for (let i = 0; i < ambient.n; i++) {
        const th = ambient.th[i] + 0.05 * t;
        const o3 = i * 3;
        posA[o3] = ambient.r[i] * Math.cos(th);
        posA[o3 + 1] = ambient.y[i] + 0.02 * Math.sin(0.3 * t + i);
        posA[o3 + 2] = ambient.r[i] * Math.sin(th);
        colA[o3] = ambient.c[o3]; colA[o3 + 1] = ambient.c[o3 + 1]; colA[o3 + 2] = ambient.c[o3 + 2];
        briA[i] = ambient.b[i];
      }
    };
  }, [ambient]);
  const updateSkirt = useMemo(() => {
    return (posA: Float32Array, colA: Float32Array, briA: Float32Array, t: number) => {
      for (let i = 0; i < skirt.n; i++) {
        const th = skirt.th[i] + vortexOmega(skirt.r[i]) * 0.55 * t;
        const o3 = i * 3;
        posA[o3] = skirt.r[i] * Math.cos(th);
        posA[o3 + 1] = skirt.y[i] + 0.015 * Math.sin(1.2 * t + i * 0.7);
        posA[o3 + 2] = skirt.r[i] * Math.sin(th);
        colA[o3] = skirt.c[o3]; colA[o3 + 1] = skirt.c[o3 + 1]; colA[o3 + 2] = skirt.c[o3 + 2];
        briA[i] = skirt.b[i];
      }
    };
  }, [skirt]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas flat
        camera={{ position: [0, 1.05, 2.5], fov: 40, near: 0.01, far: 120 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]} frameloop="always" style={{ background: '#000' }}
      >
        <color attach="background" args={['#000']} />
        <FrameDriver time={time} />
        <CameraRig time={time} vertical={vertical} />
        {rig && pool && updateFigure && (
          <DustPoints n={NP} size={0.030} bright={0.60} update={updateFigure} time={time} sizes={pool.sizeMul} />
        )}
        <DustPoints n={RAIN_N} size={0.032} bright={0.9} update={updateRain} time={time} />
        {updateCloth && <DustPoints n={clothR.n} size={0.042} bright={0.95} update={updateCloth} time={time} />}
        {updateKnot && <DustPoints n={500} size={0.055} bright={1.0} update={updateKnot} time={time} />}
        {updateHeart && <DustPoints n={350} size={0.06} bright={1.0} update={updateHeart} time={time} />}
        <DustPoints n={ambient.n} size={0.05} bright={1.0} update={updateAmbient} time={time} />
        <DustPoints n={skirt.n} size={0.038} bright={1.0} update={updateSkirt} time={time} />
        <SandmanPostFX />
      </Canvas>
    </div>
  );
}

export default memo(CinematicSandmanInner);
