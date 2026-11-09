/**
 * EL SISTEMA ELÉCTRICO DE LA PLUMA — una sola fuente de verdad (orden 2026-11-05-la-pluma-circuito-cableado)
 * =========================================================================================================
 * ian: «ARMA LOS CABLES DEL SISTEMA, PARA QUE NO HAYA ERRORES… CUIDA TEMPERATURA, CUIDA TAMAÑO, REDUCE, ACOMODA LA
 * PLACA DE COMPONENTES, PON UNA PCB DE CONTROL». De AQUÍ sale todo — nada se dibuja aparte:
 *
 *   1. LA DISPOSICIÓN (mm, marco de la cubierta: z = 0 es la cara de arriba de la loseta; la base está debajo):
 *      la placa de potencia (lazo Q1–D1–película apretado), la PCB de control (convenciones de NOVA OMNI: RP2350,
 *      buck de entrada, INA; el TPS5430 de la OMNI aguanta 36 V → aquí TPS54360 de 60 V), la base reducida.
 *   2. EL ARNÉS: conectores con pines con nombre + cables con calibre, color por función y RUTA 3D (el largo sale de
 *      la ruta). El REVISOR caza: pin suelto, dos fuentes en una red, calibre corto para su corriente, caída de
 *      voltaje, polaridad DCEN, el PARO que no corta la fase, lazo de potencia abierto, color fuera de norma.
 *   3. EL CIRCUITO VIVO sobre el MNA que ya existe (src/lib/circuitos/spice.ts): LRS (con su límite de 1200 W), bus
 *      electrolítico ∥ película (reparte el rizo DE VERDAD), IRFB4227 con su compuerta flotante, D1, choque de 15 µH
 *      con su resistencia, C de salida + D2 al bus, el cable, el ARCO (diodo + fuente viva + R) y el shunt. El PI del
 *      firmware decide la compuerta en cada periodo. Lo que sale del shunt es la corriente REAL que mueve la gota.
 *   4. TEMPERATURA: pérdidas medidas en el MNA (+ conmutación analítica) → red térmica (unión → disipador → aire).
 * Números de diseño: agentes 05 (circuito mínimo, 21 sims ngspice), 02, 04 y 10 (docs/investigacion-arco/).
 */
import type { Circuit, Element, MosfetParams, SimState } from '../../lib/circuitos/spice';
import { transientStep } from '../../lib/circuitos/spice';

export type V3 = [number, number, number];
export const Z0_BANCO = 118;   // el banco sube Z0 para pisar el suelo del visor (bancoArcoDoc)

// ════════════════════════════════════════════════════════════════════════════════════════════
// 1. LA DISPOSICIÓN — la base reducida y las dos placas
// ════════════════════════════════════════════════════════════════════════════════════════════
/** Base v3: 380 × 280 × 100 (antes 440 × 320 × 110 → −32 % de volumen). Cubierta: z −14…−8; piso: −108…−104. */
export const BASE = { x0: -245, x1: 135, y0: -140, y1: 140, zPiso: -108, zCubierta: -8 };
/** Placa de POTENCIA (FR4 de 2 oz, 150 × 92): esquina, tamaño y cara de arriba. */
export const PB = { x0: -215, y0: -128, w: 150, d: 92, z: -94.4 };
/** PCB de CONTROL (110 × 75, máscara negra estilo NOVA OMNI). */
export const CB = { x0: 15, y0: 30, w: 110, d: 75, z: -90.4 };

// ════════════════════════════════════════════════════════════════════════════════════════════
// 2. EL ARNÉS — conectores, pines, cables, calibres
// ════════════════════════════════════════════════════════════════════════════════════════════
export type Funcion = 'ac-fase' | 'ac-neutro' | 'tierra-fisica' | 'bus+' | 'bus-' | 'salida+' | 'salida-' | 'senal' | '12v' | 'gnd' | 'motor' | 'paro' | 'aux48';
export interface Pin { id: string; nombre: string; pos: V3; fuente?: boolean; nc?: boolean; red?: string }
export interface Conector { id: string; nombre: string; donde: string; pines: Pin[] }
export type Calibre = '26' | '24' | '22' | '20' | '18' | '16' | '14' | '12' | '10' | '8' | '6' | '4' | 'barra-20x3' | 'plano-10';
export interface Cable {
  id: string; nombre: string;
  de: string; a: string;          // 'CONECTOR.PIN'
  red: string; funcion: Funcion; calibre: Calibre; color: string;
  ruta: V3[];                     // del pin de origen al de destino (mm, marco de la cubierta)
  Irms: number; Ipico?: number;   // A
  Vnom: number;                   // V nominal de la red (para la caída relativa)
  par?: string;                   // cable con el que va trenzado/pegado (lazo chico)
}
/** Calibres: mm², diámetro exterior con aislante, ampacidad en chasis (conductor solo al aire), Ω/km a 20 °C. */
export const CALIBRES: Record<Calibre, { mm2: number; od: number; amp: number; ohmKm: number; nombre: string }> = {
  '26': { mm2: 0.13, od: 1.0, amp: 2.2, ohmKm: 133.9, nombre: '26 AWG' },
  '24': { mm2: 0.2, od: 1.2, amp: 3.5, ohmKm: 84.2, nombre: '24 AWG' },
  '22': { mm2: 0.33, od: 1.4, amp: 7, ohmKm: 52.9, nombre: '22 AWG' },
  '20': { mm2: 0.52, od: 1.6, amp: 11, ohmKm: 33.3, nombre: '20 AWG' },
  '18': { mm2: 0.82, od: 2.0, amp: 16, ohmKm: 20.9, nombre: '18 AWG' },
  '16': { mm2: 1.31, od: 2.4, amp: 22, ohmKm: 13.2, nombre: '16 AWG' },
  '14': { mm2: 2.08, od: 2.9, amp: 32, ohmKm: 8.3, nombre: '14 AWG' },
  '12': { mm2: 3.31, od: 3.5, amp: 41, ohmKm: 5.2, nombre: '12 AWG' },
  '10': { mm2: 5.26, od: 4.3, amp: 55, ohmKm: 3.3, nombre: '10 AWG' },
  '8': { mm2: 8.37, od: 5.8, amp: 73, ohmKm: 2.06, nombre: '8 AWG' },
  '6': { mm2: 13.3, od: 7.5, amp: 101, ohmKm: 1.3, nombre: '6 AWG (cable de soldar)' },
  '4': { mm2: 21.2, od: 9.0, amp: 135, ohmKm: 0.82, nombre: '4 AWG' },
  'barra-20x3': { mm2: 60, od: 6, amp: 200, ohmKm: 0.29, nombre: 'barra de cobre 20 × 3' },
  'plano-10': { mm2: 0.08, od: 2.2, amp: 1.4, ohmKm: 222, nombre: 'cable plano 10 × 28 AWG' },
};
/** Colores por función (NOM-001-SEDE para la alterna; DC: + rojo, − negro; señal gris/blanco). */
export const COLOR_FUNCION: Record<Funcion, string[]> = {
  'ac-fase': ['#1b1b1b'], 'ac-neutro': ['#efefef'], 'tierra-fisica': ['#2e9d4a'],
  'bus+': ['#c62828'], 'bus-': ['#1b1b1b'], 'salida+': ['#c4572b', '#c62828'], 'salida-': ['#1b1b1b'],
  'senal': ['#9aa3ad', '#efefef', '#3f6fd6'], '12v': ['#f08c2e'], 'gnd': ['#1b1b1b'], 'motor': ['#c62828', '#1b1b1b'],
  'paro': ['#f2c94c'], 'aux48': ['#c62828', '#1b1b1b'],
};

// Pines y posiciones (el orden de bornes de la LRS es SUPUESTO — verificar en la fuente real)
const P = (id: string, nombre: string, pos: V3, extra: Partial<Pin> = {}): Pin => ({ id, nombre, pos, ...extra });
export const CONECTORES: Conector[] = [
  { id: 'IEC', nombre: 'Entrada IEC C14 con interruptor y fusible', donde: 'pared izquierda', pines: [
    P('L', 'fase', [-243, -100, -56], { fuente: true, red: 'AC-L' }), P('N', 'neutro', [-243, -94, -62], { fuente: true, red: 'AC-N' }), P('PE', 'tierra física', [-243, -106, -62], { red: 'PE' })] },
  { id: 'PARO', nombre: 'PARO de emergencia (2 polos NC + aux)', donde: 'cubierta', pines: [
    P('L1', 'fase entra', [94, -115, -16], { red: 'AC-L' }), P('L2', 'fase sale', [106, -115, -16], { red: 'AC-L-PARO' }),
    P('N1', 'neutro entra', [94, -109, -16], { red: 'AC-N' }), P('N2', 'neutro sale', [106, -109, -16], { red: 'AC-N-PARO' }),
    P('A1', 'aux NC', [100, -121, -16], { red: 'PARO-AUX' }), P('A2', 'aux NC', [100, -127, -16], { red: 'PARO-AUX-R' })] },
  { id: 'LRS', nombre: 'Mean Well LRS-1200-48 (bornes)', donde: 'fondo de la base', pines: [
    P('L', 'AC L', [-230, 98, -84], { red: 'AC-L-PARO' }), P('N', 'AC N', [-230, 108, -84], { red: 'AC-N-PARO' }), P('FG', 'tierra', [-230, 118, -84], { red: 'PE' }),
    P('V+', '+V (3 bornes puenteados)', [-230, 34, -84], { fuente: true, red: 'BUS+' }), P('V-', '−V (3 bornes puenteados)', [-230, 62, -84], { red: 'BUS-' }),
    P('RC', 'apagado remoto', [-230, 82, -70], { red: 'RC' })] },
  { id: 'PB', nombre: 'Placa de potencia', donde: 'base, frente izquierda', pines: [
    P('BUS+', 'BUS+ (M5)', [-205, -48, -92], { red: 'BUS+' }), P('BUS-', 'BUS− (M5)', [-205, -60, -92], { red: 'BUS-' }),
    P('OUT+', 'OUT+ (M6, después del choque)', [-72, -50, -92], { fuente: true, red: 'SALIDA+' }), P('OUT-', 'OUT− (M6, después del shunt)', [-72, -66, -92], { red: 'SALIDA-' }),
    P('TS1', 'termostato', [-176, -106, -92], { red: 'TS' }), P('TS2', 'termostato', [-170, -106, -92], { red: 'TS-R' }),
    P('CTRL', 'J_CTRL 2×5 (PWM, SD, I, V, 12 V, GND)', [-120, -42, -91], { red: 'CTRL' }),
    P('A48+', '48 V aux (fusible 1 A)', [-196, -40, -92], { red: 'AUX48+' }), P('A48-', 'GND aux', [-190, -40, -92], { red: 'AUX48-' })] },
  { id: 'CB', nombre: 'PCB de control (RP2350)', donde: 'base, fondo derecha', pines: [
    P('PWR', 'J_PWR 2×5 (a la potencia)', [24, 96, -89], { red: 'CTRL' }),
    P('48+', 'J_48 +', [22, 40, -89], { red: 'AUX48+' }), P('48-', 'J_48 −', [22, 46, -89], { red: 'AUX48-' }),
    P('FAN+', 'J_FAN +12', [118, 38, -89], { fuente: true, red: 'FAN+' }), P('FAN-', 'J_FAN −', [118, 44, -89], { red: 'FAN-' }),
    P('MOT1', 'J_MOT A (DRV8874)', [104, 100, -89], { fuente: true, red: 'MOT-A' }), P('MOT2', 'J_MOT B', [112, 100, -89], { red: 'MOT-B' }),
    P('GAT1', 'J_GAT', [58, 102, -89], { red: 'GAT' }), P('GAT2', 'J_GAT', [64, 102, -89], { red: 'GAT-R' }),
    P('PARO1', 'J_PARO', [78, 102, -89], { red: 'PARO-AUX' }), P('PARO2', 'J_PARO', [84, 102, -89], { red: 'PARO-AUX-R' }),
    P('RC1', 'J_RC (apaga la LRS)', [38, 102, -89], { red: 'RC' }), P('RC2', 'J_RC', [44, 102, -89], { nc: true })] },
  { id: 'FAN', nombre: 'Ventilador 80 mm (12 V)', donde: 'pared derecha', pines: [
    P('+', '+12', [118, -68, -60], { red: 'FAN+' }), P('-', '−', [118, -72, -60], { red: 'FAN-' })] },
  { id: 'TERM', nombre: 'Termostato NC 70 °C (KSD9700) en el disipador', donde: 'disipador', pines: [
    P('1', '1', [-150, -104, -58], { red: 'TS' }), P('2', '2', [-144, -104, -58], { red: 'TS-R' })] },
  { id: 'GX12', nombre: 'GX12 del gatillo de la antorcha', donde: 'pared izquierda', pines: [
    P('1', 'gatillo', [-243, -40, -60], { fuente: true, red: 'GAT' }), P('2', 'gatillo', [-243, -34, -60], { red: 'GAT-R' })] },
  { id: 'MESA', nombre: 'Marco de cobre de la mesa (contacto +)', donde: 'sobre la loseta', pines: [
    P('+', 'marco (lado del alimentador)', [-104, 0, 1.5], { red: 'SALIDA+' })] },
  { id: 'ANT', nombre: 'Terminal de la antorcha en el alimentador', donde: 'alimentador', pines: [
    P('-', 'antorcha (−, DCEN)', [-120, 52, 34], { red: 'SALIDA-' })] },
  { id: 'MOT', nombre: 'Motor del alimentador (voltaje por medir)', donde: 'alimentador', pines: [
    P('A', 'A', [-158, 112, 49], { red: 'MOT-A' }), P('B', 'B', [-162, 112, 49], { red: 'MOT-B' })] },
];
const R = (pts: V3[]): V3[] => pts;
export const CABLES: Cable[] = [
  { id: 'C01', nombre: 'Fase → PARO', de: 'IEC.L', a: 'PARO.L1', red: 'AC-L', funcion: 'ac-fase', calibre: '16', color: '#1b1b1b', Irms: 6.6, Vnom: 220, par: 'C03',
    ruta: R([[-243, -100, -56], [-232, -112, -40], [-120, -128, -24], [60, -128, -22], [94, -118, -18], [94, -115, -16]]) },
  { id: 'C02', nombre: 'Fase (por el PARO) → LRS', de: 'PARO.L2', a: 'LRS.L', red: 'AC-L-PARO', funcion: 'ac-fase', calibre: '16', color: '#1b1b1b', Irms: 6.6, Vnom: 220, par: 'C04',
    ruta: R([[106, -115, -16], [112, -100, -24], [100, -20, -32], [-60, 40, -50], [-200, 96, -76], [-230, 98, -84]]) },
  { id: 'C03', nombre: 'Neutro → PARO', de: 'IEC.N', a: 'PARO.N1', red: 'AC-N', funcion: 'ac-neutro', calibre: '16', color: '#efefef', Irms: 6.6, Vnom: 220, par: 'C01',
    ruta: R([[-243, -94, -62], [-232, -106, -44], [-120, -122, -26], [60, -122, -24], [94, -112, -18], [94, -109, -16]]) },
  { id: 'C04', nombre: 'Neutro (por el PARO) → LRS', de: 'PARO.N2', a: 'LRS.N', red: 'AC-N-PARO', funcion: 'ac-neutro', calibre: '16', color: '#efefef', Irms: 6.6, Vnom: 220, par: 'C02',
    ruta: R([[106, -109, -16], [116, -96, -26], [104, -14, -34], [-56, 46, -52], [-200, 106, -78], [-230, 108, -84]]) },
  { id: 'C05', nombre: 'Tierra física → LRS', de: 'IEC.PE', a: 'LRS.FG', red: 'PE', funcion: 'tierra-fisica', calibre: '16', color: '#2e9d4a', Irms: 0, Vnom: 0,
    ruta: R([[-243, -106, -62], [-240, -106, -100], [-240, 112, -100], [-232, 118, -88], [-230, 118, -84]]) },
  { id: 'C06', nombre: 'Bus + (LRS → placa de potencia)', de: 'LRS.V+', a: 'PB.BUS+', red: 'BUS+', funcion: 'bus+', calibre: '10', color: '#c62828', Irms: 25, Ipico: 27, Vnom: 48, par: 'C07',
    ruta: R([[-230, 34, -84], [-226, 10, -96], [-214, -30, -98], [-205, -48, -92]]) },
  { id: 'C07', nombre: 'Bus − (LRS → placa de potencia)', de: 'LRS.V-', a: 'PB.BUS-', red: 'BUS-', funcion: 'bus-', calibre: '10', color: '#1b1b1b', Irms: 25, Ipico: 27, Vnom: 48, par: 'C06',
    ruta: R([[-230, 62, -84], [-222, 14, -100], [-210, -34, -100], [-205, -60, -92]]) },
  { id: 'C08', nombre: 'Salida + (barra → marco de la mesa)', de: 'PB.OUT+', a: 'MESA.+', red: 'SALIDA+', funcion: 'salida+', calibre: 'barra-20x3', color: '#c4572b', Irms: 40, Ipico: 70, Vnom: 30, par: 'C09',
    ruta: R([[-72, -50, -92], [-90, -38, -80], [-104, -12, -40], [-106, -4, -14], [-106, 0, -4], [-104, 0, 1.5]]) },
  { id: 'C09', nombre: 'Salida − (shunt → antorcha)', de: 'PB.OUT-', a: 'ANT.-', red: 'SALIDA-', funcion: 'salida-', calibre: '6', color: '#1b1b1b', Irms: 40, Ipico: 70, Vnom: 30, par: 'C08',
    ruta: R([[-72, -66, -92], [-96, -44, -80], [-112, -10, -40], [-120, 30, -20], [-122, 48, -8], [-121, 51, 12], [-120, 52, 34]]) },
  { id: 'C10', nombre: 'Termostato → SD del IR2110', de: 'TERM.1', a: 'PB.TS1', red: 'TS', funcion: 'senal', calibre: '22', color: '#efefef', Irms: 0.01, Vnom: 12, par: 'C11',
    ruta: R([[-150, -104, -58], [-160, -108, -80], [-176, -106, -92]]) },
  { id: 'C11', nombre: 'Termostato (retorno)', de: 'TERM.2', a: 'PB.TS2', red: 'TS-R', funcion: 'senal', calibre: '22', color: '#efefef', Irms: 0.01, Vnom: 12, par: 'C10',
    ruta: R([[-144, -104, -58], [-156, -110, -80], [-170, -106, -92]]) },
  { id: 'C12', nombre: 'Cable plano de control (PWM, SD, I, V, 12 V, GND)', de: 'PB.CTRL', a: 'CB.PWR', red: 'CTRL', funcion: 'senal', calibre: 'plano-10', color: '#9aa3ad', Irms: 0.3, Vnom: 12,
    ruta: R([[-120, -42, -91], [-100, -20, -78], [-40, 20, -62], [0, 70, -66], [24, 96, -89]]) },
  { id: 'C13', nombre: '48 V auxiliar + (al buck de control)', de: 'PB.A48+', a: 'CB.48+', red: 'AUX48+', funcion: 'aux48', calibre: '20', color: '#c62828', Irms: 0.4, Vnom: 48, par: 'C14',
    ruta: R([[-196, -40, -92], [-180, -10, -86], [-60, 20, -64], [0, 38, -70], [22, 40, -89]]) },
  { id: 'C14', nombre: '48 V auxiliar −', de: 'PB.A48-', a: 'CB.48-', red: 'AUX48-', funcion: 'aux48', calibre: '20', color: '#1b1b1b', Irms: 0.4, Vnom: 48, par: 'C13',
    ruta: R([[-190, -40, -92], [-176, -6, -86], [-58, 24, -64], [0, 44, -70], [22, 46, -89]]) },
  { id: 'C15', nombre: 'Ventilador +12', de: 'CB.FAN+', a: 'FAN.+', red: 'FAN+', funcion: '12v', calibre: '24', color: '#f08c2e', Irms: 0.25, Vnom: 12, par: 'C16',
    ruta: R([[118, 38, -89], [124, 10, -80], [122, -40, -66], [118, -68, -60]]) },
  { id: 'C16', nombre: 'Ventilador −', de: 'CB.FAN-', a: 'FAN.-', red: 'FAN-', funcion: 'gnd', calibre: '24', color: '#1b1b1b', Irms: 0.25, Vnom: 12, par: 'C15',
    ruta: R([[118, 44, -89], [126, 14, -80], [124, -44, -66], [118, -72, -60]]) },
  { id: 'C17', nombre: 'Motor del alimentador A', de: 'CB.MOT1', a: 'MOT.A', red: 'MOT-A', funcion: 'motor', calibre: '18', color: '#c62828', Irms: 2.5, Ipico: 6, Vnom: 24, par: 'C18',
    ruta: R([[104, 100, -89], [60, 118, -60], [-100, 124, -30], [-150, 116, -12], [-156, 113, 20], [-158, 112, 49]]) },
  { id: 'C18', nombre: 'Motor del alimentador B', de: 'CB.MOT2', a: 'MOT.B', red: 'MOT-B', funcion: 'motor', calibre: '18', color: '#1b1b1b', Irms: 2.5, Ipico: 6, Vnom: 24, par: 'C17',
    ruta: R([[112, 100, -89], [64, 122, -60], [-100, 128, -30], [-154, 118, -12], [-160, 114, 20], [-162, 112, 49]]) },
  { id: 'C19', nombre: 'Gatillo (GX12 → control)', de: 'GX12.1', a: 'CB.GAT1', red: 'GAT', funcion: 'senal', calibre: '22', color: '#efefef', Irms: 0.01, Vnom: 3.3, par: 'C20',
    ruta: R([[-243, -40, -60], [-230, -20, -50], [-60, 60, -48], [40, 100, -60], [58, 102, -89]]) },
  { id: 'C20', nombre: 'Gatillo (retorno)', de: 'GX12.2', a: 'CB.GAT2', red: 'GAT-R', funcion: 'senal', calibre: '22', color: '#3f6fd6', Irms: 0.01, Vnom: 3.3, par: 'C19',
    ruta: R([[-243, -34, -60], [-230, -14, -50], [-60, 66, -48], [44, 104, -60], [64, 102, -89]]) },
  { id: 'C21', nombre: 'PARO auxiliar → control', de: 'PARO.A1', a: 'CB.PARO1', red: 'PARO-AUX', funcion: 'paro', calibre: '22', color: '#f2c94c', Irms: 0.01, Vnom: 3.3, par: 'C22',
    ruta: R([[100, -121, -16], [110, -100, -30], [96, 40, -50], [78, 102, -89]]) },
  { id: 'C22', nombre: 'PARO auxiliar (retorno)', de: 'PARO.A2', a: 'CB.PARO2', red: 'PARO-AUX-R', funcion: 'paro', calibre: '22', color: '#f2c94c', Irms: 0.01, Vnom: 3.3, par: 'C21',
    ruta: R([[100, -127, -16], [116, -104, -30], [102, 40, -50], [84, 102, -89]]) },
  { id: 'C23', nombre: 'Apagado remoto de la LRS', de: 'LRS.RC', a: 'CB.RC1', red: 'RC', funcion: 'senal', calibre: '24', color: '#3f6fd6', Irms: 0.01, Vnom: 5,
    ruta: R([[-230, 82, -70], [-200, 90, -56], [-40, 100, -50], [38, 102, -89]]) },
];

// ── utilidades del arnés ──
export const largoRuta = (r: V3[]) => r.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - r[i][0], p[1] - r[i][1], p[2] - r[i][2]), 0);
/** Largo de corte: ruta × 1.08 (holgura) + 2 × 25 mm (pelado y terminal). */
export const largoCorte = (c: Cable) => Math.round(largoRuta(c.ruta) * 1.08 + 50);
const pinDe = (ref: string, cons: Conector[]) => {
  const [cid, pid] = ref.split('.');
  const c = cons.find((x) => x.id === cid);
  return c?.pines.find((p) => p.id === pid);
};

export interface Hallazgo { nivel: 'error' | 'aviso'; regla: string; donde: string; texto: string }
/**
 * EL REVISOR DEL CABLEADO. Reglas (las que en un banco real queman cosas):
 *   E1 todo pin conectado (o NC declarado) · E2 los extremos de cada cable existen y son de su red
 *   E3 ampacidad: Irms·1.25 ≤ ampacidad del calibre · E4 caída: ida y vuelta ≤ 2 % (aviso > 1 %)
 *   E5 una sola fuente por red · E6 polaridad DCEN: SALIDA+ a la mesa, SALIDA− a la antorcha
 *   E7 la alterna pasa por el PARO antes de la LRS · E8 pares de potencia pegados (lazo chico)
 *   E9 color por función (NOM-001 / DC)
 */
export function revisarCableado(cons: Conector[] = CONECTORES, cables: Cable[] = CABLES): Hallazgo[] {
  const h: Hallazgo[] = [];
  const usados = new Set<string>();
  for (const c of cables) {
    for (const ref of [c.de, c.a]) {
      const p = pinDe(ref, cons);
      if (!p) { h.push({ nivel: 'error', regla: 'E2', donde: c.id, texto: `${c.nombre}: el pin ${ref} no existe` }); continue; }
      usados.add(ref);
      if (p.red && p.red !== c.red) h.push({ nivel: 'error', regla: 'E2', donde: c.id, texto: `${c.nombre}: el pin ${ref} es de la red ${p.red}, el cable dice ${c.red}` });
    }
    const cal = CALIBRES[c.calibre];
    if (c.Irms * 1.25 > cal.amp) h.push({ nivel: 'error', regla: 'E3', donde: c.id, texto: `${c.nombre}: ${c.Irms} A × 1.25 > ${cal.amp} A que aguanta el ${cal.nombre}` });
    if (c.Vnom > 0 && c.Irms > 0.5) {
      const caida = (2 * c.Irms * cal.ohmKm * largoCorte(c)) / 1e6;   // ida y vuelta (el par lleva lo mismo)
      const rel = caida / c.Vnom;
      if (rel > 0.02) h.push({ nivel: 'error', regla: 'E4', donde: c.id, texto: `${c.nombre}: cae ${(caida * 1000).toFixed(0)} mV (${(rel * 100).toFixed(1)} % de ${c.Vnom} V)` });
      else if (rel > 0.01) h.push({ nivel: 'aviso', regla: 'E4', donde: c.id, texto: `${c.nombre}: cae ${(caida * 1000).toFixed(0)} mV (${(rel * 100).toFixed(1)} %)` });
    }
    if (!COLOR_FUNCION[c.funcion].includes(c.color)) h.push({ nivel: 'aviso', regla: 'E9', donde: c.id, texto: `${c.nombre}: color fuera de la convención de «${c.funcion}»` });
  }
  for (const con of cons) for (const p of con.pines) {
    const ref = `${con.id}.${p.id}`;
    if (!p.nc && !usados.has(ref)) h.push({ nivel: 'error', regla: 'E1', donde: ref, texto: `${con.nombre}: el pin «${p.nombre}» (${ref}) no está conectado` });
  }
  // E5: una sola fuente por red
  const fuentes = new Map<string, string[]>();
  for (const con of cons) for (const p of con.pines) if (p.fuente && p.red) fuentes.set(p.red, [...(fuentes.get(p.red) ?? []), `${con.id}.${p.id}`]);
  for (const [red, f] of fuentes) if (f.length > 1) h.push({ nivel: 'error', regla: 'E5', donde: red, texto: `la red ${red} tiene ${f.length} fuentes: ${f.join(', ')}` });
  // E6: DCEN
  const sal = (red: string) => cables.filter((c) => c.red === red).flatMap((c) => [c.de, c.a]);
  if (!sal('SALIDA+').includes('MESA.+')) h.push({ nivel: 'error', regla: 'E6', donde: 'SALIDA+', texto: 'DCEN: la salida + debe ir a la MESA (la pieza), no a la antorcha' });
  if (!sal('SALIDA-').includes('ANT.-')) h.push({ nivel: 'error', regla: 'E6', donde: 'SALIDA-', texto: 'DCEN: la salida − debe ir a la ANTORCHA (el alambre)' });
  // E7: la fase llega a la LRS solo por el PARO
  const aLrsL = cables.filter((c) => c.a === 'LRS.L' || c.de === 'LRS.L');
  if (!aLrsL.every((c) => c.de === 'PARO.L2' || c.a === 'PARO.L2')) h.push({ nivel: 'error', regla: 'E7', donde: 'LRS.L', texto: 'la fase llega a la LRS sin pasar por el PARO' });
  // E8: pares de potencia pegados (separación media de las rutas)
  for (const c of cables) {
    if (!c.par || c.Irms < 5) continue;
    const o = cables.find((x) => x.id === c.par); if (!o) continue;
    const n = 24; let s = 0;
    for (let k = 0; k <= n; k++) { const a = puntoEn(c.ruta, k / n), b = puntoEn(o.ruta, k / n); s += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
    const sep = s / (n + 1);
    if (sep > 45) h.push({ nivel: 'aviso', regla: 'E8', donde: c.id, texto: `${c.nombre}: va a ${sep.toFixed(0)} mm de su par (${o.id}) — lazo abierto = inductancia y campo; trénzalos` });
  }
  return h;
}
function puntoEn(r: V3[], u: number): V3 {
  const L = largoRuta(r); let objetivo = u * L;
  for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1], r[i][2] - r[i - 1][2]);
    if (objetivo <= d || i === r.length - 1) { const t = d ? Math.min(1, objetivo / d) : 0; return [r[i - 1][0] + (r[i][0] - r[i - 1][0]) * t, r[i - 1][1] + (r[i][1] - r[i - 1][1]) * t, r[i - 1][2] + (r[i][2] - r[i - 1][2]) * t]; }
    objetivo -= d;
  }
  return r[r.length - 1];
}
/** La lista de corte (lo que se imprime y se pega en la pared del taller). */
export function listaDeCorte(cables: Cable[] = CABLES) {
  return cables.map((c) => {
    const cal = CALIBRES[c.calibre], L = largoCorte(c);
    return { id: c.id, nombre: c.nombre, de: c.de, a: c.a, calibre: cal.nombre, color: c.color, largo_mm: L,
      R_mohm: +(cal.ohmKm * L / 1000).toFixed(2), I_rms: c.Irms, carga_pct: Math.round((100 * c.Irms) / cal.amp) };
  });
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 2b. EL RP2350B DE LA PCB DE CONTROL: cada GPIO con su función, revisado contra los datos OFICIALES del SDK
//     (pico-sdk 2.x · src/rp2350/rp2350b_interface_pins.json · hardware_regs/include/hardware/platform_defs.h)
// ════════════════════════════════════════════════════════════════════════════════════════════
/**
 * Los hechos del chip, copiados del SDK (no de memoria):
 *  · 48 GPIO (NUM_BANK0_GPIOS 48 en el B) · 12 slices de PWM (NUM_PWM_SLICES 12): slice → canal A / canal B
 *  · ADC: ADC_BASE_PIN 40, NUM_ADC_CHANNELS 9 = GP40–47 + el sensor de temperatura. El Pico 2 (RP2350A) solo tiene
 *    GP26–29 y GP29 es VSYS/3 → 3 libres; con el B en nuestra PCB hay 8 → vuelven los NTC (centavos)
 *  · UART0 TX/RX y UART1 TX/RX: los pines de la tabla de interfaces
 *  · fsys 150 MHz → PWM de 100 kHz = TOP 1499 (1500 niveles; la simulación arrastra el resto, como el timer)
 */
export const RP2350B = {
  gpios: 48, fsys: 150e6, adcBase: 40, adcCanales: 8,
  pwm: [[[0, 16], [1, 17]], [[2, 18], [3, 19]], [[4, 20], [5, 21]], [[6, 22], [7, 23]], [[8, 24], [9, 25]], [[10, 26], [11, 27]],
    [[12, 28], [13, 29]], [[14, 30], [15, 31]], [[32, 40], [33, 41]], [[34, 42], [35, 43]], [[36, 44], [37, 45]], [[38, 46], [39, 47]]] as number[][][],
  uart: [
    { TX: [0, 2, 12, 14, 16, 18, 28, 30, 32, 34, 44, 46], RX: [1, 3, 13, 15, 17, 19, 29, 31, 33, 35, 45, 47] },
    { TX: [4, 6, 8, 10, 20, 22, 24, 26, 36, 38, 40, 42], RX: [5, 7, 9, 11, 21, 23, 25, 27, 37, 39, 41, 43] },
  ],
};
export type TipoPin = 'pwm' | 'adc' | 'entrada' | 'salida' | 'uart-tx' | 'uart-rx';
export interface PinMCU { gpio: number; tipo: TipoPin; va: string; por?: string; frec?: number; uart?: 0 | 1; nota?: string }
/** el plano de 10 hilos J_PWR (control ↔ potencia): tierra junto a la compuerta, señales lentas al final */
export const J_PWR_PINOUT = ['+12 V', 'GND', 'HIN (compuerta)', 'GND', 'SD (apagado)', 'I arco (INA240)', 'V salida', 'V bus', 'NTC disipador', 'NTC choque'];
export const PINES: PinMCU[] = [
  { gpio: 0, tipo: 'pwm', frec: 100e3, va: 'IR2110 HIN → Q1', por: 'J_PWR.3', nota: 'slice 0 A · 1500 niveles' },
  { gpio: 1, tipo: 'salida', va: 'IR2110 SD (vía NPN)', por: 'J_PWR.5', nota: 'falla-segura: SD con pull-up = APAGADO; lo bajan en serie el NPN + termostato NC + contacto del PARO' },
  { gpio: 2, tipo: 'pwm', frec: 20e3, va: 'DRV8874 EN (velocidad del motor)', nota: 'slice 1 A · 7500 niveles' },
  { gpio: 3, tipo: 'salida', va: 'DRV8874 PH (sentido)' },
  { gpio: 4, tipo: 'salida', va: 'DRV8874 nSLEEP' },
  { gpio: 5, tipo: 'entrada', va: 'DRV8874 nFAULT (pull-up)' },
  { gpio: 6, tipo: 'pwm', frec: 25e3, va: 'ventilador (MOSFET lado bajo, J_FAN)', nota: 'slice 3 A' },
  { gpio: 8, tipo: 'entrada', va: 'gatillo de la antorcha', por: 'J_GAT', nota: 'GX12 → J_GAT, pull-up + RC' },
  { gpio: 9, tipo: 'entrada', va: 'PARO (contacto auxiliar)', por: 'J_PARO' },
  { gpio: 10, tipo: 'salida', va: 'apagado remoto de la LRS (optoacoplador)', por: 'J_RC', nota: 'lógica del RC de la LRS: SUPUESTA, verificar en su hoja' },
  { gpio: 11, tipo: 'salida', va: 'zumbador' },
  { gpio: 12, tipo: 'salida', va: 'LED verde (listo)' },
  { gpio: 13, tipo: 'salida', va: 'LED rojo (falla)' },
  { gpio: 14, tipo: 'uart-tx', uart: 0, va: 'consola (TX)' },
  { gpio: 15, tipo: 'uart-rx', uart: 0, va: 'consola (RX)' },
  { gpio: 40, tipo: 'adc', va: 'I del arco · INA240A2 ×50 sobre 0.5 mΩ = 25 mV/A (tope 132 A)', por: 'J_PWR.6' },
  { gpio: 41, tipo: 'adc', va: 'V de salida · divisor 20:1 (0–66 V)', por: 'J_PWR.7' },
  { gpio: 42, tipo: 'adc', va: 'V del bus · divisor 20:1', por: 'J_PWR.8' },
  { gpio: 43, tipo: 'adc', va: 'fcem del motor · divisor 10:1 (puente en reposo)' },
  { gpio: 44, tipo: 'adc', va: 'I del motor · IPROPI del DRV8874' },
  { gpio: 45, tipo: 'adc', va: 'NTC 10 k del disipador', por: 'J_PWR.9' },
  { gpio: 46, tipo: 'adc', va: 'NTC 10 k del choque', por: 'J_PWR.10' },
];
/** slice y canal del PWM de un GPIO (de la tabla del SDK); null si el pin no tiene PWM */
export function slicePWM(g: number): { slice: number; canal: 'A' | 'B' } | null {
  for (let k = 0; k < RP2350B.pwm.length; k++) {
    if (RP2350B.pwm[k][0].includes(g)) return { slice: k, canal: 'A' };
    if (RP2350B.pwm[k][1].includes(g)) return { slice: k, canal: 'B' };
  }
  return null;
}
/**
 * El revisor de pines (corre contra los datos del SDK):
 *   P1 el GPIO existe · P2 un pin, una función · P3 el PWM está en un slice · P4 dos PWM de frecuencia distinta NO
 *   comparten slice (comparten TOP y divisor) · P5 el ADC solo en GP40–47 · P6 UART TX/RX en su tabla · P7 un hilo del
 *   plano J_PWR, una señal · P8 resolución del PWM (aviso si < 256 niveles)
 */
export function revisarPines(pines: PinMCU[] = PINES): Hallazgo[] {
  const h: Hallazgo[] = [], usado = new Map<number, PinMCU>(), hilo = new Map<string, PinMCU>(), porSlice = new Map<number, PinMCU>();
  for (const q of pines) {
    const d = `GP${q.gpio}`;
    if (!(Number.isInteger(q.gpio) && q.gpio >= 0 && q.gpio < RP2350B.gpios)) { h.push({ nivel: 'error', regla: 'P1', donde: d, texto: `el RP2350B no tiene ${d}` }); continue; }
    const otro = usado.get(q.gpio);
    if (otro) h.push({ nivel: 'error', regla: 'P2', donde: d, texto: `${d} lo usan «${otro.va}» y «${q.va}»` }); else usado.set(q.gpio, q);
    if (q.tipo === 'pwm') {
      const sl = slicePWM(q.gpio);
      if (!sl) h.push({ nivel: 'error', regla: 'P3', donde: d, texto: `${d} no está en ningún slice de PWM` });
      else {
        const prev = porSlice.get(sl.slice);
        if (prev && prev.frec !== q.frec) h.push({ nivel: 'error', regla: 'P4', donde: d, texto: `«${q.va}» (${(q.frec ?? 0) / 1e3} kHz) comparte el slice ${sl.slice} con «${prev.va}» (${(prev.frec ?? 0) / 1e3} kHz): un slice tiene UN TOP` });
        porSlice.set(sl.slice, q);
        const niveles = Math.floor(RP2350B.fsys / (q.frec ?? 1));
        if (niveles < 256) h.push({ nivel: 'aviso', regla: 'P8', donde: d, texto: `«${q.va}»: solo ${niveles} niveles de PWM` });
      }
    }
    if (q.tipo === 'adc' && !(q.gpio >= RP2350B.adcBase && q.gpio < RP2350B.adcBase + RP2350B.adcCanales))
      h.push({ nivel: 'error', regla: 'P5', donde: d, texto: `«${q.va}» pide ADC pero el RP2350B solo lo tiene en GP40–47` });
    if (q.tipo === 'uart-tx' || q.tipo === 'uart-rx') {
      const t = RP2350B.uart[q.uart ?? 0][q.tipo === 'uart-tx' ? 'TX' : 'RX'];
      if (!t.includes(q.gpio)) h.push({ nivel: 'error', regla: 'P6', donde: d, texto: `${d} no puede ser ${q.tipo === 'uart-tx' ? 'TX' : 'RX'} de la UART${q.uart ?? 0}` });
    }
    if (q.por?.startsWith('J_PWR.')) {
      const k = +q.por.slice(6), prev = hilo.get(q.por);
      if (!(k >= 1 && k <= J_PWR_PINOUT.length)) h.push({ nivel: 'error', regla: 'P7', donde: d, texto: `${q.por} no existe en el plano de ${J_PWR_PINOUT.length} hilos` });
      else if (prev) h.push({ nivel: 'error', regla: 'P7', donde: d, texto: `${q.por} lleva «${prev.va}» y «${q.va}»` });
      else hilo.set(q.por, q);
    }
  }
  return h;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 3. EL CIRCUITO VIVO (MNA de spice.ts) + el PI del firmware
// ════════════════════════════════════════════════════════════════════════════════════════════
/** IRFB4227 (IR/Infineon): 200 V, 65 A, R_DS(on) 19.7 mΩ máx @ 10 V, V_GS(th) 3–5 V → Kp = 1/(R·(Vgs−Vth)) a 12 V. */
export const IRFB4227: MosfetParams = { Vth: 4.0, Kp: 1 / (0.0197 * 8), lambda: 0.002, name: 'IRFB4227 200V/65A · Rds 19.7mΩ@10V' };
export interface PlumaParams {
  fpwm: number; L: number; RL: number; Lcable: number; Rcable: number;
  Cbus: number; esrBus: number; Cfilm: number; esrFilm: number; Cout: number;
  Rshunt: number; Vlrs: number; Rlrs: number; Vgate: number;
  Kp: number; Ki: number; Dmax: number; Imin: number;
  trf: number;   // s: subida + bajada de la conmutación (pérdida analítica)
}
export const PLUMA: PlumaParams = {
  fpwm: 100e3, L: 15e-6, RL: 0.011, Lcable: 0.3e-6, Rcable: 0.006,
  Cbus: 4400e-6, esrBus: 0.0125, Cfilm: 30e-6, esrFilm: 0.0015, Cout: 1e-6,   // 2 snap-in de 25 mΩ a 100 kHz en paralelo
  Rshunt: 0.0005, Vlrs: 48, Rlrs: 0.03, Vgate: 12,
  Kp: 0.012, Ki: 900, Dmax: 0.85, Imin: 8,
  trf: 60e-9,
};
// nodos: 1 LRS interna · 2 BUS · 3 interna electrolítico · 4 interna película · 5 SW · 6 compuerta · 7 interna choque
//        8 OUT (salida +) · 9 tras el cable · 10 interna arco · 11 interna arco · 12 ALAMBRE (sobre el shunt)
export function circuitoPluma(p: PlumaParams = PLUMA): Circuit {
  const e: Element[] = [
    { kind: 'V', id: 'Vlrs', a: 1, b: 0, value: p.Vlrs },
    { kind: 'R', id: 'Rlrs', a: 1, b: 2, value: p.Rlrs },
    { kind: 'C', id: 'Cbus', a: 2, b: 3, value: p.Cbus, ic: p.Vlrs },
    { kind: 'R', id: 'Resr', a: 3, b: 0, value: p.esrBus },
    { kind: 'C', id: 'Cfilm', a: 2, b: 4, value: p.Cfilm, ic: p.Vlrs },
    { kind: 'R', id: 'Rfilm', a: 4, b: 0, value: p.esrFilm },
    { kind: 'M', id: 'Q1', d: 2, g: 6, s: 5, params: IRFB4227 },
    { kind: 'V', id: 'Vg', a: 6, b: 5, value: 0 },
    { kind: 'D', id: 'D1', a: 0, b: 5, Is: 1e-9, n: 1.1 },
    { kind: 'L', id: 'L1', a: 5, b: 7, value: p.L },
    { kind: 'R', id: 'RL', a: 7, b: 8, value: p.RL },
    { kind: 'C', id: 'Cout', a: 8, b: 0, value: p.Cout },
    { kind: 'D', id: 'D2', a: 8, b: 2, Is: 1e-9, n: 1.1 },
    { kind: 'L', id: 'Lcab', a: 8, b: 9, value: p.Lcable },
    { kind: 'R', id: 'Rcab', a: 9, b: 10, value: p.Rcable },
    { kind: 'D', id: 'Darc', a: 10, b: 11, Is: 1e-6, n: 2 },
    { kind: 'V', id: 'Varc', a: 11, b: 12, value: 20 },
    { kind: 'R', id: 'Rsh', a: 12, b: 0, value: p.Rshunt },
  ];
  return { nodeCount: 12, elements: e };
}

/** Lo que el firmware ve y decide, más lo que el circuito hace de verdad. */
export interface PlumaSim {
  p: PlumaParams; c: Circuit; st: SimState;
  el: { Vg: Extract<Element, { kind: 'V' }>; Varc: Extract<Element, { kind: 'V' }>; Vlrs: Extract<Element, { kind: 'V' }> };
  t: number; dt: number;
  D: number; integ: number; gate: boolean; tPer: number; nOn: number; resto: number;
  Imed: number; sumI: number; nI: number;   // lo que mide el firmware: el PROMEDIO del periodo (INA240 + filtro)
  Iref: number; Iout: number; Vout: number; Vbus: number; Vsw: number; IL: number;
  // pérdidas promediadas (W) y su acumulador
  P: Record<'Q1' | 'D1' | 'L' | 'Cbus' | 'Cfilm' | 'Rsh' | 'cable' | 'arco' | 'LRS', number>;
  acc: Record<string, number>; accT: number;
  IrmsBus: number; IrmsFilm: number;
  lrsCarga: number; lrsApagada: boolean; lrsSobreT: number;
  lrsLimitando: boolean;   // la LRS está en corriente constante (sobrecarga): el bus se cae
  lrsInst: number;   // carga de la ventana de 20 µs (el filtro de 5 ms es lo que ve la protección de la LRS)
  hist: Array<{ t: number; Iout: number; Iref: number; Vsw: number; Vout: number; gate: number }>;
  T: Record<'Q1' | 'D1' | 'disipador' | 'L' | 'Cbus' | 'Cfilm' | 'Rsh', number>;
  pasos: number;
}
/** tope de corriente de la LRS-1200-48 (hoja: sobrecarga 105–125 % → corriente constante; supuesto 120 % de 25 A) */
export const I_LRS_MAX = 30;

export function crearPlumaSim(p: PlumaParams = PLUMA): PlumaSim {
  const c = circuitoPluma(p);
  const v = new Array(c.nodeCount + 1).fill(0);
  v[1] = p.Vlrs; v[2] = p.Vlrs; v[3] = 0; v[4] = 0;
  const hist = new Map();
  hist.set('Cbus', { v: p.Vlrs, i: 0 }); hist.set('Cfilm', { v: p.Vlrs, i: 0 });
  const find = (id: string) => c.elements.find((x) => x.id === id) as Extract<Element, { kind: 'V' }>;
  const Ta = 30;
  return {
    p, c, st: { t: 0, v, vsrcI: new Map(), hist }, el: { Vg: find('Vg'), Varc: find('Varc'), Vlrs: find('Vlrs') },
    t: 0, dt: 1 / (p.fpwm * 20), D: 0.3, integ: 0, gate: false, tPer: 0, nOn: 0, resto: 0, Imed: 0, sumI: 0, nI: 0,
    Iref: 0, Iout: 0, Vout: 0, Vbus: p.Vlrs, Vsw: 0, IL: 0,
    P: { Q1: 0, D1: 0, L: 0, Cbus: 0, Cfilm: 0, Rsh: 0, cable: 0, arco: 0, LRS: 0 }, acc: {}, accT: 0, IrmsBus: 0, IrmsFilm: 0,
    lrsCarga: 0, lrsApagada: false, lrsSobreT: 0, lrsInst: 0, lrsLimitando: false,
    hist: [], T: { Q1: Ta, D1: Ta, disipador: Ta, L: Ta, Cbus: Ta, Cfilm: Ta, Rsh: Ta }, pasos: 0,
  };
}

/** Un paso eléctrico: el firmware (PI por periodo), la compuerta, el MNA. Varc y Iref los pone el arco. */
export function pasoPluma(s: PlumaSim, Varc: number, Iref: number, corto: boolean): void {
  const p = s.p, T = 1 / p.fpwm;
  s.Iref = Iref;
  // ── el FIRMWARE: al empezar cada periodo mide (shunt → INA240 → ADC) y decide el ciclo de trabajo
  if (s.tPer <= 0) {
    s.tPer += T;
    if (s.nI) { s.Imed = s.sumI / s.nI; s.sumI = 0; s.nI = 0; }   // muestrear el VALLE regularía el valle, no el promedio
    const err = Iref - s.Imed;
    s.integ = Math.max(-0.5 / p.Ki, Math.min(0.5 / p.Ki, s.integ + err * T));
    const ff = s.Vbus > 1 ? Math.max(0, s.Vout) / s.Vbus : 0;
    s.D = Math.max(0, Math.min(p.Dmax, ff + p.Kp * err + p.Ki * s.integ));
    if (s.lrsApagada) s.D = 0;
    // el timer real del Pico tiene ~1500 niveles por periodo; la simulación tiene 20 pasos → el resto se ARRASTRA al
    // siguiente periodo (en promedio el ciclo de trabajo es exacto, como un PWM fino)
    const N = Math.round(T / s.dt), quiero = s.D * N + s.resto;
    s.nOn = Math.max(0, Math.min(N, Math.floor(quiero + 0.5)));
    s.resto = quiero - s.nOn;
  }
  const paso = Math.round((T - s.tPer) / s.dt);
  s.gate = paso < s.nOn;
  s.el.Vg.value = s.gate ? p.Vgate : 0;
  s.el.Varc.value = corto ? 0 : Math.max(0, Varc - 0.9);    // el diodo del arco pone ~0.9 V
  // la LRS real NO se apaga en un pico: limita CORRIENTE (hoja de datos: 105–125 % de potencia → corriente constante)
  // y solo si la sobrecarga dura 5 s se apaga. Aquí: tope de I_LRS_MAX (supuesto: 120 % · 25 A = 30 A); el bus se cae
  const vb = s.st.v[2];
  const Vlim = vb + I_LRS_MAX * p.Rlrs;
  s.lrsLimitando = !s.lrsApagada && Vlim < p.Vlrs;
  s.el.Vlrs.value = s.lrsApagada ? 0 : Math.min(p.Vlrs, Vlim);
  const nx = transientStep(s.c, s.st, s.dt);
  if (!nx) { s.D = 0; return; }
  s.st = nx; s.t += s.dt; s.tPer -= s.dt; s.pasos++;
  const v = nx.v;
  s.Vbus = v[2]; s.Vsw = v[5]; s.Vout = v[9] - v[12]; s.Iout = v[12] / p.Rshunt;
  s.IL = nx.hist.get('L1')?.i ?? 0;
  s.sumI += s.Iout; s.nI++;
  // ── pérdidas instantáneas → acumulador (se promedian en ventanas)
  const iQ = nx.hist.get('Q1')?.i ?? 0, vQ = v[2] - v[5];
  const iD = nx.hist.get('D1')?.i ?? 0, vD = v[0] - v[5];
  const iB = nx.hist.get('Cbus')?.i ?? 0, iF = nx.hist.get('Cfilm')?.i ?? 0;
  const iLrs = (v[1] - v[2]) / p.Rlrs;
  const a = s.acc, add = (k: string, x: number) => { a[k] = (a[k] ?? 0) + x * s.dt; };
  add('Q1', Math.max(0, vQ * iQ)); add('D1', Math.max(0, vD * iD)); add('L', s.IL * s.IL * p.RL);
  add('Cbus', iB * iB * p.esrBus); add('Cfilm', iF * iF * p.esrFilm); add('Rsh', s.Iout * s.Iout * p.Rshunt);
  add('cable', s.Iout * s.Iout * p.Rcable); add('arco', Math.max(0, s.Iout) * (corto ? 0 : Varc)); add('LRS', v[2] * iLrs);
  add('iB2', iB * iB); add('iF2', iF * iF); add('sw', s.Vbus * Math.abs(s.IL));
  s.accT += s.dt;
  // ── el osciloscopio (cada 0.5 µs simulado)
  if (s.hist.length === 0 || s.t - s.hist[s.hist.length - 1].t >= 0.5e-6) {
    s.hist.push({ t: s.t, Iout: s.Iout, Iref, Vsw: s.Vsw, Vout: s.Vout, gate: s.gate ? 1 : 0 });
    if (s.hist.length > 1600) s.hist.splice(0, s.hist.length - 1600);
  }
  // ── la ventana de promedio: cada 2 periodos se cierran las pérdidas
  if (s.accT >= 2 * T) {
    const k = 1 / s.accT;
    s.P.Q1 = a.Q1 * k + 0.5 * (a.sw * k) * p.trf * p.fpwm;   // conducción (MNA) + conmutación (analítica)
    s.P.D1 = a.D1 * k; s.P.L = a.L * k; s.P.Cbus = a.Cbus * k; s.P.Cfilm = a.Cfilm * k; s.P.Rsh = a.Rsh * k;
    s.P.cable = a.cable * k; s.P.arco = a.arco * k; s.P.LRS = a.LRS * k;
    s.IrmsBus = Math.sqrt(a.iB2 * k); s.IrmsFilm = Math.sqrt(a.iF2 * k);
    // lo que mide la protección de 5 s: la carga promediada (τ = 1 ms; sus capacitores se tragan los picos de µs)
    s.lrsInst = s.P.LRS / 1200;
    s.lrsCarga += (s.lrsInst - s.lrsCarga) * Math.min(1, s.accT / 1e-3);
    for (const key of Object.keys(a)) a[key] = 0;
    s.accT = 0;
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 4. TEMPERATURA — red térmica (se integra en TIEMPO DE PARED: «si el arco corriera así, continuo»)
// ════════════════════════════════════════════════════════════════════════════════════════════
export const TERMICO = {
  Ta: 30,                                   // °C taller
  disipador: { C: 225, thetaSA_aire: 2.2, thetaSA_vent: 0.7 },   // 125×35×35 aluminio ~0.25 kg; con ventilador 80 mm
  Q1: { thetaJC: 0.45, thetaCS: 0.5, lim: 150, max: 175, C: 2 },  // IRFB4227 datasheet; pad de silicón
  D1: { thetaJC: 1.0, thetaCS: 0.5, lim: 125, max: 150, C: 2 },
  L: { theta_aire: 9, theta_vent: 3, lim: 130, max: 155, C: 62 },  // 18 vueltas cal 10 ~0.16 kg de cobre
  Cbus: { theta: 6, lim: 85, max: 105, C: 40 },                   // 2 snap-in de 35 mm en paralelo
  Cfilm: { theta: 12, lim: 85, max: 100, C: 8 },
  Rsh: { theta: 20, lim: 120, max: 150, C: 3 },
};
export function pasoTermico(s: PlumaSim, dtPared: number, ventilador = true): void {
  const t = TERMICO, T = s.T;
  const thSA = ventilador ? t.disipador.thetaSA_vent : t.disipador.thetaSA_aire;
  // el disipador carga Q1 + D1
  const Pd = s.P.Q1 + s.P.D1;
  T.disipador += (dtPared / t.disipador.C) * (Pd - (T.disipador - t.Ta) / thSA);
  const sigue = (cur: number, objetivo: number, tau: number) => cur + (objetivo - cur) * Math.min(1, dtPared / tau);
  T.Q1 = sigue(T.Q1, T.disipador + s.P.Q1 * (t.Q1.thetaJC + t.Q1.thetaCS), 1.5);
  T.D1 = sigue(T.D1, T.disipador + s.P.D1 * (t.D1.thetaJC + t.D1.thetaCS), 1.5);
  const thL = ventilador ? t.L.theta_vent : t.L.theta_aire;
  T.L += (dtPared / t.L.C) * (s.P.L - (T.L - t.Ta) / thL);
  T.Cbus += (dtPared / t.Cbus.C) * (s.P.Cbus - (T.Cbus - t.Ta) / t.Cbus.theta);
  T.Cfilm += (dtPared / t.Cfilm.C) * (s.P.Cfilm - (T.Cfilm - t.Ta) / t.Cfilm.theta);
  T.Rsh += (dtPared / t.Rsh.C) * (s.P.Rsh - (T.Rsh - t.Ta) / t.Rsh.theta);
}
/** Temperatura de estado estable con las pérdidas de ahora (lo que el diseño tiene que aguantar). */
export function tempEstable(s: PlumaSim, ventilador = true) {
  const t = TERMICO, thSA = ventilador ? t.disipador.thetaSA_vent : t.disipador.thetaSA_aire;
  const Ths = t.Ta + (s.P.Q1 + s.P.D1) * thSA;
  return {
    disipador: Ths,
    Q1: Ths + s.P.Q1 * (t.Q1.thetaJC + t.Q1.thetaCS), D1: Ths + s.P.D1 * (t.D1.thetaJC + t.D1.thetaCS),
    L: t.Ta + s.P.L * (ventilador ? t.L.theta_vent : t.L.theta_aire),
    Cbus: t.Ta + s.P.Cbus * t.Cbus.theta, Cfilm: t.Ta + s.P.Cfilm * t.Cfilm.theta, Rsh: t.Ta + s.P.Rsh * t.Rsh.theta,
  };
}
/** Juicio por pieza: ok / caliente (pasa el límite de diseño) / se quema (pasa el máximo). */
export function juicioTermico(T: Record<string, number>) {
  const lim: Record<string, { lim: number; max: number }> = {
    Q1: TERMICO.Q1, D1: TERMICO.D1, L: TERMICO.L, Cbus: TERMICO.Cbus, Cfilm: TERMICO.Cfilm, Rsh: TERMICO.Rsh,
    disipador: { lim: 90, max: 110 },
  };
  return Object.entries(T).map(([k, v]) => ({ pieza: k, T: v, ...lim[k], estado: v > (lim[k]?.max ?? 1e9) ? 'se quema' : v > (lim[k]?.lim ?? 1e9) ? 'caliente' : 'ok' }));
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 5. DÓNDE VA CADA PIEZA (lo comparten el 3D de bancoArcoDoc y el mapa de calor) y LOS LÍMITES
// ════════════════════════════════════════════════════════════════════════════════════════════
const zP = PB.z;
/** Posiciones de las piezas de la placa de potencia (marco de la cubierta; las mallas, en su origen de STEP). */
export const LUGAR = {
  disipador: [-140, -125.5, zP] as V3,                 // malla 125×35×35: aletas hacia arriba, frente de la placa
  Q1: [-158, -90, zP + 9.8] as V3, D1: [-133, -90, zP + 9.8] as V3, D2: [-95, -90, zP + 9.8] as V3,   // TO-220 de pie
  bus1: [-178, -58, zP + 2] as V3, bus2: [-138, -58, zP + 2] as V3,     // electrolíticos snap-in Ø35
  pelicula: [[-172, -78], [-147, -78], [-122, -78]] as Array<[number, number]>,   // 3 × 10 µF MKS4 pegados a Q1–D1
  shunt: [-100, -62, zP + 1.5] as V3, ina240: [-100, -50, zP + 0.8] as V3, ir2110: [-182, -84, zP + 1.3] as V3,
  cout: [-84, -76, zP + 4] as V3,
  choque: { x0: -62, y: -85, z: -72, r: 30, paso: 2.8, vueltas: 18 },   // 15 µH ≈ 18 vueltas cal 10 en Ø60 × 50
  termostato: [-147, -104, -58] as V3,
  ventilador: [123, -80, -62] as V3,
};
/** Dónde se pinta el calor de cada pieza (centro del cuerpo, marco de la cubierta). */
export const CALOR: Array<{ pieza: keyof PlumaSim['T']; pos: V3; r: number }> = [
  { pieza: 'Q1', pos: [LUGAR.Q1[0] + 2.5, LUGAR.Q1[1] + 1, LUGAR.Q1[2] + 6], r: 9 },
  { pieza: 'D1', pos: [LUGAR.D1[0] + 2.5, LUGAR.D1[1] + 1, LUGAR.D1[2] + 6], r: 9 },
  { pieza: 'disipador', pos: [LUGAR.disipador[0], LUGAR.disipador[1] + 16, zP + 18], r: 40 },
  { pieza: 'L', pos: [LUGAR.choque.x0 + 25, LUGAR.choque.y, LUGAR.choque.z], r: 34 },
  { pieza: 'Cbus', pos: [(LUGAR.bus1[0] + LUGAR.bus2[0]) / 2 + 5, LUGAR.bus1[1], zP + 20], r: 30 },
  { pieza: 'Cfilm', pos: [-145, -78, zP + 12], r: 18 },
  { pieza: 'Rsh', pos: [LUGAR.shunt[0], LUGAR.shunt[1], LUGAR.shunt[2] + 2], r: 10 },
];
export const RIZO_NOMINAL_ELECTROLITICO = 5;   // A rms a 100 kHz por snap-in 2200 µF/100 V (orden de magnitud de hojas de datos)

export interface Limite { nombre: string; valor: string; tope: string; estado: 'ok' | 'justo' | 'pasa'; nota: string }
/** Dónde está el LÍMITE ahora mismo (con lo que la simulación está midiendo). */
export function limitesPluma(s: PlumaSim, ventilador = true): Limite[] {
  const Te = tempEstable(s, ventilador);
  const L: Limite[] = [];
  const pct = s.lrsCarga * 100;
  L.push({ nombre: 'Fuente LRS-1200', valor: `${pct.toFixed(0)} % (${s.P.LRS.toFixed(0)} W)`, tope: '100 % · se apaga >105 % por 5 s',
    estado: pct > 105 ? 'pasa' : pct > 90 ? 'justo' : 'ok', nota: 'P_arco = V_arco·I: el hueco largo pide más potencia de la que da' });
  const porCap = s.IrmsBus / 2;
  L.push({ nombre: 'Rizo por electrolítico', valor: `${porCap.toFixed(1)} A rms`, tope: `~${RIZO_NOMINAL_ELECTROLITICO} A rms`,
    estado: porCap > RIZO_NOMINAL_ELECTROLITICO ? 'pasa' : porCap > 0.8 * RIZO_NOMINAL_ELECTROLITICO ? 'justo' : 'ok',
    nota: 'a 100 kHz la película de 30 µF (53 mΩ) no ayuda; hace falta más electrolítico o un banco de cerámica/polímero' });
  L.push({ nombre: 'Ciclo de trabajo', valor: s.D.toFixed(2), tope: `${s.p.Dmax}`, estado: s.D >= s.p.Dmax - 1e-3 ? 'pasa' : s.D > 0.75 ? 'justo' : 'ok',
    nota: 'pegado al tope = el buck de 48 V ya no alcanza el voltaje del arco' });
  for (const [k, n] of [['Q1', 'Unión de Q1 (estable)'], ['D1', 'Unión de D1 (estable)'], ['L', 'Choque (estable)'], ['Cbus', 'Electrolíticos (estable)']] as const) {
    const lim = (TERMICO as Record<string, { lim?: number; max?: number }>)[k];
    const T = Te[k];
    L.push({ nombre: n, valor: `${T.toFixed(0)} °C`, tope: `${lim.lim} °C (máx ${lim.max})`, estado: T > (lim.max ?? 999) ? 'pasa' : T > (lim.lim ?? 999) ? 'justo' : 'ok',
      nota: k === 'L' ? 'aire forzado del ventilador de 80 mm' : 'disipador 125×35 con ventilador' });
  }
  return L;
}
