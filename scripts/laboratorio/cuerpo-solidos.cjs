#!/usr/bin/env node
/**
 * EL CUERPO DEL LABORATORIO — los sólidos (orden 2026-11-05-lab-cuerpo, agente B)
 * ================================================================================
 * Toda la geometría sale de `src/forja/lab/cuerpo.ts` (disenarCuerpo().ops): aquí sólo se convierten las
 * operaciones (cajas, prismas, codos de revolución) en sólidos del kernel OCCT, por teja:
 *     (Σ sumas recortadas a la caja de la teja ∪ sumas libres) − Σ restas
 * y se escriben:
 *   · <salida>/stl/<teja>.stl   en su ORIENTACIÓN DE IMPRESIÓN (cubierta boca abajo; mínimo en z = 0)
 *   · <salida>/fmsh/<teja>.bin  en el marco del doc (FMSH, como scripts/precompute-banco-arco.cjs)
 * Antes mide la LRS en su STEP (bornera y ventiladores) y lo compara con lo que cuerpo.ts supone.
 * Al final revisa los voladizos de cada STL con dfm.classifyOverhangs (la K1, PETG) y estima el tiempo.
 * RONDA 2 (REGLAS.todoImprimible): también las PIEZAS SUELTAS por cama (d.camas): tapas de canal, grapas, remaches, tapa
 * de la columna, difusor y campana. Cada pieza se hace sola (sumas − restas, sin recorte); el FMSH de la cama las junta en
 * su lugar (marco del doc) y el STL las gira con cuerpo.rotarAbajo (su cara «abajo» a la cama) y las acomoda donde dice
 * d.camas[].acomodo. Al final: los triángulos de todas las FMSH (la vista del laboratorio a ≥ 50 fps).
 *
 *   cd /home/ian/forja-diag && node --import tsx scripts/laboratorio/cuerpo-solidos.cjs [salida] [teja|cama|tejas|piezas…]
 *   (salida por omisión: salidas-lab/cuerpo; sin nombres: todo)
 */
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'salidas-lab', 'cuerpo'));
const SOLO = process.argv.slice(3);
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const factory = require(cjsGlue);
const MM3_POR_S = 8;   // SUPUESTO (cuerpo.ts SUPUESTOS.IMPRESION): PETG en la K1 con viajes

function fmsh(m) {
  const nv = m.positions.length / 3, ni = m.indices.length;
  const buf = Buffer.alloc(16 + nv * 12 * 2 + ni * 4);
  buf.writeUInt32LE(0x48534d46, 0); buf.writeUInt32LE(1, 4); buf.writeUInt32LE(nv, 8); buf.writeUInt32LE(ni, 12);
  Buffer.from(m.positions.buffer, m.positions.byteOffset, m.positions.byteLength).copy(buf, 16);
  Buffer.from(m.normals.buffer, m.normals.byteOffset, m.normals.byteLength).copy(buf, 16 + nv * 12);
  Buffer.from(m.indices.buffer, m.indices.byteOffset, m.indices.byteLength).copy(buf, 16 + nv * 24);
  return buf;
}
function stlBinario(pos, idx, nombre) {
  const nT = idx.length / 3, buf = Buffer.alloc(84 + nT * 50);
  buf.write(`La Forja · laboratorio · ${nombre}`.slice(0, 79), 0, 'ascii');
  buf.writeUInt32LE(nT, 80);
  for (let t = 0; t < nT; t++) {
    const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.hypot(nx, ny, nz) || 1;
    const o = 84 + t * 50;
    buf.writeFloatLE(nx / L, o); buf.writeFloatLE(ny / L, o + 4); buf.writeFloatLE(nz / L, o + 8);
    for (let k = 0; k < 3; k++) { const v = idx[3 * t + k] * 3; buf.writeFloatLE(pos[v], o + 12 + 12 * k); buf.writeFloatLE(pos[v + 1], o + 16 + 12 * k); buf.writeFloatLE(pos[v + 2], o + 20 + 12 * k); }
  }
  return buf;
}

(async () => {
  const occt = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const cuerpo = await import(path.join(ROOT, 'src', 'forja', 'lab', 'cuerpo.ts'));
  const dfm = await import(path.join(ROOT, 'src', 'forja', 'mech', 'dfm.ts'));
  const oc = await factory({ wasmBinary: readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);
  mkdirSync(path.join(OUT, 'stl'), { recursive: true });
  mkdirSync(path.join(OUT, 'fmsh'), { recursive: true });

  // ── 1. la LRS en su STEP: dónde están de verdad la bornera y los ventiladores ─────────────────
  {
    const t0 = Date.now();
    const sh = occt.importSTEP(oc, readFileSync(path.join(ROOT, 'models', 'step', 'banco-arco', 'LRS-1200-3D.stp')));
    const sols = occt.solidsOf(oc, sh);
    const [ox, oy, oz] = cuerpo.LRS_STEP.origen;
    const aDoc = (p) => [p[0] + ox, oy - p[2], p[1] + oz];   // rotación propia rx = +90°: (x, y, z) → (x, −z, y)
    const filas = sols.map((s) => {
      const m = occt.tessellate(oc, s, 2, 0.8); const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], m.positions[i + k]); mx[k] = Math.max(mx[k], m.positions[i + k]); }
      const a = aDoc(mn), b = aDoc(mx);
      return { vol: occt.volume(oc, s), x: [Math.min(a[0], b[0]), Math.max(a[0], b[0])], y: [Math.min(a[1], b[1]), Math.max(a[1], b[1])], z: [Math.min(a[2], b[2]), Math.max(a[2], b[2])], dx: mx[0] - mn[0], dy: mx[1] - mn[1], dz: mx[2] - mn[2] };
    }).sort((p, q) => q.vol - p.vol);
    const f = (r) => `x ${r.x.map((v) => v.toFixed(1)).join('…')} · y ${r.y.map((v) => v.toFixed(1)).join('…')} · z ${r.z.map((v) => v.toFixed(1)).join('…')}`;
    console.log(`LRS-1200 (STEP, ${sols.length} sólidos, ${Date.now() - t0} ms) en el marco del doc:`);
    const vent = filas.filter((r) => Math.abs(r.dx - 20) < 2 && Math.abs(r.dz - 40) < 2);
    const ac = filas.find((r) => Math.abs(r.dz - 31.7) < 1.5 && r.x[0] < -100);
    const dc = filas.filter((r) => Math.abs(r.dz - 15) < 1 && Math.abs(r.dy - 20.5) < 1 && r.x[0] < -100);
    for (const r of vent) console.log(`  ventilador  ${f(r)}`);
    if (ac) console.log(`  bornera AC  ${f(ac)}  · centro y ${((ac.y[0] + ac.y[1]) / 2).toFixed(1)} z ${((ac.z[0] + ac.z[1]) / 2).toFixed(1)} · cuerpo.ts supone ${cuerpo.BORNE_AC.join(', ')}`);
    for (const r of dc) console.log(`  borne DC    ${f(r)}`);
    if (dc.length === 2) console.log(`  bornes DC: centro y ${((dc[0].y[0] + dc[1].y[1] + dc[1].y[0] + dc[0].y[1]) / 4).toFixed(1)} · cuerpo.ts supone ${cuerpo.BORNE_DC.join(', ')}`);
    sh.delete?.();
  }

  // ── 2. el diseño ────────────────────────────────────────────────────────────────────────────
  const t0 = Date.now();
  const d = cuerpo.disenarCuerpo();
  console.log(`\ndiseño: ${Date.now() - t0} ms · ${d.tejas.length} tejas · ${d.canales.filter((c) => c.ruta.modo === 'astar').length} canales ruteados`);
  // la extrusión va SIEMPRE a favor de la normal del plano (u×v): si va en contra, OCCT da un sólido al revés
  // (volumen negativo) y la unión lo trata como hueco. XY y YZ: normal +z/+x desde el menor; XZ: normal −y desde el mayor.
  const PRISMA = {
    XY: (a, b) => ({ origin: [0, 0, Math.min(a, b)], uDir: [1, 0, 0], vDir: [0, 1, 0] }),
    YZ: (a, b) => ({ origin: [Math.min(a, b), 0, 0], uDir: [0, 1, 0], vDir: [0, 0, 1] }),
    XZ: (a, b) => ({ origin: [0, Math.max(a, b), 0], uDir: [1, 0, 0], vDir: [0, 0, 1] }),
  };
  const forma = (o) => {
    if (o.t === 'caja') {
      const c = o.c, b = occt.makeBox(oc, c.x1 - c.x0, c.y1 - c.y0, c.z1 - c.z0);
      return occt.transformShape(oc, b, { translate: [c.x0, c.y0, c.z0] });
    }
    if (o.t === 'prisma') {
      return occt.extrudePolygon(oc, o.pts.map(([x, y]) => ({ x, y })), Math.abs(o.hasta - o.desde), PRISMA[o.plano](o.desde, o.hasta));
    }
    const pts = [{ x: o.r0, y: -o.h }, { x: o.r1, y: -o.h }, { x: o.r1, y: o.h }, { x: o.r0, y: o.h }];
    return occt.revolvePolygon(oc, pts, 90, { origin: o.centro, uDir: o.u, vDir: o.a }, { origin: o.centro, dir: o.a });
  };
  const lista = (xs) => { const L = new oc.TopTools_ListOfShape_1(); for (const x of xs) L.Append_1(x); return L; };
  const etapa = (t) => { if (process.env.CUERPO_DEBUG) console.error(`  · ${t}`); };
  const unirLista = (xs) => {
    const op = new oc.BRepAlgoAPI_Fuse_1(); op.SetArguments(lista([xs[0]])); op.SetTools(lista(xs.slice(1))); op.Build();
    const r = op.Shape(); op.delete?.(); return r;
  };
  // la unión en lista es la rápida; si el kernel truena (excepción de C++ en el WASM), se une de a una y se salta la que falle
  const unir = (xs, malas, notas) => {
    if (xs.length === 1) return xs[0];
    try { return unirLista(xs); } catch (e) {
      etapa('unión en lista falló: de a una');
      let acc = xs[0];
      for (let i = 1; i < xs.length; i++) { try { acc = occt.fuse(oc, acc, xs[i]); } catch (e2) { malas.push(`unión: ${notas ? notas[i] : i}`); } }
      return acc;
    }
  };
  const perfil = { ...cuerpo.PERFIL_K1 };
  const resumen = [];

  const quiere = (id, grupo) => !SOLO.length || SOLO.includes(id) || SOLO.includes(grupo);
  for (const t of d.tejas) {
    if (!quiere(t.id, 'tejas')) continue;
    const t1 = Date.now();
    const ops = d.ops[t.id];
    const malas = [];
    const mk = (o) => { try { const f = forma(o); const v = occt.volume(oc, f); if (!(v > 1e-6)) throw new Error(v < 0 ? `al revés (${v.toFixed(0)} mm³)` : 'vacío'); return f; } catch (e) { malas.push(`${o.nota || o.t}: ${String(e && e.message || e).slice(0, 60)}`); return null; } };
    etapa(`${t.id}: formas`);
    const opsS = ops.filter((o) => o.s > 0 && !o.libre), opsL = ops.filter((o) => o.s > 0 && o.libre);
    const sumas = opsS.map(mk), libres = opsL.map(mk).filter(Boolean);
    const notasS = opsS.map((o) => o.nota || o.t).filter((_, i) => sumas[i]);
    const sumasOk = sumas.filter(Boolean);
    const restas = ops.filter((o) => o.s < 0);
    const herr = restas.map(mk);
    if (!sumasOk.length) { console.log(`${t.id}: sin sumas`); continue; }
    if (process.env.CUERPO_DEBUG === '2') { const bb = (sh) => { const b = new oc.Bnd_Box_1(); oc.BRepBndLib.Add(sh, b, false); const a = b.CornerMin(), c2 = b.CornerMax(); return [a.X(), a.Y(), a.Z(), c2.X(), c2.Y(), c2.Z()].map((v) => +v.toFixed(1)); }; sumasOk.forEach((x, i) => etapa(`   suma ${notasS[i]}: ${bb(x)}`)); }
    etapa(`${t.id}: unir ${sumasOk.length}`);
    let cuerpoT = unir(sumasOk, malas, notasS);
    const c = t.caja, caja = occt.transformShape(oc, occt.makeBox(oc, c.x1 - c.x0, c.y1 - c.y0, c.z1 - c.z0), { translate: [c.x0, c.y0, c.z0] });
    const bbox = (sh) => { const b = new oc.Bnd_Box_1(); oc.BRepBndLib.Add(sh, b, false); const a = b.CornerMin(), c2 = b.CornerMax(); const r = [a.X(), a.Y(), a.Z(), c2.X(), c2.Y(), c2.Z()].map((v) => +v.toFixed(1)); b.delete?.(); return r; };
    etapa(`${t.id}: unión ${Math.round(occt.volume(oc, cuerpoT))} mm³ caja ${bbox(cuerpoT)} · recortar a la caja`);
    cuerpoT = occt.common(oc, cuerpoT, caja);
    etapa(`${t.id}: recortada ${Math.round(occt.volume(oc, cuerpoT))} mm³ caja ${bbox(cuerpoT)}`);
    etapa(`${t.id}: libres ${libres.length}`);
    if (libres.length) cuerpoT = unir([cuerpoT, ...libres], malas);
    etapa(`${t.id}: cortar ${herr.filter(Boolean).length}`);
    const { shape, reporte } = occt.cortarHerramientas(oc, cuerpoT, herr, { donde: `cuerpo ${t.id}`, etiquetas: restas.map((o) => o.nota || o.t) });
    etapa(`${t.id}: cortada ${Math.round(occt.volume(oc, shape))} mm³ caja ${bbox(shape)} · teselar`);
    const vol = occt.volume(oc, shape);
    // el mallador truena con caras degeneradas de las booleanas: otra deflexión, y si no, ShapeFix_Shape
    let m = null, malla = 'directa';
    for (const [lin, ang] of [[0.15, 0.35], [0.3, 0.5], [0.6, 0.8]]) { try { m = occt.tessellate(oc, shape, lin, ang); malla = `${lin}`; break; } catch (e) { etapa(`teselar ${lin} falló`); } }
    if (!m) {
      const fx = new oc.ShapeFix_Shape_2(shape, 1e-3); fx.Perform(new oc.Message_ProgressRange_1()); const sf = fx.Shape();
      for (const lin of [0.3, 0.6]) { try { m = occt.tessellate(oc, sf, lin, 0.6); malla = `ShapeFix ${lin}`; break; } catch (e) { etapa(`teselar tras ShapeFix ${lin} falló`); } }
    }
    if (!m) throw new Error(`${t.id}: no se pudo teselar`);
    writeFileSync(path.join(OUT, 'fmsh', `${t.id}.bin`), fmsh(m));
    // orientación de impresión
    const P = new Float32Array(m.positions.length);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < m.positions.length; i += 3) {
      let x = m.positions[i], y = m.positions[i + 1], z = m.positions[i + 2];
      if (t.impresion.rx === 180) { y = -y; z = -z; }
      P[i] = x; P[i + 1] = y; P[i + 2] = z;
      for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
    }
    if (t.id === 'mordazas') {   // las 4 mordazas viven en las 4 esquinas de la mesa: para imprimir se juntan al centro
      for (let i = 0; i < P.length; i += 3) { const sx = Math.sign(P[i]), sy = Math.sign(P[i + 1]); P[i] -= sx * 60; P[i + 1] -= sy * 60; }
      mn[0] = mn[1] = Infinity; mx[0] = mx[1] = -Infinity;
      for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 2; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
    }
    for (let i = 0; i < P.length; i += 3) { P[i] -= mn[0]; P[i + 1] -= mn[1]; P[i + 2] -= mn[2]; }
    // si la cara de imprimir quedó boca abajo, el triángulo invierte su orden (rx 180 es rotación propia: no)
    writeFileSync(path.join(OUT, 'stl', `${t.id}.stl`), stlBinario(P, m.indices, t.nombre));
    const rep = dfm.printabilityReport({ positions: P, indices: m.indices }, perfil);
    // dónde pide soporte (grupos de 20 mm, en el marco del doc) y el volumen que de verdad se extruye:
    // 3 perímetros (1.2 mm) sobre la superficie + 20 % de relleno en lo demás (SUPUESTO de laminado)
    const { cls } = dfm.classifyOverhangs({ positions: P, indices: m.indices }, perfil);
    const grupos = new Map(); let area = 0;
    for (let tt = 0; tt < m.indices.length / 3; tt++) {
      const ia = m.indices[3 * tt] * 3, ib = m.indices[3 * tt + 1] * 3, ic = m.indices[3 * tt + 2] * 3, Q = m.positions;
      const ux = Q[ib] - Q[ia], uy = Q[ib + 1] - Q[ia + 1], uz = Q[ib + 2] - Q[ia + 2], vx = Q[ic] - Q[ia], vy = Q[ic + 1] - Q[ia + 1], vz = Q[ic + 2] - Q[ia + 2];
      const A = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); area += A;
      if (cls[tt] !== 2) continue;
      const k = [0, 1, 2].map((j) => Math.round((Q[ia + j] + Q[ib + j] + Q[ic + j]) / 3 / 20) * 20).join(',');
      grupos.set(k, (grupos.get(k) || 0) + A);
    }
    const peores = [...grupos].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, A]) => `(${k}) ${A.toFixed(0)} mm²`);
    const vExt = Math.min(vol, area * 1.2 + 0.2 * Math.max(0, vol - area * 1.2));
    const fila = {
      teja: t.id, caja: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]].map((v) => +v.toFixed(1)), cabe: rep.fits,
      vol_cm3: +(vol / 1000).toFixed(1), extruido_cm3: +(vExt / 1000).toFixed(1), masa_g: +(vExt * 1.27e-3).toFixed(0), horas: +(vExt / MM3_POR_S / 3600).toFixed(1), soporte_donde: peores,
      tris: m.indices.length / 3, soporte_mm2: rep.supportAreaMm2, soporte_pct: rep.overhangPct,
      malla, cortes: `${reporte.ok ? 'ok' : 'FALLÓ'} (${reporte.estrategia}, ${reporte.noEntraron.length} sin entrar${reporte.noEntraron.length ? ': ' + reporte.noEntraron.slice(0, 4).join(' / ') : ''})`, malas: malas.length ? malas.join(' / ') : 0, s: +((Date.now() - t1) / 1000).toFixed(1),
    };
    resumen.push(fila);
    console.log(JSON.stringify(fila));
  }
  // ── 3. las piezas sueltas, una cama a la vez ────────────────────────────────────────────────
  const porId = new Map(d.piezas.map((p) => [p.id, p]));
  for (const cm of d.camas) {
    if (!quiere(cm.id, 'piezas')) continue;
    const t1 = Date.now(), malas = [];
    const mk = (o) => { try { const f = forma(o); const v = occt.volume(oc, f); if (!(v > 1e-6)) throw new Error(v < 0 ? `al revés (${v.toFixed(0)} mm³)` : 'vacío'); return f; } catch (e) { malas.push(`${o.nota || o.t}: ${String(e && e.message || e).slice(0, 60)}`); return null; } };
    const F = { pos: [], nor: [], idx: [] }, S = { pos: [], idx: [] };
    let vol = 0, area = 0, sinCorte = 0;
    for (const a of cm.acomodo) {
      const pz = porId.get(a.id);
      const sumas = pz.ops.filter((o) => o.s > 0).map(mk).filter(Boolean), restas = pz.ops.filter((o) => o.s < 0);
      if (!sumas.length) { malas.push(`${pz.id}: sin sumas`); continue; }
      let sh = unir(sumas, malas);
      if (restas.length) { const r = occt.cortarHerramientas(oc, sh, restas.map(mk), { donde: `pieza ${pz.id}`, etiquetas: restas.map((o) => o.nota || o.t) }); sh = r.shape; sinCorte += r.reporte.noEntraron.length; }
      vol += occt.volume(oc, sh);
      let m = null;
      for (const [lin, ang] of [[0.3, 0.5], [0.6, 0.8]]) { try { m = occt.tessellate(oc, sh, lin, ang); break; } catch (e) { etapa(`${pz.id}: teselar ${lin} falló`); } }
      if (!m) { malas.push(`${pz.id}: no se pudo teselar`); continue; }
      // FMSH: en su lugar
      const b0 = F.pos.length / 3;
      for (let i = 0; i < m.positions.length; i++) { F.pos.push(m.positions[i]); F.nor.push(m.normals[i]); }
      for (let i = 0; i < m.indices.length; i++) F.idx.push(m.indices[i] + b0);
      // STL: girada (su cara «abajo» a la cama) y acomodada
      const P = [], mn = [Infinity, Infinity, Infinity];
      for (let i = 0; i < m.positions.length; i += 3) { const q = cuerpo.rotarAbajo([m.positions[i], m.positions[i + 1], m.positions[i + 2]], pz.abajo); P.push(q); for (let k = 0; k < 3; k++) mn[k] = Math.min(mn[k], q[k]); }
      const s0 = S.pos.length / 3;
      for (const q of P) S.pos.push(q[0] - mn[0] + a.dx, q[1] - mn[1] + a.dy, q[2] - mn[2]);
      for (let i = 0; i < m.indices.length; i++) S.idx.push(m.indices[i] + s0);
      for (let t = 0; t < m.indices.length / 3; t++) {
        const ia = m.indices[3 * t] * 3, ib = m.indices[3 * t + 1] * 3, ic = m.indices[3 * t + 2] * 3, Q = m.positions;
        const ux = Q[ib] - Q[ia], uy = Q[ib + 1] - Q[ia + 1], uz = Q[ib + 2] - Q[ia + 2], vx = Q[ic] - Q[ia], vy = Q[ic + 1] - Q[ia + 1], vz = Q[ic + 2] - Q[ia + 2];
        area += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      }
    }
    if (!F.idx.length) { console.log(`${cm.id}: vacía (${malas.join(' / ')})`); continue; }
    const mF = { positions: new Float32Array(F.pos), normals: new Float32Array(F.nor), indices: new Uint32Array(F.idx) };
    writeFileSync(path.join(OUT, 'fmsh', `${cm.id}.bin`), fmsh(mF));
    const SP = new Float32Array(S.pos), SI = new Uint32Array(S.idx);
    writeFileSync(path.join(OUT, 'stl', `${cm.id}.stl`), stlBinario(SP, SI, `${cm.id} (${cm.piezas.length} piezas)`));
    const rep = dfm.printabilityReport({ positions: SP, indices: SI }, perfil);
    const mx = [0, 1, 2].map((k) => { let v = -Infinity; for (let i = k; i < SP.length; i += 3) v = Math.max(v, SP[i]); return v; });
    const vExt = Math.min(vol, area * 1.2 + 0.2 * Math.max(0, vol - area * 1.2));
    const fila = {
      teja: cm.id, tipo: 'cama', piezas: cm.piezas.length, caja: mx.map((v) => +v.toFixed(1)), cabe: rep.fits,
      vol_cm3: +(vol / 1000).toFixed(1), extruido_cm3: +(vExt / 1000).toFixed(1), masa_g: +(vExt * 1.27e-3).toFixed(0), horas: +(vExt / MM3_POR_S / 3600).toFixed(1),
      tris: SI.length / 3, soporte_mm2: rep.supportAreaMm2, soporte_pct: rep.overhangPct, malla: '0.3', cortes: `${sinCorte} sin entrar`, malas: malas.length ? malas.join(' / ') : 0, s: +((Date.now() - t1) / 1000).toFixed(1),
    };
    resumen.push(fila);
    console.log(JSON.stringify(fila));
  }

  // el resumen se acumula por teja (cada teja puede correr en su propio proceso)
  const rpath = path.join(OUT, 'resumen.json');
  let prev = []; try { prev = JSON.parse(readFileSync(rpath, 'utf8')); } catch { /* nuevo */ }
  const todo = [...prev.filter((r) => !resumen.some((q) => q.teja === r.teja)), ...resumen];
  // sólo lo que existe en este diseño (las camas cambian de nombre cuando cambian las rutas)
  const vivos = new Set([...d.tejas.map((t) => t.id), ...d.camas.map((c) => c.id)]);
  const vigente = todo.filter((r) => vivos.has(r.teja));
  writeFileSync(rpath, JSON.stringify(vigente, null, 1));
  const tot = vigente.reduce((a, r) => ({ v: a.v + r.extruido_cm3, h: a.h + r.horas, g: a.g + r.masa_g, t: a.t + r.tris }), { v: 0, h: 0, g: 0, t: 0 });
  console.log(`\nTOTAL ${vigente.filter((r) => r.tipo !== 'cama').length} tejas + ${vigente.filter((r) => r.tipo === 'cama').length} camas de piezas · ${tot.v.toFixed(0)} cm³ extruidos · ${tot.g.toFixed(0)} g de PETG · ~${tot.h.toFixed(0)} h de impresión (a ${MM3_POR_S} mm³/s) · ${tot.t} triángulos en las FMSH`);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
