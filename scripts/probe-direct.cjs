#!/usr/bin/env node
/**
 * Force-load each math module directly and time how long it takes
 * for Suspense to resolve (canvas to exist + "compilando" gone).
 */
const { chromium } = require('playwright');

const MODULES = [
  { branchId: 'calc',    moduleId: 'tangent-plane' },
  { branchId: 'calc',    moduleId: 'series' },
  { branchId: 'linalg',  moduleId: 'eigen-3d' },
  { branchId: 'complex', moduleId: 'mobius' },
  { branchId: 'diffeq',  moduleId: 'phase-portrait' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  const errs = [];
  page.on('pageerror', e => errs.push(`[${page.url()}] pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') errs.push(`[error] ${m.text().slice(0, 300)}`);
  });

  await page.goto('http://localhost:5001/math.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  for (const t of MODULES) {
    const t0 = Date.now();
    // Expand branch if needed
    const mod = page.locator(`[data-testid="module-${t.moduleId}"]`);
    if ((await mod.count()) === 0) {
      await page.locator(`[data-testid="branch-${t.branchId}"]`).click().catch(()=>{});
      await page.waitForTimeout(200);
    }
    await mod.click();

    let ok = false;
    try {
      await page.waitForFunction(
        () => !document.body.innerText.includes('compilando'),
        { timeout: 30000 },
      );
      ok = true;
    } catch {}
    const elapsed = Date.now() - t0;
    console.log(`${ok ? '✓' : '✗'} ${t.moduleId.padEnd(15)} ${elapsed}ms`);
  }

  console.log('\n--- errors ---');
  for (const e of errs.slice(0, 30)) console.log(e);
  await browser.close();
})();
