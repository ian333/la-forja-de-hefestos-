#!/usr/bin/env node
/** Screenshot the Hook view of every Cálculo module that has a LessonPanel. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = '/tmp/lessons-all';
fs.mkdirSync(OUT, { recursive: true });

const MODULES = [
  { name: 'tangent',      branchId: 'calc', moduleId: 'tangent-plane' },
  { name: 'derivative',   branchId: 'calc', moduleId: 'derivative-1d' },
  { name: 'integral',     branchId: 'calc', moduleId: 'integral-area' },
  { name: 'taylor',       branchId: 'calc', moduleId: 'series' },
  { name: 'vectorfields', branchId: 'calc', moduleId: 'vector-fields' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });

  for (const t of MODULES) {
    const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errs.push(`error: ${m.text().slice(0, 200)}`); });

    await page.goto('http://localhost:5001/math.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    if (t.moduleId !== 'tangent-plane') {
      const mod = page.locator(`[data-testid="module-${t.moduleId}"]`);
      if ((await mod.count()) === 0) {
        await page.locator(`[data-testid="branch-${t.branchId}"]`).click();
        await page.waitForTimeout(200);
      }
      await mod.click();
    }

    // Wait for the module to render
    try {
      await page.waitForFunction(
        () => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'),
        { timeout: 25000 },
      );
    } catch { console.log(`[warn] ${t.name} did not render in 25s`); }
    await page.waitForTimeout(2000);

    // Take a hook screenshot
    await page.screenshot({ path: path.join(OUT, `${t.name}-hook.png`) });

    // Click "empezar →" to enter step 1
    const startBtn = page.locator('button', { hasText: /empezar/ });
    if (await startBtn.count() > 0) {
      await startBtn.first().click();
      await page.waitForTimeout(2500); // halfway through animation
      await page.screenshot({ path: path.join(OUT, `${t.name}-step1.png`) });
    }

    console.log(`[shot] ${t.name} ${errs.length ? '(' + errs.length + ' errs: ' + errs[0] + ')' : ''}`);
    await ctx.close();
  }

  await browser.close();
})();
