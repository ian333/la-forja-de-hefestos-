/**
 * EL OPERADOR 𝔄 EN 3D — el molde COMPLETO enfriando, no una lámina.
 * ============================================================================
 * "ahora hazlo 3D, resuelve las ecuaciones: es un MOLDE, no una lámina de metal"
 * (user 2026-07-16). Las ecuaciones YA eran 3D (campo.ts: tres caras, LUT tensor
 * ex·ey·ez — el gate lo probó en 9×7×5). Lo que faltaba era el DOMINIO real y verlo:
 *
 *   · BLOQUE de acero P20 120×90×72 mm (≈778k vóxeles)
 *   · CAVIDAD 3D con forma de tupper (base + 4 paredes, pared 3 mm) inyectada a 239 °C
 *   · 6 LÍNEAS de agua ⌀7 ATRAVESANDO el bloque (3 abajo, 3 arriba — cap 9)
 *   · paso espectral 3D EXACTO: dT/dt = α∇²T resuelto por el operador, sin sub-pasos
 *
 * EL RENDER (volumen, no rebanada): splats con mezcla back-to-front en proyección
 * isométrica que ROTA — solo se pintan el CALOR (rampa térmica, translúcido) y el AGUA
 * (azul). El acero no se pinta: es el vacío oscuro donde el fantasma de calor flota.
 * Es el estilo "burbuja de calor" que ya vive en el CAD, ahora con la física del operador.
 *
 * PANEL DERECHO: la cara-𝔦 en 3D — energía por modo (mx,my) SUMADA en mz. La contracción
 * hacia la esquina es la diagonalización trabajando en las TRES dimensiones a la vez.
 *
 * Honestidad en pantalla: α constante del acero (plástico = depósito inicial), agua por
 * proyección Dirichlet (splitting), interfaz plástico/acero = siguiente cara.
 *
 * Uso: node --import tsx scripts/operador-molde-3d-video.cjs <outdir> [--proof]
 */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

// ── mini-PNG + rampa (idénticos al video 2D — autocontenido a propósito) ────
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
const RAMP = [[13, 17, 26], [42, 22, 60], [122, 30, 60], [219, 91, 46], [255, 176, 59], [255, 241, 200]];
const ramp = (u) => {
  const t = Math.max(0, Math.min(0.999, u)) * (RAMP.length - 1);
  const i = Math.floor(t), f = t - i, a = RAMP[i], b = RAMP[Math.min(RAMP.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};

(async () => {
  const C = await import(path.join(ROOT, 'src', 'forja', 'campo', 'campo.ts'));
  const out = process.argv[2] || '/tmp/op3';
  const proof = process.argv.includes('--proof');
  const NF = proof ? 3 : 360;
  fs.mkdirSync(out, { recursive: true });

  // ── EL MOLDE 3D ───────────────────────────────────────────────────────────
  const nx = 120, ny = 90, nz = 72, cell = 1.0;              // 120×90×72 mm
  const Tc = 60, Tm = 239, alpha = 12.3;                     // P20 (1.23e-5 m²/s)
  const c = C.crearCampo3({ nx, ny, nz, cellMm: cell, fill: Tc });

  // cavidad = TUPPER 3D: base 70×50×3 en z[20..23] + 4 paredes de 3 mm hasta z=50
  const enCav = (x, y, z) => {
    const inX = x >= 25 && x <= 95, inY = y >= 20 && y <= 70;
    if (!inX || !inY) return false;
    if (z >= 20 && z <= 23) return true;                                    // la base
    if (z > 23 && z <= 50) {
      const paredX = x <= 28 || x >= 92, paredY = y <= 23 || y >= 67;
      return paredX || paredY;                                              // las 4 paredes
    }
    return false;
  };
  // 6 LÍNEAS de agua ⌀7 a lo largo de x (atraviesan el bloque, como en el cap 9)
  const lineas = [[27, 12], [45, 12], [63, 12], [27, 58], [45, 58], [63, 58]];
  const enAgua = (y, z) => lineas.some(([ly, lz]) => (y - ly) ** 2 + (z - lz) ** 2 <= 3.5 ** 2);

  const cavIdx = [], aguaIdx = [];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (i + 0.5) * cell, y = (j + 0.5) * cell, z = (k + 0.5) * cell;
    if (enCav(x, y, z)) cavIdx.push(C.idx3(c, i, j, k));
    else if (enAgua(y, z)) aguaIdx.push(C.idx3(c, i, j, k));
  }
  for (const t of cavIdx) c.data[t] = Tm;
  console.log(`MOLDE 3D: ${nx}×${ny}×${nz} = ${(nx * ny * nz / 1000).toFixed(0)}k vóxeles · cavidad ${cavIdx.length} · agua ${aguaIdx.length}`);

  const op = C.crearDifusionEspectral(c, { alphaMm2s: alpha, tBordeC: Tc });
  const dt = 0.085;

  // ── la cara 3D para el panel derecho: energía por (mx,my), sumada en mz ──
  const caraX = C.caraDirichlet(nx, cell), caraY = C.caraDirichlet(ny, cell), caraZ = C.caraDirichlet(nz, cell);
  const MX = 60, MY = 45;
  const espectroXY = () => {
    // DST 3D de (T−Tc) por ejes (misma matriz autoinversa del operador), luego Σ_mz a²
    const a = Float32Array.from(c.data, (v) => v - Tc);
    const buf = new Float32Array(Math.max(nx, ny, nz));
    const pasaEje = (n, stride, baseFor, count, cara) => {
      for (let l = 0; l < count; l++) {
        const base = baseFor(l);
        for (let t = 0; t < n; t++) buf[t] = a[base + t * stride];
        for (let m = 0; m < n; m++) {
          let s = 0;
          for (let t = 0; t < n; t++) s += cara.modos[m * n + t] * buf[t];
          a[base + m * stride] = s;
        }
      }
    };
    pasaEje(nx, 1, (l) => l * nx, ny * nz, caraX);
    pasaEje(ny, nx, (l) => Math.floor(l / nx) * ny * nx + (l % nx), nx * nz, caraY);
    pasaEje(nz, nx * ny, (l) => l, nx * ny, caraZ);
    const E = new Float32Array(MX * MY);
    for (let my = 0; my < MY; my++) for (let mx = 0; mx < MX; mx++) {
      let s = 0;
      for (let mz = 0; mz < nz; mz++) s += a[(mz * ny + my) * nx + mx] ** 2;
      E[my * MX + mx] = Math.sqrt(s);
    }
    return E;
  };
  let esp = espectroXY(), espMax = 0;
  for (let t = 0; t < esp.length; t++) espMax = Math.max(espMax, esp[t]);

  // ── EL VOLUMEN: splats back-to-front en iso ROTANTE ──────────────────────
  const VW = 1000, VH = 840;
  const cx0 = nx * cell / 2, cy0 = ny * cell / 2, cz0 = nz * cell / 2;
  const renderVol = (thetaDeg) => {
    const th = (thetaDeg * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
    const fb = new Float32Array(VW * VH * 3).fill(9);        // fondo casi negro
    const proj = (x, y, z) => {
      const xr = (x - cx0) * cosT - (y - cy0) * sinT;
      const yr = (x - cx0) * sinT + (y - cy0) * cosT;
      return {
        u: VW / 2 + (xr - yr) * 5.2,
        v: VH / 2 + (xr + yr) * 2.45 - (z - cz0) * 5.2,
        d: xr + yr + (z - cz0) * 0.35,
      };
    };
    // junta los splats: calor (T−Tc > 2.5) + agua — el acero NO se pinta
    const splats = [];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const t = (k * ny + j) * nx + i;
      const agua = enAgua((j + 0.5) * cell, (k + 0.5) * cell);
      const dT = c.data[t] - Tc;
      if (!agua && dT < 2.5) continue;
      const p = proj((i + 0.5) * cell, (j + 0.5) * cell, (k + 0.5) * cell);
      let col, aA;
      if (agua) { col = [64, 156, 255]; aA = 0.5; }
      else {
        const u = Math.pow(dT / (Tm - Tc), 0.45);
        col = ramp(u); aA = 0.06 + 0.45 * u;
      }
      splats.push([p.d, p.u, p.v, col[0], col[1], col[2], aA]);
    }
    splats.sort((a, b) => a[0] - b[0]);                      // atrás → adelante
    for (const [, u, v, r, g, b, aA] of splats) {
      const ui = u | 0, vi = v | 0;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        const px = ui + dx, py = vi + dy;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const o = (py * VW + px) * 3;
        fb[o] = fb[o] * (1 - aA) + r * aA;
        fb[o + 1] = fb[o + 1] * (1 - aA) + g * aA;
        fb[o + 2] = fb[o + 2] * (1 - aA) + b * aA;
      }
    }
    // el esqueleto del bloque: 12 aristas tenues (para que el volumen tenga CASA)
    const V0 = [[0, 0, 0], [nx, 0, 0], [nx, ny, 0], [0, ny, 0], [0, 0, nz], [nx, 0, nz], [nx, ny, nz], [0, ny, nz]];
    const E12 = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [a, b] of E12) {
      const pa = proj(V0[a][0] * cell, V0[a][1] * cell, V0[a][2] * cell);
      const pb = proj(V0[b][0] * cell, V0[b][1] * cell, V0[b][2] * cell);
      const n = 220;
      for (let s = 0; s <= n; s++) {
        const px = (pa.u + (pb.u - pa.u) * s / n) | 0, py = (pa.v + (pb.v - pa.v) * s / n) | 0;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const o = (py * VW + px) * 3;
        fb[o] = Math.max(fb[o], 42); fb[o + 1] = Math.max(fb[o + 1], 52); fb[o + 2] = Math.max(fb[o + 2], 70);
      }
    }
    const rgb = Buffer.alloc(VW * VH * 3);
    for (let t = 0; t < fb.length; t++) rgb[t] = Math.min(255, fb[t]);
    return rgb;
  };

  // ── los cuadros ───────────────────────────────────────────────────────────
  const curva = [];
  const t0 = Date.now();
  for (let f = 0; f < NF; f++) {
    const tS = f * dt;
    if (f % 3 === 0 && f > 0) esp = espectroXY();            // la cara, cada 3 cuadros
    let tMax = -1e9;
    for (const t of cavIdx) tMax = Math.max(tMax, c.data[t]);
    curva.push([tS, tMax]);

    const theta = -24 + 90 * (f / NF);                       // la rotación VENDE el 3D
    const b64V = pngRGB(VW, VH, renderVol(theta)).toString('base64');
    const rgbS = Buffer.alloc(MX * MY * 3);
    for (let j = 0; j < MY; j++) for (let i = 0; i < MX; i++) {
      const u = Math.log10(1 + (esp[j * MX + i] / espMax) * 999) / 3;
      const col = ramp(u);
      const o = (j * MX + i) * 3;
      rgbS[o] = col[0]; rgbS[o + 1] = col[1]; rgbS[o + 2] = col[2];
    }
    const b64S = pngRGB(MX, MY, rgbS).toString('base64');
    const pts = curva.map(([tt, T]) =>
      `${(120 + (tt / (NF * dt)) * 1680).toFixed(1)},${(1020 - ((T - Tc) / (Tm - Tc)) * 145).toFixed(1)}`).join(' ');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="ui-monospace,Menlo,monospace">
<rect width="1920" height="1080" fill="#0b0f16"/>
<text x="60" y="56" font-size="30" fill="#eaf2ff">EL OPERADOR 𝔄 EN 3D — el molde completo: dT/dt = α·∇²T resuelto en las tres dimensiones</text>
<text x="60" y="88" font-size="17" fill="#5d7290">bloque P20 120×90×72 mm (${(nx * ny * nz / 1000).toFixed(0)}k vóxeles) · cavidad tupper 3D a 239 °C · 6 líneas de agua ⌀7 · paso espectral 3D EXACTO (LUT ex·ey·ez)</text>
<image x="30" y="120" width="1000" height="840" href="data:image/png;base64,${b64V}"/>
<text x="60" y="985" font-size="16" fill="#5d7290">solo se pinta el CALOR y el AGUA — el acero es el vacío oscuro · la vista rota para que el volumen se LEA</text>
<text x="1100" y="150" font-size="21" fill="#8fa3bf">LA CARA-𝔦 EN 3D · energía por modo (mx,my), Σ en mz</text>
<image x="1100" y="170" width="760" height="570" href="data:image/png;base64,${b64S}" style="image-rendering:pixelated"/>
<rect x="1100" y="170" width="760" height="570" fill="none" stroke="#2a3446"/>
<text x="1100" y="772" font-size="19" fill="#f2c14e">a_k(t+dt) = a_k(t) · e^(α(λx+λy+λz)dt) — DIAGONAL en 3D</text>
<text x="1100" y="798" font-size="16" fill="#5d7290">${(nx * ny * nz / 1000).toFixed(0)}k modos, cada uno con su LUT — el espectro se contrae a la esquina.</text>
<text x="1100" y="852" font-size="24" fill="#eaf2ff">t = ${tS.toFixed(2)} s · paso 3D #${f} · dt ${Math.round(dt * 1000)} ms EXACTO</text>
<text x="1100" y="884" font-size="19" fill="#7ee0a0">T_max pieza = ${curva[curva.length - 1][1].toFixed(1)} °C</text>
<polyline points="${pts}" fill="none" stroke="#f2c14e" stroke-width="3"/>
<line x1="120" y1="1020" x2="1800" y2="1020" stroke="#2a3446"/>
<text x="120" y="1046" font-size="15" fill="#5d7290">0 s</text>
<text x="1760" y="1046" font-size="15" fill="#5d7290">${(NF * dt).toFixed(0)} s</text>
<text x="60" y="1064" font-size="14" fill="#44506a">honesto: α constante del ACERO; plástico = depósito inicial con forma de pieza; agua = proyección Dirichlet por paso; interfaz plástico/acero = siguiente cara del operador.</text>
</svg>`;
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.svg`), svg);
    op.paso(dt);
    for (const t of aguaIdx) c.data[t] = Tc;
    if (f % 30 === 0) console.log(`  cuadro ${f}/${NF} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  console.log(`${NF} SVG 3D en ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
