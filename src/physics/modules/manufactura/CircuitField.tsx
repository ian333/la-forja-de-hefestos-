/**
 * Circuito + Campo Magnético del LATIGAZO — SIMULACIÓN.
 *
 * El latigazo (corto-circuito controlado, circuitField.ts) da i(t). El campo B
 * se calcula por BIOT-SAVART de la geometría real (choque + alambre): como B es
 * lineal en la corriente, B(r,t) = i(t)·B_unit(r) → precomputo B_unit UNA vez y
 * escalo por i(t) cada frame. Las flechas son el campo REAL pulsando con la
 * corriente; en el choque vive la energía recirculante ½Li². Todo de números.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import {
  cfReset, cfStep, fieldEnergy, bSurface, MU0_CONST,
  type CFParams, type CFState,
} from '@/lib/physics/circuitField';

const STEP_SIM = 8e-5, DT_INT = 2e-6;   // tiempo de sim/frame (latigazo visible ~1.6/s)

interface CFLesson { presetId: string; }
const LESSON: Lesson<CFLesson> = {
  hook: {
    title: 'El campo magnético: ahí vive la energía que recircula.',
    body: `La corriente del latigazo no solo calienta — genera un CAMPO MAGNÉTICO. En el choque (la bobina) ese campo guarda la energía ½Li² que recircula; alrededor del alambre forma anillos (B=μ0·i/2πr) cuya presión es el PINCH que estrangula la gota.

Aquí el campo es real (Biot-Savart de la geometría) y PULSA con la corriente: mira cómo crece en el corto, revienta en el pinch y colapsa en el arco. Donde las flechas son más densas y largas, más energía magnética.`,
  },
  steps: [
    { title: 'El latigazo respira', duration: 6000,
      body: 'En el CORTO la corriente rampa → el campo crece (flechas largas). Al formarse el cuello, el pinch (B²/2μ0) estrangula. Revienta → arco → el campo colapsa. Repite.',
      formula: 'B(r) = (μ0/4π) ∮ i dl×r̂/r²   ·   E_campo = ½ L i²   ·   pinch ∝ i²',
      keyframes: [{ at: 0, state: { presetId: 'run' } }] },
  ],
  connect: {
    body: 'Es el Operador 𝔄 en su forma más pura: el campo es la cara-i del espacio (Biot-Savart = la función de Green de Maxwell). La energía recircula en el campo del choque (magnético) ↔ el capacitor (eléctrico). Lo que se gasta es solo lo que cae en R = el calor que funde.',
    links: [],
  },
};

const fmt = (x: number, d = 0) => isFinite(x) ? x.toFixed(d) : '∞';

export default function CircuitField() {
  const { audience } = useAudience();
  const [params, setParams] = useState<CFParams>({ Vsrc: 22, L: 50e-6, control: true, Rcut: 2e-3 });
  const [running, setRunning] = useState(true);
  const sim = useRef<CFState>(cfReset());
  const paramsRef = useRef(params); useEffect(() => { paramsRef.current = params; }, [params]);
  const set = (patch: Partial<CFParams>) => setParams(p => ({ ...p, ...patch }));
  const reset = () => { sim.current = cfReset(); };

  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0, lastUi = 0;
    const tick = () => {
      const N = Math.max(8, Math.ceil(STEP_SIM / DT_INT)); const h = STEP_SIM / N;
      for (let k = 0; k < N; k++) sim.current = cfStep(sim.current, paramsRef.current, h);
      const now = performance.now();
      if (now - lastUi > 90) { force(x => x + 1); lastUi = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const st = sim.current;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={11} autoRotate bloomIntensity={1.0} bloomThreshold={0.1}>
          <Scene sim={sim} />
        </Stage>

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/75 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">i&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span style={{ color: st.i > 250 ? '#FDBA74' : '#67E8F9' }}>{fmt(st.i)} A</span></div>
          <div><span className="text-[#64748B]">fase&nbsp;</span>= {st.phase}</div>
          <div><span className="text-[#64748B]">B_sup</span>= {fmt(bSurface(st.i) * 1e3, 0)} mT</div>
          <div><span className="text-[#64748B]">E_campo</span>= {fmt(fieldEnergy(st.i, params.L) * 1e3, 1)} mJ</div>
          <div><span className="text-[#64748B]">gotas</span>= {st.drops}</div>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={reset} title="Reiniciar">↺</IconBtn>
        </div>
        <div className="absolute bottom-4 left-4 text-[10px] font-mono text-[#64748B] bg-[#0B0F17]/70 rounded px-2 py-1">
          flechas = campo B (Biot-Savart) · choque = ½Li² · anillos = pinch
        </div>
      </div>

      <LessonPanel<CFLesson>
        lesson={LESSON}
        onApplyState={() => {}}
        sandbox={
          <>
            <Section title="Circuito">
              <Toggle label="Control (cortar al cuello)" on={params.control} set={v => set({ control: v })} />
              <Slider label="V fuente [V]" v={params.Vsrc} min={8} max={40} step={1} on={v => set({ Vsrc: v })} fix={0} />
              <Slider label="L choque [µH]" v={params.L * 1e6} min={5} max={150} step={5} on={v => set({ L: v / 1e6 })} fix={0} />
            </Section>
            {audience === 'child' ? (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>La corriente hace un <span className="text-[#67E8F9]">campo magnético</span> (las flechas). Cuanto más corriente, más grande el campo.</p>
                  <p>En la bobina se <em>guarda</em> la energía; alrededor del alambre los anillos <span className="text-[#FB923C]">aprietan</span> la gota (pinch).</p>
                </div>
              </Section>
            ) : (
              <Section title="Estado (vivo)">
                <Row label="i" value={`${fmt(st.i)} A`} />
                <Row label="fase" value={st.phase} />
                <Row label="B superficie" value={`${fmt(bSurface(st.i) * 1e3)} mT`} />
                <Row label="E_campo ½Li²" value={`${fmt(fieldEnergy(st.i, params.L) * 1e3, 1)} mJ`} />
                <Row label="gotas" value={`${st.drops}`} />
              </Section>
            )}
            <Section title="Física">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">B = (μ0/4π) ∮ i dl×r̂/r²</div>
                <div>B(r,t) = i(t)·B_unit(r)  (B_unit precomputado)</div>
                <div>E_campo = ½Li² · pinch ∝ i²</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── geometría del circuito ───
const COIL_Y0 = 0.6, COIL_Y1 = 3.0, COIL_R = 1.4, COIL_TURNS = 5;
const JUNC_Y = -2.6;

function coilPoints(n = 160) {
  const p: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = 2 * Math.PI * COIL_TURNS * t, y = COIL_Y0 + (COIL_Y1 - COIL_Y0) * t;
    p.push(new THREE.Vector3(COIL_R * Math.cos(a), y, COIL_R * Math.sin(a)));
  }
  return p;
}
function wirePoints(n = 24) {
  const p: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) { const t = k / n; p.push(new THREE.Vector3(0, COIL_Y0 + (JUNC_Y - COIL_Y0) * t, 0)); }
  return p;
}

function Scene({ sim }: { sim: React.MutableRefObject<CFState> }) {
  const arrows = useRef<THREE.InstancedMesh>(null);
  const coilMat = useRef<THREE.MeshStandardMaterial>(null);
  const wireMat = useRef<THREE.MeshStandardMaterial>(null);
  const drop = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  // geometría + Biot-Savart (UNA vez)
  const { coilCurve, wireCurve, field } = useMemo(() => {
    const cp = coilPoints(), wp = wirePoints();
    // segmentos (mid, dl) de TODO el camino de corriente
    const segs: { mx: number; my: number; mz: number; dx: number; dy: number; dz: number }[] = [];
    const addSegs = (pts: THREE.Vector3[]) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        segs.push({ mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, mz: (a.z + b.z) / 2, dx: b.x - a.x, dy: b.y - a.y, dz: b.z - a.z });
      }
    };
    addSegs(cp); addSegs(wp);
    const C = 1e-7;  // μ0/4π
    const pos: number[] = [], quat: number[] = [], mag: number[] = [];
    const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
    for (let ix = -3; ix <= 3; ix++) for (let iy = -3; iy <= 4; iy++) for (let iz = -3; iz <= 3; iz++) {
      const x = ix * 0.95, y = iy * 0.85 + 0.3, z = iz * 0.95;
      if (x * x + z * z < 0.3 && y < COIL_Y0 + 0.1 && y > JUNC_Y - 0.1) continue; // junto al alambre (singular)
      let bx = 0, by = 0, bz = 0;
      for (const s of segs) {
        const rx = x - s.mx, ry = y - s.my, rz = z - s.mz;
        const r2 = rx * rx + ry * ry + rz * rz; if (r2 < 0.04) continue;
        const inv = C / (r2 * Math.sqrt(r2));
        bx += (s.dy * rz - s.dz * ry) * inv;
        by += (s.dz * rx - s.dx * rz) * inv;
        bz += (s.dx * ry - s.dy * rx) * inv;
      }
      const m = Math.hypot(bx, by, bz); if (m < 1e-9 || m > 5e-5) continue;
      dir.set(bx / m, by / m, bz / m); q.setFromUnitVectors(up, dir);
      pos.push(x, y, z); quat.push(q.x, q.y, q.z, q.w); mag.push(m);
    }
    return {
      coilCurve: new THREE.CatmullRomCurve3(cp),
      wireCurve: new THREE.CatmullRomCurve3(wp),
      field: { pos: new Float32Array(pos), quat: new Float32Array(quat), mag: new Float32Array(mag), n: mag.length },
    };
  }, []);

  useFrame(() => {
    const s = sim.current, m = arrows.current; if (!m) return;
    const i = s.i, n = field.n;
    const glow = Math.min(i / 300, 1.4);
    for (let a = 0; a < n; a++) {
      const mg = field.mag[a];
      const len = 0.18 + 0.9 * Math.tanh(i * mg * 9e3);   // longitud ∝ i·|B| (satura)
      dummy.position.set(field.pos[a * 3], field.pos[a * 3 + 1], field.pos[a * 3 + 2]);
      dummy.quaternion.set(field.quat[a * 4], field.quat[a * 4 + 1], field.quat[a * 4 + 2], field.quat[a * 4 + 3]);
      dummy.scale.set(0.6, len, 0.6);
      dummy.updateMatrix(); m.setMatrixAt(a, dummy.matrix);
      const u = Math.min(Math.tanh(i * mg * 9e3), 1);
      col.setRGB(0.25 + 0.7 * u, 0.55 + 0.3 * u, 1.0 - 0.3 * u);  // azul→cyan→blanco
      m.setColorAt(a, col);
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    // glow del circuito ∝ corriente
    if (coilMat.current) coilMat.current.emissiveIntensity = 0.2 + glow;
    if (wireMat.current) wireMat.current.emissiveIntensity = 0.2 + glow * 1.2;
    if (drop.current) {
      const hot = s.phase === 'cuello' ? 1 : 0.4;
      (drop.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + glow * hot;
      const sc = 0.28 + (s.phase === 'cuello' ? 0.10 * Math.sin(s.t * 400) : 0);
      drop.current.scale.setScalar(Math.max(sc, 0.18));
    }
  });

  return (
    <>
      <instancedMesh ref={arrows} args={[undefined, undefined, field.n]} frustumCulled={false}>
        <coneGeometry args={[0.07, 0.32, 7]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* choque (bobina) */}
      <mesh>
        <tubeGeometry args={[coilCurve, 200, 0.07, 8, false]} />
        <meshStandardMaterial ref={coilMat} color="#67E8F9" emissive="#22D3EE" emissiveIntensity={0.4} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* alambre a la junta */}
      <mesh>
        <tubeGeometry args={[wireCurve, 24, 0.05, 8, false]} />
        <meshStandardMaterial ref={wireMat} color="#FB923C" emissive="#FB923C" emissiveIntensity={0.4} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* gota / junta */}
      <mesh ref={drop} position={[0, JUNC_Y, 0]}>
        <sphereGeometry args={[1, 24, 18]} />
        <meshStandardMaterial color="#FFE08A" emissive="#FB923C" emissiveIntensity={0.8} metalness={0.2} roughness={0.3} />
      </mesh>
      {/* sustrato */}
      <mesh position={[0, JUNC_Y - 0.5, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.3, 36]} />
        <meshStandardMaterial color="#262b34" metalness={0.5} roughness={0.6} />
      </mesh>
    </>
  );
}

// ── helpers ──
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
    <span className="text-[#CBD5E1]">{label}</span><span className={`w-9 h-5 rounded-full relative transition ${on ? 'bg-[#22D3EE]/70' : 'bg-[#1E293B]'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${on ? 'left-4' : 'left-0.5'}`} /></span></button>);
}
function IconBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (<button onClick={onClick} title={title} className={`w-9 h-9 rounded-md border text-[14px] flex items-center justify-center transition ${active ? 'border-[#22D3EE]/50 text-white bg-[#0e7490]/30' : 'border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#334155]'}`}>{children}</button>);
}
