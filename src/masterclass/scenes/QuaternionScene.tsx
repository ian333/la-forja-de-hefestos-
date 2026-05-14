import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Phase-aware quaternion scene.
 *
 *   phase '13-hamilton'     → Hamilton on the bridge. Show i, j, k as three
 *                              orthogonal glowing axes around the satellite.
 *                              Gentle rotation. Formula i² = j² = k² = ijk = -1
 *                              is the focal point.
 *   phase '14-cover-doble'  → Smooth tumbling with full trail. Emphasize
 *                              continuity, no gimbal lock, no failure.
 */

interface QuaternionSceneProps {
  phase?: string;
}

const TRAIL_LEN = 24;

function Satellite() {
  return (
    <>
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.85]} />
        <meshStandardMaterial color="#CBD5E1" metalness={0.7} roughness={0.3} emissive="#1E293B" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[1.0, 0, 0]}>
        <boxGeometry args={[1.2, 0.04, 0.6]} />
        <meshStandardMaterial color="#1E40AF" emissive="#1E40AF" emissiveIntensity={0.8} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-1.0, 0, 0]}>
        <boxGeometry args={[1.2, 0.04, 0.6]} />
        <meshStandardMaterial color="#1E40AF" emissive="#1E40AF" emissiveIntensity={0.8} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.55]}>
        <coneGeometry args={[0.06, 0.25, 10]} />
        <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1.8} />
      </mesh>
      <mesh position={[0, 0.27, 0.2]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={3.0} />
      </mesh>
    </>
  );
}

function IJKAxes({ visibleRef }: { visibleRef: React.MutableRefObject<THREE.Group | null> }) {
  const matsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Subtle pulse on each axis material
    matsRef.current.forEach((m, idx) => {
      if (m) m.emissiveIntensity = 2.0 + 0.6 * Math.sin(t * 1.4 + idx * 1.7);
    });
  });
  const AXES = [
    { dir: new THREE.Vector3(1, 0, 0), color: '#F87171', label: 'i' },
    { dir: new THREE.Vector3(0, 1, 0), color: '#4ADE80', label: 'j' },
    { dir: new THREE.Vector3(0, 0, 1), color: '#60A5FA', label: 'k' },
  ];
  return (
    <group ref={r => { visibleRef.current = r; }}>
      {AXES.map((ax, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), ax.dir);
        const L = 1.7;
        return (
          <group key={ax.label} quaternion={q}>
            <mesh position={[0, 0, L / 2]} rotation={[Math.PI/2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, L, 14]} />
              <meshStandardMaterial
                ref={r => { if (r) matsRef.current[i] = r; }}
                color={ax.color} emissive={ax.color} emissiveIntensity={2.0}
              />
            </mesh>
            <mesh position={[0, 0, L]} rotation={[Math.PI/2, 0, 0]}>
              <coneGeometry args={[0.10, 0.24, 14]} />
              <meshStandardMaterial color={ax.color} emissive={ax.color} emissiveIntensity={2.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function ActiveSat({ phaseRef, satRef, qRef }: {
  phaseRef: React.MutableRefObject<string>;
  satRef: React.MutableRefObject<THREE.Group | null>;
  qRef: React.MutableRefObject<THREE.Quaternion>;
}) {
  const phaseStart = useRef(0);
  const lastPhase = useRef('');

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const phase = phaseRef.current;
    if (phase !== lastPhase.current) {
      phaseStart.current = t;
      lastPhase.current = phase;
    }
    const tLocal = t - phaseStart.current;

    let q: THREE.Quaternion;
    if (phase === '13-hamilton') {
      // Slow gentle tumble around a single axis — keep the i/j/k axes legible
      const angle = tLocal * 0.28;
      const ax = new THREE.Vector3(0.3, 1, 0.4).normalize();
      q = new THREE.Quaternion().setFromAxisAngle(ax, angle);
    } else {
      // Phase 14 (default) — full smooth quaternion path
      const ax = new THREE.Vector3(
        Math.sin(tLocal * 0.31),
        Math.cos(tLocal * 0.27) * 0.9,
        Math.sin(tLocal * 0.19) * 0.7,
      ).normalize();
      const angle = tLocal * 0.55;
      q = new THREE.Quaternion().setFromAxisAngle(ax, angle);
    }

    qRef.current.copy(q);
    if (satRef.current) satRef.current.quaternion.copy(q);
  });

  return (
    <group ref={r => { satRef.current = r; }}>
      <Satellite />
    </group>
  );
}

function GhostTrail({ phaseRef, qRef }: { phaseRef: React.MutableRefObject<string>; qRef: React.MutableRefObject<THREE.Quaternion> }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const trail = useRef<THREE.Quaternion[]>([]);

  useFrame(() => {
    const visible = phaseRef.current !== '13-hamilton'; // hide in phase 13 to keep i/j/k legible
    const q = qRef.current.clone();
    trail.current.unshift(q);
    if (trail.current.length > TRAIL_LEN) trail.current.length = TRAIL_LEN;

    groupRefs.current.forEach((g, i) => {
      if (!g) return;
      const past = trail.current[i + 1];
      if (past && visible) {
        g.quaternion.copy(past);
        g.visible = true;
        const fade = 1 - (i + 1) / TRAIL_LEN;
        g.scale.setScalar(0.5 + fade * 0.35);
      } else {
        g.visible = false;
      }
    });
  });

  return (
    <>
      {Array.from({ length: TRAIL_LEN }).map((_, i) => (
        <group key={i} ref={r => { groupRefs.current[i] = r; }} visible={false}>
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.85]} />
            <meshStandardMaterial color="#FDB813" transparent opacity={0.1} depthWrite={false} />
          </mesh>
          <mesh position={[1.0, 0, 0]}>
            <boxGeometry args={[1.2, 0.04, 0.6]} />
            <meshStandardMaterial color="#FDB813" transparent opacity={0.1} depthWrite={false} />
          </mesh>
          <mesh position={[-1.0, 0, 0]}>
            <boxGeometry args={[1.2, 0.04, 0.6]} />
            <meshStandardMaterial color="#FDB813" transparent opacity={0.1} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function StarField() {
  const positions = useMemo(() => {
    const arr = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 14 + Math.random() * 4;
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={800} array={positions} itemSize={3} args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#CBD5E1" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function HopfHint({ phaseRef }: { phaseRef: React.MutableRefObject<string> }) {
  const points: [number, number, number][] = useMemo(() => {
    const pts: [number, number, number][] = [];
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * Math.PI * 2;
      const r = 2.7;
      pts.push([Math.cos(u) * r, Math.sin(u * 2) * 0.7, Math.sin(u) * r]);
    }
    return pts;
  }, []);
  const flat = useMemo(() => {
    const arr = new Float32Array(points.length * 3);
    points.forEach((p, i) => { arr[i*3]=p[0]; arr[i*3+1]=p[1]; arr[i*3+2]=p[2]; });
    return arr;
  }, [points]);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (matRef.current) {
      const visible = phaseRef.current === '14-cover-doble';
      matRef.current.opacity = visible ? (0.25 + 0.1 * Math.sin(clock.elapsedTime * 0.6)) : 0;
    }
  });
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={points.length} array={flat} itemSize={3} args={[flat, 3]} />
      </bufferGeometry>
      <lineBasicMaterial ref={matRef} color="#FDB813" transparent opacity={0.3} />
    </line>
  );
}

export default function QuaternionScene({ phase = '14-cover-doble' }: QuaternionSceneProps) {
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const satRef = useRef<THREE.Group | null>(null);
  const qRef = useRef(new THREE.Quaternion());
  const ijkVisRef = useRef<THREE.Group | null>(null);

  // Show/hide the i/j/k axes depending on phase
  useEffect(() => {
    if (ijkVisRef.current) {
      ijkVisRef.current.visible = phase === '13-hamilton';
    }
  }, [phase]);

  const captionByPhase: Record<string, string> = {
    '13-hamilton': 'i, j, k son tres ejes imaginarios ortogonales',
    '14-cover-doble': 'trayectoria continua  ·  sin singularidades',
  };
  const caption = captionByPhase[phase] ?? '';

  const isHamilton = phase === '13-hamilton';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0A0A1F 0%, #03050A 85%)' }}
    >
      <Canvas camera={{ position: [4.5, 2.5, 4.5], fov: 40 }}>
        <ambientLight intensity={0.28} />
        <pointLight position={[3, 4, 3]} intensity={1.1} color="#60A5FA" distance={20} />
        <pointLight position={[-4, 2, -3]} intensity={0.7} color="#FDB813" distance={18} />
        <directionalLight position={[2, 5, 4]} intensity={0.4} />
        <StarField />
        <HopfHint phaseRef={phaseRef} />
        <IJKAxes visibleRef={ijkVisRef} />
        <GhostTrail phaseRef={phaseRef} qRef={qRef} />
        <ActiveSat phaseRef={phaseRef} satRef={satRef} qRef={qRef} />
        <OrbitControls
          enableDamping
          autoRotate
          autoRotateSpeed={isHamilton ? 0.1 : 0.25}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI/4}
          maxPolarAngle={Math.PI/2.2}
          target={[0, 0, 0]}
        />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#FDB813] tracking-[0.3em] uppercase">
          Cuaterniones · rotación suave
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">
          {caption}
        </div>
      </div>

      {/* Hamilton formula card (only in phase 13) */}
      {isHamilton && (
        <div className="absolute top-1/2 left-12 -translate-y-1/2 pointer-events-none">
          <div className="px-5 py-3 rounded-md border border-[#FDB813]/40 bg-black/30 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-[#FDB813] uppercase tracking-[0.2em] mb-2">
              Inscrito en piedra · 1843
            </div>
            <div className="text-[20px] text-[#F5F0E8]" style={{ fontFamily: '"Caveat", cursive' }}>
              i² = j² = k² = ijk = −1
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 right-8 pointer-events-none text-right">
        {isHamilton ? (
          <>
            <div className="flex items-center gap-2 text-[10px] font-mono mb-1 justify-end">
              <span className="text-[#94A3B8]">eje i</span>
              <span className="inline-block w-3 h-3 rounded-full bg-[#F87171] shadow-[0_0_6px_#F87171]" />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono mb-1 justify-end">
              <span className="text-[#94A3B8]">eje j</span>
              <span className="inline-block w-3 h-3 rounded-full bg-[#4ADE80] shadow-[0_0_6px_#4ADE80]" />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono justify-end">
              <span className="text-[#94A3B8]">eje k</span>
              <span className="inline-block w-3 h-3 rounded-full bg-[#60A5FA] shadow-[0_0_6px_#60A5FA]" />
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] font-mono text-[#94A3B8]">q = w + xi + yj + zk</div>
            <div className="text-[10px] font-mono text-[#64748B] mt-1">sin gimbal lock · S³ → SO(3)</div>
          </>
        )}
      </div>
    </div>
  );
}
