/**
 * PhotoelectricPlotScene — la línea recta de Einstein.
 *
 * Grafica K_max vs f, varios metales (Cs, K, Zn, Pt). La pendiente es
 * exactamente h, la constante de Planck. Cada metal tiene su f_0 = W/h
 * propio.
 *
 * Phase-awareness:
 *   - '10-prediccion' : solo la recta predicha (zinc), sin datos
 *   - '11-millikan'   : datos de Millikan caen sobre la recta predicha
 *   - '14-trabajo'    : aparecen 4 metales (Cs · K · Zn · Pt)
 *   - '18-legado'     : vista final con cita del paper
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  phase?: string;
}

const H_eVs = 4.136e-15;          // h en eV·s
const FREQ_UNIT = 1e14;           // eje x en unidades de 10^14 Hz

interface Metal {
  name: string;
  W_eV: number;
  color: string;
  // Cuándo aparece (fase mínima)
  showFromPhase: '10-prediccion' | '11-millikan' | '14-trabajo' | '18-legado';
}

const METALS: Metal[] = [
  { name: 'Zn (4.30 eV)', W_eV: 4.30, color: '#22D3EE', showFromPhase: '10-prediccion' },
  { name: 'Cs (1.95 eV)', W_eV: 1.95, color: '#FDB813', showFromPhase: '14-trabajo' },
  { name: 'K (2.30 eV)',  W_eV: 2.30, color: '#FB923C', showFromPhase: '14-trabajo' },
  { name: 'Pt (5.65 eV)', W_eV: 5.65, color: '#A78BFA', showFromPhase: '14-trabajo' },
];

// Plot bounds
const F_MIN = 0;
const F_MAX = 16;     // 16 × 10^14 Hz
const K_MIN = -3;     // permitimos negativo para mostrar la prolongación de la recta
const K_MAX = 6;

// Mapeo (frecuencia normalizada, K) → coordenadas 3D
function plotX(f: number): number {
  return (f - F_MIN) / (F_MAX - F_MIN) * 8 - 4;     // x in [-4, 4]
}
function plotY(K: number): number {
  return (K - K_MIN) / (K_MAX - K_MIN) * 5 - 2;     // y in [-2, 3]
}

function Axes() {
  const xPts = useMemo<[number, number, number][]>(
    () => [[plotX(F_MIN), plotY(0), 0], [plotX(F_MAX), plotY(0), 0]],
    [],
  );
  const yPts = useMemo<[number, number, number][]>(
    () => [[plotX(0), plotY(K_MIN), 0], [plotX(0), plotY(K_MAX), 0]],
    [],
  );

  // ticks x cada 2 unidades
  const xTicks: number[] = [];
  for (let f = 2; f <= F_MAX; f += 2) xTicks.push(f);
  // ticks y cada 1 eV
  const yTicks: number[] = [];
  for (let k = 0; k <= K_MAX; k += 1) yTicks.push(k);

  return (
    <group>
      <Line points={xPts} color="#94A3B8" lineWidth={1.5} />
      <Line points={yPts} color="#94A3B8" lineWidth={1.5} />

      {xTicks.map((f, i) => (
        <group key={`xt-${i}`}>
          <Line
            points={[[plotX(f), plotY(0) - 0.1, 0], [plotX(f), plotY(0) + 0.1, 0]] as any}
            color="#64748B"
            lineWidth={1}
          />
          <Text
            position={[plotX(f), plotY(0) - 0.35, 0]}
            fontSize={0.18}
            color="#94A3B8"
            anchorX="center"
            anchorY="top"
          >
            {f}
          </Text>
        </group>
      ))}

      {yTicks.map((k, i) => (
        <group key={`yt-${i}`}>
          <Line
            points={[[plotX(0) - 0.1, plotY(k), 0], [plotX(0) + 0.1, plotY(k), 0]] as any}
            color="#64748B"
            lineWidth={1}
          />
          <Text
            position={[plotX(0) - 0.25, plotY(k), 0]}
            fontSize={0.18}
            color="#94A3B8"
            anchorX="right"
            anchorY="middle"
          >
            {k}
          </Text>
        </group>
      ))}

      <Text
        position={[plotX(F_MAX), plotY(0) - 0.7, 0]}
        fontSize={0.22}
        color="#CBD5E1"
        anchorX="right"
        anchorY="top"
      >
        f  [ × 10¹⁴ Hz ]
      </Text>
      <Text
        position={[plotX(0) - 0.7, plotY(K_MAX), 0]}
        fontSize={0.22}
        color="#CBD5E1"
        anchorX="right"
        anchorY="middle"
      >
        K_max  [ eV ]
      </Text>
    </group>
  );
}

function MetalLine({ metal, opacity }: { metal: Metal; opacity: number }) {
  const f0 = metal.W_eV / (H_eVs * FREQ_UNIT);     // umbral en unidades 10^14 Hz
  const pts = useMemo<[number, number, number][]>(() => {
    // empieza en (f0, 0), termina en (F_MAX, K(F_MAX))
    const K_end = H_eVs * FREQ_UNIT * F_MAX - metal.W_eV;
    return [
      [plotX(f0), plotY(0), 0],
      [plotX(F_MAX), plotY(K_end), 0],
    ];
  }, [metal.W_eV]);

  // Marca el umbral con un círculo abierto
  return (
    <group>
      <Line points={pts} color={metal.color} lineWidth={2.5} transparent opacity={opacity} />
      <mesh position={[plotX(f0), plotY(0), 0.02]}>
        <ringGeometry args={[0.08, 0.13, 24]} />
        <meshBasicMaterial color={metal.color} transparent opacity={opacity} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[plotX(f0), plotY(0) + 0.45, 0]}
        fontSize={0.16}
        color={metal.color}
        anchorX="center"
        anchorY="middle"
        material-toneMapped={false}
      >
        {`f₀=${f0.toFixed(1)}`}
      </Text>
    </group>
  );
}

function MillikanPoints({ visible }: { visible: boolean }) {
  // Datos sintéticos sobre la recta del zinc, con dispersión ±0.15 eV
  const points = useMemo(() => {
    const W = 4.30;
    const out: { f: number; K: number }[] = [];
    for (let f = 11; f <= 15.5; f += 0.5) {
      const Ktrue = H_eVs * FREQ_UNIT * f - W;
      const noise = (Math.random() - 0.5) * 0.18;
      out.push({ f, K: Math.max(0, Ktrue + noise) });
    }
    return out;
  }, []);

  if (!visible) return null;
  return (
    <group>
      {points.map((p, i) => (
        <mesh key={i} position={[plotX(p.f), plotY(p.K), 0.03]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial
            color="#FACC15"
            emissive="#FACC15"
            emissiveIntensity={2.0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ phase }: { phase: string }) {
  // Visibilidad por metal según fase (cambio React state, no useFrame)
  const opacities = useMemo<Record<string, number>>(() => {
    switch (phase) {
      case '10-prediccion': return { 'Zn (4.30 eV)': 1, 'Cs (1.95 eV)': 0, 'K (2.30 eV)': 0, 'Pt (5.65 eV)': 0 };
      case '11-millikan':   return { 'Zn (4.30 eV)': 1, 'Cs (1.95 eV)': 0, 'K (2.30 eV)': 0, 'Pt (5.65 eV)': 0 };
      case '14-trabajo':    return { 'Zn (4.30 eV)': 1, 'Cs (1.95 eV)': 1, 'K (2.30 eV)': 1, 'Pt (5.65 eV)': 1 };
      case '18-legado':     return { 'Zn (4.30 eV)': 1, 'Cs (1.95 eV)': 1, 'K (2.30 eV)': 1, 'Pt (5.65 eV)': 1 };
      default:              return { 'Zn (4.30 eV)': 1, 'Cs (1.95 eV)': 0, 'K (2.30 eV)': 0, 'Pt (5.65 eV)': 0 };
    }
  }, [phase]);
  const showMillikan = phase === '11-millikan' || phase === '18-legado';

  return (
    <group>
      <ambientLight intensity={1.0} />
      <Axes />
      {METALS.map((m) => (
        opacities[m.name] > 0
          ? <MetalLine key={m.name} metal={m} opacity={opacities[m.name]} />
          : null
      ))}
      <MillikanPoints visible={showMillikan} />
    </group>
  );
}

export default function PhotoelectricPlotScene({ phase = '10-prediccion' }: Props) {
  const captionByPhase: Record<string, string> = {
    '10-prediccion': 'predicción · K = h·f − W · línea recta',
    '11-millikan':   'Millikan 1916 · datos caen sobre la recta · pendiente = h',
    '14-trabajo':    'función trabajo W · cada metal su propia f₀',
    '18-legado':     'Annalen der Physik · vol. 17 · 1905',
  };
  const caption = captionByPhase[phase] ?? '';

  const showPaper = phase === '18-legado';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #0A1628 0%, #03050A 85%)' }}
    >
      <Canvas camera={{ position: [0, 0.5, 7.2], fov: 38 }}>
        <Scene phase={phase} />
        <OrbitControls
          enableDamping
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#22D3EE] tracking-[0.3em] uppercase">
          K_max  vs  frecuencia  ·  pendiente = h
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>

      {/* Legend per metal */}
      <div className="absolute bottom-6 left-6 pointer-events-none">
        <div className="text-[10px] font-mono text-[#475569] uppercase tracking-[0.2em] mb-1">
          Metales · f₀ = W / h
        </div>
        {METALS.filter(m =>
          phase === '14-trabajo' || phase === '18-legado' ||
          (m.name.startsWith('Zn') && (phase === '10-prediccion' || phase === '11-millikan'))
        ).map(m => (
          <div key={m.name} className="flex items-center gap-2 text-[10px] font-mono mt-1">
            <span className="inline-block w-4 h-0.5" style={{ background: m.color }} />
            <span className="text-[#CBD5E1]">{m.name}</span>
          </div>
        ))}
      </div>

      {/* Paper citation */}
      {showPaper && (
        <div className="absolute top-8 right-8 max-w-[320px] pointer-events-auto">
          <div className="px-4 py-3 rounded-md border border-[#FDB813]/30 bg-black/60 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-[#FDB813] uppercase tracking-[0.2em] mb-1">
              Paper original · público
            </div>
            <div className="text-[12px] font-mono text-white leading-snug mb-2">
              A. Einstein — <em>Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt</em>
            </div>
            <div className="text-[10px] font-mono text-[#94A3B8]">
              Annalen der Physik <strong>17</strong> (1905) 132–148
            </div>
            <div className="mt-2 text-[10px] font-mono">
              <a
                href="https://onlinelibrary.wiley.com/doi/10.1002/andp.19053220607"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#22D3EE] hover:underline"
              >
                DOI 10.1002/andp.19053220607 ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
