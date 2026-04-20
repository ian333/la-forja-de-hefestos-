/**
 * ══════════════════════════════════════════════════════════════════════
 *  LECCIÓN 2 — Vida media: la firma de una reacción de primer orden
 * ══════════════════════════════════════════════════════════════════════
 *
 * Punto didáctico: en una reacción de primer orden, la vida media
 * NO depende de la concentración inicial — es solo función de k.
 * Esto es contra-intuitivo (uno esperaría que "más sustancia = más tiempo
 * para consumirse") pero es matemática pura.
 *
 * Lo demostramos con el experimento histórico de Daniels & Johnston 1921:
 *
 *   2 N₂O₅  →  4 NO₂  +  O₂
 */

import { R_N2O5_DECOMP } from '@/lib/chem/reactions';
import { simulate, arrhenius } from '@/lib/chem/kinetics';
import { title, board, table, asciiPlot } from './lib/plot';

console.log(title(2, 'Vida media — Daniels & Johnston, 1921'));

console.log(board(`
Reacción: 2 N₂O₅ → 4 NO₂ + O₂

Ley de velocidad (experimental, primer orden en N₂O₅):
    d[N₂O₅]
   ──────── = -k·[N₂O₅]
      dt

Solución: [N₂O₅](t) = [N₂O₅]₀ · exp(-k·t)

Vida media:  t½ = ln(2) / k

El dato: k a 65 °C es ~${arrhenius(R_N2O5_DECOMP.steps[0].A, R_N2O5_DECOMP.steps[0].Ea, 338).toExponential(2)} s⁻¹
`));

// Simulamos 3 veces con DIFERENTES concentraciones iniciales
const C0s = [0.5, 1.0, 2.0, 4.0];
const rows: Record<string, string | number>[] = [];

for (const c0 of C0s) {
  const traj = simulate(
    R_N2O5_DECOMP.steps,
    R_N2O5_DECOMP.T,
    { N2O5: c0, NO2: 0, O2: 0 },
    R_N2O5_DECOMP.dt,
    Math.round(R_N2O5_DECOMP.duration / R_N2O5_DECOMP.dt),
  );
  // Encontrar t½: primer t donde C ≤ C₀/2
  const half = c0 / 2;
  let tHalf = -1;
  for (let i = 0; i < traj.t.length; i++) {
    if (traj.C.N2O5[i] <= half) {
      tHalf = traj.t[i];
      break;
    }
  }
  rows.push({
    '[N₂O₅]₀ (M)': c0,
    '[N₂O₅]₀/2 (M)': half.toFixed(3),
    't½ medido (s)': tHalf,
    't½ / C₀': tHalf / c0,
  });
}

console.log('\n  Medimos vida media con 4 concentraciones iniciales distintas:\n');
console.log(table(rows));

console.log(board(`
  ¿Qué observamos?

  La vida media (t½) es prácticamente la misma en las 4 simulaciones —
  aunque arrancamos con 0.5 M, 1 M, 2 M y 4 M. Eso es LA FIRMA de una
  reacción de primer orden.

  Para una reacción de orden ≠ 1, t½ SÍ depende de C₀:
      Orden 0:  t½ = C₀ / (2k)           (proporcional a C₀)
      Orden 1:  t½ = ln(2) / k            (independiente de C₀)
      Orden 2:  t½ = 1 / (k · C₀)         (inversamente proporcional)

  Medir t½ en distintas C₀ es cómo los químicos determinan el orden
  experimentalmente — sin tocar Arrhenius ni derivar ecuaciones.
`));

// Graficar decaimiento con C₀=1 M
const traj1 = simulate(
  R_N2O5_DECOMP.steps,
  R_N2O5_DECOMP.T,
  { N2O5: 1.0, NO2: 0, O2: 0 },
  R_N2O5_DECOMP.dt,
  Math.round(R_N2O5_DECOMP.duration / R_N2O5_DECOMP.dt),
);

console.log('\n  Decaimiento [N₂O₅] vs t (65°C, 30 min):');
console.log(asciiPlot(traj1.t, traj1.C.N2O5, {
  width: 68,
  height: 12,
  label: '[N₂O₅] en M    (eje x = t en s)',
}));
