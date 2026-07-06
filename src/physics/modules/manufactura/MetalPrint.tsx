/**
 * Impresión 3D de metal por capas — SIMULACION (no representación).
 *
 * Motor: src/lib/physics/printSim.ts. Toolpath estilo G-code → deposita gotas
 * (cada una un desprendimiento resonante) → ADHESION dependiente de temperatura
 * (vecino frío = unión débil) → ENFRIAMIENTO Newton de todo el cuerpo.
 * El color de cada gota = su temperatura simulada (mapa térmico vivo). Las
 * uniones débiles se marcan en rojo. Todo sale de los números.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { tempColor } from '@/lib/physics/metalDrop';
import {
  printReset, printStep, done,
  type PrintParams, type PrintState,
} from '@/lib/physics/printSim';

const VS = 1.0;            // mm -> unidades de escena

interface MPLesson { presetId: string; }
const PRESETS = [
  { id: 'sano', name: 'Impresión sana', note: 'Tasa alta: la capa de abajo sigue caliente → buena fusión. Cero defectos.',
    patch: { rate: 75, dwell: 0, tauCool: 6, Tamb: 25 } as Partial<PrintParams> },
  { id: 'lento', name: 'Demasiado lento', note: 'Tasa baja, SIN precalentar: la capa de abajo se enfría a ambiente → uniones DÉBILES (rojo).',
    patch: { rate: 12, dwell: 0, tauCool: 6, Tamb: 25 } as Partial<PrintParams> },
  { id: 'precalentado', name: 'Lento + PRECALENTADO', note: 'Igual de lento, PERO con cama/cámara a T_amb > T_bond: la unión nunca baja del umbral → 0 defectos, sin fuerza bruta. Subir desde abajo, no a la punta.',
    patch: { rate: 12, dwell: 0, tauCool: 6, Tamb: 1000 } as Partial<PrintParams> },
];

const LESSON: Lesson<MPLesson> = {
  hook: {
    title: 'Imprimir metal de verdad: el enemigo no es derretir, es PEGAR la capa siguiente.',
    body: `Cada gota cae caliente (~1540 °C) sobre la de abajo. Si esa vecina SIGUE caliente, funden juntas = unión sana. Pero si la pieza ya se enfrió (porque imprimes lento o esperas mucho), la gota nueva se posa sobre metal frío y NO funde bien → unión débil.

Aquí lo ves: el color de cada gota es su temperatura real; las uniones débiles salen en rojo. Sube/baja la tasa y mira aparecer (o desaparecer) los defectos. Es el compromiso real de la manufactura aditiva: rápido funde bien pero acumula calor; lento se enfría y se despega.`,
  },
  steps: [
    { title: 'Impresión sana', duration: 6000,
      body: 'Tasa alta. Mira el mapa térmico: la cima está al rojo-blanco, el cuerpo se enfría hacia abajo. Sin rojo de defecto: todo fundió.',
      formula: 'T_vecino(t) = T0 + (T_dep−T0)·e^(−Δt/τ)   unión sana si T_vecino > T_bond',
      keyframes: [{ at: 0, state: { presetId: 'sano' } }] },
    { title: 'Demasiado lento → se despega', duration: 6000,
      body: 'Baja la tasa. La capa de abajo se enfría bajo T_bond antes de la siguiente → aparecen uniones rojas (débiles). La pieza saldría delaminada.',
      formula: 'lento ⇒ Δt entre capas ↑ ⇒ T_vecino ↓ ⇒ defectos',
      keyframes: [{ at: 0, state: { presetId: 'lento' } }] },
  ],
  connect: {
    body: `Es el mismo principio del solver térmico cara-i (tu Operador 𝔄): la temperatura es un campo que difunde y se enfría. Aquí lo usamos para decidir, gota por gota, si la unión funde. El control real de una impresora WAAM es exactamente este balance: dwell y tasa para mantener la T inter-pasada en la ventana de fusión sin acumular calor que deforme.`,
    links: [],
  },
};

const fmt = (x: number, d = 0) => isFinite(x) ? x.toFixed(d) : 'NaN';

export default function MetalPrint() {
  const { audience } = useAudience();
  const [params, setParams] = useState<PrintParams>({
    shape: 'tubo', rate: 75, tauCool: 6, Tdep: 1540, Tbond: 900, Tamb: 25,
    dwell: 0, beadW: 1.0, beadH: 0.8, nLayers: 26,
  });
  const [running, setRunning] = useState(true);
  const [presetId, setPresetId] = useState('sano');
  const sim = useRef<PrintState>(printReset(params));
  const paramsRef = useRef(params); useEffect(() => { paramsRef.current = params; }, [params]);
  const set = (patch: Partial<PrintParams>) => setParams(p => ({ ...p, ...patch }));
  const reset = (np = paramsRef.current) => { sim.current = printReset(np); };
  // re-armar al cambiar forma o nLayers (cambia la geometría del toolpath)
  useEffect(() => { reset(); /* eslint-disable-next-line */ }, [params.shape, params.nLayers]);

  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0, last = performance.now(), lastUi = 0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      sim.current = printStep(sim.current, paramsRef.current, dt);
      if (now - lastUi > 100) { force(x => x + 1); lastUi = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const st = sim.current;
  const pct = st.total ? Math.round(100 * st.n / st.total) : 0;
  const weakPct = st.n ? (100 * st.weakCount / st.n) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={22} autoRotate bloomIntensity={0.9} bloomThreshold={0.1}>
          <Part sim={sim} />
        </Stage>

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/75 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">forma</span>= {params.shape}</div>
          <div><span className="text-[#64748B]">capa&nbsp;</span>= {st.layer + 1}/{params.nLayers}</div>
          <div><span className="text-[#64748B]">gotas</span>= {st.n}/{st.total} ({pct}%)</div>
          <div><span className="text-[#64748B]">débil</span>= <span style={{ color: weakPct > 1 ? '#F87171' : '#86EFAC' }}>{fmt(weakPct, 1)}%</span></div>
          <div className="pt-1">{done(st) ? <span className="text-[#86EFAC]">✓ PIEZA TERMINADA</span> : <span className="text-[#FDBA74]">imprimiendo…</span>}</div>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => reset()} title="Reiniciar">↺</IconBtn>
        </div>

        <div className="absolute bottom-4 left-4 text-[10px] font-mono text-[#64748B] bg-[#0B0F17]/70 rounded px-2 py-1">
          color = temperatura · rojo = unión débil (enfriada)
        </div>
      </div>

      <LessonPanel<MPLesson>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) {
            const pr = PRESETS.find(p => p.id === patch.presetId);
            if (pr) { setPresetId(pr.id); set(pr.patch); }
          }
        }}
        sandbox={
          <>
            <Section title="Pieza">
              <div className="grid grid-cols-3 gap-1.5">
                {(['pared', 'tubo', 'cilindro'] as const).map(sh => (
                  <button key={sh} onClick={() => set({ shape: sh })}
                    className={`px-2 py-2 rounded-md border text-[11px] transition ${
                      params.shape === sh ? 'bg-[#7C2D12]/40 border-[#FB923C]/40 text-white' : 'border-[#1E293B] text-[#94A3B8] hover:text-white'}`}>{sh}</button>
                ))}
              </div>
            </Section>

            <Section title="Preset">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => { setPresetId(p.id); set(p.patch); }}
                    data-testid={`preset-${p.id}`}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id ? 'bg-gradient-to-br from-[#7C2D12]/40 to-[#B45309]/30 border-[#FB923C]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'}`}>{p.name}</button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{PRESETS.find(p => p.id === presetId)?.note}</div>
            </Section>

            {audience === 'child' ? (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>El cabezal escribe la pieza <span className="text-[#FB923C]">capa por capa</span>. Cada gota cae caliente.</p>
                  <p>Si vas muy lento, la capa de abajo se enfría y la nueva <span className="text-[#F87171]">no se pega</span> (rojo). Rápido = se funden bien.</p>
                </div>
              </Section>
            ) : (
              <Section title="Parámetros">
                <Slider label="tasa [gotas/s]" v={params.rate} min={5} max={120} step={1} on={v => set({ rate: v })} fix={0} />
                <Slider label="τ enfriamiento [s]" v={params.tauCool} min={1} max={20} step={0.5} on={v => set({ tauCool: v })} fix={1} />
                <Slider label="T_bond [°C]" v={params.Tbond} min={500} max={1400} step={10} on={v => set({ Tbond: v })} fix={0} />
                <Slider label="precalentar T_amb [°C]" v={params.Tamb} min={25} max={1200} step={25} on={v => set({ Tamb: v })} fix={0} />
                <Slider label="dwell por capa [s]" v={params.dwell} min={0} max={6} step={0.1} on={v => set({ dwell: v })} fix={1} />
                <Slider label="capas" v={params.nLayers} min={5} max={40} step={1} on={v => set({ nLayers: v })} fix={0} />
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Estado (vivo)">
                <Row label="capa" value={`${st.layer + 1}/${params.nLayers}`} />
                <Row label="gotas" value={`${st.n}/${st.total}`} />
                <Row label="uniones débiles" value={`${st.weakCount} (${fmt(weakPct, 1)}%)`} highlight={weakPct > 1} />
                <Row label="dwell restante" value={`${fmt(st.dwellLeft, 1)} s`} />
                <div className="mt-2 text-[10px] text-[#64748B]">unión sana ⇔ T_vecino &gt; {params.Tbond}°C al depositar</div>
              </Section>
            )}

            <Section title="Física (lo que integra)">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div>T(t) = T0 + (T_dep−T0)·e^(−t/τ)</div>
                <div className="text-white">unión sana ⟺ T_vecino &gt; T_bond</div>
                <div>cada gota = 1 desprendimiento resonante</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

function Part({ sim }: { sim: React.MutableRefObject<PrintState> }) {
  const grp = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const total = sim.current.total;

  useFrame(() => {
    const s = sim.current;
    const m = mesh.current; if (!m) return;
    if (m.count !== s.n) m.count = s.n;
    for (let i = 0; i < s.n; i++) {
      dummy.position.set(s.pts[i * 3] * VS, s.pts[i * 3 + 1] * VS, s.pts[i * 3 + 2] * VS);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (s.weak[i]) col.setRGB(1.0, 0.12, 0.08);
      else { const [r, g, b] = tempColor(s.temps[i]); col.setRGB(r, g, b); }
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    const topY = s.n > 0 ? s.pts[(s.n - 1) * 3 + 1] : 0;
    if (grp.current) grp.current.position.y = -topY * VS / 2;   // centra la parte ya construida
    if (s.n > 0 && head.current && wire.current) {
      const x = s.pts[(s.n - 1) * 3] * VS, y = s.pts[(s.n - 1) * 3 + 1] * VS, z = s.pts[(s.n - 1) * 3 + 2] * VS;
      head.current.position.set(x, y + 0.9, z);
      wire.current.position.set(x, y + 5, z);
    }
  });

  return (
    <group ref={grp}>
      <instancedMesh ref={mesh} args={[undefined, undefined, total]} frustumCulled={false}>
        <sphereGeometry args={[0.58 * VS, 12, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <mesh ref={head}><coneGeometry args={[0.5, 1.3, 16]} /><meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.3} emissive="#334155" emissiveIntensity={0.4} /></mesh>
      <mesh ref={wire}><cylinderGeometry args={[0.12, 0.12, 10, 12]} /><meshStandardMaterial color="#9aa3b2" metalness={0.7} roughness={0.35} /></mesh>
      <mesh position={[0, -0.6, 0]}><boxGeometry args={[16, 0.5, 16]} /><meshStandardMaterial color="#2a2f38" metalness={0.5} roughness={0.6} /></mesh>
      <gridHelper args={[22, 22, '#1E293B', '#152030']} position={[0, -0.85, 0]} />
    </group>
  );
}

// ── helpers ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="p-4 border-b border-[#1E293B]"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>{children}</div>);
}
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (<div className="flex items-baseline justify-between text-[11px] font-mono py-0.5"><span className="text-[#64748B]">{label}</span><span className={highlight ? 'text-[#F87171]' : 'text-white'}>{value}</span></div>);
}
function Slider({ label, v, min, max, step, on, fix = 0 }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void; fix?: number }) {
  return (<div className="mb-2"><div className="flex items-baseline justify-between text-[11px] font-mono"><span className="text-[#64748B]">{label}</span><span className="text-white">{v.toFixed(fix)}</span></div>
    <input type="range" min={min} max={max} step={step} value={v} onChange={e => on(Number(e.target.value))} className="w-full" /></div>);
}
function IconBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (<button onClick={onClick} title={title} className={`w-9 h-9 rounded-md border text-[14px] flex items-center justify-center transition ${active ? 'border-[#FB923C]/50 text-white bg-[#7C2D12]/30' : 'border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#334155]'}`}>{children}</button>);
}
