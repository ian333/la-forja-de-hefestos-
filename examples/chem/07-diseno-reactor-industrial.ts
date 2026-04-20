/**
 * ══════════════════════════════════════════════════════════════════════
 *  LECCIÓN 7 — Diseño de un reactor industrial
 *  (¿PFR o CSTR? ¿qué volumen? ¿qué temperatura? ¿se puede disparar?)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Problema de planta real:
 *   Tenemos que producir 1000 kmol/h de producto B a partir de A con una
 *   cinética de primer orden k = 2·10⁶ · exp(−60 000/RT) s⁻¹.
 *   La reacción es exotérmica (ΔH = −180 kJ/mol).
 *   Disponemos de dos reactores: un PFR tubular o un CSTR con agitación.
 *
 *   Preguntas:
 *     1. ¿Qué volumen necesita cada reactor para 90% de conversión?
 *     2. ¿Cuál es la temperatura óptima?
 *     3. ¿Hay riesgo de runaway térmico?
 *
 * Esta lección usa LOS SOLVERS NUEVOS (stiff solver + balance de energía
 * + modelos de reactor) — los mismos que usaría un ingeniero en Aspen+.
 */

import {
  simulatePfr,
  cstrSteadyState,
  simulateCstrTransient,
} from '@/lib/chem/reactors';
import { simulateCoupled } from '@/lib/chem/energy-balance';
import type { ReactionStep } from '@/lib/chem/kinetics';
import { arrhenius } from '@/lib/chem/kinetics';
import { CONSTANTS } from '@/lib/chem/elements';
import { title, board, table } from './lib/plot';

console.log(title(7, 'Diseño de reactor industrial — PFR vs CSTR, óptimo térmico, runaway'));

const step: ReactionStep = {
  name: 'A → B',
  reactants: [{ species: 'A', nu: 1, order: 1 }],
  products:  [{ species: 'B', nu: 1 }],
  A: 2.0e6,
  Ea: 60000,
  deltaH: -180000,   // fuertemente exotérmica
};

const Cp = 80; // J/(mol·K), aprox para líquidos orgánicos
const thermalCtx = {
  species: { A: { Cp }, B: { Cp } },
  volume: 1,   // se escala según reactor
  UA: 0,       // adiabático por defecto; exploraremos UA>0 al final
  Tamb: 300,
};

// ─────────────────────────────────────────────────────────────
// PARTE 1 — Volumen necesario en PFR vs CSTR (isotérmico)
// ─────────────────────────────────────────────────────────────

console.log(board(`
  PARTE 1 — ¿Qué volumen necesita cada reactor para X_A = 90% a 400 K?

  Alimentación: 1 mol/L de A, caudal Q = 10 L/s (36 m³/h).
  Objetivo: 90% de conversión (C_A,out = 0.1 mol/L).

  Fórmulas analíticas (orden 1 isotérmico):
     PFR:  V = -Q · ln(1-X) / k
     CSTR: V = Q · X / (k · (1-X))
`));

const T = 400;
const kT = arrhenius(step.A, step.Ea, T);
const X = 0.9;
const Q = 10;

const V_pfr_analytic = (-Q * Math.log(1 - X)) / kT;
const V_cstr_analytic = (Q * X) / (kT * (1 - X));

// Verificar con simulación numérica
const pfrResult = simulatePfr(
  [step],
  { Q, V: V_pfr_analytic, inlet: { A: 1, B: 0 }, T },
  { rtol: 1e-6 },
);
const pfrFinalXA = 1 - pfrResult.C.A[pfrResult.t.length - 1];

const cstrResult = cstrSteadyState(
  [step],
  { Q, V: V_cstr_analytic, feed: { A: 1, B: 0 }, T },
);
const cstrFinalXA = cstrResult.conversion.A;

console.log(`  k(400 K)          = ${kT.toExponential(3)} s⁻¹`);
console.log('');
console.log(table([
  {
    'Reactor': 'PFR',
    'V analítico (L)': V_pfr_analytic.toFixed(1),
    'V (m³)': (V_pfr_analytic / 1000).toFixed(2),
    'X (simulado)': pfrFinalXA.toFixed(4),
  },
  {
    'Reactor': 'CSTR',
    'V analítico (L)': V_cstr_analytic.toFixed(1),
    'V (m³)': (V_cstr_analytic / 1000).toFixed(2),
    'X (simulado)': cstrFinalXA.toFixed(4),
  },
]));

console.log(board(`
  Conclusión:
    El CSTR necesita ${(V_cstr_analytic / V_pfr_analytic).toFixed(1)}× más volumen que el PFR
    para la misma conversión. Esto es por la concentración uniformemente BAJA
    del CSTR (toda la masa "ve" C_A = C_out = 0.1), mientras que el PFR tiene
    C_A decreciente a lo largo del reactor — la velocidad media es mayor.

    Regla de oro: para órdenes positivos (cinética típica) el PFR siempre
    es más compacto. El CSTR se prefiere cuando se necesita agitación intensa,
    reacciones altamente exotérmicas con refrigeración, o cuando la mezcla
    perfecta evita puntos calientes.
`));

// ─────────────────────────────────────────────────────────────
// PARTE 2 — Optimización de temperatura
// ─────────────────────────────────────────────────────────────

console.log(board(`
  PARTE 2 — ¿Qué temperatura minimiza el volumen del reactor?

  A mayor T, k sube → menos volumen necesario. Pero hay costo: mayor T
  implica más energía, materiales más caros, riesgo de descomposición.

  Calculemos V_PFR necesario vs T:
`));

const temps = [350, 375, 400, 425, 450, 475, 500];
const rowsT = temps.map((Ti) => {
  const ki = arrhenius(step.A, step.Ea, Ti);
  const Vi = (-Q * Math.log(1 - X)) / ki;
  return {
    'T (K)': Ti,
    'T (°C)': Ti - 273,
    'k (s⁻¹)': ki,
    'V_PFR (L)': Vi,
    'τ = V/Q (s)': Vi / Q,
  };
});
console.log(table(rowsT));

console.log(board(`
  Cada +25 K reduce el volumen ~${((V_pfr_analytic / arrhenius(step.A, step.Ea, 425) * kT).toFixed(0))}%.
  Un ingeniero de planta haría un trade-off económico:
    - Costo capital ∝ V (reactor físico)
    - Costo operación ∝ calor para mantener T + sistema de control
  El óptimo típicamente está donde ambos son del mismo orden — normalmente
  unos 50-80 K sobre la T ambiente o la T del alimentador.
`));

// ─────────────────────────────────────────────────────────────
// PARTE 3 — Runaway térmico (¿por qué un CSTR adiabático puede explotar?)
// ─────────────────────────────────────────────────────────────

console.log(board(`
  PARTE 3 — Runaway térmico: ¿qué pasa si apagamos la refrigeración?

  Simulamos el batch adiabático (UA=0). La reacción libera ΔH por cada mol
  convertido → T sube → k aumenta exponencialmente → más calor → más T...

  Usamos el SOLVER ACOPLADO (masa + energía) con integración stiff.
`));

const ctxAdiab = { ...thermalCtx, volume: 100, UA: 0 };

const batchAdiab = simulateCoupled(
  [step],
  { A: 1, B: 0 },
  350,               // arrancamos a 350 K
  ctxAdiab,
  3600,              // 1 hora
  { rtol: 1e-5, atol: 1e-9 },
);

// Buscar el momento de "ignición" (cuando dT/dt es máximo)
let maxDTdt = 0;
let tIgnition = 0;
let Tmax = batchAdiab.T[0];
for (let i = 1; i < batchAdiab.t.length; i++) {
  const dT = (batchAdiab.T[i] - batchAdiab.T[i - 1]) / (batchAdiab.t[i] - batchAdiab.t[i - 1]);
  if (dT > maxDTdt) {
    maxDTdt = dT;
    tIgnition = batchAdiab.t[i];
  }
  if (batchAdiab.T[i] > Tmax) Tmax = batchAdiab.T[i];
}

// Elevación adiabática teórica
const dTad_theory = (-step.deltaH! * 1) / (1 * ctxAdiab.volume * Cp / ctxAdiab.volume);
// = ΔH_abs · C0 / Cp (ya que V cancela)

console.log(`  T inicial                : 350 K`);
console.log(`  T máxima alcanzada       : ${Tmax.toFixed(1)} K (+${(Tmax-350).toFixed(0)} K)`);
console.log(`  ΔT adiabática teórica    : ${dTad_theory.toFixed(1)} K   (ΔH / Cp)`);
console.log(`  Momento de ignición      : ${tIgnition.toFixed(0)} s (${(tIgnition/60).toFixed(1)} min)`);
console.log(`  dT/dt máximo             : ${maxDTdt.toFixed(2)} K/s`);

// Snapshots
console.log('\n  Evolución del batch adiabático:');
const samples = [0, 60, 600, 1200, 1800, 3600];
const rowsRun = samples.map((ts) => {
  let idx = 0;
  for (let i = 0; i < batchAdiab.t.length; i++) if (batchAdiab.t[i] >= ts) { idx = i; break; }
  if (idx === 0 && batchAdiab.t[0] < ts) idx = batchAdiab.t.length - 1;
  return {
    't (s)': ts,
    't (min)': (ts / 60).toFixed(1),
    'T (K)':  batchAdiab.T[idx],
    '[A] (M)': batchAdiab.C.A[idx],
    '[B] (M)': batchAdiab.C.B[idx],
  };
});
console.log(table(rowsRun));

console.log(board(`
  INTERPRETACIÓN — el patrón clásico del runaway:

  1. Durante un período de inducción (aquí ${(tIgnition/60).toFixed(0)} min) aparentemente "no pasa nada".
  2. De pronto T se dispara en segundos/minutos (ignición).
  3. T pega en el techo adiabático ΔT_ad = |ΔH|·C₀/Cp.

  ESTO ES CÓMO EXPLOTAN LOS REACTORES INDUSTRIALES. El operador ve todo
  tranquilo durante horas — luego alarma, descomposición, fuga, fuego.

  Casos históricos:
    - Seveso 1976 (dioxina, Italia): reactor TCP batch mal enfriado.
    - Bhopal 1984 (India): metil-isocianato + agua → runaway.
    - Texas City 2005 (BP): fraccionador sobrecalentado.

  CÓMO SE PREVIENE EN DISEÑO:
    • UA > 0 (refrigeración activa) con margen ≥ 3× el calor de reacción pico.
    • Control de alimentación (semibatch): agregar A lentamente.
    • Sistema de alivio (relief valves) dimensionado para el runaway peor-caso.
    • Monitoreo dT/dt con parada automática.

  Ejercicio:
    - Simula con UA = 1e5 W/K (refrigeración). ¿Se evita el runaway?
    - ¿Qué valor mínimo de UA previene ΔT > 50 K?
    - Prueba semibatch: A se inyecta a tasa constante en 1 hora. Cambia.
`));
