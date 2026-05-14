/**
 * BHGargantua — homenaje al frame icónico de Interstellar usando raytracing
 * real de geodésicas. Las cejas superior e inferior NO son anillos pegados:
 * son el mismo disco visto desde el otro lado, con la luz doblada por la
 * curvatura espacial Schwarzschild. Doppler beaming aparece naturalmente.
 *
 * Inclinación de cámara: ~10° (casi sobre el plano del disco, como en la
 * película) para que la "ceja" cinematográfica sea máxima.
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import BHRaytraced from '@/labs/components/BHRaytraced';

export default function BHGargantua() {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 1.0, 6.5], fov: 45, near: 0.001, far: 200 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <BHRaytraced
          rs={1.0}
          rIn={2.5}      // ISCO casi mínima — Kerr casi-extremal
          rOut={14.0}
          inclinationDeg={82}
          diskOpacity={1.0}
          dopplerStrength={1.0}
          starDensity={1.0}
          starSeed={1.7}
          diskTint="#FFE0A0"
          photonRing
        />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.18}
          minPolarAngle={1.38}
          maxPolarAngle={1.62}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        Gargantua · 10⁸ M☉ · a* = 0.9999999
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[10px] font-mono text-[#475569]">
        raytracing real de geodésicas Schwarzschild · 220 pasos / pixel
      </div>
    </div>
  );
}
