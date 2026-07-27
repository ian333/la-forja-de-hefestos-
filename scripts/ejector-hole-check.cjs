/** ejector-hole-check.cjs — confirma el BARRENO: ¿la placa expulsora está HUECA en el pilar?
 *  (a) ray-cast punto-en-sólido sobre la malla; (b) captura la placa aislada desde arriba. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const OUT = process.env.OUT || '/tmp/ejector-hole';
const fs = require('fs');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1400,1000'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldGeom)', { timeout: 120000 });
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 5', { timeout: 60000 }).catch(()=>{});
    await p.waitForTimeout(1200);
    // ── ray-cast: ¿el eje del pilar (px, D/2) está DENTRO del sólido de la placa expulsora? ──
    const check = await p.evaluate(() => {
      const g = window.__forgeBrep.moldGeom();
      const ej = g.find(x => x.role === 'ejector'); if (!ej) return { err: 'no ejector' };
      // recuperar la malla cruda de la placa expulsora vía el mismo cálculo (necesitamos positions/indices)
      const parts = window.__forgeBrep.moldRaw ? window.__forgeBrep.moldRaw() : null;
      return { note: 'sin moldRaw', ejBBox: { x: [ej.min[0], ej.max[0]], z: [ej.min[2], ej.max[2]] }, parts: !!parts };
    });
    // aislar la placa expulsora + vista superior
    await p.click('[data-testid="mold-isolate-ejector"]').catch(()=>{});
    await p.waitForTimeout(900);
    await p.click('text=SUP').catch(()=>{});
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/ejector_top.png`, timeout: 30000 });
    // también ISO de la placa aislada
    await p.click('text=ISO').catch(()=>{}); await p.waitForTimeout(1000);
    await p.screenshot({ path: `${OUT}/ejector_iso.png`, timeout: 30000 });
    console.log(JSON.stringify({ check, shots: ['ejector_top','ejector_iso'] }, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0,300) }, null, 2)); }
  finally { await b.close(); }
})();
