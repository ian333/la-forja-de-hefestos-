/**
 * La Forja — REDUCTOR CICLOIDAL COMPLETO en 1 pieza (print-in-place).
 * Carga el gearbox (N discos fasados + eje + carcasa + pernos de salida, con las
 * holguras anti-fusión), lo renderiza ensamblado y EN SECCIÓN (para ver los
 * discos engranando por dentro). GPU real.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const out = { shots: [], errs: [] };
  const shoot = async (name) => { const p = `${DIR}/${name}.png`; await page.screenshot({ path: p, timeout: 30000 }); out.shots.push({ name, kb: Math.round(fs.statSync(p).size / 1024) }); console.log(`✓ ${name}.png`); };
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // OJO: con predicado string, el 2º arg es `arg`, NO options → options va 3º.
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', undefined, { timeout: 120000 });

    // Cargar el REDUCTOR CICLOIDAL completo (gearbox print-in-place). 3 discos
    // (como el banco-3discos conocido-bueno); el de 5 es un compound más pesado.
    await page.evaluate(() => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'gearbox', gearbox: { ...s.gearbox, discs: 3 } })));
    // Poll del BUILD (no del kernel ready, que ya es true): esperamos invariants
    // del compound (muchas caras) o un error. El build es OCCT pesado.
    const st = await page.waitForFunction(() => {
      const fb = window.__forgeBrep;
      if (fb && fb.error) return { error: String(fb.error).slice(0, 200) };
      const iv = fb && fb.invariants;
      if (iv && iv.n_faces && iv.n_faces > 30) return { built: true, n_faces: iv.n_faces, vol: iv.vol_kernel };
      return false;
    }, undefined, { timeout: 150000, polling: 1500 }).then(h => h.jsonValue()).catch((e) => ({ timeout: String(e).slice(0, 120) }));
    out.buildState = st;
    console.log('build:', JSON.stringify(st));
    await page.waitForTimeout(1500);

    await shoot('reductor-completo');

    // SECCIÓN (corte en Y al centro) → ver los discos engranando por dentro
    await page.evaluate(() => window.__forgeBrep.setSection(true, 'y', 0));
    await page.waitForTimeout(1000);
    await shoot('reductor-seccion');

    // otra sección (corte en Z, ver el apilado de discos)
    await page.evaluate(() => window.__forgeBrep.setSection(true, 'z', 0.1));
    await page.waitForTimeout(1000);
    await shoot('reductor-seccion-z');

    out.pass = out.shots.length === 3 && errs.length === 0;
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('REDUCTOR=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
