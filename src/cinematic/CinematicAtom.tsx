/**
 * CinematicAtom — escena dedicada a grabar átomos para video.
 *
 *   "El átomo no es una pelota. Es un océano de probabilidad."
 *
 * 15s de coreografía:
 *   0–3s    núcleo solo, cámara cerrada, lento orbit
 *   3–6s    capa 1s aparece (innermost), dolly back
 *   6–9s    2s aparece (esfera más grande)
 *   9–12s   2p, 3s, ... cada subshell entra una por una con fade
 *   12–14s  full reveal, push-in dramatico
 *   14–15s  pull back final, hero shot estable
 *
 * Tiempo determinista: la escena NO usa wall-clock. Expone
 *   window.__cinematicAtom.renderAt(t)   ∈ [0, DURATION]
 * para capturar frame-by-frame a 60fps verdaderos.
 *
 * Render on-demand (frameloop="demand") — solo renderea cuando se pide.
 */

import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import {
  elementByZ, configCompact, type Element,
} from '@/lib/chem/quantum/periodic-table';
import {
  populateAtom, atomExtent, nucleusInfo,
  subshellColor, subshellLabel,
  type PopulatedOrbital,
} from '@/lib/chem/quantum/atom-builder';
import { ORBITALS, sampleOrbital } from '@/lib/chem/quantum/orbitals';

const DURATION = 15;
const SAMPLES_PER_ELECTRON = 1500; // densidad cinemática

// ── Time-driven curves ──────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// Reveal fade per shell — opacity 0→1 over `dur` seconds starting at `start`.
function fadeIn(time: number, start: number, dur = 0.9): number {
  return smoothstep((time - start) / dur);
}

// Camera choreography — devuelve {pos, target, fov} para tiempo t.
function cameraAt(time: number, extent: number) {
  const phase = time / DURATION;
  let dist: number, angleY: number, elev: number, fov: number;

  if (phase < 0.20) {
    // 0-3s: núcleo cerca, orbit suave horizontal
    const t = phase / 0.20;
    dist = lerp(extent * 0.22, extent * 0.55, smoothstep(t));
    angleY = time * 0.45;
    elev = lerp(0.05, 0.18, t);
    fov = 35;
  } else if (phase < 0.40) {
    // 3-6s: dolly back medio, orbit más rápido
    const t = (phase - 0.20) / 0.20;
    dist = lerp(extent * 0.55, extent * 1.05, smoothstep(t));
    angleY = 0.20 * DURATION + (time - 3) * 0.55;
    elev = lerp(0.18, 0.42, t);
    fov = lerp(35, 40, t);
  } else if (phase < 0.65) {
    // 6-9.75s: vista amplia, orbit lateral
    const t = (phase - 0.40) / 0.25;
    dist = lerp(extent * 1.05, extent * 1.45, smoothstep(t));
    angleY = 0.40 * DURATION + (time - 6) * 0.45;
    elev = lerp(0.42, 0.85, t);
    fov = 40;
  } else if (phase < 0.85) {
    // 9.75-12.75s: push-in dramático al núcleo
    const t = (phase - 0.65) / 0.20;
    dist = lerp(extent * 1.45, extent * 0.30, smoothstep(t));
    angleY = 0.65 * DURATION + (time - 9.75) * 0.65;
    elev = lerp(0.85, 0.30, t);
    fov = lerp(40, 28, smoothstep(t));
  } else {
    // 12.75-15s: pull back a hero shot wide
    const t = (phase - 0.85) / 0.15;
    dist = lerp(extent * 0.30, extent * 1.20, smoothstep(t));
    angleY = 0.85 * DURATION + (time - 12.75) * 0.40;
    elev = lerp(0.30, 0.45, t);
    fov = lerp(28, 38, smoothstep(t));
  }

  const x = dist * Math.cos(elev) * Math.cos(angleY);
  const y = dist * Math.sin(elev);
  const z = dist * Math.cos(elev) * Math.sin(angleY);
  return { pos: [x, y, z] as [number, number, number], fov };
}

// Reveal schedule — cada subshell se enciende en su tiempo.
// Reserva 2s al inicio (solo núcleo) y 2s al final (todo visible).
function shellRevealTime(idx: number, total: number): number {
  if (total <= 1) return 1.5;
  const startWindow = 2;
  const endWindow = 2;
  const span = DURATION - startWindow - endWindow;
  return startWindow + (idx / Math.max(1, total - 1)) * span;
}

// ── Sample bundle: muestrea TODOS los puntos una vez, tagged by shell idx ──
interface AtomBundle {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  shellIdx: Float32Array;   // qué subshell pertenece cada punto
  shells: { label: string; n: number; l: number; color: THREE.Color }[];
}

function buildAtomBundle(element: Element): AtomBundle {
  const populated = populateAtom(element);

  // Cuenta puntos por subshell agrupado (n,l):
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
      label,
      n: g.n,
      l: g.l,
      color: new THREE.Color(subshellColor(g.n, g.l)),
    }));

  const totalElectrons = populated.reduce((s, o) => s + o.electrons, 0);
  const totalPts = totalElectrons * SAMPLES_PER_ELECTRON;

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
      const npts = orb.electrons * SAMPLES_PER_ELECTRON;
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

// Sprite texture circular (soft) — bloom + additive lo convierten en plasma.
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

// ── Shader points: vertex alpha por shellIdx vs uniform de reveals ──
const POINTS_VERT = /* glsl */ `
uniform float uRevealMask[16];   // up to 16 shells
uniform float uGlobalRot;
attribute vec3 color;
attribute float aSize;
attribute float aShellIdx;
varying vec3 vCol;
varying float vAlpha;

void main() {
  int idx = int(aShellIdx + 0.5);
  float reveal = uRevealMask[idx];   // 0..1
  vAlpha = reveal;
  vCol = color;

  // rotación global del cloud
  float c = cos(uGlobalRot), s = sin(uGlobalRot);
  vec3 p = vec3(c * position.x + s * position.z, position.y, -s * position.x + c * position.z);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * 240.0 * reveal / -mv.z;
}
`;

const POINTS_FRAG = /* glsl */ `
uniform sampler2D uSprite;
varying vec3 vCol;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord;
  vec4 t = texture2D(uSprite, uv);
  float a = t.a * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol, a);
}
`;

function ElectronCloud({ bundle, time }: { bundle: AtomBundle; time: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const sprite = useMemo(() => makeSpriteTexture(), []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(bundle.positions, 3));
    g.setAttribute('color',    new THREE.BufferAttribute(bundle.colors,    3));
    g.setAttribute('aSize',    new THREE.BufferAttribute(bundle.sizes,     1));
    g.setAttribute('aShellIdx',new THREE.BufferAttribute(bundle.shellIdx,  1));
    return g;
  }, [bundle]);

  const uniforms = useMemo(() => ({
    uSprite:     { value: sprite },
    uRevealMask: { value: new Float32Array(16) },
    uGlobalRot:  { value: 0 },
  }), [sprite]);

  // Update mask + rotation when time changes
  useEffect(() => {
    if (!matRef.current) return;
    const mask = matRef.current.uniforms.uRevealMask.value as Float32Array;
    for (let i = 0; i < 16; i++) {
      if (i >= bundle.shells.length) { mask[i] = 0; continue; }
      const revealAt = shellRevealTime(i, bundle.shells.length);
      mask[i] = fadeIn(time, revealAt, 0.95);
    }
    matRef.current.uniforms.uGlobalRot.value = time * 0.35;
    matRef.current.uniformsNeedUpdate = true;
  }, [time, bundle.shells.length]);

  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={POINTS_VERT}
        fragmentShader={POINTS_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
      />
    </points>
  );
}

function Nucleus({ protons, neutrons, time }: { protons: number; neutrons: number; time: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const scale = Math.pow(protons + neutrons, 1 / 3) * 0.13;

  useEffect(() => {
    if (meshRef.current) meshRef.current.rotation.y = time * 0.5;
    if (matRef.current) {
      // Pulso sutil + cool intro
      const pulse = 0.85 + 0.15 * Math.sin(time * 4.5);
      const intro = smoothstep(time / 0.6);
      matRef.current.emissiveIntensity = (1.8 + 0.4 * pulse) * intro;
    }
  }, [time, protons, neutrons]);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[scale, 48, 48]} />
      <meshStandardMaterial
        ref={matRef}
        color="#3a2200"
        emissive="#FFC04A"
        emissiveIntensity={1.8}
        roughness={0.35}
        metalness={0.2}
      />
      <pointLight color="#FFD78A" intensity={4} distance={12} decay={1.6} />
    </mesh>
  );
}

function CameraRig({ extent, time }: { extent: number; time: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const { pos, fov } = cameraAt(time, extent);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(0, 0, 0);
    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      (camera as THREE.PerspectiveCamera).fov = fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [time, extent, camera]);
  return null;
}

// Frame driver: ensure scene re-renders when `time` state changes.
function FrameDriver({ time }: { time: number }) {
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [time, invalidate]);
  return null;
}

// ── Main exported component ─────────────────────────────────────────
interface CinematicAtomProps {
  Z: number;
}

function CinematicAtomInner({ Z }: CinematicAtomProps) {
  const element = useMemo(() => elementByZ(Z) ?? elementByZ(1)!, [Z]);
  const bundle = useMemo(() => buildAtomBundle(element), [element]);
  const extent = useMemo(() => atomExtent(element), [element]);
  const nuc = useMemo(() => nucleusInfo(element), [element]);
  const [time, setTime] = useState(0);

  // Expose deterministic API for capture
  useEffect(() => {
    const api = {
      renderAt: (t: number) => setTime(Math.max(0, Math.min(DURATION, t))),
      ready: true,
      duration: DURATION,
      Z,
      element: element.symbol,
      shells: bundle.shells.length,
    };
    (window as unknown as { __cinematicAtom: typeof api }).__cinematicAtom = api;
    return () => {
      delete (window as unknown as { __cinematicAtom?: unknown }).__cinematicAtom;
    };
  }, [Z, element.symbol, bundle.shells.length]);

  return (
    <Canvas
      camera={{ position: [0, 0, extent * 0.5], fov: 35, near: 0.01, far: 200 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      frameloop="demand"
      style={{ background: '#000' }}
    >
      <color attach="background" args={['#000']} />
      <ambientLight intensity={0.15} />
      <FrameDriver time={time} />
      <CameraRig extent={extent} time={time} />
      <Nucleus protons={nuc.protons} neutrons={nuc.neutrons} time={time} />
      <ElectronCloud bundle={bundle} time={time} />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={2.4}
          luminanceThreshold={0.10}
          luminanceSmoothing={0.75}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.20} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}

export default memo(CinematicAtomInner);
