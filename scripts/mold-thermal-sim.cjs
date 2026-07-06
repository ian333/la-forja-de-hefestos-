/**
 * SIMULACIÓN TÉRMICA DEL MOLDE — el CICLO DE INYECCIÓN sobre la SECCIÓN REAL.
 * ============================================================================
 * FDM 2D explícito de la ecuación de calor con materiales reales:
 *   P20:  k=32 W/m°C, ρ=7850, Cp=460  → α=8.86e-6 m²/s
 *   ABS:  k=0.19,     ρ=1050, Cp=2345 → α=7.7e-8  (Kazmer usa 8.69e-8: Cp efectivo)
 * Sección del molde bezel (y=0): cavity plate abajo + CAVIDAD 1.5mm (el plástico
 * ENTRA desde el gate durante el llenado 0.25s a 239°C) + core plate arriba +
 * 8 canales ⌀6.35 a 60°C (convección fuerte → Dirichlet) + partición.
 * 3 CICLOS completos (llenado→enfriamiento→expulsión) para VER el calor
 * acumulándose en el acero alrededor de la cavidad.
 */
const { writeFileSync, mkdirSync } = require('fs');
const { Resvg } = require('@resvg/resvg-js');

// ── dominio: sección de 340×100 mm, celda 0.5 mm ──
const h = 0.5e-3, NX = 680, NY = 200;
const W_mm = NX * 0.5, H_mm = NY * 0.5;
// geometría (mm, origen esquina inferior izquierda; partición en y=60)
const yPart = 60, tCav = 1.5;                       // cavidad: y∈[60, 61.5], x∈[50, 290] (240mm de flujo)
const cavX0 = 50, cavX1 = 290;
const coolR = 3.175, coolDepth = 25.4;              // canales ⌀6.35 a 4D de la cavidad
const canales = [];
for (let i = 0; i < 4; i++) canales.push({ x: 70 + i * 66, y: yPart - tCav - coolDepth });      // en la cavity plate
for (let i = 0; i < 4; i++) canales.push({ x: 103 + i * 66, y: yPart + coolDepth });            // en la core plate
// gate al centro de la cavidad
const gateX = (cavX0 + cavX1) / 2;

// materiales por celda: 0=acero, 1=cavidad(aire→plástico), 2=canal
const mat = new Uint8Array(NX * NY);
const T = new Float32Array(NX * NY).fill(60);       // molde precalentado a 60°C
const filled = new Uint8Array(NX * NY);             // ¿ya llegó el plástico?
const id = (i, j) => j * NX + i;
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
  const x = i * 0.5, y = j * 0.5;
  if (y >= yPart && y < yPart + tCav && x >= cavX0 && x <= cavX1) mat[id(i, j)] = 1;
  for (const c of canales) if ((x - c.x) ** 2 + (y - c.y) ** 2 <= coolR * coolR) mat[id(i, j)] = 2;
}
// Propiedades por material: k (W/m°C) y ρCp (J/m³°C). El FLUX entre celdas usa
// k ARMÓNICA (2kikj/(ki+kj)) — sin esto el acero junto al plástico se calienta a
// 227°C (imposible: la effusividad limita la interfaz a ~71°C).
const K_STEEL = 32, RC_STEEL = 7850 * 460;
const K_ABS = 0.19, RC_ABS = 1050 * 2345;
const dt = (h * h) * RC_STEEL / (4 * K_STEEL) * 0.9;
const vFill = 0.8 * 1000;                            // mm/s (v̄ de diseño, cap 5)
const tFill = (cavX1 - cavX0) / 2 / vFill;           // el frente va del gate a ambos extremos
const tCool = 8;                                     // s de enfriamiento por ciclo (t_c 1.5mm ≈ 4.7s + margen)
const CYCLES = 3;

const kOf = (k) => (mat[k] === 1 && filled[k] ? K_ABS : K_STEEL);
const rcOf = (k) => (mat[k] === 1 && filled[k] ? RC_ABS : RC_STEEL);
const kH = (a, b) => (2 * a * b) / (a + b);
function step(t, tCycle) {
  // llenado: el plástico aparece en las celdas alcanzadas por el frente
  if (tCycle <= tFill + 1e-9) {
    const L = vFill * tCycle;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = id(i, j);
      if (mat[k] === 1 && !filled[k] && Math.abs(i * 0.5 - gateX) <= L) { filled[k] = 1; T[k] = 239; }
    }
  }
  const Tn = new Float32Array(T);
  for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
    const k = id(i, j);
    if (mat[k] === 2) { Tn[k] = 60; continue; }               // canal: refrigerante
    if (mat[k] === 1 && !filled[k]) { Tn[k] = 60; continue; } // cavidad vacía ≈ molde
    const ki = kOf(k);
    let flux = 0;
    for (const nb of [k - 1, k + 1, k - NX, k + NX]) flux += kH(ki, kOf(nb)) * (T[nb] - T[k]);
    Tn[k] = T[k] + (dt / (rcOf(k) * h * h)) * flux;
  }
  T.set(Tn);
}

// ── render: colormap ironbow sobre la geometría + contorno del molde ──
const colormap = (t) => {  // t∈[60,239] → ironbow
  let u = Math.max(0, Math.min(1, (t - 60) / (239 - 60)));
  u = Math.pow(u, 0.38);                          // gamma: el halo 60→80°C del acero SE VE
  const r = Math.min(255, Math.round(480 * u)); 
  const g = Math.round(u < 0.5 ? 90 * u : 45 + 210 * (u - 0.5));
  const b = Math.round(u < 0.35 ? 120 + 160 * u : Math.max(0, 176 - 400 * (u - 0.35)));
  return [r, g, b];
};
const PXW = 1360, PXH = 560, sc = 2;                // 0.5mm celda × 2px = 1360×400 el campo
const dir = '/tmp/thermal-frames'; mkdirSync(dir, { recursive: true });
let frame = 0;
function render(cycle, tCycle, phase) {
  // raster del campo como data URI BMP-like… mejor: rects agrupados sería lento.
  // → PNG crudo por Resvg con <image> es complejo; hago un PPM→no. SVG con RECTS de 2px
  // sería 136k rects. SOLUCIÓN: raster manual a PNG con zlib crudo... uso trick:
  // downsample ×2 (celda 1mm → 340×100 px, escalado ×4 en <image xlink> base64 PNG).
  const w = 340, hh = 100;
  const png = rawPNG(w, hh, (x, y) => {
    const i = Math.min(NX - 1, x * 2), j = Math.min(NY - 1, (hh - 1 - y) * 2);
    const k = id(i, j);
    if (mat[k] === 2) return [40, 120, 255];                      // canal
    if (mat[k] === 1 && !filled[k]) return [16, 20, 26];          // cavidad vacía
    const [r, g, b] = colormap(T[k]);
    return mat[k] === 1 ? [Math.min(255, r + 30), g, b] : [r, g, b];
  });
  const b64 = png.toString('base64');
  const iso = [];   // isotermas 97.6 (eyección) y 100/150/200 en el plástico… simple: marcador de T máx del acero
  let maxSteel = 0, TcCav = 0, nCav = 0;
  for (let k = 0; k < NX * NY; k++) {
    if (mat[k] === 0 && T[k] > maxSteel) maxSteel = T[k];
    if (mat[k] === 1 && filled[k]) { TcCav += T[k]; nCav++; }
  }
  const svg = `<svg width="${PXW}" height="${PXH}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<rect width="${PXW}" height="${PXH}" fill="#0b0e13"/>
<text x="40" y="40" fill="#e8eef7" font-family="Inter,sans-serif" font-size="22" font-weight="700">CICLO DE INYECCIÓN — campo térmico REAL (FDM 2D) · molde bezel, sección A-A</text>
<image x="0" y="70" width="${PXW}" height="400" preserveAspectRatio="none" xlink:href="data:image/png;base64,${b64}" style="image-rendering:pixelated"/>
<text x="40" y="${PXH - 48}" fill="#e8eef7" font-size="19" font-family="monospace">CICLO ${cycle}/${CYCLES} · ${phase} · t=${tCycle.toFixed(2)} s · T̄ plástico ${(nCav ? TcCav / nCav : 0).toFixed(0)}°C · acero máx ${maxSteel.toFixed(0)}°C</text>
<text x="40" y="${PXH - 20}" fill="#8fa3bd" font-size="14" font-family="monospace">P20 α=8.9e-6 · ABS α=8.7e-8 · canales ⌀6.35 @60°C (depth 4D, Eq 9.22) · inyección 239°C · v̄ 0.8 m/s</text>
<rect x="${PXW - 320}" y="86" width="300" height="16" fill="url(#g)"/><defs><linearGradient id="g">${[0,0.25,0.5,0.75,1].map((u)=>{const[r,g2,b]=colormap(60+u*179);return `<stop offset="${u}" stop-color="rgb(${r},${g2},${b})"/>`;}).join('')}</linearGradient></defs>
<text x="${PXW - 320}" y="120" fill="#8fa3bd" font-size="12" font-family="monospace">60°C</text><text x="${PXW - 56}" y="120" fill="#8fa3bd" font-size="12" font-family="monospace">239°C</text>
</svg>`;
  writeFileSync(`${dir}/f${String(frame++).padStart(4, '0')}.png`, new Resvg(svg, { background: '#0b0e13' }).render().asPng());
}
// PNG RGB crudo mínimo (sin filtros, zlib store) — suficiente para resvg
const zlib = require('zlib');
function rawPNG(w, hh, px) {
  const raw = Buffer.alloc((w * 3 + 1) * hh);
  for (let y = 0; y < hh; y++) { raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) { const [r, g, b] = px(x, y); const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  const chunks = [];
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(require('zlib').crc32 ? zlib.crc32(td) : crc32(td)); return Buffer.concat([len, td, crc]); };
  function crc32(buf) { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(hh, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  const FPS_SIM = 12;                                 // frames por segundo simulado
  for (let cy = 1; cy <= CYCLES; cy++) {
    filled.fill(0);
    // vaciar la cavidad (expulsión del ciclo anterior)
    for (let k = 0; k < NX * NY; k++) if (mat[k] === 1) T[k] = 60;
    let t = 0;
    const tTotal = tFill + tCool;
    let nextShot = 0;
    while (t < tTotal) {
      step(t, t); t += dt;
      if (t >= nextShot) { render(cy, t, t <= tFill ? 'LLENADO ▶' : 'ENFRIAMIENTO ❄'); nextShot += 1 / FPS_SIM * (t <= tFill ? 0.12 : 1); }
    }
    render(cy, t, 'EXPULSIÓN ⏏');
  }
  console.log('FRAMES_OK', frame);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
