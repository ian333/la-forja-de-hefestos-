/**
 * AdvancedPanel — controles avanzados para nivel 4 (ingeniero):
 * - Tipo de reactor (Batch, CSTR, PFR)
 * - Flujo y volumen
 * - Balance energético on/off
 * - Exportar trayectoria
 */

export type ReactorType = 'batch' | 'cstr' | 'pfr';

interface AdvancedPanelProps {
  reactorType: ReactorType;
  onReactorTypeChange: (t: ReactorType) => void;
  volume: number;                // L
  onVolumeChange: (v: number) => void;
  flowRate: number;              // L/s
  onFlowRateChange: (q: number) => void;
  thermal: boolean;
  onThermalChange: (b: boolean) => void;
  onExportCSV: () => void;
  /** Métrica de resultado, si disponible */
  conversion?: number;
  steadyState?: Record<string, number>;
}

const REACTOR_INFO: Record<ReactorType, { icon: string; name: string; desc: string }> = {
  batch: { icon: '⚱', name: 'Batch', desc: 'Tanque cerrado, todo junto desde t=0' },
  cstr:  { icon: '🌀', name: 'CSTR', desc: 'Tanque con flujo continuo, mezcla perfecta' },
  pfr:   { icon: '🚇', name: 'PFR',  desc: 'Reactor tubular, rebanadas avanzan sin mezclarse' },
};

export default function AdvancedPanel({
  reactorType,
  onReactorTypeChange,
  volume,
  onVolumeChange,
  flowRate,
  onFlowRateChange,
  thermal,
  onThermalChange,
  onExportCSV,
  conversion,
  steadyState,
}: AdvancedPanelProps) {
  const tau = flowRate > 0 ? volume / flowRate : 0;

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
        Diseño de reactor
      </h3>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
          Tipo de reactor
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(REACTOR_INFO) as ReactorType[]).map((t) => {
            const info = REACTOR_INFO[t];
            const active = t === reactorType;
            return (
              <button
                key={t}
                onClick={() => onReactorTypeChange(t)}
                title={info.desc}
                className={`p-2 rounded-lg border text-center transition ${
                  active
                    ? 'border-[#0696D7] bg-[#F1F8FD] text-[#0696D7]'
                    : 'border-[#E5E7EB] bg-white hover:border-[#0696D7]/50 text-[#6B7280]'
                }`}
              >
                <div className="text-[20px]">{info.icon}</div>
                <div className="text-[11px] font-bold mt-0.5">{info.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {reactorType !== 'batch' && (
        <>
          <NumInput
            label="Volumen V"
            value={volume}
            unit="L"
            onChange={onVolumeChange}
            min={0.01}
          />
          <NumInput
            label="Caudal Q"
            value={flowRate}
            unit="L/s"
            onChange={onFlowRateChange}
            min={0.001}
          />
          <div className="text-[12px] text-[#6B7280]">
            τ = V/Q = <span className="font-mono font-semibold text-[#1F2937]">{tau.toFixed(2)} s</span>
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 text-[13px] text-[#1F2937] cursor-pointer">
          <input
            type="checkbox"
            checked={thermal}
            onChange={(e) => onThermalChange(e.target.checked)}
            className="rounded"
          />
          Balance energético (no-isotérmico)
        </label>
      </div>

      {conversion !== undefined && (
        <div className="rounded-lg bg-[#F1F8FD] border border-[#BEE3F5] p-3 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#0696D7]">
            Resultado
          </div>
          <div className="text-[13px]">
            Conversión: <span className="font-mono font-bold text-[#1F2937]">{(conversion * 100).toFixed(1)}%</span>
          </div>
          {steadyState && (
            <div className="text-[11px] font-mono text-[#6B7280]">
              {Object.entries(steadyState)
                .map(([sp, v]) => `[${sp}]=${v.toFixed(3)}M`)
                .join(' · ')}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onExportCSV}
        className="w-full px-3 py-2 rounded-lg bg-[#1F2937] text-white text-[12px] font-semibold hover:bg-[#111827] transition flex items-center justify-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 1v9M3 6l4 4 4-4M2 13h10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Exportar CSV
      </button>
    </div>
  );
}

function NumInput({ label, value, unit, onChange, min }: {
  label: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          step="any"
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 px-2.5 py-1.5 rounded-md border border-[#E5E7EB] text-[13px] font-mono text-[#1F2937] focus:outline-none focus:border-[#0696D7]"
        />
        <span className="text-[12px] text-[#6B7280] font-mono">{unit}</span>
      </div>
    </div>
  );
}
