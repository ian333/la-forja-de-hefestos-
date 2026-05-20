/**
 * LimonesEscena01 — "El carro de tu vecino · $200k → $160k · ¿por qué?"
 *
 * Escena 1 del Capítulo 1 de la masterclass Akerlof Limones.
 * Duración: 15 segundos.
 * Estilo: Cyberpunk Wireframe (silueta Tsuru dorada, precio digital, fondo nocturno).
 * Mood arc: tungsteno cálido → flash dorado → quietud → atenuación azul fría.
 *
 * Timeline (en segundos):
 *   0.0–3.0   Carro en quietud. Solo el Tsuru bajo luz cálida.
 *   3.0–4.5   "$200,000" fade-in con destello dorado + scale-up.
 *   4.5–7.5   Hold del precio. Bobbing sutil del carro.
 *   7.5–9.5   Strike-through rojo cruza el precio.
 *   9.5–11.0  "$160,000" aparece debajo, más opaco, con shake sutil.
 *   11.0–13.0 Hold. Mood empieza a enfriarse.
 *   13.0–15.0 Camera push-in 30%. Atenuación azul.
 *   15.0+     Loop (modo preview).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import TsuruWireframe from './TsuruWireframe';
import PostFX from '../scenes/_postFX';

// Audio path — generado por scripts/voice-gaia/generate.cjs con eleven_v3
const AUDIO_URL = '/audio/preview/01-hook.mp3';
const AUDIO_DURATION = 14.37; // segundos, medido con ffprobe
const SCENE_LOOP_DURATION = 18; // tiempo total del loop (audio + cliffhanger silence)

// ─────────────────────────────────────────────────────────────
// Easing utilities

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

// ─────────────────────────────────────────────────────────────
// Canvas-textured price (function — used in useMemo below)

function makePriceTexture(text: string, color: string, fontPx: number = 320): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const W = 2048;
  const H = 512;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = color;
  ctx.font = `700 ${fontPx}px "JetBrains Mono", "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Multi-pass shadow para halo
  ctx.shadowColor = color;
  ctx.shadowBlur = 36;
  ctx.fillText(text, W / 2, H / 2);
  ctx.shadowBlur = 12;
  ctx.fillText(text, W / 2, H / 2);
  ctx.shadowBlur = 0;
  ctx.fillText(text, W / 2, H / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// ─────────────────────────────────────────────────────────────
// Sky dome (gradient deep blue → black)

function NightSky() {
  const geometry = useMemo(() => new THREE.SphereGeometry(80, 32, 16), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          coolness: { value: 0 }, // 0 = warm tungsten, 1 = cold blue
        },
        vertexShader: `
        varying vec3 vWP;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWP = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
        fragmentShader: `
        uniform float coolness;
        varying vec3 vWP;
        void main() {
          float h = normalize(vWP).y;
          // Warm gradient (tungsten lamp feel)
          vec3 warmTop = vec3(0.025, 0.020, 0.040);
          vec3 warmBot = vec3(0.060, 0.035, 0.020);
          // Cold gradient (analytic blue)
          vec3 coldTop = vec3(0.010, 0.020, 0.060);
          vec3 coldBot = vec3(0.020, 0.040, 0.075);

          vec3 top = mix(warmTop, coldTop, coolness);
          vec3 bot = mix(warmBot, coldBot, coolness);
          vec3 col = mix(bot, top, smoothstep(-0.3, 0.7, h));

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      }),
    [],
  );
  // Expose uniform handle
  (material as any).__coolnessUniform = material.uniforms.coolness;
  return <mesh geometry={geometry} material={material} userData={{ matRef: material }} />;
}

// ─────────────────────────────────────────────────────────────
// Floor — asfalto mojado nocturno simulado (sin reflector real para
// no matar el framerate en mobile; el bloom y la composición ya hacen
// que se sienta cinemático).

function Floor() {
  return (
    <group>
      {/* Capa principal del piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          color="#080510"
          roughness={0.20}
          metalness={0.85}
          emissive="#0A0512"
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Underglow cálido bajo el carro — simula reflexión del key light */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.94, 0]}>
        <circleGeometry args={[3.5, 32]} />
        <meshBasicMaterial
          color="#FFB870"
          transparent
          opacity={0.15}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Foreground: silueta de poste de luz (cierra el frame, da escala humana)

function LampPostForeground() {
  return (
    <group position={[-4.8, 0, 2.2]}>
      {/* Poste */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 3.6, 8]} />
        <meshBasicMaterial color="#08060A" />
      </mesh>
      {/* Brazo horizontal */}
      <mesh position={[0.5, 3.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.0, 8]} />
        <meshBasicMaterial color="#08060A" />
      </mesh>
      {/* Cabeza de farola con luz */}
      <mesh position={[0.95, 3.35, 0]}>
        <coneGeometry args={[0.25, 0.35, 8]} />
        <meshBasicMaterial color="#08060A" />
      </mesh>
      {/* Glow de la farola */}
      <mesh position={[0.95, 3.25, 0]}>
        <sphereGeometry args={[0.14, 14, 10]} />
        <meshBasicMaterial color="#FFD080" toneMapped={false} />
      </mesh>
      <pointLight position={[0.95, 3.25, 0]} intensity={0.6} color="#FFB870" distance={12} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Background: ventanas lejanas de edificios (anclaje al espacio urbano)

function CityBackground() {
  const windows = useMemo(() => {
    const arr: Array<{ x: number; y: number; intensity: number; color: string }> = [];
    const rng = (s: number) => { const x = Math.sin(s * 78.233) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < 28; i++) {
      arr.push({
        x: (rng(i) - 0.5) * 60,
        y: 1.5 + rng(i + 100) * 6,
        intensity: 0.4 + rng(i + 200) * 0.7,
        color: rng(i + 300) > 0.7 ? '#FFE5A0' : '#FFD080',
      });
    }
    return arr;
  }, []);

  return (
    <group position={[0, 0, -22]}>
      {windows.map((w, i) => (
        <mesh key={i} position={[w.x, w.y, 0]}>
          <planeGeometry args={[0.18, 0.22]} />
          <meshBasicMaterial color={w.color} transparent opacity={w.intensity * 0.45} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Floating dust particles (ambient depth)

function Dust({ count = 80 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const positions = useMemo(() => {
    const arr: Array<{ x: number; y: number; z: number; speed: number; phase: number }> = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 5 + 0.5,
        z: (Math.random() - 0.5) * 20,
        speed: 0.1 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const y = p.y + Math.sin(t * p.speed + p.phase) * 0.15;
      const x = p.x + Math.cos(t * p.speed * 0.7 + p.phase) * 0.05;
      dummy.position.set(x, y, p.z);
      dummy.scale.setScalar(0.012);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color="#FFE5A0" transparent opacity={0.35} toneMapped={false} />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────
// Key light + rim light + ambient (warm → cool transition)

function CinematicLighting({ coolnessRef }: { coolnessRef: React.MutableRefObject<number> }) {
  const keyRef = useRef<THREE.SpotLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);

  useFrame(() => {
    const c = coolnessRef.current; // 0..1

    // KEY (spotlight): cono cálido tipo farola → enfría hacia analítico azul
    if (keyRef.current) {
      const warm = new THREE.Color('#FFB870');
      const cool = new THREE.Color('#B8C8F5');
      const col = warm.clone().lerp(cool, c);
      keyRef.current.color = col;
      keyRef.current.intensity = 14 - 2 * c;
    }

    // RIM: empuja el contorno desde atrás. Sube con coolness.
    if (rimRef.current) {
      rimRef.current.intensity = 0.35 + 0.65 * c;
    }

    // FILL: contraataca al key para que las sombras no sean totalmente negras
    if (fillRef.current) {
      fillRef.current.intensity = 0.18 + 0.10 * c;
    }

    // AMBIENT: bajo, solo levanta los negros más oscuros
    if (ambientRef.current) {
      const warm = new THREE.Color('#3A2818');
      const cool = new THREE.Color('#181A2E');
      ambientRef.current.color = warm.clone().lerp(cool, c);
      ambientRef.current.intensity = 0.18;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.18} />
      {/* KEY — spotlight cónico desde arriba simulando farola sobre el carro */}
      {/* castShadow=false intencional: el spotlight shadow map mata FPS */}
      <spotLight
        ref={keyRef}
        position={[1.5, 7, 1.5]}
        target-position={[0, 0, 0]}
        angle={0.55}
        penumbra={0.65}
        intensity={14}
        color="#FFB870"
        distance={20}
      />
      {/* RIM — desde atrás-izquierda en plano XZ */}
      <directionalLight ref={rimRef} position={[-5, 2.5, -4]} intensity={0.35} color="#7FB0FF" />
      {/* FILL — desde el lado opuesto al key */}
      <directionalLight ref={fillRef} position={[-3, 3, 4]} intensity={0.18} color="#FFFFFF" />
      {/* Glow muy sutil bajo el carro (anclaje visual) */}
      <pointLight position={[0, -0.4, 0]} intensity={0.4} color="#FDB813" distance={4} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Camera director — sigue el timeline

function CameraDirector({ coolnessRef, timeRef }: {
  coolnessRef: React.MutableRefObject<number>;
  timeRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % 18; // loop preview every 18s

    // Base: low-angle 3/4 front-side. Cámara bajo el horizonte del techo del carro
    // para crear sensación heroica. Looking slightly UP al precio que flota arriba.
    const baseDist = 5.6;
    const baseHeight = 0.85;
    const baseOrbit = 0.20; // ligeramente desde el lado del conductor

    // Push-in dramático entre t=12 y t=15 (45% más cerca, baja más, se inclina)
    const pushProgress = easeInOutCubic(clamp((t - 12) / 3, 0, 1));
    const dist = baseDist - 2.5 * pushProgress;
    const height = baseHeight - 0.30 * pushProgress;

    // Slight breathing — orbit muy sutil, sin marear
    const orbit = baseOrbit + 0.06 * Math.sin(t * 0.22);
    // Tiny vertical breath
    const vbreath = 0.04 * Math.sin(t * 0.31);

    camera.position.set(Math.sin(orbit) * dist, height + vbreath, Math.cos(orbit) * dist);

    // Mira ligeramente HACIA ARRIBA al carro/precio (low-angle heroic)
    // Cuando llega el push-in, la mirada baja hacia el centro del carro.
    const lookY = 0.95 - 0.30 * pushProgress;
    camera.lookAt(0, lookY, 0);

    // Coolness arc: warm hasta t=6.5, transición 6.5-11, cool desde 11
    let coolness = 0;
    if (t < 6.5) coolness = 0;
    else if (t < 11) coolness = easeInOutCubic((t - 6.5) / 4.5);
    else coolness = 1;
    coolnessRef.current = coolness;
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Sky updater — uniformemente coolness driven

function SkyUpdater({ skyRef, coolnessRef }: {
  skyRef: React.RefObject<THREE.Mesh | null>;
  coolnessRef: React.MutableRefObject<number>;
}) {
  useFrame(() => {
    if (!skyRef.current) return;
    const mat = skyRef.current.material as THREE.ShaderMaterial;
    if (mat && mat.uniforms && mat.uniforms.coolness) {
      mat.uniforms.coolness.value = coolnessRef.current;
    }
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Main scene composition

function SceneContent({ aspect, audioRef, isPlaying }: {
  aspect: '9:16' | '16:9';
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const isMobile = aspect === '9:16';
  // Factor de escala global para el precio según aspect (mobile = más pequeño)
  const priceScaleFactor = isMobile ? 0.55 : 1.0;
  // Refs imperativos para animación sin re-renders
  const carGroupRef = useRef<THREE.Group>(null);

  const price200GroupRef = useRef<THREE.Group>(null);
  const price200MatRef = useRef<THREE.MeshBasicMaterial>(null);
  const price200HaloMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const strikeGroupRef = useRef<THREE.Group>(null);
  const strikeMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const price160GroupRef = useRef<THREE.Group>(null);
  const price160MatRef = useRef<THREE.MeshBasicMaterial>(null);
  const price160HaloMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const flashMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const flashGroupRef = useRef<THREE.Group>(null);

  const skyRef = useRef<THREE.Mesh>(null);
  const coolnessRef = useRef(0);
  // Permite arrancar en un timestamp arbitrario para preview/screenshot.
  // ?t=4 en la URL → la escena empieza a los 4 segundos.
  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);

  // Texturas precomputadas
  const tex200 = useMemo(() => makePriceTexture('$200,000', '#FFE5A0', 340), []);
  const tex160 = useMemo(() => makePriceTexture('$160,000', '#FFD580', 320), []);

  useFrame((_, dt) => {
    // Si hay audio reproduciendo, sincroniza timeRef con audio.currentTime.
    // Esto evita drift entre voz y visual durante un loop largo.
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      // Timer manual: garantiza que arranca en 0 desde el primer frame
      timeRef.current += Math.min(dt, 0.1); // clamp para evitar saltos tras pausas
    }
    const t = timeRef.current % SCENE_LOOP_DURATION; // loop
    // Expose el timer MONOTÓNICO (no modulado) para sync de screenshots
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;

    // ── Tsuru: rotación continua + breathing vertical más vivo
    // El movimiento constante mantiene la "respiración visual" entre beats.
    if (carGroupRef.current) {
      carGroupRef.current.rotation.y = -0.42 + 0.12 * Math.sin(t * 0.45);
      carGroupRef.current.position.y = -0.05 + 0.06 * Math.sin(t * 0.65);
      // Slight side-tilt para que se sienta "alive"
      carGroupRef.current.rotation.z = 0.012 * Math.sin(t * 0.55);
    }

    // ── $200,000 fade-in (t=3-4.5)
    const p200Appear = clamp((t - 3.0) / 1.5, 0, 1);
    const p200Opacity = easeOutCubic(p200Appear);
    if (price200MatRef.current) price200MatRef.current.opacity = p200Opacity;
    if (price200HaloMatRef.current) price200HaloMatRef.current.opacity = p200Opacity * 0.35;
    if (price200GroupRef.current) {
      const scale = (0.65 + 0.35 * easeOutQuart(p200Appear)) * priceScaleFactor;
      price200GroupRef.current.scale.setScalar(scale);
      // Tiny settle motion (overshoot + settle)
      const settle = easeOutCubic(p200Appear);
      const targetY = isMobile ? 2.2 : 1.9;
      price200GroupRef.current.position.y = targetY + (1 - settle) * 0.15;
    }

    // ── Flash de aparición (brief, t=3.3-3.7)
    if (flashMatRef.current && flashGroupRef.current) {
      const flashT = (t - 3.3) / 0.4;
      let flashOpacity = 0;
      if (flashT > 0 && flashT < 1) {
        // Bell curve
        flashOpacity = Math.sin(flashT * Math.PI) * 0.7;
      }
      flashMatRef.current.opacity = flashOpacity;
      flashGroupRef.current.scale.setScalar(1 + flashT * 2);
    }

    // ── Strike-through (t=7.5-9.5)
    const strikeProgress = clamp((t - 7.5) / 2.0, 0, 1);
    const strikeEased = easeInOutCubic(strikeProgress);
    if (strikeGroupRef.current && strikeMatRef.current) {
      const strikeWidth = 3.4 * strikeEased;
      strikeGroupRef.current.scale.set(strikeEased, 1, 1);
      strikeGroupRef.current.position.x = -1.7 + (strikeWidth / 2);
      strikeMatRef.current.opacity = strikeProgress > 0 ? Math.min(1, strikeProgress * 3) : 0;
    }
    // After strike, fade $200k slightly (la mente sabe que ya no aplica)
    if (price200MatRef.current && t > 9.5) {
      const fadeAfter = clamp((t - 9.5) / 1.0, 0, 1);
      price200MatRef.current.opacity = p200Opacity * (1 - 0.45 * fadeAfter);
    }

    // ── $160,000 fade-in (t=9.5-11.0)
    const p160Appear = clamp((t - 9.5) / 1.5, 0, 1);
    const p160Opacity = easeOutCubic(p160Appear);
    if (price160MatRef.current) price160MatRef.current.opacity = p160Opacity * 0.95;
    if (price160HaloMatRef.current) price160HaloMatRef.current.opacity = p160Opacity * 0.3;
    if (price160GroupRef.current) {
      const scale = (0.7 + 0.3 * easeOutQuart(p160Appear)) * priceScaleFactor;
      price160GroupRef.current.scale.setScalar(scale);
      // Slight settle from below
      const settle = easeOutCubic(p160Appear);
      const targetY = isMobile ? 1.1 : 0.6;
      price160GroupRef.current.position.y = targetY - (1 - settle) * 0.20;
    }
  });

  return (
    <>
      {/* Sky con coolness transition */}
      <mesh ref={skyRef}>
        <sphereGeometry args={[80, 32, 16]} />
        <shaderMaterial
          side={THREE.BackSide}
          uniforms={{ coolness: { value: 0 } }}
          vertexShader={`
            varying vec3 vWP;
            void main() {
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vWP = wp.xyz;
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          `}
          fragmentShader={`
            uniform float coolness;
            varying vec3 vWP;
            void main() {
              float h = normalize(vWP).y;
              vec3 warmTop = vec3(0.025, 0.020, 0.040);
              vec3 warmBot = vec3(0.060, 0.035, 0.020);
              vec3 coldTop = vec3(0.010, 0.020, 0.060);
              vec3 coldBot = vec3(0.020, 0.040, 0.075);
              vec3 top = mix(warmTop, coldTop, coolness);
              vec3 bot = mix(warmBot, coldBot, coolness);
              vec3 col = mix(bot, top, smoothstep(-0.3, 0.7, h));
              gl_FragColor = vec4(col, 1.0);
            }
          `}
        />
      </mesh>

      <SkyUpdater skyRef={skyRef} coolnessRef={coolnessRef} />
      <CinematicLighting coolnessRef={coolnessRef} />
      <CameraDirector coolnessRef={coolnessRef} timeRef={timeRef} />

      {/* Floor reflectivo — calle mojada nocturna */}
      <Floor />

      {/* Background: ventanas de edificios lejanos */}
      <CityBackground />

      {/* Foreground: silueta de farola, anclaje urbano */}
      <LampPostForeground />

      {/* Dust ambient (más denso cerca del carro) */}
      <Dust count={90} />

      {/* Tsuru — el carro central, sobre el piso reflejado */}
      <group ref={carGroupRef} position={[0, -0.05, 0]} rotation={[0, -0.42, 0]}>
        <TsuruWireframe scale={1.0} color="#FFB81C" fillIntensity={0.10} />
      </group>

      {/* Fog atmosférico denso — refuerza profundidad y separa fg/mg/bg */}
      <fog attach="fog" args={['#0a0510', 6, 28]} />

      {/* $200,000 — precio principal. Mobile usa scale más chico para caber. */}
      <group ref={price200GroupRef} position={[0, isMobile ? 2.2 : 1.9, 0]} scale={isMobile ? 0.38 : 0.70}>
        {/* Halo */}
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[5.0, 1.4]} />
          <meshBasicMaterial
            ref={price200HaloMatRef}
            map={tex200}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
        {/* Texto */}
        <mesh>
          <planeGeometry args={[4.0, 1.0]} />
          <meshBasicMaterial
            ref={price200MatRef}
            map={tex200}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
        {/* Strike-through */}
        <group ref={strikeGroupRef} position={[0, 0, 0.02]} scale={[0, 1, 1]}>
          <mesh>
            <planeGeometry args={[3.4, 0.08]} />
            <meshBasicMaterial
              ref={strikeMatRef}
              color="#FF5050"
              transparent
              opacity={0}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      {/* $160,000 — precio nuevo, debajo */}
      <group ref={price160GroupRef} position={[0, isMobile ? 1.1 : 0.6, 0]} scale={isMobile ? 0.42 : 0.75}>
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[4.5, 1.2]} />
          <meshBasicMaterial
            ref={price160HaloMatRef}
            map={tex160}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <planeGeometry args={[3.6, 0.9]} />
          <meshBasicMaterial
            ref={price160MatRef}
            map={tex160}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Flash de aparición — posición alineada al precio según aspect */}
      <group ref={flashGroupRef} position={[0, isMobile ? 2.2 : 1.9, 0.01]}>
        <mesh>
          <planeGeometry args={[5, 5]} />
          <meshBasicMaterial
            ref={flashMatRef}
            color="#FFFFCC"
            transparent
            opacity={0}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HUD overlay — minimal (sin player UI)

function HudOverlay({ aspect }: { aspect: '9:16' | '16:9' }) {
  const isVertical = aspect === '9:16';
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top safe-zone marker (very subtle) */}
      <div
        className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"
        style={{ height: isVertical ? '12%' : '8%' }}
      />
      {/* Bottom subtitle area (we'll add subtitle here later) */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"
        style={{ height: isVertical ? '22%' : '14%' }}
      />

      {/* Esquina superior izquierda: tag de capítulo */}
      <div
        className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.3em] text-[#FFE5A0]/55 font-mono pointer-events-none"
        style={{ marginTop: isVertical ? 'env(safe-area-inset-top, 1rem)' : 0 }}
      >
        Akerlof · Cap 1 · Escena 1
      </div>

      {/* Esquina superior derecha: tiempo cronológico (debug, futuro removal) */}
      <SceneTimer aspect={aspect} />
    </div>
  );
}

function SceneTimer({ aspect }: { aspect: string }) {
  const timerRef = useRef<HTMLSpanElement>(null);
  // Actualizar timer via raw rAF para evitar React re-render
  useMemo(() => {
    const start = performance.now();
    const tick = () => {
      const elapsed = ((performance.now() - start) / 1000) % 18;
      if (timerRef.current) {
        timerRef.current.textContent = elapsed.toFixed(1).padStart(4, '0') + ' s';
      }
      requestAnimationFrame(tick);
    };
    if (typeof window !== 'undefined') requestAnimationFrame(tick);
    return null;
  }, []);
  return (
    <div className="absolute top-6 right-6 text-[10px] text-[#FFE5A0]/40 font-mono pointer-events-none">
      <span ref={timerRef}>00.0 s</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Top-level — soporta tanto 9:16 mobile como 16:9 desktop

interface LimonesEscena01Props {
  /** Forzar aspect ratio. Default 'auto' (detecta del viewport). */
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena01({ forceAspect = 'auto' }: LimonesEscena01Props) {
  const aspect: '9:16' | '16:9' =
    forceAspect === 'auto'
      ? typeof window !== 'undefined' && window.innerHeight > window.innerWidth
        ? '9:16'
        : '16:9'
      : forceAspect;

  // FOV ligeramente distinto en mobile para compensar verticalidad
  const fov = aspect === '9:16' ? 52 : 42;

  // Audio playback state. Modo screenshot (?t=N) salta audio para no bloquear.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Detecta modo screenshot (URL tiene ?t=N)
  const isScreenshotMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('t');
  }, []);

  // Auto-loop: cuando termina el audio, espera 3.6s (cliffhanger) y reinicia.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      setIsPlaying(false);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => { /* user gesture required */ });
        }
      }, 3600);
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, []);

  const handlePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().then(() => {
      setIsPlaying(true);
      setHasStarted(true);
    }).catch(e => console.warn('autoplay blocked', e));
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 35%, #1a1015 0%, #050308 80%)',
      }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [1.5, 1.6, 6], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <SceneContent aspect={aspect} audioRef={audioRef} isPlaying={isPlaying} />
        {/* PostFX cinemático */}
        <PostFX
          intensity={1.8}
          threshold={0.18}
          smoothing={0.45}
          vignette={0.75}
          vignetteOffset={0.20}
          aberration={0.0014}
        />
      </Canvas>

      <HudOverlay aspect={aspect} />

      {/* Botón PLAY — solo visible antes de iniciar Y fuera de modo screenshot */}
      {!hasStarted && !isScreenshotMode && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer group"
          style={{ zIndex: 50 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full border-2 border-[#FFE5A0] flex items-center justify-center group-hover:scale-110 transition-transform"
              style={{ boxShadow: '0 0 30px rgba(255, 229, 160, 0.6)' }}>
              <div className="text-[#FFE5A0] text-3xl ml-1.5">▶</div>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0]/70 font-mono">
              Cap 1 · Escena 1 · 15s
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              audífonos recomendados
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
