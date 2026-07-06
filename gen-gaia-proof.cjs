const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const W = 3840, H = 2160;
  const Z = parseInt(process.argv[2] || '8', 10);
  const exe = fs.existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined;
  const browser = await chromium.launch({
    headless: false, executablePath: exe,
    args: ['--no-sandbox','--disable-setuid-sandbox','--headless=new','--ignore-gpu-blocklist',
      '--enable-gpu','--enable-gpu-rasterization','--enable-webgl','--disable-software-rasterizer',
      `--window-size=${W},${H}`],
  });
  const ctx = await browser.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:1, bypassCSP:true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type()==='error') console.log('  chrome:', m.text().slice(0,140)); });
  await page.addInitScript(() => { window.__GAIA_BRAND = 1; });
  await page.goto(`http://localhost:5001/cinematic-atom.html?z=${Z}`, { waitUntil:'networkidle', timeout:60000 });
  // esperar a que el motor exponga renderAt
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.renderAt, null, { timeout: 40000 });
  // verificar GPU (no swiftshader)
  const gl = await page.evaluate(() => { try { const c=document.createElement('canvas'); const g=c.getContext('webgl2')||c.getContext('webgl'); const e=g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e.UNMASKED_RENDERER_WEBGL);}catch(e){return 'n/a';} });
  console.log('WEBGL RENDERER:', gl);
  for (const t of [3, 7, 11]) {
    await page.evaluate(tt => window.__cinematicAtom.renderAt(tt), t);
    await page.waitForTimeout(120);
    await page.screenshot({ path: `/tmp/gaia_atom_t${t}.png` });
    console.log('frame t=' + t + ' OK');
  }
  await browser.close();
  console.log('PROOF DONE');
})();
