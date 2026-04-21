const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5001/physics.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Probe DOM to see what's there
  const ids = await page.evaluate(() => {
    const els = document.querySelectorAll('[data-testid]');
    return Array.from(els).map(e => e.getAttribute('data-testid'));
  });
  console.log('testids:', ids.slice(0, 40));

  // Click bio, wait, then click docking via evaluate
  const bioClicked = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="branch-bio"]');
    if (el) { el.click(); return true; }
    return false;
  });
  console.log('bio clicked:', bioClicked);
  await page.waitForTimeout(500);

  const ids2 = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid')).filter(t => t && t.startsWith('module-'));
  });
  console.log('modules after bio click:', ids2);

  const dockClicked = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="module-docking"]');
    if (el) { el.click(); return true; }
    return false;
  });
  console.log('docking clicked:', dockClicked);
  await page.waitForTimeout(8000);

  fs.mkdirSync('/tmp/physics-screenshots/docking', { recursive: true });
  await page.screenshot({ path: '/tmp/physics-screenshots/docking/probe.png', timeout: 60000 });

  const sidebar = await page.evaluate(() => {
    const asides = document.querySelectorAll('aside');
    return asides.length > 0 ? asides[asides.length - 1].innerText : '(no aside)';
  });
  console.log('\n--- sidebar ---');
  console.log(sidebar);

  console.log('\n--- errors ---');
  for (const l of logs) if (l.includes('error') || l.includes('Error') || l.includes('pageerror')) console.log(l);

  await browser.close();
})();
