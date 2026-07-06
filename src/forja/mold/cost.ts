/**
 * COSTOS DEL MOLDE Y BREAK-EVEN — Kazmer cap 3 "Mold Cost Estimation"
 * ====================================================================
 * LA pregunta de negocio: ¿cuándo conviene la COLADA CALIENTE? El hot runner
 * multiplica el costo del molde (tabla 3.1: $10k cold 2-cav vs $250k hot
 * 32-cav) pero baja el costo marginal por pieza — el break-even (Eq 3.1)
 * dice el volumen de producción donde se cruza. Ejemplo del libro: 615,000
 * piezas (p.41).
 */

export interface MoldOption {
  name: string;
  /** Costo FIJO: molde + mantenimiento (USD). */
  fixedCost: number;
  /** Costo MARGINAL por pieza: resina + máquina + labor + energía (USD). */
  marginalCost: number;
  cavities?: number;
  cycleTimeS?: number;
}

/** Eq (3.1): costo total de producir n piezas. */
export const totalCost = (o: MoldOption, n: number): number => o.fixedCost + n * o.marginalCost;

/** Break-even entre dos opciones (piezas). Infinity si la 2ª nunca alcanza. */
export function breakEven(a: MoldOption, b: MoldOption): number {
  const dFixed = b.fixedCost - a.fixedCost;
  const dMarg = a.marginalCost - b.marginalCost;
  if (dMarg <= 0) return Infinity;
  return dFixed / dMarg;
}

/** Decisión: la opción más barata para el volumen n + reporte. */
export function chooseMold(options: MoldOption[], n: number): { best: MoldOption; report: string[] } {
  let best = options[0];
  for (const o of options) if (totalCost(o, n) < totalCost(best, n)) best = o;
  const report = options.map((o) =>
    `${o.name}: fijo $${o.fixedCost.toLocaleString()} + $${o.marginalCost}/pza → total $${totalCost(o, n).toLocaleString()} @${n.toLocaleString()} pzas${o === best ? '  ← MEJOR' : ''}`);
  return { best, report };
}

/** Costo por pieza amortizado (tabla 3.1 del libro): fijo/n + marginal. */
export const costPerPart = (o: MoldOption, n: number): number => o.fixedCost / n + o.marginalCost;
