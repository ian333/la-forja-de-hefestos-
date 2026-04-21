/**
 * Renders the involute gear sketch to SVG + PNG for visual verification.
 * Usage: ./node_modules/.bin/tsx scripts/render-gear-sketch.ts
 * Output: fit-diagnostics/gear-sketch-Z<N>.{svg,png}
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import {
  buildGearSketch,
  deriveGearGeometry,
  GEAR_SKETCH_DEFAULTS,
  type GearSketchParams,
} from '../src/lib/parts/involute-gear-sketch';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname_local, '..', 'fit-diagnostics');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CASES: Array<{ name: string; params: GearSketchParams }> = [
  { name: 'Z20-default', params: { ...GEAR_SKETCH_DEFAULTS, teethCount: 20 } },
  { name: 'Z12-undercut', params: { ...GEAR_SKETCH_DEFAULTS, teethCount: 12 } },
  { name: 'Z40-fine', params: { ...GEAR_SKETCH_DEFAULTS, teethCount: 40 } },
  { name: 'Z20-m2.5', params: { ...GEAR_SKETCH_DEFAULTS, teethCount: 20, module: 2.5 } },
  { name: 'Z24-a15', params: { ...GEAR_SKETCH_DEFAULTS, teethCount: 24, pressureAngle: (14.5 * Math.PI) / 180 } },
  { name: 'Z24-a25', params: { ...GEAR_SKETCH_DEFAULTS, teethCount: 24, pressureAngle: (25 * Math.PI) / 180 } },
];

function renderSvg(params: GearSketchParams, label: string): string {
  const verts = buildGearSketch(params);
  const g = deriveGearGeometry(params);
  const margin = g.addendumRadius * 0.15;
  const R = g.addendumRadius + margin;
  const vb = `-${R} -${R} ${2 * R} ${2 * R}`;

  const polyPath =
    verts
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${v.x.toFixed(4)},${(-v.y).toFixed(4)}`)
      .join(' ') + ' Z';

  const stroke = Math.max(g.module * 0.02, 0.005);
  const guide = stroke * 0.5;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="800" height="800">
    <rect x="-${R}" y="-${R}" width="${2 * R}" height="${2 * R}" fill="#0d0f14"/>
    <g fill="none" stroke="#3a3f4a" stroke-width="${guide}">
      <circle cx="0" cy="0" r="${g.pitchRadius}" stroke-dasharray="${g.module * 0.08},${g.module * 0.06}"/>
      <circle cx="0" cy="0" r="${g.baseRadius}" stroke="#5a4a2a" stroke-dasharray="${g.module * 0.04},${g.module * 0.05}"/>
      <circle cx="0" cy="0" r="${g.addendumRadius}" stroke="#2a4a5a"/>
      <circle cx="0" cy="0" r="${g.dedendumRadius}" stroke="#2a4a5a"/>
      <line x1="-${R}" y1="0" x2="${R}" y2="0"/>
      <line x1="0" y1="-${R}" x2="0" y2="${R}"/>
    </g>
    <path d="${polyPath}" fill="#d4af37" fill-opacity="0.18" stroke="#d4af37" stroke-width="${stroke}" stroke-linejoin="round"/>
    <g fill="#e0c060" font-size="${margin * 0.35}" font-family="monospace">
      <text x="${-R + margin * 0.15}" y="${-R + margin * 0.55}">${label}  |  V=${verts.length}</text>
      <text x="${-R + margin * 0.15}" y="${R - margin * 0.2}">rp=${g.pitchRadius.toFixed(3)}  ra=${g.addendumRadius.toFixed(3)}  rb=${g.baseRadius.toFixed(3)}  rf=${g.dedendumRadius.toFixed(3)}</text>
    </g>
  </svg>`;
}

let allOk = true;
for (const { name, params } of CASES) {
  const label = `Z=${params.teethCount} m=${params.module} α=${Math.round((params.pressureAngle * 180) / Math.PI)}°`;
  const svg = renderSvg(params, label);
  const svgPath = path.join(OUT_DIR, `gear-sketch-${name}.svg`);
  const pngPath = path.join(OUT_DIR, `gear-sketch-${name}.png`);
  fs.writeFileSync(svgPath, svg);
  try {
    const png = new Resvg(svg, { background: '#0d0f14' }).render().asPng();
    fs.writeFileSync(pngPath, png);
    console.log(`  ✓ ${name.padEnd(18)} → ${pngPath}`);
  } catch (e) {
    allOk = false;
    console.error(`  ✗ ${name}: ${(e as Error).message}`);
  }
}
if (!allOk) process.exit(1);
