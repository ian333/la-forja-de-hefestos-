/**
 * ESCUELA DE MECÁNICA — runner de CLASE EN VIDEO.
 * ================================================================
 * Ejecuta una lección (src/escuela/mecanica/lecciones/<id>.json) manejando
 * La Forja REAL en pantalla (cursor visible + hint bar, heredados del arnés
 * forja-drive) mientras graba la sesión a webm. Cada paso:
 *   1) marca su timestamp (para clavar el WAV de narración en el ensamble),
 *   2) pinta el SUBTÍTULO del paso (chyron superior, quemado en el video),
 *   3) ejecuta sus gestos,
 *   4) ESPERA a que el paso dure al menos lo que dura su narración + aire,
 *   5) valida su check contra los invariantes del kernel (no aborta: reporta).
 *
 * USO (en iangpu, con vite dev vivo en :5001 y la narración ya generada):
 *   NODE_PATH=/home/ian/Orkesta/la-forja/node_modules \
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   node scripts/escuela/clase-drive.cjs <leccion.json> <narracionDir> <outDir>
 *
 * narracionDir = dist-video/<id>-narracion (WAVs <id>_lNN.wav de narracion-gen.py).
 * Si un WAV falta, estima su duración (14 chars/s) — modo borrador para iterar.
 * Salida: outDir/rec/*.webm + outDir/meta.json (markers, checks, leadMs).
 */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LEC_PATH = process.argv[2];
const NARR_DIR = process.argv[3] || '';
const OUT = process.argv[4] || '/tmp/clase-drive';
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const W = 1920, H = 1080;
const AIRE_S = 0.65;                 // aire tras cada frase (regla: narración con aire)
const PACE = Math.max(0.5, parseFloat(process.env.PACE || '1'));  // >1 = clase más CALMADA (el user: 'demasiado rápido')

if (!LEC_PATH) { console.error('uso: clase-drive.cjs <leccion.json> [narracionDir] [outDir]'); process.exit(1); }
const lec = JSON.parse(fs.readFileSync(LEC_PATH, 'utf8'));
fs.mkdirSync(`${OUT}/rec`, { recursive: true });

// Duración real de cada WAV (ffprobe); si falta → estimación borrador.
const durs = lec.pasos.map((p, i) => {
  const wav = path.join(NARR_DIR, `${lec.id}_l${String(i + 1).padStart(2, '0')}.wav`);
  if (NARR_DIR && fs.existsSync(wav)) {
    const d = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "${wav}"`).toString());
    return { wav, dur: d, real: true };
  }
  return { wav: null, dur: Math.max(2.5, p.dice.length / 14), real: false };
});
console.log(`${lec.id}: ${lec.pasos.length} pasos, narración ${durs.every((d) => d.real) ? 'REAL' : 'ESTIMADA (borrador)'}, ~${durs.reduce((s, d) => s + d.dur + AIRE_S, 0).toFixed(0)}s`);

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
           '--use-gl=angle', '--use-angle=gl', '--disable-software-rasterizer',
           '--hide-scrollbars', `--window-size=${W},${H}`],
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1,
    recordVideo: { dir: `${OUT}/rec`, size: { width: W, height: H } },
  });
  const recT0 = Date.now();
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/404 \(Not Found\)/.test(t)) errors.push(t.slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + String(e).slice(0, 200)));

  const meta = { id: lec.id, url: URL, viewport: { w: W, h: H }, pasos: [], errors, leadMs: 0 };
  try {
    // BIBLIOTECA EMBARCADA: si la lección declara piezas (lec.biblioteca), se siembran
    // en localStorage ANTES de cargar — cada Chrome de Playwright nace vacío.
    if (Array.isArray(lec.biblioteca) && lec.biblioteca.length) {
      const bibDir = path.join(path.dirname(LEC_PATH), '..', 'biblioteca');
      const lib = {};
      for (const n of lec.biblioteca) lib[n] = JSON.parse(fs.readFileSync(path.join(bibDir, `${n}.json`), 'utf8'));
      await page.addInitScript((l) => { localStorage.setItem('forja:library:v1', JSON.stringify(l)); }, lib);
      console.log(`biblioteca embarcada: ${lec.biblioteca.join(', ')}`);
    }
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // El doc por defecto arranca VACÍO (sin sólido) → `ready` (build exitoso) jamás
    // llega; el kernel cargado se detecta por ready O por el error de "sin sólido".
    await page.waitForFunction('window.__forgeBrep && (window.__forgeBrep.ready || !!window.__forgeBrep.error)', { timeout: 60000 });
    await page.waitForTimeout(1500);

    // ── Overlays quemados en el video: cursor + pulso de clic + hint bar
    //    (mismos del arnés forja-drive) + CHYRON de subtítulo + tarjeta de título. ──
    await page.evaluate(({ titulo, subtitulo, unidad, n }) => {
      const c = document.createElement('div');
      c.id = '__cur';
      c.style.cssText = 'position:fixed;left:-60px;top:-60px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));';
      c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3,2 L3,19 L8,14.5 L11.5,22 L14.6,20.5 L11,13.4 L18,13.4 Z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      document.body.appendChild(c);
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;left:-60px;top:-60px;width:30px;height:30px;margin:-15px 0 0 -15px;border:3px solid #ffcc33;border-radius:50%;z-index:2147483646;pointer-events:none;opacity:0;';
      document.body.appendChild(r);
      let x = 0, y = 0;
      addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; c.style.left = x + 'px'; c.style.top = y + 'px'; }, true);
      addEventListener('mousedown', () => { r.style.transition = 'none'; r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.opacity = '1'; r.style.transform = 'scale(.4)'; requestAnimationFrame(() => { r.style.transition = 'opacity .45s ease-out, transform .45s ease-out'; r.style.opacity = '0'; r.style.transform = 'scale(1.5)'; }); }, true);
      const hint = document.createElement('div');
      hint.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483645;pointer-events:none;max-width:82vw;padding:8px 16px;border-radius:9px;background:rgba(10,14,19,.88);border:1px solid #33404f;color:#ffcc33;font:600 15px/1.2 Inter,system-ui,sans-serif;letter-spacing:.2px;box-shadow:0 6px 18px rgba(0,0,0,.55);opacity:0;transition:opacity .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      document.body.appendChild(hint);
      const nameOf = (el) => {
        for (let nd = el, i = 0; nd && i < 6; nd = nd.parentElement, i++) {
          const t = nd.getAttribute && (nd.getAttribute('title') || nd.getAttribute('aria-label'));
          if (t && t.trim()) return t.trim();
        }
        return '';
      };
      addEventListener('mousemove', (e) => {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const nm = el ? nameOf(el) : '';
        if (nm) { hint.textContent = nm; hint.style.opacity = '1'; } else { hint.style.opacity = '0'; }
      }, true);
      // CHYRON — el subtítulo de la clase (lo que Matilda va diciendo), arriba al centro.
      const sub = document.createElement('div');
      sub.id = '__chyron';
      // ABAJO, no arriba: arriba tapaba la barra de herramientas y no dejaba ver
      // a qué se le da click (queja del user). Caja suave, centrada abajo.
      sub.style.cssText = 'position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:2147483645;pointer-events:none;max-width:70vw;padding:12px 22px;border-radius:14px;background:rgba(9,13,20,.72);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);border:1px solid rgba(255,255,255,.10);color:#f2efe6;font:600 22px/1.32 Inter,system-ui,sans-serif;text-align:center;text-shadow:0 2px 14px rgba(0,0,0,.8);box-shadow:0 16px 40px -20px #000;opacity:0;transition:opacity .25s;';
      document.body.appendChild(sub);
      window.__setChyron = (t) => { if (t) { sub.textContent = t; sub.style.opacity = '1'; } else sub.style.opacity = '0'; };
      // Tarjeta de título (los primeros segundos de la clase).
      const card = document.createElement('div');
      card.id = '__titlecard';
      card.style.cssText = 'position:fixed;inset:0;z-index:2147483644;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,8,13,.96);transition:opacity .6s;';
      card.innerHTML = `<div style="font:600 16px/1 Inter,system-ui;letter-spacing:4px;color:#ffcc33;text-transform:uppercase">Escuela de Mecánica · Unidad ${unidad} · Lección ${n}</div>
        <div style="font:800 64px/1.15 Inter,system-ui;color:#fff;margin:22px 0 10px;max-width:80vw;text-align:center">${titulo}</div>
        <div style="font:500 24px/1.3 Inter,system-ui;color:#8fa3b8">${subtitulo}</div>
        <div style="font:600 15px/1 Inter,system-ui;color:#3d4c5e;margin-top:38px;letter-spacing:2px">LA FORJA — CAD real en tu navegador</div>`;
      document.body.appendChild(card);
      window.__hideTitle = () => { card.style.opacity = '0'; setTimeout(() => card.remove(), 700); };
      // Marca anti-recarga: si desaparece, la página recargó a mitad de la clase
      // (flakiness conocida de la VM) → el doc se perdió → hay que reintentar TODO.
      window.__claseMark = 1;
    }, { titulo: lec.titulo, subtitulo: lec.subtitulo || '', unidad: lec.unidad, n: lec.n });
    await page.mouse.move(W / 2, H / 2, { steps: 4 });

    const glide = async (x, y) => { try { await page.mouse.move(x, y, { steps: 26 }); } catch (e) {} };
    const glideEl = async (testid) => {
      const loc = page.locator(`[data-testid="${testid}"]`);
      try { const bb = await loc.boundingBox({ timeout: 4000 }); if (bb) await glide(bb.x + bb.width / 2, bb.y + bb.height / 2); } catch (e) {}
      return loc;
    };
    const clickmm = async (x, y) => {
      const pos = await page.evaluate(({ x, y }) => {
        const se = window.__sketchEditor; if (!se) return null;
        const px = se.toPx(x, y); const r = se.svgRect();
        return { x: r.left + px.px, y: r.top + px.py };
      }, { x, y });
      if (pos) { await glide(pos.x, pos.y); await page.mouse.click(pos.x, pos.y); }
      else errors.push('clickmm sin sketcher');
    };

    // Tarjeta de título en pantalla ~2.8 s antes del primer paso.
    meta.leadMs = Date.now() - recT0;
    await page.waitForTimeout(2800);
    await page.evaluate('window.__hideTitle()');
    await page.waitForTimeout(700);

    for (let i = 0; i < lec.pasos.length; i++) {
      const paso = lec.pasos[i];
      const alive = await page.evaluate('window.__claseMark === 1').catch(() => false);
      if (!alive) throw new Error(`RELOAD_DETECTADO antes de ${paso.id} — el doc se perdió, reintentar la clase`);
      const t0 = Date.now();
      const marker = t0 - recT0;
      await page.evaluate((t) => window.__setChyron && window.__setChyron(t), paso.dice);
      const rec = { id: paso.id, marker, durNarr: durs[i].dur, gestosOk: true };
      // PRIMERO SE EXPLICA, LUEGO SE DA CLICK (regla del user: no al mismo tiempo).
      // Deja correr casi toda la narración del paso ANTES de tocar la herramienta;
      // así el alumno oye la instrucción y DESPUÉS ve el click. Los pasos sin click
      // (solo cámara/espera) apenas se afectan.
      const hasClick = (paso.gestos || []).some((g) => ['tclick', 'click', 'rclick', 'fill', 'clickmm', 'dragmm', 'key'].includes(g.type));
      if (hasClick && durs[i].real) {
        const preMs = Math.max(0, Math.min(durs[i].dur * 1000 * 0.78, durs[i].dur * 1000 - 300));
        if (preMs > 0) await page.waitForTimeout(preMs);
      }
      for (const a of paso.gestos || []) {
        try {
          if (a.type === 'tclick') { const loc = await glideEl(a.testid); await page.waitForTimeout(220 * PACE); await loc.click({ timeout: 10000 }); }
          else if (a.type === 'rclick') { await glide(a.x, a.y); await page.waitForTimeout(240 * PACE); await page.mouse.click(a.x, a.y, { button: 'right' }); }
          // clic REAL por pixel del viewport (p.ej. elegir una CARA de la pieza con el mouse)
          else if (a.type === 'click') { await glide(a.x, a.y); await page.waitForTimeout(300 * PACE); await page.mouse.click(a.x, a.y); }
          else if (a.type === 'fill') { const loc = await glideEl(a.testid); await loc.fill(String(a.text), { timeout: 8000 }); }
          else if (a.type === 'key') await page.keyboard.press(a.key);
          else if (a.type === 'type') await page.keyboard.type(String(a.text));
          else if (a.type === 'wait') await page.waitForTimeout(a.ms || 500);
          else if (a.type === 'clickmm') await clickmm(a.x, a.y);
          // arrastre REAL en coordenadas mm del boceto (ventanas de selección del array/escala)
          else if (a.type === 'dragmm') {
            const pos = await page.evaluate(({ x1, y1, x2, y2 }) => {
              const se = window.__sketchEditor; if (!se) return null;
              const p1 = se.toPx(x1, y1), p2 = se.toPx(x2, y2); const r = se.svgRect();
              return { a: { x: r.left + p1.px, y: r.top + p1.py }, b: { x: r.left + p2.px, y: r.top + p2.py } };
            }, { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 });
            if (pos) {
              await glide(pos.a.x, pos.a.y); await page.mouse.down();
              await page.mouse.move(pos.b.x, pos.b.y, { steps: 22 }); await page.mouse.up();
            }
          }
          else if (a.type === 'orbit') {
            await glide(a.from[0], a.from[1]); await page.mouse.down();
            await page.mouse.move(a.to[0], a.to[1], { steps: 26 }); await page.mouse.up();
          }
          else if (a.type === 'view') await page.evaluate((n) => { const f = window.__forgeBrep; if (f && f.setView) f.setView(n); }, a.name);
          else if (a.type === 'main') await page.evaluate(({ fn, args }) => { const f = window.__forgeBrep; if (f && typeof f[fn] === 'function') f[fn](...(args || [])); }, { fn: a.fn, args: a.args });
          else if (a.type === 'hook') await page.evaluate(({ fn, args }) => { const se = window.__sketchEditor; if (se && typeof se[fn] === 'function') se[fn](...(args || [])); }, { fn: a.fn, args: a.args });
          // dimline: acota la línea MÁS LARGA horizontal ('h') o vertical ('v') por sus
          // endpoints — sin hardcodear índices de puntos (robusto entre versiones).
          else if (a.type === 'dimline') {
            await page.evaluate((axis) => {
              const se = window.__sketchEditor; if (!se) return;
              const pts = se.points(), lines = se.lines();
              let best = -1, bl = -1;
              lines.forEach((l, li) => {
                const A = pts[l.a], B = pts[l.b];
                const dx = Math.abs(A.x - B.x), dy = Math.abs(A.y - B.y);
                const isH = dx >= dy, len = Math.hypot(dx, dy);
                if ((axis === 'h') === isH && len > bl) { bl = len; best = li; }
              });
              if (best >= 0) se.dimDist(lines[best].a, lines[best].b, axis);
            }, a.axis);
          }
          // clickptwhere: clic REAL en el punto más 'bl' (abajo-izq) / 'tr' etc.
          else if (a.type === 'clickptwhere') {
            const pos = await page.evaluate((where) => {
              const se = window.__sketchEditor; if (!se) return null;
              const pts = se.points(); if (!pts.length) return null;
              const score = (p) => where === 'bl' ? (p.x + p.y) : where === 'tr' ? -(p.x + p.y) : where === 'origin' ? (Math.abs(p.x) + Math.abs(p.y)) : p.x;
              let bi = 0; pts.forEach((p, i) => { if (score(p) < score(pts[bi])) bi = i; });
              const px = se.toPx(pts[bi].x, pts[bi].y); const r = se.svgRect();
              return { x: r.left + px.px, y: r.top + px.py };
            }, a.where || 'bl');
            if (pos) { await glide(pos.x, pos.y); await page.mouse.click(pos.x, pos.y); }
          }
          else if (a.type === 'probe') {
            const inv = await page.evaluate('window.__forgeBrep && window.__forgeBrep.invariants');
            console.log(`  probe[${a.label || paso.id}]: vol=${inv && inv.vol_kernel} ops=[${inv && inv.ops}]`);
          }
        } catch (ge) {
          rec.gestosOk = false;
          errors.push(`GESTO ${paso.id}/${a.type}: ${String(ge).slice(0, 140)}`);
        }
        await page.waitForTimeout((a.settle ?? 700) * PACE);
      }
      // Ritmo: el paso dura al menos su narración + aire.
      const objetivo = durs[i].dur * 1000 + AIRE_S * 1000;
      const falta = objetivo - (Date.now() - t0);
      if (falta > 0) await page.waitForTimeout(falta);
      // Check del paso (no aborta; el reporte decide si el video sirve).
      if (paso.check) {
        try {
          rec.check = await page.evaluate((js) => {
            const inv = window.__forgeBrep && window.__forgeBrep.invariants;
            const sk = window.__sketchEditor;
            return { pass: !!eval(js), vol: inv && inv.vol_kernel, dof: sk && sk.dof };
          }, paso.check.js);
        } catch (e) { rec.check = { pass: false, err: String(e).slice(0, 120) }; }
        console.log(`  ${rec.check.pass ? '✓' : '✗'} ${paso.id} check: ${paso.check.desc}${rec.check.pass ? '' : ' — FALLÓ'}`);
      } else console.log(`  · ${paso.id}`);
      rec.end = Date.now() - recT0;
      meta.pasos.push(rec);
      await page.screenshot({ path: `${OUT}/paso_${paso.id}.png`, timeout: 30000 });
    }
    await page.evaluate('window.__setChyron && window.__setChyron(null)');
    await page.waitForTimeout(1200);
    const inv = await page.evaluate('window.__forgeBrep && window.__forgeBrep.invariants').catch(() => null);
    meta.invariantsFinal = inv && { vol: inv.vol_kernel, mass_g: inv.mass_g, ops: inv.ops, euler: inv.euler };
  } catch (e) {
    meta.fatal = String((e && e.stack) || e).slice(0, 600);
    console.log('CLASE_FAIL ' + String(e).slice(0, 200));
  } finally {
    try {
      const v = page.video(); await page.close(); await context.close();
      if (v) { meta.video = await v.path(); console.log('VIDEO ' + meta.video); }
    } catch (e) { console.log('VIDEO_ERR ' + String(e).slice(0, 120)); }
    await browser.close();
    fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 2));
    const fails = meta.pasos.filter((p) => p.check && !p.check.pass).length;
    console.log(`CLASE_${meta.fatal ? 'FATAL' : fails ? 'CHECKS_FAIL' : 'OK'} pasos=${meta.pasos.length} checksFallidos=${fails} errores=${errors.length}`);
    process.exitCode = meta.fatal ? 2 : fails ? 1 : 0;   // 2 = reintentable (recarga/crash)
  }
})();
