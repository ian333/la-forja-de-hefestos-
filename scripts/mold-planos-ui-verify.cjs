/**
 * VERIFICA el flujo del botón GENERAR PLANOS de la UI, pero en node: corre el
 * MISMO camino de código que el handler (moldMachine → packageToAssemblySpec →
 * buildMoldLaminas → laminasToPrintHTML), con una pieza de CLIENTE (no un ejemplo
 * del libro), y rasteriza el HTML imprimible a PDF para revisar a ojo. Si esto
 * sale bien, el botón produce el mismo juego de planos con un clic.
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');
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

// pieza de CLIENTE (preset de la UI "Tapa rosca") — NO es de los 4 del libro
const CLIENT = { name: 'Tapa rosca', Lmm: 40, Wmm: 40, Hmm: 15, surfaceMm2: 6500, volumeMm3: 2800, wallMm: 1.2, annualVolume: 8_000_000, plastic: 'PP', finish: 'SPI A-3' };

(async () => {
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const MM = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldmachine.ts'));
  const PS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);

  // ── EXACTAMENTE lo que hace el botón ──
  const pkg = MM.moldMachine(CLIENT);
  const spec = PS.packageToAssemblySpec(pkg);
  const rows = [
    { grupo: 'Recomendación', param: 'arquitectura × cavidades', valor: `${pkg.recomendacion.arch} × ${pkg.recomendacion.nCav}`, ref: '§3.4' },
    { grupo: 'Máquina', param: 'inyectora', valor: `${pkg.maquina?.nombre ?? '—'}`, ref: '§4.3.3', ok: pkg.maquina?.ok },
    { grupo: 'DFM', param: 'moldeabilidad', valor: `${pkg.dfm.score}/100`, ref: '§2.3', ok: pkg.dfm.score >= 60 },
  ];
  console.log('SPEC', JSON.stringify(spec));
  const pages = PS.buildMoldLaminas(K, oc, spec, rows);
  console.log('LÁMINAS', pages.length, '→', pages.map((p) => p.name).join(' | '));
  const html = PS.laminasToPrintHTML(pages, `Planos · ${spec.name}`);

  // rasteriza a PDF (lo que el navegador haría con print())
  const outDir = process.env.OUT || '/tmp/mold-pdfs';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--headless=new'] });
  const ctx = await browser.newContext({ viewport: { width: 2400, height: 1720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const pngs = [];
  for (const pg of pages) {
    await page.setContent('<body style="margin:0;background:#fff">' + pg.svg + '</body>');
    await page.waitForTimeout(100);
    const el = await page.$('svg');
    pngs.push((await el.screenshot()).toString('base64'));
  }
  const doc = `<!doctype html><html><head><meta charset="utf8"><style>@page{size:A3 landscape;margin:0}html,body{margin:0}.pg{page-break-after:always;width:420mm;height:297mm;background-repeat:no-repeat;background-position:center;background-size:contain}.pg:last-child{page-break-after:auto}</style></head><body>${pngs.map((b) => `<div class="pg" style="background-image:url(data:image/png;base64,${b})"></div>`).join('')}</body></html>`;
  await page.setContent(doc, { waitUntil: 'networkidle' });
  const out = path.join(outDir, 'plano-molde-UI-tapa-rosca.pdf');
  await page.pdf({ path: out, format: 'A3', landscape: true, printBackground: true });
  await browser.close();
  // valida el HTML imprimible que el botón abriría
  const htmlOk = html.includes('size:A3 landscape') && html.includes('window.print') && (html.match(/<svg/g) || []).length >= pages.length;
  console.log('HTML imprimible OK:', htmlOk, '· PDF →', out);
  console.log(htmlOk && pages.length >= 7 ? 'UI_FLOW_OK' : 'UI_FLOW_FAIL');
})().catch((e) => { console.log('FATAL', String(e.stack || e).slice(0, 400)); process.exit(1); });
