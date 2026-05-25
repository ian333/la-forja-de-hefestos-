/**
 * Magnetar — estrella de neutrones con B ~ 10^{14}-10^{15} G.
 *
 * Campo magnético dipolar real:
 *   B_r = B_0 (R/r)^3 * 2cos(theta)
 *   B_th = B_0 (R/r)^3 * sin(theta)
 *   Línea de campo: r(theta) = L * sin^2(theta)  (L = shell label)
 *
 * Partículas fluyen a lo largo de las líneas de campo (pair cascade e+/e-).
 * Starquakes periódicos: crust cracks → FRB burst → expanding shell.
 * Eje magnético inclinado respecto al eje de rotación → efecto púlsar.
 *
 * Refs: Thompson & Duncan 1995, 1996; Kaspi & Beloborodov 2017 (ARA&A).
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';
import { MilkyWay, MagnetarMarkers, MAGNETAR_CATALOG } from './MilkyWayBackground';
import { createMagnetarAudio, type MagnetarAudioConfig } from './magnetar-audio';

// ── Physical constants ───────────────────────────────────────────────
const R_STAR = 1;
const MAGNETIC_TILT = 0.75; // ~43° tilt between magnetic and rotation axes
const ROTATION_PERIOD = 6; // seconds (real magnetars: 2-12 s)
const GOLDEN_ANGLE = 2.399963229728653; // 2π/φ²
const B_QED = 13.64; // log10(4.414 × 10^13 G) — pair creation threshold

const N_FIELD_LINES = 80;
const N_PTS_PER_LINE = 96;
const L_SHELLS = [1.15, 1.4, 1.8, 2.3, 3.0, 4.0, 5.2, 6.5, 8.0, 10.0];
const LINES_PER_SHELL = N_FIELD_LINES / L_SHELLS.length; // 8

const N_SURFACE = 10000;
const N_STREAM = 35000;
const N_CASCADE = 8000;
const N_BURST = 2500;

const COMP_COLORS: [number, number, number][] = [
  [1.0, 0.85, 0.5],   // surface (warm gold)
  [0.3, 0.65, 1.0],   // field lines (electric blue)
  [0.5, 0.8, 1.0],    // streaming particles (pale blue)
  [0.85, 0.92, 1.0],  // pair cascade (bright white-blue)
  [1.0, 0.5, 0.2],    // starquake burst (orange fire)
];

// ── Dipole field line builder ────────────────────────────────────────
function buildFieldLines(): { tex: THREE.DataTexture; footThetas: Float32Array } {
  const data = new Float32Array(N_PTS_PER_LINE * N_FIELD_LINES * 4);
  const footThetas = new Float32Array(N_FIELD_LINES);

  for (let li = 0; li < N_FIELD_LINES; li++) {
    const shellIdx = Math.floor(li / LINES_PER_SHELL);
    const L = L_SHELLS[Math.min(shellIdx, L_SHELLS.length - 1)];
    const phi = li * GOLDEN_ANGLE;

    // θ range: surface intersection
    const sinThFoot = Math.sqrt(R_STAR / L);
    const thFoot = Math.asin(Math.min(1, sinThFoot));
    footThetas[li] = thFoot;
    const thStart = thFoot + 0.02;
    const thEnd = Math.PI - thFoot - 0.02;

    for (let pi = 0; pi < N_PTS_PER_LINE; pi++) {
      const t = pi / (N_PTS_PER_LINE - 1);
      const theta = thStart + t * (thEnd - thStart);
      const sinTh = Math.sin(theta);
      const r = L * sinTh * sinTh;

      const x = r * sinTh * Math.cos(phi);
      const y = r * Math.cos(theta);
      const z = r * sinTh * Math.sin(phi);

      const idx = (li * N_PTS_PER_LINE + pi) * 4;
      data[idx] = x;
      data[idx + 1] = y;
      data[idx + 2] = z;
      data[idx + 3] = r; // store radius for intensity falloff
    }
  }

  const tex = new THREE.DataTexture(
    data, N_PTS_PER_LINE, N_FIELD_LINES,
    THREE.RGBAFormat, THREE.FloatType,
  );
  tex.needsUpdate = true;
  return { tex, footThetas };
}

// ── Particle builders ────────────────────────────────────────────────
function buildSurfaceParticles() {
  const pos = new Float32Array(N_SURFACE * 3);
  const col = new Float32Array(N_SURFACE * 3);
  const sizes = new Float32Array(N_SURFACE);

  for (let i = 0; i < N_SURFACE; i++) {
    // Fibonacci sphere
    const y = 1 - (2 * i + 1) / N_SURFACE;
    const rSin = Math.sqrt(1 - y * y);
    const phi = i * GOLDEN_ANGLE;
    const x = rSin * Math.cos(phi);
    const z = rSin * Math.sin(phi);

    pos[i * 3] = x * R_STAR;
    pos[i * 3 + 1] = y * R_STAR;
    pos[i * 3 + 2] = z * R_STAR;

    // Hot spots at magnetic poles (±Y in magnetic frame before tilt)
    const poleDist = Math.min(Math.abs(y - 1), Math.abs(y + 1));
    const hotspot = Math.exp(-poleDist * poleDist / 0.08);
    const cold: [number, number, number] = [0.85, 0.45, 0.15];
    const hot: [number, number, number] = [0.9, 0.95, 1.0];
    col[i * 3] = cold[0] + (hot[0] - cold[0]) * hotspot;
    col[i * 3 + 1] = cold[1] + (hot[1] - cold[1]) * hotspot;
    col[i * 3 + 2] = cold[2] + (hot[2] - cold[2]) * hotspot;

    sizes[i] = 1.5 + hotspot * 3.0;
  }
  return { pos, col, sizes };
}

function buildStreamParticles() {
  const lineIdx = new Float32Array(N_STREAM);
  const phase = new Float32Array(N_STREAM);
  const speed = new Float32Array(N_STREAM);

  for (let i = 0; i < N_STREAM; i++) {
    lineIdx[i] = Math.floor(Math.random() * N_FIELD_LINES);
    phase[i] = Math.random();
    // Faster on outer lines (larger L → lower B → less drag)
    const shell = Math.floor(lineIdx[i] / LINES_PER_SHELL);
    speed[i] = 0.08 + (shell / L_SHELLS.length) * 0.15 + Math.random() * 0.04;
  }
  return { lineIdx, phase, speed };
}

function buildCascadeParticles() {
  const lineIdx = new Float32Array(N_CASCADE);
  const phase = new Float32Array(N_CASCADE);
  const speed = new Float32Array(N_CASCADE);

  // Only near poles: first 2 L-shells (inner field lines)
  const innerLines = LINES_PER_SHELL * 2;
  for (let i = 0; i < N_CASCADE; i++) {
    lineIdx[i] = Math.floor(Math.random() * innerLines);
    // Concentrate near poles (phase near 0 or 1)
    const u = Math.random();
    phase[i] = u < 0.5 ? u * 0.35 : 1 - (1 - u) * 0.35;
    speed[i] = 0.2 + Math.random() * 0.15; // fast — relativistic pairs
  }
  return { lineIdx, phase, speed };
}

function buildBurstParticles() {
  const dirs = new Float32Array(N_BURST * 3);
  for (let i = 0; i < N_BURST; i++) {
    // Random unit vectors (expanding shell directions)
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;
    dirs[i * 3] = Math.sin(theta) * Math.cos(phi);
    dirs[i * 3 + 1] = Math.cos(theta);
    dirs[i * 3 + 2] = Math.sin(theta) * Math.sin(phi);
  }
  return { dirs };
}

// ── Vertex shaders ───────────────────────────────────────────────────
const fieldLineVert = /* glsl */ `
uniform sampler2D uFieldData;
uniform float uTime;
uniform float uRotAngle;
uniform float uTilt;
uniform float uBIntensity;
attribute float aLineIdx;
attribute float aPointIdx;
varying float vAlpha;
varying vec3 vCol;

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c,0,s, 0,1,0, -s,0,c);
}
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1,0,0, 0,c,-s, 0,s,c);
}

void main() {
  vec2 uv = vec2(
    (aPointIdx + 0.5) / ${N_PTS_PER_LINE}.0,
    (aLineIdx + 0.5) / ${N_FIELD_LINES}.0
  );
  vec4 fd = texture2D(uFieldData, uv);
  vec3 lpos = fd.xyz;
  float r = fd.w;

  vec3 p = rotY(uRotAngle) * rotX(uTilt) * lpos;

  // Streaming glow
  float ph = aPointIdx / ${N_PTS_PER_LINE - 1}.0;
  float flow = fract(ph - uTime * 0.25);
  float pulse = 0.25 + 0.75 * pow(sin(flow * 3.14159), 2.0);
  float rFade = 1.0 / (1.0 + r * 0.12);

  // Alpha responde a B con piso visible (0.15) para que se vean a B bajo
  vAlpha = pulse * rFade * (0.15 + uBIntensity * 1.20);
  // Color: azul a B bajo, violeta-magenta a B alto (matching field lines)
  vCol = mix(vec3(0.30, 0.55, 0.90), vec3(0.85, 0.45, 1.0), uBIntensity) * (0.6 + 0.4 * rFade);

  vec4 mvp = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_Position = mvp;
  gl_PointSize = max(1.5, (2.5 + rFade * 3.5) * (0.5 + uBIntensity * 1.0) * (300.0 / -mvp.z));
}
`;

const fieldLineFrag = /* glsl */ `
varying float vAlpha;
varying vec3 vCol;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.15, d) * vAlpha;
  gl_FragColor = vec4(vCol, a);
}
`;

const streamVert = /* glsl */ `
uniform sampler2D uFieldData;
uniform float uTime;
uniform float uRotAngle;
uniform float uTilt;
uniform float uBIntensity;
attribute float aLineIdx;
attribute float aPhase;
attribute float aSpeed;
varying float vAlpha;
varying vec3 vCol;

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c,0,s, 0,1,0, -s,0,c);
}
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1,0,0, 0,c,-s, 0,s,c);
}

void main() {
  float ph = fract(aPhase + uTime * aSpeed);
  vec2 uv = vec2(
    ph,
    (aLineIdx + 0.5) / ${N_FIELD_LINES}.0
  );
  vec4 fd = texture2D(uFieldData, uv);
  vec3 lpos = fd.xyz;
  float r = fd.w;

  vec3 p = rotY(uRotAngle) * rotX(uTilt) * lpos;

  float rFade = 1.0 / (1.0 + r * 0.15);
  // Alpha responde fuerte a B: bajo B = casi invisible (0.10), alto B = saturado (1.0)
  vAlpha = rFade * (0.08 + uBIntensity * 1.10);
  // Color shift: bajo B = azul pálido, alto B = violeta-magenta brillante
  vCol = mix(vec3(0.30, 0.55, 0.90), vec3(0.85, 0.55, 1.0), uBIntensity);

  vec4 mvp = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_Position = mvp;
  // Size también responde a B → field lines más gruesas con campo alto
  gl_PointSize = max(1.0, (1.5 + rFade * 2.5) * (1.0 + uBIntensity * 0.8) * (250.0 / -mvp.z));
}
`;

const streamFrag = /* glsl */ `
varying float vAlpha;
varying vec3 vCol;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d) * vAlpha;
  gl_FragColor = vec4(vCol, a);
}
`;

const cascadeVert = /* glsl */ `
uniform sampler2D uFieldData;
uniform float uTime;
uniform float uRotAngle;
uniform float uTilt;
uniform float uCascadeVis;
attribute float aLineIdx;
attribute float aPhase;
attribute float aSpeed;
varying float vAlpha;

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c,0,s, 0,1,0, -s,0,c);
}
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1,0,0, 0,c,-s, 0,s,c);
}

void main() {
  float ph = fract(aPhase + uTime * aSpeed);
  vec2 uv = vec2(
    ph,
    (aLineIdx + 0.5) / ${N_FIELD_LINES}.0
  );
  vec4 fd = texture2D(uFieldData, uv);
  vec3 p = rotY(uRotAngle) * rotX(uTilt) * fd.xyz;

  float rFade = 1.0 / (1.0 + fd.w * 0.1);
  vAlpha = rFade * uCascadeVis * 0.6;

  vec4 mvp = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_Position = mvp;
  gl_PointSize = max(1.0, (2.5 + rFade * 2.0) * uCascadeVis * (200.0 / -mvp.z));
}
`;

const cascadeFrag = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.05, d) * vAlpha;
  gl_FragColor = vec4(0.85, 0.92, 1.0, a);
}
`;

const surfaceVert = /* glsl */ `
uniform float uRotAngle;
uniform float uTilt;
uniform float uQuakeFlash;
attribute float aSize;
varying vec3 vCol;
varying float vFlash;

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c,0,s, 0,1,0, -s,0,c);
}
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1,0,0, 0,c,-s, 0,s,c);
}

void main() {
  vec3 p = rotY(uRotAngle) * rotX(uTilt) * position;
  vCol = color;
  vFlash = uQuakeFlash;

  vec4 mvp = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_Position = mvp;
  gl_PointSize = max(1.0, aSize * (200.0 / -mvp.z));
}
`;

const surfaceFrag = /* glsl */ `
varying vec3 vCol;
varying float vFlash;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d) * 0.85;
  vec3 c = mix(vCol, vec3(1.0), vFlash * 0.7);
  gl_FragColor = vec4(c * (1.0 + vFlash * 2.0), a);
}
`;

const burstVert = /* glsl */ `
uniform float uQuakeTime;
uniform float uTime;
uniform vec3 uQuakeOrigin;
attribute vec3 aDir;
varying float vAlpha;

void main() {
  float dt = uTime - uQuakeTime;
  if (dt < 0.0 || dt > 3.0) {
    gl_Position = vec4(0.0, 0.0, -99.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  float speed = 5.0;
  vec3 p = uQuakeOrigin + aDir * dt * speed;
  float fade = 1.0 - dt / 3.0;
  vAlpha = fade * fade * 0.8;

  vec4 mvp = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_Position = mvp;
  gl_PointSize = max(1.0, (3.0 * fade) * (200.0 / -mvp.z));
}
`;

const burstFrag = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d) * vAlpha;
  gl_FragColor = vec4(1.0, 0.6, 0.2, a);
}
`;

// ── Scene components ─────────────────────────────────────────────────

function NeutronStarCore({ rotAngle, tilt, quakeFlash, logB }: {
  rotAngle: number; tilt: number; quakeFlash: number; logB: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.rotation.set(tilt, rotAngle, 0, 'YXZ');
  });

  // Color de superficie shifteado por B: bajo B → naranja-amber (pulsar normal,
  // T_eff ~ 0.5 keV), alto B → blanco-azul (T más alta + cyclotron emission
  // shift al X duro, magnetar surface ~1 keV+). Es físicamente correcto que
  // T_eff de magnetares jóvenes sea mayor por heating del campo magnético.
  const bNorm = Math.min(1, Math.max(0, (logB - 12) / 4));   // 0 en 10¹², 1 en 10¹⁶
  const emissiveIntensity = (0.6 + 1.8 * bNorm) + quakeFlash * 4;
  const emissiveColor = quakeFlash > 0.1
    ? new THREE.Color(1, 0.8 + quakeFlash * 0.2, 0.6 + quakeFlash * 0.4)
    : new THREE.Color(
        0.9 - 0.3 * bNorm,                     // R: naranja → violeta
        0.55 + 0.10 * bNorm,                   // G: estable warm
        0.2 + 0.85 * bNorm,                    // B: ↑ con B (azul/violeta)
      );

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[R_STAR * 0.98, 48, 48]} />
      <meshStandardMaterial
        color="#442200"
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
        roughness={0.6}
        metalness={0.3}
      />
    </mesh>
  );
}

function SurfaceParticles({ rotAngle, tilt, quakeFlash }: {
  rotAngle: number; tilt: number; quakeFlash: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { pos, col, sizes } = useMemo(() => buildSurfaceParticles(), []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    return g;
  }, [pos, col, sizes]);

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uRotAngle.value = rotAngle;
    matRef.current.uniforms.uQuakeFlash.value = quakeFlash;
  });

  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={matRef}
        vertexShader={surfaceVert}
        fragmentShader={surfaceFrag}
        uniforms={{
          uRotAngle: { value: 0 },
          uTilt: { value: tilt },
          uQuakeFlash: { value: 0 },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
      />
    </points>
  );
}

function FieldLines({ fieldTex, rotAngle, tilt, bIntensity }: {
  fieldTex: THREE.DataTexture; rotAngle: number; tilt: number; bIntensity: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geo = useMemo(() => {
    const n = N_FIELD_LINES * N_PTS_PER_LINE;
    const lineIdxArr = new Float32Array(n);
    const pointIdxArr = new Float32Array(n);
    for (let li = 0; li < N_FIELD_LINES; li++) {
      for (let pi = 0; pi < N_PTS_PER_LINE; pi++) {
        const i = li * N_PTS_PER_LINE + pi;
        lineIdxArr[i] = li;
        pointIdxArr[i] = pi;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); // dummy
    g.setAttribute('aLineIdx', new THREE.Float32BufferAttribute(lineIdxArr, 1));
    g.setAttribute('aPointIdx', new THREE.Float32BufferAttribute(pointIdxArr, 1));
    return g;
  }, []);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
    matRef.current.uniforms.uRotAngle.value = rotAngle;
    matRef.current.uniforms.uBIntensity.value = bIntensity;
  });

  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={matRef}
        vertexShader={fieldLineVert}
        fragmentShader={fieldLineFrag}
        uniforms={{
          uFieldData: { value: fieldTex },
          uTime: { value: 0 },
          uRotAngle: { value: 0 },
          uTilt: { value: tilt },
          uBIntensity: { value: 1 },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function StreamingParticles({ fieldTex, rotAngle, tilt, bIntensity }: {
  fieldTex: THREE.DataTexture; rotAngle: number; tilt: number; bIntensity: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { lineIdx, phase, speed } = useMemo(() => buildStreamParticles(), []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N_STREAM * 3), 3));
    g.setAttribute('aLineIdx', new THREE.Float32BufferAttribute(lineIdx, 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
    g.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speed, 1));
    return g;
  }, [lineIdx, phase, speed]);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
    matRef.current.uniforms.uRotAngle.value = rotAngle;
    matRef.current.uniforms.uBIntensity.value = bIntensity;
  });

  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={matRef}
        vertexShader={streamVert}
        fragmentShader={streamFrag}
        uniforms={{
          uFieldData: { value: fieldTex },
          uTime: { value: 0 },
          uRotAngle: { value: 0 },
          uTilt: { value: tilt },
          uBIntensity: { value: 1 },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function PairCascade({ fieldTex, rotAngle, tilt, cascadeVis }: {
  fieldTex: THREE.DataTexture; rotAngle: number; tilt: number; cascadeVis: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { lineIdx, phase, speed } = useMemo(() => buildCascadeParticles(), []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N_CASCADE * 3), 3));
    g.setAttribute('aLineIdx', new THREE.Float32BufferAttribute(lineIdx, 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
    g.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speed, 1));
    return g;
  }, [lineIdx, phase, speed]);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
    matRef.current.uniforms.uRotAngle.value = rotAngle;
    matRef.current.uniforms.uCascadeVis.value = cascadeVis;
  });

  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={matRef}
        vertexShader={cascadeVert}
        fragmentShader={cascadeFrag}
        uniforms={{
          uFieldData: { value: fieldTex },
          uTime: { value: 0 },
          uRotAngle: { value: 0 },
          uTilt: { value: tilt },
          uCascadeVis: { value: 0 },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function StarquakeBurst({ quakeTime, quakeOrigin }: {
  quakeTime: number; quakeOrigin: [number, number, number];
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { dirs } = useMemo(() => buildBurstParticles(), []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N_BURST * 3), 3));
    g.setAttribute('aDir', new THREE.Float32BufferAttribute(dirs, 3));
    return g;
  }, [dirs]);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
    matRef.current.uniforms.uQuakeTime.value = quakeTime;
    matRef.current.uniforms.uQuakeOrigin.value.set(...quakeOrigin);
  });

  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={matRef}
        vertexShader={burstVert}
        fragmentShader={burstFrag}
        uniforms={{
          uTime: { value: 0 },
          uQuakeTime: { value: -99 },
          uQuakeOrigin: { value: new THREE.Vector3() },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── Main scene orchestrator ──────────────────────────────────────────
function MagnetarInner({ logB, onQuake }: {
  logB: number; onQuake: () => void;
}) {
  const rotAngleRef = useRef(0);
  const [rotAngle, setRotAngle] = useState(0);
  const quakeTimerRef = useRef(0);
  const [quakeTime, setQuakeTime] = useState(-99);
  const [quakeOrigin, setQuakeOrigin] = useState<[number, number, number]>([0, 1, 0]);
  const [quakeFlash, setQuakeFlash] = useState(0);

  const { tex: fieldTex } = useMemo(() => buildFieldLines(), []);
  const bIntensity = useMemo(() => 0.3 + 0.7 * ((logB - 12) / 4), [logB]);
  const cascadeVis = useMemo(() => {
    if (logB < B_QED) return 0;
    return Math.min(1, (logB - B_QED) / 1.5);
  }, [logB]);

  const triggerQuake = useCallback((time: number) => {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;
    setQuakeOrigin([
      Math.sin(theta) * Math.cos(phi) * R_STAR,
      Math.cos(theta) * R_STAR,
      Math.sin(theta) * Math.sin(phi) * R_STAR,
    ]);
    setQuakeTime(time);
    setQuakeFlash(1);
    onQuake();
  }, [onQuake]);

  useFrame(({ clock }) => {
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    // Rotation
    rotAngleRef.current += (Math.PI * 2 / ROTATION_PERIOD) * dt;
    setRotAngle(rotAngleRef.current);

    // Quake flash decay
    setQuakeFlash(prev => Math.max(0, prev - dt * 2.5));

    // Auto-starquake every 7-10 seconds
    quakeTimerRef.current += dt;
    const interval = 7 + ((logB - 12) / 4) * -3; // higher B → more frequent
    if (quakeTimerRef.current > Math.max(4, interval)) {
      quakeTimerRef.current = 0;
      triggerQuake(t);
    }
  });

  return (
    <>
      <NeutronStarCore rotAngle={rotAngle} tilt={MAGNETIC_TILT} quakeFlash={quakeFlash} logB={logB} />
      <SurfaceParticles rotAngle={rotAngle} tilt={MAGNETIC_TILT} quakeFlash={quakeFlash} />
      <FieldLines fieldTex={fieldTex} rotAngle={rotAngle} tilt={MAGNETIC_TILT} bIntensity={bIntensity} />
      <StreamingParticles fieldTex={fieldTex} rotAngle={rotAngle} tilt={MAGNETIC_TILT} bIntensity={bIntensity} />
      <PairCascade fieldTex={fieldTex} rotAngle={rotAngle} tilt={MAGNETIC_TILT} cascadeVis={cascadeVis} />
      <StarquakeBurst quakeTime={quakeTime} quakeOrigin={quakeOrigin} />
    </>
  );
}

// ── UI overlay ───────────────────────────────────────────────────────
const REGIME_LABELS: Array<{ min: number; max: number; label: string; color: string }> = [
  { min: 12, max: 13, label: 'Púlsar normal', color: '#94A3B8' },
  { min: 13, max: 13.64, label: 'Púlsar alto-B', color: '#60A5FA' },
  { min: 13.64, max: 14.5, label: 'Magnetar', color: '#818CF8' },
  { min: 14.5, max: 15.5, label: 'Magnetar extremo (SGR 1806-20)', color: '#C084FC' },
  { min: 15.5, max: 16, label: 'Límite QED', color: '#F472B6' },
];

function getRegime(logB: number) {
  return REGIME_LABELS.find(r => logB >= r.min && logB < r.max) ?? REGIME_LABELS[REGIME_LABELS.length - 1];
}

function BFieldSlider({ logB, onChange }: { logB: number; onChange: (v: number) => void }) {
  const regime = getRegime(logB);
  const bGauss = Math.pow(10, logB);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/85 border border-[#334155] rounded-lg p-4 font-mono backdrop-blur-sm shadow-2xl"
         style={{ width: 440 }}>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#64748B]">campo magnético superficial</div>
          <div className="text-[15px] font-semibold mt-0.5">
            <span style={{ color: regime.color }}>B = {bGauss.toExponential(1)} G</span>
            <span className="text-[#475569] text-[11px] ml-2">· log₁₀B = {logB.toFixed(2)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-[#64748B]">régimen</div>
          <div className="text-[12px] font-semibold" style={{ color: regime.color }}>{regime.label}</div>
        </div>
      </div>

      <div className="relative mt-1" style={{ height: 28 }}>
        <div className="absolute inset-x-0 top-3 h-3 rounded-full pointer-events-none"
             style={{
               background: 'linear-gradient(to right, #475569 0%, #60A5FA 25%, #818CF8 50%, #C084FC 75%, #F472B6 100%)',
               opacity: 0.7,
             }} />
        <input
          type="range"
          min={12} max={16} step={0.01}
          value={logB}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-x-0 top-0 w-full h-7 cursor-pointer accent-[#C084FC]"
        />
      </div>

      <div className="flex justify-between text-[9px] text-[#475569] mt-0.5">
        <span>10¹² G</span>
        <span>B_QED</span>
        <span>10¹⁶ G</span>
      </div>

      {logB >= B_QED && (
        <div className="text-[9px] text-[#A78BFA] mt-1.5 leading-snug">
          B &gt; B_QED = 4.4×10¹³ G — pair cascade activa (γ → e⁺e⁻ en campo fuerte)
        </div>
      )}
    </div>
  );
}

function Legend() {
  const items = [
    { color: '#DD8833', label: 'superficie (T ~ 0.5-1 keV)' },
    { color: '#4DA6FF', label: 'campo B dipolar' },
    { color: '#80CCFF', label: 'plasma magnetosférico' },
    { color: '#D9ECFF', label: 'pair cascade e⁺e⁻' },
    { color: '#FF8833', label: 'starquake burst' },
  ];

  return (
    <div className="absolute top-6 right-6 bg-black/65 border border-[#334155] rounded p-2.5 font-mono text-[10px] backdrop-blur-sm">
      <div className="text-[#94A3B8] mb-1.5 text-[9px] uppercase tracking-wider">componentes</div>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2 leading-tight py-0.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: it.color, boxShadow: `0 0 8px ${it.color}` }} />
          <span style={{ color: it.color }}>{it.label}</span>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t border-[#334155] text-[9px] text-[#475569] leading-snug max-w-[200px]">
        Eje magnético inclinado {Math.round(MAGNETIC_TILT * 180 / Math.PI)}° del eje de rotación.
        P = {ROTATION_PERIOD}s. Starquakes automáticos.
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────
export default memo(function MagnetarScene() {
  const [logB, setLogB] = useState(14.5);
  const [quakeCount, setQuakeCount] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const audioRef = useRef<MagnetarAudioConfig | null>(null);

  const handleQuake = useCallback(() => {
    setQuakeCount(c => c + 1);
    audioRef.current?.triggerQuake();
  }, []);

  // Audio teardown si se apaga
  useEffect(() => {
    if (!audioOn && audioRef.current) {
      audioRef.current.destroy();
      audioRef.current = null;
    }
    return () => { audioRef.current?.destroy(); audioRef.current = null; };
  }, [audioOn]);

  // Sync B → audio drone intensity
  useEffect(() => {
    if (audioRef.current) audioRef.current.setB(logB);
  }, [logB]);

  return (
    <div className="w-full h-full relative" style={{ background: '#030408' }}>
      <Canvas
        gl={makeRenderer()}
        camera={{ position: [0, 4, 18], fov: 45, near: 0.1, far: 200 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.05} />
        <pointLight position={[0, 0, 0]} intensity={0.3} color="#FFA040" />

        {/* Background: Vía Láctea (~29k estrellas) + magnetares reales catálogo */}
        <MilkyWay />
        <MagnetarMarkers />
        <MagnetarInner logB={logB} onQuake={handleQuake} />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          autoRotate
          autoRotateSpeed={0.3}
          minDistance={3}
          maxDistance={60}
          maxPolarAngle={Math.PI * 0.95}
          minPolarAngle={Math.PI * 0.05}
        />

        <EffectComposer>
          <Bloom
            intensity={1.8}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.7}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      {/* Title */}
      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] max-w-md space-y-1 pointer-events-none">
        <div className="text-[#C084FC] font-semibold text-[13px]">Magnetar · SGR 1806-20</div>
        <div>Estrella de neutrones · B ~ 10¹⁴⁻¹⁵ G</div>
        <div className="text-[10px] text-[#475569] mt-2 leading-snug max-w-sm">
          Campo dipolar: r(θ) = L·sin²θ. Pair cascade γ→e⁺e⁻ activa sobre B_QED.
          Starquakes: la corteza cristalina cede ante el estrés magnético.
        </div>
      </div>

      <Legend />
      <BFieldSlider logB={logB} onChange={setLogB} />

      {/* Audio panel — top-right debajo de Legend */}
      <div className="absolute top-6 right-6 mt-44 bg-black/65 border border-[#334155] rounded p-2.5 font-mono text-[10px] backdrop-blur-sm w-[200px]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={audioOn} onChange={e => {
            const b = e.target.checked;
            if (b && !audioRef.current) {
              try {
                audioRef.current = createMagnetarAudio();
                audioRef.current.ctx.resume().catch(() => {});
                audioRef.current.setB(logB);
              } catch (err) { console.error('audio init fail', err); }
            }
            setAudioOn(b);
          }} className="accent-[#FFD46B]" />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#FFD46B', boxShadow: '0 0 8px #FFD46B' }} />
          <span style={{ color: '#FFD46B' }}>audio · sonificación</span>
        </label>
        <div className="text-[#475569] text-[9px] mt-1 leading-tight">
          drone sub-bass (B), heartbeat 6s rotacional, kick por starquake,
          static cuando B &gt; B_QED.
        </div>
        <button
          onClick={() => {
            audioRef.current?.ctx.resume().catch(() => {});
            audioRef.current?.triggerFRB();
          }}
          disabled={!audioOn}
          className="mt-2 w-full px-2 py-1 border border-[#FF6FBA] text-[#FF6FBA] hover:bg-[#FF6FBA]/15 disabled:opacity-30 disabled:cursor-not-allowed rounded text-[10px]"
          title="Fast Radio Burst — chirp 1200→200 Hz simula sweep MHz real (SGR 1935 FRB 200428)"
        >
          ⚡ FRB burst (SGR 1935+2154)
        </button>
        <button
          onClick={() => {
            // TEST DIRECTO sin pasar por magnetar-audio module
            try {
              const c = new (window.AudioContext || (window as any).webkitAudioContext)();
              c.resume().catch(() => {});
              const o = c.createOscillator();
              const g = c.createGain();
              o.type = 'sine';
              o.frequency.value = 880;
              g.gain.setValueAtTime(0.40, c.currentTime);
              g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.0);
              o.connect(g); g.connect(c.destination);
              o.start();
              o.stop(c.currentTime + 1.05);
              console.log('[TEST BEEP] ctx.state =', c.state, ' sampleRate =', c.sampleRate);
              setTimeout(() => c.close(), 2000);
            } catch (e) { console.error('test beep fail', e); }
          }}
          className="mt-2 w-full px-2 py-1 border border-[#94A3B8] text-[#94A3B8] hover:bg-[#94A3B8]/15 rounded text-[10px]"
          title="Test directo: crea AudioContext + beep A5 880Hz 1s. Si NO suena, el browser bloquea audio."
        >
          🔔 test beep (diagnóstico)
        </button>
      </div>

      {/* Catálogo magnetares reales — bottom-left */}
      <div className="absolute bottom-32 left-6 bg-black/55 border border-[#334155]/70 rounded p-2 font-mono text-[9px] text-[#94A3B8] backdrop-blur-sm max-w-[250px]">
        <div className="text-[#FF6FBA] text-[10px] mb-1">
          ◇ {MAGNETAR_CATALOG.length} magnetares reales (catálogo McGill)
        </div>
        <div className="text-[#475569] leading-tight">
          puntos magenta en el fondo · coords galácticas (l, b) · ej: SGR 1806-20 giant flare 2004,
          SGR 1935+2154 FRB 200428, PSR J1745-2900 centro galáctico.
        </div>
      </div>

      {quakeCount > 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[#FF8833]/60 pointer-events-none">
          starquakes: {quakeCount}
        </div>
      )}
    </div>
  );
});
