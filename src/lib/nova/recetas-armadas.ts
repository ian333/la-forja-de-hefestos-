/**
 * recetas-armadas.ts — los circuitos ÚTILES, ya armados en la protoboard.
 *
 * Cada tablero es un conjunto de piezas-en-hoyitos + jumpers que produce un
 * netlist VÁLIDO y SIMULABLE (verificado en __tests__). El banco los carga de
 * un clic: el estudiante ve el circuito funcionando y mueve la perilla / el
 * sol / la temperatura y RESPONDE en vivo. Después: "compra el kit".
 *
 * Diseñados sobre los modelos que el motor SÍ resuelve hoy (R/L/C/D/V/MOSFET).
 * El MOSFET IRL540N (logic-level) maneja la carga — y es lo que vendemos.
 */

import type { Placement, Jumper, Hole } from './protoboard';

const m = (col: number, row: number): Hole => ({ kind: 'main', col, row });
const rail = (r: 0 | 1 | 2 | 3, col: number): Hole => ({ kind: 'rail', rail: r, col });

/** Control interactivo de un tablero (mueve placement.state[campo]). */
export interface Interactive {
  placementId: string;
  campo: 'luz' | 'tempC' | 'frac' | 'pressed' | 'volts';
  label: string;
  min: number;
  max: number;
  step: number;
  valor: number;
  fmt: (v: number) => string;
  /** texto que explica los dos extremos del control. */
  pista: string;
}

export interface TableroArmado {
  recetaId: string;
  titulo: string;
  /** Qué observar al mover el control (el "ajá"). */
  observa: string;
  placements: Placement[];
  jumpers: Jumper[];
  interactives: Interactive[];
}

// ════════════════════════════════════════════════════════════════════════
// 1) LUZ NOCTURNA — prende sola cuando oscurece
// ════════════════════════════════════════════════════════════════════════
//   Divisor LDR(arriba)/10k(abajo): a oscuras la LDR es 200k → el nodo SUBE →
//   el gate del IRL540N pasa el umbral → el MOSFET conduce → el LED prende.
//   Con luz la LDR baja a 1k → el nodo cae → MOSFET en corte → LED apagado.

const luzNocturna: TableroArmado = {
  recetaId: 'luz-nocturna',
  titulo: 'Luz nocturna automática',
  observa: 'Tapa el sensor (mueve el sol a la izquierda) y el LED prende solo.',
  placements: [
    { id: 'bat', skuId: 'p-9v', pins: [rail(0, 2), rail(1, 2)] },
    // divisor: R(10k) ARRIBA, LDR ABAJO → a oscuras la LDR(200k) sube el nodo
    { id: 'rdiv', skuId: 'r-10000', pins: [rail(0, 9), m(12, 0)] },
    { id: 'ldr', skuId: 's-ldr', pins: [m(12, 1), rail(1, 9)], state: { luz: 0.2 } },
    { id: 'q', skuId: 'q-irl540n', pins: [m(20, 0), m(12, 2), rail(1, 16)] }, // [drain, gate, source]
    { id: 'rled', skuId: 'r-330', pins: [rail(0, 22), m(26, 0)] },
    { id: 'led', skuId: 'led-blanco', pins: [m(26, 1), m(20, 1)] }, // ánodo col26, cátodo col20 = drain
  ],
  jumpers: [],
  interactives: [
    { placementId: 'ldr', campo: 'luz', label: 'Luz del ambiente', min: 0, max: 1, step: 0.02, valor: 0.2,
      fmt: (v) => (v < 0.15 ? '🌑 noche' : v > 0.7 ? '☀️ día' : '🌆 atardecer'),
      pista: 'Izquierda = oscuro (LED prende) · Derecha = con luz (LED apaga)' },
  ],
};

// ════════════════════════════════════════════════════════════════════════
// 2) ALARMA DE TEMPERATURA — avisa si algo se calienta de más
// ════════════════════════════════════════════════════════════════════════
//   NTC(arriba)/10k(abajo): al calentar la NTC baja → el nodo... no:
//   queremos que CALOR encienda. NTC arriba: caliente→R baja→nodo SUBE.
//   nodo alto → gate del MOSFET → enciende el LED/buzzer de alarma.

const alarmaCalor: TableroArmado = {
  recetaId: 'alarma-calor',
  titulo: 'Alarma de sobre-temperatura',
  observa: 'Sube la temperatura del sensor y, pasando el umbral, la alarma enciende.',
  placements: [
    { id: 'bat', skuId: 'p-9v', pins: [rail(0, 2), rail(1, 2)] },
    // NTC ARRIBA, R(2.2k) ABAJO → al calentar la NTC baja y el nodo sube;
    // el 2.2k hace que en frío el nodo quede por DEBAJO del umbral (apagado).
    { id: 'ntc', skuId: 's-ntc', pins: [rail(0, 9), m(12, 0)], state: { tempC: 25 } },
    { id: 'rdiv', skuId: 'r-2200', pins: [m(12, 1), rail(1, 9)] },
    { id: 'q', skuId: 'q-irl540n', pins: [m(20, 0), m(12, 2), rail(1, 16)] },
    { id: 'rled', skuId: 'r-330', pins: [rail(0, 22), m(26, 0)] },
    { id: 'led', skuId: 'led-rojo', pins: [m(26, 1), m(20, 1)] },
    { id: 'buzzer', skuId: 'e-buzzer', pins: [m(20, 2), rail(1, 24)] }, // en la placa (no se simula aún)
  ],
  jumpers: [],
  interactives: [
    { placementId: 'ntc', campo: 'tempC', label: 'Temperatura del sensor', min: 0, max: 90, step: 1, valor: 25,
      fmt: (v) => `${v.toFixed(0)} °C`,
      pista: 'Sube la temperatura: pasando ~55 °C el MOSFET conduce y la alarma prende' },
  ],
};

// ════════════════════════════════════════════════════════════════════════
// 3) DIMMER — controla el brillo con una perilla
// ════════════════════════════════════════════════════════════════════════
//   Pot como reóstato en serie con el LED: más resistencia = menos corriente
//   = menos brillo. Puro y directo (sin transistor).

const dimmer: TableroArmado = {
  recetaId: 'dimmer-led',
  titulo: 'Dimmer (control de brillo)',
  observa: 'Gira la perilla: la resistencia del pot ahoga o suelta la corriente del LED.',
  placements: [
    { id: 'bat', skuId: 'p-4aa', pins: [rail(0, 2), rail(1, 2)] }, // 6V
    // pot [A, wiper, B]: A al +, wiper al LED, B suelto (reóstato A-wiper)
    { id: 'pot', skuId: 'e-pot10k', pins: [rail(0, 8), m(14, 0), m(16, 0)], state: { frac: 0.5 } },
    { id: 'led', skuId: 'led-verde', pins: [m(14, 1), m(18, 0)] }, // ánodo = wiper, cátodo col18
    { id: 'r', skuId: 'r-100', pins: [m(18, 1), rail(1, 12)] },     // tope de corriente
  ],
  jumpers: [],
  interactives: [
    { placementId: 'pot', campo: 'frac', label: 'Perilla', min: 0.02, max: 0.98, step: 0.02, valor: 0.5,
      fmt: (v) => `${Math.round((1 - v) * 100)} %`,
      pista: 'Izquierda = poca resistencia (brillante) · Derecha = mucha (tenue)' },
  ],
};

// ════════════════════════════════════════════════════════════════════════
// 4) PROBADOR DE PILAS — ¿sirve o ya murió?
// ════════════════════════════════════════════════════════════════════════
//   Un LED en serie con R: con buena pila brilla; con pila baja apenas.
//   El control mueve el voltaje de la "pila bajo prueba".

const probadorPilas: TableroArmado = {
  recetaId: 'indicador-bateria',
  titulo: 'Probador de pilas',
  observa: 'Baja el voltaje de la pila: el LED se apaga cuando ya no sirve.',
  placements: [
    { id: 'bat', skuId: 'p-9v', pins: [rail(0, 2), rail(1, 2)], state: { volts: 9 } },
    { id: 'r', skuId: 'r-470', pins: [rail(0, 8), m(10, 0)] },
    { id: 'led', skuId: 'led-rojo', pins: [m(10, 1), rail(1, 8)] },
  ],
  jumpers: [],
  interactives: [
    { placementId: 'bat', campo: 'volts', label: 'Voltaje de la pila', min: 1, max: 9, step: 0.1, valor: 9,
      fmt: (v) => `${v.toFixed(1)} V`,
      pista: 'Abajo de ~1.8 V (el gap del LED) ya no prende: la pila murió' },
  ],
};

export const TABLEROS: TableroArmado[] = [luzNocturna, alarmaCalor, dimmer, probadorPilas];

export function tableroById(recetaId: string): TableroArmado | undefined {
  return TABLEROS.find((t) => t.recetaId === recetaId);
}

/**
 * Aplica el valor de un control al placement correspondiente. El probador de
 * pilas es especial: su "frac" reescribe el VOLTAJE de la fuente.
 */
export function aplicarControl(placements: Placement[], it: Interactive, valor: number): Placement[] {
  return placements.map((p) =>
    p.id === it.placementId ? { ...p, state: { ...p.state, [it.campo]: valor } } : p,
  );
}
