/**
 * COTAS EN 3D — "cada componente tiene medidas y coordenadas; es una hueva ir midiendo
 * en Fusion. COTAS EN 3D, obvio, las más importantes. Encontrarás errores: creo que lo
 * que pasa es que como no hay suficiente información en pantalla no extraes todos los
 * errores" (user 2026-07-15).
 *
 * EL DIAGNÓSTICO DEL USER ES CORRECTO Y APLICA A CUALQUIERA QUE MIRE: un render enseña
 * FORMAS, no NÚMEROS. Los defectos que se escapan son justo los que no tienen número a
 * la vista. El bug del M16-vs-M10 se cazó SOLO porque el panel traía texto.
 *
 * LA IDEA QUE LO VUELVE UNA MÁQUINA DE CAZAR ERRORES: la receta (timeline) YA CONOCE sus
 * cotas — son sus `params`. Y el sólido reconstruido se puede MEDIR. Entonces cada cota
 * lleva las DOS cifras:
 *
 *      espesor A: 56 (receta) vs 56.0 (medido) ✓
 *      espesor A: 56 (receta) vs 48.0 (medido) ⚠ ← ESO es un error, cazado solo
 *
 * Una cota que solo repite el parámetro es decoración; una que CONTRASTA receta contra
 * realidad es un detector. Por eso `verifyDims` es el corazón del módulo, no el dibujo.
 */
import type { Component, Feature } from './timeline';   // Feature: usado por componentDims

export type DimKind = 'lineal' | 'diametro' | 'espesor' | 'coordenada';

export interface Dim3D {
  id: string;
  label: string;
  kind: DimKind;
  /** extremos de la cota en coordenadas de MUNDO (mm) — para dibujar la línea */
  a: [number, number, number];
  b: [number, number, number];
  /** lo que dice la RECETA */
  value: number;
  /** lo que mide el SÓLIDO reconstruido (si se pudo medir) */
  measured?: number;
  /** ¿cuadran receta y realidad? */
  ok?: boolean;
  /** la cita del libro que justifica la cota */
  why?: string;
  /** cotas que si fallan rompen el molde (se pintan primero) */
  critical?: boolean;
}

const n = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * COTAS de un componente, derivadas de su RECETA (no medidas a mano). Devuelve las
 * "más importantes" que pidió el user: contorno, espesor, Ø de barrenos y la bolsa.
 */
export function componentDims(c: Component): Dim3D[] {
  const out: Dim3D[] = [];
  const f = (id: string): Feature | undefined => c.timeline.find((x) => x.id === id);

  const sk = f('sk-contorno');
  const ex = f('ex-espesor');
  if (!sk || !ex) return out;
  const cx = n(sk.params.cx), cy = n(sk.params.cy);
  const w = n(sk.params.w), h = n(sk.params.h);
  const z0 = n(sk.params.z), t = n(ex.params.distance);
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;

  out.push({ id: 'ancho', label: 'ancho', kind: 'lineal', value: w, critical: true,
    a: [x0, y0, z0], b: [x1, y0, z0], why: sk.why });
  out.push({ id: 'fondo', label: 'fondo', kind: 'lineal', value: h, critical: true,
    a: [x1, y0, z0], b: [x1, y1, z0], why: sk.why });
  out.push({ id: 'espesor', label: 'espesor', kind: 'espesor', value: t, critical: true,
    a: [x0, y1, z0], b: [x0, y1, z0 + t], why: ex.why });
  // la ALTURA en el apilado: dónde vive la placa (la coordenada, no solo el tamaño)
  out.push({ id: 'z-apilado', label: 'z (apilado)', kind: 'coordenada', value: z0, critical: true,
    a: [x0, y0, 0], b: [x0, y0, z0], why: 'la placa debe caer en su nivel del apilado o choca con la vecina' });

  const br = f('br-tornillos');
  if (br && !br.suppressed) {
    const at = (br.params.at as Array<{ x: number; y: number }>) ?? [];
    out.push({ id: 'tornillo-dia', label: `broca ⌀`, kind: 'diametro', value: n(br.params.dia), critical: true,
      a: [at[0]?.x ?? cx, at[0]?.y ?? cy, z0 + t], b: [(at[0]?.x ?? cx) + n(br.params.dia), at[0]?.y ?? cy, z0 + t],
      why: br.why });
    if (at[0]) out.push({ id: 'tornillo-x', label: 'tornillo x', kind: 'coordenada', value: +at[0].x.toFixed(1),
      a: [x0, at[0].y, z0 + t], b: [at[0].x, at[0].y, z0 + t], why: 'coordenada real del barreno (§12.4)' });
  }

  const bo = f('bolsa-inserto');
  if (bo && !bo.suppressed) {
    const bw = n(bo.params.w), bd = n(bo.params.depth);
    out.push({ id: 'bolsa-ancho', label: 'bolsa ancho', kind: 'lineal', value: bw,
      a: [cx - bw / 2, cy, z0 + t], b: [cx + bw / 2, cy, z0 + t], why: bo.why });
    out.push({ id: 'bolsa-prof', label: 'bolsa prof', kind: 'espesor', value: bd, critical: true,
      a: [cx, cy, n(bo.params.z)], b: [cx, cy, n(bo.params.z) + bd], why: bo.why });
  }
  return out;
}

/**
 * COTAS DE UNA PIEZA construida (no de una placa) — "haz las funciones también que haya
 * cotas en las piezas que se construyan, que se puedan activar y desactivar" (user).
 * Lee la receta de la PIEZA (croquis → extruir → salida → radios → vaciar) y saca sus
 * cotas de diseño: las que un inyectador revisa antes de cotizar.
 */
export function partDims(c: Component): Dim3D[] {
  const out: Dim3D[] = [];
  const f = (id: string) => c.timeline.find((x) => x.id === id);
  const byType = (t: string) => c.timeline.find((x) => x.type === t && !x.suppressed);

  const sk = byType('sketch-rect'), ex = byType('extrude');
  if (!sk || !ex) return out;
  const cx = n(sk.params.cx), cy = n(sk.params.cy);
  const w = n(sk.params.w), h = n(sk.params.h), z0 = n(sk.params.z), t = n(ex.params.distance);
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;

  out.push({ id: 'ancho', label: 'boca largo', kind: 'lineal', value: w, critical: true,
    a: [x0, y1, z0 + t], b: [x1, y1, z0 + t], why: sk.why });
  out.push({ id: 'fondo', label: 'boca ancho', kind: 'lineal', value: h, critical: true,
    a: [x1, y0, z0 + t], b: [x1, y1, z0 + t], why: sk.why });
  out.push({ id: 'espesor', label: 'alto', kind: 'espesor', value: t, critical: true,
    a: [x0, y0, z0], b: [x0, y0, z0 + t], why: ex.why });

  const dr = byType('draft');
  if (dr) out.push({ id: 'salida', label: 'salida', kind: 'coordenada', value: n(dr.params.angleDeg),
    a: [x1, y0, z0], b: [x1, y0, z0 + t / 2], why: dr.why, critical: true });
  const fi = byType('fillet');
  if (fi) out.push({ id: 'radio', label: 'R esquina', kind: 'lineal', value: n(fi.params.r),
    a: [x0, y0, z0 + t], b: [x0 + n(fi.params.r), y0, z0 + t], why: fi.why });
  const sh = byType('shell');
  if (sh) out.push({ id: 'pared', label: 'pared', kind: 'lineal', value: n(sh.params.thickness, 2), critical: true,
    a: [cx, y0, z0 + t], b: [cx, y0 + n(sh.params.thickness, 2), z0 + t], why: sh.why });
  void f;
  return out;
}

export interface DimVerdict { dims: Dim3D[]; errors: Dim3D[]; okCount: number }

/**
 * CONTRASTA cada cota contra el SÓLIDO reconstruido. Aquí es donde una cota deja de
 * ser adorno: si la receta dice 56 y el sólido mide 48, el molde está mal y se ve.
 * `measure` viene de rebuild() — bbox y esquina mínima del sólido real.
 */
export function verifyDims(dims: Dim3D[], measure?: { bbox: [number, number, number]; min: [number, number, number] }, tolMm = 0.6): DimVerdict {
  if (!measure) return { dims, errors: [], okCount: 0 };
  const real: Record<string, number> = {
    ancho: measure.bbox[0], fondo: measure.bbox[1], espesor: measure.bbox[2], 'z-apilado': measure.min[2],
  };
  const dd = dims.map((d) => {
    const m = real[d.id];
    if (m == null) return d;                       // no toda cota se lee del bbox
    const ok = Math.abs(m - d.value) <= tolMm;
    return { ...d, measured: +m.toFixed(2), ok };
  });
  return { dims: dd, errors: dd.filter((d) => d.ok === false), okCount: dd.filter((d) => d.ok === true).length };
}

/** texto de la cota tal como se lee en pantalla — receta VS realidad, nunca solo una. */
export function dimText(d: Dim3D): string {
  const v = `${d.label} ${d.value}${d.kind === 'diametro' ? '' : ''}`;
  if (d.measured == null) return v;
  return d.ok ? `${v} = ${d.measured} OK` : `${v} vs ${d.measured} MAL`;
}
