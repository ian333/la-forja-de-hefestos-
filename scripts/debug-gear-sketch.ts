import { buildGearSketch, deriveGearGeometry, GEAR_SKETCH_DEFAULTS } from '../src/lib/parts/involute-gear-sketch';

const params = { ...GEAR_SKETCH_DEFAULTS, teethCount: 12 };
const g = deriveGearGeometry(params);
const verts = buildGearSketch(params);

console.log('Z=', params.teethCount);
console.log('geom=', g);
console.log('vertexCount=', verts.length);
console.log('first 6:', verts.slice(0, 6));
console.log('last 6:', verts.slice(-6));

// Rotate by toothAngle and check
const step = (2 * Math.PI) / params.teethCount;
const c = Math.cos(step), s = Math.sin(step);

// Check whether rotating tooth 0's first N vertices lands on tooth 1's positions
const perTooth = Math.round(verts.length / params.teethCount);
console.log('approx per-tooth:', perTooth);

for (let i = 0; i < perTooth + 3; i++) {
  const v = verts[i];
  const rx = c * v.x - s * v.y;
  const ry = s * v.x + c * v.y;
  // Find nearest
  let best = { idx: -1, d: Infinity };
  for (let k = 0; k < verts.length; k++) {
    const d = Math.hypot(rx - verts[k].x, ry - verts[k].y);
    if (d < best.d) best = { idx: k, d };
  }
  console.log(`v[${i}] rot → nearest v[${best.idx}] d=${best.d.toExponential(3)}`);
}
