#!/usr/bin/env node
/**
 * La Forja — PORTERO MAESTRO (forja-gate)
 * ========================================
 * UNA sola manera de probar La Forja COMPLETA. Corre todas las suites de
 * verificación del CAD/CAE (kernel B-Rep, FEA, generativo, croquis, planos,
 * impresión) y emite un reporte PASS/FAIL por área + un JSON máquina-legible.
 *
 * Filosofía del proyecto: "compila ≠ funciona". Cada suite valida un INVARIANTE
 * (volumen exacto, Euler V−E+F=2, σ=F/A vs FEA, compliance↓ del generativo,
 * DOF del croquis, HLR de planos), no "se ve bien". El gate falla (exit 1) si
 * cualquier invariante se rompe.
 *
 * ROBUSTO A CWD: se ancla a la raíz del repo vía __dirname y lanza cada hijo con
 * cwd = raíz, así `node --import tsx ...` resuelve `tsx` sin depender del shell.
 * (Un `ssh` pelón cae en $HOME — por eso NO confiamos en el cwd del shell.)
 *
 *   node scripts/forja-gate.cjs              # todas las suites node (sin navegador)
 *   node scripts/forja-gate.cjs --json out.json
 *   node scripts/forja-gate.cjs --only kernel,physics
 *   node scripts/forja-gate.cjs --ui http://localhost:5001/forja-brep.html  # + e2e GPU
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const NODE = process.execPath;
const VITEST = path.join(repoRoot, 'node_modules', '.bin', 'vitest');

// ── args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argVal(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}
const onlyGroups = (argVal('--only') || '').split(',').filter(Boolean);
const jsonOut = argVal('--json');
const uiUrl = argVal('--ui');
const perTimeout = Number(argVal('--timeout') || 200) * 1000;

// ── catálogo de suites ──────────────────────────────────────────────
// group: área del producto · n: nombre · cmd/args · que verifica
const SUITES = [
  { group: 'kernel', n: 'occt-brep',     why: 'caja/cilindro/cut: topología+volumen EXACTO, STEP roundtrip, normales unit',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/occt-brep-test.cjs'] },
  { group: 'kernel', n: 'occt-extrude',  why: 'perfil 2D→sólido: rect & círculo extruidos V/Euler exactos, malla, STEP',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/occt-extrude-test.cjs'] },
  { group: 'kernel', n: 'occt-features', why: 'barreno, revolve (Pappus), shell/vaciado, props de masa, enumerar caras/aristas, fillet/chamfer selectivo',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/occt-features-test.cjs'] },
  { group: 'kernel', n: 'mold-filling', why: 'Kazmer cap 5: ΔP power-law 83.2MPa + clamp 99ton EXACTOS (bezel)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-filling-test.cjs'] },
  { group: 'kernel', n: 'mold-feed', why: 'Kazmer cap 6: hot runner 5.9/8.8/16.7MPa + optimizador R 5.0/4.4/4.4mm EXACTOS',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-feed-test.cjs'] },
  { group: 'kernel', n: 'mold-ejection', why: 'Kazmer cap 11: F_eject cup 1.8kN/bezel 4.7kN + pines (shear gobierna ⌀2.27)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-ejection-test.cjs'] },
  { group: 'kernel', n: 'mold-cost', why: 'Kazmer cap 3: break-even cold/hot 615,385 pzas + tabla 3.1 exacta',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-cost-test.cjs'] },
  { group: 'kernel', n: 'mold-shrinkage', why: 'Kazmer cap 10: Tait pvT doble dominio, v(405K,66MPa)=9.65e-4 y s=0.31% EXACTOS (bezel)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-shrinkage-test.cjs'] },
  { group: 'kernel', n: 'mold-structural', why: 'Kazmer cap 12: compresión 17MPa/corte 21.8/flexión 0.056mm EXACTOS + veredicto FLASH',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-structural-test.cjs'] },
  { group: 'kernel', n: 'mold-sideactions', why: 'Kazmer §11.3.6-8 MOLDES CON MOVIMIENTO: core pull 44kN/⌀75→82.55std, angle pin 35+25mm EXACTOS, decisor slide/pull',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-sideactions-test.cjs'] },
  { group: 'kernel', n: 'mold-fasteners', why: 'Kazmer §12.4: tornillo del molde peor-caso 362kg/47kN → M10 DIN 912 del CATÁLOGO real',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-fasteners-test.cjs'] },
  { group: 'kernel', n: 'mold-gating', why: 'Kazmer cap 7: γ̇ gates 111k/132k, R=1.03mm, ΔP 1.9/1.9/1.3 MPa EXACTOS + tabla 10 tipos',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-gating-test.cjs'] },
  { group: 'kernel', n: 'mold-venting', why: 'Kazmer cap 8: venteo h_min 0.06mm (aire viscoso) / h_max por flash + tabla handbooks',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-venting-test.cjs'] },
  { group: 'kernel', n: 'mold-cooling', why: 'Kazmer cap 9: t_c placa/barra (Eq 9.5/9.6) contra ejemplos del libro (8.4/18.9/22.9s), sim 1D transitoria (Eq 9.4), Q por ciclo',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-cooling-test.cjs'] },
  { group: 'kernel', n: 'mold-engine', why: 'MOTOR DE MOLDES cap 6: draft analysis, shrinkage, core&cavity con shut-offs (tina+tapa refs exactas), split plano (jabonera)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-engine-test.cjs'] },
  { group: 'kernel', n: 'sim-cycle', why: 'MOTOR DEL CICLO (sim viva): 8 fases, P(t) power-law del frente, F_apertura vs clamp→FLASH, FDM k-armónica (effusividad <95°C), textura sección',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/sim-cycle-test.cjs'] },
  { group: 'kernel', n: 'mold-drawings', why: 'PLANOS DE TALLER del molde: tabla de barrenos fiel al registro (X/Y/⌀/prof/tipo), BOM+globos, achurado, línea de partición',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-drawings-test.cjs'] },
  { group: 'kernel', n: 'mold-base', why: 'Kazmer cap 4 + Apéndice B: insertos 3⌀/cheek=profundidad, base estándar+aspecto 2:1, HM320 fiel, 11 metales EXACTOS (α≡k/ρcp) + selector',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-base-test.cjs'] },
  { group: 'kernel', n: 'mold-dfm', why: 'Kazmer §2.3 DFM: costilla 70%/4×/10×, boss 70%, filete 150/50%, draft 0.5° mín + Tabla 2.14 exacta, undercuts, jetting',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-dfm-test.cjs'] },
  { group: 'kernel', n: 'occt-sweep-loft', why: 'loft (prisma A·h, tronco h/3·(a²+b²+ab)) + sweep (cilindro πr²L, codo suave sin truncar)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/occt-sweep-loft-test.cjs'] },
  { group: 'physics', n: 'fea',          why: 'FEA real K·u=f vs analítico: barra axial σ=F/A & δ=FL/AE, viga voladizo',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/fea-node-test.cjs'] },
  { group: 'physics', n: 'topopt',       why: 'generativo SIMP (voladizo): compliance↓, volumen conservado, densidades acotadas, vacío creado',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/topopt-node-test.cjs'] },
  { group: 'unit', n: 'vitest-forja',    why: 'croquis (solver DOF/L-M), planos (HLR), topopt-AM (auto-soporte 45°), soportes, evolución GA',
    cmd: VITEST, args: ['run', 'src/forja', '--reporter=dot'] },
];

// e2e por GPU (opcional, requiere preview vivo en iangpu)
if (uiUrl) {
  SUITES.push({
    group: 'e2e', n: 'forja-brep-ui', why: 'Part Studio por clics reales: extrude→barreno→fillet→shell + panel de análisis (GPU/ANGLE)',
    cmd: NODE, args: ['scripts/forja-brep-ui-verify.cjs'], env: { URL: uiUrl },
  });
  SUITES.push({
    group: 'e2e', n: 'sweep-loft-ui', why: 'Loft + Sweep (recta/codo/hélice) por clics reales → sólidos válidos (GPU/ANGLE)',
    cmd: NODE, args: ['scripts/forja-sweep-loft-ui-verify.cjs'], env: { URL: uiUrl },
  });
}

const suites = onlyGroups.length
  ? SUITES.filter((s) => onlyGroups.includes(s.group))
  : SUITES;

// ── runner ──────────────────────────────────────────────────────────
function tail(s, nLines = 18) {
  const lines = String(s || '').replace(/\s+$/, '').split('\n');
  return lines.slice(-nLines).join('\n');
}
// Señales suaves de fallo en la salida (por si una suite olvida exit≠0).
const FAIL_RE = /(\bFAIL\b|\b✗\b|❌|Error:|AssertionError|throw new|✘|\bfailed\b)/;
const PASS_RE = /(\bPASS\b|✓|✔|TODO OK|todos? (?:los? )?(?:tests?|invariantes?).*(?:ok|pas)|✅)/i;

function run(s) {
  const started = Date.now();
  const r = spawnSync(s.cmd, s.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: perTimeout,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(s.env || {}) },
  });
  const ms = Date.now() - started;
  const out = (r.stdout || '') + (r.stderr || '');
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  const exit = timedOut ? 124 : (typeof r.status === 'number' ? r.status : 1);
  // Verdad principal = exit code. Señal suave de respaldo si exit=0 pero el
  // texto grita FAIL y nunca dice PASS (atrapa suites que no propagan el código).
  let pass = exit === 0;
  if (pass && FAIL_RE.test(out) && !PASS_RE.test(out)) pass = false;
  return { ...s, exit, pass, ms, timedOut, tailOut: tail(out), bytes: out.length };
}

// ── ejecución ───────────────────────────────────────────────────────
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' };
console.log(`${C.b}⚒  La Forja · Portero Maestro${C.x}  ${C.dim}(${suites.length} suites · raíz ${repoRoot})${C.x}\n`);

const results = [];
for (const s of suites) {
  process.stdout.write(`  ▸ ${C.b}${s.group}/${s.n}${C.x} ${C.dim}— ${s.why}${C.x}\n`);
  const res = run(s);
  results.push(res);
  const tag = res.pass ? `${C.g}✓ PASS${C.x}` : res.timedOut ? `${C.y}⧖ TIMEOUT${C.x}` : `${C.r}✗ FAIL${C.x}`;
  process.stdout.write(`    ${tag} ${C.dim}(${(res.ms / 1000).toFixed(1)}s · exit ${res.exit})${C.x}\n`);
  if (!res.pass) {
    process.stdout.write(`${C.dim}    ┄┄┄ últimas líneas ┄┄┄${C.x}\n`);
    process.stdout.write(res.tailOut.split('\n').map((l) => '    ' + l).join('\n') + '\n');
    process.stdout.write(`${C.dim}    ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄${C.x}\n`);
  }
}

// ── resumen ─────────────────────────────────────────────────────────
const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
console.log(`\n${C.b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.x}`);
console.log(`${C.b}RESUMEN${C.x}`);
const byGroup = {};
for (const r of results) (byGroup[r.group] ||= []).push(r);
for (const [g, rs] of Object.entries(byGroup)) {
  const p = rs.filter((x) => x.pass).length;
  const ok = p === rs.length;
  console.log(`  ${ok ? C.g + '✓' : C.r + '✗'} ${g.padEnd(8)}${C.x} ${p}/${rs.length}  ${C.dim}${rs.map((x) => (x.pass ? '·' : x.n)).join(' ')}${C.x}`);
}
console.log(`${C.b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.x}`);
console.log(`  ${failed === 0 ? C.g + '✓ TODO VERDE' : C.r + '✗ ' + failed + ' SUITE(S) ROTA(S)'}${C.x}  ${C.dim}(${passed}/${results.length})${C.x}\n`);

if (jsonOut) {
  const report = {
    when: new Date().toISOString(),
    repoRoot,
    passed, failed, total: results.length,
    suites: results.map(({ group, n, why, exit, pass, ms, timedOut }) => ({ group, n, why, exit, pass, ms, timedOut })),
  };
  fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
  console.log(`${C.dim}reporte JSON → ${jsonOut}${C.x}`);
}

process.exit(failed === 0 ? 0 : 1);
