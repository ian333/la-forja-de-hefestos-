/**
 * Moléculas diatómicas en GPU — nivel 1 de la escalera.
 *
 * N/2 dímeros H₂ (átomo 2k enlazado al 2k+1 vía Morse) en baño LJ cúbico
 * con PBC. Cada enlace oscila a su frecuencia natural ω = √(k/μ) con
 * k = 2Dα². Entre distintas moléculas, LJ con skip-bonded (los partners
 * del mismo dímero NO interactúan vía LJ: la Morse ya cubre esa escala).
 *
 * Lo que emerge:
 *   · Dímeros cuya longitud oscila visible cerca de r_eq = 1.
 *   · Fase gas (T = 1.5) — moléculas bailan libres.
 *   · Fase líquida (T = 0.6) — moléculas empacadas, rotan.
 *   · Fase sólida (T = 0.2) — red molecular rígida.
 *   · Al subir T por encima de D, los enlaces se estiran hasta romperse
 *     (disociación térmica observable a simple vista).
 *
 * Motor: `PairwiseEngine` con `LJ_FORCE` + `bonds: { D, alpha, rEq }`.
 * Mismo código que IdealGasGPU con un parámetro más — esa es la magia
 * de la arquitectura `gpu/pairwise`.
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
// Shaders de render — reusa el mismo patrón que IdealGasGPU pero con
// color teñido por "molécula" (átomos pares vs impares) para que los
// dímeros se vean como entidades.
// ═══════════════════════════════════════════════════════════════

const RENDER_VS = /* glsl */ `
  attribute vec2 refUV;
  attribute float atomIdx;   // 0..N-1 flat
  uniform sampler2D texturePosition;
  uniform sampler2D textureVelocity;
  uniform float cameraScale;
  uniform float sigma;
  varying vec3 vColor;
  varying float vSpeed;

  void main() {
    vec4 p = texture2D(texturePosition, refUV);
    vec4 v = texture2D(textureVelocity, refUV);
    float speed = length(v.xyz);
    vSpeed = speed;
    // Par/impar colorea distinto (los dos átomos de un H₂ salen con colores
    // parecidos pero ligeramente desplazados, para reforzar "son un dímero").
    bool isEven = mod(atomIdx, 2.0) < 0.5;
    vec3 colA = vec3(0.31, 0.76, 0.97);  // cyan
    vec3 colB = vec3(0.98, 0.50, 0.72);  // pink
    vec3 col = isEven ? colA : colB;
    // Tinte caliente por velocidad
    vec3 hot = vec3(1.0, 0.55, 0.20);
    vColor = mix(col, hot, clamp(speed * 0.25, 0.0, 0.55));
    vec4 mv = modelViewMatrix * vec4(p.xyz, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = sigma * cameraScale * (100.0 / -mv.z);
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
    vec3 color = vColor * (0.40 + 0.60 * fall);
    float glow = clamp(vSpeed * 0.05, 0.0, 0.6);
    color += vec3(1.0, 0.55, 0.20) * glow * 0.15;
    gl_FragColor = vec4(color, fall);
  }
`;

// ═══════════════════════════════════════════════════════════════
// Shader para líneas de enlace (opcional, ligero)
// ═══════════════════════════════════════════════════════════════

const BOND_VS = /* glsl */ `
  attribute vec2 refUV;
  uniform sampler2D texturePosition;
  void main() {
    vec4 p = texture2D(texturePosition, refUV);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p.xyz, 1.0);
  }
`;

const BOND_FS = /* glsl */ `
  precision highp float;
  void main() {
    gl_FragColor = vec4(0.85, 0.85, 0.92, 0.35);
  }
`;

// ═══════════════════════════════════════════════════════════════
// Presets
// ═══════════════════════════════════════════════════════════════

type Preset = {
  id: string;
  name: string;
  note: string;
  resolution: 32 | 48;
  targetTemp: number;
  initialTemp: number;
  boxScale: number;   // × cbrt(N) · σ
  bondD: number;
  bondAlpha: number;
};

const PRESETS: Preset[] = [
  {
    id: 'gas',
    name: 'Gas molecular (T = 1.5)',
    note: 'Los dímeros flotan separados. Ocasionalmente colisionan y rebotan.',
    resolution: 32, targetTemp: 1.5, initialTemp: 1.5, boxScale: 2.0,
    bondD: 6, bondAlpha: 2,
  },
  {
    id: 'liquid',
    name: 'Líquido molecular (T = 0.6)',
    note: 'Moléculas empacadas, fluyen. Enlaces estables, rotan libremente.',
    resolution: 32, targetTemp: 0.6, initialTemp: 1.0, boxScale: 1.3,
    bondD: 6, bondAlpha: 2,
  },
  {
    id: 'solid',
    name: 'Sólido molecular (T = 0.15)',
    note: 'Red de dímeros. Cada molécula oscila alrededor de su sitio cristalino.',
    resolution: 32, targetTemp: 0.15, initialTemp: 0.4, boxScale: 1.15,
    bondD: 6, bondAlpha: 2,
  },
  {
    id: 'dissoc',
    name: 'Disociación térmica (T = 8)',
    note: 'T ≫ D: los enlaces se rompen. ¿Cuánto dura cada enlace?',
    resolution: 32, targetTemp: 8, initialTemp: 8, boxScale: 2.2,
    bondD: 3, bondAlpha: 1.5,
  },
];

// ═══════════════════════════════════════════════════════════════
// Inicialización — coloca dímeros pares pegados en r_eq
// ═══════════════════════════════════════════════════════════════

function seedDimers(rEq: number) {
  return (posData: Float32Array, N: number, L: number) => {
    // Queremos N/2 moléculas: los pares (2k, 2k+1) son un dímero.
    // Colocamos el centro del dímero en un grid 3D con jitter, y orientamos
    // el eje del enlace de forma aleatoria isotrópica.
    const M = N / 2 | 0;
    const side = Math.max(1, Math.ceil(Math.cbrt(M)));
    const spacing = L / side;
    const halfL = L / 2;
    for (let m = 0; m < M; m++) {
      const a = Math.floor(m / (side * side));
      const b = Math.floor((m / side) % side);
      const c = m % side;
      const cx = -halfL + (c + 0.5) * spacing + (Math.random() - 0.5) * spacing * 0.2;
      const cy = -halfL + (b + 0.5) * spacing + (Math.random() - 0.5) * spacing * 0.2;
      const cz = -halfL + (a + 0.5) * spacing + (Math.random() - 0.5) * spacing * 0.2;
      // Orientación isotrópica por muestreo esférico
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * 2 * Math.PI;
      const s = Math.sqrt(1 - u*u);
      const dx = s * Math.cos(phi) * rEq / 2;
      const dy = s * Math.sin(phi) * rEq / 2;
      const dz = u * rEq / 2;
      // átomo par (2m)
      posData[(2*m    )*4  ] = cx + dx;
      posData[(2*m    )*4+1] = cy + dy;
      posData[(2*m    )*4+2] = cz + dz;
      posData[(2*m    )*4+3] = 0;
      // átomo impar (2m+1)
      posData[(2*m + 1)*4  ] = cx - dx;
      posData[(2*m + 1)*4+1] = cy - dy;
      posData[(2*m + 1)*4+2] = cz - dz;
      posData[(2*m + 1)*4+3] = 1;
    }
    // Si N es impar (no debería con res par), átomos extra sin enlazar al final
    for (let i = 2*M; i < N; i++) {
      posData[i*4  ] = 0; posData[i*4+1] = 0; posData[i*4+2] = 0; posData[i*4+3] = 0;
    }
  };
}

/** Construye la Int32Array de 2N partners para dímeros (2k ↔ 2k+1). */
function buildDimerBonds(N: number): Int32Array {
  const arr = new Int32Array(N * 2);
  arr.fill(-1);
  const M = N / 2 | 0;
  for (let m = 0; m < M; m++) {
    arr[(2*m    )*2] = 2*m + 1;   // partner único
    arr[(2*m + 1)*2] = 2*m;
  }
  return arr;
}

// ═══════════════════════════════════════════════════════════════
// EngineController + Renderer
// ═══════════════════════════════════════════════════════════════

interface EngineHandle { engine: PairwiseEngine | null; latestStats: PairwiseStats | null; }

function EngineController({
  config, playing, handleRef,
}: {
  config: PairwiseEngineConfig;
  playing: boolean;
  handleRef: React.MutableRefObject<EngineHandle>;
}) {
  const { gl } = useThree();
  const engineRef = useRef<PairwiseEngine | null>(null);
  const lastStats = useRef(0);
  useEffect(() => {
    try {
      engineRef.current = new PairwiseEngine(gl, config);
      handleRef.current.engine = engineRef.current;
    } catch (err) {
      console.error('[MoleculeGPU] engine init failed:', err);
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
      handleRef.current.engine = null;
      handleRef.current.latestStats = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.resolution, config.boxSize, config.bonds?.D, config.bonds?.alpha, gl]);

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
    if (eng.steps - lastStats.current > 15) {
      handleRef.current.latestStats = eng.stats();
      lastStats.current = eng.steps;
    }
  });
  return null;
}

function ParticleCloud({
  handleRef, resolution, sigma,
}: { handleRef: React.MutableRefObject<EngineHandle>; resolution: number; sigma: number; }) {
  const { geometry, uniforms } = useMemo(() => {
    const N = resolution * resolution;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const refUV = new Float32Array(N * 2);
    const atomIdx = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % resolution;
      const y = Math.floor(i / resolution);
      refUV[i * 2]     = (x + 0.5) / resolution;
      refUV[i * 2 + 1] = (y + 0.5) / resolution;
      atomIdx[i] = i;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('refUV', new THREE.BufferAttribute(refUV, 2));
    geom.setAttribute('atomIdx', new THREE.BufferAttribute(atomIdx, 1));
    geom.setDrawRange(0, N);
    const u = {
      texturePosition: { value: null as THREE.Texture | null },
      textureVelocity: { value: null as THREE.Texture | null },
      cameraScale:     { value: 7.0 },
      sigma:           { value: sigma },
    };
    return { geometry: geom, uniforms: u };
  }, [resolution, sigma]);

  useFrame(() => {
    const eng = handleRef.current.engine;
    if (!eng) return;
    uniforms.texturePosition.value = eng.positionTexture;
    uniforms.textureVelocity.value = eng.velocityTexture;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
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

function BondLines({
  handleRef, resolution,
}: { handleRef: React.MutableRefObject<EngineHandle>; resolution: number; }) {
  const { geometry, uniforms } = useMemo(() => {
    const N = resolution * resolution;
    const M = N / 2 | 0;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(M * 2 * 3);
    const refUV = new Float32Array(M * 2 * 2);
    for (let m = 0; m < M; m++) {
      for (let k = 0; k < 2; k++) {
        const atom = 2*m + k;
        const x = atom % resolution;
        const y = Math.floor(atom / resolution);
        refUV[(m*2 + k)*2    ] = (x + 0.5) / resolution;
        refUV[(m*2 + k)*2 + 1] = (y + 0.5) / resolution;
      }
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('refUV', new THREE.BufferAttribute(refUV, 2));
    geom.setDrawRange(0, M * 2);
    return {
      geometry: geom,
      uniforms: { texturePosition: { value: null as THREE.Texture | null } },
    };
  }, [resolution]);

  useFrame(() => {
    const eng = handleRef.current.engine;
    if (!eng) return;
    uniforms.texturePosition.value = eng.positionTexture;
  });

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={BOND_VS}
        fragmentShader={BOND_FS}
        transparent
        depthWrite={false}
      />
    </lineSegments>
  );
}

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

const R_EQ = 1.0;
const SIGMA_LJ = 1.0;

export default function MoleculeGPU() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('liquid');
  const preset = PRESETS.find(p => p.id === presetId)!;
  const [playing, setPlaying] = useState(true);
  const [targetTemp, setTargetTemp] = useState(preset.targetTemp);
  const [dt, setDt] = useState(0.003);
  const [showBonds, setShowBonds] = useState(true);

  useEffect(() => setTargetTemp(preset.targetTemp), [preset.id, preset.targetTemp]);

  const config: PairwiseEngineConfig = useMemo(() => {
    const N = preset.resolution * preset.resolution;
    const boxSize = Math.cbrt(N) * preset.boxScale;
    const bonds = {
      partners: buildDimerBonds(N),
      D: preset.bondD,
      alpha: preset.bondAlpha,
      rEq: R_EQ,
    };
    const lj = {
      ...LJ_FORCE,
      uniforms: {
        ljSigma:      { value: [SIGMA_LJ, SIGMA_LJ, SIGMA_LJ, SIGMA_LJ] },
        ljEpsilon:    { value: [1, 1, 1, 1] },
        epsilonScale: { value: 1 },
        cutoffFactor: { value: 2.5 },
      },
    };
    return {
      resolution: preset.resolution,
      boxSize,
      dt,
      initialTemperature: preset.initialTemp,
      species: [
        { mass: 1, fraction: 0.5 },
        { mass: 1, fraction: 0.5 },
      ],
      forces: [lj],
      thermostat: { targetTemp, tau: 0.8 },
      speedCap: 60,
      bonds,
      positionSeed: seedDimers(R_EQ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id, targetTemp, dt]);

  const handleRef = useRef<EngineHandle>({ engine: null, latestStats: null });

  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 150);
    return () => clearInterval(t);
  }, []);

  const N = preset.resolution * preset.resolution;
  const M = N / 2 | 0;
  const stats = handleRef.current.latestStats;
  const boxSize = config.boxSize;

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
          <directionalLight position={[-6, -3, -4]} intensity={0.25} color="#F472B6" />
          <OrbitControls enableDamping dampingFactor={0.08}
            minDistance={boxSize * 0.2} maxDistance={boxSize * 8} />
          <Box size={boxSize} />
          <EngineController config={config} playing={playing} handleRef={handleRef} />
          {showBonds && <BondLines handleRef={handleRef} resolution={preset.resolution} />}
          <ParticleCloud handleRef={handleRef} resolution={preset.resolution} sigma={SIGMA_LJ} />
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.75} luminanceThreshold={0.15} luminanceSmoothing={0.4}
              mipmapBlur kernelSize={KernelSize.LARGE} />
            <Vignette offset={0.25} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
          </EffectComposer>
        </Canvas>

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/85 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">M&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {M.toLocaleString('en-US')} dímeros</div>
          <div><span className="text-[#64748B]">N&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {N.toLocaleString('en-US')} átomos</div>
          <div><span className="text-[#64748B]">T_set&nbsp;</span>= {fmt(targetTemp, 2)}</div>
          <div><span className="text-[#64748B]">T_act&nbsp;</span>= <span className="text-white">{stats ? fmt(stats.temperature, 3) : '—'}</span></div>
          <div><span className="text-[#64748B]">D&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {fmt(preset.bondD, 1)} ε</div>
          <div><span className="text-[#64748B]">k&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {fmt(2 * preset.bondD * preset.bondAlpha * preset.bondAlpha, 1)}</div>
        </div>

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setPlaying(p => !p)} active={playing}>{playing ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => { handleRef.current.engine?.reset(); }} title="Reiniciar">↺</IconBtn>
          <IconBtn onClick={() => setShowBonds(b => !b)} active={showBonds} title="Líneas de enlace">─</IconBtn>
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
                    ? 'bg-gradient-to-br from-[#7E22CE]/30 to-[#EC4899]/30 border-[#F472B6]/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}>{p.name}</button>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
        </Section>

        {audience === 'child' ? (
          <Section title="Lo que ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Cada par de puntos (<span className="text-[#4FC3F7]">cyan</span> + <span className="text-[#F472B6]">rosa</span>) unidos por una línea es una <em>molécula</em>.</p>
              <p>El enlace los mantiene cerca, como un resorte. Sube la temperatura y los enlaces se estiran. A T muy alta, se rompen (prueba el preset de disociación).</p>
              <p>Nivel 1 de la escalera: átomos (nivel 0) se pegan y forman moléculas.</p>
            </div>
          </Section>
        ) : (
          <Section title="Estado">
            <Row label="moléculas"   value={M.toLocaleString('en-US')} />
            <Row label="átomos"      value={N.toLocaleString('en-US')} />
            <Row label="T*set"       value={fmt(targetTemp, 3)} />
            <Row label="T*meas"      value={stats ? fmt(stats.temperature, 3) : '—'} />
            <Row label="D"           value={`${fmt(preset.bondD, 2)} ε`} />
            <Row label="α"           value={fmt(preset.bondAlpha, 2)} />
            <Row label="k = 2Dα²"    value={fmt(2 * preset.bondD * preset.bondAlpha * preset.bondAlpha, 2)} />
            <Row label="ω₀ = √(k/μ)" value={fmt(Math.sqrt(2 * preset.bondD * preset.bondAlpha * preset.bondAlpha / 0.5), 2)} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              Frecuencia del enlace en régimen armónico, μ = m/2.
              Disociación térmica esperable cuando k_BT ≳ D.
            </div>
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Termostato">
            <Slider label="T_target" v={targetTemp} min={0.05} max={12} step={0.05} on={setTargetTemp} />
            <Slider label="dt"       v={dt} min={0.001} max={0.008} step={0.0005} on={setDt} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              Con ω₀ alta baja dt a 0.002 para capturar la oscilación (≥ 20 pasos/periodo).
            </div>
          </Section>
        )}

        <Section title="Ecuación">
          <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
            <div className="text-white">V_bond(r) = D·(1 − e^(−α(r−r_eq)))²</div>
            <div className="text-[#94A3B8]">V_nonbond(r) = 4ε[(σ/r)¹² − (σ/r)⁶]</div>
            <div className="mt-1">skip-bonded: LJ no se aplica entre partners.</div>
          </div>
        </Section>

        <Section title="Arquitectura">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p>Mismo motor que <span className="text-white">IdealGasGPU</span>. Un parámetro más:</p>
            <p className="font-mono text-[10px] text-[#64748B]">bonds: {'{'} partners, D, α, r_eq {'}'}</p>
            <p>Nivel 1 construido sobre la infraestructura del nivel 0. El siguiente escalón (proteínas) añade bond-list con más partners y ángulos.</p>
          </div>
        </Section>
      </aside>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UI helpers (idénticos al patrón de la forja)
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
          ? 'border-[#F472B6]/60 text-[#F472B6] bg-[#F472B6]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>{children}</button>
  );
}
