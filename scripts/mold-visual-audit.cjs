/**
 * mold-visual-audit.cjs — AUDITORÍA VISUAL del módulo molde: carga la flanera y
 * captura CADA modo de visualización (base, canales/flow, térmica, tc, rayos X,
 * panel de análisis abierto) + reporta qué texto muestra cada estudio.
 * Uso (iangpu, GPU real):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   URL=http://localhost:5178/forja-brep.html OUT=/tmp/mold-audit \
 *   node /home/ian/Orkesta/la-forja/scripts/mold-visual-audit.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const OUT = process.env.OUT || '/tmp/mold-audit';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl', '--disable-software-rasterizer', '--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const out = { shots: [], textos: {} };
  const shot = async (n) => { await p.screenshot({ path: `${OUT}/${n}.png`, timeout: 30000 }); out.shots.push(n); };
  // intenta el click REAL (pointerdown+click) y cae al nativo si Playwright no puede
  const clickAny = async (tid) => {
    const sel = `[data-testid="${tid}"]`;
    const n = await p.locator(sel).count();
    if (!n) return false;
    try { await p.click(sel, { timeout: 4000 }); return true; }
    catch { return p.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, sel); }
  };
  const clickNative = clickAny;
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    // ESPERAR EL KERNEL (moldAlarm en la bolsa), no solo orbitTo: el botón
    // Flanera clickeado antes de tiempo es un NO-OP silencioso (falla UX aparte)
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldAlarm && window.__forgeBrep.orbitTo)', null, { timeout: 120000 });
    await p.waitForTimeout(1200);
    // click REAL de Playwright: el ribbon escucha pointerdown — el.click() nativo
    // (solo evento 'click') es NO-OP en estos botones. Los del ÁRBOL son al revés.
    await p.click('[data-testid="btn-flanera"]');
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 8', null, { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(3000);
    await p.evaluate(() => window.__forgeBrep.orbitTo && window.__forgeBrep.orbitTo(45, 22, 640));
    await p.waitForTimeout(900);
    await shot('01-base');
    // ── CANALES (flow) ──
    out.flowToggle = await clickNative('mold-flow-toggle');
    await p.waitForTimeout(2500); await shot('02-flow');
    // ── TÉRMICA (sim) ──
    out.simToggle = await clickNative('mold-sim-toggle');
    await p.waitForTimeout(9000);                        // warmUp(8) + CG steady
    await shot('03-termica');
    out.textos.legend = await p.evaluate(() => document.querySelector('[data-testid="mold-field-legend"]')?.innerText ?? null);
    out.textos.simReport = await p.evaluate(() => document.querySelector('[data-testid="mold-sim-report"]')?.innerText?.slice(0, 900) ?? null);
    // rebanada si existe
    const sliceOk = await p.evaluate(() => { const el = document.querySelector('[data-testid="mold-slice-frac"]'); return !!el; });
    if (sliceOk) { await p.evaluate(() => { const el = document.querySelector('[data-testid="mold-slice-frac"]'); el.value = 0.5; el.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(1500); await shot('04-rebanada'); }
    // ── TC / mapa local ──
    out.tcToggle = await clickNative('mold-tc-toggle');
    await p.waitForTimeout(2500); await shot('05-tc');
    out.textos.tcReport = await p.evaluate(() => document.querySelector('[data-testid="mold-tc-report"]')?.innerText?.slice(0, 600) ?? null);
    await clickNative('mold-tc-toggle');
    // ── RAYOS X ──
    out.xray = await clickNative('mold-xray-toggle');
    await p.waitForTimeout(1500); await shot('06-xray');
    await clickNative('mold-xray-toggle');
    // ── PANEL DE ANÁLISIS ──
    await p.evaluate(() => { for (const el of document.querySelectorAll('div,button,span')) if (el.textContent?.trim() === 'ANÁLISIS · PROPIEDADES') { el.click(); return; } });
    await p.waitForTimeout(1200); await shot('07-panel');
    out.textos.panel = await p.evaluate(() => document.querySelector('[data-testid="analysis-panel"]')?.innerText?.slice(0, 2400) ?? document.body.innerText.slice(0, 1200));
    // estudios listados (qué botones/estudios EXISTEN en el panel)
    out.textos.estudios = await p.evaluate(() => Array.from(document.querySelectorAll('[data-testid]')).map((e) => e.getAttribute('data-testid')).filter((t) => /study|report|legend|toggle/.test(t)));
  } catch (e) { out.error = String(e).slice(0, 300); }
  out.pageErrors = errs;
  fs.writeFileSync(`${OUT}/audit.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
