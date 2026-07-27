/**
 * FLUJO DEL CURSO (PROCESO-1 — percha, Alwis 2022) como operaciones del KERNEL.
 * ============================================================================
 * Cada función = un BOTÓN del pipeline del curso en la UI (pestaña Mold Tools):
 *   1) insertarPercha      — Insert > Part          (pieza del curso, silueta DECLARADA)
 *   2) escalaContraccion   — Insert > Features > Scale (1.015, PP — cota del curso)
 *   3) layoutDosCavidades  — Move/Copy Body          (copia rotada; adaptación DECLARADA
 *                            ±90° Z a ∓5 mm: nuestro layout verificado sin traslape;
 *                            el curso usa Y 90° + ΔX 40 + copia de superficies a 180°)
 *   4) lineaParticion      — Mold Tools > Parting Lines (transición +/− del draft;
 *                            el "mensaje VERDE" del curso como invariante medible)
 *   5) toolingSplitCurso   — Tooling Split + Boss-Extrude "Up To Surface" en UNO:
 *                            nuestro split ya entrega placas RECTANGULARES exactas
 *                            (350×630, alturas 145/90 del curso) — la automatización
 *                            que PROCESOS-REPETITIVOS marcó como #1.
 *   6) guiasCurso          — Hole Wizard: pernos Ø35 pasante + caja Ø40×8 (placa núcleo)
 *                            y bushings Ø48 pasante + caja Ø54×10 (placa cavidad),
 *                            posiciones ±142 / ±277 — cotas literales del curso.
 * Reglas: cotas del MOLDE literales; extensiones/adaptaciones DECLARADAS en report.
 */
import type { OC, Shape, SketchPlane3D } from '../brep/occt';
import {
  extrudePolygon, extrudePolygonWithHoles, fuse, cut, common, volume,
  transformShape, makeBox, makeCylinder, tessellate, uniqueSubShapes,
  PLANE_XZ, PLANE_XY,
} from '../brep/occt';
import { scaleForShrinkage } from './mold';
import { partingLoops, type PartingLoop } from './parting';
import { carvedInserts } from './mold-plano-set';

interface CarveMesh { positions: Float32Array; normals: Float32Array; indices: Uint32Array; }

/** El "mensaje verde" del curso, literal (criterio de éxito de Parting Lines). */
export const MENSAJE_VERDE = 'La línea de partición está completa. El molde puede separarse en núcleo y cavidad.';

// ── 1) INSERT > PART — la percha (silueta DECLARADA a proporción del curso) ──
/** fuerza bobinado CCW (área firmada > 0); `common()` de OCCT crashea con perfiles CW. */
function ccw(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const clean = pts.filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) > 1e-6);
  let A = 0;
  for (let i = 0; i < clean.length; i++) { const p = clean[i], q = clean[(i + 1) % clean.length]; A += p.x * q.y - q.x * p.y; }
  return A < 0 ? clean.slice().reverse() : clean;
}

/** arco tangente por 3 puntos aproximado como polilínea de n segmentos entre a y b,
 *  abombando 'sag' mm hacia +perp (útil para las curvas suaves R850/R1500 del curso). */
function arcoSag(a: [number, number], b: [number, number], sag: number, n = 10): Array<[number, number]> {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const px = -dy / L, py = dx / L;   // perpendicular unitaria
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 4 * sag * t * (1 - t);   // parábola: 0 en extremos, sag en medio
    out.push([a[0] + dx * t + px * s, a[1] + dy * t + py * s]);
  }
  return out;
}

/**
 * INSERT > PART — la PERCHA REAL del curso (Alwis `FhcyQAuOGh8`, ver PROCESO-0).
 * Técnica del curso reproducida: **silueta FRONTAL (Sketch2) ∩ planta ARQUEADA
 * (Sketch3, Cut Mid-Plane 320)** — dos extrusiones cruzadas cuya intersección da
 * los brazos que CURVAN en 3D → línea de partición NO plana (lo que la percha
 * inventada v1 esquivaba). Marco X=ancho, Y=profundidad, Z=arriba; pull=+Z.
 * Cotas CONFIRMADAS del curso: front W425·H140, cuello 85/70, brazo z~90; planta
 * R1500/R1200 ancho 420. Extensiones DECLARADAS (PROCESO-0 §4): sin Shell (sólida),
 * sin boss-gancho/nervaduras/muescas (detalle interior; no tocan la partición).
 */
export function insertarPercha(oc: OC): { shape: Shape; volMm3: number; report: string[] } {
  // ── SILUETA FRONTAL (Sketch2) en XZ: joroba del cuello a Z=140, brazos que
  //    bajan a ~Z=74 en la punta (X=±212.5), envolvente 425×140 del curso ──
  const topR: Array<[number, number]> = [
    [0, 140], [30, 139],
    ...arcoSag([30, 139], [60, 120], 3, 4),     // hombro del cuello (R80/R100)
    ...arcoSag([60, 120], [212.5, 74], 10, 12),  // brazo derecho: curva suave (R850/R4000)
  ];
  const botR: Array<[number, number]> = [
    [212.5, 52],
    ...arcoSag([212.5, 52], [60, 34], -8, 12),   // panza inferior del brazo
    ...arcoSag([60, 34], [0, 30], -1, 3),
  ];
  const half = [...topR, ...botR];
  const mirror = half.slice(1, -1).reverse().map(([x, z]) => [-x, z] as [number, number]);
  const frontPts = ccw([...half, ...mirror].map(([x, z]) => ({ x, y: z })));   // (u=X, v=Z), CCW obligatorio o common() crashea
  const DEPTH = 120;
  const frontPrism = transformShape(oc,
    extrudePolygon(oc, frontPts, DEPTH, PLANE_XZ as SketchPlane3D),
    { translate: [0, DEPTH / 2, 0] });   // PLANE_XZ extruye a −Y ⇒ centra en Y

  // ── PLANTA ARQUEADA (Sketch3) en XY: creciente R1500 (frente) / R1200 (dorso),
  //    ancho 420; da a los brazos su barrido hacia atrás (profundidad ~43mm) ──
  const sag1500 = 1500 - Math.sqrt(1500 * 1500 - 210 * 210);   // 14.8
  const sag1200 = 1200 - Math.sqrt(1200 * 1200 - 210 * 210);   // 18.5
  const planTop = arcoSag([-210, 12.5 - sag1500], [210, 12.5 - sag1500], sag1500, 24)
    .map(([x, y]) => ({ x, y }));
  const planBot = arcoSag([210, -12.5 - sag1200], [-210, -12.5 - sag1200], -sag1200, 24)
    .map(([x, y]) => ({ x, y }));
  const planPts = ccw([...planTop, ...planBot]);
  const HZ = 200;
  const planPrism = transformShape(oc,
    extrudePolygon(oc, planPts, HZ, PLANE_XY as SketchPlane3D),
    { translate: [0, 0, -10] });   // cubre Z∈[−10,190] ⊃ silueta [30,140]

  // ── Cut-Extrude1 Mid-Plane 320 + Flip = la INTERSECCIÓN de los dos prismas ──
  const percha = common(oc, frontPrism, planPrism);
  const v = volume(oc, percha);
  return {
    shape: percha, volMm3: v,
    report: [`Insert > Part: PERCHA REAL (curso Alwis FhcyQAuOGh8) — silueta 425×140 ∩ planta R1500/R1200 (Cut Mid-Plane 320), vol ${v.toFixed(0)} mm³`],
  };
}

// ── 2) SCALE — contracción del plástico (curso: PP → 1.015, about Origin) ────
export function escalaContraccion(
  oc: OC, pieza: Shape, factor = 1.015,
): { shape: Shape; volAntes: number; volDespues: number; report: string[] } {
  const volAntes = volume(oc, pieza);
  const shape = scaleForShrinkage(oc, pieza, factor);
  const volDespues = volume(oc, shape);
  return {
    shape, volAntes, volDespues,
    report: [
      `Scale: about Origin, uniforme, ×${factor} (PP 1.5% — cota del curso)`,
      `vol ${volAntes.toFixed(0)} → ${volDespues.toFixed(0)} mm³ (×${(volDespues / volAntes).toFixed(4)} ≈ ${factor}³=${(factor ** 3).toFixed(4)})`,
    ],
  };
}

// ── 3) MOVE/COPY BODY — layout de 2 cavidades (adaptación DECLARADA) ─────────
// SIN fuse: en el WASM del navegador el fuse de dos perchas completas revienta la
// memoria de la pestaña (cazado en el smoke 2026-07-19). Los cuerpos viven
// SEPARADOS (como los Move/Copy del curso) y el no-traslape se verifica por las
// BANDAS bbox de cada copia — mismo invariante, cero booleano.
export function layoutDosCavidades(
  oc: OC, piezaE: Shape,
): { cuerpos: [Shape, Shape]; volUno: number; volTotal: number; sinTraslape: boolean; report: string[] } {
  const bbX = (s: Shape): [number, number] => {
    const m = tessellate(oc, s, 1.0, 1.0);
    let a = Infinity, b = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) { a = Math.min(a, m.positions[i]); b = Math.max(b, m.positions[i]); }
    return [a, b];
  };
  // rota ±90° Z (eje largo de la percha pasa a Y, como el curso) y SEPARA las dos
  // cavidades en X por el ANCHO ROTADO real + holgura — la percha real es larga y
  // angosta (≠ el marco compacto inventado v1, donde ∓5 bastaba). Offset adaptativo.
  const rot = (sgn: number) => transformShape(oc, piezaE, { rotateAngle: sgn * Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [0, 0, 0] });
  const [rx0, rx1] = bbX(rot(1));
  const off = (rx1 - rx0) / 2 + 12;   // media anchura rotada + 12 mm de pared entre cavidades
  const cav1 = transformShape(oc, piezaE, { rotateAngle: Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [-off, 0, 0] });
  const cav2 = transformShape(oc, piezaE, { rotateAngle: -Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [off, 0, 0] });
  const volUno = volume(oc, cav1);
  const [x0a, x1a] = bbX(cav1), [x0b, x1b] = bbX(cav2);
  const sinTraslape = x1a <= x0b + 1e-6 || x1b <= x0a + 1e-6;
  return {
    cuerpos: [cav1, cav2], volUno, volTotal: 2 * volUno, sinTraslape,
    report: [
      `Move/Copy Body: copia rotada ±90° Z, centros ∓${off.toFixed(0)} mm (adaptación DECLARADA del layout del curso: Y 90° + ΔX + copia 180°)`,
      `bandas X [${x0a.toFixed(0)},${x1a.toFixed(0)}] y [${x0b.toFixed(0)},${x1b.toFixed(0)}] — ${sinTraslape ? 'SIN traslape ✓' : '¡TRASLAPE!'}`,
    ],
  };
}

/** sopa de mallas: teselación de N cuerpos CONCATENADA (para partingLoops). */
function meshSoup(oc: OC, bodies: Shape[], deflection: number): { positions: Float32Array; indices: Uint32Array } {
  const parts = bodies.map((b) => tessellate(oc, b, deflection, deflection));
  let nP = 0, nI = 0;
  for (const m of parts) { nP += m.positions.length; nI += m.indices.length; }
  const positions = new Float32Array(nP); const indices = new Uint32Array(nI);
  let oP = 0, oI = 0;
  for (const m of parts) {
    positions.set(m.positions, oP);
    for (let i = 0; i < m.indices.length; i++) indices[oI + i] = m.indices[i] + oP / 3;
    oP += m.positions.length; oI += m.indices.length;
  }
  return { positions, indices };
}

// ── 4) PARTING LINES — transición +/− del draft + mensaje verde ──────────────
export function lineaParticion(
  oc: OC, bodies: Shape[], deflection = 0.4,
): { loops: PartingLoop[]; nVertices: number; plana: boolean; mensaje: string; ok: boolean; report: string[] } {
  const mesh = meshSoup(oc, bodies, deflection);
  const { loops, warnings } = partingLoops(mesh);
  const ext = loops.find((L) => L.esExterior);
  const ok = !!ext && loops.length >= 1 && warnings.length === 0;
  const mensaje = ok ? MENSAJE_VERDE : `ADVERTENCIA: ${warnings.join('; ') || 'sin lazo exterior'} — puede requerir shut-off surfaces.`;
  return {
    loops, nVertices: ext?.pts.length ?? 0, plana: !!ext && ext.zMax - ext.zMin < 0.05, mensaje, ok,
    report: [
      `Parting Lines: pull +Z, transición +/− → ${loops.length} lazo(s) en ${bodies.length} cuerpo(s), exterior ${ext?.pts.length ?? 0} vértices (el curso pica 18 aristas a mano)`,
      mensaje,
    ],
  };
}

// ── 5) TOOLING SPLIT (+ regularización en UNO): placas 350×630, 145/90 ──────
// Multi-cuerpo SIN fuse: partición PLANA (la de la percha) → cada mitad =
// su caja − cuerpo₁ − cuerpo₂ (cuts secuenciales, nunca un fuse gigante).
export function toolingSplitCurso(
  oc: OC, bodies: Shape[],
  opts?: { blockWMm?: number; blockDMm?: number; plateTopMm?: number; plateBottomMm?: number; deflection?: number },
): {
  cavityPlate: Shape; corePlate: Shape;
  vols: { tmp: number; cavity: number; core: number };
  bodies: { cavity: number; core: number };
  report: string[]; warnings: string[];
  dims: { W: number; D: number; top: number; bottom: number };
} {
  const dims = {
    W: opts?.blockWMm ?? 350, D: opts?.blockDMm ?? 630,
    top: opts?.plateTopMm ?? 145, bottom: opts?.plateBottomMm ?? 90,
  };
  const soup = meshSoup(oc, bodies, opts?.deflection ?? 0.4);
  const { loops, warnings } = partingLoops(soup);
  const ext = loops.find((L) => L.esExterior);
  if (!ext) throw new Error('toolingSplitCurso: sin lazo exterior de partición');
  if (ext.zMax - ext.zMin >= 0.05)
    // La percha REAL tiene partición NO plana (trepa ~23mm por los brazos). El
    // camino de cuchilla de parting.ts (falda RADIAL desde el centroide) exige
    // lazos estrella-convexos; una percha larga y curva NO lo es → la falda se
    // auto-interseca (booleano de minutos). La ruta correcta = tallado por
    // heightfield (carvedInserts, tarea #22) — pendiente de cablear aquí (v2).
    throw new Error(`Partición NO PLANA (Δz=${(ext.zMax - ext.zMin).toFixed(0)}mm, trepa los brazos): la percha REAL necesita tallado por heightfield (v2), no la partición plana. Geometría de la pieza ✓, split del molde pendiente.`);
  const zc = (ext.zMin + ext.zMax) / 2;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < soup.positions.length; i += 3) {
    x0 = Math.min(x0, soup.positions[i]); x1 = Math.max(x1, soup.positions[i]);
    y0 = Math.min(y0, soup.positions[i + 1]); y1 = Math.max(y1, soup.positions[i + 1]);
  }
  const bcx = (x0 + x1) / 2, bcy = (y0 + y1) / 2;
  const warns = [...warnings];
  if (x1 - x0 > dims.W || y1 - y0 > dims.D) warns.push(`el layout (${(x1 - x0).toFixed(0)}×${(y1 - y0).toFixed(0)}) SOBRESALE del bloque ${dims.W}×${dims.D}`);
  const boxB = transformShape(oc, makeBox(oc, dims.W, dims.D, dims.bottom), { translate: [bcx - dims.W / 2, bcy - dims.D / 2, zc - dims.bottom] });
  const boxT = transformShape(oc, makeBox(oc, dims.W, dims.D, dims.top), { translate: [bcx - dims.W / 2, bcy - dims.D / 2, zc] });
  let core: Shape = boxB, cavity: Shape = boxT;
  let volPiezas = 0;
  for (const b of bodies) { core = cut(oc, core, b); cavity = cut(oc, cavity, b); volPiezas += volume(oc, b); }
  const vols = {
    tmp: dims.W * dims.D * (dims.top + dims.bottom) - volPiezas,
    cavity: volume(oc, cavity), core: volume(oc, core),
  };
  const nb = {
    cavity: uniqueSubShapes(oc, cavity, oc.TopAbs_ShapeEnum.TopAbs_SOLID).length,
    core: uniqueSubShapes(oc, core, oc.TopAbs_ShapeEnum.TopAbs_SOLID).length,
  };
  const report = [
    `Tooling Split: bloque ${dims.W}×${dims.D}, placas ${dims.top}/${dims.bottom} (cotas del curso) — split + regularización en UNA operación`,
    `partición PLANA (z=${zc.toFixed(2)}): cada mitad = caja − cuerpos (sin fuse)`,
    `vol: bloque−piezas ${vols.tmp.toFixed(0)} = cavidad ${vols.cavity.toFixed(0)} + núcleo ${vols.core.toFixed(0)} (err ${(100 * Math.abs(vols.tmp - vols.cavity - vols.core) / vols.tmp).toFixed(2)} %)`,
  ];
  return { cavityPlate: cavity, corePlate: core, vols, bodies: nb, report, warnings: warns, dims };
}

// ── 5b) TOOLING SPLIT NO PLANO (percha real) — TALLADO por HEIGHTFIELD ────────
// La percha real curva su partición (trepa ~23mm) y NO es estrella-convexa → la
// cuchilla cosida se cuelga. Ruta robusta (tarea #22): rasterizar z_max/z_min de
// las piezas y tallar los insertos como heightfield pulido — cero booleano, cero
// cuelgue. Devuelve MALLAS (no B-Rep): la cavidad ES la impronta de las perchas.
export function toolingSplitCursoCarve(
  oc: OC, bodies: Shape[],
  opts?: { blockWMm?: number; blockDMm?: number; plateTopMm?: number; plateBottomMm?: number; deflection?: number },
): {
  cavMesh: CarveMesh; coreMesh: CarveMesh;
  dims: { W: number; D: number; top: number; bottom: number };
  zPart: number; deltaZ: number; report: string[]; warnings: string[];
} {
  const dims = {
    W: opts?.blockWMm ?? 350, D: opts?.blockDMm ?? 630,
    top: opts?.plateTopMm ?? 145, bottom: opts?.plateBottomMm ?? 90,
  };
  const soup = meshSoup(oc, bodies, opts?.deflection ?? 0.35);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const P = soup.positions;
  for (let i = 0; i < P.length; i += 3) {
    x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]);
    y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]);
    z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]);
  }
  const bcx = (x0 + x1) / 2, bcy = (y0 + y1) / 2;
  const zPart = z0;   // datum en la base de las piezas; la impronta sube desde ahí
  const carved = carvedInserts(soup, [{ cx: bcx, cy: bcy }], zPart, dims.W, dims.D, dims.top, dims.bottom);
  if (!carved) throw new Error('toolingSplitCursoCarve: la malla no produjo heightfield');
  const warnings: string[] = [];
  if (x1 - x0 > dims.W || y1 - y0 > dims.D) warnings.push(`layout (${(x1 - x0).toFixed(0)}×${(y1 - y0).toFixed(0)}) SOBRESALE del bloque ${dims.W}×${dims.D}`);
  return {
    cavMesh: carved.cav, coreMesh: carved.core, dims, zPart, deltaZ: z1 - z0,
    warnings,
    report: [
      `Tooling Split NO PLANO: partición CURVA (la percha no es estrella-convexa) → TALLADO por heightfield en 0.5s, no cuchilla cosida (que se colgaba 6min)`,
      `insertos ${dims.W}×${dims.D}, cavidad ${dims.top} / núcleo ${dims.bottom} — la HEMBRA es la impronta real de las perchas (prof ${(z1 - z0).toFixed(0)}mm), el MACHO su reverso`,
      `superficie de partición = z_max(pieza) para la cavidad, z_min para el núcleo (separación A/B, tarea #22)`,
    ],
  };
}

// ── 6) HOLE WIZARD — guías del curso en ±142/±277 ────────────────────────────
export function guiasCurso(
  oc: OC, cavity: Shape, core: Shape,
  opts?: { posX?: number; posY?: number; plateTopMm?: number; plateBottomMm?: number; zPartMm?: number },
): { cavity: Shape; core: Shape; volQuitadoCav: number; volQuitadoCore: number; report: string[] } {
  const px = opts?.posX ?? 142, py = opts?.posY ?? 277;
  const top = opts?.plateTopMm ?? 145, bottom = opts?.plateBottomMm ?? 90;
  const zP = opts?.zPartMm ?? 0;
  const cil = (r: number, h: number, o: [number, number, number]) => makeCylinder(oc, r, h, { origin: o, dir: [0, 0, 1] });
  const v0c = volume(oc, cavity), v0n = volume(oc, core);
  let cav = cavity, cor = core;
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const x = px * sx, y = py * sy;
    // placa CAVIDAD (superior): bushing ⌀48 pasante + caja ⌀54×10 en la cara exterior
    cav = cut(oc, cav, fuse(oc, cil(24, top + 2, [x, y, zP - 1]), cil(27, 10.2, [x, y, zP + top - 10.1])));
    // placa NÚCLEO (inferior): perno ⌀35 pasante + caja ⌀40×8 en la cara exterior
    cor = cut(oc, cor, fuse(oc, cil(17.5, bottom + 2, [x, y, zP - bottom - 1]), cil(20, 8.2, [x, y, zP - bottom - 0.1])));
  }
  const volQuitadoCav = v0c - volume(oc, cav);
  const volQuitadoCore = v0n - volume(oc, cor);
  return {
    cavity: cav, core: cor, volQuitadoCav, volQuitadoCore,
    report: [
      `Hole Wizard: 4× bushing ⌀48 pasante + caja ⌀54×10 (cavidad) y 4× perno ⌀35 pasante + caja ⌀40×8 (núcleo), en ±${px}/±${py} — cotas del curso`,
      `acero removido: cavidad ${volQuitadoCav.toFixed(0)} mm³ · núcleo ${volQuitadoCore.toFixed(0)} mm³`,
    ],
  };
}
