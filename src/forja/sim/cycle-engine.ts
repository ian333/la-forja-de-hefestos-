/**
 * MOTOR DE SIMULACIÓN DEL CICLO DE INYECCIÓN — el corazón físico (puro, por
 * pasos, node-testeable) que alimenta la vista SIMULACIÓN del Studio.
 * =====================================================================
 * TODO AL MISMO TIEMPO, del libro (Kazmer):
 *  · LLENADO: frente real avanzando por la cavidad a v̄ de diseño (cap 5);
 *    P(t) = ΔP power-law de la longitud YA llenada (Eq 5.22).
 *  · ESTRÉS: F_apertura(t) = P·A_proyectada vs F_clamp (Eq 5.29) →
 *    deflexión de placas δ(t) (Eq 12.10) → FUGA/FLASH si δ > venteo (cap 8/12).
 *    ESTO es lo que un simulador de moldes verifica.
 *  · TÉRMICO: FDM 2D k-armónica de la SECCIÓN del molde (cap 9 + effusividad),
 *    con textura exportable para la sección en vivo.
 *  · AGUA: el calor que cruza a los canales sale con el refrigerante:
 *    ΔT_agua = Q̇/(ṁ·cp) con el caudal del análisis (Eq 9.10+).
 */
import { pressureDropSegment, clampMetricTons, type MeltMaterial, ABS_MG47 } from '../mold/filling';
import { plateBending, TON_N } from '../mold/structural';

export type Phase = 'cierre' | 'inyeccion' | 'empaque' | 'enfriamiento' | 'apertura' | 'expulsion' | 'caida' | 'retorno';

export interface CycleParams {
  melt?: MeltMaterial;
  /** Longitud total de flujo (m) y espesor de pared (m). */
  flowLenM: number; wallM: number;
  /** Velocidad media del frente (m/s) — convergida del cap 5. */
  vMeanMs: number;
  /** Área proyectada de cavidades (m²) y clamp disponible (ton). */
  projAreaM2: number; clampTons: number;
  /** Flexión: claro, ancho y espesor de placa (m) — cap 12. */
  bendSpanM: number; bendWM: number; bendHM: number;
  /** Tiempos (s): enfriamiento (Eq 9.5) y carreras (mm). */
  tCoolS: number; openStrokeMm?: number; ejectStrokeMm?: number;
  /** Térmico 2D (sección): tamaño de celda (m) y rejilla. fillMode 'center' = el
   *  frente avanza SIMÉTRICO desde el centro del slab (pieza con gate central,
   *  p.ej. el vaso); 'edge' (default) = de un extremo al otro. */
  grid?: { nx: number; ny: number; hM: number; cavY0: number; cavY1: number; cavX0: number; cavX1: number; channels: Array<{ x: number; y: number; r: number }>; fillMode?: 'edge' | 'center' };
  /** Agua: caudal por circuito (m³/s) — del análisis de Reynolds cap 9. */
  coolantFlowM3s?: number;
}

const K_STEEL = 32, RC_STEEL = 7850 * 460, K_ABS = 0.19, RC_ABS = 1050 * 2345;

export interface CycleState {
  t: number; phase: Phase; cycle: number;
  fillFrac: number;                    // 0..1 del frente
  pressureMPa: number;                 // en el gate
  openForceTons: number; clampMarginTons: number;
  deflectionMm: number; flash: boolean;
  openMm: number; ejectMm: number; partDropMm: number; partVisible: boolean;
  meltTempC: number;                   // T̄ del plástico (para color)
  steelMaxC: number; waterOutC: number; heatToWaterW: number;
}

export function createCycleSim(p: CycleParams) {
  const melt = p.melt ?? ABS_MG47;
  const open = p.openStrokeMm ?? 90, eject = p.ejectStrokeMm ?? 45;
  const tFill = p.flowLenM / p.vMeanMs;
  const PH: Array<[Phase, number]> = [
    ['cierre', 0.8], ['inyeccion', tFill], ['empaque', 0.8], ['enfriamiento', p.tCoolS],
    ['apertura', 1.2], ['expulsion', 0.6], ['caida', 0.8], ['retorno', 1.2],
  ];
  const cycleT = PH.reduce((s, x) => s + x[1], 0);
  // ── térmico: rejilla 2D de la sección ──
  const g = p.grid ?? { nx: 220, ny: 120, hM: 1e-3, cavX0: 40, cavX1: 180, cavY0: 58, cavY1: 61, channels: [
    { x: 70, y: 32, r: 3.2 }, { x: 110, y: 32, r: 3.2 }, { x: 150, y: 32, r: 3.2 },
    { x: 70, y: 87, r: 3.2 }, { x: 110, y: 87, r: 3.2 }, { x: 150, y: 87, r: 3.2 }] };
  const N = g.nx * g.ny;
  const mat = new Uint8Array(N); const T = new Float32Array(N).fill(60); const filled = new Uint8Array(N);
  const id = (i: number, j: number) => j * g.nx + i;
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    if (j >= g.cavY0 && j < g.cavY1 && i >= g.cavX0 && i <= g.cavX1) mat[id(i, j)] = 1;
    for (const c of g.channels) if ((i - c.x) ** 2 + (j - c.y) ** 2 <= c.r * c.r) mat[id(i, j)] = 2;
  }
  const kOf = (k: number) => (mat[k] === 1 && filled[k] ? K_ABS : K_STEEL);
  const rcOf = (k: number) => (mat[k] === 1 && filled[k] ? RC_ABS : RC_STEEL);
  const dtTherm = (g.hM * g.hM) * RC_STEEL / (4 * K_STEEL) * 0.9;
  let heatToWaterJ = 0;
  const Tbuf = new Float32Array(N);                                // buffer reusado: 0 alloc/substep (60fps browser)
  const thermStep = (dt: number) => {
    // ceil, NUNCA round: garantiza sub ≤ dtTherm (estabilidad explícita FTCS).
    // Con round, un browser a 30fps (dt 0.033 > dtTherm 0.025) da steps=1 → diverge.
    let steps = Math.max(1, Math.min(60, Math.ceil(dt / dtTherm)));
    const sub = dt / steps;
    for (let s = 0; s < steps; s++) {
      const Tn = Tbuf; Tn.set(T);
      for (let j = 1; j < g.ny - 1; j++) for (let i = 1; i < g.nx - 1; i++) {
        const k = id(i, j);
        if (mat[k] === 2) {                                        // canal: absorbe (Dirichlet 60)
          let flux = 0;
          for (const nb of [k - 1, k + 1, k - g.nx, k + g.nx]) flux += K_STEEL * (T[nb] - 60);
          heatToWaterJ += Math.max(0, flux) * sub;                 // J por metro de profundidad (relativo)
          Tn[k] = 60; continue;
        }
        if (mat[k] === 1 && !filled[k]) { Tn[k] = Math.min(T[k], 61); continue; }
        const ki = kOf(k); let flux = 0;
        for (const nb of [k - 1, k + 1, k - g.nx, k + g.nx]) flux += (2 * ki * kOf(nb)) / (ki + kOf(nb)) * (T[nb] - T[k]);
        Tn[k] = T[k] + (sub / (rcOf(k) * g.hM * g.hM)) * flux;
      }
      T.set(Tn);
    }
  };
  let t = 0, cycle = 1;
  const ease = (u: number) => (u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

  const api = {
    params: { tFill, cycleT, phases: PH },
    /** avanza dt segundos de PROCESO y devuelve el estado completo. */
    step(dt: number): CycleState {
      t += dt;
      let tc = t % cycleT; const nc = Math.floor(t / cycleT) + 1;
      if (nc !== cycle) { cycle = nc; filled.fill(0); for (let k = 0; k < N; k++) if (mat[k] === 1) T[k] = 60; }
      let acc = 0, i = 0, u = 0;
      for (; i < PH.length; i++) { if (tc < acc + PH[i][1]) { u = (tc - acc) / PH[i][1]; break; } acc += PH[i][1]; }
      if (i >= PH.length) { i = PH.length - 1; u = 1; }
      const ph = PH[i][0]; const e = ease(Math.min(1, u));
      // llenado + presión + térmico
      let fillFrac = 0, P = 0;
      if (ph === 'cierre') fillFrac = 0;
      else if (ph === 'inyeccion') fillFrac = u;
      else fillFrac = ['empaque', 'enfriamiento'].includes(ph) ? 1 : (['apertura', 'expulsion', 'caida'].includes(ph) ? 1 : 0);
      const Lnow = Math.max(1e-6, fillFrac * p.flowLenM);
      if (ph === 'inyeccion') P = pressureDropSegment(melt, Lnow, p.wallM, p.vMeanMs) / 1e6;
      else if (ph === 'empaque') P = 0.8 * pressureDropSegment(melt, p.flowLenM, p.wallM, p.vMeanMs) / 1e6;
      else if (ph === 'enfriamiento') P = 0.8 * pressureDropSegment(melt, p.flowLenM, p.wallM, p.vMeanMs) / 1e6 * Math.exp(-3 * u);
      // marca celdas llenas (frente en X de la sección) + inyecta calor
      if (fillFrac > 0) {
        const cx = (g.cavX0 + g.cavX1) / 2, halfW = (g.cavX1 - g.cavX0) / 2;
        for (let j = g.cavY0; j < g.cavY1; j++) for (let i2 = g.cavX0; i2 <= g.cavX1; i2++) {
          const k = id(i2, j);
          const inFront = g.fillMode === 'center'
            ? Math.abs(i2 - cx) <= fillFrac * halfW                  // gate central: frente radial
            : i2 <= g.cavX0 + fillFrac * (g.cavX1 - g.cavX0);
          if (mat[k] === 1 && !filled[k] && inFront) { filled[k] = 1; T[k] = melt.tMelt; }
        }
      }
      if (['inyeccion', 'empaque', 'enfriamiento'].includes(ph)) thermStep(dt); else heatToWaterJ *= 1;
      // estrés de apertura vs clamp → deflexión → FLASH
      const openF = clampMetricTons(P * 1e6, p.projAreaM2);
      const bend = plateBending(openF * TON_N, p.bendSpanM, p.bendWM, p.bendHM);
      const flash = bend.deflectionM > 0.02e-3;
      // cinemática
      let openMm = 0, ejectMm = 0, drop = 0, vis = fillFrac > 0;
      if (ph === 'apertura') openMm = e * open;
      if (ph === 'expulsion') { openMm = open; ejectMm = e * eject; }
      if (ph === 'caida') { openMm = open; ejectMm = eject * (1 - e * .3); drop = e * e * 260; }
      if (ph === 'retorno') { openMm = open * (1 - e); ejectMm = Math.max(0, eject * .7 * (1 - 2 * e)); vis = false; }
      // térmico agregado
      let steelMax = 0, meltT = 0, nm = 0;
      for (let k = 0; k < N; k++) {
        if (mat[k] === 0 && T[k] > steelMax) steelMax = T[k];
        if (mat[k] === 1 && filled[k]) { meltT += T[k]; nm++; }
      }
      const heatW = heatToWaterJ; heatToWaterJ = 0;
      const mdot = (p.coolantFlowM3s ?? 5e-5) * 1000;              // kg/s
      const dTagua = dt > 0 ? (heatW / dt) * 1e-4 / (mdot * 4186) : 0;   // escala relativa de sección
      return {
        t, phase: ph, cycle, fillFrac, pressureMPa: P,
        openForceTons: openF, clampMarginTons: p.clampTons - openF,
        deflectionMm: bend.deflectionM * 1000, flash,
        openMm, ejectMm, partDropMm: drop, partVisible: vis,
        meltTempC: nm ? meltT / nm : 0, steelMaxC: steelMax,
        waterOutC: 60 + Math.min(8, dTagua), heatToWaterW: heatW / Math.max(dt, 1e-9),
      };
    },
    /** textura RGBA (nx×ny) del campo térmico de la sección — la SECCIÓN VIVA.
     *  Paleta ironbow que ARRANCA en gris-acero oscuro: el frío es acero cortado,
     *  el calor REVIENTA solo donde hay plástico/gradiente (nada de pared azul). */
    thermalTexture(): { w: number; h: number; data: Uint8Array } {
      const out = new Uint8Array(N * 4);
      for (let k = 0; k < N; k++) {
        let r = 30, gg = 35, b = 44;                                 // acero cortado (base fría)
        if (mat[k] === 2) { r = 24; gg = 84; b = 190; }              // canal de agua
        else if (mat[k] === 1 && !filled[k]) { r = 16; gg = 19; b = 25; }  // cavidad vacía
        else {
          // gamma DURA (^1.35): el acero tibio (70-90°C) apenas se insinúa y el calor
          // REVIENTA solo en el plástico/halo cercano — con gamma suave (0.42) los 70°C
          // pintaban rojo medio y TODA la sección se lavaba (visto en el video v1).
          const uu = Math.pow(Math.max(0, Math.min(1, (T[k] - 60) / 179)), 1.35);
          r = Math.min(255, r + 500 * Math.pow(uu, 1.3));            // ironbow: rojo primero…
          gg = Math.min(255, gg + 320 * Math.pow(Math.max(0, uu - 0.3) / 0.7, 1.5));  // …ámbar después
          b = Math.min(255, b + 90 * uu * Math.max(0, 1 - uu * 2.5) + (uu > 0.9 ? 1200 * (uu - 0.9) : 0)); // blanco al pico
        }
        out[k * 4] = r; out[k * 4 + 1] = gg; out[k * 4 + 2] = b; out[k * 4 + 3] = 255;
      }
      return { w: g.nx, h: g.ny, data: out };
    },
  };
  return api;
}
