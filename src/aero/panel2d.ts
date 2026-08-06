/**
 * ✈️ MÉTODO DE PANELES DE FUENTES (Hess-Smith) — Anderson §3.17
 * =============================================================
 * El flujo alrededor de CUALQUIER sección cerrada que el alumno dibuje. No es
 * una fórmula de libro para una forma concreta: es el solver que convierte un
 * croquis en un campo de presiones.
 *
 * EL HALLAZGO QUE HACE INTERACTIVO ESTE MÓDULO — cita literal de Anderson [p.292]:
 *     *"the values of the integrals depend simply on the panel geometry; they
 *      are NOT properties of the flow"*
 * O sea: la matriz de influencia depende SOLO de la geometría. Se factoriza UNA
 * vez y cada ángulo de ataque nuevo cuesta una sustitución hacia atrás — O(n²)
 * contra O(n³). Por eso `prepararPaneles` (caro) y `resolverAlpha` (barato) están
 * separados: es el mismo patrón caro-una-vez/barato-después que ya usa el FEA de
 * La Forja, y es lo que permite que el alumno arrastre un slider de α y vea la
 * polar redibujarse en vivo.
 *
 * CONVENCIÓN DE ORIENTACIÓN: Anderson numera los nodos en sentido HORARIO, de
 * modo que la normal `beta = Theta + pi/2` apunta hacia AFUERA. Un croquis del
 * CAD puede venir en cualquier sentido, así que `prepararPaneles` DETECTA la
 * orientación por el área con signo y la corrige. Si no, todas las normales
 * apuntarían hacia adentro y el Cp saldría espejeado sin previo aviso.
 */

/** Un panel ya con toda su geometría derivada. */
export interface Panel2D {
  /** nodo inicial */
  X: number; Y: number;
  /** nodo final */
  X2: number; Y2: number;
  /** punto de control: el CENTRO del panel */
  xc: number; yc: number;
  /** ángulo del panel respecto a +x [rad] */
  theta: number;
  /** longitud del panel */
  S: number;
  /** normal unitaria saliente = (cos beta, sin beta), beta = theta + pi/2 */
  nx: number; ny: number;
}

/**
 * Construye los paneles a partir del contorno. `nodos` es una polilínea CERRADA
 * (el último punto se une con el primero; si se repite el primero al final, se
 * ignora la repetición).
 */
export function construirPaneles(nodos: ReadonlyArray<readonly [number, number]>): Panel2D[] {
  let pts = nodos.map((p) => [p[0], p[1]] as [number, number]);
  const n0 = pts.length;
  if (n0 >= 2) {
    const a = pts[0], b = pts[n0 - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-12) pts = pts.slice(0, -1);
  }
  const n = pts.length;
  if (n < 3) throw new Error('construirPaneles: hacen falta al menos 3 nodos distintos');

  // Área con signo (shoelace): positiva ⇒ antihorario. Anderson usa HORARIO,
  // que es el sentido con el que theta+pi/2 apunta hacia afuera.
  let a2 = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    a2 += x1 * y2 - x2 * y1;
  }
  if (a2 > 0) pts.reverse();   // venía antihorario → se voltea

  const out: Panel2D[] = [];
  for (let i = 0; i < n; i++) {
    const [X, Y] = pts[i], [X2, Y2] = pts[(i + 1) % n];
    const dx = X2 - X, dy = Y2 - Y;
    const S = Math.hypot(dx, dy);
    if (S < 1e-14) continue;                       // nodo repetido: se descarta
    const theta = Math.atan2(dy, dx);
    const beta = theta + Math.PI / 2;
    out.push({
      X, Y, X2, Y2,
      xc: (X + X2) / 2, yc: (Y + Y2) / 2,
      theta, S,
      nx: Math.cos(beta), ny: Math.sin(beta),
    });
  }
  if (out.length < 3) throw new Error('construirPaneles: geometría degenerada');
  return out;
}

/** Umbral para el caso colineal (E→0). Ver la nota de robustez abajo. */
const EPS_E = 1e-10;

/**
 * Integrales de influencia del panel `j` sobre el punto de control del panel `i`.
 * Devuelve la NORMAL (ec. 3.163) y la TANGENCIAL (ec. 3.165) — comparten los
 * mismos coeficientes A, B, C, D, E con los papeles intercambiados.
 *
 * ⚠️ ROBUSTEZ [EXTENSIÓN DECLARADA sobre el libro]: `E = sqrt(B − A²)` se anula
 * cuando el punto de control es COLINEAL con el panel j. Anderson no lo menciona
 * porque su ejemplo es un octágono, donde nunca pasa; pero un croquis de CAD
 * tiene tramos rectos y ahí (3.163) da 0/0. Con |E| bajo el umbral se anula el
 * término angular, que es su límite correcto.
 */
export function influencia(pi: Panel2D, pj: Panel2D): { I: number; J: number } {
  const dx = pi.xc - pj.X, dy = pi.yc - pj.Y;
  const cj = Math.cos(pj.theta), sj = Math.sin(pj.theta);
  const ci = Math.cos(pi.theta), si = Math.sin(pi.theta);

  const A = -dx * cj - dy * sj;
  const B = dx * dx + dy * dy;
  const C = Math.sin(pi.theta - pj.theta);
  const D = dy * ci - dx * si;
  const S = pj.S;
  const E = dx * sj - dy * cj;

  const ln = Math.log((S * S + 2 * A * S + B) / B);
  const ang = Math.abs(E) > EPS_E
    ? Math.atan2(S + A, E) - Math.atan2(A, E)
    : 0;
  const k = Math.abs(E) > EPS_E ? (D - A * C) / E : 0;
  return {
    I: (C / 2) * ln + k * ang,          // (3.163) — normal
    J: (k / 2) * ln - C * ang,          // (3.165) — tangencial
  };
}

/**
 * Sesión de paneles: la parte CARA, que solo depende de la geometría.
 * Contiene la matriz de influencia ya factorizada en LU con pivoteo.
 */
export interface SesionPaneles {
  paneles: Panel2D[];
  n: number;
  /** LU de la matriz de influencia normal (n×n), en sitio */
  lu: number[][];
  /** permutación del pivoteo */
  piv: number[];
  /** matriz de influencia tangencial (n×n) — se usa al post-procesar */
  Jt: number[][];
  /** cuerda del perfil (extensión en x) — la longitud de referencia */
  cuerda: number;
}

/**
 * Arma y factoriza la matriz. **Esta es la operación cara**, y depende solo de
 * la geometría: se hace UNA vez por croquis y sirve para todos los ángulos de
 * ataque (Anderson p.292).
 */
export function prepararPaneles(nodos: ReadonlyArray<readonly [number, number]>): SesionPaneles {
  const paneles = construirPaneles(nodos);
  const n = paneles.length;
  const A: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const Jt: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        // Los DOS términos diagonales, y van al revés uno del otro (Anderson p.288-289):
        //   normal     → lambda_i/2      (en la forma ×2pi de la ec. 3.153: pi)
        //   tangencial → 0  "the tangential velocity on a flat source panel
        //                    induced by the panel itself is zero"
        A[i][j] = Math.PI;
        Jt[i][j] = 0;
      } else {
        const { I, J } = influencia(paneles[i], paneles[j]);
        A[i][j] = I;
        Jt[i][j] = J;
      }
    }
  }
  let xmin = Infinity, xmax = -Infinity;
  for (const p of paneles) { xmin = Math.min(xmin, p.X); xmax = Math.max(xmax, p.X); }
  const { lu, piv } = factorizarLU(A);
  return { paneles, n, lu, piv, Jt, cuerda: xmax - xmin };
}

export interface ResultadoPaneles {
  /** intensidad de fuente por panel, adimensionalizada: lambda_j/(2·pi·V_inf) */
  lambda: number[];
  /** velocidad tangencial en cada punto de control, normalizada por V_inf */
  vt: number[];
  /** coeficiente de presión por panel */
  cp: number[];
  /**
   * Σ lambda_j·S_j — el verificador de masa de Anderson (3.157). En un cuerpo
   * cerrado DEBE ser 0: si no, el cuerpo estaría creando o absorbiendo masa.
   * Se reporta NORMALIZADO por Σ S_j para que sea comparable entre geometrías.
   */
  residuoMasa: number;
  alpha: number;
}

/**
 * Resuelve para un ángulo de ataque. **Esta es la operación BARATA**: una
 * sustitución hacia adelante y otra hacia atrás sobre la LU ya calculada.
 * Barrer una polar completa cuesta n_alphas · O(n²).
 */
export function resolverAlpha(s: SesionPaneles, alpha = 0): ResultadoPaneles {
  const { paneles, n, lu, piv, Jt } = s;
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  // término independiente: −V_inf·cos(beta_i)·2pi, con V_inf unitario
  const b = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const cosBeta = paneles[i].nx * ca + paneles[i].ny * sa;   // n̂·V̂_inf
    b[i] = -2 * Math.PI * cosBeta;
  }
  const lam = resolverLU(lu, piv, b);           // lambda_j / V_inf

  const vt = new Array<number>(n);
  const cp = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    // componente tangencial de la corriente libre: V_inf·sin(beta_i) proyectado a alpha
    const tx = Math.cos(paneles[i].theta), ty = Math.sin(paneles[i].theta);
    let v = ca * tx + sa * ty;
    for (let j = 0; j < n; j++) v += (lam[j] / (2 * Math.PI)) * Jt[i][j];
    vt[i] = v;
    cp[i] = 1 - v * v;                          // (3.38)
  }
  let sumLS = 0, sumS = 0;
  for (let j = 0; j < n; j++) { sumLS += lam[j] * paneles[j].S; sumS += paneles[j].S; }
  return {
    lambda: lam.map((l) => l / (2 * Math.PI)),
    vt, cp,
    residuoMasa: sumS > 0 ? sumLS / (2 * Math.PI * sumS) : 0,
    alpha,
  };
}

/** Cp exacto del cilindro sin circulación: 1 − 4·sin²θ (Anderson ec. 3.101). */
export function cpCilindroExacto(theta: number): number {
  return 1 - 4 * Math.sin(theta) ** 2;
}

/** Contorno de un círculo de radio r con n paneles iguales, en sentido horario. */
export function circulo(r = 1, n = 8, fase = Math.PI / n): Array<[number, number]> {
  return Array.from({ length: n }, (_, k) => {
    const a = fase - (2 * Math.PI * k) / n;
    return [r * Math.cos(a), r * Math.sin(a)] as [number, number];
  });
}

// ── Álgebra: LU con pivoteo parcial ──────────────────────────────────
function factorizarLU(A: number[][]): { lu: number[][]; piv: number[] } {
  const n = A.length;
  const lu = A.map((r) => [...r]);
  const piv = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(lu[i][k]) > Math.abs(lu[p][k])) p = i;
    if (p !== k) { [lu[k], lu[p]] = [lu[p], lu[k]]; [piv[k], piv[p]] = [piv[p], piv[k]]; }
    const d = lu[k][k];
    if (Math.abs(d) < 1e-300) continue;
    for (let i = k + 1; i < n; i++) {
      lu[i][k] /= d;
      const f = lu[i][k];
      if (f === 0) continue;
      for (let j = k + 1; j < n; j++) lu[i][j] -= f * lu[k][j];
    }
  }
  return { lu, piv };
}

function resolverLU(lu: number[][], piv: number[], b: number[]): number[] {
  const n = lu.length;
  const y = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = b[piv[i]];
    for (let j = 0; j < i; j++) s -= lu[i][j] * y[j];
    y[i] = s;
  }
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < n; j++) s -= lu[i][j] * x[j];
    x[i] = Math.abs(lu[i][i]) > 1e-300 ? s / lu[i][i] : 0;
  }
  return x;
}
