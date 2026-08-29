/**
 * EL FOCO · LAS MEDIDAS — el plano, encima de la pieza.
 * ============================================================================
 * ian (2026-08-29), después de la investigación de Horizon Zero Dawn:
 * «LO PRIMERO QUE NECESITO DE MI FOCO SON LAS MEDIDAS. Es como si tuviera los
 * planos pero encima».
 *
 * LOS DOS IDIOMAS (de la investigación, no de un gusto):
 *  · EL FOCO  — lo que la máquina SABE de tu pieza. Vive sobre la geometría.
 *  · EL BANCO — el mobiliario del CAD. Sólido, callado, nunca encima de la pieza.
 * En Horizon los dos se separan por ESTILO para que sepas sin pensar cuál es cuál
 * (holograma vs tiza); de Detroit viene la regla de CUÁNDO: el Foco arranca
 * APAGADO y solo muestra lo que hace falta.
 *
 * Este módulo es PURO: recibe una malla (y opcionalmente lo que el kernel sabe) y
 * devuelve `Dim3D[]` — el MISMO tipo que ya dibuja `MoldCotas3D` en el molde. No
 * hay geometría nueva ni un canal de render nuevo: se reusa la maquinaria que ya
 * resolvió los dos gotchas del proyecto (nada de `drei <Text>`, etiquetas DOM
 * proyectadas imperativamente).
 *
 * HONESTIDAD DE LO QUE SE PUEDE MEDIR:
 *  · de una MALLA salen la envolvente y la pared (raster) — nada más. Un STL no
 *    trae topología: no hay "barreno", hay triángulos. Se DICE en vez de inventar.
 *  · de un STEP salen además los ⌀ reales, porque el kernel sí tiene caras.
 */
import type { MeshLike } from './flowlen-mesh';

/** el tipo que ya dibuja MoldCotas3D (mold-dimensions.ts) */
export interface Dim3D {
  id: string; label: string; kind: string;
  a: [number, number, number]; b: [number, number, number];
  value: number; measured?: number; ok?: boolean; why?: string;
}

/** LA PALETA DEL FOCO — Horizon: el cuerpo frío, lo vulnerable cálido. */
export const FOCO = {
  /** lo que la máquina MIDIÓ (cota normal, cuerpo del holograma) */
  cian: '#5fd4f5',
  /** lo que EXIGE tu atención (fuera de la norma del libro) */
  ambar: '#ffc24b',
  /** la violación dura (compartida con el Banco: un error es un error en los dos) */
  rojo: '#ff6b6b',
} as const;

export interface MedidasFoco {
  dims: Dim3D[];
  /** lo que NO se pudo medir y por qué — se pinta, no se esconde */
  noMedido: string[];
  bbox: { min: [number, number, number]; max: [number, number, number] };
}

/**
 * Las cotas de la envolvente: largo × ancho × alto, tiradas por FUERA de la caja
 * (con su holgura) para que la línea no se meta dentro de la pieza y se pierda.
 * Cada una nace en una arista distinta de la caja, como en un plano de verdad:
 * el ancho abajo-al-frente, el largo abajo-al-costado, el alto en la vertical.
 */
export function medidasDeLaPieza(
  mesh: MeshLike,
  opts?: { wallNominalMm?: number; wallP95Mm?: number; wallMinMm?: number; cilindros?: Array<{ radioMm: number; centro: [number, number, number] }> },
): MedidasFoco {
  const P = mesh.positions;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i];
    if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1];
    if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2];
  }
  const L = x1 - x0, W = y1 - y0, H = z1 - z0;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  // holgura de la línea de cota: 6 % de la diagonal, como una cota de plano que
  // se saca de la pieza para que se lea. Nunca menos de 4 mm (piezas chicas).
  const g = Math.max(Math.hypot(L, W, H) * 0.06, 4);

  const dims: Dim3D[] = [
    { id: 'foco-x', label: 'ancho', kind: 'envolvente', value: r1(L), measured: r1(L), ok: true,
      a: [x0, y0 - g, z0], b: [x1, y0 - g, z0], why: 'envolvente medida de la malla' },
    { id: 'foco-y', label: 'largo', kind: 'envolvente', value: r1(W), measured: r1(W), ok: true,
      a: [x1 + g, y0, z0], b: [x1 + g, y1, z0], why: 'envolvente medida de la malla' },
    // el ALTO va del lado DERECHO a propósito: por la izquierda su etiqueta caía
    // encima del panel del Banco (cazado a ojo en la primera corrida del Foco).
    { id: 'foco-z', label: 'alto', kind: 'envolvente', value: r1(H), measured: r1(H), ok: true,
      a: [x1 + g, y1 + g, z0], b: [x1 + g, y1 + g, z1], why: 'envolvente medida de la malla' },
  ];
  const noMedido: string[] = [];

  // LA PARED — el primer gate del libro (§2.3.1): de aquí heredan llenado,
  // contracción y ciclo. La cota se tira en el costado, a media altura.
  if (opts?.wallNominalMm != null) {
    const nom = opts.wallNominalMm, p95 = opts.wallP95Mm;
    const desigual = p95 != null && nom > 0 && p95 / nom > 1.25;   // §2.3.1: pared pareja o el llenado se desbalancea
    dims.push({
      id: 'foco-pared', label: 'pared', kind: 'pared', value: r1(nom),
      measured: p95 != null ? r1(p95) : undefined,
      ok: desigual ? false : undefined,
      a: [x0 - g, y1 + g, (z0 + z1) / 2], b: [x0 - g + Math.max(nom, g * 0.6), y1 + g, (z0 + z1) / 2],
      why: desigual
        ? `§2.3.1 · la pared p95 es ${(p95! / nom).toFixed(2)}× el nominal: el llenado se desbalancea`
        : '§2.3.1 · pared nominal medida del raster',
    });
  } else {
    noMedido.push('la pared: falta el raster de espesor de esta pieza');
  }

  // LOS BARRENOS — solo si el kernel los conoce. Una malla no tiene barrenos:
  // tiene triángulos. Se dice, no se inventa.
  if (opts?.cilindros?.length) {
    for (const [i, c] of opts.cilindros.slice(0, 8).entries()) {
      dims.push({
        id: `foco-d${i}`, label: `⌀${r1(c.radioMm * 2)}`, kind: 'barreno',
        value: r1(c.radioMm * 2), measured: r1(c.radioMm * 2), ok: true,
        a: [c.centro[0] - c.radioMm, c.centro[1], c.centro[2]],
        b: [c.centro[0] + c.radioMm, c.centro[1], c.centro[2]],
        why: 'radio de la cara cilíndrica, del kernel',
      });
    }
  } else {
    noMedido.push('los ⌀ de los barrenos: una malla no trae caras — importa un STEP y salen del kernel');
  }

  return { dims, noMedido, bbox: { min: [x0, y0, z0], max: [x1, y1, z1] } };
}
