/**
 * BRAZO VIVO — el brazo de 3 ejes de `src/forja/mech/brazo.ts`, simulado COMPLETO y en vivo (orden 2026-11-05-brazo-robotico)
 * ==========================================================================================================================
 * Módulo PURO (sin three ni React): corre y se prueba en node. Tres dominios en lazo cerrado, en UN solo estado:
 *
 *   · CUERPO RÍGIDO — base (giro, yaw) + hombro (pitch) + codo (pitch). Los eslabones son los tubos de PLA de brazo.ts
 *     (beamMass: OD 35, pared 3, ρ 1.24 g/cm³; L = 450 | 400 + 350 mm, la «muñeca» va fija), la carga en la punta.
 *     Dinámica por Newton-Euler recursivo (RNEA): M(q) por columnas (Walker-Orin), sesgo h(q,q̇) = Coriolis +
 *     centrífugo + gravedad. Fricción viscosa + Coulomb en cada junta. RK4 del estado COMPLETO a 10 kHz.
 *   · ELÉCTRICO — cada junta: motor DC de escobillas (R, L, k_t = k_e, J_rotor) → etapa planetaria → cicloidal impreso
 *     (relación de cycloidal.ts). Puente H con PWM, modelo promedio: V = D·V_bus. L·di/dt = V − R·i − k_e·ω_motor: la fcem
 *     REGRESA al circuito y el par n·k_t·i REGRESA al cuerpo. Control en cascada: posición (1 kHz) → corriente → PWM.
 *     (Se usa la ODE R-L-fcem directa en vez de spice.ts: es el mismo circuito y así entra al mismo RK4 que la mecánica.)
 *   · CAMPO — los conductores de cada motor (inducido + cable de alimentación), en mm, fijos a su cuerpo; B por
 *     Biot-Savart (motor de campos v2 de em.ts) con la corriente VIVA. B es lineal en I: se empaca una vez con 1 A.
 *
 * Energía: cinética + potencial + magnética (½Li²) contra suministrada (∫V·i) − Joule (∫R·i²) − fricción. Las integrales
 * van DENTRO del RK4, así que el balance cierra (prueba en __tests__/brazoVivo.test.ts).
 *
 * SUPUESTOS (se repiten en el tablero): motores = orden de magnitud de catálogo (⌀40 ~150 W y ⌀30 ~60 W a 24 V; no son
 * números de parte); etapa planetaria 5:1 η 0.90 (sin ella el hombro pediría ~24 A); cicloidal η 0.85; fricciones;
 * V_bus 24 V; f_PWM 20 kHz; reductor rígido y sin juego; rotor con su giro propio (n²·J_m); la pérdida del reductor como
 * fricción proporcional al par transmitido; inducido = N espiras diametrales efectivas en una banda de 120°; SIN hierro
 * (el campo fuera del motor sale SOBREESTIMADO: la carcasa de acero lo blinda) y sin el imán permanente (su campo es fijo,
 * no depende de I); la pinza va nivelada y la carga cuenta como masa puntual en la punta (como brazo.ts); sin choques.
 */
import { beamMass, jointTorques, cycloidalCapacity } from '../mech/brazo';
import { cycloidalDisc, type Pt2 } from '../mech/cycloidal';
import { empacarSegmentos, campoB, type SegmentosB } from '../../lib/physics/em';

export type V3 = [number, number, number];

/** g (m/s²): la misma que usa jointTorques de brazo.ts. */
export const G = 9.81;
/** Densidad del PLA (kg/mm³): la misma de brazo.ts. */
export const PLA_RHO = 1.24e-6;
/** SUPUESTO: fracción sólida de las piezas impresas gruesas (placas, cubos): relleno + paredes. */
export const RELLENO = 0.5;
/** Separación entre los dos conductores del cable de cada motor (mm). */
export const SEP_CABLE = 3.2;
/** La carga cuelga bajo la punta del antebrazo (pinza nivelada), mm. */
export const D_PINZA = 60;

// ════════════════════════════════════════════════════════════════════════════════════════════
// 1. MOTORES, REDUCTORES, JUNTAS
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface MotorDC {
  nombre: string;
  R: number;        // Ω, en terminales
  L: number;        // H
  k: number;        // N·m/A = V·s/rad (k_t = k_e en SI)
  Jm: number;       // kg·m², rotor
  masa: number;     // kg
  radio: number;    // mm (carcasa)
  largo: number;    // mm
  Inom: number;     // A, continua
  espiras: number;  // espiras efectivas del inducido (supuesto, solo para el campo)
}
/** SUPUESTO: orden de magnitud de un motor de catálogo ⌀40 mm, ~150 W, 24 V (τ_mec = J·R/k² ≈ 4.9 ms). */
export const MOTOR_40: MotorDC = { nombre: 'DC escobillas ⌀40 · 24 V · ~150 W', R: 0.317, L: 0.0823e-3, k: 0.0302, Jm: 1.42e-5, masa: 0.48, radio: 20, largo: 71, Inom: 5.8, espiras: 60 };
/** SUPUESTO: orden de magnitud de un motor de catálogo ⌀30 mm, ~60 W, 24 V. */
export const MOTOR_30: MotorDC = { nombre: 'DC escobillas ⌀30 · 24 V · ~60 W', R: 0.611, L: 0.119e-3, k: 0.0259, Jm: 3.35e-6, masa: 0.238, radio: 15, largo: 68, Inom: 3.4, espiras: 80 };

export interface EtapaPrevia { nombre: string; rel: number; eta: number; masa: number; radio: number; largo: number }
/** SUPUESTO: motorreductor planetario de una etapa, 5:1, η 0.90. */
export const PLANETARIA_42: EtapaPrevia = { nombre: 'planetaria ⌀42 5:1', rel: 5, eta: 0.9, masa: 0.26, radio: 21, largo: 40 };
export const PLANETARIA_32: EtapaPrevia = { nombre: 'planetaria ⌀32 5:1', rel: 5, eta: 0.9, masa: 0.12, radio: 16, largo: 30 };

export interface CicloidalJunta {
  lobes: number; R: number; Rr: number; E: number;   // perfil (cycloidal.ts)
  discos: number; t: number; gap: number;            // pila (brazo.ts: capacidad ∝ N·t·R²)
  /** 'A' = pernos fijos, sale el disco (relación = lobes, sentido opuesto). 'B' = discos fijos, gira la hembra
   *  (brazo.ts: «config B») → relación = pernos = lobes + 1, mismo sentido. */
  config: 'A' | 'B';
  eta: number;   // SUPUESTO: evolucion.ts da 0.6–0.99 según el régimen de lubricación; se toma 0.85
}
/** El cicloidal impreso «CH» (scripts/imprimibilidad.ts, reductor-generado.cjs): 16 lóbulos, R 21.4, 5 discos × 8.6 mm. */
export const CIC_CH: CicloidalJunta = { lobes: 16, R: 21.4, Rr: 1.44, E: 0.39, discos: 5, t: 8.6, gap: 0.69, config: 'B', eta: 0.85 };

export interface CicloidalDerivado {
  perfil: Pt2[]; pernos: number; rel: number; valido: boolean;
  pila: number;      // mm: discos·t + huecos
  largo: number;     // mm: pila + 2 tapas de 3 mm
  rExt: number;      // mm: R + Rr + pared 4
  masa: number;      // kg: π·rExt²·largo·0.7·ρ (la fórmula de masa de evolucion.ts)
  capacidad: number; // N·m: cycloidalCapacity de brazo.ts
}
const _cic = new WeakMap<CicloidalJunta, CicloidalDerivado>();
export function cicloidal(c: CicloidalJunta): CicloidalDerivado {
  const hit = _cic.get(c); if (hit) return hit;
  const d = cycloidalDisc({ lobes: c.lobes, R: c.R, Rr: c.Rr, E: c.E, segments: 240 });
  const pila = c.discos * c.t + (c.discos - 1) * c.gap, largo = pila + 6, rExt = c.R + c.Rr + 4;
  const r: CicloidalDerivado = {
    perfil: d.profile, pernos: d.pins, rel: c.config === 'B' ? d.pins : d.ratio, valido: d.valid,
    pila, largo, rExt, masa: Math.PI * rExt * rExt * largo * 0.7 * PLA_RHO,
    capacidad: cycloidalCapacity({ N: c.discos, t: c.t, R: c.R }),
  };
  _cic.set(c, r); return r;
}

export interface JuntaParams {
  nombre: string;
  motor: MotorDC; previa: EtapaPrevia; cic: CicloidalJunta;
  b: number;     // N·m·s/rad, fricción viscosa en la salida (SUPUESTO)
  tc: number;    // N·m, fricción de Coulomb en la salida (SUPUESTO; incluye la del motor reflejada)
  Imax: number;  // A, límite de corriente del puente
}
export interface JuntaDerivada { n: number; eta: number; Jr: number; cic: CicloidalDerivado }
export function derivarJunta(j: JuntaParams): JuntaDerivada {
  const cic = cicloidal(j.cic);
  const n = j.previa.rel * cic.rel;
  return { n, eta: j.previa.eta * j.cic.eta, Jr: n * n * j.motor.Jm, cic };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 2. PARÁMETROS
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface GeomBrazo {
  L1: number; L2: number; L3: number;   // mm (brazo.ts: 450, 400, 350)
  od: number; pared: number;             // mm (brazo.ts: 35, 3)
  zPlato: number;    // mm sobre la mesa: cara de arriba del plato del pedestal (ahí atornilla el cicloidal de la base)
  hHombro: number;   // mm: del plato de la torreta al eje del hombro
  yPlaca: number;    // mm: cara interior de la placa que carga el accionamiento (hombro +y, codo −y)
  yApoyo: number;    // mm: cara interior de la placa de apoyo del otro lado
  masaPinza: number; // kg
  /** PRUEBA: sin accionamientos, placas ni cubos — solo lo que cuenta brazo.ts (tubos + punta). */
  soloTubos: boolean;
}
export type ModoJunta = 'pid' | 'voltaje' | 'abierto';
export type ModoTray = 'tomar' | 'saludo' | 'sostener';
export type ModoCtrl = 'pid' | 'par';
export interface CtrlParams { modo: ModoCtrl; wn: number; zeta: number; ki: number; kc: number }
export interface TrayParams { modo: ModoTray; Tmov: number; A: V3; B: V3; hObj: number; rObj: number; qSostener: V3; casa: V3 }
export interface BrazoParams {
  geo: GeomBrazo;
  juntas: JuntaParams[];   // [base (yaw), hombro, codo]
  carga: number;           // kg del objeto que se toma
  Vbus: number;            // V (SUPUESTO 24)
  fPWM: number;            // Hz (SUPUESTO 20 kHz; solo para el rizo estimado)
  omegaS: number;          // rad/s: suavizado de Coulomb (tanh)
  dt: number;              // s: paso del RK4
  fCtl: number;            // Hz: lazo de posición
  ctrl: CtrlParams;
  tray: TrayParams;
}
export const PARAMS_BRAZO: BrazoParams = {
  geo: { L1: 450, L2: 400, L3: 350, od: 35, pared: 3, zPlato: 140, hHombro: 80, yPlaca: 70, yApoyo: 26, masaPinza: 0.1, soloTubos: false },
  juntas: [
    { nombre: 'base', motor: MOTOR_30, previa: PLANETARIA_32, cic: CIC_CH, b: 0.05, tc: 0.15, Imax: 6 },
    { nombre: 'hombro', motor: MOTOR_40, previa: PLANETARIA_42, cic: CIC_CH, b: 0.08, tc: 0.35, Imax: 12 },
    { nombre: 'codo', motor: MOTOR_30, previa: PLANETARIA_32, cic: CIC_CH, b: 0.05, tc: 0.15, Imax: 7 },
  ],
  carga: 0.5, Vbus: 24, fPWM: 20000, omegaS: 0.02, dt: 1e-4, fCtl: 1000,
  ctrl: { modo: 'pid', wn: 2 * Math.PI * 2.5, zeta: 0.9, ki: 1, kc: 1 },
  tray: { modo: 'tomar', Tmov: 1.4, A: [640, -380, 0], B: [640, 380, 0], hObj: 60, rObj: 22, qSostener: [0, 0, 0], casa: [0, 1.15, -2.0] },
};

// ════════════════════════════════════════════════════════════════════════════════════════════
// 3. DISPOSICIÓN (mm, marco de cada cuerpo) — la usan la masa, el campo y la escena
//    Cuerpos: 0 base (fija) · 1 torreta (gira con la base) · 2 brazo · 3 antebrazo. La junta j mueve al cuerpo j+1.
// ════════════════════════════════════════════════════════════════════════════════════════════
/** Un accionamiento (motor → planetaria → cicloidal) apilado a lo largo de su eje, desde la cara de montaje P0. s > 0 = hacia
 *  el motor; s < 0 = hacia adentro (el cicloidal: estator en el padre, anillo de salida en el hijo). */
export interface Montaje {
  junta: number; padre: number; hijo: number;
  P0: V3;        // punto de s = 0 sobre el eje de la junta, marco del PADRE
  P0h: V3;       // el mismo punto, marco del HIJO
  e: V3;         // dirección del eje hacia el motor (igual en los dos marcos: es el eje de giro)
  qMag: V3;      // eje de escobillas: hacia donde apunta la FMM del inducido (⟂ e)
  tapa: [number, number]; discos: [number, number]; anillo: [number, number];
  placa: [number, number]; previa: [number, number]; motor: [number, number];
  rCic: number; rPrev: number; rMot: number;
}
export interface Cil { a: V3; b: V3; r: number; ri?: number }   // de a a b, mm, alineado a un eje
export interface Caja { c: V3; w: number; d: number; h: number } // centro y medidas (x, y, z), mm
export interface Disposicion {
  mont: Montaje[];
  zT: number;                          // mm: origen de la torreta (salida del cicloidal de la base)
  platoTorreta: Cil; placasTorreta: Caja[];
  cuboHombro: Cil; tuboBrazo: Cil; horquillaCodo: Caja[];
  cuboCodo: Cil; tubo2: Cil; tubo3: Cil; collar: Cil; punta: number;   // punta: x de la punta en el antebrazo
}
const T_PLACA = 8;
export function zTorreta(p: BrazoParams): number { return p.geo.zPlato + cicloidal(p.juntas[0].cic).largo; }
export function disposicion(p: BrazoParams): Disposicion {
  const g = p.geo;
  const mont: Montaje[] = p.juntas.map((J, j) => {
    const cd = cicloidal(J.cic);
    let P0: V3, P0h: V3, e: V3, qMag: V3;
    if (j === 0) { P0 = [0, 0, g.zPlato]; P0h = [0, 0, -cd.largo]; e = [0, 0, -1]; qMag = [1, 0, 0]; }
    else if (j === 1) { P0 = [0, g.yPlaca, g.hHombro]; P0h = [0, g.yPlaca, 0]; e = [0, 1, 0]; qMag = [0, 0, 1]; }
    else { P0 = [g.L1, -g.yPlaca, 0]; P0h = [0, -g.yPlaca, 0]; e = [0, -1, 0]; qMag = [0, 0, 1]; }
    const pr0 = T_PLACA, pr1 = pr0 + J.previa.largo, mo1 = pr1 + J.motor.largo;
    return {
      junta: j, padre: j, hijo: j + 1, P0, P0h, e, qMag,
      tapa: [-3, 0], discos: [-3 - cd.pila, -3], anillo: [-cd.largo, -3],
      placa: [0, T_PLACA], previa: [pr0, pr1], motor: [pr1, mo1],
      rCic: cd.rExt, rPrev: J.previa.radio, rMot: J.motor.radio,
    };
  });
  const yAnH = g.yPlaca - cicloidal(p.juntas[1].cic).largo;     // y del anillo de salida del hombro (lado del cubo)
  const yAnC = -(g.yPlaca - cicloidal(p.juntas[2].cic).largo);  // y del anillo de salida del codo
  const ro = g.od / 2, ri = g.od / 2 - g.pared;
  const altoPlaca = g.hHombro + 38 - 10;
  return {
    mont, zT: zTorreta(p),
    platoTorreta: { a: [0, 0, 0], b: [0, 0, 10], r: 72 },
    placasTorreta: [
      { c: [0, g.yPlaca + T_PLACA / 2, 10 + altoPlaca / 2], w: 76, d: T_PLACA, h: altoPlaca },
      { c: [0, -g.yApoyo - T_PLACA / 2, 10 + altoPlaca / 2], w: 76, d: T_PLACA, h: altoPlaca },
    ],
    cuboHombro: { a: [0, -g.yApoyo, 0], b: [0, yAnH, 0], r: 24 },
    tuboBrazo: { a: [0, 0, 0], b: [g.L1 - 70, 0, 0], r: ro, ri },
    horquillaCodo: [
      { c: [g.L1 - 54, (-g.yPlaca - T_PLACA + g.yApoyo + T_PLACA) / 2, 0], w: 32, d: g.yPlaca + g.yApoyo + 2 * T_PLACA, h: 44 },
      { c: [g.L1 - 16, -g.yPlaca - T_PLACA / 2, 0], w: 108, d: T_PLACA, h: 76 },
      { c: [g.L1 - 16, g.yApoyo + T_PLACA / 2, 0], w: 108, d: T_PLACA, h: 76 },
    ],
    cuboCodo: { a: [0, yAnC, 0], b: [0, g.yApoyo, 0], r: 22 },
    tubo2: { a: [0, 0, 0], b: [g.L2, 0, 0], r: ro, ri },
    tubo3: { a: [g.L2, 0, 0], b: [g.L2 + g.L3, 0, 0], r: ro, ri },
    collar: { a: [g.L2 - 14, 0, 0], b: [g.L2 + 14, 0, 0], r: ro + 4, ri: ro },
    punta: g.L2 + g.L3,
  };
}
/** Punto a distancia s a lo largo del eje de un montaje (marco del padre o del hijo). */
export function enEje(m: Montaje, s: number, hijo = false): V3 {
  const P = hijo ? m.P0h : m.P0;
  return [P[0] + m.e[0] * s, P[1] + m.e[1] * s, P[2] + m.e[2] * s];
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 4. MASA, CENTRO DE MASA E INERCIA de cada cuerpo (composición de piezas, teorema de ejes paralelos)
// ════════════════════════════════════════════════════════════════════════════════════════════
interface Parte { m: number; c: V3; I: number[] }   // c en mm; I (kg·m²) respecto a su CdM, ejes del cuerpo
export interface CuerpoMasa { m: number; c: V3; I: Float64Array }   // c en m; I respecto al CdM (fila-mayor)
const ejeDe = (a: V3, b: V3): 0 | 1 | 2 => {
  const d = [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])];
  return d[0] >= d[1] && d[0] >= d[2] ? 0 : d[1] >= d[2] ? 1 : 2;
};
/** Cilindro (o tubo) de masa m entre a y b (alineado a un eje): I_axial = m(ro²+ri²)/2, I_trans = m(L²/12 + (ro²+ri²)/4). */
function parteCil(m: number, c: Cil): Parte {
  const eje = ejeDe(c.a, c.b), L = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1], c.b[2] - c.a[2]) * 1e-3;
  const ro = c.r * 1e-3, ri = (c.ri ?? 0) * 1e-3;
  const Ia = (m * (ro * ro + ri * ri)) / 2, It = m * ((L * L) / 12 + (ro * ro + ri * ri) / 4);
  const I = [It, 0, 0, 0, It, 0, 0, 0, It]; I[eje * 4] = Ia;
  return { m, c: [(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2, (c.a[2] + c.b[2]) / 2], I };
}
const volCil = (c: Cil) => Math.PI * (c.r * c.r - (c.ri ?? 0) ** 2) * Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1], c.b[2] - c.a[2]);
const cilPLA = (c: Cil): Parte => parteCil(volCil(c) * PLA_RHO * RELLENO, c);
function cajaPLA(k: Caja): Parte {
  const m = k.w * k.d * k.h * PLA_RHO * RELLENO, W = k.w * 1e-3, D = k.d * 1e-3, H = k.h * 1e-3;
  return { m, c: k.c, I: [(m * (D * D + H * H)) / 12, 0, 0, 0, (m * (W * W + H * H)) / 12, 0, 0, 0, (m * (W * W + D * D)) / 12] };
}
const puntual = (m: number, c: V3): Parte => ({ m, c, I: [0, 0, 0, 0, 0, 0, 0, 0, 0] });
function componer(partes: Parte[]): CuerpoMasa {
  let m = 0; const c: V3 = [0, 0, 0];
  for (const q of partes) { m += q.m; c[0] += q.m * q.c[0]; c[1] += q.m * q.c[1]; c[2] += q.m * q.c[2]; }
  if (m > 0) { c[0] /= m; c[1] /= m; c[2] /= m; }
  const I = new Float64Array(9);
  for (const q of partes) {
    const d = [(q.c[0] - c[0]) * 1e-3, (q.c[1] - c[1]) * 1e-3, (q.c[2] - c[2]) * 1e-3];
    const d2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I[i * 3 + j] += q.I[i * 3 + j] + q.m * ((i === j ? d2 : 0) - d[i] * d[j]);
  }
  return { m, c: [c[0] * 1e-3, c[1] * 1e-3, c[2] * 1e-3], I };
}
function partesAccionamiento(mt: Montaje, J: JuntaParams): Parte[] {
  const cd = cicloidal(J.cic);
  // todo el cicloidal (discos + anillo) se cuenta en el estator (padre): el anillo de salida es ligero (supuesto)
  return [
    parteCil(cd.masa, { a: enEje(mt, -cd.largo), b: enEje(mt, 0), r: cd.rExt }),
    parteCil(J.previa.masa, { a: enEje(mt, mt.previa[0]), b: enEje(mt, mt.previa[1]), r: J.previa.radio }),
    parteCil(J.motor.masa, { a: enEje(mt, mt.motor[0]), b: enEje(mt, mt.motor[1]), r: J.motor.radio }),
  ];
}
/** Masa de los 3 cuerpos móviles (torreta, brazo, antebrazo). `pegada` = la carga va en la pinza. */
export function masasCuerpos(p: BrazoParams, pegada: boolean): CuerpoMasa[] {
  const g = p.geo, d = disposicion(p);
  const ro = g.od / 2, ri = ro - g.pared;
  const b1: Parte[] = [], b2: Parte[] = [], b3: Parte[] = [];
  // los TUBOS de brazo.ts, con su masa (beamMass) y su largo COMPLETO
  b2.push(parteCil(beamMass(g.L1, g.od, g.pared), { a: [0, 0, 0], b: [g.L1, 0, 0], r: ro, ri }));
  b3.push(parteCil(beamMass(g.L2, g.od, g.pared), { a: [0, 0, 0], b: [g.L2, 0, 0], r: ro, ri }));
  b3.push(parteCil(beamMass(g.L3, g.od, g.pared), { a: [g.L2, 0, 0], b: [g.L2 + g.L3, 0, 0], r: ro, ri }));
  // la punta: pinza + carga (masa puntual; con la pinza nivelada su velocidad es la de la punta)
  b3.push(puntual(g.masaPinza + (pegada ? p.carga : 0), [d.punta, 0, 0]));
  if (!g.soloTubos) {
    b1.push(cilPLA(d.platoTorreta)); d.placasTorreta.forEach((k) => b1.push(cajaPLA(k)));
    b1.push(...partesAccionamiento(d.mont[1], p.juntas[1]));
    b2.push(cilPLA(d.cuboHombro)); d.horquillaCodo.forEach((k) => b2.push(cajaPLA(k)));
    b2.push(...partesAccionamiento(d.mont[2], p.juntas[2]));
    b3.push(cilPLA(d.cuboCodo)); b3.push(cilPLA(d.collar));
  }
  return [componer(b1), componer(b2), componer(b3)];
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 5. CINEMÁTICA: poses de los cuerpos, punta, cinemática inversa
//    R1 = Rz(q0) · R2 = R1·Ry(−q1) · R3 = R2·Ry(−q2)  (q1, q2 > 0 levantan; x de cada eslabón apunta a lo largo)
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface Pose { R: Float64Array; o: V3 }   // R fila-mayor (9); o en mm, marco del brazo (origen en la mesa, eje de la base)
function porRyNeg(A: Float64Array, ia: number, q: number, out: Float64Array, io: number): void {
  const c = Math.cos(q), s = Math.sin(q);
  for (let f = 0; f < 3; f++) {
    const a0 = A[ia + 3 * f], a1 = A[ia + 3 * f + 1], a2 = A[ia + 3 * f + 2];
    out[io + 3 * f] = c * a0 + s * a2; out[io + 3 * f + 1] = a1; out[io + 3 * f + 2] = -s * a0 + c * a2;
  }
}
export function nuevasPoses(): Pose[] { return [0, 1, 2, 3].map(() => ({ R: new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), o: [0, 0, 0] as V3 })); }
export function posesCuerpos(p: BrazoParams, q: ArrayLike<number>, out: Pose[] = nuevasPoses()): Pose[] {
  const g = p.geo, zT = zTorreta(p);
  const R0 = out[0].R; R0.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); out[0].o[0] = 0; out[0].o[1] = 0; out[0].o[2] = 0;
  const c0 = Math.cos(q[0]), s0 = Math.sin(q[0]);
  out[1].R.set([c0, -s0, 0, s0, c0, 0, 0, 0, 1]); out[1].o[0] = 0; out[1].o[1] = 0; out[1].o[2] = zT;
  porRyNeg(out[1].R, 0, q[1], out[2].R, 0); out[2].o[0] = 0; out[2].o[1] = 0; out[2].o[2] = zT + g.hHombro;
  porRyNeg(out[2].R, 0, q[2], out[3].R, 0);
  const R2 = out[2].R;
  out[3].o[0] = out[2].o[0] + g.L1 * R2[0]; out[3].o[1] = out[2].o[1] + g.L1 * R2[3]; out[3].o[2] = out[2].o[2] + g.L1 * R2[6];
  return out;
}
/** Un punto local (mm) de un cuerpo → marco del brazo (mm). */
export function aRaiz(ps: Pose, l: ArrayLike<number>, out: V3 = [0, 0, 0]): V3 {
  const R = ps.R;
  out[0] = R[0] * l[0] + R[1] * l[1] + R[2] * l[2] + ps.o[0];
  out[1] = R[3] * l[0] + R[4] * l[1] + R[5] * l[2] + ps.o[1];
  out[2] = R[6] * l[0] + R[7] * l[1] + R[8] * l[2] + ps.o[2];
  return out;
}
/** La punta del antebrazo (mm, marco del brazo). La carga cuelga D_PINZA debajo. */
export function puntaDe(p: BrazoParams, q: ArrayLike<number>): V3 {
  const P = posesCuerpos(p, q);
  return aRaiz(P[3], [p.geo.L2 + p.geo.L3, 0, 0]);
}
/** Cinemática inversa de la PUNTA (codo arriba). null si no alcanza. */
export function ikBrazo(p: BrazoParams, P: V3): V3 | null {
  const g = p.geo, zH = zTorreta(p) + g.hHombro;
  const q0 = Math.atan2(P[1], P[0]);
  const r = Math.hypot(P[0], P[1]), s = P[2] - zH;
  const a = g.L1, b = g.L2 + g.L3;
  const D = (r * r + s * s - a * a - b * b) / (2 * a * b);
  if (D < -1 || D > 1) return null;
  const q2 = -Math.acos(D);
  const q1 = Math.atan2(s, r) - Math.atan2(b * Math.sin(q2), a + b * Math.cos(q2));
  return [q0, q1, q2];
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 6. DINÁMICA: Newton-Euler recursivo (RNEA), en el marco del brazo, unidades SI
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface Modelo {
  n: Float64Array; eta: Float64Array; R: Float64Array; L: Float64Array; k: Float64Array;
  b: Float64Array; tc: Float64Array; Jr: Float64Array; Imax: Float64Array;
  m: Float64Array; cl: Float64Array; Il: Float64Array;   // por cuerpo móvil: masa, CdM local (m), inercia local (9)
  zT: number; hH: number; L1: number;                    // m
  wS: number;
}
export function modelo(p: BrazoParams, pegada: boolean): Modelo {
  const cu = masasCuerpos(p, pegada);
  const f = (fn: (j: JuntaParams, d: JuntaDerivada) => number) => Float64Array.from(p.juntas.map((j) => fn(j, derivarJunta(j))));
  const Il = new Float64Array(27), cl = new Float64Array(9);
  cu.forEach((c, i) => { Il.set(c.I, i * 9); cl.set(c.c, i * 3); });
  return {
    n: f((_, d) => d.n), eta: f((_, d) => d.eta), R: f((j) => j.motor.R), L: f((j) => j.motor.L), k: f((j) => j.motor.k),
    b: f((j) => j.b), tc: f((j) => j.tc), Jr: f((_, d) => d.Jr), Imax: f((j) => j.Imax),
    m: Float64Array.from(cu.map((c) => c.m)), cl, Il,
    zT: zTorreta(p) * 1e-3, hH: p.geo.hHombro * 1e-3, L1: p.geo.L1 * 1e-3, wS: p.omegaS,
  };
}

// memoria de trabajo (JS es de un hilo: se reutiliza sin basura)
const _R = new Float64Array(27), _z = new Float64Array(9), _o = new Float64Array(9), _cw = new Float64Array(9), _Iw = new Float64Array(27);
const _F = new Float64Array(9), _N = new Float64Array(9);
const _cero = new Float64Array(3), _ej = [new Float64Array([1, 0, 0]), new Float64Array([0, 1, 0]), new Float64Array([0, 0, 1])];
const _col = new Float64Array(3);

/** Rotaciones, ejes de junta, orígenes, CdM e inercias en el marco del brazo (m). */
function cinematica(Mo: Modelo, q0: number, q1: number, q2: number): void {
  const c0 = Math.cos(q0), s0 = Math.sin(q0);
  _R[0] = c0; _R[1] = -s0; _R[2] = 0; _R[3] = s0; _R[4] = c0; _R[5] = 0; _R[6] = 0; _R[7] = 0; _R[8] = 1;
  porRyNeg(_R, 0, q1, _R, 9); porRyNeg(_R, 9, q2, _R, 18);
  _z[0] = 0; _z[1] = 0; _z[2] = 1;                              // la base gira en z
  _z[3] = -_R[1]; _z[4] = -_R[4]; _z[5] = -_R[7];               // hombro: −y de la torreta
  _z[6] = -_R[10]; _z[7] = -_R[13]; _z[8] = -_R[16];            // codo: −y del brazo
  _o[0] = 0; _o[1] = 0; _o[2] = Mo.zT;
  _o[3] = 0; _o[4] = 0; _o[5] = Mo.zT + Mo.hH;
  _o[6] = Mo.L1 * _R[9]; _o[7] = Mo.L1 * _R[12]; _o[8] = _o[5] + Mo.L1 * _R[15];
  for (let b = 0; b < 3; b++) {
    const r = b * 9, c = b * 3;
    const x = Mo.cl[c], y = Mo.cl[c + 1], z = Mo.cl[c + 2];
    _cw[c] = _R[r] * x + _R[r + 1] * y + _R[r + 2] * z;
    _cw[c + 1] = _R[r + 3] * x + _R[r + 4] * y + _R[r + 5] * z;
    _cw[c + 2] = _R[r + 6] * x + _R[r + 7] * y + _R[r + 8] * z;
    // Iw = R·Il·Rᵀ
    for (let i = 0; i < 3; i++) {
      const t0 = _R[r + 3 * i] * Mo.Il[r] + _R[r + 3 * i + 1] * Mo.Il[r + 3] + _R[r + 3 * i + 2] * Mo.Il[r + 6];
      const t1 = _R[r + 3 * i] * Mo.Il[r + 1] + _R[r + 3 * i + 1] * Mo.Il[r + 4] + _R[r + 3 * i + 2] * Mo.Il[r + 7];
      const t2 = _R[r + 3 * i] * Mo.Il[r + 2] + _R[r + 3 * i + 1] * Mo.Il[r + 5] + _R[r + 3 * i + 2] * Mo.Il[r + 8];
      for (let j = 0; j < 3; j++) _Iw[r + 3 * i + j] = t0 * _R[r + 3 * j] + t1 * _R[r + 3 * j + 1] + t2 * _R[r + 3 * j + 2];
    }
  }
}

/**
 * Newton-Euler recursivo: τ = M(q)·q̈ + C(q,q̇)·q̇ + G(q) (+ rotor n²·J_m·q̈). Requiere cinematica() antes.
 * Hacia afuera: ω, α, aceleración del origen y del CdM de cada cuerpo; hacia adentro: fuerzas y momentos.
 * La gravedad entra como aceleración de la base hacia ARRIBA (gz = +g).
 */
function rnea(Mo: Modelo, qd: ArrayLike<number>, qdd: ArrayLike<number>, gz: number, tau: Float64Array): void {
  let wx = 0, wy = 0, wz = 0, ax = 0, ay = 0, az = 0, lx = 0, ly = 0, lz = gz, ox = 0, oy = 0, oz = 0;
  for (let i = 0; i < 3; i++) {
    const c = 3 * i;
    const rx = _o[c] - ox, ry = _o[c + 1] - oy, rz = _o[c + 2] - oz;
    const wrx = wy * rz - wz * ry, wry = wz * rx - wx * rz, wrz = wx * ry - wy * rx;
    lx += ay * rz - az * ry + (wy * wrz - wz * wry);
    ly += az * rx - ax * rz + (wz * wrx - wx * wrz);
    lz += ax * ry - ay * rx + (wx * wry - wy * wrx);
    const qdi = qd[i], qddi = qdd[i];
    const ux = _z[c] * qdi, uy = _z[c + 1] * qdi, uz = _z[c + 2] * qdi;
    ax += _z[c] * qddi + (wy * uz - wz * uy);
    ay += _z[c + 1] * qddi + (wz * ux - wx * uz);
    az += _z[c + 2] * qddi + (wx * uy - wy * ux);
    wx += ux; wy += uy; wz += uz;
    const cx = _cw[c], cy = _cw[c + 1], cz = _cw[c + 2];
    const wcx = wy * cz - wz * cy, wcy = wz * cx - wx * cz, wcz = wx * cy - wy * cx;
    const m = Mo.m[i];
    _F[c] = m * (lx + (ay * cz - az * cy) + (wy * wcz - wz * wcy));
    _F[c + 1] = m * (ly + (az * cx - ax * cz) + (wz * wcx - wx * wcz));
    _F[c + 2] = m * (lz + (ax * cy - ay * cx) + (wx * wcy - wy * wcx));
    const r9 = 9 * i;
    const Iax = _Iw[r9] * ax + _Iw[r9 + 1] * ay + _Iw[r9 + 2] * az;
    const Iay = _Iw[r9 + 3] * ax + _Iw[r9 + 4] * ay + _Iw[r9 + 5] * az;
    const Iaz = _Iw[r9 + 6] * ax + _Iw[r9 + 7] * ay + _Iw[r9 + 8] * az;
    const Iwx = _Iw[r9] * wx + _Iw[r9 + 1] * wy + _Iw[r9 + 2] * wz;
    const Iwy = _Iw[r9 + 3] * wx + _Iw[r9 + 4] * wy + _Iw[r9 + 5] * wz;
    const Iwz = _Iw[r9 + 6] * wx + _Iw[r9 + 7] * wy + _Iw[r9 + 8] * wz;
    _N[c] = Iax + (wy * Iwz - wz * Iwy);
    _N[c + 1] = Iay + (wz * Iwx - wx * Iwz);
    _N[c + 2] = Iaz + (wx * Iwy - wy * Iwx);
    ox = _o[c]; oy = _o[c + 1]; oz = _o[c + 2];
  }
  let fx = 0, fy = 0, fz = 0, nx = 0, ny = 0, nz = 0;
  for (let i = 2; i >= 0; i--) {
    const c = 3 * i;
    let dx = 0, dy = 0, dz = 0;
    if (i < 2) { dx = _o[c + 3] - _o[c]; dy = _o[c + 4] - _o[c + 1]; dz = _o[c + 5] - _o[c + 2]; }
    const cx = _cw[c], cy = _cw[c + 1], cz = _cw[c + 2], Fx = _F[c], Fy = _F[c + 1], Fz = _F[c + 2];
    const nnx = _N[c] + (cy * Fz - cz * Fy) + nx + (dy * fz - dz * fy);
    const nny = _N[c + 1] + (cz * Fx - cx * Fz) + ny + (dz * fx - dx * fz);
    const nnz = _N[c + 2] + (cx * Fy - cy * Fx) + nz + (dx * fy - dy * fx);
    nx = nnx; ny = nny; nz = nnz;
    fx += Fx; fy += Fy; fz += Fz;
    tau[i] = _z[c] * nx + _z[c + 1] * ny + _z[c + 2] * nz + Mo.Jr[i] * qdd[i];
  }
}

/** M(q) (3×3, fila-mayor, incluye los rotores reflejados) y el sesgo h(q, q̇) = C·q̇ + G. */
export function masaYSesgo(Mo: Modelo, q: ArrayLike<number>, qd: ArrayLike<number>, M: Float64Array, h: Float64Array): void {
  cinematica(Mo, q[0], q[1], q[2]);
  for (let j = 0; j < 3; j++) { rnea(Mo, _cero, _ej[j], 0, _col); M[j] = _col[0]; M[3 + j] = _col[1]; M[6 + j] = _col[2]; }
  rnea(Mo, qd, _cero, G, h);
}
/** G(q): el par que sostiene el peso en reposo (N·m), por junta. */
export function gravedad(Mo: Modelo, q: ArrayLike<number>, out: Float64Array): Float64Array {
  cinematica(Mo, q[0], q[1], q[2]); rnea(Mo, _cero, _cero, G, out); return out;
}
const _Me = new Float64Array(9), _he = new Float64Array(3);
/** Energía mecánica: K = ½·q̇ᵀM(q)q̇ (con rotores), U = Σ m·g·z_CdM (z desde la mesa). */
export function energiaMec(Mo: Modelo, q: ArrayLike<number>, qd: ArrayLike<number>): { K: number; U: number } {
  masaYSesgo(Mo, q, qd, _Me, _he);
  let K = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) K += qd[i] * _Me[3 * i + j] * qd[j];
  let U = 0;
  for (let b = 0; b < 3; b++) U += Mo.m[b] * G * (_o[3 * b + 2] + _cw[3 * b + 2]);
  return { K: 0.5 * K, U };
}
/** Par estático G(q) de un brazo con estos parámetros (N·m) — lo que se compara contra jointTorques de brazo.ts. */
export function parEstatico(p: BrazoParams, q: ArrayLike<number>, pegada = true): number[] {
  return Array.from(gravedad(modelo(p, pegada), q, new Float64Array(3)));
}
function resolver3(A: Float64Array, b: ArrayLike<number>, x: Float64Array): void {
  const a00 = A[0], a01 = A[1], a02 = A[2], a10 = A[3], a11 = A[4], a12 = A[5], a20 = A[6], a21 = A[7], a22 = A[8];
  const c00 = a11 * a22 - a12 * a21, c01 = a12 * a20 - a10 * a22, c02 = a10 * a21 - a11 * a20;
  const c10 = a02 * a21 - a01 * a22, c11 = a00 * a22 - a02 * a20, c12 = a01 * a20 - a00 * a21;
  const c20 = a01 * a12 - a02 * a11, c21 = a02 * a10 - a00 * a12, c22 = a00 * a11 - a01 * a10;
  const id = 1 / (a00 * c00 + a01 * c01 + a02 * c02);
  const b0 = b[0], b1 = b[1], b2 = b[2];
  x[0] = (c00 * b0 + c10 * b1 + c20 * b2) * id;
  x[1] = (c01 * b0 + c11 * b1 + c21 * b2) * id;
  x[2] = (c02 * b0 + c12 * b1 + c22 * b2) * id;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 7. ESTADO, CONTROL Y TRAYECTORIA
// ════════════════════════════════════════════════════════════════════════════════════════════
interface Clave { q: V3; T: number; ev?: 'toma' | 'suelta' }
interface PlanTray { ref: TrayParams; claves: Clave[]; k: number; t0: number; qa: V3 }
export interface Historia { n: number; cab: number; lleno: number; t: Float32Array; i: Float32Array; q: Float32Array }
export interface BrazoEstado {
  t: number;
  /** [q(3), q̇(3), i(3), E_suministrada, E_Joule, E_fricción] — todo integrado por el mismo RK4. */
  y: Float64Array;
  q: Float64Array; qd: Float64Array; i: Float64Array;   // vistas de y
  V: Float64Array; D: Float64Array; ides: Float64Array; integ: Float64Array;
  qref: Float64Array; qdref: Float64Array; qddref: Float64Array;
  tauG: Float64Array;        // G(q) en vivo
  modos: ModoJunta[]; Dman: Float64Array;
  pegada: boolean; obj: V3;  // la carga: en la pinza, o en reposo en obj (mm, centro)
  Ecarga: number;            // energía que entró/salió con la carga al tomarla/soltarla (J)
  E0: number;                // K + U + ½Li² al arrancar (J)
  Mo: Modelo; moClave: string;
  plan: PlanTray | null;
  pico: Float64Array;        // |par del motor en la salida| pico (decae en ~3 s)
  hist: Historia; tHist: number;
  resto: number; pasos: number;
  eventos: string[];
}
const claveModelo = (p: BrazoParams, pegada: boolean) =>
  `${p.carga}|${pegada}|${p.geo.soloTubos}|${p.geo.masaPinza}|${p.geo.L1},${p.geo.L2},${p.geo.L3}|${p.juntas.map((j) => j.motor.nombre + j.previa.rel + j.cic.lobes + j.b + j.tc).join(',')}`;

export function nuevoBrazo(p: BrazoParams = PARAMS_BRAZO, q0?: ArrayLike<number>, qd0?: ArrayLike<number>): BrazoEstado {
  const y = new Float64Array(12);
  const qi = q0 ?? p.tray.casa;
  y[0] = qi[0]; y[1] = qi[1]; y[2] = qi[2];
  if (qd0) { y[3] = qd0[0]; y[4] = qd0[1]; y[5] = qd0[2]; }
  const Mo = modelo(p, false);
  const N = 800;
  const s: BrazoEstado = {
    t: 0, y, q: y.subarray(0, 3), qd: y.subarray(3, 6), i: y.subarray(6, 9),
    V: new Float64Array(3), D: new Float64Array(3), ides: new Float64Array(3), integ: new Float64Array(3),
    qref: Float64Array.from([y[0], y[1], y[2]]), qdref: new Float64Array(3), qddref: new Float64Array(3),
    tauG: new Float64Array(3), modos: ['pid', 'pid', 'pid'], Dman: new Float64Array(3),
    pegada: false, obj: [p.tray.A[0], p.tray.A[1], p.tray.hObj / 2],
    Ecarga: 0, E0: 0, Mo, moClave: claveModelo(p, false), plan: null,
    pico: new Float64Array(3),
    hist: { n: N, cab: 0, lleno: 0, t: new Float32Array(N), i: new Float32Array(3 * N), q: new Float32Array(3 * N) }, tHist: -1,
    resto: 0, pasos: 0, eventos: [],
  };
  s.E0 = energiaTotal(s);
  gravedad(Mo, s.q, s.tauG);
  return s;
}
/** K + U + ½·Σ L·i² (J). */
export function energiaTotal(s: BrazoEstado): number {
  const e = energiaMec(s.Mo, s.q, s.qd);
  let Em = 0; for (let j = 0; j < 3; j++) Em += 0.5 * s.Mo.L[j] * s.i[j] * s.i[j];
  return e.K + e.U + Em;
}
/** Cambia la masa (tomar, soltar, otra carga) llevando la cuenta: el salto de energía va a E_carga. */
function cambiarMasa(s: BrazoEstado, p: BrazoParams, fn: () => void): void {
  const e1 = energiaTotal(s);
  fn();
  s.Mo = modelo(p, s.pegada); s.moClave = claveModelo(p, s.pegada);
  s.Ecarga += energiaTotal(s) - e1;
}
/** Pone a una junta en un modo ('abierto' = puente en alta impedancia: no circula corriente). */
export function fijarModo(s: BrazoEstado, j: number, modo: ModoJunta, D = 0): void {
  s.modos[j] = modo; s.Dman[j] = D;
  if (modo === 'abierto') { s.E0 -= 0.5 * s.Mo.L[j] * s.i[j] * s.i[j]; s.i[j] = 0; }   // la energía ½Li² se va con el arco del contacto
}

function planDe(p: BrazoParams): Clave[] {
  const t = p.tray, T = t.Tmov, casa = t.casa;
  if (t.modo === 'sostener') return [{ q: t.qSostener, T: 1.5 * T }, { q: t.qSostener, T: 1 }];
  if (t.modo === 'saludo') return [
    { q: [0, 1.25, -0.9], T }, { q: [0.55, 1.35, -0.45], T: 0.8 * T }, { q: [-0.55, 1.15, -1.3], T: 1.1 * T },
    { q: [0.55, 1.35, -0.45], T: 1.1 * T }, { q: [0, 1.25, -0.9], T: 0.8 * T }, { q: casa, T }, { q: casa, T: 0.6 },
  ];
  const z = t.hObj / 2 + D_PINZA;   // la punta va D_PINZA arriba del centro de la carga
  const ik = (P: V3, h: number): V3 => ikBrazo(p, [P[0], P[1], z + h]) ?? casa;
  const sA = ik(t.A, 150), eA = ik(t.A, 0), sB = ik(t.B, 150), eB = ik(t.B, 0);
  return [
    { q: sA, T },
    { q: eA, T: 0.6 * T }, { q: eA, T: 0.35, ev: 'toma' }, { q: sA, T: 0.6 * T },
    { q: sB, T: 1.4 * T }, { q: eB, T: 0.6 * T }, { q: eB, T: 0.35, ev: 'suelta' }, { q: sB, T: 0.6 * T },
    { q: casa, T }, { q: casa, T: 0.5 },
    { q: sB, T }, { q: eB, T: 0.6 * T }, { q: eB, T: 0.35, ev: 'toma' }, { q: sB, T: 0.6 * T },
    { q: sA, T: 1.4 * T }, { q: eA, T: 0.6 * T }, { q: eA, T: 0.35, ev: 'suelta' }, { q: sA, T: 0.6 * T },
    { q: casa, T }, { q: casa, T: 0.5 },
  ];
}
/** Dónde está el centro de la carga si va en la pinza (mm). */
export function cargaEnPinza(p: BrazoParams, q: ArrayLike<number>): V3 {
  const P = puntaDe(p, q); return [P[0], P[1], P[2] - D_PINZA];
}
function evento(s: BrazoEstado, p: BrazoParams, ev: 'toma' | 'suelta'): void {
  const c = cargaEnPinza(p, s.q);
  if (ev === 'toma' && !s.pegada) {
    const d = Math.hypot(c[0] - s.obj[0], c[1] - s.obj[1], c[2] - s.obj[2]);
    if (d < 30) { cambiarMasa(s, p, () => { s.pegada = true; }); s.eventos.push(`t=${s.t.toFixed(2)} s · toma (a ${d.toFixed(1)} mm)`); }
    else s.eventos.push(`t=${s.t.toFixed(2)} s · no hay carga a la mano (${d.toFixed(0)} mm)`);
  } else if (ev === 'suelta' && s.pegada) {
    cambiarMasa(s, p, () => { s.pegada = false; s.obj = [c[0], c[1], p.tray.hObj / 2]; });
    s.eventos.push(`t=${s.t.toFixed(2)} s · suelta`);
  }
  if (s.eventos.length > 12) s.eventos.shift();
}
/** Avanza el plan (mínimo tirón, quíntica) y escribe q_ref, q̇_ref, q̈_ref. */
function avanzarPlan(s: BrazoEstado, p: BrazoParams): void {
  if (!s.plan || s.plan.ref !== p.tray) {
    const qa: V3 = s.plan ? [s.qref[0], s.qref[1], s.qref[2]] : [s.q[0], s.q[1], s.q[2]];
    s.plan = { ref: p.tray, claves: planDe(p), k: 0, t0: s.t, qa };
  }
  const P = s.plan;
  let cl = P.claves[P.k], u = (s.t - P.t0) / cl.T;
  while (u >= 1) {
    if (cl.ev) evento(s, p, cl.ev);
    P.qa = cl.q; P.t0 += cl.T; P.k = (P.k + 1) % P.claves.length;
    cl = P.claves[P.k]; u = (s.t - P.t0) / cl.T;
  }
  const u2 = u * u, u3 = u2 * u;
  const f = 10 * u3 - 15 * u3 * u + 6 * u3 * u2;
  const fd = (30 * u2 - 60 * u3 + 30 * u3 * u) / cl.T;
  const fdd = (60 * u - 180 * u2 + 120 * u3) / (cl.T * cl.T);
  for (let j = 0; j < 3; j++) {
    const d = cl.q[j] - P.qa[j];
    s.qref[j] = P.qa[j] + d * f; s.qdref[j] = d * fd; s.qddref[j] = d * fdd;
  }
}
const _Mc = new Float64Array(9), _hc = new Float64Array(3), _tc = new Float64Array(3);
/** Lazo de POSICIÓN (1 kHz): PID + compensación de gravedad, o par computado. Sale la corriente pedida. */
function controlPosicion(s: BrazoEstado, p: BrazoParams, dtc: number): void {
  const Mo = s.Mo, c = p.ctrl, wn = c.wn, z = c.zeta;
  avanzarPlan(s, p);
  masaYSesgo(Mo, s.q, s.qd, _Mc, _hc);
  gravedad(Mo, s.q, s.tauG);
  for (let j = 0; j < 3; j++) {
    const lim = 0.3 * Mo.n[j] * Mo.k[j] * Mo.Imax[j];   // anti-enrollado: el integral no pasa de 30 % del par máximo
    const e = s.qref[j] - s.q[j], ed = s.qdref[j] - s.qd[j];
    // PID desacoplado con la inercia que ve cada junta en esta pose: Kp = J·ωn², Kd = 2ζ·J·ωn, Ki = ki·J·ωn³/5.
    // (Si la corrección pasa por la M completa, el modo de λ_min(M) queda subamortiguado contra la fricción cerca de q̇ = 0.)
    const J = _Mc[4 * j], Ki = (c.ki * J * wn * wn * wn) / 5;
    s.integ[j] = Math.max(-lim / (Ki || 1), Math.min(lim / (Ki || 1), s.integ[j] + e * dtc));
    _tc[j] = J * wn * wn * e + 2 * z * J * wn * ed + Ki * s.integ[j];
  }
  // prealimentación: 'pid' = solo el peso G(q); 'par' = el modelo completo M(q)·q̈_ref + h(q,q̇) (par computado)
  for (let j = 0; j < 3; j++) {
    _tc[j] += c.modo === 'par'
      ? _Mc[3 * j] * s.qddref[0] + _Mc[3 * j + 1] * s.qddref[1] + _Mc[3 * j + 2] * s.qddref[2] + _hc[j]
      : s.tauG[j];
  }
  for (let j = 0; j < 3; j++) {
    if (s.modos[j] !== 'pid') { s.ides[j] = 0; continue; }
    const I = _tc[j] / (Mo.n[j] * Mo.k[j]);
    s.ides[j] = Math.max(-Mo.Imax[j], Math.min(Mo.Imax[j], I));
    const tm = Math.abs(Mo.n[j] * Mo.k[j] * s.i[j]);
    s.pico[j] = Math.max(tm, s.pico[j] * Math.exp(-dtc / 3));
  }
}
/** Lazo de CORRIENTE (cada paso): prealimenta R·i + fcem y corrige el error; el puente lo recorta a ±V_bus → D. */
function lazoCorriente(s: BrazoEstado, p: BrazoParams): void {
  const Mo = s.Mo;
  for (let j = 0; j < 3; j++) {
    const fcem = Mo.k[j] * Mo.n[j] * s.qd[j];
    let V: number;
    if (s.modos[j] === 'pid') V = Mo.R[j] * s.ides[j] + fcem + p.ctrl.kc * Mo.R[j] * (s.ides[j] - s.i[j]);
    else if (s.modos[j] === 'voltaje') V = s.Dman[j] * p.Vbus;
    else { s.V[j] = fcem; s.D[j] = 0; continue; }       // abierto: en las terminales se lee la fcem
    V = Math.max(-p.Vbus, Math.min(p.Vbus, V));
    s.V[j] = V; s.D[j] = V / p.Vbus;
  }
}

// ── el integrador: RK4 del estado completo ──
const NY = 12;
const _k1 = new Float64Array(NY), _k2 = new Float64Array(NY), _k3 = new Float64Array(NY), _k4 = new Float64Array(NY), _yt = new Float64Array(NY);
const _Md = new Float64Array(9), _hd = new Float64Array(3), _rhs = new Float64Array(3), _qdd = new Float64Array(3);
const _qv = new Float64Array(3), _qdv = new Float64Array(3);
function derivada(s: BrazoEstado, y: Float64Array, dy: Float64Array): void {
  const Mo = s.Mo;
  _qv[0] = y[0]; _qv[1] = y[1]; _qv[2] = y[2]; _qdv[0] = y[3]; _qdv[1] = y[4]; _qdv[2] = y[5];
  masaYSesgo(Mo, _qv, _qdv, _Md, _hd);
  let Ps = 0, Pj = 0, Pf = 0;
  for (let j = 0; j < 3; j++) {
    const qd = y[3 + j], i = y[6 + j];
    const tm = Mo.n[j] * Mo.k[j] * i;                         // par del motor llevado a la salida (ideal)
    const sg = Math.tanh(qd / Mo.wS);
    const tl = (1 - Mo.eta[j]) * Math.abs(tm) * sg;           // pérdida de los reductores: siempre contra el giro
    const tf = Mo.b[j] * qd + Mo.tc[j] * sg;                  // fricción viscosa + Coulomb (suavizada)
    _rhs[j] = tm - tl - tf - _hd[j];
    Pf += (tl + tf) * qd;
    if (s.modos[j] === 'abierto') { dy[6 + j] = 0; continue; }
    const V = s.V[j];
    dy[6 + j] = (V - Mo.R[j] * i - Mo.k[j] * Mo.n[j] * qd) / Mo.L[j];   // L·di/dt = V − R·i − k_e·ω_motor
    Ps += V * i; Pj += Mo.R[j] * i * i;
  }
  resolver3(_Md, _rhs, _qdd);
  dy[0] = y[3]; dy[1] = y[4]; dy[2] = y[5];
  dy[3] = _qdd[0]; dy[4] = _qdd[1]; dy[5] = _qdd[2];
  dy[9] = Ps; dy[10] = Pj; dy[11] = Pf;
}
function rk4(s: BrazoEstado, h: number): void {
  const y = s.y;
  derivada(s, y, _k1);
  for (let j = 0; j < NY; j++) _yt[j] = y[j] + 0.5 * h * _k1[j];
  derivada(s, _yt, _k2);
  for (let j = 0; j < NY; j++) _yt[j] = y[j] + 0.5 * h * _k2[j];
  derivada(s, _yt, _k3);
  for (let j = 0; j < NY; j++) _yt[j] = y[j] + h * _k3[j];
  derivada(s, _yt, _k4);
  for (let j = 0; j < NY; j++) y[j] += (h / 6) * (_k1[j] + 2 * _k2[j] + 2 * _k3[j] + _k4[j]);
}
/** Avanza la simulación `dt` segundos (de simulación) en pasos de p.dt, con el control a p.fCtl. */
export function correrBrazo(s: BrazoEstado, p: BrazoParams, dt: number): void {
  const clave = claveModelo(p, s.pegada);
  if (clave !== s.moClave) cambiarMasa(s, p, () => {});
  const h = p.dt, nCtl = Math.max(1, Math.round(1 / (p.fCtl * h)));
  s.resto += dt;
  const n = Math.floor(s.resto / h + 1e-9);
  s.resto -= n * h;
  for (let k = 0; k < n; k++) {
    if (s.pasos % nCtl === 0) controlPosicion(s, p, nCtl * h);
    lazoCorriente(s, p);
    rk4(s, h);
    s.t += h; s.pasos++;
    if (s.t - s.tHist >= 0.005) {
      s.tHist = s.t;
      const H = s.hist, c = H.cab;
      H.t[c] = s.t;
      for (let j = 0; j < 3; j++) { H.i[3 * c + j] = s.i[j]; H.q[3 * c + j] = s.q[j]; }
      H.cab = (c + 1) % H.n; H.lleno = Math.min(H.n, H.lleno + 1);
    }
  }
}

// ── lecturas para el tablero ──
export interface LecturaBrazo {
  qDeg: number[]; wDeg: number[]; errDeg: number[];
  I: number[]; D: number[]; V: number[]; rpm: number[];
  tau: number[];       // par del motor llevado a la salida, n·k·i (N·m)
  G: number[];         // par estático G(q) (N·m)
  Pj: number[]; Pmec: number[]; Psup: number;
  rizo: number[];      // A pico a pico, estimado del PWM: V_bus·|D|(1−|D|)/(L·f)
  pico: number[]; capacidad: number[]; margen: number[];
  K: number; U: number; Emag: number; Esup: number; Ejoule: number; Efric: number; Ecarga: number;
  residuo: number; residuoRel: number;
  n: number[];
}
export function leerBrazo(s: BrazoEstado, p: BrazoParams): LecturaBrazo {
  const Mo = s.Mo, e = energiaMec(Mo, s.q, s.qd);
  let Emag = 0; for (let j = 0; j < 3; j++) Emag += 0.5 * Mo.L[j] * s.i[j] * s.i[j];
  const Esup = s.y[9], Ejoule = s.y[10], Efric = s.y[11];
  const dE = e.K + e.U + Emag - s.E0;
  const residuo = dE - (Esup - Ejoule - Efric + s.Ecarga);
  const r = (f: (j: number) => number) => [0, 1, 2].map(f);
  const cap = p.juntas.map((j) => cicloidal(j.cic).capacidad);
  return {
    qDeg: r((j) => (s.q[j] * 180) / Math.PI), wDeg: r((j) => (s.qd[j] * 180) / Math.PI), errDeg: r((j) => ((s.qref[j] - s.q[j]) * 180) / Math.PI),
    I: r((j) => s.i[j]), D: r((j) => s.D[j]), V: r((j) => s.V[j]), rpm: r((j) => (Mo.n[j] * s.qd[j] * 60) / (2 * Math.PI)),
    tau: r((j) => Mo.n[j] * Mo.k[j] * s.i[j]), G: r((j) => s.tauG[j]),
    Pj: r((j) => Mo.R[j] * s.i[j] * s.i[j]), Pmec: r((j) => Mo.n[j] * Mo.k[j] * s.i[j] * s.qd[j]),
    Psup: r((j) => (s.modos[j] === 'abierto' ? 0 : s.V[j] * s.i[j])).reduce((a, b) => a + b, 0),
    rizo: r((j) => (s.modos[j] === 'abierto' ? 0 : (p.Vbus * Math.abs(s.D[j]) * (1 - Math.abs(s.D[j]))) / (Mo.L[j] * p.fPWM))),
    pico: Array.from(s.pico), capacidad: cap, margen: r((j) => cap[j] / Math.max(1e-6, s.pico[j])),
    K: e.K, U: e.U, Emag, Esup, Ejoule, Efric, Ecarga: s.Ecarga,
    residuo, residuoRel: Math.abs(residuo) / Math.max(1e-9, Ejoule + Efric + Math.abs(Esup) + Math.abs(dE)),
    n: Array.from(Mo.n),
  };
}
/** Lo que dice brazo.ts del brazo horizontal extendido (tubos + punta) y lo que pesa el resto (accionamientos, placas). */
export function referenciaBrazoTs(p: BrazoParams, pegada: boolean) {
  const g = p.geo, carga = g.masaPinza + (pegada ? p.carga : 0);
  const jt = jointTorques({ links: [g.L1, g.L2, g.L3], payloadKg: carga, odMm: g.od, wallMm: g.pared });
  const ext: V3 = [0, 0, 0];
  const Gfull = parEstatico(p, ext, pegada), Gtub = parEstatico({ ...p, geo: { ...g, soloTubos: true } }, ext, pegada);
  return { brazoTs: [jt.jointTorque_Nm[0], jt.jointTorque_Nm[1]], tubos: [Gtub[1], Gtub[2]], completo: [Gfull[1], Gfull[2]] };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 8. CAMPO MAGNÉTICO: los conductores de cada motor (mm, marco de su cuerpo) y el gaussímetro
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface FuenteB {
  cuerpo: number; motor: number; tipo: 'inducido' | 'cable'; nombre: string;
  polis: V3[][];        // mm, en el sentido convencional de I > 0 (cada polilínea lleva la corriente del motor)
  S: SegmentosB;        // empacado con 1 A (unidad 1e-3: coordenadas en mm, B en T)
  centro?: V3; e?: V3; qMag?: V3; radio?: number; largo?: number;   // del inducido (para sembrar sus líneas)
}
export interface TramoRuta { cuerpo: number; pts: Float32Array; n: number; largo: number }
/** El lazo de cada motor para los puntos de corriente: conductor + del puente al motor y − de regreso. */
export interface RutaCable { motor: number; tramos: TramoRuta[]; largo: number }
export const PASO_RUTA = 3;   // mm

export function fuenteDePolis(cuerpo: number, motor: number, nombre: string, polis: V3[][], tipo: 'inducido' | 'cable' = 'cable'): FuenteB {
  const segs: Array<{ a: V3; b: V3; I: number }> = [];
  for (const pl of polis) for (let i = 1; i < pl.length; i++) segs.push({ a: pl[i - 1], b: pl[i], I: 1 });
  return { cuerpo, motor, tipo, nombre, polis, S: empacarSegmentos(segs, 1e-3) };
}
/**
 * El INDUCIDO de un motor DC de escobillas, como lo ve el campo: el conmutador mantiene la corriente del rotor FIJA en el
 * espacio (bajo un polo va en un sentido, bajo el otro en el contrario), así que equivale a N espiras diametrales
 * repartidas en una banda: conductores axiales a radio r que cruzan por el diámetro en los extremos. Su FMM apunta a lo
 * largo del eje de escobillas qMag (⟂ al eje del motor) — no a lo largo del eje como un solenoide.
 */
export function devanadoInducido(centro: V3, e: V3, qMag: V3, radio: number, largo: number, espiras: number, banda = (2 * Math.PI) / 3): V3[][] {
  const w: V3 = [e[1] * qMag[2] - e[2] * qMag[1], e[2] * qMag[0] - e[0] * qMag[2], e[0] * qMag[1] - e[1] * qMag[0]];
  const out: V3[][] = [], h = largo / 2;
  const P = (u: V3, r: number, s: number): V3 => [centro[0] + r * u[0] + s * e[0], centro[1] + r * u[1] + s * e[1], centro[2] + r * u[2] + s * e[2]];
  for (let k = 0; k < espiras; k++) {
    const th = -banda / 2 + (banda * (k + 0.5)) / espiras, c = Math.cos(th), sn = Math.sin(th);
    const u: V3 = [c * w[0] + sn * qMag[0], c * w[1] + sn * qMag[1], c * w[2] + sn * qMag[2]];
    const p1 = P(u, radio, -h);
    out.push([p1, P(u, radio, h), P(u, -radio, h), P(u, -radio, -h), p1]);
  }
  return out;
}
/** Remuestrea una polilínea a paso uniforme a lo largo de su largo (incluye los extremos). */
export function remuestrearUniforme(pl: V3[], paso: number): V3[] {
  const L: number[] = [0];
  for (let i = 1; i < pl.length; i++) L.push(L[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1], pl[i][2] - pl[i - 1][2]));
  const tot = L[L.length - 1]; if (tot < 1e-9) return pl.slice();
  const n = Math.max(1, Math.round(tot / paso)), out: V3[] = [];
  let k = 1;
  for (let i = 0; i <= n; i++) {
    const s = (tot * i) / n;
    while (k < pl.length - 1 && L[k] < s) k++;
    const t = (s - L[k - 1]) / (L[k] - L[k - 1] || 1), a = pl[k - 1], b = pl[k];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}
/** Un cable de 2 conductores a lo largo de una línea central: separados SEP, juntos en los extremos (bornes y cruces por el
 *  eje de una junta: un punto sobre el eje no se mueve al girar, así el cable es continuo en cualquier pose). Normal por
 *  transporte paralelo (no se tuerce). Devuelve los dos en el sentido de la línea (el − se recorre al revés). */
export function parConductores(linea: V3[], sep: number, paso: number): { pos: V3[]; neg: V3[] } {
  const c = remuestrearUniforme(linea, paso), n = c.length;
  const tan = (i: number): V3 => {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
    const t: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(t[0], t[1], t[2]) || 1;
    return [t[0] / l, t[1] / l, t[2] / l];
  };
  const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let t0 = tan(0), nv = cruz(t0, [0, 0, 1]);
  if (Math.hypot(nv[0], nv[1], nv[2]) < 0.2) nv = cruz(t0, [1, 0, 0]);
  let ln = Math.hypot(nv[0], nv[1], nv[2]); nv = [nv[0] / ln, nv[1] / ln, nv[2] / ln];
  const pos: V3[] = [], neg: V3[] = [], L = paso * (n - 1);
  for (let i = 0; i < n; i++) {
    const t = i === 0 ? t0 : tan(i);
    const d = nv[0] * t[0] + nv[1] * t[1] + nv[2] * t[2];
    let m: V3 = [nv[0] - d * t[0], nv[1] - d * t[1], nv[2] - d * t[2]];
    ln = Math.hypot(m[0], m[1], m[2]);
    if (ln < 1e-6) { m = cruz(t, [0, 0, 1]); ln = Math.hypot(m[0], m[1], m[2]) || 1; }
    nv = [m[0] / ln, m[1] / ln, m[2] / ln]; t0 = t;
    const s = paso * i, x = Math.max(0, Math.min(1, Math.min(s, L - s) / 8));
    const a = (sep / 2) * x * x * (3 - 2 * x);
    pos.push([c[i][0] + a * nv[0], c[i][1] + a * nv[1], c[i][2] + a * nv[2]]);
    neg.push([c[i][0] - a * nv[0], c[i][1] - a * nv[1], c[i][2] - a * nv[2]]);
  }
  return { pos, neg };
}
/** Las líneas centrales de los 3 cables, por tramos fijos a cada cuerpo (mm). Del puente H (caja de electrónica en la
 *  mesa) al motor; cruzan cada junta por un punto de su eje. */
export function rutasCentrales(p: BrazoParams): { motor: number; tramos: { cuerpo: number; linea: V3[] }[] }[] {
  const g = p.geo, d = disposicion(p), zT = d.zT, hH = g.hHombro, L1 = g.L1;
  const borne = (j: number): V3 => enEje(d.mont[j], d.mont[j].motor[1] + 5);   // detrás de la tapa del motor, sobre su eje
  return [
    { motor: 0, tramos: [{ cuerpo: 0, linea: [[-165, -215, 30], [-140, -190, 6], [-105, -120, 6], [-80, -90, 14], [-36, -30, 14], [-10, -6, 22], borne(0)] }] },
    { motor: 1, tramos: [
      { cuerpo: 0, linea: [[-165, -190, 30], [-140, -165, 6], [-110, -85, 6], [-90, -62, 14], [-58, -36, 14], [-58, -36, 124], [-24, -14, 126], [-6, -2, 130], [0, 0, 136], [0, 0, zT - 8]] },
      { cuerpo: 1, linea: [[0, 0, -8], [0, 0, 13], [-22, 20, 13], [-46, 60, 13], [-46, 84, 13], [-40, 100, 40], [-30, 120, 52], [-20, 175, 56], [-8, 196, 70], borne(1)] },
    ] },
    { motor: 2, tramos: [
      { cuerpo: 0, linea: [[-165, -165, 30], [-140, -145, 6], [-112, -72, 6], [-92, -52, 14], [-56, -28, 14], [-56, -28, 122], [-20, -8, 128], [0, 0, 134], [0, 0, zT - 14]] },
      { cuerpo: 1, linea: [[0, 0, -14], [0, 0, 15], [-20, -18, 15], [-46, -38, 15], [-46, -42, hH - 30], [-18, -42, hH - 8], [0, -40, hH]] },
      { cuerpo: 2, linea: [[0, -40, 0], [10, -42, 14], [34, -24, 21], [60, 0, 21], [L1 - 90, 0, 21], [L1 - 70, -8, 26], [L1 - 40, -50, 26], [L1 - 20, -74, 44], [L1 - 10, -110, 30], [L1 - 4, -165, 22], [L1, -186, 12], borne(2)] },
    ] },
  ];
}
const NOMBRE_J = ['base', 'hombro', 'codo'];
/** Todas las fuentes de B del brazo (inducidos + cables) y las rutas de los puntos de corriente. Constantes: se arman una vez. */
export function fuentesDelBrazo(p: BrazoParams): { fuentes: FuenteB[]; rutas: RutaCable[] } {
  const d = disposicion(p), fuentes: FuenteB[] = [], rutas: RutaCable[] = [];
  d.mont.forEach((m, j) => {
    const M = p.juntas[j].motor, cen = enEje(m, (m.motor[0] + m.motor[1]) / 2);
    const r = 0.6 * M.radio, l = 0.6 * M.largo;
    const f = fuenteDePolis(m.padre, j, `inducido ${NOMBRE_J[j]}`, devanadoInducido(cen, m.e, m.qMag, r, l, M.espiras), 'inducido');
    f.centro = cen; f.e = m.e; f.qMag = m.qMag; f.radio = r; f.largo = l;
    fuentes.push(f);
  });
  for (const ru of rutasCentrales(p)) {
    const ida: TramoRuta[] = [], vuelta: TramoRuta[] = [];
    for (const tr of ru.tramos) {
      const campo = parConductores(tr.linea, SEP_CABLE, 8);
      fuentes.push(fuenteDePolis(tr.cuerpo, ru.motor, `cable ${NOMBRE_J[ru.motor]} (${['base', 'torreta', 'brazo', 'antebrazo'][tr.cuerpo]})`, [campo.pos, campo.neg.slice().reverse()]));
      const fino = parConductores(tr.linea, SEP_CABLE, 2);
      const tramo = (pl: V3[]): TramoRuta => {
        const u = remuestrearUniforme(pl, PASO_RUTA), pts = new Float32Array(u.length * 3);
        u.forEach((q, i) => pts.set(q, i * 3));
        let L = 0; for (let i = 1; i < u.length; i++) L += Math.hypot(u[i][0] - u[i - 1][0], u[i][1] - u[i - 1][1], u[i][2] - u[i - 1][2]);
        return { cuerpo: tr.cuerpo, pts, n: u.length, largo: L };
      };
      ida.push(tramo(fino.pos)); vuelta.unshift(tramo(fino.neg.slice().reverse()));
    }
    const tramos = [...ida, ...vuelta];
    rutas.push({ motor: ru.motor, tramos, largo: tramos.reduce((a, t) => a + t.largo, 0) });
  }
  return { fuentes, rutas };
}
export interface LecturaB { B: V3; mod: number; porMotor: number[] }
export const nuevaLecturaB = (): LecturaB => ({ B: [0, 0, 0], mod: 0, porMotor: [0, 0, 0] });
const _b = new Float64Array(3), _pm = new Float64Array(9);
/**
 * EL GAUSSÍMETRO: B (T) en P (mm, marco del brazo) sumando TODAS las fuentes vivas. Cada fuente está empacada con 1 A en el
 * marco de su cuerpo: el punto se lleva al marco local (Rᵀ·(P − o)), Biot-Savart (campoB de em.ts), el resultado se gira
 * de vuelta (R·b) y se multiplica por la corriente viva de su motor.
 */
export function gaussimetro(fuentes: FuenteB[], poses: Pose[], I: ArrayLike<number>, P: ArrayLike<number>, out: LecturaB = nuevaLecturaB()): LecturaB {
  _pm.fill(0);
  let Bx = 0, By = 0, Bz = 0;
  for (const f of fuentes) {
    const Ii = I[f.motor]; if (!Ii) continue;
    const ps = poses[f.cuerpo], R = ps.R;
    const dx = P[0] - ps.o[0], dy = P[1] - ps.o[1], dz = P[2] - ps.o[2];
    campoB(f.S, R[0] * dx + R[3] * dy + R[6] * dz, R[1] * dx + R[4] * dy + R[7] * dz, R[2] * dx + R[5] * dy + R[8] * dz, _b);
    const bx = (R[0] * _b[0] + R[1] * _b[1] + R[2] * _b[2]) * Ii;
    const by = (R[3] * _b[0] + R[4] * _b[1] + R[5] * _b[2]) * Ii;
    const bz = (R[6] * _b[0] + R[7] * _b[1] + R[8] * _b[2]) * Ii;
    Bx += bx; By += by; Bz += bz;
    _pm[3 * f.motor] += bx; _pm[3 * f.motor + 1] += by; _pm[3 * f.motor + 2] += bz;
  }
  out.B[0] = Bx; out.B[1] = By; out.B[2] = Bz; out.mod = Math.hypot(Bx, By, Bz);
  for (let m = 0; m < 3; m++) out.porMotor[m] = Math.hypot(_pm[3 * m], _pm[3 * m + 1], _pm[3 * m + 2]);
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 9. LAS PIEZAS ESTÁTICAS DEL BANCO (misma forma que RefPart de ForgeBRepStudio, duplicada aquí: mm del doc, Z arriba)
// ════════════════════════════════════════════════════════════════════════════════════════════
export type MatRef = 'acero' | 'aluminio' | 'cromo' | 'cobre' | 'laton' | 'plastico' | 'goma' | 'pintura' | 'ceramica' | 'pcb' | 'filamento';
export interface PiezaRef {
  id: string; name: string; kind: 'malla' | 'caja' | 'cilindro' | 'torno' | 'tubo' | 'placa' | 'grupo';
  url?: string;
  w?: number; d?: number; h?: number; r?: number; rad?: number; lados?: number;
  perfil?: [number, number][]; path?: [number, number, number][]; hijos?: PiezaRef[];
  x: number; y: number; z: number; rx?: number; ry?: number; rz?: number;
  color: string; opacity?: number; metalness?: number; mat?: MatRef; aristas?: boolean; encima?: boolean;
}
/** Dónde va el brazo en el documento: el punto de la mesa bajo el eje de la base (mm del doc). */
export interface BrazoConfig { origen: V3 }
export const BRAZO_CFG: BrazoConfig = { origen: [0, 0, 760] };
/** Mesa, pedestal de la base, electrónica (los 3 puentes H) y los dos cojines de tomar y dejar. Lo que se mueve lo dibuja
 *  <BrazoVivoEscena>. Todo relativo a cfg.origen. */
export function piezasBancoBrazo(cfg: BrazoConfig = BRAZO_CFG, p: BrazoParams = PARAMS_BRAZO): PiezaRef[] {
  const [X, Y, Z] = cfg.origen, g = p.geo, zP = g.zPlato;
  const pz = (name: string, kind: PiezaRef['kind'], o: Omit<PiezaRef, 'id' | 'name' | 'kind'>, id: string): PiezaRef => ({ id: `brazo-${id}`, name, kind, ...o });
  const grupo = (name: string, id: string, x: number, y: number, z: number, hijos: PiezaRef[]): PiezaRef =>
    ({ id: `brazo-${id}`, name, kind: 'grupo', x, y, z, color: hijos[0]?.color ?? '#888', hijos });
  const ALU = '#9aa1aa', GRAF = '#23272e';
  const mesaHijos: PiezaRef[] = [
    pz('Cubierta 1800×1200 (melamina oscura)', 'caja', { w: 1800, d: 1200, h: 30, rad: 4, x: 450, y: 0, z: -15, color: '#1c1f25', mat: 'pintura' }, 'mesa-cubierta'),
  ];
  const hPata = Z - 30;
  if (hPata > 60) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
    mesaHijos.push(pz('Pata (perfil de aluminio 60×60)', 'caja', { w: 60, d: 60, h: hPata, x: 450 + sx * 840, y: sy * 540, z: -30 - hPata / 2, color: ALU, mat: 'aluminio' }, `mesa-pata-${sx}${sy}`));
  const ped: PiezaRef[] = [
    pz('Placa base', 'cilindro', { r: 115, h: 12, x: 0, y: 0, z: 6, color: '#7d848e', mat: 'aluminio' }, 'ped-placa'),
    ...[90, 210, 330].map((a, k) => pz('Poste', 'cilindro', { r: 9, h: zP - 8 - 12, x: 80 * Math.cos((a * Math.PI) / 180), y: 80 * Math.sin((a * Math.PI) / 180), z: 12 + (zP - 8 - 12) / 2, color: ALU, mat: 'aluminio' }, `ped-poste-${k}`)),
    pz('Plato superior (carga el cicloidal de la base)', 'cilindro', { r: 95, h: 8, x: 0, y: 0, z: zP - 4, color: '#7d848e', mat: 'aluminio' }, 'ped-plato'),
    ...[0, 60, 120, 180, 240, 300].map((a, k) => pz('Tornillo M6 · cabeza', 'cilindro', { r: 5, h: 4, lados: 6, x: 100 * Math.cos(((a + 30) * Math.PI) / 180), y: 100 * Math.sin(((a + 30) * Math.PI) / 180), z: 14, color: '#c3c8cf', mat: 'acero' }, `ped-m6-${k}`)),
  ];
  const elec: PiezaRef[] = [
    pz('Caja de la electrónica', 'caja', { w: 150, d: 100, h: 36, rad: 3, x: 0, y: 0, z: 18, color: GRAF, mat: 'pintura' }, 'elec-caja'),
    pz('Tarjeta: 3 puentes H (PWM 20 kHz)', 'caja', { w: 140, d: 90, h: 1.6, x: 0, y: 0, z: 36.8, color: '#1f6f43', mat: 'pcb' }, 'elec-pcb'),
    ...[0, 1, 2, 3, 4, 5, 6].map((k) => pz('Disipador · aleta', 'caja', { w: 110, d: 2.4, h: 14, x: -8, y: -33 + k * 11, z: 44.6, color: '#b8bec6', mat: 'aluminio' }, `elec-aleta-${k}`)),
    pz('Bornera de salida', 'caja', { w: 12, d: 80, h: 10, x: 69, y: 0, z: 30, color: '#c9a23a', mat: 'laton' }, 'elec-bornera'),
  ];
  const t = p.tray;
  return [
    grupo('Mesa del brazo', 'mesa', X, Y, Z, mesaHijos),
    grupo('Pedestal de la base (giro)', 'pedestal', X, Y, Z, ped),
    grupo('Electrónica: 3 puentes H + 24 V', 'electronica', X - 240, Y - 190, Z, elec),
    pz('Cojín A (tomar)', 'cilindro', { r: 42, h: 2, x: X + t.A[0], y: Y + t.A[1], z: Z + 1, color: '#30343b', mat: 'goma' }, 'cojin-a'),
    pz('Cojín B (dejar)', 'cilindro', { r: 42, h: 2, x: X + t.B[0], y: Y + t.B[1], z: Z + 1, color: '#30343b', mat: 'goma' }, 'cojin-b'),
  ];
}
