#!/usr/bin/env node
/*
 * sketcher-verify.cjs — verifica el EDITOR DE CROQUIS dibujando con el mouse:
 * abre Croquis, dibuja un rectángulo (2 clics), lo ancla y acota (2 cotas), y
 * confirma que pasa de 4 DOF → 0 (azul→negro), luego Terminar extruye el sólido.
 * Corre en iangpu (GPU real).
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
  const sk = (fn) => page.evaluate(fn);
  const dof = () => sk(() => (window.__sketchEditor ? window.__sketchEditor.dof : null));
  async function waitDof(target, timeout = 6000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { if ((await dof()) === target) return true; await page.waitForTimeout(150); }
    return (await dof()) === target;
  }
  async function clickMM(x, y) {
    const c = await page.evaluate(([x, y]) => { const se = window.__sketchEditor; const r = se.svgRect(); const p = se.toPx(x, y); return { x: r.left + p.px, y: r.top + p.py }; }, [x, y]);
    await page.mouse.click(c.x, c.y); await page.waitForTimeout(250);
  }

  // 1) abrir el editor de croquis
  await page.click('[data-testid="btn-sketch"]');
  await page.waitForSelector('[data-testid="sketch-editor"]', { timeout: 8000 });
  await page.waitForTimeout(600); // que el ResizeObserver fije el tamaño
  check('Croquis abre', await page.locator('[data-testid="sketch-editor"]').count() > 0);

  // 2) herramienta rectángulo + dibujar (2 esquinas): (-20,-10) y (20,10) = 40×20
  await page.click('[data-testid="sk-tool-rect"]');
  await clickMM(-20, -10);
  await clickMM(20, 10);
  const np = await sk(() => window.__sketchEditor.nPoints), nl = await sk(() => window.__sketchEditor.nLines);
  check('rectángulo dibujado (4 pts, 4 líneas)', np === 4 && nl === 4, `pts=${np} líneas=${nl}`);
  check('rect arranca sub-restringido (DOF=4)', await waitDof(4), `dof=${await dof()}`);

  // 3) anclar una esquina (fix) → quita 2 DOF
  await page.click('[data-testid="sk-tool-fix"]');
  await clickMM(-20, -10);
  check('anclar esquina → DOF=2', await waitDof(2), `dof=${await dof()}`);

  // 4) cota del lado inferior = 40 (p en (-20,-10) y (20,-10))
  await page.click('[data-testid="sk-tool-dim"]');
  await clickMM(-20, -10);
  await clickMM(20, -10);
  await page.fill('[data-testid="sk-dim-input"]', '40');
  await page.keyboard.press('Enter');
  check('cota 40 → DOF=1', await waitDof(1), `dof=${await dof()}`);

  // 5) cota del lado derecho = 20 (p en (20,-10) y (20,10))
  await clickMM(20, -10);
  await clickMM(20, 10);
  await page.fill('[data-testid="sk-dim-input"]', '20');
  await page.keyboard.press('Enter');
  const full = await waitDof(0);
  const dofTxt = await page.locator('[data-testid="sk-dof"]').textContent().catch(() => '');
  check('totalmente restringido (DOF=0, negro)', full && /Totalmente restringido/i.test(dofTxt || ''), `dof=${await dof()} txt="${(dofTxt || '').trim()}"`);
  await page.screenshot({ path: DIR + '/sketcher-solved.png' });

  // 6) Terminar → extruye el sólido
  const facesBefore = await sk(() => window.__forgeBrep.invariants && window.__forgeBrep.invariants.n_faces);
  await page.click('[data-testid="sk-finish"]');
  await page.waitForTimeout(2500);
  const inv = await sk(() => window.__forgeBrep.invariants);
  check('Terminar extruye un sólido (Euler=2)', inv && inv.euler === 2 && inv.n_faces >= 6, `n_faces=${inv && inv.n_faces} euler=${inv && inv.euler} vol=${inv && inv.vol_kernel && inv.vol_kernel.toFixed(0)}`);
  await page.screenshot({ path: DIR + '/sketcher-extruded.png' });

  void facesBefore;
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[RESULT] ${passed}/${results.length} passed · pageerrors=${errors.length}`);
  if (errors.length) console.log('[errors]', errors.slice(0, 6));
  await ctx.close(); await browser.close();
  process.exit(passed === results.length && errors.length === 0 ? 0 : 1);
})();
