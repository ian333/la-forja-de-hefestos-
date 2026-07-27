/**
 * GATE ANTI-CICLOS DE IMPORTS — la bomba que revienta el bundle SIN avisar.
 * ============================================================================
 * 2026-07-16, en producción: `ReferenceError: Cannot access 'kn' before initialization`.
 * El CAD entero, muerto. Causa: un ciclo
 *
 *      mold-plano-set.ts → mold-interlocks.ts → mold-plano-set.ts
 *
 * Lo peor: el ciclo llevaba días ahí y NO reventaba. El bundler evaluaba los módulos en
 * un orden que, por suerte, tocaba primero al que hacía falta. Un import nuevo (nada que
 * ver con el molde) cambió ese orden y la TDZ explotó. O sea: no era un bug latente
 * inofensivo — era una MINA, y cualquiera podía pisarla desde cualquier archivo.
 *
 * Por qué esto es un gate y no un comentario:
 *  · TypeScript NO se queja de los ciclos (los tipos se borran, los valores no).
 *  · `vite dev` tampoco: sirve módulos ESM sueltos y el ciclo se resuelve perezoso.
 *  · Solo truena en el BUNDLE de producción, y no siempre. Es el peor tipo de bug:
 *    invisible hasta que le pega al usuario.
 *
 * La regla de arquitectura que lo evita: las capas van en UN sentido.
 *    referencia/geometría (mold-drawing-set, moldbase, threeplate)
 *      ← estudios (mold-interlocks, mold-fasteners, filling)
 *        ← construcción de mallas (mold-plano-set)
 *          ← UI (ForgeBRepStudio)
 * Si un archivo de abajo necesita algo de arriba, lo que hay que mover es LA FUNCIÓN a su
 * capa, no meter un import de vuelta.
 *
 * Uso: node scripts/import-cycles-test.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN = ['src'];

const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f)) files.push(p);
  }
};
for (const s of SCAN) walk(path.join(ROOT, s));

// grafo de imports RELATIVOS (los de node_modules no hacen ciclos con nuestro código).
// `import type` NO cuenta: TypeScript lo borra al compilar, así que no crea dependencia
// en runtime y por tanto no puede causar TDZ.
const imports = {};
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const deps = [];
  for (const m of src.matchAll(/(?:^|\n)\s*import\s+([^;]*?)\s+from\s+'(\.[^']+)'/g)) {
    if (/^type\s/.test(m[1].trim())) continue;                  // import type → se borra
    const target = path.resolve(path.dirname(f), m[2]);
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
      if (fs.existsSync(target + ext)) { deps.push(target + ext); break; }
    }
  }
  imports[f] = deps;
}

const rel = (p) => path.relative(ROOT, p);
const color = {}, ciclos = [];
const dfs = (n, stack) => {
  if (color[n] === 1) { ciclos.push(stack.slice(stack.indexOf(n)).concat(n)); return; }
  if (color[n] === 2) return;
  color[n] = 1; stack.push(n);
  for (const d of imports[n] || []) dfs(d, stack);
  stack.pop(); color[n] = 2;
};
for (const f of Object.keys(imports)) dfs(f, []);

const vistos = new Set(), unicos = [];
for (const c of ciclos) {
  const k = [...c].sort().join('|');
  if (vistos.has(k)) continue;
  vistos.add(k); unicos.push(c);
}

console.log(`\n${files.length} archivos · ${Object.values(imports).reduce((a, b) => a + b.length, 0)} imports relativos`);
if (unicos.length) {
  console.log(`\n❌ ${unicos.length} CICLO(S) — el bundle puede reventar con "Cannot access X before initialization":\n`);
  for (const c of unicos) console.log(`   ${c.map(rel).join('\n   → ')}\n`);
  console.log('CÓMO SE ARREGLA: mover la función compartida a su CAPA (la de referencia/');
  console.log('geometría), NO meter un import de vuelta. Las capas van en un solo sentido.');
  process.exit(1);
}
console.log('\n✓ CERO ciclos de imports');
// ── PARTE 2: TDZ DENTRO DE UN COMPONENTE ────────────────────────────────────
// El otro TDZ que tumbó el CAD (2026-07-16) NO era un ciclo de imports: era un
// `useMemo` cuyo array de deps mencionaba una `const` declarada MÁS ABAJO en el mismo
// componente. El array se evalúa EN EL ACTO ⇒ "Cannot access 'kn' before initialization".
// TypeScript no lo ve (el hook es una llamada válida) y `vite dev` tampoco.
const hooks = [];
for (const f of files.filter((x) => x.endsWith('.tsx'))) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  // dónde se DECLARA cada const/let de nivel de componente
  const declared = new Map();
  lines.forEach((ln, i) => {
    const m = ln.match(/^\s{2}const\s+(?:\[([^\]]+)\]|(\w+))\s*[=:]/);
    if (!m) return;
    const names = m[1] ? m[1].split(',').map((x) => x.trim()) : [m[2]];
    for (const n of names) if (n && !declared.has(n)) declared.set(n, i);
  });
  // arrays de deps de hooks
  lines.forEach((ln, i) => {
    const m = ln.match(/^\s*\}, \[([^\]]*)\]\);/);
    if (!m || !m[1].trim()) return;
    // busca hacia atrás el useMemo/useEffect/useCallback que abre
    let open = -1;
    for (let j = i; j >= 0 && j > i - 120; j--) {
      if (/(useMemo|useEffect|useCallback)\(/.test(lines[j])) { open = j; break; }
    }
    if (open < 0) return;
    for (const d of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
      const at = declared.get(d);
      if (at != null && at > open) {
        hooks.push({ f: rel(f), dep: d, hookLine: open + 1, declLine: at + 1 });
      }
    }
  });
}
// ⚠ HEURÍSTICA, NO PRUEBA: este escaneo mira el archivo entero, no por componente ni
// distingue props de consts. Un archivo con varios componentes (QuasarSED tiene 10) da
// FALSOS POSITIVOS: un hook de `SEDGraph` usando su prop `data` "choca" con una const
// `data` de otro componente 200 líneas abajo. Por eso AVISA y no falla — un gate que
// grita en falso se ignora, y entonces no sirve para nada.
// Lo que SÍ es prueba: el arranque real del CAD (scripts/_err.cjs carga la página y lee
// los errores de consola). Eso es lo que cazó el TDZ de verdad.
if (hooks.length) {
  console.log(`\n⚠ ${hooks.length} sospechas de TDZ en deps de hooks (heurística — revisar a mano):`);
  for (const h of hooks.slice(0, 6)) {
    console.log(`   ${h.f}: hook línea ${h.hookLine} usa '${h.dep}', declarada en la ${h.declLine}`);
  }
  console.log('   (falso positivo si están en componentes distintos o es un prop)');
} else console.log('✓ CERO sospechas de TDZ en deps de hooks');

process.exit(0);
