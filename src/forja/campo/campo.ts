/**
 * CAMPO — el sustrato ÚNICO de simulación de La Forja (operador 𝔄 aplicado al molde).
 * ============================================================================
 * "ESTANDARICEMOS EL SISTEMA DE SIMULACIÓN COMPLETO. TODO EL MOLDE SON FÓRMULAS Y
 *  VECTORES… trabajarlo numéricamente será mejor, ahí está el operador" (user 2026-07-16).
 *
 * El censo le da la razón: SIETE rejillas artesanales en el repo (flowlen, thermal-fdm,
 * cycle-engine, tc-map, mold-analysis, viento, dfm-mesh), cada una con su idx(), su
 * frontera, su muestreo y su render. El pecado de la sesión a escala de arquitectura:
 * la capacidad existe una vez y cada módulo la reescribe distinto. ESTE archivo es la
 * rejilla que las demás van a consumir — y la hoja de contacto leerá cualquier Campo3,
 * así la verificación visual se estandariza de golpe.
 *
 * EL OPERADOR 𝔄 (framework del user: simetría → generador → cara-𝔦 diagonal → LUT):
 *   la difusión de calor  dT/dt = α·∇²T  es lineal con coeficiente constante. Sus
 *   simetrías de traslación en x, y, z dan tres caras-𝔦; en esa base el laplaciano es
 *   DIAGONAL y la evolución temporal es EXACTA para CUALQUIER dt:
 *
 *      T_k(t+dt) = T_k(t) · exp(α·(λx+λy+λz)·dt)
 *              = T_k(t) · ex[mx] · ey[my] · ez[mz]     ← producto tensor de LUTs 1D
 *
 *   Eso mata el `dtMax` y los sub-pasos del FDM (el "de kínder"): un paso espectral es
 *   exacto sin importar el tamaño. Las tres LUTs 1D son literalmente el patrón del
 *   framework ("factoriza campos en producto tensor de lookups 1D").
 *
 * LA CARA ELEGIDA: Dirichlet (DST-I). El molde vive entre placas a temperatura fijada
 * por el agua — pared fría = frontera de valor fijo. Los modos discretos
 *   φ_m(i) = √(2/(n+1))·sin(π(m+1)(i+1)/(n+1))
 * son ORTONORMALES, la matriz es SU PROPIA inversa (aplicar dos veces = identidad), y
 * son eigenmodos EXACTOS del laplaciano discreto con fantasmas en cero:
 *   λ_m = −(4/h²)·sin²(π(m+1)/(2(n+1)))
 * Exactos del DISCRETO, no del continuo: así el gate compara a precisión de máquina,
 * no "más o menos".
 *
 * HONESTIDAD (el techo, como manda la memoria del framework):
 *  · esta cara pide α CONSTANTE. El molde real es acero+plástico+agua: las interfaces
 *    rompen la simetría de traslación. Acuerdo con el user: "si hay otro problema
 *    volvemos a cambiar de cara" — splitting por material o cara de interfaz, DESPUÉS.
 *  · la transformada va por multiplicación de matriz (O(n) por línea): perfecta hasta
 *    rejillas ~128³. Si el generativo pide más, se mete FFT — la física no cambia.
 *
 * PURO: node-testeable, sin three.js. El render (la hoja) vive aparte y LEE de aquí.
 */

export interface Campo3 {
  nx: number; ny: number; nz: number;
  /** tamaño de celda (mm) — la rejilla es uniforme: es lo que hace diagonal a la cara */
  cellMm: number;
  /** origen del vóxel (0,0,0) en coords de placa (mm) */
  x0: number; y0: number; z0: number;
  data: Float32Array;
}

/** campo VECTORIAL: tres componentes sobre la MISMA rejilla (v = -S·∇P, flujo de calor
 *  q = -k·∇T, viento… todos viven aquí). */
export interface CampoVec3 {
  nx: number; ny: number; nz: number;
  cellMm: number; x0: number; y0: number; z0: number;
  x: Float32Array; y: Float32Array; z: Float32Array;
}

export const idx3 = (c: { nx: number; ny: number }, i: number, j: number, k: number): number =>
  (k * c.ny + j) * c.nx + i;

export function crearCampo3(o: {
  nx: number; ny: number; nz: number; cellMm: number;
  x0?: number; y0?: number; z0?: number; fill?: number;
}): Campo3 {
  const data = new Float32Array(o.nx * o.ny * o.nz);
  if (o.fill) data.fill(o.fill);
  return { nx: o.nx, ny: o.ny, nz: o.nz, cellMm: o.cellMm, x0: o.x0 ?? 0, y0: o.y0 ?? 0, z0: o.z0 ?? 0, data };
}

/** muestreo TRILINEAL en coords físicas (mm) — el único `sample` del sistema; las siete
 *  copias artesanales muestreaban cada una a su modo (nearest, sin clamp, con off-by-half). */
export function sample(c: Campo3, xMm: number, yMm: number, zMm: number): number {
  const fx = (xMm - c.x0) / c.cellMm - 0.5;
  const fy = (yMm - c.y0) / c.cellMm - 0.5;
  const fz = (zMm - c.z0) / c.cellMm - 0.5;
  const i0 = Math.max(0, Math.min(c.nx - 1, Math.floor(fx)));
  const j0 = Math.max(0, Math.min(c.ny - 1, Math.floor(fy)));
  const k0 = Math.max(0, Math.min(c.nz - 1, Math.floor(fz)));
  const i1 = Math.min(c.nx - 1, i0 + 1), j1 = Math.min(c.ny - 1, j0 + 1), k1 = Math.min(c.nz - 1, k0 + 1);
  const tx = Math.max(0, Math.min(1, fx - i0)), ty = Math.max(0, Math.min(1, fy - j0)), tz = Math.max(0, Math.min(1, fz - k0));
  const d = c.data;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c00 = lerp(d[idx3(c, i0, j0, k0)], d[idx3(c, i1, j0, k0)], tx);
  const c10 = lerp(d[idx3(c, i0, j1, k0)], d[idx3(c, i1, j1, k0)], tx);
  const c01 = lerp(d[idx3(c, i0, j0, k1)], d[idx3(c, i1, j0, k1)], tx);
  const c11 = lerp(d[idx3(c, i0, j1, k1)], d[idx3(c, i1, j1, k1)], tx);
  return lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz);
}

/** ∇f por diferencias centrales (unilaterales en el borde) → campo vectorial (1/mm·[f]). */
export function gradiente(c: Campo3): CampoVec3 {
  const { nx, ny, nz, cellMm } = c;
  const gx = new Float32Array(nx * ny * nz), gy = new Float32Array(nx * ny * nz), gz = new Float32Array(nx * ny * nz);
  const d = c.data, h2 = 2 * cellMm, h1 = cellMm;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const t = idx3(c, i, j, k);
    gx[t] = i === 0 ? (d[idx3(c, 1, j, k)] - d[t]) / h1
      : i === nx - 1 ? (d[t] - d[idx3(c, nx - 2, j, k)]) / h1
      : (d[idx3(c, i + 1, j, k)] - d[idx3(c, i - 1, j, k)]) / h2;
    gy[t] = j === 0 ? (d[idx3(c, i, Math.min(1, ny - 1), k)] - d[t]) / h1
      : j === ny - 1 ? (d[t] - d[idx3(c, i, ny - 2, k)]) / h1
      : (d[idx3(c, i, j + 1, k)] - d[idx3(c, i, j - 1, k)]) / h2;
    gz[t] = k === 0 ? (d[idx3(c, i, j, Math.min(1, nz - 1))] - d[t]) / h1
      : k === nz - 1 ? (d[t] - d[idx3(c, i, j, nz - 2)]) / h1
      : (d[idx3(c, i, j, k + 1)] - d[idx3(c, i, j, k - 1)]) / h2;
  }
  return { nx, ny, nz, cellMm, x0: c.x0, y0: c.y0, z0: c.z0, x: gx, y: gy, z: gz };
}

/** ∇·v por diferencias centrales → campo escalar. div(grad f) ≈ lap f: el gate lo cruza. */
export function divergencia(v: CampoVec3): Campo3 {
  const { nx, ny, nz, cellMm } = v;
  const out = crearCampo3({ nx, ny, nz, cellMm, x0: v.x0, y0: v.y0, z0: v.z0 });
  const h2 = 2 * cellMm, h1 = cellMm;
  // la 1ª versión iteraba k∈[1,nz−1): con nz=1 el bucle NO CORRÍA y div salía CERO en
  // todo el campo — el gate lo cazó (err 0.99 = "todo apagado"). Ahora: todas las celdas,
  // diferencia unilateral en el borde (como gradiente), y un eje de tamaño 1 no aporta.
  const dEje = (arr: Float32Array, n: number, pos: number, tMinus: number, t: number, tPlus: number): number => {
    if (n === 1) return 0;
    if (pos === 0) return (arr[tPlus] - arr[t]) / h1;
    if (pos === n - 1) return (arr[t] - arr[tMinus]) / h1;
    return (arr[tPlus] - arr[tMinus]) / h2;
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const t = idx3(v, i, j, k);
    out.data[t] =
      dEje(v.x, nx, i, idx3(v, Math.max(0, i - 1), j, k), t, idx3(v, Math.min(nx - 1, i + 1), j, k)) +
      dEje(v.y, ny, j, idx3(v, i, Math.max(0, j - 1), k), t, idx3(v, i, Math.min(ny - 1, j + 1), k)) +
      dEje(v.z, nz, k, idx3(v, i, j, Math.max(0, k - 1)), t, idx3(v, i, j, Math.min(nz - 1, k + 1)));
  }
  return out;
}

/** ∇²f de 7 puntos. `borde:'dirichlet0'` = fantasmas EN CERO fuera del dominio — la
 *  convención de la cara DST-I: con ella los modos discretos son eigenfunciones EXACTAS
 *  (el gate lo comprueba a precisión de máquina, no "aproximadamente"). */
export function laplaciano(c: Campo3, o?: { borde?: 'dirichlet0' | 'copia' }): Campo3 {
  const { nx, ny, nz, cellMm } = c;
  const out = crearCampo3({ nx, ny, nz, cellMm, x0: c.x0, y0: c.y0, z0: c.z0 });
  const d = c.data, ih2 = 1 / (cellMm * cellMm);
  const copia = (o?.borde ?? 'dirichlet0') === 'copia';
  const at = (i: number, j: number, k: number, centro: number): number => {
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return copia ? centro : 0;
    return d[idx3(c, i, j, k)];
  };
  // un eje de tamaño 1 esta AUSENTE (campo 2D/1D guardado en 3D): no aporta termino.
  // Sin esto, un campo 1D recibia fantasmas-cero en y y z → −4v/h² espurio, y el test
  // de eigenfuncion "fallaba" culpando a la cara cuando el paso espectral era exacto
  // (8.1e-9): el bug estaba AQUI, no en el operador. Lo delato el contraste de los dos.
  const ejeX = nx > 1, ejeY = ny > 1, ejeZ = nz > 1;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const t = idx3(c, i, j, k), v = d[t];
    let acc = 0;
    if (ejeX) acc += at(i + 1, j, k, v) + at(i - 1, j, k, v) - 2 * v;
    if (ejeY) acc += at(i, j + 1, k, v) + at(i, j - 1, k, v) - 2 * v;
    if (ejeZ) acc += at(i, j, k + 1, v) + at(i, j, k - 1, v) - 2 * v;
    out.data[t] = acc * ih2;
  }
  return out;
}

// ══ LA CARA-𝔦 DE DIFUSIÓN (Dirichlet · DST-I) ═══════════════════════════════

export interface CaraDifusion {
  n: number;
  /** matriz de modos n×n, ORTONORMAL y SU PROPIA INVERSA: modos[m*n+i] = φ_m(i) */
  modos: Float32Array;
  /** eigenvalores del laplaciano DISCRETO (1/mm², negativos). n=1 ⇒ [0] (eje ausente). */
  lambda: Float32Array;
}

export function caraDirichlet(n: number, cellMm: number): CaraDifusion {
  if (n === 1) return { n, modos: Float32Array.of(1), lambda: Float32Array.of(0) };
  const modos = new Float32Array(n * n), lambda = new Float32Array(n);
  const norm = Math.sqrt(2 / (n + 1)), h2 = cellMm * cellMm;
  for (let m = 0; m < n; m++) {
    const s = Math.sin((Math.PI * (m + 1)) / (2 * (n + 1)));
    lambda[m] = -(4 / h2) * s * s;                 // eigenvalor del laplaciano DISCRETO
    for (let i = 0; i < n; i++) modos[m * n + i] = norm * Math.sin((Math.PI * (m + 1) * (i + 1)) / (n + 1));
  }
  return { n, modos, lambda };
}

/** LA CARA NEUMANN (DCT-II ortonormal) — "si hay otro problema, volvemos a cambiar de
 *  cara" (user). El problema: el molde del CAD tiene bordes AISLADOS (el bloque no
 *  pierde calor al aire; solo el agua enfría), y la DST-I los clava a T_borde — enfriaría
 *  de a gratis. La rotación correcta: modos coseno, eigen EXACTOS del laplaciano discreto
 *  con fantasmas de COPIA (borde 'copia' = flujo cero):
 *    φ_m(i) = c_m·cos(π·m·(i+½)/n)   ·   λ_m = −(4/h²)·sin²(π·m/(2n))   ·   λ_0 = 0
 *  λ_0 = 0 es LA FÍSICA: el modo promedio no decae — un bloque aislado guarda su calor,
 *  solo el agua (Robin) se lo lleva. OJO: esta matriz NO es autoinversa (DCT-II⁻¹ =
 *  DCT-III = su transpuesta) — por eso aplicarEje ahora sabe de adjuntas. */
export function caraNeumann(n: number, cellMm: number): CaraDifusion {
  if (n === 1) return { n, modos: Float32Array.of(1), lambda: Float32Array.of(0) };
  const modos = new Float32Array(n * n), lambda = new Float32Array(n);
  const h2 = cellMm * cellMm;
  for (let m = 0; m < n; m++) {
    const s = Math.sin((Math.PI * m) / (2 * n));
    lambda[m] = -(4 / h2) * s * s;
    const norm = m === 0 ? Math.sqrt(1 / n) : Math.sqrt(2 / n);
    for (let i = 0; i < n; i++) modos[m * n + i] = norm * Math.cos((Math.PI * m * (i + 0.5)) / n);
  }
  return { n, modos, lambda };
}

/** aplica la cara a lo largo de un eje. `adj` = usar la TRANSPUESTA (la inversa de una
 *  matriz ortonormal): la DST-I es autoinversa y no lo nota; la DCT-II lo NECESITA.
 *  Bucles EXPLÍCITOS por eje: la 1ª versión calculaba la base con ternarios "listos" y
 *  la del eje z quedó TRANSPUESTA — con nx≠ny se salía del plano. Claridad > ingenio. */
function aplicarEje(data: Float32Array, nx: number, ny: number, nz: number, eje: 'x' | 'y' | 'z', cara: CaraDifusion, adj = false): void {
  const n = cara.n, M = cara.modos;
  if (n === 1) return;
  const linea = new Float32Array(n);
  const transformar = (base: number, stride: number) => {
    for (let t = 0; t < n; t++) linea[t] = data[base + t * stride];
    for (let m = 0; m < n; m++) {
      let s = 0;
      if (adj) { for (let t = 0; t < n; t++) s += M[t * n + m] * linea[t]; }
      else { for (let t = 0; t < n; t++) s += M[m * n + t] * linea[t]; }
      data[base + m * stride] = s;
    }
  };
  if (eje === 'x') {
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) transformar((k * ny + j) * nx, 1);
  } else if (eje === 'y') {
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) transformar(k * ny * nx + i, nx);
  } else {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) transformar(j * nx + i, nx * ny);
  }
}

/**
 * EL OPERADOR DE DIFUSIÓN: caras precomputadas + LUTs por dt. Un paso es EXACTO para
 * cualquier dt (es la solución modal del semi-discreto, no una aproximación de Euler).
 */
export function crearDifusionEspectral(c: Campo3, o: {
  /** difusividad (mm²/s) — CONSTANTE: es lo que la cara pide. Mezclas = otra cara, después. */
  alphaMm2s: number;
  /** temperatura de la frontera Dirichlet (°C) — la pared fría del agua */
  tBordeC?: number;
  /** la cara de FRONTERA: 'dirichlet' = bordes a T fija (DST-I) · 'neumann' = bordes
   *  AISLADOS, flujo cero (DCT-II) — el molde del CAD: el bloque no pierde al aire,
   *  SOLO el agua enfría (y ésa entra por relajación exacta aparte). */
  tipo?: 'dirichlet' | 'neumann';
}) {
  const mkCara = (o.tipo ?? 'dirichlet') === 'neumann' ? caraNeumann : caraDirichlet;
  const cx = mkCara(c.nx, c.cellMm);
  const cy = mkCara(c.ny, c.cellMm);
  const cz = mkCara(c.nz, c.cellMm);
  const tB = o.tBordeC ?? 0;
  const luts = new Map<number, { ex: Float32Array; ey: Float32Array; ez: Float32Array }>();
  const lutFor = (dtS: number) => {
    let l = luts.get(dtS);
    if (!l) {
      // LAS TRES LUTs 1D — el producto tensor del framework: exp(α(λx+λy+λz)dt) =
      // ex[mx]·ey[my]·ez[mz]. Nada de exponenciales en el bucle caliente.
      const mk = (cara: CaraDifusion) => {
        const e = new Float32Array(cara.n);
        for (let m = 0; m < cara.n; m++) e[m] = Math.exp(o.alphaMm2s * cara.lambda[m] * dtS);
        return e;
      };
      l = { ex: mk(cx), ey: mk(cy), ez: mk(cz) };
      luts.set(dtS, l);
    }
    return l;
  };

  return {
    caras: { x: cx, y: cy, z: cz },
    /** UN paso de dt segundos — exacto, sin dtMax, sin sub-pasos. */
    paso(dtS: number): void {
      const { ex, ey, ez } = lutFor(dtS);
      const d = c.data, N = d.length;
      // Dirichlet homogéneo: se trabaja sobre T − T_borde
      if (tB !== 0) for (let t = 0; t < N; t++) d[t] -= tB;
      aplicarEje(d, c.nx, c.ny, c.nz, 'x', cx);
      aplicarEje(d, c.nx, c.ny, c.nz, 'y', cy);
      aplicarEje(d, c.nx, c.ny, c.nz, 'z', cz);
      for (let k = 0; k < c.nz; k++) for (let j = 0; j < c.ny; j++) {
        const decYZ = ey[j] * ez[k], base = (k * c.ny + j) * c.nx;
        for (let i = 0; i < c.nx; i++) d[base + i] *= ex[i] * decYZ;   // la LUT tensor
      }
      // VUELTA con la ADJUNTA (Φᵀ = Φ⁻¹ para ortonormal). La DST-I es simétrica y no
      // lo nota; la DCT-II (Neumann) NO es simétrica y sin esto la vuelta corrompe.
      aplicarEje(d, c.nx, c.ny, c.nz, 'x', cx, true);
      aplicarEje(d, c.nx, c.ny, c.nz, 'y', cy, true);
      aplicarEje(d, c.nx, c.ny, c.nz, 'z', cz, true);
      if (tB !== 0) for (let t = 0; t < N; t++) d[t] += tB;
    },
  };
}

/** paso EXPLÍCITO (Euler adelantado) — el contraste del gate: tiene límite de
 *  estabilidad dt ≤ h²/(6α) y por eso los FDM viejos iban a sub-pasitos. Se queda como
 *  respaldo para lo que la cara no cubre (α variable) hasta que rotemos de cara. */
export function pasoDifusionExplicito(c: Campo3, o: { alphaMm2s: number; dtS: number; tBordeC?: number }): void {
  const lap = laplaciano(c, { borde: 'dirichlet0' });
  const tB = o.tBordeC ?? 0, d = c.data;
  // con fantasmas en 0 el laplaciano ya asume borde 0: trabajar sobre T − T_borde
  if (tB !== 0) {
    const cc: Campo3 = { ...c, data: Float32Array.from(c.data, (v) => v - tB) };
    const l2 = laplaciano(cc, { borde: 'dirichlet0' });
    for (let t = 0; t < d.length; t++) d[t] += o.alphaMm2s * o.dtS * l2.data[t];
    return;
  }
  for (let t = 0; t < d.length; t++) d[t] += o.alphaMm2s * o.dtS * lap.data[t];
}
