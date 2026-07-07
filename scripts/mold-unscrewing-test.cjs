// TEST de moldes de NÚCLEO MÓVIL (Kazmer §13.9.2-13.9.3): roscas internas,
// tubos, collapsible vs rotating cores. Puro.
(async () => {
  const path = require('path');
  const u = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'unscrewing.ts'));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const checks = {};

  // ── tapa roscada de refresco: ⌀28, paso 3, 12 mm de rosca ──
  const tapa = { innerDiaMm: 28, pitchMm: 3, threadLenMm: 12, wallMm: 1.5 };
  checks.vueltas = near(u.unscrewTurns(tapa), 4.0, 1e-9);       // L/paso = 12/3 = 4 EXACTO
  const tq = u.unscrewTorque(tapa);
  // presión de contacto = ΔT·CTE·E = (132-97)·8.83e-5·2.28e9 = 7.05 MPa (contracción cap 11)
  checks.presion_contraccion = near(tq.contactPMPa, 7.05, 0.1);
  checks.torque_positivo = tq.torqueNm > 10 && tq.torqueNm < 200;
  checks.torque_escala_radio = u.unscrewTorque({ ...tapa, innerDiaMm: 56 }).torqueNm > 3 * tq.torqueNm; // ×2 ⌀ → área×2 y r×2 → ×4

  // ── collapsible: colapso = 6% del ⌀ ──
  const col = u.collapsibleCoreCheck(tapa);
  checks.collapse_6pct = near(col.collapseMm, 0.06 * 28, 1e-9);
  // la tapa ⌀28 paso 3: colapso 1.68 < rosca 1.8 → NO aplica collapsible
  checks.tapa_collapse_insuf = !col.aplica;
  // un tubo grande ⌀50 paso 4: colapso 3.0 ≥ rosca 2.4 → SÍ aplica
  const tubo = { innerDiaMm: 50, pitchMm: 4, threadLenMm: 40, wallMm: 2 };
  checks.tubo_collapse_ok = u.collapsibleCoreCheck(tubo).aplica;
  // ⌀ fuera de rango comercial (13-90) → núcleo a medida
  checks.rango_comercial = !u.collapsibleCoreCheck({ ...tapa, innerDiaMm: 120 }).aplica;

  // ── hélice: paso = carrera/vueltas, ángulo grueso ──
  const hx = u.helixDrive(tapa, 120);                          // 120 mm de carrera, 4 vueltas
  checks.helix_paso = near(hx.helixPitchMm, 30, 1e-9);         // 120/4 = 30 mm/vuelta
  checks.helix_grueso = hx.grueso;                             // 30 mm sobre ⌀40 → ángulo >25° = grueso
  // carrera corta → hélice fina → advierte
  checks.helix_fino_avisa = !u.helixDrive(tapa, 20).grueso;

  // ── DECISOR §13.9 ──
  // 64 cavidades de tapa roscada con interior LIMPIO → planetario (Fig 13.32 del libro)
  const d64 = u.chooseInternalCoreMethod({ thread: tapa, nCavities: 64, interiorLimpio: true });
  console.log('64 tapas roscadas →', d64.method, '·', d64.turns.toFixed(1), 'vueltas ·', d64.torqueNm.toFixed(0), 'N·m');
  checks.tapas64_planetario = d64.method === 'rotating-planetary';
  // 4 cavidades, interior limpio, hélice gruesa → hélice
  const d4 = u.chooseInternalCoreMethod({ thread: { innerDiaMm: 28, pitchMm: 3, threadLenMm: 12, wallMm: 1.5 }, nCavities: 4, interiorLimpio: true, strokeMm: 120 });
  console.log('4 tapas (interior limpio) →', d4.method);
  checks.tapas4_helice = d4.method === 'rotating-helix';
  // tubo grande, interior NO crítico → collapsible (barato)
  const dtubo = u.chooseInternalCoreMethod({ thread: tubo, nCavities: 4, interiorLimpio: false });
  console.log('tubo ⌀50 (interior no crítico) →', dtubo.method);
  checks.tubo_collapsible = dtubo.method === 'collapsible';
  // el decisor SIEMPRE avisa lo de la anti-rotación en los rotativos
  checks.avisa_antirotacion = d64.report.some((r) => r.includes('ANTI-ROTACIÓN'));

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
