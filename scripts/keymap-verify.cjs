#!/usr/bin/env node
/*
 * keymap-verify.cjs — verifica el KEYMAP del Part Studio con TECLAS REALES
 * (Playwright keyboard), leyendo el estado por window.__forgeBrep. Corre en iangpu.
 *
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   node scripts/keymap-verify.cjs
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/keymap-overlay.png';

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

  const inv = () => page.evaluate(() => (window.__forgeBrep && window.__forgeBrep.invariants) || null);
  const opsOf = (i) => (i && i.ops) ? i.ops : [];
  async function waitUntil(pred, timeout = 9000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const v = await pred(); if (v) return v; await page.waitForTimeout(250); }
    return null;
  }
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log((ok ? '✓' : '✗'), name, detail || ''); };

  // Enfocar el viewport (no un input) para que window reciba las teclas.
  await page.mouse.click(820, 480);
  await page.waitForTimeout(400);

  const i0 = await inv();
  const faces0 = i0 && i0.n_faces;

  // C = círculo → el perfil cambia (n_faces distinto del rectángulo base).
  await page.keyboard.press('c');
  const iC = await waitUntil(async () => { const i = await inv(); return i && i.n_faces !== faces0 ? i : null; });
  check('C = círculo cambia el perfil', iC, `n_faces ${faces0} -> ${iC && iC.n_faces}`);

  // R = rectángulo (vuelve a cambiar respecto al círculo).
  await page.keyboard.press('r');
  const iR = await waitUntil(async () => { const i = await inv(); return iC && i && i.n_faces !== iC.n_faces ? i : null; });
  check('R = rectángulo cambia el perfil', iR, `n_faces ${iC && iC.n_faces} -> ${iR && iR.n_faces}`);

  // E = extrude añade una op.
  const opsBeforeE = opsOf(await inv()).length;
  await page.keyboard.press('e');
  const iE = await waitUntil(async () => { const i = await inv(); return opsOf(i).length > opsBeforeE ? i : null; });
  check('E = extrude añade op', iE, `ops ${opsBeforeE} -> ${opsOf(iE).length} [${opsOf(iE).join(',')}]`);

  // B = barreno añade un hole.
  const opsBeforeB = opsOf(await inv()).length;
  await page.keyboard.press('b');
  const iB = await waitUntil(async () => { const i = await inv(); return opsOf(i).includes('hole') && opsOf(i).length > opsBeforeB ? i : null; });
  check('B = barreno añade hole', iB, `ops [${opsOf(iB || (await inv())).join(',')}]`);

  // S = abre la paleta de atajos en el cursor.
  await page.keyboard.press('s');
  const overlay = await waitUntil(async () => (await page.locator('input[placeholder="Herramienta..."]').count()) > 0, 4000);
  check('S = abre la paleta de atajos', overlay, '');
  await page.screenshot({ path: SHOT });

  // Esc cierra la paleta.
  await page.keyboard.press('Escape');
  const closed = await waitUntil(async () => (await page.locator('input[placeholder="Herramienta..."]').count()) === 0, 4000);
  check('Esc cierra la paleta', closed, '');

  // No roba teclas si el foco está en un input (slider): teclear E no añade op.
  let safe = true;
  const range = page.locator('input[type="range"]').first();
  if (await range.count()) {
    const before = opsOf(await inv()).length;
    await range.focus();
    await page.keyboard.press('e');
    await page.waitForTimeout(900);
    safe = opsOf(await inv()).length === before;
  }
  check('No roba teclas con foco en input', safe, '');

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[RESULT] ${passed}/${results.length} passed · pageerrors=${errors.length}`);
  if (errors.length) console.log('[errors]', errors.slice(0, 5));
  await ctx.close(); await browser.close();
  process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
})();
