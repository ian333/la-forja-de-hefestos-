/**
 * GATE DE LA PARTICIÓN NO PLANA (task #43) — lo que los cursos hacen a mano.
 * ============================================================================
 * 4 casos, del fácil al del curso:
 *  1) CAJA plana — control: el lazo es plano y el split debe cuadrar contra
 *     el corte por plano (misma física, dos caminos).
 *  2) ARCO (media dona extruida) — el lazo TREPA por los rims: NO PLANO.
 *  3) PLACA CON VENTANA — el lazo interno = shut-off: la cuchilla tapa la
 *     columna y las mitades separan.
 *  4) PEINE del curso 2 — silueta compleja (dientes): el lazo cierra con
 *     decenas de puntos y el split conserva volumen.
 * Invariantes: lazo cerrado · vol(cav)+vol(núcleo)=vol(tmp) · 1 cuerpo por mitad.
 * Uso: node --import tsx scripts/parting-noplano-test.cjs
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const oc = await require(path.join(distDir, 'opencascade.wasm.cjs'))({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const PA = await import(path.join(ROOT, 'src', 'forja', 'mold', 'parting.ts'));

  const caja = (w, d, h, at = [0, 0, 0]) => K.transformShape(oc, K.makeBox(oc, w, d, h), { translate: [at[0] - w / 2, at[1] - d / 2, at[2]] });

  // ── 1) CAJA (control plano) ──────────────────────────────────────────────
  console.log('\n1) CAJA 60×40×20 (lazo plano):');
  {
    const p = caja(60, 40, 20);
    const r = PA.splitNoPlano(oc, p, { marginMm: 25, topMm: 25, bottomMm: 25 });
    console.log('   ' + r.report.join('\n   '));
    const ext = r.loops.find((L) => L.esExterior);
    check('lazo exterior CERRADO y PLANO', ext && (ext.zMax - ext.zMin) < 0.2, `z ${ext?.zMin.toFixed(2)}..${ext?.zMax.toFixed(2)}`);
    check('volumen conservado', Math.abs(r.vols.tmp - r.vols.cavity - r.vols.core) / r.vols.tmp < 0.005, `${(100 * Math.abs(r.vols.tmp - r.vols.cavity - r.vols.core) / r.vols.tmp).toFixed(2)} %`);
    check('1 cuerpo por mitad', r.bodies.cavity === 1 && r.bodies.core === 1, `cav ${r.bodies.cavity} · núcleo ${r.bodies.core}`);
    // la caja parte en su cara de espalda (z=0, silueta) — el núcleo debe ser
    // el bloque de abajo COMPLETO (la caja no deja impronta abajo)
    const volEsperadoCore = 110 * 90 * 25;
    check('núcleo = bloque bajo la espalda (corte por plano, mismo resultado)', Math.abs(r.vols.core - volEsperadoCore) / volEsperadoCore < 0.01, `${r.vols.core.toFixed(0)} vs ${volEsperadoCore}`);
  }

  // ── 2) ARCO (NO plano) ───────────────────────────────────────────────────
  console.log('\n2) ARCO ⌀60/⌀40 (el lazo trepa los rims):');
  {
    const ptsO = [], ptsI = [];
    for (let a = 0; a <= 180; a += 10) {
      ptsO.push({ x: 30 * Math.cos((a * Math.PI) / 180), y: 30 * Math.sin((a * Math.PI) / 180) });
      ptsI.unshift({ x: 20 * Math.cos((a * Math.PI) / 180), y: 20 * Math.sin((a * Math.PI) / 180) });
    }
    // perfil en XZ (y→z al usar plano ZX… simplificamos: polígono XY y extruir en Z
    // no sirve — el arco debe ABRIR en z. Construcción: perfil del arco en el plano
    // XZ vía extrudePolygon con plano por defecto y ROTAR 90° en X.
    const perfil = K.extrudePolygon(oc, [...ptsO, ...ptsI], 25);
    const arco = K.transformShape(oc, perfil, { rotateAngle: Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [1, 0, 0] }, translate: [0, 0, 0] });
    const r = PA.splitNoPlano(oc, arco, { marginMm: 25, topMm: 25, bottomMm: 25 });
    console.log('   ' + r.report.join('\n   '));
    const ext = r.loops.find((L) => L.esExterior);
    check('lazo exterior NO PLANO (trepa ~radio interior)', ext && (ext.zMax - ext.zMin) > 15, `Δz = ${(ext.zMax - ext.zMin).toFixed(1)} mm`);
    check('volumen conservado', Math.abs(r.vols.tmp - r.vols.cavity - r.vols.core) / r.vols.tmp < 0.01, `${(100 * Math.abs(r.vols.tmp - r.vols.cavity - r.vols.core) / r.vols.tmp).toFixed(2)} %`);
    check('separa en 1+1 cuerpos', r.bodies.cavity === 1 && r.bodies.core === 1, `cav ${r.bodies.cavity} · núcleo ${r.bodies.core}`);
  }

  // ── 3) PLACA CON VENTANA (shut-off) ─────────────────────────────────────
  console.log('\n3) PLACA 80×50×6 con ventana 30×16 (shut-off automático):');
  {
    const octo = (w, h, c) => [
      { x: -w / 2 + c, y: -h / 2 }, { x: w / 2 - c, y: -h / 2 }, { x: w / 2, y: -h / 2 + c }, { x: w / 2, y: h / 2 - c },
      { x: w / 2 - c, y: h / 2 }, { x: -w / 2 + c, y: h / 2 }, { x: -w / 2, y: h / 2 - c }, { x: -w / 2, y: -h / 2 + c },
    ];
    const placa = K.extrudePolygonWithHoles(oc, octo(80, 50, 8), [octo(30, 16, 5)], 6);
    const r = PA.splitNoPlano(oc, placa, { marginMm: 20, topMm: 20, bottomMm: 20 });
    console.log('   ' + r.report.join('\n   '));
    check('detecta la VENTANA (2 lazos)', r.loops.length >= 2, `${r.loops.length} lazos`);
    check('shut-off aplicado (reporte)', r.report.some((l) => l.includes('shut-off')), r.report.find((l) => l.includes('shut-off')) ?? '—');
    check('separa en 1+1 (sin la columna, seguirían pegadas)', r.bodies.cavity === 1 && r.bodies.core === 1, `cav ${r.bodies.cavity} · núcleo ${r.bodies.core}`);
    check('volumen conservado', Math.abs(r.vols.tmp - r.vols.cavity - r.vols.core) / r.vols.tmp < 0.01, `${(100 * Math.abs(r.vols.tmp - r.vols.cavity - r.vols.core) / r.vols.tmp).toFixed(2)} %`);
  }

  // ── 4) PEINE del curso ───────────────────────────────────────────────────
  console.log('\n4) PEINE del curso (silueta de dientes):');
  {
    // dientes DENTRO del lomo: el último termina al ras de x=+39 (x0+2.6=TW2/2)
    // — si un diente SOBRESALE, el contorno se auto-toca y pellizca lazos falsos
    const NT = 9, TW2 = 78, spine = 8;
    const po = [{ x: -TW2 / 2, y: spine }, { x: TW2 / 2, y: spine }, { x: TW2 / 2, y: 0 }];
    for (let i = NT; i >= 0; i--) {
      const x0 = -TW2 / 2 + (i * (TW2 - 2.6)) / NT;
      po.push({ x: x0 + 2.6, y: 0 }, { x: x0 + 2.6, y: -22 }, { x: x0 + 1.3, y: -24 }, { x: x0, y: -22 }, { x: x0, y: 0 });
    }
    // el diente 9 arranca EXACTO en po[2]=(39,0): fuera el duplicado consecutivo
    const poU = po.filter((p, i) => i === 0 || Math.hypot(p.x - po[i - 1].x, p.y - po[i - 1].y) > 1e-9);
    const peine = K.extrudePolygon(oc, poU, 3);
    const r = PA.splitNoPlano(oc, peine, { marginMm: 20, topMm: 20, bottomMm: 20 });
    console.log('   ' + r.report.join('\n   '));
    const ext = r.loops.find((L) => L.esExterior);
    check('el lazo sigue TODA la silueta de dientes', ext && ext.pts.length > 45, `${ext?.pts.length} pts`);
    check('UN solo lazo (cero ventanas fantasma)', r.loops.length === 1, `${r.loops.length} lazos`);
    check('volumen conservado', Math.abs(r.vols.tmp - r.vols.cavity - r.vols.core) / r.vols.tmp < 0.01, `${(100 * Math.abs(r.vols.tmp - r.vols.cavity - r.vols.core) / r.vols.tmp).toFixed(2)} %`);
    check('separa en 1+1 cuerpos', r.bodies.cavity === 1 && r.bodies.core === 1, `cav ${r.bodies.cavity} · núcleo ${r.bodies.core}`);
  }

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ PARTICIÓN NO PLANA: lazos de la malla (+/− transición), ventanas = shut-offs, cuchilla cosida, split exacto — lo que el curso pica a mano, en una llamada.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
