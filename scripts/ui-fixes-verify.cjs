/**
 * La Forja — verifica los P0 de UI (veredicto del juez de interfaces):
 *   1) Paneles COLAPSABLES (▾/▸): el panel toma clase .collapsed y oculta su cuerpo.
 *   2) Menú ⋮ OPCIONES: abre, contiene Exportar STEP/STL + Ocultar boceto;
 *      Exportar STL dispara una descarga real con bytes válidos.
 *   3) ÁRBOL de operaciones COMPLETO: suprimir (ojo), renombrar (in-place),
 *      borrar nodo, y PURGA de dependientes al borrar el sólido base.
 * Corre en iangpu (GPU real) contra el dev server :5002.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/ui-fixes.png';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2,
    acceptDownloads: true });
  // Los errores de "WebGL context" son ambientales del headless (no de nuestro
  // código); esta prueba valida DOM/lógica (overlays HTML), no el render WebGL.
  const isBenign = (s) => /WebGL context|WebGL2?RenderingContext|THREE.WebGLRenderer/i.test(s);
  const errs = []; page.on('pageerror', e => { const s = String(e).slice(0, 200); if (!isBenign(s)) errs.push(s); });
  const out = { errs: [] };
  try {
    // espera el hook (sobrevive a re-montajes de Fast Refresh)
    const ready = async () => page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 15000 });
    const ev = async (fn, arg) => { await ready(); return page.evaluate(fn, arg); };
    // evRaw: solo espera el hook (no .ready) — para el doc VACÍO tras purgar el base.
    const evRaw = async (fn, arg) => { await page.waitForFunction('window.__forgeBrep', { timeout: 8000 }); return page.evaluate(fn, arg); };
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await ready();
    await page.waitForTimeout(800);

    // árbol = Sketch + Extrude (inicial) + Hole → 2 ops
    await ev(() => window.__forgeBrep.addOp('hole'));
    await page.waitForTimeout(500);
    const ops0 = await ev(() => window.__forgeBrep.opsList.length);

    // ── 1) COLAPSAR el panel de features ──
    await page.click('[data-testid="collapse-features"]');
    await page.waitForTimeout(250);
    const colClass = await page.evaluate(() =>
      document.querySelector('[data-testid="feature-tree"]').className.includes('collapsed'));
    const bodyHidden = await page.evaluate(() => {
      const n = document.querySelector('[data-testid="feat-sketch"]');
      return !n || getComputedStyle(n).display === 'none';
    });
    await page.screenshot({ path: SHOT.replace('.png', '-colapsado.png'), timeout: 30000 });
    // expandir de vuelta
    await page.click('[data-testid="collapse-features"]');
    await page.waitForTimeout(200);

    // ── 2) MENÚ de opciones + export STL ──
    await page.click('[data-testid="btn-options"]');
    await page.waitForTimeout(200);
    const menuVisible = await page.locator('[data-testid="options-menu"]').isVisible();
    const hasToggleSketch = await page.locator('[data-testid="menu-toggle-sketch"]').count();
    const hasStep = await page.locator('[data-testid="menu-export-step"]').count();
    const hasStl = await page.locator('[data-testid="menu-export-stl"]').count();
    await page.screenshot({ path: SHOT.replace('.png', '-menu.png'), timeout: 30000 });
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
      page.click('[data-testid="menu-export-stl"]'),
    ]);
    let stlName = null, stlBytes = 0;
    if (dl) { stlName = dl.suggestedFilename(); const p = '/tmp/forja-ui-test.stl'; await dl.saveAs(p); stlBytes = fs.statSync(p).size; }

    // ── 3) ÁRBOL: suprimir → renombrar → borrar nodo → purga del base ──
    await page.click('[data-testid="feat-suppress-hole"]');
    await page.waitForTimeout(200);
    const suppressed = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'hole')?.suppressed);
    const holeId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'hole')?.id);
    await ev((id) => window.__forgeBrep.renameOp(id, 'Mi Barreno'), holeId);
    await page.waitForTimeout(150);
    const renamed = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'hole')?.name);
    // borrar el hole (nodo)
    await page.click('[data-testid="feat-delete-hole"]');
    await page.waitForTimeout(300);
    const opsAfterDel = await ev(() => window.__forgeBrep.opsList.length);
    // borrar el EXTRUDE base → debe PURGAR (no quedan dependientes) → 0 ops
    await page.click('[data-testid="feat-delete-extrude"]');
    await page.waitForTimeout(300);
    const opsAfterBaseDel = await evRaw(() => window.__forgeBrep.opsList.length);

    out.ops0 = ops0; out.opsAfterDel = opsAfterDel; out.opsAfterBaseDel = opsAfterBaseDel;
    out.stlName = stlName; out.stlBytes = stlBytes; out.renamed = renamed; out.suppressed = suppressed;
    out.checks = {
      colapsa_panel: colClass === true && bodyHidden === true,
      menu_abre_con_items: menuVisible === true && hasToggleSketch === 1 && hasStep === 1 && hasStl === 1,
      exporta_stl: stlName === 'forja-part.stl' && stlBytes > 84,
      suprime_feature: suppressed === true,
      renombra_feature: renamed === 'Mi Barreno',
      borra_nodo: opsAfterDel === ops0 - 1,
      purga_dependientes: opsAfterBaseDel === 0,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
    await page.screenshot({ path: SHOT, timeout: 30000 });
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('UI_FIXES=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
