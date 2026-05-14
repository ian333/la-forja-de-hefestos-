/**
 * MillikanDataScene — 10 años de medidas convergiendo.
 *
 *   Millikan jura refutar a Einstein en 1907. Acumula datos año por año.
 *   Cada año, el plot K vs f gana puntos. La pendiente de regresión
 *   converge cada vez más exactamente a h = 4.136e-15 eV·s.
 *
 *   El año avanza en pantalla 1907 → 1916. La pendiente medida se actualiza
 *   en vivo. Visualizar la derrota más honorable de la historia: querer
 *   refutar, y confirmar.
 *
 *   Fase: '10-millikan'
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Props { phase?: string }

const H_eVs = 4.136e-15;
const FREQ_UNIT = 1e14;
const W_eV = 4.30;          // zinc para coincidir con el ledger
const F_MIN = 10;
const F_MAX = 18;
const K_MIN = -1;
const K_MAX = 4;

const YEARS = [1907, 1908, 1909, 1910, 1911, 1912, 1913, 1914, 1915, 1916];

// Mapeo plot → world
function plotX(f: number): number { return (f - F_MIN) / (F_MAX - F_MIN) * 6 - 3; }
function plotY(K: number): number { return (K - K_MIN) / (K_MAX - K_MIN) * 4 - 1.5; }

// Generador determinístico de puntos: 8 puntos por año, dispersión que se
// reduce cada año (mejor instrumentación)
interface DataPoint { f: number; K: number; year: number }
function generateDataset(): DataPoint[] {
  const pts: DataPoint[] = [];
  // semilla determinística
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280 - 0.5;
  };
  YEARS.forEach((year, yi) => {
    const dispersion = 0.55 - yi * 0.045;     // 0.55 → 0.16 eV
    for (let i = 0; i < 8; i++) {
      const f = F_MIN + 1 + (i / 7) * (F_MAX - F_MIN - 2);
      const Ktrue = H_eVs * FREQ_UNIT * f - W_eV;
      const noise = rand() * dispersion;
      pts.push({ f, K: Math.max(K_MIN + 0.1, Ktrue + noise), year });
    }
  });
  return pts;
}

const DATASET = generateDataset();

// Regresión lineal simple sobre puntos visibles
function fitSlope(points: DataPoint[]): { slope: number; intercept: number } {
  if (points.length < 2) return { slope: 0.4, intercept: 0 };
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of points) {
    const f = p.f * FREQ_UNIT;
    const K_J = p.K * 1.602e-19;       // eV → J (para que slope venga en J·s)
    sumX += f;
    sumY += K_J;
    sumXY += f * K_J;
    sumXX += f * f;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  // slope viene en J·s (= h SI)
  return { slope, intercept };
}

function Axes() {
  const xPts = useMemo<[number, number, number][]>(
    () => [[plotX(F_MIN), plotY(0), 0], [plotX(F_MAX), plotY(0), 0]], [],
  );
  const yPts = useMemo<[number, number, number][]>(
    () => [[plotX(F_MIN), plotY(K_MIN), 0], [plotX(F_MIN), plotY(K_MAX), 0]], [],
  );
  const xTicks: number[] = [];
  for (let f = 11; f <= F_MAX; f += 1) xTicks.push(f);
  const yTicks: number[] = [];
  for (let k = 0; k <= K_MAX; k += 1) yTicks.push(k);
  return (
    <group>
      <Line points={xPts} color="#94A3B8" lineWidth={1.5} />
      <Line points={yPts} color="#94A3B8" lineWidth={1.5} />
      {xTicks.map((f) => (
        <group key={f}>
          <Line
            points={[[plotX(f), plotY(0) - 0.07, 0], [plotX(f), plotY(0) + 0.07, 0]] as any}
            color="#64748B"
            lineWidth={1}
          />
          <Text position={[plotX(f), plotY(0) - 0.32, 0]} fontSize={0.16} color="#94A3B8" anchorX="center" anchorY="top">
            {`${f}`}
          </Text>
        </group>
      ))}
      {yTicks.map((k) => (
        <group key={k}>
          <Line
            points={[[plotX(F_MIN) - 0.07, plotY(k), 0], [plotX(F_MIN) + 0.07, plotY(k), 0]] as any}
            color="#64748B"
            lineWidth={1}
          />
          <Text position={[plotX(F_MIN) - 0.25, plotY(k), 0]} fontSize={0.16} color="#94A3B8" anchorX="right" anchorY="middle">
            {`${k}`}
          </Text>
        </group>
      ))}
      <Text position={[plotX(F_MAX), plotY(0) - 0.7, 0]} fontSize={0.18} color="#CBD5E1" anchorX="right" anchorY="top">
        f  [ × 10¹⁴ Hz ]
      </Text>
      <Text position={[plotX(F_MIN) - 0.6, plotY(K_MAX), 0]} fontSize={0.18} color="#CBD5E1" anchorX="right" anchorY="middle">
        K_max [eV]
      </Text>
    </group>
  );
}

function DataPoints({ year }: { year: number }) {
  const visible = useMemo(() => DATASET.filter(p => p.year <= year), [year]);
  return (
    <group>
      {visible.map((p, i) => {
        const yearAge = year - p.year;
        const opacity = yearAge < 1 ? 1.0 : 0.55 + Math.max(0, 0.45 - yearAge * 0.04);
        const color = yearAge < 0.4 ? '#FACC15' : '#FB923C';
        return (
          <mesh key={i} position={[plotX(p.f), plotY(p.K), 0.02]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.7}
              transparent
              opacity={opacity}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function FitLine({ year }: { year: number }) {
  const visible = useMemo(() => DATASET.filter(p => p.year <= year), [year]);
  const { slope } = useMemo(() => fitSlope(visible), [visible]);
  // pendiente en J·s, convertir a eV·s para usar misma escala
  const slope_eVs = slope / 1.602e-19;
  // recta: K(f) = slope_eVs * f * FREQ_UNIT - W_estimated
  // intercepto se elige para minimizar residuos
  const { intercept } = useMemo(() => fitSlope(visible), [visible]);
  const W_est = -intercept / 1.602e-19;   // en eV
  const pts = useMemo<[number, number, number][]>(() => {
    const f0 = F_MIN;
    const f1 = F_MAX;
    const K0 = slope_eVs * f0 * FREQ_UNIT - W_est;
    const K1 = slope_eVs * f1 * FREQ_UNIT - W_est;
    return [
      [plotX(f0), plotY(Math.max(K_MIN, K0)), 0.01],
      [plotX(f1), plotY(Math.min(K_MAX, K1)), 0.01],
    ];
  }, [slope_eVs, W_est]);
  if (visible.length < 2) return null;
  return <Line points={pts} color="#22D3EE" lineWidth={3} transparent opacity={0.9} />;
}

function Scene({ year }: { year: number }) {
  return (
    <>
      <ambientLight intensity={1.0} />
      <Axes />
      <DataPoints year={year} />
      <FitLine year={year} />
    </>
  );
}

export default function MillikanDataScene({ phase: _phase = '10-millikan' }: Props) {
  const [year, setYear] = useState(1907);
  const slopeHudRef = useRef<HTMLSpanElement>(null);
  const errorHudRef = useRef<HTMLSpanElement>(null);
  const yearHudRef  = useRef<HTMLSpanElement>(null);
  const verdictRef  = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // avanza 1 año cada 1.2 segundos (12s total)
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const yi = Math.min(YEARS.length - 1, Math.floor(elapsed / 1.2));
      const y = YEARS[yi];
      setYear(y);
      // calcula slope visible
      const visible = DATASET.filter(p => p.year <= y);
      const { slope } = fitSlope(visible);
      const slope_eVs = slope / 1.602e-19;
      const slope_Js = slope;
      const h_real = 6.626e-34;
      const errorPct = Math.abs(slope_Js - h_real) / h_real * 100;
      if (slopeHudRef.current) slopeHudRef.current.textContent = `${(slope_Js * 1e34).toFixed(3)} × 10⁻³⁴ J·s`;
      if (errorHudRef.current) errorHudRef.current.textContent = `${errorPct.toFixed(1)}% vs h teórica`;
      if (yearHudRef.current)  yearHudRef.current.textContent  = `${y}`;
      if (verdictRef.current) {
        if (errorPct < 5) verdictRef.current.textContent = '✓ confirmado · Einstein tenía razón';
        else if (errorPct < 15) verdictRef.current.textContent = '· acercándose · 5 años más';
        else verdictRef.current.textContent = '· demasiada dispersión · sigue midiendo';
      }
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
      <Canvas camera={{ position: [0, 0.5, 7.2], fov: 38 }}>
        <Scene year={year} />
        <OrbitControls enableDamping enableZoom={false} enablePan={false} enableRotate={false} target={[0, 0.5, 0]} />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#22D3EE] tracking-[0.3em] uppercase">
          Robert Millikan · refuta a Einstein
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">
          10 años acumulando puntos · pendiente → h
        </div>
      </div>

      {/* Año vivo */}
      <div className="absolute top-6 left-6 pointer-events-none">
        <div className="px-5 py-2 rounded-md border border-[#FACC15]/40 bg-black/55 backdrop-blur-sm">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#FACC15]">año</div>
          <div className="text-[32px] font-mono leading-none font-bold text-white">
            <span ref={yearHudRef}>1907</span>
          </div>
        </div>
      </div>

      {/* HUD slope */}
      <div className="absolute bottom-6 right-6 pointer-events-none">
        <div className="px-5 py-3 rounded-md border border-[#22D3EE]/30 bg-black/55 backdrop-blur-sm space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#22D3EE]">
            Mejor ajuste · pendiente medida
          </div>
          <div className="text-[15px] font-mono text-white">
            h_medida = <span ref={slopeHudRef} className="text-[#FDB813] font-bold">6.50 × 10⁻³⁴ J·s</span>
          </div>
          <div className="text-[11px] font-mono text-[#94A3B8]">
            <span ref={errorHudRef}>3.2% vs h teórica</span>
          </div>
          <div className="text-[10px] font-mono pt-1 border-t border-[#1E293B]">
            <span ref={verdictRef} className="text-[#22D3EE]">· acercándose · 5 años más</span>
          </div>
          <div className="text-[10px] font-mono text-[#64748B] pt-1">
            h_teórica · Planck = 6.626 × 10⁻³⁴ J·s
          </div>
        </div>
      </div>
    </div>
  );
}
