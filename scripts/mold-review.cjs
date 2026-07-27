/** mold-review.cjs — revisión CRÍTICA del molde: varios ángulos + sección (ver placas adentro). */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const OUT = process.env.OUT || '/tmp/mold-review';
const fs = require('fs');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--disable-software-rasterizer','--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0,140)));
  const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png`, timeout: 30000 });
  const out = { shots: [] };
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && document.querySelector("canvas"))', { timeout: 120000 });
    await p.waitForTimeout(3500);   // deja cargar el molde (Tupper)
    out.moldParts = await p.evaluate(() => document.querySelectorAll('[data-testid^="mold-part-"]').length);
    // ISO
    await p.click('text=ISO').catch(()=>{}); await p.waitForTimeout(1200); await shot('1_iso'); out.shots.push('1_iso');
    // FRONT (aquí se ve el apilado de placas)
    await p.click('text=FRE').catch(()=>{}); await p.waitForTimeout(1200); await shot('2_front'); out.shots.push('2_front');
    // TOP
    await p.click('text=SUP').catch(()=>{}); await p.waitForTimeout(1200); await shot('3_top'); out.shots.push('3_top');
    // SECCIÓN encendida (frontal) → ver placas por dentro + traslapes
    await p.click('text=FRE').catch(()=>{}); await p.waitForTimeout(800);
    await p.click('[data-testid="btn-section-tool"]').catch(async()=>{ await p.click('[data-testid="btn-section-inspect"]').catch(()=>{}); });
    await p.waitForTimeout(1600); await shot('4_section_front'); out.shots.push('4_section_front');
    // sección en ISO
    await p.click('text=ISO').catch(()=>{}); await p.waitForTimeout(1200); await shot('5_section_iso'); out.shots.push('5_section_iso');
    out.errs = errs.slice(0,8);
    console.log(JSON.stringify(out, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0,300), errs: errs.slice(0,8) }, null, 2)); }
  finally { await b.close(); }
})();
