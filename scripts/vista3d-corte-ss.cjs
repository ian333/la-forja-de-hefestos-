/**
 * ARNÉS DE "EL CORTE VIVO" — abre la vista REAL y la MANEJA.
 * ============================================================================
 * El gate no es "compila": es *se puede usar*. Este arnés MUEVE el plano de
 * corte a varias posiciones (incluida la del sprue = la lámina L5), cambia de
 * EJE, ORBITA de verdad (arrastre con el mouse), ARRASTRA el slider midiendo los
 * frames (que "se sienta instantáneo" es un número, no una opinión) y hace CLIC
 * de SONDA sobre la cara del corte. Guarda un PNG por estado para que un agente
 * con ojos los abra y juzgue: ¿se ve el interior?, ¿la cara del corte está
 * MACIZA o se ve hueca?, ¿las cotas están donde deben?, ¿hay z-fighting?,
 * ¿texto encimado?
 *
 * Corre en iangpu (GPU real vía ANGLE/D3D12). Vite DEV, no preview: la vista lee
 * los STL del banco por `/test-parts/...` y dev sirve la raíz del repo.
 *
 * Uso (en iangpu, con el repo en /home/ian/Orkesta/la-forja):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   URL=http://localhost:5178/vista3d-corte.html \
 *   node /home/ian/Orkesta/la-forja/scripts/vista3d-corte-ss.cjs
 *
 * Variables: URL · SHOTDIR · W · H
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.URL || 'http://localhost:5178/vista3d-corte.html';
const DIR = process.env.SHOTDIR || '/home/ian/Orkesta/la-forja/forja-shots/vista3d-corte';
const W = Number(process.env.W || 1600), H = Number(process.env.H || 1000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

  const benigno = (s) => /WebGL context|WebGL2?RenderingContext|THREE\.WebGLRenderer|Download the React DevTools/i.test(s);
  const errs = [], warns = [], ignorados = [];
  page.on('pageerror', (e) => { const s = String(e).slice(0, 260); if (!benigno(s)) errs.push(s); });
  page.on('console', (m) => {
    const url = (m.location() && m.location().url) || '';
    const s = `${m.type()}: ${m.text()}`.slice(0, 260) + (url ? ` @ ${url.slice(-40)}` : '');
    if (/favicon\.ico/.test(url)) { ignorados.push(s); return; }
    if (m.type() === 'error' && !benigno(s)) errs.push(s);
    else if (m.type() === 'warning' && !benigno(s)) warns.push(s);
  });
  const fallidas = [];
  page.on('response', (r) => { if (r.status() >= 400) fallidas.push(`${r.status()} ${r.url().slice(0, 120)}`); });

  const out = { url: URL, checks: {}, estados: {}, errs, warns, ignorados, fallidas, shots: [] };
  const disparo = async (n) => { const p = `${DIR}/${n}.png`; await page.screenshot({ path: p, timeout: 30000 }); out.shots.push(p); return p; };
  const estado = () => page.evaluate(() => {
    const v = window.__vista3dCorte;
    if (!v) return null;
    return JSON.parse(JSON.stringify({
      listo: v.listo, error: v.error, eje: v.eje, t: v.t, tCalculado: v.tCalculado, desfasado: v.desfasado,
      cMm: v.cMm, rango: v.rango, tSprue: v.tSprue, cajaMolde: v.cajaMolde, origen: v.origen, supuesto: v.supuesto,
      nTriMolde: v.nTriMolde, nTriMoldeo: v.nTriMoldeo, zPartMm: v.zPartMm, ms: v.ms, cortadas: v.cortadas,
      areaMm2: v.areaMm2, tapasFallidas: v.tapasFallidas, lazosAbiertos: v.lazosAbiertos,
      carasTangentes: v.carasTangentes, corrimientoMm: v.corrimientoMm, aviso: v.aviso, tImpresiones: v.tImpresiones,
      tapas: v.tapas, cotas: v.cotas, veredictos: v.veredictos, datos: v.datos,
      razonSinCotas: v.razonSinCotas, rotulos: v.rotulos, lectura: v.lectura, uv: v.uv || null, traza: v.traza || null, molde: v.molde || null,
    }));
  });

  /** mueve el slider de React (setter nativo + evento input: si no, React ignora) */
  const ponerT = async (t) => {
    await page.$eval('[data-testid="vc-corte"]', (el, v) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, t);
    await sleep(700);
  };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="vista3d-corte-view"]', { timeout: 45000 });
    await page.waitForFunction('!!document.querySelector("canvas") && !!window.__vista3dCorte', null, { timeout: 60000 });
    await page.waitForFunction('window.__vista3dCorte && window.__vista3dCorte.listo === true', null, { timeout: 90000 });
    await sleep(1500);

    out.gpu = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      if (!gl) return 'sin contexto';
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'sin extensión';
    });
    out.checks.gpu_real = !/SwiftShader|llvmpipe|software/i.test(String(out.gpu));

    const s0 = await estado();
    out.molde = {
      molde: s0.molde, origen: s0.origen, supuesto: s0.supuesto, nTriMolde: s0.nTriMolde, nTriMoldeo: s0.nTriMoldeo,
      cajaMolde: s0.cajaMolde, zPartMm: s0.zPartMm, tSprue: s0.tSprue,
    };
    out.checks.molde_armado = !!s0.cajaMolde && s0.nTriMolde > 0;
    out.checks.sin_error_de_montaje = !s0.error;

    // ── EL PLANO RECORRE LA PIEZA: 5 posiciones sobre el eje X ──
    const POS = [0.20, 0.35, null /* sprue */, 0.65, 0.80];
    for (const t of POS) {
      const tt = t === null ? s0.tSprue.x : t;
      await ponerT(tt);
      const s = await estado();
      const nombre = t === null ? 'x-sprue-L5' : `x-t${String(tt).replace('.', '')}`;
      out.estados[nombre] = {
        t: s.t, cMm: s.cMm, ms: s.ms, cortadas: s.cortadas, areaMm2: s.areaMm2,
        tapasFallidas: s.tapasFallidas, lazosAbiertos: s.lazosAbiertos, carasTangentes: s.carasTangentes, corrimientoMm: s.corrimientoMm,
        tapas: s.tapas.map((x) => `${x.id}:${x.areaMm2}mm²/${x.tris}tri`),
        cotas: s.cotas, veredictos: s.veredictos, rotulos: s.rotulos,
      };
      await disparo(nombre);
    }

    const sSprue = out.estados['x-sprue-L5'];
    out.checks.corte_mueve = new Set(POS.map((t) => (t === null ? 'sprue' : t)).map((_, i) => Object.values(out.estados)[i].cMm)).size === POS.length;
    out.checks.tapa_siempre_maciza = Object.values(out.estados).every((e) => e.tapasFallidas === 0);
    out.checks.sin_lazos_abiertos = Object.values(out.estados).every((e) => e.lazosAbiertos === 0);
    out.checks.sin_caras_tangentes = Object.values(out.estados).every((e) => !e.carasTangentes);
    out.checks.L5_corta_todo = sSprue.cortadas >= 6;
    out.checks.L5_con_cotas = sSprue.cotas.length >= 3;
    out.checks.L5_cota_agua = sSprue.cotas.some((c) => /H_line/.test(c.texto));
    out.checks.L5_cota_inserto = sSprue.cotas.some((c) => /H_ins/.test(c.texto));
    out.checks.L5_cota_mejilla = sSprue.cotas.some((c) => /cheek/.test(c.texto));
    out.checks.L5_cota_cavidad = sSprue.cotas.some((c) => /H_cavity/.test(c.texto));
    out.checks.instantaneo_por_corte = Object.values(out.estados).every((e) => e.ms < 120);
    out.msPorCorte = Object.values(out.estados).map((e) => e.ms);

    // ── EJE Y ── (el corte transversal: el agua sale como círculos)
    await page.click('[data-testid="vc-eje-y"]');
    await sleep(900);
    await page.click('[data-testid="vc-sprue"]');
    await sleep(900);
    const sy = await estado();
    out.estados['y-sprue'] = { eje: sy.eje, t: sy.t, cMm: sy.cMm, ms: sy.ms, cortadas: sy.cortadas, cotas: sy.cotas, tapasFallidas: sy.tapasFallidas };
    out.checks.eje_y_corta = sy.eje === 'y' && sy.cortadas >= 5 && sy.tapasFallidas === 0;
    await disparo('y-sprue');

    // ── EJE Z (planta) — aquí las cotas de altura NO aplican y hay que decirlo ──
    await page.click('[data-testid="vc-eje-z"]');
    await sleep(900);
    // la planta ÚTIL es la de la cavidad: un pelo ARRIBA de la partición (en la
    // partición exacta el plano es tangente a las caras y solo saca coplanares)
    await ponerT(Math.min(0.98, s0.tSprue.z + 0.02));
    const sz = await estado();
    out.estados['z-planta'] = { eje: sz.eje, t: sz.t, cMm: sz.cMm, ms: sz.ms, cortadas: sz.cortadas, cotas: sz.cotas, razon: sz.razonSinCotas, tapasFallidas: sz.tapasFallidas };
    out.checks.eje_z_corta = sz.eje === 'z' && sz.cortadas >= 3 && sz.tapasFallidas === 0;
    out.checks.eje_z_declara_sin_cotas = !!sz.razonSinCotas && sz.cotas.length === 0;
    await disparo('z-planta');

    // ── de vuelta a X, al sprue: base para orbitar y sondear ──
    await page.click('[data-testid="vc-eje-x"]');
    await sleep(700);
    await page.click('[data-testid="vc-sprue"]');
    await sleep(1000);

    // ── ARRASTRE DEL SLIDER: ¿se siente instantáneo? se MIDEN los frames ──
    await page.evaluate(() => {
      window.__fps = { n: 0, t0: performance.now(), peor: 0, ult: performance.now() };
      const paso = () => {
        const t = performance.now();
        window.__fps.peor = Math.max(window.__fps.peor, t - window.__fps.ult);
        window.__fps.ult = t; window.__fps.n++;
        window.__fps.id = requestAnimationFrame(paso);
      };
      window.__fps.id = requestAnimationFrame(paso);
    });
    const sb = await page.$eval('[data-testid="vc-corte"]', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    await page.mouse.move(sb.x + sb.w * 0.25, sb.y + sb.h / 2);
    await page.mouse.down();
    for (let i = 0; i <= 24; i++) { await page.mouse.move(sb.x + sb.w * (0.25 + i * 0.02), sb.y + sb.h / 2); await sleep(35); }
    await page.mouse.up();
    await sleep(500);
    out.arrastre = await page.evaluate(() => {
      cancelAnimationFrame(window.__fps.id);
      const dt = performance.now() - window.__fps.t0;
      return { fps: +(window.__fps.n / (dt / 1000)).toFixed(1), peorFrameMs: Math.round(window.__fps.peor) };
    });
    const sArr = await estado();
    out.arrastre.tFinal = sArr.t; out.arrastre.cMm = sArr.cMm; out.arrastre.desfasado = sArr.desfasado;
    out.checks.arrastre_fluido = out.arrastre.fps >= 24 && out.arrastre.peorFrameMs < 400;
    out.checks.arrastre_mueve_el_corte = Math.abs(sArr.t - sSprue.t) > 0.05;
    await disparo('arrastrado');

    // ── ORBITAR de verdad: el corte tiene que seguir mirando a la cámara ──
    await page.click('[data-testid="vc-sprue"]');
    await sleep(900);
    const bb = await page.$eval('[data-testid="vc-visor"]', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    // la lectura de ANTES: girar la cámara NO puede dejar una lectura falsa
    const lecAntes = JSON.stringify((await estado()).lectura);
    await page.mouse.move(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5);
    await page.mouse.down();
    for (let i = 1; i <= 16; i++) { await page.mouse.move(bb.x + bb.w * 0.5 + i * 19, bb.y + bb.h * 0.5 - i * 5); await sleep(28); }
    await page.mouse.up();
    await sleep(900);
    const trasOrbita = await estado();
    out.orbita = { lecAntes, lecDespues: JSON.stringify(trasOrbita.lectura), traza: trasOrbita.traza };
    out.checks.orbitar_no_sondea = JSON.stringify(trasOrbita.lectura) === lecAntes;
    await disparo('orbitada');

    // ── orbitada MÁS ALLÁ del plano: el recorte debe auto-voltear ──
    await page.mouse.move(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5);
    await page.mouse.down();
    for (let i = 1; i <= 22; i++) { await page.mouse.move(bb.x + bb.w * 0.5 - i * 21, bb.y + bb.h * 0.5 + i * 3); await sleep(26); }
    await page.mouse.up();
    await sleep(1000);
    await disparo('orbitada-al-otro-lado');

    // ── ZOOM: el detalle de la compuerta/bebedero (L7) ──
    await page.mouse.move(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5);
    await page.mouse.wheel(0, -520);
    await sleep(900);
    await disparo('acercada');
    await page.mouse.wheel(0, 520);
    await sleep(800);

    // ── SONDA: clic sobre la cara del corte, en varios puntos ──
    await page.click('[data-testid="vc-sprue"]');
    await sleep(900);
    const puntos = [];
    for (const fx of [0.34, 0.46, 0.54, 0.66]) for (const fy of [0.34, 0.46, 0.58]) puntos.push([fx, fy]);
    out.sondas = [];
    for (const [fx, fy] of puntos) {
      await page.mouse.click(bb.x + bb.w * fx, bb.y + bb.h * fy);
      await sleep(260);
      const s = await estado();
      out.sondas.push({ punto: [fx, fy], uv: s.uv || null, lectura: s.lectura });
    }
    out.componentesSondeados = [...new Set(out.sondas.filter((s) => s.lectura).map((s) => s.lectura.titulo))];
    const panel = await page.$eval('[data-testid="vc-lectura"]', (e) => (e.textContent || '').replace(/\s+/g, ' ')).catch(() => '');
    out.panelLectura = panel.slice(0, 300);
    out.checks.sonda_devuelve_componente = out.componentesSondeados.filter((t) => !/aire/.test(t)).length >= 2;
    out.checks.sonda_trae_seccion = out.sondas.some((s) => s.lectura && /§/.test(String(s.lectura.seccion)));
    out.checks.sonda_trae_cota = out.sondas.some((s) => s.lectura && /mm/.test(String(s.lectura.nota)));
    out.checks.sonda_en_panel = /SONDA/.test(panel) && panel.length > 60;
    await disparo('sondeada');

    // ── el encuadre de PRODUCCIÓN (la cámara del Estudio mira la PIEZA) ──
    await page.click('[data-testid="vc-foco"]');
    await sleep(1200);
    await disparo('encuadre-pieza');
    await page.click('[data-testid="vc-foco"]');
    await sleep(1000);

    // ── otra pieza: el molde se rearma solo ──
    await page.click('[data-testid="vc-pieza-tapa"]');
    await sleep(2600);
    await page.click('[data-testid="vc-sprue"]');    // el sprue de ESTE molde, no el t que quedó
    await sleep(1600);
    const sTapa = await estado();
    out.estados['pieza-tapa'] = {
      t: sTapa.t, cMm: sTapa.cMm, cortadas: sTapa.cortadas, ms: sTapa.ms, cotas: sTapa.cotas,
      tapasFallidas: sTapa.tapasFallidas, carasTangentes: sTapa.carasTangentes, corrimientoMm: sTapa.corrimientoMm,
      aviso: sTapa.aviso, nTriMoldeo: sTapa.nTriMoldeo, rango: sTapa.rango,
      tapas: sTapa.tapas.map((x) => `${x.id}:${x.areaMm2}mm²/${x.tris}tri`), molde: sTapa.molde,
      veredictos: sTapa.veredictos,
    };
    out.checks.cambia_de_pieza = sTapa.cortadas >= 5 && sTapa.tapasFallidas === 0 && !sTapa.carasTangentes;
    out.checks.multicavidad_avisa = !sTapa.molde || sTapa.molde.nCav === 1 || !!sTapa.aviso;

    // ── y el aviso SIRVE: ir a una impresión de verdad debe cortar la pieza ──
    if (sTapa.tImpresiones && sTapa.tImpresiones.x.length) {
      await ponerT(sTapa.tImpresiones.x[0]);
      const sImp = await estado();
      out.estados['tapa-impresion'] = {
        t: sImp.t, cMm: sImp.cMm, cortadas: sImp.cortadas, cotas: sImp.cotas,
        tapasFallidas: sImp.tapasFallidas, carasTangentes: sImp.carasTangentes,
        tapas: sImp.tapas.map((x) => `${x.id}:${x.areaMm2}mm²/${x.tris}tri`),
      };
      out.checks.impresion_corta_la_pieza = sImp.tapas.some((x) => x.id === 'moldeo') && sImp.cotas.length >= 3;
      await disparo('tapa-impresion');
    }
    await disparo('pieza-tapa');

    // ── sin spec: el camino de respaldo DECLARA su supuesto ──
    await page.click('[data-testid="vc-pieza-rpi4"]');
    await sleep(2200);
    await page.click('[data-testid="vc-spec"]');
    await sleep(2600);
    const sSin = await estado();
    out.checks.sin_spec_declara_supuesto = !!sSin.supuesto && /SUPUESTA/.test(sSin.supuesto);
    out.estados['sin-spec'] = { supuesto: sSin.supuesto, cortadas: sSin.cortadas, ms: sSin.ms };
    await disparo('sin-spec');
    await page.click('[data-testid="vc-spec"]');
    await sleep(1800);
  } catch (e) {
    out.fatal = String(e).slice(0, 400);
  }

  out.checks.sin_errores_de_consola = errs.length === 0;
  const duros = Object.entries(out.checks).filter(([, v]) => v === false).map(([k]) => k);
  out.reprobados = duros;
  out.veredicto = duros.length === 0 && !out.fatal ? 'PASA' : 'FALLA';

  fs.writeFileSync(`${DIR}/reporte.json`, JSON.stringify(out, null, 2));

  // manifiesto para el OJO del agente (los números no ven z-fighting ni texto encimado)
  const md = [
    '# EL CORTE VIVO — capturas para juzgar A OJO',
    '',
    `URL: ${URL} · GPU: ${out.gpu}`,
    `veredicto numérico: **${out.veredicto}**${duros.length ? ` · reprobados: ${duros.join(', ')}` : ''}`,
    '',
    'Qué buscar en CADA imagen:',
    '1. ¿se ve el INTERIOR del molde (no un bloque cerrado)?',
    '2. ¿la cara del corte está MACIZA y coloreada por componente, o se ve hueca/negra?',
    '3. ¿las cotas caen sobre lo que cotan y se leen (sin encimarse)?',
    '4. ¿hay z-fighting (parpadeo/rayas) en la cara del corte?',
    '5. ¿el naranja de la PIEZA se distingue del acero?',
    '',
    ...out.shots.map((p) => `## ${p.split('/').pop().replace('.png', '')}\n![](${p})`),
  ].join('\n');
  fs.writeFileSync(`${DIR}/OJO.md`, md);

  console.log(JSON.stringify({ veredicto: out.veredicto, reprobados: duros, gpu: out.gpu, fatal: out.fatal || null, ms: out.msPorCorte, arrastre: out.arrastre, errs: errs.slice(0, 6), shots: out.shots.length }, null, 2));
  await browser.close();
  process.exit(out.veredicto === 'PASA' ? 0 : 1);
})();
