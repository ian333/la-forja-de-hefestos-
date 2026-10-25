#!/usr/bin/env node
/**
 * EL BANCO EN EL NAVEGADOR (orden 2026-10-24-d-el-qa-real, punto 4)
 * ============================================================================
 * Recorre una lista de piezas contra la app REAL (la URL de un build), UN NAVEGADOR FRESCO por pieza y por corrida, tomando el
 * turno del GPU (`flock /home/ian/el-plan/gpu.lock`) POR PIEZA — entre una y otra pasan las demás órdenes —, y escribe un ACTA
 * HTML con, por pieza: matrícula, ¿armó molde?, huella, números dorados contra medidos y UN still 4K del paso que importa.
 *
 * Las piezas son de tres clases:
 *   · LA BOX (1594C Box.stp): huella ×3 (determinismo) + números dorados (scripts/qa-dorados/1594C-Box.json) + su par de control.
 *   · LOS ROTOS (test-parts/rotos/NN-*.oraculo.json): cada uno con su ORÁCULO — qué DEBE decir la puerta al soltarlo (y, la tapa,
 *     que no se arme molde ni precio). El 00 es el CONTROL SANO: la puerta NO lo debe rechazar.
 *   · HAMMOND (test-parts/inyeccion-reales/…): piezas reales sanas, ×1: ¿armó molde?, huella, still (solo de noche).
 * EL PAR DE CONTROL MANDA (juez C D4, qa-automation (h)2): si la app deja pasar UNA pieza rota (la «pone en verde»), la corrida
 * entera es NO CONFIABLE — un verde de esa noche no certifica nada, porque la puerta aprueba basura. Hoy (antes de la orden C)
 * se espera NO CONFIABLE: es exactamente lo que el banco debe decir hasta que la puerta las detenga.
 *
 * uso (iangpu, receta GPU; NO lo envuelvas en flock: el banco toma el turno por pieza y anidarlo lo bloquearía para siempre):
 *   env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA NODE_PATH=/home/ian/Orkesta/la-forja/node_modules \
 *     URL=http://localhost:4270/forja-brep.html node scripts/qa-banco.cjs [--lista box|rotos|noche] [--out <dir>] [--rotos <dir>]
 *   --lista box    solo la Box: huella ×3 + dorados (≈ 6–7 min de GPU, un turno) — lo que corre un agente antes de su commit
 *   --lista rotos  la Box + su control + los 6 fixtures (≈ 13 min de GPU en 3 turnos)
 *   --lista noche  lo anterior + 3 Hammond (el cron; ≈ 25 min de GPU)  ← por omisión
 *   (medido 2026-10-24; más la ESPERA de cada turno en gpu.lock, que esa tarde fue de 15–40 min)
 *   --rotos <dir>  dónde están los fixtures (por omisión test-parts/rotos; en una copia forja-devN su test-parts es el del repo principal)
 *   --out <dir>    por omisión /home/ian/el-plan/qa/<fecha>  → acta.html + acta.json + acta.png + stills/ + corridas/
 *   --sin-turno    no toma el gpu.lock (solo si ya nadie más usa el GPU)
 * exit: 0 todo verde y CONFIABLE · 1 algún rojo o NO CONFIABLE · 2 la corrida no vale (GPU equivocada / WebGL)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync, execSync } = require('child_process');
const H = require('./qa-huella.cjs');
const D = require('./qa-dorados.cjs');

const REPO = H.REPO;
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const URL = process.env.URL || 'http://localhost:4270/forja-brep.html';
const LOCK = '/home/ian/el-plan/gpu.lock';
const BOX = 'test-parts/inyeccion-reales/1594C Box.stp';
const DORADOS_BOX = 'scripts/qa-dorados/1594C-Box.json';
// las 3 Hammond del banco nocturno: sanas y de una sola pieza moldeable — la mayor de cada archivo (intake.json: «si», cerradas)
const HAMMOND = ['test-parts/inyeccion-reales/1598B Bottom.stp', 'test-parts/inyeccion-reales/1599HBK.stp', 'test-parts/inyeccion-reales/1591XXCBK.stp'];
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const extracto = (t, i, n = 140) => (i == null || i < 0 ? '' : (i > n ? '…' : '') + t.slice(Math.max(0, i - n), i + n) + (i + n < t.length ? '…' : ''));

/** la matrícula de lo que la app CARGÓ (la malla de `piezaMalla`), medida en la página: soldadura exacta de vértices, aristas
 *  de frontera / no-manifold, componentes (unión de triángulos por vértice), volumen con signo, caja. Es un espejo ligero de
 *  `matricula.ts`: dice lo que la app tiene en la mano, no lo que el archivo dice traer. */
function matriculaEnPagina() {
  const Q = window.__qaForja; const pm = Q && Q.piezaMalla; if (!pm || !pm.mesh) return null;
  const P = pm.mesh.positions, I0 = pm.mesh.indices; const nV = P.length / 3;
  const I = I0 && I0.length ? I0 : Uint32Array.from({ length: nV }, (_, i) => i);
  // soldar con la tolerancia de matricula.ts (1e-6 · diagonal): con la clave EXACTA la Box sana salía «abierta» (8 aristas)
  let b0 = [1e18, 1e18, 1e18], b1 = [-1e18, -1e18, -1e18];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < b0[k]) b0[k] = P[i + k]; if (P[i + k] > b1[k]) b1[k] = P[i + k]; }
  const tol = Math.max(1e-9, 1e-6 * Math.hypot(b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]));
  const id = new Map(); const vid = new Int32Array(nV);
  for (let v = 0; v < nV; v++) { const k = Math.round(P[3 * v] / tol) + ',' + Math.round(P[3 * v + 1] / tol) + ',' + Math.round(P[3 * v + 2] / tol); let u = id.get(k); if (u === undefined) { u = id.size; id.set(k, u); } vid[v] = u; }
  const ar = new Map(); const padre = new Int32Array(id.size).map((_, i) => i);
  const raiz = (x) => { while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; } return x; };
  let vol = 0, degenerados = 0; const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
  for (let t = 0; t < I.length; t += 3) {
    const a = vid[I[t]], b = vid[I[t + 1]], c = vid[I[t + 2]];
    // un triángulo con dos vértices soldados es una aguja sin área: matricula.ts no lo cuenta para Euler ni para el cierre (la Box trae 8)
    if (a === b || b === c || a === c) { degenerados++; continue; }
    for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = x < y ? x + ':' + y : y + ':' + x; ar.set(k, (ar.get(k) || 0) + 1); }
    const ra = raiz(a); padre[raiz(b)] = ra; padre[raiz(c)] = ra;
    const i0 = 3 * I[t], i1 = 3 * I[t + 1], i2 = 3 * I[t + 2];
    vol += P[i0] * (P[i1 + 1] * P[i2 + 2] - P[i1 + 2] * P[i2 + 1]) - P[i0 + 1] * (P[i1] * P[i2 + 2] - P[i1 + 2] * P[i2]) + P[i0 + 2] * (P[i1] * P[i2 + 1] - P[i1 + 1] * P[i2]);
    for (const i of [i0, i1, i2]) for (let k = 0; k < 3; k++) { if (P[i + k] < mn[k]) mn[k] = P[i + k]; if (P[i + k] > mx[k]) mx[k] = P[i + k]; }
  }
  let frontera = 0, noManifold = 0; for (const n of ar.values()) { if (n === 1) frontera++; else if (n > 2) noManifold++; }
  const raices = new Set(); for (let t = 0; t < I.length; t += 3) { const a = vid[I[t]], b = vid[I[t + 1]], c = vid[I[t + 2]]; if (a !== b && b !== c && a !== c) raices.add(raiz(a)); }
  const r2 = (v) => Math.round(v * 100) / 100; const dim = [0, 1, 2].map((k) => r2(mx[k] - mn[k]));
  return { nombre: pm.nombre, triangulos: I.length / 3, degenerados, vertices: id.size, cerrada: frontera === 0 && noManifold === 0, frontera, noManifold,
    componentes: raices.size, volConSigno: r2(vol / 6), caja: dim, diagonal: r2(Math.hypot(...dim)), notas: pm.notas || [] };
}

// ── el trabajador: UNA pieza en UN navegador (corre como subproceso, dentro del turno del GPU) ─────────────────────────────
async function uno(spec) {
  const archivo = path.resolve(REPO, spec.archivo);
  const r = { id: spec.id, clase: spec.clase, archivo: spec.archivo, sha256: sha256(archivo), k: spec.k || 1, url: URL };
  if (spec.clase !== 'roto') {
    // la Box y las Hammond: la MISMA corrida que qa-huella (camino completo hasta el portamoldes, huella, dorados, still) + la matrícula
    const b = await H.lanza();
    try { Object.assign(r, await H.corrida(b, URL, archivo, { stillEn: spec.still, enPagina: { matricula: matriculaEnPagina }, reloj: spec.reloj || 'real' })); }
    finally { await b.close().catch(() => {}); }
    r.archivo = spec.archivo;
    return r;
  }
  // LOS ROTOS: soltar y LEER lo que la puerta dice (sin tocar nada: el aviso de entrada ES el oráculo)
  const o = spec.oraculo; r.oraculo = o;
  const b = await H.lanza();
  try {
    const s = await H.abre(b, URL); Object.assign(r, { gpu: s.gpu, msCarga: s.msCarga });
    try {
      // NOMBRE NEUTRO (medido 2026-10-24, primera corrida): la app escribe el nombre del archivo en pantalla («Estado 01-abierta —
      // malla del operador») y el oráculo /abiert/ se cumplía con el NOMBRE, no con la puerta: 3 de 4 rotos salían «detenidos» sin
      // que la app dijera nada. Se sueltan como `pieza.<ext>` y, por si acaso, el nombre real se borra del texto antes de buscar.
      const neutro = 'pieza' + path.extname(archivo).toLowerCase();
      await H.suelta(s.page, archivo, neutro);
      const t = Date.now();
      try { await H.espera(s.page, `!!(document.querySelector('[data-testid="el-parte-foco"]') || document.querySelector('[data-testid="rp-error"]'))`, 120000); r.aparecio = true; }
      catch (e) { r.aparecio = false; r.nota = 'ni la pieza ni un error en 120 s'; }
      r.msPuerta = Date.now() - t;
      await s.page.waitForTimeout(4000);   // la puerta de la orden C promete su tarjeta en ≤ 3 s
      const base = path.basename(archivo), sinExt = base.replace(/\.[^.]+$/, '');
      r.texto = (await H.textoVisible(s.page)).split(base).join('').split(sinExt).join('');
      r.matricula = await s.page.evaluate(matriculaEnPagina);
      r.still = await H.still(s.cdp, spec.still);
      const re = (x) => (x ? new RegExp(x, 'i') : null);
      if (o.dice) { const m = r.texto.match(re(o.dice)); r.dijo = m ? extracto(r.texto, m.index) : null; }
      if (o.noDice) { const m = r.texto.match(re(o.noDice)); r.dijoMal = m ? extracto(r.texto, m.index) : null; }
      if (o.sinMolde || o.sinPrecio) {
        // como lo haría ian: acepta el aviso y pide el camino hasta el MOLDE; si la puerta lo bloquea, el molde no nace
        await H.clic(s.page, 'aviso-entrada-ok');
        const pasos = [['parte-lente-enfriamiento', 'escala-enfriamiento', 120000], ['d', 'lamina-dictamen', 30000], ['Escape', null, 0], ['parte-lente-particion', 'linea-particion', 20000]];
        for (const [g, espera, ms] of pasos) {
          if (g.length <= 6) await s.page.keyboard.press(g); else await H.clic(s.page, g);
          if (espera) await H.espera(s.page, `!!document.querySelector('[data-testid="${espera}"]')`, ms).catch(() => {});
          await s.page.waitForTimeout(600);
        }
        r.moldeBoton = await H.clic(s.page, 'parte-lente-molde');
        const t6 = Date.now();
        await H.espera(s.page, `(() => { const m = document.querySelector('[data-testid="molde-de-la-pieza"]'); return m && m.dataset.portamoldes === '1'; })()`, 300000).catch(() => {});
        r.molde = await s.page.evaluate(() => { const m = document.querySelector('[data-testid="molde-de-la-pieza"]'); return m ? { estacion: +m.dataset.estacion, portamoldes: m.dataset.portamoldes === '1', roles: (m.dataset.roles || '').split(' ').filter(Boolean).length } : null; });
        r.molde = { ...(r.molde || { estacion: 0, portamoldes: false, roles: 0 }), ms: Date.now() - t6 };
        r.molde.armo = r.molde.estacion >= 3;   // E3 = acero tallado: ya hay molde
        r.stillMolde = await H.still(s.cdp, spec.still.replace(/\.jpg$/, '-molde.jpg'));
        if (o.sinPrecio) {
          await H.clic(s.page, 'parte-lente-expediente');
          await H.espera(s.page, `!!document.querySelector('[data-testid="expediente-de-la-pieza"]')`, 30000).catch(() => {});
          await s.page.waitForTimeout(1500);
          const ex = await s.page.evaluate(() => { const e = document.querySelector('[data-testid="expediente-de-la-pieza"]'); return e ? { cotizacion: e.dataset.cotizacion === '1' } : null; });
          const tx = await H.textoVisible(s.page); const mp = tx.match(/US\$\s?[\d,]+|\$\s?\d[\d,]{2,}|MXN\s?[\d,]+/);
          r.precio = { expediente: !!ex, cotizacion: !!(ex && ex.cotizacion), visible: mp ? extracto(tx, mp.index, 80) : null };
          r.precio.hay = r.precio.cotizacion || !!r.precio.visible;
        }
      }
    } finally { r.errores = s.errores.slice(0, 20); r.noVale = H.corridaVale(s); await s.ctx.close().catch(() => {}); }
  } finally { await b.close().catch(() => {}); }
  return r;
}

/** ¿la pieza cumple su oráculo? y qué dijo la app (VERDE = la dejó pasar · ROJO = la detuvo/preguntó) */
function juzgaRoto(r) {
  const o = r.oraculo;
  if (o.esperado === 'pasa') {
    const appDijo = r.dijoMal ? 'ROJO' : 'VERDE';
    return { appDijo, debia: 'VERDE', cumple: !!r.aparecio && !r.dijoMal, porque: !r.aparecio ? 'la pieza sana no apareció' : r.dijoMal ? `la puerta rechazó la pieza SANA: «${r.dijoMal}»` : 'pasó la puerta (como debe)' };
  }
  const detuvo = !!r.dijo || (o.sinMolde && r.molde && !r.molde.armo);
  const appDijo = detuvo ? 'ROJO' : 'VERDE';
  const faltas = [];
  if (!r.dijo) faltas.push('nada en pantalla lo dice (ver «Busca en pantalla»)');
  if (o.sinMolde && r.molde && r.molde.armo) faltas.push(`armó el molde (E${r.molde.estacion}${r.molde.portamoldes ? ', portamoldes completo' : ''})`);
  if (o.sinPrecio && r.precio && r.precio.hay) faltas.push(`dio precio (${r.precio.cotizacion ? 'cotización en el expediente' : ''}${r.precio.visible ? ' «' + r.precio.visible + '»' : ''})`);
  return { appDijo, debia: 'ROJO', cumple: faltas.length === 0, porque: faltas.length ? 'la dejó pasar: ' + faltas.join(' · ') : `la detuvo: «${r.dijo}»` };
}

// ── el acta ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v) => (v == null ? '—' : typeof v === 'number' ? String(+v.toPrecision(6)) : esc(v));
function actaHTML(A) {
  const pill = (t, c) => `<span class="pill ${c}">${esc(t)}</span>`;
  const img = (p) => (p ? `<a href="${esc(path.relative(A.out, p))}"><img src="${esc(path.relative(A.out, p))}"></a>` : '<div class="sinimg">sin still</div>');
  const box = A.box;
  const huellaFilas = (box.corridas || []).map((r) => `<tr><td>${r.k}</td><td class="mono">${esc((r.hash || '—').slice(0, 16))}</td><td class="mono">${esc((r.hashAcero || '—').slice(0, 16))}</td><td>${r.huella ? r.huella.cuerpos.length : '—'}</td><td class="mono">${esc(Object.entries(r.ms || {}).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)} s`).join(' · '))}</td><td>${esc(r.rompe || r.noVale || 'ok')}</td></tr>`).join('');
  const dorFilas = box.dorados ? box.dorados.filas.map((f) => `<tr class="${f.ok ? '' : 'malo'}"><td>${f.ok ? '✓' : '✗'}</td><td><b>${esc(f.k)}</b><div class="sub">${esc(f.que)} · ${esc(f.cita)}</div></td><td class="r">${num(f.dorado)} ${esc(f.unidad)}</td><td class="r">${num(f.medido)} ${esc(f.unidad)}</td><td class="r">${f.deltaPct == null ? '' : (f.deltaPct > 0 ? '+' : '') + f.deltaPct + ' %'}</td><td class="sub">${esc(f.porque)}</td></tr>`).join('') : '';
  const fila = (p) => {
    const j = p.juicio;
    const cuerpo = p.clase === 'roto' ? `
      <div class="kv"><b>Defecto</b> ${esc(p.oraculo.defecto)}</div>
      <div class="kv"><b>Medido al fabricarla</b> <span class="mono">${esc(JSON.stringify(p.oraculo.medido))}</span></div>
      <div class="kv"><b>La app cargó</b> <span class="mono">${p.matricula ? esc(`${p.matricula.triangulos} triángulos · cerrada ${p.matricula.cerrada} (frontera ${p.matricula.frontera}, no-manifold ${p.matricula.noManifold}) · ${p.matricula.componentes} componente(s) · vol ${p.matricula.volConSigno} mm³ · caja ${p.matricula.caja.join('×')} mm`) : 'nada'}</span></div>
      <div class="kv"><b>Debe</b> ${esc(p.oraculo.debe)} <span class="sub">(${esc(p.oraculo.cita)})</span></div>
      <div class="kv"><b>Busca en pantalla</b> <span class="mono">/${esc(p.oraculo.dice || p.oraculo.noDice)}/i</span>${p.oraculo.noDice ? ' (NO debe aparecer)' : ''}${p.oraculo.sinMolde ? ' · y que NO se arme molde' : ''}${p.oraculo.sinPrecio ? ' · ni precio' : ''}</div>
      ${p.molde ? `<div class="kv"><b>Molde</b> estación ${p.molde.estacion}${p.molde.portamoldes ? ' · portamoldes completo' : ''} · ${p.molde.roles} roles · ${(p.molde.ms / 1000).toFixed(0)} s</div>` : ''}
      ${p.precio ? `<div class="kv"><b>Precio</b> ${p.precio.hay ? 'SÍ' : 'no'}${p.precio.cotizacion ? ' (cotización en el expediente)' : ''}${p.precio.visible ? ' · «' + esc(p.precio.visible) + '»' : ''}</div>` : ''}
      <div class="kv"><b>Veredicto</b> ${esc(j.porque)}</div>` : `
      <div class="kv"><b>La app cargó</b> <span class="mono">${p.matricula ? esc(`${p.matricula.triangulos} triángulos · cerrada ${p.matricula.cerrada} · ${p.matricula.componentes} componente(s) · vol ${p.matricula.volConSigno} mm³ · caja ${p.matricula.caja.join('×')} mm`) : 'nada'}</span></div>
      <div class="kv"><b>Kernel</b> <span class="mono">${p.huella && p.huella.pieza ? esc(`${p.huella.pieza.caras} caras · χ ${p.huella.pieza.euler} · V ${p.huella.pieza.volKernel} mm³`) : '—'}</span></div>
      <div class="kv"><b>¿Armó molde?</b> ${p.armoMolde ? `sí · ${p.huella ? p.huella.cuerpos.length : '?'} cuerpos · pines ${esc((p.pines || '').split(' ').filter(Boolean).length)}` : 'NO · ' + esc(p.rompe)}</div>
      <div class="kv"><b>Huella</b> <span class="mono">${esc((p.hash || '—').slice(0, 16))}</span> · acero <span class="mono">${esc((p.hashAcero || '—').slice(0, 16))}</span></div>
      <div class="kv"><b>Tiempos</b> <span class="mono">${esc(Object.entries(p.ms || {}).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)} s`).join(' · '))}</span> <span class="sub">(se anotan; los relojes no se juzgan en GPU compartida)</span></div>
      <div class="kv"><b>Veredicto</b> ${esc(j.porque)}</div>`;
    return `<section class="pieza ${j.cumple ? 'bien' : 'mal'}">
      <header><h3>${esc(p.id)}</h3>${p.clase === 'roto' ? `${pill('la app: ' + j.appDijo, j.appDijo === 'VERDE' ? 'v' : 'r')} ${pill('debía: ' + j.debia, j.debia === 'VERDE' ? 'v' : 'r')}` : ''} ${pill(j.cumple ? '✓ cumple' : '✗ no cumple', j.cumple ? 'ok' : 'no')}
        <span class="sub mono">${esc(p.archivo)} · sha256 ${esc((p.sha256 || '').slice(0, 12))}</span></header>
      <div class="grid"><div>${cuerpo}</div><div>${img(p.still)}${p.stillMolde ? img(p.stillMolde) : ''}</div></div></section>`;
  };
  const control = box.control ? `<p><strong>Par de control del gate de dorados</strong> — el JSON tal cual: ${pill(box.control.sano.veredicto, box.control.sano.veredicto === 'VERDE' ? 'ok' : 'no')} · una copia con <b>${esc(box.control.clave)}</b> ${esc(box.control.movido)}: ${pill(box.control.roto.veredicto, box.control.roto.veredicto === 'ROJO' ? 'ok' : 'no')} nombrando <b>${esc(box.control.roto.rojos.map((f) => f.k).join(', ') || 'nada')}</b> → ${box.control.ok ? 'el gate MUERDE' : 'el gate NO muerde'}</p>` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Acta del banco · ${esc(A.fecha.slice(0, 16))}</title>
<style>
:root{--fondo:#f4f1ea;--tinta:#1d2430;--sub:#5b6575;--linea:#d9d3c7;--verde:#1f7a46;--rojo:#b3261e;--ambar:#9a6400;--papel:#fffdf8}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--tinta);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1500px;margin:0 auto;padding:24px 16px 60px}h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:30px 0 10px}h3{font-size:17px;margin:0}
.mono{font-family:ui-monospace,"JetBrains Mono",Menlo,monospace;font-size:12.5px;overflow-wrap:anywhere}.sub{color:var(--sub);font-size:12.5px}
.veredicto{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:16px 0;padding:16px 18px;border-radius:10px;background:var(--papel);border:2px solid var(--linea)}
.veredicto .grande{font-size:24px;font-weight:800;letter-spacing:.02em}.veredicto.no{border-color:var(--rojo)}.veredicto.si{border-color:var(--verde)}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12.5px;font-weight:700;border:1px solid currentColor}
.pill.v,.pill.ok{color:var(--verde);background:#e5f3ea}.pill.r,.pill.no{color:var(--rojo);background:#fbe9e7}
table{width:100%;border-collapse:collapse;background:var(--papel);border:1px solid var(--linea);border-radius:8px;overflow:hidden}
th,td{text-align:left;padding:6px 9px;border-bottom:1px solid var(--linea);vertical-align:top}th{font-size:12.5px;color:var(--sub);font-weight:600}
td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}tr.malo td{background:#fbe9e7}
.pieza{background:var(--papel);border:1px solid var(--linea);border-left:6px solid var(--verde);border-radius:8px;padding:12px 14px;margin:12px 0}
.pieza.mal{border-left-color:var(--rojo)}.pieza header{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:14px}.grid img{width:100%;border-radius:6px;border:1px solid var(--linea);display:block;margin-bottom:6px}
.kv{margin:3px 0}.kv b{display:inline-block;min-width:150px;color:var(--sub);font-weight:600}.sinimg{padding:30px;text-align:center;color:var(--sub);border:1px dashed var(--linea)}
pre{background:var(--papel);border:1px solid var(--linea);border-radius:8px;padding:10px;overflow:auto;font-size:12.5px}
@media (max-width:900px){.grid{grid-template-columns:1fr}.kv b{min-width:0;display:block}}
</style></head><body><main>
<h1>Acta del banco en el navegador</h1>
<div class="sub">${esc(new Date(A.fecha).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }))} (CDMX) · ${esc(A.url)} · build ${esc(A.servido)} · ${esc(A.maquina)} · GPU ${esc(A.gpu)} · lista «${esc(A.lista)}» · ${(A.ms / 60000).toFixed(1)} min</div>
<div class="veredicto ${A.confiable && A.verde ? 'si' : 'no'}"><span class="grande">${A.confiable ? 'CONFIABLE' : 'NO CONFIABLE'} · ${A.verde ? 'VERDE' : 'ROJO'}</span><span>${esc(A.resumen)}</span></div>
<h2>1 · La huella de la 1594C Box ×${(box.corridas || []).length} (determinismo)</h2>
<p>${pill(box.huellaVeredicto, box.huellaVeredicto === 'VERDE' ? 'ok' : 'no')} Cada corrida en un navegador fresco, el camino completo en tiempo real hasta el portamoldes; la huella firma la pieza, cada cuerpo del molde (caja, triángulos y volumen con signo), la leyenda, el Foco y los números dorados.</p>
<table><tr><th>corrida</th><th>huella (todo)</th><th>huella del acero</th><th>cuerpos</th><th>tiempos reales</th><th>estado</th></tr>${huellaFilas}</table>
${box.diffs && box.diffs.length ? `<pre>${esc(box.diffs.map((d) => d.entre + ':\n  ' + d.cambios.slice(0, 40).join('\n  ')).join('\n'))}</pre>` : ''}
${box.controlHuella ? `<div class="grid"><div><p class="kv"><b>Par de control de la huella</b> — una corrida MÁS con la falla conocida del 2026-10-23 (el reloj virtual congelado antes de MOLDE: la E2 corre con la pieza maciza). Su huella <span class="mono">${esc((box.controlHuella.hash || '—').slice(0, 16))}</span> ${box.controlHuella.rompe ? '· ' + esc(box.controlHuella.rompe) : ''} → ${pill(box.controlHuella.muerde ? 'el gate MUERDE' : 'el gate NO muerde', box.controlHuella.muerde ? 'ok' : 'no')}</p>
<pre>${esc(box.controlHuella.cambios.slice(0, 30).join('\n'))}${box.controlHuella.cambios.length > 30 ? `\n… (${box.controlHuella.cambios.length} diferencias)` : ''}</pre></div><div>${img(box.controlHuella.still)}</div></div>` : ''}
<h2>2 · Los números dorados de la Box (±${box.dorados ? (100 * box.dorados.tol).toFixed(0) : 5} %)</h2>
${box.dorados ? `<p>${pill(box.dorados.veredicto, box.dorados.veredicto === 'VERDE' ? 'ok' : 'no')} contra <span class="mono">${esc(DORADOS_BOX)}</span> (grabado ${esc(box.doradoGrabado || '?')}).</p>
<table><tr><th></th><th>número</th><th>dorado</th><th>medido</th><th>Δ</th><th></th></tr>${dorFilas}</table>` : `<p>${pill('sin dorados', 'no')} ${esc(box.sinDorados || '')}</p>`}
${control}
<h2>3 · Pieza por pieza</h2>
<p class="sub">Piezas rotas: «la app» = qué hizo La Forja (VERDE = la dejó pasar, ROJO = la detuvo o preguntó); «debía» = su oráculo. Una pieza rota que la app pone en VERDE vuelve la corrida NO CONFIABLE.</p>
${A.piezas.map(fila).join('\n')}
<h2>4 · Para reproducir</h2>
<pre>${esc(A.comandos.join('\n'))}</pre>
</main></body></html>`;
}

/** la captura del acta (para juzgarla con los ojos sin abrir un navegador): página completa, imágenes ya cargadas */
async function capturaActa(dir) {
  try {
    const b = await H.lanza(); const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage(); await pg.goto('file://' + path.join(dir, 'acta.html'), { waitUntil: 'load' });
    await pg.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
    await pg.screenshot({ path: path.join(dir, 'acta.png'), fullPage: true, timeout: 30000 }); await b.close();
  } catch (e) { H.log('captura del acta falló: ' + String(e).slice(0, 120)); }
}

// ── el orquestador ───────────────────────────────────────────────────────────
if (require.main === module) (async () => {
  if (argv.includes('--uno')) {   // trabajador
    // una pieza, o un LOTE de piezas ligeras (los STL rotos: ~30 s cada uno) en UN turno del GPU — cada una en su navegador fresco
    const spec = JSON.parse(fs.readFileSync(arg('--uno'), 'utf8'));
    const r = Array.isArray(spec) ? [] : await uno(spec);
    if (Array.isArray(spec)) for (const sp of spec) { try { r.push(await uno(sp)); } catch (e) { r.push({ id: sp.id, clase: sp.clase, archivo: sp.archivo, rompe: 'el trabajador tronó: ' + String(e).slice(0, 200) }); } }
    fs.writeFileSync(arg('--sal'), JSON.stringify(r, null, 1));
    process.exit(0);
  }
  if (argv.includes('--rehacer-acta')) {   // vuelve a escribir acta.html + acta.png desde un acta.json (sin GPU para medir: solo la captura)
    const dir = path.resolve(arg('--rehacer-acta')); const A = JSON.parse(fs.readFileSync(path.join(dir, 'acta.json'), 'utf8')); A.out = dir;
    for (const p of A.piezas) if (p.clase === 'roto' && p.oraculo && p.aparecio !== undefined) p.juicio = juzgaRoto(p);   // el juicio con las palabras de HOY
    fs.writeFileSync(path.join(dir, 'acta.html'), actaHTML(A)); await capturaActa(dir); H.log(`acta rehecha: ${path.join(dir, 'acta.html')}`); process.exit(0);
  }
  const T0 = Date.now();
  const LISTA = arg('--lista', 'noche');
  const fecha = new Date().toISOString();
  const OUT = path.resolve(arg('--out', path.join('/home/ian/el-plan/qa', new Date().toLocaleDateString('sv-SE'))));   // fecha LOCAL (CDMX)
  const ROTOS = path.resolve(REPO, arg('--rotos', 'test-parts/rotos'));
  const N = +arg('--n', 3);
  for (const d of ['stills', 'corridas']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  const turno = !argv.includes('--sin-turno') && fs.existsSync(LOCK);
  const corre = (spec) => {
    const lote = Array.isArray(spec); const nombre = lote ? `lote-${spec[0].id}-x${spec.length}` : `${spec.id}-${spec.k || 1}`;
    const specP = path.join(OUT, 'corridas', `${nombre}.spec.json`), salP = specP.replace(/\.spec\.json$/, '.json');
    fs.writeFileSync(specP, JSON.stringify(spec, null, 1)); try { fs.unlinkSync(salP); } catch (e) {}
    const cmd = [...(turno ? ['flock', LOCK] : []), 'timeout', '1500', process.execPath, __filename, '--uno', specP, '--sal', salP];
    const t = Date.now();
    H.log(`▶ ${nombre}${turno ? ' (esperando el turno del GPU…)' : ''}`);
    const p = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env: { ...process.env, URL } });
    const falla = (x) => ({ id: x.id, clase: x.clase, archivo: x.archivo, k: x.k || 1, rompe: `el trabajador no dejó resultado (exit ${p.status})`, noVale: '' });
    const r = fs.existsSync(salP) ? JSON.parse(fs.readFileSync(salP, 'utf8')) : lote ? spec.map(falla) : falla(spec);
    for (const x of [].concat(r)) H.log(`◀ ${x.id}${x.k ? ' #' + x.k : ''} · ${((Date.now() - t) / 1000).toFixed(0)} s · ${x.hash ? x.hash.slice(0, 16) : ''} ${x.rompe || ''}${x.noVale ? ' NO VALE: ' + x.noVale : ''}`);
    return r;
  };
  // 1 · LA BOX ×N
  // la Box ×N (y su control) es UNA pieza: un solo turno del GPU (~2 min por corrida), cada corrida en su navegador fresco.
  // Medido 2026-10-24: con la cola llena, cada turno esperaba 15–40 min; pedir uno por corrida multiplicaba la espera ×4.
  const conControl = LISTA !== 'box' || argv.includes('--control');
  const specsBox = Array.from({ length: N }, (_, i) => ({ id: '1594C-Box', clase: 'box', archivo: BOX, k: i + 1, still: path.join(OUT, 'stills', `1594C-Box-${i + 1}.jpg`) }));
  if (conControl) specsBox.push({ id: '1594C-Box-control', clase: 'box', archivo: BOX, k: 1, reloj: 'congelado', still: path.join(OUT, 'stills', '1594C-Box-control.jpg') });
  const resBox = [].concat(corre(specsBox));
  const corridas = resBox.filter((r) => r.id === '1594C-Box');
  for (const r of resBox) fs.writeFileSync(path.join(OUT, 'corridas', `${r.id}-${r.k || 1}.json`), JSON.stringify(r, null, 1));   // una por corrida: `qa-dorados --medido` las lee
  const hashes = corridas.map((r) => r.hash || null);
  const box = { corridas, huellaVeredicto: corridas.some((r) => r.noVale) ? 'NO VALE' : hashes.every((h) => h && h === hashes[0]) && !corridas.some((r) => r.rompe) ? 'VERDE' : 'ROJO', diffs: [] };
  for (let k = 1; k < corridas.length; k++) if (corridas[0].huella && corridas[k].huella && hashes[k] !== hashes[0]) box.diffs.push({ entre: `1↔${k + 1}`, cambios: H.diffHuellas(corridas[0].huella, corridas[k].huella) });
  // el PAR DE CONTROL de la huella: una corrida con la falla conocida (reloj congelado antes de MOLDE) DEBE dar otra huella
  if (conControl) {
    const r = resBox.find((x) => x.id === '1594C-Box-control') || { rompe: 'el control no dejó resultado' };
    const sano = corridas.find((x) => x.huella);
    box.controlHuella = { hash: r.hash || null, rompe: r.rompe || '', still: r.still, noVale: r.noVale || '',
      muerde: !!(sano && ((r.hash && r.hash !== sano.hash) || /SOSPECHOSO/.test(r.rompe || ''))), cambios: sano && r.huella ? H.diffHuellas(sano.huella, r.huella) : [] };
  }
  const rutaDor = path.join(REPO, DORADOS_BOX);
  const med = corridas.find((r) => r.dorados);
  if (med && fs.existsSync(rutaDor)) {
    const dor = JSON.parse(fs.readFileSync(rutaDor, 'utf8'));
    box.dorados = D.compara(dor, med.dorados); box.doradoGrabado = `${dor.grabado && dor.grabado.commit} · ${dor.grabado && dor.grabado.fecha && new Date(dor.grabado.fecha).toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })}`;
    box.control = D.control(dor, med);
  } else box.sinDorados = !med ? 'ninguna corrida trajo números' : `no existe ${DORADOS_BOX} (grábalo con qa-dorados --regrabar)`;
  const piezas = [{ ...corridas[0], id: '1594C Box (sana · control)', clase: 'box', juicio: { cumple: box.huellaVeredicto === 'VERDE' && !!corridas[0].armoMolde && (!box.dorados || box.dorados.veredicto === 'VERDE'),
    porque: `${corridas[0].armoMolde ? 'armó molde' : 'NO armó molde: ' + corridas[0].rompe} · huella ×${N} ${box.huellaVeredicto} · dorados ${box.dorados ? box.dorados.veredicto : '—'}` } }];
  // 2 · LOS ROTOS
  if (LISTA !== 'box') {
    const oraculos = fs.existsSync(ROTOS) ? fs.readdirSync(ROTOS).filter((f) => f.endsWith('.oraculo.json')).sort() : [];
    if (!oraculos.length) H.log(`⚠ no hay oráculos en ${ROTOS} (fabrícalos: node --import tsx scripts/qa-fabrica-rotos.cjs)`);
    const specs = oraculos.map((f) => { const o = JSON.parse(fs.readFileSync(path.join(ROTOS, f), 'utf8'));
      return { id: o.id, clase: 'roto', archivo: path.relative(REPO, path.join(ROTOS, o.archivo)), oraculo: o, still: path.join(OUT, 'stills', `${o.id}.jpg`) }; });
    // los ligeros (solo se sueltan y se lee la puerta) van JUNTOS en un turno; los que intentan molde, uno por turno
    const ligeros = specs.filter((x) => !x.oraculo.sinMolde && !x.oraculo.sinPrecio), pesados = specs.filter((x) => x.oraculo.sinMolde || x.oraculo.sinPrecio);
    const res = [...(ligeros.length ? [].concat(corre(ligeros)) : []), ...pesados.map((x) => corre(x))];
    for (const sp of specs) {
      const o = sp.oraculo; const r = res.find((x) => x.id === o.id) || { id: o.id, clase: 'roto', archivo: sp.archivo, rompe: 'sin resultado' };
      if (r.sha256 && o.sha256 && r.sha256 !== o.sha256) r.nota = `OJO: el archivo no es el que el oráculo firmó (sha ${r.sha256.slice(0, 12)} ≠ ${o.sha256.slice(0, 12)})`;
      r.oraculo = o; r.juicio = r.aparecio === undefined && r.rompe ? { appDijo: '?', debia: o.esperado === 'pasa' ? 'VERDE' : 'ROJO', cumple: false, porque: r.rompe } : juzgaRoto(r);
      piezas.push(r);
    }
  }
  // 3 · HAMMOND (de noche)
  if (LISTA === 'noche') for (const a of HAMMOND) {
    const id = path.basename(a).replace(/\.(stp|step)$/i, '');
    const r = corre({ id, clase: 'hammond', archivo: a, still: path.join(OUT, 'stills', `${id.replace(/\s+/g, '-')}.jpg`) });
    r.juicio = { cumple: !!r.armoMolde && !r.noVale, porque: r.armoMolde ? `armó molde (${r.huella ? r.huella.cuerpos.length : '?'} cuerpos)` : `NO armó molde: ${r.rompe}` };
    piezas.push(r);
  }
  // ── veredicto ──
  const rotos = piezas.filter((p) => p.clase === 'roto' && p.oraculo && p.oraculo.esperado !== 'pasa');
  const pasaron = rotos.filter((p) => p.juicio.appDijo === 'VERDE');
  const sanaSTL = piezas.find((p) => p.clase === 'roto' && p.oraculo && p.oraculo.esperado === 'pasa');
  const noVale = piezas.concat(corridas).filter((p) => p.noVale);
  const confiable = LISTA === 'box' ? null : pasaron.length === 0 && (!sanaSTL || sanaSTL.juicio.cumple);
  const verde = piezas.every((p) => p.juicio.cumple) && noVale.length === 0 && (!box.controlHuella || box.controlHuella.muerde) && (!box.control || box.control.ok);
  // qué build se midió: COMMIT=<sha> manda. Sin él se lee temis-deploy.json del servidor — OJO: en las copias forja-devN `public/`
  // es un symlink al repo principal y ese archivo dice el commit de PRODUCCIÓN, no el de la copia (medido 2026-10-24: «6f70032»)
  let servido = process.env.COMMIT ? `${process.env.COMMIT} (COMMIT=)` : 'local';
  if (!process.env.COMMIT) try { servido = (JSON.parse(execSync(`curl -sS --max-time 5 ${JSON.stringify(URL.replace(/\/[^/]*$/, '') + '/temis-deploy.json')}`, { encoding: 'utf8' })).commit || '').slice(0, 7) || 'sin temis-deploy'; servido += ' (temis-deploy.json del servidor: pasa COMMIT=)'; } catch (e) {}
  const resumen = [
    noVale.length ? `NO VALE: ${noVale.map((p) => p.id + ' ' + p.noVale).join('; ')}` : '',
    `Box: huella ×${N} ${box.huellaVeredicto}${box.controlHuella ? ` (su control ${box.controlHuella.muerde ? 'muerde' : 'NO muerde'})` : ''}, dorados ${box.dorados ? box.dorados.veredicto : '—'}${box.dorados && box.dorados.rojos.length ? ' (' + box.dorados.rojos.map((f) => `${f.k} ${num(f.dorado)}→${num(f.medido)}`).join(', ') + ')' : ''}${box.control ? ` (su control ${box.control.ok ? 'muerde' : 'NO muerde'})` : ''}`,
    LISTA !== 'box' ? `${pasaron.length} de ${rotos.length} piezas rotas pasaron la puerta${pasaron.length ? ' (' + pasaron.map((p) => p.id).join(', ') + ')' : ''}${sanaSTL ? `; el control sano ${sanaSTL.juicio.cumple ? 'pasó' : 'NO pasó'}` : ''}` : 'solo la Box (sin rotos: la confiabilidad no se juzga)',
    confiable === false ? 'mientras una pieza rota pase, un verde de esta corrida no certifica nada' : '',
  ].filter(Boolean).join(' · ');
  const comandos = [
    `# en iangpu, desde la copia que sirve ${URL} (receta GPU; el banco toma el turno del GPU por pieza: no lo envuelvas en flock)`,
    `env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA NODE_PATH=/home/ian/Orkesta/la-forja/node_modules URL=${URL} node scripts/qa-banco.cjs --lista ${LISTA}${argv.includes('--rotos') ? ' --rotos ' + arg('--rotos') : ''}`,
    `node scripts/qa-dorados.cjs --medido ${path.join(OUT, 'corridas', '1594C-Box-1.json')}            # los dorados de esta corrida`,
    `node scripts/qa-dorados.cjs --medido ${path.join(OUT, 'corridas', '1594C-Box-1.json')} --regrabar "razón"   # re-grabar (solo con razón)`,
  ];
  const A = { fecha, url: URL, servido, maquina: process.env.MAQUINA || os.hostname(), gpu: (corridas[0] && corridas[0].gpu) || '?', lista: LISTA, out: OUT, ms: Date.now() - T0, confiable, verde, resumen, box, piezas, comandos };
  fs.writeFileSync(path.join(OUT, 'acta.json'), JSON.stringify(A, (k, v) => (k === 'texto' && typeof v === 'string' ? v.slice(0, 4000) : v), 1));
  fs.writeFileSync(path.join(OUT, 'acta.html'), actaHTML(A));
  await capturaActa(OUT);
  console.log(`\n${'─'.repeat(78)}\nBANCO: ${confiable === false ? 'NO CONFIABLE · ' : confiable ? 'CONFIABLE · ' : ''}${verde ? 'VERDE' : 'ROJO'} · ${resumen}\nacta: ${path.join(OUT, 'acta.html')}`);
  process.exit(noVale.length ? 2 : verde && confiable !== false ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });

module.exports = { juzgaRoto, matriculaEnPagina, actaHTML };
