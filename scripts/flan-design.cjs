/**
 * flan-design.cjs — DOGFOOD del bus: diseña el molde de flan con window.__forja.
 * Corre el orquestador + la compuerta submarina + la tecnología para una flanera
 * individual de PP y devuelve números REALES (cavidades, clamp, precio, gate).
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';

(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1400,900'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forja && window.__forja.run)', { timeout: 120000 });
    const out = await p.evaluate(() => {
      const F = window.__forja;
      // Flanera individual redonda: Ø80 × 40 alto, pared 1.2 mm, PP, vendemos MUCHO.
      const D = 80, H = 40, wall = 1.2;
      const surfMm2 = Math.PI * D * H + Math.PI * (D / 2) ** 2;    // lateral + fondo
      const volMm3 = surfMm2 * wall;                               // material de UNA pieza
      const partVolCc = volMm3 / 1000;
      // caudal para la compuerta: llenar la pieza en ~0.8 s
      const VdotM3s = (volMm3 * 1e-9) / 0.8;
      const machine = F.run('mold.machine', {
        name: 'flanera PP', Lmm: D, Wmm: D, Hmm: H, cavityShape: 'round',
        surfaceMm2: Math.round(surfMm2), volumeMm3: Math.round(volMm3), wallMm: wall,
        annualVolume: 500000, plastic: 'PP', finish: 'SPI B-3',
      });
      const tunnel = F.run('gate.types', { type: 'tunnel' });
      const gate = F.run('gate.design', { type: 'tunnel', wallMm: wall, VdotM3s, shearMaxS: 1e5 });
      const tech = F.run('tech.choose', {});                       // sin undercuts (cup abierto)
      const clampTons = F.run('clamp.tons', { pPa: 45e6, aM2: Math.PI * (D / 2) ** 2 * 1e-6 });  // 1 cav
      return {
        pieza: { D, H, wall, surfMm2: Math.round(surfMm2), partVolCc: +partVolCc.toFixed(2), VdotM3s },
        veredicto: machine && machine.veredicto,
        recomendacion: machine && machine.recomendacion,
        tunnelProps: tunnel,
        gate,
        tech,
        clampTons1cav: clampTons,
      };
    });
    console.log(JSON.stringify(out, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0,300) }, null, 2)); }
  finally { await b.close(); }
})();
