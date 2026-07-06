/**
 * SIMULACIÓN DE LLENADO EN VIDEO — Kazmer §5.5.2/5.5.4 (lay-flat del bezel).
 * El frente de flujo avanza desde el gate a v̄ de diseño (convergida Eq 5.23);
 * la presión en el gate crece con la longitud llenada (Eq 5.22 power-law).
 * Panel izq: el MARCO real del bezel coloreado por tiempo de llegada (flujo
 * por el marco desde el gate). Panel der: P_gate(t) hasta ΔP final + clamp.
 */
const { writeFileSync, mkdirSync } = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
(async () => {
  const fill = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'filling.ts'));
  const M = fill.ABS_MG47;
  const Hth = 0.0015, Lflow = 0.2;
  const vBar = fill.convergeVelocity(M, Hth);           // ~0.80 m/s
  const tFill = Lflow / vBar;                           // ~0.25 s
  const dPfin = fill.pressureDropSegment(M, Lflow, Hth, vBar);
  const clamp = fill.clampMetricTons(dPfin, 9724e-6);
  // marco del bezel 240×160, ancho 20, gate al centro del lado izquierdo
  const W = 240, D = 160, FR = 20, gate = { x: -W / 2 + FR / 2, y: 0 };
  // distancia DE FLUJO por el marco (perímetro): parametrizo el anillo por su línea media
  const mid = [];   // polilínea de la línea media del marco (perímetro rectangular)
  const mw = W - FR, md = D - FR;   // dims de la línea media
  const per = 2 * (mw + md);
  const pt = (s) => {               // s ∈ [0,per) → punto de la línea media, arrancando en el gate (izq centro) hacia arriba
    let u = s % per;
    if (u < md / 2) return { x: -mw / 2, y: u };                       // sube lado izq
    u -= md / 2;
    if (u < mw) return { x: -mw / 2 + u, y: md / 2 };                  // top
    u -= mw;
    if (u < md) return { x: mw / 2, y: md / 2 - u };                   // lado der baja
    u -= md;
    if (u < mw) return { x: mw / 2 - u, y: -md / 2 };                  // bottom
    u -= mw;
    return { x: -mw / 2, y: -md / 2 + u };                             // sube a gate
  };
  const NF = 200, sc = 2.4, ox = 360, oy = 330;
  const dir = '/tmp/filling-frames'; mkdirSync(dir, { recursive: true });
  const Wpx = 1280, Hpx = 720;
  const px0 = 740, px1 = 1210, py0 = 110, py1 = 600;
  for (let f = 0; f <= NF; f++) {
    const t = (tFill * 1.15 * f) / NF;
    const Lfront = Math.min(vBar * t * 1000, per / 2);   // el frente avanza por AMBOS lados (mm)
    // marco: segmentos de la línea media coloreados si ya llegó el frente
    let segs = '';
    const NS = 160;
    for (let i = 0; i < NS; i++) {
      const s = (per * i) / NS, s2 = (per * (i + 1)) / NS;
      const dFlow = Math.min(s, per - s);               // distancia de flujo (dos ramas desde el gate)
      const a = pt(s), b = pt(s2);
      const filled = dFlow <= Lfront;
      const u = filled ? Math.max(0, Math.min(1, dFlow / (per / 2))) : 0;
      const col = filled ? `rgb(${Math.round(255 - 160 * u)},${Math.round(120 + 60 * u)},${Math.round(60 + 40 * u)})` : '#1c2430';
      segs += `<line x1="${(ox + a.x * sc).toFixed(1)}" y1="${(oy - a.y * sc).toFixed(1)}" x2="${(ox + b.x * sc).toFixed(1)}" y2="${(oy - b.y * sc).toFixed(1)}" stroke="${col}" stroke-width="${FR * sc * 0.42}" stroke-linecap="butt"/>`;
    }
    // presión en el gate hasta ahora (Eq 5.22 con L = frente actual)
    const Lm = Math.min(vBar * t, Lflow);
    const P = fill.pressureDropSegment(M, Math.max(Lm, 1e-6), Hth, vBar) / 1e6;
    let dp = '';
    for (let i = 0; i <= f; i++) {
      const ti = (tFill * 1.15 * i) / NF;
      const Li = Math.min(vBar * ti, Lflow);
      const Pi = fill.pressureDropSegment(M, Math.max(Li, 1e-6), Hth, vBar) / 1e6;
      dp += `${i ? 'L' : 'M'}${(px0 + (ti / (tFill * 1.15)) * (px1 - px0)).toFixed(1)},${(py1 - (Pi / 90) * (py1 - py0)).toFixed(1)}`;
    }
    const done = Lm >= Lflow;
    const svg = `<svg width="${Wpx}" height="${Hpx}" xmlns="http://www.w3.org/2000/svg">
<rect width="${Wpx}" height="${Hpx}" fill="#0b0e13"/>
<text x="40" y="44" fill="#e8eef7" font-family="Inter,sans-serif" font-size="24" font-weight="700">SIMULACIÓN DE LLENADO — Kazmer Eq 5.22/5.23 · laptop bezel ABS, pared 1.5 mm</text>
<text x="120" y="88" fill="#8fa3bd" font-size="15" font-family="monospace">frente de flujo (tiempo de llegada)</text>
<text x="${px0}" y="88" fill="#8fa3bd" font-size="15" font-family="monospace">presión en el gate (MPa)</text>
${segs}
<circle cx="${ox + gate.x * sc}" cy="${oy - gate.y * sc}" r="9" fill="#FFB84D"/><text x="${ox + gate.x * sc - 66}" y="${oy + 5}" fill="#FFB84D" font-size="14" font-family="monospace">GATE</text>
<rect x="${px0}" y="${py0}" width="${px1 - px0}" height="${py1 - py0}" fill="none" stroke="#243040"/>
<line x1="${px0}" y1="${(py1 - (83.2 / 90) * (py1 - py0)).toFixed(1)}" x2="${px1}" y2="${(py1 - (83.2 / 90) * (py1 - py0)).toFixed(1)}" stroke="#5DDB8C" stroke-dasharray="7 5"/>
<text x="${px1 - 172}" y="${(py1 - (83.2 / 90) * (py1 - py0) - 8).toFixed(1)}" fill="#5DDB8C" font-size="13" font-family="monospace">ΔP diseño 83.2 MPa</text>
<path d="${dp}" fill="none" stroke="#FFB84D" stroke-width="2.5"/>
<text x="40" y="${Hpx - 42}" fill="#e8eef7" font-size="20" font-family="monospace">t = ${(t * 1000).toFixed(0)} ms · frente ${Math.min(Lm * 1000, 200).toFixed(0)}/200 mm · P_gate ${P.toFixed(1)} MPa ${done ? '· CAVIDAD LLENA ✓ → empaque' : ''}</text>
<text x="40" y="${Hpx - 16}" fill="#8fa3bd" font-size="15" font-family="monospace">v̄ diseño ${vBar.toFixed(2)} m/s (Eq 5.23 convergida) · llenado ${(tFill * 1000).toFixed(0)} ms · clamp ${clamp.toFixed(0)} ton</text>
</svg>`;
    writeFileSync(`${dir}/f${String(f).padStart(4, '0')}.png`, new Resvg(svg, { background: '#0b0e13' }).render().asPng());
  }
  console.log('FRAMES_OK vBar=', vBar.toFixed(3), 'tFill=', (tFill * 1000).toFixed(0), 'ms dP=', (dPfin / 1e6).toFixed(1));
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
