/**
 * Péndulo doble — caos determinista en 3D.
 *
 * Motor: Lagrangiano analítico con RK4 (src/lib/physics/mech.ts).
 * Visualización: R3F al nivel del átomo de GaiaLab — bloom, vignette,
 * rastro tipo nube de puntos con textura gaussiana, rotación suave.
 *
 * Dos péndulos idénticos salvo Δθ₁ = 1e-6 rad. La trayectoria del bob
 * exterior se acumula como point cloud additive — así la forja comparte
 * el mismo lenguaje visual en todos sus módulos.
 *
 * Mensaje pedagógico: divergencia |A − B| ~ e^(λt), λ ≈ 1.5 /s,
 * mientras ΔE/E < 1e-12. El caos es físico, el integrador es fiel.
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import {
  dpStep, dpEnergy, dpPositions,
  type DoublePendulumState, type DoublePendulumParams,
} from '@/lib/physics/mech';
import { getParticleTexture } from '@/labs/components/sprite-texture';

const TRAIL_LEN = 4000;

interface Preset {
  id: string; name: string;
  params: DoublePendulumParams;
  init: { th1: number; th2: number; w1: number; w2: number };
  note: string;
}

const PRESETS: Preset[] = [
  {
    id: 'classic', name: 'Caos clásico (θ = 2 rad)',
    params: { m1: 1, m2: 1, L1: 1, L2: 1, g: 9.81 },
    init: { th1: 2.0, th2: 2.5, w1: 0, w2: 0 },
    note: 'Amplitudes grandes → no linealidad fuerte. Divergencia visible en ~3 s.',
  },
  {
    id: 'small-angle', name: 'Ángulos pequeños (quasi-lineal)',
    params: { m1: 1, m2: 1, L1: 1, L2: 1, g: 9.81 },
    init: { th1: 0.2, th2: 0.15, w1: 0, w2: 0 },
    note: 'Régimen casi lineal — dos modos normales casi independientes.',
  },
  {
    id: 'heavy-outer', name: 'Bob exterior pesado',
    params: { m1: 1, m2: 4, L1: 1, L2: 1, g: 9.81 },
    init: { th1: 1.8, th2: 2.6, w1: 0, w2: 0 },
    note: 'La masa exterior domina — el péndulo superior actúa de carrusel.',
  },
  {
    id: 'long-inner', name: 'Brazo interior largo',
    params: { m1: 1, m2: 1, L1: 2, L2: 0.5, g: 9.81 },
    init: { th1: 1.5, th2: 2.0, w1: 0, w2: 0 },
    note: 'Asimetría geométrica — periodo dominado por L1.',
  },
];

function fmt(x: number, d = 3) { return isFinite(x) ? x.toFixed(d) : 'NaN'; }
function fmtSci(x: number, d = 3) { return isFinite(x) ? x.toExponential(d) : 'NaN'; }

export default function DoublePendulum() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState('classic');
  const preset = PRESETS.find(p => p.id === presetId)!;

  const [params, setParams] = useState<DoublePendulumParams>(preset.params);
  const [running, setRunning] = useState(true);
  const [dt, setDt] = useState(1/600);

  const stateA = useRef<DoublePendulumState>({ t: 0, th1: 0, th2: 0, w1: 0, w2: 0 });
  const stateB = useRef<DoublePendulumState>({ t: 0, th1: 0, th2: 0, w1: 0, w2: 0 });
  const E0 = useRef<number>(0);

  const reset = (keepParams = false) => {
    const p = keepParams ? params : preset.params;
    if (!keepParams) setParams(preset.params);
    stateA.current = { t: 0, th1: preset.init.th1,         th2: preset.init.th2, w1: preset.init.w1, w2: preset.init.w2 };
    stateB.current = { t: 0, th1: preset.init.th1 + 1e-6,  th2: preset.init.th2, w1: preset.init.w1, w2: preset.init.w2 };
    E0.current = dpEnergy(stateA.current, p);
  };
  useEffect(() => { reset(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [presetId]);

  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let lastUi = 0;
    const tick = () => {
      const N = 10;
      for (let i = 0; i < N; i++) {
        stateA.current = dpStep(stateA.current, params, dt);
        stateB.current = dpStep(stateB.current, params, dt);
      }
      const now = performance.now();
      if (now - lastUi > 100) { force(x => x + 1); lastUi = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, dt, params]);

  const eA = dpEnergy(stateA.current, params);
  const dE = E0.current !== 0 ? Math.abs((eA - E0.current) / E0.current) : 0;
  const posA = dpPositions(stateA.current, params);
  const posB = dpPositions(stateB.current, params);
  const sepDist = Math.hypot(posA.x2 - posB.x2, posA.y2 - posB.y2);

  const L = Math.max(params.L1 + params.L2, 1);

  return (
    <div className="grid grid-cols-[1fr_340px] gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={L * 3.0} bloomIntensity={0.85} bloomThreshold={0.12}>
          <Scene stateA={stateA} stateB={stateB} params={params} />
          <GroundGrid extent={L * 2.5} />
        </Stage>

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/75 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1]">
          <div><span className="text-[#64748B]">t&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {fmt(stateA.current.t, 3)} s</div>
          <div><span className="text-[#64748B]">|A−B|</span>= {fmtSci(sepDist, 2)} m</div>
          <div><span className="text-[#64748B]">ΔE/E&nbsp;</span>= <span className={dE > 1e-4 ? 'text-[#F87171]' : ''}>{fmtSci(dE, 2)}</span></div>
        </div>

        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => reset(true)}  title="Reiniciar misma parametría">↺</IconBtn>
          <IconBtn onClick={() => reset(false)} title="Preset default">⟲</IconBtn>
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
              <p>Dos péndulos <span className="text-[#4FC3F7]">cyan</span> y <span className="text-[#F472B6]">rosa</span> empiezan casi idénticos.</p>
              <p>En milisegundos se separan <em>exponencialmente</em> — eso es <span className="text-white">caos determinista</span>.</p>
              <p>Pero la energía total casi no cambia: la física es perfecta, el futuro es impredecible.</p>
            </div>
          </Section>
        ) : (
          <Section title="Estado (A)">
            <Row label="t"     value={`${fmt(stateA.current.t,3)} s`} />
            <Row label="θ₁"    value={`${fmt(stateA.current.th1,4)} rad`} />
            <Row label="θ₂"    value={`${fmt(stateA.current.th2,4)} rad`} />
            <Row label="E(A)"  value={`${fmt(eA,4)} J`} />
            <Row label="ΔE/E"  value={fmtSci(dE,3)} highlight={dE > 1e-4} />
            <Row label="|A−B|" value={fmtSci(sepDist,3)} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              Lyapunov empírico λ = log(|Δ|)/t — con Δ₀=1e-6 crece como e^(λt), λ ≈ 1.5 /s.
            </div>
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Parámetros físicos">
            <Slider label="m₁" v={params.m1} min={0.1} max={5}  step={0.01} on={v => setParams(p => ({ ...p, m1: v }))} />
            <Slider label="m₂" v={params.m2} min={0.1} max={5}  step={0.01} on={v => setParams(p => ({ ...p, m2: v }))} />
            <Slider label="L₁" v={params.L1} min={0.2} max={3}  step={0.01} on={v => setParams(p => ({ ...p, L1: v }))} />
            <Slider label="L₂" v={params.L2} min={0.2} max={3}  step={0.01} on={v => setParams(p => ({ ...p, L2: v }))} />
            <Slider label="g"  v={params.g}  min={0}   max={25} step={0.01} on={v => setParams(p => ({ ...p, g: v }))} />
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Integrador">
            <label className="block text-[11px] text-[#94A3B8]">
              dt — <span className="font-mono text-white">{fmtSci(dt, 2)}</span> s
            </label>
            <input type="range" min={Math.log10(1e-5)} max={Math.log10(1e-2)} step={0.01}
                   value={Math.log10(dt)}
                   onChange={e => setDt(Math.pow(10, Number(e.target.value)))}
                   className="w-full mt-1" />
            <div className="mt-2 text-[10px] text-[#64748B]">
              RK4 clásico. 10 sub-pasos/frame → dt efectivo ≈ {fmtSci(dt*10,1)} s.
              Para amplitud ∼π baja dt a 1e-4 si quieres ΔE/E &lt; 1e-12.
            </div>
          </Section>
        )}

        <Section title="Ecuación">
          <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug">
            <div className="text-white">L = T − U</div>
            <div className="mt-1 text-[#94A3B8]">con T, U clásicos.</div>
            <div className="mt-1">→ θ̈₁, θ̈₂ via ∂L/∂θ − d/dt(∂L/∂θ̇) = 0.</div>
          </div>
        </Section>
      </aside>
    </div>
  );
}

// ─── Escena 3D ──────────────────────────────────────────────────────────

function Scene({ stateA, stateB, params }: {
  stateA: React.MutableRefObject<DoublePendulumState>;
  stateB: React.MutableRefObject<DoublePendulumState>;
  params: DoublePendulumParams;
}) {
  const tex = useMemo(() => getParticleTexture(), []);

  const rodA1 = useRef<THREE.Mesh>(null);
  const rodA2 = useRef<THREE.Mesh>(null);
  const rodB1 = useRef<THREE.Mesh>(null);
  const rodB2 = useRef<THREE.Mesh>(null);
  const bobA1 = useRef<THREE.Mesh>(null);
  const bobA2 = useRef<THREE.Mesh>(null);
  const bobB1 = useRef<THREE.Mesh>(null);
  const bobB2 = useRef<THREE.Mesh>(null);

  const trailA = useMemo(() => makeTrailGeom(), []);
  const trailB = useMemo(() => makeTrailGeom(), []);
  const tiA = useRef(0), tiB = useRef(0);
  const tcA = useRef(0), tcB = useRef(0);

  useFrame(() => {
    const pA = dpPositions(stateA.current, params);
    const pB = dpPositions(stateB.current, params);

    place(bobA1.current, pA.x1, pA.y1);
    place(bobA2.current, pA.x2, pA.y2);
    place(bobB1.current, pB.x1, pB.y1);
    place(bobB2.current, pB.x2, pB.y2);
    orientRod(rodA1.current, 0, 0, pA.x1, pA.y1);
    orientRod(rodA2.current, pA.x1, pA.y1, pA.x2, pA.y2);
    orientRod(rodB1.current, 0, 0, pB.x1, pB.y1);
    orientRod(rodB2.current, pB.x1, pB.y1, pB.x2, pB.y2);

    appendTrail(trailA, tiA, tcA, pA.x2, pA.y2, 0.31, 0.76, 0.97);  // cyan
    appendTrail(trailB, tiB, tcB, pB.x2, pB.y2, 0.95, 0.45, 0.72);  // pink
  });

  return (
    <>
      {/* Pivot */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.045, 20, 20]} />
        <meshStandardMaterial color="#CBD5E1" emissive="#64748B" emissiveIntensity={0.3} metalness={0.5} roughness={0.4} />
      </mesh>

      <Rod ref={rodA1} color="#4FC3F7" />
      <Rod ref={rodA2} color="#4FC3F7" />
      <Bob ref={bobA1} color="#4FC3F7" size={0.055} />
      <Bob ref={bobA2} color="#4FC3F7" size={0.09} glow={1.8} />

      <Rod ref={rodB1} color="#F472B6" />
      <Rod ref={rodB2} color="#F472B6" />
      <Bob ref={bobB1} color="#F472B6" size={0.055} />
      <Bob ref={bobB2} color="#F472B6" size={0.09} glow={1.8} />

      <points geometry={trailA}>
        <pointsMaterial vertexColors map={tex} alphaMap={tex} size={0.14}
          sizeAttenuation transparent opacity={0.88}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      <points geometry={trailB}>
        <pointsMaterial vertexColors map={tex} alphaMap={tex} size={0.14}
          sizeAttenuation transparent opacity={0.88}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </>
  );
}

// Simulation y is negative-down; scene y is up. Flip at the interface.
function place(m: THREE.Mesh | null, x: number, y: number) {
  if (m) m.position.set(x, y, 0);
}
function orientRod(m: THREE.Mesh | null, x1: number, y1: number, x2: number, y2: number) {
  if (!m) return;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  m.position.set((x1+x2)/2, (y1+y2)/2, 0);
  m.scale.set(1, len, 1);
  m.rotation.z = Math.atan2(-dx, dy);  // cylinder default +y → rotate into (dx,dy)
}

const Rod = forwardRef<THREE.Mesh, { color: string }>(function Rod({ color }, ref) {
  return (
    <mesh ref={ref}>
      {/* Unit cylinder (height=1) along +y, scaled per frame */}
      <cylinderGeometry args={[0.015, 0.015, 1, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} metalness={0.3} roughness={0.4} />
    </mesh>
  );
});

const Bob = forwardRef<THREE.Mesh, { color: string; size: number; glow?: number }>(function Bob({ color, size, glow = 0.6 }, ref) {
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 32, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} metalness={0.25} roughness={0.3} />
    </mesh>
  );
});

function makeTrailGeom() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
  g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
  g.setDrawRange(0, 0);
  return g;
}
function appendTrail(
  g: THREE.BufferGeometry,
  idx: React.MutableRefObject<number>,
  cnt: React.MutableRefObject<number>,
  x: number, y: number, r: number, gn: number, b: number,
) {
  const pA = g.attributes.position as THREE.BufferAttribute;
  const cA = g.attributes.color as THREE.BufferAttribute;
  const i = idx.current;
  (pA.array as Float32Array)[i*3+0] = x;
  (pA.array as Float32Array)[i*3+1] = y;
  (pA.array as Float32Array)[i*3+2] = 0;
  (cA.array as Float32Array)[i*3+0] = r;
  (cA.array as Float32Array)[i*3+1] = gn;
  (cA.array as Float32Array)[i*3+2] = b;
  idx.current = (i + 1) % TRAIL_LEN;
  cnt.current = Math.min(cnt.current + 1, TRAIL_LEN);
  pA.needsUpdate = true;
  cA.needsUpdate = true;
  // drawRange here is only meaningful the first TRAIL_LEN frames, after that we
  // always draw the full ring buffer — no visual seam.
  g.setDrawRange(0, cnt.current);
}

// Faint reference grid in the xz plane (the floor)
function GroundGrid({ extent }: { extent: number }) {
  return (
    <group position={[0, -extent * 0.8, 0]}>
      <gridHelper args={[extent * 4, 24, '#1E293B', '#152030']} />
    </group>
  );
}

// ─── UI helpers ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={highlight ? 'text-[#F87171]' : 'text-white'}>{value}</span>
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
      <input type="range" min={min} max={max} step={step} value={v} onChange={e => on(Number(e.target.value))} className="w-full" />
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
      }`}>
      {children}
    </button>
  );
}
