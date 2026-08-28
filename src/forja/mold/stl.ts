/**
 * PARSER STL — binario y ASCII, browser y node, sin dependencias.
 * ============================================================================
 * Devuelve la sopa de triángulos {positions, indices} que consumen dfmFromMesh,
 * solidFromMesh, meshVolumeArea y gripEjectorLayout. NO decima: la fidelidad la
 * gobiernan los consumidores (el raster de dfm acota su rejilla, el campo de
 * flujo acota sus vóxeles). Decimar aquí rompería la paridad del ray-cast
 * (clustering de vértices → agujeros → vóxeles inalcanzables fantasma).
 */
import type { MeshLike } from './flowlen-mesh';

/** ¿El buffer es STL binario? El header ASCII arranca con "solid ", pero el
 *  criterio FIRME es el conteo: 84 + n·50 debe calzar con el tamaño real. */
function esBinario(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 84) return false;
  const n = new DataView(buf).getUint32(80, true);
  return 84 + n * 50 === buf.byteLength;
}

export function parseSTL(buf: ArrayBuffer): MeshLike {
  if (esBinario(buf)) {
    const dv = new DataView(buf);
    const n = dv.getUint32(80, true);
    const positions = new Float32Array(n * 9);
    const indices = new Uint32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;                       // salta el normal (12 bytes)
      for (let v = 0; v < 9; v++) positions[i * 9 + v] = dv.getFloat32(o + v * 4, true);
      indices[i * 3] = i * 3; indices[i * 3 + 1] = i * 3 + 1; indices[i * 3 + 2] = i * 3 + 2;
    }
    return { positions, indices };
  }
  // ASCII: "vertex x y z" por línea, 3 por facet
  const txt = new TextDecoder().decode(buf);
  const P: number[] = [];
  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) P.push(+m[1], +m[2], +m[3]);
  const nv = Math.floor(P.length / 9) * 9;              // triángulos completos
  const positions = new Float32Array(P.slice(0, nv));
  const indices = new Uint32Array(nv / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  if (!indices.length) throw new Error('STL vacío o ilegible (ni binario ni ASCII con vertex)');
  return { positions, indices };
}

/** Lo que trae una pieza cargada por el operador, además de su malla. */
export interface MallaCargada {
  mesh: MeshLike;
  /** 'stl' | 'step' — de dónde salió la malla */
  fuente: 'stl' | 'step';
  /** sólidos que traía el STEP (1 = pieza limpia; >1 = vienen FUSIONADOS, ver notas) */
  solidos: number;
  /** volumen exacto del kernel (solo STEP; la malla no tiene "exacto" contra qué compararse) */
  volKernelMm3?: number;
  /** supuestos y advertencias DECLARADOS — se pintan, no se esconden */
  notas: string[];
}

/**
 * ARCHIVO → MALLA: el cargador de "suelta TU pieza".
 * ============================================================================
 * Decide por extensión y devuelve SIEMPRE la misma `MeshLike` que consume
 * `revisarModelo` (camino B). Es la única pieza que faltaba: el parser de STL,
 * el tesela del kernel y el motor de revisión ya existían por separado.
 *
 * · `.stl` → `parseSTL` (binario o ASCII, sin kernel: la rama ligera).
 * · `.step`/`.stp` → `importSTEP` + `tessellate` del kernel, que se carga por
 *   import DINÁMICO para que el camino STL siga sin dependencias (este módulo
 *   lo usan scripts de node que no arrancan OCCT).
 *
 * Medido 2026-08-28 (deflexión 0.1 / ángulo 0.5): el volumen de la malla queda
 * a 0.04 % del volumen exacto del kernel en 1594C Lid, 0.09 % en 1594C Box y
 * 0.19 % en 1553B — la tesela NO es la fuente del error de una cotización.
 *
 * HONESTIDAD SOBRE EL MULTI-SÓLIDO: un STEP de fabricante casi nunca trae UNA
 * pieza (1553B trae 10 sólidos: la caja, su tapa y sus postes). Aquí se cuentan
 * y se DECLARAN en `notas`; escoger cuál se moldea es otro ticket. Sin esta nota
 * la máquina cotizaría el conjunto fusionado como si fuera una sola pieza — que
 * es exactamente el defecto que el v1-gate destapó (base 996×996, $502,286).
 */
export async function mallaDesdeArchivo(nombre: string, buf: ArrayBuffer): Promise<MallaCargada> {
  const ext = (nombre.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  if (ext === 'stl') {
    const mesh = parseSTL(buf);
    return { mesh, fuente: 'stl', solidos: 1, notas: [`STL: ${mesh.indices.length / 3} triángulos (malla tal cual, sin decimar)`] };
  }
  if (ext === 'step' || ext === 'stp') {
    const K = await import('../brep/occt');
    const oc = await K.getOCCT();
    const shape = K.importSTEP(oc, new TextDecoder().decode(buf));
    const volKernelMm3 = K.volume(oc, shape);
    if (!(volKernelMm3 > 0)) throw new Error('STEP importado sin volumen (¿superficies sueltas, no un sólido?)');
    const t = K.tessellate(oc, shape, 0.1, 0.5);
    if (!t.triangleCount) throw new Error('STEP importado pero la tesela salió vacía');
    let solidos = 0;
    try {
      const ex = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      while (ex.More()) { solidos++; ex.Next(); }
    } catch { solidos = 0; }
    const notas = [`STEP: ${t.triangleCount} triángulos teselados (deflexión 0.1 mm) · volumen exacto del kernel ${volKernelMm3.toFixed(1)} mm³`];
    if (solidos > 1) notas.push(`⚠ el archivo trae ${solidos} sólidos y se están midiendo FUSIONADOS (caja + tapa + postes cuentan como una pieza): la cotización sale de más. Elegir cuál moldear es otro ticket.`);
    else if (solidos === 0) notas.push('⚠ no se pudo contar sólidos en este STEP (se mide la forma completa)');
    return { mesh: { positions: t.positions, indices: t.indices }, fuente: 'step', solidos, volKernelMm3, notas };
  }
  throw new Error(`extensión no soportada: "${ext || nombre}". El cargador acepta .stl, .step y .stp`);
}

/**
 * MALLA → LO QUE DIBUJA EL VISOR (T1: "revisar ESTA pieza, dentro del CAD").
 * ============================================================================
 * El renderer del CAD (`SolidMesh`) consume un `TessellatedMesh` del kernel:
 * posiciones + NORMALES + índices + faceIds/faceGroups. Un STL trae la sopa de
 * triángulos y nada más, así que aquí se completa lo que falta:
 *  · normales POR CARA replicadas a sus 3 vértices — que es exactamente lo
 *    correcto para un STL (facetado plano; suavizar mentiría sobre la malla).
 *  · un faceId por triángulo. Un STL NO tiene caras topológicas, así que se
 *    declara UNA sola "cara" (0): mejor una verdad pobre que inventar caras
 *    que el archivo no trae. Lo que dependa de caras reales pedirá un STEP.
 * Sin esto, una malla del operador no puede mostrarse en el visor y la revisión
 * se queda en una estampa al lado del CAD — el defecto que ian reportó.
 */
export interface MallaVisor {
  positions: Float32Array; normals: Float32Array; indices: Uint32Array;
  vertexCount: number; triangleCount: number;
  faceIds: Uint32Array;
  faceGroups: Array<{ faceId: number; start: number; count: number }>;
}
export function mallaParaElVisor(mesh: MeshLike): MallaVisor {
  const P = mesh.positions instanceof Float32Array ? mesh.positions : new Float32Array(mesh.positions);
  const I = mesh.indices instanceof Uint32Array ? mesh.indices : new Uint32Array(mesh.indices);
  const nTri = Math.floor(I.length / 3);
  const normals = new Float32Array(P.length);
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L; ny /= L; nz /= L;
    for (const o of [a, b, c]) { normals[o] += nx; normals[o + 1] += ny; normals[o + 2] += nz; }
  }
  // normalizar el acumulado (vértices compartidos promedian; en STL crudo cada
  // vértice pertenece a UN triángulo, así que queda la normal de su cara)
  for (let i = 0; i < normals.length; i += 3) {
    const L = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= L; normals[i + 1] /= L; normals[i + 2] /= L;
  }
  return {
    positions: P, normals, indices: I,
    vertexCount: Math.floor(P.length / 3), triangleCount: nTri,
    faceIds: new Uint32Array(nTri),                                  // una sola "cara": el STL no trae topología
    faceGroups: [{ faceId: 0, start: 0, count: I.length }],
  };
}

/** Caja mínima de una malla (mm) — para encuadrar la cámara y para el gate. */
export function bboxDeMalla(mesh: MeshLike): { min: [number, number, number]; max: [number, number, number]; centro: [number, number, number]; diagonal: number } {
  const P = mesh.positions;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i];
    if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1];
    if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2];
  }
  return {
    min: [x0, y0, z0], max: [x1, y1, z1],
    centro: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    diagonal: Math.hypot(x1 - x0, y1 - y0, z1 - z0),
  };
}
