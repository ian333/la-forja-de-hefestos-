/**
 * LÁMINA L9 — SECCIÓN DEL INSERTO DE NÚCLEO CON SU DISPOSITIVO DE ENFRIAMIENTO
 * ============================================================================
 * Cubre V9.17 (Tabla 9.3 de selección) · V9.18 (flujo radial vs axial) ·
 * V9.3 (glifos de flujo de calor) · V12.14 (carga del inserto de núcleo).
 *
 * QUÉ DIBUJA
 *   El CORTE del núcleo esbelto con el dispositivo que le toca (inserto de
 *   enfriamiento / baffle / bubbler / heat pipe / pin conductivo), el Ø del
 *   núcleo y el Ø del barreno ACOTADOS, y los VECTORES de flujo de calor
 *   dentro del núcleo, coloreados según domine el flujo RADIAL o el AXIAL.
 *
 * DE DÓNDE SALE CADA NÚMERO
 *   · Tabla 9.3 (§9.3.5) — LITERAL, fila por fila, con las cotas del texto:
 *       cooling insert  Ø núcleo > 50 mm   · Ø barreno > 25 mm  · "Very high"
 *       baffle          Ø núcleo 12–75 mm  · Ø barreno 6–25 mm  · "Very high"
 *       bubbler         Ø núcleo 6–30 mm   · Ø barreno 3–12 mm  · "High"
 *       heat pipe       Ø núcleo 5–20 mm   · Ø barreno 3–12 mm  · "Medium"
 *       conductive pin  Ø núcleo < 5 mm    · Ø barreno N/A      · "Low"
 *     Los rangos se REUSAN de `slendercore.ts` (SLENDER_COOLING) — este módulo
 *     no crea una segunda copia de la tabla; añade los literales del texto
 *     (§9.3.5.1–9.3.5.6) y el gate verifica que ambas fuentes coincidan.
 *   · El campo térmico NO se estiliza: se RESUELVE. Conducción axisimétrica en
 *     régimen permanente con k variable por celda (núcleo · plástico · acero de
 *     cavidad), volúmenes finitos con la conductancia LOGARÍTMICA exacta entre
 *     anillos, R = ln(r₂/r₁)/(2πkL) — la misma de `thermal-resistance.ts`.
 *     De ahí salen los glifos (V9.3), el reparto radial/axial (V9.18) y el
 *     ΔT base→punta que §9.2.7 reprueba a 6 °C.
 *   · La estructura del núcleo sale de `cores.ts` (§12.3.1–12.3.3) y se evalúa
 *     con el supuesto conservador LITERAL de V12.14 §12.2.7: *"a more robust
 *     design may be provided by assuming that the cooling insert provides no
 *     support"* — aunque en el corte el inserto PAREZCA sostener el núcleo.
 *
 * LO QUE NO SE MIDE NO SE PINTA VERDE. Cada bloque de la lámina que no recibió
 * datos se imprime "SIN CABLEAR" en ámbar; nunca cuenta como cumplido.
 *
 * PURO (devuelve SVG como string) → node-testeable y renderizable a PNG.
 * Gate: node --import tsx scripts/mold-nucleo-enfriamiento-test.cjs
 */
import type { Lamina } from './laminas-visuales';
import { SLENDER_COOLING, chooseSlenderCoreCooling, type SlenderCoolingMethod } from './slendercore';
import { rCyl } from './thermal-resistance';
import { designCore, type CoreDesign } from './cores';
import { coolingTimePlate, type CoolingMaterial } from './cooling';

const ESC = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// La hoja de estilo es la misma de `laminas-visuales.ts` (allí es un const de
// módulo, no exportado). Se replica en vez de tocar ese archivo compartido.
const CSS = `
  .bg{fill:#0b0f16}
  .tit{fill:#e9eef5;font:700 20px 'JetBrains Mono',monospace}
  .sub{fill:#8fa3bd;font:400 13px 'JetBrains Mono',monospace}
  .cita{fill:#c9a227;font:700 13px 'JetBrains Mono',monospace}
  .lbl{fill:#c3d0e0;font:400 12px 'JetBrains Mono',monospace}
  .lblSm{fill:#8fa3bd;font:400 10.5px 'JetBrains Mono',monospace}
  .ok{fill:#59d98c} .mal{fill:#ff5c5c} .warn{fill:#ffb347}
`;

// ═══════════════════════════════════════════════════════════════════════════
// 1 · TABLA 9.3 — LITERAL (§9.3.5) + las cotas sueltas de §9.3.5.1–9.3.5.6
// ═══════════════════════════════════════════════════════════════════════════

export interface FilaTabla93 {
  method: SlenderCoolingMethod;
  /** nombre LITERAL de la fila en el libro */
  etiqueta: string;
  /** columna "Core diameter" LITERAL */
  coreLiteral: string;
  /** columna "Hole diameter" LITERAL */
  holeLiteral: string;
  /** columna "Cooling rate" LITERAL */
  rateLiteral: string;
  /** orden de la columna de tasa: 4 = Very high … 1 = Low */
  tasa: number;
  seccion: string;
  /** citas LITERALES del texto que acompañan a la fila */
  cotas: string[];
}

/**
 * Las 5 filas de la Tabla 9.3 con su texto literal. Los RANGOS NUMÉRICOS no se
 * repiten aquí: se leen de SLENDER_COOLING (`slendercore.ts`), que ya es la
 * transcripción de la tabla. El gate verifica que los literales de esta lista y
 * los números de allá describan lo mismo (si alguien mueve uno, el gate cae).
 */
export const TABLA_9_3: FilaTabla93[] = [
  {
    method: 'inserto', etiqueta: 'Cooling insert', coreLiteral: '> 50 mm', holeLiteral: '> 25 mm',
    rateLiteral: 'Very high', tasa: 4, seccion: '§9.3.5.1',
    cotas: [
      '"readily produced on a four axis milling machine or on a lathe"',
      '"may favor cooling at too great an expense of core strength"',
      '"tight fit to the back surface of the core" ⇒ la carga del fundido va a la placa de soporte',
    ],
  },
  {
    method: 'baffle', etiqueta: 'Baffle', coreLiteral: '12–75 mm', holeLiteral: '6–25 mm',
    rateLiteral: 'Very high', tasa: 4, seccion: '§9.3.5.2',
    cotas: [
      '"normally inserted into a drilled hole" · mínimo: barreno de "diameter greater than 6.35 mm (1/4 inch)"',
      'ejemplo del libro: baffle de 12 mm en núcleo de 60 mm (Fig 9.21 "Spiral baffle")',
      '"a larger baffle could have been used to reduce the distance between the cooling channel and the cavity surface"',
      '"not designed to carry any load in the axial direction … limited load carrying capability in the radial direction"',
      '"the baffle is clearly preferred whenever the molding application allows" (sobre el inserto custom)',
    ],
  },
  {
    method: 'bubbler', etiqueta: 'Bubbler', coreLiteral: '6–30 mm', holeLiteral: '3–12 mm',
    rateLiteral: 'High', tasa: 3, seccion: '§9.3.5.3',
    cotas: [
      'ejemplo del libro: bubbler de "< 2 mm de diámetro en barrenos < 3 mm"',
      '"The bubbler does not contact the core and so carries no load from the core compression"',
      '"they require two cooling channels – one to provide flow around the bubbler and a second to return the flow from inside"',
    ],
  },
  {
    method: 'heat-pipe', etiqueta: 'Heat pipe', coreLiteral: '5–20 mm', holeLiteral: '3–12 mm',
    rateLiteral: 'Medium', tasa: 2, seccion: '§9.3.5.4',
    cotas: [
      'menos efectivo que baffle/bubbler: no hay "bulk conveyance of the mold coolant"',
      '"they require a significant temperature gradient to initiate an effective condensation-evaporation cycle"',
    ],
  },
  {
    method: 'pin-conductivo', etiqueta: 'Conductive pin', coreLiteral: '< 5 mm', holeLiteral: 'N/A',
    rateLiteral: 'Low', tasa: 1, seccion: '§9.3.5.5',
    cotas: [
      'con L/D alto: "the core pins prevent the flow of heat down the length of the core pins and act primarily as insulators"',
      '§9.3.5.6: alternativa — núcleo INTERLOCKED con la cavidad y canal de AIRE ("much more heat transfer than a solid core pin")',
    ],
  },
];

/** rangos numéricos de la Tabla 9.3, tomados de `slendercore.ts` (no se re-teclean) */
export const rangoDe = (m: SlenderCoolingMethod) => SLENDER_COOLING.find((o) => o.method === m)!;

/**
 * ¿la fila admite este Ø de núcleo? Los límites se leen LITERALES:
 * "> 50 mm" y "< 5 mm" son ESTRICTOS; los rangos "12–75" son cerrados.
 */
export function filaAdmiteCore(m: SlenderCoolingMethod, coreDiaMm: number): boolean {
  const r = rangoDe(m);
  if (m === 'inserto') return coreDiaMm > r.coreMinMm;          // "> 50 mm"
  if (m === 'pin-conductivo') return coreDiaMm < r.coreMaxMm;   // "< 5 mm"
  return coreDiaMm >= r.coreMinMm && coreDiaMm <= r.coreMaxMm;  // "12–75", "6–30", "5–20"
}

/** ¿la fila admite este Ø de barreno? (`pin-conductivo` = N/A: no hay barreno) */
export function filaAdmiteHole(m: SlenderCoolingMethod, holeDiaMm: number): boolean | 'N/A' {
  const r = rangoDe(m);
  if (m === 'pin-conductivo') return 'N/A';
  if (m === 'inserto') return holeDiaMm > r.holeMinMm;          // "> 25 mm"
  return holeDiaMm >= r.holeMinMm && holeDiaMm <= r.holeMaxMm;
}

/**
 * ORDEN DE PREFERENCIA cuando varias filas admiten el mismo Ø. Los rangos de la
 * Tabla 9.3 SE TRASLAPAN (Ø15 cae en baffle, bubbler y heat pipe a la vez) y la
 * tabla NO trae un desempate. Estas son las frases del texto que sí lo dan:
 *   baffle  > inserto    §9.3.5.2 "the baffle is clearly preferred whenever the
 *                        molding application allows" (disponibilidad/costo/riesgo)
 *   baffle  > bubbler    §9.3.5.3 el bubbler pide DOS canales → "greater expense
 *                        with regard to its installation"; y la tabla le da tasa
 *                        menor (High vs Very high)
 *   bubbler > heat pipe  §9.3.5.4 el heat pipe es "less effective than baffle/
 *                        bubbler" (sin transporte másico de refrigerante)
 *   cualquiera > pin     §9.3.5.5 el pin es "the only option may be" (último recurso)
 * No hay ninguna frase que ordene inserto vs bubbler; el orden entre esos dos lo
 * pone la COLUMNA DE TASA de la propia tabla (Very high > High).
 */
export const PREFERENCIA_LITERAL: SlenderCoolingMethod[] = ['baffle', 'inserto', 'bubbler', 'heat-pipe', 'pin-conductivo'];

export interface SeleccionTabla93 {
  coreDiaMm: number;
  holeDiaMm: number | null;
  /** filas de la Tabla 9.3 que admiten este Ø de núcleo */
  candidatos: FilaTabla93[];
  /** la que toca por el orden literal de preferencia */
  fila: FilaTabla93 | null;
  method: SlenderCoolingMethod | null;
  /** ¿el Ø del núcleo cae en alguna fila? (si no: fuera de la Tabla 9.3) */
  fueraDeTabla: boolean;
  /** ¿el método FORZADO por el llamador respeta su fila? */
  cumpleCore: boolean;
  cumpleHole: boolean | 'N/A' | 'SIN CABLEAR';
  /** cotas sueltas del §: baffle > 6.35 mm, inserto > 25 mm, etc. */
  cumpleCotaExtra: boolean | 'SIN CABLEAR';
  forzado: boolean;
  mensajes: string[];
  cita: string;
}

/**
 * SELECCIÓN POR TABLA 9.3 — literal. Devuelve TODOS los candidatos (eso es lo
 * que la tabla dice) y la fila que toca por el orden de preferencia del texto.
 * Si el llamador FUERZA un método, se juzga ese contra su fila y se dice si la
 * tabla habría elegido otro.
 */
export function seleccionTabla93(o: {
  coreDiaMm: number; holeDiaMm?: number | null; metodoForzado?: SlenderCoolingMethod;
}): SeleccionTabla93 {
  const msg: string[] = [];
  const candidatos = TABLA_9_3.filter((f) => filaAdmiteCore(f.method, o.coreDiaMm));
  const porTabla = PREFERENCIA_LITERAL.map((m) => candidatos.find((c) => c.method === m)).find(Boolean) ?? null;
  const forzado = !!o.metodoForzado;
  const fila = forzado ? TABLA_9_3.find((f) => f.method === o.metodoForzado)! : porTabla;
  const holeDiaMm = o.holeDiaMm ?? null;

  if (candidatos.length === 0) {
    msg.push(`Ø ${o.coreDiaMm} mm NO cae en ninguna fila de la Tabla 9.3 — fuera del alcance del §9.3.5`);
  } else if (candidatos.length > 1) {
    msg.push(`Tabla 9.3 admite ${candidatos.length} filas para Ø ${o.coreDiaMm} mm (${candidatos.map((c) => c.etiqueta).join(', ')}); desempata el texto: ${porTabla?.seccion}`);
  }
  if (forzado && porTabla && o.metodoForzado !== porTabla.method) {
    msg.push(`método FORZADO ${o.metodoForzado} ≠ el que da la Tabla 9.3 (${porTabla.method})`);
  }

  const cumpleCore = fila ? filaAdmiteCore(fila.method, o.coreDiaMm) : false;
  if (fila && !cumpleCore) msg.push(`Ø núcleo ${o.coreDiaMm} mm FUERA de la fila "${fila.etiqueta}" (${fila.coreLiteral}) — Tabla 9.3`);

  let cumpleHole: SeleccionTabla93['cumpleHole'] = 'SIN CABLEAR';
  if (fila) {
    if (fila.method === 'pin-conductivo') cumpleHole = 'N/A';
    else if (holeDiaMm == null) msg.push('Ø de barreno SIN CABLEAR: la columna "Hole diameter" de la Tabla 9.3 no se puede verificar');
    else {
      cumpleHole = filaAdmiteHole(fila.method, holeDiaMm) as boolean;
      if (!cumpleHole) msg.push(`Ø barreno ${holeDiaMm} mm FUERA de "${fila.holeLiteral}" para ${fila.etiqueta} — Tabla 9.3`);
    }
  }

  // cotas sueltas del texto que la tabla no trae
  let cumpleCotaExtra: SeleccionTabla93['cumpleCotaExtra'] = 'SIN CABLEAR';
  if (fila && holeDiaMm != null) {
    if (fila.method === 'baffle') {
      cumpleCotaExtra = holeDiaMm > 6.35;
      if (!cumpleCotaExtra) msg.push(`§9.3.5.2: el barreno del baffle debe ser de "diameter greater than 6.35 mm (1/4 inch)" — tienes ${holeDiaMm} mm ⇒ bajar a bubbler`);
    } else if (fila.method === 'inserto') {
      cumpleCotaExtra = holeDiaMm > 25;
    } else cumpleCotaExtra = true;
  } else if (fila && fila.method === 'pin-conductivo') cumpleCotaExtra = true;

  return {
    coreDiaMm: o.coreDiaMm, holeDiaMm, candidatos, fila, method: fila?.method ?? null,
    fueraDeTabla: candidatos.length === 0, cumpleCore, cumpleHole, cumpleCotaExtra, forzado, mensajes: msg,
    cita: '§9.3.5 · Tabla 9.3 "Slender core cooling options"',
  };
}

/**
 * Puente al motor que ya existía: `chooseSlenderCoreCooling` (slendercore.ts)
 * elige método Y propone el Ø de barreno. Aquí sólo se le pide el Ø propuesto y
 * se DECLARA que ese dimensionado (0.4·Ø acotado por ⅔·Ø de §12.3.2) es
 * EXTENSIÓN, no un número del libro: el libro sólo da rangos y UN ejemplo
 * (baffle de 12 mm en núcleo de 60 mm).
 */
export function barrenoPropuesto(coreDiaMm: number, coreHeightMm: number): { mm: number; extension: string } {
  const s = chooseSlenderCoreCooling(coreDiaMm, coreHeightMm);
  return {
    mm: s.holeDiaMm,
    extension: 'EXTENSIÓN DECLARADA — el libro da RANGOS (Tabla 9.3) y UN ejemplo (baffle 12 mm en núcleo 60 mm), no una fórmula de Ø de barreno: slendercore.ts propone 0.4·Ø acotado por ⅔·Ø (§12.3.2).',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · SOLVER AXISIMÉTRICO (r,z) EN RÉGIMEN PERMANENTE, k VARIABLE POR CELDA
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Volúmenes finitos sobre una malla uniforme en r y z, con:
 *   · conductancia RADIAL logarítmica EXACTA entre centros de anillo,
 *       R = ln(r₂/r₁)/(2π·k·Δz)          ← la misma de thermal-resistance.rCyl
 *     ⇒ el perfil logarítmico de un cilindro sale EXACTO (error de redondeo).
 *   · conductancia AXIAL de placa, g = A/(Δz/2k₁ + Δz/2k₂), A = π(r_f₂²−r_f₁²)
 *     ⇒ el perfil lineal de conducción 1D sale EXACTO.
 *   · Robin por celda (agua): g_robin·(T − T_∞)    ← Eq 9.7
 *   · potencia inyectada por celda (fuente del polímero, Eq 9.10, y las
 *     fronteras de Neumann)
 * Se resuelve por gradiente conjugado matrix-free (A es simétrica definida
 * positiva cuando hay al menos un Robin; sin Robin se deflaciona la constante).
 */
export interface MallaAxi {
  nr: number; nz: number;
  r0: number; r1: number; z0: number; z1: number;  // m
  dr: number; dz: number;
  rc: Float64Array;   // nr centros de anillo (m)
  rf: Float64Array;   // nr+1 caras radiales (m)
  zc: Float64Array;   // nz centros (m)
  areaZ: Float64Array; // nr — área de la cara axial de cada anillo (m²)
  vol: Float64Array;   // nr — volumen de celda por anillo (m³)
}

export function mallaAxi(o: { nr: number; nz: number; r0: number; r1: number; z0: number; z1: number }): MallaAxi {
  const { nr, nz } = o;
  const dr = (o.r1 - o.r0) / nr, dz = (o.z1 - o.z0) / nz;
  const rc = new Float64Array(nr), rf = new Float64Array(nr + 1), zc = new Float64Array(nz);
  const areaZ = new Float64Array(nr), vol = new Float64Array(nr);
  for (let i = 0; i <= nr; i++) rf[i] = o.r0 + i * dr;
  for (let i = 0; i < nr; i++) {
    rc[i] = o.r0 + (i + 0.5) * dr;
    areaZ[i] = Math.PI * (rf[i + 1] * rf[i + 1] - rf[i] * rf[i]);
    vol[i] = areaZ[i] * dz;
  }
  for (let j = 0; j < nz; j++) zc[j] = o.z0 + (j + 0.5) * dz;
  return { nr, nz, r0: o.r0, r1: o.r1, z0: o.z0, z1: o.z1, dr, dz, rc, rf, zc, areaZ, vol };
}

export interface ProblemaAxi {
  m: MallaAxi;
  /** conductividad por celda (W/m·K), índice n = j*nr + i */
  k: Float64Array;
  /** potencia inyectada por celda (W): fuente volumétrica + Neumann de frontera */
  qIn: Float64Array;
  /** conductancia de Robin por celda (W/°C) — 0 = sin agua */
  robinG: Float64Array;
  /** temperatura del sumidero de cada Robin (°C) */
  robinT: Float64Array;
  /** etiqueta del sumidero (0 = ninguno) para desglosar la potencia extraída */
  robinTag?: Uint8Array;
}

export interface SolucionAxi {
  m: MallaAxi;
  T: Float64Array;
  iters: number; resid: number;
  /** flujo por celda en W/m² (positivo hacia +r / +z) */
  qr: Float64Array; qz: Float64Array;
  /** conductancias de cara (para balances finos) */
  gR: Float64Array; gZ: Float64Array;
  potenciaEntra: number;
  potenciaSale: number;
  errBalanceRel: number;
  /** potencia extraída por cada etiqueta de Robin (W) */
  porTag: number[];
}

export function resolverAxi(p: ProblemaAxi, o?: { maxIters?: number; tol?: number }): SolucionAxi {
  const { m, k, qIn, robinG, robinT } = p;
  const { nr, nz, dz, rc, rf, areaZ } = m;
  const N = nr * nz;
  const gR = new Float64Array(N), gZ = new Float64Array(N), diag = new Float64Array(N);
  const dosPi = 2 * Math.PI;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
    const n = j * nr + i;
    if (i < nr - 1) {
      const Ra = Math.log(rf[i + 1] / rc[i]) / (dosPi * k[n] * dz);
      const Rb = Math.log(rc[i + 1] / rf[i + 1]) / (dosPi * k[n + 1] * dz);
      gR[n] = 1 / (Ra + Rb);
    }
    if (j < nz - 1) gZ[n] = areaZ[i] / (dz / (2 * k[n]) + dz / (2 * k[n + nr]));
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
    const n = j * nr + i;
    let d = robinG[n];
    if (i < nr - 1) d += gR[n];
    if (i > 0) d += gR[n - 1];
    if (j < nz - 1) d += gZ[n];
    if (j > 0) d += gZ[n - nr];
    diag[n] = d;
  }
  const applyA = (x: Float64Array, y: Float64Array) => {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
      const n = j * nr + i;
      let acc = 0;
      if (i > 0) acc += gR[n - 1] * x[n - 1];
      if (i < nr - 1) acc += gR[n] * x[n + 1];
      if (j > 0) acc += gZ[n - nr] * x[n - nr];
      if (j < nz - 1) acc += gZ[n] * x[n + nr];
      y[n] = diag[n] * x[n] - acc;
    }
  };
  const b = new Float64Array(N);
  let sumRobin = 0;
  for (let n = 0; n < N; n++) { b[n] = qIn[n] + robinG[n] * robinT[n]; sumRobin += robinG[n]; }
  const singular = sumRobin === 0;               // Neumann puro ⇒ A·1 = 0
  const quitarMedia = (v: Float64Array) => {
    let s = 0; for (let n = 0; n < N; n++) s += v[n];
    const mu = s / N; for (let n = 0; n < N; n++) v[n] -= mu;
  };
  if (singular) quitarMedia(b);
  const T = new Float64Array(N);
  if (!singular) { let t0 = 0, w = 0; for (let n = 0; n < N; n++) if (robinG[n] > 0) { t0 += robinT[n] * robinG[n]; w += robinG[n]; } T.fill(w > 0 ? t0 / w : 0); }
  const r = new Float64Array(N), pv = new Float64Array(N), Ap = new Float64Array(N);
  applyA(T, Ap);
  for (let n = 0; n < N; n++) r[n] = b[n] - Ap[n];
  if (singular) quitarMedia(r);
  pv.set(r);
  let rs = 0; for (let n = 0; n < N; n++) rs += r[n] * r[n];
  const rs0 = rs;
  const maxIters = o?.maxIters ?? 4000, tol = o?.tol ?? 1e-14;
  let iters = 0, resid = Math.sqrt(rs);
  while (iters < maxIters && rs > tol * tol * Math.max(rs0, 1e-300)) {
    applyA(pv, Ap);
    if (singular) quitarMedia(Ap);
    let pAp = 0; for (let n = 0; n < N; n++) pAp += pv[n] * Ap[n];
    if (!(Math.abs(pAp) > 0)) break;
    const alpha = rs / pAp;
    for (let n = 0; n < N; n++) { T[n] += alpha * pv[n]; r[n] -= alpha * Ap[n]; }
    let rs2 = 0; for (let n = 0; n < N; n++) rs2 += r[n] * r[n];
    const beta = rs2 / rs;
    for (let n = 0; n < N; n++) pv[n] = r[n] + beta * pv[n];
    rs = rs2; resid = Math.sqrt(rs2); iters++;
  }
  if (singular) quitarMedia(T);

  // flujos por celda (W/m²), promediando las caras disponibles
  const qr = new Float64Array(N), qz = new Float64Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
    const n = j * nr + i;
    let sr = 0, cr = 0, sz = 0, cz = 0;
    if (i < nr - 1) { sr += (gR[n] * (T[n] - T[n + 1])) / (dosPi * rf[i + 1] * dz); cr++; }
    if (i > 0) { sr += (gR[n - 1] * (T[n - 1] - T[n])) / (dosPi * rf[i] * dz); cr++; }
    if (j < nz - 1) { sz += (gZ[n] * (T[n] - T[n + nr])) / areaZ[i]; cz++; }
    if (j > 0) { sz += (gZ[n - nr] * (T[n - nr] - T[n])) / areaZ[i]; cz++; }
    qr[n] = cr ? sr / cr : 0;
    qz[n] = cz ? sz / cz : 0;
  }
  let entra = 0, sale = 0;
  const porTag: number[] = [];
  for (let n = 0; n < N; n++) {
    entra += qIn[n];
    const w = robinG[n] * (T[n] - robinT[n]);
    sale += w;
    const tg = p.robinTag ? p.robinTag[n] : 0;
    if (tg > 0) { porTag[tg] = (porTag[tg] ?? 0) + w; }
  }
  for (let t = 0; t < porTag.length; t++) if (porTag[t] === undefined) porTag[t] = 0;
  return {
    m, T, iters, resid, qr, qz, gR, gZ,
    potenciaEntra: entra, potenciaSale: sale,
    errBalanceRel: Math.abs(entra) > 0 ? Math.abs(entra - sale) / Math.abs(entra) : Math.abs(sale),
    porTag,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · EL MODELO DEL NÚCLEO ESBELTO (§9.3.5 / §9.3.6)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Núcleo (acero o Cu) + el plástico que lo abraza + el acero de cavidad con su
 * agua. El calor NACE en el plástico (Eq 9.10) y busca salida:
 *   · por el BARRENO del núcleo (baffle/bubbler/inserto/heat pipe)  → RADIAL
 *   · por la BASE del núcleo (agua detrás del pin, §9.3.5.5)        → AXIAL
 *   · cruzando el plástico hasta la CAVIDAD                          → el "otro lado"
 * El reparto NO se supone: sale del campo. Ése es el juicio de V9.18 y la
 * sentencia de §9.3.5.5 ("act primarily as insulators") medida, no citada.
 */
export const TAG = { BARRENO: 1, BASE: 2, CAVIDAD: 3 } as const;

export interface CampoNucleoOpts {
  coreDiaMm: number; coreHeightMm: number;
  /** 0 = núcleo macizo (pin conductivo) */
  boreDiaMm: number;
  /** espesor de la pared de plástico alrededor y encima del núcleo (mm) */
  paredPlasticoMm: number;
  /** espesor del acero de cavidad hasta la línea de agua (mm) */
  aceroCavidadMm: number;
  kCoreWmK: number; kPlasticoWmK: number; kCavidadWmK: number;
  hCoolant: number; tCoolantC: number;
  /** calor total a extraer (W) — Eq 9.10, lo pone el llamador */
  qTotalW: number;
  /** ¿hay agua detrás del núcleo? (§9.3.5.5: "el refrigerante corre por detrás del pin") */
  baseEnfriada: boolean;
  nr?: number; nz?: number;
}

export interface CampoNucleo {
  opts: CampoNucleoOpts;
  sol: SolucionAxi;
  /** índices de corte: última columna de núcleo y última fila de núcleo */
  iCore: number; jCore: number;
  /** potencia extraída por cada camino (W) y su fracción */
  qBarrenoW: number; qBaseW: number; qCavidadW: number;
  fracNucleo: number; fracCavidad: number;
  /** reparto DENTRO del núcleo: media de |q_r| y |q_z| ponderada por volumen (W/m²) */
  qrMedio: number; qzMedio: number;
  dominante: 'radial' | 'axial';
  /** flujo en la SUPERFICIE moldeante del núcleo (V9.3): media, sigma y CV */
  supMediaWm2: number; supSigmaWm2: number; supCV: number;
  /** V9.8/§9.2.7: ΔT de la base a la punta sobre la superficie del núcleo (°C) */
  dTBasePuntaC: number;
  tBaseC: number; tPuntaC: number;
  /** ΔT núcleo↔cavidad en la misma pared (§9.2.7, entrada de V10.8) */
  dTNucleoCavidadC: number;
  /** glifos listos para dibujar: r,z en mm, componentes normalizadas */
  glifos: Array<{ rMm: number; zMm: number; qr: number; qz: number; mag: number; radial: boolean }>;
  magMax: number;
}

export function campoNucleo(o: CampoNucleoOpts): CampoNucleo {
  const mm = 1e-3;
  const rBore = (o.boreDiaMm / 2) * mm;
  const rCore = (o.coreDiaMm / 2) * mm;
  const H = o.coreHeightMm * mm;
  const tp = o.paredPlasticoMm * mm, tc = o.aceroCavidadMm * mm;
  const R1 = rCore + tp + tc, Z1 = H + tp + tc;
  const nr = o.nr ?? 84, nz = o.nz ?? 132;
  const m = mallaAxi({ nr, nz, r0: rBore, r1: R1, z0: 0, z1: Z1 });
  const N = nr * nz;
  const k = new Float64Array(N), qIn = new Float64Array(N);
  const robinG = new Float64Array(N), robinT = new Float64Array(N), robinTag = new Uint8Array(N);

  // ── materiales por celda ────────────────────────────────────────────────
  const esNucleo = (i: number, j: number) => m.rc[i] <= rCore && m.zc[j] <= H;
  const esPlastico = (i: number, j: number) =>
    !esNucleo(i, j) && m.rc[i] <= rCore + tp && m.zc[j] <= H + tp;
  let volPlast = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
    const n = j * nr + i;
    if (esNucleo(i, j)) k[n] = o.kCoreWmK;
    else if (esPlastico(i, j)) { k[n] = o.kPlasticoWmK; volPlast += m.vol[i]; }
    else k[n] = o.kCavidadWmK;
  }
  // ── fuente: todo el calor del disparo nace en el plástico (Eq 9.10) ─────
  const qVol = o.qTotalW / Math.max(volPlast, 1e-12);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
    const n = j * nr + i;
    if (esPlastico(i, j)) qIn[n] = qVol * m.vol[i];
  }
  // ── sumideros ───────────────────────────────────────────────────────────
  // Se guarda CADA contribución por separado (una celda puede tocar dos aguas:
  // el barreno y la base coinciden en la esquina). Si se dejara una sola
  // etiqueta por celda, la potencia de esa esquina se le acreditaría entera al
  // último que escribió — exactamente el "bug de contabilidad" que ya nos costó
  // antes: un dato bien calculado que llega mal al juez.
  const sinks: Array<{ n: number; g: number; t: number; tag: number }> = [];
  const poner = (n: number, g: number, t: number, tag: number) => {
    robinG[n] += g; robinT[n] = t; if (!robinTag[n]) robinTag[n] = tag;
    sinks.push({ n, g, t, tag });
  };
  // barreno del núcleo (r = r0), sólo a lo alto del núcleo
  if (rBore > 0) for (let j = 0; j < nz; j++) if (m.zc[j] <= H) poner(j * nr + 0, o.hCoolant * 2 * Math.PI * m.r0 * m.dz, o.tCoolantC, TAG.BARRENO);
  // base del núcleo (z = 0) bajo el núcleo
  if (o.baseEnfriada) for (let i = 0; i < nr; i++) if (m.rc[i] <= rCore) poner(0 * nr + i, o.hCoolant * m.areaZ[i], o.tCoolantC, TAG.BASE);
  // agua de la cavidad: superficie exterior (r = R1) y superior (z = Z1)
  for (let j = 0; j < nz; j++) poner(j * nr + (nr - 1), o.hCoolant * 2 * Math.PI * m.r1 * m.dz, o.tCoolantC, TAG.CAVIDAD);
  for (let i = 0; i < nr; i++) poner((nz - 1) * nr + i, o.hCoolant * m.areaZ[i], o.tCoolantC, TAG.CAVIDAD);

  const sol = resolverAxi({ m, k, qIn, robinG, robinT, robinTag });
  const potTag = [0, 0, 0, 0];
  for (const s of sinks) potTag[s.tag] += s.g * (sol.T[s.n] - s.t);

  // índices de corte
  let iCore = 0, jCore = 0;
  for (let i = 0; i < nr; i++) if (m.rc[i] <= rCore) iCore = i;
  for (let j = 0; j < nz; j++) if (m.zc[j] <= H) jCore = j;

  const qBarrenoW = potTag[TAG.BARRENO];
  const qBaseW = potTag[TAG.BASE];
  const qCavidadW = potTag[TAG.CAVIDAD];
  const qOut = qBarrenoW + qBaseW + qCavidadW;

  // reparto radial/axial DENTRO del núcleo (V9.18), ponderado por volumen
  let sr = 0, sz = 0, vt = 0;
  const glifos: CampoNucleo['glifos'] = [];
  let magMax = 0;
  const pasoI = Math.max(1, Math.round((iCore + 1) / 7)), pasoJ = Math.max(1, Math.round((jCore + 1) / 12));
  for (let j = 0; j <= jCore; j++) for (let i = 0; i <= iCore; i++) {
    const n = j * nr + i, v = m.vol[i];
    sr += Math.abs(sol.qr[n]) * v; sz += Math.abs(sol.qz[n]) * v; vt += v;
    if (i % pasoI === Math.floor(pasoI / 2) && j % pasoJ === Math.floor(pasoJ / 2)) {
      const qrv = sol.qr[n], qzv = sol.qz[n], mag = Math.hypot(qrv, qzv);
      magMax = Math.max(magMax, mag);
      glifos.push({ rMm: m.rc[i] / mm, zMm: m.zc[j] / mm, qr: qrv, qz: qzv, mag, radial: Math.abs(qrv) >= Math.abs(qzv) });
    }
  }
  const qrMedio = vt > 0 ? sr / vt : 0, qzMedio = vt > 0 ? sz / vt : 0;

  // flujo que ENTRA por la superficie moldeante del núcleo (V9.3: las flechas)
  const sup: number[] = [];
  for (let j = 0; j <= jCore; j++) {
    const n = j * nr + iCore;
    if (iCore < nr - 1) sup.push(-(sol.gR[n] * (sol.T[n] - sol.T[n + 1])) / (2 * Math.PI * m.rf[iCore + 1] * m.dz));
  }
  for (let i = 0; i <= iCore; i++) {
    const n = jCore * nr + i;
    if (jCore < nz - 1) sup.push(-(sol.gZ[n] * (sol.T[n] - sol.T[n + nr])) / m.areaZ[i]);
  }
  const supMedia = sup.reduce((a, b) => a + b, 0) / Math.max(1, sup.length);
  const supSigma = Math.sqrt(sup.reduce((a, b) => a + (b - supMedia) ** 2, 0) / Math.max(1, sup.length));

  const tBase = sol.T[0 * nr + iCore], tPunta = sol.T[jCore * nr + iCore];
  // cavidad enfrentada a la punta del núcleo (misma pared, otro lado del plástico)
  let iCav = iCore; for (let i = 0; i < nr; i++) if (m.rc[i] <= rCore + tp) iCav = i;
  const tCav = sol.T[jCore * nr + Math.min(nr - 1, iCav + 1)];

  return {
    opts: o, sol, iCore, jCore,
    qBarrenoW, qBaseW, qCavidadW,
    fracNucleo: qOut > 0 ? (qBarrenoW + qBaseW) / qOut : 0,
    fracCavidad: qOut > 0 ? qCavidadW / qOut : 0,
    qrMedio, qzMedio, dominante: qrMedio >= qzMedio ? 'radial' : 'axial',
    supMediaWm2: supMedia, supSigmaWm2: supSigma, supCV: supMedia !== 0 ? supSigma / Math.abs(supMedia) : NaN,
    dTBasePuntaC: tPunta - tBase, tBaseC: tBase, tPuntaC: tPunta,
    dTNucleoCavidadC: tPunta - tCav,
    glifos, magMax,
  };
}

/**
 * §9.3.6 — FLUJO DE CALOR DE UN SOLO LADO. Literal: *"Eqs. (9.5), (9.6), and
 * (9.8) may be used by substituting twice the thickness of the molding for the
 * variable, h. The result is that any molding application with a one sided heat
 * flow will have a four fold increase in the cooling time."*
 * Aquí no se hardcodea el 4: se sustituye 2h en Eq 9.5 y el 4 SALE.
 */
export function tiempoUnSoloLado(hMm: number, mat: CoolingMaterial): { dosLadosS: number; unLadoS: number; factor: number } {
  const dos = coolingTimePlate((hMm / 1000), mat);
  const uno = coolingTimePlate((2 * hMm) / 1000, mat);
  return { dosLadosS: dos, unLadoS: uno, factor: uno / dos };
}

/**
 * Resistencia térmica de las dos salidas del núcleo, en forma cerrada, para
 * contrastar con el campo (y para el caso en que no haya campo):
 *   RADIAL (con barreno): R = ln(r_core/r_bore)/(2π·k·H)   ← rCyl, thermal-resistance
 *   AXIAL (pin macizo):   R = H/(k·A) con A = π·r_core²    ← conducción 1D
 * El cociente R_axial/R_radial dice, sin resolver nada, por qué un pin esbelto
 * "act primarily as insulators" (§9.3.5.5).
 */
export function resistenciasNucleo(o: { coreDiaMm: number; boreDiaMm: number; alturaMm: number; kWmK: number }) {
  const rC = o.coreDiaMm / 2000, rB = o.boreDiaMm / 2000, H = o.alturaMm / 1000;
  const radial = rB > 0 ? rCyl(rB, rC, o.kWmK, H) : NaN;
  const axial = H / (o.kWmK * Math.PI * rC * rC);
  return { radialKW: radial, axialKW: axial, razon: rB > 0 ? axial / radial : NaN, ld: o.alturaMm / o.coreDiaMm };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · LA LÁMINA
// ═══════════════════════════════════════════════════════════════════════════

export interface LaminaNucleoOpts {
  nombre: string;
  coreDiaMm: number; coreHeightMm: number;
  /** Ø del barreno; 0 = macizo. Si se omite, lo propone slendercore.ts (EXTENSIÓN). */
  boreDiaMm?: number;
  metodoForzado?: SlenderCoolingMethod;
  paredPlasticoMm: number;
  aceroCavidadMm?: number;
  /** campo térmico resuelto; sin él, el bloque térmico va SIN CABLEAR */
  campo?: CampoNucleo;
  /** para §9.3.6 (Eq 9.5 con 2h); sin él, el bloque va SIN CABLEAR */
  material?: CoolingMaterial;
  /** V12.14 §12.2.7 — el supuesto conservador: el inserto NO da soporte */
  estructura?: { meltPressureMPa: number; metalKey?: string; interlocked?: boolean };
  kNucleoWmK?: number;
}

const F = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

const filaEtiqueta = (m: SlenderCoolingMethod | null) => TABLA_9_3.find((f) => f.method === m)?.etiqueta ?? 'SIN DISPOSITIVO';

/** cómo circula el refrigerante en cada dispositivo — LITERAL de §9.3.5.x */
function descripcionDispositivo(m: SlenderCoolingMethod | null): string {
  switch (m) {
    case 'inserto': return 'canales en la periferia y a lo largo + retorno axial';
    case 'baffle': return 'hoja en barreno taladrado: baja por un lado, sube por el otro';
    case 'bubbler': return 'flujo POR FUERA y retorno POR DENTRO — dos canales';
    case 'heat-pipe': return 'tubo cerrado: condensación-evaporación, sin masa de agua';
    case 'pin-conductivo': return 'sin barreno: el refrigerante corre DETRÁS del pin';
    default: return 'núcleo MACIZO: el agua sólo llega a la base — el MALO de Fig 9.11 (§9.2.7)';
  }
}

/** flecha: punta triangular en (x,y) apuntando en (dx,dy) */
function punta(x: number, y: number, dx: number, dy: number, col: string, w = 4.2): string {
  const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
  const p1 = `${x.toFixed(1)},${y.toFixed(1)}`;
  const p2 = `${(x - ux * w * 2 + px * w * 0.75).toFixed(1)},${(y - uy * w * 2 + py * w * 0.75).toFixed(1)}`;
  const p3 = `${(x - ux * w * 2 - px * w * 0.75).toFixed(1)},${(y - uy * w * 2 - py * w * 0.75).toFixed(1)}`;
  return `<polygon points="${p1} ${p2} ${p3}" fill="${col}"/>`;
}

/** cota de diámetro: línea horizontal con puntas hacia AFUERA + texto */
function cotaDia(xA: number, xB: number, y: number, txt: string, col: string, yTxt?: number): string {
  const s: string[] = [];
  s.push(`<line x1="${xA.toFixed(1)}" y1="${y.toFixed(1)}" x2="${xB.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="1.1"/>`);
  s.push(punta(xA, y, -1, 0, col, 3.6));
  s.push(punta(xB, y, 1, 0, col, 3.6));
  s.push(`<line x1="${xA.toFixed(1)}" y1="${(y - 6).toFixed(1)}" x2="${xA.toFixed(1)}" y2="${(y + 6).toFixed(1)}" stroke="${col}" stroke-width="0.8" opacity="0.7"/>`);
  s.push(`<line x1="${xB.toFixed(1)}" y1="${(y - 6).toFixed(1)}" x2="${xB.toFixed(1)}" y2="${(y + 6).toFixed(1)}" stroke="${col}" stroke-width="0.8" opacity="0.7"/>`);
  s.push(`<text x="${((xA + xB) / 2).toFixed(1)}" y="${(yTxt ?? y - 6).toFixed(1)}" text-anchor="middle" style="font:700 12px 'JetBrains Mono',monospace;fill:${col}">${ESC(txt)}</text>`);
  return s.join('');
}

/** cota vertical (altura) con puntas hacia afuera */
function cotaAlt(x: number, yA: number, yB: number, txt: string, col: string): string {
  const s: string[] = [];
  s.push(`<line x1="${x.toFixed(1)}" y1="${yA.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yB.toFixed(1)}" stroke="${col}" stroke-width="1.1"/>`);
  s.push(punta(x, yA, 0, -1, col, 3.6));
  s.push(punta(x, yB, 0, 1, col, 3.6));
  s.push(`<text x="${(x + 7).toFixed(1)}" y="${((yA + yB) / 2).toFixed(1)}" style="font:700 12px 'JetBrains Mono',monospace;fill:${col}" transform="rotate(90 ${(x + 7).toFixed(1)} ${((yA + yB) / 2).toFixed(1)})" text-anchor="middle">${ESC(txt)}</text>`);
  return s.join('');
}

export function laminaNucleoEnfriamiento(o: LaminaNucleoOpts): Lamina {
  const W = 1080, H = 760, PAD = 46;
  const prop = barrenoPropuesto(o.coreDiaMm, o.coreHeightMm);
  const sel0 = seleccionTabla93({ coreDiaMm: o.coreDiaMm, metodoForzado: o.metodoForzado });
  const esPin = sel0.method === 'pin-conductivo';
  const boreDia = o.boreDiaMm != null ? o.boreDiaMm : (esPin ? 0 : prop.mm);
  const sel = seleccionTabla93({ coreDiaMm: o.coreDiaMm, holeDiaMm: boreDia > 0 ? boreDia : null, metodoForzado: o.metodoForzado });
  // LO QUE LA TABLA PIDE vs LO QUE ESTÁ DIBUJADO — no son lo mismo, y confundirlos
  // es la mentira exacta que esta lámina existe para cazar: un núcleo Ø60 macizo
  // NO "lleva baffle" sólo porque la Tabla 9.3 diga que le tocaría uno.
  const sinDispositivo = boreDia <= 0 && sel.method !== 'pin-conductivo';
  const met: SlenderCoolingMethod | null = sinDispositivo ? null : sel.method;
  const cav = o.aceroCavidadMm ?? Math.max(10, o.coreDiaMm * 0.25);
  const c = o.campo;

  // ── PANEL IZQUIERDO: EL CORTE ───────────────────────────────────────────
  const PX0 = PAD, PX1 = 500, PY0 = 112, PY1 = H - 98;
  const rTot = o.coreDiaMm / 2 + o.paredPlasticoMm + cav;
  const zTot = o.coreHeightMm + o.paredPlasticoMm + cav;
  // la banda de dibujo excluye el título del corte (arriba) y las cotas (abajo):
  // sin reservarlas, el rótulo "acero de cavidad" se montaba sobre el título
  const DY0 = PY0 + 34, DY1 = PY1 - 62;   // abajo caben DOS cotas apiladas + la nota
  const kk = Math.min((PX1 - PX0 - 66) / (2 * rTot), (DY1 - DY0) / zTot);
  const cx = (PX0 + PX1) / 2 - 6;
  const zBase = (DY0 + DY1) / 2 + (zTot * kk) / 2;
  const SX = (rMm: number) => cx + rMm * kk;
  const SY = (zMm: number) => zBase - zMm * kk;
  const rC = o.coreDiaMm / 2, rB = boreDia / 2, hh = o.coreHeightMm;
  const rP = rC + o.paredPlasticoMm;

  const bandas: string[] = [];
  const banda = (ra: number, rb: number, z0: number, z1: number, fill: string, stroke?: string) => {
    for (const sgn of [-1, 1]) {
      const x0 = SX(sgn > 0 ? ra : -rb), x1 = SX(sgn > 0 ? rb : -ra);
      bandas.push(`<rect x="${Math.min(x0, x1).toFixed(1)}" y="${SY(z1).toFixed(1)}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${((z1 - z0) * kk).toFixed(1)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ''}/>`);
    }
  };
  // acero de cavidad (contexto), plástico, núcleo
  bandas.push(`<rect x="${SX(-rTot).toFixed(1)}" y="${SY(zTot).toFixed(1)}" width="${(2 * rTot * kk).toFixed(1)}" height="${(zTot * kk).toFixed(1)}" fill="#1b2534" stroke="#2c3a50" stroke-width="1.2"/>`);
  banda(0, rP, hh, hh + o.paredPlasticoMm, '#7a5320');          // plástico sobre la punta
  banda(rC, rP, 0, hh + o.paredPlasticoMm, '#7a5320');           // plástico alrededor
  banda(rB, rC, 0, hh, o.kNucleoWmK && o.kNucleoWmK > 100 ? '#8a5a34' : '#48566b', '#7d8ea6');  // el NÚCLEO
  // agua de cavidad (la superficie con Robin)
  bandas.push(`<rect x="${SX(-rTot).toFixed(1)}" y="${SY(zTot).toFixed(1)}" width="${(2 * rTot * kk).toFixed(1)}" height="4" fill="#1d6fb8" opacity="0.75"/>`);
  bandas.push(`<rect x="${SX(-rTot).toFixed(1)}" y="${SY(zTot).toFixed(1)}" width="4" height="${(zTot * kk).toFixed(1)}" fill="#1d6fb8" opacity="0.75"/>`);
  bandas.push(`<rect x="${(SX(rTot) - 4).toFixed(1)}" y="${SY(zTot).toFixed(1)}" width="4" height="${(zTot * kk).toFixed(1)}" fill="#1d6fb8" opacity="0.75"/>`);

  // ── EL DISPOSITIVO ──────────────────────────────────────────────────────
  const disp: string[] = [];
  const AGUA = '#39a8f0', TUBO = '#cfd9e6';
  const flechaAgua = (x: number, y0: number, y1: number) => {
    disp.push(`<line x1="${x.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${AGUA}" stroke-width="1.6"/>`);
    disp.push(punta(x, y1, 0, y1 - y0, AGUA, 3.8));
  };
  if (met === 'pin-conductivo' || rB <= 0) {
    // §9.3.5.5 — pin macizo; el refrigerante corre DETRÁS del pin
    disp.push(`<rect x="${SX(-rC).toFixed(1)}" y="${(SY(0)).toFixed(1)}" width="${(2 * rC * kk).toFixed(1)}" height="8" fill="#1d6fb8"/>`);
    disp.push(`<text x="${SX(-rTot).toFixed(1)}" y="${(SY(0) + 18).toFixed(1)}" class="lblSm" style="fill:#7fd0ff">${met === 'pin-conductivo' ? 'agua DETRÁS del pin §9.3.5.5' : 'agua sólo en la BASE (Fig 9.11)'}</text>`);
  } else {
    banda(0, rB, 0, hh, '#0f3b5e');                              // el barreno lleno de agua
    const xL = SX(-rB / 2), xR = SX(rB / 2), yT = SY(hh * 0.94), yB = SY(hh * 0.08);
    if (met === 'baffle') {
      // Fig 9.21 — hoja del baffle partiendo el barreno; baja por un lado, sube por el otro
      disp.push(`<rect x="${(SX(0) - 1.6).toFixed(1)}" y="${SY(hh * 0.97).toFixed(1)}" width="3.2" height="${(hh * 0.92 * kk).toFixed(1)}" fill="${TUBO}"/>`);
      flechaAgua(xL, SY(hh * 0.02), yT);
      flechaAgua(xR, yT, yB);
    } else if (met === 'bubbler') {
      // §9.3.5.3 — flujo POR FUERA del bubbler, retorno POR DENTRO
      const w = Math.max(2.2, rB * 0.45 * kk);
      disp.push(`<rect x="${(SX(0) - w).toFixed(1)}" y="${SY(hh * 0.93).toFixed(1)}" width="${(2 * w).toFixed(1)}" height="${(hh * 0.88 * kk).toFixed(1)}" fill="none" stroke="${TUBO}" stroke-width="1.4"/>`);
      flechaAgua(SX(-rB * 0.72), SY(hh * 0.02), yT);
      flechaAgua(SX(0), yT, yB);
    } else if (met === 'heat-pipe') {
      // §9.3.5.4 — tubo cerrado: vapor de la punta caliente a la base fría, retorno capilar
      disp.push(`<rect x="${SX(-rB * 0.82).toFixed(1)}" y="${SY(hh * 0.97).toFixed(1)}" width="${(1.64 * rB * kk).toFixed(1)}" height="${(hh * 0.94 * kk).toFixed(1)}" fill="none" stroke="${TUBO}" stroke-width="1.6" rx="3"/>`);
      flechaAgua(SX(0), SY(hh * 0.9), SY(hh * 0.15));
      disp.push(`<line x1="${SX(-rB * 0.6).toFixed(1)}" y1="${SY(hh * 0.15).toFixed(1)}" x2="${SX(-rB * 0.6).toFixed(1)}" y2="${SY(hh * 0.9).toFixed(1)}" stroke="#9fe0ff" stroke-width="1.2" stroke-dasharray="4 3"/>`);
      disp.push(punta(SX(-rB * 0.6), SY(hh * 0.9), 0, -1, '#9fe0ff', 3.2));
    } else {
      // §9.3.5.1 — inserto: canales en la PERIFERIA y a lo largo + retorno axial
      for (const s of [-1, 1]) {
        disp.push(`<rect x="${(SX(s * rB * 0.78) - 2.6).toFixed(1)}" y="${SY(hh * 0.95).toFixed(1)}" width="5.2" height="${(hh * 0.9 * kk).toFixed(1)}" fill="${AGUA}" opacity="0.85"/>`);
      }
      disp.push(`<rect x="${(SX(0) - 3.2).toFixed(1)}" y="${SY(hh * 0.86).toFixed(1)}" width="6.4" height="${(hh * 0.82 * kk).toFixed(1)}" fill="none" stroke="${TUBO}" stroke-width="1.4"/>`);
      flechaAgua(SX(-rB * 0.78), SY(hh * 0.03), SY(hh * 0.9));
      flechaAgua(SX(0), SY(hh * 0.82), SY(hh * 0.1));
    }
  }

  // ── GLIFOS DE FLUJO DE CALOR (V9.3 / V9.18) ─────────────────────────────
  const glifos: string[] = [];
  if (c && c.magMax > 0) {
    // la flecha se CENTRA en su muestra y se acota al paso de muestreo: antes
    // arrancaba en el punto y se salía del núcleo por abajo, pisando la cota
    // submuestreo por DISTANCIA EN PANTALLA: en un pin de Ø4 mm las 7 columnas
    // del campo caen en 19 px y las flechas se vuelven una mancha ilegible
    const PASO_PX = 16;
    const puestos: Array<[number, number]> = [];
    const cabe = (x: number, z: number) => {
      for (const [a, b] of puestos) if (Math.hypot(x - a, z - b) < PASO_PX) return false;
      puestos.push([x, z]); return true;
    };
    const Lmax = 0.85 * PASO_PX;
    for (const g of c.glifos) {
      if (!cabe(SX(g.rMm), SY(g.zMm))) continue;
      if (g.mag <= 0) continue;
      const len = Lmax * Math.sqrt(g.mag / c.magMax);          // longitud ∝ magnitud (V9.3)
      if (len < 2) continue;
      const ux = g.qr / g.mag, uy = -g.qz / g.mag;             // +z hacia arriba en pantalla
      const col = g.radial ? '#6db3f2' : '#ffb347';
      for (const s of [-1, 1]) {
        const cxp = SX(s * g.rMm), cyp = SY(g.zMm);
        const dx = s * ux * len, dy = uy * len;
        const x0 = cxp - dx / 2, y0 = cyp - dy / 2;
        glifos.push(`<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${(x0 + dx).toFixed(1)}" y2="${(y0 + dy).toFixed(1)}" stroke="${col}" stroke-width="1.5" opacity="0.95"/>`);
        glifos.push(punta(x0 + dx, y0 + dy, dx, dy, col, 3.4));
      }
    }
  }

  // ── COTAS ───────────────────────────────────────────────────────────────
  const cotas: string[] = [];
  const yCotaCore = SY(0) + 38;                      // debajo del rótulo del agua de base
  cotas.push(cotaDia(SX(-rC), SX(rC), yCotaCore, `Ø ${o.coreDiaMm.toFixed(1)}`, '#e9eef5', yCotaCore - 7));
  // las cotas se APILAN debajo del corte, como en un plano: meter la del barreno
  // dentro del dibujo la ponía encima del baffle y de las flechas
  if (rB > 0) cotas.push(cotaDia(SX(-rB), SX(rB), yCotaCore + 20, `Ø ${boreDia.toFixed(1)}`, '#7fd0ff', yCotaCore + 14));
  cotas.push(cotaAlt(SX(rTot) + 15, SY(hh), SY(0), `H ${o.coreHeightMm.toFixed(0)}`, '#8fa3bd'));
  cotas.push(`<text x="${SX(0).toFixed(1)}" y="${(yCotaCore + (rB > 0 ? 38 : 20)).toFixed(1)}" text-anchor="middle" class="lblSm">L/Ø ${(o.coreHeightMm / o.coreDiaMm).toFixed(1)} · pared de plástico ${o.paredPlasticoMm} mm · acero de cavidad ${cav.toFixed(0)} mm</text>`);
  // rótulos de material: sin ellos el corte es un bloque azul-gris sin lectura
  const yRot = SY(zTot * 0.5);
  // el rótulo del acero va ABAJO a la izquierda: arriba chocaba con la cota del barreno
  cotas.push(`<text x="${(SX(-rTot) + 6).toFixed(1)}" y="${(SY(zTot) + 14).toFixed(1)}" class="lblSm" style="fill:#8697ab">acero de cavidad</text>`);
  cotas.push(`<text x="${(SX(rC + o.paredPlasticoMm / 2)).toFixed(1)}" y="${yRot.toFixed(1)}" class="lblSm" style="fill:#e0a35a" transform="rotate(-90 ${SX(rC + o.paredPlasticoMm / 2).toFixed(1)} ${yRot.toFixed(1)})" text-anchor="middle">plástico</text>`);
  // los dos rótulos sólo caben si el núcleo dibujado es ancho; si no, uno solo
  const anchoNucleoPx = rC * kk;
  if (rB > 0 && anchoNucleoPx >= 48) {
    cotas.push(`<text x="${SX(-rC * 0.55).toFixed(1)}" y="${(SY(hh) + 15).toFixed(1)}" text-anchor="middle" class="lblSm" style="fill:#dbe4ef">núcleo</text>`);
    cotas.push(`<text x="${SX(rC * 0.55).toFixed(1)}" y="${(SY(hh) + 15).toFixed(1)}" text-anchor="middle" class="lblSm" style="fill:#9fd8ff">${ESC(filaEtiqueta(met))}</text>`);
  } else {
    cotas.push(`<text x="${SX(0).toFixed(1)}" y="${(SY(hh) - 8).toFixed(1)}" text-anchor="middle" class="lblSm" style="fill:#dbe4ef">núcleo</text>`);
  }
  // el título del corte llena la banda muerta de arriba y dice QUÉ se está viendo
  cotas.push(`<text x="${PX0}" y="${(PY0 + 12).toFixed(0)}" class="${sinDispositivo ? 'mal' : 'cita'}" style="font:700 13px 'JetBrains Mono',monospace">CORTE DEL NÚCLEO — ${ESC(filaEtiqueta(met))}${sinDispositivo ? '' : ` (${ESC(sel.fila?.seccion ?? '—')})`}</text>`);
  cotas.push(`<text x="${PX0}" y="${(PY0 + 28).toFixed(0)}" class="lblSm">${ESC(descripcionDispositivo(met))}</text>`);

  // ── PANEL DERECHO: TABLA 9.3 + LO MEDIDO ────────────────────────────────
  const RX = 516, RW = W - RX - PAD;
  let y = PY0 - 2;
  const der: string[] = [];
  /** ancho de carácter de JetBrains Mono ≈ 0.6·tamaño; se parte a mano porque
   *  el SVG no envuelve texto solo (y el desbordamiento se COMIÓ media línea). */
  const parte = (txt: string, px: number, ancho = RW): string[] => {
    const max = Math.floor(ancho / (px * 0.61));
    if (txt.length <= max) return [txt];
    const out: string[] = []; let cur = '';
    for (const w of txt.split(' ')) {
      if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) out.push(cur);
    return out;
  };
  // La sangría de continuación va por X: los espacios de más los colapsa el SVG.
  // Y la fuente va SIEMPRE explícita: las clases .ok/.mal/.warn de la hoja de
  // estilo sólo fijan el COLOR — sin font, el navegador metía su tipografía por
  // defecto a otro tamaño y los renglones de colores se encimaban (lo cazó el PNG).
  const linea = (txt: string, cls = 'lbl', dy = 14.5, px = 12) => {
    parte(txt, px).forEach((l, i) => {
      der.push(`<text x="${RX + (i ? 12 : 0)}" y="${y.toFixed(0)}" class="${cls}" style="font:400 ${px}px 'JetBrains Mono',monospace">${ESC(l)}</text>`);
      y += dy;
    });
  };
  const lineaSm = (txt: string, cls = 'lblSm') => linea(txt, cls, 12, 10.5);

  der.push(`<text x="${RX}" y="${y}" class="cita">TABLA 9.3 — "Slender core cooling options" (§9.3.5)</text>`); y += 17;
  const colX = [RX + 2, RX + 150, RX + 288, RX + 420];
  der.push(`<text x="${colX[0]}" y="${y}" class="lblSm">Opción</text><text x="${colX[1]}" y="${y}" class="lblSm">Ø núcleo</text><text x="${colX[2]}" y="${y}" class="lblSm">Ø barreno</text><text x="${colX[3]}" y="${y}" class="lblSm">Tasa</text>`);
  y += 5;
  der.push(`<line x1="${RX}" y1="${y}" x2="${RX + RW}" y2="${y}" stroke="#2c3a50" stroke-width="1"/>`); y += 14;
  for (const f of TABLA_9_3) {
    const esCand = sel.candidatos.some((k2) => k2.method === f.method);
    // la fila que la tabla PIDE se marca siempre; en VERDE sólo si el corte
    // realmente lleva ese dispositivo (si el núcleo va macizo, va en ROJO)
    const esPedida = f.method === sel.method;
    const esSel = esPedida && !sinDispositivo;
    if (esPedida) der.push(`<rect x="${RX - 4}" y="${y - 12}" width="${RW + 4}" height="17" fill="${esSel ? '#1c3a28' : '#3a1c1c'}" stroke="${esSel ? '#59d98c' : '#ff5c5c'}" stroke-width="1"/>`);
    else if (esCand) der.push(`<rect x="${RX - 4}" y="${y - 12}" width="${RW + 4}" height="17" fill="#2a2413"/>`);
    const col = esSel ? '#59d98c' : esPedida ? '#ff8a8a' : esCand ? '#c9a227' : '#5b6b80';
    const st = `font:${esPedida ? 700 : 400} 11.5px 'JetBrains Mono',monospace;fill:${col}`;
    der.push(`<text x="${colX[0]}" y="${y}" style="${st}">${esSel ? '▶ ' : esPedida ? '✗ ' : '  '}${ESC(f.etiqueta)}</text>`
      + `<text x="${colX[1]}" y="${y}" style="${st}">${ESC(f.coreLiteral)}</text>`
      + `<text x="${colX[2]}" y="${y}" style="${st}">${ESC(f.holeLiteral)}</text>`
      + `<text x="${colX[3]}" y="${y}" style="${st}">${ESC(f.rateLiteral)}</text>`);
    y += 16.5;
  }
  y += 6;
  const filaSel = sel.fila;
  const okTabla = !sinDispositivo && sel.cumpleCore && sel.cumpleHole !== false && sel.cumpleCotaExtra !== false;
  if (sinDispositivo) {
    linea(`✗ el núcleo va MACIZO: NO lleva el dispositivo que pide la Tabla 9.3 (${filaSel?.etiqueta})`, 'mal', 15.5);
    lineaSm('§9.2.7 Fig 9.11: "The source of cooling is at the base of the core, and heat originates from the plastic all along the height"');
  } else {
    linea(`✓ Ø núcleo ${o.coreDiaMm} · Ø barreno ${rB > 0 ? boreDia.toFixed(1) : 'N/A'} ⇒ ${filaSel?.etiqueta ?? 'FUERA DE TABLA'} ${filaSel?.seccion ?? ''}`,
      okTabla ? 'ok' : 'mal', 15.5);
  }
  if (sel.candidatos.length > 1) lineaSm(`la tabla admite ${sel.candidatos.length} filas (${sel.candidatos.map((k2) => k2.etiqueta).join(', ')}); desempata ${sel.method === 'baffle' ? '§9.3.5.2 "clearly preferred"' : 'la columna de tasa'}`);
  for (const m2 of sel.mensajes.filter((t) => !t.startsWith('Tabla 9.3 admite') && !(sinDispositivo && t.startsWith('Ø de barreno'))).slice(0, 1)) lineaSm(m2, 'warn');
  if (filaSel) lineaSm(filaSel.cotas[0]);
  y += 5;

  // bloque térmico
  der.push(`<line x1="${RX}" y1="${y - 8}" x2="${RX + RW}" y2="${y - 8}" stroke="#2c3a50" stroke-width="1"/>`);
  der.push(`<text x="${RX}" y="${y + 5}" class="cita">FLUJO DE CALOR — V9.3 (§9.2.6) · V9.18 (§9.3.6)</text>`); y += 22;
  if (!c) {
    linea('SIN CABLEAR — no se resolvió el campo: no hay glifos, ni reparto radial/axial, ni ΔT.', 'warn');
    lineaSm('Sin medición no hay veredicto: este bloque NO cuenta como cumplido.');
    y += 4;
  } else {
    const tot = Math.max(1e-9, c.qBarrenoW + c.qBaseW + c.qCavidadW);
    const pct = (v: number) => `${(100 * v / tot).toFixed(0)}%`;
    linea(`Q̇ del disparo (Eq 9.10) ${F(c.opts.qTotalW, 0)} W ⇒ barreno ${F(c.qBarrenoW, 0)} W ${pct(c.qBarrenoW)} · base ${F(c.qBaseW, 0)} W ${pct(c.qBaseW)} · cavidad ${F(c.qCavidadW, 0)} W ${pct(c.qCavidadW)}`);
    lineaSm(`balance del solver: entra ${F(c.sol.potenciaEntra, 1)} = sale ${F(c.sol.potenciaSale, 1)} W (error ${(c.sol.errBalanceRel * 100).toExponential(1)} %)`);
    const radial = c.dominante === 'radial';
    linea(`${radial ? '◀▶' : '▲▼'} dentro del núcleo domina el flujo ${c.dominante.toUpperCase()}: |q_r| ${F(c.qrMedio / 1000, 1)} vs |q_z| ${F(c.qzMedio / 1000, 1)} kW/m²`,
      radial ? 'lbl' : 'warn');
    lineaSm(radial
      ? 'V9.18 Fig 9.26 "a dominating radial heat flux at the surface of the pin" — el calor sale por el barreno'
      : 'V9.18 Fig 9.26 "heat transfer around the centerline of the pin towards the coolant at its base"');
    const aislante = c.fracNucleo < 0.15;
    linea(`${aislante ? '✗' : '·'} el núcleo se lleva ${(100 * c.fracNucleo).toFixed(0)} % y la cavidad ${(100 * c.fracCavidad).toFixed(0)} % (${F(c.fracCavidad / Math.max(1e-9, c.fracNucleo), 1)}×)${aislante ? ' ⇒ el núcleo AÍSLA §9.3.5.5' : ''}`,
      aislante ? 'mal' : 'lbl');
    lineaSm('§9.3.4: la cavidad conduce "twice the amount of heat" que el núcleo');
    const malGrad = Math.abs(c.dTBasePuntaC) > 6;
    linea(`${malGrad ? '✗' : '✓'} ΔT base→punta del núcleo ${F(c.dTBasePuntaC)} °C (§9.2.7 reprueba 6 °C) · punta ${F(c.tPuntaC)} °C`, malGrad ? 'mal' : 'ok');
    linea(`V9.3 flechas en la cara del núcleo: media ${F(c.supMediaWm2 / 1000, 1)} kW/m² · σ ${F(c.supSigmaWm2 / 1000, 1)} · CV ${F(c.supCV, 2)}`);
    lineaSm('el libro juzga "qué tan parejas se ven las flechas": el CV es esa métrica');
  }

  // §9.3.6 — el 4×
  if (o.material) {
    const t = tiempoUnSoloLado(o.paredPlasticoMm, o.material);
    linea(`§9.3.6 con 2h en Eq 9.5: ${F(t.dosLadosS, 1)} s por 2 lados → ${F(t.unLadoS, 1)} s por 1 = ${F(t.factor, 3)}×`, 'warn');
    lineaSm('un solo lado ⇒ "a four fold increase in the cooling time"');
  } else {
    linea('§9.3.6 (2h ⇒ 4× el ciclo): SIN CABLEAR — falta el material (α, T_melt, T_eject).', 'warn');
  }
  y += 2;

  // V12.14 — estructura
  der.push(`<line x1="${RX}" y1="${y - 7}" x2="${RX + RW}" y2="${y - 7}" stroke="#2c3a50" stroke-width="1"/>`);
  der.push(`<text x="${RX}" y="${y + 6}" class="cita">V12.14 — CARGA DEL INSERTO DE NÚCLEO (§12.2.7)</text>`); y += 23;
  let cd: CoreDesign | null = null;
  let fueraDeRango = false;
  if (o.estructura) {
    cd = designCore({
      meltPressureMPa: o.estructura.meltPressureMPa,
      phiOuterMm: o.coreDiaMm, phiInnerMm: boreDia, heightMm: o.coreHeightMm,
      metalKey: o.estructura.metalKey, interlocked: o.estructura.interlocked,
    });
    // el literal va SOLO en su renglón: partido en dos <text> deja de ser citable
    lineaSm('supuesto conservador: "the cooling insert provides no support"');
    lineaSm('— y el dibujo lo hace PARECER que sostiene: no le creas a la imagen');
    // El libro NO pone un límite numérico a la deflexión (V12.14: "el desplazamiento
    // del núcleo SÍ se ve"). Lo que sí se puede juzgar sin inventar cota es la
    // VALIDEZ del propio modelo: Eq 12.25 es teoría de vigas de deflexión pequeña,
    // y δ ≥ Ø_núcleo la deja fuera de rango. Eso se declara como extensión.
    fueraDeRango = cd.bending.deflMm >= o.coreDiaMm;
    linea(`${cd.ok ? '✓' : '✗'} hoop ${F(cd.hoop.sigmaMPa, 0)} · axial ${F(cd.axial.sigmaMPa, 0)} MPa · Ø int máx ${F(cd.innerMaxMm.gobierna, 1)} mm (${cd.innerMaxMm.govBy}) · ${cd.metal}`,
      cd.ok ? 'ok' : 'mal');
    linea(`${fueraDeRango ? '✗' : '·'} δ_flex ${F(cd.bending.deflMm, 3)} mm${fueraDeRango ? ` ≥ Ø ${o.coreDiaMm} mm: Eq 12.25 (viga de deflexión pequeña) YA NO APLICA` : ''}`,
      fueraDeRango ? 'mal' : 'lbl');
    if (fueraDeRango) lineaSm('§12.3.3 la flexión es self-reinforcing · §12.15 interlock al lado fijo ⇒ δ a ~10 % · EXTENSIÓN DECLARADA: el libro no da límite de δ, éste es el rango de validez del modelo');
    if (boreDia > cd.innerMaxMm.gobierna) linea(`✗ CHOQUE DE SUBSISTEMAS: el barreno de la Tabla 9.3 (${boreDia.toFixed(1)} mm) rebasa el máximo estructural (${F(cd.innerMaxMm.gobierna, 1)} mm)`, 'mal');
  } else {
    linea('SIN CABLEAR — sin presión de fundido no hay hoop, ni axial, ni Ø interno máximo.', 'warn');
  }

  // ── VEREDICTO ───────────────────────────────────────────────────────────
  const vered: string[] = [];
  vered.push(okTabla ? `✓ dispositivo correcto por Tabla 9.3: ${filaSel?.etiqueta}`
    : sinDispositivo ? `✗ SIN DISPOSITIVO — la Tabla 9.3 pide ${filaSel?.etiqueta}` : `✗ el dispositivo NO cumple la Tabla 9.3`);
  if (c) vered.push(`flujo ${c.dominante}`); else vered.push('campo SIN CABLEAR');
  if (cd) vered.push(fueraDeRango ? 'δ del núcleo FUERA del rango lineal §12.3.3'
    : cd.ok ? 'estructura OK §12.3' : 'estructura FUERA de límite §12.3');
  else vered.push('estructura SIN CABLEAR');
  const todoOk = okTabla && !!c && (!!cd && cd.ok && !fueraDeRango);

  // pie: se ENVUELVE al ancho de la lámina — antes se salía del cuadro y la
  // declaración de extensión quedaba cortada a media palabra
  const pieTxt = [
    prop.extension,
    c ? `campo axisimétrico ${c.sol.m.nr}×${c.sol.m.nz} celdas · conductancia radial ln(r₂/r₁)/(2πkΔz) · ${c.sol.iters} iteraciones CG · balance ${(c.sol.errBalanceRel * 100).toExponential(1)} %`
      : 'campo térmico SIN CABLEAR',
  ].flatMap((t) => parte(t, 10.5, W - 2 * PAD));
  const pie = pieTxt.map((t, i) => `<text class="lblSm" x="${PAD}" y="${H - 10 - (pieTxt.length - 1 - i) * 13}">${ESC(t)}</text>`).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">SECCIÓN DEL INSERTO DE NÚCLEO · dispositivo de enfriamiento</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§9.3.5 Tabla 9.3 (Fig 9.20-9.25) · §9.3.6 Fig 9.26-9.27 · §9.2.6 Fig 9.6 · §12.2.7</text>
<text class="lblSm" x="${PAD}" y="92">gris = acero · ámbar oscuro = plástico · azul = refrigerante · FLECHAS: largo ∝ magnitud del flujo (V9.3) — AZUL = radial, ÁMBAR = axial (V9.18)</text>
${bandas.join('')}
${disp.join('')}
${glifos.join('')}
${cotas.join('')}
${der.join('')}
<text class="${todoOk ? 'ok' : 'warn'}" style="font:700 13px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 16 - pieTxt.length * 13}">${ESC(vered.join('  ·  '))}</text>
${pie}
</svg>`;

  return {
    id: 'nucleo-enfriamiento',
    titulo: `Núcleo esbelto y su enfriamiento — ${o.nombre}`,
    cita: '§9.3.5 Tabla 9.3 · §9.3.6 · §9.2.6 · §12.2.7',
    queMirar: 'Primero la TABLA: ¿el dispositivo dibujado es el que le toca al Ø del núcleo y al Ø del barreno? '
      + 'Luego las FLECHAS dentro del núcleo: si son azules y apuntan al barreno, el calor sale por el centro (bien); '
      + 'si son ámbar y bajan por el cuerpo, el núcleo está haciendo de conductor axial — y §9.3.5.5 avisa que con L/Ø alto '
      + '"the core pins … act primarily as insulators", lo que manda el enfriamiento a un solo lado y CUADRUPLICA el ciclo (§9.3.6). '
      + 'Y no le creas al dibujo en lo estructural: V12.14 exige suponer que el inserto de enfriamiento NO sostiene el núcleo.',
    svg,
  };
}
