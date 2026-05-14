#!/usr/bin/env node
const { chromium } = require('playwright');

// Navigation sequence — simulates user clicking through modules
const SEQUENCE = [
  'complex/mobius',
  'complex/roots',
  'complex/conformal',
  'complex/mobius',    // come back
  'linalg/matrix-3d',
  'linalg/rotations',
  'linalg/pca',
  'complex/roots',     // come back again
  'calc/tangent-plane',
];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(`PAGEERR: ${e.message}`));
  page.on('console', m => {
    const txt = m.text();
    if (m.type() === 'error') errs.push(`CONSOLE: ${txt.slice(0, 300)}`);
    if (m.type() === 'warning' && (txt.includes('WebGL') || txt.includes('context')))
      errs.push(`WARN: ${txt.slice(0, 300)}`);
  });

  await page.goto('http://localhost:5001/math.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  for (let i = 0; i < SEQUENCE.length; i++) {
    const target = SEQUENCE[i];
    const before = errs.length;
    // Trigger hash change
    await page.evaluate(t => { window.location.hash = t; }, target);
    await page.waitForTimeout(2500);

    const state = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      let blackCanvases = 0;
      canvases.forEach(c => {
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl || gl.isContextLost()) blackCanvases++;
      });
      return {
        nCanvas: canvases.length,
        lost: blackCanvases,
        bodyTxt: document.body.innerText.slice(0, 60),
      };
    });
    const newErrs = errs.slice(before);
    console.log(`[${i + 1}/${SEQUENCE.length}] ${target}  canvas=${state.nCanvas} lost=${state.lost}`);
    if (newErrs.length) console.log(`   NEW ERRS: ${newErrs.slice(0, 3).join(' | ')}`);
    if (state.lost > 0) console.log(`   ⚠ ${state.lost} canvases have lost context`);
  }

  await page.screenshot({ path: '/tmp/math-after-nav.png' });
  console.log(`\nTotal errs collected: ${errs.length}`);
  await ctx.close();
  await browser.close();
})();
