import { defineScene } from './api';
import type { SdfPrimitive } from '@/lib/sdf-engine';

/**
 * RIN 5 RAYOS — rueda de aleacion (alloy wheel), estilo deportivo
 * ================================================================
 * Pieza mecanica imprimible: un rin de 5 rayos como los de coche.
 * Construccion 100% primitivas + booleanas + smooth (sin NURBS, sin
 * poligonos pesados, sin joints) — dentro de los limites de Hefestos.
 *
 * ANATOMIA (vista por el eje Z = eje de giro):
 *   - BARRIL / aro exterior: cilindro hueco (la "llanta" donde monta el neumatico)
 *   - PLATO FRONTAL (face): donde viven el hub y los rayos
 *   - HUB central: disco con bore central + 5 birlos (lug holes)
 *   - 5 RAYOS: cada uno une el hub con el aro, a 72 grados, con smooth blend
 *   - LIGHTENING / ventanas: el material entre rayos esta vaciado por la
 *     propia geometria (los rayos son delgados; el resto del plato no existe)
 *
 * UNIDADES: MM = 0.02 u/mm (1 u = 50 mm) -> STL exporta en mm reales (scaleMM=50).
 * El boton STL usa res=192 sobre el AABB auto de la escena.
 *
 * COTAS (rin ~17 pulgadas, escala de coche real):
 *   - Diametro exterior del aro:  ~430 mm
 *   - Ancho del aro (eje Z):       ~180 mm
 *   - Diametro del bore central:    ~70 mm
 *   - PCD birlos (5x114.3):       114.3 mm  (patron real 5x114.3)
 *   - Diametro birlo:               ~14 mm
 */
export default defineScene((f) => {
  const MM = 0.02;

  // ── Parametros (mm) ──────────────────────────────────────────────
  const odRim   = f.variable('aro_diam_ext_mm', 430 * MM, { unit: 'mm' }); // O.D. del aro
  const rimW    = f.variable('aro_ancho_mm',    180 * MM, { unit: 'mm' }); // ancho del barril (Z)
  const rimWall = f.variable('aro_pared_mm',     22 * MM, { unit: 'mm' }); // pared del aro
  const faceT   = f.variable('plato_espesor_mm', 26 * MM, { unit: 'mm' }); // espesor del plato/rayos (Z)
  const hubD    = f.variable('hub_diam_mm',     150 * MM, { unit: 'mm' }); // diametro del hub central
  const boreD   = f.variable('bore_diam_mm',     70 * MM, { unit: 'mm' }); // bore central (eje)
  const pcd     = f.variable('pcd_mm',          114.3 * MM, { unit: 'mm' }); // circulo de birlos 5x114.3
  const lugD    = f.variable('birlo_diam_mm',    14 * MM, { unit: 'mm' });  // diametro de cada birlo
  const spokeW  = f.variable('rayo_ancho_mm',    34 * MM, { unit: 'mm' });  // ancho de cada rayo
  const nSpokes = 5;

  const Rout = odRim / 2;          // radio exterior del aro
  const Rin  = Rout - rimWall;     // radio interior del aro (cara del neumatico)
  const hubR = hubD / 2;
  const boreR = boreD / 2;
  const pcdR  = pcd / 2;
  const lugR  = lugD / 2;

  // El plato (face) esta retraido hacia el lado "interior" del barril
  // para simular el offset: lo centramos en Z=0 y el barril abarca [-rimW/2, +rimW/2].
  const faceZ = 0;

  // ── 1) ARO EXTERIOR (barril hueco) ────────────────────────────────
  // Cilindro exterior menos cilindro interior = tubo. Eje del rin = Z,
  // asi que el cilindro (eje Y por defecto) se rota PI/2 en X.
  const rimOuter = f.cylinder({ r: Rout, h: rimW, at: [0, 0, 0], rot: [Math.PI / 2, 0, 0], name: 'Aro_ext' });
  const rimBore  = f.cylinder({ r: Rin,  h: rimW + 10 * MM, at: [0, 0, 0], rot: [Math.PI / 2, 0, 0], name: 'Aro_int' });
  const barrel   = f.subtract(rimOuter, rimBore);

  // Reborde (bead seat / flange) en cada extremo del aro: dos toros finos
  // que dan el labio donde asienta el neumatico. Mejora el "look" de rin real.
  const lipR = rimWall * 0.45;
  const flangeFront = f.torus({ R: Rout - lipR, r: lipR, at: [0, 0,  rimW / 2 - lipR], rot: [Math.PI / 2, 0, 0], name: 'Reborde_F' });
  const flangeBack  = f.torus({ R: Rout - lipR, r: lipR, at: [0, 0, -rimW / 2 + lipR], rot: [Math.PI / 2, 0, 0], name: 'Reborde_T' });

  // ── 2) HUB CENTRAL (disco) ────────────────────────────────────────
  const hub = f.cylinder({ r: hubR, h: faceT, at: [0, 0, faceZ], rot: [Math.PI / 2, 0, 0], name: 'Hub' });

  // ── 3) RAYOS (5, a 72 grados) ─────────────────────────────────────
  // Cada rayo es una caja delgada que va del hub al aro. La caja yace en el
  // plano XY (espesor en Z = faceT), su largo en X, su ancho en Y. La rotamos
  // alrededor de Z para repartir los 5 rayos. Para que conecte hub<->aro:
  //   - largo = (Rin - hubR*0.6), centrado a mitad de camino.
  const spokeLen = (Rin + lugR) - hubR * 0.5;
  const spokeMidR = hubR * 0.5 + spokeLen / 2; // radio del centro del rayo
  const spokes: SdfPrimitive[] = [];
  for (let i = 0; i < nSpokes; i++) {
    const ang = (i / nSpokes) * Math.PI * 2 + Math.PI / 2; // primer rayo hacia +Y
    const cx = Math.cos(ang) * spokeMidR;
    const cy = Math.sin(ang) * spokeMidR;
    // Caja: X = largo, Y = ancho, Z = espesor. Luego rot Z = ang para alinear radial.
    const spoke = f.box({
      w: spokeLen + hubR * 0.4, // solapa con el hub para fundir bien
      h: spokeW,
      d: faceT,
      at: [cx, cy, faceZ],
      rot: [0, 0, ang],
      name: `Rayo_${i + 1}`,
    });
    spokes.push(spoke);
  }

  // ── 4) ANILLO DE BORDE (donde los rayos llegan al aro) ────────────
  // Un toro/anillo delgado en el radio interior une las puntas de los 5 rayos
  // con el barril para que la pieza sea un solo cuerpo (no rayos sueltos).
  const outerRing = f.torus({
    R: Rin - rimWall * 0.25,
    r: faceT * 0.5,
    at: [0, 0, faceZ],
    rot: [Math.PI / 2, 0, 0],
    name: 'AnilloBorde',
  });

  // ── 5) FUNDIR todo (hub + rayos + anillo + barril) con smooth blend ─
  // smooth da el "fillet" de fundicion donde el rayo nace del hub y del aro.
  const faceAssembly = f.smooth(spokeW * 0.6, hub, ...spokes, outerRing);
  const spider = f.union(faceAssembly, barrel, flangeFront, flangeBack);

  // ── 6) PERFORACIONES (bore central + 5 birlos) ────────────────────
  // Bore central: agujero pasante por el eje.
  const centerBore = f.cylinder({ r: boreR, h: rimW + 20 * MM, at: [0, 0, 0], rot: [Math.PI / 2, 0, 0], name: 'Bore' });

  // 5 birlos (lug holes) sobre el PCD, alineados ENTRE los rayos no — en un
  // rin 5 rayos los birlos suelen quedar en la base de cada rayo. Los ponemos
  // alineados con cada rayo (mismo angulo) para que perforen material solido.
  const lugs: SdfPrimitive[] = [];
  for (let i = 0; i < nSpokes; i++) {
    const ang = (i / nSpokes) * Math.PI * 2 + Math.PI / 2;
    const lx = Math.cos(ang) * pcdR;
    const ly = Math.sin(ang) * pcdR;
    const lug = f.cylinder({ r: lugR, h: faceT + 12 * MM, at: [lx, ly, faceZ], rot: [Math.PI / 2, 0, 0], name: `Birlo_${i + 1}` });
    lugs.push(lug);
  }

  const rin = f.subtract(spider, centerBore, ...lugs);

  f.add(f.group('Rin_5_Rayos', rin));
});
