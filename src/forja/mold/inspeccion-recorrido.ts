/**
 * LA INSPECCIÓN · EL RECORRIDO — el paso 7 del pipeline: la máquina revisa tu molde, sección por sección.
 * ============================================================================
 * ian (2026-10-22): «el análisis del video del inspector no es algo aparte: es parte del pipeline». El inspector
 * (scripts/inspecciona-molde.cjs) recorría 17 puntos con su corte y su cota; la revisión cruzada (2026-09-28) los dejó en
 * focos y cada agente eligió el suyo. Aquí viven, DENTRO de la app, los cuatro que un moldista revisa primero:
 *   1. ¿El techo del macho toca tu pieza? — rejilla de rayos sobre la huella (el error que ya nos pasó: 1/50 → 50/50);
 *                                           no ve rasgos menores que el paso de la rejilla (LOS APAGONES, 2026-10-24)
 *   2. ¿Los botadores empujan parejo?      — el centro de los pines contra el centro del área, con su tope (regla de Hefestos)
 *   3. ¿Dónde queda menos acero junto al agua? — el par más justo del Foco (geometría exacta), aunque cumpla
 *   4. ¿Abre, sale y empuja?               — la apertura contra la pieza con su bebedero, y la carrera contra su caja
 * Cada punto trae: la pregunta, el número de HOY, su límite, el veredicto y la frase física — y lo que la escena dibuja
 * (marcas, cruces, círculo, cota), de UNA sola verdad: la cota que se ve ES el número que se juzga.
 *
 * Puro: entra la lista de piezas del molde (marco del molde, mm), sale el recorrido.
 */
import { crucesVerticales, cuerposDe, type PiezaMolde, type ResultadoFoco } from './foco-molde';

type V3 = [number, number, number];

export type Veredicto = 'ok' | 'falla' | 'aviso';
export interface MarcaRecorrido { tipo: 'punto' | 'cruz' | 'circulo'; p: V3; color: Veredicto | 'neutro' | 'pin'; r?: number }
export interface PuntoRecorrido {
  id: string;
  pregunta: string;
  /** el número que se juzga, con su unidad y su límite, en una línea */
  numero: string;
  limite: string;
  veredicto: Veredicto;
  /** qué pasa físicamente → el número de hoy → el límite (el estilo que ian aprobó) */
  frase: string;
  regla: string;
  /** lo que se dibuja */
  marcas: MarcaRecorrido[];
  cotas: Array<{ a: V3; b: V3; etiqueta: string; ok?: boolean }>;
  /** la vista: qué se aísla (y qué queda tenue), el corte y la cámara (az, el, r, objetivo) */
  vista: {
    roles: string[]; tenues?: string[]; opacs?: Record<string, number>;
    corte?: { eje: 'x' | 'y' | 'z'; mm: number; voltea?: boolean } | null;
    camara: { az: number; el: number; r: number; objetivo: V3 };
    /** el punto anima la pose del molde (abre-sale-empuja) */
    anima?: 'abre-expulsa';
  };
}

const caja = (p: PiezaMolde) => {
  const P = p.positions; const mn: V3 = [1e18, 1e18, 1e18], mx: V3 = [-1e18, -1e18, -1e18];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < mn[k]) mn[k] = P[i + k]; if (P[i + k] > mx[k]) mx[k] = P[i + k]; }
  return { mn, mx };
};
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);

/** 1 · ¿EL TECHO DEL MACHO TOCA TU PIEZA? — en cada punto de una rejilla sobre la huella, un rayo vertical: el techo del
 *  macho (su cruce más alto) tiene que tocar la cara de la pieza (≤ 0.5 mm). Donde no hay pieza o no hay macho, gris.
 *  LOS APAGONES (2026-10-24, juez A · D9): «50 de 50 puntos tocan · el macho llena tu pieza» prometía más de lo que mide.
 *  Con 10×5 rayos el paso es de 9–19 mm en la 1594C y los postes ⌀8 caen ENTRE rayos: quítale un poste y sigue 50/50.
 *  Ahora dice lo que mide (N rayos sobre el techo, todos a ≤ 0.5 mm) y lo que NO (rasgos menores que el paso, que se
 *  calcula de la rejilla — no se teclea). La báscula del acero (Σ cavidad + macho + pieza = bloque, `verificacionE3`)
 *  se suma si el que llama la trae; si no, no se inventa. */
export function rejillaDelMacho(piezas: PiezaMolde[], nx = 10, ny = 5, bascula?: { errPct: number } | null): PuntoRecorrido | null {
  const pz = piezas.find((p) => p.role === 'pieza'), nu = piezas.find((p) => p.role === 'nucleo');
  if (!pz || !nu) return null;
  const B = caja(pz), N = caja(nu);
  const z0 = Math.min(B.mn[2], N.mn[2]) - 1;
  const marcas: MarcaRecorrido[] = [];
  let tocan = 0, huecos = 0, peor = 0, sin = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = B.mn[0] + (B.mx[0] - B.mn[0]) * (0.06 + 0.88 * (i + 0.5) / nx);
    const y = B.mn[1] + (B.mx[1] - B.mn[1]) * (0.06 + 0.88 * (j + 0.5) / ny);
    const o: V3 = [x + 1e-4, y + 2e-4, z0];
    const zp = crucesVerticales(pz, o, 1).map((d) => z0 + d);
    const zn = crucesVerticales(nu, o, 1).map((d) => z0 + d);
    if (zp.length < 2 || !zn.length) { sin++; marcas.push({ tipo: 'punto', p: [x, y, zp.length ? zp[0] : N.mx[2]], color: 'neutro' }); continue; }
    const techo = Math.max(...zn);
    const gap = Math.min(...zp.map((z) => Math.abs(z - techo)));
    if (gap <= 0.5) { tocan++; marcas.push({ tipo: 'punto', p: [x, y, techo], color: 'ok' }); }
    else { huecos++; peor = Math.max(peor, gap); marcas.push({ tipo: 'punto', p: [x, y, techo], color: 'falla' }); }
  }
  const total = tocan + huecos;
  const cy = (B.mn[1] + B.mx[1]) / 2, cx = (B.mn[0] + B.mx[0]) / 2;
  const v: Veredicto = huecos === 0 ? 'ok' : 'falla';
  // el PASO de la rejilla: lo que un rasgo tiene que medir para que un rayo seguro lo pise
  const pasoX = (0.88 * (B.mx[0] - B.mn[0])) / nx, pasoY = (0.88 * (B.mx[1] - B.mn[1])) / ny;
  const noRevisa = `no revisa rasgos menores que el paso de la rejilla (${f1(pasoX)} × ${f1(pasoY)} mm): postes, nervios`;
  const bas = bascula && Number.isFinite(bascula.errPct) ? ` Báscula del acero: cavidad + macho + pieza = bloque, error ${bascula.errPct.toFixed(2)} %.` : '';
  return {
    id: 'macho-llena', pregunta: '¿El techo del macho toca tu pieza?',
    numero: huecos === 0 ? `${total} rayos tocan la pieza` : `${huecos} de ${total} rayos no tocan`, limite: 'sobre el techo del macho, a ≤ 0.5 mm', veredicto: v,
    frase: (huecos === 0
      ? `Tiré ${total} rayos verticales sobre el techo del macho: todos tocan la pieza a ≤ 0.5 mm. Van uno cada ${f1(pasoX)} × ${f1(pasoY)} mm; un poste o un nervio más chico que eso puede caer entre dos rayos sin que lo vea.`
      : `En ${huecos} de ${total} rayos el techo del macho no llega a la pieza (hasta ${f1(peor)} mm de hueco): ahí el molde haría un bloque macizo de plástico.`) + bas,
    regla: `rayo vertical contra la malla real del macho y de la pieza · tolerancia 0.5 mm (regla de Hefestos) · ${noRevisa}`,
    marcas, cotas: [],
    vista: { roles: ['nucleo', 'pieza'], opacs: { nucleo: 0.95, pieza: 0.22 }, corte: { eje: 'y', mm: cy }, camara: { az: 0, el: 22, r: Math.max(B.mx[0] - B.mn[0], 120) * 1.7, objetivo: [cx, cy, (B.mn[2] + B.mx[2]) / 2] } },
  };
}

/** 2 · ¿LOS BOTADORES EMPUJAN PAREJO? — el centro de los pines contra el centro del ÁREA de la pieza vista en planta;
 *  el tope es 0.1·L (L = lado mayor de la huella) — regla de Hefestos: Kazmer §11.2.5/§11.3.4 nombran el defecto sin número. */
export function equilibrioDeBotadores(piezas: PiezaMolde[]): PuntoRecorrido | null {
  const pz = piezas.find((p) => p.role === 'pieza');
  const pins = piezas.filter((p) => /^pin-punta-\d+$/.test(p.role));
  if (!pz || !pins.length) return null;
  const B = caja(pz);
  // centro del área en planta: triángulos que miran hacia arriba, proyectados, ponderados por su área
  const P = pz.positions, I = pz.indices && pz.indices.length ? pz.indices : Array.from({ length: P.length / 3 }, (_, i) => i);
  let A = 0, sx = 0, sy = 0;
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ar = ((P[b] - P[a]) * (P[c + 1] - P[a + 1]) - (P[c] - P[a]) * (P[b + 1] - P[a + 1])) / 2;   // área con signo en planta
    if (ar <= 0) continue;
    A += ar; sx += ar * (P[a] + P[b] + P[c]) / 3; sy += ar * (P[a + 1] + P[b + 1] + P[c + 1]) / 3;
  }
  if (A <= 0) return null;
  const cA: V3 = [sx / A, sy / A, B.mn[2]];
  const ps = pins.map((p) => { const c = cuerposDe(p)[0]; return [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, c.max[2]] as V3; });
  const cP: V3 = [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length, B.mn[2]];
  const L = Math.max(B.mx[0] - B.mn[0], B.mx[1] - B.mn[1]), tope = 0.1 * L;
  const d = Math.hypot(cP[0] - cA[0], cP[1] - cA[1]);
  const ok = d <= tope;
  return {
    id: 'equilibrio', pregunta: '¿Los botadores empujan parejo?',
    numero: `${f2(d)} mm entre los dos centros`, limite: `tope ${f2(tope)} mm`, veredicto: ok ? 'ok' : 'falla',
    frase: ok
      ? `Al expulsar, los ${ps.length} botadores empujan juntos: su centro cae a ${f2(d)} mm del centro de la pieza y el tope es ${f2(tope)}. Sale derecha.`
      : `El centro de los ${ps.length} botadores cae a ${f2(d)} mm del centro de la pieza, fuera del tope de ${f2(tope)}: la pieza sale ladeada, se raya o se atora.`,
    regla: 'centro de los pines vs centro del área en planta ≤ 0.1·L — regla de Hefestos (Kazmer §11.2.5 y §11.3.4 nombran el defecto, no el número)',
    marcas: [
      ...ps.map((p) => ({ tipo: 'punto' as const, p, color: 'pin' as const })),
      { tipo: 'circulo', p: cA, r: tope, color: ok ? 'ok' : 'falla' },
      { tipo: 'cruz', p: cA, color: 'neutro' },
      { tipo: 'punto', p: cP, color: ok ? 'ok' : 'falla', r: 2.4 },
    ],
    cotas: [{ a: cA, b: cP, etiqueta: 'entre los dos centros', ok }],
    vista: { roles: ['pieza', 'pin-punta-*', 'pin-cuerpo-*'], opacs: { pieza: 0.18 }, corte: null,
      camara: { az: 0, el: 89, r: L * 2.0, objetivo: [cA[0], cA[1], B.mn[2]] } },
  };
}

/** 3 · ¿DÓNDE QUEDA MENOS ACERO JUNTO AL AGUA? — el par más justo que midió el Foco (eje↔eje, menos radios). */
export function aguaMasJusta(foco: ResultadoFoco | null): PuntoRecorrido | null {
  const m = foco?.masJusto; if (!m) return null;
  const v: Veredicto = m.acero < 0 ? 'falla' : m.acero < m.limite ? 'falla' : m.acero < m.limite + 0.5 ? 'aviso' : 'ok';
  const u: V3 = [m.c2[0] - m.c1[0], m.c2[1] - m.c1[1], m.c2[2] - m.c1[2]]; const n = Math.hypot(...u) || 1;
  const s1: V3 = [m.c1[0] + u[0] / n * m.rA, m.c1[1] + u[1] / n * m.rA, m.c1[2] + u[2] / n * m.rA];
  const s2: V3 = [m.c2[0] - u[0] / n * m.rB, m.c2[1] - u[1] / n * m.rB, m.c2[2] - u[2] / n * m.rB];
  const eje = m.ejeAgua === 0 ? 'x' : m.ejeAgua === 1 ? 'y' : 'z';
  return {
    id: 'agua-justa', pregunta: '¿Dónde queda menos acero junto al agua?',
    numero: `${f2(m.acero)} mm de acero`, limite: `mínimo ${f2(m.limite)} mm`, veredicto: v,
    frase: m.acero < 0
      ? `${m.nombreA} atraviesa ${m.nombreB}: se meten ${f2(-m.acero)} mm. En la máquina es una fuga y una pieza atorada.`
      : `El punto más justo de todo el molde: entre ${m.nombreA} y ${m.nombreB} quedan ${f2(m.acero)} mm de acero; el mínimo es ${f2(m.limite)}. ${v === 'ok' ? 'Cumple con margen.' : v === 'aviso' ? 'Cumple, pero de panzazo.' : 'No cumple.'}`,
    regla: 'distancia eje a eje entre cilindros exactos, menos los dos radios ≥ ½·⌀ del agua',
    marcas: [{ tipo: 'punto', p: m.lugar, color: v }],
    cotas: [{ a: s1, b: s2, etiqueta: 'acero que queda', ok: v !== 'falla' }],
    vista: { roles: [m.roleA, m.roleB], opacs: { [m.roleA]: 0.9, [m.roleB]: 0.85 }, corte: { eje, mm: m.lugar[m.ejeAgua] },
      camara: { az: m.ejeAgua === 0 ? 90 : 0, el: 12, r: 90, objetivo: m.lugar } },
  };
}

/** 4 · ¿ABRE, SALE Y EMPUJA? — la apertura tiene que sacar la pieza CON su bebedero (§6.3.2) + 10 mm de holgura (regla de
 *  Hefestos); la expulsora recorre lo que pide la pieza y tiene que caber en su caja. Los números de la apertura los lee la
 *  app del molde abierto (animZ) — aquí solo se arma la pregunta. */
export function abreSaleEmpuja(piezas: PiezaMolde[], o: { aperturaReal: number | null; carreraLibre: number | null; carreraPedida: number | null }): PuntoRecorrido | null {
  const pz = piezas.find((p) => p.role === 'pieza'), col = piezas.find((p) => p.role === 'colada');
  if (!pz) return null;
  const B = caja(pz), H = B.mx[2] - B.mn[2], Lc = col ? caja(col).mx[2] - caja(col).mn[2] : 0;
  const pide = H + Lc + 10;
  const ab = o.aperturaReal, okA = ab != null && ab >= pide;
  const okC = o.carreraLibre != null && o.carreraPedida != null && o.carreraLibre >= o.carreraPedida;
  const v: Veredicto = okA && okC ? 'ok' : 'falla';
  const cx = (B.mn[0] + B.mx[0]) / 2, cy = (B.mn[1] + B.mx[1]) / 2;
  return {
    id: 'abre-sale-empuja', pregunta: '¿Abre, sale y empuja?',
    numero: ab != null ? `abre ${f1(ab)} mm` : 'apertura sin medir', limite: `pide ${f1(pide)} mm`, veredicto: v,
    frase: `El molde abre ${ab != null ? f1(ab) : '?'} mm; tu pieza con su bebedero necesita ${f1(pide)}${ab != null ? ` (le sobran ${f1(ab - pide)})` : ''}. `
      + (o.carreraLibre != null && o.carreraPedida != null ? `Luego la placa expulsora sube ${f1(o.carreraPedida)} mm y su caja deja ${f1(o.carreraLibre)}: ${okC ? 'cabe' : 'NO cabe'}.` : ''),
    regla: '§6.3.2: la apertura saca la pieza con su colada · + 10 mm de holgura (regla de Hefestos) · carrera ≤ caja expulsora (§4.3.2 Fig 4.22)',
    marcas: [], cotas: [],
    vista: { roles: ['*'], corte: { eje: 'y', mm: cy }, camara: { az: 0, el: 6, r: 520, objetivo: [cx, cy, B.mx[2]] }, anima: 'abre-expulsa' },
  };
}
