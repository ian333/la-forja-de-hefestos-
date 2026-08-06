/**
 * MMS — MÉTODO DE SOLUCIONES MANUFACTURADAS para el solver térmico de la Forja.
 * ============================================================================
 * El problema: no existe solución analítica de −∇·(k∇T)=q para una carcasa real,
 * así que solo podíamos verificar contra cubos y cilindros. Los bugs se esconden
 * justo donde importa (frontera escalonada, k discontinuo acero↔plástico,
 * esquinas irregulares).
 *
 * MMS le da la vuelta (Roache, "Code Verification by the Method of Manufactured
 * Solutions", ASME J. Fluids Eng. 124(1):4-10, 2002; Roy, Nelson, Smith &
 * Ober, "Verification of Euler/Navier-Stokes codes using the method of
 * manufactured solutions", Int. J. Numer. Meth. Fluids 44:599-620, 2004):
 *
 *   1. Te INVENTAS una función suave T*(x,y,z) — no hace falta que sea física.
 *   2. La metes en el operador: S = L(T*) = −∇·(k∇T*), en forma CERRADA.
 *   3. Resuelves L(T)=S con las condiciones de frontera que T* mismo impone.
 *   4. La respuesta exacta es T* POR CONSTRUCCIÓN — en CUALQUIER geometría.
 *
 * LO QUE PRUEBA CORRECTITUD NO ES EL NÚMERO: ES EL ORDEN OBSERVADO.
 * Acertar en una malla no prueba nada (puede ser casualidad o dos errores que se
 * cancelan). Lo que prueba que el esquema está bien implementado es que el orden
 * observado p (error ∝ h^p) coincida con el orden TEÓRICO del esquema. Un signo
 * cambiado, un índice corrido o una CF aplicada en el nodo equivocado degradan p
 * aunque el número se vea razonable. p ES EL DETECTOR DE BUGS.
 *
 * ── EL ESQUEMA QUE SE VERIFICA (leído de `mold/thermal-steady.ts`) ───────────
 * Volúmenes finitos centrados en celda, malla uniforme h:
 *   · conductancia de cara por MEDIA ARMÓNICA  g = A/(h/2k₁ + h/2k₂)      (L79)
 *   · balance de 7 puntos  diag·T_n − Σ g·T_vec = b                     (L97-109)
 *   · frontera exterior: cara OMITIDA ⇒ flujo nulo (Neumann adiabático) (L82-84)
 *   · sumidero de agua LUMPED por celda  g_w = h_c·π·D·h                 (L86)
 *   · gradiente conjugado matrix-free (SPD)                            (L118-133)
 * ORDEN TEÓRICO: 2 en el interior (el balance de 7 puntos con media armónica es
 * O(h²) para T suave y para k discontinuo con la interfaz SOBRE una cara), y la
 * clausura Dirichlet de media celda (g=2kA/h) tiene error de truncamiento local
 * O(h) en la fila de frontera pero contribución O(h²) al error global (super-
 * convergencia clásica de VF centrado en celda). ⇒ p_teórico = 2. No se asume:
 * se MIDE aquí abajo.
 *
 * ── POR QUÉ HAY UNA RÉPLICA DEL OPERADOR ────────────────────────────────────
 * `solveSteadyMoldField` no acepta un término fuente arbitrario ni CF por celda
 * (su `b` es q̇/V en las celdas de plástico + el Robin del agua a UNA temperatura
 * escalar), así que NO puede expresar un problema MMS. `ensamblarFV` de aquí es
 * la transcripción LITERAL de ese mismo operador con la fuente y las CF abiertas.
 * Para que la réplica no sea "otro código": el gate mide PARIDAD ALGEBRAICA —
 * resuelve un problema que ambos SÍ pueden expresar y comprueba que la solución
 * del solver real satisface el sistema de la réplica con el mismo residuo que
 * reporta el solver real. Si las matrices difirieran, ese residuo sería O(1).
 *
 * PURO: sin DOM, sin fs, sin dependencias. `node --import tsx` lo importa directo.
 */

export type Vec3 = [number, number, number];

// ════════════════════════════════════════════════════════════════════════════
// 1 · SOLUCIONES MANUFACTURADAS (derivadas ANALÍTICAS, nunca por diferencias)
// ════════════════════════════════════════════════════════════════════════════

/** los campos que TÚ inventas: T*, sus derivadas, y el k(x) del operador. */
export interface CamposMS {
  id: string;
  descripcion: string;
  T(x: number, y: number, z: number): number;
  gradT(x: number, y: number, z: number): Vec3;
  /** ∇²T* (laplaciano escalar) */
  lapT(x: number, y: number, z: number): number;
  k(x: number, y: number, z: number): number;
  /** ∇k — cero si k es constante o constante a trozos (la interfaz vive en una CARA) */
  gradK(x: number, y: number, z: number): Vec3;
}

export interface SolucionManufacturada extends CamposMS {
  /** S = −∇·(k∇T*) [W/m³], FORMA CERRADA */
  fuente(x: number, y: number, z: number): number;
  /** q = −k∇T* [W/m²] */
  flujo(x: number, y: number, z: number): Vec3;
  /** q·n̂ (flujo SALIENTE por una cara de normal n̂) */
  flujoNormal(x: number, y: number, z: number, n: Vec3): number;
  /** el T∞ del Robin que hace que T* sea la solución exacta:
   *  q_sal = h_c·(T_sup − T∞)  ⇒  T∞ = T*(x) + (k∇T*·n̂)/h_c */
  tInfRobin(x: number, y: number, z: number, n: Vec3, hConv: number): number;
}

/**
 * S = −∇·(k∇T*) = −(∇k·∇T* + k·∇²T*). La identidad se escribe UNA vez: si está
 * mal, TODOS los casos fallan a la vez (y el gate la contrasta contra derivadas
 * numéricas Richardson, check M1).
 */
export function fuenteMMS(c: CamposMS): (x: number, y: number, z: number) => number {
  return (x, y, z) => {
    const g = c.gradT(x, y, z);
    const gk = c.gradK(x, y, z);
    return -(gk[0] * g[0] + gk[1] * g[1] + gk[2] * g[2] + c.k(x, y, z) * c.lapT(x, y, z));
  };
}

/** envuelve unos CamposMS y le cuelga fuente/flujo/CF derivadas de ellos. */
export function manufacturar(c: CamposMS): SolucionManufacturada {
  const S = fuenteMMS(c);
  const flujo = (x: number, y: number, z: number): Vec3 => {
    const g = c.gradT(x, y, z), k = c.k(x, y, z);
    return [-k * g[0], -k * g[1], -k * g[2]];
  };
  const flujoNormal = (x: number, y: number, z: number, n: Vec3) => {
    const q = flujo(x, y, z);
    return q[0] * n[0] + q[1] * n[1] + q[2] * n[2];
  };
  return {
    ...c,
    fuente: S,
    flujo,
    flujoNormal,
    tInfRobin(x, y, z, n, hConv) {
      // q_sal = h(T_s − T∞) ⇒ T∞ = T_s − q_sal/h
      return c.T(x, y, z) - flujoNormal(x, y, z, n) / hConv;
    },
  };
}

/** T* = amp·sin(a·x)·cos(b·y)·exp(c·z) + T0, con k CONSTANTE. */
export function msTrigExp(o: { a: number; b: number; c: number; k0: number; amp?: number; t0?: number }): SolucionManufacturada {
  const { a, b, c, k0 } = o, amp = o.amp ?? 60, t0 = o.t0 ?? 90;
  return manufacturar({
    id: 'trig-exp',
    descripcion: `T* = ${t0} + ${amp}·sin(${a}x)·cos(${b}y)·exp(${c}z) · k=${k0} cte`,
    T: (x, y, z) => t0 + amp * Math.sin(a * x) * Math.cos(b * y) * Math.exp(c * z),
    gradT: (x, y, z) => {
      const e = Math.exp(c * z);
      return [
        amp * a * Math.cos(a * x) * Math.cos(b * y) * e,
        -amp * b * Math.sin(a * x) * Math.sin(b * y) * e,
        amp * c * Math.sin(a * x) * Math.cos(b * y) * e,
      ];
    },
    // ∇²(sin·cos·exp) = (−a² − b² + c²)·(sin·cos·exp)
    lapT: (x, y, z) => (-a * a - b * b + c * c) * amp * Math.sin(a * x) * Math.cos(b * y) * Math.exp(c * z),
    k: () => k0,
    gradK: () => [0, 0, 0],
  });
}

/** coeficientes del polinomio (grado ≤ 4). Los términos de grado 4 son los que
 *  dejan truncamiento vivo: el laplaciano de 7 puntos es EXACTO hasta grado 3. */
export interface CoefsPoli {
  a0: number; ax: number; ay: number; az: number;
  bxx: number; byy: number; bzz: number;
  cxy: number; cyz: number; czx: number;
  dx4: number; dy4: number; dz4: number;
  exy: number; eyz: number; ezx: number;   // x²y², y²z², z²x²
}

export const POLI_LINEAL: CoefsPoli = {
  a0: 85, ax: 130, ay: -70, az: 45,
  bxx: 0, byy: 0, bzz: 0, cxy: 0, cyz: 0, czx: 0,
  dx4: 0, dy4: 0, dz4: 0, exy: 0, eyz: 0, ezx: 0,
};

export const POLI_CUARTICO: CoefsPoli = {
  a0: 85, ax: 130, ay: -70, az: 45,
  bxx: 240, byy: -155, bzz: 96, cxy: 62, cyz: -38, czx: 51,
  dx4: 310, dy4: -220, dz4: 140, exy: 95, eyz: -66, ezx: 77,
};

/** T* polinómica (grado ≤ 4) con k constante — derivadas exactas término a término. */
export function msPolinomica(o: { k0: number; coefs?: CoefsPoli; id?: string }): SolucionManufacturada {
  const k0 = o.k0, C = o.coefs ?? POLI_CUARTICO;
  const grado = (C.dx4 || C.dy4 || C.dz4 || C.exy || C.eyz || C.ezx) ? 4
    : (C.bxx || C.byy || C.bzz || C.cxy || C.cyz || C.czx) ? 2 : 1;
  return manufacturar({
    id: o.id ?? `poli-g${grado}`,
    descripcion: `T* polinómica de grado ${grado} · k=${k0} cte`,
    T: (x, y, z) => C.a0 + C.ax * x + C.ay * y + C.az * z
      + C.bxx * x * x + C.byy * y * y + C.bzz * z * z
      + C.cxy * x * y + C.cyz * y * z + C.czx * z * x
      + C.dx4 * x ** 4 + C.dy4 * y ** 4 + C.dz4 * z ** 4
      + C.exy * x * x * y * y + C.eyz * y * y * z * z + C.ezx * z * z * x * x,
    gradT: (x, y, z) => [
      C.ax + 2 * C.bxx * x + C.cxy * y + C.czx * z + 4 * C.dx4 * x ** 3 + 2 * C.exy * x * y * y + 2 * C.ezx * x * z * z,
      C.ay + 2 * C.byy * y + C.cxy * x + C.cyz * z + 4 * C.dy4 * y ** 3 + 2 * C.exy * x * x * y + 2 * C.eyz * y * z * z,
      C.az + 2 * C.bzz * z + C.cyz * y + C.czx * x + 4 * C.dz4 * z ** 3 + 2 * C.eyz * y * y * z + 2 * C.ezx * z * x * x,
    ],
    lapT: (x, y, z) =>
      (2 * C.bxx + 12 * C.dx4 * x * x + 2 * C.exy * y * y + 2 * C.ezx * z * z)
      + (2 * C.byy + 12 * C.dy4 * y * y + 2 * C.exy * x * x + 2 * C.eyz * z * z)
      + (2 * C.bzz + 12 * C.dz4 * z * z + 2 * C.eyz * y * y + 2 * C.ezx * x * x),
    k: () => k0,
    gradK: () => [0, 0, 0],
  });
}

/**
 * k VARIABLE Y SUAVE: k(x) = k0·(1 + β·sin(ω·x + φ)). Ejercita el operador de
 * conductividad no uniforme — el término ∇k·∇T que una media aritmética de cara
 * (o "el k de la celda dueña") se come, degradando el orden a 1.
 */
export function msKSuave(o: { k0: number; beta: number; omega: number; fase?: number; a: number; b: number; c: number; amp?: number; t0?: number }): SolucionManufacturada {
  const { k0, beta, omega, a, b, c } = o, fase = o.fase ?? 0.4, amp = o.amp ?? 60, t0 = o.t0 ?? 90;
  if (Math.abs(beta) >= 1) throw new Error('MMS: beta ≥ 1 haría k ≤ 0 (no físico)');
  const base = msTrigExp({ a, b, c, k0: 1, amp, t0 });
  return manufacturar({
    id: 'k-suave',
    descripcion: `T* = trig-exp · k(x) = ${k0}·(1 + ${beta}·sin(${omega}x + ${fase}))`,
    T: base.T, gradT: base.gradT, lapT: base.lapT,
    k: (x) => k0 * (1 + beta * Math.sin(omega * x + fase)),
    gradK: (x) => [k0 * beta * omega * Math.cos(omega * x + fase), 0, 0],
  });
}

/**
 * k DISCONTINUO acero↔plástico (NUESTRO caso: k=32 vs k=0.19), interfaz plana en
 * x = xi. La solución manufacturada se construye con el POTENCIAL DE FLUJO
 * G(x)=∫dξ/k(ξ) para que T* y el FLUJO NORMAL k·∂T/∂x sean CONTINUOS en la
 * interfaz — que es la condición física real (el flujo tangencial SÍ salta, y
 * debe saltar). Con eso, la media armónica de cara es EXACTA en la interfaz y el
 * orden debe seguir siendo 2.
 *
 *   T*(x,y,z) = (A·G(x) + B)·g(y,z),  g = 1 + γ·cos(π(y−y0)/Ly)·cos(π(z−z0)/Lz)
 *   k·∂T/∂x = A·g(y,z)   ⇒ continuo ✓         S = k(x)·(A·G+B)·γ·(π²/Ly²+π²/Lz²)·cos·cos
 */
export function msKCapas(o: {
  x0: number; xi: number; k1: number; k2: number;
  y0: number; Ly: number; z0: number; Lz: number;
  A: number; B: number; gamma: number;
}): SolucionManufacturada {
  const { x0, xi, k1, k2, y0, Ly, z0, Lz, A, B, gamma } = o;
  const kx = (x: number) => (x < xi ? k1 : k2);
  const G = (x: number) => (x < xi ? (x - x0) / k1 : (xi - x0) / k1 + (x - xi) / k2);
  const wy = Math.PI / Ly, wz = Math.PI / Lz;
  const g = (y: number, z: number) => 1 + gamma * Math.cos(wy * (y - y0)) * Math.cos(wz * (z - z0));
  const gy = (y: number, z: number) => -gamma * wy * Math.sin(wy * (y - y0)) * Math.cos(wz * (z - z0));
  const gz = (y: number, z: number) => -gamma * wz * Math.cos(wy * (y - y0)) * Math.sin(wz * (z - z0));
  const gLap = (y: number, z: number) => -gamma * (wy * wy + wz * wz) * Math.cos(wy * (y - y0)) * Math.cos(wz * (z - z0));
  return manufacturar({
    id: 'k-capas',
    descripcion: `T* por capas · k=${k1} (x<${xi.toFixed(4)}) | k=${k2} (x>${xi.toFixed(4)}) · flujo normal CONTINUO`,
    T: (x, y, z) => (A * G(x) + B) * g(y, z),
    gradT: (x, y, z) => [
      (A / kx(x)) * g(y, z),            // ⇒ k·T_x = A·g  (continuo por construcción)
      (A * G(x) + B) * gy(y, z),
      (A * G(x) + B) * gz(y, z),
    ],
    // T_xx = 0 DENTRO de cada capa (T_x es constante en x ahí); el salto vive en la cara.
    lapT: (x, y, z) => (A * G(x) + B) * gLap(y, z),
    k: (x) => kx(x),
    gradK: () => [0, 0, 0],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 2 · ORDEN OBSERVADO (mínimos cuadrados en log-log + R²)
// ════════════════════════════════════════════════════════════════════════════

export interface AjusteOrden {
  /** pendiente de log(e) vs log(h) — el ORDEN OBSERVADO */
  p: number;
  /** ordenada al origen (log de la constante del error) */
  logC: number;
  /** coeficiente de determinación del ajuste */
  R2: number;
  n: number;
  /** órdenes por PAREJA consecutiva (log(e_i/e_{i+1})/log(h_i/h_{i+1})) */
  porPareja: number[];
}

/**
 * Orden observado por mínimos cuadrados sobre log(e) = p·log(h) + log(C).
 * R² < 0.99 significa que los puntos NO caen en una recta: o hay error algebraico
 * del solver contaminando la malla fina, o el orden no es uniforme. Ambas cosas
 * son hallazgos, no ruido que se tape.
 */
export function ordenObservado(pts: Array<{ h: number; e: number }>): AjusteOrden {
  const buenos = pts.filter((q) => q.e > 0 && Number.isFinite(q.e) && q.h > 0);
  if (buenos.length < 2) throw new Error('MMS: se necesitan ≥2 mallas con error > 0 para medir orden');
  const X = buenos.map((q) => Math.log(q.h));
  const Y = buenos.map((q) => Math.log(q.e));
  const n = X.length;
  const mx = X.reduce((a, b) => a + b, 0) / n;
  const my = Y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (X[i] - mx) * (Y[i] - my); sxx += (X[i] - mx) ** 2; syy += (Y[i] - my) ** 2; }
  const p = sxy / sxx;
  const logC = my - p * mx;
  const R2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 1;
  const porPareja: number[] = [];
  for (let i = 1; i < buenos.length; i++) {
    porPareja.push(Math.log(buenos[i - 1].e / buenos[i].e) / Math.log(buenos[i - 1].h / buenos[i].h));
  }
  return { p, logC, R2, n, porPareja };
}

// ════════════════════════════════════════════════════════════════════════════
// 3 · EL OPERADOR (réplica LITERAL de thermal-steady.ts, con fuente y CF abiertas)
// ════════════════════════════════════════════════════════════════════════════

export interface MallaFV {
  nx: number; ny: number; nz: number;
  /** paso uniforme, METROS */
  h: number;
  /** esquina mínima del dominio, METROS. Centro de celda i = x0 + (i+½)h */
  x0: number; y0: number; z0: number;
}

export const centroCelda = (m: MallaFV, i: number, j: number, k: number): Vec3 =>
  [m.x0 + (i + 0.5) * m.h, m.y0 + (j + 0.5) * m.h, m.z0 + (k + 0.5) * m.h];

/** normales SALIENTES de las 6 direcciones, en orden −x,+x,−y,+y,−z,+z */
export const NORMALES: Vec3[] = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];

export interface CaraFrontera {
  i: number; j: number; k: number;
  /** 0..5 (ver NORMALES) */
  dir: number;
  /** centro de la CARA (m) */
  x: number; y: number; z: number;
  n: Vec3;
  /** k de la celda dueña (W/m·K) */
  kCelda: number;
  /** área de la cara (m²) */
  area: number;
  /** true si el vecino existe en la malla pero está fuera del dominio activo
   *  (frontera INTERNA escalonada: la superficie de la pieza). false = borde de la caja. */
  interna: boolean;
}

/**
 * `dReal` = CELDA CORTADA (Shortley-Weller). Distancia VERDADERA del centro de celda
 * a la superficie a lo largo de la normal de la cara, en metros.
 *
 * Sin ella, el dato de frontera se aplica en la cara del vóxel, o sea a h/2 del centro
 * SIEMPRE — aunque la superficie real esté a 0.03·h o a 0.97·h. Eso desplaza la CF hasta
 * media celda y, peor, el patrón de escalones CAMBIA con cada malla: el error deja de
 * bajar monótono y el orden se derrumba de 2 a ~0.66 (medido con MMS sobre la carcasa
 * Hammond 1554B). Con la distancia real el esquema recupera su orden.
 *
 * Si se omite, se usa h/2 y el comportamiento es el de antes (escalonado).
 */
export type CondFrontera =
  | { tipo: 'dirichlet'; T: number; dReal?: number }
  | { tipo: 'robin'; hConv: number; tInf: number; dReal?: number }
  | { tipo: 'neumann'; qSaliente: number };

/**
 * BUGS DELIBERADOS para los CONTROLES NEGATIVOS. Un arnés que nunca reprueba es
 * un sello: cada uno DEBE degradar el orden observado, y el gate lo comprueba.
 */
export type BugMMS =
  | 'ninguno'
  /** signo invertido del término de divergencia. Algebraicamente = resolver
   *  L·T = −S; preserva la SPD, así que el CG converge y el fallo se MIDE en el
   *  orden en vez de reventar el solver. */
  | 'signo-operador'
  /** k de la celda DUEÑA en la cara en vez de la media armónica (efecto nulo si
   *  k es uniforme: el control solo tiene dientes con k variable). */
  | 'k-cara-duena'
  /** la CF aplicada en el NODO DE ADENTRO: distancia h en vez de h/2 hasta la cara. */
  | 'cf-nodo-interior'
  /** índice corrido: la fuente de la celda i se evalúa en la celda i+1. */
  | 'fuente-indice-corrido';

export interface ProblemaFV {
  malla: MallaFV;
  /** 1 = celda del dominio. Ausente = todas activas. */
  activa?: Uint8Array;
  /** conductividad por celda (W/m·K) */
  k: Float64Array;
  /** fuente volumétrica por celda (W/m³) */
  s: Float64Array;
  /** condición para CADA cara de frontera del dominio activo */
  frontera(c: CaraFrontera): CondFrontera;
  /** sumidero LUMPED por celda — el modelo de línea de agua de thermal-steady
   *  (g_w = h_c·π·D·h aplicado a la T del CENTRO de celda, no a una cara). */
  sumideroG?: Float64Array;
  sumideroT?: Float64Array;
  bug?: BugMMS;
}

export interface SistemaFV {
  malla: MallaFV;
  N: number;
  activa: Uint8Array;
  /** y ← A·x (solo celdas activas; las inactivas quedan en 0) */
  aplicarA(x: Float64Array, y: Float64Array): void;
  b: Float64Array;
  diag: Float64Array;
  /** caras de frontera con su conductancia y su dato (para el balance global) */
  caras: Array<{ n: number; g: number; tBc: number; qA: number }>;
  nActivas: number;
  /** true si hay al menos un anclaje (Dirichlet/Robin/sumidero) ⇒ A no singular */
  anclado: boolean;
}

const idxDe = (m: MallaFV) => (i: number, j: number, k: number) => (k * m.ny + j) * m.nx + i;

/**
 * ENSAMBLA el sistema. Transcripción literal de `thermal-steady.ts`:
 *   g_cara = A/(h/2k₁ + h/2k₂)   ·   diag = Σg (+ sumidero)   ·   A·x = diag·x − Σg·x_vec
 * Extensiones (NO cambios de esquema): fuente por celda, CF por cara, máscara de
 * dominio activo, y las variantes con bug para los controles negativos.
 */
export function ensamblarFV(p: ProblemaFV): SistemaFV {
  const m = p.malla, { nx, ny, nz, h } = m;
  const N = nx * ny * nz;
  const idx = idxDe(m);
  const activa = p.activa ?? new Uint8Array(N).fill(1);
  const bug = p.bug ?? 'ninguno';
  const A2 = h * h, V = h * h * h;
  const gX = new Float64Array(N), gY = new Float64Array(N), gZ = new Float64Array(N);
  const diag = new Float64Array(N), b = new Float64Array(N);
  const conduct = (a: number, c: number) => bug === 'k-cara-duena'
    ? (p.k[a] / h) * A2                               // BUG: el k de la celda dueña
    : (1 / (h / (2 * p.k[a]) + h / (2 * p.k[c]))) * A2; // media ARMÓNICA (thermal-steady L79)
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = idx(i, j, k);
    if (!activa[n]) continue;
    if (i < nx - 1 && activa[idx(i + 1, j, k)]) gX[n] = conduct(n, idx(i + 1, j, k));
    if (j < ny - 1 && activa[idx(i, j + 1, k)]) gY[n] = conduct(n, idx(i, j + 1, k));
    if (k < nz - 1 && activa[idx(i, j, k + 1)]) gZ[n] = conduct(n, idx(i, j, k + 1));
  }
  const caras: SistemaFV['caras'] = [];
  let nActivas = 0, anclado = false;
  // distancia centro→cara. h/2 es LA correcta; h es el bug "CF en el nodo de adentro".
  const dBc = bug === 'cf-nodo-interior' ? h : h / 2;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = idx(i, j, k);
    if (!activa[n]) continue;
    nActivas++;
    let d = 0;
    if (i < nx - 1) d += gX[n];
    if (i > 0) d += gX[idx(i - 1, j, k)];
    if (j < ny - 1) d += gY[n];
    if (j > 0) d += gY[idx(i, j - 1, k)];
    if (k < nz - 1) d += gZ[n];
    if (k > 0) d += gZ[idx(i, j, k - 1)];
    // fuente: S·V (regla del punto medio ⇒ O(h²), consistente con el esquema)
    let nS = n;
    if (bug === 'fuente-indice-corrido' && i < nx - 1 && activa[idx(i + 1, j, k)]) nS = idx(i + 1, j, k);
    b[n] = (bug === 'signo-operador' ? -1 : 1) * p.s[nS] * V;
    // sumidero lumped (línea de agua)
    if (p.sumideroG && p.sumideroG[n] > 0) {
      d += p.sumideroG[n];
      b[n] += p.sumideroG[n] * (p.sumideroT ? p.sumideroT[n] : 0);
      caras.push({ n, g: p.sumideroG[n], tBc: p.sumideroT ? p.sumideroT[n] : 0, qA: 0 });
      anclado = true;
    }
    // CARAS DE FRONTERA: vecino inexistente o inactivo
    const vec = [
      i > 0 ? idx(i - 1, j, k) : -1, i < nx - 1 ? idx(i + 1, j, k) : -1,
      j > 0 ? idx(i, j - 1, k) : -1, j < ny - 1 ? idx(i, j + 1, k) : -1,
      k > 0 ? idx(i, j, k - 1) : -1, k < nz - 1 ? idx(i, j, k + 1) : -1,
    ];
    const cx = m.x0 + (i + 0.5) * h, cy = m.y0 + (j + 0.5) * h, cz = m.z0 + (k + 0.5) * h;
    for (let dir = 0; dir < 6; dir++) {
      if (vec[dir] >= 0 && activa[vec[dir]]) continue;
      const nrm = NORMALES[dir];
      const cara: CaraFrontera = {
        i, j, k, dir,
        x: cx + 0.5 * h * nrm[0], y: cy + 0.5 * h * nrm[1], z: cz + 0.5 * h * nrm[2],
        n: nrm, kCelda: p.k[n], area: A2, interna: vec[dir] >= 0,
      };
      const cond = p.frontera(cara);
      if (cond.tipo === 'neumann') {
        // el flujo SALIENTE dado sale del balance: b −= q_sal·A
        b[n] -= cond.qSaliente * A2;
        caras.push({ n, g: 0, tBc: 0, qA: cond.qSaliente * A2 });
      } else {
        // CELDA CORTADA: la distancia real manda sobre el h/2 del vóxel. Se acota por
        // abajo a 1e-3·h para que una celda casi tangente no dispare la conductancia
        // (el "small cell problem" clásico de las fronteras embebidas) — la cota va
        // DECLARADA porque es una extensión, no un resultado del esquema.
        const dEff = Math.max(cond.dReal ?? dBc, h * 1e-3);
        const g = cond.tipo === 'dirichlet'
          ? A2 / (dEff / p.k[n])                         // clausura hasta la superficie
          : A2 / (dEff / p.k[n] + 1 / cond.hConv);       // Robin en serie con ese tramo
        const tBc = cond.tipo === 'dirichlet' ? cond.T : cond.tInf;
        d += g;
        b[n] += g * tBc;
        caras.push({ n, g, tBc, qA: 0 });
        anclado = true;
      }
    }
    diag[n] = d;
  }
  const aplicarA = (x: Float64Array, y: Float64Array) => {
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const n = idx(i, j, k);
      if (!activa[n]) { y[n] = 0; continue; }
      let acc = 0;
      if (i > 0) acc += gX[idx(i - 1, j, k)] * x[idx(i - 1, j, k)];
      if (i < nx - 1) acc += gX[n] * x[idx(i + 1, j, k)];
      if (j > 0) acc += gY[idx(i, j - 1, k)] * x[idx(i, j - 1, k)];
      if (j < ny - 1) acc += gY[n] * x[idx(i, j + 1, k)];
      if (k > 0) acc += gZ[idx(i, j, k - 1)] * x[idx(i, j, k - 1)];
      if (k < nz - 1) acc += gZ[n] * x[idx(i, j, k + 1)];
      y[n] = diag[n] * x[n] - acc;
    }
  };
  return { malla: m, N, activa, aplicarA, b, diag, caras, nActivas, anclado };
}

export interface SolucionFV {
  T: Float64Array;
  iters: number;
  /** ‖r‖₂ final */
  resid: number;
  /** ‖r‖₂/‖b‖₂ — el ERROR ALGEBRAICO. Si no es ≪ error de discretización, el
   *  orden medido es del solver iterativo, no del esquema. Se REPORTA siempre. */
  residRel: number;
  sistema: SistemaFV;
}

/** Gradiente conjugado precondicionado por Jacobi (mismo CG matrix-free de
 *  thermal-steady; el precondicionador solo acelera, no cambia la solución). */
export function resolverCG(sis: SistemaFV, o?: { tolRel?: number; maxIters?: number; T0?: Float64Array }): SolucionFV {
  if (!sis.anclado) throw new Error('MMS: sistema sin anclaje (Neumann puro) ⇒ A singular');
  const N = sis.N, tolRel = o?.tolRel ?? 1e-13, maxIters = o?.maxIters ?? 60000;
  const T = new Float64Array(N);
  if (o?.T0) T.set(o.T0);
  const r = new Float64Array(N), z = new Float64Array(N), pv = new Float64Array(N), Ap = new Float64Array(N);
  const inv = new Float64Array(N);
  for (let n = 0; n < N; n++) inv[n] = sis.diag[n] > 0 ? 1 / sis.diag[n] : 0;
  sis.aplicarA(T, Ap);
  let nb = 0;
  for (let n = 0; n < N; n++) { r[n] = sis.activa[n] ? sis.b[n] - Ap[n] : 0; nb += sis.b[n] * sis.b[n]; }
  nb = Math.sqrt(nb) || 1;
  for (let n = 0; n < N; n++) { z[n] = inv[n] * r[n]; pv[n] = z[n]; }
  let rz = 0; for (let n = 0; n < N; n++) rz += r[n] * z[n];
  let iters = 0, rr = 0;
  for (let n = 0; n < N; n++) rr += r[n] * r[n];
  let resid = Math.sqrt(rr);
  while (iters < maxIters && resid / nb > tolRel) {
    sis.aplicarA(pv, Ap);
    let pAp = 0; for (let n = 0; n < N; n++) pAp += pv[n] * Ap[n];
    if (!(Math.abs(pAp) > 0)) break;
    const alpha = rz / pAp;
    for (let n = 0; n < N; n++) { T[n] += alpha * pv[n]; r[n] -= alpha * Ap[n]; }
    let rz2 = 0, rr2 = 0;
    for (let n = 0; n < N; n++) { z[n] = inv[n] * r[n]; rz2 += r[n] * z[n]; rr2 += r[n] * r[n]; }
    const beta = rz2 / rz;
    for (let n = 0; n < N; n++) pv[n] = z[n] + beta * pv[n];
    rz = rz2; resid = Math.sqrt(rr2); iters++;
  }
  return { T, iters, resid, residRel: resid / nb, sistema: sis };
}

export function resolverFV(p: ProblemaFV, o?: { tolRel?: number; maxIters?: number }): SolucionFV {
  return resolverCG(ensamblarFV(p), o);
}

/**
 * BALANCE GLOBAL DE POTENCIA (conservación discreta). En volúmenes finitos es
 * una IDENTIDAD ALGEBRAICA: lo que entra por la fuente sale por las fronteras,
 * a nivel de redondeo. Si no cierra, el ensamble está mal (caras contadas dos
 * veces, diagonal incompleta, sumidero con signo cambiado).
 */
export function balanceGlobal(sol: SolucionFV, s: Float64Array): { entraW: number; saleW: number; escalaW: number; residuoRel: number } {
  const sis = sol.sistema, V = sis.malla.h ** 3;
  let entra = 0, escala = 0;
  for (let n = 0; n < sis.N; n++) if (sis.activa[n]) { entra += s[n] * V; escala += Math.abs(s[n]) * V; }
  let sale = 0;
  for (const c of sis.caras) {
    const w = c.g > 0 ? c.g * (sol.T[c.n] - c.tBc) : c.qA;
    sale += w; escala += Math.abs(w);
  }
  // NORMALIZAR POR LA SUMA DE MAGNITUDES, no por el neto: hay soluciones
  // manufacturadas cuya fuente INTEGRA CERO (p.ej. S ∝ cos(πy/Ly), que sobre el
  // periodo completo se cancela). Ahí `entra` ≈ 0 y dividir entre él convierte un
  // balance perfecto en un residuo relativo de 1.0 — el denominador miente, no el
  // solver. La escala física correcta es cuánta potencia se movió en total.
  const esc = Math.max(escala, 1e-300);
  return { entraW: entra, saleW: sale, escalaW: escala, residuoRel: (entra - sale) / esc };
}

// ════════════════════════════════════════════════════════════════════════════
// 4 · NORMAS DE ERROR
// ════════════════════════════════════════════════════════════════════════════

export interface NormasError {
  /** RMS ponderada por volumen (todas las celdas tienen el mismo V ⇒ RMS) */
  l2: number;
  linf: number;
  /** rango de T* sobre el dominio (para normalizar) */
  escala: number;
  l2Rel: number;
  linfRel: number;
  nCeldas: number;
}

export function normasError(malla: MallaFV, activa: Uint8Array | undefined, T: Float64Array, exacta: (x: number, y: number, z: number) => number): NormasError {
  const { nx, ny, nz } = malla;
  const idx = idxDe(malla);
  let s2 = 0, linf = 0, n = 0, mn = Infinity, mx = -Infinity;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const q = idx(i, j, k);
    if (activa && !activa[q]) continue;
    const c = centroCelda(malla, i, j, k);
    const ex = exacta(c[0], c[1], c[2]);
    const e = Math.abs(T[q] - ex);
    s2 += e * e; if (e > linf) linf = e; n++;
    if (ex < mn) mn = ex; if (ex > mx) mx = ex;
  }
  const l2 = n ? Math.sqrt(s2 / n) : 0;
  const escala = mx > mn ? mx - mn : 1;
  return { l2, linf, escala, l2Rel: l2 / escala, linfRel: linf / escala, nCeldas: n };
}

// ════════════════════════════════════════════════════════════════════════════
// 5 · ARMADO DEL PROBLEMA MMS
// ════════════════════════════════════════════════════════════════════════════

export type TipoFrontera = 'dirichlet' | 'robin' | 'neumann-y-dirichlet';

/**
 * Construye el problema MMS sobre una malla y una máscara de dominio: k y S de
 * la solución manufacturada evaluados en los CENTROS de celda, y las CF del
 * propio T* evaluadas en los CENTROS DE CARA.
 *
 * `datoEn` permite mover el PUNTO donde se lee el dato de frontera — es lo que
 * usa el check de la geometría escalonada: si el dato físico vive en la
 * superficie REAL y se aplica en la cara del vóxel, el desplazamiento es O(h)
 * y el orden se cae. Por defecto lee en el centro de la cara (consistente).
 */
export function problemaMMS(o: {
  malla: MallaFV;
  sol: SolucionManufacturada;
  activa?: Uint8Array;
  frontera: TipoFrontera;
  hConv?: number;
  bug?: BugMMS;
  datoEn?: (c: CaraFrontera) => Vec3;
}): ProblemaFV {
  const { malla, sol } = o;
  const N = malla.nx * malla.ny * malla.nz;
  const idx = idxDe(malla);
  const k = new Float64Array(N), s = new Float64Array(N);
  for (let kk = 0; kk < malla.nz; kk++) for (let j = 0; j < malla.ny; j++) for (let i = 0; i < malla.nx; i++) {
    const n = idx(i, j, kk);
    const c = centroCelda(malla, i, j, kk);
    k[n] = sol.k(c[0], c[1], c[2]);
    s[n] = sol.fuente(c[0], c[1], c[2]);
  }
  const hConv = o.hConv ?? 1000;
  const donde = o.datoEn ?? ((c: CaraFrontera): Vec3 => [c.x, c.y, c.z]);
  return {
    malla, activa: o.activa, k, s, bug: o.bug,
    frontera(c) {
      const [px, py, pz] = donde(c);
      if (o.frontera === 'dirichlet') return { tipo: 'dirichlet', T: sol.T(px, py, pz) };
      if (o.frontera === 'robin') return { tipo: 'robin', hConv, tInf: sol.tInfRobin(px, py, pz, c.n, hConv) };
      // mezcla: Neumann en −x/+x (flujo exacto de T*) y Dirichlet en el resto
      if (c.dir <= 1) return { tipo: 'neumann', qSaliente: sol.flujoNormal(px, py, pz, c.n) };
      return { tipo: 'dirichlet', T: sol.T(px, py, pz) };
    },
  };
}

/** malla cúbica de n celdas por lado sobre [x0, x0+L]³ (metros). */
export function mallaCubo(n: number, L: number, x0 = 0, y0 = 0, z0 = 0): MallaFV {
  return { nx: n, ny: n, nz: n, h: L / n, x0, y0, z0 };
}

export interface PuntoConvergencia { n: number; h: number; l2: number; linf: number; l2Rel: number; residRel: number; iters: number; celdas: number }

/** corre un barrido de refinamiento y devuelve los puntos + el orden observado. */
export function barridoMMS(o: {
  sol: SolucionManufacturada;
  ns: number[];
  L: number;
  origen?: Vec3;
  frontera: TipoFrontera;
  hConv?: number;
  bug?: BugMMS;
  tolRel?: number;
}): { puntos: PuntoConvergencia[]; ajuste: AjusteOrden } {
  const org = o.origen ?? [0, 0, 0];
  const puntos: PuntoConvergencia[] = [];
  for (const n of o.ns) {
    const malla = mallaCubo(n, o.L, org[0], org[1], org[2]);
    const p = problemaMMS({ malla, sol: o.sol, frontera: o.frontera, hConv: o.hConv, bug: o.bug });
    const sol = resolverFV(p, { tolRel: o.tolRel ?? 1e-13 });
    const e = normasError(malla, undefined, sol.T, o.sol.T);
    puntos.push({ n, h: malla.h, l2: e.l2, linf: e.linf, l2Rel: e.l2Rel, residRel: sol.residRel, iters: sol.iters, celdas: n ** 3 });
  }
  return { puntos, ajuste: ordenObservado(puntos.map((q) => ({ h: q.h, e: q.l2 }))) };
}

// ════════════════════════════════════════════════════════════════════════════
// 6 · DERIVADAS NUMÉRICAS DE ALTA PRECISIÓN (para AUDITAR la fuente analítica)
// ════════════════════════════════════════════════════════════════════════════

/**
 * −∇·(k∇T) por diferencias centradas de 4º orden con extrapolación de Richardson.
 * NO se usa para armar la fuente (eso contaminaría el orden): se usa UNA vez para
 * comprobar que el álgebra de `fuenteMMS` está bien. Es el bug más común del MMS.
 */
export function divergenciaNumerica(c: CamposMS, x: number, y: number, z: number, d: number): number {
  const F = (px: number, py: number, pz: number, eje: number) => {
    const g = c.gradT(px, py, pz);
    return -c.k(px, py, pz) * g[eje];
  };
  const der = (eje: number) => {
    const p: Vec3 = [x, y, z];
    const ev = (t: number) => {
      const q: Vec3 = [p[0], p[1], p[2]];
      q[eje] += t;
      return F(q[0], q[1], q[2], eje);
    };
    // 4º orden: (−f(2d) + 8f(d) − 8f(−d) + f(−2d)) / (12d)
    return (-ev(2 * d) + 8 * ev(d) - 8 * ev(-d) + ev(-2 * d)) / (12 * d);
  };
  return der(0) + der(1) + der(2);
}

// ════════════════════════════════════════════════════════════════════════════
// 7 · LA LÁMINA (log-log del error vs h con la pendiente medida impresa)
// ════════════════════════════════════════════════════════════════════════════

export interface SerieConvergencia {
  nombre: string;
  color: string;
  puntos: Array<{ h: number; e: number }>;
  ajuste: AjusteOrden;
  /** línea punteada = control negativo / hallazgo declarado */
  punteada?: boolean;
}

const ESC = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Gráfica log-log de error vs h. Estilo de `mold/laminas-visuales.ts`
 * (fondo #0b0f16, JetBrains Mono). PURA: devuelve el SVG como string.
 */
export function laminaConvergencia(series: SerieConvergencia[], o?: { titulo?: string; sub?: string; W?: number; H?: number; ordenRef?: number }): string {
  const W = o?.W ?? 1160, H = o?.H ?? 900;
  const L = 122, R = 46, TOP = 120, PY1 = H - 264;
  const px0 = L, px1 = W - R, py0 = TOP, py1 = PY1;
  const todos = series.flatMap((s) => s.puntos).filter((q) => q.e > 0 && Number.isFinite(q.e));
  if (!todos.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0b0f16"/></svg>`;
  const lhMin = Math.min(...todos.map((q) => Math.log10(q.h)));
  const lhMax = Math.max(...todos.map((q) => Math.log10(q.h)));
  const leMin = Math.min(...todos.map((q) => Math.log10(q.e)));
  const leMax = Math.max(...todos.map((q) => Math.log10(q.e)));
  const padH = Math.max(0.06, (lhMax - lhMin) * 0.08), padE = Math.max(0.22, (leMax - leMin) * 0.07);
  const hA = lhMin - padH, hB = lhMax + padH, eA = leMin - padE, eB = leMax + padE;
  const X = (h: number) => px0 + ((Math.log10(h) - hA) / (hB - hA)) * (px1 - px0);
  const Y = (e: number) => py1 - ((Math.log10(e) - eA) / (eB - eA)) * (py1 - py0);
  const XL = (lh: number) => px0 + ((lh - hA) / (hB - hA)) * (px1 - px0);
  const YL = (le: number) => py1 - ((le - eA) / (eB - eA)) * (py1 - py0);
  /** h en METROS → etiqueta en mm, que es la unidad del taller */
  const mm = (h: number) => {
    const v = h * 1000;
    return v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);
  };

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  out.push(`<style>
  .bg{fill:#0b0f16}
  .tit{fill:#e9eef5;font:700 21px 'JetBrains Mono',monospace}
  .sub{fill:#8fa3bd;font:400 12.5px 'JetBrains Mono',monospace}
  .ax{stroke:#2a3648;stroke-width:1}
  .grid{stroke:#18202c;stroke-width:1}
  .lbl{fill:#8fa3bd;font:400 11px 'JetBrains Mono',monospace}
  .axt{fill:#c3d0e0;font:700 12px 'JetBrains Mono',monospace}
  .leg{fill:#c3d0e0;font:400 12px 'JetBrains Mono',monospace}
  .legp{fill:#e9eef5;font:700 12px 'JetBrains Mono',monospace}
  .ref{stroke:#c9a227;stroke-width:1.8;stroke-dasharray:7 5;fill:none;opacity:.9}
  .reft{fill:#c9a227;font:700 12px 'JetBrains Mono',monospace}
  .nota{fill:#6d7f96;font:400 11px 'JetBrains Mono',monospace}
  </style>`);
  out.push(`<rect class="bg" width="${W}" height="${H}"/>`);
  out.push(`<text class="tit" x="${L}" y="44">${ESC(o?.titulo ?? 'MMS · orden observado de convergencia')}</text>`);
  // el subtítulo se RECORTA al ancho útil: una línea que se sale del cuadro se lee
  // como dato mutilado (ya nos pasó con las láminas de expulsores).
  const maxSub = Math.floor((px1 - L) / 7.25);
  const subT = o?.sub ?? '-div(k grad T) = S · error L2 vs paso de malla h';
  out.push(`<text class="sub" x="${L}" y="68">${ESC(subT.length > maxSub ? subT.slice(0, maxSub - 1) + '…' : subT)}</text>`);
  out.push(`<text class="sub" x="${L}" y="88">${ESC('la PENDIENTE es el orden: un signo cambiado, un índice corrido o una CF en el nodo')}</text>`);
  out.push(`<text class="sub" x="${L}" y="106">${ESC('equivocado la tuercen aunque el número se vea razonable — p es el detector de bugs')}</text>`);

  // rejilla + etiquetas por década en el error
  for (let d = Math.ceil(eA); d <= Math.floor(eB); d++) {
    const y = YL(d);
    out.push(`<line class="grid" x1="${px0}" y1="${y.toFixed(1)}" x2="${px1}" y2="${y.toFixed(1)}"/>`);
    out.push(`<text class="lbl" x="${px0 - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end">1e${d}</text>`);
  }
  // ticks de h en MILÍMETROS (la unidad con la que se mallan los moldes)
  for (let d = Math.ceil(hA * 4) / 4; d <= hB; d += 0.25) {
    const x = XL(d);
    if (x < px0 - 0.5 || x > px1 + 0.5) continue;
    out.push(`<line class="grid" x1="${x.toFixed(1)}" y1="${py0}" x2="${x.toFixed(1)}" y2="${py1}"/>`);
    out.push(`<text class="lbl" x="${x.toFixed(1)}" y="${py1 + 20}" text-anchor="middle">${mm(Math.pow(10, d))}</text>`);
  }
  out.push(`<rect x="${px0}" y="${py0}" width="${px1 - px0}" height="${py1 - py0}" fill="none" class="ax"/>`);
  out.push(`<text class="axt" x="${(px0 + px1) / 2}" y="${py1 + 44}" text-anchor="middle">paso de malla h  [mm]  ·  escala log</text>`);
  out.push(`<text class="axt" x="30" y="${(py0 + py1) / 2}" text-anchor="middle" transform="rotate(-90 30 ${(py0 + py1) / 2})">error L2  [°C]  ·  escala log</text>`);

  // ── RECTA TEÓRICA DE REFERENCIA: se coloca en el hueco de abajo-izquierda, con la
  // pendiente exacta del orden teórico. No se ancla a una serie (eso la mandaba fuera
  // del cuadro): se ancla al MARCO, para que se pueda comparar a ojo con cualquiera.
  const ordRef = o?.ordenRef ?? 2;
  {
    const xa = hA + (hB - hA) * 0.02, xb = hA + (hB - hA) * 0.44;
    const ya = eA + (eB - eA) * 0.10, yb = ya + ordRef * (xb - xa);
    out.push(`<line class="ref" x1="${XL(xa).toFixed(1)}" y1="${YL(ya).toFixed(1)}" x2="${XL(xb).toFixed(1)}" y2="${YL(yb).toFixed(1)}"/>`);
    out.push(`<text class="reft" x="${(XL(xb) + 10).toFixed(1)}" y="${(YL(yb) + 4).toFixed(1)}">pendiente teórica  h^${ordRef}</text>`);
  }

  for (const s of series) {
    const pts = s.puntos.filter((q) => q.e > 0 && Number.isFinite(q.e)).sort((a, b) => b.h - a.h);
    if (!pts.length) continue;
    const d = pts.map((q, i) => `${i ? 'L' : 'M'}${X(q.h).toFixed(1)},${Y(q.e).toFixed(1)}`).join(' ');
    out.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2"${s.punteada ? ' stroke-dasharray="6 4"' : ''}/>`);
    for (const q of pts) out.push(`<circle cx="${X(q.h).toFixed(1)}" cy="${Y(q.e).toFixed(1)}" r="4.2" fill="${s.color}" stroke="#0b0f16" stroke-width="1.2"/>`);
  }

  // ── LEYENDA: UNA fila por serie (nada de columnas que se encimen), con la PENDIENTE
  //    MEDIDA alineada a la derecha. El nombre se recorta si no cabe.
  const filaH = 21, y0Leg = py1 + 70;
  const xNom = L + 34, xMet = px1;
  const maxCar = Math.floor((xMet - 300 - xNom) / 7.25);
  series.forEach((s, i) => {
    const cy = y0Leg + i * filaH;
    out.push(`<line x1="${L}" y1="${cy - 4}" x2="${L + 26}" y2="${cy - 4}" stroke="${s.color}" stroke-width="2.6"${s.punteada ? ' stroke-dasharray="5 4"' : ''}/>`);
    out.push(`<circle cx="${L + 13}" cy="${cy - 4}" r="3.6" fill="${s.color}"/>`);
    const nom = s.nombre.length > maxCar ? s.nombre.slice(0, maxCar - 1) + '…' : s.nombre;
    out.push(`<text class="leg" x="${xNom}" y="${cy}">${ESC(nom)}</text>`);
    out.push(`<text class="legp" x="${xMet}" y="${cy}" text-anchor="end">orden observado ${s.ajuste.p.toFixed(2)}  ·  R² ${s.ajuste.R2.toFixed(4)}</text>`);
  });
  out.push(`<text class="nota" x="${L}" y="${(y0Leg + series.length * filaH + 14).toFixed(0)}">${ESC('punteado = control negativo o hallazgo declarado (el orden DEBE caerse ahí; si no, el arnés sería un sello)')}</text>`);
  out.push('</svg>');
  return out.join('\n');
}
