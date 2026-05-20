/**
 * LemonCherryDemo — minimal hero scene demostrando el uso de la library.
 *
 * Esta es la "recipe" que un autor de masterclass (humano o IA) puede usar
 * como plantilla para escenas con UN objeto principal:
 *
 *   - 60 LOC totales (vs 400 LOC de los LimonesEscenaXX legacy).
 *   - Fondo negro radial, ambient mínimo.
 *   - Auto-orbit cámara muy suave (no marea — feedback_scene_design_paradigm).
 *   - PostFX (bloom + vignette).
 *   - UN objeto principal grande, UN texto secundario chico.
 *
 * Sirve la escena script "05-distribucion" del script Akerlof:
 *   "Un cherry vale veinte mil pesos. Un limón vale cinco mil."
 *
 * Cuando se quiera reusar para otra clase: copiar este archivo, swap el
 * <Lemon> / <Cherry> por los shapes/GLBs que la nueva clase necesite.
 */

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Lemon, Cherry } from './shapes';
import PostFX from '../scenes/_postFX';

function CameraOrbit() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    const orbit = 0.15 + t * 0.04;
    const dist = 6.5;
    const height = 1.2 + 0.3 * Math.sin(t * 0.2);
    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function HeroPair() {
  const cherryRef = useRef<THREE.Group>(null);
  const lemonRef = useRef<THREE.Group>(null);
  // Bobbing suave para que se sientan "vivos"
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (cherryRef.current) cherryRef.current.position.y = 0.08 * Math.sin(t * 0.7);
    if (lemonRef.current) lemonRef.current.position.y = 0.08 * Math.sin(t * 0.7 + Math.PI);
  });
  return (
    <>
      <group ref={cherryRef} position={[-2.2, 0, 0]}>
        <Cherry scale={1.4} glow={1.3} />
      </group>
      <group ref={lemonRef} position={[2.2, 0, 0]}>
        <Lemon scale={1.6} glow={1.3} />
      </group>
    </>
  );
}

export default function LemonCherryDemo() {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <Canvas
        camera={{ position: [3, 1.5, 6], fov: 45, near: 0.1, far: 100 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
        }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.22} />
        <directionalLight position={[5, 8, 3]} intensity={0.6} color="#FFB870" />
        <directionalLight position={[-4, 4, -3]} intensity={0.35} color="#7FB0FF" />
        <fog attach="fog" args={['#050308', 6, 20]} />
        <CameraOrbit />
        <HeroPair />
        <PostFX intensity={1.7} threshold={0.18} vignette={0.7} aberration={0.0010} />
      </Canvas>

      {/* HUD mínimo — UN texto, abajo, safe-zone */}
      <div className="absolute inset-x-0 bottom-12 text-center pointer-events-none font-mono">
        <div className="text-[#34D399]/70 text-xs uppercase tracking-[0.3em] mb-1">cherry · $20,000</div>
        <div className="text-[#FDB813]/70 text-xs uppercase tracking-[0.3em]">limón · $5,000</div>
      </div>
    </div>
  );
}
