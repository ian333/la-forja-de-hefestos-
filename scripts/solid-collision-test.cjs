/** solid-collision-test.cjs — Fase 1b: colisiones REALES por intersección de sólidos. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1400,900'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldSolidCollisions)', { timeout: 120000 });
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 5', { timeout: 60000 }).catch(()=>{});
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => window.__forgeBrep.moldSolidCollisions(4));
    console.log('=== COLISIONES REALES (intersección de sólidos) ===');
    console.log('nColisiones:', r.nCollisions);
    r.collisions.forEach(c => console.log(`  ✗ ${c.a} ↔ ${c.b}  (${c.pointsInside} puntos dentro / ${c.samples} muestras)`));
    if (r.nCollisions === 0) console.log('  ✓ ninguna intersección de sólidos');
  } catch (e) { console.log('FATAL:', String(e).slice(0,300)); }
  finally { await b.close(); }
})();
