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
import type { MeltMaterial } from './filling';
import { pressureDropSegment } from './filling';

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
  /** ocupación fraccional por vóxel (verdad sub-vóxel) — pesa la CAPACIDAD */
  ocupacion?: Float32Array;
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
      if (cavity[u] && tAxis[u] === ax) { const ra = find(t), rb = find(u); if (ra !== rb) uf[rb] = ra; }
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
  let volTotal = 0;
  const mob = (t: number) => { const h = Math.max(0.05, thicknessMm[t]); return (h * h) / (12 * eta); };
  for (let t = 0; t < N; t++) if (cavity[t]) {
    const occ = o.ocupacion ? Math.max(1 / 9, Math.min(1, o.ocupacion[t])) : 1;
    cap[nodeOf[t]] += c3 * occ; volTotal += c3 * occ;
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
  const maxOuter = nPasos * 4 + 60;
  const pos = new Int32Array(M);

  for (let outer = 0; outer < maxOuter && volLleno < volTotal - 1e-9; outer++) {
    pasos++;
    const act: number[] = [];
    pos.fill(-1);
    for (let q = 0; q < M; q++) if (filled[q]) { pos[q] = act.length; act.push(q); }
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
    b2[pos[gNode]] = Q;
    const Ax = (v: Float64Array, out: Float64Array) => {
      for (let q = 0; q < A; q++) {
        const i = act[q]; let acc = 0;
        for (let e = deg[i]; e < deg[i + 1]; e++) {
          const j = adjN[e], k = adjK[e];
          acc += filled[j] ? k * (v[q] - v[pos[j]]) : k * v[q];
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
      z[q] = r[q] / rowK[act[q]]; pcg[q] = z[q]; rho += r[q] * z[q];
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
        z[q] = r[q] / rowK[act[q]]; rho2 += r[q] * z[q];
      }
      const beta = rho2 / rho; rho = rho2;
      for (let q = 0; q < A; q++) pcg[q] = z[q] + beta * pcg[q];
    }
    for (let q = 0; q < A; q++) pPrev[act[q]] = x[q];

    const pInlet = x[pos[gNode]];
    if (pInlet > pMax) pMax = pInlet;
    serie.push({ tS: +tNow.toFixed(4), pMPa: +(pInlet / 1e6).toFixed(2), volPct: +(100 * volLleno / volTotal).toFixed(1) });
    if (pInlet > pLimit) { shortShot = true; break; }   // la máquina no da más

    // flujos hacia la frontera + AUDITORÍA
    const front: number[] = []; const F: number[] = [];
    const fIdx = new Int32Array(M).fill(-1);
    for (let q = 0; q < A; q++) {
      const i = act[q];
      for (let e = deg[i]; e < deg[i + 1]; e++) {
        const j = adjN[e];
        if (filled[j]) continue;
        const flujo = adjK[e] * x[q];                   // p_frontera = 0
        if (fIdx[j] < 0) { fIdx[j] = front.length; front.push(j); F.push(flujo); }
        else F[fIdx[j]] += flujo;
      }
    }
    if (!front.length) break;                           // lo alcanzable ya se llenó
    let sumF = 0;
    for (const fq of F) sumF += fq;
    const relErr = Math.abs(sumF - Q) / Q;
    if (relErr > conservMax) conservMax = relErr;

    // avance FAN: repartir un cuanto ΔV con los flujos congelados de este solve.
    // EL RELOJ ES DE VOLUMEN: la máquina bombea Q constante e incompresible, así que
    // t = V_colocado/Q EXACTO — independiente de que el reparto interno pierda el
    // flujo que debía redirigirse al anillo recién expuesto (medido en el disco:
    // el reloj por flujos se inflaba 40 % al saturarse la frontera; el de volumen
    // reproduce t(r) = πr²h/Q analítico). Los flujos deciden el ORDEN; la
    // conservación decide el TIEMPO.
    let dvRem = dVpaso;
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
      tNow = volLleno / Q;
      for (const j of nuevos) arrivalN[j] = tNow;
      dvRem -= sumFa * dt;
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
    nota: 'Hele-Shaw/FAN N1 con COLAPSO DEL ESPESOR (p uniforme en el hueco: super-nodos columna; ' +
      'Σ caras = h³/12η exacto). η newtoniana efectiva calibrada a Eq 5.22 en (H=pared, v=lazo §5.5.1). ' +
      'La colada (tubo) va como placas con h=⌀ EDT (~2.7× menos resistiva que Poiseuille tubo). ' +
      'Sin térmica: la capa congelada es N2.',
  };
}
