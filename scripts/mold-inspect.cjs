/**
 * mold-inspect.cjs — VER como el usuario: enciende la NUBE DE ALARMA (rojo = acero
 * compartido) y ORBITA el molde capturando muchos ángulos. Así dejo de estar ciego a
 * una sola foto. Uso:
 *   URL=<url> TESTID=<btn> OUT=<dir> ALARM=<0|1> R=<radio> node scripts/mold-inspect.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const TESTID = process.env.TESTID || 'btn-flanera';
const OUT = process.env.OUT || '/tmp/mold-inspect';
const ALARM = process.env.ALARM !== '0';
const R = +(process.env.R || 620);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl', '--disable-software-rasterizer', '--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  const out = {};
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldAlarm && window.__forgeBrep.orbitTo)', { timeout: 120000 });
    await p.waitForTimeout(1200);
    await p.click(`[data-testid="${TESTID}"]`).catch(() => {});
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 8', { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(3500);
    const PAIR = process.env.PAIR || '';   // "agua-b,inserto-core" → aísla ese par + nube entre ellos
    if (PAIR) { const [a, b] = PAIR.split(','); out.pair = await p.evaluate(([a, b]) => window.__forgeBrep.moldAlarmPair(a, b), [a, b]); await p.waitForTimeout(1600); }
    else if (ALARM) { out.alarm = await p.evaluate(() => window.__forgeBrep.moldAlarm()); await p.waitForTimeout(1600); }
    // órbita completa: az cada 45° a elevación media + cenital + nadir + picados
    const angles = [
      ['az000-el20', 0, 20], ['az045-el20', 45, 20], ['az090-el20', 90, 20], ['az135-el20', 135, 20],
      ['az180-el20', 180, 20], ['az225-el20', 225, 20], ['az270-el20', 270, 20], ['az315-el20', 315, 20],
      ['top-el85', 0, 85], ['bottom-el-85', 0, -85], ['az045-el55', 45, 55], ['az045-el-30', 45, -30],
    ];
    for (const [name, az, el] of angles) {
      await p.evaluate(([az, el, r]) => window.__forgeBrep.orbitTo(az, el, r), [az, el, R]);
      await p.waitForTimeout(850);
      await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 30000 });
    }
    out.captured = angles.map((a) => a[0]);
    out.pageErrors = errs.slice(0, 6);
    console.log(JSON.stringify(out, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0, 300), pageErrors: errs.slice(0, 6) }, null, 2)); }
  finally { await b.close(); }
})();
