/**
 * GCODE-K1 — La Forja → código G real para la Creality K1 (corre Klipper, acepta G-code
 * Marlin). El sistema que pidió el usuario: del toolpath + los LÍMITES FÍSICOS al G-code.
 *
 * Poisson/fusión A NUESTRO FAVOR: lo que decide si dos cordones vecinos se VUELVEN uno es
 * el campo térmico (ec. de calor/Poisson) contra la ventana soldable. El G-code lo aterriza
 * con el VENTILADOR (M106): fan ALTO enfría rápido → los gaps ≥ g_min(fanOn) NO sueldan
 * (= movimiento, print-in-place); fan BAJO mantiene caliente → suelda (= rígido). El campo
 * de UNIONES (fundido/holgura/cuello/hilo) del operador 𝔄 se vuelve fan + gap + flujo aquí.
 *
 * Real: extrusión volumétrica, velocidad CAPADA por el flujo máx (32 mm³/s), aceleración y
 * temperaturas de la K1, retracción. Puro, testeable. Unidades mm, s, °C.
 */
import { K1, fusionGapMin } from './printsim';
import { discLayerToolpath, type Seg } from './generador-impresion';

const FIL_DIA = 1.75, FIL_AREA = Math.PI * (FIL_DIA / 2) ** 2; // mm²
const PLA = { nozzleC: 210, glassC: 60 }; // °C de deposición / Tg (de printsim.PLA)

// ── Extrusión volumétrica: E (mm de filamento) por mm de recorrido ──
export function extrusionPerMm(lineWidth: number, layerH: number): number {
  return +((lineWidth * layerH) / FIL_AREA).toFixed(6);
}
/** Velocidad CAPADA por el flujo máximo de la K1: v ≤ maxFlow/(ancho·capa). */
export function speedCapByFlow(speed: number, lineWidth: number, layerH: number, maxFlow = K1.maxFlow): number {
  const vMax = maxFlow / (lineWidth * layerH);
  return +Math.min(speed, vMax, K1.maxSpeed).toFixed(1);
}

// ── Campo de UNIONES → parámetros de impresión (Poisson a favor) ──
export type Bond = 'fundido' | 'holgura' | 'cuello' | 'hilo';
export function bondParams(bond: Bond): { gapMm: number; fanPct: number; note: string } {
  const gOn = fusionGapMin(K1.fanOn_h), gOff = fusionGapMin(K1.fanOff_h);
  switch (bond) {
    case 'fundido': return { gapMm: 0, fanPct: 20, note: `gap 0 + fan bajo → suelda (rígido). g_min sin fan ${gOff.toFixed(2)}` };
    case 'holgura': return { gapMm: +(gOn + 0.1).toFixed(2), fanPct: 100, note: `gap ≥ ${gOn.toFixed(2)} + fan 100% → NO suelda (gira)` };
    case 'cuello': return { gapMm: 0, fanPct: 60, note: 'alma delgada: suelda pero rompe por área (frangible)' };
    case 'hilo': return { gapMm: +(gOn + 0.2).toFixed(2), fanPct: 100, note: 'tendón: stringing controlado, fan alto + sin retracción' };
  }
}

// ── Cabecera / pie de la K1 ──
export interface GcodeOpts {
  nozzleC?: number; bedC?: number; layerH?: number; lineWidth?: number; fanPct?: number;
  perimSpeed?: number; infillSpeed?: number; travelSpeed?: number; zTop?: number;
}
function fill(o: GcodeOpts) {
  return {
    nozzleC: Math.min(o.nozzleC ?? PLA.nozzleC, K1.hotendMaxC),
    bedC: Math.min(o.bedC ?? PLA.glassC, K1.bedMaxC),
    layerH: o.layerH ?? 0.2, lineWidth: o.lineWidth ?? K1.nozzle,
    fanPct: o.fanPct ?? 100, // print-in-place: fan ALTO por defecto (gaps no sueldan)
    travelSpeed: o.travelSpeed ?? 500, zTop: o.zTop ?? 50,
  };
}
export function gcodeHeader(o: GcodeOpts): string[] {
  const c = fill(o);
  return [
    '; ── Forja → Creality K1 (Klipper) ──',
    `; print-in-place: fan ${c.fanPct}% → gaps ≥ ${fusionGapMin(K1.fanOn_h).toFixed(2)}mm NO sueldan (límite de fusión/Poisson)`,
    `M140 S${c.bedC}`, `M104 S${c.nozzleC}`, `M190 S${c.bedC}`, `M109 S${c.nozzleC}`,
    'G28', 'G90', 'M82', 'G92 E0', `M204 S${K1.maxAccel}`,
    `M106 S${Math.round((c.fanPct / 100) * 255)}`,
    '; línea de purga',
    'G1 Z0.3 F600', 'G1 X5 Y20 F3000', 'G1 X5 Y180 E14 F1500', 'G92 E0',
  ];
}
export function gcodeFooter(o: GcodeOpts): string[] {
  const c = fill(o);
  return ['; ── fin ──', 'M104 S0', 'M140 S0', 'M107', 'G1 E-3 F1800', `G1 Z${(c.zTop + 10).toFixed(1)} F600`, 'G28 X Y', 'M84'];
}

// ── Emitir una capa (devuelve líneas + E acumulado) ──
export interface Layer { z: number; segs: Seg[]; }
const f60 = (mmps: number) => Math.round(mmps * 60); // mm/s → F (mm/min)
export function emitLayer(layer: Layer, e0: number, o: GcodeOpts): { lines: string[]; e: number } {
  const c = fill(o);
  const ePerMm = extrusionPerMm(c.lineWidth, c.layerH);
  const lines: string[] = [`;LAYER z=${layer.z.toFixed(2)}`, `G1 Z${layer.z.toFixed(3)} F600`];
  let e = e0;
  for (const s of layer.segs) {
    if (!s.pts.length) continue;
    const v = speedCapByFlow(s.speed, c.lineWidth, c.layerH);
    if (!s.extrude) { const p = s.pts[s.pts.length - 1]; lines.push(`G0 X${p.x.toFixed(3)} Y${p.y.toFixed(3)} F${f60(c.travelSpeed)}`); continue; }
    let prev = s.pts[0];
    lines.push(`G1 X${prev.x.toFixed(3)} Y${prev.y.toFixed(3)} F${f60(v)}`); // ir al inicio del cordón
    for (let i = 1; i < s.pts.length; i++) {
      const p = s.pts[i]; e += Math.hypot(p.x - prev.x, p.y - prev.y) * ePerMm;
      lines.push(`G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)} E${e.toFixed(5)} F${f60(v)}`); prev = p;
    }
  }
  return { lines, e };
}

// ── Generar G-code completo desde capas ──
export interface GcodeResult { gcode: string; lines: number; filament_mm: number; filament_cm3: number; layers: number; est_min: number; }
export function generateGcode(layers: Layer[], o: GcodeOpts = {}): GcodeResult {
  const all: string[] = [...gcodeHeader(o)];
  let e = 0, sec = 0;
  const c = fill(o);
  for (const L of layers) {
    const r = emitLayer(L, e, o); all.push(...r.lines);
    // tiempo aprox: suma de longitudes / velocidad por seg
    for (const s of L.segs) { let len = 0; for (let i = 1; i < s.pts.length; i++) len += Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y); sec += len / (s.extrude ? speedCapByFlow(s.speed, c.lineWidth, c.layerH) : c.travelSpeed); }
    e = r.e;
  }
  all.push(...gcodeFooter(o));
  return {
    gcode: all.join('\n'), lines: all.length,
    filament_mm: +e.toFixed(1), filament_cm3: +(e * FIL_AREA / 1000).toFixed(2),
    layers: layers.length, est_min: +(sec / 60).toFixed(1),
  };
}

// ── DEMO: el disco cicloidal a G-code real (toolpath apilado en Z) ──
export function discToGcode(p: { lobes: number; R: number; Rr: number; E: number; shaftD: number; outPinD: number; outPins: number; T: number }, o: GcodeOpts = {}): GcodeResult {
  const layerH = o.layerH ?? 0.2;
  const tp = discLayerToolpath({ lobes: p.lobes, R: p.R, Rr: p.Rr, E: p.E, shaftD: p.shaftD, outPinD: p.outPinD, outPins: p.outPins });
  const n = Math.max(1, Math.round(p.T / layerH));
  const layers: Layer[] = Array.from({ length: n }, (_, i) => ({ z: +((i + 1) * layerH).toFixed(3), segs: tp.segs }));
  return generateGcode(layers, { ...o, zTop: p.T });
}
