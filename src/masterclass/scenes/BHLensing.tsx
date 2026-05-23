import { memo } from 'react';
/**
 * BHLensing — agujero negro SIN disco, sólo para mostrar el lensing del fondo
 * de estrellas. Cada estrella detrás del BH genera una imagen replicada en
 * forma de anillo (Einstein ring) cuando está suficientemente alineada.
 */

import { Canvas } from '@react-three/fiber';
import { makeRenderer } from '@/lib/webgl-fallback';
import { OrbitControls } from '@react-three/drei';
import BHRaytraced from '@/labs/components/BHRaytraced';

function BHLensing() {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 4, 40], fov: 45, near: 0.001, far: 300 }}
        gl={makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })}
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
          enableZoom
          autoRotate
          autoRotateSpeed={0.14}
          minDistance={6}
          maxDistance={120}
          minPolarAngle={0.8}
          maxPolarAngle={2.2}
        />
      </Canvas>
      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8]">
        cada estrella tras el agujero negro forma una réplica en círculo
      </div>
    </div>
  );
}

export default memo(BHLensing);
