// TEST de la vista isométrica (isoview.ts) — proyecta un cubo y verifica SVG. Puro.
(async () => {
  const path = require('path');
  const ISO = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'isoview.ts'));
  const checks = {};
  // cubo 10×10×10 (8 vértices, 12 triángulos)
  const P = [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10];
  const I = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 2, 6, 7, 2, 7, 3, 1, 5, 6, 1, 6, 2, 0, 3, 7, 0, 7, 4];
  // normales por vértice (normalizadas del origen, aprox) y aristas del cubo
  const N = []; for (let i = 0; i < P.length; i += 3) { const l = Math.hypot(P[i] - 5, P[i + 1] - 5, P[i + 2] - 5) || 1; N.push((P[i] - 5) / l, (P[i + 1] - 5) / l, (P[i + 2] - 5) / l); }
  const E = [{ polyline: [[0, 0, 10], [10, 0, 10]] }, { polyline: [[10, 0, 10], [10, 10, 10]] }];
  const svg = ISO.isoView(P, I, N, E, { name: 'cubo', code: 'TST', material: 'acero' });
  console.log('svg len', svg.length, '· paths', (svg.match(/<path/g) || []).length, '· lines', (svg.match(/<line/g) || []).length);
  checks.svgValido = svg.startsWith('<svg') && svg.includes('</svg>');
  checks.tienePaths = (svg.match(/<path/g) || []).length >= 3;       // caras visibles del cubo (back-face culled)
  checks.tieneCajetin = svg.includes('ISOMÉTRIC') && svg.includes('cubo');
  checks.sombreado = /fill="rgb\(\d+,\d+,\d+\)"/.test(svg);          // relleno por normal·luz
  checks.aristasReales = svg.includes('#0e1216');                    // aristas B-Rep superpuestas
  // partSheet4View: compone 3 vistas (svg dummy) + iso en A3
  const sheet = ISO.partSheet4View('<svg viewBox="0 0 297 210"><rect width="297" height="210" fill="#fff"/></svg>', { positions: P, indices: I, normals: N, edges: E }, { name: 'cubo' });
  checks.cuatroVistas = sheet.includes('4 vistas') && sheet.includes('ISOMÉTRIC') && sheet.includes('<svg');
  // COLOR + TRANSLUCIDEZ: material ámbar translúcido → fill-opacity + tono cálido (R>B)
  const amber = ISO.isoView(P, I, N, E, { name: 'cubo' }, { color: [224, 122, 48], opacity: 0.55, edgeColor: '#5a2a10' });
  checks.translucido = amber.includes('<g opacity="0.55">');        // opacity de GRUPO (funde fill+stroke: sin telaraña)
  const m = amber.match(/fill="rgb\((\d+),(\d+),(\d+)\)"/);
  checks.colorCalido = !!m && Number(m[1]) > Number(m[3]);          // rojo domina (ámbar) vs gris-acero
  checks.aristaColor = amber.includes('#5a2a10');                    // edgeColor propagado
  const transSheet = ISO.partSheet4View('<svg viewBox="0 0 297 210"><rect width="297" height="210"/></svg>', { positions: P, indices: I, normals: N, edges: E }, { name: 'placa' }, { color: [150, 165, 185], opacity: 0.6 });
  checks.sheetTranslucido = transSheet.includes('<g opacity="0.6">') && transSheet.includes('translúcido');
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
