#!/usr/bin/env node
/*
 * sketch-dof-verify.cjs — verifica el DOF POR-ENTIDAD (espacio nulo del Jacobiano):
 * al anclar una esquina y acotar un lado, SOLO esas entidades se "clavan" (blanco)
 * mientras el resto sigue móvil (azul). Corre en iangpu.
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
  async function clickMM(x, y) { const c = await pageXY(x, y); await page.mouse.click(c.x, c.y); await page.waitForTimeout(240); }
  const free = () => page.evaluate(() => window.__sketchEditor.free());

  // abrir + dibujar rect: p0(-20,-10) p1(20,-10) p2(20,10) p3(-20,10)
  await page.click('[data-testid="btn-sketch"]');
  await page.waitForSelector('[data-testid="sketch-editor"]', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.click('[data-testid="sk-tool-rect"]');
  await clickMM(-20, -10); await clickMM(20, 10);
  const f0 = await free();
  check('rect recién dibujado: las 4 esquinas se mueven (todas azul)', f0 && f0.points.every((b) => b === true), JSON.stringify(f0 && f0.points));

  // anclar la esquina p0
  await page.click('[data-testid="sk-tool-fix"]');
  await clickMM(-20, -10);
  const f1 = await free();
  check('anclar p0: SOLO p0 se clava (blanco), el resto azul', f1 && f1.points[0] === false && f1.points[1] && f1.points[2] && f1.points[3], JSON.stringify(f1 && f1.points));

  // acotar el lado inferior p0-p1 = 40
  await page.click('[data-testid="sk-tool-dim"]');
  await clickMM(-20, -10); await clickMM(20, -10);
  await page.fill('[data-testid="sk-dim-input"]', '40');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const f2 = await free();
  check('cota del lado inferior: p0 y p1 clavados, p2 y p3 siguen azul', f2 && f2.points[0] === false && f2.points[1] === false && f2.points[2] === true && f2.points[3] === true, JSON.stringify(f2 && f2.points));
  await page.screenshot({ path: DIR + '/sketch-dof.png' });

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[RESULT] ${passed}/${results.length} passed · pageerrors=${errors.length}`);
  if (errors.length) console.log('[errors]', errors.slice(0, 6));
  await ctx.close(); await browser.close();
  process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
})();
