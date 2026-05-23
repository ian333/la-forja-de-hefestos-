/**
 * QuasarPulsar v2 — pulsar como sistema de partículas multi-banda, mismo
 * patrón que QuasarSED.
 *
 * Cada componente físico es una nube de partículas con posición FIJA.
 * El brillo de cada partícula se LEE del tensor precomputado
 *   j[componente, log_E, fase_rotacional]
 * con cara-Mellin espectral × cara-i temporal (Operador 𝔄).
 *
 * Slider banda (log_E): barre radio → X → gamma → TeV (19 décadas).
 * Slider fase (0-1):     barre un período rotacional (P=33.4 ms).
 *
 * Lo que ves cambia con la BANDA: en radio solo el beam; en X el polar cap;
 * en gamma los outer gaps; en TeV la nebula.
 * Y con la FASE: el lighthouse barre, el polar cap pulsa suave, los gaps
 * gamma pulsan con doble peak.
 *
 * Refs: Kuiper+ 2001 (Crab multi-λ), Abdo+ 2010 (Fermi pulse profiles),
 *       Lyne & Graham-Smith 2012 textbook, Goldreich-Julian 1969.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';

interface PulsarData {
  N_E: number;
  N_PHASE: number;
  N_C: number;
  logEMin: number;
  logEMax: number;
  components: string[];
  tensor: Float32Array;        // [N_C, N_E, N_PHASE] row-major
}

async function loadPulsar(): Promise<PulsarData> {
  const res = await fetch('/precomputed/pulsar.bin');
  if (!res.ok) throw new Error(`failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  const N_E     = dv.getUint32(0, true);
  const N_PHASE = dv.getUint32(4, true);
  const N_C     = dv.getUint32(8, true);
  const logEMin = dv.getFloat32(16, true);
  const logEMax = dv.getFloat32(20, true);
  const components: string[] = [];
  let off = 32;
  for (let i = 0; i < N_C; i++) {
    const slice = new Uint8Array(buf, off, 16);
    const z = slice.indexOf(0);
    components.push(new TextDecoder().decode(slice.subarray(0, z < 0 ? 16 : z)).trim());
    off += 16;
  }
  const tensor = new Float32Array(buf.slice(off));
  return { N_E, N_PHASE, N_C, logEMin, logEMax, components, tensor };
}

function lookup(d: PulsarData, c: number, logE: number, phase: number): number {
  const fE = (logE - d.logEMin) / (d.logEMax - d.logEMin);
  if (fE < 0 || fE > 1) return 0;
  let p = phase - Math.floor(phase);   // wrap to [0,1)
  const iEf = fE * (d.N_E - 1);
  const ipf = p * d.N_PHASE;
  const iE  = Math.floor(iEf), iE1 = Math.min(iE + 1, d.N_E - 1);
  const ip  = Math.floor(ipf) % d.N_PHASE;
  const ip1 = (ip + 1) % d.N_PHASE;
  const tE = iEf - iE, tp = ipf - Math.floor(ipf);
  const base = c * d.N_E * d.N_PHASE;
  const a = d.tensor[base + iE  * d.N_PHASE + ip];
  const b = d.tensor[base + iE1 * d.N_PHASE + ip];
  const cc = d.tensor[base + iE  * d.N_PHASE + ip1];
  const dd = d.tensor[base + iE1 * d.N_PHASE + ip1];
  return (1-tE)*(1-tp)*a + tE*(1-tp)*b + (1-tE)*tp*cc + tE*tp*dd;
}

/* ─── Geometría del pulsar (Crab-like, α=60° inclinación dipolo) ───── */
const ALPHA = 60 * Math.PI / 180;     // tilt dipolo vs spin axis
const R_NS  = 1.0;                     // radio NS (world units)
const R_LC  = 38;                      // light cylinder

/* ─── Partículas: posiciones fijas, brillo dinámico via tensor ─────── */

interface ParticleSet {
  positions: Float32Array;
  compId:    Float32Array;
  baseSize:  Float32Array;
}

function buildParticles(): ParticleSet {
  const all: { x:number; y:number; z:number; c:number; size:number }[] = [];
  const rand = (a:number,b:number) => a + Math.random()*(b-a);
  const gauss = () => { let s=0; for (let i=0;i<3;i++) s += Math.random()-0.5; return s/1.5; };

  // Eje magnético en t=0: inclinado α del eje spin Y, hacia +X
  const magUp = new THREE.Vector3(Math.sin(ALPHA), Math.cos(ALPHA), 0);
  const magDn = magUp.clone().negate();
  // Frame perpendicular al eje magnético
  const u1 = new THREE.Vector3(0, 0, 1);  // perpendicular en este caso
  const u2 = new THREE.Vector3().crossVectors(magUp, u1).normalize();

  // 1. RADIO BEAM (comp 0) — cono delgado emergiendo de cada polo magnético
  for (let side = -1; side <= 1; side += 2) {
    const axis = side > 0 ? magUp : magDn;
    for (let i = 0; i < 8000; i++) {
      const r = R_NS + Math.pow(Math.random(), 0.6) * R_LC * 0.95;
      const halfAngle = 8 * Math.PI / 180;   // cono 8°
      const rPerp = r * Math.tan(halfAngle) * Math.sqrt(Math.random());
      const phi = rand(0, 2 * Math.PI);
      const pos = new THREE.Vector3()
        .addScaledVector(axis, r)
        .addScaledVector(u1, rPerp * Math.cos(phi))
        .addScaledVector(u2, rPerp * Math.sin(phi));
      all.push({ x: pos.x, y: pos.y, z: pos.z, c: 0, size: 0.45 + Math.random() * 0.30 });
    }
  }

  // 2. POLAR CAP X (comp 1) — hot spot en cada polo magnético, ~5% R_NS radio
  for (let side = -1; side <= 1; side += 2) {
    const axis = side > 0 ? magUp : magDn;
    for (let i = 0; i < 2000; i++) {
      const r = R_NS * (0.95 + Math.random() * 0.10);
      const halfAngle = 12 * Math.PI / 180;
      const rPerp = r * Math.tan(halfAngle) * Math.sqrt(Math.random());
      const phi = rand(0, 2 * Math.PI);
      const pos = new THREE.Vector3()
        .addScaledVector(axis, r)
        .addScaledVector(u1, rPerp * Math.cos(phi))
        .addScaledVector(u2, rPerp * Math.sin(phi));
      all.push({ x: pos.x, y: pos.y, z: pos.z, c: 1, size: 0.55 + Math.random() * 0.25 });
    }
  }

  // 3. OUTER GAP gamma (comp 2) — anillo a ~0.7 R_LC en el plano rotación-magnético
  for (let i = 0; i < 6000; i++) {
    const r = R_LC * 0.65 + gauss() * R_LC * 0.05;
    const phi = rand(0, 2 * Math.PI);
    // Plano perpendicular al eje spin (Y) — donde estaría el null surface del Goldreich-Julian
    const y = gauss() * 1.5;  // thin
    all.push({
      x: r * Math.cos(phi),
      y,
      z: r * Math.sin(phi),
      c: 2,
      size: 0.50 + Math.random() * 0.35,
    });
  }

  // 4. BRIDGE emission (comp 3) — entre polar cap y outer gap, sigue líneas de campo
  for (let side = -1; side <= 1; side += 2) {
    const axis = side > 0 ? magUp : magDn;
    for (let i = 0; i < 2500; i++) {
      // Líneas dipolar r(θ)=r₀sin²θ, sample θ ∈ [0.3, 1.4]
      const r0 = 5 + Math.random() * 15;
      const theta = 0.3 + Math.random() * 1.1;
      const r_local = r0 * Math.sin(theta) ** 2;
      const azim = rand(0, 2 * Math.PI);
      // Coords en frame dipolar
      const xDip = r_local * Math.sin(theta) * Math.cos(azim);
      const yDip = r_local * Math.cos(theta) * (side > 0 ? 1 : -1);
      const zDip = r_local * Math.sin(theta) * Math.sin(azim);
      // Rotar al frame lab: dipolo está rotado α en plano XY del spin
      const pos = new THREE.Vector3()
        .addScaledVector(axis, yDip)
        .addScaledVector(u1, xDip)
        .addScaledVector(u2, zDip);
      all.push({ x: pos.x, y: pos.y, z: pos.z, c: 3, size: 0.40 + Math.random() * 0.25 });
    }
  }

  // 5. NEBULA sincrotrón (comp 4) — cloud disperso lejos del light cylinder
  for (let i = 0; i < 12000; i++) {
    const r = R_LC * 1.5 + Math.random() * R_LC * 1.0;
    const phi = rand(0, 2 * Math.PI);
    const cosTh = rand(-1, 1);
    const sinTh = Math.sqrt(1 - cosTh*cosTh);
    all.push({
      x: r * sinTh * Math.cos(phi),
      y: r * cosTh,
      z: r * sinTh * Math.sin(phi),
      c: 4,
      size: 0.30 + Math.random() * 0.30,
    });
  }

  const N = all.length;
  const positions = new Float32Array(N * 3);
  const compId    = new Float32Array(N);
  const baseSize  = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    positions[i*3+0] = all[i].x;
    positions[i*3+1] = all[i].y;
    positions[i*3+2] = all[i].z;
    compId[i]   = all[i].c;
    baseSize[i] = all[i].size;
  }
  return { positions, compId, baseSize };
}

/* ─── Paleta por componente ─────────────────────────────────────────── */
const COMP_COLOR_HEX = [
  '#7099FF',  // 0 radio_beam — blue
  '#A0FFFF',  // 1 polar_cap_X — cyan
  '#C97FFF',  // 2 outer_gap_g — violet
  '#FFB060',  // 3 bridge — amber
  '#FF6F9A',  // 4 nebula_sync — pink (NO pulsa, background brillante)
];
const COMP_LABELS = ['radio beam', 'polar cap X', 'outer gap γ', 'bridge', 'nebula sync'];

/* ─── Particle render con shader custom (igual patrón SED) ──────────── */
function ParticlePulsar({ data, logE, phase, rotAngle, particles }: {
  data: PulsarData;
  logE: number;
  phase: number;
  rotAngle: number;
  particles: ParticleSet;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);

  const colorPalette = useMemo(() => COMP_COLOR_HEX.map(hex => {
    const c = new THREE.Color(hex);
    return new THREE.Vector3(c.r, c.g, c.b);
  }), []);

  // brightness array como useMemo (return directo, no ref) — garantiza
  // estar disponible al primer render.
  const brightArr = useMemo(
    () => new Float32Array(particles.compId.length),
    [particles],
  );

  // Recompute brightness when logE, phase, or data changes
  useEffect(() => {
    if (!geomRef.current) return;
    const N = particles.compId.length;
    for (let i = 0; i < N; i++) {
      const c = particles.compId[i] | 0;
      brightArr[i] = lookup(data, c, logE, phase);
    }
    const maxByC: number[] = [0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
      const c = particles.compId[i] | 0;
      if (brightArr[i] > maxByC[c]) maxByC[c] = brightArr[i];
    }
    for (let i = 0; i < N; i++) {
      const c = particles.compId[i] | 0;
      if (maxByC[c] > 0) brightArr[i] /= maxByC[c];
    }
    const attr = geomRef.current.attributes.brightness as THREE.BufferAttribute;
    if (attr) attr.needsUpdate = true;
  }, [data, logE, phase, particles, brightArr]);

  // Rotation of magnetic dipole + beam particles around spin axis Y
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = rotAngle;
    }
  });

  // DEBUG: log particle count una vez
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[Pulsar] particles N =', particles.compId.length,
      'positions length =', particles.positions.length,
      'brightArr length =', brightArr.length);
  }, [particles, brightArr]);

  return (
    <group ref={groupRef}>
      {/* DEBUG: simple points con material básico para confirmar geometría */}
      <points position={[0, 0, 0]}>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute attach="attributes-position"   args={[particles.positions, 3]} />
          <bufferAttribute attach="attributes-compId"     args={[particles.compId, 1]} />
          <bufferAttribute attach="attributes-baseSize"   args={[particles.baseSize, 1]} />
          <bufferAttribute attach="attributes-brightness" args={[brightArr, 1]} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uPixelRatio: { value: window.devicePixelRatio },
            uColors:     { value: colorPalette },
          }}
          vertexShader={`
            attribute float compId;
            attribute float baseSize;
            attribute float brightness;
            uniform float uPixelRatio;
            uniform vec3 uColors[5];
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
              int cId = int(compId + 0.5);
              vec3 base = uColors[cId];
              // Base visible (0.20) + boost por brillo del tensor
              float vis = pow(brightness, 0.4);
              vColor = base * (0.35 + 1.0 * vis);
              vAlpha = clamp(vis * 0.45 + 0.25, 0.25, 0.85);
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              float dist = -mv.z;
              float sz = baseSize * (1.0 + 1.8 * vis) * 400.0 * uPixelRatio / dist;
              gl_PointSize = clamp(sz, 3.0, 40.0);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={`
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
              vec2 d = gl_PointCoord - vec2(0.5);
              float r2 = dot(d, d);
              if (r2 > 0.25) discard;
              float fall = exp(-r2 * 8.0);
              gl_FragColor = vec4(vColor * fall, vAlpha * fall);
            }
          `}
        />
      </points>
    </group>
  );
}

/* ─── Neutron Star + spin axis + light cylinder ─────────────────────── */
function StarFurniture() {
  const lcGeom = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * 2 * Math.PI;
      pts.push(new THREE.Vector3(R_LC * Math.cos(t), 0, R_LC * Math.sin(t)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  const spinGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(
      [0, -R_LC * 0.7, 0, 0, R_LC * 0.7, 0], 3));
    return g;
  }, []);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[R_NS, 32, 32]} />
        <meshBasicMaterial color="#A0D8FF" toneMapped={false} />
      </mesh>
      <line>
        <primitive object={spinGeom} />
        <lineBasicMaterial color="#FFD466" transparent opacity={0.4} toneMapped={false} />
      </line>
      <line>
        <primitive object={lcGeom} />
        <lineBasicMaterial color="#FFA0A0" transparent opacity={0.30} toneMapped={false} />
      </line>
    </group>
  );
}

/* ─── Pulse profile SVG: intensidad vs fase para banda actual ───────── */
function PulseProfile({ data, logE, phase, setPhase }: {
  data: PulsarData; logE: number; phase: number; setPhase: (p: number) => void;
}) {
  const w = 520, h = 110, padX = 32, padY = 12;
  // Para cada componente, calcular intensity(phase) a logE actual
  const curves = useMemo(() => {
    const out: { name: string; color: string; pts: number[] }[] = [];
    for (let c = 0; c < data.N_C; c++) {
      const pts: number[] = [];
      for (let ip = 0; ip < data.N_PHASE; ip++) {
        const p = ip / data.N_PHASE;
        pts.push(lookup(data, c, logE, p));
      }
      out.push({ name: data.components[c], color: COMP_COLOR_HEX[c], pts });
    }
    return out;
  }, [data, logE]);

  const maxAcross = useMemo(() => {
    let mx = 0;
    for (const c of curves) for (const v of c.pts) if (v > mx) mx = v;
    return Math.max(1e-6, mx);
  }, [curves]);

  const dominant = useMemo(() => {
    let bestC = -1, bestV = -Infinity;
    for (let c = 0; c < data.N_C; c++) {
      let v = 0;
      for (let ip = 0; ip < data.N_PHASE; ip++) v += lookup(data, c, logE, ip / data.N_PHASE);
      if (v > bestV) { bestV = v; bestC = c; }
    }
    return bestC;
  }, [data, logE]);

  const xP = (p: number) => padX + p * (w - padX - 12);
  const yV = (v: number) => h - padY - (v / maxAcross) * (h - padY - 12);

  // Band name from logE
  const E = Math.pow(10, logE);
  let bandName = '';
  if (E < 1e-4)         bandName = 'Radio';
  else if (E < 0.1)     bandName = 'IR/mm';
  else if (E < 10)      bandName = 'Óptico/UV';
  else if (E < 5e3)     bandName = 'Soft X';
  else if (E < 1e6)     bandName = 'Hard X';
  else if (E < 1e9)     bandName = 'MeV γ';
  else if (E < 1e11)    bandName = 'GeV γ';
  else                  bandName = 'TeV γ';
  let estr = '';
  if (E < 1e-3)         estr = `${(E*1e6).toFixed(1)} μeV`;
  else if (E < 1)       estr = `${(E*1e3).toFixed(1)} meV`;
  else if (E < 1e3)     estr = `${E.toFixed(1)} eV`;
  else if (E < 1e6)     estr = `${(E/1e3).toFixed(1)} keV`;
  else if (E < 1e9)     estr = `${(E/1e6).toFixed(1)} MeV`;
  else if (E < 1e12)    estr = `${(E/1e9).toFixed(1)} GeV`;
  else                  estr = `${(E/1e12).toFixed(1)} TeV`;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/85 border border-[#334155] rounded-lg p-4 font-mono backdrop-blur-sm shadow-2xl" style={{ width: w + 24 }}>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#64748B]">pulse profile · banda actual</div>
          <div className="text-[15px] font-semibold mt-0.5">
            <span style={{ color: COMP_COLOR_HEX[dominant] }}>{bandName}</span>
            <span className="text-[#475569] text-[11px] ml-2">· {estr} · log E = {logE.toFixed(2)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-[#64748B]">dominante</div>
          <div className="text-[12px] font-semibold" style={{ color: COMP_COLOR_HEX[dominant] }}>
            {COMP_LABELS[dominant]}
          </div>
        </div>
      </div>

      <svg width={w} height={h} style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <g key={p}>
            <line x1={xP(p)} y1={padY} x2={xP(p)} y2={h - padY} stroke="#1e293b" strokeWidth={1} />
            <text x={xP(p)} y={h - 2} fontSize={9} fill="#64748b" textAnchor="middle">{p.toFixed(2)}</text>
          </g>
        ))}
        {curves.map((c, i) => (
          <polyline
            key={c.name}
            fill="none"
            stroke={c.color}
            strokeWidth={i === dominant ? 2 : 1.0}
            strokeOpacity={i === dominant ? 1 : 0.4}
            points={c.pts.map((v, ip) => `${xP(ip / data.N_PHASE)},${yV(v)}`).join(' ')}
          />
        ))}
        {/* Fase actual: línea vertical amarilla */}
        <line x1={xP(phase)} y1={padY} x2={xP(phase)} y2={h - padY}
              stroke="#FFE5A0" strokeWidth={1.8} />
      </svg>

      <div className="mt-2 grid grid-cols-2 gap-3 text-[10px]">
        <div>
          <div className="text-[#64748B] text-[9px] uppercase tracking-wider">log E (banda)</div>
          <input type="range" min={data.logEMin} max={data.logEMax} step={0.05}
                 value={logE}
                 className="w-full accent-[#C97FFF]"
                 readOnly />
        </div>
        <div>
          <div className="text-[#64748B] text-[9px] uppercase tracking-wider">fase rotacional</div>
          <input type="range" min={0} max={1} step={0.005}
                 value={phase} onChange={e => setPhase(parseFloat(e.target.value))}
                 className="w-full accent-[#FFE5A0]" />
        </div>
      </div>
    </div>
  );
}

/* ─── Legend top-right ──────────────────────────────────────────────── */
function Legend({ logE, setLogE, data, autoSpin, setAutoSpin }: {
  logE: number; setLogE: (v: number) => void; data: PulsarData;
  autoSpin: boolean; setAutoSpin: (b: boolean) => void;
}) {
  return (
    <div className="absolute top-6 right-6 bg-black/65 border border-[#334155] rounded p-3 font-mono text-[10px] backdrop-blur-sm">
      <div className="text-[#94A3B8] mb-1.5 text-[9px] uppercase tracking-wider">componentes</div>
      {COMP_COLOR_HEX.map((col, i) => (
        <div key={i} className="flex items-center gap-2 leading-tight">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />
          <span style={{ color: col }}>{COMP_LABELS[i]}</span>
        </div>
      ))}
      <div className="mt-3 pt-2 border-t border-[#334155]">
        <div className="text-[#94A3B8] mb-1 text-[9px] uppercase tracking-wider">banda (log E / eV)</div>
        <input type="range" min={data.logEMin} max={data.logEMax} step={0.05}
               value={logE} onChange={e => setLogE(parseFloat(e.target.value))}
               className="w-full accent-[#C97FFF] cursor-pointer" />
      </div>
      <div className="mt-3 pt-2 border-t border-[#334155]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={autoSpin} onChange={e => setAutoSpin(e.target.checked)}
                 className="accent-[#FFD466]" />
          <span style={{ color: '#FFD466' }}>auto-spin (Ω·t)</span>
        </label>
        <div className="text-[#475569] text-[9px] mt-1 leading-tight max-w-[200px]">
          on = lighthouse rota a Ω real. off = fase manual con slider.
        </div>
      </div>
    </div>
  );
}

/* ─── Scene + entry ─────────────────────────────────────────────────── */
const gl = makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });

function QuasarPulsar() {
  const [data, setData] = useState<PulsarData | null>(null);
  const [logE, setLogE] = useState(2);            // ~100 eV ~ X-ray default
  const [phase, setPhase] = useState(0);
  const [autoSpin, setAutoSpin] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const tRef = useRef(0);

  useEffect(() => {
    loadPulsar().then(setData).catch(e => setErr(String(e)));
  }, []);

  const particles = useMemo(() => buildParticles(), []);

  // Auto-spin via setInterval (fuera del Canvas, no useFrame). Frecuencia
  // escalada: ω_sim = 0.3 Hz (P=3.3s), no la real de 30 Hz que sería ilegible.
  useEffect(() => {
    if (!autoSpin) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const dt = (performance.now() - t0) / 1000;
      const newPhase = (dt * 0.3) % 1;
      setPhase(newPhase);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoSpin]);

  const rotAngle = phase * 2 * Math.PI;
  const usedPhase = phase;

  if (err) return <div className="text-red-400 p-6 font-mono">Pulsar load failed: {err}</div>;
  if (!data) return <div className="text-[#94A3B8] p-6 font-mono">loading pulsar tensor…</div>;

  return (
    <div className="w-full h-full relative" style={{ background: '#05060A' }}>
      <Canvas
        camera={{ position: [22, 12, 40], fov: 50, near: 0.001, far: 600 }}
        gl={gl}
        dpr={[0.55, 1]}
      >
        <StarFurniture />
        <ParticlePulsar data={data} logE={logE} phase={usedPhase} rotAngle={rotAngle} particles={particles} />
        <OrbitControls enablePan={false} enableZoom autoRotate={false}
          minDistance={15} maxDistance={250} minPolarAngle={0.25} maxPolarAngle={2.5} />
        <EffectComposer>
          <Bloom intensity={0.9} luminanceThreshold={0.35} luminanceSmoothing={0.6} radius={0.85} />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] max-w-md space-y-1 pointer-events-none">
        <div className="text-[#FFE5A0] font-semibold">Pulsar · Crab-like · Operador 𝔄</div>
        <div>M = 1.4 M☉ · R = 10 km · P = 33.4 ms · α = 60°</div>
        <div className="text-[10px] text-[#475569] mt-2 leading-snug max-w-sm">
          ~38k partículas. Cada componente físico está en su sitio (beam en
          conos polares, polar cap en superficie NS, outer gap en anillo, etc).
          El brillo lee tensor j[c, log_E, fase] vía cara-Mellin × cara-i_t.
          Cambia banda → ves el pulsar "con otros ojos". Cambia fase → barres
          el lighthouse.
        </div>
      </div>

      <Legend logE={logE} setLogE={setLogE} data={data} autoSpin={autoSpin} setAutoSpin={setAutoSpin} />
      <PulseProfile data={data} logE={logE} phase={usedPhase} setPhase={setPhase} />
    </div>
  );
}

export default memo(QuasarPulsar);
