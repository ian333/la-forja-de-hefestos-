/**
 * MultiElectronAtomView — visualiza el átomo completo con todos sus electrones.
 *
 * Combina la nube de cada subshell poblado en una sola escena. Cada electrón
 * se representa por puntos muestreados de |ψ|² con apantallamiento Slater.
 * Colores por subshell: s azul, p naranja, d verde, f violeta.
 *
 * Un toggle permite encender/apagar cada subshell, de modo que el alumno
 * pueda "pelar" capas y ver qué hace cada electrón.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  type Element,
  valenceElectrons, configCompact,
} from '@/lib/chem/quantum/periodic-table';
import {
  sampleAtom, populateAtom, atomExtent, nucleusInfo,
  subshellColor, subshellLabel,
  type AtomSample,
} from '@/lib/chem/quantum/atom-builder';
import { getParticleTexture } from './sprite-texture';

interface MultiElectronAtomViewProps {
  element: Element;
  nPoints?: number;
  height?: number;
}

function PointCloud({ samples, subshellVisible }: {
  samples: AtomSample[];
  subshellVisible: Record<string, boolean>;
}) {
  const ref = useRef<THREE.Points>(null);
  const particleTexture = useMemo(() => getParticleTexture(), []);

  const geometry = useMemo(() => {
    const filtered = samples.filter((s) => {
      const key = subshellLabel(s.n, s.l);
      return subshellVisible[key] !== false;
    });

    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(filtered.length * 3);
    const colors = new Float32Array(filtered.length * 3);

    for (let i = 0; i < filtered.length; i++) {
      const p = filtered[i];
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const baseColor = new THREE.Color(subshellColor(p.n, p.l));
      if (p.sign < 0) baseColor.offsetHSL(-0.08, 0, 0);
      const brightness = 0.4 + 0.6 * p.density;
      colors[i * 3 + 0] = baseColor.r * brightness;
      colors[i * 3 + 1] = baseColor.g * brightness;
      colors[i * 3 + 2] = baseColor.b * brightness;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    return geom;
  }, [samples, subshellVisible]);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.08;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        vertexColors
        map={particleTexture}
        alphaMap={particleTexture}
        size={0.28}
        sizeAttenuation
        transparent
        opacity={0.92}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function Nucleus({ protons, neutrons }: { protons: number; neutrons: number }) {
  const scale = Math.pow(protons + neutrons, 1 / 3) * 0.12;
  return (
    <mesh>
      <sphereGeometry args={[scale, 24, 24]} />
      <meshStandardMaterial
        color="#FDD835"
        emissive="#F9A825"
        emissiveIntensity={0.4}
        roughness={0.4}
      />
      <pointLight color="#FFF59D" intensity={3} distance={8} />
    </mesh>
  );
}

export default function MultiElectronAtomView({
  element, nPoints = 14000, height = 560,
}: MultiElectronAtomViewProps) {
  const samples = useMemo(
    () => sampleAtom(element, nPoints, 42),
    [element, nPoints],
  );

  const populated = useMemo(() => populateAtom(element), [element]);

  // Toggle por subshell (key = "1s", "2p", etc.)
  const [subshellVisible, setSubshellVisible] = useState<Record<string, boolean>>({});

  // Reset visibilidad al cambiar de elemento
  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const o of populated) {
      init[subshellLabel(o.n, o.l)] = true;
    }
    setSubshellVisible(init);
  }, [element.Z, populated]);

  const nucleus = nucleusInfo(element);
  const ext = atomExtent(element);
  const cameraDistance = ext * 1.8;

  // Subshells únicos con electrones (para UI de toggle)
  const uniqueSubshells = useMemo(() => {
    const map = new Map<string, { n: number; l: number; electrons: number; Zeff: number }>();
    for (const o of populated) {
      const key = subshellLabel(o.n, o.l);
      const prev = map.get(key);
      if (prev) {
        prev.electrons += o.electrons;
      } else {
        map.set(key, { n: o.n, l: o.l, electrons: o.electrons, Zeff: o.Zeff });
      }
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [populated]);

  return (
    <div
      style={{ height }}
      className="w-full rounded-xl overflow-hidden relative bg-[radial-gradient(ellipse_at_center,_#0f1117_0%,_#05060a_100%)]"
    >
      <Canvas
        camera={{ position: [cameraDistance, cameraDistance * 0.7, cameraDistance], fov: 45 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.18} />
        <PointCloud samples={samples} subshellVisible={subshellVisible} />
        <Nucleus protons={nucleus.protons} neutrons={nucleus.neutrons} />
        <OrbitControls
          enablePan={false}
          minDistance={cameraDistance * 0.3}
          maxDistance={cameraDistance * 3}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      {/* Etiqueta del elemento */}
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md rounded-lg px-4 py-3 text-white border border-white/10">
        <div className="flex items-baseline gap-3">
          <div className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider">
            Z = {element.Z}
          </div>
          <div className="text-[42px] leading-none font-bold tracking-tight">
            {element.symbol}
          </div>
          <div className="text-[14px] text-[#CBD5E1]">{element.name}</div>
        </div>
        <div className="mt-1.5 text-[11px] font-mono text-[#7DD3FC]">
          {configCompact(element.Z)}
        </div>
      </div>

      {/* Propiedades físicas */}
      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md rounded-lg px-3 py-2 text-[11px] text-[#CBD5E1] border border-white/10 font-mono space-y-0.5 min-w-[170px]">
        <PropRow label="Masa"    value={`${element.mass.toFixed(3)} u`} />
        <PropRow label="Protones"  value={`${nucleus.protons}`} />
        <PropRow label="Neutrones" value={`${nucleus.neutrons}`} />
        <PropRow label="Valencia"  value={`${valenceElectrons(element)}`} />
        <PropRow label="EN (Pauling)" value={element.electronegativity !== null ? element.electronegativity.toFixed(2) : '—'} />
        <PropRow label="IE₁"       value={element.ionizationEnergy !== null ? `${element.ionizationEnergy.toFixed(2)} eV` : '—'} />
        <PropRow label="r cov."    value={element.covalentRadius !== null ? `${element.covalentRadius} pm` : '—'} />
      </div>

      {/* Panel de subshells con toggle */}
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md rounded-lg px-3 py-2 text-[#CBD5E1] border border-white/10">
        <div className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider mb-1.5">
          Subshells · clic para ocultar
        </div>
        <div className="flex flex-wrap gap-1.5">
          {uniqueSubshells.map((s) => {
            const visible = subshellVisible[s.key] !== false;
            const color = subshellColor(s.n, s.l);
            return (
              <button
                key={s.key}
                onClick={() => setSubshellVisible((sv) => ({ ...sv, [s.key]: !visible }))}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border transition ${
                  visible ? 'bg-white/5' : 'bg-transparent opacity-40'
                }`}
                style={{ borderColor: visible ? color : '#334155' }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-white font-bold">{s.key}</span>
                <sup className="text-[9px]">{s.electrons}</sup>
                <span className="text-[9px] text-[#64748B] ml-1">Z*={s.Zeff.toFixed(2)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
