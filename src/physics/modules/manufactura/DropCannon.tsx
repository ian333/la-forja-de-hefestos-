/**
 * Cañón de gotas — la gota ES su propio campo.
 *
 * Auto-pinch (J×B sin bobina): la corriente I(t) lleva f₂ (pinch l=2) y f₃
 * (pera l=3). DOS frecuencias -> la gota se deforma, apunta y dispara.
 * El patrón sale de Fourier: circulo=1 tono, cuadrado=impares.
 * Valores reales del lab 2026-06-06.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import {
  cStep, cReset, P2, P3, patPos3D, patTotal, patLayer,
  type CParams, type CState, type DepDrop,
  CANNON_DEFAULTS,
} from '@/lib/physics/dropCannon';

const STEP_SIM = 2.5e-4;
const DT_INT = 2e-5;
const BUF = 320;
const MAX_DROPS = 2000;
const SUBS_Y = -0.3;
const DROP_VR = 1.2, DEP_R = 0.22, MAX_FLY = 12;
const HEAD_GAP = 1.4;   // el cabezal va este alto sobre el punto de deposito

interface DCL { presetId: string }
const PRESETS = [
  { id: '3caminos', name: '3 caminos (3D)',
    note: '3 lineas paralelas que SUBEN en capas — como nervios o las pistas de una pieza. Serpentina = camino continuo, sin levantar.',
    patch: { pattern: 'paths3' as const, nPer: 16, patR: 2.5, nLayers: 5, A3: 6 } },
  { id: 'relleno', name: 'Relleno (3D solido)',
    note: 'Raster serpenteado que LLENA el area, capa por capa. Asi se hace una pieza solida. Mira como crece desde la base.',
    patch: { pattern: 'fill' as const, nPer: 12, patR: 2.2, nLayers: 4, A3: 5 } },
  { id: 'pared', name: 'Pared / torre (3D)',
    note: 'Perimetro hueco que sube. Una caja, un tubo, una pared delgada. Pocas gotas, mucha altura.',
    patch: { pattern: 'wall' as const, nPer: 14, patR: 2.2, nLayers: 8, A3: 6 } },
  { id: 'circulo', name: 'Circulo (plano)',
    note: 'El caso base: una frecuencia pura, una sola capa.',
    patch: { pattern: 'circle' as const, nPer: 24, patR: 2.5, nLayers: 1, A3: 6 } },
];

const LESSON: Lesson<DCL> = {
  hook: {
    title: 'DOS frecuencias: una pincha, la otra apunta — sin bobina.',
    body: `La corriente por la gota crea su PROPIO campo (auto-pinch J×B). Modulando a dos frecuencias:

• f₂ excita el modo l=2 (elipsoide) → PINCHA y suelta la gota
• f₃ excita el modo l=3 (pera) → APUNTA: la asimetria determina hacia donde sale

La gota ES su campo, su resonador y su mira. La trayectoria (circulo, cuadrado, lo que sea) sale de modular las DOS ondas — como los epiciclos de Fourier dibujan cualquier silueta.

Valores reales del laboratorio 2026-06-06: gota de 0.25mm, E=2J, R_contacto=7.6 ohm.`,
  },
  steps: [
    { title: 'Circulo = tono puro', duration: 8000,
      body: 'La fase de eyeccion rota uniformemente: cada gota sale un angulo mas adelante. 24 gotas = un circulo. Es la Lissajous mas simple: sin(t) y cos(t).',
      formula: 'x = R cos(2πn/N),  z = R sin(2πn/N)',
      keyframes: [{ at: 0, state: { presetId: 'circulo' } }] },
    { title: 'Cuadrado = armonicos impares', duration: 8000,
      body: 'Las ESQUINAS son cambios bruscos; en Fourier = armonicos altos (3f, 5f, 7f...). Mas armonicos = esquinas mas picudas. Un tono puro NUNCA da una esquina.',
      formula: 'triangulo(t) = sin(f) − sin(3f)/9 + sin(5f)/25 − …',
      keyframes: [{ at: 0, state: { presetId: 'cuadrado' } }] },
  ],
  connect: {
    body: `Lo mismo que hace un CRT (dos deflectores X-Y con voltaje senoidal) o una impresora inkjet continua (carga + campo). Aqui la variante: NO hay deflector externo — la corriente que FUNDE la gota es la misma que la APUNTA. Mas barato, mas simple, y el control sale de lo que ya tienes: un RP2350 con PWM a 50 kHz, modulado en duty a f₂ y f₃.

El cuello de botella real (honesto): hoy disparas 0.5 gotas/s. Para dibujar un circulo de 24 gotas a 1 Hz necesitas 24 gotas/s → boost mas grande o cap mas chico con ciclos mas rapidos.`,
    links: [],
  },
};

const fmt = (x: number, d = 0) => isFinite(x) ? x.toFixed(d) : 'NaN';

export default function DropCannon() {
  const { audience } = useAudience();
  const [params, setParams] = useState<CParams>(CANNON_DEFAULTS);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(0.8);
  const [presetId, setPresetId] = useState('3caminos');
  const sim = useRef<CState>(cReset(params));
  const drops = useRef<DepDrop[]>([]);
  const paramsRef = useRef(params); useEffect(() => { paramsRef.current = params; }, [params]);
  const speedRef = useRef(speed); useEffect(() => { speedRef.current = speed; }, [speed]);
  const set = (patch: Partial<CParams>) => setParams(p => ({ ...p, ...patch }));

  const q2Buf = useRef(new Float32Array(BUF));
  const q3Buf = useRef(new Float32Array(BUF));
  const head = useRef(0);
  const qCv = useRef<HTMLCanvasElement>(null);
  const patCv = useRef<HTMLCanvasElement>(null);
  const [, force] = useState(0);

  const reset = () => {
    sim.current = cReset(paramsRef.current);
    drops.current = [];
    q2Buf.current.fill(0); q3Buf.current.fill(0);
  };

  useEffect(() => {
    if (!running) return;
    let raf = 0, lastUi = 0;
    const tick = () => {
      const simDt = STEP_SIM * speedRef.current;
      const N = Math.max(4, Math.ceil(simDt / DT_INT));
      const h = simDt / N;
      for (let i = 0; i < N; i++) {
        const r = cStep(sim.current, paramsRef.current, h);
        sim.current = r.s;
        if (r.drop) {
          drops.current.push(r.drop);
          if (drops.current.length > MAX_DROPS) drops.current.shift();
        }
      }
      q2Buf.current[head.current] = sim.current.q2;
      q3Buf.current[head.current] = sim.current.q3;
      head.current = (head.current + 1) % BUF;
      drawTrace(qCv.current, q2Buf.current, q3Buf.current, head.current);
      drawPat(patCv.current, drops.current, paramsRef.current);
      const now = performance.now();
      if (now - lastUi > 90) { force(x => x + 1); lastUi = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const st = sim.current;
  const total = patTotal(params.pattern, params);
  const perLayer = patLayer(params.pattern, params);
  const curLayer = Math.min(Math.floor(st.nDrops / perLayer) + 1, Math.max(params.nLayers, 1));
  const done = st.nDrops >= total;
  const nextP = patPos3D(params.pattern, Math.min(st.nDrops, total - 1), params);
  const aimDeg = Math.atan2(nextP.z, nextP.x) * 180 / Math.PI;
  const isPlanar = params.pattern === 'circle' || params.pattern === 'square' || params.pattern === 'line';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={9} autoRotate bloomIntensity={0.8} bloomThreshold={0.15}
          canvasProps={{ camera: { position: [7, 5.5, 7], fov: 42, near: 0.001, far: 10000 } }}>
          <Scene sim={sim} drops={drops} params={paramsRef} />
        </Stage>

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/75 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">f₂&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#FBBF24]">{fmt(st.f2)} Hz</span> <span className="text-[#475569]">pinch</span></div>
          <div><span className="text-[#64748B]">f₃&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#FB923C]">{fmt(st.f3)} Hz</span> <span className="text-[#475569]">pera</span></div>
          <div><span className="text-[#64748B]">q₂&nbsp;&nbsp;&nbsp;</span>= <span style={{ color: st.q2 > 0.85 ? '#86EFAC' : '#CBD5E1' }}>{fmt(st.q2, 2)}</span></div>
          <div><span className="text-[#64748B]">q₃&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#FB923C]">{fmt(st.q3, 2)}</span></div>
          <div><span className="text-[#64748B]">gotas</span>= {st.nDrops}/{total} <span className="text-[#475569]">({params.pattern})</span></div>
          {!isPlanar && <div><span className="text-[#64748B]">capa&nbsp;</span>= {curLayer}/{Math.max(params.nLayers, 1)} {done && <span className="text-[#86EFAC]">✓ COMPLETA</span>}</div>}
          <div><span className="text-[#64748B]">aim&nbsp;&nbsp;</span>= {fmt(aimDeg, 0)}°</div>
          <div><span className="text-[#64748B]">d_gota</span>= <span className="text-[#FCD34D]">{fmt(params.a * 2e3, 3)} mm</span> <span className="text-[#475569]">({fmt(params.a * 2e6, 0)} µm)</span></div>
          <div className="pt-1.5 border-t border-[#1E293B]/50 mt-1.5 space-y-0.5">
            <div className="text-[9px] text-[#64748B] uppercase tracking-wider">EDO (lo que integra)</div>
            <div className="text-[10px] text-[#FBBF24]">q₂'' + (ω₂/Q₂)q₂' + ω₂²q₂ = ω₂²(I/I_c)²</div>
            <div className="text-[10px] text-[#FB923C]">q₃'' + (ω₃/Q₃)q₃' + ω₃²q₃ = αω₃²(I/I_c)²</div>
            <div className="text-[9px] text-[#475569]">pincha en q₂≥1 · α=0.35 asimetría</div>
          </div>
        </div>

        <div className="absolute top-[160px] left-4 flex flex-col gap-2">
          <PlotBox label="q₂ pinch + q₃ pera" hint="pincha en q₂=1" cv={qCv} w={210} h={84} />
          <PlotBox label="patron (vista superior)" hint={params.pattern} cv={patCv} w={168} h={168} />
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={reset} title="Reiniciar">↺</IconBtn>
        </div>
      </div>

      <LessonPanel<DCL>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) {
            const pr = PRESETS.find(p => p.id === patch.presetId);
            if (pr) { setPresetId(pr.id); set(pr.patch); setTimeout(reset, 0); }
          }
        }}
        sandbox={
          <>
            <Sec title="Patron">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => { setPresetId(p.id); set(p.patch); setTimeout(reset, 0); }}
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
            </Sec>

            <Sec title="Control">
              <Slider label="resolucion (gotas/lado)" v={params.nPer} min={6} max={32} step={1} on={v => { set({ nPer: v }); setTimeout(reset, 0); }} fix={0} />
              <Slider label="tamaño [mm]" v={params.patR} min={1} max={4} step={0.1} on={v => { set({ patR: v }); setTimeout(reset, 0); }} fix={1} />
              {!isPlanar && <Slider label="capas (altura)" v={params.nLayers} min={1} max={12} step={1} on={v => { set({ nLayers: v }); setTimeout(reset, 0); }} fix={0} />}
              <Slider label="velocidad" v={speed} min={0.05} max={8} step={0.05} on={setSpeed} fix={2} />
            </Sec>

            {audience === 'researcher' && (
              <>
                <Sec title="Corriente">
                  <Slider label="I₀ [A]" v={params.I0} min={20} max={90} step={1} on={v => set({ I0: v })} fix={0} />
                  <Slider label="A₂ [A] (pinch)" v={params.A2} min={1} max={24} step={0.5} on={v => set({ A2: v })} fix={1} />
                  <Slider label="A₃ [A] (pera)" v={params.A3} min={0} max={15} step={0.5} on={v => set({ A3: v })} fix={1} />
                  <Slider label="a [mm]" v={params.a * 1e3} min={0.05} max={0.4} step={0.005} on={v => set({ a: v / 1e3 })} fix={3} />
                </Sec>
                <Sec title="Estado (vivo)">
                  <Row label="f₂" value={`${fmt(st.f2)} Hz`} />
                  <Row label="f₃" value={`${fmt(st.f3)} Hz`} />
                  <Row label="Q₂" value={fmt(st.Q2)} />
                  <Row label="Q₃" value={fmt(st.Q3)} />
                  <Row label="q₂" value={fmt(st.q2, 3)} highlight={st.q2 >= 1} />
                  <Row label="q₃" value={fmt(st.q3, 3)} />
                </Sec>
              </>
            )}

            <Sec title="Fisica">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">Auto-pinch: F ∝ I²(t)</div>
                <div>ω_l = √(l(l-1)(l+2)γ/ρa³)</div>
                <div>l=2 pinch · l=3 pera · RK4</div>
                <div className="text-[#64748B]">lab: a=0.125mm E=2J R=7.6Ω</div>
              </div>
            </Sec>
          </>
        }
      />
    </div>
  );
}

/* ===== Scene ===== */

// Ganancia visual: la ODE da q~0.01-0.1 en oscilacion normal; sin amplificar
// la deformacion es invisible. x3 hace que CADA ciclo se vea respirar.
const VIS_GAIN = 4.5;

function Scene({ sim, drops, params }: {
  sim: React.MutableRefObject<CState>;
  drops: React.MutableRefObject<DepDrop[]>;
  params: React.MutableRefObject<CParams>;
}) {
  const headRef = useRef<THREE.Group>(null);
  const dropMesh = useRef<THREE.Mesh>(null);
  const dropMat = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.Sprite>(null);
  const flyInstRef = useRef<THREE.InstancedMesh>(null);
  const instRef = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(() => makeGlow(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpCol = useMemo(() => new THREE.Color(), []);

  const geom = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 48, 32);
    g.userData.orig = Float32Array.from(g.attributes.position.array as Float32Array);
    return g;
  }, []);

  const depGeom = useMemo(() => new THREE.SphereGeometry(1, 12, 8), []);
  const depMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#FB923C', metalness: 0.4, roughness: 0.5,
    emissive: new THREE.Color('#FB923C'), emissiveIntensity: 0.45,
  }), []);
  const flyGeom = useMemo(() => new THREE.SphereGeometry(1, 14, 10), []);
  const flyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#FFAA30', metalness: 0.15, roughness: 0.3,
    emissive: new THREE.Color('#FF6A00'), emissiveIntensity: 1.8,
  }), []);

  const prevDrops = useRef(0);
  const flying = useRef<Array<{ from: number[]; to: number[]; progress: number }>>([]);

  useFrame(() => {
    const s = sim.current, p = params.current;

    // --- el cabezal SIGUE el toolpath 3D; el siguiente punto a depositar ---
    const total = patTotal(p.pattern, p);
    const nextP = patPos3D(p.pattern, Math.min(s.nDrops, total - 1), p);
    if (headRef.current) {
      const tx = nextP.x, tz = nextP.z, ty = SUBS_Y + nextP.y + HEAD_GAP;
      headRef.current.position.x += (tx - headRef.current.position.x) * 0.25;
      headRef.current.position.z += (tz - headRef.current.position.z) * 0.25;
      headRef.current.position.y += (ty - headRef.current.position.y) * 0.25;
    }
    // direccion de la pera = hacia donde viaja el cabezal (sabor; deposita abajo)
    const aimAngle = Math.atan2(nextP.z, nextP.x);
    const tilt = 0.45;
    const ax = Math.sin(aimAngle) * tilt;
    const ay = -Math.sqrt(1 - tilt * tilt);
    const az = Math.cos(aimAngle) * tilt;

    // --- deform drop: P₂ (respira) + P₃ (pera apunta) ---
    // VIS_GAIN amplifica para que la oscilacion sea VISIBLE cada ciclo
    const q2v = Math.max(-1.5, Math.min(1.5, s.q2 * VIS_GAIN));
    const q3v = Math.max(-1.2, Math.min(1.2, s.q3 * VIS_GAIN));
    const eps2 = q2v * 0.55;
    const eps3 = q3v * 0.45;
    const pos = geom.attributes.position.array as Float32Array;
    const orig = geom.userData.orig as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const ox = orig[i], oy = orig[i + 1], oz = orig[i + 2];
      const r0 = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (r0 < 1e-6) continue;
      const nx = ox / r0, ny = oy / r0, nz = oz / r0;
      const rr = DROP_VR * (1 + eps2 * P2(ny) + eps3 * P3(nx * ax + ny * ay + nz * az));
      pos[i] = nx * rr; pos[i + 1] = ny * rr; pos[i + 2] = nz * rr;
    }
    geom.attributes.position.needsUpdate = true;
    geom.computeVertexNormals();

    // la gota se ESTIRA hacia abajo cuando q₂ crece (necking visible). Local al cabezal.
    const stretch = Math.abs(s.q2) * VIS_GAIN * 0.3;
    const shrink = s.flash > 0.3 ? 0.65 + (1 - s.flash) * 0.35 : 1.0;
    if (dropMesh.current) {
      dropMesh.current.position.y = -DROP_VR * 0.5 - stretch * 0.5;
      dropMesh.current.scale.set(shrink, shrink, shrink);
    }
    if (dropMat.current) {
      const hot = Math.min(2.5, 0.3 + Math.abs(s.q2) * 2.0);
      dropMat.current.emissiveIntensity = hot + s.flash * 2.0;
    }
    if (halo.current && dropMesh.current) {
      halo.current.position.copy(dropMesh.current.position);
      const hs = DROP_VR * 2.6;
      halo.current.scale.set(hs, hs, 1);
      (halo.current.material as THREE.SpriteMaterial).opacity = 0.2 + s.flash * 0.5 + Math.abs(s.q2) * 0.15;
    }

    // --- multi-gota en vuelo: cae del cabezal al punto de deposito (recta abajo) ---
    if (s.nDrops !== prevDrops.current && s.nDrops > 0) {
      prevDrops.current = s.nDrops;
      const last = drops.current[drops.current.length - 1];
      if (last) {
        const baseY = SUBS_Y + last.y;
        flying.current.push({
          from: [last.x, baseY + HEAD_GAP - DROP_VR * 0.5, last.z],
          to: [last.x, baseY + DEP_R, last.z],
          progress: 0,
        });
        if (flying.current.length > MAX_FLY) flying.current.shift();
      }
    }

    flying.current = flying.current.filter(f => {
      f.progress += 0.03;
      return f.progress < 1;
    });

    const flyInst = flyInstRef.current;
    if (flyInst) {
      flying.current.forEach((f, i) => {
        const t = f.progress;
        // la gota SIGUE VIBRANDO en vuelo (l=2 amortiguado -> regresa a esfera)
        const age = t * 3.0;
        const osc = Math.cos(age * 28) * Math.exp(-age * 2.2);
        const sy = 1 + osc * 0.4;
        const sxz = 1 / Math.sqrt(Math.max(sy, 0.3));
        const R = DEP_R * 2.2;
        dummy.position.set(
          f.from[0] + (f.to[0] - f.from[0]) * t,
          f.from[1] + (f.to[1] - f.from[1]) * t,
          f.from[2] + (f.to[2] - f.from[2]) * t,
        );
        dummy.scale.set(R * sxz, R * sy, R * sxz);
        dummy.updateMatrix();
        flyInst.setMatrixAt(i, dummy.matrix);
      });
      flyInst.count = flying.current.length;
      flyInst.instanceMatrix.needsUpdate = true;
    }

    // --- gotas depositadas (apiladas en 3D, color por edad: caliente -> acero frio) ---
    const inst = instRef.current;
    if (inst) {
      const arr = drops.current;
      const n = arr.length;
      for (let i = 0; i < n; i++) {
        dummy.position.set(arr[i].x, SUBS_Y + arr[i].y + DEP_R, arr[i].z);
        dummy.scale.setScalar(DEP_R);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        const age = n - 1 - i;            // 0 = recien caida
        if (age < 18) {
          const h = 1 - age / 18;         // 1 caliente -> 0 enfriando
          tmpCol.setRGB(0.5 + 1.0 * h, 0.3 + 0.45 * h, 0.2 + 0.08 * h);  // naranja HDR -> acero
        } else {
          tmpCol.setRGB(0.30, 0.32, 0.38);   // acero frio
        }
        inst.setColorAt(i, tmpCol);
      }
      inst.count = n;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      {/* cabezal móvil: alambre + gota + halo, sigue el toolpath 3D */}
      <group ref={headRef} position={[0, SUBS_Y + HEAD_GAP, 0]}>
        <mesh position={[0, 1.9, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 3.4, 16]} />
          <meshStandardMaterial color="#9aa3b2" metalness={0.7} roughness={0.35} emissive="#1a1d24" emissiveIntensity={0.3} />
        </mesh>
        <mesh ref={dropMesh} geometry={geom}>
          <meshStandardMaterial ref={dropMat} color="#FF8C20" metalness={0.15} roughness={0.25} emissive="#FF6A00" emissiveIntensity={0.5} />
        </mesh>
        <sprite ref={halo} scale={[2.5, 2.5, 1]}>
          <spriteMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.18} />
        </sprite>
      </group>
      <instancedMesh ref={flyInstRef} args={[flyGeom, flyMat, MAX_FLY]} frustumCulled={false} />
      <instancedMesh ref={instRef} args={[depGeom, depMat, MAX_DROPS]} frustumCulled={false} />
      <mesh position={[0, SUBS_Y - 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5.5, 48]} />
        <meshStandardMaterial color="#1a1f2b" metalness={0.5} roughness={0.7} />
      </mesh>
      <gridHelper args={[12, 24, '#1E293B', '#152030']} position={[0, SUBS_Y - 0.14, 0]} />
    </>
  );
}

/* ===== Plots ===== */

function drawTrace(cv: HTMLCanvasElement | null, q2: Float32Array, q3: Float32Array, hd: number) {
  if (!cv) return;
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height, n = q2.length, lo = -0.45, hi = 1.3;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0E1726'; ctx.fillRect(0, 0, W, H);
  const yOf = (v: number) => H - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * H;
  ctx.strokeStyle = '#F87171'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(0, yOf(1)); ctx.lineTo(W, yOf(1)); ctx.stroke(); ctx.setLineDash([]);
  const line = (buf: Float32Array, col: string, lw: number) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1) * W, y = yOf(buf[(hd + i) % n]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  line(q2, '#FBBF24', 1.4);
  line(q3, '#FB923C', 1.0);
}

function drawPat(cv: HTMLCanvasElement | null, arr: DepDrop[], p: CParams) {
  if (!cv) return;
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
  const sc = Math.min(W, H) / (3.2 * Math.max(p.patR, 0.1));
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0E1726'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 1;
  const R = p.patR * sc;
  if (p.pattern === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke(); }
  else if (p.pattern === 'line') { ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke(); }
  else { ctx.strokeRect(cx - R, cy - R, 2 * R, 2 * R); }   // square, paths3, fill, wall
  ctx.strokeStyle = '#0F1A2A'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4); ctx.stroke();
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    const age = (n - 1 - i) / Math.max(n, 1);
    ctx.fillStyle = `rgba(251,146,60,${(1 - age * 0.6).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(cx + arr[i].x * sc, cy - arr[i].z * sc, 2.5, 0, 2 * Math.PI); ctx.fill();
  }
}

/* ===== UI helpers ===== */

function makeGlow() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function PlotBox({ label, hint, cv, w, h }: { label: string; hint: string; cv: React.RefObject<HTMLCanvasElement | null>; w: number; h: number }) {
  return (
    <div className="rounded-md bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] p-1.5">
      <div className="text-[9px] text-[#94A3B8] font-mono px-0.5 mb-0.5 flex justify-between gap-3">
        <span>{label}</span><span className="text-[#475569]">{hint}</span>
      </div>
      <canvas ref={cv} width={w} height={h} className="block rounded-sm" />
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="p-4 border-b border-[#1E293B]"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>{children}</div>);
}
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (<div className="flex items-baseline justify-between text-[11px] font-mono py-0.5"><span className="text-[#64748B]">{label}</span><span className={highlight ? 'text-[#F87171]' : 'text-white'}>{value}</span></div>);
}
function Slider({ label, v, min, max, step, on, fix = 2 }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void; fix?: number }) {
  return (<div className="mb-2"><div className="flex items-baseline justify-between text-[11px] font-mono"><span className="text-[#64748B]">{label}</span><span className="text-white">{v.toFixed(fix)}</span></div>
    <input type="range" min={min} max={max} step={step} value={v} onChange={e => on(Number(e.target.value))} className="w-full" /></div>);
}
function IconBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (<button onClick={onClick} title={title}
    className={`w-9 h-9 rounded-md border text-[14px] flex items-center justify-center transition ${active ? 'border-[#FB923C]/50 text-white bg-[#7C2D12]/30' : 'border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#334155]'}`}>{children}</button>);
}
