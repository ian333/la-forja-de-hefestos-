/**
 * catalogo.ts — el catálogo NOVA: cada SKU es PRODUCTO y MODELO a la vez.
 *
 * La tesis de la tienda: "generar ingresos de manera justa enseñando cómo se
 * usa lo que vendemos". Cada pieza que vendemos se puede armar y simular
 * GRATIS en el banco de trabajo ANTES de comprarla. El catálogo es la paleta
 * del simulador Y el listado de la tienda — un solo origen de verdad.
 *
 * Anti-DigiKey: ~40 SKUs curados, los CLÁSICOS ÚTILES, no 100 mil que estorban.
 *
 * `entrega`: 'local' = stock MX 24-48h · 'lote' = pre-orden por lote 2-3 sem.
 * `spice`: cómo se mapea al motor MNA (spice.ts). Los que aún no se simulan
 * (buzzer, 555) llevan `spice: null` y un porqué en `nota`.
 *
 * Precios en MXN, de arranque (se afinan con el primer lote real).
 */

import type { MosfetParams } from '../circuitos/spice';
import { MOSFETS } from '../circuitos/spice';

export type Entrega = 'local' | 'lote';

export type SpiceModel =
  | { kind: 'R'; ohms: number }
  | { kind: 'C'; farads: number }
  | { kind: 'L'; henries: number }
  | { kind: 'D'; Is?: number; n?: number; /** para LEDs: gap en eV (color + V_f) */ egEv?: number }
  | { kind: 'NPN'; beta: number; name: string }
  | { kind: 'M'; params: MosfetParams }
  | { kind: 'V'; volts: number }           // baterías / fuentes
  | { kind: 'SW' }                          // interruptor / push button (R conmutada)
  | { kind: 'POT'; ohms: number }           // potenciómetro (2 R dependientes)
  | { kind: 'LDR'; rDark: number; rLight: number }
  | { kind: 'NTC'; r25: number; beta: number }
  | { kind: 'MOTOR'; r: number; l: number } // DC chico: R+L (sin back-EMF v1)
  | null;

export interface Sku {
  id: string;
  nombre: string;
  /** Categoría para la paleta/tienda. */
  cat: 'pasivos' | 'semiconductores' | 'optoelectrónica' | 'electromecánica' | 'energía' | 'sensores' | 'base';
  precio: number;            // MXN por unidad
  entrega: Entrega;
  spice: SpiceModel;
  /** Una línea: para qué SIRVE (no jerga de datasheet). */
  util: string;
  nota?: string;
}

// ── Pasivos ──────────────────────────────────────────────────────────────

/** Serie E12 de resistencias que vendemos (¼W 5%). Un SKU por valor. */
export const R_VALORES = [100, 220, 330, 470, 1000, 2200, 4700, 10000, 47000, 100000] as const;

const resistores: Sku[] = R_VALORES.map((ohms) => ({
  id: `r-${ohms}`,
  nombre: `Resistencia ${fmtOhms(ohms)} ¼W`,
  cat: 'pasivos',
  precio: 1.5,
  entrega: 'local',
  spice: { kind: 'R', ohms },
  util: ohms === 220 || ohms === 330 ? 'La de los LEDs: limita la corriente para que no se quemen.'
      : ohms === 10000 ? 'La todoterreno: pull-ups, divisores, polarización.'
      : 'Divide voltajes, limita corrientes, polariza transistores.',
}));

const capacitores: Sku[] = [
  { id: 'c-100n', nombre: 'Cerámico 100 nF', cat: 'pasivos', precio: 2, entrega: 'local',
    spice: { kind: 'C', farads: 100e-9 }, util: 'El desacople universal: uno junto a cada chip, siempre.' },
  { id: 'c-10u', nombre: 'Electrolítico 10 µF 25V', cat: 'pasivos', precio: 3, entrega: 'local',
    spice: { kind: 'C', farads: 10e-6 }, util: 'Filtra y suaviza fuentes chicas; temporiza con el 555.' },
  { id: 'c-100u', nombre: 'Electrolítico 100 µF 25V', cat: 'pasivos', precio: 4, entrega: 'local',
    spice: { kind: 'C', farads: 100e-6 }, util: 'Aplana el rizo de un rectificador; respaldo de energía breve.' },
  { id: 'c-1000u', nombre: 'Electrolítico 1000 µF 25V', cat: 'pasivos', precio: 8, entrega: 'local',
    spice: { kind: 'C', farads: 1000e-6 }, util: 'El tanque: fuentes caseras y picos de arranque de motores.' },
  { id: 'l-100u', nombre: 'Inductor 100 µH', cat: 'pasivos', precio: 6, entrega: 'lote',
    spice: { kind: 'L', henries: 100e-6 }, util: 'El corazón de un buck/boost: guarda energía en su campo.' },
];

// ── Semiconductores ──────────────────────────────────────────────────────

const semis: Sku[] = [
  { id: 'd-1n4148', nombre: 'Diodo 1N4148', cat: 'semiconductores', precio: 1.5, entrega: 'local',
    spice: { kind: 'D', Is: 2.5e-9, n: 1.84 }, util: 'Señal rápida: protege entradas, endereza señales chicas.' },
  { id: 'd-1n4007', nombre: 'Diodo 1N4007', cat: 'semiconductores', precio: 2, entrega: 'local',
    spice: { kind: 'D', Is: 7.0e-9, n: 1.8 }, util: 'El rectificador clásico: de AC a DC, protege contra polaridad invertida.' },
  { id: 'q-2n2222', nombre: 'Transistor 2N2222 (NPN)', cat: 'semiconductores', precio: 3, entrega: 'local',
    spice: { kind: 'NPN', beta: 150, name: '2N2222' }, util: 'Con 5 mA de tu micro enciendes 500 mA de relevador o LEDs.' },
  { id: 'q-2n3904', nombre: 'Transistor 2N3904 (NPN)', cat: 'semiconductores', precio: 2.5, entrega: 'local',
    spice: { kind: 'NPN', beta: 200, name: '2N3904' }, util: 'El NPN de señal de todos los tutoriales del mundo.' },
  { id: 'q-irl540n', nombre: 'MOSFET IRL540N (logic level)', cat: 'semiconductores', precio: 18, entrega: 'lote',
    spice: { kind: 'M', params: MOSFETS.IRL540N }, util: 'Maneja 10+ A directo desde un pin de 3.3/5 V: motores, tiras LED.' },
  { id: 'q-2n7000', nombre: 'MOSFET 2N7000', cat: 'semiconductores', precio: 4, entrega: 'lote',
    spice: { kind: 'M', params: MOSFETS['2N7000'] }, util: 'MOSFET chico de señal: conmuta sin pedirle corriente al micro.' },
  { id: 'ic-555', nombre: 'Timer NE555', cat: 'semiconductores', precio: 6, entrega: 'local',
    spice: null, nota: 'Modelo de comportamiento en el roadmap del simulador.',
    util: 'El chip más vendido de la historia: parpadea, temporiza, genera tonos.' },
  { id: 'ic-7805', nombre: 'Regulador 7805 (5V 1A)', cat: 'semiconductores', precio: 8, entrega: 'local',
    spice: null, nota: 'Se simula como fuente de 5 V por ahora.',
    util: 'De tu eliminador de 9-12 V a 5 V estables para tus circuitos.' },
];

// ── Optoelectrónica (el color sale del band gap — ver microscopio) ──────

const LED_DEFS = [
  { color: 'rojo', eg: 1.9, precio: 2 },
  { color: 'amarillo', eg: 2.1, precio: 2 },
  { color: 'verde', eg: 2.4, precio: 2 },
  { color: 'azul', eg: 2.7, precio: 2.5 },
  { color: 'blanco', eg: 2.75, precio: 2.5 },
] as const;

const leds: Sku[] = LED_DEFS.map((l) => ({
  id: `led-${l.color}`,
  nombre: `LED 5mm ${l.color}`,
  cat: 'optoelectrónica',
  precio: l.precio,
  entrega: 'local',
  // n ≈ Eg[eV]: así V_f = n·VT·ln(I/Is) ≈ el gap a 20 mA — el color y el
  // voltaje de encendido salen del MISMO número (ver microscopio).
  spice: { kind: 'D', Is: 1e-18, n: l.eg, egEv: l.eg },
  util: l.color === 'azul'
    ? 'El del Nobel 2014: sin gap grande no hay azul, sin azul no hay blanco.'
    : `Indicador ${l.color}: prende con ~${l.eg.toFixed(1)} V y 10-20 mA.`,
}));

// ── Sensores (los que hacen circuitos ÚTILES) ────────────────────────────

const sensores: Sku[] = [
  { id: 's-ldr', nombre: 'Fotorresistencia (LDR)', cat: 'sensores', precio: 5, entrega: 'local',
    spice: { kind: 'LDR', rDark: 200000, rLight: 1000 },
    util: 'Tu circuito VE: 200 kΩ a oscuras, 1 kΩ con luz. Luz nocturna automática.' },
  { id: 's-ntc', nombre: 'Termistor NTC 10k', cat: 'sensores', precio: 6, entrega: 'local',
    spice: { kind: 'NTC', r25: 10000, beta: 3950 },
    util: 'Tu circuito SIENTE temperatura: termostatos, protección térmica.' },
];

// ── Electromecánica ──────────────────────────────────────────────────────

const electro: Sku[] = [
  { id: 'e-push', nombre: 'Push button 6mm', cat: 'electromecánica', precio: 2, entrega: 'local',
    spice: { kind: 'SW' }, util: 'El botón. Aprende debounce y control con el dedo.' },
  { id: 'e-pot10k', nombre: 'Potenciómetro 10k', cat: 'electromecánica', precio: 8, entrega: 'local',
    spice: { kind: 'POT', ohms: 10000 }, util: 'La perilla: divide voltaje a mano — volumen, brillo, velocidad.' },
  { id: 'e-buzzer', nombre: 'Buzzer pasivo', cat: 'electromecánica', precio: 7, entrega: 'local',
    spice: null, nota: 'Suena con PWM; en el sim se modela como R de 16 Ω por ahora.',
    util: 'Alarmas y melodías: el feedback más barato que existe.' },
  { id: 'e-motor', nombre: 'Motor DC 3-6V (hobby)', cat: 'electromecánica', precio: 15, entrega: 'local',
    spice: { kind: 'MOTOR', r: 3, l: 1e-3 }, util: 'Tu primer actuador: ventilador, carrito, bomba chica.' },
  { id: 'e-rele', nombre: 'Relevador 5V 10A', cat: 'electromecánica', precio: 14, entrega: 'lote',
    spice: null, nota: 'Bobina = R 70Ω + L; el contacto conmuta cargas de 127 V (¡con respeto!).',
    util: 'Controla aparatos de 127 V desde tu circuito de 5 V.' },
];

// ── Energía ──────────────────────────────────────────────────────────────

const energia: Sku[] = [
  { id: 'p-9v', nombre: 'Portapilas 9V + clip', cat: 'energía', precio: 10, entrega: 'local',
    spice: { kind: 'V', volts: 9 }, util: 'La fuente portátil clásica para empezar.' },
  { id: 'p-4aa', nombre: 'Portapilas 4×AA (6V)', cat: 'energía', precio: 12, entrega: 'local',
    spice: { kind: 'V', volts: 6 }, util: 'Más corriente y más horas que la 9V; ideal para motores.' },
  { id: 'p-fuente5v', nombre: 'Eliminador 5V 2A (USB)', cat: 'energía', precio: 45, entrega: 'local',
    spice: { kind: 'V', volts: 5 }, util: 'Alimentación seria de banco: estable y barata.' },
];

// ── Base (lo que hace posible armar) ─────────────────────────────────────

const base: Sku[] = [
  { id: 'b-proto830', nombre: 'Protoboard 830 puntos', cat: 'base', precio: 55, entrega: 'local',
    spice: null, util: 'Tu mesa de trabajo: arma y desarma sin soldar.' },
  { id: 'b-jumpers', nombre: 'Jumpers M-M ×40', cat: 'base', precio: 30, entrega: 'local',
    spice: null, util: 'Los cables del prototipo. Nunca son suficientes.' },
  { id: 'b-caiman', nombre: 'Caimanes ×10', cat: 'base', precio: 25, entrega: 'local',
    spice: null, util: 'Conecta lo que no cabe en la protoboard (motores, pilas, multímetro).' },
];

// ── Catálogo completo ────────────────────────────────────────────────────

export const CATALOGO: Sku[] = [
  ...resistores, ...capacitores, ...semis, ...leds, ...sensores, ...electro, ...energia, ...base,
];

export function skuById(id: string): Sku | undefined {
  return CATALOGO.find((s) => s.id === id);
}

export function fmtOhms(ohms: number): string {
  if (ohms >= 1e6) return `${ohms / 1e6} MΩ`;
  if (ohms >= 1e3) return `${ohms / 1e3} kΩ`;
  return `${ohms} Ω`;
}

export function fmtPrecio(mxn: number): string {
  return `$${mxn % 1 === 0 ? mxn : mxn.toFixed(2)} MXN`;
}

// ── Recetas: circuitos ÚTILES, los clásicos que ayudan ───────────────────

export interface RecetaItem { skuId: string; qty: number }

export interface Receta {
  id: string;
  nombre: string;
  problema: string;        // qué resuelve EN LA VIDA (no jerga)
  items: RecetaItem[];
  dificultad: 1 | 2 | 3;
}

export const RECETAS: Receta[] = [
  {
    id: 'luz-nocturna',
    nombre: 'Luz nocturna automática',
    problema: 'Prende sola cuando oscurece — el pasillo, el cuarto del bebé, el gallinero.',
    dificultad: 1,
    items: [
      { skuId: 's-ldr', qty: 1 }, { skuId: 'r-10000', qty: 1 }, { skuId: 'q-2n2222', qty: 1 },
      { skuId: 'r-330', qty: 1 }, { skuId: 'led-blanco', qty: 2 }, { skuId: 'p-9v', qty: 1 },
    ],
  },
  {
    id: 'indicador-bateria',
    nombre: 'Probador de pilas',
    problema: '¿Esta pila sirve o ya murió? Tres LEDs te lo dicen al instante.',
    dificultad: 1,
    items: [
      { skuId: 'r-470', qty: 3 }, { skuId: 'led-rojo', qty: 1 }, { skuId: 'led-amarillo', qty: 1 },
      { skuId: 'led-verde', qty: 1 }, { skuId: 'd-1n4148', qty: 2 },
    ],
  },
  {
    id: 'alarma-calor',
    nombre: 'Alarma de sobre-temperatura',
    problema: 'Avisa si el motor / el cuarto / la incubadora pasa de la temperatura segura.',
    dificultad: 2,
    items: [
      { skuId: 's-ntc', qty: 1 }, { skuId: 'r-10000', qty: 1 }, { skuId: 'q-2n3904', qty: 1 },
      { skuId: 'e-buzzer', qty: 1 }, { skuId: 'led-rojo', qty: 1 }, { skuId: 'r-330', qty: 1 },
    ],
  },
  {
    id: 'control-motor',
    nombre: 'Control de velocidad de motor',
    problema: 'Ventilador o bomba a la velocidad que TÚ quieras, con una perilla.',
    dificultad: 2,
    items: [
      { skuId: 'e-pot10k', qty: 1 }, { skuId: 'q-irl540n', qty: 1 }, { skuId: 'e-motor', qty: 1 },
      { skuId: 'd-1n4007', qty: 1 }, { skuId: 'p-4aa', qty: 1 }, { skuId: 'r-100', qty: 1 },
    ],
  },
  {
    id: 'fuente-banco',
    nombre: 'Mini fuente de banco 5V',
    problema: 'Deja de quemar circuitos: 5 V limpios y protegidos desde un eliminador viejo.',
    dificultad: 2,
    items: [
      { skuId: 'ic-7805', qty: 1 }, { skuId: 'c-100u', qty: 1 }, { skuId: 'c-100n', qty: 2 },
      { skuId: 'd-1n4007', qty: 1 }, { skuId: 'led-verde', qty: 1 }, { skuId: 'r-330', qty: 1 },
    ],
  },
];

/** Total de una receta (suma de sus SKUs × cantidad). */
export function recetaPrecio(r: Receta): number {
  return r.items.reduce((sum, it) => sum + (skuById(it.skuId)?.precio ?? 0) * it.qty, 0);
}

/** ¿La receta es 100% entrega local (24-48h)? */
export function recetaEntrega(r: Receta): Entrega {
  return r.items.every((it) => skuById(it.skuId)?.entrega === 'local') ? 'local' : 'lote';
}
