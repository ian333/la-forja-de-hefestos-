/**
 * MillikanDataScene — una constelación de puntos cae en línea.
 *
 *   En el vacío negro, puntos amarillos van apareciendo uno por uno
 *   formando una nube. Cuando hay suficientes, una línea de luz cian
 *   los atraviesa: la pendiente exacta = h. La línea se queda glorificada.
 *
 *   Sin ejes. Sin labels. La constelación es la idea.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const H_eVs = 4.136e-15;
const FREQ_UNIT = 1e14;
const W = 4.30;
const F_MIN = 11, F_MAX = 17;

// 10 años · 6 puntos cada año = 60 total
const POINTS = (() => {
  const out: { f: number; K: number; year: number }[] = [];
  let seed = 137;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280 - 0.5;
  };
  for (let yi = 0; yi < 10; yi++) {
    const year = 1907 + yi;
    const dispersion = 0.45 - yi * 0.04;
    for (let i = 0; i < 6; i++) {
      const f = F_MIN + (i / 5) * (F_MAX - F_MIN);
      const Ktrue = H_eVs * FREQ_UNIT * f - W;
      out.push({ f, K: Math.max(0, Ktrue + rand() * dispersion), year });
    }
  }
  return out;
})();

function plotX(f: number) { return (f - F_MIN) / (F_MAX - F_MIN) * 4.5 - 2.25; }
function plotY(K: number) { return K * 0.7 - 1.0; }

function ConstellationPoint({ pt, visible }: { pt: { f: number; K: number }; visible: boolean }) {
  return (
    <mesh position={[plotX(pt.f), plotY(pt.K), 0]} visible={visible}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial
        color="#FACC15"
        emissive="#FACC15"
        emissiveIntensity={2.5}
        toneMapped={false}
      />
    </mesh>
  );
}

function FitLine({ visible }: { visible: boolean }) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    // pulso sutil de luminosidad
    const pulse = 0.7 + Math.sin(clock.elapsedTime * 1.3) * 0.15;
    matRef.current.opacity = visible ? pulse : 0;
  });
  const pts = useMemo<[number, number, number][]>(() => {
    const K0 = H_eVs * FREQ_UNIT * F_MIN - W;
    const K1 = H_eVs * FREQ_UNIT * F_MAX - W;
    return [
      [plotX(F_MIN), plotY(Math.max(0, K0)), 0.01],
      [plotX(F_MAX), plotY(Math.max(0, K1)), 0.01],
    ];
  }, []);
  return (
    <Line
      points={pts}
      color="#22D3EE"
      lineWidth={3.5}
      transparent
      opacity={visible ? 1 : 0}
      // material ref via callback no es accesible — pasamos opacity directo
    />
  );
}

function Scene() {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      // 18 segundos para revelar todos los 60 puntos
      const cycleLen = 22;
      const cycleT = (elapsed % cycleLen) / cycleLen;
      const n = Math.floor(cycleT * POINTS.length);
      setRevealed(n);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 2, 3]} intensity={0.6} color="#22D3EE" />
      <pointLight position={[2, -1, 2]} intensity={0.4} color="#FACC15" />
      {POINTS.map((p, i) => (
        <ConstellationPoint key={i} pt={p} visible={i < revealed} />
      ))}
      <FitLine visible={revealed > 12} />
    </>
  );
}

export default function MillikanDataScene(_props: { phase?: string } = {}) {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0.5, 5.0], fov: 42, near: 0.001, far: 100 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        dpr={[0.55, 1]}
      >
        <Scene />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.18}
          minPolarAngle={1.3}
          maxPolarAngle={1.6}
        />
      </Canvas>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-[11px] font-mono text-[#94A3B8]">
        1907  →  1916
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[12px] font-mono text-[#CBD5E1]">
        diez años · pendiente = h
      </div>
    </div>
  );
}
