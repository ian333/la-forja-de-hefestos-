/**
 * ══════════════════════════════════════════════════════════════════════
 *  LECCIÓN 1 — ¿Por qué la cocina no explota?
 *  (Arrhenius y la sensibilidad exponencial a la temperatura)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Pregunta de entrada para los estudiantes:
 *   "El oxígeno y el hidrógeno son gases explosivos. Y sin embargo el
 *    agua (H₂O) existe estable. ¿Por qué no se 'deshace' espontáneamente?"
 *
 * Respuesta corta: la reacción inversa (descomposición de H₂O) tiene una
 * Ea tan grande que a temperatura ambiente la velocidad k es prácticamente
 * cero — aunque termodinámicamente posible.
 *
 * En esta clase simulamos la dependencia exponencial de k con T para una
 * reacción con Ea típica, y el estudiante verá que con subir 100 K la
 * velocidad puede crecer un millón de veces.
 */

import { arrhenius } from '@/lib/chem/kinetics';
import { CONSTANTS } from '@/lib/chem/elements';
import { title, board, table } from './lib/plot';

console.log(title(1, 'Arrhenius — sensibilidad exponencial a la temperatura'));

console.log(board(`
Ecuación de Arrhenius (1889):

                      ┌      -Ea   ┐
          k(T) = A · exp│  ───────  │
                      └      R·T    ┘

  A   = factor preexponencial (frecuencia de colisiones)
  Ea  = energía de activación (la "colina" que hay que subir)
  R   = constante de gas (${CONSTANTS.R.toFixed(3)} J/mol·K)
  T   = temperatura absoluta [K]

Si Ea/(R·T) crece 1 unidad, k se divide por e≈2.718.
Si crece 10 unidades, k se divide por e¹⁰ ≈ 22 026.
`));

// Parámetros típicos: reacción orgánica moderada
const A = 1e12;     // s⁻¹
const Ea = 80_000;  // 80 kJ/mol — energía de activación típica

const tempsC = [-20, 0, 25, 50, 100, 200, 500, 1000];
const rows = tempsC.map((tC) => {
  const T = tC + 273.15;
  const k = arrhenius(A, Ea, T);
  return {
    'T (°C)': tC,
    'T (K)': T.toFixed(1),
    'k (s⁻¹)': k,
    'vida media (s)': Math.log(2) / k,
  };
});

console.log('\n  Para A=1·10¹² s⁻¹ y Ea=80 kJ/mol:\n');
console.log(table(rows));

const kRefTC = 25;
const kRef = arrhenius(A, Ea, kRefTC + 273.15);
console.log(board(`
Interpretación:

  A 25°C la reacción tiene vida media de ~${(Math.log(2) / kRef / 60).toFixed(0)} minutos — lenta pero visible.
  A 1000°C la vida media es de microsegundos — prácticamente instantánea.
  Entre ambas, la velocidad cambia por un factor de ~10¹¹.

  Por eso calentar el horno no es un "simple empujón" sino un interruptor:
  pasas de una zona donde NADA ocurre a una donde TODO ocurre.

  Ejercicio para el estudiante:
    - Recalcula con Ea = 40 kJ/mol. ¿Qué cambia?
    - Recalcula con Ea = 150 kJ/mol. ¿A qué T empieza a ser visible?
    - Las enzimas bajan Ea típicamente en 30–50 kJ/mol. ¿Cuánto acelera eso?
`));
