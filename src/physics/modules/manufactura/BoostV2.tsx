/**
 * Impresora de metal v2 — SIMULACIÓN COMPLETA con el BOM real (pedido AG 2026-06-09).
 *
 * río 24V → 3 BOMBAS (boost interleaved 120°) → PRESA (banco 120V) → VÁLVULA
 * (choke 50µH + banda 40-60A) → GOTA (ciclo contacto→funde→pincha→arco).
 *
 * Dos osciloscopios: arriba el interleave (el fix del jalón del v1); abajo la
 * corriente de descarga BAILANDO en la banda de histéresis — la válvula que
 * salva al IRF640 del corto líquido (80A/µs → 2.4A/µs). El muro de Holm es una
 * PERILLA: sube R de contacto y mira dónde deja de fundir (424Ω a 120V).
 * Motor puro: boostV2.ts (gemelo de scripts/v2-sim-final.py).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import {
  BV2_DEFAULTS, bv2Reset, bv2Step,
  iPhaseAt, iInputAt, ipkReal, rMaxMelt, melts,
  P_LOSS, I_FET_MAX,
  type BV2Params, type BV2State, type DropPhase,
} from '@/lib/physics/boostV2';

const PHCOL = ['#FB923C', '#38BDF8', '#4ADE80'];
const DCOL: Record<DropPhase, string> = {
  contacto: '#67E8F9', funde: '#FB923C', pincha: '#F87171', arco: '#A78BFA',
};
const DTXT: Record<DropPhase, string> = {
  contacto: 'CONTACTO (muro de Holm)', funde: 'FUNDE (Rj colapsa)',
  pincha: 'PINCHA (banda 40-60A)', arco: 'ARCO (gota suelta)',
};

interface BLesson { presetId: string; }
const LESSON: Lesson<BLesson> = {
  hook: {
    title: 'Río → 3 bombas → presa → válvula → gota.',
    body: `Las 3 bobinas NO son tanques: son BOMBAS de cucharadas (½LI²≈0.7mJ) que avientan energía del río de 24V a la presa de 120V, cien mil veces por segundo, turnándose a 120° (por eso la fuente ya no siente el jalón del v1).

La PRESA (banco de caps) guarda 47 J — 66,000 cucharadas — y aguanta el gotazo cayendo solo ~9V (el v1 colapsaba 42→12V). La VÁLVULA (choke, tu 4ª bobina) domestica el corto líquido: sin ella 80A/µs matan al IRF640 (72A) antes de la 1ª lectura del ADC; con ella la corriente BAILA atrapada en la banda 40-60A (mírala abajo).

Y el MURO DE HOLM cae: funde ⟺ V²/R > 34W. A 51V (v1) el límite era 76Ω — tu contacto de 15-18Ω quedaba en el filo. A 120V funde hasta 424Ω. Sube la perilla "R contacto" y encuentra el muro.`,
  },
  steps: [
    { title: 'El ciclo de la gota', duration: 8000,
      body: 'CONTACTO: 923W contra el muro (15.6Ω). FUNDE: el puente se vuelve líquido, Rj colapsa a ~1.2Ω y la corriente sube — la banda la atrapa. PINCHA: 50A planos estrangulan ∝i². ARCO: la gota cae, el choke se vacía por Df. Repite ~30/s.',
      formula: 'funde ⟺ V²/Rj > 34W · di/dt = (V−iR)/L · banda: ON<40A, OFF>60A',
      keyframes: [{ at: 0, state: { presetId: 'run' } }] },
  ],
  connect: {
    body: 'Todo es UNA ecuación: V = L·di/dt. En las bombas, L chica (10µH) para cucharear rápido; en la válvula, L grande (50µH) para que el corto no corra. El freewheel por Df sigue CALENTANDO la junta mientras Qd descansa — la energía nunca se tira, recircula (Operador 𝔄: lo único que se gasta es lo que cae en R = el calor que funde). Números gemelos: scripts/v2-sim-final.py.',
    links: [],
  },
};

const fmt = (x: number, d = 0) => (isFinite(x) ? x.toFixed(d) : '∞');

export default function BoostV2() {
  const { audience } = useAudience();
  const [params, setParams] = useState<BV2Params>({ ...BV2_DEFAULTS });
  const [running, setRunning] = useState(true);
  const [slow, setSlow] = useState(true);
  const sim = useRef<BV2State>(bv2Reset(BV2_DEFAULTS));
  const trace = useRef<Float32Array>(new Float32Array(600));   // ventana ~4.8ms
  const traceIdx = useRef(0);
  const paramsRef = useRef(params); useEffect(() => { paramsRef.current = params; }, [params]);
  const slowRef = useRef(slow); useEffect(() => { slowRef.current = slow; }, [slow]);
  const set = (patch: Partial<BV2Params>) => setParams(p => ({ ...p, ...patch }));
  const reset = () => { sim.current = bv2Reset(paramsRef.current); traceIdx.current = 0; trace.current.fill(0); };

  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0, lastUi = 0, lastT = performance.now();
    const buf: number[] = [];
    const tick = () => {
      const now = performance.now();
      const dtReal = Math.min((now - lastT) / 1000, 0.033); lastT = now;
      const simDt = dtReal * (slowRef.current ? 0.05 : 1.0);
      buf.length = 0;
      sim.current = bv2Step(sim.current, paramsRef.current, simDt, buf);
      // decimar ×4 (muestra cada 8µs) al ring del scope de descarga
      for (let i = 0; i < buf.length; i += 4) {
        trace.current[traceIdx.current % trace.current.length] = buf[i];
        traceIdx.current++;
      }
      if (now - lastUi > 80) { force(x => x + 1); lastUi = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const st = sim.current;
  const wallOk = melts(params.Vtarget, params.Rholm);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={14} bloomIntensity={1.1} bloomThreshold={0.12}>
          <Scene sim={sim} paramsRef={paramsRef} trace={trace} traceIdx={traceIdx} />
        </Stage>

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/75 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">presa&nbsp;</span>= <span style={{ color: '#FB923C' }}>{fmt(st.Vbus)} V</span> · η {fmt(st.eta * 100)}%</div>
          <div><span className="text-[#64748B]">bombas</span>= {fmt(st.Pout)} W · rizo <span style={{ color: st.ripple > 120 ? '#F87171' : '#4ADE80' }}>{fmt(st.ripple)}%</span></div>
          <div><span className="text-[#64748B]">gota&nbsp;&nbsp;</span>= <span style={{ color: DCOL[st.dphase] }}>{DTXT[st.dphase]}</span></div>
          <div><span className="text-[#64748B]">junta&nbsp;</span>= {fmt(st.idisch, 1)} A · {fmt(st.Rj, 1)} Ω · {fmt(st.Pj)} W</div>
          <div><span className="text-[#64748B]">gotas&nbsp;</span>= {st.drops}</div>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setSlow(s => !s)} active={slow} title="cámara lenta ×0.05">🐌</IconBtn>
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={reset} title="Reiniciar">↺</IconBtn>
        </div>
        <div className="absolute bottom-4 left-4 text-[10px] font-mono text-[#64748B] bg-[#0B0F17]/70 rounded px-2 py-1">
          arriba: <span style={{ color: PHCOL[0] }}>L1</span> <span style={{ color: PHCOL[1] }}>L2</span> <span style={{ color: PHCOL[2] }}>L3</span> <span className="text-white">Σ</span> (bombas a 120°) · abajo: corriente de la gota en la <span className="text-[#38BDF8]">banda 40-60A</span> · <span className="text-[#F87171]">72A = muere el IRF640</span>
        </div>
      </div>

      <LessonPanel<BLesson>
        lesson={LESSON}
        onApplyState={() => {}}
        sandbox={
          <>
            <Section title="Bombas (boost)">
              <div className="flex gap-1.5 mb-2">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => set({ nph: n })}
                    className={`flex-1 text-[12px] py-1.5 rounded-md border transition ${params.nph === n ? 'border-[#FB923C]/60 text-white bg-[#FB923C]/15' : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155]'}`}>
                    {n} {n === 1 ? 'bomba' : 'bombas'}
                  </button>
                ))}
              </div>
              <Slider label="Duty D" v={params.duty} min={0.1} max={0.75} step={0.01} on={v => set({ duty: v })} fix={2} />
              <Slider label="Presa objetivo [V]" v={params.Vtarget} min={40} max={140} step={5} on={v => set({ Vtarget: v })} fix={0} />
              <div className="text-[10.5px] text-[#64748B] font-mono">Ipk real {fmt(ipkReal(params), 1)}A (RL) · IRF640N + RA-.1E + MUR1560</div>
            </Section>
            <Section title="La junta (el muro de Holm)">
              <Slider label="R contacto [Ω]" v={params.Rholm} min={5} max={500} step={5} on={v => set({ Rholm: v })} fix={0} />
              <div className="text-[11px] font-mono mb-1" style={{ color: wallOk ? '#4ADE80' : '#F87171' }}>
                {wallOk ? `FUNDE — ${fmt(params.Vtarget ** 2 / params.Rholm)}W > ${P_LOSS}W` : `NO FUNDE — el muro gana (límite ${fmt(rMaxMelt(params.Vtarget))}Ω)`}
              </div>
              <Toggle label="Descarga activa" on={params.discharge} set={v => set({ discharge: v })} />
            </Section>
            <Section title="Válvula (choke + banda)">
              <Slider label="Banda baja Ilo [A]" v={params.Ilo} min={20} max={params.Ihi - 5} step={1} on={v => set({ Ilo: v })} fix={0} />
              <Slider label="Banda alta Ihi [A]" v={params.Ihi} min={params.Ilo + 5} max={70} step={1} on={v => set({ Ihi: v })} fix={0} />
              <div className="text-[10.5px] text-[#64748B] font-mono">choke 50µH (tu 4ª bobina: 2 capas ≈ 48 vueltas) · sin él: 80A/µs ☠</div>
            </Section>
            {audience === 'child' ? (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>Tres <span className="text-[#FB923C]">bombas</span> llenan la <span className="text-[#FB923C]">presa</span> a cucharadas, turnándose.</p>
                  <p>La <span className="text-[#38BDF8]">válvula</span> deja pasar el chorro justo para fundir la punta del alambre y soltar una <span className="text-[#F87171]">gota</span> de metal. ¡Mira la corriente bailar entre las dos líneas!</p>
                </div>
              </Section>
            ) : (
              <Section title="Estado (vivo)">
                <Row label="Vbus" value={`${fmt(st.Vbus)} V`} />
                <Row label="η boost" value={`${fmt(st.eta * 100)} %`} />
                <Row label="fase gota" value={st.dphase} />
                <Row label="i junta" value={`${fmt(st.idisch, 1)} A`} />
                <Row label="R junta" value={`${fmt(st.Rj, 1)} Ω`} />
                <Row label="E gota" value={`${fmt(st.Edrop, 1)} J / 3.6`} />
                <Row label="gotas" value={`${st.drops}`} />
              </Section>
            )}
            <Section title="Física">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">V = L·di/dt — bombas Y válvula</div>
                <div>funde ⟺ V²/Rj &gt; 34W (muro: 424Ω@120V)</div>
                <div>Ipk = (Vin/R)(1−e^(−t/τ)) · banda 40-60A</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─────────────────────────── ESCENA 3D ───────────────────────────
const SC1 = { x0: -5.2, x1: 5.2, y0: 2.0, yH: 2.2, periods: 2.5, n: 200, fs: 40 };  // bombas
const SC2 = { x0: -5.2, x1: 5.2, y0: -1.0, yH: 1.9, iMax: 78, n: 600 };             // gota
const ROWY = -3.7, CHX = 0.7, BUSX = 2.7, DROPX = 4.7;

function curveGeom(n: number) {
  const arr = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return { g, arr };
}
function hline(x0: number, x1: number, y: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, 0, x1, y, 0], 3));
  return g;
}

function Scene({ sim, paramsRef, trace, traceIdx }: {
  sim: React.MutableRefObject<BV2State>;
  paramsRef: React.MutableRefObject<BV2Params>;
  trace: React.MutableRefObject<Float32Array>;
  traceIdx: React.MutableRefObject<number>;
}) {
  const scroll = useRef(0);
  const coils = useRef<(THREE.MeshStandardMaterial | null)[]>([null, null, null, null]);
  const busFill = useRef<THREE.Mesh>(null);
  const busMat = useRef<THREE.MeshStandardMaterial>(null);
  const drop = useRef<THREE.Mesh>(null);
  const arc = useRef<THREE.Mesh>(null);
  const falling = useRef<THREE.Mesh>(null);
  const prevDrops = useRef(0);
  const fallT = useRef(-1);

  const curves = useMemo(() => [0, 1, 2, 3].map(() => curveGeom(SC1.n)), []);
  const dCurve = useMemo(() => curveGeom(SC2.n), []);
  const base1 = useMemo(() => hline(SC1.x0, SC1.x1, SC1.y0), []);
  const base2 = useMemo(() => hline(SC2.x0, SC2.x1, SC2.y0), []);
  const bandLo = useMemo(() => hline(SC2.x0, SC2.x1, SC2.y0), []);
  const bandHi = useMemo(() => hline(SC2.x0, SC2.x1, SC2.y0), []);
  const lineFet = useMemo(() => hline(SC2.x0, SC2.x1, SC2.y0 + (I_FET_MAX / SC2.iMax) * SC2.yH), []);
  const coilCurves = useMemo(() => [
    solenoid(-4.6, ROWY, 6, 0.32, 1.3), solenoid(-3.1, ROWY, 6, 0.32, 1.3),
    solenoid(-1.6, ROWY, 6, 0.32, 1.3), solenoid(CHX, ROWY, 9, 0.46, 1.5),
  ], []);

  useFrame((_, dtr) => {
    const s = sim.current, p = paramsRef.current;
    const dt = Math.min(dtr, 0.05);
    scroll.current = (scroll.current + dt * 0.5) % 1;
    const dutyEff = Math.max(s.dutyEff, 1e-3), Vbus = s.Vbus;

    // ── scope 1: bombas interleaved ──
    for (let ci = 0; ci < 4; ci++) {
      const { g, arr } = curves[ci];
      const draw = ci === 3 || ci < p.nph;
      for (let j = 0; j < SC1.n; j++) {
        const u = j / (SC1.n - 1);
        const phi = scroll.current + u * SC1.periods;
        const cur = ci === 3 ? iInputAt(phi, p, Vbus, dutyEff) : iPhaseAt(phi, p, Vbus, ci, dutyEff);
        arr[j * 3] = SC1.x0 + (SC1.x1 - SC1.x0) * u;
        arr[j * 3 + 1] = SC1.y0 + (draw ? (cur / SC1.fs) * SC1.yH : 0);
        arr[j * 3 + 2] = ci === 3 ? 0.05 : 0;
      }
      g.attributes.position.needsUpdate = true;
      g.computeBoundingSphere();
    }

    // ── scope 2: la gota en la banda (ring buffer) ──
    {
      const { g, arr } = dCurve;
      const N = trace.current.length;
      const head = traceIdx.current % N;
      for (let j = 0; j < SC2.n; j++) {
        const idx = (head + j) % N;
        const i = trace.current[idx];
        arr[j * 3] = SC2.x0 + (SC2.x1 - SC2.x0) * (j / (SC2.n - 1));
        arr[j * 3 + 1] = SC2.y0 + Math.min(i / SC2.iMax, 1) * SC2.yH;
        arr[j * 3 + 2] = 0.05;
      }
      g.attributes.position.needsUpdate = true;
      g.computeBoundingSphere();
      // líneas de banda siguen las perillas
      (bandLo.attributes.position.array as Float32Array)[1] =
        (bandLo.attributes.position.array as Float32Array)[4] = SC2.y0 + (p.Ilo / SC2.iMax) * SC2.yH;
      (bandHi.attributes.position.array as Float32Array)[1] =
        (bandHi.attributes.position.array as Float32Array)[4] = SC2.y0 + (p.Ihi / SC2.iMax) * SC2.yH;
      bandLo.attributes.position.needsUpdate = true;
      bandHi.attributes.position.needsUpdate = true;
    }

    // ── bombas: glow ∝ corriente; choke ∝ idisch ──
    const ipkNow = Math.max(ipkReal(p, dutyEff), 1);
    for (let k = 0; k < 3; k++) {
      const m = coils.current[k]; if (!m) continue;
      const on = k < p.nph;
      m.emissiveIntensity = on ? 0.15 + 2.2 * Math.min(Math.abs(s.iL[k]) / ipkNow, 1) : 0.04;
    }
    const mc = coils.current[3];
    if (mc) mc.emissiveIntensity = 0.12 + 2.0 * Math.min(s.idisch / 70, 1);

    // ── presa ──
    if (busFill.current) {
      const f = Math.min(Vbus / Math.max(p.Vtarget, 1), 1);
      busFill.current.scale.y = Math.max(f, 0.02);
      busFill.current.position.y = ROWY - 1.0 + (f * 2.0) / 2;
    }
    if (busMat.current) busMat.current.emissiveIntensity = 0.3 + 1.4 * Math.min(Vbus / 140, 1);

    // ── junta: gota pendiente + arco + gota cayendo ──
    if (drop.current) {
      const mat = drop.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.35 + 2.8 * s.heat;
      const wob = s.dphase === 'pincha' ? 0.06 * Math.sin(s.t * 9000) : 0;
      drop.current.scale.setScalar(0.26 + 0.14 * Math.min(s.Edrop / 3.6, 1) + wob);
      const c = DCOL[s.dphase];
      mat.emissive.set(c);
    }
    if (arc.current) {
      (arc.current.material as THREE.MeshBasicMaterial).opacity =
        s.dphase === 'arco' ? 0.8 : (s.qdOn && s.dphase !== 'contacto' ? 0.25 : 0);
    }
    if (s.drops !== prevDrops.current) { prevDrops.current = s.drops; fallT.current = 0; }
    if (falling.current) {
      if (fallT.current >= 0) {
        fallT.current += dt;
        const tt = fallT.current / 0.5;
        falling.current.visible = tt < 1;
        falling.current.position.y = ROWY - 0.55 - tt * 0.8;
        if (tt >= 1) fallT.current = -1;
      } else falling.current.visible = false;
    }
  });

  return (
    <>
      {/* paneles de los 2 scopes */}
      <mesh position={[(SC1.x0 + SC1.x1) / 2, SC1.y0 + SC1.yH * 0.45, -0.25]}>
        <planeGeometry args={[SC1.x1 - SC1.x0 + 0.7, SC1.yH + 1.2]} />
        <meshBasicMaterial color="#0A0E16" transparent opacity={0.82} toneMapped={false} />
      </mesh>
      <mesh position={[(SC2.x0 + SC2.x1) / 2, SC2.y0 + SC2.yH * 0.5, -0.25]}>
        <planeGeometry args={[SC2.x1 - SC2.x0 + 0.7, SC2.yH + 0.9]} />
        <meshBasicMaterial color="#0A0E16" transparent opacity={0.82} toneMapped={false} />
      </mesh>

      <line><primitive object={base1} attach="geometry" /><lineBasicMaterial color="#1E293B" toneMapped={false} /></line>
      <line><primitive object={base2} attach="geometry" /><lineBasicMaterial color="#1E293B" toneMapped={false} /></line>
      {curves.map((c, i) => (
        <line key={i}>
          <primitive object={c.g} attach="geometry" />
          <lineBasicMaterial color={i === 3 ? '#FFFFFF' : PHCOL[i]} toneMapped={false} transparent opacity={i === 3 ? 1 : 0.95} />
        </line>
      ))}
      {/* scope de la gota: traza + banda + línea de la muerte */}
      <line><primitive object={dCurve.g} attach="geometry" /><lineBasicMaterial color="#FFD27D" toneMapped={false} /></line>
      <line><primitive object={bandLo} attach="geometry" /><lineBasicMaterial color="#38BDF8" transparent opacity={0.55} toneMapped={false} /></line>
      <line><primitive object={bandHi} attach="geometry" /><lineBasicMaterial color="#38BDF8" transparent opacity={0.55} toneMapped={false} /></line>
      <line><primitive object={lineFet} attach="geometry" /><lineBasicMaterial color="#F87171" transparent opacity={0.6} toneMapped={false} /></line>

      {/* 3 bombas + válvula (choke) */}
      {coilCurves.map((cv, k) => (
        <mesh key={k}>
          <tubeGeometry args={[cv, 130, k === 3 ? 0.07 : 0.055, 7, false]} />
          <meshStandardMaterial ref={el => { coils.current[k] = el; }}
            color={k === 3 ? '#A78BFA' : PHCOL[k]} emissive={k === 3 ? '#A78BFA' : PHCOL[k]}
            emissiveIntensity={0.1} metalness={0.55} roughness={0.35} toneMapped={false} />
        </mesh>
      ))}

      {/* presa */}
      <mesh position={[BUSX, ROWY, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 2.1, 28, 1, true]} />
        <meshStandardMaterial color="#1B2433" metalness={0.3} roughness={0.5} transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={busFill} position={[BUSX, ROWY - 1.0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 2.0, 24]} />
        <meshStandardMaterial ref={busMat} color="#FFB454" emissive="#FB923C" emissiveIntensity={0.5} metalness={0.2} roughness={0.4} toneMapped={false} />
      </mesh>

      {/* riel presa → válvula → junta */}
      <mesh position={[(BUSX + DROPX) / 2, ROWY + 0.95, 0]}>
        <boxGeometry args={[DROPX - BUSX + 0.6, 0.04, 0.04]} />
        <meshStandardMaterial color="#FB923C" emissive="#FB923C" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>

      {/* junta: arco + gota pendiente + gota cayendo + sustrato */}
      <mesh ref={arc} position={[DROPX, ROWY - 0.15, 0]}>
        <cylinderGeometry args={[0.04, 0.10, 0.45, 8]} />
        <meshBasicMaterial color="#EAF6FF" transparent opacity={0} toneMapped={false} />
      </mesh>
      <mesh ref={drop} position={[DROPX, ROWY - 0.5, 0]}>
        <sphereGeometry args={[1, 22, 16]} />
        <meshStandardMaterial color="#FFE08A" emissive="#FB923C" emissiveIntensity={0.6} metalness={0.2} roughness={0.3} toneMapped={false} />
      </mesh>
      <mesh ref={falling} visible={false} position={[DROPX, ROWY - 0.55, 0]}>
        <sphereGeometry args={[0.12, 14, 10]} />
        <meshBasicMaterial color="#FFD27D" toneMapped={false} />
      </mesh>
      <mesh position={[DROPX, ROWY - 1.15, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.18, 28]} />
        <meshStandardMaterial color="#23282F" metalness={0.5} roughness={0.6} />
      </mesh>
    </>
  );
}

function solenoid(cx: number, cy: number, turns: number, r: number, h: number) {
  const pts: THREE.Vector3[] = [];
  const N = 100;
  for (let k = 0; k <= N; k++) {
    const t = k / N, a = 2 * Math.PI * turns * t;
    pts.push(new THREE.Vector3(cx + r * Math.cos(a), cy - h / 2 + h * t, r * Math.sin(a)));
  }
  return new THREE.CatmullRomCurve3(pts);
}

// ── helpers UI ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="p-4 border-b border-[#1E293B]"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>{children}</div>);
}
function Row({ label, value }: { label: string; value: string }) {
  return (<div className="flex items-baseline justify-between text-[11px] font-mono py-0.5"><span className="text-[#64748B]">{label}</span><span className="text-white">{value}</span></div>);
}
function Slider({ label, v, min, max, step, on, fix = 0 }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void; fix?: number }) {
  return (<div className="mb-2"><div className="flex items-baseline justify-between text-[11px] font-mono"><span className="text-[#64748B]">{label}</span><span className="text-white">{v.toFixed(fix)}</span></div>
    <input type="range" min={min} max={max} step={step} value={v} onChange={e => on(Number(e.target.value))} className="w-full" /></div>);
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (<button onClick={() => set(!on)} className="w-full flex items-center justify-between text-[12px] mb-2 px-2 py-1.5 rounded-md border border-[#1E293B] hover:border-[#334155]">
    <span className="text-[#CBD5E1]">{label}</span><span className={`w-9 h-5 rounded-full relative transition ${on ? 'bg-[#FB923C]/70' : 'bg-[#1E293B]'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${on ? 'left-4' : 'left-0.5'}`} /></span></button>);
}
function IconBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (<button onClick={onClick} title={title} className={`w-9 h-9 rounded-md border text-[14px] flex items-center justify-center transition ${active ? 'border-[#FB923C]/50 text-white bg-[#FB923C]/20' : 'border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#334155]'}`}>{children}</button>);
}
