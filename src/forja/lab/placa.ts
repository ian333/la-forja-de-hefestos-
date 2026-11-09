/**
 * EL LABORATORIO DE LA PLUMA · C · LA ELECTRÓNICA SOLDADA (orden 2026-11-05-lab-placa · ronda 2: 2026-11-06-lab-placa-r2)
 * ======================================================================================================================
 * ian: «una base para poner la placa… todo tiene que ir soldado, porque quiero el mínimo de componentes, y la conexión,
 * porque los protos siempre meten falsos contactos… yo preferiría usar cosas que no se rompan para manejar cosas enormes,
 * pero los transistores son eso».
 *
 * UNA placa (FR4, 2 capas de 2 oz, en L: 179 × 146 + la muesca de atrás a la izquierda) dentro de la bahía PLACA_PCB del
 * contrato v2. Lleva la etapa de La Pluma (plumaSistema.ts: buck lado alto 100 kHz, IRFB4227, IR2110, D1 Schottky 200 V,
 * choque de aire 15 µH, shunt 0.5 mΩ + INA240, Cout 1 µF + D2), el micro (módulo WeAct RP2350B soldado por sus pines:
 * 8 ADC), el driver del NEMA 17 (módulo TMC2209 soldado), las fuentes (TRACO TEN 40-4812 + RECOM R-78E5.0) y la mesa
 * (NTC, ventilador y su termostato). Cero conectores de proto: cada cable que sale se SUELDA a una isla, y la isla cae
 * en el puerto del contrato (regla G3 con su tolerancia).
 *
 * RONDA 2 (contrato v2): la bahía cede x −119…−96 en y −100…10 al difusor de B y baja su techo a z −26; C.OUTP, C.FAN,
 * C.PARO y C.MESA se movieron. El disipador se recorre 22 mm a la derecha (sus aletas empiezan a 1 mm de la boca del
 * difusor) y con él toda la celda; la placa queda en L (la muesca de atrás a la izquierda lleva el bus y el ventilador).
 * Entran: K13 y K14 (los termostatos de la mesa y del cuello, en serie con el del disipador en la cadena SD), K09 como puente con su barreno de
 * alivio, la corriente del TMC2209 por UART (A corre 0.85 A), la térmica con el difusor, D2 (el IR2110S abajo, bajo Q1),
 * D3 (armado() con el orden de soldadura) y las compras en México.
 *
 * Todo es PURO (datos + funciones). Lo que hay aquí:
 *   1. las decisiones con sus números (DECISIONES) y los supuestos que ian mide o compra (SUPUESTOS);
 *   2. la NETLIST como datos (COMPONENTES con valor, encapsulado y huella de KiCad; REDES con su voltaje; ISLAS; BARRENOS);
 *   3. el ACOMODO (x, y, giro, lado) en el marco del contrato, el contorno y las subidas de cable a cada puerto;
 *   4. el REVISOR revisarPlaca(): ERC, IPC-2221, islas por calibre, geometría (enBahia del contrato), puertos, patas,
 *      térmica, rizo, juntas, pines, la corriente del motor, el armado y las compras;
 *   5. kicadNetlist() (S-expression «export (version D)», importable en Pcbnew) y leerKicadNetlist() (lo lee de regreso);
 *   6. armado() (el orden de soldadura como datos) y comprasMX() (cada pieza con su alternativa en México);
 *   7. piezasPlaca() → PiezaLab[] para verla en La Forja (reúsa las mallas de public/modelos/banco-arco/).
 *
 * Marco: el del contrato (mm, Z arriba, origen = centro de la cara de arriba de la placa de trabajo).
 */
import {
  BAHIAS, PUERTOS, CONEXIONES, REGLAS, MATERIAL, bahia, puerto, dentro, enBahia, traslape,
  type V3, type PiezaLab, type Caja, type Puerto,
} from './laboratorio-contrato';
import {
  crearPlumaSim, pasoPluma, PLUMA, RP2350B, revisarPines, slicePWM, CALIBRES, TERMICO,
  type PinMCU, type PlumaParams, type Calibre,
} from '../brep/plumaSistema';
import type { Element } from '../../lib/circuitos/spice';

// ════════════════════════════════════════════════════════════════════════════════════════════
// 0. LAS DECISIONES (con los números que las deciden) y LOS SUPUESTOS
// ════════════════════════════════════════════════════════════════════════════════════════════
export const DECISIONES = {
  micro: 'WeAct RP2350B Core (41.4 × 41.1, dos tiras 2×15 a 2.54 mm, USB-C, BOOT/RESET, 16 MB, LDO 3V3, 8 ADC en GP40–47) '
    + 'soldado por sus 60 pines: 1 pieza contra ~50 que trae adentro (su esquemático: C1–C27, R1–R19, L1, Y1, U2–U8). '
    + 'PGA2350 (Pimoroni): 64 pines PGA, regulador 3V3 de 300 mA, SIN USB ni botones → +1 conector USB +2 R = 3–4 piezas. '
    + 'Pico 2 (RP2350A): 3 ADC libres → +ADC externo SPI (MCP3204 + 100 nF) y ese ADC (50 kS/s) no sirve para I/V del arco.',
  driver: 'Módulo TMC2209 tipo StepStick soldado directo (16 pines + DIAG): 1 pieza; el TMC2209 desnudo es QFN-28. '
    + 'UART de un hilo (PDN_UART): TX por 1 kΩ, RX directo (hoja del TMC2209). VM = 12 V (contrato K07 v2).',
  motor: 'K07 a 12 V; la corriente la fija lo que corre A (0.85 A rms, contrato K07) por UART, no por el potenciómetro: '
    + 'GCONF.i_scale_analog = 0, CHOPCONF.vsense = 1 (V_fs 0.180 V), IRUN = 27 → (27+1)/32 · 0.180/(0.11+0.02)/√2 = 0.857 A rms '
    + '(+0.8 %); IHOLD = 13 → 0.43 A. Con vsense = 1 el máximo posible (IRUN 31) es 0.979 A: el firmware NO puede pasar el tope '
    + 'de 1.4 A aunque escriba mal IRUN (sólo si apaga vsense; la regla M2 lo prohíbe). Respaldo: el potenciómetro del módulo a '
    + 'VREF = 1.20 V (0.85 A si el UART no configurara y alguien habilitara EN). EN tiene pull-up: sin UART verificado el motor queda suelto.',
  fuentes: '48 → 12 V: TRACO TEN 40-4812 (36–75 V, 12 V 3.3 A, 2×1 in, pines THT): 1 pieza + 1 capacitor; el TPS54360 '
    + 'discreto son 14 piezas con una PowerPAD (difícil a mano) y su lazo lo diseña uno. 12 → 5 V: RECOM R-78E5.0-0.5 '
    + '(SIP-3) + 1 capacitor; el 3V3 lo da el LDO del WeAct (~60 mA de carga). Presupuesto de 12 V: compuerta 0.02 + '
    + 'ventilador 0.25 + TMC2209 0.6 + R-78E 0.05 + ventilador de la mesa 1.0 = 1.9 A (58 % de 3.3 A).',
  bus: '3 electrolíticos snap-in 2200 µF/100 V Ø30 × 50 de alto rizo + 3 películas de 10 µF/100 V. El MNA de La Pluma con ESL '
    + '(electrolítico 18 nH, película 12 nH) y 6 nH de pista: 4.82 A rms por electrolítico a 40 A (5.41 A a 45 A) contra '
    + '6.69 A con los 2 del v3. Más película NO ayuda (6 × 10 µF: 6.57 A). R2: con el disipador 22 mm más a la derecha la '
    + 'fila del frente mide 80 mm (del disipador al WeAct) y no caben 3 × Ø30.5 = 91.5: van en tresbolillo, 2 al frente y 1 '
    + 'atrás entre ellos, todos del lado + de las películas (el bus no cruza la franja de SW).',
  choque: 'Se queda de aire, Ø60 × 50, 18 vueltas cal 10 (15 µH, 11 mΩ, 18.3 W): el aire NO se satura con los picos de 100 A '
    + 'del bang-bang (un toroide −52 a 67 Oe cae a ~55 % de µ). Va acostado, eje en x, levantado 10 mm sobre sus patas '
    + '(D2, R1–R4 caben debajo) y en el chorro del difusor; sus dos patas bajan en y = −27 (el fondo de la espira).',
  cobre: '2 capas de 2 oz (70 µm): arriba los vaciados de potencia (BUS+, SW, OUT+, OUT−), abajo el plano de tierra y la '
    + 'franja del bus bajo el disipador. IPC-2221 externo con ΔT = 20 K: 40 A en una capa piden 16.0 mm (SW 18, OUT+ 17, '
    + 'OUT− 18 declarados); 27 A, 9.3 mm (BUS+ 20). Islas sin alivio térmico (conexión sólida) para cal 8 y cal 10. Bajo el '
    + 'disipador la cara de arriba va SIN cobre: si un Sil-Pad falla (la aleta de D1 es SW), el disipador no toca nada.',
  juntas: 'Cal 8 pasante en agujero de 4.3 mm con anillo de 8 mm a dos caras de 2 oz: resistencia de la junta ~50 µΩ '
    + '(0.08 W a 40 A). A ~58 °C el estaño está a T/Tf ≈ 0.68 (SAC305): FLUYE bajo carga sostenida. Por eso la junta NO carga '
    + 'peso: abrazadera impresa (B) a ≤ 15 mm. Con eso es mejor que una zapata atornillada (se afloja con los ciclos térmicos).',
  driverCompuerta: 'D2 del contrato: IR2110S (SOIC-16W) y su bootstrap en la cara de ABAJO, debajo de Q1: el lazo HO → Rg → G '
    + 'mide ~5 mm de la orilla del IR2110S a la pata G (regla L2: ≤ 10 mm; el DIP-14 arriba quedaba a ~40 mm).',
  cadenaSD: 'SD del IR2110 arriba = APAGADO (R8 a 3V3). La cadena que lo baja: SD → contacto auxiliar NC del PARO (K10) → '
    + 'termostato NC 70 °C de la mesa (K13) → termostato NC 70 °C ±3 del zócalo del cuello (K14, pedido de A) → KSD301 NC 90 °C del '
    + 'disipador (TS1) → 2N7000 (Q2, el micro) → GND. Si CUALQUIERA de los cuatro abre, SD sube por R8 y el arco se apaga sin el '
    + 'micro (regla E4c: abre cada eslabón y busca otro camino de SD a GND). El orden PARO → mesa → cuello → disipador hace las '
    + 'pistas cortas: el PARO y la mesa adelante a la derecha, C.SEN atrás al centro, el disipador y Q2 a la izquierda.',
  ventilador: 'K09 es puente (contrato v2): los hilos de fábrica del ventilador (cal 24–26) se sueldan a J12/J13 en la muesca '
    + 'de atrás a la izquierda, junto a C.FAN, y un cincho de 2.5 mm por el barreno H1 (a 6 mm) los amarra: la junta no carga. '
    + 'El agujero de 1.0 mm le queda al cal 24 (juego 0.41) y al 26 (0.53). Directo al riel de 12 V (0 piezas). El ventilador '
    + '(lo pone B) es de 80 × 80 × 25, 12 V, 0.25 A (clase AFB0812H): cabe justo en K09 (Irms 0.25) y en el presupuesto de 12 V (regla E8).',
  aire: 'Ronda 2, cierre: el caudal es el del modelo de B con las rejillas, el difusor y la cuna reales (cuerpo.ts). Con el '
    + 'ventilador de 0.15 A daba 26 m³/h y el disipador quedaba en 86.6 °C con 39 W, dentro de la tolerancia del KSD301 (±5 K): '
    + 'pedía ≥ 27.6 m³/h. B lo cambió por uno de 0.25 A (clase AFB0812H): 35.1 m³/h a 30.6 Pa. Con 39 W el disipador queda en '
    + '79.1 °C, 10.9 K bajo el termostato de 90 (más que los ±5 de tolerancia: la regla T5 calla). El termostato no se sube.',
  difusor: 'El difusor de B (contrato v2) abre el chorro de 80 a 110 mm en y −100…10. El disipador (125, y −98.5…26.5) queda con '
    + '108.5 mm en el chorro contra 78 sin difusor. Con el mismo caudal la velocidad baja a 80/108.5: entre aletas el flujo es '
    + 'laminar (h ∝ v^½), así que θSA = 1/(f·√v/0.7 + (1−f)/2.2) con v = (Q/37)·(80/Lc): 1.05 K/W a 26 m³/h. El difusor gana '
    + '~2 K en el disipador, no más.',
  cuna: 'El tope de silicato de la cuna de B (cuerpo.ts CUNA_HS) tiene su cara en y −99.3, 0.7 mm dentro del margen de 1 mm que '
    + 'dejé para las guías de B (para eso es). Con el disipador en y −99 quedaban 0.3 mm de juego, y hacen falta 0.71: 0.11 de '
    + 'dilatación del aluminio (23 ppm/K · 66 mm de Q1/D1 al frente · 70 K) + 0.6 de tolerancias (corte y barrenos a mano ±0.3, '
    + 'impresión ±0.2, contorno de la PCB ±0.1). El disipador se recorre 0.5 mm hacia atrás: juego de 0.8. B no mueve nada.',
  armado: 'D3 del contrato: SMD abajo → SMD arriba → THT de lo más bajo a lo más alto (lo que queda bajo el choque antes que el '
    + 'choque) → Q1/D1 con el disipador ya atornillado → islas de señal → islas de cal 10 y cal 8 AL FINAL con cautín ≥ 80 W, '
    + 'punta cincel de 5 mm y la placa precalentada a ~100 °C con aire por abajo (2 oz sin alivio térmico).',
  rizoCriterio: 'Rizo por electrolítico ≤ 0.85 × su nominal a 10 kHz+/105 °C (6.0 A, SUPUESTO de la serie de alto rizo).',
};
export const SUPUESTOS: string[] = [
  'Electrolítico de bus: 2200 µF/100 V/105 °C Ø30 × 50, ESR ≤ 30 mΩ @100 kHz, rizo ≥ 4.4 A @100 Hz (≈ 6.0 A @10 kHz+). Buscar serie de alto rizo (p. ej. TDK/EPCOS B43644). Si la que compres da menos, el revisor T2 lo dice.',
  'Pérdidas: Q1 39.2 W es el peor caso (ngspice del agente 05, Rg 22 Ω); plumaSistema da 14 W. El banco E1 (carga falsa 0.6 Ω en agua) decide cuál.',
  'Disipador 125 × 35 × 35: θSA 0.7 K/W con TODO el largo en el chorro de un ventilador de 80 a su velocidad propia y 2.2 K/W al aire (plumaSistema); entre aletas laminar, h ∝ v^½. Con el difusor de B y 26 m³/h da 1.05 K/W. Medir en E1.',
  'Aire de entrada a 30 °C (taller). Caudal del ventilador de 80 (0.25 A, clase AFB0812H): 35.1 m³/h a 30.6 Pa (modelo de B con rejillas, difusor y cuna; la curva del ventilador es SUPUESTO de catálogo); el 0.7 K/W de plumaSistema se toma a los ~37 m³/h del contrato. El aire sube ΣP/11.8 W/K aguas abajo.',
  'Termostato del disipador KSD301 90 °C: tolerancia ±5 K (la común del catálogo). Si se consigue de ±3, el margen sube.',
  'Pinout del módulo TMC2209 (BTT V1.3 / FYSETC): EN, MS1, MS2, PDN_UART, —, CLK, STEP, DIR | GND, VIO, 1B, 1A, 2A, 2B, GND, VM + DIAG arriba. Varía por fabricante: verificar antes de soldar.',
  'Rsense del módulo TMC2209 = 0.11 Ω (BTT V1.3 y FYSETC): medirla en el módulo antes de fijar IRUN (la fórmula de la hoja suma 0.02 Ω internos).',
  'Pinout del TEN 40-4812 (−Vin, +Vin, On/Off | +Vout, Trim, −Vout) y de su huella de 2 × 1 in: verificar con la hoja de TRACO.',
  'IR2110S SOIC-16W: 1 LO · 2 COM · 3 VCC · 6 VS · 7 VB · 8 HO · 11 VDD · 12 HIN · 13 SD · 14 LIN · 15 VSS (4, 5, 9, 10, 16 NC). Las 6 primeras confirmadas; el resto, de la hoja.',
  'INA240A2 SOIC-8: 1 IN+ · 2 GND · 3 REF2 · 4 NC · 5 OUT · 6 VS · 7 REF1 · 8 IN−: verificar.',
  'Shunt de manganina de 4 terminales THT, 0.5 mΩ, ≥ 3 W, terminales Kelvin; la huella es nuestra (forja_lab).',
  'El U2 del WeAct (entre VBUS del USB-C y su pin 5V) aísla: con la placa encendida y el USB fuera, el pin VBUS debe medir ~0 V.',
  'Termostato KSD301 90 °C NC con 2 tornillos M3 por la pestaña a la cara de arriba de la base del disipador (machuelo M3); NTC 10 k B3950 pegadas con epóxico (disipador y choque).',
  'Termostato de la mesa: plano, clase KSD9700, 70 °C NC (contrato P9: acostado sobre el piso del ducto); lo compra C, lo pone B.',
  'Termostato del cuello: KSD301 70 °C ±3 NC en el inserto de silicato del zócalo del módulo A (K14); lo pone A. Aquí va en la lista sólo para cerrar la cadena SD: si A ya lo compra, no se compra dos veces.',
  'AS5600 en modo analógico (A lo pone): 10–90 % de 3.3 V por un cable de ~0.6 m junto al arco → R 1 kΩ + C 10 nF a la entrada.',
  'Las alternativas de compra en México NO se verificaron en la web (existencia, precio, tiempo de entrega): todas son SUPUESTO.',
];

// ════════════════════════════════════════════════════════════════════════════════════════════
// 1. LA GEOMETRÍA DE LA PLACA
// ════════════════════════════════════════════════════════════════════════════════════════════
const BAHIA_PCB = bahia('PLACA_PCB');
/** lo que la bahía cede al difusor de B (contrato v2): x −119…−96 en y −100…10, toda la altura */
export const CEDE = BAHIA_PCB.cede?.[0] ?? { x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0 };
/** aire entre la boca del difusor (B) y lo de C: la tolerancia de impresión del PETG de la K1 (dfm: ~0.5) × 2 */
export const HOLGURA_DIFUSOR = 1;
/** de las orillas de la PCB a las caras de la bahía (B pone ahí sus guías) */
export const MARGEN_BAHIA = 1;
/** La cara de arriba de la PCB queda donde el USB-C del WeAct sale a la altura del puerto C.USB (z = −100):
 *  tira de pines 2.5 + PCB del módulo 1.6 + medio USB-C 1.6 = 5.7 mm sobre la PCB. */
export const Z_TOP = puerto('C.USB').pos[2] - (2.5 + 1.6 + 1.6);
export const ESPESOR = 1.6;
/** La PCB en L: el cuerpo (de la boca del difusor a la derecha) y la muesca de atrás a la izquierda (detrás del difusor). */
export const PCB_RECTS: Array<{ x0: number; x1: number; y0: number; y1: number }> = [
  { x0: CEDE.x1 + HOLGURA_DIFUSOR, x1: BAHIA_PCB.caja.x1 - MARGEN_BAHIA, y0: BAHIA_PCB.caja.y0 + MARGEN_BAHIA, y1: BAHIA_PCB.caja.y1 - MARGEN_BAHIA },
  { x0: BAHIA_PCB.caja.x0 + MARGEN_BAHIA, x1: CEDE.x1 + HOLGURA_DIFUSOR, y0: CEDE.y1 + HOLGURA_DIFUSOR, y1: BAHIA_PCB.caja.y1 - MARGEN_BAHIA },
];
const [RA, RB] = PCB_RECTS;
/** la caja que envuelve a la PCB (para las cuentas); el contorno real es CONTORNO */
export const PCB = { x0: RB.x0, x1: RA.x1, y0: RA.y0, y1: RA.y1, oz: 2, capas: 2, cobreUm: 70 };
export const CONTORNO: [number, number][] = [[RA.x0, RA.y0], [RA.x1, RA.y0], [RA.x1, RA.y1], [RB.x0, RB.y1], [RB.x0, RB.y0], [RA.x0, RB.y0]];
/** ¿el círculo (x, y, r) cae completo sobre la PCB en L? (8 puntos de su orilla + el centro) */
export function sobrePCB(x: number, y: number, r = 0): boolean {
  const pts: Array<[number, number]> = [[x, y]];
  for (let k = 0; k < 8; k++) pts.push([x + r * Math.cos((k * Math.PI) / 4), y + r * Math.sin((k * Math.PI) / 4)]);
  return pts.every(([px, py]) => PCB_RECTS.some((q) => px >= q.x0 - 1e-9 && px <= q.x1 + 1e-9 && py >= q.y0 - 1e-9 && py <= q.y1 + 1e-9));
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 2. LA NETLIST COMO DATOS
// ════════════════════════════════════════════════════════════════════════════════════════════
export type TipoPin = 'entrada' | 'salida' | 'bidir' | 'pasivo' | 'pot-entrada' | 'pot-salida' | 'nc';
export interface Pin { n: string; nombre: string; red: string | null; tipo: TipoPin; tira?: 'alto' | 'bajo' }
export type Lado = 'arriba' | 'abajo';
export type Grupo = 'potencia' | 'compuerta' | 'seguridad' | 'sensores' | 'micro' | 'motor' | 'fuentes' | 'mesa';
export interface Cuerpo { dx: number; dy: number; w: number; d: number; h: number; r?: number; dz?: number }
export interface Componente {
  ref: string; valor: string; parte: string; desc: string; grupo: Grupo;
  enc: string; huella: string; montaje: 'THT' | 'SMD' | 'modulo' | 'fuera';
  pines: Pin[];
  pos: { x: number; y: number; giro: number; lado: Lado };   // origen de la huella (KiCad) en el marco del contrato
  cuerpo: Cuerpo;                                             // caja del cuerpo, desplazada del origen (marco del mundo)
  pos3D?: V3;                                                 // 'fuera': dónde vive de verdad (pegado al disipador/choque)
  ci?: boolean; desacoploInterno?: boolean;                   // integrado o módulo que pide desacoplo
  internos?: string[];                                        // redes que el módulo ya desacopla adentro
  vmax?: number; vPines?: [string, string]; vFija?: number;    // tensión nominal entre dos pines (o la diferencia fija)
  pR?: number;                                                // resistencias: potencia nominal (W)
  supuesto?: string;
}
export type FuncionRed = 'bus' | 'potencia' | 'tierra' | 'aux' | 'senal' | 'motor' | 'compuerta' | 'ac';
export interface Red { nombre: string; vmin: number; vmax: number; funcion: FuncionRed }

export const REDES: Red[] = [
  { nombre: 'GND', vmin: 0, vmax: 0, funcion: 'tierra' },
  { nombre: 'BUS+', vmin: 43, vmax: 52.8, funcion: 'bus' },          // LRS-1200-48 ajustable 43.2–52.8 V
  { nombre: 'SW', vmin: -1, vmax: 52.8, funcion: 'potencia' },
  { nombre: 'OUT+', vmin: 0, vmax: 52.8, funcion: 'potencia' },
  { nombre: 'OUT-', vmin: 0, vmax: 0.1, funcion: 'potencia' },       // sobre el shunt: 50 mV a 100 A
  { nombre: 'SH_P', vmin: 0, vmax: 0.1, funcion: 'senal' },
  { nombre: 'SH_N', vmin: 0, vmax: 0, funcion: 'senal' },
  { nombre: '+48F', vmin: 43, vmax: 52.8, funcion: 'aux' },
  { nombre: '+12V', vmin: 12, vmax: 12.4, funcion: 'aux' },
  { nombre: '+5V', vmin: 5, vmax: 5.2, funcion: 'aux' },
  { nombre: '+3V3', vmin: 3.3, vmax: 3.4, funcion: 'aux' },
  { nombre: 'VB', vmin: 11, vmax: 64.8, funcion: 'compuerta' },
  { nombre: 'BOOT_A', vmin: 11, vmax: 12.4, funcion: 'compuerta' },
  { nombre: 'HO', vmin: -1, vmax: 64.8, funcion: 'compuerta' },
  { nombre: 'G_Q1', vmin: -1, vmax: 64.8, funcion: 'compuerta' },
  { nombre: 'HIN', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'SD', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'PARO_R', vmin: 0, vmax: 3.3, funcion: 'senal' },        // después del contacto auxiliar del PARO
  { nombre: 'TM_R', vmin: 0, vmax: 3.3, funcion: 'senal' },          // después del termostato de la mesa (K13)
  { nombre: 'TC_R', vmin: 0, vmax: 3.3, funcion: 'senal' },          // después del termostato del cuello (K14)
  { nombre: 'TS_R', vmin: 0, vmax: 3.3, funcion: 'senal' },          // después del termostato del disipador
  { nombre: 'SD_EN', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'I_ARC', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'V_OUT', vmin: 0, vmax: 2.8, funcion: 'senal' },
  { nombre: 'V_BUS', vmin: 0, vmax: 2.8, funcion: 'senal' },
  { nombre: 'NTC_HS', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'NTC_L', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'NTC_MESA', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'ENC', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'ENC_F', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'STEP', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'DIR', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'EN_MOT', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'DIAG', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'UART_TX', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'PDN', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'MOT_1A', vmin: 0, vmax: 12.4, funcion: 'motor' },
  { nombre: 'MOT_1B', vmin: 0, vmax: 12.4, funcion: 'motor' },
  { nombre: 'MOT_2A', vmin: 0, vmax: 12.4, funcion: 'motor' },
  { nombre: 'MOT_2B', vmin: 0, vmax: 12.4, funcion: 'motor' },
  { nombre: 'MESA_PWM', vmin: 0, vmax: 3.3, funcion: 'senal' },
  { nombre: 'BOMBA-', vmin: 0, vmax: 12.9, funcion: 'aux' },
];

// ── constructores de pines y de cuerpos ─────────────────────────────────────────────────────
const p = (n: string, nombre: string, red: string | null, tipo: TipoPin, tira?: 'alto' | 'bajo'): Pin => ({ n, nombre, red, tipo, tira });
const dos = (a: string, b: string): Pin[] => [p('1', '1', a, 'pasivo'), p('2', '2', b, 'pasivo')];
const centro = (w: number, d: number, h: number, extra: Partial<Cuerpo> = {}): Cuerpo => ({ dx: 0, dy: 0, w, d, h, ...extra });
/** TO-220 vertical (malla to220.bin: pines en x local 0/2.54/5.08, aleta hacia +y local). giro 90 → aleta hacia −x. */
const cuerpoTO220 = (giro: number): Cuerpo => giro === 90
  ? { dx: -0.935, dy: 2.535, w: 4.45, d: 10.25, h: 18.8 }
  : { dx: 2.535, dy: 0.935, w: 10.25, d: 4.45, h: 18.8 };
/** MKS4 P27.5 de 100 V (31.5 × 17 × 29) girada 90: pines a lo largo de y desde el origen (pata +). */
const cuerpoMKS4 = (): Cuerpo => ({ dx: 0, dy: 13.75, w: 17, d: 31.5, h: 29 });
const RV = 'Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P2.54mm_Vertical';   // de pie: 2.5 × 5 mm de planta
const rVert = (ref: string, valor: string, a: string, b: string, x: number, y: number, grupo: Grupo, desc: string, pR = 0.25): Componente => ({
  ref, valor, parte: `${valor} 1/4 W 1 % metálica`, desc, grupo, enc: 'axial de pie P2.54', huella: RV, montaje: 'THT',
  pines: dos(a, b), pos: { x, y, giro: 90, lado: 'arriba' }, cuerpo: { dx: 0, dy: 1.27, w: 2.5, d: 5.1, h: 9 }, pR,
});
const cDisc = (ref: string, valor: string, a: string, b: string, x: number, y: number, grupo: Grupo, desc: string, vmax: number): Componente => ({
  ref, valor, parte: `${valor} ${vmax} V X7R radial`, desc, grupo, enc: 'disco P5', huella: 'Capacitor_THT:C_Disc_D5.0mm_W2.5mm_P5.00mm', montaje: 'THT',
  pines: dos(a, b), pos: { x, y, giro: 0, lado: 'arriba' }, cuerpo: { dx: 2.5, dy: 0, w: 7.5, d: 3, h: 9 }, ci: false, vmax,
});
const smd1206 = (ref: string, valor: string, a: string, b: string, x: number, y: number, giro: number, desc: string, esC: boolean, vmax?: number): Componente => ({
  ref, valor, parte: esC ? `${valor} ${vmax} V X7R 1206` : `${valor} 1206 1 %`, desc, grupo: 'compuerta', enc: '1206',
  huella: esC ? 'Capacitor_SMD:C_1206_3216Metric' : 'Resistor_SMD:R_1206_3216Metric', montaje: 'SMD',
  pines: dos(a, b), pos: { x, y, giro, lado: 'abajo' }, cuerpo: giro === 90 ? centro(1.8, 3.4, 1.2) : centro(3.4, 1.8, 1.2), vmax, pR: esC ? undefined : 0.25,
});

// ── el WeAct RP2350B Core: 60 pines, girado 90° (el USB-C mira a −y) ───────────────────────
export const WEACT = { cx: puerto('C.USB').pos[0], cy: -99.5 + 20.7, w: 41.402, d: 41.148, altoPines: 2.5 };
const WEACT_FILAS: Array<{ py: number; nombres: string[] }> = [
  { py: 19.05, nombres: ['G', 'G', '3V3', 'RUN', 'GP46', 'GP44', 'GP42', 'GP40', 'GP38', 'GP36', 'GP34', 'GP32', 'GP30', 'GP28', 'GP26'] },
  { py: 16.51, nombres: ['G', 'EN', '3V3', 'GP47', 'GP45', 'GP43', 'GP41', 'GP39', 'GP37', 'GP35', 'GP33', 'GP31', 'GP29', 'GP27', 'GP25'] },
  { py: -16.51, nombres: ['5V', 'G', 'GP0', 'GP2', 'GP4', 'GP6', 'GP8', 'GP10', 'GP12', 'GP14', 'GP16', 'GP18', 'GP20', 'GP22', 'GP24'] },
  { py: -19.05, nombres: ['VBUS', 'G', 'REF', 'GP1', 'GP3', 'GP5', 'GP7', 'GP9', 'GP11', 'GP13', 'GP15', 'GP17', 'GP19', 'GP21', 'GP23'] },
];
/** Pin del módulo (marco del módulo, mm) → mundo: giro 90 → (x, y) ↦ (cx − y, cy + x). */
export function pinWeAct(nombreONumero: string): { n: string; nombre: string; x: number; y: number; lx: number; ly: number } | null {
  let n = 0;
  for (const f of WEACT_FILAS) for (let k = 0; k < 15; k++) {
    n++;
    const nombre = f.nombres[k], lx = -17.78 + 2.54 * k, ly = f.py;
    if (nombre === nombreONumero || String(n) === nombreONumero) return { n: String(n), nombre, x: WEACT.cx - ly, y: WEACT.cy + lx, lx, ly };
  }
  return null;
}
/** Qué lleva cada pin del módulo (lo que no está aquí queda NC declarado). */
const WEACT_REDES: Record<string, [string, TipoPin, ('alto' | 'bajo')?]> = {
  '5V': ['+5V', 'pot-entrada'], '3V3': ['+3V3', 'pot-salida'], G: ['GND', 'pot-entrada'],
  GP0: ['HIN', 'salida'], GP1: ['SD_EN', 'salida'], GP2: ['STEP', 'salida'], GP3: ['DIR', 'salida'],
  GP4: ['UART_TX', 'salida'], GP5: ['PDN', 'entrada'], GP6: ['EN_MOT', 'salida'], GP7: ['DIAG', 'entrada'],
  GP8: ['SD', 'entrada'], GP10: ['MESA_PWM', 'salida'],
  GP40: ['I_ARC', 'entrada'], GP41: ['V_OUT', 'entrada'], GP42: ['V_BUS', 'entrada'], GP43: ['ENC_F', 'entrada'],
  GP44: ['NTC_HS', 'entrada'], GP45: ['NTC_L', 'entrada'], GP46: ['NTC_MESA', 'entrada'],
};
function pinesWeAct(): Pin[] {
  const out: Pin[] = [];
  let n = 0;
  for (const f of WEACT_FILAS) for (const nombre of f.nombres) {
    n++;
    const r = WEACT_REDES[nombre];
    out.push(r ? p(String(n), nombre, r[0], r[1], r[2]) : p(String(n), nombre, null, 'nc'));
  }
  return out;
}

// ── el acomodo de la celda de conmutación (todo se deriva de aquí) ──────────────────────────
/** Disipador 125 × 35 × 35 girado 90: aletas hacia −x (hacia el difusor), base en x1. R2: sus aletas empiezan a
 *  HOLGURA_DIFUSOR de la boca del difusor (x −96); su frente queda a JUEGO_CUNA del tope de silicato de la cuna de B: 108.5
 *  de 125 mm en el chorro.
 *  (x, y) es el origen de la malla disipador-125.bin: 2.54 antes de la base y a la mitad del largo, como en la ronda 1. */
/** La cuna de B (cuerpo.ts CUNA_HS, ronda 2): un tope de silicato al frente del disipador; su cara está en y −99.3, dentro del
 *  margen de 1 mm de mi bahía que dejé para las guías de B. B juzgó su PETG con el disipador a 90 °C. */
export const CUNA_B = { topeY: -99.3, Tdiseno: 90, fuente: 'cuerpo.ts CUNA_HS (agente B, ronda 2)' };
/** el juego que dejo contra ese tope (≥ juegoCunaNecesario(): ver la regla G7) */
export const JUEGO_CUNA = 0.8;
const HS_X0 = CEDE.x1 + HOLGURA_DIFUSOR, HS_Y0 = CUNA_B.topeY + JUEGO_CUNA, HS_LARGO = 125, HS_ANCHO = 34.99;
export const DISIPADOR = {
  x: HS_X0 + HS_ANCHO - 2.54, y: HS_Y0 + HS_LARGO / 2, rz: 90,
  x0: HS_X0, x1: HS_X0 + HS_ANCHO, y0: HS_Y0, y1: HS_Y0 + HS_LARGO, h: 35, largo: HS_LARGO,
};
/** la pata 1 de un TO-220 de pie, girado 90, con su aleta contra la base: Sil-Pad 0.3 + 2.225 + 0.935 de la aleta a la fila */
const SILPAD = 0.3, TO220_FILA = 2.225 + 0.935;
/** la fila + de las películas (y): 0.5 mm detrás del electrolítico de en medio (ver CE) */
const CF_Y = -39.8;
const Q1_O = { x: DISIPADOR.x1 + SILPAD + TO220_FILA, y: CF_Y - 2.54 };   // pata 1 (G) de Q1; D en +2.54 = la fila + de las películas
const D1_O = { x: Q1_O.x, y: Q1_O.y + 14 };                               // pata 1 (A1) de D1; K en +2.54, A2 en +5.08
const CF_X = [0, 1, 2].map((k) => Q1_O.x + 10.5 + 17.2 * k);             // pata + de cada película (la − 27.5 mm atrás; 0.2 de aire entre cuerpos de 17)
/** electrolíticos Ø30 (centro): 2 al frente a 33.5 entre centros y 1 atrás entre ellos (tresbolillo, ≥ 0.5 mm de aire) */
const CE = [[-44.5, -83.75], [-11, -83.75], [-27.75, -57.6]] as const;
export const CHOQUE = { x0: -1, x1: -1 + 18 * 2.8, y: -26.7, r: 30, alambre: 1.3, sube: 10, vueltas: 18, paso: 2.8,
  padSW: [-1, -27] as [number, number], padOUT: [-1 + 18 * 2.8, -27] as [number, number] };
const TS_Z = Z_TOP + DISIPADOR.h;   // la cara de arriba del disipador (ahí van el termostato y la NTC)

export const COMPONENTES: Componente[] = [
  // ── POTENCIA (La Pluma) ───────────────────────────────────────────────────────────────────
  { ref: 'Q1', valor: 'IRFB4227', parte: 'IRFB4227PbF (200 V, 65 A, 19.7 mΩ)', desc: 'llave del buck, lado alto', grupo: 'potencia',
    enc: 'TO-220', huella: 'Package_TO_SOT_THT:TO-220-3_Vertical', montaje: 'THT',
    pines: [p('1', 'G', 'G_Q1', 'entrada'), p('2', 'D', 'BUS+', 'pasivo'), p('3', 'S', 'SW', 'pasivo')],
    pos: { x: Q1_O.x, y: Q1_O.y, giro: 90, lado: 'arriba' }, cuerpo: cuerpoTO220(90), vmax: 200, vPines: ['2', '3'] },
  { ref: 'D1', valor: 'V40200C', parte: 'V40200C-E3 (Schottky 200 V, 2 × 20 A, ánodos en paralelo)', desc: 'diodo libre del buck', grupo: 'potencia',
    enc: 'TO-220AB', huella: 'Package_TO_SOT_THT:TO-220-3_Vertical', montaje: 'THT',
    pines: [p('1', 'A1', 'GND', 'pasivo'), p('2', 'K', 'SW', 'pasivo'), p('3', 'A2', 'GND', 'pasivo')],
    pos: { x: D1_O.x, y: D1_O.y, giro: 90, lado: 'arriba' }, cuerpo: cuerpoTO220(90), vmax: 200, vPines: ['2', '1'] },
  { ref: 'D2', valor: 'SB5100', parte: 'SB5100 (Schottky 100 V 5 A, IFSM 150 A)', desc: 'salida → bus: descarga el choque cuando el arco se abre', grupo: 'potencia',
    enc: 'DO-201AD', huella: 'Diode_THT:D_DO-201AD_P15.24mm_Horizontal', montaje: 'THT',
    pines: [p('1', 'K', 'BUS+', 'pasivo'), p('2', 'A', 'OUT+', 'pasivo')],
    pos: { x: 45, y: -50, giro: 90, lado: 'arriba' }, cuerpo: { dx: 0, dy: 7.62, w: 6, d: 17, h: 6 }, vmax: 100, vPines: ['1', '2'] },
  { ref: 'L1', valor: '15 µH aire', parte: 'choque de aire: 18 vueltas cal 10 esmaltado, Ø60 × 50 (11 mΩ)', desc: 'choque del buck (no se satura)', grupo: 'potencia',
    enc: 'bobina de aire', huella: 'forja_lab:Choque_Aire_D60_L50', montaje: 'THT',
    pines: [p('1', 'SW', 'SW', 'pasivo'), p('2', 'OUT', 'OUT+', 'pasivo')],
    pos: { x: CHOQUE.padSW[0], y: CHOQUE.padSW[1], giro: 0, lado: 'arriba' },
    cuerpo: { dx: (CHOQUE.x1 - CHOQUE.x0) / 2, dy: CHOQUE.y - CHOQUE.padSW[1], w: CHOQUE.x1 - CHOQUE.x0 + 2 * CHOQUE.alambre, d: 2 * (CHOQUE.r + CHOQUE.alambre), h: 2 * (CHOQUE.r + CHOQUE.alambre), dz: CHOQUE.sube } },
  ...CE.map(([x, y], i): Componente => ({
    ref: `C${10 + i}`, valor: '2200 µF 100 V', parte: '2200 µF/100 V/105 °C snap-in Ø30 × 50, alto rizo (≥ 6 A @10 kHz+), ESR ≤ 30 mΩ', desc: `bus, electrolítico ${i + 1} de 3`, grupo: 'potencia',
    enc: 'snap-in Ø30 P10', huella: 'Capacitor_THT:CP_Radial_D30.0mm_P10.00mm_SnapIn', montaje: 'THT',
    pines: [p('1', '+', 'BUS+', 'pasivo'), p('2', '−', 'GND', 'pasivo')],
    pos: { x: x - 5, y, giro: 0, lado: 'arriba' }, cuerpo: { dx: 5, dy: 0, w: 30.5, d: 30.5, h: 52, r: 15.25 }, vmax: 100, vPines: ['1', '2'],
  })),
  ...CF_X.map((x, i): Componente => ({
    ref: `C${13 + i}`, valor: '10 µF 100 V', parte: '10 µF/100 V MKS4 P27.5 (WIMA o equivalente)', desc: `bus, película ${i + 1} de 3 (lazo de conmutación)`, grupo: 'potencia',
    enc: 'MKS4 P27.5', huella: 'Capacitor_THT:C_Rect_L31.5mm_W17.0mm_P27.50mm_MKS4', montaje: 'THT',
    pines: [p('1', '+', 'BUS+', 'pasivo'), p('2', '−', 'GND', 'pasivo')],
    pos: { x, y: CF_Y, giro: 90, lado: 'arriba' }, cuerpo: cuerpoMKS4(), vmax: 100, vPines: ['1', '2'],
  })),
  { ref: 'C16', valor: '1 µF 100 V', parte: '1 µF/100 V MKS4 P15', desc: 'Cout (salida), con D2 al bus', grupo: 'potencia',
    enc: 'MKS4 P15', huella: 'Capacitor_THT:C_Rect_L18.0mm_W8.0mm_P15.00mm_FKS3_FKP3', montaje: 'THT',
    pines: [p('1', '+', 'OUT+', 'pasivo'), p('2', '−', 'GND', 'pasivo')],
    pos: { x: -54, y: 22, giro: 0, lado: 'arriba' }, cuerpo: { dx: 7.5, dy: 0, w: 18, d: 8, h: 15 }, vmax: 100, vPines: ['1', '2'] },
  { ref: 'R30', valor: '0.5 mΩ', parte: 'shunt de manganina 4 terminales THT 0.5 mΩ ≥ 3 W (Kelvin)', desc: 'shunt de corriente del arco (en OUT−)', grupo: 'potencia',
    enc: 'shunt 4T', huella: 'forja_lab:Shunt_4T_THT_16mm', montaje: 'THT',
    pines: [p('1', 'I+', 'OUT-', 'pasivo'), p('2', 'S+', 'SH_P', 'pasivo'), p('3', 'S−', 'SH_N', 'pasivo'), p('4', 'I−', 'GND', 'pasivo')],
    pos: { x: -14, y: 0.5, giro: 0, lado: 'arriba' }, cuerpo: { dx: -8, dy: 0, w: 20, d: 6, h: 8 }, pR: 3, supuesto: 'huella propia' },
  { ref: 'U3', valor: 'INA240A2', parte: 'INA240A2D (×50, −4…80 V de modo común)', desc: 'amplificador del shunt → GP40 (25 mV/A)', grupo: 'potencia',
    enc: 'SOIC-8', huella: 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm', montaje: 'SMD', ci: true,
    pines: [p('1', 'IN+', 'SH_P', 'entrada'), p('2', 'GND', 'GND', 'pot-entrada'), p('3', 'REF2', 'GND', 'entrada'), p('4', 'NC', null, 'nc'),
      p('5', 'OUT', 'I_ARC', 'salida'), p('6', 'VS', '+3V3', 'pot-entrada'), p('7', 'REF1', 'GND', 'entrada'), p('8', 'IN−', 'SH_N', 'entrada')],
    pos: { x: -22, y: -6.3, giro: 0, lado: 'arriba' }, cuerpo: centro(4.9, 6.2, 1.75) },
  cDisc('C1', '100 nF', '+3V3', 'GND', -14, -6.3, 'sensores', 'desacoplo del INA240', 50),
  rVert('R1', '18 kΩ', 'OUT+', 'V_OUT', 38, -33, 'sensores', 'divisor de V de salida (19:1, 0–62.7 V) · también sangra Cout'),
  rVert('R2', '1 kΩ', 'V_OUT', 'GND', 38, -40, 'sensores', 'divisor de V de salida (abajo)'),
  rVert('R3', '18 kΩ', 'BUS+', 'V_BUS', 2, -63.5, 'sensores', 'divisor de V del bus (19:1)'),
  rVert('R4', '1 kΩ', 'V_BUS', 'GND', 5.5, -63.5, 'sensores', 'divisor de V del bus (abajo)'),
  // ── COMPUERTA (cara de ABAJO, bajo Q1: D2 del contrato) ─────────────────────────────────────
  { ref: 'U2', valor: 'IR2110S', parte: 'IR2110SPbF (SOIC-16W)', desc: 'driver de compuerta lado alto (bootstrap); LO libre (reserva de Q3)', grupo: 'compuerta',
    enc: 'SOIC-16W', huella: 'Package_SO:SOIC-16W_7.5x10.3mm_P1.27mm', montaje: 'SMD', ci: true,
    pines: [p('1', 'LO', null, 'salida'), p('2', 'COM', 'GND', 'pot-entrada'), p('3', 'VCC', '+12V', 'pot-entrada'), p('4', 'NC', null, 'nc'), p('5', 'NC', null, 'nc'),
      p('6', 'VS', 'SW', 'pasivo'), p('7', 'VB', 'VB', 'pasivo'), p('8', 'HO', 'HO', 'salida'), p('9', 'NC', null, 'nc'), p('10', 'NC', null, 'nc'),
      p('11', 'VDD', '+3V3', 'pot-entrada'), p('12', 'HIN', 'HIN', 'entrada', 'bajo'), p('13', 'SD', 'SD', 'entrada', 'bajo'), p('14', 'LIN', 'GND', 'entrada', 'bajo'),
      p('15', 'VSS', 'GND', 'pot-entrada'), p('16', 'NC', null, 'nc')],
    pos: { x: -46.5, y: -50, giro: 90, lado: 'abajo' }, cuerpo: centro(10.6, 10.4, 2.65), supuesto: 'pines 11–15 de la hoja' },
  smd1206('R5', '22 Ω', 'HO', 'G_Q1', -54, -47.5, 90, 'Rg (una sola, sin snubber: agente 05)', false),
  { ...smd1206('R6', '10 kΩ', 'G_Q1', 'SW', -54, -52, 90, 'Rgs: Q1 apagado si falta el driver', false), vFija: 12.4 },
  smd1206('R7', '4.7 Ω', '+12V', 'BOOT_A', -30.5, -47.5, 90, 'limita el pico del bootstrap', false),
  { ref: 'D3', valor: 'ES1D', parte: 'ES1D (200 V 1 A, 25 ns, SMA)', desc: 'diodo del bootstrap', grupo: 'compuerta',
    enc: 'SMA', huella: 'Diode_SMD:D_SMA', montaje: 'SMD', pines: [p('1', 'K', 'VB', 'pasivo'), p('2', 'A', 'BOOT_A', 'pasivo')],
    pos: { x: -34.5, y: -47.5, giro: 90, lado: 'abajo' }, cuerpo: centro(2.8, 4.4, 2.3), vmax: 200, vPines: ['1', '2'] },
  { ...smd1206('C2', '1 µF', 'VB', 'SW', -34.5, -53, 90, 'Cbs (bootstrap)', true, 50), vFija: 12.4 },
  smd1206('C3', '10 µF', '+12V', 'GND', -38, -46.5, 90, 'desacoplo VCC del IR2110', true, 25),
  smd1206('C4', '100 nF', '+3V3', 'GND', -38, -51.5, 90, 'desacoplo VDD del IR2110', true, 50),
  smd1206('R8', '10 kΩ', '+3V3', 'SD', -38, -56.5, 90, 'SD arriba = APAGADO (falla segura)', false),
  // ── SEGURIDAD (la cadena de SD: PARO aux NC → termostato de la mesa → termostato del disipador → 2N7000) ──
  { ref: 'Q2', valor: '2N7000', parte: '2N7000 (60 V, TO-92)', desc: 'el micro baja SD solo si quiere (y la cadena está cerrada)', grupo: 'seguridad',
    enc: 'TO-92', huella: 'Package_TO_SOT_THT:TO-92_Inline', montaje: 'THT',
    pines: [p('1', 'S', 'GND', 'pasivo'), p('2', 'G', 'SD_EN', 'entrada'), p('3', 'D', 'TS_R', 'pasivo')],
    pos: { x: -59, y: 4, giro: 0, lado: 'arriba' }, cuerpo: { dx: 2.54, dy: 0, w: 5.2, d: 4.2, h: 5 }, vmax: 60, vPines: ['3', '1'] },
  rVert('R9', '100 kΩ', 'SD_EN', 'GND', -51, 3, 'seguridad', 'compuerta de Q2 abajo en el reset (falla segura)'),
  { ref: 'TS1', valor: 'KSD301 90 °C NC', parte: 'KSD301 90 °C normalmente cerrado, 2 × M3 a la cara de arriba de la base del disipador', desc: 'termostato del disipador, en serie con SD', grupo: 'seguridad',
    enc: 'hilos', huella: 'forja_lab:Hilos_2_P3.0mm', montaje: 'fuera',
    pines: [p('1', '1', 'TC_R', 'pasivo'), p('2', '2', 'TS_R', 'pasivo')],
    pos: { x: -59, y: -7.5, giro: 0, lado: 'arriba' }, cuerpo: centro(16, 25, 10), pos3D: [DISIPADOR.x1 - 4, Q1_O.y + 7, TS_Z + 5] },
  // ── SENSORES ────────────────────────────────────────────────────────────────────────────────
  { ref: 'TH1', valor: 'NTC 10 k', parte: 'NTC 10 kΩ B3950, gota de epóxico', desc: 'temperatura del disipador → GP44', grupo: 'sensores',
    enc: 'hilos', huella: 'forja_lab:Hilos_2_P3.0mm', montaje: 'fuera', pines: dos('NTC_HS', 'GND'),
    pos: { x: -59, y: -2.5, giro: 0, lado: 'arriba' }, cuerpo: centro(3.2, 3.2, 3.2), pos3D: [DISIPADOR.x1 - 3, D1_O.y + 12, TS_Z + 1.6] },
  { ref: 'TH2', valor: 'NTC 10 k', parte: 'NTC 10 kΩ B3950, gota de epóxico', desc: 'temperatura del choque → GP45', grupo: 'sensores',
    enc: 'hilos', huella: 'forja_lab:Hilos_2_P3.0mm', montaje: 'fuera', pines: dos('NTC_L', 'GND'),
    pos: { x: -8, y: 9, giro: 0, lado: 'arriba' }, cuerpo: centro(3.2, 3.2, 3.2), pos3D: [(CHOQUE.x0 + CHOQUE.x1) / 2, CHOQUE.y, Z_TOP + CHOQUE.sube + 2 * (CHOQUE.r + CHOQUE.alambre) + 1.6] },
  rVert('R10', '10 kΩ', '+3V3', 'NTC_HS', 15.5, -97.5, 'sensores', 'polarización de la NTC del disipador'),
  rVert('R11', '10 kΩ', '+3V3', 'NTC_L', 15.5, -91.5, 'sensores', 'polarización de la NTC del choque'),
  rVert('R12', '10 kΩ', '+3V3', 'NTC_MESA', 15.5, -85.5, 'mesa', 'polarización de la NTC de la mesa (K11)'),
  rVert('R13', '1 kΩ', 'ENC', 'ENC_F', 15.5, -79.5, 'sensores', 'serie del AS5600 (el cable pasa junto al arco)'),
  cDisc('C5', '10 nF', 'ENC_F', 'GND', 7.5, -96, 'sensores', 'filtro del AS5600 (fc = 16 kHz)', 50),
  // ── MICRO ───────────────────────────────────────────────────────────────────────────────────
  { ref: 'U1', valor: 'WeAct RP2350B Core', parte: 'WeAct Studio RP2350B Core Board V1.0 (16 MB, USB-C) + 2 tiras 2×15 soldadas', desc: 'el micro: PWM 100 kHz, 7 ADC, UART del TMC2209, USB', grupo: 'micro',
    enc: 'módulo 41.4 × 41.1, 2 × (2×15) P2.54', huella: 'forja_lab:WeAct_RP2350B_Core', montaje: 'modulo', ci: true, desacoploInterno: true,
    pines: pinesWeAct(), pos: { x: WEACT.cx, y: WEACT.cy, giro: 90, lado: 'arriba' },
    cuerpo: { dx: 0, dy: 0, w: WEACT.d, d: WEACT.w, h: 1.6 + 3.5, dz: WEACT.altoPines } },
  // ── MOTOR DEL ALAMBRE (TMC2209, en el chorro, a la derecha del choque) ────────────────────────
  { ref: 'U4', valor: 'TMC2209 StepStick', parte: 'módulo TMC2209 (BTT V1.3 / FYSETC, Rsense 0.11 Ω) con disipador, soldado por sus pines', desc: 'NEMA 17 del alambre; StallGuard = fuerza de empuje', grupo: 'motor',
    enc: 'StepStick 15.2 × 20.3', huella: 'forja_lab:StepStick_TMC2209_DIAG', montaje: 'modulo', ci: true,
    pines: [p('1', 'EN', 'EN_MOT', 'entrada', 'bajo'), p('2', 'MS1', 'GND', 'entrada'), p('3', 'MS2', 'GND', 'entrada'), p('4', 'PDN_UART', 'PDN', 'bidir'),
      p('5', 'PDN_2', null, 'nc'), p('6', 'CLK', 'GND', 'entrada'), p('7', 'STEP', 'STEP', 'entrada', 'bajo'), p('8', 'DIR', 'DIR', 'entrada', 'bajo'),
      p('9', 'GND', 'GND', 'pot-entrada'), p('10', 'VIO', '+3V3', 'pot-entrada'), p('11', '1B', 'MOT_1B', 'salida'), p('12', '1A', 'MOT_1A', 'salida'),
      p('13', '2A', 'MOT_2A', 'salida'), p('14', '2B', 'MOT_2B', 'salida'), p('15', 'GND', 'GND', 'pot-entrada'), p('16', 'VM', '+12V', 'pot-entrada'),
      p('17', 'DIAG', 'DIAG', 'salida')],
    pos: { x: 66, y: -28, giro: 0, lado: 'arriba' }, cuerpo: { dx: 0, dy: 0, w: 15.24, d: 20.32, h: 20, dz: 2.5 }, internos: ['+3V3'], supuesto: 'pinout y Rsense del módulo' },
  { ref: 'C6', valor: '100 µF 35 V', parte: '100 µF/35 V 105 °C bajo ESR Ø8', desc: 'VM del TMC2209 (regla del StepStick)', grupo: 'motor',
    enc: 'radial Ø8 P3.5', huella: 'Capacitor_THT:CP_Radial_D8.0mm_P3.50mm', montaje: 'THT', pines: [p('1', '+', '+12V', 'pasivo'), p('2', '−', 'GND', 'pasivo')],
    pos: { x: 77, y: -22, giro: 0, lado: 'arriba' }, cuerpo: { dx: 1.75, dy: 0, w: 8.5, d: 8.5, h: 12, r: 4.25 }, vmax: 35, vPines: ['1', '2'] },
  rVert('R14', '1 kΩ', 'UART_TX', 'PDN', 76, -33.5, 'motor', 'TX → PDN_UART (UART de un hilo, hoja del TMC2209)'),
  rVert('R15', '10 kΩ', '+3V3', 'EN_MOT', 80, -33.5, 'motor', 'EN arriba = motor suelto en el reset (falla segura)'),
  // ── FUENTES ─────────────────────────────────────────────────────────────────────────────────
  { ref: 'F1', valor: '2 A T', parte: 'fusible TR5 2 A lento, SOLDADO (Littelfuse 372 o similar)', desc: 'protege la rama auxiliar (el bus no lleva fusible: la LRS limita a ~30 A)', grupo: 'fuentes',
    enc: 'TR5 P5.08', huella: 'forja_lab:Fusible_TR5_P5.08', montaje: 'THT', pines: dos('BUS+', '+48F'),
    pos: { x: 11, y: -68.5, giro: 0, lado: 'arriba' }, cuerpo: { dx: 2.54, dy: 0, w: 8.5, d: 8.5, h: 8, r: 4.25 } },
  { ref: 'PS1', valor: 'TEN 40-4812', parte: 'TRACO TEN 40-4812 (36–75 V → 12 V 3.3 A, 2 × 1 in, THT)', desc: '48 → 12 V: compuerta, ventiladores, motor', grupo: 'fuentes',
    enc: '2 × 1 in', huella: 'forja_lab:TRACO_TEN40_2x1in', montaje: 'modulo', ci: true,
    pines: [p('1', '−Vin', 'GND', 'pot-entrada'), p('2', '+Vin', '+48F', 'pot-entrada'), p('3', 'On/Off', null, 'nc'),
      p('4', '+Vout', '+12V', 'pot-salida'), p('5', 'Trim', null, 'nc'), p('6', '−Vout', 'GND', 'pot-entrada')],
    pos: { x: 71, y: 21.4, giro: 0, lado: 'arriba' }, cuerpo: centro(25.4, 50.8, 10.2), vmax: 75, vPines: ['2', '1'], supuesto: 'pinout de TRACO' },
  { ref: 'C7', valor: '47 µF 100 V', parte: '47 µF/100 V 105 °C Ø10', desc: 'entrada del TEN 40', grupo: 'fuentes',
    enc: 'radial Ø10 P5', huella: 'Capacitor_THT:CP_Radial_D10.0mm_P5.00mm', montaje: 'THT', pines: [p('1', '+', '+48F', 'pasivo'), p('2', '−', 'GND', 'pasivo')],
    pos: { x: 61, y: -10, giro: 0, lado: 'arriba' }, cuerpo: { dx: 2.5, dy: 0, w: 10.5, d: 10.5, h: 16, r: 5.25 }, vmax: 100, vPines: ['1', '2'] },
  { ref: 'PS2', valor: 'R-78E5.0-0.5', parte: 'RECOM R-78E5.0-0.5 (7–28 V → 5 V 0.5 A, SIP-3)', desc: '12 → 5 V para el pin 5V del WeAct', grupo: 'fuentes',
    enc: 'SIP-3', huella: 'forja_lab:SIP3_R78_P2.54', montaje: 'modulo', ci: true,
    pines: [p('1', 'Vin', '+12V', 'pot-entrada'), p('2', 'GND', 'GND', 'pot-entrada'), p('3', 'Vout', '+5V', 'pot-salida')],
    pos: { x: 64.5, y: -94, giro: 0, lado: 'arriba' }, cuerpo: { dx: 2.54, dy: 0, w: 11.6, d: 8.5, h: 10.4 }, vmax: 28, vPines: ['1', '2'] },
  { ...cDisc('C8', '10 µF', '+12V', 'GND', 62.5, -87.5, 'fuentes', 'entrada del R-78E', 25) },
  // ── LA MESA (K11 NTC, K12 ventilador; contrato v2) ──────────────────────────────────────────
  { ref: 'Q3', valor: 'IRLB8721', parte: 'IRLB8721PbF (30 V, 8.7 mΩ @4.5 V, nivel lógico)', desc: 'lado bajo del ventilador de la mesa (PWM GP10)', grupo: 'mesa',
    enc: 'TO-220', huella: 'Package_TO_SOT_THT:TO-220-3_Vertical', montaje: 'THT',
    pines: [p('1', 'G', 'MESA_PWM', 'entrada'), p('2', 'D', 'BOMBA-', 'pasivo'), p('3', 'S', 'GND', 'pasivo')],
    pos: { x: 63.5, y: -82, giro: 0, lado: 'arriba' }, cuerpo: cuerpoTO220(0), vmax: 30, vPines: ['2', '3'] },
  rVert('R16', '100 kΩ', 'MESA_PWM', 'GND', 63, -69, 'mesa', 'compuerta de Q3 abajo en el reset'),
  { ref: 'D4', valor: '1N5822', parte: '1N5822 (Schottky 40 V 3 A)', desc: 'rueda libre del ventilador de la mesa', grupo: 'mesa',
    enc: 'DO-201AD', huella: 'Diode_THT:D_DO-201AD_P15.24mm_Horizontal', montaje: 'THT',
    pines: [p('1', 'K', '+12V', 'pasivo'), p('2', 'A', 'BOMBA-', 'pasivo')],
    pos: { x: 63.5, y: -74.5, giro: 0, lado: 'arriba' }, cuerpo: { dx: 7.62, dy: 0, w: 17, d: 6, h: 6 }, vmax: 40, vPines: ['1', '2'] },
];
/** Lo mecánico que no va en la netlist (pero sí en la lista de materiales y en el revisor geométrico). */
export const MECANICA = [
  { ref: 'HS1', desc: 'disipador 125 × 35 × 35 (aletas al difusor), sobre la PCB; B lo detiene al frente con un tope de silicato (0.8 mm de juego)', cant: 1,
    caja: { x0: DISIPADOR.x0, x1: DISIPADOR.x1, y0: DISIPADOR.y0, y1: DISIPADOR.y1, z0: Z_TOP, z1: Z_TOP + DISIPADOR.h } },
  { ref: 'MEC1', desc: 'tornillo M3 × 10 + buje aislante + Sil-Pad (Q1 y D1 al disipador: el contacto térmico pide presión, no soldadura)', cant: 2, caja: null },
  { ref: 'MEC2', desc: 'tornillo M3 × 6 del termostato TS1 a la cara de arriba de la base del disipador (machuelo M3)', cant: 2, caja: null },
  { ref: 'MEC3', desc: 'tiras de pines macho 2×15 (WeAct) y 2×8 (TMC2209) — vienen con los módulos', cant: 4, caja: null },
  { ref: 'MEC4', desc: 'cincho de nylon de 2.5 mm por H1: amarra los hilos de fábrica del ventilador (K09)', cant: 1, caja: null },
];
/** El ventilador de la placa (B lo eligió y lo pone; C lo alimenta por K09): su corriente y su punto de operación con el
 *  camino real del aire (modelo de B en cuerpo.ts: rejillas + placa + difusor + cuna). */
export const VENTILADOR_PCB = { clase: 'AFB0812H', I: 0.25, Qm3h: 35.1, dP: 30.6, fuente: 'cuerpo.ts VENT_PCB + puntoOperacion (agente B, cierre de la ronda 2)' };
/** El riel de 12 V (DECISIONES.fuentes): compuerta + ventilador de la placa + TMC2209 + R-78E + ventilador de la mesa (K12) ≤ TEN 40. */
export const PRESUPUESTO_12V = { compuerta: 0.02, motor: 0.6, r78: 0.05, ps1: 3.3 };
/** Lo que compra C y NO va en la placa (lo ponen A o B). */
export const FUERA_DE_LA_PLACA = [
  { ref: 'TS2', valor: 'KSD9700 70 °C NC', desc: 'termostato PLANO de la mesa (clase KSD9700, 5 mm): B lo pone acostado en MESA.TERM (contrato P9); en serie en la cadena SD por K13 (J20/J21)', cant: 1 },
  { ref: 'VENT1', valor: 'AFB0812H 80×80×25 12 V 0.25 A', desc: 'ventilador de la placa (clase Delta AFB0812H): lo pone B en su cuna (bahía VENTILADOR); sus hilos de fábrica se sueldan a J12/J13 (K09, puente)', cant: 1 },
  { ref: 'TS3', valor: 'KSD301 70 °C ±3 NC', desc: 'termostato del zócalo del cuello: lo pone A (K14, J22/J23); si A ya lo tiene en su lista, no se compra dos veces', cant: 1 },
];

// ── LAS ISLAS: donde se SUELDA cada cable que sale (una isla por hilo) ──────────────────────
export interface Isla {
  ref: string; red: string; hilo: string; puerto: string | null; conexion: string | null; awg: number;
  x: number; y: number; agujero: number; pad: number; huella: string;
  /** la junta NO carga peso: abrazadera de B (cal ≤ 12) o barreno con cincho (puente) */
  alivio?: string; reserva?: boolean; tipo: TipoPin;
}
const H_CAL10 = 'MountingHole:MountingHole_3.2mm_M3_Pad_Via', H_CAL8 = 'MountingHole:MountingHole_4.3mm_M4_Pad_Via';
const H_SENAL = 'TestPoint:TestPoint_THTPad_D2.0mm_Drill1.0mm';
const ALIVIO = 'abrazadera impresa de B a ≤ 15 mm de la isla (la junta no carga el cable)';
const ALIVIO_CINCHO = 'cincho de 2.5 mm por el barreno H1 (≤ 8 mm): amarra los hilos de fábrica a la placa';
const isla = (ref: string, red: string, hilo: string, puerto: string | null, conexion: string | null, awg: number, x: number, y: number, tipo: TipoPin = 'pasivo', extra: Partial<Isla> = {}): Isla => {
  const g = awg <= 8 ? { agujero: 4.3, pad: 8, huella: H_CAL8 } : awg <= 12 ? { agujero: 3.2, pad: 6, huella: H_CAL10 } : { agujero: 1.0, pad: 2.0, huella: H_SENAL };
  return { ref, red, hilo, puerto, conexion, awg, x, y, ...g, tipo, ...(awg <= 12 ? { alivio: ALIVIO } : {}), ...extra };
};
/** paso entre islas de señal (pad 2.0 + 1.3 de aire: cabe la punta de 1 mm entre dos) */
const PASO_SENAL = 3.3;
const SEN_Y = 36;
/** C.SEN lleva 9 hilos (K07 4, K08 3, K14 2) + 1 hueco entre el motor y la señal: a 0.1 in (2.54, el paso de una tira de
 *  pines; pad 2.0 → 0.54 de aire) el grupo mide 22.9 y cae a ≤ 11.4 del eje (tol 12). A 3.3 mediría 29.7: no cabe. */
const PASO_SEN = 2.54;
const senX = (k: number) => puerto('C.SEN').pos[0] + (k - 4.5) * PASO_SEN;
const MESA_X = 82.5, mesaY = (k: number) => puerto('C.MESA').pos[1] + (k - 2.5) * PASO_SENAL;
const PARO_X = 76, paroY = (k: number) => puerto('C.PARO').pos[1] + (k - 0.5) * PASO_SENAL;
export const ISLAS: Isla[] = [
  // C.BUS (−100, 48, −60) +y: la muesca de atrás a la izquierda
  isla('J1', 'BUS+', 'V+', 'C.BUS', 'K04', 10, -98.5, 18, 'pot-salida'),   // la LRS es la fuente del bus
  isla('J2', 'GND', 'V−', 'C.BUS', 'K04', 10, -105.5, 18),
  // C.OUTP / C.OUTN: el lazo del arco sale junto (20 mm entre ejes ≤ REGLAS.lazoArco)
  isla('J3', 'OUT+', 'OUT+', 'C.OUTP', 'K05', 8, puerto('C.OUTP').pos[0], 9),
  isla('J4', 'OUT-', 'OUT−', 'C.OUTN', 'K06', 8, puerto('C.OUTN').pos[0], 9),
  isla('J5', 'MOT_1A', 'A+', 'C.SEN', 'K07', 22, senX(0), SEN_Y),
  isla('J6', 'MOT_1B', 'A−', 'C.SEN', 'K07', 22, senX(1), SEN_Y),
  isla('J7', 'MOT_2A', 'B+', 'C.SEN', 'K07', 22, senX(2), SEN_Y),
  isla('J8', 'MOT_2B', 'B−', 'C.SEN', 'K07', 22, senX(3), SEN_Y),
  isla('J9', '+3V3', '3V3', 'C.SEN', 'K08', 26, senX(5), SEN_Y),
  isla('J10', 'GND', 'GND', 'C.SEN', 'K08', 26, senX(6), SEN_Y),
  isla('J11', 'ENC', 'ENC', 'C.SEN', 'K08', 26, senX(7), SEN_Y, 'salida'),   // la salida analógica del AS5600
  // K14: el termostato del cuello viaja con K08 (señal), del lado lejos de K07
  isla('J22', 'TM_R', 'T1', 'C.SEN', 'K14', 24, senX(8), SEN_Y),
  isla('J23', 'TC_R', 'T2', 'C.SEN', 'K14', 24, senX(9), SEN_Y),
  // C.FAN (−119, 20, −50) −x: K09 puente (los hilos de fábrica del ventilador), con su cincho por H1
  isla('J12', '+12V', '+12', 'C.FAN', 'K09', 24, -111.5, 15, 'pasivo', { alivio: ALIVIO_CINCHO }),
  isla('J13', 'GND', '−', 'C.FAN', 'K09', 24, -111.5, 25, 'pasivo', { alivio: ALIVIO_CINCHO }),
  // C.PARO (85, −85, −50) +x: el par lado a lado en y (sale parejo hacia +x)
  isla('J14', 'SD', 'AUX1', 'C.PARO', 'K10', 24, PARO_X, paroY(0)),
  isla('J15', 'PARO_R', 'AUX2', 'C.PARO', 'K10', 24, PARO_X, paroY(1)),
  // C.MESA (80.5, −69, −26) +z: seis hilos en una columna (K13 termostato, K11 NTC, K12 ventilador)
  isla('J20', 'PARO_R', 'T1', 'C.MESA', 'K13', 24, MESA_X, mesaY(0)),
  isla('J21', 'TM_R', 'T2', 'C.MESA', 'K13', 24, MESA_X, mesaY(1)),
  isla('J16', 'NTC_MESA', 'NTC', 'C.MESA', 'K11', 24, MESA_X, mesaY(2)),
  isla('J17', 'GND', 'GND', 'C.MESA', 'K11', 24, MESA_X, mesaY(3)),
  isla('J18', '+12V', '+12', 'C.MESA', 'K12', 22, MESA_X, mesaY(4)),
  isla('J19', 'BOMBA-', '−', 'C.MESA', 'K12', 22, MESA_X, mesaY(5)),
];
/** Barrenos sin cobre (NPTH): el alivio de los puentes. */
export interface Barreno { ref: string; d: number; x: number; y: number; para: string; huella: string; nota: string }
export const BARRENOS: Barreno[] = [
  { ref: 'H1', d: 3.2, x: -115, y: 20, para: 'K09', huella: 'MountingHole:MountingHole_3.2mm_M3', nota: 'cincho de 2.5 mm: amarra los hilos de fábrica del ventilador a ≤ 8 mm de J12/J13' },
];
/** distancia máxima de una isla de puente a su barreno de alivio (la palanca que la junta no debe cargar) */
export const ALIVIO_PUENTE_MAX = 8;

// ── los tramos de cobre de potencia (los anchos que el ruteo en Pcbnew tiene que respetar) ───
export interface Tramo { red: string; de: string; a: string; Irms: number; ancho: number; capas: 1 | 2; oz: number; largo: number; nota?: string }
export const DT_IPC = 20;   // K: subida de temperatura declarada del cobre (IPC-2221)
export const TRAMOS: Tramo[] = [
  { red: 'BUS+', de: 'J1', a: 'C10–C12 / Q1.D / C13–C15 / D2.K / F1', Irms: 27, ancho: 20, capas: 1, oz: 2, largo: 170, nota: 'cara de ABAJO bajo el disipador (franja x −95…−62, el plano de tierra no entra) y arriba desde x −60: el frente (y −99…−42) con los 3 electrolíticos y la fila + de las películas; una lengua (y −58…−45) llega a D2.K bajo el choque' },
  { red: 'SW', de: 'Q1.S / D1.K', a: 'L1.1', Irms: 40, ancho: 18, capas: 1, oz: 2, largo: 60, nota: 'entre las filas de pines de las películas (y −40…−12.3) y sale a la derecha a L1.1 (−1, −27)' },
  { red: 'OUT+', de: 'L1.2', a: 'J3 / C16 / D2.A / R1', Irms: 40, ancho: 17, capas: 1, oz: 2, largo: 160, nota: 'baja por la derecha del choque (x 36…53, y −35…31) y corre detrás de J3/J4 (franja y 14…31) hasta J3 y C16' },
  { red: 'OUT-', de: 'J4', a: 'R30.I+', Irms: 40, ancho: 18, capas: 1, oz: 2, largo: 15 },
  { red: 'GND', de: 'R30.I− / C10–C15 / D1.A', a: 'J2', Irms: 40, ancho: 80, capas: 1, oz: 2, largo: 150, nota: 'plano de la cara de abajo (todo menos la franja del bus)' },
  { red: '+48F', de: 'F1', a: 'PS1', Irms: 0.6, ancho: 0.6, capas: 1, oz: 2, largo: 100 },
  { red: '+12V', de: 'PS1', a: 'U2 / U4 / PS2 / J12 / J18', Irms: 2.0, ancho: 1.5, capas: 1, oz: 2, largo: 300, nota: 'por la orilla de atrás hasta la muesca (J12) y por el canal x 53…58 hacia el frente' },
  { red: 'MOT_1A', de: 'U4', a: 'J5', Irms: 1.4, ancho: 0.8, capas: 1, oz: 2, largo: 70, nota: 'Irms = el tope de K07' },
  { red: 'BOMBA-', de: 'Q3.D', a: 'J19', Irms: 1.0, ancho: 1.0, capas: 1, oz: 2, largo: 25 },
];

/** Los pines del RP2350B que usa la placa (los revisa revisarPines de plumaSistema, contra el SDK). */
export const PINES_PLACA: PinMCU[] = [
  { gpio: 0, tipo: 'pwm', frec: 100e3, va: 'IR2110 HIN → Q1', nota: 'slice 0 A · 1500 niveles' },
  { gpio: 1, tipo: 'salida', va: 'SD_EN → 2N7000 (la cadena SD)' },
  { gpio: 2, tipo: 'salida', va: 'TMC2209 STEP (PIO)' },
  { gpio: 3, tipo: 'salida', va: 'TMC2209 DIR' },
  { gpio: 4, tipo: 'uart-tx', uart: 1, va: 'TMC2209 PDN_UART (TX por 1 kΩ)' },
  { gpio: 5, tipo: 'uart-rx', uart: 1, va: 'TMC2209 PDN_UART (RX)' },
  { gpio: 6, tipo: 'salida', va: 'TMC2209 EN (pull-up 10 k)' },
  { gpio: 7, tipo: 'entrada', va: 'TMC2209 DIAG (StallGuard)' },
  { gpio: 8, tipo: 'entrada', va: 'lee SD: la cadena PARO/termostatos abierta' },
  { gpio: 10, tipo: 'pwm', frec: 25e3, va: 'MESA_PWM → Q3 (ventilador de la mesa)', nota: 'slice 5 A' },
  { gpio: 40, tipo: 'adc', va: 'I del arco · INA240A2 ×50 sobre 0.5 mΩ = 25 mV/A (tope 132 A)' },
  { gpio: 41, tipo: 'adc', va: 'V de salida · divisor 19:1 (0–62.7 V)' },
  { gpio: 42, tipo: 'adc', va: 'V del bus · divisor 19:1' },
  { gpio: 43, tipo: 'adc', va: 'AS5600 analógico (el alambre real)' },
  { gpio: 44, tipo: 'adc', va: 'NTC 10 k del disipador' },
  { gpio: 45, tipo: 'adc', va: 'NTC 10 k del choque' },
  { gpio: 46, tipo: 'adc', va: 'NTC 100 k de la mesa (K11)' },
];

// ── EL MOTOR: la corriente del TMC2209 (K07 a 12 V; A corre 0.85 A rms, tope 1.4) ───────────────
/** Hoja del TMC2209 (§ «Selecting sense resistors»): I_rms = (CS+1)/32 · V_fs/(R_sense + 0.02 Ω) · 1/√2, con V_fs = 0.325 V
 *  (vsense 0) o 0.180 V (vsense 1), escalada por VREF/2.5 V si i_scale_analog = 1. RDS(on) típica 0.17 Ω por llave (25 °C). */
export const TMC2209 = { rsense: 0.11, rInterna: 0.02, vfs: { 0: 0.325, 1: 0.180 } as Record<0 | 1, number>, rdsOn: 0.17, vrefFS: 2.5 };
export function corrienteTMC2209(cs: number, vsense: 0 | 1, rsense = TMC2209.rsense, vref = TMC2209.vrefFS): number {
  return ((cs + 1) / 32) * ((TMC2209.vfs[vsense] * vref) / TMC2209.vrefFS) / (rsense + TMC2209.rInterna) / Math.SQRT2;
}
/** Pérdidas del chip: dos bobinas, cada una por una llave alta y una baja (2·I²·2·RDS(on)). */
export const pTMC2209 = (Irms: number) => 2 * Irms * Irms * 2 * TMC2209.rdsOn;
const K07 = CONEXIONES.find((k) => k.id === 'K07');
/** lo que corre A (contrato K07, nota de la ronda 2) y el tope del TMC2209 (contrato K07, Irms) */
export const I_MOTOR_A = 0.85;
export const I_MOTOR_TOPE = K07?.Irms ?? 1.4;
export interface Motor { vsense: 0 | 1; irun: number; ihold: number; iScaleAnalog: 0 | 1; vrefRespaldo: number; VM: number }
/** El CS más cercano a I_MOTOR_A con vsense = 1 (la escala chica: el máximo físico queda bajo el tope). */
export function elegirMotor(I = I_MOTOR_A): Motor {
  const vsense: 0 | 1 = 1;
  const ifs = corrienteTMC2209(31, vsense);
  const irun = Math.max(0, Math.min(31, Math.round((32 * I) / ifs) - 1));
  const ihold = Math.max(0, Math.round((irun + 1) / 2) - 1);
  const vrefRespaldo = Math.round(((TMC2209.vrefFS * I) / corrienteTMC2209(31, 0)) * 100) / 100;
  return { vsense, irun, ihold, iScaleAnalog: 0, vrefRespaldo, VM: K07?.V ?? 12 };
}
export const MOTOR: Motor = elegirMotor();

export interface Placa { componentes: Componente[]; islas: Isla[]; barrenos: Barreno[]; redes: Red[]; tramos: Tramo[]; pines: PinMCU[]; motor: Motor; zTop: number }
export const PLACA: Placa = { componentes: COMPONENTES, islas: ISLAS, barrenos: BARRENOS, redes: REDES, tramos: TRAMOS, pines: PINES_PLACA, motor: MOTOR, zTop: Z_TOP };
export const clonarPlaca = (pl: Placa = PLACA): Placa => JSON.parse(JSON.stringify(pl));

// ════════════════════════════════════════════════════════════════════════════════════════════
// 3. FÓRMULAS (el juez)
// ════════════════════════════════════════════════════════════════════════════════════════════
/** IPC-2221: I = k·ΔT^0.44·A^0.725 (A en mil², k = 0.048 externa / 0.024 interna) → ancho en mm de una capa de `oz`. */
export function anchoIPC2221(I: number, dT: number, oz: number, externa = true): number {
  const k = externa ? 0.048 : 0.024;
  const A = Math.pow(I / (k * Math.pow(dT, 0.44)), 1 / 0.725);   // mil²
  return (A / (1.378 * oz)) * 0.0254;                              // 1 oz = 1.378 mil
}
/** IPC-2221 al revés: la subida de temperatura de un ancho dado. */
export function dTIPC2221(I: number, anchoMm: number, oz: number, externa = true): number {
  const k = externa ? 0.048 : 0.024, A = (anchoMm / 0.0254) * 1.378 * oz;
  return Math.pow(I / (k * Math.pow(A, 0.725)), 1 / 0.44);
}
/** Diámetro del conductor trenzado (mm): sólido AWG × 1.15. */
export const dConductor = (awg: number) => 0.127 * Math.pow(92, (36 - awg) / 39) * 1.15;
/** Diámetro exterior del cable (contrato → plumaSistema.CALIBRES). */
export const odCable = (awg: number) => CALIBRES[String(awg) as Calibre]?.od ?? 1.2;
/** Lazo de conmutación → pico en D1 (agente 05, ngspice: 15 nH → 63 V, 30 nH → 98.9 V a 40 A; +31 V con picos de 70 A). */
export function picoD1(Lnh: number, conPicos = true): number {
  const v40 = 63 + ((98.9 - 63) / (30 - 15)) * (Lnh - 15);
  return v40 + (conPicos ? 31 : 0);
}
/** Inductancia del lazo: paquetes (IRFB4227: LD 4.5 + LS 7.5 nH; TO-220AB ~8 nH) + vaciados apilados µ0·h·ℓ/w. */
export function lazoNh(largoMm: number, anchoMm: number, sepMm = 1.6): number {
  return 4.5 + 7.5 + 8 + (4 * Math.PI * 1e-7 * (sepMm * 1e-3) * (largoMm * 1e-3)) / (anchoMm * 1e-3) * 1e9;
}

// ── el rizo del bus con el MNA de La Pluma (+ ESL de cada rama) ─────────────────────────────
export interface RamaBus { id: 'Cbus' | 'Cfilm' | 'Cpol'; C: number; esr: number; esl: number; n: number }
export const CE_SPEC = { C: 2200e-6, esr: 0.030, esl: 18e-9, Irip: 6.0, theta: 13, L0: 5000, Tr: 105, Tlim: 85, Tmax: 105 };
export const CF_SPEC = { C: 10e-6, esr: 0.0045, esl: 12e-9, Irip: 5.0 };
export const BANCO_PLACA: RamaBus[] = [
  { id: 'Cbus', C: CE_SPEC.C, esr: CE_SPEC.esr, esl: CE_SPEC.esl, n: 3 }, { id: 'Cfilm', C: CF_SPEC.C, esr: CF_SPEC.esr, esl: CF_SPEC.esl, n: 3 }];
export const BANCO_V3: RamaBus[] = [
  { id: 'Cbus', C: 2200e-6, esr: 0.025, esl: 20e-9, n: 2 }, { id: 'Cfilm', C: 10e-6, esr: 0.0045, esl: 12e-9, n: 3 }];
/**
 * Corre el buck de plumaSistema con el bus partido en ramas C–ESL–ESR (+ la pista entre el banco y la celda).
 * Devuelve el rms de cada rama y por pieza. Es el mismo MNA (spice.ts) y el mismo firmware (PI por periodo).
 */
export function rizoBus(ramas: RamaBus[], opt: { Iref?: number; Varc?: number; ms?: number; Lpista?: number } = {}) {
  const Iref = opt.Iref ?? 40, Varc = opt.Varc ?? 21, ms = opt.ms ?? 3, Lpista = opt.Lpista ?? 6e-9;
  const pp: PlumaParams = { ...PLUMA };
  const s = crearPlumaSim(pp);
  const base = s.c.elements.filter((e) => !['Cbus', 'Resr', 'Cfilm', 'Rfilm'].includes(e.id));
  const extra: Element[] = [{ kind: 'R', id: 'Rnc3', a: 3, b: 0, value: 1e6 }, { kind: 'R', id: 'Rnc4', a: 4, b: 0, value: 1e6 }];
  let nodo = 12;
  const v0: Record<number, number> = {};
  const nb = Lpista > 0 ? ++nodo : 2;
  if (Lpista > 0) { extra.push({ kind: 'L', id: 'Lpista', a: 2, b: nb, value: Lpista }); v0[nb] = pp.Vlrs; }
  for (const r of ramas) {
    const top = r.id === 'Cbus' ? nb : 2, a = ++nodo, b = ++nodo;
    extra.push({ kind: 'C', id: r.id, a: top, b: a, value: r.C * r.n, ic: pp.Vlrs });
    extra.push({ kind: 'L', id: 'L' + r.id, a, b, value: Math.max(1e-12, r.esl / r.n) });
    extra.push({ kind: 'R', id: 'R' + r.id, a: b, b: 0, value: r.esr / r.n });
  }
  s.c = { nodeCount: nodo, elements: [...base, ...extra] };
  const v = new Array(nodo + 1).fill(0);
  for (let k = 0; k < s.st.v.length; k++) v[k] = s.st.v[k];
  for (const [k, x] of Object.entries(v0)) v[+k] = x;
  const hist = new Map<string, { v: number; i: number }>();
  for (const r of ramas) hist.set(r.id, { v: pp.Vlrs, i: 0 });
  s.st = { t: 0, v, vsrcI: new Map(), hist };
  const pasos = Math.round((ms * 1e-3) / s.dt), acc: Record<string, number> = {};
  let n = 0, sI = 0;
  for (let k = 0; k < pasos; k++) {
    pasoPluma(s, Varc, Iref, false);
    if (k > pasos * 0.6) {
      n++; sI += s.Iout;
      for (const r of ramas) { const i = s.st.hist.get(r.id)?.i ?? 0; acc[r.id] = (acc[r.id] ?? 0) + i * i; }
    }
  }
  const ramasOut = ramas.map((r) => { const I = Math.sqrt((acc[r.id] ?? 0) / Math.max(1, n)); return { id: r.id, n: r.n, Irms: I, porPieza: I / r.n }; });
  return { I: sI / Math.max(1, n), ramas: ramasOut, P: { ...s.P } };
}
/** Lo que el MNA dio para el banco de la placa (la prueba lo vuelve a correr y compara). */
export const RIZO_DISENO = { I40: { porCap: 4.82, film: 2.88 }, I45: { porCap: 5.41, film: 2.88 }, v3: { porCap: 6.69 } };
/** Vida del electrolítico (Arrhenius, ×2 cada 10 K) con su núcleo a Ta + I²·ESR·θ. */
export function vidaElectrolitico(Irms: number, Ta: number) {
  const P = Irms * Irms * CE_SPEC.esr, Tn = Ta + P * CE_SPEC.theta;
  return { P, Tnucleo: Tn, horas: CE_SPEC.L0 * Math.pow(2, (CE_SPEC.Tr - Tn) / 10) };
}

// ── el disipador en el chorro del difusor ───────────────────────────────────────────────────
const solape = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
/** ancho de la boca del ventilador (contrato, bahía VENTILADOR: 80 en y) */
export const VENT_ANCHO = bahia('VENTILADOR').caja.y1 - bahia('VENTILADOR').caja.y0;
/** el caudal al que plumaSistema toma θSA 0.7 K/W: el del contrato (bahía DIFUSOR, ~37 m³/h a 11 Pa), m³/s */
export const Q_REF = 37 / 3600;
/** el caudal de operación REAL: el modelo de B con las rejillas, la placa (K 1.5), el difusor y la cuna (cuerpo.ts), con el
 *  ventilador de 0.25 A: 35.1 m³/h a 30.6 Pa (el de 0.15 A daba 26.1). Es el número del que modeló el camino del aire. */
export const Q_OPER = VENTILADOR_PCB.Qm3h / 3600;
/** largo del disipador dentro del chorro: con el difusor, la boca del DIFUSOR; sin él, la del ventilador */
export function largoEnChorro(conDifusor = true, hs: { y0: number; y1: number } = DISIPADOR): number {
  const b = bahia(conDifusor ? 'DIFUSOR' : 'VENTILADOR').caja;
  return solape(hs.y0, hs.y1, b.y0, b.y1);
}
/**
 * θSA del disipador con `Lc` mm de su largo en el chorro y el caudal Q (SUPUESTO; se mide en E1).
 * Referencia (plumaSistema): 0.7 K/W con TODO el largo a la velocidad propia del ventilador de 80; 2.2 K/W al aire quieto.
 * Entre aletas el flujo es laminar (Re ≈ 300) → h ∝ v^½ (capa límite de Pohlhausen). El mismo caudal repartido en Lc
 * va a v = (Q/Qref)·(80/Lc): G = (Lc/L)·√v/θ_vent + (1 − Lc/L)/θ_aire.
 */
export function thetaDisipador(Lc: number, Q = Q_OPER, Qref = Q_REF): number {
  const L = DISIPADOR.largo, Lcc = Math.max(0, Math.min(L, Lc)), f = Lcc / L;
  const tv = TERMICO.disipador.thetaSA_vent, ta = TERMICO.disipador.thetaSA_aire;
  if (f <= 0 || Q <= 0) return ta;
  const v = (Q / Qref) * (VENT_ANCHO / Lcc);
  return 1 / ((f * Math.sqrt(v)) / tv + (1 - f) / ta);
}
export const LC_DISIPADOR = largoEnChorro(true);
/** KSD301: tolerancia de disparo común del catálogo (±5 K; SUPUESTO hasta tener el que se compre) */
export const TOL_TERMOSTATO = 5;
/** el caudal que deja al disipador en `Tmax` con `Phs` W (bisección sobre thetaDisipador), m³/s */
export function caudalNecesario(Tmax: number, Phs: number, Lc = LC_DISIPADOR, Ta = TERMICO.Ta): number {
  const thMax = (Tmax - Ta) / Phs;
  if (thetaDisipador(Lc, 1e3 * Q_REF) > thMax) return Infinity;
  let a = 1e-6, b = 1e3 * Q_REF;
  for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (thetaDisipador(Lc, m) > thMax) a = m; else b = m; }
  return b;
}
/** dilatación y tolerancias del frente del disipador contra el tope de B: lo fijan Q1/D1 (sus tornillos) */
export const ALFA_AL = 23e-6, TOL_CUNA = { corteYBarrenos: 0.3, impresionB: 0.2, contornoPCB: 0.1 };
export function juegoCunaNecesario(y0 = DISIPADOR.y0, Tmax = TERMOSTATO_C, Tmontaje = 20): number {
  const yFijo = (Q1_O.y + D1_O.y) / 2 + 2.54;   // entre los agujeros de las aletas de Q1 y D1
  return ALFA_AL * (yFijo - y0) * (Tmax - Tmontaje) + TOL_CUNA.corteYBarrenos + TOL_CUNA.impresionB + TOL_CUNA.contornoPCB;
}

// ── térmica por pieza ─────────────────────────────────────────────────────────────────────
export interface Perdidas { Q1: number; D1: number; L1: number; R30: number; U4: number; PS1: number; U2: number; Ce: number }
/** Peor caso honesto: Q1 del ngspice del agente 05 (Rg 22 Ω); D1 y choque del MNA de plumaSistema a 40 A; el TMC2209 al tope. */
export const PERDIDAS_PEOR: Perdidas = { Q1: 39.2, D1: 14.7, L1: 18.3, R30: 40 * 40 * 0.0005, U4: pTMC2209(I_MOTOR_TOPE), PS1: 12 * 1.9 * (1 / 0.89 - 1), U2: 0.15, Ce: 4.82 * 4.82 * CE_SPEC.esr };
/** Lo que mide plumaSistema (MNA, trf 60 ns) a 40 A con este banco; el motor a lo que corre A. */
export const PERDIDAS_SIM: Perdidas = { ...PERDIDAS_PEOR, Q1: 13.9, D1: 14.4, L1: 18.1, U4: pTMC2209(corrienteTMC2209(MOTOR.irun, MOTOR.vsense)) };
export const AIRE = { Ta: TERMICO.Ta, Q: Q_OPER, WporK: 1.2 * 1005 * Q_OPER };   // ρ·cp·Q del ventilador de 80 (modelo de B)
export const THETA = {
  hsVent: thetaDisipador(LC_DISIPADOR), hsAire: TERMICO.disipador.thetaSA_aire,   // K/W (SUPUESTO: ver thetaDisipador)
  Q1: TERMICO.Q1.thetaJC + TERMICO.Q1.thetaCS, D1: TERMICO.D1.thetaJC + TERMICO.D1.thetaCS,
  Lvent: TERMICO.L.theta_vent, Laire: TERMICO.L.theta_aire, R30: 30, U4: 40, PS1: 8, U2: 75,
  pinTO220: 2.0,                             // de la cápsula a la junta de la pata (≈ 5 mm de pata de 0.8 × 1.3)
};
export const TERMOSTATO_C = 90;
export interface Temp { pieza: string; P: number; T: number; lim: number; max: number; estado: 'ok' | 'caliente' | 'se quema'; nota?: string }
/** `Q` = el caudal del ventilador (m³/s); por omisión el de operación (cambia θSA del disipador y lo que sube el aire) */
export function termicaPlaca(P: Perdidas = PERDIDAS_PEOR, ventilador = true, Q = AIRE.Q): Temp[] {
  const Ta = AIRE.Ta, k = 1.2 * 1005 * Q;
  const Phs = P.Q1 + P.D1;
  const aireTrasHs = Ta + Phs / k, aireTrasTodo = aireTrasHs + (P.L1 + P.R30 + P.PS1 + P.U4) / k;
  const thHs = ventilador ? thetaDisipador(LC_DISIPADOR, Q) : THETA.hsAire;
  const Ths = Ta + Phs * thHs;
  const TL = aireTrasHs + P.L1 * (ventilador ? THETA.Lvent : THETA.Laire);
  const Tq1 = Ths + P.Q1 * THETA.Q1, Td1 = Ths + P.D1 * THETA.D1;
  const vida = vidaElectrolitico(Math.sqrt(P.Ce / CE_SPEC.esr), aireTrasHs);
  // la junta de la pata del choque: el cobre de la pata (cal 10, 10 mm) contra el vaciado (~20 K/W)
  const thPata = 0.010 / (400 * 5.26e-6), thVaciado = 20;
  const Tplaca = aireTrasTodo + dTIPC2221(40, 16, 2);
  const TjuntaL = Tplaca + (TL - Tplaca) * thVaciado / (thPata + thVaciado);
  const TjuntaIsla = aireTrasTodo + dTIPC2221(40, 16, 2) + 0.08 * 20;
  const out: Array<Omit<Temp, 'estado'>> = [
    { pieza: 'disipador', P: Phs, T: Ths, lim: TERMOSTATO_C, max: 110, nota: `θSA ${thHs.toFixed(2)} K/W (${ventilador ? `${LC_DISIPADOR.toFixed(0)} de ${DISIPADOR.largo} mm en el chorro del difusor` : 'sin ventilador'}); el termostato corta a ${TERMOSTATO_C} °C` },
    { pieza: 'Q1 (unión)', P: P.Q1, T: Tq1, lim: TERMICO.Q1.lim, max: TERMICO.Q1.max },
    { pieza: 'D1 (unión)', P: P.D1, T: Td1, lim: TERMICO.D1.lim, max: TERMICO.D1.max },
    { pieza: 'L1 choque', P: P.L1, T: TL, lim: TERMICO.L.lim, max: TERMICO.L.max },
    { pieza: 'C10–C12 (núcleo)', P: P.Ce, T: vida.Tnucleo, lim: CE_SPEC.Tlim, max: CE_SPEC.Tmax, nota: `vida ${Math.round(vida.horas / 1000)} kh` },
    { pieza: 'R30 shunt', P: P.R30, T: aireTrasTodo + P.R30 * THETA.R30, lim: 120, max: 150 },
    { pieza: 'U4 TMC2209', P: P.U4, T: aireTrasTodo + P.U4 * THETA.U4, lim: 120, max: 150, nota: 'pre-aviso del chip a 120 °C' },
    { pieza: 'PS1 TEN 40', P: P.PS1, T: aireTrasTodo + P.PS1 * THETA.PS1, lim: 95, max: 105 },
    { pieza: 'U2 IR2110', P: P.U2, T: Ths * 0.5 + aireTrasTodo * 0.5 + P.U2 * THETA.U2, lim: 125, max: 150, nota: 'abajo, bajo Q1' },
    { pieza: 'junta J3/J4 (cal 8)', P: 0.08, T: TjuntaIsla, lim: 85, max: 110, nota: 'estaño: T/Tf < 0.75 con la junta sin carga' },
    { pieza: 'junta de la pata del choque', P: 0, T: TjuntaL, lim: 85, max: 110, nota: 'la junta más caliente de la placa' },
    { pieza: 'junta de las patas de Q1/D1', P: 0, T: (Ths + Tplaca) / 2 + 5, lim: 85, max: 110 },
  ];
  return out.map((x): Temp => ({ ...x, estado: x.T > x.max ? 'se quema' : x.T > x.lim ? 'caliente' : 'ok' }));
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 4. GEOMETRÍA: cajas en el mundo, patas, encimados, subidas de cable a los puertos
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface Caja3 { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; r?: number; cx: number; cy: number }
export function cajaComp(c: Componente, zTop = Z_TOP): Caja3 {
  if (c.montaje === 'fuera' && c.pos3D) {
    const [x, y, z] = c.pos3D, b = c.cuerpo;
    return { x0: x - b.w / 2, x1: x + b.w / 2, y0: y - b.d / 2, y1: y + b.d / 2, z0: z - b.h / 2, z1: z + b.h / 2, cx: x, cy: y };
  }
  const b = c.cuerpo, cx = c.pos.x + b.dx, cy = c.pos.y + b.dy, dz = b.dz ?? 0;
  const [z0, z1] = c.pos.lado === 'arriba' ? [zTop + dz, zTop + dz + b.h] : [zTop - ESPESOR - dz - b.h, zTop - ESPESOR - dz];
  return { x0: cx - b.w / 2, x1: cx + b.w / 2, y0: cy - b.d / 2, y1: cy + b.d / 2, z0, z1, r: b.r, cx, cy };
}
function seEnciman(a: Caja3, b: Caja3, holgura = 0): boolean {
  if (a.z1 <= b.z0 + 1e-6 || b.z1 <= a.z0 + 1e-6) return false;   // uno encima del otro (el choque levantado sobre D2)
  if (a.r && b.r) return Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r + holgura;
  const circ = a.r ? a : b.r ? b : null, rect = a.r ? b : a;
  if (circ && circ.r) {
    const qx = Math.max(rect.x0, Math.min(circ.cx, rect.x1)), qy = Math.max(rect.y0, Math.min(circ.cy, rect.y1));
    return Math.hypot(circ.cx - qx, circ.cy - qy) < circ.r + holgura;
  }
  return a.x0 < b.x1 + holgura && b.x0 < a.x1 + holgura && a.y0 < b.y1 + holgura && b.y0 < a.y1 + holgura;
}
/** distancia en planta de un punto a una caja (0 si está adentro) */
const distCaja = (c: Caja3, x: number, y: number) => c.r ? Math.max(0, Math.hypot(c.cx - x, c.cy - y) - c.r)
  : Math.hypot(x - Math.max(c.x0, Math.min(x, c.x1)), y - Math.max(c.y0, Math.min(y, c.y1)));
const enPlanta = (c: Caja3, x: number, y: number, r: number) => distCaja(c, x, y) < r;
/** ¿la caja cabe en la bahía de C? enBahia() del contrato en una rejilla 3×3×3 de la caja + cero volumen en lo cedido */
export function cajaEnBahia(k: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }): boolean {
  for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.5, 1]) for (const fz of [0, 0.5, 1]) {
    const pt: V3 = [k.x0 + fx * (k.x1 - k.x0), k.y0 + fy * (k.y1 - k.y0), k.z0 + fz * (k.z1 - k.z0)];
    if (!enBahia(pt, BAHIA_PCB, 1e-6)) return false;
  }
  return (BAHIA_PCB.cede ?? []).every((c) => traslape(k as Caja, c) <= 1e-9);
}

/** Las patas THT de cada pieza en el mundo (x, y, radio del anillo): de la huella de KiCad o de las propias. */
export interface Pata { ref: string; n: string; x: number; y: number; r: number }
/** KiCad (Y abajo, giro antihorario visto desde arriba) → desplazamiento en el mundo (Y arriba). */
const girar = (giro: number, a: number, b: number): [number, number] => {
  const g = ((giro % 360) + 360) % 360;
  return g === 90 ? [b, a] : g === 180 ? [-a, b] : g === 270 ? [-b, -a] : [a, -b];
};
/** pads de las huellas estándar que usa la placa: (x, y) locales de KiCad y radio del anillo */
function padsEstandar(c: Componente): Array<{ n: string; x: number; y: number; r: number }> | null {
  const h = c.huella, fila = (paso: number, n: number, r: number) => Array.from({ length: n }, (_, k) => ({ n: String(k + 1), x: paso * k, y: 0, r }));
  if (h.includes('TO-220-3_Vertical')) return fila(2.54, 3, 1.2);
  if (h.includes('TO-92_Inline')) return fila(1.27, 3, 0.7);
  if (h.includes('P27.50mm_MKS4')) return fila(27.5, 2, 1.5);
  if (h.includes('P15.00mm_FKS3')) return fila(15, 2, 1.2);
  if (h.includes('SnapIn')) return fila(10, 2, 1.6);
  if (h.includes('CP_Radial_D8.0mm_P3.50mm')) return fila(3.5, 2, 0.9);
  if (h.includes('CP_Radial_D10.0mm_P5.00mm')) return fila(5, 2, 1.0);
  if (h.includes('C_Disc_D5.0mm')) return fila(5, 2, 0.8);
  if (h.includes('R_Axial_DIN0207') && h.includes('P2.54mm')) return fila(2.54, 2, 0.8);
  if (h.includes('DO-201AD_P15.24mm')) return fila(15.24, 2, 1.5);
  return null;
}
export function patasTHT(pl: Placa = PLACA): Pata[] {
  const hp = huellasPropias(pl), out: Pata[] = [];
  for (const c of pl.componentes) {
    if (c.montaje === 'SMD') continue;
    const prop = c.huella.startsWith('forja_lab:') ? hp[c.huella.split(':')[1]] : undefined;
    const pads = prop ? prop.pads.map((q) => ({ n: q.n, x: q.x, y: q.y, r: q.d / 2 })) : padsEstandar(c);
    if (!pads) continue;
    for (const q of pads) { const [dx, dy] = girar(c.pos.giro, q.x, q.y); out.push({ ref: c.ref, n: q.n, x: c.pos.x + dx, y: c.pos.y + dy, r: q.r }); }
  }
  for (const is of pl.islas) out.push({ ref: is.ref, n: '1', x: is.x, y: is.y, r: is.pad / 2 });
  for (const b of pl.barrenos) out.push({ ref: b.ref, n: '', x: b.x, y: b.y, r: b.d / 2 });
  return out;
}

/** Tolerancia declarada de isla ↔ puerto, en el plano de la cara (mm): 1 hilo, par, grupo. */
export const TOL_PUERTO = { solo: 3, par: 6, grupo: 12, usb: 1.5 };
export interface Subida { isla: string; puerto: string; puntos: V3[]; lateral: number; tol: number; retiro: number; R: number; tramoRecto: number; ok: boolean; texto: string }
/** La ruta del cable DENTRO de mi bahía: sube recto de la isla, dobla 90° con R ≥ k·OD y sale perpendicular a la cara. */
export function subidaAlPuerto(is: Isla, pl: Placa = PLACA): Subida | null {
  if (!is.puerto) return null;
  const pt = puerto(is.puerto), nHilos = pl.islas.filter((x) => x.puerto === is.puerto).length;
  const tol = nHilos >= 3 ? TOL_PUERTO.grupo : nHilos === 2 ? TOL_PUERTO.par : TOL_PUERTO.solo;
  const R = REGLAS.dobladoMinK * odCable(is.awg), z0 = pl.zTop, [dx, dy, dzp] = pt.dir;
  if (dzp > 0.5) {   // puerto en la cara de arriba: sube derecho
    const lateral = Math.hypot(is.x - pt.pos[0], is.y - pt.pos[1]);
    const ok = lateral <= tol;
    return { isla: is.ref, puerto: is.puerto, puntos: [[is.x, is.y, z0], [is.x, is.y, pt.pos[2]]], lateral, tol, retiro: 0, R, tramoRecto: pt.pos[2] - z0, ok,
      texto: `${is.ref} → ${is.puerto}: sube ${(pt.pos[2] - z0).toFixed(0)} mm derecho, ${lateral.toFixed(1)} mm del eje (tol ${tol})` };
  }
  // cara lateral: n = dir (afuera), la cara está en la coordenada del puerto
  const eje = Math.abs(dx) > 0.5 ? 0 : 1, s = eje === 0 ? Math.sign(dx) : Math.sign(dy);
  const cara = pt.pos[eje], pos = eje === 0 ? is.x : is.y, latC = eje === 0 ? is.y : is.x, latP = eje === 0 ? pt.pos[1] : pt.pos[0];
  const retiro = s * (cara - pos), lateral = Math.abs(latC - latP), zP = pt.pos[2], tramoRecto = zP - R - z0;
  const ok = lateral <= tol && retiro >= R && tramoRecto >= 0;
  const puntos: V3[] = [[is.x, is.y, z0], [is.x, is.y, zP - R]];
  for (let k = 1; k <= 8; k++) {
    const a = (k / 8) * (Math.PI / 2), avance = R * (1 - Math.cos(a)), z = zP - R + R * Math.sin(a);
    puntos.push(eje === 0 ? [is.x + s * avance, is.y, z] : [is.x, is.y + s * avance, z]);
  }
  puntos.push(eje === 0 ? [cara, is.y, zP] : [is.x, cara, zP]);
  return { isla: is.ref, puerto: is.puerto, puntos, lateral, tol, retiro, R, tramoRecto, ok,
    texto: `${is.ref} → ${is.puerto}: retiro ${retiro.toFixed(1)} mm (R ${R.toFixed(1)}), sube ${Math.max(0, tramoRecto).toFixed(1)} mm antes de doblar, ${lateral.toFixed(1)} mm del puerto (tol ${tol})` };
}
/** la ruta muestreada cada ≤ `paso` mm (para buscar choques en TODO el cable, no sólo en sus vértices) */
export function muestrear(puntos: V3[], paso = 1.5): V3[] {
  const out: V3[] = [puntos[0]];
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(L / paso));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2] + ((b[2] - a[2]) * k) / n]);
  }
  return out;
}
/** El USB-C del WeAct: centro de su boca (marco del mundo). */
export function bocaUSB(pl: Placa = PLACA): V3 {
  const u = pl.componentes.find((c) => c.ref === 'U1');
  const cx = u ? u.pos.x : WEACT.cx, cy = u ? u.pos.y : WEACT.cy;
  return [cx, cy - WEACT.w / 2 - 0.5, pl.zTop + WEACT.altoPines + 1.6 + 1.6];
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 5. LA CADENA DE APAGADO (SD): cada eslabón en serie, y abrir cualquiera apaga sin el micro
// ════════════════════════════════════════════════════════════════════════════════════════════
/** los interruptores de la cadena que viven FUERA de la placa: sus dos islas son sus dos terminales */
const valorFuera = (ref: string) => FUERA_DE_LA_PLACA.find((f) => f.ref === ref)?.valor ?? ref;
/** (el valor de cada termostato sale de FUERA_DE_LA_PLACA: si A vuelve a elegir el del cuello, el texto lo sigue) */
export const INTERRUPTORES_FUERA: Record<string, string> = { K10: 'contacto auxiliar NC del PARO', K13: `termostato ${valorFuera('TS2')} de la mesa`, K14: `termostato ${valorFuera('TS3')} del cuello` };
/** los eslabones de la cadena, en orden: SD → PARO → mesa → cuello → disipador → Q2 → GND */
export const CADENA_SD: Array<{ id: string; que: string; de: string; a: string; micro?: boolean }> = [
  { id: 'K10', que: 'contacto auxiliar NC del PARO (J14–J15)', de: 'SD', a: 'PARO_R' },
  { id: 'K13', que: `termostato ${valorFuera('TS2')} de la mesa (J20–J21)`, de: 'PARO_R', a: 'TM_R' },
  { id: 'K14', que: `termostato ${valorFuera('TS3')} del zócalo del cuello (J22–J23)`, de: 'TM_R', a: 'TC_R' },
  { id: 'TS1', que: 'KSD301 NC 90 °C del disipador', de: 'TC_R', a: 'TS_R' },
  { id: 'Q2', que: '2N7000 (el micro, por SD_EN)', de: 'TS_R', a: 'GND', micro: true },
];
const RIELES = ['+3V3', '+5V', '+12V', '+48F', 'BUS+'];
/**
 * ¿SD llega a GND? Grafo de redes con aristas = piezas que conducen en DC (resistencias, interruptores, Q2 prendido, el par de
 * islas de un interruptor de fuera); no se cruza por los rieles (están fijos a su voltaje) ni por integrados ni capacitores.
 * `abierto` = el eslabón que se abre.
 */
export function sdLlegaAGnd(pl: Placa = PLACA, abierto?: string): { llega: boolean; camino: string[] } {
  const aristas: Array<{ id: string; a: string; b: string }> = [];
  for (const c of pl.componentes) {
    if (c.ci || /^C\d/.test(c.ref) || c.ref === abierto) continue;
    const redes = c.pines.filter((q) => q.red).map((q) => q.red as string);
    if (c.ref === 'Q2') { const d = c.pines.find((q) => q.nombre === 'D')?.red, s = c.pines.find((q) => q.nombre === 'S')?.red; if (d && s) aristas.push({ id: c.ref, a: d, b: s }); continue; }
    for (let i = 0; i < redes.length; i++) for (let j = i + 1; j < redes.length; j++) if (redes[i] !== redes[j]) aristas.push({ id: c.ref, a: redes[i], b: redes[j] });
  }
  for (const k of Object.keys(INTERRUPTORES_FUERA)) {
    if (k === abierto) continue;
    const is = pl.islas.filter((x) => x.conexion === k);
    for (let i = 0; i < is.length; i++) for (let j = i + 1; j < is.length; j++) if (is[i].red !== is[j].red) aristas.push({ id: k, a: is[i].red, b: is[j].red });
  }
  const previo = new Map<string, string>([['SD', '']]), cola = ['SD'];
  while (cola.length) {
    const r = cola.shift() as string;
    if (r === 'GND') break;
    if (RIELES.includes(r)) continue;
    for (const e of aristas) {
      const otra = e.a === r ? e.b : e.b === r ? e.a : null;
      if (otra && !previo.has(otra)) { previo.set(otra, `${r} —${e.id}→ ${otra}`); cola.push(otra); }
    }
  }
  if (!previo.has('GND')) return { llega: false, camino: [] };
  const camino: string[] = [];
  for (let r = 'GND'; r !== 'SD';) { const t = previo.get(r) as string; camino.unshift(t); r = t.split(' —')[0]; }
  return { llega: true, camino };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 6. EL ARMADO (D3 del contrato): el orden de soldadura como datos
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface Cautin { W: number; puntaMm: number; tempC: number; precalentarC?: number }
/** D3: ≥ 80 W, punta cincel de 5 mm, placa precalentada a ~100 °C con aire por abajo (2 oz sin alivio térmico) */
export const CAUTIN = {
  fino: { W: 40, puntaMm: 1, tempC: 330 } as Cautin,
  /** los snap-in y las películas en vaciados de 2 oz: la potencia del grueso, sin precalentar (las MKS4 son de 100 °C máx.) */
  medio: { W: 80, puntaMm: 3.2, tempC: 380 } as Cautin,
  grueso: { W: 80, puntaMm: 5, tempC: 400, precalentarC: 100 } as Cautin,
};
export interface PasoArmado { n: number; titulo: string; cara: 'mecánica' | 'abajo' | 'arriba' | 'islas'; refs: string[]; cautin?: Cautin; nota: string }
/** el alto de una pieza sobre la cara de arriba (mm) */
const alto = (c: Componente, z: number) => cajaComp(c, z).z1 - z;
/** las piezas levantadas (el choque): lo que quede debajo se suelda antes */
const levantadas = (pl: Placa) => pl.componentes.filter((c) => c.pos.lado === 'arriba' && c.montaje === 'THT' && (c.cuerpo.dz ?? 0) >= 5);
export function armado(pl: Placa = PLACA): PasoArmado[] {
  const z = pl.zTop, P: PasoArmado[] = [];
  const add = (titulo: string, cara: PasoArmado['cara'], refs: string[], nota: string, cautin?: Cautin) => { if (refs.length) P.push({ n: P.length + 1, titulo, cara, refs, nota, cautin }); };
  const arriba = pl.componentes.filter((c) => c.pos.lado === 'arriba' && c.montaje !== 'fuera');
  const celda = ['Q1', 'D1'], lev = levantadas(pl).map((c) => c.ref);
  /** las de potencia van con sus patas SÓLIDAS a los vaciados de 2 oz (sin alivio): piden el cautín de 80 W */
  const esPotencia = (c: Componente) => c.grupo === 'potencia' && c.montaje === 'THT';
  const todas = arriba.filter((c) => c.montaje !== 'SMD' && !celda.includes(c.ref) && !lev.includes(c.ref)).sort((a, b) => alto(a, z) - alto(b, z));
  const tht = todas.filter((c) => !esPotencia(c)), potBaja = todas.filter((c) => esPotencia(c) && alto(c, z) <= 25), potAlta = todas.filter((c) => esPotencia(c) && alto(c, z) > 25);
  add('Mecánica antes de soldar', 'mecánica', ['HS1', 'MEC1', 'MEC2', 'MEC3'],
    'Q1 y D1 al disipador (Sil-Pad + buje + M3 × 10) y medir > 20 MΩ de cada aleta al disipador; TS1 con 2 M3 × 6 a la cara de arriba de la base; TH1 con epóxico; las tiras de pines a los módulos (WeAct, TMC2209). Antes de soldar el TMC2209: medir su Rsense y poner VREF del potenciómetro en ' + pl.motor.vrefRespaldo.toFixed(2) + ' V (respaldo).');
  add('Cara de abajo: SMD', 'abajo', pl.componentes.filter((c) => c.pos.lado === 'abajo').sort((a, b) => Number(!a.ci) - Number(!b.ci) || a.ref.localeCompare(b.ref)).map((c) => c.ref),
    'La placa volteada sobre una cama plana. U2 primero (alinear las 16 patas con una esquina, flux, arrastre), luego los pasivos 1206 y D3. Revisar puentes con lupa antes de voltear.', CAUTIN.fino);
  add('Cara de arriba: SMD', 'arriba', arriba.filter((c) => c.montaje === 'SMD').map((c) => c.ref), 'U3 (INA240) antes de cualquier THT: después no entra la punta.', CAUTIN.fino);
  add('Arriba, THT bajas (≤ 10 mm)', 'arriba', tht.filter((c) => alto(c, z) <= 10).map((c) => c.ref),
    'De lo más bajo a lo más alto: la placa se apoya en ellas al voltear. Aquí van las que quedan BAJO el choque (R1–R4): después no hay acceso. Sus patas a los vaciados llevan alivio térmico.', CAUTIN.fino);
  add('Arriba, THT medianas (≤ 25 mm)', 'arriba', tht.filter((c) => alto(c, z) > 10).map((c) => c.ref), 'Módulos por sus tiras (TEN 40, R-78E, TMC2209), Q3, radiales.', CAUTIN.fino);
  add('La potencia baja (vaciados de 2 oz, patas sólidas)', 'arriba', potBaja.map((c) => c.ref),
    'D2 (queda bajo el choque), el shunt y Cout: cautín de 80 W, sostener 3–4 s por pata; el shunt con sus 4 patas a escuadra (Kelvin).', CAUTIN.medio);
  add('Q1 y D1 con el disipador ya atornillado', 'arriba', celda.filter((r) => pl.componentes.some((c) => c.ref === r)),
    'El disipador en su lugar sobre la placa (FR4 sin cobre debajo), las patas por sus agujeros: soldar con el disipador sostenido, no colgando de las patas. D a BUS+, S y K a SW: vaciados sin alivio.', CAUTIN.medio);
  add('Arriba, THT altas (> 25 mm)', 'arriba', potAlta.map((c) => c.ref), 'Películas y electrolíticos (snap-in: vaciados de 2 oz, sostener la punta 4–5 s). Sin precalentar: las MKS4 son de 100 °C.', CAUTIN.medio);
  add('El choque, encima de lo ya soldado', 'arriba', lev, 'Sus patas de cal 10 a los vaciados de SW y OUT+: cautín grueso, precalentar como las islas de potencia.', CAUTIN.grueso);
  add('Los sensores de fuera', 'arriba', pl.componentes.filter((c) => c.montaje === 'fuera').map((c) => c.ref),
    'Los hilos de TS1 y TH1 (en el disipador) y de TH2 (sobre el choque) a sus dos islas; dejar 20 mm de holgura.', CAUTIN.fino);
  add('Islas de señal (cal 22–26)', 'islas', [...pl.islas.filter((i) => i.awg > 12).map((i) => i.ref), ...pl.barrenos.map((b) => b.ref), 'MEC4'],
    'Estañar la punta del hilo, meterla, soldar por abajo. K09: los hilos de fábrica del ventilador a J12/J13 y el cincho de 2.5 mm por H1.', CAUTIN.fino);
  add('Islas de potencia (cal 10 y cal 8) AL FINAL', 'islas', pl.islas.filter((i) => i.awg <= 12).map((i) => i.ref),
    `Precalentar la placa a ~${CAUTIN.grueso.precalentarC} °C con aire por abajo (no derrite lo ya soldado: SAC305 funde a 217 °C). Cautín ≥ ${CAUTIN.grueso.W} W, punta cincel de ${CAUTIN.grueso.puntaMm} mm: 2 oz sin alivio térmico. Luego la abrazadera de B a ≤ 15 mm.`, CAUTIN.grueso);
  return P;
}
export function armadoTexto(pl: Placa = PLACA): string {
  const L = ['EL ARMADO DE LA PLACA DE LA PLUMA (D3 del contrato v2): el orden de soldadura', ''];
  for (const s of armado(pl)) {
    L.push(`${s.n}. ${s.titulo} [${s.cara}]${s.cautin ? ` · cautín ${s.cautin.W} W, punta ${s.cautin.puntaMm} mm, ${s.cautin.tempC} °C${s.cautin.precalentarC ? `, placa precalentada a ~${s.cautin.precalentarC} °C` : ''}` : ''}`);
    L.push(`   ${s.refs.join(' ')}`);
    L.push(`   ${s.nota}`);
  }
  return L.join('\n') + '\n';
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 7. LAS COMPRAS EN MÉXICO (cada pieza comprada con su alternativa; nada verificado en la web = SUPUESTO)
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface AltMX { tienda: string; parte: string; nota?: string }
export interface CompraMX { clave: string; refs: string[]; parte: string; alternativas: AltMX[]; verificado: boolean; supuesto?: string }
const SUP_MX = 'SUPUESTO: no verificado en la web (existencia, precio, entrega)';
/** el alambre del choque: vueltas · π · Ø medio de la espira + 2 patas de 25 mm */
export const LARGO_CHOQUE_M = (CHOQUE.vueltas * Math.PI * (2 * CHOQUE.r + CHOQUE.alambre) + 2 * 25) / 1000;
const DK = 'Digi-Key México', MO = 'Mouser México', AG = 'AG Electrónica', ST = 'Steren', AE = 'AliExpress';
export const ALTERNATIVAS_MX: Record<string, AltMX[]> = {
  IRFB4227: [{ tienda: DK, parte: 'IRFB4227PBF' }, { tienda: MO, parte: 'IRFB4227PBF' }, { tienda: AE, parte: 'IRFB4227 (medir RDS(on) al llegar: hay copias)' }],
  V40200C: [{ tienda: DK, parte: 'V40200C-E3/4W' }, { tienda: MO, parte: 'V40200C-E3/4W' }, { tienda: AE, parte: 'V40200C-E3 en TO-220AB (el MBR40200PT no: es TO-247)' }],
  SB5100: [{ tienda: AG, parte: 'SB5100' }, { tienda: DK, parte: 'SB5100-E3/54' }],
  '15 µH aire': [{ tienda: 'refaccionaria de embobinado', parte: `alambre magneto cal 10 (${LARGO_CHOQUE_M.toFixed(1)} m por choque)`, nota: `sobre un molde de Ø${(2 * CHOQUE.r - CHOQUE.alambre * 2).toFixed(0)} mm (el hueco de la espira)` }, { tienda: AE, parte: 'alambre magneto 2.5 mm (cal 10)' }],
  '2200 µF 100 V': [{ tienda: DK, parte: 'EPCOS/TDK B43644 2200 µF 100 V snap-in Ø30 o equivalente de alto rizo' }, { tienda: MO, parte: 'Nichicon LGU2A222MELB (revisar rizo ≥ 4.4 A @120 Hz)' }, { tienda: AG, parte: '2200 µF 100 V snap-in 105 °C' }],
  '10 µF 100 V': [{ tienda: DK, parte: 'WIMA MKS4 10 µF 100 V P27.5' }, { tienda: AE, parte: 'MKP/MKS 10 µF 100 V P27.5 (comprobar el paso)' }],
  '1 µF 100 V': [{ tienda: DK, parte: 'WIMA MKS4 1 µF 100 V P15' }, { tienda: AG, parte: 'capacitor de poliéster 1 µF 100 V' }],
  '0.5 mΩ': [{ tienda: DK, parte: 'shunt 4 terminales 0.5 mΩ 3 W THT (Ohmite/Bourns)' }, { tienda: AE, parte: 'shunt de manganina 0.5 mΩ con terminales Kelvin' }],
  INA240A2: [{ tienda: DK, parte: 'INA240A2DR' }, { tienda: MO, parte: 'INA240A2DR' }],
  IR2110S: [{ tienda: DK, parte: 'IR2110STRPBF' }, { tienda: MO, parte: 'IR2110STRPBF' }, { tienda: AG, parte: 'IR2110 (revisar que sea SOIC-16W, no DIP-14)' }],
  ES1D: [{ tienda: DK, parte: 'ES1D-E3/61T' }, { tienda: AE, parte: 'ES1D SMA (rollo)' }],
  '2N7000': [{ tienda: AG, parte: '2N7000' }, { tienda: ST, parte: '2N7000' }],
  'KSD301 90 °C NC': [{ tienda: AG, parte: 'termostato bimetálico KSD301 90 °C NC' }, { tienda: AE, parte: 'KSD301 90 °C NC (normalmente cerrado)' }, { tienda: 'refaccionaria de línea blanca', parte: 'termostato de disco 90 °C NC' }],
  'AFB0812H 80×80×25 12 V 0.25 A': [{ tienda: DK, parte: 'Delta AFB0812H (80 × 80 × 25, 12 V, 0.25 A)' }, { tienda: AE, parte: 'ventilador 8025 12 V de alta velocidad (≥ 45 CFM, ≥ 5 mmH₂O, ≤ 0.25 A)' }, { tienda: ST, parte: 'ventilador 80 mm 12 V (revisar que diga ≥ 45 CFM y ≤ 0.25 A)' }],
  'KSD9700 70 °C NC': [{ tienda: AE, parte: 'KSD9700 70 °C NC, plano de 5 mm (el de lata, no el de plástico)' }, { tienda: AG, parte: 'termostato bimetálico plano KSD9700 70 °C NC' }, { tienda: 'refaccionaria de línea blanca', parte: 'protector térmico plano 70 °C NC (de motor)' }],
  'KSD301 70 °C ±3 NC': [{ tienda: AE, parte: 'KSD301 70 °C NC, tolerancia ±3 °C (no la común de ±5: con ±5 corta tarde o corta trabajando)' }, { tienda: AG, parte: 'termostato bimetálico KSD301 70 °C NC (pedir ±3 °C)' }],
  'NTC 10 k': [{ tienda: AG, parte: 'termistor NTC 10 k B3950 (gota de epóxico)' }, { tienda: AE, parte: 'NTC 10 k 3950 1 %' }],
  'WeAct RP2350B Core': [{ tienda: AE, parte: 'WeAct Studio RP2350B Core Board (tienda oficial de WeAct)' }],
  'TMC2209 StepStick': [{ tienda: AE, parte: 'BIGTREETECH TMC2209 V1.3 (tienda oficial de BTT)' }, { tienda: 'Mercado Libre', parte: 'TMC2209 BTT V1.3 (el que diga Rsense 0.11)' }],
  '100 µF 35 V': [{ tienda: AG, parte: '100 µF 35 V 105 °C bajo ESR' }, { tienda: ST, parte: '100 µF 35 V' }],
  '2 A T': [{ tienda: DK, parte: 'Littelfuse 37212000411 (TR5 2 A lento)' }, { tienda: AG, parte: 'fusible miniatura TR5 2 A lento' }],
  'TEN 40-4812': [{ tienda: DK, parte: 'TRACO TEN 40-4812' }, { tienda: MO, parte: 'TRACO TEN 40-4812' }, { tienda: AE, parte: 'módulo aislado 36–75 V → 12 V 40 W (otra huella: revisar antes)' }],
  '47 µF 100 V': [{ tienda: AG, parte: '47 µF 100 V 105 °C Ø10' }, { tienda: ST, parte: '47 µF 100 V' }],
  'R-78E5.0-0.5': [{ tienda: DK, parte: 'RECOM R-78E5.0-0.5' }, { tienda: MO, parte: 'RECOM R-78E5.0-0.5' }, { tienda: AE, parte: 'regulador conmutado SIP-3 7805 de 0.5 A (pinout igual: revisar)' }],
  IRLB8721: [{ tienda: DK, parte: 'IRLB8721PBF' }, { tienda: AG, parte: 'IRLB8721' }],
  '1N5822': [{ tienda: AG, parte: '1N5822' }, { tienda: ST, parte: '1N5822' }],
  R_THT: [{ tienda: AG, parte: 'resistencia de película metálica 1/4 W 1 %' }, { tienda: ST, parte: 'resistencia 1/4 W 1 %' }],
  R_1206: [{ tienda: AG, parte: 'resistencia SMD 1206 1 %' }, { tienda: AE, parte: 'kit de resistencias 1206' }],
  C_1206: [{ tienda: AG, parte: 'capacitor cerámico SMD 1206 X7R' }, { tienda: DK, parte: 'Samsung/Murata 1206 X7R' }],
  C_disco: [{ tienda: AG, parte: 'capacitor cerámico de disco/multicapa radial P5' }, { tienda: ST, parte: 'capacitor cerámico' }],
  HS1: [{ tienda: AE, parte: 'disipador de aluminio 125 × 35 × 35' }, { tienda: AG, parte: 'perfil disipador cortado a 125 mm' }],
  MEC1: [{ tienda: AG, parte: 'kit de montaje TO-220: Sil-Pad + buje + M3' }, { tienda: ST, parte: 'aislante de mica/silicón TO-220' }],
  MEC2: [{ tienda: 'ferretería', parte: 'tornillo M3 × 6 + machuelo M3' }],
  MEC3: [{ tienda: AG, parte: 'tira de pines macho 2.54 (vienen con los módulos)' }],
  MEC4: [{ tienda: 'ferretería', parte: 'cincho de nylon 2.5 × 100 mm' }, { tienda: ST, parte: 'cinchos 2.5 mm' }],
};
const claveMX = (c: Componente) => c.huella.startsWith('Resistor_THT') ? 'R_THT' : c.huella.startsWith('Resistor_SMD') ? 'R_1206'
  : c.huella.startsWith('Capacitor_SMD') ? 'C_1206' : c.huella.includes('C_Disc') ? 'C_disco' : c.valor;
export function comprasMX(pl: Placa = PLACA): CompraMX[] {
  const out: CompraMX[] = [];
  const fila = (clave: string, refs: string[], parte: string) => {
    const alternativas = ALTERNATIVAS_MX[clave] ?? [];
    out.push({ clave, refs, parte, alternativas, verificado: false, supuesto: SUP_MX });
  };
  for (const f of listaMateriales(pl)) {
    const c = pl.componentes.find((x) => x.ref === f.refs[0]);
    if (c) fila(claveMX(c), f.refs, f.parte);
  }
  for (const m of MECANICA) fila(m.ref, [m.ref], m.desc);
  for (const f of FUERA_DE_LA_PLACA) fila(f.valor, [f.ref], f.desc);
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 8. EL REVISOR
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface Hallazgo { nivel: 'error' | 'aviso'; regla: string; donde: string; texto: string }
/** nodos de cada red: componentes + islas */
export function nodosPorRed(pl: Placa = PLACA): Map<string, Array<{ ref: string; pin: string; tipo: TipoPin; tira?: 'alto' | 'bajo' }>> {
  const m = new Map<string, Array<{ ref: string; pin: string; tipo: TipoPin; tira?: 'alto' | 'bajo' }>>();
  const add = (red: string, x: { ref: string; pin: string; tipo: TipoPin; tira?: 'alto' | 'bajo' }) => { const l = m.get(red) ?? []; l.push(x); m.set(red, l); };
  for (const c of pl.componentes) for (const q of c.pines) if (q.red) add(q.red, { ref: c.ref, pin: q.n, tipo: q.tipo, tira: q.tira });
  for (const is of pl.islas) add(is.red, { ref: is.ref, pin: '1', tipo: is.tipo });
  return m;
}
const ALIMENTACION = ['+12V', '+5V', '+3V3', '+48F', 'BUS+'];
const FALLA_SEGURA: Array<{ ref: string; pin: string; debe: 'alto' | 'bajo'; porque: string }> = [
  { ref: 'U2', pin: 'SD', debe: 'alto', porque: 'SD arriba = Q1 apagado; el IR2110 trae pull-down interno (flotando = ENCENDIDO)' },
  { ref: 'U2', pin: 'HIN', debe: 'bajo', porque: 'sin PWM, Q1 apagado' },
  { ref: 'U4', pin: 'EN', debe: 'alto', porque: 'EN arriba = motor suelto mientras el micro arranca' },
  { ref: 'Q2', pin: 'G', debe: 'bajo', porque: 'la compuerta de Q2 abajo = la cadena SD abierta' },
  { ref: 'Q3', pin: 'G', debe: 'bajo', porque: 'el ventilador de la mesa apagado en el reset' },
];
/** lazo de compuerta: del IR2110S (abajo) a la pata G de Q1 (D2 del contrato) */
export const LAZO_COMPUERTA_MAX = 10;
export interface OpcRevisor { perdidas?: Perdidas; ventilador?: boolean; caudal?: number; rizoPorCap?: number; armado?: PasoArmado[]; compras?: CompraMX[] }
/**
 * revisarPlaca. Reglas:
 *  E1 una fuente por red · E2 sin entradas flotando · E3 desacoplo en cada integrado · E4 la cadena SD falla-segura
 *  (pull-ups/downs + cada red de la cadena sólo toca sus eslabones) · E4c abrir CUALQUIER eslabón deja a SD sin camino a GND
 *  (sin el micro) · E5 la alterna NO entra · E6 pines sin red declarados NC y redes de un solo nodo · E7 tensión nominal
 *  · E8 el riel de 12 V (el ventilador cabe en K09) · L1 el lazo de conmutación · L2 el lazo de compuerta (IR2110S abajo, bajo Q1) · P1 IPC-2221 · P2 islas por calibre
 *  · P3 alivio de tensión (abrazadera o barreno con cincho) · G1 dentro de la bahía (enBahia, lo cedido no) · G2 sin
 *  encimarse y ninguna pieza sobre una pata THT · G3 isla en su puerto · G4 el cable libre en TODA su ruta · G5 isla sobre la
 *  PCB en L · G6 K05 y K06 juntos (REGLAS.lazoArco) · T1 temperatura por pieza · T2 rizo por capacitor · T3 lo que toca a B
 *  · T4 potencia de las resistencias · M1 los pines del micro · M2 la corriente del motor (K07) · A1 el armado (D3)
 *  · C1 cada pieza comprada con su alternativa en México
 */
export function revisarPlaca(pl: Placa = PLACA, opt: OpcRevisor = {}): Hallazgo[] {
  const h: Hallazgo[] = [];
  const E = (regla: string, donde: string, texto: string) => h.push({ nivel: 'error', regla, donde, texto });
  const A = (regla: string, donde: string, texto: string) => h.push({ nivel: 'aviso', regla, donde, texto });
  const nodos = nodosPorRed(pl), red = (n: string) => pl.redes.find((r) => r.nombre === n);
  const comp = (ref: string) => pl.componentes.find((c) => c.ref === ref);
  const pinDe = (ref: string, nom: string) => comp(ref)?.pines.find((q) => q.nombre === nom || q.n === nom);
  // E1 — una fuente por red
  for (const [nombre, ns] of nodos) {
    const fuentes = [...new Set(ns.filter((x) => x.tipo === 'pot-salida').map((x) => x.ref))];
    if (fuentes.length > 1) E('E1', nombre, `la red ${nombre} tiene ${fuentes.length} fuentes: ${fuentes.join(', ')}`);
    if (ALIMENTACION.includes(nombre) && fuentes.length === 0 && nombre !== '+48F' && nombre !== 'BUS+')
      E('E1', nombre, `la red ${nombre} alimenta y nadie la da`);
    if (!red(nombre)) E('E1', nombre, `la red ${nombre} no está en REDES (sin voltaje declarado)`);
  }
  // E5 — la alterna no entra a la placa
  for (const r of pl.redes) if (r.funcion === 'ac' || /^AC/i.test(r.nombre)) E('E5', r.nombre, `la red ${r.nombre} es alterna: la AC va IEC → PARO → LRS por fuera, NUNCA a la placa`);
  for (const [nombre] of nodos) if (/^(AC|L$|N$|FASE|NEUTRO)/i.test(nombre)) E('E5', nombre, `la red ${nombre} parece alterna`);
  // E2 — entradas flotando · E6 — pines y redes sueltos
  for (const [nombre, ns] of nodos) {
    if (ns.length < 2) E('E6', nombre, `la red ${nombre} tiene un solo nodo (${ns[0].ref}.${ns[0].pin})`);
    const hayDriver = ns.some((x) => ['salida', 'bidir', 'pot-salida', 'pasivo', 'pot-entrada'].includes(x.tipo) && !(x.tipo === 'pot-entrada' && !ALIMENTACION.includes(nombre) && nombre !== 'GND'));
    for (const x of ns) if (x.tipo === 'entrada' && !hayDriver && !x.tira) E('E2', `${x.ref}.${x.pin}`, `la entrada ${x.ref}.${x.pin} (${nombre}) queda flotando: nadie la maneja`);
  }
  for (const c of pl.componentes) for (const q of c.pines)
    if (!q.red && !(q.tipo === 'nc' || q.tipo === 'salida')) E('E6', `${c.ref}.${q.n}`, `${c.ref}.${q.nombre} sin red y no está declarado NC`);
  // E4 — falla segura: cada entrada crítica tiene su resistencia al riel correcto (o su tira interna en ese sentido)
  for (const f of FALLA_SEGURA) {
    const q = pinDe(f.ref, f.pin);
    if (!q || !q.red) { E('E4', `${f.ref}.${f.pin}`, `${f.ref}.${f.pin} no existe o no tiene red`); continue; }
    const rieles = f.debe === 'alto' ? ['+3V3', '+5V', '+12V'] : ['GND'];
    const conR = pl.componentes.some((c) => /^R\d/.test(c.ref) && c.pines.some((x) => x.red === q.red) && c.pines.some((x) => x.red && rieles.includes(x.red)));
    const tiraBien = q.tira === f.debe;
    if (!conR && !tiraBien) E('E4', `${f.ref}.${f.pin}`, `${f.ref}.${f.pin} (${q.red}) no va ${f.debe === 'alto' ? 'ARRIBA' : 'ABAJO'} por sí sola: ${f.porque}`);
    if (!conR && q.tira && q.tira !== f.debe) E('E4', `${f.ref}.${f.pin}`, `${f.ref}.${f.pin}: su tira interna va ${q.tira} y la falla segura pide ${f.debe}`);
  }
  // E4b — la cadena SD: cada red de la cadena toca sólo sus eslabones (sin atajos)
  const islasDe = (k: string) => pl.islas.filter((x) => x.conexion === k).map((x) => x.ref);
  const cadena: Array<{ red: string; permitidos: string[] }> = [
    { red: 'SD', permitidos: ['U2', 'R8', 'U1', ...islasDe('K10')] },
    { red: 'PARO_R', permitidos: [...islasDe('K10'), ...islasDe('K13')] },
    { red: 'TM_R', permitidos: [...islasDe('K13'), ...islasDe('K14')] },
    { red: 'TC_R', permitidos: [...islasDe('K14'), 'TS1'] },
    { red: 'TS_R', permitidos: ['TS1', 'Q2'] }];
  for (const eslabon of cadena) {
    const ns = nodos.get(eslabon.red) ?? [];
    if (!ns.length) { E('E4', eslabon.red, `la cadena SD perdió la red ${eslabon.red}`); continue; }
    for (const x of ns) if (!eslabon.permitidos.includes(x.ref)) E('E4', eslabon.red, `la red ${eslabon.red} de la cadena SD toca ${x.ref}.${x.pin}: un atajo puentea al PARO o a un termostato`);
  }
  const q2s = pinDe('Q2', 'S'), q2d = pinDe('Q2', 'D'), ts1 = comp('TS1');
  if (!(q2s?.red === 'GND' && q2d?.red === 'TS_R')) E('E4', 'Q2', 'Q2 tiene que cerrar la cadena SD entre TS_R y GND');
  if (!ts1 || !ts1.pines.some((x) => x.red === 'TC_R') || !ts1.pines.some((x) => x.red === 'TS_R')) E('E4', 'TS1', 'el termostato del disipador no está en serie en la cadena SD (TC_R → TS_R)');
  const k13 = pl.islas.filter((x) => x.conexion === 'K13');
  if (!(k13.some((x) => x.red === 'PARO_R') && k13.some((x) => x.red === 'TM_R'))) E('E4', 'K13', 'el termostato de la mesa (K13) no está en serie en la cadena SD (PARO_R → TM_R)');
  const k14 = pl.islas.filter((x) => x.conexion === 'K14');
  if (!(k14.some((x) => x.red === 'TM_R') && k14.some((x) => x.red === 'TC_R'))) E('E4', 'K14', 'el termostato del cuello (K14) no está en serie en la cadena SD (TM_R → TC_R)');
  // E4c — abrir cualquier eslabón apaga sin el micro (Q2 prendido = el peor caso: el micro dice «adelante»)
  const intacta = sdLlegaAGnd(pl);
  if (!intacta.llega) E('E4', 'SD', 'la cadena SD no cierra ni con todo cerrado: el arco nunca prendería');
  for (const es of CADENA_SD.filter((x) => !x.micro)) {
    const r = sdLlegaAGnd(pl, es.id);
    if (r.llega) E('E4', es.id, `si se abre ${es.que}, SD sigue llegando a GND por ${r.camino.join(' · ')}: el arco NO se apaga`);
  }
  // E3 — desacoplo de cada integrado / módulo
  for (const c of pl.componentes) {
    if (!c.ci || c.desacoploInterno) continue;
    const gnd = 'GND', dmax = c.montaje === 'modulo' ? 15 : 10, cc = cajaComp(c, pl.zTop);
    for (const q of c.pines) {
      if (q.tipo !== 'pot-entrada' || !q.red || q.red === gnd || (c.internos ?? []).includes(q.red)) continue;
      const caps = pl.componentes.filter((k) => /^C\d/.test(k.ref) && k.pines.some((x) => x.red === q.red) && k.pines.some((x) => x.red === gnd));
      const cerca = caps.filter((k) => { const kk = cajaComp(k, pl.zTop); return distCaja(cc, kk.cx, kk.cy) <= dmax && (k.pos.lado === c.pos.lado || k.montaje === 'THT'); });
      if (!caps.length) E('E3', `${c.ref}.${q.nombre}`, `${c.ref} (${c.valor}) no tiene capacitor de desacoplo en ${q.red}`);
      else if (!cerca.length) E('E3', `${c.ref}.${q.nombre}`, `el desacoplo de ${c.ref} en ${q.red} está a más de ${dmax} mm (${caps.map((k) => k.ref).join(', ')})`);
    }
  }
  // E7 — tensión nominal (×1.25 de margen)
  for (const c of pl.componentes) {
    if (!c.vmax) continue;
    let V = c.vFija ?? 0;
    const par = c.vPines ?? (c.pines.length === 2 ? ['1', '2'] : null);
    if (c.vFija === undefined && par) {
      const a = c.pines.find((q) => q.n === par[0]), b = c.pines.find((q) => q.n === par[1]);
      const ra = a?.red ? red(a.red) : undefined, rb = b?.red ? red(b.red) : undefined;
      if (ra && rb) V = Math.max(Math.abs(ra.vmax - rb.vmin), Math.abs(rb.vmax - ra.vmin));
    }
    if (V * 1.25 > c.vmax) E('E7', c.ref, `${c.ref} (${c.valor}) ve ${V.toFixed(1)} V y aguanta ${c.vmax} V (pide ×1.25 → ${(V * 1.25).toFixed(0)} V)`);
  }
  // L1 — el lazo de conmutación: las películas pegadas a Q1.D y D1.A; el pico de D1 contra su nominal
  const q1 = comp('Q1'), d1 = comp('D1');
  if (q1 && d1) {
    const qd: [number, number] = [q1.pos.x, q1.pos.y + 2.54], da: [number, number] = [d1.pos.x, d1.pos.y];
    const pel = pl.componentes.filter((c) => c.pines.some((q) => q.red === 'BUS+') && c.pines.some((q) => q.red === 'GND') && /MKS4 P27/.test(c.enc));
    if (!pel.length) E('L1', 'Q1/D1', 'no hay película en el lazo de conmutación');
    const dMas = Math.min(...pel.map((c) => Math.hypot(c.pos.x - qd[0], c.pos.y - qd[1])), 1e9);
    const dMenos = Math.min(...pel.map((c) => Math.hypot(c.pos.x - da[0], c.pos.y + 27.5 - da[1])), 1e9);
    if (dMas > 12) E('L1', 'Q1.D', `la película más cercana está a ${dMas.toFixed(1)} mm de Q1.D (≤ 12)`);
    const L = lazoNh(dMas + dMenos + 27.5, 15), pico = picoD1(L), vD1 = d1.vmax ?? 0;
    if (pico * 1.25 > vD1) E('L1', 'D1', `lazo ${L.toFixed(0)} nH → D1 llega a ${pico.toFixed(0)} V con picos de 70 A; aguanta ${vD1} V`);
    else if (pico * 1.6 > vD1) A('L1', 'D1', `lazo ${L.toFixed(0)} nH → D1 a ${pico.toFixed(0)} V (margen ${(vD1 / pico).toFixed(2)}×)`);
  }
  // L2 — el lazo de compuerta: el IR2110S abajo y pegado a la pata G de Q1 (D2 del contrato)
  const u2 = comp('U2');
  if (q1 && u2) {
    const dG = distCaja(cajaComp(u2, pl.zTop), q1.pos.x, q1.pos.y);
    if (u2.pos.lado !== 'abajo') E('L2', 'U2', 'el IR2110S tiene que ir en la cara de ABAJO, bajo Q1 (D2 del contrato)');
    if (dG > LAZO_COMPUERTA_MAX) E('L2', 'U2', `el IR2110S queda a ${dG.toFixed(1)} mm de la pata G de Q1 (≤ ${LAZO_COMPUERTA_MAX}): el lazo de compuerta crece`);
  }
  // P1 — IPC-2221
  for (const t of pl.tramos) {
    const Ipor = t.Irms / t.capas, req = anchoIPC2221(Ipor, DT_IPC, t.oz);
    if (t.ancho < req) E('P1', t.red, `${t.red} ${t.de} → ${t.a}: ${t.ancho} mm para ${Ipor} A por capa; IPC-2221 pide ${req.toFixed(1)} mm (${t.oz} oz, ΔT ${DT_IPC} K)`);
    if (Ipor > 35) A('P1', t.red, `${t.red}: ${Ipor} A por capa está fuera de la tabla de IPC-2221 (≤ 35 A): extrapolado`);
  }
  // P2 / P3 — islas por calibre · alivio
  for (const is of pl.islas) {
    const dc = dConductor(is.awg);
    if (is.agujero < dc + 0.2) E('P2', is.ref, `${is.ref}: agujero ${is.agujero} mm para un cal ${is.awg} de ${dc.toFixed(2)} mm (pide ≥ ${(dc + 0.2).toFixed(2)})`);
    if (is.agujero > dc + 0.8) A('P2', is.ref, `${is.ref}: agujero ${is.agujero} mm holgado para cal ${is.awg} (${dc.toFixed(2)} mm): la soldadura no sube por capilaridad`);
    if (is.pad < 1.8 * is.agujero) E('P2', is.ref, `${is.ref}: anillo de ${is.pad} mm para agujero de ${is.agujero} (pide ≥ ${(1.8 * is.agujero).toFixed(1)})`);
    const k = is.conexion ? CONEXIONES.find((x) => x.id === is.conexion) : undefined;
    if (k && k.awg !== is.awg) E('P2', is.ref, `${is.ref}: el contrato (${k.id}) dice cal ${k.awg}, la isla es para cal ${is.awg}`);
    if (k && !k.hilos.includes(is.hilo)) E('P2', is.ref, `${is.ref}: el hilo «${is.hilo}» no está en ${k.id} (${k.hilos.join(', ')})`);
    if (k?.puente) {   // los hilos de fábrica: el agujero también le tiene que quedar al calibre de al lado (cal 24–26)
      const d2 = dConductor(k.awg + 2);
      if (is.agujero > d2 + 0.8) E('P2', is.ref, `${is.ref}: el puente ${k.id} puede traer cal ${k.awg + 2} (${d2.toFixed(2)} mm) y el agujero de ${is.agujero} le queda holgado`);
      const b = pl.barrenos.find((x) => x.para === k.id && Math.hypot(x.x - is.x, x.y - is.y) <= ALIVIO_PUENTE_MAX);
      if (!b) E('P3', is.ref, `${is.ref}: el puente ${k.id} (hilos de fábrica) no tiene barreno de alivio a ≤ ${ALIVIO_PUENTE_MAX} mm para su cincho`);
    }
    if (is.awg <= 12 && !is.alivio) E('P3', is.ref, `${is.ref}: cal ${is.awg} soldado sin alivio de tensión — el estaño fluye bajo carga (T/Tf ≈ 0.7)`);
  }
  for (const k of CONEXIONES) {
    const lados = [k.de, k.a].filter((x) => x.startsWith('C.'));
    for (const pu of lados) for (const hilo of k.hilos)
      if (!pl.islas.some((is) => is.puerto === pu && is.hilo === hilo && is.conexion === k.id) && pu !== 'C.USB')
        E('P2', `${k.id}.${hilo}`, `${k.id}: el hilo «${hilo}» del puerto ${pu} no tiene isla`);
  }
  // G1 — dentro de la bahía con enBahia (lo cedido al difusor NO es de C) · G5 — islas sobre la PCB en L
  for (const c of pl.componentes) { const k = cajaComp(c, pl.zTop); if (!cajaEnBahia(k)) E('G1', c.ref, `${c.ref} se sale de la bahía PLACA_PCB o entra a lo cedido (${k.x0.toFixed(0)}…${k.x1.toFixed(0)}, ${k.y0.toFixed(0)}…${k.y1.toFixed(0)}, ${k.z0.toFixed(0)}…${k.z1.toFixed(0)})`); }
  for (const m of MECANICA) if (m.caja && !cajaEnBahia(m.caja)) E('G1', m.ref, `${m.ref} se sale de la bahía o entra a lo cedido al difusor`);
  for (const [i, q] of PCB_RECTS.entries()) if (!cajaEnBahia({ ...q, z0: pl.zTop - ESPESOR, z1: pl.zTop })) E('G1', `PCB ${i}`, 'la PCB se sale de la bahía o entra a lo cedido al difusor');
  for (const is of pl.islas) {
    if (!sobrePCB(is.x, is.y, is.pad / 2)) E('G5', is.ref, `${is.ref} se sale del contorno de la PCB`);
    if (is.reserva && Math.min(is.x - PCB.x0, PCB.x1 - is.x, is.y - PCB.y0, PCB.y1 - is.y) > 8) A('G5', is.ref, `${is.ref} (reserva) no está en el borde`);
  }
  for (const b of pl.barrenos) if (!sobrePCB(b.x, b.y, b.d / 2 + 0.5)) E('G5', b.ref, `${b.ref} se sale del contorno de la PCB`);
  // G2 — sin encimarse (por cara; lo levantado pasa por encima; lo de fuera en 3D)
  const cajas = pl.componentes.map((c) => ({ ref: c.ref, lado: c.pos.lado, smd: c.montaje === 'SMD', k: cajaComp(c, pl.zTop) }));
  const hs = MECANICA[0].caja!;
  cajas.push({ ref: 'HS1', lado: 'arriba', smd: false, k: { ...hs, cx: (hs.x0 + hs.x1) / 2, cy: (hs.y0 + hs.y1) / 2 } });
  for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
    const a = cajas[i], b = cajas[j];
    if (a.lado !== b.lado) continue;
    if (seEnciman(a.k, b.k)) E('G2', `${a.ref}/${b.ref}`, `${a.ref} y ${b.ref} se enciman`);
  }
  for (const is of pl.islas) for (const c of cajas) {
    if (c.lado !== 'arriba' || c.k.z0 > pl.zTop + 6) continue;   // lo levantado (choque) y lo de fuera no pisan la isla
    if (enPlanta(c.k, is.x, is.y, is.pad / 2)) E('G2', `${is.ref}/${c.ref}`, `la isla ${is.ref} queda bajo ${c.ref}`);
  }
  for (let i = 0; i < pl.islas.length; i++) for (let j = i + 1; j < pl.islas.length; j++) {
    const a = pl.islas[i], b = pl.islas[j];
    if (Math.hypot(a.x - b.x, a.y - b.y) < (a.pad + b.pad) / 2 + 0.3) E('G2', `${a.ref}/${b.ref}`, `las islas ${a.ref} y ${b.ref} se tocan`);
  }
  // G2b — ninguna pieza SMD (de cualquier cara) tapa una pata THT; ninguna pata ajena toca una isla o un barreno
  const patas = patasTHT(pl);
  for (const c of cajas) if (c.smd) for (const q of patas) if (q.ref !== c.ref && enPlanta(c.k, q.x, q.y, q.r + 0.3)) E('G2', `${c.ref}/${q.ref}.${q.n}`, `${c.ref} (SMD, cara de ${c.lado}) tapa la pata ${q.ref}.${q.n}`);
  const libres = new Set([...pl.islas.map((x) => x.ref), ...pl.barrenos.map((x) => x.ref)]);
  for (const a of patas.filter((x) => libres.has(x.ref))) for (const b of patas.filter((x) => !libres.has(x.ref)))
    if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 0.3) E('G2', `${a.ref}/${b.ref}.${b.n}`, `${a.ref} toca la pata ${b.ref}.${b.n}`);
  for (const b of pl.barrenos) for (const c of cajas) if (c.lado === 'arriba' && c.k.z0 <= pl.zTop + 6 && enPlanta(c.k, b.x, b.y, b.d / 2 + 0.5)) E('G2', `${b.ref}/${c.ref}`, `el barreno ${b.ref} queda bajo ${c.ref}`);
  // G3 / G4 — cada isla en su puerto, y su cable libre en TODA la ruta (y dentro de la bahía)
  for (const is of pl.islas) {
    const s = subidaAlPuerto(is, pl);
    if (!s) continue;
    if (!s.ok) E('G3', is.ref, s.texto + (s.retiro < s.R ? ' — no le da el radio de doblez' : '') + (s.tramoRecto < 0 ? ' — el puerto está más bajo que la curva' : ''));
    const rr = odCable(is.awg) / 2 + 1, ruta = muestrear(s.puntos);
    if (!ruta.every((q) => enBahia(q, BAHIA_PCB, 1e-6))) E('G1', is.ref, `el cable de ${is.ref} sale de la bahía o cruza lo cedido al difusor antes de llegar a ${is.puerto}`);
    for (const c of cajas) {
      if (c.lado !== 'arriba') continue;
      const choca = ruta.find((q) => q[2] > c.k.z0 - rr && q[2] < c.k.z1 + rr && enPlanta(c.k, q[0], q[1], rr));
      if (choca) E('G4', `${is.ref}/${c.ref}`, `el cable de ${is.ref} pasa por ${c.ref} (en ${choca.map((v) => v.toFixed(0)).join(', ')})`);
    }
  }
  const usb = bocaUSB(pl), pu = puerto('C.USB');
  const dUsb = Math.hypot(usb[0] - pu.pos[0], usb[1] - pu.pos[1], usb[2] - pu.pos[2]);
  if (dUsb > TOL_PUERTO.usb) E('G3', 'U1', `la boca del USB-C cae a ${dUsb.toFixed(1)} mm del puerto C.USB (tol ${TOL_PUERTO.usb})`);
  // G6 — el lazo del arco: K05 y K06 salen juntos (≤ REGLAS.lazoArco.sepMaxMm entre ejes)
  const j5 = pl.islas.find((x) => x.conexion === 'K05'), j6 = pl.islas.find((x) => x.conexion === 'K06');
  if (j5 && j6) {
    const sep = Math.hypot(j5.x - j6.x, j5.y - j6.y);
    if (sep > REGLAS.lazoArco.sepMaxMm) E('G6', `${j5.ref}/${j6.ref}`, `K05 y K06 salen a ${sep.toFixed(1)} mm (REGLAS.lazoArco ≤ ${REGLAS.lazoArco.sepMaxMm}): el lazo del arco se abre`);
  }
  // T1 — temperatura por pieza
  const T = termicaPlaca(opt.perdidas ?? PERDIDAS_PEOR, opt.ventilador ?? true, opt.caudal ?? AIRE.Q);
  for (const t of T) {
    if (t.estado === 'se quema') E('T1', t.pieza, `${t.pieza}: ${t.T.toFixed(0)} °C (máx ${t.max})${t.nota ? ' · ' + t.nota : ''}`);
    else if (t.estado === 'caliente') A('T1', t.pieza, `${t.pieza}: ${t.T.toFixed(0)} °C (límite ${t.lim})${t.nota ? ' · ' + t.nota : ''}`);
  }
  // T3 — lo que toca a B: la cuna (PETG ≤ MATERIAL.tUsoMaxC) se juzgó con el disipador a CUNA_B.Tdiseno
  const ths = T.find((x) => x.pieza === 'disipador');
  if (ths && ths.T > CUNA_B.Tdiseno) A('T3', 'HS1', `el disipador llega a ${ths.T.toFixed(0)} °C y B juzgó la cuna (${MATERIAL.nombre} ≤ ${MATERIAL.tUsoMaxC} °C) con ${CUNA_B.Tdiseno} °C`);
  // T5 — margen al termostato: el disipador estable no debe entrar a la banda de tolerancia del KSD301 (abriría de más)
  if (ths && (opt.ventilador ?? true) && ths.T > TERMOSTATO_C - TOL_TERMOSTATO) {
    const Phs = ths.P, th = (ths.T - AIRE.Ta) / Phs, Qn = caudalNecesario(TERMOSTATO_C - TOL_TERMOSTATO, Phs), PQ1 = (TERMOSTATO_C - TOL_TERMOSTATO - AIRE.Ta) / th - (Phs - (opt.perdidas ?? PERDIDAS_PEOR).Q1);
    A('T5', 'HS1', `el disipador queda en ${ths.T.toFixed(1)} °C: ${(TERMOSTATO_C - ths.T).toFixed(1)} K bajo el termostato de ${TERMOSTATO_C} y el KSD301 es ±${TOL_TERMOSTATO} K → puede abrir de más (falla segura). Basta ≥ ${(Qn * 3600).toFixed(1)} m³/h (hoy ${((opt.caudal ?? AIRE.Q) * 3600).toFixed(1)}) o Q1 ≤ ${PQ1.toFixed(1)} W (E1)`);
  }
  // G7 — el juego del disipador contra el tope de silicato de la cuna de B (dilatación + tolerancias)
  const juego = DISIPADOR.y0 - CUNA_B.topeY, nec = juegoCunaNecesario();
  if (juego < nec) E('G7', 'HS1', `el disipador queda a ${juego.toFixed(2)} mm del tope de la cuna de B y pide ${nec.toFixed(2)} (dilatación + tolerancias): empujaría las patas soldadas de Q1/D1`);
  // T2 — rizo por electrolítico
  const nCe = pl.componentes.filter((c) => /snap-in/.test(c.enc)).length;
  const porCap = opt.rizoPorCap ?? (nCe === 3 ? RIZO_DISENO.I40.porCap : nCe === 2 ? RIZO_DISENO.v3.porCap : (RIZO_DISENO.I40.porCap * 3) / Math.max(1, nCe));
  if (porCap > CE_SPEC.Irip) E('T2', 'C10–C12', `${porCap.toFixed(2)} A rms por electrolítico pasa su nominal (${CE_SPEC.Irip} A @10 kHz+/105 °C)`);
  else if (porCap > 0.85 * CE_SPEC.Irip) A('T2', 'C10–C12', `${porCap.toFixed(2)} A rms por electrolítico: ${(100 * porCap / CE_SPEC.Irip).toFixed(0)} % del nominal (justo)`);
  // T4 — potencia de las resistencias
  for (const c of pl.componentes) {
    if (!c.pR || !/^R\d/.test(c.ref) || c.ref === 'R30') continue;
    const [a, b] = c.pines.map((q) => (q.red ? red(q.red) : undefined));
    if (!a || !b) continue;
    const ohm = parseValorOhm(c.valor);
    // V entre sus patas: la fija si flota con otra red; si es la de arriba de un divisor 18k/1k, 18/19 del total
    const Vm = c.vFija ?? Math.max(Math.abs(a.vmax - b.vmin), Math.abs(b.vmax - a.vmin));
    const esArribaDivisor = c.pines.some((x) => x.red === 'V_OUT' || x.red === 'V_BUS') && ohm > 5000;
    const V = esArribaDivisor ? Vm * 18 / 19 : Vm, Pw = ohm > 0 ? (V * V) / ohm : 0;
    if (ohm >= 1000 && Pw > 0.6 * c.pR) E('T4', c.ref, `${c.ref} (${c.valor}) disipa ${Pw.toFixed(2)} W de ${c.pR} W`);
  }
  // M1 — los pines del micro (SDK) + ≥ 6 ADC + cada pin usado tiene su red en U1
  for (const x of revisarPines(pl.pines)) (x.nivel === 'error' ? E : A)('M1', x.donde, x.texto);
  const adc = pl.pines.filter((q) => q.tipo === 'adc').length;
  if (adc < 6) E('M1', 'ADC', `solo ${adc} entradas analógicas (pide ≥ 6: I, V salida, V bus, 2 NTC, AS5600)`);
  if (adc > RP2350B.adcCanales) E('M1', 'ADC', `${adc} analógicas: el RP2350B tiene ${RP2350B.adcCanales}`);
  const u1 = comp('U1');
  if (u1) for (const q of pl.pines) {
    const pin = u1.pines.find((x) => x.nombre === `GP${q.gpio}`);
    if (!pin || !pin.red) E('M1', `GP${q.gpio}`, `GP${q.gpio} («${q.va}») no llega a ninguna red en U1`);
  }
  // M2 — la corriente del motor (K07): la que corre A, nunca arriba del tope, VM del contrato
  const mo = pl.motor, Irun = corrienteTMC2209(mo.irun, mo.vsense), Imax = corrienteTMC2209(31, mo.vsense);
  if (Math.abs(Irun - I_MOTOR_A) / I_MOTOR_A > 0.05) E('M2', 'U4', `IRUN ${mo.irun} con vsense ${mo.vsense} da ${Irun.toFixed(3)} A rms; A corre ${I_MOTOR_A} A (± 5 %)`);
  if (Irun > I_MOTOR_TOPE) E('M2', 'U4', `${Irun.toFixed(2)} A rms pasa el tope de K07 (${I_MOTOR_TOPE} A): el TMC2209 pasa de ~100 °C`);
  if (Imax > I_MOTOR_TOPE) E('M2', 'U4', `con vsense ${mo.vsense} un IRUN mal escrito llega a ${Imax.toFixed(2)} A (tope ${I_MOTOR_TOPE}): usar vsense 1 (máx ${corrienteTMC2209(31, 1).toFixed(2)} A)`);
  if (mo.iScaleAnalog !== 0) A('M2', 'U4', 'i_scale_analog = 1: la corriente depende del potenciómetro del módulo, no del UART');
  const vm = red(pinDe('U4', 'VM')?.red ?? '');
  if (!vm || Math.abs(vm.vmin - (K07?.V ?? 12)) > 1) E('M2', 'U4.VM', `VM del TMC2209 en ${vm?.nombre ?? '—'}: el contrato (K07) dice ${K07?.V} V`);
  const Tu4 = T.find((x) => x.pieza.startsWith('U4'));
  if (Tu4 && Tu4.T > 100) A('M2', 'U4', `al tope (${I_MOTOR_TOPE} A) el TMC2209 llega a ${Tu4.T.toFixed(0)} °C (> ~100: el tope de K07)`);
  // E8 — el riel de 12 V: el ventilador de la placa cabe en K09 y la suma cabe en el TEN 40
  const k09 = CONEXIONES.find((k) => k.id === 'K09'), k12 = CONEXIONES.find((k) => k.id === 'K12');
  if (k09 && VENTILADOR_PCB.I > k09.Irms + 1e-9) E('E8', 'K09', `el ventilador de la placa pide ${VENTILADOR_PCB.I} A y K09 lleva ${k09.Irms} A`);
  const i12 = PRESUPUESTO_12V.compuerta + VENTILADOR_PCB.I + PRESUPUESTO_12V.motor + PRESUPUESTO_12V.r78 + (k12?.Irms ?? 0);
  if (i12 > PRESUPUESTO_12V.ps1) E('E8', '+12V', `el riel de 12 V pide ${i12.toFixed(2)} A y el TEN 40 da ${PRESUPUESTO_12V.ps1} A`);
  // A1 — el armado (D3): todo una vez; SMD abajo primero; lo de abajo del choque antes; potencia al final con el cautín grueso
  const pasos = opt.armado ?? armado(pl), donde = new Map<string, number>();
  for (const s of pasos) for (const r of s.refs) { if (donde.has(r)) E('A1', r, `${r} aparece dos veces en el armado`); donde.set(r, s.n); }
  for (const c of pl.componentes) if (!donde.has(c.ref)) E('A1', c.ref, `${c.ref} no está en el armado`);
  for (const is of pl.islas) if (!donde.has(is.ref)) E('A1', is.ref, `la isla ${is.ref} no está en el armado`);
  const nAbajo = Math.max(0, ...pl.componentes.filter((c) => c.pos.lado === 'abajo').map((c) => donde.get(c.ref) ?? 0));
  const nArriba = Math.min(1e9, ...pl.componentes.filter((c) => c.pos.lado === 'arriba').map((c) => donde.get(c.ref) ?? 1e9));
  if (nAbajo >= nArriba) E('A1', 'armado', `una pieza de arriba (paso ${nArriba}) va antes que el SMD de abajo (paso ${nAbajo}): D3 pide SMD abajo primero`);
  for (const e of levantadas(pl)) {
    const ke = cajaComp(e, pl.zTop);
    for (const c of pl.componentes.filter((x) => x !== e && x.pos.lado === 'arriba' && x.montaje !== 'fuera')) {
      const kc = cajaComp(c, pl.zTop);
      const debajo = kc.z1 <= ke.z0 + 1e-6 && kc.x0 < ke.x1 && ke.x0 < kc.x1 && kc.y0 < ke.y1 && ke.y0 < kc.y1;
      if (debajo && (donde.get(c.ref) ?? 0) >= (donde.get(e.ref) ?? 0)) E('A1', `${c.ref}/${e.ref}`, `${c.ref} queda bajo ${e.ref} y se suelda después: no hay acceso`);
    }
  }
  for (const c of pl.componentes.filter((x) => x.grupo === 'potencia' && x.montaje === 'THT')) {   // patas sólidas en 2 oz
    const s = pasos.find((x) => x.refs.includes(c.ref));
    if (s && (s.cautin?.W ?? 0) < CAUTIN.medio.W) E('A1', c.ref, `${c.ref} va con sus patas sólidas a los vaciados de 2 oz y el paso ${s.n} trae un cautín de ${s.cautin?.W ?? 0} W (pide ≥ ${CAUTIN.medio.W})`);
  }
  const ultimo = pasos[pasos.length - 1];
  for (const is of pl.islas.filter((x) => x.awg <= 12)) {
    const n = donde.get(is.ref);
    if (n !== undefined && ultimo && n !== ultimo.n) E('A1', is.ref, `la isla ${is.ref} (cal ${is.awg}) va en el paso ${n}: D3 la pide AL FINAL`);
  }
  if (ultimo && pl.islas.some((x) => x.awg <= 12 && donde.get(x.ref) === ultimo.n)) {
    const c = ultimo.cautin;
    if (!c || c.W < CAUTIN.grueso.W || c.puntaMm < CAUTIN.grueso.puntaMm || (c.precalentarC ?? 0) < 0.9 * (CAUTIN.grueso.precalentarC ?? 100))
      E('A1', `paso ${ultimo.n}`, `las islas de potencia piden cautín ≥ ${CAUTIN.grueso.W} W, punta de ${CAUTIN.grueso.puntaMm} mm y la placa a ~${CAUTIN.grueso.precalentarC} °C (D3)`);
  }
  for (const k of CONEXIONES.filter((x) => x.puente)) for (const is of pl.islas.filter((x) => x.conexion === k.id)) {
    const b = pl.barrenos.find((x) => x.para === k.id);
    if (b && donde.get(b.ref) !== donde.get(is.ref)) E('A1', `${is.ref}/${b.ref}`, `el cincho de ${b.ref} va en otro paso que los hilos de ${k.id}`);
  }
  // C1 — cada pieza comprada con su alternativa en México (sin verificar = SUPUESTO)
  for (const f of opt.compras ?? comprasMX(pl)) {
    if (!f.alternativas.length) E('C1', f.refs.join(' '), `${f.refs.join(' ')} (${f.parte}) no tiene alternativa de compra en México`);
    if (!f.verificado && !f.supuesto) E('C1', f.refs.join(' '), `${f.refs.join(' ')}: la alternativa no se verificó y no está marcada SUPUESTO`);
  }
  return h;
}
function parseValorOhm(v: string): number {
  const m = v.match(/([\d.]+)\s*(m|k|M)?\s*Ω/);
  if (!m) return 0;
  const x = parseFloat(m[1]), u = m[2];
  return u === 'k' ? x * 1e3 : u === 'M' ? x * 1e6 : u === 'm' ? x * 1e-3 : x;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 9. LA CUENTA, LA LISTA DE MATERIALES
// ════════════════════════════════════════════════════════════════════════════════════════════
/** El banco v3 (bancoArcoDoc, ForgeBRepStudio.tsx, grupos «Placa de potencia» y «PCB de control»; solo lectura). */
export const CUENTA_V3 = {
  potencia: ['Q1', 'D1', 'D2', 'C bus 1', 'C bus 2', 'película 1', 'película 2', 'película 3', 'IR2110', 'shunt', 'INA240', 'C salida', 'fusible 40 A (MIDI)', 'termostato', 'NTC disipador', 'NTC choque'],
  control: ['RP2350B (QFN-80)', 'flash W25Q128', 'cristal 12 MHz', 'TPS54360', 'inductor 10 µH', 'C entrada 100 V', 'TPS62933', 'inductor 4.7 µH', 'DRV8874', 'USB-C', 'zumbador', 'LED verde', 'LED rojo'],
  conectores: ['J_CTRL', 'J_TS', 'J_PWR', 'J_48', 'J_MOT', 'J_FAN', 'J_GAT', 'J_PARO', 'J_RC', 'borne BUS+ M5', 'borne BUS− M5', 'borne OUT+ M6', 'borne OUT− M6'],
  mecanica: ['2 PCB', '8 separadores M3', 'cable plano de 10 hilos'],
  /** pasivos que esos chips piden y el 3D no dibuja (de sus hojas / del esquemático del WeAct, que es un RP2350B mínimo) */
  pasivosOcultos: { 'RP2350B + flash + cristal + USB': 35, TPS54360: 13, TPS62933: 7, DRV8874: 6, IR2110: 7, divisores: 4, 'NTC pull-ups': 2, zumbador: 1 },
};
export function cuentaPlaca(pl: Placa = PLACA) {
  const piezas = pl.componentes.length;
  const juntas = pl.componentes.reduce((a, c) => a + c.pines.length, 0) + pl.islas.length;
  const islas = pl.islas.length;
  const v3modelo = CUENTA_V3.potencia.length + CUENTA_V3.control.length;
  const v3ocultos = Object.values(CUENTA_V3.pasivosOcultos).reduce((a, b) => a + b, 0);
  return {
    piezas, juntas, islas, barrenos: pl.barrenos.length, conectores: 0, bornes: 0, pcbs: 1, mecanicas: MECANICA.reduce((a, m) => a + m.cant, 0),
    fueraDeLaPlaca: FUERA_DE_LA_PLACA.reduce((a, f) => a + f.cant, 0),
    porGrupo: pl.componentes.reduce<Record<string, number>>((a, c) => { a[c.grupo] = (a[c.grupo] ?? 0) + 1; return a; }, {}),
    smd: pl.componentes.filter((c) => c.montaje === 'SMD').length,
    smdAbajo: pl.componentes.filter((c) => c.montaje === 'SMD' && c.pos.lado === 'abajo').length,
    v3: { modeladas: v3modelo, pasivosOcultos: v3ocultos, total: v3modelo + v3ocultos, conectores: CUENTA_V3.conectores.length, pcbs: 2 },
  };
}
export interface FilaBOM { refs: string[]; cantidad: number; valor: string; parte: string; enc: string; huella: string; montaje: string; lado: Lado; grupo: Grupo; desc: string }
export function listaMateriales(pl: Placa = PLACA): FilaBOM[] {
  const m = new Map<string, FilaBOM>();
  for (const c of pl.componentes) {
    const k = `${c.parte}|${c.huella}|${c.pos.lado}`;
    const f = m.get(k);
    if (f) { f.refs.push(c.ref); f.cantidad++; }
    else m.set(k, { refs: [c.ref], cantidad: 1, valor: c.valor, parte: c.parte, enc: c.enc, huella: c.huella, montaje: c.montaje, lado: c.pos.lado, grupo: c.grupo, desc: c.desc });
  }
  return [...m.values()];
}
const csv = (x: string | number) => { const s = String(x); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const textoMX = (refs: string[], compras: CompraMX[]) => {
  const f = compras.find((x) => x.refs[0] === refs[0]);
  return f ? `${f.alternativas.map((a) => `${a.tienda}: ${a.parte}`).join(' | ')}${f.verificado ? '' : ' (SUPUESTO)'}` : '';
};
export function bomCSV(pl: Placa = PLACA): string {
  const compras = comprasMX(pl);
  const filas = [['refs', 'cantidad', 'valor', 'parte', 'encapsulado', 'huella KiCad', 'montaje', 'cara', 'grupo', 'para qué', 'México (alternativas)'].join(',')];
  for (const f of listaMateriales(pl)) filas.push([f.refs.join(' '), f.cantidad, f.valor, f.parte, f.enc, f.huella, f.montaje, f.lado, f.grupo, f.desc, textoMX(f.refs, compras)].map(csv).join(','));
  for (const mm of MECANICA) filas.push([mm.ref, mm.cant, '', mm.desc, '', '', 'mecánica', '', '', '', textoMX([mm.ref], compras)].map(csv).join(','));
  for (const ff of FUERA_DE_LA_PLACA) filas.push([ff.ref, ff.cant, ff.valor, ff.desc, '', '', 'fuera de la placa', '', 'seguridad', 'lo pone B', textoMX([ff.ref], compras)].map(csv).join(','));
  for (const b of pl.barrenos) filas.push([b.ref, 1, `barreno Ø${b.d}`, b.nota, 'NPTH', b.huella, 'barreno (sin pieza)', '', b.para, '', ''].map(csv).join(','));
  for (const is of pl.islas) filas.push([is.ref, 1, `isla cal ${is.awg}`, `${is.hilo} (${is.red})`, `agujero ${is.agujero} / anillo ${is.pad}`, is.huella, 'isla (sin pieza)', 'arriba', is.reserva ? 'RESERVA' : (is.puerto ?? ''), is.alivio ?? '', ''].map(csv).join(','));
  return filas.join('\n') + '\n';
}
/** posiciones (pick & place) para acomodar en Pcbnew: ref, x, y (Y de KiCad = −y), giro, cara */
export function posicionesCSV(pl: Placa = PLACA): string {
  const filas = ['ref,valor,huella,x_mm,y_mm_kicad,giro,cara'];
  for (const c of pl.componentes) filas.push([c.ref, c.valor, c.huella, c.pos.x.toFixed(2), (-c.pos.y).toFixed(2), c.pos.giro, c.pos.lado === 'arriba' ? 'top' : 'bottom'].map(csv).join(','));
  for (const is of pl.islas) filas.push([is.ref, `isla ${is.hilo}`, is.huella, is.x.toFixed(2), (-is.y).toFixed(2), 0, 'top'].map(csv).join(','));
  for (const b of pl.barrenos) filas.push([b.ref, `barreno Ø${b.d}`, b.huella, b.x.toFixed(2), (-b.y).toFixed(2), 0, 'top'].map(csv).join(','));
  return filas.join('\n') + '\n';
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 10. KiCad: la netlist «export (version D)» y su lector
// ════════════════════════════════════════════════════════════════════════════════════════════
const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const sello = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).toUpperCase().padStart(8, '0'); };
export function kicadNetlist(pl: Placa = PLACA, fecha = '2026-11-06'): string {
  const L: string[] = [];
  L.push('(export (version "D")');
  L.push('  (design');
  L.push(`    (source ${q('src/forja/lab/placa.ts')})`);
  L.push(`    (date ${q(fecha)})`);
  L.push(`    (tool ${q('La Forja · placa.ts (orden 2026-11-06-lab-placa-r2)')})`);
  L.push(`    (sheet (number "1") (name "/") (tstamps "/")`);
  L.push(`      (title_block (title ${q('La Pluma · placa soldada')}) (company ${q('La Forja')}) (rev "2") (date ${q(fecha)}) (source ${q('placa.ts')}))))`);
  L.push('  (components');
  const comps = [
    ...pl.componentes.map((c) => ({ ref: c.ref, valor: c.valor, huella: c.huella, desc: c.desc })),
    ...pl.islas.map((is) => ({ ref: is.ref, valor: `isla ${is.hilo}`, huella: is.huella, desc: `cable cal ${is.awg}${is.puerto ? ' → ' + is.puerto : ' (reserva)'}` })),
    ...pl.barrenos.map((b) => ({ ref: b.ref, valor: `barreno Ø${b.d}`, huella: b.huella, desc: b.nota })),
  ];
  for (const c of comps) {
    L.push(`    (comp (ref ${q(c.ref)})`);
    L.push(`      (value ${q(c.valor)})`);
    L.push(`      (footprint ${q(c.huella)})`);
    L.push(`      (libsource (lib ${q('forja_lab')}) (part ${q(c.ref.replace(/\d+$/, ''))}) (description ${q(c.desc)}))`);
    L.push(`      (sheetpath (names "/") (tstamps "/"))`);
    L.push(`      (tstamp ${sello(c.ref)}))`);
  }
  L.push('  )');
  L.push('  (nets');
  const nodos = nodosPorRed(pl);
  let code = 1;
  for (const nombre of [...nodos.keys()].sort()) {
    L.push(`    (net (code "${code++}") (name ${q('/' + nombre)})`);
    for (const x of nodos.get(nombre)!) L.push(`      (node (ref ${q(x.ref)}) (pin ${q(x.pin)}))`);
    L.push('    )');
  }
  L.push('  )');
  L.push(')');
  return L.join('\n') + '\n';
}
type SExp = string | SExp[];
export function leerSExp(txt: string): SExp {
  let i = 0;
  const salta = () => { while (i < txt.length && /\s/.test(txt[i])) i++; };
  const uno = (): SExp => {
    salta();
    if (txt[i] === '(') {
      i++;
      const l: SExp[] = [];
      for (;;) { salta(); if (txt[i] === ')') { i++; return l; } if (i >= txt.length) throw new Error('S-exp sin cerrar'); l.push(uno()); }
    }
    if (txt[i] === '"') {
      i++;
      let s = '';
      while (i < txt.length && txt[i] !== '"') { if (txt[i] === '\\') i++; s += txt[i++]; }
      i++;
      return s;
    }
    let s = '';
    while (i < txt.length && !/[\s()]/.test(txt[i])) s += txt[i++];
    return s;
  };
  return uno();
}
/** Lee una netlist de KiCad (export version D/E) de regreso: componentes y redes. */
export function leerKicadNetlist(txt: string) {
  const raiz = leerSExp(txt);
  if (!Array.isArray(raiz) || raiz[0] !== 'export') throw new Error('no es una netlist de KiCad');
  const hijo = (l: SExp, k: string) => (Array.isArray(l) ? l.find((x) => Array.isArray(x) && x[0] === k) as SExp[] | undefined : undefined);
  const val = (l: SExp, k: string) => { const h2 = hijo(l, k); return h2 && typeof h2[1] === 'string' ? h2[1] : ''; };
  const version = val(raiz, 'version');
  const comps = (hijo(raiz, 'components') ?? []).slice(1).map((c) => ({ ref: val(c, 'ref'), valor: val(c, 'value'), huella: val(c, 'footprint') }));
  const redes = (hijo(raiz, 'nets') ?? []).slice(1).map((n) => ({
    code: val(n, 'code'), nombre: val(n, 'name').replace(/^\//, ''),
    nodos: (Array.isArray(n) ? n : []).filter((x) => Array.isArray(x) && x[0] === 'node').map((x) => ({ ref: val(x, 'ref'), pin: val(x, 'pin') })),
  }));
  return { version, componentes: comps, redes };
}

// ── las huellas propias (forja_lab.pretty): pads en el marco de la huella (Y de KiCad hacia abajo) ──
export interface PadHuella { n: string; x: number; y: number; d: number; taladro: number; forma?: 'circle' | 'rect' }
export function huellasPropias(pl: Placa = PLACA): Record<string, { descr: string; pads: PadHuella[]; caja: [number, number, number, number] }> {
  const out: Record<string, { descr: string; pads: PadHuella[]; caja: [number, number, number, number] }> = {};
  const wa: PadHuella[] = [];
  for (let n = 1; n <= 60; n++) { const w = pinWeAct(String(n))!; wa.push({ n: String(n), x: w.lx, y: -w.ly, d: 1.7, taladro: 1.0, forma: w.nombre === 'G' ? 'rect' : 'circle' }); }
  out.WeAct_RP2350B_Core = { descr: 'WeAct Studio RP2350B Core V1.0: 2 × (2×15) P2.54, filas a ±16.51/±19.05 (su dibujo 尺寸图). Marco del módulo: USB-C en −x.', pads: wa, caja: [-20.7, -20.57, 20.7, 20.57] };
  const ss: PadHuella[] = [];
  for (let k = 0; k < 8; k++) ss.push({ n: String(k + 1), x: -6.35, y: -8.89 + 2.54 * k, d: 1.7, taladro: 1.0, forma: k === 0 ? 'rect' : 'circle' });
  for (let k = 0; k < 8; k++) ss.push({ n: String(9 + k), x: 6.35, y: 8.89 - 2.54 * k, d: 1.7, taladro: 1.0 });
  ss.push({ n: '17', x: 1.27, y: -8.89, d: 1.7, taladro: 1.0 });
  out.StepStick_TMC2209_DIAG = { descr: 'StepStick 15.24 × 20.32 (filas a 12.7) + DIAG. Pinout SUPUESTO (BTT V1.3): verificar.', pads: ss, caja: [-7.62, -10.16, 7.62, 10.16] };
  const L = pl.componentes.find((c) => c.ref === 'L1');
  const dxL = CHOQUE.padOUT[0] - CHOQUE.padSW[0], dyL = CHOQUE.padOUT[1] - CHOQUE.padSW[1];
  out.Choque_Aire_D60_L50 = { descr: `choque de aire 15 µH, 18 v. cal 10 (patas Ø2.6) · ${L ? L.parte : ''}`, pads: [
    { n: '1', x: 0, y: 0, d: 6, taladro: 3.2 }, { n: '2', x: dxL, y: -dyL, d: 6, taladro: 3.2 }], caja: [-2, -31, dxL + 2, 31] };
  out.Shunt_4T_THT_16mm = { descr: 'shunt de 4 terminales: I+ / S+ / S− / I− en línea (paso 4 / 8 / 4 mm)', pads: [
    { n: '1', x: 0, y: 0, d: 4, taladro: 2.0, forma: 'rect' }, { n: '2', x: -4, y: 0, d: 1.8, taladro: 1.0 },
    { n: '3', x: -12, y: 0, d: 1.8, taladro: 1.0 }, { n: '4', x: -16, y: 0, d: 4, taladro: 2.0 }], caja: [-18, -3, 2, 3] };
  out['Hilos_2_P3.0mm'] = { descr: 'dos islas para los hilos de un sensor que vive fuera (termostato, NTC)', pads: [
    { n: '1', x: 0, y: 0, d: 2, taladro: 1.0, forma: 'rect' }, { n: '2', x: 3, y: 0, d: 2, taladro: 1.0 }], caja: [-1.5, -1.5, 4.5, 1.5] };
  out['Fusible_TR5_P5.08'] = { descr: 'fusible TR5 soldado (Ø8.5, P5.08)', pads: [
    { n: '1', x: 0, y: 0, d: 2, taladro: 1.0 }, { n: '2', x: 5.08, y: 0, d: 2, taladro: 1.0 }], caja: [-1.7, -4.25, 6.8, 4.25] };
  out.TRACO_TEN40_2x1in = { descr: 'TRACO TEN 40 (25.4 × 50.8, a lo largo de Y): entrada en un extremo, salida en el otro. Pinout SUPUESTO: verificar.', pads: [
    { n: '1', x: -5.08, y: 22.86, d: 2.2, taladro: 1.2, forma: 'rect' }, { n: '2', x: 0, y: 22.86, d: 2.2, taladro: 1.2 }, { n: '3', x: 5.08, y: 22.86, d: 2.2, taladro: 1.2 },
    { n: '4', x: -5.08, y: -22.86, d: 2.2, taladro: 1.2 }, { n: '5', x: 0, y: -22.86, d: 2.2, taladro: 1.2 }, { n: '6', x: 5.08, y: -22.86, d: 2.2, taladro: 1.2 }], caja: [-12.7, -25.4, 12.7, 25.4] };
  out['SIP3_R78_P2.54'] = { descr: 'RECOM R-78E (SIP-3): 1 Vin · 2 GND · 3 Vout', pads: [
    { n: '1', x: 0, y: 0, d: 1.8, taladro: 1.0, forma: 'rect' }, { n: '2', x: 2.54, y: 0, d: 1.8, taladro: 1.0 }, { n: '3', x: 5.08, y: 0, d: 1.8, taladro: 1.0 }], caja: [-3.26, -4.25, 8.34, 4.25] };
  return out;
}
export function kicadMod(nombre: string, h: { descr: string; pads: PadHuella[]; caja: [number, number, number, number] }): string {
  const [x0, y0, x1, y1] = h.caja, f = (v: number) => +v.toFixed(3);
  const L = [`(footprint ${q(nombre)} (version 20221018) (generator "forja") (layer "F.Cu")`, `  (descr ${q(h.descr)})`, '  (attr through_hole)',
    `  (fp_text reference "REF**" (at 0 ${f(y0 - 1.5)}) (layer "F.SilkS") (effects (font (size 1 1) (thickness 0.15))))`,
    `  (fp_text value ${q(nombre)} (at 0 ${f(y1 + 1.5)}) (layer "F.Fab") (effects (font (size 1 1) (thickness 0.15))))`,
    `  (fp_rect (start ${f(x0)} ${f(y0)}) (end ${f(x1)} ${f(y1)}) (stroke (width 0.12) (type solid)) (fill none) (layer "F.SilkS"))`,
    `  (fp_rect (start ${f(x0 - 0.5)} ${f(y0 - 0.5)}) (end ${f(x1 + 0.5)} ${f(y1 + 0.5)}) (stroke (width 0.05) (type solid)) (fill none) (layer "F.CrtYd"))`];
  for (const pd of h.pads) L.push(`  (pad ${q(pd.n)} thru_hole ${pd.forma ?? 'circle'} (at ${f(pd.x)} ${f(pd.y)}) (size ${f(pd.d)} ${f(pd.d)}) (drill ${f(pd.taladro)}) (layers "*.Cu" "*.Mask"))`);
  L.push(')');
  return L.join('\n') + '\n';
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 11. LAS PIEZAS PARA VERLA EN LA FORJA
// ════════════════════════════════════════════════════════════════════════════════════════════
const BANCO = '/modelos/banco-arco/';
const COLOR_CABLE: Record<string, string> = { 'BUS+': '#c62828', 'OUT+': '#c4572b', GND: '#1b1b1b', 'OUT-': '#1b1b1b', '+12V': '#f08c2e', '+3V3': '#c62828', SD: '#f2c94c', PARO_R: '#f2c94c', TM_R: '#f2c94c', TC_R: '#f2c94c', ENC: '#3f6fd6' };
export function piezasPlaca(pl: Placa = PLACA): PiezaLab[] {
  const z = pl.zTop, out: PiezaLab[] = [];
  const caja = (id: string, name: string, k: Caja3, color: string, mat: PiezaLab['mat'], extra: Partial<PiezaLab> = {}): PiezaLab =>
    ({ id, name, kind: 'caja', w: k.x1 - k.x0, d: k.y1 - k.y0, h: k.z1 - k.z0, x: (k.x0 + k.x1) / 2, y: (k.y0 + k.y1) / 2, z: (k.z0 + k.z1) / 2, color, mat, ...extra });
  out.push({ id: 'pcb', name: 'PCB de La Pluma (FR4 2 oz, 2 capas, en L)', kind: 'placa', perfil: CONTORNO, h: ESPESOR, x: 0, y: 0, z: z - ESPESOR, color: '#1d4d2c', mat: 'pcb' });
  out.push({ id: 'hs1', name: 'Disipador 125×35×35 (aletas al difusor)', kind: 'malla', url: BANCO + 'disipador-125.bin', x: DISIPADOR.x, y: DISIPADOR.y, z, rz: DISIPADOR.rz, color: '#9aa3ad', mat: 'aluminio' });
  for (const c of pl.componentes) {
    const k = cajaComp(c, z), id = c.ref.toLowerCase(), nombre = `${c.ref} · ${c.valor}`;
    if (c.huella.includes('TO-220')) out.push({ id, name: nombre, kind: 'malla', url: BANCO + 'to220.bin', x: c.pos.x, y: c.pos.y, z, rz: c.pos.giro, color: '#2a2a2a', mat: 'plastico' });
    else if (c.enc.startsWith('MKS4 P27')) out.push({ id, name: nombre, kind: 'malla', url: BANCO + 'pelicula-mks4.bin', x: c.pos.x, y: c.pos.y, z, rz: 90, color: '#c43c3c', mat: 'plastico' });
    else if (c.enc.startsWith('snap-in')) out.push({ id, name: nombre, kind: 'cilindro', r: k.r ?? 15, h: k.z1 - k.z0, x: k.cx, y: k.cy, z: (k.z0 + k.z1) / 2, color: '#1d3f8a', mat: 'plastico' });
    else if (c.ref === 'L1') {
      const n = Math.round(CHOQUE.vueltas * 28), path: V3[] = [];
      for (let i = 0; i <= n; i++) { const a = (i / 28) * 2 * Math.PI; path.push([CHOQUE.x0 + (i / 28) * CHOQUE.paso, CHOQUE.y + CHOQUE.r * Math.sin(a), z + CHOQUE.sube + CHOQUE.r - CHOQUE.r * Math.cos(a)]); }
      out.push({ id, name: nombre + ' (18 v. cal 10)', kind: 'tubo', r: CHOQUE.alambre, path, x: 0, y: 0, z: 0, color: '#b87333', mat: 'cobre' });
      out.push({ id: id + '-p1', name: 'L1 · pata SW', kind: 'tubo', r: CHOQUE.alambre, path: [path[0], [CHOQUE.padSW[0], CHOQUE.padSW[1], z]], x: 0, y: 0, z: 0, color: '#b87333', mat: 'cobre' });
      out.push({ id: id + '-p2', name: 'L1 · pata OUT', kind: 'tubo', r: CHOQUE.alambre, path: [path[path.length - 1], [CHOQUE.padOUT[0], CHOQUE.padOUT[1], z]], x: 0, y: 0, z: 0, color: '#b87333', mat: 'cobre' });
    } else if (c.ref === 'U1') {
      out.push({ id, name: 'U1 · WeAct RP2350B Core', kind: 'grupo', x: c.pos.x, y: c.pos.y, z: z + WEACT.altoPines, rz: 90, color: '#121619', hijos: [
        { id: id + '-pcb', name: 'PCB del módulo', kind: 'caja', w: WEACT.w, d: WEACT.d, h: 1.6, x: 0, y: 0, z: 0.8, color: '#121619', mat: 'pcb' },
        { id: id + '-mcu', name: 'RP2350B (QFN-80)', kind: 'caja', w: 10, d: 10, h: 0.9, x: 2, y: -2, z: 2.05, rz: 45, color: '#1a1a1a', mat: 'plastico' },
        { id: id + '-usb', name: 'USB-C', kind: 'caja', w: 7.5, d: 9, h: 3.2, x: -WEACT.w / 2 + 3.25, y: 0, z: 3.2, color: '#c0c4ca', mat: 'acero' },
        { id: id + '-t1', name: 'tira 2×15', kind: 'caja', w: 38.1, d: 5.08, h: WEACT.altoPines, x: 0, y: 17.78, z: -WEACT.altoPines / 2, color: '#151515', mat: 'plastico' },
        { id: id + '-t2', name: 'tira 2×15', kind: 'caja', w: 38.1, d: 5.08, h: WEACT.altoPines, x: 0, y: -17.78, z: -WEACT.altoPines / 2, color: '#151515', mat: 'plastico' },
      ] });
    } else if (c.ref === 'U4') {
      out.push(caja(id, nombre + ' (módulo)', { ...k, z1: k.z0 + 1.6 }, '#1b5e20', 'pcb'));
      out.push(caja(id + '-hs', 'U4 · disipadorcito', { x0: k.cx - 4.5, x1: k.cx + 4.5, y0: k.cy - 4.5, y1: k.cy + 4.5, z0: k.z0 + 3, z1: k.z0 + 12, cx: k.cx, cy: k.cy }, '#9aa3ad', 'aluminio'));
    } else if (k.r) out.push({ id, name: nombre, kind: 'cilindro', r: k.r, h: k.z1 - k.z0, x: k.cx, y: k.cy, z: (k.z0 + k.z1) / 2, color: c.ref.startsWith('F') ? '#e8e2d0' : '#1d3f8a', mat: 'plastico' });
    else {
      const color = c.ref.startsWith('PS') ? '#3a3d42' : c.ref.startsWith('R30') ? '#c9a76a' : c.ref.startsWith('R') ? '#2f6db5' : c.ref.startsWith('C') ? '#d6a43a' : c.montaje === 'fuera' ? '#b8bec6' : '#151515';
      const mat: PiezaLab['mat'] = c.ref.startsWith('PS') ? 'aluminio' : c.ref === 'R30' ? 'laton' : c.montaje === 'fuera' ? 'acero' : 'plastico';
      out.push(caja(id, nombre + (c.pos.lado === 'abajo' ? ' (cara de abajo)' : ''), k, color, mat));
    }
  }
  for (const b of pl.barrenos) out.push({ id: `barreno-${b.ref.toLowerCase()}`, name: `${b.ref} · barreno Ø${b.d} (${b.para}: ${b.nota})`, kind: 'cilindro', r: b.d / 2, h: ESPESOR + 0.2, x: b.x, y: b.y, z: z - ESPESOR / 2, color: '#0b0b0b', mat: 'goma', aristas: false });
  for (const is of pl.islas) {
    out.push({ id: `isla-${is.ref.toLowerCase()}`, name: `Isla ${is.ref} · ${is.hilo} (cal ${is.awg})${is.reserva ? ' · reserva' : ''}`, kind: 'cilindro', r: is.pad / 2, h: 0.12, x: is.x, y: is.y, z: z + 0.06, color: '#c9a227', mat: 'laton', aristas: false });
    const s = subidaAlPuerto(is, pl);
    if (s) out.push({ id: `cable-${is.ref.toLowerCase()}`, name: `${is.ref} → ${is.puerto} (cal ${is.awg}, dentro de la bahía)`, kind: 'tubo', r: odCable(is.awg) / 2, path: s.puntos, x: 0, y: 0, z: 0, color: COLOR_CABLE[is.red] ?? '#9aa3ad', mat: 'goma' });
  }
  return out;
}

// ── utilidades de prueba/integración ────────────────────────────────────────────────────────
export const bahiaPlaca = (): Caja => BAHIA_PCB.caja;
export const puertosPlaca = (): Puerto[] => PUERTOS.filter((x) => x.modulo === 'PLACA_PCB');
export const contratoIntacto = () => BAHIAS.length > 0 && dentro([0, 0, 0], { x0: -1, y0: -1, z0: -1, x1: 1, y1: 1, z1: 1 });
export { slicePWM };
