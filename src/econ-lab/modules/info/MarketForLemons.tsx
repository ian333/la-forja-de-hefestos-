/**
 * MarketForLemons — simulador interactivo del paper de Akerlof (1970).
 *
 * Concepto que el alumno explora aquí (después de ver la masterclass):
 *   - Hay N vendedores. Cada uno tiene un carro con calidad q ∈ [0, 1].
 *   - El dueño conoce q. El comprador no. El comprador solo observa el
 *     promedio de calidad esperado para los que aceptan vender.
 *   - El dueño vende si y solo si el precio ofrecido ≥ su valoración v(q).
 *   - El comprador valora un carro de calidad q en u·v(q), con u ≥ 1
 *     (porque el carro vale más para él que para el dueño — gains from trade).
 *   - El "equilibrio" se busca iterativamente: el precio p_t induce un set
 *     S_t = {q : v(q) ≤ p_t} que aceptan vender; el comprador entonces
 *     ofrece p_{t+1} = u · E[v(q) | q ∈ S_t]. El proceso converge.
 *
 * El alumno juega con tres sliders:
 *   - distribución de calidad (uniforme [a, b])
 *   - función de valoración (lineal/cuadrática/cúbica)
 *   - sobreprecio u (multiplier del comprador sobre la valuación)
 *
 * Visualización:
 *   - Eje horizontal: calidad q ∈ [0, 1]
 *   - Eje vertical: precio
 *   - Línea: v(q) — la valuación del dueño
 *   - Banda horizontal: precio ofrecido (animado bajando hacia equilibrio)
 *   - Carros: puntos coloreados (verde = vende, gris = retira)
 *   - HUD: precio actual, % que vende, welfare loss, equilibrio alcanzado
 *
 * No hay React Three Fiber: todo es SVG + sliders.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudience } from '../../context';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos y configuración

type ValuationFn = 'lineal' | 'cuadratica' | 'cubica';

interface SimulationParams {
  /** Cantidad mínima de calidad (≥ 0) */
  qmin: number;
  /** Cantidad máxima de calidad (≤ 1) */
  qmax: number;
  /** Función valuation del dueño */
  valuation: ValuationFn;
  /** Multiplicador del comprador sobre la valuation: u ≥ 1 → ganancias de comercio */
  buyerMultiplier: number;
  /** Número de carros en el mercado (visualización) */
  carCount: number;
}

const VALUATIONS: Record<ValuationFn, { fn: (q: number) => number; label: string }> = {
  lineal: { fn: q => q, label: 'v(q) = q' },
  cuadratica: { fn: q => q * q, label: 'v(q) = q²' },
  cubica: { fn: q => q * q * q, label: 'v(q) = q³' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Resolución del equilibrio (iterativa con dampening)

interface Equilibrium {
  price: number;
  cutoff: number;   // q* : dueño vende si q ≤ cutoff
  fractionTrading: number; // proporción del mercado que comercia
  welfare: number;  // ganancia social realizada
  welfareMax: number; // ganancia que se obtendría con info simétrica
  converged: boolean;
  iterations: number;
}

function solveEquilibrium(p: SimulationParams): Equilibrium {
  const v = VALUATIONS[p.valuation].fn;
  const { qmin, qmax, buyerMultiplier: u } = p;

  // El dueño vende si precio ≥ v(q). Con v creciente, eso significa q ≤ q*
  // donde q* tal que v(q*) = price (o todos si price ≥ v(qmax)).
  // El comprador ofrece u · E[v(q) | q ∈ [qmin, q*]] = u · (∫ v dq) / (q* − qmin).

  // Iteramos: parte con p_0 = u · E[v(q) | q ∈ [qmin, qmax]] (caso "info simétrica")
  const range = qmax - qmin;
  if (range <= 1e-6) return { price: 0, cutoff: qmin, fractionTrading: 0, welfare: 0, welfareMax: 0, converged: true, iterations: 0 };

  // E[v(q) | q ∈ [a, b]] = (1/(b-a)) ∫_a^b v(q) dq
  function avgValuation(a: number, b: number): number {
    if (b - a < 1e-9) return v(a);
    // Trapecio numérico con 64 puntos — basta para nuestras funciones suaves
    let sum = 0;
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const q = a + (b - a) * (i / n);
      const w = i === 0 || i === n ? 0.5 : 1;
      sum += w * v(q);
    }
    return (sum * (b - a) / n) / (b - a);
  }

  let price = u * avgValuation(qmin, qmax);
  let cutoff = qmax;
  let lastCutoff = qmax;
  let iters = 0;
  let converged = false;

  // v es invertible monotónicamente; para encontrar q tal que v(q) = price/u_implicit
  // Nota: el dueño compara precio (no precio/u) con v(q). El dueño vende si v(q) ≤ price.
  // Si v es invertible: cutoff = v^{-1}(min(price, v(qmax)))
  function invertV(target: number): number {
    if (target <= v(qmin)) return qmin;
    if (target >= v(qmax)) return qmax;
    // Binary search (v es monótono creciente)
    let lo = qmin, hi = qmax;
    for (let k = 0; k < 30; k++) {
      const m = (lo + hi) / 2;
      if (v(m) < target) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }

  for (iters = 0; iters < 100; iters++) {
    cutoff = invertV(price);
    if (cutoff <= qmin) {
      cutoff = qmin;
      price = 0;
      converged = true;
      break;
    }
    const newPrice = u * avgValuation(qmin, cutoff);
    if (Math.abs(newPrice - price) < 1e-5 && Math.abs(cutoff - lastCutoff) < 1e-5) {
      converged = true;
      break;
    }
    lastCutoff = cutoff;
    // Dampening 0.5 para evitar oscilación
    price = 0.5 * price + 0.5 * newPrice;
  }

  const fractionTrading = Math.max(0, (cutoff - qmin) / range);

  // Welfare realizado: ganancia por trade = u·v(q) − v(q) = (u−1)·v(q), integrado sobre [qmin, cutoff]
  function welfareIntegral(a: number, b: number): number {
    if (b - a < 1e-9) return 0;
    let sum = 0;
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const q = a + (b - a) * (i / n);
      const w = i === 0 || i === n ? 0.5 : 1;
      sum += w * (u - 1) * v(q);
    }
    return sum * (b - a) / n;
  }
  const welfare = welfareIntegral(qmin, cutoff);
  const welfareMax = welfareIntegral(qmin, qmax);

  return { price, cutoff, fractionTrading, welfare, welfareMax, converged, iterations: iters };
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes

function Plot({ params, eq }: { params: SimulationParams; eq: Equilibrium }) {
  const W = 720;
  const H = 420;
  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  const w = W - margin.left - margin.right;
  const h = H - margin.top - margin.bottom;

  const v = VALUATIONS[params.valuation].fn;
  const yMax = Math.max(v(params.qmax) * params.buyerMultiplier + 0.05, 0.3);

  const x = (q: number) => margin.left + ((q - params.qmin) / (params.qmax - params.qmin || 1)) * w;
  const y = (p: number) => margin.top + h - (p / yMax) * h;

  // Sample v(q) for the curve
  const N = 100;
  const ptsV = Array.from({ length: N }, (_, i) => {
    const q = params.qmin + (params.qmax - params.qmin) * (i / (N - 1));
    return [x(q), y(v(q))];
  });
  const pathV = ptsV.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');

  // u·v(q) curve (buyer willingness to pay)
  const ptsUV = Array.from({ length: N }, (_, i) => {
    const q = params.qmin + (params.qmax - params.qmin) * (i / (N - 1));
    return [x(q), y(params.buyerMultiplier * v(q))];
  });
  const pathUV = ptsUV.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');

  // Generate car points deterministically
  const cars = useMemo(() => {
    const list: { q: number; sells: boolean }[] = [];
    for (let i = 0; i < params.carCount; i++) {
      const hash = (i * 2654435761) >>> 0;
      const q = params.qmin + (params.qmax - params.qmin) * ((hash % 10000) / 10000);
      list.push({ q, sells: q <= eq.cutoff });
    }
    return list;
  }, [params.carCount, params.qmin, params.qmax, eq.cutoff]);

  return (
    <svg width={W} height={H} className="bg-[#0B0F17] rounded-lg border border-[#1E293B]">
      {/* Background grid */}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`gh-${i}`}
              x1={margin.left} x2={margin.left + w}
              y1={margin.top + (h * i / 5)} y2={margin.top + (h * i / 5)}
              stroke="#1E293B" strokeDasharray="2 3" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`gv-${i}`}
              x1={margin.left + (w * i / 5)} x2={margin.left + (w * i / 5)}
              y1={margin.top} y2={margin.top + h}
              stroke="#1E293B" strokeDasharray="2 3" />
      ))}

      {/* Axes */}
      <line x1={margin.left} y1={margin.top + h} x2={margin.left + w} y2={margin.top + h} stroke="#475569" />
      <line x1={margin.left} y1={margin.top}     x2={margin.left}     y2={margin.top + h} stroke="#475569" />

      {/* Axis labels */}
      <text x={margin.left + w / 2} y={H - 12} fill="#94A3B8" fontSize="11" textAnchor="middle" fontFamily="monospace">
        calidad  q  →
      </text>
      <text x={18} y={margin.top + h / 2} fill="#94A3B8" fontSize="11" textAnchor="middle" fontFamily="monospace"
            transform={`rotate(-90 18 ${margin.top + h / 2})`}>
        precio
      </text>

      {/* Y-axis ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const pt = yMax * t;
        return (
          <g key={t}>
            <line x1={margin.left - 4} x2={margin.left} y1={y(pt)} y2={y(pt)} stroke="#475569" />
            <text x={margin.left - 8} y={y(pt) + 4} fill="#64748B" fontSize="10" textAnchor="end" fontFamily="monospace">
              {pt.toFixed(2)}
            </text>
          </g>
        );
      })}
      {/* X-axis ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const q = params.qmin + (params.qmax - params.qmin) * t;
        return (
          <g key={t}>
            <line x1={x(q)} x2={x(q)} y1={margin.top + h} y2={margin.top + h + 4} stroke="#475569" />
            <text x={x(q)} y={margin.top + h + 16} fill="#64748B" fontSize="10" textAnchor="middle" fontFamily="monospace">
              {q.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* Curves */}
      <path d={pathUV} stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="4 3" fill="none" opacity="0.85" />
      <path d={pathV}  stroke="#F472B6" strokeWidth="2" fill="none" />

      {/* Equilibrium price line (horizontal) */}
      {eq.price > 0 && (
        <>
          <line x1={margin.left} x2={margin.left + w} y1={y(eq.price)} y2={y(eq.price)}
                stroke="#FDB813" strokeWidth="2" strokeDasharray="6 4" />
          <text x={margin.left + w - 6} y={y(eq.price) - 6} fill="#FDB813" fontSize="11" textAnchor="end" fontFamily="monospace">
            p* = {eq.price.toFixed(3)}
          </text>
        </>
      )}

      {/* Cutoff vertical line */}
      {eq.cutoff > params.qmin && eq.cutoff < params.qmax && (
        <>
          <line x1={x(eq.cutoff)} x2={x(eq.cutoff)} y1={margin.top} y2={margin.top + h}
                stroke="#34D399" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x={x(eq.cutoff)} y={margin.top - 8} fill="#34D399" fontSize="11" textAnchor="middle" fontFamily="monospace">
            q* = {eq.cutoff.toFixed(3)}
          </text>
        </>
      )}

      {/* Cars dots */}
      {cars.map((c, i) => (
        <circle
          key={i}
          cx={x(c.q)}
          cy={y(v(c.q))}
          r={c.sells ? 4.5 : 3}
          fill={c.sells ? '#34D399' : '#475569'}
          opacity={c.sells ? 1 : 0.55}
        />
      ))}

      {/* Legend */}
      <g transform={`translate(${margin.left + 16}, ${margin.top + 16})`}>
        <rect x={-8} y={-12} width={210} height={70} fill="#0B0F17" fillOpacity="0.85" stroke="#1E293B" rx={6} />
        <line x1={0} y1={0}  x2={20} y2={0}  stroke="#F472B6" strokeWidth="2" />
        <text x={26} y={4} fill="#F472B6" fontSize="11" fontFamily="monospace">v(q) — dueño vende si p ≥</text>
        <line x1={0} y1={18} x2={20} y2={18} stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x={26} y={22} fill="#60A5FA" fontSize="11" fontFamily="monospace">u · v(q) — paga comprador</text>
        <line x1={0} y1={36} x2={20} y2={36} stroke="#FDB813" strokeWidth="2" strokeDasharray="6 4" />
        <text x={26} y={40} fill="#FDB813" fontSize="11" fontFamily="monospace">p* — precio de equilibrio</text>
      </g>
    </svg>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#34D399]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal

export default function MarketForLemons() {
  const { audience } = useAudience();
  const [qmin, setQmin] = useState(0.0);
  const [qmax, setQmax] = useState(1.0);
  const [valuation, setValuation] = useState<ValuationFn>('lineal');
  const [buyerMultiplier, setBuyerMultiplier] = useState(1.5);
  const [carCount] = useState(60);

  const params: SimulationParams = { qmin, qmax, valuation, buyerMultiplier, carCount };
  const eq = useMemo(() => solveEquilibrium(params), [qmin, qmax, valuation, buyerMultiplier]);

  // Welfare loss as %
  const welfareLossPct = eq.welfareMax > 1e-6
    ? Math.max(0, 1 - eq.welfare / eq.welfareMax)
    : 0;

  // Preset scenarios
  const presets = [
    { label: 'Akerlof clásico',  q: [0, 1] as [number, number], val: 'lineal' as ValuationFn,    u: 1.2,
      hint: 'Lineal con margen apenas suficiente: el unraveling es total cuando u baja.' },
    { label: 'Mercado de cherries', q: [0.6, 1] as [number, number], val: 'lineal' as ValuationFn,    u: 1.4,
      hint: 'Solo carros buenos: el mercado sobrevive con gains menores.' },
    { label: 'Mercado de lemons', q: [0, 0.4] as [number, number], val: 'lineal' as ValuationFn,    u: 1.4,
      hint: 'Solo carros malos: el mercado funciona, pero el comprador lo sabe.' },
    { label: 'Valuación cuadrática', q: [0, 1] as [number, number], val: 'cuadratica' as ValuationFn, u: 1.6,
      hint: 'v(q)=q²: dueños de cherries son MUY exigentes. Unraveling más fácil.' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#05060A] p-6">
      <div className="max-w-[1280px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#F472B6] font-mono mb-2">
            Mercados e información · Akerlof 1970
          </div>
          <h2 className="text-[28px] md:text-[34px] font-extrabold text-white tracking-tight leading-tight">
            Mercado de limones — laboratorio interactivo
          </h2>
          <p className="mt-2 text-[14px] text-[#94A3B8] max-w-[800px] leading-relaxed">
            {audience === 'child'
              ? 'Mueve los sliders y mira qué pasa en el mercado. Si nadie vende, baja el precio. Si todos venden, súbele. ¿Cuál es el punto donde dejan de venderse los buenos?'
              : 'Equilibrio iterativo: precio = u · E[v(q) | v(q) ≤ p]. Los puntos verdes son carros que sí venden al precio de equilibrio. Los grises se retiran del mercado.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Plot */}
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Plot params={params} eq={eq} />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="precio equilibrio"
                value={eq.price.toFixed(3)}
                accent="#FDB813"
              />
              <StatCard
                label="cutoff q*"
                value={eq.cutoff.toFixed(3)}
                accent="#34D399"
              />
              <StatCard
                label="% del mercado vende"
                value={`${(eq.fractionTrading * 100).toFixed(0)}%`}
                accent="#60A5FA"
              />
              <StatCard
                label="welfare perdido"
                value={`${(welfareLossPct * 100).toFixed(0)}%`}
                accent={welfareLossPct > 0.3 ? '#EF4444' : '#94A3B8'}
              />
            </div>

            {/* Insight panel */}
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#F472B6] font-mono mb-2">
                ✦ ¿Qué leer en la gráfica?
              </div>
              <ul className="space-y-1.5 text-[12px] text-[#CBD5E1] leading-relaxed">
                <li>• La <span className="text-[#F472B6] font-medium">curva rosa</span> es la valuación del dueño: vende si el precio ofrecido la cubre.</li>
                <li>• La <span className="text-[#60A5FA] font-medium">curva azul</span> es lo máximo que pagaría el comprador si conociera la calidad real.</li>
                <li>• La <span className="text-[#FDB813] font-medium">línea dorada</span> es el precio que ofrece sin saber qué carro es: el promedio de los que aceptan vender, multiplicado por u.</li>
                <li>• Los puntos <span className="text-[#34D399] font-medium">verdes</span> son los carros que sobreviven el equilibrio. Los grises huyeron — su dueño los retiró del mercado.</li>
                {welfareLossPct > 0.2 && (
                  <li className="text-[#EF4444]">• ⚠ Hay <strong>{(welfareLossPct * 100).toFixed(0)}% de welfare perdido</strong>: trades que serían beneficiosos para ambos NO ocurren por la asimetría.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit lg:sticky lg:top-20">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono mb-3">
                ⚙ Parámetros
              </div>

              <div className="space-y-5">
                <Slider
                  label="Calidad mínima (qmin)"
                  value={qmin}
                  min={0} max={qmax - 0.05} step={0.01}
                  onChange={setQmin}
                  hint="Carros peores tienen qmin más bajo. Si subes, eliminas la cola de limones."
                />
                <Slider
                  label="Calidad máxima (qmax)"
                  value={qmax}
                  min={qmin + 0.05} max={1.0} step={0.01}
                  onChange={setQmax}
                  hint="Cuán buenos pueden llegar a ser los carros."
                />
                <Slider
                  label="Multiplicador comprador (u)"
                  value={buyerMultiplier}
                  min={1.0} max={3.0} step={0.05}
                  onChange={setBuyerMultiplier}
                  fmt={v => `× ${v.toFixed(2)}`}
                  hint="Cuánto más vale para el comprador. u=1 → no hay gains. u=2 → comprador valora el doble."
                />
              </div>
            </div>

            {/* Valuation function selector */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono mb-2">
                Función de valuación
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['lineal', 'cuadratica', 'cubica'] as ValuationFn[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setValuation(v)}
                    className={`px-2 py-2 text-[11px] font-mono border rounded transition ${
                      valuation === v
                        ? 'border-[#F472B6] bg-[#F472B6]/15 text-[#F472B6]'
                        : 'border-[#1E293B] text-[#64748B] hover:border-[#475569] hover:text-[#CBD5E1]'
                    }`}
                  >
                    {VALUATIONS[v].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono mb-2">
                Escenarios
              </div>
              <div className="space-y-1.5">
                {presets.map(p => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setQmin(p.q[0]);
                      setQmax(p.q[1]);
                      setValuation(p.val);
                      setBuyerMultiplier(p.u);
                    }}
                    className="w-full text-left px-3 py-2 border border-[#1E293B] rounded hover:border-[#34D399]/40 hover:bg-[#34D399]/5 transition"
                  >
                    <div className="text-[12px] text-[#E2E8F0] font-medium">{p.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5">{p.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Convergence info */}
            <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3">
              <div>convergencia: {eq.converged ? '✓ alcanzada' : '⚠ no converge'} ({eq.iterations} iteraciones)</div>
            </div>
          </div>
        </div>

        {/* Related masterclass link */}
        <div className="mt-8 p-4 bg-[#08201A] border border-[#34D399]/30 rounded-lg flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#34D399] font-mono mb-1">
              ▶ Masterclass relacionada
            </div>
            <div className="text-[14px] text-white font-medium">
              Los limones, o cómo se mueren los mercados solos
            </div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5">
              La narración completa de Akerlof 1970 que enmarca este laboratorio.
            </div>
          </div>
          <a
            href="/masterclass.html?id=econ-01-limones"
            className="px-4 py-2 rounded border border-[#34D399] bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20 text-[12px] font-mono whitespace-nowrap transition"
          >
            ▶ Ver clase narrada
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#64748B] font-mono mb-1">
        {label}
      </div>
      <div className="text-[20px] font-bold font-mono" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
