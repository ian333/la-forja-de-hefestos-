/**
 * SIMULACIÓN COMPLETA del molde bezel (para la COMPARATIVA vs SolidWorks):
 *  · FEA mecánico: barrido de resolución hasta malla fina (convergencia documentada)
 *  · Térmico transitorio: 10 ciclos completos → cuasi-estacionario (rango Fig 9.7)
 *  · Referencias: viga Eq 12.10, Timoshenko+rieles a mano, FEM del libro (Fig 12.6)
 * Salida: JSON con todos los números → alimenta la página de comparativa.
 * Uso: node --import tsx scripts/mold-full-sim.cjs [out.json]
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
  const MF = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-fea.ts'));
  const TH = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-thermal-fdm.ts'));
  const MA = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-analysis.ts'));
  const out = { fecha: new Date().toISOString(), pieza: 'laptop bezel (Kazmer Figs 3.5/5.12)', molde: 'MLD-BEZEL 381×297', fea: [], thermal: {}, analysis: {} };

  // ── FEA: convergencia a malla fina ──
  for (const res of [22, 30, 38, 46]) {
    const t0 = Date.now();
    try {
      const f = MF.runMoldFea(K, oc, bezel, { pMeltMPa: 80, resolution: res });
      out.fea.push({ res, nodos: f.nNodes, tets: f.nTets, deltaMm: f.maxDispMm, vonMisesMPa: f.maxVonMisesMPa, ms: Date.now() - t0, beamMm: f.beamDeflMm });
      console.log(`FEA res ${res}: δ=${f.maxDispMm} σ=${f.maxVonMisesMPa} · ${f.nNodes} nodos · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) { console.log(`FEA res ${res} FALLÓ:`, String(e).slice(0, 100)); }
  }
  // referencia a mano (viga profunda)
  const F = 80e6 * 0.24 * 0.16, L = 0.281, W = 0.248, H = 0.196, E = 205e9, G = E / 2.6;
  const I = W * H ** 3 / 12, As = (5 / 6) * W * H;
  out.fea_referencias = {
    vigaEq1210Mm: +((F * L ** 3) / (48 * E * I) * 1000).toFixed(3),
    timoshenkoManualMm: +(((5 * F * L ** 3) / (384 * E * I) + (F * L) / (4 * G * As) + (F / 2) * 0.066 / ((0.05 * 0.297) * E)) * 1000).toFixed(3),
    libroFemMm: 0.024, libroVigaMm: 0.056, libroNota: 'Fig 12.6/§12.2.2 (SU caso: 200 ton, claro 215.9)',
  };

  // ── térmico: 10 ciclos completos (300 s simulados) ──
  const sim = TH.createThermalSim(bezel);
  const t0 = Date.now();
  const historia = [];
  for (let c = 0; c < 10; c++) {
    sim.step(30);
    historia.push({ ciclo: c + 1, maxC: +sim.maxC.toFixed(1), minC: +sim.minC.toFixed(1) });
  }
  const zPart = 36 + 66 + 120 + 76;
  const sl = sim.slice(zPart - 2);
  out.thermal = {
    celdas: `${sim.nx}×${sim.ny}×${sim.nz}`, msComputo: Date.now() - t0, sSimulados: 300,
    historia, cuasiEstacionario: { maxC: +sim.maxC.toFixed(1), minC: +sim.minC.toFixed(1), dTparticion: sl.dTC },
    referenciaLibro: 'Fig 9.7: superficie 69.2–93.4 °C según pitch (FEM comercial)',
  };
  console.log(`Térmico 10 ciclos: max ${sim.maxC.toFixed(1)} °C · ΔT partición ${sl.dTC} °C · ${Date.now() - t0} ms`);

  // ── análisis Kazmer (Eq-por-Eq) ──
  const a = MA.moldAnalysis(bezel, { pMeltMPa: 80 });
  out.analysis = { verdicts: a.verdicts, coolingTimeS: a.thermal.coolingTimeS, fluxVarPct: a.thermal.fluxVarPct, pMeltMaxMPa: a.thermal.pMeltMaxMPa };

  const file = process.argv[2] || '/tmp/mold-full-sim.json';
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('→', file);
})().catch((e) => { console.error('FATAL', String(e?.stack || e).slice(0, 400)); process.exit(1); });
