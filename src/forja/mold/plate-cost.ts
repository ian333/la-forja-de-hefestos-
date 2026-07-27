/**
 * COSTO POR PLACA — EXTENSIÓN NUESTRA, no una cita del libro.
 * ============================================================================
 * "cada placa individual debe de cotizarse, estoy 100% seguro de que el libro lo pone
 *  así" (user 2026-07-16). Fui a verificar y **el libro NO lo pone así**:
 *
 *   §3.3.2 · Eq 3.15:  C_mold_base = $830 + M·κ_acero
 *
 * UNA fórmula para TODO el mold base, con M estadística sobre L/W/H del bloque. Sin
 * desglose por placa. Y no es descuido: el libro asume que el mold base **se COMPRA
 * armado** (DME, HASCO) — no lo cortas placa por placa, lo pides del catálogo. Lo que el
 * libro SÍ desglosa son los INSERTOS (§3.3.1: material + maquinado + acabado), porque
 * esos sí los maquina el moldero.
 * Prueba de que esa lectura es correcta: la Eq 3.15 tal cual reproduce el ejemplo del
 * laptop bezel AL DÓLAR ($3,700 de base dentro de los $74,800 totales).
 *
 * PERO el instinto del user apunta a algo REAL: en LATAM nadie pide un DME armado — se
 * compra acero y se corta. Un taller mexicano necesita ver "placa A: $X, placa B: $Y".
 * Ahí es justo donde le ganamos a SolidWorks para este mercado.
 *
 * POR ESO ESTE ARCHIVO EXISTE, Y POR ESO SE LLAMA EXTENSIÓN:
 *  · reparte el costo de la Eq 3.15 entre las placas REALES (`plateDefs`), por su masa
 *    y su acero — cada una con su volumen y su κ.
 *  · **LA SUMA CUADRA CON LA Eq 3.15**. Ese es el contrato: el desglose informa, no
 *    reinventa. Si la suma se despegara del libro, el ancla del bezel se rompería y
 *    tendríamos dos verdades — el pecado que llevamos toda la sesión cazando.
 *  · el $830 fijo (utillaje/setup del mold base, no acero) se reparte a PRORRATA de masa:
 *    inventarle otro reparto sería inventar.
 *
 * Etiquetar esto como "Kazmer" sería fabricar una cita. Es NUESTRO, y lo dice.
 */
import type { MoldAssemblySpec } from './mold-assembly';
import { plateDefs, plateDepth } from './mold-drawing-set';
import { MOLD_STEEL_COEF } from './moldcost-detailed';

/** densidad del acero de molde (kg/m³) — la misma que usa `moldbase.ts` para el P20. */
const RHO_STEEL = 7850;

/** κ por acero (Tabla 3.7 DME, $/kg). Los aceros de placa que no están en la tabla del
 *  libro caen al más cercano y lo DECLARAN: no se inventa un coeficiente. */
function coefOf(mat: string): { k: number; nota: string } {
  const t = MOLD_STEEL_COEF as Record<string, number>;
  if (t[mat] != null) return { k: t[mat], nota: 'Tabla 3.7 (fila exacta)' };
  if (/P20/i.test(mat)) return { k: t['AISI P20'], nota: 'Tabla 3.7 · AISI P20' };
  if (/4130|4140/i.test(mat)) return { k: t['AISI 4130'], nota: 'Tabla 3.7 · AISI 4130' };
  // 1.1730 (C45), SAE 1030… aceros de base sin templar
  return { k: t['SAE 1030'], nota: `Tabla 3.7 · SAE 1030 — "${mat}" no está en la tabla del libro: se usa el acero de base equivalente` };
}

export interface PlateCost {
  role: string; code: string; name: string;
  mat: string; matNota: string;
  thickMm: number; volumeCm3: number; massKg: number;
  /** $/kg del acero (Tabla 3.7) */
  coefUSDkg: number;
  /** acero de ESTA placa = masa × κ */
  steelUSD: number;
  /** parte del $830 de utillaje del mold base (§3.3.2), a prorrata de masa */
  setupUSD: number;
  USD: number;
  pctOfBase: number;
}

export interface PlateCostBreakdown {
  plates: PlateCost[];
  /** suma del desglose */
  totalUSD: number;
  /** lo que dice la Eq 3.15 (el libro) — el desglose DEBE cuadrar con esto */
  moldBaseEq315USD: number;
  /** |suma − Eq 3.15| / Eq 3.15 */
  errorPct: number;
  massTotalKg: number;
  notas: string[];
}

/**
 * Reparte el costo del mold base (Eq 3.15) entre las placas reales.
 * `moldBaseEq315USD` = el número del LIBRO, que manda. Si no se pasa, se estima con la
 * misma fórmula usando la masa real del stack.
 */
export function plateCosts(spec: MoldAssemblySpec, o?: { moldBaseEq315USD?: number }): PlateCostBreakdown {
  const defs = plateDefs(spec);
  const W = spec.widthMm, D = plateDepth(spec);
  const rows = defs.map((p) => {
    const volCm3 = (W * D * p.thick) / 1000;                    // mm³ → cm³
    const massKg = (volCm3 / 1e6) * RHO_STEEL;                  // cm³ → m³ → kg
    const { k, nota } = coefOf(p.mat);
    return { def: p, volCm3, massKg, k, nota };
  });
  const massTotal = rows.reduce((s, r) => s + r.massKg, 0);

  // EL NÚMERO DEL LIBRO manda. Con κ mixto (cada placa su acero) se usa el promedio
  // ponderado por masa: así la Eq 3.15 se evalúa con el acero REAL del stack.
  const kProm = massTotal > 0 ? rows.reduce((s, r) => s + r.k * r.massKg, 0) / massTotal : 3.55;
  const eq315 = o?.moldBaseEq315USD ?? (830 + massTotal * kProm);

  // el acero de cada placa es su masa × su κ; el $830 (utillaje del mold base, NO acero)
  // se prorratea por masa — cualquier otro reparto sería inventado.
  const aceroTotal = rows.reduce((s, r) => s + r.massKg * r.k, 0);
  const setupTotal = Math.max(0, eq315 - aceroTotal);

  const plates: PlateCost[] = rows.map((r) => {
    const steelUSD = r.massKg * r.k;
    const setupUSD = massTotal > 0 ? setupTotal * (r.massKg / massTotal) : 0;
    const usd = steelUSD + setupUSD;
    return {
      role: r.def.role, code: r.def.code, name: r.def.name,
      mat: r.def.mat, matNota: r.nota,
      thickMm: r.def.thick, volumeCm3: +r.volCm3.toFixed(1), massKg: +r.massKg.toFixed(2),
      coefUSDkg: r.k, steelUSD: +steelUSD.toFixed(2), setupUSD: +setupUSD.toFixed(2),
      USD: +usd.toFixed(2), pctOfBase: +(100 * usd / Math.max(1e-9, eq315)).toFixed(1),
    };
  });
  const total = plates.reduce((s, p) => s + p.USD, 0);

  return {
    plates, totalUSD: +total.toFixed(2),
    moldBaseEq315USD: +eq315.toFixed(2),
    errorPct: +(100 * Math.abs(total - eq315) / Math.max(1e-9, eq315)).toFixed(3),
    massTotalKg: +massTotal.toFixed(1),
    notas: [
      'DESGLOSE POR PLACA = extensión NUESTRA, no del libro. Kazmer §3.3.2 (Eq 3.15) cotiza',
      'el mold base como UN bloque comprado ($830 + M·κ) porque asume DME/HASCO armado.',
      'En LATAM el taller CORTA el acero, así que el costo por placa es lo que el cliente',
      'necesita ver. LA SUMA DE AQUÍ CUADRA CON LA Eq 3.15: el desglose informa, no reinventa.',
      `masa del stack ${massTotal.toFixed(1)} kg · κ promedio ponderado ${kProm.toFixed(2)} $/kg`,
      'el $830 de utillaje del mold base se prorratea por masa (el libro no lo desglosa).',
      'Los INSERTOS van aparte: ésos sí los desglosa el libro (§3.3.1, material+maquinado+acabado).',
    ],
  };
}
