/**
 * AeroFuerzas — ESCUELA AERO a1-l1/a1-l5: "Solo hay DOS manos: p y τ".
 *
 * El Ejemplo 1.1 de Anderson (§1.5) EN VIVO: la cuña de 5° a Mach 2 con
 * sus dos únicas fuerzas visibles — presión (cian, ⊥ a cada cara) y
 * cortante (ámbar, tangente, τ = 431·s^−0.2) — y la integral por paneles
 * convergiendo al número del libro: D′ = 1.24×10⁴ N/m, c_d = 0.022.
 * La onda de choque oblicua se dibuja en su ángulo REAL β(M,θ) de la
 * relación θ-β-M (≈34.3°), no decorativo.
 *
 * Hook de escuela: window.__aeroLab = { set(k,v), estado } — clase-drive
 * maneja el lab y los checks leen la física exacta.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import Stage from '@/physics/components/Stage';
import { cunaAnderson, betaChoqueOblicuo, CUNA_ANDERSON } from '@/aero/cuna-anderson';

const DELTA = CUNA_ANDERSON.delta;
const C = CUNA_ANDERSON.c;           // 2 m — se dibuja a escala 1 u = 1 m
const H = C * Math.tan(DELTA);       // semialtura de la base

interface Estado { n: number; presion: boolean; cortante: boolean; choque: boolean }

// ── flecha instanciada simple (cilindro + cono) ─────────────────────────────
function Flecha({ from, dir, len, color, grosor = 0.014 }: {
  from: [number, number, number]; dir: [number, number, number]; len: number;
  color: string; grosor?: number;
}) {
  const quat = useMemo(() => {
    const d = new THREE.Vector3(...dir).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  }, [dir]);
  const shaft = Math.max(0.02, len - 0.07);
  return (
    <group position={from} quaternion={quat}>
      <mesh position={[0, shaft / 2, 0]}>
        <cylinderGeometry args={[grosor, grosor, shaft, 8]} />
        <meshStandardMaterial color="#08121E" emissive={color} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, shaft + 0.035, 0]}>
        <coneGeometry args={[grosor * 2.6, 0.07, 10]} />
        <meshStandardMaterial color="#08121E" emissive={color} emissiveIntensity={2.0} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Escena({ est }: { est: Estado }) {
  // cuña: vértice en (−c/2, 0), base en x=+c/2 de −H a +H, extruida en z
  const geo = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-C / 2, 0);
    sh.lineTo(C / 2, H);
    sh.lineTo(C / 2, -H);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: false });
    g.translate(0, 0, -0.65);
    return g;
  }, []);

  const beta = useMemo(() => betaChoqueOblicuo(CUNA_ANDERSON.mach, DELTA), []);

  // flechas de presión: constantes sobre cada cara (el choque las fijó en pCara)
  const flechasP = useMemo(() => {
    const out: { from: [number, number, number]; dir: [number, number, number]; len: number }[] = [];
    const NP = 7;
    for (let i = 0; i < NP; i++) {
      const f = (i + 0.5) / NP;
      const x = -C / 2 + f * C;
      const yU = f * H, yL = -f * H;
      // normal exterior de la cara superior: (−sinδ, cosδ) → la presión EMPUJA hacia dentro
      const nU: [number, number, number] = [Math.sin(DELTA), -Math.cos(DELTA), 0];
      const nL: [number, number, number] = [Math.sin(DELTA), Math.cos(DELTA), 0];
      const len = 0.34; // ∝ pCara (constante — ESA es la lección)
      out.push({ from: [x - nU[0] * len * 1.0, yU - nU[1] * len - 0 * 1.0, 0], dir: nU, len });
      out.push({ from: [x - nL[0] * len * 1.0, yL - nL[1] * len, 0], dir: nL, len });
    }
    // base a p∞: empuja hacia −x (succión de culata relativa)
    for (let i = 0; i < 3; i++) {
      const y = -H + ((i + 0.5) / 3) * 2 * H;
      const len = 0.26; // ∝ p∞ < pCara
      out.push({ from: [C / 2 + len, y, 0], dir: [-1, 0, 0], len });
    }
    return out;
  }, []);

  // flechas de cortante: tangentes, largo ∝ τ = 431·s^−0.2 (¡decae!)
  const flechasT = useMemo(() => {
    const out: { from: [number, number, number]; dir: [number, number, number]; len: number }[] = [];
    const NT = 8;
    const L = C / Math.cos(DELTA);
    for (let i = 0; i < NT; i++) {
      const s = ((i + 0.5) / NT) * L;
      const tau = CUNA_ANDERSON.tauK * Math.pow(s, CUNA_ANDERSON.tauExp);
      const len = 0.10 + 0.16 * (tau / (CUNA_ANDERSON.tauK * Math.pow(0.08, CUNA_ANDERSON.tauExp)));
      const f = s / L;
      const tU: [number, number, number] = [Math.cos(DELTA), Math.sin(DELTA), 0];
      const tL: [number, number, number] = [Math.cos(DELTA), -Math.sin(DELTA), 0];
      out.push({ from: [-C / 2 + f * C, f * H + 0.02, 0.66], dir: tU, len });
      out.push({ from: [-C / 2 + f * C, -f * H - 0.02, 0.66], dir: tL, len });
    }
    return out;
  }, []);

  return (
    <>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#9AA8BC" emissive="#26456E" emissiveIntensity={0.16}
          metalness={0.35} roughness={0.5} />
      </mesh>

      {/* onda de choque REAL: β de θ-β-M desde el vértice (par superior/inferior) */}
      {est.choque && (
        <group position={[-C / 2, 0, 0]}>
          {[1, -1].map((s) => (
            <mesh key={s} rotation={[0, 0, s * beta]} position={[Math.cos(s * beta) * 1.4, Math.sin(s * beta) * 1.4, 0]}>
              <planeGeometry args={[2.8, 1.6]} />
              <meshBasicMaterial color="#FF7A3C" transparent opacity={0.16}
                blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      )}

      {est.presion && flechasP.map((a, i) => (
        <Flecha key={`p${i}`} from={a.from} dir={a.dir} len={a.len} color="#46C2FF" />
      ))}
      {est.cortante && flechasT.map((a, i) => (
        <Flecha key={`t${i}`} from={a.from} dir={a.dir} len={a.len} color="#FDB813" grosor={0.010} />
      ))}
    </>
  );
}

export default function AeroFuerzas() {
  const [n, setN] = useState(20);
  const [presion, setPresion] = useState(false);
  const [cortante, setCortante] = useState(false);
  const [choque, setChoque] = useState(false);

  const r = useMemo(() => cunaAnderson(n), [n]);
  const beta = useMemo(() => betaChoqueOblicuo(CUNA_ANDERSON.mach, DELTA) * 180 / Math.PI, []);

  // hook de escuela — clase-drive maneja y verifica por aquí
  useEffect(() => {
    (window as unknown as { __aeroLab?: unknown }).__aeroLab = {
      set: (k: string, v: number | boolean) => {
        if (k === 'n') setN(Number(v));
        if (k === 'presion') setPresion(Boolean(v));
        if (k === 'cortante') setCortante(Boolean(v));
        if (k === 'choque') setChoque(Boolean(v));
      },
      estado: {
        modulo: 'aero-fuerzas', n, presion, cortante, choque,
        Dp: r.Dp, Df: r.Df, D: r.D, q: r.q, cd: r.cd,
        fraccionPresion: r.fraccionPresion, betaDeg: beta,
        pCara: CUNA_ANDERSON.pCara, tauK: CUNA_ANDERSON.tauK,
      },
    };
  }, [n, presion, cortante, choque, r, beta]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={3.4} autoRotate={false} bloomIntensity={0.8} bloomThreshold={0.25}>
          <Escena est={{ n, presion, cortante, choque }} />
        </Stage>

        {/* HUD: la integral EN VIVO vs el libro */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/85 backdrop-blur border border-[#1E293B] px-4 py-3 font-mono text-[11px] text-[#CBD5E1] space-y-1">
          <div className="text-[#64748B] uppercase tracking-wider text-[9px]">Anderson Ej. 1.1 · cuña 5° · Mach 2</div>
          <div><span className="text-[#64748B]">paneles </span>= <span data-live="n">{n}</span></div>
          <div><span className="text-[#64748B]">D′ pres </span>= {(r.Dp / 1e4).toFixed(3)}×10⁴ N/m</div>
          <div><span className="text-[#64748B]">D′ fric </span>= {(r.Df / 1e4).toFixed(4)}×10⁴ N/m</div>
          <div><span className="text-[#64748B]">D′ total</span>= <span className="text-[#4ADE80]" data-live="D">{(r.D / 1e4).toFixed(3)}×10⁴</span> <span className="text-[#64748B]">(libro: 1.240×10⁴)</span></div>
          <div><span className="text-[#64748B]">c_d&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#4ADE80]" data-live="cd">{r.cd.toFixed(4)}</span> <span className="text-[#64748B]">(libro: 0.022)</span></div>
          <div><span className="text-[#64748B]">presión </span>= {(r.fraccionPresion * 100).toFixed(0)}% del arrastre</div>
        </div>
      </div>

      <div className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <div className="p-4 border-b border-[#1E293B]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">Las dos manos</div>
          <button data-testid="chk-presion" onClick={() => setPresion(!presion)}
            className={`w-full flex items-center justify-between px-3 py-2 mb-1.5 rounded-md border text-[11px] ${presion ? 'bg-[#0E2A40]/60 border-[#46C2FF]/40 text-[#7DD3FC]' : 'border-[#1E293B] text-[#64748B]'}`}>
            <span>Presión p (⊥ a la cara)</span><span className={`w-2 h-2 rounded-full ${presion ? 'bg-[#46C2FF]' : 'bg-[#334155]'}`} />
          </button>
          <button data-testid="chk-cortante" onClick={() => setCortante(!cortante)}
            className={`w-full flex items-center justify-between px-3 py-2 mb-1.5 rounded-md border text-[11px] ${cortante ? 'bg-[#3A2E08]/60 border-[#FDB813]/40 text-[#FDE68A]' : 'border-[#1E293B] text-[#64748B]'}`}>
            <span>Cortante τ = 431·s^−0.2</span><span className={`w-2 h-2 rounded-full ${cortante ? 'bg-[#FDB813]' : 'bg-[#334155]'}`} />
          </button>
          <button data-testid="chk-choque" onClick={() => setChoque(!choque)}
            className={`w-full flex items-center justify-between px-3 py-2 mb-1.5 rounded-md border text-[11px] ${choque ? 'bg-[#3A140A]/60 border-[#FF7A3C]/40 text-[#FDBA74]' : 'border-[#1E293B] text-[#64748B]'}`}>
            <span>Onda de choque (β = {beta.toFixed(1)}°)</span><span className={`w-2 h-2 rounded-full ${choque ? 'bg-[#FF7A3C]' : 'bg-[#334155]'}`} />
          </button>
        </div>

        <div className="p-4 border-b border-[#1E293B]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">La integral (ec. 1.8)</div>
          <div className="flex items-baseline justify-between text-[11px] font-mono mb-1">
            <span className="text-[#64748B]">paneles por cara</span><span className="text-white">{n}</span>
          </div>
          <input data-testid="input-paneles" type="range" min={4} max={400} step={2} value={n}
            onChange={(e) => setN(Number(e.target.value))} className="w-full" />
          <div className="text-[10px] text-[#64748B] mt-2 leading-snug">
            D′ = ∮(−p·n̂ + τ·t̂)·x̂ ds — no hay tercera fuerza. Sube los paneles y
            mira la suma clavarse en el número del libro.
          </div>
        </div>

        <div className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">Los números del libro</div>
          <div className="text-[11px] font-mono text-[#CBD5E1] space-y-1.5">
            <div>q∞ = 2.847×10⁵ Pa</div>
            <div>D′ = 1.24×10⁴ N/m</div>
            <div>c_d = D′/(q∞·S) = 0.022</div>
            <div className="text-[#64748B]">85% presión (choque) · 15% fricción</div>
          </div>
        </div>
      </div>
    </div>
  );
}
