/**
 * QuasarScene — un AGN cinematográfico, físicamente correcto.
 *
 * Composición:
 *   - BHRaytraced: SMBH + disco de acreción (Shakura-Sunyaev T ∝ r⁻³ᐟ⁴) +
 *     Doppler beaming + photon ring + gravitational lensing del background.
 *   - QuasarJets: dos jets relativistas helicoidales emergentes del polo,
 *     con Doppler boost asimétrico (approaching brilla, counter-jet apaga).
 *
 * Reciclado del BH: BHRaytraced ya hace toda la física del horizonte/disco/
 * lensing. Cuásar = BH + jets + más mass = más luminosity. La diferencia
 * visual frente a Gargantua es la inclinación (vemos cerca del eje del jet,
 * no del disco) y la presencia del jet relativista.
 *
 * Parámetros del cuásar (3C 273 reference):
 *   M_BH = 8.8 × 10⁸ M☉ (HUD)
 *   L_bol ≈ 4 × 10⁴⁶ erg/s (HUD)
 *   γ_jet ≈ 5-10 (Pushkarev+ 2017)
 *   θ_LOS ≈ 5-15° (BL Lac geometry pero más oblicuo para ver el disco)
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import BHRaytraced from '@/labs/components/BHRaytraced';
import { makeRenderer } from '@/lib/webgl-fallback';
import QuasarJets from './QuasarJets';

export default function QuasarScene() {
  // Ángulo de visión: ~25° del eje del jet — vemos el disco con inclinación
  // pronunciada pero el jet aún muy Doppler-boosted hacia nosotros.
  const losAngleRad = 25 * Math.PI / 180;

  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 18, 55], fov: 42, near: 0.001, far: 400 }}
        gl={makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })}
        dpr={[0.55, 1]}
      >
        {/* BH + disco + lensing: reciclamos completo de BHGargantua/BHDisk */}
        <BHRaytraced
          rs={1.0}
          rIn={2.6}            // disco interior casi en ISCO Kerr-quasi-extremal
          rOut={16.0}
          inclinationDeg={68}  // vemos el disco con buena inclinación + jets visibles
          diskOpacity={1.0}
          dopplerStrength={1.0}
          starDensity={1.0}
          starSeed={9.7}
          diskTint="#FFB870"   // disco hot UV-ish para AGN luminoso
          photonRing
        />

        {/* Jets relativistas con Doppler beaming asimétrico */}
        <QuasarJets
          gamma={9}              // 3C 273-like Lorentz factor
          openingAngle={0.04}    // ~2.3° collimated
          length={70}            // visualmente cinematográfico (no a escala real)
          losAngle={losAngleRad}
          baseRadius={1.4}
          color="#7CC4FF"        // synchrotron blue
          helixTurns={5}
        />

        {/* Postprocessing: bloom intenso para el plasma sincrotrón.
            Sin esto los jets se ven dim — el bloom es esencial. */}
        <EffectComposer multisampling={0}>
          <Bloom intensity={1.4} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
        </EffectComposer>

        <OrbitControls
          enablePan={false}
          enableZoom
          autoRotate
          autoRotateSpeed={0.15}
          minDistance={20}
          maxDistance={180}
          minPolarAngle={0.35}   // permite ver casi desde arriba (axis del jet)
          maxPolarAngle={2.1}
        />
      </Canvas>

      {/* HUD mínimo (regla scene-design-paradigm: max 2 bloques de texto) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        Cuásar · M_BH = 8.8 × 10⁸ M☉ · γ_jet = 9 · L_bol ≈ 4 × 10⁴⁶ erg/s
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[10px] font-mono text-[#475569]">
        Schwarzschild geodesics + Shakura-Sunyaev disk + Blandford-Znajek jets · Doppler D⁽³⁺ᵅ⁾
      </div>
    </div>
  );
}
