/**
 * REDES DE ALIMENTACIÓN — las figuras del libro como GEOMETRÍA + TIEMPO:
 *   Fig 6.14 ramificada (2 primarios → 4 secundarios → 8 terciarios → 16)
 *   Fig 6.15 radial (N primarios desde el diafragma del sprue)
 *   §7.2.7 gates SUMERGIDOS (túnel a 45°, taper 20°, ⌀ chico en la pieza)
 * La CARGA SE REPARTE: en cada bifurcación V̇ se divide entre las ramas y el
 * ⚠⚠ DESVIACIÓN GRAVE DEL LIBRO — hallada por el pliego de análisis (A-77), 2026-08-06.
 * Estos layouts dimensionan con Eq (6.1) D_down = D_up/√n, y el libro la presenta
 * como CONTRAEJEMPLO, no como regla. Literal de §6.4: conserva la velocidad lineal
 * pero "the resulting designs are inferior" en ΔP y en material. El propio pliego de
 * UI lo tenía bien extraído y nosotros hicimos lo contrario:
 *   R-061 "Regla histórica mostrada SOLO como contraejemplo … la UI la enseña y
 *          explica por qué NO se usa"
 *   R-116 "si el usuario escala por √n, la UI lo DETECTA y propone el solver por
 *          restricción de ΔP"
 * El sustituto correcto YA EXISTE y no se usa: reparto por longitud + solver de ΔP
 * en `feed.ts`. Mientras se recablea, estos layouts quedan MARCADOS: producen el
 * diseño que Kazmer llama inferior. NO es una preferencia de estilo — cambia el ΔP
 * y el material del árbol de colada.
 * diámetro baja con Eq (6.1) D_down = D_up/√n (velocidad constante), luego
 * Eq (6.8) valida contra el ΔP asignado. Cada segmento sabe CUÁNDO le llega
 * el frente (t_start = suma de llenados aguas arriba) — el flujo se anima
 * por TIEMPO DE RUTA, no por altura. Sistema STANDALONE: se conecta a
 * cualquier molde después.
 */
import { FEED_MATERIALS, minRunnerRadius, steelSafeDiaMm, pressureDropRunner } from './feed';

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
  /** el cálculo narrado (fórmula + sustitución + resultado) — pantalla de fórmulas */
  pasos?: import('./cooling-design').CalcPaso[];
}

export const CAV_R = 8, CAV_H = 10, CAV_VOL_CC = Math.PI * CAV_R * CAV_R * CAV_H / 1000;
/** GATE DE BORDE (Fig 7.5): tierra corta y DELGADA runner→pared, medio-sumergida. */
export const EDGE_GATE_L = 2.5, EDGE_GATE_R = 0.75;

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
    const rTeor = rUp / Math.SQRT2;                     // ⚠ Eq (6.1): el CONTRAEJEMPLO del libro (ver cabecera)
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
    // TÚNEL (Fig 7.12): CONO que baja a 45° y PERFORA la pared bajo la
    // partición con orificio chico — la cavidad se coloca para que el tip
    // quede 0.6 mm DENTRO de su pared.
    const drop = 3.5, run = 5;
    const tFill = fillS(rGate, Math.hypot(run, drop), Vdot / nCav);
    const gx = h.x + run, gy = h.y, gz = -drop;
    segs.push({
      a: [h.x, h.y, 0], b: [gx, gy, gz], rMm: rGate,
      level: 'gate-sumergido', VdotCcS: Vdot / nCav, tStartS: h.t, tFillS: tFill,
    });
    cavities.push({ x: gx + CAV_R - 0.6, y: gy, tStartS: h.t + tFill,
      tFillS: CAV_VOL_CC / (Vdot / nCav), gx, gy, gz });
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
    const gTip: [number, number, number] = [b[0] + ux * EDGE_GATE_L, b[1] + uy * EDGE_GATE_L, -0.9];
    const tGate = fillS(EDGE_GATE_R, EDGE_GATE_L, VdotBrazo);
    segs.push({ a: b, b: gTip, rMm: EDGE_GATE_R, level: 'gate-borde', VdotCcS: VdotBrazo, tStartS: tSprue + tBrazo, tFillS: tGate });
    cavities.push({ x: gTip[0] + ux * (CAV_R - 0.6), y: gTip[1] + uy * (CAV_R - 0.6),
      tStartS: tSprue + tBrazo + tGate, tFillS: CAV_VOL_CC / VdotBrazo, gx: gTip[0], gy: gTip[1], gz: gTip[2] });
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
      const gTip: [number, number, number] = [x1, sgn * (Lsec + EDGE_GATE_L), -0.9];
      const tGate = fillS(EDGE_GATE_R, EDGE_GATE_L, VdotCav);
      segs.push({ a: [x1, sgn * Lsec, 0], b: gTip, rMm: EDGE_GATE_R, level: 'gate-borde', VdotCcS: VdotCav, tStartS: t + tSec, tFillS: tGate });
      cavities.push({ x: x1, y: sgn * (Lsec + EDGE_GATE_L + CAV_R - 0.6), tStartS: t + tSec + tGate,
        tFillS: CAV_VOL_CC / VdotCav, gx: gTip[0], gy: gTip[1], gz: gTip[2] });
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
        const gTip: [number, number, number] = [b[0] + vx * EDGE_GATE_L, b[1] + vy * EDGE_GATE_L, -0.9];
        const tGate = fillS(EDGE_GATE_R, EDGE_GATE_L, Vdot / 16);
        segs.push({ a: b, b: gTip, rMm: EDGE_GATE_R, level: 'gate-borde', VdotCcS: Vdot / 16, tStartS: tSprue + tPrim + tSec + tTer, tFillS: tGate });
        cavities.push({ x: gTip[0] + vx * (CAV_R - 0.6), y: gTip[1] + vy * (CAV_R - 0.6),
          tStartS: tSprue + tPrim + tSec + tTer + tGate, tFillS: CAV_VOL_CC / (Vdot / 16), gx: gTip[0], gy: gTip[1], gz: gTip[2] });
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

/**
 * RED DE RESISTENCIAS — dirección ANÁLISIS (§6.4.6): dada la geometría, ¿qué
 * V̇ le toca REALMENTE a cada rama? Con ΔP = K·V̇ⁿ (power-law, Eq 6.5) y el
 * mismo n en toda la red, el álgebra es CERRADA como resistores generalizados:
 *   serie:    C = Ca + Cb
 *   paralelo: C = ( Σᵢ (1/Cᵢ)^(1/n) )⁻ⁿ     (conductancias^(1/n) se suman)
 *   reparto:  V̇ᵢ ∝ (1/Cᵢ)^(1/n)             (ΔP igual en rutas paralelas)
 * Se reduce hojas→tronco (postorden) y se reparte tronco→hojas (preorden).
 * El "balanceo artificial" del libro es DISEÑAR para que estas C queden
 * iguales — esta función es el juez que dice si lo logró.
 * MUTA la red: V̇/tiempos de cada segmento y cavidad pasan a ser los físicos.
 */
export function applyResistanceNetwork(net: FeedNetwork, material = 'ABS'): void {
  const m = FEED_MATERIALS[material] ?? FEED_MATERIALS.ABS;
  const n = m.n;
  const segs = net.segs;
  const keyOf = (pt: [number, number, number]) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)},${pt[2].toFixed(2)}`;
  const byStart = new Map<string, number[]>();
  segs.forEach((sg, i) => { const k = keyOf(sg.a); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k)!.push(i); });
  const children = segs.map((sg) => byStart.get(keyOf(sg.b)) ?? []);
  // K de Eq 6.5 con V̇=1 m³/s (unidades SI)
  const K = segs.map((sg) => pressureDropRunner(m, { name: sg.level, L: segLen(sg) / 1000, R: sg.rMm / 1000, Vdot: 1 }));
  const C = new Float64Array(segs.length);
  const post = (i: number): number => {
    if (!children[i].length) { C[i] = K[i]; return C[i]; }
    let sum = 0;
    for (const c of children[i]) sum += Math.pow(1 / post(c), 1 / n);
    C[i] = K[i] + Math.pow(sum, -n);
    return C[i];
  };
  post(0);                                              // el sprue es la raíz
  const pre = (i: number, VdotM3s: number, t0: number) => {
    segs[i].VdotCcS = VdotM3s * 1e6;
    segs[i].tStartS = t0;
    segs[i].tFillS = (Math.PI * segs[i].rMm * segs[i].rMm * segLen(segs[i]) / 1000) / (VdotM3s * 1e6);
    const w = children[i].map((c) => Math.pow(1 / C[c], 1 / n));
    const W = w.reduce((a2, b2) => a2 + b2, 0);
    children[i].forEach((c, j) => pre(c, VdotM3s * (w[j] / W), t0 + segs[i].tFillS));
  };
  pre(0, segs[0].VdotCcS * 1e-6, 0);
  // cavidades: cuelgan del gate cuyo extremo b es su punto de contacto
  let vmin = Infinity, vmax = 0;
  for (const c of net.cavities) {
    const gi = segs.findIndex((sg) => Math.abs(sg.b[0] - c.gx) < 0.01 && Math.abs(sg.b[1] - c.gy) < 0.01 && Math.abs(sg.b[2] - c.gz) < 0.01);
    if (gi >= 0) {
      c.tStartS = segs[gi].tStartS + segs[gi].tFillS;
      c.tFillS = CAV_VOL_CC / segs[gi].VdotCcS;
      vmin = Math.min(vmin, segs[gi].VdotCcS); vmax = Math.max(vmax, segs[gi].VdotCcS);
    }
  }
  net.totalFillS = Math.max(...net.cavities.map((c) => c.tStartS + c.tFillS));
  net.rows.push({
    k: '⚖ V̇ REAL por cavidad',
    v: `${vmin.toFixed(1)}–${vmax.toFixed(1)} cc/s${vmax / vmin > 1.05 ? ` · DESBALANCE ${((vmax / vmin - 1) * 100).toFixed(0)}%` : ' · balanceada ✓'}`,
    ref: 'red de resistencias §6.4.6: ΔP igual en rutas paralelas · serie C=Ca+Cb · paralelo (Σ(1/C)^(1/n))⁻ⁿ',
  });
}

/** flowT por vértice para una malla del FUNDIDO: t de llegada del segmento
 *  más cercano (el mismo criterio del demo, exportado para el MOLDE real). */
export function flowTForSegs(positions: Float32Array, segs: FeedSeg[]): Float32Array {
  const nV = positions.length / 3;
  const out = new Float32Array(nV);
  for (let i = 0; i < nV; i++) {
    const px = positions[3 * i], py = positions[3 * i + 1], pz = positions[3 * i + 2];
    let best = Infinity, bt = 0;
    for (const sg of segs) {
      const ux = sg.b[0] - sg.a[0], uy = sg.b[1] - sg.a[1], uz = sg.b[2] - sg.a[2];
      const L2 = ux * ux + uy * uy + uz * uz || 1;
      const f = Math.max(0, Math.min(1, ((px - sg.a[0]) * ux + (py - sg.a[1]) * uy + (pz - sg.a[2]) * uz) / L2));
      const qx = sg.a[0] + f * ux - px, qy = sg.a[1] + f * uy - py, qz = sg.a[2] + f * uz - pz;
      const d = qx * qx + qy * qy + qz * qz - sg.rMm * sg.rMm;
      if (d < best) { best = d; bt = sg.tStartS + f * sg.tFillS; }
    }
    out[i] = bt;
  }
  return out;
}

/**
 * RED PARA LA REJILLA REAL DEL MOLDE (la integración: canales ↔ molde).
 * Coordenadas ABSOLUTAS de placa: sprue en el centro del molde bajando hasta
 * la partición (zPart), primarios ±x sobre la partición a cada columna de
 * cavidades, secundarios ±y hasta el RIM de cada vaso, GATE DE BORDE (Fig 7.5)
 * entrando 0.6 mm en la pared. Radios por Eq 6.1+6.8 con fresas estándar y
 * reparto REAL por red de resistencias (§6.4.6).
 */
export function layoutForGrid(
  cells: Array<{ cx: number; cy: number }>,
  o: {
    centerX: number; centerY: number; zPart: number; sprueTopZ: number;
    rimRmm: number; partVolCc: number; material?: string; fillTimeS?: number;
  },
): FeedNetwork {
  const m = FEED_MATERIALS[o.material ?? 'PP'] ?? FEED_MATERIALS.PP;
  const Vdot = (o.partVolCc * cells.length) / (o.fillTimeS ?? 1);
  const Lsprue = o.sprueTopZ - o.zPart;
  const segs: FeedSeg[] = [];
  const rSprue = Math.max(2.5, minRunnerRadius(m, Lsprue / 1000, Vdot * 1e-6, 15e6) * 1000);
  segs.push({ a: [o.centerX, o.centerY, o.sprueTopZ], b: [o.centerX, o.centerY, o.zPart], rMm: rSprue, level: 'sprue', VdotCcS: Vdot, tStartS: 0, tFillS: 0 });
  const zR = o.zPart;                                     // runners SOBRE la partición
  const colXs = [...new Set(cells.map((c) => c.cx))].sort((a, b) => a - b);
  const rPrim = Math.max(1.5, steelSafeDiaMm(2 * rSprue / Math.SQRT2) / 2);
  const rSec = Math.max(1.25, steelSafeDiaMm(2 * rPrim / Math.SQRT2) / 2);
  const cavities: FeedNetwork['cavities'] = [];
  for (const cx of colXs) {
    segs.push({ a: [o.centerX, o.centerY, zR], b: [cx, o.centerY, zR], rMm: rPrim, level: 'primario', VdotCcS: 0, tStartS: 0, tFillS: 0 });
    for (const c of cells.filter((q) => q.cx === cx)) {
      const dy = Math.sign(c.cy - o.centerY) || 1;
      const rimY = c.cy - dy * o.rimRmm;                  // punto del rim hacia el runner
      const secEnd: [number, number, number] = [cx, rimY - dy * EDGE_GATE_L, zR];
      segs.push({ a: [cx, o.centerY, zR], b: secEnd, rMm: rSec, level: 'secundario', VdotCcS: 0, tStartS: 0, tFillS: 0 });
      const gTip: [number, number, number] = [cx, rimY + dy * 0.6, zR - 0.9];   // 0.6 DENTRO de la pared
      segs.push({ a: secEnd, b: gTip, rMm: EDGE_GATE_R, level: 'gate-borde', VdotCcS: 0, tStartS: 0, tFillS: 0 });
      cavities.push({ x: c.cx, y: c.cy, tStartS: 0, tFillS: 0, gx: gTip[0], gy: gTip[1], gz: gTip[2] });
    }
  }
  const net: FeedNetwork = {
    segs, cavities, totalFillS: 0,
    rows: [
      { k: 'red', v: `rejilla ${cells.length} cav · sprue centro + ${colXs.length} primarios + gates de borde al RIM`, ref: 'Figs 6.5/6.14 + 7.5 sobre la rejilla REAL del molde' },
      { k: '⌀ cadena', v: `sprue ${(2 * rSprue).toFixed(1)} → prim ${(2 * rPrim).toFixed(1)} → sec ${(2 * rSec).toFixed(1)} → gate ${(2 * EDGE_GATE_R).toFixed(1)} mm`, ref: 'Eq 6.1 D/√2 + Eq 6.8 + fresas §6.5.4' },
    ],
  };
  applyResistanceNetwork(net, o.material ?? 'PP');        // V̇/tiempos FÍSICOS
  // llenado de cada vaso con SU caudal real (V/V̇ — Kazmer, no forma)
  for (const c of net.cavities) c.tFillS = o.partVolCc / Math.max(1e-6, segByTip(net, c).VdotCcS);
  net.totalFillS = Math.max(...net.cavities.map((c) => c.tStartS + c.tFillS));
  // ── EL CÁLCULO NARRADO (pantalla de fórmulas del componente colada) ───────
  const f2 = (x: number, d = 2) => +x.toFixed(d);
  const vDots = net.cavities.map((c) => segByTip(net, c).VdotCcS);
  const vMin = Math.min(...vDots), vMax = Math.max(...vDots);
  const volColada = net.segs.reduce((a, sg) => {
    const L = Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1], sg.b[2] - sg.a[2]);
    return a + Math.PI * sg.rMm * sg.rMm * L / 1000;
  }, 0);
  const desb = vMax > 0 ? (vMax - vMin) / vMax * 100 : 0;
  net.pasos = [
    {
      titulo: 'Caudal total (lo fija la cavidad, no la máquina)',
      formula: 'V̇ = n_cav · V_pieza / t_llenado',
      sustitucion: `${cells.length} · ${f2(o.partVolCc, 1)}cc / ${o.fillTimeS ?? 1}s`,
      resultado: `${f2(Vdot, 1)} cc/s`, ref: '§6.4.6', ok: true,
    },
    {
      titulo: 'Radio del sprue por caída de presión asignada',
      formula: 'R ≥ [ (ΔP/(k·L))·(n/(3n+1))ⁿ·(π/V̇)ⁿ ]^(−1/(3n+1))   (ley de potencia)',
      sustitucion: `ΔP=15 MPa · L=${f2(Lsprue, 0)}mm · k=${m.k} Pa·sⁿ · n=${m.n} (${o.material ?? 'PP'})`,
      resultado: `⌀ sprue = ${f2(2 * rSprue, 1)} mm`, ref: 'Eq 6.8 (de Eq 6.5)', ok: true,
    },
    {
      titulo: 'La cadena de diámetros (cada rama parte el flujo en 2)',
      formula: 'D_down = D_up/√2 → redondeado a FRESA estándar (steel-safe)',
      sustitucion: `${f2(2 * rSprue, 1)} → ${f2(2 * rSprue / Math.SQRT2, 2)}→${f2(2 * rPrim, 1)} → ${f2(2 * rPrim / Math.SQRT2, 2)}→${f2(2 * rSec, 1)} → gate ${f2(2 * EDGE_GATE_R, 1)}`,
      resultado: `⌀ ${f2(2 * rSprue, 1)} / ${f2(2 * rPrim, 1)} / ${f2(2 * rSec, 1)} / ${f2(2 * EDGE_GATE_R, 1)} mm`,
      ref: 'Eq 6.1 + §6.5.4', ok: true,
      nota: 'igual sección de corte por rama ⇒ mismo γ̇ y mismo ΔP en cada camino',
    },
    {
      titulo: 'Reparto del flujo por RED DE RESISTENCIAS (no por fe)',
      formula: 'C_serie = Ca+Cb · C_par = (Σ(1/Cᵢ)^(1/n))⁻ⁿ · V̇ᵢ ∝ (1/Cᵢ)^(1/n)',
      sustitucion: `n=${m.n} · hojas→tronco→hojas sobre ${net.segs.length} segmentos`,
      resultado: `V̇ por cavidad: ${f2(vMin, 1)}…${f2(vMax, 1)} cc/s (desbalance ${f2(desb, 1)}%)`,
      ref: '§6.4.6 + Eq 6.5', ok: desb < 5,
      nota: desb >= 5 ? 'desbalance > 5% — las cavidades NO llenan juntas (Fig 6.16: balancear R)' : 'las 4 ramas son gemelas ⇒ llenan a la vez',
    },
    {
      titulo: 'Llenado por cavidad (fórmula, no animación)',
      formula: 't_fill = V_cav / V̇_cav   ·   total = max(t_start + t_fill)',
      sustitucion: `${f2(o.partVolCc, 1)}cc / ${f2(vMax, 1)}cc/s`,
      resultado: `total ${f2(net.totalFillS, 2)} s`, ref: '§6.4.6', ok: true,
    },
    {
      titulo: 'Material que se va a la colada (regrind/scrap)',
      formula: 'V_colada = Σ π·r²·L   vs   V_piezas',
      sustitucion: `${f2(volColada, 2)}cc vs ${f2(o.partVolCc * cells.length, 1)}cc`,
      resultado: `${f2(volColada / (o.partVolCc * cells.length) * 100, 1)}% del disparo`,
      ref: 'Eq 6.6', ok: volColada < 0.2 * o.partVolCc * cells.length,
      nota: 'colada fría = material molido o tirado; >20% del disparo pide repensar la red',
    },
  ];
  return net;
}
function segByTip(net: FeedNetwork, c: { gx: number; gy: number; gz: number }): FeedSeg {
  return net.segs.find((sg) => Math.abs(sg.b[0] - c.gx) < 0.01 && Math.abs(sg.b[1] - c.gy) < 0.01 && Math.abs(sg.b[2] - c.gz) < 0.01) ?? net.segs[net.segs.length - 1];
}
