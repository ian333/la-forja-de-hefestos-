/**
 * TransistorCristal — CÁPSULA #3 "EL TRANSISTOR" (Bell Labs 1947).
 *
 * LA FÍSICA ES EL ESPECTÁCULO (átomos y ELECTRONES, no figuras simples):
 *  · LA CATEDRAL: red cúbica-diamante REAL del silicio (FCC + base (¼,¼,¼),
 *    a=5.431 Å → 1 unidad) — puntos ámbar NÍTIDOS con el titileo cuántico y la
 *    ESCALA de la serie de átomos (gl_PointSize ≈ aSize·520/z, caps absolutos).
 *  · DOPANTES (~2%): un electrón de más — laten ORO y FLASHEAN en su beat.
 *  · EL RÍO: 9k electrones CIAN (frío vs red cálida = firma-O₂) embalsados en
 *    la fuente; cada CLIC suelta un FRENTE DE ONDA por el canal (MOSFET n).
 *  · LA COMPUERTA: DOS anillos de puntos + 24 RAYOS de campo E que pulsan
 *    hacia adentro al encender (paleta ámbar→blanco del campo E de átomos).
 *    Cero sólidos. El CLIC = flash breve de los anillos (bloom pop, no whiteout).
 *  · ACTO 2: salida exponencial; el HÉROE SE DESVANECE hasta ser UNA estrella
 *    más que parpadea entre 4096 copias (la idea copiada sin gastarse) — campo
 *    de estrellas bicolor. Al regreso, el héroe re-enciende (loop al clic).
 *
 * Puro en t (useCineTime). Gotchas: pz=max(0.12,-mv.z) (TDR), caps ABSOLUTOS
 * en px (fill 4K = fill 1080), pow/max (NaN), uniforms useMemo + .value.
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCineTime } from '../useCineTime';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ss = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);
const ease5 = (x: number) => { const t = clamp01(x); return t * t * t * (t * (6 * t - 15) + 10); };

// ── BEATS (clavar a la narración real con assemble-offsets) ──
export const T = {
  dopantes: 12.8, compuerta: 16.0, click1: 20.45, cierra: 22.35,
  rapido: 25.2, acto2: 29.6, awe: 38.4, regreso: 50.0, fin: 60.0,
};

const VENTANAS: [number, number][] = [[T.click1, T.cierra], [23.1, 23.8]];
function gate(t: number): number {
  const τ = 0.09;
  let g = 0;
  for (const [a, b] of VENTANAS) g = Math.max(g, ss((t - a) / τ) * (1 - ss((t - b) / τ)));
  if (t >= T.rapido && t < T.acto2) {
    const u = t - T.rapido, f0 = 1.25, f1 = 3.6, D = T.acto2 - T.rapido;
    const phase = f0 * u + (f1 - f0) * u * u / (2 * D);
    g = Math.max(g, phase % 1 < 0.5 ? 1 : 0);
  }
  if (t >= T.acto2) g = Math.max(g, (t * 2) % 1 < 0.55 ? 1 : 0);
  return g;
}
// flash del clic: pico breve en cada FLANCO (subida) de la compuerta
function clickFlash(t: number): number {
  let f = 0;
  const edges = [T.click1, 23.1];
  if (t >= T.rapido && t < T.acto2 + 1) {
    const u = Math.max(0, t - T.rapido), f0 = 1.25, f1 = 3.6, D = T.acto2 - T.rapido;
    const phase = f0 * u + (f1 - f0) * u * u / (2 * D);
    const frac = phase % 1;
    f = Math.max(f, Math.exp(-frac * 9.0) * 0.8);
  }
  for (const e of edges) if (t >= e) f = Math.max(f, Math.exp(-(t - e) / 0.22) * ss((t - e) / 0.05));
  return f;
}
// ∫gate dt (paso fino, cacheada) → fase del río, pura en t
const FLOW_DT = 1 / 96;
const FLOW_CACHE: number[] = [0];
for (let i = 1; i <= Math.ceil(70 / FLOW_DT); i++) FLOW_CACHE[i] = FLOW_CACHE[i - 1] + gate(i * FLOW_DT) * FLOW_DT;
const flowPhase = (t: number) => {
  const x = Math.max(0, t) / FLOW_DT, i = Math.min(FLOW_CACHE.length - 2, Math.floor(x));
  return FLOW_CACHE[i] + (FLOW_CACHE[i + 1] - FLOW_CACHE[i]) * (x - i);
};
// el héroe se hace UNA estrella en el acto 2 y regresa para el loop
function heroFade(t: number): number {
  const out = 1 - 0.95 * ss((t - (T.acto2 + 4.0)) / 8.0);
  const back = ss((t - T.regreso) / 4.5);
  return Math.max(out, 0.05 + 0.95 * back);
}

// ── LA CATEDRAL: cúbica-diamante REAL, ancha para envolver a la cámara ──
const NX = 9, NY = 11, NZ = 9;
const BASE8: [number, number, number][] = [
  [0, 0, 0], [0, .5, .5], [.5, 0, .5], [.5, .5, 0],
  [.25, .25, .25], [.25, .75, .75], [.75, .25, .75], [.75, .75, .25],
];
const CRYSTAL_H = NY / 2;

const SPRITE = (() => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.10)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

// titileo cuántico (receta átomos) + pz blindado + caps ABSOLUTOS chicos
const LATTICE_VERT = /* glsl */`
attribute float aSize; attribute vec3 aCol; attribute float aDop;
uniform float uTime, uPx, uDopFlash, uHero;
varying vec3 vC; varying float vA;
void main(){
  float ph = fract(sin(dot(position, vec3(12.9898,78.233,37.719))) * 43758.5453) * 6.2831853;
  float u = fract(ph * 0.15915494);
  float life = fract(uTime * (0.5 + 0.8*u) + u);
  float flick = smoothstep(0.0,0.25,life) * (1.0 - smoothstep(0.55,1.0,life));
  float pulse = 0.55 + 0.45*flick;
  float dop = aDop * (0.6 + 0.4*sin(uTime*3.0 + ph)) * (1.0 + 2.4*uDopFlash);
  vC = aCol * (0.75 + 0.25*pulse) * (1.0 + dop*1.8);
  vA = uHero * (0.42 + 0.42*pulse) * (1.0 + aDop*(0.8 + 2.2*uDopFlash));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // CULL detrás de cámara (receta CinematicAtom): expulsar del clip, NO maquillar
  // con max(). Un gl_Position con w<0 rasteriza degenerado y REVIENTA la GPU.
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;
  float cap = mix(10.0, 16.0, aDop);
  gl_PointSize = clamp(aSize * (0.75+0.45*pulse) * (uPx / pz), 0.0, cap);
}`;
const SOFT_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap;
varying vec3 vC; varying float vA;
void main(){
  float a = texture2D(uMap, gl_PointCoord).a * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC, a);
}`;

const RIVER_VERT = /* glsl */`
attribute float aSeed; attribute float aLane; attribute vec3 aPool;
uniform float uTime, uPx, uGate, uFlow, uH, uHero;
varying vec3 vC; varying float vA;
void main(){
  float ph = aSeed * 6.2831853;
  vec3 pool = aPool + 0.10 * vec3(sin(uTime*2.1+ph), sin(uTime*1.7+ph*1.9), cos(uTime*2.5+ph*0.7));
  float y = -uH + mod(aSeed * 7.31 * uH + uFlow * (6.5 + 2.5*aLane), 2.0*uH);
  float rr = 0.35 + 0.85*fract(aSeed*13.7);
  float aa = ph + uFlow*0.9*aLane + y*0.35;
  vec3 stream = vec3(rr*cos(aa), y, rr*sin(aa));
  float k = smoothstep(0.0, 1.0, uGate*1.35 - fract(aSeed*5.17)*0.35);
  vec3 p = mix(pool, stream, k);
  float speedGlow = k * uGate;
  vC = mix(vec3(0.26,0.64,1.0), vec3(0.92,1.0,1.0), speedGlow*0.5 + 0.12*fract(aSeed*3.1));
  vA = uHero * (0.30 + 0.46*speedGlow + 0.12*sin(uTime*3.0+ph));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // CULL detrás de cámara (receta CinematicAtom): expulsar del clip, NO maquillar
  // con max(). Un gl_Position con w<0 rasteriza degenerado y REVIENTA la GPU.
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;
  gl_PointSize = clamp((0.07 + 0.07*speedGlow) * (uPx / pz), 0.0, 12.0);
}`;

// COMPUERTA: anillos de puntos con pulso circulante + flash en el clic
const RING_VERT = /* glsl */`
attribute float aAlong; attribute float aRing;
uniform float uTime, uPx, uGate, uFlash, uHero;
varying vec3 vC; varying float vA;
void main(){
  float flow = 0.5 + 0.5*sin(aAlong*6.2831853*7.0 - uTime*(3.0 + 5.0*uGate) + aRing*3.0);
  vec3 frio = vec3(0.55, 0.32, 0.10);
  vec3 on = mix(vec3(1.0,0.55,0.12), vec3(1.0,0.95,0.8), 0.3 + 0.5*flow);
  vC = mix(frio * 1.4, on, uGate) * (1.0 + 2.2*uFlash);
  vA = uHero * (0.20 + (0.5 + 0.5*flow)*uGate + 0.7*uFlash);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // CULL detrás de cámara (receta CinematicAtom): expulsar del clip, NO maquillar
  // con max(). Un gl_Position con w<0 rasteriza degenerado y REVIENTA la GPU.
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;
  gl_PointSize = clamp((0.05 + 0.06*uGate + 0.06*uFlash) * (uPx / pz), 0.0, 11.0);
}`;

// RAYOS del campo E: pulsos ámbar viajando HACIA ADENTRO al encender
const SPOKE_VERT = /* glsl */`
attribute float aAlong; attribute float aSpoke;
uniform float uTime, uPx, uGate, uHero;
varying vec3 vC; varying float vA;
void main(){
  float wave = sin(aAlong*12.0 + uTime*5.0 + aSpoke*6.2831853);
  float w = 0.35 + 0.65*smoothstep(0.2, 1.0, wave);
  vC = mix(vec3(1.0,0.55,0.12), vec3(1.0,0.95,0.8), 0.25 + 0.4*w);
  vA = uHero * uGate * w * (1.0 - aAlong*0.45) * 0.9;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // CULL detrás de cámara (receta CinematicAtom): expulsar del clip, NO maquillar
  // con max(). Un gl_Position con w<0 rasteriza degenerado y REVIENTA la GPU.
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;
  gl_PointSize = clamp(0.055 * (uPx / pz), 0.0, 8.0);
}`;

// ACTO 2: campo de estrellas de transistores (bicolor, cada uno hace clic)
const COPIES_VERT = /* glsl */`
attribute float aGen; attribute float aPhase; attribute float aWarm;
uniform float uTime, uPx, uGen;
varying vec3 vC; varying float vA;
void main(){
  float born = smoothstep(aGen, aGen + 0.6, uGen);
  float clic = step(0.5, fract(uTime * (1.4 + aPhase*1.6) + aPhase*7.0));
  float blink = mix(0.5, 1.0, clic);
  vC = mix(vec3(0.26,0.64,1.0), vec3(1.0,0.74,0.34), aWarm) * (1.05 + 0.75*blink);
  vA = born * (0.68 + 0.42*blink);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // CULL detrás de cámara (receta CinematicAtom): expulsar del clip, NO maquillar
  // con max(). Un gl_Position con w<0 rasteriza degenerado y REVIENTA la GPU.
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;
  gl_PointSize = born < 0.05 ? 0.0 : clamp((0.15 + 0.10*blink) * (uPx / pz), 0.0, 11.0);
}`;

// la ESTRELLA-HÉROE: nuestro transistor visto de lejos, parpadeando su clic
const HERO_VERT = /* glsl */`
uniform float uTime, uPx, uGate, uOn;
varying vec3 vC; varying float vA;
void main(){
  vC = mix(vec3(0.6,0.8,1.0), vec3(1.0,0.95,0.8), uGate);
  vA = uOn * (0.35 + 0.6*uGate);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // CULL detrás de cámara (receta CinematicAtom): expulsar del clip, NO maquillar
  // con max(). Un gl_Position con w<0 rasteriza degenerado y REVIENTA la GPU.
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;
  gl_PointSize = clamp(0.5 * (uPx / pz), 0.0, 12.0);
}`;

export default function TransistorCristal() {
  const tRef = useCineTime();
  const { camera, size } = useThree();

  // contrato de herramientas (shot/render esperan __nebulaReady): listos al montar
  useMemo(() => { (window as unknown as { __nebulaReady?: boolean }).__nebulaReady = true; }, []);

  const lattice = useMemo(() => {
    const pos: number[] = [], col: number[] = [], sz: number[] = [], dop: number[] = [];
    const cWarm = new THREE.Color(1.0, 0.74, 0.34);
    const cDim = new THREE.Color(0.48, 0.30, 0.12);
    const rng = (i: number) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    let i = 0;
    for (let cx = 0; cx < NX; cx++) for (let cy = 0; cy < NY; cy++) for (let cz = 0; cz < NZ; cz++)
      for (const [bx, by, bz] of BASE8) {
        const x = cx - NX / 2 + bx, y = cy - NY / 2 + by, z = cz - NZ / 2 + bz;
        const r = rng(++i);
        const esDop = r > 0.978;
        pos.push(x, y, z);
        const c = esDop ? cWarm : cDim.clone().lerp(cWarm, rng(i * 3) * 0.3);
        col.push(c.r, c.g, c.b);
        sz.push(esDop ? 0.15 : 0.060 + 0.040 * rng(i * 7));
        dop.push(esDop ? 1 : 0);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(sz, 1));
    g.setAttribute('aDop', new THREE.Float32BufferAttribute(dop, 1));
    return g;
  }, []);

  const river = useMemo(() => {
    const N = 9000;
    const seed: number[] = [], lane: number[] = [], pool: number[] = [], pos: number[] = [];
    const rng = (i: number) => Math.abs(Math.sin(i * 78.233) * 43758.5453) % 1;
    for (let i = 0; i < N; i++) {
      const s = rng(i), l = rng(i * 2 + 1);
      seed.push(s); lane.push(l);
      // el embalse vive DENTRO de la mitad baja del cristal
      const a = rng(i * 3 + 2) * Math.PI * 2, r = Math.sqrt(rng(i * 5 + 3)) * 2.3;
      pool.push(r * Math.cos(a), -CRYSTAL_H + 0.3 + rng(i * 7 + 4) * 2.1, r * Math.sin(a));
      pos.push(0, 0, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    g.setAttribute('aLane', new THREE.Float32BufferAttribute(lane, 1));
    g.setAttribute('aPool', new THREE.Float32BufferAttribute(pool, 3));
    return g;
  }, []);

  const rings = useMemo(() => {
    // dos anillos de puntos (R=2.9 y 2.55) a ±0.45 de la cintura del canal
    const pos: number[] = [], along: number[] = [], ring: number[] = [];
    const N = 420;
    for (let k = 0; k < 2; k++) {
      const R = k === 0 ? 2.9 : 2.55, y = k === 0 ? 0.45 : -0.45;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        pos.push(R * Math.cos(a), y, R * Math.sin(a));
        along.push(i / N); ring.push(k);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    g.setAttribute('aRing', new THREE.Float32BufferAttribute(ring, 1));
    return g;
  }, []);

  const spokes = useMemo(() => {
    // 24 rayos radiales del campo E (r 4.6 → 2.3), 26 puntos por rayo
    const pos: number[] = [], along: number[] = [], sp: number[] = [];
    const NS = 24, STEPS = 26;
    for (let s = 0; s < NS; s++) {
      const a = (s / NS) * Math.PI * 2;
      for (let i = 0; i < STEPS; i++) {
        const u = i / (STEPS - 1);              // 0 afuera → 1 adentro
        const r = lerp(4.6, 2.3, u);
        pos.push(r * Math.cos(a), (u - 0.5) * (s % 2 === 0 ? 0.9 : -0.9), r * Math.sin(a));
        along.push(u); sp.push(s / NS);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    g.setAttribute('aSpoke', new THREE.Float32BufferAttribute(sp, 1));
    return g;
  }, []);

  const copies = useMemo(() => {
    const N = 12288;
    const pos: number[] = [], gen: number[] = [], phs: number[] = [], warm: number[] = [];
    const rng = (i: number) => Math.abs(Math.sin(i * 37.719) * 43758.5453) % 1;
    for (let i = 0; i < N; i++) {
      const g0 = Math.min(12, Math.floor(Math.log2(i / 3 + 2)));
      const R = 6 + g0 * 3.5 + rng(i * 3) * 3;
      const th = Math.acos(2 * rng(i * 5 + 1) - 1), ph2 = rng(i * 7 + 2) * Math.PI * 2;
      pos.push(R * Math.sin(th) * Math.cos(ph2), R * Math.cos(th) * 0.8, R * Math.sin(th) * Math.sin(ph2));
      gen.push(g0); phs.push(rng(i * 11 + 3)); warm.push(rng(i * 13 + 5) > 0.5 ? 1 : 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aGen', new THREE.Float32BufferAttribute(gen, 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phs, 1));
    g.setAttribute('aWarm', new THREE.Float32BufferAttribute(warm, 1));
    return g;
  }, []);

  const heroStar = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    return g;
  }, []);

  // uPx receta átomos: 520 a 1920 de alto → escala con la resolución
  const px0 = 520 * (size.height / 1920);
  const mk = (vert: string, extra: Record<string, { value: unknown }>) => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: SOFT_FRAG,
    uniforms: { uTime: { value: 0 }, uPx: { value: px0 }, uMap: { value: SPRITE }, ...extra },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const latMat = useMemo(() => mk(LATTICE_VERT, { uDopFlash: { value: 0 }, uHero: { value: 1 } }), []);  // eslint-disable-line react-hooks/exhaustive-deps
  const rivMat = useMemo(() => mk(RIVER_VERT, { uGate: { value: 0 }, uFlow: { value: 0 }, uH: { value: CRYSTAL_H + 0.8 }, uHero: { value: 1 } }), []);  // eslint-disable-line react-hooks/exhaustive-deps
  const ringMat = useMemo(() => mk(RING_VERT, { uGate: { value: 0 }, uFlash: { value: 0 }, uHero: { value: 1 } }), []);  // eslint-disable-line react-hooks/exhaustive-deps
  const spokeMat = useMemo(() => mk(SPOKE_VERT, { uGate: { value: 0 }, uHero: { value: 1 } }), []);  // eslint-disable-line react-hooks/exhaustive-deps
  const copMat = useMemo(() => mk(COPIES_VERT, { uGen: { value: 0 } }), []);  // eslint-disable-line react-hooks/exhaustive-deps
  const heroMat = useMemo(() => mk(HERO_VERT, { uGate: { value: 0 }, uOn: { value: 0 } }), []);  // eslint-disable-line react-hooks/exhaustive-deps

  const rig = useRef<THREE.Group>(null);

  useFrame(() => {
    const t = tRef.current;
    const g = gate(t);
    const flash = clickFlash(t);
    const dopFlash = t >= T.dopantes ? Math.exp(-Math.max(0, t - T.dopantes) / 1.1) * ss((t - T.dopantes) / 0.28) : 0;
    const hero = heroFade(t);
    const px = 520 * (size.height / 1920);

    for (const m of [latMat, rivMat, ringMat, spokeMat, copMat, heroMat]) {
      m.uniforms.uTime.value = t; m.uniforms.uPx.value = px;
    }
    latMat.uniforms.uDopFlash.value = dopFlash; latMat.uniforms.uHero.value = hero;
    rivMat.uniforms.uGate.value = g; rivMat.uniforms.uFlow.value = flowPhase(t); rivMat.uniforms.uHero.value = hero;
    ringMat.uniforms.uGate.value = g; ringMat.uniforms.uFlash.value = flash; ringMat.uniforms.uHero.value = hero;
    spokeMat.uniforms.uGate.value = g; spokeMat.uniforms.uHero.value = hero;
    const gen = t < T.acto2 ? 0 : Math.min(12, ((t - T.acto2) / (T.awe - T.acto2)) * 12);
    copMat.uniforms.uGen.value = gen;
    // la estrella-héroe existe solo mientras el héroe está desvanecido
    heroMat.uniforms.uGate.value = g; heroMat.uniforms.uOn.value = clamp01((1 - hero) * 1.4);

    // ── CÁMARA C0 (receta O₂): dentro → dopantes → héroe → salida exp → loop ──
    let dist: number, elev: number, azim: number, cy: number, fov: number;
    if (t < T.dopantes) {
      const k = ease5(t / T.dopantes);
      dist = lerp(9.5, 8.0, k); elev = lerp(-0.34, 0.02, k);
      azim = 0.6 + t * 0.16; cy = lerp(-2.6, -1.2, k); fov = 46;
    } else if (t < T.compuerta) {
      const k = ease5((t - T.dopantes) / (T.compuerta - T.dopantes));
      dist = lerp(8.0, 6.8, k); elev = lerp(0.02, 0.14, k);
      azim = 0.6 + T.dopantes * 0.16 + k * 1.1; cy = lerp(-1.2, -0.4, k); fov = 46;
    } else if (t < T.acto2) {
      const k = ease5((t - T.compuerta) / (T.acto2 - T.compuerta));
      dist = lerp(6.4, 8.6, k) - 0.6 * Math.sin(k * Math.PI);
      elev = 0.14 - 0.06 * Math.sin(k * Math.PI); azim = 2.38 + k * 0.9;
      cy = lerp(-0.4, 0.3, k); fov = 44;
    } else if (t < T.regreso) {
      const k = ease5((t - T.acto2) / (T.regreso - T.acto2));
      dist = 8.6 * Math.pow(28 / 8.6, k);
      elev = lerp(0.14, 0.34, k); azim = 3.28 + k * 2.1; cy = lerp(0.3, 0, k); fov = 44;
    } else {
      const k = ease5((t - T.regreso) / (T.fin - T.regreso));
      dist = 28 * Math.pow(4.0 / 28, k);
      elev = lerp(0.34, -0.42, k); azim = 5.38 + k * 1.5; cy = lerp(0, -CRYSTAL_H + 0.5, k); fov = lerp(44, 46, k);
    }
    const portrait = size.height > size.width;
    const f = portrait ? Math.min(88, fov * 1.35) : fov;
    const pr = dist * Math.cos(elev);
    camera.position.set(pr * Math.cos(azim), cy + dist * Math.sin(elev), pr * Math.sin(azim));
    camera.lookAt(0, cy * 0.55, 0);
    (camera as THREE.PerspectiveCamera).fov = f;
    (camera as THREE.PerspectiveCamera).near = Math.max(0.01, dist * 0.02);
    (camera as THREE.PerspectiveCamera).far = Math.max(400, dist * 30);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

    if (rig.current) rig.current.rotation.y = t * 0.03;
  });

  return (
    <group ref={rig}>
      <points geometry={lattice} material={latMat} />
      <points geometry={river} material={rivMat} />
      <points geometry={rings} material={ringMat} />
      <points geometry={spokes} material={spokeMat} />
      <points geometry={copies} material={copMat} />
      <points geometry={heroStar} material={heroMat} />
    </group>
  );
}
