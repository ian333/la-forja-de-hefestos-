/**
 * ForjaAgent — SDK para MANEJAR La Forja por la interfaz (window.__forgeBrep).
 * ==========================================================================
 * La idea del fundador: "habrá IAs que lo manejen". Esta es esa API: una IA o un
 * humano (vía script) CONSTRUYE piezas/máquinas y ANALIZA, todo a través de la
 * MISMA interfaz que usa la UI — sin hardcodear geometría. Reusable.
 *
 *   const { ForjaAgent } = require('./forja-agent.cjs');
 *   const a = await new ForjaAgent().open();
 *   await a.newDoc(); await a.sketch({ kind:'rect', width:140, height:70 });
 *   await a.updateOpByType('extrude', { depth:14 });
 *   await a.addComponent('cyl', { r:22, h:14, x:55, y:28, z:-7 });
 *   const m = await a.massKg();        // peso/masa del ENSAMBLE (del kernel)
 *   await a.shot('/tmp/rover.png');    // verificación visual
 *   await a.close();
 *
 * Genera telemetría real (cada acción pasa por la app instrumentada).
 */
const { chromium } = require('playwright');

const GPU_ARGS = ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist',
  '--enable-gpu', '--use-gl=angle', '--hide-scrollbars', '--window-size=1600,1000'];

class ForjaAgent {
  constructor(opts = {}) {
    this.url = opts.url || process.env.URL || 'http://localhost:5001/forja-brep.html';
    this.telemetryUrl = opts.telemetryUrl || process.env.TELEMETRY_URL || 'http://localhost:8002/events';
    this.exe = opts.exe || '/usr/bin/google-chrome-stable';
    this._posted = [];
    this._errors = [];
  }

  async open() {
    this.browser = await chromium.launch({ headless: false, executablePath: this.exe, args: GPU_ARGS });
    this.page = await this.browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await this.page.addInitScript((u) => { window.__TELEMETRY_URL = u; }, this.telemetryUrl);
    this.page.on('request', (r) => {
      if (r.method() === 'POST' && /\/events$/.test(r.url())) {
        try { const b = JSON.parse(r.postData() || '[]'); (Array.isArray(b) ? b : b.events || []).forEach((e) => this._posted.push(e.type)); } catch { /* beacon */ }
      }
    });
    this.page.on('pageerror', (e) => this._errors.push(String(e).slice(0, 160)));
    await this.page.goto(this.url, { waitUntil: 'load', timeout: 60000 });
    // El doc default arranca VACÍO (sin sólido): `ready` exige build exitoso, así
    // que el kernel cargado se detecta por ready O por el error "sin sólido".
    await this.page.waitForFunction('window.__forgeBrep && (window.__forgeBrep.ready || !!window.__forgeBrep.error)', { timeout: 60000 });
    return this;
  }

  // ── primitivas de la interfaz ──
  eval(expr) { return this.page.evaluate(expr); }
  call(method, ...args) { return this.page.evaluate(({ m, a }) => window.__forgeBrep[m](...a), { m: method, a: args }); }
  wait(ms) { return this.page.waitForTimeout(ms); }

  // ── construir (TODO por la interfaz, sin hardcodear geometría) ──
  async isAlive() { return this.eval('!!window.__forgeBrep').catch(() => false); }
  async reload() {
    // Recargar = re-inicializar el WASM OCCT FRESCO → resetea el heap (el render
    // se degrada y la app se desmonta tras ~6-8 builds en una misma página).
    await this.page.goto(this.url, { waitUntil: 'load', timeout: 60000 });
    await this.page.waitForFunction('window.__forgeBrep && (window.__forgeBrep.ready || !!window.__forgeBrep.error)', { timeout: 60000 });
    await this.wait(300); return this;
  }
  async newDoc() {
    if (!(await this.isAlive())) await this.reload();   // self-heal si la app murió
    await this.eval('window.__forgeBrep.newDoc()');
    // Doc nuevo = VACÍO (sin auto-extrude): listo cuando el kernel responde (ready o error benigno).
    await this.page.waitForFunction('window.__forgeBrep && (window.__forgeBrep.ready || !!window.__forgeBrep.error)', { timeout: 20000 });
    await this.wait(350); return this;
  }
  async sketch(patch) { await this.eval(`window.__forgeBrep.setSketch(s => ({ ...s, ...${JSON.stringify(patch)} }))`); await this.wait(450); return this; }
  async op(type) {
    const before = await this.eval('window.__forgeBrep.opsList.length');
    await this.call('addOp', type);
    await this.page.waitForFunction(`window.__forgeBrep.opsList.length > ${before}`, { timeout: 8000 }).catch(() => {});
    await this.wait(350); return this;
  }
  async updateOpByType(type, patch) {
    // Apunta al ÚLTIMO op de ese tipo (permite encadenar varios barrenos).
    await this.page.waitForFunction(`window.__forgeBrep.opsList.some(o=>o.type==='${type}')`, { timeout: 8000 }).catch(() => {});
    const ops = await this.eval('window.__forgeBrep.opsList');
    const matches = ops.filter((x) => x.type === type);
    const o = matches[matches.length - 1];
    if (o) await this.call('updateOp', o.id, patch);
    await this.wait(350); return this;
  }
  async addComponent(kind, patch = {}) {
    // addComponent dispara setState de React; el getter `components` solo refleja
    // el nuevo arreglo tras el re-render. Esperar a que CREZCA antes de leer el id.
    const before = await this.eval('window.__forgeBrep.components.length');
    await this.call('addComponent', kind);
    await this.page.waitForFunction(`window.__forgeBrep.components.length > ${before}`, { timeout: 10000 });
    const comps = await this.eval('window.__forgeBrep.components');
    const id = comps[comps.length - 1].id;
    if (Object.keys(patch).length) {
      await this.call('updateComponent', id, patch);
      // CLAVE: esperar a que el patch SE APLIQUE de verdad. Si no, bajo adiciones
      // rápidas el componente se queda en su tamaño DEFAULT (cyl r25·h60 = 117810
      // mm³) → recreación gigante y errónea. Verificamos una dim del patch.
      const key = patch.r != null ? 'r' : patch.w != null ? 'w' : 'h';
      const want = patch[key];
      await this.page.waitForFunction(
        (a) => { const c = window.__forgeBrep.components.find((c) => c.id === a.id); return c && Math.abs(c[a.key] - a.want) < 1e-6; },
        { id, key, want }, { timeout: 8000 },
      ).catch(() => {});
    }
    await this.wait(150); return id;
  }
  async material(m) { await this.call('setMaterial', m); await this.wait(300); return this; }
  async view(name) { await this.call('setView', name); await this.wait(500); return this; }

  // ── analizar (por la interfaz / kernel) ──
  invariants() { return this.eval('window.__forgeBrep.invariants'); }
  async massKg() { const inv = await this.invariants(); return inv && inv.mass_g != null ? inv.mass_g / 1000 : null; }
  async fea({ N = 500 } = {}) {
    const faces = await this.eval('window.__forgeBrep.listFaces()');
    let lo = -1, hi = -1, zlo = 1e9, zhi = -1e9;
    for (const f of faces) if (f.kind === 'plane') { if (f.center[2] < zlo) { zlo = f.center[2]; lo = f.index; } if (f.center[2] > zhi) { zhi = f.center[2]; hi = f.index; } }
    await this.call('setFeaFixedFace', lo); await this.call('setFeaLoadFace', hi); await this.call('setFeaLoad', N);
    await this.eval('window.__forgeBrep.runFEA && window.__forgeBrep.runFEA()');
    await this.wait(4000);
    return this.eval('window.__forgeBrep.feaResult');
  }

  // ── verbos de construcción de alto nivel (todo por la interfaz) ──
  async hole(patch = {}) { await this.op('hole'); await this.updateOpByType('hole', { x: 0, y: 0, diameter: 8, through: true, ...patch }); return this; }
  async fillet(radius = 3) { await this.op('fillet'); await this.updateOpByType('fillet', { radius }); return this; }
  async loft(patch = {}) { await this.op('loft'); await this.updateOpByType('loft', { height: 20, topScale: 0.5, ...patch }); return this; }
  async sweep(patch = {}) { await this.op('sweep'); await this.updateOpByType('sweep', { pathKind: 'arc', radius: 20, angle: 90, ...patch }); return this; }
  async pattern(patch = {}) { await this.op('pattern'); await this.updateOpByType('pattern', patch); return this; }
  async gear({ m = 2, Z = 18, alphaDeg = 20, thickness = 12, bore = 6 } = {}) {
    const v0 = await this.eval('window.__forgeBrep.invariants && window.__forgeBrep.invariants.vol_kernel');
    await this.eval(`window.__forgeBrep.setSketch(s => ({ ...s, kind:'gear', gear:{ ...s.gear, m:${m}, Z:${Z}, alphaDeg:${alphaDeg}, thickness:${thickness}, bore:${bore} } }))`);
    // El engrane (buildGearSolid, involuta) reconstruye más lento que la caja:
    // esperar a que el volumen DEJE de ser el del rect base antes de leer.
    await this.page.waitForFunction(`window.__forgeBrep.invariants && Math.abs((window.__forgeBrep.invariants.vol_kernel||0) - ${v0 || 0}) > 1`, { timeout: 8000 }).catch(() => {});
    await this.wait(500); return this;
  }
  async shaft(steps) { // revolve de un perfil escalonado [{r,L},...]
    await this.eval(`window.__forgeBrep.setSketch(s => ({ ...s, kind:'revprofile', steps:${JSON.stringify(steps)} }))`);
    await this.wait(400); await this.call('addOp', 'revolve'); await this.wait(600); return this;
  }
  async custom(points, smooth = false) { // perfil arbitrario (leva, etc.) → sólido
    await this.eval(`window.__forgeBrep.setSketch(s => ({ ...s, kind:'custom', customProfile:${JSON.stringify(points)}, smooth:${smooth} }))`);
    await this.wait(450); return this;
  }

  // ── capturar ──
  async shot(path) { await this.wait(800); await this.page.screenshot({ path }); return path; }
  telemetry() { const c = {}; this._posted.forEach((t) => (c[t] = (c[t] || 0) + 1)); return { total: this._posted.length, by_type: c, errors: this._errors }; }

  async close() {
    // A prueba de página/navegador YA muerto (Target closed) — nunca lanzar.
    try { await this.eval(() => document.dispatchEvent(new Event('visibilitychange'))); } catch {}
    try { await this.wait(1500); } catch {}
    try { await this.page.close(); } catch {}
    try { await this.browser.close(); } catch {}
  }
}

module.exports = { ForjaAgent };
