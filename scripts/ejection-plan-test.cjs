/** ejection-plan-test.cjs — el cerebro de auto-eyección: flanera vs Tupper. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1400,900'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forja && window.__forja.run)', { timeout: 120000 });
    const out = await p.evaluate(() => {
      const F = window.__forja;
      return {
        flanera: F.run('ejection.plan', { kind: 'cup', Lmm: 80, Wmm: 80, Hmm: 40, wallMm: 1.2, draftDeg: 5.71, round: true, material: 'PP' }),
        tupper:  F.run('ejection.plan', { kind: 'box', Lmm: 165, Wmm: 120, Hmm: 65, wallMm: 2.5, draftDeg: 1.0, material: 'ABS' }),
      };
    });
    for (const [name, plan] of Object.entries(out)) {
      console.log(`\n=== ${name.toUpperCase()} → ${plan.type.toUpperCase()} · ${plan.forceKN.toFixed(2)} kN ===`);
      plan.report.forEach(r => console.log('  ·', r));
    }
  } catch (e) { console.log('FATAL:', String(e).slice(0,300)); }
  finally { await b.close(); }
})();
