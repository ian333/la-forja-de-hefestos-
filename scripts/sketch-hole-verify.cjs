#!/usr/bin/env node
/*
 * sketch-hole-verify.cjs — verifica CÍRCULO = BARRENO: dibuja un rectángulo y un
 * círculo dentro, Terminar, y confirma que el sólido extruido tiene el agujero
 * (volumen baja ≈ π·r²·h, caras suben). Corre en iangpu.
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
  const pageXY = (x, y) => page.evaluate(([x, y]) => { const se = window.__sketchEditor; const r = se.svgRect(); const p = se.toPx(x, y); return { x: r.left + p.px, y: r.top + p.py }; }, [x, y]);
  async function clickMM(x, y) { const c = await pageXY(x, y); await page.mouse.click(c.x, c.y); await page.waitForTimeout(230); }
  const inv = () => page.evaluate(() => window.__forgeBrep.invariants);
  async function waitInv(pred, timeout = 9000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { const i = await inv(); if (i && pred(i)) return i; await page.waitForTimeout(250); } return await inv(); }

  // abrir + dibujar rectángulo 40×20
  await page.click('[data-testid="btn-sketch"]');
  await page.waitForSelector('[data-testid="sketch-editor"]', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.click('[data-testid="sk-tool-rect"]');
  await clickMM(-20, -10); await clickMM(20, 10);

  // dibujar un círculo r=5 al centro (0,0): centro + punto de radio
  await page.click('[data-testid="sk-tool-circle"]');
  await clickMM(0, 0); await clickMM(5, 0);
  const holes = await page.evaluate(() => window.__sketchEditor.holes());
  check('círculo registrado como barreno (⌀10 al centro)', holes.length === 1 && Math.abs(holes[0].d - 10) < 1 && Math.abs(holes[0].x) < 1 && Math.abs(holes[0].y) < 1, JSON.stringify(holes));

  // Terminar → extruye con el barreno
  await page.click('[data-testid="sk-finish"]');
  const i = await waitInv((iv) => iv.ops && iv.ops.includes('hole') && iv.n_faces >= 7, 9000);
  check('el sólido tiene el barreno (n_faces ≥ 7)', i && i.n_faces >= 7, `n_faces=${i && i.n_faces} ops=[${i && i.ops}]`);
  // vol = 40·20·12 − π·5²·12 ≈ 9600 − 942 ≈ 8658
  check('volumen = caja − barreno (≈8658 mm³)', i && i.vol_kernel > 8400 && i.vol_kernel < 8850, `vol=${i && i.vol_kernel && i.vol_kernel.toFixed(0)}`);
  await page.screenshot({ path: DIR + '/sketch-hole.png' });

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[RESULT] ${passed}/${results.length} passed · pageerrors=${errors.length}`);
  if (errors.length) console.log('[errors]', errors.slice(0, 6));
  await ctx.close(); await browser.close();
  process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
})();
