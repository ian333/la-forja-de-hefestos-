/**
 * m1-agua-verify.cjs — verifica M1: la pantalla de fórmulas (agua/colada/térmica)
 * y el resalte fantasma del agua a través de las placas.
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   OUT=/tmp/m1 node /home/ian/Orkesta/la-forja/scripts/m1-agua-verify.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const OUT = process.env.OUT || '/tmp/m1';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl', '--disable-software-rasterizer', '--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const out = { shots: [], calc: {} };
  const shot = async (n) => { await p.screenshot({ path: `${OUT}/${n}.png`, timeout: 30000 }); out.shots.push(n); };
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldAlarm)', null, { timeout: 120000 });
    await p.waitForTimeout(1000);
    await p.click('[data-testid="btn-flanera"]');
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 8', null, { timeout: 90000 });
    await p.waitForTimeout(2000);
    await p.evaluate(() => window.__forgeBrep.orbitTo(45, 22, 640));
    // 1) expandir agua-b → fórmulas §9.2 (chevron es botón del ÁRBOL: click nativo)
    await p.evaluate(() => document.querySelector('[data-testid="mold-expand-agua-b"]')?.scrollIntoView());
    await p.evaluate(() => document.querySelector('[data-testid="mold-expand-agua-b"]')?.click());
    await p.waitForTimeout(700);
    out.calc.agua = await p.evaluate(() => document.querySelector('[data-testid="mold-calc-agua-b"]')?.innerText?.slice(0, 700) ?? null);
    await shot('01-formulas-agua');
    // 2) seleccionar agua-b (fila) → fantasma a través de las placas
    await p.evaluate(() => document.querySelector('[data-testid="mold-part-agua-b"]')?.click());
    await p.waitForTimeout(800);
    await shot('02-ghost-agua');
    // 3) colada: expandir → fórmulas cap 6-7
    await p.evaluate(() => document.querySelector('[data-testid="mold-expand-agua-b"]')?.click());   // plegar agua
    await p.evaluate(() => document.querySelector('[data-testid="mold-expand-colada"]')?.scrollIntoView());
    await p.evaluate(() => document.querySelector('[data-testid="mold-expand-colada"]')?.click());
    await p.waitForTimeout(700);
    out.calc.colada = await p.evaluate(() => document.querySelector('[data-testid="mold-calc-colada"]')?.innerText?.slice(0, 700) ?? null);
    await shot('03-formulas-colada');
    // 4) térmica ON → pasos del estudio
    await p.evaluate(() => document.querySelector('[data-testid="mold-expand-colada"]')?.click());
    const simBtn = await p.evaluate(() => { const el = document.querySelector('[data-testid="mold-sim-toggle"]'); if (el) el.click(); return !!el; });
    out.simToggled = simBtn;
    await p.waitForTimeout(9000);
    out.calc.termica = await p.evaluate(() => document.querySelector('[data-testid="mold-calc-termica"]')?.innerText?.slice(0, 700) ?? null);
    await shot('04-formulas-termica');
  } catch (e) { out.error = String(e).slice(0, 300); }
  out.pageErrors = errs;
  fs.writeFileSync(`${OUT}/m1.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
