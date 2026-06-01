#!/usr/bin/env node
// B2-volumen strict test. Runs on iangpu against :5002.
// 1) box 10mm side (=1cm) -> volume should be ~1 cm3 (order correct, not 1000x)
// 2) subtract an overlapping cylinder -> volume must DROP.
'use strict';
const { chromium } = require('playwright');
const OUT = process.env.SHOT || '/tmp/fix-B2-volumen.png';
const URL = process.env.CAD_URL || 'http://localhost:5002/cad.html';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  const logs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 240)));
  p.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });

  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // wait for store hook
  await p.waitForFunction(() => !!(window.__forge && window.__forge.getState), { timeout: 20000 });
  await sleep(2000);

  // Read the cm3 number from the visible status bar text.
  const readBarCm3 = () => p.evaluate(() => {
    const t = document.body.innerText || '';
    const m = t.match(/([\d.]+)\s*cm³/);
    return m ? parseFloat(m[1]) : null;
  });

  // ── Step 0: force a clean empty scene so volume is unambiguous ──
  const step0 = await p.evaluate(() => {
    const S = window.__forge.getState();
    const before = S.scene.children ? S.scene.children.length : 0;
    // setScene with an empty union root (same shape createEmptyScene produces)
    S.setScene({ id: 'qa_root', kind: 'operation', type: 'union', label: 'Unión', smoothness: 0.25, children: [] });
    return { childrenBefore: before, childrenAfter: window.__forge.getState().scene.children.length };
  });
  await sleep(400);

  // ── Step 1: add a box, set 10mm side, read volume ──
  const step1 = await p.evaluate(() => {
    const S = window.__forge.getState();
    // addPrimitive('box') creates a 1mm cube and selects it
    S.addPrimitive('box');
    const st = window.__forge.getState();
    const boxId = st.selectedId;
    // grow to 10mm side = 1cm
    st.updateNode(boxId, { params: { sizeX: 10, sizeY: 10, sizeZ: 10 } });
    return { boxId };
  });
  await sleep(900);
  const volBox_bar = await readBarCm3();
  const volBox_calc = await p.evaluate(() => {
    // recompute directly from the live scene via the same module the UI uses
    const st = window.__forge.getState();
    return { scene: st.scene, selectedId: st.selectedId,
             childCount: st.scene.children ? st.scene.children.length : 0 };
  });
  await p.screenshot({ path: OUT.replace('.png', '-1box.png') });

  // ── Step 2: add a cylinder, position to overlap & pierce the box, subtract ──
  const step2 = await p.evaluate((boxId) => {
    const S = window.__forge.getState();
    S.addPrimitive('cylinder');
    let st = window.__forge.getState();
    const cylId = st.selectedId;
    // cylinder default radius 0.5, height 1 (mm). Make it pierce the 10mm box:
    // radius 3mm, height 20mm, centered, vertical along Y -> goes through box.
    st.updateNode(cylId, { params: { radius: 3, height: 20 }, position: [0, 0.5, 0] });
    st = window.__forge.getState();
    // select the box as the subtract BASE, then run the boolean from menu
    st.setSelectedId(boxId);
    window.__forge.getState().addOperation('subtract');
    const after = window.__forge.getState();
    return { cylId, selectedAfter: after.selectedId,
             rootChildren: after.scene.children.length,
             rootChildKinds: after.scene.children.map(c => c.kind + ':' + (c.type||'')) };
  }, step1.boxId);
  await sleep(1100);
  const volSub_bar = await readBarCm3();
  await p.screenshot({ path: OUT });

  // Dump the resolved scene tree for evidence
  const tree = await p.evaluate(() => {
    const walk = (n, d=0) => {
      const pad = '  '.repeat(d);
      let s = pad + n.kind + (n.type ? '/' + n.type : '') + (n.label ? ' "' + n.label + '"' : '');
      if (n.params) s += ' ' + JSON.stringify(n.params);
      if (n.children) { s += '\n' + n.children.map(c => walk(c, d+1)).join('\n'); }
      return s;
    };
    return walk(window.__forge.getState().scene);
  });

  console.log('B2_RESULT=' + JSON.stringify({
    errs, consoleErrs: logs.slice(0, 5),
    step0, step1, step2,
    volBox_cm3: volBox_bar,
    volSub_cm3: volSub_bar,
    boxChildCount: volBox_calc.childCount,
    dropped: (volBox_bar != null && volSub_bar != null) ? (volSub_bar < volBox_bar) : null,
  }));
  console.log('TREE_START');
  console.log(tree);
  console.log('TREE_END');
  await b.close();
})().catch(e => { console.error('FATAL', e.stack || e.message); process.exit(1); });
