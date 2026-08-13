/**
 * LONGITUD DE FLUJO — la MIDE dentro del hueco A/B. Kazmer cap 5 (§5.5.5).
 * ============================================================================
 * "no debe de ser una fórmula de una figura — ¿cómo calcularás el relleno de una carcasa
 *  de laptop? ¿o una pistola de agua? ¿o un juguete? SE TIENE QUE CALCULAR CON EL MOLDE
 *  A/B" (user 2026-07-16). Tenía razón y me cachó escribiendo `tupperFlowPath()`: una
 * fórmula POR FIGURA. Con eso, cada pieza nueva necesita que alguien le teclee su
 * ecuación a mano — y encima me comía el 82 % del vaso (calculaba πR²·pared = solo el
 * FONDO; la pared de 67 mm no existía en el llenado).
 *
 * EL LIBRO NO RAZONA POR FIGURAS. Razona por **L = longitud de flujo**: la distancia que
 * el fundido RECORRE desde la compuerta, POR DENTRO del hueco. §5.5.5 lo usa para
 * balancear paredes (Eq 5.30-5.34: ΔP_región = ΔP_ref ⇒ llegan al mismo tiempo), y de L
 * salen la presión (Eq 5.19), el tiempo de llegada y las líneas de unión. Un vaso, una
 * carcasa de laptop y una pistola de agua se tratan IGUAL: lo único que cambia es el
 * hueco, y el hueco lo da el molde.
 *
 * CÓMO SE MIDE (sin conocer la figura):
 *   1. voxeliza el HUECO A/B (el espacio entre el inserto de cavidad y el de núcleo)
 *   2. desde la COMPUERTA, un frente de onda se propaga POR EL HUECO (BFS 26-vecinos,
 *      con el costo de la distancia real) — el fundido no atraviesa acero, LO RODEA
 *   3. cada vóxel se queda con su L: la geodésica desde la compuerta
 *
 * Eso es exactamente lo que hace el plástico. Un pozo ciego, una costilla, un agujero:
 * el frente los rodea porque el BFS los rodea. Nada que teclear por figura.
 *
 * El resultado alimenta: el llenado 2D (secciones), el 3D (mismo campo, una física),
 * la presión por región y el balance de §5.5.5. PURO → node-testeable.
 */

export interface FlowField {
  nx: number; ny: number; nz: number;
  cellMm: number;
  /** origen del vóxel (0,0,0) en coords de placa (mm) */
  x0: number; y0: number; z0: number;
  /** 1 = hueco (plástico), 0 = acero/fuera */
  cavity: Uint8Array;
  /** L geodésica desde la compuerta (mm). Infinity = inalcanzable (¡no se llena!).
   *  OJO: es la DISTANCIA recorrida — el dato de §5.5.5 para balancear paredes. NO es
   *  el orden en que se llena: para eso está `resistance` (el fundido no corre a la
   *  cercanía, corre a la MENOR RESISTENCIA). */
  flowLenMm: Float32Array;
  /** ESPESOR LOCAL de la pared en cada vóxel (mm) — de la transformada de distancia al
   *  acero. Es lo que manda la resistencia: ΔP ∝ 1/H^(1+n) (Eq 5.22). */
  thicknessMm: Float32Array;
  /** RESISTENCIA acumulada desde la compuerta (∝ ΔP, Eq 5.22). ESTE es el orden REAL de
   *  llenado: el frente avanza por donde el fundido gasta menos presión, no por donde
   *  está más cerca. Con esto el RACE TRACKING emerge solo (una pared gruesa se llena
   *  antes que una delgada de la misma longitud) — el fenómeno de §5.5.5. */
  resistance: Float32Array;
  maxResistance: number;
  /** el vóxel de la compuerta */
  gate: { i: number; j: number; k: number };
  /** L máxima alcanzada (mm) = la que manda la presión (Eq 5.19) */
  maxFlowLenMm: number;
  /** volumen del hueco alcanzable (mm³) */
  volumeMm3: number;
  /** vóxeles de hueco que NO se llenan (aislados del gate) */
  unreachable: number;
  /** AVISOS de resolución: una pared más delgada que la celda se pierde en silencio.
   *  Si esto trae algo, los números de abajo NO son de fiar — hay que bajar `cellMm`. */
  warnings: string[];
  idx(i: number, j: number, k: number): number;
}

/**
 * VOXELIZA el hueco A/B y mide L desde la compuerta.
 * `inCavity(x,y,z)` responde si ese punto (mm, coords de placa) está en el HUECO —
 * de ahí sale la figura, sea la que sea. La da el molde, no una fórmula.
 */
export function measureFlowLength(o: {
  /** caja que envuelve la cavidad (mm) */
  x0: number; y0: number; z0: number; x1: number; y1: number; z1: number;
  cellMm: number;
  /** EL MOLDE: ¿este punto es hueco? (lo sabe el A/B, no la figura) */
  inCavity: (x: number, y: number, z: number) => boolean;
  /** dónde entra el fundido (mm) */
  gateMm: { x: number; y: number; z: number };
  /** pared nominal de la pieza (mm) — para AVISAR si la celda no la resuelve */
  wallMm?: number;
  /** índice power-law del fundido (Eq 5.22). ABS MG47: 0.348. Manda la resistencia. */
  meltN?: number;
  /** volumen que dice el kernel (mm³) — el CRUCE que caza el voxelizado mentiroso */
  expectVolumeMm3?: number;
}): FlowField {
  const c = Math.max(0.05, o.cellMm);
  const nx = Math.max(1, Math.round((o.x1 - o.x0) / c));
  const ny = Math.max(1, Math.round((o.y1 - o.y0) / c));
  const nz = Math.max(1, Math.round((o.z1 - o.z0) / c));
  const N = nx * ny * nz;
  const idx = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const cavity = new Uint8Array(N);
  const flowLenMm = new Float32Array(N).fill(Infinity);

  const px = (i: number) => o.x0 + (i + 0.5) * c;
  const py = (j: number) => o.y0 + (j + 0.5) * c;
  const pz = (k: number) => o.z0 + (k + 0.5) * c;

  // ── VOXELIZADO CON SUPERMUESTREO — la pared delgada NO se puede perder ───
  // Un vóxel = 1 muestra en su centro sería fatal: la pared de un contenedor mide 1.2 mm
  // y la celda 1.5 ⇒ el centro cae en el aire y la pared DESAPARECE del llenado, en
  // silencio. Medido: el vaso daba 33.5 cc contra 50.5 del kernel (−34 %, justo la
  // pared) — y esa es la razón de fondo de "solo se inyecta un disco".
  // 2×2×2 muestras por vóxel + centro (9 en total), y se decide por MAYORÍA de ocupación:
  // el vóxel es hueco si ≥ la mitad de sus muestras caen en el hueco.
  //   · "si CUALQUIERA toca" (probado): INFLA — el vaso daba 67 cc contra 50.5 del kernel
  //     (+33 %), porque todo vóxel que rozara la pared contaba entero.
  //   · "solo el centro" (probado): ADELGAZA — daba 33 cc (−34 %): la pared de 1.2 mm se
  //     caía entre muestras y el llenado salía como si fuera solo el fondo.
  // La mayoría es el estimador insesgado: cada vóxel aporta ≈ su fracción real ocupada.
  // El CRUCE contra `expectVolumeMm3` del kernel es lo que decide cuál sirve — sin ese
  // número, las tres versiones "se ven bien" en pantalla.
  let vox = 0;
  const q4 = c * 0.25;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const X = px(i), Y = py(j), Z = pz(k);
    let hits = o.inCavity(X, Y, Z) ? 1 : 0, n = 1;
    for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) for (let d = -1; d <= 1; d += 2) {
      if (o.inCavity(X + a * q4, Y + b * q4, Z + d * q4)) hits++;
      n++;
    }
    if (hits * 2 >= n) { cavity[idx(i, j, k)] = 1; vox++; }
  }

  // la compuerta al vóxel más cercano QUE SEA HUECO (si cae en acero, se busca el hueco
  // vecino: el gate real está en la frontera).
  const gi0 = Math.max(0, Math.min(nx - 1, Math.round((o.gateMm.x - o.x0) / c - 0.5)));
  const gj0 = Math.max(0, Math.min(ny - 1, Math.round((o.gateMm.y - o.y0) / c - 0.5)));
  const gk0 = Math.max(0, Math.min(nz - 1, Math.round((o.gateMm.z - o.z0) / c - 0.5)));
  let gate = { i: gi0, j: gj0, k: gk0 };
  if (!cavity[idx(gi0, gj0, gk0)]) {
    let best = Infinity;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!cavity[idx(i, j, k)]) continue;
      const d = (i - gi0) ** 2 + (j - gj0) ** 2 + (k - gk0) ** 2;
      if (d < best) { best = d; gate = { i, j, k }; }
    }
  }

  // ── ESPESOR LOCAL (EDT): ¿qué tan gruesa es la pared en cada vóxel? ──────
  // BFS multi-fuente DESDE EL ACERO: cada vóxel de hueco se queda con su distancia a la
  // pared más cercana ⇒ espesor ≈ 2 × esa distancia. Es lo que decide la resistencia:
  // el fundido NO corre a la cercanía, corre por donde gasta MENOS presión (Eq 5.22:
  // ΔP ∝ 1/H^(1+n) — duplicar H hace el paso 2.5× más fácil con el n=0.348 del ABS).
  const thicknessMm = new Float32Array(N);
  {
    // (a) distancia a la pared por CHAMFER de 26 vecinos (pesos 1, √2, √3) en dos
    // barridos raster — NO 6-vecinos: eso era MANHATTAN, y una pared diagonal a la
    // rejilla salía hasta +41 % más "gruesa" (2c en vez de √2c). Ese ruido era el que
    // la resistencia perseguía zigzagueando (L del vaso salía 110 mm en vez de ~97).
    const dist = new Float32Array(N).fill(Infinity);
    for (let t = 0; t < N; t++) if (!cavity[t]) dist[t] = 0;   // el acero es la fuente
    const HALF: Array<[number, number, number, number]> = [];
    for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj && !dk) continue;
      if (dk < 0 || (dk === 0 && (dj < 0 || (dj === 0 && di < 0))))
        HALF.push([di, dj, dk, Math.sqrt(di * di + dj * dj + dk * dk) * c]);
    }
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const t = idx(i, j, k);
      if (!cavity[t]) continue;
      for (const [di, dj, dk, w] of HALF) {
        const a = i + di, b = j + dj, e = k + dk;
        if (a < 0 || b < 0 || e < 0 || a >= nx || b >= ny || e >= nz) continue;
        const d2 = dist[idx(a, b, e)] + w;
        if (d2 < dist[t]) dist[t] = d2;
      }
    }
    for (let k = nz - 1; k >= 0; k--) for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
      const t = idx(i, j, k);
      if (!cavity[t]) continue;
      for (const [di, dj, dk, w] of HALF) {
        const a = i - di, b = j - dj, e = k - dk;   // la media máscara OPUESTA
        if (a < 0 || b < 0 || e < 0 || a >= nx || b >= ny || e >= nz) continue;
        const d2 = dist[idx(a, b, e)] + w;
        if (d2 < dist[t]) dist[t] = d2;
      }
    }
    // (b) espesor LOCAL (Hildebrand–Rüegsegger): el diámetro de la MAYOR esfera
    // inscrita que CONTIENE al vóxel — no 2× su propia distancia. Con 2×dist propia,
    // en una pared de 3 mm el vóxel del centro decía 3 y el pegado a la superficie 1.5:
    // la resistencia (∝1/H^{1+n}) zigzagueaba buscando el centro y la L se estiraba.
    // El canal ES de 3 mm en TODA su sección — se estampa el diámetro de cada esfera
    // sobre todos los vóxeles que cubre.
    for (let t = 0; t < N; t++) {
      if (!cavity[t] || !Number.isFinite(dist[t])) continue;
      const d = Math.max(dist[t], c / 2), dia = 2 * d, rC = Math.round(d / c);
      if (rC < 1) { if (dia > thicknessMm[t]) thicknessMm[t] = dia; continue; }
      const ti = t % nx, tj = ((t - ti) / nx) % ny, tk = ((t - ti) / nx - tj) / ny;
      for (let dk = -rC; dk <= rC; dk++) for (let dj = -rC; dj <= rC; dj++) for (let di = -rC; di <= rC; di++) {
        if ((di * di + dj * dj + dk * dk) * c * c > d * d + 1e-9) continue;   // fuera de la esfera
        const i = ti + di, j = tj + dj, k = tk + dk;
        if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) continue;
        const u = idx(i, j, k);
        if (cavity[u] && dia > thicknessMm[u]) thicknessMm[u] = dia;
      }
    }
    for (let t = 0; t < N; t++) {
      if (!cavity[t]) continue;
      // piso: una celda (nunca 0 ⇒ nunca resistencia ∞)
      if (thicknessMm[t] < c) thicknessMm[t] = c;
    }
  }

  // ── EL FRENTE: Dijkstra 26-vecinos POR EL HUECO ──────────────────────────
  // 26 vecinos (no 6) porque el frente avanza en diagonal como el fluido real; el costo
  // es la distancia EUCLÍDEA del salto (1, √2 o √3 celdas), no "1 paso" — si no, una
  // diagonal mediría lo mismo que un escalón y L saldría ~11 % larga en promedio.
  // Que sea BFS por el HUECO es LO QUE IMPORTA: el frente RODEA el acero (un pozo, una
  // costilla, un agujero) sin que nadie le explique la figura. Eso hace el plástico.
  const NB: Array<[number, number, number, number]> = [];
  for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!di && !dj && !dk) continue;
    NB.push([di, dj, dk, Math.sqrt(di * di + dj * dj + dk * dk) * c]);
  }
  // ── ANTI-OCTÁGONO: saltos de caballo (2,1,0) ─────────────────────────────
  // Con solo 26 vecinos la "distancia" es la métrica de CHAMFER y sus bolas son
  // OCTÁGONOS: el frente radial de un disco salía hexagonal/octagonal en el video —
  // "¿a poco el material toma forma de hexágono mientras se inyecta?" (user 2026-07-17,
  // cazado A OJO). No es física: es la anisotropía del grafo (~8 % según la dirección).
  // Los saltos tipo caballo (máscara chamfer 5-7-11) la bajan a ~2 %: el frente vuelve
  // a ser redondo. OJO: un salto de 2 celdas puede BRINCARSE una pared de acero — por
  // eso cada salto de caballo exige que su celda INTERMEDIA también sea hueco (se
  // verifica en el bucle del Dijkstra, no aquí).
  for (const [a, b] of [[2, 1], [1, 2], [2, -1], [-1, 2], [-2, 1], [1, -2], [-2, -1], [-1, -2]] as const) {
    NB.push([a, b, 0, Math.sqrt(5) * c]);
    NB.push([a, 0, b, Math.sqrt(5) * c]);
    NB.push([0, a, b, Math.sqrt(5) * c]);
  }
  const g = idx(gate.i, gate.j, gate.k);
  if (cavity[g]) flowLenMm[g] = 0;
  // el exponente de la resistencia: Eq 5.22 ⇒ ΔP ∝ L / H^(1+n). `n` es del power-law
  // del fundido (ABS: 0.348). NO es un número de ajuste: sale de la ecuación del libro.
  const nPow = 1 + (o.meltN ?? 0.348);
  const resistance = new Float32Array(N).fill(Infinity);
  if (cavity[g]) resistance[g] = 0;
  // el ÁRBOL de alimentación: de qué vóxel vino el fundido que llenó a cada vóxel.
  // Caminar parent[] desde cualquier vóxel reconstruye SU trayectoria real hasta el
  // gate — es lo que permite dibujar trazadoras que VIAJAN (no solo el frente).
  const parent = new Int32Array(N).fill(-1);
  // la COMPUERTA que alimentó a cada vóxel (para LÍNEAS DE SOLDADURA multi-gate):
  // o.rootOfMm marca los vóxeles-garganta de cada compuerta con su id ≥0; el id se
  // HEREDA por el árbol. Donde colindan ids distintos, dos frentes CHOCARON (§ weld).
  const root = new Int32Array(N).fill(-1);
  if (o.rootOfMm) {
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const t = idx(i, j, k);
      if (!cavity[t]) continue;
      const rid = o.rootOfMm(o.x0 + (i + .5) * c, o.y0 + (j + .5) * c, o.z0 + (k + .5) * c);
      if (rid != null && rid >= 0) root[t] = rid;
    }
  }
  // cola de prioridad simple (bucket por distancia): N es chico (~1e5) y esto es puro.
  const heap: number[] = [g];
  const key = new Float32Array(N).fill(Infinity);
  key[g] = 0;
  const done = new Uint8Array(N);
  while (heap.length) {
    // extrae el mínimo (lineal: suficiente para estas rejillas y sin dependencias)
    let bi = 0;
    for (let t = 1; t < heap.length; t++) if (key[heap[t]] < key[heap[bi]]) bi = t;
    const cur = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    const ci = cur % nx, cj = ((cur - ci) / nx) % ny, ck = ((cur - ci) / nx - cj) / ny;
    for (const [di, dj, dk, w] of NB) {
      const i = ci + di, j = cj + dj, k = ck + dk;
      if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) continue;
      const nIdx = idx(i, j, k);
      if (!cavity[nIdx] || done[nIdx]) continue;
      // salto de caballo: la celda INTERMEDIA (a mitad del salto, redondeada) debe ser
      // hueco — si no, el fundido estaría atravesando acero de un brinco
      if (Math.abs(di) + Math.abs(dj) + Math.abs(dk) > 2) {
        const mi = ci + Math.round(di / 2), mj = cj + Math.round(dj / 2), mk = ck + Math.round(dk / 2);
        if (!cavity[idx(mi, mj, mk)]) continue;
      }
      // ── EL COSTO ES LA RESISTENCIA, NO LA DISTANCIA ────────────────────
      // Aquí estaba el error de fondo ("no está bien simulado" — user 2026-07-16): un
      // Dijkstra pesado por DISTANCIA trata igual una pared de 1 mm y una de 3 mm. El
      // fundido no: por la gruesa corre 2.5× más fácil (Eq 5.22). Con el peso correcto,
      // el RACE TRACKING emerge de la geometría — y §5.5.5 (flow leaders) por fin tiene
      // efecto: engrosar una región AHORA cambia el llenado, como en la realidad.
      const hAvg = (thicknessMm[cur] + thicknessMm[nIdx]) / 2;
      const nd = key[cur] + w / Math.pow(Math.max(1e-6, hAvg), nPow);
      if (nd < key[nIdx]) {
        key[nIdx] = nd;
        resistance[nIdx] = nd;
        flowLenMm[nIdx] = flowLenMm[cur] + w;      // la L se ACUMULA por el mismo camino
        parent[nIdx] = cur;
        if (root[cur] >= 0) root[nIdx] = root[cur];   // la compuerta se hereda por el árbol
        heap.push(nIdx);
      }
    }
  }

  let maxL = 0, unreachable = 0, reach = 0, maxR = 0;
  for (let t = 0; t < N; t++) {
    if (!cavity[t]) continue;
    if (!Number.isFinite(flowLenMm[t])) { unreachable++; continue; }
    reach++;
    if (flowLenMm[t] > maxL) maxL = flowLenMm[t];
    if (resistance[t] > maxR) maxR = resistance[t];
  }

  // ── LOS AVISOS: un campo que miente en silencio es peor que no tenerlo ───
  const warnings: string[] = [];
  const volMedido = reach * c * c * c;
  if (o.wallMm != null && c > o.wallMm * 0.7) {
    warnings.push(`celda ${c} mm > 0.7 × pared ${o.wallMm} mm: la pared NO se resuelve — bajar cellMm a ≤ ${(o.wallMm * 0.7).toFixed(1)} (con celda gruesa la pared se pierde y el llenado sale como si fuera solo el fondo)`);
  }
  if (o.expectVolumeMm3 != null) {
    const err = Math.abs(volMedido - o.expectVolumeMm3) / o.expectVolumeMm3;
    if (err > 0.12) {
      warnings.push(`el voxelizado mide ${(volMedido / 1000).toFixed(2)} cc y el kernel dice ${(o.expectVolumeMm3 / 1000).toFixed(2)} cc (${(100 * err).toFixed(0)} % de error): la rejilla se está comiendo geometría`);
    }
  }
  if (unreachable > 0) {
    warnings.push(`${unreachable} vóxeles de hueco NO tienen camino al gate: short shot (§5.5) — o son ruido de la rejilla`);
  }

  return {
    nx, ny, nz, cellMm: c, x0: o.x0, y0: o.y0, z0: o.z0,
    cavity, flowLenMm, thicknessMm, resistance, maxResistance: maxR, gate, parent, root,
    maxFlowLenMm: +maxL.toFixed(2),
    volumeMm3: +volMedido.toFixed(1),
    unreachable, warnings, idx,
  };
}

/**
 * LÍNEAS DE SOLDADURA (weld lines) — donde CHOCAN frentes de compuertas distintas.
 * ============================================================================
 * Con varias compuertas (rootOfMm), cada vóxel sabe QUÉ compuerta lo alimentó (el
 * root heredado por el árbol). Un vóxel cuyo VECINO viene de OTRA compuerta está en
 * la frontera donde dos frentes se encontraron: eso ES la línea de soldadura — el
 * defecto que Moldflow/SolidWorks Plastics pintan, emergiendo del mismo campo.
 * Devuelve la máscara y su resistencia de encuentro (para saber CUÁNDO aparece).
 */
export function computeWeldMask(f: {
  nx: number; ny: number; nz: number; cavity: Uint8Array; root: Int32Array;
  resistance: Float32Array; flowLenMm: Float32Array; idx: (i: number, j: number, k: number) => number;
}, opts?: {
  /** soldadura de UNA MISMA compuerta: el frente rodea un núcleo/agujero y se
   *  reencuentra — dos vecinos con L de recorrido MUY distinta (> este umbral)
   *  llegaron por caminos opuestos. 0 = apagado. Típico: 20 mm. */
  sameGateDeltaLMm?: number;
}) {
  const dL = opts?.sameGateDeltaLMm ?? 0;
  const weld = new Uint8Array(f.cavity.length);
  const weldR = new Float32Array(f.cavity.length).fill(Infinity);
  let count = 0;
  for (let k = 0; k < f.nz; k++) for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) {
    const t = f.idx(i, j, k);
    if (!f.cavity[t] || !Number.isFinite(f.resistance[t])) continue;
    for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const) {
      const a = i + di, b = j + dj, e = k + dk;
      if (a >= f.nx || b >= f.ny || e >= f.nz) continue;
      const u = f.idx(a, b, e);
      if (!f.cavity[u] || !Number.isFinite(f.resistance[u])) continue;
      const distinta = f.root[t] >= 0 && f.root[u] >= 0 && f.root[u] !== f.root[t];
      const seVuelveAEncontrar = dL > 0 && Math.abs(f.flowLenMm[t] - f.flowLenMm[u]) > dL;
      if (distinta || seVuelveAEncontrar) {
        // la soldadura "ocurre" cuando llega el SEGUNDO frente (la R mayor de los dos)
        const rEncuentro = Math.max(f.resistance[t], f.resistance[u]);
        if (!weld[t]) { weld[t] = 1; count++; }
        if (!weld[u]) { weld[u] = 1; count++; }
        if (rEncuentro < weldR[t]) weldR[t] = rEncuentro;
        if (rEncuentro < weldR[u]) weldR[u] = rEncuentro;
      }
    }
  }
  return { weld, weldR, count };
}

/**
 * EL FRENTE EN t — se llena por ORDEN DE RESISTENCIA, no de cercanía.
 * ============================================================================
 * Esto ordenaba por L (distancia): "lo más cerca se llena primero". Suena obvio y es
 * FALSO. El fundido no corre a lo cercano: corre por donde gasta menos presión. Un punto
 * LEJANO por pared gruesa se llena ANTES que uno CERCANO por pared delgada — eso es el
 * RACE TRACKING, y es exactamente el fenómeno que §5.5.5 (flow leaders) existe para
 * corregir. Medido: dos brazos a la misma distancia, uno de 1 mm y otro de 3 → el grueso
 * gasta el 51 % de la presión (Eq 5.22: ΔP ∝ L/H^(1+n)).
 *
 * Consecuencia que importa: el frente es una superficie de ISO-RESISTENCIA, no de ISO-L.
 * A una resistencia dada conviven L distintas — y verlo es el punto.
 *
 * Puro en `frac` ⇒ el 2D y el 3D leen del MISMO campo: una física, dos vistas.
 */
export function createFlowFront(f: FlowField) {
  // vóxeles alcanzables ordenados por RESISTENCIA (el orden REAL de llenado), cada uno
  // cargando su L para poder reportar hasta dónde llegó el recorrido.
  const vox: Array<{ r: number; L: number }> = [];
  for (let t = 0; t < f.cavity.length; t++) {
    if (f.cavity[t] && Number.isFinite(f.resistance[t])) vox.push({ r: f.resistance[t], L: f.flowLenMm[t] });
  }
  vox.sort((a, b) => a.r - b.r);
  const volCell = f.cellMm ** 3;
  const idxAt = (frac: number) => Math.max(0, Math.min(vox.length - 1, Math.round(frac * (vox.length - 1))));

  return {
    nVox: vox.length,
    /** el frente cuando se ha llenado `frac` del volumen: su resistencia y la L MÁXIMA
     *  que el fundido lleva recorrida (la que manda la presión, Eq 5.19). */
    frontAt(frac: number): { resistance: number; lenMaxMm: number } {
      if (!vox.length) return { resistance: 0, lenMaxMm: 0 };
      const n = idxAt(frac);
      let lMax = 0;
      for (let i = 0; i <= n; i++) if (vox[i].L > lMax) lMax = vox[i].L;
      return { resistance: vox[n].r, lenMaxMm: +lMax.toFixed(2) };
    },
    /** la L MÁXIMA recorrida al llevar `frac` del volumen. OJO: ya NO es "el frente"
     *  (el frente es iso-resistencia); es lo más lejos que ha llegado el fundido. */
    frontLenMm(frac: number): number { return this.frontAt(frac).lenMaxMm; },
    /** qué fracción del volumen queda dentro de una resistencia dada (la inversa) */
    fracAtResistance(res: number): number {
      if (!vox.length) return 0;
      let lo = 0, hi = vox.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (vox[m].r <= res) lo = m + 1; else hi = m; }
      return lo / vox.length;
    },
    /** volumen total alcanzable (mm³) */
    volumeMm3: +(vox.length * volCell).toFixed(1),
    /** ¿está el vóxel lleno cuando el frente va en `res`? (para pintar).
     *  Se compara RESISTENCIA, no distancia: si no, el pintado contradiría a la física
     *  que acabamos de meterle al campo. */
    isFilled(t: number, res: number): boolean {
      return f.cavity[t] === 1 && f.resistance[t] <= res;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EL FRENTE COMO SUPERFICIE — lo que dibuja la industria
// ═══════════════════════════════════════════════════════════════════════════
//
// ian, viendo el video del llenado: "se supone que es un líquido, no se ve como
// un líquido… se ve de juguete, no se ve real. ¿Qué usan los demás softwares?".
//
// Moldflow / Moldex3D / Sigmasoft NO dibujan nubes de puntos: dibujan **una
// SUPERFICIE sombreada coloreada por `Fill time`**, el resultado #1 de cualquier
// análisis de llenado. La región llena en el instante t es { 0 ≤ frente ≤ t };
// su FRONTERA es lo que se ve, y esa frontera incluye tanto el frente que avanza
// como las paredes ya mojadas.
//
// El extractor es **NAIVE SURFACE NETS** (Gibson 1998), no marching cubes:
//   · un vértice por celda que cruza el nivel, colocado en el promedio de los
//     cruces de sus 12 aristas → superficie SUAVE, sin el escalón de vóxel;
//   · quads entre celdas vecinas cuando la arista dual cambia de signo;
//   · ~60 líneas y CERO tablas de 256 casos (marching cubes necesita triTable).
//
// El nivel es 0.5 sobre la OCUPACIÓN (1 lleno / 0 vacío): así la superficie cae
// a media celda entre el último vóxel lleno y el primero vacío, y el volumen que
// encierra coincide con n·celda³ — que es justo lo que mide el gate (±2 %).
// El suavizado de caja NO mueve ese nivel: en una pared plana deja 2/3 dentro y
// 1/3 fuera, y el cruce 0.5 sigue exactamente a media celda.

export interface SuperficieFrente {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** llenado (0..1) por VÉRTICE → el colormap de fill time */
  fill: Float32Array;
  /** volumen encerrado (mm³) por el teorema de la divergencia. Positivo = normales
   *  hacia afuera. El gate lo compara contra n·celda³ de los vóxeles llenos. */
  volumeMm3: number;
  tris: number;
}

export function frenteSuperficie(o: {
  nx: number; ny: number; nz: number; cellMm: number;
  x0: number; y0: number; z0: number;
  /** llenado por vóxel de la REJILLA (0..1); <0 = no es fundido (acero o inalcanzable) */
  frente: Float32Array;
  /** instante 0..1: se extrae la frontera de { 0 ≤ frente ≤ t } */
  t: number;
  /** pasadas de suavizado de caja sobre la ocupación (por defecto 1) */
  suavizado?: number;
  /** OCUPACIÓN FRACCIONAL por celda (0..1) — la verdad SUB-VÓXEL. Sin ella, la celda
   *  llena aporta 1 (binario) y una pared que varía menos de una celda sale ESCALONADA:
   *  el cono del bebedero se veía como "un perno con 3 diámetros" (ian) porque la huella
   *  de vóxeles de la sección circular solo cambia cuando r(z) cruza una distancia de la
   *  retícula. Con la fracción (supermuestreada del predicado ANALÍTICO), el cruce 0.5
   *  interpola el radio REAL y el cono sale continuo con la misma celda. */
  ocupacion?: Float32Array;
  /** FRENTE CONTINUO (orden la-probeta): la celda que AÚN no llega pesa por su
   *  fracción de llenado estimada en t — arranca cuando su primer vecino llega
   *  (mín de `frente` de los 6 vecinos) y termina en su propia llegada. Fiel al
   *  modelo FAN (la frontera recibe flujo de los vecinos llegados). Sin esto, el
   *  borde de avance lleva un anillo fantasma de ~1 celda ("el líquido no llega a
   *  las paredes, no funciona como líquido" — ian, viendo el video). */
  continuo?: boolean;
}): SuperficieFrente {
  const { nx, ny, nz, cellMm, x0, y0, z0, frente, t } = o;
  const ISO = 0.5;
  // RELLENO de 2 celdas VACÍAS alrededor. Sin él, una región llena que TOCA el borde
  // de la rejilla deja la malla ABIERTA (ahí no se generan quads) y el volumen que
  // encierra deja de significar nada. Medido antes del relleno, con el contenedor del
  // libro: −403 % a t=0.6 — y con la ORIENTACIÓN intacta, porque un agujero no se ve
  // en el devanado, solo en el volumen. Por eso el gate mide las dos cosas.
  const PAD = 2;
  const px = nx + 2 * PAD, py = ny + 2 * PAD, pz = nz + 2 * PAD;
  const N = px * py * pz;
  const idx = (i: number, j: number, k: number) => (k * py + j) * px + i;
  /** llenado del vóxel REAL bajo la celda rellenada (−1 = borde de relleno o fuera) */
  const fre = (i: number, j: number, k: number) => {
    const a = i - PAD, b = j - PAD, c = k - PAD;
    return (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz) ? -1 : frente[(c * ny + b) * nx + a];
  };

  // ── 1. ocupación del instante t (el borde nace en 0 por construcción). Fraccional
  // si hay `ocupacion` (celda llena aporta su fracción real); binaria si no.
  const occ = (i: number, j: number, k: number): number => {
    if (!o.ocupacion) return 1;
    const a = i - PAD, b = j - PAD, c2 = k - PAD;
    if (a < 0 || b < 0 || c2 < 0 || a >= nx || b >= ny || c2 >= nz) return 0;
    return o.ocupacion[(c2 * ny + b) * nx + a];
  };
  // el INICIO de cada celda: el instante en que su primer vecino llegó (solo para
  // el modo continuo) — de ahí a su propia llegada, la fracción crece lineal
  let inicio: Float32Array | null = null;
  if (o.continuo) {
    inicio = new Float32Array(nx * ny * nz).fill(-1);
    const NB6 = [1, -1, nx, -nx, nx * ny, -nx * ny];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const id = (k * ny + j) * nx + i;
      if (frente[id] < 0) continue;
      let mn = Infinity;
      for (const d of NB6) {
        if (d === 1 && i === nx - 1) continue;
        if (d === -1 && i === 0) continue;
        if (d === nx && j === ny - 1) continue;
        if (d === -nx && j === 0) continue;
        if (d === nx * ny && k === nz - 1) continue;
        if (d === -nx * ny && k === 0) continue;
        const v = frente[id + d];
        if (v >= 0 && v < frente[id] && v < mn) mn = v;
      }
      if (Number.isFinite(mn)) inicio[id] = mn;
    }
  }
  let f = new Float32Array(N);
  for (let k = 0; k < pz; k++) for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) {
    const v = fre(i, j, k);
    if (v >= 0 && v <= t) { f[idx(i, j, k)] = occ(i, j, k); continue; }
    if (inicio && v > t) {
      const a = i - PAD, b = j - PAD, c2 = k - PAD;
      const ini = inicio[(c2 * ny + b) * nx + a];
      if (ini >= 0 && ini <= t && v > ini) {
        f[idx(i, j, k)] = occ(i, j, k) * ((t - ini) / (v - ini));
      }
    }
  }

  // ── 2. suavizado de caja (redondea el escalón de vóxel, conserva el nivel 0.5)
  const pasadas = o.suavizado ?? 1;
  for (let s = 0; s < pasadas; s++) {
    const g = new Float32Array(N);
    for (let k = 0; k < pz; k++) for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) {
      let acc = 0, n = 0;
      for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = i + di, b = j + dj, c = k + dk;
        if (a < 0 || b < 0 || c < 0 || a >= px || b >= py || c >= pz) continue;
        acc += f[idx(a, b, c)]; n++;
      }
      g[idx(i, j, k)] = acc / n;
    }
    f = g;
  }

  // ── 3. un vértice por celda que cruza (las "esquinas" son CENTROS de vóxel)
  const NI = px - 1, NJ = py - 1, NK = pz - 1;
  const cellV = new Int32Array(Math.max(1, NI * NJ * NK)).fill(-1);
  const ci = (i: number, j: number, k: number) => (k * NJ + j) * NI + i;
  const CORN = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const EDG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const P: number[] = [], FI: number[] = [];
  for (let k = 0; k < NK; k++) for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
    const s = new Array(8);
    let dentro = 0;
    for (let c = 0; c < 8; c++) {
      s[c] = f[idx(i + CORN[c][0], j + CORN[c][1], k + CORN[c][2])];
      if (s[c] > ISO) dentro++;
    }
    if (dentro === 0 || dentro === 8) continue;
    let ax = 0, ay = 0, az = 0, n = 0;
    for (const [a, b] of EDG) {
      const fa = s[a], fb = s[b];
      if ((fa > ISO) === (fb > ISO)) continue;
      const w = (ISO - fa) / (fb - fa);
      ax += CORN[a][0] + w * (CORN[b][0] - CORN[a][0]);
      ay += CORN[a][1] + w * (CORN[b][1] - CORN[a][1]);
      az += CORN[a][2] + w * (CORN[b][2] - CORN[a][2]);
      n++;
    }
    ax /= n; ay /= n; az /= n;
    // FILL TIME del vértice: el más RECIENTE de las esquinas ya llenas — en el
    // frente que avanza vale ≈ t, y por eso el borde caliente se ve caliente.
    let fill = 0;
    for (let c = 0; c < 8; c++) {
      const fv = fre(i + CORN[c][0], j + CORN[c][1], k + CORN[c][2]);
      if (fv >= 0 && fv <= t && fv > fill) fill = fv;
    }
    cellV[ci(i, j, k)] = P.length / 3;
    // −PAD: las coordenadas vuelven a la rejilla REAL (el relleno es interno)
    P.push(x0 + (i - PAD + 0.5 + ax) * cellMm, y0 + (j - PAD + 0.5 + ay) * cellMm, z0 + (k - PAD + 0.5 + az) * cellMm);
    FI.push(fill);
  }

  // ── 4. quads: por cada arista dual que cambia de signo, las 4 celdas que la rodean
  const I: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // devanado ANTIHORARIO visto desde fuera → normales hacia afuera → volumen POSITIVO.
    // Al revés el volumen sale negativo (medido: −7941 en vez de +7941) y el material se
    // ve del lado equivocado. El gate exige el signo, para que una regresión se vea.
    if (flip) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c);
  };
  for (let k = 0; k < pz; k++) for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) {
    const v0 = f[idx(i, j, k)] > ISO;
    if (i + 1 < px && j >= 1 && j <= py - 2 && k >= 1 && k <= pz - 2 && v0 !== (f[idx(i + 1, j, k)] > ISO))
      quad(cellV[ci(i, j - 1, k - 1)], cellV[ci(i, j, k - 1)], cellV[ci(i, j, k)], cellV[ci(i, j - 1, k)], v0);
    if (j + 1 < py && i >= 1 && i <= px - 2 && k >= 1 && k <= pz - 2 && v0 !== (f[idx(i, j + 1, k)] > ISO))
      quad(cellV[ci(i - 1, j, k - 1)], cellV[ci(i, j, k - 1)], cellV[ci(i, j, k)], cellV[ci(i - 1, j, k)], !v0);
    if (k + 1 < pz && i >= 1 && i <= px - 2 && j >= 1 && j <= py - 2 && v0 !== (f[idx(i, j, k + 1)] > ISO))
      quad(cellV[ci(i - 1, j - 1, k)], cellV[ci(i, j - 1, k)], cellV[ci(i, j, k)], cellV[ci(i - 1, j, k)], v0);
  }

  // ── 5. normales por acumulación de caras + volumen por divergencia
  const positions = Float32Array.from(P);
  const indices = Uint32Array.from(I);
  const normals = new Float32Array(positions.length);
  let vol6 = 0;
  for (let e = 0; e < indices.length; e += 3) {
    const a = indices[e] * 3, b = indices[e + 1] * 3, c = indices[e + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx2 = uy * vz - uz * vy, ny2 = uz * vx - ux * vz, nz2 = ux * vy - uy * vx;
    normals[a] += nx2; normals[a + 1] += ny2; normals[a + 2] += nz2;
    normals[b] += nx2; normals[b + 1] += ny2; normals[b + 2] += nz2;
    normals[c] += nx2; normals[c + 1] += ny2; normals[c + 2] += nz2;
    // V = (1/6)·Σ v0·(v1×v2)
    vol6 += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
          + positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2])
          + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  for (let v = 0; v < normals.length; v += 3) {
    const L = Math.hypot(normals[v], normals[v + 1], normals[v + 2]) || 1;
    normals[v] /= L; normals[v + 1] /= L; normals[v + 2] /= L;
  }
  return { positions, normals, indices, fill: Float32Array.from(FI), volumeMm3: vol6 / 6, tris: indices.length / 3 };
}
