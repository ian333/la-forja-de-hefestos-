#!/usr/bin/env node
/**
 * FUERA DEL TALLER — regresión de lo que la noche del 11-11 tocó y comparten TODOS los documentos
 * (orden 2026-11-12-regresion-fuera-del-taller). Con el mouse y el teclado de verdad:
 *   K. documento nuevo del KERNEL: las teclas del kernel siguen vivas (F = redondeo, Ctrl+Z lo quita); el radial trae las
 *      8 del kernel con letrero; Boceto → XY → rectángulo → Cota con UN clic en cada lado (30 y 18) → Terminar → Extruir
 *      → 30 × 18 × 12 = 6,480 mm³; dentro del boceto C y R son del boceto y Ctrl+Z deshace el trazo, no el documento;
 *   D. BANCO DEL ARCO v3 y BRAZO VIVO abren completos, sin errores, y la cámara los encuadra.
 * Uso (iangpu, vite DEV vivo):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA node scripts/fuera-del-taller-verify.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5009/forja-brep.html';
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'forja-shots', 'fuera-del-taller');
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
  const inv = () => p.evaluate(() => { const i = window.__forgeBrep.invariants; return i ? { ops: i.ops, vol: i.vol_kernel } : null; });
  const doc = () => p.evaluate(() => { const d = window.__forgeBrep.serializeDoc(); return { ops: d.ops.map((o) => o.type), comps: d.components.length, kind: d.sketch.kind }; });
  const estado = () => p.$eval('[data-testid="estado-texto"]', (e) => e.textContent).catch(() => '');
  const tecla = async (t) => { await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await p.keyboard.press(t); await espera(350); };
  const se = () => p.evaluate(() => { const s = window.__sketchEditor; return s ? { pts: s.points(), lines: s.lines(), nLines: s.nLines, nCircles: s.nCircles, nCotas: s.nCotas, nRef: s.nRef } : null; });
  const aPx = (x, y) => p.evaluate(([mx, my]) => { const s = window.__sketchEditor; const q = s.toPx(mx, my); const r = s.svgRect(); return { x: r.left + q.px, y: r.top + q.py }; }, [x, y]);
  const clicMm = async (x, y) => { const q = await aPx(x, y); await p.mouse.move(q.x, q.y, { steps: 4 }); await p.mouse.click(q.x, q.y); await espera(280); };
  const lados = async () => {
    const s = await se(); const P = s.pts;
    const L = s.lines.filter((l) => !l.ref).map((l) => ({ largo: Math.hypot(P[l.a].x - P[l.b].x, P[l.a].y - P[l.b].y), mx: (P[l.a].x + P[l.b].x) / 2, my: (P[l.a].y + P[l.b].y) / 2, horiz: Math.abs(P[l.a].y - P[l.b].y) < Math.abs(P[l.a].x - P[l.b].x) }));
    return { abajo: L.filter((l) => l.horiz).sort((u, v) => u.my - v.my)[0], derecha: L.filter((l) => !l.horiz).sort((u, v) => v.mx - u.mx)[0], s };
  };
  const cam = async () => { const n = await p.evaluate(() => window.__forgeBrep.nav); const o = [0, 1, 2].map((i) => n.pos[i] - n.target[i]); return { d: Math.hypot(...o), t: n.target }; };
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso && document.querySelector("canvas"))', null, { timeout: 180000 });
    const gl = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
    ok('GPU real (no SwiftShader/llvmpipe)', !/swiftshader|llvmpipe/i.test(gl), gl);
    await espera(1500);
    const vp = await p.$eval('.fb-viewport', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });

    // ── K1. del lienzo vacío: «o dibújala desde cero» → boceto, rectángulo, cota con un clic en cada lado ──
    await p.click('[data-testid="lienzo-vacio-boceto"]');
    await p.waitForSelector('[data-testid="sketch-editor"]', { timeout: 20000 });
    await espera(1700);
    const s0 = await se();
    ok('K. el boceto del kernel abre SIN referencia ni título (son solo del yunque)', s0 && s0.nRef === 0 && !(await p.$('[data-testid="sk-titulo"]')), s0 && { nRef: s0.nRef });
    const dB = await doc();
    await p.click('[data-testid="sk-tool-rect"]');
    await clicMm(-34, -22); await clicMm(8, 14);
    await tecla('c'); await tecla('r'); await tecla('f'); await tecla('v');
    ok('K. dentro del boceto, C, R, F y V son del boceto y no tocan el documento', JSON.stringify(await doc()) === JSON.stringify(dB) && !/Error/.test(await estado()), await doc());
    await p.click('[data-testid="sk-tool-dim"]');
    let L = await lados();
    await clicMm(L.abajo.mx, L.abajo.my);
    const caja = await p.evaluate(() => { const i = document.querySelector('[data-testid="sk-dim-input"]'); return i ? { val: i.value, enfocada: document.activeElement === i, sel: i.selectionStart === 0 && i.selectionEnd === i.value.length } : null; });
    await p.keyboard.type('30'); await p.keyboard.press('Enter'); await espera(450);
    L = await lados();
    await clicMm(L.derecha.mx, L.derecha.my);
    await p.keyboard.type('18'); await p.keyboard.press('Enter'); await espera(450);
    L = await lados();
    ok('K. Cota con un clic en cada lado: 30.00 × 18.00', caja && caja.enfocada && caja.sel && Math.abs(L.abajo.largo - 30) < 0.005 && Math.abs(L.derecha.largo - 18) < 0.005 && L.s.nCotas === 2, { caja, ancho: +L.abajo.largo.toFixed(3), alto: +L.derecha.largo.toFixed(3) });
    await p.click('[data-testid="sk-tool-circle"]');
    await clicMm(30, 30); await clicMm(36, 30);
    const conC = await se();
    await tecla('Control+z');
    const sinC = await se();
    ok('K. Ctrl+Z dentro del boceto quita el círculo y deja el documento igual', conC.nCircles === 1 && sinC.nCircles === 0 && sinC.nLines === 4 && JSON.stringify(await doc()) === JSON.stringify(dB), { circulos: [conC.nCircles, sinC.nCircles] });
    await shot('01-boceto-del-kernel-acotado.png');
    await p.click('[data-testid="sk-finish"]');
    await espera(1500);
    ok('K. al terminar un boceto del kernel NO sale la barra de profundidad del yunque', !(await p.$('[data-testid="yunque-listo"]')) && (await doc()).kind === 'custom', await doc());
    await p.click('[data-testid="btn-extrude"]');
    await p.waitForFunction(() => { const i = window.__forgeBrep.invariants; return i && Math.abs(i.vol_kernel - 6480) < 6480 * 0.005; }, null, { timeout: 120000 }).catch(() => {});
    await espera(800);
    const i1 = await inv();
    ok('K. Extruir: el sólido mide 30 × 18 × 12 = 6,480 mm³ (±0.5 %)', i1 && Math.abs(i1.vol / 6480 - 1) < 0.005 && !/Error/.test(await estado()), { volumen: i1 && +i1.vol.toFixed(1), estado: (await estado()).slice(0, 60) });
    await shot('02-solido-del-kernel.png');

    // ── K2. con el sólido: las teclas del kernel siguen vivas y Ctrl+Z las deshace ──
    const d0 = await doc();
    await tecla('f');
    await p.waitForFunction(() => window.__forgeBrep.invariants && window.__forgeBrep.invariants.ops.includes('fillet'), null, { timeout: 60000 }).catch(() => {});
    const dF = await doc();
    await tecla('Control+z'); await espera(1200);
    const dZ = await doc();
    ok('K. en un documento del kernel, F agrega el redondeo y Ctrl+Z lo quita', dF.ops.includes('fillet') && !d0.ops.includes('fillet') && JSON.stringify(dZ.ops) === JSON.stringify(d0.ops), { antes: d0.ops, conF: dF.ops, trasCtrlZ: dZ.ops });

    // ── K3. el radial del kernel, con letreros ──
    const rx = vp.x + vp.w * 0.3, ry = vp.y + vp.h * 0.35;
    await p.mouse.click(rx, ry, { button: 'right' }); await espera(110); await p.mouse.click(rx, ry, { button: 'right' }); await espera(400);
    const ids = await p.$$eval('[data-testid^="radial-"]', (els) => els.map((e) => e.dataset.testid).filter((t) => t !== 'radial-menu' && !t.startsWith('radial-letrero-')).map((t) => t.replace('radial-', '')));
    const letreros = await p.$$eval('[data-testid^="radial-letrero-"]', (els) => els.map((e) => e.textContent));
    ok('K. el radial del kernel conserva sus 8 herramientas, ahora con letrero', ['sketch', 'extrude', 'revolve', 'hole', 'fillet', 'chamfer', 'pattern', 'plano'].every((k) => ids.includes(k)) && letreros.includes('Extruir') && !ids.includes('medir'), { ids, letreros });
    await shot('03-radial-del-kernel.png');
    await p.keyboard.press('Escape'); await espera(400);
    ok('K. Esc cierra el radial también en un documento del kernel', (await p.$('[data-testid="radial-menu"]')) === null);
    if (await p.$('[data-testid="radial-menu"]')) { await p.mouse.click(rx + 300, ry + 250); await espera(300); }

    // ── D. los otros dos documentos con piezas de referencia ──
    for (const [id, nombre] of [['st-banco-arco', 'BANCO DEL ARCO v3'], ['st-brazo-vivo', 'BRAZO VIVO']]) {
      const antes = errs.length;
      await p.click('[data-testid="doc-switcher"]');
      await p.click(`[data-testid="ps-open-${id}"]`);
      await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 0 && t.visibles === t.total; }, null, { timeout: 180000 });
      await espera(4500);
      const t = await p.evaluate(() => { const x = window.__forgeBrep.taller; return { total: x.total, visibles: x.visibles }; });
      const c = await cam();
      const caja = await p.evaluate(() => { const m = window.__forgeBrep.mover, d = window.__forgeBrep.refDrawn; const tops = [...new Set(d.map((r) => r.key.split('/')[0]))]; const cs = tops.map((k) => m.caja(k)).filter(Boolean); const mn = [0, 1, 2].map((i) => Math.min(...cs.map((q) => q.min[i]))), mx = [0, 1, 2].map((i) => Math.max(...cs.map((q) => q.max[i]))); return { centro: [(mn[0] + mx[0]) / 2, (mn[2] + mx[2]) / 2, -(mn[1] + mx[1]) / 2], diag: Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) }; });
      const aCentro = Math.hypot(c.t[0] - caja.centro[0], c.t[1] - caja.centro[1], c.t[2] - caja.centro[2]);
      const e = await estado();
      // encuadrado = la cámara mira hacia el banco (su blanco cae dentro de ~1 diagonal del centro) desde una distancia que lo deja ver
      ok(`D. ${nombre} abre completo, sin errores, y la cámara lo encuadra`, t.total > 5 && t.visibles === t.total && errs.length === antes && !/^Error/.test(e) && aCentro < caja.diag && c.d > caja.diag * 0.4 && c.d < caja.diag * 6,
        { cuerpos: t.total, estado: e.slice(0, 70), camara_mm: Math.round(c.d), diagonal_mm: Math.round(caja.diag), blanco_a_mm_del_centro: Math.round(aCentro) });
      await shot(`04-${id}.png`);
    }
  } catch (e) {
    ok('sin excepción', false, String(e).slice(0, 300));
    await shot('99-falla.png').catch(() => {});
  }
  ok('sin errores de página', errs.length === 0, errs.slice(0, 6));
  fs.writeFileSync(path.join(OUT, 'fuera-del-taller-verify.json'), JSON.stringify({ url: URL, checks, errs }, null, 2));
  const fallas = checks.filter((c) => !c.pasa).length;
  console.log(`\nFUERA_DEL_TALLER_VERIFY: ${fallas ? 'FALLA' : 'PASA'} (${checks.length - fallas}/${checks.length}) · capturas en ${OUT}`);
  await b.close();
  process.exit(fallas ? 1 : 0);
})();
