// TEST del DFM checker (Kazmer §2.3) — reglas numéricas del libro, puro.
(async () => {
  const path = require('path');
  const dfm = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'dfm.ts'));
  const checks = {};

  // ── el DISEÑO TÍPICO del libro (Fig 2.3): costilla 70%/4×/10× con 2° → limpio ──
  const t = 2.0;
  const bueno = dfm.checkDFM({
    nominalWallMm: t,
    walls: [{ label: 'pared', thicknessMm: t }, { label: 'piso', thicknessMm: t }],
    ribs: [{ label: 'costilla tipo Fig 2.3', baseMm: 0.7 * t, heightMm: 4 * t, spacingMm: 10 * t, draftDeg: 2 }],
    bosses: [{ label: 'boss tornillo', wallMm: 0.7 * t, gussetMm: 0.7 * t }],
    corners: [{ label: 'esquina ext', kind: 'externo', radiusMm: 1.5 * t }, { label: 'esquina int', kind: 'interno', radiusMm: 0.5 * t }],
    surface: { finish: 'Clase B-3', roughnessUm: 12 },
    draftDeg: 1.5,
  });
  console.log('diseño del libro →', bueno.resumen[0]);
  checks.libro_limpio = bueno.errors === 0 && bueno.warns === 0 && bueno.score === 100;

  // ── violaciones que el LIBRO condena, una por una ──
  const rib80 = dfm.checkDFM({ nominalWallMm: t, ribs: [{ label: 'r', baseMm: 0.8 * t, heightMm: 4 * t }] });
  checks.rib_gruesa_sink = rib80.findings.some((f) => f.ref === '§2.3.2' && f.severity === 'error' && f.msg.includes('sink'));
  const rib80GF = dfm.checkDFM({ nominalWallMm: t, material: { cargado: true }, ribs: [{ label: 'r', baseMm: 0.8 * t, heightMm: 4 * t }] });
  checks.rib_gruesa_cargada_tolerada = rib80GF.errors === 0 && rib80GF.warns === 1;   // §2.3.2: "can be increased" con carga
  const viva = dfm.checkDFM({ nominalWallMm: t, corners: [{ label: 'c', kind: 'externo' }] });
  checks.esquina_viva_error = viva.findings.some((f) => f.ref === '§2.3.4' && f.severity === 'error');
  const paredes = dfm.checkDFM({ nominalWallMm: 3, walls: [{ label: 'a', thicknessMm: 3 }, { label: 'b', thicknessMm: 6, flujoDesdeDelgado: true }] });
  checks.pared_no_uniforme = paredes.findings.some((f) => f.ref === '§2.3.1' && f.msg.includes('ratio 2.00'));
  checks.jetting = paredes.findings.some((f) => f.msg.includes('jetting'));
  const under = dfm.checkDFM({ nominalWallMm: 2, undercuts: [{ label: 'ventana lateral', kind: 'ventana' }] });
  checks.undercut_avisa = under.findings.some((f) => f.ref === '§2.3.7' && f.msg.includes('slide'));

  // ── §2.3.6: Tabla 2.14 EXACTA + regla +1°/20µm ──
  checks.tabla214 = dfm.DRAFT_TABLE_214.length === 5 && dfm.DRAFT_TABLE_214[4].draftDeg === 7.5 && dfm.DRAFT_TABLE_214[0].draftDeg === 0.5;
  const dA1 = dfm.draftForFinish(0.01), dB3 = dfm.draftForFinish(12), dPiel = dfm.draftForFinish(125);
  console.log('draft rec: A-1', dA1.toFixed(2), '· B-3', dB3.toFixed(2), '· piel', dPiel.toFixed(2));
  checks.draft_A1 = Math.abs(dA1 - 0.5) < 0.01;
  checks.draft_B3 = dB3 >= 1.5 && dB3 <= 2.01;             // ancla tabla (1.5-2°) ≥ regla 1.1
  checks.draft_piel = dPiel >= 6.75 && dPiel <= 7.5;       // max(regla 6.75, ancla 7.5) = 7.5
  const pocoDraft = dfm.checkDFM({ nominalWallMm: 2, surface: { roughnessUm: 125 }, draftDeg: 2 });
  checks.draft_corto_avisa = pocoDraft.findings.some((f) => f.ref === '§2.3.6' && f.severity === 'warn');

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
