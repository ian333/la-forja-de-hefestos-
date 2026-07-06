/**
 * EXPERIMENTO 3 — EL PRIMER ACOPLE: el Barril 2 deja de ser balero y se vuelve
 * CICLOIDAL. Reusa el perfil EXACTO de cycloidal.ts (equidistante de hipocicloide,
 * no coseno-flor) + el truco print-in-place Rr+gap (el disco libra los pernos por
 * el gap). Eje excéntrico → disco orbita → anillo gira lento (reducción N:1).
 * Pura matemática, STL sin box.
 *   node --import tsx scripts/exp-acople.cjs
 */
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || '/tmp/exp-acople';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const cyc = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mech', 'cycloidal.ts'));
  const pip = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mech', 'printinplace.ts'));
  const gap = pip.GAP.PLA.sweet;          // 0.30

  // de la clasificación del video: 11 lóbulos → 11:1, 12 pernos.
  const P = { lobes: 11, R: 30, Rr: 3, E: 1.5 };
  const T = 8;                            // espesor del disco
  // CLAVE print-in-place: el disco se calcula con Rr+gap → libra los pernos REALES por el gap.
  const disc = cyc.cycloidalDisc({ lobes: P.lobes, R: P.R, Rr: P.Rr + gap, E: P.E });
  const pins = cyc.pinPositions(P.R, disc.pins);
  const lobesOk = cyc.countLobes(disc.profile);

  // ── NÚMEROS ──
  const ri = disc.profile.reduce((m, p) => Math.min(m, Math.hypot(p.x, p.y)), 1e9);
  const ro = disc.profile.reduce((m, p) => Math.max(m, Math.hypot(p.x, p.y)), 0);
  const nema = 0.45, outT = nema * disc.ratio;
  console.log(`PRIMER ACOPLE · disco cicloidal EXACTO (equidistante de hipocicloide)\n`);
  console.log(`lóbulos:        ${disc.lobes}   (verificado contando máximos del perfil: ${lobesOk})`);
  console.log(`pernos anillo:  ${disc.pins}   ( = lóbulos+1, la regla del cicloidal)`);
  console.log(`REDUCCIÓN:      ${disc.ratio}:1`);
  console.log(`disco:          radio ${ri.toFixed(1)}–${ro.toFixed(1)}mm, ${disc.profile.length} puntos de perfil, espesor ${T}mm`);
  console.log(`excentricidad:  E=${P.E}mm (lo que el EJE empuja al disco para que engrane)`);
  console.log(`holgura mesh:   el disco se calculó con Rr+gap=${P.Rr + gap} → libra los pernos (Ø${2 * P.Rr}) por ${gap}mm`);
  console.log(`\nPAYOFF: NEMA17 (${nema} N·m) × ${disc.ratio} = ${outT.toFixed(2)} N·m en la salida.`);
  console.log(`Eje gira 11 vueltas → la salida gira 1. Eso es el brazo que se mueve fuerte y lento.`);

  // ── STL: disco (excéntrico) + 12 pernos del anillo (la pareja que engrana) ──
  const tris = [];
  discPrism(disc.profile, P.Rr + 1.0 + gap, T, P.E, 0, tris); // disco offset E, con barreno que monta la leva
  for (const pin of pins) cylinder(pin.x, pin.y, P.Rr, 0, T, 40, tris); // pernos reales (Rr)
  const file = path.join(OUT, 'acople-cicloidal.stl');
  fs.writeFileSync(file, `solid acople\n${tris.join('\n')}\nendsolid acople\n`);
  console.log(`\nSTL → ${file}  (${tris.length} triángulos · disco + ${pins.length} pernos, separados por el gap)`);
})();

// ── helpers STL puros ──
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
    facet([cx, cy, z1], a1, b1, tris);   // tapa sup
    facet([cx, cy, z0], b0, a0, tris);   // tapa inf
  }
}
// disco = perfil lobulado (exterior) + barreno circular (monta la leva), extruido
function discPrism(profile, boreR, T, ox, oy, tris) {
  const n = profile.length, NB = 48;
  const bore = Array.from({ length: NB }, (_, i) => { const t = 2 * Math.PI * i / NB; return { x: boreR * Math.cos(t), y: boreR * Math.sin(t) }; });
  // pared exterior (lobulada)
  for (let i = 0; i < n; i++) {
    const a = profile[i], b = profile[(i + 1) % n];
    const A0 = [a.x + ox, a.y + oy, 0], A1 = [a.x + ox, a.y + oy, T], B0 = [b.x + ox, b.y + oy, 0], B1 = [b.x + ox, b.y + oy, T];
    facet(A0, B0, B1, tris); facet(A0, B1, A1, tris);
  }
  // pared del barreno (interior, winding invertido)
  for (let i = 0; i < NB; i++) {
    const a = bore[i], b = bore[(i + 1) % NB];
    const A0 = [a.x + ox, a.y + oy, 0], A1 = [a.x + ox, a.y + oy, T], B0 = [b.x + ox, b.y + oy, 0], B1 = [b.x + ox, b.y + oy, T];
    facet(B0, A0, A1, tris); facet(B0, A1, B1, tris);
  }
  // tapas (anillo entre perfil y barreno): por cada vértice del perfil, su punto de barreno al mismo ángulo
  const boreAt = (ang) => [boreR * Math.cos(ang) + ox, boreR * Math.sin(ang) + oy];
  for (let i = 0; i < n; i++) {
    const a = profile[i], b = profile[(i + 1) % n];
    const aa = Math.atan2(a.y, a.x), ab = Math.atan2(b.y, b.x);
    const pa0 = [a.x + ox, a.y + oy, 0], pb0 = [b.x + ox, b.y + oy, 0], ba0 = [...boreAt(aa), 0], bb0 = [...boreAt(ab), 0];
    facet(pa0, pb0, bb0, tris); facet(pa0, bb0, ba0, tris);           // tapa inferior
    const pa1 = [a.x + ox, a.y + oy, T], pb1 = [b.x + ox, b.y + oy, T], ba1 = [...boreAt(aa), T], bb1 = [...boreAt(ab), T];
    facet(pb1, pa1, ba1, tris); facet(pb1, ba1, bb1, tris);           // tapa superior
  }
}
