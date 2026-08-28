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
