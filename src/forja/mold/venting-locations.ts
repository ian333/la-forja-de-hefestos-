/**
 * UBICACIONES DE VENTEO — dónde va cada venteo, sacado del CAMPO DE FLUJO.
 * ============================================================================
 * Kazmer §8.2.2 nombra TRES lugares donde el aire queda atrapado, y ninguno se
 * elige a ojo: los tres EMERGEN del mismo campo que ya calcula `flowlen.ts`.
 *
 *   1. FINAL DE FLUJO — el último punto en llenarse. NO es el más lejano: es el de
 *      MAYOR RESISTENCIA (§5.5.5 race tracking: una pared gruesa lejana se llena
 *      antes que una delgada cercana). Por eso se enumeran los máximos locales de
 *      `resistance`, no de `flowLenMm`. Elegir por distancia manda el venteo al
 *      lugar equivocado en cuanto la pared no es uniforme.
 *
 *   2. CONVERGENCIA DE FRENTES (knit-line) — donde chocan dos frentes, el aire
 *      queda pinzado entre ellos. `computeWeldMask` ya marca esos vóxeles.
 *
 *   3. BOLSA MUERTA — hueco rodeado de material que se llena por todos lados a la
 *      vez. Se detecta como un máximo local de resistencia cuyos vecinos alcanzables
 *      son TODOS de menor resistencia en las 6 direcciones (no solo en una).
 *
 * EL ENTREGABLE SON DOS LISTAS (§8.1): los venteos que se MAQUINAN ahora y los
 * RESERVADOS — ubicaciones válidas que se dejan documentadas para abrirlas tras el
 * tryout si aparece quemado. El libro saca ~36 candidatos en el bezel y maquina 8:
 * la diferencia no se tira, se archiva. Un molde sin la lista de reservados obliga a
 * re-derivar el análisis cuando el tryout pide un venteo más.
 *
 * PURO → node-testeable. No conoce figuras: lee el campo.
 */

import type { FlowField } from './flowlen';

export type TipoVenteo = 'fin-de-flujo' | 'soldadura' | 'bolsa-muerta';

export interface CandidatoVenteo {
  /** posición en coords de placa (mm) */
  x: number; y: number; z: number;
  tipo: TipoVenteo;
  /** resistencia acumulada en ese punto (∝ ΔP) — el orden REAL de llenado */
  resistencia: number;
  /** longitud de flujo recorrida hasta ahí (mm) */
  flowLenMm: number;
  /** fracción del volumen ya llena cuando el frente llega aquí (0-1) */
  fracLlenado: number;
  /** cuántos vóxeles agrupó este candidato (tamaño de la zona) */
  voxeles: number;
  /** prioridad 0-1: 1 = el último en llenarse (el venteo más necesario) */
  prioridad: number;
}

export interface PlanVenteo {
  /** los que se MAQUINAN ahora, ordenados por prioridad */
  maquinar: CandidatoVenteo[];
  /** los RESERVADOS: válidos, documentados, se abren en el tryout si hay quemado (§8.1) */
  reservados: CandidatoVenteo[];
  /** total de candidatos enumerados antes de cortar */
  nCandidatos: number;
  notas: string[];
}

/** Vecinos 6-conexos (caras). Para "¿es máximo local?" las caras bastan y no
 *  inflan el conteo con diagonales que ya cubre otro candidato. */
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;

/**
 * ENUMERA los candidatos de venteo del campo de flujo (§8.2.2).
 *
 * `weld` es la máscara de `computeWeldMask` (opcional: sin varias compuertas no hay
 * líneas de soldadura de compuertas distintas). `clusterMm` agrupa candidatos vecinos
 * para no reportar 400 vóxeles de la misma esquina — el default 8 mm es del orden del
 * ancho de venteo típico (§8.3.1: los venteos son anchos, ~6-12 mm).
 */
export function enumerarVenteos(f: FlowField, o?: {
  weld?: Uint8Array;
  /** radio de agrupamiento (mm). Default 8. */
  clusterMm?: number;
  /** solo considerar el N % superior de resistencia como final de flujo. Default 0.15. */
  colaSuperior?: number;
  /** cuántos maquinar (el resto queda RESERVADO §8.1). Default 8 (el bezel del libro). */
  nMaquinar?: number;
}): PlanVenteo {
  const clusterMm = o?.clusterMm ?? 8;
  const cola = o?.colaSuperior ?? 0.15;
  const nMaquinar = o?.nMaquinar ?? 8;
  const notas: string[] = [];

  // ── El umbral de "final de flujo": la cola superior de RESISTENCIA ────────
  // (no de distancia — §5.5.5: el race tracking desacopla las dos)
  const res: number[] = [];
  for (let t = 0; t < f.cavity.length; t++) {
    if (f.cavity[t] && Number.isFinite(f.resistance[t])) res.push(f.resistance[t]);
  }
  if (!res.length) {
    return { maquinar: [], reservados: [], nCandidatos: 0, notas: ['campo vacío: no hay hueco alcanzable'] };
  }
  res.sort((a, b) => a - b);
  const umbral = res[Math.floor((1 - cola) * (res.length - 1))];
  const rMax = res[res.length - 1];

  /** fracción del volumen llena cuando el frente va en `r` (búsqueda binaria) */
  const fracAt = (r: number): number => {
    let lo = 0, hi = res.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (res[m] <= r) lo = m + 1; else hi = m; }
    return lo / res.length;
  };

  // ── 1+3) Máximos locales de resistencia: fin de flujo y bolsas muertas ────
  // Un vóxel es máximo local si NINGÚN vecino alcanzable tiene MÁS resistencia.
  // Si además está rodeado por vecinos de menor resistencia en TODAS las
  // direcciones con hueco (≥4 de 6), el frente lo cerró por varios lados: bolsa.
  const bruto: Array<{ i: number; j: number; k: number; t: number; tipo: TipoVenteo }> = [];
  for (let k = 0; k < f.nz; k++) for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) {
    const t = f.idx(i, j, k);
    if (!f.cavity[t] || !Number.isFinite(f.resistance[t])) continue;
    if (f.resistance[t] < umbral) continue;
    let esMax = true, vecinosHueco = 0, vecinosMenores = 0;
    for (const [di, dj, dk] of N6) {
      const a = i + di, b = j + dj, c = k + dk;
      if (a < 0 || b < 0 || c < 0 || a >= f.nx || b >= f.ny || c >= f.nz) continue;
      const u = f.idx(a, b, c);
      if (!f.cavity[u] || !Number.isFinite(f.resistance[u])) continue;
      vecinosHueco++;
      if (f.resistance[u] > f.resistance[t]) { esMax = false; break; }
      if (f.resistance[u] < f.resistance[t]) vecinosMenores++;
    }
    if (!esMax) continue;
    // bolsa muerta: cerrado por ≥4 lados con hueco (el frente lo envolvió)
    const tipo: TipoVenteo = (vecinosHueco >= 4 && vecinosMenores >= 4) ? 'bolsa-muerta' : 'fin-de-flujo';
    bruto.push({ i, j, k, t, tipo });
  }

  // ── 2) Convergencias de frentes (knit-lines) — §8.2.2 ────────────────────
  // De la máscara de soldadura se toman los máximos locales de resistencia DENTRO
  // de la máscara: el punto de la soldadura donde el aire queda pinzado al final.
  if (o?.weld) {
    const w = o.weld;
    for (let k = 0; k < f.nz; k++) for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) {
      const t = f.idx(i, j, k);
      if (!w[t] || !f.cavity[t] || !Number.isFinite(f.resistance[t])) continue;
      let esMax = true;
      for (const [di, dj, dk] of N6) {
        const a = i + di, b = j + dj, c = k + dk;
        if (a < 0 || b < 0 || c < 0 || a >= f.nx || b >= f.ny || c >= f.nz) continue;
        const u = f.idx(a, b, c);
        if (!w[u] || !f.cavity[u] || !Number.isFinite(f.resistance[u])) continue;
        if (f.resistance[u] > f.resistance[t]) { esMax = false; break; }
      }
      if (esMax) bruto.push({ i, j, k, t, tipo: 'soldadura' });
    }
  } else {
    notas.push('sin máscara de soldadura: las convergencias de frentes NO se enumeraron (§8.2.2 pide venteo en cada knit-line)');
  }

  // ── AGRUPAR: un candidato por zona, no un candidato por vóxel ────────────
  // Se procesan de MAYOR a menor resistencia para que el representante de cada
  // zona sea su punto más tardío (el que realmente necesita el venteo).
  bruto.sort((a, b) => f.resistance[b.t] - f.resistance[a.t]);
  const rCluster = clusterMm / f.cellMm;
  const tomados: Array<{ i: number; j: number; k: number; t: number; tipo: TipoVenteo; n: number }> = [];
  for (const c of bruto) {
    let cerca = null;
    for (const g of tomados) {
      const d = Math.hypot(c.i - g.i, c.j - g.j, c.k - g.k);
      if (d <= rCluster) { cerca = g; break; }
    }
    // una soldadura NO se absorbe en un fin-de-flujo: son defectos distintos y el
    // libro pide venteo en los dos (§8.2.2). Solo agrupa con su mismo tipo.
    if (cerca && cerca.tipo === c.tipo) { cerca.n++; continue; }
    if (cerca && cerca.tipo !== c.tipo) {
      const mismoTipo = tomados.find((g) =>
        g.tipo === c.tipo && Math.hypot(c.i - g.i, c.j - g.j, c.k - g.k) <= rCluster);
      if (mismoTipo) { mismoTipo.n++; continue; }
    }
    tomados.push({ ...c, n: 1 });
  }

  const candidatos: CandidatoVenteo[] = tomados.map((g) => {
    const r = f.resistance[g.t];
    return {
      x: +(f.x0 + (g.i + 0.5) * f.cellMm).toFixed(2),
      y: +(f.y0 + (g.j + 0.5) * f.cellMm).toFixed(2),
      z: +(f.z0 + (g.k + 0.5) * f.cellMm).toFixed(2),
      tipo: g.tipo,
      resistencia: +r.toFixed(4),
      flowLenMm: +f.flowLenMm[g.t].toFixed(2),
      fracLlenado: +fracAt(r).toFixed(4),
      voxeles: g.n,
      prioridad: +(rMax > 0 ? r / rMax : 0).toFixed(4),
    };
  });

  // ordenar por prioridad: primero lo último en llenarse (§8.2.2 el aire se acumula ahí)
  candidatos.sort((a, b) => b.prioridad - a.prioridad);

  const maquinar = candidatos.slice(0, nMaquinar);
  const reservados = candidatos.slice(nMaquinar);
  const porTipo = (l: CandidatoVenteo[]) => {
    const c: Record<string, number> = {};
    for (const x of l) c[x.tipo] = (c[x.tipo] ?? 0) + 1;
    return Object.entries(c).map(([k, v]) => `${v} ${k}`).join(', ') || 'ninguno';
  };
  notas.push(`${candidatos.length} candidatos (${porTipo(candidatos)}) → maquinar ${maquinar.length}, reservar ${reservados.length}`);
  if (reservados.length) {
    notas.push(`§8.1: los ${reservados.length} reservados NO se tiran — se documentan para abrirlos en el tryout si aparece quemado`);
  }
  if (!maquinar.length) notas.push('ningún candidato: revisar el campo (¿la cavidad es alcanzable desde la compuerta?)');

  return { maquinar, reservados, nCandidatos: candidatos.length, notas };
}
