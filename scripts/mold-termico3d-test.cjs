/**
 * GATE del TÉRMICO 3D REAL (feedback user: "NO ME SIRVE EL 2D, el molde es 3D"):
 *   1. ISOSUPERFICIE (marching tetrahedra): esfera analítica r=12 → área ≈ 4πr² (±12%)
 *   2. DEPÓSITO CON FORMA: pieza sintética gruesa(12mm)+delgada(2mm) → tras la
 *      inyección, el acero sobre la zona GRUESA queda MÁS caliente (hot spot 3D)
 *   3. CONSERVACIÓN: la energía depositada ≈ Σ ρp·cp·ΔT·th·área de columna
 *   4. sliceAxis x/y/z: dimensiones correctas y el plano caliente contiene el pico
 * Uso: node --import tsx scripts/mold-termico3d-test.cjs
 */
const path = require('path');

const bezel = {
  name: 'Molde bezel laptop', code: 'MLD-BEZEL', widthMm: 381,
  plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
  cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
  cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 },
  ejectors: { type: 'pin', diaMm: 3, count: 20 },
  core: { widthMm: 240, material: 'AISI P20' },
  cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)', clampTons: 200, feed: 'hot-runner', nCav: 1,
};

let fails = 0;
const check = (name, cond, detail) => {
  console.log(` ${cond ? '✓' : '❌'} ${name} — ${detail}`);
  if (!cond) fails++;
};

// pieza sintética: bloque GRUESO 20×30×12 pegado a bloque DELGADO 20×30×2 (malla cruda)
function twoBoxMesh() {
  const pos = [];
  const idx = [];
  const box = (x0, x1, y0, y1, z0, z1) => {
    const base = pos.length / 3;
    const v = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
    for (const p of v) pos.push(...p);
    const q = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[1,2,6],[1,6,5],[3,0,4],[3,4,7]];
    for (const t of q) idx.push(base + t[0], base + t[1], base + t[2]);
  };
  box(0, 20, 0, 30, 0, 12);     // GRUESA
  box(20, 40, 0, 30, 0, 2);     // DELGADA
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

(async () => {
  const ISO = await import(path.resolve(__dirname, '..', 'src', 'lib', 'viz', 'isosurface.ts'));
  const TH = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-thermal-fdm.ts'));

  // ── 1) esfera analítica ──
  {
    const n = 44, cell = 1, r = 12, c = (n - 1) / 2;
    const f = new Float32Array(n * n * n);
    for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++)
      f[(k * n + j) * n + i] = r - Math.hypot(i - c, j - c, k - c);
    const m = ISO.isoSurface(f, n, n, n, 0, cell);
    const area = ISO.isoArea(m);
    const want = 4 * Math.PI * r * r;
    console.log(`esfera r=${r}: área iso ${area.toFixed(0)} vs 4πr² ${want.toFixed(0)} · ${(m.positions.length / 9).toFixed(0)} tris`);
    check('isosuperficie esfera ≈ 4πr² (±12%)', Math.abs(area - want) / want < 0.12, `${(100 * (area - want) / want).toFixed(1)}%`);
    check('normales unitarias', Math.abs(Math.hypot(m.normals[0], m.normals[1], m.normals[2]) - 1) < 1e-3, 'gradiente normalizado');
  }

  // ── 2+3) depósito con la FORMA de la pieza ──
  {
    const sim = TH.createThermalSim(bezel, { partMesh: twoBoxMesh() });
    const g = sim.thGrid;
    let thMax = 0, thThin = 1e9;
    for (let n = 0; n < g.thMm.length; n++) {
      if (g.thMm[n] > thMax) thMax = g.thMm[n];
      if (g.thMm[n] > 0.5 && g.thMm[n] < thThin) thThin = g.thMm[n];
    }
    console.log(`\nthGrid: máx ${thMax.toFixed(1)} mm · mín ${thThin.toFixed(1)} mm (pieza 12/2)`);
    check('espesor local MEDIDO: zona gruesa ~12 mm', Math.abs(thMax - 12) < 1.5, `${thMax.toFixed(1)}`);
    check('espesor local MEDIDO: zona delgada ~2 mm', Math.abs(thThin - 2) < 1.2, `${thThin.toFixed(1)}`);
    // una inyección (t=0 dispara el depósito) sin difusión apreciable
    const T0 = 60;
    sim.step(0.05);
    // busca el pico sobre cada mitad (gruesa: x<centro de la huella)
    const cellMm = g.cellMm;
    let hotThick = 0, hotThin = 0;
    for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
      const m = j * g.nx + i;
      if (g.thMm[m] <= 0) continue;
      let hot = 0;                                              // barre el rango z de la columna
      for (let zq = 290; zq <= 320; zq += cellMm / 2) hot = Math.max(hot, sim.sampleAt((i + 0.5) * cellMm, (j + 0.5) * cellMm, zq));
      if (g.thMm[m] > 6) hotThick = Math.max(hotThick, hot);
      else hotThin = Math.max(hotThin, hot);
    }
    console.log(`tras inyección: acero sobre GRUESA ${hotThick.toFixed(1)} °C vs DELGADA ${hotThin.toFixed(1)} °C`);
    check('HOT SPOT 3D: acero sobre zona gruesa MÁS caliente', hotThick > hotThin + 3, `Δ=${(hotThick - hotThin).toFixed(1)} °C`);
    check('la zona delgada también se calentó (>60.5 °C)', hotThin > 60.5, `${hotThin.toFixed(1)}`);
    // conservación de energía del depósito (ΔT total del campo vs energía inyectada)
    let dTsum = 0;
    for (let k = 0; k < sim.nz; k++) for (let j = 0; j < sim.ny; j++) for (let i = 0; i < sim.nx; i++)
      dTsum += sim.sampleAt((i + 0.5) * cellMm, (j + 0.5) * cellMm, (k + 0.5) * cellMm) - T0;
    const cellV = Math.pow(cellMm / 1000, 3);
    const eField = dTsum * 7800 * 460 * cellV;                      // J en el acero
    let eIn = 0;
    for (let n = 0; n < g.thMm.length; n++) if (g.thMm[n] > 0)
      eIn += 1050 * 2345 * (239 - 60) * (g.thMm[n] / 1000) * Math.pow(cellMm / 1000, 2);
    console.log(`energía: campo ${eField.toFixed(0)} J vs inyectada ${eIn.toFixed(0)} J`);
    check('CONSERVACIÓN de energía (±15%)', Math.abs(eField - eIn) / eIn < 0.15, `${(100 * (eField - eIn) / eIn).toFixed(1)}%`);
  }

  // ── 4) sliceAxis ──
  {
    const sim = TH.createThermalSim(bezel, { partMesh: twoBoxMesh() });
    sim.step(2);
    const sx = sim.sliceAxis('x', 0.5), sy = sim.sliceAxis('y', 0.5), sz = sim.sliceAxis('z', 0.55);
    console.log(`\nslices: x→${sx.nu}×${sx.nv} @${sx.posMm}mm [${sx.minC}-${sx.maxC}] · y→${sy.nu}×${sy.nv} · z→${sz.nu}×${sz.nv}`);
    check('slice X = plano D×H', sx.nu === sim.ny && sx.nv === sim.nz, `${sx.nu}×${sx.nv}`);
    check('slice Y = plano W×H', sy.nu === sim.nx && sy.nv === sim.nz, `${sy.nu}×${sy.nv}`);
    check('slice Z = plano W×D', sz.nu === sim.nx && sz.nv === sim.ny, `${sz.nu}×${sz.nv}`);
    check('el corte central VE el calor (max > 61 °C)', sx.maxC > 61 || sy.maxC > 61, `${Math.max(sx.maxC, sy.maxC)}`);
  }

  console.log(fails ? `\n❌ ${fails} checks fallaron` : '\n✓ TÉRMICO 3D REAL: el calor entra con la FORMA de la pieza y se VE en 3D');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', e); process.exit(1); });
