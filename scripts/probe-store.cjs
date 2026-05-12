#!/usr/bin/env node
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  await ctx.addInitScript(() => {
    window.BroadcastChannel = undefined;
    // Expose useForgeStore to console
    window.__probeReady = false;
  });

  page.on('console', m => {
    if (m.type() === 'error') console.log(`[error] ${m.text()}`);
  });

  await page.goto('http://localhost:5001/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  // Give the mount effect time to run
  await page.waitForTimeout(4500);

  // Now probe the Zustand store via the page context. Vite makes modules
  // available via import.meta — we need to navigate to find the store.
  const probe = await page.evaluate(async () => {
    // The store is imported by many components. We can grab it from any
    // root react fiber, but simpler: re-import via dynamic import.
    try {
      const mod = await import('/src/lib/useForgeStore.ts');
      const state = mod.useForgeStore.getState();
      const summarize = (node, depth=0) => {
        if (!node) return null;
        const isPrim = node.kind === 'primitive';
        const base = {
          id: node.id,
          kind: node.kind,
          label: node.label,
          type: isPrim ? node.type : node.op,
          childCount: isPrim ? 0 : (node.children || []).length,
        };
        if (depth >= 2 || isPrim) return base;
        return { ...base, children: (node.children || []).slice(0, 5).map(c => summarize(c, depth + 1)) };
      };
      return {
        scene: summarize(state.scene),
        sceneChildCount: state.scene.children?.length ?? 0,
        variables: state.variables.map(v => ({ name: v.name, expr: v.expression, val: v.resolvedValue, linkedPrimId: v.linkedPrimId })),
        joints: state.joints.map(j => ({ id: j.id, type: j.type, label: j.label, parentId: j.parentId, childId: j.childId })),
        meshing: state.meshing,
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log(JSON.stringify(probe, null, 2));

  await browser.close();
})();
