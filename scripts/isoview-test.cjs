// TEST de la vista isométrica (isoview.ts) — proyecta un cubo y verifica SVG. Puro.
(async () => {
  const path = require('path');
  const ISO = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'isoview.ts'));
  const checks = {};
  // cubo 10×10×10 (8 vértices, 12 triángulos)
  const P = [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10];
  const I = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 2, 6, 7, 2, 7, 3, 1, 5, 6, 1, 6, 2, 0, 3, 7, 0, 7, 4];
  const svg = ISO.isoView(P, I, { name: 'cubo', code: 'TST', material: 'acero' });
  console.log('svg len', svg.length, '· paths', (svg.match(/<path/g) || []).length);
  checks.svgValido = svg.startsWith('<svg') && svg.includes('</svg>');
  checks.tienePaths = (svg.match(/<path/g) || []).length >= 3;       // caras visibles del cubo (back-face culled)
  checks.tieneCajetin = svg.includes('ISOMÉTRICO') && svg.includes('cubo');
  checks.sombreado = /fill="rgb\(\d+,\d+,\d+\)"/.test(svg);          // relleno por normal·luz
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
