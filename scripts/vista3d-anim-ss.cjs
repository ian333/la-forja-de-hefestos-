/**
 * ARNÉS DE LAS DOS VISTAS 3D ANIMADAS — las abre, las MANEJA y las juzga con números.
 * ============================================================================
 * El gate no es "compila": es *se mueve de verdad*. Este arnés, sobre GPU real (iangpu,
 * ANGLE/D3D12):
 *
 *   · abre `vista3d-anim.html` (banco de dev que monta los componentes EXACTAMENTE
 *     como los montará `EstudioVivo.tsx`: mismo Canvas, mismo encuadre, mismas luces)
 *   · BARRE el slider `t` en ≥5 pasos por vista (arrastrando el input real, no
 *     mutando estado por dentro) y guarda un PNG por paso
 *   · ORBITA la cámara con el mouse sobre el canvas y captura
 *   · hace CLIC DE SONDA sobre la pieza y verifica que devuelva una lectura
 *   · comprueba INVARIANTES que no dependen de mi opinión:
 *       LLENADO  — el volumen llenado CRECE MONÓTONO con t (medido barriendo, no
 *                  supuesto), arranca en ~0, cierra en el volumen alcanzable, y
 *                  las soldaduras/trampas de gas no decrecen
 *       APERTURA — la apertura d CRECE MONÓTONA, el molde SE MUEVE de verdad entre
 *                  pasos (diferencia de píxeles > umbral), y si el barrido dice que
 *                  hay pares que interfieren, en algún t tiene que haber ROJO
 *   · mide PÍXELES: cuánto cambia la imagen entre pasos (si no cambia, no hay
 *     animación por más que los números digan que sí) y cuánto rojo hay en cuadro.
 *
 * Los PNG se guardan para que un agente con OJOS los abra con Read y juzgue lo que
 * ningún número dice: ¿se ve el molde?, ¿el plástico entra desde la compuerta?,
 * ¿parpadea algo?, ¿desaparece algo?
 *
 * ⚠ GOTCHA PAGADO (2026-08-06): el vite dev de iangpu corre con `VITE_NO_WATCH=1` (el
 * daemon del RIAN agota los inotify del sistema y con watcher vite muere de ENOSPC).
 * SIN WATCHER NO HAY INVALIDACIÓN: el servidor sigue sirviendo el módulo VIEJO aunque
 * hayas hecho `scp` del nuevo. Se pierde media hora "arreglando" un bug ya arreglado.
 * REGLA: después de cada `scp` de un .ts/.tsx, REINICIA el dev server (y verifica que
 * el módulo servido trae tu cambio con `curl … | grep`).
 *
 *   # levantar un dev server propio (no toques el 5178 de otros):
 *   setsid sh -c "VITE_NO_WATCH=1 exec /home/ian/Orkesta/la-forja/node_modules/.bin/vite \
 *     /home/ian/Orkesta/la-forja --port 5185 --host 127.0.0.1" > /tmp/vite5185.log 2>&1 &
 *   curl -s http://localhost:5185/src/forja/mold/vista3d-llenado.tsx | grep -c <tu cambio>
 *
 * Uso (en iangpu, con el repo en /home/ian/Orkesta/la-forja):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   URL=http://localhost:5185/vista3d-anim.html \
 *   node /home/ian/Orkesta/la-forja/scripts/vista3d-anim-ss.cjs
 *
 * Variables: URL · SHOTDIR · PIEZA (default rpi4) · PASOS (default 7) · W · H
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const URL = process.env.URL || 'http://localhost:5185/vista3d-anim.html';
const DIR = process.env.SHOTDIR || '/home/ian/Orkesta/la-forja/forja-shots/vista3d-anim';
const PIEZA = process.env.PIEZA || 'rpi4';
const PASOS = Math.max(5, Number(process.env.PASOS || 7));
const W = Number(process.env.W || 1500), H = Number(process.env.H || 980);
const ESPERA = Number(process.env.ESPERA || 240000);   // construir el campo/barrido tarda

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── PNG mínimo: leemos los píxeles para medir movimiento y rojo, sin dependencias ── */
function leerPNG(buf) {
  let p = 8, w = 0, h = 0, bpp = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const tipo = buf.toString('ascii', p + 4, p + 8);
    const datos = buf.slice(p + 8, p + 8 + len);
    if (tipo === 'IHDR') {
      w = datos.readUInt32BE(0); h = datos.readUInt32BE(4);
      const prof = datos[8], color = datos[9];
      if (prof !== 8) throw new Error(`PNG de ${prof} bits: no soportado`);
      bpp = color === 6 ? 4 : color === 2 ? 3 : color === 0 ? 1 : color === 4 ? 2 : 0;
      if (!bpp) throw new Error(`PNG con tipo de color ${color}: no soportado`);
    } else if (tipo === 'IDAT') idat.push(datos);
    else if (tipo === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const linea = raw.slice(q, q + stride); q += stride;
    const dst = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? dst[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = linea[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      dst[x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}

/** fracción de píxeles que cambian de forma apreciable entre dos capturas */
function difPixeles(A, B) {
  if (A.w !== B.w || A.h !== B.h || A.bpp !== B.bpp) return 1;
  let n = 0, tot = 0;
  const paso = A.bpp * 3;                    // muestreo 1 de cada 3 píxeles: suficiente
  for (let i = 0; i + A.bpp <= A.px.length; i += paso) {
    tot++;
    const d = Math.abs(A.px[i] - B.px[i]) + Math.abs(A.px[i + 1] - B.px[i + 1]) + Math.abs(A.px[i + 2] - B.px[i + 2]);
    if (d > 24) n++;
  }
  return tot ? n / tot : 0;
}

/** fracción de píxeles claramente ROJOS (r alto, g y b bajos) — el color de colisión */
function fraccionRoja(A) {
  let n = 0, tot = 0;
  const paso = A.bpp * 3;
  for (let i = 0; i + A.bpp <= A.px.length; i += paso) {
    tot++;
    const r = A.px[i], g = A.px[i + 1], b = A.px[i + 2];
    if (r > 110 && r > g * 2.0 && r > b * 2.0) n++;
  }
  return tot ? n / tot : 0;
}

/** fracción de píxeles NO fondo (el fondo es #05070b) — ¿hay algo en cuadro? */
function fraccionPintada(A) {
  let n = 0, tot = 0;
  const paso = A.bpp * 3;
  for (let i = 0; i + A.bpp <= A.px.length; i += paso) {
    tot++;
    if (A.px[i] > 22 || A.px[i + 1] > 24 || A.px[i + 2] > 30) n++;
  }
  return tot ? n / tot : 0;
}

const monotona = (xs, tol = 1e-6) => {
  for (let i = 1; i < xs.length; i++) if (xs[i] < xs[i - 1] - tol) return { ok: false, i, a: xs[i - 1], b: xs[i] };
  return { ok: true };
};

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

  const benigno = (s) => /WebGL context|WebGL2?RenderingContext|THREE\.WebGLRenderer|Download the React DevTools|Multiple instances of Three/i.test(s);
  const errs = [], warns = [], ignorados = [], fallidas = [];
  page.on('pageerror', (e) => { const s = String(e).slice(0, 300); if (!benigno(s)) errs.push(s); });
  page.on('console', (m) => {
    const url = (m.location() && m.location().url) || '';
    const s = `${m.type()}: ${m.text()}`.slice(0, 300) + (url ? ` @ ${url.slice(-40)}` : '');
    if (/favicon\.ico/.test(url)) { ignorados.push(s); return; }
    if (m.type() === 'error' && !benigno(s)) errs.push(s);
    else if (m.type() === 'warning' && !benigno(s)) warns.push(s);
  });
  page.on('response', (r) => { if (r.status() >= 400) fallidas.push(`${r.status()} ${r.url().slice(0, 120)}`); });

  const out = { url: URL, pieza: PIEZA, pasos: PASOS, checks: {}, vistas: {}, errs, warns, ignorados, fallidas, shots: [] };
  let fallas = 0;
  const check = (k, cond, det) => {
    out.checks[k] = { ok: !!cond, det: String(det) };
    console.log(` ${cond ? '✓' : '❌'} ${k} — ${det}`);
    if (!cond) fallas++;
  };

  /** VISOR = el rectángulo del canvas. Se recorta a él: el panel de la derecha trae la
   *  rampa de color y el cuadro ROJO de la leyenda, y sin recortar contaminaban
   *  `fraccionRoja` (medido: 0.053 % de rojo constante en TODA la vista de llenado,
   *  que no era la escena sino la leyenda). Una métrica que mide el panel no mide la
   *  escena. Se guardan las dos: `-full` para juzgar a ojo con panel y números. */
  let recorte = null;
  const disparo = async (nombre) => {
    const p = path.join(DIR, `${nombre}.png`);
    const buf = await page.screenshot({ path: p, timeout: 30000, clip: recorte || undefined });
    out.shots.push(p);
    return { p, img: leerPNG(buf) };
  };
  const disparoFull = async (nombre) => {
    const p = path.join(DIR, `${nombre}-full.png`);
    await page.screenshot({ path: p, timeout: 30000 });
    out.shots.push(p);
  };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // GOTCHA de la casa: NO esperar ".ready". Se espera la API del banco + el canvas.
    await page.waitForSelector('[data-testid="vista3d-anim-view"]', { timeout: 45000 });
    await page.waitForFunction('!!window.__vista3dBanco', null, { timeout: 45000 });
    await page.click(`[data-testid="v3d-pieza-${PIEZA}"]`).catch(() => {});
    await page.waitForFunction('!!document.querySelector("canvas") && !!window.__vista3dCanvasOk', null, { timeout: 60000 });
    await sleep(900);

    out.gpu = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      if (!gl) return 'sin contexto';
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'sin extensión';
    });
    check('gpu_real', !/SwiftShader|llvmpipe|software/i.test(String(out.gpu)), out.gpu);

    const estado = (v) => page.evaluate((k) => (window.__vista3d || {})[k] || null, v);
    const lectura = () => page.evaluate(() => (window.__vista3dBanco || {}).lectura || null);

    const esperarListo = async (v) => {
      const t0 = Date.now();
      for (;;) {
        const s = await estado(v);
        if (s && s.listo) return s;
        if (s && s.fallo) return s;
        if (Date.now() - t0 > ESPERA) return s;
        await sleep(500);
      }
    };

    /** mueve el slider REAL (input range): se teclea el valor y se dispara el evento
     *  como lo haría el operador arrastrando. */
    const ponerT = async (t) => {
      await page.$eval('[data-testid="v3d-slider"]', (el, val) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, String(val));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, t);
      await sleep(360);
    };

    const bb = await page.$eval('[data-testid="v3d-visor"]', (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
    recorte = { x: Math.round(bb.x), y: Math.round(bb.y), width: Math.round(bb.w), height: Math.round(bb.h) };

    const orbitar = async (dx, dy) => {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(cx + (dx * i) / 8, cy + (dy * i) / 8);
      await page.mouse.up();
      await sleep(500);
    };

    /* ═══════════════ VISTA POR VISTA ═══════════════ */
    for (const vista of ['apertura', 'llenado']) {
      console.log(`\n── ${vista.toUpperCase()} ──`);
      await page.click(`[data-testid="v3d-vista-${vista}"]`);
      await sleep(400);
      const s0 = await esperarListo(vista);
      const R = { estado: s0, pasos: [], lectura: null };
      out.vistas[vista] = R;
      check(`${vista}_construye`, !!(s0 && s0.listo), s0 && s0.listo
        ? `escena lista en ${s0.msConstruccion} ms`
        : `NO se construyó: ${JSON.stringify(s0).slice(0, 200)}`);
      if (!s0 || !s0.listo) continue;

      let previa = null;
      for (let i = 0; i < PASOS; i++) {
        const t = +(i / (PASOS - 1)).toFixed(3);
        await ponerT(t);
        const s = await estado(vista);
        const { p, img } = await disparo(`${vista}-t${String(i).padStart(2, '0')}`);
        const dif = previa ? difPixeles(previa, img) : null;
        const rojo = fraccionRoja(img);
        const pintado = fraccionPintada(img);
        R.pasos.push({
          t, png: path.basename(p), difPx: dif == null ? null : +dif.toFixed(4),
          rojoPx: +rojo.toFixed(5), pintadoPx: +pintado.toFixed(4),
          d: s ? s.d : null, pct: s ? s.pct : null,
          volumenMm3: s ? s.volumenMm3 : null, nLlenos: s ? s.nLlenos : null,
          nSoldaduras: s ? s.nSoldaduras : null, trampas: s ? s.trampasAlcanzadas : null,
          choques: s && s.choquesAhora ? s.choquesAhora.length : null,
          pose: s ? s.pose : null,
        });
        previa = img;
        console.log(`   t=${t}  ${vista === 'llenado' ? `pct=${s && s.pct}` : `d=${s && s.d} mm`}  Δpx=${dif == null ? '—' : (100 * dif).toFixed(2) + '%'}  rojo=${(100 * rojo).toFixed(3)}%`);
      }

      // ── ¿de verdad hay algo en cuadro? ──
      const pintMin = Math.min(...R.pasos.map((x) => x.pintadoPx));
      check(`${vista}_hay_algo_en_cuadro`, pintMin > 0.02, `mínimo de píxeles no-fondo ${(100 * pintMin).toFixed(1)} % (umbral 2 %)`);

      // ── ¿SE MUEVE de verdad entre pasos? ──
      const difs = R.pasos.slice(1).map((x) => x.difPx);
      const difMax = Math.max(...difs), difMedia = difs.reduce((a, b) => a + b, 0) / difs.length;
      const difCero = difs.filter((x) => x < 0.002).length;
      check(`${vista}_se_mueve`, difMedia > 0.01 && difCero === 0,
        `Δpíxeles medio ${(100 * difMedia).toFixed(2)} % · máx ${(100 * difMax).toFixed(2)} % · pasos sin cambio: ${difCero}`);

      if (vista === 'llenado') {
        const vols = R.pasos.map((x) => x.volumenMm3);
        const m = monotona(vols);
        check('llenado_volumen_monotono', m.ok,
          m.ok ? `volumen(t) no decrece en ${PASOS} pasos: ${vols.map((v) => (v / 1000).toFixed(2)).join(' → ')} cc`
            : `BAJA en el paso ${m.i}: ${m.a} → ${m.b} mm³`);
        check('llenado_arranca_vacio', vols[0] <= s0.volumenTotalMm3 * 0.02, `en t=0 hay ${(vols[0] / 1000).toFixed(3)} cc (≤ 2 % del total)`);
        check('llenado_cierra_completo', Math.abs(vols[vols.length - 1] - s0.volumenTotalMm3) <= s0.volumenTotalMm3 * 1e-6,
          `en t=1 hay ${(vols[vols.length - 1] / 1000).toFixed(3)} cc de ${(s0.volumenTotalMm3 / 1000).toFixed(3)} cc alcanzables`);
        const sold = monotona(R.pasos.map((x) => x.nSoldaduras || 0));
        check('llenado_soldaduras_no_decrecen', sold.ok, sold.ok ? `soldaduras: ${R.pasos.map((x) => x.nSoldaduras).join(' → ')}` : `bajan en el paso ${sold.i}`);
        const tr = monotona(R.pasos.map((x) => x.trampas || 0));
        check('llenado_trampas_no_decrecen', tr.ok, `trampas de gas alcanzadas: ${R.pasos.map((x) => x.trampas).join(' → ')} (de ${s0.trampasTotal})`);
        // el módulo puro también lo declara: se cruzan las dos fuentes
        check('llenado_serie_pura_monotona', s0.monotona === true && s0.cierraEnTotal === true,
          `serieLlenado(): monótona=${s0.monotona} · cierra en el total=${s0.cierraEnTotal}`);
        check('llenado_pixeles_crecen', R.pasos[R.pasos.length - 1].pintadoPx > R.pasos[0].pintadoPx * 1.15,
          `píxeles pintados ${(100 * R.pasos[0].pintadoPx).toFixed(1)} % → ${(100 * R.pasos[R.pasos.length - 1].pintadoPx).toFixed(1)} %`);
      } else {
        const ds = R.pasos.map((x) => x.d);
        const m = monotona(ds);
        check('apertura_d_monotona', m.ok, m.ok ? `apertura(t): ${ds.map((v) => v.toFixed(1)).join(' → ')} mm` : `baja en el paso ${m.i}`);
        check('apertura_abre_completo', Math.abs(ds[ds.length - 1] - s0.aperturaTotalMm) < 0.01,
          `en t=1 la apertura vale ${ds[ds.length - 1]} mm (carrera ${s0.aperturaTotalMm} mm) y la expulsión ${R.pasos[R.pasos.length - 1] && s0.expulsionMm} mm`);
        // si el barrido dice que hay choques, TIENE que verse rojo en algún t
        const rojoMax = Math.max(...R.pasos.map((x) => x.rojoPx));
        const choquesMax = Math.max(...R.pasos.map((x) => x.choques || 0));
        if (s0.paresInterfieren > 0) {
          check('apertura_choques_se_pintan', choquesMax > 0 && rojoMax > 0.0004,
            `${s0.paresInterfieren} pares interfieren en el barrido · máx ${choquesMax} choques simultáneos medidos · rojo en cuadro ${(100 * rojoMax).toFixed(3)} %`);
        } else {
          check('apertura_sin_choques_sin_rojo', rojoMax < 0.002,
            `el barrido no halló interferencias y la vista no pinta rojo (${(100 * rojoMax).toFixed(3)} %)`);
        }
        check('apertura_hallazgos_declarados', Array.isArray(s0.hallazgos),
          `${(s0.hallazgos || []).length} hallazgos: ${(s0.hallazgos || []).slice(0, 2).join(' | ').slice(0, 220)}`);
      }

      // ── ORBITAR: la cámara se mueve de verdad (arrastre real sobre el canvas) ──
      const antes = await disparo(`${vista}-orbita-antes`);
      await orbitar(260, -110);
      const despues = await disparo(`${vista}-orbita-despues`);
      const dOrb = difPixeles(antes.img, despues.img);
      check(`${vista}_orbita`, dOrb > 0.02, `Δpíxeles al orbitar ${(100 * dOrb).toFixed(2)} %`);
      await orbitar(-260, 110);   // regresa

      // ── SONDA: clic sobre el objeto ──
      await ponerT(vista === 'llenado' ? 1 : 0.5);
      const antesL = JSON.stringify(await lectura());
      let sondaOk = false, sondaTxt = '';
      for (const [ox, oy] of [[0, 0], [-70, 40], [70, -40], [-140, -60], [140, 70], [0, 120], [0, -120]]) {
        await page.mouse.move(cx + ox, cy + oy);
        await page.mouse.down(); await page.mouse.up();
        await sleep(320);
        const l = await lectura();
        const s2 = await estado(vista);
        sondaTxt = l ? `${l.valor} :: ${(l.nota || '').slice(0, 170)}` : '';
        const cambio = l && JSON.stringify(l) !== antesL;
        const dice = /sonda/i.test((l && l.nota) || '') || (s2 && s2.sonda);
        if (cambio && dice) { sondaOk = true; break; }
      }
      R.lectura = await lectura();
      await disparoFull(`${vista}-panel`);
      check(`${vista}_sonda`, sondaOk, sondaOk ? sondaTxt.slice(0, 200) : `el clic no produjo lectura de sonda (última: ${sondaTxt.slice(0, 140)})`);
      await disparo(`${vista}-sonda`);
    }

    check('sin_errores_de_consola', errs.length === 0, errs.length ? errs.slice(0, 3).join(' | ') : 'ninguno');
    check('sin_peticiones_fallidas', fallidas.filter((f) => !/favicon/.test(f)).length === 0,
      fallidas.length ? fallidas.slice(0, 3).join(' | ') : 'ninguna');
  } catch (e) {
    check('el_arnes_termina', false, String(e).slice(0, 300));
  } finally {
    out.fallas = fallas;
    fs.writeFileSync(path.join(DIR, 'resultado.json'), JSON.stringify(out, null, 2));
    // MANIFIESTO para el agente con OJOS: qué mirar en cada PNG.
    const md = [
      '# VISTAS 3D ANIMADAS — capturas para juzgar A OJO',
      '',
      `URL: ${URL} · pieza: ${PIEZA} · GPU: ${out.gpu}`,
      '',
      '## Qué hay que ver (si no se ve, el número no salva la vista)',
      '- APERTURA: el molde SEPARÁNDOSE (mitad móvil bajando) conforme sube t; al final, los',
      '  expulsores empujando. Las placas en rayos X dejan ver el paquete expulsor y el agua.',
      '  Donde hay colisión: sólidos ROJOS + esfera roja en el punto de penetración.',
      '- LLENADO: el plástico ENTRANDO desde la esfera dorada (la compuerta) y creciendo.',
      '  Blanco = línea de soldadura. Octaedro rojo = TRAMPA DE GAS. Ámbar = fin de flujo venteable.',
      '- DEFECTOS a cazar: algo que parpadea, algo que desaparece entre pasos, cuadro vacío,',
      '  todo del mismo color, la pieza fuera de encuadre.',
      '',
      '## Capturas',
      ...out.shots.map((s) => `- ${s}`),
      '',
      '## Checks',
      ...Object.entries(out.checks).map(([k, v]) => `- ${v.ok ? '✓' : '❌'} **${k}** — ${v.det}`),
    ].join('\n');
    fs.writeFileSync(path.join(DIR, 'MANIFIESTO.md'), md);
    console.log(`\n${fallas === 0 ? '✅ TODO PASA' : `❌ ${fallas} CHECK(S) FALLAN`} · ${out.shots.length} capturas en ${DIR}`);
    await browser.close();
    process.exit(fallas === 0 ? 0 : 1);
  }
})();
