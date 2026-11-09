/**
 * EL MÓDULO DEL ALAMBRE (orden 2026-11-05-lab-alambre, agente A · ronda 2: orden 2026-11-06-lab-alambre-r2)
 * ===========================================================================================================
 * Carrete de 1 kg + empuje NEMA 17 sobre el rodillo moleteado de la SOMI + rueda loca con imán y AS5600 +
 * guía RECTA del rodillo a la punta + portapuntas metálico (la única entrada de OUT−) + el calor lejos del PETG.
 *
 * Como en mech/evolucion.ts: las fórmulas son el juez. `disenarAlambre` decide con números (topología, largo del
 * cuello, presión de la loca, holguras) y `juzgarAlambre` vuelve a revisar TODO contra las mismas fórmulas, así
 * que un número sembrado mal (un tubo de cobre en el cuello, un tornillo al chasis, un barreno sin gota) se caza.
 *
 * RONDA 2 (contrato v2, `CAMBIOS_R2` y `DECISIONES`):
 *  · A.POT a z = 210: K06 sale del portapuntas hacia −x, sube por x = −46 FUERA de la pluma y entra por el pasamuros de
 *    la ESPINA DEL EMPUJE (la pared de z 210 es de esa pieza, no del pie). Cada vuelta con radio ≥ 6·OD (REGLAS.dobladoMinK).
 *  · La térmica ve la pluma: cuello, cable y tirantes son aletas por diferencias finitas en su ambiente real (gas de la pluma
 *    + radiación del arco + radiación de la mesa). La ronda 1 los ponía en aire a 35 °C y escondía que el cuello, en el eje
 *    de la pluma, le lleva el gas caliente al zócalo de PETG.
 *  · La CAMPANA de B (boca hacia −y en y 96, captura ≥ 0.5 m/s en el arco): caso de diseño = campana prendida; caso de falla =
 *    sin campana, que se dice con números (lo que no aguanta pide un termostato: CAMBIO DE CONTRATO PEDIDO en el cierre).
 *  · f_n del cuello ≥ 2·f_CMT (regla nueva): la raíz en PETG limita cualquier tubo (viga sobre resortes de Winkler) y un
 *    cuello más corto mete PETG en la pluma → apoyo intermedio: collarín de latón que DESLIZA sobre el cuello y 2 tirantes de
 *    inox Ø3 al frente del bloque. Los tres caminos se calculan y gana el primero que cumple.
 *  · D4: Silfos (BCuP-5) con fundente donde hay latón; el inox NO lleva Silfos (el fósforo hace fosfuros frágiles con el
 *    níquel y el hierro): la junta cuello–portapuntas es de plata 45 % sin fósforo.
 *  · D5: la loca es 625-ZZ: sus dos tapas de lámina cierran el barreno, así que la tapa del imán se pega a la cara del aro
 *    exterior (que gira con la loca) y nunca pasa del Ø16 (a 0.8 mm está el rodillo).
 *  · REGLAS.todoImprimible: los escudos de aluminio entran en ranuras que SÍ están en las piezas impresas (y en sus STL).
 *
 * Unidades: mm, N, N·mm salvo donde dice (los modelos térmicos y de motor van en SI por dentro).
 * Marco: el del contrato (Z arriba, el arco en el origen, la punta termina en z = 14). El alambre baja por x = y = 0.
 * Puro: sin WASM ni DOM. Los sólidos los arma scripts/laboratorio/alambre-solidos.cjs con OCCT a partir de
 * `disenarAlambre().impresas` (una sola fuente de geometría).
 */
import {
  IMPRESORA, MATERIAL, RIEL, REGLAS, CONEXIONES, bahia, puerto, dentro, cabeEnLaCama, traslape,
  type PiezaLab, type V3, type Caja,
} from './laboratorio-contrato';
import { clearance as holguraDfm, type PrintProfile } from '../mech/dfm';
import { GAP } from '../mech/printinplace';

const PI = Math.PI;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const SIGMA = 5.67e-8;
const resta = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const suma = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const escala = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const norma = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => escala(a, 1 / (norma(a) || 1));
const pprod = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ── LA IMPRESORA: la K1 con PETG (dfm.ts da la holgura con este perfil) ───────────────────────
export const PERFIL_K1: PrintProfile = {
  bedX: IMPRESORA.cama[0], bedY: IMPRESORA.cama[1], bedZ: IMPRESORA.cama[2], margin: IMPRESORA.margen,
  nozzle: 0.4, layerHeight: 0.2, material: 'PETG', overhangWarnDeg: 45, overhangErrDeg: 60,
};

// ── SUPUESTOS (paramétricos: ian los mide y se cambian aquí) ──────────────────────────────────
export const SUPUESTOS = {
  /** E71T-GS 0.8: tubo de acero con núcleo de fundente. La pared de 0.2 mm es SUPUESTO; el núcleo no da rigidez. */
  alambre: { D: 0.8, pared: 0.2, E: 200e3, sigmaY: 450, rhoLineal: 3.3e-3 /* g/mm */,
    /** radio del rizo que le queda DESPUÉS del rodillo (se mide: 1 m suelto, diámetro del rizo / 2) */
    radioRizo: 300,
    /** rizo con el que SALE del carrete (D100: se enrolló a r = 26…48 y rebota). Bajo este radio, doblarlo es plástico. */
    radioRizoCarrete: 80 },
  /** NEMA 17HS4401 (hoja típica): 1.8°, 1.7 A, 0.40 N·m, 1.5 Ω, 2.8 mH, 54 g·cm². kDin = par de arrastre / retención
   *  en micropasos (SUPUESTO 0.7). Rth = carcasa→aire sin disipador (SUPUESTO 11 K/W). V = 12 V: dato de C (TMC2209 en el riel de 12 V). */
  nema: { Th: 0.40, Inom: 1.7, R: 1.5, L: 2.8e-3, J: 54e-7, pares: 50, kDin: 0.7, V: 12, Rth: 11, dTbobina: 10,
    lado: 42.3, largo: 40, eje: 5, ejeLargo: 24, resalte: 22, resalteAlto: 2, barrenos: 31, pasosRev: 200, masa: 0.28 },
  /** TMC2209 (lo pone C): 16 micropasos; C limita a ≤ 1.4 A rms (a 1.7 A el chip llega a ~117 °C). */
  driver: { micro: 16, IrmsMax: 1.4 },
  /** rodillo moleteado de la SOMI (ian lo tiene) */
  rodillo: { D: 30, ancho: 10, barreno: 7, rho: 7850e-9 /* kg/mm³ */ },
  /** carrete de 1 kg D100: el alambre ocupa de r = 26 (vacío) a r = 48 (lleno). mu = eje impreso contra el buje. */
  carrete: { D: 100, ancho: 45, barreno: 16, masaAlambre: 1.0, masaVacio: 0.15, rNucleo: 26, rLleno: 48, mu: 0.3,
    rEje: 7.75, rampa_s: 0.2, Tmax: 80 /* plástico del carrete (SUPUESTO) */ },
  /** rueda loca = balero 625-ZZ (D5: Ø16 × 5, barreno 5, DOS tapas de lámina que cierran el barreno). El imán va en una tapa
   *  impresa PEGADA con epóxico a la cara del aro exterior (gira con la loca). aroInt = radio interior de esa cara (SUPUESTO:
   *  Ø12.6 de catálogo; dentro está la tapa de lámina, ~0.15 hundida). */
  loca: { D: 16, ancho: 5, Di: 5, J: 3e-7 /* kg·m² con tapa e imán */, imanD: 6, imanH: 2.5, aroInt: 6.3, tipo: '625-ZZ' },
  /** agarre del moleteado y aplastamiento del tubular */
  agarre: { muMoleteado: 0.5, SF: 2, dAplastar: 0.05, SFaplastar: 2 },
  /** fricción alambre contra la guía */
  guia: { muPTFE: 0.1, muInox: 0.4, muCobre: 0.3, muPETG: 0.3, ptfeOD: 4, ptfeID: 2, puntaID: 1.0, cuelloOD: 6, cuelloID: 4 },
  /** la punta en su extremo y el aire alrededor (con el extractor jalando) */
  termica: { Tpunta: 400, Tamb: 35, h: 25, kInox: 16, kCobre: 390, kLaton: 110, TsiliconaMax: 200,
    TptfeMax: 230, cableCuD: 3.26, cableOD: 6.5, kSilicona: 0.2, aislanteT: 1.6, rhoCu: 1.72e-8 },
  /** D4 · las juntas calientes. Silfos 15 (BCuP-5) para OUT− al portapuntas y para latón con latón (con fundente: el latón lo
   *  pide); el inox NO lleva Silfos (fósforo + níquel/hierro = fosfuros frágiles) → plata 45 % sin fósforo con fundente.
   *  Tmax = servicio de una junta SIN carga mecánica (SUPUESTO ~0.75 del sólidus en K; el cable lo sostiene su tramo, no la junta). */
  juntas: {
    Silfos: { nombre: 'Silfos 15 (BCuP-5: cobre-fósforo con 15 % de plata)', solidus: 645, liquidus: 800, Tmax: 450, noVaEn: ['inox', 'acero'] as string[] },
    BAg: { nombre: 'plata 45 % sin fósforo (BAg) con fundente', solidus: 665, liquidus: 745, Tmax: 450, noVaEn: [] as string[] },
  } as Record<string, { nombre: string; solidus: number; liquidus: number; Tmax: number; noVaEn: string[] }>,
  /** el arco y lo que manda hacia arriba: radiación (fRad) y pluma de gas caliente (fConv, Heskestad). chi: una CARA de PETG
   *  recibe convección del gas y pierde por radiación y conducción al bloque más o menos lo mismo → queda a la mitad del exceso. */
  arco: { I: 40, V: 21, fRad: 0.15, fConv: 0.10, alfaPETG: 0.9, hSup: 15, chi: 0.5 },
  /** la MESA (dato de B): disipador controlado a 150–300 °C y marco de cobre a ~300 °C, ±80 mm en z = 0. Se juzga a 300 °C.
   *  ε = 0.8: acero/cobre oxidados y con hollín (SUPUESTO). */
  mesa: { T: 300, eps: 0.8, semi: 80 },
  /** ESCUDO: lámina de aluminio de 0.8 mm con un hueco de aire de 5 mm al PETG (sus pestañas entran en ranuras impresas). α = 0.15:
   *  pulido nuevo ~0.05, con humo y hollín sube (SUPUESTO; se limpia o se cambia). Flota: no toca metal a ningún potencial. */
  escudo: { alfa: 0.15, gap: 5, h: 25, espesor: 0.8, kAire: 0.026, eps: 0.1, ranuraAncho: 1.0, ranuraProf: 3 },
  /** la CAMPANA de B (contrato v2): fracción de la pluma que se lleva. DISEÑO: 0 (decisión del orquestador: el modelo de B da
   *  ~0 % apartado en el zócalo y el mío 80 %; no se apuesta el PETG). La campana es un extra que sólo ayuda: 0.8 queda como caso
   *  informativo. Lo que escapa sube derecho o desviado hacia la boca: se toma el peor de los dos en cada punto. */
  campana: { eta: 0, etaInformativo: 0.8 },
  /** el ZÓCALO AISLADO: el cuello no toca PETG; entra a un inserto de aislante que el PETG abraza. Candidatos, de menos a más raros:
   *  PTFE (ya está en la lista de compras) y silicato de calcio clase 1000 °C (D1, el de B, de la placa de 25 mm). E = módulo para
   *  la raíz del cuello (SUPUESTOS). tapa: aislante arriba del cuello por donde sale el PTFE; dBloque: a esa distancia del inserto el
   *  PETG ya está a la T del bloque (SUPUESTO). */
  aislantes: [{ nombre: 'PTFE', k: 0.25, Tmax: 260, E: 500 }, { nombre: 'silicato de calcio (D1)', k: 0.07, Tmax: 1000, E: 300 }],
  inserto: { radios: [4, 5, 6, 7, 8, 9, 10, 11, 12], tapa: 6, dBloque: 7 },
  /** cuerpos de metal y cable DENTRO de la pluma: de los h = 25 W/m²K, la parte de radiación (4εσT³) va a la sala y la
   *  convectiva al gas → χ = 1 − 4εσT³/h (ε oxidados, SUPUESTOS). Cerca del arco Heskestad no vale (campo cercano): el gas se acota
   *  con la T de la punta, y el nodo del portapuntas sigue en aire a 35 °C (la punta a 400 °C ya trae el campo cercano; se mide). */
  enPluma: { epsInox: 0.4, epsCobre: 0.6, epsSilicona: 0.9, epsLaton: 0.5, Tref: 330 },
  /** K06 (8 AWG silicona): densidades (g/mm³); 1/3 de su tramo libre se mueve con la punta (masa de un resorte); 500 mm en la columna. */
  cable: { rhoCu: 8.96e-3, rhoSil: 1.2e-3, fraccionLibre: 1 / 3, Lcolumna: 500 },
  /** el cuello: inox 304 y los tubos que se consiguen (OD × ID). El ID lleva PTFE: 4 → 4×2; 6 → 6×4 con el 4×2 adentro.
   *  La raíz en PETG es un lecho de Winkler con k_s = E del PETG (SUPUESTO). */
  inox: { E: 193e3, rho: 7.9e-3, alfa: 17.3e-6 },
  tubos: [[6, 4], [8, 6], [8, 4], [10, 6], [10, 4], [12, 8], [12, 6]] as [number, number][],
  /** latón (portapuntas, collarín): densidad g/mm³, módulo, conductividad */
  laton: { rho: 8.5e-3, E: 100e3, k: 110 },
  /** apoyo intermedio: collarín de latón que DESLIZA (H7/g6) en el cuello + 2 varillas de inox Ø3 con plata 45 % al collarín y a
   *  presión en el PETG (Lancla mm adentro). Inox y no latón: conduce 7 veces menos y su punta llega fría al PETG. */
  tirante: { mat: 'inox', D: 3, E: 193e3, rho: 7.9e-3, k: 16, eps: 0.4, collarOD: 14, collarL: 8, Lancla: 12 },
  /** PETG: módulo, deformación admisible de un broche reutilizable y relajación E(t)/E0 a 1000 h (creep): 0.55 a 40 °C,
   *  0.35 a ~60 °C (junto al NEMA). Los dos SUPUESTOS: se miden con una flexión cargada una semana. k: conductividad (W/m·K). */
  petg: { E: 2000, epsAdm: 0.025, relaj40: 0.55, relaj60: 0.35, k: 0.2 },
  /** K14 (contrato v2, pedido de A): termostato NC clase KSD301 (tapa de aluminio Ø15.5; el disco bimetálico va pegado a la
   *  tapa; la tapa está aislada de las terminales). Se vende de 40 a 150 °C en pasos de 5. tol: ±3 °C (SUPUESTO: se compra con
   *  la tolerancia fina, la común es ±5). pared: PETG entre el barreno del zócalo y la tapa (2 líneas de 0.4). rBloque: radio al
   *  que el PETG alrededor del cuello ya está a la T del bloque (SUPUESTO). Las terminales se SUELDAN a K14. */
  termostato: { clase: 'KSD301', Tmin: 40, Tmax: 150, paso: 5, tol: 3, capD: 15.5, capH: 3, largo: 20, pared: 0.8, rBloque: 10, paredV: 1.0, paredNema: 1.0 },
  /** hilos de señal y de motor con silicona: diámetro exterior por calibre AWG (SUPUESTOS de catálogo), para el llenado */
  hilo: { 22: 1.6, 24: 1.4, 26: 1.2 } as Record<number, number>,
  /** AS5600 en modo analógico, leído por el ADC del micro (ENOB SUPUESTO 9 bits) */
  as5600: { cuentas: 4096, enobADC: 9, entrehierroMin: 0.5, entrehierroMax: 3, desalineoMax: 0.5 },
  /** la alternativa: reducción impresa en espina de pescado 5:1 */
  reduccion: { N: 5, eta: 0.9, rCorona: 30, juegoCorona: 0.15, Jpinon: 2e-7, Jcorona: 1.3e-5, piezasExtra: 3 },
};
export type Supuestos = typeof SUPUESTOS;

// ── REQUISITOS ───────────────────────────────────────────────────────────────────────────────
export const REQ_ALAMBRE = {
  vMin: 0.5, vNom: 1.8, vMax: 6,          // m/min
  margenPar: 2,                            // par disponible / par pedido a vMax
  resolucionMax: 50,                       // µm de alambre por micropaso
  cmtAmp: 1,                               // retracción tipo CMT: ±1 mm
  cmtSF: 1.5,                              // margen de par en la retracción (no perder pasos)
  margenPandeo: 3,
  juegoMax: 0.05,                          // mm de movimiento perdido en la guía
  tPetgMax: MATERIAL.tUsoMaxC,             // 70 °C
  margenT: 3,                              // K de margen bajo los 70 °C
  bucleIsla: 3,                            // f_CMT / f del colchón del carrete ≥ 3 (aislado)
  holguraCreepage: 2,                      // mm entre metal a OUT− y la tierra lógica
  fnCuelloK: 2,                            // ronda 2: f_n lateral del cuello ≥ 2·f_CMT
  holguraEscudo: 0.5,                      // mm radiales entre el escudo y el cuello (no lo toca al vibrar)
  tPetgFalla: 75,                          // K14: el PETG aguanta un rato hasta Tg (~80) − 5 mientras el termostato corta; 70 es uso continuo
};
export type ReqAlambre = typeof REQ_ALAMBRE;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 1) EL ALAMBRE: sección, pandeo, rizo, juego en la guía
// ═════════════════════════════════════════════════════════════════════════════════════════════
export interface Seccion { A: number; I: number; EI: number; Zp: number; Mp: number }
/** Tubo de acero Do con pared t (el fundente no da rigidez). A mm², I mm⁴, EI N·mm², Mp N·mm. */
export function seccionAlambre(Do = SUPUESTOS.alambre.D, t = SUPUESTOS.alambre.pared, E = SUPUESTOS.alambre.E, sy = SUPUESTOS.alambre.sigmaY): Seccion {
  const Di = Do - 2 * t;
  const A = (PI / 4) * (Do ** 2 - Di ** 2), I = (PI / 64) * (Do ** 4 - Di ** 4), Zp = (Do ** 3 - Di ** 3) / 6;
  return { A, I, EI: E * I, Zp, Mp: sy * Zp };
}
/** Euler: P_cr = π²·EI/(K·L)² (K = 1 articulado, conservador contra la mordida del rodillo). */
export const eulerPcr = (EI: number, L: number, K = 1) => (PI ** 2 * EI) / (K * L) ** 2;

/** Fricción por el RIZO del alambre al enderezarse en un tramo recto de holgura radial c:
 *  momento M = min(EI/R, Mp), transición de largo ℓ = √(8·R·c) (cuerda con flecha c), apoyo de 3 puntos → N = 8M/ℓ. */
export function friccionRizo(mu: number, c: number, s = seccionAlambre(), R = SUPUESTOS.alambre.radioRizo) {
  const M = Math.min(s.EI / R, s.Mp), l = Math.sqrt(8 * R * c), N = (8 * M) / l;
  return { M, l, N, F: mu * N };
}
/** Capstan: T_salida = T_entrada · e^{μθ} */
export const capstan = (T: number, mu: number, theta: number) => T * Math.exp(mu * theta);

/** Pandeo confinado en un tubo de holgura radial c y largo L con empuje F: si F > P_cr(L), la culebra de media onda
 *  l = π·√(EI/F) acorta Δ = L·(π·c/l)²/4. Ese Δ es el «juego» (se recupera al jalar). */
export function juegoGuia(F: number, c: number, L: number, s = seccionAlambre()) {
  if (F <= eulerPcr(s.EI, L)) return { pandea: false, l: L, delta: 0, k: Infinity };
  const l = PI * Math.sqrt(s.EI / F), delta = (L * (PI * c / l) ** 2) / 4;
  return { pandea: true, l, delta, k: (4 * s.EI) / (L * c * c) };   // Δ = L·c²·F/(4EI) → k = dF/dΔ
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 2) EL NEMA: par contra velocidad (fcem + tiempo eléctrico L/R) y calor
// ═════════════════════════════════════════════════════════════════════════════════════════════
export type Nema = Supuestos['nema'];
/** Corriente de fase que el driver alcanza a la velocidad ω (rad/s del eje) con bus V:
 *  I = min(I_pico, (V − k_e·ω) / √(R² + (p·ω·L)²)),  k_e = k_t = Th/I_nom (V·s/rad), p = 50 pares de polos. */
export function corrienteFase(w: number, Ipico: number, m: Nema = SUPUESTOS.nema, V = m.V) {
  const kt = m.Th / m.Inom, we = m.pares * Math.abs(w);
  const disp = (V - kt * Math.abs(w)) / Math.hypot(m.R, we * m.L);
  return Math.max(0, Math.min(Ipico, disp));
}
/** Par de arrastre disponible (N·m) a ω con corriente pico Ipico: T = kDin·k_t·I(ω). */
export const parDisponible = (w: number, Ipico: number, m: Nema = SUPUESTOS.nema, V = m.V) =>
  m.kDin * (m.Th / m.Inom) * corrienteFase(w, Ipico, m, V);
/** Curva par-velocidad para la vista y el reporte: [rpm, N·m]. */
export function curvaPar(Ipico: number, m: Nema = SUPUESTOS.nema, V = m.V, rpmMax = 1500, n = 31): [number, number][] {
  return Array.from({ length: n }, (_, i) => { const rpm = (rpmMax * i) / (n - 1); return [rpm, r3(parDisponible((rpm * 2 * PI) / 60, Ipico, m, V))]; });
}
/** Temperatura de la carcasa en régimen: P = 2·I_rms²·R(T) (dos fases), T = T_amb + Rth·P, R sube 0.393 %/K. */
export function tempMotor(Irms: number, m: Nema = SUPUESTOS.nema, Tamb = SUPUESTOS.termica.Tamb) {
  let T = Tamb, P = 0;
  for (let k = 0; k < 60; k++) { const R = m.R * (1 + 0.00393 * (T + m.dTbobina - 20)); P = 2 * Irms * Irms * R; T = Tamb + m.Rth * P; }
  return { T, P };
}
/** I rms máxima para que la carcasa (que toca el PETG) no pase de Tlim. */
export function IrmsTermica(Tlim: number, m: Nema = SUPUESTOS.nema, Tamb = SUPUESTOS.termica.Tamb) {
  const P = (Tlim - Tamb) / m.Rth, R = m.R * (1 + 0.00393 * (Tlim + m.dTbobina - 20));
  return Math.sqrt(Math.max(0, P) / (2 * R));
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 3) LA TÉRMICA: la pluma (libre y con la campana), la radiación del arco y de la mesa, las aletas
// ═════════════════════════════════════════════════════════════════════════════════════════════
/** Barra (aleta) 1D: k W/m·K, diámetros en mm, L mm, h W/m²K. Dconv = diámetro que convecta (aislante). */
export interface Barra { k: number; Do: number; Di?: number; L: number; h: number; Dconv?: number }
function km(b: Barra) {
  const A = (PI / 4) * ((b.Do / 1e3) ** 2 - ((b.Di ?? 0) / 1e3) ** 2), P = PI * ((b.Dconv ?? b.Do) / 1e3);
  const m = Math.sqrt((b.h * P) / (b.k * A));
  return { kA: b.k * A, m, kAm: b.k * A * m, L: b.L / 1e3 };
}
/** Conductancia de entrada (W/K) de una aleta con carga Gc en su punta (Gc = 0: punta adiabática → kAm·tanh(mL)). */
export function gEntrada(b: Barra, Gc = 0) {
  const { kAm, m, L } = km(b), t = Math.tanh(m * L);
  return (kAm * (Gc + kAm * t)) / (kAm + Gc * t);
}
/** θ(x) a lo largo de la aleta (x mm desde la base) con θ0 en la base y carga Gc en la punta. */
export function thetaEn(b: Barra, theta0: number, x: number, Gc = 0) {
  const { kAm, m, L } = km(b), g = Gc / kAm, xs = Math.min(x / 1e3, L);
  return (theta0 * (Math.cosh(m * (L - xs)) + g * Math.sinh(m * (L - xs)))) / (Math.cosh(m * L) + g * Math.sinh(m * L));
}

// ── la pluma ──
/** Caso de diseño: la campana de B prendida (el contrato la pone con captura ≥ 0.5 m/s). Caso de falla: sin campana. */
export type Caso = 'conCampana' | 'sinCampana';
/** Calor convectivo del arco (kW). */
export const QcArco = (a = SUPUESTOS.arco) => (a.fConv * a.I * a.V) / 1e3;
/** Heskestad con Qc explícito: ΔT₀ = 25·Qc^{2/3}·z^{−5/3} (Qc kW, z m), perfil gaussiano b = 0.12·z. */
export function plumaDTq(z: number, rLat: number, Qc: number) {
  if (Qc <= 0) return 0;
  if (z <= 1) return Infinity;
  const zm = z / 1e3, b = 0.12 * z;
  return 25 * Qc ** (2 / 3) * zm ** (-5 / 3) * Math.exp(-((rLat / b) ** 2));
}
/** Alza por la pluma del arco libre (Heskestad: ΔT₀ = 25·Q_c^{2/3}·z^{−5/3}, Q_c kW, z m; perfil gaussiano b = 0.12·z). */
export const plumaDT = (z: number, rLat = 0, a = SUPUESTOS.arco) => plumaDTq(z, rLat, QcArco(a));
/** Alza de una cara de PETG por la radiación del arco a d mm (isótropo: q = fRad·P/(4πd²), ΔT = α·q/h). */
export function radiacionDT(d: number, a = SUPUESTOS.arco) {
  const q = (a.fRad * a.I * a.V) / (4 * PI * (d / 1e3) ** 2);
  return (a.alfaPETG * q) / a.hSup;
}
/** Flujo de radiación del arco en p (W/m², isótropo, sin coseno: conservador). */
export const qArco = (p: V3, a = SUPUESTOS.arco) => (a.fRad * a.I * a.V) / (4 * PI * (norma(p) / 1e3) ** 2);

/** ¿El segmento a→b cruza la caja c? (método de las losas) */
export function cortaCaja(a: V3, b: V3, c: Caja) {
  let t0 = 0, t1 = 1;
  const lo = [c.x0, c.y0, c.z0], hi = [c.x1, c.y1, c.z1];
  for (let k = 0; k < 3; k++) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-12) { if (a[k] < lo[k] || a[k] > hi[k]) return false; continue; }
    let u = (lo[k] - a[k]) / d, v = (hi[k] - a[k]) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 > t1) return false;
  }
  return t1 > 1e-6 && t0 < 1 - 1e-6;
}
/** Lo que PODRÍA tapar la vista a la mesa: la campana de B (contrato v2) está entre la mesa y la cara de abajo del pie. El
 *  diseño NO lo cuenta (la forma de la campana es de B y puede no llenar su bahía): se juzga sin oclusores y esto sólo se reporta. */
export const oclusoresMesa = (): Caja[] => [bahia('CAMPANA').caja];
/** Factor de vista de un elemento de cara (punto p, normal n que sale de la cara) a la mesa (cuadrado ±semi en z = 0,
 *  mirando +z): F = ∫ cosθ1·cosθ2/(π r²) dA, por celdas; una celda que tapa un oclusor no cuenta. */
export function factorVistaMesa(p: V3, n: V3, semi = SUPUESTOS.mesa.semi, N = 48, occ: Caja[] = []) {
  const dA = ((2 * semi) / N) ** 2; let F = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const qx = -semi + ((i + 0.5) * 2 * semi) / N, qy = -semi + ((j + 0.5) * 2 * semi) / N;
    const dx = qx - p[0], dy = qy - p[1], dz = -p[2], r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2);
    const c1 = (n[0] * dx + n[1] * dy + n[2] * dz) / r, c2 = p[2] / r;
    if (c1 > 0 && c2 > 0 && !occ.some((o) => cortaCaja(p, [qx, qy, 0], o))) F += (c1 * c2 * dA) / (PI * r2);
  }
  return F;
}
/** Flujo de la mesa sobre un elemento (W/m²): q = ε·σ·F·(Tm⁴ − Ta⁴). */
export function qMesa(p: V3, n: V3, S: Supuestos = SUPUESTOS, occ: Caja[] = [], N = 48) {
  const F = factorVistaMesa(p, n, S.mesa.semi, N, occ), Tm = S.mesa.T + 273.15, Ta = S.termica.Tamb + 273.15;
  return { F, q: S.mesa.eps * SIGMA * F * (Tm ** 4 - Ta ** 4) };
}
/** Alza (K) de una cara de PETG por la radiación de abajo: el arco y la mesa. Sin escudo: ΔT = α_PETG·q/h. Con escudo: la
 *  lámina absorbe α_Al·q (del arco Y de la mesa: los dos vienen de abajo) y se enfría por fuera (h) y por el hueco
 *  (k_aire/gap + radiación con ε baja); el PETG sólo ve la lámina tibia. */
export function dTradiacion(p: V3, n: V3, escudado: boolean, S: Supuestos = SUPUESTOS, occ: Caja[] = []) {
  const m = qMesa(p, n, S, occ), qA = qArco(p, S.arco), q = m.q + qA, Ta = S.termica.Tamb + 273.15;
  if (!escudado) return { F: m.F, qM: m.q, qA, dT: (S.arco.alfaPETG * q) / S.arco.hSup, dTmesa: (S.arco.alfaPETG * m.q) / S.arco.hSup };
  const e = S.escudo, gGap = e.kAire / (e.gap / 1e3) + 4 * e.eps * SIGMA * Ta ** 3;
  const dTsh = (e.alfa * q) / (e.h + gGap), k = gGap / (gGap + S.arco.hSup);
  return { F: m.F, qM: m.q, qA, dT: dTsh * k, dTmesa: ((e.alfa * m.q) / (e.h + gGap)) * k, dTescudo: dTsh };
}
/** Temperatura de una cara de PETG en (rLat, z) respecto al arco (origen), pluma libre y sin la mesa (la regla de zP). */
export function tPetgArco(rLat: number, z: number, T = SUPUESTOS.termica.Tamb, a = SUPUESTOS.arco) {
  return T + a.chi * plumaDT(z, rLat, a) + radiacionDT(Math.hypot(rLat, z), a);
}

// ── la campana de B: sumidero de Dalla Valle y la pluma que escapa ──
/** La boca de la campana (contrato: bahía CAMPANA, la boca mira a −y en su cara y0) como sumidero de Dalla Valle con pestaña:
 *  V(X) = Q / (0.75·(10X² + A)). Q sale de pedir V = REGLAS.capturaHumoMin en el arco. */
export function campanaSumidero() {
  const c = bahia('CAMPANA').caja;
  const boca: V3 = [(c.x0 + c.x1) / 2, c.y0, (c.z0 + c.z1) / 2];
  const A = ((c.x1 - c.x0) * (c.z1 - c.z0)) / 1e6;
  const X0 = norma(resta(boca, [0, 0, 2])) / 1e3;
  const V0 = REGLAS.capturaHumoMin, Q = V0 * 0.75 * (10 * X0 * X0 + A);
  return { caja: c, boca, A, X0, V0, Q, m3h: Q * 3600 };
}
export type Sumidero = ReturnType<typeof campanaSumidero>;
/** Velocidad del aire que jala la campana en p (m/s, hacia el centro de la boca). */
export function vCampana(p: V3, cs: Sumidero): V3 {
  const d = escala(resta(cs.boca, p), 1e-3), X = norma(d);
  if (X < 1e-6) return [0, 0, 0];
  return escala(d, cs.Q / (0.75 * (10 * X * X + cs.A)) / X);
}
/** Heskestad: velocidad en el eje de la pluma u = 1.03·Qc^{1/3}·s^{−1/3} (m/s, Qc kW, s m). */
export const uPluma = (s: number, Qc: number) => 1.03 * Qc ** (1 / 3) * Math.max(s / 1e3, 0.005) ** (-1 / 3);
export interface Trayectoria { Qe: number; capturada: boolean; zCaptura: number; pts: V3[] }
/** El eje de lo que ESCAPA a la campana ((1 − η)·Qc): dP/dt = u_pluma·ẑ + V_campana(P) (superposición). Si entra a la boca,
 *  la campana también se lo lleva. */
export function trayectoriaPluma(S: Supuestos = SUPUESTOS): Trayectoria {
  const Qe = (1 - S.campana.eta) * QcArco(S.arco), cs = campanaSumidero(), c = cs.caja;
  let p: V3 = [0, 0, 5], s = 5;
  const pts: V3[] = [p];
  if (Qe <= 0) return { Qe, capturada: true, zCaptura: 0, pts };
  const dt = 2e-4;
  for (let k = 0; k < 60000; k++) {
    const v = vCampana(p, cs), vel: V3 = [v[0], v[1], v[2] + uPluma(s, Qe)];
    p = suma(p, escala(vel, dt * 1e3)); s += norma(vel) * dt * 1e3;
    if (k % 5 === 0) pts.push(p);
    if (p[1] >= c.y0 - 2 && p[2] <= c.z1 && Math.abs(p[0]) <= (c.x1 - c.x0) / 2) return { Qe, capturada: true, zCaptura: p[2], pts };
    if (p[2] >= 420) break;
  }
  pts.push(p);
  return { Qe, capturada: false, zCaptura: Infinity, pts };
}
const memoTr = new WeakMap<object, Trayectoria>();
export function trayectoria(S: Supuestos = SUPUESTOS) {
  let t = memoTr.get(S);
  if (!t) { t = trayectoriaPluma(S); memoTr.set(S, t); }
  return t;
}
/** y del eje de la pluma desviada a la altura z (null si la campana se la lleva o no llega). */
export function yPlumaEn(tr: Trayectoria, z: number): number | null {
  if (tr.capturada) return null;
  for (let i = 1; i < tr.pts.length; i++) {
    const a = tr.pts[i - 1], b = tr.pts[i];
    if ((a[2] - z) * (b[2] - z) <= 0 && a[2] !== b[2]) return a[1] + ((z - a[2]) / (b[2] - a[2])) * (b[1] - a[1]);
  }
  return null;
}
/** Exceso del gas de la pluma en p (K). sinCampana: la pluma libre (vertical, Qc entero). conCampana: escapa (1 − η)·Qc, que
 *  sube derecho o desviado a la boca: el peor de los dos. Acotado con la punta (cerca del arco Heskestad no vale). */
export function gasPluma(p: V3, caso: Caso, S: Supuestos = SUPUESTOS) {
  const r0 = Math.hypot(p[0], p[1]), tope = S.termica.Tpunta - S.termica.Tamb;
  if (caso === 'sinCampana') return Math.min(tope, plumaDTq(p[2], r0, QcArco(S.arco)));
  const tr = trayectoria(S), y = yPlumaEn(tr, p[2]);
  const vert = plumaDTq(p[2], r0, tr.Qe), desv = y === null ? 0 : plumaDTq(p[2], Math.hypot(p[0], p[1] - y), tr.Qe);
  return Math.min(tope, Math.max(vert, desv));
}

// ── las aletas en su ambiente (diferencias finitas) ──
/** χ de un cuerpo metido en la pluma: de h (aire con el extractor), la radiación 4εσT³ se va a la sala fría. */
export const chiCuerpo = (eps: number, S: Supuestos = SUPUESTOS) => 1 - (4 * eps * SIGMA * S.enPluma.Tref ** 3) / S.termica.h;
export const largoRuta = (pts: V3[]) => pts.slice(1).reduce((a, p, i) => a + norma(resta(p, pts[i])), 0);
export function puntoEnRuta(ruta: V3[], s: number): V3 {
  let acc = 0;
  for (let i = 1; i < ruta.length; i++) {
    const L = norma(resta(ruta[i], ruta[i - 1]));
    if (acc + L >= s - 1e-9) { const t = L > 0 ? (s - acc) / L : 0; return suma(ruta[i - 1], escala(resta(ruta[i], ruta[i - 1]), Math.max(0, Math.min(1, t)))); }
    acc += L;
  }
  return ruta[ruta.length - 1];
}
/** Muestras de una ruta: posición, exceso del gas y radiación que le llega (arco + mesa vista hacia abajo). Pasado el final
 *  de la ruta (Lextra) el cable va dentro de la columna de B: aire de la sala. */
export interface Muestras { L: number; Lruta: number; s: number[]; p: V3[]; gas: number[]; qr: number[] }
const memoM = new WeakMap<object, Map<string, Muestras>>();
export function muestrearRuta(ruta: V3[], n: number, Lextra: number, caso: Caso, S: Supuestos = SUPUESTOS): Muestras {
  const clave = `${caso}|${n}|${Lextra}|${ruta.map((p) => p.map((v) => v.toFixed(3)).join(',')).join(';')}`;
  let mapa = memoM.get(S); if (!mapa) { mapa = new Map(); memoM.set(S, mapa); }
  const hit = mapa.get(clave); if (hit) return hit;
  const Lr = largoRuta(ruta), L = Lr + Lextra, occ: Caja[] = [];
  const m: Muestras = { L, Lruta: Lr, s: [], p: [], gas: [], qr: [] };
  for (let i = 0; i <= n; i++) {
    const s = (L * i) / n, p = puntoEnRuta(ruta, Math.min(s, Lr));
    m.s.push(s); m.p.push(p);
    if (s > Lr + 1e-9) { m.gas.push(0); m.qr.push(0); continue; }
    m.gas.push(gasPluma(p, caso, S));
    m.qr.push(qArco(p, S.arco) + qMesa(p, [0, 0, -1], S, occ, 24).q);
  }
  mapa.set(clave, m);
  return m;
}
/** Muestras de una barra en aire quieto (para comparar con la aleta analítica). */
export function muestrasAire(L: number, n: number): Muestras {
  const s = Array.from({ length: n + 1 }, (_, i) => (L * i) / n);
  return { L, Lruta: L, s, p: s.map((x) => [0, 0, x] as V3), gas: s.map(() => 0), qr: s.map(() => 0) };
}
/** Propiedades por metro de un tramo: kA (W·m/K), perímetro que convecta Pc (m), h (W/m²K), α y χ, Joule q_J (W/m). */
export interface PropAleta { kA: number; Pc: number; h: number; alfa: number; chi: number; qJ: number }
/** Aleta 1D por diferencias finitas: kA·T'' − h·Pc·(T − T∞) + q_J = 0, T∞ = T_amb + χ·ΔT_gas + α·q_rad/(π·h) (un cilindro
 *  absorbe α·q·D y convecta h·π·D). Base a T0, punta adiabática. Q = calor que entra por la base (balance). */
export function aletaFD(m: Muestras, prop: (s: number) => PropAleta, T0: number, S: Supuestos = SUPUESTOS) {
  const n = m.s.length - 1, ds = m.L / n / 1e3, Ta = S.termica.Tamb;
  const a = new Array<number>(n + 1).fill(0), b = new Array<number>(n + 1).fill(0), c = new Array<number>(n + 1).fill(0), d = new Array<number>(n + 1).fill(0);
  const Tinf: number[] = [], hp: number[] = [], qj: number[] = [];
  for (let i = 0; i <= n; i++) {
    const pr = prop(m.s[i]);
    Tinf.push(Ta + pr.chi * m.gas[i] + (pr.alfa * m.qr[i]) / (PI * pr.h)); hp.push(pr.h * pr.Pc); qj.push(pr.qJ);
    if (i === 0) { b[0] = 1; d[0] = T0; continue; }
    const g = (hp[i] * ds * ds) / pr.kA, src = (qj[i] * ds * ds) / pr.kA;
    if (i === n) { a[i] = -2; b[i] = 2 + g; d[i] = g * Tinf[i] + src; } else { a[i] = -1; b[i] = 2 + g; c[i] = -1; d[i] = g * Tinf[i] + src; }
  }
  for (let i = 1; i <= n; i++) { const w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; d[i] -= w * d[i - 1]; }
  const T = new Array<number>(n + 1); T[n] = d[n] / b[n];
  for (let i = n - 1; i >= 0; i--) T[i] = (d[i] - c[i] * T[i + 1]) / b[i];
  let Q = 0;
  for (let i = 0; i <= n; i++) Q += (i === 0 || i === n ? 0.5 : 1) * ds * (hp[i] * (T[i] - Tinf[i]) - qj[i]);
  return { T, Tinf, Q };
}
const interp = (xs: number[], ys: number[], x: number) => {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1] || 1); return ys[i - 1] + t * (ys[i] - ys[i - 1]); }
  return ys[ys.length - 1];
};

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 4) LA FUERZA DE EMPUJE: freno del carrete + inercia + capstan de la entrada + fricción de la guía recta
// ═════════════════════════════════════════════════════════════════════════════════════════════
const G = 9.81;
/** Momento de inercia del carrete (kg·mm²): el alambre es un anillo r_núcleo…r_lleno; el carrete vacío, a r = 40. */
export function inerciaCarrete(lleno: boolean, c = SUPUESTOS.carrete) {
  const mAl = lleno ? c.masaAlambre : 0, r = lleno ? c.rLleno : c.rNucleo;
  return { J: 0.5 * mAl * (c.rNucleo ** 2 + c.rLleno ** 2) + c.masaVacio * 40 ** 2, r, m: mAl + c.masaVacio };
}
/** El FRENO es el peso: fricción del buje del carrete sobre el eje impreso, T_b = μ·m·g·r_eje (N·mm). Cero piezas. */
export const frenoCarrete = (lleno: boolean, c = SUPUESTOS.carrete) => c.mu * inerciaCarrete(lleno, c).m * G * c.rEje;

/** thetaPETG: doblez en la boca impresa del clip; thetaPTFE: el arco de PTFE que sube el alambre por encima del bloque;
 *  Rarco: su radio (si es menor que el rizo del carrete, doblar y enderezar cuesta 2·Mp·(1/R − 1/R_rizo)). */
export interface GeoGuia { thetaPETG: number; thetaPTFE: number; Rarco: number; Lptfe: number; Linox: number }
export function fuerzaEmpuje(g: GeoGuia, S: Supuestos = SUPUESTOS, req: ReqAlambre = REQ_ALAMBRE) {
  const c = S.carrete, a = (req.vMax / 60 * 1e3) / c.rampa_s;          // mm/s² de la rampa de arranque
  const carrete = [true, false].map((ll) => { const { J, r } = inerciaCarrete(ll, c); const Tb = frenoCarrete(ll, c); return { freno: Tb / r, inercia: (J * a / r ** 2) * 1e-3, Tb, r }; });
  const carreteMax = Math.max(...carrete.map((x) => x.freno + x.inercia));
  const s = seccionAlambre(S.alambre.D, S.alambre.pared, S.alambre.E, S.alambre.sigmaY);
  const plastico = 2 * s.Mp * Math.max(0, 1 / g.Rarco - 1 / S.alambre.radioRizoCarrete);
  const entrada = capstan(capstan(carreteMax, S.guia.muPETG, g.thetaPETG), S.guia.muPTFE, g.thetaPTFE) + plastico;
  const D = S.alambre.D, R = S.alambre.radioRizo;
  const ptfe = friccionRizo(S.guia.muPTFE, (S.guia.ptfeID - D) / 2, s, R);
  const inox = friccionRizo(S.guia.muInox, (S.guia.cuelloID - D) / 2, s, R);
  const punta = friccionRizo(S.guia.muCobre, (S.guia.puntaID - D) / 2, s, R);
  const guia = ptfe.F + inox.F + punta.F;
  return { carrete, carreteMax, plastico, entrada, ptfe, inox, punta, guia, total: entrada + guia };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 5) LA TOPOLOGÍA: directo NEMA→rodillo contra reducción impresa. La física decide.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export type Topologia = 'directo' | 'reduccion';
/** Inercias (kg·m²) del rodillo de acero y de la loca reflejada al eje del rodillo. */
export function inerciasRodillo(S: Supuestos = SUPUESTOS) {
  const ro = S.rodillo.D / 2, ri = S.rodillo.barreno / 2;
  const m = S.rodillo.rho * (PI / 4) * (S.rodillo.D ** 2 - S.rodillo.barreno ** 2) * S.rodillo.ancho;
  const Jrod = 0.5 * m * ((ro / 1e3) ** 2 + (ri / 1e3) ** 2);
  const Jloca = S.loca.J * (ro / (S.loca.D / 2)) ** 2;
  return { m, Jrod, Jloca };
}
export function evaluarTopologia(topo: Topologia, F: number, Ipico: number, S: Supuestos = SUPUESTOS, req: ReqAlambre = REQ_ALAMBRE) {
  const m = S.nema, red = S.reduccion, r = S.rodillo.D / 2 / 1e3;
  const N = topo === 'directo' ? 1 : red.N, eta = topo === 'directo' ? 1 : red.eta;
  const { Jrod, Jloca } = inerciasRodillo(S);
  const Jm = topo === 'directo' ? m.J + Jrod + Jloca : m.J + red.Jpinon + (Jrod + Jloca + red.Jcorona) / N ** 2;
  const Tcarga = (F * r) / (N * eta);                                       // N·m en el eje del motor
  const wVmax = (N * (req.vMax / 60)) / r;
  const margen = parDisponible(wVmax, Ipico, m) / Tcarga;
  const umPorMicropaso = ((2 * PI * r * 1e3) / (m.pasosRev * S.driver.micro * N)) * 1e3;
  const juego = topo === 'directo' ? 0 : red.juegoCorona * ((r * 1e3) / red.rCorona);
  // error de posición: ±5 % del paso completo del micropaso (los dos) + excentricidad de 0.05 mm de la corona impresa
  const errPos = 0.05 * ((2 * PI * r * 1e6) / (m.pasosRev * N)) + (topo === 'directo' ? 0 : 0.05 * ((r * 1e3) / red.rCorona) * 1e3);
  const A = req.cmtAmp / 1e3;
  /** par pedido y disponible a la frecuencia f de la retracción ±A (pico de aceleración y pico de velocidad juntos: conservador) */
  const cmt = (f: number, I = Ipico) => {
    const w = 2 * PI * f, wPico = (N * w * A) / r, alfa = (N * w * w * A) / r;
    const pedido = Jm * alfa + Tcarga;
    return { pedido, disponible: parDisponible(wPico, I, m), rpmPico: (wPico * 60) / (2 * PI) };
  };
  const fMax = (SF: number, I = Ipico) => {
    let lo = 0.1, hi = 400;
    if (cmt(lo, I).disponible < SF * cmt(lo, I).pedido) return 0;
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; const c = cmt(mid, I); if (c.disponible >= SF * c.pedido) lo = mid; else hi = mid; }
    return lo;
  };
  return {
    topo, N, eta, Jm, Tcarga, wVmax, rpmVmax: (wVmax * 60) / (2 * PI), margen, umPorMicropaso, juego, errPos,
    piezasExtra: topo === 'directo' ? 0 : red.piezasExtra, cmt, fMax, fCMT: fMax(req.cmtSF),
  };
}
export type EvalTopo = ReturnType<typeof evaluarTopologia>;
/** La regla: cumplen margen ≥ 2 a vMax y ≤ 50 µm/micropaso; gana la de mayor f de retracción; empate → menos piezas. */
export function elegirTopologia(cands: EvalTopo[], req: ReqAlambre = REQ_ALAMBRE) {
  const ok = cands.filter((c) => c.margen >= req.margenPar && c.umPorMicropaso <= req.resolucionMax);
  const pool = ok.length ? ok : cands;
  return pool.slice().sort((a, b) => (b.fCMT - a.fCMT) || (a.piezasExtra - b.piezasExtra))[0];
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 6) EL COLCHÓN DEL CARRETE: que la retracción ±1 mm no arrastre 1 kg de alambre
// ═════════════════════════════════════════════════════════════════════════════════════════════
/** El tramo libre del carrete a la entrada. Si llega DOBLADO θ (≥ 10°), su rigidez axial es de flexión: con la tensión
 *  del freno T el alambre toma radio λ = √(EI/T) y k ≈ 2EI/(θ·λ³). Si llega RECTO y tenso, k = EA/L (acero).
 *  El carrete (m_eq = J/r²) es una masa en ese resorte: a la frecuencia f le pasa F = k·A·mω²/|k − mω²|. */
export function colchonCarrete(theta: number, L: number, f: number, A = REQ_ALAMBRE.cmtAmp, S: Supuestos = SUPUESTOS) {
  const s = seccionAlambre(S.alambre.D, S.alambre.pared, S.alambre.E, S.alambre.sigmaY);
  const { J, r } = inerciaCarrete(true, S.carrete);
  const T = frenoCarrete(true, S.carrete) / r;
  const lambda = Math.sqrt(s.EI / T);
  const k = theta >= (10 * PI) / 180 ? (2 * s.EI) / (theta * lambda ** 3) : (S.alambre.E * s.A) / L;   // N/mm
  const meq = J / r ** 2;                                                                                 // kg
  const kSI = k * 1e3, w = 2 * PI * f, mw2 = meq * w * w;
  const fn = Math.sqrt(kSI / meq) / (2 * PI);
  const F = (kSI * (A / 1e3) * mw2) / Math.max(1e-9, Math.abs(kSI - mw2));
  return { T, lambda, k, meq, fn, F, moverCarrete: (A * kSI) / Math.max(1e-9, Math.abs(kSI - mw2)) };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 7) LA PRESIÓN DE LA LOCA: agarrar sin aplastar el tubular; resorte o flexión impresa (creep)
// ═════════════════════════════════════════════════════════════════════════════════════════════
/** Agarre: N ≥ SF·F/μ (sólo el rodillo motriz empuja). Aplastar: anillo de pared t entre dos rodillos colapsa con
 *  q = σy·t²/R_m por mm; el contacto mide ℓ = 2·√(2·R_ef·δ) con 1/R_ef = 2/D_rod + 2/D_loca y δ = 0.05 mm. */
export function presionLoca(F: number, S: Supuestos = SUPUESTOS) {
  const a = S.alambre, Rm = (a.D - a.pared) / 2;
  const Ref = 1 / (2 / S.rodillo.D + 2 / S.loca.D), l = 2 * Math.sqrt(2 * Ref * S.agarre.dAplastar);
  const Naplasta = ((a.sigmaY * a.pared ** 2) / Rm) * l;
  const Nmin = (S.agarre.SF * F) / S.agarre.muMoleteado;
  return { Nmin, Naplasta, Nmax: Naplasta / S.agarre.SFaplastar, lContacto: l };
}
/** Flexión impresa contra resorte de acero: el PETG relaja (a 1000 h, 40 °C, E(t)/E0 ≈ 0.55): una flexión
 *  precargada a N0 termina en N0·relaj. Un resorte de acero no relaja; el brazo impreso sólo lo guía. */
export function decisionResorte(Nmin: number, Nmax: number, S: Supuestos = SUPUESTOS, Tbloque = 60) {
  const relaj = Tbloque >= 50 ? S.petg.relaj60 : S.petg.relaj40;
  const N0flex = Nmax, Nfin = N0flex * relaj;
  return { flexionImpresaOk: Nfin >= Nmin, N0flex, NfinFlex: Nfin, NfinFlex40: N0flex * S.petg.relaj40, Tbloque, eleccion: Nfin >= Nmin ? 'flexión impresa' : 'resorte de acero' };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 8) AS5600, RIEL, BROCHE
// ═════════════════════════════════════════════════════════════════════════════════════════════
export function as5600(D: number, gap: number, S: Supuestos = SUPUESTOS, req: ReqAlambre = REQ_ALAMBRE) {
  const res = ((PI * D) / S.as5600.cuentas) * 1e3, resADC = ((PI * D) / 2 ** S.as5600.enobADC) * 1e3;
  const revPorSeg = (req.vMax / 60 * 1e3) / (PI * D);
  return { umPorCuenta: res, umEfectivoADC: resADC, gap, gapOk: gap >= S.as5600.entrehierroMin && gap <= S.as5600.entrehierroMax, revPorSeg };
}
/** Macho de cola de milano = hembra del contrato con cada flanco corrido g (normal) hacia adentro y el fondo corrido g.
 *  Flanco a α = atan(((fondo − boca)/2)/prof) del eje y → el medio ancho baja g/cos α a cualquier altura. */
export function rielMacho(g: number) {
  const { anchoBoca: b, anchoFondo: f, profundidad: p, centroX: cx } = RIEL;
  const alfa = Math.atan((f - b) / 2 / p), d = g / Math.cos(alfa);
  const y0 = 150, y1 = 150 + p - g;
  const medio = (y: number) => b / 2 + ((f - b) / 2) * ((y - y0) / p) - d;
  const pts: [number, number][] = [[cx - medio(y0), y0], [cx + medio(y0), y0], [cx + medio(y1), y1], [cx - medio(y1), y1]];
  return { g, alfa, pts, juegoX: 2 * d, bocaMacho: 2 * medio(y0), fondoMacho: 2 * medio(y1), profMacho: p - g };
}
/** Broche en voladizo: ε = 1.5·y·h/L² (deformación en la raíz al meter el gancho y). */
export const epsBroche = (y: number, h: number, L: number) => (1.5 * y * h) / L ** 2;
export function brocheFuerza(y: number, h: number, L: number, w: number, S: Supuestos = SUPUESTOS, alfaGancho = PI / 4, mu = 0.3) {
  const I = (w * h ** 3) / 12, Fb = (3 * S.petg.E * I * y) / L ** 3;
  return { Fb, retencion: (Fb * (mu + Math.tan(alfaGancho))) / (1 - mu * Math.tan(alfaGancho)) };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 9) LA TÉRMICA DE LA LANZA: punta (fija a Tpunta) → portapuntas (nodo) → { cuello en la pluma → PETG ; cable OUT− ; tirantes }
// ═════════════════════════════════════════════════════════════════════════════════════════════
export interface GeoLanza {
  zPunta: number; Lpunta: number; zPortaBase: number; zPortaTop: number; Dporta: number;
  cuello: { k: number; Do: number; Di: number; Lexpuesto: number; eps: number };
  zPTFEbajo: number; cable: { Ldesnudo: number; sContacto: number; ruta: V3[] };
  tirantes: { collar: V3; anclas: V3[] } | null;
}
/** El nodo del portapuntas: G_punta·(T_punta − T_p) = G_porta·(T_p − T_amb) + Q_cuello(T_p) + Q_cable(T_p); las aletas son
 *  lineales en T_p (dos soluciones bastan). El cuello acaba adiabático en la boca del zócalo (adentro del PETG no convecta). */
export function termicaLanza(g: GeoLanza, S: Supuestos = SUPUESTOS, caso: Caso = 'conCampana') {
  const t = S.termica, Ta = t.Tamb, I = S.arco.I, ep = S.enPluma;
  // la punta de cobre (Ø6, barreno 1) conduce de su extremo a la rosca del portapuntas
  const Apunta = (PI / 4) * (36 - 1) * 1e-6, Lp = (g.zPortaBase + 3 - g.zPunta) / 1e3;
  const Gpunta = (t.kCobre * Apunta) / Lp;
  const Aporta = PI * (g.Dporta / 1e3) * ((g.zPortaTop - g.zPortaBase) / 1e3) + 2 * (PI / 4) * (g.Dporta / 1e3) ** 2;
  const Gporta = t.h * Aporta;
  // el cuello, en el eje de la pluma
  const Lc = g.cuello.Lexpuesto, mC = muestrearRuta([[0, 0, g.zPortaTop], [0, 0, g.zPortaTop + Lc]], 300, 0, caso, S);
  const Ac = (PI / 4) * ((g.cuello.Do / 1e3) ** 2 - (g.cuello.Di / 1e3) ** 2);
  const propC = (): PropAleta => ({ kA: g.cuello.k * Ac, Pc: PI * (g.cuello.Do / 1e3), h: t.h, alfa: g.cuello.eps, chi: chiCuerpo(g.cuello.eps, S), qJ: 0 });
  // el cable: tramo desnudo (cobre a la vista) y tramo con silicona (h efectiva con la resistencia del aislante); Joule en todo
  const Acu = (PI / 4) * (t.cableCuD / 1e3) ** 2, qJ = (I * I * t.rhoCu) / Acu;
  const hAis = 1 / (1 / t.h + (t.aislanteT / 1e3) / t.kSilicona);
  const desnudo: PropAleta = { kA: t.kCobre * Acu, Pc: PI * (t.cableCuD / 1e3), h: t.h, alfa: ep.epsCobre, chi: chiCuerpo(ep.epsCobre, S), qJ };
  const aislado: PropAleta = { kA: t.kCobre * Acu, Pc: PI * (t.cableOD / 1e3), h: hAis, alfa: ep.epsSilicona, chi: chiCuerpo(ep.epsSilicona, S), qJ };
  const propK = (s: number) => (s <= g.cable.Ldesnudo ? desnudo : aislado);
  const Lk = largoRuta(g.cable.ruta) + S.cable.Lcolumna, mK = muestrearRuta(g.cable.ruta, Math.ceil(Lk / 2), S.cable.Lcolumna, caso, S);
  const Qfin = (Tp: number) => aletaFD(mC, propC, Tp, S).Q + aletaFD(mK, propK, Tp, S).Q;
  const Q1 = Qfin(Ta), Q2 = Qfin(Ta + 100), bQ = (Q2 - Q1) / 100, aQ = Q1 - bQ * Ta;
  const Tporta = (Gpunta * t.Tpunta + Gporta * Ta - aQ) / (Gpunta + Gporta + bQ);
  const fc = aletaFD(mC, propC, Tporta, S), fk = aletaFD(mK, propK, Tporta, S);
  const Tcuello = (x: number) => interp(mC.s, fc.T, x);
  const Tcable = (s: number) => interp(mK.s, fk.T, s);
  // dónde ya aguanta el PTFE (≤ TptfeMax): por arriba del último punto del cuello que lo pasa
  let xPTFEmin = 0; fc.T.forEach((T, i) => { if (T > t.TptfeMax) xPTFEmin = mC.s[i]; });
  // los tirantes: aletas del collarín (a la T del cuello ahí) a su ancla en el PETG (punta adiabática: conservador)
  const Tanclas = (g.tirantes?.anclas ?? []).map((A) => {
    const C = g.tirantes!.collar, dir = unit(resta(A, C)), ini = suma(C, escala(dir, S.tirante.collarOD / 2));
    const At = (PI / 4) * (S.tirante.D / 1e3) ** 2, m = muestrearRuta([ini, A], 150, 0, caso, S);
    const pr: PropAleta = { kA: S.tirante.k * At, Pc: PI * (S.tirante.D / 1e3), h: t.h, alfa: S.tirante.eps, chi: chiCuerpo(S.tirante.eps, S), qJ: 0 };
    const f = aletaFD(m, () => pr, Tcuello(C[2] - g.zPortaTop), S);
    return f.T[f.T.length - 1];
  });
  let intTh = 0; for (let i = 1; i < fc.T.length; i++) intTh += 0.5 * (fc.T[i] + fc.T[i - 1] - 2 * Ta) * (mC.s[i] - mC.s[i - 1]);
  return {
    caso, Gpunta, Gporta, Q: Gpunta * (t.Tpunta - Tporta), Qcuello: fc.Q, Qcable: fk.Q, Tporta, TpetgCuello: fc.T[fc.T.length - 1],
    xPTFEmin, TptfeBajo: Tcuello(g.zPTFEbajo - g.zPortaTop), Tsilicona: Tcable(g.cable.Ldesnudo),
    TcableContacto: Tcable(g.cable.sContacto), Tanclas, Tcuello, Tcable,
    dilatacionCuello: S.inox.alfa * intTh,   // mm que BAJA la punta al calentarse
  };
}

// ── el zócalo aislado y lo que lee el KSD301 de K14 ──
/** El cuello (T_n en la boca) dentro de un inserto de aislante (r_c → r_s) que abraza el PETG (r_s → r_s + dBloque, a T_b): cascarones
 *  cilíndricos en serie, T_PETG = T_b + (T_n − T_b)·R_p/(R_i + R_p). Por arriba, el PTFE sale por la tapa del inserto (h mm): barra
 *  R_ptfe = h/(k·A) contra el disco en un medio semi-infinito R_esp = 1/(2·k_PETG·D). (El alambre adentro BAJA mientras hay arco:
 *  lleva frío hacia abajo, Pe ≫ 1; no se cuenta como camino de calor.) */
export function zocaloAislado(Tn: number, Tb: number, Do: number, ins: { k: number; r: number }, S: Supuestos = SUPUESTOS) {
  const rc = Do / 2, kp = S.petg.k, d = S.inserto.dBloque;
  const Ri = Math.log(ins.r / rc) / (2 * PI * ins.k), Rp = Math.log((ins.r + d) / ins.r) / (2 * PI * kp);
  const Tint = Tb + ((Tn - Tb) * Rp) / (Ri + Rp);
  const Ap = (PI / 4) * ((S.guia.ptfeOD / 1e3) ** 2 - (S.guia.ptfeID / 1e3) ** 2), Rptfe = S.inserto.tapa / 1e3 / (0.25 * Ap), Resp = 1 / (2 * kp * (S.guia.ptfeOD / 1e3));
  const Tptfe = Tb + ((Tn - Tb) * Resp) / (Rptfe + Resp);
  return { Tint, Tptfe, Ri, Rp, beta: Rp / (Ri + Rp) };
}
/** La T del bloque junto al zócalo: las caras de abajo (a 45°, z = zP − y) a r + 2 del eje, con su escudo, en el caso dado. */
export function tBloqueZocalo(zP: number, escudado: boolean, caso: Caso, S: Supuestos = SUPUESTOS, r = 3) {
  const n: V3 = [0, -Math.SQRT1_2, -Math.SQRT1_2], a = r + 2;
  const T = ([[0, -a, zP + a], [0, a, zP - a]] as V3[]).map((p) => S.termica.Tamb + S.arco.chi * gasPluma(p, caso, S) + dTradiacion(p, n, escudado, S).dT);
  return (T[0] + T[1]) / 2;
}
/** El KSD301 de K14 toca el inserto donde lo abraza el PETG: lee la cara más caliente del PETG del zócalo (R = T_PETG). Se elige el
 *  MÁS BAJO de la serie (pasos de 5) que no corta trabajando (T − tol ≥ R de diseño + margen) y corta antes de que el PETG llegue a su
 *  límite de falla (T + tol ≤ tPetgFalla). Es respaldo: falla del enfriamiento, mesa desbocada, más corriente. */
export function elegirTermostato(Rd: number, req: ReqAlambre = REQ_ALAMBRE, S: Supuestos = SUPUESTOS) {
  const t = S.termostato;
  let T: number | null = null;
  for (let x = t.Tmin; x <= t.Tmax && T === null; x += t.paso) if (x - t.tol >= Rd + req.margenT && x + t.tol <= req.tPetgFalla) T = x;
  return { T, noCortaHasta: T === null ? null : T - t.tol, cortaA: T === null ? null : T + t.tol };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 9b) EL CUELLO DE LADO: viga sobre resortes de Winkler (la raíz en PETG), y el apoyo intermedio
// ═════════════════════════════════════════════════════════════════════════════════════════════
/** Cumplimiento lateral (mm/N) en la punta de una viga de Euler-Bernoulli: L libre desde la punta hasta la boca del zócalo y
 *  Le empotrados en PETG sobre un lecho de Winkler k_s (N/mm por mm de largo). Elementos finitos (rigidez del lecho consistente). */
export function cumplimientoVoladizo(EI: number, L: number, Le: number, ks: number, ne = 40) {
  const nE = Math.max(4, Math.round((ne * L) / (L + Le))), nI = Math.max(2, ne - nE), N = nE + nI + 1, n = 2 * N;
  const xs: number[] = [];
  for (let i = 0; i <= nE; i++) xs.push((L * i) / nE);
  for (let i = 1; i <= nI; i++) xs.push(L + (Le * i) / nI);
  const K: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let e = 0; e < N - 1; e++) {
    const h = xs[e + 1] - xs[e], c = EI / h ** 3, dofs = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    const kb = [[12, 6 * h, -12, 6 * h], [6 * h, 4 * h * h, -6 * h, 2 * h * h], [-12, -6 * h, 12, -6 * h], [6 * h, 2 * h * h, -6 * h, 4 * h * h]];
    const kf = [[156, 22 * h, 54, -13 * h], [22 * h, 4 * h * h, 13 * h, -3 * h * h], [54, 13 * h, 156, -22 * h], [-13 * h, -3 * h * h, -22 * h, 4 * h * h]];
    const enLecho = xs[e] >= L - 1e-9;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) K[dofs[i]][dofs[j]] += c * kb[i][j] + (enLecho ? ((ks * h) / 420) * kf[i][j] : 0);
  }
  const f = new Array<number>(n).fill(0); f[0] = 1;
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(K[r][i]) > Math.abs(K[p][i])) p = r;
    [K[i], K[p]] = [K[p], K[i]]; [f[i], f[p]] = [f[p], f[i]];
    for (let r = i + 1; r < n; r++) { const w = K[r][i] / K[i][i]; if (!w) continue; for (let c = i; c < n; c++) K[r][c] -= w * K[i][c]; f[r] -= w * f[i]; }
  }
  const u = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = f[i]; for (let c = i + 1; c < n; c++) s -= K[i][c] * u[c]; u[i] = s / K[i][i]; }
  return u[0];
}
/** Masa (g) del portapuntas de latón Ø Dporta × L (menos el barreno del cuello, 8 de hondo, y la rosca M6, 10) + la punta de cobre. */
export function masaPunta(Dporta: number, Do: number, L = 20, S: Supuestos = SUPUESTOS) {
  const porta = S.laton.rho * (PI / 4) * (Dporta ** 2 * L - Do ** 2 * 8 - 36 * 10);
  return porta + 8.9e-3 * (PI / 4) * (36 - 1) * 25;
}
/** Masa lineal del K06 (g/mm): cobre + silicona. */
export const masaLinealCable = (S: Supuestos = SUPUESTOS) =>
  S.cable.rhoCu * (PI / 4) * S.termica.cableCuD ** 2 + S.cable.rhoSil * (PI / 4) * (S.termica.cableOD ** 2 - S.termica.cableCuD ** 2);
/** El cuello en voladizo con su raíz en PETG: k = 1/cumplimiento; masa = punta + 33/140 del tubo (Rayleigh) + el cable que se mueve. */
export function cuelloLateral(Do: number, Di: number, L: number, Le: number, mPunta: number, mCable: number, S: Supuestos = SUPUESTOS, ks = S.petg.E) {
  const I = (PI / 64) * (Do ** 4 - Di ** 4), EI = S.inox.E * I;
  const k = 1 / cumplimientoVoladizo(EI, L, Math.max(1, Le), ks);
  const mTubo = S.inox.rho * (PI / 4) * (Do ** 2 - Di ** 2) * L, m = mPunta + (33 / 140) * mTubo + mCable;
  return { EI, k, kEmpotrado: (3 * EI) / L ** 3, mTubo, m, f: Math.sqrt((k * 1e3) / (m / 1e3)) / (2 * PI) };
}
/** Con el apoyo intermedio: cada tirante (varilla Ø D, del collarín a su ancla) suma k_a·e_i² en cada dirección lateral
 *  (k_a = EA/L). Modos: la masa de la punta en x y en y, cada varilla entre sus extremos (articulada-articulada,
 *  f = π/(2L²)·√(EI/m')) y el tramo del cuello del collarín al zócalo (articulado-articulado: cota baja). */
export function lateralConTirantes(cu: ReturnType<typeof cuelloLateral>, tir: { collar: V3; anclas: V3[] }, zBoca: number, Do: number, Di: number, S: Supuestos = SUPUESTOS) {
  const t = S.tirante, A = (PI / 4) * t.D ** 2, Iv = (PI / 64) * t.D ** 4;
  let kx = cu.k, ky = cu.k, mVar = 0;
  const fVarillas: number[] = [], largos: number[] = [];
  for (const a of tir.anclas) {
    const v = resta(a, tir.collar), Ls = norma(v) - t.collarOD / 2, e = unit(v), ka = (t.E * A) / Ls;
    kx += ka * e[0] ** 2; ky += ka * e[1] ** 2;
    const mp = t.rho * A;                             // g/mm = kg/m
    mVar += (mp * Ls) / 3; largos.push(Ls);
    fVarillas.push((PI / (2 * (Ls / 1e3) ** 2)) * Math.sqrt((t.E * Iv * 1e-6) / mp));
  }
  const mCollar = S.laton.rho * (PI / 4) * (t.collarOD ** 2 - Do ** 2) * t.collarL;
  const m = cu.m + mCollar + mVar;
  const fx = Math.sqrt((kx * 1e3) / (m / 1e3)) / (2 * PI), fy = Math.sqrt((ky * 1e3) / (m / 1e3)) / (2 * PI);
  const Ls = (zBoca - tir.collar[2]) / 1e3, mpT = S.inox.rho * (PI / 4) * (Do ** 2 - Di ** 2);
  const fTramo = (PI / (2 * Ls ** 2)) * Math.sqrt((cu.EI * 1e-6) / mpT);
  return { kx, ky, m, mCollar, mVar, fx, fy, fVarillas, largos, fTramo, f: Math.min(fx, fy, fTramo, ...fVarillas) };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 10) LA GEOMETRÍA COMO DATOS (la lee el script de OCCT y la juzga el juez)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export type Eje = 'x' | 'y' | 'z';
type Op = '+' | '-';
export type Prim =
  | { f: 'caja'; op: Op; a: V3; b: V3; nota?: string }
  | { f: 'cil'; op: Op; c: V3; eje: Eje; r: number; h: number; nota?: string }            // c = centro de la base; crece en +eje
  | { f: 'cilDir'; op: Op; c: V3; dir: V3; r: number; h: number; nota?: string }          // cilindro inclinado (dir unitario)
  | { f: 'cono'; op: Op; c: V3; eje: Eje; r1: number; r2: number; h: number; nota?: string }
  | { f: 'gota'; op: Op; c: V3; eje: 'x' | 'y'; r: number; h: number; nota?: string }     // barreno horizontal con pico a 45° (sin soporte)
  | { f: 'prismaYZ'; op: Op; pts: [number, number][]; x0: number; x1: number; nota?: string }
  | { f: 'prismaXY'; op: Op; pts: [number, number][]; z0: number; z1: number; nota?: string }
  | { f: 'prismaXZ'; op: Op; pts: [number, number][]; y0: number; y1: number; nota?: string };
export interface Giro { eje: Eje; grados: number }
export interface PiezaImpresa {
  id: string; nombre: string; color: string; prims: Prim[]; giro: Giro | null;
  puentes: { donde: string; luz: number }[]; nota: string;
}
/** Caja de un primitivo (marco del doc). */
export function cajaPrim(p: Prim): Caja {
  const box = (a: V3, b: V3): Caja => ({ x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), z0: Math.min(a[2], b[2]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]), z1: Math.max(a[2], b[2]) });
  const ax = (c: V3, eje: Eje, r: number, h: number, rz = r): Caja => {
    const i = eje === 'x' ? 0 : eje === 'y' ? 1 : 2, a: V3 = [c[0] - r, c[1] - r, c[2] - r], b: V3 = [c[0] + r, c[1] + r, c[2] + rz];
    a[i] = c[i]; b[i] = c[i] + h; if (i === 2) { a[2] = c[2]; b[2] = c[2] + h; }
    return box(a, b);
  };
  switch (p.f) {
    case 'caja': return box(p.a, p.b);
    case 'cil': return ax(p.c, p.eje, p.r, p.h);
    case 'cilDir': { const e = suma(p.c, escala(p.dir, p.h)), bb = box(p.c, e); return { x0: bb.x0 - p.r, y0: bb.y0 - p.r, z0: bb.z0 - p.r, x1: bb.x1 + p.r, y1: bb.y1 + p.r, z1: bb.z1 + p.r }; }
    case 'cono': return ax(p.c, p.eje, Math.max(p.r1, p.r2), p.h);
    case 'gota': return ax(p.c, p.eje, p.r, p.h, p.r * Math.SQRT2);
    case 'prismaYZ': { const ys = p.pts.map((q) => q[0]), zs = p.pts.map((q) => q[1]); return { x0: p.x0, x1: p.x1, y0: Math.min(...ys), y1: Math.max(...ys), z0: Math.min(...zs), z1: Math.max(...zs) }; }
    case 'prismaXY': { const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: p.z0, z1: p.z1 }; }
    case 'prismaXZ': { const xs = p.pts.map((q) => q[0]), zs = p.pts.map((q) => q[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: p.y0, y1: p.y1, z0: Math.min(...zs), z1: Math.max(...zs) }; }
  }
}
export function cajaPieza(pz: PiezaImpresa): Caja {
  const cs = pz.prims.filter((p) => p.op === '+').map(cajaPrim);
  return { x0: Math.min(...cs.map((c) => c.x0)), y0: Math.min(...cs.map((c) => c.y0)), z0: Math.min(...cs.map((c) => c.z0)),
    x1: Math.max(...cs.map((c) => c.x1)), y1: Math.max(...cs.map((c) => c.y1)), z1: Math.max(...cs.map((c) => c.z1)) };
}
/** Medidas de la pieza en su orientación de impresión (giros de 90° sobre un eje). */
export function medidasImpresion(pz: PiezaImpresa): V3 {
  const c = cajaPieza(pz); let d: V3 = [c.x1 - c.x0, c.y1 - c.y0, c.z1 - c.z0];
  if (pz.giro && Math.abs(pz.giro.grados) % 180 === 90) {
    if (pz.giro.eje === 'x') d = [d[0], d[2], d[1]]; else if (pz.giro.eje === 'y') d = [d[2], d[1], d[0]]; else d = [d[1], d[0], d[2]];
  }
  return d.map(r3) as V3;
}
const enPoligono = (u: number, v: number, pts: [number, number][]) => {
  let dentroP = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ui, vi] = pts[i], [uj, vj] = pts[j];
    if ((vi > v) !== (vj > v) && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) dentroP = !dentroP;
  }
  return dentroP;
};
/** ¿El punto cae dentro de algún primitivo «+» de la pieza? (para saber dónde toca el cable al PETG) */
export function puntoEnPieza(p: V3, pz: PiezaImpresa): boolean {
  return pz.prims.some((q) => {
    if (q.op !== '+') return false;
    if (q.f === 'prismaYZ') return p[0] >= q.x0 && p[0] <= q.x1 && enPoligono(p[1], p[2], q.pts);
    if (q.f === 'prismaXY') return p[2] >= q.z0 && p[2] <= q.z1 && enPoligono(p[0], p[1], q.pts);
    if (q.f === 'prismaXZ') return p[1] >= q.y0 && p[1] <= q.y1 && enPoligono(p[0], p[2], q.pts);
    return dentro(p, cajaPrim(q));
  });
}
/** Perfil de gota (pico a 45° arriba) en coordenadas locales (u horizontal, v vertical): el arco de ABAJO, de 135° a 405°
 *  pasando por 270°, y las dos tangentes a 45° que suben al pico (0, r·√2). (La ronda 1 recorría el arco de arriba y el
 *  polígono se cruzaba consigo mismo.) */
export function perfilGota(r: number, n = 40): [number, number][] {
  const pts: [number, number][] = [];
  const a0 = (3 * PI) / 4, a1 = (9 * PI) / 4;
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  pts.push([0, r * Math.SQRT2]);
  return pts;
}

/** Caras de PETG que miran hacia abajo (punto, normal) de una pieza. Se omiten las tapadas: justo afuera de la cara hay
 *  otra pieza o un obstáculo (la pieza de abajo, el tope del riel). Cilindros y conos chicos no cuentan (van a la sombra). */
export interface CaraAbajo { p: V3; n: V3; nota: string; i: number }
/** Normales de las aristas de abajo de un perfil YZ (u = y, v = z): [u0, v0, u1, v1, ny, nz]. */
function aristasAbajoYZ(pts: [number, number][]) {
  let area = 0; for (let k = 0; k < pts.length; k++) { const [a, b] = pts[k], [c2, e] = pts[(k + 1) % pts.length]; area += a * e - c2 * b; }
  const out: [number, number, number, number, number, number][] = [];
  for (let k = 0; k < pts.length; k++) {
    const [u0, v0] = pts[k], [u1, v1] = pts[(k + 1) % pts.length], du = u1 - u0, dv = v1 - v0, L = Math.hypot(du, dv);
    const ny = (area > 0 ? dv : -dv) / L, nz = (area > 0 ? -du : du) / L;
    if (nz <= -1e-6) out.push([u0, v0, u1, v1, ny, nz]);
  }
  return out;
}
export function carasHaciaAbajo(pz: PiezaImpresa, tapan: PiezaImpresa[]): CaraAbajo[] {
  const out: CaraAbajo[] = [];
  const tapada = (p: V3, n: V3) => tapan.some((t) => puntoEnPieza([p[0] + 0.3 * n[0], p[1] + 0.3 * n[1], p[2] + 0.3 * n[2]], t));
  pz.prims.forEach((q, i) => {
    if (q.op !== '+') return;
    const push = (p: V3, n: V3) => { if (!tapada(p, n)) out.push({ p, n, nota: q.nota ?? q.f, i }); };
    if (q.f === 'caja' || q.f === 'prismaXY') {
      const c = cajaPrim(q), n: V3 = [0, 0, -1];
      for (const x of [c.x0 + 0.5, (c.x0 + c.x1) / 2, c.x1 - 0.5]) for (const y of [c.y0 + 0.5, (c.y0 + c.y1) / 2, c.y1 - 0.5]) {
        const p: V3 = [x, y, c.z0]; if (q.f === 'caja' || enPoligono(x, y, q.pts)) push(p, n);
      }
    } else if (q.f === 'prismaYZ') {
      for (const [u0, v0, u1, v1, ny, nz] of aristasAbajoYZ(q.pts))
        for (const t of [0.1, 0.5, 0.9]) for (const x of [q.x0 + 0.5, (q.x0 + q.x1) / 2, q.x1 - 0.5]) push([x, u0 + (u1 - u0) * t, v0 + (v1 - v0) * t], [0, ny, nz]);
    }
  });
  return out;
}
/** El tope del riel (columna de B) bajo el macho: tapa la cara de abajo del pie. */
export const TOPE_RIEL = (g: number): PiezaImpresa => ({ id: 'tope-columna', nombre: 'tope del riel (B)', color: '#000', giro: null, puentes: [], nota: '',
  prims: [{ f: 'prismaXY', op: '+', pts: rielMacho(g).pts, z0: RIEL.z0 - 20, z1: RIEL.z0 }] });
/** Temperatura de cada cara de abajo: aire + pluma (el peor caso: sin campana, o lo que escapa con ella) + radiación del arco y
 *  de la mesa (con o sin escudo). Las caras se diseñan para la falla: aguantan aunque la campana se apague. */
export function tCarasPetg(piezas: PiezaImpresa[], g: number, escudos: { pieza: string; nota: string }[], S: Supuestos = SUPUESTOS) {
  const tapan = [...piezas, TOPE_RIEL(g)];
  return piezas.flatMap((pz) => carasHaciaAbajo(pz, tapan.filter((t) => t !== pz)).map((c) => {
    const esc = escudos.some((e) => e.pieza === pz.id && e.nota === c.nota);
    const rad = dTradiacion(c.p, c.n, esc, S);
    const gas = Math.max(gasPluma(c.p, 'sinCampana', S), gasPluma(c.p, 'conCampana', S));
    const T = S.termica.Tamb + S.arco.chi * gas + rad.dT;
    return { pieza: pz.id, ...c, esc, F: rad.F, dTmesa: rad.dTmesa, T };
  }));
}

/** El plástico del carrete (abajo y al frente: lo que ve la mesa y el arco), con o sin su escudo en L. */
export function tempCarrete(ySp: number, zSp: number, rSp: number, escudo: boolean, S: Supuestos = SUPUESTOS) {
  return Math.max(...([[[0, ySp, zSp - rSp], [0, 0, -1]], [[0, ySp - rSp, zSp], [0, -1, 0]]] as [V3, V3][]).map(([p, n]) =>
    S.termica.Tamb + S.arco.chi * Math.max(gasPluma(p, 'sinCampana', S), gasPluma(p, 'conCampana', S)) + dTradiacion(p, n, escudo, S).dT));
}

function distCajas(a: Caja, b: Caja) { return Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1)); }
/** Las piezas metálicas y quién toca a quién (el juez del camino paralelo). red: la red externa a la que se SUELDA. */
export interface Metal { id: string; caja: Caja; red: string | null; toca: string[]; mat?: string; nota?: string; seg?: [V3, V3]; r?: number }
/** Distancia entre dos metales: caja contra caja, o el eje de una varilla (seg, radio r) contra lo otro. */
export function distMetales(a: Metal, b: Metal) {
  const pc = (p: V3): Caja => ({ x0: p[0], x1: p[0], y0: p[1], y1: p[1], z0: p[2], z1: p[2] });
  const muestras = (m: Metal) => (m.seg ? Array.from({ length: 41 }, (_, i) => pc(suma(m.seg![0], escala(resta(m.seg![1], m.seg![0]), i / 40)))) : [m.caja]);
  let d = Infinity;
  for (const ca of muestras(a)) for (const cb of muestras(b)) d = Math.min(d, distCajas(ca, cb) - (a.seg ? a.r ?? 0 : 0) - (b.seg ? b.r ?? 0 : 0));
  return Math.max(0, d);
}
/** Distancia mínima entre dos rutas (muestreadas cada `paso` mm), sin contar los puntos a menos de `lejos` de los puntos `fuera`. */
export function distRutas(a: V3[], b: V3[], fuera: V3[] = [], lejos = 0, paso = 2) {
  const mu = (r: V3[]) => { const L = largoRuta(r), n = Math.max(1, Math.ceil(L / paso)); return Array.from({ length: n + 1 }, (_, i) => puntoEnRuta(r, (L * i) / n)).filter((p) => fuera.every((f) => norma(resta(p, f)) >= lejos)); };
  const A = mu(a), B = mu(b); let d = Infinity;
  for (const p of A) for (const q of B) d = Math.min(d, norma(resta(p, q)));
  return d;
}
/** Las juntas entre metales (D4): con qué se unen. */
export interface Junta { a: string; b: string; tipo: 'Silfos' | 'BAg' | 'rosca' | 'desliza' | 'presion'; fundente: boolean; nota?: string }

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 11) EL DISEÑO: cada número sale de una regla de arriba
// ═════════════════════════════════════════════════════════════════════════════════════════════
const AMBAR = '#e8a33d', GRAFITO = '#23272e', COBRE = '#b87333';
/** Tangente del FRENTE (lado −y) del carrete (centro C, radio r) al punto P que está arriba: el alambre sale del carrete
 *  subiendo hacia P. doblez = cuánto se desvía de la vertical al entrar en P (la boca es vertical). */
export function tangenteFrente(P: [number, number], C: [number, number], r: number) {
  const dy = C[0] - P[0], dz = C[1] - P[1], d = Math.hypot(dy, dz), a = Math.atan2(dz, dy), b = Math.asin(Math.min(1, r / d));
  const L = Math.sqrt(Math.max(0, d * d - r * r));
  const cands = [a + b, a - b].map((ang) => ({ ang, T: [P[0] + L * Math.cos(ang), P[1] + L * Math.sin(ang)] as [number, number] }));
  const c = cands.sort((u, v) => u.T[0] - v.T[0])[0];
  const dir = Math.atan2(P[1] - c.T[1], P[0] - c.T[0]);
  return { T: c.T, L, doblez: Math.abs(dir - PI / 2) };
}
/** Recorre la ruta del cable (paso 1 mm) y devuelve cuánto cable va en el aire antes de tocar una pieza impresa. */
export function sAntesDeTocar(ruta: V3[], piezas: PiezaImpresa[]) {
  let s = 0;
  for (let i = 1; i < ruta.length; i++) {
    const a = ruta[i - 1], b = ruta[i], L = norma(resta(b, a)), n = Math.max(1, Math.ceil(L));
    for (let k = 1; k <= n; k++) {
      const t = k / n, p: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      if (piezas.some((pz) => puntoEnPieza(p, pz))) return s + L * t;
    }
    s += L;
  }
  return s;
}
/** Polilínea con cada esquina cambiada por un arco de radio R (tangente a los dos tramos), muestreado cada `paso` grados. */
export function rutaConRadios(pts: V3[], R: number, paso = 2): V3[] {
  const out: V3[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const uin = unit(resta(pts[i], pts[i - 1])), uout = unit(resta(pts[i + 1], pts[i]));
    const th = Math.acos(Math.max(-1, Math.min(1, pprod(uin, uout))));
    if (th < 1e-6) { out.push(pts[i]); continue; }
    const t = R * Math.tan(th / 2), S0 = suma(pts[i], escala(uin, -t));
    const nrm = unit(resta(uout, escala(uin, pprod(uin, uout)))), C = suma(S0, escala(nrm, R));
    const k = Math.max(2, Math.ceil((th * 180) / PI / paso));
    for (let j = 0; j <= k; j++) { const f = (th * j) / k; out.push(suma(C, suma(escala(nrm, -R * Math.cos(f)), escala(uin, R * Math.sin(f))))); }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
/** Radio de doblez a lo largo de una ruta: se remuestrea cada `paso` mm y en cada punto se toma el círculo que pasa por él y por
 *  los puntos a ±k mm (exacto en un arco; una esquina viva da ~k/√2; un tramo recto, infinito). */
export function radiosRuta(ruta: V3[], paso = 1, k = 6) {
  const L = largoRuta(ruta), n = Math.floor(L / paso), pts = Array.from({ length: n + 1 }, (_, i) => puntoEnRuta(ruta, i * paso));
  const j = Math.max(1, Math.round(k / paso)), R: number[] = [];
  for (let i = j; i + j < pts.length; i++) {
    const a = pts[i - j], b = pts[i], c = pts[i + j], ab = norma(resta(b, a)), bc = norma(resta(c, b)), ca = norma(resta(a, c));
    const area2 = norma([(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])]);
    R.push(area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2));
  }
  return R;
}
/** Las ranuras impresas donde entran las pestañas del escudo (REGLAS.todoImprimible): en los dos extremos x de la cara, una
 *  rendija de 1 mm × 3 de hondo a lo largo de cada arista de abajo (o del fondo de una caja). */
export function ranurasEscudo(q: Prim, nota: string, S: Supuestos = SUPUESTOS): Prim[] {
  const w = S.escudo.ranuraAncho, h = S.escudo.ranuraProf, tag = `ranura escudo «${nota}»`;
  if (q.f === 'caja' || q.f === 'prismaXY') {
    const c = cajaPrim(q);
    return [c.x0 + 1, c.x1 - 1 - w].map((x): Prim => ({ f: 'caja', op: '-', a: [x, c.y0 + 1, c.z0 - 0.01], b: [x + w, c.y1 - 1, c.z0 + h], nota: tag }));
  }
  if (q.f === 'prismaYZ') {
    const out: Prim[] = [];
    for (const [u0, v0, u1, v1, ny, nz] of aristasAbajoYZ(q.pts)) {
      const pts: [number, number][] = [[u0 + 0.01 * ny, v0 + 0.01 * nz], [u1 + 0.01 * ny, v1 + 0.01 * nz], [u1 - h * ny, v1 - h * nz], [u0 - h * ny, v0 - h * nz]];
      for (const x of [q.x0 + 1, q.x1 - 1 - w]) out.push({ f: 'prismaYZ', op: '-', x0: x, x1: x + w, pts, nota: tag });
    }
    return out;
  }
  return [];
}

export function disenarAlambre(req: ReqAlambre = REQ_ALAMBRE, S: Supuestos = SUPUESTOS) {
  const T = S.termica, nm = S.nema;
  // ── (a) ¿qué tan arriba empieza el PETG sobre el arco? pluma libre (Heskestad) + radiación, con margen ──
  let zP = 100; while (tPetgArco(0, zP, T.Tamb, S.arco) > req.tPetgMax - req.margenT) zP += 5;
  // ── (b) la lanza (marco del contrato: la punta termina en z = 14) y el empuje encima de la nariz ──
  const zPunta = 14, Lpunta = 25, zPortaBase = 33, zPortaTop = 53;
  const zNip = zP + 35, xRod = S.rodillo.D / 2 + S.alambre.D / 2, xLoca = -(S.loca.D / 2 + S.alambre.D / 2);
  const zNariz = zNip - 8, zPTFEtop = zNip - 10;
  const mitad = nm.lado / 2, yCara = 8;                          // NEMA: cara en y = 8, cuerpo hacia +y
  const zBt = zNip + mitad + 2.5, zTopP1 = 345, zA = 190;        // zA: junta pie/empuje (las dos entran al riel)
  const yBloqueAtras = 52;
  // ── (c) el carrete ABAJO, detrás del cuello (D5: se queda con su arco de PTFE) ──
  const rSp = S.carrete.D / 2, ySp = 90;
  const yClip = 68, zClip = zP - 44 + (yClip - 44);              // boca del clip de PTFE, bajo la costilla del bloque (45°)
  const zSp = Math.floor(Math.min(zP - yBloqueAtras - 2 - Math.sqrt(rSp ** 2 - (ySp - yBloqueAtras) ** 2), zClip - 8 - Math.sqrt(rSp ** 2 - (ySp - yClip) ** 2))) - 10;
  const Rarco = yClip / 2, zArco = zBt + 3;                       // arco de PTFE de la boca del clip a la boca del embudo
  // ── (d) el zócalo del cuello sube hasta la cueva del rodillo (2 mm de pared) o hasta el PTFE; la raíz empieza donde el PETG
  //        ya abraza el tubo completo (la V del fondo lo deja libre a un lado hasta zP + Do/2) ──
  const rCueva = S.rodillo.D / 2 + 0.8;
  const zTopZocalo = (Do: number) => Math.min(zPTFEtop, Math.floor(zNip - Math.sqrt(Math.max(0, rCueva ** 2 - (xRod - Do / 2) ** 2)) - 2));
  const LeDe = (Do: number) => zTopZocalo(Do) - (zP + Do / 2);
  const Lexp = zP - zPortaTop;
  // ── (e) K06 (A.POT a z 210, contrato v2): sale del portapuntas hacia −x, sube por x = −46 (fuera de la pluma) y entra recto
  //        por +y al pasamuros; cada vuelta con R = 6·OD ──
  const ap = puerto('A.POT').pos, Rk = REGLAS.dobladoMinK * T.cableOD, zb = (zPortaBase + zPortaTop) / 2;
  const rutaDe = (Dporta: number) => {
    const xV = -Dporta / 2 - 1 - Rk;
    return rutaConRadios([[-Dporta / 2, 0, zb], [xV, 0, zb], [xV, 0, ap[2]], [ap[0], ap[1] - 9, ap[2]], [ap[0], ap[1], ap[2]]], Rk);
  };
  // ── (f) el apoyo intermedio posible: collarín sobre el cuello y dos anclas en el frente de la V (z = zP + |y|) ──
  const zCollar = zPortaTop + 10 + S.tirante.collarL / 2, yAncla = -20;
  const tirGeo = { collar: [0, 0, zCollar] as V3, anclas: [[-26, yAncla, zP - yAncla], [32, yAncla, zP - yAncla]] as V3[] };
  const gc = holguraDfm(PERFIL_K1);
  const g = gc;
  const riel = rielMacho(g);
  const broche = { L: 27, h: 2.5, w: 8, y: 1.2 };
  const pestillo = { L: 20, h: zBt - (zNip + mitad + 0.3), w: 10, y: 1.5 };
  const resorte = { k: 4, L0: 20, De: 8, solido: 6, instalado: 32.5 - 22 };   // N/mm, mm — comprado; instalado = asiento (x −32.5) a la cola del carro (x −22)
  const gapIman = 2.0;
  // la loca 625-ZZ: tapa pegada a la cara del aro exterior (y −2.5); imán en la tapa; AS5600 a gapIman de su cara
  const tapa = { r: S.loca.D / 2 - 0.4, y0: -S.loca.ancho / 2 - 3.9, y1: -S.loca.ancho / 2, rHueco: S.loca.aroInt - 0.3, hueco: 0.6 };
  const yIman0 = tapa.y0, yIman1 = tapa.y0 + S.loca.imanH, yAS1 = yIman0 - gapIman, yAS0 = yAS1 - 1.6;
  // EL ZÓCALO AISLADO: el inserto (radio r) baja hasta donde el fondo a 45° lo deja libre (zP − r) y sube hasta 1 mm bajo el bolsillo
  // del NEMA; el cuello acaba `tapa` mm abajo de su tope (por ahí sale el PTFE).
  const zInsTop = Math.floor((zNip - mitad - 0.3 - 1) * 2) / 2;
  const insDe = (r: number) => ({ r, z0: zP - r, z1: zInsTop, zCuello: zInsTop - S.inserto.tapa });
  // K14: el KSD301 entra por la cara de atrás del bloque (y 52) y su tapa TOCA el inserto en y = r (donde lo abraza el PETG); z: lo más
  // abajo que deja el fondo a 45° con `paredV` de PETG. Sus hilos salen por atrás, van a x −29.5 y suben a la canaleta de señal.
  const ts = S.termostato, rK = ts.capD / 2 + 0.1;
  // cabe si su techo en gota queda a paredNema del bolsillo del NEMA y su tapa entera toca el inserto
  const k14De = (r: number) => {
    const zK = Math.ceil((zP - r + ts.paredV + rK) * 4) / 4, yT = r + ts.largo, zKmax = zNip - mitad - 0.3 - ts.paredNema - rK * Math.SQRT2;
    return { zK, yT, yCara: r, cabe: zK <= zKmax && zK - ts.capD / 2 >= insDe(r).z0 && zK + ts.capD / 2 <= insDe(r).z1 };
  };
  // canaletas: señal (K08 + K14) por la izquierda, K07 sola por la derecha; ≥ 15 mm de K06 y de K07 (REGLAS.separacionPotenciaSenalMm)
  const cs = { xSen0: -21, xSen1: -16, xK07: 34.5, yEsp0: 141, yEsp1: 145, zH0: 117, zH1: 122, rASEN: 3.5, rK14: 1.75 };

  // ── (i) las piezas impresas (marco del doc) ──
  const y1 = riel.pts[2][1];
  const macho = (z0: number, z1: number): Prim => ({ f: 'prismaXY', op: '+', pts: riel.pts, z0, z1, nota: 'macho del riel' });
  const zSlot = zNip - 9.2;
  const costilla = (x0: number, x1: number, nota: string): Prim => ({ f: 'prismaYZ', op: '+', x0, x1, nota,
    pts: [[46, zP - 46], [zP - zA, zA], [142, zA], [142, zBt + 5], [46, zBt + 5]] });
  const pasamuros = (id: string, r: number): Prim => { const pp = puerto(id).pos; return { f: 'gota', op: '-', c: [pp[0], 141, pp[2]], eje: 'y', r, h: 10, nota: `pasamuros ${id}${id === 'A.POT' ? ' (K06)' : ' (K07+K08)'}` }; };
  const conPasamuros = (z0: number, z1: number) => [['A.POT', 3.6], ['A.SEN', cs.rASEN]].filter(([id]) => { const z = puerto(id as string).pos[2]; return z >= z0 && z < z1; }).map(([id, r]) => pasamuros(id as string, r as number));
  const construir = (Do: number, tir: typeof tirGeo | null, ins: ReturnType<typeof insDe> | null) => {
    const zTopC = ins ? ins.zCuello : zTopZocalo(Do), kk = ins ? k14De(ins.r) : null;
    const zocalo: Prim[] = ins ? [
      { f: 'cil', op: '-', c: [0, 0, ins.z0 - 1], eje: 'z', r: ins.r, h: ins.z1 - ins.z0 + 1, nota: 'zócalo del inserto aislante (a presión)' },
      { f: 'cil', op: '-', c: [0, 0, ins.z1 - 1], eje: 'z', r: (S.guia.ptfeOD + 0.16) / 2, h: zPTFEtop - ins.z1 + 1, nota: 'PTFE 4×2' },
    ] : [
      { f: 'cil', op: '-', c: [0, 0, zP - 1], eje: 'z', r: Do / 2, h: zTopC - zP + 1, nota: 'zócalo del cuello (a presión)' },
      ...(zPTFEtop > zTopC ? [{ f: 'cil', op: '-', c: [0, 0, zTopC - 1], eje: 'z', r: (S.guia.ptfeOD + 0.16) / 2, h: zPTFEtop - zTopC + 1, nota: 'PTFE 4×2' } as Prim] : []),
    ];
    const P0: PiezaImpresa = {
      id: 'pie-carrete', nombre: 'Pie: riel macho + eje del carrete + pasamuros de lo que cae en su pared', color: AMBAR, giro: null,
      nota: 'entra primero al riel y se sienta en el tope z0; el carrete cuelga de su pared', puentes: [{ donde: 'techos de las ranuras de los escudos', luz: S.escudo.ranuraAncho }, { donde: 'techo de la ranura del escudo del carrete', luz: 2 },
        { donde: 'techo de la canaleta de señal al pasamuros', luz: cs.yEsp1 - cs.yEsp0 }],
      prims: [
        { f: 'caja', op: '+', a: [-50, 142, RIEL.z0], b: [50, 150, zA], nota: 'espina' },
        macho(RIEL.z0, zA),
        { f: 'prismaYZ', op: '+', x0: -30, x1: -26, pts: [[ySp - 14, zSp - 14], [142, zSp - 14 - (142 - ySp + 14)], [142, zA], [ySp - 14, zA]], nota: 'pared del eje (fondo a 45°)' },
        { f: 'gota', op: '-', c: [-31, ySp, zSp], eje: 'x', r: (S.carrete.rEje * 2 + 0.16) / 2 + 0.1, h: 6, nota: 'barreno del eje' },
        ...conPasamuros(RIEL.z0, zA),
        { f: 'caja', op: '-', a: [cs.xK07, cs.yEsp0, cs.zH0], b: [40, cs.yEsp1, zA + 1], nota: 'canaleta K07 en la espina' },
        { f: 'caja', op: '-', a: [cs.xSen0, cs.yEsp0, cs.zH0], b: [cs.xSen1, cs.yEsp1, zA + 1], nota: 'canaleta de señal K08+K14 en la espina' },
        { f: 'caja', op: '-', a: [cs.xSen0, cs.yEsp0, cs.zH0], b: [40, cs.yEsp1, cs.zH1], nota: 'canaleta de señal K08+K14 al pasamuros A.SEN' },
      ],
    };
    const P1: PiezaImpresa = {
      id: 'espina-empuje', nombre: 'Empuje: riel macho + broche + NEMA, rodillo, loca, AS5600, nariz, clip del PTFE, pasamuros de K06 y anclas de los tirantes', color: AMBAR, giro: null,
      nota: 'se imprime parada, como va; el fondo del bloque es una V a 45° (la nariz es lo más bajo sobre el arco)',
      puentes: [{ donde: 'techo del paso del rodillo', luz: 12 }, { donde: 'techo del bolsillo del NEMA', luz: 40.8 }, { donde: 'techo de la ranura del broche', luz: 11 },
        { donde: 'techo del paso del resalte', luz: nm.resalteAlto + 0.4 }, { donde: 'techo del paso de la loca al alambre', luz: 4.2 },
        { donde: 'techos de las ranuras de los escudos', luz: S.escudo.ranuraAncho }, { donde: 'fondo de las anclas de los tirantes', luz: S.tirante.D },
        ...(ins ? [{ donde: 'techo del zócalo del inserto', luz: 2 * ins.r }] : [{ donde: 'anillo del tope del zócalo', luz: (Do - S.guia.ptfeOD) / 2 + 0.1 }]),
        { donde: 'anillo del tope del PTFE', luz: (S.guia.ptfeOD + 0.16 - 1.4) / 2 }, { donde: 'techos de las canaletas en la espina', luz: cs.yEsp1 - cs.yEsp0 }],
      prims: [
        { f: 'caja', op: '+', a: [-50, 142, zA], b: [50, 150, zTopP1], nota: 'espina' },
        macho(zA, zTopP1),
        costilla(-30, -24, 'costilla izquierda'), costilla(34, 40, 'costilla derecha (peine K07/K08)'),
        { f: 'prismaYZ', op: '+', x0: -32, x1: 40, pts: [[-25, zP + 25], [0, zP], [yBloqueAtras, zP - yBloqueAtras], [yBloqueAtras, zBt], [-25, zBt]], nota: 'bloque de empuje (fondo en V a 45°)' },
        { f: 'prismaYZ', op: '+', x0: -4, x1: 4, pts: [[44, zP - 44], [yClip + 8, zP - 44 + yClip + 8 - 44], [yClip + 8, zBt], [44, zBt]], nota: 'clip del PTFE de entrada' },
        { f: 'cil', op: '-', c: [0, yClip, zClip - 1], eje: 'z', r: (S.guia.ptfeOD + 0.16) / 2, h: zBt - zClip + 2, nota: 'PTFE de entrada' },
        { f: 'cono', op: '-', c: [0, yClip, zClip - 1], eje: 'z', r1: 4, r2: (S.guia.ptfeOD + 0.16) / 2, h: 4, nota: 'boca del clip' },
        { f: 'caja', op: '-', a: [xRod - mitad - 0.3, yCara - 0.4, zNip - mitad - 0.3], b: [41, yCara + nm.largo + 0.4, zNip + mitad + 0.3], nota: 'bolsillo del NEMA (entra de lado, por +x)' },
        { f: 'caja', op: '-', a: [xRod - nm.resalte / 2 - 0.3, yCara - nm.resalteAlto - 0.4, zNip - nm.resalte / 2 - 0.3], b: [41, yCara, zNip + nm.resalte / 2 + 0.3], nota: 'paso del resalte Ø22' },
        { f: 'gota', op: '-', c: [xRod, -6, zNip], eje: 'y', r: rCueva, h: 12, nota: 'cueva del rodillo' },
        { f: 'caja', op: '-', a: [xRod, -6, zNip - S.rodillo.D / 2 - 0.5], b: [41, 6, zNip + S.rodillo.D / 2 + 0.5], nota: 'paso del rodillo (entra con el NEMA)' },
        { f: 'gota', op: '-', c: [xRod, -17.5, zNip], eje: 'y', r: 3.2, h: 14.5, nota: 'punta del eje' },
        { f: 'caja', op: '-', a: [-28, tapa.y0 - 0.5, zSlot], b: [-3.6, 6.5, zBt + 1], nota: 'carril del carro de la loca (abierto arriba; cabe la tapa del imán)' },
        { f: 'caja', op: '-', a: [-3.6, tapa.y0 - 0.5, zSlot], b: [0.6, 6.5, zNip + 7], nota: 'la loca llega al alambre' },
        { f: 'gota', op: '-', c: [-32.5, 0, zNip], eje: 'x', r: resorte.De / 2 + 0.3, h: 4.6, nota: 'asiento del resorte' },
        { f: 'caja', op: '-', a: [xLoca - 7, yAS0 - 0.3, zNip - 7.5], b: [xLoca + 7, yAS1 + 0.3, zBt + 1], nota: 'bolsillo del AS5600 (abierto arriba)' },
        ...zocalo,
        { f: 'cil', op: '-', c: [0, 0, zPTFEtop - 1], eje: 'z', r: 0.7, h: zNip - zPTFEtop + 2, nota: 'nariz Ø1.4' },
        { f: 'cono', op: '-', c: [0, 0, zNip + 8], eje: 'z', r1: 0.7, r2: 2.6, h: zBt - zNip - 8 - 3, nota: 'embudo de entrada' },
        { f: 'cil', op: '-', c: [0, 0, zBt - 3], eje: 'z', r: (S.guia.ptfeOD + 0.16) / 2, h: 4, nota: 'boca del PTFE de entrada' },
        { f: 'caja', op: '-', a: [20, 22, zNip + mitad + 0.3], b: [41, 23, zBt + 1], nota: 'pestillo del NEMA (corte)' },
        { f: 'caja', op: '-', a: [20, 33, zNip + mitad + 0.3], b: [41, 34, zBt + 1], nota: 'pestillo del NEMA (corte)' },
        { f: 'prismaXZ', op: '+', y0: 23.5, y1: 32.5, pts: [[xRod + mitad + 0.25, zNip + mitad + 0.3], [xRod + mitad + 1.75, zNip + mitad + 0.3], [xRod + mitad + 0.25, zNip + mitad - 1.2]], nota: 'diente del pestillo' },
        // K07 sola por la derecha: sale del NEMA por atrás, sube por la cara +x, la costilla derecha y la espina
        { f: 'caja', op: '-', a: [38, 44, zNip], b: [40.01, 48, zBt + 1], nota: 'paso de K07 del NEMA' },
        { f: 'caja', op: '-', a: [35, 44, zBt - 1], b: [40.01, 52, zBt + 1], nota: 'canaleta K07 a la costilla' },
        { f: 'caja', op: '-', a: [35, 46, zBt - 1], b: [39, cs.yEsp1, zBt + 6], nota: 'canaleta K07 en la costilla' },
        { f: 'caja', op: '-', a: [cs.xK07, cs.yEsp0, zA - 1], b: [40, cs.yEsp1, zBt + 6], nota: 'canaleta K07 en la espina' },
        // señal (K08 del AS5600 + K14 del KSD301) por la izquierda: arriba del bloque, costilla izquierda y espina a x −21…−16
        { f: 'caja', op: '-', a: [-31.5, -15, zBt - 4], b: [xLoca + 7, yAS0 - 0.3, zBt + 1], nota: 'canaleta de señal K08 (AS5600) por arriba' },
        { f: 'caja', op: '-', a: [-31.5, -15, zBt - 6], b: [-28.5, 50, zBt + 1], nota: 'canaleta de señal por la orilla izquierda' },
        { f: 'caja', op: '-', a: [-31.5, 44, zBt - 1], b: [-25.2, 50, zBt + 1], nota: 'canaleta de señal a la costilla' },
        { f: 'caja', op: '-', a: [-29.2, 46, zBt - 1], b: [-25.2, cs.yEsp1, zBt + 6], nota: 'canaleta de señal en la costilla izquierda' },
        { f: 'caja', op: '-', a: [-29.2, cs.yEsp0, zBt - 1], b: [cs.xSen1, cs.yEsp1, zBt + 6], nota: 'canaleta de señal a la espina' },
        { f: 'caja', op: '-', a: [cs.xSen0, cs.yEsp0, zA - 1], b: [cs.xSen1, cs.yEsp1, zBt + 6], nota: 'canaleta de señal K08+K14 en la espina' },
        // K14: el asiento del KSD301 (gota a lo largo de y, entra por atrás, su tapa toca el inserto) y el canal de sus hilos
        ...(kk ? [
          { f: 'gota', op: '-', c: [0, kk.yCara, kk.zK], eje: 'y', r: rK, h: yBloqueAtras + 0.1 - kk.yCara, nota: 'asiento del KSD301 (K14): su tapa toca el inserto' } as Prim,
          { f: 'cil', op: '-', c: [-29.5 - cs.rK14, kk.yT, kk.zK], eje: 'x', r: cs.rK14, h: 29.5 + cs.rK14, nota: 'canal K14 del KSD301 hacia la izquierda' } as Prim,
          { f: 'cil', op: '-', c: [-29.5, kk.yT, kk.zK], eje: 'z', r: cs.rK14, h: zBt + 1 - kk.zK, nota: 'canal K14 que sube a la canaleta de señal' } as Prim,
        ] : []),
        ...conPasamuros(zA, zTopP1),
        ...(tir ? tir.anclas.map((A, i): Prim => { const e = unit(resta(A, tir.collar)); return { f: 'cilDir', op: '-', c: suma(A, escala(e, -1)), dir: e, r: S.tirante.D / 2, h: S.tirante.Lancla + 1, nota: `ancla del tirante ${i + 1} (a presión)` }; }) : []),
        { f: 'caja', op: '-', a: [-5.5, 150, RIEL.z1 - 28], b: [5.5, 158.5, RIEL.z1 + 2], nota: 'ranura en U del broche' },
        { f: 'caja', op: '+', a: [-4, y1 - broche.h, RIEL.z1 - 30], b: [4, y1, RIEL.z1 - 1], nota: 'lengüeta del broche' },
        { f: 'prismaYZ', op: '+', x0: -4, x1: 4, pts: [[y1 - 0.2, RIEL.z1 - 6 - broche.y - 0.2], [y1 + broche.y, RIEL.z1 - 6], [y1 + broche.y, RIEL.z1 - 4], [y1 - 0.2, RIEL.z1 - 4 + broche.y + 0.2]], nota: 'gancho del broche (rampas a 45°)' },
      ],
    };
    return { P0, P1, zTopC };
  };

  // ── (g) el cuello de lado: f_n ≥ 2·f_CMT. Tres caminos (orden: otro tubo, otro largo, apoyo intermedio); gana el primero que cumple ──
  const pre = construir(S.guia.cuelloOD, null, null);
  const geoGuia0: GeoGuia = { thetaPETG: 0, thetaPTFE: PI, Rarco, Lptfe: 0, Linox: 0 };
  const tan = [S.carrete.rLleno, S.carrete.rNucleo].map((r) => tangenteFrente([yClip, zClip], [ySp, zSp], r));
  geoGuia0.thetaPETG = Math.max(...tan.map((x) => x.doblez));
  const IrmsTerm = IrmsTermica(req.tPetgMax - req.margenT, nm);
  const IrmsCMT = Math.min(S.driver.IrmsMax, Math.floor(IrmsTerm * 20) / 20);
  const fCMT0 = evaluarTopologia('directo', fuerzaEmpuje(geoGuia0, S, req).total, IrmsCMT * Math.SQRT2, S, req).fCMT;
  const fObj = req.fnCuelloK * fCMT0;
  const sC0 = sAntesDeTocar(rutaDe(12), [pre.P0, pre.P1]);
  const mCable = S.cable.fraccionLibre * masaLinealCable(S) * sC0;
  const tubos = S.tubos.filter(([, i]) => i === 4 || i === 6).map(([o, i]) => {
    const Dp = o === 6 ? 12 : o + 6, Le = LeDe(o), c = cuelloLateral(o, i, Lexp, Le, masaPunta(Dp, o, 20, S), mCable, S);
    return { Do: o, Di: i, Dporta: Dp, Le, k: c.k, m: c.m, f: c.f, ok: c.f >= fObj };
  });
  const base = cuelloLateral(S.guia.cuelloOD, S.guia.cuelloID, Lexp, LeDe(S.guia.cuelloOD), masaPunta(12, S.guia.cuelloOD, 20, S), mCable, S);
  let Lcorto = Lexp; while (Lcorto > 30 && cuelloLateral(S.guia.cuelloOD, S.guia.cuelloID, Lcorto, LeDe(S.guia.cuelloOD), masaPunta(12, S.guia.cuelloOD, 20, S), mCable, S).f < fObj) Lcorto -= 1;
  const TcaraCorto = tPetgArco(0, zPortaTop + Lcorto, T.Tamb, S.arco);
  const latTir = lateralConTirantes(base, tirGeo, zP, S.guia.cuelloOD, S.guia.cuelloID, S);
  const tuboOk = tubos.find((t) => t.ok);
  const caminos = [
    { camino: 'otro tubo', ok: !!tuboOk, texto: tubos.map((t) => `${t.Do}×${t.Di} (zócalo ${t.Le.toFixed(0)} mm, Ø${t.Dporta} portapuntas): ${t.f.toFixed(1)} Hz`).join(' · ') },
    { camino: 'otro largo', ok: TcaraCorto <= req.tPetgMax - req.margenT, texto: `6×4 pide ${Lcorto} mm libres → PETG a z ${zPortaTop + Lcorto}: ${TcaraCorto.toFixed(0)} °C` },
    { camino: 'apoyo intermedio', ok: latTir.f >= fObj, texto: `collarín + 2 tirantes de inox Ø${S.tirante.D}: ${latTir.f.toFixed(1)} Hz (x ${latTir.fx.toFixed(0)}, y ${latTir.fy.toFixed(0)}, varillas ${latTir.fVarillas.map((f) => f.toFixed(0)).join('/')}, tramo ${latTir.fTramo.toFixed(0)})` },
  ];
  const camino = caminos.find((c) => c.ok)?.camino ?? 'ninguno';
  const Do = camino === 'otro tubo' && tuboOk ? tuboOk.Do : S.guia.cuelloOD, Di = camino === 'otro tubo' && tuboOk ? tuboOk.Di : S.guia.cuelloID;
  const Dporta = Do === 6 ? 12 : Do + 6;
  const tirantes = camino === 'apoyo intermedio' ? tirGeo : null;
  // ── (g2) el zócalo aislado con la pluma DIRECTA (0 % de captura): el primer inserto (de menor radio; PTFE antes que silicato) que deja
  //         el PETG ≤ 67 °C, la salida del PTFE ≤ 67 °C, el aislante bajo su T máxima y un KSD301 de la serie que no corta trabajando ──
  const rutaK06 = rutaDe(Dporta), sContacto = r3(sAntesDeTocar(rutaK06, [pre.P0, pre.P1]));
  const geoTer = (k: number, eps: number, Lexp: number, zPTFEbajo: number, Ldes: number): GeoLanza => ({
    zPunta, Lpunta, zPortaBase, zPortaTop, Dporta, cuello: { k, Do, Di, Lexpuesto: Lexp, eps }, zPTFEbajo,
    cable: { Ldesnudo: Ldes, sContacto, ruta: rutaK06 }, tirantes,
  });
  const lim67 = req.tPetgMax - req.margenT, inox = { k: T.kInox, eps: S.enPluma.epsInox };
  const candidatos = S.inserto.radios.flatMap((r) => S.aislantes.map((a) => {
    const ins = insDe(r), Tn = termicaLanza(geoTer(inox.k, inox.eps, ins.z0 - zPortaTop, zPortaTop + 70, 100), S, 'conCampana').TpetgCuello;
    const z = zocaloAislado(Tn, tBloqueZocalo(zP, true, 'conCampana', S, r), Do, { k: a.k, r }, S), k = elegirTermostato(z.Tint, req, S);
    return { r, aislante: a.nombre, Tn, ...z, K: k.T, asiento: k14De(r).cabe, ok: z.Tint <= lim67 && z.Tptfe <= lim67 && Tn <= a.Tmax && k.T !== null && k14De(r).cabe };
  }));
  const elegidoIns = candidatos.find((c) => c.ok) ?? candidatos[candidatos.length - 1];
  const aisl = S.aislantes.find((a) => a.nombre === elegidoIns.aislante)!, inserto = { ...insDe(elegidoIns.r), ...aisl };
  const LexpReal = inserto.z0 - zPortaTop, LeIns = inserto.zCuello - inserto.z0;
  const { P0, P1, zTopC: zTopCuello } = construir(Do, tirantes, inserto);
  const P3: PiezaImpresa = {
    id: 'carro-loca', nombre: 'Carro de la rueda loca (perno impreso del 625-ZZ)', color: GRAFITO, giro: { eje: 'x', grados: -90 },
    nota: 'se imprime acostado sobre su cara +y: el perno queda vertical', puentes: [],
    prims: [
      { f: 'caja', op: '+', a: [-17, 2.9, zSlot + gc], b: [-2, 6.5 - gc, zNip + 9.2 - gc], nota: 'cuerpo' },
      { f: 'caja', op: '+', a: [-22, -5 + gc, zSlot + gc], b: [-17, 6.5 - gc, zNip + 9.2 - gc], nota: 'cola (empuja el resorte)' },
      { f: 'cil', op: '+', c: [xLoca, -S.loca.ancho / 2 + 0.05, zNip], eje: 'y', r: S.loca.Di / 2, h: 2.9 + S.loca.ancho / 2 - 0.05, nota: 'perno del 625 (no asoma de la cara del aro)' },
    ],
  };
  const P4: PiezaImpresa = {
    id: 'eje-carrete', nombre: 'Eje del carrete (dedos de broche en la punta)', color: GRAFITO, giro: { eje: 'y', grados: -90 },
    nota: 'se imprime parado sobre la cabeza', puentes: [],
    prims: [
      { f: 'cil', op: '+', c: [-30, ySp, zSp], eje: 'x', r: S.carrete.rEje, h: 54, nota: 'eje Ø15.5' },
      { f: 'cil', op: '+', c: [-33, ySp, zSp], eje: 'x', r: 10, h: 3, nota: 'cabeza' },
      { f: 'cil', op: '+', c: [S.carrete.ancho / 2 + 0.5, ySp, zSp], eje: 'x', r: 8.4, h: 1.3, nota: 'labio' },
      { f: 'caja', op: '-', a: [16, ySp - 1, zSp - 10], b: [25, ySp + 1, zSp + 10], nota: 'ranura: dos dedos' },
    ],
  };
  const P5: PiezaImpresa = {
    id: 'tapa-iman', nombre: 'Tapa del imán (pegada con epóxico a la cara del aro exterior del 625-ZZ)', color: GRAFITO, giro: { eje: 'x', grados: 90 },
    nota: 'se imprime con la cara del imán abajo; el hueco del lado del balero libra su tapa de lámina, el aro interior y el perno', puentes: [],
    prims: [
      { f: 'cil', op: '+', c: [xLoca, tapa.y0, zNip], eje: 'y', r: tapa.r, h: tapa.y1 - tapa.y0, nota: 'disco' },
      { f: 'cil', op: '-', c: [xLoca, tapa.y1 - tapa.hueco, zNip], eje: 'y', r: tapa.rHueco, h: tapa.hueco + 0.1, nota: 'hueco: sólo pega en el aro exterior' },
      { f: 'cil', op: '-', c: [xLoca, tapa.y0 - 0.1, zNip], eje: 'y', r: (S.loca.imanD + 0.08) / 2, h: S.loca.imanH + 0.1, nota: 'imán Ø6×2.5' },
    ],
  };
  const impresas = [P0, P1, P3, P4, P5];

  // ── (h) la térmica con el inserto elegido, la fuerza con la guía real, las corrientes y la topología ──
  // el cuello: ¿de qué material? el primero que deja el PETG del zócalo ≤ 67 °C con el inserto elegido
  const materiales = [{ nombre: 'inox 304', k: T.kInox, eps: S.enPluma.epsInox }, { nombre: 'latón', k: T.kLaton, eps: S.enPluma.epsLaton }, { nombre: 'cobre', k: T.kCobre, eps: S.enPluma.epsCobre }]
    .map((m) => { const Tn = termicaLanza(geoTer(m.k, m.eps, LexpReal, zPortaTop + 70, 100), S, 'conCampana').TpetgCuello; return { ...m, Tn, Tpetg: zocaloAislado(Tn, tBloqueZocalo(zP, true, 'conCampana', S, inserto.r), Do, inserto, S).Tint }; });
  const cuelloMat = materiales.find((m) => m.Tpetg <= lim67) ?? materiales[0];
  // el PTFE empieza donde el cuello ya está ≤ 230 °C (barato: sólo alarga el inox desnudo, que A10 revisa)
  const xPTFE = Math.max(...(['conCampana', 'sinCampana'] as Caso[]).map((cs) => termicaLanza(geoTer(cuelloMat.k, cuelloMat.eps, LexpReal, zPortaTop + 30, 100), S, cs).xPTFEmin));
  const zPTFEbajo = zPortaTop + Math.ceil((xPTFE + 10) / 5) * 5;
  let Ldesnudo = 10; while (Ldesnudo < 400 && termicaLanza(geoTer(cuelloMat.k, cuelloMat.eps, LexpReal, zPTFEbajo, Ldesnudo), S, 'conCampana').Tsilicona > T.TsiliconaMax - 20) Ldesnudo += 5;
  const geoLanza = geoTer(cuelloMat.k, cuelloMat.eps, LexpReal, zPTFEbajo, Ldesnudo);
  const term = termicaLanza(geoLanza, S, 'conCampana');
  const termFalla = termicaLanza(geoLanza, S, 'sinCampana');
  const Sinfo = { ...S, campana: { ...S.campana, eta: S.campana.etaInformativo } } as Supuestos;
  const termInfo = termicaLanza(geoLanza, Sinfo, 'conCampana');

  const geoGuia: GeoGuia = { thetaPETG: geoGuia0.thetaPETG, thetaPTFE: PI, Rarco, Lptfe: zPTFEtop - zPTFEbajo, Linox: zPTFEbajo - zPortaTop };
  const fuerza = fuerzaEmpuje(geoGuia, S, req);
  const topos = (['directo', 'reduccion'] as Topologia[]).map((tp) => evaluarTopologia(tp, fuerza.total, IrmsCMT * Math.SQRT2, S, req));
  const elegida = elegirTopologia(topos, req);
  let IrmsFeed = 0.1; while (IrmsFeed < IrmsCMT && evaluarTopologia(elegida.topo, fuerza.total, IrmsFeed * Math.SQRT2, S, req).margen < req.margenPar) IrmsFeed += 0.05;
  IrmsFeed = r3(Math.min(IrmsFeed, IrmsCMT));
  const feed = evaluarTopologia(elegida.topo, fuerza.total, IrmsFeed * Math.SQRT2, S, req);
  // el cuello de lado, con lo elegido y la retracción real
  const mCableReal = S.cable.fraccionLibre * masaLinealCable(S) * sContacto;
  const cuelloL = cuelloLateral(Do, Di, LexpReal, LeIns, masaPunta(Dporta, Do, 20, S), mCableReal, S, inserto.E);
  const lateral = tirantes ? { ...lateralConTirantes(cuelloL, tirantes, inserto.z0, Do, Di, S), cuello: cuelloL } : { ...cuelloL, cuello: cuelloL };

  // ── (j) la loca: agarre contra aplastamiento; resorte o flexión ──
  const pres = presionLoca(fuerza.total, S);
  const Nloca = Math.ceil(Math.max(pres.Nmin * 1.25, Math.min(pres.Nmax * 0.85, pres.Nmin * 2)));
  const decRes = decisionResorte(pres.Nmin, pres.Nmax, S, tempMotor(IrmsCMT, nm).T);

  // ── (k) la mesa a 300 °C y la pluma ven las caras de abajo: escudo de aluminio donde, sin él, el PETG pasaría de 67 °C ──
  const sinEscudo = tCarasPetg([P0, P1], g, [], S);
  const escudos = [...new Map(sinEscudo.filter((c) => c.T > req.tPetgMax - req.margenT).map((c) => [`${c.pieza}|${c.nota}`, { pieza: c.pieza, nota: c.nota }])).values()];
  const conEscudo = tCarasPetg([P0, P1], g, escudos, S);
  const peorDe = (cs: typeof sinEscudo) => cs.reduce((a, c) => (c.T > a.T ? c : a), cs[0]);
  const TcarreteSin = tempCarrete(ySp, zSp, rSp, false, S);
  const escudoCarrete = TcarreteSin > S.carrete.Tmax - req.margenT;
  const Tcarrete = tempCarrete(ySp, zSp, rSp, escudoCarrete, S);
  // REGLAS.todoImprimible: las ranuras de cada escudo van en su pieza (cortes «−»: no cambian ninguna cara de arriba)
  for (const es of escudos) { const pz = impresas.find((p) => p.id === es.pieza), q = pz?.prims.find((p) => p.nota === es.nota && p.op === '+'); if (pz && q) pz.prims.push(...ranurasEscudo(q, es.nota, S)); }
  const zEscC = zSp - rSp - S.escudo.gap, yParedEn = ySp - 28 + zSp - zEscC;   // donde el fondo a 45° de la pared baja de zEscC
  if (escudoCarrete) P0.prims.push({ f: 'caja', op: '-', a: [-28, Math.ceil(yParedEn + 2), zEscC - 0.5], b: [-25.99, 140, zEscC + 0.5], nota: 'ranura escudo del carrete' });

  // ── (l) el alambre de punta a punta y el PTFE de entrada (arco sobre el bloque) ──
  const arco: V3[] = Array.from({ length: 13 }, (_, i) => { const a = (PI * i) / 12; return [0, Rarco + Rarco * Math.cos(a), zArco + Rarco * Math.sin(a)] as V3; });
  const ptfeEntrada: V3[] = [[0, yClip, zClip], ...arco, [0, 0, zBt - 3]];

  // ── (m) los metales, quién toca a quién y con qué se unen (D4) ──
  const caja = (x0: number, y0: number, z0: number, x1: number, y1b: number, z1: number): Caja => ({ x0, y0, z0, x1, y1: y1b, z1 });
  const cajaRuta = (pts: V3[], r: number): Caja => ({ x0: Math.min(...pts.map((p) => p[0])) - r, y0: Math.min(...pts.map((p) => p[1])) - r, z0: Math.min(...pts.map((p) => p[2])) - r,
    x1: Math.max(...pts.map((p) => p[0])) + r, y1: Math.max(...pts.map((p) => p[1])) + r, z1: Math.max(...pts.map((p) => p[2])) + r });
  const rc = Do / 2, rp = Dporta / 2, tr = S.tirante, kk = k14De(inserto.r);
  const metales: Metal[] = [
    { id: 'alambre', mat: 'acero', caja: caja(-0.4, -0.4, 2, 0.4, 0.4, zArco), seg: [[0, 0, 2], [0, 0, zArco]], r: 0.4, red: null, toca: ['punta', 'portapuntas', 'cuello', 'rodillo', 'loca'] },
    { id: 'alambre-subida', mat: 'acero', caja: caja(-0.4, yClip - 0.4, zClip, 0.4, yClip + 0.4, zArco), seg: [[0, yClip, zClip], [0, yClip, zArco]], r: 0.4, red: null, toca: ['alambre'], nota: 'del clip al arco de PTFE' },
    { id: 'alambre-arco', mat: 'acero', caja: caja(-0.4, -0.4, zArco, 0.4, yClip + 0.4, zArco + Rarco + 0.4), red: null, toca: ['alambre', 'alambre-subida'], nota: 'dentro del arco de PTFE' },
    { id: 'punta', mat: 'cobre', caja: caja(-4, -4, zPunta, 4, 4, zPunta + Lpunta), red: null, toca: ['portapuntas'] },
    { id: 'portapuntas', mat: 'laton', caja: caja(-rp, -rp, zPortaBase, rp, rp, zPortaTop), red: null, toca: ['cuello', 'cableK06'] },
    { id: 'cuello', mat: 'inox', caja: caja(-rc, -rc, zPortaTop - 8, rc, rc, zTopCuello), red: null, toca: [], nota: `termina en el inserto de ${inserto.nombre}` },
    ...(tirantes ? [
      { id: 'collar', mat: 'laton', caja: caja(-tr.collarOD / 2, -tr.collarOD / 2, zCollar - tr.collarL / 2, tr.collarOD / 2, tr.collarOD / 2, zCollar + tr.collarL / 2), red: null, toca: ['cuello'], nota: 'desliza en el cuello' },
      ...tirantes.anclas.map((A, i): Metal => ({ id: `tirante${i + 1}`, mat: tr.mat, caja: cajaRuta([tirantes.collar, A], tr.D / 2), seg: [tirantes.collar, A], r: tr.D / 2, red: null, toca: ['collar'], nota: 'termina en PETG' })),
    ] as Metal[] : []),
    { id: 'cableK06', mat: 'cobre', caja: cajaRuta(rutaK06, T.cableOD / 2), red: 'OUT−', toca: [], nota: 'Silfos al portapuntas (D4)' },
    { id: 'rodillo', mat: 'acero', caja: caja(xRod - 15, -5, zNip - 15, xRod + 15, 5, zNip + 15), red: null, toca: ['buje'] },
    { id: 'buje', mat: 'laton', caja: caja(xRod - 3.5, -5, zNip - 3.5, xRod + 3.5, 5, zNip + 3.5), red: null, toca: ['ejeNema'] },
    { id: 'ejeNema', mat: 'acero', caja: caja(xRod - 2.5, yCara - nm.ejeLargo, zNip - 2.5, xRod + 2.5, yCara, zNip + 2.5), red: null, toca: ['nema'] },
    { id: 'nema', mat: 'acero', caja: caja(xRod - mitad, yCara - nm.resalteAlto, zNip - mitad, xRod + mitad, yCara + nm.largo, zNip + mitad), red: null, toca: [], nota: 'carcasa en PETG; bobinas aisladas de la carcasa' },
    { id: 'loca', mat: 'acero', caja: caja(xLoca - 8, -S.loca.ancho / 2, zNip - 8, xLoca + 8, S.loca.ancho / 2, zNip + 8), red: null, toca: [], nota: 'perno impreso' },
    { id: 'iman', mat: 'neodimio', caja: caja(xLoca - 3, yIman0, zNip - 3, xLoca + 3, yIman1, zNip + 3), red: null, toca: [], nota: 'dentro de la tapa impresa' },
    { id: 'resorte', mat: 'acero', caja: caja(-32.5, -4, zNip - 4, -22, 4, zNip + 4), red: null, toca: [], nota: 'entre PETG y PETG' },
    { id: 'as5600', mat: 'pcb', caja: caja(xLoca - 7, yAS0, zNip - 7.5, xLoca + 7, yAS1, zNip + 7.5), red: 'GND', toca: [], nota: 'tierra lógica (K08)' },
    { id: 'ksd301-tapa', mat: 'aluminio', caja: caja(-ts.capD / 2, kk.yCara, kk.zK - ts.capD / 2, ts.capD / 2, kk.yCara + ts.capH, kk.zK + ts.capD / 2), red: null, toca: [], nota: 'flota: aislada de sus terminales; toca el inserto y el PETG' },
    { id: 'ksd301-terminales', mat: 'laton', caja: caja(-4, kk.yT - 8, kk.zK - 4, 4, kk.yT, kk.zK + 4), red: 'SD', toca: [], nota: 'K14 soldado (cadena SD de C)' },
  ];
  const juntas: Junta[] = [
    { a: 'cableK06', b: 'portapuntas', tipo: 'Silfos', fundente: true, nota: 'OUT− (D4): cobre con latón, soplete MAP' },
    { a: 'cuello', b: 'portapuntas', tipo: 'BAg', fundente: true, nota: 'inox con latón: Silfos no (fósforo + Ni/Fe)' },
    { a: 'punta', b: 'portapuntas', tipo: 'rosca', fundente: false, nota: 'M6 de la punta comercial' },
    ...(tirantes ? [
      ...tirantes.anclas.map((_, i): Junta => ({ a: `tirante${i + 1}`, b: 'collar', tipo: 'BAg', fundente: true, nota: 'inox con latón: plata 45 % sin fósforo' })),
      { a: 'collar', b: 'cuello', tipo: 'desliza', fundente: false, nota: 'H7/g6: el cuello crece libre al calentarse' } as Junta,
    ] : []),
  ];

  // ── (m2) el zócalo y K14 con el inserto elegido: el PETG que abraza el inserto con la pluma directa (diseño), sin campana y con el
  //         80 % informativo; el KSD301 toca ese PETG y se elige para no cortar trabajando y cortar antes del límite de falla ──
  const bloqueEsc = escudos.some((e) => e.nota.startsWith('bloque'));
  const zocDe = (tt: ReturnType<typeof termicaLanza>, caso: Caso, SS: Supuestos) => ({ Tn: tt.TpetgCuello, Tb: tBloqueZocalo(zP, bloqueEsc, caso, SS, inserto.r), ...zocaloAislado(tt.TpetgCuello, tBloqueZocalo(zP, bloqueEsc, caso, SS, inserto.r), Do, inserto, SS) });
  const zocalo = { diseno: zocDe(term, 'conCampana', S), sinCampana: zocDe(termFalla, 'sinCampana', S), informativo80: zocDe(termInfo, 'conCampana', Sinfo) };
  const selK = elegirTermostato(zocalo.diseno.Tint, req, S);
  const termostato = { clase: ts.clase, tol: ts.tol, yCara: kk.yCara, zK: kk.zK, yT: kk.yT, R: zocalo.diseno.Tint, Rinfo: zocalo.informativo80.Tint, ...selK };
  // ── (m3) las rutas de los hilos (ejes) y lo que cabe en cada canaleta (REGLAS.llenadoMax) ──
  const pSEN: V3 = [puerto('A.SEN').pos[0], 146, puerto('A.SEN').pos[2]];
  const xSen = (cs.xSen0 + cs.xSen1) / 2, ySen = (cs.yEsp0 + cs.yEsp1) / 2, zSenH = (cs.zH0 + cs.zH1) / 2;
  const rutaSenal: V3[] = [[xLoca, yAS0 - 2.3, zBt - 1], [-30, yAS0 - 2.3, zBt - 1], [-30, 47, zBt - 1], [-27.2, 47, zBt + 2], [-27.2, ySen, zBt + 2],
    [xSen, ySen, zBt + 2], [xSen, ySen, zSenH], [pSEN[0], ySen, zSenH], pSEN];
  const rutaK14: V3[] = [[0, kk.yT, kk.zK], [-29.5, kk.yT, kk.zK], [-29.5, kk.yT, zBt - 1], [-30, kk.yT, zBt - 1]];
  const rutaK07: V3[] = [[39, 46, zNip], [39, 46, zBt + 2], [37, 48, zBt + 2], [37, ySen, zBt + 2], [(cs.xK07 + 40) / 2, ySen, zSenH], pSEN];
  const canales = [
    { id: 'canaleta de señal', cables: ['K08', 'K14'], seccion: Math.min(4.7 * 4, 3 * 6, 4 * 6, (cs.xSen1 - cs.xSen0) * (cs.yEsp1 - cs.yEsp0), (cs.yEsp1 - cs.yEsp0) * (cs.zH1 - cs.zH0)) },
    { id: 'canal K14', cables: ['K14'], seccion: PI * cs.rK14 ** 2 },
    { id: 'canaleta K07', cables: ['K07'], seccion: Math.min(4 * 6, (40 - cs.xK07) * (cs.yEsp1 - cs.yEsp0)) },
    { id: 'pasamuros A.SEN', cables: ['K07', 'K08', 'K14'], seccion: PI * cs.rASEN ** 2 },
  ];

  // ── (n) números para el reporte ──
  const colchon = colchonCarrete(geoGuia.thetaPTFE, PI * Rarco, elegida.fCMT, req.cmtAmp, S);
  const sec = seccionAlambre(S.alambre.D, S.alambre.pared, S.alambre.E, S.alambre.sigmaY);
  const Llibre = zNip - zNariz;
  return {
    req, S, zP, zNip, zBt, zA, zTopP1, zNariz, zPTFEtop, zPTFEbajo, xRod, xLoca, yCara, ySp, zSp, rSp, yClip, zClip, Rarco, zArco,
    lanza: geoLanza, cuelloMat, materiales, term, termFalla, termInfo, zocalo, inserto, candidatosInserto: candidatos, lateral, Ldesnudo, rutaK06, sContacto, ptfeEntrada,
    cuello: { Do, Di, Dporta, zTop: zTopCuello, Le: LeIns, Lexp: LexpReal, caminos, camino, tubos, fObj },
    tirantes, campana: (() => { const tr = trayectoria(S); return { ...campanaSumidero(), capturada: tr.capturada, zCaptura: tr.zCaptura, Qe: tr.Qe,
      yEje: [24, 50, 100, 150, 200, 260].map((z) => [z, yPlumaEn(tr, z)] as [number, number | null]) }; })(),
    tangentes: tan, geoGuia, fuerza, topos, topologia: elegida.topo, eleccion: elegida, feed,
    corriente: { IrmsFeed, IrmsCMT, IrmsTerm, Tmotor: tempMotor(IrmsCMT, nm), TmotorFeed: tempMotor(IrmsFeed, nm), VM: nm.V },
    micro: S.driver.micro, colchon, pandeo: { Llibre, Pcr: eulerPcr(sec.EI, Llibre), margen: eulerPcr(sec.EI, Llibre) / fuerza.total },
    juego: juegoGuia(fuerza.total, (S.guia.ptfeID - S.alambre.D) / 2, geoGuia.Lptfe, sec),
    loca: { N: Nloca, ...pres, resorte, precarga: resorte.L0 - resorte.instalado, decision: decRes, gapIman, D: S.loca.D, tapa, as: as5600(S.loca.D, gapIman, S, req) },
    riel, broche, pestillo, holgura: g, impresas, metales, juntas,
    termostato, rutaSenal, rutaK14, rutaK07, canales,
    escudos, escudoAgujero: 2 * inserto.r + 2 * req.holguraEscudo, carasSin: peorDe(sinEscudo), carasCon: peorDe(conEscudo), TcarreteSin, escudoCarrete, Tcarrete, zEscC,
  };
}
export type DisenoAlambre = ReturnType<typeof disenarAlambre>;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 12) EL JUEZ: vuelve a calcular TODO desde las decisiones guardadas en el diseño
// ═════════════════════════════════════════════════════════════════════════════════════════════
export interface Hallazgo { nivel: 'error' | 'aviso' | 'info'; regla: string; texto: string }
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
const ejeTrasGiro = (eje: Eje, gi: Giro | null): Eje => {
  if (!gi || Math.abs(gi.grados) % 180 !== 90) return eje;
  const par: Record<Eje, [Eje, Eje]> = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] };
  const [a, b] = par[gi.eje]; return eje === a ? b : eje === b ? a : eje;
};
/** Caras de un perfil (u, v = z) que miran hacia abajo: pendiente respecto a la horizontal (1 = 45°). */
function carasAbajo(pts: [number, number][]) {
  let area = 0; for (let i = 0; i < pts.length; i++) { const [a, b] = pts[i], [c, e] = pts[(i + 1) % pts.length]; area += a * e - c * b; }
  const out: { v: number; pend: number; u0: number; u1: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [u0, v0] = pts[i], [u1, v1] = pts[(i + 1) % pts.length];
    const nv = area > 0 ? -(u1 - u0) : u1 - u0;           // componente vertical de la normal exterior (CCW: (dv, −du))
    if (nv < -1e-9) out.push({ v: Math.min(v0, v1), pend: Math.abs(v1 - v0) / Math.max(1e-9, Math.abs(u1 - u0)), u0, u1 });
  }
  return out;
}

export function juzgarAlambre(d: DisenoAlambre): Hallazgo[] {
  const H: Hallazgo[] = [];
  const S = d.S, req = d.req;
  const add = (nivel: Hallazgo['nivel'], regla: string, texto: string) => H.push({ nivel, regla, texto });
  const bA = bahia('ALAMBRE').caja, bL = bahia('LANZA').caja;
  const r = S.rodillo.D / 2;

  // A1 · bahías
  const bAriel: Caja = { ...bA, y1: bA.y1 + RIEL.profundidad + d.broche.y };   // el macho entra a la columna; el gancho del broche, a su muesca en z1
  for (const pz of d.impresas) { const c = cajaPieza(pz); if (![[c.x0, c.y0, c.z0], [c.x1, c.y1, c.z1]].every((p) => dentro(p as V3, bAriel, 0.01))) add('error', 'A1', `${pz.id} sale de la bahía ALAMBRE: [${f1(c.x0)},${f1(c.y0)},${f1(c.z0)}]–[${f1(c.x1)},${f1(c.y1)},${f1(c.z1)}]`); }
  for (const m of d.metales.filter((x) => x.id !== 'cableK06' && x.id !== 'alambre')) {
    const c = m.caja, ok = [[c.x0, c.y0, c.z0], [c.x1, c.y1, c.z1]].every((p) => dentro(p as V3, bA, 0.01) || dentro(p as V3, bL, 0.01));
    if (!ok) add('error', 'A1', `${m.id} sale de las bahías ALAMBRE/LANZA`);
  }
  const cajaCarrete: Caja = { x0: -S.carrete.ancho / 2, x1: S.carrete.ancho / 2, y0: d.ySp - d.rSp, y1: d.ySp + d.rSp, z0: d.zSp - d.rSp, z1: d.zSp + d.rSp };
  if (![[cajaCarrete.x0, cajaCarrete.y0, cajaCarrete.z0], [cajaCarrete.x1, cajaCarrete.y1, cajaCarrete.z1]].every((p) => dentro(p as V3, bA, 0.01))) add('error', 'A1', 'el carrete sale de la bahía ALAMBRE');
  const topePTFE = Math.max(...d.ptfeEntrada.map((p) => p[2])) + S.guia.ptfeOD / 2;
  if (topePTFE > bA.z1) add('error', 'A1', `el arco de PTFE llega a z = ${f1(topePTFE)} > ${bA.z1}`);
  // A1b · nada choca: el carrete (círculo), el tramo libre del alambre y los tirantes contra las piezas impresas
  const pzs = d.impresas.slice(0, 2), choca = (p: V3) => pzs.some((pz) => puntoEnPieza(p, pz));
  for (let i = 0; i < 72; i++) { const a = (2 * PI * i) / 72; for (const x of [0, -20, 20]) { const p: V3 = [x, d.ySp + d.rSp * Math.cos(a), d.zSp + d.rSp * Math.sin(a)]; if (choca(p)) { add('error', 'A1', `el carrete choca con una pieza en (${p.map(f1).join(', ')})`); i = 99; break; } } }
  for (const tg of d.tangentes) for (let k = 1; k < 20; k++) {
    const u = k / 20, p: V3 = [0, tg.T[0] + (d.yClip - tg.T[0]) * u, tg.T[1] + (d.zClip - tg.T[1]) * u];
    if (choca(p)) { add('error', 'A1', `el alambre libre (carrete → clip) atraviesa PETG en (${p.map(f1).join(', ')})`); break; }
  }
  if (d.tirantes) d.tirantes.anclas.forEach((A, i) => {
    const C = d.tirantes!.collar, e = unit(resta(A, C)), L = norma(resta(A, C));
    for (let s = S.tirante.collarOD / 2; s < L - 1; s += 2) { const p = suma(C, escala(e, s)); if (choca(p)) { add('error', 'A1', `el tirante ${i + 1} atraviesa PETG en (${p.map(f1).join(', ')}) antes de su ancla`); break; } }
    if (!choca(suma(A, escala(e, S.tirante.Lancla / 2)))) add('error', 'A1', `el tirante ${i + 1} no tiene PETG donde anclarse en (${A.map(f1).join(', ')})`);
    const dK = Math.min(...d.rutaK06.map((p) => { const w = resta(p, C), t = Math.max(0, Math.min(L, pprod(w, e))); return norma(resta(w, escala(e, t))); }));
    if (dK < S.termica.cableOD / 2 + S.tirante.D / 2 + 1) add('error', 'A1', `el tirante ${i + 1} pasa a ${f1(dK)} mm del eje de K06`);
    const dCar = Math.min(...Array.from({ length: 40 }, (_, k) => { const p = suma(C, escala(e, (L * k) / 39)); return Math.abs(p[0]) <= S.carrete.ancho / 2 + S.tirante.D / 2 + 1 ? Math.hypot(p[1] - d.ySp, p[2] - d.zSp) - d.rSp : Infinity; }));
    if (dCar < S.tirante.D / 2 + 1) add('error', 'A1', `el tirante ${i + 1} roza el carrete`);
  });
  // A2 · cada pieza cabe en la K1 en su orientación
  for (const pz of d.impresas) { const m = medidasImpresion(pz); if (!cabeEnLaCama(m[0], m[1], m[2])) add('error', 'A2', `${pz.id} no cabe en la K1: ${m.join(' × ')} mm`); }
  // A3 · voladizos: barrenos horizontales en gota, cilindros parados, fondos ≥ 45°, puentes ≤ 45 mm
  for (const pz of d.impresas) {
    const zBed = cajaPieza(pz).z0;
    for (const p of pz.prims) {
      if (p.f === 'cil' && ejeTrasGiro(p.eje, pz.giro) !== 'z' && p.r > 2.5) add('error', 'A3', `${pz.id}: ${p.nota ?? 'cilindro'} Ø${f1(2 * p.r)} acostado al imprimir (${p.op === '-' ? 'barreno sin gota' : 'voladizo'})`);
      if (p.f === 'cilDir' && !pz.giro && Math.abs(p.dir[2]) < Math.SQRT1_2 && p.r > 2.5) add('error', 'A3', `${pz.id}: ${p.nota ?? 'barreno'} inclinado a más de 45° y Ø${f1(2 * p.r)}`);
      if (!pz.giro && (p.f === 'prismaYZ' || p.f === 'prismaXZ') && p.op === '+')
        for (const c of carasAbajo(p.pts)) if (c.v > zBed + 0.01 && c.pend < 1 - 1e-6) add('error', 'A3', `${pz.id}: ${p.nota ?? 'perfil'} tiene una cara abajo a ${f1((Math.atan(c.pend) * 180) / PI)}° (< 45°) en z = ${f1(c.v)}`);
    }
    for (const b of pz.puentes) if (b.luz > 45) add('error', 'A3', `${pz.id}: puente de ${b.luz} mm (${b.donde}) > 45 mm`);
  }
  // A4 · riel macho con la holgura de dfm.ts (y dentro de la ventana de printinplace.ts)
  const gDfm = holguraDfm(PERFIL_K1), w = GAP.PETG;
  if (Math.abs(d.riel.g - gDfm) > 0.02) add('error', 'A4', `holgura del riel ${d.riel.g} ≠ la de dfm.ts para PETG (${gDfm})`);
  if (d.riel.g <= w.weld || d.riel.g >= w.play) add('error', 'A4', `holgura del riel ${d.riel.g} fuera de la ventana PETG (${w.weld}–${w.play}): ${d.riel.g <= w.weld ? 'se suelda' : 'baila'}`);
  const mr = rielMacho(d.riel.g);
  if (mr.bocaMacho >= RIEL.anchoBoca || mr.fondoMacho >= RIEL.anchoFondo) add('error', 'A4', 'el macho no entra en la hembra');
  // A5 · broches
  for (const [n, b] of [['broche del riel', d.broche], ['pestillo del NEMA', d.pestillo]] as const) {
    const e = epsBroche(b.y, b.h, b.L); if (e > S.petg.epsAdm) add('error', 'A5', `${n}: ε = ${(e * 100).toFixed(2)} % > ${(S.petg.epsAdm * 100).toFixed(1)} %`);
  }
  // A6 · par contra la fuerza de empuje (recalculada)
  const F = fuerzaEmpuje(d.geoGuia, S, req);
  const ev = evaluarTopologia(d.topologia, F.total, d.corriente.IrmsFeed * Math.SQRT2, S, req);
  if (ev.margen < req.margenPar) add('error', 'A6', `margen de par a ${req.vMax} m/min = ${f2(ev.margen)} < ${req.margenPar} (F = ${f2(F.total)} N, ${f2(ev.Tcarga)} N·m)`);
  // A7 · resolución
  const um = ((2 * PI * r) / (S.nema.pasosRev * d.micro * ev.N)) * 1e3;
  if (um > req.resolucionMax) add('error', 'A7', `${f1(um)} µm de alambre por micropaso > ${req.resolucionMax}`);
  // A8 · retracción tipo CMT y el colchón del carrete
  const evC = evaluarTopologia(d.topologia, F.total, d.corriente.IrmsCMT * Math.SQRT2, S, req);
  if (evC.fCMT <= 0) add('error', 'A8', 'no hay retracción ±1 mm posible');
  const col = colchonCarrete(d.geoGuia.thetaPTFE, PI * d.geoGuia.Rarco, evC.fCMT, req.cmtAmp, S);
  if (evC.fCMT > 0 && col.fn * req.bucleIsla > evC.fCMT) add('error', 'A8', `la retracción arrastra el carrete: colchón a ${f1(col.fn)} Hz contra ${f1(evC.fCMT)} Hz → ${f1(col.F)} N al alambre`);
  const capacidad = d.geoGuia.thetaPTFE * (S.guia.ptfeID - S.alambre.D);   // el alambre pasa de la pared de adentro a la de afuera del arco
  if (capacidad < 2 * req.cmtAmp * 1.5) add('error', 'A8', `el arco de PTFE guarda ${f2(capacidad)} mm < 1.5·(2·${req.cmtAmp}) mm de ida y vuelta`);
  // A9 · pandeo en el tramo sin guía
  const sec = seccionAlambre(S.alambre.D, S.alambre.pared, S.alambre.E, S.alambre.sigmaY);
  const Ll = d.zNip - d.zNariz, mP = eulerPcr(sec.EI, Ll) / F.total;
  if (mP < req.margenPandeo) add('error', 'A9', `pandeo: ${f1(Ll)} mm sin guía → P_cr/F = ${f2(mP)} < ${req.margenPandeo}`);
  // A10 · juego en la guía: el PTFE y el tramo de inox desnudo junto al portapuntas
  const jg = juegoGuia(F.total, (S.guia.ptfeID - S.alambre.D) / 2, d.geoGuia.Lptfe, sec);
  if (jg.delta > req.juegoMax) add('error', 'A10', `juego en la guía ${(jg.delta * 1e3).toFixed(0)} µm > ${req.juegoMax * 1e3} µm`);
  const jgI = juegoGuia(F.total, (d.lanza.cuello.Di - S.alambre.D) / 2, d.geoGuia.Linox, sec);
  if (jgI.delta > req.juegoMax) add('error', 'A10', `juego en el inox desnudo (${f1(d.geoGuia.Linox)} mm) ${(jgI.delta * 1e3).toFixed(0)} µm > ${req.juegoMax * 1e3} µm`);
  // A11 · térmica de la lanza (recalculada con la ruta real del cable). Caso de diseño: la pluma DIRECTA (S.campana.eta = 0, decisión
  //       del orquestador). El PETG del zócalo es el que abraza el inserto aislante (el cuello no toca PETG).
  const sC = sAntesDeTocar(d.rutaK06, pzs);
  const geo: GeoLanza = { ...d.lanza, cable: { ...d.lanza.cable, sContacto: sC, ruta: d.rutaK06 }, tirantes: d.tirantes };
  const lim = req.tPetgMax, T = S.termica, ins = d.inserto, esc = d.escudos.some((e) => e.nota.startsWith('bloque'));
  const zocDe = (tt: ReturnType<typeof termicaLanza>, caso: Caso, SS: Supuestos) => zocaloAislado(tt.TpetgCuello, tBloqueZocalo(d.zP, esc, caso, SS, ins.r), d.lanza.cuello.Do, ins, SS);
  const revisa = (tt: ReturnType<typeof termicaLanza>, z: ReturnType<typeof zocaloAislado>) => {
    const out: [string, string][] = [];
    if (z.Tint > lim) out.push(['zócalo', `el PETG que abraza el inserto (${ins.nombre} r ${ins.r}) llega a ${f1(z.Tint)} °C > ${lim} (cuello a ${f1(tt.TpetgCuello)} °C)`]);
    if (z.Tptfe > lim) out.push(['zócalo', `el PETG donde sale el PTFE del inserto llega a ${f1(z.Tptfe)} °C > ${lim}`]);
    if (tt.TpetgCuello > ins.Tmax) out.push(['inserto', `el cuello a ${f1(tt.TpetgCuello)} °C pasa del ${ins.nombre} (${ins.Tmax})`]);
    for (const j of d.juntas) {
      const al = S.juntas[j.tipo]; if (!al) continue;
      const Tj = [j.a, j.b].includes('portapuntas') ? tt.Tporta : [j.a, j.b].includes('collar') && d.tirantes ? tt.Tcuello(d.tirantes.collar[2] - d.lanza.zPortaTop) : null;
      if (Tj !== null && Tj > al.Tmax) out.push(['junta', `la junta ${j.a}–${j.b} (${al.nombre}) a ${f1(Tj)} °C > ${al.Tmax}`]);
    }
    if (tt.Tsilicona > T.TsiliconaMax) out.push(['silicona', `la silicona del cable empieza a ${f1(tt.Tsilicona)} °C > ${T.TsiliconaMax}`]);
    if (tt.TptfeBajo > T.TptfeMax) out.push(['ptfe', `el PTFE baja hasta donde el cuello está a ${f1(tt.TptfeBajo)} °C > ${T.TptfeMax}`]);
    if (tt.TcableContacto > lim) out.push(['cable', `el cable OUT− toca PETG a ${f1(sC)} mm del portapuntas, a ${f1(tt.TcableContacto)} °C > ${lim}`]);
    tt.Tanclas.forEach((Ta, i) => { if (Ta > lim) out.push(['ancla', `el tirante ${i + 1} llega a su ancla de PETG a ${f1(Ta)} °C > ${lim}`]); });
    return out;
  };
  const t = termicaLanza(geo, S, 'conCampana'), zt = zocDe(t, 'conCampana', S);
  for (const [, txt] of revisa(t, zt)) add('error', 'A11', txt);
  for (const [n, v] of [['el PETG del zócalo', zt.Tint], ['el PETG donde sale el PTFE', zt.Tptfe], ...t.Tanclas.map((x, i) => [`el ancla del tirante ${i + 1}`, x])] as [string, number][])
    if (v <= lim && v > lim - req.margenT) add('aviso', 'A11', `${n} queda a ${f1(v)} °C (margen < ${req.margenT} K)`);
  const tf = termicaLanza(geo, S, 'sinCampana'), malF = revisa(tf, zocDe(tf, 'sinCampana', S));
  if (malF.length) add('error', 'A11', `sin campana (pluma vertical): ${malF.map((x) => x[1]).join(' · ')}`);
  // A22 · K14: el KSD301 existe, su tapa toca el inserto (el PETG más caliente del zócalo), no corta trabajando con la pluma directa y
  //       corta antes de que ese PETG llegue a su límite de falla (tPetgFalla). Lee R = T del PETG que abraza el inserto.
  const k14 = CONEXIONES.find((c) => c.id === 'K14'), K = d.termostato;
  if (k14) {
    const asiento = d.impresas[1].prims.find((q) => q.op === '-' && q.nota?.startsWith('asiento del KSD301'));
    const canal = d.impresas[1].prims.filter((q) => q.op === '-' && q.nota?.startsWith('canal K14'));
    const tol = S.termostato.tol;
    if (!K || K.T === null) add('error', 'A22', `K14 está en el contrato y no hay un KSD301 de la serie que no corte trabajando (lee ${f1(zt.Tint)} °C) y corte antes de ${req.tPetgFalla} °C`);
    else if (!asiento || asiento.f !== 'gota') add('error', 'A22', 'K14 está en el contrato y el empuje no tiene el asiento del KSD301');
    else if (asiento.eje !== 'y' || Math.abs(asiento.c[1] - ins.r) > 0.05 || Math.abs(asiento.c[0]) > 0.05 || asiento.c[2] - S.termostato.capD / 2 < ins.z0 || asiento.c[2] + S.termostato.capD / 2 > ins.z1)
      add('error', 'A22', `la tapa del KSD301 no toca el inserto (cara en y ${f1(asiento.c[1])}, inserto r ${ins.r}, z ${f1(ins.z0)}…${f1(ins.z1)}): leería aire, no el PETG del zócalo`);
    else if (canal.length < 2) add('error', 'A22', 'los hilos de K14 no tienen canal del asiento a la canaleta de señal');
    else if (K.T - tol < zt.Tint + req.margenT) add('error', 'A22', `trabajando con la pluma directa el KSD301 lee ${f1(zt.Tint)} °C: el de ${K.T} °C (±${tol}) puede cortar sin falla`);
    else if (K.T + tol > req.tPetgFalla) add('error', 'A22', `el KSD301 de ${K.T} °C (±${tol}) puede no cortar hasta ${K.T + tol} °C > ${req.tPetgFalla} (Tg del PETG − 5)`);
    else add('info', 'A22', `K14: KSD301 de ${K.T} °C (±${tol}) con la tapa contra el inserto · lee ${f1(zt.Tint)} °C trabajando con la pluma directa (no corta antes de ${K.T - tol}) · corta a ≤ ${K.T + tol} °C, antes de ${req.tPetgFalla} · respaldo: enfriamiento, mesa desbocada, más corriente`);
  }
  const tm = tempMotor(d.corriente.IrmsCMT, S.nema);
  if (tm.T > lim) add('error', 'A11', `la carcasa del NEMA a ${f1(tm.T)} °C toca PETG (> ${lim})`);
  if (d.corriente.IrmsCMT > S.driver.IrmsMax + 1e-9) add('error', 'A11', `${d.corriente.IrmsCMT} A rms > tope del TMC2209 de C (${S.driver.IrmsMax})`);
  // A12 · las caras de abajo: pluma (peor caso) + radiación del arco y de la mesa a 300 °C (con los escudos del diseño)
  const caras = tCarasPetg(pzs, d.riel.g, d.escudos, S);
  const peor = caras.reduce((a, c) => (c.T > a.T ? c : a), caras[0]);
  const donde = `${peor.pieza} (${peor.nota}${peor.esc ? ', con escudo' : ''}) en (${peor.p.map(f1).join(', ')}), F a la mesa ${f2(peor.F)}`;
  if (peor.T > lim) add('error', 'A12', `el arco y la mesa calientan el PETG a ${f1(peor.T)} °C: ${donde}`);
  else if (peor.T > lim - req.margenT) add('aviso', 'A12', `el PETG queda a ${f1(peor.T)} °C: ${donde}`);
  if (d.escudos.some((e) => e.nota.startsWith('bloque')) && d.escudoAgujero / 2 - d.inserto.r < req.holguraEscudo) add('error', 'A12', `el agujero del escudo (Ø${d.escudoAgujero}) deja < ${req.holguraEscudo} mm al inserto`);
  const Tsp = tempCarrete(d.ySp, d.zSp, d.rSp, d.escudoCarrete, S);
  if (Tsp > S.carrete.Tmax) add('error', 'A12', `el plástico del carrete llega a ${f1(Tsp)} °C > ${S.carrete.Tmax}${d.escudoCarrete ? '' : ' (sin escudo)'}`);
  // A13 · eléctrico: la única entrada de corriente al alambre es la punta; nada metálico hace camino paralelo
  const porId = new Map(d.metales.map((m) => [m.id, m]));
  const vec = new Map<string, Set<string>>();
  for (const m of d.metales) for (const o of m.toca) { (vec.get(m.id) ?? vec.set(m.id, new Set()).get(m.id)!).add(o); (vec.get(o) ?? vec.set(o, new Set()).get(o)!).add(m.id); }
  const comp = new Set<string>(['alambre']), cola = ['alambre'];
  while (cola.length) { const u = cola.pop()!; for (const v of vec.get(u) ?? []) if (!comp.has(v)) { comp.add(v); cola.push(v); } }
  const conRed = [...comp].map((id) => porId.get(id)).filter((m): m is Metal => !!m && !!m.red);
  if (REGLAS.unicaEntradaDeCorriente !== 'punta') add('error', 'A13', 'el contrato cambió la regla de la entrada de corriente');
  if (conRed.length !== 1 || conRed[0].red !== 'OUT−') add('error', 'A13', `camino paralelo: el alambre se une por metal a ${conRed.map((m) => `${m.id}→${m.red}`).join(', ') || 'nada'} (debe ser SÓLO OUT− por la punta)`);
  else {
    const k = conRed[0], ancla = [...(vec.get(k.id) ?? [])];
    if (!(ancla.length === 1 && ancla[0] === 'portapuntas' && (vec.get('portapuntas') ?? new Set()).has('punta'))) add('error', 'A13', `OUT− entra por ${ancla.join(', ')}: debe entrar sólo al portapuntas de la punta`);
  }
  for (const id of comp) for (const o of d.metales) {
    if (comp.has(o.id) || !o.red || o.red === 'OUT−') continue;
    const m = porId.get(id); if (!m) continue;
    const dd = distMetales(m, o);
    if (dd < req.holguraCreepage) add('error', 'A13', `${id} (a OUT−) queda a ${f2(dd)} mm de ${o.id} (${o.red}) < ${req.holguraCreepage} mm`);
  }
  // A14 · la loca: agarre sin aplastar; resorte de acero porque la flexión impresa relaja
  const pr = presionLoca(F.total, S);
  if (d.loca.N < pr.Nmin) add('error', 'A14', `la loca aprieta ${f1(d.loca.N)} N < ${f1(pr.Nmin)} N: patina`);
  if (d.loca.N > pr.Nmax) add('error', 'A14', `la loca aprieta ${f1(d.loca.N)} N > ${f1(pr.Nmax)} N: aplasta el tubular`);
  const rs = d.loca.resorte, Fres = rs.k * (rs.L0 - rs.instalado);
  if (rs.instalado < rs.solido) add('error', 'A14', `el resorte instalado mide ${rs.instalado} mm < su altura sólida ${rs.solido} mm`);
  if (Math.abs(Fres - d.loca.N) > 0.15 * d.loca.N) add('error', 'A14', `el resorte da ${f1(Fres)} N, no los ${d.loca.N} N del diseño`);
  const dr = decisionResorte(pr.Nmin, pr.Nmax, S, tempMotor(d.corriente.IrmsCMT, S.nema).T);
  if (!dr.flexionImpresaOk && d.loca.decision.eleccion !== 'resorte de acero') add('error', 'A14', `flexión impresa: tras 1000 h queda en ${f1(dr.NfinFlex)} N < ${f1(pr.Nmin)} N`);
  // A15 · AS5600 y la tapa del imán (D5: 625-ZZ, la tapa se pega al aro exterior y no pasa del Ø16: a 0.8 mm está el rodillo)
  const as = as5600(d.loca.D, d.loca.gapIman, S, req);
  if (!as.gapOk) add('error', 'A15', `entrehierro del imán ${d.loca.gapIman} mm fuera de ${S.as5600.entrehierroMin}–${S.as5600.entrehierroMax}`);
  const tp = d.loca.tapa;
  if (tp.r > S.loca.D / 2 - 0.2) add('error', 'A15', `la tapa del imán (r ${f1(tp.r)}) pasa del aro exterior del 625 (r ${S.loca.D / 2}): choca con el rodillo`);
  if (tp.r <= S.loca.aroInt + 0.5 || tp.rHueco >= S.loca.aroInt) add('error', 'A15', `la tapa no tiene cara del aro exterior donde pegarse (pega de r ${f1(tp.rHueco)} a ${f1(tp.r)}; el aro va de ${S.loca.aroInt} a ${S.loca.D / 2})`);
  // A16 · el cuello de lado contra la retracción: f_n ≥ 2·f_CMT (la raíz en PETG, la masa del cable que cuelga, el apoyo intermedio)
  const cu = cuelloLateral(d.lanza.cuello.Do, d.lanza.cuello.Di, d.lanza.cuello.Lexpuesto, d.cuello.Le, masaPunta(d.lanza.Dporta, d.lanza.cuello.Do, 20, S), S.cable.fraccionLibre * masaLinealCable(S) * sC, S, d.inserto.E);
  const lat = d.tirantes ? lateralConTirantes(cu, d.tirantes, d.inserto.z0, d.lanza.cuello.Do, d.lanza.cuello.Di, S) : cu;
  const fObj = req.fnCuelloK * evC.fCMT;
  if (lat.f < fObj) add('error', 'A16', `el cuello vibra de lado a ${f1(lat.f)} Hz < ${req.fnCuelloK}·f_CMT = ${f1(fObj)} Hz (raíz en el inserto ${f1(d.cuello.Le)} mm${d.tirantes ? ', con tirantes' : ', sin apoyo intermedio'})`);
  // A17 · puertos del contrato (el pasamuros en la pieza que TIENE pared ahí) y separación potencia/señal
  for (const id of ['A.POT', 'A.SEN']) {
    const pp = puerto(id).pos, pz = d.impresas.find((p) => p.prims.some((q) => q.nota?.includes(`pasamuros ${id}`)));
    const h = pz?.prims.find((q) => q.nota?.includes(`pasamuros ${id}`));
    if (!pz || !h || h.f !== 'gota' || Math.abs(h.c[0] - pp[0]) > 0.5 || Math.abs(h.c[2] - pp[2]) > 0.5) add('error', 'A17', `el pasamuros de ${id} no está en el puerto del contrato (${pp.join(', ')})`);
    else if (!puntoEnPieza([pp[0], 146, pp[2]], pz)) add('error', 'A17', `el pasamuros de ${id} está en ${pz.id}, que no tiene pared en z = ${pp[2]}`);
  }
  const as56 = porId.get('as5600');
  if (as56) {
    const dK = Math.min(...d.rutaK06.map((p) => distCajas({ x0: p[0], x1: p[0], y0: p[1], y1: p[1], z0: p[2], z1: p[2] }, as56.caja)));
    if (dK < REGLAS.separacionPotenciaSenalMm) add('error', 'A17', `K06 pasa a ${f1(dK)} mm del AS5600 (< ${REGLAS.separacionPotenciaSenalMm})`);
  }
  const k06 = CONEXIONES.find((c) => c.id === 'K06');
  if (k06 && k06.awg !== 8) add('aviso', 'A17', `K06 cambió a ${k06.awg} AWG: rehacer la aleta del cable`);
  // la señal (K08 + K14) a ≥ 15 mm de K06 y de K07 (de orilla a orilla; K07 sólo se junta en el pasamuros A.SEN)
  const sep = REGLAS.separacionPotenciaSenalMm, rSen = 2.5, pSEN: V3 = [puerto('A.SEN').pos[0], 146, puerto('A.SEN').pos[2]];
  for (const [n, r] of [['K08', d.rutaSenal], ['K14', d.rutaK14]] as [string, V3[]][]) {
    const d06 = distRutas(r, d.rutaK06) - S.termica.cableOD / 2 - rSen;
    if (d06 < sep) add('error', 'A17', `${n} pasa a ${f1(d06)} mm de K06 (< ${sep})`);
    const d07 = distRutas(r, d.rutaK07, [pSEN], 25) - 2 * rSen;
    if (d07 < sep) add('error', 'A17', `${n} pasa a ${f1(d07)} mm de K07 lejos del pasamuros (< ${sep})`);
  }
  const areaCon = (id: string) => { const c = CONEXIONES.find((x) => x.id === id); return c ? c.hilos.length * (PI / 4) * (S.hilo[c.awg] ?? 2) ** 2 : 0; };
  for (const c of d.canales) {
    const ll = c.cables.reduce((a, id) => a + areaCon(id), 0) / c.seccion;
    if (ll > REGLAS.llenadoMax + 1e-9) add('error', 'A17', `${c.id} (${c.cables.join('+')}) llena ${(ll * 100).toFixed(0)} % > ${REGLAS.llenadoMax * 100} %`);
  }
  const finK = d.rutaK06[d.rutaK06.length - 1], antes = d.rutaK06[d.rutaK06.length - 2], ap = puerto('A.POT');
  if (norma(resta(finK, ap.pos)) > 0.5 || pprod(unit(resta(finK, antes)), ap.dir) < 0.99) add('error', 'A17', `K06 no llega al puerto A.POT (${ap.pos.join(', ')}) saliendo derecho por su normal`);
  // A18 · radio de doblez del cable de potencia (REGLAS.dobladoMinK · OD)
  const Rmin = REGLAS.dobladoMinK * S.termica.cableOD, radios = radiosRuta(d.rutaK06), rMin = Math.min(...radios);
  if (rMin < Rmin - 0.5) add('error', 'A18', `K06 dobla con radio ${f1(rMin)} mm < ${REGLAS.dobladoMinK}·OD = ${f1(Rmin)} mm`);
  // A19 · la CAMPANA de B: nada de A en su caja ni abajo de su tapa (z ${f1(24)})
  const camp = bahia('CAMPANA').caja;
  const cajasA: [string, Caja][] = [...d.impresas.map((pz): [string, Caja] => [pz.id, cajaPieza(pz)]), ...d.metales.filter((m) => m.id !== 'alambre').map((m): [string, Caja] => [m.id, m.caja]), ['carrete', cajaCarrete]];
  if (d.escudoCarrete) cajasA.push(['escudo del carrete', { x0: -28, x1: S.carrete.ancho / 2 + 5, y0: d.ySp - d.rSp - S.escudo.gap, y1: d.ySp + d.rSp, z0: d.zEscC - S.escudo.espesor, z1: d.zEscC }]);
  for (const es of d.escudos) {
    const q = d.impresas.find((p) => p.id === es.pieza)?.prims.find((p) => p.nota === es.nota && p.op === '+');
    if (q) { const c = cajaPrim(q), b = S.escudo.gap + S.escudo.espesor; cajasA.push([`escudo bajo «${es.nota}»`, { ...c, y0: c.y0 - b, z0: c.z0 - b }]); }
  }
  for (const [id, c] of cajasA) {
    const huella = c.x1 > camp.x0 && c.x0 < camp.x1 && c.y1 > camp.y0 && c.y0 < camp.y1;
    if (traslape(c, camp) > 0 || (huella && c.z0 < camp.z1)) add('error', 'A19', `${id} baja a z ${f1(c.z0)} sobre la campana de B (nada de A abajo de z ${camp.z1} en x ${camp.x0}…${camp.x1}, y ${camp.y0}…${camp.y1})`);
  }
  // A20 · REGLAS.todoImprimible: lo que el juez cuenta (los escudos) tiene su ranura impresa en su pieza
  if (REGLAS.todoImprimible) {
    for (const es of d.escudos) {
      const pz = d.impresas.find((p) => p.id === es.pieza), n = pz?.prims.filter((q) => q.op === '-' && q.nota === `ranura escudo «${es.nota}»`).length ?? 0;
      if (n < 2) add('error', 'A20', `el escudo bajo «${es.nota}» (${es.pieza}) no tiene sus ranuras impresas (${n} < 2): sería un número, no una pieza`);
    }
    if (d.escudoCarrete && !d.impresas[0].prims.some((q) => q.op === '-' && q.nota === 'ranura escudo del carrete')) add('error', 'A20', 'el escudo del carrete no tiene de dónde colgarse en el pie');
  }
  // A21 · D4: las juntas (Silfos no va en inox ni acero; donde hay latón, fundente)
  const matDe = (id: string) => porId.get(id)?.mat ?? '?';
  for (const j of d.juntas) {
    const al = S.juntas[j.tipo];
    if (!al) continue;
    for (const id of [j.a, j.b]) if (al.noVaEn.includes(matDe(id))) add('error', 'A21', `${al.nombre} en ${id} (${matDe(id)}): el fósforo hace fosfuros frágiles con el níquel y el hierro`);
    if ([j.a, j.b].some((id) => matDe(id) === 'laton') && !j.fundente) add('error', 'A21', `la junta ${j.a}–${j.b} lleva latón y va sin fundente (D4)`);
  }
  if (!d.juntas.some((j) => j.tipo === 'Silfos' && [j.a, j.b].includes('cableK06') && [j.a, j.b].includes('portapuntas'))) add('error', 'A21', 'OUT− no está unido al portapuntas con Silfos (D4)');
  // info: los números que importan
  add('info', 'N', `topología ${d.topologia}: margen ${f2(ev.margen)} a ${req.vMax} m/min · ${f1(um)} µm/micropaso · retracción tipo CMT ±${req.cmtAmp} mm: ${f1(evC.fCMT)} Hz · cuello de lado ${f1(lat.f)} Hz · pluma directa: PETG ≤ ${f1(Math.max(zt.Tint, zt.Tptfe, peor.T))} °C (zócalo aislado: cuello a ${f1(t.TpetgCuello)} °C, PETG del inserto a ${f1(zt.Tint)} °C)`);
  return H;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 13) PARA VERLO EN LA FORJA
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const URL_ALAMBRE = '/modelos/laboratorio/alambre/';
export function piezasAlambre(d: DisenoAlambre = disenarAlambre()): PiezaLab[] {
  const S = d.S, nm = S.nema, zN = d.zNip, L = d.lanza, cu = d.cuello;
  const impresas: PiezaLab[] = d.impresas.map((pz) => ({
    id: `alambre-${pz.id}`, name: pz.nombre, kind: 'malla', url: `${URL_ALAMBRE}${pz.id}.bin`, x: 0, y: 0, z: 0, color: pz.color, mat: 'filamento',
  }));
  const tLleno = d.tangentes[0];
  const alambre: V3[] = [[0, tLleno.T[0], tLleno.T[1]], ...d.ptfeEntrada, [0, 0, zN], [0, 0, L.zPunta], [0, 0, 2]];
  const carrete: [number, number][] = [[8, -22.5], [50, -22.5], [50, -20.5], [S.carrete.rLleno, -20.5], [S.carrete.rLleno, 20.5], [50, 20.5], [50, 22.5], [8, 22.5]];
  const tp = d.loca.tapa;
  const compradas: PiezaLab[] = [
    { id: 'alambre-nema', name: `NEMA 17HS4401 (${nm.Th} N·m, ${nm.V} V)`, kind: 'caja', w: nm.lado, d: nm.largo, h: nm.lado, rad: 2, x: d.xRod, y: d.yCara + nm.largo / 2, z: zN, color: '#2b2f36', mat: 'pintura' },
    { id: 'alambre-nema-resalte', name: 'resalte Ø22 y eje Ø5 (D)', kind: 'cilindro', r: nm.resalte / 2, h: nm.resalteAlto, x: d.xRod, y: d.yCara - nm.resalteAlto / 2, z: zN, rx: 90, color: '#9aa3ad', mat: 'aluminio' },
    { id: 'alambre-eje', name: 'eje del NEMA', kind: 'cilindro', r: nm.eje / 2, h: nm.ejeLargo, x: d.xRod, y: d.yCara - nm.ejeLargo / 2, z: zN, rx: 90, color: '#c9ced4', mat: 'acero' },
    { id: 'alambre-rodillo', name: 'rodillo moleteado SOMI Ø30×10 (buje de latón 7×5 estañado)', kind: 'cilindro', r: S.rodillo.D / 2, h: S.rodillo.ancho, lados: 24, x: d.xRod, y: 0, z: zN, rx: 90, color: '#8d939a', mat: 'acero' },
    { id: 'alambre-loca', name: `rueda loca: balero ${S.loca.tipo}`, kind: 'cilindro', r: S.loca.D / 2, h: S.loca.ancho, x: d.xLoca, y: 0, z: zN, rx: 90, color: '#c9ced4', mat: 'cromo' },
    { id: 'alambre-iman', name: 'imán diametral Ø6×2.5 (en la tapa pegada al aro)', kind: 'cilindro', r: 3, h: S.loca.imanH, x: d.xLoca, y: tp.y0 + S.loca.imanH / 2, z: zN, rx: 90, color: '#5a5f66', mat: 'acero' },
    { id: 'alambre-as5600', name: `AS5600 (modo analógico, entrehierro ${d.loca.gapIman} mm)`, kind: 'caja', w: 14, d: 1.6, h: 15, x: d.xLoca, y: tp.y0 - d.loca.gapIman - 0.8, z: zN, color: '#1f6b3a', mat: 'pcb' },
    { id: 'alambre-resorte', name: `resorte de acero ${d.loca.resorte.k} N/mm (precarga ${f1(d.loca.N)} N)`, kind: 'cilindro', r: d.loca.resorte.De / 2, h: 32.5 - 22 - 0.5, x: -27, y: 0, z: zN, ry: 90, color: '#b9bec4', mat: 'acero' },
    { id: 'alambre-carrete', name: 'carrete 1 kg E71T-GS 0.8 (D100 × 45)', kind: 'torno', perfil: carrete, x: 0, y: d.ySp, z: d.zSp, ry: 90, color: '#3a3f46', mat: 'plastico' },
    { id: 'alambre-punta', name: 'punta de contacto M6×25 0.8 (cobre)', kind: 'torno', perfil: [[0.5, 0], [3, 0], [4, 2], [4, L.Lpunta], [0.5, L.Lpunta]], x: 0, y: 0, z: L.zPunta, color: COBRE, mat: 'cobre' },
    { id: 'alambre-portapuntas', name: `portapuntas de latón Ø${cu.Dporta} (OUT− con Silfos y fundente; el cuello con plata 45 %)`, kind: 'cilindro', r: cu.Dporta / 2, h: L.zPortaTop - L.zPortaBase, x: 0, y: 0, z: (L.zPortaBase + L.zPortaTop) / 2, color: '#c9a640', mat: 'laton' },
    { id: 'alambre-cuello', name: `cuello ${d.cuelloMat.nombre} ${cu.Do}×${cu.Di} (guía recta, ${f1(d.lateral.f)} Hz de lado)`, kind: 'cilindro', r: cu.Do / 2, h: cu.zTop - (L.zPortaTop - 8), x: 0, y: 0, z: (cu.zTop + L.zPortaTop - 8) / 2, color: '#b5bcc4', mat: 'acero' },
    { id: 'alambre-ptfe-entrada', name: `PTFE 4×2 de entrada (arco R${f1(d.Rarco)}: también es el colchón de la retracción)`, kind: 'tubo', r: S.guia.ptfeOD / 2, path: d.ptfeEntrada, x: 0, y: 0, z: 0, color: '#f2f2ee', mat: 'plastico', opacity: 0.85 },
    { id: 'alambre-ptfe', name: 'PTFE 4×2 (dentro del cuello)', kind: 'tubo', r: S.guia.ptfeOD / 2, path: [[0, 0, d.zPTFEbajo], [0, 0, (d.zPTFEbajo + d.zPTFEtop) / 2], [0, 0, d.zPTFEtop]], x: 0, y: 0, z: 0, color: '#f2f2ee', mat: 'plastico', opacity: 0.85 },
    { id: 'alambre-alambre', name: 'alambre E71T-GS 0.8 (a OUT−)', kind: 'tubo', r: S.alambre.D / 2, path: alambre, x: 0, y: 0, z: 0, color: '#9aa0a6', mat: 'acero' },
    { id: 'alambre-k06', name: `K06 OUT− 8 AWG (${f1(d.Ldesnudo)} mm desnudo, luego silicona; R ≥ ${f1(REGLAS.dobladoMinK * S.termica.cableOD)})`, kind: 'tubo', r: S.termica.cableOD / 2, path: d.rutaK06, x: 0, y: 0, z: 0, color: '#1c1c1c', mat: 'goma' },
  ];
  const K = d.termostato, ts = S.termostato;
  compradas.push(
    { id: 'alambre-ksd301', name: `termostato ${ts.clase} NC ${K.T ?? '?'} °C (K14): su tapa toca el inserto, a presión en su asiento`, kind: 'cilindro', r: ts.capD / 2, h: ts.largo, x: 0, y: K.yCara + ts.largo / 2, z: K.zK, rx: 90, color: '#9aa3ad', mat: 'aluminio' },
    { id: 'alambre-inserto', name: `inserto de ${d.inserto.nombre} Ø${2 * d.inserto.r} × ${f1(d.inserto.z1 - d.inserto.z0)}: el cuello no toca PETG`, kind: 'cilindro', r: d.inserto.r, h: d.inserto.z1 - d.inserto.z0, x: 0, y: 0, z: (d.inserto.z0 + d.inserto.z1) / 2, color: '#e9e4d8', mat: 'ceramica' },
    { id: 'alambre-k14', name: 'K14 · T1/T2 24 AWG (con K08, lejos de K06 y K07)', kind: 'tubo', r: 0.7, path: d.rutaK14, x: 0, y: 0, z: 0, color: '#d6b13a', mat: 'goma' },
    { id: 'alambre-senal', name: 'K08 + K14 por la canaleta de señal hasta A.SEN', kind: 'tubo', r: 1.2, path: d.rutaSenal, x: 0, y: 0, z: 0, color: '#2f7fd6', mat: 'goma' },
    { id: 'alambre-k07', name: 'K07 (NEMA) por su canaleta hasta A.SEN', kind: 'tubo', r: 1.4, path: d.rutaK07, x: 0, y: 0, z: 0, color: '#c0392b', mat: 'goma' });
  if (d.tirantes) {
    const t = d.tirantes, tr = S.tirante;
    compradas.push({ id: 'alambre-collar', name: `collarín de latón Ø${tr.collarOD}×${tr.collarL} (desliza en el cuello)`, kind: 'cilindro', r: tr.collarOD / 2, h: tr.collarL, x: 0, y: 0, z: t.collar[2], color: '#c9a640', mat: 'laton' });
    t.anclas.forEach((A, i) => compradas.push({ id: `alambre-tirante-${i + 1}`, name: `tirante ${i + 1}: varilla de inox Ø${tr.D} (plata 45 % al collarín, a presión en el bloque)`, kind: 'tubo', r: tr.D / 2, path: [t.collar, suma(A, escala(unit(resta(A, t.collar)), tr.Lancla))], x: 0, y: 0, z: 0, color: '#b5bcc4', mat: 'acero' }));
  }
  const e = S.escudo, escudos: PiezaLab[] = [];
  for (const es of d.escudos) {
    const pz = d.impresas.find((x) => x.id === es.pieza), q = pz?.prims.find((x) => x.nota === es.nota && x.op === '+');
    if (!q) continue;
    if (q.f === 'prismaYZ') {
      for (const [u0, v0, u1, v1, ny, nz] of aristasAbajoYZ(q.pts)) {
        const Lc = Math.hypot(u1 - u0, v1 - v0);
        escudos.push({ id: `alambre-escudo-${pz!.id}-${escudos.length}`, name: `escudo de aluminio ${e.espesor} mm (hueco ${e.gap} mm, pestañas en ranuras impresas) · ${es.nota}`, kind: 'caja',
          w: q.x1 - q.x0, d: Lc, h: e.espesor, x: (q.x0 + q.x1) / 2, y: (u0 + u1) / 2 + ny * e.gap, z: (v0 + v1) / 2 + nz * e.gap,
          rx: (Math.atan2(v1 - v0, u1 - u0) * 180) / PI, color: '#d9dde2', mat: 'aluminio' });
      }
    } else {
      const c = cajaPrim(q);
      escudos.push({ id: `alambre-escudo-${pz!.id}-${escudos.length}`, name: `escudo de aluminio ${e.espesor} mm (pestañas en ranuras impresas) · ${es.nota}`, kind: 'caja',
        w: c.x1 - c.x0, d: c.y1 - c.y0, h: e.espesor, x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2, z: c.z0 - e.gap, color: '#d9dde2', mat: 'aluminio' });
    }
  }
  if (d.escudoCarrete) {
    const x0 = -28, x1 = S.carrete.ancho / 2 + 5;
    escudos.push(
      { id: 'alambre-escudo-carrete-abajo', name: 'escudo en L del carrete (abajo; su orilla −x entra en la ranura del pie)', kind: 'caja', w: x1 - x0, d: 2 * d.rSp, h: e.espesor, x: (x0 + x1) / 2, y: d.ySp, z: d.zEscC, color: '#d9dde2', mat: 'aluminio' },
      { id: 'alambre-escudo-carrete-frente', name: 'escudo en L del carrete (frente)', kind: 'caja', w: x1 - x0, d: e.espesor, h: d.rSp + 10, x: (x0 + x1) / 2, y: d.ySp - d.rSp - e.gap, z: d.zSp - d.rSp / 2 - 5, color: '#d9dde2', mat: 'aluminio' });
  }
  return [...impresas, ...compradas, ...escudos];
}

/** Lista de piezas (impresas y compradas) y tornillos, para el reporte. */
export function listaAlambre(d: DisenoAlambre = disenarAlambre()) {
  const S = d.S, cu = d.cuello;
  return {
    impresas: d.impresas.map((p) => ({ id: p.id, nombre: p.nombre, medidas: medidasImpresion(p), cabe: cabeEnLaCama(...medidasImpresion(p)) })),
    compradas: ['NEMA 17HS4401', 'rodillo moleteado SOMI Ø30×10×7', 'buje de latón 7×5 × 10 (estañado al eje y al rodillo)', `balero ${S.loca.tipo}`,
      'imán diametral Ø6×2.5 (epóxico en la tapa, la tapa con epóxico al aro)', 'AS5600 en placa chica', `resorte de compresión ${d.loca.resorte.De}×${d.loca.resorte.L0}, ${d.loca.resorte.k} N/mm`,
      `PTFE 4×2 × ${Math.round(d.zPTFEtop - d.zPTFEbajo + 2)} mm (guía) + ${Math.round(largoRuta(d.ptfeEntrada) + 2)} mm (entrada en arco)`, `tubo ${d.cuelloMat.nombre} ${cu.Do}×${cu.Di} × ${Math.round(cu.zTop - (d.lanza.zPortaTop - 8))} mm`,
      ...(d.tirantes ? [`collarín de latón Ø${S.tirante.collarOD}×${S.tirante.collarL} (barreno ${cu.Do} H7)`, `2 varillas de inox Ø${S.tirante.D} × ${d.tirantes.anclas.map((A) => Math.round(norma(resta(A, d.tirantes!.collar)) + S.tirante.Lancla - S.tirante.collarOD / 2)).join(' y ')} mm`] : []),
      ...(d.escudoCarrete ? ['escudo en L de aluminio bajo y frente al carrete (cuelga de la ranura del pie)'] : []),
      ...d.escudos.map((es) => `escudo de aluminio ${S.escudo.espesor} mm bajo «${es.nota}» (${es.pieza}), sus pestañas entran en ranuras impresas`),
      `termostato ${S.termostato.clase} NC ${d.termostato.T ?? '?'} °C ±${S.termostato.tol} (K14), hilos soldados a sus terminales`,
      `inserto de ${d.inserto.nombre} Ø${2 * d.inserto.r} × ${f1(d.inserto.z1 - d.inserto.z0)} mm con barreno Ø${cu.Do} (Ø4.2 en sus ${S.inserto.tapa} mm de arriba), a presión en el bloque`,
      `portapuntas 15AK de latón Ø${cu.Dporta} × 20 con dos barrenos: Ø${cu.Do} × 8 arriba para el cuello y Ø3.4 de lado para OUT− (SUPUESTO; o torneado)`, 'punta de contacto M6×25 0.8', `cable 8 AWG silicona (K06), ${Math.round(largoRuta(d.rutaK06))} mm dentro del módulo`, 'carrete 1 kg E71T-GS 0.8',
      `${S.juntas.Silfos.nombre} + fundente`, `${S.juntas.BAg.nombre}`],
    tornillos: 0,
  };
}
