/**
 * TÉRMICO TRANSITORIO REAL del molde — FDM 3D explícito de la ecuación de calor
 * ∂T/∂t = α∇²T sobre las placas A+B (acero P20), con:
 *   · INYECCIÓN por ciclo: la capa de plástico en la cavidad arranca a T_melt y
 *     conduce su calor al acero (propiedades reales del ABS §9.2.2)
 *   · LÍNEAS DE AGUA reales (coolingCircuit): frontera de Robin q = h·(T − T_c)
 *     con h = 1000 W/m²·°C (Eq 9.7) sobre las celdas que tocan cada barreno
 *   · exterior: adiabático (conservador)
 * Es la MISMA física que las Figs 9.7/9.11 del libro (ahí resuelta por FEM);
 * aquí por diferencias finitas explícitas — PDE real, no una correlación.
 *
 * Propiedades: P20 k=32 W/m·°C (§9.2.5), ρ=7800, cp=460 → α=8.9e-6 m²/s.
 * Estabilidad explícita: dt ≤ dx²/(6α).
 */
import type { MoldAssemblySpec } from './mold-assembly';
import { coolingCircuit, cavityFootprint, cavityGrid, plateDepth } from './mold-drawing-set';
import { plateStackZ } from './mold-plano-set';
import { ABS_KAZMER } from './cooling';
import { crearDifusionEspectral } from '../campo/campo';
import { solveSteadyMoldField, type SteadyField } from './thermal-steady';
import { heatToExtractW } from './thermal-resistance';
import { estPartVolumeCc, FEED_MATERIALS } from './feed';
import { effusivity, contactTemperature } from './thermal-layers';
import type { CalcPaso } from './cooling-design';

// Apéndice B (LITERAL): P20 k=32, ρ=7820, cp=500 → α=8.18e-6 ✓ impreso
const K_STEEL = 32, RHO_STEEL = 7820, CP_STEEL = 500;
const ALPHA = K_STEEL / (RHO_STEEL * CP_STEEL);          // 8.18e-6 m²/s (libro)
const H_COOL = 1000;                                      // W/m²·°C (Eq 9.7)
// plástico ABS FUNDIDO (Apéndice A LITERAL): k=0.19, ρ_melt=930, cp=2340
// → α=8.73e-8 ✓ impreso (antes: 0.25/1050/2345 — ni literales ni usados bien)
const K_ABS = 0.19, RHO_ABS = 930, CP_ABS = 2340;

export interface ThermalSim {
  nx: number; ny: number; nz: number;
  x0: number; y0: number; z0: number; dx: number;         // mm (grid uniforme)
  T: Float32Array;                                        // °C por celda
  steel: Uint8Array;                                      // 1=acero, 2=plástico(cavidad), 0=fuera
  cool: Float32Array;                                     // factor de Robin por celda (0 = sin línea)
  timeS: number;                                          // tiempo simulado
  cycleS: number;                                         // duración del ciclo (inyección cada cycleS)
  dtMax: number;                                          // paso estable (s)
  coolantC: number; meltC: number;
  /** DE QUÉ RESINA son los datos del campo. `esProxy` = la pieza es de otra resina y
   *  corremos con ABS prestado: la pantalla DEBE decirlo. Un campo térmico que no
   *  declara su material miente con cara de dato. */
  material: { resina: string; esProxy: boolean; datosDe: string; nota: string };
  minC: number; maxC: number;                             // del último step (para colorear)
  /** avanza la PDE `seconds` de tiempo simulado (sub-pasos estables adentro). */
  step(seconds: number): void;
  /** temperatura interpolada en coords de placa (mm). */
  sampleAt(x: number, y: number, z: number): number;
  /** rebana el campo en z=zq → malla nx×ny para pintar el plano de partición. */
  slice(zq: number): { nx: number; ny: number; x0: number; y0: number; x1: number; y1: number; T: Float32Array; minC: number; maxC: number; dTC: number };
  /** rebanada en CUALQUIER eje (el molde es 3D): frac∈[0..1] a lo largo del eje →
   *  campo 2D u×v + la cota mm del plano. u/v = los otros dos ejes en orden x,y,z. */
  sliceAxis(axis: 'x' | 'y' | 'z', frac: number): { nu: number; nv: number; u1: number; v1: number; posMm: number; T: Float32Array; minC: number; maxC: number };
  /** espesor local de plástico por columna (mm) — el mapa que manda en el ciclo. */
  thGrid: { nx: number; ny: number; cellMm: number; thMm: Float32Array };
  /** T MÁXIMA de línea central del plástico entre columnas (°C) — la sonda de
   *  expulsión: cae a T_eject en ~t_c del libro si la física está bien. */
  plasticCenterMaxC(): number;
  /** el estudio NARRADO (fórmula + sustitución + resultado) — la pantalla de
   *  fórmulas del 🌡: qué se resolvió, con qué números, y qué salió. */
  pasos(): CalcPaso[];
  /** T del PLÁSTICO en una columna (x,y en mm de placa) — el material más
   *  caliente del molde vive en las micro-pilas, NO en el grid de acero: sin
   *  esta sonda la pieza se pintaba con la T del ACERO que la rodea. */
  plasticTempAt(x: number, y: number): number;
  /** lleva el molde a RÉGIMEN cíclico (Kazmer §9.1: el molde de producción NO
   *  opera frío). Sin esto el campo arranca plano y "no se ve nada". */
  warmUp(cycles?: number): void;
  /** CAMPO CÍCLICO-PROMEDIO con k VARIABLE (la FORMA de la pieza deforma el
   *  campo). Al calcularlo, TODA la visualización (sampleAt/slice/isosuperficies)
   *  pasa a leerlo: es el entregable estándar de la industria. */
  computeSteady(): SteadyField | null;
  steady: SteadyField | null;
  /** el array que la ESCENA debe pintar: el steady si existe, si no el transitorio */
  readonly Tview: Float32Array;
  /** VOXELES DE PLÁSTICO (1=plástico) — la FORMA de la pieza dentro del grid.
   *  Sin esto el campo no puede tener la forma del vaso. */
  plasticVoxels(): Uint8Array;
  /** ESTUDIO POR PLACA (§9.2-9.3): la CARA MOLDEANTE de cavidad y de núcleo
   *  medidas POR SEPARADO — el mapa difuso global no es un estudio térmico. */
  surfaceStudy(): {
    cav: { minC: number; maxC: number; meanC: number; dTC: number; n: number };
    core: { minC: number; maxC: number; meanC: number; dTC: number; n: number };
    /** penetración térmica por ciclo δ=√(α·t_ciclo) [mm]: qué espesor de acero
     *  SIENTE el ciclo (capa oscilante) y a partir de dónde el bulk es estable. */
    deltaMm: number;
    /** flujo de calor que cada lado entrega al acero en el ciclo [W/m²] */
    fluxCavWm2: number; fluxCoreWm2: number;
    /** ΔT a través del acero: cara moldeante → celda de línea de agua */
    dTSteelCavC: number; dTSteelCoreC: number;
  };
}

export function createThermalSim(spec: MoldAssemblySpec, o?: { cell?: number; coolantC?: number; partMesh?: { positions: Float32Array; indices: Uint32Array } }): ThermalSim {
  const D = plateDepth(spec);
  const z = plateStackZ(spec);
  const zPart = z.A;
  const { fx, fy, round } = cavityFootprint(spec);   // `round` se PEDÍA y se TIRABA
  const cc = coolingCircuit(spec, D);
  // ── EL MATERIAL: de dónde salen T_melt/T_coolant/α ───────────────────────
  // El ÚNICO material con datos del libro es el ABS de Kazmer (α=8.69e-8, 239/60/97.6 °C
  // — el ejemplo resuelto de §9.1). Esto se aplicaba a CUALQUIER pieza en silencio:
  // un tupper de PP se simulaba con la física del ABS y el resultado se pintaba como si
  // fuera suyo. "no se calcula el enfriamiento real porque no se están usando los datos
  // reales" (user 2026-07-15) — exacto.
  // NO se inventan los datos del PP (α y T_eject de una resina son medidos, no deducibles:
  // inventarlos sería peor que no tenerlos, porque el color mentiría con cara de verdad).
  // Lo que SÍ se hace es DECLARARLO: `material.esProxy` marca cuándo el campo corre con
  // una resina prestada, para que la pantalla lo diga en vez de fingir.
  const resina = (spec as { plastic?: string }).plastic ?? 'ABS';
  const esProxy = resina.toUpperCase() !== 'ABS';
  const material = {
    resina, esProxy, datosDe: 'ABS (Kazmer §9.1)',
    nota: esProxy
      ? `⚠ campo térmico corrido con datos de ABS: no tenemos α/T_eject medidos de ${resina}. Las FORMAS (dónde se acumula el calor) valen; los SEGUNDOS no son de ${resina}.`
      : 'datos de ABS del libro (§9.1) — la resina de la pieza',
    // motor: operador espectral (cara Neumann) — paso exacto, sin sub-pasos
  };
  const Tc = o?.coolantC ?? ABS_KAZMER.tCoolant;          // 60 °C (ABS, libro)
  const Tm = ABS_KAZMER.tMelt;                            // 239 °C
  // dominio: TODO el molde (feedback user: "ver el calentamiento de todas las placas")
  const zLo = 0, zHi = z.clamp + spec.plates.topClamp;
  const cell = o?.cell ?? Math.max(5, Math.round(spec.widthMm / 56));   // mm
  const nx = Math.max(8, Math.round(spec.widthMm / cell));
  const ny = Math.max(8, Math.round(D / cell));
  const nz = Math.max(8, Math.round((zHi - zLo) / cell));
  const dx = cell / 1000;                                 // m
  const N = nx * ny * nz;
  const T = new Float32Array(N).fill(Tc);
  const steel = new Uint8Array(N).fill(1);
  const cool = new Float32Array(N);
  const idx = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const cx = spec.widthMm / 2, cy = D / 2;
  // ── EL CALOR ENTRA CON LA FORMA 3D DE LA PIEZA (feedback user: "el molde no es
  // 2D") ──: si hay malla real, se rasteriza por CELDA del FDM: espesor local de
  // plástico th(i,j) y superficies zTop/zBot por columna (envolventes, replicadas
  // por cavidad). El depósito de cada ciclo va a las celdas de acero PEGADAS a la
  // superficie de CAVIDAD (arriba) y de NÚCLEO (abajo), proporcional a th(i,j)/2
  // por lado → la zona GRUESA mete más calor, el hot spot emerge en 3D.
  // Sin malla: capa plana en la huella (comportamiento clásico del bezel).
  const kPart = Math.max(0, Math.min(nz - 1, Math.round((zPart - zLo) / cell)));
  const thMm = new Float32Array(nx * ny);                 // espesor local de plástico por columna
  const kTop = new Int16Array(nx * ny).fill(-1);          // celda de superficie de cavidad
  const kBot = new Int16Array(nx * ny).fill(-1);          // celda de superficie de núcleo
  if (o?.partMesh && o.partMesh.positions.length) {
    const P = o.partMesh.positions, I = o.partMesh.indices;
    let mnx = 1e18, mny = 1e18, mnz2 = 1e18, mxx = -1e18, mxy = -1e18;
    for (let i = 0; i < P.length; i += 3) {
      if (P[i] < mnx) mnx = P[i]; if (P[i] > mxx) mxx = P[i];
      if (P[i + 1] < mny) mny = P[i + 1]; if (P[i + 1] > mxy) mxy = P[i + 1];
      if (P[i + 2] < mnz2) mnz2 = P[i + 2];
    }
    const pw = mxx - mnx, ph = mxy - mny;
    // raster fino local (0.8 mm) → se agrega al grid grueso del FDM por promedio
    const G = Math.max(32, Math.min(140, Math.round(pw / 0.8)));
    const GY = Math.max(16, Math.round(G * ph / pw));
    const dxg = pw / G, dyg = ph / GY;
    const hits: number[][] = Array.from({ length: G * GY }, () => []);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ax = P[a] - mnx, ay = P[a + 1] - mny, az = P[a + 2] - mnz2;
      const bx2 = P[b] - mnx, by = P[b + 1] - mny, bz = P[b + 2] - mnz2;
      const cx2 = P[c] - mnx, cy2 = P[c + 1] - mny, cz = P[c + 2] - mnz2;
      const ux = bx2 - ax, uy = by - ay, uz = bz - az, vx = cx2 - ax, vy = cy2 - ay, vz = cz - az;
      const nzc = ux * vy - uy * vx;
      const a2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, nzc);
      if (a2 < 1e-12 || Math.abs(nzc / a2) < 1e-3) continue;
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx2, cx2) / dxg)), i1 = Math.min(G - 1, Math.ceil(Math.max(ax, bx2, cx2) / dxg));
      const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy2) / dyg)), j1 = Math.min(GY - 1, Math.ceil(Math.max(ay, by, cy2) / dyg));
      const den = (by - cy2) * (ax - cx2) + (cx2 - bx2) * (ay - cy2);
      if (Math.abs(den) < 1e-12) continue;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const qx = (i + 0.5031) * dxg, qy = (j + 0.5047) * dyg;
        const w0 = ((by - cy2) * (qx - cx2) + (cx2 - bx2) * (qy - cy2)) / den;
        const w1 = ((cy2 - ay) * (qx - cx2) + (ax - cx2) * (qy - cy2)) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        hits[j * G + i].push(az * w0 + bz * w1 + cz * w2);
      }
    }
    // por columna fina: intervalos sólidos → espesor + envolventes; se vuelca a las
    // celdas GRUESAS del FDM de cada CAVIDAD del grid
    const cells = cavityGrid(spec, D);
    for (let n = 0; n < G * GY; n++) {
      const h = hits[n];
      if (h.length < 2) continue;
      h.sort((x, y) => x - y);
      const zs: number[] = [h[0]];
      for (let k = 1; k < h.length; k++) if (h[k] - zs[zs.length - 1] > 0.05) zs.push(h[k]);
      if (zs.length % 2 === 1) zs.pop();
      if (zs.length < 2) continue;
      let tk = 0;
      for (let k = 0; k + 1 < zs.length; k += 2) tk += zs[k + 1] - zs[k];
      const gi = n % G, gj = (n / G) | 0;
      const lx = (gi + 0.5) * dxg - pw / 2, ly = (gj + 0.5) * dyg - ph / 2;   // local, centrado
      for (const c of cells) {
        const ii = Math.max(0, Math.min(nx - 1, Math.floor((c.cx + lx) / cell)));
        const jj = Math.max(0, Math.min(ny - 1, Math.floor((c.cy + ly) / cell)));
        const m = jj * nx + ii;
        if (tk > thMm[m]) {
          thMm[m] = tk;
          kTop[m] = Math.max(0, Math.min(nz - 1, Math.round((zPart + zs[zs.length - 1] - zLo) / cell)));
          kBot[m] = Math.max(0, Math.min(nz - 1, Math.round((zPart + zs[0] - zLo) / cell)));
        }
      }
    }
  } else {
    // sin malla: capa plana clásica (huella de la pieza, pared del spec)
    // LA HUELLA ES LA DE LA PIEZA, redonda o no. Estaba SIEMPRE el test de rectángulo
    // (|px-cx| < fx/2 && |py-cy| < fy/2) aunque `cavityFootprint` ya devuelve `round`:
    // se pedía el dato y se tiraba. Un vaso ⌀140 depositaba calor en un CUADRADO de
    // 140×140 → 27% más área caliente (4/π) y las esquinas, que no existen, enfriando.
    // "no me muestra la figura de un círculo, no está simulando el molde que hiciste"
    // (user 2026-07-15).
    // LA REJILLA, no el centro: `cx,cy` era el CENTRO DEL MOLDE — con 4 cavidades
    // el calor se depositaba en un solo blob central donde NO hay impresión (y las
    // 4 cavidades reales quedaban frías). Ahora cada celda de cavityGrid mete SU
    // huella (el hot spot sale donde de verdad está el plástico).
    const cellsFlat = cavityGrid(spec, D);
    const dentro = (px: number, py: number) => cellsFlat.some((c) => (round
      ? Math.hypot(px - c.cx, py - c.cy) < fx / 2
      : Math.abs(px - c.cx) < fx / 2 && Math.abs(py - c.cy) < fy / 2));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const px = (i + 0.5) * cell, py = (j + 0.5) * cell;
      if (dentro(px, py)) {
        const m = j * nx + i;
        thMm[m] = spec.cavity.wallMm ?? 2;
        kBot[m] = kPart; kTop[m] = Math.min(nz - 1, kPart + 1);   // núcleo abajo, cavidad arriba
        steel[idx(i, j, kPart)] = 2;
      }
    }
  }
  // LÍNEAS DE AGUA: celdas a ≤ r+cell/2 de cada segmento (en su plano z real)
  // A por ARRIBA de la impresión (zAboveMm, Eq 9.22 desde la superficie moldeante);
  // B a zBehindMm bajo la partición. Sin línea A posible → solo enfría B (real).
  const zLines: number[] = [zPart - cc.zBehindMm];
  if (cc.zAboveMm != null) zLines.push(zPart + cc.zAboveMm);
  for (const zLine of zLines) {
    const kL = Math.round((zLine - zLo) / cell);
    if (kL < 0 || kL >= nz) continue;
    for (const g of cc.segs) {
      // ── IDENTIDAD GEOMÉTRICA (§9): el área mojada del segmento es π·D·L, ni más
      //    ni menos. El bug anterior capturaba ~2 celdas por lado (dd ≤ r + cell/2
      //    con cell 7 mm) y a CADA UNA le daba el perímetro COMPLETO π·D·dx → el
      //    área mojada salía 2.00× la real y el molde se enfriaba al doble. Además
      //    asignaba con `=`, así que dos segmentos que se cruzan se borraban.
      //    Fix: recolectar las celdas del segmento, repartir su área REAL entre
      //    ellas, y ACUMULAR (+=) para que un cruce sume en vez de pisar.
      const capturadas: number[] = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const px = (i + 0.5) * cell, py = (j + 0.5) * cell;
        const vx = g.x1 - g.x0, vy = g.y1 - g.y0;
        const len2 = vx * vx + vy * vy || 1;
        const tt = Math.max(0, Math.min(1, ((px - g.x0) * vx + (py - g.y0) * vy) / len2));
        const dd = Math.hypot(px - (g.x0 + tt * vx), py - (g.y0 + tt * vy));
        if (dd <= cc.diaMm / 2 + cell / 2) capturadas.push(idx(i, j, kL));
      }
      if (!capturadas.length) continue;
      const lSegM = Math.hypot(g.x1 - g.x0, g.y1 - g.y0) / 1000;      // largo real (m)
      const aSeg = Math.PI * (cc.diaMm / 1000) * lSegM;               // π·D·L del segmento
      const aPorCelda = aSeg / capturadas.length;                     // repartida, no duplicada
      for (const id of capturadas) {
        cool[id] += (H_COOL * aPorCelda) / (RHO_STEEL * CP_STEEL * dx * dx * dx);
      }
    }
  }
  const dtMax = (dx * dx) / (6 * ALPHA) * 0.9;   // ya solo informativo: el espectral no lo necesita
  // ══ F2b: EL PLÁSTICO EXISTE ══ (antes: depósito INSTANTÁNEO de calor + difusión
  // todo-acero → el metal recibía en 0 s lo que el plástico entrega en ~t_c ≈ 19 s;
  // "está mal la transferencia del plástico al metal en todas las placas" — user).
  // Cada columna con pieza lleva DOS micro-pilas 1D de MEDIA pared (simetría
  // adiabática en la línea central): lado CAVIDAD → vóxel kTop, lado NÚCLEO →
  // vóxel kBot. Acople por MEDIA ARMÓNICA (validado en thermal-layers 23/23).
  const PCELLS = 6;
  const cols: number[] = [];
  for (let m = 0; m < nx * ny; m++) if (thMm[m] > 0 && (kTop[m] >= 0 || kBot[m] >= 0)) cols.push(m);
  // pilas: [col][lado(0=top,1=bot)][celda 0=línea central … PCELLS-1=pegada al acero]
  const pStack = new Float32Array(cols.length * 2 * PCELLS).fill(Tc);
  // energía entregada por lado en el ciclo en curso (J/m²) → flujo MEDIO real
  const eCycle = [0, 0];
  let eCycleT0 = 0;
  const pDx = (m: number) => Math.max(0.15e-3, (thMm[m] / 2 / PCELLS) / 1000);  // m
  const CP_VOL_P = RHO_ABS * CP_ABS;                     // J/m³°C del plástico
  /** sub-integra la pila `ci`,`side` un tiempo dtS contra el vóxel `vox` (T casi
   *  cte en el paso). Devuelve la ENERGÍA entregada al acero (J/m²). */
  const stepStack = (ci: number, side: number, m: number, dtS: number, Tvox: number): number => {
    const off = (ci * 2 + side) * PCELLS;
    const dxp = pDx(m);
    const gInt = 1 / (dxp / (2 * K_ABS) + dx / (2 * K_STEEL));   // plástico|acero ARMÓNICA
    const gPP = K_ABS / dxp;                                      // interno plástico
    const dtp = Math.min(dtS, 0.4 * (CP_VOL_P * dxp) / (2 * Math.max(gPP, gInt)));
    let e = 0, t = 0;
    while (t < dtS - 1e-12) {
      const h = Math.min(dtp, dtS - t);
      for (let c = 0; c < PCELLS; c++) {
        let q = 0;
        if (c > 0) q += gPP * (pStack[off + c - 1] - pStack[off + c]);
        if (c < PCELLS - 1) q += gPP * (pStack[off + c + 1] - pStack[off + c]);
        else { const qi = gInt * (Tvox - pStack[off + c]); q += qi; e -= qi * h; }
        pStack[off + c] += (h / (CP_VOL_P * dxp)) * q;
      }
      t += h;
    }
    return e;                                             // J/m² hacia el acero
  };
  // EL OPERADOR comparte el MISMO buffer T (mismo layout (k*ny+j)*nx+i que idx3): cero
  // copias. Cara NEUMANN = bordes aislados, exactamente el fantasma-de-copia del loop
  // explícito que este paso sustituye. Unidades: ALPHA m²/s → mm²/s (×1e6), cell en mm.
  const opEspectral = crearDifusionEspectral(
    { nx, ny, nz, cellMm: cell, x0: 0, y0: 0, z0: zLo, data: T },
    { alphaMm2s: ALPHA * 1e6, tipo: 'neumann' },
  );
  const sim: ThermalSim = {
    nx, ny, nz, x0: 0, y0: 0, z0: zLo, dx: cell, T, steel, cool,
    timeS: 0, cycleS: 30, dtMax, coolantC: Tc, meltC: Tm, minC: Tc, maxC: Tm, material,
    step(seconds: number) {
      // ══ EL OPERADOR 𝔄 EN LA FORJA ══ el integrador ya NO es Euler explícito: es el
      // paso espectral de campo.ts con la cara NEUMANN (bordes aislados — el mismo
      // fantasma-de-copia que usaba el loop de 7 puntos, así que el MODELO no cambió:
      // solo el integrador). La difusión por paso es EXACTA; el agua entra por
      // RELAJACIÓN EXACTA del ODE local de Robin: T ← Tc + (T−Tc)·e^(−cool·dt).
      // El dt ya no lo manda la estabilidad (adiós dtMax de kínder): se acota a 1 s
      // SOLO por el error de splitting difusión↔agua, que es de modelado, no numérico.
      let remaining = seconds;
      while (remaining > 1e-9) {
        const dt = Math.min(1.0, remaining);
        remaining -= dt;
        // INYECCIÓN al inicio de cada ciclo: las pilas de plástico NACEN a T_melt
        // (disparo nuevo) — y de ahí el calor entra al acero A SU RITMO FÍSICO
        // (conducción por capas, no depósito instantáneo).
        const tIn = sim.timeS % sim.cycleS;
        if (tIn < dt) { pStack.fill(Tm); eCycle[0] = 0; eCycle[1] = 0; eCycleT0 = sim.timeS; }
        // ── EL PLÁSTICO CONDUCE (F2b): cada pila entrega su flujo al vóxel de
        // superficie; la energía acumulada del paso calienta ese vóxel. La zona
        // gruesa (más pila) sigue metiendo más calor: el hot spot emerge, pero
        // ahora con el TIEMPO correcto (~t_c, no 0 s).
        for (let ci = 0; ci < cols.length; ci++) {
          const m = cols[ci];
          const i = m % nx, j = (m / nx) | 0;
          for (let side = 0; side < 2; side++) {
            const kv = side === 0 ? kTop[m] : kBot[m];
            if (kv < 0) continue;
            const v = idx(i, j, kv);
            const eJm2 = stepStack(ci, side, m, dt, T[v]);
            eCycle[side] += eJm2 / cols.length;            // acumula para el flujo MEDIO
            T[v] += eJm2 / (RHO_STEEL * CP_STEEL * dx);   // J/m² → °C del vóxel (dx de fondo)
          }
        }
        // 1) DIFUSIÓN: un paso espectral EXACTO (mismo modelo todo-acero de siempre)
        opEspectral.paso(dt);
        // 2) EL AGUA: Robin exacto por vóxel (e^(−cool·dt), no Euler del término)
        for (let n = 0; n < N; n++) {
          if (cool[n] > 0) T[n] = sim.coolantC + (T[n] - sim.coolantC) * Math.exp(-cool[n] * dt);
        }
        sim.timeS += dt;
      }
      let mn = 1e9, mx = -1e9;
      for (let n = 0; n < N; n++) { if (T[n] < mn) mn = T[n]; if (T[n] > mx) mx = T[n]; }
      sim.minC = mn; sim.maxC = mx;
    },
    sampleAt(x: number, y: number, zq: number): number {
      const i = Math.max(0, Math.min(nx - 1, Math.round(x / cell - 0.5)));
      const j = Math.max(0, Math.min(ny - 1, Math.round(y / cell - 0.5)));
      const k = Math.max(0, Math.min(nz - 1, Math.round((zq - zLo) / cell - 0.5)));
      return sim.Tview[idx(i, j, k)];      // steady (con FORMA) si está calculado
    },
    slice(zq: number) {
      const k = Math.max(0, Math.min(nz - 1, Math.round((zq - zLo) / cell - 0.5)));
      const S = new Float32Array(nx * ny);
      let mn = 1e9, mx = -1e9;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const v = sim.Tview[idx(i, j, k)];
        S[j * nx + i] = v;
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
      return { nx, ny, x0: 0, y0: 0, x1: spec.widthMm, y1: D, T: S, minC: +mn.toFixed(1), maxC: +mx.toFixed(1), dTC: +(mx - mn).toFixed(1) };
    },
    sliceAxis(axis: 'x' | 'y' | 'z', frac: number) {
      const f = Math.max(0, Math.min(1, frac));
      let nu = nx, nv = ny, u1 = spec.widthMm, v1 = D, posMm = 0;
      const S = axis === 'x' ? new Float32Array(ny * nz) : axis === 'y' ? new Float32Array(nx * nz) : new Float32Array(nx * ny);
      let mn = 1e9, mx = -1e9;
      if (axis === 'z') {
        const k = Math.max(0, Math.min(nz - 1, Math.round(f * (nz - 1))));
        posMm = zLo + (k + 0.5) * cell;
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const v = sim.Tview[idx(i, j, k)]; S[j * nx + i] = v;
          if (v < mn) mn = v; if (v > mx) mx = v;
        }
        nu = nx; nv = ny; u1 = spec.widthMm; v1 = D;
      } else if (axis === 'x') {
        const i = Math.max(0, Math.min(nx - 1, Math.round(f * (nx - 1))));
        posMm = (i + 0.5) * cell;
        for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
          const v = sim.Tview[idx(i, j, k)]; S[k * ny + j] = v;
          if (v < mn) mn = v; if (v > mx) mx = v;
        }
        nu = ny; nv = nz; u1 = D; v1 = zHi - zLo;
      } else {
        const j = Math.max(0, Math.min(ny - 1, Math.round(f * (ny - 1))));
        posMm = (j + 0.5) * cell;
        for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
          const v = sim.Tview[idx(i, j, k)]; S[k * nx + i] = v;
          if (v < mn) mn = v; if (v > mx) mx = v;
        }
        nu = nx; nv = nz; u1 = spec.widthMm; v1 = zHi - zLo;
      }
      return { nu, nv, u1, v1, posMm: +posMm.toFixed(1), T: S, minC: +mn.toFixed(1), maxC: +mx.toFixed(1) };
    },
    thGrid: { nx, ny, cellMm: cell, thMm },
    plasticTempAt(x: number, y: number) {
      const i = Math.max(0, Math.min(nx - 1, Math.floor(x / cell)));
      const j = Math.max(0, Math.min(ny - 1, Math.floor(y / cell)));
      const ci = cols.indexOf(j * nx + i);
      if (ci < 0) return sim.sampleAt(x, y, zPart);        // fuera de pieza: el acero
      let mx = -1e9;
      for (let side = 0; side < 2; side++) {
        const v = pStack[(ci * 2 + side) * PCELLS];
        if (v > mx) mx = v;
      }
      return mx;
    },
    warmUp(cycles = 8) {
      const target = sim.timeS + cycles * sim.cycleS;
      while (sim.timeS < target) sim.step(1);
    },
    steady: null as SteadyField | null,
    get Tview() { return sim.steady ? sim.steady.T : T; },
    computeSteady() {
      try {
        const volCc = estPartVolumeCc(spec.cavity);
        const fm = FEED_MATERIALS[(spec.plastic ?? 'PP').toUpperCase()] ?? FEED_MATERIALS.PP;
        const q = heatToExtractW({
          nCav: Math.max(1, spec.nCav ?? 1), volCcPerCav: volCc,
          rhoMeltKgM3: fm.rhoMeltKgM3, cpJkgC: 2100,
          tMeltC: fm.tMelt, tEjectC: fm.tEject, cycleS: sim.cycleS,
        });
        sim.steady = solveSteadyMoldField({
          nx, ny, nz, dxMm: cell, x0: 0, y0: 0, z0: zLo,
          plastic: sim.plasticVoxels(), cool, tCoolantC: sim.coolantC,
          qTotalW: q, lineDiaM: cc.diaMm / 1000, maxIters: 500, tolC: 1e-3,
        });
        // la ESCALA de la escena es la del ACERO (lo que se lee del molde);
        // el plástico a ~250 °C saturaría la rampa y todo el acero saldría plano.
        sim.minC = sim.steady.steelMinC; sim.maxC = sim.steady.steelMaxC;
        return sim.steady;
      } catch (e) { console.warn('STEADY_ERR', e); return null; }
    },
    plasticVoxels() {
      // el rasterizador ya dejó, por columna, el espesor y las superficies
      // (kTop = cara de cavidad, kBot = cara de núcleo): el plástico ocupa las
      // celdas ENTRE ambas — ahí está la forma real del vaso.
      const v = new Uint8Array(N);
      for (const m of cols) {
        const i = m % nx, j = (m / nx) | 0;
        const a = Math.min(kTop[m], kBot[m]), b = Math.max(kTop[m], kBot[m]);
        if (a < 0) continue;
        for (let k = a; k <= b; k++) v[idx(i, j, k)] = 1;
      }
      return v;
    },
    surfaceStudy() {
      const stat = (vals: number[]) => {
        if (!vals.length) return { minC: Tc, maxC: Tc, meanC: Tc, dTC: 0, n: 0 };
        let mn = 1e9, mx = -1e9, sum = 0;
        for (const v of vals) { if (v < mn) mn = v; if (v > mx) mx = v; sum += v; }
        return { minC: +mn.toFixed(2), maxC: +mx.toFixed(2), meanC: +(sum / vals.length).toFixed(2), dTC: +(mx - mn).toFixed(2), n: vals.length };
      };
      const cavT: number[] = [], coreT: number[] = [];
      for (const m of cols) {
        const i = m % nx, j = (m / nx) | 0;
        if (kTop[m] >= 0) cavT.push(T[idx(i, j, kTop[m])]);
        if (kBot[m] >= 0) coreT.push(T[idx(i, j, kBot[m])]);
      }
      // flujo por lado: el que las pilas de plástico entregaron en el último paso
      // flujo MEDIO del ciclo (no el instante final, cuando el plástico ya está
      // frío y da ~0): energía acumulada / tiempo transcurrido del ciclo.
      const qSide = (side: number) => {
        const dtc = Math.max(0.5, sim.timeS - eCycleT0);
        return +(eCycle[side] / dtc).toFixed(0);
      };
      // ΔT a través del acero: cara moldeante → la celda de agua más cercana
      // ΔT cara moldeante → LÍNEA DE AGUA más cercana (Eq 9.21). Busca en TODO
      // el dominio (la línea puede no caer en la misma columna) y guarda el k.
      // (Antes comparaba dos closures distintas con === : SIEMPRE false ⇒ 0 °C.)
      const dTsteel = (kOf: Int16Array) => {
        let acc = 0, n2 = 0;
        for (const m of cols) {
          const i = m % nx, j = (m / nx) | 0;
          const ks = kOf[m];
          if (ks < 0) continue;
          let best = Infinity, kBest = -1;
          for (let k = 0; k < nz; k++) {
            if (cool[idx(i, j, k)] <= 0) continue;
            const d = Math.abs(k - ks);
            if (d < best) { best = d; kBest = k; }
          }
          if (kBest < 0) {                       // sin línea en la columna: la más cercana del plano
            for (let jj = 0; jj < ny && kBest < 0; jj++) for (let ii = 0; ii < nx && kBest < 0; ii++) {
              for (let k = 0; k < nz; k++) if (cool[idx(ii, jj, k)] > 0 && Math.abs(k - ks) < best) { best = Math.abs(k - ks); kBest = k; }
            }
          }
          if (kBest < 0) continue;
          acc += T[idx(i, j, ks)] - T[idx(i, j, kBest)];
          n2++;
        }
        return n2 ? +(acc / n2).toFixed(2) : 0;
      };
      return {
        cav: stat(cavT), core: stat(coreT),
        deltaMm: +(Math.sqrt(ALPHA * sim.cycleS) * 1000).toFixed(1),
        fluxCavWm2: qSide(0), fluxCoreWm2: qSide(1),
        dTSteelCavC: dTsteel(kTop), dTSteelCoreC: dTsteel(kBot),
      };
    },
    plasticCenterMaxC() {
      let mx = -1e9;
      for (let ci = 0; ci < cols.length; ci++) {
        for (let side = 0; side < 2; side++) {
          const v = pStack[(ci * 2 + side) * PCELLS];     // celda 0 = línea central
          if (v > mx) mx = v;
        }
      }
      return mx === -1e9 ? Tc : mx;
    },
    pasos() {
      const f2 = (x: number, d = 2) => +x.toFixed(d);
      const matP = { k: K_ABS, rho: RHO_ABS, cp: CP_ABS };
      const matS = { k: K_STEEL, rho: RHO_STEEL, cp: CP_STEEL };
      const bP = effusivity(matP), bS = effusivity(matS);
      const tCont = contactTemperature(matP, Tm, matS, Tc);
      const delta = Math.sqrt(ALPHA * sim.cycleS) * 1000;
      const st = sim.steady;
      const nPlast = (() => { let n = 0; const v = sim.plasticVoxels(); for (let i = 0; i < v.length; i++) if (v[i]) n++; return n; })();
      const out: CalcPaso[] = [
        {
          titulo: 'Temperatura de CONTACTO instantánea (por qué el acero no se funde)',
          formula: 'T_contacto = (b_p·T_melt + b_s·T_molde)/(b_p + b_s)  ·  b = √(k·ρ·Cp)',
          sustitucion: `b_plástico = ${f2(bP, 0)} vs b_acero = ${f2(bS, 0)} → (${f2(bP, 0)}·${Tm} + ${f2(bS, 0)}·${Tc})/${f2(bP + bS, 0)}`,
          resultado: `${f2(tCont, 1)} °C en la cara al tocar`, ref: 'efusividades (§9.1)', ok: true,
          nota: 'el promedio simple diría (239+60)/2 ≈ 150 °C — la efusividad 17× del acero manda',
        },
        {
          titulo: 'Piel térmica del ciclo (por qué el bulk del molde es ESTABLE)',
          formula: 'δ = √(α_acero · t_ciclo)',
          sustitucion: `√(${ALPHA.toExponential(2)} · ${f2(sim.cycleS, 0)}s)`,
          resultado: `δ = ${f2(delta, 1)} mm oscilan; el resto promedia`, ref: '§9.1', ok: true,
        },
        {
          titulo: 'El dominio que se resolvió',
          formula: 'molde completo voxelizado + FORMA real de la pieza (celdas entre kTop y kBot)',
          sustitucion: `${nx}×${ny}×${nz} celdas de ${cell} mm · ${nPlast} celdas de plástico (k=${K_ABS}) en acero (k=${K_STEEL})`,
          resultado: `${(nx * ny * nz / 1000).toFixed(0)}k celdas`, ref: 'FDM + micro-pilas', ok: true,
          nota: material.esProxy ? material.nota : undefined,
        },
      ];
      if (st) {
        out.push({
          titulo: 'Campo CÍCLICO-PROMEDIO (el entregable estándar de la industria)',
          formula: '∇·(k∇T) + q‴ = 0 · agua Robin (Eq 9.7) · q‴ = Q̇/V_plástico (Eq 9.10)',
          sustitucion: `gradiente conjugado matrix-free: ${st.iters} iters, residual ${st.residualC}`,
          resultado: `acero ${st.steelMinC}…${st.steelMaxC} °C · superficie moldeante ${st.surfMinC}…${st.surfMaxC} °C`,
          ref: 'Moldflow/BEM desacoplado', ok: st.residualC < 0.1,
          nota: st.surfMaxC > 110 ? '⚠ superficie arriba de 110 °C: el circuito de agua NO alcanza (ver estudio §9.2 del agua)' : undefined,
        });
      } else {
        out.push({
          titulo: 'Campo cíclico-promedio', formula: '∇·(k∇T) + q‴ = 0',
          sustitucion: 'aún no calculado (computeSteady)', resultado: '—', ref: 'thermal-steady', ok: true,
        });
      }
      return out;
    },
  };
  return sim;
}
