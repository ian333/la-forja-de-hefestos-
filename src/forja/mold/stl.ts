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
