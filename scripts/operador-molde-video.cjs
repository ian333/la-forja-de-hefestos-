/**
 * EL OPERADOR 𝔄, EN VIDEO — la sección del molde enfriando, vista desde los DOS lados.
 * ============================================================================
 * "enséñame cómo demonios se aplica mi operador… ya no quiero ver números, puras
 *  simulaciones" (user 2026-07-16). Este video es la respuesta:
 *
 *   IZQUIERDA · ESPACIO REAL: la sección del molde (acero P20, cavidad con forma de
 *     tupper a 239 °C, 6 canales de agua a 60) — el calor viajando de la pieza al agua.
 *     Se ve complicado porque AHÍ todo está acoplado.
 *   DERECHA · LA CARA-𝔦: el MISMO campo, transformado. Cada pixel es un modo, y cada
 *     modo hace UNA sola cosa: decaer con su exponencial. a_k(t+dt) = a_k(t)·e^(αλ_k dt).
 *     El paso del tiempo es multiplicar por una LUT. Eso ES el operador: la base donde
 *     el problema se vuelve diagonal.
 *   ABAJO: T del punto más caliente contra el tiempo + el reloj del paso espectral.
 *
 * HONESTIDAD EN PANTALLA (para no vender de más):
 *   · α constante = acero P20 (12.3 mm²/s) en todo el dominio; el plástico entra como
 *     DEPÓSITO inicial de calor con forma de pieza. La interfaz plástico/acero real
 *     rompe la simetría → "siguiente cara" (acuerdo con el user).
 *   · los canales interiores se imponen por PROYECCIÓN Dirichlet tras cada paso
 *     (splitting de 1er orden): difusión espectral EXACTA + amarre del agua.
 *
 * Salida: frames SVG → PNG (playwright) → NVENC 4K en iangpu (mandato 4K de CLAUDE.md).
 * Uso: node --import tsx scripts/operador-molde-video.cjs <outdir> [--frames N] [--proof]
 */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

// ── mini-PNG (zlib nativo + CRC32): el campo viaja EMBEBIDO en el SVG ──────
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};
function pngRGB(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const chunk = (type, data) => {
    const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;                                  // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// rampa térmica de la casa (la de las hojas): frío apagado → ámbar → blanco caliente
const RAMP = [[13, 17, 26], [42, 22, 60], [122, 30, 60], [219, 91, 46], [255, 176, 59], [255, 241, 200]];
const ramp = (u) => {
  const t = Math.max(0, Math.min(0.999, u)) * (RAMP.length - 1);
  const i = Math.floor(t), f = t - i, a = RAMP[i], b = RAMP[Math.min(RAMP.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

(async () => {
  const C = await import(path.join(ROOT, 'src', 'forja', 'campo', 'campo.ts'));
  const out = process.argv[2] || '/tmp/opv';
  const proof = process.argv.includes('--proof');
  const fIdx = process.argv.indexOf('--frames');
  // OJO: indexOf da -1 si no está la bandera → argv[0] = la ruta de node → Number(...)=NaN
  const NF = proof ? 4 : (fIdx >= 0 ? Number(process.argv[fIdx + 1]) : 360);
  fs.mkdirSync(out, { recursive: true });

  // ── LA SECCIÓN DEL MOLDE: 144×96 mm, celda 0.75 ─────────────────────────
  const nx = 192, ny = 128, cell = 0.75;
  const Tc = 60, Tm = 239, alphaAcero = 12.3;               // P20: 1.23e-5 m²/s
  const c = C.crearCampo3({ nx, ny, nz: 1, cellMm: cell, fill: Tc });

  // la CAVIDAD (sección de tupper: base + dos paredes, en mm del dominio)
  const enCavidad = (x, y) =>
    (x >= 27 && x <= 117 && y >= 28 && y <= 31) ||          // la base de la pieza
    (x >= 27 && x <= 30 && y >= 28 && y <= 60) ||           // pared izquierda
    (x >= 114 && x <= 117 && y >= 28 && y <= 60);           // pared derecha
  // los CANALES de agua (⌀7, 3 abajo + 3 arriba — la plantilla clásica del cap 9)
  const canales = [[42, 16], [72, 16], [102, 16], [42, 74], [72, 74], [102, 74]];
  const enCanal = (x, y) => canales.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= 3.5 ** 2);

  const cavIdx = [], chIdx = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (i + 0.5) * cell, y = (j + 0.5) * cell;
    if (enCavidad(x, y)) cavIdx.push(C.idx3(c, i, j, 0));
    else if (enCanal(x, y)) chIdx.push(C.idx3(c, i, j, 0));
  }
  for (const t of cavIdx) c.data[t] = Tm;                   // el depósito de la inyección

  const op = C.crearDifusionEspectral(c, { alphaMm2s: alphaAcero, tBordeC: Tc });
  const dt = 0.085;                                          // 360 cuadros ⇒ ~30 s de física

  // la cara para el PANEL DERECHO (espectro del campo, calculado aparte del paso)
  const caraX = C.caraDirichlet(nx, cell), caraY = C.caraDirichlet(ny, cell);
  const espectro = () => {
    // DST 2D de (T − Tc): primero x, luego y — mismas matrices autoinversas del operador
    const a = Float32Array.from(c.data, (v) => v - Tc);
    const fila = new Float32Array(nx);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) fila[i] = a[j * nx + i];
      for (let m = 0; m < nx; m++) {
        let s = 0;
        for (let i = 0; i < nx; i++) s += caraX.modos[m * nx + i] * fila[i];
        a[j * nx + m] = s;
      }
    }
    const col = new Float32Array(ny);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) col[j] = a[j * nx + i];
      for (let m = 0; m < ny; m++) {
        let s = 0;
        for (let j = 0; j < ny; j++) s += caraY.modos[m * ny + j] * col[j];
        a[m * nx + i] = s;
      }
    }
    return a;
  };
  const esp0 = espectro();
  let espMax = 0;
  for (let t = 0; t < esp0.length; t++) espMax = Math.max(espMax, Math.abs(esp0[t]));

  // ── un frame → SVG (campo y espectro EMBEBIDOS como PNG pixelado) ────────
  const MX = 96, MY = 64;                                    // el barrio bajo del espectro
  const curva = [];
  const frameSVG = (fi, tS) => {
    // panel IZQ: el campo real
    const rgbF = Buffer.alloc(nx * ny * 3);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const t = j * nx + i;
      let col;
      if (enCanal((i + 0.5) * cell, (j + 0.5) * cell)) col = [64, 156, 255];      // el agua
      // gamma 0.45: PERCEPTUAL, no fisico — sin el, el halo tibio (70-90 °C) se ve negro
      else col = ramp(Math.pow(Math.max(0, (c.data[t] - Tc) / (Tm - Tc)), 0.45));
      const o = ((ny - 1 - j) * nx + i) * 3;                 // y arriba
      rgbF[o] = col[0]; rgbF[o + 1] = col[1]; rgbF[o + 2] = col[2];
    }
    // panel DER: la cara (log para ver los modos débiles)
    const es = espectro();
    const rgbS = Buffer.alloc(MX * MY * 3);
    for (let j = 0; j < MY; j++) for (let i = 0; i < MX; i++) {
      const v = Math.abs(es[j * nx + i]) / espMax;
      const u = Math.log10(1 + v * 999) / 3;                 // 0..1 en 3 décadas
      const col = ramp(u);
      const o = (j * MX + i) * 3;
      rgbS[o] = col[0]; rgbS[o + 1] = col[1]; rgbS[o + 2] = col[2];
    }
    const b64F = pngRGB(nx, ny, rgbF).toString('base64');
    const b64S = pngRGB(MX, MY, rgbS).toString('base64');

    // la curva del punto más caliente
    let tMax = -1e9;
    for (const t of cavIdx) tMax = Math.max(tMax, c.data[t]);
    curva.push([tS, tMax]);
    const W = 1920, H = 1080;
    const pts = curva.map(([tt, T]) =>
      `${(120 + (tt / (NF * dt)) * 1680).toFixed(1)},${(1020 - ((T - Tc) / (Tm - Tc)) * 145).toFixed(1)}`).join(' ');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,Menlo,monospace">
<rect width="${W}" height="${H}" fill="#0b0f16"/>
<text x="60" y="56" font-size="30" fill="#eaf2ff">EL OPERADOR 𝔄 EN EL MOLDE — el mismo campo, visto desde los dos lados</text>
<text x="60" y="88" font-size="17" fill="#5d7290">difusión en el acero P20 · cavidad (tupper) inyectada a 239 °C · 6 canales de agua a 60 °C · paso espectral EXACTO, sin sub-pasos</text>

<text x="60" y="150" font-size="21" fill="#8fa3bf">ESPACIO REAL · T(x,y) — aquí todo está acoplado</text>
<image x="60" y="170" width="864" height="576" href="data:image/png;base64,${b64F}" style="image-rendering:pixelated"/>
<rect x="60" y="170" width="864" height="576" fill="none" stroke="#2a3446"/>

<text x="996" y="150" font-size="21" fill="#8fa3bf">LA CARA-𝔦 · el MISMO campo, transformado — aquí es DIAGONAL</text>
<image x="996" y="170" width="864" height="576" href="data:image/png;base64,${b64S}" style="image-rendering:pixelated"/>
<rect x="996" y="170" width="864" height="576" fill="none" stroke="#2a3446"/>
<text x="996" y="778" font-size="19" fill="#f2c14e">cada pixel = UN modo · cada modo solo DECAE: a_k(t+dt) = a_k(t) · e^(α·λ_k·dt)</text>
<text x="996" y="806" font-size="16" fill="#5d7290">un paso de tiempo = multiplicar por la LUT — nada que resolver.</text>
<text x="996" y="830" font-size="16" fill="#5d7290">los modos altos mueren primero (|λ| grande): el espectro se CONTRAE hacia la esquina.</text>

<text x="60" y="806" font-size="17" fill="#5d7290">azul = agua (Dirichlet) · el calor de la pieza corre por el acero hacia los canales</text>

<polyline points="${pts}" fill="none" stroke="#f2c14e" stroke-width="3"/>
<line x1="120" y1="1020" x2="1800" y2="1020" stroke="#2a3446"/>
<text x="60" y="858" font-size="19" fill="#8fa3bf">T del punto más caliente de la pieza</text>
<text x="120" y="1046" font-size="15" fill="#5d7290">0 s</text>
<text x="1760" y="1046" font-size="15" fill="#5d7290">${(NF * dt).toFixed(0)} s</text>
<text x="1180" y="880" font-size="24" fill="#eaf2ff">t = ${tS.toFixed(2)} s · paso espectral #${fi} · dt ${Math.round(dt * 1000)} ms EXACTO</text>
<text x="1180" y="912" font-size="19" fill="#7ee0a0">T_max pieza = ${tMax.toFixed(1)} °C</text>

<text x="60" y="1064" font-size="14" fill="#44506a">honesto: α constante del ACERO (12.3 mm²/s); el plástico entra como depósito inicial. Canales = proyección Dirichlet por paso (splitting). Interfaz plástico/acero = siguiente cara del operador.</text>
</svg>`;
  };

  console.log(`SIM: ${nx}×${ny} · celda ${cell} mm · α acero ${alphaAcero} mm²/s · ${NF} cuadros × dt ${dt} s = ${(NF * dt).toFixed(1)} s de física`);
  const t0 = Date.now();
  for (let f = 0; f < NF; f++) {
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.svg`), frameSVG(f, f * dt));
    op.paso(dt);
    for (const t of chIdx) c.data[t] = Tc;                  // el agua amarra (splitting)
    if (f % 60 === 0) console.log(`  cuadro ${f}/${NF} · ${Date.now() - t0} ms`);
  }
  console.log(`${NF} SVG en ${Date.now() - t0} ms → ${out}`);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
