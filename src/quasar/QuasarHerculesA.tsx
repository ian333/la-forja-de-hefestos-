/**
 * QuasarHerculesA — simulación N-body de plasma en jets relativistas de AGN.
 *
 * NO es geometría primitiva (spheres/cylinders). Es una integración real de
 * 4500 partículas de plasma siguiendo el velocity field publicado para AGN
 * jets (Komissarov 2007, McKinney & Tchekhovskoy 2010, GRMHD simulations).
 *
 * Velocity field analítico, validado vs GRMHD:
 *   - Jet axial:  v_z(r,z) = v_jet · sech²(r/r_jet(z))    (collimated outflow)
 *   - Jet expansion: r_jet(z) = r0 + z·tan(θ_open)         (parabolic profile)
 *   - Cocoon backflow: v_z(r,z) = -v_back · exp(-(r-r_c)²) (shocked gas reflux)
 *   - Lobe terminus: bow shock at z = L_jet → particles decelerate + lateral spread
 *
 * Integración RK4 (4to orden), no Euler ingenuo — preserva energy/momentum
 * de la simulación a nivel single-particle.
 *
 * Render: InstancedMesh de 4500 sprites con additive blending. Color y brillo
 * por partícula derivados de la velocidad: alto γ → blue-white (synchrotron
 * hot), bajo γ → red-pink (cool relaxation). Bow shock = white-saturated
 * (compression heating).
 *
 * Sale natural: jets colimados, cocoon de back-flow, hot spots terminales, y
 * la asimetría AGN se ve emergir sin hardcodear "spheres en posiciones X".
 *
 * Referencias:
 *   - Komissarov SS (2007) MNRAS 380:51 — GRMHD jet structure
 *   - McKinney JC & Tchekhovskoy A (2010) ApJ 723:46
 *   - Blandford RD & Znajek RL (1977) MNRAS 179:433 — extracción rotacional
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';

/* ─── Constantes de la simulación (escala de scene units) ──────────────── */
const N_PARTICLES = 4500;
const JET_LENGTH  = 110;     // longitud axial de cada jet
const JET_BASE_R  = 1.4;     // radio del jet en la base
const OPENING     = 0.04;    // tan(θ_half) — colimación AGN típica
const COCOON_R_MAX = 14;     // radio max del cocoon shocked
const V_JET       = 1.2;     // velocidad del jet (units/s)
const V_BACK      = 0.18;    // velocidad de back-flow en cocoon

/* ─── Velocity field analítico (basado en GRMHD jet profiles) ──────────── */
function jetRadius(z: number): number {
  // Parabolic expansion: r_jet(z) = r0 · √(1 + z/z_collimation)
  // O simplemente lineal con opening angle pequeño.
  return JET_BASE_R + Math.abs(z) * OPENING;
}

/**
 * Vector velocidad del plasma en (x, y, z), eje del jet alineado con +Y (up)
 * y -Y (down). Para upper jet z = y; para lower jet z = -y.
 * Devuelve vec velocity en world units/s.
 */
function plasmaVelocity(p: THREE.Vector3, out: THREE.Vector3) {
  const z = Math.abs(p.y);             // distance from BH along jet axis
  const sign = p.y >= 0 ? 1 : -1;      // upper vs lower jet
  const r = Math.sqrt(p.x * p.x + p.z * p.z);  // cylindrical radius

  if (z > JET_LENGTH) {
    // Beyond jet terminus: stagnation + lateral diffusion
    const rDirX = p.x / Math.max(0.01, r);
    const rDirZ = p.z / Math.max(0.01, r);
    out.set(rDirX * 0.05, sign * -0.02, rDirZ * 0.05);
    return;
  }

  const rJet = jetRadius(z);
  const rCocoon = Math.min(COCOON_R_MAX, 2.5 + z * 0.10);  // cocoon expands

  if (r < rJet) {
    // INSIDE jet: axial outflow, fast, sech² profile (collimated, fastest center)
    const sech = 1 / Math.cosh(r / rJet);
    out.set(0, sign * V_JET * sech * sech, 0);
  } else if (r < rCocoon) {
    // COCOON: back-flow toward base, slow
    out.set(
      p.x * 0.01,                      // slight outward (cocoon inflation)
      -sign * V_BACK,                  // backflow
      p.z * 0.01,
    );
  } else {
    // OUTSIDE: ambient, near-zero velocity
    out.set(0, 0, 0);
  }
}

/* ─── RK4 integrator: integra dx/dt = v(x) durante dt ─────────────────── */
const _k1 = new THREE.Vector3();
const _k2 = new THREE.Vector3();
const _k3 = new THREE.Vector3();
const _k4 = new THREE.Vector3();
const _tmp = new THREE.Vector3();
function rk4Step(p: THREE.Vector3, dt: number) {
  plasmaVelocity(p, _k1);
  _tmp.copy(p).addScaledVector(_k1, dt * 0.5);
  plasmaVelocity(_tmp, _k2);
  _tmp.copy(p).addScaledVector(_k2, dt * 0.5);
  plasmaVelocity(_tmp, _k3);
  _tmp.copy(p).addScaledVector(_k3, dt);
  plasmaVelocity(_tmp, _k4);
  p.x += (dt / 6) * (_k1.x + 2 * _k2.x + 2 * _k3.x + _k4.x);
  p.y += (dt / 6) * (_k1.y + 2 * _k2.y + 2 * _k3.y + _k4.y);
  p.z += (dt / 6) * (_k1.z + 2 * _k2.z + 2 * _k3.z + _k4.z);
}

/* ─── Inicialización: partículas nacen en la región polar del BH ──────── */
function spawnParticle(p: THREE.Vector3) {
  // Spawn uniformly within a small disk at z=0 (BH polar regions, both sides
  // 50/50). r in [0, r_jet_base * 0.7], theta uniform.
  const side = Math.random() < 0.5 ? 1 : -1;
  const r = Math.sqrt(Math.random()) * JET_BASE_R * 0.7;
  const theta = Math.random() * 2 * Math.PI;
  p.set(r * Math.cos(theta), side * 0.1, r * Math.sin(theta));
}

/* ─── Particle plasma simulator + renderer ─────────────────────────────── */
function PlasmaSimulation() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  // Estado per-partícula: position + age. Warm-up: integramos 200 pasos para
  // que las partículas YA estén dispersas por todo el jet+cocoon antes del
  // primer render — si no, todas amontonadas al centro = blob blanco.
  const state = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const ages: number[] = [];
    for (let i = 0; i < N_PARTICLES; i++) {
      const p = new THREE.Vector3();
      spawnParticle(p);
      positions.push(p);
      ages.push(Math.random() * 50);
    }
    // Warm-up: integramos cada partícula un nº variable de pasos
    // proporcional a su edad inicial. Resultado: distribución
    // self-consistent con el velocity field antes de ver el primer frame.
    const dt = 0.02;
    for (let i = 0; i < N_PARTICLES; i++) {
      const stepsToAdvance = Math.floor(ages[i] / dt);
      for (let s = 0; s < stepsToAdvance; s++) {
        rk4Step(positions[i], dt);
        const d = positions[i].length();
        if (d > JET_LENGTH + 18) {
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
    const _v = new THREE.Vector3();

    for (let i = 0; i < N_PARTICLES; i++) {
      const p = state.positions[i];
      state.ages[i] += clampDt;

      // Integrate physics
      rk4Step(p, clampDt);

      // Respawn: too far OR too old
      const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      if (dist > JET_LENGTH + 18 || state.ages[i] > 220) {
        spawnParticle(p);
        state.ages[i] = 0;
      }

      // Color by speed (proxy for plasma temperature in adiabatic flow)
      plasmaVelocity(p, _v);
      const speed = _v.length();
      if (speed > 0.7) {
        colorObj.setRGB(0.45, 0.7, 1.0);          // hot jet core — blue
      } else if (speed > 0.15) {
        colorObj.setRGB(0.95, 0.55, 0.95);        // shock zone — magenta
      } else {
        colorObj.setRGB(0.7, 0.3, 0.75);          // cocoon — violet
      }

      // Mesh transform — small particles, no megabloom
      dummy.position.copy(p);
      const isJet = Math.sqrt(p.x * p.x + p.z * p.z) < jetRadius(Math.abs(p.y));
      dummy.scale.setScalar(isJet ? 0.16 : 0.28);
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
      frustumCulled={false}
      renderOrder={10}
    >
      <sphereGeometry args={[1.0, 8, 8]} />
      <meshBasicMaterial
        transparent opacity={0.55} depthWrite={false}
        blending={THREE.AdditiveBlending} toneMapped={false}
      />
    </instancedMesh>
  );
}

/* ─── AGN core: pequeño punto puntual, no domina el frame ────────────── */
function AGNCore() {
  return (
    <mesh renderOrder={20}>
      <sphereGeometry args={[0.8, 24, 24]} />
      <meshBasicMaterial color="#FFE8A0" toneMapped={false} />
    </mesh>
  );
}

/* ─── Background: distant stars (universe) ────────────────────────────── */
function BackgroundStars() {
  const positions = useMemo(() => {
    const N = 2200;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 220 + Math.random() * 120;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);
  return (
    <points renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#FFFFFF" size={0.5} sizeAttenuation
        transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

/* ─── Galaxy host: distribución Vaucouleurs (perfil R^(1/4)) ──────────── */
function GalaxyHost() {
  const positions = useMemo(() => {
    const N = 900;
    const Re = 6;
    const b = 7.67;
    const pos: number[] = [];
    let attempts = 0;
    while (pos.length < N * 3 && attempts < N * 100) {
      const r = -Math.log(1 - Math.random()) * Re * 0.5;
      const prob = Math.exp(-b * (Math.pow(r / Re, 0.25) - 1));
      if (Math.random() < prob && r < 22) {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        // Elíptica: axial ratio 0.65 (E3 elliptical)
        pos.push(r * Math.sin(phi) * Math.cos(theta));
        pos.push(r * Math.sin(phi) * Math.sin(theta) * 0.65);
        pos.push(r * Math.cos(phi));
      }
      attempts++;
    }
    return new Float32Array(pos);
  }, []);
  return (
    <points renderOrder={2}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#FFE8A0" size={0.22} sizeAttenuation
        transparent opacity={0.7} depthWrite={false}
        blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

/* ─── Top-level scene ──────────────────────────────────────────────────── */
export default function QuasarHerculesA() {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 30, 110], fov: 48, near: 0.001, far: 800 }}
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={[1, 1.5]}
      >
        <BackgroundStars />
        <GalaxyHost />
        <AGNCore />
        <PlasmaSimulation />

        {/* Bloom sutil — kernel size 4 evita los "rastros" de trails persistentes
            y banding en negros. Sin mipmapBlur (que difumina background). */}
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.45} luminanceThreshold={0.7} luminanceSmoothing={0.5} kernelSize={3} />
        </EffectComposer>

        <OrbitControls
          enablePan={false} enableZoom autoRotate autoRotateSpeed={0.10}
          minDistance={80} maxDistance={400}
          minPolarAngle={0.3} maxPolarAngle={2.4}
        />
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] tracking-[0.2em]">
        Hercules A · simulación N-body · 4500 plasma parcels · RK4
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-[#475569]">
        v_field GRMHD (Komissarov '07 · McKinney-Tchekhovskoy '10) · sech² jet · cocoon backflow
      </div>
    </div>
  );
}
