// TEST Kazmer cap 3 — break-even cold vs hot runner (tabla 3.1 y p.41).
(async () => {
  const path = require('path');
  const c = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cost.ts'));
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const cold = { name: 'cold 2-cav', fixedCost: 10000, marginalCost: 0.55, cavities: 2, cycleTimeS: 30 };
  const hot = { name: 'hot 32-cav', fixedCost: 250000, marginalCost: 0.16, cavities: 32, cycleTimeS: 20 };
  const checks = {};
  // p.41: break-even = $240,000/$0.39 = 615,000 piezas (615,384.6 exacto)
  const be = c.breakEven(cold, hot);
  console.log('break-even:', Math.round(be).toLocaleString(), 'piezas (libro ~615,000)');
  checks.breakeven = ok(be, 615385, 500);
  // tabla 3.1: costo/pieza a 50,000 con cold: 10000/50000 + 0.55 = 0.75 ✓ ("total $0.75")
  const cp50k = c.costPerPart(cold, 50000);
  console.log('cold @50k:', cp50k.toFixed(2), '$/pza (tabla 0.75)');
  checks.cold50k = ok(cp50k, 0.75, 0.001);
  // tabla 3.1: hot a 5,000,000: 250000/5e6 + 0.16 = 0.21 ✓
  const cp5m = c.costPerPart(hot, 5e6);
  console.log('hot @5M:', cp5m.toFixed(2), '$/pza (tabla 0.21)');
  checks.hot5m = ok(cp5m, 0.21, 0.001);
  // decisión: a 100k gana cold; a 1M gana hot (libro fig 3.4)
  checks.at100k = c.chooseMold([cold, hot], 100000).best.name === 'cold 2-cav';
  checks.at1M = c.chooseMold([cold, hot], 1000000).best.name === 'hot 32-cav';
  const rep = c.chooseMold([cold, hot], 1000000);
  console.log(rep.report.join('\n'));
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
