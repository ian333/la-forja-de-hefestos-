// TEST de los planos de molde (mold-drawings.ts): tabla de barrenos fiel al
// registro + BOM completa + achurado + línea de partición. Puro (sin wasm).
(async () => {
  const path = require('path');
  const md = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawings.ts'));
  const checks = {};

  // ── plano de placa ──
  const plate = md.renderPlateDrawing({
    code: 'P-101', name: 'Placa de cavidad', material: 'P20', wmm: 140, dmm: 140, thickMm: 100,
    openings: [{ kind: 'circle', x: 70, y: 70, dia: 60.1, note: 'CAVIDAD' }],
    holes: [
      { x: 98.5, y: 70, dia: 5, type: 'eyector' }, { x: 70, y: 98.5, dia: 5, type: 'eyector' },
      { x: 41.5, y: 70, dia: 5, type: 'eyector' }, { x: 70, y: 41.5, dia: 5, type: 'eyector' },
      { x: 22, y: 22, dia: 20, type: 'pilar guía H7' }, { x: 118, y: 118, dia: 20, type: 'pilar guía H7' },
      { x: 12, y: 12, dia: 8.5, depth: 30, type: 'rosca M10' },
    ],
    sideHoles: [{ face: 'frente', z: 15, at: 30, dia: 6.35, type: 'línea de agua' }],
  });
  checks.plateHoles = plate.nHoles === 7 && plate.rows.length === 7;
  checks.plateTable = plate.svg.includes('data-testid="hole-table"') && plate.svg.includes('TABLA DE BARRENOS');
  checks.plateCoords = plate.rows[0][1] === '98.50' && plate.rows[0][3] === '⌀5' && plate.rows[6][4] === '30.0';
  checks.platePasante = plate.rows[0][4] === 'PASANTE';
  checks.plateOpening = plate.svg.includes('data-part="opening"');
  checks.plateSide = plate.svg.includes('data-sidehole');
  checks.plateHoleMarks = (plate.svg.match(/data-hole="/g) || []).length === 7;

  // ── ensamble en sección ──
  const asm = md.renderAssemblySection([
    { id: 1, name: 'Placa de cavidad', qty: 1, material: 'P20', rects: [{ x0: -70, z0: -30, x1: 70, z1: 0 }, { x0: -70, z0: 0, x1: -30, z1: 70 }, { x0: 30, z0: 0, x1: 70, z1: 70 }], circles: [{ x: -40, z: -15, dia: 6.35, note: 'agua' }] },
    { id: 2, name: 'Placa core', qty: 1, material: 'P20', rects: [{ x0: -70, z0: 70, x1: 70, z1: 100 }] },
    { id: 3, name: 'Pieza (vaso)', qty: 1, material: 'ABS', solid: true, rects: [{ x0: -30, z0: 0, x1: -27, z1: 70 }] },
  ], { code: 'E-100', name: 'Molde vaso — ensamble', extraBom: [['9', 'Pilar guía ⌀20', '4', 'DIN 9825']] });
  checks.bom = asm.bom.length === 4 && asm.bom[3][1].includes('Pilar');
  checks.balloons = (asm.svg.match(/data-balloon="/g) || []).length === 3;
  checks.hatch = asm.svg.includes('data-hatch="1"');
  checks.solidPart = asm.svg.includes('#c9531f');
  checks.particion = asm.svg.includes('LÍNEA DE PARTICIÓN');
  checks.aguaCircle = asm.svg.includes('data-comp-circle="1"');
  checks.bomTable = asm.svg.includes('data-testid="bom-table"');

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
