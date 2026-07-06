// TEST del molde de TRES PLACAS (Kazmer §6.3.2/§6.5.2) — anclas EXACTAS de la
// Tabla 6.1 y su nota de velocidad. Puro.
(async () => {
  const path = require('path');
  const tp = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'threeplate.ts'));
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};

  // ── nota de la Tabla 6.1: v = 184 + 13·log10(F). Para 100 t → ~210 mm/s EXACTO ──
  checks.v100t = ok(tp.moldOpeningVelocity(100), 210, 0.01);
  // los TIEMPOS de la tabla salen de d/v: 75/210=0.36 s (2 placas), 250/210=1.19≈1.2 s (3 placas)
  const cmp = tp.compareFeedSystems({
    twoPlate: { stackMm: 264, openMm: 75, massKg: 151 },
    threePlate: { stackMm: 308, openMm: 250, massKg: 181 },
    clampTons: 100,
  });
  console.log('Tabla 6.1 →', JSON.stringify(cmp));
  checks.t_2placas = ok(cmp.twoPlate.tOpenS, 0.36, 0.005);
  checks.t_3placas = ok(cmp.threePlate.tOpenS, 1.19, 0.02);          // libro redondea 1.2
  checks.daylight_2p = cmp.twoPlate.daylightMm === 339;              // 264+75 EXACTO
  checks.daylight_3p = cmp.threePlate.daylightMm === 558;            // 308+250 EXACTO

  // ── layout del vaso como 3 placas ──
  const L = tp.threePlateLayout({ partHeightMm: 70, clampTons: 100 });
  console.log('layout: stack', L.stackMm, '· A-B abre', L.openABMm, '· A-X abre', L.openAXMm, '· daylight', L.daylightMm, '· t', L.tOpenS, 's');
  checks.orden_stack = L.stack.map((r) => r.role).join(',') === 'movil-B,movil-B,movil-B,movil-B,movil-A,stripper,fija';
  checks.particiones = L.partingABz < L.partingAXz && L.stack[4].z0 === L.partingABz && L.stack[4].z1 === L.partingAXz;
  checks.apertura_2a3x = L.openABMm >= 2 * 70 && L.openABMm <= 3 * 70;   // "two to three times the height"
  checks.daylight_suma = ok(L.daylightMm, L.stackMm + L.openTotalMm, 1e-9);

  // ── cinemática de DOBLE apertura: B primero, A después, X quieta ──
  const early = tp.openingSequence(L, 0.3), late = tp.openingSequence(L, 0.95);
  checks.fase1_soloB = early.fase === 1 && early.dA === 0 && early.dB > 0;
  checks.fase2_AsigueB = late.fase === 2 && late.dA > 0 && ok(late.dB - late.dA, L.boltABfreeMm, 1e-9);
  checks.X_quieta = early.dX === 0 && late.dX === 0;
  // monotonía y límites
  let mono = true, prev = -1;
  for (let u = 0; u <= 1.001; u += 0.05) { const s = tp.openingSequence(L, u); if (s.dB < prev) mono = false; prev = s.dB; }
  checks.monotona = mono && ok(tp.openingSequence(L, 1).dB, L.openTotalMm, 1e-9);

  // ── sucker pin §6.5.2: chico vs runner (no restringe el flujo) ──
  const sp = tp.suckerPinDesign(6);
  checks.sucker_chico = sp.diaMm < 6 && sp.depthMm < 6 && sp.nota.includes('restringir');

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
