/**
 * GATE de la simulación REAL del molde:
 *  · FEA mecánico (malla tet + CG): δ_max mismo orden que la viga Eq 12.10 (el libro
 *    reporta FEM ≈ 0.4× de la viga conservadora) y σ_vm razonable (< σ_endurance).
 *  · Térmico transitorio (FDM 3D): la capa de plástico se ENFRÍA hacia T_coolant;
 *    tras el ciclo el acero junto al agua está más frío que junto a la cavidad.
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const occtFactory = require(cjsGlue);
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));
let fails = 0;
const check = (name, cond, detail) => { console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails++; };
const bezel = {
  name: 'Molde bezel laptop', code: 'MLD-BEZEL', widthMm: 381,
  plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
  cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
  cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 },
  ejectors: { type: 'pin', diaMm: 3, count: 20 },
  core: { widthMm: 240, material: 'AISI P20' }, cavityMetal: 'AISI P20',
  baseSteel: '1.1730 (C45)', clampTons: 200, feed: 'hot-runner', nCav: 1,
};
(async () => {
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);

  // ── FEA mecánico ──
  const MF = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-fea.ts'));
  const fea = MF.runMoldFea(K, oc, bezel, { pMeltMPa: 80, resolution: 22 });
  console.log(`FEA: ${fea.nNodes} nodos · ${fea.nTets} tets · ${fea.ms} ms`);
  console.log(`  δ_max = ${fea.maxDispMm} mm (viga Eq 12.10: ${fea.beamDeflMm} mm) · σ_vm máx = ${fea.maxVonMisesMPa} MPa`);
  check('malla no trivial (>3k nodos)', fea.nNodes > 3000, `${fea.nNodes}`);
  // CROSS-VALIDACIÓN a mano: con L/H≈1.4 es viga PROFUNDA — la Euler-Bernoulli del
  // libro (Eq 12.10) ignora el CORTANTE (Timoshenko) y la COMPRESIÓN de los rieles.
  // δ_mano = flexión distribuida (5FL³/384EI) + cortante (FL/4GAs) + rieles (F/2·h/AE)
  const F = 80e6 * 0.240 * 0.160, L = 0.281, W = 0.248, H = 0.196, E = 205e9, G = E / 2.6;
  const I = W * H ** 3 / 12, As = (5 / 6) * W * H;
  const dHand = (5 * F * L ** 3) / (384 * E * I) + (F * L) / (4 * G * As) + (F / 2) * 0.066 / ((0.05 * 0.297) * E);
  const dHandMm = dHand * 1000;
  console.log(`  δ_mano (Timoshenko+rieles) = ${dHandMm.toFixed(3)} mm`);
  check('δ FEM ≈ δ_mano Timoshenko+rieles (±40%)', Math.abs(fea.maxDispMm - dHandMm) < 0.4 * dHandMm,
    `FEM ${fea.maxDispMm} vs mano ${dHandMm.toFixed(3)}`);
  check('la viga del libro SUBESTIMA (FEM > Eq 12.10) — viga profunda', fea.maxDispMm > fea.beamDeflMm,
    `${fea.maxDispMm} > ${fea.beamDeflMm}`);
  check('σ_vm < σ_endurance P20 (456 MPa)', fea.maxVonMisesMPa < 456, `${fea.maxVonMisesMPa} MPa`);
  check('colores por vértice completos', fea.colors.length === fea.positions.length, `${fea.colors.length}`);

  // ── térmico transitorio ──
  const TH = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-thermal-fdm.ts'));
  const sim = TH.createThermalSim(bezel);
  console.log(`FDM: ${sim.nx}×${sim.ny}×${sim.nz} celdas · dt_max ${sim.dtMax.toFixed(3)} s · celda ${sim.dx} mm`);
  const t0 = Date.now();
  sim.step(0.01);                    // arranca el ciclo (inyección)
  const hotStart = sim.maxC;
  sim.step(15);                      // medio ciclo de enfriamiento
  const ms = Date.now() - t0;
  const zPart = 36 + 66 + 120 + 76;  // 298
  const sl = sim.slice(zPart - 2);
  console.log(`  tras 15 s: T ∈ [${sim.minC.toFixed(1)}, ${sim.maxC.toFixed(1)}] °C · partición ΔT=${sl.dTC} °C · ${ms} ms de cómputo`);
  check('inyección subió el acero (pico > 72 °C)', hotStart > 72, `${hotStart.toFixed(1)} °C`);
  check('el acero se ENFRÍA hacia el refrigerante (cae >3 °C)', sim.maxC < hotStart - 3, `${hotStart.toFixed(1)} → ${sim.maxC.toFixed(1)}`);
  sim.step(60);   // 2 ciclos más → cuasi-estacionario acotado (rango Fig 9.7)
  check('cuasi-estacionario acotado (max < 120 °C)', sim.maxC < 120, `${sim.maxC.toFixed(1)} °C`);
  check('nada por debajo del refrigerante−1', sim.minC > sim.coolantC - 1, `${sim.minC.toFixed(1)} ≥ ${sim.coolantC - 1}`);
  check('cómputo interactivo (<3000 ms por 15 s sim)', ms < 3000, `${ms} ms`);
  console.log(fails ? `\n✗ ${fails} FALLAS` : '\n✓ SIMULACIÓN REAL verificada');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', String(e?.stack || e).slice(0, 500)); process.exit(1); });
