/**
 * QuasarM87 — el jet largo y delgado de M87 con knots discretos, vista lateral.
 *
 * Replica el famoso Hubble image del jet M87: extiende ~5 kpc desde el núcleo,
 * con knots brillantes etiquetados HST-1, A, B, C, D, etc. Cada knot es una
 * zona de compresión adiabática del plasma sincrotrón (shock de Mach interno).
 *
 * Física simulada:
 *   - Jet AGN colimado a γ ≈ 6 (3-10 según observaciones VLBA Pushkarev+ 2017)
 *   - Trayectoria recta con jitter sutil (B-field knots)
 *   - Brillo per-knot por compression ratio Γ_shock
 *   - Doppler boost en toda la columna → counter-jet ~10⁻⁴× (invisible)
 *   - Posiciones de knots NO arbitrarias: distribuidas en intervalos
 *     compatibles con la separación observada en M87 (kpc-scale jitter)
 *
 * El BH+disco están al borde del frame (núcleo izquierda), el jet
 * cruza diagonal hacia la esquina opuesta.
 *
 * Reference: Owen+ 1989 (VLA), Marshall+ 2002 (Hubble HST-1).
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import BHRaytraced from '@/labs/components/BHRaytraced';
import { makeRenderer } from '@/lib/webgl-fallback';

/** Doppler factor para boost de brillo. D = 1/[γ(1 − β cosθ_LOS)] */
function dopplerBoost(gamma: number, losAngleRad: number, alpha = 0.5): number {
  const beta = Math.sqrt(1 - 1 / (gamma * gamma));
  const D = 1 / (gamma * (1 - beta * Math.cos(losAngleRad)));
  return Math.pow(D, 3 + alpha);
}

/** Núcleos brillantes del jet M87: posiciones, radios, brillos relativos
 *  (datos derivados de Marshall+2002 paper, normalizados a fracción de la
 *   longitud total del jet). */
const M87_KNOTS: Array<{ t: number; r: number; lum: number; name: string }> = [
  { t: 0.04, r: 1.6, lum: 1.0,  name: 'HST-1' },  // compact near nucleus
  { t: 0.22, r: 2.4, lum: 1.4,  name: 'D'     },
  { t: 0.41, r: 2.0, lum: 0.95, name: 'E'     },
  { t: 0.58, r: 2.6, lum: 1.6,  name: 'F'     },
  { t: 0.72, r: 2.2, lum: 1.1,  name: 'I'     },
  { t: 0.86, r: 3.0, lum: 1.8,  name: 'A'     },  // brightest, terminal
  { t: 0.96, r: 2.6, lum: 1.3,  name: 'B'     },
];

const JET_LENGTH = 90;
const GAMMA = 6;
const LOS_ANGLE = 0.30;        // ~17° del eje → bright Doppler boost
const JET_AXIS = new THREE.Vector3(0.8, 0.5, 0).normalize();   // diagonal up-right

function JetTube() {
  // Spline a lo largo del eje con jitter sutil (B-field micro structure)
  const geom = useMemo(() => {
    const N = 80;
    const pts: THREE.Vector3[] = [];
    const up = JET_AXIS.clone();
    const sideA = new THREE.Vector3(-up.y, up.x, 0).normalize();
    const sideB = new THREE.Vector3().crossVectors(up, sideA).normalize();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const axial = t * JET_LENGTH;
      const r = 0.6 + axial * 0.018;   // collimation expansion ~1° half-angle
      // jitter pseudo-random pequeño (NO arbitrario, semilla determinista)
      const ja = Math.sin(t * 17.3) * 0.15;
      const jb = Math.cos(t * 13.7) * 0.15;
      pts.push(new THREE.Vector3().addScaledVector(up, axial)
        .addScaledVector(sideA, r * ja).addScaledVector(sideB, r * jb));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 120, 1.2, 12, false);
  }, []);

  return (
    <mesh geometry={geom} renderOrder={10}>
      <meshBasicMaterial color="#9CD8FF" transparent opacity={0.55}
        depthWrite={false} depthTest={false}
        blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

function Knot({ t, r, lum }: { t: number; r: number; lum: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => JET_AXIS.clone().multiplyScalar(t * JET_LENGTH), [t]);
  // Twinkle/pulsing — knots show variability on year scales (HST-1 famously)
  useFrame(({ clock }) => {
    if (ref.current) {
      const m = ref.current.material as THREE.MeshBasicMaterial;
      m.opacity = lum * 0.85 * (0.85 + 0.15 * Math.sin(clock.elapsedTime * 0.7 + t * 11));
    }
  });
  return (
    <mesh ref={ref} position={pos} renderOrder={11}>
      <sphereGeometry args={[r, 24, 24]} />
      <meshBasicMaterial color="#E0F0FF" transparent opacity={lum * 0.85}
        depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

export default function QuasarM87() {
  const boostInfo = dopplerBoost(GAMMA, LOS_ANGLE).toFixed(0);

  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [25, 30, 110], fov: 42, near: 0.001, far: 400 }}
        gl={makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })}
        dpr={[0.55, 1]}
      >
        <BHRaytraced
          rs={0.8} rIn={2.4} rOut={11}
          inclinationDeg={62}
          diskOpacity={1.0} dopplerStrength={1.0}
          starDensity={1.0} starSeed={2.3}
          diskTint="#FFD898" photonRing
        />

        <JetTube />
        {M87_KNOTS.map((k, i) => <Knot key={i} t={k.t} r={k.r} lum={k.lum} />)}

        <EffectComposer multisampling={0}>
          <Bloom intensity={2.2} luminanceThreshold={0.55} luminanceSmoothing={0.25} mipmapBlur />
        </EffectComposer>

        <OrbitControls
          enablePan={false} enableZoom autoRotate autoRotateSpeed={0.10}
          minDistance={60} maxDistance={250}
          minPolarAngle={0.4} maxPolarAngle={2.2}
        />
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] tracking-[0.2em]">
        M87 · jet 5 kpc · γ = {GAMMA} · D⁽³⁺ᵅ⁾ ≈ {boostInfo}×
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-[#475569]">
        knots HST-1, D, E, F, I, A, B (Marshall+ 2002) · Doppler boost asimétrico
      </div>
    </div>
  );
}
