#!/usr/bin/env node
/** Trace the CAD page: store snapshots at t=1,2,3,5,8s + all console output. */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/debug-pages';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript(() => { window.BroadcastChannel = undefined; });

  const page = await ctx.newPage();
  const events = [];
  page.on('pageerror', e => events.push({ t: Date.now(), kind: 'pageerror', text: e.message }));
  page.on('console', m => {
    const t = m.type();
    if (t === 'error' || t === 'warning') {
      events.push({ t: Date.now(), kind: t, text: m.text().slice(0, 400) });
    }
  });

  const t0 = Date.now();
  await page.goto('http://localhost:5001/', { waitUntil: 'domcontentloaded', timeout: 15000 });

  async function snap(label, waitMs) {
    await page.waitForTimeout(waitMs);
    const elapsed = Date.now() - t0;
    const info = await page.evaluate(async () => {
      try {
        const mod = await import('/src/lib/useForgeStore.ts');
        const s = mod.useForgeStore.getState();
        return {
          sceneLabel: s.scene?.label,
          sceneChildCount: s.scene?.children?.length ?? 0,
          variableCount: s.variables.length,
          firstVar: s.variables[0] ? { name: s.variables[0].name, val: s.variables[0].resolvedValue } : null,
          hasMesh: !!s.mesh,
          meshing: s.meshing,
          jointCount: s.joints.length,
          historyLen: s.history.length,
          historyIdx: s.historyIndex,
        };
      } catch (e) { return { error: e.message }; }
    });
    console.log(`[t=${elapsed}ms ${label}]`, JSON.stringify(info));
    await page.screenshot({ path: `/tmp/debug-pages/trace-${label}.png` });
  }

  await snap('1s', 1000);
  await snap('2s', 1000);
  await snap('3s', 1000);
  await snap('5s', 2000);
  await snap('8s', 3000);

  console.log('\n--- console events ---');
  for (const e of events.slice(0, 60)) {
    console.log(`[+${e.t - t0}ms ${e.kind}] ${e.text}`);
  }
  await browser.close();
})();
