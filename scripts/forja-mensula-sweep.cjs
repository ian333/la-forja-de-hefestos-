/**
 * Exploración (vía UI): barre (legW, material, carga) sobre la ménsula L y
 * reporta convergencia + FS + von Mises, para elegir un caso de carga HONESTO y
 * SIGNIFICATIVO (FS en rango de decisión, solver convergido). Sólo clic/fill UI.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';

async function setRange(page, testid, value) {
  const sel = `[data-testid="${testid}"]`;
  await page.waitForSelector(sel, { timeout: 15000 });
  await page.$eval(sel, (el, v) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await page.waitForTimeout(120);
}
async function pickFeaFaces(page) {
  const faces = await page.evaluate(() => window.__forgeBrep.listFaces().map(f => ({
    index: f.index, kind: f.kind, center: f.center.map(v => +v.toFixed(2)),
    normal: f.normal.map(v => +v.toFixed(3)), area: +f.area.toFixed(1),
  })));
  const xPlanes = faces.filter(f => f.kind === 'plane' && Math.abs(f.normal[0]) > 0.8);
  const fixFace = xPlanes.slice().sort((a, b) => a.center[0] - b.center[0])[0];
  const yPlanes = faces.filter(f => f.kind === 'plane' && Math.abs(f.normal[1]) > 0.8);
  const yMin = Math.min(...yPlanes.map(f => f.center[1]));
  const loadFace = yPlanes.filter(f => f.center[1] > yMin + 1).sort((a, b) => b.area - a.area)[0];
  await page.click('[data-testid="btn-pick-fija"]'); await page.waitForTimeout(120);
  await page.click(`[data-testid="face-item-${fixFace.index}"]`); await page.waitForTimeout(150);
  await page.click('[data-testid="btn-pick-carga"]'); await page.waitForTimeout(120);
  await page.click(`[data-testid="face-item-${loadFace.index}"]`); await page.waitForTimeout(150);
  return { fix: fixFace.index, load: loadFace.index };
}
async function num(page, testid) {
  const t = await page.textContent(`[data-testid="${testid}"]`).catch(() => null);
  const m = (t || '').match(/-?\d+(\.\d+)?(e-?\d+)?/i);
  return m ? parseFloat(m[0]) : null;
}

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu',
      '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const out = { rows: [] };
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    // construir L-bracket base (sketch L + extrude40 + hole6 pasante)
    await page.click('[data-testid="feat-sketch"]'); await page.waitForTimeout(150);
    await page.click('[data-testid="seg-lprofile"]'); await page.waitForTimeout(250);
    await setRange(page, 'input-ancho', 80);
    await setRange(page, 'input-alto', 80);
    await page.waitForTimeout(300);
    await page.click('[data-testid="feat-extrude"]'); await page.waitForTimeout(150);
    await setRange(page, 'input-altura', 40); await page.waitForTimeout(400);
    await page.click('[data-testid="btn-hole"]'); await page.waitForTimeout(250);
    await setRange(page, 'input-diametro', 6);
    await setRange(page, 'input-pos-x', 20);
    await setRange(page, 'input-pos-y', -35);
    if ((await page.isChecked('[data-testid="chk-pasante"]')) === false) await page.click('[data-testid="chk-pasante"]');
    await page.waitForTimeout(400);
    await page.waitForFunction('window.__forgeBrep.ready', { timeout: 30000 });

    const configs = [
      { legW: 6, mat: 'pla', F: 300 },
      { legW: 6, mat: 'pla', F: 500 },
      { legW: 8, mat: 'pla', F: 500 },
      { legW: 10, mat: 'pla', F: 500 },
      { legW: 10, mat: 'steel', F: 1500 },
      { legW: 6, mat: 'steel', F: 1500 },
    ];
    for (const c of configs) {
      await page.click('[data-testid="feat-sketch"]'); await page.waitForTimeout(150);
      await setRange(page, 'input-pata', c.legW); await page.waitForTimeout(500);
      await page.waitForFunction('window.__forgeBrep.ready', { timeout: 30000 }).catch(() => {});
      await page.selectOption('[data-testid="select-material"]', c.mat).catch(() => {});
      await page.waitForTimeout(200);
      const bc = await pickFeaFaces(page);
      await setRange(page, 'input-carga', c.F); await page.waitForTimeout(150);
      await page.click('[data-testid="btn-fea"]');
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="fea-max-vm"]');
        return el && /\d/.test(el.textContent || '');
      }, { timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(400);
      const mesh = (await page.textContent('[data-testid="fea-mesh"]').catch(() => '') || '').trim();
      out.rows.push({
        ...c, bc,
        vm: await num(page, 'fea-max-vm'),
        fs: await num(page, 'fea-fs'),
        defl: await num(page, 'fea-deflexion'),
        mesh, converged: /✓/.test(mesh),
      });
      // limpiar overlay para el siguiente
      await page.click('[data-testid="btn-fea-clear"]').catch(() => {});
      await page.waitForTimeout(150);
    }
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 500);
  } finally {
    await browser.close();
  }
  console.log('SWEEP=' + JSON.stringify(out, null, 2));
  process.exit(0);
})();
