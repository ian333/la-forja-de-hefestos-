/**
 * LimonesEscena03 — "Lo que el vecino sabe (rayos X)"
 *
 * Escena 3 del Cap 1. Duración: 27.95s (medido del audio real).
 * Template: reveal · Mood: asombro contemplativo (frío forense).
 *
 * Timeline:
 *   0.0–3.0   Tsuru estático. Cámara wide. Tensión.
 *   3.0–6.5   Cámara push-in hacia el hood del Tsuru (zoom dramático).
 *   5.5–9.0   MotorWireframe aparece (fade-in) dentro del hood.
 *   9.0–13.0  Defecto ROJO: "fuga de aceite". Pulse continuo.
 *   13.0–17.0 Defecto NARANJA: "choque previo". Sumado al rojo.
 *   17.0–21.0 Defecto MORADO: "odómetro alterado". Los 3 visibles.
 *   21.0–25.0 Pull-back largo. Vemos carro entero + motor visible + 3 defectos.
 *   25.0–28.0 Hold cliffhanger.
 *
 * Reusa: TsuruWireframe, SkyDome, Floor, LampPost, CityBg, Dust, PostFX,
 *        CinematicLighting (sin foco al vecino).
 * Nuevo: MotorWireframe + DefectPulse × 3.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import TsuruWireframe from './TsuruWireframe';
import MotorWireframe, { type MotorWireframeHandle } from './MotorWireframe';
import DefectPulse, { type DefectPulseHandle } from './DefectPulse';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const META_URL = '/audio/preview/meta.json';
const TRACK_FILE = '03-reveal-interno.mp3';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 27.95;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────
// Env components (idéntico a Escena 02 — refactor en commits futuros)

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

function CinematicLighting({ coolnessRef }: { coolnessRef: React.MutableRefObject<number> }) {
  const keyRef = useRef<THREE.SpotLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  useFrame(() => {
    const c = coolnessRef.current;
    if (keyRef.current) {
      const warm = new THREE.Color('#FFB870');
      const cool = new THREE.Color('#B8C8F5');
      keyRef.current.color = warm.clone().lerp(cool, c);
      keyRef.current.intensity = 12 - 2 * c;
    }
    if (rimRef.current) rimRef.current.intensity = 0.35 + 0.65 * c;
    if (fillRef.current) fillRef.current.intensity = 0.18 + 0.10 * c;
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
      <spotLight
        ref={keyRef}
        position={[1.0, 7, 1.5]}
        target-position={[0, 0, 0]}
        angle={0.55}
        penumbra={0.65}
        intensity={12}
        color="#FFB870"
        distance={20}
      />
      <directionalLight ref={rimRef} position={[-5, 2.5, -4]} intensity={0.35} color="#7FB0FF" />
      <directionalLight ref={fillRef} position={[-3, 3, 4]} intensity={0.18} color="#FFFFFF" />
      <pointLight position={[0, -0.4, 0]} intensity={0.4} color="#FDB813" distance={4} />
    </>
  );
}

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
// Camera director — push-in dramático al hood

function CameraDirector({ coolnessRef, timeRef, sceneLoopRef }: {
  coolnessRef: React.MutableRefObject<number>;
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;

    // Phase A: wide → push-in al hood (t=3 a t=6.5)
    const pushIn = easeInOutCubic(clamp((t - 3) / 3.5, 0, 1));
    // Phase B: pull-back lento (t=21 a t=25)
    const pullBack = easeInOutCubic(clamp((t - 21) / 4, 0, 1));

    // Cuando push-in está activo, dist baja; cuando pull-back vuelve.
    const wideDist = 7.5;
    const closeDist = 2.4;
    const dist = wideDist - (wideDist - closeDist) * pushIn + (wideDist - closeDist) * pullBack;
    const height = 1.10 - 0.5 * pushIn + 0.3 * pullBack;

    // El orbit ligeramente decrece durante push-in (cámara va recta al hood),
    // vuelve durante pull-back.
    const orbit = 0.18 + 0.05 * Math.sin(t * 0.18) - 0.10 * pushIn + 0.10 * pullBack;

    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);

    // Look target: al inicio mira al carro center, durante push-in mira al hood
    // (parte frontal del Tsuru), durante pull-back vuelve al carro center.
    const lookX = 0 + (-0.7) * pushIn + 0.7 * pullBack;
    const lookY = 0.7 - 0.30 * pushIn + 0.30 * pullBack;
    const lookZ = 0;
    camera.lookAt(lookX, lookY, lookZ);

    // Coolness arc: warm hasta t=6, transición 6-15, full cool desde 15
    let coolness = 0;
    if (t < 6) coolness = 0;
    else if (t < 15) coolness = easeInOutCubic((t - 6) / 9);
    else coolness = 1;
    coolnessRef.current = coolness;
  });
  return null;
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
  const motorHandle = useRef<MotorWireframeHandle | null>(null);
  const defectFugaHandle = useRef<DefectPulseHandle | null>(null);
  const defectChoqueHandle = useRef<DefectPulseHandle | null>(null);
  const defectOdoHandle = useRef<DefectPulseHandle | null>(null);
  const skyRef = useRef<THREE.Mesh>(null);
  const coolnessRef = useRef(0);
  const sceneLoopRef = useRef(31); // duración + pausa

  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);

  useFrame((_, dt) => {
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      timeRef.current += Math.min(dt, 0.1);
    }
    const t = timeRef.current % sceneLoopRef.current;
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;

    // ── Tsuru: ESTÁTICO durante esta escena. Sin breathing — la cámara hace
    //   el trabajo dramático sola. Solo un micro-tremor para "respirar".
    if (carGroupRef.current) {
      carGroupRef.current.rotation.y = -0.42;
      carGroupRef.current.position.y = -0.05 + 0.015 * Math.sin(t * 0.4);
    }

    // ── Motor fade-in (t=5.5 a 9.0)
    if (motorHandle.current) {
      const appear = easeOutCubic(clamp((t - 5.5) / 3.5, 0, 1));
      motorHandle.current.setOpacity(appear * 0.92);
    }

    // ── Defectos (secuenciales)
    if (defectFugaHandle.current) {
      const appear = easeOutCubic(clamp((t - 9.0) / 1.5, 0, 1));
      defectFugaHandle.current.setOpacity(appear);
    }
    if (defectChoqueHandle.current) {
      const appear = easeOutCubic(clamp((t - 13.0) / 1.5, 0, 1));
      defectChoqueHandle.current.setOpacity(appear);
    }
    if (defectOdoHandle.current) {
      const appear = easeOutCubic(clamp((t - 17.0) / 1.5, 0, 1));
      defectOdoHandle.current.setOpacity(appear);
    }
  });

  return (
    <>
      <NightSky skyRef={skyRef} />
      <SkyUpdater skyRef={skyRef} coolnessRef={coolnessRef} />
      <CinematicLighting coolnessRef={coolnessRef} />
      <CameraDirector coolnessRef={coolnessRef} timeRef={timeRef} sceneLoopRef={sceneLoopRef} />

      <Floor />
      <CityBackground />
      <LampPostForeground />
      <Dust count={70} />

      {/* Tsuru — el carro central, estático en esta escena */}
      <group ref={carGroupRef} position={[0, -0.05, 0]} rotation={[0, -0.42, 0]}>
        <TsuruWireframe scale={1.0} color="#FFB81C" fillIntensity={0.10} />

        {/* MotorWireframe dentro del hood. Posición local al carro:
            hood ocupa x ∈ [-2.20, -0.80] (frente), y ≈ -0.40 (entre chassis y hood top).
            Lo centramos en x ≈ -1.50. */}
        <group position={[-1.50, -0.40, 0]}>
          <MotorWireframe ref={motorHandle} color="#FF8B40" scale={0.85} />
        </group>

        {/* Defectos pulsantes en posiciones del motor */}
        <group position={[-1.50, -0.40, 0]}>
          {/* Fuga de aceite (rojo) — frente del bloque */}
          <DefectPulse
            ref={defectFugaHandle}
            color="#FF4040"
            label="fuga de aceite"
            position={[0.25, 0.05, 0.18]}
            labelOffset={isMobile ? [-0.5, 0.55, 0] : [0.7, 0.3, 0]}
          />
          {/* Choque previo (naranja) — lado izquierdo */}
          <DefectPulse
            ref={defectChoqueHandle}
            color="#FB923C"
            label="choque previo"
            position={[-0.25, 0.10, -0.18]}
            labelOffset={isMobile ? [-0.5, -0.6, 0] : [-1.7, 0.5, 0]}
          />
          {/* Odómetro alterado (morado) — encima del bloque */}
          <DefectPulse
            ref={defectOdoHandle}
            color="#A855F7"
            label="odómetro alterado"
            position={[-0.10, 0.40, 0.10]}
            labelOffset={isMobile ? [0.5, 0.55, 0] : [1.0, 0.7, 0]}
          />
        </group>
      </group>

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
      <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.3em] text-[#FFE5A0]/55 font-mono pointer-events-none">
        Akerlof · Cap 1 · Escena 3
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
      const elapsed = ((performance.now() - start) / 1000) % 31;
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
interface LimonesEscena03Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena03({ forceAspect = 'auto' }: LimonesEscena03Props) {
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

  // ── Audio metadata (auto-leído del pipeline)
  const audioMeta = useAudioMeta(META_URL, {
    expectedTrackFile: TRACK_FILE,
    fallbackDuration: FALLBACK_DURATION,
  });

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
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #1a1015 0%, #050308 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [1.5, 1.6, 7.5], fov, near: 0.1, far: 200 }}
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
              Cap 1 · Escena 3 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~28s'}
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
