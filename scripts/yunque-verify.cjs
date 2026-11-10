#!/usr/bin/env node
/**
 * EL YUNQUE — verificación con navegador y GPU real (orden 2026-11-10-el-yunque).
 * Abre «LABORATORIO v2 · generado» y, con el mouse de verdad:
 *   A. una pieza de FÁBRICA solo ofrece «Cuerpo nuevo» (Unir/Cortar apagados);
 *   B. doble clic en una cara plana de una pieza IMPRESA → la cámara queda DE FRENTE y la cara agarrada;
 *   C. «Cuerpo nuevo» con un rectángulo → un cuerpo en el Taller con volumen = área × 10 mm;
 *   D. «Unir» → el volumen de la pieza SUBE área × 10; E. «Cortar» → BAJA (> 0, ≤ área × 10);
 *   F. cambiar la profundidad de un golpe rehace la pieza; G. borrar un golpe la regresa;
 *   H. guardar (serializeDoc) → abrir el laboratorio limpio (volumen original) → cargar lo guardado → vuelve forjada.
 * Uso (iangpu, vite DEV vivo):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA node scripts/yunque-verify.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5009/forja-brep.html';
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'forja-shots', 'yunque');
const checks = [];
const ok = (nombre, pasa, dato) => { checks.push({ nombre, pasa: !!pasa, dato }); console.log(`${pasa ? 'PASA' : 'FALLA'}  ${nombre}${dato !== undefined ? '  · ' + JSON.stringify(dato) : ''}`); };

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
  const shot = (n) => p.screenshot({ path: path.join(OUT, n), timeout: 30000 });
  const yq = () => p.evaluate(() => { const y = window.__forgeBrep.yunque; return { golpes: y.golpes.map((g) => ({ id: g.id, modo: g.modo, depth: g.depth, nombre: g.nombre, sobre: g.sobre })), forjando: y.forjando, errores: y.errores, forjadas: y.forjadas, cara: y.cara }; });
  const vol = (k) => p.evaluate((key) => window.__forgeBrep.yunque.volumen(key), k);
  const hover = () => p.evaluate(() => window.__forgeBrep.taller.hover);
  const abrirLab = async () => {
    await p.click('[data-testid="doc-switcher"]');
    await p.click('[data-testid="ps-open-st-laboratorio"]');
    await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 200 && t.visibles === t.total; }, null, { timeout: 180000 });
    await espera(3500);
    await p.evaluate(() => document.querySelector('.lj-x')?.click());   // el panel de los jueces tapa media pieza en las capturas
    await espera(300);
  };
  const forjado = async (n) => {   // espera a que haya n golpes y la forja termine
    await p.waitForFunction((k) => { const y = window.__forgeBrep.yunque; return y.golpes.length === k && !y.forjando; }, n, { timeout: 180000 });
    await espera(700);
    await p.waitForFunction(() => !window.__forgeBrep.yunque.forjando, null, { timeout: 180000 });
    await espera(300);
  };
  // dibuja un rectángulo en el boceto abierto (clic a clic, en mm del croquis) y regresa su área medida del perfil
  const rectangulo = async (x0, y0, x1, y1) => {
    await p.waitForSelector('[data-testid="sketch-editor"]', { timeout: 20000 });
    await espera(1600);   // la cámara vuela al plano de la cara
    await p.click('[data-testid="sk-tool-rect"]');
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      const pos = await p.evaluate(([mx, my]) => { const se = window.__sketchEditor; const q = se.toPx(mx, my); const r = se.svgRect(); return { x: r.left + q.px, y: r.top + q.py }; }, [x, y]);
      await p.mouse.move(pos.x, pos.y, { steps: 4 }); await p.mouse.click(pos.x, pos.y); await espera(250);
    }
    const prof = await p.evaluate(() => window.__sketchEditor.profile());
    let A = 0; for (let i = 0; i < prof.length; i++) { const a = prof[i], c = prof[(i + 1) % prof.length]; A += a.x * c.y - c.x * a.y; }
    return { area: Math.abs(A) / 2, n: prof.length };
  };
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso && document.querySelector("canvas"))', null, { timeout: 180000 });
    const gl = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
    ok('GPU real (no SwiftShader/llvmpipe)', !/swiftshader|llvmpipe/i.test(gl), gl);
    await abrirLab();

    // ── barrer el visor: qué caras planas hay bajo el mouse ──
    const vp = await p.$eval('.fb-viewport', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const hits = [];
    for (let gy = 1; gy < 18; gy++) for (let gx = 1; gx < 30; gx++) {
      const x = vp.x + (vp.w * gx) / 30, y = vp.y + (vp.h * gy) / 18;
      await p.mouse.move(x, y);
      const h = await hover();
      if (h && h.cara != null) hits.push({ x, y, ...h });
    }
    const info = [];
    for (const h of hits) {
      const c = await p.evaluate(([k, i]) => window.__forgeBrep.taller.cara(k, i), [h.key, h.cara]);
      if (c && c.plana) info.push({ ...h, ...c });
    }
    const impresa = (k) => /\/(cuerpo|alambre)-/.test(k);
    const fabrica = info.filter((h) => !impresa(h.key)).sort((a, c) => c.area - a.area)[0];
    const candidatas = info.filter((h) => impresa(h.key) && h.area > 3000).sort((a, c) => c.area - a.area).filter((h, i, xs) => xs.findIndex((q) => q.key === h.key && q.cara === h.cara) === i);
    ok('hay caras planas de piezas impresas y de fábrica bajo el mouse', !!fabrica && candidatas.length > 0, { impresas: candidatas.slice(0, 3).map((h) => `${h.nombre} · ${Math.round(h.area)} mm²`), fabrica: fabrica && fabrica.nombre });

    // ── A. pieza de fábrica: encadenada ──
    await p.mouse.click(fabrica.x, fabrica.y);
    await espera(400);
    const barraF = await p.evaluate(() => ({ barra: !!document.querySelector('[data-testid="yunque-bar"]'), nuevo: document.querySelector('[data-testid="yunque-nuevo"]')?.disabled, unir: document.querySelector('[data-testid="yunque-unir"]')?.disabled, cortar: document.querySelector('[data-testid="yunque-cortar"]')?.disabled, encadenada: !!document.querySelector('[data-testid="yunque-encadenada"]') }));
    ok('A. pieza de fábrica: solo «Cuerpo nuevo» (Unir y Cortar apagados)', barraF.barra && barraF.nuevo === false && barraF.unir === true && barraF.cortar === true && barraF.encadenada, barraF);
    await shot('01-fabrica-encadenada.png');
    await p.keyboard.press('Escape');
    await espera(200);

    // ── B. doble clic en una cara plana impresa → de frente ──
    // (se busca una cara cuyo CENTRO no quede tapado por otra pieza: ahí se va a bocetar tres veces)
    const cv = await p.$eval('.fb-viewport canvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    let blanco = null, y = null, ang = null, vistos = [];
    for (let i = 0; i < Math.min(8, candidatas.length) && !blanco; i++) {
      const c = candidatas[i];
      if (vistos.includes(`${c.key}#${c.cara}`)) continue;
      vistos.push(`${c.key}#${c.cara}`);
      if (i > 0) await abrirLab();
      await p.mouse.move(c.x, c.y);
      await p.mouse.dblclick(c.x, c.y);
      await espera(1700);
      y = await yq();
      const nav = await p.evaluate(() => window.__forgeBrep.nav);
      const pl = y.cara && y.cara.plano;
      if (!pl || y.cara.key !== c.key) continue;
      const u = pl.uDir, v = pl.vDir, n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const nw = [n[0], n[2], -n[1]], d = [nav.pos[0] - nav.target[0], nav.pos[1] - nav.target[1], nav.pos[2] - nav.target[2]], L = Math.hypot(...d);
      ang = (Math.acos(Math.min(1, (d[0] * nw[0] + d[1] * nw[1] + d[2] * nw[2]) / L)) * 180) / Math.PI;
      await p.mouse.move(cv.x + 4, cv.y + 4); await p.mouse.move(cv.x, cv.y); await espera(200);
      const h = await hover();
      const sel = await p.evaluate(() => window.__forgeBrep.taller.sel);
      // la cara que quedó agarrada manda (tras reabrir, el mismo pixel puede caer en otra cara de la misma pieza)
      if (h && h.key === c.key && sel && h.cara === sel.cara) { const ci = await p.evaluate(([k, i]) => window.__forgeBrep.taller.cara(k, i), [sel.key, sel.cara]); blanco = { ...c, cara: sel.cara, area: ci.area }; }
    }
    ok('B. doble clic: la cara queda agarrada, DE FRENTE (< 2°) y centrada bajo el mouse', !!blanco && y.cara.plana && ang !== null && ang < 2, { pieza: blanco && blanco.nombre, grados: ang !== null && +ang.toFixed(2), forjable: y && y.cara && y.cara.forjable, probadas: vistos.length });
    if (!blanco) throw new Error('ninguna cara impresa quedó con el centro libre');
    await shot('02-de-frente.png');
    const key = blanco.key;
    const v0 = await vol(key);
    // vuelve a agarrar la MISMA cara (después de forjar, los índices de cara cambian): barre el visor, da con un punto
    // de esa pieza sobre una cara plana que mire igual y mida parecido, y le da DOBLE CLIC (de frente + agarrada)
    const normal0 = (() => { const u = y.cara.plano.uDir, v = y.cara.plano.vDir; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; })();
    const agarrar = async () => {
      await p.keyboard.press('Escape');
      const vistos2 = new Set(); let log = [];
      for (let gy = 1; gy < 14; gy++) for (let gx = 1; gx < 22; gx++) {
        const x = vp.x + (vp.w * gx) / 22, yy0 = vp.y + (vp.h * gy) / 14;
        await p.mouse.move(x, yy0);
        const h = await hover();
        if (!h || h.key !== key || h.cara == null || vistos2.has(h.cara)) continue;
        vistos2.add(h.cara);
        const c = await p.evaluate(([k, i]) => window.__forgeBrep.taller.cara(k, i), [h.key, h.cara]);
        if (!c || !c.plana || Math.abs(c.area / blanco.area - 1) > 0.2) continue;
        await p.mouse.dblclick(x, yy0);
        await espera(1700);
        const q = await yq();
        if (!q.cara || q.cara.key !== key || !q.cara.plano) { await p.keyboard.press('Escape'); continue; }
        const u = q.cara.plano.uDir, v = q.cara.plano.vDir, n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const dot = n[0] * normal0[0] + n[1] * normal0[1] + n[2] * normal0[2];
        log.push({ cara: h.cara, area: Math.round(c.area), dot: +dot.toFixed(3) });
        if (dot > 0.999) return true;
        await p.keyboard.press('Escape');
        return agarrar2(log);
      }
      console.log('  agarrar: sin cara', JSON.stringify(log), [...vistos2].length);
      return false;
    };
    const agarrar2 = async (log) => { console.log('  agarrar: la cámara se movió a otra cara', JSON.stringify(log)); return false; };

    // ── C. cuerpo nuevo ──
    await p.click('[data-testid="yunque-nuevo"]');
    const rc = await rectangulo(-10, 18, 10, 30);
    await shot('03-boceto-en-la-cara.png');
    await p.click('[data-testid="sk-finish"]');
    await forjado(1);
    y = await yq();
    const g0 = y.golpes[0];
    const keyNuevo = key.slice(0, key.lastIndexOf('/') + 1) + g0.id;
    const vN = await vol(keyNuevo);
    const filaNuevo = await p.$(`[data-taller-key="${keyNuevo}"]`) !== null || (await p.evaluate(() => window.__forgeBrep.taller.total)) > 226;
    ok('C. «Cuerpo nuevo»: un cuerpo de área × 10 mm (±1 %) y aparece en el Taller', g0.modo === 'nuevo' && rc.n === 4 && vN && Math.abs(vN / (rc.area * 10) - 1) < 0.01 && filaNuevo && !Object.keys(y.errores).length,
      { area_mm2: +rc.area.toFixed(1), volumen_mm3: vN && Math.round(vN), esperado: Math.round(rc.area * 10), errores: y.errores });
    await shot('04-cuerpo-nuevo.png');

    // ── D. unir ──
    ok('D. se vuelve a agarrar la cara de la pieza', await agarrar());
    await p.click('[data-testid="yunque-unir"]');
    const ru = await rectangulo(18, -8, 34, 8);
    await p.click('[data-testid="sk-finish"]');
    await forjado(2);
    y = await yq();
    const v1 = await vol(key);
    ok('D. «Unir»: el volumen de la pieza SUBE área × 10 (±2 %)', y.forjadas.includes(key) && Math.abs((v1 - v0) / (ru.area * 10) - 1) < 0.02 && !Object.keys(y.errores).length,
      { antes: Math.round(v0), despues: Math.round(v1), subio: Math.round(v1 - v0), esperado: Math.round(ru.area * 10), errores: y.errores });
    await shot('05-unir.png');

    // ── E. cortar ──
    ok('E. se vuelve a agarrar la cara (ya forjada)', await agarrar());
    await p.click('[data-testid="yunque-cortar"]');
    const rk = await rectangulo(-34, -8, -18, 8);
    await p.click('[data-testid="sk-finish"]');
    await forjado(3);
    y = await yq();
    const v2 = await vol(key);
    ok('E. «Cortar»: el volumen BAJA (> 0 y ≤ área × 10)', v1 - v2 > 50 && v1 - v2 <= rk.area * 10 * 1.02 && !Object.keys(y.errores).length,
      { antes: Math.round(v1), despues: Math.round(v2), bajo: Math.round(v1 - v2), tope: Math.round(rk.area * 10), errores: y.errores });
    await shot('06-cortar.png');
    // a ojo: la pieza sola, con su saliente y su corte (sin el panel de los jueces encima)
    await p.evaluate((k) => document.querySelector(`[data-testid="taller-aislar-${k}"]`)?.click(), key);
    await espera(900);
    await shot('06b-pieza-aislada.png');
    await p.click('[data-testid="taller-desaislar"]').catch(() => {});
    await espera(400);
    const lista = await p.$$eval('[data-testid^="golpe-"][data-modo]', (els) => els.map((e) => e.dataset.modo));
    ok('LOS GOLPES lista los tres en orden', lista.join(',') === 'nuevo,unir,cortar', lista);

    // ── F. cambiar la profundidad del «unir» a 20 mm ──
    await p.fill('[data-testid="golpe-prof-1"]', '20');
    await p.keyboard.press('Enter');
    await espera(300);
    await forjado(3);
    const v3 = await vol(key);
    ok('F. profundidad 10 → 20 mm: la pieza sube otra área × 10 (±2 %)', Math.abs((v3 - v2) / (ru.area * 10) - 1) < 0.02, { subio: Math.round(v3 - v2), esperado: Math.round(ru.area * 10) });

    // ── G. borrar el corte ──
    await p.click('[data-testid="golpe-borrar-2"]');
    await forjado(2);
    const v4 = await vol(key);
    ok('G. borrar el corte regresa su material', Math.abs((v4 - v3) - (v1 - v2)) < Math.max(5, (v1 - v2) * 0.02), { regreso: Math.round(v4 - v3), habia_quitado: Math.round(v1 - v2) });
    await shot('07-golpes-editados.png');

    // ── H. guardar → laboratorio limpio → cargar ──
    const guardado = await p.evaluate(() => JSON.stringify(window.__forgeBrep.serializeDoc()));
    const nG = JSON.parse(guardado).golpes?.length;
    await abrirLab();
    y = await yq();
    const vLimpio = await vol(key);
    ok('H. el laboratorio recién abierto no trae golpes y la pieza mide lo de fábrica', y.golpes.length === 0 && Math.abs(vLimpio - v0) < 1, { golpes: y.golpes.length, volumen: Math.round(vLimpio), fabrica: Math.round(v0) });
    await p.evaluate((t) => window.__forgeBrep.loadDoc(JSON.parse(t)), guardado);
    await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 200; }, null, { timeout: 180000 });
    await forjado(2);
    await espera(2500);
    const vCargado = await vol(key), vNC = await vol(keyNuevo);
    ok('H. lo guardado trae sus 2 golpes y la pieza vuelve FORJADA', nG === 2 && Math.abs(vCargado - v4) < 1 && vNC && Math.abs(vNC - vN) < 1, { guardados: nG, volumen: Math.round(vCargado), esperado: Math.round(v4), cuerpo_nuevo: vNC && Math.round(vNC) });
    await shot('08-recargado.png');
  } catch (e) {
    ok('sin excepción', false, String(e).slice(0, 300));
    await shot('99-falla.png').catch(() => {});
  }
  ok('sin errores de página', errs.length === 0, errs.slice(0, 6));
  fs.writeFileSync(path.join(OUT, 'yunque-verify.json'), JSON.stringify({ url: URL, checks, errs }, null, 2));
  const fallas = checks.filter((c) => !c.pasa).length;
  console.log(`\nYUNQUE_VERIFY: ${fallas ? 'FALLA' : 'PASA'} (${checks.length - fallas}/${checks.length}) · capturas en ${OUT}`);
  await b.close();
  process.exit(fallas ? 1 : 0);
})();
