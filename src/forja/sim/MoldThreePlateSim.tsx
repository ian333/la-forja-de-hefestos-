/**
 * MOLDE DE TRES PLACAS EN VIVO — construcción + DOBLE APERTURA (Kazmer §6.3.2).
 * =============================================================================
 * 1) CONSTRUCCIÓN: las placas VUELAN a su lugar una por una (video de armado).
 * 2) CICLO con la cinemática REAL de threeplate.ts: al abrir, la sección B baja
 *    sola (partición A-B: la TAPA queda expuesta y se expulsa); al agotar el
 *    stripper bolt, la placa A la sigue abriendo la partición A-X y la COLADA
 *    (runner + drop pin-point + sprue) se desprende de la X y CAE por separado
 *    — la gracia del 3 placas: pieza y desecho salen SOLOS por caminos distintos.
 * Física del ciclo: cycle-engine con los parámetros de la TAPA (pared 2 mm →
 * t_enfriamiento 8.4 s, el ejemplo EXACTO del cap 9). Pura cinemática del libro.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { createCycleSim, type CycleState } from './cycle-engine';
import { threePlateLayout, openingSequence, type ThreePlateLayout } from '../mold/threeplate';

const W = 140, D = 140;
const LID_RO = 31, LID_RI = 29, LID_H = 10, LID_TOP = 2;   // tapa ⌀62×10, falda 8

// física de la TAPA: pared 2 mm → t_c 8.4 s (Kazmer cap 9, ejemplo exacto)
const lidParams = () => ({
  flowLenM: 0.04, wallM: 0.002, vMeanMs: 0.3, projAreaM2: Math.PI * 0.031 * 0.031,
  clampTons: 45, bendSpanM: 0.16, bendWM: 0.2, bendHM: 0.1, tCoolS: 8.4,
});

const PHASE_LABEL: Record<string, string> = {
  cierre: 'CIERRE', inyeccion: 'INYECCIÓN', empaque: 'EMPAQUE', enfriamiento: 'ENFRIAMIENTO',
  apertura: 'APERTURA ×2', expulsion: 'EXPULSIÓN', caida: 'CAÍDA', retorno: 'RETORNO',
};

const CAM_PRESETS: Record<string, { pos: [number, number, number]; tgt: [number, number, number] }> = {
  general: { pos: [210, -235, 235], tgt: [0, 0, 105] },
  frontal: { pos: [130, -250, 160], tgt: [0, 0, 110] },
  apertura: { pos: [240, -205, 130], tgt: [0, -18, 52] },
  colada: { pos: [150, -170, 260], tgt: [0, 0, 175] },
};

function plateWithHole(w: number, d: number, h: number, holeR: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, holeR, 0, Math.PI * 2, true); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 48 });
}
function tube(ro: number, ri: number, h: number) {
  const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 48 });
}
const boxG = (w: number, d: number, h: number) => new THREE.BoxGeometry(w, d, h);
const cylZ = (r: number, h: number, seg = 32) => new THREE.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2);

const INTRO_STEP = 1.05, INTRO_OVERLAP = 0.55;             // s por componente / traslape

interface SceneProps {
  playing: boolean; speed: number; xray: boolean; orbit: boolean;
  stRef: React.MutableRefObject<CycleState | null>;
  metaRef: React.MutableRefObject<{ mode: string; piezas: number; coladas: number }>;
}

function TPScene({ playing, speed, xray, orbit, stRef, metaRef }: SceneProps) {
  const L: ThreePlateLayout = useMemo(() => threePlateLayout({ partHeightMm: LID_H, clampTons: 100 }), []);
  const sim = useMemo(() => createCycleSim(lidParams()), []);
  const zOf = (n: string) => L.stack.find((r) => r.name.startsWith(n))!;
  const Z = useMemo(() => ({
    rear: zOf('placa sujeción inferior'), rails: zOf('rieles'), sup: zOf('placa soporte'),
    B: zOf('placa B'), A: zOf('placa A'), X: zOf('placa X'), top: zOf('placa sujeción superior'),
  }), [L]);
  const zAB = L.partingABz, zAX = L.partingAXz;

  const steel = useMemo(() => {
    const mk = (color: string, metal = 0.45, rough = 0.48) => new THREE.MeshStandardMaterial({
      color, metalness: metal, roughness: rough, side: THREE.DoubleSide, transparent: true, opacity: 1,
    });
    return {
      clamp: mk('#7c8ba0'), rail: mk('#6b7a8f'), A: mk('#8fa3bd'), B: mk('#94a6bb'), X: mk('#a4b2c4'),
      ejector: mk('#c9a227', 0.5, 0.42), pin: mk('#e0b840', 0.55, 0.3), pilar: mk('#9fb0c4', 0.55, 0.3),
      sprue: mk('#d08040', 0.5, 0.4),
    };
  }, []);
  const fillPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 1e5), []);
  const plasticMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff7a1f', emissive: '#e85d08', emissiveIntensity: 1.0, metalness: 0, roughness: 0.5,
    clippingPlanes: [fillPlane], side: THREE.DoubleSide,
  }), [fillPlane]);
  const runnerMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff9433', emissive: '#e06a12', emissiveIntensity: 0.7, metalness: 0, roughness: 0.55, side: THREE.DoubleSide,
  }), []);

  useEffect(() => {
    for (const m of Object.values(steel)) m.opacity = xray ? 0.26 : 1;
  }, [xray, steel]);

  const geo = useMemo(() => ({
    rear: boxG(W, D, Z.rear.z1 - Z.rear.z0), rail: boxG(40, D, Z.rails.z1 - Z.rails.z0),
    sup: boxG(W, D, Z.sup.z1 - Z.sup.z0),
    Bsolid: boxG(W, D, Z.B.z1 - Z.B.z0 - LID_H), Bring: plateWithHole(W, D, LID_H, LID_RO + 0.05),
    boss: cylZ(LID_RI, LID_H - LID_TOP, 48),
    Aring: plateWithHole(W, D, LID_H, LID_RO + 0.05),      // boca de cavidad en la base de A
    Asolid: plateWithHole(W, D, Z.A.z1 - Z.A.z0 - LID_H, 3.5),  // resto de A con barreno del drop
    X: plateWithHole(W, D, Z.X.z1 - Z.X.z0, 2.2),
    top: plateWithHole(W, D, Z.top.z1 - Z.top.z0, 8.05),
    sprueBush: cylZ(8, 20, 24), ring: cylZ(20, 5, 32),
    ejPlate: boxG(40, 110, 10), ejRet: boxG(40, 110, 14), pinEj: cylZ(2.5, 46, 16),
    pilar: cylZ(9, L.stackMm - 40, 24),
    lidTop: cylZ(LID_RO, LID_TOP, 48), lidSkirt: tube(LID_RO, LID_RI, LID_H - LID_TOP),
    runner: boxG(90, 6, 3), drop: cylZ(2.2, Z.A.z1 - Z.A.z0, 16), sprueRod: cylZ(3, (Z.X.z1 - Z.X.z0) + (Z.top.z1 - Z.top.z0), 16),
    floor: boxG(900, 900, 2), suckerPin: cylZ(1.8, 6, 12),
  }), [Z, L]);

  // grupos con rol cinemático
  const gB = useRef<THREE.Group>(null!);                    // sección B (baja al abrir)
  const gA = useRef<THREE.Group>(null!);                    // placa A (sigue a B)
  const gX = useRef<THREE.Group>(null!);                    // stripper (quieta)
  const gEj = useRef<THREE.Group>(null!);                   // paquete eyector (dentro de B)
  const gLid = useRef<THREE.Group>(null!);                  // pieza
  const gRunner = useRef<THREE.Group>(null!);               // colada
  const lidSkirtRef = useRef<THREE.Mesh>(null!);
  const flyRefs = useRef<Array<{ g: THREE.Group | null; from: THREE.Vector3 }>>([]);
  const controlsRef = useRef<any>(null);
  const camPreset = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3 } | null>(null);
  const tIntro = useRef(0); const built = useRef(false);
  const coladas = useRef(0); const runnerDrop = useRef(0);  // animación de caída de la colada

  useEffect(() => {
    (window as any).__tpCam = (name: string) => {
      const p2 = CAM_PRESETS[name];
      if (p2) camPreset.current = { pos: new THREE.Vector3(...p2.pos), tgt: new THREE.Vector3(...p2.tgt) };
      return !!p2;
    };
    return () => { delete (window as any).__tpCam; };
  }, []);

  // registro de vuelo (orden de CONSTRUCCIÓN, de abajo hacia arriba)
  const fly = (i: number) => (g: THREE.Group | null) => {
    if (g && !flyRefs.current[i]) {
      const dir = [[-260, 0, 60], [260, 0, 60], [0, -300, 80], [0, 0, 320]][i % 4];
      flyRefs.current[i] = { g, from: new THREE.Vector3(dir[0], dir[1], dir[2] + i * 8) };
    }
  };
  const N_FLY = 9;
  const introT = (N_FLY - 1) * INTRO_STEP + 1.6;

  const COLD = useMemo(() => new THREE.Color('#cfc6ba'), []);
  const HOT = useMemo(() => new THREE.Color('#ff8c1e'), []);

  useFrame(({ camera }, delta) => {
    if (camPreset.current && controlsRef.current) {
      const a = 1 - Math.exp(-2.2 * Math.min(delta, 0.1));
      camera.position.lerp(camPreset.current.pos, a);
      controlsRef.current.target.lerp(camPreset.current.tgt, a);
    }
    controlsRef.current?.update();
    if (!playing) return;
    const dt = Math.min(delta, 1 / 30) * speed;

    // ── FASE DE CONSTRUCCIÓN: vuelo escalonado a posición ──
    if (!built.current) {
      tIntro.current += dt;
      flyRefs.current.forEach((f, i) => {
        if (!f?.g) return;
        const t0 = i * INTRO_STEP * (1 - INTRO_OVERLAP + 0.45);
        const p = Math.max(0, Math.min(1, (tIntro.current - t0) / 1.4));
        const e = 1 - Math.pow(1 - p, 3);
        f.g.position.set(f.from.x * (1 - e), f.from.y * (1 - e), f.from.z * (1 - e));
      });
      metaRef.current = { mode: 'construccion', piezas: 0, coladas: coladas.current };
      (window as any).__tpState = { mode: 'construccion', t: tIntro.current };
      if (tIntro.current >= introT) { built.current = true; flyRefs.current.forEach((f) => f?.g?.position.set(0, 0, 0)); }
      return;
    }

    // ── CICLO ──
    const st = sim.step(dt);
    stRef.current = st;
    const seq = openingSequence(L, st.openMm / 90);          // openMm 0..90 del motor → u
    gB.current.position.z = -seq.dB;                          // B BAJA (la inyección queda fija arriba)
    gA.current.position.z = -seq.dA;
    gEj.current.position.z = st.ejectMm * 0.35;               // pines empujan la tapa (carrera corta)

    // pieza: viaja con B; expulsada sube un poco y cae al frente
    const drop = st.partDropMm;
    gLid.current.visible = st.partVisible;
    gLid.current.position.set(0, -Math.min(drop * 1.3, 90), -seq.dB + st.ejectMm * 0.35 - Math.max(0, drop - 60) * 1.1);
    gLid.current.rotation.x = Math.min(drop / 260, 1) * 1.2;

    // colada: pegada a la X (fija) hasta que A-X abre bien; entonces CAE
    const axOpen = seq.dA;                                    // apertura A-X real
    if (st.fillFrac > 0 && runnerDrop.current === 0) gRunner.current.visible = true;
    if (axOpen > L.boltAXfreeMm * 0.7 && gRunner.current.visible && runnerDrop.current === 0) runnerDrop.current = 0.001;
    if (runnerDrop.current > 0) {
      runnerDrop.current += dt;
      const d = runnerDrop.current;
      gRunner.current.position.set(0, -18 * d, -(0.5 * 900 * d * d) * 0.55);   // caída con leve empuje frontal
      gRunner.current.rotation.y = d * 1.5;
      if (gRunner.current.position.z < -(zAX + 200)) {
        gRunner.current.visible = false; coladas.current++; runnerDrop.current = -1;   // UNA vez (done)
      }
    }
    if (st.phase === 'cierre') {
      gRunner.current.position.set(0, 0, 0); gRunner.current.rotation.y = 0;
      gRunner.current.visible = false; runnerDrop.current = 0;
    }

    // llenado: sprue+runner+drop aparecen con el frente; la tapa se revela de arriba hacia abajo
    const s = st.fillFrac;
    gRunner.current.scale.setScalar(s > 0 ? Math.min(1, s / 0.5) : 1e-3);
    fillPlane.constant = -(zAB - (s > 0.55 ? ((s - 0.55) / 0.45) * LID_H : 0));  // keep z ≥ zCut
    const u = Math.max(0, Math.min(1, (st.meltTempC - 60) / 180));
    plasticMat.color.lerpColors(COLD, HOT, u);
    plasticMat.emissive.lerpColors(COLD, HOT, u);
    plasticMat.emissiveIntensity = 0.06 + 1.05 * u;

    metaRef.current = { mode: 'ciclo', piezas: st.cycle - 1 + (['caida', 'retorno'].includes(st.phase) ? 1 : 0), coladas: coladas.current };
    (window as any).__tpState = { mode: 'ciclo', ...st, dB: seq.dB, dA: seq.dA, fase3p: seq.fase, coladas: coladas.current, rv: gRunner.current.visible, rd: runnerDrop.current, rz: +gRunner.current.position.z.toFixed(1) };
  });

  const zc = (r: { z0: number; z1: number }) => (r.z0 + r.z1) / 2;
  return (
    <group>
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#7d90ac', '#241d14', 0.75]} />
      <directionalLight position={[240, -320, 420]} intensity={2.1} />
      <directionalLight position={[-260, 220, 160]} intensity={0.65} color="#9db8ff" />
      <pointLight position={[0, -95, zAB]} intensity={2.2} distance={340} decay={1.6} color="#ffd9b0" />
      <OrbitControls ref={controlsRef} makeDefault target={[0, 0, 105]} autoRotate={orbit} autoRotateSpeed={2.2} maxDistance={1500} />
      <mesh position={[0, 0, -140]} geometry={geo.floor}><meshStandardMaterial color="#10151d" roughness={0.85} metalness={0.2} /></mesh>

      {/* ── SECCIÓN B (móvil principal): rear + rieles + eyección + soporte + placa B + core ── */}
      <group ref={gB}>
        <group ref={fly(0)}>
          <mesh geometry={geo.rear} material={steel.clamp} position={[0, 0, zc(Z.rear)]} />
        </group>
        <group ref={fly(1)}>
          <mesh geometry={geo.rail} material={steel.rail} position={[-50, 0, zc(Z.rails)]} />
          <mesh geometry={geo.rail} material={steel.rail} position={[50, 0, zc(Z.rails)]} />
          <group ref={gEj}>
            <mesh geometry={geo.ejPlate} material={steel.ejector} position={[0, 0, Z.rails.z0 + 14]} />
            <mesh geometry={geo.ejRet} material={steel.ejector} position={[0, 0, Z.rails.z0 + 26]} />
            {[0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map((a, i) => (
              <mesh key={i} geometry={geo.pinEj} material={steel.pin} position={[30 * Math.cos(a), 30 * Math.sin(a), Z.rails.z0 + 26 + 23]} />
            ))}
          </group>
        </group>
        <group ref={fly(2)}>
          <mesh geometry={geo.sup} material={steel.clamp} position={[0, 0, zc(Z.sup)]} />
        </group>
        <group ref={fly(3)}>
          <mesh geometry={geo.Bsolid} material={steel.B} position={[0, 0, zc({ z0: Z.B.z0, z1: Z.B.z1 - LID_H })]} />
          <mesh geometry={geo.Bring} material={steel.B} position={[0, 0, Z.B.z1 - LID_H]} />
          <mesh geometry={geo.boss} material={steel.B} position={[0, 0, Z.B.z1 - LID_H]} />
        </group>
      </group>

      {/* pieza: TAPA (gate central pin-point) */}
      <group ref={gLid} visible={false}>
        <mesh geometry={geo.lidTop} material={plasticMat} position={[0, 0, zAB - LID_TOP / 2]} />
        <mesh ref={lidSkirtRef} geometry={geo.lidSkirt} material={plasticMat} position={[0, 0, zAB - LID_H]} />
      </group>

      {/* ── PLACA A (sigue a B al agotar el bolt) ── */}
      <group ref={gA}>
        <group ref={fly(4)}>
          <mesh geometry={geo.Aring} material={steel.A} position={[0, 0, Z.A.z0]} />
          <mesh geometry={geo.Asolid} material={steel.A} position={[0, 0, Z.A.z0 + LID_H]} />
          {[[-48, -48], [48, -48], [-48, 48], [48, 48]].map(([x, y], i) => (
            <mesh key={i} geometry={geo.pilar} material={steel.pilar} position={[x, y, 20 + (L.stackMm - 40) / 2]} />
          ))}
        </group>
      </group>

      {/* ── COLADA (runner en la cara A-X + drop + sprue) — cae SOLA ── */}
      <group ref={gRunner} visible={false}>
        <mesh geometry={geo.runner} material={runnerMat} position={[0, 0, zAX - 1.5]} />
        <mesh geometry={geo.drop} material={runnerMat} position={[0, 0, zc(Z.A)]} />
        <mesh geometry={geo.sprueRod} material={runnerMat} position={[0, 0, zAX + ((Z.X.z1 - Z.X.z0) + (Z.top.z1 - Z.top.z0)) / 2]} />
      </group>

      {/* ── PLACA X (stripper, FIJA) + sucker pins ── */}
      <group ref={gX}>
        <group ref={fly(5)}>
          <mesh geometry={geo.X} material={steel.X} position={[0, 0, Z.X.z0]} />
          {[-30, 30].map((x, i) => (
            <mesh key={i} geometry={geo.suckerPin} material={steel.pin} position={[x, 0, Z.X.z0 + 3]} />
          ))}
        </group>
      </group>

      {/* ── CLAMP SUPERIOR (fijo): sprue bushing + anillo ── */}
      <group>
        <group ref={fly(6)}>
          <mesh geometry={geo.top} material={steel.clamp} position={[0, 0, Z.top.z0]} />
        </group>
        <group ref={fly(7)}>
          <mesh geometry={geo.sprueBush} material={steel.sprue} position={[0, 0, Z.top.z0 + 12]} />
        </group>
        <group ref={fly(8)}>
          <mesh geometry={geo.ring} material={steel.sprue} position={[0, 0, Z.top.z1 + 2.5]} />
        </group>
      </group>
    </group>
  );
}

const BTN: React.CSSProperties = {
  background: 'rgba(20,28,40,0.92)', border: '1px solid #2c3a50', color: '#dfe7f2', cursor: 'pointer',
  borderRadius: 7, padding: '6px 10px', fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace",
};
const BTN_ON: React.CSSProperties = { ...BTN, background: '#4c9fff', color: '#08111f', borderColor: '#4c9fff', fontWeight: 700 };

export default function MoldThreePlateSim({ onClose }: { onClose: () => void }) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [xray, setXray] = useState(false);
  const [orbit, setOrbit] = useState(false);
  const [hud, setHud] = useState<CycleState | null>(null);
  const [meta, setMeta] = useState({ mode: 'construccion', piezas: 0, coladas: 0 });
  const stRef = useRef<CycleState | null>(null);
  const metaRef = useRef({ mode: 'construccion', piezas: 0, coladas: 0 });
  useEffect(() => {
    const id = setInterval(() => { if (stRef.current) setHud({ ...stRef.current }); setMeta({ ...metaRef.current }); }, 110);
    return () => clearInterval(id);
  }, []);
  const k = typeof window !== 'undefined' && window.innerWidth >= 3000 ? 2 : 1;

  return (
    <div data-testid="tp-view" style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#05070b', fontFamily: "'JetBrains Mono', monospace", color: '#e9eef5' }}>
      <Canvas gl={{ antialias: true }} camera={{ position: [210, -235, 235], fov: 42, near: 1, far: 5000, up: [0, 0, 1] }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; gl.setClearColor('#05070b'); }}>
        <TPScene playing={playing} speed={speed} xray={xray} orbit={orbit} stRef={stRef} metaRef={metaRef} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 18, pointerEvents: 'none', transform: `scale(${k})`, transformOrigin: 'top left' }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 1 }}>MOLDE DE 3 PLACAS · CONSTRUCCIÓN Y DOBLE APERTURA</div>
        <div style={{ fontSize: 10.5, opacity: 0.65, marginTop: 2 }}>
          tapa ⌀62×10 · gate pin-point central · Kazmer §6.3.2 — la pieza y la colada salen SOLAS por caminos distintos
        </div>
      </div>

      {meta.mode === 'construccion' && (
        <div data-testid="tp-intro" style={{
          position: 'absolute', top: 60 * k, left: '50%', transform: `translateX(-50%) scale(${k})`, transformOrigin: 'top center',
          background: 'rgba(16,24,38,0.9)', border: '1px solid #2c3a50', borderRadius: 8, padding: '7px 16px', fontSize: 12.5, fontWeight: 700,
        }}>
          🔨 CONSTRUYENDO EL MOLDE — placa por placa…
        </div>
      )}

      <div style={{ position: 'absolute', top: 58, right: 16, width: 235, background: 'rgba(10,14,22,0.9)', border: '1px solid #223046', borderRadius: 10, padding: '11px 13px', transform: `scale(${k})`, transformOrigin: 'top right' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span data-testid="tp-phase" style={{ fontSize: 13, fontWeight: 800, color: '#4c9fff' }}>
            {meta.mode === 'construccion' ? 'CONSTRUCCIÓN' : hud ? PHASE_LABEL[hud.phase] : '—'}
          </span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{hud ? hud.t.toFixed(1) : '0.0'} s</span>
        </div>
        <div style={{ fontSize: 10.5, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 3 }}>
          <span>llenado</span><b data-testid="tp-fill">{((hud?.fillFrac ?? 0) * 100).toFixed(0)} %</b>
          <span>P inyección</span><b>{(hud?.pressureMPa ?? 0).toFixed(1)} MPa</b>
          <span>apertura B (A-B)</span><b data-testid="tp-db">{((window as any).__tpState?.dB ?? 0).toFixed(0)} mm</b>
          <span>apertura A (A-X)</span><b data-testid="tp-da">{((window as any).__tpState?.dA ?? 0).toFixed(0)} mm</b>
          <span>piezas</span><b data-testid="tp-parts" style={{ color: '#ffd23f' }}>{meta.piezas}</b>
          <span>coladas separadas</span><b data-testid="tp-runners" style={{ color: '#ff9433' }}>{meta.coladas}</b>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: `translateX(-50%) scale(${k})`, transformOrigin: 'bottom center', display: 'flex', gap: 7 }}>
        <button data-testid="tp-play" style={playing ? BTN_ON : BTN} onClick={() => setPlaying((p) => !p)}>{playing ? '⏸' : '▶'}</button>
        {[1, 2, 4, 8].map((v) => (
          <button key={v} data-testid={`tp-speed-${v}`} style={speed === v ? BTN_ON : BTN} onClick={() => setSpeed(v)}>×{v}</button>
        ))}
        <button data-testid="tp-xray" style={xray ? BTN_ON : BTN} onClick={() => setXray((x) => !x)}>👁 Rayos X</button>
        <button data-testid="tp-orbit" style={orbit ? BTN_ON : BTN} onClick={() => setOrbit((o) => !o)}>🎥 Órbita</button>
        <button data-testid="tp-close" style={BTN} onClick={onClose}>✕ Cerrar</button>
      </div>
    </div>
  );
}
