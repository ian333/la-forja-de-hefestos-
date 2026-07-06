/**
 * EXPERIMENTO 2 — la JUNTA con roles: eje (núcleo fuerte) · cicloidal · salida.
 * Barriles más grandes y largos, pared POR rol. Eje = el más grueso/centrado,
 * lleva la fuerza. Sigue siendo print-in-place puro (revolución) → STL sin box.
 *   node --import tsx scripts/exp-junta.cjs
 */
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || '/tmp/exp-junta';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const pip = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mech', 'printinplace.ts'));
  // NEMA17 (shaft Ø5 → bore 3 con holgura). Paredes por ROL:
  const cfg = {
    tubes: 3, bore: 3,
    walls: [10, 15, 10],   // [EJE grueso · CICLOIDAL cuerpo · SALIDA aro]
    H: 40, layers: 10, gap: 0.3, bulge: 3, mat: 'PLA',
  };
  const ROLES = ['EJE (núcleo, entrada/motor)', 'CICLOIDAL (disco que orbita)', 'SALIDA (aro → brazo)'];
  const j = pip.tubeStack(cfg);

  const L = (n, w) => String(n).padStart(w);
  console.log(`JUNTA CICLOIDAL print-in-place · Ø${(2 * j.baseRadii[j.baseRadii.length - 1]).toFixed(0)}mm × ${cfg.H}mm · gap ${cfg.gap} · PLA\n`);
  console.log(`atrapado: ${j.captured}  ·  play axial: ${j.axialPlayMm}mm  ·  imprimible: ${j.buildable} (voladizo ${j.overhangDeg}°)\n`);
  console.log('ROLES (radio interno → externo, base / centro con joroba +' + cfg.bulge + '):');
  for (let k = 0; k < cfg.tubes; k++) {
    const ri = j.baseRadii[2 * k], ro = j.baseRadii[2 * k + 1];
    const riC = (ri + cfg.bulge).toFixed(1), roC = (ro + cfg.bulge).toFixed(1);
    console.log(`  Barril ${k + 1} · ${ROLES[k].padEnd(30)} r ${L(ri, 4)}→${L(ro, 4)}  (centro ${riC}→${roC})  pared ${cfg.walls[k]}mm`);
  }
  console.log(`\nEl EJE es el más grueso (pared ${cfg.walls[0]}mm, Ø núcleo ${(2 * j.baseRadii[1]).toFixed(0)}mm) → el más rígido,`);
  console.log(`y la joroba lo mantiene SIEMPRE centrado (play ${j.axialPlayMm}mm). Lleva la fuerza del cicloidal.`);
  console.log(`Los 3 barriles giran independientes HOY (baleros). El acople cicloidal (lóbulos +`);
  console.log(`excéntrica en el Barril 2) es el SIGUIENTE paso — ahí el coseno se vuelve angular.`);

  const stl = buildSTL(j, cfg, pip);
  const file = path.join(OUT, 'junta-cicloidal.stl');
  fs.writeFileSync(file, stl.text);
  console.log(`\nSTL → ${file}  (${stl.tris} triángulos, 3 cuerpos separados por el gap)`);
})();

function buildSTL(stack, cfg, pip) {
  const NTH = 120, NZ = 80, H = cfg.H, A = stack.bulge;
  const hump = (z) => pip.cosineHump(z, H, A);
  const tris = [];
  const V = (r, th, z) => [r * Math.cos(th), r * Math.sin(th), z];
  const tri = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / m, n[1] / m, n[2] / m];
    tris.push(`facet normal ${n[0]} ${n[1]} ${n[2]}\nouter loop\nvertex ${a.join(' ')}\nvertex ${b.join(' ')}\nvertex ${c.join(' ')}\nendloop\nendfacet`);
  };
  for (let k = 0; k < cfg.tubes; k++) {
    const riB = stack.baseRadii[2 * k], roB = stack.baseRadii[2 * k + 1];
    const ri = (z) => riB + hump(z), ro = (z) => roB + hump(z);
    for (let i = 0; i < NTH; i++) {
      const t0 = (2 * Math.PI * i) / NTH, t1 = (2 * Math.PI * (i + 1)) / NTH;
      for (let jz = 0; jz < NZ; jz++) {
        const z0 = (H * jz) / NZ, z1 = (H * (jz + 1)) / NZ;
        tri(V(ro(z0), t0, z0), V(ro(z0), t1, z0), V(ro(z1), t1, z1));
        tri(V(ro(z0), t0, z0), V(ro(z1), t1, z1), V(ro(z1), t0, z1));
        tri(V(ri(z0), t1, z0), V(ri(z0), t0, z0), V(ri(z1), t0, z1));
        tri(V(ri(z0), t1, z0), V(ri(z1), t0, z1), V(ri(z1), t1, z1));
      }
      tri(V(ri(H), t0, H), V(ro(H), t0, H), V(ro(H), t1, H));
      tri(V(ri(H), t0, H), V(ro(H), t1, H), V(ri(H), t1, H));
      tri(V(ro(0), t0, 0), V(ri(0), t0, 0), V(ri(0), t1, 0));
      tri(V(ro(0), t0, 0), V(ri(0), t1, 0), V(ro(0), t1, 0));
    }
  }
  return { text: `solid junta\n${tris.join('\n')}\nendsolid junta\n`, tris: tris.length };
}
