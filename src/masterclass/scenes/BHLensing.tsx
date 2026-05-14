/**
 * BHLensing — agujero negro SIN disco, sólo para mostrar el lensing del fondo
 * de estrellas. Cada estrella detrás del BH genera una imagen replicada en
 * forma de anillo (Einstein ring) cuando está suficientemente alineada.
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import BHRaytraced from '@/labs/components/BHRaytraced';

export default function BHLensing() {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 1.0, 6.5], fov: 45, near: 0.001, far: 200 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <BHRaytraced
          rs={1.0}
          rIn={3.0}
          rOut={14.0}
          diskOpacity={0.0}
          inclinationDeg={82}
          starDensity={2.0}
          starSeed={9.3}
          photonRing
        />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.14}
          minPolarAngle={1.3}
          maxPolarAngle={1.7}
        />
      </Canvas>
      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8]">
        cada estrella tras el agujero negro forma una réplica en círculo
      </div>
    </div>
  );
}
