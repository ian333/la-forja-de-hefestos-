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
  /** EL RASTER, para poder DIBUJAR la lámina §11.2.5 y juzgarla a ojo (Fig 11.10/11.11):
   *  wall = la pieza abraza el núcleo ahí · push = hay material que empujar. */
  grid?: {
    nx: number; ny: number; sx: number; sy: number;
    x0: number; y0: number;
    wall: boolean[]; push: boolean[];
  };
  /** el claro exigido del centro del pin al muro (§11.2.5) con este ⌀ */
  keepOutMm: number;
  /** EL EQUILIBRIO (2026-09-21): centroide del ÁREA PROYECTADA de la pieza y centroide
   *  de los pines elegidos, en el MISMO marco local, con el desvío y el tope aplicado. */
  equilibrio?: {
    areaX: number; areaY: number;          // centroide del área proyectada (todas las columnas con material)
    agarreX: number; agarreY: number;      // centroide del AGARRE (columnas de pared/costilla/poste)
    pinesX: number; pinesY: number;        // centroide de los pines colocados
    desvioMm: number;                      // |pines − área|
    topeMm: number;                        // 0.1·L (L = lado mayor de la huella)
    ok: boolean;
    desvioAntesMm: number;                 // lo que daba el greedy por dWall, antes de equilibrar
    nSwaps: number;
  };
  notas: string[];
}

/**
 * LA CABEZA DEL PIN Y SU ALOJAMIENTO — una sola fuente (2026-09-21).
 * §11.2.6 Fig 11.15 Detail D, LITERAL: "a counterbore is provided in the ejector
 * retainer plate to pull the head of the ejector pin(s) away from the parting plane of
 * the mold when the ejector system is reversed. To provide clearance for misalignment
 * of the positions of the ejector holes, the counterbore is provided a GENEROUS
 * tolerance so that the axes of the ejector pins are governed by the mating of the pin
 * with the reamed ejector hole in the core inserts."
 * Y para el pasaje, §11.2.6 LITERAL: "a clearance of 0.5 mm should be sufficient in
 * most molding applications" (tolerancias de barrenado ~0.25 mm).
 *
 * Las medidas de la cabeza (⌀ = cuerpo+4, alto = max(4, min(6, tRet−2))) y del
 * contrataladro (+0.4 locacional, +1 de fondo) son las que YA construye el sólido del
 * molde (`mold-plano-set.ts`, componente 'pines' y contrataladro de 'ejector-ret'):
 * esta función las CENTRALIZA para que la LÁMINA barrene lo mismo que el acero. Antes
 * divergían: la hoja decía «aloj. cabeza ⌀5.381 PASANTE» (la cabeza se cae) y el pasaje
 * de la retenedora iba al ⌀ de la PUNTA (2.881) en vez del CUERPO.
 */
export function ejectorHeadGeom(cuerpoDiaMm: number, retainerThickMm: number) {
  const diaMm = +(cuerpoDiaMm + 4).toFixed(3);
  const thickMm = Math.max(4, Math.min(6, retainerThickMm - 2));
  return {
    diaMm, thickMm,
    /** contrataladro CIEGO en la retenedora, desde su cara INFERIOR (Fig 11.15 Det. D) */
    boreDiaMm: +(diaMm + 0.4).toFixed(3),
    boreDepthMm: +(thickMm + 1).toFixed(2),
    /** pasaje del CUERPO: ⌀ + 0.5 §11.2.6 ("a clearance of 0.5 mm should be sufficient") */
    pasajeDiaMm: +(cuerpoDiaMm + 0.5).toFixed(3),
  };
}

/** El piso REAL bajo un pin: z de la PRIMERA CARA INTERIOR sobre (x,y). */
export interface PisoRayo {
  x: number; y: number;
  /** z local de la cara interior (donde TERMINA el acero del macho). null = el rayo no cruzó 2 caras */
  zMm: number | null;
  /** espesor medido del piso ahí (zMm − cara exterior) — el de VERDAD, no la pared mediana */
  espesorMm: number | null;
  nCruces: number;
}

/**
 * EL RAYO SOBRE LA MALLA — dónde termina el acero del macho de verdad (2026-09-21).
 * ============================================================================
 * `cicloBotadoresPieza` colocaba la punta en `zBaseCerrada − pared MEDIANA`. El piso de
 * una pieza REAL no mide la pared mediana: en `1594C Lid.stp` el piso mide 2.76 y la
 * mediana 3.86 ⇒ las 8 puntas quedaban 1.06 mm HUNDIDAS bajo la cara del macho (un
 * botón de plástico por pin); en `1557BGY` 1.56 hundidas; en `1599HBK` 1.04 METIDAS
 * dentro de la pieza. La pared mediana es un RESUMEN de la pieza, no una cota del piso.
 *
 * Aquí se mide donde importa: un rayo VERTICAL en (x,y) sobre la malla LOCAL (boca
 * arriba, base cerrada en z_min). Subiendo desde abajo, el primer tramo de material es
 * el piso: entra por la cara EXTERIOR y sale por la cara INTERIOR — y ésa es la cara
 * del macho, porque el macho llena el interior. La punta del pin termina AHÍ.
 *
 * Rayo en +Z a propósito (al revés que `solidFromMesh`, que va en +X): aquí lo que se
 * busca son caras HORIZONTALES (el piso), que el rayo vertical cruza de frente. Las
 * paredes verticales quedan de canto y se descartan — no estorban, porque el keepOut
 * §11.2.5 ya aleja al pin de la pared. PURO → node-testeable.
 */
export function pisoInteriorPorRayo(mesh: MeshLike, pts: Array<{ x: number; y: number }>): PisoRayo[] {
  const P = mesh.positions, I = mesh.indices;
  const nTris = Math.floor(I.length / 3);
  return pts.map((p) => {
    const zs: Array<{ z: number; nz: number }> = [];
    for (let t = 0; t < nTris; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const ax = P[a], ay = P[a + 1], az = P[a + 2];
      const bx = P[b], by = P[b + 1], bz = P[b + 2];
      const cx = P[c], cy = P[c + 1], cz = P[c + 2];
      // ¿(x,y) cae dentro del triángulo proyectado en XY? (baricéntricas)
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-12) continue;                       // triángulo de CANTO al rayo (pared vertical)
      const l1 = ((by - cy) * (p.x - cx) + (cx - bx) * (p.y - cy)) / d;
      if (l1 < -1e-9 || l1 > 1 + 1e-9) continue;
      const l2 = ((cy - ay) * (p.x - cx) + (ax - cx) * (p.y - cy)) / d;
      if (l2 < -1e-9 || l2 > 1 + 1e-9) continue;
      const l3 = 1 - l1 - l2;
      if (l3 < -1e-9 || l3 > 1 + 1e-9) continue;
      // normal del triángulo: su componente z dice si entramos (nz<0) o salimos (nz>0) subiendo
      const ux = bx - ax, uy = by - ay, vx = cx - ax, vy = cy - ay;
      zs.push({ z: l1 * az + l2 * bz + l3 * cz, nz: ux * vy - uy * vx });
    }
    if (zs.length < 2) return { x: p.x, y: p.y, zMm: null, espesorMm: null, nCruces: zs.length };
    zs.sort((a, b) => a.z - b.z);
    // dedupe de cruces coincidentes (aristas compartidas entre dos triángulos)
    const u: Array<{ z: number; nz: number }> = [];
    for (const h of zs) if (!u.length || h.z - u[u.length - 1].z > 1e-4) u.push(h);
    if (u.length < 2) return { x: p.x, y: p.y, zMm: null, espesorMm: null, nCruces: u.length };
    // el PRIMER tramo de material desde abajo = el piso: entra en u[0], sale en u[1]
    return { x: p.x, y: p.y, zMm: +u[1].z.toFixed(4), espesorMm: +(u[1].z - u[0].z).toFixed(4), nCruces: u.length };
  });
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
  /** pared nominal de la pieza (mm) — ATA el muestreo vertical y el umbral de
   *  agarre. Sin ella se asume 2 mm y se DECLARA en las notas. */
  wallMm?: number;
}): GripLayout {
  const notas: string[] = [];
  const q = solidFromMesh(mesh);
  const b = q.bbox;
  const H = b.z1 - b.z0 || 1;
  const cell = Math.max(1, o.cellMm ?? 2);
  const nx = Math.max(4, Math.round((b.x1 - b.x0) / cell));
  const ny = Math.max(4, Math.round((b.y1 - b.y0) / cell));
  // MUESTREO VERTICAL atado a la PARED, no a un número fijo. Con NZ=16 sobre la
  // carcasa RPi4 (H=26.5) el paso era 1.66 mm y la lámina de 1.5 mm daba span=0:
  // la mediana salía 0.00 y TODA la pieza se marcaba como agarre. Mismo patrón
  // que la celda del campo de flujo: lo que no resuelve la pared, miente.
  const pared = o.wallMm && o.wallMm > 0 ? o.wallMm : 2;
  if (!o.wallMm) notas.push('pared ASUMIDA 2 mm para el muestreo vertical (no declarada)');
  const NZ = Math.max(16, Math.min(240, Math.ceil(H / Math.max(0.25, pared / 2))));
  const keepOut = o.pinDiaMm + ejectorPinFit(o.pinDiaMm).holeDiaMm / 2 + 1;

  // ── raster de columnas: pared vs empujable ──
  const wall: boolean[] = new Array(nx * ny).fill(false);
  const push: boolean[] = new Array(nx * ny).fill(false);
  const span: number[] = new Array(nx * ny).fill(0);
  const solido: boolean[] = new Array(nx * ny).fill(false);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = b.x0 + (i + 0.5) * ((b.x1 - b.x0) / nx);
    const y = b.y0 + (j + 0.5) * ((b.y1 - b.y0) / ny);
    let lo = Infinity, hi = -Infinity, any = false;
    for (let k = 0; k < NZ; k++) {
      const z = b.z0 + ((k + 0.5) / NZ) * H;
      if (q.inside(x, y, z)) { any = true; if (z < lo) lo = z; if (z > hi) hi = z; }
    }
    if (!any) continue;
    const t = j * nx + i;
    solido[t] = true;
    span[t] = hi - lo;
    if (lo <= b.z0 + Math.max(0.15 * H, 1.5 * cell)) push[t] = true;   // material en el fondo → empujable
  }
  // ── QUÉ ES "AGARRE" (§11.2.5): lo que SOBRESALE del fondo ─────────────────
  // "the ribs and bosses will tend to shrink onto the core and so require
  // nearby ejector pins" — paredes, costillas Y BOSSES, no solo paredes de
  // altura completa. El umbral sale de la PIEZA: una columna agarra si su
  // material sube ≥3 paredes (ya no es lámina de fondo) y ≥¼ de la altura (es
  // una subida real, no una rugosidad). Con 0.55·H la carcasa RPi4 dejaba
  // fuera torres y costillas — lo cazó la LÁMINA, no los números.
  const umbralAgarre = Math.max(3 * pared, 0.25 * H);
  for (let t = 0; t < nx * ny; t++) if (solido[t] && span[t] >= umbralAgarre) wall[t] = true;
  const nSolidas = push.filter(Boolean).length + wall.filter((w, t) => w && !push[t]).length;
  const nParedes = wall.filter(Boolean).length;
  // pieza PLANA (sin paredes) o MACIZA (toda columna abarca la altura): el agarre
  // es uniforme y la rejilla NO es el antipatrón §11.2.5 — se declara, no se fuerza
  if (!nParedes || nParedes > 0.8 * Math.max(1, nSolidas)) {
    notas.push(nParedes
      ? 'pieza maciza/plana (toda columna abarca la altura): el agarre es uniforme — la rejilla no es antipatrón aquí'
      : 'sin columnas de PARED (pieza plana sin costillas): el agarre es uniforme y la rejilla no es antipatrón aquí');
    return { positions: [], centered: [], nParedes: 0, nCandidatos: 0, keepOutMm: keepOut,
      grid: { nx, ny, sx: (b.x1 - b.x0) / nx, sy: (b.y1 - b.y0) / ny, x0: b.x0, y0: b.y0, wall, push }, notas };
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
  const selIdx: number[] = [];
  for (let k = 0; k < candidatos.length; k++) {
    if (selIdx.length >= o.nPins) break;
    const c = candidatos[k];
    if (selIdx.every((s) => Math.hypot(candidatos[s].x - c.x, candidatos[s].y - c.y) >= sep)) selIdx.push(k);
  }

  // ── EL EQUILIBRIO (2026-09-21) — la mitad que faltaba de §11.2.5 ──────────────
  // El greedy por dWall coloca donde MÁS agarra, y se apiña de un lado: medido en las
  // 4 piezas del plan, el centroide de los 8 pines caía a 15.6 mm del centro en la
  // carcasa (6 pines arriba, 2 abajo), 32.5 mm en la 1599HBK (4 en fila sobre UNA
  // orilla) y 11.5 mm en la 1557BGY. LO QUE DICE EL LIBRO, literal:
  //   §11.2.5: "By placing the ejector pin far from these two sticking points, a
  //             significant moment and deflection will be applied before the molding
  //             is stripped off the core."
  //   §11.3.4: "unbalanced ejection forces can lead to uneven wear in the mold."
  // O sea: el libro nombra el MOMENTO y el DESGASTE, pero NO da un número de desvío.
  // EL NÚMERO ES NUESTRO — REGLA NUESTRA, sin cita: el centroide de los pines a
  // ≤ 0.1·L del centroide del ÁREA PROYECTADA (L = lado mayor de la huella). Razón:
  // 0.1·L es el desvío que la propia rejilla de referencia produce (media celda de una
  // malla 4×4 sobre la huella) — pedir menos sería inventar precisión que la colocación
  // por agarre no tiene, y pedir más deja pasar el caso 4-en-una-orilla que ya medimos.
  // CÓMO: no se abandona §11.2.5 — todos los candidatos siguen dentro de la banda
  // [keepOut, keepOut+6] de una pared/costilla/poste, así que CUALQUIER intercambio
  // conserva la proximidad al agarre; solo se cambia CUÁL de esos candidatos se usa.
  let aX = 0, aY = 0, aN = 0, gX = 0, gY = 0, gN = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const t = j * nx + i; if (!solido[t]) continue;
    const x = b.x0 + (i + 0.5) * sx, y = b.y0 + (j + 0.5) * sy;
    aX += x; aY += y; aN++;
    if (wall[t]) { gX += x; gY += y; gN++; }
  }
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const areaX = aN ? aX / aN : cx, areaY = aN ? aY / aN : cy;
  const agarreX = gN ? gX / gN : areaX, agarreY = gN ? gY / gN : areaY;
  const topeMm = 0.1 * Math.max(b.x1 - b.x0, b.y1 - b.y0);
  const desvioDe = (idx: number[]) => {
    if (!idx.length) return 0;
    let X = 0, Y = 0; for (const k of idx) { X += candidatos[k].x; Y += candidatos[k].y; }
    return Math.hypot(X / idx.length - areaX, Y / idx.length - areaY);
  };
  const desvioAntesMm = desvioDe(selIdx);
  let desvioMm = desvioAntesMm, nSwaps = 0;
  for (let iter = 0; iter < 60 && desvioMm > topeMm; iter++) {
    let mejorD = desvioMm, mejorS = -1, mejorA = -1;
    for (let s = 0; s < selIdx.length; s++) {
      for (let a = 0; a < candidatos.length; a++) {
        if (selIdx.indexOf(a) >= 0) continue;
        const ca = candidatos[a];
        if (!selIdx.every((k, n) => n === s || Math.hypot(candidatos[k].x - ca.x, candidatos[k].y - ca.y) >= sep)) continue;
        const probe = selIdx.slice(); probe[s] = a;
        const d = desvioDe(probe);
        if (d < mejorD - 1e-6) { mejorD = d; mejorS = s; mejorA = a; }
      }
    }
    if (mejorS < 0) break;                                   // ningún intercambio mejora: se DECLARA, no se fuerza
    selIdx[mejorS] = mejorA; desvioMm = mejorD; nSwaps++;
  }
  const sel = selIdx.map((k) => ({ x: +candidatos[k].x.toFixed(1), y: +candidatos[k].y.toFixed(1) }));
  const equilibrio = {
    areaX: +areaX.toFixed(2), areaY: +areaY.toFixed(2),
    agarreX: +agarreX.toFixed(2), agarreY: +agarreY.toFixed(2),
    pinesX: +(sel.reduce((s, p) => s + p.x, 0) / (sel.length || 1)).toFixed(2),
    pinesY: +(sel.reduce((s, p) => s + p.y, 0) / (sel.length || 1)).toFixed(2),
    desvioMm: +desvioMm.toFixed(2), topeMm: +topeMm.toFixed(2), ok: desvioMm <= topeMm + 1e-9,
    desvioAntesMm: +desvioAntesMm.toFixed(2), nSwaps,
  };
  if (sel.length < o.nPins) {
    notas.push(`solo ${sel.length} de ${o.nPins} pines caben JUNTO al agarre (keepOut ${keepOut.toFixed(1)} mm, separación ${sep.toFixed(0)} mm) — el resto se declara, no se inventa: subir ⌀ chico o aceptar menos pines §11.2.4`);
  }
  notas.push(`${nParedes} columnas de pared · ${candidatos.length} candidatos junto al agarre · ${sel.length} pines colocados (§11.2.5 Fig 11.11)`);
  notas.push(equilibrio.ok
    ? `EQUILIBRIO: centroide de los pines a ${equilibrio.desvioMm} mm del centroide del área proyectada (tope 0.1·L = ${equilibrio.topeMm} mm, REGLA NUESTRA) — ${nSwaps} intercambios desde ${equilibrio.desvioAntesMm} mm`
    : `⚠ EQUILIBRIO NO ALCANZADO: ${equilibrio.desvioMm} mm > tope ${equilibrio.topeMm} mm (desde ${equilibrio.desvioAntesMm} mm, ${nSwaps} intercambios) — con estos candidatos §11.2.5 no hay reparto mejor: se DECLARA (subir nPins o bajar ⌀)`);

  return {
    positions: sel,
    centered: sel.map((p) => ({ x: +(p.x - cx).toFixed(1), y: +(p.y - cy).toFixed(1) })),
    nParedes, nCandidatos: candidatos.length, keepOutMm: keepOut,
    grid: { nx, ny, sx, sy, x0: b.x0, y0: b.y0, wall, push },
    equilibrio,
    notas,
  };
}
