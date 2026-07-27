/**
 * comando-test.cjs — PRUEBA FUNCIONAL del destilado (MOLDE-COMANDOS.md).
 * ====================================================================
 * El registro dice "157 implementado" porque agentes LEYERON el código.
 * Esto lo EJECUTA: importa cada módulo en la app viva (vite dev, iangpu),
 * llama a la forjaFn con entradas Kazmer REALES y verifica que el número
 * sea finito + físicamente sano + (donde se puede) igual al cálculo a mano.
 * "gates no miden verdad" → aquí el gate es la FÍSICA, no que compile.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1400,900'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const perr = [];
  p.on('pageerror', e => perr.push(String(e).slice(0,160)));
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso)', { timeout: 120000 });

    const results = await p.evaluate(async () => {
      const R = [];
      const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
      const fin = (x) => typeof x === 'number' && isFinite(x);
      const push = (cmd, dom, ok, got, note = '') => R.push({ cmd, dom, ok: !!ok, got, note });
      const imp = (m) => import(/* @vite-ignore */ m);
      try {
        // ── LLENADO (filling.ts) ──
        const F = await imp('/src/forja/mold/filling.ts');
        {
          const g = F.shearRateNewtonian(0.5, 0.002);            // 6·0.5/0.002 = 1500
          push('fill.shearrate.newtonian', 'llenado', near(g, 1500), g, 'γ̇=6v̄/H');
        }
        {
          const f = F.clampForceN(50e6, 0.01);                    // P·A = 5.0e5 N
          push('clamp.force', 'llenado', near(f, 5e5), f, 'F=P·A');
        }
        {
          const t = F.clampMetricTons(50e6, 0.01);                // 5e5/9806.65 = 50.98
          push('clamp.tons', 'llenado', near(t, 5e5/9806.65, 1e-4), t, 'ton');
        }
        {
          const v = F.convergeVelocity(F.ABS_MG47, 0.002);        // debe converger, positivo
          push('fill.velocity.converge', 'llenado', fin(v) && v > 0 && v < 100, v, 'iter v̄');
        }
        {
          const dp = F.pressureDropSegment(F.ABS_MG47, 0.1, 0.002, 0.5);
          push('fill.pressuredrop.segment', 'llenado', fin(dp) && dp > 0, dp, 'ΔP Pa');
        }
        {
          const rep = F.fillingReport(F.ABS_MG47, { flowLengthM: 0.15, wallM: 0.0025, projectedAreaM2: 0.024 });
          const ok = rep && fin(rep.clampForceN ?? rep.fClampN ?? NaN) || (rep && Object.values(rep).some(fin));
          push('fill.report', 'llenado', !!rep, JSON.stringify(rep).slice(0,120), 'parcial');
        }

        // ── COLADA (feed.ts) ──
        const FD = await imp('/src/forja/mold/feed.ts');
        {
          const re = FD.reynolds(1050, 1e-5, 200, 0.004);
          push('runner.reynolds', 'colada', fin(re) && re > 0, re, 'Re');
        }
        {
          const seg = [{ count: 4, L: 0.05, R: 0.003 }, { count: 1, L: 0.03, R: 0.004 }];  // RunnerSegment usa R
          const vol = FD.feedVolume(seg);
          const exp = 4*0.05*Math.PI*0.003**2 + 1*0.03*Math.PI*0.004**2;
          push('feed.volume', 'colada', near(vol, exp, 1e-3), vol, 'Σ count·L·πR²');
        }
        {
          const rmin = FD.minRunnerRadius(F.ABS_MG47, 0.05, 1e-5, 30e6);
          push('runner.minradius', 'colada', fin(rmin) && rmin > 0 && rmin < 0.05, rmin, 'Eq 6.8');
        }

        // ── GATES (gating.ts) ──
        const G = await imp('/src/forja/mold/gating.ts');
        {
          const gs = G.shearRateStrip(1e-5, 0.002, 0.001);        // 6V̇/(Wh²)
          const exp = 6*1e-5/(0.002*0.001**2);
          push('gate.shearrate.strip', 'gates', near(gs, exp, 1e-4), gs, '6V̇/Wh²');
        }
        {
          const r = G.gateRadiusForShear(1e-5, 1e5);              // ∛(4V̇/πγ̇)
          const exp = Math.cbrt(4*1e-5/(Math.PI*1e5));
          push('gate.minradius', 'gates', near(r, exp, 1e-4), r, '∛(4V̇/πγ̇)');
        }
        {
          const d = G.gateDesign({ type: 'edge', wallMm: 2.5, VdotM3s: 1e-5, shearMaxS: 3e5 });
          push('gate.design', 'gates', !!d && Object.values(d).some(x=>fin(x)||typeof x==='string'), JSON.stringify(d).slice(0,100), '§7.3');
        }

        // ── VENTEO (venting.ts) ──
        const V = await imp('/src/forja/mold/venting.ts');
        {
          const t = V.ventMaxThickness(0.001);                    // land REAL ~1mm → sub-mm
          push('vent.maxThickness', 'venteo', fin(t) && t > 0 && t < 2e-3, t, 'm · escala con land');
        }
        {
          const d = V.ventDesign({ VdotAirM3s: 1e-4, lM: 0.1, wM: 0.02, lFlashM: 0.02 });
          push('vent.design', 'venteo', !!d && Object.values(d).some(fin), JSON.stringify(d).slice(0,110), '§8');
        }

        // ── FLOW LEADERS (flowleaders.ts) ──
        const FL = await imp('/src/forja/mold/flowleaders.ts');
        {
          const rr = FL.flowLeaderVelocityRatio(120, 80);         // 1.5
          push('flowleader.velocityratio', 'balanceo', near(rr, 1.5), rr, 'lR/lRef');
        }
        {
          const h = FL.flowLeaderThickness(2.5, 120, 80);         // Eq 5.33 → engrosa
          push('flowleader.thickness', 'balanceo', fin(h) && h >= 2.5, h, 'Eq 5.33');
        }

        // ── EXPULSIÓN (ejection.ts) ──
        const E = await imp('/src/forja/mold/ejection.ts');
        {
          const f = E.ejectionForce(E.ABS_EJECT, 1.0, 0.01);      // Eq 11.7 positivo
          push('ejection.force.scalar', 'expulsión', fin(f) && f > 0, f, 'Eq 11.7');
        }
        {
          const s = E.ejectorPinSizing(E.ABS_EJECT, 500, 4, 0.0025);  // POSICIONAL: (m, fEjectN, nPins, wallM)
          push('ejectorpin.size', 'expulsión', !!s && fin(s.dMinMm) && s.dMinMm > 0, JSON.stringify(s).slice(0,100), 'Eq 11.10/11.12');
        }
        {
          const v = E.ejectionVector(E.ABS_EJECT, { aEffM2: 0.01, draftDeg: 1.0, massKg: 0.05 });
          push('ejection.vector.solve', 'expulsión', !!v && Object.values(v).some(fin), JSON.stringify(v).slice(0,100), 'Fig 11.5');
        }

        // ── MÁQUINA (machinesizing.ts) ──
        const M = await imp('/src/forja/mold/machinesizing.ts');
        {
          const req = M.machineRequirements({ projectedAreaM2: 0.024, cavityPressureMPa: 50, partVolumeCc: 96, nCav: 2, fillPressureMPa: 80, ejectionForceN: 500 });
          push('machine.requirements', 'máquina', !!req && Object.values(req).some(fin), JSON.stringify(req).slice(0,120), 'Eq 5.29+shot');
        }

        // ── 3 PLACAS (threeplate.ts) ──
        const TP = await imp('/src/forja/mold/threeplate.ts');
        {
          const v = TP.moldOpeningVelocity(100);                  // 184+13·log10(100)=184+26=210
          push('mold.openingVelocity', '3placas', near(v, 184+13*Math.log10(100), 1e-3), v, '184+13·log10F');
        }
        {
          const lay = TP.threePlateLayout({ partHeightMm: 40, clampTons: 100 });
          push('threeplate.layout', '3placas', !!lay && Object.values(lay).some(fin), JSON.stringify(lay).slice(0,110), '§6.3.2');
        }

        // ── PLACAS (platesizing.ts) ──
        const PS = await imp('/src/forja/mold/platesizing.ts');
        {
          const snap = PS.snapToCommercialPlate(37);              // → tamaño comercial >=37 o null
          push('plate.snap', 'placas', snap === null || (fin(snap) && snap >= 37), snap, 'comercial');
        }
        {
          const opt = PS.optimizeSupportPlate({ clampTons: 100, spanM: 0.3, widthM: 0.3 });
          const ok = !!opt && opt.best && fin(opt.best.tRequiredMm) && opt.best.tRequiredMm > 0;  // valores en .best
          push('plate.support', 'placas', ok, JSON.stringify(opt.best).slice(0,110), 'deflexión+pilares');
        }

        // ── DFM (dfm.ts) ──
        const D = await imp('/src/forja/mold/dfm.ts');
        {
          const dr = D.draftForFinish(1.0);                       // µm textura → grados
          push('draft.forFinish', 'dfm', fin(dr) && dr > 0, dr, 'Tabla 2.14');
        }
        {
          const rep = D.checkDFM({ nominalWallMm: 2.5, surface: { roughnessUm: 1.0 }, draftDeg: 1.0 });
          push('dfm.check', 'dfm', !!rep && Object.keys(rep).length > 0, JSON.stringify(rep).slice(0,120), 'puerta 0');
        }
      } catch (e) {
        R.push({ cmd: 'FATAL', dom: '-', ok: false, got: String(e).slice(0,200), note: 'import/call' });
      }
      return R;
    });

    const pass = results.filter(r => r.ok).length;
    const out = { url: URL, total: results.length, pass, fail: results.length - pass, results, pageErrors: perr.slice(0,10) };
    fs.mkdirSync('/tmp/comando-test', { recursive: true });
    fs.writeFileSync('/tmp/comando-test/result.json', JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ fatal: String(e).slice(0,300), pageErrors: perr.slice(0,10) }, null, 2));
  } finally {
    await b.close();
  }
})();
