/**
 * INTAKE DE PIEZAS REALES DE INYECCIÓN — "ve y consigue piezas reales y tráelas".
 * ============================================================================
 * Piezas COMERCIALES nacidas para inyección (no diseños de impresión): cajas ABS
 * Hammond (1591/1551/1599/1593 — inyectadas en ABS de verdad, con su draft, sus
 * bosses y sus costillas de fábrica; los STEP los publica el fabricante).
 *
 * Para CADA sólido de cada STEP:
 *   importSTEP → sólidos (un enclosure trae caja+tapa) → teselar →
 *   eje de apertura §11 (pickDrawAxis) → DFM Kazmer §2.3 (moldeable/mecanismos) →
 *   moldMachine (arquitectura+cavidades+cotización) →
 *   CAMPO DE FLUJO (flowlen: vóxel, unreachable, L máx, ΔP ∫campo) ← la prueba
 *   de que el MOTOR DEL HITO mastica geometría ajena, no solo la nuestra.
 *
 * Salida: tabla + test-parts/inyeccion-reales/intake.json (telemetría del lote).
 * Uso: node --import tsx scripts/piezas-reales-intake.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'test-parts', 'inyeccion-reales');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');

(async () => {
  const oc = await require(cjsGlue)({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const DA = await import(path.join(ROOT, 'src', 'forja', 'mold', 'draw-axis.ts'));
  const MM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'moldmachine.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const MT = await import(path.join(ROOT, 'src', 'forja', 'verificacion', 'matricula.ts'));

  // OJO: el explorador quiere el ENUM (objeto emscripten), NO su .value numérico —
  // con el número devolvía el COMPOUND entero como "1 sólido" y el DFM analizaba
  // caja+tapa FUSIONADAS (cavidad sellada → "con-mecanismos" falso en las 4)
  const TopAbs_SOLID = oc.TopAbs_ShapeEnum.TopAbs_SOLID;
  const files = fs.readdirSync(DIR).filter((f) => /\.(stp|step)$/i.test(f));
  const out = [];
  for (const f of files) {
    console.log(`\n══ ${f} ══`);
    let shape;
    try {
      shape = K.importSTEP(oc, fs.readFileSync(path.join(DIR, f)));
    } catch (e) { console.log(`  ✗ import falló: ${String(e).slice(0, 120)}`); continue; }
    const solids = K.uniqueSubShapes(oc, shape, TopAbs_SOLID);
    console.log(`  sólidos: ${solids.length}`);
    let si = 0;
    for (const solid of solids) {
      const volMm3 = K.volume(oc, solid);
      if (volMm3 < 800) { si++; continue; }               // tornillitos/insertos: fuera
      const nm = `${f.replace(/\.(stp|step)$/i, '')}#${si++}`;
      // DEFLEXIÓN 0.1, no 0.3 (2026-08-05). El censo de matrículas encontró 5 mallas
      // rotas de 73 a deflexión 0.3, y DOS de ellas (1552C3BK#1, 1553D#1) sanan solas
      // al bajar a 0.1: la rotura era del TESELADO, no de la pieza. El DFM, moldMachine
      // y el campo de flujo llevaban tiempo corriendo sobre esas mallas.
      const mesh = K.tessellate(oc, solid, 0.1, 0.1);
      // eje de apertura + DFM del eje ganador (el pipeline del lote de STL)
      const idx2 = mesh.indices ?? new Uint32Array(mesh.positions.length / 3).map((_, i) => i);
      let area = 0;
      for (let t = 0; t < idx2.length; t += 3) {
        const a = idx2[t] * 3, b = idx2[t + 1] * 3, c = idx2[t + 2] * 3;
        const u = [mesh.positions[b] - mesh.positions[a], mesh.positions[b + 1] - mesh.positions[a + 1], mesh.positions[b + 2] - mesh.positions[a + 2]];
        const v = [mesh.positions[c] - mesh.positions[a], mesh.positions[c + 1] - mesh.positions[a + 1], mesh.positions[c + 2] - mesh.positions[a + 2]];
        area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
      }
      const wall = Math.min(4, Math.max(1, +(2 * volMm3 / area).toFixed(2)));
      const choice = DA.pickDrawAxis({ positions: mesh.positions, indices: idx2 }, { wallMm: wall });
      const dfm = choice.dfm;
      // bbox orientado
      const om = choice.oriented;
      const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
      for (let i = 0; i < om.positions.length; i += 3) for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], om.positions[i + k]); mx[k] = Math.max(mx[k], om.positions[i + k]);
      }
      const dim = mx.map((v, k) => +(v - mn[k]).toFixed(1));
      // la MÁQUINA
      const pkg = MM.moldMachine({ name: nm, Lmm: dim[0], Wmm: dim[1], Hmm: dim[2], surfaceMm2: Math.round(area),
        volumeMm3: Math.round(volMm3), wallMm: wall, annualVolume: 500000, plastic: 'ABS', finish: 'SPI B-3' });
      // EL CAMPO DE FLUJO sobre la pieza ORIENTADA (el motor del hito, geometría ajena)
      const q = FM.solidFromMesh({ positions: om.positions, indices: idx2 });
      const gate = FM.defaultGate(q);
      // celda ≤ pared/2 en general; para piezas CHICAS (<10 cc, los paneles planos de
      // 1.6 mm) celda pared/4 — el redondeo de media celda por cara infla ~20 % una
      // placa delgada, y en una pieza diminuta la celda fina es gratis
      let cell = volMm3 < 10000
        ? Math.max(0.3, Math.min(0.6, wall * 0.25))
        : Math.max(0.4, Math.min(1.0, wall * 0.45));
      // FASE: en una placa, ceil(espesor/celda) decide la inflación (la de 1 mm a
      // celda 0.3 = 3.33 capas → +19 %). La celda se AJUSTA a dividir exacto la
      // dimensión menor: capas enteras, inflación ~0 sin importar el corrimiento.
      const minDim = Math.min(...dim);
      if (minDim <= 5) cell = +(minDim / Math.max(3, Math.round(minDim / cell))).toFixed(4);
      const t0 = Date.now();
      const field = FL.measureFlowLength({
        x0: q.bbox.x0 - 2, y0: q.bbox.y0 - 2, z0: q.bbox.z0 - 1, x1: q.bbox.x1 + 2, y1: q.bbox.y1 + 2, z1: q.bbox.z1 + 1,
        cellMm: cell, gateMm: gate,
        inCavity: (x, y, z) => q.inside(x, y, z),
        wallMm: wall, meltN: 0.348, expectVolumeMm3: volMm3,
      });
      const volVox = field.volumeMm3;
      const errVol = +(100 * Math.abs(volVox - volMm3) / volMm3).toFixed(1);
      const unreachPct = +(100 * field.unreachable / Math.max(1, field.unreachable + Math.round(volVox / cell ** 3))).toFixed(1);
      const row = {
        pieza: nm, dimMm: dim, volCc: +(volMm3 / 1000).toFixed(2), wallEstMm: wall,
        moldeable: dfm.moldable, dfmScore: dfm.score ?? null,
        maquina: { arch: pkg.recomendacion.arch, nCav: pkg.recomendacion.nCav, viable: pkg.veredicto.viable, moldeUSD: Math.round(pkg.veredicto.precioMoldeUSD) },
        flujo: { cellMm: cell, LmaxMm: field.maxFlowLenMm, errVolPct: errVol, unreachable: field.unreachable, unreachPct, ms: Date.now() - t0 },
      };
      // ── LA MATRÍCULA: la malla se verifica ANTES de creerle a lo que se calculó
      //    sobre ella. chi por conteo, chi por geometría (Gauss-Bonnet), volumen con
      //    signo y quiralidad. Una malla incoherente invalida su propia fila.
      try {
        const mm = MT.matriculaDeMalla({ positions: mesh.positions, indices: idx2 });
        const co = MT.coherente(mm);
        row.matricula = {
          chi: mm.chi, genero: mm.genero, cerrada: mm.cerrada,
          volMm3: +mm.volumenConSigno.toFixed(2), quiral: +mm.quiralidad.toExponential(2),
          coherente: co.ok, problemas: co.problemas.map((x) => x.codigo),
        };
        if (!co.ok) console.log(`    ⚠ MALLA INCOHERENTE (${co.problemas.map((x) => x.codigo).join(', ')}) — lo de abajo se calculó sobre una malla rota`);
      } catch (e) { row.matricula = { error: String(e).slice(0, 80) }; }
      out.push(row);
      console.log(`  · ${nm}: ${dim.join('×')} · ${(volMm3 / 1000).toFixed(1)} cc · pared~${wall} · DFM ${dfm.moldable} · ${pkg.recomendacion.arch}×${pkg.recomendacion.nCav} $${Math.round(pkg.veredicto.precioMoldeUSD)} · flujo L=${field.maxFlowLenMm} err=${errVol}% muertos=${field.unreachable} (${row.flujo.ms} ms)`);
    }
  }
  fs.writeFileSync(path.join(DIR, 'intake.json'), JSON.stringify({ fecha: '2026-07-17', fuente: 'Hammond Mfg (STEP públicos del fabricante, cajas ABS inyectadas)', piezas: out }, null, 1));
  const okDFM = out.filter((r) => r.moldeable === 'si' || r.moldeable === true).length;
  const okFlow = out.filter((r) => r.flujo.errVolPct < 15 && r.flujo.unreachPct < 3).length;
  const okMalla = out.filter((r) => r.matricula && r.matricula.coherente).length;
  const rotas = out.filter((r) => r.matricula && r.matricula.coherente === false).map((r) => r.pieza);
  console.log(`\nLOTE: ${out.length} sólidos · DFM moldeable: ${okDFM} · flujo sano (err<15 %, muertos<3 %): ${okFlow}`);
  console.log(`MALLAS: ${okMalla}/${out.length} coherentes${rotas.length ? ` · ROTAS: ${rotas.join(', ')}` : ''}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: out.length >= 6 && okFlow >= out.length - 2, piezas: out.length, okDFM, okFlow, okMalla, rotas }));
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
