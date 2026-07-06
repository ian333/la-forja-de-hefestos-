/**
 * GRABA LA SIMULACIÓN DEL CICLO DENTRO DE LA FORJA (el Studio real, por clicks)
 * en 4K REAL: viewport 3840×2160 css @ dsf 1 (Playwright no agranda frames; el HUD del\n * componente se auto-escala ×2 en ventanas ≥3000px).
 * Coreografía determinista por FASES del motor (se espera a __cycleSimState.phase,
 * no a timers ciegos) + verificación de invariantes al final (VERIFY_RESULT).
 * Env GPU obligatorio (DISPLAY/GALLIUM d3d12) — correr vía forja-run.sh en iangpu.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const OUT = process.env.OUT || '/tmp/cycle-studio';
fs.mkdirSync(OUT + '/rec', { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
      '--use-gl=angle', '--use-angle=gl', '--disable-software-rasterizer',
      '--hide-scrollbars', '--window-size=3840,2160'],
  });
  // Playwright solo REDUCE frames al grabar (nunca agranda): el viewport debe SER 4K.
  // zoom 2 en el body = layout de 1920 legible, texto vectorial crisp a 3840.
  const ctx = await browser.newContext({
    viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1,
    recordVideo: { dir: OUT + '/rec', size: { width: 3840, height: 2160 } },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  const st = () => page.evaluate('window.__cycleSimState || null');
  const waitPhase = async (ph, timeout = 120000) => {
    // OJO Playwright: waitForFunction(expr, ARG, options) — el options va TERCERO
    // (pasarlo segundo lo convierte en arg y aplica el default de 30 s).
    await page.waitForFunction(`window.__cycleSimState && window.__cycleSimState.phase === '${ph}'`, undefined, { timeout });
    return st();
  };
  const click = async (tid, settle = 500) => {
    await page.locator(`[data-testid="${tid}"]`).click({ timeout: 10000 });
    await page.waitForTimeout(settle);
  };
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, timeout: 30000 });
  const cam = (name, settle = 900) => page.evaluate(`window.__cycleCam && window.__cycleCam('${name}')`).then(() => page.waitForTimeout(settle));

  console.log('goto', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="tab-simulacion"]', { timeout: 60000 });
  await page.waitForTimeout(700);                        // breve — la intro muerta mata el video

  // 1) al workspace SIMULACIÓN y abrir el ciclo (el panel nace COLAPSADO — expandir)
  await click('tab-simulacion', 500);
  const simCollapsed = await page.evaluate(
    `(document.querySelector('[data-testid="sim-panel"]') || {className:''}).className.includes('collapsed')`);
  if (simCollapsed) await click('collapse-sim', 500);
  await shot('01-panel-sim');
  await click('btn-cycle-sim', 400);
  await page.waitForSelector('[data-testid="cycle-view"]', { timeout: 30000 });
  await page.waitForFunction('!!window.__cycleSimState', { timeout: 30000 });
  const seen = { phases: new Set(), maxFill: 0, maxSteel: 0, maxP: 0, flashSeen: false, maxWater: 0 };
  const sample = async () => {
    const s = await st();
    if (!s) return;
    seen.phases.add(s.phase); seen.maxFill = Math.max(seen.maxFill, s.fillFrac);
    seen.maxSteel = Math.max(seen.maxSteel, s.steelMaxC); seen.maxP = Math.max(seen.maxP, s.pressureMPa);
    seen.maxWater = Math.max(seen.maxWater, s.waterOutC);
    if (s.flash) seen.flashSeen = true;
  };

  // QUICK=1: solo stills de verificación visual (sin coreografía completa)
  if (process.env.QUICK) {
    await waitPhase('inyeccion'); await cam('slab', 800); await shot('q1-inyeccion-slab');
    await waitPhase('enfriamiento'); await cam('tresCuartos', 1300); await page.waitForTimeout(3500); await shot('q2-enfriamiento-34');
    await click('cycle-speed-4', 200);
    await waitPhase('apertura'); await click('cycle-speed-1', 100); await cam('apertura', 900);
    await waitPhase('caida'); await page.waitForTimeout(480); await shot('q3-caida');
    await click('cycle-xray', 300); await click('cycle-section', 300); await shot('q4-rayosx');
    await ctx.close(); await browser.close();
    console.log('QUICK_OK errors:', errors.length, errors.slice(0, 3));
    process.exit(0);
  }

  // ── COREOGRAFÍA v2: cámara DELIBERADA por beat (presets, no órbita random) ──
  // 2) CIERRE en plano general → INYECCIÓN en CLOSE-UP del slab (se ve el frente)
  await cam('frontal', 300);
  await waitPhase('inyeccion'); await cam('slab', 600); await sample(); await shot('02-inyeccion');
  await waitPhase('empaque'); await sample();
  // 3) enfriamiento: 3/4 — halo térmico difundiendo + agua fluyendo EN PERSPECTIVA
  await waitPhase('enfriamiento'); await cam('tresCuartos', 1200);
  await page.waitForTimeout(4500); await sample(); await shot('03-enfriamiento-seccion');
  await click('cycle-speed-4', 200);
  // 4) apertura/expulsión/caída a ×1 en 3/4 ALTA — la pieza SALE y aterriza
  await waitPhase('apertura'); await click('cycle-speed-1', 100); await cam('apertura', 400); await sample();
  await waitPhase('expulsion'); await sample(); await shot('04-expulsion');
  await waitPhase('caida'); await page.waitForTimeout(500); await shot('05-caida'); await sample();
  // 5) CICLO 2: RAYOS X PURO (sin sección) — el vaso 3D entero llenándose DENTRO
  await waitPhase('cierre'); await click('cycle-xray', 150); await click('cycle-section', 150);
  await click('cycle-speed-1', 100); await cam('tresCuartos', 400); await sample();
  await waitPhase('inyeccion'); await page.waitForTimeout(200); await sample(); await shot('06-rayos-x');
  await waitPhase('enfriamiento'); await page.waitForTimeout(2200); await click('cycle-speed-8', 200);
  await waitPhase('apertura'); await click('cycle-speed-2', 100);
  await waitPhase('caida'); await sample();
  // 6) DEMO FUGA a ×1: contrapicada dramática — marco rojo pulsando en la partición
  await click('cycle-xray', 150); await click('cycle-section', 150); await click('cycle-speed-1', 100); await cam('low', 300);
  await click('cycle-flashdemo', 400);
  await waitPhase('inyeccion'); await page.waitForTimeout(400); await sample(); await shot('07-fuga-flash');
  await waitPhase('empaque'); await sample();
  await page.waitForTimeout(1500); await sample(); await shot('08-fuga-empaque');
  await waitPhase('enfriamiento'); await page.waitForTimeout(800);
  // 7) FINAL: de vuelta al molde sano en plano general — el video TERMINA en la sim
  await click('cycle-flashdemo', 300); await click('cycle-speed-2', 100); await cam('frontal', 400);
  await waitPhase('inyeccion'); await page.waitForTimeout(600); await shot('09-final');
  await page.waitForTimeout(1200);

  await ctx.close(); await browser.close();
  const pass = seen.phases.size >= 6 && seen.maxFill > 0.99 && seen.maxSteel > 65 &&
    seen.maxP > 8 && seen.flashSeen && errors.length === 0;
  console.log('VERIFY_RESULT=' + JSON.stringify({
    pass,
    checks: {
      fases: [...seen.phases].length, llenado: +seen.maxFill.toFixed(2),
      aceroMaxC: +seen.maxSteel.toFixed(1), pMaxMPa: +seen.maxP.toFixed(1),
      aguaOutC: +seen.maxWater.toFixed(2), flashVisto: seen.flashSeen, pageErrors: errors,
    },
  }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
