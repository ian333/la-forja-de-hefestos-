/**
 * LimonesEscena07 — "Los cherries huyen"
 *
 * Cap 2 · Escena 7. Template: cascade · Story beat: develop.
 *
 * Visualización directa del colapso de Akerlof: el lote de 100 carros pierde
 * sus "cherries" (carros buenos, verdes) uno por uno. Cada cherry se eleva y
 * se desvanece mientras la narración describe la lógica de la cascada.
 * Al final, solo quedan los "limones" (rojos) — el mercado se rompió.
 *
 * Paradigma de escena:
 *   • 1 objeto principal (lote con animación de éxodo)
 *   • 2 bloques de texto (header + cierre)
 *   • Cámara orbit muy lento (no marear)
 *   • Bloom intenso (los cherries brillan al irse)
 *
 * Duración: ~33s.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import SkyText, { type SkyTextHandle } from './SkyText';
import PostFX from '../scenes/_postFX';
import { useAudioMeta } from './_useAudioMeta';

const TRACK_FILE = '07-exodus.mp3';
const META_URL = '/audio/preview/meta.json';
const AUDIO_URL = '/audio/preview/' + TRACK_FILE;
const FALLBACK_DURATION = 34.19;

const TOTAL = 100;
const GRID_COLS = 10;
const GRID_ROWS = 10;
const SEED = 7;
const CHERRY_RATIO = 0.60;

const CHERRY_COLOR = new THREE.Color('#34D399');
const LEMON_COLOR = new THREE.Color('#FF5040');
const GLOW_COLOR = new THREE.Color('#FFFFFF');

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function pseudoRandom(seed: number, index: number): number {
  const x = Math.sin((seed * 12.9898) + (index * 78.233)) * 43758.5453;
  return x - Math.floor(x);
}

// Pre-compute initial cherry count at module load (for HUD initial render)
const INITIAL_CHERRIES = (() => {
  let count = 0;
  for (let i = 0; i < TOTAL; i++) {
    if (pseudoRandom(SEED, i) <= CHERRY_RATIO) count++;
  }
  return count;
})();

// ─────────────────────────────────────────────────────────────
// Environment: sky + floor + distant windows + lighting

function NightSky() {
  return (
    <mesh>
      <sphereGeometry args={[80, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        vertexShader={`
          varying vec3 vWP;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWP = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          varying vec3 vWP;
          void main() {
            float h = normalize(vWP).y;
            vec3 top = vec3(0.008, 0.012, 0.045);
            vec3 bot = vec3(0.020, 0.032, 0.070);
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        color="#080510"
        roughness={0.30}
        metalness={0.55}
        emissive="#0A0512"
        emissiveIntensity={0.10}
      />
    </mesh>
  );
}

function DistantWindows() {
  const windows = useMemo(() => {
    const arr: Array<{ x: number; y: number; intensity: number; color: string }> = [];
    const rng = (s: number) => { const x = Math.sin(s * 78.233) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < 36; i++) {
      arr.push({
        x: (rng(i) - 0.5) * 80,
        y: 0.5 + rng(i + 100) * 5,
        intensity: 0.3 + rng(i + 200) * 0.5,
        color: rng(i + 300) > 0.6 ? '#FFE5A0' : '#FFD080',
      });
    }
    return arr;
  }, []);
  return (
    <group position={[0, 0, -40]}>
      {windows.map((w, i) => (
        <mesh key={i} position={[w.x, w.y, 0]}>
          <planeGeometry args={[0.15, 0.18]} />
          <meshBasicMaterial color={w.color} transparent opacity={w.intensity * 0.35} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.32} color="#181A2E" />
      <directionalLight position={[3, 12, 3]} intensity={0.8} color="#B8C8F5" />
      <directionalLight position={[-5, 8, -5]} intensity={0.60} color="#7FB0FF" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Camera: slow elevated orbit, looks up as cherries rise

function CameraDirector({ timeRef, sceneLoopRef }: {
  timeRef: React.MutableRefObject<number>;
  sceneLoopRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const t = timeRef.current % sceneLoopRef.current;
    // Orbit muy contenido — 0.015 rad/s + microbreathing.
    // No mareamos al espectador; solo damos sensación de "estar vivo".
    const orbit = 0.45 + t * 0.018 + 0.05 * Math.sin(t * 0.18);
    const dist = 30 - 2.0 * easeInOutCubic(clamp((t - 20) / 13, 0, 1));
    const height = 14 + 0.6 * Math.sin(t * 0.08);
    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
    // Mira a la altura del lote al principio, sube ligeramente cuando los cherries ascienden
    const progress = clamp((t - 5) / 23, 0, 1);
    const lookY = 1.5 + 2.5 * progress;
    camera.lookAt(0, lookY, 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Pre-computed car data (positions, jitter, lemon/cherry status, departure order)

interface CarDatum {
  x: number;
  z: number;
  jitterX: number;
  jitterZ: number;
  jitterRot: number;
  isLemon: boolean;
  /** Para cherries: orden de salida en [0,1]. Para lemons: -1 */
  stagger: number;
}

function buildCarData(spacingX: number, spacingZ: number): {
  data: CarDatum[];
  totalCherries: number;
} {
  const data: CarDatum[] = [];
  const offsetX = -(GRID_COLS - 1) * spacingX / 2;
  const offsetZ = -(GRID_ROWS - 1) * spacingZ / 2;
  const cherryIndices: number[] = [];

  for (let i = 0; i < TOTAL; i++) {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    const isLemon = pseudoRandom(SEED, i) > CHERRY_RATIO;
    if (!isLemon) cherryIndices.push(i);
    data.push({
      x: offsetX + col * spacingX,
      z: offsetZ + row * spacingZ,
      jitterX: (pseudoRandom(SEED + 1000, i) - 0.5) * 0.15,
      jitterZ: (pseudoRandom(SEED + 2000, i) - 0.5) * 0.15,
      jitterRot: (pseudoRandom(SEED + 3000, i) - 0.5) * 0.20,
      isLemon,
      stagger: -1,
    });
  }

  // Shuffle cherry departure order — visualmente más natural que back-to-front
  const shuffled = cherryIndices
    .map((idx, j) => ({ idx, order: pseudoRandom(SEED + 5000, j) }))
    .sort((a, b) => a.order - b.order);
  for (let j = 0; j < shuffled.length; j++) {
    data[shuffled[j].idx].stagger = j / Math.max(1, shuffled.length - 1);
  }

  return { data, totalCherries: cherryIndices.length };
}

// ─────────────────────────────────────────────────────────────
// Scene content: time mgmt + exodus animation + SkyText fades

function SceneContent({ audioRef, isPlaying }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}) {
  const bodyMeshRef = useRef<THREE.InstancedMesh>(null);
  const cabinMeshRef = useRef<THREE.InstancedMesh>(null);
  const underglowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const headerRef = useRef<SkyTextHandle | null>(null);
  const closingRef = useRef<SkyTextHandle | null>(null);

  const sceneLoopRef = useRef(36);

  const initialTime = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const t = parseFloat(params.get('t') || '0');
    return isNaN(t) ? 0 : t;
  }, []);
  const timeRef = useRef(initialTime);

  // ─── Geometry data ─────────────────────────────────────
  const spacingX = 1.8;
  const spacingZ = 2.6;
  const { data: carData, totalCherries } = useMemo(
    () => buildCarData(spacingX, spacingZ),
    [],
  );

  // ─── Reusable scratch objects ──────────────────────────
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  // ─── Initialize matrices/colors on mount ───────────────
  useEffect(() => {
    const body = bodyMeshRef.current;
    const cabin = cabinMeshRef.current;
    if (!body || !cabin) return;

    for (let i = 0; i < TOTAL; i++) {
      const d = carData[i];

      dummy.position.set(d.x + d.jitterX, 0, d.z + d.jitterZ);
      dummy.rotation.set(0, d.jitterRot, 0);
      dummy.scale.set(1.2, 0.32, 0.55);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);

      dummy.position.set(d.x + d.jitterX - 0.15, 0.30, d.z + d.jitterZ);
      dummy.scale.set(0.70, 0.28, 0.50);
      dummy.updateMatrix();
      cabin.setMatrixAt(i, dummy.matrix);

      const c = d.isLemon ? LEMON_COLOR : CHERRY_COLOR;
      body.setColorAt(i, c);
      cabin.setColorAt(i, c);
    }
    body.instanceMatrix.needsUpdate = true;
    cabin.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (cabin.instanceColor) cabin.instanceColor.needsUpdate = true;
  }, [carData, dummy]);

  // ─── Main animation loop ───────────────────────────────
  useFrame((_, dt) => {
    if (isPlaying && audioRef.current && !audioRef.current.paused) {
      timeRef.current = audioRef.current.currentTime;
    } else {
      timeRef.current += Math.min(dt, 0.1);
    }
    const t = timeRef.current % sceneLoopRef.current;
    if (typeof window !== 'undefined') (window as any).__sceneTime = timeRef.current;

    // Exodus progress: t=5 (first cherry leaves) → t=28 (all gone)
    const exodusStart = 5;
    const exodusDuration = 23;
    const progress = easeInOutCubic(clamp((t - exodusStart) / exodusDuration, 0, 1));
    const animWindow = 0.22; // each cherry's individual exit takes 22% of total

    // ─── Update all 100 cars (2 instanced meshes) ───────
    const body = bodyMeshRef.current;
    const cabin = cabinMeshRef.current;
    let grounded = totalCherries;

    if (body && cabin) {
      for (let i = 0; i < TOTAL; i++) {
        const d = carData[i];
        let y = 0;
        let scl = 1;
        let tumble = 0;

        if (!d.isLemon) {
          // Cherry: compute exodus state
          const departure = d.stagger * (1 - animWindow);
          const localP = easeOutCubic(clamp((progress - departure) / animWindow, 0, 1));
          y = localP * 14;
          scl = Math.max(0, 1 - localP);
          tumble = localP * 1.8;

          // Color: green → bright white as it ascends (bloom = halo)
          tmpColor.copy(CHERRY_COLOR).lerp(GLOW_COLOR, localP * 0.7);

          if (localP >= 0.5) grounded--;
        } else {
          tmpColor.copy(LEMON_COLOR);
        }

        // Body matrix
        dummy.position.set(d.x + d.jitterX, y, d.z + d.jitterZ);
        dummy.rotation.set(tumble * 0.35, d.jitterRot + tumble, tumble * 0.2);
        dummy.scale.set(1.2 * scl, 0.32 * scl, 0.55 * scl);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);
        body.setColorAt(i, tmpColor);

        // Cabin matrix (sits on top of body, scales with it)
        dummy.position.set(
          d.x + d.jitterX - 0.15 * scl,
          y + 0.30 * scl,
          d.z + d.jitterZ,
        );
        dummy.rotation.set(tumble * 0.35, d.jitterRot + tumble, tumble * 0.2);
        dummy.scale.set(0.70 * scl, 0.28 * scl, 0.50 * scl);
        dummy.updateMatrix();
        cabin.setMatrixAt(i, dummy.matrix);
        cabin.setColorAt(i, tmpColor);
      }

      body.instanceMatrix.needsUpdate = true;
      cabin.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      if (cabin.instanceColor) cabin.instanceColor.needsUpdate = true;
    }

    // Underglow dims as cherries leave — el lote se enfría
    if (underglowMatRef.current) {
      underglowMatRef.current.opacity = 0.035 * (1 - progress * 0.8);
      // shift hue from green → red as market degrades
      underglowMatRef.current.color.copy(CHERRY_COLOR).lerp(LEMON_COLOR, progress);
    }

    // ─── SkyText 1: "LOS BUENOS SE VAN" (header, t=0.5-3) ───
    if (headerRef.current) {
      const appear = easeOutCubic(clamp((t - 0.5) / 2.5, 0, 1));
      const fadeOut = easeOutCubic(clamp((t - 30) / 4, 0, 1));
      const op = appear * (1 - fadeOut * 0.5);
      headerRef.current.setOpacity(op);
      headerRef.current.setScale(0.85 + 0.15 * appear);
    }

    // ─── SkyText 2: "SOLO QUEDAN LIMONES" (closing, t=26-30) ───
    if (closingRef.current) {
      const appear = easeOutCubic(clamp((t - 26) / 3.5, 0, 1));
      closingRef.current.setOpacity(appear);
      closingRef.current.setScale(0.85 + 0.15 * appear);
    }

    // ─── Bridge to HUD ───
    if (typeof window !== 'undefined') {
      (window as any).__cherryCount = Math.max(0, grounded);
      (window as any).__cherryTotal = totalCherries;
    }
  });

  // ─── Subtle underglow plane (under the lot) ───
  const lotWidthX = (GRID_COLS - 1) * spacingX + 2;
  const lotDepthZ = (GRID_ROWS - 1) * spacingZ + 2;

  return (
    <>
      <NightSky />
      <Lighting />
      <CameraDirector timeRef={timeRef} sceneLoopRef={sceneLoopRef} />

      <Floor />
      <DistantWindows />

      {/* Underglow plane just above floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]}>
        <planeGeometry args={[lotWidthX, lotDepthZ]} />
        <meshBasicMaterial
          ref={underglowMatRef}
          color={CHERRY_COLOR}
          transparent
          opacity={0.035}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* The lot — body + cabin instanced */}
      <group>
        <instancedMesh ref={bodyMeshRef} args={[undefined, undefined, TOTAL]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial wireframe transparent opacity={0.88} toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={cabinMeshRef} args={[undefined, undefined, TOTAL]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial wireframe transparent opacity={0.88} toneMapped={false} />
        </instancedMesh>
      </group>

      {/* SkyText — header (gold) */}
      <SkyText
        ref={headerRef}
        text="LOS BUENOS SE VAN"
        position={[0, 10, -8]}
        width={11}
        height={1.8}
        color="#FFE5A0"
        fontWeight={600}
      />

      {/* SkyText — closing (red) */}
      <SkyText
        ref={closingRef}
        text="SOLO QUEDAN LIMONES"
        position={[0, 7, -8]}
        width={10}
        height={1.5}
        color="#FF5040"
        fontWeight={700}
      />

      <fog attach="fog" args={['#04060e', 18, 60]} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HUD: chapter label + dynamic cherry counter + timer

function CherryCounter({ aspect }: { aspect: '9:16' | '16:9' }) {
  const numRef = useRef<HTMLSpanElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let prevCount = -1;
    let prevTotal = -1;
    let raf = 0;
    const tick = () => {
      const count = (window as any).__cherryCount as number | undefined;
      const total = (window as any).__cherryTotal as number | undefined;
      if (count !== undefined && count !== prevCount) {
        if (numRef.current) numRef.current.textContent = String(count);
        prevCount = count;
        // Color de número en función de cuántos quedan
        if (containerRef.current) {
          const ratio = total ? count / total : 1;
          // 1.0 = verde brillante, 0.0 = rojo deslavado
          const hue = Math.floor(150 * ratio); // 0=red, 150=greenish
          const lightness = 50 + 15 * ratio;
          (containerRef.current.style as any).setProperty('--counter-color', `hsl(${hue}, 70%, ${lightness}%)`);
        }
      }
      if (total !== undefined && total !== prevTotal) {
        if (totalRef.current) totalRef.current.textContent = String(total);
        prevTotal = total;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isVertical = aspect === '9:16';
  const positionClass = isVertical ? 'left-6 top-[28%]' : 'left-10 top-[35%]';

  return (
    <div
      ref={containerRef}
      className={`absolute ${positionClass} flex flex-col items-start pointer-events-none`}
      style={{ ['--counter-color' as any]: '#34D399' }}
    >
      <div className="text-[9px] uppercase tracking-[0.32em] text-[#34D399]/60 font-mono mb-1">
        Buenos en el lote
      </div>
      <div
        className="font-mono font-bold leading-none"
        style={{
          fontSize: isVertical ? 60 : 78,
          color: 'var(--counter-color)',
          textShadow: '0 0 28px var(--counter-color), 0 0 8px var(--counter-color)',
          transition: 'color 0.3s ease, text-shadow 0.3s ease',
        }}
      >
        <span ref={numRef}>{INITIAL_CHERRIES}</span>
      </div>
      <div className="text-[10px] text-[#A89580]/55 font-mono mt-1">
        de <span ref={totalRef}>{INITIAL_CHERRIES}</span>
      </div>
    </div>
  );
}

function SceneTimer() {
  const timerRef = useRef<HTMLSpanElement>(null);
  useMemo(() => {
    const start = performance.now();
    const tick = () => {
      const elapsed = ((performance.now() - start) / 1000) % 36;
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
        Akerlof · Cap 2 · Escena 7
      </div>
      <CherryCounter aspect={aspect} />
      <SceneTimer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
interface LimonesEscena07Props {
  forceAspect?: '9:16' | '16:9' | 'auto';
}

export default function LimonesEscena07({ forceAspect = 'auto' }: LimonesEscena07Props) {
  const aspect: '9:16' | '16:9' =
    forceAspect === 'auto'
      ? typeof window !== 'undefined' && window.innerHeight > window.innerWidth
        ? '9:16'
        : '16:9'
      : forceAspect;
  const fov = aspect === '9:16' ? 55 : 45;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const isScreenshotMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('t');
  }, []);

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
      }, 3000);
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
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #0a0d1a 0%, #03060e 80%)' }}
    >
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />

      <Canvas
        camera={{ position: [10, 14, 26], fov, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <SceneContent audioRef={audioRef} isPlaying={isPlaying} />
        <PostFX
          intensity={1.7}
          threshold={0.18}
          smoothing={0.45}
          vignette={0.72}
          vignetteOffset={0.22}
          aberration={0.0003}
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
              Cap 2 · Escena 7 · {audioMeta ? audioMeta.duration.toFixed(0) + 's' : '~33s'}
            </div>
            <div className="text-[10px] text-[#FFE5A0]/40 font-mono">
              los cherries huyen
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
