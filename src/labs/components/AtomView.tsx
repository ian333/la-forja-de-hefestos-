/**
 * AtomView — visualiza el orbital real como nube de densidad electrónica.
 *
 * No es pelota + palitos. Es ψ(r,θ,φ) samplada por rejection sampling,
 * con cada punto pintado según el signo de la función de onda (lóbulos
 * positivos vs negativos) y su densidad |ψ|². El núcleo se dibuja como
 * un punto brillante en el origen.
 *
 * Si el usuario cambia de orbital (1s, 2p, 3d...), el muestreo se
 * recomputa. Si cambia Z (número atómico), la nube se contrae.
 *
 * Técnica: `THREE.Points` con buffer de posiciones + colores, shader
 * por defecto con additive blending — económico, 60fps con 20 000 puntos.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  ORBITALS,
  sampleOrbital,
  type OrbitalKey,
  type SamplePoint,
  orbitalEnergy,
  HARTREE_TO_EV,
} from '@/lib/chem/quantum/orbitals';

interface AtomViewProps {
  orbitalKey: OrbitalKey;
  Z: number;
  nPoints?: number;
  height?: number;
}

function PointCloud({ samples }: { samples: SamplePoint[] }) {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(samples.length * 3);
    const colors = new Float32Array(samples.length * 3);
    const sizes = new Float32Array(samples.length);

    // Colores: lóbulos positivos azul, negativos naranja (convención común)
    const posColor = new THREE.Color('#4FC3F7');
    const negColor = new THREE.Color('#FFB74D');

    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const col = p.sign > 0 ? posColor : negColor;
      // Intensidad del color según densidad — más oscuro → más denso
      const brightness = 0.3 + 0.7 * p.density;
      colors[i * 3 + 0] = col.r * brightness;
      colors[i * 3 + 1] = col.g * brightness;
      colors[i * 3 + 2] = col.b * brightness;
      sizes[i] = 0.05 + 0.1 * p.density;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geom;
  }, [samples]);

  // Rotación lenta para dar vida a la escena
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.12;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.12}
        sizeAttenuation
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/** Núcleo: esfera pequeña brillante en el origen. */
function Nucleus({ Z }: { Z: number }) {
  const radius = 0.12 + 0.02 * Math.log2(Math.max(1, Z));
  return (
    <mesh>
      <sphereGeometry args={[radius, 20, 20]} />
      <meshBasicMaterial color="#FFEB3B" />
      <pointLight color="#FFF59D" intensity={2} distance={5} />
    </mesh>
  );
}

/** Ejes de referencia sutiles */
function Axes({ length }: { length: number }) {
  return (
    <group>
      {[
        { dir: [1, 0, 0], color: '#EF4444' },
        { dir: [0, 1, 0], color: '#22C55E' },
        { dir: [0, 0, 1], color: '#3B82F6' },
      ].map((axis, i) => (
        <line key={i}>
          <bufferGeometry
            attach="geometry"
            onUpdate={(g) => {
              const arr = new Float32Array([
                -length * axis.dir[0], -length * axis.dir[1], -length * axis.dir[2],
                 length * axis.dir[0],  length * axis.dir[1],  length * axis.dir[2],
              ]);
              g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
            }}
          />
          <lineBasicMaterial color={axis.color} transparent opacity={0.18} />
        </line>
      ))}
    </group>
  );
}

export default function AtomView({
  orbitalKey,
  Z,
  nPoints = 12000,
  height = 460,
}: AtomViewProps) {
  const orbital = ORBITALS[orbitalKey];

  const samples = useMemo(
    () => sampleOrbital(orbital, nPoints, Z, 42),
    [orbital, nPoints, Z],
  );

  const energy = orbitalEnergy(orbital.n, Z);
  const energyEv = energy * HARTREE_TO_EV;

  const cameraDistance = orbital.extent / Z * 1.5;

  return (
    <div
      style={{ height }}
      className="w-full rounded-xl overflow-hidden relative bg-[radial-gradient(ellipse_at_center,_#0f1117_0%,_#05060a_100%)]"
    >
      <Canvas
        camera={{ position: [cameraDistance, cameraDistance * 0.7, cameraDistance], fov: 45 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.2} />
        <PointCloud samples={samples} />
        <Nucleus Z={Z} />
        <Axes length={cameraDistance * 0.6} />
        <OrbitControls
          enablePan={false}
          minDistance={cameraDistance * 0.3}
          maxDistance={cameraDistance * 3}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      {/* Overlay: metadata del orbital */}
      <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2 text-white border border-white/10">
        <div className="font-mono text-[11px] text-[#94A3B8] uppercase tracking-wider">
          Orbital
        </div>
        <div className="font-display text-[24px] leading-none font-semibold tracking-tight">
          {orbital.name}
        </div>
        <div className="mt-1 text-[11px] font-mono text-[#64748B]">
          n={orbital.n} · ℓ={orbital.l} · Z={Z}
        </div>
      </div>

      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2 text-white border border-white/10 text-right">
        <div className="font-mono text-[11px] text-[#94A3B8] uppercase tracking-wider">
          Energía (hidrogenoide)
        </div>
        <div className="font-mono text-[18px] font-semibold">
          {energyEv.toFixed(2)} eV
        </div>
        <div className="text-[11px] font-mono text-[#64748B]">
          {energy.toFixed(4)} Hartree
        </div>
      </div>

      <div className="absolute bottom-3 left-3 right-3 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2 text-[#CBD5E1] text-[12px] leading-snug border border-white/10">
        {orbital.description}
      </div>

      <div className="absolute bottom-3 right-3 flex gap-2 items-center">
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md rounded-lg px-2.5 py-1.5 border border-white/10">
          <div className="w-2.5 h-2.5 rounded-full bg-[#4FC3F7]" />
          <span className="text-[10px] font-mono text-[#CBD5E1]">ψ &gt; 0</span>
        </div>
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md rounded-lg px-2.5 py-1.5 border border-white/10">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFB74D]" />
          <span className="text-[10px] font-mono text-[#CBD5E1]">ψ &lt; 0</span>
        </div>
      </div>
    </div>
  );
}
