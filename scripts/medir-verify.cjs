#!/usr/bin/env node
/**
 * MEDIR — verificación con navegador y GPU real (orden 2026-11-11-medir).
 * ============================================================================================================
 * Abre «LABORATORIO v2 · generado», prende Medir en El Taller y mide con el mouse de verdad. La VERDAD contra la que
 * se compara NO sale del código de medir: sale de public/modelos/laboratorio/laboratorio.json (w/d/h/r, x/y/z y giros
 * de las primitivas; el estudio sube todo el laboratorio 125 mm en Z) y de los puntos a los que este script apunta.
 *   A. una caja de tres cotas distintas (PS1 25.4 × 50.8 × 10.2): caras opuestas → separación = su cota (±0.05 mm), con
 *      la Δ sobre ese eje y la coordenada ABSOLUTA de cada clic (prueba el marco del punto); contiguas → 90.0° (±0.1°);
 *   B. doble clic (no llena B, la cámara no vuela, no sale el yunque), dos puntos de una misma cara, tercer clic = A;
 *   C. tenaza Cuerpo → su caja; dos cuerpos → distancia entre centros; tenaza Pieza → la caja del módulo;
 *   D. cilindros de 48 lados: diámetro = 2·r y largo = h; entre ejes (misma altura y a alturas distintas); eje a cara;
 *   E. dos cilindros que comparten eje → 0; F. piezas GIRADAS: 45.0° entre un escudo inclinado y uno acostado,
 *      entre ejes de dos cilindros acostados, 90.0° entre un eje acostado y uno parado;
 *   I. una pieza IMPRESA (malla FMSH teselada por OCCT): los radios que da Medir contra los CYLINDRICAL_SURFACE de su STEP;
 *   J. cilindros RECORTADOS EN DIAGONAL de la columna (R 34.75 y 45.25 en su STEP): solo salen cilindro, y con ese radio,
 *      si el afinado del eje funciona (sin afinar su residuo queda arriba del corte);   K. una cara curva que NO es
 *      cilindro (la bobina L1, un tubo en hélice) → área, sin diámetro;
 *   H. sin aislar nada, en el laboratorio completo: de la placa de trabajo a la tapa del hongo del paro = 5.00 mm;
 *   G. Esc limpia, el segundo Esc apaga; apagar limpia; con Medir apagado el clic agarra y el doble clic vuela (BASE).
 * Capturas a 1920×1080 en OUT (para revisarlas A OJO: la cota se lee y está donde debe).
 *
 * Uso (iangpu, vite DEV vivo):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *     URL=http://localhost:5010/forja-brep.html node scripts/medir-verify.cjs
 * Sale con 0 si todo pasa, 1 si algo falla.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5009/forja-brep.html';
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'forja-shots', 'medir');
const LAB = process.env.LAB || path.resolve(__dirname, '..', 'public', 'modelos', 'laboratorio', 'laboratorio.json');
const Z0_LAB = 125;
const checks = [];
const ok = (nombre, pasa, dato) => { checks.push({ nombre, pasa: !!pasa, dato }); console.log(`${pasa ? 'PASA' : 'FALLA'}  ${nombre}${dato !== undefined ? '  · ' + JSON.stringify(dato) : ''}`); };
const r3 = (v) => (Array.isArray(v) ? v.map((x) => +x.toFixed(3)) : v == null ? v : +v.toFixed(3));

// ── LA VERDAD: las primitivas del laboratorio, colocadas con sus giros (Euler XYZ en grados, como THREE) ──
const mul = (A, B) => A.map((f, i) => B[0].map((_, j) => f[0] * B[0][j] + f[1] * B[1][j] + f[2] * B[2][j]));
const apl = (R, v) => R.map((f) => f[0] * v[0] + f[1] * v[1] + f[2] * v[2]);
const mas = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const uni = (a) => { const L = len(a) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
function rotXYZ(rx = 0, ry = 0, rz = 0) {
  const [a, b, c] = [rx, ry, rz].map((g) => (g * Math.PI) / 180);
  const X = [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
  const Y = [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]];
  const Z = [[Math.cos(c), -Math.sin(c), 0], [Math.sin(c), Math.cos(c), 0], [0, 0, 1]];
  return mul(mul(X, Y), Z);
}
const lab = JSON.parse(fs.readFileSync(LAB, 'utf8'));
/** Una hoja del laboratorio por su llave ('lab-placa/ps1'): la primitiva, su giro acumulado R y su posición en el doc. */
function hoja(key) {
  let lista = lab.piezas, R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], pos = [0, 0, Z0_LAB], r = null;
  for (const id of key.split('/')) {
    r = lista.find((x) => x.id === id);
    if (!r) throw new Error(`laboratorio.json no tiene ${key}`);
    if (r.orden && r.orden !== 'XYZ') throw new Error(`${key}: orden de Euler ${r.orden} no contemplado`);
    pos = mas(pos, apl(R, [r.x, r.y, r.z]));
    R = mul(R, rotXYZ(r.rx, r.ry, r.rz));
    lista = r.hijos || [];
  }
  return { key, r, R, pos };
}
/** Una cara de una caja: eje 0/1/2 (w/d/h) y lado ±1 → centro, normal hacia afuera, área y la cota entre ella y su opuesta. */
function caraDeCaja(key, eje, lado) {
  const h = hoja(key), dims = [h.r.w, h.r.d, h.r.h], e = [0, 0, 0]; e[eje] = lado;
  const n = apl(h.R, e);
  return { key, n, c: mas(h.pos, n, dims[eje] / 2), area: dims[(eje + 1) % 3] * dims[(eje + 2) % 3], cota: dims[eje], centro: h.pos, nombre: h.r.name };
}
/** Un cilindro: su eje (el Z local girado), su centro, radio y alto. */
function cilindro(key) { const h = hoja(key); return { key, eje: apl(h.R, [0, 0, 1]), c: h.pos, r: h.r.r, h: h.r.h, nombre: h.r.name }; }
const PUBLICO = path.resolve(path.dirname(LAB), '..', '..');
/** Centro y tamaño de la caja de una malla FMSH leída del .bin (Uint32[4] de cabecera y luego las posiciones Float32). */
function cajaFmsh(url) {
  const buf = fs.readFileSync(path.join(PUBLICO, url)), nv = buf.readUInt32LE(8), mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  if (buf.readUInt32LE(0) !== 0x48534d46) throw new Error(`${url}: no es FMSH`);
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { const v = buf.readFloatLE(16 + (i * 3 + k) * 4); if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  return { centro: mn.map((v, k) => (v + mx[k]) / 2), tam: mn.map((v, k) => mx[k] - v) };
}
/** Las caras CURVAS de una malla FMSH, de mayor a menor área: componentes conexas por índice cuyas facetas no miran todas
 *  a donde mira la cara. De cada una, el centro y la normal de su triángulo más grande (hacia ahí se apunta la cámara). */
function carasCurvasFmsh(url) {
  const buf = fs.readFileSync(path.join(PUBLICO, url)), nv = buf.readUInt32LE(8), ni = buf.readUInt32LE(12);
  const P = (i, k) => buf.readFloatLE(16 + (i * 3 + k) * 4), I = (j) => buf.readUInt32LE(16 + nv * 24 + j * 4);
  const par = Int32Array.from({ length: nv }, (_, i) => i), raiz = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  const nt = Math.floor(ni / 3);
  for (let t = 0; t < nt; t++) for (const j of [1, 2]) { const a = raiz(I(3 * t)), c = raiz(I(3 * t + j)); if (a !== c) par[c] = a; }
  const grupos = new Map();
  for (let t = 0; t < nt; t++) {
    const v = [0, 1, 2].map((j) => { const i = I(3 * t + j); return [P(i, 0), P(i, 1), P(i, 2)]; });
    const n = cruz(sub(v[1], v[0]), sub(v[2], v[0])), area = len(n) / 2, g = raiz(I(3 * t));
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push({ area, n: uni(n), c: [0, 1, 2].map((k) => (v[0][k] + v[1][k] + v[2][k]) / 3) });
  }
  const out = [];
  for (const tris of grupos.values()) {
    const m = uni(tris.reduce((a, t) => mas(a, t.n, t.area), [0, 0, 0]));
    if (tris.every((t) => t.area <= 1e-9 || dot(t.n, m) >= 0.9995)) continue;   // plana
    const mayor = tris.reduce((a, t) => (t.area > a.area ? t : a));
    out.push({ area: tris.reduce((a, t) => a + t.area, 0), nt: tris.length, c: mayor.c, n: mayor.n });
  }
  return out.sort((a, c) => c.area - a.area);
}
/** Los radios de TODAS las superficies cilíndricas de un STEP (la verdad del CAD, no de la malla). */
const radiosDelStep = (url) => [...new Set([...fs.readFileSync(path.join(PUBLICO, url.replace(/\.bin$/, '.step')), 'utf8').matchAll(/CYLINDRICAL_SURFACE\s*\(\s*'[^']*'\s*,\s*#\d+\s*,\s*([0-9.Ee+-]+)\s*\)/g)].map((x) => +x[1]))].sort((a, c) => a - c);
/** Distancia entre dos rectas paralelas (punto c, dirección u). */
const entreEjes = (A, B) => { const w = sub(B.c, A.c), u = uni(A.eje); return len(mas(w, u, -dot(w, u))); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--window-size=1920,1080'],
  });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [], redExterna = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + String(e).slice(0, 240)));
  p.on('console', (m) => {
    if (/MEDIR_ERR/.test(m.text())) errs.push(m.text().slice(0, 200));
    if (m.type() !== 'error' || /telemetry|favicon|404/.test(m.text())) return;
    // un recurso de FUERA (no localhost) que no cargó por la red no es un error de la página: se apunta con su URL y se dice
    const url = (m.location() && m.location().url) || '';
    if (/^Failed to load resource: net::ERR_/.test(m.text()) && /^https?:/.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) { redExterna.push(`${m.text().replace('Failed to load resource: ', '')} ← ${url.slice(0, 90)}`); return; }
    errs.push(`${m.text().slice(0, 200)}${url ? ` ← ${url.slice(0, 90)}` : ''}`);
  });
  const espera = (ms) => p.waitForTimeout(ms);
  const shot = (n) => p.screenshot({ path: path.join(OUT, n), timeout: 30000 });
  const taller = () => p.evaluate(() => { const t = window.__forgeBrep.taller; return { tenaza: t.tenaza, sel: t.sel, aislado: t.aislado, hover: t.hover, visibles: t.visibles, total: t.total }; });
  const medir = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__forgeBrep.medir)));
  const nav = () => p.evaluate(() => window.__forgeBrep.nav);
  const txt = (tid) => p.$eval(`[data-testid="${tid}"]`, (e) => e.textContent).catch(() => null);
  const hay = (tid) => p.evaluate((t) => !!document.querySelector(`[data-testid="${t}"]`), tid);
  let cv = null;   // el centro del canvas: ahí cae el blanco de la cámara
  /** La cámara mira al punto P (doc) desde la dirección d (doc), a r mm; espera a que llegue y se quede quieta. */
  const apuntar = async (P, d, r = 220) => {
    const n = uni(d);
    const el = Math.max(-89, Math.min(89, (Math.asin(Math.max(-1, Math.min(1, n[2]))) * 180) / Math.PI));
    const az = (Math.atan2(n[0], -n[1]) * 180) / Math.PI;
    await p.evaluate(([a, e, rr, x, y, z]) => window.__forgeBrep.orbitTo(a, e, rr, x, y, z), [az, el, r, P[0], P[1], P[2]]);
    let prev = null, quieta = 0;
    for (let i = 0; i < 80; i++) {
      await espera(140);
      const v = await nav();
      const enBlanco = v.target && Math.hypot(v.target[0] - P[0], v.target[1] - P[2], v.target[2] + P[1]) < 0.05;
      const igual = prev && v.pos && Math.hypot(v.pos[0] - prev[0], v.pos[1] - prev[1], v.pos[2] - prev[2]) < 1e-3;
      quieta = enBlanco && igual ? quieta + 1 : 0;
      prev = v.pos;
      if (quieta >= 2) return v;
    }
    throw new Error(`la cámara no llegó a ${r3(P)}`);
  };
  /** Qué hay bajo el centro del canvas: la hoja, la cara y (de la tenaza Cara) si es plana y su área. */
  const alCentro = async () => {
    await p.mouse.move(cv.x + 5, cv.y + 4); await p.mouse.move(cv.x, cv.y); await espera(160);
    const h = (await taller()).hover;
    if (!h) return null;
    const c = h.cara != null ? await p.evaluate(([k, i]) => window.__forgeBrep.taller.cara(k, i), [h.key, h.cara]) : null;
    return { ...h, plana: c ? c.plana : null, area: c ? c.area : null };
  };
  /** Direcciones para ver un punto de normal n: de frente y ladeada 35° / 60° hacia cuatro lados. */
  const vistas = (n) => {
    const t1 = uni(cruz(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), t2 = cruz(n, t1), out = [n];
    const lados = [t1, t2, mas([0, 0, 0], t1, -1), mas([0, 0, 0], t2, -1)].sort((a, c) => c[2] - a[2]);   // primero desde ARRIBA: lo de abajo suele estar tapado
    for (const k of [0.7, 1.7]) for (const t of lados) out.push(uni(mas(n, t, k)));
    return out;
  };
  /** Lleva la cámara a donde el punto P de la hoja `key` queda bajo el centro del canvas (prueba varias vistas). */
  const buscar = async (key, P, n, vale, r = 220, dirs = null) => {
    const visto = [];
    for (const d of dirs || vistas(n)) {
      await apuntar(P, d, r);
      const h = await alCentro();
      if (h && h.key === key && (!vale || vale(h))) return h;
      visto.push(h ? `${h.key}#${h.cara}${h.area != null ? ` ${h.area.toFixed(1)}mm²` : ''}` : 'nada');
    }
    throw new Error(`no encontré ${key} bajo el centro · vi: ${[...new Set(visto)].join(' | ')}`);
  };
  /** Las 26 direcciones de un cubo, primero las que ven el punto más de frente (por el lado de n y, si no, por detrás:
   *  las piezas se pintan por las dos caras, así que una pared delgada también se deja tocar desde atrás). */
  const porTodosLados = (n) => {
    const out = [];
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) out.push(uni([x, y, z]));
    return out.sort((a, c) => dot(c, n) - dot(a, n));
  };
  const clic = async () => { await p.mouse.click(cv.x, cv.y); await espera(280); return medir(); };
  /** Apunta a una cara de una caja (verdad del JSON), confirma por el área que es ESA cara y le hace clic. */
  const clicCara = async (c, P = c.c) => {
    const h = await buscar(c.key, P, c.n, (x) => x.plana && Math.abs(x.area - c.area) < Math.max(0.02, c.area * 2e-3));
    return { h, m: await clic() };
  };
  /** Apunta a la pared de un cilindro (un punto de su superficie, desde afuera) y le hace clic. */
  const clicCilindro = async (c, r = 220) => {
    const u = uni(cruz(c.eje, Math.abs(c.eje[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), v = cruz(c.eje, u), visto = [];
    for (const t of [0.25, -0.25, 0]) for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4, rad = mas(mas([0, 0, 0], u, Math.cos(ang)), v, Math.sin(ang));
      const P = mas(mas(c.c, rad, c.r), c.eje, t * c.h);
      for (const s of [0.5, -0.5, 0]) {
        await apuntar(P, mas(rad, c.eje, s), r);
        const h = await alCentro();
        if (h && h.key === c.key && (h.cara == null || h.plana === false)) return { h, P, m: await clic() };   // (con la tenaza Cuerpo no hay cara)
        visto.push(h ? h.key : 'nada');
      }
    }
    throw new Error(`no encontré la pared de ${c.key} · vi: ${[...new Set(visto)].slice(0, 8).join(' | ')}`);
  };
  const aislar = async (key) => {
    if (await hay('taller-desaislar')) { await p.click('[data-testid="taller-desaislar"]'); await espera(250); }
    const partes = key.split('/');
    for (let i = 1; i < partes.length; i++) {   // desplegar el árbol hasta la hoja
      const k = partes.slice(0, i).join('/');
      if (!(await p.evaluate((kk) => document.querySelector(`[data-taller-key="${kk}"]`)?.getAttribute('aria-expanded') === 'true', k))) {
        await p.evaluate((kk) => document.querySelector(`[data-testid="taller-abrir-${kk}"]`)?.click(), k); await espera(200);
      }
    }
    await p.evaluate((kk) => document.querySelector(`[data-testid="taller-aislar-${kk}"]`)?.click(), key);
    await espera(500);
    return (await taller()).visibles;
  };
  const tenaza = async (t) => { await p.click(`[data-testid="tenaza-${t}"]`); await espera(120); };
  const limpiar = async () => { if ((await medir()).a) { await p.keyboard.press('Escape'); await espera(200); } };
  /** Una vista ladeada para la captura: el punto P al centro, desde az/el en grados. */
  const vistaFoto = async (P, az, el, r) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180; await apuntar(P, [Math.cos(e) * Math.sin(a), -Math.cos(e) * Math.cos(a), Math.sin(e)], r); await p.mouse.move(cv.x + 420, cv.y + 330); await espera(350); };
  const cerca = (v, w, tol) => typeof v === 'number' && Math.abs(v - w) <= tol;

  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso && document.querySelector("canvas"))', null, { timeout: 180000 });
    const gl = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
    ok('GPU real (no SwiftShader/llvmpipe)', !/swiftshader|llvmpipe/i.test(gl), gl);
    await p.click('[data-testid="doc-switcher"]');
    await p.click('[data-testid="ps-open-st-laboratorio"]');
    await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 200 && t.visibles === t.total; }, null, { timeout: 180000 });
    await espera(3500);
    await p.evaluate(() => document.querySelector('.lj-x')?.click());   // el panel de los jueces tapa media pieza
    await espera(300);
    cv = await p.$eval('.fb-viewport canvas', (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: r.width, h: r.height }; });
    const enCentro = await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [cv.x, cv.y]);
    ok('el centro del visor está libre (ahí cae el blanco de la cámara)', enCentro === 'CANVAS', { ...cv, hay: enCentro });

    // ── 0. prender Medir ──
    let m = await medir();
    ok('0. __forgeBrep.medir existe y arranca apagado', m && m.on === false && m.a === null && m.b === null && m.resultado === null, m);
    await p.click('[data-testid="medir-toggle"]');
    await espera(250);
    m = await medir();
    ok('0. el botón «Medir» lo prende y sale su panel', m.on === true && (await hay('medir-panel')), (await txt('medir-panel') || '').slice(0, 90));

    // ── A. UNA CAJA de tres cotas distintas, sola en el visor ──
    const PS1 = 'lab-placa/ps1', d1 = hoja(PS1).r;
    ok('A. se aísla PS1 (25.4 × 50.8 × 10.2 en el JSON)', (await aislar(PS1)) === 1 && Math.abs(d1.w - 25.4) < 1e-9 && Math.abs(d1.d - 50.8) < 1e-9 && Math.abs(d1.h - 10.2) < 1e-9 && !d1.rad && !d1.rx && !d1.ry && !d1.rz, { w: d1.w, d: d1.d, h: d1.h });
    const Xp = caraDeCaja(PS1, 0, 1), Xn = caraDeCaja(PS1, 0, -1), Yp = caraDeCaja(PS1, 1, 1), Yn = caraDeCaja(PS1, 1, -1), Zp = caraDeCaja(PS1, 2, 1);
    let r = await clicCara(Xp);
    m = r.m;
    const panelA = (await txt('medir-resultado')) || '';
    ok('A. primer clic: A = la cara +X (plana, su área y hacia dónde mira)', m.a && !m.b && m.a.key === PS1 && m.a.clase === 'plana' && cerca(m.a.area, Xp.area, 0.05) && cerca(m.a.normal[0], 1, 1e-4) && m.resultado.tipo === 'area' && m.resultado.unidad === 'mm²' && /518\.16 mm²/.test(panelA) && /mira a \+X/.test(panelA),
      { area: r3(m.a && m.a.area), verdad: r3(Xp.area), normal: r3(m.a && m.a.normal), panel: `${await txt('medir-a')} | ${await txt('medir-resultado')}` });
    ok('A. el clic A cae donde se apuntó (marco del doc: x = centro + w/2)', m.a && cerca(m.a.punto[0], Xp.c[0], 0.05) && cerca(m.a.punto[1], Xp.c[1], 0.6) && cerca(m.a.punto[2], Xp.c[2], 0.6), { punto: r3(m.a && m.a.punto), verdad: r3(Xp.c) });
    r = await clicCara(Xn);
    m = r.m;
    let R = m.resultado || {}, pp = R.puntoAPunto || {};
    ok('A. caras opuestas ±X → SEPARACIÓN = w = 25.40 mm (±0.05)', R.tipo === 'separacion' && R.unidad === 'mm' && cerca(R.valor, d1.w, 0.05), { tipo: R.tipo, valor: R.valor, verdad: d1.w, error: R.valor != null ? +(R.valor - d1.w).toExponential(2) : null });
    ok('A. punto a punto: ΔX = −w (de +X a −X) y el clic B en x = centro − w/2', cerca(pp.dx, -d1.w, 0.05) && m.b && cerca(m.b.punto[0], Xn.c[0], 0.05) && cerca(m.b.punto[1], Xn.c[1], 0.6) && cerca(m.b.punto[2], Xn.c[2], 0.6),
      { pp: { d: r3(pp.d), dx: r3(pp.dx), dy: r3(pp.dy), dz: r3(pp.dz) }, B: r3(m.b && m.b.punto), verdadB: r3(Xn.c) });
    ok('A. |Δ| = √(ΔX² + ΔY² + ΔZ²) de lo que muestra', cerca(pp.d, Math.hypot(pp.dx, pp.dy, pp.dz), 1e-6) && pp.d >= d1.w - 0.05, { d: pp.d, raiz: Math.hypot(pp.dx, pp.dy, pp.dz) });
    const panelSep = await txt('medir-resultado'), etqSep = await txt('medir-etq-cota'), ppTxt = await txt('medir-pp');
    ok('A. el panel y la cota del visor dicen «25.40 mm»; el panel trae el punto a punto con sus Δ', /Separación/.test(panelSep || '') && /25\.40 mm/.test(panelSep || '') && /^25\.40 mm$/.test(etqSep || '') && /ΔX−25\.40/.test(ppTxt || '') && /ΔY0\.00/.test(ppTxt || '') && /ΔZ0\.00/.test(ppTxt || ''),
      { panel: panelSep, cota: etqSep, pp: ppTxt });
    ok('A. la cota va del centro de A, por su normal, al plano de B', R.linea && len(sub(R.linea[0], Xp.c)) < 0.02 && len(sub(R.linea[1], Xn.c)) < 0.02, { linea: R.linea && R.linea.map(r3), verdad: [r3(Xp.c), r3(Xn.c)] });
    ok('A. con Medir prendido no sale la barra del yunque ni se agarra nada', !(await hay('yunque-bar')) && !(await taller()).sel);
    await vistaFoto(hoja(PS1).pos, 38, 28, 150);
    await shot('01-separacion-caja.png');
    // tercer clic = vuelve a empezar en A (y de paso: la cota dibujada encima NO ataja el clic — su punta está en el centro de +X)
    r = await clicCara(Xp);
    m = r.m;
    ok('A. el tercer clic vuelve a empezar en A (y la cota no ataja el clic)', m.a && !m.b && m.a.key === PS1 && cerca(m.a.normal[0], 1, 1e-4) && m.resultado.tipo === 'area', { a: m.a && r3(m.a.normal), b: m.b });
    r = await clicCara(Yn);
    m = r.m; R = m.resultado || {};
    ok('A. caras contiguas +X y −Y → ÁNGULO = 90.0° (±0.1)', R.tipo === 'angulo' && R.unidad === '°' && cerca(R.valor, 90, 0.1) && /^90\.0°$/.test((await txt('medir-etq-cota')) || ''), { tipo: R.tipo, valor: R.valor, cota: await txt('medir-etq-cota'), panel: await txt('medir-resultado') });
    ok('A. el clic B sobre −Y cae en y = centro − d/2 (el eje Y no está cruzado ni invertido)', m.b && cerca(m.b.punto[1], Yn.c[1], 0.05) && cerca(m.b.normal[1], -1, 1e-4), { B: r3(m.b && m.b.punto), verdad: r3(Yn.c) });
    await vistaFoto(hoja(PS1).pos, 38, 28, 150);
    await shot('02-angulo-90.png');
    await limpiar();
    r = await clicCara(Yn); r = await clicCara(Yp);
    m = r.m; R = m.resultado || {}; pp = R.puntoAPunto || {};
    ok('A. caras opuestas ±Y → SEPARACIÓN = d = 50.80 mm (no confunde w con d) y ΔY = +d', R.tipo === 'separacion' && cerca(R.valor, d1.d, 0.05) && cerca(pp.dy, d1.d, 0.05), { valor: R.valor, verdad: d1.d, dy: r3(pp.dy) });
    await limpiar();
    r = await clicCara(Xp); r = await clicCara(Zp);
    m = r.m; R = m.resultado || {};
    ok('A. +X y la de arriba (+Z) → 90.0°, y el clic B en z = 125 + z + h/2', R.tipo === 'angulo' && cerca(R.valor, 90, 0.1) && m.b && cerca(m.b.punto[2], Zp.c[2], 0.05) && cerca(m.b.normal[2], 1, 1e-4), { valor: R.valor, zB: r3(m.b && m.b.punto[2]), verdad: r3(Zp.c[2]) });

    // ── B. doble clic · dos puntos de una misma cara ──
    await limpiar();
    await buscar(PS1, Xp.c, Xp.n, (x) => x.plana && Math.abs(x.area - Xp.area) < 1);
    const navAntes = await nav();
    await p.mouse.dblclick(cv.x, cv.y);
    await espera(1500);
    m = await medir();
    const navDespues = await nav();
    const seMovio = Math.hypot(navAntes.pos[0] - navDespues.pos[0], navAntes.pos[1] - navDespues.pos[1], navAntes.pos[2] - navDespues.pos[2]);
    ok('B. doble clic: llena solo A (el segundo clic idéntico se ignora), la cámara NO vuela, no sale el yunque', m.a && !m.b && seMovio < 0.01 && !(await hay('yunque-bar')) && !(await taller()).sel, { a: !!m.a, b: m.b, camaraSeMovio: +seMovio.toFixed(4) });
    await p.mouse.click(cv.x, cv.y); await espera(250);
    m = await medir();
    ok('B. otro clic en el MISMO punto de la misma cara también se ignora', m.a && !m.b, { b: m.b });
    const otro = mas(Xp.c, [0, 15, 3]);   // otro punto de la cara +X: 15 mm en Y y 3 mm en Z desde su centro
    r = await clicCara(Xp, otro);
    m = r.m; R = m.resultado || {}; pp = R.puntoAPunto || {};
    ok('B. un clic en OTRO punto de la misma cara → punto a punto dentro de la cara (≈ √(15² + 3²) = 15.30)', m.b && R.tipo === 'punto-a-punto' && cerca(pp.d, Math.hypot(15, 3), 0.6) && cerca(pp.dx, 0, 0.02) && cerca(pp.dy, 15, 0.6) && cerca(pp.dz, 3, 0.6),
      { tipo: R.tipo, pp: { d: r3(pp.d), dx: r3(pp.dx), dy: r3(pp.dy), dz: r3(pp.dz) } });

    // ── C. tenaza CUERPO: su caja ──
    await limpiar();
    await tenaza('cuerpo');
    await buscar(PS1, Zp.c, uni([0.5, -0.6, 0.6]), null);
    m = await clic(); R = m.resultado || {};
    ok('C. tenaza Cuerpo, un clic → la CAJA 25.40 × 50.80 × 10.20 (ancho × fondo × alto)', m.a && m.a.clase === 'cuerpo' && R.tipo === 'caja' && R.caja && cerca(R.caja[0], d1.w, 0.05) && cerca(R.caja[1], d1.d, 0.05) && cerca(R.caja[2], d1.h, 0.05),
      { caja: r3(R.caja), panel: await txt('medir-resultado') });
    await p.mouse.click(cv.x, cv.y); await espera(250);
    m = await medir();
    ok('C. otro clic sobre el mismo cuerpo se ignora (no hay distancia de algo a sí mismo)', m.a && !m.b);
    await vistaFoto(hoja(PS1).pos, 38, 28, 150);
    await shot('03-cuerpo-caja.png');
    await limpiar();

    // ── D. CILINDROS de 48 lados sobre la placa ──
    await tenaza('cara');
    ok('D. se aísla la placa (106 cuerpos)', (await aislar('lab-placa')) === 106);
    const C10 = cilindro('lab-placa/c10'), C11 = cilindro('lab-placa/c11'), C7 = cilindro('lab-placa/c7');
    r = await clicCilindro(C10);
    m = r.m; R = m.resultado || {};
    const errD = R.valor - 2 * C10.r;
    ok('D. un cilindro (C10, r = 15.25, 48 lados) → DIÁMETRO = 30.50 mm (±0.1) y largo = 52', m.a && m.a.clase === 'cilindro' && R.tipo === 'diametro' && cerca(R.valor, 2 * C10.r, 0.1) && cerca(m.a.largo, C10.h, 0.05) && /Ø 30\.50 mm/.test((await txt('medir-etq-cota')) || ''),
      { valor: R.valor, verdad: 2 * C10.r, errorMm: +errD.toExponential(2), flechaDelFacetadoMm: +(C10.r * (1 - Math.cos(Math.PI / 48))).toFixed(4), largo: r3(m.a && m.a.largo), arco: r3(m.a && m.a.arco), cota: await txt('medir-etq-cota') });
    const radioDelClic = m.a ? len(mas(sub(m.a.punto, C10.c), C10.eje, -dot(sub(m.a.punto, C10.c), C10.eje))) : null;
    ok('D. el eje ajustado es el del JSON (vertical, por x/y del capacitor) y el clic cae sobre su pared', m.a && Math.abs(m.a.eje[2]) > 0.999999 && cerca(m.a.puntoDelEje[0], C10.c[0], 0.002) && cerca(m.a.puntoDelEje[1], C10.c[1], 0.002) && radioDelClic <= C10.r + 0.01 && radioDelClic >= C10.r * Math.cos(Math.PI / 48) - 0.01,
      { eje: r3(m.a && m.a.eje), puntoDelEje: r3(m.a && m.a.puntoDelEje), verdad: r3(C10.c), radioDelClic: r3(radioDelClic) });
    await vistaFoto(mas(C10.c, [0, 0, 8]), 20, 32, 260);
    await shot('04-diametro.png');
    r = await clicCilindro(C11);
    m = r.m; R = m.resultado || {};
    ok('D. dos cilindros paralelos (C10 y C11) → DISTANCIA ENTRE EJES = 33.50 mm (±0.1)', R.tipo === 'entre-ejes' && cerca(R.valor, entreEjes(C10, C11), 0.1) && cerca(entreEjes(C10, C11), 33.5, 1e-9), { valor: R.valor, verdad: entreEjes(C10, C11), error: R.valor != null ? +(R.valor - entreEjes(C10, C11)).toExponential(2) : null, cota: await txt('medir-etq-cota') });
    await vistaFoto(mas(mas(C10.c, sub(C11.c, C10.c), 0.5), [0, 0, 10]), 12, 40, 280);
    await shot('05-entre-ejes.png');
    await limpiar();
    r = await clicCilindro(C10); r = await clicCilindro(C7);
    m = r.m; R = m.resultado || {}; pp = R.puntoAPunto || {};
    ok('D. cilindros a DISTINTA altura (C10 y C7) → entre ejes = la de sus x/y (130.78), sin la parte que corre a lo largo', R.tipo === 'entre-ejes' && cerca(R.valor, entreEjes(C10, C7), 0.1) && Math.abs(C10.c[2] - C7.c[2]) > 10,
      { valor: R.valor, verdad: +entreEjes(C10, C7).toFixed(4), desnivelDeCentros: r3(C7.c[2] - C10.c[2]), dzDeLosClics: r3(pp.dz) });
    // eje a cara: C7 (eje vertical) y la cara −Y de PS1 (vertical): el eje corre paralelo a la cara
    r = await clicCara(Yn, mas(Yn.c, [8, 0, 1]));   // tercer clic: A = la cara
    r = await clicCilindro(C7);
    m = r.m; R = m.resultado || {};
    const ejeACara = Math.abs(dot(sub(C7.c, Yn.c), Yn.n));
    await vistaFoto(mas(C7.c, [6, 4, 0]), 28, 52, 200);
    await shot('05b-eje-a-cara.png');
    ok('D. cilindro y cara plana con el eje paralelo a la cara (C7 y −Y de PS1) → EJE A CARA = 6.00 mm', R.tipo === 'eje-a-cara' && cerca(R.valor, ejeACara, 0.1) && cerca(ejeACara, 6, 1e-6), { valor: R.valor, verdad: ejeACara, notas: R.notas });
    await limpiar();
    // dos cuerpos: distancia entre los centros de sus cajas
    await tenaza('cuerpo');
    r = await clicCilindro(C10);
    await buscar(PS1, Zp.c, uni([0.3, -0.5, 0.8]), null);
    m = await clic(); R = m.resultado || {};
    const centros = len(sub(hoja(PS1).pos, C10.c));
    ok('D. tenaza Cuerpo, dos cuerpos (C10 y PS1) → distancia entre los centros de sus cajas', m.a && m.b && m.a.clase === 'cuerpo' && R.tipo === 'centros' && cerca(R.valor, centros, 0.05), { valor: R.valor, verdad: +centros.toFixed(4) });
    await limpiar();
    await tenaza('pieza');
    await buscar(PS1, Zp.c, uni([0.3, -0.5, 0.8]), null);
    m = await clic(); R = m.resultado || {};
    ok('D. tenaza Pieza → la caja del módulo entero (la placa)', m.a && m.a.clase === 'pieza' && m.a.key === 'lab-placa' && R.tipo === 'caja' && R.caja && R.caja.every((v) => v > 50), { caja: r3(R.caja), nombre: m.a && m.a.nombre });
    await limpiar();
    // …y la misma caja contra lo que dice el AGARRE de siempre (código de BASE, no el de medir) con Medir apagado
    const cajaPieza = R.caja;
    await p.click('[data-testid="medir-toggle"]'); await espera(250);
    await p.mouse.click(cv.x, cv.y); await espera(400);
    const agarre = await p.evaluate(() => { const t = window.__forgeBrep.taller; return t.agarre && { que: t.agarre.que, dato: t.agarre.dato }; });
    const deBase = agarre && (agarre.dato.match(/\d+/g) || []).slice(0, 3).map(Number);
    ok('D. la caja de la Pieza coincide con la del agarre de BASE (Medir apagado), al milímetro', agarre && agarre.que === 'Pieza' && deBase.length === 3 && cajaPieza && deBase.every((v, k) => Math.abs(v - cajaPieza[k]) <= 0.51), { agarreDeBase: agarre && agarre.dato, medir: r3(cajaPieza) });
    await p.keyboard.press('Escape'); await espera(200);
    await p.click('[data-testid="medir-toggle"]'); await espera(250);
    await tenaza('cara');

    // ── E. dos cilindros que comparten eje (el hongo del paro y su cuello) ──
    ok('E. se aísla el paro de emergencia', (await aislar('lab-cuerpo/paro')) === 3);
    const HON = cilindro('lab-cuerpo/paro/hongo'), CUE = cilindro('lab-cuerpo/paro/cuello');
    r = await clicCilindro(HON); r = await clicCilindro(CUE);
    m = r.m; R = m.resultado || {};
    ok('E. hongo Ø40 y cuello Ø22 comparten eje → entre ejes = 0.00 (y sus diámetros)', R.tipo === 'entre-ejes' && cerca(R.valor, 0, 0.01) && cerca(m.a.diametro, 40, 0.1) && cerca(m.b.diametro, 22, 0.1), { valor: R.valor, dA: r3(m.a && m.a.diametro), dB: r3(m.b && m.b.diametro), notas: R.notas });
    await limpiar();

    // ── F. piezas GIRADAS (el módulo del alambre) ──
    ok('F. se aísla el módulo del alambre (40 cuerpos)', (await aislar('lab-alambre')) === 40);
    const E7 = 'lab-alambre/alambre-escudo-espina-empuje-7', EAB = 'lab-alambre/alambre-escudo-carrete-abajo';
    const inclinada = [caraDeCaja(E7, 2, 1), caraDeCaja(E7, 2, -1)], acostada = [caraDeCaja(EAB, 2, 1), caraDeCaja(EAB, 2, -1)];
    const clicUna = async (opciones) => { let ult = null; for (const c of opciones) { try { return { c, ...(await clicCara(c)) }; } catch (e) { ult = e; } } throw ult; };
    const giro = hoja(E7).r.rx;
    let ra = await clicUna(inclinada), rb = await clicUna(acostada);
    m = rb.m; R = m.resultado || {};
    ok('F. escudo girado −45° en X contra un escudo acostado → ÁNGULO = 45.0° (±0.1)', Math.abs(giro) === 45 && R.tipo === 'angulo' && cerca(R.valor, 45, 0.1) && cerca(Math.abs(dot(m.a.normal, ra.c.n)), 1, 1e-4),
      { rxDelJSON: giro, valor: R.valor, normalA: r3(m.a && m.a.normal), verdadA: r3(ra.c.n), cota: await txt('medir-etq-cota') });
    await vistaFoto(mas(ra.c.c, sub(rb.c.c, ra.c.c), 0.5), 60, 20, 420);
    await shot('06-angulo-45-girado.png');
    await limpiar();
    // cilindros ACOSTADOS (rx 90): van tapados dentro del módulo, así que cada uno se aísla para tocarlo — la medida
    // sigue viva aunque lo medido deje de verse
    const EJE = cilindro('lab-alambre/alambre-eje'), KSD = cilindro('lab-alambre/alambre-ksd301'), CUELLO = cilindro('lab-alambre/alambre-cuello');
    await aislar(EJE.key);
    r = await clicCilindro(EJE);
    m = r.m;
    ok('F. cilindro acostado (rx 90): su eje sale a lo largo de Y, su Ø = 5.00 y su largo = 24', hoja(EJE.key).r.rx === 90 && m.a && m.a.clase === 'cilindro' && Math.abs(m.a.eje[1]) > 0.99999 && cerca(m.a.diametro, 2 * EJE.r, 0.1) && cerca(m.a.largo, EJE.h, 0.05) && Math.abs(EJE.eje[1]) > 0.99999,
      { eje: r3(m.a && m.a.eje), verdad: r3(EJE.eje), d: m.a && m.a.diametro, largo: r3(m.a && m.a.largo) });
    await aislar(KSD.key);
    r = await clicCilindro(KSD);
    m = r.m; R = m.resultado || {};
    ok('F. dos cilindros acostados y corridos a lo largo (eje del NEMA y KSD301) → entre ejes = 37.32 mm', R.tipo === 'entre-ejes' && cerca(R.valor, entreEjes(EJE, KSD), 0.1) && Math.abs(dot(sub(KSD.c, EJE.c), EJE.eje)) > 10,
      { valor: R.valor, verdad: +entreEjes(EJE, KSD).toFixed(4), corridoALoLargo: r3(dot(sub(KSD.c, EJE.c), EJE.eje)) });
    await limpiar();
    await aislar(EJE.key);
    r = await clicCilindro(EJE);
    await aislar(CUELLO.key);
    r = await clicCilindro(CUELLO);
    m = r.m; R = m.resultado || {};
    ok('F. un eje acostado y uno parado (eje del NEMA y cuello) → ángulo entre ejes = 90.0°', R.tipo === 'angulo' && cerca(R.valor, 90, 0.1) && Math.abs(dot(EJE.eje, CUELLO.eje)) < 1e-9, { valor: R.valor, titulo: R.titulo });

    // ── I. UNA PIEZA IMPRESA: malla FMSH teselada por OCCT (no una primitiva): sus cilindros contra los del STEP ──
    await limpiar();
    const EC = hoja('lab-alambre/alambre-eje-carrete');
    const radios = radiosDelStep(EC.r.url), cajaEC = cajaFmsh(EC.r.url), centroEC = mas(EC.pos, apl(EC.R, cajaEC.centro));
    ok('I. se aísla el eje del carrete (pieza impresa: su .bin y su .step)', (await aislar(EC.key)) === 1 && EC.r.kind === 'malla' && radios.length >= 2, { radiosDelSTEP: radios, cajaDeLaMalla: r3(cajaEC.tam) });
    const curvas = new Map();
    for (const d of [[0.2, -1, 0.6], [-0.2, 1, 0.6], [1, -0.4, 0.5], [-1, 0.4, 0.5], [0.1, 0.2, -1]]) {
      await apuntar(centroEC, d, 160);
      for (let gy = -3; gy <= 3; gy++) for (let gx = -5; gx <= 5; gx++) {
        const x = cv.x + gx * 42, y = cv.y + gy * 42;
        await p.mouse.move(x, y);
        const h = await p.evaluate(() => { const t = window.__forgeBrep.taller, hv = t.hover; if (!hv || hv.cara == null) return null; const c = t.cara(hv.key, hv.cara); return { key: hv.key, cara: hv.cara, plana: c && c.plana }; });
        if (!h || h.key !== EC.key || h.plana || curvas.has(h.cara)) continue;
        await p.mouse.click(x, y); await espera(220);
        m = await medir();
        curvas.set(h.cara, m.a && m.a.cara === h.cara ? { clase: m.a.clase, que: m.a.que, r: m.a.diametro != null ? m.a.diametro / 2 : null, largo: m.a.largo, arco: m.a.arco } : { clase: 'sin-medir' });
        await limpiar();
      }
    }
    const cils = [...curvas.values()].filter((c) => c.clase === 'cilindro');
    const errR = cils.map((c) => Math.min(...radios.map((q) => Math.abs(q - c.r))));
    ok('I. sus caras curvas salen como cilindros y CADA radio es uno de los del STEP (±0.005 mm)', cils.length >= 2 && cils.length === curvas.size && errR.every((e) => e < 0.005),
      { carasCurvasTocadas: curvas.size, cilindros: cils.map((c) => `${c.que} r=${c.r.toFixed(4)} largo=${c.largo.toFixed(2)} arco=${c.arco.toFixed(0)}°`), errorMaxMm: +Math.max(...errR).toExponential(2), radiosDelSTEP: radios });
    ok('I. el cuerpo del eje: Ø 15.50 × 53 (r 7.75 del STEP)', cils.some((c) => Math.abs(c.r - 7.75) < 0.005 && Math.abs(c.largo - 53) < 0.05 && c.arco > 300), cils.filter((c) => Math.abs(c.r - 7.75) < 0.05).map((c) => ({ r: c.r, largo: c.largo, arco: r3(c.arco) })));

    // ── J. EL AFINADO DEL EJE: cilindros recortados en diagonal de la columna impresa. Sus facetas no corren a lo largo del
    // eje, así que el eje que sale de las normales queda ~0.1° chueco: sin afinar, el círculo deja un residuo de 0.005–0.007 mm
    // (arriba del corte) y el radio sale 34.753 / 45.254. Solo si el afinado funciona salen «cilindro» con el radio del STEP. ──
    await limpiar();
    const COL = hoja('lab-cuerpo/cuerpo-col-1'), radiosCol = radiosDelStep(COL.r.url), curvasCol = carasCurvasFmsh(COL.r.url).slice(0, 4);
    const fantasma = COL.r.rayos !== undefined && COL.r.rayos < 0.35;
    if (fantasma) { await p.click('[data-testid="ref-rayos"]'); await espera(400); }   // con rayos X la columna es fantasma: no se deja tocar
    ok('J. se aísla la columna 1 (pieza impresa) y su STEP trae R 34.75 y 45.25', (await aislar(COL.key)) === 1 && radiosCol.includes(34.75) && radiosCol.includes(45.25) && curvasCol.length === 4, { radiosDelSTEP: radiosCol, carasCurvasMasGrandes: curvasCol.map((c) => +c.area.toFixed(1)) });
    const medidasCol = [];
    for (const c of curvasCol) {
      const P = mas(COL.pos, apl(COL.R, c.c)), n = apl(COL.R, c.n);
      try {
        await buscar(COL.key, P, n, (x) => x.plana === false && Math.abs(x.area - c.area) < Math.max(0.5, c.area * 0.01), 240, [n, ...porTodosLados(n)]);   // ESA cara, por su área
        m = await clic();
        medidasCol.push(m.a ? { area: c.area, clase: m.a.clase, que: m.a.que, r: m.a.diametro != null ? m.a.diametro / 2 : null, largo: m.a.largo, arco: m.a.arco } : { area: c.area, clase: 'sin-medir' });
      } catch (e) { medidasCol.push({ area: c.area, clase: 'no-la-vi' }); }
      await limpiar();
    }
    const cilCol = medidasCol.filter((c) => c.clase === 'cilindro');
    const errCol = cilCol.map((c) => Math.min(...radiosCol.map((q) => Math.abs(q - c.r))));
    const describe = medidasCol.map((c) => `${c.area.toFixed(0)} mm² → ${c.clase === 'cilindro' ? `${c.que} r=${c.r.toFixed(4)} largo=${c.largo.toFixed(3)} arco=${c.arco.toFixed(0)}°` : c.clase}`);
    ok('J. las caras curvas que se dejan ver salen «cilindro» con un radio del STEP (±0.001 mm)', cilCol.length >= 2 && medidasCol.every((c) => c.clase === 'cilindro' || c.clase === 'no-la-vi') && errCol.every((e) => e < 0.001),
      { medidas: describe, errorMaxMm: errCol.length ? +Math.max(...errCol).toExponential(2) : null });
    // la cara de 689 mm² es la que NECESITA el afinado: con el eje de las puras normales da R 45.254, largo 10.557 y un
    // residuo de 0.0050 mm, arriba del corte de 0.0045 (medido fuera del navegador, con las mismas fórmulas) → «cara curva»
    const recortada = medidasCol[0];
    ok('J. el arco recortado de 689 mm² sale cilindro con R = 45.250 y largo = 10.500 (solo si el afinado del eje funciona)', recortada && recortada.clase === 'cilindro' && Math.abs(recortada.r - 45.25) < 0.001 && Math.abs(recortada.largo - 10.5) < 0.005,
      recortada && recortada.clase === 'cilindro' ? { r: recortada.r, largo: recortada.largo, arco: r3(recortada.arco), tambienR3475: cilCol.some((c) => Math.abs(c.r - 34.75) < 0.001) } : recortada);
    if (fantasma) { await p.click('[data-testid="ref-rayos"]'); await espera(400); }

    // ── K. una cara curva que NO es cilindro: la bobina L1 (un tubo de 14 lados a lo largo de una hélice) ──
    const L1 = hoja('lab-placa/l1'), camino = L1.r.path.map((q) => mas(L1.pos, apl(L1.R, q)));
    const largoL1 = camino.slice(1).reduce((a, q, i) => a + len(sub(q, camino[i])), 0), areaL1 = 14 * 2 * L1.r.r * Math.sin(Math.PI / 14) * largoL1;
    const cMin = [0, 1, 2].map((k) => Math.min(...camino.map((q) => q[k]))), cMax = [0, 1, 2].map((k) => Math.max(...camino.map((q) => q[k])));
    ok('K. se aísla la bobina L1 (en el JSON es un tubo)', (await aislar(L1.key)) === 1 && L1.r.kind === 'tubo', { vueltasDeCamino: camino.length, largoMm: +largoL1.toFixed(1) });
    let tocada = null;
    for (const d of [[0.3, -1, 0.5], [1, 0.2, 0.4], [-0.3, 1, 0.5]]) {
      await apuntar(mas(cMin, sub(cMax, cMin), 0.5), d, 260);
      for (let gy = -3; gy <= 3 && !tocada; gy++) for (let gx = -4; gx <= 4 && !tocada; gx++) {
        const x = cv.x + gx * 30, y = cv.y + gy * 30;
        await p.mouse.move(x, y);
        const h = (await taller()).hover;
        if (h && h.key === L1.key && h.cara != null) { await p.mouse.click(x, y); await espera(250); tocada = await medir(); }
      }
      if (tocada) break;
    }
    R = (tocada && tocada.resultado) || {};
    const panelK = (await txt('medir-resultado')) || '';
    ok('K. la bobina es «cara curva»: da su ÁREA (≈ perímetro del tubo × largo del camino) y NO un diámetro', tocada && tocada.a && tocada.a.clase === 'curva' && tocada.a.diametro === null && R.tipo === 'area' && R.unidad === 'mm²' && Math.abs(R.valor / areaL1 - 1) < 0.02 && /No es un cilindro/.test(panelK) && !(await hay('medir-etq-cota')),
      { clase: tocada && tocada.a && tocada.a.clase, tipo: R.tipo, area: R.valor && +R.valor.toFixed(1), areaDelJSON: +areaL1.toFixed(1), panel: panelK });
    await limpiar();

    // ── H. en el laboratorio COMPLETO (nada aislado, rayos X prendidos): la placa de trabajo y la tapa del hongo del paro ──
    await limpiar();
    await p.click('[data-testid="taller-desaislar"]'); await espera(500);
    let tl = await taller();
    ok('H. se muestra todo el laboratorio', tl.visibles === tl.total && !tl.aislado, `${tl.visibles}/${tl.total}`);
    const PL = caraDeCaja('lab-cuerpo/placa-acero', 2, 1), HG = hoja('lab-cuerpo/paro/hongo');
    const tapa = { key: HG.key, n: [0, 0, 1], c: mas(HG.pos, [0, 0, HG.r.h / 2]), area: 0.5 * 48 * HG.r.r ** 2 * Math.sin((2 * Math.PI) / 48) };   // la tapa es un polígono de 48 lados
    const enPlaca = mas(PL.c, [48, -48, 0]);
    r = await clicCara(PL, enPlaca);
    r = await clicCara(tapa);
    m = r.m; R = m.resultado || {}; pp = R.puntoAPunto || {};
    const escalon = tapa.c[2] - PL.c[2];
    ok('H. sin aislar nada: de la placa de trabajo a la tapa del hongo del paro → separación = 5.00 mm (sus z y alturas del JSON)', R.tipo === 'separacion' && cerca(R.valor, escalon, 0.05) && cerca(escalon, 5, 1e-9) && cerca(pp.dz, escalon, 0.05) && cerca(m.a.punto[2], Z0_LAB, 0.05),
      { valor: R.valor, verdad: escalon, dz: r3(pp.dz), zDeLaPlaca: r3(m.a && m.a.punto[2]), A: m.a && m.a.nombre, B: m.b && m.b.nombre });
    await vistaFoto(mas(enPlaca, sub(tapa.c, enPlaca), 0.55), 24, 38, 330);
    await shot('07-en-el-laboratorio.png');

    // ── G. Esc y apagar ──
    await p.keyboard.press('Escape'); await espera(250);
    m = await medir();
    ok('G. Esc limpia la medida y Medir sigue prendido', m.on === true && !m.a && !m.b && !m.resultado && !(await hay('medir-cota')) && (await hay('medir-panel')));
    await p.keyboard.press('Escape'); await espera(250);
    m = await medir();
    ok('G. el segundo Esc apaga Medir (se va el panel)', m.on === false && !(await hay('medir-panel')) && (await p.$eval('[data-testid="medir-toggle"]', (e) => e.getAttribute('aria-pressed'))) === 'false');
    await p.click('[data-testid="medir-toggle"]'); await espera(200);
    r = await clicCara(PL, enPlaca);
    ok('G. (se vuelve a prender y a medir)', r.m.on && !!r.m.a);
    await p.click('[data-testid="medir-toggle"]'); await espera(250);
    m = await medir();
    ok('G. apagar Medir con el botón limpia la medida', m.on === false && !m.a && !m.resultado && !(await hay('medir-cota')));
    // con Medir apagado, lo de BASE: el clic agarra para el yunque y el doble clic vuela la cámara
    ok('G. se regresa a la placa aislada', (await aislar(PS1)) === 1);
    await buscar(PS1, Xp.c, uni([1, -0.7, 0.5]), (x) => x.plana && Math.abs(x.area - Xp.area) < 1);
    await p.mouse.click(cv.x, cv.y); await espera(400);
    let t = await taller();
    ok('G. Medir apagado: el clic AGARRA la cara y sale la barra del yunque (como en BASE)', t.sel && t.sel.key === PS1 && t.sel.nivel === 'cara' && (await hay('yunque-bar')) && !(await medir()).a, { sel: t.sel });
    await p.keyboard.press('Escape'); await espera(700);
    const n0 = await nav();
    await p.mouse.dblclick(cv.x, cv.y);
    await espera(1900);
    const n1 = await nav();
    t = await taller();
    const volo = Math.hypot(n0.pos[0] - n1.pos[0], n0.pos[1] - n1.pos[1], n0.pos[2] - n1.pos[2]);
    ok('G. Medir apagado: el doble clic vuela la cámara y deja la cara de frente (como en BASE)', volo > 5 && t.sel && t.sel.key === PS1, { camaraSeMovio: +volo.toFixed(1) });
    await p.keyboard.press('Escape'); await espera(200);
  } catch (e) {
    ok('sin excepción', false, String(e && e.stack ? e.stack : e).slice(0, 500));
    await shot('zz-falla.png').catch(() => {});
  }
  ok('sin errores de página', errs.length === 0, redExterna.length ? { errores: errs.slice(0, 6), redExternaQueNoCuenta: redExterna.slice(0, 4) } : errs.slice(0, 6));
  fs.writeFileSync(path.join(OUT, 'medir-verify.json'), JSON.stringify({ url: URL, checks, errs }, null, 2));
  const fallas = checks.filter((c) => !c.pasa).length;
  console.log(`\nMEDIR_VERIFY: ${fallas ? 'FALLA' : 'PASA'} (${checks.length - fallas}/${checks.length}) · capturas en ${OUT}`);
  await b.close();
  process.exit(fallas ? 1 : 0);
})();
