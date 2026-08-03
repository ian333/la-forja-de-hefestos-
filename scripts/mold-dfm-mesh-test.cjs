/**
 * GATE del juez de moldeabilidad DESDE LA MALLA (dfm-mesh vs Kazmer §2.3):
 *   1. caja con TÚNEL lateral (Fig 2.7 "window in a side wall") → con-mecanismos
 *   2. caja con HUECO INTERNO sellado → NO moldeable
 *   3. cono (draft 45°) → moldeable, draft ✓
 *   4. caja lisa (paredes verticales) → moldeable pero draft ⚠ (§2.3.6)
 *   5. STLs reales: benchy (arco/cabina → mecanismos), carcasa RPi4 (puertos → mecanismos)
 * Uso: node --import tsx scripts/mold-dfm-mesh-test.cjs
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const occtFactory = require(cjsGlue);
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

function parseBinSTL(file) {
  const buf = readFileSync(file);
  const n = buf.readUInt32LE(80);
  const pos = new Float32Array(n * 9);
  const idx = new Uint32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12;
    for (let v = 0; v < 9; v++) pos[i * 9 + v] = buf.readFloatLE(o + v * 4);
    idx[i * 3] = i * 3; idx[i * 3 + 1] = i * 3 + 1; idx[i * 3 + 2] = i * 3 + 2;
  }
  return { positions: pos, indices: idx };
}

let fails = 0;
const check = (name, cond, detail) => {
  console.log(` ${cond ? '✓' : '❌'} ${name} — ${detail}`);
  if (!cond) fails++;
};

(async () => {
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const DFM = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'dfm-mesh.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);
  const mesh = (shape) => { const m = K.tessellate(oc, shape, 0.3, 0.3); return { positions: m.positions, indices: m.indices }; };

  // 1) TÚNEL LATERAL (Fig 2.7): box 40×30×20 con barreno rectangular horizontal
  {
    const box = K.makeBox(oc, 40, 30, 20);
    const tunel = K.transformShape(oc, K.makeBox(oc, 10, 60, 8), { translate: [15, -10, 6] });
    const r = DFM.dfmFromMesh(mesh(K.cut(oc, box, tunel)));
    console.log(`\n[túnel lateral] moldable=${r.moldable} · undercut ${r.undercut.columnsPct}% (${r.undercut.regions} reg)`);
    check('túnel lateral → con-mecanismos', r.moldable === 'con-mecanismos', 'Fig 2.7: pide side-action §11.3');
    check('túnel detectado (>1% huella)', r.undercut.columnsPct > 1, `${r.undercut.columnsPct}%`);
  }
  // 2) HUECO INTERNO SELLADO → NO moldeable
  {
    const box = K.makeBox(oc, 40, 30, 20);
    const hueco = K.transformShape(oc, K.makeBox(oc, 20, 15, 8), { translate: [10, 7.5, 6] });
    const r = DFM.dfmFromMesh(mesh(K.cut(oc, box, hueco)));
    console.log(`\n[hueco sellado] moldable=${r.moldable} · enclosed=${r.undercut.enclosedVoids}`);
    check('hueco interno cerrado → NO moldeable', r.moldable === 'no', 'cavidad sellada, ni side-action la alcanza');
  }
  // 3) PIRÁMIDE (draft ~53°) → moldeable, draft ✓
  {
    const pyr = {
      positions: new Float32Array([0, 0, 0, 40, 0, 0, 40, 30, 0, 0, 30, 0, 20, 15, 18]),
      indices: new Uint32Array([0, 2, 1, 0, 3, 2, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]),
    };
    const r = DFM.dfmFromMesh(pyr);
    console.log(`\n[pirámide] moldable=${r.moldable} · draft<0.5°: ${r.draft.pctBelowMin}%`);
    check('pirámide → moldeable sin mecanismos', r.moldable === 'si', 'draft ~53° sobra');
    check('pirámide draft ✓ (<5% bajo 0.5°)', r.draft.pctBelowMin < 5, `${r.draft.pctBelowMin}%`);
  }
  // 4) CAJA LISA → moldeable PERO draft ⚠ (100% de laterales a 0°)
  {
    const r = DFM.dfmFromMesh(mesh(K.makeBox(oc, 40, 30, 20)));
    console.log(`\n[caja lisa] moldable=${r.moldable} · draft<0.5°: ${r.draft.pctBelowMin}%`);
    check('caja → sin undercuts', r.moldable === 'si', 'dos placas bastan');
    check('caja → draft ⚠ (§2.3.6: se pega al expulsar)', r.draft.pctBelowMin > 50, `${r.draft.pctBelowMin}% del lateral a 0°`);
  }
  // 5) STLs REALES
  for (const [file, name, expectUnder] of [
    ['test-parts/3dbenchy.stl', 'Benchy', true],
    ['test-parts/rpi4-bottom.stl', 'Carcasa RPi4 fondo', true],
  ]) {
    const f = path.resolve(__dirname, '..', file);
    if (!existsSync(f)) { console.log(`(salta ${name}: no está ${file})`); continue; }
    const r = DFM.dfmFromMesh(parseBinSTL(f));
    console.log(`\n[${name}] moldable=${r.moldable} · undercut ${r.undercut.columnsPct}% (${r.undercut.regions} reg, ${r.undercut.volumeMm3} mm³) · draft<0.5°: ${r.draft.pctBelowMin}% · pared p50 ${r.wall.p50Mm}`);
    for (const v of r.verdicts) console.log(`   ${v.ok ? '✓' : '⚠'} ${v.param}: ${v.valor} [${v.ref}]`);
    check(`${name}: undercuts ${expectUnder ? 'detectados' : 'ausentes'}`, (r.undercut.regions >= 1 && r.undercut.volumeMm3 > 5) === expectUnder,
      `${r.undercut.columnsPct}% · ${r.undercut.regions} reg · ${r.undercut.volumeMm3} mm³ — ${expectUnder ? 'ventanas/arcos reales piden mecanismos o rediseño' : 'liso'}`);
    check(`${name}: no lo marca imposible`, r.moldable !== 'no', 'inyectable con mecanismos');
  }

  // ── ELECCIÓN DE EJE DE APERTURA (draw-axis): el embudo ACOSTADO daba 196k mm³
  // de undercut; por su eje de revolución da 0 → la Máquina debe elegirlo sola
  {
    const fFunnel = path.resolve(__dirname, '..', 'test-parts', 'funnel-130.stl');
    if (existsSync(fFunnel)) {
      const DA = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'draw-axis.ts'));
      const choice = DA.pickDrawAxis(parseBinSTL(fFunnel));
      const worst = Math.max(...choice.candidates.map((c) => c.underVol));
      const chosen = choice.candidates.find((c) => c.zAxis === choice.oriented.zAxis);
      console.log(`\n[embudo] ejes: ${choice.candidates.map((c) => `${'LWH'[c.zAxis]}=${c.underVol}mm³`).join(' · ')} → elegido ${'LWH'[chosen.zAxis]}`);
      check('elección de eje: embudo por su eje de revolución (undercut 0)', chosen.underVol === 0 && worst > 50000, `${chosen.underVol} vs peor ${worst}`);
      check('embudo bien orientado → MOLDEABLE dos placas', choice.dfm.moldable === 'si', choice.dfm.moldable);
    } else console.log('(salta embudo: no está test-parts/funnel-130.stl)');
  }

  // ── TOPOLOGÍA DE ALABEO §10.3.1 + ÁREA PROYECTADA §5.5.3 (mallas sintéticas:
  // solo tapas — el raster es de rayos verticales, no necesita paredes) ──
  {
    const slab = (P, I, x0, y0, x1, y1, h) => {
      for (const z of [0, h]) {
        const b = P.length / 3;
        P.push(x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z);
        I.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    };
    const P1 = [], I1 = [];
    slab(P1, I1, 0, 0, 100, 80, 3);                      // placa MACIZA 100×80×3
    const rPl = DFM.dfmFromMesh({ positions: new Float32Array(P1), indices: new Uint32Array(I1) }, { wallMm: 3 });
    check('placa maciza clasifica \x27placa\x27 (§10.3.1: pandea si Δs > 0.44·(h/W)²)',
      rPl.warpageTopology.tipo === 'placa', JSON.stringify(rPl.warpageTopology));
    check('área proyectada de la placa = bbox (sin ventanas no hay descuento)',
      Math.abs(rPl.projectedAreaMm2 - 8000) < 200, `${rPl.projectedAreaMm2} vs 8000`);
    const P2 = [], I2 = [];
    slab(P2, I2, 0, 0, 100, 15, 3);                      // MARCO: rim de 15 con ventana 70×50
    slab(P2, I2, 0, 65, 100, 80, 3);
    slab(P2, I2, 0, 15, 15, 65, 3);
    slab(P2, I2, 85, 15, 100, 65, 3);
    const rMa = DFM.dfmFromMesh({ positions: new Float32Array(P2), indices: new Uint32Array(I2) }, { wallMm: 3 });
    check('marco con ventana clasifica \x27marco\x27 (§10.3.1: bordes desacoplados, no alabea)',
      rMa.warpageTopology.tipo === 'marco', JSON.stringify(rMa.warpageTopology));
    check('área proyectada del marco DESCUENTA la ventana (§5.5.3: el tonelaje sobre bbox sobreestima)',
      Math.abs(rMa.projectedAreaMm2 - 4500) < 250, `${rMa.projectedAreaMm2} vs 4500 real (bbox diría 8000)`);
  }

  console.log(fails ? `\n❌ ${fails} checks fallaron` : '\n✓ el juez de moldeabilidad calza con el libro (Fig 2.7 + §2.3.6 + §2.3.1)');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', e); process.exit(1); });
