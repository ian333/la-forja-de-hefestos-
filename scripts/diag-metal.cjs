const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:4173/physics.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  let m = p.locator('[data-testid="module-metal-droplet"]');
  if (!(await m.count())) { await p.locator('[data-testid="branch-manufactura"]').click(); await p.waitForTimeout(300); m = p.locator('[data-testid="module-metal-droplet"]'); }
  await m.click();
  await p.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
  await p.waitForTimeout(2500);
  const info = await p.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')].map(c => { const r = c.getBoundingClientRect(); return { w: c.width, h: c.height, x: Math.round(r.x), y: Math.round(r.y), rw: Math.round(r.width), rh: Math.round(r.height) }; });
    return { nCanvas: cs.length, canvases: cs, hasQlabel: document.body.innerText.includes('q(t)'), hasReson: document.body.innerText.includes('resonancia') };
  });
  console.log(JSON.stringify(info));
  if (errs.length) console.log('ERRS', errs.slice(0, 5));
  await b.close();
})();
