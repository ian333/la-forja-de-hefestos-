/**
 * FormulaPanel — muestra en vivo las fórmulas relevantes a la simulación.
 * Para nivel 3+ (universidad / ingeniero).
 */

import type { Preset } from '@/lib/chem/reactions';
import { arrhenius } from '@/lib/chem/kinetics';
import { CONSTANTS } from '@/lib/chem/elements';

interface FormulaPanelProps {
  preset: Preset;
  T: number;
}

export default function FormulaPanel({ preset, T }: FormulaPanelProps) {
  const step = preset.steps[0];
  const k = arrhenius(step.A, step.Ea, T);
  const tHalf = step.reactants[0]?.order === 1 && !step.reversible
    ? Math.log(2) / (step.reactants[0].nu * k)
    : null;

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
        Matemática en vivo
      </h3>

      <div className="space-y-2.5 text-[13px]">
        <FormulaLine
          label="Arrhenius"
          equation="k = A · exp(−Eₐ / RT)"
          value={`${k.toExponential(3)} s⁻¹`}
        />
        <FormulaLine
          label="A"
          equation={`${step.A.toExponential(2)}`}
          value={`${step.A.toExponential(2)} s⁻¹`}
        />
        <FormulaLine
          label="Eₐ"
          equation={`${(step.Ea / 1000).toFixed(1)} kJ/mol`}
          value={`${step.Ea.toFixed(0)} J/mol`}
        />
        <FormulaLine
          label="RT"
          equation={`R · T = ${CONSTANTS.R.toFixed(2)} · ${T.toFixed(0)}`}
          value={`${(CONSTANTS.R * T).toFixed(0)} J/mol`}
        />
        <FormulaLine
          label="−Eₐ/RT"
          equation={`−${step.Ea.toFixed(0)} / ${(CONSTANTS.R * T).toFixed(0)}`}
          value={(-step.Ea / (CONSTANTS.R * T)).toFixed(3)}
        />
        {tHalf !== null && (
          <FormulaLine
            label="Vida media"
            equation="t½ = ln(2) / (ν·k)"
            value={formatTime(tHalf)}
          />
        )}
        {step.deltaH !== undefined && (
          <FormulaLine
            label="ΔH"
            equation={step.deltaH < 0 ? 'Exotérmica (libera calor)' : 'Endotérmica (absorbe calor)'}
            value={`${(step.deltaH / 1000).toFixed(1)} kJ/mol`}
          />
        )}
        {step.reversible && step.A_rev !== undefined && step.Ea_rev !== undefined && (
          <>
            <FormulaLine
              label="k_rev"
              equation="A_rev · exp(−Eₐ_rev / RT)"
              value={`${arrhenius(step.A_rev, step.Ea_rev, T).toExponential(3)} s⁻¹`}
            />
            <FormulaLine
              label="Keq aparente"
              equation="kf / kr"
              value={(arrhenius(step.A, step.Ea, T) / arrhenius(step.A_rev, step.Ea_rev, T)).toExponential(2)}
            />
          </>
        )}
      </div>

      {preset.notes && (
        <div className="mt-3 pt-3 border-t border-[#F3F4F6] text-[12px] leading-relaxed text-[#4B5563]">
          💡 {preset.notes}
        </div>
      )}
    </div>
  );
}

function FormulaLine({ label, equation, value }: {
  label: string;
  equation: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr_auto] items-baseline gap-3">
      <span className="font-semibold text-[#0696D7]">{label}</span>
      <span className="font-mono text-[11px] text-[#6B7280]">{equation}</span>
      <span className="font-mono text-[13px] text-[#1F2937]">{value}</span>
    </div>
  );
}

function formatTime(s: number): string {
  if (s < 1e-3) return `${(s * 1e6).toFixed(1)} µs`;
  if (s < 1) return `${(s * 1000).toFixed(1)} ms`;
  if (s < 60) return `${s.toFixed(2)} s`;
  if (s < 3600) return `${(s / 60).toFixed(1)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} d`;
}
