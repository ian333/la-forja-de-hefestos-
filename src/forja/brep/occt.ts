/**
 * La Forja — Kernel B-Rep real (OpenCASCADE Technology vía WASM)
 * ================================================================
 * Promueve OCCT de "viewer" (occt-import-js) a MODELADOR completo
 * usando `opencascade.js` (OCCT-WASM full, LGPL-2.1).
 *
 * Filosofía (matemático/físico programando): corrección y rigor primero.
 * Cada operación se valida con INVARIANTES topológicas y geométricas
 * (Euler–Poincaré V−E+F=2 para sólido simple, volumen EXACTO vs analítico,
 * STEP roundtrip), no con "se ve bien".
 *
 * Frontera de licencia: este wrapper es solo-LGPL (OCCT). Apto para el
 * cliente que se descarga al navegador. Computo pesado puede migrar al
 * cluster sin tocar esta API.
 *
 * El módulo es agnóstico de entorno:
 *  - Navegador (Vite): `initOCCT()` carga el glue + .wasm vía import dinámico.
 *  - Node (tests/headless): `initOCCT({ factory, wasmBinary, locateFile })`
 *    permite inyectar el factory y el binario (ver scripts/occt-brep-test.cjs).
 */

// ─────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────

/** Instancia de OpenCASCADE (embind). Tipado laxo: la superficie es enorme. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OC = any;

/** Un sólido/forma B-Rep de OCCT (TopoDS_Shape). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Shape = any;

/** Malla triangular lista para three.js. */
export interface TessellatedMesh {
  positions: Float32Array; // xyz por vértice (3·N)
  normals: Float32Array; // xyz por vértice (3·N)
  indices: Uint32Array; // 3 índices por triángulo
  vertexCount: number;
  triangleCount: number;
  /**
   * faceId por TRIÁNGULO (longitud = triangleCount). El valor es el ÍNDICE
   * ESTABLE de cara del kernel (mismo orden que `enumerateFaces` /
   * `uniqueSubShapes(FACE)`), de modo que un raycast → triángulo → faceId
   * mapea directo al `index` que consumen `shellSolid`/`enumerateFaces`.
   */
  faceIds: Uint32Array;
  /**
   * Grupos contiguos por cara para `BufferGeometry.addGroup` en three.js:
   * `{ faceId, start, count }` donde start/count están en ÍNDICES (no triángulos).
   * Permiten asignar un material por cara o resaltar una cara entera por raycast.
   */
  faceGroups: Array<{ faceId: number; start: number; count: number }>;
}

/** Conteo topológico (TopExp_Explorer). */
export interface Topology {
  faces: number;
  edges: number;
  vertices: number;
  /** Característica de Euler–Poincaré: V − E + F. Para un sólido simple = 2. */
  euler: number;
}

export interface InitOptions {
  /** Factory del glue (Node: inyectado). Si falta, se carga el del paquete. */
  factory?: (config: unknown) => Promise<OC>;
  /** Binario .wasm (Node). Si falta, Emscripten lo localiza vía locateFile. */
  wasmBinary?: Uint8Array | ArrayBuffer;
  /** Resuelve la ruta del .wasm (Vite: URL servida; Node: ruta de disco). */
  locateFile?: (path: string) => string;
}

// ─────────────────────────────────────────────────────────────────
// Inicialización (singleton)
// ─────────────────────────────────────────────────────────────────

let _ocPromise: Promise<OC> | null = null;

/**
 * Inicializa OCCT-WASM una sola vez. Devuelve la instancia embind cruda.
 * En navegador no requiere argumentos. En Node, inyecta factory+wasmBinary.
 */
export async function initOCCT(opts: InitOptions = {}): Promise<OC> {
  if (_ocPromise) return _ocPromise;

  _ocPromise = (async () => {
    let factory = opts.factory;
    let locateFile = opts.locateFile;

    if (!factory) {
      // Navegador / bundler (Vite): el paquete expone el glue como default ESM.
      const mod = await import(
        /* @vite-ignore */ 'opencascade.js/dist/opencascade.wasm.js'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      factory = ((mod as any).default ?? mod) as (c: unknown) => Promise<OC>;

      if (!locateFile) {
        // Vite sirve el .wasm como asset; `?url` nos da la URL final con hash.
        // Así el `locateFile` de Emscripten apunta al binario correcto en dev
        // y en build.
        const wasmUrl = (
          await import(
            /* @vite-ignore */ 'opencascade.js/dist/opencascade.wasm.wasm?url'
          )
        ).default as string;
        locateFile = (p: string) =>
          p.endsWith('.wasm') ? wasmUrl : p;
      }
    }

    const config: Record<string, unknown> = {};
    if (opts.wasmBinary) config.wasmBinary = opts.wasmBinary;
    if (locateFile) config.locateFile = locateFile;
    const oc = await factory(config);
    return oc;
  })();

  return _ocPromise;
}

/** Acceso a la instancia ya inicializada (lanza si aún no se llamó initOCCT). */
let _oc: OC | null = null;
export async function getOCCT(): Promise<OC> {
  if (_oc) return _oc;
  _oc = await initOCCT();
  return _oc;
}

/** Para tests: registra la instancia activa sin pasar por el singleton de carga. */
export function _setActiveOCCT(oc: OC): void {
  _oc = oc;
}

// ─────────────────────────────────────────────────────────────────
// Primitivas (BRepPrimAPI)
// ─────────────────────────────────────────────────────────────────

/**
 * Caja axis-aligned de dimensiones dx·dy·dz con esquina en el origen.
 * Volumen analítico = dx·dy·dz. Topología: 6 caras, 12 aristas, 8 vértices.
 */
export function makeBox(oc: OC, dx: number, dy: number, dz: number): Shape {
  const maker = new oc.BRepPrimAPI_MakeBox_1(dx, dy, dz);
  const shape = maker.Shape();
  maker.delete?.();
  return shape;
}

/**
 * Cilindro de radio r y altura h. Por defecto eje +Z desde el origen.
 * Si se pasa `axis` (gp_Ax2), se orienta ahí. Volumen analítico = π·r²·h.
 */
export function makeCylinder(
  oc: OC,
  radius: number,
  height: number,
  axis?: { origin: [number, number, number]; dir: [number, number, number] },
): Shape {
  let maker: OC;
  if (axis) {
    const o = new oc.gp_Pnt_3(axis.origin[0], axis.origin[1], axis.origin[2]);
    const d = new oc.gp_Dir_4(axis.dir[0], axis.dir[1], axis.dir[2]);
    const ax2 = new oc.gp_Ax2_3(o, d);
    maker = new oc.BRepPrimAPI_MakeCylinder_3(ax2, radius, height);
  } else {
    maker = new oc.BRepPrimAPI_MakeCylinder_1(radius, height);
  }
  const shape = maker.Shape();
  maker.delete?.();
  return shape;
}

// ─────────────────────────────────────────────────────────────────
// Extrusión de perfil 2D → sólido B-Rep (el PRIMER MOMENTO del diseñador)
// ─────────────────────────────────────────────────────────────────
//
// Flujo CAD canónico (Onshape/Fusion "Sketch → Extrude"):
//   1. El diseñador dibuja un perfil 2D cerrado en un plano (cotas paramétricas).
//   2. El kernel lo convierte en una CARA plana exacta (no malla):
//        puntos → aristas (segmentos) → wire cerrado → cara.
//      (Para círculos: una sola arista circular geom_circle → wire → cara.)
//   3. BRepPrimAPI_MakePrism barre la cara una distancia `height` a lo largo
//      de la normal del plano → sólido cerrado exacto.
//
// El resultado tiene volumen y topología analíticos:
//   - Rectángulo w·h extruido d  → caja, V = w·h·d, Euler = 2.
//   - Círculo r  extruido d      → cilindro, V = π·r²·d, Euler = 2.

/** Punto 2D en el plano de boceto (unidades = mm). */
export interface Pt2 {
  x: number;
  y: number;
}

/**
 * Plano de boceto: origen + dos ejes ortonormales (u, v) y la normal w = u×v.
 * Por defecto, plano XY (u=+X, v=+Y, w=+Z) anclado en el origen.
 */
export interface SketchPlane3D {
  origin: [number, number, number];
  /** Eje local U (mapea x del perfil 2D). */
  uDir: [number, number, number];
  /** Eje local V (mapea y del perfil 2D). */
  vDir: [number, number, number];
}

export const PLANE_XY: SketchPlane3D = {
  origin: [0, 0, 0],
  uDir: [1, 0, 0],
  vDir: [0, 1, 0],
};

function map2Dto3D(
  plane: SketchPlane3D,
  p: Pt2,
): [number, number, number] {
  const [ox, oy, oz] = plane.origin;
  const [ux, uy, uz] = plane.uDir;
  const [vx, vy, vz] = plane.vDir;
  return [
    ox + ux * p.x + vx * p.y,
    oy + uy * p.x + vy * p.y,
    oz + uz * p.x + vz * p.y,
  ];
}

function crossUnit(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  const c: [number, number, number] = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const len = Math.hypot(c[0], c[1], c[2]) || 1;
  return [c[0] / len, c[1] / len, c[2] / len];
}

/**
 * Construye un wire cerrado a partir de un polígono 2D (segmentos rectos)
 * mapeado al plano 3D. El polígono debe ser cerrado en intención: el último
 * vértice se une al primero automáticamente.
 */
function makePolygonWire(oc: OC, plane: SketchPlane3D, pts: Pt2[]): Shape {
  const wireMaker = new oc.BRepBuilderAPI_MakeWire_1();
  const n = pts.length;
  // Evita una arista degenerada si el perfil ya repite el primer punto al final.
  const last = pts[n - 1];
  const first = pts[0];
  const closed =
    Math.abs(last.x - first.x) < 1e-9 && Math.abs(last.y - first.y) < 1e-9;
  const count = closed ? n - 1 : n;
  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % count];
    const [ax, ay, az] = map2Dto3D(plane, a);
    const [bx, by, bz] = map2Dto3D(plane, b);
    const pa = new oc.gp_Pnt_3(ax, ay, az);
    const pb = new oc.gp_Pnt_3(bx, by, bz);
    const edge = new oc.BRepBuilderAPI_MakeEdge_3(pa, pb).Edge();
    wireMaker.Add_1(edge);
  }
  const wire = wireMaker.Wire();
  wireMaker.delete?.();
  return wire;
}

/**
 * Extruye un PERFIL POLIGONAL cerrado (lista de puntos 2D) por una distancia
 * `height` a lo largo de la normal del plano. Devuelve un sólido B-Rep exacto.
 *
 * Invariante: para un rectángulo de área A, V = A·height; Euler del sólido = 2.
 */
export function extrudePolygon(
  oc: OC,
  pts: Pt2[],
  height: number,
  plane: SketchPlane3D = PLANE_XY,
): Shape {
  if (pts.length < 3) {
    throw new Error('extrudePolygon: se requieren ≥3 puntos para un perfil');
  }
  const wire = makePolygonWire(oc, plane, pts);
  const face = new oc.BRepBuilderAPI_MakeFace_15(wire, true).Face();
  const w = crossUnit(plane.uDir, plane.vDir);
  const vec = new oc.gp_Vec_4(w[0] * height, w[1] * height, w[2] * height);
  const prism = new oc.BRepPrimAPI_MakePrism_1(face, vec, false, true);
  const shape = prism.Shape();
  prism.delete?.();
  return shape;
}

/**
 * Extruye un CÍRCULO (centro 2D + radio) por `height`. Construye la arista
 * circular exacta (Geom_Circle, no facetada) → wire → cara → prisma.
 * Invariante: V = π·r²·height; el cilindro resultante tiene Euler = 2.
 */
export function extrudeCircle(
  oc: OC,
  center: Pt2,
  radius: number,
  height: number,
  plane: SketchPlane3D = PLANE_XY,
): Shape {
  const [cx, cy, cz] = map2Dto3D(plane, center);
  const w = crossUnit(plane.uDir, plane.vDir);
  const centerPnt = new oc.gp_Pnt_3(cx, cy, cz);
  const normalDir = new oc.gp_Dir_4(w[0], w[1], w[2]);
  const ax2 = new oc.gp_Ax2_3(centerPnt, normalDir);
  const circle = new oc.gp_Circ_2(ax2, radius);
  const edge = new oc.BRepBuilderAPI_MakeEdge_8(circle).Edge();
  const wireMaker = new oc.BRepBuilderAPI_MakeWire_2(edge);
  const wire = wireMaker.Wire();
  wireMaker.delete?.();
  const face = new oc.BRepBuilderAPI_MakeFace_15(wire, true).Face();
  const vec = new oc.gp_Vec_4(w[0] * height, w[1] * height, w[2] * height);
  const prism = new oc.BRepPrimAPI_MakePrism_1(face, vec, false, true);
  const shape = prism.Shape();
  prism.delete?.();
  return shape;
}

// ─────────────────────────────────────────────────────────────────
// Booleanas exactas (BRepAlgoAPI)
// ─────────────────────────────────────────────────────────────────
// En este build (opencascade.js 1.1.1) la variante de 2 argumentos
// (`_3`) construye y resuelve sin requerir Message_ProgressRange.

/** Unión booleana A ∪ B. */
export function fuse(oc: OC, a: Shape, b: Shape): Shape {
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b);
  const shape = op.Shape();
  op.delete?.();
  return shape;
}

/** Diferencia booleana A − B (corta B de A). */
export function cut(oc: OC, a: Shape, b: Shape): Shape {
  const op = new oc.BRepAlgoAPI_Cut_3(a, b);
  const shape = op.Shape();
  op.delete?.();
  return shape;
}

/** Intersección booleana A ∩ B. */
export function common(oc: OC, a: Shape, b: Shape): Shape {
  const op = new oc.BRepAlgoAPI_Common_3(a, b);
  const shape = op.Shape();
  op.delete?.();
  return shape;
}

// ─────────────────────────────────────────────────────────────────
// Fillet (BRepFilletAPI) — redondeo de aristas
// ─────────────────────────────────────────────────────────────────

/**
 * Redondea TODAS las aristas de la forma con radio constante.
 * (Aplicar fillet tarde en el árbol de features; aquí es la operación cruda.)
 */
export function filletAllEdges(oc: OC, shape: Shape, radius: number): Shape {
  const mk = new oc.BRepFilletAPI_MakeFillet(
    shape,
    oc.ChFi3d_FilletShape.ChFi3d_Rational,
  );
  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  while (exp.More()) {
    const edge = oc.TopoDS.Edge_1(exp.Current());
    mk.Add_2(radius, edge);
    exp.Next();
  }
  const out = mk.Shape();
  exp.delete?.();
  mk.delete?.();
  return out;
}

/**
 * Redondea SOLO las aristas cuyo índice (en el orden estable de
 * `enumerateEdges`) está en `edgeIndices`. Es el fillet SELECTIVO que el
 * diseñador usa al clicar aristas en el viewport / panel.
 *
 * Si `edgeIndices` está vacío, redondea todas (equivale a filletAllEdges).
 */
export function filletEdges(
  oc: OC,
  shape: Shape,
  radius: number,
  edgeIndices: number[],
): Shape {
  const mk = new oc.BRepFilletAPI_MakeFillet(
    shape,
    oc.ChFi3d_FilletShape.ChFi3d_Rational,
  );
  const want = new Set(edgeIndices);
  const all = want.size === 0;
  const edges = uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE);
  let added = 0;
  for (let i = 0; i < edges.length; i++) {
    if (all || want.has(i)) {
      mk.Add_2(radius, oc.TopoDS.Edge_1(edges[i]));
      added++;
    }
  }
  if (added === 0) {
    mk.delete?.();
    for (const e of edges) e.delete?.();
    throw new Error('filletEdges: ninguna arista seleccionada');
  }
  const out = mk.Shape();
  mk.delete?.();
  for (const e of edges) e.delete?.();
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Chamfer (BRepFilletAPI_MakeChamfer) — bisel de aristas
// ─────────────────────────────────────────────────────────────────

/**
 * Bisela aristas (chamfer simétrico de distancia `dist`). Selección por índice
 * estable de `enumerateEdges`; vacío = todas las aristas.
 */
export function chamferEdges(
  oc: OC,
  shape: Shape,
  dist: number,
  edgeIndices: number[],
): Shape {
  const mk = new oc.BRepFilletAPI_MakeChamfer(shape);
  const want = new Set(edgeIndices);
  const all = want.size === 0;
  const edges = uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE);
  let added = 0;
  for (let i = 0; i < edges.length; i++) {
    if (all || want.has(i)) {
      // Add_2(dist, edge): chamfer simétrico de la arista.
      mk.Add_2(dist, oc.TopoDS.Edge_1(edges[i]));
      added++;
    }
  }
  if (added === 0) {
    mk.delete?.();
    for (const e of edges) e.delete?.();
    throw new Error('chamferEdges: ninguna arista seleccionada');
  }
  const out = mk.Shape();
  mk.delete?.();
  for (const e of edges) e.delete?.();
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Shell / vaciado (BRepOffsetAPI_MakeThickSolid) — pared delgada
// ─────────────────────────────────────────────────────────────────

/**
 * Vacía un sólido dejando pared delgada de espesor `thickness`, removiendo
 * la(s) cara(s) `faceIndices` (índices estables de `enumerateFaces`) para
 * abrir el hueco. `thickness` > 0 deja la pared HACIA ADENTRO (offset
 * negativo en OCCT). Es el feature "dog bowl / tray".
 *
 * Implementa BRepOffsetAPI_MakeThickSolid::MakeThickSolidByJoin con una
 * TopTools_ListOfShape de caras a remover.
 */
export function shellSolid(
  oc: OC,
  shape: Shape,
  thickness: number,
  faceIndices: number[],
): Shape {
  if (!faceIndices.length) {
    throw new Error('shellSolid: hay que indicar al menos una cara abierta');
  }
  const faces = uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_FACE);
  const facesToRemove = new oc.TopTools_ListOfShape_1();
  for (const idx of faceIndices) {
    if (idx >= 0 && idx < faces.length) {
      facesToRemove.Append_1(faces[idx]);
    }
  }
  // Constructor por defecto (variante _1 en este build) + MakeThickSolidByJoin.
  // ⚠️ Este build NO expone Message_ProgressRange: la firma es de 9 args
  // (sin el rango de progreso). offset NEGATIVO = pared hacia adentro.
  const mk = new oc.BRepOffsetAPI_MakeThickSolid_1();
  // MakeThickSolidByJoin(shape, closingFaces, offset, tol, mode, intersection,
  //   selfInter, joinType, removeIntEdges)
  mk.MakeThickSolidByJoin(
    shape,
    facesToRemove,
    -Math.abs(thickness),
    1e-3,
    oc.BRepOffset_Mode.BRepOffset_Skin,
    false,
    false,
    oc.GeomAbs_JoinType.GeomAbs_Arc,
    false,
  );
  const out = mk.Shape();
  mk.delete?.();
  facesToRemove.delete?.();
  for (const f of faces) f.delete?.();
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Revolve (BRepPrimAPI_MakeRevol) — sólido de revolución
// ─────────────────────────────────────────────────────────────────

/** Eje de revolución arbitrario (gp_Ax1): origen + dirección. */
export interface RevolveAxis {
  origin: [number, number, number];
  dir: [number, number, number];
}

/**
 * Revoluciona un PERFIL POLIGONAL cerrado (puntos 2D, plano XY) un ángulo
 * `angleDeg` alrededor de un EJE. Por defecto el eje es el V del plano (+Y, x=0);
 * `axis` lo sobrescribe con un gp_Ax1 arbitrario — típicamente derivado de una
 * arista RECTA elegida por clic (su `EdgeGeom.axis`) o de un preset global X/Y/Z.
 * El perfil debe quedar TODO a UN lado del eje para un sólido axisimétrico válido.
 *
 * Invariante para 360° con eje +Y: volumen = teorema de Pappus = 2π · A · x̄.
 */
export function revolvePolygon(
  oc: OC,
  pts: Pt2[],
  angleDeg: number,
  plane: SketchPlane3D = PLANE_XY,
  axis?: RevolveAxis,
): Shape {
  if (pts.length < 3) {
    throw new Error('revolvePolygon: se requieren ≥3 puntos');
  }
  const wire = makePolygonWire(oc, plane, pts);
  const face = new oc.BRepBuilderAPI_MakeFace_15(wire, true).Face();
  // Eje de revolución: el `axis` explícito (arista/preset) o, por defecto, el
  // eje V del plano (+Y) anclado en el origen del plano.
  const origin = axis ? axis.origin : plane.origin;
  const dir = axis ? axis.dir : plane.vDir;
  const o = new oc.gp_Pnt_3(origin[0], origin[1], origin[2]);
  const d = new oc.gp_Dir_4(dir[0], dir[1], dir[2]);
  const ax1 = new oc.gp_Ax1_2(o, d);
  const ang = (angleDeg * Math.PI) / 180;
  const full = Math.abs(angleDeg - 360) < 1e-6;
  const mk = full
    ? new oc.BRepPrimAPI_MakeRevol_2(face, ax1, true)
    : new oc.BRepPrimAPI_MakeRevol_1(face, ax1, ang, true);
  const shape = mk.Shape();
  mk.delete?.();
  return shape;
}

// ─────────────────────────────────────────────────────────────────
// Hole / barreno: resta de un cilindro pasante o ciego
// ─────────────────────────────────────────────────────────────────

/**
 * Perfora un barreno cilíndrico en `shape`. El barreno se posiciona en
 * (x, y) del plano XY y baja en −Z desde `zTop` una profundidad `depth`
 * (o `through` = pasante: lo extendemos generosamente más allá del sólido).
 * Diámetro `diameter`. Devuelve shape − cilindro.
 */
export function drillHole(
  oc: OC,
  shape: Shape,
  opts: {
    x: number;
    y: number;
    diameter: number;
    zTop: number;
    depth: number;
    through: boolean;
    spanBelow?: number;
  },
): Shape {
  const r = opts.diameter / 2;
  const margin = 1e-3;
  // Para "pasante" el cilindro debe sobrar por arriba y por abajo del sólido.
  const span = opts.through ? (opts.spanBelow ?? 0) + opts.zTop + 2 * margin : opts.depth;
  const top = opts.zTop + margin;
  const tool = makeCylinder(oc, r, span, {
    origin: [opts.x, opts.y, top],
    dir: [0, 0, -1],
  });
  const out = cut(oc, shape, tool);
  tool.delete?.();
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Topología (TopExp_Explorer) — invariante de Euler–Poincaré
// ─────────────────────────────────────────────────────────────────

/**
 * Devuelve las sub-formas ÚNICAS (por IsSame) de un tipo dado, en orden de
 * recorrido del TopExp_Explorer. Este ORDEN es estable para una misma forma
 * y es el que usamos como "nombre" de cara/arista en la selección de la UI
 * (índice 0..n-1). El llamador es dueño de los wrappers y debe .delete().
 */
export function uniqueSubShapes(oc: OC, shape: Shape, kind: number): Shape[] {
  const exp = new oc.TopExp_Explorer_2(
    shape,
    kind,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  const unique: Shape[] = [];
  while (exp.More()) {
    const sub = exp.Current();
    let dup = false;
    for (const prev of unique) {
      if (prev.IsSame(sub)) {
        dup = true;
        break;
      }
    }
    if (dup) sub.delete?.();
    else unique.push(sub);
    exp.Next();
  }
  exp.delete?.();
  return unique;
}

function countSubShapes(oc: OC, shape: Shape, kind: number): number {
  const exp = new oc.TopExp_Explorer_2(
    shape,
    kind,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  // TopExp_Explorer enumera con repetición (una arista compartida por 2 caras
  // aparece 2 veces; un vértice compartido por 3 aristas, 3 veces). Para el
  // conteo topológico verdadero deduplicamos por identidad de sub-forma.
  //
  // Este build de opencascade.js NO expone TopTools_*Map, así que deduplicamos
  // en JS: bucket por HashCode (rápido) y se confirma con IsSame() —que ignora
  // la orientación pero distingue ubicación/geometría— dentro del bucket.
  // TopExp_Explorer enumera con repetición. Para el conteo topológico único
  // deduplicamos por IDENTIDAD de sub-forma con IsSame() —que compara TShape +
  // Location e ignora la orientación, justo el criterio topológico correcto.
  //
  // No usamos HashCode como llave de bucket porque en OCCT puede variar para
  // la MISMA arista vista desde caras distintas (depende de orientación en
  // algunos casos), lo que rompería el agrupamiento y SUBCONTARÍA la fusión
  // (síntoma observado: fillet con Euler=-6). El número de sub-formas únicas
  // por sólido es pequeño, así que una comparación O(n²) con IsSame es exacta
  // y suficientemente rápida.
  const unique: Shape[] = [];
  while (exp.More()) {
    const sub = exp.Current();
    let dup = false;
    for (const prev of unique) {
      if (prev.IsSame(sub)) {
        dup = true;
        break;
      }
    }
    if (dup) {
      sub.delete?.(); // libera el wrapper duplicado de inmediato
    } else {
      unique.push(sub);
    }
    exp.Next();
  }
  const count = unique.length;
  for (const s of unique) s.delete?.();
  exp.delete?.();
  return count;
}

/**
 * Cuenta caras/aristas/vértices únicos y calcula la característica de Euler.
 * Para un sólido simple (topológicamente una esfera) V − E + F = 2.
 */
export function topology(oc: OC, shape: Shape): Topology {
  const faces = countSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_FACE);
  const edges = countSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE);
  const vertices = countSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_VERTEX);
  return { faces, edges, vertices, euler: vertices - edges + faces };
}

// ─────────────────────────────────────────────────────────────────
// Volumen EXACTO (GProp_GProps + BRepGProp::VolumeProperties)
// ─────────────────────────────────────────────────────────────────

/**
 * Volumen exacto del sólido por integración de las propiedades geométricas
 * (no por la malla). Para una caja 50·30·20 devuelve 30000 exacto.
 */
export function volume(oc: OC, shape: Shape): number {
  const props = new oc.GProp_GProps_1();
  // VolumeProperties_1(shape, props, onlyClosed, skipShared, useTriangulation)
  oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
  const v = props.Mass();
  props.delete?.();
  return v;
}

/** Área de superficie exacta (SurfaceProperties). Útil para invariantes. */
export function surfaceArea(oc: OC, shape: Shape): number {
  const props = new oc.GProp_GProps_1();
  // SurfaceProperties_1(shape, props, skipShared, useTriangulation)
  oc.BRepGProp.SurfaceProperties_1(shape, props, false, false);
  const a = props.Mass();
  props.delete?.();
  return a;
}

// ─────────────────────────────────────────────────────────────────
// Propiedades de masa EXACTAS — el primer "análisis" del diseñador
// (GProp_GProps: centro de masa + tensor de inercia + radio de giro)
// ─────────────────────────────────────────────────────────────────

export interface MassProperties {
  /** Volumen exacto (mm³). */
  volume: number;
  /** Masa (g) = volumen·densidad. densidad en g/mm³. */
  mass: number;
  /** Centro de masa [x,y,z] (mm). */
  centerOfMass: [number, number, number];
  /** Tensor de inercia 3×3 respecto al centro de masa (g·mm²). */
  inertia: [[number, number, number], [number, number, number], [number, number, number]];
  /** Momentos principales de inercia (g·mm²). */
  principal: [number, number, number];
}

/**
 * Calcula masa/centro-de-masa/inercia EXACTOS vía GProp_GProps. La inercia que
 * devuelve OCCT es respecto al origen; la trasladamos al centro de masa con el
 * teorema de ejes paralelos para reportar el tensor físico de la pieza, y la
 * escalamos por la densidad (g/mm³) para dar masa real.
 */
export function massProperties(
  oc: OC,
  shape: Shape,
  density: number,
): MassProperties {
  const props = new oc.GProp_GProps_1();
  oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
  const vol = props.Mass(); // "Mass" de GProp con densidad 1 = volumen
  const com = props.CentreOfMass();
  const cx = com.X();
  const cy = com.Y();
  const cz = com.Z();

  // Matriz de inercia respecto al origen (densidad 1), gp_Mat 1-indexada.
  const m = props.MatrixOfInertia();
  const I0 = (i: number, j: number) => m.Value(i, j) as number;

  // Teorema de ejes paralelos para mover I del origen al centro de masa.
  // I_cm = I_0 − m·(d² I − d⊗d), con m=vol (densidad 1), d = centro de masa.
  const d2 = cx * cx + cy * cy + cz * cz;
  const dd = [
    [cx * cx, cx * cy, cx * cz],
    [cy * cx, cy * cy, cy * cz],
    [cz * cx, cz * cy, cz * cz],
  ];
  const delta = (i: number, j: number) => (i === j ? 1 : 0);
  const Icm: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const i0 = I0(i + 1, j + 1);
      Icm[i][j] = (i0 - vol * (d2 * delta(i, j) - dd[i][j])) * density;
    }
  }

  // Momentos principales = eigenvalores del tensor de inercia simétrico (3×3),
  // forma cerrada de Smith (1961) para matrices simétricas — exacta y estable.
  const principal = symEigenvalues3(Icm) as [number, number, number];

  props.delete?.();
  return {
    volume: vol,
    mass: vol * density,
    centerOfMass: [cx, cy, cz],
    inertia: Icm as MassProperties['inertia'],
    principal,
  };
}

/** Eigenvalores de una matriz simétrica 3×3 (Smith, forma cerrada). */
function symEigenvalues3(A: number[][]): number[] {
  const p1 = A[0][1] ** 2 + A[0][2] ** 2 + A[1][2] ** 2;
  if (p1 < 1e-18) {
    return [A[0][0], A[1][1], A[2][2]].sort((a, b) => b - a);
  }
  const q = (A[0][0] + A[1][1] + A[2][2]) / 3;
  const p2 =
    (A[0][0] - q) ** 2 + (A[1][1] - q) ** 2 + (A[2][2] - q) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  const B = [
    [(A[0][0] - q) / p, A[0][1] / p, A[0][2] / p],
    [A[1][0] / p, (A[1][1] - q) / p, A[1][2] / p],
    [A[2][0] / p, A[2][1] / p, (A[2][2] - q) / p],
  ];
  const detB =
    B[0][0] * (B[1][1] * B[2][2] - B[1][2] * B[2][1]) -
    B[0][1] * (B[1][0] * B[2][2] - B[1][2] * B[2][0]) +
    B[0][2] * (B[1][0] * B[2][1] - B[1][1] * B[2][0]);
  let r = detB / 2;
  r = Math.max(-1, Math.min(1, r));
  const phi = Math.acos(r) / 3;
  const e1 = q + 2 * p * Math.cos(phi);
  const e3 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
  const e2 = 3 * q - e1 - e3;
  return [e1, e2, e3].sort((a, b) => b - a);
}

// ─────────────────────────────────────────────────────────────────
// Enumeración de caras / aristas con descriptor geométrico
// (para la SELECCIÓN del diseñador: lista nombrada + picking por raycast)
// ─────────────────────────────────────────────────────────────────

export interface FaceRef {
  index: number;
  /** 'plane' | 'cylinder' | 'cone' | 'sphere' | 'other' */
  kind: string;
  area: number;
  /** centroide de la cara [x,y,z] (mm) — ancla del label y target del picking. */
  center: [number, number, number];
  /** normal aproximada en el centroide (solo planos; [0,0,0] si no aplica). */
  normal: [number, number, number];
}

export interface EdgeRef {
  index: number;
  /** 'line' | 'circle' | 'other' */
  kind: string;
  length: number;
  /** punto medio de la arista [x,y,z] (mm). */
  mid: [number, number, number];
}

/**
 * Geometría PICKEABLE de una arista: su polilínea 3D (discretización exacta de
 * la curva) y, si es recta, su eje (punto + dirección unitaria) para usarla de
 * gp_Ax1 en el revolve. `edgeId` es el índice ESTABLE (mismo orden que
 * `enumerateEdges` / `uniqueSubShapes(EDGE)`), de modo que un raycast contra
 * la geometría de la arista → edgeId mapea directo a la lista de la UI.
 */
export interface EdgeGeom {
  edgeId: number;
  /** 'line' | 'circle' | 'other' */
  kind: string;
  length: number;
  /** Vértices 3D de la polilínea que aproxima la curva (≥2 puntos). */
  polyline: Array<[number, number, number]>;
  /** punto medio [x,y,z] (mm) — ancla del label / HUD. */
  mid: [number, number, number];
  /**
   * Solo para aristas RECTAS: eje (origen + dirección unitaria) listo para
   * construir un gp_Ax1 de revolución. Ausente en curvas (círculos, etc.).
   */
  axis?: {
    origin: [number, number, number];
    dir: [number, number, number];
  };
}

/** Lista de caras con tipo/área/centroide en el orden estable del explorer. */
export function enumerateFaces(oc: OC, shape: Shape): FaceRef[] {
  const faces = uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_FACE);
  const out: FaceRef[] = [];
  for (let i = 0; i < faces.length; i++) {
    const f = oc.TopoDS.Face_1(faces[i]);
    const adaptor = new oc.BRepAdaptor_Surface_2(f, true);
    const gt = adaptor.GetType().value as number;
    const kindMap: Record<number, string> = {
      [oc.GeomAbs_SurfaceType.GeomAbs_Plane.value]: 'plane',
      [oc.GeomAbs_SurfaceType.GeomAbs_Cylinder.value]: 'cylinder',
      [oc.GeomAbs_SurfaceType.GeomAbs_Cone.value]: 'cone',
      [oc.GeomAbs_SurfaceType.GeomAbs_Sphere.value]: 'sphere',
    };
    const kind = kindMap[gt] ?? 'other';

    const props = new oc.GProp_GProps_1();
    oc.BRepGProp.SurfaceProperties_1(faces[i], props, false, false);
    const area = props.Mass();
    const c = props.CentreOfMass();
    const center: [number, number, number] = [c.X(), c.Y(), c.Z()];
    props.delete?.();

    // Normal en el centroide (para planos; usamos parámetros medios u,v).
    let normal: [number, number, number] = [0, 0, 0];
    try {
      const u0 = adaptor.FirstUParameter();
      const u1 = adaptor.LastUParameter();
      const v0 = adaptor.FirstVParameter();
      const v1 = adaptor.LastVParameter();
      const slp = new oc.BRepLProp_SLProps_1(adaptor, (u0 + u1) / 2, (v0 + v1) / 2, 1, 1e-6);
      if (slp.IsNormalDefined()) {
        const n = slp.Normal();
        normal = [n.X(), n.Y(), n.Z()];
      }
      slp.delete?.();
    } catch {
      /* superficie sin normal definida (raro) */
    }
    adaptor.delete?.();
    out.push({ index: i, kind, area, center, normal });
  }
  for (const f of faces) f.delete?.();
  return out;
}

/** Lista de aristas con tipo/longitud/punto-medio en orden estable. */
export function enumerateEdges(oc: OC, shape: Shape): EdgeRef[] {
  const edges = uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE);
  const out: EdgeRef[] = [];
  for (let i = 0; i < edges.length; i++) {
    const e = oc.TopoDS.Edge_1(edges[i]);
    const adaptor = new oc.BRepAdaptor_Curve_2(e);
    const gt = adaptor.GetType().value as number;
    const kindMap: Record<number, string> = {
      [oc.GeomAbs_CurveType.GeomAbs_Line.value]: 'line',
      [oc.GeomAbs_CurveType.GeomAbs_Circle.value]: 'circle',
    };
    const kind = kindMap[gt] ?? 'other';

    const props = new oc.GProp_GProps_1();
    // Este build expone LinearProperties (sin sufijo _1): (shape, props, skipShared, useTri).
    oc.BRepGProp.LinearProperties(edges[i], props, false, false);
    const length = props.Mass();
    const c = props.CentreOfMass();
    const mid: [number, number, number] = [c.X(), c.Y(), c.Z()];
    props.delete?.();
    adaptor.delete?.();
    out.push({ index: i, kind, length, mid });
  }
  for (const e of edges) e.delete?.();
  return out;
}

/**
 * Emite la GEOMETRÍA PICKEABLE de cada arista (orden estable, dedup por IsSame):
 * discretiza la curva subyacente (BRepAdaptor_Curve) a una polilínea 3D
 * muestreando `Value(t)` en el rango paramétrico [first,last]. Las RECTAS se
 * etiquetan con un eje (origen + dirección unitaria) listo para usarse como
 * gp_Ax1 en el revolve; las curvas se muestrean con más segmentos para que el
 * raycast contra los tubos finos de la UI sea fiel.
 *
 * `segments` = número de segmentos por arista CURVA (rectas: 1 segmento, 2 pts).
 * Devuelve {edgeId, kind, length, polyline, mid, axis?} con edgeId == índice de
 * `enumerateEdges` (misma enumeración), para que la UI mapee raycast → edgeId.
 */
export function enumerateEdgesGeom(
  oc: OC,
  shape: Shape,
  segments = 48,
): EdgeGeom[] {
  const edges = uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE);
  const out: EdgeGeom[] = [];
  const lineEnum = oc.GeomAbs_CurveType.GeomAbs_Line.value as number;
  const circleEnum = oc.GeomAbs_CurveType.GeomAbs_Circle.value as number;

  for (let i = 0; i < edges.length; i++) {
    const e = oc.TopoDS.Edge_1(edges[i]);
    const adaptor = new oc.BRepAdaptor_Curve_2(e);
    const gt = adaptor.GetType().value as number;
    const kind = gt === lineEnum ? 'line' : gt === circleEnum ? 'circle' : 'other';

    const t0 = adaptor.FirstParameter() as number;
    const t1 = adaptor.LastParameter() as number;
    // Recta: 2 puntos (extremos). Curva: muestreo uniforme en el parámetro.
    const n = kind === 'line' ? 1 : Math.max(2, segments);
    const polyline: Array<[number, number, number]> = [];
    for (let k = 0; k <= n; k++) {
      const t = t0 + ((t1 - t0) * k) / n;
      const p = adaptor.Value(t);
      polyline.push([p.X(), p.Y(), p.Z()]);
    }

    const props = new oc.GProp_GProps_1();
    oc.BRepGProp.LinearProperties(edges[i], props, false, false);
    const length = props.Mass() as number;
    const c = props.CentreOfMass();
    const mid: [number, number, number] = [c.X(), c.Y(), c.Z()];
    props.delete?.();

    let axis: EdgeGeom['axis'] | undefined;
    if (kind === 'line') {
      const a = polyline[0];
      const b = polyline[polyline.length - 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      axis = { origin: a, dir: [dx / len, dy / len, dz / len] };
    }

    adaptor.delete?.();
    out.push({ edgeId: i, kind, length, polyline, mid, axis });
  }
  for (const e of edges) e.delete?.();
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Teselado (BRepMesh) → {positions, indices, normals} para three.js
// ─────────────────────────────────────────────────────────────────

/**
 * Tesela la forma B-Rep a malla triangular indexada con normales por vértice,
 * ETIQUETANDO cada triángulo con el ÍNDICE ESTABLE de su cara OCCT.
 * `deflection` = error de cuerda máximo (mm); menor = más fino.
 * `angle` = desviación angular máxima (rad) en superficies curvas.
 *
 * Recorre cada cara (TopExp_Explorer en el MISMO orden que `uniqueSubShapes`
 * /`enumerateFaces`), lee su Poly_Triangulation, transforma por la
 * TopLoc_Location de la cara y orienta los triángulos según la orientación de
 * la cara (REVERSED ⇒ invierte el winding). Por cada cara emite un GRUPO
 * contiguo `{faceId, start, count}` y un `faceIds[triángulo]` para que el
 * picking por raycast (three.js da el índice del triángulo) mapee a faceId.
 *
 * Nota de corrección: para un SÓLIDO cada cara aparece UNA sola vez en el
 * TopExp_Explorer (a diferencia de aristas/vértices, que se comparten). Por eso
 * el contador en orden de exploración == índice único de cara, idéntico al de
 * `enumerateFaces`. Aun así deduplicamos con IsSame por robustez ante shapes
 * compuestos (p. ej. resultados booleanos con sub-sólidos).
 */
export function tessellate(
  oc: OC,
  shape: Shape,
  deflection = 0.1,
  angle = 0.5,
): TessellatedMesh {
  // Genera la triangulación incremental in-place sobre la forma.
  // _2(shape, deflection, isRelative, angDeflection, isInParallel)
  const mesh = new oc.BRepMesh_IncrementalMesh_2(
    shape,
    deflection,
    false,
    angle,
    false,
  );
  mesh.Perform?.();

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const faceIds: number[] = [];
  const faceGroups: Array<{ faceId: number; start: number; count: number }> = [];
  let vertexOffset = 0;

  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  const ORIENT_REVERSED = oc.TopAbs_Orientation.TopAbs_REVERSED.value as number;

  // Lista de caras únicas para asignar el índice estable por IsSame. Es el
  // MISMO orden/criterio que enumerateFaces y que consume shellSolid.
  const uniqueFaces = uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_FACE);
  const faceIdOf = (s: Shape): number => {
    for (let k = 0; k < uniqueFaces.length; k++) {
      if (uniqueFaces[k].IsSame(s)) return k;
    }
    return -1;
  };

  while (exp.More()) {
    const rawShape = exp.Current(); // TopoDS_Shape: expone Orientation_1()
    // La orientación vive en la TopoDS_Shape cruda; el downcast Face_1 solo
    // sirve para que BRep_Tool::Triangulation resuelva la superficie.
    const reversed =
      (rawShape.Orientation_1().value as number) === ORIENT_REVERSED;
    const faceId = faceIdOf(rawShape);
    const face = oc.TopoDS.Face_1(rawShape);
    const loc = new oc.TopLoc_Location_1();
    const triHandle = oc.BRep_Tool.Triangulation(face, loc);

    if (!triHandle.IsNull()) {
      const tri = triHandle.get();
      const trsf = loc.Transformation();

      const nbNodes = tri.NbNodes();
      const nbTris = tri.NbTriangles();

      // Normales por vértice de esta cara (calculadas de los triángulos).
      const faceVerts: Array<{ x: number; y: number; z: number }> = [];
      const accNormals: Array<[number, number, number]> = [];
      for (let i = 1; i <= nbNodes; i++) {
        const p = tri.Node(i).Transformed(trsf);
        faceVerts.push({ x: p.X(), y: p.Y(), z: p.Z() });
        accNormals.push([0, 0, 0]);
      }

      const localTris: Array<[number, number, number]> = [];
      for (let i = 1; i <= nbTris; i++) {
        const t = tri.Triangle(i);
        let n1 = t.Value(1);
        let n2 = t.Value(2);
        let n3 = t.Value(3);
        if (reversed) {
          const tmp = n2;
          n2 = n3;
          n3 = tmp;
        }
        // a base 0
        localTris.push([n1 - 1, n2 - 1, n3 - 1]);
      }

      // Acumula normales geométricas por vértice (área-ponderadas vía cross).
      for (const [a, b, c] of localTris) {
        const va = faceVerts[a];
        const vb = faceVerts[b];
        const vc = faceVerts[c];
        const ux = vb.x - va.x,
          uy = vb.y - va.y,
          uz = vb.z - va.z;
        const wx = vc.x - va.x,
          wy = vc.y - va.y,
          wz = vc.z - va.z;
        const nx = uy * wz - uz * wy;
        const ny = uz * wx - ux * wz;
        const nz = ux * wy - uy * wx;
        for (const idx of [a, b, c]) {
          accNormals[idx][0] += nx;
          accNormals[idx][1] += ny;
          accNormals[idx][2] += nz;
        }
      }

      for (let i = 0; i < nbNodes; i++) {
        const v = faceVerts[i];
        positions.push(v.x, v.y, v.z);
        let [nx, ny, nz] = accNormals[i];
        const len = Math.hypot(nx, ny, nz) || 1;
        normals.push(nx / len, ny / len, nz / len);
      }
      // Grupo contiguo de ESTA cara (en índices, base del addGroup de three).
      const groupStart = indices.length;
      for (const [a, b, c] of localTris) {
        indices.push(vertexOffset + a, vertexOffset + b, vertexOffset + c);
        faceIds.push(faceId);
      }
      faceGroups.push({
        faceId,
        start: groupStart,
        count: indices.length - groupStart,
      });
      vertexOffset += nbNodes;
    }
    loc.delete?.();
    exp.Next();
  }
  exp.delete?.();
  for (const f of uniqueFaces) f.delete?.();
  mesh.delete?.();

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    vertexCount: vertexOffset,
    triangleCount: indices.length / 3,
    faceIds: new Uint32Array(faceIds),
    faceGroups,
  };
}

// ─────────────────────────────────────────────────────────────────
// I/O STEP (STEPControl_Writer / STEPControl_Reader) vía MEMFS
// ─────────────────────────────────────────────────────────────────
//
// ⚠️ BUG REAL Y VERIFICADO de opencascade.js 1.1.1 (heap de WASM):
// Tras una secuencia suficientemente larga de operaciones OCCT (primitivas +
// booleanas + GProp area/volumen + exploradores), el `const char*` que recibe
// `STEPControl_Writer::Write` / `STEPControl_Reader::ReadFile` se asigna en una
// región de heap que quedó corrupta, y los NOMBRES DE ARCHIVO LARGOS (≈≥11
// chars) desbordan a esa zona → el nombre llega como bytes basura y OCCT aborta
// (síntoma: "Step File Name : 8M��..."). Caracterizado empíricamente: nombres
// ≤10 chars sobreviven, ≥13 fallan de forma determinista.
//
// MITIGACIÓN ROBUSTA: el contenido STEP NO depende de la ruta MEMFS, así que
// SIEMPRE usamos una ruta virtual interna CORTA y FIJA. El `filename` que pasa
// el usuario es puramente cosmético/para la UI y no toca al kernel.
const STEP_SCRATCH = 's.stp'; // 5 chars: por debajo del umbral del bug

/**
 * Exporta la forma a un string STEP (AP214) usando el sistema de archivos
 * virtual de Emscripten (MEMFS). El resultado es ASCII STEP estándar,
 * re-importable por OCCT y por cualquier CAD comercial. `filename` es
 * cosmético (no afecta la geometría ni el contenido emitido).
 */
export function exportSTEP(oc: OC, shape: Shape, _filename = 'model.step'): string {
  void _filename;
  const writer = new oc.STEPControl_Writer_1();
  const transferStatus = writer.Transfer(
    shape,
    oc.STEPControl_StepModelType.STEPControl_AsIs,
    true,
  ).value as number;
  const writeStatus = writer.Write(STEP_SCRATCH).value as number;
  const RET_DONE = oc.IFSelect_ReturnStatus.IFSelect_RetDone.value as number;
  if (transferStatus !== RET_DONE) {
    writer.delete?.();
    throw new Error('exportSTEP: Transfer falló (status=' + transferStatus + ')');
  }
  if (writeStatus !== RET_DONE) {
    writer.delete?.();
    throw new Error('exportSTEP: Write falló (status=' + writeStatus + ')');
  }
  const bytes: Uint8Array = oc.FS.readFile(STEP_SCRATCH, { encoding: 'binary' });
  try {
    oc.FS.unlink(STEP_SCRATCH);
  } catch {
    /* noop */
  }
  writer.delete?.();
  return new TextDecoder().decode(bytes);
}

/**
 * Importa una forma desde un string STEP (o bytes). Devuelve un único
 * TopoDS_Shape (OneShape, que compone todas las raíces). `filename` es
 * cosmético; internamente se usa una ruta MEMFS corta (ver bug arriba).
 */
export function importSTEP(
  oc: OC,
  stepData: string | Uint8Array,
  _filename = 'import.step',
): Shape {
  void _filename;
  const bytes =
    typeof stepData === 'string' ? new TextEncoder().encode(stepData) : stepData;
  oc.FS.writeFile(STEP_SCRATCH, bytes);

  const reader = new oc.STEPControl_Reader_1();
  const readStatus = reader.ReadFile(STEP_SCRATCH).value as number;
  const RET_DONE = oc.IFSelect_ReturnStatus.IFSelect_RetDone.value as number;
  if (readStatus !== RET_DONE) {
    reader.delete?.();
    try {
      oc.FS.unlink(STEP_SCRATCH);
    } catch {
      /* noop */
    }
    throw new Error('importSTEP: ReadFile falló (status=' + readStatus + ')');
  }
  reader.TransferRoots();
  const shape = reader.OneShape();
  reader.delete?.();
  try {
    oc.FS.unlink(STEP_SCRATCH);
  } catch {
    /* noop */
  }
  return shape;
}
