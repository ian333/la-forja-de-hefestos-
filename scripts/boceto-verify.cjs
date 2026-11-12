#!/usr/bin/env node
/**
 * EL BOCETO — acotar sin pelearse (orden 2026-11-11-boceto-acotar). Con el mouse y el teclado de verdad, sobre un boceto
 * del yunque en «LABORATORIO v2 · generado»:
 *   A. el boceto dice el modo y la pieza;  B. el rectángulo se ve (con su ancho × alto) entre el primer y el segundo clic;
 *   C. Cota + clic en un LADO → caja con su largo SELECCIONADO → teclear 20, Enter → mide 20.00; el otro lado a 12;
 *   D. volver a acotar el mismo lado lo CAMBIA (una sola cota, sin conflicto) y el botón ✕ la quita;
 *   E. clic en un lado y luego en el contiguo → la caja pasa a ser la del ÁNGULO (90°);
 *   F. Ctrl+Z dentro del boceto quita el último trazo y NO toca los golpes del documento;
 *   G. al terminar, el golpe sale de 20.00 × 12.00;
 *   R. (orden 2026-11-11-boceto-contorno-de-la-cara) el contorno de la cara entra como REFERENCIA fija: mide lo que la cara,
 *      no se arrastra ni se acota, y una cota ↔ / ↕ contra uno de sus vértices coloca el rectángulo a 12 y 8 mm exactos.
 * Uso (iangpu, vite DEV vivo):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA node scripts/boceto-verify.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5009/forja-brep.html';
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'forja-shots', 'boceto');
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
  const se = () => p.evaluate(() => { const s = window.__sketchEditor; return { pts: s.points(), lines: s.lines(), nLines: s.nLines, nCircles: s.nCircles, nCotas: s.nCotas, dim: s.dim, status: s.status, dof: s.dof, deshacer: s.deshacer, nRef: s.nRef, nRefPts: s.nRefPts }; });
  const aPx = (x, y) => p.evaluate(([mx, my]) => { const s = window.__sketchEditor; const q = s.toPx(mx, my); const r = s.svgRect(); return { x: r.left + q.px, y: r.top + q.py }; }, [x, y]);
  const clicMm = async (x, y) => { const q = await aPx(x, y); await p.mouse.move(q.x, q.y, { steps: 4 }); await p.mouse.click(q.x, q.y); await espera(280); };
  // los lados del rectángulo como están AHORA (el resolvedor los mueve al acotar)
  const lados = async () => {
    const s = await se(); const P = s.pts;
    const L = s.lines.map((l, i) => ({ ...l, i })).filter((l) => !l.ref).map((l) => ({ i: l.i, a: P[l.a], b: P[l.b], largo: Math.hypot(P[l.a].x - P[l.b].x, P[l.a].y - P[l.b].y), mx: (P[l.a].x + P[l.b].x) / 2, my: (P[l.a].y + P[l.b].y) / 2, horiz: Math.abs(P[l.a].y - P[l.b].y) < Math.abs(P[l.a].x - P[l.b].x) }));
    const abajo = L.filter((l) => l.horiz).sort((u, v) => u.my - v.my)[0], derecha = L.filter((l) => !l.horiz).sort((u, v) => v.mx - u.mx)[0];
    return { abajo, derecha, s };
  };
  const cajaDeCota = () => p.evaluate(() => { const i = document.querySelector('[data-testid="sk-dim-input"]'); return i ? { val: i.value, enfocada: document.activeElement === i, seleccionada: i.selectionStart === 0 && i.selectionEnd === i.value.length, quitar: !!document.querySelector('[data-testid="sk-dim-quitar"]') } : null; });
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

    // un golpe en el documento ANTES de bocetar (para ver que el Ctrl+Z del boceto no se lo lleva)
    const OTRA = 'lab-alambre/alambre-pie-carrete';
    const cm = await p.evaluate((k) => window.__forgeBrep.yunque.caraMayor(k), OTRA);
    await p.evaluate((o) => window.__forgeBrep.yunque.golpear(o), { sobre: OTRA, cara: cm.cara, modo: 'nuevo', depth: 4, rect: [cm.ancla[0] - 3, cm.ancla[1] - 3, cm.ancla[0] + 3, cm.ancla[1] + 3] });
    await p.waitForFunction(() => { const y = window.__forgeBrep.yunque; return y.golpes.length === 1 && !y.forjando && y.forjadas.length === 1; }, null, { timeout: 120000 });

    // agarrar con doble clic una cara plana grande de una pieza impresa (barrido del visor, como yunque-verify)
    const vp = await p.$eval('.fb-viewport', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const forjables = new Set(await p.evaluate(() => window.__forgeBrep.yunque.forjables()));
    let key = null;
    for (let gy = 2; gy < 16 && !key; gy++) for (let gx = 6; gx < 28 && !key; gx++) {
      const x = vp.x + (vp.w * gx) / 30, y = vp.y + (vp.h * gy) / 18;
      await p.mouse.move(x, y);
      const h = await p.evaluate(() => window.__forgeBrep.taller.hover);
      if (!h || h.cara == null || !forjables.has(h.key) || h.key === OTRA) continue;
      const c = await p.evaluate(([k, i]) => window.__forgeBrep.taller.cara(k, i), [h.key, h.cara]);
      if (!c || !c.plana || c.area < 6000) continue;
      await p.mouse.dblclick(x, y);
      await espera(1700);
      const yc = await p.evaluate(() => window.__forgeBrep.yunque.cara);
      if (yc && yc.plana && yc.forjable && yc.diag > 90) key = yc.key; else await p.keyboard.press('Escape');
    }
    if (!key) throw new Error('no se encontró una cara plana grande de una pieza impresa');
    await p.click('[data-testid="yunque-cortar"]');
    await p.waitForSelector('[data-testid="sketch-editor"]', { timeout: 20000 });
    await espera(1700);

    // ── A. el título ──
    const titulo = await p.$eval('[data-testid="sk-titulo"]', (e) => e.textContent).catch(() => null);
    ok('A. el boceto dice el modo y la pieza', !!titulo && /^Cortar · \S/.test(titulo), titulo);

    // ── R1. la referencia: el contorno de la cara ──
    const caraYq = await p.evaluate(() => window.__forgeBrep.yunque.cara);
    const s0 = await se();
    const refPts = s0.pts.slice(0, s0.nRefPts);
    const rx = refPts.map((q) => q.x), ry = refPts.map((q) => q.y);
    const diagRef = refPts.length ? Math.hypot(Math.max(...rx) - Math.min(...rx), Math.max(...ry) - Math.min(...ry)) : 0;
    ok('R. el contorno de la cara entra al boceto como referencia fija y mide lo que la cara', s0.nRef >= 3 && s0.nRefPts >= 3 && refPts.every((q) => q.fixed) && Math.abs(diagRef - caraYq.diag) < 0.05 && s0.nLines === 0,
      { lineas_de_referencia: s0.nRef, diagonal_ref: +diagRef.toFixed(3), diagonal_de_la_cara: +caraYq.diag.toFixed(3), lineas_de_la_mano: s0.nLines });

    // ── B. previa del rectángulo ──
    await p.click('[data-testid="sk-tool-rect"]');
    await clicMm(-15, -8);
    const q = await aPx(12, 9); await p.mouse.move(q.x - 30, q.y + 20, { steps: 3 }); await p.mouse.move(q.x, q.y, { steps: 4 }); await espera(250);
    const previa = await p.$eval('[data-testid="sk-rect-previa"]', (e) => e.textContent).catch(() => null);
    const mp = previa && previa.trim().match(/^([\d.]+) × ([\d.]+)$/);
    ok('B. el rectángulo se ve antes del segundo clic, con su ancho × alto', !!mp && Math.abs(+mp[1] - 27) < 0.6 && Math.abs(+mp[2] - 17) < 0.6, previa);
    await shot('01-previa-del-rectangulo.png');
    await p.mouse.click(q.x, q.y); await espera(300);
    let L = await lados();
    ok('B. …y el segundo clic lo deja dibujado (4 líneas)', L.s.nLines === 4 && !(await p.$('[data-testid="sk-rect-previa"]')), { lineas: L.s.nLines });

    // ── C. acotar un lado con UN clic ──
    await p.click('[data-testid="sk-tool-dim"]');
    await clicMm(L.abajo.mx, L.abajo.my);
    let caja = await cajaDeCota();
    ok('C. Cota + clic en un lado: sale la caja con su largo, enfocada y SELECCIONADA', caja && caja.enfocada && caja.seleccionada && Math.abs(parseFloat(caja.val) - 27) < 0.2 && !caja.quitar, caja);
    await shot('02-caja-de-cota.png');
    await p.keyboard.type('20'); await p.keyboard.press('Enter'); await espera(400);
    L = await lados();
    ok('C. teclear 20 + Enter: ese lado mide 20.00', Math.abs(L.abajo.largo - 20) < 0.005, { largo: +L.abajo.largo.toFixed(3) });
    await clicMm(L.derecha.mx, L.derecha.my);
    await p.keyboard.type('12'); await p.keyboard.press('Enter'); await espera(400);
    L = await lados();
    ok('C. el otro lado a 12: el rectángulo queda de 20.00 × 12.00 con 2 cotas', Math.abs(L.abajo.largo - 20) < 0.005 && Math.abs(L.derecha.largo - 12) < 0.005 && L.s.nCotas === 2 && L.s.status !== 'over', { ancho: +L.abajo.largo.toFixed(3), alto: +L.derecha.largo.toFixed(3), cotas: L.s.nCotas, estado: L.s.status });
    await shot('03-acotado-20x12.png');

    // ── R2. colocar el rectángulo contra un vértice de la cara ──
    {
      const s1 = await se();
      // el vértice de la referencia más cercano al rectángulo (y que no esté encimado con él)
      const mano = s1.pts.slice(s1.nRefPts);
      const esq = mano.reduce((a, q) => (q.x + q.y < a.x + a.y ? q : a));             // esquina abajo-izquierda del rectángulo
      const iEsq = s1.nRefPts + mano.indexOf(esq);
      const cand = s1.pts.slice(0, s1.nRefPts).map((q, i) => ({ ...q, i, d: Math.hypot(q.x - esq.x, q.y - esq.y) })).filter((q) => q.d > 6 && Math.abs(q.x - esq.x) > 3 && Math.abs(q.y - esq.y) > 3).sort((a, c) => a.d - c.d)[0];
      const antesRef = { x: cand.x, y: cand.y };
      const sx = Math.sign(esq.x - cand.x), sy = Math.sign(esq.y - cand.y);
      // Cota: clic en el vértice de la referencia, clic en la esquina del rectángulo, ↔, 12
      await clicMm(cand.x, cand.y); await clicMm(esq.x, esq.y);
      await p.click('[data-testid="sk-dim-h"]');
      await p.click('[data-testid="sk-dim-input"]'); await p.keyboard.press('Control+a'); await p.keyboard.type('12'); await p.keyboard.press('Enter'); await espera(450);
      let s2 = await se(); let e2 = s2.pts[iEsq];
      await clicMm(cand.x, cand.y); await clicMm(e2.x, e2.y);
      await p.click('[data-testid="sk-dim-v"]');
      await p.click('[data-testid="sk-dim-input"]'); await p.keyboard.press('Control+a'); await p.keyboard.type('8'); await p.keyboard.press('Enter'); await espera(450);
      s2 = await se(); e2 = s2.pts[iEsq];
      const r2 = s2.pts[cand.i];
      ok('R. cota ↔ 12 y ↕ 8 contra un vértice de la cara: la esquina queda a 12.000 y 8.000 mm, y la referencia no se movió', Math.abs(Math.abs(e2.x - r2.x) - 12) < 0.005 && Math.abs(Math.abs(e2.y - r2.y) - 8) < 0.005 && Math.abs(r2.x - antesRef.x) < 1e-9 && Math.abs(r2.y - antesRef.y) < 1e-9 && s2.status !== 'over' && Math.sign(e2.x - r2.x) === sx && Math.sign(e2.y - r2.y) === sy,
        { dx: +(e2.x - r2.x).toFixed(4), dy: +(e2.y - r2.y).toFixed(4), cotas: s2.nCotas, estado: s2.status });
      await shot('03b-acotado-contra-el-borde.png');
      // la referencia no se arrastra (herramienta Seleccionar) ni se acota (Cota sobre una de sus líneas no abre caja)
      await p.click('[data-testid="sk-tool-select"]');
      const q0 = await aPx(cand.x, cand.y);
      await p.mouse.move(q0.x, q0.y); await p.mouse.down(); await p.mouse.move(q0.x + 40, q0.y + 25, { steps: 5 }); await p.mouse.up(); await espera(300);
      const s3 = await se();
      await p.keyboard.press('Escape');
      await p.click('[data-testid="sk-tool-dim"]');
      const lr = s3.lines.find((l) => l.ref && Math.hypot(s3.pts[l.a].x - s3.pts[l.b].x, s3.pts[l.a].y - s3.pts[l.b].y) > 8);
      await clicMm((s3.pts[lr.a].x + s3.pts[lr.b].x) / 2, (s3.pts[lr.a].y + s3.pts[lr.b].y) / 2);
      const cajaRef = await cajaDeCota();
      await p.keyboard.press('Escape'); await espera(200);
      ok('R. la referencia no se arrastra ni se acota', Math.abs(s3.pts[cand.i].x - antesRef.x) < 1e-9 && Math.abs(s3.pts[cand.i].y - antesRef.y) < 1e-9 && !cajaRef, { vertice_se_movio: +(Math.hypot(s3.pts[cand.i].x - antesRef.x, s3.pts[cand.i].y - antesRef.y)).toFixed(6), caja_de_cota: cajaRef });
      L = await lados();
    }

    // ── D. cambiar y quitar una cota ──
    await clicMm(L.abajo.mx, L.abajo.my);
    caja = await cajaDeCota();
    await p.keyboard.type('25'); await p.keyboard.press('Enter'); await espera(400);
    L = await lados();
    ok('D. volver a acotar el mismo lado lo CAMBIA: 25.00, siguen 4 cotas, sin conflicto', caja && caja.quitar && Math.abs(L.abajo.largo - 25) < 0.005 && L.s.nCotas === 4 && L.s.status !== 'over', { caja, largo: +L.abajo.largo.toFixed(3), cotas: L.s.nCotas, estado: L.s.status });
    await clicMm(L.abajo.mx, L.abajo.my);
    await p.click('[data-testid="sk-dim-quitar"]'); await espera(400);
    L = await lados();
    ok('D. el botón ✕ quita esa cota (quedan 3)', L.s.nCotas === 3 && !(await cajaDeCota()), { cotas: L.s.nCotas });
    await clicMm(L.abajo.mx, L.abajo.my);
    await p.keyboard.type('20'); await p.keyboard.press('Enter'); await espera(400);

    // ── E. ángulo entre dos lados ──
    L = await lados();
    await clicMm(L.abajo.mx, L.abajo.my);
    await clicMm(L.derecha.mx, L.derecha.my);
    const dimAng = (await se()).dim;
    ok('E. clic en un lado y luego en el contiguo: la caja pasa a ser la del ÁNGULO (90°)', dimAng && dimAng.kind === 'ang' && Math.abs(parseFloat(dimAng.val) - 90) < 0.2, dimAng);
    await p.keyboard.press('Escape'); await espera(300);
    ok('E. Esc cierra la caja de cota aunque haya una cara agarrada (el Esc del Taller ya no se lo come)', !(await cajaDeCota()) && (await se()).dim === null);

    // ── F. Ctrl+Z dentro del boceto ──
    await p.click('[data-testid="sk-tool-circle"]');
    await clicMm(-30, 22); await clicMm(-24, 22);
    const conCirculo = await se();
    await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await p.keyboard.press('Control+z'); await espera(400);
    const sinCirculo = await se();
    const golpesDoc = await p.evaluate(() => window.__forgeBrep.yunque.golpes.length);
    ok('F. Ctrl+Z en el boceto quita el último trazo y NO toca los golpes del documento', conCirculo.nCircles === 1 && sinCirculo.nCircles === 0 && sinCirculo.nLines === 4 && sinCirculo.nCotas === 4 && golpesDoc === 1,
      { circulos: [conCirculo.nCircles, sinCirculo.nCircles], lineas: sinCirculo.nLines, cotas: sinCirculo.nCotas, golpes_del_documento: golpesDoc });

    // ── G. terminar ──
    await p.click('[data-testid="sk-finish"]');
    await p.click('[data-testid="yunque-forjar"]');   // al terminar el boceto se pide la profundidad (10 mm por omisión) y ENTONCES se forja
    await p.waitForFunction(() => { const y = window.__forgeBrep.yunque; return y.golpes.length === 2 && !y.forjando; }, null, { timeout: 240000 });
    await espera(900);
    await p.waitForFunction(() => !window.__forgeBrep.yunque.forjando, null, { timeout: 240000 });
    const g = await p.evaluate(() => { const y = window.__forgeBrep.yunque; const g2 = y.golpes[1]; const xs = g2.profile.map((q) => q.x), ys = g2.profile.map((q) => q.y); return { modo: g2.modo, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), sobre: g2.sobre, t: y.tiempos()[g2.sobre], errores: y.errores }; });
    ok('G. el golpe sale de 20.00 × 12.00 y corta la pieza', g.modo === 'cortar' && g.sobre === key && Math.abs(g.w - 20) < 0.01 && Math.abs(g.h - 12) < 0.01 && g.t && g.t.volBase - g.t.vol > 0 && g.t.volBase - g.t.vol <= 20 * 12 * 10 + 0.01,
      { ancho: +g.w.toFixed(3), alto: +g.h.toFixed(3), quito_mm3: g.t && +(g.t.volBase - g.t.vol).toFixed(1), tope: 2400, errores: g.errores });
    await shot('04-ventana-cortada.png');
  } catch (e) {
    ok('sin excepción', false, String(e).slice(0, 300));
    await shot('99-falla.png').catch(() => {});
  }
  ok('sin errores de página', errs.length === 0, errs.slice(0, 6));
  fs.writeFileSync(path.join(OUT, 'boceto-verify.json'), JSON.stringify({ url: URL, checks, errs }, null, 2));
  const fallas = checks.filter((c) => !c.pasa).length;
  console.log(`\nBOCETO_VERIFY: ${fallas ? 'FALLA' : 'PASA'} (${checks.length - fallas}/${checks.length}) · capturas en ${OUT}`);
  await b.close();
  process.exit(fallas ? 1 : 0);
})();
