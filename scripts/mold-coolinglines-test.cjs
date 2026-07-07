// TEST del diseño de líneas de enfriamiento (Kazmer §9.2.3-6) — reproduce el
// ejemplo del cup/lid del libro al decimal. Puro.
(async () => {
  const path = require('path');
  const cl = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'coolinglines.ts'));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const checks = {};

  // ── cup/lid del libro: Q_line 260 W, ΔT 1°C, agua ──
  const flow = cl.coolantFlowRate(260, 1, cl.WATER);
  console.log('caudal:', flow.toExponential(2), 'm³/s (libro 6.2e-5)');
  checks.caudal = near(flow, 6.2e-5, 0.1e-5);                    // Eq 9.13 EXACTO

  // ── Ø máximo por turbulencia (Eq 9.15): 20 mm ──
  const dMax = cl.maxLineDiameter(flow, cl.WATER);
  console.log('Ø máx (turbulencia):', (dMax * 1000).toFixed(1), 'mm (libro 20)');
  checks.dMax = near(dMax * 1000, 20, 0.5);

  // ── Ø mínimo por caída de presión (Eq 9.17): L=0.6m, ΔP=100kPa → 3.7 mm ──
  const dMin = cl.minLineDiameter(flow, 0.6, 100e3, cl.WATER);
  console.log('Ø mín (presión):', (dMin * 1000).toFixed(1), 'mm (libro 3.7)');
  checks.dMin = near(dMin * 1000, 3.7, 0.15);

  // ── Reynolds a 6.35 mm debe ser turbulento (Re>4000) ──
  const re = cl.reynolds(flow, 6.35e-3, cl.WATER);
  console.log('Re @6.35mm:', re.toFixed(0), '(turbulento >4000)');
  checks.reTurbulento = re > 4000;

  // ── el resolvedor completo: cup/lid, Q total 4×260, 4 líneas ──
  const d = cl.designCoolingLines({ qTotalW: 260 * 4, nLines: 4, lineLenM: 0.6, dTallowC: 1, dPmaxPa: 100e3 });
  console.log('DISEÑO:', JSON.stringify({ flow: d.flowM3s.toExponential(2), gpm: d.flowGPM.toFixed(2), rango: `${d.dMinMm.toFixed(1)}-${d.dMaxMm.toFixed(1)}`, plug: d.plug?.dme, dia: d.plug?.diaMm, ctrl: d.controller, ok: d.ok }));
  checks.flow1gpm = near(d.flowGPM, 1.0, 0.05);                  // ≈ 1 GPM por línea
  checks.eligePlug = d.plug !== null && d.plug.diaMm >= 3.7 && d.plug.diaMm <= 20;
  checks.plug635 = d.plug.diaMm === 6.35;                        // el razonable del libro
  checks.controlador = d.controller.includes('VacTherm');       // aguanta el caudal total 2.5e-4
  checks.totalFlow = near(d.totalFlowM3s, 2.5e-4, 0.1e-4);       // 4×6.2e-5 = 2.5e-4 (libro)
  checks.viable = d.ok;

  // ── caso PRECISO (ΔT 0.1°C) exige 10× caudal → puede exceder un controlador ──
  const preciso = cl.designCoolingLines({ qTotalW: 260 * 8, nLines: 8, lineLenM: 0.6, dTallowC: 0.1, dPmaxPa: 100e3 });
  console.log('preciso 8cav ΔT0.1:', preciso.totalFlowM3s.toExponential(2), 'm³/s · ok:', preciso.ok);
  checks.precisoMasCaudal = preciso.flowM3s > 10 * flow / 1.0001;  // 10× por ΔT 0.1 vs 1

  // ── glicol/aceite: laminar (Hagen-Poiseuille), no turbulento ──
  const dpAgua = cl.linePressureDrop(flow, 0.6, 6.35e-3, cl.WATER);
  const dpAceite = cl.linePressureDrop(flow, 0.6, 6.35e-3, cl.OIL);
  checks.aceiteLaminar = dpAceite > dpAgua;                      // el aceite viscoso cae MÁS presión

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
