/**
 * MOLDE DE NÚCLEO ROTATIVO EN VIVO — el molde que DESENROSCA (Kazmer §13.9.3).
 * ===========================================================================
 * Una tapa roscada (⌀28, paso 3, 4 vueltas) moldeada sobre un núcleo con rosca.
 * Al abrir, el núcleo GIRA y avanza axialmente por su propia rosca → la tapa
 * (fija por su feature anti-rotación) se DESENROSCA sola y cae limpia. Abajo,
 * los ENGRANES PLANETARIOS (sun + 3 planetas) que accionan el giro — el
 * mecanismo del molde de 64 tapas roscadas del libro (Fig 13.32).
 * Física: vueltas=L/paso, torque=μ·(ΔT·CTE·E)·A·r (unscrewing.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { createCycleSim, type CycleState } from './cycle-engine';
import { unscrewTurns, unscrewTorque, chooseInternalCoreMethod, type ThreadSpec } from '../mold/unscrewing';

const CAP_RO = 16, CAP_RI = 14, CAP_H = 14;                 // tapa ⌀32 ext, rosca interna ⌀28
const THREAD: ThreadSpec = { innerDiaMm: 28, pitchMm: 3, threadLenMm: 12, wallMm: 1.5 };
const TURNS = unscrewTurns(THREAD);                          // 4 vueltas
const TORQUE = unscrewTorque(THREAD).torqueNm;              // ~52 N·m
const METHOD = chooseInternalCoreMethod({ thread: THREAD, nCavities: 64, interiorLimpio: true }).method;

const capParams = () => ({
  flowLenM: 0.03, wallM: 0.0015, vMeanMs: 0.3, projAreaM2: Math.PI * 0.016 * 0.016,
  clampTons: 30, bendSpanM: 0.12, bendWM: 0.15, bendHM: 0.1, tCoolS: 6.5,
});

const PHASE_ES: Record<string, string> = {
  cierre: 'CIERRE', inyeccion: 'INYECCIÓN', empaque: 'EMPAQUE', enfriamiento: 'ENFRIAMIENTO',
  apertura: 'APERTURA', expulsion: 'DESENROSCANDO', caida: 'TAPA LIBRE', retorno: 'RETORNO',
};
const CAM: Record<string, { pos: [number, number, number]; tgt: [number, number, number] }> = {
  general: { pos: [95, -125, 60], tgt: [0, 0, 2] },        // todo el conjunto (tapa + planetarios)
  rosca: { pos: [52, -68, 46], tgt: [0, 0, 26] },          // close-up del núcleo+tapa desenroscando
  planetario: { pos: [58, -80, -26], tgt: [0, 0, -26] },   // el mecanismo de engranes
};

/** hélice como TubeGeometry (rosca visible del núcleo o de la tapa). */
function helixTube(radius: number, pitch: number, turns: number, tubeR: number, z0 = 0) {
  const pts: THREE.Vector3[] = [];
  const N = Math.ceil(turns * 40);
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), z0 + (i / N) * turns * pitch));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, tubeR, 8, false);
}
const cylZ = (r: number, h: number, seg = 40) => new THREE.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2);
function ring(ro: number, ri: number, h: number) {
  const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 40 });
}
/** engrane de dientes simples (cilindro + dientes radiales). */
function gear(r: number, teeth: number, h: number) {
  const geos: THREE.BufferGeometry[] = [cylZ(r, h, 32)];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = new THREE.BoxGeometry(r * 0.32, r * 0.22, h).translate(r * 1.02, 0, 0);
    t.rotateZ(a); geos.push(t);
  }
  return mergeGeos(geos);
}
function mergeGeos(geos: THREE.BufferGeometry[]) {
  // fusión simple de posiciones (sin índice) para dientes de engrane
  const arrays = geos.map((g) => g.index ? g.toNonIndexed() : g);
  let total = 0; for (const g of arrays) total += (g.getAttribute('position') as THREE.BufferAttribute).count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of arrays) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const n = g.getAttribute('normal') as THREE.BufferAttribute;
    pos.set(p.array as Float32Array, o * 3);
    if (n) nor.set(n.array as Float32Array, o * 3);
    o += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

interface SP { playing: boolean; speed: number; xray: boolean; orbit: boolean;
  stRef: React.MutableRefObject<CycleState | null>; turnRef: React.MutableRefObject<number>; }

function UnscrewScene({ playing, speed, xray, orbit, stRef, turnRef }: SP) {
  const sim = useMemo(() => createCycleSim(capParams()), []);
  const steel = useMemo(() => {
    const mk = (c: string, m = 0.5, r = 0.45) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    const cav = mk('#8fa3bd'); cav.opacity = 0.32; return { cav, core: mk('#9aa8bc'), plate: mk('#7c8ba0'), gearSun: mk('#c9a227', 0.6, 0.35), gearPl: mk('#b89a3a', 0.6, 0.35), shaft: mk('#6b7a8f') };
  }, []);
  const plastic = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff7a1f', emissive: '#e85d08', emissiveIntensity: 1.0, metalness: 0, roughness: 0.5, side: THREE.DoubleSide }), []);
  const threadMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffb057', emissive: '#e06a12', emissiveIntensity: 0.5, metalness: 0.1, roughness: 0.5 }), []);
  useEffect(() => { for (const [key, m] of Object.entries(steel)) { if (key === 'cav') { m.opacity = xray ? 0.12 : 0.32; } else m.opacity = xray ? 0.24 : 1; } }, [xray, steel]);

  const geo = useMemo(() => ({
    cavPlate: ring(46, CAP_RO + 0.4, 30),                     // placa de cavidad (forma exterior de la tapa)
    coreRod: cylZ(CAP_RI - 3, CAP_H + 40),                    // vástago del núcleo
    coreThread: helixTube(CAP_RI - 0.6, THREAD.pitchMm, TURNS, 0.9, 2),  // rosca del núcleo (visible)
    capTop: cylZ(CAP_RO, 2.5, 40),
    capWall: ring(CAP_RO, CAP_RI, CAP_H - 2.5),
    capThread: helixTube(CAP_RI, THREAD.pitchMm, TURNS, 0.7, 2),         // rosca interna de la tapa
    basePlate: cylZ(48, 12), floor: new THREE.BoxGeometry(600, 600, 2),
    sun: gear(9, 12, 8), planet: gear(6, 9, 8), shaft: cylZ(2.5, 16),
  }), []);

  const coreRef = useRef<THREE.Group>(null!);                 // núcleo (rota + sube)
  const capRef = useRef<THREE.Group>(null!);                  // la tapa
  const cavRef = useRef<THREE.Group>(null!);                  // placa cavidad (abre)
  const sunRef = useRef<THREE.Group>(null!);
  const planRefs = useRef<THREE.Group[]>([]);
  const controls = useRef<any>(null); const camP = useRef<{ p: THREE.Vector3; t: THREE.Vector3 } | null>(null);
  const COLD = useMemo(() => new THREE.Color('#cfc6ba'), []); const HOT = useMemo(() => new THREE.Color('#ff8c1e'), []);
  const capFree = useRef(0);

  useEffect(() => {
    (window as any).__usCam = (n: string) => { const c = CAM[n]; if (c) camP.current = { p: new THREE.Vector3(...c.pos), t: new THREE.Vector3(...c.tgt) }; return !!c; };
    return () => { delete (window as any).__usCam; };
  }, []);

  useFrame(({ camera }, delta) => {
    if (camP.current && controls.current) {
      const a = 1 - Math.exp(-2.2 * Math.min(delta, 0.1));
      camera.position.lerp(camP.current.p, a); controls.current.target.lerp(camP.current.t, a);
    }
    controls.current?.update();
    if (!playing) return;
    const st = sim.step(Math.min(delta, 1 / 30) * speed);
    stRef.current = st;

    // apertura de la placa de cavidad
    const open = st.openMm;
    cavRef.current.position.z = ['apertura', 'expulsion', 'caida'].includes(st.phase) ? Math.min(open, 60) + 30 : 0;

    // DESENROSQUE: durante expulsión el núcleo GIRA y avanza por su rosca
    let turns = 0;
    if (st.phase === 'expulsion' || st.phase === 'caida') {
      const prog = st.phase === 'caida' ? 1 : Math.min(1, st.ejectMm / 45);
      turns = prog * TURNS;
      coreRef.current.rotation.z = turns * Math.PI * 2;         // gira
      coreRef.current.position.z = -turns * THREAD.pitchMm;     // baja por su propia rosca
      // la tapa NO gira (anti-rotación): sube liberándose de la rosca del núcleo
      capRef.current.position.z = turns * THREAD.pitchMm * (st.phase === 'caida' ? 1 : 0.5);
    } else if (st.phase === 'retorno' || st.phase === 'cierre') {
      coreRef.current.rotation.z *= 0.85; coreRef.current.position.z *= 0.85; capFree.current = 0;
    }
    turnRef.current = turns;
    // la tapa cae al terminar de desenroscar
    if (st.phase === 'caida') { capFree.current += delta * speed; capRef.current.position.set(0, -capFree.current * 40, THREAD.pitchMm * TURNS + 40 - capFree.current * capFree.current * 200); }
    capRef.current.visible = st.fillFrac > 0;

    // engranes planetarios giran mientras desenrosca
    const gearSpin = (st.phase === 'expulsion' || st.phase === 'caida') ? delta * speed * 5 : 0;
    sunRef.current.rotation.z += gearSpin;
    planRefs.current.forEach((p) => { if (p) p.rotation.z -= gearSpin * 1.5; });

    // color de la tapa por temperatura
    const u = Math.max(0, Math.min(1, (st.meltTempC - 60) / 180));
    plastic.color.lerpColors(COLD, HOT, u); plastic.emissive.lerpColors(COLD, HOT, u); plastic.emissiveIntensity = 0.08 + u;

    (window as any).__usState = { ...st, phaseEs: PHASE_ES[st.phase], turns, torque: TORQUE, method: METHOD };
  });

  return (
    <group>
      <ambientLight intensity={0.65} /><hemisphereLight args={['#7d90ac', '#241d14', 0.7]} />
      <directionalLight position={[80, -110, 140]} intensity={2.1} /><directionalLight position={[-90, 80, 60]} intensity={0.6} color="#9db8ff" />
      <pointLight position={[0, -40, 25]} intensity={1.8} distance={140} decay={1.5} color="#ffd9b0" />
      <OrbitControls ref={controls} makeDefault target={[0, 0, 18]} autoRotate={orbit} autoRotateSpeed={2} maxDistance={600} />
      <mesh position={[0, 0, -80]} geometry={geo.floor}><meshStandardMaterial color="#10151d" roughness={0.85} /></mesh>

      {/* placa de cavidad (abre hacia arriba) */}
      <group ref={cavRef}><mesh geometry={geo.cavPlate} material={steel.cav} position={[0, 0, 8]} /></group>

      {/* NÚCLEO ROSCADO (rota + sube al desenroscar) */}
      <group ref={coreRef}>
        <mesh geometry={geo.coreRod} material={steel.core} position={[0, 0, -12]} />
        <mesh geometry={geo.coreThread} material={steel.core} position={[0, 0, 0]} />
      </group>

      {/* LA TAPA roscada (fija angularmente; se desenrosca hacia arriba) */}
      <group ref={capRef} visible={false}>
        <mesh geometry={geo.capTop} material={plastic} position={[0, 0, CAP_H + 1]} />
        <mesh geometry={geo.capWall} material={plastic} position={[0, 0, 2]} />
        <mesh geometry={geo.capThread} material={threadMat} position={[0, 0, 0]} />
      </group>

      {/* placa base + ENGRANES PLANETARIOS (mecanismo §13.9.3) */}
      <group position={[0, 0, -30]}>
        <mesh geometry={geo.basePlate} material={steel.plate} position={[0, 0, -6]} />
        <group ref={sunRef}><mesh geometry={geo.sun} material={steel.gearSun} /></group>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2, R = 15;
          return (
            <group key={i} ref={(g) => { if (g) planRefs.current[i] = g; }} position={[R * Math.cos(a), R * Math.sin(a), 0]}>
              <mesh geometry={geo.planet} material={steel.gearPl} />
              <mesh geometry={geo.shaft} material={steel.shaft} position={[0, 0, 12]} />
            </group>
          );
        })}
      </group>
    </group>
  );
}

const BTN: React.CSSProperties = { background: 'rgba(20,28,40,0.92)', border: '1px solid #2c3a50', color: '#dfe7f2', cursor: 'pointer', borderRadius: 7, padding: '6px 10px', fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace" };
const BTN_ON: React.CSSProperties = { ...BTN, background: '#c9a227', color: '#1a1206', borderColor: '#c9a227', fontWeight: 700 };

export default function MoldUnscrewSim({ onClose }: { onClose: () => void }) {
  const [playing, setPlaying] = useState(true); const [speed, setSpeed] = useState(1);
  const [xray, setXray] = useState(false); const [orbit, setOrbit] = useState(false);
  const [hud, setHud] = useState<any>(null); const stRef = useRef<CycleState | null>(null); const turnRef = useRef(0);
  useEffect(() => { const id = setInterval(() => setHud((window as any).__usState ?? null), 110); return () => clearInterval(id); }, []);
  const k = typeof window !== 'undefined' && window.innerWidth >= 3000 ? 2 : 1;

  return (
    <div data-testid="us-view" style={{ position: 'fixed', inset: 0, zIndex: 92, background: '#05070b', fontFamily: "'JetBrains Mono', monospace", color: '#e9eef5' }}>
      <Canvas gl={{ antialias: true }} camera={{ position: [70, -90, 55], fov: 42, near: 1, far: 3000, up: [0, 0, 1] }} onCreated={({ gl }) => gl.setClearColor('#05070b')}>
        <UnscrewScene playing={playing} speed={speed} xray={xray} orbit={orbit} stRef={stRef} turnRef={turnRef} />
      </Canvas>
      <div style={{ position: 'absolute', top: 14, left: 18, transform: `scale(${k})`, transformOrigin: 'top left' }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 1 }}>MOLDE QUE DESENROSCA · NÚCLEO ROTATIVO</div>
        <div style={{ fontSize: 10.5, opacity: 0.65 }}>tapa roscada ⌀28 paso 3 · Kazmer §13.9.3 — el núcleo GIRA {TURNS} vueltas y la tapa cae limpia</div>
      </div>
      <div style={{ position: 'absolute', top: 58, right: 16, width: 230, background: 'rgba(10,14,22,0.9)', border: '1px solid #223046', borderRadius: 10, padding: '11px 13px', transform: `scale(${k})`, transformOrigin: 'top right' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#c9a227', marginBottom: 8 }} data-testid="us-phase">{hud?.phaseEs ?? '—'}</div>
        <div style={{ fontSize: 10.5, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4 }}>
          <span>vueltas del núcleo</span><b data-testid="us-turns" style={{ color: '#ffb057' }}>{(hud?.turns ?? 0).toFixed(1)} / {TURNS}</b>
          <span>torque desenrosque</span><b>{(hud?.torque ?? TORQUE).toFixed(0)} N·m</b>
          <span>llenado</span><b>{((hud?.fillFrac ?? 0) * 100).toFixed(0)} %</b>
          <span>mecanismo</span><b style={{ fontSize: 9 }}>{METHOD}</b>
        </div>
        <div style={{ fontSize: 9.5, opacity: 0.55, marginTop: 8, lineHeight: 1.4 }}>engranes planetarios (sun + 3) accionan el giro — como el molde de 64 tapas roscadas del libro (Fig 13.32)</div>
      </div>
      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: `translateX(-50%) scale(${k})`, transformOrigin: 'bottom center', display: 'flex', gap: 7 }}>
        <button data-testid="us-play" style={playing ? BTN_ON : BTN} onClick={() => setPlaying((p) => !p)}>{playing ? '⏸' : '▶'}</button>
        {[1, 2, 4].map((v) => <button key={v} data-testid={`us-speed-${v}`} style={speed === v ? BTN_ON : BTN} onClick={() => setSpeed(v)}>×{v}</button>)}
        <button data-testid="us-xray" style={xray ? BTN_ON : BTN} onClick={() => setXray((x) => !x)}>👁 Rayos X</button>
        <button data-testid="us-orbit" style={orbit ? BTN_ON : BTN} onClick={() => setOrbit((o) => !o)}>🎥 Órbita</button>
        <button data-testid="us-close" style={BTN} onClick={onClose}>✕ Cerrar</button>
      </div>
    </div>
  );
}
