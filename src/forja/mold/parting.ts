/**
 * PARTICIÓN NO PLANA — la herramienta que los 3 cursos hacen A MANO (task #43).
 * ============================================================================
 * En SolidWorks el instructor pica 87 aristas, extruye faldas de 80 mm, parcha
 * 6+ boundary surfaces y cose 47 cuerpos (Knit). La regla detrás es determinista
 * y aquí se AUTOMATIZA completa:
 *
 *  1) LAZOS DE PARTICIÓN desde la malla: un triángulo es cavidad (+) o núcleo
 *     (−) según sign(dot(normal, pull)) — verticales van con (+), la opción
 *     "at +/- draft transition" del curso. La CADENA = aristas frontera entre
 *     clases, encadenadas en lazos cerrados. El lazo mayor = partición exterior;
 *     los lazos INTERNOS = ventanas/barrenos ⇒ SHUT-OFFS (¡gratis!).
 *  2) LA CUCHILLA (knife): sólido cosido de TRIÁNGULOS (siempre planos):
 *     falda radial lazo→rectángulo del bloque (a la z DE CADA punto — no plana),
 *     paredes verticales, tapa superior, y por cada ventana su COLUMNA tapada
 *     (fan al centroide del rim) — el shut-off en geometría.
 *  3) EL SPLIT: tmp = bloque − pieza; núcleo = tmp − cuchilla;
 *     cavidad = tmp − núcleo. Dos sólidos exactos, sin picar una sola arista.
 *
 * Invariantes (el "mensaje verde" del curso, pero medible):
 *     lazos CERRADOS · vol(cavidad)+vol(núcleo) = vol(tmp) · 1 cuerpo por mitad
 * Límite v1 (declarado): lazos PLANOS (cualquier silueta, dientes incluidos)
 * van por prisma nativo — sin restricción. Lazos NO planos usan falda RADIAL
 * desde el centroide → estrella-convexos; formas en L extremas necesitarán
 * proyección por normales (v2).
 */
import type { OC, Shape } from '../brep/occt';
import {
  makeBox, transformShape, cut, fuse as fuseShapes, volume, tessellate,
  makeTriFace, sewFaces, solidFromShell, uniqueSubShapes,
} from '../brep/occt';

export interface PartingLoop {
  pts: Array<[number, number, number]>;   // ordenados, cerrados (último≠primero)
  zMin: number; zMax: number;
  esExterior: boolean;
}

/** lazos de partición desde una malla teselada (pull = +Z). */
export function partingLoops(
  mesh: { positions: Float32Array | number[]; indices: Uint32Array | number[] },
  opts?: { epsNormal?: number; weldMm?: number },
): { loops: PartingLoop[]; warnings: string[] } {
  const P = mesh.positions, I = mesh.indices;
  const eps = opts?.epsNormal ?? 1e-3;
  const weld = opts?.weldMm ?? 1e-3;
  const warnings: string[] = [];
  const key = (x: number, y: number, z: number) =>
    `${Math.round(x / weld)},${Math.round(y / weld)},${Math.round(z / weld)}`;
  const vid = new Map<string, number>();
  const V: Array<[number, number, number]> = [];
  const idOf = (x: number, y: number, z: number) => {
    const k = key(x, y, z);
    let id = vid.get(k);
    if (id == null) { id = V.length; V.push([x, y, z]); vid.set(k, id); }
    return id;
  };
  // clase por arista soldada: acumula clases de los triángulos que la comparten
  const edgeCls = new Map<string, { a: number; b: number; cls: number[] }>();
  for (let t = 0; t < I.length; t += 3) {
    const ia = I[t] * 3, ib = I[t + 1] * 3, ic = I[t + 2] * 3;
    const ax = P[ia], ay = P[ia + 1], az = P[ia + 2];
    const bx = P[ib], by = P[ib + 1], bz = P[ib + 2];
    const cx = P[ic], cy = P[ic + 1], cz = P[ic + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nn = Math.hypot(nx, ny, nz);
    if (nn < 1e-12) continue;
    const w = nz / nn;
    // verticales (|w|<eps) van con la CAVIDAD (+): la transición +/− del curso
    const cls = w < -eps ? -1 : 1;
    const va = idOf(ax, ay, az), vb = idOf(bx, by, bz), vc = idOf(cx, cy, cz);
    for (const [p, q] of [[va, vb], [vb, vc], [vc, va]] as const) {
      const ek = p < q ? `${p}|${q}` : `${q}|${p}`;
      let e = edgeCls.get(ek);
      if (!e) { e = { a: Math.min(p, q), b: Math.max(p, q), cls: [] }; edgeCls.set(ek, e); }
      e.cls.push(cls);
    }
  }
  // frontera: arista con clase + y − entre sus triángulos
  const adj = new Map<number, number[]>();
  let nFront = 0;
  for (const e of edgeCls.values()) {
    if (!(e.cls.includes(1) && e.cls.includes(-1))) continue;
    nFront++;
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push(e.b);
    adj.get(e.b)!.push(e.a);
  }
  if (!nFront) { warnings.push('sin aristas de transición +/− (¿pieza plana o toda vertical?)'); return { loops: [], warnings }; }
  // encadenar lazos
  const usado = new Set<string>();
  const eKey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const loops: PartingLoop[] = [];
  for (const [start, vecinos] of adj) {
    for (const first of vecinos) {
      if (usado.has(eKey(start, first))) continue;
      const camino = [start, first];
      usado.add(eKey(start, first));
      let prev = start, cur = first, cerrado = false;
      for (let guard = 0; guard < 200000; guard++) {
        const nexts = (adj.get(cur) ?? []).filter((n) => n !== prev && !usado.has(eKey(cur, n)));
        if (!nexts.length) break;
        const nx2 = nexts[0];
        if (nexts.length > 2) warnings.push(`bifurcación en vértice ${cur} (${nexts.length} salidas) — se toma la primera`);
        usado.add(eKey(cur, nx2));
        if (nx2 === start) { cerrado = true; break; }
        camino.push(nx2);
        prev = cur; cur = nx2;
      }
      if (!cerrado) { warnings.push(`lazo NO cerrado desde ${start} (${camino.length} pts) — descartado`); continue; }
      const pts = camino.map((id) => V[id]);
      let zMin = Infinity, zMax = -Infinity;
      for (const p of pts) { zMin = Math.min(zMin, p[2]); zMax = Math.max(zMax, p[2]); }
      loops.push({ pts, zMin, zMax, esExterior: false });
    }
  }
  if (!loops.length) { warnings.push('ninguna cadena cerró en lazo'); return { loops, warnings }; }
  // exterior = el de mayor perímetro XY
  let best = 0, bestP = -1;
  loops.forEach((L, i) => {
    let per = 0;
    for (let k2 = 0; k2 < L.pts.length; k2++) {
      const a = L.pts[k2], b = L.pts[(k2 + 1) % L.pts.length];
      per += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    if (per > bestP) { bestP = per; best = i; }
  });
  loops[best].esExterior = true;
  return { loops, warnings };
}

/** densifica un lazo a segmentos ≤ maxSeg mm (para que la falda doble esquinas). */
function densificar(pts: Array<[number, number, number]>, maxSeg: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    out.push(a);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.floor(L / maxSeg);
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

export interface SplitNoPlanoResult {
  cavityPlate: Shape; corePlate: Shape;
  loops: PartingLoop[];
  vols: { tmp: number; cavity: number; core: number };
  bodies: { cavity: number; core: number };
  report: string[];
  warnings: string[];
}

/**
 * SPLIT NO PLANO: bloque auto (margen alrededor de la pieza ESCALADA), cuchilla
 * desde los lazos de partición, dos placas exactas. Pull = +Z.
 */
export function splitNoPlano(
  oc: OC, piezaEscalada: Shape,
  opts?: {
    marginMm?: number; topMm?: number; bottomMm?: number; deflection?: number;
    /** bloque EXACTO estilo Tooling Split del curso: ancho×fondo centrados en la
     *  pieza, alturas de placa medidas DESDE el plano de partición (145/90). */
    blockWMm?: number; blockDMm?: number; plateTopMm?: number; plateBottomMm?: number;
  },
): SplitNoPlanoResult {
  const report: string[] = [];
  const mesh = tessellate(oc, piezaEscalada, opts?.deflection ?? 0.25, opts?.deflection ?? 0.25);
  const { loops, warnings } = partingLoops(mesh);
  if (!loops.length) throw new Error('splitNoPlano: sin lazos de partición');
  const ext = loops.find((L) => L.esExterior)!;
  // bloque auto del bbox de la pieza
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  const P = mesh.positions;
  for (let i = 0; i < P.length; i += 3) {
    x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]);
    y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]);
    z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]);
  }
  const m = opts?.marginMm ?? 30;
  const bcx = (x0 + x1) / 2, bcy = (y0 + y1) / 2;
  const zPart = (ext.zMin + ext.zMax) / 2;
  const bx0 = opts?.blockWMm != null ? bcx - opts.blockWMm / 2 : x0 - m;
  const bx1 = opts?.blockWMm != null ? bcx + opts.blockWMm / 2 : x1 + m;
  const by0 = opts?.blockDMm != null ? bcy - opts.blockDMm / 2 : y0 - m;
  const by1 = opts?.blockDMm != null ? bcy + opts.blockDMm / 2 : y1 + m;
  const bz0 = opts?.plateBottomMm != null ? zPart - opts.plateBottomMm : z0 - (opts?.bottomMm ?? 30);
  const bz1 = opts?.plateTopMm != null ? zPart + opts.plateTopMm : z1 + (opts?.topMm ?? 30);
  if (x0 < bx0 - 1e-6 || x1 > bx1 + 1e-6 || y0 < by0 - 1e-6 || y1 > by1 + 1e-6 || z0 < bz0 - 1e-6 || z1 > bz1 + 1e-6)
    warnings.push(`la pieza SOBRESALE del bloque (bbox ${(x1 - x0).toFixed(0)}×${(y1 - y0).toFixed(0)}×${(z1 - z0).toFixed(0)})`);
  const block = transformShape(oc, makeBox(oc, bx1 - bx0, by1 - by0, bz1 - bz0), { translate: [bx0, by0, bz0] });
  // ── LA CUCHILLA ──────────────────────────────────────────────────────────
  const caras: Shape[] = [];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rectQ = (px: number, py: number): [number, number] => {
    // proyección radial desde (cx,cy) al rectángulo del bloque
    const dx = px - cx, dy = py - cy;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) return [bx1, py];
    let t = Infinity;
    if (dx > 1e-12) t = Math.min(t, (bx1 - cx) / dx);
    if (dx < -1e-12) t = Math.min(t, (bx0 - cx) / dx);
    if (dy > 1e-12) t = Math.min(t, (by1 - cy) / dy);
    if (dy < -1e-12) t = Math.min(t, (by0 - cy) / dy);
    return [cx + dx * t, cy + dy * t];
  };
  const tmp = cut(oc, block, piezaEscalada);
  let knife: Shape | null = null;
  let core: Shape | null = null, cavity: Shape | null = null;
  if (ext.zMax - ext.zMin < 0.05) {
    // PARTICIÓN PLANA: el plano del lazo ES la superficie de partición — cada
    // mitad = su caja − pieza (booleanos nativos contra la pieza, exactos por
    // construcción: vol(cav)+vol(núcleo) = vol(bloque−pieza) sin fuzz). Los
    // lazos internos (ventanas) quedan como columnas pegadas a UNA mitad =
    // shut-off. La cuchilla cosida aquí era VENENO: la falda radial se
    // auto-interseca en siluetas no convexas (dientes del peine → horas).
    const zc = (ext.zMin + ext.zMax) / 2;
    const boxB = transformShape(oc, makeBox(oc, bx1 - bx0, by1 - by0, zc - bz0), { translate: [bx0, by0, bz0] });
    const boxT = transformShape(oc, makeBox(oc, bx1 - bx0, by1 - by0, bz1 - zc), { translate: [bx0, by0, zc] });
    core = cut(oc, boxB, piezaEscalada);
    cavity = cut(oc, boxT, piezaEscalada);
    report.push(`partición PLANA (z=${zc.toFixed(2)}): corte por plano, sin cuchilla`);
    for (const L of loops) {
      if (L.esExterior) continue;
      report.push(`shut-off: ventana de ${L.pts.length} pts tapada (z≈${((L.zMin + L.zMax) / 2).toFixed(1)})`);
    }
  } else {
  // 4 mm de paso: la cuchilla del arco pasaba de ~700 caras (booleano de minutos)
  // a ~350 sin perder la forma (el lazo ya trae los vértices de la malla)
  const lazo = densificar(ext.pts, 4);
  const nL = lazo.length;
  for (let i = 0; i < nL; i++) {
    const p = lazo[i], p2 = lazo[(i + 1) % nL];
    const [qx, qy] = rectQ(p[0], p[1]);
    const [qx2, qy2] = rectQ(p2[0], p2[1]);
    const q: [number, number, number] = [qx, qy, p[2]];
    const q2: [number, number, number] = [qx2, qy2, p2[2]];
    const PT: [number, number, number] = [p[0], p[1], bz1];
    const PT2: [number, number, number] = [p2[0], p2[1], bz1];
    const QT: [number, number, number] = [qx, qy, bz1];
    const QT2: [number, number, number] = [qx2, qy2, bz1];
    // falda (no plana: cada tramo lleva SU z)
    caras.push(makeTriFace(oc, p, p2, q2), makeTriFace(oc, p, q2, q));
    // pared interior (sube del lazo a la tapa)
    caras.push(makeTriFace(oc, p, p2, PT2), makeTriFace(oc, p, PT2, PT));
    // pared exterior (sube del borde del bloque a la tapa)
    caras.push(makeTriFace(oc, q, q2, QT2), makeTriFace(oc, q, QT2, QT));
    // tapa superior (anillo)
    caras.push(makeTriFace(oc, PT, PT2, QT2), makeTriFace(oc, PT, QT2, QT));
  }
  knife = solidFromShell(oc, sewFaces(oc, caras, 0.05));
  }
  // ── VENTANAS (lazos internos) = SHUT-OFFS: columna tapada rim→tapa ──────
  // (solo el camino de cuchilla; en partición plana ya quedaron resueltas)
  if (knife) for (const L of loops) {
    if (L.esExterior) continue;
    const rim = densificar(L.pts, 4);
    const n2 = rim.length;
    let rcx = 0, rcy = 0, rcz = 0;
    for (const p of rim) { rcx += p[0]; rcy += p[1]; rcz += p[2]; }
    rcx /= n2; rcy /= n2; rcz /= n2;
    const cs: Shape[] = [];
    for (let i = 0; i < n2; i++) {
      const p = rim[i], p2 = rim[(i + 1) % n2];
      // tapa del shut-off: abanico al centroide del rim (rims casi planos)
      cs.push(makeTriFace(oc, p, p2, [rcx, rcy, rcz]));
      // pared de la columna hasta la tapa del bloque
      const PT: [number, number, number] = [p[0], p[1], bz1];
      const PT2: [number, number, number] = [p2[0], p2[1], bz1];
      cs.push(makeTriFace(oc, p, p2, PT2), makeTriFace(oc, p, PT2, PT));
    }
    // tapa superior de la columna: abanico en bz1
    for (let i = 0; i < n2; i++) {
      const p = rim[i], p2 = rim[(i + 1) % n2];
      cs.push(makeTriFace(oc, [p[0], p[1], bz1], [p2[0], p2[1], bz1], [rcx, rcy, bz1]));
    }
    try {
      const col = solidFromShell(oc, sewFaces(oc, cs, 0.05));
      knife = (volume(oc, col) > 1) ? fuseShapes(oc, knife!, col) : knife;
      report.push(`shut-off: ventana de ${L.pts.length} pts tapada (z≈${rcz.toFixed(1)})`);
    } catch {
      warnings.push(`ventana de ${L.pts.length} pts NO cerró como columna — queda sin shut-off`);
    }
  }
  // ── EL SPLIT (camino de cuchilla) ────────────────────────────────────────
  if (!core || !cavity) {
    const core0 = cut(oc, tmp, knife!);
    // tmp − cuchilla deja el núcleo... y también el BOLSILLO sobre la pieza
    // (dentro del lazo, arriba) como cuerpo SUELTO — ese pertenece a la CAVIDAD.
    // Núcleo = solo los cuerpos que TOCAN el fondo del bloque.
    const cuerpos = uniqueSubShapes(oc, core0, oc.TopAbs_ShapeEnum.TopAbs_SOLID);
    for (const b of cuerpos) {
      const mb = tessellate(oc, b, 1.0, 1.0);
      let zb = Infinity;
      for (let i = 2; i < mb.positions.length; i += 3) zb = Math.min(zb, mb.positions[i]);
      if (zb <= bz0 + 0.5) core = core ? fuseShapes(oc, core, b) : b;
    }
    if (!core) core = core0;
    cavity = cut(oc, tmp, core);
  }
  const vols = { tmp: volume(oc, tmp), cavity: volume(oc, cavity), core: volume(oc, core) };
  const bodies = {
    cavity: uniqueSubShapes(oc, cavity, oc.TopAbs_ShapeEnum.TopAbs_SOLID).length,
    core: uniqueSubShapes(oc, core, oc.TopAbs_ShapeEnum.TopAbs_SOLID).length,
  };
  report.push(`lazos: ${loops.length} (exterior ${ext.pts.length} pts, z ${ext.zMin.toFixed(2)}..${ext.zMax.toFixed(2)})`);
  report.push(`vol: tmp ${vols.tmp.toFixed(0)} = cavidad ${vols.cavity.toFixed(0)} + núcleo ${vols.core.toFixed(0)} (err ${(100 * Math.abs(vols.tmp - vols.cavity - vols.core) / vols.tmp).toFixed(2)} %)`);
  return { cavityPlate: cavity!, corePlate: core!, loops, vols, bodies, report, warnings };
}
