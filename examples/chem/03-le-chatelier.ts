/**
 * ══════════════════════════════════════════════════════════════════════
 *  LECCIÓN 3 — Principio de Le Chatelier en vivo
 *  (síntesis de amoníaco: la reacción que alimenta al mundo)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Contexto: el proceso Haber-Bosch produce ~200 millones de toneladas de
 * amoníaco al año. Sin él, la mitad del nitrógeno en tu cuerpo no existiría.
 *
 *   N₂ + 3 H₂  ⇌  2 NH₃           ΔH = -92 kJ/mol  (exotérmica)
 *
 * Principio de Le Chatelier (1884): si perturbamos un sistema en equilibrio,
 * éste se desplaza para contrarrestar la perturbación.
 *
 * Aquí demostramos el efecto de la temperatura:
 *   - Reacción exotérmica → calor es un "producto"
 *   - Subir T → desplaza hacia reactantes → MENOS amoníaco
 *   - Bajar T → desplaza hacia productos → MÁS amoníaco (pero más lento)
 *
 * Por eso Haber-Bosch opera en ~450°C: es un COMPROMISO entre velocidad
 * (alta T) y rendimiento (baja T). Sin el catalizador Fe₃O₄ no se podría.
 */

import { R_HABER } from '@/lib/chem/reactions';
import { simulate } from '@/lib/chem/kinetics';
import { title, board, table } from './lib/plot';

console.log(title(3, 'Le Chatelier — síntesis de amoníaco Haber-Bosch'));

console.log(board(`
  N₂ + 3 H₂ ⇌ 2 NH₃       ΔH = -92 kJ/mol   (exotérmica, disminuye moles)

  Predicción teórica (Le Chatelier):
    - Subir T  → menor Keq  → menos NH₃ en equilibrio
    - Bajar T  → mayor Keq  → más NH₃
    - Subir P  → menos moles gaseosos → favorece productos (4 → 2 moles)

  Vamos a comprobar el efecto de T simulando a 4 temperaturas.
`));

const temperatures = [500, 600, 723, 850];
const rows: Record<string, string | number>[] = [];

for (const T of temperatures) {
  const traj = simulate(
    R_HABER.steps,
    T,
    { N2: 1.0, H2: 3.0, NH3: 0 },
    R_HABER.dt,
    Math.round(R_HABER.duration / R_HABER.dt),
  );
  const last = traj.t.length - 1;
  const N2f = traj.C.N2[last];
  const H2f = traj.C.H2[last];
  const NH3f = traj.C.NH3[last];
  // Keq aparente basada en estado final (puede no haber llegado al equilibrio)
  const Keq = NH3f ** 2 / (N2f * H2f ** 3 || 1e-30);
  const rendimiento = NH3f / 2;  // 2 mol NH3 máx posible con 1 mol N2 inicial

  rows.push({
    'T (K)': T,
    'T (°C)': (T - 273).toFixed(0),
    '[N₂] final': N2f,
    '[H₂] final': H2f,
    '[NH₃] final': NH3f,
    'Keq aparente': Keq,
    'Rendimiento': (rendimiento * 100).toFixed(1) + '%',
  });
}

console.log('\n  Simulación a 4 temperaturas (t = ' + R_HABER.duration + ' s):\n');
console.log(table(rows));

console.log(board(`
  Observación crítica:

  A baja T el equilibrio favorece NH₃ (Keq alta) PERO la reacción es
  lenta — en el tiempo simulado casi no progresa. A alta T va rápido
  pero hay MENOS amoníaco final.

  Por eso Haber agregó el catalizador de hierro:
    - Sin catalizador:  Ea ≈ 230 kJ/mol → inviable comercialmente
    - Con Fe₃O₄:        Ea ≈ 150 kJ/mol → operativo a 400-500°C

  Y por eso operan a alta presión (200 atm):
    - Moles reactantes (1+3=4) > moles productos (2)
    - Alta P "aprieta" el sistema → favorece menos moles → más NH₃

  Ejercicio:
    - ¿Qué pasa si empiezas con 3 M de H₂ pero sólo 0.5 M de N₂?
    - ¿Y si arrancas ya con NH₃ presente? (equilibrio desde otra dirección)
`));
