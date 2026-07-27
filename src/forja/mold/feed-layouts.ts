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
  cavities: Array<{ x: number; y: number; tStartS: number;
    /** llenado de LA CAVIDAD: V_cav/V̇_cav (Kazmer: fórmula, no forma) */
    tFillS: number;
    /** dónde la TOCA el gate — de ahí nace su frente radial */
    gx: number; gy: number; gz: number }>;
  totalFillS: number;
  rows: Array<{ k: string; v: string; ref: string }>;
}

export const CAV_R = 8, CAV_H = 10, CAV_VOL_CC = Math.PI * CAV_R * CAV_R * CAV_H / 1000;

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
    const gx = h.x + drop * 0.7, gy = h.y;
    cavities.push({ x: gx + CAV_R - 1.5, y: gy, tStartS: h.t + tFill,
      tFillS: CAV_VOL_CC / (Vdot / nCav), gx, gy, gz: -drop });
  }
  const totalFillS = Math.max(...cavities.map((c) => c.tStartS + c.tFillS));
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
    const ux = b[0] / R, uy = b[1] / R;
    cavities.push({ x: b[0] + ux * (CAV_R - 1.5), y: b[1] + uy * (CAV_R - 1.5),
      tStartS: tSprue + tBrazo, tFillS: CAV_VOL_CC / VdotBrazo, gx: b[0], gy: b[1], gz: 0 });
  }
  return {
    segs, cavities, totalFillS: tSprue + tBrazo + CAV_VOL_CC / VdotBrazo,
    rows: [
      { k: 'red', v: `radial ×${nCav} desde el diafragma`, ref: 'Fig 6.15 — balanceada, poco volumen' },
      { k: 'reparto de carga', v: `V̇ ${Vdot} → ${VdotBrazo.toFixed(1)} cc/s por brazo (÷${nCav})`, ref: 'Eq 6.1 con n=N' },
      { k: '⌀ brazo', v: `${(2 * rBrazo).toFixed(1)} mm (sprue ⌀${(2 * rSprue).toFixed(1)})`, ref: 'D/√N + fresas estándar' },
    ],
  };
}

/** Fig 6.13 — SERIE: 1 primario largo, secundarios saliendo a intervalos.
 *  NATURALMENTE DESBALANCEADA (las cavidades lejanas llenan tarde — el flujo
 *  lo ENSEÑA) + balanceo ARTIFICIAL del libro: los secundarios cercanos al
 *  sprue van MÁS DELGADOS (Eq 6.8 con el ΔP que le sobra a cada ruta). */
export function layoutSeries(o: {
  nPairs?: number; pitchMm?: number; VdotCcS?: number; material?: string; sprueLenMm?: number;
}): FeedNetwork {
  const nP = o.nPairs ?? 4;
  const pitch = o.pitchMm ?? 42, Lsec = 30;
  const Vdot = o.VdotCcS ?? 60;
  const m = FEED_MATERIALS[o.material ?? 'ABS'] ?? FEED_MATERIALS.ABS;
  const Lsprue = o.sprueLenMm ?? 70;
  const segs: FeedSeg[] = [];
  const rSprue = Math.max(2.5, minRunnerRadius(m, Lsprue / 1000, Vdot * 1e-6, 10e6) * 1000);
  const tSprue = fillS(rSprue, Lsprue, Vdot);
  segs.push({ a: [0, 0, Lsprue], b: [0, 0, 0], rMm: rSprue, level: 'sprue', VdotCcS: Vdot, tStartS: 0, tFillS: tSprue });
  const rPrim = Math.max(1.5, steelSafeDiaMm(2 * rSprue / Math.SQRT2) / 2);
  const cavities: FeedNetwork['cavities'] = [];
  const VdotCav = Vdot / (2 * nP);
  // ΔP de la ruta MÁS LARGA fija el presupuesto; a cada secundario le queda el resto
  const dPfar = 8e6;
  let t = tSprue;
  for (let i = 0; i < nP; i++) {
    const x0 = i * pitch, x1 = (i + 1) * pitch;
    const VdotTr = Vdot * (1 - (2 * i) / (2 * nP));           // el primario pierde carga en cada par
    const tTr = fillS(rPrim, pitch, VdotTr);
    segs.push({ a: [x0, 0, 0], b: [x1, 0, 0], rMm: rPrim, level: 'primario', VdotCcS: VdotTr, tStartS: t, tFillS: tTr });
    t += tTr;
    // balanceo artificial: fracción de ΔP restante ∝ cercanía → R menor cerca (Eq 6.8)
    const frac = (i + 1) / nP;
    const rSec = Math.max(0.9, minRunnerRadius(m, Lsec / 1000, VdotCav * 1e-6, dPfar * (2 - frac)) * 1000);
    const tSec = fillS(rSec, Lsec, VdotCav);
    for (const sgn of [1, -1]) {
      segs.push({ a: [x1, 0, 0], b: [x1, sgn * Lsec, 0], rMm: rSec, level: 'secundario', VdotCcS: VdotCav, tStartS: t, tFillS: tSec });
      cavities.push({ x: x1, y: sgn * (Lsec + CAV_R - 1.5), tStartS: t + tSec,
        tFillS: CAV_VOL_CC / VdotCav, gx: x1, gy: sgn * Lsec, gz: 0 });
    }
  }
  return {
    segs, cavities, totalFillS: Math.max(...cavities.map((c) => c.tStartS + c.tFillS)),
    rows: [
      { k: 'red', v: `SERIE 1×${2 * nP} — compacta pero DESBALANCEADA`, ref: 'Fig 6.13 · las lejanas llenan tarde (míralo en 💧)' },
      { k: 'balanceo artificial', v: 'secundarios cercanos MÁS delgados', ref: '§6.4.6/Fig 6.13 · Eq 6.8 con el ΔP sobrante por ruta' },
      { k: 'advertencia del libro', v: 'no garantiza calidad pareja al EMPACAR', ref: '§6.2.4 · por eso las precisas usan ramificada/radial' },
    ],
  };
}

/** Fig 6.16 — HÍBRIDA ramificada-radial: sprue → 2 primarios → 2 secundarios
 *  c/u → CLUSTER RADIAL de 4 terciarios en cada punta = 16 cavidades.
 *  "Menos material que la ramificada, balance natural" (p.136). */
export function layoutHybrid(o: {
  VdotCcS?: number; material?: string; sprueLenMm?: number; pitchMm?: number;
}): FeedNetwork {
  const Vdot = o.VdotCcS ?? 60;
  const m = FEED_MATERIALS[o.material ?? 'ABS'] ?? FEED_MATERIALS.ABS;
  const Lsprue = o.sprueLenMm ?? 70;
  const pitch = o.pitchMm ?? 58, Rrad = 26;
  const segs: FeedSeg[] = [];
  const rSprue = Math.max(2.5, minRunnerRadius(m, Lsprue / 1000, Vdot * 1e-6, 10e6) * 1000);
  const tSprue = fillS(rSprue, Lsprue, Vdot);
  segs.push({ a: [0, 0, Lsprue], b: [0, 0, 0], rMm: rSprue, level: 'sprue', VdotCcS: Vdot, tStartS: 0, tFillS: tSprue });
  const rPrim = Math.max(1.5, steelSafeDiaMm(2 * rSprue / Math.SQRT2) / 2);
  const rSec = Math.max(1.25, steelSafeDiaMm(2 * rPrim / Math.SQRT2) / 2);
  const rTer = Math.max(0.9, steelSafeDiaMm(2 * rSec / 2) / 2);          // Eq 6.1 con n=4
  const tPrim = fillS(rPrim, pitch, Vdot / 2);
  const tSec = fillS(rSec, pitch * 0.7, Vdot / 4);
  const tTer = fillS(rTer, Rrad, Vdot / 16);
  const cavities: FeedNetwork['cavities'] = [];
  for (const sx of [1, -1]) {
    segs.push({ a: [0, 0, 0], b: [sx * pitch, 0, 0], rMm: rPrim, level: 'primario', VdotCcS: Vdot / 2, tStartS: tSprue, tFillS: tPrim });
    for (const sy of [1, -1]) {
      const cx = sx * pitch, cy = sy * pitch * 0.7;
      segs.push({ a: [cx, 0, 0], b: [cx, cy, 0], rMm: rSec, level: 'secundario', VdotCcS: Vdot / 4, tStartS: tSprue + tPrim, tFillS: tSec });
      for (let k = 0; k < 4; k++) {
        const th = (k / 4) * 2 * Math.PI + Math.PI / 4;
        const b: [number, number, number] = [cx + Rrad * Math.cos(th), cy + Rrad * Math.sin(th), 0];
        segs.push({ a: [cx, cy, 0], b, rMm: rTer, level: 'terciario-radial', VdotCcS: Vdot / 16, tStartS: tSprue + tPrim + tSec, tFillS: tTer });
        const vx = (b[0] - cx) / Rrad, vy = (b[1] - cy) / Rrad;
        cavities.push({ x: b[0] + vx * (CAV_R - 1.5), y: b[1] + vy * (CAV_R - 1.5),
          tStartS: tSprue + tPrim + tSec + tTer, tFillS: CAV_VOL_CC / (Vdot / 16), gx: b[0], gy: b[1], gz: 0 });
      }
    }
  }
  return {
    segs, cavities, totalFillS: tSprue + tPrim + tSec + tTer + CAV_VOL_CC / (Vdot / 16),
    rows: [
      { k: 'red', v: 'HÍBRIDA ramificada→4 clusters radiales ×4 = 16', ref: 'Fig 6.16 · menos material + balance natural (p.136)' },
      { k: 'reparto', v: `V̇ ${Vdot}→${(Vdot / 16).toFixed(1)} cc/s (½·½·¼)`, ref: 'Eq 6.1 por unión' },
      { k: '⌀ cadena', v: `${(2 * rSprue).toFixed(1)}→${(2 * rPrim).toFixed(1)}→${(2 * rSec).toFixed(1)}→${(2 * rTer).toFixed(1)} mm`, ref: 'D/√n + fresas §6.5.4' },
    ],
  };
}
