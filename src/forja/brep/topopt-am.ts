/**
 * ⚒️ La Forja — RESTRICCIONES DE MANUFACTURA para el diseño generativo (topopt).
 * ============================================================================
 * Lo que hace que el generativo sirva para MECANISMOS imprimibles de 1 pieza
 * (lo que Fusion NO hace). PURO: sin OCCT/FE → se prueba en node.
 *
 *  (1) FILTRO DE VOLADIZO (AM filter, Langelaar 2016): una capa solo puede ser
 *      sólida si tiene SOPORTE (dentro de `reach` celdas) en la capa de abajo.
 *      Barrido desde la cama (k=0) hacia arriba ⇒ la estructura SE IMPRIME SIN
 *      SOPORTES, respetando el ángulo crítico de la impresora. "La precisión de
 *      la impresora a nuestro favor."
 *  (2) REGIONES PASIVAS (keep-in / keep-out): congela superficies funcionales
 *      (lóbulos, cojinetes, barrenos) como SÓLIDO fijo y las holguras como VACÍO
 *      fijo. El optimizador solo aligera el "alma".
 *
 * Convención: build = +Z (la pieza crece capa a capa en k). Rejilla regular de
 * voxeles; `cellOf[i + nx*(j + ny*k)]` = índice de celda o −1 (fuera del sólido).
 */

export interface CellGrid { nx: number; ny: number; nz: number; cellOf: Int32Array; ijk: Int32Array }

/** Celdas de avance lateral por capa a partir del ángulo MÁX de voladizo (medido
 *  desde la VERTICAL). 45° → 1 celda/capa (auto-soporte clásico). Más abierto =
 *  más voladizo permitido. Mín 1 (siempre permite la pared vertical + 45°). */
export function overhangReachFromAngle(maxOverhangDeg: number): number {
  const d = Math.min(80, Math.max(0, maxOverhangDeg));
  return Math.max(1, Math.round(Math.tan((d * Math.PI) / 180)));
}

/**
 * Filtro de voladizo (forward). Devuelve la densidad IMPRIMIBLE por celda: a cada
 * capa k≥1, la densidad se limita al soporte disponible abajo (máx en una huella
 * Chebyshev de radio `reach`). La cama (k=0) imprime libre. Material sin soporte
 * (voladizo > ángulo crítico, islas flotantes) se va a 0.
 */
export function amOverhangFilter(x: Float64Array, g: CellGrid, reach = 1): Float64Array {
  const { nx, ny, nz, cellOf } = g;
  const out = Float64Array.from(x);
  const lin = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 1; k < nz; k++) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const e = cellOf[lin(i, j, k)]; if (e < 0) continue;
      let sup = 0;
      for (let dj = -reach; dj <= reach; dj++) for (let di = -reach; di <= reach; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const eb = cellOf[lin(ii, jj, k - 1)];
        if (eb >= 0 && out[eb] > sup) sup = out[eb];
      }
      if (sup < out[e]) out[e] = sup;     // min(densidad, soporte)
    }
  }
  return out;
}

export type RegionKind = 'solid' | 'void' | 'design';
export interface PassiveMask { solid: boolean[]; void: boolean[]; nDesign: number }

/** Clasifica cada celda por su centroide: SÓLIDO fijo (keep-in), VACÍO fijo
 *  (keep-out) o variable de DISEÑO. nDesign = celdas optimizables. */
export function passiveMask(
  cells: { cx: number; cy: number; cz: number }[],
  region: (cx: number, cy: number, cz: number) => RegionKind,
): PassiveMask {
  const solid = new Array<boolean>(cells.length).fill(false);
  const vd = new Array<boolean>(cells.length).fill(false);
  let nDesign = 0;
  for (let e = 0; e < cells.length; e++) {
    const r = region(cells[e].cx, cells[e].cy, cells[e].cz);
    if (r === 'solid') solid[e] = true;
    else if (r === 'void') vd[e] = true;
    else nDesign++;
  }
  return { solid, void: vd, nDesign };
}

/** Aplica las regiones pasivas a un campo de densidad (sólido→1, vacío→0). */
export function applyPassive(x: Float64Array, mask: PassiveMask): void {
  for (let e = 0; e < x.length; e++) {
    if (mask.solid[e]) x[e] = 1;
    else if (mask.void[e]) x[e] = 0;
  }
}
