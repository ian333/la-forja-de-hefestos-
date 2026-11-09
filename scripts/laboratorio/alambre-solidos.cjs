#!/usr/bin/env node
/**
 * SÓLIDOS DEL MÓDULO DEL ALAMBRE (orden 2026-11-05-lab-alambre · ronda 2: 2026-11-06-lab-alambre-r2)
 * =======================================================================================================
 * La geometría vive UNA vez, como datos, en src/forja/lab/alambre.ts (`disenarAlambre().impresas`: cajas, cilindros,
 * conos, gotas, cilindros inclinados y prismas con su operación + / −; en la ronda 2 también las ranuras de los escudos y
 * las anclas de los tirantes). Este script la pasa por el kernel OCCT (mismo pegamento que
 * scripts/precompute-banco-arco.cjs), y por cada pieza impresa escribe:
 *   · <salida>/stl/<pieza>.stl   en mm, YA en su orientación de impresión, apoyada en z = 0 y centrada en la cama;
 *   · <salida>/fmsh/<pieza>.bin  FMSH en el marco del doc (la vista la pone en x = y = z = 0).
 * Y revisa cada STL con dfm.ts (printabilityReport con el perfil K1/PETG): caja, ¿cabe?, triángulos que piden soporte.
 *
 *   node --import tsx scripts/laboratorio/alambre-solidos.cjs [carpeta_salida] [raíz_forja]
 *   (default: salidas-lab/alambre/ bajo la raíz)
 */
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');

const ROOT = process.argv[3] || path.resolve(__dirname, '..', '..');
const OUT = process.argv[2] || path.join(ROOT, 'salidas-lab', 'alambre');

const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const factory = require(cjsGlue);

const EJE = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/** Un primitivo de alambre.ts → forma OCCT (marco del doc). */
function forma(oc, occt, al, p) {
  switch (p.f) {
    case 'caja': {
      const [x0, y0, z0] = p.a, [x1, y1, z1] = p.b;
      const b = occt.makeBox(oc, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
      return occt.transformShape(oc, b, { translate: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)] });
    }
    case 'cil': return occt.makeCylinder(oc, p.r, p.h, { origin: p.c, dir: EJE[p.eje] });
    case 'cilDir': return occt.makeCylinder(oc, p.r, p.h, { origin: p.c, dir: p.dir });
    case 'cono': return occt.makeCone(oc, p.r1, p.r2, p.h, { origin: p.c, dir: EJE[p.eje] });
    case 'gota': {
      // perfil (u horizontal, v = z hacia arriba); el plano extruye en +eje desde la base c
      const plano = p.eje === 'y' ? { origin: p.c, uDir: [-1, 0, 0], vDir: [0, 0, 1] } : { origin: p.c, uDir: [0, 1, 0], vDir: [0, 0, 1] };
      return occt.extrudePolygon(oc, al.perfilGota(p.r).map(([x, y]) => ({ x, y })), p.h, plano);
    }
    case 'prismaYZ': return occt.extrudePolygon(oc, p.pts.map(([x, y]) => ({ x, y })), p.x1 - p.x0, { origin: [p.x0, 0, 0], uDir: [0, 1, 0], vDir: [0, 0, 1] });
    case 'prismaXY': return occt.extrudePolygon(oc, p.pts.map(([x, y]) => ({ x, y })), p.z1 - p.z0, { origin: [0, 0, p.z0], uDir: [1, 0, 0], vDir: [0, 1, 0] });
    case 'prismaXZ': return occt.extrudePolygon(oc, p.pts.map(([x, y]) => ({ x, y })), p.y1 - p.y0, { origin: [0, p.y1, 0], uDir: [1, 0, 0], vDir: [0, 0, 1] });
    default: throw new Error(`primitivo desconocido ${p.f}`);
  }
}

/** Giro de 90° sobre un eje (el mismo convenio que medidasImpresion en alambre.ts). */
function girar(pos, giro) {
  if (!giro) return pos;
  const a = (giro.grados * Math.PI) / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (giro.eje === 'x') { out[i] = x; out[i + 1] = y * c - z * s; out[i + 2] = y * s + z * c; }
    else if (giro.eje === 'y') { out[i] = x * c + z * s; out[i + 1] = y; out[i + 2] = -x * s + z * c; }
    else { out[i] = x * c - y * s; out[i + 1] = x * s + y * c; out[i + 2] = z; }
  }
  return out;
}
function caja(pos) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
  return { mn, mx };
}
function stlBinario(pos, idx, nombre) {
  const nt = idx.length / 3, buf = Buffer.alloc(84 + nt * 50);
  buf.write(`La Forja · modulo del alambre · ${nombre}`.slice(0, 79), 0, 'ascii');
  buf.writeUInt32LE(nt, 80);
  let o = 84;
  for (let t = 0; t < nt; t++) {
    const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L; ny /= L; nz /= L;
    for (const v of [nx, ny, nz]) { buf.writeFloatLE(v, o); o += 4; }
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) { buf.writeFloatLE(pos[i + k], o); o += 4; }
    buf.writeUInt16LE(0, o); o += 2;
  }
  return buf;
}
function fmsh(m) {
  const nv = m.positions.length / 3, ni = m.indices.length;
  const buf = Buffer.alloc(16 + nv * 24 + ni * 4);
  buf.writeUInt32LE(0x48534d46, 0); buf.writeUInt32LE(1, 4); buf.writeUInt32LE(nv, 8); buf.writeUInt32LE(ni, 12);
  Buffer.from(m.positions.buffer, m.positions.byteOffset, m.positions.byteLength).copy(buf, 16);
  Buffer.from(m.normals.buffer, m.normals.byteOffset, m.normals.byteLength).copy(buf, 16 + nv * 12);
  Buffer.from(m.indices.buffer, m.indices.byteOffset, m.indices.byteLength).copy(buf, 16 + nv * 24);
  return buf;
}

(async () => {
  const occt = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const al = await import(path.join(ROOT, 'src', 'forja', 'lab', 'alambre.ts'));
  const dfm = await import(path.join(ROOT, 'src', 'forja', 'mech', 'dfm.ts'));
  const oc = await factory({ wasmBinary: readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);
  mkdirSync(path.join(OUT, 'stl'), { recursive: true });
  mkdirSync(path.join(OUT, 'fmsh'), { recursive: true });
  const d = al.disenarAlambre();
  const resumen = [];
  for (const pz of d.impresas) {
    const t0 = Date.now();
    // en ORDEN: lo que se suma después de un corte (la lengüeta del broche en su ranura, el diente en el bolsillo) sobrevive
    let s = null;
    for (const p of pz.prims) {
      const f = forma(oc, occt, al, p);
      s = s === null ? f : p.op === '+' ? occt.fuse(oc, s, f) : occt.cut(oc, s, f);
    }
    const vol = occt.volume(oc, s), solidos = occt.solidsOf(oc, s).length;
    const m = occt.tessellate(oc, s, 0.08, 0.3);
    writeFileSync(path.join(OUT, 'fmsh', `${pz.id}.bin`), fmsh(m));
    // STL: girar a la orientación de impresión, apoyar en z = 0 y centrar en la cama
    const g = girar(m.positions, pz.giro), { mn, mx } = caja(g);
    const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2;
    for (let i = 0; i < g.length; i += 3) { g[i] -= cx; g[i + 1] -= cy; g[i + 2] -= mn[2]; }
    writeFileSync(path.join(OUT, 'stl', `${pz.id}.stl`), stlBinario(g, m.indices, pz.id));
    const rep = dfm.printabilityReport({ positions: g, indices: m.indices }, al.PERFIL_K1);
    const cDoc = caja(m.positions);
    const fila = {
      pieza: pz.id, tris: m.indices.length / 3, solidos, vol_cm3: +(vol / 1e3).toFixed(1), masa_g: +((vol / 1e3) * 1.27).toFixed(0),
      cajaImpresion: [rep.bbox.w, rep.bbox.d, rep.bbox.h], cabe: rep.fits, cabeK1: al.medidasImpresion(pz),
      soporte_tris: rep.triSupport, soporte_mm2: rep.supportAreaMm2, voladizo_pct: rep.overhangPct, aviso_tris: rep.triWarn,
      cajaDoc: [cDoc.mn.map((v) => +v.toFixed(1)), cDoc.mx.map((v) => +v.toFixed(1))], ms: Date.now() - t0,
    };
    // ¿dónde piden soporte? por altura: si son los techos planos declarados como puentes, el puente los cruza
    const { cls } = dfm.classifyOverhangs({ positions: g, indices: m.indices }, al.PERFIL_K1);
    const grupos = new Map();
    for (let t = 0; t < cls.length; t++) {
      if (cls[t] !== 2) continue;
      const ids = [m.indices[3 * t], m.indices[3 * t + 1], m.indices[3 * t + 2]];
      const zz = Math.round((ids.reduce((a, i) => a + g[3 * i + 2], 0) / 3) * 2) / 2;
      const gr = grupos.get(zz) || { n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
      gr.n++; for (const i of ids) { gr.x0 = Math.min(gr.x0, g[3 * i]); gr.x1 = Math.max(gr.x1, g[3 * i]); gr.y0 = Math.min(gr.y0, g[3 * i + 1]); gr.y1 = Math.max(gr.y1, g[3 * i + 1]); }
      grupos.set(zz, gr);
    }
    fila.soporte_por_altura = [...grupos.entries()].map(([z, gr]) => ({ z, tris: gr.n, luzX: +(gr.x1 - gr.x0).toFixed(1), luzY: +(gr.y1 - gr.y0).toFixed(1) }));
    for (const r of fila.soporte_por_altura) console.log(`    soporte a z ${r.z} mm de la cama: ${r.tris} tris, ${r.luzX} × ${r.luzY} mm`);
    resumen.push(fila);
    console.log(`${pz.id.padEnd(15)} ${String(fila.tris).padStart(6)} tris · ${solidos} sólido(s) · ${fila.vol_cm3} cm³ (${fila.masa_g} g PETG) · impresión ${fila.cajaImpresion.join(' × ')} mm ${rep.fits ? 'CABE' : 'NO CABE'} · soporte: ${rep.triSupport} tris / ${rep.supportAreaMm2} mm² (${rep.overhangPct} %) · ${fila.ms} ms`);
  }
  writeFileSync(path.join(OUT, 'resumen.json'), JSON.stringify(resumen, null, 1));
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
