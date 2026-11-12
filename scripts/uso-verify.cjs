#!/usr/bin/env node
/**
 * EL TALLER — arreglos de uso (orden 2026-11-11-taller-arreglos-de-uso): lo que BLOQUEABA según la auditoría del «usuario».
 *   A. la barra de estado dice la verdad del taller;
 *   B. las teclas del kernel (F, E, V, X, R, C, G, D, W, B, L, P) NO cambian el documento con el laboratorio abierto;
 *   C. Encuadrar / ISO / SUP / FRE / Sección prendidos; Encuadrar regresa el laboratorio al cuadro; aislar encuadra lo
 *      aislado; SUP mira desde arriba; Sección abre su control;
 *   D. dentro de un boceto del yunque, R y C son del boceto y no tocan el documento;
 *   E. al terminar el boceto NO se forja: se pide profundidad (10 seleccionado); Descartar no deja golpe; 5 + Enter forja
 *      UNA vez a 5 mm con el aviso «forjando» en pantalla; «pasante» sale como golpe pasante.
 *   F. (parte 2) Esc dentro del boceto conserva la cara agarrada; el doble clic en una cara chica no mete la cámara
 *      entre las piezas; mover una pieza lejos NO regresa la cámara a la vista de llegada.
 * Uso (iangpu, vite DEV vivo):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA node scripts/uso-verify.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5009/forja-brep.html';
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'forja-shots', 'uso');
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
  const estado = () => p.$eval('[data-testid="estado-texto"]', (e) => e.textContent).catch(() => null);
  const doc = () => p.evaluate(() => { const d = window.__forgeBrep.serializeDoc(); return JSON.stringify({ ops: d.ops, components: d.components, kind: d.sketch.kind, plane: d.sketch.plane, golpes: (d.golpes || []).length }); });
  const cam = async () => { const n = await p.evaluate(() => window.__forgeBrep.nav); const o = [0, 1, 2].map((i) => n.pos[i] - n.target[i]); const d = Math.hypot(...o); return { d, dir: o.map((v) => v / d), t: n.target }; };
  // caja (doc) → centro en coordenadas del visor y diagonal
  const cajaDe = async (keys) => {
    const cs = []; for (const k of keys) { const c = await p.evaluate((key) => window.__forgeBrep.mover.caja(key), k); if (c) cs.push(c); }
    const mn = [0, 1, 2].map((i) => Math.min(...cs.map((c) => c.min[i]))), mx = [0, 1, 2].map((i) => Math.max(...cs.map((c) => c.max[i])));
    const c = [0, 1, 2].map((i) => (mn[i] + mx[i]) / 2);
    return { centroVisor: [c[0], c[2], -c[1]], diag: Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) };
  };
  const lejos = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
  const aPx = (x, y) => p.evaluate(([mx, my]) => { const s = window.__sketchEditor; const q = s.toPx(mx, my); const r = s.svgRect(); return { x: r.left + q.px, y: r.top + q.py }; }, [x, y]);
  const clicMm = async (x, y) => { const q = await aPx(x, y); await p.mouse.move(q.x, q.y, { steps: 4 }); await p.mouse.click(q.x, q.y); await espera(280); };
  const tecla = async (t) => { await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await p.keyboard.press(t); await espera(220); };
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso && document.querySelector("canvas"))', null, { timeout: 180000 });
    const gl = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
    ok('GPU real (no SwiftShader/llvmpipe)', !/swiftshader|llvmpipe/i.test(gl), gl);
    await p.click('[data-testid="doc-switcher"]');
    await p.click('[data-testid="ps-open-st-laboratorio"]');
    await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 200 && t.visibles === t.total; }, null, { timeout: 180000 });
    await espera(3500);
    await p.evaluate(() => document.querySelector('.lj-x')?.click());

    // ── A. la barra de estado ──
    const e0 = await estado();
    ok('A. la barra de estado dice la verdad del taller', !!e0 && /^Taller · 226 cuerpos/.test(e0) && !/Lienzo vacío/.test(e0), e0);

    // ── B. las teclas del kernel no ensucian el documento ──
    const d0 = await doc();
    const malas = [];
    for (const k of ['f', 'e', 'v', 'x', 'r', 'c', 'g', 'd', 'w', 'b', 'l', 'p']) {
      await tecla(k);
      const e = await estado(), d = await doc();
      if (d !== d0 || /Error/.test(e || '') || !/^Taller ·/.test(e || '')) malas.push({ k, e: (e || '').slice(0, 60), cambio: d !== d0 });
      if (d !== d0) break;
    }
    ok('B. F, E, V, X, R, C, G, D, W, B, L, P con el laboratorio abierto: el documento no cambia y no hay «Error»', malas.length === 0, malas);
    await shot('01-teclas-sin-ensuciar.png');

    // ── C. vistas, encuadre y sección ──
    const botones = await p.evaluate(() => ['[data-testid="btn-fit"]', 'button[title="Vista isométrica"]', 'button[title="Vista superior"]', 'button[title="Vista frontal"]', '[data-testid="btn-section-tool"]'].map((s) => { const el = document.querySelector(s); return el ? !el.disabled : null; }));
    ok('C. Encuadrar, ISO, SUP, FRE y Sección están prendidos', botones.every((v) => v === true), botones);
    const vp = await p.$eval('.fb-viewport', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await p.mouse.move(vp.x + vp.w * 0.55, vp.y + vp.h * 0.5);
    for (let i = 0; i < 7; i++) { await p.mouse.wheel(0, 100); await espera(60); }
    await espera(900);
    const cLejos = await cam();
    const todo = await cajaDe(['lab-cuerpo', 'lab-placa', 'lab-alambre']);
    await p.click('[data-testid="btn-fit"]');
    await espera(1500);
    const cFit = await cam();
    ok('C. Encuadrar regresa el laboratorio al cuadro (blanco en su centro, a 1.7 diagonales)', lejos(cFit.t, todo.centroVisor) < 2 && Math.abs(cFit.d / (todo.diag * 1.7) - 1) < 0.03 && cLejos.d > cFit.d * 1.2,
      { antes_mm: Math.round(cLejos.d), despues_mm: Math.round(cFit.d), esperado_mm: Math.round(todo.diag * 1.7), blanco_a_mm_del_centro: +lejos(cFit.t, todo.centroVisor).toFixed(1) });
    await shot('02-encuadrado.png');
    await p.click('[data-testid="taller-aislar-lab-alambre"]');
    await espera(1600);
    const solo = await cajaDe(['lab-alambre']), cAis = await cam();
    ok('C. aislar encuadra lo aislado', lejos(cAis.t, solo.centroVisor) < 2 && Math.abs(cAis.d / (solo.diag * 1.7) - 1) < 0.03, { camara_mm: Math.round(cAis.d), esperado_mm: Math.round(solo.diag * 1.7) });
    await shot('03-aislado-y-encuadrado.png');
    await p.click('[data-testid="taller-desaislar"]');
    await espera(300);
    await p.click('button[title="Vista superior"]');
    await espera(1500);
    const cSup = await cam();
    ok('C. SUP mira desde arriba', cSup.dir[1] > 0.98, { hacia_arriba: +cSup.dir[1].toFixed(3) });
    await p.click('[data-testid="btn-section-tool"]');
    await espera(600);
    ok('C. Sección abre su control con el laboratorio', (await p.$('[data-testid="section-hud"]')) !== null);
    await shot('04-seccion.png');
    await p.click('[data-testid="btn-section-tool"]');
    await p.click('[data-testid="btn-fit"]');
    await espera(1500);

    // ── agarrar una cara plana de una pieza impresa (doble clic) ──
    const forjables = new Set(await p.evaluate(() => window.__forgeBrep.yunque.forjables()));
    const agarrarCara = async () => {
      for (let gy = 2; gy < 16; gy++) for (let gx = 6; gx < 28; gx++) {
        const x = vp.x + (vp.w * gx) / 30, y = vp.y + (vp.h * gy) / 18;
        await p.mouse.move(x, y);
        const h = await p.evaluate(() => window.__forgeBrep.taller.hover);
        if (!h || h.cara == null || !forjables.has(h.key)) continue;
        const c = await p.evaluate(([k, i]) => window.__forgeBrep.taller.cara(k, i), [h.key, h.cara]);
        if (!c || !c.plana || c.area < 3000) continue;
        await p.mouse.dblclick(x, y);
        await espera(1700);
        const yc = await p.evaluate(() => window.__forgeBrep.yunque.cara);
        if (yc && yc.plana && yc.forjable && yc.diag > 70) return yc.key;
        await p.keyboard.press('Escape');
      }
      return null;
    };
    const bocetar = async (modo) => {
      await p.click(`[data-testid="yunque-${modo}"]`);
      await p.waitForSelector('[data-testid="sketch-editor"]', { timeout: 20000 });
      await espera(1700);
      await p.click('[data-testid="sk-tool-rect"]');
      await clicMm(-8, -5); await clicMm(8, 5);
    };
    let key = await agarrarCara();
    if (!key) throw new Error('no se encontró una cara plana de una pieza impresa');

    // ── D. teclas dentro del boceto ──
    const dAntes = await doc();
    await bocetar('cortar');
    await tecla('c'); await tecla('r'); await tecla('f'); await tecla('e');
    ok('D. dentro del boceto, C, R, F y E no tocan el documento', (await doc()) === dAntes && !/Error/.test((await estado()) || ''), { estado: ((await estado()) || '').slice(0, 50) });
    await tecla('v');   // la herramienta Seleccionar del boceto

    // ── F1. Esc dentro del boceto es del boceto: la cara sigue agarrada ──
    await p.keyboard.press('Escape'); await espera(300);
    const trasEsc = await p.evaluate(() => ({ sel: window.__forgeBrep.taller.sel, boceto: !!document.querySelector('[data-testid="sketch-editor"]') }));
    ok('F. Esc dentro del boceto conserva la cara agarrada (y el boceto sigue abierto)', trasEsc.boceto && trasEsc.sel && trasEsc.sel.nivel === 'cara' && trasEsc.sel.key === key, trasEsc.sel && { key: trasEsc.sel.key.split('/').pop(), nivel: trasEsc.sel.nivel });

    // ── E. la profundidad se pide ANTES de forjar ──
    await p.click('[data-testid="sk-finish"]');
    await espera(1200);
    let caja = await p.evaluate(() => { const i = document.querySelector('[data-testid="yunque-prof"]'); const y = window.__forgeBrep.yunque; return { barra: !!document.querySelector('[data-testid="yunque-listo"]'), val: i && i.value, enfocada: !!i && document.activeElement === i, seleccionada: !!i && i.selectionStart === 0 && i.selectionEnd === i.value.length, golpes: y.golpes.length, forjando: y.forjando }; });
    ok('E. al terminar el boceto NO se forja: sale «profundidad» con 10 seleccionado', caja.barra && caja.val === '10' && caja.enfocada && caja.golpes === 0 && !caja.forjando, caja);
    await shot('05-profundidad-antes-de-forjar.png');
    await p.click('[data-testid="yunque-descartar"]');
    await espera(400);
    ok('E. «Descartar» no deja golpe', (await p.evaluate(() => window.__forgeBrep.yunque.golpes.length)) === 0 && !(await p.$('[data-testid="yunque-listo"]')));

    key = await agarrarCara();
    await bocetar('cortar');
    await p.click('[data-testid="sk-finish"]');
    await p.waitForSelector('[data-testid="yunque-prof"]', { timeout: 10000 });
    await espera(900);
    await p.keyboard.type('5');
    await p.keyboard.press('Enter');
    const vioAviso = await p.waitForSelector('[data-testid="yunque-forjando"]', { timeout: 8000 }).then(() => true).catch(() => false);
    await p.waitForFunction(() => { const y = window.__forgeBrep.yunque; return y.golpes.length === 1 && !y.forjando && y.forjadas.length === 1; }, null, { timeout: 240000 });
    await espera(500);
    let g = await p.evaluate(() => { const y = window.__forgeBrep.yunque, g0 = y.golpes[0]; const xs = g0.profile.map((q) => q.x), ys = g0.profile.map((q) => q.y); return { depth: g0.depth, pasante: !!g0.pasante, modo: g0.modo, area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)), t: y.tiempos()[g0.sobre], errores: y.errores }; });
    ok('E. teclear 5 + Enter forja UNA vez a 5 mm (quita a lo más área × 5) y el aviso «forjando» se vio', g.depth === 5 && !g.pasante && g.t && g.t.serie === 1 && g.t.volBase - g.t.vol > 0 && g.t.volBase - g.t.vol <= g.area * 5 + 0.01 && vioAviso,
      { profundidad: g.depth, forjas: g.t && g.t.serie, quito_mm3: g.t && +(g.t.volBase - g.t.vol).toFixed(1), tope_mm3: +(g.area * 5).toFixed(1), aviso: vioAviso, errores: g.errores });
    await shot('06-forjado-a-5.png');

    key = await agarrarCara();
    await bocetar('cortar');
    await p.click('[data-testid="sk-finish"]');
    await p.waitForSelector('[data-testid="yunque-pasante"]', { timeout: 10000 });
    await p.click('[data-testid="yunque-pasante"]');
    const apagada = await p.$eval('[data-testid="yunque-prof"]', (e) => e.disabled);
    await p.click('[data-testid="yunque-forjar"]');
    await p.waitForFunction(() => { const y = window.__forgeBrep.yunque; return y.golpes.length === 2 && !y.forjando; }, null, { timeout: 240000 });
    await espera(600);
    g = await p.evaluate(() => { const y = window.__forgeBrep.yunque; return { pasante: !!y.golpes[1].pasante, errores: y.errores }; });
    ok('E. «pasante» apaga la caja de profundidad y sale un golpe pasante', apagada && g.pasante, g);

    // ── F2. doble clic en una cara CHICA: la cámara no se mete entre las piezas ──
    await p.click('[data-testid="btn-fit"]'); await espera(1500);
    let chica = null;
    for (let gy = 2; gy < 16 && !chica; gy++) for (let gx = 6; gx < 28 && !chica; gx++) {
      const x = vp.x + (vp.w * gx) / 30, yy = vp.y + (vp.h * gy) / 18;
      await p.mouse.move(x, yy);
      const h = await p.evaluate(() => window.__forgeBrep.taller.hover);
      if (!h || h.cara == null) continue;
      const c = await p.evaluate(([k, i]) => window.__forgeBrep.taller.cara(k, i), [h.key, h.cara]);
      const cj = await p.evaluate((k) => window.__forgeBrep.mover.caja(k), h.key);
      if (!c || !c.plana || !cj) continue;
      const diagPieza = Math.hypot(cj.max[0] - cj.min[0], cj.max[1] - cj.min[1], cj.max[2] - cj.min[2]);
      if (c.area < 1500 && diagPieza > 180) chica = { x, y: yy, area: c.area, diagPieza, key: h.key };
    }
    if (chica) {
      await p.mouse.dblclick(chica.x, chica.y); await espera(1700);
      const cc = await cam();
      ok('F. doble clic en una cara chica de una pieza grande: la cámara queda a ≥ 0.75 del tamaño de la pieza', cc.d >= chica.diagPieza * 0.74, { cara_mm2: Math.round(chica.area), pieza_mm: Math.round(chica.diagPieza), camara_mm: Math.round(cc.d) });
      await shot('07-cara-chica-de-frente.png');
      await p.keyboard.press('Escape');
    } else ok('F. doble clic en una cara chica de una pieza grande: la cámara queda a ≥ 0.75 del tamaño de la pieza', false, 'no se halló una cara chica bajo el mouse');

    // ── F3. mover una pieza lejos no regresa la cámara a la vista de llegada ──
    await espera(1200);   // que la cámara termine de asentarse (amortiguación) antes de medirla
    const antesMov = await cam();
    await p.evaluate(() => window.__forgeBrep.mover.mover('lab-alambre', [600, 0, 0]));
    await espera(1800);
    const trasMov = await cam();
    const mismaDir = antesMov.dir[0] * trasMov.dir[0] + antesMov.dir[1] * trasMov.dir[1] + antesMov.dir[2] * trasMov.dir[2];
    ok('F. mover una pieza 600 mm NO regresa la cámara a la vista de llegada (mismo blanco, misma dirección, misma distancia)', lejos(antesMov.t, trasMov.t) < 0.5 && mismaDir > 0.99999 && Math.abs(antesMov.d - trasMov.d) < 0.5,
      { blanco_se_movio_mm: +lejos(antesMov.t, trasMov.t).toFixed(2), distancia_antes: +antesMov.d.toFixed(1), distancia_despues: +trasMov.d.toFixed(1), misma_direccion: +mismaDir.toFixed(6) });
    await p.evaluate(() => window.__forgeBrep.mover.mover('lab-alambre', [0, 0, 0]));
  } catch (e) {
    ok('sin excepción', false, String(e).slice(0, 300));
    await shot('99-falla.png').catch(() => {});
  }
  ok('sin errores de página', errs.length === 0, errs.slice(0, 6));
  fs.writeFileSync(path.join(OUT, 'uso-verify.json'), JSON.stringify({ url: URL, checks, errs }, null, 2));
  const fallas = checks.filter((c) => !c.pasa).length;
  console.log(`\nUSO_VERIFY: ${fallas ? 'FALLA' : 'PASA'} (${checks.length - fallas}/${checks.length}) · capturas en ${OUT}`);
  await b.close();
  process.exit(fallas ? 1 : 0);
})();
