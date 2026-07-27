/**
 * GATE de la ROSCA REAL (mold-threads): la cuerda es DATOS + superficie procedural,
 * REAL a cualquier paso (incl. ultra-fino), y ACOPLA tornillo↔barreno.
 *   1. M10×1.5 → superficie con variación radial ≈ h = 0.54·P (NO barra lisa)
 *   2. ULTRA-CHICO M1×0.25 y M2×0.4 → siguen dando rosca real (variación > 0)
 *   3. área de esfuerzo §12.4 (M10: As ≈ 58 mm²) al valor de tabla
 *   4. ACOPLA M10×1.5 bolt ↔ M10×1.5 hole; NO acopla M10×1.5 ↔ M10×1.25 (paso ≠)
 * Uso: node --import tsx scripts/mold-threads-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const T = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-threads.ts'));

  // 1) M10×1.5 rosca real
  const m10 = T.resolveThread(10);
  const { h } = T.threadDims(10, 1.5);
  const mesh = T.threadSurfaceMesh(m10, 40);
  const varMm = T.threadRealnessMm(mesh);
  console.log(`M10×1.5: minor ${m10.minor} · d2 ${m10.pitchDia} · As ${m10.stressAreaMm2} · tap ${m10.tapDrillMm} · h=${h.toFixed(3)}`);
  console.log(`  superficie: ${(mesh.indices.length/3).toLocaleString()} tris · variación radial ${varMm} mm (h=${h.toFixed(2)})`);
  check('M10×1.5 → rosca REAL (variación ≈ h, no barra lisa)', varMm > h * 0.6 && varMm < h * 1.2, `${varMm} vs h ${h.toFixed(2)}`);
  check('área de esfuerzo M10 ≈ 58 mm² (§12.4)', Math.abs(m10.stressAreaMm2 - 58) < 3, `${m10.stressAreaMm2}`);
  check('malla ligera (< 12k tris para 40 mm)', mesh.indices.length/3 < 12000, `${(mesh.indices.length/3)|0} tris`);

  // 2) ULTRA-CHICAS
  for (const dd of [1, 2, 2.5]) {
    const sp = T.resolveThread(dd);
    const hh = T.threadDims(sp.major, sp.pitch).h;
    const v = T.threadRealnessMm(T.threadSurfaceMesh(sp, sp.major * 3));
    console.log(`${sp.desig}: h=${hh.toFixed(3)} · variación ${v} mm`);
    check(`ULTRA-CHICO ${sp.desig} → rosca real`, v > hh * 0.5, `${v} vs h ${hh.toFixed(3)}`);
  }

  // 3) paso FINO
  const m10f = T.resolveThread(10, { fine: true });
  console.log(`\nM10 fino: ${m10f.desig} (paso ${m10f.pitch})`);
  check('paso fino disponible (M10×1.25)', m10f.pitch === 1.25, `${m10f.desig}`);
  check('rosca fina también es real', T.threadRealnessMm(T.threadSurfaceMesh(m10f, 30)) > 0.3, 'variación');

  // 4) ACOPLAMIENTO (¿puedo unir las placas?)
  const holeOK = T.parseThread('M10×1.5');
  const holeBad = T.parseThread('M10×1.25');
  check('ACOPLA tornillo M10×1.5 ↔ barreno M10×1.5', T.threadsMate(m10, holeOK), 'mismo Ø/paso/sentido');
  check('NO acopla M10×1.5 ↔ M10×1.25 (paso ≠)', !T.threadsMate(m10, holeBad), 'paso distinto = no une');
  check('NO acopla RH ↔ LH', !T.threadsMate(m10, { ...holeOK, hand: 'LH' }), 'sentido distinto');

  // 5) LH y multi-entrada no rompen
  const lh = T.resolveThread(12, { hand: 'LH', starts: 2 });
  check('LH + 2 entradas → rosca real', T.threadRealnessMm(T.threadSurfaceMesh(lh, 40)) > 0.5, lh.desig + ' LH×2');

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ ROSCA REAL: superficie ISO 68-1 a cualquier paso + acoplamiento (datos CAD, ultraliviano)');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
