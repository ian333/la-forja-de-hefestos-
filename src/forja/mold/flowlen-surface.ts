/**
 * LONGITUD DE FLUJO SOBRE LA MALLA — el camino "dual domain" (lo que usa la industria).
 * ============================================================================
 * Hermano de `flowlen.ts` (que voxeliza el hueco). Misma física — L geodésica desde la
 * compuerta POR DONDE PUEDE IR EL FUNDIDO, §5.5.5 — por otro camino:
 *
 *   · flowlen.ts (VÓXEL): rejilla 3D del hueco. Exacto y general, pero costó 5.5 s con
 *     celda de 0.72 mm ⇒ congela el navegador. Sirve para el análisis a fondo.
 *   · este (SUPERFICIE): Dijkstra sobre las ARISTAS de la malla. Milisegundos ⇒ vive en
 *     el CAD y se pinta por vértice. Es lo que hacen los solvers comerciales para pared
 *     delgada ("dual domain"): en una pieza de inyección la pared es delgada por
 *     definición (§2.3.1), así que el camino del fundido ES la superficie.
 *
 * Que sean DOS caminos independientes es la ventaja, no la redundancia: si el L máx de
 * los dos no coincide, uno miente. Ese cruce es el gate.
 *
 * PURO: node-testeable, sin three.js.
 */

export interface SurfaceFlow {
  /** L geodésica por VÉRTICE (mm). Infinity = no le llega el plástico (short shot). */
  flowLenMm: Float32Array;
  maxFlowLenMm: number;
  /** índice del vértice de la compuerta */
  gateVertex: number;
  /** vértices sin camino al gate */
  unreachable: number;
  nVertices: number;
}

/**
 * Mide L sobre la malla. `gateMm` se ajusta al vértice más cercano — el fundido entra por
 * un punto de la pieza, no por el aire.
 */
export function surfaceFlowLength(
  mesh: { positions: Float32Array | number[]; indices: Uint32Array | number[]; normals?: Float32Array | number[] },
  gateMm: { x: number; y: number; z: number },
  /** pared nominal (mm) — la necesita el EMPAREJADO de caras opuestas (dual domain) */
  wallMm?: number,
  /** SOLDADURA POR ÉPSILON (mm): une vértices de CUERPOS DISTINTOS que se tocan
   *  sin coincidir (compound de sólidos traslapados — las redes de colada). La
   *  teselación de un compound no comparte vértices entre cuerpos: sin esto,
   *  cada empalme es una isla y TODO sale inalcanzable (visto en la Fig 6.13:
   *  el frente se atoraba en el sprue para siempre). 0 = solo exacta. */
  weldEpsMm = 0,
): SurfaceFlow {
  const P = mesh.positions, I = mesh.indices, N = mesh.normals;
  const nV = Math.floor(P.length / 3);
  if (!nV) return { flowLenMm: new Float32Array(0), maxFlowLenMm: 0, gateVertex: 0, unreachable: 0, nVertices: 0 };

  // ── SOLDAR vértices coincidentes ─────────────────────────────────────────
  // La teselación del kernel REPITE vértices por cara: sin soldar, el grafo queda en
  // islas sueltas (cada triángulo aislado) y Dijkstra no cruza de una a otra ⇒ todo
  // saldría "inalcanzable". Se agrupan por posición redondeada a 1 µm.
  const key = new Map<string, number>();
  const rep = new Int32Array(nV);
  for (let v = 0; v < nV; v++) {
    const k = `${Math.round(P[v * 3] * 1000)},${Math.round(P[v * 3 + 1] * 1000)},${Math.round(P[v * 3 + 2] * 1000)}`;
    const hit = key.get(k);
    if (hit === undefined) { key.set(k, v); rep[v] = v; } else rep[v] = hit;
  }

  if (weldEpsMm > 0) {
    // UNION-FIND transitivo sobre celdas de tamaño eps (27 vecinas): los caps de un
    // gate 0.6 mm DENTRO de la pared de su cavidad quedan a <eps de sus vértices.
    const find = (v: number): number => { let r = v; while (rep[r] !== r) r = rep[r]; while (rep[v] !== r) { const n = rep[v]; rep[v] = r; v = n; } return r; };
    const cell = new Map<string, number[]>();
    const cs = weldEpsMm;
    for (let v = 0; v < nV; v++) {
      if (rep[v] !== v) continue;                        // solo representantes
      const cx = Math.floor(P[v * 3] / cs), cy = Math.floor(P[v * 3 + 1] / cs), cz = Math.floor(P[v * 3 + 2] / cs);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const kk = `${cx + dx},${cy + dy},${cz + dz}`;
        const bucket = cell.get(kk);
        if (bucket) for (const u of bucket) {
          const d = Math.hypot(P[v * 3] - P[u * 3], P[v * 3 + 1] - P[u * 3 + 1], P[v * 3 + 2] - P[u * 3 + 2]);
          if (d <= weldEpsMm) { const ru = find(u), rv = find(v); if (ru !== rv) rep[rv] = ru; }
        }
      }
      const k0 = `${cx},${cy},${cz}`;
      if (!cell.has(k0)) cell.set(k0, []);
      cell.get(k0)!.push(v);
    }
    for (let v = 0; v < nV; v++) rep[v] = find(v);        // aplanar para el grafo
  }

  // grafo de aristas (sobre los representantes)
  const adj = new Map<number, Array<[number, number]>>();
  const link = (a: number, b: number) => {
    const ra = rep[a], rb = rep[b];
    if (ra === rb) return;
    const d = Math.hypot(P[ra * 3] - P[rb * 3], P[ra * 3 + 1] - P[rb * 3 + 1], P[ra * 3 + 2] - P[rb * 3 + 2]);
    if (!adj.has(ra)) adj.set(ra, []);
    if (!adj.has(rb)) adj.set(rb, []);
    adj.get(ra)!.push([rb, d]);
    adj.get(rb)!.push([ra, d]);
  };
  for (let t = 0; t + 2 < I.length; t += 3) {
    link(I[t], I[t + 1]); link(I[t + 1], I[t + 2]); link(I[t + 2], I[t]);
  }

  // ── EMPAREJAR LAS CARAS OPUESTAS DE LA PARED — esto ES "dual domain" ─────
  // Sin esto, el grafo mide L POR LA CÁSCARA: para llegar al punto opuesto el camino
  // sube por la cara interior, cruza por la boca y BAJA POR FUERA. Medido en el vaso:
  // 312.6 mm cuando el vóxel (que sí atraviesa el hueco) dice 137.9 ≈ radio 70 + alto 65.
  // El doble. Y el fundido NO rodea la pared: la llena de golpe — las dos caras están a
  // 1.2 mm una de otra y se llenan a la vez.
  // El emparejado une los vértices que son la MISMA pared vista por sus dos lados:
  // cerca (≤ ~1.5 × pared) y con normales OPUESTAS (n·n < 0). Ese es el criterio de los
  // solvers comerciales, y el peso del salto es ~0: cruzar el espesor no cuesta recorrido.
  // Lo cazó el CRUCE contra el vóxel. Sin ese segundo camino, 312 mm "se veía bien".
  if (N && wallMm && wallMm > 0) {
    const maxD = wallMm * 1.5, cell = maxD;
    const bucket = new Map<string, number[]>();
    const bk = (x: number, y: number, z: number) =>
      `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    for (let v = 0; v < nV; v++) {
      if (rep[v] !== v) continue;
      const k = bk(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      if (!bucket.has(k)) bucket.set(k, []);
      bucket.get(k)!.push(v);
    }
    for (let v = 0; v < nV; v++) {
      if (rep[v] !== v) continue;
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      const bx = Math.floor(x / cell), by = Math.floor(y / cell), bz = Math.floor(z / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const w of bucket.get(`${bx + dx},${by + dy},${bz + dz}`) ?? []) {
          if (w <= v) continue;
          const d = Math.hypot(x - P[w * 3], y - P[w * 3 + 1], z - P[w * 3 + 2]);
          if (d > maxD || d < 1e-6) continue;
          // normales OPUESTAS ⇒ son los dos lados de la misma pared, no dos puntos
          // vecinos de la misma cara (esos ya los une la arista).
          const dot = N[v * 3] * N[w * 3] + N[v * 3 + 1] * N[w * 3 + 1] + N[v * 3 + 2] * N[w * 3 + 2];
          if (dot > -0.5) continue;
          if (!adj.has(v)) adj.set(v, []);
          if (!adj.has(w)) adj.set(w, []);
          adj.get(v)!.push([w, 0]);          // cruzar el espesor NO cuesta recorrido
          adj.get(w)!.push([v, 0]);
        }
      }
    }
  }

  // la compuerta = el vértice más cercano al punto dado
  let gate = 0, bd = Infinity;
  for (let v = 0; v < nV; v++) {
    if (rep[v] !== v) continue;
    const d = (P[v * 3] - gateMm.x) ** 2 + (P[v * 3 + 1] - gateMm.y) ** 2 + (P[v * 3 + 2] - gateMm.z) ** 2;
    if (d < bd) { bd = d; gate = v; }
  }

  // Dijkstra.
  // ⚠ LÍMITE CONOCIDO: la cola extrae el mínimo en O(n) lineal (sin binary heap). Con las
  // mallas de una pieza de inyección (cientos a pocos miles de vértices) corre en ms y
  // vale la simplicidad; a partir de ~50k vértices esto se vuelve O(n²) y hay que meter
  // un heap de verdad. El gate mide el tiempo (< 250 ms) — si un día truena, es esto.
  const dist = new Float32Array(nV).fill(Infinity);
  dist[gate] = 0;
  const done = new Uint8Array(nV);
  const heap: number[] = [gate];
  while (heap.length) {
    let bi = 0;
    for (let t = 1; t < heap.length; t++) if (dist[heap[t]] < dist[heap[bi]]) bi = t;
    const cur = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    for (const [nb, w] of adj.get(cur) ?? []) {
      const nd = dist[cur] + w;
      if (nd < dist[nb]) { dist[nb] = nd; heap.push(nb); }
    }
  }

  // reparte a los vértices duplicados (los que se soldaron)
  const out = new Float32Array(nV);
  let maxL = 0, unreachable = 0;
  for (let v = 0; v < nV; v++) {
    out[v] = dist[rep[v]];
    if (!Number.isFinite(out[v])) unreachable++;
    else if (out[v] > maxL) maxL = out[v];
  }
  return { flowLenMm: out, maxFlowLenMm: +maxL.toFixed(2), gateVertex: gate, unreachable, nVertices: nV };
}

/** rampa del frente: lo que entra primero = claro/caliente; lo último = morado.
 *  El color NO decora: dice cuándo llegó el fundido a cada punto. */
export function flowColor(u: number): [number, number, number] {
  const c: Array<[number, number, number]> = [
    [1.0, 0.945, 0.66], [1.0, 0.69, 0.23], [0.91, 0.365, 0.165], [0.59, 0.125, 0.235], [0.18, 0.06, 0.235],
  ];
  const t = Math.max(0, Math.min(0.999, u)) * (c.length - 1);
  const i = Math.floor(t), f = t - i, a = c[i], b = c[Math.min(c.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** colores por vértice para el frente en `frontLenMm`. Lo NO llenado va gris apagado;
 *  lo inalcanzable, ROJO (short shot: el defecto se ve, no se esconde). */
export function paintFlowColors(sf: SurfaceFlow, frontLenMm: number): Float32Array {
  const col = new Float32Array(sf.nVertices * 3);
  for (let v = 0; v < sf.nVertices; v++) {
    const L = sf.flowLenMm[v];
    let c: [number, number, number];
    if (!Number.isFinite(L)) c = [1, 0.23, 0.19];                       // nunca se llena
    else if (L <= frontLenMm) c = flowColor(L / Math.max(1e-6, sf.maxFlowLenMm));
    else c = [0.14, 0.17, 0.24];                                        // todavía vacío
    col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2];
  }
  return col;
}
