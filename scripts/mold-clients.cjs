/**
 * CLIENTES REALES — el examen de fuego. Tres piezas de cliente construidas como
 * SÓLIDOS del kernel (geometría real, cotas literales del producto), medidas con
 * el kernel (bbox + volumen + superficie), pasadas por LA MÁQUINA DE MOLDES →
 * arquitectura (colada caliente para alto volumen), y salidas como el juego
 * COMPLETO de planos + análisis (mismo motor que la UI: buildMoldLaminas).
 *
 *   Sony  — carcasa de control (ABS, 2 M/año)      → colada CALIENTE
 *   LEGO  — ladrillo 2×4 (ABS, 20 M/año)           → colada CALIENTE multi-cavidad
 *   Genérico — charola (PP, 200 k/año)             → colada FRÍA
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { chromium } = require('playwright');

const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const occtFactory = require(cjsGlue);
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

// ── piezas de CLIENTE como sólidos del kernel (cotas reales del producto) ──
function buildClientPart(K, oc, key) {
  const openFace = (b, wantTop) => {
    const fs = K.enumerateFaces(oc, b); let idx = 0, best = wantTop ? -1e9 : 1e9;
    fs.forEach((f, i) => { if (f.centroid && (wantTop ? f.centroid[2] > best : f.centroid[2] < best)) { best = f.centroid[2]; idx = i; } });
    return idx;
  };
  if (key === 'lego') {
    // LEGO 2×4: 31.8 × 15.8 × 9.6, pared 1.5, 8 studs ⌀4.8 h1.8 (grid 8 mm)
    let b = K.makeBox(oc, 31.8, 15.8, 9.6);
    b = K.shellSolid(oc, b, 1.5, [openFace(b, false)]);
    for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 2; iy++) {
      try { b = K.fuse(oc, b, K.makeCylinder(oc, 2.4, 1.8, { origin: [3.9 + ix * 8, 3.9 + iy * 8, 9.6], dir: [0, 0, 1] })); } catch {}
    }
    return b;
  }
  if (key === 'sony') {
    // carcasa de control 150 × 45 × 22, pared 2, 3 costillas internas
    let b = K.makeBox(oc, 150, 45, 22);
    b = K.shellSolid(oc, b, 2, [openFace(b, true)]);
    for (let i = 0; i < 3; i++) { const x = 40 + i * 35; try { b = K.fuse(oc, b, K.extrudePolygon(oc, [{ x, y: 2 }, { x: x + 2, y: 2 }, { x: x + 2, y: 43 }, { x, y: 43 }], 18)); } catch {} }
    return b;
  }
  // genérico: charola 90 × 90 × 35, pared 2
  let b = K.makeBox(oc, 90, 90, 35);
  return K.shellSolid(oc, b, 2, [openFace(b, true)]);
}

const CLIENTS = [
  { key: 'sony', label: 'Sony', plastic: 'ABS', wallMm: 2, annualVolume: 2_000_000, finish: 'SPI B-3', name: 'Carcasa de control Sony', feedPref: 'hot-runner' },
  { key: 'lego', label: 'LEGO', plastic: 'ABS', wallMm: 1.5, annualVolume: 20_000_000, finish: 'SPI A-3', name: 'Ladrillo LEGO 2×4', feedPref: 'hot-runner' },
  { key: 'generic', label: 'Genérico', plastic: 'PP', wallMm: 2, annualVolume: 200_000, finish: 'SPI B-3', name: 'Charola contenedora' },  // colada fría (optimizador)
];

(async () => {
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const MM = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldmachine.ts'));
  const PS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);
  const outDir = process.env.OUT || '/tmp/mold-pdfs';
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--headless=new'] });
  const ctx = await browser.newContext({ viewport: { width: 2400, height: 1720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  for (const cl of CLIENTS) {
    // 1) sólido de la pieza + MEDICIÓN con el kernel (bbox, volumen, superficie)
    const solid = buildClientPart(K, oc, cl.key);
    const mesh = K.tessellate(oc, solid, 0.15, 0.4);
    let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      mnx = Math.min(mnx, mesh.positions[i]); mxx = Math.max(mxx, mesh.positions[i]);
      mny = Math.min(mny, mesh.positions[i + 1]); mxy = Math.max(mxy, mesh.positions[i + 1]);
      mnz = Math.min(mnz, mesh.positions[i + 2]); mxz = Math.max(mxz, mesh.positions[i + 2]);
    }
    const Lmm = +(mxx - mnx).toFixed(1), Wmm = +(mxy - mny).toFixed(1), Hmm = +(mxz - mnz).toFixed(1);
    const volumeMm3 = Math.round(K.volume(oc, solid));
    const surfaceMm2 = Math.round(K.surfaceArea(oc, solid));
    const spec = { name: cl.name, Lmm, Wmm, Hmm, surfaceMm2, volumeMm3, wallMm: cl.wallMm, annualVolume: cl.annualVolume, plastic: cl.plastic, finish: cl.finish, feedPref: cl.feedPref };

    // 2) LA MÁQUINA decide arquitectura (caliente/fría) + molde óptimo
    const pkg = MM.moldMachine(spec);
    const aspec = PS.packageToAssemblySpec(pkg);
    console.log(`\n${cl.label}: ${Lmm}×${Wmm}×${Hmm} mm · vol ${volumeMm3} mm³ · sup ${surfaceMm2} mm² · ${cl.annualVolume.toLocaleString()}/año`);
    console.log(`  → ${pkg.recomendacion.arch} × ${pkg.recomendacion.nCav} cav · acero ${pkg.metal.metal.key} · máquina ${pkg.maquina?.nombre} · precio $${Math.round(pkg.veredicto.precioMoldeUSD).toLocaleString()}`);

    // 3) juego COMPLETO de planos + análisis (mismo motor que el botón de la UI)
    const rows = [
      { grupo: 'Recomendación', param: 'arquitectura × cavidades', valor: `${pkg.recomendacion.arch} × ${pkg.recomendacion.nCav}`, ref: '§3.4', ok: true },
      { grupo: 'Máquina', param: 'inyectora', valor: `${pkg.maquina?.nombre ?? '—'} ${pkg.maquina?.ok ? '✓' : '⚠'}`, ref: '§4.3.3', ok: pkg.maquina?.ok },
      { grupo: 'DFM', param: 'moldeabilidad', valor: `${pkg.dfm.score}/100`, ref: '§2.3', ok: pkg.dfm.score >= 60 },
      { grupo: 'Costo', param: 'precio de molde / pieza', valor: `$${Math.round(pkg.veredicto.precioMoldeUSD).toLocaleString()} · $${pkg.veredicto.costoPiezaUSD.toFixed(3)}/pza`, ref: '§3.3' },
    ];
    const pages = PS.buildMoldLaminas(K, oc, aspec, rows, solid);

    const pngs = [];
    for (const pg of pages) {
      await page.setContent('<body style="margin:0;background:#fff">' + pg.svg + '</body>');
      await page.waitForTimeout(90);
      const el = await page.$('svg');
      pngs.push((await el.screenshot()).toString('base64'));
    }
    const html = `<!doctype html><html><head><meta charset="utf8"><style>@page{size:A3 landscape;margin:0}html,body{margin:0}.pg{page-break-after:always;width:420mm;height:297mm;background-repeat:no-repeat;background-position:center;background-size:contain}.pg:last-child{page-break-after:auto}</style></head><body>${pngs.map((b) => `<div class="pg" style="background-image:url(data:image/png;base64,${b})"></div>`).join('')}</body></html>`;
    await page.setContent(html, { waitUntil: 'networkidle' });
    const out = path.join(outDir, `plano-cliente-${cl.key}.pdf`);
    await page.pdf({ path: out, format: 'A3', landscape: true, printBackground: true });
    console.log(`  OK → ${out} (${pages.length} láminas)`);
  }
  await browser.close();
  console.log('\nCLIENTS_OK');
})().catch((e) => { console.log('FATAL', String(e.stack || e).slice(0, 500)); process.exit(1); });
