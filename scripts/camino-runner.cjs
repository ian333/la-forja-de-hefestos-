#!/usr/bin/env node
/**
 * EL RUNNER DEL CAMINO (orden 2026-09-04-el-runner-del-camino)
 *
 * Recorre un camino (`caminos/<slug>.md`) contra una Forja VIVA con el arnés
 * forja-drive.cjs, mide en el DOM lo que cada paso promete ver, y reescribe los
 * estados del `## PASOS` con lo MEDIDO — no con lo que alguien recordaba.
 *
 *   URL=https://university.gaiaprime.com.mx/forja-brep.html \
 *   node scripts/camino-runner.cjs caminos/la-carcasa-de-mitsubishi.md [--out <dir>] [--evidencia <dir>] [--dry] [--no-escribir]
 *
 * El camino declara en `## RUNNER` una línea por paso:
 *   - n · <gestos: JSON array de acciones de forja-drive> · <check> · <check> …
 * y cada check es una de:
 *   testid:<id>[@<timeoutMs>][<=<maxMs>]   existe y es visible (opcional: en ≤ maxMs)
 *   count:<selector>>=<n>                  ≥ n elementos
 *   js:<expresión>                         truthy dentro de la página
 *
 * Estados (la misma regla para todos, sin excepciones a mano):
 *   ok        todos los checks del paso pasan
 *   parcial   pasa alguno, no todos
 *   falla     no pasa ninguno y NO hay un `falla` antes (es el primero que rompe)
 *   bloqueado no pasa ninguno y ya hubo un `falla` antes (depende de ese)
 *
 * Salida: <out>/meta.json + step_XX_*.png del arnés; <evidencia>/paso-<n>.png (una por paso);
 * el `.md` con los estados nuevos y una línea `- runner · …` en `## MEDIDO`; y corre
 * temis-tablero.cjs para que el tablero enseñe lo medido. NO despliega: eso es de la orden.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync, execSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const flag = (k) => argv.includes(k);
const CAMINO = argv.find((a) => a.endsWith('.md'));
if (!CAMINO) { console.error('uso: URL=<forja> node scripts/camino-runner.cjs caminos/<slug>.md [--out d] [--evidencia d] [--dry] [--no-escribir]'); process.exit(2); }
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const OUT = arg('--out') || path.join(os.tmpdir(), 'camino-runner', path.basename(CAMINO, '.md'));
const EVID = arg('--evidencia');
const MAQUINA = process.env.MAQUINA || os.hostname();   // los dos WSL de ian se llaman igual: MAQUINA=iangpu lo desambigua
const DRY = flag('--dry');
const ESCRIBIR = !flag('--no-escribir');

// ── leer el camino ────────────────────────────────────────────────────────────
const mdPath = path.resolve(REPO, CAMINO);
const md = fs.readFileSync(mdPath, 'utf8');
const seccion = (txt, nombre) => {
  const m = txt.match(new RegExp(`^## ${nombre}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return m ? m[1] : '';
};
const bullets = (s) => s.split('\n').filter((l) => /^\s*-\s+/.test(l)).map((l) => l.replace(/^\s*-\s+/, '').trim());
const pasos = bullets(seccion(md, 'PASOS')).map((l) => {
  const [n, gesto, seVe, estado, ticket] = l.split(' · ').map((x) => x.trim());
  return { n: +n, gesto, seVe, estado, ticket, linea: l };
}).filter((p) => p.n > 0);
const runnerLineas = bullets(seccion(md, 'RUNNER'));
if (!runnerLineas.length) { console.error(`${CAMINO}: no tiene sección ## RUNNER — sin ella no hay nada que medir`); process.exit(2); }

const parseCheck = (s, n, k) => {
  const label = `p${n}-${k}`;
  if (s.startsWith('testid:')) {
    const m = s.slice(7).match(/^([^@<]+)(?:@(\d+))?(?:<=(\d+))?$/);
    if (!m) throw new Error(`check ilegible en paso ${n}: ${s}`);
    return { type: 'expect', label, testid: m[1].trim(), timeout: m[2] ? +m[2] : 15000, ...(m[3] ? { maxMs: +m[3] } : {}), settle: 0, decl: s };
  }
  if (s.startsWith('count:')) {
    const m = s.slice(6).match(/^(.+?)>=(\d+)$/);
    if (!m) throw new Error(`check ilegible en paso ${n}: ${s}`);
    return { type: 'expect', label, selector: m[1].trim(), min: +m[2], timeout: 15000, settle: 0, decl: s };
  }
  if (s.startsWith('js:')) return { type: 'expect', label, js: s.slice(3).trim(), timeout: 15000, settle: 0, decl: s };
  throw new Error(`check desconocido en paso ${n}: ${s} (usa testid: | count: | js:)`);
};
const runner = runnerLineas.map((l) => {
  const partes = l.split(' · ').map((x) => x.trim());
  const n = +partes[0];
  let gestos = [];
  try { gestos = JSON.parse(partes[1] || '[]'); } catch (e) { throw new Error(`gestos ilegibles en paso ${n}: ${partes[1]}`); }
  const checks = partes.slice(2).filter(Boolean).map((c, k) => parseCheck(c, n, k + 1));
  return { n, gestos, checks };
});
for (const p of pasos) if (!runner.find((r) => r.n === p.n)) throw new Error(`el paso ${p.n} está en PASOS pero no en RUNNER`);

// ── armar las acciones del arnés (una lista, en orden) ────────────────────────
const actions = [];
const ultimaAccionDe = {};   // n → índice (1-based) de su última acción → step_XX
for (const p of pasos) {
  const r = runner.find((x) => x.n === p.n);
  for (const g of r.gestos) actions.push(g);
  for (const c of r.checks) actions.push(c);
  if (!r.gestos.length && !r.checks.length) actions.push({ type: 'move', x: 800, y: 500, settle: 200 });   // paso sin nada: al menos una captura
  ultimaAccionDe[p.n] = actions.length;
}
fs.mkdirSync(OUT, { recursive: true });
const actionsPath = path.join(OUT, 'actions.json');
fs.writeFileSync(actionsPath, JSON.stringify(actions, null, 1));
console.log(`CAMINO ${path.basename(CAMINO, '.md')} · ${pasos.length} pasos · ${actions.length} acciones · ${runner.reduce((a, r) => a + r.checks.length, 0)} checks`);
console.log(`URL ${URL}\nOUT ${OUT}`);
if (DRY) { console.log(JSON.stringify(actions, null, 1)); process.exit(0); }

// ── correr el arnés (mismo motor, cero copia) ─────────────────────────────────
const t0 = Date.now();
const r = spawnSync(process.execPath, [path.join(__dirname, 'forja-drive.cjs'), actionsPath, OUT], {
  stdio: 'inherit', env: { ...process.env, URL, TURNTABLE: '0' }, timeout: 15 * 60 * 1000,
});
const dur = ((Date.now() - t0) / 1000).toFixed(0);
const metaPath = path.join(OUT, 'meta.json');
if (!fs.existsSync(metaPath)) { console.error(`el arnés no dejó meta.json (exit ${r.status}) — no hay medición`); process.exit(1); }
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
if (meta.fatal) console.error(`ARNÉS FATAL: ${meta.fatal.slice(0, 300)}`);
const porLabel = Object.fromEntries((meta.checks || []).map((c) => [c.label, c]));

// ── veredictos por paso ───────────────────────────────────────────────────────
let huboFalla = false;
const resultado = pasos.map((p) => {
  const rr = runner.find((x) => x.n === p.n);
  const checks = rr.checks.map((c) => porLabel[c.label] || { label: c.label, ok: false, ms: 0, detail: 'sin medir (el arnés no llegó)' });
  const okN = checks.filter((c) => c.ok).length;
  let estado;
  if (checks.length && okN === checks.length) estado = 'ok';
  else if (okN > 0) estado = 'parcial';
  else estado = huboFalla ? 'bloqueado' : 'falla';
  if (estado === 'falla') huboFalla = true;
  return { ...p, estadoMedido: estado, checks, okN };
});

// ── capturas: una por paso ────────────────────────────────────────────────────
const shotDe = (n) => {
  const idx = ultimaAccionDe[n];
  const f = fs.readdirSync(OUT).find((x) => x.startsWith(`step_${String(idx).padStart(2, '0')}_`) && x.endsWith('.png'));
  return f ? path.join(OUT, f) : null;
};
if (EVID) {
  fs.mkdirSync(EVID, { recursive: true });
  for (const p of resultado) { const s = shotDe(p.n); if (s) fs.copyFileSync(s, path.join(EVID, `paso-${p.n}.png`)); }
}

// ── qué commit sirve la Forja medida ──────────────────────────────────────────
let servido = '';
try {
  const base = URL.replace(/\/[^/]*$/, '');
  const j = execSync(`curl -sS --max-time 10 ${JSON.stringify(base + '/temis-deploy.json')}`, { encoding: 'utf8' });
  servido = (JSON.parse(j).commit || '').slice(0, 7);
} catch (e) { try { servido = 'local ' + execSync('git rev-parse --short HEAD', { cwd: REPO, encoding: 'utf8' }).trim(); } catch (e2) {} }

// ── reporte ───────────────────────────────────────────────────────────────────
const verdes = resultado.filter((p) => p.estadoMedido === 'ok').length;
const rompe = resultado.find((p) => p.estadoMedido === 'falla');
console.log(`\n${'─'.repeat(78)}\nMEDIDO · ${verdes}/${resultado.length} ok${rompe ? ` · se rompe en el paso ${rompe.n}` : ''} · ${dur} s · servido ${servido || '?'} · ${MAQUINA}`);
for (const p of resultado) {
  const cambio = p.estado !== p.estadoMedido ? `  (decía ${p.estado})` : '';
  console.log(`  ${p.n} · ${p.gesto.padEnd(34).slice(0, 34)} · ${p.estadoMedido.toUpperCase().padEnd(9)}${cambio}`);
  for (const c of p.checks) console.log(`      ${c.ok ? '✓' : '✗'} ${c.label} ${c.ms} ms ${c.detail || ''}`);
}
if (meta.errors && meta.errors.length) console.log(`  errores de consola/arnés: ${meta.errors.length}\n    ` + meta.errors.slice(0, 6).join('\n    '));

// ── reescribir el camino: SOLO la columna estado + ## MEDIDO ──────────────────
if (ESCRIBIR) {
  let nuevo = md;
  for (const p of resultado) {
    const partes = p.linea.split(' · ');
    partes[3] = p.estadoMedido;
    nuevo = nuevo.replace(`- ${p.linea}`, `- ${partes.join(' · ')}`);
  }
  const fecha = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const lineaMedido = `- runner · ${fecha} UTC · ${URL} · servido ${servido || '?'} · ${MAQUINA} · ${verdes}/${resultado.length} ok${rompe ? ` · se rompe en el paso ${rompe.n}` : ''} · ${resultado.map((p) => `${p.n}:${p.okN}/${p.checks.length}`).join(' ')}`;
  if (/^## MEDIDO/m.test(nuevo)) {
    const sec = seccion(nuevo, 'MEDIDO');
    const sinRunner = sec.split('\n').filter((l) => !/^\s*-\s+runner ·/.test(l)).join('\n').replace(/\s+$/, '');
    nuevo = nuevo.replace(sec, `${sinRunner}\n${lineaMedido}\n`);
  } else nuevo += `\n## MEDIDO\n${lineaMedido}\n`;
  fs.writeFileSync(mdPath, nuevo);
  console.log(`\n→ ${CAMINO} reescrito (estados + MEDIDO)`);
  const t = spawnSync(process.execPath, [path.join(__dirname, 'temis-tablero.cjs')], { cwd: REPO, encoding: 'utf8' });
  console.log((t.stdout || '').split('\n').filter((l) => /CAMINO|TEMIS ·/.test(l)).join('\n'));
}
process.exit(meta.fatal ? 1 : 0);
