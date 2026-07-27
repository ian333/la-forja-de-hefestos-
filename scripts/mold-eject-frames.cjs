/**
 * mold-eject-frames.cjs — captura DETERMINISTA del ciclo de apertura+EXPULSIÓN
 * del molde (stripper o pines) usando __moldOpen(frac, eFrac).
 * Emula las mismas fases del MoldOpenDriver (abre → eyecta → retrae → cierra)
 * para que el video sea el ciclo real, cuadro a cuadro reproducible.
 *
 * Uso (iangpu, GPU):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   URL=http://localhost:5179/forja-brep.html TESTID=btn-flanera N=120 \
 *   OUT=/tmp/mold-eject node /home/ian/Orkesta/la-forja/scripts/mold-eject-frames.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5179/forja-brep.html';
const TESTID = process.env.TESTID || 'btn-flanera';
const OUT = process.env.OUT || '/tmp/mold-eject';
const N = Number(process.env.N || 120);
const VIEW = process.env.VIEW || 'ISO';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--disable-software-rasterizer','--window-size=1920,1080'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldSolidCollisions)', { timeout: 180000 });
    await p.waitForTimeout(1500);
    console.log('kernel ON — click', TESTID, '(el build tarda 1-2 min, paciencia)');
    await p.click(`[data-testid="${TESTID}"]`);
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 8', { timeout: 300000 });
    await p.waitForTimeout(3000);
    const roles = await p.evaluate(() => window.__forgeBrep.moldGeom().map(g => g.role));
    console.log('molde listo:', roles.length, 'partes:', roles.join(','));
    await p.click(`text=${VIEW}`).catch(() => {});
    await p.waitForTimeout(1200);
    // El CICLO del driver, calcado (8 s virtuales): abre → EYECTA → retrae → cierra
    const smooth = (x) => x * x * (3 - 2 * x);
    for (let i = 0; i < N; i++) {
      const cyc = i / (N - 1);
      let frac = cyc < 0.3 ? cyc / 0.3 : cyc < 0.72 ? 1 : 1 - (cyc - 0.72) / 0.28;
      let eFrac = cyc < 0.34 ? 0 : cyc < 0.48 ? (cyc - 0.34) / 0.14 : cyc < 0.58 ? 1
        : cyc < 0.7 ? 1 - (cyc - 0.58) / 0.12 : 0;
      frac = smooth(frac); eFrac = smooth(eFrac);
      await p.evaluate(([f, e]) => window.__moldOpen(f, e), [frac, eFrac]);
      await p.waitForTimeout(120);
      await p.screenshot({ path: `${OUT}/f${String(i).padStart(4, '0')}.png`, timeout: 30000 });
      if (i % 20 === 0) console.log(`frame ${i}/${N} frac=${frac.toFixed(2)} eject=${eFrac.toFixed(2)}`);
    }
    // Cuadros CLAVE aparte para revisión 1:1 (cerrado / abierto / expulsión total)
    for (const [name, f, e] of [['closed', 0, 0], ['open', 1, 0], ['eject-mid', 1, 0.5], ['eject-full', 1, 1]]) {
      await p.evaluate(([ff, ee]) => window.__moldOpen(ff, ee), [f, e]);
      await p.waitForTimeout(250);
      await p.screenshot({ path: `${OUT}/key-${name}.png`, timeout: 30000 });
    }
    await p.evaluate(() => window.__moldOpen(null));
    console.log('OK frames en', OUT, errs.length ? `· pageerrors: ${errs.join(' | ')}` : '· 0 errores');
  } catch (e) { console.log('FATAL', String(e).slice(0, 300)); process.exitCode = 1; }
  finally { await b.close(); }
})();
