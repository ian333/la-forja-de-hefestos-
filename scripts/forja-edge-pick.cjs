#!/usr/bin/env node
/**
 * forja-edge-pick.cjs — QA del PICKING DE ARISTA por clic (La Forja Part Studio).
 * Corre EN iangpu (GPU real, ANGLE). Maneja la UI con CLICS reales:
 *   1) carga (caja por defecto: rect extruido),
 *   2) activa picking de arista (btn-fillet → modo edge → tubos pickeables),
 *   3) CLIC en una arista del VIEWPORT (raycast a tubo → edgeId real),
 *   4) verifica selectedEdgeId + resalte + lee hud-selected-edge,
 *   5) CLIC en edge-item de la lista (selección determinista),
 *   6) presets de EJE GLOBAL en Revolve (axis-x/y/z) + revolve por arista.
 *
 *   node scripts/forja-edge-pick.cjs   (URL=http://localhost:5002/forja-brep.html)
 * Screenshot a /tmp/forja-revolve/picking-edge.png
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/forja-revolve';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const errs = [];

const get = (page) => page.evaluate(() => {
  const a = window.__forgeBrep;
  if (!a) return null;
  return {
    ready: a.ready,
    selectedEdgeId: a.selectedEdgeId,
    selectedFaceId: a.selectedFaceId,
    selectedEdgeAxis: a.selectedEdgeAxis,
    edgeGeoms: (a.listEdgeGeoms() || []).map((g) => ({ edgeId: g.edgeId, kind: g.kind, hasAxis: !!g.axis, len: g.length })),
    inv: a.invariants,
  };
});

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  const report = { url: URL, steps: [], errs };
  const note = (k, v) => { report.steps.push({ [k]: v }); console.log(k + ' = ' + JSON.stringify(v)); };

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  // Espera a que el kernel construya el primer sólido.
  await page.waitForFunction(() => window.__forgeBrep && window.__forgeBrep.ready, { timeout: 60000 });
  await page.waitForTimeout(1500);

  let st = await get(page);
  note('after_load', { ready: st.ready, n_edges: st.inv && st.inv.n_edges, euler: st.inv && st.inv.euler, vol: st.inv && st.inv.vol_kernel });
  note('edge_geoms_box', st.edgeGeoms.length + ' edges, all line=' + st.edgeGeoms.every((g) => g.kind === 'line') + ', all axis=' + st.edgeGeoms.every((g) => g.hasAxis));

  // ── 2) Activar picking de arista en INSPECCIÓN (sin op): la caja queda LIMPIA
  //       (12 aristas) y los tubos pickeables se renderizan en modo edge. ──
  await page.evaluate(() => window.__forgeBrep.setPickMode('edge'));
  await page.waitForTimeout(800);

  // ── 3) CLIC en una ARISTA en el VIEWPORT (caja limpia, 12 aristas) ──
  // Probamos varias coordenadas alrededor del borde del sólido hasta que un clic
  // golpee un tubo (selectedEdgeId pasa de null a un índice válido).
  const canvas = await page.$('[data-testid="viewport-canvas"]') || await page.$('canvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  // Offsets que tienden a caer sobre las aristas de una caja vista en 3/4.
  const tries = [
    [ -150,  -90 ], [ 150, -90 ], [ 150, 95 ], [ -150, 95 ],
    [ 0, -130 ], [ 175, 0 ], [ -175, 0 ], [ 0, 135 ],
    [ -110, -120 ], [ 120, -120 ], [ 130, 110 ], [ -130, 110 ],
    [ -60, -135 ], [ 70, -135 ], [ 200, 40 ], [ -200, 40 ],
  ];
  let viewportPicked = null;
  for (const [dx, dy] of tries) {
    await page.mouse.click(cx + dx, cy + dy);
    await page.waitForTimeout(220);
    const s = await get(page);
    if (s.selectedEdgeId != null) { viewportPicked = { dx, dy, edgeId: s.selectedEdgeId }; break; }
  }
  st = await get(page);
  note('viewport_pick', viewportPicked);
  note('selected_after_viewport_click', st.selectedEdgeId);
  // La caja LIMPIA tiene 12 aristas (0..11): un edgeId en rango confirma que el
  // raycast golpeó un tubo de arista REAL (no la heurística vieja).
  const viewportInRange = st.selectedEdgeId != null && st.selectedEdgeId >= 0 && st.selectedEdgeId < 12;
  note('viewport_edge_in_box_range', viewportInRange);

  // Lee el HUD de arista (debe reflejar el edgeId seleccionado).
  const hudEdgeText = await page.textContent('[data-testid="hud-selected-edge"]').catch(() => null);
  note('hud_selected_edge_text', hudEdgeText);
  const hudHasIndex = st.selectedEdgeId != null && hudEdgeText && hudEdgeText.includes('#' + st.selectedEdgeId);
  note('hud_matches_selected', !!hudHasIndex);

  await page.screenshot({ path: path.join(OUT, 'picking-edge.png') });
  note('shot', path.join(OUT, 'picking-edge.png'));

  // ── 5) CLIC en edge-item de la LISTA (panel Fillet, determinista) ──
  await page.click('[data-testid="btn-fillet"]');
  await page.waitForTimeout(1000);
  note('btn_pick_edge_present', !!(await page.$('[data-testid="btn-pick-edge"]')));
  note('edge_list_present', !!(await page.$('[data-testid="edge-list"]')));
  const sBeforeList = (await get(page)).selectedEdgeId;
  const wantList = sBeforeList === 3 ? 7 : 3;
  const listBtn = await page.$(`[data-testid="edge-item-${wantList}"]`);
  if (listBtn) {
    await listBtn.click();
    await page.waitForTimeout(500);
    const s2 = await get(page);
    note('list_pick', { clicked: wantList, selectedEdgeId: s2.selectedEdgeId, changed: s2.selectedEdgeId === wantList });
  } else {
    note('list_pick', 'edge-item-' + wantList + ' no encontrado');
  }
  // Quita la op de fillet para no contaminar el siguiente paso.
  await page.click('[data-testid="btn-del-op"]').catch(() => {});
  await page.waitForTimeout(800);

  // ── 6) Presets de EJE GLOBAL en el panel Revolve ──
  // Agrega Revolve (botón real) → panel con axis-x/y/z/edge.
  await page.click('[data-testid="btn-revolve"]');
  await page.waitForTimeout(1500);
  const axX = await page.$('[data-testid="axis-x"]');
  const axY = await page.$('[data-testid="axis-y"]');
  const axZ = await page.$('[data-testid="axis-z"]');
  const axEdge = await page.$('[data-testid="axis-edge"]');
  note('axis_presets_present', { x: !!axX, y: !!axY, z: !!axZ, edge: !!axEdge });

  // Cambia entre presets de eje y confirma que cada uno dispara un rebuild SIN
  // crash (el revolve es no-op aquí porque ya hay un sólido del extrude, pero el
  // control de eje queda probado; el revolve puro se valida en página aparte).
  for (const [name, ax] of [['y', axY], ['x', axX], ['z', axZ]]) {
    if (!ax) continue;
    await ax.click();
    await page.waitForTimeout(1200);
    const s = await get(page);
    note('axis_' + name + '_rebuild_ok', !!(s.inv && s.inv.vol_kernel > 0) && errs.length === 0);
  }
  // Selecciona el modo 'arista' como eje y confirma que aparece btn-pick-edge.
  if (axEdge) {
    await axEdge.click();
    await page.waitForTimeout(800);
    note('axis_edge_shows_pick_btn', !!(await page.$('[data-testid="btn-pick-edge"]')));
    note('axis_edge_shows_edge_list', !!(await page.$('[data-testid="edge-list"]')));
  }

  fs.writeFileSync(path.join(OUT, 'edge-pick-report.json'), JSON.stringify(report, null, 2));
  console.log('\nDONE · errs=' + errs.length);
  console.log('EDGE_PICK_RESULT=' + JSON.stringify({
    viewport_edge_id: st.selectedEdgeId,
    viewport_in_box_range: viewportInRange,
    hud_matches: !!hudHasIndex,
    n_edges_box: 12,
    errs: errs.length,
  }));
  await browser.close();
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
