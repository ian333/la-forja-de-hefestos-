/**
 * GPUParticleSandbox — sandbox de partículas a gran escala corriendo
 * en GPU. Reemplaza al viejo CPU sandbox (limitado a ~200 partículas)
 * por uno de 4K-16K partículas con Lennard-Jones pair-wise en paralelo.
 *
 * Arquitectura:
 *   · GPUMDEngine mantiene posiciones/velocidades en texturas Float RGBA.
 *   · Cada frame llama engine.step() (fragment shader = compute kernel).
 *   · El renderizado usa `<points>` con N vértices, cada uno con un
 *     `refUV` fijo. El vertex shader lee su posición de la textura y
 *     la pone en pantalla.
 *   · Stats (T, KE) se leen de vuelta a CPU cada ~15 frames (readback
 *     sync es caro, pero a esa frecuencia es OK).
 *
 * Controles expuestos:
 *   · N (resolución): 1024, 4096, 9216, 16384
 *   · Temperatura objetivo + tau Berendsen
 *   · dt
 *   · Fracciones de especies A/B/C/D
 *   · Reset, play/pause
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GPUMDEngine, type GPUMDConfig, type GPUMDStats } from '@/lib/chem/quantum/gpu-md';
import {
  RENDER_VERTEX_SHADER, RENDER_FRAGMENT_SHADER, SPECIES_PALETTE,
} from './gpu-md-shaders';
import StatisticsPanel from './StatisticsPanel';

// ═══════════════════════════════════════════════════════════════
// Engine owner — crea el engine con acceso al renderer y hace step
// ═══════════════════════════════════════════════════════════════

interface GPUSimControllerHandle {
  engine: GPUMDEngine | null;
  getStats: () => GPUMDStats | null;
}

function GPUSimController({
  config, playing, controllerRef,
}: {
  config: GPUMDConfig;
  playing: boolean;
  controllerRef: React.MutableRefObject<GPUSimControllerHandle | null>;
}) {
  const { gl } = useThree();
  const engineRef = useRef<GPUMDEngine | null>(null);
  const lastStatsFrame = useRef(0);
  const latestStatsRef = useRef<GPUMDStats | null>(null);

  // Inicializar el engine UNA vez por config (cambio de res → reset)
  useEffect(() => {
    try {
      engineRef.current = new GPUMDEngine(gl, config);
      controllerRef.current = {
        engine: engineRef.current,
        getStats: () => latestStatsRef.current,
      };
    } catch (err) {
      console.error('GPU MD init failed:', err);
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.resolution, gl]);

  // Uniforms "en vivo" que cambian sin re-instanciar el engine
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setTargetTemperature(config.targetTemperature);
    engineRef.current.setThermostatTau(config.thermostatTau);
    engineRef.current.setDt(config.dt);
    engineRef.current.setEpsilonScale(config.epsilonScale);
  }, [
    config.targetTemperature, config.thermostatTau,
    config.dt, config.epsilonScale,
  ]);

  useFrame(() => {
    const eng = engineRef.current;
    if (!eng || !playing) return;
    eng.step();
    // Stats cada ~15 frames (readback GPU→CPU es sync, caro)
    if (eng.steps - lastStatsFrame.current > 15) {
      latestStatsRef.current = eng.stats();
      lastStatsFrame.current = eng.steps;
    }
  });

  return null;
}

// ═══════════════════════════════════════════════════════════════
// Render — points que leen posición de la textura del engine
// ═══════════════════════════════════════════════════════════════

function ParticleRenderer({
  controllerRef, config,
}: {
  controllerRef: React.MutableRefObject<GPUSimControllerHandle | null>;
  config: GPUMDConfig;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const N = config.resolution * config.resolution;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3); // dummy
    const refUV = new Float32Array(N * 2);
    const res = config.resolution;
    for (let i = 0; i < N; i++) {
      const x = i % res;
      const y = Math.floor(i / res);
      refUV[i * 2 + 0] = (x + 0.5) / res;
      refUV[i * 2 + 1] = (y + 0.5) / res;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('refUV', new THREE.BufferAttribute(refUV, 2));
    geom.setDrawRange(0, N);

    const u = {
      texturePosition:  { value: null as THREE.Texture | null },
      textureVelocity:  { value: null as THREE.Texture | null },
      speciesSigma:     { value: new THREE.Vector4(
        config.species[0]?.sigma ?? 1,
        config.species[1]?.sigma ?? 1,
        config.species[2]?.sigma ?? 1,
        config.species[3]?.sigma ?? 1,
      )},
      cameraScale:      { value: 6.0 },
      speedColorScale:  { value: 1.0 },
    };
    return { geometry: geom, uniforms: u };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.resolution, config.species.map(s => s.sigma).join(',')]);

  useFrame(() => {
    const ctrl = controllerRef.current;
    if (!ctrl?.engine) return;
    uniforms.texturePosition.value = ctrl.engine.positionTexture;
    uniforms.textureVelocity.value = ctrl.engine.velocityTexture;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={RENDER_VERTEX_SHADER}
        fragmentShader={RENDER_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

// ═══════════════════════════════════════════════════════════════
// Caja wire-frame para ver los límites de la simulación
// ═══════════════════════════════════════════════════════════════

function Box({ size }: { size: number }) {
  const half = size / 2;
  return (
    <lineSegments>
      <edgesGeometry args={[new THREE.BoxGeometry(size, size, size)]} />
      <lineBasicMaterial color="#334155" transparent opacity={0.7} />
    </lineSegments>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — el sandbox GPU completo
// ═══════════════════════════════════════════════════════════════

interface GPUParticleSandboxProps {
  height?: number | string;
}

type ResPreset = 32 | 48 | 64 | 96 | 128;
const RES_LABELS: Record<ResPreset, string> = {
  32: '1 024',
  48: '2 304',
  64: '4 096',
  96: '9 216',
  128: '16 384',
};

export default function GPUParticleSandbox({ height = 620 }: GPUParticleSandboxProps) {
  const [resolution, setResolution] = useState<ResPreset>(64);
  const [targetTemp, setTargetTemp] = useState(1.2);
  const [thermoTau, setThermoTau] = useState(0.5);
  const [dt, setDt] = useState(0.005);
  const [epsilonScale, setEpsilonScale] = useState(1.0);
  const [fracA, setFracA] = useState(0.6);
  const [fracB, setFracB] = useState(0.4);
  const [playing, setPlaying] = useState(true);
  const [displayStats, setDisplayStats] = useState<GPUMDStats | null>(null);

  const controllerRef = useRef<GPUSimControllerHandle | null>(null);
  const engineRef = useRef<GPUMDEngine | null>(null);
  const [showStats, setShowStats] = useState(true);

  // Sync engineRef from controllerRef for StatisticsPanel
  useEffect(() => {
    const id = setInterval(() => {
      engineRef.current = controllerRef.current?.engine ?? null;
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Config del engine — cambio de resolution triggereará re-init
  const config: GPUMDConfig = useMemo(() => {
    const boxSize = resolution <= 48 ? 10 : resolution <= 64 ? 14 : resolution <= 96 ? 18 : 22;
    return {
      resolution,
      boxSize,
      dt,
      initialTemperature: targetTemp,
      targetTemperature: targetTemp,
      thermostatTau: thermoTau,
      epsilonScale,
      species: [
        { sigma: 1.0, epsilon: 1.0, mass: 1.0 },
        { sigma: 1.1, epsilon: 1.0, mass: 1.5 },
        { sigma: 0.9, epsilon: 1.2, mass: 0.8 },
        { sigma: 1.0, epsilon: 0.8, mass: 1.0 },
      ],
      speciesFractions: [fracA, fracB, 0, 0],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution, fracA, fracB]);

  // Poll stats para UI cada 300ms
  useEffect(() => {
    const id = setInterval(() => {
      const s = controllerRef.current?.getStats();
      if (s) setDisplayStats(s);
    }, 300);
    return () => clearInterval(id);
  }, []);

  const handleReset = () => {
    controllerRef.current?.engine?.reset(targetTemp);
  };

  const cameraDistance = config.boxSize * 1.8;
  const styleHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className="relative w-full" style={{ height: styleHeight }}>
      <div
        className="absolute inset-0 rounded-xl overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at center, #0f1117 0%, #05060a 100%)' }}
      >
        <Canvas
          camera={{ position: [cameraDistance, cameraDistance * 0.6, cameraDistance], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false }}
        >
          <ambientLight intensity={0.3} />
          <GPUSimController config={config} playing={playing} controllerRef={controllerRef} />
          <Box size={config.boxSize} />
          <ParticleRenderer controllerRef={controllerRef} config={config} />
          <OrbitControls
            enablePan={false}
            minDistance={config.boxSize * 0.5}
            maxDistance={config.boxSize * 4}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>
      </div>

      {/* HUD superior izquierdo — badge de escala */}
      <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-md rounded-lg px-3 py-2 text-white border border-white/10">
        <div className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider">
          GPU Molecular Dynamics
        </div>
        <div className="text-[22px] leading-none font-bold tracking-tight mt-1">
          {RES_LABELS[resolution]} partículas
        </div>
        <div className="text-[11px] text-[#CBD5E1] mt-0.5 font-mono">
          {resolution}² · box {config.boxSize} σ · dt={config.dt}
        </div>
      </div>

      {/* HUD superior derecho — stats en vivo */}
      <div className="absolute top-3 right-3 bg-black/65 backdrop-blur-md rounded-lg px-3 py-2 text-[11px] text-[#CBD5E1] border border-white/10 font-mono space-y-0.5 min-w-[180px]">
        <Stat label="T instantánea" value={displayStats ? `${displayStats.temperature.toFixed(3)}` : '—'} accent="#F87171" />
        <Stat label="T objetivo"    value={`${targetTemp.toFixed(2)}`} />
        <Stat label="KE total"      value={displayStats ? displayStats.kineticEnergy.toFixed(0) : '—'} />
        <Stat label="⟨speed⟩"       value={displayStats ? displayStats.meanSpeed.toFixed(2) : '—'} />
        <Stat label="max speed"     value={displayStats ? displayStats.maxSpeed.toFixed(2) : '—'} />
        <Stat label="steps"         value={controllerRef.current?.engine?.steps.toString() ?? '0'} />
      </div>

      {/* Panel de control inferior central */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md rounded-xl px-4 py-3 border border-white/10 shadow-2xl flex items-center gap-4 flex-wrap max-w-[90%]">
        <div className="flex items-center gap-2">
          {playing ? (
            <button onClick={() => setPlaying(false)} className="px-3 py-1.5 rounded bg-[#7E57C2] text-white text-[12px] font-semibold">
              ⏸ Pausa
            </button>
          ) : (
            <button onClick={() => setPlaying(true)} className="px-3 py-1.5 rounded bg-[#4FC3F7] text-[#0B0F17] text-[12px] font-semibold">
              ▶ Correr
            </button>
          )}
          <button onClick={handleReset} className="px-3 py-1.5 rounded bg-[#1E293B] text-[#CBD5E1] text-[12px]">
            ↻ Reset
          </button>
        </div>

        <div className="h-5 w-px bg-white/10" />

        <label className="text-[11px] text-[#CBD5E1] flex items-center gap-2">
          <span className="font-mono text-[#64748B]">N</span>
          <select
            value={resolution}
            onChange={(e) => setResolution(Number(e.target.value) as ResPreset)}
            className="bg-[#0B0F17] border border-white/10 rounded px-2 py-1 text-[11px] font-mono"
          >
            <option value={32}>1 024  (rápido)</option>
            <option value={48}>2 304</option>
            <option value={64}>4 096  (recomendado)</option>
            <option value={96}>9 216</option>
            <option value={128}>16 384 (exige GPU)</option>
          </select>
        </label>

        <div className="h-5 w-px bg-white/10" />

        <label className="text-[11px] text-[#CBD5E1] flex items-center gap-2 min-w-[140px]">
          <span className="font-mono text-[#64748B] w-4">T</span>
          <input
            type="range" min={0.1} max={5} step={0.05}
            value={targetTemp}
            onChange={(e) => setTargetTemp(Number(e.target.value))}
            className="flex-1 accent-[#F87171]"
          />
          <span className="font-mono text-[11px] text-white w-10 text-right">{targetTemp.toFixed(2)}</span>
        </label>

        <label className="text-[11px] text-[#CBD5E1] flex items-center gap-2 min-w-[140px]">
          <span className="font-mono text-[#64748B] w-5">dt</span>
          <input
            type="range" min={0.001} max={0.01} step={0.0005}
            value={dt}
            onChange={(e) => setDt(Number(e.target.value))}
            className="flex-1 accent-[#4FC3F7]"
          />
          <span className="font-mono text-[11px] text-white w-14 text-right">{dt.toFixed(4)}</span>
        </label>

        <div className="h-5 w-px bg-white/10" />

        <label className="text-[11px] text-[#CBD5E1] flex items-center gap-2">
          <span className="font-mono text-[#64748B]">frac A</span>
          <input
            type="range" min={0} max={1} step={0.05}
            value={fracA}
            onChange={(e) => {
              const a = Number(e.target.value);
              setFracA(a);
              setFracB(1 - a);
            }}
            className="w-24 accent-[#4FC3F7]"
          />
          <span className="font-mono text-[11px] text-white">{(fracA * 100).toFixed(0)}%</span>
        </label>
      </div>

      {/* Leyenda de especies */}
      <div className="absolute bottom-24 right-3 bg-black/65 backdrop-blur-md rounded-lg px-2.5 py-1.5 border border-white/10 flex flex-col gap-1">
        {SPECIES_PALETTE.slice(0, 2).map((sp, i) => {
          const count = displayStats?.speciesCounts[i] ?? 0;
          return (
            <div key={sp.label} className="flex items-center gap-2 text-[10px] font-mono">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: sp.color }} />
              <span className="text-white">{sp.label}</span>
              <span className="text-[#94A3B8]">{count}</span>
            </div>
          );
        })}
        <button
          onClick={() => setShowStats((v) => !v)}
          className="mt-1 text-[9px] text-[#64748B] hover:text-[#4FC3F7] transition font-mono"
        >
          {showStats ? 'Ocultar stats' : 'Mostrar stats'}
        </button>
      </div>

      {/* Panel de estadística física (izquierda, sobre la caja) */}
      {showStats && (
        <div className="absolute top-28 left-3 z-10">
          <StatisticsPanel engineRef={engineRef} />
        </div>
      )}

      {/* Indicador de fase (gas/líquido/sólido) */}
      <div className="absolute bottom-24 left-3 bg-black/65 backdrop-blur-md rounded-lg px-2.5 py-1.5 border border-white/10">
        <div className="text-[9px] font-mono text-[#64748B] uppercase tracking-wider">Fase</div>
        <div className="text-[12px] font-semibold text-white">{phaseLabel(targetTemp)}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: {
  label: string; value: string; accent?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[#64748B]">{label}</span>
      <span style={{ color: accent ?? '#FFFFFF' }}>{value}</span>
    </div>
  );
}

function phaseLabel(T: number): string {
  if (T < 0.5) return '🧊 Sólido (cristalizando)';
  if (T < 1.2) return '💧 Líquido';
  if (T < 2.5) return '🌫  Gas denso';
  return '🔥 Gas caliente';
}
