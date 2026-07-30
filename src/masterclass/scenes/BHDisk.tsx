import { memo } from 'react';
/**
 * BHDisk — disco de acreción visto con inclinación oblicua, raytracing real.
 * El Doppler beaming surge automáticamente: el lado que se acerca al
 * observador (β · v_orb proyectada hacia cámara) brilla con factor δ⁴.
 */

import { Canvas } from '@react-three/fiber';
import { makeRenderer } from '@/lib/webgl-fallback';
import { OrbitControls } from '@react-three/drei';
import BHRaytraced from '@/labs/components/BHRaytraced';
import PostFX from './_postFX';

function BHDisk() {
  return (
    <div className="w-full h-full relative" style={{
      background: '#000',
    }}>
      <Canvas
        camera={{ position: [0, 5, 40], fov: 48, near: 0.001, far: 300 }}
        gl={makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })}
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
          enableZoom
          autoRotate
          autoRotateSpeed={0.22}
          minDistance={6}
          maxDistance={120}
          minPolarAngle={0.8}
          maxPolarAngle={2.2}
        />
        {/* CINE. Las 12 escenas del agujero negro —las mejores simulaciones del
            catálogo— se renderizaban PLANAS, sin una sola pasada de post,
            mientras las de economía sí tenían bloom. Por eso se sentían
            diagrama y no película.
            · threshold ALTO (0.62), no bajo. La doctrina pide threshold bajo
              para que "los picos REVIENTEN", pero eso vale cuando el objeto es
              un punto brillante sobre void. Aquí el disco LLENA el cuadro y ya
              es emisivo: a 0.14 florecía entero y se blanqueaba —perdía color
              y estructura—. Es el "más luz ≠ más color" de siempre: el color
              vive en la SATURACIÓN, no en sumar brillo. A 0.62 solo flarea el
              anillo interior, que es donde el gas está a 10⁶ K.
            · aberración en 0: sobre un starfield >0.1 produce confeti
              verde/rojo — defecto ya pagado, documentado en CLAUDE.md.
            · el bloom de _postFX RESPIRA con la voz (voiceLevel): en los picos
              de la narración el disco flarea. Cine sincronizado con Matilda. */}
        <PostFX intensity={0.9} threshold={0.62} smoothing={0.35} vignette={0.42} vignetteOffset={0.3} aberration={0} />
      </Canvas>
    </div>
  );
}

export default memo(BHDisk);
