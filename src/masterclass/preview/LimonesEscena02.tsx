/**
 * LimonesEscena02 — "El comprador racional · ¿urgido o esconde algo?"
 *
 * Escena 2 del Capítulo 1. Duración: ~25 segundos.
 * Template: misconception confrontation (inversion según las 8 plantillas).
 * Mood arc: inquietud cálida (0-12s) → cooling decisión (12-20s) → casi azul (20-25s).
 *
 * Timeline:
 *   0.0–3.0   Carro Tsuru solitario, cámara baja. Silencio visual.
 *   3.0–6.0   Aparece silueta del vecino (fade-in con motion vertical).
 *   6.0–9.0   Bubble "ESTÁ URGIDO" aparece a la izquierda del vecino.
 *   9.0–12.0  Bubble "ESCONDE ALGO" aparece a la derecha del vecino.
 *   12.0–16.0 Hold de las dos opciones. El alumno está decidiendo.
 *   16.0–20.0 "URGIDO" se atenúa. "ESCONDE ALGO" se highlight (la opción correcta).
 *   20.0–23.0 "URGIDO" fade-out. El cofre del Tsuru empieza a entreabrirse.
 *   23.0–25.0 Cofre completamente entreabierto. Hold de tensión. Push-in.
 *
 * Reusa: TsuruWireframe, makePriceTexture pattern, paleta PostFX canónica.
 * Nuevo: PersonSilhouette, ThoughtBubble, HoodOpening (in-line).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import TsuruWireframe from './TsuruWireframe';
import PersonSilhouette from './PersonSilhouette';
import ThoughtBubble, { type ThoughtBubbleHandle } from './ThoughtBubble';
import PostFX from '../scenes/_postFX';

const AUDIO_URL = '/audio/preview/02-misconception.mp3';
const AUDIO_DURATION = 19.64; // medido con ffprobe
const SCENE_LOOP_DURATION = 23;

// ─────────────────────────────────────────────────────────────
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

// ─────────────────────────────────────────────────────────────
// Sky dome con gradient cool-warm transición

function NightSky({ skyRef }: { skyRef: React.RefObject<THREE.Mesh | null> }) {
  return (
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
  );
}

// ─────────────────────────────────────────────────────────────
function Floor() {
  return (
    <group>
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
      {/* Underglow bajo el carro */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.94, 0]}>
        <circleGeometry args={[3.0, 32]} />
        <meshBasicMaterial
          color="#FFB870"
          transparent
          opacity={0.13}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function LampPostForeground() {
  return (
    <group position={[-5.0, 0, 2.4]}>
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 3.6, 8]} />
        <meshBasicMaterial color="#08060A" />
      </mesh>
      <mesh position={[0.5, 3.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.0, 8]} />
        <meshBasicMaterial color="#08060A" />
      </mesh>
      <mesh position={[0.95, 3.35, 0]}>
        <coneGeometry args={[0.25, 0.35, 8]} />
        <meshBasicMaterial color="#08060A" />
      </mesh>
      <mesh position={[0.95, 3.25, 0]}>
        <sphereGeometry args={[0.14, 14, 10]} />
        <meshBasicMaterial color="#FFD080" toneMapped={false} />
      </mesh>
      <pointLight position={[0.95, 3.25, 0]} intensity={0.5} color="#FFB870" distance={10} />
    </group>
  );
}

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

function Dust({ count = 70 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const positions = useMemo(() => {
    const arr: Array<{ x: number; y: number; z: number; speed: number; phase: number }> = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 18,
        y: Math.random() * 5 + 0.5,
        z: (Math.random() - 0.5) * 18,
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
// Lighting: similar a Escena 01 pero con un foco extra sobre el vecino
// (sutil) cuando aparece — sugiere "él es el que sabe"

function CinematicLighting({ coolnessRef, vecinoLightRef }: {
  coolnessRef: React.MutableRefObject<number>;
  vecinoLightRef: React.MutableRefObject<number>;
}) {
  const keyRef = useRef<THREE.SpotLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const vecinoFocusRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const c = coolnessRef.current;
    if (keyRef.current) {
      const warm = new THREE.Color('#FFB870');
      const cool = new THREE.Color('#B8C8F5');
      const col = warm.clone().lerp(cool, c);
      keyRef.current.color = col;
      keyRef.current.intensity = 13 - 2 * c;
    }
    if (rimRef.current) rimRef.current.intensity = 0.35 + 0.65 * c;
    if (fillRef.current) fillRef.current.intensity = 0.18 + 0.10 * c;
    if (ambientRef.current) {
      const warm = new THREE.Color('#3A2818');
      const cool = new THREE.Color('#181A2E');
      ambientRef.current.color = warm.clone().lerp(cool, c);
      ambientRef.current.intensity = 0.18;
    }
    // Foco sutil sobre el vecino — sube cuando él aparece
    if (vecinoFocusRef.current) {
      vecinoFocusRef.current.intensity = 0.8 * vecinoLightRef.current;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.18} />
      <spotLight
        ref={keyRef}
        position={[1.0, 7, 1.5]}
        target-position={[0, 0, 0]}
        angle={0.55}
        penumbra={0.65}
        intensity={13}
        color="#FFB870"
        distance={20}
      />
      <directionalLight ref={rimRef} position={[-5, 2.5, -4]} intensity={0.35} color="#7FB0FF" />
      <directionalLight ref={fillRef} position={[-3, 3, 4]} intensity={0.18} color="#FFFFFF" />
      <pointLight position={[0, -0.4, 0]} intensity={0.4} color="#FDB813" distance={4} />
      {/* Foco específico para el vecino (cool blue, contrasta con el cálido del carro) */}
      <pointLight
        ref={vecinoFocusRef}
        position={[3.0, 2.0, 0.5]}
        intensity={0}
        color="#B8C8F5"
        distance={5}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
function CameraDirector({ coolnessRef, vecinoLightRef, timeRef }: {
  coolnessRef: React.MutableRefObject<number>;
  vecinoLightRef: React.MutableRefObject<number>;
  timeRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % SCENE_LOOP_DURATION;

    // Base: distance más amplia para encuadrar carro + vecino + bubbles
    const baseDist = 7.5;
    const baseHeight = 1.10;
    const baseOrbit = 0.18;

    // Phase A: drift hacia el vecino (2.4-7.8s)
    const driftToVecino = easeInOutCubic(clamp((t - 2.4) / 5.4, 0, 1));
    // Phase B: push-in al cofre (15.7-19.6s)
    const pushToHood = easeInOutCubic(clamp((t - 15.7) / 3.9, 0, 1));

    const orbit = baseOrbit + 0.15 * driftToVecino - 0.05 * pushToHood + 0.04 * Math.sin(t * 0.20);
    const dist = baseDist - 0.5 * driftToVecino - 1.5 * pushToHood;
    const height = baseHeight + 0.10 * driftToVecino - 0.25 * pushToHood + 0.03 * Math.sin(t * 0.28);

    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);

    // Look target: midpoint carro+vecino (x≈1.0). Drift suave hacia vecino,
    // y push-in al cofre al final que vuelve hacia el carro.
    const lookX = 1.0 + 0.3 * driftToVecino - 0.8 * pushToHood;
    const lookY = 0.7 + 0.15 * driftToVecino + 0.10 * pushToHood;
    const lookZ = 0;
    camera.lookAt(lookX, lookY, lookZ);

    // Coolness arc: 0-7.8 warm, 7.8-14.1 transición, 14.1+ cool
    let coolness = 0;
    if (t < 7.8) coolness = 0;
    else if (t < 14.1) coolness = easeInOutCubic((t - 7.8) / 6.3);
    else coolness = 1;
    coolnessRef.current = coolness;

    // Vecino light: sube de 0 a 1 entre t=2.4 y t=5.5, hold hasta 17.3, baja después
    if (t < 2.4) vecinoLightRef.current = 0;
    else if (t < 5.5) vecinoLightRef.current = easeOutCubic((t - 2.4) / 3.1);
    else if (t < 17.3) vecinoLightRef.current = 1;
    else vecinoLightRef.current = 1 - easeOutCubic(clamp((t - 17.3) / 2.4, 0, 1));
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
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
// HoodOpening — wireframe trapezoid sobre el hood del Tsuru.
// Rotación 0 → -60° en X cuando el cofre se abre.
// Recibe el openProgress vía ref (NO state) para evitar re-renders.

function HoodOpening({ openProgressRef }: { openProgressRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const interiorMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!ref.current) return;
    const p = openProgressRef.current;
    ref.current.rotation.x = -p * (Math.PI / 3);
    if (matRef.current) matRef.current.opacity = p * 0.95;
    if (interiorMatRef.current) interiorMatRef.current.opacity = p * 0.7;
  });

  // Geometría del cofre (trapezoide vista plana, pivote en el borde trasero)
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    // El pivote está en (0,0,0). El cofre se extiende hacia el frente (X negativo en world).
    shape.moveTo(0, -0.45);     // pivote izq trasero
    shape.lineTo(0, 0.45);      // pivote der trasero
    shape.lineTo(0.85, 0.40);   // frente der (un poco más estrecho)
    shape.lineTo(0.85, -0.40);  // frente izq
    shape.lineTo(0, -0.45);     // cerrar
    return new THREE.EdgesGeometry(new THREE.ShapeGeometry(shape));
  }, []);

  return (
    // Position: encima del hood del Tsuru, pivote en la unión hood/cabina.
    // El Tsuru está rotado -0.42 rad en Y, así que el cofre debe ir en el frame del carro.
    <group position={[1.40 - 2.20, 0.72 - 0.85 + 0.02, 0]} ref={ref}>
      <lineSegments geometry={geo}>
        <lineBasicMaterial
          ref={matRef}
          color="#FFB81C"
          transparent
          opacity={0}
          toneMapped={false}
        />
      </lineSegments>
      {/* Interior oscuro visible cuando se abre: un trapezoid plano oscuro */}
      <mesh position={[0.42, 0, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.85, 0.85]} />
        <meshBasicMaterial
          ref={interiorMatRef}
          color="#1A0A05"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Scene content

function SceneContent({ aspect, audioRef, isPlaying }: {
  aspect: '9:16' | '16:9';
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const isMobile = aspect === '9:16';
  const carGroupRef = useRef<THREE.Group>(null);
  const vecinoGroupRef = useRef<THREE.Group>(null);
  const skyRef = useRef<THREE.Mesh>(null);
  const coolnessRef = useRef(0);
  const vecinoLightRef = useRef(0);

  // Bubble handles (imperative API — animan sin re-render)
  const bubbleUrgidoHandle = useRef<ThoughtBubbleHandle | null>(null);
  const bubbleEscondeHandle = useRef<ThoughtBubbleHandle | null>(null);
  // Hood opening progress — ref para evitar re-render por frame
  const hoodOpenRef = useRef(0);

  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);

  // (hood opening progress se gestiona en hoodOpenRef arriba — sin state)

  useFrame((_, dt) => {
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      timeRef.current += Math.min(dt, 0.1);
    }
    const t = timeRef.current % SCENE_LOOP_DURATION;
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;

    // ── Tsuru: rotación lenta + breathing
    if (carGroupRef.current) {
      carGroupRef.current.rotation.y = -0.42 + 0.08 * Math.sin(t * 0.40);
      carGroupRef.current.position.y = -0.05 + 0.05 * Math.sin(t * 0.55);
    }

    // ── Vecino: aparece entre t=2.4 y t=4.7 con motion vertical
    const vecinoAppear = clamp((t - 2.4) / 2.3, 0, 1);
    const vecinoEase = easeOutCubic(vecinoAppear);
    if (vecinoGroupRef.current) {
      vecinoGroupRef.current.position.y = -0.95 + 0.05 * Math.sin(t * 0.4);
      vecinoGroupRef.current.scale.setScalar(0.8 + 0.2 * vecinoEase);
      // Slight rotation breathing (rotation Y stays at -PI/2, looking at car)
      vecinoGroupRef.current.rotation.z = 0.015 * Math.sin(t * 0.6);
    }

    // ── Bubble URGIDO (t=4.7-7.1 aparece, hold, t=12.6-15.7 atenúa, t=15.7+ fadeout)
    if (bubbleUrgidoHandle.current) {
      const appear = clamp((t - 4.7) / 2.0, 0, 1);
      const dimAfter = clamp((t - 12.6) / 3.1, 0, 1);
      const fadeOut = clamp((t - 15.7) / 1.5, 0, 1);
      const opacity = easeOutCubic(appear) * (1 - 0.7 * dimAfter) * (1 - fadeOut);
      const scale = bubbleScale * (0.6 + 0.4 * easeOutQuart(appear));
      bubbleUrgidoHandle.current.setOpacity(opacity);
      bubbleUrgidoHandle.current.setScale(scale);
    }

    // ── Bubble ESCONDE ALGO (t=7.1-9.4 aparece, hold, t=12.6+ se highlight)
    if (bubbleEscondeHandle.current) {
      const appear = clamp((t - 7.1) / 2.0, 0, 1);
      const highlightT = clamp((t - 12.6) / 2.5, 0, 1);
      const opacity = easeOutCubic(appear);
      const scale = bubbleScale * (0.6 + 0.4 * easeOutQuart(appear)) * (1 + 0.10 * easeOutCubic(highlightT));
      bubbleEscondeHandle.current.setOpacity(opacity);
      bubbleEscondeHandle.current.setScale(scale);
      bubbleEscondeHandle.current.setHighlightOpacity(highlightT * 0.6);
    }

    // ── Hood opening (t=15.7-18.1) — vía ref, NO state
    hoodOpenRef.current = easeInOutCubic(clamp((t - 15.7) / 2.4, 0, 1));
  });

  // Posiciones de bubbles según aspect.
  // Desktop: bubbles a los lados del vecino, dentro del frame ampliado.
  // Mobile: bubbles apilados verticalmente sobre el vecino.
  const bubbleUrgidoPos: [number, number, number] = isMobile ? [0, 2.7, 0.8] : [0.4, 2.5, 0.7];
  const bubbleEscondePos: [number, number, number] = isMobile ? [0, 1.8, 0.8] : [3.5, 2.5, 0.7];
  const bubbleScale = isMobile ? 0.60 : 1.0;

  return (
    <>
      <NightSky skyRef={skyRef} />
      <SkyUpdater skyRef={skyRef} coolnessRef={coolnessRef} />
      <CinematicLighting coolnessRef={coolnessRef} vecinoLightRef={vecinoLightRef} />
      <CameraDirector coolnessRef={coolnessRef} vecinoLightRef={vecinoLightRef} timeRef={timeRef} />

      <Floor />
      <CityBackground />
      <LampPostForeground />
      <Dust count={70} />

      {/* Tsuru — el carro central */}
      <group ref={carGroupRef} position={[0, -0.05, 0]} rotation={[0, -0.42, 0]}>
        <TsuruWireframe scale={1.0} color="#FFB81C" fillIntensity={0.10} />
        {/* HoodOpening está adentro del carro group para que rote con él */}
        <HoodOpening openProgressRef={hoodOpenRef} />
      </group>

      {/* Vecino — silueta a la derecha del carro. Sin rotación Y: el plano debe
          mirar a cámara (es una silueta plana). La narrativa de "mira al carro"
          se sostiene por la posición lateral y el contexto, no por la rotación. */}
      <group ref={vecinoGroupRef} position={[2.4, -0.95, 0.8]}>
        <PersonSilhouette scale={1.0} color="#08060A" rimColor="#FFB81C" />
      </group>

      {/* Bubble: ESTÁ URGIDO */}
      <ThoughtBubble
        ref={bubbleUrgidoHandle}
        text="¿ESTÁ URGIDO?"
        position={bubbleUrgidoPos}
        scale={bubbleScale * 0.6}
        textColor="#FFE5A0"
        borderColor="#FFB81C"
      />

      {/* Bubble: ESCONDE ALGO */}
      <ThoughtBubble
        ref={bubbleEscondeHandle}
        text="¿ESCONDE ALGO?"
        position={bubbleEscondePos}
        scale={bubbleScale * 0.6}
        textColor="#FFD580"
        borderColor="#FFB81C"
      />

      {/* Fog atmosférico */}
      <fog attach="fog" args={['#0a0510', 6, 28]} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
function HudOverlay({ aspect }: { aspect: '9:16' | '16:9' }) {
  const isVertical = aspect === '9:16';
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"
        style={{ height: isVertical ? '12%' : '8%' }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"
        style={{ height: isVertical ? '22%' : '14%' }}
      />
      <div
        className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.3em] text-[#FFE5A0]/55 font-mono pointer-events-none"
      >
        Akerlof · Cap 1 · Escena 2
      </div>
      <SceneTimer />
    </div>
  );
}

function SceneTimer() {
  const timerRef = useRef<HTMLSpanElement>(null);
  useMemo(() => {
    const start = performance.now();
    const tick = () => {
      const elapsed = ((performance.now() - start) / 1000) % SCENE_LOOP_DURATION;
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
interface LimonesEscena02Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena02({ forceAspect = 'auto' }: LimonesEscena02Props) {
  const aspect: '9:16' | '16:9' =
    forceAspect === 'auto'
      ? typeof window !== 'undefined' && window.innerHeight > window.innerWidth
        ? '9:16'
        : '16:9'
      : forceAspect;

  const fov = aspect === '9:16' ? 52 : 42;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const isScreenshotMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('t');
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      setIsPlaying(false);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }, 2500);
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
        background: 'radial-gradient(ellipse at 50% 35%, #1a1015 0%, #050308 80%)',
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

      {!hasStarted && !isScreenshotMode && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer group"
          style={{ zIndex: 50 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-full border-2 border-[#FFE5A0] flex items-center justify-center group-hover:scale-110 transition-transform"
              style={{ boxShadow: '0 0 30px rgba(255, 229, 160, 0.6)' }}
            >
              <div className="text-[#FFE5A0] text-3xl ml-1.5">▶</div>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0]/70 font-mono">
              Cap 1 · Escena 2 · ~25s
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              audífonos recomendados
            </div>
          </div>
        </button>
      )}

      {/* Reference (silenced unused var warning for AUDIO_DURATION) */}
      <span style={{ display: 'none' }}>{AUDIO_DURATION}</span>
    </div>
  );
}
