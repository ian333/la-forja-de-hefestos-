/**
 * Gota resonante — SIMULACION numerica de impresion de metal por microalambre.
 *
 * NO es una representacion: integra la ODE real del oscilador de Rayleigh
 * (src/lib/physics/metalDrop.ts) con sub-pasos, y TODO el grafico sale de esos
 * numeros: la esfera se deforma con el armonico l=2 REAL r(θ)=a(1+q·P₂(cosθ)),
 * y hay 3 graficas vivas (q(t), T(t), curva A(f)). El tiempo se escala para el
 * ojo; la frecuencia real (~668 Hz) va en el HUD.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import {
  mdStep, mdReset, aOf, tempColor, lorentzAmp, dTargetMilk,
  type MetalDropParams, type MetalDropState,
} from '@/lib/physics/metalDrop';

const S = 1900;
const TIPY = 1.6, TOP = 5.2, BEAD0 = -3.0, RMAX = 1.35;
const STEP_SIM = 1.8e-4;
const DT_INT = 3e-5;
const BUF = 320;

interface MDLesson { presetId: string; }
const PRESETS = [
  { id: 'resonante', name: 'En resonancia (auto)',
    note: 'El drive sigue a f₂. q oscila, crece, llega a 1 y PINCHA. Rítmico.',
    patch: { track: true,  I0: 55, Iac: 10, fdrive: 700, milk: false } as Partial<MetalDropParams> },
  { id: 'detune', name: 'Fuera de tono',
    note: 'Drive fijo lejos de f₂: mira q(t) — la oscilación nunca llega a 1.',
    patch: { track: false, I0: 55, Iac: 10, fdrive: 1150, milk: false } as Partial<MetalDropParams> },
  { id: 'fuerte', name: 'Ripple alto',
    note: 'Más ripple = la amplitud sube más rápido y pincha antes.',
    patch: { track: true,  I0: 55, Iac: 16, milk: false } as Partial<MetalDropParams> },
  { id: 'ordeño', name: 'Ordeñado (tamaño a demanda)',
    note: 'Dispara cada 1/f_disparo: V=A_w·v_f/f. Sube f_disparo → gota más chica. Sube v_f → más grande.',
    patch: { track: true, milk: true, I0: 55, Iac: 12, ffire: 600, vf: 4e-3 } as Partial<MetalDropParams> },
];

const LESSON: Lesson<MDLesson> = {
  hook: {
    title: 'Esto NO es una animación: es la ODE corriendo, y el dibujo sale de los números.',
    body: `La gota fundida en la punta del alambre es un resonador de Rayleigh (modo l=2). Aquí integramos su ecuación real q'' + γq' + ω₂²q = (I/I_crit)²·fL paso a paso, con la corriente modulada a la frecuencia que elijas.

Mira la gráfica q(t): cuando afinas el drive a f₂ ≈ 668 Hz, la amplitud crece por resonancia hasta 1 y la gota PINCHA. Fuera de tono, q se queda chico y no pasa nada. La forma 3D es el armónico esférico l=2 real, deformada por q. Todo viene del mismo número.`,
  },
  steps: [
    { title: 'En resonancia', duration: 6000,
      body: 'q(t) crece como oscilación amplificada hasta tocar 1 (línea roja). Ahí pincha, cae, y el cordón sube. La curva A(f) marca tu punto en el pico.',
      formula: "q'' + γq' + ω₂²q = ω₂²(I/I_crit)²·fL   —  pincha en q≥1",
      keyframes: [{ at: 0, state: { presetId: 'resonante' } }] },
    { title: 'Fuera de tono', duration: 6000,
      body: 'Mismo todo pero el drive lejos de f₂. La gráfica q(t) apenas se mueve: la amplitud no sube, no hay pinch. La frecuencia es la que manda.',
      formula: 'A(f) = F / √((ω₂²−ω²)² + (γω)²)  — pico agudísimo',
      keyframes: [{ at: 0, state: { presetId: 'detune' } }] },
  ],
  connect: {
    body: `La misma idea —excitar una RESONANCIA para que un sistema se suelte casi gratis— aparece por todos lados: el cantante que rompe la copa con su nota, el puente de Tacoma Narrows, la afinación de un MEMS. Aquí la usamos para IMPRIMIR METAL con una fuente chica: en vez de pinchar la gota a fuerza bruta (194 A), la afinas a f₂ y el factor de calidad Q≈104 multiplica un ripple chico hasta soltarla.

Es el puente entre física de gotas (Rayleigh-Plateau) y manufactura aditiva metálica de bajo costo: cada gota afinada = un punto de cordón, gobernado por timing, no por potencia.`,
    links: [],
  },
};

const fmt = (x: number, d = 0) => isFinite(x) ? x.toFixed(d) : 'NaN';

export default function MetalDroplet() {
  const { audience } = useAudience();
  const [params, setParams] = useState<MetalDropParams>({
    Rop: 0.15, I0: 55, Iac: 10, fdrive: 700, track: true,
    vf: 2.5e-3, gamma: 1.5, mu: 6e-3, dWire: 0.8e-3, Lth: 1e-3,
    milk: false, ffire: 500,
  });
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [presetId, setPresetId] = useState('resonante');
  const sim = useRef<MetalDropState>(mdReset(params));
  const paramsRef = useRef(params); useEffect(() => { paramsRef.current = params; }, [params]);
  const speedRef = useRef(speed); useEffect(() => { speedRef.current = speed; }, [speed]);
  const set = (patch: Partial<MetalDropParams>) => setParams(p => ({ ...p, ...patch }));

  const qBuf = useRef(new Float32Array(BUF));
  const tBuf = useRef(new Float32Array(BUF).fill(25));
  const head = useRef(0);
  const qCv = useRef<HTMLCanvasElement>(null);
  const tCv = useRef<HTMLCanvasElement>(null);
  const rCv = useRef<HTMLCanvasElement>(null);
  const reset = () => { sim.current = mdReset(paramsRef.current); qBuf.current.fill(0); tBuf.current.fill(25); };

  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0, lastUi = 0;
    const tick = () => {
      const simDt = STEP_SIM * speedRef.current;
      const N = Math.max(4, Math.ceil(simDt / DT_INT));
      const h = simDt / N;
      for (let i = 0; i < N; i++) sim.current = mdStep(sim.current, paramsRef.current, h).s;
      const s = sim.current;
      qBuf.current[head.current] = s.q; tBuf.current[head.current] = s.T;
      head.current = (head.current + 1) % BUF;
      drawTrace(qCv.current, qBuf.current, head.current, -0.45, 1.3, '#FBBF24', 1, '#F87171');
      drawTrace(tCv.current, tBuf.current, head.current, 0, 2000, '#FB923C', 1520, '#60A5FA');
      drawRes(rCv.current, s, paramsRef.current);
      const now = performance.now();
      if (now - lastUi > 90) { force(x => x + 1); lastUi = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const st = sim.current;
  const detune = Math.abs(st.f2 - params.fdrive) / Math.max(st.f2, 1);
  const inRes = params.track || detune < 0.03;
  const dTarget = dTargetMilk(params.vf, params.dWire, params.ffire); // m

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={9} bloomIntensity={1.0} bloomThreshold={0.1}>
          <Scene sim={sim} />
        </Stage>

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/75 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">T&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span style={{ color: st.T > 1450 ? '#FDBA74' : '#94A3B8' }}>{fmt(st.T)} °C</span></div>
          <div><span className="text-[#64748B]">f₂&nbsp;&nbsp;&nbsp;</span>= {fmt(st.f2)} Hz</div>
          <div><span className="text-[#64748B]">drive</span>= {fmt(params.track ? st.f2 : params.fdrive)} Hz</div>
          <div><span className="text-[#64748B]">q&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span style={{ color: st.q > 0.85 ? '#86EFAC' : '#CBD5E1' }}>{fmt(st.q, 2)}</span></div>
          <div><span className="text-[#64748B]">d_gota</span>= <span style={{ color: '#FCD34D' }}>{fmt(st.dLast * 1e3, 3)} mm</span>{params.milk && <span className="text-[#475569]"> → obj {fmt(dTarget * 1e3, 3)}</span>}</div>
          <div><span className="text-[#64748B]">gotas</span>= {st.drops}</div>
          <div className="pt-1">{params.milk ? <span className="text-[#FCD34D]">◆ ORDEÑADO {fmt(params.ffire)} Hz</span> : inRes ? <span className="text-[#86EFAC]">▲ EN RESONANCIA</span> : <span className="text-[#F87171]">fuera de tono</span>}</div>
        </div>

        <div className="absolute top-[150px] left-4 flex flex-col gap-2">
          <Plot label="q(t) — oscilación l=2" cv={qCv} hint="pincha en q=1" />
          <Plot label="T(t) — temperatura °C" cv={tCv} hint="liquidus 1520" />
          <Plot label="A(f) — resonancia" cv={rCv} hint="pico en f₂" />
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={reset} title="Reiniciar">↺</IconBtn>
        </div>
      </div>

      <LessonPanel<MDLesson>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) {
            const pr = PRESETS.find(p => p.id === patch.presetId);
            if (pr) { setPresetId(pr.id); set(pr.patch); }
          }
        }}
        sandbox={
          <>
            <Section title="Preset">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => { setPresetId(p.id); set(p.patch); }}
                    data-testid={`preset-${p.id}`}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id
                        ? 'bg-gradient-to-br from-[#7C2D12]/40 to-[#B45309]/30 border-[#FB923C]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>{p.name}</button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">
                {PRESETS.find(p => p.id === presetId)?.note}
              </div>
            </Section>

            <Section title="Frecuencia de drive">
              <Toggle label="Seguir f₂ (auto)" on={params.track} set={v => set({ track: v })} />
              <div className={params.track ? 'opacity-40 pointer-events-none' : ''}>
                <Slider label="f_drive [Hz]" v={params.fdrive} min={300} max={1200} step={1} on={v => set({ fdrive: v })} fix={0} />
              </div>
              <div className="mt-1 text-[10px] text-[#64748B]">f₂ ahora: <span className="text-white">{fmt(st.f2)} Hz</span> — acércate para resonar.</div>
              <div className="mt-2"><Slider label="velocidad (slow-mo)" v={speed} min={0.25} max={3} step={0.05} on={setSpeed} fix={2} /></div>
            </Section>

            <Section title="Modular el tamaño (ordeñado)">
              <Toggle label="Ordeñar (drop-on-demand)" on={params.milk} set={v => set({ milk: v })} />
              <div className={params.milk ? '' : 'opacity-40 pointer-events-none'}>
                <Slider label="f_disparo [Hz]" v={params.ffire} min={100} max={2000} step={10} on={v => set({ ffire: v })} fix={0} />
              </div>
              <Slider label="v_f avance [mm/s]" v={params.vf * 1e3} min={0.5} max={8} step={0.1} on={v => set({ vf: v / 1e3 })} fix={1} />
              <div className="mt-2 rounded-md bg-[#0E1726] border border-[#1E293B] px-3 py-2 font-mono text-[11px] space-y-1">
                <div className="flex justify-between"><span className="text-[#64748B]">V = A_w·v_f/f</span><span className="text-[#FCD34D]">d_obj = {fmt(dTarget * 1e3, 3)} mm</span></div>
                <div className="flex justify-between"><span className="text-[#64748B]">medida (vivo)</span><span className="text-white">{fmt(st.dLast * 1e3, 3)} mm</span></div>
              </div>
              <div className="mt-2 text-[10px] text-[#64748B] leading-relaxed">
                Sube <span className="text-[#CBD5E1]">f_disparo</span> → gotas más chicas. Sube <span className="text-[#CBD5E1]">v_f</span> → más grandes. La resonancia hace cada disparo limpio (1 nodo, sin satélites). Piso ~0.2 mm con alambre 0.8 mm.
              </div>
            </Section>

            {audience === 'child' ? (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>La gráfica <span className="text-[#FBBF24]">q(t)</span> es la gota <em>bailando</em>. Cuando la afinas, sube hasta <span className="text-[#F87171]">1</span> y <span className="text-[#86EFAC]">se suelta</span>.</p>
                  <p>La forma 3D es ese mismo número, deformando la esfera. <span className="text-white">No hay truco — es la física.</span></p>
                </div>
              </Section>
            ) : (
              <Section title="Parámetros físicos">
                <Slider label="I₀ [A] (calentar/sesgo)" v={params.I0} min={20} max={90} step={1} on={v => set({ I0: v })} fix={0} />
                <Slider label="I_ac [A] (ripple)" v={params.Iac} min={1} max={24} step={0.5} on={v => set({ Iac: v })} fix={1} />
                <Slider label="R_op [mΩ]" v={params.Rop * 1e3} min={15} max={250} step={1} on={v => set({ Rop: v / 1e3 })} fix={0} />
                <Slider label="v_f [mm/s]" v={params.vf * 1e3} min={0.5} max={8} step={0.1} on={v => set({ vf: v / 1e3 })} fix={1} />
                <Slider label="γ [N/m]" v={params.gamma} min={1.0} max={2.0} step={0.05} on={v => set({ gamma: v })} fix={2} />
                <Slider label="μ [mPa·s]" v={params.mu * 1e3} min={2} max={14} step={0.5} on={v => set({ mu: v / 1e3 })} fix={1} />
                <Slider label="d_alambre [mm]" v={params.dWire * 1e3} min={0.4} max={1.0} step={0.05} on={v => set({ dWire: v / 1e3 })} fix={2} />
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Estado (vivo, de la ODE)">
                <Row label="T"     value={`${fmt(st.T)} °C`} highlight={st.T > 2200} />
                <Row label="f₂"    value={`${fmt(st.f2)} Hz`} />
                <Row label="Q_mec" value={fmt(st.Q)} />
                <Row label="q"     value={fmt(st.q, 3)} highlight={st.q >= 1} />
                <Row label="fL"    value={fmt(st.fL, 2)} />
                <Row label="gotas" value={`${st.drops}`} />
                <div className="mt-2 text-[10px] text-[#64748B]">
                  I_ac mín ≈ I_crit²/(2 Q I₀) = {fmt(194 * 194 / (2 * Math.max(st.Q, 1) * params.I0), 1)} A
                </div>
              </Section>
            )}

            <Section title="Física (lo que integra)">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">q'' + γq' + ω₂²q = ω₂²(I/I_crit)²·fL</div>
                <div>f₂ = √(8γ/ρa³)/2π &nbsp; γ = ω₂/Q</div>
                <div>RK4, ≥4 sub-pasos/frame · pincha en q≥1</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

function Plot({ label, cv, hint }: { label: string; cv: React.RefObject<HTMLCanvasElement | null>; hint: string }) {
  return (
    <div className="rounded-md bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] p-1.5">
      <div className="text-[9px] text-[#94A3B8] font-mono px-0.5 mb-0.5 flex justify-between gap-3">
        <span>{label}</span><span className="text-[#475569]">{hint}</span>
      </div>
      <canvas ref={cv} width={210} height={84} className="block rounded-sm" />
    </div>
  );
}

function drawTrace(cv: HTMLCanvasElement | null, buf: Float32Array, head: number, lo: number, hi: number, color: string, thr?: number, thrColor?: string) {
  if (!cv) return;
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0E1726'; ctx.fillRect(0, 0, W, H);
  if (thr !== undefined) {
    const y = H - (thr - lo) / (hi - lo) * H;
    ctx.strokeStyle = thrColor || '#F87171'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
  }
  const n = buf.length;
  ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const v = buf[(head + i) % n];
    const x = i / (n - 1) * W;
    const y = H - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * H;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}
function drawRes(cv: HTMLCanvasElement | null, s: MetalDropState, p: MetalDropParams) {
  if (!cv) return;
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height, fLo = 300, fHi = 1200, aHi = 2;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0E1726'; ctx.fillRect(0, 0, W, H);
  const y1 = H - 1 / aHi * H;
  ctx.strokeStyle = '#F87171'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(W, y1); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#FB923C'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let x = 0; x <= W; x++) {
    const f = fLo + (fHi - fLo) * x / W;
    const A = Math.min(lorentzAmp(f, s.f2, s.Q, p.I0, p.Iac), aHi);
    const y = H - A / aHi * H;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  const fm = p.track ? s.f2 : p.fdrive;
  const xm = (fm - fLo) / (fHi - fLo) * W;
  ctx.strokeStyle = '#86EFAC'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(xm, 0); ctx.lineTo(xm, H); ctx.stroke();
}

function Scene({ sim }: { sim: React.MutableRefObject<MetalDropState> }) {
  const drop = useRef<THREE.Mesh>(null);
  const dropMat = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.Sprite>(null);
  const bead = useRef<THREE.Mesh>(null);
  const fall = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => makeGlow(), []);
  const geom = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 48, 32);
    g.userData.orig = Float32Array.from(g.attributes.position.array as Float32Array);
    return g;
  }, []);
  const prevDrops = useRef(0);
  const fs = useRef({ active: false, y: TIPY, r: 0.4, col: new THREE.Color('#f90') });

  useFrame(() => {
    const s = sim.current;
    const a = aOf(s.V);
    const baseR = Math.min(Math.max(a * S, 0.05), RMAX);
    const eps = Math.max(-1.1, Math.min(1.1, s.q)) * 0.32;
    const [r, g, b] = tempColor(s.T);

    const pos = geom.attributes.position.array as Float32Array;
    const orig = geom.userData.orig as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const dx = orig[i], dy = orig[i + 1], dz = orig[i + 2];
      const p2 = (3 * dy * dy - 1) / 2;
      const rr = baseR * (1 + eps * p2);
      pos[i] = dx * rr; pos[i + 1] = dy * rr; pos[i + 2] = dz * rr;
    }
    geom.attributes.position.needsUpdate = true;
    geom.computeVertexNormals();

    if (drop.current) drop.current.position.y = TIPY - baseR * 0.92;
    if (dropMat.current) {
      dropMat.current.color.setRGB(r, g, b);
      dropMat.current.emissive.setRGB(r, g, b);
      dropMat.current.emissiveIntensity = Math.max(0.15, Math.min(1.5, (s.T - 700) / 700)) + s.flash * 1.0;
    }
    if (halo.current && drop.current) {
      halo.current.position.copy(drop.current.position);
      const hs = baseR * 1.8;
      halo.current.scale.set(hs, hs, 1);
      const m = halo.current.material as THREE.SpriteMaterial;
      m.color.setRGB(r, g, b); m.opacity = 0.16 + s.flash * 0.3;
    }
    if (bead.current) {
      const h = Math.max(s.beadH * S, 0.04);
      bead.current.scale.y = h; bead.current.position.y = BEAD0 + h / 2;
    }
    if (s.drops !== prevDrops.current) {
      prevDrops.current = s.drops;
      const rEj = Math.min(Math.max(s.dLast / 2 * S, 0.05), RMAX);   // gota eyectada (modulada por f_disparo/v_f)
      fs.current = { active: true, y: drop.current ? drop.current.position.y : TIPY, r: rEj, col: new THREE.Color().setRGB(r, g, b) };
    }
    const f = fs.current, beadTop = BEAD0 + Math.max(s.beadH * S, 0.04);
    if (f.active) { f.y -= 0.13; if (f.y <= beadTop + f.r) f.active = false; }
    if (fall.current) {
      fall.current.visible = f.active; fall.current.position.y = f.y; fall.current.scale.setScalar(f.r);
      const fm = fall.current.material as THREE.MeshStandardMaterial; fm.color.copy(f.col); fm.emissive.copy(f.col);
    }
  });

  return (
    <>
      <mesh position={[0, (TOP + TIPY) / 2, 0]}>
        <cylinderGeometry args={[0.09, 0.09, TOP - TIPY, 18]} />
        <meshStandardMaterial color="#9aa3b2" metalness={0.7} roughness={0.35} emissive="#1a1d24" emissiveIntensity={0.3} />
      </mesh>
      <mesh ref={drop} geometry={geom}>
        <meshStandardMaterial ref={dropMat} metalness={0.15} roughness={0.25} />
      </mesh>
      <sprite ref={halo} scale={[2, 2, 1]}>
        <spriteMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.16} />
      </sprite>
      <mesh ref={fall} visible={false}>
        <sphereGeometry args={[1, 24, 18]} />
        <meshStandardMaterial metalness={0.15} roughness={0.3} emissiveIntensity={1.4} />
      </mesh>
      <mesh ref={bead} position={[0, BEAD0, 0]}>
        <cylinderGeometry args={[0.5, 0.62, 1, 28]} />
        <meshStandardMaterial color="#3a3f4a" metalness={0.6} roughness={0.5} emissive="#1a0f06" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, BEAD0 - 0.18, 0]}>
        <cylinderGeometry args={[2.8, 2.8, 0.35, 44]} />
        <meshStandardMaterial color="#262b34" metalness={0.5} roughness={0.6} />
      </mesh>
      <gridHelper args={[14, 28, '#1E293B', '#152030']} position={[0, BEAD0 - 0.36, 0]} />
    </>
  );
}

function makeGlow() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="p-4 border-b border-[#1E293B]">
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>{children}</div>);
}
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (<div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
    <span className="text-[#64748B]">{label}</span><span className={highlight ? 'text-[#F87171]' : 'text-white'}>{value}</span></div>);
}
function Slider({ label, v, min, max, step, on, fix = 2 }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void; fix?: number }) {
  return (<div className="mb-2">
    <div className="flex items-baseline justify-between text-[11px] font-mono"><span className="text-[#64748B]">{label}</span><span className="text-white">{v.toFixed(fix)}</span></div>
    <input type="range" min={min} max={max} step={step} value={v} onChange={e => on(Number(e.target.value))} className="w-full" /></div>);
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (<button onClick={() => set(!on)} className="w-full flex items-center justify-between text-[12px] mb-2 px-2 py-1.5 rounded-md border border-[#1E293B] hover:border-[#334155]">
    <span className="text-[#CBD5E1]">{label}</span>
    <span className={`w-9 h-5 rounded-full relative transition ${on ? 'bg-[#FB923C]/70' : 'bg-[#1E293B]'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${on ? 'left-4' : 'left-0.5'}`} /></span></button>);
}
function IconBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (<button onClick={onClick} title={title}
    className={`w-9 h-9 rounded-md border text-[14px] flex items-center justify-center transition ${active ? 'border-[#FB923C]/50 text-white bg-[#7C2D12]/30' : 'border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#334155]'}`}>{children}</button>);
}
