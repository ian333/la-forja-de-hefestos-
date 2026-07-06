/**
 * EXPERIMENTO 1 — la pila de tubos print-in-place, EN NÚMEROS + STL imprimible.
 * Tubo recto = se desliza en Z. Joroba de coseno = atrapado + autocentrado + solo
 * gira sobre el eje. Geometría = pura superficie de revolución → STL sin kernel,
 * sin GPU, sin iangpu. 100% imprimible y verificable.
 *   node --import tsx scripts/exp-tubos.cjs
 */
const fs = require('fs');
const path = require('path');
const OUT = process.env.OUT || '/tmp/exp-tubos';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const pip = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mech', 'printinplace.ts'));
  const cfg = { tubes: 3, bore: 4, wall: 2, H: 20, layers: 10, gap: 0.3, mat: 'PLA' };
  const recto = pip.tubeStack({ ...cfg, bulge: 0 });
  const jor = pip.tubeStack({ ...cfg, bulge: 1.5 });

  // ── NÚMEROS ──
  const L = (n, w) => String(n).padStart(w);
  console.log(`SISTEMA 1 · ${cfg.tubes} tubos · ${cfg.layers} capas · H=${cfg.H}mm · gap=${cfg.gap}mm · PLA\n`);
  console.log('               recto (joroba 0)        jorobado (joroba 1.5)');
  console.log(`atrapado:      ${L(recto.captured, 5)}                  ${L(jor.captured, 5)}`);
  console.log(`desliza en Z:  ${L(recto.axialPlayMm === Infinity ? 'LIBRE ∞' : recto.axialPlayMm, 9)}              play ${jor.axialPlayMm}mm (atrapado)`);
  console.log(`imprimible:    ${L(recto.buildable, 5)}                  ${L(jor.buildable, 5)}  (voladizo ${jor.overhangDeg}° < 45°)`);
  console.log(`\nperfil radial por capa (jorobado) — 6 superficies [t1i t1o | t2i t2o | t3i t3o]:`);
  for (const lvl of jor.levels) {
    const r = lvl.radii;
    const g1 = (r[2] - r[1]).toFixed(2), g2 = (r[4] - r[3]).toFixed(2);
    console.log(`  z=${L(lvl.z, 5)}  ${r.map((x) => L(x.toFixed(2), 6)).join(' ')}   gaps: ${g1} ${g2}`);
  }
  console.log(`\nel gap se conserva en TODAS las capas (no se sueldan). La joroba abulta +1.5mm`);
  console.log(`al centro → atrapa cada tubo (play ${jor.axialPlayMm}mm) sin matar el giro ni el gap.`);

  // ── STL (superficies de revolución, watertight por tubo) ──
  const stl = buildSTL(jor, cfg, pip);
  const file = path.join(OUT, 'sistema1-tubos.stl');
  fs.writeFileSync(file, stl.text);
  // recto también, para comparar
  fs.writeFileSync(path.join(OUT, 'sistema1-recto.stl'), buildSTL(recto, cfg, pip).text);
  console.log(`\nSTL imprimible → ${file}  (${stl.tris} triángulos, ${cfg.tubes} cuerpos separados por el gap)`);
  console.log(`STL recto (compara) → ${path.join(OUT, 'sistema1-recto.stl')}`);
})();

// ── generador STL puro: cada tubo = pared exterior + interior + 2 tapas ──
function buildSTL(stack, cfg, pip) {
  const NTH = 96, NZ = 60, H = cfg.H, A = stack.bulge;
  const hump = (z) => pip.cosineHump(z, H, A);
  const tris = [];
  const V = (r, th, z) => [r * Math.cos(th), r * Math.sin(th), z];
  const tri = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / m, n[1] / m, n[2] / m];
    tris.push(`facet normal ${n[0]} ${n[1]} ${n[2]}\nouter loop\nvertex ${a.join(' ')}\nvertex ${b.join(' ')}\nvertex ${c.join(' ')}\nendloop\nendfacet`);
  };
  // por cada tubo k: radios base interno/externo
  for (let k = 0; k < cfg.tubes; k++) {
    const riB = stack.baseRadii[2 * k], roB = stack.baseRadii[2 * k + 1];
    const ri = (z) => riB + hump(z), ro = (z) => roB + hump(z);
    for (let i = 0; i < NTH; i++) {
      const t0 = (2 * Math.PI * i) / NTH, t1 = (2 * Math.PI * (i + 1)) / NTH;
      for (let j = 0; j < NZ; j++) {
        const z0 = (H * j) / NZ, z1 = (H * (j + 1)) / NZ;
        // pared EXTERIOR (normal hacia afuera): winding CCW visto desde fuera
        tri(V(ro(z0), t0, z0), V(ro(z0), t1, z0), V(ro(z1), t1, z1));
        tri(V(ro(z0), t0, z0), V(ro(z1), t1, z1), V(ro(z1), t0, z1));
        // pared INTERIOR (normal hacia adentro): winding invertido
        tri(V(ri(z0), t1, z0), V(ri(z0), t0, z0), V(ri(z1), t0, z1));
        tri(V(ri(z0), t1, z0), V(ri(z1), t0, z1), V(ri(z1), t1, z1));
      }
      // tapa SUPERIOR (z=H) anillo: ri(H)→ro(H), normal +Z
      tri(V(ri(H), t0, H), V(ro(H), t0, H), V(ro(H), t1, H));
      tri(V(ri(H), t0, H), V(ro(H), t1, H), V(ri(H), t1, H));
      // tapa INFERIOR (z=0) anillo, normal −Z (winding invertido)
      tri(V(ro(0), t0, 0), V(ri(0), t0, 0), V(ri(0), t1, 0));
      tri(V(ro(0), t0, 0), V(ri(0), t1, 0), V(ro(0), t1, 0));
    }
  }
  return { text: `solid sistema1\n${tris.join('\n')}\nendsolid sistema1\n`, tris: tris.length };
}
