#!/usr/bin/env node
/**
 * EL INSPECTOR DEL MOLDE — una IA revisando un molde como lo haría una CMM: punto por punto, con su número
 * y SU VISTA. Suelta un STEP, arma el molde entero (hasta la estación 8) y recorre los 16 puntos del PLAN DE
 * INSPECCIÓN (orden 2026-09-21-el-plan-de-inspeccion): mide con el kernel (`moldGeom`/`inspeccion.geomPose`),
 * con el estudio de contacto (`moldSolidCollisions`) y con rayos contra la malla (`inspeccion.caraEn`), y para
 * cada punto ENCUADRA lo que mide, lo aísla con contraste y DIBUJA LA COTA antes de tomar la tarjeta.
 *
 * Nació como `<scratchpad>/plan/inspecciona.cjs` (pasada 1). Entra al repo con la orden LA CÁMARA DEL
 * INSPECTOR (2026-09-21), que arregla lo que 4 revisores Opus le reclamaron a la pasada 1 (36 de 64 tarjetas
 * «no se ve») y lo que el inspector se reclamó a sí mismo:
 *
 *  LA CÁMARA (la regla de oro de una vista: encuadrar lo medido · contraste · cota visible)
 *   · EL LADO DEL CORTE SE ELIGE SOLO: `voltea` sale de la dirección de la cámara — la cámara SIEMPRE queda
 *     del lado que el corte se lleva. Antes 2.1/2.2/7.2 cortaban del lado contrario y la cámara amanecía
 *     DENTRO del acero (tarjeta gris lisa).
 *   · ENCUADRE POR LOS PUNTOS MEDIDOS: r se calcula del bbox de lo que se mide (`geomPose`, que sí conoce la
 *     carrera cuando el molde está abierto), no de un número tecleado. Antes 3.1 se salía de cuadro.
 *   · CÁMARA FUERA DEL ACERO: si sin corte el ojo cae dentro de una caja, se empuja hasta salir.
 *   · AISLAR UN CONJUNTO (`inspeccion.aislar`) con color por rol: lo medido opaco, el contexto al 5 %.
 *   · LA COTA DIBUJADA (`inspeccion.cota/cotas`): línea + cruz en cada extremo + etiqueta con 2 decimales.
 *   · PANELES FUERA: la UI del CAD tapaba ~30 % del cuadro en cada tarjeta.
 *
 *  LA MEDICIÓN
 *   · 1.1 y 6.1 dejan de ser TAUTOLÓGICOS: la punta del pin y el techo del macho se miden contra la CARA REAL
 *     (rayo vertical sobre la malla, `inspeccion.caraEn`), no contra la fórmula que los coloca.
 *   · 2.2 mira la cara que importa: el agua A contra el ASIENTO DEL INSERTO de cavidad (antes daba ✓ mirando
 *     la cara superior de la placa mientras el agua entraba 1.6–2.2 mm al inserto).
 *   · 2.3 da la LISTA COMPLETA agua ↔ {pin, retorno, KO}, no el par mínimo.
 *   · 6.2 mide el BALANCE de la expulsión (centroide de los pines vs el centro de la pieza).
 *   · 7.1 marca su umbral como «regla NUESTRA, sin cita».
 *   · pen < 0.6 mm = «no concluyente (vóxel)»; los roles de VARIOS CUERPOS no se juzgan por su caja entera.
 *   · las láminas se numeran desde la página 0 (la de ensamble + BOM, que la pasada 1 se saltó).
 *
 * uso: node scripts/inspecciona-molde.cjs <archivo.stp> <outDir>
 * env: URL (vite) · REC=1 graba video · PLANOS=1 captura las láminas
 */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const URL = process.env.URL || 'http://localhost:5194/forja-brep.html';
const STEP = process.argv[2], OUT = process.argv[3];
const W = 1600, H = 1000, FOV = 35;      // el Canvas del estudio: fov vertical 35°
fs.mkdirSync(path.join(OUT, 'tarjetas'), { recursive: true });
const T0 = Date.now(); const ts = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + ' s';
const r1 = (x) => (Number.isFinite(x) ? +x.toFixed(1) : x), r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : x);
const D2R = Math.PI / 180;

// ── LA CÁMARA (geometría pura, sin navegador) ──────────────────────────────────────────────────────────
/** dirección del ojo en el marco CAD. El estudio coloca la cámara en three con
 *  off=(r·cos el·sin az, r·sin el, r·cos el·cos az) y el molde va rotado (x,y,z)_CAD → (x,z,−y)_three. */
const dirCad = (az, el) => [Math.cos(el * D2R) * Math.sin(az * D2R), -Math.cos(el * D2R) * Math.cos(az * D2R), Math.sin(el * D2R)];
const cajaDe = (items) => {
  const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
  for (const it of items) {
    const a = it.min ?? it, b = it.max ?? it;
    for (let k = 0; k < 3; k++) { if (a[k] < mn[k]) mn[k] = a[k]; if (b[k] > mx[k]) mx[k] = b[k]; }
  }
  return Number.isFinite(mn[0]) ? { min: mn, max: mx } : null;
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
/** la base de la cámara en el marco CAD: adelante (ojo→target), derecha y arriba de PANTALLA.
 *  El `up` de three es (0,1,0) = +z del CAD; en planta es casi paralelo a la vista y se cambia por +y. */
const baseCam = (az, el) => {
  const d = dirCad(az, el), f = [-d[0], -d[1], -d[2]];
  const up0 = Math.abs(f[2]) > 0.995 ? [0, 1, 0] : [0, 0, 1];
  const right = norm(cross(f, up0));
  return { f, right, up: norm(cross(right, f)) };
};
/** ENCUADRE POR PROYECCIÓN — la esfera envolvente miente con lo PLANO: una placa de 246×246×3 vista de
 *  canto llenaba el 7 % del cuadro (la tarjeta 1.1 de la primera corrida). Aquí se proyectan las 8 esquinas
 *  sobre la derecha y el arriba de PANTALLA y r sale del que no quepa: lo medido llena el cuadro siempre. */
const encuadre = (items, { margen = 1.16, minR = 0, az = 0, el = 0 } = {}) => {
  const c = cajaDe(items); if (!c) return null;
  const B = baseCam(az, el);
  const t0 = [0, 1, 2].map((k) => (c.min[k] + c.max[k]) / 2);
  let hu = 0, hr = 0, hf = 0;
  for (let i = 0; i < 8; i++) {
    const p = [(i & 1) ? c.max[0] : c.min[0], (i & 2) ? c.max[1] : c.min[1], (i & 4) ? c.max[2] : c.min[2]];
    const v = [p[0] - t0[0], p[1] - t0[1], p[2] - t0[2]];
    hu = Math.max(hu, Math.abs(dot(v, B.up))); hr = Math.max(hr, Math.abs(dot(v, B.right))); hf = Math.max(hf, Math.abs(dot(v, B.f)));
  }
  hu = Math.max(hu, minR); hr = Math.max(hr, minR);
  const tv = Math.tan((FOV / 2) * D2R), th = tv * (W / H);
  const r = Math.max(hu / tv, hr / th, 12) * margen + hf;
  // EL LETRERO VIVE ARRIBA: se corre el objetivo hacia el «arriba» de pantalla para que el modelo baje
  // ~12 % de la media pantalla y el letrero no lo pise.
  const s = 0.12 * (r - hf) * tv;
  return { t: [0, 1, 2].map((k) => t0[k] + B.up[k] * s), r, hu: +hu.toFixed(1), hr: +hr.toFixed(1) };
};
/** caja alrededor de unos puntos (para los ACERCAMIENTOS: se encuadra lo MEDIDO, no la pieza entera). */
const cajaPuntos = (pts, pad) => ({ min: [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])) - pad), max: [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])) + pad) });
/** ¿el ojo cae DENTRO de un sólido? (slab test del rayo target→ojo contra cada caja). Si sí, se empuja
 *  hasta salir + 8 mm. Solo hace falta sin corte: con corte la cámara ya vive del lado que se removió. */
const fueraDelAcero = (t, az, el, r, cajas) => {
  const d = dirCad(az, el); let out = r, dentro = null;
  for (const b of cajas) {
    let t0 = -1e18, t1 = 1e18, cruza = true;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (t[k] < b.min[k] || t[k] > b.max[k]) { cruza = false; break; } continue; }
      let a = (b.min[k] - t[k]) / d[k], c = (b.max[k] - t[k]) / d[k];
      if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a; if (c < t1) t1 = c;
    }
    if (!cruza || t1 < t0) continue;
    if (out > t0 && out < t1) { dentro = b.role || 'sólido'; out = t1 + 8; }
  }
  return { r: out, dentro };
};
/** los dos puntos más cercanos entre dos cajas (para plantar la cota donde de verdad se mide). */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const parDeCota = (A, B) => {
  const sol = [0, 1, 2].map((k) => Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]));
  if (sol.every((v) => v > 0)) {
    // SE TRASLAPAN: la cota de «puntos más cercanos» daría 0.00 mm (cazado en la primera corrida: 2.2, 2.4,
    // 2.5 y 7.2 con cota 0). Lo que hay que ENSEÑAR es cuánto se meten: el eje de traslape MÍNIMO.
    let k = 0; for (let j = 1; j < 3; j++) if (sol[j] < sol[k]) k = j;
    const m = [0, 1, 2].map((j) => (Math.max(A.min[j], B.min[j]) + Math.min(A.max[j], B.max[j])) / 2);
    const pa = m.slice(), pb = m.slice();
    pa[k] = Math.max(A.min[k], B.min[k]); pb[k] = Math.min(A.max[k], B.max[k]);
    return [pa, pb];
  }
  const cB = [0, 1, 2].map((k) => (B.min[k] + B.max[k]) / 2);
  const pa = [0, 1, 2].map((k) => clamp(cB[k], A.min[k], A.max[k]));
  const pb = [0, 1, 2].map((k) => clamp(pa[k], B.min[k], B.max[k]));
  return [pa, pb];
};

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=gl', '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, ...(process.env.REC === '1' ? { recordVideo: { dir: path.join(OUT, 'video'), size: { width: W, height: H } } } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(ts(), 'PAGEERR', String(e).slice(0, 200)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 90000 }).catch(() => {});

  const letrero = (titulo, sub, color, vista) => page.evaluate(({ titulo, sub, color, vista }) => {
    let c = document.getElementById('__insp');
    if (!c) { c = document.createElement('div'); c.id = '__insp'; document.body.appendChild(c);
      c.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:14px;z-index:2147483646;pointer-events:none;width:min(1400px,92vw);padding:11px 20px;border-radius:12px;background:rgba(6,10,16,.93);border:1px solid #33404f;border-left:6px solid #ffcc33;box-shadow:0 10px 30px rgba(0,0,0,.6);font-family:Inter,system-ui,sans-serif;color:#e8eef6;'; }
    c.style.borderLeftColor = color;
    c.innerHTML = `<div style="font:700 20px/1.2 Inter,system-ui,sans-serif;color:${color}">${titulo}</div>`
      + `<div style="margin-top:4px;font:500 14px/1.4 Inter,system-ui,sans-serif;color:#d3dbe6">${sub}</div>`
      + (vista ? `<div style="margin-top:3px;font:500 12px/1.35 ui-monospace,Menlo,monospace;color:#8fa4bb">LA VISTA · ${vista}</div>` : '');
  }, { titulo, sub, color, vista: vista || '' });

  /** PANELES FUERA: la UI del CAD (árbol, parámetros, análisis, curso, la tira del foco) se comía ~30 % del
   *  cuadro en CADA tarjeta de la pasada 1. `salvo` deja pasar lo que esa tarjeta sí necesita (la escala de
   *  la lente en 5.1). Las cotas del inspector NUNCA se esconden: son el instrumento. */
  const limpiar = (salvo = []) => page.evaluate(({ salvo }) => {
    let st = document.getElementById('__insp-css');
    if (!st) { st = document.createElement('style'); st.id = '__insp-css'; document.head.appendChild(st); }
    const fuera = ['[data-testid="feature-tree"]', '[data-testid="op-panel"]', '[data-testid="analysis-panel"]',
      '[data-testid="face-list"]', '[data-testid="sim-panel"]', '[data-testid="curso-report"]',
      '[data-testid="el-parte-foco"]', '[data-testid="params-panel"]', '[data-testid="mold-cotas-overlay"]',
      '[data-testid="escala-enfriamiento"]', '[data-testid="ficha-en-el-mundo"]'].filter((s) => !salvo.some((k) => s.includes(k)));
    st.textContent = fuera.map((s) => `${s}{display:none !important}`).join('\n');
  }, { salvo });

  await letrero('EL INSPECTOR DEL MOLDE', `pieza: ${path.basename(STEP)} · armando el molde entero (8 estaciones) antes de revisar`, '#ffcc33');

  // ── soltar, armar ──
  const b64 = fs.readFileSync(STEP).toString('base64');
  await page.evaluate(({ b64, name }) => { const el = document.querySelector('.fb-root'); const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    const dt = new DataTransfer(); dt.items.add(new File([u8], name)); for (const t of ['dragenter', 'dragover', 'drop']) el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt })); }, { b64, name: path.basename(STEP) });
  await page.waitForFunction(`!!document.querySelector('[data-testid="el-parte-foco"]')`, null, { timeout: 240000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const b = document.querySelector('[data-testid="aviso-entrada-ok"]'); if (b) b.click(); });
  // la lente de enfriamiento primero: deja libre el hilo y da los tres tiempos de la pregunta 5
  await page.evaluate(() => document.querySelector('[data-testid="parte-lente-enfriamiento"]').click());
  await page.waitForFunction(`!!document.querySelector('[data-testid="escala-enfriamiento"]')`, null, { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const leyenda = await page.evaluate(() => { const l = document.querySelector('[data-testid="parte-leyenda"]'); return l ? l.textContent.replace(/\s+/g, ' ') : ''; });
  const tiempos = (leyenda.match(/([\d.]+) s/g) || []).map((x) => parseFloat(x));
  const ficha = await page.evaluate(() => { const f = document.querySelector('[data-testid="ficha-en-el-mundo"]'); return f ? f.textContent.replace(/\s+/g, ' ') : ''; });
  const xFicha = +((ficha.match(/tarda ([\d.]+)× más/) || [])[1] || NaN), paredMax = +((ficha.match(/pared llega a ([\d.]+) mm/) || [])[1] || NaN);
  const cicloFicha = (ficha.match(/lo más lento: ([\d.]+) s/) || [])[1], restoFicha = (ficha.match(/listo en ([\d.]+) s/) || [])[1];
  console.log(ts(), 'lente de enfriamiento:', leyenda.slice(0, 120));
  const tMolde = Date.now();
  await page.evaluate(() => document.querySelector('[data-testid="parte-lente-molde"]').click());
  const armado = await page.waitForFunction(`(() => { const m = document.querySelector('[data-testid="molde-de-la-pieza"]'); return m && m.dataset.portamoldes === '1'; })()`, null, { timeout: 600000, polling: 1000 }).then(() => true).catch(() => false);
  console.log(ts(), armado ? `molde ENTERO en ${((Date.now() - tMolde) / 1000).toFixed(0)} s` : '✗ el molde NO llegó a la estación 8');
  if (!armado) { fs.writeFileSync(path.join(OUT, 'inspeccion.json'), JSON.stringify({ pieza: path.basename(STEP), armado: false, leyenda }, null, 1)); await ctx.close(); await browser.close(); return; }
  await page.waitForTimeout(1500);
  const tInspeccion = (Date.now() - T0) / 1000;
  await limpiar();

  // ── lo que el estudio sabe ──
  const D = await page.evaluate(() => {
    window.__forgeBrep.inspeccion.estado(0, 0); window.__forgeBrep.llenadoT(1);
    const m = document.querySelector('[data-testid="molde-de-la-pieza"]');
    const G = window.__forgeBrep.moldGeom();
    return { G, pared: +m.dataset.pared, libre: +m.dataset.carreraLibre, pedida: +m.dataset.carreraPedida,
      // LA PUNTA CONTRA LA CARA: si el arreglo de LOS PINES EN LA CARA DEL MACHO ya publicó su medición, se
      // lee de la tira (una sola verdad). Si no existe, este inspector la mide por rayo (más abajo).
      puntasVsCara: m.dataset.puntasVsCara ?? null,
      mat: (m.dataset.material ?? null),
      tel: (window.__forgeBrep.telemetria || []).filter((x) => /total/.test(x.paso)).map((x) => `E${x.estacion} ${(x.ms / 1000).toFixed(1)}s`).join(' · ') };
  });
  // LA APERTURA REAL (fusión 2026-09-21): la pila ya la dimensiona `carreraDeApertura` (pieza + colada, §6.3.2) y el 3D la
  // aplica en `openMm`; el inspector la LEE del molde abierto (`animZ('clamp')` con `estado(1,0)`) en vez de suponer 2.5·H.
  const aperturaReal = await page.evaluate(async () => {
    const f = window.__forgeBrep; f.inspeccion.estado(1, 0);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60))));
    const z = f.animZ('clamp'); f.inspeccion.estado(0, 0);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Number.isFinite(z) ? z : null;
  });
  const cotasOff = await page.evaluate(() => { const b = document.querySelector('[data-testid="mold-cotas-toggle"]'); if (b && b.classList.contains('on')) { b.click(); return true; } return false; });
  const g = (role) => D.G.find((p) => p.role === role);
  const gs = (re) => D.G.filter((p) => re.test(p.role));
  const A = g('placa-a-ghost'), B = g('placa-b-ghost'), pz = g('pieza'), nuc = g('nucleo'), cav = g('cavidad'), sup = g('support'), ret = g('ejector-ret'), col = g('colada'), guias = g('guias'), clamp2 = g('clamp'), bottom = g('bottom');
  const Wb = A.max[0] - A.min[0], Db = A.max[1] - A.min[1], cx = (A.min[0] + A.max[0]) / 2, cy = (A.min[1] + A.max[1]) / 2, zPart = A.min[2];
  const Hp = pz.max[2] - pz.min[2], pcx = (pz.min[0] + pz.max[0]) / 2, pcy = (pz.min[1] + pz.max[1]) / 2;
  const diaDe = (p) => { const mm = (p.name || '').match(/⌀\s*([\d.]+)/); return mm ? +mm[1] : NaN; };
  const lineasB = gs(/^agua-B-(linea|cruce)/), lineasA = gs(/^agua-A-(norte|sur|este|oeste)/);
  const dAgua = diaDe(lineasB[0] || lineasA[0] || {}) || Math.min(...lineasB.map((l) => Math.min(l.max[2] - l.min[2])));
  const cen = (p, k) => (p.min[k] + p.max[k]) / 2;
  const centro = (p) => [cen(p, 0), cen(p, 1), cen(p, 2)];
  const rectDist = (a, b) => { const dx = Math.max(0, Math.max(a.min[0], b.min[0]) - Math.min(a.max[0], b.max[0])), dy = Math.max(0, Math.max(a.min[1], b.min[1]) - Math.min(a.max[1], b.max[1])); return Math.hypot(dx, dy); };
  const zSolapa = (a, b) => Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]) > 0.1;
  const puntas = gs(/^pin-punta-/), cuerpos = gs(/^pin-cuerpo-/), pines = gs(/^pin-(punta|cuerpo)-/);

  // ── 2.3 · LISTA COMPLETA: cada línea de agua contra CADA barreno móvil (pin, retorno, KO) ──────────────
  //     La pasada 1 reportaba solo el par mínimo agua↔pin y callaba retornos y KO (2 piezas con cruces).
  //     Y los roles de VARIOS CUERPOS (pines-retorno = 4 columnas) NO se miden con su caja: abarca la placa
  //     entera y toda distancia sale 0. Esos se juzgan por MALLA (el estudio de contacto), y se dice.
  const MULTIROL = /^pines-retorno$|^ko|^knockout|^vastago/;
  const moviles = D.G.filter((p) => /^pin-(punta|cuerpo)-/.test(p.role));
  const todasAgua = gs(/^agua-(A|B)-(norte|sur|este|oeste|ext|linea|cruce)/);
  const paresAgua = [];
  for (const l of todasAgua) for (const p of moviles) if (zSolapa(l, p)) paresAgua.push({ a: l.role, b: p.role, mm: +rectDist(l, p).toFixed(2), linea: l, hoyo: p });
  paresAgua.sort((u, v) => u.mm - v.mm);
  const medioD = dAgua / 2;
  const cruces = paresAgua.filter((p) => p.mm < medioD);
  const multiEnAgua = D.G.filter((p) => MULTIROL.test(p.role)).map((p) => p.role);

  console.log(ts(), 'midiendo colisiones (estudio de contacto, ~25 s)…');
  await letrero('midiendo: estudio de contacto entre TODOS los componentes', 'volumen de acero compartido y profundidad de penetración, par por par (moldSolidCollisions)', '#ffcc33');
  const colis = await page.evaluate(() => { const R = window.__forgeBrep.moldSolidCollisions(); const F = new Set(['placa-a-ghost', 'placa-b-ghost', 'particion']);
    return (R.collisions || []).filter((c) => !F.has(c.a) && !F.has(c.b)).map((c) => ({ a: c.a, b: c.b, mm3: Math.round(c.volMm3), pen: +(+c.penMm).toFixed(2) })); });
  // ROLES DE VARIOS CUERPOS: 'guias' son 4 columnas, 'tornillos-*' un puñado de tornillos… su CAJA entera
  // abraza el inserto aunque ningún cuerpo lo toque. No se juzgan aquí: se apartan y se DICEN.
  const MULTI = new Set(['guias', 'bujes', 'tornillos-cav', 'tornillos-core', 'interlocks', 'pilares-soporte']);
  const esMulti = (c) => (MULTI.has(c.a) || MULTI.has(c.b)) && /^(nucleo|cavidad)$/.test(MULTI.has(c.a) ? c.b : c.a);
  const noJuzgados = colis.filter(esMulti);
  // BAJO 0.6 mm el estudio de contacto es RUIDO DE VÓXEL (el propio `moldAlarm` usa 0.6 de ajuste): no se
  // declara colisión, se declara «no concluyente» y se pide remedir en B-Rep.
  const VOXEL = 0.6;
  const reales = colis.filter((c) => c.pen >= VOXEL && !esMulti(c));
  const dudosas = colis.filter((c) => c.pen > 0 && c.pen < VOXEL && !esMulti(c));
  const par = (re1, re2) => reales.filter((c) => (re1.test(c.a) && re2.test(c.b)) || (re1.test(c.b) && re2.test(c.a)));
  const parDudoso = (re1, re2) => dudosas.filter((c) => (re1.test(c.a) && re2.test(c.b)) || (re1.test(c.b) && re2.test(c.a)));

  // ── 1.1 y 6.1 · LA CARA REAL (rayo), no la fórmula que los coloca ───────────────────────────────────
  const caraEn = (role, x, y) => page.evaluate(({ role, x, y }) => window.__forgeBrep.inspeccion.caraEn(role, x, y), { role, x, y });
  // LA CARA JUNTO AL BARRENO (fusión 2026-09-22): desde LOS INSERTOS SE BARRENAN el núcleo trae el agujero de cada pin (y otros).
  // Un rayo en el centro exacto del pin cae DENTRO de su barreno y lee el fondo (50 mm «metida» en la carcasa, falso). La
  // cara real del macho se muestrea en un anillo alrededor (radio = ⌀/2 + 1.5 mm, 4 puntos) y se toma la más alta que exista.
  const caraCerca = async (role, x, y, off) => {
    const pts = [[x, y], [x + off, y], [x - off, y], [x, y + off], [x, y - off]];
    let mejor = null;
    for (const [px, py] of pts) { const c = await caraEn(role, px, py); if (c && Number.isFinite(c.zMax) && (!mejor || c.zMax > mejor.zMax)) mejor = c; }
    return mejor;
  };
  // el CENTRO EXACTO suele caer sobre una arista de la triangulación (y sobre el bebedero): se muestrea
  // corrido un pelo, y se toma el primer punto donde la pieza enseña ≥ 2 caras (fuera y dentro).
  const dx = (pz.max[0] - pz.min[0]) * 0.18, dy = (pz.max[1] - pz.min[1]) * 0.18;
  const sondas = [[pcx + 0.37, pcy + 0.29], [pcx + dx, pcy + dy], [pcx - dx, pcy + dy], [pcx + dx, pcy - dy], [pcx - dx, pcy - dy]];
  let sonda = sondas[0], rPieza = null;
  for (const sxy of sondas) { const c = await caraEn('pieza', sxy[0], sxy[1]); if (c && c.zs.length >= 2) { rPieza = c; sonda = sxy; break; } if (!rPieza) rPieza = c; }
  const [sx, sy] = sonda;
  const rNucleo = await caraCerca('nucleo', sx, sy, 4);      // ±4 mm: un barreno chico en el eje no engaña al 1.1
  // la pieza va VOLTEADA (boca en la partición, base cerrada hacia A): en el eje, las dos z más altas son la
  // cara INTERIOR (el piso que el macho toca) y la EXTERIOR. El macho debe llegar a la interior.
  const zPisoReal = rPieza && rPieza.zs.length >= 2 ? rPieza.zs[rPieza.zs.length - 2] : NaN;
  const zTechoMacho = rNucleo ? rNucleo.zMax : nuc.max[2];
  const paredSonda = rPieza && rPieza.zs.length >= 2 ? rPieza.zs[rPieza.zs.length - 1] - zPisoReal : NaN;
  const machoVsPiso = zTechoMacho - zPisoReal;
  const pisoFormula = pz.max[2] - D.pared;                       // lo que la pasada 1 medía (tautológico)
  // cada punta contra la cara REAL del macho en SU (x, y)
  const puntasCara = [];
  for (const p of puntas.slice(0, 12)) {
    const x = cen(p, 0), y = cen(p, 1);
    const c = await caraCerca('nucleo', x, y, (p.max[0] - p.min[0]) / 2 + 1.5);   // fuera del barreno del propio pin
    puntasCara.push({ role: p.role, x: r2(x), y: r2(y), punta: r2(p.max[2]), cara: c ? c.zMax : null, d: c ? +(p.max[2] - c.zMax).toFixed(2) : null });
  }
  const conCara = puntasCara.filter((p) => p.d != null);
  const peorPunta = conCara.length ? conCara.reduce((m, p) => (Math.abs(p.d) > Math.abs(m.d) ? p : m)) : null;
  const cuerpoVsRet = cuerpos.length ? Math.max(...cuerpos.map((p) => Math.abs(p.min[2] - ret.min[2]))) : NaN;

  // ── 6.2 · BALANCE de la expulsión (centroide de los pines vs el centro de la pieza) ──────────────────
  const cenPin = puntas.length
    ? [puntas.reduce((s, p) => s + cen(p, 0), 0) / puntas.length, puntas.reduce((s, p) => s + cen(p, 1), 0) / puntas.length]
    : [pcx, pcy];
  const desbalance = Math.hypot(cenPin[0] - pcx, cenPin[1] - pcy);

  // ── el resto de las medidas ─────────────────────────────────────────────────────────────────────────
  const aguaBbajo = lineasB.length ? Math.min(...lineasB.map((l) => l.min[2])) - B.min[2] : NaN;
  const aguaAalto = lineasA.length ? A.max[2] - Math.max(...lineasA.map((l) => l.max[2])) : NaN;
  const zAguaB = lineasB.length ? cen(lineasB[0], 2) : B.min[2] + 10, zAguaA = lineasA.length ? cen(lineasA[0], 2) : A.max[2] - 10;
  // PLANTA: el corte va ENCIMA del circuito (un tubo partido por su eje, visto desde arriba, es un
  // cascarón abierto — en la primera corrida la planta del 2.3 salió sin una sola línea de agua).
  const zCorteB = (lineasB.length ? Math.max(...lineasB.map((l) => l.max[2])) : zAguaB) + 2;
  const zCorteA = (lineasA.length ? Math.max(...lineasA.map((l) => l.max[2])) : zAguaA) + 2;
  // 2.2 · el agua A contra el ASIENTO DEL INSERTO de cavidad (la cara que la pasada 1 NO miraba)
  const aguaVsInserto = par(/^agua-A-/, /^cavidad$/).concat(parDudoso(/^agua-A-/, /^cavidad$/).map((c) => ({ ...c, dudosa: true })));
  const lineaEnInserto = aguaVsInserto.length ? (lineasA.find((l) => l.role === aguaVsInserto[0].a) || lineasA.find((l) => l.role === aguaVsInserto[0].b) || lineasA[0]) : (lineasA[0] || null);
  const apertura = Number.isFinite(aperturaReal) && aperturaReal > 0 ? aperturaReal : 2.5 * Hp, bebedero = col ? col.max[2] - Math.max(col.min[2], pz.max[2]) : 0, aperturaPide = Hp + bebedero + 10;
  const penRet = (ret.max[2] + D.pedida) - sup.min[2];
  const guiaSobre = guias ? guias.max[2] - zPart : NaN, machoSobre = nuc.max[2] - zPart;
  // TALADRABLE: el tramo toca un canto, o sobre su MISMO eje hay un tapón / una entrada-salida
  const bocas = gs(/^agua-tapon-|^agua-(A|B)-ext/);
  const taladrable = (l) => { if (l.min[0] <= A.min[0] + 1.5 || l.max[0] >= A.max[0] - 1.5 || l.min[1] <= A.min[1] + 1.5 || l.max[1] >= A.max[1] - 1.5) return true;
    const enX = (l.max[0] - l.min[0]) >= (l.max[1] - l.min[1]); const k = enX ? 1 : 0;
    return bocas.some((b) => Math.abs(cen(b, k) - cen(l, k)) <= dAgua && Math.abs(cen(b, 2) - cen(l, 2)) <= dAgua); };
  const ciegas = todasAgua.filter((l) => !taladrable(l));
  const largos = todasAgua.map((l) => ({ l, q: Math.max(l.max[0] - l.min[0], l.max[1] - l.min[1]) / dAgua }));
  const peorLargo = largos.length ? largos.reduce((m, x) => (x.q > m.q ? x : m)) : null;
  const largoSobreD = peorLargo ? peorLargo.q : NaN;
  const ok = (b) => (b ? 'ok' : 'falla');

  // ── LOS PUNTOS: cada uno con SU vista (roles aislados, corte, cotas, encuadre) ───────────────────────
  const AMBAR = '#ffb03a', CIAN = '#5fd4f5', VERDE = '#57e6a8', ROJO = '#ff6b5e';
  // `moldColors` pinta por rol EXACTO: para una familia (los 16 tramos de pin) hay que expandirla.
  const colorFam = (re, c) => Object.fromEntries(D.G.filter((p) => re.test(p.role)).map((p) => [p.role, c]));
  const todas = D.G.filter((p) => !/^platina-/.test(p.role)).map((p) => ({ min: p.min, max: p.max, role: p.role }));
  const pinPrincipal = puntas[0] || cuerpos[0] || null;
  const parRet = par(/^pines-retorno$/, /^nucleo$/);
  const parAguaPorta = par(/^agua-/, /^(support|pines-retorno|tornillos-core|tornillos-cav|clamp)$/);
  const parPinNucleo = par(/^pin-(punta|cuerpo)-/, /^nucleo$/), parColCav = par(/^colada$/, /^cavidad$/);
  const roleDe = (r) => D.G.find((p) => p.role === r);

  const P = [
    { id: '0', preg: 'EL MOLDE', que: 'el molde entero, cerrado', v: 'info',
      medido: `${D.G.length} componentes · base ${r1(Wb)}×${r1(Db)} · altura ${r1(clamp2.max[2] - bottom.min[2])} mm · armado: ${D.tel}`, pide: '',
      vista: { az: 40, el: 26, enc: todas, margen: 1.22, mira: 'el molde completo, sin aislar ni cortar' } },

    { id: '1.1', preg: '1 · ¿CIERRA?', que: 'el macho está DENTRO de la pieza: su techo toca el PISO REAL (rayo, no fórmula)',
      medido: `rayo en (${r1(sx)}, ${r1(sy)}): techo del macho (cara real) z ${r2(zTechoMacho)} · piso interior de la pieza z ${r2(zPisoReal)} (pared ahí ${r2(paredSonda)} mm) → ${r2(machoVsPiso)} mm`
        + ` · [la fórmula «techo − pared mediana» habría dicho z ${r2(pisoFormula)}]`,
      pide: '|Δ| ≤ 0.5 mm', v: Number.isFinite(machoVsPiso) ? ok(Math.abs(machoVsPiso) <= 0.5) : 'info',
      vista: { az: 90, el: 6, corte: ['x', pcx], aislar: ['nucleo', 'pieza'], tenues: ['cavidad', 'colada'],
        colores: { nucleo: AMBAR, pieza: CIAN }, opac: 1, opacs: { pieza: 0.26 },
        enc: [pz, nuc], margen: 1.16,
        cota: Number.isFinite(zPisoReal) ? { a: [sx, sy, zTechoMacho], b: [sx, sy, zPisoReal], et: 'techo del macho ↔ piso de la pieza', ok: Math.abs(machoVsPiso) <= 0.5 } : null,
        mira: 'corte por el eje · macho ÁMBAR opaco, pieza CIAN (obedece el corte) · cota en el eje' } },

    { id: '1.2', preg: '1 · ¿CIERRA?', que: 'la pila completa en CORTE por el eje de apertura: bebedero, cavidad, macho, pines, expulsora',
      medido: `partición z ${r1(zPart)} · anillo y bebedero sobre el eje (${r1(cx)}, ${r1(cy)}) · altura total ${r1(clamp2.max[2] - bottom.min[2])} mm`, pide: 'todo alineado al eje', v: 'mirar',
      vista: { az: 90, el: 4, corte: ['x', cx], enc: todas, margen: 1.18, mira: 'corte por el eje del molde, TODO visible' } },

    { id: '2.1', preg: '2 · ¿HAY ACERO?', que: 'agua B ↔ cara INFERIOR de la placa B',
      medido: `${r2(aguaBbajo)} mm de acero bajo la línea (⌀ ${r2(dAgua)})`, pide: `≥ ½ D = ${r2(medioD)} mm`, v: ok(aguaBbajo >= medioD),
      vista: (() => { const l = lineasB.length ? lineasB.reduce((m, x) => (x.min[2] < m.min[2] ? x : m)) : null; if (!l) return { az: 0, el: 3, enc: todas };
        return { az: 180, el: 4, corte: ['y', cen(l, 1)], aislar: ['agua-B-*', 'placa-b-ghost'], tenues: ['support', 'nucleo'],
          colores: { 'placa-b-ghost': '#6f8095' }, opacTenue: 0.06,
          enc: [cajaPuntos([[cen(l, 0), cen(l, 1), l.min[2]], [cen(l, 0), cen(l, 1), B.min[2]], [cen(l, 0), cen(l, 1), l.max[2]]], 5 * dAgua)], margen: 1.2,
          cota: { a: [cen(l, 0), cen(l, 1), l.min[2]], b: [cen(l, 0), cen(l, 1), B.min[2]], et: 'acero bajo la línea', ok: aguaBbajo >= medioD },
          mira: 'corte por el eje de la línea · solo agua B + placa B · cota del fondo de la línea a la cara inferior' }; })() },

    { id: '2.2', preg: '2 · ¿HAY ACERO?', que: 'agua A ↔ el ASIENTO DEL INSERTO de cavidad (la cara que importa, no la cara de la placa)',
      medido: aguaVsInserto.length
        ? `el agua A ENTRA al inserto de cavidad: ${aguaVsInserto.map((c) => `${c.a}↔${c.b} ${c.pen} mm${c.dudosa ? ' (no concluyente, vóxel)' : ''}`).join(' ; ')}`
        : `sin contacto agua A ↔ inserto de cavidad · acero sobre la línea hasta la cara de placa A: ${r2(aguaAalto)} mm`,
      pide: '0 mm dentro del inserto (y ≥ ½ D de acero a la cara)', v: aguaVsInserto.filter((c) => !c.dudosa).length ? 'falla' : ok(aguaAalto >= medioD),
      vista: (() => { const l = lineaEnInserto; if (!l || !cav) return { az: 0, el: 3, enc: todas };
        const [pa, pb] = parDeCota(l, cav);
        return { az: 180, el: 8, corte: ['y', cen(l, 1)], aislar: ['agua-A-*', 'cavidad'], tenues: ['placa-a-ghost'],
          colores: { ...colorFam(/^agua-A-/, CIAN), cavidad: '#9fb3c8' }, opacTenue: 0.05, opacs: { cavidad: 0.22 },
          enc: [cajaPuntos([pa, pb], 7 * dAgua)], margen: 1.2,
          cota: { a: pa, b: pb, et: 'traslape agua A ↔ inserto de cavidad', ok: !aguaVsInserto.filter((c) => !c.dudosa).length },
          mira: 'corte por el eje de la línea A · agua A opaca dentro del inserto TRANSLÚCIDO · cota del traslape' }; })() },

    { id: '2.3', preg: '2 · ¿HAY ACERO?', que: 'el agua ↔ TODO barreno móvil (pines, retornos, KO) — lista completa',
      medido: (() => { const malla = par(/^agua-/, MULTIROL), dud = parDudoso(/^agua-/, MULTIROL);
        const sano = paresAgua.find((q) => q.mm >= medioD);
        return `${paresAgua.length} pares agua↔pin se cruzan en z · bajo ½D (${r2(medioD)} mm): ${cruces.length ? cruces.map((c) => `${c.a}↔${c.b} ${c.mm}`).join(' ; ') : 'ninguno'}`
          + (sano ? ` · el más cerrado que SÍ pasa: ${sano.a}↔${sano.b} ${sano.mm} mm` : '')
          + ` · RETORNOS/KO (${multiEnAgua.join(', ') || 'ninguno'}) son roles de VARIOS CUERPOS: su caja abarca la placa, se juzgan por MALLA → `
          + (malla.length ? `TOCAN: ${malla.map((c) => `${c.a}↔${c.b} ${c.pen} mm`).join(' ; ')}` : dud.length ? `roce < ${VOXEL} mm, no concluyente (vóxel)` : 'sin contacto'); })(),
      pide: `todo par ≥ ½ D = ${r2(medioD)} mm · 0 mm de penetración con retornos/KO`,
      v: paresAgua.length || multiEnAgua.length ? ok(cruces.length === 0 && par(/^agua-/, MULTIROL).length === 0) : 'info',
      vista: { az: 0, el: 80,
        aislar: ['agua-*', 'pin-*', 'pines-retorno'], tenues: ['nucleo', 'placa-b-ghost'], opacTenue: 0.05,
        colores: { ...colorFam(/^pin-/, AMBAR), 'pines-retorno': ROJO }, enc: [{ min: [B.min[0], B.min[1], zAguaB - 6], max: [B.max[0], B.max[1], zAguaB + 6] }], margen: 1.06,
        cotas: (cruces.length ? cruces : paresAgua).slice(0, 4).map((c) => { const [pa, pb] = parDeCota(c.linea, c.hoyo);
          return { a: [pa[0], pa[1], zAguaB], b: [pb[0], pb[1], zAguaB], et: `${c.a.replace('agua-', '')}↔${c.b.replace('pin-', '')}`, ok: c.mm >= medioD }; }),
        mira: 'casi PLANTA · solo agua + pines + retornos (el acero oculto: nada que cortar ni que estorbe) · una cota por par' } },

    { id: '2.4', preg: '2 · ¿HAY ACERO?', que: 'los pines de RETORNO ↔ el inserto de núcleo',
      medido: parRet.length ? parRet.map((c) => `${c.mm3} mm³ · ${c.pen} mm`).join(' ; ')
        : parDudoso(/^pines-retorno$/, /^nucleo$/).length ? `${parDudoso(/^pines-retorno$/, /^nucleo$/)[0].pen} mm — no concluyente (vóxel < ${VOXEL} mm)` : 'sin contacto',
      pide: '0 mm³ compartidos', v: ok(parRet.length === 0),
      vista: { az: 25, el: 55, corte: ['z', zPart - 1], aislar: ['pines-retorno', 'nucleo'], tenues: ['placa-b-ghost', 'support'],
        colores: { 'pines-retorno': ROJO, nucleo: '#9fb3c8' }, opacTenue: 0.05, opacs: { nucleo: 0.24 },
        enc: (() => { const pr = roleDe('pines-retorno'); if (!pr) return [{ min: nuc.min, max: [nuc.max[0], nuc.max[1], zPart] }];
          const [pa, pb] = parDeCota(pr, nuc); return [cajaPuntos([pa, pb], 34)]; })(), margen: 1.2,
        cota: (() => { const pr = roleDe('pines-retorno'); if (!pr || !nuc) return null; const [pa, pb] = parDeCota(pr, nuc);
          return { a: pa, b: pb, et: 'retorno ↔ inserto de núcleo', ok: parRet.length === 0 }; })(),
        mira: 'cortado bajo la partición · retornos ROJOS dentro del inserto TRANSLÚCIDO, todo lo demás al 5 %' } },

    { id: '2.5', preg: '2 · ¿HAY ACERO?', que: 'el agua ↔ el portamoldes (soporte, retornos, tornillos)',
      medido: parAguaPorta.length ? parAguaPorta.slice(0, 4).map((c) => `${c.a}↔${c.b} ${c.pen} mm`).join(' ; ')
        : parDudoso(/^agua-/, /^(support|pines-retorno|tornillos-core|tornillos-cav|clamp)$/).length ? `solo penetraciones < ${VOXEL} mm — no concluyente (vóxel)` : 'sin contacto',
      pide: '0 mm de penetración', v: ok(parAguaPorta.length === 0),
      vista: (() => { const c0 = parAguaPorta[0]; const la = c0 ? (roleDe(c0.a) || roleDe(c0.b)) : (lineasB[0] || null); const ot = c0 ? (roleDe(c0.b) || roleDe(c0.a)) : sup;
        if (!la || !ot) return { az: 90, el: 3, enc: todas };
        const [pa, pb] = parDeCota(la, ot);
        return { az: 200, el: 12, corte: ['y', cen(la, 1)], aislar: [la.role, ot.role], tenues: ['placa-b-ghost'], opacTenue: 0.05,
          colores: { [la.role]: CIAN, [ot.role]: '#9fb3c8' }, opacs: { [ot.role]: 0.28 },
          enc: [cajaPuntos([pa, pb], 9 * dAgua)], margen: 1.2,
          cota: { a: pa, b: pb, et: `${la.role} ↔ ${ot.role}`, ok: parAguaPorta.length === 0 },
          mira: 'corte por el eje de la línea · la línea CIAN dentro del sólido TRANSLÚCIDO que invade' }; })() },

    { id: '3.1', preg: '3 · ¿ABRE Y EXPULSA?', que: 'la apertura saca la pieza CON su bebedero',
      medido: `apertura ${Number.isFinite(aperturaReal) && aperturaReal > 0 ? 'REAL (animZ clamp)' : '2.5·H (sin animZ)'} = ${r1(apertura)} mm · pieza ${r1(Hp)} + bebedero ${r1(bebedero)} + 10 = ${r1(aperturaPide)}`, pide: 'apertura ≥ pieza + bebedero + 10', v: ok(apertura >= aperturaPide),
      vista: { estado: [1, 0], pose: true, az: 90, el: 5, corte: ['x', cx], margen: 1.16,
        cotasPose: (Gp) => { const Ap = Gp.find((p) => p.role === 'placa-a-ghost'), Bp = Gp.find((p) => p.role === 'placa-b-ghost');
          const pzp = Gp.find((p) => p.role === 'pieza'), colp = Gp.find((p) => p.role === 'colada');
          // la cámara mira por −x: la PANTALLA es (y, z). Las dos cotas van a y distintas o se encimarían.
          const xC = cx - 6, yI = Ap.min[1] + 16, yD = Ap.max[1] - 16;
          return [
            { a: [xC, yI, Bp.max[2]], b: [xC, yI, Ap.min[2]], et: 'apertura REAL', ok: apertura >= aperturaPide },
            { a: [xC, yD, pzp.min[2]], b: [xC, yD, (colp ? colp.max[2] : pzp.max[2])], et: 'pieza + bebedero (lo que hay que sacar)', ok: null },
          ]; },
        mira: 'molde ABIERTO al 100 % · encuadre calculado con la pose abierta (la carrera cabe en cuadro) · dos cotas: lo que abre vs lo que hay que sacar' } },

    { id: '3.2', preg: '3 · ¿ABRE Y EXPULSA?', que: 'la carrera de expulsión CABE en la caja expulsora',
      medido: `libre ${r1(D.libre)} mm · la pieza pide ${r1(D.pedida)} (H + 8) → la retenedora entra ${r1(Math.max(0, penRet))} mm en el soporte`, pide: 'libre ≥ pedida', v: ok(D.libre >= D.pedida),
      vista: { estado: [1, 1], pose: true, az: 90, el: 4, corte: ['x', cx],
        aislar: ['ejector', 'ejector-ret', 'support', 'bottom', 'rieles', 'pines-retorno', 'pin-*', 'pilares-soporte'], tenues: ['placa-b-ghost', 'nucleo'], opacTenue: 0.05,
        colores: { 'ejector-ret': AMBAR, support: '#9fb3c8' },
        encRoles: ['ejector', 'ejector-ret', 'support', 'bottom', 'rieles'], margen: 1.22,
        cotasPose: (Gp) => { const rp = Gp.find((p) => p.role === 'ejector-ret'), sp = Gp.find((p) => p.role === 'support');
          if (!rp || !sp) return []; const x0 = sp.min[0] + 12;
          return [{ a: [x0, cy, rp.max[2]], b: [x0, cy, sp.min[2]], et: penRet > 0 ? 'la retenedora ENTRA en el soporte' : 'claro a la cara del soporte', ok: D.libre >= D.pedida }]; },
        mira: 'expulsado al 100 % · solo el paquete expulsor + soporte · cota de la cara de la retenedora a la cara del soporte' } },

    { id: '3.3', preg: '3 · ¿ABRE Y EXPULSA?', que: 'las guías enganchan ANTES de que el macho entre a la cavidad',
      medido: `guía sobre la partición ${r1(guiaSobre)} mm · macho ${r1(machoSobre)} mm`, pide: 'guía > macho', v: ok(guiaSobre > machoSobre),
      vista: { estado: [0.45, 0], pose: true, az: 35, el: 14, aislar: ['guias', 'bujes', 'nucleo', 'cavidad'], tenues: ['placa-a-ghost', 'placa-b-ghost'], opacTenue: 0.05,
        colores: { guias: AMBAR, nucleo: CIAN }, encRoles: ['guias', 'nucleo', 'cavidad'], margen: 1.3,
        cotas: guias ? [
          { a: [guias.min[0] + 6, guias.min[1] + 6, zPart], b: [guias.min[0] + 6, guias.min[1] + 6, guias.max[2]], et: 'guía sobre la partición', ok: guiaSobre > machoSobre },
          { a: [cen(nuc, 0), cen(nuc, 1), zPart], b: [cen(nuc, 0), cen(nuc, 1), nuc.max[2]], et: 'macho sobre la partición', ok: null },
        ] : [], mira: 'molde a media apertura · guías ÁMBAR y macho CIAN, placas al 5 % · las dos alturas cotadas sobre la partición' } },

    { id: '5.1', preg: '5 · ¿LLENA Y ENFRÍA?', que: 'lo más lento contra lo de en medio (la lente de enfriamiento)',
      medido: Number.isFinite(xFicha) ? `el ciclo lo manda lo más lento: ${cicloFicha} s; el resto está listo en ${restoFicha} s → ${xFicha}× (la pared llega a ${paredMax} mm; la medida es ${D.pared})` : `primero ${tiempos[0]} s · tarde ${tiempos[2]} s (la ficha no dio el ×)`,
      pide: 'lo más lento ≤ 2× la mitad de la pieza (pared pareja, Eq 9.5: t ∝ h²)', v: Number.isFinite(xFicha) ? ok(xFicha <= 2) : 'info',
      vista: { az: 40, el: 30, aislar: ['pieza'], tenues: [], enc: [pz], margen: 1.35, salvo: ['escala-enfriamiento'],
        // LA LENTE ES UN RELOJ: por omisión pinta la TEMPERATURA en el instante t (a los 17 s casi toda la
        // pieza ya está fría y la tarjeta sale lavada — el reclamo de los revisores). El botón «ver el mapa
        // en segundos» la pone en el MAPA de t_c, que es justo lo que este punto afirma: dónde tarda 134 s.
        clic: 'reloj-mapa',
        mira: 'la pieza SOLA con el MAPA EN SEGUNDOS (no el reloj) y su escala de color a la derecha' } },

    { id: '6.1', preg: '6 · ¿EXPULSA SIN DAÑAR?', que: 'los pines: la punta en la CARA REAL del macho (rayo) y la cabeza en la retenedora',
      medido: (D.puntasVsCara != null ? `la tira dice puntas↔cara ${D.puntasVsCara} mm · ` : '')
        + (peorPunta ? `medido por rayo: la peor punta ${peorPunta.role} está ${r2(peorPunta.d)} mm ${peorPunta.d > 0 ? 'METIDA en el plástico' : 'HUNDIDA en el acero'} (cara real z ${r2(peorPunta.cara)})` : 'sin punta medible por rayo (el pin no cae sobre el macho)')
        + ` · cuerpo ↔ cara de la retenedora ${r2(cuerpoVsRet)} mm · ${puntas.length} pines`,
      pide: 'punta ↔ cara real ≤ 0.5 mm · cuerpo ↔ retenedora ≤ 0.5 mm',
      v: peorPunta ? ok(Math.abs(peorPunta.d) <= 0.5 && cuerpoVsRet <= 0.5) : 'info',
      vista: (() => { const p = peorPunta ? puntas.find((q) => q.role === peorPunta.role) : pinPrincipal; if (!p) return { az: 90, el: 5, enc: todas };
        const x = cen(p, 0), y = cen(p, 1), zc = peorPunta && peorPunta.cara != null ? peorPunta.cara : p.max[2];
        return { az: 90, el: 6, corte: ['x', x], aislar: ['pin-*', 'nucleo'], tenues: ['pieza'], opacTenue: 0.22,
          colores: { ...colorFam(/^pin-/, AMBAR), nucleo: '#9fb3c8', pieza: CIAN }, opacs: { pieza: 0.22 },
          enc: [cajaPuntos([[x, y, p.max[2]], [x, y, zc]], 13)], margen: 1.2,
          cota: { a: [x, y, p.max[2]], b: [x, y, zc], et: 'punta del pin ↔ cara real del macho', ok: peorPunta ? Math.abs(peorPunta.d) <= 0.5 : null },
          mira: 'acercamiento ~10× a la PEOR punta, cortado por su eje · macho opaco, pieza translúcida · cota punta↔cara' }; })() },

    { id: '6.2', preg: '6 · ¿EXPULSA SIN DAÑAR?', que: 'el paquete expulsor desde ABAJO y el BALANCE de la expulsión',
      medido: `${puntas.length} pines · centroide de los pines a ${r2(desbalance)} mm del centro de la pieza · retenedora z ${r1(ret.min[2])}..${r1(ret.max[2])}`,
      pide: 'centroide ≤ 5 % de la diagonal de la pieza (regla NUESTRA, sin cita: el libro no da un número)',
      v: ok(desbalance <= 0.05 * Math.hypot(pz.max[0] - pz.min[0], pz.max[1] - pz.min[1])),
      vista: { az: 30, el: -62, aislar: ['pin-*', 'pines-retorno', 'ejector', 'ejector-ret', 'pilares-soporte'], tenues: ['pieza'], opacTenue: 0.12,
        colores: { ...colorFam(/^pin-/, AMBAR), 'pines-retorno': '#9fb3c8' }, opacs: { ejector: 0.3, 'ejector-ret': 0.3 },
        encRoles: ['pin-*'], margen: 1.35,
        cotas: [{ a: [cenPin[0], cenPin[1], ret.max[2] + 2], b: [pcx, pcy, ret.max[2] + 2], et: 'centroide de los pines ↔ centro de la pieza', ok: desbalance <= 0.05 * Math.hypot(pz.max[0] - pz.min[0], pz.max[1] - pz.min[1]) }],
        mira: 'DESDE ABAJO · el paquete expulsor con las placas TRANSLÚCIDAS (los pines se ven enteros) · la cota del desbalance' } },

    { id: '7.1', preg: '7 · ¿SE PUEDE FABRICAR?', que: 'cada línea de agua se taladra desde un canto',
      medido: `${todasAgua.length} líneas · ciegas (no tocan un canto): ${ciegas.length ? ciegas.map((l) => l.role).join(', ') : 'ninguna'} · largo/⌀ máx ${r1(largoSobreD)} (${peorLargo ? peorLargo.l.role : '—'})`,
      pide: '0 ciegas · largo/⌀ ≤ 50 — REGLA NUESTRA, SIN CITA (Kazmer no da el número; razón: taladro profundo con gun-drill y deriva)',
      v: ok(ciegas.length === 0 && largoSobreD <= 50),
      vista: { az: 0, el: 82, aislar: ['agua-*'], tenues: ['placa-a-ghost', 'placa-b-ghost', 'cavidad'], opacTenue: 0.06,
        enc: [{ min: [A.min[0], A.min[1], zAguaA - 1], max: [A.max[0], A.max[1], zAguaA + 1] }], margen: 1.06,
        cotas: peorLargo ? [(() => { const l = peorLargo.l, enX = (l.max[0] - l.min[0]) >= (l.max[1] - l.min[1]);
          return { a: enX ? [l.min[0], cen(l, 1), cen(l, 2)] : [cen(l, 0), l.min[1], cen(l, 2)], b: enX ? [l.max[0], cen(l, 1), cen(l, 2)] : [cen(l, 0), l.max[1], cen(l, 2)], et: `${l.role} · largo (⌀ ${r2(dAgua)})`, ok: peorLargo.q <= 50 }; })()] : [],
        mira: 'casi PLANTA · el circuito COMPLETO (A y B) sobre las placas al 6 % · el tramo más largo cotado de punta a punta' } },

    { id: '7.2', preg: '7 · ¿SE PUEDE FABRICAR?', que: 'los insertos traen SUS barrenos: pines en el núcleo, bebedero en la cavidad',
      medido: `${parPinNucleo.length} tramos de pin atraviesan núcleo MACIZO (hasta ${parPinNucleo.length ? Math.max(...parPinNucleo.map((c) => c.pen)) : 0} mm = su radio) · bebedero ↔ cavidad ${parColCav.length ? parColCav[0].pen + ' mm' : 'libre'}`,
      pide: '0 mm³ compartidos (cada pin y el bebedero con su barreno)', v: ok(parPinNucleo.length === 0 && parColCav.length === 0),
      vista: (() => { const p = pinPrincipal; const y = p ? cen(p, 1) : pcy;
        return { az: 30, el: 24, corte: ['y', y], aislar: ['nucleo', 'pin-*', 'colada', 'cavidad'], tenues: ['placa-a-ghost', 'placa-b-ghost'], opacTenue: 0.05,
          colores: { ...colorFam(/^pin-/, ROJO), nucleo: '#9fb3c8', colada: AMBAR }, opacs: { nucleo: 0.26, cavidad: 0.26 }, enc: [p ? cajaPuntos([[cen(p, 0), cen(p, 1), p.min[2]], [cen(p, 0), cen(p, 1), p.max[2]]], 26) : nuc], margen: 1.2,
          cota: p && nuc ? (() => { const [pa, pb] = parDeCota(p, nuc); return { a: pa, b: pb, et: 'pin ↔ acero del inserto', ok: parPinNucleo.length === 0 }; })() : null,
          mira: 'corte por la fila de pines · pines ROJOS dentro de los insertos TRANSLÚCIDOS (se ve que el acero no trae su barreno) · la cámara del lado que el corte se lleva' }; })() },
  ];

  // ── EL RECORRIDO ────────────────────────────────────────────────────────────────────────────────────
  const COLOR = { ok: '#7ee2a8', falla: ROJO, mirar: '#ffcc33', info: '#8fb8ff' }, SIGNO = { ok: '✓ CUMPLE', falla: '✗ FALLA', mirar: '👁 MIRAR', info: '· dato' };
  const bitacora = [];
  for (const p of P) {
    const v = p.vista;
    await limpiar(v.salvo || []);
    // 1) AISLAR PRIMERO, y con respiro: al cambiar lo visible el estudio recalcula su bbox y su
    //    AUTO-ENCUADRAR dispara `setView('iso')`. Si la órbita se pide en el mismo tic, el iso llega
    //    después y PISA la vista (cazado leyendo ForgeBRepStudio; la tarjeta 3.1 salió en iso).
    const aislado = await page.evaluate(({ roles, tenues, colores, opacTenue, opac, opacs }) => {
      const f = window.__forgeBrep;
      if (!roles) { f.inspeccion.aislar(null); return null; }
      return f.inspeccion.aislar(roles, { tenues: tenues || [], colores: colores || {}, opacTenue: opacTenue ?? 0.05, opac: opac ?? 1, opacs: opacs || {} });
    }, { roles: v.aislar || null, tenues: v.tenues, colores: v.colores, opacTenue: v.opacTenue, opac: v.opac, opacs: v.opacs || null });
    await page.waitForTimeout(500);
    // 2) LA POSE. Va DESPUÉS de aislar: volver a mostrar 60 piezas las vuelve a montar en posición 0 y el
    //    driver las recoloca en su siguiente cuadro — leer `geomPose` antes daba la pose CERRADA con el
    //    molde abierto (medido: «apertura REAL 0.00 mm» y el encuadre sin la carrera).
    await page.evaluate(({ est }) => { const f = window.__forgeBrep; f.inspeccion.estado(est ? est[0] : 0, est ? est[1] : 0); f.llenadoT(1); }, { est: v.estado || null });
    // dos cuadros de gracia: `MoldOpenDriver` mueve en `useFrame`, no al llamar
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))).catch(() => {});
    await page.waitForTimeout(400);
    let Gp = D.G;
    if (v.pose) Gp = await page.evaluate(() => window.__forgeBrep.inspeccion.geomPose());
    // 3) EL LADO DEL CORTE SE ELIGE SOLO: la cámara siempre del lado que el corte se lleva
    const eje = v.corte ? v.corte[0] : null, ejeI = eje === 'x' ? 0 : eje === 'y' ? 1 : 2;
    const voltea = eje ? dirCad(v.az, v.el)[ejeI] < 0 : false;
    // 4) encuadre: por roles (en la pose) o por cajas explícitas
    const visibles = aislado ? new Set([...(aislado.protagonistas || []), ...(aislado.tenues || [])]) : null;
    let items = v.enc;
    if (v.encRoles) { const casa = (r) => v.encRoles.some((k) => (k.endsWith('*') ? r.startsWith(k.slice(0, -1)) : r === k)); items = Gp.filter((q) => casa(q.role)); }
    else if (v.pose && items === todas) items = Gp;
    else if (v.pose && Array.isArray(items)) items = items.map((it) => Gp.find((q) => q.role === it.role) || it);
    const enc = encuadre(items && items.length ? items : Gp.filter((q) => !/^platina-/.test(q.role)), { margen: v.margen ?? 1.16, minR: v.minR ?? 0, az: v.az, el: v.el }) || { t: [cx, cy, zPart], r: Math.max(Wb, Db) * 2 };
    // 5) sin corte, la cámara no puede quedar DENTRO de un sólido visible
    let rFinal = enc.r, dentro = null;
    if (!eje) {
      const bloqueo = Gp.filter((q) => (!visibles || visibles.has(q.role)) && !/^platina-/.test(q.role));
      const f = fueraDelAcero(enc.t, v.az, v.el, enc.r, bloqueo);
      rFinal = f.r; dentro = f.dentro;
    }
    // 6) las cotas (en la pose si la vista las calcula con ella)
    const cotas = v.cotasPose ? v.cotasPose(Gp) : (v.cotas || (v.cota ? [v.cota] : []));
    const poner = () => page.evaluate(({ eje, mm, voltea, az, el, r, t, cotas }) => {
      const f = window.__forgeBrep;
      f.inspeccion.corte(eje, mm, voltea);
      f.inspeccion.cotas((cotas || []).filter(Boolean).map((c) => ({ a: c.a, b: c.b, etiqueta: c.et, ok: c.ok === null ? undefined : c.ok })));
      f.orbitTo(az, el, r, t[0], t[1], t[2]);
    }, { eje, mm: v.corte ? v.corte[1] : 0, voltea, az: v.az, el: v.el, r: rFinal, t: enc.t, cotas });
    await poner();
    if (v.clic) await page.evaluate((id) => { const b = document.querySelector(`[data-testid="${id}"]`); if (b) b.click(); }, v.clic).catch(() => {});
    await letrero(`${p.preg} — ${p.que}`, `<b style="color:${COLOR[p.v]}">${SIGNO[p.v]}</b> · ${p.medido}${p.pide ? ` · <span style="opacity:.75">pide: ${p.pide}</span>` : ''}`, COLOR[p.v], v.mira);
    await page.waitForTimeout(process.env.REC === '1' ? 2600 : 1100);
    // LA ÓRBITA, OTRA VEZ: el AUTO-ENCUADRAR del estudio (`setView('iso')` cuando el bbox visible cambia
    // > 20 %) puede aterrizar DESPUÉS de la órbita y dejar la tarjeta en iso — pasó en 1.1 con la misma
    // receta que la corrida anterior sí respetó (es una carrera, no una regla). Repetirla la gana siempre.
    await poner();
    await page.waitForTimeout(process.env.REC === '1' ? 2600 : 1100);
    await page.screenshot({ path: path.join(OUT, 'tarjetas', `p${p.id.replace('.', '_')}.png`), timeout: 30000 }).catch(() => {});
    bitacora.push({ id: p.id, az: v.az, el: v.el, r: r1(rFinal), t: enc.t.map(r1), corte: eje ? `${eje}=${r1(v.corte[1])}${voltea ? ' (volteado: la cámara del lado removido)' : ''}` : null,
      aislado: aislado ? `${(aislado.protagonistas || []).length} protagonistas · ${(aislado.tenues || []).length} tenues · ${aislado.ocultos} ocultos` : 'todo visible',
      cotas: (cotas || []).filter(Boolean).map((c) => `${c.et} ${r2(Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1], c.b[2] - c.a[2]))} mm`), camaraDentroDe: dentro });
    console.log(ts(), `${p.id.padEnd(4)} ${SIGNO[p.v].padEnd(10)} ${p.que} — ${p.medido.slice(0, 150)}`);
  }
  await page.evaluate(() => { const f = window.__forgeBrep; f.inspeccion.corte(null); f.inspeccion.cota(null); f.inspeccion.aislar(null); f.inspeccion.estado(0, 0); });

  // ── LOS PLANOS (las láminas se numeran DESDE LA PÁGINA 0: ensamble + BOM) ────────────────────────────
  let planos = { paginas: 0 };
  if (process.env.PLANOS === '1') {
    await letrero('8 · ¿EL PLANO = EL 3D?', 'generando el juego de láminas del molde de esta pieza', '#ffcc33');
    await page.evaluate(() => document.querySelector('[data-testid="parte-lente-planos"]').click());
    const hay = await page.waitForFunction(`!!document.querySelector('[data-testid="planos-del-molde"]')`, null, { timeout: 300000 }).then(() => true).catch(() => false);
    if (hay) {
      const n = await page.evaluate(() => +document.querySelector('[data-testid="planos-del-molde"]').dataset.paginas || 0);
      planos.paginas = n; fs.mkdirSync(path.join(OUT, 'laminas'), { recursive: true });
      await page.evaluate(() => { const c = document.getElementById('__insp'); if (c) c.style.display = 'none'; });
      let cap = 0;
      for (let k = 0; k < n; k++) {          // ← DESDE 0: la pasada 1 empezaba en 1 y «faltaba» la de ensamble
        const okk = await page.evaluate((k) => { const b = document.querySelector(`[data-testid="planos-del-molde-pagina-${k}"]`); if (b) { b.click(); return true; } return false; }, k);
        if (!okk) break; await page.waitForTimeout(process.env.REC === '1' ? 1300 : 600);
        const svg = await page.$('[data-testid="planos-del-molde-svg"]');
        if (svg) { await svg.screenshot({ path: path.join(OUT, 'laminas', `lam-${String(k).padStart(2, '0')}.png`), timeout: 30000 }).catch(() => {}); cap++; }
      }
      planos.capturadas = cap;
      await page.evaluate(() => { const c = document.getElementById('__insp'); if (c) c.style.display = ''; });
    }
    const txt = await page.evaluate(() => document.body.textContent);
    const mq = (txt.slice(Math.max(0, txt.indexOf('inyectora'))).match(/(FCS HT-150SV \(taller\)|IM-\d+|HM320[^CVA]*)\s*(CUMPLE|VIOLA|ADVIERTE)/) || []);
    planos.maquina = mq[1] ? `${mq[1]} ${mq[2]}` : 'sin dictamen de máquina en las láminas';
    P.push({ id: '4.1', preg: '4 · ¿CABE EN LA INYECTORA?', que: 'la inyectora del taller juzgada en la lámina de análisis', medido: planos.maquina + ` · altura del molde ${r1(clamp2.max[2] - bottom.min[2])} mm + apertura ${r1(apertura)} mm`, pide: 'CUMPLE (luz, barras, tonelaje, carrera)', v: /CUMPLE/.test(planos.maquina) ? 'ok' : /VIOLA/.test(planos.maquina) ? 'falla' : 'info' });
    P.push({ id: '8.1', preg: '8 · ¿EL PLANO = EL 3D?', que: 'el juego de láminas existe y se deja mirar (desde la página 0 = ensamble + BOM)', medido: `${planos.capturadas ?? 0} de ${planos.paginas} láminas capturadas, empezando en la 0 (la comparación cota-por-cota contra el sólido AÚN no existe)`, pide: '≥ 3 láminas · cada cota = el sólido', v: (planos.capturadas ?? 0) >= 3 ? 'mirar' : 'falla' });
    console.log(ts(), `planos: ${planos.capturadas}/${planos.paginas} láminas (desde la 0) · ${planos.maquina}`);
  }

  const resumen = { ok: P.filter((p) => p.v === 'ok').length, falla: P.filter((p) => p.v === 'falla').length, mirar: P.filter((p) => p.v === 'mirar').length };
  await letrero(`INSPECCIÓN DE ${path.basename(STEP).replace(/\.(stp|step)$/i, '')}: ${resumen.ok} cumplen · ${resumen.falla} FALLAN · ${resumen.mirar} para mirar`, P.filter((p) => p.v === 'falla').map((p) => `✗ ${p.id} ${p.que}`).join(' &nbsp;·&nbsp; ') || 'sin fallas en los puntos medidos', resumen.falla ? ROJO : '#7ee2a8');
  await page.waitForTimeout(process.env.REC === '1' ? 5000 : 800);
  fs.writeFileSync(path.join(OUT, 'inspeccion.json'), JSON.stringify({
    pieza: path.basename(STEP), armado: true, tInspeccionS: Math.round(tInspeccion), base: [r1(Wb), r1(Db)], alturaPiezaMm: r1(Hp), pared: D.pared, dAgua: r2(dAgua),
    leyenda, telemetria: D.tel, cotasOff, ficha: ficha.slice(0, 400),
    puntos: P.map(({ vista, ...x }) => x), bitacoraDeVistas: bitacora,
    caraReal: { pisoPorRayo: r2(zPisoReal), pisoPorFormula: r2(pisoFormula), techoMacho: r2(zTechoMacho), puntasVsCara: puntasCara, tiraPuntasVsCara: D.puntasVsCara },
    balanceExpulsion: { centroidePines: cenPin.map(r2), centroPieza: [r2(pcx), r2(pcy)], desbalanceMm: r2(desbalance) },
    aguaVsMoviles: paresAgua.map((p) => ({ a: p.a, b: p.b, mm: p.mm })), crucesBajoMedioD: cruces.map((p) => `${p.a}↔${p.b} ${p.mm}`),
    colisionesReales: reales, noConcluyentesVoxel: dudosas, noJuzgadasMulticuerpo: noJuzgados,
    rotuloMaterialPieza: 'el rótulo «PP» de la pieza es un LITERAL de cursoPart (se reporta, no se toca — es de otra orden)',
    planos, resumen,
  }, null, 1));
  console.log(ts(), JSON.stringify(resumen), '· no concluyentes (vóxel):', dudosas.length, '· no juzgadas (multi-cuerpo):', noJuzgados.length);
  await ctx.close(); await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
