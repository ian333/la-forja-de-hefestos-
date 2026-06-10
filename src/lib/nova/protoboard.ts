/**
 * protoboard.ts — el modelo eléctrico REAL de una protoboard 830.
 *
 * La protoboard no es decoración: es un conjunto de NETS físicas.
 *   - Zona central: 63 columnas × 2 mitades (filas a-e arriba, f-j abajo).
 *     Cada columna×mitad = 5 hoyitos UNIDOS por una lámina de metal = 1 net.
 *     El canal del centro separa las mitades (ahí cabalgan los DIPs).
 *   - 4 rieles de poder (arriba +/−, abajo +/−): cada riel corrido = 1 net.
 *
 * Este módulo convierte (piezas colocadas + jumpers) → netlist → Circuit del
 * motor MNA (spice.ts). Es PURO y testeable: la UI solo dibuja encima.
 *
 * Convención de tierra: la net del pin NEGATIVO de la primera fuente es el
 * nodo 0 (igual que cuando clavas el caimán negro de tu multímetro).
 */

import type { Circuit, Element } from '../circuitos/spice';
import { skuById, type Sku, type SpiceModel } from './catalogo';

// ── Geometría lógica de la 830 ───────────────────────────────────────────

export const COLS = 63;          // columnas de la zona central
export const ROWS_HALF = 5;      // filas por mitad (a-e / f-j)

/** Un hoyito direccionable. */
export type Hole =
  | { kind: 'main'; col: number; row: number }   // row 0-4 = a-e (mitad sup), 5-9 = f-j (inf)
  | { kind: 'rail'; rail: 0 | 1 | 2 | 3; col: number }; // 0=+sup 1=−sup 2=+inf 3=−inf

/** Llave canónica de la NET a la que pertenece un hoyito (la física de la lámina). */
export function netKey(h: Hole): string {
  if (h.kind === 'rail') return `rail${h.rail}`;
  const half = h.row < ROWS_HALF ? 'A' : 'B';
  return `c${h.col}${half}`;
}

export function holeKey(h: Hole): string {
  return h.kind === 'rail' ? `r${h.rail}:${h.col}` : `m${h.col}:${h.row}`;
}

// ── Piezas colocadas ─────────────────────────────────────────────────────

export interface Placement {
  id: string;            // instancia única ("r1", "led2"…)
  skuId: string;         // referencia al catálogo (producto = modelo)
  pins: Hole[];          // hoyito de cada pin, en el orden del modelo
  /** Estado interactivo de la pieza (lo mueve la UI, lo lee el netlist). */
  state?: {
    pressed?: boolean;   // push button
    frac?: number;       // potenciómetro 0..1 (posición de la perilla)
    luz?: number;        // LDR 0..1 (0=oscuro, 1=pleno sol)
    tempC?: number;      // NTC
  };
}

export interface Jumper {
  id: string;
  a: Hole;
  b: Hole;
}

// ── Union-find para fusionar nets por jumpers ────────────────────────────

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let r = this.parent.get(x) ?? x;
    if (r !== x) { r = this.find(r); this.parent.set(x, r); }
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

// ── Resultado ────────────────────────────────────────────────────────────

export interface Netlist {
  circuit: Circuit;
  /** netKey canónica (post-jumpers) → número de nodo MNA (0 = tierra). */
  nodeOf: Map<string, number>;
  /** Nodo MNA de cada pin de cada pieza: nodePin.get(placementId)[pinIdx]. */
  nodePin: Map<string, number[]>;
  warnings: string[];
}

/** R del NTC a temperatura T (modelo beta estándar). */
export function ntcR(r25: number, beta: number, tempC: number): number {
  const T = tempC + 273.15, T0 = 298.15;
  return r25 * Math.exp(beta * (1 / T - 1 / T0));
}

/** R de la LDR según luz 0..1 (interpolación log — así responde el CdS real). */
export function ldrR(rDark: number, rLight: number, luz: number): number {
  const x = Math.min(1, Math.max(0, luz));
  return Math.exp(Math.log(rDark) * (1 - x) + Math.log(rLight) * x);
}

/**
 * Construye el Circuit MNA desde la protoboard.
 * Las piezas sin modelo (`spice: null`) generan warning y se omiten.
 */
export function buildNetlist(placements: Placement[], jumpers: Jumper[]): Netlist {
  const warnings: string[] = [];
  const uf = new UnionFind();

  // 1) jumpers fusionan nets
  for (const j of jumpers) uf.union(netKey(j.a), netKey(j.b));

  // 2) juntar todas las nets tocadas por pines
  const touched = new Set<string>();
  for (const p of placements) for (const pin of p.pins) touched.add(uf.find(netKey(pin)));
  for (const j of jumpers) { touched.add(uf.find(netKey(j.a))); touched.add(uf.find(netKey(j.b))); }

  // 3) tierra = net del pin negativo (pin 1) de la primera fuente colocada
  let groundNet: string | null = null;
  for (const p of placements) {
    const sku = skuById(p.skuId);
    if (sku?.spice?.kind === 'V' && p.pins.length >= 2) {
      groundNet = uf.find(netKey(p.pins[1]));
      break;
    }
  }
  if (!groundNet) {
    warnings.push('Sin fuente: coloca una batería o eliminador para energizar el circuito.');
    groundNet = [...touched][0] ?? 'none';
  }

  // 4) numerar nodos
  const nodeOf = new Map<string, number>();
  nodeOf.set(groundNet, 0);
  let next = 1;
  for (const net of [...touched].sort()) {
    if (!nodeOf.has(net)) nodeOf.set(net, next++);
  }
  const nodeOfHole = (h: Hole) => nodeOf.get(uf.find(netKey(h)))!;

  // 5) elementos
  const elements: Element[] = [];
  const nodePin = new Map<string, number[]>();
  let internal = next; // nodos internos extra (motor R+L, pot)

  for (const p of placements) {
    const sku = skuById(p.skuId);
    if (!sku) { warnings.push(`SKU desconocido: ${p.skuId}`); continue; }
    const pins = p.pins.map(nodeOfHole);
    nodePin.set(p.id, pins);
    const el = elementsFor(p, sku, sku.spice, pins, () => internal++);
    if (el === 'sin-modelo') warnings.push(`${sku.nombre}: aún no se simula (sí se puede comprar).`);
    else elements.push(...el);
  }

  // 6) PODA: nets tocadas solo por piezas sin modelo (ej. el 555) quedarían
  //    como filas vacías en la matriz MNA → singular. Renumeramos compacto
  //    usando solo los nodos que algún elemento referencia de verdad.
  const used = new Set<number>([0]);
  for (const e of elements) {
    if (e.kind === 'M') { used.add(e.d); used.add(e.g); used.add(e.s); }
    else { used.add(e.a); used.add(e.b); }
  }
  const remap = new Map<number, number>([[0, 0]]);
  let compact = 1;
  for (const n of [...used].sort((x, y) => x - y)) {
    if (n !== 0) remap.set(n, compact++);
  }
  const rm = (n: number) => remap.get(n) ?? -1;
  for (const e of elements) {
    if (e.kind === 'M') { e.d = rm(e.d); e.g = rm(e.g); e.s = rm(e.s); }
    else { e.a = rm(e.a); e.b = rm(e.b); }
  }
  for (const [id, pins] of nodePin) nodePin.set(id, pins.map(rm));
  for (const [net, n] of nodeOf) nodeOf.set(net, rm(n));

  const circuit: Circuit = { nodeCount: compact - 1, elements };
  return { circuit, nodeOf, nodePin, warnings };
}

/** Mapea un SKU+estado a elementos MNA. Puede pedir nodos internos. */
function elementsFor(
  p: Placement,
  sku: Sku,
  model: SpiceModel,
  pins: number[],
  newNode: () => number,
): Element[] | 'sin-modelo' {
  if (!model) return 'sin-modelo';
  const [n0, n1, n2] = pins;
  switch (model.kind) {
    case 'R':
      return [{ kind: 'R', id: p.id, a: n0, b: n1, value: model.ohms }];
    case 'C':
      return [{ kind: 'C', id: p.id, a: n0, b: n1, value: model.farads }];
    case 'L':
      return [{ kind: 'L', id: p.id, a: n0, b: n1, value: model.henries }];
    case 'D':
      // pin 0 = ánodo, pin 1 = cátodo. (El V_f del LED emerge de Is/n del gap.)
      return [{ kind: 'D', id: p.id, a: n0, b: n1, Is: model.Is, n: model.n }];
    case 'V':
      // pin 0 = +, pin 1 = −
      return [{ kind: 'V', id: p.id, a: n0, b: n1, value: model.volts }];
    case 'M':
      // pins: [drain, gate, source]
      return [{ kind: 'M', id: p.id, d: n0, g: n1, s: n2, params: model.params }];
    case 'SW': {
      // abierto = 10 MΩ, cerrado = 50 mΩ (lo que mide un botón real)
      const r = p.state?.pressed ? 0.05 : 1e7;
      return [{ kind: 'R', id: p.id, a: n0, b: n1, value: r }];
    }
    case 'POT': {
      // pins: [extremo A, cursor, extremo B] — dos R que suman el total
      const f = Math.min(0.99, Math.max(0.01, p.state?.frac ?? 0.5));
      return [
        { kind: 'R', id: `${p.id}.a`, a: n0, b: n1, value: model.ohms * f },
        { kind: 'R', id: `${p.id}.b`, a: n1, b: n2, value: model.ohms * (1 - f) },
      ];
    }
    case 'LDR':
      return [{ kind: 'R', id: p.id, a: n0, b: n1, value: ldrR(model.rDark, model.rLight, p.state?.luz ?? 0.5) }];
    case 'NTC':
      return [{ kind: 'R', id: p.id, a: n0, b: n1, value: ntcR(model.r25, model.beta, p.state?.tempC ?? 25) }];
    case 'MOTOR': {
      // R en serie con L → necesita un nodo interno
      const mid = newNode();
      return [
        { kind: 'R', id: `${p.id}.r`, a: n0, b: mid, value: model.r },
        { kind: 'L', id: `${p.id}.l`, a: mid, b: n1, value: model.l },
      ];
    }
    case 'NPN':
      // Ebers-Moll va en el motor (roadmap); por ahora aviso honesto.
      return 'sin-modelo';
  }
}
