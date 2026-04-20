/**
 * ══════════════════════════════════════════════════════════════════════
 *  LECCIÓN 4 — El intermediario fugaz: reacciones en serie A → B → C
 * ══════════════════════════════════════════════════════════════════════
 *
 * Muchos procesos naturales pasan por un intermediario que aparece y
 * desaparece:
 *   - Fermentación:  azúcar → piruvato → etanol
 *   - Fotosíntesis:  CO₂ → 3-PGA → glucosa (ciclo de Calvin)
 *   - Farmacología:  profármaco → fármaco activo → metabolito
 *
 * La matemática:
 *          k₁         k₂
 *      A  ──→  B  ──→  C
 *
 *   d[A]/dt = -k₁·[A]
 *   d[B]/dt = +k₁·[A] - k₂·[B]
 *   d[C]/dt = +k₂·[B]
 *
 * Soluciones analíticas (libros clásicos):
 *   [A](t) = [A]₀ · exp(-k₁·t)
 *   [B](t) = [A]₀ · k₁/(k₂-k₁) · (exp(-k₁·t) - exp(-k₂·t))
 *   [C](t) = [A]₀ · (1 + (k₁·exp(-k₂·t) - k₂·exp(-k₁·t))/(k₂-k₁))
 *
 * El máximo de B ocurre en:   t_max = ln(k₁/k₂) / (k₁ - k₂)
 */

import { simulate, type ReactionStep } from '@/lib/chem/kinetics';
import { title, board, multiSparkline, table } from './lib/plot';

console.log(title(4, 'Reacciones en serie — el intermediario fugaz'));

const k1 = 0.3;
const k2 = 0.1;

const steps: ReactionStep[] = [
  {
    name: 'A → B',
    reactants: [{ species: 'A', nu: 1, order: 1 }],
    products:  [{ species: 'B', nu: 1 }],
    A: k1, Ea: 0,
  },
  {
    name: 'B → C',
    reactants: [{ species: 'B', nu: 1, order: 1 }],
    products:  [{ species: 'C', nu: 1 }],
    A: k2, Ea: 0,
  },
];

console.log(board(`
  Sistema:    A → B → C       k₁ = ${k1}   k₂ = ${k2}

  Predicciones analíticas:
    t_max (B)  = ln(${k1}/${k2}) / (${k1} - ${k2})
               = ${(Math.log(k1 / k2) / (k1 - k2)).toFixed(3)} s
    [B]_max    = [A]₀ · (k₂/k₁)^(k₂/(k₂-k₁))
               = ${(Math.pow(k2 / k1, k2 / (k2 - k1))).toFixed(3)}  (con [A]₀=1)
`));

const traj = simulate(steps, 300, { A: 1, B: 0, C: 0 }, 0.1, 500);

const idxMaxB = traj.C.B.indexOf(Math.max(...traj.C.B));
console.log(`  Simulación RK4 (dt=0.1 s):`);
console.log(`    t_max medido         = ${traj.t[idxMaxB].toFixed(3)} s`);
console.log(`    [B]_max medido       = ${traj.C.B[idxMaxB].toFixed(3)} M`);
console.log(`    [A](t=50)            = ${traj.C.A[500].toFixed(4)} M`);
console.log(`    [C](t=50)            = ${traj.C.C[500].toFixed(4)} M`);

console.log('\n  Trayectorias (sparkline t=0 → t=50 s):');
console.log(multiSparkline({
  'A': traj.C.A,
  'B': traj.C.B,
  'C': traj.C.C,
}, 60));

// Tabla de snapshots
const snapshotTimes = [0, 2, 5, 10, 20, 50];
const rows = snapshotTimes.map((t) => {
  const idx = Math.round(t / 0.1);
  return {
    't (s)': t,
    '[A]': traj.C.A[idx] ?? 0,
    '[B]': traj.C.B[idx] ?? 0,
    '[C]': traj.C.C[idx] ?? 0,
    'total': (traj.C.A[idx] ?? 0) + (traj.C.B[idx] ?? 0) + (traj.C.C[idx] ?? 0),
  };
});
console.log('\n  Snapshots en el tiempo:\n');
console.log(table(rows));

console.log(board(`
  Lecciones:

  1. El total A+B+C = 1 siempre (conservación — RK4 no la viola).
  2. [B] sube hasta un máximo y luego cae. Es un intermediario.
  3. Si k₁ >> k₂: B se acumula mucho (paso limitante es B→C).
  4. Si k₁ << k₂: B nunca aparece visible (aproximación de estado
     estacionario: d[B]/dt ≈ 0).

  Aplicación farmacológica (conexión biomédica):
  Si un profármaco se convierte rápido en fármaco activo, pero el
  fármaco se metaboliza lento, tienes alto pico y exposición larga.
  Al revés, tienes un pico fugaz y poca eficacia. Los laboratorios
  ajustan k₁ y k₂ precisamente con este modelo.

  Ejercicio:
    - Cambia k₁=0.1, k₂=0.3. ¿Cambia t_max? ¿Y [B]_max?
    - Agrega un tercer paso C → D (reacción en cascada de 4 especies).
`));
