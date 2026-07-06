/**
 * SIMULACIÓN DE ENFRIAMIENTO EN VIDEO — Kazmer Eq 9.2/9.4 (Fig 9.2 ANIMADA).
 * Campo completo T(z,t) de la conducción transitoria 1D (serie exacta, 40
 * términos): perfil por el espesor + isotermas + reloj de ciclo. Frames SVG →
 * resvg → PNG → (ffmpeg fuera). Física real, cero estilización.
 */
const { writeFileSync, mkdirSync } = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
(async () => {
  const cool = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cooling.ts'));
  const M = cool.ABS_KAZMER;                       // ABS: 239→60°C, eject 97.6
  const H = 0.003;                                 // pared 3mm (Fig 9.2 del libro)
  const tC = cool.coolingTimePlate(H, M);
  // T(z,t): serie exacta con senos (perfil inicial uniforme, paredes a T_coolant)
  const Tzt = (zNorm, t) => {                      // zNorm ∈ [0,1] a través del espesor
    if (t <= 0) return M.tMelt;
    let s = 0;
    for (let n = 1; n <= 79; n += 2)
      s += (4 / (Math.PI * n)) * Math.sin(n * Math.PI * zNorm) * Math.exp((-n * n * Math.PI * Math.PI * M.alpha * t) / (H * H));
    return M.tCoolant + (M.tMelt - M.tCoolant) * s;
  };
  const W = 1280, Hh = 720, N = 240, tMax = tC * 1.25;
  const dir = '/tmp/cooling-frames'; mkdirSync(dir, { recursive: true });
  const x0 = 120, x1 = 660, y0 = 80, y1 = 620;    // panel izquierdo: perfil T(z)
  const tx = (z) => x0 + z * (x1 - x0);
  const ty = (T) => y1 - ((T - 40) / (260 - 40)) * (y1 - y0);
  const cx0 = 740, cx1 = 1200;                     // panel derecho: T_centro(t)
  const ctx = (t) => cx0 + (t / tMax) * (cx1 - cx0);
  const tempColor = (T) => {                       // azul→ámbar→rojo por temperatura
    const u = Math.max(0, Math.min(1, (T - 60) / (239 - 60)));
    const r = Math.round(40 + 215 * u), g = Math.round(120 + 60 * (1 - Math.abs(u - 0.5) * 2)), b = Math.round(220 * (1 - u) + 30);
    return `rgb(${r},${g},${b})`;
  };
  for (let f = 0; f <= N; f++) {
    const t = (tMax * f) / N;
    // perfil actual + estela de perfiles previos (estilo Fig 9.2)
    let paths = '';
    for (let k = 8; k >= 1; k--) {
      const tk = Math.max(0, t - k * tMax / 60);
      let d = '';
      for (let i = 0; i <= 60; i++) { const z = i / 60; d += `${i ? 'L' : 'M'}${tx(z).toFixed(1)},${ty(Tzt(z, tk)).toFixed(1)}`; }
      paths += `<path d="${d}" fill="none" stroke="#3a4a5f" stroke-width="1.2" opacity="${(0.35 - k * 0.04).toFixed(2)}"/>`;
    }
    let d = '', Tc = Tzt(0.5, t);
    for (let i = 0; i <= 90; i++) { const z = i / 90; d += `${i ? 'L' : 'M'}${tx(z).toFixed(1)},${ty(Tzt(z, t)).toFixed(1)}`; }
    // curva del centro hasta t
    let dc = '';
    for (let i = 0; i <= f; i++) { const ti = (tMax * i) / N; dc += `${i ? 'L' : 'M'}${ctx(ti).toFixed(1)},${ty(Tzt(0.5, ti)).toFixed(1)}`; }
    const ejected = t >= tC;
    const svg = `<svg width="${W}" height="${Hh}" xmlns="http://www.w3.org/2000/svg">
<rect width="${W}" height="${Hh}" fill="#0b0e13"/>
<text x="40" y="44" fill="#e8eef7" font-family="Inter,sans-serif" font-size="24" font-weight="700">SIMULACIÓN DE ENFRIAMIENTO — Kazmer Eq 9.2/9.4 · ABS, pared 3 mm</text>
<text x="${x0}" y="${y0 - 14}" fill="#8fa3bd" font-size="15" font-family="monospace">T(z) a través del espesor</text>
<text x="${cx0}" y="${y0 - 14}" fill="#8fa3bd" font-size="15" font-family="monospace">T centro vs tiempo</text>
<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#243040"/>
<rect x="${cx0}" y="${y0}" width="${cx1 - cx0}" height="${y1 - y0}" fill="none" stroke="#243040"/>
<line x1="${x0}" y1="${ty(M.tEject)}" x2="${cx1}" y2="${ty(M.tEject)}" stroke="#5DDB8C" stroke-dasharray="7 5" stroke-width="1.4"/>
<text x="${x1 + 8}" y="${ty(M.tEject) + 5}" fill="#5DDB8C" font-size="13" font-family="monospace">T_eject ${M.tEject}°C</text>
<line x1="${x0}" y1="${ty(M.tCoolant)}" x2="${x1}" y2="${ty(M.tCoolant)}" stroke="#4C9FFF" stroke-dasharray="3 5" opacity=".6"/>
<text x="${x0}" y="${ty(M.tCoolant) - 6}" fill="#4C9FFF" font-size="12" font-family="monospace">refrigerante ${M.tCoolant}°C</text>
${paths}
<path d="${d}" fill="none" stroke="${tempColor(Tc)}" stroke-width="3.5"/>
<path d="${dc}" fill="none" stroke="#FFB84D" stroke-width="2.5"/>
<circle cx="${ctx(t)}" cy="${ty(Tc)}" r="6" fill="#FFB84D"/>
${ejected ? `<line x1="${ctx(tC)}" y1="${y0}" x2="${ctx(tC)}" y2="${y1}" stroke="#5DDB8C" stroke-width="2"/>
<text x="${ctx(tC) - 60}" y="${y0 + 26}" fill="#5DDB8C" font-size="16" font-weight="700" font-family="monospace">EXPULSIÓN</text>` : ''}
<text x="40" y="${Hh - 42}" fill="#e8eef7" font-size="20" font-family="monospace">t = ${t.toFixed(2)} s · T_centro = ${Tc.toFixed(1)} °C ${ejected ? '· PIEZA RÍGIDA (T bajo HDT) ✓' : '· solidificando…'}</text>
<text x="40" y="${Hh - 16}" fill="#8fa3bd" font-size="15" font-family="monospace">t_c teórico (Eq 9.5) = ${tC.toFixed(2)} s · α=8.69e-8 m²/s · T(z,t) serie exacta 40 términos</text>
</svg>`;
    const png = new Resvg(svg, { background: '#0b0e13' }).render().asPng();
    writeFileSync(`${dir}/f${String(f).padStart(4, '0')}.png`, png);
  }
  console.log('FRAMES_OK', N + 1, 'tC=', tC.toFixed(2));
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
