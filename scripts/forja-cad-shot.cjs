/** Una toma de La Forja CAD tras clicar un botón (p.ej. ⊞ Caja). 1 navegador. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const CLICK = process.env.CLICK || '';
const OUT = process.env.OUT || '/tmp/cad-shot.png';
const WAIT = +(process.env.WAIT || 6000);
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 }).catch(() => {});
  for (const c of CLICK.split(',').filter(Boolean)) { await p.click(`[data-testid="${c}"]`).catch((e) => errs.push('click ' + c + ': ' + e.message.slice(0, 60))); await p.waitForTimeout(700); }
  if (process.env.SETRANGE) { // "idx:val" → mueve el N-ésimo input range (para verificar sliders)
    const [idx, val] = process.env.SETRANGE.split(':');
    await p.waitForTimeout(800);
    await p.evaluate((a) => { const r = document.querySelectorAll('input[type=range]')[+a.idx]; if (r) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(r, a.val); r.dispatchEvent(new Event('input', { bubbles: true })); } }, { idx, val }).catch(() => {});
  }
  await p.waitForTimeout(WAIT);
  const inv = await p.evaluate('window.__forgeBrep && window.__forgeBrep.invariants').catch(() => null);
  await p.screenshot({ path: OUT });
  console.log('shot', OUT, '· inv:', inv ? JSON.stringify({ vol: inv.vol_kernel, faces: inv.n_faces, mass: inv.mass_g }) : 'null', '· errs:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
  await b.close();
})();
