/**
 * ══════════════════════════════════════════════════════════════════════
 *  LECCIÓN 5 — Oscilaciones químicas (Lotka-Volterra)
 *  La química que "respira": retroalimentación y no-equilibrio
 * ══════════════════════════════════════════════════════════════════════
 *
 * Los estudiantes creen que toda reacción tiende al equilibrio
 * monótonamente. FALSO. Con el mecanismo correcto, una reacción puede
 * OSCILAR: subir, bajar, volver a subir, durante horas.
 *
 * El modelo Lotka-Volterra (1910 química, 1926 ecológico) es el ejemplo
 * más limpio. Consta de 3 pasos autocatalíticos:
 *
 *   1)  A + X  →  2X      (la "presa" se reproduce consumiendo reserva A)
 *   2)  X + Y  →  2Y      (el "predador" come presa y se reproduce)
 *   3)     Y  →  B        (el predador muere solo)
 *
 * Con A fija (reservorio infinito), X e Y oscilan cíclicamente.
 *
 * Ejemplos reales de la naturaleza:
 *   - Reacción Belousov-Zhabotinsky (1951) — cambia de color rojo ↔ azul
 *   - Glucólisis (oscilaciones en levaduras)
 *   - Latido cardíaco (modelo de Fitzhugh-Nagumo, primo del anterior)
 */

import { simulate, type ReactionStep } from '@/lib/chem/kinetics';
import { title, board, multiSparkline, table } from './lib/plot';

console.log(title(5, 'Lotka-Volterra — oscilaciones químicas'));

const steps: ReactionStep[] = [
  {
    name: 'A + X → 2X (presa come reserva)',
    reactants: [
      { species: 'A', nu: 1, order: 1 },
      { species: 'X', nu: 1, order: 1 },
    ],
    products:  [{ species: 'X', nu: 2 }],
    A: 1.0, Ea: 0,
  },
  {
    name: 'X + Y → 2Y (predador come presa)',
    reactants: [
      { species: 'X', nu: 1, order: 1 },
      { species: 'Y', nu: 1, order: 1 },
    ],
    products:  [{ species: 'Y', nu: 2 }],
    A: 1.5, Ea: 0,
  },
  {
    name: 'Y → B (predador muere)',
    reactants: [{ species: 'Y', nu: 1, order: 1 }],
    products:  [{ species: 'B', nu: 1 }],
    A: 0.8, Ea: 0,
  },
];

console.log(board(`
  Sistema:
    1)  A + X → 2X    k₁ = 1.0
    2)  X + Y → 2Y    k₂ = 1.5
    3)      Y → B     k₃ = 0.8

  Con A en reserva (100 M) e X, Y pequeños, el sistema oscila.
  Esto NO es un equilibrio — es un atractor cíclico.
`));

const traj = simulate(
  steps,
  300,
  { A: 100, X: 1.0, Y: 1.0, B: 0 },
  0.01,
  6000,    // 60 s simulados
);

// Encontrar los picos de X y Y
const peaks = { X: [] as number[], Y: [] as number[] };
for (const sp of ['X', 'Y'] as const) {
  const arr = traj.C[sp];
  for (let i = 2; i < arr.length - 2; i++) {
    if (arr[i] > arr[i - 1] && arr[i] > arr[i + 1] && arr[i] > arr[i - 2] && arr[i] > arr[i + 2]) {
      peaks[sp].push(traj.t[i]);
    }
  }
}

const periodX = peaks.X.length >= 2
  ? peaks.X.slice(1).map((t, i) => t - peaks.X[i])
  : [];
const avgPeriodX = periodX.length > 0
  ? periodX.reduce((s, v) => s + v, 0) / periodX.length
  : 0;

console.log(`  Picos detectados en X: ${peaks.X.length}`);
console.log(`  Picos detectados en Y: ${peaks.Y.length}`);
console.log(`  Período medio de X: ${avgPeriodX.toFixed(2)} s`);
console.log(`  [X] max observado:  ${Math.max(...traj.C.X).toFixed(2)} M`);
console.log(`  [Y] max observado:  ${Math.max(...traj.C.Y).toFixed(2)} M`);

console.log('\n  Trayectorias (60 s, sparkline):');
console.log(multiSparkline({
  'X (presa)':    traj.C.X,
  'Y (predador)': traj.C.Y,
  'B (cadáver)':  traj.C.B,
}, 72));

// Tabla de snapshots cerca del primer ciclo
const snaps = [0, 1, 2, 4, 6, 8, 10, 15, 20, 30, 45, 60];
const rows = snaps.map((t) => {
  const idx = Math.round(t / 0.01);
  return {
    't (s)': t,
    'A': traj.C.A[idx],
    'X': traj.C.X[idx],
    'Y': traj.C.Y[idx],
    'B': traj.C.B[idx],
  };
});
console.log('\n  Snapshots en el tiempo:\n');
console.log(table(rows));

console.log(board(`
  Lecciones:

  1. UN INTEGRADOR COMÚN (RK4) maneja sistemas NO lineales y oscilantes
     sin romperse, siempre que dt sea pequeño respecto al período.

  2. En nuestro motor, NO hubo que programar "nada especial" para
     obtener oscilaciones. Emergen del acoplamiento no-lineal de 3
     reacciones elementales. Así es la realidad.

  3. El sistema NO alcanza equilibrio mientras A > 0. Alcanza un
     atractor periódico. Cuando A se agota, las oscilaciones mueren.

  4. Variando k₂ (tasa de predación) puedes ver:
       - Si sube → ciclos más rápidos pero menos amplitud
       - Si baja → ciclos amplios, Y casi se extingue
     Es el ABC de la dinámica de poblaciones.

  Ejercicio:
    - Aumenta [A] inicial a 500. ¿Cambia el período?
    - Pon A=100 pero [X]=0.01, [Y]=0.01. ¿Cambia la fase pero no el período?
    - Agrega un cuarto paso B → A para "reciclar" y ver oscilaciones eternas.
`));
