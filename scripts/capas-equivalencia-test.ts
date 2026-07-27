/**
 * capas-equivalencia-test.ts — PRUEBA EXACTA de que las capas-objeto (capas.ts) reproducen
 * la matemática que estaba QUEMADA en CinematicMolecule.tsx antes del refactor.
 *
 * No depende del render (que tiene ruido GPU de ~0.2-0.6/255 medido entre corridas): compara
 * los NÚMEROS en 7,701 instantes del guion. Debe dar diferencia máxima 0.
 *
 *   npx tsx scripts/capas-equivalencia-test.ts
 */
import { evalCapas, type CapasSpec } from '../src/cinematic/capas';

// ── LA SPEC ACTUAL (datos) ──
const WPAIR_CAPAS: CapasSpec = {
  nubes:    { base: 1,    mods: [{ wins: [[41.5, 50.8]], a: -0.42 }] },
  campo:    { base: 1,    mods: [{ wins: [[7.2, 19.6], [61.8, 68.8]], a: -0.85 }] },
  parpadeo: { base: 0.42, mods: [{ wins: [[7.2, 19.6]], a: 0.42 }] },
  spin:     { base: 1,    mods: [{ wins: [[28.8, 40.5], [51.5, 68.8]], a: 0.9 }] },
  acc:      { base: 1,    mods: [{ wins: [[19.8, 28.6]], a: 0.5 }] },
};

// ── EL CÓDIGO VIEJO, copiado LITERAL del commit anterior (no reescrito) ──
function viejo(T: number) {
  const sw = (a: number, b: number) => { const t = Math.min(1, Math.max(0, (T - a) / (b - a))); return t * t * (3 - 2 * t); };
  const win = (a: number, b: number) => sw(a - 0.6, a) * (1 - sw(b, b + 0.6));
  return {
    nubes:    1 - 0.42 * win(41.5, 50.8),
    campo:    1 - 0.85 * Math.max(win(7.2, 19.6), win(61.8, 68.8)),
    parpadeo: 0.42 + 0.42 * win(7.2, 19.6),
    spin:     1 + 0.9 * Math.max(win(28.8, 40.5), win(51.5, 68.8)),
    acc:      1 + 0.5 * win(19.8, 28.6),
  };
}

const CLAVES = ['nubes', 'campo', 'parpadeo', 'spin', 'acc'] as const;
let peor = 0, peorT = 0, peorK = '';
let n = 0;
for (let T = 0; T <= 77.0001; T += 0.01) {
  const a = viejo(T), b = evalCapas(WPAIR_CAPAS, T);
  for (const k of CLAVES) {
    const d = Math.abs((a as any)[k] - b[k]);
    if (d > peor) { peor = d; peorT = T; peorK = k; }
  }
  n++;
}
console.log(`instantes comparados: ${n} · capas: ${CLAVES.length} → ${n * CLAVES.length} valores`);
console.log(`diferencia MÁXIMA: ${peor}` + (peor > 0 ? `  (capa '${peorK}' en t=${peorT.toFixed(2)}s)` : ''));
if (peor === 0) console.log('✅ EQUIVALENCIA EXACTA — las capas-objeto dan los MISMOS números que el código quemado');
else if (peor < 1e-12) console.log('✅ equivalente (solo error de punto flotante)');
else { console.log('❌ NO equivalente'); process.exit(1); }
