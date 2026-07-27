/**
 * LA INYECCIÓN EN 3D — el fundido entrando al molde real, por RESISTENCIA.
 * ============================================================================
 * "primero quiero la simulación de la inyección así como lo hiciste con el térmico,
 *  en 3D... y luego lo integramos una vez que esté bien" (user 2026-07-17).
 *
 * LA FÍSICA (la ya verificada, no una animación):
 *   · la pieza REAL del kernel (tupperRealRecipe: 165×120×65, labio, esquinas R20)
 *   · el hueco se voxeliza y el frente avanza por RESISTENCIA (Eq 5.22:
 *     ΔP ∝ L/H^(1+n)) — el gate mold-racetrack probó que así EMERGE el race tracking
 *     y que los flow leaders de §5.5.5 funcionan (9/9)
 *   · el BEBEDERO entra al dominio de flujo: el fundido se ve BAJAR por el canal
 *     antes de tocar la cavidad ("no veo cómo pasa por los canales" — resuelto)
 *   · Q constante (la inyectora llena a velocidad controlada): frac de volumen ∝ t
 *   · presión en máquina = Eq 5.19 sobre la L recorrida — la curva sube en vivo
 *
 * LO QUE SE VE: el molde-bloque en wireframe, las líneas de agua (azul, quietas —
 * aún no enfrían: eso es la INTEGRACIÓN de después), la cavidad VACÍA como fantasma
 * gris, y el fundido encendiéndose vóxel a vóxel POR ORDEN DE LLEGADA (ámbar→morado).
 * La vista rota para que el volumen se lea. CÁMARA LENTA declarada: el llenado real
 * dura ~0.4 s; el video lo estira a 15 s (~40×) — el reloj dice los ms de verdad.
 *
 * HONESTO EN PANTALLA: cuasiestático (frente por resistencia, sin inercia), Q cte,
 * pieza a T_melt uniforme (el enfriamiento DURANTE el llenado = la integración).
 *
 * Local (laptop): iangpu está rindiendo otros videos y NO SE TOCA.
 * Uso: node --import tsx scripts/inyeccion-3d-video.cjs <outdir> [--proof]
 */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!fs.existsSync(cjsGlue)) {
  let s = fs.readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  fs.writeFileSync(cjsGlue, s);
}

// ── mini-PNG + rampa (los mismos de los videos del operador — autocontenido) ─
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
const ramp = (u) => {   // llegó PRIMERO = claro/caliente · lo ÚLTIMO = morado (ahí se atrapa el aire)
  const t = Math.max(0, Math.min(0.999, u)) * (RAMP.length - 1);
  const i = Math.floor(t), f = t - i, a = RAMP[i], b = RAMP[Math.min(RAMP.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};

(async () => {
  const out = process.argv[2] || '/tmp/iny3';
  const proof = process.argv.includes('--proof');
  const NF = proof ? 3 : 360;
  fs.mkdirSync(out, { recursive: true });

  const oc = await require(cjsGlue)({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const TL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'timeline.ts'));
  const TP = await import(path.join(ROOT, 'src', 'forja', 'mold', 'parts', 'tupper.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const F = await import(path.join(ROOT, 'src', 'forja', 'mold', 'filling.ts'));

  // ── LA PIEZA REAL (kernel) + EL BEBEDERO en el dominio de flujo ──────────
  const P = TP.TUPPER_DEFAULT;
  const r = TL.rebuild(K, oc, TP.tupperRealRecipe().timeline);
  if (!r.shape) { console.error('sin sólido'); process.exit(1); }
  const mesh = K.tessellate(oc, r.shape, 0.25, 0.25);
  const q = FM.solidFromMesh(mesh);
  const gate = FM.defaultGate(q);                            // el centro del fondo de la pieza
  const SPRUE_R = 2.5, SPRUE_Z0 = -18;                       // bebedero ⌀5 DEBAJO del gate (lado A abajo en esta vista)
  const cell = Math.min(0.9, P.wallMm * 0.7);
  console.log(`PIEZA kernel: bbox ${r.measure.bbox.join('×')} · vol ${(r.measure.volumeMm3 / 1000).toFixed(2)} cc · gate (${gate.x.toFixed(1)}, ${gate.y.toFixed(1)}, ${gate.z.toFixed(2)})`);

  const t0 = Date.now();
  const field = FL.measureFlowLength({
    x0: q.bbox.x0 - 2, y0: q.bbox.y0 - 2, z0: SPRUE_Z0, x1: q.bbox.x1 + 2, y1: q.bbox.y1 + 2, z1: q.bbox.z1 + 1,
    cellMm: cell, gateMm: { x: gate.x, y: gate.y, z: SPRUE_Z0 + 0.5 },   // el fundido ENTRA por abajo del bebedero
    inCavity: (x, y, z) => {
      if (z < gate.z && (x - gate.x) ** 2 + (y - gate.y) ** 2 <= SPRUE_R ** 2) return true;   // el BEBEDERO
      return q.inside(x, y, z);                                                              // la PIEZA (el molde decide)
    },
    wallMm: P.wallMm, meltN: 0.348,
  });
  const front = FL.createFlowFront(field);
  console.log(`CAMPO: ${field.nx}×${field.ny}×${field.nz} celdas ${cell} mm · ${Date.now() - t0} ms · sin llenar ${field.unreachable}`);

  // FÍSICA cap 5 para el HUD (ABS MG47 — el melt con datos del libro)
  const melt = F.ABS_MG47, wallM = P.wallMm / 1000;
  const vMean = F.convergeVelocity(melt, wallM);
  const gam = F.shearRatePowerLaw(vMean, wallM, melt.n);
  const mu = F.viscosityPowerLaw(melt, gam);
  const pAt = (Lmm) => F.pressureDropSegment(melt, Lmm / 1000, wallM, vMean) / 1e6;
  const tFillS = (field.maxFlowLenMm / 1000) / vMean;        // L/v̄: el reloj REAL
  console.log(`L máx ${field.maxFlowLenMm} mm · t_llenado real ${(tFillS * 1000).toFixed(0)} ms · ΔP máx ${pAt(field.maxFlowLenMm).toFixed(1)} MPa`);

  // prefijo de L-recorrida por frac (para el reloj y la presión, sin rehacer el scan)
  const fr = [];
  for (let f = 0; f <= NF; f++) fr.push(front.frontAt(f / NF));

  // ── EL VOLUMEN (splats back-to-front, iso rotante — el renderer del térmico) ──
  const VW = 1000, VH = 840;
  const cx0 = (q.bbox.x0 + q.bbox.x1) / 2, cy0 = (q.bbox.y0 + q.bbox.y1) / 2, cz0 = (SPRUE_Z0 + q.bbox.z1) / 2;
  const lineas = [[-8], [72]];                                // agua: 3 abajo (z=-8) + 3 arriba (z=72) — quietas: AÚN no enfrían
  const aguaY = [cy0 - 36, cy0, cy0 + 36];
  const renderVol = (thetaDeg, Rt) => {
    const th = (thetaDeg * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
    const fb = new Float32Array(VW * VH * 3).fill(9);
    const proj = (x, y, z) => {
      const xr = (x - cx0) * cosT - (y - cy0) * sinT, yr = (x - cx0) * sinT + (y - cy0) * cosT;
      return { u: VW / 2 + (xr - yr) * 4.6, v: VH / 2 + (xr + yr) * 2.15 - (z - cz0) * 4.6, d: xr + yr + (z - cz0) * 0.35 };
    };
    const splats = [];
    // el DOMINIO DE FLUJO: lleno = rampa por orden de llegada · vacío = fantasma gris
    for (let k = 0; k < field.nz; k++) for (let j = 0; j < field.ny; j++) for (let i = 0; i < field.nx; i++) {
      const t = (k * field.ny + j) * field.nx + i;
      if (!field.cavity[t]) continue;
      const x = field.x0 + (i + .5) * cell, y = field.y0 + (j + .5) * cell, z = field.z0 + (k + .5) * cell;
      const p = proj(x, y, z);
      const R = field.resistance[t];
      if (Number.isFinite(R) && R <= Rt) {
        const u = R / Math.max(1e-9, field.maxResistance);
        const col = ramp(u);
        splats.push([p.d, p.u, p.v, col[0], col[1], col[2], 0.16 + 0.5 * (1 - u)]);
      } else {
        splats.push([p.d, p.u, p.v, 40, 48, 66, 0.045]);     // lo que FALTA por llenar
      }
    }
    // el agua (venas azules, quietas — la INTEGRACIÓN las hará enfriar)
    for (const [lz] of lineas) for (const ly of aguaY) {
      for (let x = q.bbox.x0 - 15; x <= q.bbox.x1 + 15; x += cell) {
        const p = proj(x, ly, lz);
        splats.push([p.d, p.u, p.v, 64, 156, 255, 0.4]);
      }
    }
    splats.sort((a, b) => a[0] - b[0]);
    for (const [, u, v, rr, g, b, aA] of splats) {
      const ui = u | 0, vi = v | 0;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        const px = ui + dx, py = vi + dy;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const o = (py * VW + px) * 3;
        fb[o] = fb[o] * (1 - aA) + rr * aA; fb[o + 1] = fb[o + 1] * (1 - aA) + g * aA; fb[o + 2] = fb[o + 2] * (1 - aA) + b * aA;
      }
    }
    // el esqueleto del bloque
    const bx0 = q.bbox.x0 - 20, bx1 = q.bbox.x1 + 20, by0 = q.bbox.y0 - 20, by1 = q.bbox.y1 + 20, bz0 = SPRUE_Z0 - 4, bz1 = q.bbox.z1 + 12;
    const V0 = [[bx0, by0, bz0], [bx1, by0, bz0], [bx1, by1, bz0], [bx0, by1, bz0], [bx0, by0, bz1], [bx1, by0, bz1], [bx1, by1, bz1], [bx0, by1, bz1]];
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) {
      const pa = proj(...V0[a]), pb = proj(...V0[b]);
      for (let s = 0; s <= 260; s++) {
        const px = (pa.u + (pb.u - pa.u) * s / 260) | 0, py = (pa.v + (pb.v - pa.v) * s / 260) | 0;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const o = (py * VW + px) * 3;
        fb[o] = Math.max(fb[o], 52); fb[o + 1] = Math.max(fb[o + 1], 64); fb[o + 2] = Math.max(fb[o + 2], 86);
      }
    }
    const rgb = Buffer.alloc(VW * VH * 3);
    for (let t = 0; t < fb.length; t++) rgb[t] = Math.min(255, fb[t]);
    return rgb;
  };

  // ── los cuadros ──────────────────────────────────────────────────────────
  const tRender = Date.now();
  const nVoxTot = front.nVox;
  for (let f = 0; f < NF; f++) {
    const frac = proof ? [0.08, 0.45, 0.95][f] : f / (NF - 1);
    const st = fr[Math.round(frac * NF)] ?? front.frontAt(frac);
    const theta = -24 + 90 * frac;
    const b64V = pngRGB(VW, VH, renderVol(theta, st.resistance)).toString('base64');
    // curva de PRESIÓN acumulada hasta este cuadro
    const pts = [];
    for (let g2 = 0; g2 <= Math.round(frac * 120); g2++) {
      const fA = g2 / 120, sA = fr[Math.round(fA * NF)];
      pts.push(`${(1100 + fA * 740).toFixed(1)},${(700 - (pAt(sA.lenMaxMm) / Math.max(1e-9, pAt(field.maxFlowLenMm))) * 210).toFixed(1)}`);
    }
    const tMs = frac * tFillS * 1000;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="ui-monospace,Menlo,monospace">
<rect width="1920" height="1080" fill="#0b0f16"/>
<text x="60" y="56" font-size="30" fill="#eaf2ff">LA INYECCIÓN EN 3D — el fundido entra por RESISTENCIA (Eq 5.22), no por cercanía</text>
<text x="60" y="88" font-size="17" fill="#5d7290">tupper REAL del kernel (165×120×65 · labio · esquinas R20) · bebedero ⌀5 · ${(nVoxTot / 1000).toFixed(0)}k vóxeles de fundido · cámara lenta ${(15 / tFillS).toFixed(0)}×</text>
<image x="30" y="110" width="1000" height="840" href="data:image/png;base64,${b64V}"/>
<text x="60" y="975" font-size="16" fill="#5d7290">ámbar = llegó primero · morado = lo último (ahí se atrapa el aire) · gris = falta · azul = agua (quieta: la INTEGRACIÓN térmica es el paso siguiente)</text>
<text x="1100" y="150" font-size="21" fill="#8fa3bf">LO QUE SIENTE LA MÁQUINA</text>
<text x="1100" y="186" font-size="34" fill="#eaf2ff">t = ${tMs.toFixed(0)} ms</text>
<text x="1100" y="216" font-size="17" fill="#7ee0a0">llenado ${(frac * 100).toFixed(0)} % del volumen · L recorrida ${st.lenMaxMm.toFixed(1)} / ${field.maxFlowLenMm} mm</text>
<text x="1100" y="452" font-size="19" fill="#8fa3bf">ΔP en la compuerta (Eq 5.19) — sube al ALARGARSE el recorrido</text>
<polyline points="${pts.join(' ')}" fill="none" stroke="#f2c14e" stroke-width="3"/>
<line x1="1100" y1="700" x2="1840" y2="700" stroke="#2a3446"/>
<text x="1100" y="726" font-size="15" fill="#5d7290">0 ms</text>
<text x="1780" y="726" font-size="15" fill="#5d7290">${(tFillS * 1000).toFixed(0)} ms</text>
<text x="1100" y="760" font-size="22" fill="#f2c14e">ΔP = ${pAt(st.lenMaxMm).toFixed(1)} / ${pAt(field.maxFlowLenMm).toFixed(1)} MPa</text>
<text x="1100" y="810" font-size="16" fill="#5d7290">v̄ ${vMean.toFixed(2)} m/s (Eq 5.23) · γ̇ ${gam.toFixed(0)} 1/s (Eq 5.21) · μ ${mu.toFixed(0)} Pa·s</text>
<text x="1100" y="836" font-size="16" fill="#5d7290">frente = iso-RESISTENCIA: una pared gruesa se llena antes que una delgada</text>
<text x="1100" y="862" font-size="16" fill="#5d7290">igual de lejos — el RACE TRACKING de §5.5.5, emergiendo de la geometría</text>
<text x="60" y="1044" font-size="14" fill="#44506a">honesto: cuasiestático (frente por resistencia, sin inercia) · Q constante · fundido a T_melt uniforme — el ENFRIAMIENTO durante el llenado es la integración con el térmico (siguiente paso) · render: iangpu (nice 10, junto a la cola de video)</text>
</svg>`;
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.svg`), svg);
    if (f % 60 === 0) console.log(`  cuadro ${f}/${NF} · ${((Date.now() - tRender) / 1000).toFixed(0)} s`);
  }
  console.log(`${NF} SVG en ${((Date.now() - tRender) / 1000).toFixed(0)} s → ${out}`);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
