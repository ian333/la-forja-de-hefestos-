/**
 * La Forja CAD — ÁREA DE TRABAJO "Print-in-place".
 *
 * TODO sale de UNA sola función: el modelo de la cebolla (shell.ts).
 *     r_k(θ, z) = R_k + Σ panzas(z) + Σ lóbulos(θ)
 *
 *   · tubos    → 3 paredes modo 0, comparten panza-z → gap constante (balero/llantas).
 *   · cicloidal→ 3 paredes ALTAS deformadas: eje (modo 0) · disco (modo N) · anillo
 *               (modo N+1). El disco es un TUBO con N lóbulos, NO un disco plano.
 *               Los "pernos" son el modo N+1 de la pared del anillo. La reducción
 *               N:1 EMERGE al engranar modo N contra modo N+1.
 */
import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { shellGrid, Z_SPHERE, tireEnv, reduction, type ShellSpec, type ShellGrid } from '../mech/shell';

const COLORS = ['#C8902B', '#2BB6A6', '#6B7A8F']; // oro · teal · slate

// ── malla de una pared: tubo anular cerrado con sus modos (θ×z) ──────────────
// (LatheGeometry NO puede: solo revoluciona. Esto SÍ pone lóbulos en ángulo.)
function buildGeometry(g: ShellGrid, wallSampled: ShellGrid): THREE.BufferGeometry {
  const { nTheta, nz, H, cx, cy } = g;
  const pos: number[] = [];
  const idx: number[] = [];
  const zAt = (j: number) => (H * j) / nz;
  // vértices: superficie exterior, luego interior
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i < nTheta; i++) {
      const th = (2 * Math.PI * i) / nTheta;
      pos.push(cx + g.outer[j][i] * Math.cos(th), cy + g.outer[j][i] * Math.sin(th), zAt(j));
    }
  const innerBase = (nz + 1) * nTheta;
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i < nTheta; i++) {
      const th = (2 * Math.PI * i) / nTheta;
      pos.push(cx + wallSampled.inner[j][i] * Math.cos(th), cy + wallSampled.inner[j][i] * Math.sin(th), zAt(j));
    }
  const oIdx = (j: number, i: number) => j * nTheta + (i % nTheta);
  const iIdx = (j: number, i: number) => innerBase + j * nTheta + (i % nTheta);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nTheta; i++) {
      const i2 = (i + 1) % nTheta;
      idx.push(oIdx(j, i), oIdx(j, i2), oIdx(j + 1, i2), oIdx(j, i), oIdx(j + 1, i2), oIdx(j + 1, i)); // exterior
      idx.push(iIdx(j, i), iIdx(j + 1, i2), iIdx(j, i2), iIdx(j, i), iIdx(j + 1, i), iIdx(j + 1, i2)); // interior
    }
  for (let i = 0; i < nTheta; i++) { // tapas (anillos) arriba y abajo
    const i2 = (i + 1) % nTheta;
    idx.push(oIdx(0, i), iIdx(0, i), iIdx(0, i2), oIdx(0, i), iIdx(0, i2), oIdx(0, i2));
    idx.push(oIdx(nz, i), iIdx(nz, i2), iIdx(nz, i), oIdx(nz, i), oIdx(nz, i2), iIdx(nz, i2));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// arma la geometría de una pared desde su spec (grosor = wall)
function wallGeo(spec: ShellSpec, wall: number): THREE.BufferGeometry {
  const grid = shellGrid(spec, wall, 150, 56);
  return buildGeometry(grid, grid);
}

// ── MODO TUBOS: 3 paredes modo 0, misma panza-z → gap constante ──────────────
function Tubos({ bore, wall, gap, H, A, nTires, T, exploded }: { bore: number; wall: number; gap: number; H: number; A: number; nTires: number; T: number; exploded: number }) {
  const rings = useMemo(() => {
    const w = H * 0.11;
    const centers = Array.from({ length: nTires }, (_, i) => (H * (i + 1)) / (nTires + 1));
    const zBumps = [{ amp: A, env: Z_SPHERE }, { amp: T, env: tireEnv(centers, w) }];
    const out: THREE.BufferGeometry[] = [];
    let r = bore;
    for (let k = 0; k < 3; k++) {
      const rOut = r + gap + wall;
      out.push(wallGeo({ R: rOut, H, zBumps }, wall));
      r = rOut;
    }
    return out;
  }, [bore, wall, gap, H, A, nTires, T]);
  return (
    <>
      {rings.map((geo, k) => (
        <mesh key={k} position={[0, 0, exploded * k]} geometry={geo}>
          <meshStandardMaterial color={COLORS[k]} metalness={0.4} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

// ── MODO CICLOIDAL: 3 paredes ALTAS deformadas (la cebolla engranando) ───────
//   eje    = pared modo 0 + leva excéntrica (offset E) que mete la órbita.
//   disco  = pared modo N (un TUBO con N lóbulos), su centro orbita en E.
//   anillo = pared modo N+1 (los "pernos" son sus huecos), centrado.
function Cicloidal({ N, E, gap, H, speed, animate }: { N: number; E: number; gap: number; H: number; speed: number; animate: boolean }) {
  const lobe = 2.6;                 // profundidad de lóbulo (mm)
  const camR = 12;                  // radio de la leva del eje
  const discInner = camR + gap;     // el barreno del disco monta la leva
  const ejeRef = useRef<THREE.Group>(null), discRef = useRef<THREE.Group>(null);

  const geos = useMemo(() => {
    const disco = wallGeo({ R: discInner + 4 + lobe, H, modes: [{ m: N, amp: lobe }] }, 4);
    const anillo = wallGeo({ R: discInner + 4 + lobe + E + gap + 4 + lobe, H, modes: [{ m: N + 1, amp: lobe }] }, 4);
    return { disco, anillo };
  }, [N, E, gap, H]);

  useFrame((_, dt) => {
    if (!animate) return;
    if (ejeRef.current) ejeRef.current.rotation.z += dt * speed;             // EJE: entrada rápida
    const th = ejeRef.current?.rotation.z ?? 0;
    if (discRef.current) {                                                   // DISCO: orbita en E + gira −θ/N
      discRef.current.position.set(E * Math.cos(th), E * Math.sin(th), 0);
      discRef.current.rotation.z = -th / N;
    }
  });

  return (
    <group>
      {/* CEBOLLA 1 — EJE: flecha centrada + leva excéntrica (offset E) que orbita */}
      <group ref={ejeRef}>
        <mesh position={[0, 0, H / 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[4, 4, H, 32]} /><meshStandardMaterial color="#9c7322" metalness={0.6} roughness={0.35} /></mesh>
        <mesh position={[E, 0, H / 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[camR, camR, H, 40]} /><meshStandardMaterial color="#C8902B" metalness={0.7} roughness={0.3} /></mesh>
      </group>
      {/* CEBOLLA 2 — DISCO: pared modo N (tubo lobulado), orbita. Marca para ver el giro lento */}
      <group ref={discRef} position={[E, 0, 0]}>
        <mesh geometry={geos.disco}><meshStandardMaterial color="#2BB6A6" metalness={0.35} roughness={0.5} side={THREE.DoubleSide} /></mesh>
        <mesh position={[(discInner + 4 + lobe) * 0.7, 0, H + 0.8]}><boxGeometry args={[6, 2.4, 1.4]} /><meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={0.4} /></mesh>
      </group>
      {/* CEBOLLA 3 — ANILLO: pared modo N+1 (sus huecos = los pernos), fijo = salida */}
      <mesh geometry={geos.anillo}><meshStandardMaterial color="#6B7A8F" metalness={0.4} roughness={0.55} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

export default function PrintInPlaceWorkspace() {
  const [mode, setMode] = useState<'tubos' | 'cicloidal'>('tubos');
  const [gap, setGap] = useState(1.0);
  const [A, setA] = useState(0);
  const [nTires, setNTires] = useState(2);
  const [T, setT] = useState(0);
  const [exploded, setExploded] = useState(0);
  // cicloidal
  const [N, setN] = useState(11);
  const [E, setE] = useState(1.5);
  const [cgap, setCgap] = useState(0.4);
  const [speed, setSpeed] = useState(1.2);
  const [animate, setAnimate] = useState(true);
  const bore = 6, wall = 4, H = 24, Hc = 26;
  const Ht = mode === 'tubos' ? H : Hc;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05060A', fontFamily: 'Inter, system-ui' }}>
      <Canvas camera={{ position: [58, 46, 62], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={['#05060A']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[30, 50, 40]} intensity={1.3} />
        <directionalLight position={[-25, -15, 18]} intensity={0.45} />
        {mode === 'tubos'
          ? <Tubos bore={bore} wall={wall} gap={gap} H={H} A={A} nTires={nTires} T={T} exploded={exploded} />
          : <Cicloidal N={N} E={E} gap={cgap} H={Hc} speed={speed} animate={animate} />}
        <gridHelper args={[160, 32, '#1a2030', '#10141c']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1]} />
        <OrbitControls enableDamping target={[0, 0, Ht / 2]} />
      </Canvas>

      <div style={{ position: 'absolute', top: 56, left: 16, width: 246, padding: 16, background: 'rgba(10,14,22,.9)', border: '1px solid #1d2735', borderRadius: 12, color: '#e6edf3', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {(['tubos', 'cicloidal'] as const).map((m) => (
            <button key={m} data-testid={`pip-${m}`} onClick={() => setMode(m)} style={{ flex: 1, padding: 7, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: mode === m ? '#FDB813' : '#141a24', color: mode === m ? '#05060A' : '#cdd6e0' }}>{m === 'tubos' ? '🛞 tubos' : '⚙ cicloidal'}</button>
          ))}
        </div>
        {mode === 'tubos' ? (
          <>
            <Slider label="🛞 llantas (toroides)" v={nTires} min={0} max={4} step={1} u="" onChange={(v) => setNTires(Math.round(v))} />
            <Slider label="tamaño de llanta" v={T} min={0} max={8} step={0.5} u="mm" onChange={setT} />
            <Slider label="esfera (panza al centro)" v={A} min={0} max={10} step={0.5} u="mm" onChange={setA} />
            <Slider label="gap" v={gap} min={0.3} max={3} step={0.1} u="mm" onChange={setGap} />
            <Slider label="explotar (ver los 3)" v={exploded} min={0} max={26} step={1} u="mm" onChange={setExploded} />
            <div style={{ fontSize: 10, color: '#8aa0b4', marginTop: 8, lineHeight: 1.5 }}>3 paredes modo 0, MISMA panza-z → el gap es constante en toda (θ,z). 1 llanta = pivota · 2+ = eje fijo.</div>
          </>
        ) : (
          <>
            <button onClick={() => setAnimate((a) => !a)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #2a3a4f', background: animate ? '#FDB81322' : '#141a24', color: '#FDB813', cursor: 'pointer', fontWeight: 600, marginBottom: 6 }}>{animate ? '⏸ pausar el reloj' : '▶ girar el eje'}</button>
            <Slider label="N lóbulos (reducción)" v={N} min={6} max={16} step={1} u=":1" onChange={(v) => setN(Math.round(v))} />
            <Slider label="E excéntrica" v={E} min={0.5} max={3} step={0.1} u="mm" onChange={setE} />
            <Slider label="gap (mesh)" v={cgap} min={0.18} max={0.6} step={0.02} u="mm" onChange={setCgap} />
            <Slider label="velocidad del eje" v={speed} min={0} max={3} step={0.1} u="" onChange={setSpeed} />
            <div style={{ fontSize: 10, color: '#8aa0b4', marginTop: 8, lineHeight: 1.5 }}>oro = eje (modo 0 + leva E) · teal = disco (pared modo {N}) · slate = anillo (pared modo {N + 1}). El eje gira {N} → la marca del disco gira 1. <b style={{ color: '#FDB813' }}>Reducción {reduction(N, N + 1)}:1.</b></div>
          </>
        )}
      </div>
    </div>
  );
}

const Slider = ({ label, v, min, max, step, u, onChange }: { label: string; v: number; min: number; max: number; step: number; u: string; onChange: (v: number) => void }) => (
  <label style={{ display: 'block', fontSize: 12, margin: '8px 0', color: '#9fb0c0' }}>
    <span style={{ display: 'flex', justifyContent: 'space-between' }}>{label}<b style={{ color: '#FDB813' }}>{v.toFixed(2)}{u}</b></span>
    <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(+e.target.value)} style={{ width: '100%' }} />
  </label>
);
