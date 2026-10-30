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
  // LOS APAGONES (2026-10-24): el cajetín ya no imprime ISO 2768-mK / Ra 0.8 / H7·6H / «DIBUJÓ: La Forja CAD» (nadie los
  // calculó): la tolerancia general la fija el fabricante y REVISÓ/APROBÓ son firmas humanas. El check mide eso, y que lo
  // inventado NO vuelva.
  checks.cajetin = dwg.svg.includes('title-block') && dwg.svg.includes('la fija el fabricante del molde') && dwg.svg.includes('REVISÓ')
    && dwg.svg.includes('APROBÓ') && !/ISO 2768|Ra 0\.8|La Forja CAD|roscas 6H/.test(dwg.svg);
  checks.notasAnalisis = dwg.svg.includes('§12.3') || dwg.svg.includes('§12.1') || dwg.svg.includes('deflexión');

  // ── LA ORDEN J (2026-10-29): lo que el herramentista cazaba en cinco minutos NO VUELVE ──────────────────────────────
  // Una base 246 como la de la carcasa 1594C (pila, pared y pines de la carcasa; las posiciones exactas de los pines por
  // agarre solo existen en la app: aquí la rejilla). En la app lo mide `mide-expediente` con getBBox (CIERRE de la orden J).
  {
    const ds = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));
    const mb = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldbase.ts'));
    const caja = {
      name: 'Molde caja 246', code: 'MLD-CAJA', plastic: 'ABS', widthMm: 246, depthMm: 246,
      plates: { bottomClamp: 36, ejectorHousing: 96, support: 22, B: 36, A: 66, topClamp: 36 }, supportPillars: 3,
      cavity: { widthMm: 106.5, lenMm: 66, depthMm: 33.3, shape: 'rect', wallMm: 3.2 },
      cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 37 }, ejectors: { type: 'pin', diaMm: 4.763, count: 8 },
      core: { widthMm: 106.5, material: 'P20' }, cavityMetal: 'P20', baseSteel: '1.1730 (C45)', feed: 'cold-2placas', nCav: 1,
    };
    const D = ds.plateDepth(caja), mg = ds.expulsoraMargenes(caja, D);
    // 1 · KO: dentro de la expulsora REAL, con ½⌀ de acero al canto (antes: 123 ± 60 = 63 / 183 en una placa de 65 a 181)
    const ko = ds.koLayout(caja, D);
    const dentro = (x) => x - mg.mxMm >= ko.diaMm && (caja.widthMm - mg.mxMm) - x >= ko.diaMm;
    checks.J_koDentroDeLaExpulsora = ko.pts.length > 0 && ko.pts.every(([x]) => dentro(x))
      && ['support', 'bottom', 'ejector'].every((r) => ds.standardHoles(caja, r).filter((h) => /KO/.test(h.type)).every((h) => dentro(h.x)));
    checks.J_koControlViejoFuera = !dentro(caja.widthMm / 2 - 60) && !dentro(caja.widthMm / 2 + 60);   // el patrón viejo SÍ caía fuera
    // 2 · pilares: renglón en la BOM y posición en las láminas de soporte, sujeción inferior, retenedora y expulsora
    const set = ds.moldDrawingSet(caja, []);
    const pil = ds.supportPillarPositions(caja, D);
    const hoja = (n) => (set.pages.find((p) => p.name === n) || { svg: '' }).svg;
    checks.J_pilaresEnBom = pil.length > 0 && new RegExp(`Pilar de soporte ⌀${ds.PILAR_SOPORTE_DIA_MM} × 96`).test(hoja('Ensamble'));
    checks.J_pilaresEnLaminas = ['Placa de soporte', 'Placa de sujeción inferior'].every((n) => (hoja(n).match(/pilar de soporte L96/g) || []).length === pil.length)
      && ['Placa retenedora (cabezas)', 'Placa expulsora'].every((n) => (hoja(n).match(/holgura del pilar de soporte/g) || []).length === pil.length);
    // 5 · guía: UN ⌀ en la tabla de la base, la lámina de A, la de B y la BOM
    const g = mb.guiaNominalMm(caja.widthMm);
    checks.J_unaGuia = ds.standardHoles(caja, 'A').filter((h) => /pilar guía/.test(h.type)).every((h) => h.dia === g)
      && new RegExp(`asiento buje guía ⌀${g}`).test(hoja('Placa A (cavidad)')) && new RegExp(`poste guía ⌀${g}`).test(hoja('Placa B (núcleo)'))
      && new RegExp(`Poste guía ⌀${g} ×`).test(hoja('Ensamble')) && !/pilares ⌀16/.test(set.pages.map((p) => p.svg).join(''));
    // 4 · la hoja: la tabla vive DENTRO del marco y un valor largo se PARTE en renglones (en la app lo juzga getBBox)
    const largo = Array.from({ length: 8 }, (_, k) => `MLD-CAJA-EP-0${k + 1} L152.8`).join(' · ');
    const an = ds.moldDrawingSet(caja, [{ grupo: 'Expulsión §11.2.6', param: 'tabla de eyectores', valor: largo, ref: '§11.2.6', ok: true }]).pages.find((p) => p.name === 'Análisis').svg;
    const rects = [...an.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map((m) => +m[1] + +m[2]);
    checks.J_hojaDentroDelMarco = rects.length > 0 && Math.max(...rects) <= 415 + 1e-6;
    checks.J_hojaParteLoLargo = (an.match(/MLD-CAJA-EP-0\d L152\.8/g) || []).length === 8 && (an.match(/<text[^>]*>[^<]*MLD-CAJA-EP-0/g) || []).length >= 2;
    console.log(`ORDEN J · KO ${JSON.stringify(ko.pts)} en expulsora ${mg.mxMm}..${caja.widthMm - mg.mxMm} · pilares ${JSON.stringify(pil)} · guía ⌀${g}`);
  }

  // escribe el SVG para renderizarlo a PNG y entregarlo
  const out = '/tmp/plano-ensamble-bezel.svg';
  fs.writeFileSync(out, dwg.svg);
  console.log('SVG escrito:', out, `(${(dwg.svg.length / 1024).toFixed(1)} KB)`);

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
