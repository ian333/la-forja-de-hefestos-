/**
 * PAQUETE DE PLANOS DE TALLER — molde del vaso (Kazmer, pieza 1 del checklist).
 * E-100 ensamble en SECCIÓN con globos+BOM · P-101 placa cavidad · P-102 placa
 * core (con tabla de barrenos cada una) · P-103 pieza con nota de contracción.
 * Geometría = la canónica del molde del cup (misma del ciclo/export).
 */
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

(async () => {
  const md = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawings.ts'));
  const out = process.env.OUT || '/tmp/mold-drawings';
  mkdirSync(out, { recursive: true });
  const save = (name, svg) => {
    writeFileSync(`${out}/${name}.svg`, svg);
    const png = new Resvg(svg, { background: '#ffffff', fitTo: { mode: 'width', value: 3840 } }).render().asPng();
    writeFileSync(`${out}/${name}.png`, png);
  };

  // ── E-100: ensamble en sección (stack canónico del molde del vaso, corte y=0) ──
  const asm = md.renderAssemblySection([
    { id: 1, name: 'Placa sujeción superior', qty: 1, material: '1045', rects: [{ x0: -70, z0: 100, x1: -8, z1: 120 }, { x0: 8, z0: 100, x1: 70, z1: 120 }] },
    { id: 2, name: 'Anillo centrador', qty: 1, material: '1045', rects: [{ x0: -20, z0: 120, x1: 20, z1: 125 }] },
    { id: 3, name: 'Boquilla de colada (sprue)', qty: 1, material: 'H13', rects: [{ x0: -8, z0: 94, x1: 8, z1: 120 }] },
    { id: 4, name: 'Placa core', qty: 1, material: 'P20', rects: [{ x0: -70, z0: 70, x1: -8, z1: 100 }, { x0: 8, z0: 70, x1: 70, z1: 100 }], circles: [{ x: -40, z: 85, dia: 6.35 }, { x: 0, z: 85, dia: 6.35, note: 'agua ⌀6.35' }, { x: 40, z: 85, dia: 6.35 }] },
    { id: 5, name: 'Macho (core) del vaso', qty: 1, material: 'P20', rects: [{ x0: -27, z0: 3, x1: -3, z1: 70 }, { x0: 3, z0: 3, x1: 27, z1: 70 }] },
    { id: 6, name: 'PIEZA · vaso ABS pared 3', qty: 1, material: 'ABS', solid: true, rects: [{ x0: -30, z0: 0, x1: -27, z1: 70 }, { x0: 27, z0: 0, x1: 30, z1: 70 }, { x0: -27, z0: 0, x1: 27, z1: 3 }] },
    { id: 7, name: 'Placa de cavidad', qty: 1, material: 'P20', rects: [{ x0: -70, z0: 0, x1: -30, z1: 70 }, { x0: 30, z0: 0, x1: 70, z1: 70 }, { x0: -70, z0: -30, x1: -31.5, z1: 0 }, { x0: -25.5, z0: -30, x1: 25.5, z1: 0 }, { x0: 31.5, z0: -30, x1: 70, z1: 0 }], circles: [{ x: -40, z: -15, dia: 6.35 }, { x: 0, z: -15, dia: 6.35, note: 'agua ⌀6.35' }, { x: 40, z: -15, dia: 6.35 }] },
    { id: 8, name: 'Placa soporte', qty: 1, material: '1045', rects: [{ x0: -70, z0: -55, x1: -31.5, z1: -30 }, { x0: -25.5, z0: -55, x1: 25.5, z1: -30 }, { x0: 31.5, z0: -55, x1: 70, z1: -30 }] },
    { id: 9, name: 'Riel (paralela)', qty: 2, material: '1045', rects: [{ x0: -70, z0: -115, x1: -30, z1: -55 }, { x0: 30, z0: -115, x1: 70, z1: -55 }] },
    { id: 10, name: 'Placa expulsora', qty: 1, material: '1045', rects: [{ x0: -20, z0: -100, x1: 20, z1: -90 }] },
    { id: 11, name: 'Placa retén de eyectores', qty: 1, material: '1045', rects: [{ x0: -20, z0: -90, x1: 20, z1: -76 }] },
    { id: 12, name: 'Pin eyector ⌀5×76', qty: 4, material: 'H13 nitrurado', rects: [{ x0: -31, z0: -76, x1: -26, z1: 0 }, { x0: 26, z0: -76, x1: 31, z1: 0 }] },
    { id: 13, name: 'Placa sujeción inferior', qty: 1, material: '1045', rects: [{ x0: -70, z0: -135, x1: 70, z1: -115 }] },
  ], {
    code: 'E-100', name: 'MOLDE VASO — ENSAMBLE',
    extra: 'MOLDE 2 PLACAS · CLAMP 45 t · t_ciclo 24.6 s · eyectores ABATIDOS al plano',
    extraBom: [
      ['14', 'Pilar guía ⌀20×155 (fuera de corte)', '4', 'DIN 9825'],
      ['15', 'Tornillo M10×30 DIN 912', '8', '12.9'],
      ['16', 'Resorte retorno eyectores', '4', 'ISO 10243'],
    ],
  });
  save('E-100-ensamble-seccion', asm.svg);
  console.log('E-100:', asm.nComps, 'comps en corte ·', asm.bom.length, 'filas BOM · escala', asm.scale);

  // ── P-101: placa de cavidad (140×140×100) ──
  const eject = [[90.15, 90.15], [49.85, 90.15], [49.85, 49.85], [90.15, 49.85]]; // a 45°: libran agua (x=30/70/110) y pilares
  const pilares = [[22, 22], [118, 22], [22, 118], [118, 118]];
  const tornillos = [[50, 12], [90, 12], [50, 128], [90, 128]]; // libran pilares (esquinas) y aguas (x=30/70/110)
  const p101 = md.renderPlateDrawing({
    code: 'P-101', name: 'PLACA DE CAVIDAD', material: 'P20 · 30-32 HRC', wmm: 140, dmm: 140, thickMm: 100,
    openings: [{ kind: 'circle', x: 70, y: 70, dia: 60.1, note: 'CAVIDAD (escala contracción incluida)' }],
    holes: [
      ...eject.map(([x, y]) => ({ x, y, dia: 5, type: 'eyector', note: 'ajuste H7/g6' })),
      ...pilares.map(([x, y]) => ({ x, y, dia: 20, type: 'pilar guía H7' })),
      ...tornillos.map(([x, y]) => ({ x, y, dia: 8.5, depth: 30, type: 'rosca M10×1.5' })),
    ],
    sideHoles: [
      { face: 'frente', z: 15, at: 30, dia: 6.35, type: 'agua NPT 1/8' },
      { face: 'frente', z: 15, at: 70, dia: 6.35, type: 'agua NPT 1/8' },
      { face: 'frente', z: 15, at: 110, dia: 6.35, type: 'agua NPT 1/8' },
    ],
  });
  save('P-101-placa-cavidad', p101.svg);
  console.log('P-101:', p101.nHoles, 'barrenos · escala', p101.scale);

  // ── P-102: placa core (140×140×30, boss aparte) ──
  const p102 = md.renderPlateDrawing({
    code: 'P-102', name: 'PLACA CORE', material: 'P20 · 30-32 HRC', wmm: 140, dmm: 140, thickMm: 30,
    openings: [{ kind: 'circle', x: 70, y: 70, dia: 16, note: 'ALOJA SPRUE ⌀16 H7' }],
    holes: [
      ...pilares.map(([x, y]) => ({ x, y, dia: 20, type: 'buje guía H7' })),
      ...tornillos.map(([x, y]) => ({ x, y, dia: 10.5, type: 'pasante M10' })),
      { x: 70, y: 70 - 27, dia: 3, depth: 20, type: 'venteo h 0.06 (cap 8)' },
    ],
    sideHoles: [
      { face: 'frente', z: 15, at: 30, dia: 6.35, type: 'agua NPT 1/8' },
      { face: 'frente', z: 15, at: 70, dia: 6.35, type: 'agua NPT 1/8' },
      { face: 'frente', z: 15, at: 110, dia: 6.35, type: 'agua NPT 1/8' },
    ],
  });
  save('P-102-placa-core', p102.svg);
  console.log('P-102:', p102.nHoles, 'barrenos · escala', p102.scale);

  // ── P-103: la PIEZA (vaso) — SECCIÓN de revolución acotada (el HLR del
  // 48-gon salía como cerca de líneas; una pieza revolucionada se planea en corte) ──
  const p103 = md.renderAssemblySection([
    { id: 1, name: 'Vaso ABS', qty: 1, material: 'ABS', solid: true, rects: [
      { x0: -30, z0: 0, x1: -27, z1: 70 }, { x0: 27, z0: 0, x1: 30, z1: 70 }, { x0: -27, z0: 0, x1: 27, z1: 3 }] },
  ], {
    code: 'P-103', name: 'VASO (pieza)', extra: 'PIEZA MOLDEADA · ABS',
    sectionLabel: 'SECCIÓN DE REVOLUCIÓN (eje vertical)',
    notes: [
      '⌀ exterior 60.0 · ⌀ interior 54.0 · altura 70.0',
      'pared 3.0 · base 3.0 (uniforme, Kazmer §2.3.1)',
      'contracción ABS 0.55% → CAVIDAD escala ×1.0055',
      'masa 46.6 g · draft pendiente v2 (§2.3.6)',
    ],
  });
  save('P-103-pieza-vaso', p103.svg);
  console.log('P-103: sección de revolución ·', p103.bom.length, 'item');

  console.log('PLANOS_MOLDE_OK →', out);
  process.exit(0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
