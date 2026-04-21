/**
 * Regeneración salamandra vs humano — mismo reactor, distintas constantes.
 *
 * A nivel atómico y molecular, un axolote y un humano comparten casi toda
 * la maquinaria (mismos aminoácidos, mismos nucleótidos, mismos genes
 * ortólogos). Lo que difiere es la dinámica de expresión de los
 * morfógenos que gobiernan el plan corporal cuando hay una herida:
 *
 *   Salamandra: BMP + Wnt7a + Msx1 se reactivan → blastema → rebrota el
 *               patrón tisular.
 *   Humano:     la cascada queda bloqueada → miofibroblastos forman
 *               cicatriz uniforme.
 *
 * Un modelo RD de dos morfógenos (Gray-Scott) captura la esencia:
 *
 *   ∂u/∂t = D_u ∇²u − uv² + F(1 − u)
 *   ∂v/∂t = D_v ∇²v + uv² − (F + k)v
 *
 * Cambiando (F, k) — que aquí representan *parámetros de regulación
 * genética* — cruzamos el espacio de fases entre:
 *   · "α" (F = 0.037, k = 0.060): spots estables, auto-replicación.
 *     → salamandra: el patrón regresa tras quitar una región.
 *   · "ρ" (F = 0.090, k = 0.057): estado uniforme estable.
 *     → humano: spots mueren, todo converge a cicatriz homogénea.
 *
 * Ref:
 *   · Pearson, Science 261:189 (1993) — espacio de fases Gray-Scott.
 *   · Brockes & Kumar 2008 — regeneración de extremidades en anfibios.
 *   · Galliot 2015 — reactivación del plan corporal.
 *   · Tanaka 2016, "The molecular and cellular choreography of
 *     appendage regeneration" Cell 165:1598.
 *
 * Motor: `stencilStepCpu` de `src/lib/gpu/stencil.ts` — el mismo que
 * usa TissueField al nivel 2.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { stencilStepCpu, type StencilCpuOptions } from '@/lib/gpu/stencil';
import { useAudience } from '@/physics/context';

// ═══════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════

const RES = 96;        // 9 216 celdas por lado
const L = 1;           // tamaño del dominio (adimensional)
const D_U = 2e-5;
const D_V = 1e-5;

interface Organism {
  id: string;
  name: string;
  accent: string;
  /** F, k de Gray-Scott. */
  F: number;
  k: number;
  blurb: string;
}

const ORGANISMS: Organism[] = [
  {
    id: 'salamander',
    name: 'Salamandra',
    accent: '#4FC3F7',
    F: 0.037, k: 0.060,
    blurb:
      'Régimen α del diagrama de Pearson. Los "spots" se replican y ' +
      'mantienen el patrón. Al quitar tejido, la frontera libera nuevos ' +
      'spots que rellenan la herida.',
  },
  {
    id: 'human',
    name: 'Humano',
    accent: '#EF4444',
    F: 0.090, k: 0.057,
    blurb:
      'Régimen uniforme estable (u ≈ 1, v ≈ 0). Los spots mueren. Sin ' +
      'auto-replicación, la herida se llena con el estado de fondo — ' +
      'análogo a cicatriz fibrótica.',
  },
];

// ═══════════════════════════════════════════════════════════════
// Gestión del estado RD
// ═══════════════════════════════════════════════════════════════

function makeState() {
  return {
    field: new Float32Array(RES * RES * 4),
    next:  new Float32Array(RES * RES * 4),
  };
}

/** Seed: "tejido sano" con spots dispersos simétricamente. */
function seedHealthy(state: Float32Array): void {
  // Background u=1, v=0
  for (let i = 0; i < RES * RES; i++) {
    state[i * 4 + 0] = 1;
    state[i * 4 + 1] = 0;
  }
  // Spots iniciales: rejilla perturbada
  const spots = 7;
  const r = 3;
  for (let sx = 0; sx < spots; sx++) {
    for (let sy = 0; sy < spots; sy++) {
      const cx = ((sx + 0.5 + (sy % 2) * 0.3) / spots) * RES;
      const cy = ((sy + 0.5) / spots) * RES;
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          if (i * i + j * j > r * r) continue;
          const ii = Math.floor(cx + i);
          const jj = Math.floor(cy + j);
          if (ii < 0 || ii >= RES || jj < 0 || jj >= RES) continue;
          const idx = (jj * RES + ii) * 4;
          state[idx + 0] = 0.5;
          state[idx + 1] = 0.25;
        }
      }
    }
  }
}

/** Wound: borra una región circular (u vuelve a fondo, v a 0 → herida limpia). */
function applyWound(state: Float32Array, cx: number, cy: number, radius: number): void {
  const r2 = radius * radius;
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const dx = i - cx, dy = j - cy;
      if (dx * dx + dy * dy <= r2) {
        state[(j * RES + i) * 4 + 0] = 1;
        state[(j * RES + i) * 4 + 1] = 0;
      }
    }
  }
}

function stepGrayScott(
  field: Float32Array, next: Float32Array,
  org: Organism, dt = 1.0,
): void {
  const opts: StencilCpuOptions = {
    RES, L,
    boundary: 'periodic',
    diffusivity: [D_U, D_V, 0, 0],
    dt,
    reaction: (out, u) => {
      const uvv = u[0] * u[1] * u[1];
      out[0] = -uvv + org.F * (1 - u[0]);
      out[1] =  uvv - (org.F + org.k) * u[1];
    },
  };
  stencilStepCpu(field, next, opts);
}

// ═══════════════════════════════════════════════════════════════
// Shader del plano (igual patrón que TissueField)
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
  uniform vec3 accent;

  void main() {
    vec4 s = texture2D(stencilTex, vUv);
    float u = s.x;
    float v = s.y;
    // Tejido vivo = v alto. Fondo "cicatriz" = v bajo, u ~ 1.
    // Color: acento del organismo, intensidad ∝ v.
    vec3 base = vec3(0.06, 0.08, 0.12);      // fondo muerto
    vec3 tissue = accent * 1.1;              // tejido vivo
    float vis = clamp(v / 0.35, 0.0, 1.0);
    vec3 col = mix(base, tissue, vis);
    // Sombra sutil por u para dar textura
    col *= (0.85 + 0.15 * (1.0 - u));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════════
// View — un plano por organismo
// ═══════════════════════════════════════════════════════════════

interface Handle {
  salamander: { state: Float32Array; next: Float32Array; tex: THREE.DataTexture | null };
  human:      { state: Float32Array; next: Float32Array; tex: THREE.DataTexture | null };
  steps: number;
}

function OrganismPlane({
  organism, handleRef, offsetX, planeSize,
}: {
  organism: 'salamander' | 'human';
  handleRef: React.MutableRefObject<Handle>;
  offsetX: number; planeSize: number;
}) {
  const { geometry, uniforms, tex } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(planeSize, planeSize);
    const data = new Float32Array(RES * RES * 4);
    const t = new THREE.DataTexture(data, RES, RES, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    const accent = organism === 'salamander'
      ? new THREE.Color('#4FC3F7')
      : new THREE.Color('#EF4444');
    return {
      geometry: geom,
      uniforms: {
        stencilTex: { value: t },
        accent:     { value: accent },
      },
      tex: t,
    };
  }, [organism, planeSize]);

  useEffect(() => {
    handleRef.current[organism].tex = tex;
    return () => {
      handleRef.current[organism].tex = null;
      tex.dispose();
    };
  }, [tex, handleRef, organism]);

  useFrame(() => {
    const o = handleRef.current[organism];
    if (!o.tex) return;
    const data = o.tex.image.data as Float32Array;
    data.set(o.state);
    o.tex.needsUpdate = true;
  });

  return (
    <mesh geometry={geometry} position={[offsetX, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shaderMaterial uniforms={uniforms}
        vertexShader={PLANE_VS} fragmentShader={PLANE_FS} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════
// Loop de stepping
// ═══════════════════════════════════════════════════════════════

function SimLoop({ playing, stepsPerFrame, handleRef }: {
  playing: boolean;
  stepsPerFrame: number;
  handleRef: React.MutableRefObject<Handle>;
}) {
  useFrame(() => {
    if (!playing) return;
    const s = handleRef.current.salamander;
    const h = handleRef.current.human;
    for (let k = 0; k < stepsPerFrame; k++) {
      stepGrayScott(s.state, s.next, ORGANISMS[0]);
      const tmp1 = s.state; s.state = s.next; s.next = tmp1;
      stepGrayScott(h.state, h.next, ORGANISMS[1]);
      const tmp2 = h.state; h.state = h.next; h.next = tmp2;
    }
    handleRef.current.steps += stepsPerFrame;
  });
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Módulo principal
// ═══════════════════════════════════════════════════════════════

function fmt(x: number, d = 0) { return x.toFixed(d); }

export default function Regeneration() {
  const { audience } = useAudience();
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(8);   // steps/frame
  const handleRef = useRef<Handle>({
    salamander: (() => {
      const { field, next } = makeState();
      seedHealthy(field);
      return { state: field, next, tex: null };
    })(),
    human: (() => {
      const { field, next } = makeState();
      seedHealthy(field);
      return { state: field, next, tex: null };
    })(),
    steps: 0,
  });

  // Re-seed coordinado
  const reseed = () => {
    seedHealthy(handleRef.current.salamander.state);
    seedHealthy(handleRef.current.human.state);
    handleRef.current.steps = 0;
  };

  // Lesión coordinada en el centro
  const wound = () => {
    applyWound(handleRef.current.salamander.state, RES / 2, RES / 2, RES * 0.2);
    applyWound(handleRef.current.human.state,      RES / 2, RES / 2, RES * 0.2);
  };

  // Trigger UI re-render periódico para actualizar stats
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 200);
    return () => clearInterval(t);
  }, []);

  const planeSize = 4;
  const gap = planeSize * 0.3;
  const offsetL = -(planeSize / 2 + gap / 2);
  const offsetR =  +(planeSize / 2 + gap / 2);
  const span = planeSize * 2 + gap;
  const simTime = (handleRef.current.steps * 1.0).toFixed(0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0"
        style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>
        <Canvas
          camera={{ position: [0, span * 0.85, span * 0.9], fov: 44, near: 0.01, far: 10000 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          style={{ background: 'transparent', width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[5, 8, 5]} intensity={0.45} color="#CBD5E1" />
          <OrbitControls enableDamping dampingFactor={0.08}
            minDistance={planeSize * 0.2} maxDistance={span * 3}
            maxPolarAngle={Math.PI * 0.48} />
          <SimLoop playing={playing} stepsPerFrame={speed} handleRef={handleRef} />
          <OrganismPlane organism="salamander" handleRef={handleRef}
            offsetX={offsetL} planeSize={planeSize} />
          <OrganismPlane organism="human" handleRef={handleRef}
            offsetX={offsetR} planeSize={planeSize} />
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.4} luminanceThreshold={0.35} luminanceSmoothing={0.5}
              mipmapBlur kernelSize={KernelSize.LARGE} />
            <Vignette offset={0.3} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
          </EffectComposer>
        </Canvas>

        {/* Etiquetas */}
        <div className="absolute top-5 left-[24%] -translate-x-1/2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-[#64748B] font-mono">Régimen α · auto-replicación</div>
          <div className="text-[18px] text-[#4FC3F7] font-semibold tracking-wide">Salamandra</div>
          <div className="text-[10px] text-[#94A3B8] font-mono">F={ORGANISMS[0].F}  k={ORGANISMS[0].k}</div>
        </div>
        <div className="absolute top-5 right-[24%] translate-x-1/2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-[#64748B] font-mono">Régimen uniforme · cicatriz</div>
          <div className="text-[18px] text-[#EF4444] font-semibold tracking-wide">Humano</div>
          <div className="text-[10px] text-[#94A3B8] font-mono">F={ORGANISMS[1].F}  k={ORGANISMS[1].k}</div>
        </div>

        {/* Tiempo */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] font-mono text-[11px] text-[#CBD5E1]">
          t = {simTime}
        </div>

        {/* Controles — barra grande, clara */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 bg-[#0B0F17]/95 backdrop-blur border border-[#1E293B] rounded-xl px-3 py-2.5 shadow-2xl flex-wrap justify-center max-w-[calc(100vw-16px)] sm:max-w-none">
          <button onClick={() => setPlaying(p => !p)}
            className={`flex items-center gap-2 px-4 h-11 rounded-lg border text-[13px] font-semibold tracking-wide transition ${
              playing
                ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
                : 'border-[#10B981]/60 text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/15'
            }`}>
            <span className="text-[16px]">{playing ? '❚❚' : '▶'}</span>
            <span>{playing ? 'Pausa' : 'Reproducir'}</span>
          </button>
          <button onClick={reseed}
            className="flex items-center gap-2 px-4 h-11 rounded-lg border border-[#334155] text-[#CBD5E1] hover:text-white hover:border-[#4FC3F7] text-[13px] font-medium transition">
            <span className="text-[16px]">↺</span>
            <span>Resembrar</span>
          </button>
          <button onClick={wound}
            className="flex items-center gap-2 px-4 h-11 rounded-lg border border-[#EF4444] text-[#F87171] hover:bg-[#EF4444]/15 text-[13px] font-bold tracking-wide transition">
            <span className="text-[16px]">✕</span>
            <span>Lesionar</span>
          </button>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Comparación">
          <div className="space-y-3">
            {ORGANISMS.map(o => (
              <div key={o.id} className="border-l-2 pl-3" style={{ borderColor: o.accent }}>
                <div className="text-[12px] font-semibold" style={{ color: o.accent }}>{o.name}</div>
                <div className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">{o.blurb}</div>
              </div>
            ))}
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="Qué ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Dos "pieles" con los mismos átomos, la misma química — distintas <em>reglas</em>.</p>
              <p>Pulsa <span className="text-[#F87171] font-semibold">Lesionar</span>: se borra un círculo en ambas.</p>
              <p>Espera unos segundos: la <span className="text-[#4FC3F7]">salamandra</span> regenera el patrón; el <span className="text-[#EF4444]">humano</span> no.</p>
              <p className="text-[11px] italic text-[#94A3B8] mt-3">La diferencia no está en la materia. Está en los parámetros que regulan la química del tejido.</p>
            </div>
          </Section>
        ) : (
          <Section title="Modelo">
            <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
              <div className="text-white">∂u/∂t = D_u ∇²u − uv² + F(1−u)</div>
              <div className="text-white">∂v/∂t = D_v ∇²v + uv² − (F+k)v</div>
              <div className="mt-2 text-[#94A3B8]">Gray-Scott. D_u = {D_U}, D_v = {D_V}.</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="rounded p-2 border" style={{ borderColor: '#4FC3F766' }}>
                <div className="text-[#4FC3F7]">α · salamandra</div>
                <div className="text-[#94A3B8]">F = {ORGANISMS[0].F}</div>
                <div className="text-[#94A3B8]">k = {ORGANISMS[0].k}</div>
              </div>
              <div className="rounded p-2 border" style={{ borderColor: '#EF444466' }}>
                <div className="text-[#EF4444]">uniforme · humano</div>
                <div className="text-[#94A3B8]">F = {ORGANISMS[1].F}</div>
                <div className="text-[#94A3B8]">k = {ORGANISMS[1].k}</div>
              </div>
            </div>
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Integrador">
            <Slider label="steps/frame" v={speed} min={1} max={40} step={1}
              on={v => setSpeed(Math.round(v))} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              FTCS explicit con condición CFL D_u·dt/dx² ≤ 1/4.
              RES = {RES}. Tamaño real: {RES * RES} celdas × 2 reactores.
            </div>
          </Section>
        )}

        <Section title="Biología real">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p>Genes ortólogos salamandra-humano: <span className="text-white">&gt;98%</span>.</p>
            <p>Diferencia clave: reactivación de BMP, Wnt7a, Msx1 en el blastema vs. supresión por inhibidores inmunes en el humano.</p>
            <p className="text-[10px] mt-3">Ref: Tanaka 2016 · Brockes & Kumar 2008 · Pearson 1993.</p>
          </div>
        </Section>

        <Section title="Arquitectura">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p>Mismo <code className="font-mono text-white">stencilStepCpu</code> que usa TissueField al nivel 2.</p>
            <p>Dos instancias con parámetros distintos — la receta se reutiliza entre disciplinas.</p>
            <p className="font-mono text-[10px] text-[#64748B]">src/lib/gpu/stencil.ts</p>
          </div>
        </Section>
        {/* dummy use to keep formatter */}
        <div className="hidden">{fmt(0)}</div>
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
function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v}</span>
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
