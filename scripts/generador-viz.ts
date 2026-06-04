import * as fs from 'fs';
import { discLayerToolpath } from '../src/forja/mech/generador-impresion';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/generador'; fs.mkdirSync(DIR, { recursive: true });
const tp = discLayerToolpath({ lobes: 10, R: 40, Rr: 3, E: 1.5, shaftD: 16, outPinD: 6, outPins: 6 });
const S = 5.6, CX = 320, CY = 320;
const col: Record<string, string> = { perimetro: '#6fb6c9', barreno: '#d8a657', relleno: '#7ee081', viaje: '#5a6576' };
const map = (p: { x: number; y: number }) => `${(CX + p.x * S).toFixed(1)},${(CY - p.y * S).toFixed(1)}`;
let paths = '';
for (const s of tp.segs) {
  const d = s.pts.map(map).join(' ');
  const dash = s.type === 'viaje' ? 'stroke-dasharray="3 4"' : '';
  const wdt = s.type === 'perimetro' ? 2.4 : s.type === 'relleno' ? 1.3 : s.type === 'viaje' ? 0.8 : 2;
  paths += `<polyline points="${d}" fill="none" stroke="${col[s.type]}" stroke-width="${wdt}" ${dash} stroke-opacity="${s.type === 'viaje' ? 0.5 : 0.95}"/>`;
}
const legend = [['perímetro 200mm/s (pared, lento=calidad)', col.perimetro], ['barrenos 200mm/s', col.barreno], ['relleno 350mm/s (rápido=throughput)', col.relleno], ['viaje (sin extruir, sobre el hueco)', col.viaje]]
  .map(([t, c], i) => `<rect x="20" y="${640 + i * 22}" width="16" height="10" fill="${c}"/><text x="44" y="${649 + i * 22}" fill="#9fb3c8" font-size="13">${t}</text>`).join('');
const html = `<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:#0d1218;font-family:system-ui}</style></head><body>
<svg width="660" height="740" viewBox="0 0 660 740" xmlns="http://www.w3.org/2000/svg"><rect width="660" height="740" fill="#0d1218"/>
<text x="330" y="30" fill="#d8a657" font-size="18" text-anchor="middle">La RUTA de una capa — toolpath del disco cicloidal</text>
<text x="330" y="52" fill="#9fb3c8" font-size="12" text-anchor="middle">${tp.segs.length} segmentos · ${tp.extrudeLen}mm extrusión · ${tp.travelLen}mm viaje · ~${tp.estSec}s/capa</text>
${paths}${legend}</svg></body></html>`;
fs.writeFileSync(`${DIR}/toolpath.html`, html); console.log('VIZ ok');
