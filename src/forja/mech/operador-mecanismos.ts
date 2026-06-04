/**
 * OPERADOR 𝔄 para MECANISMOS cíclicos — el marco del usuario aplicado a cinemática,
 * SIN física de impresión (eso entra después como campo de uniones en la MISMA cara-𝔦).
 *
 * Receta: simetría C_N → generador (corrimiento R) → cara-𝔦 (DFT, donde todo lo que
 * conmuta con R es DIAGONAL) → autovalores λ_k = LUT. Probado contra la caja cicloidal:
 * el BALANCE sale como "DC=0" y el RATIO como un BATIDO de Fourier. Puro, testeable.
 */

export type Cx = { re: number; im: number };
const cx = (re: number, im = 0): Cx => ({ re, im });
const cadd = (a: Cx, b: Cx): Cx => ({ re: a.re + b.re, im: a.im + b.im });
const cmul = (a: Cx, b: Cx): Cx => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cabs = (a: Cx): number => Math.hypot(a.re, a.im);
const expi = (t: number): Cx => ({ re: Math.cos(t), im: Math.sin(t) });

// ── Paso 1+2: la CARA-𝔦. DFT X_k = Σ_n x_n e^{-2πi kn/N}; idft con signo + y /N. ──
export function dft(x: Cx[]): Cx[] {
  const N = x.length, X: Cx[] = [];
  for (let k = 0; k < N; k++) {
    let s = cx(0);
    for (let n = 0; n < N; n++) s = cadd(s, cmul(x[n], expi(-2 * Math.PI * k * n / N)));
    X.push(s);
  }
  return X;
}
export function idft(X: Cx[]): Cx[] {
  const N = X.length, x: Cx[] = [];
  for (let n = 0; n < N; n++) {
    let s = cx(0);
    for (let k = 0; k < N; k++) s = cadd(s, cmul(X[k], expi(2 * Math.PI * k * n / N)));
    x.push({ re: s.re / N, im: s.im / N });
  }
  return x;
}
/** Autovalores de un operador CIRCULANTE (1ª fila c). Todo lo que conmuta con el
 *  corrimiento R es circulante → DIAGONAL en la cara-𝔦, con λ_k = DFT(c)[k] = la LUT. */
export function circulantEigenvalues(firstRow: number[]): Cx[] {
  return dft(firstRow.map((v) => cx(v)));
}
/** Espectro de modos |X_k|/N — qué frecuencias viven en un campo cíclico. */
export function modeSpectrum(field: Cx[]): number[] {
  const N = field.length;
  return dft(field).map((X) => +(cabs(X) / N).toFixed(6));
}

// ── Paso 3: BALANCE = la componente DC (k=0) del campo de fases excéntricas. ──
// Las N fases φ_n = 2πn/N son UNA onda pura (modo k=1) → DC = 0 → fuerza neta = 0.
// Esto ES eccentricBalance(N), pero leído en la cara-𝔦.
export function cyclicBalance(N: number): { dc: number; balanced: boolean; spectrum: number[]; peakMode: number } {
  const field = Array.from({ length: N }, (_, n) => expi(2 * Math.PI * n / N)); // e^{iφ_n}
  const spec = modeSpectrum(field);
  const dc = spec[0];
  let peak = 0; for (let k = 1; k < N; k++) if (spec[k] > spec[peak]) peak = k;
  return { dc, balanced: dc < 1e-9, spectrum: spec, peakMode: peak };
}

// ── Paso 4: RATIO por BATIDO (diferencia de Fourier). ──
// El disco es una onda espacial de frecuencia Z_c (lóbulos); el anillo, Z_r=Z_c+1
// (rodillos). El contacto avanza a la frecuencia de BATIDO |Z_r−Z_c|=1. Reducción =
// (cuenta del miembro de SALIDA)/batido:
//   · salida = disco (anillo/hembra FIJA): Z_c/1 = Z_c, sentido opuesto.   [config A]
//   · salida = anillo/hembra (carrier/BRIDA fija): Z_r/1 = Z_r, mismo sentido. [config B]
export function cyclicReduction(lobes: number, output: 'disc' | 'ring') {
  const Zc = lobes, Zr = lobes + 1, beat = Math.abs(Zr - Zc);
  const ratio = (output === 'ring' ? Zr : Zc) / beat;
  return {
    Zc, Zr, beat, ratio,
    sign: output === 'ring' ? +1 : -1,
    fixed: output === 'ring' ? 'brida (carrier)' : 'hembra (anillo)',
    moves: output === 'ring' ? 'hembra (anillo)' : 'brida (disco)',
    dir: output === 'ring' ? 'mismo sentido' : 'opuesto',
  };
}

// ── Paso 6: el CAMPO DE UNIONES b(θ) sobre la MISMA cara-𝔦 + los 3 operadores de
// impresión, diagonales/locales ahí. Generar un mecanismo imprimible = elegir b(θ)
// que (1) dé el movimiento, (2) se imprima, (3) despegue — las 3 en la cara-𝔦. ──
export type BondType = 'fundido' | 'holgura' | 'cuello' | 'hilo';

/** Operador de FUSIÓN (Deborah): LOCAL. Funde si el hueco < g_min (umbral con/sin
 *  ventilador, de printsim). Para una junta libre QUEREMOS holgura (no funde). */
export function fusionOp(gapMm: number, gMinFan: number): { welds: boolean; type: BondType } {
  if (gapMm <= 0) return { welds: true, type: 'fundido' };
  return gapMm < gMinFan ? { welds: true, type: 'fundido' } : { welds: false, type: 'holgura' };
}

/** Operador de VOLADIZO (LOCAL): cara con pendiente desde la vertical > crítico (45°). */
export function overhangOp(angleFromVertDeg: number, critDeg = 45): boolean {
  return angleFromVertDeg > critDeg;
}

/** Operador de DESPEGUE = cota sobre el modo DC del campo de ÁREA frangible.
 *  Σ área = N·DC (el modo k=0). Despega si Σ área ≤ presupuesto (τ·A ≤ T_in/r). */
export function detachDC(bondAreaField: number[], budgetMm2: number) {
  const N = Math.max(1, bondAreaField.length);
  const spec = modeSpectrum(bondAreaField.map((v) => cx(v)));
  const total = bondAreaField.reduce((a, b) => a + b, 0);
  return { dc: +spec[0].toFixed(4), totalArea: +total.toFixed(3), N, detaches: total <= budgetMm2 };
}

export interface MechSpec {
  lobes: number; discs: number; output: 'disc' | 'ring';
  gapMm: number; gMinFan: number;       // impresión: hueco de la junta + umbral de fusión
  neckAreas: number[];                  // campo de área frangible (un valor por cuello)
  detachBudgetMm2: number;
}
/** COMPILA: las 3 preguntas (mueve / imprime / despega) en la cara-𝔦. */
export function compileMechanism(s: MechSpec) {
  const red = cyclicReduction(s.lobes, s.output);
  const bal = cyclicBalance(Math.max(1, s.discs));
  const fus = fusionOp(s.gapMm, s.gMinFan);
  const det = detachDC(s.neckAreas, s.detachBudgetMm2);
  return {
    mueve: { ratio: red.ratio, dir: red.dir, beat: red.beat, salida: red.moves },
    balanceado: bal.balanced,                                  // DC=0 del campo de fases
    imprime: { funde: fus.welds, union: fus.type, ok: !fus.welds }, // junta libre ⇔ NO funde
    despega: { areaTotal: det.totalArea, presupuesto: s.detachBudgetMm2, ok: det.detaches },
    valido: bal.balanced && !fus.welds && det.detaches,
  };
}
