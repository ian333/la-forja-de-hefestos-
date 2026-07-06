/** Verifica que la telemetría de La Forja se instale y POSTee eventos (incluye
 *  los timings forja.*) a /api/telemetry/events en la página del Part Studio. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage();
  const posts = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/telemetry\/events/.test(r.url())) {
      try {
        const body = JSON.parse(r.postData() || '[]');
        const arr = Array.isArray(body) ? body : (body.events || []);
        posts.push(arr.map((e) => e.type));
      } catch { posts.push(['<unparsed>']); }
    }
  });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
  // dispara un proceso instrumentado: generativo en una caja (mark forja.generative)
  try {
    await page.evaluate(() => window.__forgeBrep.setSketch((s) => ({ ...s, kind: 'rect', width: 24, height: 24 })));
    await page.waitForTimeout(500);
    const exId = await page.evaluate(() => (window.__forgeBrep.opsList.find((o) => o.type === 'extrude') || {}).id);
    await page.evaluate(({ id }) => window.__forgeBrep.updateOp(id, { depth: 40 }), { id: exId });
    await page.waitForTimeout(600);
    const faces = await page.evaluate(() => window.__forgeBrep.listFaces());
    const caps = faces.filter((f) => Math.abs(f.normal[2]) > 0.8).sort((a, b) => a.center[2] - b.center[2]);
    await page.evaluate(({ fix, load }) => { window.__forgeBrep.setFeaFixedFace(fix); window.__forgeBrep.setFeaLoadFace(load); window.__forgeBrep.setFeaLoad(1500); }, { fix: caps[0].index, load: caps[caps.length - 1].index });
    await page.evaluate(() => window.__forgeBrep.runGenerative([0, -1, 0]));
    await page.waitForFunction('window.__forgeBrep.genBusy === false', { timeout: 90000 });
  } catch (e) { console.log('trigger warn:', String(e).slice(0, 120)); }
  // lee también la cola interna del cliente (eventos vistos en esta sesión)
  const seen = await page.evaluate(() => {
    const t = window.telemetry; return t ? { installed: !!t.installed, sid: t.sid } : null;
  });
  await page.waitForTimeout(3000); // deja que el batch (2s) haga flush
  const allTypes = [...new Set(posts.flat())];
  const forjaTypes = allTypes.filter((t) => /^forja\./.test(t));
  console.log('TELEMETRY_PROBE=' + JSON.stringify({
    postsToEndpoint: posts.length,
    clientInstalled: !!seen,
    eventTypesSeen: allTypes,
    forjaTimings: forjaTypes,
    ok: posts.length > 0 && forjaTypes.length > 0,
  }, null, 2));
  await browser.close();
  process.exit(0);
})();
