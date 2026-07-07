// TEST del PLANO DE ENSAMBLE — arma el molde del bezel con las dimensiones
// RESUELTAS (placas/core/agua/expulsores) y verifica que el ensamble lista cada
// pieza mecánica + genera el SVG. Puro.
(async () => {
  const path = require('path'); const fs = require('fs');
  const ma = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-assembly.ts'));
  const checks = {};

  // bezel: dimensiones de los resolvedores (base 346, soporte 36+4 pilares, core, JP-553 ⌀11, expulsores)
  const spec = {
    name: 'Molde bezel laptop', code: 'MLD-BEZEL',
    widthMm: 346,
    plates: { bottomClamp: 30, ejectorHousing: 60, support: 36, B: 66, A: 76, topClamp: 30 },
    supportPillars: 4,
    cavity: { widthMm: 240, depthMm: 10 },
    cooling: { diaMm: 11, plug: 'JP-553', insetMm: 60 },
    ejectors: { type: 'pin', diaMm: 8, count: 20 },
    core: { diaMm: 90, material: 'AISI P20' },
    cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    machine: 'IM-250', clampTons: 213,
  };

  const { comps, partings } = ma.buildMoldStack(spec);
  const names = comps.map((c) => c.name);
  console.log('PIEZAS:', names.length, '→', names.map((n) => n.split(' ')[0]).join(', '));
  checks.tienePlacas = ['Placa de sujeción inferior', 'Placa de soporte', 'Placa B (núcleo)', 'Placa A (cavidad)', 'Placa de sujeción superior'].every((n) => names.includes(n));
  checks.tieneCore = names.some((n) => n.includes('núcleo (core)'));
  checks.tienePieza = comps.some((c) => c.solid === true);              // la pieza de plástico
  checks.tieneAgua = comps.some((c) => (c.circles ?? []).length === 4); // 4 líneas de agua cortadas
  checks.tieneExpulsores = comps.some((c) => c.name.includes('Expulsor') && c.qty === 20);
  checks.tieneParticion = partings.length === 1 && partings[0].label.includes('PARTICIÓN');

  const dwg = ma.moldAssemblyDrawing(spec);
  console.log('BOM filas:', dwg.bom.length, '· nComps:', dwg.nComps, '· escala:', dwg.scale);
  checks.svgValido = dwg.svg.startsWith('<svg') && dwg.svg.includes('</svg>') && dwg.svg.length > 2000;
  checks.bomCompleto = dwg.bom.length >= 9;                             // ≥9 renglones de pieza
  checks.cajetin = dwg.svg.includes('title-block') && dwg.svg.includes('ISO 2768');
  checks.notasAnalisis = dwg.svg.includes('§12.3') || dwg.svg.includes('§12.1') || dwg.svg.includes('deflexión');

  // escribe el SVG para renderizarlo a PNG y entregarlo
  const out = '/tmp/plano-ensamble-bezel.svg';
  fs.writeFileSync(out, dwg.svg);
  console.log('SVG escrito:', out, `(${(dwg.svg.length / 1024).toFixed(1)} KB)`);

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
