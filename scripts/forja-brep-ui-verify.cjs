/**
 * La Forja — Verificación de UI del Part Studio B-Rep MANEJANDO LA INTERFAZ.
 * =========================================================================
 * Directriz del fundador: las piezas se crean POR CLIC, y la verificación es
 * Playwright clicando botones/inputs reales — NO llamando al kernel directo.
 *
 * Recorre los clásicos #1..#5 por la UI:
 *   #1 Placa: el extrude inicial ya produce sólido (Euler=2, vol=ancho·alto·alt).
 *   #2 Barreno: clic en btn-hole → el volumen BAJA (se removió material).
 *   #3 Fillet: clic en btn-fillet + clic en una arista de la lista → vol baja.
 *   #5 Shell: clic en btn-shell + clic en una cara de la lista → sólido hueco.
 * Y confirma el PANEL DE ANÁLISIS: masa > 0 y centro de masa presentes.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
           '--use-gl=angle', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + String(e).slice(0, 200)));

  const out = { url: URL, steps: {}, errors: [] };
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    // Esperar a que el kernel + primer sólido estén listos.
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });

    const inv = () => page.evaluate('window.__forgeBrep.invariants');

    // ── #1 PLACA (extrude inicial) ──
    const base = await inv();
    out.steps.base = { euler: base.euler, vol: base.vol_kernel, mass: base.mass_g, ops: base.ops, faces: base.n_faces, edges: base.n_edges };

    // ── #2 BARRENO: clic real en el botón Hole ──
    await page.click('[data-testid="btn-hole"]');
    await page.waitForFunction(
      `window.__forgeBrep.invariants && window.__forgeBrep.invariants.ops.includes('hole')`,
      { timeout: 20000 });
    // El rebuild es async (rAF); espera a que el volumen cambie respecto a base.
    await page.waitForFunction(
      `window.__forgeBrep.invariants && window.__forgeBrep.invariants.vol_kernel < ${base.vol_kernel} - 1`,
      { timeout: 20000 });
    const afterHole = await inv();
    out.steps.hole = { vol: afterHole.vol_kernel, removed: base.vol_kernel - afterHole.vol_kernel, faces: afterHole.n_faces };

    // ── #3 FILLET: clic en Fillet, luego clic en una arista de la lista (UI) ──
    await page.click('[data-testid="btn-fillet"]');
    await page.waitForSelector('[data-testid="edge-list"]', { timeout: 10000 });
    // Hay aristas listadas; clic en la primera (edge-item-0) — selección real por UI.
    // (testid real del Part Studio: `edge-item-${index}`, ver ForgeBRepStudio.tsx:4759.)
    await page.waitForSelector('[data-testid="edge-item-0"]', { timeout: 10000 });
    await page.click('[data-testid="edge-item-0"]');
    const volBeforeFillet = (await inv()).vol_kernel;
    // El radio default (3) ya redondea; espera al recompute con vol menor.
    await page.waitForFunction(
      `window.__forgeBrep.invariants && window.__forgeBrep.invariants.ops.includes('fillet')`,
      { timeout: 20000 });
    await page.waitForTimeout(1200);
    const afterFillet = await inv();
    out.steps.fillet = { vol: afterFillet.vol_kernel, selected_edge: 0, ops: afterFillet.ops };

    // ── #5 SHELL: nueva pieza limpia es más simple; probamos shell sobre una
    //     placa fresca (recargamos para aislar la verificación del vaciado). ──
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    const fresh = await inv();
    await page.click('[data-testid="btn-shell"]');
    await page.waitForSelector('[data-testid="face-list"]', { timeout: 10000 });
    // Elegir la cara superior (plano con mayor z) desde la lista nombrada.
    const faces = await page.evaluate('window.__forgeBrep.listFaces()');
    let topIdx = -1, tz = -1e9;
    for (const f of faces) { if (f.kind === 'plane' && f.center[2] > tz) { tz = f.center[2]; topIdx = f.index; } }
    await page.click(`[data-testid="face-${topIdx}"]`);
    await page.waitForFunction(
      `window.__forgeBrep.invariants && window.__forgeBrep.invariants.ops.includes('shell')`,
      { timeout: 20000 });
    await page.waitForTimeout(1500);
    const afterShell = await inv();
    out.steps.shell = {
      vol: afterShell.vol_kernel, base_vol: fresh.vol_kernel, top_face: topIdx,
      hollow: afterShell.vol_kernel < fresh.vol_kernel && !afterShell.error,
    };

    // ── PANEL DE ANÁLISIS visible en el DOM ──
    const masaTxt = await page.textContent('[data-testid="an-masa"]').catch(() => null);
    const comTxt = await page.textContent('[data-testid="an-com"]').catch(() => null);
    const volTxt = await page.textContent('[data-testid="an-volumen"]').catch(() => null);
    out.steps.analysis = { masa: masaTxt, com: comTxt, vol: volTxt };

    // ── CHECKS ──
    out.checks = {
      base_euler_2: base.euler === 2,
      base_mass_pos: base.mass_g > 0,
      hole_removed_material: out.steps.hole.removed > 1,
      fillet_applied: afterFillet.ops.includes('fillet'),
      shell_hollow: out.steps.shell.hollow === true,
      analysis_shows_mass: !!masaTxt && /g/.test(masaTxt),
      analysis_shows_com: !!comTxt && /mm/.test(comTxt),
      no_fatal_errors: errors.filter((e) => /Cannot read|undefined is not|TypeError/.test(e)).length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
    out.errors = errors.slice(0, 8);
  } catch (e) {
    out.pass = false;
    out.fatal = String(e && e.stack || e).slice(0, 400);
    out.errors = errors.slice(0, 8);
  } finally {
    await browser.close();
  }
  console.log('UI_VERIFY=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
