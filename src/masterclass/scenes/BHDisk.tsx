/**
 * BHDisk — disco de acreción visto con inclinación oblicua, raytracing real.
 * El Doppler beaming surge automáticamente: el lado que se acerca al
 * observador (β · v_orb proyectada hacia cámara) brilla con factor δ⁴.
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import BHRaytraced from '@/labs/components/BHRaytraced';

export default function BHDisk() {
  return (
    <div className="w-full h-full relative" style={{
      background: '#000',
    }}>
      <Canvas
        camera={{ position: [0, 3.5, 5.5], fov: 48, near: 0.001, far: 200 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <BHRaytraced
          rs={1.0}
          rIn={3.0}
          rOut={14.0}
          inclinationDeg={60}
          diskOpacity={1.0}
          dopplerStrength={1.0}
          starDensity={1.0}
          starSeed={3.1}
          diskTint="#FFD58A"
          photonRing
        />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.22}
          minPolarAngle={1.15}
          maxPolarAngle={1.55}
        />
      </Canvas>
    </div>
  );
}
