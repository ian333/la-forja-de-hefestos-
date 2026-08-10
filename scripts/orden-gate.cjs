#!/usr/bin/env node
/**
 * ORDEN-GATE — el juez MECÁNICO del trabajo hecho sin ian presente.
 * ============================================================================
 * Nació del 2026-08-07: construí 4 pantallas nuevas (6,880 líneas) cuando el CAD
 * ya tenía TODO (ForgeBRepStudio, bag `mold`, MoldPanels) — y mis propios gates
 * dijeron 40/40 PASA, porque medían la coherencia interna de la cosa nueva, no
 * su derecho a existir. La lección: a la hora de juzgar, el juez soy yo y ya me
 * convencí. Este gate NO razona — por eso no se le puede convencer.
 *
 * Qué hace:
 *   1. Lee la orden más reciente de `ordenes/` (o la de --orden). La orden
 *      declara BASE (commit), TOCA/CREA/BORRA (rutas) y PREEXISTENTE (mugre
 *      previa que se ignora).
 *   2. `git diff --name-status BASE` + untracked → cada archivo cambiado tiene
 *      que estar amparado: A→CREA, D→BORRA, M→TOCA. Uno fuera de lista = ROJO.
 *   3. CENSO anti-duplicación: archivos con <Canvas bajo src/forja, entradas
 *      rollup de vite.config.ts, *.html en la raíz. Si un contador SUBE contra
 *      BASE y la orden no trae `CENSO-PERMITE: <canvas|vite|html> +N` = ROJO.
 *
 * Uso:  node scripts/orden-gate.cjs [--orden ordenes/X.md] [--base <ref>]
 * Salida: tabla + `ORDEN_GATE: VERDE|ROJO` · exit 0/1.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const sh = (cmd) => execSync(cmd, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// rutas que NUNCA necesitan declaración (la orden misma y la evidencia visual)
const EXENTAS = [/^ordenes\//, /^forja-shots\//];

// ── argumentos ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

// ── 1. localizar y parsear la orden ──────────────────────────────────────────
let ordenPath = arg('--orden');
if (!ordenPath) {
  const dir = path.join(REPO, 'ordenes');
  // la VIGENTE es la de mtime más nuevo — el sort alfabético eligió la orden
  // equivocada cuando hubo dos del mismo día (cazado 2026-08-10: juzgó contra
  // la de la limpieza mientras corría la del dado).
  const md = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'PLANTILLA.md') : [];
  if (!md.length) { console.log('ORDEN_GATE: ROJO — no hay ninguna orden en ordenes/ (copia PLANTILLA.md)'); process.exit(1); }
  md.sort((a, b) => fs.statSync(path.join(dir, a)).mtimeMs - fs.statSync(path.join(dir, b)).mtimeMs);
  ordenPath = path.join('ordenes', md[md.length - 1]);
}
const texto = fs.readFileSync(path.join(REPO, ordenPath), 'utf8');

function seccion(nombre) {
  // captura las líneas `- ruta` bajo `## nombre` hasta el siguiente encabezado
  const re = new RegExp(`^## ${nombre}[^\\n]*\\n([\\s\\S]*?)(?=^## |\\n# |$(?![\\s\\S]))`, 'm');
  const m = texto.match(re);
  if (!m) return [];
  return m[1].split('\n')
    .map((l) => l.trim()).filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim())
    .filter((l) => l && l !== '(nada)' && !l.startsWith('<'));
}
const TOCA = new Set(seccion('TOCA'));
const CREA = new Set(seccion('CREA'));
const BORRA = new Set(seccion('BORRA'));
const PREV = new Set(seccion('PREEXISTENTE'));
const base = arg('--base') ?? (texto.match(/^BASE:\s*([0-9a-f]{7,40})/m) || [])[1];
if (!base) { console.log(`ORDEN_GATE: ROJO — la orden ${ordenPath} no declara BASE: <commit>`); process.exit(1); }

// permisos explícitos de censo: `CENSO-PERMITE: canvas +1`
const permisos = {};
for (const m of texto.matchAll(/^CENSO-PERMITE:\s*(canvas|vite|html)\s*\+(\d+)/gm)) permisos[m[1]] = +m[2];

console.log(`orden: ${ordenPath}`);
console.log(`base:  ${base}`);

// ── 2. diff real contra la orden ─────────────────────────────────────────────
const cambios = []; // {estado: A|M|D, ruta}
for (const linea of sh(`git diff --name-status ${base}`).split('\n')) {
  if (!linea.trim()) continue;
  const p = linea.split('\t');
  const st = p[0][0];
  if (st === 'R' || st === 'C') { cambios.push({ estado: 'D', ruta: p[1] }, { estado: 'A', ruta: p[2] }); }
  else cambios.push({ estado: st, ruta: p[1] });
}
for (const ruta of sh('git ls-files --others --exclude-standard').split('\n').filter(Boolean)) {
  cambios.push({ estado: 'A', ruta });
}

let rojos = 0;
const juzga = (c) => {
  // PREEXISTENTE acepta PREFIJOS ('public/atrio/'): otra sesión en paralelo puede
  // seguir creando archivos ahí y la lista exacta sería un blanco móvil.
  const prev = PREV.has(c.ruta) || [...PREV].some((p2) => p2.endsWith('/') && c.ruta.startsWith(p2));
  if (EXENTAS.some((re) => re.test(c.ruta)) || prev) return null;
  if (c.estado === 'A') return CREA.has(c.ruta) ? null : `CREADO sin declarar en CREA: ${c.ruta}`;
  if (c.estado === 'D') return BORRA.has(c.ruta) ? null : `BORRADO sin declarar en BORRA: ${c.ruta}`;
  return (TOCA.has(c.ruta) || BORRA.has(c.ruta)) ? null : `MODIFICADO sin declarar en TOCA: ${c.ruta}`;
};
console.log(`\n── DIFF vs ORDEN (${cambios.length} cambios)`);
for (const c of cambios) {
  const falla = juzga(c);
  if (falla) { rojos++; console.log(`  ✘ ${falla}`); }
}
if (!rojos) console.log('  ✔ todo cambio está amparado por la orden');
// lo declarado que NO pasó también se reporta (orden dice BORRA y sigue vivo)
for (const r of BORRA) if (!cambios.some((c) => c.estado === 'D' && c.ruta === r)) console.log(`  ⚠ declarado en BORRA y sigue vivo: ${r}`);
for (const r of CREA) if (!cambios.some((c) => c.estado === 'A' && c.ruta === r)) console.log(`  ⚠ declarado en CREA y no se creó: ${r}`);

// ── 3. CENSO anti-duplicación ────────────────────────────────────────────────
function censoBase() {
  const canvas = sh(`git grep -l '<Canvas' ${base} -- 'src/forja/**/*.tsx' || true`).split('\n').filter(Boolean).length;
  const vite = ((sh(`git show ${base}:vite.config.ts`)).match(/resolve\(import\.meta\.dirname, "[^"]+\.html"\)/g) || []).length;
  const html = sh(`git ls-tree --name-only ${base}`).split('\n').filter((f) => f.endsWith('.html')).length;
  return { canvas, vite, html };
}
function censoAhora() {
  const canvas = sh(`grep -rl '<Canvas' src/forja --include='*.tsx' || true`).split('\n').filter(Boolean).length;
  const vite = (fs.readFileSync(path.join(REPO, 'vite.config.ts'), 'utf8').match(/resolve\(import\.meta\.dirname, "[^"]+\.html"\)/g) || []).length;
  const html = fs.readdirSync(REPO).filter((f) => f.endsWith('.html')).length;
  return { canvas, vite, html };
}
const b = censoBase(), a = censoAhora();
console.log('\n── CENSO (si sube sin CENSO-PERMITE = deuda = ROJO)');
for (const k of ['canvas', 'vite', 'html']) {
  const delta = a[k] - b[k];
  const tope = permisos[k] ?? 0;
  const mal = delta > tope;
  if (mal) rojos++;
  const nombre = { canvas: 'archivos con <Canvas en src/forja', vite: 'entradas rollup en vite.config.ts', html: '*.html en la raíz' }[k];
  console.log(`  ${mal ? '✘' : '✔'} ${nombre}: ${b[k]} → ${a[k]} (${delta >= 0 ? '+' : ''}${delta}${tope ? `, permitido +${tope}` : ''})`);
}

console.log(`\nORDEN_GATE: ${rojos ? `ROJO — ${rojos} violación(es)` : 'VERDE'}`);
process.exit(rojos ? 1 : 0);
