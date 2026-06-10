/**
 * spice.ts — motor de simulación de circuitos por Análisis Nodal Modificado (MNA).
 *
 * Física REAL, no curvas pintadas (regla dura del proyecto):
 *   - Leyes de Kirchhoff (KCL/KVL) resueltas como sistema lineal A·x = z.
 *   - Resistor: Ley de Ohm, conductancia g = 1/R.
 *   - Capacitor / Inductor: modelo compañero TRAPEZOIDAL (2º orden, el default de SPICE).
 *   - Diodo: ecuación de Shockley i = Is(e^(v/nVt) − 1), resuelto por Newton-Raphson.
 *   - Fuentes V/I dependientes del tiempo (DC, seno, pulso, escalón).
 *
 * Todo es PURO y testeable en node (sin DOM, sin three). Los valores que salen
 * se contrastan contra la fórmula cerrada en __tests__/spice.test.ts
 * (divisor de voltaje, τ=RC, f₀ del RLC, etc.).
 *
 * Convención de nodos: 0 = tierra (GND). Los demás nodos son 1..N.
 * Convención de corriente de un elemento: positiva si fluye de `a` a `b`
 * por DENTRO del elemento (a = terminal +).
 */

// ── Formas de onda de fuente ────────────────────────────────────────────

export type Wave =
  | { type: 'dc'; v: number }
  | { type: 'sine'; amp: number; freq: number; offset?: number; phase?: number }
  | { type: 'pulse'; lo: number; hi: number; period: number; duty?: number; rise?: number }
  | { type: 'step'; lo: number; hi: number; at: number };

/** Valor instantáneo de una forma de onda en el tiempo t [s]. */
export function waveAt(w: Wave, t: number): number {
  switch (w.type) {
    case 'dc':
      return w.v;
    case 'sine':
      return (w.offset ?? 0) + w.amp * Math.sin(2 * Math.PI * w.freq * t + (w.phase ?? 0));
    case 'pulse': {
      const duty = w.duty ?? 0.5;
      const tau = ((t % w.period) + w.period) % w.period;
      return tau < duty * w.period ? w.hi : w.lo;
    }
    case 'step':
      return t < w.at ? w.lo : w.hi;
  }
}

// ── Elementos ───────────────────────────────────────────────────────────

/**
 * Parámetros de MOSFET extraídos del DATASHEET (modelo Shichman-Hodges nivel 1):
 *   Id(triodo) = Kp·(2(Vgs−Vth)Vds − Vds²)·(1+λVds)
 *   Id(saturación) = Kp·(Vgs−Vth)²·(1+λVds)
 * Kp se extrae del Rds(on) publicado: Rds(on) ≈ 1/(2·Kp·(Vgs_spec−Vth)).
 * Incluye diodo de cuerpo (s→d) y conducción inversa del canal (swap d↔s).
 */
export interface MosfetParams {
  Vth: number;      // umbral [V]
  Kp: number;       // transconductancia [A/V²]
  lambda?: number;  // modulación de canal [1/V]
  dsIs?: number;    // Is del diodo de cuerpo
  name?: string;    // parte + cita del datasheet
}

/** Catálogo con parámetros REALES de datasheet (las partes del taller/pedido AG). */
export const MOSFETS: Record<string, MosfetParams> = {
  // Vishay IRF640N: Vgs(th) 2–4V, Rds(on) 0.15Ω @ Vgs=10V → Kp=1/(2·0.15·6.2)
  IRF640N: { Vth: 3.8, Kp: 0.54, lambda: 0.01, name: 'IRF640N 200V/18A · Rds 0.15Ω@10V' },
  // IR IRL540N (logic level, los del v1): Vgs(th) 1–2V, Rds 0.077Ω @ Vgs=5V
  IRL540N: { Vth: 1.8, Kp: 2.0, lambda: 0.012, name: 'IRL540N 100V/36A · Rds 0.077Ω@5V' },
  // IR IRF3205: Vgs(th) 2–4V, Rds 8mΩ @ Vgs=10V
  IRF3205: { Vth: 3.0, Kp: 8.9, lambda: 0.008, name: 'IRF3205 55V/110A · Rds 8mΩ@10V' },
  // 2N7000 (señal): Vgs(th) ~2.1V, Rds ~1.9Ω @ Vgs=4.5V
  '2N7000': { Vth: 2.1, Kp: 0.11, lambda: 0.02, name: '2N7000 60V/200mA · Rds 1.9Ω@4.5V' },
};

export type Element =
  | { kind: 'R'; id: string; a: number; b: number; value: number }                    // ohms
  | { kind: 'C'; id: string; a: number; b: number; value: number; ic?: number }       // farads, ic = V inicial
  | { kind: 'L'; id: string; a: number; b: number; value: number; ic?: number }       // henries, ic = I inicial
  | { kind: 'V'; id: string; a: number; b: number; value: number; wave?: Wave }       // volts (a = +)
  | { kind: 'I'; id: string; a: number; b: number; value: number; wave?: Wave }       // amps inyectados en `a`
  | { kind: 'D'; id: string; a: number; b: number; Is?: number; n?: number }          // diodo: a=ánodo, b=cátodo
  | { kind: 'M'; id: string; d: number; g: number; s: number; params: MosfetParams }; // NMOS (datasheet)

export interface Circuit {
  /** Mayor índice de nodo distinto de tierra. Nodos válidos: 0..nodeCount. */
  nodeCount: number;
  elements: Element[];
}

/** Número de nodos sin contar tierra, derivado de los elementos. */
export function maxNode(elements: Element[]): number {
  let m = 0;
  for (const e of elements) {
    if (e.kind === 'M') m = Math.max(m, e.d, e.g, e.s);
    else m = Math.max(m, e.a, e.b);
  }
  return m;
}

/**
 * Corriente de canal NMOS + derivadas (Shichman-Hodges). Devuelve
 * {id, gm, gds} para los voltajes dados (vgs, vds ≥ 0 — el swap lo hace el caller).
 */
export function mosChannel(p: MosfetParams, vgs: number, vds: number): { id: number; gm: number; gds: number } {
  const lam = p.lambda ?? 0;
  const vov = vgs - p.Vth;                     // overdrive
  if (vov <= 0) return { id: 0, gm: 0, gds: 0 };       // corte
  if (vds < vov) {
    // triodo
    const id = p.Kp * (2 * vov * vds - vds * vds) * (1 + lam * vds);
    const gm = p.Kp * 2 * vds * (1 + lam * vds);
    const gds = p.Kp * (2 * vov - 2 * vds) * (1 + lam * vds) + p.Kp * (2 * vov * vds - vds * vds) * lam;
    return { id, gm, gds };
  }
  // saturación
  const id = p.Kp * vov * vov * (1 + lam * vds);
  const gm = 2 * p.Kp * vov * (1 + lam * vds);
  const gds = p.Kp * vov * vov * lam;
  return { id, gm, gds };
}

// ── Solver lineal denso (eliminación gaussiana con pivoteo parcial) ──────

/** Resuelve A·x = b in-place. Devuelve x, o null si es singular. */
export function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Matriz aumentada (copia para no mutar la entrada del llamador)
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    // Pivoteo parcial: fila con mayor |valor| en esta columna
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-14) return null; // singular
    if (piv !== col) { const tmp = M[piv]; M[piv] = M[col]; M[col] = tmp; }
    // Eliminar debajo
    const pivVal = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / pivVal;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  // Sustitución hacia atrás
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

// ── Estado de simulación ────────────────────────────────────────────────

/** Histórico por elemento reactivo / no-lineal: voltaje y corriente previos. */
export interface ElemState { v: number; i: number }

export interface SimState {
  t: number;
  /** Voltaje en cada nodo (índice = nodo; v[0]=0=tierra). */
  v: number[];
  /** Corriente por rama de fuente de voltaje (id → corriente). */
  vsrcI: Map<string, number>;
  /** Estado previo de C, L y D (id → {v across, i through}). */
  hist: Map<string, ElemState>;
}

const VT = 0.025852; // kT/q a ~300 K [V]
const DIODE_IS = 1e-14;
const DIODE_N = 1;

// ── Construcción y resolución de MNA en un instante ─────────────────────

interface Stamped {
  /** Voltaje (V) de las fuentes V, evaluadas en t. */
  vsrcIndex: Map<string, number>;
  vsrcList: Element[];
}

function indexVSources(c: Circuit): Stamped {
  const vsrcList = c.elements.filter((e) => e.kind === 'V');
  const vsrcIndex = new Map<string, number>();
  vsrcList.forEach((e, k) => vsrcIndex.set(e.id, k));
  return { vsrcIndex, vsrcList };
}

/**
 * Arma A·x = z para un instante. `mode` controla cómo se tratan los reactivos:
 *   - 'dc'        → C abierto (se omite), L en corto (fuente V de 0).
 *   - 'transient' → C y L con su modelo compañero trapezoidal usando `prev`.
 * `guess` son los voltajes de nodo del iterado de Newton anterior (para diodos).
 */
function assemble(
  c: Circuit,
  t: number,
  dt: number,
  mode: 'dc' | 'transient',
  prev: SimState | null,
  guess: number[],
): { A: number[][]; z: number[]; vsrcIndex: Map<string, number>; vsrcOrder: string[] } {
  const n = c.nodeCount;
  const { vsrcIndex, vsrcList } = indexVSources(c);
  // En DC los inductores se vuelven fuentes V=0 (corto) → ramas extra.
  const extraVBranches = mode === 'dc'
    ? c.elements.filter((e): e is Extract<Element, { kind: 'L' }> => e.kind === 'L')
    : [];
  const mV = vsrcList.length + extraVBranches.length;
  const dim = n + mV;
  const A: number[][] = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const z = new Array(dim).fill(0);

  // helper: índice de fila/col de un nodo en la matriz (tierra = -1, se ignora)
  const ni = (node: number) => node - 1; // nodo 1 → fila 0

  const stampG = (a: number, b: number, g: number) => {
    if (a > 0) A[ni(a)][ni(a)] += g;
    if (b > 0) A[ni(b)][ni(b)] += g;
    if (a > 0 && b > 0) { A[ni(a)][ni(b)] -= g; A[ni(b)][ni(a)] -= g; }
  };
  const stampI = (a: number, b: number, cur: number) => {
    // `cur` se inyecta en `a` y se extrae de `b`
    if (a > 0) z[ni(a)] += cur;
    if (b > 0) z[ni(b)] -= cur;
  };
  // VCCS: corriente gm·(v_cp − v_cn) que fluye del nodo op al nodo on
  const stampVCCS = (op: number, on: number, cp: number, cn: number, gm: number) => {
    if (op > 0 && cp > 0) A[ni(op)][ni(cp)] += gm;
    if (op > 0 && cn > 0) A[ni(op)][ni(cn)] -= gm;
    if (on > 0 && cp > 0) A[ni(on)][ni(cp)] -= gm;
    if (on > 0 && cn > 0) A[ni(on)][ni(cn)] += gm;
  };
  // diodo Shockley linealizado (reusado por D y por el diodo de cuerpo del M)
  const stampDiode = (a: number, b: number, Is: number, nD: number) => {
    const vt = nD * VT;
    let vd = (guess[a] ?? 0) - (guess[b] ?? 0);
    // clamp relativo a n·VT (no 0.8 fijo): un LED azul cae ~2.7 V de verdad
    const vmax = 40 * vt;
    if (vd > vmax) vd = vmax;
    const ex = Math.exp(vd / vt);
    const Geq = (Is / vt) * ex;
    const Id = Is * (ex - 1);
    const Ieq = Id - Geq * vd;
    stampG(a, b, Geq);
    stampI(a, b, -Ieq);
  };

  // Ramas de fuente de voltaje (V reales + L en DC)
  const vsrcOrder: string[] = [];
  const stampVBranch = (a: number, b: number, value: number, id: string, k: number) => {
    const row = n + k;
    vsrcOrder[k] = id;
    if (a > 0) { A[ni(a)][row] += 1; A[row][ni(a)] += 1; }
    if (b > 0) { A[ni(b)][row] -= 1; A[row][ni(b)] -= 1; }
    z[row] = value;
  };

  for (const e of c.elements) {
    switch (e.kind) {
      case 'R':
        stampG(e.a, e.b, 1 / e.value);
        break;
      case 'I': {
        const val = e.wave ? waveAt(e.wave, t) : e.value;
        stampI(e.a, e.b, val);
        break;
      }
      case 'V': {
        const val = e.wave ? waveAt(e.wave, t) : e.value;
        stampVBranch(e.a, e.b, val, e.id, vsrcIndex.get(e.id)!);
        break;
      }
      case 'C': {
        if (mode === 'dc') break; // capacitor abierto en DC
        const vPrev = prev?.hist.get(e.id)?.v ?? e.ic ?? 0;
        const iPrev = prev?.hist.get(e.id)?.i ?? 0;
        const Geq = (2 * e.value) / dt;
        const Ieq = Geq * vPrev + iPrev; // Norton: inyecta Ieq en `a`
        stampG(e.a, e.b, Geq);
        stampI(e.a, e.b, Ieq);
        break;
      }
      case 'L': {
        if (mode === 'dc') break; // tratado como fuente V=0 más abajo
        const vPrev = prev?.hist.get(e.id)?.v ?? 0;
        const iPrev = prev?.hist.get(e.id)?.i ?? e.ic ?? 0;
        const Geq = dt / (2 * e.value);
        const Ieq = iPrev + Geq * vPrev; // sale de `a` (corriente del inductor)
        stampG(e.a, e.b, Geq);
        stampI(e.a, e.b, -Ieq);
        break;
      }
      case 'D': {
        stampDiode(e.a, e.b, e.Is ?? DIODE_IS, e.n ?? DIODE_N);
        break;
      }
      case 'M': {
        // NMOS Shichman-Hodges. Conducción inversa = swap d↔s (canal simétrico).
        const vD = guess[e.d] ?? 0, vG = guess[e.g] ?? 0, vS = guess[e.s] ?? 0;
        const rev = vD < vS;
        const dEff = rev ? e.s : e.d, sEff = rev ? e.d : e.s;
        const vgs = vG - (rev ? vD : vS);
        const vds = Math.abs(vD - vS);
        const { id, gm, gds } = mosChannel(e.params, vgs, vds);
        // linealización: Id ≈ Ieq + gm·vgs + gds·vds  (Newton, igual que el diodo)
        const Ieq = id - gm * vgs - gds * vds;
        stampG(dEff, sEff, gds + 1e-9);            // gds + Gmin (convergencia en corte)
        stampVCCS(dEff, sEff, e.g, sEff, gm);
        stampI(dEff, sEff, -Ieq);
        // diodo de cuerpo: ánodo=source, cátodo=drain (el flyback gratis del NMOS)
        stampDiode(e.s, e.d, e.params.dsIs ?? 1e-12, 1);
        break;
      }
    }
  }

  // Inductores como corto (fuente V=0) en DC
  extraVBranches.forEach((e, j) => {
    stampVBranch(e.a, e.b, 0, e.id, vsrcList.length + j);
  });

  return { A, z, vsrcIndex, vsrcOrder };
}

/** Extrae voltajes de nodo (incluye tierra en índice 0) de la solución x. */
function nodeVoltages(x: number[], n: number): number[] {
  const v = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) v[i] = x[i - 1];
  return v;
}

const hasDiode = (c: Circuit) => c.elements.some((e) => e.kind === 'D' || e.kind === 'M');

/** Resuelve un instante (con Newton si hay diodos). Devuelve voltajes de nodo + corrientes de rama. */
function solveInstant(
  c: Circuit,
  t: number,
  dt: number,
  mode: 'dc' | 'transient',
  prev: SimState | null,
): { v: number[]; vsrcI: Map<string, number> } | null {
  const n = c.nodeCount;
  let guess = prev ? [...prev.v] : new Array(n + 1).fill(0);
  const iters = hasDiode(c) ? 60 : 1;
  let lastX: number[] | null = null;
  let order: string[] = [];
  let vIdx = new Map<string, number>();
  for (let it = 0; it < iters; it++) {
    const { A, z, vsrcIndex, vsrcOrder } = assemble(c, t, dt, mode, prev, guess);
    const x = solveLinear(A, z);
    if (!x) return null;
    lastX = x;
    order = vsrcOrder;
    vIdx = vsrcIndex;
    const v = nodeVoltages(x, n);
    // criterio de convergencia de Newton (sobre voltajes de nodo)
    let maxd = 0;
    for (let i = 1; i <= n; i++) maxd = Math.max(maxd, Math.abs(v[i] - guess[i]));
    guess = v;
    if (maxd < 1e-9) break;
  }
  if (!lastX) return null;
  const v = nodeVoltages(lastX, n);
  const vsrcI = new Map<string, number>();
  const { vsrcList } = indexVSources(c);
  // corriente de rama de las fuentes V reales (las L-en-DC se descartan aquí)
  vsrcList.forEach((e) => {
    const k = vIdx.get(e.id)!;
    vsrcI.set(e.id, lastX![n + k]);
  });
  // si fue DC, también guardamos la corriente de los inductores (rama V=0)
  if (mode === 'dc') {
    c.elements.filter((e) => e.kind === 'L').forEach((e, j) => {
      vsrcI.set(e.id, lastX![n + vsrcList.length + j]);
    });
  }
  void order;
  return { v, vsrcI };
}

/** Corriente que circula por un elemento dado el estado de nodos resuelto. */
function elementCurrent(e: Element, v: number[], dt: number, prev: SimState | null): number {
  if (e.kind === 'M') {
    // positiva = drain→source (canal) − diodo de cuerpo (que conduce s→d)
    const vD = v[e.d] ?? 0, vG = v[e.g] ?? 0, vS = v[e.s] ?? 0;
    const rev = vD < vS;
    const vgs = vG - (rev ? vD : vS);
    const vds = Math.abs(vD - vS);
    const { id } = mosChannel(e.params, vgs, vds);
    const chan = rev ? -id : id;
    const vbd = Math.min(vS - vD, 0.8);
    const ibd = (e.params.dsIs ?? 1e-12) * (Math.exp(vbd / VT) - 1);
    return chan - ibd;
  }
  const va = v[e.a] ?? 0;
  const vb = v[e.b] ?? 0;
  const vdiff = va - vb;
  switch (e.kind) {
    case 'R':
      return vdiff / e.value;
    case 'C': {
      const vPrev = prev?.hist.get(e.id)?.v ?? e.ic ?? 0;
      const iPrev = prev?.hist.get(e.id)?.i ?? 0;
      const Geq = (2 * e.value) / dt;
      return Geq * (vdiff - vPrev) - iPrev; // i = 2C/dt·Δv − i_prev
    }
    case 'L': {
      const vPrev = prev?.hist.get(e.id)?.v ?? 0;
      const iPrev = prev?.hist.get(e.id)?.i ?? e.ic ?? 0;
      const Geq = dt / (2 * e.value);
      return iPrev + Geq * (vdiff + vPrev);
    }
    case 'D': {
      const Is = e.Is ?? DIODE_IS;
      const vt = (e.n ?? DIODE_N) * VT;
      const vc = Math.min(vdiff, 40 * vt); // mismo clamp relativo que stampDiode
      return Is * (Math.exp(vc / vt) - 1);
    }
    default:
      return 0;
  }
}

// ── API pública ─────────────────────────────────────────────────────────

/** Punto de operación DC: C abierto, L en corto, diodos por Newton. */
export function dcOperatingPoint(c: Circuit): SimState | null {
  const cc = { ...c, nodeCount: c.nodeCount || maxNode(c.elements) };
  const sol = solveInstant(cc, 0, 1, 'dc', null);
  if (!sol) return null;
  const hist = new Map<string, ElemState>();
  for (const e of cc.elements) {
    if (e.kind === 'C') hist.set(e.id, { v: (e.a ? sol.v[e.a] : 0) - (e.b ? sol.v[e.b] : 0), i: 0 });
    if (e.kind === 'L') hist.set(e.id, { v: 0, i: sol.vsrcI.get(e.id) ?? 0 });
  }
  return { t: 0, v: sol.v, vsrcI: sol.vsrcI, hist };
}

export interface TransientResult {
  t: number[];                       // tiempos [s]
  v: number[][];                     // v[k] = voltajes de nodo en el paso k
  current: Record<string, number[]>; // corriente por id de elemento
  steps: SimState[];                 // estados completos por paso
}

export interface TransientOptions {
  dt: number;
  tStop: number;
  /** Estado inicial. Si se omite, arranca en cero (caps descargados, L sin corriente). */
  init?: SimState;
  /** Ids de elementos cuya corriente se registra (default: todos R/L/C/D/V). */
  probeCurrents?: string[];
}

/** Avanza UN paso de transitorio desde `prev`. Útil para animación en vivo. */
export function transientStep(c: Circuit, prev: SimState, dt: number): SimState | null {
  const cc = { ...c, nodeCount: c.nodeCount || maxNode(c.elements) };
  const t = prev.t + dt;
  const sol = solveInstant(cc, t, dt, 'transient', prev);
  if (!sol) return null;
  const hist = new Map<string, ElemState>();
  for (const e of cc.elements) {
    if (e.kind === 'C' || e.kind === 'L' || e.kind === 'D') {
      const va = sol.v[e.a] ?? 0;
      const vb = sol.v[e.b] ?? 0;
      hist.set(e.id, { v: va - vb, i: elementCurrent(e, sol.v, dt, prev) });
    } else if (e.kind === 'M') {
      hist.set(e.id, { v: (sol.v[e.d] ?? 0) - (sol.v[e.s] ?? 0), i: elementCurrent(e, sol.v, dt, prev) });
    }
  }
  return { t, v: sol.v, vsrcI: sol.vsrcI, hist };
}

/** Simulación transitoria completa (barrido de tiempo). */
export function transient(c: Circuit, opts: TransientOptions): TransientResult {
  const cc = { ...c, nodeCount: c.nodeCount || maxNode(c.elements) };
  const { dt, tStop } = opts;
  let state: SimState =
    opts.init ?? { t: 0, v: new Array(cc.nodeCount + 1).fill(0), vsrcI: new Map(), hist: new Map() };
  const probeIds =
    opts.probeCurrents ?? cc.elements.map((e) => e.id);
  const res: TransientResult = { t: [state.t], v: [state.v], current: {}, steps: [state] };
  for (const id of probeIds) res.current[id] = [0];

  const nSteps = Math.ceil(tStop / dt);
  for (let k = 0; k < nSteps; k++) {
    const next = transientStep(cc, state, dt);
    if (!next) break;
    state = next;
    res.t.push(state.t);
    res.v.push(state.v);
    res.steps.push(state);
    for (const id of probeIds) {
      const e = cc.elements.find((el) => el.id === id);
      res.current[id].push(e ? elementCurrent(e, state.v, dt, res.steps[res.steps.length - 2]) : 0);
    }
  }
  return res;
}
