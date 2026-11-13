#!/usr/bin/env node
/**
 * EL YUNQUE — BARRIDO de las piezas impresas (orden 2026-11-11-yunque-barrido-y-cierre).
 * El yunque se verificó sobre UNA pieza. Aquí, por CADA pieza impresa del laboratorio (las que traen su STEP):
 *   · un «unir» de 10 × 10 mm × 5 sobre su cara plana más grande (anclado en material: centroide de su triángulo mayor);
 *   · un «cortar» de 6 × 6 mm × 3 sobre la cara plana más grande de lo que quedó;
 *   · se quitan los dos y la pieza debe volver a su volumen de fábrica.
 * Por pieza: tiempo de forja (el primero incluye leer su STEP), deflexión de la malla, error del kernel si lo hay y ΔV.
 * ΔV con el volumen exacto del kernel. Esperado: unir 0 < ΔV ≤ 500 mm³ (menos de 500 solo si el saliente se encima con material de la propia pieza);
 * cortar 0 < −ΔV ≤ 108 mm³. Sin mouse: usa `__forgeBrep.yunque.caraMayor` / `golpear` / `limpiar`.
 *
 * Uso (iangpu, vite DEV vivo):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA node scripts/yunque-barrido.cjs [filtro]
 * Sale con 0 si todas pasan, 1 si alguna falla. Tabla en forja-shots/yunque/barrido.json.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5009/forja-brep.html';
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'forja-shots', 'yunque');
const FILTRO = process.argv[2] || process.env.FILTRO || '';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--window-size=1920,1080'],
  });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + String(e).slice(0, 240)));
  p.on('console', (m) => { if (m.type() === 'error' && !/telemetry|favicon|404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  const espera = (ms) => p.waitForTimeout(ms);
  const filas = [];
  let fallas = 0;
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso && document.querySelector("canvas"))', null, { timeout: 180000 });
    await p.click('[data-testid="doc-switcher"]');
    await p.click('[data-testid="ps-open-st-laboratorio"]');
    await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 200 && t.visibles === t.total; }, null, { timeout: 180000 });
    await espera(3000);
    const forjables = new Set(await p.evaluate(() => window.__forgeBrep.yunque.forjables()));
    const piezas = (await p.evaluate(() => window.__forgeBrep.refDrawn.map((r) => ({ key: r.key, name: r.name, tris: r.tris }))))
      .filter((r) => forjables.has(r.key) && (!FILTRO || r.key.includes(FILTRO)));
    console.log(`${piezas.length} piezas impresas`);
    // un golpe y esperar a que SU forja termine (la serie de esa pieza avanza)
    const golpe = async (key, modo, depth, lado) => {
      const cm = await p.evaluate((k) => window.__forgeBrep.yunque.caraMayor(k), key);
      if (!cm) return { error: 'sin cara plana' };
      const s0 = await p.evaluate((k) => (window.__forgeBrep.yunque.tiempos()[k] || { serie: 0 }).serie, key);
      const [ax, ay] = cm.ancla, h = lado / 2;
      const id = await p.evaluate((o) => window.__forgeBrep.yunque.golpear(o), { sobre: key, cara: cm.cara, modo, depth, rect: [ax - h, ay - h, ax + h, ay + h] });
      if (!id) return { error: 'golpear regresó null' };
      await p.waitForFunction(([k, s]) => { const y = window.__forgeBrep.yunque; const t = y.tiempos()[k]; return !y.forjando && t && t.serie > s; }, [key, s0], { timeout: 300000 });
      await espera(250);
      const r = await p.evaluate(([k, i]) => { const y = window.__forgeBrep.yunque; return { v: y.volumen(k), t: y.tiempos()[k], err: y.errores[i] || null, forjada: y.forjadas.includes(k) }; }, [key, id]);
      return { ...r, areaCara: cm.area };
    };
    for (const pz of piezas) {
      const fila = { key: pz.key.split('/').pop(), tris: pz.tris };
      try {
        const v0 = await p.evaluate((k) => window.__forgeBrep.yunque.volumen(k), pz.key);
        const u = await golpe(pz.key, 'unir', 5, 10);
        const c = u.error ? { error: 'no se intentó' } : await golpe(pz.key, 'cortar', 3, 6);
        await p.evaluate((k) => window.__forgeBrep.yunque.limpiar(k), pz.key);
        await p.waitForFunction((k) => { const y = window.__forgeBrep.yunque; return !y.forjando && !y.forjadas.includes(k); }, pz.key, { timeout: 120000 });
        await espera(200);
        const v3 = await p.evaluate((k) => window.__forgeBrep.yunque.volumen(k), pz.key);
        Object.assign(fila, {
          v0: Math.round(v0), cara_mm2: u.areaCara && Math.round(u.areaCara),
          // ΔV con el volumen EXACTO del kernel (el de la malla baila unos mm³ en piezas redondas al remallar)
          unir_ms: u.t && u.t.ms, unir_dv: u.t ? +(u.t.vol - u.t.volBase).toFixed(2) : null, unir_err: u.error || u.err,
          cortar_ms: c.t && c.t.ms, cortar_dv: c.t && u.t ? +(c.t.vol - u.t.vol).toFixed(2) : null, cortar_err: c.error || c.err,
          malla: c.t ? c.t.malla : u.t && u.t.malla, regresa: Math.abs(v3 - v0) < 1,
        });
        const okU = !fila.unir_err && fila.unir_dv > 0 && fila.unir_dv <= 500.01;
        const okC = !fila.cortar_err && fila.cortar_dv < 0 && -fila.cortar_dv <= 108.01;
        fila.pasa = okU && okC && fila.regresa;
      } catch (e) { fila.pasa = false; fila.excepcion = String(e).slice(0, 200); }
      if (!fila.pasa) fallas++;
      filas.push(fila);
      console.log(`${fila.pasa ? 'PASA ' : 'FALLA'} ${JSON.stringify(fila)}`);
    }
  } catch (e) {
    fallas++; console.log('EXCEPCIÓN ' + String(e).slice(0, 300));
  }
  if (errs.length) { console.log('errores de página: ' + JSON.stringify(errs.slice(0, 8))); }
  fs.writeFileSync(path.join(OUT, 'barrido.json'), JSON.stringify({ url: URL, filas, errs }, null, 1));
  console.log(`\nYUNQUE_BARRIDO: ${fallas || errs.length ? 'FALLA' : 'PASA'} (${filas.filter((f) => f.pasa).length}/${filas.length}) · ${path.join(OUT, 'barrido.json')}`);
  await b.close();
  process.exit(fallas || errs.length ? 1 : 0);
})();
