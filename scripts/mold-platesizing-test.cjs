// TEST del TAMAÑO DE PLACA (Kazmer cap 12 §12.1 + cap 9 §9.2.5) — reproduce el
// bezel del libro y verifica el acoplamiento deflexión/enfriamiento/pilares. Puro.
(async () => {
  const path = require('path');
  const ps = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'platesizing.ts'));
  const st = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'structural.ts'));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const checks = {};

  // ── bezel del libro: la placa de soporte de 120 mm deflecta 0.056 mm > 0.02 → FLASH ──
  const F = 200 * st.TON_N;
  const d120 = st.plateBending(F, 0.2159, 0.248, 0.120);
  console.log('bezel 120mm: δ', (d120.deflectionM * 1e3).toFixed(3), 'mm (libro 0.056, FLASH)');
  checks.bezel120Flash = d120.deflectionM * 1e3 > 0.02;

  // ── espesor mínimo por DEFLEXIÓN para dejar 0.02 mm: ~169 mm ──
  const tDefl = ps.thicknessByDeflection({ clampTons: 200, spanM: 0.2159, widthM: 0.248, ventGapM: 0.02e-3 });
  console.log('t por deflexión (venteo 0.02):', tDefl.toFixed(1), 'mm (~169)');
  checks.tDefl169 = near(tDefl, 169, 2);

  // ── aterriza en placa COMERCIAL 176 mm (Meusburger/HASCO) ──
  const plate = ps.snapToCommercialPlate(tDefl);
  console.log('placa comercial:', plate, 'mm');
  checks.snap176 = plate === 176;

  // ── el resolvedor SIN pilares con el LÍMITE PELÓN del libro (factorVenteo 1): gobierna
  //    deflexión, placa 176, ya NO flash — reproduce el bezel literal ──
  const s0 = ps.sizeSupportPlate({ clampTons: 200, spanM: 0.2159, widthM: 0.248, factorVenteo: 1 });
  console.log('SIN pilares:', JSON.stringify({ gob: s0.governs, t: s0.tRequiredMm, placa: s0.plateThkMm, δ: s0.deflectionAtPlateMm, flashOk: s0.flashOk, kg: s0.steelMassKg }));
  checks.s0Deflexion = s0.governs === 'deflexión';
  checks.s0Placa176 = s0.plateThkMm === 176;
  checks.s0NoFlash = s0.flashOk === true;

  // ── REGLA DE HEFESTOS (ian 2026-09-22): por defecto la placa se dimensiona a ≤ 70 % del venteo.
  //    t ∝ δ^(-1/3) → 169·(1/0.7)^⅓ ≈ 190 → placa de catálogo 196, flecha ≤ 0.014 mm ──
  const sH = ps.sizeSupportPlate({ clampTons: 200, spanM: 0.2159, widthM: 0.248 });
  console.log('SIN pilares · Hefestos 70 %:', JSON.stringify({ t: sH.tRequiredMm, placa: sH.plateThkMm, δ: sH.deflectionAtPlateMm, uso: sH.hefestos.usoPct, estado: sH.hefestos.estado }));
  checks.hefestosT190 = near(sH.tRequiredMm, 169 * Math.cbrt(1 / 0.7), 2);
  checks.hefestosPlaca196 = sH.plateThkMm === 196;
  checks.hefestosCumple = sH.hefestos.estado === 'CUMPLE' && sH.deflectionAtPlateMm <= 0.7 * 0.02 + 1e-9;
  // el juicio en sus tres escalones (una sola función para dimensionador, contrato y estación 11)
  checks.juicioEscalones = ps.juicioFlecha(0.014, 0.02).estado === 'CUMPLE' && ps.juicioFlecha(0.0191, 0.02).estado === 'VIOLA'
    && ps.juicioFlecha(0.016, 0.02).estado === 'ADVIERTE' && ps.juicioFlecha(0.0171, 0.02).estado === 'VIOLA' && ps.juicioFlecha(0.021, 0.02).rebaba === true;
  // la referencia de venteo: la más estricta entre la práctica 0.02 y el venteo de la E7
  checks.venteoReferencia = ps.venteoDeReferenciaMm(0.0503) === 0.02 && ps.venteoDeReferenciaMm(0.015) === 0.015 && ps.venteoDeReferenciaMm(undefined) === 0.02;

  // ── UN pilar parte el claro a la mitad → como δ∝claro³, placa MUCHO más fina ──
  const s1 = ps.sizeSupportPlate({ clampTons: 200, spanM: 0.2159, widthM: 0.248, nPillars: 1 });
  console.log('1 pilar:', JSON.stringify({ t: s1.tRequiredMm, placa: s1.plateThkMm, kg: s1.steelMassKg }));
  checks.pilarAdelgaza = s1.plateThkMm < s0.plateThkMm;          // 176 → ~86
  checks.pilarMenosAcero = s1.steelMassKg < s0.steelMassKg;      // menos material total

  // ── OPTIMIZADOR de material: elige el nº de pilares de MÍNIMO acero total ──
  const opt = ps.optimizeSupportPlate({ clampTons: 200, spanM: 0.2159, widthM: 0.248, maxPillars: 4 });
  console.log('ÓPTIMO:', JSON.stringify({ pilares: opt.best.nPillars, placa: opt.best.plateThkMm, kg: opt.best.steelMassKg, gob: opt.best.governs }),
    '| barrido kg:', opt.options.map((o) => `${o.nPillars}p→${o.plateThkMm}mm/${o.steelMassKg}kg`).join(' '));
  checks.optValido = opt.best.flashOk && opt.best.plateThkMm !== null;
  checks.optMinimo = opt.best.steelMassKg === Math.min(...opt.options.filter((o) => o.flashOk && o.plateThkMm).map((o) => o.steelMassKg));
  checks.optMejorQue0 = opt.best.steelMassKg < s0.steelMassKg;   // el óptimo ahorra material vs placa gruesa
  checks.optHefestos = opt.escalon === 'defecto' && opt.best.hefestos.estado === 'CUMPLE';

  // ── placa de CAVIDAD: pieza PLANA (tapa 5 mm) con línea 6.35 → gobierna el enfriamiento ──
  // t = prof 5 + 3·6.35 = 24.05 → placa comercial 27
  const lid = ps.sizeCavityPlate({ cavityDepthMm: 5, lineDiaMm: 6.35 });
  console.log('CAVIDAD tapa plana:', JSON.stringify({ gob: lid.governs, tras: lid.coolingBehindMm, t: lid.tRequiredMm, placa: lid.plateThkMm }));
  checks.lidCool = lid.governs === 'enfriamiento';
  checks.lidTras = near(lid.coolingBehindMm, 19.05, 0.2);
  checks.lidPlaca27 = lid.plateThkMm === 27;

  // ── placa de CAVIDAD: pieza HONDA (cup 60 mm) → gobierna la profundidad de la cavidad ──
  const cup = ps.sizeCavityPlate({ cavityDepthMm: 60, lineDiaMm: 6.35 });
  checks.cupHonda = cup.governs === 'cavidad' && cup.plateThkMm >= 79;

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
