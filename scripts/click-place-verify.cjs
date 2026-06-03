#!/usr/bin/env node
/*
 * click-place-verify.cjs — verifica el CLICK-TO-PLACE del barreno: pulsa B y hace
 * clic en la cara superior en dos puntos distintos; confirma que el centro del
 * barreno cae donde se clicó (x mayor a la derecha que a la izquierda). Corre en iangpu.
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

  const ops = () => page.evaluate(() => (window.__forgeBrep && window.__forgeBrep.opsList) || []);
  const holes = (l) => l.filter((o) => o.type === 'hole');
  async function waitUntil(pred, timeout = 9000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const v = await pred(); if (v) return v; await page.waitForTimeout(250); }
    return null;
  }
  const results = [];
  const check = (name, ok, detail) => { results.push({ ok: !!ok }); console.log((ok ? '✓' : '✗'), name, detail || ''); };

  await page.mouse.click(820, 480); // foco al viewport
  await page.waitForTimeout(400);

  // placement 1: clic a la DERECHA del centro de la cara superior
  const nBefore1 = holes(await ops()).length;
  await page.keyboard.press('b');
  await page.waitForTimeout(300);
  const hintTxt = await page.locator('[data-testid="pick-hint"]').textContent().catch(() => '');
  check('B entra a modo colocación (hint)', /COLOCAR el barreno/i.test(hintTxt || ''), `hint="${(hintTxt || '').trim()}"`);
  await page.mouse.click(880, 408);
  const h1 = await waitUntil(async () => { const hs = holes(await ops()); return hs.length > nBefore1 ? hs : null; });
  check('clic derecho coloca un barreno', h1, h1 ? `holes=${h1.length}` : 'no se colocó');
  const hole1 = h1 ? h1[h1.length - 1] : null;
  await page.screenshot({ path: DIR + '/clickplace-1.png' });

  // placement 2: clic a la IZQUIERDA del centro
  const nBefore2 = holes(await ops()).length;
  await page.keyboard.press('b');
  await page.waitForTimeout(300);
  await page.mouse.click(700, 408);
  const h2 = await waitUntil(async () => { const hs = holes(await ops()); return hs.length > nBefore2 ? hs : null; });
  check('clic izquierdo coloca otro barreno', h2, h2 ? `holes=${h2.length}` : 'no se colocó');
  const hole2 = h2 ? h2[h2.length - 1] : null;
  await page.screenshot({ path: DIR + '/clickplace-2.png' });

  // direccionalidad: el clic derecho debe dar x MAYOR que el izquierdo
  if (hole1 && hole2) {
    console.log(`  hole1 (derecha) x=${hole1.x} y=${hole1.y}`);
    console.log(`  hole2 (izquierda) x=${hole2.x} y=${hole2.y}`);
    check('el barreno cae donde clicas (x_der > x_izq)', hole1.x > hole2.x + 1, `${hole1.x} > ${hole2.x}`);
    check('x no es el default 0 (tomó el punto del clic)', Math.abs(hole1.x) > 1 || Math.abs(hole2.x) > 1, '');
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[RESULT] ${passed}/${results.length} passed · pageerrors=${errors.length}`);
  if (errors.length) console.log('[errors]', errors.slice(0, 5));
  await ctx.close(); await browser.close();
  process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
})();
