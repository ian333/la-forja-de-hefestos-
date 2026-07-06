/**
 * La Forja — GENERADOR DE TUTORIALES por COMANDOS/CLICS (NO programa la app).
 * ==========================================================================
 * Opera el Part Studio real (window.__forgeBrep + clics Playwright) ejecutando
 * la currícula CAD canónica. Cada corrida:
 *   1) GENERA TELEMETRÍA real (clics auto-capturados + forja.fea_live/generative
 *      + pageview/webgl) que ATERRIZA en el servidor (__TELEMETRY_URL).
 *   2) Captura un SCREENSHOT por paso → contenido del tutorial.
 *   3) Emite un MANIFIESTO JSON (pasos + tomas) que puede alimentar
 *      TutorialesPortal como DATOS (no código).
 *
 * La currícula es DATOS; el "cómo" son comandos/clics. No se toca el código de
 * la app. Filosofía del proyecto: el humano DISEÑA, aquí lo manejamos por la UI.
 *
 *   env URL, TELEMETRY_URL, OUT (dir de tomas), ONLY (ids separados por coma)
 */
const fs = require('fs');
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const TELEMETRY_URL = process.env.TELEMETRY_URL || 'http://localhost:8002/events';
const OUT = process.env.OUT || '/tmp/forja-tut';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);

// ── CURRÍCULA (DATOS) — cada paso opera la app; `shot` captura el momento ──
// persona/aplicacion se rellenan/afinan con la investigación de mercado.
const CURRICULA = [
  {
    id: 't1-placa', titulo: 'Tu primera pieza: placa con barrenos',
    objetivo: 'El ritual CAD completo: croquis → extruir → barreno → redondeo → leer la masa.',
    aplicacion: 'Soportes, bridas, placas de montaje — el 80% de las piezas de un taller.',
    steps: [
      { desc: 'Parte de una placa (croquis rectángulo ya extruido a sólido).', act: async (h) => { await h.reset(); }, shot: 'placa-base' },
      { desc: 'Agrega un barreno: clic en ◎ Hole. El volumen baja (se quitó material).', act: async (h) => { await h.click('btn-hole'); await h.waitOp('hole'); }, shot: 'barreno' },
      { desc: 'Redondea una arista: ◜ Fillet → clic en la arista de la lista.', act: async (h) => { await h.click('btn-fillet'); await h.pick('edge-item-0'); }, shot: 'fillet' },
      { desc: 'Lee masa, volumen y centro de masa en el panel de Análisis (exacto, del kernel).', act: async (h) => { await h.wait(600); }, shot: 'analisis' },
    ],
  },
  {
    id: 't2-fea', titulo: '¿Aguanta? Análisis de esfuerzos (FEA) en vivo',
    objetivo: 'Fijar una cara, aplicar una carga y ver el esfuerzo de von Mises + el factor de seguridad.',
    aplicacion: 'El diferenciador: saber si la pieza se rompe ANTES de fabricarla.',
    steps: [
      { desc: 'Pieza base. Vamos a empotrar la cara inferior y cargar la superior.', act: async (h) => { await h.reset(); }, shot: 'fea-pieza' },
      { desc: 'Fija la cara inferior, carga la superior con 500 N y resuelve K·u=f.', act: async (h) => {
          const faces = await h.api('window.__forgeBrep.listFaces()');
          let lo = -1, hi = -1, zlo = 1e9, zhi = -1e9;
          for (const f of faces) if (f.kind === 'plane') { if (f.center[2] < zlo) { zlo = f.center[2]; lo = f.index; } if (f.center[2] > zhi) { zhi = f.center[2]; hi = f.index; } }
          await h.api(`window.__forgeBrep.setFeaFixedFace(${lo})`);
          await h.api(`window.__forgeBrep.setFeaLoadFace(${hi})`);
          await h.api(`window.__forgeBrep.setFeaLoad(500)`);
          await h.api('window.__forgeBrep.runFEA && window.__forgeBrep.runFEA()');
          await h.wait(4000);
        }, shot: 'fea-vonmises' },
      { desc: 'Sube la carga a 900 N en vivo (warm-start): el campo se recalcula al instante.', act: async (h) => { await h.api('window.__forgeBrep.feaLiveSetLoad && window.__forgeBrep.feaLiveSetLoad(900)'); await h.wait(2500); }, shot: 'fea-900N' },
    ],
  },
  {
    id: 't3-generativo', titulo: 'Menos material, misma fuerza: diseño generativo',
    objetivo: 'Optimización topológica (SIMP): la IA quita material donde no trabaja.',
    aplicacion: 'Piezas ligeras impresas en 3D — gratis aquí, premium en Fusion.',
    steps: [
      { desc: 'Define el caso de carga (cara fija + carga), igual que en FEA.', act: async (h) => {
          await h.reset();
          const faces = await h.api('window.__forgeBrep.listFaces()');
          let lo = -1, hi = -1, zlo = 1e9, zhi = -1e9;
          for (const f of faces) if (f.kind === 'plane') { if (f.center[2] < zlo) { zlo = f.center[2]; lo = f.index; } if (f.center[2] > zhi) { zhi = f.center[2]; hi = f.index; } }
          await h.api(`window.__forgeBrep.setFeaFixedFace(${lo})`);
          await h.api(`window.__forgeBrep.setFeaLoadFace(${hi})`);
          await h.api(`window.__forgeBrep.setFeaLoad(600)`);
        }, shot: 'gen-caso' },
      { desc: 'Fracción de volumen 40% y ¡optimiza! El sólido se vuelve orgánico.', act: async (h) => {
          await h.api('window.__forgeBrep.setGenVolfrac && window.__forgeBrep.setGenVolfrac(0.4)');
          await h.api('window.__forgeBrep.runGenerative && window.__forgeBrep.runGenerative()');
          await h.wait(9000);
        }, shot: 'generativo' },
    ],
  },
  {
    id: 't4-revolve', titulo: 'Pieza de revolución: una flecha escalonada',
    objetivo: 'Revolucionar un perfil 2D alrededor de un eje → sólidos de rotación exactos.',
    aplicacion: 'Flechas, poleas, bridas, boquillas — todo lo torneado.',
    steps: [
      { desc: 'Cambia el croquis a perfil de escalones (radio–longitud).', act: async (h) => { await h.reset(); await h.api("window.__forgeBrep.setSketch(s => ({...s, kind:'revprofile'}))"); await h.wait(500); }, shot: 'rev-perfil' },
      { desc: 'Revoluciona 360° alrededor del eje: ⟳ Revolve.', act: async (h) => { await h.click('btn-revolve'); await h.waitOp('revolve'); await h.wait(600); }, shot: 'revolve' },
    ],
  },
  {
    id: 't5-loft', titulo: 'Embudo por Loft: piel entre perfiles',
    objetivo: 'Interpolar un sólido entre el perfil base y una copia escalada (tronco/cono).',
    aplicacion: 'Embudos, tolvas, salidas de molde, transiciones.',
    steps: [
      { desc: 'Pieza base.', act: async (h) => { await h.reset(); }, shot: 'loft-base' },
      { desc: 'Aplica ◈ Loft: piel entre el perfil y una copia al 50% en altura.', act: async (h) => { await h.click('btn-loft'); await h.waitOp('loft'); await h.wait(700); }, shot: 'loft' },
    ],
  },
  {
    id: 't6-sweep', titulo: 'Tubo y resorte por Sweep: barrer por una trayectoria',
    objetivo: 'Barrer el perfil por un codo (esquina redondeada real) o una hélice (resorte).',
    aplicacion: 'Tuberías, ductos, resortes, manijas.',
    steps: [
      { desc: 'Pieza base.', act: async (h) => { await h.reset(); }, shot: 'sweep-base' },
      { desc: 'Aplica ↝ Sweep: el perfil barre un codo (la esquina se redondea sola).', act: async (h) => { await h.click('btn-sweep'); await h.waitOp('sweep'); await h.wait(700); }, shot: 'sweep-codo' },
      { desc: 'Cambia la trayectoria a Hélice → un resorte (auto-dimensionado, siempre válido).', act: async (h) => { await h.click('sweep-helix'); await h.wait(1400); }, shot: 'sweep-resorte' },
    ],
  },
  {
    id: 't7-engrane', titulo: 'Engrane real de involuta',
    objetivo: 'Generar un engrane paramétrico (módulo, dientes, ángulo) y exportarlo a STL.',
    aplicacion: 'Reductores, cajas, mecanismos impresos en 3D.',
    steps: [
      { desc: 'Genera un engrane de involuta: ⚙ Engrane.', act: async (h) => { await h.reset(); await h.click('btn-gear'); await h.wait(1500); }, shot: 'engrane' },
      { desc: 'Exporta a STL para imprimir (cierra el ciclo diseño→fábrica).', act: async (h) => { await h.api('window.__forgeBrep.exportSTL && window.__forgeBrep.exportSTL()'); await h.wait(600); }, shot: 'engrane-stl' },
    ],
  },
  {
    id: 't8-plano', titulo: 'Del diseño al taller: plano 2D + STL',
    objetivo: 'Generar un plano de taller (3 vistas con líneas ocultas reales) y exportar STL.',
    aplicacion: 'La documentación que el taller necesita para fabricar.',
    steps: [
      { desc: 'Pieza con barreno.', act: async (h) => { await h.reset(); await h.click('btn-hole'); await h.waitOp('hole'); }, shot: 'plano-pieza' },
      { desc: 'Genera el plano de taller: 3 vistas ortográficas + cotas + cajetín.', act: async (h) => { await h.api('window.__forgeBrep.genPlano && window.__forgeBrep.genPlano()'); await h.wait(1500); }, shot: 'plano' },
    ],
  },
];

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
           '--use-gl=angle', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript((u) => { window.__TELEMETRY_URL = u; }, TELEMETRY_URL);

  const posted = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/events$/.test(r.url())) {
      try { const b = JSON.parse(r.postData() || '[]'); (Array.isArray(b) ? b : b.events || []).forEach((e) => posted.push(e.type)); } catch { /* beacon */ }
    }
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });

  const manifest = { generated: 'driven-by-commands-and-clicks', telemetry_url: TELEMETRY_URL, tutoriales: [] };
  const list = ONLY.length ? CURRICULA.filter((t) => ONLY.includes(t.id)) : CURRICULA;

  for (const tut of list) {
    const dir = `${OUT}/${tut.id}`;
    fs.mkdirSync(dir, { recursive: true });
    const h = {
      api: (expr) => page.evaluate(expr),
      click: async (testid) => { await page.click(`[data-testid="${testid}"]`); },
      pick: async (testid) => { await page.waitForSelector(`[data-testid="${testid}"]`, { timeout: 10000 }); await page.click(`[data-testid="${testid}"]`); await page.waitForTimeout(900); },
      waitOp: (op) => page.waitForFunction(`window.__forgeBrep.invariants && window.__forgeBrep.invariants.ops.includes('${op}') && !window.__forgeBrep.invariants.error`, { timeout: 25000 }),
      wait: (ms) => page.waitForTimeout(ms),
      reset: async () => { await page.evaluate('window.__forgeBrep.newDoc && window.__forgeBrep.newDoc()'); await page.waitForFunction('window.__forgeBrep.ready', { timeout: 20000 }); await page.waitForTimeout(600); },
    };
    const tOut = { id: tut.id, titulo: tut.titulo, objetivo: tut.objetivo, aplicacion: tut.aplicacion, pasos: [] };
    console.log(`\n▶ ${tut.id} · ${tut.titulo}`);
    for (let i = 0; i < tut.steps.length; i++) {
      const st = tut.steps[i];
      const n = String(i + 1).padStart(2, '0');
      try {
        await st.act(h);
        await page.waitForTimeout(500);
        const file = `${dir}/${n}-${st.shot}.png`;
        await page.screenshot({ path: file });
        const inv = await page.evaluate('window.__forgeBrep.invariants').catch(() => null);
        tOut.pasos.push({ n: i + 1, desc: st.desc, shot: file, vol: inv && inv.vol_kernel, mass_g: inv && inv.mass_g, ops: inv && inv.ops });
        console.log(`  ✓ ${n} ${st.shot}  ${inv ? `vol=${(inv.vol_kernel||0).toFixed(0)} ops=[${(inv.ops||[]).join(',')}]` : ''}`);
      } catch (e) {
        tOut.pasos.push({ n: i + 1, desc: st.desc, error: String(e).slice(0, 120) });
        console.log(`  ✗ ${n} ${st.shot}  ERROR: ${String(e).slice(0, 80)}`);
      }
    }
    manifest.tutoriales.push(tOut);
  }

  // flush final de telemetría
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(() => {});
  await page.waitForTimeout(3000);
  await page.close();
  await browser.close();

  const counts = {};
  for (const t of posted) counts[t] = (counts[t] || 0) + 1;
  manifest.telemetry = { posted_total: posted.length, by_type: counts, forja_events: posted.filter((t) => /^forja\./.test(t)).length };
  manifest.page_errors = errors;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
  console.log('\n=== TELEMETRÍA generada ===\n' + JSON.stringify(counts, null, 2));
  console.log(`\nmanifiesto → ${OUT}/manifest.json  ·  tutoriales: ${manifest.tutoriales.length}  ·  errores de página: ${errors.length}`);
})();
