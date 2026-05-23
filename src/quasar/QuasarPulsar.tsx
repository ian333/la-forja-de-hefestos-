/**
 * QuasarPulsar — estrella de neutrones rotando con dipolo magnético inclinado.
 * Lighthouse effect: beams sincrotrón emergen de polos magnéticos y barren el
 * espacio cuando el dipolo no está alineado con el eje de rotación.
 *
 * Datos: Crab pulsar (PSR B0531+21), referencia clásica.
 *   P = 33.4 ms (ω = 188.1 rad/s, en sim escalamos a 1 rev/s para verse)
 *   R_NS ≈ 10 km
 *   B_surf ≈ 7.5 × 10¹² G
 *   α (inclinación magnética) ≈ 60°
 *   R_LC = c/ω = 1593 km (cilindro de luz)
 *
 * Operador 𝔄 aplicado:
 *   - Simetría axial del cuerpo NS → cara i_φ (rotación rígida)
 *   - Periodicidad temporal → cara i_t (rotación del beam, vía Ω·t)
 *   - Geometría dipolar B → función de Legendre P_l con l=1 (líneas r(θ) = r₀·sin²(θ))
 *   - Reflexión N-S de los polos → paridad m=±1
 *
 * Beam: cono de half-angle ρ ≈ 6° emergiendo de cada polo magnético.
 * Cuando el beam cruza la línea de visión del observador → pulso visible.
 * Aquí mostramos AMBOS beams continuos + rotación de todo el sistema, así el
 * lighthouse se ve directamente (no hay observador fijo).
 *
 * Refs: Goldreich & Julian 1969 (magnetosphere), Manchester & Taylor 1977,
 *       Lorimer & Kramer 2004 textbook.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';
import {
  caraI_Theta, caraI_Z, modo, actualizarModosEnTiempo,
  alfvenOmega, type Modo,
} from '@/operador';

/* ─── Datos físicos (Crab pulsar, normalizados a escala de escena) ──── */
const R_NS         = 1.0;          // estrella de neutrones (= 10 km físico)
const R_LC         = 38;           // cilindro de luz (= c/ω, geometría real)
const ALPHA_DEG    = 60;           // inclinación dipolo respecto eje spin
const ALPHA        = ALPHA_DEG * Math.PI / 180;
const OMEGA_SPIN   = 0.65;         // rad/s en escala de escena (lento para verse)
const BEAM_HALF    = 6 * Math.PI / 180;  // 6° half-opening del cono de emisión
const N_BEAM_PART  = 3500;
const N_FIELDLINES = 14;

/* ─── Modos del operador 𝔄 ────────────────────────────────────────────
 * La rotación del beam alrededor del eje spin es onda axial con frecuencia
 * Ω. Aunque no haya factorización Bessel aquí, los modos i_θ + i_z(t) sí
 * aplican: el beam barre con Ω, las líneas de campo respiran con armónicos
 * superiores por el frame dragging del dipolo inclinado.
 */
const VA_SCALE = 1.0;
const MODOS_BEAM: readonly Modo[] = [
  // Modo dominante: rotación rígida del beam con Ω
  modo({
    amp: 1.0, m: 1, n: 1,
    R:     caraI_Theta({ m: 0 }),  // R trivial — beam no tiene estructura radial fuera del cono
    Theta: caraI_Theta({ m: 1 }),  // cos(φ) modula la posición azimutal
    Z:     caraI_Z({ kZ: 0, omega: OMEGA_SPIN, LENGTH: 1, phase: 0 }),
  }),
  // Modo precesión libre (Lyne+ 1988 reportó precesión en Crab ~ 100 d)
  modo({
    amp: 0.08, m: 1, n: 1,
    R:     caraI_Theta({ m: 0 }),
    Theta: caraI_Theta({ m: 1 }),
    Z:     caraI_Z({ kZ: 0, omega: OMEGA_SPIN * 0.012, LENGTH: 1, phase: Math.PI / 2 }),
  }),
];

/* ─── Eje magnético rotado por inclinación α del eje spin ───────────── */
function magneticAxis(spinAngle: number): THREE.Vector3 {
  // Eje magnético precesa alrededor del eje spin (Y) en cono de semi-ángulo α
  return new THREE.Vector3(
    Math.sin(ALPHA) * Math.cos(spinAngle),
    Math.cos(ALPHA),
    Math.sin(ALPHA) * Math.sin(spinAngle),
  );
}

/* ─── Estrella de neutrones: esfera densa con halo ──────────────────── */
function NeutronStar() {
  return (
    <group>
      {/* Superficie de la NS — material denso, ligeramente emissive */}
      <mesh renderOrder={5}>
        <sphereGeometry args={[R_NS, 32, 32]} />
        <meshBasicMaterial color="#9CC9FF" toneMapped={false} />
      </mesh>
      {/* Halo de plasma corotando (magnetosfera interna) */}
      <mesh renderOrder={4}>
        <sphereGeometry args={[R_NS * 1.6, 24, 24]} />
        <meshBasicMaterial color="#3060A0" transparent opacity={0.25}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ─── Líneas de campo dipolar B inclinado ─────────────────────────────
 * Forma: r(θ_dipolo) = r₀ · sin²(θ_dipolo), parametrizada en el sistema
 * del dipolo. Se rota al sistema del laboratorio aplicando R_y(spinAngle)
 * y luego R_x(ALPHA) (inclinación). Frame dragging causa que las líneas
 * "respiren" — implementado via spin rotation por frame.
 */
function FieldLines() {
  const groupRef = useRef<THREE.Group>(null);

  // Pre-compute geometría de UNA línea (todas las demás son rotaciones)
  const lineGeoms = useMemo(() => {
    const geoms: THREE.BufferGeometry[] = [];
    // Familia de líneas con r₀ variable (más cercanas + más lejanas)
    const r0_values = [4, 7, 11, 16, 22, 30];
    for (const r0 of r0_values) {
      const pts: THREE.Vector3[] = [];
      const N_seg = 80;
      // Recorre θ desde casi-polo norte (θ=ε) a casi-polo sur (θ=π-ε)
      const eps = 0.10;
      for (let i = 0; i <= N_seg; i++) {
        const theta = eps + (i / N_seg) * (Math.PI - 2 * eps);
        const r = r0 * Math.sin(theta) ** 2;
        if (r > R_NS) {
          // En coords del dipolo: x = r·sin(θ), y = r·cos(θ), z = 0
          pts.push(new THREE.Vector3(r * Math.sin(theta), r * Math.cos(theta), 0));
        }
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      geoms.push(geom);
    }
    return geoms;
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // Rota todo el sistema dipolar: primero alrededor del eje X por α
    // (inclinación constante), luego alrededor del eje Y por Ω·t
    groupRef.current.rotation.set(0, clock.elapsedTime * OMEGA_SPIN, 0);
    // Hijo del group se rota internamente por α (ver retorno abajo)
  });

  return (
    <group ref={groupRef}>
      <group rotation={[0, 0, ALPHA]}>{/* inclinación del dipolo respecto eje Y */}
        {lineGeoms.map((geom, i) => (
          <group key={i}>
            {/* Plano del dipolo: la línea base + N rotaciones azimutales */}
            {Array.from({ length: N_FIELDLINES }, (_, k) => {
              const phi = (k / N_FIELDLINES) * 2 * Math.PI;
              return (
                <group key={k} rotation={[0, phi, 0]}>
                  <line>
                    <primitive object={geom} />
                    <lineBasicMaterial color="#7099FF" transparent opacity={0.40}
                      toneMapped={false} />
                  </line>
                </group>
              );
            })}
          </group>
        ))}
      </group>
    </group>
  );
}

/* ─── Beams sincrotrón de los polos magnéticos ────────────────────────
 * Particle stream emergiendo de cada polo dentro del cono BEAM_HALF.
 * El cono está alineado con el eje magnético (precesa con spinAngle).
 */
function Beams() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  // Estado per-partícula: pos local (radial + azimutal alrededor del eje magnético)
  // Se transforma al sistema del laboratorio cada frame.
  const state = useMemo(() => {
    const local: { r: number; phi: number; side: 1 | -1; speed: number; tBorn: number }[] = [];
    for (let i = 0; i < N_BEAM_PART; i++) {
      const side: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const r = R_NS + Math.random() * R_LC;
      const phi = Math.random() * 2 * Math.PI;
      const speed = 8 + Math.random() * 12;
      local.push({ r, phi, side, speed, tBorn: -Math.random() * 5 });
    }
    return local;
  }, []);

  useFrame(({ clock }, dt) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    const clampDt = Math.min(dt, 0.04);
    actualizarModosEnTiempo(MODOS_BEAM, t);

    // Eje magnético actual (precesa con spin)
    const magAxis = magneticAxis(OMEGA_SPIN * t);
    // Frame ortonormal alrededor del eje magnético para coordenadas del beam
    const tmp = Math.abs(magAxis.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(magAxis, tmp).normalize();
    const v = new THREE.Vector3().crossVectors(magAxis, u).normalize();
    const pos = new THREE.Vector3();

    for (let i = 0; i < N_BEAM_PART; i++) {
      const s = state[i];
      // Avanza la partícula a lo largo del eje magnético
      s.r += s.speed * clampDt;
      // Respawn cuando sale del light cylinder
      if (s.r > R_LC * 1.05) {
        s.r = R_NS + Math.random() * 0.5;
        s.phi = Math.random() * 2 * Math.PI;
        s.tBorn = t;
      }
      // Radio transversal del cono: crece linealmente con distancia al polo
      const rTrans = (s.r - R_NS) * Math.tan(BEAM_HALF);
      const cosP = Math.cos(s.phi), sinP = Math.sin(s.phi);
      // Posición en laboratorio: r·magAxis (axial) + rTrans·(u·cos + v·sin)
      pos.set(0, 0, 0)
        .addScaledVector(magAxis, s.r * s.side)
        .addScaledVector(u, rTrans * cosP)
        .addScaledVector(v, rTrans * sinP);

      // Color: hot blue cerca del polo, fade a magenta al exterior (cooling)
      const tProg = Math.min(1, (s.r - R_NS) / R_LC);
      colorObj.setRGB(
        0.4 + tProg * 0.55,
        0.7 - tProg * 0.4,
        1.0 - tProg * 0.3,
      );

      dummy.position.copy(pos);
      dummy.scale.setScalar(0.18 + 0.20 * (1 - tProg));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, colorObj);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_BEAM_PART]}
      frustumCulled={false} renderOrder={10}>
      <sphereGeometry args={[1.0, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.85} depthWrite={false}
        blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

/* ─── Light cylinder: anillo a R_LC marcando límite corotación rígida ── */
function LightCylinder() {
  const geom = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = 96;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * 2 * Math.PI;
      pts.push(new THREE.Vector3(R_LC * Math.cos(t), 0, R_LC * Math.sin(t)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  return (
    <line>
      <primitive object={geom} />
      <lineBasicMaterial color="#FFA0A0" transparent opacity={0.30} toneMapped={false} />
    </line>
  );
}

function SpinAxis() {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(
      [0, -R_LC * 0.6, 0, 0, R_LC * 0.6, 0], 3));
    return g;
  }, []);
  return (
    <line>
      <primitive object={geom} />
      <lineBasicMaterial color="#FFD466" transparent opacity={0.50} toneMapped={false} />
    </line>
  );
}

/* ─── Stars de fondo (universo lejano) ───────────────────────────────── */
function BackgroundStars() {
  const positions = useMemo(() => {
    const N = 1800;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 120 + Math.random() * 90;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * 2 * Math.PI;
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
      <pointsMaterial color="#FFFFFF" size={0.4} sizeAttenuation
        transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

/* ─── Top-level ───────────────────────────────────────────────────────── */
export default function QuasarPulsar() {
  const omegaHz = (OMEGA_SPIN / (2 * Math.PI)).toFixed(3);
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [30, 22, 60], fov: 50, near: 0.001, far: 600 }}
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={[1, 1.5]}
      >
        <BackgroundStars />
        <SpinAxis />
        <LightCylinder />
        <NeutronStar />
        <FieldLines />
        <Beams />
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.65} luminanceThreshold={0.55} luminanceSmoothing={0.4} kernelSize={3} />
        </EffectComposer>
        <OrbitControls enablePan={false} enableZoom autoRotate autoRotateSpeed={0.10}
          minDistance={20} maxDistance={250} minPolarAngle={0.25} maxPolarAngle={2.5} />
      </Canvas>
      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] tracking-[0.2em]">
        Pulsar · Crab-like · M = 1.4 M☉ · R = 10 km · P = 33.4 ms · α = {ALPHA_DEG}°
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-[#475569] leading-relaxed">
        magnetosfera dipolar inclinada · ω_sim = {omegaHz} Hz (real 30 Hz)<br/>
        <span style={{color: '#FFD466'}}>oro</span>: eje spin (Y) ·
        <span style={{color: '#7099FF'}}> azul</span>: líneas dipolo r(θ)=r₀sin²θ ·
        <span style={{color: '#FFA0A0'}}> rosa</span>: cilindro de luz R_LC=c/ω<br/>
        caras 𝔄: i_φ (rotación rígida cuerpo) + i_t (Ω·t beam) + Legendre (l=1 dipolo)
      </div>
    </div>
  );
}
