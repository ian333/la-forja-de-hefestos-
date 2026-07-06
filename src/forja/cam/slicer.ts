/**
 * CAM · SLICER FDM — libro Cimo caps 14-17.
 *
 * El libro imprime con FDM (cap 16: setup + orientación; cap 17: ajustes finos —
 * infill ~30%, voladizo máx 40°, top layers). Aquí el slicer es PROPIO y opera
 * sobre la MALLA real de la pieza:
 *   1) REBANADO: cada triángulo se interseca con el plano de la capa → segmento;
 *      los segmentos se ENCADENAN en lazos cerrados (contornos de la capa).
 *   2) PERÍMETRO: el contorno mismo (1 pared; el libro usa 2-3, fase 2 offset).
 *   3) INFILL rectilíneo ±45° alternando por capa, recortado por paridad
 *      (even-odd contra TODOS los lazos → respeta huecos).
 *   4) G-CODE Marlin: temperaturas PLA (210/60), G28, E acumulado por volumen
 *      real (largo · alto de capa · ancho de línea / área del filamento 1.75),
 *      primera capa LENTA, ventilador desde la capa 2.
 * Motor PURO: testeable en node.
 */

export interface XY { x: number; y: number }
export interface SliceLayer { z: number; loops: XY[][]; infill: Array<[XY, XY]> }

export interface PrintParams {
  layerH: number;      // 0.2
  lineW: number;       // 0.4 (nozzle)
  infillPct: number;   // 30 (libro cap 17)
  nozzleTemp: number;  // 210 PLA
  bedTemp: number;     // 60
  feedPrint: number;   // mm/min (3600)
  feedFirst: number;   // primera capa lenta (1200)
  filamentD: number;   // 1.75
}

/** Rebana la malla: contornos cerrados por capa (encadenado de segmentos). */
export function sliceMesh(
  mesh: { positions: Float32Array | number[]; indices: Uint32Array | number[] },
  layerH: number,
): SliceLayer[] {
  const P = mesh.positions, I = mesh.indices;
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 2; i < P.length; i += 3) {
    const z = P[i] as number;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const layers: SliceLayer[] = [];
  for (let z = z0 + layerH / 2; z < z1; z += layerH) {
    const segs: Array<[XY, XY]> = [];
    for (let t = 0; t < I.length; t += 3) {
      const vs = [I[t] as number, I[t + 1] as number, I[t + 2] as number].map(vi => ({
        x: P[vi * 3] as number, y: P[vi * 3 + 1] as number, z: P[vi * 3 + 2] as number }));
      const pts: XY[] = [];
      for (let e = 0; e < 3; e++) {
        const a = vs[e], b = vs[(e + 1) % 3];
        if ((a.z - z) * (b.z - z) < 0) {
          const s = (z - a.z) / (b.z - a.z);
          pts.push({ x: a.x + s * (b.x - a.x), y: a.y + s * (b.y - a.y) });
        }
      }
      if (pts.length === 2 && Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) > 1e-6)
        segs.push([pts[0], pts[1]]);
    }
    layers.push({ z: +z.toFixed(4), loops: chainLoops(segs), infill: [] });
  }
  return layers;
}

/** Encadena segmentos sueltos en lazos cerrados (tolerancia de unión 1e-3). */
export function chainLoops(segs: Array<[XY, XY]>): XY[][] {
  const used = new Array(segs.length).fill(false);
  const key = (p: XY) => `${Math.round(p.x * 500)},${Math.round(p.y * 500)}`;
  const byStart = new Map<string, number[]>();
  segs.forEach(([a, b], i) => {
    for (const [p] of [[a], [b]] as XY[][]) {
      const k = key(p);
      (byStart.get(k) ?? byStart.set(k, []).get(k)!).push(i);
    }
  });
  const loops: XY[][] = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = true;
    const loop: XY[] = [segs[s][0], segs[s][1]];
    for (let guard = 0; guard < segs.length; guard++) {
      const tail = loop[loop.length - 1];
      const cand = (byStart.get(key(tail)) ?? []).find(i => !used[i]);
      if (cand === undefined) break;
      used[cand] = true;
      const [a, b] = segs[cand];
      const next = Math.hypot(a.x - tail.x, a.y - tail.y) < Math.hypot(b.x - tail.x, b.y - tail.y) ? b : a;
      loop.push(next);
      if (Math.hypot(next.x - loop[0].x, next.y - loop[0].y) < 2e-3) break; // cerró
    }
    if (loop.length >= 3) { loop.pop(); loops.push(loop); } // quita el punto de cierre duplicado
  }
  return loops.filter(l => l.length >= 3);
}

/** Infill rectilíneo a ±45° recortado por paridad contra TODOS los lazos. */
export function rectilinearInfill(loops: XY[][], angleDeg: number, spacing: number): Array<[XY, XY]> {
  if (!loops.length) return [];
  const a = (angleDeg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const rot = (p: XY): XY => ({ x: p.x * ca + p.y * sa, y: -p.x * sa + p.y * ca });
  const unrot = (p: XY): XY => ({ x: p.x * ca - p.y * sa, y: p.x * sa + p.y * ca });
  const R = loops.map(lp => lp.map(rot));
  const ys = R.flat().map(p => p.y);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const out: Array<[XY, XY]> = [];
  for (let y = y0 + spacing / 2; y < y1; y += spacing) {
    const xs: number[] = [];
    for (const lp of R) {
      for (let i = 0; i < lp.length; i++) {
        const p = lp[i], q = lp[(i + 1) % lp.length];
        if ((p.y - y) * (q.y - y) < 0) xs.push(p.x + ((y - p.y) / (q.y - p.y)) * (q.x - p.x));
      }
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] < 0.2) continue;
      out.push([unrot({ x: xs[i], y }), unrot({ x: xs[i + 1], y })]);
    }
  }
  return out;
}

/** Slicea + rellena + emite Marlin. Devuelve {gcode, layers} para display/checks. */
export function slicePart(
  mesh: { positions: Float32Array | number[]; indices: Uint32Array | number[] },
  p: PrintParams,
): { gcode: string; layers: SliceLayer[] } {
  const layers = sliceMesh(mesh, p.layerH);
  const spacing = p.lineW * (100 / Math.max(1, p.infillPct));
  layers.forEach((ly, i) => { ly.infill = rectilinearInfill(ly.loops, i % 2 ? -45 : 45, spacing); });

  const aFil = Math.PI * (p.filamentD / 2) ** 2;
  const ePerMm = (p.layerH * p.lineW) / aFil;
  const f3 = (v: number) => v.toFixed(3);
  let E = 0;
  const L: string[] = [
    '(La Forja CAM - IMPRESION FDM)',
    `M140 S${p.bedTemp}`, `M104 S${p.nozzleTemp}`, `M190 S${p.bedTemp}`, `M109 S${p.nozzleTemp}`,
    'G21', 'G90', 'M83 (E relativo)', 'G28 (home)',
  ];
  layers.forEach((ly, li) => {
    const feed = li === 0 ? p.feedFirst : p.feedPrint;
    L.push(`(capa ${li + 1} z=${ly.z})`, `G1 Z${ly.z} F1200`);
    if (li === 1) L.push('M106 S255 (ventilador)');
    for (const loop of ly.loops) {
      L.push(`G0 X${f3(loop[0].x)} Y${f3(loop[0].y)}`);
      for (let i = 1; i <= loop.length; i++) {
        const q = loop[i % loop.length], pr = loop[(i - 1) % loop.length];
        const d = Math.hypot(q.x - pr.x, q.y - pr.y);
        E += d * ePerMm;
        L.push(`G1 X${f3(q.x)} Y${f3(q.y)} E${f3(d * ePerMm)} F${feed}`);
      }
    }
    for (const [s, e2] of ly.infill) {
      const d = Math.hypot(e2.x - s.x, e2.y - s.y);
      E += d * ePerMm;
      L.push(`G0 X${f3(s.x)} Y${f3(s.y)}`, `G1 X${f3(e2.x)} Y${f3(e2.y)} E${f3(d * ePerMm)} F${feed}`);
    }
  });
  L.push('M104 S0', 'M140 S0', 'M106 S0', 'G28 X0', 'M84', `(E total ${E.toFixed(1)}mm de filamento)`);
  return { gcode: L.join('\n') + '\n', layers };
}
