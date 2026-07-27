/**
 * STILLS DEL LOTE REAL — las piezas Hammond con su campo de flujo al 55 %.
 * Un SVG por sólido GRANDE (>10 cc: cajas y tapas), para el contact sheet 4K.
 * Uso: node --import tsx scripts/piezas-reales-stills.cjs <outdir>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'test-parts', 'inyeccion-reales');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');

const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function pngRGB(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => {
    const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const RAMP = [[255, 241, 200], [255, 176, 59], [219, 91, 46], [122, 30, 60], [56, 24, 84]];
const ramp = (u) => {
  const t = Math.max(0, Math.min(0.999, u)) * (RAMP.length - 1);
  const i = Math.floor(t), f = t - i, a = RAMP[i], b = RAMP[Math.min(RAMP.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};

(async () => {
  const out = process.argv[2] || path.join(DIR, 'stills');
  fs.mkdirSync(out, { recursive: true });
  const oc = await require(cjsGlue)({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const DA = await import(path.join(ROOT, 'src', 'forja', 'mold', 'draw-axis.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));

  const files = fs.readdirSync(DIR).filter((f) => /\.(stp|step)$/i.test(f));
  let nOut = 0;
  for (const f of files) {
    const shape = K.importSTEP(oc, fs.readFileSync(path.join(DIR, f)));
    const solids = K.uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID)
      .map((s) => ({ s, vol: K.volume(oc, s) }))
      .filter((c) => c.vol > 10000)
      .sort((a, b) => b.vol - a.vol);
    let si = 0;
    for (const { s, vol } of solids) {
      const tag = `${f.replace(/\.(stp|step)$/i, '')}-${si === 0 ? 'caja' : 'tapa'}`;
      si++;
      const mesh = K.tessellate(oc, s, 0.3, 0.3);
      const idx = mesh.indices ?? new Uint32Array(mesh.positions.length / 3).map((_, i) => i);
      let area = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        const u = [mesh.positions[b] - mesh.positions[a], mesh.positions[b + 1] - mesh.positions[a + 1], mesh.positions[b + 2] - mesh.positions[a + 2]];
        const v = [mesh.positions[c] - mesh.positions[a], mesh.positions[c + 1] - mesh.positions[a + 1], mesh.positions[c + 2] - mesh.positions[a + 2]];
        area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
      }
      const wall = Math.min(4, Math.max(1, +(2 * vol / area).toFixed(2)));
      const choice = DA.pickDrawAxis({ positions: mesh.positions, indices: idx }, { wallMm: wall });
      const om = choice.oriented;
      const q = FM.solidFromMesh({ positions: om.positions, indices: idx });
      const gate = FM.defaultGate(q);
      const cell = Math.max(0.4, Math.min(1.0, wall * 0.45));
      const field = FL.measureFlowLength({
        x0: q.bbox.x0 - 2, y0: q.bbox.y0 - 2, z0: q.bbox.z0 - 1, x1: q.bbox.x1 + 2, y1: q.bbox.y1 + 2, z1: q.bbox.z1 + 1,
        cellMm: cell, gateMm: gate, inCavity: (x, y, z) => q.inside(x, y, z),
        wallMm: wall, meltN: 0.348,
      });
      const rs = [];
      for (let t = 0; t < field.cavity.length; t++) if (field.cavity[t] && Number.isFinite(field.resistance[t])) rs.push(field.resistance[t]);
      rs.sort((a, b) => a - b);
      const frontR = rs[Math.floor(rs.length * 0.55)] ?? 0;
      const VW = 960, VH = 500;
      const cx0 = (q.bbox.x0 + q.bbox.x1) / 2, cy0 = (q.bbox.y0 + q.bbox.y1) / 2, cz0 = (q.bbox.z0 + q.bbox.z1) / 2;
      const ext = Math.hypot(q.bbox.x1 - q.bbox.x0, q.bbox.y1 - q.bbox.y0) + (q.bbox.z1 - q.bbox.z0);
      const S = Math.min(7, 620 / ext * 2.1);
      const th = (-28 * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
      const fb = new Float32Array(VW * VH * 3).fill(10);
      const splats = [];
      for (let k = 0; k < field.nz; k++) for (let j = 0; j < field.ny; j++) for (let i = 0; i < field.nx; i++) {
        const t = (k * field.ny + j) * field.nx + i;
        if (!field.cavity[t]) continue;
        const x = field.x0 + (i + .5) * cell, y = field.y0 + (j + .5) * cell, z = field.z0 + (k + .5) * cell;
        const xr = (x - cx0) * cosT - (y - cy0) * sinT, yr = (x - cx0) * sinT + (y - cy0) * cosT;
        const u2 = VW / 2 + (xr - yr) * S, v2 = VH / 2 + (xr + yr) * S * 0.42 - (z - cz0) * S, d = xr + yr + (z - cz0) * 0.35;
        const R = field.resistance[t];
        if (Number.isFinite(R) && R <= frontR) {
          const u = R / Math.max(1e-9, field.maxResistance);
          const col = ramp(0.15 + 0.85 * u);
          splats.push([d, u2, v2, col[0], col[1], col[2], 0.24 + 0.45 * (1 - u)]);
        } else {
          splats.push([d, u2, v2, 64, 76, 104, 0.22]);
        }
      }
      splats.sort((a, b) => a[0] - b[0]);
      const KW = [0.3, 0.62, 0.3];
      for (const [, u, v, rr, g, b, aA] of splats) {
        const ui = u | 0, vi = v | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const px = ui + dx, py = vi + dy;
          if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
          const a2 = Math.min(1, aA * KW[dx + 1] * KW[dy + 1] * 2.2);
          const o = (py * VW + px) * 3;
          fb[o] = fb[o] * (1 - a2) + rr * a2; fb[o + 1] = fb[o + 1] * (1 - a2) + g * a2; fb[o + 2] = fb[o + 2] * (1 - a2) + b * a2;
        }
      }
      const rgb = Buffer.alloc(VW * VH * 3);
      for (let t = 0; t < fb.length; t++) rgb[t] = Math.min(255, fb[t] * 1.75);   // exposición: el sheet salía APAGADO
      const b64 = pngRGB(VW, VH, rgb).toString('base64');
      const mm = [q.bbox.x1 - q.bbox.x0, q.bbox.y1 - q.bbox.y0, q.bbox.z1 - q.bbox.z0].map((v) => v.toFixed(0)).join('×');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" font-family="ui-monospace,Menlo,monospace">
<rect width="960" height="540" fill="#0b0f16"/>
<image x="0" y="20" width="960" height="500" href="data:image/png;base64,${b64}"/>
<text x="24" y="34" font-size="22" fill="#eaf2ff">${tag}</text>
<text x="24" y="58" font-size="15" fill="#7d92b4">${mm} mm · ${(vol / 1000).toFixed(1)} cc · pared ~${wall} · frente 55 % · sin llenar ${field.unreachable}</text>
</svg>`;
      fs.writeFileSync(path.join(out, `s${String(nOut).padStart(2, '0')}-${tag}.svg`), svg);
      console.log(`  still ${tag} (${(vol / 1000).toFixed(1)} cc)`);
      nOut++;
    }
  }
  console.log(`${nOut} stills → ${out}`);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
