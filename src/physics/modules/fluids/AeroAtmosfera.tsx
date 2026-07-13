/**
 * AeroAtmosfera — ESCUELA AERO a1-l4: la atmósfera estándar ISA.
 *
 * "De aquí sale TODO": la ρ de L = ½ρV²S·CL y la a del número de Mach viven
 * en esta columna de aire. Troposfera: T = 288.15 − 6.5·h[km]; presión por
 * hidrostática+gas ideal (exponente 5.256); estratosfera isoterma a 216.65 K.
 * Física: src/aero/atmosfera.ts (testeada contra la tabla ISO 2533/Anderson
 * Ap. D — 8/8). El avión sube por la columna y los números responden.
 *
 * Hook de escuela: window.__aeroLab = { set('h', m), estado }.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import Stage from '@/physics/components/Stage';
import { atmosferaISA, ISA } from '@/aero/atmosfera';

const H_MAX = 20000;
const ALTO = 4.2;              // altura visual de la columna [u]
const y0 = -2.0;               // base de la columna
const hAy = (h: number) => y0 + (h / H_MAX) * ALTO;

function Columna({ h }: { h: number }) {
  // columna de "aire": rebanadas translúcidas coloreadas por densidad REAL
  const rebanadas = useMemo(() => {
    const out: { y: number; grosor: number; color: THREE.Color; op: number }[] = [];
    const N = 40;
    for (let i = 0; i < N; i++) {
      const hh = ((i + 0.5) / N) * H_MAX;
      const rho = atmosferaISA(hh).rho;
      const f = rho / ISA.rho0; // 1 → 0.07 arriba
      out.push({
        y: hAy(hh), grosor: ALTO / N,
        color: new THREE.Color(0.10 + 0.25 * f, 0.22 + 0.42 * f, 0.55 + 0.45 * f),
        op: 0.05 + 0.5 * f,
      });
    }
    return out;
  }, []);

  const tropo = hAy(ISA.h11);
  return (
    <group>
      {rebanadas.map((r, i) => (
        <mesh key={i} position={[0, r.y, 0]}>
          <cylinderGeometry args={[1.15, 1.15, r.grosor * 0.96, 36, 1, true]} />
          <meshBasicMaterial color={r.color} transparent opacity={r.op}
            blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* tropopausa: el anillo donde el gradiente se APAGA (11 km, 216.65 K) */}
      <mesh position={[0, tropo, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.18, 0.012, 8, 64]} />
        <meshStandardMaterial color="#0E1E3A" emissive="#7EB8FF" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>

      {/* suelo */}
      <mesh position={[0, y0 - 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 48]} />
        <meshStandardMaterial color="#1A2433" emissive="#233B2A" emissiveIntensity={0.25} />
      </mesh>

      {/* EL AVIÓN a su altitud (cono + alas mínimas, emisivo para el bloom) */}
      <group position={[0, hAy(h), 0]}>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.09, 0.42, 12]} />
          <meshStandardMaterial color="#101820" emissive="#FDB813" emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.13, 0.02, 0.62]} />
          <meshStandardMaterial color="#101820" emissive="#FDB813" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
        <pointLight color="#FFD97A" intensity={0.8} distance={2.5} decay={2} />
      </group>
    </group>
  );
}

export default function AeroAtmosfera() {
  const [h, setH] = useState(0);
  const s = useMemo(() => atmosferaISA(h), [h]);

  useEffect(() => {
    (window as unknown as { __aeroLab?: unknown }).__aeroLab = {
      set: (k: string, v: number) => { if (k === 'h') setH(Math.max(0, Math.min(H_MAX, Number(v)))); },
      estado: { modulo: 'aero-atmosfera', h, T: s.T, p: s.p, rho: s.rho, a: s.aSonido },
    };
  }, [h, s]);

  const enEstratosfera = h > ISA.h11;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={5.6} autoRotate bloomIntensity={0.85} bloomThreshold={0.3}>
          <Columna h={h} />
        </Stage>

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/85 backdrop-blur border border-[#1E293B] px-4 py-3 font-mono text-[11px] text-[#CBD5E1] space-y-1">
          <div className="text-[#64748B] uppercase tracking-wider text-[9px]">ISA · ISO 2533 / Anderson Ap. D</div>
          <div><span className="text-[#64748B]">h&nbsp;&nbsp;&nbsp;</span>= <span data-live="h">{(h / 1000).toFixed(2)}</span> km</div>
          <div><span className="text-[#64748B]">T&nbsp;&nbsp;&nbsp;</span>= <span data-live="T">{s.T.toFixed(2)}</span> K ({(s.T - 273.15).toFixed(1)} °C)</div>
          <div><span className="text-[#64748B]">p&nbsp;&nbsp;&nbsp;</span>= <span data-live="p">{(s.p / 1000).toFixed(2)}</span> kPa</div>
          <div><span className="text-[#64748B]">ρ&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#4ADE80]" data-live="rho">{s.rho.toFixed(4)}</span> kg/m³</div>
          <div><span className="text-[#64748B]">a&nbsp;&nbsp;&nbsp;</span>= <span data-live="a">{s.aSonido.toFixed(1)}</span> m/s</div>
          <div className="text-[#64748B]">{enEstratosfera ? 'estratosfera: ISOTERMA 216.65 K' : 'troposfera: T cae 6.5 K/km'}</div>
        </div>
      </div>

      <div className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <div className="p-4 border-b border-[#1E293B]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">Altitud</div>
          <div className="flex items-baseline justify-between text-[11px] font-mono mb-1">
            <span className="text-[#64748B]">h</span><span className="text-white">{h.toFixed(0)} m</span>
          </div>
          <input data-testid="input-h" type="range" min={0} max={H_MAX} step={100} value={h}
            onChange={(e) => setH(Number(e.target.value))} className="w-full" />
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            <button data-testid="btn-h-mar" onClick={() => setH(0)}
              className="px-2 py-1.5 rounded border border-[#1E293B] text-[10px] text-[#94A3B8] hover:border-[#334155]">nivel del mar</button>
            <button data-testid="btn-h-tropopausa" onClick={() => setH(11000)}
              className="px-2 py-1.5 rounded border border-[#1E293B] text-[10px] text-[#94A3B8] hover:border-[#334155]">tropopausa 11 km</button>
            <button data-testid="btn-h-crucero" onClick={() => setH(15000)}
              className="px-2 py-1.5 rounded border border-[#1E293B] text-[10px] text-[#94A3B8] hover:border-[#334155]">estratosfera 15 km</button>
          </div>
        </div>

        <div className="p-4 border-b border-[#1E293B]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">El modelo (nada ajustado)</div>
          <div className="text-[11px] font-mono text-[#CBD5E1] leading-relaxed space-y-1.5">
            <div>T = 288.15 − 6.5·h[km]</div>
            <div>p = p₀·(T/T₀)^5.256</div>
            <div className="text-[#64748B]">(hidrostática dp=−ρg·dh + gas ideal)</div>
            <div>ρ = p/(R·T)</div>
            <div>a = √(γRT)</div>
          </div>
        </div>

        <div className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">Por qué importa</div>
          <div className="text-[11px] text-[#94A3B8] leading-relaxed">
            A 11 km la densidad cae a un TERCIO del nivel del mar: tu ala genera
            un tercio de la sustentación a la misma velocidad. Por eso los jets
            cruzan rápido y alto — y por eso ρ(h) es la primera tabla de todo
            cálculo aeronáutico.
          </div>
        </div>
      </div>
    </div>
  );
}
