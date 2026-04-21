/**
 * Nivel 2 de la escalera — campo celular acoplado al MD.
 *
 * Tres paneles en un solo canvas 3D:
 *
 *   ┌──────────────┬──────────────┬──────────────┐
 *   │ Átomos       │ Bridge ρ/T   │ Stencil PDE  │
 *   │ 3D (nivel 0) │ voxels 3D    │ 2D (nivel 2) │
 *   └──────────────┴──────────────┴──────────────┘
 *
 * El stencil vive en un slice z=medio y corre una ecuación de reacción-
 * difusión acoplada al bridge como término fuente:
 *
 *   ∂u/∂t = D ∇²u + R(u) + (T_bridge(x,y) − u)/τ_couple
 *
 * con τ_couple bajo, el stencil SIGUE al MD. Con τ_couple alto, el stencil
 * evoluciona bajo su propia dinámica (RD) usando el MD solo como IC
 * aproximada.
 *
 * Presets del reactor:
 *   · Heat (R = 0) — solo difusión.
 *   · Fisher-KPP — invasión logística, onda c = 2√(rD).
 *   · Gray-Scott — patrones autocatalíticos.
 *
 * Esta es la tercera vez que reusamos la misma arquitectura:
 *   nivel 0 → pairwise-engine
 *   nivel 1 → bridge-engine
 *   nivel 2 → stencilStepCpu con bridge como fuente
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { PairwiseEngine, type PairwiseEngineConfig, type PairwiseStats } from '@/lib/gpu/pairwise-engine';
import { LJ_FORCE } from '@/lib/gpu/pairwise';
import { BridgeEngine } from '@/lib/gpu/bridge-engine';
import { stencilStepCpu, type StencilCpuOptions } from '@/lib/gpu/stencil';
import { useAudience } from '@/physics/context';

// ═══════════════════════════════════════════════════════════════
// Constantes de config
// ═══════════════════════════════════════════════════════════════

const RES_ATOMS  = 48;     // 2304 átomos
const RES_BRIDGE = 8;      // 512 blobs 3D
const RES_STENCIL = 48;    // 48×48 celdas 2D (= 2304 cells)
const SLICE_Z    = 4;      // índice z del plano que alimenta el stencil

// ═══════════════════════════════════════════════════════════════
// Presets de la reacción del stencil
// ═══════════════════════════════════════════════════════════════

type ReactionKind = 'heat' | 'fisher' | 'gray-scott';

interface StencilPreset {
  id: string; name: string; note: string;
  kind: ReactionKind;
  diffusivity: [number, number, number, number];
  dt: number;
  tauCouple: number;
  extra?: { F?: number; k?: number; r?: number };
}

const STENCIL_PRESETS: StencilPreset[] = [
  {
    id: 'heat',
    name: 'Calor (R = 0)',
    note: 'Solo difusión. τ_couple controla cuánto "siente" el MD. Si es muy bajo, el stencil copia al bridge.',
    kind: 'heat',
    diffusivity: [0.04, 0, 0, 0],
    dt: 0.03, tauCouple: 8,
  },
  {
    id: 'fisher',
    name: 'Fisher-KPP (invasión)',
    note: 'Crecimiento logístico + difusión. Forma frentes viajeros con velocidad c = 2√(rD).',
    kind: 'fisher',
    diffusivity: [0.02, 0, 0, 0],
    dt: 0.02, tauCouple: 30,
    extra: { r: 1.5 },
  },
  {
    id: 'gray-scott',
    name: 'Gray-Scott (patrones)',
    note: 'Reacción autocatalítica. Del MD se toma c₀ como especie u. Emergen spots/stripes.',
    kind: 'gray-scott',
    diffusivity: [2e-5, 1e-5, 0, 0],
    dt: 1.0, tauCouple: 200,
    extra: { F: 0.04, k: 0.06 },
  },
];

// ═══════════════════════════════════════════════════════════════
// Shaders — átomos y voxel bridge (mismos que MultiScale)
// ═══════════════════════════════════════════════════════════════

const ATOM_VS = /* glsl */ `
  attribute vec2 refUV;
  uniform sampler2D texturePosition;
  uniform sampler2D textureVelocity;
  uniform float cameraScale;
  uniform float sigma;
  uniform vec3 offsetWorld;
  varying vec3 vColor;
  varying float vSpeed;
  void main() {
    vec4 p = texture2D(texturePosition, refUV);
    vec4 v = texture2D(textureVelocity, refUV);
    vSpeed = length(v.xyz);
    vec3 col = vec3(0.31, 0.76, 0.97);
    vec3 hot = vec3(1.0, 0.55, 0.20);
    vColor = mix(col, hot, clamp(vSpeed * 0.25, 0.0, 0.55));
    vec4 mv = modelViewMatrix * vec4(p.xyz + offsetWorld, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = sigma * cameraScale * (100.0 / -mv.z);
  }
`;
const ATOM_FS = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vSpeed;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d2 = dot(c, c) * 4.0;
    if (d2 > 1.0) discard;
    float fall = sqrt(max(0.0, 1.0 - d2));
    gl_FragColor = vec4(vColor * (0.40 + 0.60 * fall), fall);
  }
`;

const VOXEL_VS = /* glsl */ `
  attribute vec3 blobIdx;
  uniform sampler2D textureFluid;
  uniform sampler2D textureThermal;
  uniform float RES;
  uniform float cellSize;
  uniform vec3 origin;
  uniform float maxRho;
  uniform float maxT;
  uniform float cameraScale;
  uniform vec3 offsetWorld;
  varying float vRho;
  varying float vT;
  void main() {
    vec3 world = origin + (blobIdx + 0.5) * cellSize + offsetWorld;
    float u = (blobIdx.x + 0.5) / RES;
    float v = (blobIdx.y + RES * blobIdx.z + 0.5) / (RES * RES);
    vec4 fluid = texture2D(textureFluid, vec2(u, v));
    vec4 therm = texture2D(textureThermal, vec2(u, v));
    vRho = fluid.x;
    vT   = therm.x;
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float rhoNorm = clamp(vRho / max(maxRho, 0.01), 0.0, 1.0);
    gl_PointSize = cellSize * cameraScale * (100.0 / -mv.z) * (0.15 + 0.85 * rhoNorm);
  }
`;
const VOXEL_FS = /* glsl */ `
  precision highp float;
  varying float vRho;
  varying float vT;
  uniform float maxRho;
  uniform float maxT;
  vec3 heatColor(float t) {
    vec3 c1 = vec3(0.05, 0.20, 0.55);
    vec3 c2 = vec3(0.15, 0.50, 0.60);
    vec3 c3 = vec3(0.35, 0.75, 0.45);
    vec3 c4 = vec3(0.95, 0.85, 0.20);
    vec3 c5 = vec3(0.95, 0.35, 0.15);
    t = clamp(t, 0.0, 1.0);
    if (t < 0.25) return mix(c1, c2, t / 0.25);
    if (t < 0.50) return mix(c2, c3, (t - 0.25) / 0.25);
    if (t < 0.75) return mix(c3, c4, (t - 0.50) / 0.25);
    return mix(c4, c5, (t - 0.75) / 0.25);
  }
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d2 = dot(c, c) * 4.0;
    if (d2 > 1.0) discard;
    float rhoNorm = clamp(vRho / max(maxRho, 0.01), 0.0, 1.0);
    float Tnorm   = clamp(vT   / max(maxT,   0.01), 0.0, 1.0);
    if (rhoNorm < 0.02) discard;
    float fall = sqrt(max(0.0, 1.0 - d2));
    vec3 col = heatColor(Tnorm);
    gl_FragColor = vec4(col * (0.35 + 0.65 * fall), fall * rhoNorm);
  }
`;

// ═══════════════════════════════════════════════════════════════
// Shader — stencil plane (CPU texture on a 3D plane)
// ═══════════════════════════════════════════════════════════════

const PLANE_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PLANE_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D stencilTex;
  uniform int kind;           // 0=heat, 1=fisher, 2=gray-scott
  uniform float vMax;

  vec3 heatColor(float t) {
    vec3 c1 = vec3(0.05, 0.20, 0.55);
    vec3 c2 = vec3(0.15, 0.50, 0.60);
    vec3 c3 = vec3(0.35, 0.75, 0.45);
    vec3 c4 = vec3(0.95, 0.85, 0.20);
    vec3 c5 = vec3(0.95, 0.35, 0.15);
    t = clamp(t, 0.0, 1.0);
    if (t < 0.25) return mix(c1, c2, t / 0.25);
    if (t < 0.50) return mix(c2, c3, (t - 0.25) / 0.25);
    if (t < 0.75) return mix(c3, c4, (t - 0.50) / 0.25);
    return mix(c4, c5, (t - 0.75) / 0.25);
  }
  void main() {
    vec4 s = texture2D(stencilTex, vUv);
    float v = s.x;
    float norm = clamp(v / max(vMax, 0.01), 0.0, 1.0);
    vec3 col = heatColor(norm);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/** Upsample bilineal de bridge slice (RES_B × RES_B) a stencil (RES_S × RES_S). */
function upsample(src: Float32Array, RES_B: number, RES_S: number): Float32Array {
  const out = new Float32Array(RES_S * RES_S);
  for (let j = 0; j < RES_S; j++) {
    const sy = (j + 0.5) / RES_S * RES_B - 0.5;
    const j0 = Math.max(0, Math.min(RES_B - 1, Math.floor(sy)));
    const j1 = Math.max(0, Math.min(RES_B - 1, j0 + 1));
    const fy = sy - j0;
    for (let i = 0; i < RES_S; i++) {
      const sx = (i + 0.5) / RES_S * RES_B - 0.5;
      const i0 = Math.max(0, Math.min(RES_B - 1, Math.floor(sx)));
      const i1 = Math.max(0, Math.min(RES_B - 1, i0 + 1));
      const fx = sx - i0;
      const v00 = src[j0 * RES_B + i0];
      const v10 = src[j0 * RES_B + i1];
      const v01 = src[j1 * RES_B + i0];
      const v11 = src[j1 * RES_B + i1];
      const v0 = v00 * (1 - fx) + v10 * fx;
      const v1 = v01 * (1 - fx) + v11 * fx;
      out[j * RES_S + i] = v0 * (1 - fy) + v1 * fy;
    }
  }
  return out;
}

function fmt(x: number, d = 2) { return isFinite(x) ? x.toFixed(d) : '—'; }

// ═══════════════════════════════════════════════════════════════
// EngineController
// ═══════════════════════════════════════════════════════════════

interface Handle {
  pairwise: PairwiseEngine | null;
  bridge: BridgeEngine | null;
  latestStats: PairwiseStats | null;
  maxRho: number;
  maxT: number;
  stencilState: Float32Array;        // 4·RES_S²
  stencilNext:  Float32Array;
  stencilVmax: number;
  stencilTex: THREE.DataTexture | null;
  bridgeSliceSource: Float32Array;   // upsampled to RES_S²
}

function EngineController({
  config, preset, playing, tauCouple, handleRef, onSeed,
}: {
  config: PairwiseEngineConfig;
  preset: StencilPreset;
  playing: boolean;
  tauCouple: number;
  handleRef: React.MutableRefObject<Handle>;
  onSeed: () => void;
}) {
  const { gl } = useThree();
  const pwRef = useRef<PairwiseEngine | null>(null);
  const brRef = useRef<BridgeEngine | null>(null);
  const lastBridge = useRef(0);
  const lastStats  = useRef(0);

  useEffect(() => {
    try {
      pwRef.current = new PairwiseEngine(gl, config);
      brRef.current = new BridgeEngine(gl, {
        atomsPerSide: RES_ATOMS,
        blobsPerSide: RES_BRIDGE,
        boxSize: config.boxSize,
        computeTemperature: true,
        computeSpecies: false,
      });
      handleRef.current.pairwise = pwRef.current;
      handleRef.current.bridge = brRef.current;
    } catch (err) {
      console.error('[TissueField] init failed:', err);
    }
    return () => {
      pwRef.current?.dispose();
      brRef.current?.dispose();
      pwRef.current = null; brRef.current = null;
      handleRef.current.pairwise = null;
      handleRef.current.bridge = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.resolution, config.boxSize, gl]);

  useEffect(() => {
    const eng = pwRef.current;
    if (!eng || !config.thermostat) return;
    eng.setTargetTemp(config.thermostat.targetTemp);
    eng.setThermostatTau(config.thermostat.tau);
    eng.setDt(config.dt);
  }, [config.thermostat?.targetTemp, config.thermostat?.tau, config.dt]);

  useFrame(() => {
    const pw = pwRef.current;
    const br = brRef.current;
    if (!pw || !br || !playing) return;
    pw.step();

    // Bridge cada 3 steps
    if (pw.steps - lastBridge.current >= 3) {
      br.compute(pw.positionTexture, pw.velocityTexture);
      lastBridge.current = pw.steps;

      // Readback slice middle Z → upsample → source de stencil
      const slice = br.readZSlice('thermal', SLICE_Z);
      handleRef.current.bridgeSliceSource = upsample(slice, RES_BRIDGE, RES_STENCIL);
    }

    // Un step del stencil (CPU, barato)
    stepStencil(handleRef.current, preset, tauCouple);

    if (pw.steps - lastStats.current > 15) {
      handleRef.current.latestStats = pw.stats();
      const s = br.densityStats();
      const prev = handleRef.current.maxRho;
      handleRef.current.maxRho = prev === 0 ? s.max : prev * 0.8 + s.max * 0.2;
      handleRef.current.maxT = (handleRef.current.latestStats?.temperature ?? 1) * 2;
      lastStats.current = pw.steps;
    }
  });

  void onSeed;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Stencil step (CPU)
// ═══════════════════════════════════════════════════════════════

function stepStencil(handle: Handle, preset: StencilPreset, tauCouple: number) {
  const src = handle.bridgeSliceSource;
  const reactOf: StencilCpuOptions['reaction'] = (out, u) => {
    // base reaction by kind
    if (preset.kind === 'heat') {
      out[0] = 0; out[1] = 0;
    } else if (preset.kind === 'fisher') {
      const r = preset.extra?.r ?? 1;
      out[0] = r * u[0] * (1 - u[0]);
    } else {
      // gray-scott
      const F = preset.extra?.F ?? 0.04;
      const k = preset.extra?.k ?? 0.06;
      const uvv = u[0] * u[1] * u[1];
      out[0] = -uvv + F * (1 - u[0]);
      out[1] =  uvv - (F + k) * u[1];
    }
  };
  const opts: StencilCpuOptions = {
    RES: RES_STENCIL, L: 10,
    boundary: 'periodic',
    diffusivity: preset.diffusivity,
    dt: preset.dt,
    reaction: (out, u, x, y) => {
      reactOf(out, u, x, y);
      // Coupling source desde el bridge — solo al campo .x
      if (tauCouple > 0 && src) {
        const i = Math.max(0, Math.min(RES_STENCIL - 1, Math.floor((x / 10 + 0.5) * RES_STENCIL)));
        const j = Math.max(0, Math.min(RES_STENCIL - 1, Math.floor((y / 10 + 0.5) * RES_STENCIL)));
        out[0] += (src[j * RES_STENCIL + i] - u[0]) / tauCouple;
      }
    },
  };
  stencilStepCpu(handle.stencilState, handle.stencilNext, opts);
  const tmp = handle.stencilState;
  handle.stencilState = handle.stencilNext;
  handle.stencilNext = tmp;

  // Actualizar vMax suavizado para colorear
  let maxV = 0;
  for (let i = 0; i < handle.stencilState.length; i += 4) {
    if (handle.stencilState[i] > maxV) maxV = handle.stencilState[i];
  }
  handle.stencilVmax = handle.stencilVmax === 0 ? maxV : handle.stencilVmax * 0.9 + maxV * 0.1;

  // Push al DataTexture
  if (handle.stencilTex) {
    const data = handle.stencilTex.image.data as Float32Array;
    data.set(handle.stencilState);
    handle.stencilTex.needsUpdate = true;
  }
}

// ═══════════════════════════════════════════════════════════════
// Views
// ═══════════════════════════════════════════════════════════════

function AtomsView({ handleRef, offsetX }: {
  handleRef: React.MutableRefObject<Handle>; offsetX: number;
}) {
  const { geometry, uniforms } = useMemo(() => {
    const N = RES_ATOMS * RES_ATOMS;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const refUV = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = i % RES_ATOMS, y = Math.floor(i / RES_ATOMS);
      refUV[i * 2] = (x + 0.5) / RES_ATOMS;
      refUV[i * 2 + 1] = (y + 0.5) / RES_ATOMS;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('refUV', new THREE.BufferAttribute(refUV, 2));
    geom.setDrawRange(0, N);
    return {
      geometry: geom,
      uniforms: {
        texturePosition: { value: null as THREE.Texture | null },
        textureVelocity: { value: null as THREE.Texture | null },
        cameraScale:     { value: 7.0 },
        sigma:           { value: 1.0 },
        offsetWorld:     { value: new THREE.Vector3(offsetX, 0, 0) },
      },
    };
  }, [offsetX]);

  useFrame(() => {
    const pw = handleRef.current.pairwise;
    if (!pw) return;
    uniforms.texturePosition.value = pw.positionTexture;
    uniforms.textureVelocity.value = pw.velocityTexture;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial uniforms={uniforms}
        vertexShader={ATOM_VS} fragmentShader={ATOM_FS}
        transparent depthWrite={false} />
    </points>
  );
}

function FieldView({ handleRef, offsetX, boxSize }: {
  handleRef: React.MutableRefObject<Handle>; offsetX: number; boxSize: number;
}) {
  const { geometry, uniforms } = useMemo(() => {
    const N = RES_BRIDGE ** 3;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const blobIdx = new Float32Array(N * 3);
    let n = 0;
    for (let k = 0; k < RES_BRIDGE; k++)
      for (let j = 0; j < RES_BRIDGE; j++)
        for (let i = 0; i < RES_BRIDGE; i++) {
          blobIdx[n*3] = i; blobIdx[n*3+1] = j; blobIdx[n*3+2] = k;
          n++;
        }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('blobIdx', new THREE.BufferAttribute(blobIdx, 3));
    geom.setDrawRange(0, N);
    const cellSize = boxSize / RES_BRIDGE;
    return {
      geometry: geom,
      uniforms: {
        textureFluid:   { value: null as THREE.Texture | null },
        textureThermal: { value: null as THREE.Texture | null },
        RES:            { value: RES_BRIDGE },
        cellSize:       { value: cellSize },
        origin:         { value: new THREE.Vector3(-boxSize/2, -boxSize/2, -boxSize/2) },
        maxRho:         { value: 1.0 },
        maxT:           { value: 2.0 },
        cameraScale:    { value: 7.0 },
        offsetWorld:    { value: new THREE.Vector3(offsetX, 0, 0) },
      },
    };
  }, [boxSize, offsetX]);

  useFrame(() => {
    const br = handleRef.current.bridge;
    if (!br) return;
    uniforms.textureFluid.value = br.fluidTexture;
    uniforms.textureThermal.value = br.thermalTexture;
    uniforms.maxRho.value = handleRef.current.maxRho;
    uniforms.maxT.value = handleRef.current.maxT;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial uniforms={uniforms}
        vertexShader={VOXEL_VS} fragmentShader={VOXEL_FS}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function StencilPlane({ handleRef, offsetX, boxSize, presetKind }: {
  handleRef: React.MutableRefObject<Handle>;
  offsetX: number; boxSize: number; presetKind: ReactionKind;
}) {
  const { geometry, uniforms, tex } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(boxSize, boxSize);
    const data = new Float32Array(RES_STENCIL * RES_STENCIL * 4);
    const t = new THREE.DataTexture(data, RES_STENCIL, RES_STENCIL, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    const kindCode = presetKind === 'heat' ? 0 : presetKind === 'fisher' ? 1 : 2;
    return {
      geometry: geom,
      uniforms: {
        stencilTex: { value: t },
        kind:       { value: kindCode },
        vMax:       { value: 1 },
      },
      tex: t,
    };
  }, [boxSize, presetKind]);

  useEffect(() => {
    handleRef.current.stencilTex = tex;
    return () => {
      handleRef.current.stencilTex = null;
      tex.dispose();
    };
  }, [tex, handleRef]);

  useFrame(() => {
    uniforms.vMax.value = Math.max(0.01, handleRef.current.stencilVmax);
  });

  return (
    <mesh geometry={geometry} position={[offsetX, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shaderMaterial uniforms={uniforms}
        vertexShader={PLANE_VS} fragmentShader={PLANE_FS} transparent={false} />
    </mesh>
  );
}

function Box({ size, offset }: { size: number; offset: number }) {
  return (
    <group position={[offset, 0, 0]}>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(size, size, size)]} />
        <lineBasicMaterial color="#334155" transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// Módulo principal
// ═══════════════════════════════════════════════════════════════

export default function TissueField() {
  const { audience } = useAudience();
  const [stencilId, setStencilId] = useState<string>('heat');
  const preset = STENCIL_PRESETS.find(p => p.id === stencilId)!;
  const [playing, setPlaying] = useState(true);
  const [targetTemp, setTargetTemp] = useState(1.0);
  const [tauCouple, setTauCouple] = useState(preset.tauCouple);
  useEffect(() => setTauCouple(preset.tauCouple), [preset.id, preset.tauCouple]);

  const config: PairwiseEngineConfig = useMemo(() => {
    const N = RES_ATOMS * RES_ATOMS;
    const boxSize = Math.cbrt(N) * 1.5;
    const lj = {
      ...LJ_FORCE,
      uniforms: {
        ljSigma:      { value: [1, 1, 1, 1] },
        ljEpsilon:    { value: [1, 1, 1, 1] },
        epsilonScale: { value: 1 },
        cutoffFactor: { value: 2.5 },
      },
    };
    return {
      resolution: RES_ATOMS,
      boxSize, dt: 0.005,
      initialTemperature: 1.2,
      species: [{ mass: 1, fraction: 1 }],
      forces: [lj],
      thermostat: { targetTemp, tau: 0.6 },
      speedCap: 50,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetTemp]);

  const handleRef = useRef<Handle>({
    pairwise: null, bridge: null, latestStats: null, maxRho: 0, maxT: 1,
    stencilState: new Float32Array(RES_STENCIL * RES_STENCIL * 4),
    stencilNext:  new Float32Array(RES_STENCIL * RES_STENCIL * 4),
    stencilVmax: 1,
    stencilTex: null,
    bridgeSliceSource: new Float32Array(RES_STENCIL * RES_STENCIL),
  });

  // Re-seed del stencil cuando cambia el preset (Gray-Scott necesita IC distinta)
  useEffect(() => {
    const st = handleRef.current.stencilState;
    st.fill(0);
    if (preset.kind === 'gray-scott') {
      // u=1 uniforme, v=0 salvo cuadrado central con v=0.25
      for (let i = 0; i < RES_STENCIL * RES_STENCIL; i++) {
        st[i * 4 + 0] = 1.0;
      }
      const mid = RES_STENCIL / 2;
      for (let j = mid - 3; j <= mid + 3; j++) {
        for (let i = mid - 3; i <= mid + 3; i++) {
          st[(j * RES_STENCIL + i) * 4 + 0] = 0.5;
          st[(j * RES_STENCIL + i) * 4 + 1] = 0.25;
        }
      }
    } else if (preset.kind === 'fisher') {
      const mid = RES_STENCIL / 2;
      for (let j = mid - 2; j <= mid + 2; j++) {
        for (let i = mid - 2; i <= mid + 2; i++) {
          st[(j * RES_STENCIL + i) * 4 + 0] = 0.1;
        }
      }
    }
    handleRef.current.stencilVmax = 1;
  }, [preset.kind]);

  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 150);
    return () => clearInterval(t);
  }, []);

  const boxSize = config.boxSize;
  const gap = boxSize * 0.3;
  const offsetAtoms  = -(boxSize + gap);
  const offsetBridge = 0;
  const offsetPlane  = +(boxSize + gap);
  const span = boxSize * 3 + gap * 2;
  const stats = handleRef.current.latestStats;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0"
        style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>
        <Canvas
          camera={{ position: [0, span * 0.4, span * 0.7], fov: 45, near: 0.01, far: 10000 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          style={{ background: 'transparent', width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 8, 5]} intensity={0.55} color="#CBD5E1" />
          <directionalLight position={[-6, -3, -4]} intensity={0.25} color="#4FC3F7" />
          <OrbitControls enableDamping dampingFactor={0.08}
            minDistance={boxSize * 0.2} maxDistance={span * 3} />
          <Box size={boxSize} offset={offsetAtoms} />
          <Box size={boxSize} offset={offsetBridge} />
          <EngineController config={config} preset={preset} playing={playing}
            tauCouple={tauCouple} handleRef={handleRef} onSeed={() => {}} />
          <AtomsView handleRef={handleRef} offsetX={offsetAtoms} />
          <FieldView handleRef={handleRef} offsetX={offsetBridge} boxSize={boxSize} />
          <StencilPlane handleRef={handleRef} offsetX={offsetPlane}
            boxSize={boxSize} presetKind={preset.kind} />
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.75} luminanceThreshold={0.15} luminanceSmoothing={0.4}
              mipmapBlur kernelSize={KernelSize.LARGE} />
            <Vignette offset={0.25} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
          </EffectComposer>
        </Canvas>

        <div className="absolute top-4 left-6 text-[11px] font-mono text-[#CBD5E1]">
          <div className="text-[#64748B] uppercase tracking-widest text-[9px]">nivel 0</div>
          <div className="text-[#4FC3F7] text-[14px] mt-0.5">{RES_ATOMS**2} átomos MD</div>
        </div>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] font-mono text-[#CBD5E1] text-center">
          <div className="text-[#64748B] uppercase tracking-widest text-[9px]">nivel 1</div>
          <div className="text-[#FBBF24] text-[14px] mt-0.5">{RES_BRIDGE**3} blobs ρ, T</div>
        </div>
        <div className="absolute top-4 right-6 text-[11px] font-mono text-[#CBD5E1] text-right">
          <div className="text-[#64748B] uppercase tracking-widest text-[9px]">nivel 2 · {preset.name}</div>
          <div className="text-[#F87171] text-[14px] mt-0.5">{RES_STENCIL}² celdas RD</div>
        </div>

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setPlaying(p => !p)} active={playing}>{playing ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => { handleRef.current.pairwise?.reset(); }} title="Reiniciar MD">↺</IconBtn>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Reactor nivel 2">
          <div className="grid grid-cols-1 gap-1.5">
            {STENCIL_PRESETS.map(p => (
              <button key={p.id} onClick={() => setStencilId(p.id)}
                data-testid={`preset-${p.id}`}
                className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                  stencilId === p.id
                    ? 'bg-gradient-to-br from-[#DC2626]/30 to-[#F59E0B]/30 border-[#F87171]/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}>{p.name}</button>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
        </Section>

        {audience === 'child' ? (
          <Section title="Lo que ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p><span className="text-[#4FC3F7]">Izquierda</span>: átomos de verdad (bla fri)</p>
              <p><span className="text-[#FBBF24]">Centro</span>: promedio de los átomos (lo que ve la termodinámica).</p>
              <p><span className="text-[#F87171]">Derecha</span>: ecuación más simple que respira el MD.</p>
              <p>Ajusta el acople τ: bajo → la PDE sigue al MD; alto → la PDE tiene vida propia.</p>
            </div>
          </Section>
        ) : (
          <Section title="Estado">
            <Row label="N_atoms"    value={(RES_ATOMS**2).toLocaleString('en-US')} />
            <Row label="N_blobs"    value={(RES_BRIDGE**3).toLocaleString('en-US')} />
            <Row label="N_stencil"  value={(RES_STENCIL**2).toLocaleString('en-US')} />
            <Row label="τ_couple"   value={fmt(tauCouple, 1)} />
            <Row label="T*"         value={stats ? fmt(stats.temperature, 3) : '—'} />
            <Row label="L box"      value={`${fmt(boxSize, 2)} σ`} />
            <Row label="Δx stencil" value={`${fmt(10/RES_STENCIL, 3)} u`} />
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Acople bridge ↔ stencil">
            <Slider label="τ_couple" v={tauCouple} min={1} max={500} step={0.5} on={setTauCouple} />
            <Slider label="T_MD"     v={targetTemp} min={0.1} max={3} step={0.01} on={setTargetTemp} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              τ pequeño → PDE esclava del MD. τ grande → PDE dominada por su propia R(u).
            </div>
          </Section>
        )}

        <Section title="Ecuación">
          <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
            <div className="text-white">∂u/∂t = D ∇²u + R(u)</div>
            <div className="text-white">+ (T_bridge − u)/τ</div>
            <div className="mt-2 text-[#94A3B8]">R depende del preset (heat, Fisher, Gray-Scott).</div>
          </div>
        </Section>

        <Section title="Escalera">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p><span className="text-[#4FC3F7]">nivel 0</span> → PairwiseEngine (GPU, LJ)</p>
            <p><span className="text-[#FBBF24]">nivel 1</span> → BridgeEngine (GPU, Irving-Kirkwood)</p>
            <p><span className="text-[#F87171]">nivel 2</span> → stencilStepCpu acoplado</p>
            <p className="mt-2 text-[10px]">Los 3 usan la misma abstracción: plantilla + snippet pluggable.</p>
          </div>
        </Section>
      </aside>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UI helpers
// ═══════════════════════════════════════════════════════════════

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}
function IconBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
        active
          ? 'border-[#F87171]/60 text-[#F87171] bg-[#F87171]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>{children}</button>
  );
}
