/**
 * t_c LOCAL SOBRE LA PIEZA + CONSEJO GENERATIVO DE AGUA — el cierre de la ronda
 * térmica 3D: cada columna de la pieza tarda lo que SU espesor manda (Eq 9.5,
 * t_c = h²/(π²α)·ln(4/π·(Tm−Tc)/(Te−Tc)) — verificada contra el libro), y si la
 * zona que CONTROLA el ciclo queda fuera de la cobertura de diseño de las líneas
 * (H = 4D Eq 9.22 · paso W Eq 9.24), la Máquina PROPONE la corrección:
 *   · desalineación LATERAL → mover/agregar línea a y ≈ zona caliente
 *   · núcleo PROFUNDO (la línea no alcanza en z) → BAFFLE §9.3.5.2 (⌀ ≥ 6.35 mm,
 *     componente ESTÁNDAR — "clearly preferred whenever the application allows")
 */
import { coolingTimePlate, ABS_KAZMER } from './cooling';
import { coolingCircuit, cavityGrid, cavityFootprint, plateDepth } from './mold-drawing-set';
import type { MoldAssemblySpec } from './mold-assembly';

export interface TcMap {
  G: number; GY: number; dxg: number; dyg: number;     // raster local de la pieza (min en 0)
  thMm: Float32Array; tcS: Float32Array;               // espesor y t_c por columna (NaN = sin pieza)
  zMid: Float32Array;                                  // z medio del material de la columna
  pw: number; ph: number;
  tcMinS: number; tcMaxS: number; tcP95S: number; thMaxMm: number;
  hot: { xMm: number; yMm: number; thMm: number; tcS: number; zMidMm: number };
}

/** raster fino de espesor (mismo barycéntrico del DFM/térmico) → t_c por columna. */
export function tcLocalMap(mesh: { positions: Float32Array; indices: Uint32Array }, o?: { cellMm?: number }): TcMap | null {
  const P = mesh.positions, I = mesh.indices;
  if (!P.length) return null;
  let mnx = 1e18, mny = 1e18, mnz = 1e18, mxx = -1e18, mxy = -1e18;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < mnx) mnx = P[i]; if (P[i] > mxx) mxx = P[i];
    if (P[i + 1] < mny) mny = P[i + 1]; if (P[i + 1] > mxy) mxy = P[i + 1];
    if (P[i + 2] < mnz) mnz = P[i + 2];
  }
  const pw = mxx - mnx, ph = mxy - mny;
  if (pw < 1 || ph < 1) return null;
  const cell = o?.cellMm ?? 0.8;
  const G = Math.max(24, Math.min(160, Math.round(pw / cell)));
  const GY = Math.max(12, Math.round(G * ph / pw));
  const dxg = pw / G, dyg = ph / GY;
  const hits: number[][] = Array.from({ length: G * GY }, () => []);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ax = P[a] - mnx, ay = P[a + 1] - mny, az = P[a + 2] - mnz;
    const bx = P[b] - mnx, by = P[b + 1] - mny, bz = P[b + 2] - mnz;
    const cx = P[c] - mnx, cy = P[c + 1] - mny, cz = P[c + 2] - mnz;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nzc = ux * vy - uy * vx;
    const a2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, nzc);
    if (a2 < 1e-12 || Math.abs(nzc / a2) < 1e-3) continue;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) / dxg)), i1 = Math.min(G - 1, Math.ceil(Math.max(ax, bx, cx) / dxg));
    const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy) / dyg)), j1 = Math.min(GY - 1, Math.ceil(Math.max(ay, by, cy) / dyg));
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-12) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = (i + 0.5031) * dxg, py = (j + 0.5047) * dyg;
      const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
      const w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      hits[j * G + i].push(az * w0 + bz * w1 + cz * w2);
    }
  }
  const thMm = new Float32Array(G * GY).fill(NaN);
  const tcS = new Float32Array(G * GY).fill(NaN);
  const zMid = new Float32Array(G * GY).fill(NaN);
  let tcMin = 1e18, tcMax = -1e18, thMax = 0;
  const hot = { xMm: 0, yMm: 0, thMm: 0, tcS: 0, zMidMm: 0 };
  for (let n = 0; n < G * GY; n++) {
    const h = hits[n];
    if (h.length < 2) continue;
    h.sort((x, y) => x - y);
    const zs: number[] = [h[0]];
    for (let k = 1; k < h.length; k++) if (h[k] - zs[zs.length - 1] > 0.05) zs.push(h[k]);
    if (zs.length % 2 === 1) zs.pop();
    if (zs.length < 2) continue;
    let tk = 0, zm = 0;
    for (let k = 0; k + 1 < zs.length; k += 2) { tk += zs[k + 1] - zs[k]; zm += (zs[k] + zs[k + 1]) / 2; }
    zm /= zs.length / 2;
    thMm[n] = tk;
    zMid[n] = zm;
    const tc = coolingTimePlate(tk / 1000, ABS_KAZMER);      // Eq 9.5 (libro, al decimal)
    tcS[n] = tc;
    if (tc < tcMin) tcMin = tc;
    if (tc > tcMax) { tcMax = tc; }
    if (tk > thMax) {
      thMax = tk;
      hot.xMm = ((n % G) + 0.5) * dxg; hot.yMm = (((n / G) | 0) + 0.5) * dyg;
      hot.thMm = tk; hot.tcS = tc; hot.zMidMm = zm;
    }
  }
  if (thMax === 0) return null;
  // EROSIÓN ×2 (mismo gotcha del DFM §2.3.1): las columnas de una PARED VERTICAL
  // miden su ALTURA en z (26 mm en una carcasa de 1.5) — pero esa pared enfría
  // LATERAL hacia el acero pegado. Las columnas de borde heredan la mediana
  // interior; el hot spot se re-busca sobre el campo corregido.
  {
    const solid = (n: number) => !Number.isNaN(thMm[n]);
    const interior: number[] = [];
    const isInterior = new Uint8Array(G * GY);
    for (let j = 2; j < GY - 2; j++) for (let i = 2; i < G - 2; i++) {
      const n = j * G + i;
      if (!solid(n)) continue;
      let ok = true;
      for (let dj = -2; dj <= 2 && ok; dj++) for (let di = -2; di <= 2; di++)
        if (!solid((j + dj) * G + (i + di))) { ok = false; break; }
      if (ok) { isInterior[n] = 1; interior.push(thMm[n]); }
    }
    if (interior.length >= 16) {
      interior.sort((a, b) => a - b);
      const thMed = interior[(interior.length / 2) | 0];
      const tcMed = coolingTimePlate(thMed / 1000, ABS_KAZMER);
      tcMin = 1e18; tcMax = -1e18; thMax = 0;
      for (let n = 0; n < G * GY; n++) {
        if (!solid(n)) continue;
        if (!isInterior[n]) { thMm[n] = thMed; tcS[n] = tcMed; }
        if (tcS[n] < tcMin) tcMin = tcS[n];
        if (tcS[n] > tcMax) tcMax = tcS[n];
        if (thMm[n] > thMax) {
          thMax = thMm[n];
          hot.xMm = ((n % G) + 0.5) * dxg; hot.yMm = (((n / G) | 0) + 0.5) * dyg;
          hot.thMm = thMm[n]; hot.tcS = tcS[n]; hot.zMidMm = zMid[n];
        }
      }
      hot.xMm = +hot.xMm.toFixed(1); hot.yMm = +hot.yMm.toFixed(1);
      hot.thMm = +hot.thMm.toFixed(1); hot.tcS = +hot.tcS.toFixed(1); hot.zMidMm = +hot.zMidMm.toFixed(1);
    }
  }
  const sorted = Array.from(tcS).filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, (sorted.length * 0.95) | 0)] ?? tcMax;
  return {
    G, GY, dxg, dyg, thMm, tcS, zMid, pw, ph,
    tcMinS: +tcMin.toFixed(2), tcMaxS: +tcMax.toFixed(2), tcP95S: +p95.toFixed(2), thMaxMm: +thMax.toFixed(1),
    hot: { ...hot, xMm: +hot.xMm.toFixed(1), yMm: +hot.yMm.toFixed(1), thMm: +hot.thMm.toFixed(1), tcS: +hot.tcS.toFixed(1), zMidMm: +hot.zMidMm.toFixed(1) },
  };
}

/** colores por VÉRTICE de la pieza (coords locales de la malla): azul=rápida,
 *  rojo=la pared que DETIENE el ciclo. Rampa en escala √t_c (abre el rango bajo). */
export function paintTcColors(mesh: { positions: Float32Array }, map: TcMap): Float32Array {
  const P = mesh.positions;
  const colors = new Float32Array(P.length);
  let mnx = 1e18, mny = 1e18;
  for (let i = 0; i < P.length; i += 3) { if (P[i] < mnx) mnx = P[i]; if (P[i + 1] < mny) mny = P[i + 1]; }
  // escala a √t_c ACOTADA al p95: una columna monstruo (Benchy 1666 s) no aplasta
  // el contraste del resto — lo que pase de p95 satura en ROJO
  const s0 = Math.sqrt(Math.max(0.01, map.tcMinS)), s1 = Math.sqrt(Math.max(s0 * s0 + 0.1, map.tcP95S ?? map.tcMaxS));
  for (let i = 0; i < P.length; i += 3) {
    const gi = Math.max(0, Math.min(map.G - 1, Math.floor((P[i] - mnx) / map.dxg)));
    const gj = Math.max(0, Math.min(map.GY - 1, Math.floor((P[i + 1] - mny) / map.dyg)));
    let tc = map.tcS[gj * map.G + gi];
    if (Number.isNaN(tc)) tc = map.tcMinS;
    const t = Math.max(0, Math.min(1, (Math.sqrt(tc) - s0) / (s1 - s0)));
    const c = t < 0.25 ? [0, t * 4 * 0.8, 1]
      : t < 0.5 ? [0, 0.8 + (t - 0.25) * 0.8, 1 - (t - 0.25) * 4]
      : t < 0.75 ? [(t - 0.5) * 4, 1, 0]
      : [1, 1 - (t - 0.75) * 3.4, 0];
    colors[i] = c[0]; colors[i + 1] = c[1]; colors[i + 2] = c[2];
  }
  return colors;
}

export interface WaterAdvice {
  rows: Array<{ param: string; valor: string; limite: string; ok: boolean; ref: string }>;
  /** marcador 3D del baffle propuesto (mundo): de la línea B hasta bajo la zona */
  marker?: { x: number; y: number; z0: number; z1: number; diaMm: number };
  suggestion: string;
}

/** ¿La zona que controla el ciclo está CUBIERTA por el agua? Si no: mover línea
 *  (desalineación lateral) o BAFFLE §9.3.5.2 (núcleo profundo). Por cavidad. */
export function waterAdvice(spec: MoldAssemblySpec, map: TcMap): WaterAdvice {
  const D = plateDepth(spec);
  const cc = coolingCircuit(spec, D);
  const p = spec.plates;
  const zPart = p.bottomClamp + p.ejectorHousing + p.support + p.B;   // = plateStackZ().A
  const H = cc.zBehindMm, dia = cc.diaMm;
  // paso REAL del serpentín (entre líneas rectas)
  const ys = [...new Set(cc.segs.filter((g) => g.y0 === g.y1).map((g) => g.y0))].sort((a, b) => a - b);
  const W = ys.length > 1 ? (ys[ys.length - 1] - ys[0]) / (ys.length - 1) : 2 * H;
  // cobertura de DISEÑO: un punto está atendido si su distancia 3D a alguna línea
  // ≤ R = √(H² + (W/2)²) (la esquina del patrón Eq 9.22/9.24) + media celda
  const Rcov = Math.hypot(H, W / 2) + 4;
  const cells = cavityGrid(spec, D);
  let worst = { d: -1, x: 0, y: 0, z: 0 };
  for (const c of cells) {
    const hx = c.cx - map.pw / 2 + map.hot.xMm;
    const hy = c.cy - map.ph / 2 + map.hot.yMm;
    const hz = zPart + map.hot.zMidMm;
    let dNear = 1e18;
    const zLines = [zPart - cc.zBehindMm, ...(cc.zAboveMm != null ? [zPart + cc.zAboveMm] : [])];
    for (const zl of zLines) for (const g of cc.segs) {
      const vx = g.x1 - g.x0, vy = g.y1 - g.y0, len2 = vx * vx + vy * vy || 1;
      const tt = Math.max(0, Math.min(1, ((hx - g.x0) * vx + (hy - g.y0) * vy) / len2));
      const d = Math.hypot(hx - (g.x0 + tt * vx), hy - (g.y0 + tt * vy), hz - zl);
      if (d < dNear) dNear = d;
    }
    if (dNear > worst.d) worst = { d: dNear, x: hx, y: hy, z: hz };
  }
  const covered = worst.d <= Rcov;
  // diagnóstico: ¿desalineación lateral o profundidad?
  const dLatY = Math.min(...ys.map((y) => Math.abs(worst.y - y)));
  const deep = (worst.z - (zPart - cc.zBehindMm)) > Rcov * 0.8;
  const rows: WaterAdvice['rows'] = [
    {
      param: 'Zona que controla el ciclo (medida)',
      valor: `pared ${map.hot.thMm} mm → t_c = ${map.hot.tcS} s (máx de la pieza; mín ${map.tcMinS} s)`,
      limite: 't_c = h²/(π²α)·ln(4/π·ΔT) — la pared gruesa DETIENE el ciclo',
      ok: map.hot.tcS <= map.tcMinS * 4,
      ref: 'Eq 9.5',
    },
    {
      param: 'Cobertura de agua del hot spot',
      valor: `línea más cercana a ${worst.d.toFixed(1)} mm`,
      limite: `≤ ${Rcov.toFixed(0)} mm (patrón H=${H} Eq 9.22 · W=${W.toFixed(0)} Eq 9.24)`,
      ok: covered,
      ref: 'Eq 9.22/9.24',
    },
  ];
  let suggestion = '✓ el agua cubre la zona crítica con el patrón de diseño';
  let marker: WaterAdvice['marker'];
  if (!covered) {
    if (dLatY > W / 2 && !deep) {
      suggestion = `→ MOVER/AGREGAR línea a y ≈ ${worst.y.toFixed(0)} mm (desalineación lateral de ${dLatY.toFixed(0)} mm)`;
      rows.push({ param: 'Corrección propuesta', valor: suggestion, limite: 'reruteo del serpentín (mismo ⌀)', ok: false, ref: '§9.2' });
    } else {
      suggestion = `→ BAFFLE ⌀${Math.max(6.35, Math.round(dia)).toFixed(2)} bajo la zona @(${worst.x.toFixed(0)},${worst.y.toFixed(0)}) — núcleo profundo, componente estándar`;
      rows.push({ param: 'Corrección propuesta', valor: suggestion, limite: 'baffle ⌀ ≥ 6.35 mm ("clearly preferred whenever the application allows")', ok: false, ref: '§9.3.5.2' });
      marker = { x: worst.x, y: worst.y, z0: zPart - cc.zBehindMm, z1: worst.z - 2, diaMm: Math.max(6.35, dia) };
    }
  }
  return { rows, marker, suggestion };
}
