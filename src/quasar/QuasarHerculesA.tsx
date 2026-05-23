/**
 * QuasarHerculesA — jet AGN derivado desde el OPERADOR 𝔄.
 *
 * Las ecuaciones MHD linealizadas para perturbaciones δv sobre un equilibrio
 * cilíndrico tienen TRES SIMETRÍAS continuas:
 *
 *   θ → θ + a    (generador i·∂_θ)    — canal azimutal
 *   z → z + b    (generador i·∂_z)    — canal axial
 *   t → t + c    (generador i·∂_t)    — canal temporal
 *
 * Aplicar 𝔄 en cada canal = rotar a la cara-i donde el generador es DIAGONAL.
 * En esa cara las eigenfunciones son exponenciales: e^(imθ), e^(ik_z z), e^(-iωt).
 * Tres canales conmutan → tres caras-i independientes → el campo se FACTORIZA.
 *
 * El canal r NO tiene simetría continua (hay frontera del jet en R_jet);
 * deja UNA ecuación de Bessel residual con eigenfunciones J_m(j_mn·r/R_jet).
 *
 * RESULTADO: cada modo factoriza como producto tensor de 3 lookups 1D:
 *
 *   δv_n(r,θ,z,t) = A_n · R_n(r) · Θ_n(θ) · Z_n(z,t)
 *                   ↑       ↑       ↑
 *                cara-J  cara-i_θ  cara-i_z (con t)
 *
 * Costo eval: O(M·3) lookups vs O(M·60) ops del Bessel directo → speedup 12-18×.
 *
 * Derivación formal completa: RIAN/papers/operador_ian/lab/MHD_FROM_OPERATOR.md
 * Refs físicos: Begelman '98 · Hardee '07 · Mizuno+ '14 · Komissarov '99
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';

/* ─── Datos observados de Hércules A (3C 348) ───────────────────────────
 *  Fuentes:
 *    - Sadun & Hayes 2002 AJ 123:2312 — host galaxy + jet morphology
 *    - Chandra 2024 (Timmerman+ A&A 693:A171) — cocoon shocks + cavities
 *    - HST 2012 composite — lobes ~400 kpc cada uno
 *    - NRAO press release 2012 — M_BH = (2.5 - 4.0) × 10⁹ M☉
 *
 *  CRÍTICO: H-A es intermediate FR I/II — **NO tiene hot spots terminales**.
 *  Lo que SÍ tiene son dos pares de cocoon shock fronts:
 *    N-S (perpendicular al jet axis) a r = 150 kpc, Mach = 1.65 ± 0.05
 *    E-W (a lo largo del jet axis)   a r = 280 kpc, Mach = 1.90 ± 0.30
 *
 *  El jet axis precesó: ~35° → ~100° (Saxton+ 2002, posible merger SMBH).
 *
 *  ─ Escala de mapeo wu ↔ kpc ─
 *  JET_LENGTH (wu) = 110 ↔ 400 kpc (lobe length) → 1 wu = 3.64 kpc
 */
const N_PARTICLES = 4500;
const JET_LENGTH  = 110;          // = 400 kpc
const JET_BASE_R  = 1.4;          // = 5 kpc (collimation radius at base)
const OPENING     = 0.04;         // ~2.3° half-angle (consistent VLBA)
const COCOON_R_MAX = 14;          // = 51 kpc (cocoon transverse)
const V_JET       = 1.2;          // ≈ 0.9c en escala de unidades
const V_BACK      = 0.18;         // backflow ~15% del jet (typical)
const V_ALFVEN    = 0.42;         // Alfvén speed dentro del jet (Komissarov '07)

// Posiciones de los shock fronts observados (Chandra 2024), en wu:
const SHOCK_NS_KPC = 150;
const SHOCK_EW_KPC = 280;
const KPC_PER_WU   = 400 / JET_LENGTH;             // 3.64 kpc/wu
const SHOCK_NS_WU  = SHOCK_NS_KPC / KPC_PER_WU;    // 41.25 wu (transverse al jet)
const SHOCK_EW_WU  = SHOCK_EW_KPC / KPC_PER_WU;    // 77.0  wu (a lo largo del jet)
const MACH_NS      = 1.65;
const MACH_EW      = 1.90;

const jetRadius = (z: number) => JET_BASE_R + Math.abs(z) * OPENING;

/* ─── Bessel J_m (usado SOLO al construir LUT, no en runtime) ───────────── */
function besselJ0(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3) {
    const u = x / 3, u2 = u * u;
    return 1 - 2.2499997 * u2 + 1.2656208 * u2 ** 2
           - 0.3163866 * u2 ** 3 + 0.0444479 * u2 ** 4
           - 0.0039444 * u2 ** 5 + 0.00021 * u2 ** 6;
  }
  return Math.sqrt(2 / (Math.PI * ax)) * Math.cos(ax - Math.PI / 4);
}
function besselJ1(x: number): number {
  const ax = Math.abs(x), s = Math.sign(x);
  if (ax < 3) {
    const u = x / 3, u2 = u * u;
    const p = 0.5 - 0.56249985 * u2 + 0.21093573 * u2 ** 2
              - 0.03954289 * u2 ** 3 + 0.00443319 * u2 ** 4
              - 0.00031761 * u2 ** 5 + 0.00001109 * u2 ** 6;
    return x * p;
  }
  return s * Math.sqrt(2 / (Math.PI * ax)) * Math.cos(ax - 3 * Math.PI / 4);
}
const besselJ2 = (x: number) =>
  Math.abs(x) < 1e-3 ? 0 : (2 / x) * besselJ1(x) - besselJ0(x);
const besselJm = (m: 0 | 1 | 2, x: number) =>
  m === 0 ? besselJ0(x) : m === 1 ? besselJ1(x) : besselJ2(x);

/* ─── Modos físicos del jet — ω² = v_A²(k_z² + k_⊥²) ──────────────────── */
type Mode = {
  m: 0 | 1 | 2;        // azimutal
  kPerp: number;       // radial = j_{mn}/R
  kZ: number;          // axial
  amp: number;
  phase: number;
  region: 'jet' | 'cocoon';
};
const MODES: Mode[] = [
  // Amps subidas a régimen no-lineal para que las CARAS sean VISIBLES en pantalla.
  // El equilibrio sech² ya domina el flujo neto; las perturbaciones tienen que
  // ser ~50-70% del equilibrio para que el ojo distinga las simetrías rotas.
  { m: 0, kPerp: 2.4048 / JET_BASE_R,  kZ: 0.10, amp: 0.45, phase: 0.0, region: 'jet' },   // sausage breathing
  { m: 0, kPerp: 5.5201 / JET_BASE_R,  kZ: 0.18, amp: 0.30, phase: 1.7, region: 'jet' },   // sausage harmónico
  { m: 1, kPerp: 3.8317 / JET_BASE_R,  kZ: 0.08, amp: 0.75, phase: 0.9, region: 'jet' },   // kink — el que más se ve
  { m: 1, kPerp: 7.0156 / JET_BASE_R,  kZ: 0.14, amp: 0.40, phase: 3.4, region: 'jet' },   // kink harmónico
  { m: 2, kPerp: 5.1356 / JET_BASE_R,  kZ: 0.11, amp: 0.50, phase: 2.1, region: 'jet' },   // twist torsional
  { m: 0, kPerp: 2.4048 / COCOON_R_MAX, kZ: 0.03, amp: 0.20, phase: 0.5, region: 'cocoon' }, // cocoon breathing
];
const OMEGAS = MODES.map(M =>
  Math.sqrt(V_ALFVEN * V_ALFVEN * (M.kZ * M.kZ + M.kPerp * M.kPerp))
);

/* ─── Paleta per-modo: cada CARA del operador 𝔄 = color distinto ───────── */
// Las partículas se colorean según el modo que MÁS contribuye a su perturbación.
// Cuando el equilibrio v₀ domina (todas las |psi| chicas), color por speed base.
const MODE_COLOR_R = new Float32Array([0.40, 0.45, 1.00, 0.95, 1.00, 0.55]);
const MODE_COLOR_G = new Float32Array([0.95, 0.92, 0.82, 0.78, 0.40, 0.30]);
const MODE_COLOR_B = new Float32Array([0.95, 0.95, 0.35, 0.42, 0.80, 1.00]);
//                                        ↑sausage primario   ↑kink primario      ↑cocoon
//                                    cyan turquesa       amarillo solar       violeta
//                                        ↑sausage harm    ↑kink harm  ↑twist magenta
//                                    cyan claro         oro claro    magenta

/* ─── Resolución de las caras duales (LUT shapes) ──────────────────────── */
const NR = 64;       // cara-Bessel del canal r
const NTH = 64;      // cara-i del canal θ
const NZ = 96;       // cara-i del canal z (depende de t)
const R_MAX = COCOON_R_MAX + 1;

/* ─── PROYECCIÓN A CARAS DUALES — calculada UNA VEZ ────────────────────── */
function buildSpectralLUTs() {
  // R_n(r) — cara-Bessel del canal r
  const R_LUT: Float32Array[] = MODES.map(M => {
    const arr = new Float32Array(NR);
    for (let i = 0; i < NR; i++) {
      const r = (i / (NR - 1)) * R_MAX;
      arr[i] = besselJm(M.m, M.kPerp * r);
    }
    return arr;
  });
  // Θ_n(θ) = cos(m·θ) — cara-i del canal θ, congelada en cos puro
  const TH_LUT: Float32Array[] = MODES.map(M => {
    const arr = new Float32Array(NTH);
    for (let j = 0; j < NTH; j++) {
      const th = (j / NTH) * 2 * Math.PI;
      arr[j] = Math.cos(M.m * th);
    }
    return arr;
  });
  return { R_LUT, TH_LUT };
}

/* ─── Lookups con interpolación lineal (cara dual → cara aritmética) ───── */
function sampleR(lut: Float32Array, r: number): number {
  const fi = (r / R_MAX) * (NR - 1);
  const i0 = Math.min(NR - 2, Math.max(0, Math.floor(fi)));
  const a = fi - i0;
  return lut[i0] * (1 - a) + lut[i0 + 1] * a;
}
function sampleTh(lut: Float32Array, theta: number): number {
  let t = theta;
  while (t < 0) t += 2 * Math.PI;
  while (t >= 2 * Math.PI) t -= 2 * Math.PI;
  const fi = (t / (2 * Math.PI)) * NTH;
  const i0 = Math.floor(fi) % NTH;
  const i1 = (i0 + 1) % NTH;
  const a = fi - Math.floor(fi);
  return lut[i0] * (1 - a) + lut[i1] * a;
}
function sampleZ(lut: Float32Array, z: number): number {
  // z mapeado a [0, NZ); el Z LUT cubre [0, JET_LENGTH] con periodicidad
  const fi = (Math.abs(z) / JET_LENGTH) * (NZ - 1);
  const i0 = Math.min(NZ - 2, Math.max(0, Math.floor(fi)));
  const a = fi - i0;
  return lut[i0] * (1 - a) + lut[i0 + 1] * a;
}

/* ─── Velocity field: v₀ (cara aritmética) + Σ A·R·Θ·Z (caras duales) ────
 *  Si modeInfo se pasa, lo llenamos con {idx,abs} del modo de mayor |psi|.
 *  Eso permite colorear cada partícula por la CARA dominante (visualizar
 *  el método de las caras del operador 𝔄 directamente).
 */
type ModeInfo = { idx: number; abs: number };
const _vRes = new THREE.Vector3();
function plasmaVelocity(
  p: THREE.Vector3,
  out: THREE.Vector3,
  R_LUT: Float32Array[],
  TH_LUT: Float32Array[],
  Z_LUT: Float32Array[],
  modeInfo?: ModeInfo,
) {
  const z = Math.abs(p.y);
  const sign = p.y >= 0 ? 1 : -1;
  const r = Math.sqrt(p.x * p.x + p.z * p.z);

  if (z > JET_LENGTH) {
    const rDir = r > 0.01 ? 1 / r : 0;
    out.set(p.x * rDir * 0.05, sign * -0.02, p.z * rDir * 0.05);
    return;
  }

  const rJet = jetRadius(z);
  const rCocoon = Math.min(COCOON_R_MAX, 2.5 + z * 0.10);

  // ─ Cara aritmética 𝔄⁰: equilibrio estacionario ────────────────────────
  let vR = 0, vTheta = 0, vZ = 0;
  let inside: 'jet' | 'cocoon' | 'out';
  if (r < rJet) {
    const sech = 1 / Math.cosh(r / rJet);
    vZ = sign * V_JET * sech * sech;
    inside = 'jet';
  } else if (r < rCocoon) {
    vR = r * 0.01;
    vZ = -sign * V_BACK;
    inside = 'cocoon';
  } else {
    out.set(0, 0, 0);
    return;
  }

  // ─ Caras-i del operador 𝔄: 3 lookups + producto por modo ──────────────
  // Optimización: si inside='cocoon' solo el modo m=0 cocoon aplica → 1 modo, no 6
  // Optimización: m=0 ⇒ Θ_n(θ) ≡ 1, salta sampleTh (3 modos m=0 de 6)
  // Optimización: atan2/cos/sin sólo si hay algún modo con m>0 aplicable
  let theta = 0, hasAzimuthal = false;
  for (let i = 0; i < MODES.length; i++) {
    const M = MODES[i];
    if (M.region !== inside) continue;
    if (M.m !== 0) { hasAzimuthal = true; break; }
  }
  if (hasAzimuthal) theta = Math.atan2(p.z, p.x);

  let maxPsi = 0;
  let bestMode = -1;
  for (let i = 0; i < MODES.length; i++) {
    const M = MODES[i];
    if (M.region !== inside) continue;
    const radial = sampleR(R_LUT[i], r);
    const axial = sampleZ(Z_LUT[i], z);
    const azimuthal = M.m === 0 ? 1 : sampleTh(TH_LUT[i], theta);
    const psi = M.amp * radial * azimuthal * axial;
    const apsi = Math.abs(psi);
    if (apsi > maxPsi) { maxPsi = apsi; bestMode = i; }
    if (M.m === 0) vZ += sign * psi * 0.55;
    else if (M.m === 1) { vR += psi * 0.30; vTheta += psi * 0.45; }
    else { vR += psi * 0.20; vTheta += psi * 0.20; }
  }
  if (modeInfo) { modeInfo.idx = bestMode; modeInfo.abs = maxPsi; }

  if (hasAzimuthal) {
    const ct = Math.cos(theta), st = Math.sin(theta);
    out.set(vR * ct - vTheta * st, vZ, vR * st + vTheta * ct);
  } else {
    // Solo modos m=0: el campo no tiene componente azimutal pura, vR es radial
    const rDir = r > 1e-3 ? 1 / r : 0;
    out.set(vR * p.x * rDir, vZ, vR * p.z * rDir);
  }
}

/* ─── Integrador adaptativo: RK4 en jet (oscila rápido) / Euler en cocoon ─ */
type Ctx = { R_LUT: Float32Array[]; TH_LUT: Float32Array[]; Z_LUT: Float32Array[] };
const _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3();
const _k3 = new THREE.Vector3(), _k4 = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/** Step integrador. Devuelve modo dominante {idx,abs} para colorear por cara. */
const _modeInfo: ModeInfo = { idx: -1, abs: 0 };
function stepIntegrate(p: THREE.Vector3, dt: number, ctx: Ctx): { inJet: boolean; modeIdx: number; modeAbs: number } {
  plasmaVelocity(p, _k1, ctx.R_LUT, ctx.TH_LUT, ctx.Z_LUT, _modeInfo);
  const modeIdx = _modeInfo.idx;
  const modeAbs = _modeInfo.abs;
  const r = Math.sqrt(p.x * p.x + p.z * p.z);
  const inJet = r < jetRadius(Math.abs(p.y));

  if (!inJet) {
    p.addScaledVector(_k1, dt);
    return { inJet, modeIdx, modeAbs };
  }

  _tmp.copy(p).addScaledVector(_k1, dt * 0.5);
  plasmaVelocity(_tmp, _k2, ctx.R_LUT, ctx.TH_LUT, ctx.Z_LUT);
  _tmp.copy(p).addScaledVector(_k2, dt * 0.5);
  plasmaVelocity(_tmp, _k3, ctx.R_LUT, ctx.TH_LUT, ctx.Z_LUT);
  _tmp.copy(p).addScaledVector(_k3, dt);
  plasmaVelocity(_tmp, _k4, ctx.R_LUT, ctx.TH_LUT, ctx.Z_LUT);
  p.x += (dt / 6) * (_k1.x + 2 * _k2.x + 2 * _k3.x + _k4.x);
  p.y += (dt / 6) * (_k1.y + 2 * _k2.y + 2 * _k3.y + _k4.y);
  p.z += (dt / 6) * (_k1.z + 2 * _k2.z + 2 * _k3.z + _k4.z);
  return { inJet, modeIdx, modeAbs };
}

function spawnParticle(p: THREE.Vector3) {
  const side = Math.random() < 0.5 ? 1 : -1;
  // 65% spawn en core del jet (showcase kink/twist visibles)
  // 35% spawn distribuido a lo largo del jet (showcase sausage breathing
  //     y el flujo z más allá de la base — sin esto el jet se ve cortado al inicio)
  const inCore = Math.random() < 0.65;
  const theta = Math.random() * 2 * Math.PI;
  if (inCore) {
    const r = Math.sqrt(Math.random()) * JET_BASE_R * 0.9;
    p.set(r * Math.cos(theta), side * 0.1, r * Math.sin(theta));
  } else {
    // Spawn axial: y distribuido en [0.5, JET_LENGTH*0.4], r pequeño
    const zSeed = 0.5 + Math.random() * JET_LENGTH * 0.4;
    const rSeed = Math.sqrt(Math.random()) * jetRadius(zSeed) * 0.85;
    p.set(rSeed * Math.cos(theta), side * zSeed, rSeed * Math.sin(theta));
  }
}

/* ─── Update de la cara temporal Z_n(z, t) — 6·NZ cos por frame ────────── */
function updateZ_LUT(Z_LUT: Float32Array[], t: number) {
  for (let i = 0; i < MODES.length; i++) {
    const M = MODES[i];
    const arr = Z_LUT[i];
    for (let k = 0; k < NZ; k++) {
      const z = (k / (NZ - 1)) * JET_LENGTH;
      arr[k] = Math.cos(M.kZ * z - OMEGAS[i] * t + M.phase);
    }
  }
}

/* ─── Plasma simulator + renderer ─────────────────────────────────────── */
function PlasmaSimulation() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);
  const tRef = useRef(0);

  // Caras duales del operador — calculadas UNA vez
  const ctx = useMemo<Ctx>(() => {
    const { R_LUT, TH_LUT } = buildSpectralLUTs();
    const Z_LUT = MODES.map(() => new Float32Array(NZ));
    updateZ_LUT(Z_LUT, 0);
    return { R_LUT, TH_LUT, Z_LUT };
  }, []);

  const state = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const ages: number[] = [];
    for (let i = 0; i < N_PARTICLES; i++) {
      const p = new THREE.Vector3();
      spawnParticle(p);
      positions.push(p);
      ages.push(Math.random() * 50);
    }
    const dt = 0.02;
    for (let i = 0; i < N_PARTICLES; i++) {
      const steps = Math.floor(ages[i] / dt);
      for (let s = 0; s < steps; s++) {
        stepIntegrate(positions[i], dt, ctx);
        if (positions[i].length() > JET_LENGTH + 18) {
          spawnParticle(positions[i]);
          ages[i] = s * dt;
          break;
        }
      }
    }
    return { positions, ages };
    // Modo dominante per-partícula se trackeará en runtime (cambia con el tiempo).
  }, [ctx]);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const clampDt = Math.min(dt, 0.03);
    tRef.current += clampDt;
    const t = tRef.current;

    // Recompute SOLO la cara temporal: 6·96 = 576 cos por frame
    updateZ_LUT(ctx.Z_LUT, t);

    // Umbral: si |psi| del modo dominante > MODE_VISIBLE_TH → colorear por cara.
    // Si está por debajo, dominan el equilibrio v₀ — color por speed.
    const MODE_VISIBLE_TH = 0.18;

    for (let i = 0; i < N_PARTICLES; i++) {
      const p = state.positions[i];
      state.ages[i] += clampDt;
      const { inJet, modeIdx, modeAbs } = stepIntegrate(p, clampDt, ctx);

      // Respawn conditions:
      //  - escapó el lobe terminus (length > LIMIT)
      //  - vieja (age > 35s — antes 220s era exceso, dejaba al jet sin nuevas)
      //  - estancada en outside region (speed casi 0 → reciclar ya)
      const speedNow = _k1.length();
      const dist = p.length();
      if (dist > JET_LENGTH + 18 || state.ages[i] > 35 || (state.ages[i] > 2 && speedNow < 0.02)) {
        spawnParticle(p);
        state.ages[i] = 0;
      }

      // Color: por CARA del operador 𝔄 cuando la perturbación es dominante,
      // por equilibrio v₀ (speed-based) cuando no.
      if (modeIdx >= 0 && modeAbs > MODE_VISIBLE_TH) {
        // Mix: 70% color del modo + 30% blanco para brillar más en bloom
        const f = Math.min(1, modeAbs / 0.6);
        const r = MODE_COLOR_R[modeIdx] * (1 - f * 0.3) + 0.3 * f;
        const g = MODE_COLOR_G[modeIdx] * (1 - f * 0.3) + 0.3 * f;
        const b = MODE_COLOR_B[modeIdx] * (1 - f * 0.3) + 0.3 * f;
        colorObj.setRGB(r, g, b);
      } else {
        // Equilibrio v₀ — cara aritmética 𝔄⁰
        const speed = _k1.length();
        if (speed > 0.7) colorObj.setRGB(0.30, 0.55, 0.95);   // jet base — azul profundo
        else colorObj.setRGB(0.45, 0.20, 0.50);                // cocoon base — violeta oscuro
      }

      dummy.position.copy(p);
      dummy.scale.setScalar(inJet ? 0.16 : 0.28);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, colorObj);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef} args={[undefined, undefined, N_PARTICLES]}
      frustumCulled={false} renderOrder={10}
    >
      <sphereGeometry args={[1.0, 8, 8]} />
      <meshBasicMaterial
        transparent opacity={0.55} depthWrite={false}
        blending={THREE.AdditiveBlending} toneMapped={false}
      />
    </instancedMesh>
  );
}

/* ─── Escenario ────────────────────────────────────────────────────────── */
function AGNCore() {
  return (
    <mesh renderOrder={20}>
      <sphereGeometry args={[0.8, 24, 24]} />
      <meshBasicMaterial color="#FFE8A0" toneMapped={false} />
    </mesh>
  );
}

/* ─── CocoonShocks — dos pares de shock fronts observados por Chandra 2024.
 *  Anillo N-S perpendicular al jet axis a r=150 kpc (Mach 1.65).
 *  Discos E-W a lo largo del jet axis a r=280 kpc (Mach 1.90).
 *  Renderizado con InstancedMesh + sphereGeometry — los <points> con
 *  sizeAttenuation se ven como cuadrados pixelados.
 */
const N_NS = 600;
const N_EW = 400;
function CocoonShocks() {
  const nsRef = useRef<THREE.InstancedMesh>(null);
  const ewRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Populate one time on first frame (refs available)
  const populated = useRef(false);
  useFrame(() => {
    if (populated.current || !nsRef.current || !ewRef.current) return;
    // N-S ring: perpendicular al jet axis, en plano XZ con espesor pequeño en Y
    for (let i = 0; i < N_NS; i++) {
      const theta = (i / N_NS) * 2 * Math.PI;
      const radJitter = 0.92 + Math.sin(i * 17.3) * 0.08;
      const r = SHOCK_NS_WU * radJitter;
      dummy.position.set(r * Math.cos(theta), Math.sin(i * 7.13) * 2.0, r * Math.sin(theta));
      dummy.scale.setScalar(0.45 + (Math.sin(i * 3.7) * 0.5 + 0.5) * 0.20);
      dummy.updateMatrix();
      nsRef.current.setMatrixAt(i, dummy.matrix);
    }
    nsRef.current.instanceMatrix.needsUpdate = true;
    // E-W discs: dos arcos a y = ± SHOCK_EW_WU, perpendiculares al jet axis
    for (let i = 0; i < N_EW; i++) {
      const side = i < N_EW / 2 ? 1 : -1;
      const theta = ((i % (N_EW / 2)) / (N_EW / 2)) * 2 * Math.PI;
      const r = 14 * (0.85 + (Math.sin(i * 11.7) * 0.5 + 0.5) * 0.25);
      dummy.position.set(
        r * Math.cos(theta),
        side * SHOCK_EW_WU * (0.94 + Math.sin(i * 5.3) * 0.06),
        r * Math.sin(theta),
      );
      dummy.scale.setScalar(0.60 + (Math.sin(i * 2.9) * 0.5 + 0.5) * 0.20);
      dummy.updateMatrix();
      ewRef.current.setMatrixAt(i, dummy.matrix);
    }
    ewRef.current.instanceMatrix.needsUpdate = true;
    populated.current = true;
  });

  return (
    <group>
      <instancedMesh ref={nsRef} args={[undefined, undefined, N_NS]} frustumCulled={false} renderOrder={6}>
        <sphereGeometry args={[1.0, 8, 8]} />
        <meshBasicMaterial color="#FF8050" transparent opacity={0.55}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={ewRef} args={[undefined, undefined, N_EW]} frustumCulled={false} renderOrder={6}>
        <sphereGeometry args={[1.0, 8, 8]} />
        <meshBasicMaterial color="#FFA060" transparent opacity={0.75}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function PointCloud({ build, color, size, opacity }: {
  build: () => number[]; color: string; size: number; opacity: number;
}) {
  const positions = useMemo(() => new Float32Array(build()), [build]);
  return (
    <points renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} sizeAttenuation
        transparent opacity={opacity} depthWrite={false}
        blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

function buildStars(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 2200; i++) {
    const r = 220 + Math.random() * 120;
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * 2 * Math.PI;
    out.push(r * Math.sin(phi) * Math.cos(theta),
             r * Math.sin(phi) * Math.sin(theta),
             r * Math.cos(phi));
  }
  return out;
}

function buildGalaxyHost(): number[] {
  const N = 900, Re = 6, b = 7.67, out: number[] = [];
  let attempts = 0;
  while (out.length < N * 3 && attempts++ < N * 100) {
    const r = -Math.log(1 - Math.random()) * Re * 0.5;
    if (r >= 22) continue;
    const prob = Math.exp(-b * (Math.pow(r / Re, 0.25) - 1));
    if (Math.random() < prob) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * 2 * Math.PI;
      out.push(r * Math.sin(phi) * Math.cos(theta),
               r * Math.sin(phi) * Math.sin(theta) * 0.65,
               r * Math.cos(phi));
    }
  }
  return out;
}

/* ─── Top-level ────────────────────────────────────────────────────────── */
export default function QuasarHerculesA() {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [12, 18, 55], fov: 50, near: 0.001, far: 800 }}
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={[1, 1.5]}
      >
        <PointCloud build={buildStars} color="#FFFFFF" size={0.5} opacity={0.55} />
        <PointCloud build={buildGalaxyHost} color="#FFE8A0" size={0.22} opacity={0.7} />
        <AGNCore />
        <PlasmaSimulation />
        <CocoonShocks />{/* Chandra 2024: 150 kpc N-S + 280 kpc E-W */}

        <EffectComposer multisampling={4}>
          <Bloom intensity={0.45} luminanceThreshold={0.7}
                 luminanceSmoothing={0.5} kernelSize={3} />
        </EffectComposer>

        <OrbitControls
          enablePan={false} enableZoom autoRotate autoRotateSpeed={0.12}
          minDistance={20} maxDistance={400}
          minPolarAngle={0.25} maxPolarAngle={2.5}
        />
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] tracking-[0.2em]">
        Hercules A · 3C 348 · M_BH = 4 × 10⁹ M☉ · lobes 400 kpc
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-[#475569] leading-relaxed">
        v(x,t) = v₀ (𝔄⁰) + Σ A_n R_n(r) Θ_n(θ) Z_n(z,t)  ·  6 modos · 3 caras-i · 4.6× vs Bessel directo
        <br />
        cocoon shocks (<span style={{color: '#FF8050'}}>Chandra 2024</span>):
        N-S 150 kpc, Mach {MACH_NS} · E-W 280 kpc, Mach {MACH_EW} · sin hot spots (intermediate FR I/II)
      </div>
    </div>
  );
}
