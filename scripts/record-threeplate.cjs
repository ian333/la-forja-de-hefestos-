/**
 * GRABA el molde de 3 PLACAS dentro del Studio: CONSTRUCCIÓN placa por placa +
 * ciclo con DOBLE APERTURA (pieza y colada caen por caminos distintos).
 * 4K real (viewport 3840×2160 @ dsf1) · coreografía por estado (__tpState).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const OUT = process.env.OUT || '/tmp/threeplate';
fs.mkdirSync(OUT + '/rec', { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
      '--use-gl=angle', '--use-angle=gl', '--disable-software-rasterizer',
      '--hide-scrollbars', '--window-size=3840,2160'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1,
    recordVideo: { dir: OUT + '/rec', size: { width: 3840, height: 2160 } },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const waitFn = (expr, timeout = 120000) => page.waitForFunction(expr, undefined, { timeout });
  const click = async (tid, settle = 400) => { await page.locator(`[data-testid="${tid}"]`).click({ timeout: 10000 }); await page.waitForTimeout(settle); };
  const cam = (n, settle = 800) => page.evaluate(`window.__tpCam && window.__tpCam('${n}')`).then(() => page.waitForTimeout(settle));
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, timeout: 30000 });

  console.log('goto', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="tab-simulacion"]', { timeout: 60000 });
  await page.waitForTimeout(700);
  await click('tab-simulacion', 500);
  const col = await page.evaluate(`(document.querySelector('[data-testid="sim-panel"]') || {className:''}).className.includes('collapsed')`);
  if (col) await click('collapse-sim', 400);
  await click('btn-threeplate', 300);
  await page.waitForSelector('[data-testid="tp-view"]', { timeout: 30000 });

  // ── 1) CONSTRUCCIÓN: cámara general con órbita suave mientras arma ──
  await cam('general', 200); await click('tp-orbit', 150);
  await waitFn(`window.__tpState && window.__tpState.mode === 'construccion'`);
  await page.waitForTimeout(4500); await shot('01-construccion-media');
  await waitFn(`window.__tpState && window.__tpState.mode === 'ciclo'`);
  await click('tp-orbit', 150);                                     // órbita fuera para el ciclo

  // ── 2) CICLO 1 ×1: llenado en RAYOS-X (la cruz de colada llenándose) → apertura DOBLE sólida ──
  await click('tp-xray', 150); await cam('colada', 500);
  await waitFn(`window.__tpState && window.__tpState.phase === 'inyeccion'`);
  await page.waitForTimeout(300); await shot('02-inyeccion');
  await waitFn(`window.__tpState && window.__tpState.phase === 'enfriamiento'`);
  await page.waitForTimeout(2200); await click('tp-speed-8', 150);
  await waitFn(`window.__tpState && window.__tpState.phase === 'apertura'`);
  await click('tp-xray', 50); await cam('apertura', 100);
  await waitFn(`window.__tpState && window.__tpState.fase3p === 2`);   // A-X abriendo
  await click('tp-speed-1', 50);                                       // ×1 JUSTO para el drama
  await shot('03-doble-apertura');
  await waitFn(`window.__tpState && window.__tpState.phase === 'caida'`);
  await page.waitForTimeout(450); await shot('04-caida-pieza');
  // la colada cae sola (contador sube)
  await waitFn(`window.__tpState && window.__tpState.coladas >= 1`, 30000);
  await shot('05-colada-cae');

  // ── 3) CICLO 2 ×2 con RAYOS X: ver el drop pin-point llenar por dentro ──
  await waitFn(`window.__tpState && window.__tpState.phase === 'cierre'`);
  await click('tp-xray', 200); await click('tp-speed-2', 100); await cam('colada', 400);
  await waitFn(`window.__tpState && window.__tpState.phase === 'inyeccion'`);
  await page.waitForTimeout(250); await shot('06-rayosx-colada');
  await waitFn(`window.__tpState && window.__tpState.phase === 'enfriamiento'`);
  await page.waitForTimeout(1500); await click('tp-speed-8', 100);
  await waitFn(`window.__tpState && window.__tpState.phase === 'apertura'`);
  await cam('apertura', 100); await click('tp-xray', 50);
  await waitFn(`window.__tpState && window.__tpState.fase3p === 2`);
  await click('tp-speed-1', 50);
  await waitFn(`window.__tpState && window.__tpState.coladas >= 2`, 40000);
  await shot('07-segunda-colada');
  // ── 4) cierre en plano general (×8 hasta la inyección, ×1 el remate) ──
  await click('tp-speed-8', 100); await cam('general', 400);
  await waitFn(`window.__tpState && window.__tpState.phase === 'inyeccion'`);
  await click('tp-speed-1', 100);
  await page.waitForTimeout(1500); await shot('08-final');

  await ctx.close(); await browser.close();
  const st = { errors };
  const pass = errors.length === 0;
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks: st }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
