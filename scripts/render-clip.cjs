#!/usr/bin/env node
/*
 * render-clip.cjs — renderiza una SECUENCIA de frames de una escena cinematic determinista
 * (window[hook].renderAt(t) PURO en t) a PNG, para ensamblar un clip. Recta canónica WSL:
 * contexto FRESCO por LOTE (libera VRAM, sin fuga), timeout FINITO, GPU real (D3D12/NVIDIA).
 * La escena debe ir en modo cámara-pura-en-t (?clip=1) para que los lotes empaten sin costura.
 *
 * ⚠️ EL MOTOR SE MODIFICÓ — ver docs/CANON-VIDEO.md (§RENDER Y OPERACIÓN iangpu). A prueba de
 * crashes de vite DEV (HMR recarga la página → "Execution context was destroyed"): freshCtx con
 * reintentos + try/catch por-frame (contexto fresco) + RESUME (salta frames ya hechos, size>BLACK).
 * GOTCHA 4K: los gl_PointSize quedan ~½ a 2160×3840 → nubes ×1.85. Verificar el VIDEO FINAL, no la sonda.
 *
 * 🚀 PARALELIZABLE (renderAt(t) es PURO → cada frame es independiente): --shard k --nshards M lanza
 *    M workers que se reparten los frames por stride (i%M==k) sobre la MISMA carpeta (índices
 *    disjuntos, cero colisión de escritura) → un video 4K sale M× más rápido. SEGURO en paralelo
 *    porque este motor mata SOLO su propio browser (playwright close), NUNCA `pkill chrome` global
 *    (ese pkill mataba los renders hermanos — el bug que se corrigió ~6 veces, ver render-clase.cjs).
 *
 * Uso (iangpu, env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA):
 *   node scripts/render-clip.cjs --url '...cinematic-pulsar.html?clip=1&vol=1&...' \
 *     --hook __cinematicPulsar --out dist-video/.grailframes --fps 30 --w 3840 --h 2160 --batch 60
 *   # paralelo: mismo comando ×M con --nshards M --shard 0..M-1 (misma --out)
 */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }

(async () => {
  const url = arg('--url'); if (!url) { console.error('falta --url'); process.exit(1); }
  const hook = arg('--hook', '__cinematicPulsar');
  const W = parseInt(arg('--w', '3840'), 10);
  const H = parseInt(arg('--h', '2160'), 10);
  const sup = parseInt(arg('--super', '1'), 10);
  const fps = parseInt(arg('--fps', '30'), 10);
  const outdir = arg('--out', 'dist-video/.clipframes');
  const batch = parseInt(arg('--batch', '60'), 10);
  const warm = parseInt(arg('--warm', '22'), 10);
  const durOv = parseFloat(arg('--dur', '0'));     // override de duración (0 = usar la de la escena)
  const chrome = arg('--chrome', '/usr/bin/google-chrome-stable');
  const nshards = Math.max(1, parseInt(arg('--nshards', '1'), 10));  // total de workers en paralelo
  const shard = Math.max(0, parseInt(arg('--shard', '0'), 10));      // franja de ESTE worker (0..nshards-1)
  // ── CAPTURA (2026-08-17, medido en iangpu sobre la o2 a 4K) ──────────────────────────
  // El 97 % del tiempo de cada cuadro era la CODIFICACIÓN del screenshot, no el render
  // (GPU: 27 ms · PNG de playwright: 857 ms). CDP Page.captureScreenshot con
  // optimizeForSpeed (zlib q1/RLE) baja eso SIN tocar la escena:
  //   cdp-jpeg (default): 225 ms/cuadro, 3.8×. La pérdida del q95 DESAPARECE dentro del
  //     encode final 4:2:0 del master: tras HEVC, dif png-vs-jpeg = 1.33 global / 3.67 en
  //     polvo, MENOS que lo que el encode solo ya le hace al PNG (2.11 / 7.91).
  //   cdp-png: 346 ms/cuadro, 2.5×, PNG sin pérdida (para el purista).
  //   png: el camino histórico de playwright, por si CDP diera lata en algún Chrome.
  const captura = arg('--captura', 'cdp-jpeg');                       // cdp-jpeg | cdp-png | png
  const calidad = parseInt(arg('--calidad', '95'), 10);
  const FEXT = captura === 'cdp-jpeg' ? 'jpg' : 'png';
  fs.mkdirSync(outdir, { recursive: true });

  const launchArgs = [
    '--no-sandbox', '--disable-setuid-sandbox', '--headless=new',
    '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization',
    '--use-angle=gl', '--enable-webgl', '--enable-unsafe-swiftshader',
    '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`,
  ];

  // FRESCO POR LOTE = relanzar el BROWSER COMPLETO (no solo el contexto). Cerrar solo el
  // contexto NO libera el contexto WebGL2 de ANGLE en headless → tras ~3 lotes Chrome se
  // queda sin contextos WebGL2 → fallback → frames NEGROS. Relanzar el proceso lo cura.
  let browser = null, ctx = null, page = null, cdp = null, frameInCtx = 0, glLogged = false;
  async function freshCtx() {
    // REINTENTOS: en WSL headless el relaunch en borde de lote a veces tira
    // "Execution context was destroyed" → reintentar en vez de crashear todo el render.
    for (let att = 0; att < 8; att++) {
      try {
        if (ctx) await ctx.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        browser = await chromium.launch({ headless: false, executablePath: chrome, args: launchArgs });
        ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: sup, bypassCSP: true });
        page = await ctx.newPage();
        cdp = captura.startsWith('cdp') ? await ctx.newCDPSession(page) : null;
        page.on('pageerror', (e) => console.error('[pageerror]', e.message));
        await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
        await page.waitForFunction((h) => window[h] && window[h].ready === true, hook, { timeout: 120000 });
        // ── ESPERAR A LAS TIPOGRAFÍAS. Sin esto el título PARPADEA: ian lo cazó en EL ALCOHOL
        // ("parpadea varias veces, exactamente en el segundo 0:13… pareciera que se pone en
        // negritas"). Causa: index.html trae Inter y JetBrains Mono de Google Fonts con
        // `display=swap`, que por definición pinta el FALLBACK del sistema y cambia a la real
        // cuando llega. Y este render abre un CONTEXTO FRESCO por lote (ver `frameInCtx >=
        // batch`), o sea con caché de fuentes VACÍA: los primeros cuadros de un lote salían con
        // la fuente del sistema —más gorda— y los demás con Inter. Por eso el defecto aparecía
        // en un instante puntual y no en todo el video: es el borde de un lote.
        // `networkidle` NO basta — resuelve con el CSS descargado, antes de los archivos .woff2,
        // que el navegador pide solo cuando algo los usa.
        await page.evaluate(async () => {
          const caras = ['200 100px Inter', '400 100px Inter', '500 100px "JetBrains Mono"'];
          try { await Promise.all(caras.map((f) => document.fonts.load(f))); } catch (e) { /* sin red: el fallback es estable igual */ }
          await document.fonts.ready;
        }).catch(() => {});
        if (!glLogged) {
          const gl = await page.evaluate(() => { try { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'masked'; } catch (err) { return 'err ' + err.message; } });
          console.log('[gl]', gl); glLogged = true;
        }
        // calentar: deja cargar la textura 3D del volumen + asentar antes del primer frame
        await page.evaluate(({ h }) => window[h].renderAt(0), { h: hook });
        for (let k = 0; k < warm; k++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
        await page.waitForTimeout(400);
        frameInCtx = 0;
        return;
      } catch (e) {
        console.log(`[clip] freshCtx intento ${att + 1} falló: ${e.message} → reintento`);
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    throw new Error('freshCtx falló tras 8 intentos');
  }

  await freshCtx();
  const sceneDur = (await page.evaluate((h) => window[h].duration, hook)) || 24;
  // CINTURÓN de constantes GEMELAS (2026-08-17): formato.dur del manifiesto y la duración
  // que calcula la escena DEBEN coincidir — cuando divergen, el render sale con cuadros de
  // más/menos o congelado al final (pasó al cambiar bandaDur sin tocar los manifiestos; se
  // cazó a mano con un probe — ahora es automático). ALLOW_DUR_DRIFT=1 lo baja a warning.
  if (durOv > 0 && Math.abs(durOv - sceneDur) > 0.05) {
    const msg = `[clip] ✗ duración del manifiesto (${durOv}s) ≠ escena (${sceneDur}s)`;
    if (process.env.ALLOW_DUR_DRIFT === '1') console.log(msg + ' — permitido por ALLOW_DUR_DRIFT');
    else { console.error(msg + ' — actualiza formato.dur o la escena'); process.exit(1); }
  }
  const dur = durOv > 0 ? durOv : sceneDur;
  const N = Math.round(dur * fps);
  const mine = nshards > 1 ? Math.ceil((N - shard) / nshards) : N;
  console.log(`[clip] ${N} frames · ${dur}s @ ${fps}fps · ${W}x${H} (dsf ${sup}) · lote ${batch} · captura ${captura}`
    + (nshards > 1 ? ` · SHARD ${shard}/${nshards} (${mine} frames de este worker)` : ''));
  const t0 = Date.now();
  // Umbral de "frame negro" POR BYTES. Calibrado para escenas densas (agua, átomos), donde
  // un 4K con contenido pesa MB. ⚠ NO vale para todas: "El codo" son dos cadenas delgadas
  // sobre negro, así que el PNG comprime a ~126 KB con contenido PERFECTO — y el guardián
  // los reprobaba en bucle: 660 de 2883 cuadros tras 6 intentos, con la escena bien.
  // Por eso es configurable: BLACK=<bytes> para escenas de sujeto delgado. El default no
  // cambia, así que ninguna pieza anterior se mueve.
  // Con cdp-jpeg el mismo umbral NO vale: un 4K con contenido pesa >300 KB en q95 y un
  // negro-de-WebGL-muerto (uniforme) ~30-80 KB. 100 KB separa limpio; sigue siendo
  // override-able con BLACK= para escenas de sujeto delgado (la lección de "El codo").
  const BLACK = parseInt(process.env.BLACK || (FEXT === 'jpg' ? '100000' : '150000'), 10);
  // VENTANAS NEGRAS A PROPÓSITO (2026-08-29). El canon §LA MECÁNICA DEL O₂ tiene una figura
  // que APAGA TODAS las capas para que la NADA sea el argumento ("quita las nubes: no hay
  // nada"). Ese cuadro es legítimamente casi negro — y el portero lo reprobaba en bucle:
  // MEDIDO en LA SILLA, hasta 12 reintentos por cuadro entre t=21.7 y 22.5, cada uno
  // levantando un navegador nuevo. Más de mil arranques desperdiciados por render, y el
  // ritmo cayendo de 0.04 a 1.18 s/cuadro. El portero peleaba contra la dirección de arte.
  //   --negras "20.4-24.6,41.0-42.5"   (segundos del guion; se declara en el manifiesto)
  const NEGRAS = (arg('--negras', '') || '').split(',').map((r) => r.trim()).filter(Boolean)
    .map((r) => r.split('-').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
  const esNegraAProposito = (t) => NEGRAS.some(([a2, b2]) => t >= a2 && t <= b2);
  if (NEGRAS.length) console.log(`[clip] ventanas negras a propósito (portero apagado): ${NEGRAS.map((p) => p.join('-')).join(', ')}`);
  let blacks = 0;
  for (let i = 0; i < N; i++) {
    // PARALELO: cada worker rinde solo su franja por stride (índices disjuntos → sin colisión)
    if (nshards > 1 && (i % nshards) !== shard) continue;
    const f = path.join(outdir, String(i).padStart(5, '0') + '.' + FEXT);
    // RESUME: si el frame ya existe y NO es negro, saltarlo (re-correr continúa donde quedó)
    const tSeg = i / fps;
    if (fs.existsSync(f) && (fs.statSync(f).size > BLACK || esNegraAProposito(tSeg))) continue;
    if (frameInCtx >= batch) await freshCtx();
    const t = i / fps;
    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      try {
        await page.evaluate(({ tt, h }) => window[h].renderAt(tt), { tt: t, h: hook });
        // bombear suficientes rAF + espera: a 4K el frame tarda; pocas rAF = screenshot
        // dispara ANTES de que el GPU termine → NEGRO. Damos tiempo a que dibuje y vacíe.
        for (let k = 0; k < 5; k++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
        await page.waitForTimeout(110);
        if (cdp) {
          const r = await cdp.send('Page.captureScreenshot', {
            format: FEXT === 'jpg' ? 'jpeg' : 'png',
            ...(FEXT === 'jpg' ? { quality: calidad } : {}),
            optimizeForSpeed: true,
            clip: { x: 0, y: 0, width: W, height: H, scale: 1 },
          });
          fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
        } else {
          await page.screenshot({ path: f, type: 'png', clip: { x: 0, y: 0, width: W, height: H }, timeout: 60000 });
        }
        const sz = fs.statSync(f).size;
        // en una ventana declarada como negra, el tamaño NO es criterio: se acepta el cuadro.
        if (sz > BLACK || esNegraAProposito(t)) { ok = true; }
        else {
          // frame NEGRO (race o WebGL2 caído): relanzar browser fresco y reintentar este frame
          console.log(`[clip] frame ${i} negro (${sz}B) → reintento ${attempt + 1} (browser fresco)`);
          await freshCtx();
        }
      } catch (e) {
        // "Execution context was destroyed" u otro error mid-frame → contexto fresco + reintento
        console.log(`[clip] frame ${i} ERROR (${String(e.message).slice(0, 60)}) → contexto fresco + reintento ${attempt + 1}`);
        await freshCtx();
      }
    }
    if (!ok) { blacks++; console.error(`[clip] !! frame ${i} sigue negro tras reintentos`); }
    frameInCtx++;
    if (i % 30 === 0 || i === N - 1) {
      const el = (Date.now() - t0) / 1000;
      console.log(`[clip] ${i + 1}/${N}  (${el.toFixed(0)}s, ${(el / (i + 1)).toFixed(2)}s/f, negros=${blacks})`);
    }
  }
  if (ctx) await ctx.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  console.log(`[clip] LISTO ${N} frames → ${outdir}`);
})().catch((e) => { console.error(e); process.exit(1); });
