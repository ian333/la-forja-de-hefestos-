/**
 * La Forja — VERIFICACIÓN CAPA POR CAPA del reductor cicloidal (como imprime la
 * máquina, de abajo hacia arriba). DOS métodos:
 *   A) CONSTRUCCIÓN (𝔄): vista iso, la pieza CRECIENDO capa por capa (sección Z
 *      que va revelando lo "ya impreso" hasta cada altura).
 *   B) VERIFICADOR: vista planta + mapa de imprimibilidad (verde anclado / rojo
 *      cuelga) en cada capa transversal → dónde haría falta soporte.
 * 160 capas × 2 = 320 imágenes. GPU real (iangpu).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/capas';
const CH = { lobes: 16, discs: 3, R: 21.4, Rr: 1.44, E: 0.39, T: 8.6, gap: 0.69, shaftD: 14.8, shaftBore: 7, outPins: 6, outPinD: 5 };
const N = 160;

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1500,1100'],
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const out = { a: 0, b: 0, errs: [] };
  const api = (fn, ...args) => page.evaluate(({ fn, args }) => { const fb = window.__forgeBrep; return fb && fb[fn] ? fb[fn](...args) : null; }, { fn, args });
  const shoot = async (name) => { try { await page.screenshot({ path: `${DIR}/${name}.png`, timeout: 20000 }); return true; } catch { return false; } };
  const pad = (i) => String(i).padStart(3, '0');
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', undefined, { timeout: 240000 });
    await page.evaluate((P) => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'gearbox', gearbox: { ...s.gearbox, ...P } })), CH);
    const st = await page.waitForFunction(() => {
      const fb = window.__forgeBrep; if (fb && fb.error) return { error: String(fb.error).slice(0, 200) };
      const iv = fb && fb.invariants; if (iv && iv.n_faces > 30) return { built: true, n_faces: iv.n_faces };
      return false;
    }, undefined, { timeout: 180000, polling: 1500 }).then(h => h.jsonValue()).catch(e => ({ timeout: String(e).slice(0, 120) }));
    out.buildState = st; console.log('build:', JSON.stringify(st));
    await page.waitForTimeout(1500);
    // tras setSketch el Studio RE-MONTA __forgeBrep (su useEffect se re-ejecuta) →
    // hay una ventana donde es undefined. Re-esperamos a que vuelva + esté ready.
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready === true', undefined, { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(600);

    const offAt = (i) => -0.98 + (1.96 * i) / (N - 1);   // −0.98 → +0.98

    // re-asegura __forgeBrep tras cualquier recarga (HMR del dev server)
    const ensure = async () => { try { await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready === true', undefined, { timeout: 60000 }); return true; } catch { return false; } };

    // ── MÉTODO A: construcción capa por capa (iso, la pieza creciendo) ──
    if (!process.env.ONLY_B) {
      await api('setView', 'iso'); await page.waitForTimeout(700);
      for (let i = 0; i < N; i++) {
        try { await api('setSection', true, 'z', offAt(i)); await page.waitForTimeout(180);
          if (await shoot(`A-construye-${pad(i)}`)) out.a++;
        } catch { await ensure(); await api('setView', 'iso'); }
        if (i % 20 === 0) console.log(`A ${i}/${N}`);
      }
      await api('setSection', false); await page.waitForTimeout(300);
    }

    // ── MÉTODO B: verificador de anclaje por capa (planta + overhang) ──
    await api('setShowOverhangs', true); await page.waitForTimeout(800);
    await api('setView', 'top'); await page.waitForTimeout(700);
    for (let i = 0; i < N; i++) {
      try { await api('setSection', true, 'z', offAt(i)); await page.waitForTimeout(180);
        if (await shoot(`B-verifica-${pad(i)}`)) out.b++;
      } catch { if (await ensure()) { await api('setShowOverhangs', true); await api('setView', 'top'); await page.waitForTimeout(500); } }
      if (i % 20 === 0) console.log(`B ${i}/${N}`);
    }

    out.pass = out.a + out.b >= 300 && errs.length === 0;
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 400); }
  finally { out.errs = errs.slice(0, 5); await browser.close(); }
  console.log('CAPAS=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
