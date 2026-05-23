/**
 * BHWell — paraboloide de Flamm (Schwarzschild embedding) con horizonte negro,
 * esfera de fotones (1.5 r_s) e ISCO (3 r_s) marcadas como anillos brillantes.
 *
 * Partículas siguen geodésicas radiales que CAEN hacia el horizonte —
 * visualiza la idea "todos los caminos futuros llevan al centro".
 * La cámara orbita lento para mostrar la profundidad del pozo.
 */

import { useMemo, useRef, memo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { makeRenderer } from '@/lib/webgl-fallback';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const RS = 0.5;
function flammHeight(r: number, rs = RS) {
  if (r <= rs) return -2 * Math.sqrt(rs * (rs * 1.02 - rs));
  return -2 * Math.sqrt(Math.max(0, rs * (r - rs)));
}

function Well() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.elapsedTime * 0.08;
  });

  const geom = useMemo(() => {
    const rs = 0.5;
    const rIn  = rs * 1.02;
    const rOut = 6;
    const nR = 80;
    const nT = 96;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < nR; i++) {
      const u = i / (nR - 1);
      const r = rIn * Math.pow(rOut / rIn, u);
      const w = -2 * Math.sqrt(Math.max(0, rs * (r - rs)));
      for (let j = 0; j < nT; j++) {
        const theta = (j / nT) * 2 * Math.PI;
        positions.push(r * Math.cos(theta), w, r * Math.sin(theta));
        const t = Math.min(1, Math.pow((rOut - r) / (rOut - rIn), 1.6));
        const cr = 0.2 + 0.4 * t;
        const cg = 0.1 + 0.15 * t;
        const cb = 0.25 + 0.35 * (1 - t);
        colors.push(cr, cg, cb);
      }
    }
    for (let i = 0; i < nR - 1; i++) {
      for (let j = 0; j < nT; j++) {
        const a = i * nT + j;
        const b = i * nT + (j + 1) % nT;
        const c = (i + 1) * nT + j;
        const d = (i + 1) * nT + (j + 1) % nT;
        indices.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);

  const wire = useMemo(() => new THREE.WireframeGeometry(geom), [geom]);

  // Anillos a 1.5 r_s (photon) y 3 r_s (ISCO)
  const ringPhoton = useMemo(() => makeRingPoints(1.5 * 0.5, 96), []);
  const ringIsco   = useMemo(() => makeRingPoints(3.0 * 0.5, 96), []);

  return (
    <group ref={groupRef}>
      <mesh geometry={geom}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          metalness={0.15}
          roughness={0.75}
          transparent
          opacity={0.55}
        />
      </mesh>
      <lineSegments geometry={wire}>
        <lineBasicMaterial color="#7E57C2" transparent opacity={0.25} />
      </lineSegments>

      {/* Partículas radiales cayendo al horizonte */}
      <InfallingParticles />

      {/* Horizonte */}
      <mesh position={[0, -2 * Math.sqrt(0.5 * (0.5 * 1.02 - 0.5)) - 0.02, 0]}>
        <sphereGeometry args={[0.5 * 1.02, 48, 48]} />
        <meshStandardMaterial color="#000000" emissive="#FDB813" emissiveIntensity={0.1} />
      </mesh>

      {/* Anillo photon sphere */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={ringPhoton.length / 3}
            array={ringPhoton} itemSize={3} args={[ringPhoton, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#F472B6" linewidth={2} />
      </line>
      <RingTorus radius={1.5 * 0.5} color="#F472B6" />
      <RingTorus radius={3.0 * 0.5} color="#FDB813" />

      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={ringIsco.length / 3}
            array={ringIsco} itemSize={3} args={[ringIsco, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#FDB813" />
      </line>
    </group>
  );
}

function InfallingParticles() {
  // 24 partículas, cada una con un ángulo θ propio y un parámetro temporal
  // que avanza desde r_init a r_s en T_FALL segundos. La altura sigue el
  // embedding de Flamm — la partícula visiblemente desciende por el pozo.
  const N = 24;
  const initial = useMemo(() => Array.from({ length: N }, () => ({
    theta: Math.random() * Math.PI * 2,
    phase: Math.random(),
    r0: 4.5 + Math.random() * 1.5,
    color: ['#FDB813', '#F472B6', '#4FC3F7', '#FACC15'][Math.floor(Math.random() * 4)],
  })), []);

  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trailRefs = useRef<(THREE.Mesh | null)[]>([]);

  const T_FALL = 5.5;
  useFrame(({ clock }) => {
    for (let i = 0; i < N; i++) {
      const m = meshRefs.current[i];
      const t = trailRefs.current[i];
      if (!m) continue;
      const local = ((clock.elapsedTime / T_FALL) + initial[i].phase) % 1;
      // Aceleración hacia el horizonte: r(t) = r0 * (1 - local)^0.6
      // Cerca de r_s va más lento (asintotically slow — efecto coordinado)
      const r = Math.max(RS * 1.05, initial[i].r0 * Math.pow(1 - local, 0.55) + RS * 0.05);
      const theta = initial[i].theta;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = flammHeight(r) + 0.02;
      m.position.set(x, y, z);
      // Fade out cerca del horizonte
      const fade = Math.min(1, (r - RS) / (RS * 0.3));
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 2.0 * fade;
      mat.opacity = fade;
      // Trail más corto: pegado al cuerpo
      if (t) {
        const rPrev = Math.max(RS * 1.05, initial[i].r0 * Math.pow(1 - Math.min(local + 0.05, 0.999), 0.55) + RS * 0.05);
        const xPrev = rPrev * Math.cos(theta);
        const zPrev = rPrev * Math.sin(theta);
        const yPrev = flammHeight(rPrev) + 0.02;
        t.position.set((x + xPrev) / 2, (y + yPrev) / 2, (z + zPrev) / 2);
        t.scale.set(0.5, Math.sqrt((x-xPrev)**2 + (y-yPrev)**2 + (z-zPrev)**2) * 8, 0.5);
      }
    }
  });

  return (
    <group>
      {initial.map((p, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el; }}
        >
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial
            color={p.color}
            emissive={p.color}
            emissiveIntensity={2}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function RingTorus({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh>
      <torusGeometry args={[radius, 0.012, 12, 96]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
    </mesh>
  );
}

function makeRingPoints(r: number, n: number) {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * Math.PI * 2;
    arr[i*3+0] = r * Math.cos(t);
    arr[i*3+1] = 0;
    arr[i*3+2] = r * Math.sin(t);
  }
  return arr;
}

function BHWell() {
  return (
    <div className="w-full h-full" style={{
      background: 'radial-gradient(ellipse at center, #1B0F20 0%, #05060A 85%)',
    }}>
      <Canvas camera={{ position: [5, 4, 9], fov: 45 }} gl={makeRenderer()}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 4]} intensity={0.6} />
        <pointLight position={[0, 0, 0]} intensity={1.0} distance={5} color="#FDB813" />
        <Well />
        <OrbitControls enablePan={false} enableZoom autoRotate autoRotateSpeed={0.3}
                       minDistance={3} maxDistance={40}
                       minPolarAngle={0.3} maxPolarAngle={2.2} />
      </Canvas>
      <div className="absolute bottom-6 left-6 text-[11px] font-mono text-[#94A3B8] space-y-1">
        <div><span className="text-[#F472B6]">●</span> esfera de fotones · 1.5 r_s</div>
        <div><span className="text-[#FDB813]">●</span> ISCO · 3 r_s</div>
        <div><span className="text-[#000000] inline-block w-3 h-3 rounded-full border border-white/40 align-middle" /> horizonte · r_s = 2GM/c²</div>
      </div>
    </div>
  );
}

export default memo(BHWell);
