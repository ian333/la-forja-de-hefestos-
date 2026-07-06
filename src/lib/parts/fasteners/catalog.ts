/**
 * ⚒️ La Forja — Catálogo Weston (tornillería)
 * ============================================
 * Genera el catálogo navegable/comprable desde las tablas DIN. Es el SEED
 * 100% derivado de norma (medidas reales) que ya da contenido a la página
 * antes de cargar el PDF de Weston. Cuando llegue el PDF se ENRIQUECE:
 * número de parte Weston real, líneas que sí manejan (pijas, anclas, etc.)
 * y precio. Mientras, cada entrada ya es una pieza exacta e insertable.
 *
 * SKU interno: WST-<cat>-<medida>[x<largo>]-<material>-<acabado>
 *   cat: TH=hex, TS=Allen(socket), TU=tuerca, RP=rondana plana, RG=grower
 */

import {
  THREAD, HEX_HEAD, SOCKET_CAP, HEX_NUT, FLAT_WASHER, SPRING_WASHER,
  availableLengths, hexCircumradius, SIZES,
  type MetricSize,
} from './din';
import type { FastenerType, FastenerGeoSpec } from './geometry';

// ── Materiales (densidad g/cm³) y acabados ───────────────────────────
export type MaterialKey = 'acero' | 'inox' | 'laton';
export interface Material { name: string; density: number; grade: string; }

export const MATERIALS: Record<MaterialKey, Material> = {
  acero: { name: 'Acero al carbono', density: 7.85, grade: 'Clase 8.8' },
  inox:  { name: 'Acero inoxidable',  density: 8.0,  grade: 'A2 / AISI 304' },
  laton: { name: 'Latón',             density: 8.5,  grade: 'CuZn37' },
};

export type FinishKey = 'zinc' | 'negro' | 'natural' | 'galv';
export const FINISHES: Record<FinishKey, string> = {
  zinc:    'Zincado',
  negro:   'Pavonado (óxido negro)',
  natural: 'Natural',
  galv:    'Galvanizado en caliente',
};

/** Acabados ofrecidos por material (lo que es comercialmente coherente). */
const FINISHES_BY_MATERIAL: Record<MaterialKey, FinishKey[]> = {
  acero: ['zinc', 'negro'],
  inox:  ['natural'],
  laton: ['natural'],
};

// ── Categorías (taxonomía estilo McMaster) ───────────────────────────
export interface FastenerCategory {
  type: FastenerType;
  code: string;        // segmento de SKU
  name: string;        // nombre de la familia (es-MX)
  standard: string;    // norma
  icon: string;        // glifo de un carácter (estilo del proyecto)
  hasLength: boolean;
}

export const CATEGORIES: FastenerCategory[] = [
  { type: 'hex-bolt',      code: 'TH', name: 'Tornillo cabeza hexagonal', standard: 'DIN 933 / ISO 4017', icon: '⬡', hasLength: true },
  { type: 'socket-cap',    code: 'TS', name: 'Tornillo Allen (socket cap)', standard: 'DIN 912 / ISO 4762', icon: '⬢', hasLength: true },
  { type: 'hex-nut',       code: 'TU', name: 'Tuerca hexagonal',          standard: 'DIN 934 / ISO 4032', icon: '◇', hasLength: false },
  { type: 'flat-washer',   code: 'RP', name: 'Rondana plana',             standard: 'DIN 125-A / ISO 7089', icon: '◎', hasLength: false },
  { type: 'spring-washer', code: 'RG', name: 'Rondana de presión',        standard: 'DIN 127-B',          icon: '◠', hasLength: false },
];

const CATEGORY_BY_TYPE: Record<FastenerType, FastenerCategory> =
  Object.fromEntries(CATEGORIES.map((c) => [c.type, c])) as Record<FastenerType, FastenerCategory>;

// ── Entrada de catálogo ──────────────────────────────────────────────
export interface FastenerSpec extends FastenerGeoSpec {
  material: MaterialKey;
  finish: FinishKey;
}

export interface CatalogEntry {
  sku: string;
  type: FastenerType;
  category: string;       // nombre de familia
  standard: string;
  name: string;           // descripción comercial completa
  size: MetricSize;
  length?: number;
  material: MaterialKey;
  finish: FinishKey;
  spec: FastenerSpec;
  /** Cotas clave de la pieza (mm) para la ficha técnica. */
  dims: Record<string, number>;
  /** Masa estimada de una pieza (g) — analítica, etiquetada como estimación. */
  massGrams: number;
}

// ── Volumen analítico (mm³) por tipo, para masa de cotización ─────────
function hexPrismVolume(acrossFlats: number, h: number): number {
  // Hexágono regular: A = (3√3/2)·R² con R = circunradio = s/√3 ⇒ A = (√3/2)·s²
  const R = hexCircumradius(acrossFlats);
  const area = (3 * Math.sqrt(3) / 2) * R * R;
  return area * h;
}
const cyl = (d: number, h: number) => Math.PI * (d / 2) ** 2 * h;

/** Volumen aproximado de la pieza (mm³). Estimación para peso/cotización. */
export function approxVolume(spec: FastenerGeoSpec): number {
  switch (spec.type) {
    case 'hex-bolt': {
      const { d } = THREAD[spec.size]; const { s, k } = HEX_HEAD[spec.size];
      return hexPrismVolume(s, k) + cyl(d, spec.length!);
    }
    case 'socket-cap': {
      const { d } = THREAD[spec.size]; const { dk, k } = SOCKET_CAP[spec.size];
      return cyl(dk, k) + cyl(d, spec.length!); // ignora hueco Allen (estimación)
    }
    case 'hex-nut': {
      const { d } = THREAD[spec.size]; const { s, m } = HEX_NUT[spec.size];
      return hexPrismVolume(s, m) - cyl(d, m);
    }
    case 'flat-washer': {
      const { d1, d2, h } = FLAT_WASHER[spec.size];
      return cyl(d2, h) - cyl(d1, h);
    }
    case 'spring-washer': {
      const w = SPRING_WASHER[spec.size];
      if (!w) return 0;
      return cyl(w.d2, w.s) - cyl(w.d1, w.s);
    }
  }
}

export function approxMassGrams(spec: FastenerSpec): number {
  const vol = approxVolume(spec);            // mm³
  const rho = MATERIALS[spec.material].density; // g/cm³
  return (vol / 1000) * rho;                 // mm³→cm³ = /1000
}

function dimsFor(type: FastenerType, size: MetricSize, length?: number): Record<string, number> {
  const { d, pitch } = THREAD[size];
  switch (type) {
    case 'hex-bolt':   return { d, pitch, ...HEX_HEAD[size], L: length ?? 0 };
    case 'socket-cap': return { d, pitch, ...SOCKET_CAP[size], L: length ?? 0 };
    case 'hex-nut':    return { d, pitch, ...HEX_NUT[size] };
    case 'flat-washer': return { ...FLAT_WASHER[size] };
    case 'spring-washer': return { ...(SPRING_WASHER[size] ?? {}) };
  }
}

function skuOf(cat: FastenerCategory, size: MetricSize, material: MaterialKey, finish: FinishKey, length?: number): string {
  const mat = material === 'acero' ? 'AC' : material === 'inox' ? 'IN' : 'LA';
  const fin = finish === 'zinc' ? 'ZN' : finish === 'negro' ? 'NG' : finish === 'galv' ? 'GV' : 'NT';
  const dim = length ? `${size}X${length}` : size;
  return `WST-${cat.code}-${dim}-${mat}-${fin}`;
}

function nameOf(cat: FastenerCategory, size: MetricSize, material: MaterialKey, finish: FinishKey, length?: number): string {
  const dim = length ? `${size} × ${length}` : size;
  return `${cat.name} ${dim} · ${MATERIALS[material].name} · ${FINISHES[finish]}`;
}

/** Medidas disponibles por tipo (las que tienen datos DIN). */
function sizesFor(type: FastenerType): MetricSize[] {
  if (type === 'spring-washer') return SIZES.filter((s) => SPRING_WASHER[s] != null);
  return SIZES;
}

/**
 * Construye el catálogo Weston completo (seed desde norma).
 * Materiales por defecto: acero (zinc/negro) + inoxidable (natural).
 */
export function buildWestonCatalog(materials: MaterialKey[] = ['acero', 'inox']): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const cat of CATEGORIES) {
    for (const size of sizesFor(cat.type)) {
      const lengths = cat.hasLength ? availableLengths(size) : [undefined];
      for (const length of lengths) {
        for (const material of materials) {
          for (const finish of FINISHES_BY_MATERIAL[material]) {
            const spec: FastenerSpec = { type: cat.type, size, length, material, finish };
            out.push({
              sku: skuOf(cat, size, material, finish, length),
              type: cat.type,
              category: cat.name,
              standard: cat.standard,
              name: nameOf(cat, size, material, finish, length),
              size, length, material, finish, spec,
              dims: dimsFor(cat.type, size, length),
              massGrams: Math.round(approxMassGrams(spec) * 100) / 100,
            });
          }
        }
      }
    }
  }
  return out;
}

/** Resumen para el encabezado del catálogo. */
export function catalogStats(entries: CatalogEntry[]) {
  const byCat = new Map<string, number>();
  for (const e of entries) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
  return { total: entries.length, byCategory: Object.fromEntries(byCat) };
}

export { CATEGORY_BY_TYPE };
