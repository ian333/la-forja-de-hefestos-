/**
 * collision.ts — SOLVER DE COLISIONES del ensamble (Fase 1). "Ver si chocan =
 * ecuaciones resolviéndose": para CADA par de sólidos, mide el traslape 3D y lo
 * clasifica contra el AJUSTE PERMITIDO (fits.ts) A TEMPERATURA (materials.ts).
 *   · traslape en una interfaz ESPERADA (pin↔barreno, inserto↔bolsa, placa entre
 *     rieles) con su fit correcto → OK.
 *   · traslape donde NO debe haberlo (placa↔placa, o par desconocido) → COLISIÓN.
 *   · un fit deslizante que se cierra en caliente → AGARROTA (aviso térmico).
 * Sustituye la revisión a ojo por números. Generaliza a mecanismos (mismos fits).
 */
import { fitAtTemp } from './fits';
import { material } from './materials';

export interface AsmPart {
  role: string; name?: string;
  min: [number, number, number]; max: [number, number, number];
  material?: string;
}

export type Interface =
  | 'pin-en-placa' | 'pilar-holgura' | 'inserto-interf' | 'placa-entre-rieles'
  | 'guia-buje' | 'pieza-cavidad' | 'agua-canal' | 'tornillo-placa'
  | 'placa-apilada' | 'desconocido';

const PLATE = /^(support|B|A|clamp|bottom|ejector|ejector-ret)$/;
const EJP = /^(ejector|ejector-ret)$/;
const PIN = /^(pines|pines-retorno)$/;

/** Clasifica el par de roles → qué interfaz es y si el traslape es ESPERADO. */
export function classifyInterface(a: string, b: string): { iface: Interface; expected: boolean } {
  const both = (r1: RegExp, r2: RegExp) => (r1.test(a) && r2.test(b)) || (r1.test(b) && r2.test(a));
  if (both(PIN, PLATE)) return { iface: 'pin-en-placa', expected: true };        // pin cruza con holgura 0.13
  if (both(/pilares/, EJP)) return { iface: 'pilar-holgura', expected: true };    // la expulsora libra el pilar
  if (both(/inserto/, /^(A|B)$/)) return { iface: 'inserto-interf', expected: true }; // ajuste de interferencia
  if (both(/rieles/, EJP)) return { iface: 'placa-entre-rieles', expected: true };    // FALSO POSITIVO del bbox
  if (both(/guias/, /bujes/)) return { iface: 'guia-buje', expected: true };
  if (both(/pieza/, /inserto|^(A|B)$|colada/)) return { iface: 'pieza-cavidad', expected: true };
  if (both(/inserto/, /inserto/)) return { iface: 'pieza-cavidad', expected: true };       // macho↔hembra: la PIEZA (pared) va en medio
  if (both(/colada/, /inserto|anillo|clamp|^A$/)) return { iface: 'pieza-cavidad', expected: true }; // el sprue alimenta la pieza
  if (both(PIN, /inserto/)) return { iface: 'pin-en-placa', expected: true };               // el pin llega a la cara del macho (partición)
  if (both(/agua/, PLATE)) return { iface: 'agua-canal', expected: true };
  if (both(/tornillos/, PLATE)) return { iface: 'tornillo-placa', expected: true };
  if (PLATE.test(a) && PLATE.test(b)) return { iface: 'placa-apilada', expected: false }; // NO deben solaparse
  // Los que quedan (pin↔agua, pin↔rieles/pilares, agua↔inserto, rieles↔pilares) son
  // traslapes de BBOX cuyo veredicto REAL exige intersección de sólidos (Fase 1b).
  return { iface: 'desconocido', expected: false };
}

const overlap3 = (a: AsmPart, b: AsmPart, eps = 0.4) => {
  const ov = (k: number) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]);
  const o = [ov(0), ov(1), ov(2)];
  return o.every((v) => v > eps) ? { x: +o[0].toFixed(1), y: +o[1].toFixed(1), z: +o[2].toFixed(1) } : null;
};

export interface Pair { a: string; b: string; iface: Interface; overlapMm: { x: number; y: number; z: number } }
export interface CollisionReport {
  moldTempC: number;
  nCollisions: number; nExpected: number; nNeedsSolid: number;
  ok: boolean;                 // sin colisiones REALES (placa↔placa)
  collisions: Pair[];          // traslapes que NO deben existir (placas apiladas) → error
  needsSolidCheck: Pair[];     // bbox ambiguo → veredicto exige intersección de sólidos (Fase 1b)
  expected: Array<{ a: string; b: string; iface: Interface }>;   // interfaces con su fit correcto
  thermalFits: ReturnType<typeof standardThermalFits>;
}

/** Analiza el ensamble: cada traslape 3D → interfaz ESPERADA (fit correcto), COLISIÓN
 *  real (placa↔placa), o AMBIGUO (bbox se traslapa pero hay que intersectar sólidos). */
export function analyzeAssembly(parts: AsmPart[], opts: { moldTempC?: number } = {}): CollisionReport {
  const T = opts.moldTempC ?? 60;
  const collisions: Pair[] = [], needsSolid: Pair[] = [];
  const expected: CollisionReport['expected'] = [];
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const ov = overlap3(parts[i], parts[j]); if (!ov) continue;
    const { iface, expected: exp } = classifyInterface(parts[i].role, parts[j].role);
    const rec: Pair = { a: parts[i].role, b: parts[j].role, iface, overlapMm: ov };
    if (exp) expected.push({ a: rec.a, b: rec.b, iface });
    else if (iface === 'placa-apilada') collisions.push(rec);   // placas que comparten Z = imposible
    else needsSolid.push(rec);                                   // bbox ambiguo → Fase 1b
  }
  return {
    moldTempC: T, nCollisions: collisions.length, nExpected: expected.length, nNeedsSolid: needsSolid.length,
    ok: collisions.length === 0, collisions, needsSolidCheck: needsSolid, expected,
    thermalFits: standardThermalFits(T),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  FASE 1b — INTERSECCIÓN REAL DE SÓLIDOS (sin asumir nada: la geometría decide).
//  "Ver si chocan = ecuaciones": ray-casting punto-en-malla. Un punto interior de A
//  que cae DENTRO del sólido de B = los dos materiales ocupan el mismo lugar =
//  colisión REAL. Un pin en su barreno de holgura NO cuenta (el punto cae en el
//  hueco, no en el acero). Esto distingue "pin en agujero" (OK) de "pin en macizo".
// ════════════════════════════════════════════════════════════════════════════
export interface Mesh { positions: Float32Array | number[]; indices: Uint32Array | number[]; }

/** ¿El rayo +X desde P cruza el triángulo? (Möller-Trumbore con dir=[1,0,0], t>0). */
function rayXHitsTri(px: number, py: number, pz: number,
  ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): boolean {
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
  const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  // h = dir × e2 = (0, -e2z, e2y);  a = e1·h
  const a = e1y * -e2z + e1z * e2y;
  if (a > -1e-9 && a < 1e-9) return false;
  const f = 1 / a;
  const sx = px - ax, sy = py - ay, sz = pz - az;
  const u = f * (sy * -e2z + sz * e2y);
  if (u < 0 || u > 1) return false;
  // q = s × e1
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = f * qx;                            // dir·q = qx
  if (v < 0 || u + v > 1) return false;
  const t = f * (e2x * qx + e2y * qy + e2z * qz);
  return t > 1e-6;                             // en frente (+X)
}

/** ¿El punto está DENTRO del sólido de la malla? (paridad de cruces del rayo +X). */
export function pointInsideMesh(px: number, py: number, pz: number, m: Mesh): boolean {
  const P = m.positions, I = m.indices; let cross = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    // RECHAZO RÁPIDO por eje (el rayo es +X): un triángulo entero arriba/abajo del rayo
    // en Y o Z, o entero DETRÁS en X, no puede cruzarlo. Corta ~90% de los Möller-Trumbore
    // — sin esto, mallas de 40k+ tris hacían el estudio de minutos (colgó el shot).
    const ay = P[a + 1], by = P[b + 1], cy = P[c + 1];
    if ((ay > py && by > py && cy > py) || (ay < py && by < py && cy < py)) continue;
    const az = P[a + 2], bz = P[b + 2], cz = P[c + 2];
    if ((az > pz && bz > pz && cz > pz) || (az < pz && bz < pz && cz < pz)) continue;
    if (P[a] < px && P[b] < px && P[c] < px) continue;
    if (rayXHitsTri(px, py, pz, P[a], ay, az, P[b], by, bz, P[c], cy, cz)) cross++;
  }
  return (cross & 1) === 1;
}

/** Interferencia REAL entre dos mallas: cuántos puntos INTERIORES de A caen dentro de
 *  B (y viceversa). Muestrea centroides de triángulo escalonados hacia adentro (−normal).
 *  step = subMuestreo de triángulos (1=todos). Devuelve nº de puntos interpenetrados. */
export function meshesInterfere(A: Mesh, B: Mesh, opts: { step?: number; deltaMm?: number } = {}): { pointsInside: number; samples: number; interfere: boolean } {
  const step = opts.step ?? 1, dz = opts.deltaMm ?? 0.4;
  const bboxOf = (m: Mesh) => { const P = m.positions; const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < mn[k]) mn[k] = P[i + k]; if (P[i + k] > mx[k]) mx[k] = P[i + k]; } return { mn, mx }; };
  const inBox = (x: number, y: number, z: number, bb: { mn: number[]; mx: number[] }) => x >= bb.mn[0] - 0.5 && x <= bb.mx[0] + 0.5 && y >= bb.mn[1] - 0.5 && y <= bb.mx[1] + 0.5 && z >= bb.mn[2] - 0.5 && z <= bb.mx[2] + 0.5;
  const test = (src: Mesh, dst: Mesh, dstBox: { mn: number[]; mx: number[] }) => {
    const P = src.positions, I = src.indices; let inside = 0, samples = 0;
    for (let t = 0; t < I.length; t += 3 * step) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const cx = (P[a] + P[b] + P[c]) / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      // normal del triángulo (para escalonar hacia adentro)
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const ix = cx - dz * nx, iy = cy - dz * ny, iz = cz - dz * nz;   // punto interior
      if (!inBox(ix, iy, iz, dstBox)) continue;
      samples++;
      if (pointInsideMesh(ix, iy, iz, dst)) inside++;
    }
    return { inside, samples };
  };
  const bbB = bboxOf(B), bbA = bboxOf(A);
  const ab = test(A, B, bbB), ba = test(B, A, bbA);
  const pointsInside = ab.inside + ba.inside;
  return { pointsInside, samples: ab.samples + ba.samples, interfere: pointsInside >= 3 };
}

/** Distancia² de un punto al triángulo (para PROFUNDIDAD DE PENETRACIÓN: qué tan
 *  ADENTRO del acero del vecino está un punto interior = cuánto se traslapan de verdad). */
function ptTriDist2(px: number, py: number, pz: number,
  ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): number {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return apx * apx + apy * apy + apz * apz;
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return bpx * bpx + bpy * bpy + bpz * bpz;
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return cpx * cpx + cpy * cpy + cpz * cpz;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); const dx = apx - v * abx, dy = apy - v * aby, dz = apz - v * abz; return dx * dx + dy * dy + dz * dz; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); const dx = apx - w * acx, dy = apy - w * acy, dz = apz - w * acz; return dx * dx + dy * dy + dz * dz; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); const dx = bpx + w * (cx - bx), dy = bpy + w * (cy - by), dz = bpz + w * (cz - bz); return dx * dx + dy * dy + dz * dz; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  const dx = apx - (v * abx + w * acx), dy = apy - (v * aby + w * acy), dz = apz - (v * abz + w * acz);
  return dx * dx + dy * dy + dz * dz;
}

/** PROFUNDIDAD DE PENETRACIÓN máxima (mm): para cada punto interior de A que cae DENTRO
 *  del sólido de B, su distancia a la SUPERFICIE de B = cuánto se enterró. El máximo dice
 *  si es CONTACTO/press-fit (≈0, micras) o COLISIÓN real (mm de acero compartido). Esta es
 *  la "fórmula sencilla" del estudio de contacto: penetración vs ajuste permitido (fits.ts). */
export function meshPenetration(A: Mesh, B: Mesh, opts: { step?: number; deltaMm?: number } = {}): number {
  const step = opts.step ?? 1, dz = opts.deltaMm ?? 0.4;
  const bboxOf = (m: Mesh) => { const P = m.positions; const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < mn[k]) mn[k] = P[i + k]; if (P[i + k] > mx[k]) mx[k] = P[i + k]; } return { mn, mx }; };
  const nearestSurf = (px: number, py: number, pz: number, dst: Mesh): number => {
    const P = dst.positions, I = dst.indices; let best = 1e18;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const d = ptTriDist2(px, py, pz, P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
  const scan = (src: Mesh, dst: Mesh): number => {
    const P = src.positions, I = src.indices; let maxPen = 0;
    for (let t = 0; t < I.length; t += 3 * step) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const cx = (P[a] + P[b] + P[c]) / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const ix = cx - dz * nx, iy = cy - dz * ny, iz = cz - dz * nz;
      if (pointInsideMesh(ix, iy, iz, dst)) { const p = nearestSurf(ix, iy, iz, dst); if (p > maxPen) maxPen = p; }
    }
    return maxPen;
  };
  return Math.max(scan(A, B), scan(B, A));
}

/** ESTUDIO DE CONTACTO sobre la FIGURA REAL (no cajas): un tornillo se prueba como
 *  tornillo, un buje como buje, un flan como flan — `pointInsideMesh` usa los triángulos
 *  reales. Muestrea el VOLUMEN 3D donde los dos sólidos PODRÍAN tocarse (la bbox es solo
 *  el límite de búsqueda, NUNCA la prueba) y reporta:
 *   · volMm3 = acero que las dos figuras COMPARTEN (dos sólidos jamás comparten volumen →
 *     >0 = colisión real; el press-fit real es una cáscara de micras ≈ 0 mm³).
 *   · penMm  = lo más HONDO que una figura se enterró en la otra (min-escape del punto más
 *     profundo — la distancia real para separarlas).
 *  Rejilla ADAPTATIVA (celda por volumen de búsqueda) + puntos de superficie escalonados
 *  hacia adentro (cachan traslapes anchos-y-delgados que la rejilla saltaría). */
export function meshContact(A: Mesh, B: Mesh, opts: { maxPts?: number; deltaMm?: number; collect?: boolean } = {}): { volMm3: number; penMm: number; pointsInside: number; samples: number; cloud?: number[] } {
  const maxPts = opts.maxPts ?? 3000, dstep = opts.deltaMm ?? 0.4;
  const cloud: number[] | null = opts.collect ? [] : null;
  const bboxOf = (m: Mesh) => { const P = m.positions; const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < mn[k]) mn[k] = P[i + k]; if (P[i + k] > mx[k]) mx[k] = P[i + k]; } return { mn, mx }; };
  const bbA = bboxOf(A), bbB = bboxOf(B);
  const omn = [0, 0, 0], omx = [0, 0, 0];
  for (let k = 0; k < 3; k++) { omn[k] = Math.max(bbA.mn[k], bbB.mn[k]); omx[k] = Math.min(bbA.mx[k], bbB.mx[k]); if (omx[k] - omn[k] <= 0) return { volMm3: 0, penMm: 0, pointsInside: 0, samples: 0 }; }
  const dx = omx[0] - omn[0], dy = omx[1] - omn[1], dz = omx[2] - omn[2];
  let cell = Math.cbrt((dx * dy * dz) / maxPts); cell = Math.min(5, Math.max(0.8, cell));
  const nearest = (px: number, py: number, pz: number, m: Mesh): number => {
    const P = m.positions, I = m.indices; let best = 1e18;
    const nStep = Math.max(1, Math.ceil(I.length / 3 / 6000)) * 3;   // tope: distancia aprox en mallas gigantes
    for (let t = 0; t < I.length; t += nStep) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; const d = ptTriDist2(px, py, pz, P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]); if (d < best) best = d; }
    return Math.sqrt(best);
  };
  let inside = 0, samples = 0, maxPen = 0;
  const consider = (x: number, y: number, z: number, isGrid: boolean) => {
    samples++;
    if (pointInsideMesh(x, y, z, A) && pointInsideMesh(x, y, z, B)) {
      if (isGrid) inside++;                                   // el volumen SOLO lo cuenta la rejilla (celdas iguales)
      if (cloud) cloud.push(x, y, z);                         // NUBE DE ALARMA: dónde comparten acero
      const pen = Math.min(nearest(x, y, z, A), nearest(x, y, z, B));
      if (pen > maxPen) maxPen = pen;
    }
  };
  // rejilla volumétrica (centro de celda) sobre la región de búsqueda
  for (let x = omn[0] + cell / 2; x < omx[0]; x += cell)
    for (let y = omn[1] + cell / 2; y < omx[1]; y += cell)
      for (let z = omn[2] + cell / 2; z < omx[2]; z += cell) consider(x, y, z, true);
  // + puntos de superficie de A y B escalonados hacia adentro (traslapes finos)
  const surf = (m: Mesh) => {
    const P = m.positions, I = m.indices;
    // TOPE de muestreo: con mallas finas (100k+ tris) el barrido completo × pointInsideMesh
    // O(T) explotaba a minutos por par (colgó el shot del stripper). ~4000 tris bastan.
    const sStep = Math.max(1, Math.ceil(I.length / 3 / 4000)) * 3;
    for (let t = 0; t < I.length; t += sStep) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const cx = (P[a] + P[b] + P[c]) / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      if (cx < omn[0] - 1 || cx > omx[0] + 1 || cy < omn[1] - 1 || cy > omx[1] + 1 || cz < omn[2] - 1 || cz > omx[2] + 1) continue;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz) || 1;
      consider(cx - dstep * nx / nl, cy - dstep * ny / nl, cz - dstep * nz / nl, false);
    }
  };
  surf(A); surf(B);
  return { volMm3: +(inside * cell * cell * cell).toFixed(1), penMm: +maxPen.toFixed(2), pointsInside: inside, samples, ...(cloud ? { cloud } : {}) };
}

/** Fits térmicos de las interfaces estándar del molde a temperatura de operación.
 *  Los pares acero↔acero son estables; el plástico↔acero mueve MUCHO (contracción). */
export function standardThermalFits(moldTempC: number) {
  const dTsteel = moldTempC - 20;
  // ejector ⌀6 nitrurado en barreno ⌀6.13 de la placa (acero) — deslizante + venteo
  const ejector = fitAtTemp({ diaMm: 6.13, material: '1.1730' }, { diaMm: 6, material: '1.2842' }, dTsteel);
  // return pin ⌀12 en ⌀12.13 (acero↔acero)
  const returnPin = fitAtTemp({ diaMm: 12.13, material: '1.1730' }, { diaMm: 12, material: '1.2842' }, dTsteel);
  // poste guía ⌀32 acero en buje ⌀32.03 de BRONCE — el bronce dilata más → se ABRE
  const leader = fitAtTemp({ diaMm: 32.03, material: 'bronce' }, { diaMm: 32, material: '1.2510' }, dTsteel);
  // PIEZA PP: de la temperatura de eyección (~60°C sobre cavidad) al ambiente CONTRAE
  //   — el macho de acero (estable) deja de apretar el interior → la pieza se libera.
  const partShrink = fitAtTemp({ diaMm: 100, material: 'acero' }, { diaMm: 100, material: 'PP' }, -77);
  return {
    ejector: { ...ejector, rol: 'pin eyector ⌀6 (acero↔acero, estable)' },
    returnPin: { ...returnPin, rol: 'return pin ⌀12 (acero↔acero, estable)' },
    leader: { ...leader, rol: 'poste guía ⌀32 en buje de bronce (se abre en caliente)' },
    partShrinkPP: { ...partShrink, rol: 'contracción PP al enfriar (−77°C) → suelta el macho' },
  };
}
