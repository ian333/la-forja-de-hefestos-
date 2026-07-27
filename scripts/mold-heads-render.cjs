/**
 * CATÁLOGO DE CABEZAS renderizado (rasterizador de software, sin navegador) — para VER
 * los tipos de cabeza y los CHAFLANES reales (user: "faltan los tipos de cabeza… así no
 * son los reales, tienen chaflanes"). Cada tornillo = cabeza por REGLA de su norma +
 * caña lisa + rosca ISO 68-1 con chaflán de punta ISO 4753 (45° al Ø menor).
 * Uso: node --import tsx scripts/mold-heads-render.cjs [d] [out.png]
 */
const path = require('path');
const zlib = require('zlib');
const fs = require('fs');

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) { const t = Buffer.from(type, 'ascii'); const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const body = Buffer.concat([t, data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0); return Buffer.concat([len, body, crc]); }
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function merge(meshes) {
  let np = 0, ni = 0; for (const m of meshes) { np += m.positions.length; ni += m.indices.length; }
  const positions = new Float32Array(np), normals = new Float32Array(np), indices = new Uint32Array(ni);
  let po = 0, io = 0, base = 0;
  for (const m of meshes) {
    positions.set(m.positions, po); normals.set(m.normals, po);
    for (let k = 0; k < m.indices.length; k++) indices[io + k] = m.indices[k] + base;
    base += m.positions.length / 3; po += m.positions.length; io += m.indices.length;
  }
  return { positions, normals, indices };
}
function shiftX(m, dx) { const p = new Float32Array(m.positions); for (let i = 0; i < p.length; i += 3) p[i] += dx; return { positions: p, normals: m.normals, indices: m.indices }; }

(async () => {
  const T = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-threads.ts'));
  const H = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-heads.ts'));
  const F = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-fasteners.ts'));
  const dMm = parseFloat(process.argv[2]) || 10;
  const out = process.argv.find((a) => a.endsWith('.png')) || '/tmp/heads.png';

  const spec = T.resolveThread(dMm), R = spec.major / 2;
  const Le = F.engagementLengthMm(spec, 430), shankTop = Le + 20;
  const STDS = ['DIN912', 'DIN7984', 'ISO7380', 'DIN7991', 'DIN933'];
  const parts = [], labels = [];
  let x = 0;
  for (const std of STDS) {
    const hd = H.resolveHead(std, dMm);
    // avellanado: la cabeza se hunde (su cono ARRANCA en el Ø del vástago) → arranca más abajo
    const z0 = std === 'DIN7991' ? shankTop - hd.k : shankTop;
    const thread = T.threadSurfaceMesh(spec, Le, { lod: 9, nPhi: 56, chamfer: 'start' });
    const shank = T.plainShaftMesh(R, Le, z0 + 0.01, 48);
    const head = H.headMesh(hd, z0, { nPhi: 84 });
    parts.push(shiftX(merge([thread, shank, head]), x));
    labels.push(`${hd.desig.padEnd(13)} dk=${String(hd.dk).padStart(5)} k=${String(hd.k).padStart(5)} ${hd.source}${hd.nominal ? '*' : ''}`);
    x += Math.max(24, dMm * 2.6);
  }
  const scene = merge(parts);
  const tris = scene.indices.length / 3;

  // ── raster: orto, mirando un poco DESDE ARRIBA (para ver el Allen y el hexágono) ──
  const W = 1500, H2 = 900, img = Buffer.alloc(W * H2 * 4);
  for (let i = 0; i < W * H2; i++) { img[i * 4] = 17; img[i * 4 + 1] = 19; img[i * 4 + 2] = 24; img[i * 4 + 3] = 255; }
  const zbuf = new Float32Array(W * H2).fill(-1e9);
  const P = scene.positions, N = scene.normals, I = scene.indices;
  // yaw = 0 A PROPÓSITO: con yaw, la rotación sube cada tornillo según su X y la fila
  // sale en DIAGONAL — imposible comparar alturas de cabeza. Sin yaw, línea de base
  // nivelada; el pit alto basta para ver la cara superior (Allen/hexágono).
  const yaw = 0, pit = 0.46;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
  const rot = (a, b, c) => { const x1 = cy * a + sy * b, y1 = -sy * a + cy * b; return [x1, sp * c + cp * y1, cp * c - sp * y1]; };
  const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((q) => q / l); };
  const K = nrm([0.45, 0.4, 0.8]), Fl = nrm([-0.5, -0.15, 0.35]), Hh = nrm([K[0], K[1] + 1, K[2]]);
  const sx = [], sy_ = [], dz = [], sh = [], spc = [];
  for (let i = 0; i < P.length; i += 3) {
    const [rx, ry, rz] = rot(P[i], P[i + 1], P[i + 2]);
    sx.push(rx); sy_.push(rz); dz.push(ry);
    let [nx, ny, nz] = rot(N[i], N[i + 1], N[i + 2]);
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    sh.push(0.17 + 0.70 * Math.max(0, nx * K[0] + ny * K[1] + nz * K[2]) + 0.32 * Math.max(0, nx * Fl[0] + ny * Fl[1] + nz * Fl[2]));
    spc.push(Math.pow(Math.max(0, nx * Hh[0] + ny * Hh[1] + nz * Hh[2]), 46) * 0.85);
  }
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (let i = 0; i < sx.length; i++) { mnx = Math.min(mnx, sx[i]); mxx = Math.max(mxx, sx[i]); mny = Math.min(mny, sy_[i]); mxy = Math.max(mxy, sy_[i]); }
  const mgn = 70, sc = Math.min((W - 2 * mgn) / (mxx - mnx), (H2 - 2 * mgn - 40) / (mxy - mny));
  const cxp = (mxx + mnx) / 2, cyp = (mxy + mny) / 2;
  const px_ = (i) => [W / 2 + (sx[i] - cxp) * sc, (H2 - 40) / 2 - (sy_[i] - cyp) * sc + 20];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const [ax, ay] = px_(a), [bx, by] = px_(b), [cx2, cy2] = px_(c);
    const area = (bx - ax) * (cy2 - ay) - (cx2 - ax) * (by - ay);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx2))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx2)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy2))), y1 = Math.min(H2 - 1, Math.ceil(Math.max(ay, by, cy2)));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const w0 = ((bx - px) * (cy2 - py) - (cx2 - px) * (by - py)) / area;
      const w1 = ((cx2 - px) * (ay - py) - (ax - px) * (cy2 - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const depth = w0 * dz[a] + w1 * dz[b] + w2 * dz[c], off = py * W + px;
      if (depth <= zbuf[off]) continue; zbuf[off] = depth;
      const it = w0 * sh[a] + w1 * sh[b] + w2 * sh[c], sp2 = (w0 * spc[a] + w1 * spc[b] + w2 * spc[c]) * 255;
      const o = off * 4;
      img[o] = Math.min(255, it * 176 + sp2); img[o + 1] = Math.min(255, it * 186 + sp2); img[o + 2] = Math.min(255, it * 208 + sp2 * 1.05);
    }
  }
  fs.writeFileSync(out, encodePNG(W, H2, img));
  console.log(`CATÁLOGO M${dMm} · ${tris} tris · chaflán punta ISO 4753 45°→⌀${H.tipChamfer(spec.major, spec.pitch).toDia}`);
  labels.forEach((l) => console.log('  ' + l));
  console.log(`(* = proporción de regla, confirmar contra norma)\n→ ${out}`);
})().catch((e) => { console.error('HEADS_RENDER_FATAL', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
