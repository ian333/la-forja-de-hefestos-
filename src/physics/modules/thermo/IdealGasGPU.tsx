/**
 * Gas ideal / líquido / sólido LJ en GPU — el nivel 0 de la escalera.
 *
 * N átomos (1 024 – 16 384) con potencial de Lennard-Jones 12-6 pairwise
 * en 3D con condiciones periódicas. Termostato de Berendsen ajusta T
 * objetivo. Al variar T se cruzan las tres fases emergentes:
 *
 *   T ≈ 0.3 ε/k_B → sólido (red cristalina FCC aproximada)
 *   T ≈ 1.0       → líquido (LJ está cerca de su punto crítico ≈ 1.31)
 *   T ≳ 1.5       → gas
 *
 * Motor: `src/lib/gpu/pairwise-engine` sobre `ForgeCompute` + `LJ_FORCE`.
 * El mismo engine mañana corre Coulomb y gravedad cambiando una línea.
 *
 * Visualización: Points 3D, cada vertex lee su posición de la textura
 * RGBA32F del engine (GPU → GPU, sin readback). Temperatura y energía
 * cinética salen por readback cada 15 frames.
 *
 * Referencias:
 *   · Allen & Tildesley, "Computer Simulation of Liquids", 2ª ed., 2017.
 *   · Hansen & McDonald, "Theory of Simple Liquids", 4ª ed., 2013 — Tc LJ.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { PairwiseEngine, type PairwiseEngineConfig, type PairwiseStats } from '@/lib/gpu/pairwise-engine';
import { LJ_FORCE } from '@/lib/gpu/pairwise';
import { useAudience } from '@/physics/context';

// ═══════════════════════════════════════════════════════════════
// Shaders de render — lee posición desde la textura GPU
// ═══════════════════════════════════════════════════════════════

const RENDER_VS = /* glsl */ `
  attribute vec2 refUV;
  uniform sampler2D texturePosition;
  uniform sampler2D textureVelocity;
  uniform float cameraScale;
  uniform vec4 speciesSigma;
  varying vec3 vColor;
  varying float vSpeed;

  vec3 colorForSpecies(int s) {
    if (s == 0) return vec3(0.31, 0.76, 0.97);   // cian (A)
    if (s == 1) return vec3(1.00, 0.72, 0.30);   // naranja (B)
    if (s == 2) return vec3(0.40, 0.73, 0.42);   // verde (C)
    return vec3(0.94, 0.33, 0.31);               // rojo (D)
  }
  float sigmaFor(int s) {
    if (s == 0) return speciesSigma.x;
    if (s == 1) return speciesSigma.y;
    if (s == 2) return speciesSigma.z;
    return speciesSigma.w;
  }

  void main() {
    vec4 p = texture2D(texturePosition, refUV);
    vec4 v = texture2D(textureVelocity, refUV);
    int species = int(p.w + 0.5);
    vec3 col = colorForSpecies(species);
    float speed = length(v.xyz);
    vSpeed = speed;
    // tinte caliente con velocidad
    vec3 hot = vec3(1.0, 0.55, 0.20);
    vColor = mix(col, hot, clamp(speed * 0.3, 0.0, 0.65));
    vec4 mv = modelViewMatrix * vec4(p.xyz, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = sigmaFor(species) * cameraScale * (100.0 / -mv.z);
  }
`;

const RENDER_FS = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vSpeed;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d2 = dot(c, c) * 4.0;
    if (d2 > 1.0) discard;
    float fall = sqrt(max(0.0, 1.0 - d2));
    vec3 color = vColor * (0.35 + 0.65 * fall);
    float glow = clamp(vSpeed * 0.05, 0.0, 0.7);
    color += vec3(1.0, 0.55, 0.20) * glow * 0.15;
    gl_FragColor = vec4(color, fall);
  }
`;

// ═══════════════════════════════════════════════════════════════
// Presets — fases LJ y mezclas
// ═══════════════════════════════════════════════════════════════

type ResLevel = 32 | 48 | 64 | 96;

interface Preset {
  id: string;
  name: string;
  note: string;
  targetTemp: number;
  initialTemp: number;
  tau: number;
  resolution: ResLevel;
  boxScale: number;   // factor sobre sqrt(N)·σ
  species: { mass: number; fraction: number; sigma: number; epsilon: number }[];
}

const PRESETS: Preset[] = [
  {
    id: 'gas',
    name: 'Gas (T = 2.0, baja densidad)',
    note: 'Partículas muy sueltas, velocidades grandes. El cluster se disuelve.',
    targetTemp: 2.0, initialTemp: 2.0, tau: 1.0,
    resolution: 48, boxScale: 2.2,
    species: [{ mass: 1, fraction: 1, sigma: 1, epsilon: 1 }],
  },
  {
    id: 'liquid',
    name: 'Líquido (T = 0.9)',
    note: 'Densidad media. Los átomos se tocan pero fluyen — cerca del punto crítico LJ.',
    targetTemp: 0.9, initialTemp: 1.2, tau: 0.4,
    resolution: 48, boxScale: 1.35,
    species: [{ mass: 1, fraction: 1, sigma: 1, epsilon: 1 }],
  },
  {
    id: 'solid',
    name: 'Sólido (T = 0.25)',
    note: 'Red cristalina tipo FCC emerge al enfriar lento. Coordinación 12.',
    targetTemp: 0.25, initialTemp: 0.6, tau: 0.8,
    resolution: 48, boxScale: 1.2,
    species: [{ mass: 1, fraction: 1, sigma: 1, epsilon: 1 }],
  },
  {
    id: 'mix',
    name: 'Mezcla A + B (T = 1.0)',
    note: 'Dos especies con σ, ε y masa distintos. Emergen correlaciones de pares.',
    targetTemp: 1.0, initialTemp: 1.2, tau: 0.5,
    resolution: 48, boxScale: 1.45,
    species: [
      { mass: 1,   fraction: 0.5, sigma: 1.0, epsilon: 1.0 },
      { mass: 2.5, fraction: 0.5, sigma: 1.3, epsilon: 1.5 },
    ],
  },
  {
    id: 'dense',
    name: 'Denso N = 9 216',
    note: 'Mismo sistema con 9216 partículas. La GPU no se inmuta.',
    targetTemp: 1.0, initialTemp: 1.2, tau: 0.5,
    resolution: 96, boxScale: 1.4,
    species: [{ mass: 1, fraction: 1, sigma: 1, epsilon: 1 }],
  },
];

// ═══════════════════════════════════════════════════════════════
// Engine controller (dentro del Canvas para acceder a gl)
// ═══════════════════════════════════════════════════════════════

interface EngineHandle {
  engine: PairwiseEngine | null;
  latestStats: PairwiseStats | null;
}

function EngineController({
  config, playing, handleRef,
}: {
  config: PairwiseEngineConfig;
  playing: boolean;
  handleRef: React.MutableRefObject<EngineHandle>;
}) {
  const { gl } = useThree();
  const engineRef = useRef<PairwiseEngine | null>(null);
  const lastStatsStep = useRef(0);

  useEffect(() => {
    try {
      engineRef.current = new PairwiseEngine(gl, config);
      handleRef.current.engine = engineRef.current;
    } catch (err) {
      console.error('[IdealGasGPU] engine init failed:', err);
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
      handleRef.current.engine = null;
      handleRef.current.latestStats = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.resolution, config.boxSize, gl]);

  // Updates en vivo sin reconstruir
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (config.thermostat) {
      eng.setTargetTemp(config.thermostat.targetTemp);
      eng.setThermostatTau(config.thermostat.tau);
    }
    eng.setDt(config.dt);
  }, [config.thermostat?.targetTemp, config.thermostat?.tau, config.dt]);

  useFrame(() => {
    const eng = engineRef.current;
    if (!eng || !playing) return;
    eng.step();
    if (eng.steps - lastStatsStep.current > 15) {
      handleRef.current.latestStats = eng.stats();
      lastStatsStep.current = eng.steps;
    }
  });

  return null;
}

// ═══════════════════════════════════════════════════════════════
// Renderer de partículas (GPU texture → Points)
// ═══════════════════════════════════════════════════════════════

function ParticleCloud({
  handleRef, resolution, speciesSigmas,
}: {
  handleRef: React.MutableRefObject<EngineHandle>;
  resolution: number;
  speciesSigmas: [number, number, number, number];
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const N = resolution * resolution;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const refUV = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = i % resolution;
      const y = Math.floor(i / resolution);
      refUV[i * 2    ] = (x + 0.5) / resolution;
      refUV[i * 2 + 1] = (y + 0.5) / resolution;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('refUV', new THREE.BufferAttribute(refUV, 2));
    geom.setDrawRange(0, N);

    const u = {
      texturePosition: { value: null as THREE.Texture | null },
      textureVelocity: { value: null as THREE.Texture | null },
      speciesSigma:    { value: new THREE.Vector4(...speciesSigmas) },
      cameraScale:     { value: 6.0 },
    };
    return { geometry: geom, uniforms: u };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution, speciesSigmas.join(',')]);

  useFrame(() => {
    const eng = handleRef.current.engine;
    if (!eng) return;
    uniforms.texturePosition.value = eng.positionTexture;
    uniforms.textureVelocity.value = eng.velocityTexture;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={RENDER_VS}
        fragmentShader={RENDER_FS}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

// ═══════════════════════════════════════════════════════════════
// Caja periódica wireframe
// ═══════════════════════════════════════════════════════════════

function Box({ size }: { size: number }) {
  return (
    <lineSegments>
      <edgesGeometry args={[new THREE.BoxGeometry(size, size, size)]} />
      <lineBasicMaterial color="#334155" transparent opacity={0.6} />
    </lineSegments>
  );
}

// ═══════════════════════════════════════════════════════════════
// Módulo principal
// ═══════════════════════════════════════════════════════════════

function fmt(x: number, d = 2) { return isFinite(x) ? x.toFixed(d) : '—'; }

export default function IdealGasGPU() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('liquid');
  const preset = PRESETS.find(p => p.id === presetId)!;
  const [playing, setPlaying] = useState(true);
  const [targetTemp, setTargetTemp] = useState(preset.targetTemp);
  const [dt, setDt] = useState(0.005);

  useEffect(() => {
    setTargetTemp(preset.targetTemp);
  }, [preset.id, preset.targetTemp]);

  const config: PairwiseEngineConfig = useMemo(() => {
    const boxSize = Math.cbrt(preset.resolution * preset.resolution) * preset.boxScale;
    const species = preset.species.map(s => ({ mass: s.mass, fraction: s.fraction }));
    const lj = {
      ...LJ_FORCE,
      uniforms: {
        ljSigma: {
          value: [
            preset.species[0]?.sigma ?? 1,
            preset.species[1]?.sigma ?? 1,
            preset.species[2]?.sigma ?? 1,
            preset.species[3]?.sigma ?? 1,
          ],
        },
        ljEpsilon: {
          value: [
            preset.species[0]?.epsilon ?? 1,
            preset.species[1]?.epsilon ?? 1,
            preset.species[2]?.epsilon ?? 1,
            preset.species[3]?.epsilon ?? 1,
          ],
        },
        epsilonScale: { value: 1 },
        cutoffFactor: { value: 2.5 },
      },
    };
    return {
      resolution: preset.resolution,
      boxSize,
      dt,
      initialTemperature: preset.initialTemp,
      species,
      forces: [lj],
      thermostat: { targetTemp, tau: preset.tau },
      speedCap: 50,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id, targetTemp, dt]);

  const handleRef = useRef<EngineHandle>({ engine: null, latestStats: null });

  // Redraw UI periódico para stats
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 150);
    return () => clearInterval(t);
  }, []);

  const N = preset.resolution * preset.resolution;
  const boxSize = config.boxSize;
  const stats = handleRef.current.latestStats;
  const speciesSigmas: [number, number, number, number] = [
    preset.species[0]?.sigma ?? 1,
    preset.species[1]?.sigma ?? 1,
    preset.species[2]?.sigma ?? 1,
    preset.species[3]?.sigma ?? 1,
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0"
        style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>
        <Canvas
          camera={{ position: [boxSize * 0.9, boxSize * 0.5, boxSize * 1.4], fov: 50, near: 0.01, far: 10000 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          style={{ background: 'transparent', width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 8, 5]} intensity={0.6} color="#CBD5E1" />
          <directionalLight position={[-6, -3, -4]} intensity={0.25} color="#4FC3F7" />
          <OrbitControls enableDamping dampingFactor={0.08}
            minDistance={boxSize * 0.2} maxDistance={boxSize * 8} />
          <Box size={boxSize} />
          <EngineController config={config} playing={playing} handleRef={handleRef} />
          <ParticleCloud handleRef={handleRef} resolution={preset.resolution} speciesSigmas={speciesSigmas} />
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.7} luminanceThreshold={0.15} luminanceSmoothing={0.4}
              mipmapBlur kernelSize={KernelSize.LARGE} />
            <Vignette offset={0.25} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
          </EffectComposer>
        </Canvas>

        {/* HUD izquierdo — stats */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/85 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">N&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {N.toLocaleString('en-US')}</div>
          <div><span className="text-[#64748B]">L&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {fmt(boxSize, 2)} σ</div>
          <div><span className="text-[#64748B]">T_set&nbsp;</span>= {fmt(targetTemp, 2)}</div>
          <div><span className="text-[#64748B]">T_act&nbsp;</span>= <span className="text-white">{stats ? fmt(stats.temperature, 3) : '—'}</span></div>
          <div><span className="text-[#64748B]">KE&nbsp;&nbsp;&nbsp;&nbsp;</span>= {stats ? fmt(stats.kineticEnergy, 1) : '—'}</div>
          <div><span className="text-[#64748B]">⟨v⟩&nbsp;&nbsp;&nbsp;</span>= {stats ? fmt(stats.meanSpeed, 3) : '—'}</div>
        </div>

        {/* Controles centrales abajo */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setPlaying(p => !p)} active={playing}>{playing ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => { handleRef.current.engine?.reset(); }} title="Reiniciar">↺</IconBtn>
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
                    ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}>{p.name}</button>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
        </Section>

        {audience === 'child' ? (
          <Section title="Lo que ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Cada punto es un átomo. No lo imagino — la GPU calcula {N.toLocaleString('en-US')} átomos de verdad, cada uno empujando a todos los demás.</p>
              <p>Sube la temperatura: se dispersan. Bájala: se apilan en red.</p>
              <p>Este es el nivel 0 de la escalera — todo lo que construyamos arriba (moléculas, células, tejidos) emerge de aquí.</p>
            </div>
          </Section>
        ) : (
          <Section title="Estado">
            <Row label="N"       value={N.toLocaleString('en-US')} />
            <Row label="L"       value={`${fmt(boxSize, 3)} σ`} />
            <Row label="ρ"       value={`${fmt(N / (boxSize**3), 3)} σ⁻³`} />
            <Row label="T*set"   value={fmt(targetTemp, 3)} />
            <Row label="T*meas"  value={stats ? fmt(stats.temperature, 3) : '—'} />
            <Row label="KE"      value={stats ? fmt(stats.kineticEnergy, 2) : '—'} />
            <Row label="⟨v⟩"     value={stats ? fmt(stats.meanSpeed, 3) : '—'} />
            <Row label="v_max"   value={stats ? fmt(stats.maxSpeed, 2) : '—'} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              Unidades reducidas LJ: σ=ε=m=1 ⇒ [t]=σ√(m/ε), [T]=ε/k_B.
            </div>
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Termostato">
            <Slider label="T_target" v={targetTemp} min={0.1} max={3} step={0.01} on={setTargetTemp} />
            <Slider label="dt" v={dt} min={0.001} max={0.01} step={0.0005} on={setDt} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              Berendsen τ = {fmt(preset.tau, 2)}. LJ Tc ≈ 1.31 (Hansen & McDonald 4ª ed.).
              Baja T_target gradualmente (0.05 por vez) para ver cristalización limpia.
            </div>
          </Section>
        )}

        <Section title="Ecuación">
          <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
            <div className="text-white">V(r) = 4ε[(σ/r)¹² − (σ/r)⁶]</div>
            <div className="text-[#94A3B8]">F_ij = −∇V, Verlet explícito, PBC.</div>
            <div className="mt-1">Coste O(N²)·dt: 4K átomos, ~3 ms/step. GPU.</div>
          </div>
        </Section>

        <Section title="Arquitectura">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p>El motor es el <span className="text-white">mismo</span> para LJ, Coulomb, gravedad, Morse — cambia solo el snippet GLSL de la ley de fuerza.</p>
            <p className="font-mono text-[10px] text-[#64748B]">src/lib/gpu/pairwise-engine.ts</p>
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
          ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>{children}</button>
  );
}
