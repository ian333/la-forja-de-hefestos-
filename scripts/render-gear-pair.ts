/**
 * ⚒️ Gear Pair — Visual snapshot test
 * =====================================
 * Renders the gear pair at N drive angles, writes PNGs to
 * `fit-diagnostics/gear-pair-<case>-<pose>.png`. If a baseline exists at
 * `tests/baselines/gear-pair/<case>-<pose>.png`, compares pixel-wise
 * and reports the mean difference. On mismatch ≥ threshold, exit 1.
 *
 * First run: no baselines → writes them. Subsequent runs diff.
 * Usage:
 *   ./node_modules/.bin/tsx scripts/render-gear-pair.ts            # diff
 *   ./node_modules/.bin/tsx scripts/render-gear-pair.ts --bless    # rewrite baselines
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import {
  GEAR_PAIR_DEFAULTS,
  buildGearPair,
  gearPairGeometry,
  contactRatio,
  type GearPairParams,
} from '../src/lib/parts/gear-pair';
import { buildGearSketch } from '../src/lib/parts/involute-gear-sketch';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname_local, '..', 'fit-diagnostics');
const BASELINE_DIR = path.join(__dirname_local, '..', 'tests', 'baselines', 'gear-pair');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(BASELINE_DIR, { recursive: true });

const BLESS = process.argv.includes('--bless');
const DIFF_THRESHOLD_PCT = 0.5; // 0.5% mean pixel difference

const CASES: Array<{ name: string; params: GearPairParams }> = [
  { name: 'default-20-40', params: GEAR_PAIR_DEFAULTS },
  { name: 'equal-20-20', params: { ...GEAR_PAIR_DEFAULTS, teeth2: 20 } },
  { name: 'tight-17-53', params: { ...GEAR_PAIR_DEFAULTS, teeth1: 17, teeth2: 53 } },
];

function svgForPair(params: GearPairParams): string {
  const build = buildGearPair(params);
  const g = build.geometry;
  const s1 = build.spurParams1;
  const s2 = build.spurParams2;

  const sketch1 = buildGearSketch({
    module: s1.module,
    teethCount: s1.teethCount,
    pressureAngle: s1.pressureAngle,
    addendumCoef: s1.addendumCoef,
    dedendumCoef: s1.dedendumCoef,
    profileResolution: s1.profileResolution,
    arcResolution: s1.arcResolution,
    rotation: s1.phase,
  });
  const sketch2 = buildGearSketch({
    module: s2.module,
    teethCount: s2.teethCount,
    pressureAngle: s2.pressureAngle,
    addendumCoef: s2.addendumCoef,
    dedendumCoef: s2.dedendumCoef,
    profileResolution: s2.profileResolution,
    arcResolution: s2.arcResolution,
    rotation: s2.phase,
  });

  const ra1 = g.pitchRadius1 + params.module * params.addendumCoef;
  const ra2 = g.pitchRadius2 + params.module * params.addendumCoef;
  const halfW = g.centerDistance + ra2 + params.module * 0.5;
  const halfH = Math.max(ra1, ra2) + params.module * 0.5;

  // Frame: fit both gears with margin. Origin at gear 1's center.
  const minX = -ra1 - params.module * 0.5;
  const maxX = halfW;
  const minY = -halfH;
  const maxY = halfH;
  const w = maxX - minX;
  const h = maxY - minY;

  const polyPath = (verts: { x: number; y: number }[], dx: number): string =>
    verts
      .map(
        (v, i) =>
          `${i === 0 ? 'M' : 'L'}${(v.x + dx).toFixed(4)},${(-v.y).toFixed(4)}`,
      )
      .join(' ') + ' Z';

  const stroke = params.module * 0.025;
  const guide = stroke * 0.5;
  const fontSize = Math.max(w, h) * 0.022;
  const epsValue = contactRatio(params);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="1000" height="${Math.round((1000 * h) / w)}">
  <rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#0d0f14"/>
  <g fill="none" stroke="#3a3f4a" stroke-width="${guide}">
    <!-- pitch circles (where the "rolling" happens) -->
    <circle cx="0" cy="0" r="${g.pitchRadius1}" stroke="#4a7aaa" stroke-dasharray="${params.module * 0.15},${params.module * 0.1}"/>
    <circle cx="${g.centerDistance}" cy="0" r="${g.pitchRadius2}" stroke="#4a7aaa" stroke-dasharray="${params.module * 0.15},${params.module * 0.1}"/>
    <!-- center line -->
    <line x1="0" y1="0" x2="${g.centerDistance}" y2="0" stroke="#5a5f6a" stroke-width="${guide * 0.7}"/>
    <!-- axis crosses -->
    <circle cx="0" cy="0" r="${params.module * 0.08}" stroke="#e0c060" fill="#0d0f14"/>
    <circle cx="${g.centerDistance}" cy="0" r="${params.module * 0.08}" stroke="#e0c060" fill="#0d0f14"/>
  </g>
  <g fill="#d4af37" fill-opacity="0.22" stroke="#d4af37" stroke-width="${stroke}" stroke-linejoin="round">
    <path d="${polyPath(sketch1, 0)}"/>
    <path d="${polyPath(sketch2, g.centerDistance)}"/>
  </g>
  <g fill="#e0c060" font-size="${fontSize}" font-family="monospace">
    <text x="${minX + fontSize * 0.4}" y="${minY + fontSize * 1.2}">z1=${params.teeth1}  z2=${params.teeth2}  m=${params.module}  α=${Math.round((params.pressureAngle * 180) / Math.PI)}°</text>
    <text x="${minX + fontSize * 0.4}" y="${minY + fontSize * 2.4}">C=${g.centerDistance.toFixed(3)}  ratio=${g.gearRatio.toFixed(4)}  ε=${epsValue.toFixed(3)}</text>
    <text x="${minX + fontSize * 0.4}" y="${maxY - fontSize * 0.5}">drive=${params.drive.toFixed(4)} rad  →  driven=${g.angle2.toFixed(4)} rad</text>
  </g>
</svg>`;
}

// ─────────────────────────────────────────────────────────────
// PNG diff — mean absolute pixel delta (0..1)
// ─────────────────────────────────────────────────────────────

function pngMeanDiffPct(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return 100;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return (sum / a.length / 255) * 100;
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

const POSES = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2];

let fail = 0;
let baselineWritten = 0;
let compared = 0;
const results: Array<{ name: string; pose: number; status: string; diff?: number }> = [];

for (const { name, params } of CASES) {
  for (const pose of POSES) {
    const full: GearPairParams = { ...params, drive: pose };
    const svg = svgForPair(full);
    const png = new Resvg(svg, { background: '#0d0f14' }).render().asPng();
    const poseKey = pose.toFixed(3).replace('.', 'p');
    const tag = `${name}-d${poseKey}`;

    const outPath = path.join(OUT_DIR, `gear-pair-${tag}.png`);
    fs.writeFileSync(outPath, png);

    const baseline = path.join(BASELINE_DIR, `${tag}.png`);
    if (BLESS || !fs.existsSync(baseline)) {
      fs.writeFileSync(baseline, png);
      baselineWritten++;
      results.push({ name, pose, status: BLESS ? 'BLESSED' : 'BASELINE+' });
      continue;
    }

    const ref = fs.readFileSync(baseline);
    const diff = pngMeanDiffPct(new Uint8Array(ref), new Uint8Array(png));
    compared++;
    if (diff > DIFF_THRESHOLD_PCT) {
      fail++;
      results.push({ name, pose, status: 'FAIL', diff });
    } else {
      results.push({ name, pose, status: 'ok', diff });
    }
  }
}

for (const r of results) {
  const d = r.diff !== undefined ? `  diff=${r.diff.toFixed(4)}%` : '';
  console.log(`  [${r.status.padEnd(9)}] ${r.name.padEnd(16)} drive=${r.pose.toFixed(3)}${d}`);
}
console.log(
  `\nsummary: ${compared} compared, ${baselineWritten} baselines+, ${fail} fail`,
);
if (fail > 0) process.exit(1);
