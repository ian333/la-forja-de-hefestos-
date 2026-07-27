/**
 * HOJA DE CONTACTO DEL LLENADO — el instrumento que me faltaba.
 * ============================================================================
 * "necesitas más info en lo visual, ahí es donde estás fallando… eres muy malo cazando
 *  errores si no hay info" (user 2026-07-16). Es exacto, y ya me cachó dos veces: dije
 * "se ve el núcleo redondo" mirando un borrón naranja, y no vi el alzado VACÍO hasta que
 * los números me lo gritaron.
 *
 * El problema no eran los pixeles: era mirar UNA vista y juzgarla a ojo. Un error se
 * esconde en un ángulo y SALTA en otro. Esta hoja pone, del MISMO estado:
 *   · PLANTA (z del fondo)   — el frente saliendo del gate + las esquinas R20
 *   · ALZADO (corte por el eje) — la pared subiendo + el LABIO
 *   · PERFIL (corte 90°)     — si planta y perfil no cuadran, uno miente
 *   · L(t) y ΔP(t)           — la curva: un frente que salta se ve como escalón
 * más los números encima (§5.5.5 + cap 5) y los AVISOS del campo.
 *
 * El campo viene del VÓXEL, no de la superficie: el cruce de los dos caminos demostró
 * que el vóxel mide bien (137.95 ≈ radio+alto) y la superficie zigzaguea 85% por malla
 * gruesa. Se pinta lo que MIDE BIEN.
 *
 * Uso: node --import tsx scripts/flow-sheet.cjs [outdir]
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
const rampa = (u) => {
  const c = [[255, 241, 168], [255, 176, 59], [232, 93, 42], [150, 32, 60], [46, 16, 60]];
  const t = Math.max(0, Math.min(0.999, u)) * (c.length - 1);
  const i = Math.floor(t), f = t - i, a = c[i], b = c[Math.min(c.length - 1, i + 1)];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
};

(async () => {
  const out = process.argv[2] || '/tmp/sheet';
  mkdirSync(out, { recursive: true });
  const oc = await require(cjsGlue)({ wasmBinary: readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const TL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'timeline.ts'));
  const TP = await import(path.join(ROOT, 'src', 'forja', 'mold', 'parts', 'tupper.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const F = await import(path.join(ROOT, 'src', 'forja', 'mold', 'filling.ts'));

  // ── EL TUPPER REAL (con labio, esquinas R20) ─────────────────────────────
  const P = TP.TUPPER_DEFAULT;
  const r = TL.rebuild(K, oc, TP.tupperRealRecipe().timeline);
  if (!r.shape) { console.error('sin sólido'); process.exit(1); }
  const mesh = K.tessellate(oc, r.shape, 0.25, 0.25);
  const q = FM.solidFromMesh(mesh);
  const gate = FM.defaultGate(q);
  const cell = Math.min(0.9, P.wallMm * 0.7);
  console.log(`TUPPER REAL ${P.lenMm}×${P.widMm}×${P.heightMm} · labio +${P.lipOutMm} · esquinas R${P.cornerRMm}`);
  console.log(`  bbox ${r.measure.bbox.join(' × ')} · vol ${(r.measure.volumeMm3 / 1000).toFixed(2)} cc · ${mesh.indices.length / 3} tri`);
  console.log(`  gate (${gate.x.toFixed(1)}, ${gate.y.toFixed(1)}, ${gate.z.toFixed(2)}) · celda ${cell} mm`);

  const t0 = Date.now();
  const field = FL.measureFlowLength({
    x0: q.bbox.x0 - 1, y0: q.bbox.y0 - 1, z0: q.bbox.z0 - 1,
    x1: q.bbox.x1 + 1, y1: q.bbox.y1 + 1, z1: q.bbox.z1 + 1,
    cellMm: cell, gateMm: gate, inCavity: (x, y, z) => q.inside(x, y, z),
    wallMm: P.wallMm, expectVolumeMm3: r.measure.volumeMm3,
  });
  const front = FL.createFlowFront(field);
  console.log(`  campo ${field.nx}×${field.ny}×${field.nz} · L máx ${field.maxFlowLenMm} mm · ${(field.volumeMm3 / 1000).toFixed(2)} cc · ${Date.now() - t0} ms`);
  console.log(`  CRUCE kernel ${(r.measure.volumeMm3 / 1000).toFixed(2)} cc vs vóxel ${(field.volumeMm3 / 1000).toFixed(2)} cc → ${(100 * Math.abs(field.volumeMm3 - r.measure.volumeMm3) / r.measure.volumeMm3).toFixed(1)}%`);
  for (const w of field.warnings) console.log(`  ⚠ ${w}`);

  const melt = F.ABS_MG47, wallM = P.wallMm / 1000;
  const vMean = F.convergeVelocity(melt, wallM);
  const gam = F.shearRatePowerLaw(vMean, wallM, melt.n);
  const mu = F.viscosityPowerLaw(melt, gam);
  const pAt = (Lmm) => F.pressureDropSegment(melt, Lmm / 1000, wallM, vMean) / 1e6;

  // ── §5.5.5 EN NÚMEROS: ¿el frente llega DESIGUAL? ────────────────────────
  // Esto es lo que las 3 vistas destaparon a ojo (perfil con las paredes llenas y alzado
  // con ellas vacías, del MISMO estado) y que parecía un bug. NO lo era: la pieza es
  // RECTANGULAR, así que el fundido llega ANTES al lado corto. Un cilindro nunca lo habría
  // mostrado. Medirlo lo convierte de "se ve raro" en el dato que manda el §5.5.5.
  const Lat = (x, y, z) => {
    const i = Math.round((x - field.x0) / cell - .5), j = Math.round((y - field.y0) / cell - .5), k = Math.round((z - field.z0) / cell - .5);
    return field.flowLenMm[field.idx(i, j, k)];
  };
  const zBoca = q.bbox.z1 - P.lipHMm;
  const lCorto = Lat((q.bbox.x0 + q.bbox.x1) / 2, q.bbox.y1 - 1, zBoca);
  const lLargo = Lat(q.bbox.x1 - 1, (q.bbox.y0 + q.bbox.y1) / 2, zBoca);
  const lEsq = Lat(q.bbox.x1 - 14, q.bbox.y1 - 14, zBoca);
  const desbal = Number.isFinite(lCorto) && lCorto > 0 ? (100 * (lLargo - lCorto) / lCorto) : 0;
  console.log(`  §5.5.5 · L a la boca: corto ${lCorto?.toFixed(1)} · largo ${lLargo?.toFixed(1)} · esquina ${lEsq?.toFixed(1)} mm → desbalance ${desbal.toFixed(0)}%`);

  // ── LA HOJA: 3 cortes del MISMO estado + curvas + datos ──────────────────
  const cxP = (q.bbox.x0 + q.bbox.x1) / 2, cyP = (q.bbox.y0 + q.bbox.y1) / 2;
  const zFondo = q.bbox.z0 + P.wallMm / 2;
  const panel = (vista, frac, ox, oy, w, h) => {
    // EL FRENTE ES ISO-RESISTENCIA, no iso-L. Pintar por L decía "lo cercano se llena
    // primero" — falso: el fundido corre por donde gasta menos presión (Eq 5.22). Con L,
    // dos brazos de la misma longitud y distinto espesor iban PAREJOS; con resistencia,
    // el grueso va 6 mm adelante. Eso es RACE TRACKING y es lo que hay que ver.
    const fr = front.frontAt(frac);
    // eje u,v de cada corte
    const cfg = {
      planta: { u: [q.bbox.x0, q.bbox.x1], v: [q.bbox.y0, q.bbox.y1], t: `PLANTA · z=${zFondo.toFixed(1)} (el fondo)` },
      alzado: { u: [q.bbox.x0, q.bbox.x1], v: [q.bbox.z0, q.bbox.z1], t: `ALZADO · corte y=${cyP.toFixed(0)}` },
      perfil: { u: [q.bbox.y0, q.bbox.y1], v: [q.bbox.z0, q.bbox.z1], t: `PERFIL · corte x=${cxP.toFixed(0)}` },
    }[vista];
    const uW = cfg.u[1] - cfg.u[0], vH = cfg.v[1] - cfg.v[0];
    const sc = Math.min((w - 16) / uW, (h - 30) / vH);
    const px = (u) => ox + 8 + (u - cfg.u[0]) * sc;
    const py = (v) => vista === 'planta' ? oy + 22 + (v - cfg.v[0]) * sc : oy + 22 + (cfg.v[1] - v) * sc;
    // ── EL ACERO VA EN EL CORTE — el plástico NO FLOTA ────────────────────
    // "¿estás inyectando en el aire? no puede ir una pieza flotando… no es placa A y B"
    // (user 2026-07-16). Tenía razón: yo pintaba SOLO el hueco sobre fondo negro. Un corte
    // de molde sin acero no deja ver lo único que importa — que el HUECO sea el correcto.
    // Y el metal de adentro del tupper NO es aire: es el NÚCLEO (placa B), lo que forma
    // el interior. El fundido entra en el hueco ENTRE el núcleo (B) y la cavidad (A).
    // La partición va en la BOCA: arriba de ella, placa A; el núcleo baja por dentro.
    const zPart = q.bbox.z1 - P.lipHMm;                     // la boca = plano de partición
    const rects = [];
    for (let k = 0; k < field.nz; k++) for (let j = 0; j < field.ny; j++) for (let i = 0; i < field.nx; i++) {
      const t = field.idx(i, j, k);
      const x = field.x0 + (i + .5) * cell, y = field.y0 + (j + .5) * cell, z = field.z0 + (k + .5) * cell;
      let a, b;
      if (vista === 'planta') { if (Math.abs(z - zFondo) > cell / 2) continue; a = x; b = y; }
      else if (vista === 'alzado') { if (Math.abs(y - cyP) > cell / 2) continue; a = x; b = z; }
      else { if (Math.abs(x - cxP) > cell / 2) continue; a = y; b = z; }
      let col;
      if (field.cavity[t]) {
        const R = field.resistance[t];
        // COLOR por resistencia = el ORDEN REAL de llegada. Lo llenado se pinta con su
        // lugar en la fila (claro = entró primero); lo que falta, apagado.
        col = !Number.isFinite(R) ? '#ff3b30'
          : (R <= fr.resistance ? rampa(R / Math.max(1e-6, field.maxResistance)) : '#232c3d');
      } else {
        // NO es plástico ⇒ es ACERO. ¿De qué mitad?
        // Si su columna tiene plástico ABAJO (el fondo del tupper), está DENTRO de la
        // pieza ⇒ es el NÚCLEO (placa B, lo que forma el interior). Si no, es cavidad (A).
        let fondoDebajo = false;
        for (let kk = 0; kk < k; kk++) if (field.cavity[field.idx(i, j, kk)]) { fondoDebajo = true; break; }
        const dentroPieza = fondoDebajo && z < zPart;
        col = dentroPieza ? '#7b8aa3' : (z >= zPart ? '#59657c' : '#455267');   // núcleo B · lado A · cavidad A
      }
      rects.push(`<rect x="${(px(a) - sc * cell / 2).toFixed(2)}" y="${(py(b) - sc * cell / 2).toFixed(2)}" width="${(sc * cell + .5).toFixed(2)}" height="${(sc * cell + .5).toFixed(2)}" fill="${col}"/>`);
    }
    // la LÍNEA DE PARTICIÓN: donde A y B se separan
    if (vista !== 'planta') rects.push(`<line x1="${px(cfg.u[0]).toFixed(1)}" y1="${py(zPart).toFixed(1)}" x2="${px(cfg.u[1]).toFixed(1)}" y2="${py(zPart).toFixed(1)}" stroke="#3ce0e0" stroke-width="1" stroke-dasharray="4 3"/>`);
    const gu = vista === 'planta' ? px(gate.x) : vista === 'alzado' ? px(gate.x) : px(gate.y);
    const gv = vista === 'planta' ? py(gate.y) : py(gate.z);
    // EL MOLDE ES ACERO MACIZO CON UN HUECO — no una pieza flotando en negro. El dominio
    // del vóxel termina 1 mm afuera de la pieza (más sería tiempo tirado: ahí no hay
    // fundido que medir), así que la CAVIDAD que la rodea se pinta como FONDO del panel.
    // Sin esto el corte miente por omisión: parecía que se inyecta en el aire.
    const zP = vista === 'planta' ? null : py(zPart);
    const fondo = vista === 'planta'
      ? `<rect x="${ox + 8}" y="${oy + 22}" width="${(w - 16).toFixed(1)}" height="${(h - 30).toFixed(1)}" fill="#455267"/>`
      : `<rect x="${ox + 8}" y="${oy + 22}" width="${(w - 16).toFixed(1)}" height="${(zP - oy - 22).toFixed(1)}" fill="#59657c"/>` +
        `<rect x="${ox + 8}" y="${zP.toFixed(1)}" width="${(w - 16).toFixed(1)}" height="${(oy + h - 8 - zP).toFixed(1)}" fill="#455267"/>`;
    return `<text x="${ox + 8}" y="${oy + 14}" font-family="ui-monospace,monospace" font-size="11" fill="#8fa3bf">${esc(cfg.t)}</text>
${fondo}${rects.join('')}<circle cx="${gu.toFixed(1)}" cy="${gv.toFixed(1)}" r="3.5" fill="none" stroke="#57e6a8" stroke-width="1.6"/>`;
  };

  // curva L(t) y ΔP(t) — un frente que SALTA se ve como escalón
  const curva = (ox, oy, w, h) => {
    const N = 60, pts = [], pps = [];
    for (let i = 0; i <= N; i++) {
      const f = i / N, L = front.frontAt(f).lenMaxMm;
      pts.push(`${(ox + 8 + f * (w - 16)).toFixed(1)},${(oy + h - 12 - (L / field.maxFlowLenMm) * (h - 34)).toFixed(1)}`);
      pps.push(`${(ox + 8 + f * (w - 16)).toFixed(1)},${(oy + h - 12 - (pAt(L) / Math.max(1e-6, pAt(field.maxFlowLenMm))) * (h - 34)).toFixed(1)}`);
    }
    return `<text x="${ox + 8}" y="${oy + 14}" font-family="ui-monospace,monospace" font-size="11" fill="#8fa3bf">L(%vol) ámbar · ΔP(%vol) azul — un frente que SALTA se ve como escalón</text>
<polyline points="${pts.join(' ')}" fill="none" stroke="#f2c14e" stroke-width="1.8"/>
<polyline points="${pps.join(' ')}" fill="none" stroke="#5aa9e6" stroke-width="1.4" stroke-dasharray="3 2"/>`;
  };

  const W = 1180, H = 900;
  const dato = (i, k, v, warn) => `<text x="20" y="${i}" font-family="ui-monospace,monospace" font-size="12" fill="${warn ? '#ff6b6b' : '#8fa3bf'}">${esc(k)}</text><text x="${W - 20}" y="${i}" font-family="ui-monospace,monospace" font-size="12" fill="${warn ? '#ff6b6b' : '#eaf2ff'}" text-anchor="end">${esc(v)}</text>`;
  const hoja = (frac) => {
    const st = front.frontAt(frac).lenMaxMm;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#0b0f16"/>
<text x="20" y="26" font-family="ui-monospace,monospace" font-size="15" fill="#eaf2ff">LLENADO · TUPPER ${P.lenMm}×${P.widMm}×${P.heightMm} · labio +${P.lipOutMm} · esquinas R${P.cornerRMm} · PP — ${(100 * frac).toFixed(0)}% del volumen</text>
<text x="20" y="45" font-family="ui-monospace,monospace" font-size="11" fill="#5d7290">L medida del HUECO A/B por VÓXEL (§5.5.5) · 3 cortes del MISMO estado: si no cuadran, uno miente</text>
<g font-family="ui-monospace,monospace" font-size="10.5">
<rect x="700" y="34" width="11" height="11" fill="#7b8aa3"/><text x="716" y="44" fill="#8fa3bf">NÚCLEO (B) — forma el interior</text>
<rect x="900" y="34" width="11" height="11" fill="#455267"/><text x="916" y="44" fill="#8fa3bf">CAVIDAD (A) — forma el exterior</text>
<rect x="1105" y="34" width="11" height="11" fill="#ff8b3b"/><text x="1121" y="44" fill="#8fa3bf">fundido (color = orden de llegada)</text>
</g>
${panel('planta', frac, 10, 58, 380, 330)}
${panel('alzado', frac, 400, 58, 380, 330)}
${panel('perfil', frac, 790, 58, 380, 330)}
${curva(10, 400, 1160, 160)}
<g transform="translate(0,600)">
${dato(16, 'L recorrida / L máx', `${st.toFixed(1)} / ${field.maxFlowLenMm} mm`)}
${dato(-4, 'el frente avanza por RESISTENCIA (Eq 5.22)', `no por cercanía — por eso el race tracking se VE`)}
${dato(36, 'volumen llenado', `${(front.volumeMm3 * frac / 1000).toFixed(2)} / ${(front.volumeMm3 / 1000).toFixed(2)} cc`)}
${dato(56, 'ΔP frente / total (Eq 5.19)', `${pAt(st).toFixed(1)} / ${pAt(field.maxFlowLenMm).toFixed(1)} MPa`)}
${dato(76, 'razón L/T', `${(field.maxFlowLenMm / P.wallMm).toFixed(0)} : 1`, field.maxFlowLenMm / P.wallMm > 200)}
${dato(96, 'v̄ (Eq 5.23) · γ̇ (Eq 5.21)', `${vMean.toFixed(2)} m/s · ${gam.toFixed(0)} 1/s`, gam > 50000)}
${dato(116, 'μ = k·γ̇^(n−1) · t llenado', `${mu.toFixed(0)} Pa·s · ${(field.maxFlowLenMm / 1000 / vMean).toFixed(3)} s`)}
${dato(136, 'CRUCE vóxel vs kernel', `${(field.volumeMm3 / 1000).toFixed(2)} vs ${(r.measure.volumeMm3 / 1000).toFixed(2)} cc (${(100 * Math.abs(field.volumeMm3 - r.measure.volumeMm3) / r.measure.volumeMm3).toFixed(1)}%)`)}
${dato(156, 'sin llenar (short shot §5.5)', `${field.unreachable} vóxeles`, field.unreachable > 0)}
${dato(176, '§5.5.5 · L a la boca: corto | largo | esquina', `${lCorto?.toFixed(0)} | ${lLargo?.toFixed(0)} | ${lEsq?.toFixed(0)} mm`)}
${dato(196, '§5.5.5 · DESBALANCE del frente', `${desbal.toFixed(0)}% — el fundido llega ANTES al lado corto; la esquina, AL FINAL (ahí se atrapa el aire)`, desbal > 15)}
${field.warnings.map((w, i) => `<text x="20" y="${220 + i * 18}" font-family="ui-monospace,monospace" font-size="11" fill="#ff6b6b">⚠ ${esc(w.slice(0, 130))}</text>`).join('')}
</g></svg>`;
  };

  const fr = [0.1, 0.3, 0.6, 1.0];
  for (const f of fr) writeFileSync(path.join(out, `sheet-${String(Math.round(f * 100)).padStart(3, '0')}.svg`), hoja(f));
  console.log(`\n${fr.length} hojas → ${out}`);
  for (const f of fr) { const a = front.frontAt(f);
    console.log(`  ${(100 * f).toFixed(0).padStart(3)}% vol → L ${a.lenMaxMm.toFixed(1).padStart(6)} mm · resistencia ${a.resistance.toFixed(2).padStart(7)} · ΔP ${pAt(a.lenMaxMm).toFixed(1).padStart(5)} MPa`); }
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
