/**
 * CAMPO CÍCLICO-PROMEDIO DEL MOLDE — el entregable estándar de la industria
 * ("cycle-averaged mold temperature"), con LA FORMA DE LA PIEZA adentro.
 *
 * POR QUÉ ASÍ (investigado, no inventado): Moldflow y la literatura BEM
 * DESACOPLAN el problema en (a) conducción transitoria 1D a través del espesor
 * de la pieza — nuestras micro-pilas de F2b — y (b) conducción 3D del molde en
 * RÉGIMEN CÍCLICO-PROMEDIO. El molde no se resuelve transitorio: su masa de
 * acero promedia el ciclo (δ=√(α·t) ≈ 16 mm de piel oscilante sobre un bulk
 * estable). Ellos usan BEM (solo superficies); aquí se resuelve el mismo
 * problema por VOLÚMENES FINITOS con k VARIABLE POR CELDA, que es lo que hace
 * aparecer la geometría: el plástico (k=0.19) es un AISLANTE con la forma del
 * vaso metido en acero (k=32) — el campo se deforma alrededor de la flanera
 * porque el calor tiene que rodearla. Con α uniforme eso es invisible.
 *
 *   ∇·(k∇T) + q''' = 0     (estacionario, k variable)
 *   agua:      −k∂T/∂n = h_c·(T − T_agua)        (Eq 9.7)
 *   exterior:  adiabático (conservador, §9.2)
 *   fuente:    q''' = Q̇/V_plástico   con Q̇ de Eq 9.10 (balance del polímero)
 *
 * Conductancia entre celdas por MEDIA ARMÓNICA g=1/(dx/2k₁+dx/2k₂) — validada
 * en thermal-layers contra efusividades y cadena de resistencias (23/23).
 * Se resuelve por GRADIENTE CONJUGADO matrix-free (SPD) con conductancias
 * precomputadas: sin matrices densas, sin dependencias, ~380 iters en 150k
 * celdas. (SOR necesitaba miles de barridos y daba 1500-3200 °C sin converger.)
 */

export interface SteadyField {
  nx: number; ny: number; nz: number; dxMm: number;
  x0: number; y0: number; z0: number;
  T: Float32Array;
  /** 0=acero, 1=plástico (la FORMA), 2=celda con línea de agua */
  mat: Uint8Array;
  iters: number;
  /** residuo VERDADERO ‖b−A·T‖ recalculado al final (no el recursivo del CG, que deriva) */
  residualC: number;
  /** el mismo, relativo a ‖b‖ — es el que hay que mirar: no depende de las unidades */
  residualRel: number;
  /** caras donde la interfaz se ubicó por celda CORTADA (0 = se corrió escalonado) */
  carasCortadas: number;
  minC: number; maxC: number;
  /** T sobre la superficie moldeante (celdas de acero que tocan plástico) */
  surfMinC: number; surfMaxC: number; surfMeanC: number;
  /** rango SOLO DEL ACERO — la escala de color que el molderista lee (el
   *  plástico a ~250 °C aplastaba todo el acero al 15 % bajo de la rampa) */
  steelMinC: number; steelMaxC: number;
}

export function solveSteadyMoldField(o: {
  nx: number; ny: number; nz: number; dxMm: number;
  x0: number; y0: number; z0: number;
  /** 1 = celda de PLÁSTICO (voxelizada de la pieza real) */
  plastic: Uint8Array;
  /** factor de Robin por celda (>0 = línea de agua) — mismo que usa el FDM */
  cool: Float32Array;
  tCoolantC: number;
  /** calor total a extraer (W) — Eq 9.10, NO medido del campo */
  qTotalW: number;
  kSteel?: number; kPlastic?: number; hC?: number;
  /** ⌀ de la línea de agua (m) — el área mojada por celda es π·D·dx */
  lineDiaM?: number;
  maxIters?: number; tolC?: number;
  /**
   * CELDA CORTADA — distancia con signo a la SUPERFICIE DE LA PIEZA en el centro de
   * cada celda, en mm (negativa adentro del plástico). Opcional.
   *
   * Sin ella, la media armónica supone que la interfaz plástico↔acero cae EXACTAMENTE
   * en la cara del vóxel, o sea a h/2 de cada centro. La superficie real cae donde
   * cae, y su posición dentro de la celda CAMBIA con cada malla: la resistencia de
   * contacto queda mal y el error deja de bajar de forma limpia. Medido con MMS
   * (2026-08-05): con el dato en la cara del vóxel el orden se derrumba de 2 a 1.29;
   * con la posición real vuelve a 1.99 y el error cae 35×.
   *
   * Con `sdfMm` la interfaz se ubica por interpolación lineal del level-set entre los
   * dos centros (θ = φ_a/(φ_a−φ_b)) y la conductancia pasa a A/(d_a/k_a + d_b/k_b).
   */
  sdfMm?: Float32Array;
}): SteadyField {
  const { nx, ny, nz } = o;
  const kS = o.kSteel ?? 32, kP = o.kPlastic ?? 0.19, hC = o.hC ?? 1000;
  const dx = o.dxMm / 1000;                       // m
  const N = nx * ny * nz;
  const idx = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const kOf = new Float32Array(N);
  // FRACCIÓN DE PLÁSTICO POR CELDA. Sin `sdfMm` vale 0 ó 1 (el vóxel entero) — es lo
  // que se hacía siempre. Con el level-set se estima linealmente: frac = 0.5 − φ/h.
  //
  // POR QUÉ IMPORTA MÁS QUE LA CONDUCTANCIA: la densidad de fuente es q''' = Q̇/V_plástico,
  // y V_plástico se contaba en VÓXELES ENTEROS. Medido (2026-08-05, barra de dos capas
  // con la interfaz en 20.37 mm): el error de la resistencia era 1.808/1.791/1.779/1.656/
  // 0.634 % y la cuantización del volumen predice 1.816/1.816/1.816/1.690/0.638 % —
  // coincide a tres cifras. O sea que el error del solver ERA la cuantización del
  // volumen, no la posición de la interfaz. Arreglar la conductancia sola no movía nada.
  const fracPl = new Float32Array(N);
  let nPlast = 0, vPlastFrac = 0;
  for (let n = 0; n < N; n++) {
    const p = o.plastic[n] === 1;
    kOf[n] = p ? kP : kS;
    if (p) nPlast++;
    let f = p ? 1 : 0;
    if (o.sdfMm) {
      const phi = o.sdfMm[n];
      if (Number.isFinite(phi)) f = Math.min(1, Math.max(0, 0.5 - phi / o.dxMm));
    }
    fracPl[n] = f; vPlastFrac += f;
  }
  const vPlast = Math.max(1e-9, o.sdfMm ? vPlastFrac : Math.max(1, nPlast)) * dx * dx * dx;
  const qVol = o.qTotalW / vPlast;                // W/m³
  // ── GRADIENTE CONJUGADO matrix-free (SPD: conducción + Robin) ───────────
  // SOR necesitaba MILES de barridos para propagar el calor hasta el agua en
  // 146k celdas (residual 1.1 °C tras 1200 iters ⇒ campo aún cargándose:
  // 1491-3238 °C absurdos). CG converge en O(√κ) y no arma matriz: solo
  // aplica el operador. Es lo que usan los solvers de verdad.
  // CONDUCTANCIAS PRECOMPUTADAS (una vez, no en cada iteración): 3 arrays de
  // caras + la diagonal. Baja el estudio de ~19 s a pocos segundos.
  const A2 = dx * dx;
  const gX = new Float32Array(N), gY = new Float32Array(N), gZ = new Float32Array(N);
  const diagA = new Float32Array(N);
  const sdf = o.sdfMm;
  // Fracción mínima de celda: una interfaz casi pegada a un centro dispararía la
  // conductancia (el "small cell problem" de las fronteras embebidas). EXTENSIÓN
  // DECLARADA — es una cota nuestra, no un resultado del esquema.
  const TH_MIN = 1e-3;
  let nCortadas = 0;
  const harm = (a: number, b: number) => {
    let da = dx / 2, db = dx / 2;
    if (sdf) {
      const fa = sdf[a], fb = sdf[b];
      // solo donde el level-set CRUZA cero entre los dos centros hay interfaz
      if (Number.isFinite(fa) && Number.isFinite(fb) && ((fa < 0) !== (fb < 0)) && fa !== fb) {
        let th = fa / (fa - fb);
        th = Math.min(1 - TH_MIN, Math.max(TH_MIN, th));
        da = th * dx; db = (1 - th) * dx;
        nCortadas++;
      }
    }
    return (1 / (da / kOf[a] + db / kOf[b])) * A2;
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = idx(i, j, k);
    if (i < nx - 1) gX[n] = harm(n, idx(i + 1, j, k));
    if (j < ny - 1) gY[n] = harm(n, idx(i, j + 1, k));
    if (k < nz - 1) gZ[n] = harm(n, idx(i, j, k + 1));
  }
  const gWater = hC * Math.PI * (o.lineDiaM ?? 0.00953) * dx;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = idx(i, j, k);
    let d = gX[n] + gY[n] + gZ[n];
    if (i > 0) d += gX[idx(i - 1, j, k)];
    if (j > 0) d += gY[idx(i, j - 1, k)];
    if (k > 0) d += gZ[idx(i, j, k - 1)];
    if (o.cool[n] > 0) d += gWater;
    diagA[n] = d;
  }
  /** y = A·x  (A = −∇·k∇ + Robin), unidades W/°C */
  const applyA = (x: Float32Array, y: Float32Array) => {
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const n = idx(i, j, k);
      let acc = 0;
      if (i > 0) acc += gX[idx(i - 1, j, k)] * x[idx(i - 1, j, k)];
      if (i < nx - 1) acc += gX[n] * x[idx(i + 1, j, k)];
      if (j > 0) acc += gY[idx(i, j - 1, k)] * x[idx(i, j - 1, k)];
      if (j < ny - 1) acc += gY[n] * x[idx(i, j + 1, k)];
      if (k > 0) acc += gZ[idx(i, j, k - 1)] * x[idx(i, j, k - 1)];
      if (k < nz - 1) acc += gZ[n] * x[idx(i, j, k + 1)];
      y[n] = diagA[n] * x[n] - acc;
    }
  };
  // b: fuente volumétrica + el término del agua (T_agua entra por el Robin)
  const b = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    b[n] = fracPl[n] > 0 ? qVol * fracPl[n] * dx * dx * dx : 0;
    if (o.cool[n] > 0) b[n] += gWater * o.tCoolantC;
  }
  const T = new Float32Array(N).fill(o.tCoolantC);
  const r = new Float32Array(N), pv = new Float32Array(N), Ap = new Float32Array(N);
  applyA(T, Ap);
  for (let n = 0; n < N; n++) { r[n] = b[n] - Ap[n]; pv[n] = r[n]; }
  let rs = 0; for (let n = 0; n < N; n++) rs += r[n] * r[n];
  const maxIters = o.maxIters ?? 600, tol = o.tolC ?? 1e-3;
  let iters = 0, resid = Math.sqrt(rs);
  while (iters < maxIters && resid > tol) {
    applyA(pv, Ap);
    let pAp = 0; for (let n = 0; n < N; n++) pAp += pv[n] * Ap[n];
    if (Math.abs(pAp) < 1e-30) break;
    const alpha = rs / pAp;
    for (let n = 0; n < N; n++) { T[n] += alpha * pv[n]; r[n] -= alpha * Ap[n]; }
    let rs2 = 0; for (let n = 0; n < N; n++) rs2 += r[n] * r[n];
    const beta = rs2 / rs;
    for (let n = 0; n < N; n++) pv[n] = r[n] + beta * pv[n];
    rs = rs2; resid = Math.sqrt(rs2); iters++;
  }
  // RESIDUO VERDADERO, recalculado una vez: ‖b − A·T‖. El `r` del lazo es el residuo
  // RECURSIVO (r ← r − α·A·p), que en float32 DERIVA del verdadero y termina reportando
  // 0 cuando el real vale 7.7e-3 W (medido con MMS, 2026-08-05). Como `residualC` se usa
  // de bandera de calidad en mold-thermal-fdm (`ok: residualC < 0.1`), la bandera salía
  // optimista. Cuesta un producto matriz-vector y deja de mentir.
  applyA(T, Ap);
  let rv = 0, bn = 0;
  for (let n = 0; n < N; n++) { const d = b[n] - Ap[n]; rv += d * d; bn += b[n] * b[n]; }
  resid = Math.sqrt(rv);
  const residRel = bn > 0 ? Math.sqrt(rv / bn) : 0;

  // estadísticas + superficie moldeante (acero que TOCA plástico)
  let mn = 1e9, mx = -1e9, sMn = 1e9, sMx = -1e9, sSum = 0, sN = 0;
  let stMn = 1e9, stMx = -1e9;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = idx(i, j, k), v = T[n];
    if (v < mn) mn = v; if (v > mx) mx = v;
    if (o.plastic[n] === 1) continue;
    if (v < stMn) stMn = v; if (v > stMx) stMx = v;         // rango del ACERO
    const vecino = (i > 0 && o.plastic[idx(i - 1, j, k)] === 1) || (i < nx - 1 && o.plastic[idx(i + 1, j, k)] === 1)
      || (j > 0 && o.plastic[idx(i, j - 1, k)] === 1) || (j < ny - 1 && o.plastic[idx(i, j + 1, k)] === 1)
      || (k > 0 && o.plastic[idx(i, j, k - 1)] === 1) || (k < nz - 1 && o.plastic[idx(i, j, k + 1)] === 1);
    if (!vecino) continue;
    if (v < sMn) sMn = v; if (v > sMx) sMx = v; sSum += v; sN++;
  }
  const mat = new Uint8Array(N);
  for (let n = 0; n < N; n++) mat[n] = o.plastic[n] === 1 ? 1 : (o.cool[n] > 0 ? 2 : 0);
  return {
    nx, ny, nz, dxMm: o.dxMm, x0: o.x0, y0: o.y0, z0: o.z0, T, mat,
    iters, residualC: +resid.toFixed(4), residualRel: +residRel.toExponential(3),
    carasCortadas: nCortadas,
    minC: +mn.toFixed(2), maxC: +mx.toFixed(2),
    surfMinC: sN ? +sMn.toFixed(2) : o.tCoolantC,
    surfMaxC: sN ? +sMx.toFixed(2) : o.tCoolantC,
    surfMeanC: sN ? +(sSum / sN).toFixed(2) : o.tCoolantC,
    steelMinC: +(stMn === 1e9 ? mn : stMn).toFixed(2),
    steelMaxC: +(stMx === -1e9 ? mx : stMx).toFixed(2),
  };
}
