/**
 * WaveVsRealityScene — split screen: predicción clásica vs realidad.
 *
 *   IZQUIERDA · Predicción clásica
 *     Onda EM gigante chocando con placa. Cuando subes amplitud,
 *     el electrón sale con velocidad proporcional a la amplitud.
 *     Es lo que la física clásica predice.
 *
 *   DERECHA  · Realidad
 *     Misma luz, mismos parámetros. Pero los electrones salen TODOS
 *     con la misma velocidad. La intensidad solo multiplica cuántos.
 *
 *   Entre los dos: signo de ≠ rojo, pulsante.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface Props { phase?: string }

// ─── ONDA EM ANIMADA ──────────────────────────────────────────────────────
function WavePulse({
  side, amplitudeRef,
}: {
  side: 'left' | 'right';
  amplitudeRef: React.MutableRefObject<number>;
}) {
  const N = 80;
  const positions = useMemo(() => new Float32Array(N * 3), []);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const xOffset = side === 'left' ? -3.5 : 999;  // solo izquierda

  useFrame(({ clock }) => {
    if (!geomRef.current) return;
    const t = clock.elapsedTime * 5;
    const A = amplitudeRef.current * 0.7;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = xOffset + u * 3.0;
      const y = Math.sin(u * 12 - t) * A + 0.4 - u * 0.4;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = 0;
    }
    const attr = geomRef.current.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  return (
    <line>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          count={N}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#FACC15" linewidth={3} transparent opacity={0.9} />
    </line>
  );
}

// ─── PLACA + ELECTRÓN (izquierda: v ∝ amplitude, derecha: v constante) ────
function ElectronShower({
  side, amplitudeRef,
}: {
  side: 'left' | 'right';
  amplitudeRef: React.MutableRefObject<number>;
}) {
  const N = 6;
  const refs = useRef<THREE.Mesh[]>([]);
  const phaseOffsets = useMemo(() => Array.from({ length: N }, () => Math.random() * 2.5), []);
  const xCenter = side === 'left' ? -2 : 2;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const A = amplitudeRef.current;
    for (let i = 0; i < N; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const phase = (t + phaseOffsets[i]) % 2.5;
      const flyT = phase / 2.5;
      // Izquierda: velocidad ∝ amplitud (clásica). Derecha: constante.
      const speed = side === 'left' ? 0.8 + A * 1.5 : 2.2;
      const y = -0.5 + flyT * speed;
      const xJit = (i - N / 2 + 0.5) * 0.18;
      mesh.position.set(xCenter + xJit, y, 0);
      mesh.scale.setScalar(flyT > 0.95 ? 0 : 0.13);
    }
  });

  return (
    <>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i} ref={(m) => { if (m) refs.current[i] = m; }}>
          <sphereGeometry args={[1, 14, 14]} />
          <meshStandardMaterial
            color="#22D3EE"
            emissive="#22D3EE"
            emissiveIntensity={2.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

function PhotonShowerRight({ amplitudeRef }: { amplitudeRef: React.MutableRefObject<number> }) {
  // En la realidad: corpúsculos discretos cayendo, no onda.
  const N = 8;
  const refs = useRef<THREE.Mesh[]>([]);
  const phaseOffsets = useMemo(() => Array.from({ length: N }, () => Math.random() * 2.2), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const A = amplitudeRef.current;
    // intensidad ∝ amplitud → más fotones (densidad)
    for (let i = 0; i < N; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const phase = (t + phaseOffsets[i]) % 2.2;
      const flyT = phase / 2.2;
      const y = 4 - flyT * 4.5;
      const xJit = (i - N / 2 + 0.5) * 0.22;
      const visible = i < Math.ceil(2 + A * 5);
      mesh.position.set(2 + xJit, y, 0);
      mesh.scale.setScalar(visible && y > -0.5 ? 0.11 : 0);
    }
  });
  return (
    <>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i} ref={(m) => { if (m) refs.current[i] = m; }}>
          <sphereGeometry args={[1, 14, 14]} />
          <meshStandardMaterial
            color="#A78BFA"
            emissive="#A78BFA"
            emissiveIntensity={2.5}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

function Plate({ x }: { x: number }) {
  return (
    <mesh position={[x, -0.6, 0]}>
      <boxGeometry args={[1.6, 0.2, 0.6]} />
      <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.4} emissive="#1E293B" emissiveIntensity={0.3} />
    </mesh>
  );
}

// signo ≠ entre las dos
function NotEqualSign() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const s = 1 + Math.sin(t * 2) * 0.07;
    groupRef.current.scale.setScalar(s);
  });
  // dos líneas paralelas + slash
  return (
    <group ref={groupRef} position={[0, 1.5, 0]}>
      <Line points={[[-0.25, 0.15, 0], [0.25, 0.15, 0]] as any} color="#EF4444" lineWidth={4} />
      <Line points={[[-0.25, -0.15, 0], [0.25, -0.15, 0]] as any} color="#EF4444" lineWidth={4} />
      <Line points={[[-0.32, -0.32, 0], [0.32, 0.32, 0]] as any} color="#EF4444" lineWidth={4} />
    </group>
  );
}

function Divider() {
  return (
    <Line
      points={[[0, -1.5, 0], [0, 4.5, 0]] as any}
      color="#1E293B"
      lineWidth={1}
      dashed
      dashSize={0.2}
      gapSize={0.15}
    />
  );
}

function Scene() {
  const amplitudeRef = useRef(0.5);
  useFrame(({ clock }) => {
    // amplitud pulsa 0.4 ↔ 1.4 (sube, baja, sube)
    amplitudeRef.current = 0.5 + Math.abs(Math.sin(clock.elapsedTime * 0.4)) * 0.9;
  });
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 4]} intensity={0.8} />
      <pointLight position={[-3, 3, 2]} intensity={0.7} color="#FACC15" />
      <pointLight position={[3, 3, 2]} intensity={0.7} color="#A78BFA" />
      <Divider />
      {/* izquierda: onda clásica */}
      <WavePulse side="left" amplitudeRef={amplitudeRef} />
      <Plate x={-2} />
      <ElectronShower side="left" amplitudeRef={amplitudeRef} />
      {/* derecha: fotones discretos */}
      <PhotonShowerRight amplitudeRef={amplitudeRef} />
      <Plate x={2} />
      <ElectronShower side="right" amplitudeRef={amplitudeRef} />
      {/* ≠ entre los dos */}
      <NotEqualSign />
    </>
  );
}

export default function WaveVsRealityScene({ phase: _phase = '03-prediccion-falla' }: Props) {
  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #1A0E22 0%, #03050A 80%)' }}
    >
      <Canvas camera={{ position: [0, 1.2, 7], fov: 42 }}>
        <Scene />
        <OrbitControls enableDamping enableZoom={false} enablePan={false} enableRotate={false} target={[0, 1.0, 0]} />
      </Canvas>

      {/* Etiquetas split */}
      <div className="absolute top-6 left-[25%] -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#FACC15] tracking-[0.3em] uppercase">
          Predicción clásica
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">
          luz = onda · v_e ∝ amplitud
        </div>
      </div>
      <div className="absolute top-6 right-[25%] translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#A78BFA] tracking-[0.3em] uppercase">
          Realidad
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">
          luz = fotones · v_e constante · N_e ∝ I
        </div>
      </div>

      {/* Veredicto abajo */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="px-5 py-2 rounded-md border border-[#EF4444]/40 bg-black/60 backdrop-blur-sm">
          <div className="text-[12px] font-mono text-[#EF4444] tracking-[0.15em] uppercase font-bold">
            ondas EM clásicas · NO predicen esto
          </div>
        </div>
      </div>
    </div>
  );
}
