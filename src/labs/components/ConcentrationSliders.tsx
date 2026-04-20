/**
 * ConcentrationSliders — controles para modificar concentraciones iniciales
 * antes de simular (nivel 2+).
 */

interface ConcentrationSlidersProps {
  initial: Record<string, number>;
  onChange: (c: Record<string, number>) => void;
  colors?: Record<string, string>;
}

const DEFAULT_COLORS = ['#0696D7', '#E8A417', '#22C55E', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ConcentrationSliders({
  initial,
  onChange,
  colors,
}: ConcentrationSlidersProps) {
  const entries = Object.entries(initial);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
        Concentraciones iniciales
      </h3>
      <div className="space-y-2.5">
        {entries.map(([species, val], i) => {
          const color = colors?.[species] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          const max = Math.max(5, val * 2);
          const pct = max > 0 ? (val / max) * 100 : 0;
          return (
            <div key={species} className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-[#1F2937]">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                    style={{ background: color }}
                  />
                  {species}
                </span>
                <span className="font-mono text-[12px] text-[#374151]">
                  {val.toFixed(3)} M
                </span>
              </div>
              <div className="relative h-6 rounded-md bg-[#F1F3F7] overflow-hidden border border-[#E5E7EB]">
                <div
                  className="absolute inset-y-0 left-0 rounded-md transition-[width] duration-75"
                  style={{ width: `${pct}%`, background: color, opacity: 0.3 }}
                />
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={max / 200}
                  value={val}
                  onChange={(e) =>
                    onChange({ ...initial, [species]: Number(e.target.value) })
                  }
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md border pointer-events-none"
                  style={{
                    left: `calc(${pct}% - 6px)`,
                    borderColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
