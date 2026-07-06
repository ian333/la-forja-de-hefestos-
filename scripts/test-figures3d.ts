import { FIGURES, figure3D, planFill3D } from '../src/lib/physics/genDeposit.ts';
const N = 18;
for (const f of FIGURES) {
  const occ = figure3D(f.id, N);
  const fill = planFill3D(occ, N, true);
  const part = fill.filter(v => v.type === 'part').length;
  const sup = fill.filter(v => v.type === 'support').length;
  // chequeo de unión: ¿algún vóxel sin sólido debajo y sin vecino lateral con soporte? (debería ser 0)
  const set = new Set(fill.map(v => `${v.cx},${v.cy},${v.cz}`));
  let airborne = 0;
  for (const v of fill) {
    if (v.cz === 0) continue;
    const below = set.has(`${v.cx},${v.cy},${v.cz - 1}`);
    const sideSup = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has(`${v.cx + dx},${v.cy + dy},${v.cz - 1}`) && set.has(`${v.cx + dx},${v.cy + dy},${v.cz}`));
    if (!below && !sideSup) airborne++;
  }
  console.log(`${f.id.padEnd(9)} pieza=${String(part).padStart(4)} soporte=${String(sup).padStart(4)} (${(100 * sup / (part + sup)).toFixed(0)}%) · EN_AIRE=${airborne}`);
}
