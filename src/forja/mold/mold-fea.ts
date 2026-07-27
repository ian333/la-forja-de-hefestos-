/**
 * FEA MECÁNICO REAL del molde — usa el MOTOR del Studio (malla tet de volumen +
 * solver CG disperso, src/forja/brep/fea.ts) sobre el paquete estructural crítico:
 *   B (núcleo) + placa de soporte FUSIONADOS con los 2 RIELES del housing debajo.
 * El claro de flexión de la Fig 12.11 EMERGE de la geometría (no se asume viga):
 *   · EMPOTRADO: caras inferiores de los rieles (asientan en la placa trasera)
 *   · CARGA: presión de fundido sobre el piso del asiento de cavidad (área real)
 * Devuelve la superficie coloreada por von Mises + desplazamientos, lista para
 * pintarse ENCIMA del molde vivo. Validación: el libro (§12.2.2) reporta que el
 * FEM da ~0.4× la viga conservadora (0.024 vs 0.056 mm en su bezel).
 */
import type { MoldAssemblySpec } from './mold-assembly';
import { cavityFootprint, plateDepth } from './mold-drawing-set';
import { plateStackZ } from './mold-plano-set';
import { runFEA, jetColor, type FEAResult } from '../brep/fea';

export interface MoldFeaOverlay {
  positions: Float32Array; normals: Float32Array; indices: Uint32Array;
  colors: Float32Array;                     // RGB por vértice (jet por von Mises)
  maxVonMisesMPa: number; maxDispMm: number;
  nNodes: number; nTets: number; ms: number;
  beamDeflMm: number;                       // Eq 12.10 para contraste (conservadora)
}

/** Construye el sólido de análisis en COORDS DE PLACA (mismo marco que el molde vivo). */
export function buildMoldFeaSolid(K: any, oc: any, spec: MoldAssemblySpec): any {
  const W = spec.widthMm, D = plateDepth(spec);
  const z = plateStackZ(spec);
  const zPart = z.A;                                   // tope del paquete B+soporte
  const hStack = spec.plates.B + spec.plates.support;  // z.support..zPart
  const hRail = spec.plates.ejectorHousing;
  const box = (w: number, l: number, h: number, x0: number, y0: number, z0: number) =>
    K.transformShape(oc, K.makeBox(oc, w, l, h), { translate: [x0, y0, z0] });
  // paquete B+soporte + rieles (la unión hace el puente real de la Fig 12.11)
  let solid = box(W, D, hStack, 0, 0, z.support);
  solid = K.fuse(oc, solid, box(50, D, hRail, 0, 0, z.bottom + spec.plates.bottomClamp));
  solid = K.fuse(oc, solid, box(50, D, hRail, W - 50, 0, z.bottom + spec.plates.bottomClamp));
  // bolsillo somero en el tope = huella de la cavidad → su piso es la cara de carga
  const { fx, fy } = cavityFootprint(spec);
  const cx = W / 2, cy = D / 2, dep = 2;
  solid = K.cut(oc, solid, box(fx, fy, dep + 1, cx - fx / 2, cy - fy / 2, zPart - dep));
  return solid;
}

/** Corre el FEA con presión de fundido en la cavidad y rieles empotrados. */
export function runMoldFea(K: any, oc: any, spec: MoldAssemblySpec, o?: {
  pMeltMPa?: number; resolution?: number;
}): MoldFeaOverlay {
  const t0 = Date.now();
  const W = spec.widthMm, D = plateDepth(spec);
  const z = plateStackZ(spec);
  const zPart = z.A;
  const pMelt = o?.pMeltMPa ?? 80;
  const solid = buildMoldFeaSolid(K, oc, spec);
  // caras: EMPOTRAR fondo de rieles (normal −z en z=base de rieles);
  //        CARGAR el piso del bolsillo (normal +z en z≈zPart−2)
  const zRail = z.bottom + spec.plates.bottomClamp;
  const faces = K.enumerateFaces(oc, solid);
  const fixedFaces: number[] = [];
  const loadFaces: number[] = [];
  for (const f of faces) {
    const n = f.normal ?? [0, 0, 0];
    const c = f.center ?? [0, 0, 0];
    const horiz = Math.abs(n[2]) > 0.9;   // la orientación OCCT puede apuntar a ambos lados
    if (horiz && Math.abs(c[2] - zRail) < 1.5) fixedFaces.push(f.index);
    if (horiz && Math.abs(c[2] - (zPart - 2)) < 1.2) loadFaces.push(f.index);
  }
  if (!fixedFaces.length || !loadFaces.length) throw new Error(`FEA molde: caras no encontradas (fix=${fixedFaces.length}, load=${loadFaces.length})`);
  const result: FEAResult = runFEA(oc, solid, {
    fixedFaces, loadFaces,
    pressure: pMelt * 1e6, pressureDir: [0, 0, -1],     // el fundido empuja hacia abajo
  }, { material: 'acero_1045', resolution: o?.resolution ?? 22 });
  // OVERLAY: la FRONTERA de la malla de tets con σ_vm NODAL directo — miles de
  // triángulos con el dato real por vértice (la superficie OCCT sólo tiene los
  // vértices de las esquinas y LAVABA el colormap al interpolar).
  const faceCount = new Map<string, [number, number, number]>();
  const T = result.mesh.tets;
  const addFace = (a: number, b: number, c: number) => {
    const key = [a, b, c].sort((x, y) => x - y).join(',');
    if (faceCount.has(key)) faceCount.delete(key);       // cara interna (compartida) → fuera
    else faceCount.set(key, [a, b, c]);
  };
  for (let t = 0; t < result.mesh.nTets; t++) {
    const a = T[4 * t], b = T[4 * t + 1], c = T[4 * t + 2], d = T[4 * t + 3];
    addFace(a, b, c); addFace(a, b, d); addFace(a, c, d); addFace(b, c, d);
  }
  const boundary = [...faceCount.values()];
  const positions = new Float32Array(result.mesh.nNodes * 3);
  positions.set(result.mesh.nodes);
  const indices = new Uint32Array(boundary.length * 3);
  boundary.forEach((f, i) => { indices[3 * i] = f[0]; indices[3 * i + 1] = f[1]; indices[3 * i + 2] = f[2]; });
  const colors = new Float32Array(result.mesh.nNodes * 3);
  const vmMax = Math.max(1, result.maxVonMises);
  for (let n = 0; n < result.mesh.nNodes; n++) {
    const [r, g, b2] = jetColor(Math.sqrt(result.vonMisesNodal[n] / vmMax));   // √ para abrir el rango bajo
    colors[3 * n] = r; colors[3 * n + 1] = g; colors[3 * n + 2] = b2;
  }
  const m = { positions, normals: new Float32Array(0), indices };
  // contraste con la viga conservadora del libro (Eq 12.10-12.11)
  const { fx } = cavityFootprint(spec);
  const F = pMelt * 1e6 * (fx / 1000) * ((cavityFootprint(spec).fy) / 1000);
  const L = (W - 100) / 1000, wM = fx / 1000, hM = (spec.plates.B + spec.plates.support) / 1000;
  const I = (wM * hM ** 3) / 12;
  const beamDeflMm = +((F * L ** 3) / (48 * 205e9 * I) * 1000).toFixed(3);
  return {
    positions: m.positions, normals: m.normals, indices: m.indices, colors,
    maxVonMisesMPa: +(result.maxVonMises / 1e6).toFixed(1),
    maxDispMm: +result.maxDisplacement.toFixed(4),
    nNodes: result.mesh.nNodes, nTets: result.mesh.nTets,
    ms: Date.now() - t0, beamDeflMm,
  };
}
