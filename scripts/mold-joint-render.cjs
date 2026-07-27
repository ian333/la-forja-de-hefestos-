/**
 * SECCIÓN de la UNIÓN atornillada (dibujo de corte, convención ISO) — para VER que
 * las placas se UNEN de verdad: el tornillo ENGRANA su cuerda en la placa B (barreno
 * roscado) y PASA libre por la A (barreno de paso), con la cabeza avellanada. Convención
 * de taller: placas RAYADAS (hatch a 45°, sentido distinto por pieza), tornillo SÓLIDO
 * (los sujetadores NO se seccionan). Perfil de rosca ISO 68-1 dibujado al diente.
 * Uso: node --import tsx scripts/mold-joint-render.cjs [M10 1.5] [out.png]
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

(async () => {
  const T = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-threads.ts'));
  const F = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-fasteners.ts'));
  const dMm = parseFloat(process.argv[2]) || 10;
  const pitch = parseFloat(process.argv[3]) || undefined;
  const out = process.argv.find((a) => a.endsWith('.png')) || path.resolve(__dirname, '..', 'scratchpad', `joint-M${dMm}.png`);

  const spec = pitch ? T.parseThread(`M${dMm}×${pitch}`) : T.resolveThread(dMm);
  const P = spec.pitch, R = spec.major / 2, { h } = T.threadDims(spec.major, spec.pitch);
  const Le = F.engagementLengthMm(spec, 430);              // engrane real en acero 1.1730
  // perfil ISO 68-1: radio a la altura z (cresta ⅛ / flanco / raíz ¼) — simétrico (engrana ambos lados)
  const prof = (z) => { const cw = 0.125, rw = 0.25, ff = (1 - cw - rw) / 2; const u = ((z / P) % 1 + 1) % 1; if (u < cw) return R; if (u < cw + ff) return R - h * (u - cw) / ff; if (u < cw + ff + rw) return R - h; return R - h + h * (u - cw - ff - rw) / ff; };

  // ── cotas de la unión (mm), z hacia ARRIBA ──────────────────────────────────
  const zB0 = 0, zPart = 40, zA1 = 76;                     // B [0,40] · A [40,76]
  const shankBot = Le, headBot = zA1 - dMm, headTop = zA1; // rosca [0,Le] · caña · cabeza
  const shankR = R, headR = dMm * 0.75, clearR = R + 0.6, cboreR = headR + 0.4, xHalf = dMm * 3.2;
  const boltR = (z) => z < zB0 ? -1 : z <= shankBot ? prof(z) : z <= headBot ? shankR : z <= headTop ? headR : -1;
  const holeB = (z) => z <= shankBot ? prof(z) : clearR;   // B: engrana la rosca / luego paso
  const holeA = (z) => z >= headBot ? cboreR : clearR;     // A: paso / avellanado

  // clasifica un punto mundo (x,z) → {kind:'bolt'|'A'|'B'|null, edge}
  const STEEL_A = [176, 182, 196], STEEL_B = [150, 156, 172], BOLT = [96, 105, 128], BOLT_HI = [168, 178, 205];
  const classify = (x, z) => {
    const ax = Math.abs(x);
    const br = boltR(z);
    if (br > 0 && ax <= br) return { kind: 'bolt', edge: br };
    if (z >= zB0 && z <= zPart && ax >= holeB(z) && ax <= xHalf) return { kind: 'B', edge: holeB(z) };
    if (z >= zPart && z <= zA1 && ax >= holeA(z) && ax <= xHalf) return { kind: 'A', edge: holeA(z) };
    return { kind: null };
  };

  // ── lienzo ──────────────────────────────────────────────────────────────────
  const W = 900, H = 1180, img = Buffer.alloc(W * H * 4);
  const BG = [20, 22, 27]; for (let i = 0; i < W * H; i++) { img[i * 4] = BG[0]; img[i * 4 + 1] = BG[1]; img[i * 4 + 2] = BG[2]; img[i * 4 + 3] = 255; }
  const mgn = 80, sc = Math.min((W - 2 * mgn) / (2 * xHalf), (H - 2 * mgn) / (zA1 - zB0));
  const X0 = W / 2, Z0 = Math.round(H / 2 + (zA1 - zB0) / 2 * sc);   // centrado vertical
  const put = (px, py, c, a = 1) => { if (px < 0 || px >= W || py < 0 || py >= H) return; const o = (py * W + px) * 4; img[o] = c[0] * a + img[o] * (1 - a); img[o + 1] = c[1] * a + img[o + 1] * (1 - a); img[o + 2] = c[2] * a + img[o + 2] * (1 - a); };
  // pinta un pixel según clasificación (compartido por vista principal e inset)
  const paint = (px, py, x, z, scl) => {
    const r = classify(x, z); if (!r.kind) return;
    if (r.kind === 'bolt') {                                // tornillo SÓLIDO (no se raya) + modelado cilíndrico
      const t = Math.max(0, Math.min(1, (r.edge - Math.abs(x)) / (r.edge + 1e-3)));
      const light = 0.60 + 0.40 * Math.sqrt(t) + (x < 0 ? 0.10 : -0.05);
      put(px, py, BOLT.map((v, i) => Math.min(255, v * light + BOLT_HI[i] * 0.08 * t)));
    } else {
      const base = r.kind === 'B' ? STEEL_B : STEEL_A;
      const diag = r.kind === 'B' ? (px + py) : (px - py);  // rayado 45° opuesto por placa
      const hatch = (((diag % 10) + 10) % 10) < 2 ? 0.5 : 1.0;
      put(px, py, base.map((v) => v * hatch));
      if (Math.abs(x) - r.edge < 0.9 / scl) put(px, py, [26, 28, 36]);   // contorno del barreno
    }
  };

  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) paint(px, py, (px - X0) / sc, (Z0 - py) / sc, sc);
  // partición A|B (oro)
  for (let px = 0; px < W; px++) put(px, Z0 - Math.round(zPart * sc), [230, 185, 95], 0.55);

  // ── INSET: zoom del engrane (teeth meshing) top-derecha ─────────────────────
  const iw = 300, ih = 340, ix = W - iw - 24, iy = 24;
  const zTopI = Le + 3, zc = zTopI / 2, zoom = (ih / 2) / zc;   // z∈[0, Le+3] justo
  const iX0 = ix + iw / 2, iZ0 = iy + ih / 2;
  for (let py = iy; py < iy + ih; py++) for (let px = ix; px < ix + iw; px++) { const o = (py * W + px) * 4; img[o] = 12; img[o + 1] = 13; img[o + 2] = 17; }
  for (let py = iy; py < iy + ih; py++) for (let px = ix; px < ix + iw; px++) { const x = (px - iX0) / zoom, z = zc + (iZ0 - py) / zoom; paint(px, py, x, z, zoom); }
  const frame = [130, 235, 165];
  for (let px = ix; px < ix + iw; px++) { put(px, iy, frame); put(px, iy + ih - 1, frame); }
  for (let py = iy; py < iy + ih; py++) { put(ix, py, frame); put(ix + iw - 1, py, frame); }
  // corchete de engrane en la vista principal + leader al inset
  const bx = X0 + Math.round((clearR + 3) * sc);
  for (let z = zB0; z <= Le; z += 0.08) { const py = Z0 - Math.round(z * sc); put(bx, py, frame); put(bx + 1, py, frame); }
  for (let dx = 0; dx <= 12; dx++) { put(bx - dx, Z0 - Math.round(zB0 * sc), frame); put(bx - dx, Z0 - Math.round(Le * sc), frame); }

  fs.writeFileSync(out, encodePNG(W, H, img));
  console.log(`${spec.desig}  ·  B roscada [0,${zPart}] (engrane ${Le}mm) + A de paso [${zPart},${zA1}]  ·  acopla=${T.threadsMate(spec, spec)}`);
  console.log(`→ ${out}`);
})().catch((e) => { console.error('JOINT_FATAL', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
