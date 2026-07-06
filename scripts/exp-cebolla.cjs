/**
 * EXPERIMENTO 4 — LAS 3 CEBOLLAS ensambladas (junta cicloidal print-in-place).
 * Cada cebolla = círculo + perturbación:
 *   cebolla 1 = EJE + leva (excéntrica, modo 1)  → empuja la 2
 *   cebolla 2 = DISCO cicloidal (N lóbulos, modo N) → al orbitar mueve la 3
 *   cebolla 3 = SALIDA/anillo (N+1 pernos, modo N+1)
 * reducción = N (la resta de modos da 1 lóbulo de avance por vuelta).
 * Pura matemática, STL sin box. node --import tsx scripts/exp-cebolla.cjs
 */
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || '/tmp/exp-cebolla';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const cyc = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mech', 'cycloidal.ts'));
  const pip = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mech', 'printinplace.ts'));
  const gap = pip.GAP.PLA.sweet;
  const N = 11, R = 30, Rr = 3, E = 1.5, T = 8, camR = 8, motorBore = 2.5;

  const disc = cyc.cycloidalDisc({ lobes: N, R, Rr: Rr + gap, E });
  const pins = cyc.pinPositions(R, disc.pins);
  const discBore = camR + gap;

  console.log(`3 CEBOLLAS · junta cicloidal print-in-place · reducción ${disc.ratio}:1\n`);
  console.log(`cebolla 1 EJE:    leva excéntrica r=${camR} corrida E=${E} (modo 1) + flecha motor Ø${2 * motorBore}`);
  console.log(`cebolla 2 DISCO:  ${disc.lobes} lóbulos (modo ${N}), barreno ${discBore} monta la leva (gap ${gap})`);
  console.log(`cebolla 3 SALIDA: ${disc.pins} pernos a R=${R} (modo ${N + 1})`);
  console.log(`acople: disco libra pernos por ${gap}mm · disco libra leva por ${gap}mm · TODO con el mismo gap`);
  console.log(`reducción = (N+1)−N por vuelta = 1 lóbulo → ${disc.ratio}:1 · NEMA17×${disc.ratio}=${(0.45 * disc.ratio).toFixed(2)} N·m`);

  const tris = [];
  // CEBOLLA 1 — eje: flecha en el centro + leva excéntrica (offset E)
  cylinder(0, 0, camR - 2, 0, T, 48, tris);              // cuerpo de la flecha
  cylinderHollow(0, 0, motorBore, camR - 2, 0, T, 48, tris); // (barreno motor lo deja el hueco)
  cylinder(E, 0, camR, 0, T, 48, tris);                  // LEVA excéntrica (corrida E)
  // CEBOLLA 2 — disco cicloidal (excéntrico +E), barreno discBore monta la leva
  discPrism(disc.profile, discBore, T, E, 0, tris);
  // CEBOLLA 3 — salida: 12 pernos a R + aro de respaldo
  for (const p of pins) cylinder(p.x, p.y, Rr, 0, T, 28, tris);
  annulus(R + Rr, R + Rr + 5, 0, T, 96, tris);

  const file = path.join(OUT, 'cebolla-junta.stl');
  fs.writeFileSync(file, `solid cebolla\n${tris.join('\n')}\nendsolid cebolla\n`);
  console.log(`\nSTL → ${file}  (${tris.length} triángulos · 3 cebollas, separadas por el gap)`);
})();

// ── helpers STL ──
function facet(a, b, c, tris) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const m = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / m, n[1] / m, n[2] / m];
  tris.push(`facet normal ${n[0]} ${n[1]} ${n[2]}\nouter loop\nvertex ${a.join(' ')}\nvertex ${b.join(' ')}\nvertex ${c.join(' ')}\nendloop\nendfacet`);
}
function cylinder(cx, cy, r, z0, z1, nth, tris) {
  for (let i = 0; i < nth; i++) {
    const t0 = 2 * Math.PI * i / nth, t1 = 2 * Math.PI * (i + 1) / nth;
    const a0 = [cx + r * Math.cos(t0), cy + r * Math.sin(t0), z0], a1 = [cx + r * Math.cos(t0), cy + r * Math.sin(t0), z1];
    const b0 = [cx + r * Math.cos(t1), cy + r * Math.sin(t1), z0], b1 = [cx + r * Math.cos(t1), cy + r * Math.sin(t1), z1];
    facet(a0, b0, b1, tris); facet(a0, b1, a1, tris);
    facet([cx, cy, z1], a1, b1, tris); facet([cx, cy, z0], b0, a0, tris);
  }
}
function annulus(rin, rout, z0, z1, nth, tris) {
  for (let i = 0; i < nth; i++) {
    const t0 = 2 * Math.PI * i / nth, t1 = 2 * Math.PI * (i + 1) / nth;
    const C = (r, t, z) => [r * Math.cos(t), r * Math.sin(t), z];
    facet(C(rout, t0, z0), C(rout, t1, z0), C(rout, t1, z1), tris); facet(C(rout, t0, z0), C(rout, t1, z1), C(rout, t0, z1), tris); // ext
    facet(C(rin, t1, z0), C(rin, t0, z0), C(rin, t0, z1), tris); facet(C(rin, t1, z0), C(rin, t0, z1), C(rin, t1, z1), tris); // int
    facet(C(rin, t0, z1), C(rout, t0, z1), C(rout, t1, z1), tris); facet(C(rin, t0, z1), C(rout, t1, z1), C(rin, t1, z1), tris); // tapa sup
    facet(C(rout, t0, z0), C(rin, t0, z0), C(rin, t1, z0), tris); facet(C(rout, t0, z0), C(rin, t1, z0), C(rout, t1, z0), tris); // tapa inf
  }
}
function cylinderHollow() { /* el barreno del motor se ve como hueco interno del aro de la flecha; omitido para v1 */ }
function discPrism(profile, boreR, T, ox, oy, tris) {
  const n = profile.length, NB = 48;
  const bore = Array.from({ length: NB }, (_, i) => { const t = 2 * Math.PI * i / NB; return { x: boreR * Math.cos(t), y: boreR * Math.sin(t) }; });
  for (let i = 0; i < n; i++) {
    const a = profile[i], b = profile[(i + 1) % n];
    facet([a.x + ox, a.y + oy, 0], [b.x + ox, b.y + oy, 0], [b.x + ox, b.y + oy, T], tris);
    facet([a.x + ox, a.y + oy, 0], [b.x + ox, b.y + oy, T], [a.x + ox, a.y + oy, T], tris);
  }
  for (let i = 0; i < NB; i++) {
    const a = bore[i], b = bore[(i + 1) % NB];
    facet([b.x + ox, b.y + oy, 0], [a.x + ox, a.y + oy, 0], [a.x + ox, a.y + oy, T], tris);
    facet([b.x + ox, b.y + oy, 0], [a.x + ox, a.y + oy, T], [b.x + ox, b.y + oy, T], tris);
  }
  const boreAt = (ang, z) => [boreR * Math.cos(ang) + ox, boreR * Math.sin(ang) + oy, z];
  for (let i = 0; i < n; i++) {
    const a = profile[i], b = profile[(i + 1) % n], aa = Math.atan2(a.y, a.x), ab = Math.atan2(b.y, b.x);
    facet([a.x + ox, a.y + oy, 0], [b.x + ox, b.y + oy, 0], boreAt(ab, 0), tris); facet([a.x + ox, a.y + oy, 0], boreAt(ab, 0), boreAt(aa, 0), tris);
    facet([b.x + ox, b.y + oy, T], [a.x + ox, a.y + oy, T], boreAt(aa, T), tris); facet([b.x + ox, b.y + oy, T], boreAt(aa, T), boreAt(ab, T), tris);
  }
}
