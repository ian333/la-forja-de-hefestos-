#!/usr/bin/env node
/**
 * LA HUELLA — gate de determinismo EN EL NAVEGADOR (orden 2026-10-24-d-el-qa-real)
 * ============================================================================
 * Juez C, disputa D4: «el certificado corre en el BUILD DEL NAVEGADOR (node tesela y orienta distinto); por commit: pruebas
 * puras + hash de `moldGeom()` de 1594C ×3, ningún reloj». Este script carga la pieza en la app REAL (la URL que le des: tu
 * copia en iangpu, de preferencia un build de producción), camina el camino de la carcasa (soltar → enfriamiento → dictamen →
 * partición → MOLDE) en TIEMPO REAL, espera el portamoldes (E8) y saca una HUELLA:
 *   · la pieza: invariantes del kernel (caras, aristas, χ, volumen exacto, área, triángulos)
 *   · el molde, POR CUERPO: rol, nombre, caja, triángulos y VOLUMEN CON SIGNO de su malla (0.01) — una broca que no entró, un
 *     agua que no cortó o un inserto hueco no mueven la caja de su placa, pero sí su volumen (el cubo salió verde con placas
 *     VACÍAS, R93)
 *   · lo que la leyenda del molde declara (estación, roles, pared medida, pines con su largo, juez pin↔agua, carrera)
 *   · el Foco del molde (barrenos, pares eje a eje, hallazgos con su holgura)
 * Todo redondeado a 0.01, en JSON canónico (llaves ordenadas) → SHA-256. Corre N veces (3 por defecto), cada una en un
 * NAVEGADOR FRESCO: los N hashes iguales = VERDE; distintos = ROJO con el diff de qué cuerpo/llave cambió.
 * Lo que caza: el reloj virtual congelado del 2026-10-23 (la E2 corría con la pieza MACIZA: molde de otra pieza, 0 pines) y
 * cualquier carrera de temporizadores / orden de promesas que cambie el acero entre dos corridas del mismo commit.
 * Los TIEMPOS se anotan (para el acta) pero no se juzgan: en GPU compartida los relojes son clima (pm-cad), van de noche.
 *
 * uso (iangpu, receta GPU, dentro del turno):
 *   flock /home/ian/el-plan/gpu.lock env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *     NODE_PATH=/home/ian/Orkesta/la-forja/node_modules URL=http://localhost:4270/forja-brep.html \
 *     node scripts/qa-huella.cjs ["test-parts/inyeccion-reales/1594C Box.stp"] [--n 3] [--out <dir>] [--control] [--volcado]
 *   --control: una corrida MÁS con la falla conocida (reloj virtual congelado antes de MOLDE): su huella DEBE salir distinta
 *   salida: <out>/corrida-<k>.json (huella + dorados medidos + tiempos) · <out>/huella.json (veredicto) · exit 0 VERDE / 1 ROJO / 2 no vale
 *
 * Lo usan también qa-dorados.cjs (los números de la MISMA corrida) y qa-banco.cjs (una pieza por navegador fresco).
 * Necesita `window.__qaForja` (ForgeBRepStudio.tsx, ENMIENDA de la orden D): referencias vivas al ciclo, al dictamen y a las mallas.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..');
const W = 1536, H = 864, DPR = 2.5;   // la laptop de ian (1920×1080 al 125 %) → captura 3840×2160 real
const CHROME_ARGS = ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=gl',
  '--disable-software-rasterizer', '--hide-scrollbars'];
const T0 = Date.now();
const ts = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + ' s';
const log = (...a) => console.log(ts(), ...a);

// ── el navegador ────────────────────────────────────────────────────────────
async function lanza() {
  const { chromium } = require('playwright');
  return chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable', args: CHROME_ARGS });
}
/** un contexto con la página de la Forja abierta y su API lista; junta los errores de la página */
/** EL RELOJ VIRTUAL de la filmadora, el MISMO código (se lee de scripts/filma-camino.cjs, no se copia): solo para el PAR DE
 *  CONTROL de la huella — reproduce la carrera del 2026-10-23 (reloj congelado antes de MOLDE → la E2 corre con la pieza MACIZA) */
function relojVirtualFuente() {
  const src = fs.readFileSync(path.join(__dirname, 'filma-camino.cjs'), 'utf8');
  const m = src.match(/\nconst RELOJ_VIRTUAL = (\(\) => \{[\s\S]*?\n\});\n/);
  if (!m) throw new Error('no encontré RELOJ_VIRTUAL en filma-camino.cjs (¿cambió de forma?)');
  return `(${m[1]})();`;
}
async function abre(browser, url, { relojVirtual = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  if (relojVirtual) await page.addInitScript({ content: relojVirtualFuente() });
  const errores = [];
  page.on('pageerror', (e) => errores.push('PAGEERR ' + String(e).slice(0, 240)));
  page.on('console', (m) => { const t = m.text(); if (/Failed to load resource/.test(t)) return; if (m.type() === 'error' || /WebGL context|CONTEXT_LOST/i.test(t)) errores.push(`console.${m.type()} ${t.slice(0, 240)}`); });
  // (la telemetría /api/telemetry no tiene servidor en un `vite preview`: su 404 es ruido, no un recurso que falte)
  page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/telemetry\//.test(r.url())) errores.push(`HTTP ${r.status()} ${r.url().slice(0, 200)}`); });   // el 404 con SU url, no el «Failed to load resource» mudo
  const cdp = await ctx.newCDPSession(page);
  const t = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  // `__forgeBrep.ready` se queda en false en reposo aunque la API esté completa (filma-camino, 2026-10-22): se espera la API
  await page.waitForFunction('window.__forgeBrep && Object.keys(window.__forgeBrep).length > 50', null, { timeout: 180000, polling: 250 });
  const gpu = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
  await page.waitForTimeout(1500);
  return { ctx, page, cdp, errores, gpu, msCarga: Date.now() - t };
}
/** ¿la corrida vale? GPU real (no SwiftShader/llvmpipe) y sin «Error creating WebGL context» (INSTRUCCIONES-COMUNES §5) */
function corridaVale(s) {
  if (!/NVIDIA|D3D12/i.test(s.gpu) || /SwiftShader|llvmpipe/i.test(s.gpu)) return `GPU equivocada: ${s.gpu}`;
  const wg = s.errores.find((e) => /Error creating WebGL context|CONTEXT_LOST/i.test(e));
  return wg ? `WebGL: ${wg}` : '';
}
/** suelta un archivo sobre la Forja como lo haría ian (DragEvent con un File real) */
async function suelta(page, archivo, nombre = path.basename(archivo)) {
  const b64 = fs.readFileSync(archivo).toString('base64');
  await page.evaluate(({ b64, name }) => {
    const el = document.querySelector('.fb-root'); const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    const dt = new DataTransfer(); dt.items.add(new File([u8], name));
    for (const t of ['dragenter', 'dragover', 'drop']) el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { b64, name: nombre });
}
const clic = (page, id) => page.evaluate((id) => { const b = document.querySelector(`[data-testid="${id}"]`); if (b) b.click(); return !!b; }, id);
const espera = (page, expr, ms) => page.waitForFunction(expr, null, { timeout: ms, polling: 250 });
/** still 4K del estado actual (CDP con clip.scale: sin clip baja a 1080) */
async function still(cdp, archivo) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: W, height: H, scale: DPR } });
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, Buffer.from(data, 'base64'));
  return archivo;
}
/** el texto que el cliente VE: nodos de texto cuyo elemento es visible (opacidad > 0 en toda la cadena — el modo camino deja
 *  los paneles en el DOM con opacidad 0 —, visibility, caja no vacía y dentro de la ventana). Un aviso escondido no cuenta. */
const textoVisible = (page) => page.evaluate(() => {
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = (n.textContent || '').trim(); const el = n.parentElement; if (!t || !el) continue;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
    out.push(t);
  }
  return out.join(' ').replace(/\s+/g, ' ');
});

// ── el camino (lo mismo que hacen camino-runner y filma-camino, en tiempo real) ───────────────────────────────────────
/**
 * Camina la pieza hasta `hasta` ('pieza' | 'molde'). Devuelve los tiempos por paso (ms reales: se anotan, no se juzgan) y
 * dónde se detuvo. No lanza: si un paso no llega, lo dice en `rompe` (eso lo juzga quien llama).
 */
async function camino(page, archivo, { hasta = 'molde', reloj = 'real', log: L = log } = {}) {
  const ms = {}; let t = Date.now(); const marca = (k) => { ms[k] = Date.now() - t; t = Date.now(); };
  const res = { ms, rompe: '' };
  await suelta(page, archivo);
  try { await espera(page, `!!document.querySelector('[data-testid="el-parte-foco"]')`, 240000); }
  catch (e) { res.rompe = 'la pieza no apareció (el-parte-foco) en 240 s'; return res; }
  marca('soltar');
  await page.waitForTimeout(2500);
  res.avisoEntrada = await clic(page, 'aviso-entrada-ok');
  if (hasta === 'pieza') return res;
  // 3 · enfriamiento
  await clic(page, 'parte-lente-enfriamiento');
  try { await espera(page, `!!document.querySelector('[data-testid="escala-enfriamiento"]')`, 180000); marca('enfriamiento'); }
  catch (e) { res.rompe = 'el enfriamiento no llegó (escala-enfriamiento) en 180 s'; return res; }
  await page.waitForTimeout(1200);
  // 4 · dictamen (tecla D)
  await page.keyboard.press('d');
  try { await espera(page, `!!document.querySelector('[data-testid="lamina-dictamen"]')`, 60000); marca('dictamen'); }
  catch (e) { res.rompe = 'el dictamen no llegó (lamina-dictamen) en 60 s'; return res; }
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  // 5 · partición
  await clic(page, 'parte-lente-particion');
  try { await espera(page, `!!document.querySelector('[data-testid="linea-particion"]')`, 30000); marca('particion'); }
  catch (e) { res.rompe = 'la partición no llegó (linea-particion) en 30 s'; return res; }
  await page.waitForTimeout(800);
  // 6 · MOLDE: hasta el portamoldes (E8). El seguro de la filmadora: un molde de ESTA pieza trae pines por agarre.
  if (reloj === 'congelado') {
    // EL PAR DE CONTROL (la falla conocida, NO el camino bueno): el reloj virtual encendido y CONGELADO desde ANTES del clic,
    // soltado de 0.5 s en 0.5 s — lo que hacía la filmadora hasta el 2026-10-23 y sacaba el molde de OTRA pieza.
    // (la versión 6f4cf2a: el clic y el primer `avanza` SIN los 40 ms reales que hoy deja la filmadora para que React asiente)
    await page.evaluate(async () => { window.__vt.enciende(); window.__vt.congela(true); document.querySelector('[data-testid="parte-lente-molde"]').click();
      window.__vt.congela(false); await window.__vt.avanza(500); window.__vt.congela(true); });
    let listo = false;
    for (let g = 0; g < 1500 && !listo; g++) {
      await page.evaluate(async (ms) => { window.__vt.congela(false); await window.__vt.avanza(ms); window.__vt.congela(true); }, 500);
      await page.waitForTimeout(60);
      listo = await page.evaluate(() => document.querySelector('[data-testid="molde-de-la-pieza"]')?.dataset.portamoldes === '1');
    }
    await page.evaluate(() => { window.__vt.congela(false); window.__vt.apaga(); });
    marca('molde');
    if (!listo) { res.rompe = 'control: con el reloj congelado el molde no llegó al portamoldes'; }
    await page.waitForTimeout(2500);
    res.pines = await page.evaluate(() => document.querySelector('[data-testid="molde-de-la-pieza"]')?.dataset.pinesIds || '');
    if (!res.pines && !res.rompe) res.rompe = 'MOLDE_SOSPECHOSO: la E7 no trae pines por agarre — el molde no es de esta pieza';
    return res;
  }
  await clic(page, 'parte-lente-molde');
  try {
    await espera(page, `(() => { const m = document.querySelector('[data-testid="molde-de-la-pieza"]'); return m && m.dataset.portamoldes === '1'; })()`, 600000);
    marca('molde');
  } catch (e) {
    res.estacion = await page.evaluate(() => document.querySelector('[data-testid="molde-de-la-pieza"]')?.dataset.estacion ?? null);
    res.rompe = `el molde no llegó al portamoldes en 600 s (estación ${res.estacion})`; return res;
  }
  // que asienten los efectos del último commit (el ciclo arranca su lazo; el Foco re-escanea)
  await page.waitForTimeout(2500);
  res.pines = await page.evaluate(() => document.querySelector('[data-testid="molde-de-la-pieza"]')?.dataset.pinesIds || '');
  if (!res.pines) res.rompe = 'MOLDE_SOSPECHOSO: la E7 no trae pines por agarre — el molde no es de esta pieza';
  return res;
}

// ── la huella ───────────────────────────────────────────────────────────────
/** se evalúa DENTRO de la página: todo lo que define a la pieza y a su molde, redondeado a 0.01 */
function huellaEnPagina() {
  const Q = window.__qaForja, F = window.__forgeBrep;
  if (!Q) return { error: 'no existe window.__qaForja (falta la línea de la orden D en ForgeBRepStudio.tsx)' };
  const r2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : v);
  const inv = F.invariants;
  const pieza = inv ? { caras: inv.faces, aristas: inv.edges, vertices: inv.vertices, euler: inv.euler, volKernel: r2(inv.vol_kernel),
    area: r2(inv.area), tris: inv.tris, nCaras: inv.n_faces } : null;
  // POR CUERPO (no por rol: la caja de un rol de 4 retornos mintió «30.00» y «6.34», INSTRUCCIONES §5)
  const cuerpos = (Q.moldParts || []).map((pt) => {
    const P = pt.positions, I = pt.indices; let v = 0; const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < mn[k]) mn[k] = P[i + k]; if (P[i + k] > mx[k]) mx[k] = P[i + k]; }
    const tri = (a, b, c) => P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
    let nt = 0;
    if (I && I.length) { nt = I.length / 3; for (let t = 0; t < I.length; t += 3) v += tri(3 * I[t], 3 * I[t + 1], 3 * I[t + 2]); }
    else { nt = P.length / 9; for (let t = 0; t < P.length; t += 9) v += tri(t, t + 3, t + 6); }
    return { rol: pt.role, nombre: pt.name, tris: nt, vertices: P.length / 3, vol: r2(v / 6), min: mn.map(r2), max: mx.map(r2) };
  }).sort((a, b) => (a.rol + '|' + a.nombre).localeCompare(b.rol + '|' + b.nombre) || a.vol - b.vol);
  const m = document.querySelector('[data-testid="molde-de-la-pieza"]'); const d = m ? m.dataset : {};
  const leyenda = m ? { estacion: +d.estacion, roles: (d.roles || '').split(' ').filter(Boolean).sort(), pared: d.pared, partes: +d.partes, tris: +d.tris,
    pinesIds: d.pinesIds, pinesLlave: d.pinesLlave, pinAgua: d.pinAgua, pinAguaAntes: d.pinAguaAntes, pinAguaCamino: d.pinAguaCamino,
    pisoVsPared: d.pisoVsPared, equilibrio: d.equilibrio, carreraLibre: d.carreraLibre, carreraPedida: d.carreraPedida, portamoldes: d.portamoldes } : null;
  let foco = null;
  try {
    const f = F.focoMolde();
    if (f) foco = { cilindros: (f.cilindros || []).length, pares: f.pares,
      hallazgos: (f.hallazgos || []).map((h) => { const o = {}; for (const [k, v] of Object.entries(h)) if (typeof v !== 'object' || v === null) o[k] = r2(v); return o; })
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
  } catch (e) { foco = { error: String(e).slice(0, 160) }; }
  return { pieza, leyenda, cuerpos, foco };
}
/** JSON canónico (llaves ordenadas, recursivo) → lo que se firma */
function canon(x) {
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
  return JSON.stringify(x === undefined ? null : x);
}
const sha = (x) => crypto.createHash('sha256').update(canon(x)).digest('hex');
/** qué cambió entre dos huellas, por CUERPO (rol|nombre) y por llave */
function diffHuellas(a, b) {
  const out = [];
  for (const k of ['pieza', 'leyenda', 'foco', 'dorados']) {
    const A = a[k] || {}, B = b[k] || {};
    for (const kk of new Set([...Object.keys(A), ...Object.keys(B)])) if (canon(A[kk]) !== canon(B[kk])) out.push(`${k}.${kk}: ${canon(A[kk]).slice(0, 120)} → ${canon(B[kk]).slice(0, 120)}`);
  }
  const idx = (L) => { const m = new Map(); for (const c of L || []) { let key = `${c.rol}|${c.nombre}`; let j = 1; while (m.has(key)) key = `${c.rol}|${c.nombre}#${++j}`; m.set(key, c); } return m; };
  const A = idx(a.cuerpos), B = idx(b.cuerpos);
  for (const key of new Set([...A.keys(), ...B.keys()])) {
    const x = A.get(key), y = B.get(key);
    if (!x) { out.push(`cuerpo ${key}: no estaba → aparece (vol ${y.vol})`); continue; }
    if (!y) { out.push(`cuerpo ${key}: estaba (vol ${x.vol}) → desaparece`); continue; }
    for (const kk of ['tris', 'vertices', 'vol', 'min', 'max']) if (canon(x[kk]) !== canon(y[kk])) out.push(`cuerpo ${key}.${kk}: ${canon(x[kk])} → ${canon(y[kk])}`);
  }
  return out;
}

// ── los números dorados (los lee qa-dorados.cjs de la MISMA corrida) ──────────────────────────────────────────────
/** se evalúa DENTRO de la página. Cada número con su FUENTE (de dónde se leyó): si la fuente no existe, va null y lo dice. */
function doradosEnPagina() {
  const Q = window.__qaForja, F = window.__forgeBrep; if (!Q) return { error: 'sin __qaForja' };
  const c = Q.ciclo || {}; const out = {};
  // cada número del MOTOR (no del rótulo: la orden A apaga rótulos, el número del motor sigue), con la ruta exacta de donde salió
  const lee = (ruta) => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), { ciclo: c, revision: Q.revision, lentes: Q.lentes });
  const pon = (k, ruta, f) => { let v; try { v = f ? f(lee(ruta)) : lee(ruta); } catch (e) { v = undefined; } out[k] = { v: typeof v === 'number' && Number.isFinite(v) ? +v.toFixed(4) : (v ?? null), fuente: ruta }; };
  const M = 'ciclo.e2.pkg.diseno.maquina', S = 'ciclo.e2.pkg.diseno.placas.soporte';
  pon('clampT', `${M}.requerimientos.clampNeedTons`);              // la fuerza de cierre que pide la pieza (t)
  pon('clampPct', `${M}.seleccion.clampUtilPct`);                  // la hoja: «clamp N % de T t»
  pon('maquinaT', `${M}.seleccion.machine.clampTons`);             // la inyectora elegida (la del taller: 150 t)
  pon('nCav', 'ciclo.e2.pkg.recomendacion.nCav');
  pon('soporteMm', `${S}.plateThkMm`);                             // t de la placa de soporte (la que se fresa)
  pon('nPilares', `${S}.nPillars`);
  pon('flechaMm', `${S}.deflectionAtPlateMm`);                     // δ de la placa de soporte con ese clamp (Eq 12.10)
  pon('fExpulsionN', 'ciclo.e10.fuerza.fEjectN');                  // F para despegar la pieza del macho (§11.2.2)
  pon('tcPlacaMaxS', 'lentes.lentes', (L) => { const e = (L || []).find((l) => l.id === 'enfriamiento'); return e && e.max; });   // Eq 9.5 en el vóxel peor (el «134 s»)
  pon('tcPiezaS', 'ciclo.e8.ciclo.tcPiezaS');                      // t_c de la pared nominal (E8)
  pon('tcBebederoS', 'ciclo.e8.ciclo.tcSprueS');                   // t_c del bebedero (barra, Eq 9.6) — el que manda en la E8
  pon('nPines', 'ciclo.e10.pines.n');
  pon('nTramosAgua', 'ciclo.e8.circuito.segmentos', (s) => (s ? s.length : undefined));   // «16 tramos» (useMoldStudio.ts:1425)
  // la holgura agua↔barreno más chica que el Foco del molde declara (3.49 mm junto a los interlocks, el «de panzazo»)
  { let v; try { const f = F.focoMolde(); const hs = ((f && f.hallazgos) || []).filter((h) => /agua/.test(String(h.tipo)) && Number.isFinite(h.medido)); v = hs.length ? Math.min(...hs.map((h) => h.medido)) : undefined; } catch (e) { v = undefined; }
    out.holguraAguaMinMm = { v: v ?? null, fuente: '__forgeBrep.focoMolde().hallazgos[tipo~agua].medido (mínimo)' }; }
  pon('aperturaMm', `${M}.seleccion.apertura.strokeMm`);           // carrera de apertura del molde (lo que abre la máquina)
  pon('carreraPedidaMm', 'ciclo.portamoldes.carreraPedidaMm');     // carrera de expulsión que pide la pieza
  pon('carreraLibreMm', 'ciclo.portamoldes.carreraLibreMm');       // la que cabe en la caja expulsora
  pon('dictamenViola', 'revision.fila.viola');                     // los ✗ del dictamen (el 04)
  return out;
}

// ── una corrida completa (la usan qa-dorados y qa-banco) ──────────────────────────────────────────────────────────
/** `enPagina`: funciones extra que se evalúan en la MISMA página al final del camino (p. ej. la matrícula del banco) → r[nombre] */
async function corrida(browser, url, archivo, { stillEn = null, hasta = 'molde', volcado = null, enPagina = {}, reloj = 'real' } = {}) {
  const s = await abre(browser, url, { relojVirtual: reloj !== 'real' });
  const r = { url, archivo: path.relative(REPO, path.resolve(archivo)), gpu: s.gpu, msCarga: s.msCarga, reloj };
  try {
    const cam = await camino(s.page, archivo, { hasta, reloj });
    Object.assign(r, { ms: cam.ms, rompe: cam.rompe, pines: cam.pines, armoMolde: !cam.rompe });
    for (const [k, f] of Object.entries(enPagina)) r[k] = await s.page.evaluate(f).catch((e) => ({ error: String(e).slice(0, 160) }));
    if (!cam.rompe || /SOSPECHOSO/.test(cam.rompe)) {
      r.huella = await s.page.evaluate(huellaEnPagina);
      r.dorados = await s.page.evaluate(doradosEnPagina);
      // los números dorados también entran a la huella (solo sus valores): un número del motor que cambie entre dos corridas
      // del MISMO commit es tan no-determinista como un cuerpo que cambie
      r.huella.dorados = Object.fromEntries(Object.entries(r.dorados || {}).map(([k, o]) => [k, o && typeof o === 'object' ? o.v : o]));
      r.hash = sha(r.huella);
      r.hashAcero = sha(r.huella.cuerpos || []);   // solo el acero (cuerpos): entre commits dice si la GEOMETRÍA cambió aunque cambie un rótulo
    }
    if (volcado) fs.writeFileSync(volcado, JSON.stringify(await s.page.evaluate(volcadoEnPagina), null, 1));
    if (stillEn) r.still = await still(s.cdp, stillEn);
  } finally {
    r.errores = s.errores.slice(0, 20); r.noVale = corridaVale(s);
    await s.ctx.close().catch(() => {});
  }
  return r;
}
/** exploración: la forma del ciclo y del dictamen sin los arreglos grandes (para decidir de dónde sale cada número dorado) */
function volcadoEnPagina() {
  const Q = window.__qaForja; const vistos = new WeakSet();
  const poda = (x, d) => {
    if (x == null || typeof x !== 'object') return typeof x === 'function' ? 'ƒ' : x;
    if (ArrayBuffer.isView(x)) return `‹${x.constructor.name} ${x.length}›`;
    if (vistos.has(x)) return '‹ciclo›'; vistos.add(x);
    if (d > 7) return '‹…›';
    if (Array.isArray(x)) return x.length > 12 ? [...x.slice(0, 6).map((v) => poda(v, d + 1)), `‹+${x.length - 6}›`] : x.map((v) => poda(v, d + 1));
    if (x.constructor && x.constructor.name && !['Object', 'Array'].includes(x.constructor.name)) return `‹${x.constructor.name}›`;
    const o = {}; for (const k of Object.keys(x)) o[k] = poda(x[k], d + 1); return o;
  };
  return { ciclo: poda(Q.ciclo, 0), intake: poda(Q.intake, 0), revision: poda(Q.revision, 0), lentes: poda(Q.lentes, 0) };
}

module.exports = { lanza, abre, corridaVale, suelta, clic, espera, still, textoVisible, camino, huellaEnPagina, doradosEnPagina, canon, sha, diffHuellas, corrida, W, H, DPR, REPO, log };

// ── CLI: la huella ×N ────────────────────────────────────────────────────────
if (require.main === module) (async () => {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const PIEZA = path.resolve(REPO, argv.find((a) => /\.(stp|step|stl)$/i.test(a)) || 'test-parts/inyeccion-reales/1594C Box.stp');
  const N = +arg('--n', 3);
  const URL = process.env.URL || 'http://localhost:4270/forja-brep.html';
  const OUT = arg('--out', path.join('/home/ian/el-plan/qa', new Date().toLocaleDateString('sv-SE'), 'huella'));   // la fecha LOCAL (CDMX), no la UTC
  fs.mkdirSync(OUT, { recursive: true });
  log(`HUELLA · ${path.basename(PIEZA)} ×${N} · ${URL} · ${OUT}`);
  const corridas = [];
  for (let k = 1; k <= N; k++) {
    const browser = await lanza();   // un NAVEGADOR fresco por corrida: ni caché de GPU ni estado de React compartidos
    let r;
    try { r = await corrida(browser, URL, PIEZA, { stillEn: path.join(OUT, `molde-${k}.jpg`), volcado: argv.includes('--volcado') && k === 1 ? path.join(OUT, 'volcado.json') : null }); }
    finally { await browser.close().catch(() => {}); }
    r.k = k; corridas.push(r);
    fs.writeFileSync(path.join(OUT, `corrida-${k}.json`), JSON.stringify(r, null, 1));
    log(`corrida ${k}: ${r.hash ? r.hash.slice(0, 16) : '—'} · ${r.huella ? r.huella.cuerpos.length + ' cuerpos' : ''} · ${r.rompe || 'ok'}${r.noVale ? ' · NO VALE: ' + r.noVale : ''} · ${JSON.stringify(r.ms)}`);
  }
  // EL PAR DE CONTROL del gate (--control): una corrida MÁS con la falla conocida (reloj congelado antes de MOLDE). Su huella
  // DEBE salir distinta de la sana; si sale igual, el gate no ve la falla para la que existe y no vale nada.
  let control = null;
  if (argv.includes('--control')) {
    const browser = await lanza(); let r;
    try { r = await corrida(browser, URL, PIEZA, { stillEn: path.join(OUT, 'molde-control.jpg'), reloj: 'congelado' }); }
    finally { await browser.close().catch(() => {}); }
    fs.writeFileSync(path.join(OUT, 'corrida-control.json'), JSON.stringify(r, null, 1));
    // la referencia sana: una corrida de esta misma vuelta, o `--sano <corrida-k.json>` (de una vuelta anterior del MISMO build)
    const sano = corridas.find((x) => x.huella) || (arg('--sano') ? JSON.parse(fs.readFileSync(arg('--sano'), 'utf8')) : null);
    const cambios = sano && r.huella ? diffHuellas(sano.huella, r.huella) : [];
    control = { hash: r.hash || null, rompe: r.rompe || '', muerde: !!(sano && r.hash && r.hash !== sano.hash) || /SOSPECHOSO/.test(r.rompe || ''), cambios, noVale: r.noVale };
    log(`control (reloj congelado): ${r.hash ? r.hash.slice(0, 16) : '—'} · ${r.rompe || 'ok'} · ${control.muerde ? 'MUERDE' : 'NO MUERDE'} · ${cambios.length} diferencias`);
  }
  const noVale = corridas.filter((r) => r.noVale);
  const hashes = corridas.map((r) => r.hash || null);
  const iguales = hashes.length > 0 && hashes.every((h) => h && h === hashes[0]);
  const diffs = [];
  if (!iguales) for (let k = 1; k < corridas.length; k++) if (corridas[0].huella && corridas[k].huella && hashes[k] !== hashes[0]) diffs.push({ entre: `1↔${k + 1}`, cambios: diffHuellas(corridas[0].huella, corridas[k].huella) });
  // tres corridas IGUALES pero rotas (sin molde, o el molde sin pines) son deterministas… y malas: eso también es ROJO
  const veredicto = noVale.length ? 'NO VALE' : N === 0 ? (control && control.muerde ? 'SOLO CONTROL · MUERDE' : 'SOLO CONTROL · NO MUERDE') : iguales && !corridas.some((r) => r.rompe) ? 'VERDE' : 'ROJO';
  const resumen = { veredicto, pieza: path.relative(REPO, PIEZA), url: URL, n: N, hashes, hashAcero: corridas.map((r) => r.hashAcero || null), diffs, control, rompe: corridas.map((r) => r.rompe || ''), noVale: noVale.map((r) => `${r.k}: ${r.noVale}`),
    ms: corridas.map((r) => r.ms), gpu: corridas[0] && corridas[0].gpu, fecha: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, 'huella.json'), JSON.stringify(resumen, null, 1));
  console.log(`\n${'─'.repeat(78)}\nHUELLA_GATE: ${veredicto} · ${hashes.map((h) => (h || '—').slice(0, 16)).join(' · ')}`);
  for (const d of diffs) { console.log(`  diferencias ${d.entre} (${d.cambios.length}):`); for (const c of d.cambios.slice(0, 40)) console.log('    ' + c); }
  for (const r of corridas) if (r.rompe) console.log(`  corrida ${r.k}: ${r.rompe}`);
  for (const s of resumen.noVale) console.log(`  NO VALE ${s}`);
  if (control) { console.log(`PAR_DE_CONTROL: ${control.muerde ? 'MUERDE' : 'NO MUERDE'} · la corrida con el reloj congelado: ${(control.hash || '—').slice(0, 16)} ${control.rompe}`); for (const c of control.cambios.slice(0, 25)) console.log('    ' + c); }
  // con --control, el control que NO muerde también es ROJO: el gate no vería la falla para la que existe
  process.exit(veredicto === 'NO VALE' ? 2 : (veredicto === 'VERDE' || veredicto === 'SOLO CONTROL · MUERDE') && (!control || control.muerde) ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
