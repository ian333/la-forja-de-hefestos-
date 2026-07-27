/**
 * LOTE DE MOLDES — la AUTOMATIZACIÓN de punta a punta (user: "estamos automatizando,
 * hazlo con varios STL y haces el molde"). Para CADA pieza:
 *   STL → eje de apertura §11 → veredicto DFM Kazmer §2.3 → moldMachine (arquitectura,
 *   cavidades, placas, cotización) → ELECCIÓN DE TORNILLO por carga (Shigley + FED-STD-H28)
 * y saca la tabla comparativa: el molde y su tornillería se ADAPTAN a cada figura.
 * Uso: node --import tsx scripts/mold-batch.cjs [test-parts/*.stl]
 */
const { readFileSync, readdirSync, writeFileSync } = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const S = (p) => path.join(ROOT, 'src', 'forja', 'mold', p);

function parseSTL(buf) {
  const tris = [];
  const ascii = buf.length > 5 && buf.subarray(0, 5).toString('ascii') === 'solid' && buf.subarray(0, 512).toString('ascii').includes('facet');
  if (ascii) {
    // OJO: los STL de OpenSCAD/Prusa traen notación científica con exponente NEGATIVO
    // ("7.77156e-016"). Una clase sin el '-' corta en "7.77156e" → parseFloat = NaN y
    // la dimensión sale NaN (así salieron gear y psu-cover con 132×NaN×103.6).
    const F = '[-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?';
    const re = new RegExp(`vertex\\s+(${F})\\s+(${F})\\s+(${F})`, 'g'); const v = []; let m;
    while ((m = re.exec(buf.toString('ascii')))) v.push([+m[1], +m[2], +m[3]]);
    for (let i = 0; i + 2 < v.length; i += 3) tris.push([v[i], v[i + 1], v[i + 2]]);
  } else {
    const n = buf.readUInt32LE(80);
    for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12;
      tris.push([0, 1, 2].map((k) => [buf.readFloatLE(o + k * 12), buf.readFloatLE(o + k * 12 + 4), buf.readFloatLE(o + k * 12 + 8)])); }
  }
  return tris;
}

(async () => {
  const DA = await import(S('draw-axis.ts'));
  const DFM = await import(S('dfm-mesh.ts'));
  const MM = await import(S('moldmachine.ts'));
  const PS = await import(S('mold-plano-set.ts'));
  const FA = await import(S('mold-fasteners.ts'));

  let files = process.argv.slice(2).filter((a) => a.endsWith('.stl'));
  if (!files.length) files = readdirSync(path.join(ROOT, 'test-parts')).filter((f) => f.endsWith('.stl')).map((f) => path.join(ROOT, 'test-parts', f));

  const rows = [];
  for (const f of files) {
    const nm = path.basename(f, '.stl');
    try {
      const buf = readFileSync(f);
      if (buf.length < 200) { console.log(`⏭  ${nm}: archivo vacío/inválido (${buf.length} B)`); continue; }
      const tris = parseSTL(buf);
      if (tris.length < 4) { console.log(`⏭  ${nm}: sin triángulos legibles`); continue; }
      // geometría bruta
      const P3 = new Float32Array(tris.length * 9); let vol = 0, area = 0;
      tris.forEach((t, i) => {
        for (let k = 0; k < 3; k++) { P3[i * 9 + k * 3] = t[k][0]; P3[i * 9 + k * 3 + 1] = t[k][1]; P3[i * 9 + k * 3 + 2] = t[k][2]; }
        const [a, b, c] = t;
        vol += (a[0] * (b[1] * c[2] - c[1] * b[2]) - a[1] * (b[0] * c[2] - c[0] * b[2]) + a[2] * (b[0] * c[1] - c[0] * b[1])) / 6;
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
      });
      vol = Math.abs(vol);
      const idx = new Uint32Array(tris.length * 3).map((_, i) => i);
      const wall = Math.min(4, Math.max(1, +(2 * vol / area).toFixed(2)));
      // eje de apertura (§11) + DFM medido en la malla (§2.3). pickDrawAxis prueba los
      // 3 ejes y devuelve {oriented, dfm, candidates} — el DFM ya viene del eje GANADOR.
      const choice = DA.pickDrawAxis({ positions: P3, indices: idx }, { wallMm: wall });
      const om = choice.oriented, dfm = choice.dfm;
      const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
      for (let i = 0; i < om.positions.length; i += 3) for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], om.positions[i + k]); mx[k] = Math.max(mx[k], om.positions[i + k]); }
      const dim = mx.map((v, k) => +(v - mn[k]).toFixed(1));
      // la MÁQUINA: arquitectura + cavidades + placas + cotización
      const ms = { name: nm, Lmm: dim[0], Wmm: dim[1], Hmm: dim[2], surfaceMm2: Math.round(area),
        volumeMm3: Math.round(vol), wallMm: wall, annualVolume: 500000, plastic: 'ABS', finish: 'SPI B-3' };
      const pkg = MM.moldMachine(ms);
      const asm = PS.packageToAssemblySpec(pkg);
      // LA ELECCIÓN DEL TORNILLO por carga, para esta pieza
      const fc = FA.fastenerPlan(asm, { half: 'cavity' }), fk = FA.fastenerPlan(asm, { half: 'core' });
      rows.push({ nm, dim, wall, tris: tris.length, moldable: dfm.moldable, nCav: pkg.recomendacion.nCav,
        arch: pkg.recomendacion.arch, molde: asm.widthMm, A: asm.plates.A, B: asm.plates.B,
        cav: `${fc.count}×${fc.desig}`, cavUtil: fc.utilPct, cavEng: `${fc.engagementMm}/${fc.availableMm}`, cavOK: fc.engagementOK,
        core: `${fk.count}×${fk.desig}`, coreUtil: fk.utilPct, kN: fc.totalKN, torque: fc.torqueNm });
      console.log(`✓ ${nm.padEnd(16)} ${String(dim[0]).padStart(6)}×${String(dim[1]).padStart(6)}×${String(dim[2]).padStart(5)}  pared ${String(wall).padStart(4)}  ${String(dfm.moldable).padEnd(15)} molde ⌀${asm.widthMm}  →  ${fc.count}×${fc.desig} (${fc.utilPct}%)`);
    } catch (e) { console.log(`❌ ${nm}: ${String(e.message || e).slice(0, 110)}`); }
  }

  // ── TABLA: la tornillería se ADAPTA a cada pieza ──
  console.log('\n╔══ LA MÁQUINA DE MOLDES · LOTE ' + '═'.repeat(78));
  console.log('║ ' + 'PIEZA'.padEnd(16) + 'DIMS'.padEnd(22) + 'DFM'.padEnd(16) + 'MOLDE'.padEnd(8) + 'CARGA'.padEnd(10) + 'TORNILLO A'.padEnd(14) + 'UTIL'.padEnd(7) + 'ENGRANE'.padEnd(11) + 'PAR');
  console.log('╟' + '─'.repeat(108));
  for (const r of rows) {
    const dfmIcon = r.moldable === 'si' ? '✓' : r.moldable === 'con-mecanismos' ? '⚠' : '✗';
    console.log('║ ' + r.nm.padEnd(16)
      + `${r.dim[0]}×${r.dim[1]}×${r.dim[2]}`.padEnd(22)
      + `${dfmIcon} ${r.moldable}`.padEnd(16)
      + `${r.molde}mm`.padEnd(8)
      + `${r.kN}kN`.padEnd(10)
      + r.cav.padEnd(14) + `${r.cavUtil}%`.padEnd(7)
      + `${r.cavEng}${r.cavOK ? '✓' : '✗'}`.padEnd(11) + `${r.torque}N·m`);
  }
  console.log('╚' + '═'.repeat(108));
  const sizes = [...new Set(rows.map((r) => r.cav.split('×')[1]))];
  console.log(`\n${rows.length} piezas · tornillos elegidos: ${sizes.join(', ')} — la tornillería SE ADAPTA (no es fija)`);
  writeFileSync('/tmp/mold-batch.json', JSON.stringify(rows, null, 2));
  console.log('→ /tmp/mold-batch.json');
})().catch((e) => { console.error('BATCH_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
