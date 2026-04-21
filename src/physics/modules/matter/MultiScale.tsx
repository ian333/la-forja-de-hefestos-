/**
 * Multi-escala — atomo ↔ continuo emergente, simultáneo.
 *
 * Panel izquierdo: nube de 4096 átomos LJ (nivel 0 de la escalera).
 * Panel derecho:   mismo sistema visto como campos de densidad y
 *                  temperatura coarse-grained por el bridge (nivel 1).
 *
 * Al cambiar T_set o cambiar el preset, VES en tiempo real cómo el
 * patrón atómico → un campo continuo distinto. Esa es la escalera
 * física de la forja, no es metáfora.
 *
 * Motor atómico: `PairwiseEngine` con LJ.
 * Motor puente:  `BridgeEngine` con fluid + thermal aggregators.
 *
 * El "volumetric" derecho es una nube de puntos-voxel: cada blob
 * renderiza un glyph cuyo tamaño ∝ ρ y color va de azul (frío) a rojo
 * (caliente). 8³ = 512 blobs bastan para ver la estructura.
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
import { useAudience } from '@/physics/context';

// ═══════════════════════════════════════════════════════════════
// Shaders — átomos (izquierda)
// ═══════════════════════════════════════════════════════════════

const ATOM_VS = /* glsl */ `
  attribute vec2 refUV;
  uniform sampler2D texturePosition;
  uniform sampler2D textureVelocity;
  uniform float cameraScale;
  uniform float sigma;
  uniform vec3 offsetWorld;   // desplazamiento en X para panel izquierdo
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
    vec3 color = vColor * (0.40 + 0.60 * fall);
    gl_FragColor = vec4(color, fall);
  }
`;

// ═══════════════════════════════════════════════════════════════
// Shaders — voxels del campo (derecha)
// ═══════════════════════════════════════════════════════════════

const VOXEL_VS = /* glsl */ `
  attribute vec3 blobIdx;       // (bx, by, bz) en [0, RES)
  uniform sampler2D textureFluid;
  uniform sampler2D textureThermal;
  uniform float RES;
  uniform float cellSize;
  uniform vec3 origin;          // esquina del dominio en mundo
  uniform float maxRho;
  uniform float maxT;
  uniform float cameraScale;
  uniform vec3 offsetWorld;
  varying float vRho;
  varying float vT;

  void main() {
    vec3 world = origin + (blobIdx + 0.5) * cellSize + offsetWorld;
    // UV en textura aplanada RES × RES²
    float u = (blobIdx.x + 0.5) / RES;
    float v = (blobIdx.y + RES * blobIdx.z + 0.5) / (RES * RES);
    vec4 fluid = texture2D(textureFluid, vec2(u, v));
    vec4 therm = texture2D(textureThermal, vec2(u, v));
    vRho = fluid.x;
    vT   = therm.x;
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    // Tamaño proporcional a densidad, base mínima para verlo aunque vacío
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
    // Viridis-style: azul → verde → amarillo → rojo
    vec3 c1 = vec3(0.05, 0.20, 0.55);   // frío profundo
    vec3 c2 = vec3(0.15, 0.50, 0.60);
    vec3 c3 = vec3(0.35, 0.75, 0.45);
    vec3 c4 = vec3(0.95, 0.85, 0.20);
    vec3 c5 = vec3(0.95, 0.35, 0.15);   // caliente
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
// Preset
// ═══════════════════════════════════════════════════════════════

interface Preset {
  id: string; name: string; note: string;
  resolution: 32 | 48 | 64;
  blobsPerSide: 4 | 6 | 8;
  targetTemp: number; initialTemp: number;
  boxScale: number;
}

const PRESETS: Preset[] = [
  {
    id: 'gas',
    name: 'Gas uniforme',
    note: 'ρ aprox constante en todo el dominio. T uniforme. Esto es lo que espera la termodinámica.',
    resolution: 48, blobsPerSide: 6,
    targetTemp: 2.0, initialTemp: 2.0, boxScale: 2.0,
  },
  {
    id: 'liquid',
    name: 'Líquido',
    note: 'Denso pero fluye. La densidad fluctúa (estructura local). T uniforme si hay termostato.',
    resolution: 48, blobsPerSide: 6,
    targetTemp: 0.8, initialTemp: 1.0, boxScale: 1.3,
  },
  {
    id: 'condensation',
    name: 'Condensación (T = 0.6)',
    note: 'Gas diluido enfriado → gotas. Emergen blobs de ρ alta separados por vacío.',
    resolution: 48, blobsPerSide: 8,
    targetTemp: 0.6, initialTemp: 1.5, boxScale: 2.5,
  },
  {
    id: 'hot-core',
    name: 'Gradiente térmico (asimétrico)',
    note: 'Arranque inhomogéneo: mitad caliente, mitad fría. Ver cómo evoluciona la T_field.',
    resolution: 48, blobsPerSide: 8,
    targetTemp: 1.0, initialTemp: 1.0, boxScale: 1.5,
  },
];

// ═══════════════════════════════════════════════════════════════
// EngineController — crea PairwiseEngine + BridgeEngine
// ═══════════════════════════════════════════════════════════════

interface EngineHandle {
  pairwise: PairwiseEngine | null;
  bridge: BridgeEngine | null;
  latestStats: PairwiseStats | null;
  maxRho: number;
  maxT: number;
}

function EngineController({
  config, playing, handleRef, preset,
}: {
  config: PairwiseEngineConfig;
  playing: boolean;
  handleRef: React.MutableRefObject<EngineHandle>;
  preset: Preset;
}) {
  const { gl } = useThree();
  const pairwiseRef = useRef<PairwiseEngine | null>(null);
  const bridgeRef = useRef<BridgeEngine | null>(null);
  const lastStats = useRef(0);
  const lastBridge = useRef(0);

  useEffect(() => {
    try {
      pairwiseRef.current = new PairwiseEngine(gl, config);
      bridgeRef.current = new BridgeEngine(gl, {
        atomsPerSide: preset.resolution,
        blobsPerSide: preset.blobsPerSide,
        boxSize: config.boxSize,
        computeTemperature: true,
        computeSpecies: false,
        periodic: true,
      });
      handleRef.current.pairwise = pairwiseRef.current;
      handleRef.current.bridge = bridgeRef.current;
    } catch (err) {
      console.error('[MultiScale] engine init failed:', err);
    }
    return () => {
      pairwiseRef.current?.dispose();
      bridgeRef.current?.dispose();
      pairwiseRef.current = null;
      bridgeRef.current = null;
      handleRef.current.pairwise = null;
      handleRef.current.bridge = null;
      handleRef.current.latestStats = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.resolution, config.boxSize, preset.blobsPerSide, gl]);

  useEffect(() => {
    const eng = pairwiseRef.current;
    if (!eng || !config.thermostat) return;
    eng.setTargetTemp(config.thermostat.targetTemp);
    eng.setThermostatTau(config.thermostat.tau);
    eng.setDt(config.dt);
  }, [config.thermostat?.targetTemp, config.thermostat?.tau, config.dt]);

  useFrame(() => {
    const pw = pairwiseRef.current;
    const br = bridgeRef.current;
    if (!pw || !br || !playing) return;
    pw.step();

    // Bridge cada 3 steps para amortiguar costo (RES³ blobs × N atoms por step)
    if (pw.steps - lastBridge.current >= 3) {
      br.compute(pw.positionTexture, pw.velocityTexture);
      lastBridge.current = pw.steps;
    }

    if (pw.steps - lastStats.current > 15) {
      handleRef.current.latestStats = pw.stats();
      const s = br.densityStats();
      // Actualizamos max para escalar los shaders (con pasa-bajo para suavizar)
      const prev = handleRef.current.maxRho;
      handleRef.current.maxRho = prev === 0 ? s.max : prev * 0.8 + s.max * 0.2;
      const T = handleRef.current.latestStats?.temperature ?? 1;
      handleRef.current.maxT = T * 2;  // escala para el mapa de calor
      lastStats.current = pw.steps;
    }
  });

  return null;
}

// ═══════════════════════════════════════════════════════════════
// Atoms renderer (panel izquierdo, offset en −X)
// ═══════════════════════════════════════════════════════════════

function AtomsView({
  handleRef, resolution, offsetX,
}: {
  handleRef: React.MutableRefObject<EngineHandle>;
  resolution: number;
  offsetX: number;
}) {
  const { geometry, uniforms } = useMemo(() => {
    const N = resolution * resolution;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const refUV = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = i % resolution;
      const y = Math.floor(i / resolution);
      refUV[i * 2]     = (x + 0.5) / resolution;
      refUV[i * 2 + 1] = (y + 0.5) / resolution;
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
  }, [resolution, offsetX]);

  useFrame(() => {
    const pw = handleRef.current.pairwise;
    if (!pw) return;
    uniforms.texturePosition.value = pw.positionTexture;
    uniforms.textureVelocity.value = pw.velocityTexture;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={ATOM_VS}
        fragmentShader={ATOM_FS}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

// ═══════════════════════════════════════════════════════════════
// Voxel field renderer (panel derecho, offset en +X)
// ═══════════════════════════════════════════════════════════════

function FieldView({
  handleRef, blobsPerSide, boxSize, offsetX,
}: {
  handleRef: React.MutableRefObject<EngineHandle>;
  blobsPerSide: number;
  boxSize: number;
  offsetX: number;
}) {
  const { geometry, uniforms } = useMemo(() => {
    const N = blobsPerSide ** 3;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const blobIdx = new Float32Array(N * 3);
    let n = 0;
    for (let k = 0; k < blobsPerSide; k++)
      for (let j = 0; j < blobsPerSide; j++)
        for (let i = 0; i < blobsPerSide; i++) {
          blobIdx[n * 3    ] = i;
          blobIdx[n * 3 + 1] = j;
          blobIdx[n * 3 + 2] = k;
          n++;
        }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('blobIdx', new THREE.BufferAttribute(blobIdx, 3));
    geom.setDrawRange(0, N);
    const cellSize = boxSize / blobsPerSide;
    return {
      geometry: geom,
      uniforms: {
        textureFluid:   { value: null as THREE.Texture | null },
        textureThermal: { value: null as THREE.Texture | null },
        RES:            { value: blobsPerSide },
        cellSize:       { value: cellSize },
        origin:         { value: new THREE.Vector3(-boxSize/2, -boxSize/2, -boxSize/2) },
        maxRho:         { value: 1.0 },
        maxT:           { value: 2.0 },
        cameraScale:    { value: 7.0 },
        offsetWorld:    { value: new THREE.Vector3(offsetX, 0, 0) },
      },
    };
  }, [blobsPerSide, boxSize, offsetX]);

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
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VOXEL_VS}
        fragmentShader={VOXEL_FS}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ═══════════════════════════════════════════════════════════════
// Helpers UI
// ═══════════════════════════════════════════════════════════════

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

function fmt(x: number, d = 2) { return isFinite(x) ? x.toFixed(d) : '—'; }

// ═══════════════════════════════════════════════════════════════
// Módulo principal
// ═══════════════════════════════════════════════════════════════

export default function MultiScale() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('liquid');
  const preset = PRESETS.find(p => p.id === presetId)!;
  const [playing, setPlaying] = useState(true);
  const [targetTemp, setTargetTemp] = useState(preset.targetTemp);
  const [dt, setDt] = useState(0.005);
  useEffect(() => setTargetTemp(preset.targetTemp), [preset.id, preset.targetTemp]);

  const config: PairwiseEngineConfig = useMemo(() => {
    const N = preset.resolution * preset.resolution;
    const boxSize = Math.cbrt(N) * preset.boxScale;
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
      resolution: preset.resolution,
      boxSize, dt,
      initialTemperature: preset.initialTemp,
      species: [{ mass: 1, fraction: 1 }],
      forces: [lj],
      thermostat: { targetTemp, tau: 0.6 },
      speedCap: 50,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id, targetTemp, dt]);

  const handleRef = useRef<EngineHandle>({
    pairwise: null, bridge: null, latestStats: null, maxRho: 0, maxT: 1,
  });

  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 150);
    return () => clearInterval(t);
  }, []);

  const boxSize = config.boxSize;
  const gap = boxSize * 0.3;
  const offsetLeft  = -(boxSize / 2 + gap);
  const offsetRight = +(boxSize / 2 + gap);
  const viewSpan = boxSize * 2 + gap * 2;
  const stats = handleRef.current.latestStats;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0"
        style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>
        <Canvas
          camera={{ position: [0, viewSpan * 0.45, viewSpan * 0.9], fov: 48, near: 0.01, far: 10000 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          style={{ background: 'transparent', width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 8, 5]} intensity={0.55} color="#CBD5E1" />
          <directionalLight position={[-6, -3, -4]} intensity={0.25} color="#4FC3F7" />
          <OrbitControls enableDamping dampingFactor={0.08}
            minDistance={boxSize * 0.2} maxDistance={viewSpan * 4} />
          <Box size={boxSize} offset={offsetLeft} />
          <Box size={boxSize} offset={offsetRight} />
          <EngineController config={config} playing={playing} handleRef={handleRef} preset={preset} />
          <AtomsView handleRef={handleRef} resolution={preset.resolution} offsetX={offsetLeft} />
          <FieldView handleRef={handleRef} blobsPerSide={preset.blobsPerSide} boxSize={boxSize} offsetX={offsetRight} />
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.85} luminanceThreshold={0.1} luminanceSmoothing={0.4}
              mipmapBlur kernelSize={KernelSize.LARGE} />
            <Vignette offset={0.25} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
          </EffectComposer>
        </Canvas>

        {/* Etiquetas de los dos paneles */}
        <div className="absolute top-4 left-6 text-[11px] font-mono text-[#CBD5E1]">
          <div className="text-[#64748B] uppercase tracking-widest text-[9px]">nivel 0 · átomos</div>
          <div className="text-[#4FC3F7] text-[14px] mt-0.5">{preset.resolution ** 2} partículas LJ</div>
        </div>
        <div className="absolute top-4 right-6 text-[11px] font-mono text-[#CBD5E1] text-right">
          <div className="text-[#64748B] uppercase tracking-widest text-[9px]">nivel 1 · continuum</div>
          <div className="text-[#F87171] text-[14px] mt-0.5">{preset.blobsPerSide ** 3} blobs · ρ, T</div>
        </div>

        {/* Stats central */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-4 px-4 py-2 rounded-lg bg-[#0B0F17]/85 backdrop-blur border border-[#1E293B] font-mono text-[11px]">
          <div><span className="text-[#64748B]">T</span> <span className="text-white">{stats ? fmt(stats.temperature, 3) : '—'}</span></div>
          <div><span className="text-[#64748B]">ρ_max</span> <span className="text-white">{fmt(handleRef.current.maxRho, 3)}</span></div>
          <div><span className="text-[#64748B]">ρ_mean</span> <span className="text-white">{fmt(preset.resolution**2 / Math.pow(boxSize, 3), 3)}</span></div>
        </div>

        {/* Controles */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setPlaying(p => !p)} active={playing}>{playing ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => { handleRef.current.pairwise?.reset(); }} title="Reiniciar">↺</IconBtn>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Preset">
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => setPresetId(p.id)}
                data-testid={`preset-${p.id}`}
                className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                  presetId === p.id
                    ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#DC2626]/30 border-[#F87171]/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}>{p.name}</button>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
        </Section>

        {audience === 'child' ? (
          <Section title="Lo que ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Mismo sistema, dos maneras de verlo:</p>
              <p><span className="text-[#4FC3F7]">Izquierda</span> — cada átomo como un punto.</p>
              <p><span className="text-[#F87171]">Derecha</span> — lo mismo "borroso", promediado en cubos. Así lo ve un termodinámico: solo importa la densidad y la temperatura, no cada átomo.</p>
              <p>Al cambiar T ves cómo ambas vistas responden al mismo tiempo.</p>
            </div>
          </Section>
        ) : (
          <Section title="Estado">
            <Row label="N átomos"  value={(preset.resolution**2).toLocaleString('en-US')} />
            <Row label="N blobs"   value={(preset.blobsPerSide**3).toLocaleString('en-US')} />
            <Row label="L caja"    value={`${fmt(boxSize, 2)} σ`} />
            <Row label="Δx blob"   value={`${fmt(boxSize/preset.blobsPerSide, 2)} σ`} />
            <Row label="T*set"     value={fmt(targetTemp, 3)} />
            <Row label="T*meas"    value={stats ? fmt(stats.temperature, 3) : '—'} />
            <Row label="ρ_mean"    value={fmt(preset.resolution**2 / Math.pow(boxSize, 3), 4)} />
            <Row label="ρ_max/⟨ρ⟩" value={fmt(handleRef.current.maxRho / Math.max(preset.resolution**2 / Math.pow(boxSize, 3), 1e-6), 2)} />
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Termostato">
            <Slider label="T_target" v={targetTemp} min={0.1} max={4} step={0.01} on={setTargetTemp} />
            <Slider label="dt"       v={dt}         min={0.001} max={0.01} step={0.0005} on={setDt} />
          </Section>
        )}

        <Section title="Ecuación">
          <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
            <div className="text-white">ρ(x) = (1/V) Σ_{'{'}i∈V{'}'} mᵢ</div>
            <div className="text-white">u(x) = Σmᵢvᵢ / Σmᵢ</div>
            <div className="text-white">T(x) = (1/3N_V) Σmᵢ(vᵢ-u)²</div>
            <div className="mt-1 text-[#94A3B8]">Irving-Kirkwood 1950. Bridge cada 3 pasos atómicos.</div>
          </div>
        </Section>

        <Section title="Arquitectura">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p><span className="text-white">Mismo motor</span> de pairwise en GPU que IdealGasGPU y MoleculeGPU. El bridge es otro shader one-shot que lee las mismas texturas.</p>
            <p className="font-mono text-[10px] text-[#64748B]">src/lib/gpu/bridge-engine.ts</p>
            <p>Nivel 0 (átomos) → bridge → nivel 1 (ρ, u, T). El nivel 2 (células con reacción-difusión) consume las mismas texturas vía stencil.ts. Escalera cerrada.</p>
          </div>
        </Section>
      </aside>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UI helpers idénticos al patrón de la forja
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
        <span className="text-white">{v.toFixed(3)}</span>
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
