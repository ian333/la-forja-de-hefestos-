/**
 * BondTab — CAD-like para átomos.
 *
 * Viewport 3D ocupa TODA la pantalla disponible. Controles, gráficos
 * y datos son floating panels overlaid con glass morphism. Inspiración:
 * Fusion 360, Figma, SolidWorks — el canvas es el producto, el resto
 * orbita.
 *
 * Mejoras en este sprint:
 *   • Layout CAD (viewport full-screen + paneles flotantes colapsables)
 *   • Sampling dinámico durante animación — electrones realmente
 *     reorganizándose, el overlap bonding aparece en vivo
 *   • Paneles colapsables para liberar viewport al estudiar detalle
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MOLECULE_CATALOG, moleculeByFormula, setBondLength,
  bondOrder, totalElectrons,
  type Molecule3D,
} from '@/lib/chem/quantum/molecular-orbitals';
import MoleculeOrbitalView from './MoleculeOrbitalView';
import FloatingPanel from './FloatingPanel';

// ═══════════════════════════════════════════════════════════════
// MODELO FENOMENOLÓGICO — curva de Morse
// ═══════════════════════════════════════════════════════════════

interface MorseParams { De: number; re: number; a: number; }

const MORSE_BY_FORMULA: Record<string, MorseParams> = {
  'H₂':    { De: 4.75,   re: 1.40, a: 1.03 },
  'H₂⁺':   { De: 2.65,   re: 2.00, a: 0.73 },
  'HeH⁺':  { De: 2.04,   re: 1.46, a: 1.10 },
  'He₂':   { De: 0.0009, re: 5.60, a: 0.10 },
  'Li₂':   { De: 1.06,   re: 5.05, a: 0.47 },
  // Segunda fila — con enlaces múltiples y orbitales 2p
  'N₂':    { De: 9.76,   re: 2.074, a: 1.42 },  // triple bond — el más fuerte
  'O₂':    { De: 5.12,   re: 2.28,  a: 1.38 },  // double + 2 unpaired π*
  'HF':    { De: 5.87,   re: 1.733, a: 1.17 },  // polar, 3 lone pairs
  'CO':    { De: 11.09,  re: 2.132, a: 1.22 },  // triple polar — más fuerte que N₂
};

function morseEnergy(r: number, p: MorseParams): number {
  const exp = Math.exp(-p.a * (r - p.re));
  return p.De * Math.pow(1 - exp, 2) - p.De;
}

function phaseLabel(r: number, p: MorseParams): { text: string; color: string } {
  if (r > p.re * 3.5) return { text: '🔵 Átomos libres · sin interacción', color: '#94A3B8' };
  if (r > p.re * 2.0) return { text: '✨ Las nubes electrónicas comienzan a sentirse', color: '#7DD3FC' };
  if (r > p.re * 1.3) return { text: '🌀 Orbitales atómicos se superponen', color: '#4FC3F7' };
  if (r > p.re * 0.95) return { text: '🔗 Enlace formándose — densidad entre núcleos', color: '#60E063' };
  if (r > p.re * 0.8)  return { text: '✅ Enlace estable en el mínimo de energía', color: '#66BB6A' };
  if (r > p.re * 0.55) return { text: '⚠️ Núcleos repeliéndose — compresión', color: '#FBBF24' };
  return { text: '💥 Repulsión nuclear fuerte', color: '#EF4444' };
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function BondTab() {
  const [formula, setFormula] = useState('H₂');
  const baseMol = useMemo(
    () => moleculeByFormula(formula) ?? MOLECULE_CATALOG[0],
    [formula],
  );

  const [bondLength, setBondLengthState] = useState(baseMol.bondLength ?? 1.4);
  const [visibleMOKeys, setVisibleMOKeys] = useState<Set<number>>(
    new Set(baseMol.mos.map((_, i) => i).filter((i) => baseMol.mos[i].occupancy > 0)),
  );

  const [animating, setAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const [sliding, setSliding] = useState(false);
  const slideTimerRef = useRef<number | null>(null);

  const morseP = MORSE_BY_FORMULA[formula] ?? MORSE_BY_FORMULA['H₂'];

  const onSelectMolecule = (f: string) => {
    const m = moleculeByFormula(f);
    if (!m) return;
    stopAnimation();
    setFormula(f);
    setBondLengthState(m.bondLength ?? 1.4);
    setVisibleMOKeys(new Set(m.mos.map((_, i) => i).filter((i) => m.mos[i].occupancy > 0)));
  };

  const onBondLengthChange = (v: number) => {
    setBondLengthState(v);
    setSliding(true);
    if (slideTimerRef.current) window.clearTimeout(slideTimerRef.current);
    slideTimerRef.current = window.setTimeout(() => setSliding(false), 200);
  };

  const stopAnimation = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAnimating(false);
  };

  const animateTo = (from: number, to: number, durationMs = 2800) => {
    stopAnimation();
    setAnimating(true);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const r = from + (to - from) * eased;
      setBondLengthState(r);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setAnimating(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => stopAnimation(), []);

  const mol = useMemo(() => setBondLength(baseMol, bondLength), [baseMol, bondLength]);
  const visibleMOs = useMemo(() => Array.from(visibleMOKeys), [visibleMOKeys]);

  const toggleMO = (idx: number) => {
    setVisibleMOKeys((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const lowRes = sliding || animating;
  const phase = phaseLabel(bondLength, morseP);
  const currentE = morseEnergy(bondLength, morseP);

  return (
    <div
      className="relative -mx-6 -my-6 overflow-hidden"
      style={{ height: 'calc(100vh - 72px)' }}
    >
      {/* ═══════════════════ VIEWPORT A PANTALLA COMPLETA ═══════════════════ */}
      <div className="absolute inset-0">
        <MoleculeOrbitalView
          molecule={mol}
          height="100%"
          nPoints={13000}
          visibleMOs={visibleMOs}
          lowRes={lowRes}
          autoRotate={!animating}
        />
      </div>

      {/* ═══════════════════ HUD: fase actual (overlay central superior) ═══════════════════ */}
      <div
        className="absolute top-5 left-1/2 -translate-x-1/2 z-30 bg-black/70 backdrop-blur-md rounded-full px-4 py-2 text-[13px] font-semibold border border-white/10 transition-opacity"
        style={{ color: phase.color, opacity: animating || sliding ? 1 : 0.7 }}
      >
        {phase.text}
      </div>

      {/* ═══════════════════ TOP-LEFT: molécula + selector ═══════════════════ */}
      <FloatingPanel
        title="Molécula"
        icon="🧪"
        position="top-4 left-4"
        width="260px"
        accent="#4FC3F7"
      >
        <div className="mb-3">
          <div className="text-[28px] font-bold leading-none tracking-tight text-white">
            {mol.formula}
          </div>
          <div className="text-[12px] text-[#CBD5E1] mt-1">{mol.name}</div>
          {mol.description && (
            <div className="text-[11px] text-[#94A3B8] leading-snug mt-2">
              {mol.description}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1 max-h-[200px] overflow-y-auto pr-1">
          {MOLECULE_CATALOG.map((m) => {
            const active = m.formula === formula;
            return (
              <button
                key={m.formula}
                onClick={() => onSelectMolecule(m.formula)}
                title={m.name}
                className={`px-1 py-1.5 rounded text-center transition ${
                  active
                    ? 'bg-[#1E40AF]/50 ring-1 ring-[#4FC3F7]/60 text-white'
                    : 'bg-[#0B0F17]/60 border border-white/5 text-[#94A3B8] hover:text-white hover:border-white/20'
                }`}
              >
                <div className="font-bold text-[13px] leading-none">{m.formula}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 text-[9px] text-[#475569] font-mono text-center">
          {MOLECULE_CATALOG.length} moléculas disponibles
        </div>
      </FloatingPanel>

      {/* ═══════════════════ TOP-RIGHT: observables ═══════════════════ */}
      <FloatingPanel
        title="Observables"
        icon="📊"
        position="top-4 right-4"
        width="220px"
        accent="#FFB74D"
      >
        <dl className="space-y-1.5 text-[12px] font-mono">
          <Obs label="Electrones"     value={`${totalElectrons(mol)}`} />
          <Obs label="Orden enlace"   value={bondOrder(mol).toFixed(1)} />
          <Obs label="d(A-B)"         value={`${bondLength.toFixed(2)} a₀`} />
          <Obs label="d(A-B) Å"       value={`${(bondLength * 0.529).toFixed(2)} Å`} />
          <Obs label="E(r)"           value={`${currentE.toFixed(3)} eV`} accent="#4FC3F7" />
          <Obs label="Dₑ pozo"        value={`${morseP.De.toFixed(2)} eV`} />
          <Obs label="rₑ óptimo"      value={`${morseP.re.toFixed(2)} a₀`} />
        </dl>
      </FloatingPanel>

      {/* ═══════════════════ BOTTOM-LEFT: diagrama MO ═══════════════════ */}
      <FloatingPanel
        title="Orbitales moleculares"
        icon="⬢"
        position="bottom-20 left-4"
        width="300px"
        accent="#66BB6A"
      >
        <div className="space-y-1">
          {[...mol.mos]
            .map((m, idx) => ({ ...m, idx }))
            .sort((a, b) => b.energy - a.energy)   // más energético arriba
            .map((mo) => {
              const visible = visibleMOKeys.has(mo.idx);
              const isBonding = mo.symmetry === 'bonding';
              return (
                <button
                  key={mo.idx}
                  onClick={() => toggleMO(mo.idx)}
                  className={`w-full flex items-center gap-2 rounded px-2 py-1.5 transition text-left ${
                    visible
                      ? 'bg-[#0B0F17]/80 border border-[#4FC3F7]/40'
                      : 'bg-transparent border border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex-shrink-0 flex items-center gap-0.5 h-5 w-14">
                    <div
                      className={`h-0.5 rounded-full flex-1 ${isBonding ? 'bg-[#4FC3F7]' : 'bg-[#66BB6A]'}`}
                    />
                    <div className="flex gap-0.5 text-[13px] leading-none pl-1">
                      {mo.occupancy >= 1 && <span className="text-[#4FC3F7]">↑</span>}
                      {mo.occupancy >= 2 && <span className="text-[#FB923C]">↓</span>}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-white leading-none">{mo.name}</div>
                    <div className="text-[9px] text-[#64748B] mt-0.5">
                      {mo.symmetry} · {mo.occupancy}e⁻
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-[#CBD5E1]">
                    {mo.energy.toFixed(1)}eV
                  </div>
                </button>
              );
            })}
        </div>
        <div className="mt-2 text-[9px] font-mono text-[#64748B]">
          clic: ocultar/mostrar en la nube
        </div>
      </FloatingPanel>

      {/* ═══════════════════ BOTTOM-RIGHT: Morse curve ═══════════════════ */}
      <FloatingPanel
        title="Perfil de energía"
        icon="📉"
        position="bottom-20 right-4"
        width="320px"
        accent="#EF5350"
      >
        <MorseCurve
          morse={morseP}
          currentR={bondLength}
          maxR={Math.max(10, morseP.re * 4)}
        />
        <div className="mt-2 text-[10px] font-mono text-[#64748B]">
          E(r) = Dₑ · (1−exp(−a(r−rₑ)))² − Dₑ
        </div>
      </FloatingPanel>

      {/* ═══════════════════ BOTTOM-CENTER: dock de control ═══════════════════ */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-stretch gap-2">
        {/* Botones animación */}
        <div className="rounded-xl border border-white/10 bg-[#0B0F17]/85 backdrop-blur-xl p-2 flex items-center gap-2 shadow-2xl">
          <button
            disabled={animating}
            onClick={() => animateTo(morseP.re * 5.5, morseP.re, 2800)}
            className="px-4 py-2 rounded-md bg-[#4FC3F7] hover:bg-[#29B6F6] text-[#0B0F17] text-[13px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▶ Fusionar
          </button>
          <button
            disabled={animating}
            onClick={() => animateTo(morseP.re, morseP.re * 5.5, 2800)}
            className="px-4 py-2 rounded-md bg-[#7E57C2] hover:bg-[#9575CD] text-white text-[13px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ◀ Disociar
          </button>
          {animating && (
            <button
              onClick={stopAnimation}
              className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-[12px] transition"
            >
              ⏸
            </button>
          )}
        </div>

        {/* Slider */}
        <div className="rounded-xl border border-white/10 bg-[#0B0F17]/85 backdrop-blur-xl px-4 py-2 flex items-center gap-3 shadow-2xl min-w-[340px]">
          <span className="text-[10px] font-mono text-[#64748B] whitespace-nowrap">
            R
          </span>
          <input
            type="range"
            min={0.5}
            max={Math.max(10, morseP.re * 4)}
            step={0.02}
            value={bondLength}
            onChange={(e) => onBondLengthChange(Number(e.target.value))}
            className="flex-1 accent-[#4FC3F7]"
          />
          <span className="font-mono text-[13px] font-bold text-white whitespace-nowrap min-w-[80px] text-right">
            {bondLength.toFixed(2)} a₀
          </span>
          <button
            onClick={() => setBondLengthState(morseP.re)}
            className="text-[11px] text-[#64748B] hover:text-[#4FC3F7] transition whitespace-nowrap"
            title="Volver a la distancia óptima"
          >
            ↻ rₑ
          </button>
        </div>
      </div>

      {/* ═══════════════════ INDICADOR DE RENDIMIENTO (discreto) ═══════════════════ */}
      {lowRes && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-[#FBBF24]/15 border border-[#FBBF24]/40 rounded-full px-2.5 py-0.5 text-[10px] font-mono text-[#FBBF24]">
          LCAO dinámico · 1800pt · overlap vivo
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Curva de Morse compacta — Canvas 2D
// ═══════════════════════════════════════════════════════════════

function MorseCurve({
  morse, currentR, maxR,
}: { morse: MorseParams; currentR: number; maxR: number; }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    const height = 120;
    cv.width = width * dpr;
    cv.height = height * dpr;
    cv.style.width = width + 'px';
    cv.style.height = height + 'px';

    const ctx = cv.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const ml = 42, mr = 10, mt = 8, mb = 18;
    const plotW = width - ml - mr;
    const plotH = height - mt - mb;

    const rMin = 0.3;
    const rMax = maxR;
    const eMin = -morse.De * 1.15;
    const eMax = morse.De * 0.3;

    const px = (r: number): number => ml + ((r - rMin) / (rMax - rMin)) * plotW;
    const py = (e: number): number => mt + (1 - (e - eMin) / (eMax - eMin)) * plotH;

    // Grid
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = mt + (plotH * i) / 3;
      ctx.beginPath();
      ctx.moveTo(ml, y); ctx.lineTo(ml + plotW, y); ctx.stroke();
    }

    // E=0 line
    ctx.strokeStyle = '#334155';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(ml, py(0)); ctx.lineTo(ml + plotW, py(0)); ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = '#64748B';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', ml - 5, py(0));
    ctx.fillText(`-${morse.De.toFixed(1)}`, ml - 5, py(-morse.De));

    // Morse curve
    ctx.strokeStyle = '#4FC3F7';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const nPts = 150;
    for (let i = 0; i <= nPts; i++) {
      const r = rMin + ((rMax - rMin) * i) / nPts;
      const e = morseEnergy(r, morse);
      const X = px(r), Y = py(e);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();

    // Current position
    const xCur = px(currentR);
    const yCur = py(morseEnergy(currentR, morse));
    ctx.strokeStyle = '#FBBF24';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(xCur, mt); ctx.lineTo(xCur, mt + plotH); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(xCur, yCur, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Minimum marker
    const xMin = px(morse.re);
    const yMin = py(-morse.De);
    ctx.fillStyle = '#4FC3F7';
    ctx.beginPath();
    ctx.arc(xMin, yMin, 2.5, 0, Math.PI * 2); ctx.fill();

    // X axis labels
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '9px JetBrains Mono';
    ctx.fillText('r (a₀)', ml + plotW / 2, mt + plotH + 4);
  }, [morse, currentR, maxR]);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}

function Obs({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[#64748B]">{label}</span>
      <span style={{ color: accent ?? '#FFFFFF' }}>{value}</span>
    </div>
  );
}
