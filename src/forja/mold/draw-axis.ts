/**
 * ELECCIÓN DE LA DIRECCIÓN DE APERTURA — la Máquina piensa como moldista:
 * prueba los 3 ejes de la pieza como dirección de apertura (±Z del molde) y se
 * queda con el MEJOR por score lexicográfico:
 *   1. sin cavidades selladas (NO moldeable) ·
 *   2. mínimo VOLUMEN de undercut (menos mecanismos §11.3) ·
 *   3. mínimo % de área lateral sin draft (§2.3.6 — un embudo abre por su eje
 *      de revolución: TODO es draft; acostado, sus paredes quedan verticales).
 * La regla vieja ("eje menor = profundidad") acostaba embudos y vasos.
 * Cada candidato es una ROTACIÓN propia (quiralidad intacta) con min en 0.
 */
import { dfmFromMesh, type DfmMeshReport } from './dfm-mesh';
import { uniqueSubShapes, volume as occVolume, surfaceArea as occArea, tessellate as occTess, transformShape as occTransform } from '../brep/occt';
import { predicadoDeMalla } from './flowlen';

export interface OrientedMesh {
  positions: Float32Array; indices: Uint32Array;
  /** qué eje ORIGINAL quedó como apertura (z) y descripción humana */
  zAxis: 0 | 1 | 2; label: string;
}

/** construye la malla con el eje `zAxis` original como Z, mayor de los restantes
 *  como X, quiralidad corregida (det=+1) y esquina mínima en el origen. */
export function orientMesh(mesh: { positions: Float32Array; indices: Uint32Array }, zAxis: 0 | 1 | 2): OrientedMesh {
  const P = mesh.positions;
  const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = P[i + k];
    if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }
  const rest = [0, 1, 2].filter((a) => a !== zAxis) as [number, number];
  const ext = (a: number) => mx[a] - mn[a];
  const xAxis = ext(rest[0]) >= ext(rest[1]) ? rest[0] : rest[1];
  const yAxis = xAxis === rest[0] ? rest[1] : rest[0];
  const order = [xAxis, yAxis, zAxis];
  // quiralidad: permutación impropia espejea la pieza → negar Y (rotación propia)
  const perm = [0, 1, 2].map((r) => [0, 1, 2].map((c) => (order[r] === c ? 1 : 0)));
  const det = perm[0][0] * (perm[1][1] * perm[2][2] - perm[1][2] * perm[2][1])
    - perm[0][1] * (perm[1][0] * perm[2][2] - perm[1][2] * perm[2][0])
    + perm[0][2] * (perm[1][0] * perm[2][1] - perm[1][1] * perm[2][0]);
  const sy = det < 0 ? -1 : 1;
  const y0 = sy > 0 ? mn[yAxis] : -mx[yAxis];
  const out = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    out[i] = P[i + xAxis] - mn[xAxis];
    out[i + 1] = sy * P[i + yAxis] - y0;
    out[i + 2] = P[i + zAxis] - mn[zAxis];
  }
  const names = ['L', 'W', 'H'];
  return { positions: out, indices: mesh.indices, zAxis, label: `apertura ∥ eje ${names[zAxis]} original (${ext(zAxis).toFixed(0)} mm)` };
}

export interface DrawAxisChoice {
  oriented: OrientedMesh;
  dfm: DfmMeshReport;
  candidates: Array<{ zAxis: number; label: string; enclosed: boolean; underVol: number; draftPct: number }>;
}

/** prueba los 3 ejes y elige (sellado ✗ → menos undercut → menos sin-draft). */
export function pickDrawAxis(mesh: { positions: Float32Array; indices: Uint32Array }, o?: { wallMm?: number }): DrawAxisChoice {
  let best: { om: OrientedMesh; dfm: DfmMeshReport } | null = null;
  const candidates: DrawAxisChoice['candidates'] = [];
  for (const z of [0, 1, 2] as const) {
    const om = orientMesh(mesh, z);
    const dfm = dfmFromMesh(om, { wallMm: o?.wallMm });
    candidates.push({
      zAxis: z, label: om.label,
      enclosed: dfm.undercut.enclosedVoids,
      underVol: dfm.undercut.volumeMm3,
      draftPct: dfm.draft.pctBelowMin,
    });
    if (!best) { best = { om, dfm }; continue; }
    const a = dfm, b = best.dfm;
    const better = (Number(a.undercut.enclosedVoids) - Number(b.undercut.enclosedVoids))
      || (a.undercut.volumeMm3 - b.undercut.volumeMm3)
      || (a.draft.pctBelowMin - b.draft.pctBelowMin);
    if (better < 0) best = { om, dfm };
  }
  return { oriented: best!.om, dfm: best!.dfm, candidates };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LA ENTRADA (orden 2026-09-18-la-entrada) — el STEP que suelta el cliente   */
/* llega al molde como UNA pieza, parada en su eje de apertura, boca arriba.  */
/* ══════════════════════════════════════════════════════════════════════════ */
// Medido en los 20 STEP Hammond (LAS 20 PIEZAS): 15 son ENSAMBLES (caja+tapa+PCB+tornillos+insertos+empaque) y
// `importSTEP` → `OneShape` los fundía en un ladrillo; 5 cajas abren en Y y 5 tienen la boca en −Z, pero todo el
// ciclo del molde SUPONE la boca arriba en +Z. Aquí: el sólido mayor, y un giro PROPIO alrededor de su centro.

export interface PiezaDelSTEP {
  /** la forma que entra al estudio: el STEP tal cual si ya venía bien; si no, el sólido elegido y girado */
  shape: any;
  solidos: number;
  /** volúmenes de TODOS los sólidos, de mayor a menor (cc) */
  volsCc: number[];
  elegido: { volCc: number; tamMm: [number, number, number] };
  eje: 'X' | 'Y' | 'Z';
  /** de qué lado del eje estaba la boca en el STEP ('?' = sin boca clara: se deja como venía) */
  boca: '+' | '-' | '?';
  metodo: 'seccion' | 'pickDrawAxis' | 'placa' | 'sin-solidos';
  /** % de la sección llena a ~1 mm de cada extremo, por eje: [lo, hi] — la boca es anillo, la base es llena */
  seccionPct: { X: [number, number]; Y: [number, number]; Z: [number, number] };
  /** el giro aplicado, en palabras (null = el STEP ya venía parado con la boca arriba) */
  giro: string | null;
  /** LA DECISIÓN, reaplicable a un STEP recién importado (ver `aplicarEntrada`): qué sólido (en el orden de
   *  `uniqueSubShapes`) y qué giros propios alrededor de qué centro */
  indice: number;
  giros: Array<{ ang: number; dir: [number, number, number]; origen: [number, number, number] }>;
}

/** Reaplica una decisión de `prepararPiezaDelSTEP` a una importación FRESCA del mismo archivo (el estudio reimporta
 *  en cada reconstrucción): toma el mismo sólido y le da los mismos giros, sin volver a medir. Sin decisión que
 *  aplicar (una pieza ya parada), regresa la forma tal cual — el mismo objeto. */
export function aplicarEntrada(oc: any, shape: any, d: Pick<PiezaDelSTEP, 'solidos' | 'indice' | 'giros'>): any {
  if (d.solidos <= 1 && !d.giros.length) return shape;
  let out = d.solidos > 1 ? uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID)[d.indice] ?? shape : shape;
  for (const g of d.giros) out = occTransform(oc, out, { translate: [0, 0, 0], rotateAngle: g.ang, rotateAxis: { origin: g.origen, dir: g.dir } });
  return out;
}

const EJES = ['X', 'Y', 'Z'] as const;

export function prepararPiezaDelSTEP(oc: any, shape: any): PiezaDelSTEP {
  // ⚠ el explorador quiere el ENUM, no su `.value`: con el número devolvía el COMPUESTO como «1 sólido»
  // (cazado en piezas-reales-intake.cjs, 2026-08).
  const solids: any[] = uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID);
  const vacio = { X: [0, 0], Y: [0, 0], Z: [0, 0] } as PiezaDelSTEP['seccionPct'];
  if (!solids.length) return { shape, solidos: 0, volsCc: [], elegido: { volCc: 0, tamMm: [0, 0, 0] }, eje: 'Z', boca: '?', metodo: 'sin-solidos', seccionPct: vacio, giro: null, indice: 0, giros: [] };
  // el volumen solo hace falta para ESCOGER: con un sólido no hay nada que comparar (medido: 0.4 s en la carcasa,
  // que corre al soltar el archivo y tiene 3 s para enseñar el Foco)
  const conVol = solids.length === 1 ? [{ s: solids[0], v: NaN, i: 0 }] : solids.map((s, i) => ({ s, v: occVolume(oc, s), i })).sort((a, b) => b.v - a.v);
  const el = conVol[0].s;

  // ── la SECCIÓN LLENA a ~1 mm de cada extremo de cada eje (malla gruesa: basta para dentro/fuera) ──
  const m = occTess(oc, el, 0.8, 0.8);
  const dentro = predicadoDeMalla(m.positions, m.indices);
  // la caja envolvente de la MISMA malla (la de polos, `Add(…, false)`, inflaba 7× con superficies BSpline; la
  // `AddOptimal` es real pero cuesta 0.4 s en la carcasa y 2–5 s en los ensambles — la malla ya la tenemos)
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = m.positions[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }
  const ext = [0, 1, 2].map((k) => mx[k] - mn[k]);
  const centro: [number, number, number] = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const llena = (ax: number, z: number) => {
    const [a, b] = [0, 1, 2].filter((k) => k !== ax);
    let h = 0, n = 0;
    for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) {
      const q = [0, 0, 0];
      q[a] = mn[a] + ((i + 0.5) / 40) * ext[a]; q[b] = mn[b] + ((j + 0.5) / 40) * ext[b]; q[ax] = z;
      n++; if (dentro(q[0], q[1], q[2])) h++;
    }
    return h / n;
  };
  const sec = [0, 1, 2].map((ax) => { const d = Math.min(1, ext[ax] / 10); return [llena(ax, mn[ax] + d), llena(ax, mx[ax] - d)] as [number, number]; });
  const seccionPct = { X: sec[0].map((v) => Math.round(100 * v)), Y: sec[1].map((v) => Math.round(100 * v)), Z: sec[2].map((v) => Math.round(100 * v)) } as PiezaDelSTEP['seccionPct'];

  // ── el EJE de apertura: donde un extremo es anillo (boca) y el otro lleno (base) ──
  // Coincide con pickDrawAxis (menor contrasalida §11) en los 20 STEP; pickDrawAxis solo se consulta cuando la
  // asimetría es débil (medias conchas 1593K/L). Placa (todo lleno en los 3 ejes): el eje es el ESPESOR.
  const asim = sec.map(([lo, hi]) => Math.abs(lo - hi));
  let eje: 0 | 1 | 2, metodo: PiezaDelSTEP['metodo'];
  if (sec.every(([lo, hi]) => lo > 0.9 && hi > 0.9)) {
    eje = ext.indexOf(Math.min(...ext)) as 0 | 1 | 2; metodo = 'placa';
  } else {
    const mejor = asim.indexOf(Math.max(...asim)) as 0 | 1 | 2;
    if (asim[mejor] >= 0.25) { eje = mejor; metodo = 'seccion'; }
    else {
      let area = 0, vol = conVol[0].v; try { area = occArea(oc, el); if (!Number.isFinite(vol)) vol = occVolume(oc, el); } catch { /* pared por defecto */ }
      const wall = area > 0 ? Math.min(4, Math.max(1, (2 * vol) / area)) : 2;
      eje = pickDrawAxis({ positions: m.positions, indices: m.indices }, { wallMm: wall }).oriented.zAxis;
      metodo = 'pickDrawAxis';
    }
  }
  const [lo, hi] = sec[eje];
  const boca: PiezaDelSTEP['boca'] = metodo === 'placa' ? '?' : hi < lo - 0.1 ? '+' : lo < hi - 0.1 ? '-' : '?';

  // ── el GIRO propio que lleva ese eje con la boca a +Z (alrededor del centro: la pieza no se va de cuadro) ──
  const G = Math.PI / 2;
  const giros: Array<{ ang: number; dir: [number, number, number]; txt: string }> = [];
  if (eje === 2 && boca === '-') giros.push({ ang: Math.PI, dir: [1, 0, 0], txt: 'volteada 180° (la boca miraba a −Z)' });
  if (eje === 1) giros.push(boca === '-' ? { ang: -G, dir: [1, 0, 0], txt: 'parada: abría en −Y' } : { ang: G, dir: [1, 0, 0], txt: 'parada: abría en +Y' });
  if (eje === 0) giros.push(boca === '-' ? { ang: G, dir: [0, 1, 0], txt: 'parada: abría en −X' } : { ang: -G, dir: [0, 1, 0], txt: 'parada: abría en +X' });

  const volsCc = conVol.filter((x) => Number.isFinite(x.v)).map((x) => +(x.v / 1000).toFixed(2));
  // el tamaño YA PARADO (lo que el molde va a ver): girar sobre X intercambia Y↔Z; sobre Y, X↔Z
  const tamParado = eje === 1 ? [ext[0], ext[2], ext[1]] : eje === 0 ? [ext[2], ext[1], ext[0]] : ext;
  const elegido = { volCc: volsCc[0] ?? NaN, tamMm: tamParado.map((v) => +v.toFixed(2)) as [number, number, number] };
  // UNA pieza que ya venía parada: el STEP TAL CUAL (el mismo objeto — la carcasa no cambia ni un bit)
  const decision = { solidos: solids.length, indice: conVol[0].i, giros: giros.map((g) => ({ ang: g.ang, dir: g.dir, origen: centro })) };
  const out = aplicarEntrada(oc, shape, decision);
  return { shape: out, ...decision, volsCc, elegido, eje: EJES[eje], boca, metodo, seccionPct, giro: giros.length ? giros.map((g) => g.txt).join(' · ') : null };
}
