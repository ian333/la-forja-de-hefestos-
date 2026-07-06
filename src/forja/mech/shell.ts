/**
 * EL MODELO DE LA CEBOLLA (print-in-place) — una sola función.
 *
 * Toda pared k de un mecanismo print-in-place es una superficie de revolución
 * DEFORMADA por dos cosas: una forma en altura (z) y unos lóbulos en ángulo (θ):
 *
 *     r_k(θ, z) = R_k  +  Σ_b  amp_b · env_b(z)        ← panzas en z  (modo 0 en θ)
 *                       +  Σ_m  a_m · cos(m·θ − φ_m)   ← lóbulos en ángulo
 *
 * De esta ÚNICA función salen TODOS los casos del modelo:
 *   · tubo liso          → sin panzas, sin modos
 *   · balero             → panza esférica en z (captura axial + autocentra)
 *   · llanta "Michelin"  → panza local (toroide) en z = zi
 *   · disco cicloidal    → modo N en θ
 *   · anillo de salida   → modo N+1 en θ
 *
 * La reducción N:1 EMERGE de engranar el modo N (disco) contra el modo N+1 (anillo).
 * Los "pernos" NO son cilindros sueltos: son el modo N+1 de la pared del anillo.
 * El disco NO es un extrude plano: es un TUBO con modo N en su pared.
 *
 * Puro (sin three.js) → testeable en node. El render arma la malla desde shellGrid().
 */

// envolvente en altura: devuelve 0..1 según z (0 = sin panza, 1 = panza máxima)
export type ZEnv = (z: number, H: number) => number;

// un lóbulo angular: a_m · cos(m·θ − φ)
export interface AngularMode {
  m: number;       // número de lóbulos (modo). 0 = liso, N = disco, N+1 = anillo
  amp: number;     // amplitud del lóbulo (mm)
  phase?: number;  // fase φ (rad), para alinear engranes
}

// una panza en z: amp · env(z)
export interface ZBump {
  amp: number;     // altura de la panza (mm)
  env: ZEnv;       // forma (esfera / llanta / …)
}

export interface ShellSpec {
  R: number;          // radio base de la pared
  H: number;          // altura del tubo
  zBumps?: ZBump[];   // panzas en z (esfera + llantas), todas modo 0 en θ
  modes?: AngularMode[]; // lóbulos en ángulo
  cx?: number;        // desplazamiento del centro en x (excéntrica)
  cy?: number;        // desplazamiento del centro en y
}

// ── envolventes-z reutilizables ───────────────────────────────────────────────
/** pared recta: sin panza. */
export const Z_FLAT: ZEnv = () => 0;

/** panza esférica: arco de círculo, máximo en z = H/2. Captura axial + autocentra. */
export const Z_SPHERE: ZEnv = (z, H) =>
  Math.sqrt(Math.max(0, 1 - ((z - H / 2) / (H / 2)) ** 2));

/** llantas "Michelin": panzas locales (toroides) en cada centro zi, ancho w.
 *  1 llanta = pivota · 2+ llantas = fijan el eje. SON la guía de autocentrado. */
export const tireEnv = (centers: number[], w: number): ZEnv => (z) => {
  let d = 0;
  for (const zi of centers) d = Math.max(d, Math.sqrt(Math.max(0, 1 - ((z - zi) / w) ** 2)));
  return d;
};

// ── el corazón del modelo: radio de la pared en (θ, z) ─────────────────────────
export function radiusAt(s: ShellSpec, theta: number, z: number): number {
  let r = s.R;
  for (const b of s.zBumps ?? []) r += b.amp * b.env(z, s.H);
  for (const md of s.modes ?? []) r += md.amp * Math.cos(md.m * theta - (md.phase ?? 0));
  return r;
}

/** muestrea el anillo a una altura z → radios por θ (para contar lóbulos / mallar). */
export function sampleRing(s: ShellSpec, z: number, nTheta = 360): number[] {
  const out: number[] = [];
  for (let i = 0; i < nTheta; i++) out.push(radiusAt(s, (2 * Math.PI * i) / nTheta, z));
  return out;
}

/** cuenta lóbulos = máximos locales del radio alrededor del círculo (modo m → m lóbulos). */
export function countLobes(radii: number[]): number {
  const n = radii.length;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const a = radii[(i - 1 + n) % n], b = radii[i], c = radii[(i + 1) % n];
    if (b > a && b >= c) count++;
  }
  return count;
}

// ── cinemática del cicloidal (la reducción que EMERGE) ─────────────────────────
/** razón de reducción: disco de Nd lóbulos engranando anillo de Nr huecos.
 *  cicloidal: Nr = Nd + 1 → razón = Nd.  General: razón = Nd / (Nr − Nd). */
export function reduction(discLobes: number, ringLobes: number): number {
  const diff = ringLobes - discLobes;
  return diff === 0 ? Infinity : discLobes / diff;
}

/** tras `inputTurns` vueltas de la excéntrica (entrada), el disco gira ΔΘ vueltas.
 *  ΔΘ = −inputTurns / N. El signo negativo = giro retrógrado (la firma del cicloidal). */
export function discTurns(N: number, inputTurns: number): number {
  return -inputTurns / N;
}

// ── la regla del gap con excentricidad (R3) ────────────────────────────────────
/** holgura mínima en órbita: el disco, empujado E hacia la pared, deja gap − E. */
export function orbitClearance(gapBase: number, E: number): number {
  return gapBase - E;
}

/** R3: gap_base ≥ E + g_weld → el disco gira excéntrico SIN soldarse jamás. */
export function gapRuleOk(gapBase: number, E: number, gWeld = 0.18): boolean {
  return gapBase >= E + gWeld;
}

// ── perfiles EXACTOS como pared de un tubo (engrane conjugado, no cosenos) ─────
/** curva {x,y} → función radial r(θ) interpolada. Permite usar un perfil EXACTO
 *  (la equidistante cicloidal) como pared de un tubo: lóbulos conjugados que
 *  engranan limpio, no cosenos que se interpenetran. La curva debe ser radial
 *  (un radio por θ), que es el caso del disco cicloidal. */
export function profileToRadial(pts: { x: number; y: number }[]): (theta: number) => number {
  const tab = pts
    .map((p) => ({ a: Math.atan2(p.y, p.x), r: Math.hypot(p.x, p.y) }))
    .sort((u, v) => u.a - v.a);
  const n = tab.length;
  const wrap = (t: number) => Math.atan2(Math.sin(t), Math.cos(t)); // → (−π, π]
  return (theta: number) => {
    const t = wrap(theta);
    if (t <= tab[0].a || t > tab[n - 1].a) {
      const lo = tab[n - 1], hi = tab[0];                 // tramo que cruza ±π
      const span = hi.a + 2 * Math.PI - lo.a;
      const f = ((t < tab[0].a ? t + 2 * Math.PI : t) - lo.a) / span;
      return lo.r + (hi.r - lo.r) * f;
    }
    for (let i = 1; i < n; i++)
      if (t <= tab[i].a) {
        const f = (t - tab[i - 1].a) / (tab[i].a - tab[i - 1].a);
        return tab[i - 1].r + (tab[i].r - tab[i - 1].r) * f;
      }
    return tab[n - 1].r;
  };
}

/** anillo de pernos (radio Rr, en círculo R) como PARED INTERIOR ondulada del aro:
 *  cada perno = un bulto cóncavo hacia el centro (modo N+1). El disco conjugado
 *  rueda entre ellos clareando por el gap. baseR = radio del aro entre pernos.
 *  r_inner(θ) = min(baseR, entrada del rayo a cada perno que cruza). */
export function pinEnvelope(pins: { x: number; y: number }[], Rr: number, baseR: number): (theta: number) => number {
  return (theta: number) => {
    const ux = Math.cos(theta), uy = Math.sin(theta);
    let r = baseR;
    for (const c of pins) {
      const ucp = ux * c.x + uy * c.y;                         // proyección u·cp
      const disc = ucp * ucp - (c.x * c.x + c.y * c.y - Rr * Rr);
      if (disc <= 0) continue;                                 // el rayo no toca el perno
      const near = ucp - Math.sqrt(disc);                      // cara interior del perno
      if (near > 0) r = Math.min(r, near);
    }
    return r;
  };
}

// ── superficie paramétrica de la pared (para construir la malla en el render) ──
export interface ShellGrid {
  nTheta: number;
  nz: number;
  H: number;
  cx: number;
  cy: number;
  outer: number[][]; // [j][i] radio exterior
  inner: number[][]; // [j][i] radio interior (pared de grosor constante)
}

/** rejilla (θ × z) de la pared: superficie exterior (R) e interior (R − wall) con los
 *  MISMOS modos → grosor de pared constante (imprimible) y gap al vecino respetado. */
export function shellGrid(s: ShellSpec, wall: number, nTheta = 140, nz = 64): ShellGrid {
  const outer: number[][] = [], inner: number[][] = [];
  for (let j = 0; j <= nz; j++) {
    const z = (s.H * j) / nz;
    const ro: number[] = [], ri: number[] = [];
    for (let i = 0; i < nTheta; i++) {
      const r = radiusAt(s, (2 * Math.PI * i) / nTheta, z);
      ro.push(r);
      ri.push(Math.max(0.2, r - wall));
    }
    outer.push(ro); inner.push(ri);
  }
  return { nTheta, nz, H: s.H, cx: s.cx ?? 0, cy: s.cy ?? 0, outer, inner };
}
