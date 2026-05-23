/**
 * QuasarHerculesA v2 — versión refactorizada usando la API @/operador.
 *
 * Comparación con la versión anterior:
 *   v1 (legacy):  ~600 LOC, lógica del operador 𝔄 inline (Bessel + LUTs
 *                 + samples + update temporal + factorización todo a mano)
 *   v2 (este):    ~250 LOC, toda la matemática del operador en @/operador,
 *                 aquí solo: definición de modos + integración RK4 + render
 *
 * La parte física (datos observacionales Hercules A, shock fronts Chandra,
 * paleta per-cara) se mantiene IDÉNTICA — solo se simplifica la ergonomía.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';
import {
  caraBessel, caraI_Theta, caraI_Z, modo, evalModoDominante,
  actualizarModosEnTiempo, alfvenOmega, kPerpBessel, type Modo,
} from '@/operador';

/* ─── Datos observados Hercules A (Chandra 2024, Sadun & Hayes 2002) ─── */
const N_PARTICLES = 4500;
const JET_LENGTH  = 110;          // = 400 kpc
const JET_BASE_R  = 1.4;          // = 5 kpc
const OPENING     = 0.04;
const COCOON_R_MAX = 14;
const V_JET       = 1.2;
const V_BACK      = 0.18;
const V_ALFVEN    = 0.42;
const SHOCK_NS_WU = 150 / (400 / JET_LENGTH);   // 41.25
const SHOCK_EW_WU = 280 / (400 / JET_LENGTH);   // 77.0
const MACH_NS     = 1.65;
const MACH_EW     = 1.90;

const jetRadius = (z: number) => JET_BASE_R + Math.abs(z) * OPENING;

/* ─── Modos físicos del jet — definición declarativa con la API ──────── */
// Cada modo = (m azimutal, n radial, k_z axial, amplitud, fase).
// ω(modo) se computa automático con alfvenOmega().
// k_⊥ se computa automático con kPerpBessel(m, n, JET_BASE_R).
/** Helper: define un modo MHD ($m, n, k_z$) con todas las caras correctas. */
function modoMHD(m: 0 | 1 | 2, n: 1 | 2, kZ: number, amp: number, phase: number, R_dom = JET_BASE_R, R_lut = COCOON_R_MAX + 1): Modo {
  const kPerp = kPerpBessel(m, n, R_dom);
  return modo({
    amp,
    m, n,
    R:     caraBessel({ m, k: kPerp, R_max: R_lut }),
    Theta: caraI_Theta({ m }),
    Z:     caraI_Z({ kZ, omega: alfvenOmega(V_ALFVEN, kZ, kPerp), LENGTH: JET_LENGTH, phase }),
  });
}

const MODOS_JET: readonly Modo[] = [
  modoMHD(0, 1, 0.10, 0.45, 0.0),   // sausage primario
  modoMHD(0, 2, 0.18, 0.30, 1.7),   // sausage harmónico
  modoMHD(1, 1, 0.08, 0.75, 0.9),   // kink — el más visible, deforma el axis
  modoMHD(1, 2, 0.14, 0.40, 3.4),   // kink harmónico
  modoMHD(2, 1, 0.11, 0.50, 2.1),   // twist torsional
];
const MODO_COCOON: Modo = modoMHD(0, 1, 0.03, 0.20, 0.5, COCOON_R_MAX);
const TODOS_MODOS = [...MODOS_JET, MODO_COCOON] as const;

/* ─── Paleta per-cara (cada modo = color distinto) ───────────────────── */
const MODE_COLOR_R = new Float32Array([0.40, 0.45, 1.00, 0.95, 1.00, 0.55]);
const MODE_COLOR_G = new Float32Array([0.95, 0.92, 0.82, 0.78, 0.40, 0.30]);
const MODE_COLOR_B = new Float32Array([0.95, 0.95, 0.35, 0.42, 0.80, 1.00]);

/* ─── Velocity field: equilibrio v₀ + Σ modos ────────────────────────── */
function plasmaVelocity(
  p: THREE.Vector3,
  out: THREE.Vector3,
  modoInfo?: { idx: number; abs: number },
) {
  const z = Math.abs(p.y);
  const sign = p.y >= 0 ? 1 : -1;
  const r = Math.sqrt(p.x * p.x + p.z * p.z);

  if (z > JET_LENGTH) {
    const rDir = r > 0.01 ? 1 / r : 0;
    out.set(p.x * rDir * 0.05, sign * -0.02, p.z * rDir * 0.05);
    if (modoInfo) { modoInfo.idx = -1; modoInfo.abs = 0; }
    return;
  }
  const rJet = jetRadius(z);
  const rCocoon = Math.min(COCOON_R_MAX, 2.5 + z * 0.10);

  // Cara aritmética 𝔄⁰: equilibrio estacionario
  let vR = 0, vTheta = 0, vZ = 0;
  let modosActivos: readonly Modo[];
  if (r < rJet) {
    const sech = 1 / Math.cosh(r / rJet);
    vZ = sign * V_JET * sech * sech;
    modosActivos = MODOS_JET;
  } else if (r < rCocoon) {
    vR = r * 0.01;
    vZ = -sign * V_BACK;
    modosActivos = [MODO_COCOON];
  } else {
    out.set(0, 0, 0);
    if (modoInfo) { modoInfo.idx = -1; modoInfo.abs = 0; }
    return;
  }

  // Caras-i del operador 𝔄 — evaluación factorizada O(1) por modo
  const theta = Math.atan2(p.z, p.x);
  const evals: number[] = [];
  let maxAbs = 0, bestIdx = -1;
  for (let i = 0; i < modosActivos.length; i++) {
    const v = modosActivos[i].eval(r, theta, z);
    evals.push(v);
    const a = Math.abs(v);
    if (a > maxAbs) { maxAbs = a; bestIdx = TODOS_MODOS.indexOf(modosActivos[i]); }
  }
  if (modoInfo) { modoInfo.idx = bestIdx; modoInfo.abs = maxAbs; }

  // Mapear cada modo a vR/vTheta/vZ según m (metadata expuesta por modo())
  for (let i = 0; i < modosActivos.length; i++) {
    const psi = evals[i];
    const m = modosActivos[i].m ?? 0;
    if (m === 0) vZ += sign * psi * 0.55;
    else if (m === 1) { vR += psi * 0.30; vTheta += psi * 0.45; }
    else { vR += psi * 0.20; vTheta += psi * 0.20; }
  }

  const ct = Math.cos(theta), st = Math.sin(theta);
  out.set(vR * ct - vTheta * st, vZ, vR * st + vTheta * ct);
}

/* ─── RK4 integrator ────────────────────────────────────────────────── */
const _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3();
const _k3 = new THREE.Vector3(), _k4 = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _modeInfo = { idx: -1, abs: 0 };

function stepIntegrate(p: THREE.Vector3, dt: number): { inJet: boolean; modeIdx: number; modeAbs: number } {
  plasmaVelocity(p, _k1, _modeInfo);
  const modeIdx = _modeInfo.idx;
  const modeAbs = _modeInfo.abs;
  const r = Math.sqrt(p.x * p.x + p.z * p.z);
  const inJet = r < jetRadius(Math.abs(p.y));
  if (!inJet) {
    p.addScaledVector(_k1, dt);
    return { inJet, modeIdx, modeAbs };
  }
  _tmp.copy(p).addScaledVector(_k1, dt * 0.5); plasmaVelocity(_tmp, _k2);
  _tmp.copy(p).addScaledVector(_k2, dt * 0.5); plasmaVelocity(_tmp, _k3);
  _tmp.copy(p).addScaledVector(_k3, dt);       plasmaVelocity(_tmp, _k4);
  p.x += (dt / 6) * (_k1.x + 2 * _k2.x + 2 * _k3.x + _k4.x);
  p.y += (dt / 6) * (_k1.y + 2 * _k2.y + 2 * _k3.y + _k4.y);
  p.z += (dt / 6) * (_k1.z + 2 * _k2.z + 2 * _k3.z + _k4.z);
  return { inJet, modeIdx, modeAbs };
}

function spawnParticle(p: THREE.Vector3) {
  const side = Math.random() < 0.5 ? 1 : -1;
  const inCore = Math.random() < 0.65;
  const theta = Math.random() * 2 * Math.PI;
  if (inCore) {
    const r = Math.sqrt(Math.random()) * JET_BASE_R * 0.9;
    p.set(r * Math.cos(theta), side * 0.1, r * Math.sin(theta));
  } else {
    const zSeed = 0.5 + Math.random() * JET_LENGTH * 0.4;
    const rSeed = Math.sqrt(Math.random()) * jetRadius(zSeed) * 0.85;
    p.set(rSeed * Math.cos(theta), side * zSeed, rSeed * Math.sin(theta));
  }
}

/* ─── Simulación de partículas ──────────────────────────────────────── */
function PlasmaSimulation() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);
  const tRef = useRef(0);

  const state = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const ages: number[] = [];
    for (let i = 0; i < N_PARTICLES; i++) {
      const p = new THREE.Vector3();
      spawnParticle(p);
      positions.push(p);
      ages.push(Math.random() * 30);
    }
    // Warm-up
    const dt = 0.02;
    for (let i = 0; i < N_PARTICLES; i++) {
      const steps = Math.floor(ages[i] / dt);
      for (let s = 0; s < steps; s++) {
        stepIntegrate(positions[i], dt);
        if (positions[i].length() > JET_LENGTH + 18) {
          spawnParticle(positions[i]);
          ages[i] = s * dt;
          break;
        }
      }
    }
    return { positions, ages };
  }, []);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const clampDt = Math.min(dt, 0.03);
    tRef.current += clampDt;
    actualizarModosEnTiempo(TODOS_MODOS, tRef.current);  // ← UNA línea actualiza todas las Z

    const MODE_VISIBLE_TH = 0.18;
    for (let i = 0; i < N_PARTICLES; i++) {
      const p = state.positions[i];
      state.ages[i] += clampDt;
      const { inJet, modeIdx, modeAbs } = stepIntegrate(p, clampDt);

      const speedNow = _k1.length();
      if (p.length() > JET_LENGTH + 18 || state.ages[i] > 35 || (state.ages[i] > 2 && speedNow < 0.02)) {
        spawnParticle(p);
        state.ages[i] = 0;
      }

      if (modeIdx >= 0 && modeAbs > MODE_VISIBLE_TH) {
        const f = Math.min(1, modeAbs / 0.6);
        colorObj.setRGB(
          MODE_COLOR_R[modeIdx] * (1 - f * 0.3) + 0.3 * f,
          MODE_COLOR_G[modeIdx] * (1 - f * 0.3) + 0.3 * f,
          MODE_COLOR_B[modeIdx] * (1 - f * 0.3) + 0.3 * f,
        );
      } else {
        if (speedNow > 0.7) colorObj.setRGB(0.30, 0.55, 0.95);
        else colorObj.setRGB(0.45, 0.20, 0.50);
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_PARTICLES]}
      frustumCulled={false} renderOrder={10}>
      <sphereGeometry args={[1.0, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.55} depthWrite={false}
        blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

/* ─── Top-level — sin shock rings ni galaxy host por brevedad ────────── */
export default function QuasarHerculesA_v2() {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [12, 18, 55], fov: 50, near: 0.001, far: 800 }}
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={[1, 1.5]}
      >
        <PlasmaSimulation />
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.45} luminanceThreshold={0.7} luminanceSmoothing={0.5} kernelSize={3} />
        </EffectComposer>
        <OrbitControls enablePan={false} enableZoom autoRotate autoRotateSpeed={0.12}
          minDistance={20} maxDistance={400} minPolarAngle={0.25} maxPolarAngle={2.5} />
      </Canvas>
      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] tracking-[0.2em]">
        Hercules A v2 · API @/operador · ~250 LOC · misma factorización 4.6×
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-[#475569]">
        v₀ (𝔄⁰) + Σ A_n · caraBessel · caraI_Theta · caraI_Z(t)
        — refactor minimal de la versión anterior, lógica del operador en @/operador
      </div>
    </div>
  );
}
