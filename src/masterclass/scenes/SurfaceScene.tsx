import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface SurfaceSceneProps {
  phase?: string;
}

const RES = 80;
const EXTENT = 3.5;

const surfaceFn = (x: number, y: number) =>
  Math.sin(x) * Math.cos(y) * 0.9 + 0.3 * Math.cos(2.2 * x + 0.7 * y);

const surfaceDx = (x: number, y: number) =>
  Math.cos(x) * Math.cos(y) * 0.9 - 0.3 * 2.2 * Math.sin(2.2 * x + 0.7 * y);

const surfaceDy = (x: number, y: number) =>
  -Math.sin(x) * Math.sin(y) * 0.9 - 0.3 * 0.7 * Math.sin(2.2 * x + 0.7 * y);

function Surface() {
  const { positions, colors, indices } = useMemo(() => {
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const colorLow = new THREE.Color('#0E4D92');
    const colorHigh = new THREE.Color('#4FC3F7');

    for (let j = 0; j <= RES; j++) {
      for (let i = 0; i <= RES; i++) {
        const x = -EXTENT + (2 * EXTENT * i) / RES;
        const y = -EXTENT + (2 * EXTENT * j) / RES;
        const z = surfaceFn(x, y);
        pos.push(x, z, y);
        const t = (z + 1.2) / 2.4;
        const c = colorLow.clone().lerp(colorHigh, Math.max(0, Math.min(1, t)));
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const a = j * (RES + 1) + i;
        const b = a + 1;
        const c = a + (RES + 1);
        const d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(col),
      indices: new Uint32Array(idx),
    };
  }, []);

  return (
    <mesh>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} args={[colors, 3]} />
        <bufferAttribute attach="index" count={indices.length} array={indices} itemSize={1} args={[indices, 1]} />
      </bufferGeometry>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} metalness={0.2} roughness={0.55} />
    </mesh>
  );
}

function TangentPlane({ phaseRef }: { phaseRef: React.MutableRefObject<string> }) {
  const planeRef = useRef<THREE.Mesh>(null);
  const pointRef = useRef<THREE.Mesh>(null);
  const arrowRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const planeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const phase = phaseRef.current;
    const showPoint = true; // always show the contact dot
    const showPlane = phase !== '12-dimension'; // hide plane on the question beat
    const showArrow = phase === '14-gradiente'; // gradient arrow only on its beat
    if (planeRef.current) planeRef.current.visible = showPlane;
    if (ringRef.current) ringRef.current.visible = showPlane;
    if (arrowRef.current) arrowRef.current.visible = showArrow;
    if (pointRef.current) pointRef.current.visible = showPoint;
    if (haloRef.current) haloRef.current.visible = showPoint;

    // Pulse plane stronger on its introduction beat (13)
    if (planeMatRef.current && ringMatRef.current && showPlane) {
      const isIntro = phase === '13-plano-tangente';
      const t = clock.elapsedTime;
      planeMatRef.current.emissiveIntensity = (isIntro ? 0.8 : 0.45) + (isIntro ? 0.4 : 0.1) * Math.sin(t * 1.2);
      ringMatRef.current.opacity = (isIntro ? 0.9 : 0.65) + 0.15 * Math.sin(t * 0.9);
    }
    const t = clock.elapsedTime;
    const px = 1.2 * Math.sin(t * 0.25);
    const py = 1.0 * Math.cos(t * 0.18);
    const z = surfaceFn(px, py);
    const dx = surfaceDx(px, py);
    const dy = surfaceDy(px, py);

    // Surface normal in world coords (world Y = height, since we store (x, z, y))
    const n = new THREE.Vector3(-dx, 1, -dy).normalize();

    if (pointRef.current) pointRef.current.position.set(px, z, py);
    if (haloRef.current) {
      haloRef.current.position.set(px, z, py);
      const s = 1.0 + 0.3 * Math.sin(t * 1.2);
      haloRef.current.scale.setScalar(s);
    }

    if (planeRef.current) {
      // PlaneGeometry lives in the XY plane → its natural normal is +Z.
      // Rotate so +Z aligns with the surface normal.
      planeRef.current.position.set(px, z + 0.005, py);
      const planeDefaultN = new THREE.Vector3(0, 0, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(planeDefaultN, n);
      planeRef.current.quaternion.copy(q);
    }

    if (ringRef.current) {
      // Glowing rim around the plane — sit it slightly above to avoid z-fighting
      ringRef.current.position.set(px, z + 0.012, py);
      const planeDefaultN = new THREE.Vector3(0, 0, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(planeDefaultN, n);
      ringRef.current.quaternion.copy(q);
    }

    if (arrowRef.current) {
      // Gradient lives in the world XZ plane (Y = up). Project on tangent plane:
      // simplest correct version — arrow lies along (dx, 0, dy), starting at the point.
      const gradWorld = new THREE.Vector3(dx, 0, dy);
      const mag = gradWorld.length();
      if (mag > 0.001) {
        const dir = gradWorld.clone().normalize();
        arrowRef.current.position.set(px, z + 0.06, py);
        // Both cone and cylinder are oriented along +Z locally → align +Z with dir.
        const arrowDefaultN = new THREE.Vector3(0, 0, 1);
        const q = new THREE.Quaternion().setFromUnitVectors(arrowDefaultN, dir);
        arrowRef.current.quaternion.copy(q);
      }
    }
  });

  return (
    <>
      <mesh ref={planeRef}>
        <planeGeometry args={[2.5, 2.5]} />
        <meshStandardMaterial
          ref={planeMatRef}
          color="#FDB813"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          emissive="#FDB813"
          emissiveIntensity={0.45}
        />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[1.18, 1.26, 64]} />
        <meshBasicMaterial ref={ringMatRef} color="#FFE9A8" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={pointRef}>
        <sphereGeometry args={[0.09, 18, 18]} />
        <meshStandardMaterial color="#FFFAE5" emissive="#FDB813" emissiveIntensity={3.2} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.20, 18, 18]} />
        <meshBasicMaterial color="#FDB813" transparent opacity={0.22} side={THREE.BackSide} />
      </mesh>
      <group ref={arrowRef}>
        {/* Cylinder shaft — along +Z, length 0.7 */}
        <mesh position={[0, 0, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.7, 8]} />
          <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={2.2} />
        </mesh>
        {/* Cone tip — apex at +Z (rotate so cone's default +Y axis becomes +Z) */}
        <mesh position={[0, 0, 0.78]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.085, 0.22, 12]} />
          <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={2.6} />
        </mesh>
      </group>
    </>
  );
}

function Scene({ phaseRef }: { phaseRef: React.MutableRefObject<string> }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 6, 3]} intensity={0.6} />
      <pointLight position={[0, 4, 0]} intensity={0.8} color="#4FC3F7" distance={14} />
      <pointLight position={[-3, 2, 3]} intensity={0.5} color="#FDB813" distance={10} />
      <Surface />
      <TangentPlane phaseRef={phaseRef} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#070A12" roughness={1} />
      </mesh>
    </>
  );
}

export default function SurfaceScene({ phase = '14-gradiente' }: SurfaceSceneProps) {
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const captionByPhase: Record<string, string> = {
    '12-dimension': '¿hacia dónde subes más rápido?',
    '13-plano-tangente': 'plano tangente · roza la superficie en un punto',
    '14-gradiente': '∇f apunta cuesta arriba · negativo → valle',
  };
  const caption = captionByPhase[phase] ?? '';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0A1420 0%, #03050A 85%)' }}
    >
      <Canvas camera={{ position: [4.5, 3.5, 4.5], fov: 36 }}>
        <Scene phaseRef={phaseRef} />
        <OrbitControls
          enableDamping
          autoRotate
          autoRotateSpeed={0.35}
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.5}
          target={[0, 0.3, 0]}
        />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#4FC3F7] tracking-[0.3em] uppercase">
          Superficie · plano tangente · gradiente
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>
      <div className="absolute bottom-8 left-8 pointer-events-none">
        {phase !== '12-dimension' && (
          <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#FDB813]/40 shadow-[0_0_6px_#FDB813]" />
            <span className="text-[#94A3B8]">plano tangente</span>
          </div>
        )}
        {phase === '14-gradiente' && (
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="inline-block w-4 h-0.5 bg-[#34D399] shadow-[0_0_6px_#34D399]" />
            <span className="text-[#94A3B8]">∇f · ascenso máximo</span>
          </div>
        )}
      </div>
    </div>
  );
}
