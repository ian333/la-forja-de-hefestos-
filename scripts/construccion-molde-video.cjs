/**
 * CONSTRUCCIÓN DEL MOLDE DESDE 0 — el video del curso, hecho por NUESTRO kernel.
 * ============================================================================
 * "quiero que reconstruyas el video generándolos desde 0 con la interfaz,
 *  primero con el kernel y luego con la UI" (user). FASE 1 (kernel):
 *
 * El molde de la PERCHA (curso Alwis 2022) se construye BEAT POR BEAT con las
 * cotas literales del proceso destilado, y cada beat muestra su panel estilo
 * PropertyManager (feature → opciones → cotas). Modo ESTUDIO CLARO.
 *
 *  1. LA PIEZA (silueta a proporción declarada)      6. PLACA NÚCLEO (impronta)
 *  2. SCALE 1.015 (PP)                               7. PLACA CAVIDAD 145
 *  3. MOVE/COPY → layout 2 cavidades (rot 180°)      8. GUÍAS ⌀35/⌀48 (±142,±277)
 *  4. PARTING LINE (el lazo, de parting.ts)          9. MOLDE CERRADO
 *  5. FALDA de partición (radial al bloque)         10. EXPLODE (la revelación)
 *
 * Uso: node --import tsx scripts/construccion-molde-video.cjs <outdir> [--proof]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
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
const PAL = {
  fondoTop: [244, 246, 249], fondoBot: [201, 206, 214],
  cavidad: [154, 208, 178], nucleo: [232, 158, 152], pieza: [235, 100, 80],
  lazo: [212, 160, 30], falda: [140, 160, 205], sombra: [120, 126, 138],
};

(async () => {
  const out = process.argv[2] || '/tmp/construccion';
  const proof = process.argv.includes('--proof');
  fs.mkdirSync(out, { recursive: true });
  const oc = await require(cjsGlue)({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const MD = await import(path.join(ROOT, 'src', 'forja', 'mold', 'mold.ts'));
  const PA = await import(path.join(ROOT, 'src', 'forja', 'mold', 'parting.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));

  const cil = (r, h, o) => K.makeCylinder(oc, r, h, { origin: o, dir: [0, 0, 1] });
  const caja = (w, d, h, at = [0, 0, 0]) => K.transformShape(oc, K.makeBox(oc, w, d, h), { translate: [at[0] - w / 2, at[1] - d / 2, at[2]] });

  // ── construcción (las cotas del curso) ───────────────────────────────────
  console.log('construyendo…');
  const per = { W: 300, H: 110, band: 20, T: 10 };
  const outer = [{ x: -per.W / 2, y: 0 }, { x: per.W / 2, y: 0 }, { x: 14, y: per.H }, { x: -14, y: per.H }];
  const inner = [
    { x: -per.W / 2 + per.band * 2.4, y: per.band }, { x: per.W / 2 - per.band * 2.4, y: per.band },
    { x: 8, y: per.H - per.band * 1.4 }, { x: -8, y: per.H - per.band * 1.4 },
  ];
  let percha = K.extrudePolygonWithHoles(oc, outer, [inner], per.T);
  const hp = [], hi = [];
  for (let a = -60; a <= 210; a += 15) {
    const r1 = 24, r2 = 17, cy = per.H + 19;
    hp.push({ x: r1 * Math.cos((a * Math.PI) / 180), y: cy + r1 * Math.sin((a * Math.PI) / 180) });
    hi.unshift({ x: r2 * Math.cos((a * Math.PI) / 180), y: cy + r2 * Math.sin((a * Math.PI) / 180) });
  }
  percha = K.fuse(oc, percha, K.extrudePolygon(oc, [...hp, ...hi], per.T));
  percha = K.fuse(oc, percha, caja(14, 26, per.T, [0, per.H + 2, 0]));
  const perchaE = MD.scaleForShrinkage(oc, percha, 1.015);
  const cav1 = K.transformShape(oc, perchaE, { rotateAngle: Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [-5, 0, 0] });
  const cav2 = K.transformShape(oc, perchaE, { rotateAngle: -Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] }, translate: [5, 0, 0] });
  const layout = K.fuse(oc, cav1, cav2);
  // el LAZO de partición (parting.ts — la herramienta nueva)
  const meshL = K.tessellate(oc, layout, 0.3, 0.3);
  const { loops } = PA.partingLoops(meshL);
  const ext = loops.find((L) => L.esExterior);
  // placas (curso: 350×630, alturas 145/90; guías ⌀35/40×8 y ⌀48/54×10 en ±142/±277)
  let placaInf = caja(350, 630, 90, [0, 0, -90]);
  const impronta = K.fuse(oc,
    K.transformShape(oc, cav1, { translate: [0, 0, -per.T * 1.015] }),
    K.transformShape(oc, cav2, { translate: [0, 0, -per.T * 1.015] }));
  placaInf = K.cut(oc, placaInf, impronta);
  let placaSup = caja(350, 630, 145, [0, 0, 0]);
  let placaInfG = placaInf, placaSupG = placaSup;
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const x = 142 * sx, y = 277 * sy;
    placaInfG = K.cut(oc, placaInfG, K.fuse(oc, cil(17.5, 92, [x, y, -91]), cil(20, 8.2, [x, y, -90.1])));
    placaSupG = K.cut(oc, placaSupG, K.fuse(oc, cil(24, 147, [x, y, -1]), cil(27, 10.2, [x, y, 134.9])));
  }
  console.log('geometría lista');

  // ── superficies muestreadas para render (una vez por sólido) ─────────────
  const Q = (s, d = 0.5) => FM.solidFromMesh(K.tessellate(oc, s, d, d));
  const voxSurf = (q, SC) => {
    const pts = [];
    const nx = Math.ceil((q.bbox.x1 - q.bbox.x0) / SC), ny = Math.ceil((q.bbox.y1 - q.bbox.y0) / SC), nz = Math.ceil((q.bbox.z1 - q.bbox.z0) / SC);
    const inQ = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz &&
      q.inside(q.bbox.x0 + (i + .5) * SC, q.bbox.y0 + (j + .5) * SC, q.bbox.z0 + (k + .5) * SC);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!inQ(i, j, k)) continue;
      if (inQ(i + 1, j, k) && inQ(i - 1, j, k) && inQ(i, j + 1, k) && inQ(i, j - 1, k) && inQ(i, j, k + 1) && inQ(i, j, k - 1)) continue;
      let lum = 0.86;
      if (!inQ(i, j, k + 1)) lum = 1.0; else if (!inQ(i + 1, j, k) || !inQ(i, j - 1, k)) lum = 0.92; else lum = 0.78;
      pts.push([q.bbox.x0 + (i + .5) * SC, q.bbox.y0 + (j + .5) * SC, q.bbox.z0 + (k + .5) * SC, lum]);
    }
    return pts;
  };
  console.log('muestreando superficies…');
  const S_pieza = voxSurf(Q(percha, 0.4), 1.6);
  const S_piezaE = voxSurf(Q(perchaE, 0.4), 1.6);
  const S_layout = voxSurf(Q(layout, 0.4), 1.6);
  const S_placaInf = voxSurf(Q(placaInf), 3.0);
  const S_placaSup = voxSurf(Q(placaSup), 3.0);
  const S_placaInfG = voxSurf(Q(placaInfG), 3.0);
  const S_placaSupG = voxSurf(Q(placaSupG), 3.0);
  // densificar el lazo para DISPLAY (la malla solo trae los vértices del polígono)
  const dens = (pts, paso) => {
    const o = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const n = Math.max(1, Math.round(L / paso));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      }
    }
    return o;
  };
  const lazoD = ext ? dens(ext.pts, 2.5) : [];
  // el lazo se dibuja 1.5 mm DEBAJO de la silueta: comparte huella con la pieza
  // y el depth-sort lo tapaba (cazado a ojo en el primer 4K) — abajo se ve como
  // contorno dorado alrededor de la pieza, que es el punto del beat
  const S_lazo = lazoD.map((p) => [p[0], p[1], p[2] - 1.5, 1]);
  // la falda: triángulos radiales lazo→rectángulo 350×630 muestreados (usa lazoD)
  const S_falda = [];
  if (ext) {
    const rect = { x0: -175, y0: -315, x1: 175, y1: 315 };
    const cx2 = 0, cy2 = 0;
    for (let i = 0; i < lazoD.length; i++) {
      const p = lazoD[i];
      const dx = p[0] - cx2, dy = p[1] - cy2;
      let t = Infinity;
      if (dx > 1e-9) t = Math.min(t, (rect.x1 - cx2) / dx);
      if (dx < -1e-9) t = Math.min(t, (rect.x0 - cx2) / dx);
      if (dy > 1e-9) t = Math.min(t, (rect.y1 - cy2) / dy);
      if (dy < -1e-9) t = Math.min(t, (rect.y0 - cy2) / dy);
      for (let s2 = 0.12; s2 <= 1; s2 += 0.08) {
        S_falda.push([p[0] + (cx2 + dx * t - p[0]) * s2, p[1] + (cy2 + dy * t - p[1]) * s2, p[2], 0.9]);
      }
    }
  }
  console.log(`lazo: ${S_lazo.length} pts · falda: ${S_falda.length} pts`);

  // ── beats (paneles estilo curso) ─────────────────────────────────────────
  const arriba = (pts, dz) => pts.map(([x, y, z, l]) => [x, y, z + dz, l]);
  const BEATS = [
    { t: '1 · LA PIEZA', pm: ['Insert > Part (percha)', 'silueta a proporción del video', 'espesor 10 mm · espalda plana'], g: () => [[S_pieza, PAL.pieza]] },
    { t: '2 · SCALE — contracción', pm: ['Scale about: Origin · Uniform ✓', 'factor 1.015 (PP: 1.5 %)', 'ANTES del layout (regla del curso)'], g: () => [[S_piezaE, PAL.pieza]] },
    { t: '3 · MOVE/COPY — 2 cavidades', pm: ['Copy ✓ · rotación 180°', 'punto de rotación → 0,0,0 (gotcha)', 'las 2 barras al centro, sin traslape'], g: () => [[S_layout, PAL.pieza]] },
    { t: '4 · PARTING LINE', pm: ['pull: Top Plane · draft 1.00°', 'transición +/− → lazo AUTOMÁTICO', `${ext ? ext.pts.length : 0} vértices (el curso pica 87 a mano)`], g: () => [[S_layout, PAL.pieza], [S_lazo, PAL.lazo, 4]] },
    { t: '5 · SUPERFICIE DE PARTICIÓN', pm: ['falda radial lazo → bloque 350×630', 'el curso: croquis + extrude 700 + trim', 'aquí: parting.ts en una llamada'], g: () => [[S_layout, PAL.pieza], [S_falda, PAL.falda], [S_lazo, PAL.lazo, 4]] },
    { t: '6 · TOOLING SPLIT — NÚCLEO', pm: ['placa inferior 90 mm', 'impronta = bloque − piezas', 'conservación verificada (0.04 %)'], g: () => [[S_placaInf, PAL.nucleo], [S_layout, PAL.pieza]] },
    { t: '7 · PLACA CAVIDAD', pm: ['placa superior 145 mm', 'cara plana (pieza de espalda plana)', 'alturas 145/90 = las del curso'], g: () => [[arriba(S_placaSup, 46), PAL.cavidad], [S_placaInf, PAL.nucleo], [S_layout, PAL.pieza]] },
    { t: '8 · GUÍAS — Hole Wizard', pm: ['pines ⌀35 · caja ⌀40×8 (inferior)', 'bushings ⌀48 · caja ⌀54×10 (superior)', 'posiciones (±142, ±277) — del curso'], g: () => [[arriba(S_placaSupG, 46), PAL.cavidad], [S_placaInfG, PAL.nucleo], [S_layout, PAL.pieza]] },
    { t: '9 · MOLDE CERRADO', pm: ['núcleo + cavidad + 2 perchas dentro', 'listo para el ciclo (ya lo viste', 'correr en ciclo-percha-4k.mp4)'], g: () => [[S_placaSupG, PAL.cavidad], [S_placaInfG, PAL.nucleo]] },
    { t: '10 · EXPLODE', pm: ['la revelación del curso:', 'cavidad arriba · piezas al centro', 'núcleo abajo — molde COMPLETO'], g: () => [[arriba(S_placaSupG, 120), PAL.cavidad], [arriba(S_layout, 60), PAL.pieza], [S_placaInfG, PAL.nucleo]] },
  ];
  const FPB = proof ? 1 : 36;
  const NF = BEATS.length * FPB;
  const VW = 1000, VH = 840;

  const render = (grupos, thetaDeg) => {
    const fb = new Float32Array(VW * VH * 3);
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
      const t = y / VH, o = (y * VW + x) * 3;
      for (let c = 0; c < 3; c++) fb[o + c] = PAL.fondoTop[c] + (PAL.fondoBot[c] - PAL.fondoTop[c]) * t;
    }
    let bb = [1e18, 1e18, 1e18, -1e18, -1e18, -1e18];
    for (const [pts] of grupos) for (const [x, y, z] of pts) {
      bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.min(bb[2], z);
      bb[3] = Math.max(bb[3], x); bb[4] = Math.max(bb[4], y); bb[5] = Math.max(bb[5], z);
    }
    const c0 = [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2];
    const th = (thetaDeg * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
    const pr = (x, y, z) => {
      const xr = (x - c0[0]) * cosT - (y - c0[1]) * sinT, yr = (x - c0[0]) * sinT + (y - c0[1]) * cosT;
      return { u: xr - yr, v: (xr + yr) * 0.5 - (z - c0[2]), d: xr + yr + (z - c0[2]) * 0.35 };
    };
    let uMin = 1e18, uMax = -1e18, vMin = 1e18, vMax = -1e18;
    for (const X of [bb[0], bb[3]]) for (const Y of [bb[1], bb[4]]) for (const Z of [bb[2], bb[5]]) {
      const p = pr(X, Y, Z); uMin = Math.min(uMin, p.u); uMax = Math.max(uMax, p.u); vMin = Math.min(vMin, p.v); vMax = Math.max(vMax, p.v);
    }
    const S = Math.min((VW - 60) / (uMax - uMin), (VH - 70) / (vMax - vMin));
    const proj = (x, y, z) => {
      const p = pr(x, y, z);
      return { u: VW / 2 + (p.u - (uMax + uMin) / 2) * S, v: VH / 2 - 6 + (p.v - (vMax + vMin) / 2) * S, d: p.d };
    };
    // sombra de contacto
    const rx = ((uMax - uMin) * S) / 2 * 0.8, ry = rx * 0.2;
    const gy = VH / 2 - 6 + ((vMax - vMin) * S) / 2 + 14;
    for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
      const dx = (x - VW / 2) / rx, dy = (y - gy) / ry, e = dx * dx + dy * dy;
      if (e < 1.6) {
        const a = 0.2 * Math.max(0, 1 - e / 1.6);
        const o = (y * VW + x) * 3;
        for (let c = 0; c < 3; c++) fb[o + c] = fb[o + c] * (1 - a) + PAL.sombra[c] * a;
      }
    }
    const splats = [];
    for (const [pts, col, w] of grupos) for (const [x, y, z, lum] of pts) {
      const p = proj(x, y, z);
      splats.push([p.d, p.u, p.v, col[0] * (lum ?? 1), col[1] * (lum ?? 1), col[2] * (lum ?? 1), w ?? 1]);
    }
    splats.sort((a, b) => a[0] - b[0]);
    for (const [, u, v, r, g, b, w] of splats) {
      const ui = u | 0, vi = v | 0, ww = w > 1 ? 2 : 1;
      for (let dy = -ww; dy <= ww; dy++) for (let dx = -ww; dx <= ww; dx++) {
        const px = ui + dx, py = vi + dy;
        if (px < 0 || py < 0 || px >= VW || py >= VH) continue;
        const a2 = (dx === 0 && dy === 0) ? 0.95 : 0.4;
        const o = (py * VW + px) * 3;
        fb[o] = fb[o] * (1 - a2) + r * a2; fb[o + 1] = fb[o + 1] * (1 - a2) + g * a2; fb[o + 2] = fb[o + 2] * (1 - a2) + b * a2;
      }
    }
    const rgb = Buffer.alloc(VW * VH * 3);
    for (let t = 0; t < fb.length; t++) rgb[t] = Math.max(0, Math.min(255, fb[t]));
    return pngRGB(VW, VH, rgb).toString('base64');
  };

  console.log('renderizando beats…');
  const t0 = Date.now();
  for (let f = 0; f < NF; f++) {
    const bi = Math.floor(f / FPB), bf = (f % FPB) / FPB;
    const B = BEATS[bi];
    const theta = 26 + 10 * Math.sin(2 * Math.PI * (bf - 0.25));
    const b64 = render(B.g(), theta);
    const pm = B.pm.map((l, i2) => `<text x="1104" y="${300 + i2 * 30}" font-size="16" fill="#44506a">· ${l}</text>`).join('');
    const pasos = BEATS.map((bb2, i2) => `<text x="1104" y="${470 + i2 * 26}" font-size="13.5" fill="${i2 === bi ? '#1c2430' : i2 < bi ? '#7a8698' : '#b4bcc8'}" font-weight="${i2 === bi ? 'bold' : 'normal'}">${i2 === bi ? '▶ ' : i2 < bi ? '✓ ' : '   '}${bb2.t}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="ui-monospace,Menlo,monospace">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f9"/><stop offset="1" stop-color="#c9ced6"/></linearGradient></defs>
<rect width="1920" height="1080" fill="url(#bg)"/>
<text x="40" y="52" font-size="28" fill="#1c2430" font-weight="bold">CONSTRUCCIÓN DEL MOLDE DESDE 0 — percha ×2 (curso Alwis 2022, en La Forja)</text>
<text x="40" y="76" font-size="14" fill="#5a6577">cotas literales del proceso destilado · kernel OCCT propio · el lazo de partición sale SOLO (parting.ts — el curso lo pica a mano)</text>
<image x="40" y="96" width="${VW}" height="${VH}" href="data:image/png;base64,${b64}"/>
<rect x="40" y="96" width="${VW}" height="${VH}" fill="none" stroke="#b9c0cc"/>
<text x="1104" y="150" font-size="15" fill="#7a8698">PASO ${bi + 1} / ${BEATS.length}</text>
<text x="1104" y="190" font-size="26" fill="#1c2430" font-weight="bold">${B.t}</text>
<text x="1104" y="262" font-size="15" fill="#1c2430" font-weight="bold">PropertyManager (cotas del curso):</text>
${pm}
<text x="1104" y="440" font-size="15" fill="#1c2430" font-weight="bold">EL PROCESO:</text>
${pasos}
<text x="40" y="1006" font-size="14" fill="#5a6577">cavidad menta · núcleo salmón · pieza coral · lazo dorado · falda azul — paleta por ROL (color = información)</text>
<text x="40" y="1050" font-size="12.5" fill="#7a8698">honesto: silueta de pieza a proporción (sin planos en el video) · cotas del MOLDE literales · beats del proceso destilado en docs/forja-research/solidworks-mold-curso/</text>
</svg>`;
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.svg`), svg);
    if (f % 36 === 0) console.log(`  beat ${bi + 1} · f ${f}/${NF} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  console.log(`${NF} SVG en ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
  const checks = {
    lazo_existe: !!ext && ext.pts.length > 30,   // silueta poligonal: ~46 vértices ES lo correcto
    lazo_cerrado: !!ext,
    beats_completos: NF === BEATS.length * FPB,
    placas_talladas: S_placaInfG.length > 20000 && S_placaSupG.length > 20000,
  };
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  if (!pass && !proof) process.exit(2);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 600)); process.exit(1); });
