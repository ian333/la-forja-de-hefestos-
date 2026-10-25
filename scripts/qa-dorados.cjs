#!/usr/bin/env node
/**
 * LOS NÚMEROS DORADOS (orden 2026-10-24-d-el-qa-real, punto 2)
 * ============================================================================
 * Los números de INGENIERÍA de la 1594C Box (clamp, placa de soporte, pilares, flecha, F de expulsión, t_c, pines, tramos de
 * agua, la holgura agua↔barreno del Foco, apertura y carrera…) leídos del MOTOR en la app real (no del rótulo: la orden A apaga
 * rótulos, el número sigue), contra los grabados en `scripts/qa-dorados/<pieza>.json`, con ±5 % (fea-placas, juez C D4).
 * Si un número se mueve, el gate dice CUÁL, de cuánto a cuánto, y sale ROJO. Re-grabar exige `--regrabar "razón"`: la razón,
 * la fecha, el commit y qué cambió quedan en la `historia` del JSON. (Al fusionar la orden B el clamp DEBE salir rojo — esa es
 * la prueba de que el gate muerde; el coordinador re-graba con la razón.)
 *
 * uso:
 *   node scripts/qa-dorados.cjs --medido <corrida-k.json | carpeta de qa-huella> [--dorados scripts/qa-dorados/1594C-Box.json]
 *   node scripts/qa-dorados.cjs [--dorados …]                      (sin --medido: corre UNA corrida en la app de URL=…, receta GPU)
 *   node scripts/qa-dorados.cjs --medido <…> --regrabar "razón"   (reescribe el JSON con lo medido; sin razón no graba)
 *   node scripts/qa-dorados.cjs --medido <…> --control             (PAR DE CONTROL: el JSON tal cual debe salir VERDE y una
 *                                                                    copia con UN número movido +10 % debe salir ROJO nombrándolo)
 *   COMMIT=<sha corto> lo anota al grabar (en iangpu las copias forja-devN no son repo de git).
 * exit: 0 VERDE · 1 ROJO · 2 no se pudo medir / uso
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const TOL = 0.05;

/** qué es cada número, en palabras de taller, y de qué parte del libro sale (lo que el JSON guarda al grabar por primera vez) */
const QUE = {
  clampT: { unidad: 't', que: 'fuerza de cierre que pide la pieza', cita: 'Kazmer §5.5.3 Eq 5.29 — hoy con la presión de LLENADO, sin el piso de 50 MPa (la orden B la cambia: ≈ 36 t)' },
  clampPct: { unidad: '%', que: 'cierre usado de la inyectora (la hoja: «clamp N % de T t»)', cita: 'Kazmer §4.3.3' },
  maquinaT: { unidad: 't', que: 'la inyectora elegida (la del taller, FCS HT-150SV)', cita: 'Kazmer §4.3.3' },
  nCav: { unidad: '', que: 'cavidades recomendadas', cita: 'Kazmer §3.4' },
  soporteMm: { unidad: 'mm', que: 'espesor de la placa de soporte', cita: 'Kazmer §12.1.2 (δ ≤ venteo)' },
  nPilares: { unidad: '', que: 'pilares bajo la placa de soporte', cita: 'Kazmer §12.1.2' },
  flechaMm: { unidad: 'mm', que: 'cuánto se dobla la placa de soporte con ese cierre', cita: 'Kazmer §12.1.2 Eq 12.10' },
  fExpulsionN: { unidad: 'N', que: 'fuerza para despegar la pieza del macho', cita: 'Kazmer §11.2.2' },
  tcPlacaMaxS: { unidad: 's', que: 't_c de PLACA en el punto más lento (el «134 s» del paso 3)', cita: 'Kazmer §9.2 Eq 9.5 — juez C D1: en un poste es una ventana 65–136 s; la barra (Eq 9.6) del poste aún no existe' },
  tcPiezaS: { unidad: 's', que: 't_c de la pared nominal (estación 8)', cita: 'Kazmer §9.2 Eq 9.5' },
  tcBebederoS: { unidad: 's', que: 't_c del bebedero (barra) — el que manda el ciclo en la estación 8', cita: 'Kazmer §9.2 Eq 9.6' },
  nPines: { unidad: '', que: 'botadores colocados por agarre', cita: 'Kazmer §11.2.5' },
  nTramosAgua: { unidad: '', que: 'tramos del circuito de agua', cita: 'Kazmer §9.2.4–9.2.7' },
  holguraAguaMinMm: { unidad: 'mm', que: 'acero mínimo entre el agua y un barreno (el «de panzazo» del Foco)', cita: 'Kazmer §9.2.7 (½·⌀ = 3.17 mm para ⌀6.35)' },
  aperturaMm: { unidad: 'mm', que: 'carrera de apertura del molde en la máquina', cita: 'Kazmer §4.3.3 (daylight)' },
  carreraPedidaMm: { unidad: 'mm', que: 'carrera de expulsión que pide la pieza', cita: 'estación 8 de tu pieza (portamoldes)' },
  carreraLibreMm: { unidad: 'mm', que: 'carrera que cabe en la caja expulsora', cita: 'estación 8 de tu pieza (portamoldes)' },
  dictamenViola: { unidad: '', que: 'contratos que VIOLAN en el dictamen (el 04)', cita: 'Kazmer §13 (los 69 contratos)' },
};

/** compara dorado ↔ medido. Devuelve filas por número y el veredicto. Un número sin medir es ROJO (la fuente se perdió). */
function compara(dorados, medidos, tol = dorados.tolerancia ?? TOL) {
  const filas = [];
  for (const [k, g] of Object.entries(dorados.numeros || {})) {
    const m = medidos && medidos[k] ? medidos[k].v : null;
    const gv = g.v;
    let ok, delta = null, porque = '';
    if (gv == null && m == null) { ok = true; porque = 'sin dato en ambos'; }
    else if (m == null) { ok = false; porque = `no se encontró en la app (fuente: ${(medidos && medidos[k] && medidos[k].fuente) || g.fuente || '?'})`; }
    else if (gv == null) { ok = false; porque = 'apareció un número que el dorado no tenía: re-graba con su razón'; }
    else if (typeof gv !== 'number' || typeof m !== 'number') { ok = gv === m; porque = ok ? '' : 'distinto'; }
    else if (gv === 0) { ok = Math.abs(m) < 1e-9; delta = ok ? 0 : Infinity; }
    else { delta = (m - gv) / Math.abs(gv); ok = Math.abs(delta) <= tol + 1e-12; }
    filas.push({ k, dorado: gv, medido: m, deltaPct: delta == null ? null : +(100 * delta).toFixed(2), ok, porque, unidad: g.unidad, que: g.que, cita: g.cita });
  }
  const nuevos = Object.keys(medidos || {}).filter((k) => !(k in (dorados.numeros || {})));
  const rojos = filas.filter((f) => !f.ok);
  return { veredicto: rojos.length ? 'ROJO' : 'VERDE', filas, rojos, nuevos, tol };
}
const fmt = (v) => (v == null ? '—' : typeof v === 'number' ? String(+v.toPrecision(6)) : String(v));
function imprime(res, titulo) {
  console.log(`${titulo} · ±${(100 * res.tol).toFixed(0)} %`);
  for (const f of res.filas) {
    const d = f.deltaPct == null ? '' : ` (${f.deltaPct > 0 ? '+' : ''}${f.deltaPct} %)`;
    console.log(`  ${f.ok ? '✓' : '✗'} ${f.k.padEnd(18)} dorado ${fmt(f.dorado).padStart(10)} ${f.unidad.padEnd(3)} · medido ${fmt(f.medido).padStart(10)}${d}${f.porque ? ' · ' + f.porque : ''}`);
  }
  if (res.nuevos.length) console.log(`  (medidos sin dorado, no juzgan: ${res.nuevos.join(', ')})`);
  console.log(`DORADOS_GATE: ${res.veredicto}${res.rojos.length ? ' · se movió: ' + res.rojos.map((f) => `${f.k} ${fmt(f.dorado)} → ${fmt(f.medido)}`).join(' · ') : ''}`);
}
/** lee lo medido: un corrida-k.json de qa-huella, o la carpeta (toma la primera corrida con dorados) */
function leeMedido(p) {
  const abs = path.resolve(p);
  if (fs.statSync(abs).isDirectory()) {
    // la carpeta de qa-huella (corrida-k.json) o la de corridas del banco (1594C-Box-k.json, lotes): la primera corrida SANA con números
    const fs_ = fs.readdirSync(abs).filter((f) => f.endsWith('.json') && !f.endsWith('.spec.json') && !/control/.test(f)).sort();
    for (const f of fs_) {
      const j = JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8'));
      const r = [].concat(j).find((x) => x && x.dorados && x.reloj !== 'congelado');
      if (r) return { ...r, _de: path.join(abs, f) };
    }
    throw new Error(`${p}: ninguna corrida con dorados`);
  }
  const j = JSON.parse(fs.readFileSync(abs, 'utf8'));
  // un lote del banco (arreglo de corridas): la primera de la pieza con números
  if (Array.isArray(j)) { const r = j.find((x) => x && x.dorados && x.reloj !== 'congelado'); if (!r) throw new Error(`${p}: ningún elemento con dorados`); return { ...r, _de: abs }; }
  return { ...j, _de: abs };
}
const commitDe = () => process.env.COMMIT || (() => { try { return execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return 'desconocido'; } })();
/** graba (o re-graba) el JSON con lo medido; la razón es obligatoria y queda en la historia */
function graba(rutaDorados, med, razon) {
  if (!razon || razon.trim().length < 8) throw new Error('re-grabar exige --regrabar "razón" (≥ 8 caracteres): qué cambió y por qué');
  const viejo = fs.existsSync(rutaDorados) ? JSON.parse(fs.readFileSync(rutaDorados, 'utf8')) : null;
  const numeros = {}; const cambios = [];
  for (const [k, o] of Object.entries(med.dorados)) {
    const g = (viejo && viejo.numeros && viejo.numeros[k]) || {};
    const q = QUE[k] || {};
    numeros[k] = { v: o.v, unidad: g.unidad ?? q.unidad ?? '', que: g.que ?? q.que ?? k, cita: g.cita ?? q.cita ?? 'sin cita: número del motor', fuente: o.fuente };
    if (viejo && (!viejo.numeros[k] || viejo.numeros[k].v !== o.v)) cambios.push(`${k} ${fmt(viejo.numeros[k] && viejo.numeros[k].v)} → ${fmt(o.v)}`);
  }
  if (viejo) for (const k of Object.keys(viejo.numeros || {})) if (!(k in numeros)) cambios.push(`${k} ${fmt(viejo.numeros[k].v)} → (ya no se mide)`);
  const grabado = { fecha: new Date().toISOString(), commit: commitDe(), url: med.url, maquina: os.hostname(), huella: med.hash || null, hashAcero: med.hashAcero || null, de: med._de, razon };
  const nuevo = { pieza: med.archivo, tolerancia: viejo ? viejo.tolerancia ?? TOL : TOL,
    nota: 'Números del MOTOR de la app real (build del navegador) para esta pieza. Se juzgan con qa-dorados.cjs; re-grabar SOLO con --regrabar "razón".',
    grabado, numeros, historia: [...((viejo && viejo.historia) || []), { fecha: grabado.fecha, commit: grabado.commit, razon, cambios: viejo ? cambios : ['primera grabación'] }] };
  fs.mkdirSync(path.dirname(rutaDorados), { recursive: true });
  fs.writeFileSync(rutaDorados, JSON.stringify(nuevo, null, 1) + '\n');
  return { cambios: viejo ? cambios : ['primera grabación'], nuevo };
}
/** el par de control del propio gate: sano → VERDE; una copia con un número movido +10 % → ROJO diciendo cuál */
function control(dorados, med, clave) {
  const sano = compara(dorados, med.dorados);
  const k = clave || Object.keys(dorados.numeros).find((x) => typeof dorados.numeros[x].v === 'number' && dorados.numeros[x].v !== 0);
  const roto = JSON.parse(JSON.stringify(dorados)); roto.numeros[k].v = +(roto.numeros[k].v * 1.10).toPrecision(6);
  const r = compara(roto, med.dorados);
  const muerde = r.veredicto === 'ROJO' && r.rojos.length === 1 && r.rojos[0].k === k;
  return { sano, roto: r, clave: k, movido: `${fmt(dorados.numeros[k].v)} → ${fmt(roto.numeros[k].v)}`, ok: sano.veredicto === 'VERDE' && muerde };
}

module.exports = { compara, graba, control, leeMedido, QUE, TOL };

if (require.main === module) (async () => {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const RUTA = path.resolve(REPO, arg('--dorados', 'scripts/qa-dorados/1594C-Box.json'));
  let med;
  if (argv.includes('--medido')) med = leeMedido(arg('--medido'));
  else {
    // sin --medido: UNA corrida en la app (mismo camino que la huella)
    const H = require('./qa-huella.cjs');
    const URL = process.env.URL || 'http://localhost:4270/forja-brep.html';
    const pieza = path.resolve(REPO, arg('--pieza', 'test-parts/inyeccion-reales/1594C Box.stp'));
    const b = await H.lanza(); try { med = await H.corrida(b, URL, pieza); } finally { await b.close().catch(() => {}); }
    med._de = `${URL} (corrida en vivo)`;
    if (med.noVale) { console.error(`la corrida NO VALE: ${med.noVale}`); process.exit(2); }
  }
  if (!med.dorados) { console.error(`sin dorados medidos en ${med._de}${med.rompe ? ' · ' + med.rompe : ''}`); process.exit(2); }
  if (argv.includes('--regrabar')) {
    const { cambios } = graba(RUTA, med, arg('--regrabar', ''));
    console.log(`DORADOS GRABADOS en ${path.relative(REPO, RUTA)} · ${cambios.length} cambio(s): ${cambios.join(' · ') || 'ninguno'}`);
    process.exit(0);
  }
  if (!fs.existsSync(RUTA)) { console.error(`no existe ${RUTA}: grábalo con --regrabar "razón"`); process.exit(2); }
  const dorados = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
  if (argv.includes('--control')) {
    const c = control(dorados, med, arg('--clave', null));
    imprime(c.sano, `CONTROL SANO (${path.basename(RUTA)} tal cual)`);
    imprime(c.roto, `CONTROL ROTO (copia con ${c.clave} ${c.movido})`);
    console.log(`PAR_DE_CONTROL: ${c.ok ? 'MUERDE' : 'NO MUERDE'} · sano ${c.sano.veredicto} · roto ${c.roto.veredicto} nombrando ${c.roto.rojos.map((f) => f.k).join(',') || 'nada'}`);
    process.exit(c.ok ? 0 : 1);
  }
  const res = compara(dorados, med.dorados);
  imprime(res, `DORADOS ${path.basename(RUTA)} (grabado ${dorados.grabado && dorados.grabado.commit}) vs ${med._de}`);
  process.exit(res.veredicto === 'VERDE' ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message || e); process.exit(2); });
