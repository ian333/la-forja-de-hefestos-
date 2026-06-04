import * as fs from 'fs';
import { cycloidalDisc, pinPositions } from '../src/forja/mech/cycloidal';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/generador'; fs.mkdirSync(DIR, { recursive: true });
const P = { lobes: 10, R: 40, Rr: 3, E: 1.5, shaftD: 16, outPinD: 6, outPins: 6, T: 6, layer: 0.2 };
const disc = cycloidalDisc({ lobes: P.lobes, R: P.R, Rr: P.Rr, E: P.E, segments: 140 });
const nLayers = Math.round(P.T / P.layer);
const outR = P.R * 0.55;
const holes = pinPositions(outR, P.outPins).map(c => ({ cx: c.x, cy: c.y, r: P.outPinD / 2 + P.E }));
holes.push({ cx: 0, cy: 0, r: P.shaftD / 2 + P.E });
// iso
const C30 = Math.cos(Math.PI / 6), S30 = Math.sin(Math.PI / 6), SX = 4.4, ZS = 11, OX = 330, OY = 360;
const iso = (x: number, y: number, z: number) => `${(OX + (x - y) * C30 * SX).toFixed(1)},${(OY + ((x + y) * S30 * SX) - z * ZS).toFixed(1)}`;
function ring(pts: { x: number; y: number }[], z: number, stroke: string, w: number) {
  return `<polyline points="${pts.map(p => iso(p.x, p.y, z)).join(' ')} ${iso(pts[0].x, pts[0].y, z)}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
}
function circle(cx: number, cy: number, r: number, z: number, stroke: string) {
  const pts = Array.from({ length: 33 }, (_, i) => ({ x: cx + r * Math.cos(2 * Math.PI * i / 32), y: cy + r * Math.sin(2 * Math.PI * i / 32) }));
  return ring(pts, z, stroke, 0.8);
}
function frame(fracLayers: number, ox: number, oy: number, scale: number, title: string): string {
  const top = Math.round(nLayers * fracLayers);
  let s = `<g transform="translate(${ox},${oy}) scale(${scale})">`;
  for (let l = 0; l < top; l++) {
    const z = l * P.layer, t = l / nLayers;
    const col = `rgb(${Math.round(110 + 90 * t)},${Math.round(150 + 60 * t)},${Math.round(190 + 40 * t)})`;
    s += ring(disc.profile, z, col, l % 2 ? 0.9 : 0.5);
    if (l % 3 === 0) for (const h of holes) s += circle(h.cx, h.cy, h.r, z, '#d8a657aa');
  }
  s += `<text x="0" y="200" fill="#9fb3c8" font-size="13" text-anchor="middle">${title}</text></g>`;
  return s;
}
const html = `<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:#0d1218}</style></head><body>
<svg width="660" height="900" viewBox="0 0 660 900" xmlns="http://www.w3.org/2000/svg"><rect width="660" height="900" fill="#0d1218"/>
<text x="330" y="34" fill="#d8a657" font-size="19" text-anchor="middle">La primera pieza, EXTRUIDA — disco cicloidal, ${nLayers} capas de ${P.layer}mm</text>
${frame(1.0, 0, 60, 1, '')}
${frame(0.25, -150, 700, 0.5, '25%')}${frame(0.5, -20, 700, 0.5, '50%')}${frame(0.78, 120, 700, 0.5, '78%')}${frame(1.0, 260, 700, 0.5, '100%')}
<text x="60" y="640" fill="#9fb3c8" font-size="13">naciendo capa por capa →</text></svg></body></html>`;
fs.writeFileSync(`${DIR}/extrude.html`, html); console.log('VIZ ok ' + nLayers + ' capas');
