/**
 * bus-test.cjs — prueba el DISPATCHER real `window.__forja.run('dominio.verbo', {…})`.
 * Verifica que invocar POR EL BUS da los mismos números Kazmer que la llamada directa,
 * y que el catálogo (list/stats) es descubrible por un agente.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1400,900'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const perr = []; p.on('pageerror', e => perr.push(String(e).slice(0,160)));
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forja && window.__forja.run)', { timeout: 120000 });
    // Espera a que el KERNEL OCCT termine de bootear (los comandos needsOc lo requieren):
    // sondea variant.analyze hasta que deje de lanzar el error de 'requiere OCCT'.
    await p.waitForFunction(() => {
      try { window.__forja.run('variant.analyze', { Lmm: 10, Wmm: 10, Hmm: 10, wallMm: 1, flowLenMm: 10, projAreaMm2: 100, annualVolume: 1000 }); return true; }
      catch (e) { return !String(e).includes('requiere OCCT'); }
    }, { timeout: 90000 });

    const out = await p.evaluate(() => {
      const F = window.__forja;
      const near = (a, b, tol = 1e-6) => typeof a === 'number' && isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
      const R = [];
      const chk = (id, params, pred, note) => {
        try { const got = F.run(id, params); R.push({ id, ok: !!pred(got), got: typeof got === 'object' ? JSON.stringify(got).slice(0,90) : got, note }); }
        catch (e) { R.push({ id, ok: false, got: 'THREW: ' + String(e).slice(0,90), note }); }
      };
      // mismos checks exactos que comando-test, pero POR EL BUS:
      chk('fill.shearrate.newtonian', { vMean: 0.5, hMeters: 0.002 }, g => near(g, 1500), '6v̄/H');
      chk('clamp.force', { pCavityPa: 50e6, aProjectedM2: 0.01 }, g => near(g, 5e5), 'P·A');
      chk('clamp.tons', { pPa: 50e6, aM2: 0.01 }, g => near(g, 5e5/9806.65, 1e-4), 'ton');
      chk('gate.shearrate.strip', { VdotM3s: 1e-5, wM: 0.002, hM: 0.001 }, g => near(g, 30000, 1e-6), '6V̇/Wh²');
      chk('gate.minradius', { VdotM3s: 1e-5, shearMax: 1e5 }, g => near(g, Math.cbrt(4e-5/(Math.PI*1e5)), 1e-4), '∛');
      chk('mold.openingVelocity', { clampTons: 100 }, g => near(g, 210, 1e-6), '184+13log');
      chk('feed.volume', { segments: [{count:4,L:0.05,R:0.003},{count:1,L:0.03,R:0.004}] },
          g => near(g, 4*0.05*Math.PI*9e-6 + 0.03*Math.PI*1.6e-5, 1e-3), 'ΣcountLπR²');
      chk('flowleader.velocityratio', { lRegionMm: 120, lRefMm: 80 }, g => near(g, 1.5), 'lR/lRef');
      chk('ejection.force.scalar', { draftDeg: 1.0, aEffM2: 0.01 }, g => typeof g==='number' && g>0, 'Eq11.7 (ABS default)');
      chk('ejectorpin.size', { fEjectN: 500, nPins: 4, wallM: 0.0025 }, g => g && g.dMinMm>0, 'Ø mín');
      chk('machine.requirements', { projectedAreaM2:0.024, cavityPressureMPa:50, partVolumeCc:96, nCav:2, fillPressureMPa:80, ejectionForceN:500 },
          g => g && g.clampNeedTons>0, 'clamp+shot');
      chk('gate.design', { type:'edge', wallMm:2.5, VdotM3s:1e-5, shearMaxS:3e5 }, g => g && g.ok!==undefined, '§7.3');
      chk('vent.design', { VdotAirM3s:1e-4, lM:0.1, wM:0.02, lFlashM:0.001 }, g => g && g.feasible!==undefined, '§8');
      chk('plate.support', { clampTons:100, spanM:0.3, widthM:0.3 }, g => g && g.best && g.best.tRequiredMm>0, 'deflexión');
      chk('dfm.check', { nominalWallMm:2.5, surface:{roughnessUm:1.0}, draftDeg:1.0 }, g => g && typeof g.score==='number', 'puerta 0');
      // ── v2: orquestador + tecnología + DFM malla + geometría (needsOc) ──
      chk('mold.machine', { name: 'vaso', Lmm: 120, Wmm: 80, Hmm: 40, surfaceMm2: 24000, volumeMm3: 96000, wallMm: 2.5, annualVolume: 250000, plastic: 'ABS' },
          g => g && g.veredicto && g.veredicto.precioMoldeUSD > 0, 'spec→molde+precio');
      chk('tech.choose', { internalThread: true }, g => g && g.tech, '§12 tecnología');
      const box = ((w, d, h) => {
        const V = [[0,0,0],[w,0,0],[w,d,0],[0,d,0],[0,0,h],[w,0,h],[w,d,h],[0,d,h]];
        const positions = []; V.forEach(p => positions.push(...p));
        const F = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
        const indices = []; F.forEach(t => indices.push(...t));
        return { positions, indices };
      })(40, 30, 20);
      chk('dfm.fromMesh', { mesh: box, wallMm: 2.5 }, g => g && typeof g === 'object', 'malla→veredicto');
      chk('part.pickDrawAxis', { mesh: box, wallMm: 2.5 }, g => g && typeof g === 'object', 'eje de desmoldeo');
      chk('factory.generate', { Lmm: 120, Wmm: 80, Hmm: 40, wallMm: 2.5, flowLenMm: 150, projAreaMm2: 9600, annualVolume: 250000 },
          g => g && g.best, 'needsOc: barre variantes (arma caja con oc)');

      // errores esperados: comando desconocido + hueso
      chk('noexiste.verbo', {}, () => false, 'debe LANZAR');
      // introspección para agentes
      const stats = F.stats();
      const sample = F.list({ domain: 'gates' }).map(c => c.id);
      const desc = F.describe('clamp.force');
      return { R, stats, gatesDomain: sample, describeClampForce: desc };
    });

    const pass = out.R.filter(r => r.ok).length;
    const expectThrow = out.R.find(r => r.id === 'noexiste.verbo');
    const result = {
      url: URL,
      total: out.R.length, pass, fail: out.R.length - pass,
      unknownCmdThrew: expectThrow ? String(expectThrow.got).startsWith('THREW') : null,
      stats: out.stats, gatesDomain: out.gatesDomain, describeClampForce: out.describeClampForce,
      results: out.R, pageErrors: perr.slice(0,8),
    };
    fs.mkdirSync('/tmp/bus-test', { recursive: true });
    fs.writeFileSync('/tmp/bus-test/result.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ fatal: String(e).slice(0,300), pageErrors: perr.slice(0,8) }, null, 2));
  } finally { await b.close(); }
})();
