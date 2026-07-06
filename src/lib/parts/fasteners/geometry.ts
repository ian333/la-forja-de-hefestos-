/**
 * ⚒️ La Forja — Tornillería: generadores de geometría (F-Rep / SdfModule)
 * =======================================================================
 * Cada función toma una medida de norma y devuelve un SdfModule listo para
 * renderizar en ForgePage (ray-march) e insertar como pieza del catálogo,
 * exactamente como `spacer-905.ts`. Eje de la pieza = Y (convención SDF:
 * cilindro y extrusión van centrados en su posición).
 *
 *   buildFastener(spec) → SdfModule
 *
 * NOTA — rosca: el vástago se modela LISO (convención "toolbox": las roscas
 * reales son cosméticas en librerías de inserción y se omiten para no inflar
 * el ray-march). El Ø nominal y todas las cotas de cabeza/llave/tuerca SÍ son
 * exactos de norma, que es lo que importa para construir/encajar. El sólido
 * B-Rep exacto con barreno roscado vive en el camino OpenCASCADE (occt.ts),
 * para el insert en ForgeBRepStudio y el export STEP.
 */

import {
  makeCylinder,
  makeOp,
  makeModule,
  makePolygonExtrusion,
  type SdfModule,
  type SdfOperation,
} from '../../sdf-engine';
import {
  THREAD,
  HEX_HEAD,
  SOCKET_CAP,
  HEX_NUT,
  FLAT_WASHER,
  SPRING_WASHER,
  hexagonVerts,
  type MetricSize,
} from './din';

/** Solape (mm) para evitar caras coplanares en las restas booleanas. */
const EPS = 0.05;

/** Rotación que alinea la extrusión (eje Z local) con el eje Y del mundo. */
const AXIS_Y: [number, number, number] = [Math.PI / 2, 0, 0];

// ── Tornillo cabeza hexagonal — DIN 933 ──────────────────────────────
// Cara de apoyo de la cabeza en Y=0. Vástago hacia +Y, cabeza hacia −Y.
export function buildHexBolt(size: MetricSize, length: number): SdfModule {
  const { d } = THREAD[size];
  const { s, k } = HEX_HEAD[size];

  const shaft = makeCylinder([0, length / 2, 0], d / 2, length);
  shaft.label = `Vástago Ø${d}`;

  const head = makePolygonExtrusion(
    hexagonVerts(s), k, [0, -k / 2, 0], AXIS_Y, `Cabeza hex s${s}`,
  );

  const body = makeOp('union', [head, shaft]);
  body.label = `Tornillo hex ${size}×${length}`;

  const mod = makeModule(`Tornillo hex ${size}×${length}`, '#c9a84c');
  mod.children = [body];
  return mod;
}

// ── Tornillo Allen / socket cap — DIN 912 ────────────────────────────
// Cabeza cilíndrica con hueco hexagonal (llave Allen) restado en la cara
// superior. Cara de apoyo en Y=0, vástago +Y, cabeza −Y.
export function buildSocketCap(size: MetricSize, length: number): SdfModule {
  const { d } = THREAD[size];
  const { dk, k, sw } = SOCKET_CAP[size];

  const shaft = makeCylinder([0, length / 2, 0], d / 2, length);
  shaft.label = `Vástago Ø${d}`;

  const headSolid = makeCylinder([0, -k / 2, 0], dk / 2, k);
  headSolid.label = `Cabeza Ø${dk}`;

  // Hueco Allen: profundidad ~60% de la altura de cabeza, desde la cara
  // superior (Y=−k) hacia +Y. Se sobre-extiende EPS por arriba.
  const depth = k * 0.6;
  const socket = makePolygonExtrusion(
    hexagonVerts(sw), depth + EPS,
    [0, -k + depth / 2 - EPS / 2, 0], AXIS_Y, `Allen s${sw}`,
  );

  const head = makeOp('subtract', [headSolid, socket]);
  head.label = 'Cabeza − Allen';

  const body = makeOp('union', [head, shaft]);
  body.label = `Tornillo Allen ${size}×${length}`;

  const mod = makeModule(`Tornillo Allen ${size}×${length}`, '#c9a84c');
  mod.children = [body];
  return mod;
}

// ── Tuerca hexagonal — DIN 934 ───────────────────────────────────────
// Prisma hexagonal centrado en Y=0 menos el barreno cilíndrico nominal.
export function buildHexNut(size: MetricSize): SdfModule {
  const { d } = THREAD[size];
  const { s, m } = HEX_NUT[size];

  const prism = makePolygonExtrusion(
    hexagonVerts(s), m, [0, 0, 0], AXIS_Y, `Cuerpo hex s${s}`,
  );
  const hole = makeCylinder([0, 0, 0], d / 2, m + 2 * EPS);
  hole.label = `Barreno Ø${d}`;

  const body = makeOp('subtract', [prism, hole]);
  body.label = `Tuerca hex ${size}`;

  const mod = makeModule(`Tuerca hex ${size}`, '#9fb3c8');
  mod.children = [body];
  return mod;
}

// ── Rondana plana — DIN 125-A ────────────────────────────────────────
function buildAnnulus(
  d1: number, d2: number, h: number, label: string, color: string,
): SdfModule {
  const disc = makeCylinder([0, 0, 0], d2 / 2, h);
  disc.label = `Exterior Ø${d2}`;
  const hole = makeCylinder([0, 0, 0], d1 / 2, h + 2 * EPS);
  hole.label = `Barreno Ø${d1}`;

  const body = makeOp('subtract', [disc, hole]);
  body.label = label;

  const mod = makeModule(label, color);
  mod.children = [body];
  return mod;
}

export function buildFlatWasher(size: MetricSize): SdfModule {
  const { d1, d2, h } = FLAT_WASHER[size];
  return buildAnnulus(d1, d2, h, `Rondana plana ${size}`, '#aeb8c6');
}

// ── Rondana de presión (grower) — DIN 127-B ──────────────────────────
// Geometría simplificada a anillo plano (el split helicoidal queda pendiente
// para el camino B-Rep). Dimensiones reales de norma.
export function buildSpringWasher(size: MetricSize): SdfModule {
  const w = SPRING_WASHER[size];
  if (!w) throw new Error(`Sin datos DIN 127 para ${size} (disponible M3..M16)`);
  return buildAnnulus(w.d1, w.d2, w.s, `Rondana presión ${size}`, '#caa23a');
}

// ── Dispatch genérico ────────────────────────────────────────────────
export type FastenerType =
  | 'hex-bolt' | 'socket-cap' | 'hex-nut' | 'flat-washer' | 'spring-washer';

export interface FastenerGeoSpec {
  type: FastenerType;
  size: MetricSize;
  /** Largo (mm) — requerido para tornillos. */
  length?: number;
}

export function buildFastener(spec: FastenerGeoSpec): SdfModule {
  switch (spec.type) {
    case 'hex-bolt':
      return buildHexBolt(spec.size, requireLength(spec));
    case 'socket-cap':
      return buildSocketCap(spec.size, requireLength(spec));
    case 'hex-nut':
      return buildHexNut(spec.size);
    case 'flat-washer':
      return buildFlatWasher(spec.size);
    case 'spring-washer':
      return buildSpringWasher(spec.size);
    default: {
      const _exhaustive: never = spec.type;
      throw new Error(`Tipo de sujetador desconocido: ${_exhaustive}`);
    }
  }
}

/** Escena raíz (union del módulo) para incrustar directo en ForgePage. */
export function buildFastenerScene(spec: FastenerGeoSpec): SdfOperation {
  const root = makeOp('union', [buildFastener(spec)]);
  root.label = 'Escena';
  return root;
}

function requireLength(spec: FastenerGeoSpec): number {
  if (spec.length == null || spec.length <= 0) {
    throw new Error(`${spec.type} ${spec.size} requiere un largo > 0`);
  }
  return spec.length;
}
