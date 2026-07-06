/**
 * CinematicIdeas — "CÓMO CRECER SIN DINERO" (Romer · Nobel 2018).
 * EPISODIO 2 de "Los Nobel son fenómenos naturales". Ver docs/FORMULA-SERIE.md.
 *
 * LA FÍSICA (real): FORMACIÓN ESTELAR EN CADENA (Elmegreen & Lada 1977; Carina/
 * Orión): una estrella enciende → su frente de ionización comprime el gas vecino
 * → nuevas estrellas. Una vela enciende mil velas SIN apagarse: la idea NO-RIVAL.
 * La nube que acumula gas sin encender = capital con rendimientos decrecientes.
 *
 * LA IMAGEN-SÍMBOLO: la primera luz encendiendo la nube oscura en cadena.
 * ARCO: génesis (el inverso de Limones): OSCURIDAD → CHISPA → INCENDIO → AMANECER.
 *
 * LETRAS 3D REALES (nota de dirección): TextGeometry extruida, VIVEN dentro del
 * caos — sandwich entre las dos capas de nube (la capa frontal las VELA), con
 * parallax real al viajar la cámara. No son subtítulos: son monumentos.
 *
 * RIVAL a la GARGANTUA (nota de dirección): la escala nace de verse desde
 * DISTINTOS PLANOS → el beat rival son 3 TOMAS del caos (dentro de la corriente /
 * el choque / el tirón wide).
 *
 * TIMELINE (92 s) clavado a la voz YA GRABADA (public/audio/clase-romer/):
 *   FF   0.0-1.5   FLASH-FORWARD: la cadena ardiendo (clímax) → corte a negro-nube
 *   A1   1.5-12    r05@2.0  LA TRAMPA — la nube traga gas y NO enciende
 *   A2   12-22     r09@12.5 EL FANTASMA — viaje a la oscuridad; algo palpita
 *   A3   22-32.5   r10@22.5 IDEAS — LA PRIMERA IGNICIÓN en tu cara
 *   A4   32.5-43   r12@33   RIVAL — 3 tomas: las corrientes compiten por el gas
 *   A5   43-51     r13@43.5 NO-RIVAL — su luz enciende al vecino sin apagarse
 *   A6   51-61     r14@51.5 SE COPIA GRATIS — 3,5,8 igniciones propagándose
 *   A7   61-70.5   r17@61.5 BOLA DE NIEVE — el frente barre la nube (retroceso)
 *   A8   70.5-92   r25@71   LA RECETA — el cúmulo ardiendo · título · paz
 *
 * Determinista: window.__cinematicIdeas.renderAt(t) PURO en t ∈ [0, 92].
 */
import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import CinematicPostFX from './CinematicPostFX';

const DURATION = 92;

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function sstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * clamp01(t); }

// ── LAS ESTRELLAS DEL CÚMULO: posiciones deterministas + tiempos de ignición ──
// Propagación REAL del frente: t_ignite = T0 + dist/v (el frente de ionización
// viaja); la PRIMERA enciende en el corazón a t=26. Flash-forward muestra t≈65.
const N_STARS = 42;
const V_FRONT = 0.52;          // unidades de nube / s (frente de ionización)
const T_FIRST = 26.0;
type Star = { p: THREE.Vector3; tIg: number; hue: number; big: number };
function buildStars(): Star[] {
  let s = 424242 >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const stars: Star[] = [];
  // la primera: el corazón
  stars.push({ p: new THREE.Vector3(0.15, -0.1, 0.05), tIg: T_FIRST, hue: 0.62, big: 1.6 });
  for (let i = 1; i < N_STARS; i++) {
    // distribución en la nube (radio ~2.2, sesgo a filamentos via clusters)
    let x = 0, y = 0, z = 0, d2 = 9;
    while (d2 > 1) { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; d2 = x * x + y * y + z * z; }
    const r = 0.35 + 1.85 * Math.cbrt(rnd());
    const p = new THREE.Vector3(x, y * 0.8, z).normalize().multiplyScalar(r);
    const dist = p.distanceTo(stars[0].p);
    const jitter = (rnd() - 0.3) * 2.2;
    stars.push({
      p,
      tIg: T_FIRST + dist / V_FRONT + jitter,
      hue: 0.55 + rnd() * 0.12,         // azul-blanco → algunos cálidos
      big: 0.55 + rnd() * 0.9,
    });
  }
  return stars;
}
const STARS = buildStars();
// radio del frente de ignición en t (para teñir la nube)
function frontR(t: number): number {
  return t < T_FIRST ? 0 : (t - T_FIRST) * V_FRONT;
}

// ── CÁMARA: viaje continuo + teletransportes; RIVAL = 3 tomas Gargantua ──
type Vec3 = [number, number, number];
type Shot = { t0: number; t1: number; from: Vec3; to: Vec3; look: Vec3; look2?: Vec3; fov: number };
const SCALE = 9;  // escala de nube (bin → escena); estrellas en coords de nube ×SCALE
const FIRST: Vec3 = [0.15 * SCALE, -0.1 * SCALE, 0.05 * SCALE];
const SHOTS: Shot[] = [
  // FLASH-FORWARD: dentro del incendio (t simulado del clímax — ver remapTime)
  { t0: 0,    t1: 1.5,  from: [10, 3, 16],  to: [7, 2.5, 12],  look: [0, 0, 0], fov: 46 },
  // A1 LA TRAMPA: lejos, la nube oscura tragando; acercamiento lento
  { t0: 1.5,  t1: 12,   from: [4, 10, 52],  to: [3, 7, 38],    look: [0, 0, 0], fov: 44 },
  // A2 EL FANTASMA: INMERSIÓN — atravesar la nube hacia el corazón oscuro
  { t0: 12,   t1: 22,   from: [3, 7, 38],   to: [2.5, 0.5, 13], look: [0.8, -0.7, 0], fov: 45 },
  // A3 IDEAS: el corazón — la primera ignición EN TU CARA (push-in mínimo)
  { t0: 22,   t1: 32.5, from: [3.4, -0.2, 9.5], to: [2.6, -0.5, 7.8], look: [1.35, -0.9, 0.45], fov: 44 },
  // A4 RIVAL — LAS 3 TOMAS (cortes secos, el caos desde planos distintos):
  { t0: 32.5, t1: 36,   from: [-6, -1, 7],  to: [-4.5, -0.5, 5.5], look: [1.35, -0.9, 0.45], fov: 48 }, // (a) dentro de la corriente
  { t0: 36,   t1: 39.5, from: [5, 1.5, 4],  to: [4.2, 1.2, 3.2],   look: [1.35, -0.9, 0.45], fov: 44 }, // (b) el choque, lateral cerrado
  { t0: 39.5, t1: 43,   from: [0, 14, 11],  to: [0, 12, 9.5],      look: [1.35, -0.9, 0.45], fov: 42 }, // (c) cenital: el tirón
  // A5 NO-RIVAL: plano medio — la 1ª estrella + el nudo vecino que enciende
  { t0: 43,   t1: 51,   from: [6, 0.5, 12], to: [5, 0.2, 10],  look: [2.2, -0.5, 0.3], fov: 43 },
  // A6 SE COPIA GRATIS: retroceso corto — varias igniciones en cuadro
  { t0: 51,   t1: 61,   from: [6, 2.5, 16], to: [7.5, 3.5, 20], look: [0.5, 0, 0], fov: 43 },
  // A7 BOLA DE NIEVE: retroceso largo — el frente barriendo la nube
  { t0: 61,   t1: 70.5, from: [8, 5, 24],   to: [10, 8, 34],   look: [0, 0, 0], fov: 43 },
  // A8 LA RECETA: wide quieto — el cúmulo ardiendo (peak-end)
  { t0: 70.5, t1: 92.1, from: [11, 13, 52], to: [9, 11, 45],   look: [0, 0, 0], fov: 43 },
];
function cameraAt(t: number): { pos: Vec3; look: Vec3; fov: number } {
  let s = SHOTS[SHOTS.length - 1];
  for (const sh of SHOTS) { if (t >= sh.t0 && t < sh.t1) { s = sh; break; } }
  const k = sstep(0, 1, (t - s.t0) / Math.max(0.001, s.t1 - s.t0));
  const bobY = Math.sin(t * 0.42 + s.t0) * 0.07;
  const bobX = Math.cos(t * 0.31 + s.t0 * 2) * 0.05;
  return {
    pos: [lerp(s.from[0], s.to[0], k) + bobX, lerp(s.from[1], s.to[1], k) + bobY, lerp(s.from[2], s.to[2], k)],
    look: s.look, fov: s.fov,
  };
}
// FLASH-FORWARD: los primeros 1.5s muestran el estado del CLÍMAX (t≈66) — el
// tiempo de simulación se remapea; el reloj de cámara sigue siendo t real.
function simTime(t: number): number { return t < 1.5 ? 66 + t * 1.6 : t; }

// ── LA NUBE MOLECULAR (oscura → encendida por el frente) ──
const CLOUD_VERT = /* glsl */ `
attribute float aBright;
uniform float uTime, uFrontR, uHeartGlow, uScale, uPx, uDim, uSettle;
varying vec3 vCol; varying float vA;
float hash(vec3 p){ p=fract(p*0.3183+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  float h2 = hash(floor(position * 91.3) + 3.0);
  float ang = uTime * 0.022;
  mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec3 pr = position; pr.xz = R * pr.xz;

  // distancia al corazón (la 1ª estrella) en coords de NUBE
  float dHeart = distance(position, vec3(0.15, -0.1, 0.05));

  // FRÍA: marrón-ámbar muy tenue con rim azul profundo (nube molecular).
  // ENCENDIDA (dHeart < uFrontR): ámbar→oro vivo + azul cálido cerca de estrellas.
  vec3 cold = mix(vec3(0.45, 0.24, 0.10), vec3(0.15, 0.20, 0.39), smoothstep(0.8, 2.2, length(position)));
  vec3 lit  = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.72, 0.30), h2);
  float ignited = 1.0 - smoothstep(uFrontR - 0.45, uFrontR, dHeart);
  vec3 col = mix(cold, lit, ignited * uSettle);

  // el latido del fantasma (A2): el corazón palpita tenue ANTES de encender
  float ghost = uHeartGlow * exp(-dHeart * 2.2);
  col += vec3(0.45, 0.55, 0.9) * ghost;

  float tw = 0.85 + 0.15 * sin(uTime * (0.6 + h2) + h2 * 6.28);
  vCol = col;
  vA = tw * (0.55 + 0.45 * ignited);
  vec3 p = pr * uScale;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(2.0 * (0.5 + 1.2 * aBright) * (uPx / -mv.z), 7.0);
}`;
const CLOUD_FRAG = /* glsl */ `
precision highp float;
uniform float uExposure, uDim;
varying vec3 vCol; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float a = exp(-r2 * 3.2);
  vec3 c = vCol * (0.030 + 0.155 * vA) * a * uExposure * uDim;
  gl_FragColor = vec4(c, a * vA);
}`;

function MolecularCloud({ time, dimNow, url, layerScale = 1, dim = 1, rotOff = 0, order = -40 }: {
  time: number; dimNow: number; url: string; layerScale?: number; dim?: number; rotOff?: number; order?: number;
}) {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url).then(r => r.arrayBuffer()).then(buf => {
      if (!alive) return;
      const f = new Float32Array(buf);
      const n = Math.floor(f.length / 4);
      const pos = new Float32Array(n * 3);
      const bri = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = f[i * 4]; pos[i * 3 + 1] = f[i * 4 + 1]; pos[i * 3 + 2] = f[i * 4 + 2];
        bri[i] = f[i * 4 + 3];
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aBright', new THREE.BufferAttribute(bri, 1));
      setGeo(g);
    }).catch(e => console.error('[MolecularCloud] no cargó', url, e));
    return () => { alive = false; };
  }, [url]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uFrontR: { value: 0 }, uHeartGlow: { value: 0 }, uSettle: { value: 1 },
      uDim: { value: 1 }, uScale: { value: SCALE * layerScale },
      uExposure: { value: 0.34 * dim }, uPx: { value: 300.0 },
    },
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
  }), [layerScale, dim]);

  useEffect(() => {
    const ts = simTime(time);
    mat.uniforms.uTime.value = ts + rotOff;
    mat.uniforms.uFrontR.value = frontR(ts);
    // el fantasma palpita en A2 (12-22s): tenue, irregular
    const ghostOn = sstep(13, 15, time) * (1 - sstep(21, 23, time));
    mat.uniforms.uHeartGlow.value = ghostOn * (0.35 + 0.3 * Math.sin(ts * 2.1) * Math.sin(ts * 3.7));
    mat.uniforms.uDim.value = dimNow;
    // coda: el fuego asienta a brasa (-30%) para que el titulo y la paz respiren
    mat.uniforms.uSettle.value = 1 - 0.40 * sstep(76, 85, time);
  }, [time, mat, rotOff, dimNow]);

  if (!geo) return null;
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={order} />;
}

// ── LAS CORRIENTES (acreción: el gas que la nube traga — y el RIVAL tug-of-war) ──
const STREAM_VERT = /* glsl */ `
uniform float uTime, uPx, uOn;
attribute float aSeed;
attribute float aSide;
varying vec3 vCol; varying float vA;
float h1(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  float u = fract(h1(aSeed * 3.7) + uTime * 0.09);
  // dos corrientes curvas cayendo al corazón desde lados opuestos
  float side = aSide * 2.0 - 1.0;
  vec3 A = vec3(side * 18.0, 4.0 * side, side * 7.0);
  vec3 B = vec3(side * 7.0, -1.0, side * -3.0);
  vec3 C = vec3(1.35, -0.9, 0.45);            // el corazón (escala escena)
  vec3 p = mix(mix(A, B, u), mix(B, C, u), u); // bezier cuadrática
  // turbulencia que CRECE al caer (la pelea por el gas se ve violenta)
  float w = 1.6 * (1.0 - u * 0.7) + smoothstep(0.75, 1.0, u) * 0.9;
  p += (vec3(h1(aSeed*91.7), h1(aSeed*57.3), h1(aSeed*13.1)) - 0.5) * w;
  // se acelera al caer (energía): brillo crece
  vec3 cold = vec3(0.55, 0.35, 0.18);
  vec3 hot  = vec3(1.0, 0.62, 0.22);
  vCol = mix(cold, hot, u * u);
  vA = uOn * (0.4 + 0.6 * h1(aSeed * 7.7)) * (0.35 + 0.65 * u);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min((1.2 + 1.6 * u) * (uPx / -mv.z), 8.0);
}`;
const STREAM_FRAG = /* glsl */ `
precision highp float;
varying vec3 vCol; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float a = exp(-r2 * 5.0) * vA;
  gl_FragColor = vec4(vCol * a * 0.55, a);
}`;

function AccretionStreams({ time }: { time: number }) {
  const N = 42000;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(N), sides = new Float32Array(N);
    let s = 13579 >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < N; i++) { seeds[i] = rnd(); sides[i] = i % 2; }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    g.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 60);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 200 }, uOn: { value: 1 } },
    vertexShader: STREAM_VERT, fragmentShader: STREAM_FRAG,
  }), []);
  useEffect(() => {
    const ts = simTime(time);
    mat.uniforms.uTime.value = ts;
    // visibles en la trampa (1.5-22) y PROTAGONISTAS en rival (32.5-43); luego ceden
    const on = (1 - sstep(43, 47, time)) * (0.5 + 0.5 * sstep(1.5, 3, time))
             + sstep(32.5, 33.5, time) * (1 - sstep(43, 45, time)) * 0.6;
    mat.uniforms.uOn.value = Math.min(1.2, on);
  }, [time, mat]);
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-35} />;
}

// ── LAS ESTRELLAS: ignición en cadena (cores + halos + flash) ──
const STARS_VERT = /* glsl */ `
uniform float uTime, uPx;
attribute vec3 aPos;
attribute float aTig;
attribute float aHue;
attribute float aBig;
varying vec3 vCol; varying float vA; varying float vFlash;
void main(){
  float dt = uTime - aTig;
  float born = step(0.0, dt);
  // FLASH de ignición: pico brutal 0-0.8s, asienta a brillo estable
  float flash = exp(-max(dt, 0.0) * 2.2) * 3.0;
  float stable = smoothstep(0.0, 0.6, dt) * 1.0;
  float L = born * (stable + flash);
  // color: nace blanco-azul (caliente) → asienta según hue
  vec3 hotC = vec3(0.80, 0.88, 1.0);
  vec3 coolC = mix(vec3(1.0, 0.78, 0.45), vec3(0.72, 0.82, 1.0), step(0.6, aHue));
  vCol = mix(coolC, hotC, clamp(flash * 0.5, 0.0, 1.0));
  vA = L;
  vFlash = flash;
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aBig * (12.0 + flash * 14.0) * (uPx / -mv.z), 220.0);
}`;
const STARS_FRAG = /* glsl */ `
precision highp float;
varying vec3 vCol; varying float vA; varying float vFlash;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  // core duro + halo suave + spikes sutiles (cruz de difracción)
  float core = exp(-r * r * 10.0) * 1.9;
  float halo = exp(-r * 1.8) * 0.85;
  float spikes = exp(-abs(d.x) * 26.0) * exp(-r * 4.0) + exp(-abs(d.y) * 26.0) * exp(-r * 4.0);
  float L = (core + halo + spikes * 0.5) * vA;
  gl_FragColor = vec4(vCol * L, clamp(L, 0.0, 1.0));
}`;

function ClusterStars({ time }: { time: number }) {
  const geo = useMemo(() => {
    const n = STARS.length;
    const pos = new Float32Array(n * 3), tig = new Float32Array(n), hue = new Float32Array(n), big = new Float32Array(n);
    STARS.forEach((st, i) => {
      pos[i * 3] = st.p.x * SCALE; pos[i * 3 + 1] = st.p.y * SCALE; pos[i * 3 + 2] = st.p.z * SCALE;
      tig[i] = st.tIg; hue[i] = st.hue; big[i] = st.big;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPos', new THREE.BufferAttribute(pos.slice(), 3));
    g.setAttribute('aTig', new THREE.BufferAttribute(tig, 1));
    g.setAttribute('aHue', new THREE.BufferAttribute(hue, 1));
    g.setAttribute('aBig', new THREE.BufferAttribute(big, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 40);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 320 } },
    vertexShader: STARS_VERT, fragmentShader: STARS_FRAG,
  }), []);
  useEffect(() => { mat.uniforms.uTime.value = simTime(time); }, [time, mat]);
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-20} />;
}

// ── LETRAS 3D — monumentos extruidos DENTRO del caos (sandwich entre capas) ──
type WordSpec = {
  text: string; t0: number; t1: number; pos: Vec3; rotY: number; rotX?: number;
  size: number; color: string; emissive: number; ghost?: boolean;
};
// Cada palabra ALINEADA a la cámara de su toma (regla de tercios, escorzo 3D).
// RIVAL lleva rotación diagonal (Y+X): se lee distinta en cada una de las 3 tomas.
const WORDS: WordSpec[] = [
  { text: 'LA TRAMPA',      t0: 3.0,  t1: 9.5,  pos: [1.5, 3.2, 8],    rotY: 0.18,  size: 1.3, color: '#cfd8e8', emissive: 0.55 },
  { text: 'EL FANTASMA',    t0: 14.0, t1: 20.5, pos: [1.6, 0.9, 10],   rotY: -0.12, size: 1.1, color: '#7e96d8', emissive: 0.45, ghost: true },
  { text: 'IDEAS',          t0: 26.2, t1: 31.5, pos: [0.8, 0.5, -2.5], rotY: 0.12,  size: 1.5, color: '#ffe9b8', emissive: 1.25 },
  { text: 'RIVAL',          t0: 36.5, t1: 42.5, pos: [0.5, 2.8, -4],   rotY: 0.45,  rotX: -0.35, size: 1.05, color: '#ffb866', emissive: 0.85 },
  { text: 'NO-RIVAL',       t0: 45.5, t1: 50.5, pos: [3.2, 1.2, 4],    rotY: 0.30,  size: 1.1, color: '#bfe3ff', emissive: 0.9 },
  { text: 'SE COPIA GRATIS',t0: 54.5, t1: 60.0, pos: [2.5, 2.0, 8],    rotY: 0.15,  size: 1.0, color: '#ffd98a', emissive: 0.85 },
  { text: 'BOLA DE NIEVE',  t0: 64.5, t1: 69.5, pos: [3.0, 3.5, 12],   rotY: 0.22,  size: 1.3, color: '#eaf2ff', emissive: 0.9 },
  { text: 'LA RECETA',      t0: 73.5, t1: 80.0, pos: [3.0, 4.5, 18],   rotY: -0.06, size: 1.5, color: '#ffdf9e', emissive: 1.0 },
];

function Words3D({ time, font }: { time: number; font: Font | null }) {
  const group = useMemo(() => {
    if (!font) return null;
    const g = new THREE.Group();
    for (const w of WORDS) {
      const geo = new TextGeometry(w.text, {
        font, size: w.size, depth: w.size * 0.28,
        curveSegments: 8, bevelEnabled: true,
        bevelThickness: w.size * 0.04, bevelSize: w.size * 0.025, bevelSegments: 2,
      });
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const cx = (bb.max.x + bb.min.x) / 2, cy = (bb.max.y + bb.min.y) / 2;
      geo.translate(-cx, -cy, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(w.color).multiplyScalar(w.emissive),
        transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(w.pos[0], w.pos[1], w.pos[2]);
      mesh.rotation.y = w.rotY;
      if (w.rotX) mesh.rotation.x = w.rotX;
      mesh.renderOrder = -45;   // sandwich: detrás de la capa media de nube (-40)
      mesh.userData.spec = w;
      g.add(mesh);
    }
    return g;
  }, [font]);

  useFrame(() => {
    if (!group) return;
    const t = (window as unknown as { __ideasT?: number }).__ideasT ?? 0;
    for (const m of group.children as THREE.Mesh[]) {
      const w = m.userData.spec as WordSpec;
      const o = sstep(w.t0, w.t0 + 0.9, t) * (1 - sstep(w.t1 - 1.0, w.t1, t));
      const flicker = w.ghost ? 0.55 + 0.45 * Math.sin(t * 5.1) * Math.sin(t * 2.3) : 1;
      (m.material as THREE.MeshBasicMaterial).opacity = o * 0.92 * flicker;
      // micro-deriva: la letra VIVE (parallax extra contra la nube)
      m.position.y = w.pos[1] + Math.sin(t * 0.3 + w.t0) * 0.12;
    }
  });

  if (!group) return null;
  return <primitive object={group} />;
}

// ── FONDO + STARFIELD ──
function DeepBackground() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vP;
      void main(){
        float u = normalize(vP).y * 0.5 + 0.5;
        vec3 top = vec3(0.010, 0.018, 0.050);
        vec3 mid = vec3(0.018, 0.012, 0.036);
        vec3 bot = vec3(0.040, 0.020, 0.014);
        vec3 c = mix(bot, mid, smoothstep(0.0, 0.45, u));
        c = mix(c, top, smoothstep(0.45, 1.0, u));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }), []);
  return <mesh material={mat}><sphereGeometry args={[400, 24, 24]} /></mesh>;
}
function Starfield() {
  const geo = useMemo(() => {
    const N = 5200;
    let s = 24681357 >>> 0;
    const rnd = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let z = Math.imul(s ^ (s >>> 15), 1 | s);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
    const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3); const sz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let x = 0, y = 0, z = 0, d2 = 2;
      while (d2 > 1 || d2 < 1e-4) { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; d2 = x * x + y * y + z * z; }
      const r = 300 / Math.sqrt(d2);
      pos[i * 3] = x * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = z * r;
      const u = rnd();
      const c = u < 0.78 ? [0.75, 0.85, 1.0] : u < 0.93 ? [1.0, 0.95, 0.85] : [1.0, 0.72, 0.45];
      const b = 0.35 + 0.65 * rnd() * rnd();
      col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
      sz[i] = 1.1 + 3.0 * rnd() * rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSz', new THREE.BufferAttribute(sz, 1));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aCol; attribute float aSz;
      varying vec3 vC;
      void main(){
        vC = aCol;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSz;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vC;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d, d);
        if (r2 > 0.25) discard;
        float a = exp(-r2 * 7.0);
        gl_FragColor = vec4(vC * a * 0.85, a);
      }`,
  }), []);
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-60} />;
}

// ── Rig + driver + overlays ──
function CameraRig({ time, vertical }: { time: number; vertical: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    const { pos, look, fov } = cameraAt(time);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(look[0], look[1], look[2]);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = vertical ? fov * 1.38 : fov;
    cam.near = 0.1; cam.far = 900;
    cam.updateProjectionMatrix();
  }, [time, camera, vertical]);
  return null;
}
function FrameDriver({ time }: { time: number }) {
  const { invalidate } = useThree();
  useEffect(() => {
    (window as unknown as { __ideasT: number }).__ideasT = time;
    invalidate();
  }, [time, invalidate]);
  return null;
}
function TitleCoda({ time, vertical }: { time: number; vertical: boolean }) {
  const o = sstep(83, 85, time);
  if (o < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', bottom: vertical ? '16%' : '14%', left: 0, right: 0,
      textAlign: 'center', zIndex: 11, pointerEvents: 'none', opacity: o,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        fontSize: vertical ? '7vw' : '2.5vw', fontWeight: 200, color: '#fff',
        letterSpacing: '-0.02em', textShadow: '0 4px 40px rgba(0,0,0,0.9)',
      }}>
        Cómo crecer sin dinero
      </div>
      <div style={{
        marginTop: vertical ? '1.6vw' : 10,
        fontSize: vertical ? '3vw' : '0.9vw', fontWeight: 400,
        color: 'rgba(255,255,255,0.55)', letterSpacing: '0.18em',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      }}>
        LAS IDEAS · ROMER · NOBEL 2018
      </div>
    </div>
  );
}

// ── Main ──
function CinematicIdeasInner({ live = false }: { live?: boolean }) {
  const [time, setTime] = useState(0);
  const [font, setFont] = useState<Font | null>(null);
  const [vertical, setVertical] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth,
  );
  useEffect(() => {
    const onR = () => setVertical(window.innerHeight > window.innerWidth);
    onR(); window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  useEffect(() => {
    new FontLoader().load('/fonts/helvetiker_bold.typeface.json', f => setFont(f));
  }, []);

  useEffect(() => {
    if (live) return;
    const api = {
      renderAt: (t: number) => setTime(Math.max(0, Math.min(DURATION, t))),
      ready: true,
      duration: DURATION,
      beats: [
        { name: 'FF-flashforward', t0: 0, t1: 1.5 },
        { name: 'A1-trampa', t0: 1.5, t1: 12 },
        { name: 'A2-fantasma', t0: 12, t1: 22 },
        { name: 'A3-ideas', t0: 22, t1: 32.5 },
        { name: 'A4-rival-3tomas', t0: 32.5, t1: 43 },
        { name: 'A5-norival', t0: 43, t1: 51 },
        { name: 'A6-gratis', t0: 51, t1: 61 },
        { name: 'A7-bola', t0: 61, t1: 70.5 },
        { name: 'A8-receta', t0: 70.5, t1: DURATION },
      ],
    };
    (window as unknown as { __cinematicIdeas: typeof api }).__cinematicIdeas = api;
    return () => { delete (window as unknown as { __cinematicIdeas?: unknown }).__cinematicIdeas; };
  }, [live]);

  useEffect(() => {
    if (!live) return;
    let raf = 0, start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      setTime(((now - start) / 1000) % DURATION);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  const dimNow = useMemo(() => {
    const { pos } = cameraAt(time);
    const d = Math.hypot(pos[0], pos[1], pos[2]);
    return clamp01(lerp(0.45, 1.0, (d - 8) / 26));
  }, [time]);

  return (
    <div style={{ position: live ? 'absolute' : 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        flat={false}
        camera={{ position: [4, 10, 52], fov: 44, near: 0.1, far: 900 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]}
        frameloop="always"
        style={{ background: '#000' }}
      >
        <color attach="background" args={['#04050c']} />
        <FrameDriver time={time} />
        <CameraRig time={time} vertical={vertical} />
        <DeepBackground />
        <Starfield />
        {/* sandwich: capa trasera (-50) · LETRAS (-45) · capa media (-40) */}
        <MolecularCloud time={time} dimNow={dimNow} url="/limones-nebula.bin" layerScale={2.1} dim={0.35} rotOff={37} order={-50} />
        <Words3D time={time} font={font} />
        <MolecularCloud time={time} dimNow={dimNow} url="/limones-nebula.bin" order={-40} />
        <AccretionStreams time={time} />
        <ClusterStars time={time} />
        {!live && (
          <CinematicPostFX preset="pulsar" bloomIntensity={0.6} bloomThreshold={0.34}
            saturation={0.22} contrast={0.16} grainOpacity={0.07} vignetteDarkness={0.6} />
        )}
      </Canvas>
      {!live && <TitleCoda time={time} vertical={vertical} />}
    </div>
  );
}

export default memo(CinematicIdeasInner);
