/**
 * REDES DE ALIMENTACIÓN — las figuras del libro como GEOMETRÍA + TIEMPO:
 *   Fig 6.14 ramificada (2 primarios → 4 secundarios → 8 terciarios → 16)
 *   Fig 6.15 radial (N primarios desde el diafragma del sprue)
 *   §7.2.7 gates SUMERGIDOS (túnel a 45°, taper 20°, ⌀ chico en la pieza)
 * La CARGA SE REPARTE: en cada bifurcación V̇ se divide entre las ramas y el
 * diámetro baja con Eq (6.1) D_down = D_up/√n (velocidad constante), luego
 * Eq (6.8) valida contra el ΔP asignado. Cada segmento sabe CUÁNDO le llega
 * el frente (t_start = suma de llenados aguas arriba) — el flujo se anima
 * por TIEMPO DE RUTA, no por altura. Sistema STANDALONE: se conecta a
 * cualquier molde después.
 */
import { FEED_MATERIALS, minRunnerRadius, steelSafeDiaMm } from './feed';

export interface FeedSeg {
  a: [number, number, number]; b: [number, number, number];
  rMm: number;
  level: string;               // sprue · primario · secundario · terciario · gate-sumergido
  VdotCcS: number;             // caudal por ESTE segmento (la carga repartida)
  tStartS: number;             // cuándo le llega el frente
  tFillS: number;              // cuánto tarda en llenarse
}
export interface FeedNetwork {
  segs: FeedSeg[];
  cavities: Array<{ x: number; y: number; tStartS: number }>;
  totalFillS: number;
  rows: Array<{ k: string; v: string; ref: string }>;
}

const segLen = (s: Pick<FeedSeg, 'a' | 'b'>) =>
  Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);

/** tiempo de llenado de un segmento = V/(V̇) — cámara lenta honesta del reparto. */
const fillS = (rMm: number, lenMm: number, VdotCcS: number) =>
  (Math.PI * rMm * rMm * lenMm / 1000) / Math.max(1e-6, VdotCcS);

/** Fig 6.14 — RAMIFICADA natural: sprue → 2 primarios (±x) → 2 secundarios
 *  c/u (±y) → 2 terciarios c/u (±x)… hasta nCav = 2^k cavidades. */
export function layoutBranched(o: {
  nCav?: 4 | 8 | 16; pitchMm?: number; VdotCcS?: number; material?: string;
  sprueLenMm?: number; dPAllocMPa?: number;
}): FeedNetwork {
  const nCav = o.nCav ?? 8;
  const pitch = o.pitchMm ?? 55;
  const Vdot = o.VdotCcS ?? 60;
  const m = FEED_MATERIALS[o.material ?? 'ABS'] ?? FEED_MATERIALS.ABS;
  const Lsprue = o.sprueLenMm ?? 70;
  const levels = Math.log2(nCav);                       // 2→1, 4→2, 8→3, 16→4
  const segs: FeedSeg[] = [];
  // SPRUE: Eq 6.8 con el ΔP asignado por longitud (ruta total ≈ Lsprue + levels·pitch)
  const Lruta = Lsprue + levels * pitch;
  const dP = (o.dPAllocMPa ?? 30) * 1e6;
  const rSprue = Math.max(2.5, minRunnerRadius(m, Lsprue / 1000, Vdot * 1e-6, dP * (Lsprue / Lruta)) * 1000);
  const tSprue = fillS(rSprue, Lsprue, Vdot);
  segs.push({ a: [0, 0, Lsprue], b: [0, 0, 0], rMm: rSprue, level: 'sprue', VdotCcS: Vdot, tStartS: 0, tFillS: tSprue });
  // NIVELES: en cada uno la carga SE PARTE EN 2 y el ⌀ baja /√2 (Eq 6.1) → steel-safe
  let heads: Array<{ x: number; y: number; t: number }> = [{ x: 0, y: 0, t: tSprue }];
  let rUp = rSprue;
  const names = ['primario', 'secundario', 'terciario', 'cuaternario'];
  for (let lv = 0; lv < levels; lv++) {
    const rTeor = rUp / Math.SQRT2;                     // Eq (6.1)
    const r = Math.max(1.25, steelSafeDiaMm(2 * rTeor) / 2);   // §6.5.4-6.5.5
    const VdotSeg = Vdot / Math.pow(2, lv + 1);         // LA CARGA REPARTIDA
    const L = pitch * Math.pow(0.72, lv);               // ramas más cortas al bajar
    const dir = lv % 2 === 0 ? [1, 0] : [0, 1];         // ±x, ±y alternado (Fig 6.14)
    const next: typeof heads = [];
    for (const h of heads) {
      const tFill = fillS(r, L, VdotSeg);
      for (const sgn of [1, -1]) {
        const b: [number, number, number] = [h.x + sgn * dir[0] * L, h.y + sgn * dir[1] * L, 0];
        segs.push({ a: [h.x, h.y, 0], b, rMm: r, level: names[lv] ?? `nivel${lv}`, VdotCcS: VdotSeg, tStartS: h.t, tFillS: tFill });
        next.push({ x: b[0], y: b[1], t: h.t + tFill });
      }
    }
    heads = next;
    rUp = r;
  }
  // GATES SUMERGIDOS §7.2.7: del final del runner BAJA a 45° hacia la pieza
  // (⌀ chico = pared/2; el túnel desgata solo al abrir). 20° de taper implícito.
  const rGate = Math.max(0.6, rUp * 0.35);
  const cavities: FeedNetwork['cavities'] = [];
  for (const h of heads) {
    const drop = 7;                                     // baja ~7 mm bajo la partición
    const tFill = fillS(rGate, drop * Math.SQRT2, Vdot / nCav);
    segs.push({
      a: [h.x, h.y, 0], b: [h.x + drop * 0.7, h.y, -drop], rMm: rGate,
      level: 'gate-sumergido', VdotCcS: Vdot / nCav, tStartS: h.t, tFillS: tFill,
    });
    cavities.push({ x: h.x + drop * 0.7 + 9, y: h.y, tStartS: h.t + tFill });
  }
  const totalFillS = Math.max(...cavities.map((c) => c.tStartS));
  const vol = segs.reduce((v, s) => v + Math.PI * s.rMm * s.rMm * segLen(s) / 1000, 0);
  return {
    segs, cavities, totalFillS,
    rows: [
      { k: 'red', v: `ramificada 2→${nCav} (${levels} niveles)`, ref: 'Fig 6.14 — balance NATURAL' },
      { k: 'reparto de carga', v: segs.filter((s) => s.level !== 'sprue' && s.level !== 'gate-sumergido').map((s) => '½').slice(0, 3).join('') + ` · V̇ ${Vdot}→${(Vdot / nCav).toFixed(1)} cc/s por cavidad`, ref: 'Eq 6.1: en cada unión V̇/2 y D/√2' },
      { k: '⌀ por nivel', v: segs.filter((s, i) => segs.findIndex((x) => x.level === s.level) === i).map((s) => `${s.level} ⌀${(2 * s.rMm).toFixed(1)}`).join(' · '), ref: 'Eq 6.8 + fresas estándar §6.5.4' },
      { k: 'V del sistema', v: `${vol.toFixed(1)} cc`, ref: 'Eq 6.6 · <30% de piezas §6.2.3' },
      { k: 'gates', v: `sumergidos ⌀${(2 * rGate).toFixed(1)} a 45°`, ref: '§7.2.7 · desgate AUTOMÁTICO al abrir' },
    ],
  };
}

/** Fig 6.15 — RADIAL: N primarios emanan del diafragma del sprue. */
export function layoutRadial(o: {
  nCav?: number; Rmm?: number; VdotCcS?: number; material?: string; sprueLenMm?: number;
}): FeedNetwork {
  const nCav = o.nCav ?? 12;
  const R = o.Rmm ?? 70;
  const Vdot = o.VdotCcS ?? 60;
  const m = FEED_MATERIALS[o.material ?? 'ABS'] ?? FEED_MATERIALS.ABS;
  const Lsprue = o.sprueLenMm ?? 70;
  const segs: FeedSeg[] = [];
  const rSprue = Math.max(2.5, minRunnerRadius(m, Lsprue / 1000, Vdot * 1e-6, 12e6) * 1000);
  const tSprue = fillS(rSprue, Lsprue, Vdot);
  segs.push({ a: [0, 0, Lsprue], b: [0, 0, 0], rMm: rSprue, level: 'sprue', VdotCcS: Vdot, tStartS: 0, tFillS: tSprue });
  const rBrazo = Math.max(1.25, steelSafeDiaMm(2 * rSprue / Math.sqrt(nCav)) / 2);  // Eq 6.1 con n=N
  const VdotBrazo = Vdot / nCav;
  const tBrazo = fillS(rBrazo, R, VdotBrazo);
  const cavities: FeedNetwork['cavities'] = [];
  for (let i = 0; i < nCav; i++) {
    const th = (i / nCav) * 2 * Math.PI;
    const b: [number, number, number] = [R * Math.cos(th), R * Math.sin(th), 0];
    segs.push({ a: [0, 0, 0], b, rMm: rBrazo, level: 'primario', VdotCcS: VdotBrazo, tStartS: tSprue, tFillS: tBrazo });
    cavities.push({ x: b[0] * 1.18, y: b[1] * 1.18, tStartS: tSprue + tBrazo });
  }
  return {
    segs, cavities, totalFillS: tSprue + tBrazo,
    rows: [
      { k: 'red', v: `radial ×${nCav} desde el diafragma`, ref: 'Fig 6.15 — balanceada, poco volumen' },
      { k: 'reparto de carga', v: `V̇ ${Vdot} → ${VdotBrazo.toFixed(1)} cc/s por brazo (÷${nCav})`, ref: 'Eq 6.1 con n=N' },
      { k: '⌀ brazo', v: `${(2 * rBrazo).toFixed(1)} mm (sprue ⌀${(2 * rSprue).toFixed(1)})`, ref: 'D/√N + fresas estándar' },
    ],
  };
}
