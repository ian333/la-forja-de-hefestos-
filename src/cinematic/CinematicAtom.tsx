/**
 * CinematicAtom v3 — cinema, no documental.
 *
 *   "El átomo no es un objeto. Es un evento."
 *   "El asombro no está en el núcleo. Está en el VACÍO que cruzas para llegar."
 *
 * Estructura cinemática (18s — escenas largas, todo respira):
 *   CUT 1  0.0-3.0s    DESPERTAR — close-up íntimo, capas nacen
 *   CUT 2  3.0-10.5s   VIAJE — LA CAÍDA por la nada: dejas la nube, cruzas el
 *                      vacío (el átomo es 99.9999% espacio vacío), el núcleo
 *                      es un punto lejano que crece. Powers of Ten honesto.
 *   CUT 3  10.5-15.0s  MIRADA — 4.5s desde el núcleo; los electrones son estrellas
 *   CUT 4  15.0-18.0s  REGRESO — zoom out; el átomo se reforma COMPLETO y
 *                      aterriza ~17s, sostiene, luego se disuelve en el logo
 *
 * Núcleo = cúmulo de nucleones con shader propio: densidad de estrella de
 * neutrones (fresnel que sangra luz) + tensión de fuerza fuerte (micro-vibración
 * + pulso de energía contenida). NO meshStandard — eso eran caramelos glow.
 *
 * Tiempo determinista: window.__cinematicAtom.renderAt(t) ∈ [0, 15].
 */

import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, BrightnessContrast, HueSaturation, ToneMapping, Noise } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import {
  elementByZ, type Element,
} from '@/lib/chem/quantum/periodic-table';
import {
  populateAtom, atomExtent, nucleusInfo,
  subshellColor, subshellLabel,
  type PopulatedOrbital,
} from '@/lib/chem/quantum/atom-builder';
import { ORBITALS, sampleOrbital } from '@/lib/chem/quantum/orbitals';

// Duración VARIABLE por # de subcapas: el zoom-out (regreso) dura MÁS en átomos
// con muchas órbitas, para que la cascada de capas/etiquetas alcance a terminar
// completa antes de disolverse en el logo (lo pidió el user). 18s base, cap 23s.
let RUN_DURATION = 18;
function durationForShells(n: number): number {
  return Math.min(23, Math.max(18, Math.round((17.0 + n * 0.32) * 10) / 10));
}
const SAMPLES_PER_ELECTRON = 6000;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
export function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
function fadeIn(time: number, start: number, dur = 0.9): number {
  return smoothstep((time - start) / dur);
}

// ── CUT SYSTEM ─────────────────────────────────────────────────────
type Vec3 = [number, number, number];
type CutSpec = {
  t0: number; t1: number;
  cam: (localT: number, extent: number) => {
    pos: Vec3;
    lookAt?: Vec3;       // optional off-center look
    fov: number;
  };
  bloom: number;
  vignette: number;
  chroma?: boolean;
  name: string;
};

function sph(dist: number, elev: number, azim: number): Vec3 {
  return [
    dist * Math.cos(elev) * Math.cos(azim),
    dist * Math.sin(elev),
    dist * Math.cos(elev) * Math.sin(azim),
  ];
}

const CUTS: CutSpec[] = [
  {
    // 0.0-3.0s · DESPERTAR — cámara CERCA, íntimo, capas nacen
    t0: 0.0, t1: 3.0, name: 'despertar', bloom: 0.70, vignette: 0.55,
    cam: (t, ex) => {
      const dist = lerp(ex * 0.55, ex * 0.95, smoothstep(t));
      const azim = -0.3 + t * 0.50;
      const elev = lerp(0.10, 0.28, smoothstep(t));
      return { pos: sph(dist, elev, azim), fov: lerp(30, 34, smoothstep(t)) };
    },
  },
  {
    // 3.0-10.5s · LA CAÍDA (7.5s) — Powers of Ten honesto. Caída a velocidad
    // logarítmica casi constante (e≈t): dejas la nube en ~2s y luego cruzas el
    // VACÍO — segundos de casi-nada donde el núcleo es un puntito lejano que
    // crece, los electrones son estrellas dispersas. FOV estable = dolly puro.
    t0: 3.0, t1: 10.5, name: 'viaje', bloom: 0.50, vignette: 0.62,
    cam: (t, ex) => {
      const e = Math.pow(t, 0.82);                  // ligeramente adelantado
      const dist = ex * 0.95 * Math.pow(1 / 136, e); // → ex·0.007 (ve el cúmulo entero)
      const azim = 0.4 + t * 0.50;                   // espiral lenta y continua
      const elev = lerp(0.28, 0.0, e);
      return { pos: sph(dist, elev, azim), lookAt: [0, 0, 0], fov: 32 };
    },
  },
  {
    // 10.5-15.0s · MIRADA (4.5s) — DESDE el núcleo. Órbita lenta, cielo estrellado.
    t0: 10.5, t1: 15.0, name: 'mirada', bloom: 0.55, vignette: 0.50,
    cam: (t, ex) => {
      const nucDist = ex * 0.007;                    // ve el cúmulo COMPLETO, no encima
      const azim = 2.4 + t * 0.30;
      const bob = Math.sin(t * Math.PI * 0.5) * 0.05;
      return { pos: sph(nucDist, 0.02 + bob, azim), lookAt: [0, 0, 0], fov: 38 };
    },
  },
  {
    // 15.0s → RUN_DURATION · REGRESO (3-8s, VARIABLE) — zoom out; el átomo se
    // reforma completo, ATERRIZA al 62% del corte, sostiene, y se disuelve en el
    // logo. Más capas → regreso más largo → la cascada de etiquetas TERMINA.
    // (t1 es placeholder; findCut usa RUN_DURATION como fin real)
    t0: 15.0, t1: 99.0, name: 'regreso', bloom: 0.62, vignette: 0.75,
    cam: (t, ex) => {
      const land = smoothstep(Math.min(1, t / 0.62));         // llega al átomo lleno ~16.85s
      const dist = ex * 0.007 * Math.pow(170, land);          // → ex·1.2
      const azim = 2.9 + t * 0.40;
      const elev = lerp(0.02, 0.34, land);
      return { pos: sph(dist, elev, azim), lookAt: [0, 0, 0], fov: lerp(38, 28, land) };
    },
  },
];

// Hueco de la nube según el momento. Normalmente pequeño (solo el núcleo). Al
// VIAJAR al núcleo, el hueco CRECE para vaciar el centro de electrones: así no
// se quema, el cúmulo de nucleones se ve limpio, y los electrones lejanos
// quedan como cielo estrellado alrededor.
function holeForTime(time: number, nucR: number, ex: number): number {
  void ex;
  const base = nucR * 0.9;
  const deep = nucR * 3.2;                            // limpia el entorno del cúmulo
  if (time < 3.5) return base;
  if (time < 10.5) return lerp(base, deep, smoothstep((time - 3.5) / 6.0));
  if (time < 15.0) return deep;
  return lerp(deep, base, smoothstep((time - 15.0) / 2.0));
}

function findCut(time: number): { cut: CutSpec; localT: number; isCutBoundary: boolean } {
  for (const cut of CUTS) {
    // El regreso termina en RUN_DURATION (variable), no en su t1 placeholder.
    const t1 = cut.name === 'regreso' ? RUN_DURATION : cut.t1;
    if (time >= cut.t0 && time < t1) {
      const localT = (time - cut.t0) / (t1 - cut.t0);
      const isCutBoundary = (time - cut.t0) < 0.04;
      return { cut, localT, isCutBoundary };
    }
  }
  // After end → last cut at t=1
  const cut = CUTS[CUTS.length - 1];
  return { cut, localT: 1, isCutBoundary: false };
}

// Reveal de la NUBE — todas las capas visibles en el despertar (antes del viaje).
function shellRevealTime(idx: number, total: number): number {
  if (total <= 1) return 0.3;
  return 0.3 + (idx / Math.max(1, total - 1)) * 1.7;
}

// Cascada de ETIQUETAS — durante el regreso (15s → RUN_DURATION), una capa tras
// otra conforme la cámara sale. Se reparte sobre todo el regreso variable, así
// que termina justo antes del cierre sin importar cuántas capas haya.
function shellLabelTime(idx: number, total: number): number {
  const start = 15.4, end = RUN_DURATION - 0.8;
  if (total <= 1) return start;
  return start + (idx / Math.max(1, total - 1)) * (end - start);
}

// ── Sample bundle ───────────────────────────────────────────────────
export interface AtomBundle {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  shellIdx: Float32Array;
  shells: { label: string; n: number; l: number; color: THREE.Color }[];
}

export function buildAtomBundle(element: Element): AtomBundle {
  const populated = populateAtom(element);
  const subshellGroups = new Map<string, { orbs: PopulatedOrbital[]; total: number; n: number; l: number }>();
  for (const o of populated) {
    const key = subshellLabel(o.n, o.l);
    const g = subshellGroups.get(key) ?? { orbs: [], total: 0, n: o.n, l: o.l };
    g.orbs.push(o);
    g.total += o.electrons;
    subshellGroups.set(key, g);
  }

  const shells = Array.from(subshellGroups.entries())
    .sort((a, b) => {
      const ga = a[1], gb = b[1];
      return ga.n !== gb.n ? ga.n - gb.n : ga.l - gb.l;
    })
    .map(([label, g]) => ({
      label, n: g.n, l: g.l,
      color: new THREE.Color(subshellColor(g.n, g.l)),
    }));

  const totalElectrons = populated.reduce((s, o) => s + o.electrons, 0);
  // Puntos por electrón ADAPTATIVO: en átomos pesados (muchos electrones) bajamos
  // las muestras para que el total no sature — el "cielo estrellado" del viaje
  // queda esparcido (estrellas reales) en vez de un campo de confeti.
  const spe = Math.min(SAMPLES_PER_ELECTRON, Math.max(1500, Math.floor(120000 / totalElectrons)));
  const totalPts = totalElectrons * spe;

  const positions = new Float32Array(totalPts * 3);
  const colors = new Float32Array(totalPts * 3);
  const sizes = new Float32Array(totalPts);
  const shellIdx = new Float32Array(totalPts);

  let cursor = 0;
  for (let si = 0; si < shells.length; si++) {
    const shellKey = shells[si].label;
    const baseColor = shells[si].color;
    const g = subshellGroups.get(shellKey)!;
    for (const orb of g.orbs) {
      const orbital = ORBITALS[orb.orbitalKey];
      if (!orbital) continue;
      const npts = orb.electrons * spe;
      const pts = sampleOrbital(orbital, npts, orb.Zeff, 42 + si * 17 + orb.n);
      for (const p of pts) {
        positions[cursor * 3 + 0] = p.x;
        positions[cursor * 3 + 1] = p.y;
        positions[cursor * 3 + 2] = p.z;
        const tint = baseColor.clone();
        if (p.sign < 0) tint.offsetHSL(-0.05, 0.05, -0.02);
        const bright = 0.55 + 0.6 * p.density;
        colors[cursor * 3 + 0] = tint.r * bright;
        colors[cursor * 3 + 1] = tint.g * bright;
        colors[cursor * 3 + 2] = tint.b * bright;
        sizes[cursor] = 0.045 + 0.10 * p.density;
        shellIdx[cursor] = si;
        cursor++;
      }
    }
  }
  return {
    positions: positions.subarray(0, cursor * 3),
    colors: colors.subarray(0, cursor * 3),
    sizes: sizes.subarray(0, cursor),
    shellIdx: shellIdx.subarray(0, cursor),
    shells,
  };
}

function makeSpriteTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const POINTS_VERT = /* glsl */ `
uniform float uRevealMask[16];
uniform float uGlobalRot;
uniform float uTime;
uniform float uHoleR;
uniform float uBright;
uniform float uBokeh;
attribute vec3 aColor;
attribute float aSize;
attribute float aShellIdx;
varying vec3 vCol;
varying float vAlpha;
varying float vBokeh;

void main() {
  int idx = int(aShellIdx + 0.5);
  float reveal = uRevealMask[idx];
  vCol = aColor;

  // Hueco nuclear: no dibujar electrones dentro del radio del núcleo, para que
  // el cúmulo de nucleones quede limpio en el centro y las capas se vean AFUERA.
  if (length(position) < uHoleR) {
    vAlpha = 0.0; gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  // Fase única por electrón (hash de su posición de muestreo)
  float ph = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831853;

  // Rotación global de la nube
  float c = cos(uGlobalRot), s = sin(uGlobalRot);
  vec3 p = vec3(c * position.x + s * position.z, position.y, -s * position.x + c * position.z);

  // Movimiento cuántico: respiración radial + circulación tangencial.
  // La densidad PROMEDIO (|ψ|²) se conserva — esto comunica que el electrón
  // no es un punto fijo, sino una probabilidad viva. La circulación tangencial
  // es la corriente de probabilidad real de los orbitales con momento angular.
  float r = length(p) + 1e-4;
  vec3 radial = p / r;
  vec3 tang = normalize(vec3(-p.z, 0.0, p.x) + vec3(1e-4));
  float breath = sin(uTime * 1.6 + ph);
  float swirl  = sin(uTime * 1.1 + ph * 1.7);
  p += radial * (0.018 * r * breath) + tang * (0.020 * r * swirl);

  // Aparecer / desaparecer: cada electrón parpadea dentro y fuera de existencia
  // con su propio ritmo y fase. ASÍ es la mecánica cuántica — no es un punto
  // fijo, es una probabilidad que se manifiesta aquí, luego allá. En cada
  // instante solo una fracción está "presente"; el promedio es |ψ|².
  float u = fract(ph * 0.15915494);              // 0..1 por punto
  float rate = 0.55 + 1.05 * u;                  // ritmo distinto por electrón
  float life = fract(uTime * rate + u);          // ciclo de vida
  float pulse = smoothstep(0.0, 0.20, life) * (1.0 - smoothstep(0.50, 1.0, life));
  vAlpha = reveal * pulse * uBright;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // BOKEH (profundidad de campo) — solo cuando uBokeh>0 (moléculas, cámara
  // acotada). Foco en el centro de la nube (origen); los puntos lejos del plano
  // de foco se vuelven discos suaves y tenues = lente real. En átomos uBokeh=0.
  float focusDepth = -(modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
  float coc = uBokeh > 0.0001 ? clamp(abs(-mv.z - focusDepth) * uBokeh - 0.12, 0.0, 1.0) : 0.0;
  vBokeh = coc;
  float spread = 1.0 + coc * 4.0;
  float maxSz = uBokeh > 0.0001 ? 58.0 : 22.0;
  gl_PointSize = clamp(aSize * 520.0 * (0.7 + 0.5 * pulse) / -mv.z * spread, 1.0, maxSz);
}
`;
const POINTS_FRAG = /* glsl */ `
uniform sampler2D uSprite;
varying vec3 vCol;
varying float vAlpha;
varying float vBokeh;
void main() {
  vec2 uv = gl_PointCoord;
  vec4 t = texture2D(uSprite, uv);
  float a = t.a * vAlpha;
  // bokeh: el disco desenfocado reparte su energía → más tenue y plano
  a *= mix(1.0, 0.32, vBokeh);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol, a);
}
`;

export function ElectronCloud({ bundle, time, holeRadius = 0, brightness = 1, bokeh = 0, rotRate = 0.55 }: { bundle: AtomBundle; time: number; holeRadius?: number; brightness?: number; bokeh?: number; rotRate?: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const sprite = useMemo(() => makeSpriteTexture(), []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(bundle.positions, 3));
    g.setAttribute('aColor',   new THREE.BufferAttribute(bundle.colors,    3));
    g.setAttribute('aSize',    new THREE.BufferAttribute(bundle.sizes,     1));
    g.setAttribute('aShellIdx',new THREE.BufferAttribute(bundle.shellIdx,  1));
    return g;
  }, [bundle]);

  const uniforms = useMemo(() => ({
    uSprite:     { value: sprite },
    uRevealMask: { value: new Float32Array(16) },
    uGlobalRot:  { value: 0 },
    uTime:       { value: 0 },
    uHoleR:      { value: 0 },
    uBright:     { value: 1 },
    uBokeh:      { value: 0 },
  }), [sprite]);

  useEffect(() => {
    if (!matRef.current) return;
    const mask = matRef.current.uniforms.uRevealMask.value as Float32Array;
    for (let i = 0; i < 16; i++) {
      if (i >= bundle.shells.length) { mask[i] = 0; continue; }
      const revealAt = shellRevealTime(i, bundle.shells.length);
      mask[i] = fadeIn(time, revealAt, 0.85);
    }
    // rotRate=0 en moléculas (la nube debe quedar alineada con los núcleos; la
    // cámara orbita). En átomos gira para dar vida al cúmulo.
    matRef.current.uniforms.uGlobalRot.value = time * rotRate;
    matRef.current.uniforms.uTime.value = time;
    matRef.current.uniforms.uHoleR.value = holeRadius;
    matRef.current.uniforms.uBright.value = brightness;
    matRef.current.uniforms.uBokeh.value = bokeh;
    matRef.current.uniformsNeedUpdate = true;
  }, [time, bundle.shells.length, holeRadius, brightness, bokeh, rotRate]);

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={POINTS_VERT}
        fragmentShader={POINTS_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Núcleo como cúmulo de nucleones reales: protones (rojos) + neutrones (gris-azul).
// En close-up se distinguen; en wide se funden en un punto brillante (bloom).
function nucleonField(protons: number, neutrons: number, Rc: number) {
  const total = Math.max(1, protons + neutrons);
  let s = (Math.imul(total, 2654435761) >>> 0) || 1;
  const rnd = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // cúmulo DENSO de nucleones PEQUEÑOS — grano fino (más realista, como un
  // núcleo real de muchos nucleones diminutos), con ligero traslape para que
  // se funda en masa y no se vean como bolas grandes separadas.
  const rn = (Rc / Math.cbrt(total)) * (total <= 2 ? 0.95 : 1.05);
  const inner = Math.max(0, Rc - rn * 0.30);
  const types: number[] = [];
  for (let i = 0; i < protons; i++) types.push(1);
  for (let i = 0; i < neutrons; i++) types.push(0);
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  const pos: Vec3[] = [];
  for (let i = 0; i < total; i++) {
    let x = 0, y = 0, z = 0, d2 = 2;
    while (d2 > 1 || d2 < 1e-4) { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; d2 = x * x + y * y + z * z; }
    const rr = Math.cbrt(rnd()) * inner, inv = rr / Math.sqrt(d2);
    pos.push([x * inv, y * inv, z * inv]);
  }
  return { total, pos, types, rn };
}

// Shader de nucleón — NO meshStandard (eso eran caramelos glow). Densidad de
// estrella de neutrones (fresnel que sangra luz HDR por los bordes) + tensión
// de fuerza fuerte (micro-vibración por nucleón) + pulso de energía contenida.
const NUCLEON_VERT = /* glsl */ `
uniform float uTime;
uniform float uVib;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
varying float vPh;
void main() {
  #ifdef USE_INSTANCING
    mat4 im = instanceMatrix;
  #else
    mat4 im = mat4(1.0);
  #endif
  vec3 center = im[3].xyz;
  // fase única por nucleón (hash de su posición en el cúmulo)
  float ph = fract(sin(dot(center, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831853;
  vPh = ph;
  vObj = normalize(position);                  // dirección de superficie (para turbulencia)
  // micro-vibración VIOLENTA: la fuerza fuerte amarra a los nucleones, tiemblan
  // unidos a alta frecuencia. Amplitud en espacio unidad → escala con rn.
  vec3 vib = vec3(
    sin(uTime * 33.0 + ph),
    cos(uTime * 29.0 + ph * 1.3),
    sin(uTime * 37.0 + ph * 0.7)
  ) * uVib;
  vec4 mvPosition = modelViewMatrix * im * vec4(position + vib, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;
// Diseño MOLTEN/SALVAJE: superficie de metal fundido / plasma que FLUYE
// (turbulencia, no esfera lisa) — valles oscuros, crestas blancas-incandescentes
// que sangran luz. Iridiscencia como TORNASOL en el borde (no domina). Specular
// PULIDO agudo. Pulso + crepitar violento. La fuerza más salvaje del universo.
const NUCLEON_FRAG = /* glsl */ `
uniform vec3 uHot;        // color incandescente (oro fundido / plasma)
uniform float uHueBase;   // sesgo de matiz de la iridiscencia (cálido vs frío)
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
varying float vPh;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  float ndv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - ndv, 1.7);

  // TURBULENCIA — superficie molten que fluye. Capas de seno sobre la posición
  // de superficie + tiempo = crestas calientes y valles oscuros (vPh decorrela
  // cada nucleón). NO una esfera lisa de videojuego.
  vec3 q = vObj * 5.0 + vec3(vPh) + vec3(0.0, uTime * 0.35, 0.0);
  float tt = sin(q.x * 1.7 + q.y) + sin(q.y * 1.3 - q.z * 1.1) + sin(q.z * 1.9 + q.x * 0.7);
  float turb = pow(clamp(tt / 3.0 * 0.5 + 0.5, 0.0, 1.0), 1.4);

  // base MOLTEN — incandescente profundo modulado por turbulencia
  vec3 col = uHot * mix(0.18, 1.25, turb);

  // grietas INCANDESCENTES — las crestas más calientes sangran luz blanca
  col += uHot * smoothstep(0.72, 1.0, turb) * 1.4;

  // iridiscencia como TORNASOL en el borde (sheen, intenso pero no domina)
  float band = fres * 2.4 + uHueBase + vPh * 0.1;
  vec3 iri = 0.5 + 0.5 * cos(6.2831853 * (band + vec3(0.0, 0.33, 0.67)));
  col += pow(iri, vec3(0.6)) * fres * 1.3;

  // PULIDO — specular agudo (superficie reflejante, no mate)
  vec3 L = normalize(vec3(0.4, 0.6, 0.75));
  vec3 H = normalize(V + L);
  col += vec3(2.0, 1.95, 1.9) * pow(max(dot(N, H), 0.0), 120.0);

  // VIOLENCIA — pulso lento + crepitar de alta frecuencia
  float pulse = 0.82 + 0.18 * sin(uTime * 3.0 + vPh)
                     + 0.12 * sin(uTime * 21.0 + vPh * 2.3);
  col *= pulse;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function Nucleus({ protons, neutrons, time, clusterRadius = 0.1 }: { protons: number; neutrons: number; time: number; clusterRadius?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const pRef = useRef<THREE.InstancedMesh>(null);
  const nRef = useRef<THREE.InstancedMesh>(null);
  const pMat = useRef<THREE.ShaderMaterial>(null);
  const nMat = useRef<THREE.ShaderMaterial>(null);
  const field = useMemo(() => nucleonField(protons, neutrons, clusterRadius), [protons, neutrons, clusterRadius]);
  // posiciones separadas por tipo → un instancedMesh por color (robusto, sin instanceColor)
  const split = useMemo(() => {
    const pPos: Vec3[] = [], nPos: Vec3[] = [];
    field.pos.forEach((p, i) => (field.types[i] ? pPos : nPos).push(p));
    return { pPos, nPos };
  }, [field]);

  // uniforms ESTABLES (ver feedback_r3f_stable_uniforms). Iridiscencia + núcleo
  // incandescente. Protón = sesgo cálido (oro-magenta), neutrón = sesgo frío
  // (cian-violeta). Distinguibles, pero NUNCA el rojo/azul plano de siempre.
  const pUniforms = useMemo(() => ({
    uTime: { value: 0 }, uVib: { value: 0.07 },
    uHot: { value: new THREE.Color(2.4, 1.05, 0.28) },    // ORO FUNDIDO (protón)
    uHueBase: { value: 0.04 },                            // tornasol oro-magenta
  }), []);
  const nUniforms = useMemo(() => ({
    uTime: { value: 0 }, uVib: { value: 0.07 },
    uHot: { value: new THREE.Color(0.95, 0.65, 2.6) },    // PLASMA violeta-azul (neutrón)
    uHueBase: { value: 0.46 },                            // tornasol cian-violeta
  }), []);

  useEffect(() => {
    const m = new THREE.Matrix4();
    const fill = (mesh: THREE.InstancedMesh | null, pts: Vec3[]) => {
      if (!mesh) return;
      for (let i = 0; i < pts.length; i++) {
        m.makeScale(field.rn, field.rn, field.rn);
        m.setPosition(pts[i][0], pts[i][1], pts[i][2]);
        mesh.setMatrixAt(i, m);
      }
      mesh.count = pts.length;
      mesh.instanceMatrix.needsUpdate = true;
    };
    fill(pRef.current, split.pPos);
    fill(nRef.current, split.nPos);
  }, [split, field.rn]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.5;
      groupRef.current.rotation.x = time * 0.22;
      groupRef.current.scale.setScalar(smoothstep(time / 0.5));
    }
    if (pMat.current) pMat.current.uniforms.uTime.value = time;
    if (nMat.current) nMat.current.uniforms.uTime.value = time;
  }, [time]);

  return (
    <group ref={groupRef}>
      <instancedMesh ref={pRef} frustumCulled={false} args={[undefined as never, undefined as never, Math.max(1, split.pPos.length)]}>
        <sphereGeometry args={[1, 24, 24]} />
        <shaderMaterial ref={pMat} uniforms={pUniforms} vertexShader={NUCLEON_VERT} fragmentShader={NUCLEON_FRAG} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={nRef} frustumCulled={false} args={[undefined as never, undefined as never, Math.max(1, split.nPos.length)]}>
        <sphereGeometry args={[1, 24, 24]} />
        <shaderMaterial ref={nMat} uniforms={nUniforms} vertexShader={NUCLEON_VERT} fragmentShader={NUCLEON_FRAG} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// Variación de trayectoria por elemento — PREPARADO, off por default (tv=0).
// Activar pasando ?tv=0.3 en la URL: cada Z obtiene un giro orbital + distancia
// ligeramente distintos (determinista), para que los 50 no se muevan idénticos.
// Con tv=0 el resultado es EXACTAMENTE el de los CUTS originales (no-op).
function trajectoryOffset(seed: number, tv: number): { dAzim: number; dElev: number; dDist: number } {
  if (tv <= 0) return { dAzim: 0, dElev: 0, dDist: 1 };
  let s = (Math.imul(seed || 1, 2654435761)) >>> 0;
  const rnd = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    dAzim: (rnd() - 0.5) * tv * 1.4,
    dElev: (rnd() - 0.5) * tv * 0.4,
    dDist: 1 + (rnd() - 0.5) * tv * 0.25,
  };
}

export function CameraRig({ extent, time, vertical, tv, seed }: {
  extent: number; time: number; vertical: boolean; tv: number; seed: number;
}) {
  const { camera } = useThree();
  useEffect(() => {
    const { cut, localT } = findCut(time);
    const { pos, fov, lookAt } = cut.cam(localT, extent);

    // Perturbación de trayectoria (no-op si tv=0)
    const off = trajectoryOffset(seed, tv);
    let px = pos[0] * off.dDist, py = pos[1] * off.dDist, pz = pos[2] * off.dDist;
    if (off.dAzim !== 0) {
      const ca = Math.cos(off.dAzim), sa = Math.sin(off.dAzim);
      const rx = ca * px + sa * pz, rz = -sa * px + ca * pz;
      px = rx; pz = rz;
    }
    if (off.dElev !== 0) py += off.dElev * Math.hypot(px, pz);
    camera.position.set(px, py, pz);

    let la = lookAt ?? [0, 0, 0];
    // En vertical, los off-center horizontales (regla de tercios de 16:9) dejan
    // el átomo pegado a un lado con mucho vacío. Centramos en X/Z, suavizamos Y.
    if (vertical) la = [0, la[1] * 0.5, 0];
    camera.lookAt(la[0], la[1], la[2]);
    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      const cam = camera as THREE.PerspectiveCamera;
      // FOV de three es vertical; en 9:16 el frame angosto recortaría el átomo
      // por los lados, así que ampliamos el campo para que respire y componga.
      cam.fov = vertical ? fov * 1.42 : fov;
      // near/far DINÁMICOS: el viaje al núcleo llega a distancias minúsculas;
      // sin esto la cámara recortaría todo. near sigue a la distancia actual.
      const d = Math.hypot(px, py, pz);
      cam.near = Math.max(1e-4, d * 0.02);
      cam.far = Math.max(200, extent * 30);
      cam.updateProjectionMatrix();
    }
  }, [time, extent, camera, vertical, tv, seed]);
  return null;
}

export function FrameDriver({ time }: { time: number }) {
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [time, invalidate]);
  return null;
}

export function DynamicPostFX({ time }: { time: number }) {
  // Resolve cut-driven postFX params for current time
  const { cut, isCutBoundary } = findCut(time);
  const bloomIntensity = cut.bloom;
  const vignetteDark = cut.vignette;
  // Chromatic aberration: on cut boundary OR if cut.chroma is true
  const chromaOn = isCutBoundary || (cut.chroma ?? false);
  const chromaOffset: [number, number] = chromaOn ? [0.0025, 0.0025] : [0.0, 0.0];

  // aberración cromática: leve CONSTANTE (lente real, más fuerte en bordes) +
  // golpe en los cortes. La modulación radial la hace sentir como vidrio real.
  const caBase = chromaOn ? 0.0026 : 0.0010;

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={bloomIntensity * 1.12}
        luminanceThreshold={0.18}
        luminanceSmoothing={0.42}
        radius={0.78}
        mipmapBlur
      />
      {/* Tonemap filmico ACES — las altas luces (núcleo molten, estrellas densas)
          ruedan a dorado/blanco como película, en vez de recortar planas. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* Grado de color: curva-S de contraste + saturación rica (cine, no CG). */}
      <BrightnessContrast brightness={0.0} contrast={0.14} />
      <HueSaturation saturation={0.12} />
      <ChromaticAberration
        offset={new THREE.Vector2(caBase, caBase)}
        radialModulation
        modulationOffset={0.35}
      />
      {/* Grano de película — textura orgánica, no render clínico. */}
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.06} />
      <Vignette eskil={false} offset={0.20} darkness={vignetteDark} />
    </EffectComposer>
  );
}

// ── Cinematic letterbox (CSS overlay) ───────────────────────────────
export function Letterbox({ vertical }: { vertical: boolean }) {
  // Horizontal → cinemascope 2.39:1 (barras ~12.8%).
  // Vertical (reel 9:16) → barras delgadas tipo cine (~5%), no comen el frame.
  const pctH = vertical ? 5.0 : ((1 - (16 / 9) / 2.39) / 2) * 100;
  return (
    <>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: `${pctH}%`, background: '#000',
        pointerEvents: 'none', zIndex: 10,
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: `${pctH}%`, background: '#000',
        pointerEvents: 'none', zIndex: 10,
      }} />
    </>
  );
}

// ── Vignette overlay (CSS) — refuerzo cinematográfico, fotografía espacial ──
export function CinemaVignette() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9,
      background:
        'radial-gradient(ellipse 75% 65% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
    }} />
  );
}

// ── Atom title overlay (name + Z + shell config) ────────────────────
const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
function fmtShellLabel(lbl: string): string {
  return lbl.replace(/(\d+)$/, (_, d: string) =>
    d.split('').map((c: string) => SUPERSCRIPTS[c] ?? c).join(''));
}

// ¿De dónde salió cada elemento? Origen por nucleosíntesis REAL (español mexicano).
// Clasificación astrofísica por Z: Big Bang → rayos cósmicos → estrellas →
// supernovas → choques de estrellas de neutrones. Aparece arriba en TODOS.
function originPhrase(Z: number): string {
  // Sintéticos — no existen (o casi nada) en la naturaleza; los hicimos nosotros
  if (Z === 43) return 'El primer elemento que crearon los humanos.';          // Tecnecio
  if (Z === 61) return 'Casi no existes en la naturaleza; te hicimos nosotros.'; // Prometio
  if (Z >= 93) return 'No existías en la Tierra: te crearon los humanos.';      // transuránicos
  // Big Bang
  if (Z === 1) return 'Naciste en el Big Bang.';
  if (Z === 2) return 'Del Big Bang, hace 13.8 mil millones de años.';
  // Rayos cósmicos (espalación)
  if (Z <= 5) return 'Te forjaron los rayos cósmicos.';
  // Estrellas pequeñas al morir
  if (Z <= 7) return 'Saliste de estrellas pequeñas al morir.';
  // Estrellas gigantes (fusión hasta el calcio)
  if (Z <= 20) return 'Te cocinaron las estrellas gigantes.';
  // Supernovas — pico del hierro
  if (Z <= 30) return 'Naciste en el fuego de una supernova.';
  // Proceso-s — estrellas moribundas capturando neutrones, una a una
  if (Z <= 51) return 'Te tejieron estrellas moribundas, neutrón a neutrón.';
  // Mezcla supernova + choques de estrellas de neutrones
  if (Z <= 82) return 'De supernovas y choques de estrellas de neutrones.';
  // Proceso-r puro — lo más pesado que la naturaleza forja
  return 'De choques de estrellas de neutrones.';
}

// Factor de escala REAL: cuántas veces más pequeño es el núcleo que el átomo.
// radio nuclear ≈ 1.2·A^(1/3) fm · radio atómico en pm (1 pm = 1000 fm).
function realScaleFactor(element: Element): number {
  const A = Math.max(1, Math.round(element.mass));
  const rNuc = 1.2 * Math.cbrt(A);                       // fm
  const rAtom = element.atomicRadius ?? element.covalentRadius ?? 100; // pm
  return Math.round((rAtom * 1000 / rNuc) / 1000) * 1000; // redondeo a miles
}

// Nota de escala — aparece durante el viaje al núcleo. Deja CLARO que es una
// representación y enseña el factor real (el núcleo es ~25 000× más chico).
function ScaleNote({ element, time, vertical }: { element: Element; time: number; vertical: boolean }) {
  const opacity = smoothstep((time - 11.5) / 0.9) * Math.min(1, Math.max(0, (14.5 - time) / 0.7));
  if (opacity < 0.01) return null;
  const f = realScaleFactor(element).toLocaleString('es-MX');
  return (
    <div style={{
      position: 'absolute', top: vertical ? '20%' : '20%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: vertical ? '3vw' : '1.1vw', fontWeight: 400,
      color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em',
      textShadow: '0 2px 16px rgba(0,0,0,0.9)',
    }}>
      representación · en realidad el núcleo es {f}× más pequeño
    </div>
  );
}

function DatoCurioso({ element, time, vertical }: {
  element: Element; time: number; vertical: boolean;
}) {
  const fact = originPhrase(element.Z);
  if (!fact) return null;
  // Aparece en la MIRADA desde el núcleo (10.5-15) — ventana contemplativa
  const fi = smoothstep((time - 11.0) / 1.0);
  const fo = Math.min(1, Math.max(0, (14.7 - time) / 0.8));
  const opacity = fi * fo;
  if (opacity < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', top: vertical ? '13%' : '12%',
      left: '8%', right: '8%', zIndex: 11, pointerEvents: 'none',
      opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontWeight: 300, color: 'rgba(255,255,255,0.92)',
      fontSize: vertical ? '5vw' : '1.9vw',
      lineHeight: 1.25, letterSpacing: '-0.01em',
      textShadow: '0 2px 30px rgba(0,0,0,0.9)',
    }}>
      {fact}
    </div>
  );
}

function AtomTitle({ element, shells, time, vertical }: {
  element: Element;
  shells: { label: string; n: number; l: number }[];
  time: number;
  vertical: boolean;
}) {
  const fadeIn = Math.min(1, Math.max(0, (time - 2.0) / 0.9));
  const opacity = fadeIn;
  if (opacity < 0.01) return null;

  // Tamaños en vw → escalan idénticos en 1080×1920 y 2160×3840.
  const nameSize  = vertical ? '11vw'  : '3.1vw';
  const subSize   = vertical ? '3.4vw' : '0.85vw';
  const shellSize = vertical ? '4.2vw' : '1.0vw';

  return (
    <div style={{
      position: 'absolute', bottom: vertical ? '14%' : '16%', left: '7%',
      zIndex: 11, pointerEvents: 'none', opacity,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        fontSize: nameSize, fontWeight: 200, color: '#fff',
        letterSpacing: '-0.03em', lineHeight: 1,
        textShadow: '0 4px 40px rgba(0,0,0,0.85)',
      }}>
        {element.name}
      </div>
      <div style={{
        fontSize: subSize, fontWeight: 400, color: 'rgba(255,255,255,0.55)',
        letterSpacing: '0.15em', marginTop: vertical ? '1.2vw' : 12,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      }}>
        {element.symbol} · Z={element.Z}
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: vertical ? '2.2vw' : 20, alignItems: 'center',
        marginTop: vertical ? '2.4vw' : 22, maxWidth: vertical ? '86vw' : '70vw',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: shellSize, fontWeight: 500, letterSpacing: '0.05em',
      }}>
        {shells.map((sh, i) => {
          const revealAt = shellLabelTime(i, shells.length);
          const shOpacity = smoothstep((time - revealAt) / 0.7);
          if (shOpacity < 0.01) return null;
          const hex = subshellColor(sh.n, sh.l);
          return (
            <span key={sh.label} style={{
              opacity: shOpacity,
              color: hex,
              textShadow: `0 0 28px ${hex}99, 0 2px 12px rgba(0,0,0,0.85)`,
            }}>
              {fmtShellLabel(sh.label)}
            </span>
          );
        })}
      </div>
    </div>
  );
}


// ── Main ────────────────────────────────────────────────────────────
function CinematicAtomInner({ Z }: { Z: number }) {
  const element = useMemo(() => elementByZ(Z) ?? elementByZ(1)!, [Z]);
  const bundle = useMemo(() => buildAtomBundle(element), [element]);
  // Duración variable por # de subcapas (define la longitud del zoom-out). Se fija
  // en el módulo (RUN_DURATION) para que findCut/shellLabelTime la lean.
  const duration = useMemo(() => {
    RUN_DURATION = durationForShells(bundle.shells.length);
    return RUN_DURATION;
  }, [bundle]);
  const extent = useMemo(() => atomExtent(element), [element]);
  const nuc = useMemo(() => nucleusInfo(element), [element]);
  // Radio del núcleo proporcional al átomo (~escala real-ish): de lejos es un
  // punto diminuto, y solo al VIAJAR hasta él se revela como cúmulo de nucleones.
  const nucR = useMemo(() => extent * 0.0010, [extent]);
  const [time, setTime] = useState(0);
  const [vertical, setVertical] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  );
  // Variación de trayectoria: off por default; ?tv=0.3 la activa (ver CameraRig).
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

  useEffect(() => {
    const api = {
      renderAt: (t: number) => setTime(Math.max(0, Math.min(duration, t))),
      ready: true,
      duration,
      Z,
      element: element.symbol,
    };
    (window as unknown as { __cinematicAtom: typeof api }).__cinematicAtom = api;
    return () => {
      delete (window as unknown as { __cinematicAtom?: unknown }).__cinematicAtom;
    };
  }, [Z, element.symbol, duration]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        flat
        camera={{ position: [0, 0, extent * 0.5], fov: 35, near: 0.01, far: 200 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]}
        frameloop="always"
        style={{ background: '#000' }}
      >
        <color attach="background" args={['#000']} />
        {/* nucleones y electrones usan shaders propios — no dependen de luces */}
        <FrameDriver time={time} />
        <CameraRig extent={extent} time={time} vertical={vertical} tv={tv} seed={Z} />
        <Nucleus protons={nuc.protons} neutrons={nuc.neutrons} time={time} clusterRadius={nucR} />
        <ElectronCloud bundle={bundle} time={time} holeRadius={holeForTime(time, nucR, extent)}
          brightness={Math.min(1, 4.2 / Math.sqrt(element.Z))} />
        <DynamicPostFX time={time} />
      </Canvas>
      <CinemaVignette />
      <DatoCurioso element={element} time={time} vertical={vertical} />
      <ScaleNote element={element} time={time} vertical={vertical} />
      <AtomTitle element={element} shells={bundle.shells} time={time} vertical={vertical} />
      <Letterbox vertical={vertical} />
    </div>
  );
}

export default memo(CinematicAtomInner);
