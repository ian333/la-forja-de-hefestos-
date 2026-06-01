/* QA for the 4 CAD engine fixes. Run on iangpu:
 *   cd ~/Orkesta/la-forja && node_modules/.bin/tsx scripts/qa-cad-fixes.mts
 * Pure-logic checks (no browser): B1 vars, B2 volume, B3/B4 boolean wrap.
 */
import {
  resolveVariables, createVariable, autoCreateVariablesForPrimitive,
} from '../src/lib/gaia-variables';
import {
  makeBox, makeCylinder, makeOp, findNode, findParent,
  addChildToNode, removeNodeFromTree, isContainer,
  type SdfNode, type SdfOperation,
} from '../src/lib/sdf-engine';
import { computeSceneStats } from '../src/lib/simulation';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
  cond ? pass++ : fail++;
};

// ── B1: auto-created dimension vars must resolve (not NaN/ERR) ──
{
  const box = makeBox([0, 0, 0]);
  const autoVars = autoCreateVariablesForPrimitive('box', box.id, box.params, 0);
  const resolved = resolveVariables(autoVars);
  const anyNaN = resolved.some(v => isNaN(v.resolvedValue));
  ok('B1 auto box vars resolve (no NaN)', !anyNaN && resolved.length === 3,
    resolved.map(v => `${v.name}=${v.resolvedValue}`).join(' '));
}

// ── B1: expression referencing another var (b = a/2) resolves ──
{
  const a = createVariable('a', '10');
  const b = createVariable('b', 'a/2');
  const r = resolveVariables([a, b]);
  const rb = r.find(v => v.name === 'b')!;
  ok('B1 expression a/2 → 5', rb.resolvedValue === 5, `b=${rb.resolvedValue}`);
}

// ── B1: cycle detection → NaN, no crash ──
{
  const x = createVariable('x', 'y+1');
  const y = createVariable('y', 'x+1');
  const r = resolveVariables([x, y]);
  ok('B1 cycle → NaN (no crash)', r.every(v => isNaN(v.resolvedValue)));
}

// ── Replicate the store's addOperation wrap logic ──
function wrapOperation(scene: SdfOperation, selectedId: string | null,
  type: SdfOperation['type']): SdfOperation | null {
  let parent: SdfNode | null = null, baseId: string | null = null, toolIds: string[] = [];
  const selected = selectedId ? findNode(scene, selectedId) : null;
  if (selected && selected.id !== scene.id) {
    const p = findParent(scene, selected.id);
    if (p && isContainer(p)) {
      const sib = p.children, idx = sib.findIndex(c => c.id === selected.id);
      const others = sib.filter(c => c.id !== selected.id);
      if (others.length >= 1) {
        parent = p; baseId = selected.id;
        const after = sib.slice(idx + 1).filter(c => c.id !== selected.id);
        toolIds = after.length ? [after[0].id] : [others[others.length - 1].id];
      }
    }
  }
  if (!parent || !baseId) {
    const c = scene;
    if (isContainer(c) && c.children.length >= 2) {
      parent = c; baseId = c.children[c.children.length - 2].id;
      toolIds = [c.children[c.children.length - 1].id];
    }
  }
  if (!parent || !baseId || !toolIds.length) return null;
  const base = findNode(scene, baseId)!;
  const tools = toolIds.map(id => findNode(scene, id)!);
  let stripped: SdfNode | null = removeNodeFromTree(scene, baseId);
  for (const id of toolIds) if (stripped) stripped = removeNodeFromTree(stripped, id);
  if (!stripped) return null;
  const op = makeOp(type, [base, ...tools], type === 'smoothUnion' ? 0.25 : 0.2);
  return addChildToNode(stripped, parent.id, op) as SdfOperation;
}

// ── B3/B4: subtract wraps the two bodies as [base, tool] ──
{
  const box = makeBox([0, 0, 0]); box.params = { sizeX: 4, sizeY: 4, sizeZ: 4 };
  const cyl = makeCylinder([0, 0, 0]); cyl.params = { radius: 0.8, height: 6 };
  let scene = makeOp('union', [box, cyl]);
  const wrapped = wrapOperation(scene, box.id, 'subtract');
  const okWrap = !!wrapped && wrapped.children.length === 1
    && (wrapped.children[0] as SdfOperation).type === 'subtract'
    && (wrapped.children[0] as SdfOperation).children.length === 2
    && (wrapped.children[0] as SdfOperation).children[0].id === box.id
    && (wrapped.children[0] as SdfOperation).children[1].id === cyl.id;
  ok('B3/B4 subtract wraps [base=box, tool=cyl]', okWrap,
    wrapped ? `op=${(wrapped.children[0] as SdfOperation).type} children=${(wrapped.children[0] as SdfOperation).children.length}` : 'null');

  // ── B2: volume drops after the subtraction (hole removes material) ──
  const volSolid = computeSceneStats(makeOp('union', [box])).estimatedVolumeCm3;
  const volHoled = computeSceneStats(wrapped!).estimatedVolumeCm3;
  ok('B2 subtract lowers volume', volHoled < volSolid && volHoled > 0,
    `solid=${volSolid}cm³ holed=${volHoled}cm³`);

  // ── B2: solid box volume ~ analytic (4×4×4 mm³ = 64 mm³ = 0.064 cm³) ──
  const analyticCm3 = (4 * 4 * 4) * 1e-3; // mm³→cm³
  const relErr = Math.abs(volSolid - analyticCm3) / analyticCm3;
  ok('B2 box volume ≈ analytic (mm convention)', relErr < 0.06,
    `voxel=${volSolid} analytic=${analyticCm3.toFixed(4)} relErr=${(relErr*100).toFixed(1)}%`);
}

// ── B3/B4 guard: <2 bodies → no-op (returns null) ──
{
  const box = makeBox([0, 0, 0]);
  const scene = makeOp('union', [box]);
  ok('B3/B4 guard <2 bodies → null', wrapOperation(scene, box.id, 'subtract') === null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
