#!/usr/bin/env node
/*
 * sketch-drag-verify.cjs — verifica ARRASTRAR PUNTOS en el editor de croquis:
 * dibuja un rectángulo, arrastra la esquina superior-derecha y confirma que la
 * geometría la SIGUE manteniendo las restricciones (los lados adyacentes se mueven,
 * los opuestos quedan fijos). Corre en iangpu.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = process.env.DIR || '/home/ian/Orkesta/la-forja/forja-shots';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new', '--ignore-gpu-blocklist',
      '--enable-gpu', '--use-angle=gl', '--enable-webgl', '--enable-unsafe-swiftshader',
      '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, bypassCSP: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => window.__forgeBrep && window.__forgeBrep.ready === true, { timeout: 120000 });

  const results = [];
  const check = (name, ok, detail) => { results.push({ ok: !!ok }); console.log((ok ? '✓' : '✗'), name, detail || ''); };
  const approx = (a, b, tol = 1.2) => Math.abs(a - b) <= tol;
  const pts = () => page.evaluate(() => window.__sketchEditor.points());
  const pageXY = (x, y) => page.evaluate(([x, y]) => { const se = window.__sketchEditor; const r = se.svgRect(); const p = se.toPx(x, y); return { x: r.left + p.px, y: r.top + p.py }; }, [x, y]);
  async function clickMM(x, y) { const c = await pageXY(x, y); await page.mouse.click(c.x, c.y); await page.waitForTimeout(220); }

  // abrir + dibujar rectángulo (-20,-10)-(20,10)
  await page.click('[data-testid="btn-sketch"]');
  await page.waitForSelector('[data-testid="sketch-editor"]', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.click('[data-testid="sk-tool-rect"]');
  await clickMM(-20, -10); await clickMM(20, 10);
  const P0 = await pts();
  check('rectángulo dibujado', P0.length === 4, `pts=${P0.length}`);

  // arrastrar la esquina superior-derecha p[2]=(20,10) → (30,16)
  await page.click('[data-testid="sk-tool-select"]');
  await page.waitForTimeout(150);
  const a = await pageXY(20, 10), b = await pageXY(30, 16);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 14 }); await page.mouse.up();
  await page.waitForTimeout(300);

  const P = await pts();
  console.log('  p0', fmt(P[0]), 'p1', fmt(P[1]), 'p2', fmt(P[2]), 'p3', fmt(P[3]));
  check('la esquina arrastrada sigue al cursor (≈30,16)', approx(P[2].x, 30) && approx(P[2].y, 16), fmt(P[2]));
  check('vertical se mantiene: p1.x sigue a p2.x (≈30)', approx(P[1].x, 30), `p1.x=${P[1].x.toFixed(2)}`);
  check('horizontal se mantiene: p3.y sigue a p2.y (≈16)', approx(P[3].y, 16), `p3.y=${P[3].y.toFixed(2)}`);
  check('la esquina opuesta p0 NO se movió (≈-20,-10)', approx(P[0].x, -20) && approx(P[0].y, -10), fmt(P[0]));
  check('sigue rectángulo (p1.y≈-10, p3.x≈-20)', approx(P[1].y, -10) && approx(P[3].x, -20), `p1.y=${P[1].y.toFixed(1)} p3.x=${P[3].x.toFixed(1)}`);
  const dofAfter = await page.evaluate(() => window.__sketchEditor.dof);
  check('DOF real tras soltar (=4, sin el pin)', dofAfter === 4, `dof=${dofAfter}`);
  await page.screenshot({ path: DIR + '/sketch-drag.png' });

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[RESULT] ${passed}/${results.length} passed · pageerrors=${errors.length}`);
  if (errors.length) console.log('[errors]', errors.slice(0, 6));
  await ctx.close(); await browser.close();
  process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
})();
function fmt(p) { return `(${p.x.toFixed(1)},${p.y.toFixed(1)})`; }
