// TEST del PLANO DE ENSAMBLE — arma el molde del bezel con las dimensiones
// RESUELTAS (placas/core/agua/expulsores) y verifica que el ensamble lista cada
// pieza mecánica + genera el SVG. Puro.
(async () => {
  const path = require('path'); const fs = require('fs');
  const ma = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-assembly.ts'));
  const checks = {};

  // bezel: cotas LITERALES del libro (§ citado); el resto = placa comercial estándar
  const spec = {
    name: 'Molde bezel laptop', code: 'MLD-BEZEL',
    widthMm: 381,                                              // placa 381×302 (§12.2, LIBRO)
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 }, // soporte 120mm (§12.2 LIBRO); resto placa estándar
    supportPillars: 0,
    cavity: { widthMm: 248, depthMm: 10 },                     // cavidad 248×168 (§12.2, LIBRO); prof = pared 10mm (§11.2)
    cooling: { diaMm: 9.53, plug: 'JP-352', insetMm: 70 },     // ⌀ por tamaño de pieza (§4.2.1/§9.2)
    ejectors: { type: 'pin', diaMm: 2.23, count: 20 },         // 20 pines ⌀2.23 (§11.2.3, LIBRO)
    core: { widthMm: 248, material: 'AISI P20' },              // marco (no ⌀ inventado)
    cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    machine: 'clamp 200 t (§12.2) / 1400 kN (§11.2)', clampTons: 200,
  };

  const { comps, partings } = ma.buildMoldStack(spec);
  const names = comps.map((c) => c.name);
  console.log('PIEZAS:', names.length, '→', names.map((n) => n.split(' ')[0]).join(', '));
  checks.tienePlacas = ['Placa de sujeción inferior', 'Placa de soporte', 'Placa B (núcleo)', 'Placa A (cavidad)', 'Placa de sujeción superior'].every((n) => names.includes(n));
  checks.tieneCore = names.some((n) => n.includes('núcleo'));   // core (⌀) o marco (bloque)
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
