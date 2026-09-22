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
  /** EL PIN SE MUEVE ANTES QUE EL AGUA (ian 2026-09-22, pregunta 5): solo con `o.evitar`.
   *  `antes` = el reparto sin mirar el agua (el de siempre) · `movidos` = cuántos de esos
   *  caían sobre una línea y se cambiaron por otro candidato del agarre · `forzados` = los
   *  que NO encontraron lugar libre: ésos se quedan y piden baffle/bubbler (§9.3.5.2). */
  agua?: {
    vetados: number;                        // candidatos del agarre que caen sobre el agua
    antes: Array<{ x: number; y: number }>;
    enAguaAntes: number;                    // pines del reparto de siempre que caían sobre el agua
    movidos: number;
    forzados: Array<{ x: number; y: number }>;
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
  /** EL AGUA (orden LOS BOTADORES CON NOMBRE, 2026-09-22): `true` = ese (x, y) LOCAL cae
   *  sobre una línea de agua sin su ½⌀ de acero (§9.2.7). El candidato no se usa mientras
   *  quede otro del agarre; si no queda ninguno, se usa y se DECLARA (`agua.forzados`). */
  evitar?: (x: number, y: number) => boolean;
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
  // EL AGUA MANDA DÓNDE NO (2026-09-22): los candidatos que caen sobre una línea quedan
  // VETADOS. Sin `evitar` no hay vetos y todo lo de abajo es bit-igual a antes.
  const vetado = candidatos.map((c) => !!o.evitar?.(c.x, c.y));
  const nVetados = vetado.filter(Boolean).length;
  const cabe = (idx: number[], k: number, salvo = -1) =>
    idx.every((s2, n) => n === salvo || Math.hypot(candidatos[s2].x - candidatos[k].x, candidatos[s2].y - candidatos[k].y) >= sep);
  const greedy = (permite: (k: number) => boolean, ya: number[] = []) => {
    const idx = ya.slice();
    for (let k = 0; k < candidatos.length; k++) {
      if (idx.length >= o.nPins) break;
      if (!permite(k) || idx.indexOf(k) >= 0) continue;
      if (cabe(idx, k)) idx.push(k);
    }
    return idx;
  };

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
  // EL NÚMERO ES NUESTRO — REGLA DE HEFESTOS (sin cita del libro; ian 2026-09-22: «ME GUSTA
  // COMO REGLA DE HEFESTOS»): el centroide de los pines a ≤ 0.1·L del centroide del ÁREA
  // PROYECTADA (L = lado mayor de la huella). Razón:
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
  // el lazo de intercambios, con la bolsa de candidatos PERMITIDOS (sin veto = todos)
  const equilibra = (idx0: number[], permite: (k: number) => boolean) => {
    const idx = idx0.slice();
    const desvioAntes = desvioDe(idx);
    let dv = desvioAntes, swaps = 0;
    for (let iter = 0; iter < 60 && dv > topeMm; iter++) {
      let mejorD = dv, mejorS = -1, mejorA = -1;
      for (let s2 = 0; s2 < idx.length; s2++) {
        for (let a = 0; a < candidatos.length; a++) {
          if (idx.indexOf(a) >= 0 || !permite(a)) continue;
          if (!cabe(idx, a, s2)) continue;
          const probe = idx.slice(); probe[s2] = a;
          const d = desvioDe(probe);
          if (d < mejorD - 1e-6) { mejorD = d; mejorS = s2; mejorA = a; }
        }
      }
      if (mejorS < 0) break;                                   // ningún intercambio mejora: se DECLARA, no se fuerza
      idx[mejorS] = mejorA; dv = mejorD; swaps++;
    }
    return { idx, desvioAntes, desvio: dv, swaps };
  };
  // EL REPARTO DE SIEMPRE (sin mirar el agua): es el «antes» de la tabla pin↔agua.
  const rep0 = equilibra(greedy(() => true), () => true);
  let selIdx = rep0.idx, desvioAntesMm = rep0.desvioAntes, desvioMm = rep0.desvio, nSwaps = rep0.swaps;
  let agua: GripLayout['agua'];
  if (o.evitar) {
    const enAguaAntes = rep0.idx.filter((k) => vetado[k]).length;
    let forzadosIdx: number[] = [];
    if (enAguaAntes > 0) {
      // PRIMERO SE MUEVE EL PIN (ian 2026-09-22, pregunta 5 · §11.2.5): el reparto se rehace con
      // los candidatos LIBRES del agarre — siguen en la banda [keepOut, keepOut+6] de su pared,
      // así que el pin movido sigue empujando donde la pieza abraza al macho.
      const libre = (k: number) => !vetado[k];
      let idx = greedy(libre);
      // SOLO si no queda lugar libre se usa un candidato sobre el agua, y se DECLARA: ése pide
      // baffle/bubbler en ese tramo de la línea (§9.3.5.2), no un pin en silencio sobre el agua.
      if (idx.length < o.nPins) {
        const n0 = idx.length;
        idx = greedy((k) => vetado[k], idx);
        forzadosIdx = idx.slice(n0);
      }
      const rep = equilibra(idx, (k) => !vetado[k]);
      selIdx = rep.idx; desvioMm = rep.desvio; nSwaps = rep.swaps;
      // el «antes» del equilibrio es el del reparto de siempre (lo que se tenía ANTES de mover)
      desvioAntesMm = rep0.desvioAntes;
      forzadosIdx = forzadosIdx.filter((k) => selIdx.indexOf(k) >= 0);
    }
    agua = {
      vetados: nVetados,
      antes: rep0.idx.map((k) => ({ x: +candidatos[k].x.toFixed(1), y: +candidatos[k].y.toFixed(1) })),
      enAguaAntes,
      movidos: rep0.idx.filter((k) => vetado[k] && selIdx.indexOf(k) < 0).length,
      forzados: forzadosIdx.map((k) => ({ x: +candidatos[k].x.toFixed(1), y: +candidatos[k].y.toFixed(1) })),
    };
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
  if (agua) notas.push(agua.enAguaAntes === 0
    ? `EL AGUA: ${agua.vetados} de ${candidatos.length} candidatos caen sobre una línea; el reparto no usaba ninguno — ningún pin se movió`
    : agua.forzados.length === 0
      ? `EL AGUA: ${agua.enAguaAntes} pin(es) caían sobre una línea de agua → SE MOVIERON a otro candidato del agarre (${agua.vetados} candidatos vetados) — el agua conserva sus carriles, sin baffle`
      : `⚠ EL AGUA: ${agua.enAguaAntes} pin(es) sobre una línea; ${agua.movidos} se movieron y ${agua.forzados.length} NO encontraron lugar libre del agarre → en ese tramo va baffle/bubbler (§9.3.5.2), declarado`);
  notas.push(equilibrio.ok
    ? `EQUILIBRIO: centroide de los pines a ${equilibrio.desvioMm} mm del centroide del área proyectada (tope 0.1·L = ${equilibrio.topeMm} mm, regla de Hefestos) — ${nSwaps} intercambios desde ${equilibrio.desvioAntesMm} mm`
    : `⚠ EQUILIBRIO NO ALCANZADO: ${equilibrio.desvioMm} mm > tope ${equilibrio.topeMm} mm (desde ${equilibrio.desvioAntesMm} mm, ${nSwaps} intercambios) — con estos candidatos §11.2.5 no hay reparto mejor: se DECLARA (subir nPins o bajar ⌀)`);

  return {
    positions: sel,
    centered: sel.map((p) => ({ x: +(p.x - cx).toFixed(1), y: +(p.y - cy).toFixed(1) })),
    nParedes, nCandidatos: candidatos.length, keepOutMm: keepOut,
    grid: { nx, ny, sx, sy, x0: b.x0, y0: b.y0, wall, push },
    equilibrio,
    agua,
    notas,
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LOS BOTADORES CON NOMBRE (orden 2026-09-22)                                 */
/* ══════════════════════════════════════════════════════════════════════════ */

/** El pin ESCALONADO en z (para juzgarlo contra el agua sección por sección: a la altura
 *  de la línea puede pasar la PUNTA o el CUERPO, y cada una abre un barreno distinto). */
export interface PinEnZ {
  puntaDiaMm: number; puntaMm: number; cuerpoDiaMm: number;
  /** z de la cara de la retenedora = donde asienta la cabeza (plateStackZ['ejector-ret']) */
  zRetenedoraMm: number;
}
/** un tramo de agua (la forma de `SegmentoAgua` del circuito de la E8, sin importarlo) */
export interface TramoAgua { id: string; p0: [number, number, number]; p1: [number, number, number]; diaMm: number; tipo: string }

/**
 * EL CLARO pin ↔ agua — UNA SOLA FUENTE para quien coloca (E7) y quien juzga (E10).
 * ============================================================================
 * §9.2.7 LITERAL: "at least half a cooling diameter between the surface of the cooling line and
 * the surface of ANY OTHER MOLD COMPONENT". La superficie del otro componente es la pared de su
 * BARRENO (donde termina el acero), no el pin: la punta corre en su barreno (`ejectorPinFit`,
 * el ajuste que ventea, §8.3.2) y el cuerpo en su pasaje ⌀+0.5 (§11.2.6).
 * El juez viejo de la E10 medía con el radio de la PUNTA en toda la altura; con el pin
 * escalonado, a la altura de la línea B suele pasar el CUERPO (1599HBK: el conflicto era
 * `pin-cuerpo-5`, que ese juez no veía). Aquí se mira qué sección comparte la franja de z de
 * cada tramo y se usa SU barreno. Un tramo que no comparte z con ninguna sección no se juzga.
 * `margenZMm` ensancha la franja: al COLOCAR (E7) el piso exacto del candidato aún no se
 * midió y el hombro puede caer a ±1 mm de la línea; al JUZGAR (E10) va 0.
 */
export function claroPinAgua(pin: { x: number; y: number; zPisoMm: number }, g: PinEnZ, tramos: TramoAgua[], zPartMm: number, o?: { margenZMm?: number }) {
  const m = o?.margenZMm ?? 0;
  const zHombro = pin.zPisoMm - g.puntaMm;
  const secciones = [
    { seccion: 'punta' as const, z0: zHombro, z1: pin.zPisoMm, rHoyo: ejectorPinFit(g.puntaDiaMm).holeDiaMm / 2 },
    { seccion: 'cuerpo' as const, z0: g.zRetenedoraMm, z1: zHombro, rHoyo: (g.cuerpoDiaMm + 0.5) / 2 },
  ];
  const out: Array<{ segmento: string; seccion: 'punta' | 'cuerpo'; claroMm: number; minMm: number }> = [];
  for (const sg of tramos) {
    if (sg.tipo === 'extension') continue;                               // lado A: arriba de la partición
    if (sg.tipo !== 'baffle' && Math.min(sg.p0[2], sg.p1[2]) > zPartMm) continue;
    const r = sg.diaMm / 2;
    const zl = Math.min(sg.p0[2], sg.p1[2]) - r - m, zh = Math.max(sg.p0[2], sg.p1[2]) + r + m;
    // distancia en PLANTA del eje del pin al eje del tramo (el baffle es vertical: a su eje)
    const dx = sg.p1[0] - sg.p0[0], dy = sg.p1[1] - sg.p0[1], L2 = dx * dx + dy * dy;
    const t = sg.tipo === 'baffle' || L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((pin.x - sg.p0[0]) * dx + (pin.y - sg.p0[1]) * dy) / L2));
    const dPlanta = Math.hypot(pin.x - (sg.p0[0] + t * dx), pin.y - (sg.p0[1] + t * dy));
    let peor: { seccion: 'punta' | 'cuerpo'; claro: number } | null = null;
    for (const sc of secciones) {
      if (!(zh > sc.z0 && zl < sc.z1)) continue;                         // no comparten franja de z
      const claro = dPlanta - r - sc.rHoyo;
      if (!peor || claro < peor.claro) peor = { seccion: sc.seccion, claro };
    }
    if (peor) out.push({ segmento: sg.id, seccion: peor.seccion, claroMm: +peor.claro.toFixed(2), minMm: +(sg.diaMm / 2).toFixed(2) });
  }
  return out;
}

/** El nombre de la pieza como IDENTIFICADOR de GAIA: sin acentos, sin extensión, MAYÚSCULAS, guiones. */
export function slugPieza(nombre: string): string {
  return (nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.(stp|step|stl|iges?)$/i, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'PIEZA';
}
/** «cada pieza dentro de GAIA tendrá su identificador» (ian 2026-09-22): el pin k de la pieza P = `P-EP-0k`. */
export function idBotador(piezaNombre: string, k: number): string {
  return `${slugPieza(piezaNombre)}-EP-${String(k + 1).padStart(2, '0')}`;
}

/**
 * LA TABLA DE EYECTORES — cada pin a SU largo, con su nombre, y la llave cuando los largos difieren.
 * ============================================================================
 * §11.2.6 LITERAL: "Whenever possible, the mold designer should specify the same length and
 * diameter of ejector pins to facilitate mold assembly and maintenance." — y cuando NO es posible:
 * "The mold designer should always avoid designing ejector pins that vary only slightly in their
 * design, since similar pins may accidentally be considered interchangeable by the molder. The
 * incorrect assembly of ejector pins may cause damage to the pins as well as the opposing mold
 * cavity surfaces" … "key and label each ejector pin and matching location on the ejector
 * retainer plate". (§11.1.7 / R37 lo hace entregable: la tabla de eyectores.)
 * ian 2026-09-22 (pregunta 8): «EL HUMANO ACEPTA EL STANDARD POR NATURALEZA, cada uno a su largo y
 * etiqueta, cada pieza dentro de GAIA tendrá su identificador». Por eso NO se igualan rebajando al
 * piso más bajo (eso deja un botón de plástico en los demás): cada pin llega a SU piso.
 *
 * LARGO = de la cara de asiento de la cabeza (la retenedora) a la punta (el piso real del rayo).
 * «Distintos» = distintos a la centésima, la cota que va al taller. En la 1557BGY los pisos
 * difieren 0.01–0.10 mm: exactamente el caso «vary only slightly» que el libro nombra — por
 * eso cualquier diferencia cuenta; no hay umbral que la perdone.
 * LA LLAVE (anti-giro; el pin contorneado de §11.2.6 lleva plano en la cabeza + localizador en la
 * retenedora para conservar su orientación angular): un PLANO en la cabeza y el mismo plano en su
 * contrataladro. La distancia del plano al eje es REGLA DE HEFESTOS (el libro pide la llave, no
 * da la cota): a media corona de la cabeza, ½(r_cuerpo + r_cabeza) — deja acero de la cabeza a
 * los dos lados del cuerpo y una cara de apoyo de ½(r_cabeza − r_cuerpo) de ancho.
 */
export interface FilaEyector {
  id: string; k: number;
  x: number; y: number;
  zPisoMm: number;
  /** largo total: asiento de la cabeza → punta (mm, a la centésima) */
  largoMm: number;
  /** largo del CUERPO: asiento de la cabeza → hombro */
  cuerpoMm: number;
  puntaMm: number;
  fuentePiso: 'rayo' | 'pared mediana';
}
export interface TablaEyectores {
  piezaId: string;
  filas: FilaEyector[];
  /** cuántos largos distintos hay (a la centésima) — 1 = todos iguales */
  largosDistintos: number;
  minMm: number; maxMm: number;
  /** keyed cuando los largos difieren (§11.2.6) — la llave va en TODAS las cabezas */
  llave: { requerida: boolean; planoAlEjeMm: number; regla: string };
  etiqueta: string;
}
export function tablaDeEyectores(piezaNombre: string, pines: Array<{ x: number; y: number; zPisoMm?: number }>, g: PinEnZ & { cabezaDiaMm: number; zPisoRespaldoMm: number }): TablaEyectores {
  const filas: FilaEyector[] = pines.map((p, k) => {
    const rayo = Number.isFinite(p.zPisoMm);
    const zPiso = rayo ? (p.zPisoMm as number) : g.zPisoRespaldoMm;
    return {
      id: idBotador(piezaNombre, k), k, x: p.x, y: p.y, zPisoMm: +zPiso.toFixed(3),
      largoMm: +(zPiso - g.zRetenedoraMm).toFixed(2),
      cuerpoMm: +(zPiso - g.puntaMm - g.zRetenedoraMm).toFixed(2),
      puntaMm: g.puntaMm, fuentePiso: rayo ? 'rayo' : 'pared mediana',
    };
  });
  const largos = [...new Set(filas.map((f) => f.largoMm.toFixed(2)))];
  return {
    piezaId: slugPieza(piezaNombre), filas, largosDistintos: largos.length,
    minMm: filas.length ? Math.min(...filas.map((f) => f.largoMm)) : 0,
    maxMm: filas.length ? Math.max(...filas.map((f) => f.largoMm)) : 0,
    llave: { requerida: largos.length > 1, planoAlEjeMm: +((g.cuerpoDiaMm / 2 + g.cabezaDiaMm / 2) / 2).toFixed(2),
      regla: 'regla de Hefestos: plano a ½(r cuerpo + r cabeza) del eje — el libro pide la llave, no da la cota' },
    etiqueta: 'cada pin grabado con su id en la cabeza + el mismo id junto a su barreno en la retenedora (§11.2.6: "key and label each ejector pin and matching location on the ejector retainer plate")',
  };
}
