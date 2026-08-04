/**
 * LAYOUT DE EXPULSORES POR AGARRE — §11.2.5, la SEGUNDA mitad de la frase.
 * ============================================================================
 * El libro no solo pide pines más chicos: pide "smaller AND MORE STRATEGICALLY
 * LOCATED". §11.2.5 LITERAL: "ejectors will be more effective when placed near
 * the locations where the ejection forces are generated" — y la fuerza se genera
 * donde la pieza ABRAZA el núcleo al contraer: paredes laterales y costillas
 * (Fig 11.10 = el antipatrón lejos de las paredes; Fig 11.11 = pines cerca de
 * las paredes; Fig 11.12 = bajo la costilla con pad).
 *
 * La rejilla uniforme es el antipatrón NOMBRADO: "A common but ineffective
 * layout arises when ejector pins are uniformly distributed across the mold
 * cavity" — con el pin lejos del agarre, el momento deforma la pieza antes de
 * despegarla.
 *
 * CÓMO (sin conocer la figura, igual que flowlen): se rasteriza la malla en
 * columnas con `solidFromMesh` —
 *   PARED  = columna cuyo material abarca ≥55 % de la altura (ahí agarra)
 *   EMPUJABLE = columna con material en el fondo (el pin empuja desde abajo
 *               sobre área rígida, no sobre el aire)
 *   CANDIDATO = empujable a distancia [keepOut, keepOut+6] de una pared
 *               (cerca §11.2.5 Fig 11.11, pero con el acero del barreno a salvo)
 * y se eligen nPins con separación mínima, los más pegados al agarre primero.
 * Lo que no alcanza se DECLARA (el resto lo cubre la rejilla, no se inventa).
 * PURO → node-testeable.
 */
import { solidFromMesh, type MeshLike } from './flowlen-mesh';
import { ejectorPinFit } from './fits';

export interface GripLayout {
  /** posiciones en coords LOCALES de la pieza (mm, mismo marco que la malla) */
  positions: Array<{ x: number; y: number }>;
  /** posiciones RELATIVAS al centro de la huella (para el ensamble multi-cavidad) */
  centered: Array<{ x: number; y: number }>;
  nParedes: number; nCandidatos: number;
  notas: string[];
}

/**
 * Coloca `nPins` expulsores donde la pieza SE PEGA (§11.2.5). `keepOut` = la
 * distancia mínima del centro del pin a la pared moldeante: 1⌀ de acero +
 * ½ barreno + 1 de guarda — la misma regla que el colocador de rejilla.
 */
export function gripEjectorLayout(mesh: MeshLike, o: {
  nPins: number; pinDiaMm: number;
  /** celda del raster (mm). Default 2. */
  cellMm?: number;
}): GripLayout {
  const notas: string[] = [];
  const q = solidFromMesh(mesh);
  const b = q.bbox;
  const H = b.z1 - b.z0 || 1;
  const cell = Math.max(1, o.cellMm ?? 2);
  const nx = Math.max(4, Math.round((b.x1 - b.x0) / cell));
  const ny = Math.max(4, Math.round((b.y1 - b.y0) / cell));
  const NZ = 16;                                          // muestreo vertical por columna
  const keepOut = o.pinDiaMm + ejectorPinFit(o.pinDiaMm).holeDiaMm / 2 + 1;

  // ── raster de columnas: pared vs empujable ──
  const wall: boolean[] = new Array(nx * ny).fill(false);
  const push: boolean[] = new Array(nx * ny).fill(false);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = b.x0 + (i + 0.5) * ((b.x1 - b.x0) / nx);
    const y = b.y0 + (j + 0.5) * ((b.y1 - b.y0) / ny);
    let lo = Infinity, hi = -Infinity, any = false;
    for (let k = 0; k < NZ; k++) {
      const z = b.z0 + ((k + 0.5) / NZ) * H;
      if (q.inside(x, y, z)) { any = true; if (z < lo) lo = z; if (z > hi) hi = z; }
    }
    if (!any) continue;
    const span = hi - lo;
    if (span >= 0.55 * H) wall[j * nx + i] = true;        // abraza el núcleo → agarre
    if (lo <= b.z0 + Math.max(0.15 * H, 1.5 * cell)) push[j * nx + i] = true;  // material en el fondo → empujable
  }
  const nSolidas = push.filter(Boolean).length + wall.filter((w, t) => w && !push[t]).length;
  const nParedes = wall.filter(Boolean).length;
  // pieza PLANA (sin paredes) o MACIZA (toda columna abarca la altura): el agarre
  // es uniforme y la rejilla NO es el antipatrón §11.2.5 — se declara, no se fuerza
  if (!nParedes || nParedes > 0.8 * Math.max(1, nSolidas)) {
    notas.push(nParedes
      ? 'pieza maciza/plana (toda columna abarca la altura): el agarre es uniforme — la rejilla no es antipatrón aquí'
      : 'sin columnas de PARED (pieza plana sin costillas): el agarre es uniforme y la rejilla no es antipatrón aquí');
    return { positions: [], centered: [], nParedes: 0, nCandidatos: 0, notas };
  }

  // ── distancia de cada columna empujable a la pared más cercana (mm) ──
  const sx = (b.x1 - b.x0) / nx, sy = (b.y1 - b.y0) / ny;
  const wallCells: Array<[number, number]> = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (wall[j * nx + i]) wallCells.push([i, j]);
  const candidatos: Array<{ x: number; y: number; dWall: number }> = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const t = j * nx + i;
    if (!push[t] || wall[t]) continue;                    // sobre la pared misma no: el pin va JUNTO, no encima
    let d2 = Infinity;
    for (const [wi, wj] of wallCells) {
      const dx = (i - wi) * sx, dy = (j - wj) * sy;
      const dd = dx * dx + dy * dy;
      if (dd < d2) d2 = dd;
    }
    const d = Math.sqrt(d2);
    const x = b.x0 + (i + 0.5) * sx, y = b.y0 + (j + 0.5) * sy;
    // el BORDE de la huella también es pared moldeante (la del pocket): el pin
    // le debe el mismo keepOut §11.2.5 — sin esto, un candidato junto a un boss
    // interior podía quedar a 3 mm del muro exterior (RPi4: acero −2.07, cazado)
    const dBorde = Math.min(x - b.x0, b.x1 - x, y - b.y0, b.y1 - y);
    if (d >= keepOut && d <= keepOut + 6 && dBorde >= keepOut) {  // CERCA (Fig 11.11) con el acero a salvo
      candidatos.push({ x, y, dWall: d });
    }
  }
  candidatos.sort((a, c) => a.dWall - c.dWall);           // lo más pegado al agarre primero

  // ── selección greedy con separación mínima ──
  const sep = Math.max(8, 2.5 * o.pinDiaMm);
  const sel: Array<{ x: number; y: number }> = [];
  for (const c of candidatos) {
    if (sel.length >= o.nPins) break;
    if (sel.every((s) => Math.hypot(s.x - c.x, s.y - c.y) >= sep)) sel.push({ x: +c.x.toFixed(1), y: +c.y.toFixed(1) });
  }
  if (sel.length < o.nPins) {
    notas.push(`solo ${sel.length} de ${o.nPins} pines caben JUNTO al agarre (keepOut ${keepOut.toFixed(1)} mm, separación ${sep.toFixed(0)} mm) — el resto se declara, no se inventa: subir ⌀ chico o aceptar menos pines §11.2.4`);
  }
  notas.push(`${nParedes} columnas de pared · ${candidatos.length} candidatos junto al agarre · ${sel.length} pines colocados (§11.2.5 Fig 11.11)`);

  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return {
    positions: sel,
    centered: sel.map((p) => ({ x: +(p.x - cx).toFixed(1), y: +(p.y - cy).toFixed(1) })),
    nParedes, nCandidatos: candidatos.length, notas,
  };
}
