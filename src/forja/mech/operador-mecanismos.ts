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
