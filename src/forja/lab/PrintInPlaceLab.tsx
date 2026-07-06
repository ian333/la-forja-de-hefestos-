/**
 * La Forja — LABORATORIO de PRINT-IN-PLACE (la cebolla en vivo).
 * ==============================================================
 * Para que el fundador y yo VEAMOS lo que diseñamos en fórmulas. Las 3 cebollas
 * (eje · cicloidal · salida) renderizadas en vivo desde la matemática PURA
 * (cycloidal.ts + printinplace.ts) — sin OCCT, sin GPU pesada: three.js arma la
 * geometría desde los perfiles. Mueves los modos de perturbación → el mecanismo
 * se regenera → lo ves con su física. Esto ES el diseño generativo.
 */
import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { cycloidalDisc, pinPositions } from '../mech/cycloidal';
import { GAP, cosineHump, tubeStack } from '../mech/printinplace';

// ── geometría desde la matemática pura ──
function discGeometry(profile: { x: number; y: number }[], boreR: number, T: number) {
  const shape = new THREE.Shape();
  profile.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
  shape.closePath();
  const hole = new THREE.Path();
  for (let i = 0; i <= 64; i++) { const t = (2 * Math.PI * i) / 64; const x = boreR * Math.cos(t), y = boreR * Math.sin(t); i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y); }
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 4 });
  g.computeVertexNormals();
  return g;
}
// tubo barril (con joroba coseno-z): revoluciona el perfil radio(z) — LatheGeometry en Y, lo giramos a Z
function barrelGeometry(rIn: number, rOut: number, H: number, A: number, nz = 40) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= nz; i++) { const z = (H * i) / nz, h = cosineHump(z, H, A); pts.push(new THREE.Vector2(rOut + h, z)); }
  for (let i = nz; i >= 0; i--) { const z = (H * i) / nz, h = cosineHump(z, H, A); pts.push(new THREE.Vector2(rIn + h, z)); }
  const g = new THREE.LatheGeometry(pts, 80);
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  return g;
}

function Cebollas({ N, E, gap, A, H, exploded, animate }: { N: number; E: number; gap: number; A: number; H: number; exploded: number; animate: boolean }) {
  const ejeRef = useRef<THREE.Group>(null), discRef = useRef<THREE.Group>(null);
  const data = useMemo(() => {
    const R = 30, Rr = 3, camR = 8, motorBore = 2.5;
    const disc = cycloidalDisc({ lobes: N, R, Rr: Rr + gap, E });
    const pins = pinPositions(R, disc.pins);
    return { R, Rr, camR, motorBore, disc, pins, T: H };
  }, [N, E, gap, A, H]);

  useFrame((_, dt) => {
    if (!animate) return;
    if (ejeRef.current) ejeRef.current.rotation.z += dt * 1.2;          // eje rápido (entrada)
    const th = ejeRef.current?.rotation.z ?? 0;
    if (discRef.current) {                                              // disco: orbita + gira −θ/N
      discRef.current.position.set(E * Math.cos(th), E * Math.sin(th), 0);
      discRef.current.rotation.z = -th / N;
    }
  });

  const ejeGeo = useMemo(() => barrelGeometry(data.motorBore, data.camR - 2, data.T, A), [data, A]);
  const camGeo = useMemo(() => { const g = new THREE.CylinderGeometry(data.camR, data.camR, data.T, 48); g.rotateX(Math.PI / 2); g.translate(0, 0, data.T / 2); return g; }, [data]);
  const discGeo = useMemo(() => discGeometry(data.disc.profile, data.camR + gap, data.T * 0.8), [data, gap]);

  const ez = exploded, dz = 0, sz = -exploded;
  return (
    <group>
      {/* CEBOLLA 1 — EJE (oro) */}
      <group ref={ejeRef} position={[0, 0, ez]}>
        <mesh geometry={ejeGeo}><meshStandardMaterial color="#C8902B" metalness={0.6} roughness={0.35} /></mesh>
        <mesh geometry={camGeo} position={[E, 0, 0]}><meshStandardMaterial color="#E8B84B" metalness={0.7} roughness={0.3} /></mesh>
      </group>
      {/* CEBOLLA 2 — DISCO cicloidal (teal), excéntrico +E */}
      <group ref={discRef} position={[E, 0, dz + 0.5]}>
        <mesh geometry={discGeo}><meshStandardMaterial color="#2BB6A6" metalness={0.3} roughness={0.5} /></mesh>
      </group>
      {/* CEBOLLA 3 — SALIDA: 12 pernos + aro (slate) */}
      <group position={[0, 0, sz]}>
        {data.pins.map((p, i) => (
          <mesh key={i} position={[p.x, p.y, data.T / 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[data.Rr, data.Rr, data.T, 20]} /><meshStandardMaterial color="#6B7A8F" metalness={0.4} roughness={0.5} /></mesh>
        ))}
        <mesh position={[0, 0, data.T / 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[data.R + data.Rr + 5, data.R + data.Rr + 5, data.T, 96, 1, true]} /><meshStandardMaterial color="#48566A" metalness={0.4} roughness={0.6} side={THREE.DoubleSide} /></mesh>
      </group>
    </group>
  );
}

const Slider = ({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) => (
  <label style={{ display: 'block', margin: '10px 0', fontSize: 13 }}>
    <span style={{ display: 'flex', justifyContent: 'space-between', color: '#cdd6e0' }}><b>{label}</b><span style={{ color: '#FDB813' }}>{value}{unit}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} style={{ width: '100%' }} />
  </label>
);

export default function PrintInPlaceLab() {
  const [N, setN] = useState(11);
  const [E, setE] = useState(1.5);
  const [gap, setGap] = useState(GAP.PLA.sweet);
  const [A, setA] = useState(0);
  const [H, setH] = useState(8);
  const [exploded, setExploded] = useState(0);
  const [animate, setAnimate] = useState(true);

  // física en vivo
  const fis = useMemo(() => {
    const R = 30, Rr = 3;
    const disc = cycloidalDisc({ lobes: N, R, Rr: Rr + gap, E });
    const pins = pinPositions(R, disc.pins);
    let minClear = 1e9;
    for (const pin of pins) { let d = 1e9; for (const p of disc.profile) d = Math.min(d, Math.hypot(p.x + E - pin.x, p.y - pin.y)); minClear = Math.min(minClear, d - Rr); }
    const stk = tubeStack({ tubes: 1, bore: 5, wall: 3, H, layers: 10, gap, bulge: A });
    return { ratio: disc.ratio, pins: disc.pins, minClear, outT: (0.45 * disc.ratio).toFixed(2), overhang: stk.overhangDeg, buildable: stk.buildable, play: A > 0 ? stk.axialPlayMm : Infinity };
  }, [N, E, gap, A, H]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05060A', fontFamily: 'Inter, system-ui' }}>
      <Canvas camera={{ position: [55, 45, 60], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={['#05060A']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[40, 60, 50]} intensity={1.3} castShadow />
        <directionalLight position={[-30, -20, 20]} intensity={0.5} />
        <Cebollas N={N} E={E} gap={gap} A={A} H={H} exploded={exploded} animate={animate} />
        <gridHelper args={[160, 32, '#1a2030', '#10141c']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1]} />
        <OrbitControls enableDamping />
      </Canvas>

      <div style={{ position: 'absolute', top: 16, left: 16, width: 280, padding: 18, background: 'rgba(10,14,22,.86)', border: '1px solid #1d2735', borderRadius: 12, color: '#e6edf3', backdropFilter: 'blur(8px)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>⚙ Cebolla print-in-place</div>
        <div style={{ fontSize: 11, color: '#8aa0b4', marginBottom: 12 }}>la matemática, en vivo · diseño generativo</div>

        <Slider label="N lóbulos (modo)" value={N} min={6} max={16} step={1} unit="" onChange={setN} />
        <Slider label="E excéntrica" value={E} min={0.5} max={3} step={0.1} unit="mm" onChange={setE} />
        <Slider label="gap (holgura)" value={gap} min={0.18} max={0.5} step={0.02} unit="mm" onChange={setGap} />
        <Slider label="A joroba coseno-z" value={A} min={0} max={4} step={0.1} unit="mm" onChange={setA} />
        <Slider label="H espesor/altura" value={H} min={4} max={30} step={1} unit="mm" onChange={setH} />
        <Slider label="explotar (ver dentro)" value={exploded} min={0} max={30} step={1} unit="mm" onChange={setExploded} />

        <button onClick={() => setAnimate((a) => !a)} style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, border: '1px solid #2a3a4f', background: animate ? '#FDB81322' : '#141a24', color: '#FDB813', cursor: 'pointer', fontWeight: 600 }}>
          {animate ? '⏸ pausar giro' : '▶ animar el reloj'}
        </button>
      </div>

      <div style={{ position: 'absolute', top: 16, right: 16, width: 230, padding: 16, background: 'rgba(10,14,22,.86)', border: '1px solid #1d2735', borderRadius: 12, color: '#e6edf3', fontSize: 13 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>📐 Física (emerge)</div>
        <Row k="reducción" v={`${fis.ratio} : 1`} hi />
        <Row k="pernos (N+1)" v={`${fis.pins}`} />
        <Row k="holgura mesh" v={`${fis.minClear.toFixed(3)} mm`} ok={Math.abs(fis.minClear - gap) < 0.05} />
        <Row k="par salida (NEMA17×N)" v={`${fis.outT} N·m`} />
        <Row k="captura axial" v={A > 0 ? `play ${fis.play}mm` : 'recto (desliza)'} ok={A > 0} />
        <Row k="voladizo" v={`${fis.overhang}°`} ok={fis.buildable} />
        <Row k="imprimible" v={fis.buildable ? 'SÍ ✓' : 'NO ✗'} ok={fis.buildable} />
        <div style={{ marginTop: 10, fontSize: 11, color: '#8aa0b4', lineHeight: 1.5 }}>
          oro = eje (modo 1) · teal = cicloidal (modo {N}) · slate = salida (modo {N + 1}). La reducción NO se diseña: sale de (N+1)−N.
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v, hi, ok }: { k: string; v: string; hi?: boolean; ok?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #161d28' }}>
    <span style={{ color: '#9fb0c0' }}>{k}</span>
    <b style={{ color: hi ? '#FDB813' : ok === false ? '#ff6b6b' : ok ? '#5be08a' : '#e6edf3' }}>{v}</b>
  </div>
);
