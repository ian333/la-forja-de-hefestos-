/**
 * VISTA 3D CON COTAS — "cada componente tiene medidas y coordenadas; es una hueva ir
 * midiendo en Fusion. COTAS EN 3D. Encontrarás errores: como no hay suficiente
 * información en pantalla no extraes todos los errores" (user 2026-07-15).
 *
 * Dibuja el sólido reconstruido desde la RECETA (aristas B-Rep reales, no malla) en
 * isométrico + las cotas ACOTADAS CON DOS CIFRAS: lo que la receta dice y lo que el
 * sólido mide. Si no cuadran, la cota sale en ROJO — el error se ve, no se deduce.
 *
 * Sale SVG (texto real) → PNG por navegador headless (2D puro, sin GPU).
 * Uso: node --import tsx scripts/mold-cotas3d.cjs <outdir> [A|B] [--edit espesor=90]
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');

const ROOT = path.resolve(__dirname, '..');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}

const bezel = {
  name: 'Bezel', code: 'MLD-BEZEL', widthMm: 381,
  plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
  cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
  cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 }, ejectors: { type: 'pin', diaMm: 3, count: 20 },
  core: { widthMm: 240, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
  clampTons: 200, feed: 'hot-runner', nCav: 1,
};

// isométrico: mundo(x,y,z) → pantalla(px,py) + profundidad
const ISO = (p) => {
  const a = Math.PI / 6;                            // 30° clásico de dibujo técnico
  return [(p[0] - p[1]) * Math.cos(a), (p[0] + p[1]) * Math.sin(a) - p[2], p[0] + p[1] + p[2]];
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

(async () => {
  const outDir = process.argv[2] || '/tmp/cotas';
  const role = ['B','tupper'].includes(process.argv[3]) ? process.argv[3] : 'A';
  const editArg = process.argv.find((a) => a.startsWith('--edit='));
  mkdirSync(outDir, { recursive: true });

  const occtFactory = require(cjsGlue);
  const oc = await occtFactory({ wasmBinary: readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const TL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'timeline.ts'));
  const RC = await import(path.join(ROOT, 'src', 'forja', 'mold', 'mold-recipe.ts'));
  const DM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'mold-dimensions.ts'));

  const TP = await import(path.join(ROOT, 'src', 'forja', 'mold', 'parts', 'tupper.ts'));
  // 'tupper' = cotar la PIEZA construida; A/B = cotar la placa del molde
  const esPieza = role === 'tupper';
  let comp = esPieza ? TP.tupperRecipe() : RC.moldRecipe(bezel).find((c) => c.role === role);
  let tag = role;
  if (editArg) {                                     // MODIFICAR el molde y re-cotar
    const [k, v] = editArg.slice(7).split('=');
    const map = esPieza
      ? { alto: ['ex-alto', 'distance'], largo: ['sk-boca', 'w'], pared: ['vaciado', 'thickness'], salida: ['salida', 'angleDeg'] }
      : { espesor: ['ex-espesor', 'distance'], ancho: ['sk-contorno', 'w'], fondo: ['sk-contorno', 'h'] };
    const [fid, pkey] = map[k] ?? [];
    if (fid) { comp = { ...comp, timeline: TL.editFeature(comp.timeline, fid, { [pkey]: Number(v) }) }; tag = `${role}-${k}${v}`; }
    console.log(`EDICIÓN: ${k} → ${v}`);
  }

  const r = TL.rebuild(K, oc, comp.timeline);
  if (!r.shape) { console.log('sin sólido:', r.steps.filter((s) => !s.ok).map((s) => s.error).join(' | ')); process.exit(1); }
  const dims = esPieza ? DM.partDims(comp) : DM.componentDims(comp);
  const v = DM.verifyDims(dims, r.measure);

  console.log(`\n${comp.name} — ${r.steps.filter((s) => s.ok).length}/${r.steps.length} pasos · medido ${r.measure.bbox.join(' × ')} mm`);
  console.log('COTAS (receta vs sólido):');
  for (const d of v.dims) {
    const mark = d.ok === true ? '✓' : d.ok === false ? '❌' : '·';
    console.log(`  ${mark} ${d.label.padEnd(14)} receta ${String(d.value).padStart(7)}${d.measured != null ? `  medido ${String(d.measured).padStart(7)}` : ''}`);
  }
  if (v.errors.length) console.log(`\n⚠ ${v.errors.length} COTA(S) NO CUADRAN: ${v.errors.map((d) => `${d.label} ${d.value}≠${d.measured}`).join(' · ')}`);

  // ── aristas B-Rep reales del sólido ──
  const edges = K.enumerateEdgesGeom(oc, r.shape, 24);
  const pts = [];
  for (const e of edges) for (const p of e.polyline) pts.push(ISO(p));
  for (const d of v.dims) { pts.push(ISO(d.a)); pts.push(ISO(d.b)); }
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (const p of pts) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); }
  const W = 1500, H = 1000, mg = 150;
  const sc = Math.min((W - 2 * mg) / (mxx - mnx), (H - 2 * mg) / (mxy - mny));
  const PX = (p3) => { const p = ISO(p3); return [(p[0] - (mnx + mxx) / 2) * sc + W / 2, (p[1] - (mny + mxy) / 2) * sc + H / 2]; };

  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="#14161c"/>`,
    `<style>text{font-family:ui-monospace,Menlo,monospace;font-size:15px}</style>`];
  // sólido: aristas reales del kernel
  for (const e of edges) {
    const d = e.polyline.map((p, i) => `${i ? 'L' : 'M'}${PX(p).map((q) => q.toFixed(1)).join(',')}`).join(' ');
    svg.push(`<path d="${d}" fill="none" stroke="#7f8da6" stroke-width="1.2"/>`);
  }
  // COTAS: línea + texto con las DOS cifras
  const COL = { ok: '#7ee0a0', bad: '#ff6b6b', plain: '#f2c14e' };
  for (const d of v.dims) {
    const c = d.ok === false ? COL.bad : d.ok === true ? COL.ok : COL.plain;
    const [ax, ay] = PX(d.a), [bx, by] = PX(d.b);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    svg.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${c}" stroke-width="${d.ok === false ? 3 : 1.8}"/>`);
    for (const [px, py] of [[ax, ay], [bx, by]]) svg.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.2" fill="${c}"/>`);
    const txt = d.measured != null
      ? `${d.label} ${d.value}${d.ok ? ` = ${d.measured} ✓` : ` ≠ ${d.measured} ✗`}`
      : `${d.label} ${d.value}`;
    svg.push(`<rect x="${(mx - 4).toFixed(1)}" y="${(my - 15).toFixed(1)}" width="${txt.length * 8.6 + 8}" height="20" rx="3" fill="#0d0f14" opacity="0.86"/>`);
    svg.push(`<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" fill="${c}">${esc(txt)}</text>`);
  }
  // encabezado + veredicto
  svg.push(`<text x="24" y="34" fill="#dfe6f2" font-size="20">${esc(comp.name)} · ${esc(comp.material)}</text>`);
  svg.push(`<text x="24" y="58" fill="#8d99ad">receta: ${comp.timeline.map((f) => f.id).join(' → ')}</text>`);
  const vc = v.errors.length ? COL.bad : COL.ok;
  svg.push(`<text x="24" y="${H - 24}" fill="${vc}" font-size="18">${v.errors.length ? `⚠ ${v.errors.length} COTA(S) NO CUADRAN CON EL SÓLIDO` : `✓ ${v.okCount} cotas verificadas contra el sólido`}</text>`);
  svg.push('</svg>');
  const svgPath = path.join(outDir, `cotas-${tag}.svg`);
  writeFileSync(svgPath, svg.join('\n'));

  // SVG → PNG (2D puro: no necesita GPU)
  const { chromium } = require('playwright');
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await pg.setContent(`<body style="margin:0">${svg.join('')}</body>`);
  const png = path.join(outDir, `cotas-${tag}.png`);
  await pg.screenshot({ path: png });
  await b.close();
  console.log(`\n→ ${png}`);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
