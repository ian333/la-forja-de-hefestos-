/**
 * PARRILLA DE INYECCIÓN — las 21 piezas REALES simuladas y en imágenes.
 * ============================================================================
 * "haz simulaciones de inyección con todas las piezas y revísalas, extrae
 *  imágenes" (user). Para CADA sólido del lote Hammond (test-parts/
 *  inyeccion-reales): campo de flujo del motor del hito (resistencia Eq 5.22 +
 *  espesor H-R + árbol) con compuerta directa (defaultGate) y SIN colada
 *  (declarado — aquí el estudio es la PIEZA), y TRES etapas del llenado
 *  (15/55/95 %) en un tile: depósito por orden de llegada, FRENTE blanco,
 *  SOLDADURAS cian (ΔL>25: el frente que rodea bosses/ventanas y se
 *  reencuentra) y ○ = aire atrapado (última llegada) en la etapa final.
 *
 * Material: ABS de verdad — las cajas Hammond SON ABS; power-law del ejemplo
 * del libro (Cycolac MG47 p.105-111). ΔP pieza = ∫dL/H^(1+n) del campo.
 *
 * Salida: parrilla-N.svg (1920×1080, 8 piezas por lámina) + telemetría JSON
 * + VERIFY_RESULT. Raster aparte con _raster4k.cjs (→ 3840×2160).
 * Uso: node --import tsx scripts/inyeccion-parrilla.cjs <outdir>
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
  const out = process.argv[2] || '/tmp/parrilla';
  fs.mkdirSync(out, { recursive: true });
  const oc = await require(cjsGlue)({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const DA = await import(path.join(ROOT, 'src', 'forja', 'mold', 'draw-axis.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const F = await import(path.join(ROOT, 'src', 'forja', 'mold', 'filling.ts'));

  const melt = F.ABS_MG47;
  const TopAbs_SOLID = oc.TopAbs_ShapeEnum.TopAbs_SOLID;
  const files = fs.readdirSync(DIR).filter((f) => /\.(stp|step)$/i.test(f));
  const FRACS = [0.15, 0.55, 0.95];
  const VW = 296, VH = 190;
  const piezas = [];

  for (const f of files) {
    let shape;
    try { shape = K.importSTEP(oc, fs.readFileSync(path.join(DIR, f))); } catch { continue; }
    const solids = K.uniqueSubShapes(oc, shape, TopAbs_SOLID);
    let si = 0;
    for (const solid of solids) {
      const volMm3 = K.volume(oc, solid);
      if (volMm3 < 800) { si++; continue; }
      const nm = `${f.replace(/\.(stp|step)$/i, '')}#${si++}`;
      const mesh = K.tessellate(oc, solid, 0.3, 0.3);
      const idx2 = mesh.indices ?? new Uint32Array(mesh.positions.length / 3).map((_, i) => i);
      let area = 0;
      for (let t = 0; t < idx2.length; t += 3) {
        const a = idx2[t] * 3, b = idx2[t + 1] * 3, c = idx2[t + 2] * 3;
        const u = [mesh.positions[b] - mesh.positions[a], mesh.positions[b + 1] - mesh.positions[a + 1], mesh.positions[b + 2] - mesh.positions[a + 2]];
        const v = [mesh.positions[c] - mesh.positions[a], mesh.positions[c + 1] - mesh.positions[a + 1], mesh.positions[c + 2] - mesh.positions[a + 2]];
        area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
      }
      const wall = Math.min(4, Math.max(1, +(2 * volMm3 / area).toFixed(2)));
      const choice = DA.pickDrawAxis({ positions: mesh.positions, indices: idx2 }, { wallMm: wall });
      const om = choice.oriented;
      const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
      for (let i = 0; i < om.positions.length; i += 3) for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], om.positions[i + k]); mx[k] = Math.max(mx[k], om.positions[i + k]);
      }
      const dim = mx.map((v, k) => +(v - mn[k]).toFixed(1));
      const q = FM.solidFromMesh({ positions: om.positions, indices: idx2 });
      const gate = FM.defaultGate(q);
      let cell = volMm3 < 10000 ? Math.max(0.3, Math.min(0.6, wall * 0.25)) : Math.max(0.4, Math.min(1.0, wall * 0.45));
      const minDim = Math.min(...dim);
      if (minDim <= 5) cell = +(minDim / Math.max(3, Math.round(minDim / cell))).toFixed(4);
      const field = FL.measureFlowLength({
        x0: q.bbox.x0 - 2, y0: q.bbox.y0 - 2, z0: q.bbox.z0 - 1, x1: q.bbox.x1 + 2, y1: q.bbox.y1 + 2, z1: q.bbox.z1 + 1,
        cellMm: cell, gateMm: gate,
        inCavity: (x, y, z) => q.inside(x, y, z),
        wallMm: wall, meltN: melt.n, expectVolumeMm3: volMm3,
      });
      const weldInfo = FL.computeWeldMask(field, { sameGateDeltaLMm: 25 });
      const front = FL.createFlowFront(field);
      // ΔP de pieza por la integral del campo (Eq 5.22) — compuerta directa, sin colada
      const vMean = F.convergeVelocity(melt, wall / 1000);
      const PCOEF = (2 * melt.k * Math.pow(2 * (1 + 1 / melt.n) * vMean, melt.n) * Math.pow(1e-3, -melt.n)) / 1e6;
      const dPmax = PCOEF * field.maxResistance;
      // aire atrapado + conteo de soldadura EN la pieza
      let trapT = -1, trapR = -1, weldN = 0;
      const weldPts = [];
      for (let t = 0; t < field.cavity.length; t++) {
        if (!field.cavity[t] || !Number.isFinite(field.resistance[t])) continue;
        if (field.resistance[t] > trapR) { trapR = field.resistance[t]; trapT = t; }
        if (weldInfo.weld[t]) { weldN++; weldPts.push(t); }
      }
      const ti = trapT % field.nx, tj = ((trapT - ti) / field.nx) % field.ny, tk = ((trapT - ti) / field.nx - tj) / field.ny;
      const trap = { x: field.x0 + (ti + .5) * cell, y: field.y0 + (tj + .5) * cell, z: field.z0 + (tk + .5) * cell };
      // ── el tile: 3 etapas ─────────────────────────────────────────────────
      const th = (32 * Math.PI) / 180, cosT = Math.cos(th), sinT = Math.sin(th);
      const cx0 = (q.bbox.x0 + q.bbox.x1) / 2, cy0 = (q.bbox.y0 + q.bbox.y1) / 2, cz0 = (q.bbox.z0 + q.bbox.z1) / 2;
      const pr = (x, y, z) => {
        const xr = (x - cx0) * cosT - (y - cy0) * sinT, yr = (x - cx0) * sinT + (y - cy0) * cosT;
        return { u: xr - yr, v: (xr + yr) * 0.5 - (z - cz0), d: xr + yr + (z - cz0) * 0.35 };
      };
      // escala: caben las 8 esquinas
      let uMin = 1e18, uMax = -1e18, vMin = 1e18, vMax = -1e18;
      for (const X of [q.bbox.x0, q.bbox.x1]) for (const Y of [q.bbox.y0, q.bbox.y1]) for (const Z of [q.bbox.z0, q.bbox.z1]) {
        const p = pr(X, Y, Z);
        uMin = Math.min(uMin, p.u); uMax = Math.max(uMax, p.u); vMin = Math.min(vMin, p.v); vMax = Math.max(vMax, p.v);
      }
      const S = Math.min((VW - 24) / (uMax - uMin), (VH - 20) / (vMax - vMin));
      const proj = (x, y, z) => {
        const p = pr(x, y, z);
        return { u: VW / 2 + (p.u - (uMax + uMin) / 2) * S, v: VH / 2 + (p.v - (vMax + vMin) / 2) * S, d: p.d };
      };
      const tiles = [];
      let trapUV = null;
      for (const frac of FRACS) {
        const st = front.frontAt(frac);
        const Rt = st.resistance;
        const fb = new Float32Array(VW * VH * 3).fill(10);
        const splats = [];
        for (let k = 0; k < field.nz; k++) for (let j = 0; j < field.ny; j++) for (let i = 0; i < field.nx; i++) {
          const t = (k * field.ny + j) * field.nx + i;
          if (!field.cavity[t]) continue;
          const x = field.x0 + (i + .5) * cell, y = field.y0 + (j + .5) * cell, z = field.z0 + (k + .5) * cell;
          const p = proj(x, y, z);
          const R = field.resistance[t];
          if (Number.isFinite(R) && R <= Rt) {
            const u = R / Math.max(1e-9, field.maxResistance);
            const esFrente = R > Rt * 0.955;
            const col = esFrente ? [255, 250, 235] : ramp(0.15 + 0.85 * u);
            splats.push([p.d, p.u, p.v, col[0], col[1], col[2], esFrente ? 0.85 : 0.16 + 0.4 * (1 - u)]);
          } else {
            splats.push([p.d, p.u, p.v, 48, 58, 80, 0.10]);
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
        for (const t of weldPts) {
          if (weldInfo.weldR[t] > Rt) continue;
          const i = t % field.nx, j = ((t - i) / field.nx) % field.ny, k = ((t - i) / field.nx - j) / field.ny;
          const p = proj(field.x0 + (i + .5) * cell, field.y0 + (j + .5) * cell, field.z0 + (k + .5) * cell);
          const ui = p.u | 0, vi = p.v | 0;
          if (ui < 0 || vi < 0 || ui >= VW || vi >= VH) continue;
          const o = (vi * VW + ui) * 3;
          fb[o] += 60; fb[o + 1] += 190; fb[o + 2] += 235;
        }
        const rgb = Buffer.alloc(VW * VH * 3);
        for (let t = 0; t < fb.length; t++) rgb[t] = Math.min(255, fb[t]);
        tiles.push(pngRGB(VW, VH, rgb).toString('base64'));
      }
      trapUV = proj(trap.x, trap.y, trap.z);
      piezas.push({
        nm, dim, volCc: +(volMm3 / 1000).toFixed(1), wall, cell,
        LmaxMm: field.maxFlowLenMm, dPmax: +dPmax.toFixed(1),
        errVolPct: +((100 * Math.abs(field.volumeMm3 - volMm3)) / volMm3).toFixed(1),
        unreachable: field.unreachable, weldN,
        weldPct: +(100 * weldN / Math.max(1, Math.round(field.volumeMm3 / cell ** 3))).toFixed(1),
        trap, trapUV, tiles, moldeable: choice.dfm.moldable,
      });
      console.log(`· ${nm}: L=${field.maxFlowLenMm} ΔP=${dPmax.toFixed(1)} soldadura=${weldN} vox (${piezas[piezas.length - 1].weldPct}%) err=${piezas[piezas.length - 1].errVolPct}% muertos=${field.unreachable}`);
    }
  }

  // ── las láminas: 8 piezas por 1920×1080 ──────────────────────────────────
  const PER = 8, TW = 940, THh = 246;   // 4 filas × 246 + header 74 = 1058 < footer 1074 (la fila 4 PISABA el footer)
  const nSheets = Math.ceil(piezas.length / PER);
  for (let s = 0; s < nSheets; s++) {
    const grupo = piezas.slice(s * PER, (s + 1) * PER);
    let cuerpo = '';
    grupo.forEach((p, gi) => {
      const col = gi % 2, row = (gi / 2) | 0;
      const X = 20 + col * (TW + 20), Y = 74 + row * THh;
      cuerpo += `<g transform="translate(${X},${Y})">`;
      cuerpo += `<text x="0" y="14" font-size="15" fill="#eaf2ff">${p.nm}</text>`;
      cuerpo += `<text x="0" y="32" font-size="11" fill="#5d7290">${p.dim.join('×')} mm · ${p.volCc} cc · pared~${p.wall} · DFM ${p.moldeable}</text>`;
      FRACS.forEach((fr, k) => {
        const vx = k * (VW + 8);
        cuerpo += `<image x="${vx}" y="40" width="${VW}" height="${VH}" href="data:image/png;base64,${p.tiles[k]}"/>`;
        cuerpo += `<text x="${vx + 4}" y="52" font-size="10" fill="#8fa3bf">${(100 * fr).toFixed(0)} %</text>`;
        if (k === 2) {
          const tu = vx + p.trapUV.u, tv = 40 + p.trapUV.v;
          cuerpo += `<circle cx="${tu.toFixed(0)}" cy="${tv.toFixed(0)}" r="7" fill="none" stroke="#ffffff" stroke-width="1.5"/>`;
        }
      });
      cuerpo += `<text x="0" y="${40 + VH + 14}" font-size="11" fill="#7ee0a0">L ${p.LmaxMm} mm · ΔP ${p.dPmax} MPa (∫campo) · soldadura ${p.weldN} vox · err vol ${p.errVolPct} % · muertos ${p.unreachable}</text>`;
      cuerpo += `</g>`;
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="ui-monospace,Menlo,monospace">
<rect width="1920" height="1080" fill="#0b0f16"/>
<text x="20" y="34" font-size="24" fill="#eaf2ff">INYECCIÓN DE PIEZAS REALES — lote Hammond ABS · lámina ${s + 1}/${nSheets}</text>
<text x="20" y="56" font-size="13" fill="#5d7290">llenado 15/55/95 % · ámbar→morado = llegada · BLANCO = frente · CIAN = soldadura (ΔL&gt;25) · ○ = aire atrapado · compuerta directa, sin colada (declarado) · ABS MG47 · motor flowlen Eq 5.22</text>
${cuerpo}
<text x="20" y="1074" font-size="12" fill="#44506a">honesto: cuasiestático (frente por resistencia, sin inercia) · Q constante · T_melt uniforme · sin colada (el estudio es la PIEZA) · fuente: STEP públicos de Hammond Mfg · render CPU local</text>
</svg>`;
    fs.writeFileSync(path.join(out, `parrilla-${s + 1}.svg`), svg);
  }
  const telem = piezas.map(({ tiles, trapUV, ...rest }) => rest);
  fs.writeFileSync(path.join(out, 'telemetria-parrilla.json'), JSON.stringify({ fecha: '2026-07-17', piezas: telem }, null, 1));
  const checks = {
    todas_las_piezas: piezas.length >= 21,
    flujo_sano: piezas.every((p) => p.errVolPct < 15 && p.unreachable === 0),
    soldadura_acotada: piezas.every((p) => p.weldPct < 15),
    aire_lejos_de_compuerta: piezas.every((p) => Math.hypot(...p.dim) * 0.15 < p.LmaxMm),
  };
  const pass = Object.values(checks).every(Boolean);
  console.log(`\n${piezas.length} piezas → ${nSheets} láminas`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  if (!pass) process.exit(2);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
