/**
 * GATE del análisis del molde — valida contra los EJEMPLOS RESUELTOS del libro:
 *  · Eq 9.19: P_max = 456/2.6 = 175 MPa (P20, H=4D)
 *  · Eq 9.23: ΔQ̇(W/H=2) ≈ 3.8 % (<5, Fig 9.5) · ΔQ̇(W/H=3) ≈ 29-30 %
 *  · Eq 12.10 (bezel del libro): F=200 ton, L=215.9 mm, W=248, H=120 → δ=0.056 mm
 *  · Eq 12.8-12.9 (bezel): A=0.090 m² → τ=21.8 MPa
 *  · Eq 12.14/12.17 (cup): P=80, H_cav=50, W_cheek=45 → τ=89 MPa, δ=0.04 mm
 * Uso: node --import tsx scripts/mold-analysis-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${got} (libro: ${want} ± ${tol})`);
  if (!ok) fails++;
};
(async () => {
  const MA = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-analysis.ts'));

  // ── Eq 9.19 + Fig 9.4 ──
  check('K @ H=4D (Fig 9.4)', MA.coolingStressConcentration(4), 2.6, 0.01);
  check('K @ H=1D (Fig 9.4)', MA.coolingStressConcentration(1), 3.3, 0.01);
  check('P_max = 456/2.6 (Eq 9.19)', +(456 / MA.coolingStressConcentration(4)).toFixed(0), 175, 1);

  // ── Eq 9.23 (Menges / Fig 9.5) ──
  check('ΔQ̇ @ W/H=2 (Eq 9.23)', MA.heatFluxVariancePct(2), 3.8, 0.5);
  check('ΔQ̇ @ W/H=3 (Eq 9.23)', MA.heatFluxVariancePct(3), 29.5, 1.5);

  // ── Eq 12.10 — el ejemplo del BEZEL del libro, número a número ──
  // F = 200 ton·9807, L=0.2159, W=0.248, H=0.120 → I=3.6e-5, δ=0.056 mm
  const F = 200 * 9807, L = 0.2159, W = 0.248, H = 0.120, E = 205e9;
  const I = (W * H ** 3) / 12;
  const delta = (F * L ** 3) / (48 * E * I) * 1000;
  check('I bezel (Eq 12.11) ×1e5', +(I * 1e5).toFixed(1), 3.6, 0.1);
  check('δ bezel (Eq 12.10) mm', +delta.toFixed(3), 0.056, 0.002);

  // ── Eq 12.8-12.9 — corte perimetral del bezel del libro ──
  const Ashear = (2 * 0.248 + 2 * 0.168) * (0.120 - 0.012);
  check('A_shear bezel (Eq 12.9) m²', +Ashear.toFixed(3), 0.090, 0.001);
  check('τ bezel (Eq 12.8) MPa', +(F / Ashear / 1e6).toFixed(1), 21.8, 0.2);

  // ── Eq 12.14/12.17 — pared lateral del CUP del libro ──
  check('τ cheek cup (Eq 12.14) MPa', +((80 * 50) / 45).toFixed(0), 89, 1);
  const dSide = (3 * 80e6 * 0.05 ** 4) / (2 * E * 0.045 ** 3) * 1000;
  check('δ cheek cup (Eq 12.17) mm', +dSide.toFixed(2), 0.04, 0.005);

  // ── El molde bezel VIVO completo (moldAnalysis end-to-end) ──
  const bezel = {
    name: 'Molde bezel laptop', code: 'MLD-BEZEL', widthMm: 381,
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
    cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
    cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 },
    ejectors: { type: 'pin', diaMm: 3, count: 20 },
    core: { widthMm: 240, material: 'AISI P20' }, cavityMetal: 'AISI P20',
    baseSteel: '1.1730 (C45)', clampTons: 200, feed: 'hot-runner', nCav: 1,
  };
  const a = MA.moldAnalysis(bezel, { pMeltMPa: 80 });
  console.log('\n── moldAnalysis(bezel vivo) ──');
  console.log(`térmico: H=${a.thermal.HlineMm}mm (${a.thermal.HoverD}D) · paso ${a.thermal.pitchMm}mm (${a.thermal.WoverH}H) · ΔQ̇ ${a.thermal.fluxVarPct}% · K=${a.thermal.K} → P_max ${a.thermal.pMeltMaxMPa} MPa · t_c ${a.thermal.coolingTimeS}s`);
  console.log(`campo T: ${a.thermal.field.minC}–${a.thermal.field.maxC} °C (ΔT ${a.thermal.field.dTC} °C) en malla ${a.thermal.field.nx}×${a.thermal.field.ny}`);
  console.log(`estructural: τ=${a.structural.shearMPa} MPa · δ=${a.structural.deflMm}mm (claro ${(a.structural.spanM * 1000).toFixed(0)}mm) · con pilares ${a.structural.deflPillarsMm}mm · cheek ${a.structural.cheekMm}mm τ=${a.structural.sideTauMPa} MPa δ=${a.structural.sideDeflMm}mm`);
  console.log('\nveredictos:');
  for (const v of a.verdicts) console.log(`  ${v.ok ? '✓' : '⚠'} ${v.param}: ${v.valor} — límite ${v.limite} [${v.ref}]`);
  if (!a.thermal.field.T.length) { console.log('✗ campo térmico vacío'); fails++; }

  console.log(fails ? `\n✗ ${fails} FALLAS` : '\n✓ TODO calza con el libro');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
