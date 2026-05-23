/**
 * QuasarSED — el cuásar visto en TODAS las bandas, con framework Operador 𝔄.
 *
 * Carga /precomputed/quasar-sed.bin (generado por scripts/quasar/precompute-sed.cjs):
 *   tensor j[componente, log_ν, log_r] = 7 × 256 × 128 floats
 *   con cara-Mellin doble (radial + espectral) precomputada.
 *
 * Aplica el Operador 𝔄: las simetrías de escala (r→λr y ν→λν) generan caras
 * diagonales (Mellin). En la cara, j se factoriza como producto de LUTs 1D.
 * El runtime es lookup en lugar de evaluar fórmulas.
 *
 * "Ver con otros ojos": el slider de ν barre la cara-Mellin espectral. En
 * cada banda diferente físicamente domina:
 *   • Radio (10⁹ Hz):       jet synchrotron
 *   • Sub-mm (10¹² Hz):     dust torus + jet
 *   • Mid-IR (10¹⁴ Hz):     dust torus
 *   • Optical (10¹⁵ Hz):    disco Big Blue Bump
 *   • UV (10¹⁶ Hz):         disco peak + BLR lines
 *   • Soft X (10¹⁷ Hz):     corona soft + reflection blurred
 *   • Hard X (10¹⁹ Hz):     corona Comptonization
 *   • Gamma (10²² Hz):      jet IC (SSC + EC)
 *
 * Doppler boost: traslación δ → log δ en la cara-Mellin = corrimiento del
 * eje log_ν. Sin recomputar nada.
 *
 * Refs: docs/QUASAR-PHYSICS-REFERENCE.md
 *       RIAN/papers/operador_ian/lab/MHD_FROM_OPERATOR.md
 *       RIAN/papers/operador_ian/lab/PROCESO_CARAS.md
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';

interface SEDData {
  N_NU: number;
  N_R: number;
  N_C: number;
  logNuMin: number;
  logNuMax: number;
  logRMin: number;
  logRMax: number;
  components: string[];
  tensor: Float32Array;  // (N_C × N_NU × N_R), normalized [0,1]
}

async function loadSED(): Promise<SEDData> {
  const res = await fetch('/precomputed/quasar-sed.bin');
  if (!res.ok) throw new Error(`failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  const N_NU = dv.getUint32(0,  true);
  const N_R  = dv.getUint32(4,  true);
  const N_C  = dv.getUint32(8,  true);
  // skip pad u32
  const logNuMin = dv.getFloat32(16, true);
  const logNuMax = dv.getFloat32(20, true);
  const logRMin  = dv.getFloat32(24, true);
  const logRMax  = dv.getFloat32(28, true);
  const components: string[] = [];
  let off = 32;
  for (let i = 0; i < N_C; i++) {
    const slice = new Uint8Array(buf, off, 16);
    const z = slice.indexOf(0);
    const name = new TextDecoder().decode(slice.subarray(0, z < 0 ? 16 : z)).trim();
    components.push(name);
    off += 16;
  }
  const tensor = new Float32Array(buf, off, N_C * N_NU * N_R);
  return { N_NU, N_R, N_C, logNuMin, logNuMax, logRMin, logRMax, components, tensor };
}

// ── Helpers: query the tensor ─────────────────────────────────────────
function lookup(data: SEDData, c: number, logNu: number, logR: number): number {
  const fNu = (logNu - data.logNuMin) / (data.logNuMax - data.logNuMin);
  const fR  = (logR  - data.logRMin)  / (data.logRMax  - data.logRMin);
  if (fNu < 0 || fNu > 1 || fR < 0 || fR > 1) return 0;
  const iνf = fNu * (data.N_NU - 1);
  const irf = fR  * (data.N_R  - 1);
  const iν  = Math.floor(iνf), iν1 = Math.min(iν + 1, data.N_NU - 1);
  const ir  = Math.floor(irf), ir1 = Math.min(ir + 1, data.N_R  - 1);
  const tν = iνf - iν, tr = irf - ir;
  const base = c * data.N_NU * data.N_R;
  const a = data.tensor[base + iν  * data.N_R + ir ];
  const b = data.tensor[base + iν1 * data.N_R + ir ];
  const cc = data.tensor[base + iν  * data.N_R + ir1];
  const d = data.tensor[base + iν1 * data.N_R + ir1];
  return (1-tν)*(1-tr)*a + tν*(1-tr)*b + (1-tν)*tr*cc + tν*tr*d;
}

/** Pico (peak emission radius) de un componente a una ν dada. */
function peakRadius(data: SEDData, c: number, logNu: number): { logR: number; intensity: number } {
  let best = -Infinity, bestR = data.logRMin;
  for (let ir = 0; ir < data.N_R; ir++) {
    const logR = data.logRMin + ir * (data.logRMax - data.logRMin) / (data.N_R - 1);
    const v = lookup(data, c, logNu, logR);
    if (v > best) { best = v; bestR = logR; }
  }
  return { logR: bestR, intensity: best };
}

/** Intensidad integrada del componente sobre todos los radios a una ν dada. */
function bandIntensity(data: SEDData, c: number, logNu: number): number {
  let sum = 0;
  for (let ir = 0; ir < data.N_R; ir++) {
    const logR = data.logRMin + ir * (data.logRMax - data.logRMin) / (data.N_R - 1);
    sum += lookup(data, c, logNu, logR);
  }
  return sum / data.N_R;
}

// ── Component visual definitions ──────────────────────────────────────
interface ComponentViz {
  name: string;
  shape: 'sphere' | 'disk' | 'ring' | 'jet' | 'cloud';
  color: THREE.Color;
  size: number;          // characteristic size in world units (scales with peak r)
  bandIdx: number;       // index into tensor
}

const COMPONENT_VIZ: ComponentViz[] = [
  { name: 'disk',       shape: 'disk',  color: new THREE.Color('#FFE08A'), size: 1.0, bandIdx: 0 },
  { name: 'corona',     shape: 'sphere',color: new THREE.Color('#A8E0FF'), size: 0.5, bandIdx: 1 },
  { name: 'reflection', shape: 'ring',  color: new THREE.Color('#FF7B5A'), size: 0.7, bandIdx: 2 },
  { name: 'torus',      shape: 'ring',  color: new THREE.Color('#FFAA5A'), size: 5.0, bandIdx: 3 },
  { name: 'blr',        shape: 'cloud', color: new THREE.Color('#FF6F9A'), size: 3.5, bandIdx: 4 },
  { name: 'jet_sync',   shape: 'jet',   color: new THREE.Color('#6FB5FF'), size: 6.0, bandIdx: 5 },
  { name: 'jet_ic',     shape: 'jet',   color: new THREE.Color('#C97FFF'), size: 4.0, bandIdx: 6 },
];

// ── Component meshes ──────────────────────────────────────────────────
function ComponentMesh({ viz, data, logNu }: { viz: ComponentViz; data: SEDData; logNu: number }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Compute intensity at current band
  const intensity = useMemo(() => bandIntensity(data, viz.bandIdx, logNu), [data, viz, logNu]);

  // Smooth fade — animate emissive
  const targetOpacity = Math.min(1, intensity * 8.5);

  useFrame(() => {
    if (!matRef.current) return;
    const cur = matRef.current.opacity;
    matRef.current.opacity += (targetOpacity - cur) * 0.12;
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0015;
    }
  });

  // Shape geometry
  const geom = useMemo(() => {
    switch (viz.shape) {
      case 'sphere':
        return new THREE.SphereGeometry(viz.size, 32, 24);
      case 'disk':
        return new THREE.RingGeometry(viz.size * 0.3, viz.size * 1.4, 64);
      case 'ring':
        return new THREE.TorusGeometry(viz.size, viz.size * 0.18, 16, 64);
      case 'jet': {
        // Bicone narrow
        const g = new THREE.CylinderGeometry(0.05, viz.size * 0.25, viz.size * 4, 16, 1, true);
        return g;
      }
      case 'cloud': {
        // Multiple sphere placeholder geom — use ico
        return new THREE.IcosahedronGeometry(viz.size, 1);
      }
    }
  }, [viz]);

  // Material
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: viz.color,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: viz.shape === 'disk' || viz.shape === 'cloud' ? THREE.DoubleSide : THREE.FrontSide,
    wireframe: viz.shape === 'cloud',
  }), [viz]);
  matRef.current = mat;

  // Layout — disk equatorial, jet axial, BLR scattered, etc.
  const groupTransform = useMemo(() => {
    if (viz.shape === 'disk' || viz.shape === 'ring') {
      return { rotation: [Math.PI / 2 - 0.18, 0, 0] as [number, number, number], position: [0, 0, 0] as [number, number, number] };
    }
    return { rotation: [0, 0, 0] as [number, number, number], position: [0, 0, 0] as [number, number, number] };
  }, [viz]);

  // Jet: render as two cylinders (above + below disk)
  if (viz.shape === 'jet') {
    return (
      <group ref={groupRef}>
        <mesh geometry={geom} material={mat} position={[0,  viz.size * 2, 0]} />
        <mesh geometry={geom} material={mat} position={[0, -viz.size * 2, 0]} rotation={[Math.PI, 0, 0]} />
      </group>
    );
  }

  // BLR — render as a cluster of small clouds
  if (viz.shape === 'cloud') {
    return (
      <group ref={groupRef}>
        {Array.from({ length: 18 }, (_, i) => {
          const phi = (i / 18) * Math.PI * 2 + (i % 3) * 0.4;
          const r = viz.size * (1.1 + 0.18 * (i % 4));
          const y = (i % 5 - 2) * 0.4;
          return (
            <mesh
              key={i}
              geometry={geom}
              material={mat}
              position={[r * Math.cos(phi), y, r * Math.sin(phi)]}
              scale={0.18 + (i % 3) * 0.06}
            />
          );
        })}
      </group>
    );
  }

  return (
    <group ref={groupRef} rotation={groupTransform.rotation} position={groupTransform.position}>
      <mesh geometry={geom} material={mat} />
    </group>
  );
}

// ── Central BH (event horizon + photon ring sketch) ──────────────────
function CentralBH() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.34, 32, 24]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      <mesh rotation={[Math.PI / 2 - 0.18, 0, 0]}>
        <torusGeometry args={[0.6, 0.012, 8, 64]} />
        <meshBasicMaterial color="#FFCB7F" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// ── SED Graph overlay (HTML, no R3F) ─────────────────────────────────
function SEDGraph({ data, logNu, setLogNu }: { data: SEDData; logNu: number; setLogNu: (v: number) => void }) {
  // Per-component curve: integrate over log_r for each log_ν
  const curves = useMemo(() => {
    const out: { name: string; color: string; points: { x: number; y: number }[] }[] = [];
    const colors = ['#FFE08A', '#A8E0FF', '#FF7B5A', '#FFAA5A', '#FF6F9A', '#6FB5FF', '#C97FFF'];
    for (let c = 0; c < data.N_C; c++) {
      const points: { x: number; y: number }[] = [];
      let maxV = 0;
      const vals: number[] = [];
      for (let iν = 0; iν < data.N_NU; iν++) {
        const lν = data.logNuMin + iν * (data.logNuMax - data.logNuMin) / (data.N_NU - 1);
        let sum = 0;
        for (let ir = 0; ir < data.N_R; ir++) {
          sum += data.tensor[c * data.N_NU * data.N_R + iν * data.N_R + ir];
        }
        vals.push(sum);
        if (sum > maxV) maxV = sum;
      }
      for (let i = 0; i < vals.length; i++) {
        const lν = data.logNuMin + i * (data.logNuMax - data.logNuMin) / (data.N_NU - 1);
        const y = vals[i] / Math.max(1e-30, maxV);
        points.push({ x: lν, y });
      }
      out.push({ name: data.components[c], color: colors[c % colors.length], points });
    }
    return out;
  }, [data]);

  const w = 560, h = 140;
  const padX = 38, padY = 16;
  const x = (lν: number) => padX + ((lν - data.logNuMin) / (data.logNuMax - data.logNuMin)) * (w - padX - 14);
  const y = (v: number) => h - padY - v * (h - padY - 20);

  const bandLabels: { lν: number; label: string }[] = [
    { lν: 9,  label: 'radio' },
    { lν: 12, label: 'sub-mm' },
    { lν: 14, label: 'IR' },
    { lν: 15, label: 'óptico' },
    { lν: 16, label: 'UV' },
    { lν: 17, label: 'soft X' },
    { lν: 19, label: 'hard X' },
    { lν: 22, label: 'γ' },
  ];

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 border border-[#334155] rounded p-3 font-mono">
      <svg width={w} height={h} style={{ display: 'block' }}>
        {/* Background grid */}
        {bandLabels.map(b => (
          <g key={b.lν}>
            <line x1={x(b.lν)} y1={padY} x2={x(b.lν)} y2={h - padY} stroke="#1e293b" strokeWidth={1} />
            <text x={x(b.lν)} y={h - 2} fontSize={9} fill="#64748b" textAnchor="middle">{b.label}</text>
          </g>
        ))}
        {/* Component curves */}
        {curves.map(c => (
          <polyline
            key={c.name}
            fill="none"
            stroke={c.color}
            strokeWidth={1.3}
            strokeOpacity={0.85}
            points={c.points.map(p => `${x(p.x)},${y(p.y)}`).join(' ')}
          />
        ))}
        {/* Current ν vertical line */}
        <line x1={x(logNu)} y1={padY} x2={x(logNu)} y2={h - padY} stroke="#FFE5A0" strokeWidth={1.5} />
        {/* Y axis label */}
        <text x={padX - 28} y={h / 2} fontSize={9} fill="#64748b" transform={`rotate(-90 ${padX - 28} ${h / 2})`}>L_ν (norm)</text>
      </svg>
      {/* Slider */}
      <div className="flex items-center gap-3 mt-1 text-[10px] text-[#94A3B8]">
        <span>log ν = <span className="text-[#FFE5A0]">{logNu.toFixed(2)}</span>  →  ν = {(10**logNu).toExponential(1)} Hz  ({(c_lambda(10**logNu))})</span>
        <input
          type="range"
          min={data.logNuMin}
          max={data.logNuMax}
          step={0.05}
          value={logNu}
          onChange={(e) => setLogNu(parseFloat(e.target.value))}
          className="flex-1 accent-[#FFE5A0]"
        />
      </div>
    </div>
  );
}

function c_lambda(nu_Hz: number): string {
  // Returns a human label for the wavelength/energy
  const E_keV = 6.626e-27 * nu_Hz / 1.602e-12 / 1000;
  if (E_keV > 0.5) return `${E_keV.toFixed(2)} keV`;
  const lambda_m = 2.998e8 / nu_Hz;
  if (lambda_m > 1e-3)   return `λ = ${(lambda_m*1000).toFixed(1)} mm`;
  if (lambda_m > 1e-6)   return `λ = ${(lambda_m*1e6).toFixed(2)} μm`;
  if (lambda_m > 1e-9)   return `λ = ${(lambda_m*1e9).toFixed(0)} nm`;
  return `${(lambda_m*1e10).toExponential(1)} Å`;
}

// ── Scene ────────────────────────────────────────────────────────────
function Scene({ data, logNu }: { data: SEDData; logNu: number }) {
  return (
    <>
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 0, 0]} intensity={2} color="#FFE08A" distance={5} />
      <CentralBH />
      {COMPONENT_VIZ.map(v => (
        <ComponentMesh key={v.name} viz={v} data={data} logNu={logNu} />
      ))}
    </>
  );
}

const gl = makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });

function QuasarSED() {
  const [data, setData] = useState<SEDData | null>(null);
  const [logNu, setLogNu] = useState(15.2);   // start at optical
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadSED().then(setData).catch(e => setErr(String(e)));
  }, []);

  if (err) return <div className="text-red-400 p-6 font-mono">SED load failed: {err}</div>;
  if (!data) return <div className="text-[#94A3B8] p-6 font-mono">loading SED tensor…</div>;

  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [12, 6, 18], fov: 42, near: 0.001, far: 200 }}
        gl={gl}
        dpr={[0.55, 1]}
      >
        <Scene data={data} logNu={logNu} />
        <OrbitControls
          enablePan={false}
          enableZoom
          autoRotate
          autoRotateSpeed={0.16}
          minDistance={3}
          maxDistance={60}
        />
        <EffectComposer>
          <Bloom intensity={1.4} luminanceThreshold={0.1} luminanceSmoothing={0.7} radius={0.9} />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] max-w-md space-y-1">
        <div className="text-[#FFE5A0] font-semibold">Quasar SED · Operador 𝔄</div>
        <div>M_BH = 10⁹ M☉ · Ṁ = 0.1·Ṁ_Edd · a* = 0.9</div>
        <div>Tensor j[c, log_ν, log_r] = 7 × 256 × 128 (~900 KB)</div>
        <div className="text-[10px] text-[#475569] mt-2 leading-snug">
          cara-Mellin radial × cara-Mellin espectral, ambas conmutan con axisimetría<br/>
          → factorización tensor producto → runtime: 1 lookup 3D + producto<br/>
          slide el slider para barrer la cara-Mellin de ν — el cuásar literalmente<br/>
          se transforma según qué componente domina en cada banda
        </div>
      </div>

      <SEDGraph data={data} logNu={logNu} setLogNu={setLogNu} />
    </div>
  );
}

export default memo(QuasarSED);
