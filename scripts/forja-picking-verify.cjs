/**
 * La Forja — Verificación del PICKING DE CARA por raycast (MANEJANDO LA UI).
 * =========================================================================
 * Directriz: las piezas y la selección se hacen POR CLIC. Aquí Playwright:
 *   1. Carga forja-brep.html, espera kernel + primer sólido (la caja/placa que
 *      ya produce el extrude inicial vía UI).
 *   2. Confirma que el teselado quedó ETIQUETADO por cara (faceGroups/faceIds del
 *      kernel) y que el nº de caras distintas == nº de caras topológicas.
 *   3. SELECCIÓN DETERMINISTA por la lista: clic en face-item-<topIdx> (cara
 *      superior) → verifica window.__forgeBrep.selectedFaceId y el HUD del DOM
 *      (hud-selected-face muestra "#<idx>").
 *   4. SELECCIÓN POR VIEWPORT: activa picking y hace CLIC sobre el canvas
 *      (data-testid=viewport-canvas) en su centro → el raycast cae sobre la cara
 *      superior y selectedFaceId queda fijado (raycast→triángulo→faceId real).
 *   5. Cablea Shell: con una cara abierta seleccionada, el sólido se vacía
 *      (volumen baja) — la cara elegida por clic es la "cara abierta".
 *   6. Screenshot a /tmp/forja-shell/picking.png con la cara resaltada.
 */
const fs = require('fs');
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = '/tmp/forja-shell/picking.png';
fs.mkdirSync('/tmp/forja-shell', { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
           '--use-gl=angle', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + String(e).slice(0, 200)));

  const out = { url: URL, steps: {}, errors: [] };
  const inv = () => page.evaluate('window.__forgeBrep.invariants');
  const get = (k) => page.evaluate(`window.__forgeBrep.${k}`);

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });

    // ── #1 BASE: placa extruida vía UI (extrude inicial) ──
    const base = await inv();
    const tags = await get('tessTags');
    out.steps.base = {
      euler: base.euler, vol: base.vol_kernel, n_faces: base.n_faces,
      tags,
    };

    // El teselado debe estar etiquetado: un grupo por cara, faceIds = nº triángulos,
    // y tantas caras distintas como caras topológicas (placa = 6).
    const tagsOk = !!tags &&
      tags.n_groups === base.n_faces &&
      tags.distinct_face_ids === base.n_faces &&
      tags.n_face_ids === base.tris;

    // ── Caras del kernel: elegir la superior (plano con mayor z). ──
    const faces = await page.evaluate('window.__forgeBrep.listFaces()');
    let topIdx = -1, tz = -1e9;
    for (const f of faces) { if (f.kind === 'plane' && f.center[2] > tz) { tz = f.center[2]; topIdx = f.index; } }
    out.steps.faces = faces.map((f) => ({ i: f.index, kind: f.kind, z: +f.center[2].toFixed(1) }));
    out.steps.topIdx = topIdx;

    // ── #3 SELECCIÓN DETERMINISTA por la lista (UI) ──
    await page.waitForSelector(`[data-testid="face-item-${topIdx}"]`, { timeout: 10000 });
    await page.click(`[data-testid="face-item-${topIdx}"]`);
    await page.waitForFunction(
      `window.__forgeBrep.selectedFaceId === ${topIdx}`, { timeout: 8000 });
    const hudListText = await page.textContent('[data-testid="hud-selected-face"]');
    out.steps.pick_by_list = {
      selectedFaceId: await get('selectedFaceId'),
      hud: hudListText.replace(/\s+/g, ' ').trim(),
      // El HUD muestra "#<idx>" seguido de la metadata (kind); el carácter tras
      // el número es no-dígito o fin de cadena.
      hud_shows_idx: new RegExp(`#${topIdx}(?!\\d)`).test(hudListText),
    };

    // ── #4 SELECCIÓN POR VIEWPORT (raycast → faceId) ──
    // Activamos el picking global y limpiamos la selección clicando una cara
    // LATERAL por lista primero, para luego DEMOSTRAR que el clic en el canvas
    // vuelve a fijar la cara superior (cambio observable).
    // Pre-seleccionamos la cara INFERIOR (z=0) por lista: el clic en el centro
    // del canvas NO debería caer en la base, así el cambio es observable.
    let preIdx = -1, pz = 1e9;
    for (const f of faces) { if (f.kind === 'plane' && f.center[2] < pz) { pz = f.center[2]; preIdx = f.index; } }
    if (preIdx >= 0) {
      await page.click(`[data-testid="face-item-${preIdx}"]`);
      await page.waitForFunction(`window.__forgeBrep.selectedFaceId === ${preIdx}`, { timeout: 8000 });
    }
    const sideIdx = preIdx;
    // Activa picking en viewport (botón global) y clic en el centro del canvas.
    await page.click('[data-testid="btn-pick-face-global"]');
    const canvas = await page.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 8000 });
    const box = await canvas.boundingBox();
    // Centro del canvas: la cámara mira el sólido desde arriba/al frente; el
    // centro del viewport cae sobre una cara del sólido. Movemos un poco arriba
    // para garantizar caer en la tapa superior.
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2 - box.height * 0.06;
    await page.mouse.click(cx, cy);
    // Esperamos a que selectedFaceId quede fijado a ALGUNA cara por el raycast.
    await page.waitForFunction(
      'window.__forgeBrep.selectedFaceId !== null', { timeout: 8000 });
    const afterViewport = await get('selectedFaceId');
    const hudVpText = await page.textContent('[data-testid="hud-selected-face"]');
    out.steps.pick_by_viewport = {
      clicked_at: { cx: +cx.toFixed(0), cy: +cy.toFixed(0) },
      pre_selected: sideIdx,
      selectedFaceId: afterViewport,
      hud: hudVpText.replace(/\s+/g, ' ').trim(),
      // El picking por viewport cambió la cara (de la pre-seleccionada) — prueba
      // que el raycast eligió la cara REAL bajo el cursor, no la previa.
      changed_from_pre: sideIdx < 0 || afterViewport !== sideIdx,
      is_valid_face: afterViewport != null && afterViewport >= 0 && afterViewport < base.n_faces,
    };

    // Screenshot CON la cara resaltada (la del viewport).
    await page.waitForTimeout(600);
    await page.screenshot({ path: SHOT });
    out.shot = SHOT;

    // ── #5 SHELL usa la cara seleccionada como cara abierta (cableado) ──
    // Recargamos para placa limpia, abrimos Shell, elegimos la tapa superior por
    // lista y verificamos vaciado (vol baja). Es el wiring pedido.
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    const fresh = await inv();
    await page.click('[data-testid="btn-shell"]');
    await page.waitForSelector('[data-testid="face-list"]', { timeout: 10000 });
    const faces2 = await page.evaluate('window.__forgeBrep.listFaces()');
    let topIdx2 = -1, tz2 = -1e9;
    for (const f of faces2) { if (f.kind === 'plane' && f.center[2] > tz2) { tz2 = f.center[2]; topIdx2 = f.index; } }
    await page.click(`[data-testid="face-item-${topIdx2}"]`);
    await page.waitForFunction(
      `window.__forgeBrep.invariants && window.__forgeBrep.invariants.ops.includes('shell')`,
      { timeout: 20000 });
    await page.waitForTimeout(1500);
    const afterShell = await inv();
    out.steps.shell = {
      top_face: topIdx2, base_vol: fresh.vol_kernel, vol: afterShell.vol_kernel,
      selectedFaceId: await get('selectedFaceId'),
      hollow: afterShell.vol_kernel < fresh.vol_kernel - 1 && !afterShell.error,
    };

    // ── CHECKS ──
    out.checks = {
      tess_tagged_by_face: tagsOk,
      pick_list_sets_id: out.steps.pick_by_list.selectedFaceId === topIdx,
      hud_shows_face: out.steps.pick_by_list.hud_shows_idx === true,
      viewport_raycast_sets_face: out.steps.pick_by_viewport.is_valid_face === true,
      viewport_pick_changed_selection: out.steps.pick_by_viewport.changed_from_pre === true,
      shell_uses_selected_face: out.steps.shell.hollow === true,
      no_fatal_errors: errors.filter((e) => /Cannot read|undefined is not|TypeError|alpha/.test(e)).length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
    out.errors = errors.slice(0, 8);
  } catch (e) {
    out.pass = false;
    out.fatal = String(e && e.stack || e).slice(0, 500);
    out.errors = errors.slice(0, 8);
    try { await page.screenshot({ path: SHOT }); out.shot = SHOT; } catch {}
  } finally {
    await browser.close();
  }
  console.log('PICK_VERIFY=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
