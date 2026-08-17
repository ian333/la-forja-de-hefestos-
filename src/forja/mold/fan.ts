/**
 * FAN / HELE-SHAW — el llenado como FÍSICA, no como heurística
 * (orden 2026-08-12-llenado-desde-el-operador)
 * ============================================================================
 * ian: "quiero una implementación mínima pero poderosa" — tras leer los papers del
 * Operador 𝔄. El método es el de PROCESO_CARAS (6 pasos): identificar la simetría,
 * rotar a su cara, dejar el canal residual como el único trabajo real, y AUDITAR
 * con el invariante. Aquí:
 *
 *  · La FÍSICA es Hele-Shaw (el estándar midplane de la industria desde Hieber-Shen
 *    1980): pieza delgada ⇒ la presión es CONSTANTE a través del espesor ⇒ el campo
 *    vive en el plano medio, ∇·(k∇p) = 0 con conductancia de lubricación k ∝ h³/12η.
 *  · EL COLAPSO DEL CANAL RÁPIDO: nuestro dominio son vóxeles 3D que SÍ resuelven el
 *    hueco (pared 2 mm a celda 1 = 2 capas). Tratar cada capa como celda FAN
 *    independiente es un ERROR MEDIDO (el oráculo 1D lo cazó: las capas se desfasan
 *    y la presión sale 1.7×, porque la frontera p=0 de la capa rezagada chupa flujo
 *    a lo largo de todo el camino). La verdad física — p uniforme en el espesor — se
 *    impone FUSIONANDO las celdas a lo largo del eje local de espesor (la corrida
 *    más corta de las 3 direcciones) en SUPER-NODOS columna. La suma de las caras
 *    celda a celda reproduce EXACTA la conductancia continua: Σ (h²/12η)·c sobre las
 *    h/c capas = h³/12η por unidad de ancho. El canal simétrico se colapsa; el
 *    trabajo queda solo en el residual — el patrón del operador, literal.
 *  · El AVANCE es FAN (Flow Analysis Network, Tadmor 1974 — el ancestro directo de
 *    Moldflow): nodos llenos (presión) / frontera (p=0, acumulan flujo) / vacíos.
 *    El tiempo de llegada REAL queda grabado — ése es el `frente` universal.
 *  · La VISCOSIDAD es Newtoniana EFECTIVA calibrada a la Eq 5.22 del libro en el
 *    punto de operación (H = pared, v = la del lazo Cross-WLF §5.5.1). Kazmer §5.6
 *    avala el régimen; el power-law no lineal es N2 (cambia la conductancia, no la
 *    arquitectura).
 *  · La AUDITORÍA (paso 6, obligatorio): en cada paso, Σ flujos al frente = Q de la
 *    máquina — el Parseval discreto. Si el solver no conserva, no es evidencia.
 *
 * Lo que este nivel deja fuera y DECLARA (no esconde):
 *  · el bebedero es un TUBO y aquí se modela como placas con h = ⌀ local (EDT):
 *    Poiseuille tubo resiste 32ηLv/D² vs placas 12ηLv/H² ⇒ la colada sale ~2.7×
 *    menos resistiva. Afecta el reparto colada/pieza, no el orden dentro de cada una.
 *  · sin térmica: el frente no se congela por frío (capa congelada = N2).
 *  · regiones BULK (las 3 corridas largas) se colapsan igual por su corrida mínima:
 *    ahí Hele-Shaw ya no aplica en rigor — igual que en todo midplane comercial.
 *
 * PURO: node-testeable, cero dependencias nuevas. El dominio entra por el
 * FlowField YA existente (measureFlowLength: voxelizador + espesor EDT + gate) o
 * por un campo SINTÉTICO (los oráculos del gate).
 */
import type { MeltMaterial, CrossWLF } from './filling';
import { pressureDropSegment, eta0CrossWLF } from './filling';

// ── N2 TÉRMICO (orden 2026-08-17-n2-termico) ─────────────────────────────────
// El fundido se CONGELA: cada cara del operador se estrangula por la edad térmica
// de sus nodos. Perfil 1D de la placa por SUPERPOSICIÓN DE IMÁGENES (erf):
//   T(z)/(Tm−Tc) = erf((h/2−z)/2√(ατ)) + erf((h/2+z)/2√(ατ)) − 1
// Da los DOS regímenes bien: piel ∝ √t temprana Y muerte del centro que coincide
// con el modo 1 (Eq 9.5 / Tabla 7.4 strip) a <1 % SIN compartir fórmula — por eso
// la Tabla 7.4 sirve de ORÁCULO genuino en el gate, no de espejo.
// El estrangulador tiene DOS factores físicos (medido en el diseño: la piel sola
// NO frena — h=3.175 congela el centro hasta ~13 s y el creep ya se fue a ~800):
//   f = (h_eff/h)³ · η₀(Tm)/η₀(T_centro)     [piel geométrica × Cross-WLF]
// La WLF cerca de T* EXPLOTA (η₀(132 °C)/η₀(238 °C) ≈ 5e4 en ABS): ése es el
// freno dominante. DECLARADO: sin convección del melt que pasa ni shear heating
// (Kazmer §7.3.4: por eso sus freeze son MÍNIMOS — mismo sesgo conservador);
// edad DE CELDA, no de parcela (en canal largo coinciden; cerca del gate congela
// de más — mismo lado conservador).

/** erf por Abramowitz-Stegun 7.1.26 (|err| ≤ 1.5e-7) */
export function erfAS(x: number): number {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

export interface TermicoFAN {
  TmeltC: number; TcoolC: number; TnoflowC: number;
  /** difusividad térmica del plástico (m²/s) — PLASTICOS_A.alpha */
  alphaM2S: number;
  /** Cross-WLF del material: el freno de viscosidad η₀(Tm)/η₀(T_centro) */
  cross: CrossWLF;
}

/** T_centro normalizada g₀(Fo) = 2·erf(1/(4√Fo)) − 1 (imágenes, placa) */
const g0De = (Fo: number) => 2 * erfAS(0.25 / Math.sqrt(Math.max(1e-12, Fo))) - 1;

/** Fo crítico: el CENTRO de la placa toca T_noflow (g₀ = R). Bisección. */
function foCritico(R: number): number {
  let lo = 1e-6, hi = 20;
  for (let it = 0; it < 80; it++) {
    const mid = 0.5 * (lo + hi);
    if (g0De(mid) > R) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Tiempo de CONGELAMIENTO del CENTRO de una placa de espesor hMm (s) — el
 *  criterio del SOLVER (muere el último carril líquido). Cruce del gate contra
 *  el modo 1 de línea central h²/(π²α)·ln((4/π)·R⁻¹): fórmula INDEPENDIENTE. */
export function tCongelaSlabS(hMm: number, o: { TmeltC: number; TcoolC: number; TnoflowC: number; alphaM2S: number }): number {
  const R = (o.TnoflowC - o.TcoolC) / (o.TmeltC - o.TcoolC);
  return foCritico(R) * (hMm / 1000) ** 2 / o.alphaM2S;
}

/** Tiempo a T MEDIA = T_noflow (s) — el CRITERIO DE LA TABLA 7.4 del libro
 *  (prefactor 8/π² = media del modo 1, no 4/π = centro). Con la MISMA física
 *  de imágenes-erf: el cruce contra gateFreezeStripS compara criterios IGUALES. */
export function tCongelaMediaSlabS(hMm: number, o: { TmeltC: number; TcoolC: number; TnoflowC: number; alphaM2S: number }): number {
  const R = (o.TnoflowC - o.TcoolC) / (o.TmeltC - o.TcoolC);
  const media = (Fo: number) => {                 // ∫g dζ numérico (64 muestras)
    const s2 = 2 * Math.sqrt(Math.max(1e-12, Fo));
    let acc = 0;
    for (let i = 0; i < 64; i++) {
      const z = (i + 0.5) / 128;                  // ζ ∈ (0, 0.5), simétrico
      acc += erfAS((0.5 - z) / s2) + erfAS((0.5 + z) / s2) - 1;
    }
    return acc / 64;
  };
  let lo = 1e-6, hi = 20;
  for (let it = 0; it < 80; it++) {
    const mid = 0.5 * (lo + hi);
    if (media(mid) > R) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi) * (hMm / 1000) ** 2 / o.alphaM2S;
}

/** LUT normalizada en Fo/FoC (el cociente R es del material): ζ*(Fo) — media
 *  anchura LÍQUIDA normalizada (h_eff = 2ζ*h) — y g₀(Fo) para T_centro. */
function lutTermica(R: number) {
  const NL = 256;
  const FoC = foCritico(R);
  const zeta = new Float64Array(NL), g0 = new Float64Array(NL);
  for (let i = 0; i < NL; i++) {
    const Fo = Math.max(1e-9, (FoC * i) / (NL - 1));
    const s2 = 2 * Math.sqrt(Fo);
    g0[i] = g0De(Fo);
    // g(ζ) decrece de centro a pared; congelado donde g < R ⇒ bisecar ζ*
    const g = (z: number) => erfAS((0.5 - z) / s2) + erfAS((0.5 + z) / s2) - 1;
    if (g(0) <= R) { zeta[i] = 0; continue; }
    let lo = 0, hi = 0.5;
    for (let it = 0; it < 40; it++) {
      const mid = 0.5 * (lo + hi);
      if (g(mid) > R) lo = mid; else hi = mid;
    }
    zeta[i] = 0.5 * (lo + hi);
  }
  return { NL, FoC, zeta, g0 };
}

/** η efectiva (Pa·s): la Newtoniana que reproduce EXACTAMENTE la ΔP de la Eq 5.22
 *  en el punto de operación (H, v̄). ΔP_newton = 12ηLv/H² ⇒ η = ΔP·H²/(12·L·v).
 *  L se cancela (ambas ΔP son lineales en L): se evalúa con L = 1 m. */
export function etaEfectiva(m: MeltMaterial, hMm: number, vMs: number): number {
  const H = hMm / 1000;
  return (pressureDropSegment(m, 1, H, vMs) * H * H) / (12 * vMs);
}

/** El subconjunto del FlowField que este motor necesita (duck-typed para que el
 *  gate fabrique dominios SINTÉTICOS con h analítica — los oráculos). */
export interface CampoFAN {
  nx: number; ny: number; nz: number; cellMm: number;
  cavity: Uint8Array;
  thicknessMm: Float32Array;
  gate: { i: number; j: number; k: number };
  volumeMm3: number;
  idx(i: number, j: number, k: number): number;
}

export interface LlenadoFAN {
  /** 0..1 por orden de LLEGADA REAL (t/tFill). −1 = fuera de cavidad o nunca llegó.
   *  MISMO contrato que llenadoNivel1.frente — la ranura universal. */
  frente: Float32Array;
  /** tiempo real de llegada por vóxel (s); −1 si no llegó */
  tArrivalS: Float32Array;
  tFillS: number;
  pMaxMPa: number;
  /** presión en la boquilla a lo largo del llenado (la curva de máquina) */
  pInletSerie: Array<{ tS: number; pMPa: number; volPct: number }>;
  /** paró porque p tocó el tope de la máquina: short shot FÍSICO */
  shortShot: boolean;
  /** quedó cavidad SIN camino desde la boquilla: tubería rota / aire atrapado */
  incompleto: boolean;
  volSinLlenarMm3: number;
  /** LA AUDITORÍA: max sobre pasos de |Σ flujos al frente − Q| / Q */
  conservacionMaxRel: number;
  /** campo de presión del ÚLTIMO solve (Pa), por vóxel — el oráculo radial lo lee */
  pFieldPa: Float32Array;
  /** super-nodos tras el colapso del espesor (diagnóstico) */
  nNodos: number;
  etaEffPaS: number;
  QmmS: number;
  pasos: number;
  /** la fase de PRESIÓN del switchover V/P, si se activó */
  fase2: { activada: boolean; tSwitchS: number; volFase2Mm3: number; qFinalFrac: number };
  /** N2: diagnóstico del freno térmico (solo si `termico` vino) */
  termico?: { FoC: number; nodosCongeladosFin: number; nodosLlenos: number };
  nota: string;
}

export function resolverLlenadoFAN(campo: CampoFAN, o: {
  material: MeltMaterial;
  /** velocidad de diseño del lazo §5.5.1 (calibra η_eff junto con wallMm) */
  vMs: number;
  wallMm: number;
  /** caudal de máquina (mm³/s); si falta: volumen del campo / fillTimeS */
  QmmS?: number;
  fillTimeS?: number;
  /** tope de presión de la máquina (MPa) — al tocarlo, el frente SE PARA */
  pLimitMPa?: number;
  /** pasos de volumen (resolución temporal del reloj) */
  nPasos?: number;
  /** tope de nodos completados por solve de presión (seguro anti-lotes); def. 64.
   *  MEDIDO: el asesino real de las torres es el candado de columna; este tope solo
   *  es seguro contra lotes patológicos (a 12 el dado tardaba 26 s; a 64, nada). */
  maxLlenadosPorSolve?: number;
  /** SOLO PARA EL CONTROL NEGATIVO del gate: apagar el candado de columna
   *  (reproduce las torres medidas). Jamás en producción. */
  candadoColumna?: boolean;
  /** SWITCHOVER V/P (orden switchover-vp): al tocar pLimit, en vez de morir en
   *  seco ('stop', default), rotar la boquilla a su variable CONJUGADA
   *  ('presion': Dirichlet p=P₀, el caudal responde y decae — Washburn L∝√t).
   *  El creep isotermo no sabe parar (eso es la térmica del N2): termina por
   *  tMaxS o por Q < qMinFrac·Q₀. */
  switchover?: { modo: 'stop' | 'presion'; tMaxS?: number; qMinFrac?: number };
  /** ocupación fraccional por vóxel (verdad sub-vóxel) — pesa la CAPACIDAD */
  ocupacion?: Float32Array;
  /** N2 TÉRMICO (opt-in): el estrangulador por cara — piel erf + freno WLF.
   *  Apagado ⇒ el camino isotermo de siempre, bit a bit. */
  termico?: TermicoFAN;
}): LlenadoFAN {
  const { nx, ny, nz, cellMm: c, cavity, thicknessMm } = campo;
  const N = nx * ny * nz;
  const eta = etaEfectiva(o.material, o.wallMm, o.vMs);
  const Q = o.QmmS ?? campo.volumeMm3 / Math.max(1e-6, o.fillTimeS ?? 1);
  const pLimit = (o.pLimitMPa ?? 140) * 1e6;
  const nPasos = o.nPasos ?? 160;
  const c3 = c * c * c;

  // ── FASE 0 · EL COLAPSO DEL ESPESOR ────────────────────────────────────
  // (a) corridas por eje (run-length en 3 barridos O(N)): la corrida MÁS CORTA de
  //     un vóxel es su dirección de espesor local.
  const runX = new Int32Array(N), runY = new Int32Array(N), runZ = new Int32Array(N);
  const sweep = (out: Int32Array, sA: number, nA: number, sB: number, nB: number, sC: number, nC: number) => {
    for (let a = 0; a < nA; a++) for (let b = 0; b < nB; b++) {
      let start = -1;
      for (let q = 0; q <= nC; q++) {
        const t = a * sA + b * sB + q * sC;
        const dentro = q < nC && cavity[t] === 1;
        if (dentro && start < 0) start = q;
        if (!dentro && start >= 0) {
          const len = q - start;
          for (let w = start; w < q; w++) out[a * sA + b * sB + w * sC] = len;
          start = -1;
        }
      }
    }
  };
  sweep(runX, nx, ny, nx * ny, nz, 1, nx);          // corridas a lo largo de x
  sweep(runY, 1, nx, nx * ny, nz, nx, ny);          // a lo largo de y
  sweep(runZ, 1, nx, nx, ny, nx * ny, nz);          // a lo largo de z
  // (b) union-find: fusionar SOLO a lo largo del eje de espesor, entre celdas que
  //     COINCIDEN en ese eje (p es uniforme a través del hueco — Hele-Shaw).
  const tAxis = new Int8Array(N).fill(-1);
  for (let t = 0; t < N; t++) if (cavity[t]) {
    const rx = runX[t], ry = runY[t], rz = runZ[t];
    tAxis[t] = rx <= ry && rx <= rz ? 0 : ry <= rz ? 1 : 2;
  }
  const uf = new Int32Array(N);
  const ufN = new Int32Array(N).fill(1);          // tamaño del grupo (candado físico)
  for (let t = 0; t < N; t++) uf[t] = t;
  const find = (a: number): number => { let r = a; while (uf[r] !== r) r = uf[r]; while (uf[a] !== r) { const n2 = uf[a]; uf[a] = r; a = n2; } return r; };
  const stepOf = [1, nx, nx * ny];
  const canStep = (t: number, ax: number, dir: number): boolean => {
    if (ax === 0) { const i = t % nx; return dir > 0 ? i < nx - 1 : i > 0; }
    if (ax === 1) { const j = Math.floor(t / nx) % ny; return dir > 0 ? j < ny - 1 : j > 0; }
    const k = Math.floor(t / (nx * ny)); return dir > 0 ? k < nz - 1 : k > 0;
  };
  for (let t = 0; t < N; t++) if (cavity[t]) {
    const ax = tAxis[t];
    if (canStep(t, ax, +1)) {
      const u = t + stepOf[ax];
      if (cavity[u] && tAxis[u] === ax) {
        const ra = find(t), rb = find(u);
        if (ra !== rb) {
          // CANDADO FÍSICO (orden la-probeta): la columna representa el HUECO local —
          // no puede medir más celdas que el espesor que colapsa (h/c, +1 de gracia).
          // Sin él, en esquinas/escalones del draft se formaban columnas de 3+ celdas
          // de alto que llegaban "de golpe" — las TORRES que ian vio en el video.
          const capCol = (o.candadoColumna ?? true)
            ? Math.max(2, Math.round(Math.max(thicknessMm[t], thicknessMm[u]) / c) + 1)
            : 1e9;
          if (ufN[ra] + ufN[rb] <= capCol) { uf[rb] = ra; ufN[ra] += ufN[rb]; }
        }
      }
    }
  }
  // (c) super-nodos: capacidad Σ, y adyacencia CSR con conductancia SUMADA cara a
  //     cara — la suma sobre las capas ES h³/12η por ancho c (el continuo exacto).
  const nodeOf = new Int32Array(N).fill(-1);
  const nodes: number[] = [];                        // raíz de cada nodo
  for (let t = 0; t < N; t++) if (cavity[t]) {
    const r = find(t);
    if (nodeOf[r] < 0) { nodeOf[r] = nodes.length; nodes.push(r); }
    nodeOf[t] = nodeOf[r];
  }
  const M = nodes.length;
  const cap = new Float64Array(M);
  const nodeHm = new Float64Array(M);              // h de la COLUMNA (m) — N2
  let volTotal = 0;
  const mob = (t: number) => { const h = Math.max(0.05, thicknessMm[t]); return (h * h) / (12 * eta); };
  for (let t = 0; t < N; t++) if (cavity[t]) {
    const occ = o.ocupacion ? Math.max(1 / 9, Math.min(1, o.ocupacion[t])) : 1;
    cap[nodeOf[t]] += c3 * occ; volTotal += c3 * occ;
    const hm = Math.max(0.05, thicknessMm[t]) / 1000;
    if (hm > nodeHm[nodeOf[t]]) nodeHm[nodeOf[t]] = hm;
  }
  // conductancias entre super-nodos (mapa disperso → CSR)
  const kMap = new Map<number, number>();
  const addK = (a: number, b: number, k: number) => {
    const key = a < b ? a * M + b : b * M + a;
    kMap.set(key, (kMap.get(key) ?? 0) + k);
  };
  for (let t = 0; t < N; t++) if (cavity[t]) {
    for (let ax = 0; ax < 3; ax++) {
      if (!canStep(t, ax, +1)) continue;
      const u = t + stepOf[ax];
      if (!cavity[u]) continue;
      const a = nodeOf[t], b = nodeOf[u];
      if (a !== b) addK(a, b, 0.5 * (mob(t) + mob(u)) * c);
    }
  }
  const deg = new Int32Array(M + 1);
  for (const key of kMap.keys()) { const a = Math.floor(key / M), b = key % M; deg[a + 1]++; deg[b + 1]++; }
  for (let q = 0; q < M; q++) deg[q + 1] += deg[q];
  const adjN = new Int32Array(deg[M]), adjK = new Float64Array(deg[M]);
  { const cur = deg.slice(0, M);
    for (const [key, k] of kMap) { const a = Math.floor(key / M), b = key % M;
      adjN[cur[a]] = b; adjK[cur[a]++] = k; adjN[cur[b]] = a; adjK[cur[b]++] = k; } }

  // diagonal del operador (Σ conductancias por nodo, ESTÁTICA): el precondicionador
  // Jacobi del CG. Sin él, el rango real de conductancias (bebedero ⌀8 vs pared 2 ⇒
  // movilidades 16×) estanca la convergencia — medido: conservación 9.4e-4 en el
  // dado real contra 1e-10 en los dominios sintéticos uniformes.
  const rowK = new Float64Array(M);
  for (let q = 0; q < M; q++) for (let e = deg[q]; e < deg[q + 1]; e++) rowK[q] += adjK[e];

  const gNode = nodeOf[campo.idx(campo.gate.i, campo.gate.j, campo.gate.k)];

  // ── N2: preparación del estrangulador térmico (solo si termico viene) ────
  const th = o.termico;
  const lut = th ? lutTermica((th.TnoflowC - th.TcoolC) / (th.TmeltC - th.TcoolC)) : null;
  const etaTm = th ? eta0CrossWLF(th.cross, th.TmeltC) : 0;
  const thrN = th ? new Float64Array(M) : null;    // 1 = caliente · 0 = CONGELADO
  const kThr = th ? new Float64Array(adjK.length) : null;
  const rowThr = th ? new Float64Array(M) : null;
  /** estrangulador del nodo a edad τ: (h_eff/h)³ · η₀(Tm)/η₀(T_centro).
   *  <1e-5 se trata CONGELADO (corte numérico declarado: flujo despreciable). */
  const throttleDe = (tauS: number, hM: number): number => {
    if (!th || !lut) return 1;
    const Fo = (th.alphaM2S * tauS) / (hM * hM);
    if (Fo >= lut.FoC) return 0;
    const x = (Fo / lut.FoC) * (lut.NL - 1);
    const i0 = Math.min(lut.NL - 2, Math.floor(x)), fx = x - i0;
    const zeta = lut.zeta[i0] * (1 - fx) + lut.zeta[i0 + 1] * fx;
    const g0 = lut.g0[i0] * (1 - fx) + lut.g0[i0 + 1] * fx;
    const Tcore = th.TcoolC + (th.TmeltC - th.TcoolC) * Math.min(1, g0);
    if (Tcore <= th.TnoflowC) return 0;
    const f = Math.pow(2 * zeta, 3) * (etaTm / eta0CrossWLF(th.cross, Tcore));
    return f < 1e-5 ? 0 : Math.min(1, f);
  };

  // ── FAN sobre super-nodos ──────────────────────────────────────────────
  const fill = new Float64Array(M);
  const filled = new Uint8Array(M);
  const arrivalN = new Float64Array(M).fill(-1);
  const pPrev = new Float64Array(M);

  let tNow = cap[gNode] / Q;
  fill[gNode] = 1; filled[gNode] = 1; arrivalN[gNode] = tNow;
  let volLleno = cap[gNode];

  let pMax = 0, conservMax = 0, shortShot = false, pasos = 0;
  const serie: Array<{ tS: number; pMPa: number; volPct: number }> = [];
  const dVpaso = volTotal / nPasos;
  // SWITCHOVER V/P: fase 1 = Q impuesto (fuente); fase 2 = P impuesto (Dirichlet)
  const modoSw = o.switchover?.modo ?? 'stop';
  const tMaxS = o.switchover?.tMaxS ?? Infinity;
  const qMin = (o.switchover?.qMinFrac ?? 0.01) * Q;
  let fase = 1, tSwitch = -1, volSwitch = 0, QinAct = Q;
  const maxOuter = nPasos * 4 + Math.ceil(M / 4) + 60 + (modoSw === 'presion' ? nPasos * 8 : 0);
  const pos = new Int32Array(M);

  for (let outer = 0; outer < maxOuter && volLleno < volTotal - 1e-9; outer++) {
    pasos++;
    // ── N2: el estrangulador de ESTE instante — edad de cada nodo lleno →
    //   thr ∈ [0,1] por nodo; cara = min de sus dos nodos; congelado (0) = PARED
    //   (kAct=0: la cara no fluye — no es el sumidero p=0 de la frontera).
    let kAct = adjK, rowAct = rowK;
    if (th && thrN && kThr && rowThr) {
      // EL SEGUNDO FRENO del N2 (medido en el diseño: la piel sola no alcanza —
      // a 69 MPa el creep rebasa la herramienta en 2.3 s): al reptar despacio el
      // power-law SUBE la viscosidad, η ∝ γ̇^(n−1). En canal ÚNICO γ̇ ∝ Q en
      // todas partes ⇒ factor GLOBAL (Q/Q₀)^(1−n) EXACTO (la espiral); al
      // ramificar es aproximado — DECLARADO. Fase 1 (Q impuesto): factor 1,
      // los llenados existentes no cambian. Picard rezagado (contracción, 1−n<1).
      const rateFac = fase === 2
        ? Math.pow(Math.min(1, Math.max(1e-4, QinAct / Q)), 1 - o.material.n) : 1;
      for (let q = 0; q < M; q++) {
        if (!filled[q]) { thrN[q] = 1; continue; }
        const tau = tNow - arrivalN[q];
        thrN[q] = tau <= 0 ? 1 : throttleDe(tau, nodeHm[q]);
      }
      rowThr.fill(0);
      for (let q = 0; q < M; q++) {
        for (let e = deg[q]; e < deg[q + 1]; e++) {
          const kEff = adjK[e] * Math.min(thrN[q], thrN[adjN[e]]) * rateFac;
          kThr[e] = kEff; rowThr[q] += kEff;
        }
      }
      kAct = kThr; rowAct = rowThr;
    }
    const act: number[] = [];
    pos.fill(-1);
    for (let q = 0; q < M; q++) {
      if (!filled[q] || (fase === 2 && q === gNode)) continue;
      // nodo CONGELADO o aislado por congelados: sin ecuación (fila cero) — fuera
      if (th && thrN && (thrN[q] <= 0 || rowAct[q] <= 0)) continue;
      pos[q] = act.length; act.push(q);
    }
    const A = act.length;

    // ¿queda FRONTERA? Si no, lo alcanzable ya se llenó — resolver aquí sería un
    // sistema SINGULAR (fuente Q sin salida: b∉range(A), CG diverge a 1e30 — medido
    // en el control del dominio roto). Se detecta ANTES de resolver.
    let hayFrontera = false;
    for (let q = 0; q < A && !hayFrontera; q++) {
      const i = act[q];
      for (let e = deg[i]; e < deg[i + 1]; e++) if (!filled[adjN[e]]) { hayFrontera = true; break; }
    }
    if (!hayFrontera) break;

    // CG matrix-free: Σ_j k(p_i − p_j) = Q·[i=gate] · p=0 en la frontera (no llenos)
    const x = new Float64Array(A), b2 = new Float64Array(A);
    for (let q = 0; q < A; q++) x[q] = pPrev[act[q]];
    if (fase === 1) {
      b2[pos[gNode]] = Q;
    } else {
      // LA FRONTERA ROTADA: la boquilla vale P₀ (Dirichlet) — sus vecinos lo
      // reciben por el vector b; el MISMO operador responde ahora con el caudal
      for (let e = deg[gNode]; e < deg[gNode + 1]; e++) {
        const j = adjN[e];
        if (pos[j] >= 0) b2[pos[j]] += kAct[e] * pLimit;
      }
    }
    const Ax = (v: Float64Array, out: Float64Array) => {
      for (let q = 0; q < A; q++) {
        const i = act[q]; let acc = 0;
        for (let e = deg[i]; e < deg[i + 1]; e++) {
          const j = adjN[e], k = kAct[e];
          // vecino con incógnita: diferencia; sin incógnita (frontera p=0 o la
          // boquilla-Dirichlet de fase 2, cuyo P₀ ya viaja en b): solo k·v
          acc += (filled[j] && pos[j] >= 0) ? k * (v[q] - v[pos[j]]) : k * v[q];
        }
        out[q] = acc;
      }
    };
    // PCG con Jacobi: z = r/diag — la diagonal es rowK (estática)
    const r = new Float64Array(A), z = new Float64Array(A), pcg = new Float64Array(A), Ap = new Float64Array(A);
    Ax(x, Ap);
    let rr = 0, rho = 0;
    for (let q = 0; q < A; q++) {
      r[q] = b2[q] - Ap[q]; rr += r[q] * r[q];
      z[q] = r[q] / rowAct[act[q]]; pcg[q] = z[q]; rho += r[q] * z[q];
    }
    const bNorm = Math.max(1e-30, Q * Q);
    for (let it = 0; it < 800 && rr / bNorm > 1e-18; it++) {
      Ax(pcg, Ap);
      let pAp = 0;
      for (let q = 0; q < A; q++) pAp += pcg[q] * Ap[q];
      if (pAp <= 0) break;                              // sin frontera: dominio cerrado
      const alpha = rho / pAp;
      rr = 0;
      let rho2 = 0;
      for (let q = 0; q < A; q++) {
        x[q] += alpha * pcg[q]; r[q] -= alpha * Ap[q];
        rr += r[q] * r[q];
        z[q] = r[q] / rowAct[act[q]]; rho2 += r[q] * z[q];
      }
      const beta = rho2 / rho; rho = rho2;
      for (let q = 0; q < A; q++) pcg[q] = z[q] + beta * pcg[q];
    }
    for (let q = 0; q < A; q++) pPrev[act[q]] = x[q];

    // Q_in de fase 2: se MIDE del solve (flujo que sale de la boquilla a P₀)
    if (fase === 2) {
      let qIn = 0;
      for (let e = deg[gNode]; e < deg[gNode + 1]; e++) {
        const j = adjN[e];
        const pj = (filled[j] && pos[j] >= 0) ? x[pos[j]] : 0;
        qIn += kAct[e] * (pLimit - pj);
      }
      QinAct = qIn;
      if (QinAct < qMin || tNow >= tMaxS) break;        // el creep ya no aporta / fin de protocolo
    }
    const pInlet = fase === 1 ? x[pos[gNode]] : pLimit;
    if (pInlet > pMax) pMax = pInlet;
    serie.push({ tS: +tNow.toFixed(4), pMPa: +(pInlet / 1e6).toFixed(2), volPct: +(100 * volLleno / volTotal).toFixed(1) });
    if (fase === 1 && pInlet > pLimit) {
      if (modoSw === 'presion') {
        // EL SWITCHOVER: la frontera rota a su variable conjugada. Mismo operador.
        fase = 2; tSwitch = tNow; volSwitch = volLleno;
        pPrev[gNode] = pLimit; pasos--;
        continue;                                       // re-resolver este paso en fase 2
      }
      shortShot = true; break;                          // la máquina no da más (modo stop)
    }

    // flujos hacia la frontera + AUDITORÍA
    const front: number[] = []; const F: number[] = [];
    const fIdx = new Int32Array(M).fill(-1);
    for (let q = 0; q < A; q++) {
      const i = act[q];
      for (let e = deg[i]; e < deg[i + 1]; e++) {
        const j = adjN[e];
        if (filled[j]) continue;
        const flujo = kAct[e] * x[q];                   // p_frontera = 0
        if (fIdx[j] < 0) { fIdx[j] = front.length; front.push(j); F.push(flujo); }
        else F[fIdx[j]] += flujo;
      }
    }
    if (fase === 2) {
      for (let e = deg[gNode]; e < deg[gNode + 1]; e++) {
        const j = adjN[e];
        if (filled[j]) continue;
        const flujo = kAct[e] * pLimit;
        if (fIdx[j] < 0) { fIdx[j] = front.length; front.push(j); F.push(flujo); }
        else F[fIdx[j]] += flujo;
      }
    }
    if (!front.length) break;                           // lo alcanzable ya se llenó
    let sumF = 0;
    for (const fq of F) sumF += fq;
    // N2: el frente existe pero YA NO LE LLEGA flujo — el canal murió congelado.
    if (th && sumF <= 1e-12) break;
    // AUDITORÍA: fase 1 contra el Q impuesto; fase 2 contra el Q MEDIDO en la
    // boquilla (ambos calculados del mismo solve: consistencia interna)
    const relErr = Math.abs(sumF - (fase === 1 ? Q : QinAct)) / Math.max(1e-9, fase === 1 ? Q : QinAct);
    if (relErr > conservMax) conservMax = relErr;

    // avance FAN: repartir un cuanto ΔV con los flujos congelados de este solve.
    // EL RELOJ ES DE VOLUMEN: la máquina bombea Q constante e incompresible, así que
    // t = V_colocado/Q EXACTO — independiente de que el reparto interno pierda el
    // flujo que debía redirigirse al anillo recién expuesto (medido en el disco:
    // el reloj por flujos se inflaba 40 % al saturarse la frontera; el de volumen
    // reproduce t(r) = πr²h/Q analítico). Los flujos deciden el ORDEN; la
    // conservación decide el TIEMPO.
    let dvRem = dVpaso;
    // el RELOJ de fase 2: volumen colocado / Q_in MEDIDO de ESTE solve — el mismo
    // principio del reloj de volumen (los flujos deciden el ORDEN, la conservación
    // el TIEMPO). Integrar dt por flujos re-creaba el bug del disco: la cola débil
    // del lote inflaba el tiempo ×9 (medido en el humo de Washburn).
    const tIni = tNow, volIni = volLleno;
    let llenadosSolve = 0;                        // CANDADO TEMPORAL (orden la-probeta)
    const tope = o.maxLlenadosPorSolve ?? 64;
    for (let inner = 0; inner < front.length + 4 && dvRem > 1e-12; inner++) {
      let sumFa = 0;
      for (let q = 0; q < front.length; q++) if (fill[front[q]] < 1 && F[q] > 0) sumFa += F[q];
      if (sumFa <= 0) break;
      let dt = dvRem / sumFa;
      for (let q = 0; q < front.length; q++) {
        const j = front[q];
        if (fill[j] >= 1 || F[q] <= 0) continue;
        dt = Math.min(dt, (cap[j] * (1 - fill[j])) / F[q]);
      }
      const nuevos: number[] = [];
      for (let q = 0; q < front.length; q++) {
        const j = front[q];
        if (fill[j] >= 1 || F[q] <= 0) continue;
        fill[j] += (F[q] * dt) / cap[j];
        volLleno += F[q] * dt;
        if (fill[j] >= 1 - 1e-9) { fill[j] = 1; filled[j] = 1; nuevos.push(j); }
      }
      if (fase === 1) tNow = volLleno / Q;              // reloj de VOLUMEN (Q fijo)
      else tNow = tIni + (volLleno - volIni) / QinAct;  // volumen / Q_in del solve
      for (const j of nuevos) arrivalN[j] = tNow;
      dvRem -= sumFa * dt;
      llenadosSolve += nuevos.length;
      // demasiados nodos completados con flujos CONGELADOS = llegadas empaquetadas
      // (torres). Se corta y se re-resuelve la presión con la frontera fresca.
      if (llenadosSolve >= tope) break;
    }
  }

  // ── salida por VÓXEL: la MISMA ranura que llenadoNivel1 ────────────────
  const tFill = Math.max(1e-9, tNow);
  const frente = new Float32Array(N).fill(-1);
  const tArr = new Float32Array(N).fill(-1);
  const pField = new Float32Array(N);
  let volSin = 0;
  for (let t = 0; t < N; t++) if (cavity[t]) {
    const nq = nodeOf[t];
    if (arrivalN[nq] >= 0) { tArr[t] = arrivalN[nq]; frente[t] = arrivalN[nq] / tFill; }
    else volSin += c3 * (o.ocupacion ? Math.max(1 / 9, Math.min(1, o.ocupacion[t])) : 1);
    if (filled[nq]) pField[t] = pPrev[nq];
  }

  return {
    frente, tArrivalS: tArr, tFillS: +tFill.toFixed(4),
    pMaxMPa: +(pMax / 1e6).toFixed(2), pInletSerie: serie,
    shortShot, incompleto: !shortShot && volSin > c3,
    volSinLlenarMm3: +volSin.toFixed(1),
    conservacionMaxRel: conservMax,
    pFieldPa: pField, nNodos: M,
    etaEffPaS: +eta.toFixed(2), QmmS: +Q.toFixed(1), pasos,
    fase2: {
      activada: fase === 2,
      tSwitchS: +Math.max(0, tSwitch).toFixed(4),
      volFase2Mm3: fase === 2 ? +(volLleno - volSwitch).toFixed(1) : 0,
      qFinalFrac: fase === 2 ? +(QinAct / Q).toFixed(4) : 1,
    },
    termico: th && lut ? (() => {
      let cong = 0, llen = 0;
      for (let q = 0; q < M; q++) if (filled[q]) {
        llen++;
        const tau = tNow - arrivalN[q];
        if (tau > 0 && throttleDe(tau, nodeHm[q]) <= 0) cong++;
      }
      return { FoC: +lut.FoC.toFixed(4), nodosCongeladosFin: cong, nodosLlenos: llen };
    })() : undefined,
    nota: 'Hele-Shaw/FAN N1 con COLAPSO DEL ESPESOR (p uniforme en el hueco: super-nodos columna; ' +
      'Σ caras = h³/12η exacto). η newtoniana efectiva calibrada a Eq 5.22 en (H=pared, v=lazo §5.5.1). ' +
      'La colada (tubo) va como placas con h=⌀ EDT (~2.7× menos resistiva que Poiseuille tubo). ' +
      (th ? 'N2 TÉRMICO ACTIVO: piel erf (imágenes) × freno WLF por edad de celda — sin convección ni shear heating (sesgo conservador, Kazmer §7.3.4).'
        : 'Sin térmica: la capa congelada es N2.'),
  };
}
