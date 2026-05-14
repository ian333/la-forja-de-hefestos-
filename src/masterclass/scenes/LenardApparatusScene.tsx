/**
 * LenardApparatusScene — el tubo de Lenard, 1902.
 *
 *  Lámpara externa → ventana → cátodo metálico → electrones eyectados
 *  → ánodo colector → cable → amperímetro / voltímetro de freno.
 *
 *  Cuando subes intensidad, salen MÁS electrones (corriente sube),
 *  pero su velocidad máxima NO cambia. La energía por electrón viene
 *  fijada por hf — el experimento decisivo que rompió el modelo clásico.
 *
 *  Fases:
 *   - '04-lenard' : ciclo I=1 → I=2 cada 5 s, contador de electrones visible
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface Props { phase?: string }

const N_ELECTRONS = 40;

interface ElectronState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  active: boolean;
  age: number;
  vMax: number;
}

function makePool(): ElectronState[] {
  return Array.from({ length: N_ELECTRONS }, () => ({
    pos: new THREE.Vector3(0, -50, 0),
    vel: new THREE.Vector3(0, 0, 0),
    active: false,
    age: 0,
    vMax: 0,
  }));
}

// Cátodo en x=-2.2, ánodo en x=+2.2, tubo eje X
function spawnElectron(e: ElectronState, vMax: number) {
  // posición inicial: en la superficie del cátodo
  e.pos.set(-2.2 + 0.1, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6);
  // velocidad: hacia el ánodo, con vMax constante (energía fija por hf)
  // dispersión angular pequeña
  const angleY = (Math.random() - 0.5) * 0.25;
  const angleZ = (Math.random() - 0.5) * 0.25;
  e.vel.set(
    vMax * Math.cos(angleY),
    vMax * Math.sin(angleY),
    vMax * Math.sin(angleZ),
  );
  e.active = true;
  e.age = 0;
  e.vMax = vMax;
}

function VacuumTube() {
  return (
    <group>
      {/* tubo de vidrio (cilindro horizontal transparente) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.2, 1.2, 5.2, 32, 1, true]} />
        <meshStandardMaterial
          color="#0EA5E9"
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          emissive="#0EA5E9"
          emissiveIntensity={0.05}
        />
      </mesh>
      {/* cátodo (placa metálica, izquierda) */}
      <mesh position={[-2.2, 0, 0]}>
        <boxGeometry args={[0.15, 1.6, 1.6]} />
        <meshStandardMaterial
          color="#94A3B8"
          metalness={0.85}
          roughness={0.4}
          emissive="#475569"
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* ánodo (placa colectora, derecha) */}
      <mesh position={[2.2, 0, 0]}>
        <boxGeometry args={[0.15, 1.6, 1.6]} />
        <meshStandardMaterial
          color="#94A3B8"
          metalness={0.85}
          roughness={0.4}
          emissive="#475569"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* tapas */}
      <mesh position={[-2.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.25, 1.25, 0.1, 24]} />
        <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.6} />
      </mesh>
      <mesh position={[2.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.25, 1.25, 0.1, 24]} />
        <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.6} />
      </mesh>
    </group>
  );
}

function ExternalLamp({ intensityRef }: { intensityRef: React.MutableRefObject<number> }) {
  // Esfera amarilla afuera del tubo, brilla con intensity
  const lampRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const I = intensityRef.current;
    if (lampRef.current) {
      const mat = lampRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + I * 1.5;
    }
    if (glowRef.current) {
      glowRef.current.opacity = 0.2 + I * 0.3;
    }
  });
  return (
    <group position={[-2.2, 2.8, 0]}>
      {/* halo */}
      <mesh>
        <sphereGeometry args={[0.7, 24, 24]} />
        <meshBasicMaterial ref={glowRef} color="#FACC15" transparent opacity={0.25} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* bulbo */}
      <mesh ref={lampRef}>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial color="#FACC15" emissive="#FACC15" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      {/* base */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.3, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.7} />
      </mesh>
    </group>
  );
}

function LightBeam({ intensityRef }: { intensityRef: React.MutableRefObject<number> }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (matRef.current) matRef.current.opacity = 0.12 + intensityRef.current * 0.15;
  });
  // cono que va de la lámpara al cátodo
  return (
    <mesh position={[-2.2, 1.3, 0]} rotation={[0, 0, 0]}>
      <coneGeometry args={[0.35, 1.6, 24, 1, true]} />
      <meshBasicMaterial
        ref={matRef as any}
        color="#FACC15"
        transparent
        opacity={0.18}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function ElectronsFlying({
  poolRef,
  intensityRef,
  countRef,
}: {
  poolRef: React.MutableRefObject<ElectronState[]>;
  intensityRef: React.MutableRefObject<number>;
  countRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const spawnAccumRef = useRef(0);
  const V_MAX_CONST = 1.5;     // velocidad fija (hf - W constante)

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const pool = poolRef.current;
    const inst = meshRef.current;
    // spawn rate proporcional a intensidad
    const rate = 6 * intensityRef.current;
    spawnAccumRef.current += dt * rate;
    while (spawnAccumRef.current > 1) {
      spawnAccumRef.current -= 1;
      const slot = pool.findIndex(e => !e.active);
      if (slot >= 0) {
        spawnElectron(pool[slot], V_MAX_CONST);
        countRef.current++;
      }
    }
    for (let i = 0; i < pool.length; i++) {
      const e = pool[i];
      if (!e.active) {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        continue;
      }
      e.pos.addScaledVector(e.vel, dt);
      e.age += dt;
      // recolectar al ánodo
      if (e.pos.x > 2.15) e.active = false;
      if (e.age > 3) e.active = false;
      dummy.position.copy(e.pos);
      dummy.scale.setScalar(0.11);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_ELECTRONS]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial
        color="#22D3EE"
        emissive="#22D3EE"
        emissiveIntensity={2.5}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function CircuitWires() {
  // cable cátodo → amperímetro → ánodo
  const pts1: [number, number, number][] = [
    [-2.2, -0.9, 0],
    [-2.2, -2.0, 0],
    [-0.5, -2.0, 0],
  ];
  const pts2: [number, number, number][] = [
    [0.5, -2.0, 0],
    [2.2, -2.0, 0],
    [2.2, -0.9, 0],
  ];
  return (
    <group>
      <Line points={pts1} color="#94A3B8" lineWidth={2} />
      <Line points={pts2} color="#94A3B8" lineWidth={2} />
      {/* amperímetro icono (anillo dorado) */}
      <mesh position={[0, -2.0, 0]}>
        <torusGeometry args={[0.38, 0.05, 8, 32]} />
        <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, -2.0, 0]}>
        <circleGeometry args={[0.32, 24]} />
        <meshBasicMaterial color="#03050A" />
      </mesh>
    </group>
  );
}

function Scene({
  intensityRef,
  countRef,
  poolRef,
}: {
  intensityRef: React.MutableRefObject<number>;
  countRef: React.MutableRefObject<number>;
  poolRef: React.MutableRefObject<ElectronState[]>;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 4]} intensity={0.7} />
      <pointLight position={[-2.2, 2.8, 1]} intensity={1.8} color="#FACC15" />
      <pointLight position={[2.5, 0, 2]} intensity={0.5} color="#22D3EE" />
      <VacuumTube />
      <ExternalLamp intensityRef={intensityRef} />
      <LightBeam intensityRef={intensityRef} />
      <ElectronsFlying poolRef={poolRef} intensityRef={intensityRef} countRef={countRef} />
      <CircuitWires />
    </>
  );
}

export default function LenardApparatusScene({ phase = '04-lenard' }: Props) {
  const intensityRef = useRef(1.0);
  const countRef = useRef(0);
  const poolRef = useRef(makePool());

  const ammeterRef = useRef<HTMLSpanElement>(null);
  const vMaxRef = useRef<HTMLSpanElement>(null);
  const intensityHudRef = useRef<HTMLSpanElement>(null);
  const electronCountWindowRef = useRef<number[]>([]);  // últimas counts

  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();
    let lastCount = 0;
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastT) / 1000;
      lastT = now;
      // ciclo de 5 s entre I=1 y I=2
      const t = (now / 1000) % 10;
      intensityRef.current = t < 5 ? 1.0 : 2.0;
      // amperímetro: electrones por segundo
      const dCount = countRef.current - lastCount;
      lastCount = countRef.current;
      const ampPerSec = dCount / Math.max(dt, 1e-3);
      // smooth
      electronCountWindowRef.current.push(ampPerSec);
      if (electronCountWindowRef.current.length > 30) electronCountWindowRef.current.shift();
      const smoothed = electronCountWindowRef.current.reduce((a, b) => a + b, 0) / electronCountWindowRef.current.length;
      if (ammeterRef.current) ammeterRef.current.textContent = `${smoothed.toFixed(1)} e⁻ / s`;
      if (vMaxRef.current) vMaxRef.current.textContent = `1.50 (constante)`;
      if (intensityHudRef.current) intensityHudRef.current.textContent = `I = ${intensityRef.current.toFixed(1)}×`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #0A1628 0%, #03050A 80%)' }}
    >
      <Canvas camera={{ position: [0, 1.5, 7.5], fov: 42 }}>
        <Scene intensityRef={intensityRef} countRef={countRef} poolRef={poolRef} />
        <OrbitControls enableDamping enableZoom={false} enablePan={false} enableRotate={false} target={[0, 0, 0]} />
      </Canvas>

      {/* Caption */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#FDB813] tracking-[0.3em] uppercase">
          Aparato de Lenard · 1902
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">
          intensidad sube · corriente sube · velocidad max NO cambia
        </div>
      </div>

      {/* Tags sobre componentes */}
      <div className="absolute top-[28%] left-[18%] pointer-events-none">
        <div className="text-[10px] font-mono text-[#FACC15]">lámpara UV</div>
      </div>
      <div className="absolute top-[50%] left-[28%] pointer-events-none">
        <div className="text-[10px] font-mono text-[#94A3B8]">cátodo (zinc)</div>
      </div>
      <div className="absolute top-[50%] right-[28%] pointer-events-none">
        <div className="text-[10px] font-mono text-[#94A3B8]">ánodo colector</div>
      </div>

      {/* HUD */}
      <div className="absolute bottom-6 right-6 pointer-events-none">
        <div className="px-5 py-3 rounded-md border border-[#FDB813]/30 bg-black/55 backdrop-blur-sm space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FDB813]">
            Mediciones en vivo
          </div>
          <div className="text-[13px] font-mono text-white">
            <span ref={intensityHudRef}>I = 1.0×</span>
          </div>
          <div className="text-[13px] font-mono text-white">
            corriente: <span ref={ammeterRef} className="text-[#22D3EE] font-bold">6.0 e⁻ / s</span>
          </div>
          <div className="text-[13px] font-mono text-white">
            v_max: <span ref={vMaxRef} className="text-[#A78BFA]">1.50 (constante)</span>
          </div>
          <div className="text-[10px] font-mono text-[#64748B] pt-1">
            cuando I sube, v_max NO se mueve
          </div>
        </div>
      </div>
    </div>
  );
}
