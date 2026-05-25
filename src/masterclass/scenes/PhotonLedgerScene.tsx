/**
 * PhotonLedgerScene — la ecuación K = h·f − W viva en pantalla.
 *
 * Un solo fotón entra. Se "contabiliza" su energía en una balanza:
 *   barra azul (hf)  −  barra roja (W)  =  barra cian (K)
 * El electrón sale con velocidad ∝ √(2K/m). Si K ≤ 0, no sale.
 *
 * Fases:
 *  - '08-ledger'  : ciclo hf<W → hf=W → hf>W → hf>>W con zinc (W = 4.30 eV)
 *  - '09-metales' : rota entre Cs, K, Zn, Pt cambiando solo W, fija hf alta
 *
 * Cámara cinemática (lateral oblicua), bloom emisivo, pulso al impacto.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface Props { phase?: string }

const PLANCK_H_eVs = 4.136e-15;
const C_LIGHT = 2.998e8;
const ELECTRON_MASS_eV = 0.511e6;
const FREQ_UNIT = 1e14;        // Hz por unidad

interface Metal { name: string; W: number; color: string; symbol: string }
const METALS: Metal[] = [
  { symbol: 'Cs', name: 'Cesio',   W: 1.95, color: '#FDB813' },
  { symbol: 'K',  name: 'Potasio', W: 2.30, color: '#FB923C' },
  { symbol: 'Zn', name: 'Zinc',    W: 4.30, color: '#22D3EE' },
  { symbol: 'Pt', name: 'Platino', W: 5.65, color: '#A78BFA' },
];
const METAL_BY_SYM: Record<string, Metal> = Object.fromEntries(METALS.map(m => [m.symbol, m]));

function photonColor(fNorm: number): THREE.Color {
  // fNorm en unidades 10^14 Hz: 4 = rojo, 6 = verde, 10 = UV
  if (fNorm < 4.5) return new THREE.Color('#FF3D3D');
  if (fNorm < 5.5) return new THREE.Color('#FB923C');
  if (fNorm < 6.5) return new THREE.Color('#FACC15');
  if (fNorm < 8)   return new THREE.Color('#22D3EE');
  if (fNorm < 12)  return new THREE.Color('#A78BFA');
  return new THREE.Color('#F472B6');
}

interface LedgerState {
  freqNorm: number;       // 10^14 Hz
  W: number;              // eV
  // animación
  photonAlive: boolean;
  photonT: number;        // 0..1 trayectoria
  electronAlive: boolean;
  electronT: number;      // distancia recorrida
  cycleT: number;
}

function MetalPlate({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[5, 0.4, 1.4]} />
        <meshStandardMaterial
          color="#475569"
          metalness={0.85}
          roughness={0.35}
          emissive={color}
          emissiveIntensity={0.18}
        />
      </mesh>
      {/* nube de electrones libres */}
      {Array.from({ length: 18 }).map((_, i) => (
        <mesh key={i} position={[(i / 17) * 4.4 - 2.2, -0.35, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial
            color="#22D3EE"
            emissive="#22D3EE"
            emissiveIntensity={1.0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Photon({ stateRef, materialRef }: {
  stateRef: React.MutableRefObject<LedgerState>;
  materialRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!meshRef.current) return;
    const s = stateRef.current;
    if (!s.photonAlive) {
      meshRef.current.position.set(0, -50, 0);
      return;
    }
    // trayectoria: arriba-izquierda → plate center
    const t = s.photonT;
    const startX = -4.5, startY = 4.5;
    const endX = 0, endY = -0.3;
    meshRef.current.position.set(
      startX + (endX - startX) * t,
      startY + (endY - startY) * t,
      0,
    );
    if (materialRef.current) {
      materialRef.current.color = photonColor(s.freqNorm);
      materialRef.current.emissive = photonColor(s.freqNorm);
    }
    // pulso al final
    const sz = 0.18 + (1 - t) * 0.08;
    meshRef.current.scale.setScalar(sz);
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 20, 20]} />
      <meshStandardMaterial
        ref={materialRef as any}
        emissive="#FFFFFF"
        emissiveIntensity={3.5}
        color="#FFFFFF"
        toneMapped={false}
      />
    </mesh>
  );
}

function FlashOnImpact({ stateRef }: { stateRef: React.MutableRefObject<LedgerState> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!meshRef.current || !matRef.current) return;
    const s = stateRef.current;
    // mostrar flash justo cuando photon entra a la placa (T cerca de 1) o electrón existe
    const showFlash = s.photonAlive && s.photonT > 0.92;
    if (showFlash) {
      const intensity = (s.photonT - 0.92) / 0.08;
      matRef.current.opacity = intensity * 0.6;
      meshRef.current.scale.setScalar(0.5 + intensity * 1.2);
      meshRef.current.position.set(0, -0.2, 0);
    } else {
      matRef.current.opacity = 0;
    }
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshBasicMaterial
        ref={matRef as any}
        color="#FFFFFF"
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function FreedElectron({ stateRef }: { stateRef: React.MutableRefObject<LedgerState> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!meshRef.current || !trailRef.current) return;
    const s = stateRef.current;
    if (!s.electronAlive) {
      meshRef.current.position.set(0, -50, 0);
      trailRef.current.scale.setScalar(0.001);
      return;
    }
    const hf = PLANCK_H_eVs * FREQ_UNIT * s.freqNorm;
    const K = Math.max(0, hf - s.W);
    if (K <= 0) {
      meshRef.current.position.set(0, -50, 0);
      trailRef.current.scale.setScalar(0.001);
      return;
    }
    // velocidad de subida proporcional a √K
    const speed = Math.sqrt(K) * 1.4;
    const y = -0.3 + s.electronT * speed;
    meshRef.current.position.set(0, y, 0);
    // glow trail
    trailRef.current.position.set(0, (y - 0.3) / 2 - 0.15, 0);
    const len = Math.max(0.001, y + 0.3);
    trailRef.current.scale.set(0.06, len, 0.06);
  });
  return (
    <group>
      {/* trail */}
      <mesh ref={trailRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#22D3EE" transparent opacity={0.45} toneMapped={false} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial
          color="#22D3EE"
          emissive="#22D3EE"
          emissiveIntensity={3.0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function EnergyBar({
  position,
  height,
  color,
  label,
  visible = true,
}: {
  position: [number, number, number];
  height: number;
  color: string;
  label: string;
  visible?: boolean;
}) {
  if (!visible || height <= 0.001) return null;
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[0.35, height, 0.35]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

function LedgerVisualization({ stateRef }: { stateRef: React.MutableRefObject<LedgerState> }) {
  const hfRef = useRef<THREE.Mesh>(null);
  const wRef = useRef<THREE.Mesh>(null);
  const kRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const s = stateRef.current;
    const hf = PLANCK_H_eVs * FREQ_UNIT * s.freqNorm;
    const W = s.W;
    const K = Math.max(0, hf - W);
    const scale = 0.35; // eV → unidades canvas
    // hf bar: posición izquierda
    if (hfRef.current) {
      const h = hf * scale;
      hfRef.current.scale.set(1, h, 1);
      hfRef.current.position.set(-2.2, 1.4 + h / 2, 0);
    }
    // W bar
    if (wRef.current) {
      const h = W * scale;
      wRef.current.scale.set(1, h, 1);
      wRef.current.position.set(-1.4, 1.4 + h / 2, 0);
    }
    // K bar
    if (kRef.current) {
      const h = K * scale;
      kRef.current.scale.set(1, Math.max(h, 0.001), 1);
      kRef.current.position.set(-0.6, 1.4 + h / 2, 0);
    }
  });

  return (
    <group>
      <mesh ref={hfRef}>
        <boxGeometry args={[0.32, 1, 0.32]} />
        <meshStandardMaterial color="#A78BFA" emissive="#A78BFA" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh ref={wRef}>
        <boxGeometry args={[0.32, 1, 0.32]} />
        <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh ref={kRef}>
        <boxGeometry args={[0.32, 1, 0.32]} />
        <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={1.7} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene({
  phase,
  stateRef,
  photonMatRef,
}: {
  phase: string;
  stateRef: React.MutableRefObject<LedgerState>;
  photonMatRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
}) {
  useFrame((_, dt) => {
    const s = stateRef.current;
    s.cycleT += dt;
    // ─── Fase: cómo varía f y W con el tiempo ───
    if (phase === '08-ledger') {
      // 4 sub-fases de 4 segundos cada una: zinc fijo (W=4.30), variar f
      const cycleLen = 16;
      const t = s.cycleT % cycleLen;
      s.W = 4.30;
      if (t < 4)        s.freqNorm = 6.0;    // hf < W (4 × 0.4136 ≈ 1.65 eV  < 4.30)
      else if (t < 8)   s.freqNorm = 10.4;   // hf ≈ W
      else if (t < 12)  s.freqNorm = 13.0;
      else              s.freqNorm = 16.0;
    } else if (phase === '09-metales') {
      // 4 metales × 4s, f fija alta para que todos disparen excepto Pt en bajo f
      const t = s.cycleT % 16;
      s.freqNorm = 13.5;
      if (t < 4)        s.W = METAL_BY_SYM.Cs.W;
      else if (t < 8)   s.W = METAL_BY_SYM.K.W;
      else if (t < 12)  s.W = METAL_BY_SYM.Zn.W;
      else              s.W = METAL_BY_SYM.Pt.W;
    } else {
      s.freqNorm = 13.0;
      s.W = 4.30;
    }

    // ─── Anima fotón + electrón en ciclo de 2 segundos ───
    const beat = (s.cycleT % 2.0);
    if (beat < 0.85) {
      s.photonAlive = true;
      s.photonT = beat / 0.85;
      s.electronAlive = false;
      s.electronT = 0;
    } else {
      s.photonAlive = false;
      const hf = PLANCK_H_eVs * FREQ_UNIT * s.freqNorm;
      const K = Math.max(0, hf - s.W);
      if (K > 0) {
        s.electronAlive = true;
        s.electronT = (beat - 0.85) / 1.15;
      } else {
        s.electronAlive = false;
      }
    }
  });

  // Metal color from current W (lookup METALS)
  const metalColor = useMemo(() => {
    const m = METALS.find(x => Math.abs(x.W - stateRef.current.W) < 0.05);
    return m?.color ?? '#22D3EE';
  }, [stateRef.current.W]);

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 5]} intensity={0.9} />
      <pointLight position={[-3, 3, 3]} intensity={0.6} color="#A78BFA" />
      <pointLight position={[3, 1, -2]} intensity={0.5} color="#22D3EE" />
      <MetalPlate color={metalColor} />
      <Photon stateRef={stateRef} materialRef={photonMatRef} />
      <FlashOnImpact stateRef={stateRef} />
      <FreedElectron stateRef={stateRef} />
      <LedgerVisualization stateRef={stateRef} />
    </>
  );
}

export default function PhotonLedgerScene({ phase = '08-ledger' }: Props) {
  const stateRef = useRef<LedgerState>({
    freqNorm: 13.0,
    W: 4.30,
    photonAlive: false,
    photonT: 0,
    electronAlive: false,
    electronT: 0,
    cycleT: 0,
  });
  const photonMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // HUD refs
  const hfHudRef = useRef<HTMLSpanElement>(null);
  const wHudRef  = useRef<HTMLSpanElement>(null);
  const kHudRef  = useRef<HTMLSpanElement>(null);
  const metalHudRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = stateRef.current;
      const hf = PLANCK_H_eVs * FREQ_UNIT * s.freqNorm;
      const K = Math.max(0, hf - s.W);
      if (hfHudRef.current) hfHudRef.current.textContent = `${hf.toFixed(2)} eV`;
      if (wHudRef.current)  wHudRef.current.textContent  = `${s.W.toFixed(2)} eV`;
      if (kHudRef.current)  kHudRef.current.textContent  = K > 0 ? `${K.toFixed(2)} eV` : `0 (debajo umbral)`;
      if (metalHudRef.current) {
        const m = METALS.find(x => Math.abs(x.W - s.W) < 0.05);
        metalHudRef.current.textContent = m ? `${m.symbol} · ${m.name}` : 'metal';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 30% 40%, #1A0F2E 0%, #03050A 75%)' }}
    >
      <Canvas camera={{ position: [2.6, 3.0, 6.5], fov: 40 }}>
        <Scene phase={phase} stateRef={stateRef} photonMatRef={photonMatRef} />
        <OrbitControls
          enableDamping
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          target={[-0.5, 1.0, 0]}
        />
      </Canvas>

      {/* Caption + ecuación maestra */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#A78BFA] tracking-[0.3em] uppercase">
          Balance de energía · K = h·f − W
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">
          {phase === '09-metales' ? 'cada metal, su W · misma luz' : 'sube la frecuencia · el balance se llena'}
        </div>
      </div>

      {/* Ledger HUD (left) */}
      <div className="absolute top-1/2 right-6 -translate-y-1/2 pointer-events-none">
        <div className="px-5 py-3 rounded-md border border-[#22D3EE]/30 bg-black/55 backdrop-blur-sm space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#22D3EE]">
            Balance en vivo
          </div>
          <div className="flex items-center gap-2 text-[13px] font-mono">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#A78BFA]" />
            <span className="text-[#CBD5E1]">h·f =</span>
            <span ref={hfHudRef} className="text-white">5.38 eV</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] font-mono">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#EF4444]" />
            <span className="text-[#CBD5E1]">W =</span>
            <span ref={wHudRef} className="text-white">4.30 eV</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] font-mono pt-1 border-t border-[#1E293B]">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#22D3EE]" />
            <span className="text-[#22D3EE]">K =</span>
            <span ref={kHudRef} className="text-white font-bold">1.08 eV</span>
          </div>
          <div className="text-[10px] font-mono text-[#64748B] pt-1">
            metal: <span ref={metalHudRef} className="text-[#CBD5E1]">Zn · Zinc</span>
          </div>
        </div>
      </div>
    </div>
  );
}
