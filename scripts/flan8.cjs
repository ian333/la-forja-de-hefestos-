/** flan8.cjs — config FINAL: flanera PP 8 cavidades, gate submarino corregido. */
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
      const D = 80, H = 40, wall = 1.2, nCav = 8;
      const projArea1 = Math.PI * (D / 2) ** 2;                 // mm² proyectada de UN vaso
      const volMm3 = (Math.PI * D * H + Math.PI * (D / 2) ** 2) * wall;
      const partVolCc = volMm3 / 1000;
      const projTotalM2 = (nCav * projArea1 * 1.12) * 1e-6;     // 8 cav + ~12% colada
      // clamp
      const clamp1 = F.run('clamp.tons', { pPa: 45e6, aM2: projArea1 * 1e-6 });
      const clamp8 = F.run('clamp.tons', { pPa: 45e6, aM2: projTotalM2 });
      const mach = F.run('machine.requirements', {
        projectedAreaM2: projTotalM2, cavityPressureMPa: 45, partVolumeCc: partVolCc,
        nCav, fillPressureMPa: 80, ejectionForceN: 4000,
      });
      // gate submarino: barrido de tiempo de llenado hasta que el corte quede < 100k
      const shearMax = 1e5;
      const scan = [0.8, 1.5, 2.0, 3.0].map((tFill) => {
        const Vdot = (volMm3 * 1e-9) / tFill;                   // por cavidad
        const rMin = F.run('gate.minradius', { VdotM3s: Vdot, shearMax });
        const g = F.run('gate.design', { type: 'tunnel', wallMm: wall, VdotM3s: Vdot, shearMaxS: shearMax });
        return { tFill, VdotCcS: +(Vdot * 1e6).toFixed(1), gateDiaMinMm: +(rMin * 2 * 1000).toFixed(2), designOk: g.ok, designShear: Math.round(g.shear) };
      });
      return { pieza: { D, H, wall, partVolCc: +partVolCc.toFixed(1), projArea1Mm2: Math.round(projArea1) },
        clamp1Ton: +clamp1.toFixed(1), clamp8Ton: +clamp8.toFixed(1), machineNeed: mach, gateScan: scan };
    });
    console.log(JSON.stringify(out, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0,300) }, null, 2)); }
  finally { await b.close(); }
})();
