/**
 * La Forja — verifica los P1 del juez de interfaces:
 *   1) UNDO/REDO (pila de historial): add op → undo restaura → redo rehace.
 *   2) REORDENAR (↑/↓): moveOp intercambia y cambia el orden de cálculo.
 *   3) ROLLBACK: rollTo(n) construye solo hasta n; marcador visible; restaura punta.
 *   4) MENÚ CONTEXTUAL (clic derecho): aparece y sus acciones operan el nodo.
 * Corre en iangpu (GPU real) contra el dev server :5002.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/p1.png';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const isBenign = (s) => /WebGL context|WebGL2?RenderingContext|THREE.WebGLRenderer/i.test(s);
  const errs = []; page.on('pageerror', e => { const s = String(e).slice(0, 200); if (!isBenign(s)) errs.push(s); });
  const out = { errs: [] };
  try {
    const ready = async () => page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 15000 });
    const ev = async (fn, arg) => { await ready(); return page.evaluate(fn, arg); };
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // árbol = Extrude (inicial) + Hole + Fillet → 3 ops
    await ev(() => window.__forgeBrep.addOp('hole'));   await page.waitForTimeout(350);
    await ev(() => window.__forgeBrep.addOp('fillet')); await page.waitForTimeout(450);
    const ops0 = await ev(() => window.__forgeBrep.opsList.length);
    const canUndo0 = await ev(() => window.__forgeBrep.canUndo);

    // ── 1) UNDO / REDO ──
    await ev(() => window.__forgeBrep.undo()); await page.waitForTimeout(350);
    const afterUndo = await ev(() => window.__forgeBrep.opsList.length);
    const canRedo0 = await ev(() => window.__forgeBrep.canRedo);
    await ev(() => window.__forgeBrep.redo()); await page.waitForTimeout(350);
    const afterRedo = await ev(() => window.__forgeBrep.opsList.length);

    // ── 2) REORDENAR: bajar el Hole (swap hole<->fillet) ──
    const orderBefore = await ev(() => window.__forgeBrep.opsList.map(o => o.type).join(','));
    const holeId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'hole').id);
    await ev((id) => window.__forgeBrep.moveOp(id, 1), holeId); await page.waitForTimeout(450);
    const orderAfter = await ev(() => window.__forgeBrep.opsList.map(o => o.type).join(','));

    // ── 3) ROLLBACK: construir solo la 1ª op (extrude) ──
    await ev(() => window.__forgeBrep.rollTo(1)); await page.waitForTimeout(500);
    const rbIdx = await ev(() => window.__forgeBrep.rollbackIdx);
    const rbBar = await page.locator('[data-testid="rollback-bar"]').isVisible().catch(() => false);
    const rbStillBuilds = await ev(() => window.__forgeBrep.ready); // sigue habiendo sólido
    await ev(() => window.__forgeBrep.rollTo(null)); await page.waitForTimeout(450);
    const rbRestored = await ev(() => window.__forgeBrep.rollbackIdx);

    // ── 4) MENÚ CONTEXTUAL: clic derecho en el Fillet → suprimir ──
    await page.click('[data-testid="feat-fillet"]', { button: 'right' });
    await page.waitForTimeout(250);
    const ctxVisible = await page.locator('[data-testid="ctx-menu"]').isVisible();
    const ctxItems = await page.evaluate(() =>
      ['ctx-edit', 'ctx-rename', 'ctx-up', 'ctx-down', 'ctx-suppress', 'ctx-rollback', 'ctx-delete']
        .filter(id => document.querySelector(`[data-testid="${id}"]`)).length);
    await page.screenshot({ path: SHOT.replace('.png', '-ctx.png'), timeout: 30000 });
    await page.click('[data-testid="ctx-suppress"]'); await page.waitForTimeout(350);
    const filletSuppressed = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'fillet').suppressed);

    await page.screenshot({ path: SHOT, timeout: 30000 });
    out.ops0 = ops0; out.afterUndo = afterUndo; out.afterRedo = afterRedo;
    out.orderBefore = orderBefore; out.orderAfter = orderAfter;
    out.rbIdx = rbIdx; out.rbRestored = rbRestored; out.ctxItems = ctxItems;
    out.checks = {
      undo_restaura: canUndo0 === true && afterUndo === ops0 - 1,
      redo_rehace: canRedo0 === true && afterRedo === ops0,
      reordena: orderBefore === 'extrude,hole,fillet' && orderAfter === 'extrude,fillet,hole',
      rollback_construye: rbIdx === 1 && rbBar === true && rbStillBuilds === true,
      rollback_restaura: rbRestored === null,
      ctx_menu_completo: ctxVisible === true && ctxItems === 7,
      ctx_acciona: filletSuppressed === true,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('P1=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
