/**
 * La Forja — FARM de DISEÑO GENERATIVO sobre PIEZAS REALES.
 * =========================================================
 * Corre la optimización topológica (topopt.ts) en varias piezas que un maker /
 * estudiante / taller de LATAM diseña de verdad, y verifica que CADA UNA:
 *   compliance baja (estructura más rígida) · volumen conservado · material
 *   vaciado (carvó una forma, no campo uniforme) · objetivo convergido.
 * Todo CPU. Demuestra que el generativo —que en LATAM no se usa por caro y sin
 * tutoriales— YA corre, gratis, sobre piezas reales.
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

// PIEZAS REALES: caja X×Y×Z (perfil XY extruido en +Z). fix/load por cara (eje,target).
// eje: 0=x,1=y,2=z. force en N.
const PIECES = [
  { name: 'Ménsula de pared (repisa)', use: 'cuelga una repisa atornillada al muro',
    dim: [60, 12, 40], fix: [[0, 0]], load: [2, 40], force: [0, 0, -1500], vf: 0.4, res: 14 },
  { name: 'Brazo voladizo (lever)', use: 'brazo de mecanismo / soporte saliente',
    dim: [100, 16, 16], fix: [[0, 0]], load: [0, 100], force: [0, 0, -1200], vf: 0.35, res: 16 },
  { name: 'Base de motor (mount)', use: 'monta un motor sobre una base, carga vertical',
    dim: [40, 40, 28], fix: [[2, 0]], load: [2, 28], force: [0, 0, -3000], vf: 0.4, res: 12 },
  { name: 'Cartabón (gusset, carga lateral)', use: 'refuerzo de esquina con carga de lado',
    dim: [50, 50, 10], fix: [[0, 0]], load: [1, 50], force: [-1500, 0, 0], vf: 0.35, res: 14 },
  { name: 'Columna excéntrica', use: 'poste/torre con carga descentrada (flexión)',
    dim: [26, 26, 60], fix: [[2, 0]], load: [2, 60], force: [-1000, 0, 0], vf: 0.3, res: 13 },
  { name: 'Viga bi-empotrada (puente)', use: 'larguero fijo en ambos extremos, carga arriba',
    dim: [80, 16, 20], fix: [[0, 0], [0, 80]], load: [2, 20], force: [0, 0, -2500], vf: 0.4, res: 16 },
];

(async () => {
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const topo = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'topopt.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);

  const results = [];
  for (const P of PIECES) {
    const r = { name: P.name, use: P.use, dim: P.dim, vf: P.vf };
    try {
      const [X, Y, Z] = P.dim;
      const box = occt.extrudePolygon(oc, [{ x: 0, y: 0 }, { x: X, y: 0 }, { x: X, y: Y }, { x: 0, y: Y }], Z);
      const faces = occt.enumerateFaces(oc, box);
      const pick = (axis, target) => faces.reduce((best, fr) => {
        const d = Math.abs(fr.center[axis] - target); return !best || d < best.d ? { idx: fr.index, d } : best;
      }, null).idx;
      const fixFaces = P.fix.map(([ax, t]) => pick(ax, t));
      const loadFace = pick(P.load[0], P.load[1]);
      const t0 = Date.now();
      const res = topo.runTopOpt(oc, box,
        { fixedFaces: fixFaces, loadFaces: [loadFace], totalForce: P.force },
        'acero_1045', { volfrac: P.vf, penal: 3, rmin: 1.5, ft: 1, maxLoops: 45, tolChange: 0.01, resolution: P.res });
      r.ms = Date.now() - t0;
      const h = res.history, N = res.nCells, xp = res.xPhys;
      let minX = 9, maxX = -9, mean = 0, voidF = 0, solidF = 0;
      for (let e = 0; e < N; e++) { const v = xp[e]; minX = Math.min(minX, v); maxX = Math.max(maxX, v); mean += v; if (v < 0.1) voidF++; if (v > 0.9) solidF++; }
      mean /= N; voidF /= N; solidF /= N;
      let worstJump = 0; for (let i = 11; i < h.length; i++) { const j = (h[i].c - h[i - 1].c) / Math.max(1e-30, h[i - 1].c); worstJump = Math.max(worstJump, j); }
      let volErr = 0; for (const it of h) volErr = Math.max(volErr, Math.abs(it.vol - P.vf));
      r.nCells = N; r.loops = h.length;
      r.cDropPct = +(100 * (1 - h[h.length - 1].c / h[0].c)).toFixed(1);
      r.volFinal = +mean.toFixed(3); r.volErr = +volErr.toFixed(4);
      r.voidFrac = +voidF.toFixed(3); r.solidFrac = +solidF.toFixed(3);
      r.worstJumpPct = +(100 * worstJump).toFixed(2);
      r.checks = {
        corrio: N > 30 && h.length > 5,
        compliance_baja: h[h.length - 1].c < h[0].c && worstJump < 0.02,
        volumen_ok: volErr < 0.03,
        material_vaciado: voidF > 0.1,
        densidades_ok: minX >= -1e-9 && maxX <= 1 + 1e-9,
      };
      r.pass = Object.values(r.checks).every(Boolean);
    } catch (e) { r.pass = false; r.fatal = String(e && e.message || e).slice(0, 300); }
    results.push(r);
    console.log(`${r.pass ? '✓' : '✗'} ${r.name}  | cDrop ${r.cDropPct ?? '?'}% · vol ${r.volFinal ?? '?'}(±${r.volErr ?? '?'}) · void ${r.voidFrac ?? '?'} · ${r.nCells ?? '?'} celdas · ${r.ms ?? '?'}ms${r.fatal ? ' · FATAL ' + r.fatal : ''}`);
  }
  const pass = results.filter(r => r.pass).length;
  console.log(`\n[FARM] ${pass}/${results.length} piezas PASARON`);
  writeFileSync('/tmp/generative-farm.json', JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 2);
})();
