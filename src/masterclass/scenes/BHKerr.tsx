/**
 * BHKerr — visualización de frame dragging. El espacio-tiempo cerca de una BH
 * en rotación es arrastrado: un sistema de coordenadas inercial-en-infinito
 * gira al pasar cerca. Mostramos un BH en rotación con vectores tangentes
 * que evidencian el "arrastre" — la ergosfera achatada por el spin.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { makeRenderer } from '@/lib/webgl-fallback';

// Referencia estable — fuera del componente para no recrear el gl factory
// en cada render (R3F re-monta Canvas/OrbitControls si `gl` cambia).
const gl = makeRenderer();
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function KerrScene() {
  // Geometría aproximada de ergosfera para a* = 0.95
  //   r_+ (horizon)    = M (1 + √(1-a²))
  //   r_ergo(θ)        = M (1 + √(1 - a²cos²θ))
  const aStar = 0.95;
  const ergoGeom = useMemo(() => {
    const M = 1;
    const a = aStar;
    const seg = 96;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const theta = (i / seg) * Math.PI;     // 0..π
      const r_e = M * (1 + Math.sqrt(Math.max(0, 1 - a*a * Math.cos(theta)*Math.cos(theta))));
      for (let j = 0; j <= seg; j++) {
        const phi = (j / seg) * Math.PI * 2;
        positions.push(
          r_e * Math.sin(theta) * Math.cos(phi),
          r_e * Math.cos(theta),
          r_e * Math.sin(theta) * Math.sin(phi),
        );
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j;
        const b = a + 1;
        const c = a + (seg + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [aStar]);

  // Horizonte
  const rPlus = useMemo(() => 1 * (1 + Math.sqrt(Math.max(0, 1 - aStar*aStar))), [aStar]);

  // Marcadores de frame-dragging: pequeños vectores que orbitan
  const draggerRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (draggerRef.current) draggerRef.current.rotation.y = clock.elapsedTime * 0.8;
  });

  // Anillos de "arrastre" — partículas que serían en reposo en infinito pero
  // arrastradas a girar cerca de la BH
  const ring1 = useMemo(() => makeRing(2.2, 32), []);
  const ring2 = useMemo(() => makeRing(3.0, 32), []);
  const ring3 = useMemo(() => makeRing(4.0, 32), []);

  return (
    <group>
      {/* Horizonte de eventos (esfera negra) */}
      <mesh>
        <sphereGeometry args={[rPlus, 48, 48]} />
        <meshBasicMaterial color="#000" />
      </mesh>

      {/* Ergosfera achatada (semi-transparente) */}
      <mesh geometry={ergoGeom}>
        <meshStandardMaterial
          color="#7E1A6B"
          emissive="#F472B6"
          emissiveIntensity={0.5}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          wireframe
        />
      </mesh>
      <mesh geometry={ergoGeom}>
        <meshStandardMaterial
          color="#F472B6"
          emissive="#F472B6"
          emissiveIntensity={0.18}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Partículas siendo arrastradas — tres anillos concéntricos con tangentes */}
      <DragRing points={ring1} color="#FACC15" size={0.08} rotateY={true} dragRate={0.85} />
      <DragRing points={ring2} color="#FDB813" size={0.07} rotateY={true} dragRate={0.55} />
      <DragRing points={ring3} color="#FFFFFF" size={0.05} rotateY={true} dragRate={0.32} />

      {/* Espirales mostrando torsión del espacio-tiempo */}
      <DragSpiral color="#F472B6" />
      <group rotation={[Math.PI, 0, 0]}>
        <DragSpiral color="#A78BFA" />
      </group>

      {/* eje rotacional */}
      <mesh position={[0, 2.4, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.4, 8]} />
        <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0, 3.2, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.08, 0.2, 12]} />
        <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function DragRing({ points, color, size, rotateY = false, dragRate = 0.4 }: {
  points: Float32Array; color: string; size: number; rotateY?: boolean; dragRate?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (rotateY && ref.current) {
      ref.current.rotation.y = clock.elapsedTime * dragRate;
    }
  });
  const N = points.length / 3;
  const r = useMemo(() => Math.hypot(points[0], points[2]), [points]);
  return (
    <group>
      {/* Anillo continuo de "estela" del arrastre — torus tenue */}
      <mesh ref={trailRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r, 0.012, 8, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
      <group ref={ref}>
        {Array.from({ length: N }, (_, i) => (
          <mesh key={i} position={[points[i*3], points[i*3+1], points[i*3+2]]}>
            <sphereGeometry args={[size, 16, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} />
          </mesh>
        ))}
        {/* Vectores tangenciales: pequeños conos apuntando a la dirección de arrastre */}
        {Array.from({ length: N }, (_, i) => {
          const px = points[i*3], pz = points[i*3+2];
          const ang = Math.atan2(pz, px) + Math.PI / 2;
          return (
            <mesh key={`arrow-${i}`}
              position={[px, 0, pz]}
              rotation={[0, ang, 0]}>
              <coneGeometry args={[size * 0.6, size * 1.8, 8]} />
              <meshStandardMaterial color={color} emissive={color}
                                   emissiveIntensity={1.8} transparent opacity={0.85} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// Espirales que muestran el "vortex" del arrastre de marcos.
// Cuatro líneas helicoidales emergiendo radialmente del polo norte, mostrando
// cómo lo que cae desde el infinito se tuerce alrededor del eje.
function DragSpiral({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.elapsedTime * 0.45;
  });
  const lines = useMemo(() => {
    const result: { points: Float32Array; phase: number }[] = [];
    for (let s = 0; s < 4; s++) {
      const N = 60;
      const pts = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        // Desde radio 5 hasta radio 1 (cerca del horizonte)
        const r = 5 - u * 4;
        // Torsión aumenta cerca del horizonte
        const twist = s * Math.PI / 2 + u * u * 12;
        pts[i*3+0] = r * Math.cos(twist);
        pts[i*3+1] = 1.8 * (1 - u);          // baja por el eje
        pts[i*3+2] = r * Math.sin(twist);
      }
      result.push({ points: pts, phase: s });
    }
    return result;
  }, []);
  return (
    <group ref={groupRef}>
      {lines.map((l, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position"
              count={l.points.length / 3} array={l.points} itemSize={3}
              args={[l.points, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={color} transparent opacity={0.4} />
        </line>
      ))}
    </group>
  );
}

function makeRing(r: number, n: number): Float32Array {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    arr[i*3+0] = r * Math.cos(t);
    arr[i*3+1] = 0;
    arr[i*3+2] = r * Math.sin(t);
  }
  return arr;
}

export default function BHKerr() {
  return (
    <div className="w-full h-full relative" style={{
      background: 'radial-gradient(ellipse at center, #18081A 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [6, 5, 10], fov: 38 }} gl={gl}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 5, 4]} intensity={0.6} />
        <pointLight position={[0, 0, 0]} intensity={1.2} distance={4} color="#F472B6" />
        <KerrScene />
        <OrbitControls enablePan={false} enableZoom
                       autoRotate autoRotateSpeed={0.35}
                       minDistance={4} maxDistance={40}
                       minPolarAngle={0.3} maxPolarAngle={2.2} />
      </Canvas>
      <div className="absolute bottom-6 left-6 text-[11px] font-mono text-[#94A3B8] space-y-1">
        <div><span className="text-[#22D3EE]">↑</span> eje de rotación · a* = 0.95</div>
        <div><span className="text-[#F472B6]">●</span> ergosfera (achatada por el espín)</div>
        <div><span className="text-[#FACC15]">●</span> "observadores" arrastrados por la métrica</div>
      </div>
    </div>
  );
}
