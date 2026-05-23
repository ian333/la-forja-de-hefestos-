/**
 * BHMerger — animación de fusión de dos agujeros negros estilo GW150914.
 *
 * Las masas reales del evento del 14 sep 2015:
 *   M₁ = 36 M☉, M₂ = 29 M☉ → M_final = 62 M☉ (3 M☉ → ondas gravitacionales)
 *
 * El binary se espirala hacia adentro (chirp) en pocos segundos y termina
 * fusionándose. Las ondas gravitacionales se propagan como anillos en el
 * plano orbital. Después del merger queda un solo BH girando (ringdown).
 *
 * El loop dura ~12s para que se vea claro: inspiral, merger, ringdown.
 */

import { useMemo, useRef, memo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { makeRenderer } from '@/lib/webgl-fallback';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface MergerState {
  bh1: THREE.Vector3;
  bh2: THREE.Vector3;
  r1: number;       // radio visual de BH1
  r2: number;       // radio visual de BH2
  mergerFrac: number;  // 0 = separadas, 1 = fusionadas
  spin: number;        // rotación residual
  wavePhase: number;   // fase de las ondas GW
}

function MergerScene() {
  const bh1Ref = useRef<THREE.Mesh>(null);
  const bh2Ref = useRef<THREE.Mesh>(null);
  const finalRef = useRef<THREE.Mesh>(null);
  const finalDiskRef = useRef<THREE.Mesh>(null);
  const finalHaloRef = useRef<THREE.Mesh>(null);
  const wave1Ref = useRef<THREE.Mesh>(null);
  const wave2Ref = useRef<THREE.Mesh>(null);
  const wave3Ref = useRef<THREE.Mesh>(null);
  const wave4Ref = useRef<THREE.Mesh>(null);

  // Halos sprite-style alrededor de cada BH
  const haloTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(253,184,19,0.95)');
    grad.addColorStop(0.3, 'rgba(244,114,182,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(({ clock }) => {
    const T_TOTAL = 12;
    const t = (clock.elapsedTime % T_TOTAL) / T_TOTAL;  // 0..1

    // Fases
    let phase: 'inspiral' | 'merger' | 'ringdown' = 'inspiral';
    let phaseT = 0;
    if (t < 0.65) {
      phase = 'inspiral';
      phaseT = t / 0.65;
    } else if (t < 0.78) {
      phase = 'merger';
      phaseT = (t - 0.65) / 0.13;
    } else {
      phase = 'ringdown';
      phaseT = (t - 0.78) / 0.22;
    }

    // ── INSPIRAL ──────────────────────────────────────────
    // Separación cae como (T_merger - t)^(1/4) (post-Newtoniano para inspiral)
    // Velocidad orbital sube como (T_merger - t)^(-3/8)
    if (phase === 'inspiral') {
      const sep = 3.5 * Math.pow(1 - phaseT, 0.45);
      // Frecuencia orbital aumenta: ω ∝ (T-t)^(-3/8). Acumulamos fase.
      // Para evitar reset feo en el loop, integro numéricamente
      const omega = 0.6 + 6 * Math.pow(phaseT, 1.2);
      const angle = clock.elapsedTime * omega;
      const r1 = 0.35 + 0.05 * Math.sin(angle * 0.5);
      const r2 = 0.30 + 0.04 * Math.sin(angle * 0.3);

      // Masa M1 = 36, M2 = 29 — separación relativa al centro de masa
      const m1 = 36, m2 = 29;
      const x1 =  sep * (m2 / (m1 + m2)) * Math.cos(angle);
      const z1 =  sep * (m2 / (m1 + m2)) * Math.sin(angle);
      const x2 = -sep * (m1 / (m1 + m2)) * Math.cos(angle);
      const z2 = -sep * (m1 / (m1 + m2)) * Math.sin(angle);

      if (bh1Ref.current) {
        bh1Ref.current.position.set(x1, 0, z1);
        bh1Ref.current.scale.setScalar(r1 / 0.35);
        bh1Ref.current.visible = true;
      }
      if (bh2Ref.current) {
        bh2Ref.current.position.set(x2, 0, z2);
        bh2Ref.current.scale.setScalar(r2 / 0.35);
        bh2Ref.current.visible = true;
      }
      if (finalRef.current) finalRef.current.visible = false;
      if (finalDiskRef.current) finalDiskRef.current.visible = false;
      if (finalHaloRef.current) finalHaloRef.current.visible = false;
    } else if (phase === 'merger') {
      // Merger: la separación cae a 0 en este fracción
      const sep = 0.4 * (1 - phaseT);
      const omega = 12 + 8 * phaseT;
      const angle = clock.elapsedTime * omega;
      const m1 = 36, m2 = 29;
      const x1 =  sep * (m2 / (m1 + m2)) * Math.cos(angle);
      const z1 =  sep * (m2 / (m1 + m2)) * Math.sin(angle);
      const x2 = -sep * (m1 / (m1 + m2)) * Math.cos(angle);
      const z2 = -sep * (m1 / (m1 + m2)) * Math.sin(angle);

      if (bh1Ref.current) {
        bh1Ref.current.position.set(x1, 0, z1);
        bh1Ref.current.scale.setScalar(1 + phaseT * 0.5);
        bh1Ref.current.visible = true;
      }
      if (bh2Ref.current) {
        bh2Ref.current.position.set(x2, 0, z2);
        bh2Ref.current.scale.setScalar(1 + phaseT * 0.5);
        bh2Ref.current.visible = true;
      }
      if (finalRef.current) finalRef.current.visible = false;
      if (finalDiskRef.current) finalDiskRef.current.visible = false;
      if (finalHaloRef.current) finalHaloRef.current.visible = false;
    } else {
      // RINGDOWN: solo el BH final, posiblemente "wobbling" inicialmente
      if (bh1Ref.current) bh1Ref.current.visible = false;
      if (bh2Ref.current) bh2Ref.current.visible = false;
      if (finalRef.current) {
        finalRef.current.visible = true;
        // Pulse leve en los primeros 200ms del ringdown
        const wobble = phaseT < 0.15 ? 1 + 0.1 * Math.sin(phaseT * 40) * (1 - phaseT / 0.15) : 1;
        finalRef.current.scale.setScalar(0.85 * wobble);
      }
      if (finalDiskRef.current) {
        finalDiskRef.current.visible = true;
        finalDiskRef.current.rotation.y = clock.elapsedTime * 1.5;
      }
      if (finalHaloRef.current) {
        finalHaloRef.current.visible = true;
        const mat = finalHaloRef.current.material as THREE.SpriteMaterial;
        mat.opacity = Math.max(0.2, 0.95 - phaseT * 0.5);
      }
    }

    // ── ONDAS GRAVITACIONALES ────────────────────────────
    // Cuatro anillos en el plano XZ que se expanden hacia afuera con frecuencia
    // proporcional al chirp (orbital angular frequency × 2)
    const waves = [wave1Ref.current, wave2Ref.current, wave3Ref.current, wave4Ref.current];
    waves.forEach((mesh, i) => {
      if (!mesh) return;
      const offset = i * 0.25;
      const waveT = ((clock.elapsedTime * 0.55) % 1 + offset) % 1;
      const ring = mesh as THREE.Mesh;
      const radius = 0.5 + waveT * 7;
      ring.scale.setScalar(radius);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - waveT) * 0.55 * (phase === 'inspiral' ? 0.9 + 0.3 * (t / 0.65)
                                          : phase === 'merger' ? 1.5
                                          : Math.max(0, 1 - phaseT * 1.4));
    });
  });

  // Quattro anillos
  const ringGeom = useMemo(() => new THREE.RingGeometry(0.97, 1.0, 96), []);

  return (
    <group>
      {/* BH1 (más masivo, color cálido) */}
      <mesh ref={bh1Ref}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <sprite scale={[1.3, 1.3, 1]}>
        <spriteMaterial map={haloTexture} blending={THREE.AdditiveBlending}
                        depthWrite={false} transparent />
      </sprite>

      {/* BH2 (más chico) */}
      <mesh ref={bh2Ref}>
        <sphereGeometry args={[0.30, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* BH final post-merger */}
      <mesh ref={finalRef} visible={false}>
        <sphereGeometry args={[0.62, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh ref={finalDiskRef} visible={false} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0.65, 1.4, 96]} />
        <meshBasicMaterial color="#FDB813" transparent opacity={0.45}
                          side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <sprite ref={finalHaloRef} scale={[2.5, 2.5, 1]} visible={false}>
        <spriteMaterial map={haloTexture} blending={THREE.AdditiveBlending}
                        depthWrite={false} transparent />
      </sprite>

      {/* Ondas gravitacionales en plano orbital */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh ref={wave1Ref} geometry={ringGeom}>
          <meshBasicMaterial color="#A78BFA" transparent opacity={0.5}
                            side={THREE.DoubleSide} blending={THREE.AdditiveBlending}
                            depthWrite={false} />
        </mesh>
        <mesh ref={wave2Ref} geometry={ringGeom}>
          <meshBasicMaterial color="#F472B6" transparent opacity={0.5}
                            side={THREE.DoubleSide} blending={THREE.AdditiveBlending}
                            depthWrite={false} />
        </mesh>
        <mesh ref={wave3Ref} geometry={ringGeom}>
          <meshBasicMaterial color="#4FC3F7" transparent opacity={0.5}
                            side={THREE.DoubleSide} blending={THREE.AdditiveBlending}
                            depthWrite={false} />
        </mesh>
        <mesh ref={wave4Ref} geometry={ringGeom}>
          <meshBasicMaterial color="#FDB813" transparent opacity={0.5}
                            side={THREE.DoubleSide} blending={THREE.AdditiveBlending}
                            depthWrite={false} />
        </mesh>
      </group>

      <pointLight position={[0, 0, 0]} intensity={2.4} distance={6} color="#F472B6" />
    </group>
  );
}

function BHMerger() {
  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #0F0628 0%, #05060A 80%)',
    }}>
      <Canvas camera={{ position: [0, 6, 14], fov: 38 }} gl={makeRenderer()}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 4]} intensity={0.5} />
        <MergerScene />
        <OrbitControls enablePan={false} enableZoom
                       autoRotate autoRotateSpeed={0.2}
                       minDistance={4} maxDistance={40}
                       minPolarAngle={0.3} maxPolarAngle={2.2} />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        <div>GW150914 · 14 sep 2015 · 1.3 Gly · LIGO Livingston + Hanford</div>
        <div className="text-[10px] text-[#475569] mt-1">M₁ = 36 M☉ · M₂ = 29 M☉ · M_final = 62 M☉ · ΔE = 3 M☉c² → ondas GW</div>
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-[#475569]">
        anillos = ondas gravitacionales propagándose<br/>
        chirp visible: la órbita se acelera hasta el merger
      </div>
    </div>
  );
}

export default memo(BHMerger);
