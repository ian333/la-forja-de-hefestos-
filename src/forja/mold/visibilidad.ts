/**
 * VISIBILIDAD PARA EL USUARIO FINAL — el predicado que Kazmer usa en CUATRO capítulos.
 *
 * El libro no da una regla numérica para la estética: da un PREDICADO, y lo aplica
 * igual en §4, §7, §11 y §2. Las citas literales:
 *
 *   · §4.1.2 (V4.3, taza): la partición cerca del labio *"would result in a witness
 *     line and possible flash that might make the molded cup unusable"*; la buena está
 *     *"at the bottom of the rim"*. → ¿la línea de partición cruza superficie visible?
 *   · §4.1.4 (V4.6, bezel): *"Either location (or even any location in between) would
 *     likely be acceptable since the entire shelf is HIDDEN FROM VIEW."* → el libro dice
 *     EXPRESAMENTE que la posición no importa; lo que importa es la visibilidad.
 *   · §7.1.3 (V7.1, TOP-10): *"their removal will leave a witness mark on the surface"*
 *     y la solución es *"locate gates on NON-VISIBLE SURFACES such as underneath a side
 *     wall instead of into the side wall."*
 *   · §11.2.5 (V11.7): el ejector pad trae *"high volumetric shrinkage that can lead to
 *     sink on the AESTHETIC SURFACE of the part."*
 *   · §2.3.2 (V2.2): costilla > 0.70·h ⇒ *"sink to appear on the side of the part
 *     OPPOSITE the rib."*
 *
 * Los cuatro se reducen a: **¿la marca del proceso cae en superficie visible?**
 *
 * MÉTODO — el libro dice literalmente *"renderizar la pieza desde el punto de vista del
 * usuario final y marcar qué superficies son visibles"*, así que eso hacemos: un
 * Z-BUFFER ORTOGRÁFICO por vista declarada. No es heurística ni ángulo-de-normal: una
 * cara es visible si (a) mira al observador y (b) NADA de la propia pieza la tapa.
 * La diferencia entre (a) y (a)+(b) es justo la auto-oclusión, que es el caso del libro
 * ("underneath a side wall": la cara mira hacia abajo Y la pared la esconde).
 *
 * ⚠ EXTENSIÓN DECLARADA (el libro no la da): cuando la pieza no trae vistas de uso
 * declaradas, usamos el hemisferio superior + los cuatro costados, y EXCLUIMOS la cara
 * de asiento (−Z). Sale del caso canónico de la taza (§4.1.2/§7.1.3): el usuario ve el
 * exterior y el labio, NO ve la base sobre la que se apoya. Queda etiquetado como
 * supuesto en la lámina; si el cliente declara sus vistas, mandan las suyas.
 */

export interface MallaVis {
  positions: Float32Array | number[];
  indices: Uint32Array | number[];
}

/** Una vista de uso: la dirección DESDE LA QUE MIRA el observador (apunta hacia la pieza). */
export interface VistaUso {
  nombre: string;
  /** dirección de mirada, del ojo hacia la pieza (se normaliza) */
  dir: [number, number, number];
  /** peso relativo de esta vista en el juicio (por defecto 1) */
  peso?: number;
}

export interface Visibilidad {
  vistas: VistaUso[];
  /** declaradas por el cliente (true) o el supuesto de la taza (false) */
  vistasDeclaradas: boolean;
  /** por triángulo: fracción de área visible promediada por peso de vista (0..1) */
  visTri: Float32Array;
  /** por triángulo: MEJOR fracción de área visible entre todas las vistas (0..1).
   *  Es la que manda para contabilidad de área: una cara cuenta como vista si alguna
   *  vista de uso la alcanza. */
  fracMaxTri: Float32Array;
  /** por triángulo: área en mm² */
  areaTri: Float32Array;
  areaTotalMm2: number;
  areaVisibleMm2: number;
  /** área que MIRA al observador en alguna vista pero está TAPADA por la propia pieza */
  areaOcultaPorSiMismaMm2: number;
  /** resolución del z-buffer usada (px por lado) */
  res: number;
  /** el predicado del libro sobre un punto de la superficie: ¿se ve?
   *  Se resuelve CONTRA EL Z-BUFFER, no contra el triángulo más cercano: es exacto
   *  aunque la malla sea gruesa (una cara de 40×40 con 2 triángulos responde bien). */
  puntoVisible(p: [number, number, number]): {
    visible: boolean; vis: number; vistas: string[];
    /** por vista: profundidad del punto, del frente y la tolerancia — para diagnosticar */
    detalle: Array<{ vista: string; d: number; df: number; tol: number }>;
    /** triángulo sobre el que cayó la marca (−1 si no se halló) */
    tri: number;
  };
}

/** El supuesto de la taza (§4.1.2 · §7.1.3) — EXTENSIÓN DECLARADA, no del libro. */
export function vistasTaza(): VistaUso[] {
  return [
    { nombre: 'arriba', dir: [0, 0, -1] },
    { nombre: 'frente', dir: [0, 1, 0] },
    { nombre: 'atrás', dir: [0, -1, 0] },
    { nombre: 'derecha', dir: [-1, 0, 0] },
    { nombre: 'izquierda', dir: [1, 0, 0] },
    // dos oblicuas: es como se sostiene una taza en la mano, no de canto exacto
    { nombre: 'oblicua-A', dir: [-0.577, 0.577, -0.577] },
    { nombre: 'oblicua-B', dir: [0.577, -0.577, -0.577] },
  ];
}

function baseOrtonormal(d: [number, number, number]) {
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  const w: [number, number, number] = [d[0] / L, d[1] / L, d[2] / L];
  // un vector no paralelo a w
  const a: [number, number, number] = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let ux = a[1] * w[2] - a[2] * w[1], uy = a[2] * w[0] - a[0] * w[2], uz = a[0] * w[1] - a[1] * w[0];
  const lu = Math.hypot(ux, uy, uz) || 1; ux /= lu; uy /= lu; uz /= lu;
  const vx = w[1] * uz - w[2] * uy, vy = w[2] * ux - w[0] * uz, vz = w[0] * uy - w[1] * ux;
  return { w, u: [ux, uy, uz] as [number, number, number], v: [vx, vy, vz] as [number, number, number] };
}

interface VistaRaster {
  /** fracción de área visible por triángulo (0..1) en esta vista */
  frac: Float32Array;
  /** buffer de profundidad (Infinity donde no hay pieza) */
  depth: Float32Array;
  /** base ortonormal y encuadre, para poder proyectar puntos después */
  w: [number, number, number]; u: [number, number, number]; v: [number, number, number];
  su0: number; sv0: number; sU: number; sV: number; tol: number;
}

/**
 * Z-buffer ortográfico de UNA vista.
 *
 * Devuelve la FRACCIÓN DE ÁREA visible por triángulo (píxeles que el triángulo gana en
 * el z-test ÷ píxeles que cubre). El booleano por triángulo no sirve: una cara grande
 * puede estar tapada a la mitad, y con mallas gruesas (una pared = 2 triángulos) el
 * booleano reporta "visible" y pierde toda el área escondida.
 *
 * Convención: `w` = dirección de mirada (ojo→pieza). La profundidad crece alejándose
 * del ojo, así que el visible es el de MENOR profundidad. Una cara mira al observador
 * si su normal (saliente) tiene n·w < 0.
 */
function rasterizarVista(
  P: ArrayLike<number>, I: ArrayLike<number>, nTri: number,
  cen: Float32Array, nor: Float32Array,
  dir: [number, number, number], res: number,
): VistaRaster {
  const { w, u, v } = baseOrtonormal(dir);
  // extensión en el plano de la vista
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    const su = x * u[0] + y * u[1] + z * u[2];
    const sv = x * v[0] + y * v[1] + z * v[2];
    if (su < u0) u0 = su; if (su > u1) u1 = su;
    if (sv < v0) v0 = sv; if (sv > v1) v1 = sv;
  }
  const du = (u1 - u0) || 1, dv = (v1 - v0) || 1;
  // margen de medio píxel para que nada caiga fuera por redondeo
  const su0 = u0 - du * 0.01, sv0 = v0 - dv * 0.01;
  const sU = (res - 1) / (du * 1.02), sV = (res - 1) / (dv * 1.02);

  const depth = new Float32Array(res * res).fill(Infinity);
  // tolerancia para consultas PUNTUALES: una celda de raster se traduce, sobre una cara
  // inclinada, a un error de profundidad de ese orden
  const tolPunto = Math.max(du / res, dv / res) * 3 + 1e-6;

  const mira = (t: number) =>
    nor[t * 3] * w[0] + nor[t * 3 + 1] * w[1] + nor[t * 3 + 2] * w[2] < 0;

  // proyecta un triángulo y recorre los centros de píxel que cubre
  const pu = [0, 0, 0], pv = [0, 0, 0], pd = [0, 0, 0];
  function recorrer(t: number, fn: (idx: number, d: number) => void): number {
    const ia = I[t * 3] * 3, ib = I[t * 3 + 1] * 3, ic = I[t * 3 + 2] * 3;
    const ks = [ia, ib, ic];
    for (let m = 0; m < 3; m++) {
      const k = ks[m], x = P[k], y = P[k + 1], z = P[k + 2];
      pu[m] = (x * u[0] + y * u[1] + z * u[2] - su0) * sU;
      pv[m] = (x * v[0] + y * v[1] + z * v[2] - sv0) * sV;
      pd[m] = x * w[0] + y * w[1] + z * w[2];
    }
    const e = (pu[1] - pu[0]) * (pv[2] - pv[0]) - (pv[1] - pv[0]) * (pu[2] - pu[0]);
    if (Math.abs(e) < 1e-12) return 0;                 // de canto: no cubre píxeles
    const minU = Math.max(0, Math.floor(Math.min(pu[0], pu[1], pu[2])));
    const maxU = Math.min(res - 1, Math.ceil(Math.max(pu[0], pu[1], pu[2])));
    const minV = Math.max(0, Math.floor(Math.min(pv[0], pv[1], pv[2])));
    const maxV = Math.min(res - 1, Math.ceil(Math.max(pv[0], pv[1], pv[2])));
    for (let py = minV; py <= maxV; py++) {
      for (let px = minU; px <= maxU; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        const l0 = ((pu[1] - cx) * (pv[2] - cy) - (pv[1] - cy) * (pu[2] - cx)) / e;
        const l1 = ((pu[2] - cx) * (pv[0] - cy) - (pv[2] - cy) * (pu[0] - cx)) / e;
        const l2 = 1 - l0 - l1;
        if (l0 < -1e-9 || l1 < -1e-9 || l2 < -1e-9) continue;
        fn(py * res + px, l0 * pd[0] + l1 * pd[1] + l2 * pd[2]);
      }
    }
    return Math.max(pd[0], pd[1], pd[2]) - Math.min(pd[0], pd[1], pd[2]);
  }

  // PASADA 1 — profundidad del frente. Solo las caras que MIRAN al observador: las de
  // atrás no ocluyen a las de adelante en un sólido cerrado.
  for (let t = 0; t < nTri; t++) if (mira(t)) recorrer(t, (idx, d) => { if (d < depth[idx]) depth[idx] = d; });

  // PASADA 2 — fracción visible por triángulo, CONTRA EL BUFFER FINAL (no contra un
  // "dueño" único). Con dueño único, dos triángulos coplanares de la misma cara empatan
  // en profundidad, el segundo pierde el píxel y la cara aparece parcialmente tapada por
  // sí misma: un cubo reportaba 7.5 mm² ocultos, y el error CRECÍA con la resolución
  // (más píxeles sobre la diagonal compartida). Comparar con tolerancia lo elimina.
  const epsGlobal = Math.max(Math.abs(u1 - u0), Math.abs(v1 - v0)) * 1e-5 + 1e-9;
  const frac = new Float32Array(nTri);
  for (let t = 0; t < nTri; t++) {
    if (!mira(t)) continue;
    // tolerancia PROPIA del triángulo: el salto de profundidad que da en un píxel.
    // Cara plana de frente → 0 (solo epsGlobal, empates exactos). Cara curva o
    // inclinada → el escalón de un píxel, que es su vecino inmediato, no un oclusor.
    const rango = recorrer(t, () => { });
    const extentPx = Math.max(1, Math.max(
      Math.max(pu[0], pu[1], pu[2]) - Math.min(pu[0], pu[1], pu[2]),
      Math.max(pv[0], pv[1], pv[2]) - Math.min(pv[0], pv[1], pv[2])));
    const tolT = 2 * rango / extentPx + epsGlobal;
    let c = 0, g = 0;
    recorrer(t, (idx, d) => { c++; if (d <= depth[idx] + tolT) g++; });
    if (c > 0) { frac[t] = g / c; continue; }
    // triángulo más chico que un píxel: no cubrió ningún centro. Se resuelve por
    // profundidad del centroide contra el buffer (0 ó 1, sin fracción posible).
    const cu = (cen[t * 3] * u[0] + cen[t * 3 + 1] * u[1] + cen[t * 3 + 2] * u[2] - su0) * sU;
    const cv = (cen[t * 3] * v[0] + cen[t * 3 + 1] * v[1] + cen[t * 3 + 2] * v[2] - sv0) * sV;
    const px = Math.min(res - 1, Math.max(0, Math.round(cu - 0.5)));
    const py = Math.min(res - 1, Math.max(0, Math.round(cv - 0.5)));
    const cd = cen[t * 3] * w[0] + cen[t * 3 + 1] * w[1] + cen[t * 3 + 2] * w[2];
    const df = depth[py * res + px];
    frac[t] = !Number.isFinite(df) || cd <= df + tolPunto ? 1 : 0;
  }
  return { frac, depth, w, u, v, su0, sv0, sU, sV, tol: tolPunto };
}

/**
 * Clasifica cada triángulo de la malla como visible u oculto para el usuario final.
 * `res` es el lado del z-buffer; 512 basta para piezas de banco (celda ≈ L/512).
 */
export function clasificarVisibilidad(
  mesh: MallaVis,
  o?: { vistas?: VistaUso[]; res?: number },
): Visibilidad {
  const P = mesh.positions, I = mesh.indices;
  const nTri = Math.floor(I.length / 3);
  const res = o?.res ?? 512;
  const vistas = o?.vistas && o.vistas.length ? o.vistas : vistasTaza();
  const vistasDeclaradas = !!(o?.vistas && o.vistas.length);

  const cen = new Float32Array(nTri * 3);
  const nor = new Float32Array(nTri * 3);
  const areaTri = new Float32Array(nTri);
  let areaTotal = 0;
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ax = P[a], ay = P[a + 1], az = P[a + 2];
    const bx = P[b], by = P[b + 1], bz = P[b + 2];
    const cx = P[c], cy = P[c + 1], cz = P[c + 2];
    cen[t * 3] = (ax + bx + cx) / 3; cen[t * 3 + 1] = (ay + by + cy) / 3; cen[t * 3 + 2] = (az + bz + cz) / 3;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz);
    areaTri[t] = L / 2; areaTotal += L / 2;
    if (L > 1e-14) { nor[t * 3] = nx / L; nor[t * 3 + 1] = ny / L; nor[t * 3 + 2] = nz / L; }
  }

  const pesoTot = vistas.reduce((s, v) => s + (v.peso ?? 1), 0) || 1;
  const visTri = new Float32Array(nTri);
  const fracMaxTri = new Float32Array(nTri);
  const frontAlguna = new Uint8Array(nTri);
  const rasters: VistaRaster[] = [];
  for (const vw of vistas) {
    const r = rasterizarVista(P, I, nTri, cen, nor, vw.dir, res);
    rasters.push(r);
    const pw = (vw.peso ?? 1) / pesoTot;
    for (let t = 0; t < nTri; t++) {
      if (nor[t * 3] * r.w[0] + nor[t * 3 + 1] * r.w[1] + nor[t * 3 + 2] * r.w[2] < 0) frontAlguna[t] = 1;
      visTri[t] += pw * r.frac[t];
      if (r.frac[t] > fracMaxTri[t]) fracMaxTri[t] = r.frac[t];
    }
  }

  // CONTABILIDAD POR ÁREA (no por conteo de triángulos): una cara medio tapada aporta
  // su mitad a cada lado. Con booleano se perdía toda el área escondida bajo un saliente.
  let areaVisible = 0, areaOculta = 0;
  for (let t = 0; t < nTri; t++) {
    areaVisible += areaTri[t] * fracMaxTri[t];
    if (frontAlguna[t]) areaOculta += areaTri[t] * (1 - fracMaxTri[t]);
  }

  // ÍNDICE de triángulos por celda, para saber SOBRE QUÉ CARA cae una marca. Hace
  // falta la NORMAL: el z-buffer solo dice "qué tan lejos está el frente", y con eso
  // solo, una cara que mira hacia ABAJO puede colarse como visible desde arriba si el
  // frente de ese píxel queda a menos de la tolerancia (medido en la carcasa RPi4: el
  // bebedero de la cara de asiento a 0.416 de un frente con tolerancia 0.577 → VIOLA
  // falso). Con la normal el descarte es EXACTO y no depende de ninguna tolerancia.
  let bx0 = Infinity, by0 = Infinity, bz0 = Infinity, bx1 = -Infinity, by1 = -Infinity, bz1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < bx0) bx0 = P[i]; if (P[i] > bx1) bx1 = P[i];
    if (P[i + 1] < by0) by0 = P[i + 1]; if (P[i + 1] > by1) by1 = P[i + 1];
    if (P[i + 2] < bz0) bz0 = P[i + 2]; if (P[i + 2] > bz1) bz1 = P[i + 2];
  }
  const NG = 24;
  const cg = [Math.max((bx1 - bx0) / NG, 1e-6), Math.max((by1 - by0) / NG, 1e-6), Math.max((bz1 - bz0) / NG, 1e-6)];
  const cel = new Map<number, number[]>();
  const cl = (n: number) => Math.min(NG - 1, Math.max(0, n));
  for (let t = 0; t < nTri; t++) {
    const i = cl(Math.floor((cen[t * 3] - bx0) / cg[0]));
    const j = cl(Math.floor((cen[t * 3 + 1] - by0) / cg[1]));
    const k = cl(Math.floor((cen[t * 3 + 2] - bz0) / cg[2]));
    const kk = (i * NG + j) * NG + k;
    const a = cel.get(kk); if (a) a.push(t); else cel.set(kk, [t]);
  }
  /** distancia² exacta punto→triángulo (no al centroide: en una pared de 1.5 mm el
   *  centroide de la cara de enfrente puede quedar más cerca que la cara correcta). */
  function d2Tri(p: [number, number, number], t: number) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ax = P[a], ay = P[a + 1], az = P[a + 2];
    const abx = P[b] - ax, aby = P[b + 1] - ay, abz = P[b + 2] - az;
    const acx = P[c] - ax, acy = P[c + 1] - ay, acz = P[c + 2] - az;
    const apx = p[0] - ax, apy = p[1] - ay, apz = p[2] - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) return apx * apx + apy * apy + apz * apz;
    const bpx = p[0] - P[b], bpy = p[1] - P[b + 1], bpz = p[2] - P[b + 2];
    const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) return bpx * bpx + bpy * bpy + bpz * bpz;
    const cpx = p[0] - P[c], cpy = p[1] - P[c + 1], cpz = p[2] - P[c + 2];
    const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) return cpx * cpx + cpy * cpy + cpz * cpz;
    const vc = d1 * d4 - d3 * d2;
    let u = 0, v2 = 0;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { u = d1 / (d1 - d3); v2 = 0; }
    else {
      const vb = d5 * d2 - d1 * d6;
      if (vb <= 0 && d2 >= 0 && d6 <= 0) { u = 0; v2 = d2 / (d2 - d6); }
      else {
        const va = d3 * d6 - d5 * d4;
        if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
          const w2 = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 1 - w2; v2 = w2;
        } else { const den = 1 / (va + vb + vc); u = vb * den; v2 = vc * den; }
      }
    }
    const qx = ax + abx * u + acx * v2, qy = ay + aby * u + acy * v2, qz = az + abz * u + acz * v2;
    return (p[0] - qx) ** 2 + (p[1] - qy) ** 2 + (p[2] - qz) ** 2;
  }
  /** el triángulo sobre el que cae la marca (−1 si la malla está vacía) */
  function caraDe(p: [number, number, number]) {
    const ci = cl(Math.floor((p[0] - bx0) / cg[0]));
    const cj = cl(Math.floor((p[1] - by0) / cg[1]));
    const ck = cl(Math.floor((p[2] - bz0) / cg[2]));
    let best = -1, bd = Infinity;
    for (let r = 0; r <= NG; r++) {
      let hubo = false;
      for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) for (let k = ck - r; k <= ck + r; k++) {
        if (i < 0 || j < 0 || k < 0 || i >= NG || j >= NG || k >= NG) continue;
        if (r > 0 && Math.abs(i - ci) < r && Math.abs(j - cj) < r && Math.abs(k - ck) < r) continue;
        const arr = cel.get((i * NG + j) * NG + k); if (!arr) continue;
        hubo = true;
        for (const t of arr) { const d = d2Tri(p, t); if (d < bd) { bd = d; best = t; } }
      }
      // un anillo extra tras el primer acierto: el vecino diagonal puede estar más cerca
      if (best >= 0 && hubo) { if (r > 0) break; }
    }
    return best;
  }

  /**
   * EL PREDICADO DEL LIBRO sobre un punto concreto de la superficie (donde cae la
   * compuerta, la línea de partición, la marca del expulsor).
   *
   * Se resuelve proyectando el punto en el z-buffer de cada vista y comparando su
   * profundidad contra la del frente. NO se busca "el triángulo más cercano": eso
   * falla en cuanto dos superficies están a menos de una pared de distancia (en una
   * base de 2 mm, un punto de la cara de abajo queda casi tan cerca de la de arriba).
   * Contra el buffer la respuesta es la del render, que es justo lo que pide el libro.
   */
  function puntoVisible(p: [number, number, number]) {
    let vis = 0; const desde: string[] = [];
    const detalle: Array<{ vista: string; d: number; df: number; tol: number }> = [];
    const tri = caraDe(p);
    const n: [number, number, number] = tri >= 0
      ? [nor[tri * 3], nor[tri * 3 + 1], nor[tri * 3 + 2]] : [0, 0, 0];
    for (let k = 0; k < rasters.length; k++) {
      const r = rasters[k];
      // (a) la cara tiene que MIRAR al observador. Exacto, sin tolerancia.
      if (tri >= 0 && n[0] * r.w[0] + n[1] * r.w[1] + n[2] * r.w[2] >= 0) continue;
      const pu = (p[0] * r.u[0] + p[1] * r.u[1] + p[2] * r.u[2] - r.su0) * r.sU;
      const pv = (p[0] * r.v[0] + p[1] * r.v[1] + p[2] * r.v[2] - r.sv0) * r.sV;
      const px = Math.round(pu - 0.5), py = Math.round(pv - 0.5);
      if (px < 0 || py < 0 || px >= res || py >= res) continue;
      const d = p[0] * r.w[0] + p[1] * r.w[1] + p[2] * r.w[2];
      const df = r.depth[py * res + px];
      if (!Number.isFinite(df)) continue;              // ningún frente en ese píxel
      // el punto tiene que SER el frente, no solo "no tener nada más cerca". Con la
      // prueba floja (d <= df + tol) una cara que mira hacia ABAJO se contaba como
      // visible desde arriba: el rayo pasaba por una ranura y el buffer guardaba una
      // pared del fondo, más lejos, así que el punto quedaba "delante". Medido en la
      // carcasa RPi4: el bebedero de la cara de asiento salía VIOLA. Las caras que no
      // miran al observador no se rasterizan, así que su |d − df| es grande y ahora caen.
      // (b) y además nada de la propia pieza se le puede interponer
      detalle.push({ vista: vistas[k].nombre, d, df, tol: r.tol });
      if (Math.abs(d - df) <= r.tol) { vis += (vistas[k].peso ?? 1) / pesoTot; desde.push(vistas[k].nombre); }
    }
    return { visible: vis > 0, vis, vistas: desde, detalle, tri };
  }

  return {
    vistas, vistasDeclaradas, visTri, fracMaxTri, areaTri,
    areaTotalMm2: areaTotal,
    areaVisibleMm2: areaVisible,
    areaOcultaPorSiMismaMm2: areaOculta,
    res, puntoVisible,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EL JUEZ DE MARCAS — §4.1.2 · §4.1.4 · §7.1.3 · §11.2.5 · §2.3.2 · §11.3.4
// Todas las marcas del proceso se juzgan con EL MISMO predicado; lo único que
// cambia es qué significa caer en visible para cada una.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoMarca =
  | 'particion' | 'compuerta' | 'expulsor' | 'stripper'
  | 'sink-costilla' | 'sink-pad' | 'shutoff';

export interface MarcaProceso {
  tipo: TipoMarca;
  nombre: string;
  /** puntos de la marca sobre la superficie (una línea = su polilínea muestreada) */
  puntos: Array<[number, number, number]>;
}

export interface VeredictoMarca {
  tipo: TipoMarca;
  nombre: string;
  cita: string;
  nTotal: number;
  nVisibles: number;
  fracVisible: number;
  /** para líneas: cuántos mm de la marca caen sobre superficie visible */
  longVisibleMm: number;
  longTotalMm: number;
  estado: 'CUMPLE' | 'ADVIERTE' | 'VIOLA';
  porque: string;
}

const CITA: Record<TipoMarca, string> = {
  particion: '§4.1.2 · Fig 4.6',
  compuerta: '§7.1.3 · Fig 7.1 (TOP-10)',
  expulsor: '§11.2.5 · Fig 11.10',
  stripper: '§11.3.4 · Fig 11.21',
  'sink-costilla': '§2.3.2 · Fig 2.3',
  'sink-pad': '§11.2.5 · Fig 11.12',
  shutoff: '§4.1.4 · Fig 4.11-4.12',
};

/**
 * Juzga cada marca contra el predicado de visibilidad.
 *
 * OJO con §4.1.4 (shut-off): el libro dice EXPRESAMENTE que cualquier posición sirve
 * *"since the entire shelf is hidden from view"*. Por eso el shut-off es el único que
 * CUMPLE por estar oculto: su criterio es el inverso de los demás.
 *
 * Y §11.3.4 (stripper) nunca puede dar CUMPLE: el libro enseña que el defecto es
 * intrínseco a la geometría — *"the mold designer may wish to avoid the use of it"*.
 * Su veredicto correcto es ADVIERTE (rediseña la pieza), no "mueve el componente".
 */
export function juzgarMarcas(vis: Visibilidad, marcas: MarcaProceso[]): VeredictoMarca[] {
  return marcas.map((m) => {
    const flags = m.puntos.map((p) => vis.puntoVisible(p).visible);
    const nVis = flags.filter(Boolean).length;
    const frac = m.puntos.length ? nVis / m.puntos.length : 0;
    // longitud: cada tramo entre puntos consecutivos cuenta como visible si alguno
    // de sus extremos lo es (criterio conservador: la marca se ve si asoma)
    let longTot = 0, longVis = 0;
    for (let i = 1; i < m.puntos.length; i++) {
      const a = m.puntos[i - 1], b = m.puntos[i];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      longTot += d;
      if (flags[i - 1] || flags[i]) longVis += d;
    }
    let estado: VeredictoMarca['estado'];
    let porque: string;
    if (m.tipo === 'shutoff') {
      estado = nVis === 0 ? 'CUMPLE' : 'VIOLA';
      porque = nVis === 0
        ? 'el estante está oculto: §4.1.4 dice que cualquier ubicación sirve ahí'
        : `${nVis}/${m.puntos.length} puntos del shut-off asoman a la vista`;
    } else if (m.tipo === 'stripper') {
      estado = 'ADVIERTE';
      porque = nVis === 0
        ? 'contacto oculto, pero §11.3.4 avisa que el filo desgasta el núcleo: revisar área plana de empuje'
        : 'el contacto deja línea testigo visible; §11.3.4: ninguna posición es buena, se rediseña la sección';
    } else if (nVis === 0) {
      estado = 'CUMPLE';
      porque = 'la marca cae íntegra en superficie no visible';
    } else {
      estado = 'VIOLA';
      porque = longTot > 0
        ? `${longVis.toFixed(1)} de ${longTot.toFixed(1)} mm de la marca quedan a la vista`
        : `la marca cae en superficie visible (${nVis}/${m.puntos.length} puntos)`;
    }
    return {
      tipo: m.tipo, nombre: m.nombre, cita: CITA[m.tipo],
      nTotal: m.puntos.length, nVisibles: nVis, fracVisible: frac,
      longVisibleMm: longVis, longTotalMm: longTot, estado, porque,
    };
  });
}

/** Base de DIBUJO: misma dirección de vista, pero con el +Z de la pieza hacia arriba
 *  en la lámina. Si la vista mira por el eje Z (planta), el "arriba" es +Y. */
function baseConArribaZ(d: [number, number, number]) {
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  const w: [number, number, number] = [d[0] / L, d[1] / L, d[2] / L];
  // arriba de pantalla = +Z proyectado al plano perpendicular a w
  const up: [number, number, number] = Math.abs(w[2]) > 0.999 ? [0, 1, 0] : [0, 0, 1];
  const dot = up[0] * w[0] + up[1] * w[1] + up[2] * w[2];
  let vx = up[0] - dot * w[0], vy = up[1] - dot * w[1], vz = up[2] - dot * w[2];
  const lv = Math.hypot(vx, vy, vz) || 1; vx /= lv; vy /= lv; vz /= lv;
  // u = v × w  (derecha de pantalla)
  const ux = vy * w[2] - vz * w[1], uy = vz * w[0] - vx * w[2], uz = vx * w[1] - vy * w[0];
  return { w, u: [ux, uy, uz] as [number, number, number], v: [vx, vy, vz] as [number, number, number] };
}

/**
 * Proyecta la malla a 2D para dibujarla en la lámina L21, desde una de las vistas
 * de uso. Devuelve polígonos con su visibilidad y su profundidad (para el algoritmo
 * del pintor) y los puntos de las marcas ya proyectados al mismo encuadre.
 */
export function proyectarParaLamina(
  mesh: MallaVis, vis: Visibilidad,
  o: { vista?: number; ancho: number; alto: number; marcas?: MarcaProceso[]; veredictos?: VeredictoMarca[] },
) {
  const P = mesh.positions, I = mesh.indices;
  const nTri = Math.floor(I.length / 3);
  const iv = Math.min(vis.vistas.length - 1, Math.max(0, o.vista ?? 0));
  // ARRIBA DE LA LÁMINA = +Z de la pieza. La base ortonormal del z-buffer escoge un
  // "arriba" arbitrario (le da igual, solo mide profundidad), pero al DIBUJAR eso sale
  // como la taza acostada: nadie mira así su pieza y la lámina deja de ser legible.
  const { w, u, v } = baseConArribaZ(vis.vistas[iv].dir);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    const su = P[i] * u[0] + P[i + 1] * u[1] + P[i + 2] * u[2];
    const sv = P[i] * v[0] + P[i + 1] * v[1] + P[i + 2] * v[2];
    if (su < u0) u0 = su; if (su > u1) u1 = su;
    if (sv < v0) v0 = sv; if (sv > v1) v1 = sv;
  }
  const k = Math.min(o.ancho / ((u1 - u0) || 1), o.alto / ((v1 - v0) || 1)) * 0.92;
  const cx = o.ancho / 2 - ((u0 + u1) / 2) * k;
  const cy = o.alto / 2 + ((v0 + v1) / 2) * k;
  const px = (p: [number, number, number]) => [
    cx + (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]) * k,
    cy - (p[0] * v[0] + p[1] * v[1] + p[2] * v[2]) * k,
  ] as [number, number];

  const caras: Array<{ pts: number[]; vis: number; z: number }> = [];
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const A: [number, number, number] = [P[a], P[a + 1], P[a + 2]];
    const B: [number, number, number] = [P[b], P[b + 1], P[b + 2]];
    const C: [number, number, number] = [P[c], P[c + 1], P[c + 2]];
    // solo las caras que miran a ESTA vista: dibujar las de atrás sería pintar el
    // interior encima del exterior
    const nx = (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]);
    const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);
    const nz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (nx * w[0] + ny * w[1] + nz * w[2] >= 0) continue;
    const pa = px(A), pb = px(B), pc = px(C);
    const z = ((A[0] + B[0] + C[0]) * w[0] + (A[1] + B[1] + C[1]) * w[1] + (A[2] + B[2] + C[2]) * w[2]) / 3;
    caras.push({ pts: [pa[0], pa[1], pb[0], pb[1], pc[0], pc[1]], vis: vis.fracMaxTri[t], z });
  }

  // las marcas van AGRUPADAS: una línea de partición es UNA polilínea, no 48 círculos
  // sueltos. Y con la visibilidad punto a punto, para poder dibujar en rojo solo el
  // tramo que asoma (que es justo lo que el libro mide en Fig 4.6).
  const marcas = (o.marcas ?? []).map((m, i) => ({
    nombre: m.nombre, tipo: m.tipo as string,
    estado: (o.veredictos?.[i]?.estado ?? 'ADVIERTE') as 'CUMPLE' | 'ADVIERTE' | 'VIOLA',
    puntos: m.puntos.map((p) => {
      const q = px(p);
      return { x: q[0], y: q[1], visible: vis.puntoVisible(p).visible };
    }),
  }));

  return { caras, marcas, ancho: o.ancho, alto: o.alto, vistaNombre: vis.vistas[iv].nombre };
}
