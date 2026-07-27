/** collision-test.cjs — corre el solver de colisiones (Fase 1) sobre el molde vivo. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1400,900'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldCollisions)', { timeout: 120000 });
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 5', { timeout: 60000 }).catch(()=>{});
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => window.__forgeBrep.moldCollisions(60));
    console.log('=== SOLVER DE COLISIONES @ 60°C ===');
    console.log('ok (sin colisiones reales):', r.ok, '| colisiones:', r.nCollisions, '| ambiguo(bbox→sólido):', r.nNeedsSolid, '| interfaces OK:', r.nExpected);
    if (r.collisions.length) { console.log('--- ✗ COLISIONES REALES (placa↔placa) ---'); r.collisions.forEach(c=>console.log('  ', c.a,'↔',c.b, JSON.stringify(c.overlapMm))); }
    if (r.needsSolidCheck.length) { console.log('--- ? NECESITAN CHECK DE SÓLIDO (Fase 1b) ---'); r.needsSolidCheck.forEach(c=>console.log('  ', c.a,'↔',c.b)); }
    console.log('--- fits térmicos (interfaces estándar) ---');
    for (const [k,v] of Object.entries(r.thermalFits))
      console.log(' ',k+':', v.rol, '| frío', v.clearanceColdMm, '→ caliente', v.clearanceHotMm, 'mm', v.binds?'⚠ AGARROTA':'✓');
  } catch (e) { console.log('FATAL:', String(e).slice(0,300)); }
  finally { await b.close(); }
})();
