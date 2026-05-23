/**
 * QuasarZoom — viaje cinematográfico desde el horizonte hasta la galaxia.
 *
 * Animación lenta del camera position: arranca pegado al disco (EHT scale),
 * se aleja revelando el jet con knots (M87 scale), luego revela los lobes
 * (Hercules A scale), termina con la galaxia entera como punto contra el
 * cielo.
 *
 * Física: combina todos los componentes (BHRaytraced + jets + lobes + galaxy),
 * pero la cámara hace el "Powers of Ten" del cuásar.
 *
 * Duración del ciclo: 24s (4s en cada uno de los 4 niveles + 8s de zoom-out
 * continuo). AutoRotate también activo para componer el wow.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import BHRaytraced from '@/labs/components/BHRaytraced';
import { makeRenderer } from '@/lib/webgl-fallback';

const JET_AXIS = new THREE.Vector3(0.7, 0.7, 0).normalize();
const JET_LENGTH = 90;

function ZoomCamera() {
  const { camera } = useThree();
  const startRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (startRef.current === null) startRef.current = clock.elapsedTime;
    const t = (clock.elapsedTime - startRef.current) % 28;
    // 0-7s: EHT close-up (camera close to BH)
    // 7-14s: M87 jet scale
    // 14-21s: Hercules A scale (lobes visible)
    // 21-28s: full galaxy + recede
    let dist: number, height: number;
    if (t < 7)        { const k = t / 7;        dist = 18 + k * 25;   height = 4 + k * 8; }
    else if (t < 14)  { const k = (t - 7) / 7;  dist = 43 + k * 50;   height = 12 + k * 12; }
    else if (t < 21)  { const k = (t - 14) / 7; dist = 93 + k * 60;   height = 24 + k * 8; }
    else              { const k = (t - 21) / 7; dist = 153 + k * 80;  height = 32 + k * 6; }
    const ang = t * 0.10;
    camera.position.set(Math.sin(ang) * dist, height, Math.cos(ang) * dist);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

const KNOT_TS = [0.10, 0.28, 0.45, 0.62, 0.78, 0.93];

function JetWithKnots() {
  const geom = useMemo(() => {
    const N = 60;
    const pts: THREE.Vector3[] = [];
    const up = JET_AXIS.clone();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push(up.clone().multiplyScalar(t * JET_LENGTH));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 80, 1.0, 12, false);
  }, []);

  return (
    <>
      <mesh geometry={geom} renderOrder={10}>
        <meshBasicMaterial color="#8FD0FF" transparent opacity={0.55}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* Counter-jet (Doppler attenuated, barely visible) */}
      <mesh geometry={geom} renderOrder={10}
        rotation={[Math.PI, 0, 0]}>
        <meshBasicMaterial color="#8FD0FF" transparent opacity={0.08}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {KNOT_TS.map((t, i) => (
        <mesh key={i} position={JET_AXIS.clone().multiplyScalar(t * JET_LENGTH)} renderOrder={11}>
          <sphereGeometry args={[1.4 + i * 0.15, 18, 18]} />
          <meshBasicMaterial color="#E0F0FF" transparent opacity={0.7}
            depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
      {/* Lobe terminal */}
      <mesh position={JET_AXIS.clone().multiplyScalar(JET_LENGTH)} renderOrder={11}>
        <sphereGeometry args={[5.5, 28, 28]} />
        <meshBasicMaterial color="#FFB0E0" transparent opacity={0.85}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </>
  );
}

export default function QuasarZoom() {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 4, 18], fov: 44, near: 0.001, far: 800 }}
        gl={makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })}
        dpr={[0.55, 1]}
      >
        <ZoomCamera />
        <BHRaytraced
          rs={1.0} rIn={2.6} rOut={18}
          inclinationDeg={62}
          diskOpacity={1.0} dopplerStrength={1.0}
          starDensity={0.8} starSeed={4.2}
          diskTint="#FFA060" photonRing
        />
        <JetWithKnots />

        <EffectComposer multisampling={0}>
          <Bloom intensity={2.0} luminanceThreshold={0.5} luminanceSmoothing={0.3} mipmapBlur />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] tracking-[0.2em]">
        Zoom-out cinemático · horizonte → galaxia
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-[#475569]">
        ciclo 28s · 4 escalas: EHT · M87 · Hercules A · galaxy
      </div>
    </div>
  );
}
