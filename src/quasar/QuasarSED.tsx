/**
 * QuasarSED — el cuásar como sistema de PARTÍCULAS (plasma + nubes + fotones).
 *
 * Cada componente físico es una nube de partículas con distribución espacial
 * REAL (en log-r world coords para que todas las escalas convivan en un mismo
 * frame: BH ~ 1 r_g, disco ~ 100 r_g, BLR ~ 10⁴, torus ~ 10⁵, jet ~ 10⁶-10⁷).
 *
 * El brillo de cada partícula se LEE del tensor precomputado
 *   j[componente, log_ν, log_r]
 * con cara-Mellin radial × cara-Mellin espectral (Operador 𝔄, ver MHD_FROM_OPERATOR.md).
 *
 * Cuando arrastras el slider de log ν, mantienes la MISMA materia en su sitio
 * pero la ves "con otros ojos" — solo el componente físicamente activo en esa
 * banda emite. En radio solo el jet brilla; en IR el torus; en óptico/UV el
 * disco; en X la corona; en γ el jet IC.
 *
 * Refs: docs/QUASAR-PHYSICS-REFERENCE.md, RIAN/papers/operador_ian/.
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
  tensor: Float32Array;
}

async function loadSED(): Promise<SEDData> {
  const res = await fetch('/precomputed/quasar-sed.bin');
  if (!res.ok) throw new Error(`failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  const N_NU = dv.getUint32(0, true);
  const N_R  = dv.getUint32(4, true);
  const N_C  = dv.getUint32(8, true);
  const logNuMin = dv.getFloat32(16, true);
  const logNuMax = dv.getFloat32(20, true);
  const logRMin  = dv.getFloat32(24, true);
  const logRMax  = dv.getFloat32(28, true);
  const components: string[] = [];
  let off = 32;
  for (let i = 0; i < N_C; i++) {
    const slice = new Uint8Array(buf, off, 16);
    const z = slice.indexOf(0);
    components.push(new TextDecoder().decode(slice.subarray(0, z < 0 ? 16 : z)).trim());
    off += 16;
  }
  const tensor = new Float32Array(buf.slice(off));
  return { N_NU, N_R, N_C, logNuMin, logNuMax, logRMin, logRMax, components, tensor };
}

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
  const a = data.tensor[base + iν  * data.N_R + ir];
  const b = data.tensor[base + iν1 * data.N_R + ir];
  const cc = data.tensor[base + iν  * data.N_R + ir1];
  const d = data.tensor[base + iν1 * data.N_R + ir1];
  return (1-tν)*(1-tr)*a + tν*(1-tr)*b + (1-tν)*tr*cc + tν*tr*d;
}

// ── Generación de partículas por componente ──────────────────────────
//
// world coords:  y = log10(r/r_g) · sign(z_physical)
//                x, z = R_log · {cos φ, sin φ}  con R_log = log10(R/r_g)
// El BH queda en (0,0,0), disco equatorial en plano XZ, jet sale a ±Y.
//
// Esto comprime las 9 décadas de escala física a un volumen visualizable
// sin distorsionar las relaciones topológicas (disco equatorial, jet axial,
// etc).

interface ParticleSet {
  positions: Float32Array;   // N × 3
  compId:    Float32Array;   // N (0..N_C-1)
  logR:      Float32Array;   // N (used for tensor lookup)
  baseSize:  Float32Array;   // N (different sizes per component)
}

function buildParticles(): ParticleSet {
  const all: { x:number; y:number; z:number; c:number; logR:number; size:number }[] = [];

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const gauss = () => { let s = 0; for (let i=0;i<3;i++) s += Math.random()-0.5; return s/1.5; };

  // 1. DISK — particles in equatorial plane, log-r distributed
  //    r ∈ [r_ISCO ≈ 2.3 r_g, 100 r_g] → log_r ∈ [0.36, 2.0]
  for (let i = 0; i < 9000; i++) {
    const logR_phys = rand(0.36, 2.0);
    const R_world = logR_phys + 0.4;           // shift away from BH
    const phi = rand(0, Math.PI * 2);
    const thinness = 0.04 * R_world;           // disk thickness ~ 4% R
    all.push({
      x: R_world * Math.cos(phi),
      y: gauss() * thinness,
      z: R_world * Math.sin(phi),
      c: 0, logR: logR_phys,
      size: 1.0 + Math.random() * 0.4,
    });
  }

  // 2. CORONA — small puffy cloud above/below disk inner
  //    r ~ 10 r_g → log_r ~ 1.0
  for (let i = 0; i < 2500; i++) {
    const logR_phys = 1.0 + gauss() * 0.25;
    const r = logR_phys + 0.4;
    // Spherical-ish: random direction, |z| > 0.3 to be above/below disk
    const cosTheta = rand(-0.95, 0.95);
    const sinTheta = Math.sqrt(1 - cosTheta*cosTheta);
    const phi = rand(0, Math.PI * 2);
    all.push({
      x: r * sinTheta * Math.cos(phi),
      y: r * cosTheta + (cosTheta > 0 ? 0.18 : -0.18),
      z: r * sinTheta * Math.sin(phi),
      c: 1, logR: logR_phys,
      size: 1.4 + Math.random() * 0.5,
    });
  }

  // 3. REFLECTION — same locations as disk but slightly off-plane (reflective surface)
  for (let i = 0; i < 2500; i++) {
    const logR_phys = rand(0.36, 1.5);
    const R_world = logR_phys + 0.4;
    const phi = rand(0, Math.PI * 2);
    all.push({
      x: R_world * Math.cos(phi),
      y: (Math.random() < 0.5 ? 1 : -1) * (0.05 + 0.06 * R_world),
      z: R_world * Math.sin(phi),
      c: 2, logR: logR_phys,
      size: 0.8 + Math.random() * 0.3,
    });
  }

  // 4. TORUS — thick doughnut at r_sub ≈ 10⁴.⁵ r_g → log_r ≈ 4.5
  for (let i = 0; i < 7000; i++) {
    const logR_phys = 4.5 + gauss() * 0.55;       // r ∈ [10⁴, 10⁵]
    const R_world = logR_phys + 0.4;
    const phi = rand(0, Math.PI * 2);
    // Torus cross-section angle
    const tubeAng = rand(0, Math.PI * 2);
    const tubeR  = (0.20 + 0.25 * Math.random()) * Math.min(2.5, R_world * 0.25);
    const tubeOffR = tubeR * Math.cos(tubeAng);
    const tubeY    = tubeR * Math.sin(tubeAng);
    all.push({
      x: (R_world + tubeOffR) * Math.cos(phi),
      y: tubeY,
      z: (R_world + tubeOffR) * Math.sin(phi),
      c: 3, logR: logR_phys,
      size: 1.6 + Math.random() * 0.7,
    });
  }

  // 5. BLR — isotropic shell at log_r ≈ 4.2
  for (let i = 0; i < 4500; i++) {
    const logR_phys = 4.2 + gauss() * 0.4;
    const R_world = logR_phys + 0.4;
    // Random direction
    const cosTheta = rand(-1, 1);
    const sinTheta = Math.sqrt(1 - cosTheta*cosTheta);
    const phi = rand(0, Math.PI * 2);
    // Clumpy: many particles per "cloud"
    const cloudJitter = 0.08;
    all.push({
      x: R_world * sinTheta * Math.cos(phi) + gauss() * cloudJitter,
      y: R_world * cosTheta + gauss() * cloudJitter,
      z: R_world * sinTheta * Math.sin(phi) + gauss() * cloudJitter,
      c: 4, logR: logR_phys,
      size: 1.3 + Math.random() * 0.4,
    });
  }

  // 6. JET SYNCHROTRON — bipolar parabolic, log_r ∈ [1.7, 7]
  //    Geometry: R(z) ∝ z^(1/p) con p = 1.6 (McKinney-Narayan)
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 5500; i++) {
      const z_logR = rand(1.7, 7.0);
      // Width: parabolic R ∝ z^(1/1.6), in log world: log R = log R0 + (1/1.6)·(log z − log z0)
      const z_world = (z_logR + 0.4) * side;
      const widthScale = 0.16 * Math.pow(Math.pow(10, z_logR) / 50, 1/1.6) /
                          Math.pow(10, z_logR);
      const widthW = (widthScale + 0.04) * (1 + 0.5 * Math.abs(z_world));
      const phi = rand(0, Math.PI * 2);
      const r = widthW * Math.sqrt(Math.random()) * 1.3;
      // Knots: extra particles concentrated at log-spaced positions
      const knotZ = [2.0, 2.6, 3.3, 4.0, 4.8, 5.7];
      let knotBoost = 0;
      for (const kz of knotZ) {
        knotBoost += Math.exp(-Math.pow((z_logR - kz)/0.15, 2)) * 1.4;
      }
      all.push({
        x: r * Math.cos(phi),
        y: z_world,
        z: r * Math.sin(phi),
        c: 5, logR: z_logR,
        size: 1.1 + Math.random() * 0.4 + knotBoost * 0.5,
      });
    }
  }

  // 7. JET IC — más compacto cerca de la base, log_r ∈ [1.7, 4.5]
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 2000; i++) {
      const z_logR = rand(1.7, 4.5);
      const z_world = (z_logR + 0.4) * side;
      const widthScale = 0.10 * Math.pow(Math.pow(10, z_logR) / 50, 1/1.6) /
                          Math.pow(10, z_logR);
      const widthW = (widthScale + 0.03);
      const phi = rand(0, Math.PI * 2);
      const r = widthW * Math.sqrt(Math.random());
      all.push({
        x: r * Math.cos(phi),
        y: z_world,
        z: r * Math.sin(phi),
        c: 6, logR: z_logR,
        size: 1.0 + Math.random() * 0.3,
      });
    }
  }

  const N = all.length;
  const positions = new Float32Array(N * 3);
  const compId    = new Float32Array(N);
  const logR      = new Float32Array(N);
  const baseSize  = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    positions[i*3+0] = all[i].x;
    positions[i*3+1] = all[i].y;
    positions[i*3+2] = all[i].z;
    compId[i]    = all[i].c;
    logR[i]      = all[i].logR;
    baseSize[i]  = all[i].size;
  }
  return { positions, compId, logR, baseSize };
}

// ── Component colors (visible in legend) ─────────────────────────────
const COMP_COLOR_HEX = [
  '#FFE08A',   // 0 disk    — UV/optical, warm gold
  '#A8E0FF',   // 1 corona  — soft X, ice blue
  '#FF7B5A',   // 2 reflect — hard X reflection, fiery orange
  '#FFB070',   // 3 torus   — mid-IR, warm amber
  '#FF6F9A',   // 4 BLR     — emission lines, pink
  '#6FB5FF',   // 5 jet sync — radio, blue
  '#C97FFF',   // 6 jet IC  — gamma, violet
];
const COMP_LABELS = ['disco', 'corona', 'reflection', 'torus polvo', 'BLR (líneas)', 'jet sincrotrón', 'jet IC γ'];

// ── Points mesh ──────────────────────────────────────────────────────
function ParticleQuasar({ data, logNu, particles }: { data: SEDData; logNu: number; particles: ParticleSet }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const brightnessRef = useRef<Float32Array | null>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);

  // Pre-build color palette uniform (vec3 array)
  const colorPalette = useMemo(() => {
    return COMP_COLOR_HEX.map(hex => {
      const c = new THREE.Color(hex);
      return new THREE.Vector3(c.r, c.g, c.b);
    });
  }, []);

  // Initialize brightness buffer
  useMemo(() => {
    brightnessRef.current = new Float32Array(particles.compId.length);
  }, [particles]);

  // Recompute brightness when logNu changes
  useEffect(() => {
    if (!brightnessRef.current || !geomRef.current) return;
    const N = particles.compId.length;
    for (let i = 0; i < N; i++) {
      const c = particles.compId[i] | 0;
      const lr = particles.logR[i];
      brightnessRef.current[i] = lookup(data, c, logNu, lr);
    }
    // Normalize to bring out per-frame contrast
    let maxB = 0;
    for (let i = 0; i < N; i++) if (brightnessRef.current[i] > maxB) maxB = brightnessRef.current[i];
    if (maxB > 0) {
      for (let i = 0; i < N; i++) brightnessRef.current[i] /= maxB;
    }
    const attr = geomRef.current.attributes.brightness as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }, [data, logNu, particles]);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position"   args={[particles.positions, 3]} count={particles.compId.length} itemSize={3} array={particles.positions} />
        <bufferAttribute attach="attributes-compId"     args={[particles.compId,    1]} count={particles.compId.length} itemSize={1} array={particles.compId} />
        <bufferAttribute attach="attributes-baseSize"   args={[particles.baseSize,  1]} count={particles.compId.length} itemSize={1} array={particles.baseSize} />
        <bufferAttribute attach="attributes-brightness" args={[brightnessRef.current!, 1]} count={particles.compId.length} itemSize={1} array={brightnessRef.current!} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uPixelRatio: { value: window.devicePixelRatio },
          uColors: { value: colorPalette },
        }}
        vertexShader={`
          attribute float compId;
          attribute float baseSize;
          attribute float brightness;
          uniform float uTime;
          uniform float uPixelRatio;
          uniform vec3 uColors[7];
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            int cId = int(compId + 0.5);
            vec3 base = uColors[cId];
            // Brightness pow para mejor contraste perceptual
            float vis = pow(brightness, 0.45);
            vColor = base * (0.4 + 0.8 * vis);
            vAlpha = clamp(vis * 0.9 + 0.05, 0.05, 1.0);

            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float dist = -mv.z;
            // Size attenuated by distance + scaled by visibility
            float sz = baseSize * (1.0 + 1.6 * vis) * 18.0 * uPixelRatio / dist;
            gl_PointSize = clamp(sz, 1.0, 24.0);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            // Round soft sprite
            vec2 d = gl_PointCoord - vec2(0.5);
            float r2 = dot(d, d);
            if (r2 > 0.25) discard;
            float fall = exp(-r2 * 12.0);
            gl_FragColor = vec4(vColor * fall, vAlpha * fall);
          }
        `}
      />
    </points>
  );
}

// ── Central BH — small black sphere with photon ring outline ────────
function CentralBH() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.12, 24, 18]} />
        <meshBasicMaterial color="#000" />
      </mesh>
    </group>
  );
}

// ── SED Graph overlay ─────────────────────────────────────────────────
function SEDGraph({ data, logNu, setLogNu }: { data: SEDData; logNu: number; setLogNu: (v: number) => void }) {
  const curves = useMemo(() => {
    const colors = COMP_COLOR_HEX;
    const out: { name: string; color: string; points: { x: number; y: number }[]; max: number }[] = [];
    for (let c = 0; c < data.N_C; c++) {
      const vals: number[] = [];
      let maxV = 0;
      for (let iν = 0; iν < data.N_NU; iν++) {
        let sum = 0;
        for (let ir = 0; ir < data.N_R; ir++) {
          sum += data.tensor[c * data.N_NU * data.N_R + iν * data.N_R + ir];
        }
        vals.push(sum);
        if (sum > maxV) maxV = sum;
      }
      const points = vals.map((v, i) => ({
        x: data.logNuMin + i * (data.logNuMax - data.logNuMin) / (data.N_NU - 1),
        y: v / Math.max(1e-30, maxV),
      }));
      out.push({ name: data.components[c], color: colors[c], points, max: maxV });
    }
    return out;
  }, [data]);

  // Dominant component at current ν
  const dominant = useMemo(() => {
    let bestC = -1, bestV = -Infinity;
    for (let c = 0; c < data.N_C; c++) {
      let v = 0;
      for (let ir = 0; ir < data.N_R; ir++) {
        const logR = data.logRMin + ir * (data.logRMax - data.logRMin) / (data.N_R - 1);
        v += lookup(data, c, logNu, logR);
      }
      if (v > bestV) { bestV = v; bestC = c; }
    }
    return bestC;
  }, [data, logNu]);

  const w = 580, h = 130, padX = 40, padY = 14;
  const x = (lν: number) => padX + ((lν - data.logNuMin) / (data.logNuMax - data.logNuMin)) * (w - padX - 14);
  const y = (v: number) => h - padY - v * (h - padY - 18);

  const bandLabels = [
    { lν: 9,  label: 'radio' },
    { lν: 12, label: 'sub-mm' },
    { lν: 14, label: 'IR' },
    { lν: 15, label: 'óptico' },
    { lν: 16, label: 'UV' },
    { lν: 17, label: 'soft X' },
    { lν: 19, label: 'hard X' },
    { lν: 22, label: 'γ' },
  ];

  const nu_now = Math.pow(10, logNu);
  const E_keV = 6.626e-27 * nu_now / 1.602e-12 / 1000;
  const wavelength_m = 2.998e8 / nu_now;
  let wavestr = '';
  if (E_keV > 0.5)                    wavestr = `${E_keV.toFixed(2)} keV`;
  else if (wavelength_m > 1e-3)       wavestr = `λ ${(wavelength_m*1000).toFixed(1)} mm`;
  else if (wavelength_m > 1e-6)       wavestr = `λ ${(wavelength_m*1e6).toFixed(2)} μm`;
  else if (wavelength_m > 1e-9)       wavestr = `λ ${(wavelength_m*1e9).toFixed(0)} nm`;
  else                                wavestr = `λ ${(wavelength_m*1e10).toExponential(1)} Å`;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/75 border border-[#334155] rounded p-3 font-mono backdrop-blur-sm">
      <svg width={w} height={h} style={{ display: 'block' }}>
        {/* Band labels + grid */}
        {bandLabels.map(b => (
          <g key={b.lν}>
            <line x1={x(b.lν)} y1={padY} x2={x(b.lν)} y2={h - padY} stroke="#1e293b" strokeWidth={1} />
            <text x={x(b.lν)} y={h - 2} fontSize={9} fill="#64748b" textAnchor="middle">{b.label}</text>
          </g>
        ))}
        {/* Curves */}
        {curves.map((c, i) => (
          <polyline
            key={c.name}
            fill="none"
            stroke={c.color}
            strokeWidth={i === dominant ? 2 : 1.2}
            strokeOpacity={i === dominant ? 1 : 0.5}
            points={c.points.map(p => `${x(p.x)},${y(p.y)}`).join(' ')}
          />
        ))}
        {/* Current ν vertical line */}
        <line x1={x(logNu)} y1={padY} x2={x(logNu)} y2={h - padY} stroke="#FFE5A0" strokeWidth={1.5} />
      </svg>
      <div className="flex items-center gap-3 mt-1 text-[10px] text-[#94A3B8]">
        <span>log ν = <span className="text-[#FFE5A0]">{logNu.toFixed(2)}</span> · ν = {nu_now.toExponential(1)} Hz · {wavestr}</span>
        <input
          type="range"
          min={data.logNuMin}
          max={data.logNuMax}
          step={0.05}
          value={logNu}
          onChange={(e) => setLogNu(parseFloat(e.target.value))}
          className="flex-1 accent-[#FFE5A0]"
        />
        <span>dominante: <span style={{color: COMP_COLOR_HEX[dominant]}}>{COMP_LABELS[dominant]}</span></span>
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="absolute top-6 right-6 bg-black/65 border border-[#334155] rounded p-2 font-mono text-[10px] backdrop-blur-sm">
      <div className="text-[#94A3B8] mb-1.5 text-[9px] uppercase tracking-wider">componentes</div>
      {COMP_COLOR_HEX.map((col, i) => (
        <div key={i} className="flex items-center gap-2 leading-tight">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />
          <span style={{ color: col }}>{COMP_LABELS[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Scene ────────────────────────────────────────────────────────────
function Scene({ data, logNu, particles }: { data: SEDData; logNu: number; particles: ParticleSet }) {
  return (
    <>
      <CentralBH />
      <ParticleQuasar data={data} logNu={logNu} particles={particles} />
    </>
  );
}

const gl = makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });

function QuasarSED() {
  const [data, setData] = useState<SEDData | null>(null);
  const [logNu, setLogNu] = useState(15.2);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadSED().then(setData).catch(e => setErr(String(e)));
  }, []);

  // Generate particles ONCE (heavy: ~38k)
  const particles = useMemo(() => buildParticles(), []);

  if (err)  return <div className="text-red-400 p-6 font-mono">SED load failed: {err}</div>;
  if (!data) return <div className="text-[#94A3B8] p-6 font-mono">loading SED tensor…</div>;

  return (
    <div className="w-full h-full relative" style={{ background: '#05060A' }}>
      <Canvas
        camera={{ position: [6, 3, 9], fov: 50, near: 0.001, far: 200 }}
        gl={gl}
        dpr={[0.55, 1]}
      >
        <Scene data={data} logNu={logNu} particles={particles} />
        <OrbitControls
          enablePan={false}
          enableZoom
          autoRotate
          autoRotateSpeed={0.14}
          minDistance={2}
          maxDistance={30}
        />
        <EffectComposer>
          <Bloom intensity={1.8} luminanceThreshold={0.05} luminanceSmoothing={0.7} radius={0.95} />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] max-w-md space-y-1 pointer-events-none">
        <div className="text-[#FFE5A0] font-semibold">Quasar SED · Operador 𝔄</div>
        <div>M_BH = 10⁹ M☉ · Ṁ = 0.1·Ṁ_Edd · a* = 0.9</div>
        <div className="text-[10px] text-[#475569] mt-2 leading-snug max-w-sm">
          ~38k partículas. La posición (en log r world) es FIJA — disco
          equatorial, corona arriba/abajo, BLR shell, torus polvo,
          jet bipolar parabólico (z ∝ R^1.6). El brillo lee tensor
          j[componente, log ν, log r] vía cara-Mellin doble. Arrastra el
          slider para ver el cuásar en cada banda.
        </div>
      </div>

      <Legend />
      <SEDGraph data={data} logNu={logNu} setLogNu={setLogNu} />
    </div>
  );
}

export default memo(QuasarSED);
