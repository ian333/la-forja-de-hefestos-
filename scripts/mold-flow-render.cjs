/**
 * EL LLENADO, RENDERIZADO CON DATOS — "haz las simulaciones y ve las imágenes para que
 * revises realmente que está fluyendo; añade datos porque mientras más datos haya más
 * errores puedes cachar" (user 2026-07-16).
 *
 * Construye la pieza REAL en el kernel (la receta del tupper, no un modelo mío), mide la
 * longitud de flujo DENTRO del hueco A/B (§5.5.5) y pinta el frente en SVG con los
 * números encima: L, %volumen, presión (Eq 5.19), γ̇ (Eq 5.21), v̄.
 *
 * Rinde DOS vistas del MISMO campo (si divergen, una miente):
 *   · PLANTA (corte en el fondo)  — se ve el frente radial saliendo del gate
 *   · ALZADO (corte vertical)     — se ve subir la pared
 *
 * Uso: node --import tsx scripts/mold-flow-render.cjs [outdir]
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');

const ROOT = path.resolve(__dirname, '..');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// rampa de color del frente: lo que entra primero = caliente/claro, lo último = oscuro
const rampa = (u) => {
  const c = [[255, 241, 168], [255, 176, 59], [232, 93, 42], [150, 32, 60], [46, 16, 60]];
  const t = Math.max(0, Math.min(0.999, u)) * (c.length - 1);
  const i = Math.floor(t), f = t - i, a = c[i], b = c[Math.min(c.length - 1, i + 1)];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
};

(async () => {
  const out = process.argv[2] || '/tmp/flow';
  mkdirSync(out, { recursive: true });
  const occtFactory = require(cjsGlue);
  const oc = await occtFactory({ wasmBinary: readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const TL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'timeline.ts'));
  const TP = await import(path.join(ROOT, 'src', 'forja', 'mold', 'parts', 'tupper.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const F = await import(path.join(ROOT, 'src', 'forja', 'mold', 'filling.ts'));

  // ── 1) LA PIEZA REAL, del kernel ─────────────────────────────────────────
  const P = TP.TUPPER_DEFAULT;
  const r = TL.rebuild(K, oc, TP.tupperRecipe().timeline);
  if (!r.shape) { console.error('sin sólido'); process.exit(1); }
  const mesh = K.tessellate(oc, r.shape, 0.4, 0.4);
  const q = FM.solidFromMesh(mesh);
  console.log(`PIEZA (del kernel): bbox ${JSON.stringify(Object.fromEntries(Object.entries(q.bbox).map(([k, v]) => [k, +v.toFixed(1)])))} · ${q.nTris} triángulos`);

  // ── 2) EL HUECO A/B → longitud de flujo ──────────────────────────────────
  const gate = FM.defaultGate(q);
  console.log(`GATE (centro, sobre la partición): (${gate.x.toFixed(1)}, ${gate.y.toFixed(1)}, ${gate.z.toFixed(1)})`);
  // CELDA: debe RESOLVER la pared (1.2 mm) — con 1.5 la pared se caía entre muestras y
  // el vaso medía 33 cc en vez de 50 (−34 %: justo la pared). Regla: celda ≤ 0.7 × pared.
  const cell = Math.min(0.8, P.wallMm * 0.6);
  const t0 = Date.now();
  const field = FL.measureFlowLength({
    x0: q.bbox.x0 - 1, y0: q.bbox.y0 - 1, z0: q.bbox.z0 - 1,
    x1: q.bbox.x1 + 1, y1: q.bbox.y1 + 1, z1: q.bbox.z1 + 1,
    cellMm: cell, gateMm: gate,
    inCavity: (x, y, z) => q.inside(x, y, z),        // ← EL MOLDE decide, no una fórmula
    wallMm: P.wallMm,
    expectVolumeMm3: r.measure?.volumeMm3,           // EL CRUCE que caza el voxelizado mentiroso
  });
  const front = FL.createFlowFront(field);
  console.log(`CAMPO L: ${field.nx}×${field.ny}×${field.nz} celdas de ${cell} mm · ${Date.now() - t0} ms`);
  console.log(`  L máx ${field.maxFlowLenMm} mm · volumen ${(field.volumeMm3 / 1000).toFixed(2)} cc · sin llenar ${field.unreachable} vóxeles`);
  console.log(`  CRUCE: kernel ${(r.measure.volumeMm3 / 1000).toFixed(2)} cc vs voxel ${(field.volumeMm3 / 1000).toFixed(2)} cc → ${(100 * Math.abs(field.volumeMm3 - r.measure.volumeMm3) / r.measure.volumeMm3).toFixed(1)}% de error`);
  for (const w of field.warnings) console.log(`  ⚠ ${w}`);

  // ── 3) LOS NÚMEROS DEL LIBRO (cap 5) ─────────────────────────────────────
  const melt = F.ABS_MG47;
  const wallM = P.wallMm / 1000;
  const vMean = F.convergeVelocity(melt, wallM);
  const gam = F.shearRatePowerLaw(vMean, wallM, melt.n);
  const mu = F.viscosityPowerLaw(melt, gam);
  const pMax = F.pressureDropSegment(melt, field.maxFlowLenMm / 1000, wallM, vMean) / 1e6;
  const tFill = (field.maxFlowLenMm / 1000) / vMean;
  console.log(`\nFÍSICA (Kazmer cap 5, ABS MG47 k=${melt.k} n=${melt.n}):`);
  console.log(`  v̄ diseño (Eq 5.23, iterada) ${vMean.toFixed(3)} m/s`);
  console.log(`  γ̇ (Eq 5.21) ${gam.toFixed(0)} 1/s · μ = k·γ̇^(n−1) = ${mu.toFixed(1)} Pa·s`);
  console.log(`  ΔP a L máx (Eq 5.19) ${pMax.toFixed(1)} MPa · t_llenado ${tFill.toFixed(3)} s`);

  // ── 4) RENDER: dos vistas del MISMO campo ────────────────────────────────
  const zPart = q.bbox.z0 + P.wallMm / 2;                 // el fondo del vaso
  const cyPieza = (q.bbox.y0 + q.bbox.y1) / 2;            // el EJE de la pieza (no y=0)
  const svgFor = (vista, frac) => {
    const st = front.frontLenMm(frac);
    const pNow = F.pressureDropSegment(melt, st / 1000, wallM, vMean) / 1e6;
    const W = 760, H = 620, PAD = 46;
    const planta = vista === 'planta';
    const uW = planta ? (q.bbox.x1 - q.bbox.x0) : (q.bbox.x1 - q.bbox.x0);
    const vH = planta ? (q.bbox.y1 - q.bbox.y0) : (q.bbox.z1 - q.bbox.z0);
    const sc = Math.min((W - 2 * PAD) / uW, (H - 2 * PAD - 90) / vH);
    const ox = PAD + ((W - 2 * PAD) - uW * sc) / 2, oy = 96;
    const px = (u) => ox + (u - (planta ? q.bbox.x0 : q.bbox.x0)) * sc;
    const py = (v) => planta ? oy + (v - q.bbox.y0) * sc : oy + (q.bbox.z1 - v) * sc;
    const rows = [];
    // recorre los vóxeles del corte
    for (let k = 0; k < field.nz; k++) for (let j = 0; j < field.ny; j++) for (let i = 0; i < field.nx; i++) {
      const t = field.idx(i, j, k);
      if (!field.cavity[t]) continue;
      const x = field.x0 + (i + 0.5) * cell, y = field.y0 + (j + 0.5) * cell, z = field.z0 + (k + 0.5) * cell;
      if (planta) { if (Math.abs(z - zPart) > cell / 2) continue; }
      // el corte va por el EJE de la pieza, no por y=0: el tupper vive en y∈[0,140] y su
      // centro esta en 70. Cortar en y=0 daba el BORDE exterior → lamina vacia.
      else { if (Math.abs(y - cyPieza) > cell / 2) continue; }
      const L = field.flowLenMm[t];
      const lleno = Number.isFinite(L) && L <= st;
      // LLENO = rampa por su L (lo que entro primero, mas claro). VACIO = gris azulado
      // apagado, para que el FRENTE se lea como una linea. ROJO = nunca se llena.
      const col = !Number.isFinite(L) ? '#ff3b30' : (lleno ? rampa(L / Math.max(1e-6, field.maxFlowLenMm)) : '#232c3d');
      const a = planta ? x : x, b = planta ? y : z;
      rows.push(`<rect x="${(px(a) - sc * cell / 2).toFixed(2)}" y="${(py(b) - sc * cell / 2).toFixed(2)}" width="${(sc * cell + 0.6).toFixed(2)}" height="${(sc * cell + 0.6).toFixed(2)}" fill="${col}"${lleno ? '' : ' opacity="0.85"'}/>`);
    }
    const gx = px(gate.x), gy = planta ? py(gate.y) : py(gate.z);
    // OJO: la clave iba a x=26 y el valor a x=250 con text-anchor=end → se ENCIMABAN
    // (la clave 'μ = k·γ̇^(n−1) · t_llenado' mide mas de 224 px). Valor a la derecha del todo.
    const dato = (i, k, v) => `<text x="26" y="${i}" font-family="ui-monospace,monospace" font-size="12.5" fill="#8fa3bf">${esc(k)}</text><text x="${W - 26}" y="${i}" font-family="ui-monospace,monospace" font-size="12.5" fill="#eaf2ff" text-anchor="end">${esc(v)}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#0b0f16"/>
<text x="26" y="30" font-family="ui-monospace,monospace" font-size="15" fill="#eaf2ff">LLENADO · ${esc(planta ? 'PLANTA (corte en el fondo)' : 'ALZADO (corte y=0)')} · ${(100 * frac).toFixed(0)}% del volumen</text>
<text x="26" y="50" font-family="ui-monospace,monospace" font-size="11.5" fill="#5d7290">Vaso ⌀${P.diaMm}×${P.heightMm} pared ${P.wallMm} · PP · L medida del HUECO A/B (§5.5.5), sin fórmula por figura</text>
${rows.join('')}
<circle cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="5" fill="none" stroke="#57e6a8" stroke-width="2"/>
<text x="${(gx + 9).toFixed(1)}" y="${(gy - 7).toFixed(1)}" font-family="ui-monospace,monospace" font-size="11" fill="#57e6a8">GATE</text>
<g transform="translate(0,${H - 118})">
${dato(16, 'frente L', `${st.toFixed(1)} / ${field.maxFlowLenMm} mm`)}
${dato(34, 'volumen llenado', `${(front.volumeMm3 * frac / 1000).toFixed(2)} / ${(front.volumeMm3 / 1000).toFixed(2)} cc`)}
${dato(52, 'ΔP frente (Eq 5.19)', `${pNow.toFixed(1)} / ${pMax.toFixed(1)} MPa`)}
${dato(70, 'v̄ (Eq 5.23) · γ̇ (Eq 5.21)', `${vMean.toFixed(2)} m/s · ${gam.toFixed(0)} 1/s`)}
${dato(88, 'μ = k·γ̇^(n−1) · t_llenado', `${mu.toFixed(0)} Pa·s · ${tFill.toFixed(3)} s`)}
${dato(106, 'sin llenar (short shot)', `${field.unreachable} vóxeles`)}
</g></svg>`;
  };

  const shots = [];
  for (const vista of ['planta', 'alzado']) {
    for (const frac of [0.15, 0.4, 0.7, 1.0]) {
      const f = path.join(out, `flow-${vista}-${String(Math.round(frac * 100)).padStart(3, '0')}.svg`);
      writeFileSync(f, svgFor(vista, frac));
      shots.push(f);
    }
  }
  console.log(`\n${shots.length} vistas → ${out}`);
  for (const f of [0.15, 0.4, 0.7, 1.0]) {
    console.log(`  ${(100 * f).toFixed(0).padStart(3)}% volumen → frente L=${front.frontLenMm(f).toFixed(1)} mm · ΔP ${(F.pressureDropSegment(melt, front.frontLenMm(f) / 1000, wallM, vMean) / 1e6).toFixed(1)} MPa`);
  }
  writeFileSync(path.join(out, 'flow.json'), JSON.stringify({
    bbox: q.bbox, gate, maxFlowLenMm: field.maxFlowLenMm, volumeCc: field.volumeMm3 / 1000,
    unreachable: field.unreachable, vMean, shearRate: gam, muPaS: mu, pMaxMPa: pMax, tFillS: tFill,
  }, null, 2));
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
