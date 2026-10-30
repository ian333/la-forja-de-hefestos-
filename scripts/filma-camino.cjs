#!/usr/bin/env node
/**
 * LA FILMADORA — la película del camino SALE DE LA FORJA (orden 2026-10-22-la-pelicula-sale-de-la-forja).
 * ============================================================================
 * ian (2026-10-22): «el video de producción debe salir de La Forja», «no está a 60 fps», «entre un paso y el otro debería
 * haber una animación». Aquí no hay edición: todo lo que se ve (la cortina entre pasos, el riel de los 9 pasos, el Foco, la
 * inspección, los letreros) lo dibuja la app. Este script solo la MANEJA y la FILMA.
 *
 * CÓMO SE FILMA A 60 fps UNA APP QUE CALCULA (receta medida 2026-09-21, reference_filmar_cad_60fps_reloj_virtual):
 *   · un RELOJ VIRTUAL inyectado (performance.now / Date.now / rAF / setTimeout / setInterval). APAGADO, la app corre en tiempo
 *     real: ahí se hacen los cálculos pesados (cargar el STEP, armar el molde, generar láminas) — NO se filman.
 *   · ENCENDIDO, cada cuadro avanza 1000/60 ms exactos y se captura por CDP con clip.scale = DPR → 4K REAL (3840×2160).
 *   · el molde se arma en ~1:44 reales: se filma un plano corto CADA VEZ que aparece una estación nueva (el armado se ve,
 *     la espera no). En pantalla queda dicho cuánto tarda de verdad. Para que cada estación salga LIMPIA, el armado corre con
 *     el reloj virtual encendido y sus temporizadores CONGELADOS mientras se filma (`__vt.congela`): entre plano y plano se
 *     descongelan 0.5 s virtuales y la siguiente estación se calcula fuera de cámara. (La primera película, 2026-10-22, dejó
 *     el armado en tiempo real y las estaciones 4–7 pasaron mientras se filmaba la 3.)
 * uso: URL=http://localhost:4199/forja-brep.html node scripts/filma-camino.cjs <pieza.stp> <outDir>   (iangpu, receta GPU)
 */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const URL = process.env.URL || 'http://localhost:4199/forja-brep.html';
const STEP = process.argv[2], OUT = process.argv[3];
const FPS = 60, W = 1536, H = 864, DPR = 2.5;
/** HASTA=n: filma solo hasta el paso n (prueba corta antes de la corrida larga) */
const HASTA = +(process.env.HASTA || 9);
/** DESDE=n: rehace los cálculos SIN filmar y filma desde el paso n, en un navegador fresco. Medido 2026-10-22: tras ~5,100
 *  capturas 4K en UNA sesión el compositor se agota y los cuadros salen NEGROS (la toma 9 entera) — la misma fuga que obliga a
 *  «un contexto fresco por lote» en el render de cine. Se refilma el final aparte y se pega. */
const DESDE = +(process.env.DESDE || 1);
let pasoActual = 0;
fs.mkdirSync(path.join(OUT, 'cuadros'), { recursive: true });
const T0 = Date.now(); const ts = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + ' s';

const RELOJ_VIRTUAL = () => {
  const R = { now: performance.now.bind(performance), date: Date.now.bind(Date), raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window),
    st: window.setTimeout.bind(window), ct: window.clearTimeout.bind(window), si: window.setInterval.bind(window), ci: window.clearInterval.bind(window) };
  const V = { on: false, t: 0, d0: 0, rafs: new Map(), timers: new Map(), id: 1e9, congelado: false, movidos: new Map() };
  performance.now = () => (V.on ? V.t : R.now());
  Date.now = () => (V.on ? Math.round(V.d0 + V.t) : R.date());
  window.requestAnimationFrame = (cb) => { if (!V.on) return R.raf(cb); const id = ++V.id; V.rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { if (!V.rafs.delete(id)) R.caf(id); };
  window.setTimeout = (cb, ms, ...a) => { if (!V.on || typeof cb !== 'function') return R.st(cb, ms, ...a); const id = ++V.id; V.timers.set(id, { at: V.t + (+ms || 0), cb, a }); return id; };
  // un temporizador nacido virtual que `apaga()` pasó al reloj real conserva su id: clearTimeout(idVirtual) cancela el real (antes quedaba vivo con un cierre viejo)
  window.clearTimeout = (id) => { if (V.timers.delete(id)) return; const rid = V.movidos.get(id); if (rid != null) { V.movidos.delete(id); R.ct(rid); return; } R.ct(id); };
  window.setInterval = (cb, ms, ...a) => { if (!V.on || typeof cb !== 'function') return R.si(cb, ms, ...a); const id = ++V.id; V.timers.set(id, { at: V.t + (+ms || 0), cb, a, cada: Math.max(1, +ms || 0) }); return id; };
  window.clearInterval = (id) => { if (V.timers.delete(id)) return; const rid = V.movidos.get(id); if (rid != null) { V.movidos.delete(id); R.ci(rid); return; } R.ci(id); };
  const respiroReal = () => new Promise((r) => R.st(r, 0));
  window.__vt = {
    estado: () => ({ on: V.on, t: V.t, congelado: V.congelado, timers: V.timers.size }),
    // congelado: el tiempo y los rAF avanzan (la cámara, la cortina, el ciclo) pero NINGÚN setTimeout dispara — el armado del
    // molde (una estación por temporizador de 400 ms) espera a que la filmadora lo suelte
    congela(si) { V.congelado = !!si; },
    // el reloj virtual arranca donde va el real: nadie ve un salto
    enciende() { if (V.on) return V.t; V.t = R.now(); V.d0 = R.date() - V.t; V.on = true; return V.t; },
    // al apagar, lo pendiente vuelve al reloj real (los cálculos siguen su curso fuera de cámara)
    apaga() { if (!V.on) return; V.on = false; for (const cb of V.rafs.values()) R.raf(cb); V.rafs.clear();
      for (const [id, tm] of V.timers) V.movidos.set(id, tm.cada ? R.si(() => tm.cb(...tm.a), tm.cada) : R.st(() => tm.cb(...tm.a), Math.max(0, tm.at - V.t)));
      V.timers.clear(); },
    async avanza(ms) {
      const meta = V.t + ms;
      for (let g = 0; g < 5000 && !V.congelado; g++) {
        let sig = null, sigId = 0;
        for (const [id, tm] of V.timers) if (tm.at <= meta && (!sig || tm.at < sig.at)) { sig = tm; sigId = id; }
        if (!sig) break;
        if (sig.cada) sig.at += sig.cada; else V.timers.delete(sigId);
        V.t = Math.max(V.t, Math.min(meta, sig.cada ? sig.at - sig.cada : sig.at));
        try { sig.cb(...sig.a); } catch (e) { console.error('VT_TIMER', e); }
        await respiroReal();
      }
      V.t = meta;
      const cbs = [...V.rafs.values()]; V.rafs.clear();
      for (const cb of cbs) { try { cb(V.t); } catch (e) { console.error('VT_RAF', e); } }
      await respiroReal(); await respiroReal();
      await new Promise((r) => R.raf(() => r()));
      return V.t;
    },
  };
};

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=gl', '--disable-software-rasterizer', '--hide-scrollbars'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  await page.addInitScript(RELOJ_VIRTUAL);
  if (process.env.SIN_LENTE || process.env.SIN_COTAS) await page.addInitScript(({ l, c }) => { if (l) window.__sinLenteMuerta = true; if (c) window.__sinCotasOff = true; }, { l: !!process.env.SIN_LENTE, c: !!process.env.SIN_COTAS });   // arnés
  page.on('pageerror', (e) => console.log(ts(), 'PAGEERR', String(e).slice(0, 200)));
  const cdp = await ctx.newCDPSession(page);
  let n = 0; const tomas = [];
  /** filma `seg` segundos; `cada(k)` corre ANTES de cada cuadro (cámara por fórmula, gestos en un cuadro exacto). Si `cada` devuelve
   *  'fin', la toma corta ahí (la inspección dura lo que duran SUS puntos: el recorrido avisa con `data-fin`, orden I 2026-10-29) */
  const filma = async (nombre, seg, cada, sigue = false) => {
    pasoActual = +nombre.slice(0, 2);
    if (pasoActual < DESDE) { if (!sigue) await page.evaluate(() => window.__vt.apaga()); console.log(ts(), `(sin filmar: «${nombre}»)`); return; }
    await page.evaluate(() => window.__vt.enciende());
    const k0 = n, N = Math.round(seg * FPS);
    for (let k = 0; k < N; k++) {
      if (cada && (await cada(k)) === 'fin') break;
      await page.evaluate(async (paso) => { await window.__vt.avanza(paso); }, 1000 / FPS);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true, clip: { x: 0, y: 0, width: W, height: H, scale: DPR } });
      fs.writeFileSync(path.join(OUT, 'cuadros', String(n).padStart(6, '0') + '.jpg'), Buffer.from(data, 'base64')); n++;
    }
    if (!sigue) await page.evaluate(() => window.__vt.apaga());   // `sigue`: el reloj se queda encendido (y congelado) para la siguiente estación
    tomas.push({ nombre, desde: k0 / FPS, hasta: n / FPS });
    console.log(ts(), `toma «${nombre}» ${seg}s → ${n} cuadros (${(n / FPS).toFixed(1)} s de película)`);
  };
  const ev = (f, a) => page.evaluate(f, a);
  const clic = (id) => ev((id) => { const b = document.querySelector(`[data-testid="${id}"]`); if (b) b.click(); return !!b; }, id);
  const espera = (expr, ms = 600000) => page.waitForFunction(expr, null, { timeout: ms, polling: 250 });
  const orbita = (az, el, r, c) => ev(({ az, el, r, c }) => window.__forgeBrep.orbitTo(az, el, r, c[0], c[1], c[2]), { az, el, r, c });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // OJO (medido 2026-10-22 en producción): `__forgeBrep.ready` se queda en false en reposo aunque la API ya esté completa (187
  // claves). Se espera a la API; el «listo» de verdad es que la pieza soltada aparezca (el-parte-foco, más abajo).
  // (y arg = null: las opciones de waitForFunction van en el TERCER parámetro; en el segundo Playwright usa 30 s)
  await page.waitForFunction('window.__forgeBrep && Object.keys(window.__forgeBrep).length > 50', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  console.log(ts(), 'GPU:', await ev(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; }));
  await page.waitForTimeout(1500);

  // 1 · ABRES LA FORJA — el lienzo limpio (la cortina del paso 1 la pide la filmadora: no hay cambio de estado que la dispare)
  await ev(() => window.__forgeBrep.transicion(1));
  await filma('01 abres la forja', 3.6);

  // 2 · TU PIEZA — se suelta el STEP (carga real, fuera de cámara) y la cámara rodea la pieza con sus 3 cotas
  const b64 = fs.readFileSync(STEP).toString('base64');
  await ev(({ b64, name }) => { const el = document.querySelector('.fb-root'); const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    const dt = new DataTransfer(); dt.items.add(new File([u8], name)); for (const t of ['dragenter', 'dragover', 'drop']) el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt })); }, { b64, name: path.basename(STEP) });
  await espera(`!!document.querySelector('[data-testid="el-parte-foco"]')`, 240000);
  await page.waitForTimeout(2500);
  await clic('aviso-entrada-ok');
  if (process.env.DISENO) { await clic('tab-diseno'); await page.waitForTimeout(400); }   // arnés: el CAD entero, sin modo camino
  await ev(() => window.__forgeBrep.transicion(2));
  await filma('02 tu pieza', 5.5);

  if (HASTA <= 2) { fs.writeFileSync(path.join(OUT, 'tomas.json'), JSON.stringify({ fps: FPS, tomas }, null, 1)); console.log(ts(), 'FIN (HASTA=2)', n); await browser.close(); return; }
  // 3 · EL ENFRIAMIENTO — el campo se calcula en real; la cortina y el reloj de la pieza enfriándose, en virtual
  await clic('parte-lente-enfriamiento');
  await espera(`!!document.querySelector('[data-testid="escala-enfriamiento"]')`, 180000);
  await page.waitForTimeout(1200);
  await ev(() => window.__forgeBrep.transicion(3));
  await filma('03 el enfriamiento', 8);

  // 4 · EL DICTAMEN (tecla D)
  await page.keyboard.press('d'); await page.waitForTimeout(1200);
  await ev(() => window.__forgeBrep.transicion(4));
  await filma('04 el dictamen', 5.5);
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);

  // 5 · LA PARTICIÓN
  await clic('parte-lente-particion'); await page.waitForTimeout(1500);
  await ev(() => window.__forgeBrep.transicion(5));
  await filma('05 la particion', 4.5);

  // 6 · EL MOLDE — el armado avanza una estación por temporizador (400 ms). Con el reloj virtual ENCENDIDO desde antes del clic
  // todos esos temporizadores nacen virtuales: la filmadora los suelta de 0.5 s en 0.5 s (el cálculo pesado corre ahí, fuera de
  // cámara) y los CONGELA mientras filma — cada estación nueva sale limpia 1.8 s, ninguna pasa a escondidas.
  // (Si se refilma desde el 7 en adelante, el molde se arma en real como siempre: no hay nada que filmar.)
  const tArmado = Date.now();
  const armadoVirtual = DESDE <= 6;
  const estacion = () => ev(() => { const m = document.querySelector('[data-testid="molde-de-la-pieza"]'); return m ? { est: +m.dataset.estacion, pm: m.dataset.portamoldes === '1' } : null; });
  /** deja correr el armado `ms` virtuales (temporizadores vivos) y lo vuelve a congelar; en real, solo espera */
  const sueltaArmado = async (ms) => {
    if (!armadoVirtual) { await page.waitForTimeout(ms); return; }
    await page.waitForTimeout(40);   // que React asiente sus commits (reales) antes de disparar temporizadores virtuales
    await ev((ms) => { window.__vt.congela(false); return window.__vt.avanza(ms); }, ms);
    await ev(() => window.__vt.congela(true));
    await page.waitForTimeout(60);   // aire real: lo que el armado haya mandado a un worker o a una promesa
  };
  // EL ARRANQUE VA EN TIEMPO REAL (medido 2026-10-23): al tocar MOLDE la máquina mide la pared (intake) y EL PUENTE re-siembra la
  // E1 con esa pared en el commit siguiente; el temporizador de la E2 nace en el commit anterior, atado a la pieza MACIZA, y el
  // efecto lo cancela cuando llega la re-siembra. Con el reloj virtual congelado desde antes del clic, `avanza` disparaba ese
  // temporizador ANTES de que React re-dibujara: la E2 corría con la pieza maciza y el molde salía de OTRA pieza (agua «manda la
  // pieza 2350 s», 0 pines por agarre, F 40 kN). Por eso el reloj se enciende hasta que la E3 ya existe (la pared ya entró).
  await clic('parte-lente-molde');
  await espera(`(() => { const m = document.querySelector('[data-testid="molde-de-la-pieza"]'); return m && +m.dataset.estacion >= 3 && m.dataset.pared; })()`, 300000);
  if (armadoVirtual) await ev(() => { window.__vt.enciende(); window.__vt.congela(true); });
  await ev(() => window.__forgeBrep.transicion(6));
  await filma('06 el molde · nace el acero', 3.2, null, true);
  let ultima = 3;
  for (let g = 0; g < 2400; g++) {
    const e = await estacion();
    if (e && e.est > ultima) {
      ultima = e.est;
      // lo que la máquina DICE de cada estación queda en el log (la tarjeta y la pared que entró): es la evidencia de que el molde es de ESTA pieza
      console.log(ts(), `  estación ${e.est} · pared=${await ev(() => document.querySelector('[data-testid="molde-de-la-pieza"]')?.dataset.pared)} · ${await ev(() => document.querySelector('[data-testid="tarjeta-estacion"]')?.textContent?.slice(0, 120))}`);
      await filma(`06 el molde · estación ${e.est}`, 1.8, null, true);
    }
    if (e && e.pm) break;
    await sueltaArmado(500);
  }
  console.log(ts(), `el molde se armó en ${((Date.now() - tArmado) / 1000).toFixed(0)} s reales`);
  // EL SEGURO: un molde de ESTA pieza trae sus pines por agarre (E7). Si no los trae, la carrera del arranque ganó (ver arriba):
  // se dice y se sale con rc=3 para que el lote se repita, en vez de entregar una película de otra pieza.
  { const pines = await ev(() => document.querySelector('[data-testid="molde-de-la-pieza"]')?.dataset.pinesIds || '');
    if (!pines) { console.error(ts(), 'MOLDE_SOSPECHOSO: la E7 no trae pines por agarre — el molde no es de esta pieza; se repite el lote'); await browser.close().catch(() => {}); process.exit(3); } }
  if (armadoVirtual) { await ev(() => window.__vt.congela(false)); await sueltaArmado(300); }   // el ciclo arranca con sus temporizadores vivos
  await page.waitForTimeout(1500);
  // el molde TRABAJA (su ciclo de 14 s: llena, abre, expulsa) con la cámara girando despacio
  const M = await ev(() => { const G = window.__forgeBrep.moldGeom().filter((g) => !g.role.startsWith('platina')); const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const g of G) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], g.min[k]); mx[k] = Math.max(mx[k], g.max[k]); } return { c: [0, 1, 2].map((k) => (mn[k] + mx[k]) / 2), d: Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) }; });
  const C = [M.c[0], M.c[1], M.c[2] + 8];
  // el ciclo entero (≈14 s: cierra, se llena, abre, expulsa) con la cámara girando despacio
  await filma('06 el molde trabaja', 14.5, (k) => (k % 3 === 0 ? orbita(28 + k * 0.03, 22, M.d * 1.3, C) : null));
  if (HASTA <= 6) { fs.writeFileSync(path.join(OUT, 'tomas.json'), JSON.stringify({ fps: FPS, px: `${W * DPR}×${H * DPR}`, tomas }, null, 1)); console.log(ts(), 'FIN (HASTA=6)', n); await browser.close(); return; }

  // 7 · LA INSPECCIÓN — todo su recorrido corre con setTimeout y rAF: se filma ENTERO en virtual (cortina → pulso → 4 puntos)
  // el reloj virtual se enciende ANTES del clic: así los setTimeout de la secuencia (cortina 2.3 s, pulso 5.5 s, 11 s por punto,
  // 12.5 el que anima) nacen en tiempo virtual y la película los filma exactos
  if (DESDE <= 7) {
  await ev(() => window.__vt.enciende());
  await clic('parte-lente-inspeccion');
  // LA INSPECCIÓN SEGÚN KAZMER (orden I, 2026-10-29): ya no son 4 puntos fijos de 11 s — son los del dictamen VIVO, cada uno con su
  // `dur`. Se filma hasta que el recorrido avisa que terminó (`data-fin="1"`, tope 300 s) y se anota cuándo empieza cada punto
  // (`inspeccion-puntos.json`: de ahí salen los «en» del guion y el cuadro de cada punto).
  const puntos7 = []; let idx7 = null;
  await filma('07 la inspeccion', 300, async (k) => {
    if (k % 6) return null;
    const r = await ev(() => { const e = document.querySelector('[data-testid="inspeccion-recorrido"]'); return e ? { idx: e.dataset.idx, id: e.dataset.id, fin: e.dataset.fin } : null; });
    if (r && r.idx !== idx7) { idx7 = r.idx; puntos7.push({ idx: +r.idx, id: r.id, t: +(k / FPS).toFixed(2), cuadro: n }); console.log(ts(), `  punto ${r.idx} «${r.id}» a los ${(k / FPS).toFixed(1)} s del paso 7`); }
    return r && r.fin === '1' ? 'fin' : null;
  });
  fs.writeFileSync(path.join(OUT, 'inspeccion-puntos.json'), JSON.stringify(puntos7, null, 1));
  }
  if (HASTA <= 7) { fs.writeFileSync(path.join(OUT, 'tomas.json'), JSON.stringify({ fps: FPS, px: `${W * DPR}×${H * DPR}`, tomas }, null, 1)); console.log(ts(), 'FIN (HASTA=7)', n); await browser.close(); return; }

  // 8 · LOS PLANOS — se generan en real; se filma la hoja de análisis (la inyectora del taller juzgada)
  await clic('parte-lente-planos');
  await espera(`!!document.querySelector('[data-testid="planos-del-molde"]')`, 180000);
  await page.waitForTimeout(1500);
  await clic('planos-del-molde-pagina-0'); await page.waitForTimeout(2500);   // la lámina del ENSAMBLE, no la hoja de análisis (crítica 2026-10-23: una tabla no es un plano)
  await ev(() => window.__forgeBrep.transicion(8));
  await filma('08 los planos', 6);
  await clic('btn-planos-molde-close'); await page.waitForTimeout(800);

  // 9 · EL EXPEDIENTE
  await clic('parte-lente-expediente'); await espera(`!!document.querySelector('[data-testid="expediente-de-la-pieza"]')`, 60000);
  await page.waitForTimeout(1500);
  await ev(() => window.__forgeBrep.transicion(9));
  await filma('09 el expediente', 6);

  fs.writeFileSync(path.join(OUT, 'tomas.json'), JSON.stringify({ fps: FPS, px: `${W * DPR}×${H * DPR}`, tomas }, null, 1));
  console.log(ts(), `FIN · ${n} cuadros = ${(n / FPS).toFixed(1)} s de película`);
  await browser.close().catch(() => {});
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
