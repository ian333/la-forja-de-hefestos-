/**
 * La Forja — HERRAMIENTA DE ANÁLISIS multi-vista. Carga una pieza y la captura
 * desde TODOS los ángulos para analizarla: iso/planta/frontal/lateral + sección
 * + giro de 360° (turntable) + el mecanismo EN MOVIMIENTO. Usa el API de cámara
 * del Studio (setView / orbitTo / setSection / setGbMotion). GPU real.
 *
 * Reusable: cambia PART para analizar otra pieza.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/multivista';

// pieza a analizar: el reductor GENERADO (champion del GA), discos 3 por velocidad.
const PART = { kind: 'gearbox', gearbox: { lobes: 16, discs: 3, R: 21.4, Rr: 1.44, E: 0.39, T: 8.6, gap: 0.69, shaftD: 14.8, shaftBore: 7, outPins: 6, outPinD: 5 } };
const TURNTABLE_R = 95;

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const out = { shots: [], errs: [] };
  const shoot = async (name) => { const p = `${DIR}/${name}.png`; await page.screenshot({ path: p, timeout: 30000 }); out.shots.push(name); console.log(`✓ ${name}`); };
  const api = (fn, ...args) => page.evaluate(({ fn, args }) => window.__forgeBrep[fn] && window.__forgeBrep[fn](...args), { fn, args });
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', undefined, { timeout: 120000 });
    await page.evaluate((P) => window.__forgeBrep.setSketch(s => ({ ...s, kind: P.kind, gearbox: { ...s.gearbox, ...P.gearbox } })), PART);
    const st = await page.waitForFunction(() => {
      const fb = window.__forgeBrep; if (fb && fb.error) return { error: String(fb.error).slice(0, 200) };
      const iv = fb && fb.invariants; if (iv && iv.n_faces > 30) return { built: true, n_faces: iv.n_faces };
      return false;
    }, undefined, { timeout: 180000, polling: 1500 }).then(h => h.jsonValue()).catch(e => ({ timeout: String(e).slice(0, 120) }));
    out.buildState = st; console.log('build:', JSON.stringify(st));
    await page.waitForTimeout(1500);

    // 1) VISTAS ORTOGONALES + ISO
    for (const v of ['iso', 'top', 'front', 'right']) { await api('setView', v); await page.waitForTimeout(900); await shoot(`vista-${v}`); }

    // 2) SECCIÓN (corte Y) en iso
    await api('setView', 'iso'); await page.waitForTimeout(500);
    await api('setSection', true, 'y', 0); await page.waitForTimeout(1000); await shoot('vista-seccion');
    await api('setSection', false); await page.waitForTimeout(500);

    // 3) TURNTABLE 360° (giro)
    for (const az of [0, 45, 90, 135, 180, 225, 270, 315]) {
      await api('orbitTo', az, 22, TURNTABLE_R); await page.waitForTimeout(700);
      await shoot(`giro-${String(az).padStart(3, '0')}`);
    }

    // 4) EN MOVIMIENTO (el mecanismo trabajando: discos orbitando la leva)
    await api('setView', 'iso'); await page.waitForTimeout(400);
    if (await page.evaluate(() => !!window.__forgeBrep.setGbMotion)) {
      await api('setGbMotion', true);
      await page.waitForTimeout(1200); await shoot('movimiento-1');
      await page.waitForTimeout(1200); await shoot('movimiento-2');
      await api('setGbMotion', false);
    }

    out.pass = out.shots.length >= 13 && errs.length === 0;
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('MULTIVISTA=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
