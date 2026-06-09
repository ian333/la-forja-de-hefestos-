/**
 * CircuitSimulator — el simulador de circuitos de La Forja.
 *
 * Motor MNA real (src/lib/circuitos/spice.ts, 15 tests vs fórmula cerrada).
 * El esquemático muestra voltajes de nodo EN VIVO; el osciloscopio dibuja la
 * evolución temporal. El usuario juega con sliders o deja correr la lección
 * (los keyframes mueven los componentes y ves el efecto).
 *
 * Pedagogía: primero la realidad (el circuito corre de verdad), luego el
 * problema. Quien no tiene para comprar componentes APRENDE aquí, gratis.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  dcOperatingPoint,
  transient,
  type TransientResult,
} from '@/lib/circuitos/spice';
import LessonPanel from '@/math/lesson/LessonPanel';
import { PRESETS, type Preset, type Params } from './presets';

export default function CircuitSimulator() {
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId)!, [presetId]);
  const [params, setParams] = useState<Params>(preset.defaults);

  // al cambiar de preset, recargar sus defaults
  useEffect(() => { setParams(preset.defaults); }, [preset]);

  const circuit = useMemo(() => preset.build(params), [preset, params]);

  // ── DC: punto de operación estático ──────────────────────────────────
  const dcV = useMemo(() => {
    if (preset.mode !== 'dc') return null;
    return dcOperatingPoint(circuit)?.v ?? null;
  }, [preset, circuit]);

  // ── Transitorio: barrido completo precomputado (determinista) ─────────
  const result = useMemo<TransientResult | null>(() => {
    if (preset.mode !== 'transient' || !preset.sim) return null;
    return transient(circuit, { dt: preset.sim.dt, tStop: preset.sim.tStop });
  }, [preset, circuit]);

  // playhead de animación (fracción 0..1 de la ventana)
  const [frac, setFrac] = useState(0);
  const fracRef = useRef(0);
  useEffect(() => {
    if (preset.mode !== 'transient' || !result) return;
    let raf = 0;
    const tick = () => {
      fracRef.current = (fracRef.current + 0.004) % 1;
      setFrac(fracRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [preset, result]);

  // voltajes de nodo MOSTRADOS en el esquemático
  const vNow = useMemo<number[]>(() => {
    if (preset.mode === 'dc') return dcV ?? [];
    if (!result) return [];
    const k = Math.min(result.v.length - 1, Math.floor(frac * result.v.length));
    return result.v[k] ?? result.v[result.v.length - 1];
  }, [preset, dcV, result, frac]);

  const applyState = useCallback((patch: Partial<Params>) => {
    setParams((p) => {
      const next = { ...p };
      for (const k in patch) {
        const val = patch[k];
        if (val !== undefined) next[k] = val;
      }
      return next;
    });
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 h-full p-3 overflow-hidden">
      {/* Columna izquierda: tabs + esquemático + osciloscopio */}
      <div className="flex flex-col gap-3 min-h-0 overflow-auto">
        <PresetTabs presetId={presetId} onPick={setPresetId} />
        <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-2">
          <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e] px-1 pb-1">Esquemático · voltajes en vivo</div>
          <svg viewBox="0 0 420 220" className="w-full" style={{ maxHeight: 260 }}>
            <preset.Schematic v={vNow} params={params} />
          </svg>
        </div>
        {preset.mode === 'transient' && result ? (
          <Oscilloscope preset={preset} result={result} frac={frac} />
        ) : (
          <DcReadout preset={preset} v={vNow} params={params} />
        )}
      </div>

      {/* Columna derecha: lección + sandbox */}
      <div className="min-h-0 overflow-hidden">
        <LessonPanel<Params>
          lesson={preset.lesson}
          onApplyState={applyState}
          sandbox={<Sandbox preset={preset} params={params} setParams={setParams} />}
        />
      </div>
    </div>
  );
}

// ── Tabs de preset ───────────────────────────────────────────────────────

function PresetTabs({ presetId, onPick }: { presetId: string; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p.id)}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
            p.id === presetId
              ? 'bg-[#d4b050] text-[#181d2e] border-[#d4b050]'
              : 'bg-[#1e2538] text-[#a0947e] border-[#2c2818] hover:border-[#3e3624]'
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

// ── Osciloscopio (canvas 2D) ─────────────────────────────────────────────

function Oscilloscope({ preset, result, frac }: { preset: Preset; result: TransientResult; frac: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    // fondo
    ctx.fillStyle = '#080a10';
    ctx.fillRect(0, 0, W, H);

    // rango Y auto (sobre todas las sondas)
    let ymin = Infinity, ymax = -Infinity;
    for (const probe of preset.probes) {
      const series = probe.node != null
        ? result.v.map((row) => row[probe.node!] ?? 0)
        : result.current[probe.current!] ?? [];
      for (const y of series) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
    }
    if (!isFinite(ymin)) { ymin = -1; ymax = 1; }
    const pad = (ymax - ymin) * 0.12 || 1;
    ymin -= pad; ymax += pad;
    const x2px = (i: number) => (i / (result.v.length - 1)) * (W - 8) + 4;
    const y2px = (y: number) => H - 4 - ((y - ymin) / (ymax - ymin)) * (H - 8);

    // grilla
    ctx.strokeStyle = '#1a1f2e';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 8; g++) {
      const x = (g / 8) * (W - 8) + 4;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let g = 0; g <= 4; g++) {
      const y = (g / 4) * (H - 8) + 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // línea de 0 V
    if (ymin < 0 && ymax > 0) {
      ctx.strokeStyle = '#2c2818';
      ctx.beginPath(); ctx.moveTo(0, y2px(0)); ctx.lineTo(W, y2px(0)); ctx.stroke();
    }

    // trazas
    for (const probe of preset.probes) {
      const series = probe.node != null
        ? result.v.map((row) => row[probe.node!] ?? 0)
        : result.current[probe.current!] ?? [];
      ctx.strokeStyle = probe.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < series.length; i++) {
        const px = x2px(i), py = y2px(series[i]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // playhead
    const phx = frac * (W - 8) + 4;
    ctx.strokeStyle = '#f0ece4';
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(phx, 0); ctx.lineTo(phx, H); ctx.stroke();
    ctx.globalAlpha = 1;
  }, [preset, result, frac]);

  return (
    <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e]">Osciloscopio</div>
        <div className="flex gap-3">
          {preset.probes.map((p) => (
            <span key={p.label} className="text-[11px] flex items-center gap-1" style={{ color: p.color }}>
              <span className="inline-block w-2.5 h-0.5 rounded" style={{ background: p.color }} />
              {p.label}
            </span>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} width={760} height={220} className="w-full rounded" style={{ imageRendering: 'auto' }} />
      <div className="text-[10px] text-[#6a5e4e] px-1 pt-1 font-mono">
        ventana {(preset.sim!.tStop * 1000).toFixed(0)} ms · dt {(preset.sim!.dt * 1e6).toFixed(0)} µs · {result.v.length} pasos
      </div>
    </div>
  );
}

// ── Lectura DC (sin tiempo) ──────────────────────────────────────────────

function DcReadout({ preset, v, params }: { preset: Preset; v: number[]; params: Params }) {
  const ratio = params.R2 != null && params.R1 != null ? params.R2 / (params.R1 + params.R2) : null;
  return (
    <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e] pb-2">Medidas DC</div>
      <div className="grid grid-cols-2 gap-2">
        {preset.probes.map((p) => (
          <div key={p.label} className="rounded-md bg-[#1e2538] px-3 py-2">
            <div className="text-[11px] text-[#a0947e]">{p.label}</div>
            <div className="text-[20px] font-mono" style={{ color: p.color }}>
              {(p.node != null ? v[p.node] ?? 0 : 0).toFixed(3)} V
            </div>
          </div>
        ))}
        {ratio != null && (
          <div className="rounded-md bg-[#1e2538] px-3 py-2">
            <div className="text-[11px] text-[#a0947e]">Razón R2/(R1+R2)</div>
            <div className="text-[20px] font-mono text-[#ead080]">{(ratio * 100).toFixed(1)}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sandbox: sliders de componentes ──────────────────────────────────────

function Sandbox({ preset, params, setParams }: { preset: Preset; params: Params; setParams: (f: (p: Params) => Params) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-[#a0947e] leading-relaxed">{preset.blurb}</p>
      {preset.sliders.map((s) => (
        <label key={s.key} className="block">
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-[#c9bfa8]">{s.label}</span>
            <span className="font-mono text-[#ead080]">{s.fmt(params[s.key])}</span>
          </div>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={params[s.key]}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setParams((p) => ({ ...p, [s.key]: val }));
            }}
            className="w-full accent-[#d4b050]"
          />
        </label>
      ))}
      <button
        onClick={() => setParams(() => ({ ...preset.defaults }))}
        className="self-start text-[11px] text-[#a0947e] hover:text-[#ead080] underline"
      >
        ↺ valores por defecto
      </button>
    </div>
  );
}
