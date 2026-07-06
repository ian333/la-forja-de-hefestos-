/**
 * POC — ¿operar La Forja GENERA telemetría que LLEGA al servidor?
 * Maneja el Part Studio por comandos/clics con __TELEMETRY_URL apuntando al
 * servidor de telemetría; cuenta los POST que el cliente emite y luego se
 * verifica contra /health del servidor. NO programa la app — solo la opera.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const TELEMETRY_URL = process.env.TELEMETRY_URL || 'http://localhost:8002/events';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
           '--use-gl=angle', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  // Inyecta el endpoint ANTES de que cargue la app (hook que la app ya lee).
  await page.addInitScript((u) => { window.__TELEMETRY_URL = u; }, TELEMETRY_URL);

  const posted = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/events$/.test(r.url())) {
      try {
        const body = JSON.parse(r.postData() || '[]');
        const arr = Array.isArray(body) ? body : (body.events || []);
        posted.push(...arr.map((e) => e.type));
      } catch { /* beacon blob no parseable */ }
    }
  });

  const inv = () => page.evaluate('window.__forgeBrep.invariants');
  const api = (expr) => page.evaluate(expr);

  // 'load' (no 'networkidle'): con telemetría viva el cliente postea cada 2s,
  // así la red NUNCA queda ociosa y networkidle haría timeout.
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });

  // ── flujo: barreno → fillet → FEA → generativo (paths instrumentados) ──
  await page.click('[data-testid="btn-hole"]');
  await page.waitForFunction(`window.__forgeBrep.invariants.ops.includes('hole')`, { timeout: 20000 });

  await page.click('[data-testid="btn-fillet"]');
  await page.waitForSelector('[data-testid="edge-item-0"]', { timeout: 10000 });
  await page.click('[data-testid="edge-item-0"]');
  await page.waitForTimeout(800);

  // FEA: fija la cara inferior, carga la superior, resuelve.
  const faces = await api('window.__forgeBrep.listFaces()');
  let lo = -1, hi = -1, zlo = 1e9, zhi = -1e9;
  for (const f of faces) { if (f.kind === 'plane') { if (f.center[2] < zlo) { zlo = f.center[2]; lo = f.index; } if (f.center[2] > zhi) { zhi = f.center[2]; hi = f.index; } } }
  await api(`window.__forgeBrep.setFeaFixedFace(${lo})`);
  await api(`window.__forgeBrep.setFeaLoadFace(${hi})`);
  await api(`window.__forgeBrep.setFeaLoad(500)`);
  await api('window.__forgeBrep.runFEA && window.__forgeBrep.runFEA()');
  await page.waitForTimeout(4000);
  // warm-start (emite forja.fea_live)
  await api('window.__forgeBrep.feaLiveSetLoad && window.__forgeBrep.feaLiveSetLoad(800)');
  await page.waitForTimeout(2000);

  // Generativo (emite forja.generative)
  await api('window.__forgeBrep.setGenVolfrac && window.__forgeBrep.setGenVolfrac(0.4)');
  await api('window.__forgeBrep.runGenerative && window.__forgeBrep.runGenerative()');
  await page.waitForTimeout(8000);

  // fuerza un flush de telemetría (visibilitychange) + espera batch
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(3000);

  const tele = await page.evaluate(() => {
    const t = window.telemetry;
    return t ? { installed: !!t.installed, sid: t.sid } : null;
  }).catch(() => null);

  await page.close(); // sendBeacon final
  await browser.close();

  const counts = {};
  for (const t of posted) counts[t] = (counts[t] || 0) + 1;
  console.log('POC_TELEMETRY=' + JSON.stringify({
    telemetry_client: tele,
    posted_total: posted.length,
    posted_types: counts,
    forja_events: posted.filter((t) => /^forja\./.test(t)),
  }, null, 2));
})();
