/**
 * La Forja — INVARIANTES de Sweep (Pipe) y Loft (ThruSections)
 * =============================================================
 * Verifica las dos nuevas operaciones del kernel contra geometría analítica,
 * no "se ve bien" (filosofía del proyecto: compila ≠ funciona):
 *
 *   LOFT 1 · dos CUADRADOS iguales (lado 20) separados h=10  → prisma, V=4000
 *   LOFT 2 · cuadrado(20)→cuadrado(10) coaxiales, h=10       → tronco de
 *            pirámide, V = h/3·(a²+b²+ab) = 10/3·(400+100+200) = 2333.333…
 *   SWEEP 1 · círculo r=5 barrido por recta L=30            → cilindro,
 *             V = π·5²·30 = 2356.1944…  (perfil ⟂ al spine)
 *   SWEEP 2 · círculo r=4 barrido por una L (dos tramos)    → sólido válido,
 *             V>0 y Euler de sólido coherente (sanidad, sin analítico)
 */
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const factory = require(cjsGlue);
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

(async () => {
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);

  const PI = Math.PI;
  let pass = 0, fail = 0;
  const rel = (a, b) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));
  function check(name, got, want, eps = 2e-3, extra = '') {
    const ok = rel(got, want) <= eps;
    console.log(`  ${ok ? '✓' : '✗'} ${name}: got=${got.toFixed(4)} want=${want.toFixed(4)} relErr=${rel(got, want).toExponential(2)} ${extra}`);
    ok ? pass++ : fail++;
    return ok;
  }
  function checkBool(name, cond, extra = '') {
    console.log(`  ${cond ? '✓' : '✗'} ${name} ${extra}`);
    cond ? pass++ : fail++;
    return cond;
  }

  const sq = (a) => [
    { x: -a / 2, y: -a / 2 }, { x: a / 2, y: -a / 2 },
    { x: a / 2, y: a / 2 }, { x: -a / 2, y: a / 2 },
  ];
  const planeAtZ = (z) => ({ origin: [0, 0, z], uDir: [1, 0, 0], vDir: [0, 1, 0] });

  console.log('── LOFT ───────────────────────────────────────────');
  // LOFT 1 — prisma
  {
    const solid = occt.loftSections(oc, [
      { pts: sq(20), plane: planeAtZ(0) },
      { pts: sq(20), plane: planeAtZ(10) },
    ], { solid: true });
    const v = occt.volume(oc, solid);
    const topo = occt.topology(oc, solid);
    check('loft cuadrados iguales = prisma V', v, 20 * 20 * 10, 3e-3);
    checkBool('loft prisma Euler=2', topo.euler === 2, `(V−E+F=${topo.euler}, f=${topo.faces})`);
  }
  // LOFT 2 — tronco de pirámide
  {
    const solid = occt.loftSections(oc, [
      { pts: sq(20), plane: planeAtZ(0) },
      { pts: sq(10), plane: planeAtZ(10) },
    ], { solid: true });
    const v = occt.volume(oc, solid);
    const want = (10 / 3) * (400 + 100 + 200); // 2333.333…
    check('loft cuadrado→cuadrado = tronco V', v, want, 5e-3);
  }

  console.log('── SWEEP ──────────────────────────────────────────');
  // SWEEP 1 — cilindro
  {
    const solid = occt.sweepProfileAlong(oc,
      { kind: 'circle', center: { x: 0, y: 0 }, radius: 5 },
      [[0, 0, 0], [0, 0, 30]]);
    const v = occt.volume(oc, solid);
    const topo = occt.topology(oc, solid);
    check('sweep círculo por recta = cilindro V', v, PI * 25 * 30, 3e-3);
    checkBool('sweep cilindro Euler=2', topo.euler === 2, `(=${topo.euler}, f=${topo.faces})`);
  }
  // SWEEP 2 — codo SUAVE (spine B-spline a través de 3 puntos). La esquina se
  // redondea (tubo real), así que V ≈ π·r²·(largo de arco), claramente MÁS que
  // un solo tramo (πr²·20=1005) — eso prueba que se barrió TODO el camino, no
  // que MakePipe truncó. Cota suelta (no analítico exacto por el codo curvo).
  {
    const solid = occt.sweepProfileAlong(oc,
      { kind: 'circle', center: { x: 0, y: 0 }, radius: 4 },
      [[0, 0, 0], [0, 0, 20], [15, 0, 20]]);
    const v = occt.volume(oc, solid);
    const topo = occt.topology(oc, solid);
    const oneSeg = PI * 16 * 20; // 1005.3 — si truncara al primer tramo
    checkBool('sweep-codo NO truncó (V > 1 tramo)', v > oneSeg * 1.15, `(V=${v.toFixed(1)} vs 1tramo=${oneSeg.toFixed(1)})`);
    checkBool('sweep-codo volumen plausible', v > PI * 16 * 24 && v < PI * 16 * 40, `(V=${v.toFixed(1)}, πr²·[24..40])`);
    checkBool('sweep-codo sólido válido (faces≥3, Euler finito)', topo.faces >= 3 && Number.isFinite(topo.euler), `(f=${topo.faces}, Euler=${topo.euler})`);
  }
  // SWEEP 3 — HÉLICE (resorte) con perfil chico → tubo, V ≈ π·r²·L (L=largo del
  // alambre). Prueba el camino helicoidal de buildSweepPath sin auto-intersección.
  {
    const r = 2, R = 15, pitch = 10, turns = 2, n = 48, tot = turns * 2 * PI;
    const pathH = [];
    for (let i = 0; i <= n; i++) {
      const t = (tot * i) / n;
      pathH.push([R * Math.cos(t), R * Math.sin(t), (pitch * t) / (2 * PI)]);
    }
    let L = 0;
    for (let i = 1; i < pathH.length; i++) {
      const a = pathH[i - 1], b = pathH[i];
      L += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
    const solid = occt.sweepProfileAlong(oc, { kind: 'circle', center: { x: 0, y: 0 }, radius: r }, pathH);
    const v = occt.volume(oc, solid);
    const topo = occt.topology(oc, solid);
    check('sweep hélice = tubo V≈πr²·L', v, PI * r * r * L, 6e-2, `(L=${L.toFixed(1)})`);
    checkBool('sweep hélice sólido válido', topo.faces >= 3 && Number.isFinite(topo.euler), `(f=${topo.faces}, Euler=${topo.euler})`);
  }

  console.log(`\n${fail === 0 ? '✓ TODO OK' : '✗ ' + fail + ' FALLO(S)'}  (${pass} pass / ${fail} fail)`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('TEST_FAIL', e); process.exit(1); });
