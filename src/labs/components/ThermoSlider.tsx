/**
 * ThermoSlider — slider de temperatura con apariencia de termómetro.
 *
 * Genera un slider grande, táctil, visualmente intuitivo.
 * Muestra T en K y °C simultáneamente.
 */

interface ThermoSliderProps {
  value: number;          // K
  min: number;            // K
  max: number;            // K
  onChange: (v: number) => void;
  label?: string;
}

export default function ThermoSlider({
  value,
  min,
  max,
  onChange,
  label = 'Temperatura',
}: ThermoSliderProps) {
  const frac = (value - min) / (max - min);
  const pct = Math.max(0, Math.min(100, frac * 100));

  // Color gradient: azul frío a rojo caliente
  const hue = 240 - 240 * frac;
  const fillColor = `hsl(${hue}, 80%, 55%)`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[#6B7280]">
          {label}
        </span>
        <span className="font-mono text-[14px] text-[#1F2937]">
          <span className="font-bold text-[18px]">{value.toFixed(0)}</span> K
          <span className="mx-1.5 text-[#9CA3AF]">·</span>
          <span className="text-[#6B7280]">{(value - 273.15).toFixed(0)} °C</span>
        </span>
      </div>
      <div className="relative h-10 rounded-full bg-[#F1F3F7] overflow-hidden border border-[#E5E7EB]">
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
          style={{ width: `${pct}%`, background: fillColor }}
        />
        {/* Slider handle (via native input) */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {/* Handle marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-md border-2 pointer-events-none"
          style={{
            left: `calc(${pct}% - 10px)`,
            borderColor: fillColor,
          }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-[#9CA3AF] font-mono">
        <span>{min} K</span>
        <span>{max} K</span>
      </div>
    </div>
  );
}
