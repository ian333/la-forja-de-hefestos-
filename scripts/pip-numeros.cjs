/** Juega con las fórmulas del modelo print-in-place + demostración al absurdo. */
const wld = 0.18, tan45 = Math.tan(Math.PI / 4); // PLA: g_weld, cono 45°
const F = (n, d = 2) => Number(n).toFixed(d);

console.log('═══ R3 · LA REGLA DEL GAP:  g ≥ E + g_weld ═══');
console.log('(meto excentricidad E pero NO crezco el gap → ¿qué pasa?)');
for (const E of [0.5, 1.0, 1.5, 2.5, 5]) {
  const gmin = E + wld, clear = 0.30 - E; // si dejo el gap de balero 0.30
  console.log(`  E=${E}mm → gap mínimo ${F(gmin)}mm · si dejo 0.30: holgura en órbita ${F(clear)}mm ${clear < 0 ? '⛔ CHOCA/SUELDA (absurdo)' : 'ok'}`);
}

console.log('\n═══ R5 · REDUCCIÓN = N  y  printabilidad (R=30mm) ═══');
const R = 30;
for (const N of [1, 2, 11, 30, 50, 94, 200]) {
  const pitch = (2 * Math.PI * R) / (N + 1);          // separación entre pernos
  const torque = 0.45 * N;                            // NEMA17 × N
  console.log(`  N=${N} → ${N}:1 (${F(torque)} N·m) · paso de perno ${F(pitch)}mm ${pitch < 2 ? '⛔ lóbulo < impresora (absurdo)' : N === 1 ? '⚠ sin reducción' : 'imprimible'}`);
}

console.log('\n═══ R1 · ABSURDO  E vs R_cam (la leva debe cubrir el eje) ═══');
for (const [E, Rc] of [[1.5, 8], [4, 8], [8, 8], [10, 8]]) {
  console.log(`  E=${E}, R_cam=${Rc} → ${E < Rc ? 'el eje cruza la leva (ok)' : '⛔ la leva NO cubre el eje (sin flecha, absurdo)'}`);
}

console.log('\n═══ R6 · ABSURDO  joroba/esfera A vs cono:  A ≤ (H/π)·tanα ═══');
const H = 24, Amax = (H / Math.PI) * tan45;
for (const A of [2, 5, 7.6, 8, 12]) {
  const over = (Math.atan((A * Math.PI) / H) * 180) / Math.PI;
  console.log(`  A=${A}mm → voladizo ${F(over, 1)}° ${over <= 45 ? 'imprimible' : '⛔ en el aire (absurdo)'}  (A_max=${F(Amax)}mm)`);
}

console.log('\n═══ CASCADA · etapas anidadas (11:1 c/u, en 1 sola impresión) ═══');
let red = 1, dia = 52;
for (let s = 1; s <= 5; s++) { red *= 11; dia += 2 * (4 + (1.5 + wld)); console.log(`  ${s} etapa(s) → ${red.toLocaleString()}:1 · Ø≈${F(dia, 0)}mm`); }

console.log('\n═══ ABSURDO FINAL: gap → 0 ═══');
for (const g of [0.30, 0.18, 0.05, 0]) console.log(`  gap=${F(g)}mm → ${g > wld ? 'gira (balero)' : g === 0 ? '⛔ TODO SOLDADO = un solo ladrillo (absurdo)' : '⛔ se sueldan (absurdo)'}`);
