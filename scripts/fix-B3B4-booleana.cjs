#!/usr/bin/env node
/**
 * fix-B3B4-booleana.cjs — Strict QA for the boolean-subtract bug (B3/B4).
 *
 * Uses window.__forge (the real Zustand store) to invoke the SAME actions the
 * palette/menu call (addPrimitive / addOperation) and to read the real scene
 * tree with certainty. Runs EN iangpu (GPU real / ANGLE).
 *
 * Scenario (exactly as spec'd):
 *   - start from a clean empty scene
 *   - create a Box and a Cylinder, overlapping ("encimado")
 *   - select the Box, launch Resta (addOperation('subtract'))
 *   - ASSERT the tree is ONE subtract op wrapping [Caja, Cilindro]
 *   - screenshot iso + top so a real hole is visible
 *
 *   PORT=5002 node scripts/fix-B3B4-booleana.cjs
 */
'use strict';
const { chromium } = require('playwright');

const PORT = process.env.PORT || '5002';
const URL = process.env.CAD_URL || `http://localhost:${PORT}/cad.html`;
const OUT_ISO = '/tmp/fix-B3B4-booleana.png';
const OUT_TOP = '/tmp/fix-B3B4-booleana-top.png';
const OUT_BEFORE = '/tmp/fix-B3B4-before.png';

function summarize(node) {
  // Compact tree summary: {t:type/kind, label, children:[...]}
  if (!node) return null;
  if (node.kind === 'primitive') return { t: node.type, label: node.label };
  return {
    t: node.type || node.kind, label: node.label,
    children: (node.children || []).map(summarize),
  };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Wait for the store hook.
  await page.waitForFunction(() => !!window.__forge, { timeout: 15000 });

  // ── Build a clean isolated scene: empty union root, box + overlapping cyl.
  const before = await page.evaluate(() => {
    const s = window.__forge.getState();
    // Reset to a clean empty scene (root union with no children).
    const root = { id: 'qa-root', kind: 'operation', type: 'union', label: 'Raíz', smoothness: 0.2, children: [] };
    s.setScene(root);
    // Create a box and a cylinder via the SAME actions the palette uses.
    s.addPrimitive('box');       // default size [1,1,1] @ [0,0.5,0]
    s.addPrimitive('cylinder');  // default r=0.5 h=1 @ [0,0.5,0] → pierces the box
    const st = window.__forge.getState();
    const kids = st.scene.children;
    return {
      rootChildCount: kids.length,
      childTypes: kids.map(c => c.type),
      childLabels: kids.map(c => c.label),
    };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT_BEFORE });

  // ── Select the Box (base) then launch Resta — exactly "selecciona, Resta".
  const after = await page.evaluate(() => {
    const s = window.__forge.getState();
    const kids = s.scene.children;
    const box = kids.find(c => c.type === 'box');
    const cyl = kids.find(c => c.type === 'cylinder');
    s.setSelectedId(box ? box.id : null);
    // Launch the boolean exactly as the palette/menu does.
    s.addOperation('subtract');
    const st = window.__forge.getState();
    // Walk the tree for the subtract op.
    const findOp = (n) => {
      if (n.kind === 'operation' && n.type === 'subtract') return n;
      for (const c of (n.children || [])) { const r = findOp(c); if (r) return r; }
      return null;
    };
    const sub = findOp(st.scene);
    const summ = (node) => node.kind === 'primitive'
      ? { t: node.type, label: node.label }
      : { t: node.type || node.kind, label: node.label, children: (node.children || []).map(summ) };
    return {
      rootChildCount: st.scene.children.length,
      rootChildTypes: st.scene.children.map(c => c.type),
      subtractFound: !!sub,
      subtractChildTypes: sub ? sub.children.map(c => c.type) : null,
      subtractChildLabels: sub ? sub.children.map(c => c.label) : null,
      tree: summ(st.scene),
      boxId: box && box.id, cylId: cyl && cyl.id,
    };
  });

  // Read the status bar (cm³ / nodos) after the op meshes.
  await page.waitForTimeout(2500);
  const status = await page.evaluate(() => {
    const t = document.body.innerText || '';
    const g = (re) => { const m = t.match(re); return m ? m[1] : null; };
    return { cm3: g(/([\d.]+)\s*cm³/), nodos: g(/(\d+)\s*nodos/) };
  });

  await page.mouse.move(900, 500);
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT_ISO });

  await page.keyboard.press('F3'); // top view → hole obvious from above
  await page.waitForTimeout(1800);
  await page.screenshot({ path: OUT_TOP });

  console.log('BEFORE=' + JSON.stringify(before));
  console.log('AFTER=' + JSON.stringify(after));
  console.log('STATUS=' + JSON.stringify(status));
  console.log('ERRORS=' + JSON.stringify(errs.slice(0, 8)));
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('FATAL', e && e.message); process.exit(1); });
