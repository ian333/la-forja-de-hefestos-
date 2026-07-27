/**
 * RENDER del TORNILLO ensamblado (rasterizador de software, sin navegador) — para
 * VER que la cuerda es REAL (no barra lisa) y que la caña roscada solo en la zona de
 * ENGRANE. Construye la malla del perno (cabeza cilíndrica DIN 912 + caña lisa + rosca
 * ISO 68-1 sobre la longitud de engrane) y la rasteriza con z-buffer + Lambert a PNG.
 * Uso: node --import tsx scripts/mold-bolt-render.cjs [M10 1.5] [outfile.png]
 */
const path = require('path');
const zlib = require('zlib');
const fs = require('fs');

// ── PNG mínimo (RGBA) vía zlib ──────────────────────────────────────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) { const t = Buffer.from(type, 'ascii'); const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const body = Buffer.concat([t, data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0); return Buffer.concat([len, body, crc]); }
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ── malla utilitaria ────────────────────────────────────────────────────────
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

(async () => {
  const T = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-threads.ts'));
  const F = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-fasteners.ts'));
  const dMm = parseFloat(process.argv[2]) || 10;
  const pitch = parseFloat(process.argv[3]) || undefined;
  const out = process.argv.find((a) => a.endsWith('.png')) || path.resolve(__dirname, '..', 'scratchpad', `bolt-M${dMm}.png`);

  const spec = pitch ? T.parseThread(`M${dMm}×${pitch}`) : T.resolveThread(dMm);
  const Le = F.engagementLengthMm(spec, 430);          // engrane en acero base 1.1730
  const R = spec.major / 2;
  const shankTop = Le + Math.max(18, dMm * 2.2);       // caña lisa arriba de la rosca
  const headH = dMm, headR = dMm * 0.75;               // cabeza cap-screw DIN 912
  // cilindro con tapas (para la cabeza)
  const cyl = (r, z0, z1, nPhi = 40) => {
    const pos = [], idx = [];
    for (const z of [z0, z1]) for (let i = 0; i <= nPhi; i++) { const p = 2 * Math.PI * i / nPhi; pos.push(r * Math.cos(p), r * Math.sin(p), z); }
    const row = nPhi + 1;
    for (let i = 0; i < nPhi; i++) { const a = i, b = a + 1, c = a + row, d = c + 1; idx.push(a, c, b, b, c, d); }
    const capC = (z, base, dir) => { pos.push(0, 0, z); const ci = pos.length / 3 - 1; for (let i = 0; i <= nPhi; i++) { const p = 2 * Math.PI * i / nPhi; pos.push(r * Math.cos(p), r * Math.sin(p), z); } for (let i = 0; i < nPhi; i++) { if (dir > 0) idx.push(ci, ci + 1 + i, ci + 2 + i); else idx.push(ci, ci + 2 + i, ci + 1 + i); } };
    capC(z0, 0, -1); capC(z1, 0, 1);
    const positions = new Float32Array(pos), indices = new Uint32Array(idx);
    return { positions, normals: T.computeNormals(positions, indices), indices };
  };

  const thread = T.threadSurfaceMesh(spec, Le, { lod: 8, nPhi: 48 });
  const shank = T.plainShaftMesh(R, Le, shankTop, 40);
  const head = cyl(headR, shankTop, shankTop + headH);
  const bolt = merge([thread, shank, head]);
  const tris = bolt.indices.length / 3;
  const realness = T.threadRealnessMm(thread);
  const { h } = T.threadDims(spec.major, spec.pitch);

  // ── rasterizador: orto lateral + leve giro, z-buffer, Lambert acero ─────────
  const W = 720, H = 1280;
  const img = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { img[i * 4] = 16; img[i * 4 + 1] = 18; img[i * 4 + 2] = 22; img[i * 4 + 3] = 255; }
  const zbuf = new Float32Array(W * H).fill(-1e9);
  const P = bolt.positions, N = bolt.normals, I = bolt.indices;
  // rotación: yaw pequeño (ver la hélice envolver) + pitch leve
  const yaw = 0.35, pit = 0.18;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
  const rot = (x, y, z) => { const x1 = cy * x + sy * y, y1 = -sy * x + cy * y; const z2 = cp * z - sp * y1, y2 = sp * z + cp * y1; return [x1, y2, z2]; };
  // proyecta todo, calcula bbox de pantalla (x→horizontal, z→vertical, y→profundidad)
  const sx = [], sy_ = [], dz = [], sh = [], spc = [];
  const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const K = nrm([0.5, 0.35, 0.79]);                    // luz clave (arriba-izq-frente)
  const Fl = nrm([-0.45, -0.2, 0.4]);                  // relleno (abajo-der, levanta sombras)
  const V = [0, 1, 0];                                 // cámara mira -Y (profundidad = ry)
  const Hh = nrm([K[0] + V[0], K[1] + V[1], K[2] + V[2]]); // media (Blinn) para el brillo
  for (let i = 0; i < P.length; i += 3) {
    const [rx, ry, rz] = rot(P[i], P[i + 1], P[i + 2]);
    sx.push(rx); sy_.push(rz); dz.push(ry);
    let [nx, ny, nz] = rot(N[i], N[i + 1], N[i + 2]);
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const dk = Math.max(0, nx * K[0] + ny * K[1] + nz * K[2]);
    const df = Math.max(0, nx * Fl[0] + ny * Fl[1] + nz * Fl[2]);
    sh.push(0.18 + 0.72 * dk + 0.34 * df);             // ambiente + clave + relleno
    const sp = Math.max(0, nx * Hh[0] + ny * Hh[1] + nz * Hh[2]);
    spc.push(Math.pow(sp, 48) * 0.9);                  // sheen de acero pulido
  }
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (let i = 0; i < sx.length; i++) { minx = Math.min(minx, sx[i]); maxx = Math.max(maxx, sx[i]); miny = Math.min(miny, sy_[i]); maxy = Math.max(maxy, sy_[i]); }
  const mgn = 70, scale = Math.min((W - 2 * mgn) / (maxx - minx), (H - 2 * mgn) / (maxy - miny));
  const cxp = (maxx + minx) / 2, cyp = (maxy + miny) / 2;
  const toPx = (i) => [W / 2 + (sx[i] - cxp) * scale, H / 2 - (sy_[i] - cyp) * scale];
  // rasteriza triángulos
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const [ax, ay] = toPx(a), [bx, by] = toPx(b), [ccx, ccy] = toPx(c);
    const area = (bx - ax) * (ccy - ay) - (ccx - ax) * (by - ay);
    if (Math.abs(area) < 1e-6) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, ccx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, ccx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, ccy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, ccy)));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const w0 = ((bx - px) * (ccy - py) - (ccx - px) * (by - py)) / area;
      const w1 = ((ccx - px) * (ay - py) - (ax - px) * (ccy - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const depth = w0 * dz[a] + w1 * dz[b] + w2 * dz[c];
      const off = py * W + px;
      if (depth <= zbuf[off]) continue; zbuf[off] = depth;
      const inten = w0 * sh[a] + w1 * sh[b] + w2 * sh[c];
      const sp = (w0 * spc[a] + w1 * spc[b] + w2 * spc[c]) * 255;
      const o = off * 4;
      img[o] = Math.min(255, inten * 172 + sp); img[o + 1] = Math.min(255, inten * 182 + sp); img[o + 2] = Math.min(255, inten * 205 + sp * 1.05); img[o + 3] = 255;
    }
  }
  fs.writeFileSync(out, encodePNG(W, H, img));
  console.log(`${spec.desig}  engrane ${Le}mm  caña→${shankTop.toFixed(0)}mm  cabeza ⌀${(headR * 2).toFixed(0)}×${headH}mm`);
  console.log(`malla: ${tris} tris  ·  rosca REAL variación ${realness}mm (h=${h.toFixed(3)})`);
  console.log(`→ ${out}`);
})().catch((e) => { console.error('RENDER_FATAL', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
