/**
 * ══════════════════════════════════════════════════════════════════════
 *  LECCIÓN 6 — Catálisis enzimática: por qué el peróxido se descompone
 *  en tu herida pero no en el bote
 * ══════════════════════════════════════════════════════════════════════
 *
 * La catalasa es una de las enzimas más rápidas conocidas. Cuando pones
 * H₂O₂ sobre una herida, burbujea furiosamente porque tu sangre contiene
 * catalasa que cataliza:
 *
 *       2 H₂O₂  →  2 H₂O  +  O₂
 *
 * En el frasco del botiquín (sin catalasa) la vida media es de años.
 * En tu sangre (con catalasa) la vida media es de microsegundos.
 *
 * El secreto: el catalizador NO cambia ΔG ni Keq. Solo baja Ea.
 * El "pozo" al que llega la reacción es el mismo; la "colina" que
 * hay que trepar se hace una rampita.
 *
 * Ea sin catalizador (H₂O₂ puro):     ~75 kJ/mol
 * Ea con catalasa (enzima hemo):       ~23 kJ/mol   (bajada de ~52 kJ)
 * Aceleración:   exp((75-23)·1000 / (R·310)) ≈ 10⁸
 */

import { simulate, arrhenius, type ReactionStep } from '@/lib/chem/kinetics';
import { CONSTANTS } from '@/lib/chem/elements';
import { title, board, table } from './lib/plot';

console.log(title(6, 'Catálisis enzimática — H₂O₂ en la herida'));

const T = 310; // cuerpo humano (37 °C)

const stepsPuro: ReactionStep[] = [{
  name: 'sin catalizador',
  reactants: [{ species: 'H2O2', nu: 2, order: 1 }],
  products:  [{ species: 'H2O', nu: 2 }, { species: 'O2', nu: 1 }],
  A: 1.6e6, Ea: 75_000,
}];

const stepsCatalizado: ReactionStep[] = [{
  name: 'con catalasa',
  reactants: [{ species: 'H2O2', nu: 2, order: 1 }],
  products:  [{ species: 'H2O', nu: 2 }, { species: 'O2', nu: 1 }],
  A: 1.6e6, Ea: 23_000,     // misma A, Ea reducida
}];

const kPuro = arrhenius(1.6e6, 75_000, T);
const kCat  = arrhenius(1.6e6, 23_000, T);
const acel  = kCat / kPuro;
const expTeorico = Math.exp((75_000 - 23_000) / (CONSTANTS.R * T));

console.log(board(`
  Parámetros:   A = 1.6·10⁶ s⁻¹     T = ${T} K = ${T - 273}°C

                          Ea          k a 37°C         t½
  ─────────────────────────────────────────────────────────────
  H₂O₂ puro           75 000 J/mol   ${kPuro.toExponential(3)}   ${(Math.log(2)/(2*kPuro)/3600/24/365).toExponential(2)} años
  H₂O₂ + catalasa     23 000 J/mol   ${kCat.toExponential(3)}   ${(Math.log(2)/(2*kCat)*1e3).toFixed(1)} ms

  Aceleración observada:      ${acel.toExponential(3)}×
  Aceleración teórica (exp):  ${expTeorico.toExponential(3)}×   ✓ coinciden
`));

// Simulación comparativa: 60 s
const trajPuro = simulate(stepsPuro, T, { H2O2: 1, H2O: 0, O2: 0 }, 0.1, 600);
const trajCat  = simulate(stepsCatalizado, T, { H2O2: 1, H2O: 0, O2: 0 }, 1e-5, 600);

// Puntos clave
const rows = [0, 0.5, 1, 5, 10, 60].map((t) => {
  const idxPuro = Math.round(t / 0.1);
  const idxCat = Math.min(599, Math.round(t / 1e-5));
  return {
    't (s)': t,
    '[H₂O₂] puro':        trajPuro.C.H2O2[Math.min(idxPuro, 599)],
    '[H₂O₂] con catalasa': trajCat.C.H2O2[idxCat],
  };
});
console.log('\n  Comparación lado a lado (misma [H₂O₂]₀ = 1 M):\n');
console.log(table(rows));

console.log(board(`
  Lecciones:

  1. La enzima NO cambia la termodinámica. ΔH (-98 kJ/mol) es el mismo.
     La reacción sigue siendo exotérmica. Los productos son los mismos.

  2. La enzima cambia la CINÉTICA. Al bajar Ea en 52 kJ/mol, el factor
     exp(ΔEa/RT) multiplica k por ~10⁸. Esto es lo que permite que la
     vida biológica ocurra a 37°C.

  3. Por eso las enzimas son específicas: cada una reduce Ea para UNA
     reacción particular. Sin enzima para una reacción, esa reacción
     simplemente no ocurre en escalas de tiempo útiles para la célula.

  4. Nota didáctica: la curva "con catalasa" en nuestra simulación
     requiere dt = 10⁻⁵ s (mucho más pequeño que "sin catalizador")
     porque la dinámica es más rápida. Los algoritmos adaptativos
     ajustan dt automáticamente — nosotros aquí lo fijamos manualmente.

  Ejercicio:
    - ¿Qué Ea necesitaría tener la reacción para que t½ = 1 segundo?
      Pista: despeja Ea de k = ln(2)/(2·t½), luego Ea = R·T·ln(A/k).
    - Bajar Ea 10 kJ/mol equivale a subir T ¿cuántos K? (a T≈300 K)
`));
