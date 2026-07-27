/**
 * EL HUECO A/B → `inCavity` — el puente entre el molde REAL y la longitud de flujo.
 * ============================================================================
 * `flowlen.ts` pide una función `inCavity(x,y,z)`: "¿aquí hay plástico?". Este archivo
 * la construye del MOLDE, no de una fórmula: el hueco entre el inserto de cavidad (A) y
 * el de núcleo (B) es EXACTAMENTE el interior de la malla de la pieza — porque así se
 * talla (`buildMoldParts` resta la pieza a los dos insertos).
 *
 * O sea: la pregunta "¿qué figura es?" nunca se hace. Se pregunta "¿este punto está
 * dentro del sólido que separa A de B?" — y eso vale para el vaso, la carcasa de laptop
 * y la pistola de agua por igual.
 *
 * MÉTODO: ray casting (par/impar) contra los triángulos, acelerado con una rejilla de
 * cubetas. El rayo va en **+X**, no en +Z, y eso NO es un detalle:
 *
 *   Con el rayo en +Z, las PAREDES (casi verticales) quedan de CANTO — su proyección en
 *   XY degenera a una línea, el denominador baricéntrico se va a ~0 y el `continue` de
 *   "triángulo de canto" las descarta. Resultado MEDIDO: el vaso daba 33,450 mm³ contra
 *   los 50,510 del kernel — **me comía el 34 % de la pieza**, justo la pared. El fondo
 *   (horizontal) sí se veía… y por eso "solo se inyectaba un disco".
 *   Con el rayo en +X, las paredes se cruzan de FRENTE. El fondo queda de canto, pero un
 *   fondo se cruza igual por sus bordes: la geometría cerrada siempre da cruces pares.
 *
 * El cruce contra `measure.volumeMm3` del kernel es lo que caza esto — una malla puede
 * "verse bien" y estar mal medida. Sin ese número, el bug pasa de largo.
 */

export interface MeshLike { positions: Float32Array | number[]; indices: Uint32Array | number[] }

export interface SolidQuery {
  /** ¿el punto (mm) está DENTRO del sólido de la pieza (= el hueco A/B)? */
  inside(x: number, y: number, z: number): boolean;
  bbox: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
  nTris: number;
}

/**
 * Prepara la consulta punto-dentro-de-malla. Se construye UNA vez y se llama millones de
 * veces (una por vóxel), por eso la rejilla: sin ella, cada punto probaría TODOS los
 * triángulos y voxelizar sería inviable.
 */
export function solidFromMesh(mesh: MeshLike, o?: { bucketsPerSide?: number }): SolidQuery {
  const P = mesh.positions, I = mesh.indices;
  const nTris = Math.floor(I.length / 3);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i];
    if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1];
    if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2];
  }
  // cubetas en (Y,Z): el rayo va en +X, así que se indexa por el plano PERPENDICULAR
  const NB = Math.max(8, Math.min(96, o?.bucketsPerSide ?? 48));
  const sy = (y1 - y0) / NB || 1, sz = (z1 - z0) / NB || 1;
  const buckets: number[][] = Array.from({ length: NB * NB }, () => []);
  const bj = (y: number) => Math.max(0, Math.min(NB - 1, Math.floor((y - y0) / sy)));
  const bk = (z: number) => Math.max(0, Math.min(NB - 1, Math.floor((z - z0) / sz)));
  for (let t = 0; t < nTris; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ty0 = Math.min(P[a + 1], P[b + 1], P[c + 1]), ty1 = Math.max(P[a + 1], P[b + 1], P[c + 1]);
    const tz0 = Math.min(P[a + 2], P[b + 2], P[c + 2]), tz1 = Math.max(P[a + 2], P[b + 2], P[c + 2]);
    for (let k = bk(tz0); k <= bk(tz1); k++) for (let j = bj(ty0); j <= bj(ty1); j++) buckets[k * NB + j].push(t);
  }

  return {
    bbox: { x0, y0, z0, x1, y1, z1 }, nTris,
    inside(x, y, z) {
      if (x < x0 || x > x1 || y < y0 || y > y1 || z < z0 || z > z1) return false;
      // rayo +X desde (x,y,z): cuenta cruces a la DERECHA. impar ⇒ dentro.
      const list = buckets[bk(z) * NB + bj(y)];
      let cruces = 0;
      for (let n = 0; n < list.length; n++) {
        const t = list[n];
        const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
        const ax = P[a], ay = P[a + 1], az = P[a + 2];
        const bx = P[b], by = P[b + 1], bz = P[b + 2];
        const cx = P[c], cy = P[c + 1], cz = P[c + 2];
        // ¿(y,z) cae dentro del triángulo proyectado en YZ? (coords baricéntricas)
        const d = (bz - cz) * (ay - cy) + (cy - by) * (az - cz);
        if (Math.abs(d) < 1e-12) continue;                     // triángulo de canto al rayo
        const l1 = ((bz - cz) * (y - cy) + (cy - by) * (z - cz)) / d;
        const l2 = ((cz - az) * (y - cy) + (ay - cy) * (z - cz)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const xHit = l1 * ax + l2 * bx + l3 * cx;
        if (xHit > x) cruces++;
      }
      return (cruces & 1) === 1;
    },
  };
}

/**
 * LA COMPUERTA por defecto: el punto de la pieza más cercano al centro del molde, sobre
 * la partición. Es donde el bebedero entra (gate central §7.2.2). Se puede pasar otra.
 */
export function defaultGate(q: SolidQuery): { x: number; y: number; z: number } {
  const cx = (q.bbox.x0 + q.bbox.x1) / 2, cy = (q.bbox.y0 + q.bbox.y1) / 2;
  // Barre desde ABAJO y se queda con el PRIMER punto sólido del eje central: ahí entra el
  // bebedero. Ojo con el paso: un `steps` grueso salta el fondo (1.2 mm de un vaso de 65)
  // y el gate aterriza en el AIRE del interior — medido: caía en z=32.5, a media altura,
  // y el frente arrancaba desde la nada. El paso se ata a la pieza, no a un número fijo.
  const H = q.bbox.z1 - q.bbox.z0;
  const steps = Math.max(64, Math.ceil(H / 0.25));         // ≤0.25 mm: resuelve cualquier fondo
  for (let s = 0; s <= steps; s++) {
    const z = q.bbox.z0 + (s / steps) * H;
    if (q.inside(cx, cy, z)) return { x: cx, y: cy, z: +z.toFixed(3) };
  }
  // el eje central es hueco en TODA su altura (una dona, un marco): el gate va al primer
  // sólido que se encuentre barriendo hacia afuera, sobre el plano bajo.
  for (let rad = 1; rad < Math.max(q.bbox.x1 - cx, q.bbox.y1 - cy); rad += 1) {
    for (let a = 0; a < 16; a++) {
      const th = (a / 16) * Math.PI * 2;
      const x = cx + rad * Math.cos(th), y = cy + rad * Math.sin(th);
      for (let s = 0; s <= steps; s++) {
        const z = q.bbox.z0 + (s / steps) * H;
        if (q.inside(x, y, z)) return { x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(3) };
      }
    }
  }
  return { x: cx, y: cy, z: q.bbox.z0 };
}
