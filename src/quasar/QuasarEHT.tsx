/**
 * QuasarEHT — el donut anaranjado del Event Horizon Telescope, escala AGN.
 *
 * Física aplicada (todo via BHRaytraced, sin shortcuts):
 *   - Geodésicas Schwarzschild → photon ring brillante alrededor del horizonte
 *   - Disco Shakura-Sunyaev (T ∝ r⁻³ᐟ⁴) → temperatura decreciente outer-in
 *   - Doppler beaming → mitad acercándose brilla, mitad recedente apaga
 *   - El disco se ve curvado por GR sobre la sombra (la "ceja" Interstellar
 *     pero más simétrica porque vemos casi de frente)
 *
 * Diferencia con un BH estelar:
 *   - r_ISCO = 2.6 r_s (Kerr quasi-extremal típico AGN, spin a* ~ 0.94)
 *   - r_out = 22 r_s (disco extendido — AGN tiene reservorio grande)
 *   - Inclinación 17° (casi face-on como M87* visto por EHT)
 *   - Tinte rojo-naranja saturated, igual que la imagen EHT publicada
 *
 * Reference: Event Horizon Telescope Collaboration, ApJL 875 (2019) — M87*.
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import BHRaytraced from '@/labs/components/BHRaytraced';
import { makeRenderer } from '@/lib/webgl-fallback';

export default function QuasarEHT() {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 3, 28], fov: 38, near: 0.001, far: 200 }}
        gl={makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })}
        dpr={[0.55, 1]}
      >
        <BHRaytraced
          rs={1.0}
          rIn={2.6}            // Kerr a* ≈ 0.94 → r_ISCO real ~ 2.6 r_s
          rOut={22.0}          // disco AGN extendido
          inclinationDeg={17}  // M87* EHT geometry
          diskOpacity={1.0}
          dopplerStrength={1.0}
          starDensity={0.4}    // background tenue — el donut domina el frame
          starSeed={5.1}
          diskTint="#FF8A3C"   // naranja saturado, como la imagen EHT
          photonRing
        />

        <EffectComposer multisampling={0}>
          <Bloom intensity={1.5} luminanceThreshold={0.6} luminanceSmoothing={0.3} mipmapBlur />
        </EffectComposer>

        <OrbitControls
          enablePan={false} enableZoom autoRotate autoRotateSpeed={0.10}
          minDistance={12} maxDistance={80}
          minPolarAngle={0.3} maxPolarAngle={2.3}
        />
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] tracking-[0.2em]">
        M87* · EHT 2019 · 6.5 × 10⁹ M☉
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-[#475569]">
        photon ring · disco Shakura-Sunyaev · Doppler δ⁴
      </div>
    </div>
  );
}
