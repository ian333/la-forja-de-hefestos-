/**
 * EL FOCO · LAS LENTES — el análisis pasa DONDE YA ESTÁS MIRANDO.
 * ============================================================================
 * ian (2026-08-30): «el Foco puede ser para ver el sistema de enfriamiento o la
 * temperatura — la idea es que el Foco sea el lugar del análisis y NO TENGAS QUE
 * PAGAR EXTRA NI ESPERAR».
 *
 * Eso es un requisito duro. Por eso este módulo NO trae motor nuevo: consume el
 * que ya está probado y lo corre UNA sola vez.
 *
 *   `flowFieldFromMesh` (revisar-modelo.ts) → FlowField
 *      · thicknessMm  — espesor local por vóxel (EDT chamfer + esfera de
 *                       Hildebrand–Rüegsegger). Es el mismo campo que ya manda
 *                       la resistencia del llenado, no una aproximación aparte.
 *      · flowLenMm    — L geodésica desde la compuerta, RODEANDO el acero
 *      · resistance   — el orden REAL de llenado (ΔP ∝ 1/H^(1+n), Eq 5.22)
 *   `cooling.ts` → Eq 9.5 de Kazmer, calibrada contra el libro (placa ABS de
 *      2 mm = 8.4 s; el gate lo verifica).
 *
 * MEDIDO (2026-08-30, STLs reales, una pasada que alimenta las TRES lentes):
 *   rpi4-top 3,780 tri → 0.46 s · einsy-base 9,142 → 0.62 s
 *   naturebytes-front 14,392 → 0.85 s · 3dbenchy 225,706 → 2.44 s
 * Descartada la vía del SDF exacto (`sdf-malla.ts`): 14 s en la pieza más chica.
 * Es exacta y sirve para el molde, pero no para una lente viva.
 *
 * LA REGLA DE COLOR (captura 8:26 de Horizon, atlas U9): en el juego el APARATO
 * brilla cian y lo que PROYECTA es violeta. Traducido aquí, el color dice
 * DE DÓNDE VIENE EL NÚMERO:
 *   · CIAN    = lo que MEDIMOS. Está en la pieza; el Foco solo lo trazó.
 *   · VIOLETA = lo que SIMULAMOS. No existe en la pieza: es un cálculo.
 * Y de Hardspace: Shipbreaker, la leyenda donde **el color ES la clave** —
 * cada lente entrega sus paradas con valor y unidad, no una barra bonita.
 *
 * La FICHA va en LENGUAJE NATURAL, también de Horizon ("Blast door. Heavily
 * shielded."). ian, sobre el panel viejo: «no tengo ni idea de qué dice ahí».
 * Aquí no se escribe `t_c=382.9s @ h=13.5mm`: se escribe qué significa.
 */
import type { MeshLike } from './flowlen-mesh';
import type { FlowField } from './flowlen';
import { flowFieldFromMesh } from './revisar-modelo';
import { coolingTimePlate, ABS_KAZMER, type CoolingMaterial } from './cooling';

export type LenteId = 'pared' | 'enfriamiento' | 'llenado';

/** de dónde viene el número — decide el idioma de color (la regla de Horizon) */
export type Origen = 'medido' | 'simulado';

export interface ParadaLeyenda {
  /** valor real de esta parada, en la unidad de la lente */
  v: number;
  hex: string;
  /** qué significa este color, en palabras */
  etiqueta: string;
}

export interface Lente {
  id: LenteId;
  nombre: string;
  /** una línea: qué estás viendo */
  que: string;
  unidad: string;
  origen: Origen;
  /** RGB 0..1 por vértice (3·nVert) — entra tal cual al canal `feaColors` */
  colores: Float32Array;
  /** el VALOR por vértice (NaN = sin dato). Se expone para que se pueda
   *  comprobar que la leyenda describe de verdad lo que está pintado — el
   *  gate lo usa: busca el vértice más cercano a cada parada y exige que su
   *  color sea el de la parada. Sin esto, "el color es la clave" sería fe. */
  valores: Float32Array;
  min: number; max: number; p50: number; p95: number;
  /**
   * El rango REAL del campo (vóxeles), que casi nunca es el de los vértices: un
   * vértice puede no caer sobre el vóxel extremo. La FICHA cita este número —
   * si citara el de los vértices, el titular y LA MARCA dirían cifras distintas
   * en la misma pantalla (cazado en la primera corrida: 75.8 vs 80.4 mm).
   */
  maxCampo: number;
  /**
   * Los extremos de la RAMPA de color. No son min/max: son p05/p95. Estos campos
   * están tirados al piso (la mediana ES el mínimo en toda pieza real), así que
   * con min→max la pieza sale de un solo color y la leyenda repite parada. Lo que
   * se pasa de `hi` se pinta con el color del tope, y la leyenda LO DICE.
   */
  escala: { lo: number; hi: number };
  /** la leyenda: el color ES la clave */
  paradas: ParadaLeyenda[];
  /** el titular de la ficha (una frase, con el número que manda) */
  titular: string;
  /** el cuerpo, en español, diciendo qué hacer */
  cuerpo: string;
  /** dónde está el punto que manda — para LA MARCA sobre la pieza */
  peor: { punto: [number, number, number]; valor: number } | null;
  /** el § del libro del que sale */
  ref: string;
  /** vértices sin dato (fuera de la rejilla) — se DICE, no se pinta gris a escondidas */
  sinDato: number;
}

export interface LentesFoco {
  lentes: Lente[];
  campo: {
    celdaMm: number; huecos: number; nx: number; ny: number; nz: number;
    volumenCm3: number; inalcanzables: number; avisos: string[];
  };
  /** ms REALES de esta corrida, impresos por el módulo (no de memoria) */
  ms: { campo: number; lentes: number; total: number };
}

export interface OpcionesLentes {
  material?: CoolingMaterial;
  /** tope de vóxeles del campo. Medido: 90k resuelve bien y cuesta ≤2.5 s. */
  maxVoxels?: number;
  gateMm?: { x: number; y: number; z: number };
}

// ── PALETAS ──────────────────────────────────────────────────────────────────
// Cada rampa es una lista de (posición 0..1, RGB). Se interpola en sRGB directo
// porque el material va con `toneMapped:false`: el color que se escribe es el
// color que se ve, que es la condición para que una leyenda signifique algo.
type Rampa = Array<[number, [number, number, number]]>;

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255,
];

/** CIAN — lo MEDIDO. Del cian profundo (delgado) al blanco frío (grueso), y el
 *  ámbar reservado para lo que se sale de la norma del libro. */
const RAMPA_MEDIDO: Rampa = [
  [0.00, hex('#0a3a4a')],
  [0.35, hex('#2596b8')],
  [0.70, hex('#5fd4f5')],
  [1.00, hex('#d8f6ff')],
];

/** VIOLETA — lo SIMULADO. Del violeta hondo (rápido/temprano) al magenta
 *  encendido (lento/tardío). Es el idioma del Foco de Horizon. */
const RAMPA_SIMULADO: Rampa = [
  [0.00, hex('#241a4d')],
  [0.30, hex('#5b34a8')],
  [0.60, hex('#a248d8')],
  [0.85, hex('#e061c8')],
  [1.00, hex('#ffd3f2')],
];

const AMBAR = hex('#ffc24b');   // exige tu atención
const ROJO = hex('#ff6b6b');    // viola el libro

function muestrearRampa(r: Rampa, t: number): [number, number, number] {
  const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
  for (let i = 1; i < r.length; i++) {
    if (u <= r[i][0]) {
      const [p0, c0] = r[i - 1], [p1, c1] = r[i];
      const f = p1 === p0 ? 0 : (u - p0) / (p1 - p0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return r[r.length - 1][1];
}

const rgbHex = (c: [number, number, number]) =>
  '#' + c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');

/**
 * EL COLOR DE UN VALOR — la ÚNICA función que traduce dato → color. La usan el
 * bucle por vértice Y la leyenda, a propósito: si fueran dos, el sólido y su
 * clave podrían decir cosas distintas, que es la peor falla posible en una
 * lente (una leyenda que no describe lo que ves).
 *
 * El GAMMA no es maquillaje. Estos campos están tirados al piso (la mediana
 * suele ser el mínimo), así que con mapeo lineal casi toda la pieza cae al
 * mismo tercio de la rampa y el resultado se ve de un solo color — cazado A OJO
 * en el primer drive: la lente de enfriamiento salía rosa parejo y solo el
 * macizo destacaba por suerte. Con gamma>1 lo bajo se hunde y lo alto salta:
 * la pieza cuenta lo que importa — QUÉ manda el ciclo.
 */
function colorDe(r: Rampa, v: number, esc: { lo: number; hi: number }, gamma: number): [number, number, number] {
  const u = (v - esc.lo) / (esc.hi - esc.lo);
  const t = u <= 0 ? 0 : u >= 1 ? 1 : Math.pow(u, gamma);
  return muestrearRampa(r, t);
}
/** lineal para lo MEDIDO (importa toda la distribución), realzado para lo SIMULADO
 *  (importa el extremo: el punto que manda el ciclo, el rincón que llena al final) */
const GAMMA_MEDIDO = 1.0;
const GAMMA_SIMULADO = 1.7;

// ── MUESTREO DEL CAMPO EN LOS VÉRTICES ───────────────────────────────────────
/**
 * Los vértices viven SOBRE la superficie, así que su vóxel puede caer del lado del
 * acero. Se busca en un cubo creciente el vóxel de HUECO más cercano y se toma su
 * valor. Radio 2 celdas basta (la superficie nunca está a más de eso del hueco);
 * el que no encuentra nada se cuenta en `sinDato` y se DICE.
 */
function muestrearEnVertices(
  f: FlowField, P: ArrayLike<number>, campoVox: Float32Array,
): { val: Float32Array; sinDato: number } {
  const nv = P.length / 3;
  const val = new Float32Array(nv);
  let sinDato = 0;
  const c = f.cellMm;
  for (let v = 0; v < nv; v++) {
    const i0 = Math.floor((P[v * 3] - f.x0) / c);
    const j0 = Math.floor((P[v * 3 + 1] - f.y0) / c);
    const k0 = Math.floor((P[v * 3 + 2] - f.z0) / c);
    let mejor = NaN, mejorD = Infinity;
    for (let r = 0; r <= 2 && !Number.isFinite(mejor); r++) {
      for (let dk = -r; dk <= r; dk++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj), Math.abs(dk)) !== r) continue;   // solo la cáscara
        const i = i0 + di, j = j0 + dj, k = k0 + dk;
        if (i < 0 || j < 0 || k < 0 || i >= f.nx || j >= f.ny || k >= f.nz) continue;
        const t = f.idx(i, j, k);
        if (!f.cavity[t]) continue;
        const x = campoVox[t];
        if (!Number.isFinite(x)) continue;
        const d = di * di + dj * dj + dk * dk;
        if (d < mejorD) { mejorD = d; mejor = x; }
      }
    }
    if (Number.isFinite(mejor)) val[v] = mejor; else { val[v] = NaN; sinDato++; }
  }
  return { val, sinDato };
}

function cuantiles(a: Float32Array): { min: number; max: number; p50: number; p95: number; p05: number } {
  const v = Array.from(a).filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return { min: 0, max: 0, p50: 0, p95: 0, p05: 0 };
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return { min: v[0], max: v[v.length - 1], p50: q(0.5), p95: q(0.95), p05: q(0.05) };
}

/**
 * LA ESCALA DE COLOR. p05→p95, y nunca degenerada: si el campo está tan tirado al
 * piso que p05 == p95 (pasa en una pieza de pared perfectamente pareja), se abre
 * hasta el máximo real para que la rampa tenga a dónde ir.
 */
function escalaDe(q: { min: number; max: number; p05: number; p95: number }): { lo: number; hi: number } {
  let lo = q.p05, hi = q.p95;
  if (hi - lo < 1e-6) { lo = q.min; hi = q.max; }
  if (hi - lo < 1e-6) hi = lo + 1;
  return { lo, hi };
}

/** el vóxel que manda (máximo del campo) → su centro en mm, para LA MARCA */
function puntoDelMaximo(f: FlowField, campoVox: Float32Array): { punto: [number, number, number]; valor: number } | null {
  let mejor = -Infinity, t = -1;
  for (let i = 0; i < campoVox.length; i++) {
    if (!f.cavity[i]) continue;
    const x = campoVox[i];
    if (Number.isFinite(x) && x > mejor) { mejor = x; t = i; }
  }
  if (t < 0) return null;
  const i = t % f.nx, fila = (t - i) / f.nx, j = fila % f.ny, k = (fila - j) / f.ny;
  return {
    punto: [f.x0 + (i + 0.5) * f.cellMm, f.y0 + (j + 0.5) * f.cellMm, f.z0 + (k + 0.5) * f.cellMm],
    valor: mejor,
  };
}

const s1 = (x: number) => (x >= 100 ? x.toFixed(0) : x.toFixed(1));

/**
 * LA PASADA ÚNICA. Corre el campo una vez y devuelve las tres lecturas.
 * Es puro: misma malla ⇒ mismos números. No toca el DOM ni three.js.
 */
export function lentesDelFoco(mesh: MeshLike, o?: OpcionesLentes): LentesFoco {
  const mat = o?.material ?? ABS_KAZMER;
  const t0 = Date.now();
  const f = flowFieldFromMesh(mesh, { maxVoxels: o?.maxVoxels ?? 90_000, gateMm: o?.gateMm });
  const msCampo = Date.now() - t0;

  const t1 = Date.now();
  const P = mesh.positions as Float32Array;
  const nv = P.length / 3;
  let huecos = 0;
  for (let i = 0; i < f.cavity.length; i++) if (f.cavity[i]) huecos++;

  // ── el tiempo de enfriamiento por vóxel: Eq 9.5 sobre el espesor LOCAL ─────
  const tcVox = new Float32Array(f.thicknessMm.length);
  for (let i = 0; i < tcVox.length; i++) {
    tcVox[i] = f.cavity[i] ? coolingTimePlate(f.thicknessMm[i] / 1000, mat) : NaN;
  }

  const lentes: Lente[] = [];
  /** el nominal de la pieza — se calcula UNA vez y lo usan dos lentes */
  let paredNominal = 0;

  // ══ LENTE 1 · PARED — MEDIDA (cian) ═══════════════════════════════════════
  {
    const { val, sinDato } = muestrearEnVertices(f, P, f.thicknessMm);
    const q = cuantiles(val);
    const nominal = q.p50;
    paredNominal = nominal;
    // LA RAMPA SE CORTA EN EL UMBRAL DEL LIBRO. Arriba de 1.25× el nominal manda
    // el ÁMBAR, así que si la rampa siguiera hasta p95 su color de tope no se
    // pintaría NUNCA — la leyenda enseñaría un cian que no existe en la pieza.
    // Lo cazó el gate del invariante «la leyenda describe lo pintado»; el beneficio
    // extra es que el cian completo se reparte entre lo que SÍ está en norma.
    const umbral = nominal > 0 ? nominal * 1.25 : Infinity;
    const escBruta = escalaDe(q);
    const esc = { lo: escBruta.lo, hi: Math.max(escBruta.lo + 1e-6, Math.min(escBruta.hi, umbral)) };
    const colores = new Float32Array(nv * 3);
    let gruesos = 0, conDato = 0;
    for (let v = 0; v < nv; v++) {
      const h = val[v];
      let c: [number, number, number];
      if (!Number.isFinite(h)) c = [0.25, 0.28, 0.32];
      else {
        conDato++;
        if (nominal > 0 && h / nominal > 1.25) {
          // §2.3.1: la pared pareja es el primer gate del libro. Lo que se pasa de
          // 1.25× exige atención — de ahí salen rechupe, alabeo y ciclo largo.
          c = AMBAR; gruesos++;
        } else c = colorDe(RAMPA_MEDIDO, h, esc, GAMMA_MEDIDO);
      }
      colores[v * 3] = c[0]; colores[v * 3 + 1] = c[1]; colores[v * 3 + 2] = c[2];
    }
    const gordo = puntoDelMaximo(f, f.thicknessMm);
    const maxCampo = gordo?.valor ?? q.max;
    const desbalance = nominal > 0 ? maxCampo / nominal : 1;
    const pct = conDato ? (100 * gruesos) / conDato : 0;
    lentes.push({
      id: 'pared', nombre: 'PARED', que: 'el espesor local de tu pieza, medido de la geometría',
      unidad: 'mm', origen: 'medido', colores, valores: val, ...q, maxCampo, escala: esc,
      // La parada del NOMINAL se fusiona con la del piso cuando caen en el mismo
      // color. No es cosmética: en toda pieza real la mediana ES el mínimo (la
      // esfera de HR aplana el piso), así que "lo más delgado" y "el nominal"
      // salían del mismo hex — una leyenda con dos paradas iguales no es leyenda.
      // Lo cazó el gate; la respuesta honesta es DECIRLO, no inventar dos colores.
      paradas: (() => {
        const tNom = (nominal - esc.lo) / (esc.hi - esc.lo);
        const juntos = tNom < 0.04;
        return [
          { v: esc.lo, hex: rgbHex(colorDe(RAMPA_MEDIDO, esc.lo, esc, GAMMA_MEDIDO)),
            etiqueta: juntos ? 'lo más delgado — y el NOMINAL de tu pieza' : 'lo más delgado' },
          ...(juntos ? [] : [{ v: nominal, hex: rgbHex(colorDe(RAMPA_MEDIDO, nominal, esc, GAMMA_MEDIDO)), etiqueta: 'el nominal de tu pieza' }]),
          { v: esc.hi, hex: rgbHex(colorDe(RAMPA_MEDIDO, esc.hi, esc, GAMMA_MEDIDO)),
            etiqueta: 'hasta aquí sigue en norma' },
          { v: umbral, hex: rgbHex(AMBAR), etiqueta: 'de aquí arriba se pasa · §2.3.1' },
        ];
      })(),
      titular: pct >= 1
        ? `El ${pct.toFixed(0)} % de tu pieza se pasa de 1.25× el nominal — hasta ${s1(maxCampo)} mm contra ${s1(nominal)}.`
        : desbalance > 1.25
          ? `Tu pared es pareja casi toda: solo el ${pct.toFixed(1)} % se pasa, pero llega a ${s1(maxCampo)} mm.`
          : `Tu pared es pareja: ${s1(nominal)} mm de nominal, entre ${s1(q.min)} y ${s1(maxCampo)}.`,
      cuerpo: pct > 0
        ? `Lo ámbar es lo que se pasa de 1.25× el nominal. Ahí se junta material: se enfría tarde, `
          + `se hunde al contraerse y jala la pieza. Es el primer gate del libro (§2.3.1) porque de la `
          + `pared heredan el llenado, la contracción y el ciclo — arreglarla arregla las tres.`
        : `Una pared pareja es lo que el libro pide primero (§2.3.1): el frente llega parejo, la `
          + `contracción es pareja y el ciclo lo manda una sola cifra en vez de un punto suelto.`,
      peor: gordo, ref: '§2.3.1 · espesor local (Hildebrand–Rüegsegger)', sinDato,
    });
  }

  // ══ LENTE 2 · ENFRIAMIENTO — SIMULADA (violeta) ═══════════════════════════
  {
    const { val, sinDato } = muestrearEnVertices(f, P, tcVox);
    const q = cuantiles(val);
    const esc = escalaDe(q);
    const colores = new Float32Array(nv * 3);
    for (let v = 0; v < nv; v++) {
      const t = val[v];
      const c: [number, number, number] = !Number.isFinite(t)
        ? [0.25, 0.28, 0.32]
        : colorDe(RAMPA_SIMULADO, t, esc, GAMMA_SIMULADO);
      colores[v * 3] = c[0]; colores[v * 3 + 1] = c[1]; colores[v * 3 + 2] = c[2];
    }
    const manda = puntoDelMaximo(f, tcVox);
    const tcMax = manda?.valor ?? q.max;
    // el espesor que produce ese t_c — se despeja de la misma Eq 9.5, no se busca aparte
    const kEq = Math.log((4 / Math.PI) * ((mat.tMelt - mat.tCoolant) / (mat.tEject - mat.tCoolant))) / (Math.PI * Math.PI * mat.alpha);
    const hMax = kEq > 0 ? Math.sqrt(tcMax / kEq) * 1000 : 0;
    const veces = q.p50 > 0 ? tcMax / q.p50 : 1;
    lentes.push({
      id: 'enfriamiento', nombre: 'ENFRIAMIENTO', que: 'cuánto tarda cada punto en poder salir del molde',
      unidad: 's', origen: 'simulado', colores, valores: val, ...q, maxCampo: tcMax, escala: esc,
      paradas: [
        { v: esc.lo, hex: rgbHex(colorDe(RAMPA_SIMULADO, esc.lo, esc, GAMMA_SIMULADO)), etiqueta: 'lista primero' },
        { v: (esc.lo + esc.hi) / 2, hex: rgbHex(colorDe(RAMPA_SIMULADO, (esc.lo + esc.hi) / 2, esc, GAMMA_SIMULADO)), etiqueta: 'a medio camino' },
        { v: esc.hi, hex: rgbHex(colorDe(RAMPA_SIMULADO, esc.hi, esc, GAMMA_SIMULADO)), etiqueta: `tarde (p95) · el peor: ${s1(tcMax)} s` },
      ],
      titular: `El ciclo lo manda un solo punto: ${s1(tcMax)} s. El resto está listo en ${s1(q.p50)} s.`,
      cuerpo: `El molde no abre hasta que el ÚLTIMO punto está firme, así que ese máximo es tu ciclo, `
        + `no el promedio. Ese punto tarda ${veces.toFixed(1)}× más que la mitad de la pieza`
        + (hMax > 0 ? `, porque ahí la pared llega a ${s1(hMax)} mm` : '')
        + `. El tiempo va con el CUADRADO del espesor (Eq 9.5): bajarle 30 % a ese macizo te quita `
        + `la mitad del ciclo. Enfriar más fuerte casi no ayuda — el cuello es el plástico, no el agua.`,
      peor: manda, ref: '§9.2 · Eq 9.5, t_c = h²/(π²α)·ln(4/π·ΔT)', sinDato,
    });
  }

  // ══ LENTE 3 · LLENADO — SIMULADA (violeta) ════════════════════════════════
  {
    // `flowLenMm` trae Infinity en lo inalcanzable, y `cuantiles` ya los filtra
    // (Number.isFinite). Aquí se pintan de ROJO: un punto sin camino a la
    // compuerta es un short shot, no "el extremo de la rampa".
    const { val, sinDato } = muestrearEnVertices(f, P, f.flowLenMm);
    const q = cuantiles(val);
    const esc = escalaDe(q);
    const colores = new Float32Array(nv * 3);
    for (let v = 0; v < nv; v++) {
      const L = val[v];
      let c: [number, number, number];
      if (Number.isNaN(L)) c = [0.25, 0.28, 0.32];
      else if (!Number.isFinite(L)) c = ROJO;
      else c = colorDe(RAMPA_SIMULADO, L, esc, GAMMA_SIMULADO);
      colores[v * 3] = c[0]; colores[v * 3 + 1] = c[1]; colores[v * 3 + 2] = c[2];
    }
    const ultimo = puntoDelMaximo(f, f.flowLenMm);
    // L/t — la razón que decide la presión (§5.5.5). El espesor es el NOMINAL de la
    // lente de pared, no un cuantil del vóxel crudo (ahí el acero mete ceros).
    const lMax = ultimo?.valor ?? q.max;
    const razon = paredNominal > 0 ? lMax / paredNominal : 0;
    lentes.push({
      id: 'llenado', nombre: 'LLENADO', que: 'qué tan lejos tiene que correr el fundido para llegar ahí',
      unidad: 'mm', origen: 'simulado', colores, valores: val, ...q, maxCampo: lMax, escala: esc,
      paradas: [
        { v: esc.lo, hex: rgbHex(colorDe(RAMPA_SIMULADO, esc.lo, esc, GAMMA_SIMULADO)), etiqueta: 'cerca de la compuerta' },
        { v: (esc.lo + esc.hi) / 2, hex: rgbHex(colorDe(RAMPA_SIMULADO, (esc.lo + esc.hi) / 2, esc, GAMMA_SIMULADO)), etiqueta: 'a media pieza' },
        { v: esc.hi, hex: rgbHex(colorDe(RAMPA_SIMULADO, esc.hi, esc, GAMMA_SIMULADO)), etiqueta: `lejos (p95) · el último: ${s1(lMax)} mm` },
        ...(f.unreachable > 0 ? [{ v: 0, hex: rgbHex(ROJO), etiqueta: 'SIN camino a la compuerta' }] : []),
      ],
      titular: f.unreachable > 0
        ? `${f.unreachable} punto(s) NO tienen camino a la compuerta: eso es un short shot (§5.5).`
        : `El fundido corre hasta ${s1(lMax)} mm desde la compuerta para llegar al punto más lejano.`,
      cuerpo: `La distancia NO es en línea recta: el frente rodea cada agujero, costilla y pozo, `
        + `igual que el plástico real. Lo claro es lo último en llenarse — ahí caen las líneas de `
        + `soldadura y ahí se queda el aire si no hay venteo. La relación L/espesor (${razon.toFixed(0)}:1) `
        + `es la que decide la presión que necesitas (§5.5.5): pasada de ~150:1 hay que mover la compuerta.`,
      peor: ultimo, ref: '§5.5.5 · L geodésica por el hueco (Dijkstra 26-vecinos)', sinDato,
    });
  }

  const msLentes = Date.now() - t1;
  return {
    lentes,
    campo: {
      celdaMm: f.cellMm, huecos, nx: f.nx, ny: f.ny, nz: f.nz,
      volumenCm3: f.volumeMm3 / 1000, inalcanzables: f.unreachable, avisos: f.warnings,
    },
    ms: { campo: msCampo, lentes: msLentes, total: msCampo + msLentes },
  };
}
