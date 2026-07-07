/** GRABA el molde que DESENROSCA (núcleo rotativo) en el Studio. 4K real. */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const OUT = process.env.OUT || '/tmp/unscrew';
const QUICK = !!process.env.QUICK;
fs.mkdirSync(OUT + '/rec', { recursive: true });
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=gl', '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=3840,2160'] });
  const ctx = await b.newContext({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1, recordVideo: { dir: OUT + '/rec', size: { width: 3840, height: 2160 } } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const waitFn = (e, t = 120000) => page.waitForFunction(e, undefined, { timeout: t });
  const cam = (n, s = 800) => page.evaluate(`window.__usCam && window.__usCam('${n}')`).then(() => page.waitForTimeout(s));
  const click = async (tid, s = 400) => { await page.locator(`[data-testid="${tid}"]`).click({ timeout: 10000 }); await page.waitForTimeout(s); };
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, timeout: 30000 });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="tab-simulacion"]', { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.locator('[data-testid="tab-simulacion"]').click(); await page.waitForTimeout(500);
  const col = await page.evaluate(`(document.querySelector('[data-testid="sim-panel"]')||{className:''}).className.includes('collapsed')`);
  if (col) { await page.locator('[data-testid="collapse-sim"]').click(); await page.waitForTimeout(400); }
  await page.waitForSelector('[data-testid="btn-unscrew"]', { state: 'attached', timeout: 20000 });
  await page.locator('[data-testid="btn-unscrew"]').click();
  await page.waitForSelector('[data-testid="us-view"]', { timeout: 30000 });
  await waitFn(`!!window.__usState`);

  const seen = { turns: 0, phases: new Set() };
  const sample = async () => { const s = await page.evaluate('window.__usState'); if (s) { seen.turns = Math.max(seen.turns, s.turns); seen.phases.add(s.phase); } };

  if (QUICK) {
    await cam('general', 600); await waitFn(`window.__usState.phase==='inyeccion'`); await page.waitForTimeout(300); await shot('q1-inyeccion');
    await waitFn(`window.__usState.phase==='expulsion'`); await cam('rosca', 500); await page.waitForTimeout(500); await sample(); await shot('q2-desenrosca');
    await waitFn(`window.__usState.turns >= 3`, 20000); await cam('planetario', 600); await shot('q3-planetario');
    await b.close(); console.log('QUICK_OK turns=', seen.turns.toFixed(1), 'errors:', errors.length, errors.slice(0, 2)); process.exit(0);
  }

  // ── 1) inyección de la tapa roscada (molde cerrado, general) ──
  await cam('general', 500);
  await waitFn(`window.__usState.phase==='inyeccion'`); await page.waitForTimeout(300); await sample(); await shot('01-inyeccion');
  await waitFn(`window.__usState.phase==='enfriamiento'`); await page.waitForTimeout(2000); await click('us-speed-2', 100);
  // ── 2) EL DESENROSQUE en general (el núcleo gira, la tapa sube) ──
  await waitFn(`window.__usState.phase==='apertura'`); await click('us-speed-1', 100); await cam('rosca', 400);
  await waitFn(`window.__usState.phase==='expulsion'`); await page.waitForTimeout(400); await sample(); await shot('02-desenrosca-a');
  await waitFn(`window.__usState.turns >= 2`, 20000); await sample(); await shot('03-desenrosca-b');
  await waitFn(`window.__usState.phase==='caida'`); await page.waitForTimeout(400); await sample(); await shot('04-tapa-libre');
  // ── 3) ciclo 2: RAYOS X para ver el mecanismo PLANETARIO girar ──
  await waitFn(`window.__usState.phase==='cierre'`); await click('us-xray', 150); await click('us-speed-2', 100); await cam('planetario', 500);
  await waitFn(`window.__usState.phase==='expulsion'`); await click('us-speed-1', 100); await page.waitForTimeout(500); await sample(); await shot('05-planetario');
  await waitFn(`window.__usState.turns >= 3`, 20000); await shot('06-planetario-gira');
  // ── 4) cierre en general ──
  await click('us-xray', 100); await cam('general', 400);
  await waitFn(`window.__usState.phase==='inyeccion'`); await page.waitForTimeout(1000); await shot('07-final');

  await b.close();
  const pass = seen.turns >= 3.5 && seen.phases.size >= 5 && errors.length === 0;
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks: { turns: +seen.turns.toFixed(1), fases: seen.phases.size, errors } }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
