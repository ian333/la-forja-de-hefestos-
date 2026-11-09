/**
 * EL CUERPO DEL LABORATORIO (orden 2026-11-05-lab-cuerpo · ronda 2: 2026-11-06-lab-cuerpo-r2 · agente B)
 * ====================================================================================================
 * La figura impresa que es ESTRUCTURA y CABLEADO a la vez. Puro (sin OCCT): todo sale de aquí y el script
 * `scripts/laboratorio/cuerpo-solidos.cjs` sólo convierte las operaciones (cajas, prismas, codos) en sólidos.
 *
 *   disenarCuerpo()  → la mesa disipadora, los canales ruteados (A*), las tejas, las piezas sueltas (tapas, broches,
 *                      tapa de la columna, difusor, campana), las uniones, el aire, el humo, la estructura
 *   juzgarCuerpo(d)  → hallazgos {nivel, regla, texto}: el revisor del cableado sobre CANALES reales
 *   piezasCuerpo(d)  → PiezaLab[] para verlo en La Forja
 *
 * La frontera es `laboratorio-contrato.ts` (no se edita; ronda 2). Una conexión sin ruta es un ERROR del juez con su
 * porqué, nunca una excepción. Lo que el contrato no deja hacer se diseña con lo que hay y queda en PEDIDOS
 * («CAMBIO DE CONTRATO PEDIDO», con números); el juez marca esos hallazgos con nivel 'contrato'.
 *
 * Marco: mm del doc, Z arriba, origen = centro de la cara de arriba de la placa de trabajo. Internamente SI donde
 * hay física (W, m, K, Pa); las fórmulas llevan su nombre y su fuente.
 */
import {
  BAHIAS, PUERTOS, CONEXIONES, REGLAS, IMPRESORA, MATERIAL, RIEL, CONTRATO_RONDA, DECISIONES, bahia, puerto, cabeEnLaCama,
  type V3, type Caja, type Conexion, type Funcion, type PiezaLab, type Puerto,
} from './laboratorio-contrato';
import { clearance, PRINT_PROFILES, type PrintProfile } from '../mech/dfm';
import { notchKt, filletRadiusForKt } from '../mech/contacto-conforme';

// ════════════════════════════════════════════════════════════════════════════════════════════
// 0. MATERIALES, AIRE Y SUPUESTOS (todo lo que no está medido se declara aquí)
// ════════════════════════════════════════════════════════════════════════════════════════════
const SIGMA = 5.670e-8;
export const AIRE = { rho: 1.16, cp: 1007, k: 0.027, nu: 1.6e-5, mu: 1.85e-5, Pr: 0.71 };
/** PETG impreso. tensión y factor entre capas de gearbox.ts (45 MPa · 0.55); cortante de supports.ts (26 MPa). */
export const PETG = {
  E: 2000, tension: 45, capaZ: 0.55, cortante: 26, k: 0.2, rho: 1270, eps: 0.9,
  epsAdm: 0.015,                  // SUPUESTO: deformación admisible de un broche que se arma varias veces (1.5 %)
  tUso: MATERIAL.tUsoMaxC,        // 70 °C (contrato)
};
/** Silicato de calcio en placa (tipo Promasil-950/Skamol). k(T) en W/mK con T en °C. */
export const SILICATO = { k: (T: number) => 0.065 + 6e-5 * T, flexion: 1.0, compresion: 2.5, rho: 250, eps: 0.9 };
export const ACERO = { k: 45, rho: 7850, cp: 490, eps: 0.8 };
export const ALUMINIO = { k: 167, rho: 2700, cp: 900, eps: 0.1 };   // 6061 sin anodizar (ε baja: radia poco al PETG)
export const COBRE = { k: 390, rho: 8960, cp: 385 };

export interface Supuesto { id: string; valor: string; fuente: string; medir: string }
/** la ronda del contrato contra la que se diseñó (R2) */
export const RONDA = CONTRATO_RONDA;
const dec = (id: string) => DECISIONES.find((x) => x.id === id)?.decision ?? '';
export const SUPUESTOS: Supuesto[] = [
  { id: 'PETG', valor: 'PETG; E 2000 MPa; 45 MPa × 0.55 entre capas; ε_adm broche 1.5 %', fuente: `contrato D1 (${dec('D1').slice(0, 30)}…) + gearbox.ts`, medir: 'confirmar el filamento; doblar 3 broches de prueba hasta que blanqueen' },
  { id: 'P_ARCO', valor: '640 W de arco; 88 % a la placa por conducción → 563 W', fuente: 'orquestador 2026-11-05; 08: 464 W netos a 40 A, 744 W a 60 A', medir: 'E2: V·I del arco y la rampa de la placa con el NTC' },
  { id: 'T_SET', valor: 'temperatura entre capas pedida 150–300 °C', fuente: 'orquestador', medir: 'E8: dureza/porosidad contra T entre capas' },
  { id: 'T_AMB', valor: 'taller 30 °C; adentro de la caja 40 °C', fuente: 'plumaSistema TERMICO.Ta', medir: 'termómetro' },
  { id: 'H_CONTACTO', valor: 'acero–aluminio en seco con mordazas: 1500 W/m²K', fuente: 'orden de magnitud (contacto metálico a baja presión)', medir: 'ΔT entre la placa y el bloque con dos NTC' },
  { id: 'SILICATO', valor: 'placa de 25 mm clase 1000 °C: k = 0.065 + 6e-5·T W/mK (≈ 0.07); flexión 1.0 MPa; compresión 2.5 MPa. Postes, tiras y la silla de K05 se cortan de esa placa', fuente: 'contrato D1 + hojas de silicato de calcio', medir: 'la hoja del que compre ian' },
  { id: 'VENT_MESA', valor: 'ventilador 80×80×38 12 V 0.55 A: 0.030 m³/s libre, 115 Pa máx (curva lineal)', fuente: 'contrato D6 (clase Delta AFB0812)', medir: 'anemómetro en la rejilla de salida' },
  { id: 'ARCO_RAD', valor: 'arco 40 A × 21 V; 15 % radiado isótropo desde el punto del arco (z 1); α del PETG 0.9; h 15 W/m²K por fuera', fuente: 'los mismos números de A (alambre.ts SUPUESTOS.arco)', medir: 'termopar en la boca de la campana con el arco prendido' },
  { id: 'ESCUDO', valor: 'lámina de aluminio de 1 mm: α 0.15 con hollín, ε 0.1', fuente: 'el mismo escudo de A (alambre.ts SUPUESTOS.escudo)', medir: 'termopar en la lámina' },
  { id: 'PESTANA', valor: 'la boca de la campana cuenta como «boca con pestaña» (factor 0.75 de Dalla Valle): abajo la cubierta es banco; arriba y a los lados la lámina de la embocadura', fuente: 'REGLAS.capturaHumoMin (Dalla Valle, boca con pestaña)', medir: 'anemómetro de hilo caliente en el punto del arco con el extractor prendido' },
  { id: 'MANGUERA', valor: 'manguera corrugada Ø100 de 3 m a la calle con 2 codos suaves: f 0.03, K 0.3 por codo, salida 1.0', fuente: 'ronda 1 (10: ≥150 m³/h con ducto)', medir: 'el largo real de la instalación' },
  { id: 'H_CABLE', valor: 'K05 en el aire de la campana: h = placa plana laminar (Nu = 0.664·Re^½·Pr^⅓ sobre el tramo) + radiación linealizada (ε 0.9)', fuente: 'Incropera 7.30 + radiación', medir: 'termopar en K05 a la entrada de su canal (≤ 70 °C)' },
  { id: 'MANGA', valor: 'manga de fibra de vidrio sobre K05 donde el cobre pasa de 180 °C (la silicona aguanta 200 °C)', fuente: 'hoja del cable de silicona', medir: '—' },
  { id: 'TERMOSTATO', valor: 'termostato NC 70 °C PLANO (clase KSD9700, ≈ 21 × 10 × 5) acostado en el piso del ducto; abre a 70 ± 5 °C', fuente: 'catálogo; el KSD301 de pie (Ø15.7 × 8 + patas de 10) no cabe en los 7 mm entre el piso y las aletas', medir: 'el que compre ian (que sea de 70 °C NC)' },
  { id: 'VENT_PCB', valor: 'ventilador 80×80×25 12 V ~0.25 A de alta velocidad: 0.022 m³/s (79 m³/h, ≈ 47 CFM) libre, 55 Pa (5.6 mmH₂O) máx, curva lineal; ≈ 38–42 dB(A) contra ≈ 30–33 del de 0.15 A', fuente: 'decisión del orquestador (R2) + catálogo de clase (Delta AFB0812H / Sunon de alta velocidad, 80×25)', medir: 'anemómetro en la rejilla de entrada de C; la hoja del que compre ian (que diga ≥ 45 CFM y ≥ 5 mmH₂O)' },
  { id: 'VENT_LRS', valor: 'los 2 ventiladores de 40 mm de la LRS: 0.0047 m³/s, 30 Pa máx; soplan hacia +x (hacia afuera de su extremo)', fuente: 'supuesto; el STEP sólo da su lugar', medir: 'una tira de papel en el extremo de la LRS encendida' },
  { id: 'EXTRACTOR', valor: 'en línea Ø100: 0.055 m³/s libre (200 m³/h), 250 Pa máx; 3 m de manguera a la calle', fuente: '10: ≥150 m³/h con ducto', medir: 'el modelo que compre ian' },
  { id: 'MASA_A', valor: 'módulo del alambre 1.5 kg a 190 mm de la columna', fuente: 'orden', medir: 'pesarlo armado con carrete lleno' },
  { id: 'MASA_LRS', valor: 'LRS 2.0 kg', fuente: 'orden', medir: 'báscula' },
  { id: 'MANO', valor: 'carga de mano sobre la mesa 50 N; factor dinámico 2', fuente: 'criterio', medir: '—' },
  { id: 'OD_CAL8', valor: 'cal 8 de silicona Ø 6.8 mm (doblez 41 mm); cal 10 Ø 4.3; 16 Ø 2.4; 22 Ø 1.4; 24 Ø 1.2; 26 Ø 1.0', fuente: 'plumaSistema CALIBRES + orden (cal 8 ≈ 6.5–7)', medir: 'vernier sobre el cable comprado' },
  { id: 'PIEZA', valor: 'huella de la pieza impresa: cubo de 20 mm (radio equivalente 11.3 mm)', fuente: '08 §4.9', medir: '—' },
  { id: 'IMPRESION', valor: 'K1 con PETG: 8 mm³/s promedio (con viajes)', fuente: 'gcode-k1.ts maxFlow 32 mm³/s / 4', medir: 'el tiempo real del primer laminado' },
];

/** Perfil de la K1 con PETG para dfm.ts (la holgura de las colas de milano sale de ahí). */
export const PERFIL_K1: PrintProfile = { ...PRINT_PROFILES.ender3, bedX: IMPRESORA.cama[0], bedY: IMPRESORA.cama[1], bedZ: IMPRESORA.cama[2], margin: IMPRESORA.margen, material: 'PETG' };

// ════════════════════════════════════════════════════════════════════════════════════════════
// 1. GEOMETRÍA DEL CUERPO (lo que el ruteo y los sólidos comparten)
// ════════════════════════════════════════════════════════════════════════════════════════════
export const PARED = 4;                       // pared exterior impresa
export const Z_PISO = -121;                   // cara de arriba del piso (contrato: piso z −125…−121)
export const Z_CUB = { z0: -20, z1: -12 };    // cubierta (contrato: deck z −20…−12)
export const BASE = bahia('BASE').caja, COL = bahia('COLUMNA').caja, PLACA = bahia('PLACA').caja;
export const CAMP = bahia('CAMPANA').caja, DIF = bahia('DIFUSOR').caja;
/** interior de la base: entre paredes, del piso a la cara de abajo de la cubierta */
export const INTERIOR: Caja = { x0: BASE.x0 + PARED, y0: BASE.y0 + PARED, z0: Z_PISO, x1: BASE.x1 - PARED, y1: BASE.y1 - PARED, z1: Z_CUB.z0 };
/** la columna: baja hasta z −75 (pie que entra en la base, sobre la LRS que acaba en −78). R2: 80 de fondo, el pie apoya
 *  completo en la base (y1 230 de los dos). */
export const COL_PIE_Z = -75;
export const COLUMNA: Caja = { ...COL, z0: COL_PIE_Z };
/**
 * EL CAMINO DEL HUMO (R2, P5): boca baja detrás de la placa → campana (bahía CAMPANA) → garganta en la cara del frente de
 * la columna (y 150) → paso por el pie de la columna → collar Ø100 atrás (y 230) → manguera a la calle.
 * Sin codos: el collar va a la altura de la boca (z 10), no a z ≈ 300 como en la ronda 1. Con los dos codos de 90° de
 * la columna (Idelchik) la captura no llega a 0.5 m/s con este extractor; `humo().alterna` lo calcula para comparar.
 *   · embocadura (comprada/cortada): lámina de Al de 1 mm doblada en U (techo + dos lados), y 96…118. Su techo y su lado
 *     derecho se abren al frente en bocina (radios `labio` y 6) hasta la cara de la bahía; el lado izquierdo sólo de z 0
 *     para arriba: abajo pasa K05. La cara de la bahía es la boca (x ±44, z −12…23); detrás, la garganta x −44…38, z −12…15.
 *   · cuerpo (PETG impreso): y 118…150, sin piso (el piso es la cubierta). Es un DIFUSOR suave: el techo sube de z 15 a 22
 *     y el lado derecho se abre de x 38 a 43 en 32 mm (2θ ≈ 12°), así la garganta recupera presión en vez de perderla.
 *   · paso del pie (se imprime de pie en la columna 1): garganta en la cara del frente (x ±43, z −12…22) → se angosta a
 *     x −35…23 mientras el techo sube a 45° → pentágono de 58, paredes a z 44, pico a 73 (cabe en la gota del collar,
 *     centrada en x −6). Corrido 6 mm a −x: el tubo de K05 sube en x −30, a 21 mm de K06 (REGLAS.lazoArco).
 */
export const HUMO = {
  boca: { x0: -44, x1: 44, z0: CAMP.z0, z1: CAMP.z1 - 1 },
  labio: 8,
  embocadura: { y0: CAMP.y0, y1: CAMP.y0 + 22, t: 1, gx0: -44, gx1: 44 - 6, gz1: CAMP.z1 - 1 - 8 },
  cuerpo: { x0: CAMP.x0 + 2, x1: CAMP.x1 - 2, y0: CAMP.y0 + 22, y1: CAMP.y1, z0: CAMP.z0, z1: CAMP.z1 - 2 },
  garganta: { x0: CAMP.x0 + 2, x1: CAMP.x1 - 2, y0: COL.y0 - 1, y1: COL.y0 + 15, z0: CAMP.z0, z1: CAMP.z1 - 2 },
  paso: { x0: -35, x1: 23, y0: COL.y0 + 15, y1: COL.y1, z0: -20, z1: 44, pico: 73 },
  collar: { x: -6, z: 10, r: 50, rInt: 46, largo: 25 },
};
/** el collar (el extractor se mete por fuera): mismo nombre que en la ronda 1 */
export const COLLAR = HUMO.collar;
/** postes que sostienen la cubierta en la franja libre entre la placa de C (y ≤ 48) y la LRS (y ≥ 60), lejos de los
 *  puertos de C (x −100, −40, −20, 40) para que los canales salgan derecho */
export const POSTES_CUB = [-70, 10, 70];
/** las espigas de la junta de la columna, en la pared del frente a los lados del riel */
export const ESPIGAS: Caja[] = [{ x0: -33, x1: -23, y0: 151, y1: 159, z0: 0, z1: 0 }, { x0: 23, x1: 33, y0: 151, y1: 159, z0: 0, z1: 0 }];

// LA LRS LEÍDA DEL STEP (sonda OCCT en iangpu, 2026-11-05; scripts/laboratorio/cuerpo-solidos.cjs la repite):
// STEP: x largo (−2…228, bornes en x≈0), y alto (0…41, base en y=0), z ancho (−62…62). Acostada con la bornera a −x,
// la ÚNICA rotación propia es (x, y, z) → (x − 108, 122 − z, y − 121) (rx = +90°). Resultado medido:
//   · bornera de AC (sólido de 31.7 mm, 3 bornes L/N/FG) → y 64.6…96.3, z −114…−99  (ADELANTE)
//   · bornes de DC (2 sólidos de 15 mm con tornillo grande) → y 134.5…167.7, z −118…−97 (ATRÁS)
//   · 2 ventiladores de 40 mm en el extremo +x: x 95…115, y 67…107 y 136…177, z −121…−81
export const LRS_STEP = { origen: [-108, 122, -121] as V3, rx: 90 };
export const BORNE_AC: V3 = [-110, 80, -105];
export const BORNE_DC: V3 = [-110, 150, -105];
export const LRS_VENT = [{ y0: 67, y1: 107 }, { y0: 136, y1: 177 }];
/** el IEC adentro de su bahía (R2: en la pared nueva, y 190…230): cuerpo de 28 × 45 que entra 34 mm desde la pared de
 *  atrás; sus patas miran a −y en y 190 (el puerto del contrato) */
export const IEC_CUERPO: Caja = { x0: -144, x1: -116, y0: 192, y1: BASE.y1 - PARED, z0: -95, z1: -50 };

// ── LA MESA (disipador controlado) ───────────────────────────────────────────────────────────
// placa de acero 150×150×6 SOBRE un bloque de aluminio 160×160 con aletas abajo; el aire entra por la pared
// derecha (ventilador de la mesa), cruza las aletas a lo largo de −x y sale por la pared izquierda arriba del
// ventilador de C. El marco de cobre (+) va EMBUTIDO en una ranura de la cara de arriba del bloque.
export const MESA_G = {
  placa: { x0: -75, x1: 75, y0: -75, y1: 75, z0: -6, z1: 0 },
  bloque: { x0: -80, x1: 80, y0: -80, y1: 80, zBase0: -12, zBase1: -6 },
  piso: { z0: -24, z1: -22 },          // piso del ducto (PETG + cinta de aluminio), justo arriba de PLACA_PCB (z −24)
  lado: 92,                            // paredes del ducto en y = ±92 (12 mm de aire que corre a cada lado del bloque)
  ducto: { x0: -146, x1: 108 },        // de la salida (pared izquierda) a la bajada del ventilador
  subida: { x0: 88, x1: 108, y0: -58, y1: 52, z0: -104 },   // del ventilador sube al nivel de la mesa (110 × 20; PLACA_PCB acaba en x 85)
  vent: { x0: 108, x1: 146, y0: -49, y1: 31, z0: -104, z1: -24 },
  postes: { d: 8, alto: 8, n: 4, xy: [[-60, -76], [60, -76], [-60, 76], [60, 76]] as [number, number][] },   // silicato Ø8 × 8 bajo el borde del bloque, sobre repisas de la charola
  tira: { ancho: 12, t: 6 },           // tira de silicato que tapa el hueco lateral (apoya SÓLO en el PETG)
  ntc: [78, -69, -12] as V3,           // NTC 100 k de vidrio en un barreno Ø2 × 5 vertical en la cara de abajo del bloque (sobre C.MESA)
  // termostato NC 70 °C (MESA.TERM, contrato R2 con P9: (45, −60, −22) +x, plano clase KSD9700), acostado en el piso del
  // ducto con la lata ABAJO (mide el piso, que es lo que protege); sus hilos salen por la cara +x, que cae en el puerto.
  // Su asiento (dos rieles y un tope) es parte de la charola derecha.
  termostato: { x: puerto('MESA.TERM').pos[0] - 21 / 2, y: puerto('MESA.TERM').pos[1], largo: 21, ancho: 10, alto: 5, abre: 70, tol: 5 },
};
/** caja caliente: el bloque y su placa ± 12 mm (ningún canal de PETG entra, salvo K05 y la cola del NTC) */
export const ZONA_CALIENTE: Caja = { x0: -92, x1: 92, y0: -92, y1: 92, z0: -24, z1: 0 };

// ════════════════════════════════════════════════════════════════════════════════════════════
// 2. LA MESA: modelo 1D de conducción + convección con la potencia del arco
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface Ventilador { nombre: string; Qmax: number; Pmax: number; V: number; I: number; espesor: number }
export const VENT_MESA: Ventilador = { nombre: '80×80×38 12 V', Qmax: 0.030, Pmax: 115, V: 12, I: 0.55, espesor: 38 };
/** R2 (orquestador): el de 0.15 A daba 26 m³/h y C pide ≥ 27.6 (su disipador ≤ 90 − 5 con Q1 a 39 W): uno de alta velocidad */
export const VENT_PCB: Ventilador = { nombre: '80×80×25 12 V 0.25 A (alta velocidad)', Qmax: 0.022, Pmax: 55, V: 12, I: 0.25, espesor: 25 };
/** el de la ronda 1, para comparar */
export const VENT_PCB_R1: Ventilador = { nombre: '80×80×25 12 V 0.15 A', Qmax: 0.0167, Pmax: 30, V: 12, I: 0.15, espesor: 25 };
/** lo que pide C para su disipador (placa.ts R2: 86.6 °C con 26 m³/h en el peor caso; termostato 90 ± 5) y la meta con margen */
export const AIRE_C = { pide_m3h: 27.6, meta_m3h: 32, fuente: 'agente C (placa.ts R2) y orquestador' };
export const VENT_LRS: Ventilador = { nombre: '2 × 40 mm (LRS)', Qmax: 0.0047, Pmax: 30, V: 12, I: 0, espesor: 20 };
export const EXTRACTOR: Ventilador = { nombre: 'en línea Ø100', Qmax: 0.055, Pmax: 250, V: 230, I: 0.3, espesor: 0 };
/** curva lineal con leyes de afinidad: Q ∝ N, P ∝ N² */
export const presionVent = (v: Ventilador, Q: number, N = 1) => Math.max(0, v.Pmax * N * N * (1 - Q / (v.Qmax * N)));
/** pérdida de una rejilla de lámina perforada (Idelchik): K sobre la velocidad de aproximación (área bruta) */
export const kRejilla = (phi: number) => ((0.707 * Math.sqrt(1 - phi) + 1 - phi) ** 2) / (phi * phi);
const din = (Q: number, A: number) => 0.5 * AIRE.rho * (Q / A) ** 2;
/** punto de operación: bisección en Q de P_vent(Q) = ΔP_sistema(Q) */
export function puntoOperacion(v: Ventilador, sistema: (Q: number) => number, N = 1): { Q: number; dP: number } {
  let a = 0, b = v.Qmax * N;
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (presionVent(v, m, N) > sistema(m)) a = m; else b = m; }
  return { Q: a, dP: sistema(a) };
}
/** Nusselt y fricción de un canal (Hausen laminar en desarrollo entre placas / Gnielinski + Petukhov turbulento) */
export function canalAire(v: number, Dh: number, L: number) {
  const Re = (v * Dh) / AIRE.nu;
  if (Re < 2300) {
    const gz = (Dh / L) * Re * AIRE.Pr;
    return { Re, Nu: 7.54 + (0.03 * gz) / (1 + 0.016 * gz ** (2 / 3)), f: 96 / Math.max(1, Re) };
  }
  const f = (0.79 * Math.log(Re) - 1.64) ** -2;
  const Nu = ((f / 8) * (Re - 1000) * AIRE.Pr) / (1 + 12.7 * Math.sqrt(f / 8) * (AIRE.Pr ** (2 / 3) - 1));
  return { Re, Nu, f };
}

export interface Aletas { alto: number; paso: number; t: number }
export interface EstadoMesa {
  N: number; Q: number; dP: number; G: number; mcp: number; Gf: number; mcpF: number;
  T: number; Tex: number; Tfin: number; Qtop: number; Qpostes: number; Qsum: number;
}
const L_MESA = 0.160;           // largo de las aletas en la dirección del aire (m)
const CAMPO_Y = 0.144;          // ancho del campo de aletas (m)
const ALTO_DUCTO = 0.010;       // del piso (−22) a la cara de abajo del bloque (−12)

/** pérdida de carga del aire de la mesa (rejillas, subida, ducto, salida) */
export function sistemaMesa(Q: number, al: Aletas) {
  const nAl = al.alto > 0 ? Math.floor((CAMPO_Y * 1000) / al.paso) : 0;
  const Aducto = 0.160 * ALTO_DUCTO + 2 * 0.012 * 0.014 - nAl * (al.t / 1000) * (al.alto / 1000);
  const Ph = 2 * (0.160 + ALTO_DUCTO) + nAl * 2 * (al.alto / 1000);
  const Dh = (4 * Aducto) / Ph, v = Q / Aducto;
  const { f } = canalAire(v, Dh, L_MESA);
  const sub = (MESA_G.subida.y1 - MESA_G.subida.y0) * (MESA_G.subida.x1 - MESA_G.subida.x0) * 1e-6;
  return (
    kRejilla(0.6) * din(Q, 0.080 * 0.080) +          // rejilla de entrada (pared derecha, 80 × 80)
    2 * 1.1 * din(Q, sub) +                          // la subida: 2 codos de 90°
    0.5 * din(Q, Aducto) + f * (L_MESA / Dh) * din(Q, Aducto) + 1.0 * din(Q, Aducto) +   // entra, aletas, sale
    1.1 * din(Q, 0.008 * 0.160) +                    // cámara izquierda: 8 mm de alto bajo su techo
    kRejilla(0.6) * din(Q, (0.040 + 0.008) * 0.156)  // salida: ranuras en la piel de la cubierta (40 × 156) + pared izquierda (8 × 156)
  );
}
/** conductancia aire–bloque con caudal Q (dos corrientes: entre aletas y el resto del ducto, a velocidad común) */
export function conductanciaMesa(Q: number, al: Aletas) {
  const nAl = al.alto > 0 ? Math.floor((CAMPO_Y * 1000) / al.paso) : 0;
  const H = al.alto / 1000, t = al.t / 1000, g = (al.paso - al.t) / 1000;
  const Aal = nAl * g * H;                                           // sección entre aletas
  const Atot = 0.160 * ALTO_DUCTO + 2 * 0.012 * 0.014 - nAl * t * H;
  const v = Q / Atot, mcp = AIRE.rho * AIRE.cp * Q;
  let Gf = 0, mcpF = 0;
  if (nAl > 0) {
    const Dh = (2 * g * H) / (g + H), { Nu } = canalAire(v, Dh, L_MESA), h = (Nu * AIRE.k) / Dh;
    const m = Math.sqrt((2 * h) / (ALUMINIO.k * t)), eta = Math.tanh(m * H) / (m * H);
    const hA = h * (nAl * 2 * H * L_MESA * eta + nAl * g * L_MESA);
    mcpF = mcp * (Aal / Atot);
    Gf = mcpF * (1 - Math.exp(-hA / mcpF));
  }
  // el resto: la cara de abajo (puntas de aletas o el bloque liso) y los dos costados del bloque
  const Hres = ALTO_DUCTO - H, DhR = 2 * Hres, { Nu: NuR } = canalAire(v, DhR, L_MESA), hR = (NuR * AIRE.k) / DhR;
  const { Nu: NuS } = canalAire(v, 2 * 0.012, L_MESA), hS = (NuS * AIRE.k) / (2 * 0.012);
  const hAres = hR * (nAl > 0 ? nAl * t * L_MESA : CAMPO_Y * L_MESA) + hS * 2 * 0.014 * L_MESA;
  const mcpR = mcp - mcpF;
  const Gr = mcpR * (1 - Math.exp(-hAres / mcpR));
  return { G: Gf + Gr, Gf, mcpF, mcp };
}
const P_MESA_W = 0.88 * 640;
export const MESA_TERMICA = {
  P: P_MESA_W, Tin: 30, Tcaja: 40, TexMax: 65,
  /** pérdida por arriba (placa expuesta menos la huella de la pieza): convección natural cara caliente arriba + radiación */
  Qtop: (T: number) => {
    const A = 0.150 * 0.150 - 0.020 * 0.020, dT = Math.max(0, T - 30);
    return A * (1.52 * dT ** (1 / 3) * dT + ACERO.eps * SIGMA * ((T + 273.15) ** 4 - 303.15 ** 4));
  },
};
/** resistencia de UN poste de silicato (K/W) y la de su base: arandela de aluminio 30×30 en la corriente de aire */
export const rPoste = (T: number) => (MESA_G.postes.alto / 1000) / (SILICATO.k((T + 60) / 2) * Math.PI * (MESA_G.postes.d / 2000) ** 2);
export const R_BASE_POSTE = 1 / (15 * 0.020 * 0.040);   // arandela de Al 20×40 en el aire lateral (h 15)
/** estado estable de la mesa con ciclo de arco d y ventilador al N (0–1) */
export function estadoMesa(d: number, N: number, al: Aletas): EstadoMesa {
  const op = puntoOperacion(VENT_MESA, (Q) => sistemaMesa(Q, al), N);
  const c = conductanciaMesa(Math.max(op.Q, 1e-5), al);
  const P = d * MESA_TERMICA.P, Tin = MESA_TERMICA.Tin;
  const Rp = (T: number) => rPoste(T) + R_BASE_POSTE;
  const balance = (T: number) => MESA_TERMICA.Qtop(T) + c.G * (T - Tin) + MESA_G.postes.n * (T - MESA_TERMICA.Tcaja) / Rp(T) - P;
  let a = Tin, b = 1500;
  for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (balance(m) < 0) a = m; else b = m; }
  const T = a, Qsum = c.G * (T - Tin);
  return {
    N, Q: op.Q, dP: op.dP, G: c.G, mcp: c.mcp, Gf: c.Gf, mcpF: c.mcpF, T,
    Tex: Tin + Qsum / c.mcp, Tfin: c.mcpF > 0 ? Tin + (c.Gf / c.mcpF) * (T - Tin) : Tin,
    Qtop: MESA_TERMICA.Qtop(T), Qpostes: MESA_G.postes.n * (T - MESA_TERMICA.Tcaja) / Rp(T), Qsum,
  };
}
/** el N mínimo que deja el escape ≤ TexMax con arco continuo (Infinity si ni a tope) */
export function nMinimoSeguro(al: Aletas): number {
  let a = 0.15, b = 1;
  if (estadoMesa(1, b, al).Tex > MESA_TERMICA.TexMax) return Infinity;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (estadoMesa(1, m, al).Tex > MESA_TERMICA.TexMax) a = m; else b = m; }
  return b;
}
export interface PuntoControl { Tset: number; N: number; d: number; Tex: number; ok: boolean; modo: 'ventilador' | 'ciclo' | 'imposible' }
export const T_SETS = [150, 175, 200, 225, 250, 275, 300];
/**
 * El mapa de control: para cada temperatura pedida, el ventilador (N) y el ciclo de arco (d) que la sostienen.
 *   · si la mesa a arco continuo y ventilador a tope queda MÁS FRÍA que lo pedido → arco continuo, se baja el ventilador
 *     (modo 'ventilador'); el escape se calienta al bajar el caudal: vale si queda ≤ TexMax.
 *   · si queda más caliente → ventilador a tope y se baja el ciclo de arco: la espera por capa (modo 'ciclo').
 * Con N = 1 el escape vale T_in + (G/ṁcp)·(T − T_in): no depende de d. El PETG fija ε = G/ṁcp ≤ 35/(T − 30).
 */
export function mapaControl(al: Aletas, Ts = T_SETS): PuntoControl[] {
  const lo = estadoMesa(1, 1, al).T, hiT = estadoMesa(1, 0.2, al).T;
  return Ts.map((Tset): PuntoControl => {
    if (Tset <= lo) {
      let a = 0, b = 1;
      for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (estadoMesa(m, 1, al).T > Tset) b = m; else a = m; }
      const e = estadoMesa(a, 1, al);
      return { Tset, N: 1, d: a, Tex: e.Tex, ok: e.Tex <= MESA_TERMICA.TexMax, modo: 'ciclo' };
    }
    if (Tset > hiT) return { Tset, N: 0.2, d: 1, Tex: NaN, ok: false, modo: 'imposible' };
    let a = 0.2, b = 1;
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (estadoMesa(1, m, al).T > Tset) a = m; else b = m; }
    const e = estadoMesa(1, b, al);
    return { Tset, N: b, d: 1, Tex: e.Tex, ok: e.Tex <= MESA_TERMICA.TexMax, modo: 'ventilador' };
  });
}
/** PETG de la charola en el punto de 300 °C: el piso bajo las aletas y la repisa bajo cada poste */
export function petgCharola(e: EstadoMesa, al: Aletas) {
  const piso = pisoDucto(e, al), poste = (e.T - MESA_TERMICA.Tcaja) / (rPoste(e.T) + R_BASE_POSTE);
  return { piso, Tpiso: piso.Tmax, Tposte: piso.TaSale + poste * R_BASE_POSTE, Wposte: poste };
}
/** el diseño de aletas: barrido; gana el que sostiene 150–300 °C con el PETG a salvo (escape, piso y postes ≤ 70 °C)
 *  y con el MAYOR ciclo de arco a 150 °C (el disipador más fuerte que todavía deja llegar a 300) */
export function elegirAletas() {
  const cands: Aletas[] = [];
  for (const alto of [0, 3, 5, 8]) for (const paso of alto ? [5, 8, 12, 16, 24] : [0]) cands.push({ alto, paso, t: 1.5 });
  const filas = cands.map((al) => {
    const control = mapaControl(al), e1 = estadoMesa(1, 1, al), p300 = control[control.length - 1];
    const ch = petgCharola(estadoMesa(p300.d, p300.N, al), al);
    const petgOk = ch.Tpiso <= PETG.tUso && ch.Tposte <= PETG.tUso;
    return { al, Tlo: e1.T, ok: control.filter((q) => q.ok).length + (petgOk ? 1 : 0), d150: control[0].ok ? control[0].d : 0, Q: e1.Q, eps: e1.G / e1.mcp, Tpiso: ch.Tpiso, Tposte: ch.Tposte, control };
  });
  const elegida = [...filas].sort((a, b) => (b.ok - a.ok) || (b.d150 - a.d150))[0];
  return { filas, elegida };
}
/** sobre-temperatura bajo la pieza (2D que el 1D no ve): cono a 45° en el acero + abanico lateral en acero y aluminio */
export function esparcimiento(aMm = 11.3) {
  const a = aMm / 1000, t = 0.006;
  const Rcono = t / (ACERO.k * Math.PI * a * (a + t));
  const kt = ACERO.k * 0.006 + ALUMINIO.k * 0.006;
  const Rlat = Math.log(0.085 / (a + t)) / (2 * Math.PI * kt);
  return { Rcono, Rlat, R: Rcono + Rlat };
}
/** el suelo del ducto bajo el bloque: marcha a lo largo del aire con convección + radiación (cinta de Al ε 0.05) */
export function pisoDucto(e: EstadoMesa, al: Aletas, nSec = 16) {
  const epsEff = 1 / (1 / ALUMINIO.eps + 1 / 0.05 - 1);
  const Hres = ALTO_DUCTO - al.alto / 1000, Dh = 2 * Hres;
  const Atot = 0.160 * ALTO_DUCTO + 2 * 0.012 * 0.014;
  const { Nu } = canalAire(e.Q / Atot, Dh, L_MESA), h = (Nu * AIRE.k) / Dh;
  const Rback = 0.002 / PETG.k + 1 / 10;               // PETG 2 mm + convección natural hacia PLACA_PCB (40 °C)
  const mcpR = e.mcp - e.mcpF;                         // la corriente que lava el piso
  let Ta = MESA_TERMICA.Tin, Tmax = 0;
  const W = CAMPO_Y, dx = L_MESA / nSec;
  const perfil: { x: number; Tp: number; Ta: number }[] = [];   // el aire entra en x = +80 y corre hacia −x
  for (let i = 0; i < nSec; i++) {
    let lo = Ta, hi = e.T, Tp = Ta;
    for (let k = 0; k < 60; k++) {
      Tp = (lo + hi) / 2;
      const qin = h * (Ta - Tp) + epsEff * SIGMA * ((e.T + 273.15) ** 4 - (Tp + 273.15) ** 4);
      if (qin > (Tp - MESA_TERMICA.Tcaja) / Rback) lo = Tp; else hi = Tp;
    }
    Tmax = Math.max(Tmax, Tp);
    perfil.push({ x: 80 - (i + 0.5) * dx * 1000, Tp, Ta });
    const qTecho = h * (e.T - Ta) * W * dx, qPiso = h * (Ta - Tp) * W * dx;
    Ta += (qTecho - qPiso) / Math.max(1e-6, mcpR);
  }
  return { Tmax, h, TaSale: Ta, perfil };
}
/**
 * EL TERMOSTATO DE LA MESA (MESA.TERM): lata abajo sobre el piso del ducto → lee la temperatura del piso.
 *   · normal (punto de 300 °C, ventilador andando): el piso en su x por la marcha de `pisoDucto` (el aire entra frío en
 *     x = 80; el termostato está a 20 mm de la entrada). No puede abrir: T ≤ abre − tolerancia.
 *   · ventilador muerto (aire quieto): el piso recibe radiación del bloque (F al rectángulo 160 × 160 a 10 mm, ε del Al
 *     con la cinta) + conducción por la capa de aire de 7 mm, y la pierde por atrás (PETG 2 mm + 10 W/m²K a 40 °C).
 *     Se busca el bloque al que el piso del termostato llega a 70 °C (abre) y, con ese bloque, el piso del centro.
 */
export function termostatoMesa(e: EstadoMesa, al: Aletas) {
  const t = MESA_G.termostato, piso = pisoDucto(e, al);
  const p = piso.perfil, i = p.findIndex((q) => q.x <= t.x);
  const a = p[Math.max(0, i - 1)], b = p[Math.max(0, i)];
  const Tnormal = a.x === b.x ? a.Tp : a.Tp + ((t.x - a.x) / (b.x - a.x)) * (b.Tp - a.Tp);
  const epsEff = 1 / (1 / ALUMINIO.eps + 1 / 0.05 - 1), gap = ALTO_DUCTO - al.alto / 1000, Rback = 0.002 / PETG.k + 1 / 10;
  const bloque = { c: [0, 0, MESA_G.bloque.zBase0] as V3, u: [1, 0, 0] as V3, v: [0, 1, 0] as V3, a: 160, b: 160, nR: [0, 0, -1] as V3 };
  const F = (x: number, y: number) => vistaRect([x, y, MESA_G.piso.z1], [0, 0, 1], bloque);
  const Fterm = F(t.x, t.y), Fcentro = F(0, 0);
  const pisoCon = (Tb: number, Fv: number) => {   // el piso en equilibrio con el bloque a Tb, aire quieto
    let lo = MESA_TERMICA.Tcaja, hi = Tb, Tp = lo;
    for (let k = 0; k < 60; k++) {
      Tp = (lo + hi) / 2;
      const qin = Fv * epsEff * SIGMA * ((Tb + 273.15) ** 4 - (Tp + 273.15) ** 4) + (AIRE.k / gap) * (Tb - Tp);
      if (qin > (Tp - MESA_TERMICA.Tcaja) / Rback) lo = Tp; else hi = Tp;
    }
    return Tp;
  };
  let lo = 40, hi = 1500;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (pisoCon(m, Fterm) < t.abre) lo = m; else hi = m; }
  const TbAbre = lo;
  return { Tnormal, Fterm, Fcentro, TbAbre, TcentroAbre: pisoCon(TbAbre, Fcentro), margenFalso: t.abre - t.tol - Tnormal };
}
/** un trozo de silicato tocado por lo caliente en una punta, que se enfría por sus caras: aleta (decae en 1/m) */
export function aletaSilicato(T0: number, largo: number, ancho: number, grueso: number, h = 12, Tair = 30) {
  const k = SILICATO.k((T0 + Tair) / 2), A = (ancho / 1000) * (grueso / 1000), P = 2 * (ancho + grueso) / 1000;
  const m = Math.sqrt((h * P) / (k * A));
  return { m, decae: 1000 / m, T: Tair + (T0 - Tair) * Math.exp(-m * (largo / 1000)) };
}
/** factor de vista de un elemento dA (normal n, en p) a un rectángulo (normal nR), por cuadratura */
export function vistaRect(p: V3, n: V3, rect: { c: V3; u: V3; v: V3; a: number; b: number; nR: V3 }, N = 40) {
  let F = 0;
  const dA = (rect.a * rect.b) / (N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const s = ((i + 0.5) / N - 0.5) * rect.a, t = ((j + 0.5) / N - 0.5) * rect.b;
    const q: V3 = [rect.c[0] + rect.u[0] * s + rect.v[0] * t, rect.c[1] + rect.u[1] * s + rect.v[1] * t, rect.c[2] + rect.u[2] * s + rect.v[2] * t];
    const r: V3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], r2 = r[0] ** 2 + r[1] ** 2 + r[2] ** 2, rl = Math.sqrt(r2);
    const c1 = (n[0] * r[0] + n[1] * r[1] + n[2] * r[2]) / rl, c2 = -(rect.nR[0] * r[0] + rect.nR[1] * r[1] + rect.nR[2] * r[2]) / rl;
    if (c1 > 0 && c2 > 0) F += (c1 * c2 * dA) / (Math.PI * r2);
  }
  return F;
}
/** PETG que ve una superficie caliente: equilibrio radiación absorbida = convección natural + re-radiación (lineal) */
export function petgQueVe(F: number, Tcal: number, epsCal: number, Tair = 30) {
  const qIn = F * epsCal * PETG.eps * SIGMA * ((Tcal + 273.15) ** 4 - (Tair + 273.15) ** 4);
  return { qIn, T: Tair + qIn / (8 + 4 * PETG.eps * SIGMA * (Tair + 273.15) ** 3) };
}
/** cable de cobre como aleta (largo que necesita en aire antes de tocar PETG) */
export function aletaCable(od: number, mm2: number, h: number, T0: number, Tlim = 70, Tair = 30) {
  const m = Math.sqrt((h * Math.PI * od / 1000) / (COBRE.k * mm2 * 1e-6));
  return { decae: 1000 / m, largo: (1000 / m) * Math.log((T0 - Tair) / (Tlim - Tair)) };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 3. LOS CABLES Y SU CANAL
// ════════════════════════════════════════════════════════════════════════════════════════════
/** Ø exterior por AWG (plumaSistema.CALIBRES; el 8 en silicona por la orden) y su sección de cobre */
export const OD_AWG: Record<number, { od: number; mm2: number }> = {
  26: { od: 1.0, mm2: 0.13 }, 24: { od: 1.2, mm2: 0.2 }, 22: { od: 1.4, mm2: 0.33 }, 16: { od: 2.4, mm2: 1.31 },
  10: { od: 4.3, mm2: 5.26 }, 8: { od: 6.8, mm2: 8.37 },
};
export const CLASE: Record<Funcion, 'potencia' | 'senal' | 'neutra'> = {
  ac: 'potencia', pe: 'potencia', bus: 'potencia', potencia: 'potencia', motor: 'potencia', senal: 'senal', ventilador: 'neutra',
};
/** colores por función (convención de plumaSistema.COLOR_FUNCION: ac negro/fase, PE verde, bus rojo, salida cobre, motor, señal gris, 12 V naranja) */
export const COLOR_FUNCION_LAB: Record<Funcion, string> = {
  ac: '#3a3a3a', pe: '#2e9d4a', bus: '#c62828', potencia: '#c4572b', motor: '#7a3fd6', senal: '#9aa3ad', ventilador: '#f08c2e',
};
export interface Seccion { w: number; d: number; pared: number; tapa: number; areaCables: number; llenado: number; od: number; r: number; Rmin: number }
/** sección del canal: llenado ≤ 0.4 con 5 % de margen, dos hilos al menos de lado, mínimo 5 mm (dedos) */
export function seccionCanal(c: { hilos: string[]; awg: number }): Seccion {
  const { od } = OD_AWG[c.awg] ?? { od: 1.2 };
  const n = c.hilos.length, A = n * Math.PI * od * od / 4;
  const d = Math.max(5, Math.ceil((od * 1.5) * 2) / 2);
  const filas = Math.max(1, Math.floor(d / od)), deLado = Math.ceil(n / filas);
  const w = Math.max(5, Math.ceil(Math.max(A / (0.38 * d), deLado * od + 1) * 2) / 2);
  const pared = 2, tapa = 1.6;
  return { w, d, pared, tapa, areaCables: A, llenado: A / (w * d), od, r: Math.max(w, d) / 2 + pared, Rmin: REGLAS.dobladoMinK * od };
}
/** conexiones que viajan en el canal de otra (contrato R2: K14 «viaja con K08 (señal)») */
export const COMPARTEN: Record<string, string> = { K14: 'K08' };
/** la sección de un canal con hilos de varios calibres: el área es la suma, el fondo y el doblez los pone el más grueso */
export function seccionMixta(cs: { hilos: string[]; awg: number }[]): Seccion {
  if (cs.length === 1) return seccionCanal(cs[0]);
  const ods = cs.flatMap((c) => c.hilos.map(() => (OD_AWG[c.awg] ?? { od: 1.2 }).od));
  const od = Math.max(...ods), n = ods.length, A = ods.reduce((s, o) => s + Math.PI * o * o / 4, 0);
  const d = Math.max(5, Math.ceil((od * 1.5) * 2) / 2);
  const filas = Math.max(1, Math.floor(d / od)), deLado = Math.ceil(n / filas);
  const w = Math.max(5, Math.ceil(Math.max(A / (0.38 * d), deLado * od + 1) * 2) / 2);
  const pared = 2, tapa = 1.6;
  return { w, d, pared, tapa, areaCables: A, llenado: A / (w * d), od, r: Math.max(w, d) / 2 + pared, Rmin: REGLAS.dobladoMinK * od };
}
/** la sección del canal donde va una conexión (con las que viajan con ella) */
export function seccionDe(c: Conexion): Seccion {
  const host = COMPARTEN[c.id] ?? c.id, todas = CONEXIONES.filter((q) => q.id === host || COMPARTEN[q.id] === host);
  return seccionMixta(todas.length ? todas : [c]);
}

// ── la mesa: C.MESA, MESA.NTC, VMESA y MESA.TERM ya son del contrato (R2, P6); K11, K12 y K13 también ──
/**
 * K11, K12 y K13 viven en el aire FRÍO de la entrada del ducto (silicona 200 °C, sujetos con broches de la charola):
 * rutas a mano desde C.MESA (cara de arriba de C, z −26: los hilos suben por el paso del piso). El juez las revisa igual.
 * K13: los 2 × cal 24 (R 7.2) suben 7.2 de C.MESA, corren −x por el piso, hacen una S oblicua (+9 en y, −3.2 en z:
 * R·sen θ = 6.8 de cada lado) y llegan acostados al termostato yendo a −x (MESA.TERM mira a +x). La S va a la mitad del
 * tramo que deja el contrato (P9: el termostato en x 45, a 35.5 mm de C.MESA).
 */
export const RUTAS_DUCTO: Record<string, V3[]> = {
  K11: [[80.5, -69, -26], [80.5, -69, -18], [78, -69, -18], [78, -69, -12]],
  K12: [[80.5, -69, -26], [80.5, -69, -15.5], [98, -69, -15.5], [98, -47, -15.5], [98, -47, -95], [108, -47, -95]],
  K13: [[80.5, -69, -26], [80.5, -69, -18.8], [59, -69, -18.8], [59, -60, -22], [...puerto('MESA.TERM').pos]],
};
/** puerto virtual donde K05 deja su canal (pie de la columna, piso del paso del humo) y sigue AL AIRE hasta el MARCO */
export const K05_AIRE: Puerto = { id: 'K05.AIRE', modulo: 'COLUMNA', pos: [-30, 190, -69.5], dir: [0, -1, 0],
  nota: 'el canal de K05 (A*) llega aquí a +y por abajo del pie; de aquí su tubo sube derecho al piso del paso del humo (z −20) y el cobre sigue AL AIRE hasta el MARCO' };
const puertoX = (id: string): Puerto => (id === 'LRS.T.AC' ? { id, modulo: 'LRS', pos: BORNE_AC, dir: [-1, 0, 0] } : id === 'LRS.T.DC' ? { id, modulo: 'LRS', pos: BORNE_DC, dir: [-1, 0, 0] } : id === K05_AIRE.id ? K05_AIRE : puerto(id));
/** puerto por id, o null si el contrato no lo tiene (una conexión con un puerto que no existe es un ERROR del juez) */
const puertoO = (id: string): Puerto | null => { try { return puertoX(id); } catch { return null; } };
/** la LRS tiene DOS bornes (leídos del STEP): la AC y la tierra van a la bornera de AC; el bus a los bornes de DC */
export const extremos = (c: Conexion): [string, string] => {
  const m = (id: string) => (id === 'LRS.T' ? (c.funcion === 'bus' ? 'LRS.T.DC' : 'LRS.T.AC') : id);
  return [m(c.de), m(c.a)];
};

// ════════════════════════════════════════════════════════════════════════════════════════════
// 4. EL RUTEO: A* sobre una rejilla de 5 mm, con largo mínimo de tramo (doblez), separación y preferencia por paredes
// ════════════════════════════════════════════════════════════════════════════════════════════
// R2: la base llega a y 230 → la rejilla cubre y −110…230 (NY 69)
const S = 5, GX0 = -150, GY0 = -110, GZ0 = -125, NX = 61, NY = Math.round((BASE.y1 - GY0) / S) + 1, NZ = 98;
const NCELL = NX * NY * NZ;
const DIRS: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const cx = (i: number) => GX0 + S * i, cy = (j: number) => GY0 + S * j, cz = (k: number) => GZ0 + S * k;
const idx = (i: number, j: number, k: number) => i + NX * (j + NY * k);
const dirDe = (v: V3) => DIRS.findIndex((d) => d[0] === Math.sign(v[0]) && d[1] === Math.sign(v[1]) && d[2] === Math.sign(v[2]));
const caja = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Caja => ({ x0, y0, z0, x1, y1, z1 });

/** dónde PUEDE ir un canal (cajas libres) y dónde NO (obstáculos). Los canales viven adentro de paredes, piso, cubierta y columna. */
export function espacioDeRuteo() {
  const libres: Caja[] = [
    INTERIOR,
    caja(COLUMNA.x0 + 2, COLUMNA.y0, COLUMNA.z0, COLUMNA.x1 - 2, COLUMNA.y1 - 2, COLUMNA.z1 - 2),
  ];
  const b = (id: string) => bahia(id).caja;
  const obst: { nombre: string; c: Caja; ajena?: boolean }[] = [
    { nombre: 'LRS', c: b('LRS'), ajena: true },
    { nombre: 'escape de la LRS', c: caja(125, 60, Z_PISO, 146, 184, -78) },
    { nombre: 'PLACA_PCB', c: b('PLACA_PCB'), ajena: true },
    { nombre: 'ALAMBRE', c: b('ALAMBRE'), ajena: true },
    { nombre: 'LANZA', c: b('LANZA'), ajena: true },
    { nombre: 'ventilador de C', c: b('VENTILADOR') },
    { nombre: 'difusor', c: b('DIFUSOR') },
    { nombre: 'IEC', c: IEC_CUERPO },
    { nombre: 'PARO', c: b('PARO') },
    { nombre: 'mesa y su ducto', c: caja(MESA_G.ducto.x0, -MESA_G.lado - 4, -30, MESA_G.ducto.x1, MESA_G.lado + 4, 0) },
    { nombre: 'ventilador de la mesa', c: caja(MESA_G.vent.x0, MESA_G.vent.y0 - 4, MESA_G.vent.z0 - 2, 146, MESA_G.vent.y1 + 4, -12) },
    { nombre: 'subida de la mesa', c: caja(MESA_G.subida.x0 - 2, MESA_G.subida.y0 - 2, MESA_G.subida.z0 - 24, MESA_G.subida.x1, MESA_G.subida.y1 + 2, -12) },
    // el camino del humo por el pie de la columna (garganta + paso) y el collar de atrás
    { nombre: 'garganta del humo', c: caja(HUMO.garganta.x0, HUMO.garganta.y0, HUMO.garganta.z0, HUMO.garganta.x1, HUMO.paso.y0 + 14, HUMO.garganta.z1) },
    { nombre: 'paso del humo', c: caja(HUMO.paso.x0, HUMO.paso.y0, HUMO.paso.z0, HUMO.paso.x1, HUMO.paso.y1, HUMO.paso.pico) },
    { nombre: 'collar', c: caja(COLLAR.x - COLLAR.rInt, COL.y1 - 4, COLLAR.z - COLLAR.rInt, COLLAR.x + COLLAR.rInt, COL.y1 + COLLAR.largo, COLLAR.z + COLLAR.rInt * Math.SQRT2) },
    { nombre: 'riel', c: caja(-22, 150, RIEL.z0 - 2, 22, 160, COL.z1) },
    ...ESPIGAS.map((e) => ({ nombre: 'espiga de la junta', c: caja(e.x0 - 1, e.y0 - 1, Z_COL - 3, e.x1 + 1, e.y1 + 1, Z_COL + 27) })),
    ...POSTES_CUB.map((x) => ({ nombre: 'poste de la cubierta', c: caja(x - 5, 49, Z_PISO, x + 5, 59, Z_CUB.z0) })),
    { nombre: 'rejilla de C (frente)', c: caja(88, -106, -118, 140, -100, -68) },
    { nombre: 'rejilla de C (derecha)', c: caja(140, 34, -118, 146, 56, -30) },
    { nombre: 'entrada de la LRS (atrás izq.)', c: caja(-110, BASE.y1 - PARED - 12, -118, -60, BASE.y1 - PARED, -82) },
    { nombre: 'entrada de la LRS (atrás der.)', c: caja(60, BASE.y1 - PARED - 12, -118, 125, BASE.y1 - PARED, -82) },
  ];
  return { libres, obst };
}
const dentroCaja = (x: number, y: number, z: number, c: Caja, m = 0) => x >= c.x0 - m && x <= c.x1 + m && y >= c.y0 - m && y <= c.y1 + m && z >= c.z0 - m && z <= c.z1 + m;

export interface Ruta {
  id: string; puntos: V3[]; seccion: Seccion; clase: 'potencia' | 'senal' | 'neutra'; modo: 'astar' | 'ducto' | 'directo' | 'sin-ruta'; expansiones: number; costo: number; nota?: string;
  /** la parte de `puntos` que es canal impreso (K05: sin su tramo al aire); si falta, todo es canal */
  canalPts?: V3[];
  /** va en el canal de otra conexión (K14 en el de K08): no se imprime otra vez */
  compartido?: string;
}
interface Ctx { rutas: Ruta[]; enRuta: Map<string, [string, string]> }

class Monticulo {
  k: number[] = []; v: number[] = [];
  push(key: number, val: number) {
    const k = this.k, v = this.v; k.push(key); v.push(val); let i = k.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop(): number {
    const k = this.k, v = this.v, top = v[0], lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.k.length; }
}

/** máscaras de la rejilla para un canal de semiancho r */
function mascaras(r: number) {
  const { libres, obst } = espacioDeRuteo();
  const bloq = new Uint8Array(NCELL), duro = new Uint8Array(NCELL), pref = new Float32Array(NCELL);
  const paredes: { eje: 0 | 1 | 2; v: number; c: Caja }[] = [
    { eje: 0, v: INTERIOR.x0, c: INTERIOR }, { eje: 0, v: INTERIOR.x1, c: INTERIOR }, { eje: 1, v: INTERIOR.y0, c: INTERIOR },
    { eje: 1, v: INTERIOR.y1, c: INTERIOR }, { eje: 2, v: INTERIOR.z0, c: INTERIOR }, { eje: 2, v: INTERIOR.z1, c: INTERIOR },
    { eje: 0, v: COLUMNA.x0, c: COLUMNA }, { eje: 0, v: COLUMNA.x1, c: COLUMNA }, { eje: 1, v: COLUMNA.y1, c: COLUMNA }, { eje: 1, v: COLUMNA.y0, c: COLUMNA },
  ];
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = cx(i), y = cy(j), z = cz(k), g = idx(i, j, k);
    const enLibre = libres.some((c) => x >= c.x0 + r && x <= c.x1 - r && y >= c.y0 + r && y <= c.y1 - r && z >= c.z0 + r && z <= c.z1 - r);
    const enLibreDuro = libres.some((c) => dentroCaja(x, y, z, c));
    let o = false, od = false;
    for (const q of obst) { if (dentroCaja(x, y, z, q.c, r - 0.01)) o = true; if (dentroCaja(x, y, z, q.c, -0.01)) od = true; }
    bloq[g] = !enLibre || o ? 1 : 0;
    duro[g] = !enLibreDuro || od ? 1 : 0;
    let cerca = false;
    for (const p of paredes) {
      const pt = [x, y, z][p.eje];
      if (Math.abs(pt - p.v) <= r + 6 && dentroCaja(x, y, z, p.c, 1)) { cerca = true; break; }
    }
    pref[g] = cerca ? 1 : 1.6;
  }
  return { bloq, duro, pref };
}
const cacheMasc = new Map<number, ReturnType<typeof mascaras>>();
const masc = (r: number) => { const k = Math.round(r * 4) / 4; let m = cacheMasc.get(k); if (!m) { m = mascaras(k); cacheMasc.set(k, m); } return m; };

/** celda de arranque: la primera celda pasando el puerto a lo largo de su normal */
function celdaPuerto(p: Puerto): { i: number; j: number; k: number; stub: number } {
  const ax = p.dir[0] ? 0 : p.dir[1] ? 1 : 2, sgn = p.dir[ax];
  const g0 = [GX0, GY0, GZ0][ax];
  const t = (p.pos[ax] - g0) / S;
  const n = sgn > 0 ? Math.floor(t + 1e-9) + 1 : Math.ceil(t - 1e-9) - 1;
  const c = [Math.round((p.pos[0] - GX0) / S), Math.round((p.pos[1] - GY0) / S), Math.round((p.pos[2] - GZ0) / S)];
  c[ax] = n;
  const stub = Math.abs(g0 + S * n - p.pos[ax]);
  return { i: c[0], j: c[1], k: c[2], stub };
}

/** pinta en una máscara las celdas a menos de `inf` de los tramos ya ruteados (con exenciones alrededor de puertos) */
function pintarRutas(rutas: Ruta[], infDe: (r: Ruta) => number, exentosDe: V3[] | ((r: Ruta) => V3[]), radioEx: number, euclid = false): Uint8Array {
  const m = new Uint8Array(NCELL);
  for (const ru of rutas) {
    const inf = infDe(ru); if (inf <= 0) continue;
    const exentos = typeof exentosDe === 'function' ? exentosDe(ru) : exentosDe;
    for (let s = 0; s + 1 < ru.puntos.length; s++) {
      const a = ru.puntos[s], b = ru.puntos[s + 1];
      const x0 = Math.min(a[0], b[0]) - inf, x1 = Math.max(a[0], b[0]) + inf, y0 = Math.min(a[1], b[1]) - inf, y1 = Math.max(a[1], b[1]) + inf;
      const z0 = Math.min(a[2], b[2]) - inf, z1 = Math.max(a[2], b[2]) + inf;
      for (let k = Math.max(0, Math.ceil((z0 - GZ0) / S)); k <= Math.min(NZ - 1, Math.floor((z1 - GZ0) / S)); k++)
        for (let j = Math.max(0, Math.ceil((y0 - GY0) / S)); j <= Math.min(NY - 1, Math.floor((y1 - GY0) / S)); j++)
          for (let i = Math.max(0, Math.ceil((x0 - GX0) / S)); i <= Math.min(NX - 1, Math.floor((x1 - GX0) / S)); i++) {
            const x = cx(i), y = cy(j), z = cz(k);
            if (exentos.some((e) => Math.hypot(x - e[0], y - e[1], z - e[2]) < radioEx)) continue;
            if (euclid) {
              const dx = Math.max(Math.min(a[0], b[0]) - x, 0, x - Math.max(a[0], b[0])), dy = Math.max(Math.min(a[1], b[1]) - y, 0, y - Math.max(a[1], b[1])), dz = Math.max(Math.min(a[2], b[2]) - z, 0, z - Math.max(a[2], b[2]));
              if (Math.hypot(dx, dy, dz) >= inf) continue;
            }
            m[idx(i, j, k)] = 1;
          }
    }
  }
  return m;
}

export const RADIO_ACOMETIDA = 20;   // mm alrededor de los puertos propios donde el canal toca su bahía
export const RADIO_ABANICO = 25;     // mm de abanico en un puerto compartido (la bornera de AC de la LRS mide 31.7)
export const RADIO_PUERTO_COMPARTIDO = 30;
/** puertos que usan dos o más conexiones: ahí los hilos salen de PINES distintos (IEC: L, N y PE a ~10 mm), así que
 *  el abanico de los primeros 20 mm no es un doblez del cable (el peine va justo después). */
let _comp: Map<string, string[]> | null = null;
export function puertosCompartidos(): Map<string, string[]> {
  if (_comp) return _comp;
  const m = new Map<string, string[]>();
  for (const c of todasLasConexiones()) for (const id of extremos(c)) m.set(id, [...(m.get(id) ?? []), c.id]);
  for (const [k, v] of [...m]) if (v.length < 2) m.delete(k);
  return (_comp = m);
}
const enAbanico = (c: Conexion, q: V3) => {
  const comp = puertosCompartidos();
  return extremos(c).some((id) => comp.has(id) && Math.hypot(q[0] - puertoX(id).pos[0], q[1] - puertoX(id).pos[1], q[2] - puertoX(id).pos[2]) <= RADIO_ABANICO + 0.01);
};
/** una ruta que no existe: el juez la marca C1 con este porqué (nunca una excepción) */
export const sinRuta = (c: Conexion, nota: string, expansiones = 0): Ruta =>
  ({ id: c.id, puntos: [], seccion: seccionCanal(c), clase: CLASE[c.funcion], modo: 'sin-ruta', expansiones, costo: Infinity, nota });
export interface OpcionesRuteo {
  penalCorto?: number; maxExp?: number;
  /** la sección del canal si no es la de la conexión sola (K08 lleva también a K14) */
  seccion?: Seccion;
  /** no bajar de z (salvo junto a sus puertos): K06 va por arriba de K05 donde se cruzan */
  zMin?: number;
  /** el puerto donde termina el canal si no es el `a` de la conexión (K05: deja el canal en K05.AIRE) */
  hasta?: string;
  /** quedarse a ≤ max mm (eje a eje) de otra ruta donde `region` es verdad (K05 pegado a K06 de C al pie de la columna) */
  cerca?: { ruta: Ruta; max: number; region: (x: number, y: number, z: number) => boolean };
}
/** A* con estado (celda, dirección, tramo recto): girar exige tramo ≥ 2R (o ≥ R el primero); si no hay salida, castiga.
 *  Lo que no se puede (un puerto que no existe, ningún camino) sale como ruta 'sin-ruta' con su porqué. */
export function rutear(c: Conexion, ctx: Ctx, opciones: OpcionesRuteo = {}): Ruta {
  try { return rutearA(c, ctx, opciones); } catch (e) { return sinRuta(c, `el ruteo falló: ${String((e as Error)?.message ?? e).slice(0, 120)}`); }
}
function rutearA(c: Conexion, ctx: Ctx, opciones: OpcionesRuteo): Ruta {
  const sec = opciones.seccion ?? seccionDe(c), clase = CLASE[c.funcion];
  const [idA, idB0] = extremos(c), idB = opciones.hasta ?? idB0;
  const pA = puertoO(idA), pB = puertoO(idB);
  if (!pA || !pB) return sinRuta(c, `el puerto ${!pA ? idA : idB} no está en el contrato`);
  const { bloq, duro, pref } = masc(sec.r);
  const exentos = [pA.pos, pB.pos];
  // K05: fuera de `region` libre; dentro, sólo las celdas a ≤ max del eje de la otra ruta (o junto a sus puertos)
  const junto = opciones.cerca ? pintarRutas([opciones.cerca.ruta], () => opciones.cerca!.max + 0.01, [], 0, true) : null;
  // ocupación: otros canales (pared con pared) y separación potencia–señal
  const compartidos = (ru: Ruta) => { const e = ctx.enRuta.get(ru.id)!; return e.filter((x) => x === idA || x === idB); };
  const ocup = pintarRutas(ctx.rutas, (ru) => ru.seccion.r + sec.r - 0.5, exentos, RADIO_ACOMETIDA + 5);
  const sep = pintarRutas(
    ctx.rutas.filter((ru) => (ru.clase === 'potencia' && clase === 'senal') || (ru.clase === 'senal' && clase === 'potencia')),
    (ru) => ru.seccion.w / 2 + sec.w / 2 + REGLAS.separacionPotenciaSenalMm - 0.5,
    (ru) => compartidos(ru).map((id) => puertoX(id).pos), RADIO_PUERTO_COMPARTIDO, true,   // sólo los puertos que ESA ruta comparte con ésta
  );
  // la potencia también deja libres los puertos de señal que todavía no se rutean (si no, la señal no tiene por dónde salir)
  if (clase === 'potencia') {
    const propios = new Set([idA, idB]);
    const deSenal = [...new Set(todasLasConexiones().filter((q) => CLASE[q.funcion] === 'senal').flatMap((q) => extremos(q)))].filter((id) => !propios.has(id));
    for (const id of deSenal) {
      const e = puertoX(id).pos, rr = REGLAS.separacionPotenciaSenalMm + sec.w / 2 + 2.5;
      for (let k = Math.max(0, Math.ceil((e[2] - rr - GZ0) / S)); k <= Math.min(NZ - 1, Math.floor((e[2] + rr - GZ0) / S)); k++)
        for (let j = Math.max(0, Math.ceil((e[1] - rr - GY0) / S)); j <= Math.min(NY - 1, Math.floor((e[1] + rr - GY0) / S)); j++)
          for (let i = Math.max(0, Math.ceil((e[0] - rr - GX0) / S)); i <= Math.min(NX - 1, Math.floor((e[0] + rr - GX0) / S)); i++)
            if (Math.hypot(cx(i) - e[0], cy(j) - e[1], cz(k) - e[2]) < rr) sep[idx(i, j, k)] = 1;
    }
  }
  const abanico = (x: number, y: number, z: number) => enAbanico(c, [x, y, z]);
  const R = sec.Rmin, need = Math.ceil((2 * R) / S - 1e-9), L = need + 1;
  const a = celdaPuerto(pA), bC = celdaPuerto(pB);
  const s0 = idx(a.i, a.j, a.k), goal = idx(bC.i, bC.j, bC.k);
  const d0 = dirDe(pA.dir), dGoal = dirDe([-pB.dir[0], -pB.dir[1], -pB.dir[2]] as V3);
  const run0 = Math.min(need, Math.floor((R + a.stub) / S + 1e-9));
  const finNeed = Math.ceil(Math.max(0, R - bC.stub) / S - 1e-9);
  const penal = opciones.penalCorto ?? 5000, maxExp = opciones.maxExp ?? 4_000_000, Cgiro = 15;
  const libre = (g: number, x: number, y: number, z: number) => {
    if (ocup[g] || sep[g]) return false;
    if (junto && !junto[g] && opciones.cerca!.region(x, y, z) && Math.hypot(x - pA.pos[0], y - pA.pos[1], z - pA.pos[2]) >= RADIO_ACOMETIDA) return false;
    if (opciones.zMin !== undefined && z < opciones.zMin && Math.hypot(x - pA.pos[0], y - pA.pos[1], z - pA.pos[2]) >= RADIO_ACOMETIDA && Math.hypot(x - pB.pos[0], y - pB.pos[1], z - pB.pos[2]) >= RADIO_ACOMETIDA) return false;
    if (!bloq[g]) return true;
    const cerca = Math.hypot(x - pA.pos[0], y - pA.pos[1], z - pA.pos[2]) < RADIO_ACOMETIDA || Math.hypot(x - pB.pos[0], y - pB.pos[1], z - pB.pos[2]) < RADIO_ACOMETIDA;
    return cerca && !duroExc(g, x, y, z);
  };
  const duroExc = (g: number, x: number, y: number, z: number) => {
    // dentro de la bahía ajena del propio puerto sólo hasta 2 mm (el canal arranca en su cara)
    if (!duro[g]) return false;
    const enSuBahia = [pA, pB].some((p) => { const bb = BAHIAS.find((q) => q.id === p.modulo)?.caja; return bb && dentroCaja(x, y, z, bb, 0.01) && Math.hypot(x - p.pos[0], y - p.pos[1], z - p.pos[2]) < 4; });
    return !enSuBahia;
  };
  const gi = (g: number) => g % NX, gj = (g: number) => Math.floor(g / NX) % NY, gk = (g: number) => Math.floor(g / (NX * NY));
  const hEu = (g: number) => S * (Math.abs(gi(g) - bC.i) + Math.abs(gj(g) - bC.j) + Math.abs(gk(g) - bC.k));
  // estado: (celda, dirección, tramo recto, dirección antes del último giro: 6 = ninguna)
  const key = (g: number, d: number, r: number, dp: number) => ((g * 6 + d) * 7 + dp) * L + r;
  const preCredito = Math.min(need, Math.ceil(R / S));
  const gScore = new Map<number, number>(), padre = new Map<number, number>();
  const heap = new Monticulo();
  const k0 = key(s0, d0, run0, 6);
  gScore.set(k0, 0); heap.push(hEu(s0), k0);
  let exp = 0, fin = -1, costoFin = Infinity;
  while (heap.size) {
    const kk = heap.pop();
    const r = kk % L, dp = Math.floor(kk / L) % 7, d = Math.floor(kk / L / 7) % 6, g = Math.floor(kk / L / 7 / 6);
    const gc = gScore.get(kk)!;
    if (gc >= costoFin) break;
    if (g === goal && d === dGoal) {
      const extra = r < finNeed ? penal * (finNeed - r) / Math.max(1, finNeed) : 0;
      if (gc + extra < costoFin) { costoFin = gc + extra; fin = kk; }
      continue;
    }
    if (++exp > maxExp) break;
    const i = gi(g), j = gj(g), k = gk(g);
    for (let nd = 0; nd < 6; nd++) {
      if ((nd ^ 1) === d) continue;                       // sin media vuelta
      const D = DIRS[nd], ni = i + D[0], nj = j + D[1], nk = k + D[2];
      if (ni < 0 || nj < 0 || nk < 0 || ni >= NX || nj >= NY || nk >= NZ) continue;
      const ng = idx(ni, nj, nk);
      if (!libre(ng, cx(ni), cy(nj), cz(nk))) continue;
      let costo = S * pref[ng], nr: number, ndp = dp;
      if (nd === d) nr = Math.min(need, r + 1);
      else {
        // S (vuelve a la dirección de antes): el cable la hace con dos arcos < 90°, el tramo de en medio puede ser corto.
        // U (la contraria) o giro a otro plano: el tramo tiene que dar 2R.
        const esS = nd === dp, ab = abanico(cx(i), cy(j), cz(k));
        costo += Cgiro + (!esS && !ab && r < need ? penal * (need - r) / need : 0);
        nr = ab ? Math.min(need, 1 + preCredito) : 1; ndp = d;
      }
      const nk2 = key(ng, nd, nr, ndp), ngc = gc + costo;
      if (ngc < (gScore.get(nk2) ?? Infinity)) { gScore.set(nk2, ngc); padre.set(nk2, kk); heap.push(ngc + hEu(ng), nk2); }
    }
  }
  if (fin < 0) return sinRuta(c, `A* sin camino de ${idA} a ${idB} (${exp} expansiones${exp > maxExp ? ', se acabó el presupuesto' : ''}): ${!libre(s0, cx(a.i), cy(a.j), cz(a.k)) ? `la salida de ${idA} está tapada` : !libre(goal, cx(bC.i), cy(bC.j), cz(bC.k)) ? `la llegada a ${idB} está tapada` : 'los obstáculos y los canales ya ruteados lo encierran'}`, exp);
  const celdas: number[] = [];
  for (let kk: number | undefined = fin; kk !== undefined; kk = padre.get(kk)) celdas.push(Math.floor(kk / L / 7 / 6));
  celdas.reverse();
  const pts: V3[] = [pA.pos, ...celdas.map((g) => [cx(gi(g)), cy(gj(g)), cz(gk(g))] as V3), pB.pos];
  return { id: c.id, puntos: refinarAcometida(simplificar(pts), c, sec, ctx, [idA, idB]), seccion: sec, clase, modo: 'astar', expansiones: exp, costo: costoFin };
}
/**
 * La rejilla de 5 mm no ve márgenes de 1–2 mm: si el primer (o último) codo queda corto por menos de media celda,
 * se corre el tramo siguiente a lo largo de la normal del puerto (hasta 2.5 mm) si el canal sigue libre ahí
 * (cajas reales, no celdas) y no pisa otros canales. Ej.: la bornera de DC de la LRS tiene 36 mm a la pared.
 */
function refinarAcometida(pts: V3[], c: Conexion, sec: Seccion, ctx: Ctx, ids: [string, string] = extremos(c)): V3[] {
  const { libres, obst } = espacioDeRuteo();
  const [ia, ib] = ids, propios = [puertoX(ia).pos, puertoX(ib).pos];
  const otros = ctx.rutas;
  const libre = (q: V3) => {
    const cerca = propios.some((e) => Math.hypot(q[0] - e[0], q[1] - e[1], q[2] - e[2]) < RADIO_ACOMETIDA);
    if (!cerca) {
      if (!libres.some((b) => dentroCaja(q[0], q[1], q[2], b, -sec.r))) return false;
      if (obst.some((o) => dentroCaja(q[0], q[1], q[2], o.c, sec.r - 0.01))) return false;
    }
    for (const ru of otros) for (let s2 = 0; s2 + 1 < ru.puntos.length; s2++) {
      const a2 = ru.puntos[s2], b2 = ru.puntos[s2 + 1];
      const dx = Math.max(Math.min(a2[0], b2[0]) - q[0], 0, q[0] - Math.max(a2[0], b2[0])), dy = Math.max(Math.min(a2[1], b2[1]) - q[1], 0, q[1] - Math.max(a2[1], b2[1])), dz = Math.max(Math.min(a2[2], b2[2]) - q[2], 0, q[2] - Math.max(a2[2], b2[2]));
      if (Math.max(dx, dy, dz) < ru.seccion.r + sec.r - 0.5 && !propios.some((e) => Math.hypot(q[0] - e[0], q[1] - e[1], q[2] - e[2]) < RADIO_ACOMETIDA + 5)) return false;
    }
    return true;
  };
  const ajustar = (p: V3[], dirP: V3): V3[] => {
    if (p.length < 3) return p;
    const L0 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]);
    const L1 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1], p[2][2] - p[1][2]);
    const deficit = sec.Rmin - Math.min(L0, p.length > 3 ? L1 / 2 : L1);
    if (deficit <= 0 || deficit > 2.5 || L0 >= sec.Rmin) return p;
    // los puntos 1..k se corren δ·dir hasta el primer tramo paralelo a dir (que absorbe δ)
    let k = 1;
    while (k + 1 < p.length - 1) {
      const d2 = [p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1], p[k + 1][2] - p[k][2]];
      if (Math.abs(d2[0] * dirP[0] + d2[1] * dirP[1] + d2[2] * dirP[2]) > 1e-6) break;
      k++;
    }
    if (k + 1 >= p.length - 1 && k === p.length - 2) {
      const d2 = [p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1], p[k + 1][2] - p[k][2]];
      if (Math.abs(d2[0] * dirP[0] + d2[1] * dirP[1] + d2[2] * dirP[2]) < 1e-6) return p;
    }
    for (const dl of [Math.ceil((L0 < sec.Rmin ? sec.Rmin - L0 : 0) * 10 + 1) / 10, 2.5]) {
      if (dl > 2.5) continue;
      const q = p.map((x, i) => (i >= 1 && i <= k ? [x[0] + dirP[0] * dl, x[1] + dirP[1] * dl, x[2] + dirP[2] * dl] as V3 : x));
      let ok = true;
      for (let s2 = 0; s2 <= k && ok; s2++) {
        const A = q[s2], B = q[s2 + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), n = Math.max(1, Math.ceil(L / 2.5));
        for (let i = 0; i <= n; i++) if (!libre([A[0] + (B[0] - A[0]) * i / n, A[1] + (B[1] - A[1]) * i / n, A[2] + (B[2] - A[2]) * i / n])) { ok = false; break; }
      }
      if (ok) return q;
    }
    return p;
  };
  let out = ajustar(pts, puertoX(ia).dir);
  out = ajustar([...out].reverse(), puertoX(ib).dir).reverse();
  return out;
}
/** quita los puntos colineales (deja sólo esquinas) */
export function simplificar(p: V3[]): V3[] {
  const o: V3[] = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = o[o.length - 1], b = p[i], c = p[i + 1];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...cr) > 1e-6 || Math.hypot(...u) < 1e-9) o.push(b);
  }
  o.push(p[p.length - 1]);
  return o.filter((q, i) => i === 0 || Math.hypot(q[0] - o[i - 1][0], q[1] - o[i - 1][1], q[2] - o[i - 1][2]) > 1e-6);
}
export const largo = (p: V3[]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]), 0);
/**
 * El radio que de verdad cabe en una polilínea: cada esquina CONSUME largo de sus dos tramos y ningún tramo puede dar
 * más de lo que mide. Codo de 90°: R de cada lado. Una S (d → e → d) con tramo de en medio m < 2R se hace con dos
 * arcos de θ = acos(1 − m/2R): consume R·sen θ de los tramos de afuera y todo m. Las esquinas exentas (abanico de un
 * puerto compartido) no consumen. Devuelve el mayor R factible (bisección).
 */
export function radioDisponible(p: V3[], exento: (i: number) => boolean = () => false): number {
  if (p.length < 3) return Infinity;
  const L = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]));
  const dir = p.slice(1).map((q, i) => [Math.sign(q[0] - p[i][0]), Math.sign(q[1] - p[i][1]), Math.sign(q[2] - p[i][2])].join(','));
  const nC = p.length - 2;
  const cabe = (R: number) => {
    const usoIni = new Array(L.length).fill(0), usoFin = new Array(L.length).fill(0);   // consumo en el inicio / fin de cada tramo
    const enS = new Array(nC + 2).fill(false);
    for (let c = 1; c + 1 <= nC; c++) {          // pares de esquinas c, c+1 con tramo de en medio L[c]
      if (dir[c - 1] === dir[c + 1] && L[c] < 2 * R && !exento(c) && !exento(c + 1)) {
        const th = Math.acos(1 - L[c] / (2 * R)), u = R * Math.sin(th);
        usoFin[c - 1] = Math.max(usoFin[c - 1], u); usoIni[c + 1] = Math.max(usoIni[c + 1], u);
        enS[c] = enS[c + 1] = true;
      }
    }
    for (let c = 1; c <= nC; c++) {
      if (enS[c] || exento(c)) continue;
      usoFin[c - 1] = Math.max(usoFin[c - 1], R); usoIni[c] = Math.max(usoIni[c], R);
    }
    return L.every((l, k) => usoIni[k] + usoFin[k] <= l + 1e-6);
  };
  let a = 0, b = 400;
  for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (cabe(m)) a = m; else b = m; }
  return a;
}
/** esquinas que son la mitad de una S corta (para el sólido: van en un bolsillo, no en codos de 90°) */
export function esquinasEnS(p: V3[], R: number): boolean[] {
  const L = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]));
  const dir = p.slice(1).map((q, i) => [Math.sign(q[0] - p[i][0]), Math.sign(q[1] - p[i][1]), Math.sign(q[2] - p[i][2])].join(','));
  const out = new Array(p.length).fill(false);
  for (let c = 1; c + 1 <= p.length - 2; c++) if (dir[c - 1] === dir[c + 1] && L[c] < 2 * R) out[c] = out[c + 1] = true;
  return out;
}
/** radio de doblez «ingenuo» en cada esquina (tramos internos repartidos a la mitad): sólo informativo */
export function radiosDeDoblez(p: V3[]): number[] {
  const L = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]));
  const out: number[] = [];
  for (let c = 1; c < p.length - 1; c++) {
    const izq = c - 1 === 0 ? L[c - 1] : L[c - 1] / 2, der = c === L.length - 1 ? L[c] : L[c] / 2;
    out.push(Math.min(izq, der));
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 5. CANAL ABIERTO CON TAPA A PRESIÓN · PEINES · BROCHES
// ════════════════════════════════════════════════════════════════════════════════════════════
/** ε = 1.5·y·h/L² (viga en voladizo de sección constante; Bayer «Snap-Fit Joints»). Fuerza de retención con la rampa. */
export interface Broche { id: string; donde: string; L: number; h: number; w: number; y: number; alfa: number; n: number }
export const epsBroche = (b: Broche) => (1.5 * b.y * b.h) / (b.L * b.L);
export function fuerzaBroche(b: Broche, mu = 0.3) {
  const P = (b.w * b.h * b.h * PETG.E * epsBroche(b)) / (6 * b.L);          // fuerza de flexión (N)
  const ta = Math.tan((b.alfa * Math.PI) / 180);
  // μ·tan α ≥ 1: la rampa de retención es autobloqueante (no sale jalando: se rompe antes)
  return { P, retencion: mu * ta >= 1 ? Infinity : (P * (mu + ta)) / (1 - mu * ta) };
}
export const BROCHES: Broche[] = [
  { id: 'cub-base', donde: 'cubierta → paredes de la base (gancho abajo)', L: 14, h: 1.6, w: 8, y: 0.9, alfa: 60, n: 20 },
  { id: 'col-col', donde: 'grapa suelta columna 1 ↔ columna 2: barra de 10 × 2 en un rebaje de la cara lateral, con un diente en cada punta que cae en su bolsillo (2 por lado; impresa acostada: flexiona en el plano de las capas)', L: 18, h: 2.0, w: 10, y: 1.2, alfa: 70, n: 4 },
  { id: 'riel-z1', donde: 'tope del módulo A en z 340 (la lengüeta de la columna)', L: 25, h: 2.5, w: 12, y: 2.0, alfa: 80, n: 1 },
  { id: 'tapa', donde: 'patas de las tapas de los canales: tira de 0.8 a lo largo del canal, colgada de una raíz, con diente que entra bajo el labio de 0.6 de la ranura (un par cada 60 mm)', L: 8, h: 0.8, w: 1.2, y: 0.4, alfa: 45, n: 0 },
  { id: 'ducto-cub', donde: 'remache de broche charola → cubierta: horquilla de dos patas que entra por abajo (ala de la charola + piel de la cubierta) y engancha arriba', L: 12, h: 1.4, w: 8, y: 0.7, alfa: 60, n: 8 },
  { id: 'tapa-col', donde: 'faldas de la tapa de arriba de la columna (lados y atrás) con diente en su ranura', L: 14, h: 1.6, w: 30, y: 0.6, alfa: 60, n: 3 },
  { id: 'mordaza', donde: 'mordaza de la mesa (resorte que aprieta el taco de silicato)', L: 30, h: 3.0, w: 10, y: 2.0, alfa: 0, n: 4 },
];

// ════════════════════════════════════════════════════════════════════════════════════════════
// 6. TEJAS Y UNIONES (sin tornillos)
// ════════════════════════════════════════════════════════════════════════════════════════════
interface OpBase { s: 1 | -1; nota?: string; tag: string; libre?: boolean; canal?: boolean }
export type OpSolido =
  | (OpBase & { t: 'caja'; c: Caja })
  | (OpBase & { t: 'prisma'; plano: 'XY' | 'YZ' | 'XZ'; pts: [number, number][]; desde: number; hasta: number })
  | (OpBase & { t: 'codo'; centro: V3; u: V3; a: V3; r0: number; r1: number; h: number });
export interface Teja {
  id: string; nombre: string; caja: Caja;
  impresion: { rx: 0 | 180; nota: string };   // orientación de impresión (rx = 180: boca abajo)
  soportes: string;                           // sin soportes, o cuál y por qué
  url: string;
}
export interface Union { id: string; tipo: 'cola-de-milano' | 'espiga' | 'broche'; entre: [string, string]; n: number; holgura: number; nota: string }
const X_SPLIT = 0, Y_SPLIT = 40, X_CUB = -20, Z_COL = 140;
export function tejas(): Teja[] {
  const u = (id: string) => `/modelos/laboratorio/cuerpo/${id}.bin`;
  const zb0 = BASE.z0, zb1 = Z_CUB.z0;
  const base = (id: string, nombre: string, x0: number, x1: number, y0: number, y1: number): Teja => ({
    id, nombre, caja: caja(x0, y0, zb0, x1, y1, zb1), impresion: { rx: 0, nota: 'piso en la cama' }, url: u(id),
    soportes: 'paredes verticales; canales pegados a su pared con cartela a 45°; ventanas con techo a 45°. dfm marca los codos de canal en plano vertical y los puentes de rejilla (≤ 16 mm): soporte de árbol sólo ahí (scripts/laboratorio/cuerpo-solidos.cjs, resumen.json)',
  });
  const cub = (id: string, nombre: string, x0: number, x1: number, y0: number, y1: number): Teja => ({
    id, nombre, caja: caja(x0, y0, -45, x1, y1, Z_CUB.z1), impresion: { rx: 180, nota: 'boca abajo: la cara de arriba en la cama' }, url: u(id),
    soportes: 'boca abajo: la piel de 2 mm en la cama, ganchos y canales crecen hacia arriba; dfm marca codos y bordes de canal (ver resumen.json)',
  });
  return [
    base('base-fi', 'Base frente izquierda', BASE.x0, X_SPLIT, BASE.y0, Y_SPLIT),
    base('base-fd', 'Base frente derecha', X_SPLIT, BASE.x1, BASE.y0, Y_SPLIT),
    base('base-ti', 'Base atrás izquierda', BASE.x0, X_SPLIT, Y_SPLIT, BASE.y1),
    base('base-td', 'Base atrás derecha', X_SPLIT, BASE.x1, Y_SPLIT, BASE.y1),
    cub('cub-fi', 'Cubierta frente izquierda', BASE.x0, X_CUB, BASE.y0, Y_SPLIT),
    cub('cub-fd', 'Cubierta frente derecha', X_CUB, BASE.x1, BASE.y0, Y_SPLIT),
    cub('cub-ti', 'Cubierta atrás izquierda', BASE.x0, X_CUB, Y_SPLIT, BASE.y1),
    cub('cub-td', 'Cubierta atrás derecha', X_CUB, BASE.x1, Y_SPLIT, BASE.y1),
    { id: 'ducto-i', nombre: 'Charola del ducto de la mesa (izquierda)', caja: caja(MESA_G.ducto.x0, -MESA_G.lado - 8, -30, -14, MESA_G.lado + 8, -14), impresion: { rx: 0, nota: 'piso en la cama' }, url: u('ducto-i'), soportes: 'sin soportes: charola abierta hacia arriba' },
    { id: 'ducto-d', nombre: 'Charola del ducto de la mesa (derecha)', caja: caja(-14, -MESA_G.lado - 8, -24, MESA_G.ducto.x1, MESA_G.lado + 8, -14), impresion: { rx: 0, nota: 'piso en la cama' }, url: u('ducto-d'), soportes: 'sin soportes: charola abierta hacia arriba' },
    { id: 'col-1', nombre: 'Columna 1 (pie, garganta y paso del humo, collar Ø100, riel hembra)', caja: caja(COL.x0, COL.y0, COL_PIE_Z, COL.x1, COL.y1, Z_COL), impresion: { rx: 0, nota: 'de pie' }, url: u('col-1'), soportes: 'riel vertical; el paso del humo tiene techo a 45° y el collar es gota; la MITAD DE ABAJO del tubo del collar sale 25 mm de la pared y lleva soporte de árbol; dfm marca los codos de K05/K06/K07/K08 en el pie' },
    { id: 'col-2', nombre: 'Columna 2 (riel, broche del módulo, ventanas de A)', caja: caja(COL.x0, COL.y0, Z_COL, COL.x1, COL.y1, COL.z1), impresion: { rx: 0, nota: 'de pie' }, url: u('col-2'), soportes: 'riel vertical; ventanas de A.POT y A.SEN con techo a 45°; el codo de K06 a −y en z 210 es techo de canal (puente ≤ 11 mm)' },
    { id: 'mordazas', nombre: 'Mordazas de la mesa (4, en una cama)', caja: caja(-115, -115, -19, 115, 115, 18), impresion: { rx: 180, nota: 'boca abajo: el brazo en la cama, el poste crece hacia arriba' }, url: u('mordazas'), soportes: 'sin soportes' },
  ];
}
/** caja de impresión de una teja en su orientación (mordazas: se acomodan las 4 en la cama) */
export function cajaImpresion(t: Teja): [number, number, number] {
  if (t.id === 'mordazas') return [2 * 40 + 10, 2 * 40 + 10, 30];
  const c = t.caja;
  if (t.id === 'col-1') return [c.x1 - c.x0, c.y1 - c.y0 + COLLAR.largo, c.z1 - c.z0 + 25];   // + el collar atrás y la espiga que entra en col-2
  if (t.id === 'col-2') return [c.x1 - c.x0, c.y1 - c.y0, c.z1 - c.z0];
  return [c.x1 - c.x0, c.y1 - c.y0, c.z1 - c.z0];
}
export function uniones(): Union[] {
  const h = clearance(PERFIL_K1);
  return [
    { id: 'U1', tipo: 'cola-de-milano', entre: ['base-fi', 'base-fd'], n: 2, holgura: h, nota: 'x = 0: dos llaves de rompecabezas en los 4 mm del piso (y −80, −20)' },
    { id: 'U2', tipo: 'cola-de-milano', entre: ['base-ti', 'base-td'], n: 2, holgura: h, nota: 'x = 0: y 90, 130 (detrás de y 150 el pie de la columna las une)' },
    { id: 'U3', tipo: 'cola-de-milano', entre: ['base-fi', 'base-ti'], n: 2, holgura: h, nota: 'y = 40: x −120, −60' },
    { id: 'U4', tipo: 'cola-de-milano', entre: ['base-fd', 'base-td'], n: 2, holgura: h, nota: 'y = 40: x 60, 120' },
    { id: 'U5', tipo: 'cola-de-milano', entre: ['cub-fi', 'cub-fd'], n: 1, holgura: h, nota: 'x = −20 en la franja del frente (desfasada de la base: traba de ladrillo)' },
    { id: 'U6', tipo: 'cola-de-milano', entre: ['cub-ti', 'cub-td'], n: 1, holgura: h, nota: 'x = −20, y 120' },
    { id: 'U7', tipo: 'cola-de-milano', entre: ['cub-fd', 'cub-td'], n: 2, holgura: h, nota: 'y = 40 en la franja derecha (x 120, 138); cub-fi y cub-ti sólo se tocan en la pared: los sujetan sus ganchos' },
    { id: 'U8', tipo: 'cola-de-milano', entre: ['col-1', 'base-ti'], n: 1, holgura: h, nota: 'pie de la columna: carril vertical en x = −55 (55 mm, entra de arriba)' },
    { id: 'U9', tipo: 'cola-de-milano', entre: ['col-1', 'base-td'], n: 1, holgura: h, nota: 'pie de la columna: carril vertical en x = +55' },
    { id: 'U10', tipo: 'espiga', entre: ['col-1', 'col-2'], n: 2, holgura: h, nota: 'dos espigas 10×8×25 a los lados del riel; el riel del módulo A cruza la junta y la alinea' },
    { id: 'U11', tipo: 'broche', entre: ['cub-fi', 'base-fi'], n: 20, holgura: 0, nota: 'cubierta a la base: ganchos con diente en ventanas de las paredes de frente y atrás (se quita para mantenimiento)' },
    { id: 'U12', tipo: 'cola-de-milano', entre: ['ducto-i', 'ducto-d'], n: 2, holgura: h, nota: 'x = −14 en el piso de la charola; la charola cuelga de sus alas en el bolsillo de la cubierta' },
    { id: 'U13', tipo: 'broche', entre: ['col-1', 'col-2'], n: 4, holgura: 0, nota: 'R2: 4 grapas sueltas (broche col-col) en rebajes de las caras laterales, sobre la junta de z 140' },
    { id: 'U14', tipo: 'broche', entre: ['ducto-i', 'cub-ti'], n: 8, holgura: 0, nota: 'R2: 8 remaches de broche (broche ducto-cub) por el ala de la charola y la piel de la cubierta' },
    { id: 'U15', tipo: 'espiga', entre: ['campana', 'cub-ti'], n: 2, holgura: h, nota: 'R2: la campana entra con dos espigas de 4 × 4 en la cubierta y su cola empuja contra la cara de la columna (el extractor la jala hacia allá)' },
    { id: 'U16', tipo: 'broche', entre: ['tapa-columna', 'col-2'], n: 3, holgura: 0, nota: 'R2: las tres faldas de la tapa de arriba con su diente (broche tapa-col)' },
  ];
}
/** cola de milano: trapecio de la ranura (boca, fondo, prof) y su lengüeta (menos la holgura) */
export const COLA = { boca: 10, fondo: 14, prof: 6, alto: 16 };

// ════════════════════════════════════════════════════════════════════════════════════════════
// 7. ESTRUCTURA (viga, PETG entre capas, SF ≥ 2)
// ════════════════════════════════════════════════════════════════════════════════════════════
const g0 = 9.81;
/** momento de inercia de la sección de la columna alrededor de x (flexión en el plano y-z), con su eje neutro */
export function seccionColumna() {
  // R2: la sección peor es el PIE a la altura del humo (z ≈ 0): la garganta (86 de ancho, y 149…165) y el paso
  // (58 de ancho hasta atrás) se comen el centro; quedan dos patas. Rectángulos (x0,x1,y0,y1, signo).
  const g = HUMO.garganta, p = HUMO.paso;
  const r: [number, number, number, number, number][] = [
    [COL.x0, COL.x1, COL.y0, COL.y1, 1],
    [g.x0, g.x1, COL.y0, g.y1, -1],
    [p.x0, p.x1, p.y0, COL.y1, -1],
    [-53, -37, 186, 204, -1], [26, 50, 172, 228, -1],   // zonas de los canales que suben (K06 a la izquierda; K07/K08 a la derecha)
  ];
  let A = 0, Sy = 0;
  for (const [x0, x1, y0, y1, s] of r) { const a = (x1 - x0) * (y1 - y0) * s; A += a; Sy += a * (y0 + y1) / 2; }
  const yc = Sy / A;
  let I = 0;
  for (const [x0, x1, y0, y1, s] of r) { const b = x1 - x0, h = y1 - y0; I += s * (b * h ** 3 / 12 + b * h * ((y0 + y1) / 2 - yc) ** 2); }
  const c = Math.max(yc - COL.y0, COL.y1 - yc);
  return { A, I, yc, c };
}
export function estructura(masaA = 1.5) {
  const W_A = masaA * g0, e = 190, dinamico = 2;
  const M = W_A * e * dinamico;                                    // N·mm en el pie
  const sc = seccionColumna(), sigma = (M * sc.c) / sc.I;
  const adm = PETG.tension * PETG.capaZ;                           // la columna se imprime de pie: flexión ⟂ capas
  const Fh = (W_A * e) / (RIEL.z1 - RIEL.z0);                      // par del riel (arriba jala, abajo empuja)
  const Mjunta = Fh * (RIEL.z1 - Z_COL) * dinamico;
  // dos espigas de 10 × 8 × 25 separadas 56 mm: el par se vuelve fuerza de aplastamiento en sus caras (8 × 25)
  const Fesp = Mjunta / 56, sigEsp = Fesp / (8 * 25 / 2);
  // pie: dos carriles de cola de milano de 55 mm (z −75…−20) con cuello de 6 mm reciben el par
  const brazo = (2 / 3) * (Z_CUB.z0 - COL_PIE_Z), F = M / brazo, tauPie = F / (2 * (Z_CUB.z0 - COL_PIE_Z) * 6);
  const ktPie = notchKt(6, 3);                                     // cuello de la cola con filete de 3 mm
  // cubierta: la tira lateral (50 × 8 de sección, 300 de claro) carga la mesa + la mano
  const masaMesa = (150 * 150 * 6 * ACERO.rho + 160 * 160 * 6 * ALUMINIO.rho + 4 * 140 * 20 * 3 * COBRE.rho) * 1e-9;
  const Wmesa = (masaMesa * g0 + 50) * dinamico;
  const Mcub = (Wmesa / 4) * 300 / 8, sigCub = (6 * Mcub) / (50 * 8 * 8);
  // postes de silicato (compresión)
  const sigPoste = Wmesa / MESA_G.postes.n / (Math.PI * (MESA_G.postes.d / 2) ** 2);
  // el piso sobre la mesa de trabajo de ian: la LRS en apoyo directo
  const presLRS = (2.0 * g0) / (235 * 124);
  // flecha del pie: la punta se baja θ·e con θ = M·L/(E·I) (sin factor dinámico)
  const theta = (W_A * e * (RIEL.z0 - COL_PIE_Z)) / (PETG.E * sc.I);
  return {
    M, sigma, adm, SFcol: adm / sigma, sc, Mjunta, sigEsp, SFesp: adm / sigEsp,
    tauPie, ktPie, SFpie: (PETG.cortante * PETG.capaZ) / (tauPie * ktPie),
    masaMesa, Wmesa, sigCub, SFcub: PETG.tension / sigCub,
    sigPoste, SFposte: SILICATO.compresion / sigPoste, presLRS,
    flechaPunta: theta * e,
    filete: { pie: filletRadiusForKt(6, 2.0), kt3: ktPie },
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 8. AIRE DE LA CAJA, EL DIFUSOR Y EL HUMO (campana + extractor)
// ════════════════════════════════════════════════════════════════════════════════════════════
// ── EL DIFUSOR (bahía DIFUSOR, R2 P8): impreso, PETG (aire de la caja a 40 °C) ─────────────────
/**
 * El ventilador de 80 (y −80…0, z −110…−30, cara de salida en x −121) sopla a +x. El difusor lleva el chorro a la cara
 * del disipador de C (125 × 35 × 35, aletas a −x; placa.ts R2: x −95…−60, y −99…26, z −105.7…−70.7) DENTRO de su bahía
 * (x −121…−96, y −100…10): se abre en y a −98…8 (toda la bahía menos sus paredes) y baja el techo a 45° de z −30 a −55
 * (el chorro de arriba ya no se va por encima del disipador). Brida de entrada con la ventana de 80 × 80; dos patas al
 * piso. Entre su boca (x −96) y las aletas queda 1 mm de aire (placa.ts HOLGURA_DIFUSOR): el PETG no toca el aluminio.
 */
export const DIFUSOR_G = {
  x0: DIF.x0, x1: DIF.x1, t: 2,
  entrada: { y0: -80, y1: 0, z0: -110, z1: -30 },
  salida: { y0: DIF.y0 + 2, y1: DIF.y1 - 2, z0: -110, z1: -55 },
  disipadorC: { y0: -98.5, y1: 26.5, z0: -105.7, z1: -70.7, x0: -95, x1: -60.01, fuente: 'placa.ts DISIPADOR (agente C, ronda 2: 0.8 mm de juego contra el tope)' },
};
/**
 * LA CUNA DEL DISIPADOR DE C (orquestador R2: el PETG no toca el aluminio). El disipador se apoya en la PCB de C (FR4 sin
 * cobre debajo, 130 °C) y lo sujetan Q1 y D1 atornillados; B lo detiene:
 *   · al frente, con un TOPE DE SILICATO (de la placa de 25 mm de D1) en la franja de B entre la pared y la bahía de C
 *     (y −106…−100); su cara llega a y −99.3, 0.7 mm dentro del margen de 1 mm que C dejó para las guías de B
 *     (placa.ts MARGEN_BAHIA), con 0.8 mm de juego contra el disipador (y −98.5). Lo carga un bolsillo de PETG en la pared.
 *   · hacia −x, con la boca del difusor a 1 mm de aire.
 * El PETG se juzga con el disipador a 90 °C (lo que deja el termostato TS1): 1D por el silicato, la pared de 4 mm y el aire
 * del cuarto por fuera (lo más caliente: el tope pegado al aluminio, sin el juego).
 */
export const CUNA_HS = {
  tope: caja(-92, INTERIOR.y0, -104, -63, -99.3, -74),
  bolsillo: { pared: 2 },
  Ths: 90,
};
export function cunaDisipador() {
  const t = CUNA_HS.tope, e = (t.y1 - t.y0) / 1000, Ta = MESA_TERMICA.Tin;
  const Rsil = e / SILICATO.k((CUNA_HS.Ths + 60) / 2), Rpared = (PARED / 1000) / PETG.k, Rfuera = 1 / 10;
  const Tpetg = Ta + ((CUNA_HS.Ths - Ta) * (Rpared + Rfuera)) / (Rsil + Rpared + Rfuera);
  // la cara de la pared que ve el frente del disipador por la capa de aire de 7 mm (conducción + radiación con Al ε 0.1)
  const gAire = AIRE.k / ((t.y1 - INTERIOR.y0) / 1000) + 4 * (1 / (1 / ALUMINIO.eps + 1 / PETG.eps - 1)) * SIGMA * (CUNA_HS.Ths + 273.15) ** 3;
  const Tvista = Ta + ((CUNA_HS.Ths - Ta) * (Rpared + Rfuera)) / (1 / gAire + Rpared + Rfuera);
  // la boca del difusor (PETG) a 1 mm de las puntas de las aletas: por ese hueco pasa el chorro de 40 °C (no es aire quieto);
  // le llega radiación del Al (ε 0.1) y la lava el chorro (h ≈ 30 W/m²K, SUPUESTO)
  const hChorro = 30, epsAP = 1 / (1 / ALUMINIO.eps + 1 / PETG.eps - 1);
  const Tboca = MESA_TERMICA.Tcaja + (epsAP * SIGMA * ((CUNA_HS.Ths + 273.15) ** 4 - (MESA_TERMICA.Tcaja + 273.15) ** 4)) / hChorro;
  return { Tpetg, Tvista, Tboca, Rsil, espesor: t.y1 - t.y0, juego: DIFUSOR_G.disipadorC.y0 - t.y1, enMargenC: bahia('PLACA_PCB').caja.y0 - t.y1 };
}
/** qué tanto del largo y de la altura del disipador de C ve la salida del difusor (ronda 1: 78 de 125 mm a lo largo) */
export function cubreDifusor() {
  const s = DIFUSOR_G.salida, hs = DIFUSOR_G.disipadorC;
  const largo = Math.max(0, Math.min(s.y1, hs.y1) - Math.max(s.y0, hs.y0)) / (hs.y1 - hs.y0);
  const alto = Math.max(0, Math.min(s.z1, hs.z1) - Math.max(s.z0, hs.z0)) / (hs.z1 - hs.z0);
  return { largo, alto, invadeBahia: Math.max(0, DIF.x1 - hs.x0) };
}

// ── EL HUMO: Dalla Valle + la curva del extractor + las pérdidas, tramo por tramo ───────────────
/** Idelchik (diagrama 3-4): entrada con borde redondeado al ras de una pared, ζ contra r/Dh (sobre la velocidad de adentro) */
export const IDELCHIK_REDONDO: [number, number][] = [[0, 0.5], [0.01, 0.43], [0.02, 0.36], [0.03, 0.31], [0.04, 0.26], [0.05, 0.22], [0.06, 0.2], [0.08, 0.15], [0.12, 0.09], [0.16, 0.06], [0.2, 0.03]];
export const interpTabla = (t: [number, number][], x: number) => {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const [a, fa] = t[i - 1], [b, fb] = t[i]; return fa + ((x - a) / (b - a)) * (fb - fa); }
  return t[t.length - 1][1];
};
export const zetaBordeRedondo = (rDh: number) => interpTabla(IDELCHIK_REDONDO, rDh);
/** borde de lámina delgada que sobresale (re-entrante; Idelchik, δ/D → 0): ζ ≈ 1.0 */
export const ZETA_LAMINA = 1.0;
/** Borda–Carnot (ensanche brusco): ζ = (1 − A1/A2)² sobre la velocidad de antes */
export const zetaEnsanche = (A1: number, A2: number) => (A2 > A1 ? (1 - A1 / A2) ** 2 : 0);
/** contracción brusca (Idelchik, forma de Weisbach): ζ = 0.5·(1 − A2/A1)^0.75 sobre la velocidad de después */
export const zetaContraccion = (A1: number, A2: number) => (A2 < A1 ? 0.5 * (1 - A2 / A1) ** 0.75 : 0);
/** codo de 90° (Idelchik 6-1, B1): ζ = 0.21/(R0/b)^2.5 con R0/b < 1, 0.21/√(R0/b) con R0/b ≥ 1; a escuadra (R0/b < 0.5) 1.2 */
export const zetaCodo = (R0b: number) => (R0b < 0.5 ? 1.2 : R0b < 1 ? 0.21 / R0b ** 2.5 : 0.21 / Math.sqrt(R0b));
/** Darcy: Blasius (turbulento) o 64/Re (laminar) */
export const fDarcy = (v: number, Dh: number) => { const Re = (v * Dh) / AIRE.nu; return Re < 2300 ? 64 / Math.max(Re, 1) : 0.316 * Re ** -0.25; };
/** Dalla Valle (ACGIH): Q = k·V·(10·X² + A) → V = Q/(k·(10·X² + A)); boca con pestaña k = 0.75 */
export const dallaValle = (Q: number, X: number, A: number, k = 0.75) => Q / (k * (10 * X * X + A));
export const ARCO: V3 = [0, 0, 1];
/** radios de los labios de la embocadura: arriba (HUMO.labio), derecha, e izquierda sólo de z 0 para arriba (abajo pasa K05) */
export const LABIOS = { arriba: HUMO.labio, derecha: 6, izquierda: 6, izquierdaDesdeZ: 0 };
/** difusor suave (Gibson): ζ = k·(1 − A1/A2)², k ≈ 0.25 para un ángulo total de ~12° (0.16 a 10°, 0.27 a 15°) */
export const K_DIFUSOR = 0.25;

export interface TramoHumo { tramo: string; Pa: number; formula: string }
/**
 * El camino del humo como una cadena de pérdidas (todas ∝ Q²) contra la curva del extractor (lineal, SUPUESTO EXTRACTOR):
 *   1. boca: labios enrollados (Idelchik, borde redondeado al ras: ζ(r/Dh)) arriba, a la derecha y a la izquierda sobre K05;
 *      abajo de z 0 a la izquierda pasa K05 → lámina re-entrante (ζ 1.0). ζ de la boca = promedio pesado por largo de borde
 *      (el piso es la cubierta: no hay borde). Sobre la velocidad de la garganta que dejan los labios.
 *   2. ensanche de esa garganta a la embocadura (Borda) y contracción a la campana de PETG (Weisbach)
 *   3. campana → paso del pie (ensanche, Borda) → collar en gota → manguera (Borda)
 *   4. fricción de Darcy en cada tramo; manguera de 3 m con 2 codos y la salida (SUPUESTO MANGUERA)
 * La alterna es la ronda 1: collar a z ≈ 300 con el ducto subiendo por la columna (2 codos de 90°: abajo R0/b 0.5, arriba
 * con la tapa redondeada R0/b 0.75).
 */
export function humo() {
  const mm2 = 1e-6, h = HUMO, L = LABIOS;
  const bx = h.boca.x1 - h.boca.x0, bz = h.boca.z1 - h.boca.z0;
  const A_boca = bx * bz * mm2;
  // la garganta tras la bocina: x −44…38, z −12…15 (el lado izquierdo es la lámina recta: su labio de z 0 para arriba
  // sólo redondea el canto, no angosta)
  const e = h.embocadura, gx = e.gx1 - e.gx0, gz = e.gz1 - h.boca.z0;
  const ladoIzqArriba = Math.max(0, e.gz1 - L.izquierdaDesdeZ), ladoIzqAbajo = gz - ladoIzqArriba;
  const A_gar = gx * gz * mm2;
  const Dh_gar = (2 * gx * gz) / (gx + gz);
  const bordes = [
    { largo: bx, z: zetaBordeRedondo(L.arriba / Dh_gar), donde: 'arriba' },
    { largo: gz, z: zetaBordeRedondo(L.derecha / Dh_gar), donde: 'derecha' },
    { largo: ladoIzqArriba, z: zetaBordeRedondo(L.izquierda / Dh_gar), donde: 'izquierda arriba' },
    { largo: ladoIzqAbajo, z: ZETA_LAMINA, donde: 'izquierda abajo (K05)' },
  ];
  const zBoca = bordes.reduce((s, b) => s + b.largo * b.z, 0) / bordes.reduce((s, b) => s + b.largo, 0);
  const cu = h.cuerpo, A_cue = (cu.x1 - cu.x0) * (cu.z1 - cu.z0) * mm2;
  const p = h.paso, wP = p.x1 - p.x0, A_paso = (wP * (p.z1 - p.z0) + (wP / 2) ** 2) * mm2;
  const r = COLLAR.rInt / 1000, A_col = Math.PI * r * r + r * r * (1 - Math.PI / 4);
  const A_man = Math.PI * 0.05 ** 2;
  const Dh = (A: number, P: number) => (4 * A) / P;
  const tramosF = [
    { n: 'embocadura', A: A_gar, Dh: Dh_gar / 1000, L: (h.embocadura.y1 - h.embocadura.y0) / 1000 },
    { n: 'campana', A: (A_gar + A_cue) / 2, Dh: Dh(A_cue, 2 * (cu.x1 - cu.x0 + cu.z1 - cu.z0) * 1e-3), L: (cu.y1 - cu.y0) / 1000 },
    { n: 'garganta y paso', A: A_paso, Dh: Dh(A_paso, (2 * wP + 2 * (p.z1 - p.z0) + 2 * Math.SQRT2 * wP / 2) * 1e-3), L: (p.y1 - h.garganta.y0) / 1000 },
  ];
  const fMan = 0.03, Lman = 3, codosMan = 2 * 0.3, salida = 1.0;
  const cadena = (Q: number): TramoHumo[] => {
    const t: TramoHumo[] = [
      { tramo: 'boca (labios)', Pa: zBoca * din(Q, A_gar), formula: `ζ ${zBoca.toFixed(3)} (Idelchik r/Dh, pesado por borde) sobre ${(A_gar / mm2).toFixed(0)} mm²` },
      { tramo: 'difusor de la campana', Pa: K_DIFUSOR * zetaEnsanche(A_gar, A_cue) * din(Q, A_gar), formula: `Gibson k ${K_DIFUSOR}·(1 − ${(A_gar / A_cue).toFixed(2)})² (2θ ≈ 12°)` },
      { tramo: 'campana → paso del pie', Pa: zetaEnsanche(A_cue, A_paso) * din(Q, A_cue), formula: 'Borda' },
      { tramo: 'paso → collar', Pa: zetaEnsanche(A_paso, A_col) * din(Q, A_paso), formula: `Borda (1 − ${(A_paso / A_col).toFixed(2)})²` },
      { tramo: 'collar → manguera', Pa: zetaEnsanche(A_col, A_man) * din(Q, A_col), formula: 'Borda' },
      ...tramosF.map((s) => ({ tramo: `fricción ${s.n}`, Pa: fDarcy(Q / s.A, s.Dh) * (s.L / s.Dh) * din(Q, s.A), formula: 'Darcy–Blasius' })),
      { tramo: 'manguera 3 m + 2 codos + salida', Pa: (fMan * Lman / 0.1 + codosMan + salida) * din(Q, A_man), formula: 'SUPUESTO MANGUERA' },
    ];
    return t;
  };
  const sis = (Q: number) => cadena(Q).reduce((s, t) => s + t.Pa, 0);
  const op = puntoOperacion(EXTRACTOR, sis);
  const cBoca: V3 = [(h.boca.x0 + h.boca.x1) / 2, CAMP.y0, (h.boca.z0 + h.boca.z1) / 2];
  const X = Math.hypot(cBoca[0] - ARCO[0], cBoca[1] - ARCO[1], cBoca[2] - ARCO[2]) / 1000;
  const vCaptura = dallaValle(op.Q, X, A_boca);
  const Qnecesita = REGLAS.capturaHumoMin * 0.75 * (10 * X * X + A_boca);
  // la alterna (ronda 1): el humo sube por la columna a un collar a z ≈ 300 → dos codos de 90° en un ducto de 58 × 63
  const A_duc = 0.058 * 0.063, Dh_duc = (2 * 0.058 * 0.063) / (0.058 + 0.063);
  const sisAlt = (Q: number) => sis(Q) - zetaEnsanche(A_cue, A_paso) * din(Q, A_cue) - zetaEnsanche(A_paso, A_col) * din(Q, A_paso)
    + (zetaCodo(0.5) + zetaCodo(0.75)) * din(Q, A_duc) + fDarcy(Q / A_duc, Dh_duc) * (0.30 / Dh_duc) * din(Q, A_duc) + zetaEnsanche(A_duc, A_col) * din(Q, A_duc);
  const opAlt = puntoOperacion(EXTRACTOR, sisAlt);
  return {
    A_boca, A_garganta: A_gar, bordes, zBoca, X, Q: op.Q, m3h: op.Q * 3600, dP: op.dP, vCaptura, Qnecesita, m3hNecesita: Qnecesita * 3600,
    vBoca: op.Q / A_gar, vPaso: op.Q / A_paso, cadena: cadena(op.Q),
    alterna: { m3h: opAlt.Q * 3600, vCaptura: dallaValle(opAlt.Q, X, A_boca), nota: 'collar a z ≈ 300 con el ducto por la columna: codo abajo ζ 1.2 (R0/b 0.5) + codo arriba ζ 0.43 (R0/b 0.75)' },
  };
}
/**
 * ¿LA CAMPANA APARTA LA PLUMA ANTES DEL ZÓCALO DEL CUELLO DE A? (pregunta de A para K14: supuso 80 %, necesita ≥ 60 %).
 * Dalla Valle da la VELOCIDAD de captura en el arco, no una fracción. Lo que sí se puede contar con los mismos números:
 *   · la pluma sube (Heskestad, centro): u0 = 1.0·Qc^⅓·z^−⅓ (kW, m), con los 84 W convectivos de A (40 A × 21 V × 0.10);
 *     tarda t = ∫dz/u0 = ¾·z^{4/3}/Qc^{1/3} en llegar al fondo de A (z 24: el zócalo del cuello, 23 mm sobre el arco)
 *   · en ese tiempo la campana la corre δ = V·t hacia +y (V de Dalla Valle en el arco)
 *   · la pluma es gaussiana de ancho b = 0.12·z (Heskestad); la fracción que ya NO pega en el zócalo (la bahía LANZA,
 *     ±14 mm) es la parte de la gaussiana corrida δ que cae fuera de ese cuadrado.
 * Lo que la campana se lleva después (lo que se abre bajo el fondo de A y corre hacia la boca) ya no protege al zócalo.
 */
export function plumaCampana(vCaptura: number) {
  const Qc = (ARCO_RAD.I * ARCO_RAD.V * 0.10) / 1000, z = (bahia('ALAMBRE').caja.z0 - ARCO[2]) / 1000;
  const t = (0.75 * z ** (4 / 3)) / Qc ** (1 / 3), u0 = Qc ** (1 / 3) * z ** (-1 / 3);
  const delta = vCaptura * t * 1000, b = 0.12 * z * 1000, L = bahia('LANZA').caja, N = 120;
  let dentro = 0, total = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = -4 * b - 20 + ((i + 0.5) * (8 * b + 40)) / N, y = -4 * b - 20 + ((j + 0.5) * (8 * b + 40)) / N;
    const w = Math.exp(-((x * x + (y - delta) ** 2) / (b * b)));
    total += w; if (x >= L.x0 && x <= L.x1 && y >= L.y0 && y <= L.y1) dentro += w;
  }
  return { Qc_W: Qc * 1000, subida_mm: z * 1000, t_ms: t * 1000, u0, delta, b, fueraDelZocalo: 1 - dentro / total };
}
/** h por convección forzada sobre una cara a lo largo del flujo (placa plana, Incropera: laminar 0.664·Re^½·Pr^⅓,
 *  turbulento 0.037·Re^0.8·Pr^⅓ sobre el largo L) */
export function hPlaca(v: number, L: number) {
  const Re = (v * L) / AIRE.nu, Pr3 = AIRE.Pr ** (1 / 3);
  const Nu = Re < 5e5 ? 0.664 * Math.sqrt(Re) * Pr3 : 0.037 * Re ** 0.8 * Pr3;
  return (Nu * AIRE.k) / L;
}
/** el arco como fuente puntual (SUPUESTO ARCO_RAD): W/m² que llegan a una cara (p, n) */
export const ARCO_RAD = { I: 40, V: 21, fRad: 0.15, alfaPETG: 0.9, hSup: 15 };
export function qArco(p: V3, n: V3) {
  const r: V3 = [ARCO[0] - p[0], ARCO[1] - p[1], ARCO[2] - p[2]], d = Math.hypot(...r) / 1000;
  const cos = (n[0] * r[0] + n[1] * r[1] + n[2] * r[2]) / (d * 1000);
  return cos <= 0 ? 0 : ((ARCO_RAD.fRad * ARCO_RAD.I * ARCO_RAD.V) / (4 * Math.PI * d * d)) * cos;
}
/** la mesa a T: su cara de arriba (150 × 150) y su canto del frente que da a la campana (150 × 6 en y 75) */
export function qMesa(p: V3, n: V3, T: number, Ta = 30) {
  const arriba = vistaRect(p, n, { c: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], a: 150, b: 150, nR: [0, 0, 1] });
  const canto = p[1] > 75 ? vistaRect(p, n, { c: [0, 75, -3], u: [1, 0, 0], v: [0, 0, 1], a: 150, b: 6, nR: [0, 1, 0] }) : 0;
  const F = arriba + canto;
  return { F, q: F * ACERO.eps * PETG.eps * SIGMA * ((T + 273.15) ** 4 - (Ta + 273.15) ** 4) };
}
export const ESCUDO_AL = { alfa: 0.15, eps: 0.1, gap: 2, kAire: 0.026 };
/**
 * La campana frente al arco y a la mesa a 300 °C. Cada cara: lo que le llega (arco puntual + mesa) y con qué h se enfría
 * (por fuera 15 W/m²K; por dentro, la placa plana con la velocidad del humo). Si el PETG pasara de 70 °C, esa cara es de
 * aluminio (la embocadura): α 0.15, y el PETG de detrás ve la lámina tibia (el escudo de A: hueco de aire de 2 mm).
 */
export function termicaCampana(Tmesa: number, hm: ReturnType<typeof humo>) {
  const Ta = MESA_TERMICA.Tin, hIn = hPlaca(hm.vBoca, (HUMO.cuerpo.y1 - CAMP.y0) / 1000) + 4 * PETG.eps * SIGMA * (Ta + 273.15) ** 3;
  const caras: { donde: string; p: V3; n: V3; h: number; material: 'PETG' | 'aluminio' }[] = [
    { donde: 'labio de arriba de la boca (cara al arco)', p: [0, CAMP.y0, HUMO.boca.z1 - 3], n: [0, -1, 0], h: ARCO_RAD.hSup, material: 'PETG' },
    { donde: 'labio de la derecha de la boca', p: [HUMO.boca.x1 - 3, CAMP.y0, 5], n: [0, -1, 0], h: ARCO_RAD.hSup, material: 'PETG' },
    { donde: 'techo de la campana por dentro (y 120)', p: [0, HUMO.cuerpo.y0 + 2, HUMO.embocadura.gz1 + (2 / (HUMO.cuerpo.y1 - HUMO.cuerpo.y0)) * (HUMO.cuerpo.z1 - HUMO.embocadura.gz1)], n: [0, 0, -1], h: hIn, material: 'PETG' },
    { donde: 'lado izquierdo de la campana por dentro (y 120)', p: [HUMO.cuerpo.x0, HUMO.cuerpo.y0 + 2, 5], n: [1, 0, 0], h: hIn, material: 'PETG' },
    { donde: 'cubierta bajo la campana (y 120)', p: [0, HUMO.cuerpo.y0 + 2, Z_CUB.z1], n: [0, 0, 1], h: hIn, material: 'PETG' },
    { donde: 'cubierta entre la mesa y la campana (y 94)', p: [20, 94, Z_CUB.z1], n: [0, 0, 1], h: ARCO_RAD.hSup, material: 'PETG' },
  ];
  return caras.map((c) => {
    const qa = qArco(c.p, c.n), qm = qMesa(c.p, c.n, Tmesa, Ta), qT = qa + qm.q;
    const Tpetg = Ta + (ARCO_RAD.alfaPETG * qT) / c.h;
    if (Tpetg <= PETG.tUso) return { ...c, qArco: qa, F: qm.F, qMesa: qm.q, TsiPETG: Tpetg, T: Tpetg, material: 'PETG' as const };
    const gGap = ESCUDO_AL.kAire / (ESCUDO_AL.gap / 1000) + 4 * ESCUDO_AL.eps * SIGMA * (Ta + 273.15) ** 3;
    const dTsh = (ESCUDO_AL.alfa * qT) / (c.h + gGap);
    return { ...c, qArco: qa, F: qm.F, qMesa: qm.q, TsiPETG: Tpetg, Tal: Ta + dTsh, T: Ta + (dTsh * gGap) / (gGap + c.h), material: 'aluminio' as const };
  });
}

export function aire() {
  // C: entra por la pared izquierda (rejilla del ventilador 80×80, φ 0.6), el difusor la junta a 88 × 55 sobre el
  // disipador, cruza la placa y sale por el frente derecho (52×50) y la pared derecha atrás (22×88).
  // Pérdida interna de la placa: K 1.5 sobre 80×80 (ronda 1).
  const s = DIFUSOR_G.salida, Asal = ((s.y1 - s.y0) * (s.z1 - s.z0)) * 1e-6, Aent = 0.080 * 0.080;
  const sisPCB = (Q: number) => kRejilla(0.6) * din(Q, Aent) + zetaContraccion(Aent, Asal) * din(Q, Asal) + 1.5 * din(Q, Aent) + 1.0 * din(Q, 0.040 * 0.060) + kRejilla(0.6) * din(Q, 0.052 * 0.050);
  const pcb = puntoOperacion(VENT_PCB, sisPCB), pcbR1 = puntoOperacion(VENT_PCB_R1, sisPCB);
  const P_PCB = 40;   // SUPUESTO: pérdidas de la placa de C (Q1 + D1 + choque + shunt); C da el número real
  // LRS: sale por la pared derecha frente a sus ventiladores (116 × 36, φ 0.6); entra por atrás (2 rejillas 50×36 y 65×36)
  const sisLRS = (Q: number) => kRejilla(0.6) * din(Q, 0.116 * 0.036) + kRejilla(0.6) * din(Q, (0.050 + 0.065) * 0.036);
  const lrs = puntoOperacion(VENT_LRS, sisLRS);
  const hm = humo();
  return {
    difusor: { ...cubreDifusor(), salida: s, contraccion: zetaContraccion(Aent, Asal) },
    pcb: { ...pcb, P: P_PCB, dT: P_PCB / (AIRE.rho * AIRE.cp * Math.max(pcb.Q, 1e-6)), m3h: pcb.Q * 3600, r1: { m3h: pcbR1.Q * 3600, dP: pcbR1.dP, dT: P_PCB / (AIRE.rho * AIRE.cp * Math.max(pcbR1.Q, 1e-6)) } },
    lrs: { ...lrs, fraccionPmax: sisLRS(VENT_LRS.Qmax * 0.8) / VENT_LRS.Pmax, P: 90, dT: 90 / (AIRE.rho * AIRE.cp * Math.max(lrs.Q, 1e-6)) },
    extractor: { Q: hm.Q, dP: hm.dP, m3h: hm.m3h, vCaptura: hm.vCaptura, vDucto: hm.vPaso, X: hm.X },
    humo: hm, pluma: plumaCampana(hm.vCaptura),
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 9. EL DISEÑO COMPLETO
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface Peine { conexion: string; pos: V3; dir: V3; ranuras: number; ancho: number; tipo: 'peine' | 'abrazadera' | 'broche'; aPuerto: number }
export interface Canal { conexion: Conexion; ruta: Ruta; largo: number; dobleces: number; radios: number[]; Rdisp: number; tapas: number; ranuras: number; peines: Peine[] }
export interface Pedido { id: string; conexion?: string; reglas: string[]; texto: string }
/** una pieza impresa SUELTA (no es teja): tapa de canal, grapa, remache, tapa de la columna, difusor, campana */
export interface PiezaImpresa {
  id: string; nombre: string; grupo: 'tapa' | 'grapa' | 'remache' | 'tapa-columna' | 'difusor' | 'campana';
  cama: string;              // la cama de la K1 donde se imprime (varias piezas por cama: un STL y un FMSH por cama)
  ops: OpSolido[];           // marco del doc, en su lugar (sumas − restas)
  abajo: V3;                 // la cara del doc que va contra la cama
  soportes: string;
  broche?: { L: number; h: number; y: number };   // sus patas (ε = 1.5·y·h/L²)
  canal?: string;
}
export interface Acomodo { id: string; dx: number; dy: number; caja: [number, number, number] }
export interface Cama { id: string; piezas: string[]; url: string; stl: string; acomodo: Acomodo[]; caja: [number, number, number] }
export interface AireK05 {
  puntos: V3[]; curva: { p: V3; s: number; T: number }[]; h: number; lambda: number; largo: number; Tcanal: number;
  manga: number; silla: Caja | null; holguras: { donde: string; mm: number; T: number; material: 'PETG' | 'aluminio' | 'silicato' }[]; nota: string;
}
export interface DisenoCuerpo {
  canales: Canal[]; tejas: Teja[]; uniones: Union[]; broches: Broche[];
  piezas: PiezaImpresa[]; camas: Cama[];
  mesa: {
    aletas: Aletas; barrido: ReturnType<typeof elegirAletas>['filas']; Nmin: number; Tlo: number;
    control: PuntoControl[]; peor: EstadoMesa; fuga: { conVentilador: number; sinVentilador: number }; piso: ReturnType<typeof pisoDucto>; esparcimiento: ReturnType<typeof esparcimiento>;
    tau: number; petg: { donde: string; T: number; nota: string }[]; vecinos: { donde: string; T: number; nota: string }[]; marco: { T: number; largoCaliente: number; nota: string };
    termostato: ReturnType<typeof termostatoMesa>;
  };
  estructura: ReturnType<typeof estructura>; aire: ReturnType<typeof aire>;
  campana: ReturnType<typeof termicaCampana>;
  cuna: ReturnType<typeof cunaDisipador>;
  k05: AireK05 | null;
  lazo: { areaCm2: number; sepMax: number; nota: string } | null;
  ventanas: { id: string; c: Caja; nota: string }[];
  ops: Record<string, OpSolido[]>;
  pedidos: Pedido[];
  supuestos: Supuesto[];
}
/** orden de ruteo: potencia gruesa primero (necesita espacio); K05 justo después de K06 (va pegado a él); la señal al final */
export const ORDEN_RUTEO = ['K06', 'K05', 'K07', 'K08', 'K04', 'K02', 'K03', 'K01', 'K10'];   // K06 y K05 a mano; K14 va en el canal de K08
/** R2: el netlist entero es del contrato (K11, K12 y K13 ya están ahí) */
export function todasLasConexiones(): Conexion[] { return [...CONEXIONES]; }
/**
 * K06 y K05 A MANO (el A* pide 2R entre cualquier par de vueltas y no ve que dos S seguidas sólo piden R·sen θ de cada
 * lado). Cambian de lado entre C (K05 a la izquierda, x −40; K06 en x −20) y la columna (K06 sube pegado a la cara
 * izquierda en x −45, a la izquierda del paso del humo; K05 sube por el paso en x −30): se CRUZAN. K06 sube a z −55 y K05
 * baja a −69.5 (lo que pide su U: zc = z + 2R ≤ 12 bajo el techo de la campana): 14.5 entre ejes, las paredes de los
 * canales se juntan y quedan 4 mm de PETG entre los cobres. Lejos del cruce van a 15 en x y 14.5 en z: 20.8 entre ejes
 * (REGLAS.lazoArco ≤ 25). Cada tramo recto da lo que piden sus vueltas: S en z de 5 (K06) y 9.5 (K05): R·sen θ = 14.2 y
 * 19.0; S en x de 25 (K06) y 10 (K05): 29.3 y 19.5; la esquina para subir: R = 40.8.
 */
export const RUTAS_MANO: Record<string, V3[]> = {
  K06: [[-20, 48, -60], [-20, 64, -60], [-20, 64, -55], [-20, 115, -55], [-45, 115, -55], [-45, 195, -55], [-45, 195, 125], [-40, 195, 125], [-40, 195, 210], [-40, 150, 210]],
  K05: [[-40, 48, -60], [-40, 70, -60], [-40, 70, -69.5], [-40, 110, -69.5], [-30, 110, -69.5], [-30, 190, -69.5], [-30, 190, HUMO.paso.z0]],
};
/** K09 es puente (contrato R2): los hilos de fábrica del ventilador corren por su travesaño, salen por su lado +y y llegan
 *  al pad de C; un peine (poste del piso) los sujeta a 9 mm de la soldadura */
export const PUENTE_K09: V3[] = [[-119, 20, -50], [-128, 20, -50], [-128, 6, -50], [-128, 6, -70], [-128, -40, -70], [-121, -40, -70]];
export const PEINE_K09: V3 = [-128, 20, -50];

/** el abierto de cada tramo: hacia el cuarto, lejos de la superficie a la que se pega */
export function aberturaTramo(a: V3, b: V3): V3 {
  const d = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1]), Math.sign(b[2] - a[2])];
  const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const enCol = dentroCaja(m[0], m[1], m[2], COLUMNA);
  const cands: { n: V3; dist: number }[] = enCol
    ? [{ n: [1, 0, 0], dist: m[0] - COL.x0 }, { n: [-1, 0, 0], dist: COL.x1 - m[0] }, { n: [0, 1, 0], dist: 999 }, { n: [0, -1, 0], dist: COL.y1 - m[1] }]
    : [{ n: [0, 0, 1], dist: m[2] - INTERIOR.z0 }, { n: [0, 0, -1], dist: INTERIOR.z1 - m[2] }, { n: [1, 0, 0], dist: m[0] - INTERIOR.x0 },
       { n: [-1, 0, 0], dist: INTERIOR.x1 - m[0] }, { n: [0, 1, 0], dist: m[1] - INTERIOR.y0 }, { n: [0, -1, 0], dist: INTERIOR.y1 - m[1] }];
  // en la columna los canales abren HACIA AFUERA (tapa en la cara exterior): se invierte
  const ok = cands.filter((c) => c.n[0] * d[0] + c.n[1] * d[1] + c.n[2] * d[2] === 0).sort((p, q) => p.dist - q.dist);
  const n = ok[0]?.n ?? [0, 0, 1];
  return enCol ? [-n[0], -n[1], -n[2]] as V3 : n;
}

/**
 * EL TRAMO AL AIRE DE K05 (contrato: «K05 hace su tramo al aire dentro de la CAMPANA»). Su canal sube por el pie de la
 * columna y entrega el cable en K05.AIRE (piso del paso del humo). De ahí al MARCO el cobre va al aire, en el humo:
 *   K05.AIRE → sube hasta zc → corre a −y por el paso, la garganta y la campana → S oblicua (−20 en x, −(zc + 9) en z)
 *   → llega a la oreja del marco a +y.
 * Con R = 6·Ø: la U de abajo (canal a +y, sube, regresa a −y) pide una vertical ≥ 2R → zc ≥ z_b + 2R; la S consume
 * R·sen θ de cada recta vecina (θ = acos(1 − m/2R)); la esquina de arriba consume R. La S va lo más cerca del marco que
 * se puede (el cable se despega pronto de la cubierta).
 * El cobre es una aleta (T − Ta = (Tm − Ta)·e^(−s/λ), λ = √(k·A/(h·P))) con h de la placa plana a la velocidad de la
 * campana + radiación (SUPUESTO H_CABLE). Donde pasa de 70 °C no puede tocar PETG: holgura ≥ 2 mm, o va sobre la SILLA de
 * silicato (la cubierta lleva un hueco con un taco de silicato bajo el cable) o junto a la lámina de la embocadura.
 */
export function tramoAireK05(canal: V3[], Tm: number, hm: ReturnType<typeof humo>): AireK05 {
  const c = CONEXIONES.find((q) => q.id === 'K05')!, sec = seccionCanal(c), R = sec.Rmin, rc = sec.od / 2;
  // el canal llega por abajo a K05.AIRE (z −70) y sube por su tubo hasta el piso del paso (z −20); el cobre empieza a
  // doblarse 10 mm antes de salir (pa): así la esquina de arriba no se sale del tubo
  const zb = K05_AIRE.pos[2], pa: V3 = [K05_AIRE.pos[0], K05_AIRE.pos[1], HUMO.paso.z0 - 10], pm = puerto('MARCO').pos;
  void canal;
  const zc = Math.max(zb + 2 * R, pa[2] + R);
  const m = Math.hypot(pa[0] - pm[0], zc - pm[2]), th = m < 2 * R ? Math.acos(1 - m / (2 * R)) : Math.PI / 2, u = R * Math.sin(th);
  const ys = pm[1] + u + 0.5;
  const puntos: V3[] = [pa, [pa[0], pa[1], zc], [pa[0], ys, zc], [pm[0], ys, pm[2]], pm];
  // la curva de verdad: recta vertical, cuarto de círculo arriba, recta a −y, dos arcos de la S, recta a la oreja
  const curva: V3[] = [];
  const arco = (c0: V3, e1: V3, e2: V3, a0: number, a1: number, n = 12) => { for (let i = 0; i <= n; i++) { const t = a0 + ((a1 - a0) * i) / n; curva.push([c0[0] + R * (Math.cos(t) * e1[0] + Math.sin(t) * e2[0]), c0[1] + R * (Math.cos(t) * e1[1] + Math.sin(t) * e2[1]), c0[2] + R * (Math.cos(t) * e1[2] + Math.sin(t) * e2[2])]); } };
  const recta = (a: V3, b: V3) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(L / 2)); for (let i = 0; i <= n; i++) curva.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, a[2] + ((b[2] - a[2]) * i) / n]); };
  recta(pa, [pa[0], pa[1], zc - R]);
  arco([pa[0], pa[1] - R, zc - R], [0, 1, 0], [0, 0, 1], 0, Math.PI / 2);   // de subir a ir a −y
  const s0: V3 = [pa[0], ys + u, zc], s1: V3 = [pm[0], ys - u, pm[2]];
  recta([pa[0], pa[1] - R, zc], s0);
  const nl: V3 = [(pm[0] - pa[0]) / m, 0, (pm[2] - zc) / m];                  // hacia dónde se corre la S
  const c1: V3 = [s0[0] + nl[0] * R, s0[1], s0[2] + nl[2] * R];
  arco(c1, [-nl[0], 0, -nl[2]], [0, -1, 0], 0, th);
  const c2: V3 = [s1[0] - nl[0] * R, s1[1], s1[2] - nl[2] * R];
  const mitad = curva.length; arco(c2, [nl[0], 0, nl[2]], [0, 1, 0], 0, th); const seg = curva.splice(mitad).reverse(); curva.push(...seg);
  recta(s1, pm);
  // del MARCO hacia atrás: s
  curva.reverse();
  const conS: { p: V3; s: number }[] = []; let s = 0;
  for (let i = 0; i < curva.length; i++) { if (i) s += Math.hypot(curva[i][0] - curva[i - 1][0], curva[i][1] - curva[i - 1][1], curva[i][2] - curva[i - 1][2]); conS.push({ p: curva[i], s }); }
  const largoAire = s;
  // la aleta de cobre: h de la placa plana con la velocidad media de la campana + radiación linealizada a 150 °C
  const vCamp = hm.Q / (((HUMO.cuerpo.x1 - HUMO.cuerpo.x0) * (HUMO.cuerpo.z1 - HUMO.cuerpo.z0)) * 1e-6);
  const h = hPlaca(vCamp, largoAire / 1000) + 4 * 0.9 * SIGMA * (150 + 273.15) ** 3;
  const Ta = MESA_TERMICA.Tin, mCu = Math.sqrt((h * Math.PI * sec.od / 1000) / (COBRE.k * OD_AWG[8].mm2 * 1e-6)), lambda = 1000 / mCu;
  const T = (x: number) => Ta + (Tm - Ta) * Math.exp(-x / lambda);
  const curvaT = conS.map((q) => ({ ...q, T: T(q.s) }));
  const manga = Math.max(0, lambda * Math.log((Tm - Ta) / (180 - Ta)));
  // la silla de silicato: donde el cable caliente baja a < 2 mm de la cubierta (y ≥ 91: antes está la tira de silicato)
  const bajo = curvaT.filter((q) => q.T > PETG.tUso && q.p[2] - rc - Z_CUB.z1 < 2 && q.p[1] >= 91);
  const silla: Caja | null = bajo.length ? caja(Math.min(...bajo.map((q) => q.p[0])) - 11, 91, Z_CUB.z0, Math.max(...bajo.map((q) => q.p[0])) + 11, Math.max(...bajo.map((q) => q.p[1])) + 4, Z_CUB.z1) : null;
  // holguras contra lo que hay alrededor, mientras el cobre pase de 70 °C
  const hol = new Map<string, { donde: string; mm: number; T: number; material: 'PETG' | 'aluminio' | 'silicato' }>();
  const anota = (donde: string, mm: number, Tq: number, material: 'PETG' | 'aluminio' | 'silicato') => { const v = hol.get(donde); if (!v || mm < v.mm) hol.set(donde, { donde, mm, T: Tq, material }); };
  const e = HUMO.embocadura, cu = HUMO.cuerpo, ga = HUMO.garganta, pa2 = HUMO.paso;
  for (const q of curvaT) {
    if (q.T <= PETG.tUso) continue;
    const [x, y, z] = q.p;
    if (z < HUMO.paso.z0 && Math.abs(y - pa[1]) < 2) continue;   // todavía en su tubo
    if (y >= 92 && y <= CAMP.y1) {
      const enSilla = silla && x >= silla.x0 && x <= silla.x1 && y >= silla.y0 && y <= silla.y1;
      anota(enSilla ? 'silla de silicato bajo K05' : 'cubierta (piso de la campana)', z - rc - Z_CUB.z1, q.T, enSilla ? 'silicato' : 'PETG');
    }
    if (y >= e.y0 && y < e.y1) { anota('embocadura de Al: lado izquierdo', x - rc - e.gx0, q.T, 'aluminio'); anota('embocadura de Al: techo', e.gz1 - (z + rc), q.T, 'aluminio'); }
    if (y >= cu.y0 && y <= cu.y1) {
      const f = (y - cu.y0) / (cu.y1 - cu.y0);
      anota('campana: lado izquierdo', x - rc - cu.x0, q.T, 'PETG');
      anota('campana: techo', e.gz1 + f * (cu.z1 - e.gz1) - (z + rc), q.T, 'PETG');
    }
    if (y > ga.y0 && y <= pa2.y1) {
      anota('garganta y paso: piso', z - rc - (y < ga.y1 ? ga.z0 : pa2.z0), q.T, 'PETG');
      anota('garganta y paso: lado', x - rc - (y < ga.y1 + 14 ? ga.x0 : pa2.x0), q.T, 'PETG');
    }
  }
  // donde el cobre entra a su tubo de PETG: la boca del tubo en el piso del paso
  const boca = curvaT.find((q) => q.s > 0 && q.p[2] <= HUMO.paso.z0 && Math.abs(q.p[1] - pa[1]) < 2) ?? curvaT[curvaT.length - 1];
  return {
    puntos, curva: curvaT, h, lambda, largo: boca.s, Tcanal: boca.T, manga, silla, holguras: [...hol.values()],
    nota: `${boca.s.toFixed(0)} mm al aire (λ ${lambda.toFixed(0)} mm con h ${h.toFixed(0)} W/m²K): ${Tm.toFixed(0)} °C en la oreja → ${boca.T.toFixed(0)} °C donde entra a su tubo; manga de vidrio los primeros ${manga.toFixed(0)} mm`,
  };
}
/** la separación más grande entre K05 y K06 (eje a eje) de C al pie de la columna: cada punto de una a la otra polilínea */
export function sepLazo(a: V3[], b: V3[], hasta = (p: V3) => p[1] < COL.y0) {
  const muestras = (p: V3[]) => { const o: V3[] = []; for (let s = 0; s + 1 < p.length; s++) { const L = Math.hypot(p[s + 1][0] - p[s][0], p[s + 1][1] - p[s][1], p[s + 1][2] - p[s][2]), n = Math.max(1, Math.ceil(L / 2.5)); for (let i = 0; i <= n; i++) o.push([p[s][0] + (p[s + 1][0] - p[s][0]) * i / n, p[s][1] + (p[s + 1][1] - p[s][1]) * i / n, p[s][2] + (p[s + 1][2] - p[s][2]) * i / n]); } return o; };
  const aDist = (q: V3, p: V3[]) => { let m = Infinity; for (let s = 0; s + 1 < p.length; s++) { const A = p[s], B = p[s + 1], d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2; const t = L2 ? Math.max(0, Math.min(1, ((q[0] - A[0]) * d[0] + (q[1] - A[1]) * d[1] + (q[2] - A[2]) * d[2]) / L2)) : 0; m = Math.min(m, Math.hypot(q[0] - A[0] - d[0] * t, q[1] - A[1] - d[1] * t, q[2] - A[2] - d[2] * t)); } return m; };
  // cada polilínea hasta que entra a la columna (de su puerto en C en adelante)
  const corta = (p: V3[]) => { const m = muestras(p), i = m.findIndex((q) => !hasta(q)); return i < 0 ? m : m.slice(0, i); };
  const A = corta(a), B = corta(b);
  let mx = 0;
  for (const q of A) mx = Math.max(mx, aDist(q, b));
  for (const q of B) mx = Math.max(mx, aDist(q, a));
  return mx;
}

export function disenarCuerpo(): DisenoCuerpo {
  // ── la mesa ────────────────────────────────────────────────────────────────
  const sel = elegirAletas(), al = sel.elegida.al, Nmin = nMinimoSeguro(al);
  const control = sel.elegida.control;
  // el punto de diseño del PETG: la mesa SOSTENIDA en la máxima temperatura pedida (300 °C), en su punto de control
  const p300 = control[control.length - 1];
  const peor = estadoMesa(p300.d, p300.N, al);
  // la fuga: el firmware se cuelga con el arco prendido (a ventilador a tope y con el ventilador muerto)
  const fuga = { conVentilador: estadoMesa(1, 1, al).T, sinVentilador: estadoMesa(1, 0.02, al).T };
  const ch = petgCharola(peor, al), piso = ch.piso;
  const esp = esparcimiento();
  const Cth = 0.150 * 0.150 * 0.006 * ACERO.rho * ACERO.cp + (0.160 * 0.160 * 0.006 + (al.alto ? Math.floor(144 / al.paso) * 0.160 * al.alto * al.t * 1e-6 : 0)) * ALUMINIO.rho * ALUMINIO.cp;
  const tau = Cth / (peor.G + (MESA_TERMICA.Qtop(peor.T + 1) - MESA_TERMICA.Qtop(peor.T)));
  const Tm = peor.T;
  // PETG ≤ 70: donde el calor de la mesa toca impreso
  const poste = ch.Wposte;
  const tira = aletaSilicato(Tm, MESA_G.tira.ancho - 1, 160, MESA_G.tira.t, 15);
  const mord = aletaSilicato(Tm, 20, 12, 12, 12);
  const Fmord = vistaRect([75, 99, 13], [0, 0, -1], { c: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], a: 150, b: 150, nR: [0, 0, 1] });
  const mordRad = petgQueVe(Fmord, Tm, ACERO.eps);
  // el borde de la cubierta (z −12, a 17 mm del canto de la placa) mira el canto de 6 mm de la placa
  const Fborde = vistaRect([0, -92, -12], [0, 0, 1], { c: [0, -75, -3], u: [1, 0, 0], v: [0, 0, 1], a: 150, b: 6, nR: [0, -1, 0] });
  const bordeRad = petgQueVe(Fborde, Tm, ACERO.eps);
  // el escape de la mesa: la corriente de las aletas sin mezclar pega en el techo de la cámara izquierda. Va un FORRO
  // de lámina de aluminio (comprado/cortado) separado 4 mm del PETG, con el aire frío de la derivación corriendo
  // por detrás: el PETG ve aire a T_in + 5 y la radiación Al (0.05) → cinta de Al (0.05).
  const epsAlAl = 1 / (1 / 0.05 + 1 / 0.05 - 1), Tgap = MESA_TERMICA.Tin + 5;
  const qForro = epsAlAl * SIGMA * ((peor.Tfin + 273.15) ** 4 - (Tgap + 273.15) ** 4);
  const Tforro = Tgap + qForro / (10 + 1 / (0.002 / PETG.k + 1 / 10));
  // el aire y el humo (la campana se juzga contra el arco y la mesa a 300 °C)
  const air = aire(), campana = termicaCampana(Tm, air.humo);
  const termostato = termostatoMesa(peor, al);
  const petg = [
    { donde: 'piso del ducto bajo el bloque', T: piso.Tmax, nota: `aire ${piso.h.toFixed(0)} W/m²K + radiación con cinta de Al` },
    { donde: 'repisa bajo cada poste (arandela de Al 20×40 en el aire lateral)', T: piso.TaSale + poste * R_BASE_POSTE, nota: `${(poste * 1000).toFixed(0)} mW por poste` },
    { donde: 'apoyo de la tira de silicato en la cubierta', T: tira.T, nota: `la tira decae en ${tira.decae.toFixed(1)} mm` },
    { donde: 'diente de cada mordaza sobre el taco de silicato (20 mm del canto)', T: mord.T, nota: `el taco decae en ${mord.decae.toFixed(1)} mm` },
    { donde: 'brazo de la mordaza (lo que ve de la placa)', T: mordRad.T, nota: `F = ${Fmord.toFixed(3)}` },
    { donde: 'borde de la cubierta junto a la placa', T: bordeRad.T, nota: `F = ${Fborde.toFixed(3)}` },
    { donde: 'escape mezclado (pared y rejilla izquierda)', T: peor.Tex, nota: `${(peor.Q * 3600).toFixed(0)} m³/h` },
    { donde: 'techo de la cámara izquierda (forro de Al a 4 mm, aire de la derivación detrás)', T: Tforro, nota: `aire de las aletas a ${peor.Tfin.toFixed(0)} °C` },
    ...campana.map((q) => ({ donde: `campana: ${q.donde}${q.material === 'aluminio' ? ' (detrás de la embocadura de Al)' : ''}`, T: q.T, nota: `arco ${q.qArco.toFixed(0)} W/m² + mesa ${q.qMesa.toFixed(0)} W/m² (F ${q.F.toFixed(3)}); si fuera PETG desnudo: ${q.TsiPETG.toFixed(0)} °C` })),
    { donde: 'piso del ducto bajo el termostato', T: termostato.Tnormal, nota: `el termostato abre a ${MESA_G.termostato.abre} ± ${MESA_G.termostato.tol} °C` },
  ];
  // para los vecinos (no es PETG de B, pero la mesa se los calienta): la cara de abajo del módulo A (z 24) sobre la placa
  const Fa = vistaRect([0, 0, 24], [0, 0, -1], { c: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], a: 150, b: 150, nR: [0, 0, 1] });
  const vecinos = [{ donde: 'cara de abajo del módulo A (z 24, encima del arco)', T: petgQueVe(Fa, Tm, ACERO.eps).T, nota: `F = ${Fa.toFixed(2)}: A necesita escudo (lámina de Al con aire) o PETG lejos` }];

  // ── el ruteo (una conexión que no se puede es una ruta 'sin-ruta' con su porqué: el juez la marca) ─────────
  const ctx: Ctx = { rutas: [], enRuta: new Map() };
  const conex = todasLasConexiones();
  const rutas = new Map<string, Ruta>();
  for (const id of ORDEN_RUTEO) {
    const c = conex.find((q) => q.id === id);
    if (!c || c.puente || COMPARTEN[id]) continue;
    let r: Ruta;
    if (RUTAS_MANO[id]) {
      const pts = RUTAS_MANO[id];
      r = { id, puntos: pts.map((q) => [...q] as V3), seccion: seccionDe(c), clase: CLASE[c.funcion], modo: 'astar', expansiones: 0, costo: largo(pts), nota: 'a mano: las S encadenadas del cruce K05/K06' };
    } else r = rutear(c, ctx);
    rutas.set(id, r);
    if (r.modo === 'astar') { ctx.rutas.push(r); ctx.enRuta.set(r.id, id === 'K05' ? [extremos(c)[0], K05_AIRE.id] : extremos(c)); }
  }
  // las que viajan en el canal de otra: la misma ruta (y la misma sección, que ya cuenta sus hilos)
  for (const [id, host] of Object.entries(COMPARTEN)) {
    const r = rutas.get(host);
    if (r && conex.some((q) => q.id === id)) rutas.set(id, { ...r, id, puntos: r.puntos.map((q) => [...q] as V3), compartido: host, nota: `en el canal de ${host} (${r.seccion.w}×${r.seccion.d}, llenado ${(r.seccion.llenado * 100).toFixed(0)} % con los dos)` });
  }
  for (const [id, pts] of Object.entries(RUTAS_DUCTO)) {
    const c = conex.find((q) => q.id === id);
    if (!c) continue;
    rutas.set(id, { id, puntos: pts, seccion: seccionDe(c), clase: CLASE[c.funcion], modo: 'ducto', expansiones: 0, costo: largo(pts), nota: 'en el aire frío de la entrada del ducto de la mesa, con broches de la charola' });
  }
  for (const c of conex.filter((q) => q.puente)) {
    const pts: V3[] = c.id === 'K09' ? PUENTE_K09 : [puertoO(c.de)?.pos ?? [0, 0, 0], puertoO(c.a)?.pos ?? [0, 0, 0]];
    rutas.set(c.id, { id: c.id, puntos: pts, seccion: seccionCanal(c), clase: CLASE[c.funcion], modo: 'directo', expansiones: 0, costo: largo(pts), nota: 'puente (contrato): los hilos de fábrica soldados al pad, sin canal; un peine los sujeta' });
  }
  // K05: su canal (A*) + su tramo al aire hasta el marco
  let k05: AireK05 | null = null;
  const r5 = rutas.get('K05');
  if (r5 && r5.modo === 'astar') {
    k05 = tramoAireK05(r5.puntos, Tm, air.humo);
    r5.canalPts = r5.puntos;
    r5.puntos = simplificar([...r5.puntos, ...k05.puntos.slice(1)]);   // sin el punto colineal de la unión (no es esquina)
    r5.nota = `canal de C.OUTP a K05.AIRE + ${k05.largo.toFixed(0)} mm al aire en el humo hasta el MARCO`;
  }
  const marco = { T: Tm, largoCaliente: k05 ? k05.lambda * Math.log((Tm - MESA_TERMICA.Tin) / (PETG.tUso - MESA_TERMICA.Tin)) : aletaCable(OD_AWG[8].od, OD_AWG[8].mm2, 20, Tm).largo,
    nota: k05 ? `el cobre del cal 8 decae en ${k05.lambda.toFixed(0)} mm en el aire de la campana (h ${k05.h.toFixed(0)} W/m²K); oreja con Silfos (D4)` : 'K05 sin ruta' };

  const canales: Canal[] = [];
  for (const c of conex) {
    const r = rutas.get(c.id) ?? sinRuta(c, `no está en ORDEN_RUTEO, ni en RUTAS_DUCTO, ni es puente: nadie la rutea`);
    const pc = r.canalPts ?? r.puntos;
    const radios = r.puntos.length > 2 ? radiosDeDoblez(r.puntos) : [];
    const Lc = r.puntos.length > 1 ? largo(r.puntos) : 0;
    const peines: Peine[] = [];
    // un peine junto a cada puerto (alivio de la soldadura). Cal 8 y 10: ABRAZADERA a ≤ 15 mm de la isla soldada
    // (agente C: a 58–83 °C el estaño fluye si carga peso; la abrazadera carga, la soldadura no). En el ducto: broches.
    // K05: el extremo del marco es la oreja con Silfos (no estaño): su abrazadera va donde el canal entrega al aire.
    if ((r.modo === 'astar' || r.modo === 'ducto') && pc.length >= 2) for (const [p, q] of [[pc[0], pc[1]], [pc[pc.length - 1], pc[pc.length - 2]]] as [V3, V3][]) {
      const dv = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], L = Math.hypot(...dv) || 1;
      const t = Math.min(c.awg <= 10 ? 10 : 12, L / 2);
      peines.push({ conexion: c.id, pos: [p[0] + dv[0] / L * t, p[1] + dv[1] / L * t, p[2] + dv[2] / L * t], dir: [dv[0] / L, dv[1] / L, dv[2] / L], ranuras: c.hilos.length, ancho: r.seccion.w,
        tipo: r.modo === 'ducto' ? 'broche' : c.awg <= 10 ? 'abrazadera' : 'peine', aPuerto: t });
    }
    if (r.modo === 'directo' && c.id === 'K09') peines.push({ conexion: c.id, pos: PEINE_K09, dir: [1, 0, 0], ranuras: 2, ancho: 2.6, tipo: 'peine', aPuerto: 9 });
    const Rdisp = r.puntos.length > 2 ? radioDisponible(r.puntos, (i) => enAbanico(c, r.puntos[i])) : Infinity;
    canales.push({ conexion: c, ruta: r, largo: Lc, dobleces: radios.length, radios, Rdisp, tapas: 0, ranuras: 0, peines });
  }

  // ── el lazo del arco (K05 real + marco + placa + arco + módulo A + K06 + placa C) ────────────────────────
  const k06 = rutas.get('K06');
  let lazo: DisenoCuerpo['lazo'] = null;
  if (k06 && k06.modo === 'astar' && r5 && r5.modo === 'astar') {
    const pts: V3[] = [...r5.puntos, [0, 0, 0], [0, 0, 14], ...[...k06.puntos].reverse()];
    lazo = { areaCm2: areaVectorial(pts) / 100, sepMax: sepLazo(r5.canalPts ?? r5.puntos, k06.puntos),
      nota: 'K05 por su ruta real (canal + aire) → marco → centro de la placa → arco 14 mm → adentro de A en recta (SUPUESTO) → K06 → adentro de C 20 mm' };
  }

  const d: DisenoCuerpo = {
    canales, tejas: tejas(), uniones: uniones(), broches: BROCHES, piezas: [], camas: [],
    mesa: { aletas: al, barrido: sel.filas, Nmin, Tlo: sel.elegida.Tlo, control, peor, fuga, piso, esparcimiento: esp, tau, petg, vecinos, marco, termostato },
    estructura: estructura(), aire: air, campana, cuna: cunaDisipador(), k05, lazo,
    ventanas: ventanas(),
    ops: {}, pedidos: PEDIDOS, supuestos: SUPUESTOS,
  };
  const { porTeja, piezas } = opsSolidos(d);
  d.ops = porTeja;
  d.piezas = piezas;
  for (const c of d.canales) {
    c.tapas = piezas.filter((p) => p.grupo === 'tapa' && p.canal === (c.ruta.compartido ?? c.conexion.id)).length;
  }
  d.camas = acomodarCamas(piezas);
  return d;
}
/** área vectorial de un lazo cerrado: ½·|Σ pᵢ × pᵢ₊₁| (mm²) */
export function areaVectorial(p: V3[]): number {
  let ax = 0, ay = 0, az = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    ax += a[1] * b[2] - a[2] * b[1]; ay += a[2] * b[0] - a[0] * b[2]; az += a[0] * b[1] - a[1] * b[0];
  }
  return 0.5 * Math.hypot(ax, ay, az);
}
export function ventanas() {
  const usb = puerto('C.USB').pos, pot = puerto('A.POT').pos, sen = puerto('A.SEN').pos;
  const wPot = RIEL.ventanas.find((v) => v.puerto === 'A.POT')!, wSen = RIEL.ventanas.find((v) => v.puerto === 'A.SEN')!;
  return [
    { id: 'USB', c: caja(usb[0] - 8, BASE.y0 - 1, usb[2] - 5, usb[0] + 8, BASE.y0 + PARED + 1, usb[2] + 5), nota: '16 × 10 en el frente (USB-C con su funda)' },
    { id: 'IEC', c: caja(IEC_CUERPO.x0, BASE.y1 - PARED - 1, IEC_CUERPO.z0, IEC_CUERPO.x1, BASE.y1 + 1, IEC_CUERPO.z1), nota: '28 × 45 en la pared de atrás nueva (y 230; C14 con interruptor y fusible)' },
    { id: 'PARO', c: caja(110 - 11.25, -85 - 11.25, Z_CUB.z0 - 1, 110 + 11.25, -85 + 11.25, Z_CUB.z1 + 1), nota: 'Ø22.5 en la cubierta (hongo de 22 mm)' },
    { id: 'A.POT', c: caja(pot[0] - wPot.ancho / 2, COL.y0 - 1, pot[2] - wPot.alto / 2, pot[0] + wPot.ancho / 2, 162, pot[2] + wPot.alto / 2), nota: `${wPot.ancho} × ${wPot.alto} (contrato) en z ${pot[2]}, techo a 45°` },
    { id: 'A.SEN', c: caja(sen[0] - wSen.ancho / 2, COL.y0 - 1, sen[2] - wSen.alto / 2, sen[0] + wSen.ancho / 2, 162, sen[2] + wSen.alto / 2), nota: `${wSen.ancho} × ${wSen.alto} (contrato), techo a 45°` },
  ];
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 10. LOS PEDIDOS (CAMBIO DE CONTRATO PEDIDO, con números)
// ════════════════════════════════════════════════════════════════════════════════════════════
// Los 8 de la ronda 1 entraron todos al contrato v2 (CAMBIOS_R2 P1–P8). Los dos de la ronda 2 también: P9 (MESA.TERM
// acostado en (45, −60, −22) +x, clase KSD9700) y P10 (nota de la COLUMNA: collar a z ≈ 10). No queda ninguno abierto.
export const PEDIDOS: Pedido[] = [];

// ════════════════════════════════════════════════════════════════════════════════════════════
// 11. LOS SÓLIDOS (operaciones que el script de OCCT ejecuta por teja)
// ════════════════════════════════════════════════════════════════════════════════════════════
// Cada operación lleva una etiqueta: B base · C cubierta · D charola del ducto · K columna · M mordazas, o el id de
// UNA teja (las colas de milano: el macho de una teja, la hembra de la otra). `libre` = no se recorta con la caja de
// la teja (la lengüeta que entra en la vecina). `canal` = la columna también la toma (el canal entra al pie).
// El script hace, por teja: (Σ sumas recortadas a su caja ∪ sumas libres) − Σ restas.
const op = (o: OpSolido, tag: string, extra: { libre?: boolean; canal?: boolean } = {}): OpSolido => ({ ...o, tag, ...extra });
const sumaCaja = (c: Caja, nota?: string): OpSolido => ({ t: 'caja', s: 1, c, nota, tag: '' });
const restaCaja = (c: Caja, nota?: string): OpSolido => ({ t: 'caja', s: -1, c, nota, tag: '' });
const cajaOp = (o: OpSolido): Caja => {
  if (o.t === 'caja') return o.c;
  if (o.t === 'codo') { const R = o.r1 + o.h; return caja(o.centro[0] - R, o.centro[1] - R, o.centro[2] - R, o.centro[0] + R, o.centro[1] + R, o.centro[2] + R); }
  const us = o.pts.map((p) => p[0]), vs = o.pts.map((p) => p[1]);
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  const [a, b] = [Math.min(o.desde, o.hasta), Math.max(o.desde, o.hasta)];
  if (o.plano === 'XY') return caja(u0, v0, a, u1, v1, b);
  if (o.plano === 'YZ') return caja(a, u0, v0, b, u1, v1);
  return caja(u0, a, v0, u1, b, v1);
};
export const cajaDeOp = cajaOp;
const intersecta = (a: Caja, b: Caja) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0 && a.z0 < b.z1 && a.z1 > b.z0;
/** rejilla de ranuras verticales de 3 mm a paso 5 (φ ≈ 0.6) que atraviesan una pared */
function rejilla(normal: 'x' | 'y', cara: number, u0: number, u1: number, z0: number, z1: number, nota: string): OpSolido[] {
  const o: OpSolido[] = [];
  for (let u = u0 + 1.5; u + 1.5 <= u1; u += 5) {
    o.push(normal === 'x'
      ? restaCaja(caja(cara - PARED - 1, u - 1.5, z0, cara + PARED + 1, u + 1.5, z1), nota)
      : restaCaja(caja(u - 1.5, cara - PARED - 1, z0, u + 1.5, cara + PARED + 1, z1), nota));
  }
  return o;
}
/** ventana con techo a 45° (pentágono) en una pared vertical: imprime de pie sin soporte */
function ventanaGablete(u0: number, u1: number, z0: number, z1: number, desde: number, hasta: number, nota: string): OpSolido {
  const um = (u0 + u1) / 2, pico = z1 + (u1 - u0) / 2;
  return { t: 'prisma', s: -1, plano: 'XZ', pts: [[u0, z0], [u1, z0], [u1, z1], [um, pico], [u0, z1]], desde, hasta, nota, tag: '' };
}
/** perfil de gota (como dfm.teardrop): círculo con pico a 45° arriba → el agujero horizontal se imprime sin soporte */
function gota(cu: number, cv: number, r: number, n = 40): [number, number][] {
  // con v hacia ARRIBA (z): el arco va de 45° a −225° pasando por abajo y el pico cierra arriba a 45°
  // (dfm.teardrop trabaja con y de pantalla; copiado tal cual, el polígono se cruza y el kernel lo tira)
  const p: [number, number][] = [];
  const a0 = Math.PI / 4, a1 = -(5 * Math.PI) / 4;
  for (let i = 0; i <= n; i++) { const a = a0 - ((a0 - a1) * i) / n; p.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]); }
  p.push([cu, cv + r * Math.SQRT2]);
  return p;
}
/** cola de milano en el plano XY (llave de rompecabezas): macho en `de`, hembra con holgura en `a`. Cruza el plano eje=pos. */
function colaMilano(eje: 'x' | 'y', pos: number, centro: number, haciaPositivo: boolean, z0: number, z1: number, de: string, a: string): OpSolido[] {
  const c = clearance(PERFIL_K1) / 2, s = haciaPositivo ? 1 : -1, { boca, fondo, prof } = COLA;
  const tr = (b: number, f: number, p0: number, p1: number): [number, number][] => eje === 'x'
    ? [[pos + s * p0, centro - b / 2], [pos + s * p0, centro + b / 2], [pos + s * p1, centro + f / 2], [pos + s * p1, centro - f / 2]]
    : [[centro - b / 2, pos + s * p0], [centro + b / 2, pos + s * p0], [centro + f / 2, pos + s * p1], [centro - f / 2, pos + s * p1]];
  return [
    { t: 'prisma', s: 1, plano: 'XY', pts: tr(boca, fondo, -0.5, prof), desde: z0, hasta: z1, nota: `cola ${de}→${a}`, tag: de, libre: true },
    { t: 'prisma', s: -1, plano: 'XY', pts: tr(boca + 2 * c, fondo + 2 * c, -0.01, prof + c), desde: z0 - 0.5, hasta: z1 + 0.5, nota: `hembra ${de}→${a}`, tag: a },
  ];
}
/** holgura por lado de lo que entra en su ranura o rebaje: la mitad de dfm.clearance (PETG en la K1) */
const HOL_LADO = () => clearance(PERFIL_K1) / 2;
const cajaDe = (lo: V3, hi: V3): Caja => caja(Math.min(lo[0], hi[0]), Math.min(lo[1], hi[1]), Math.min(lo[2], hi[2]), Math.max(lo[0], hi[0]), Math.max(lo[1], hi[1]), Math.max(lo[2], hi[2]));
/**
 * LAS TAPAS de una ranura de canal (R2, REGLAS.todoImprimible: piezas impresas, no números). Llenan la ranura a ras de
 * la cara, en tiras ≤ 120 mm con 0.4 entre tiras y la holgura de dfm por lado. Cada tira lleva un par de patas cada
 * 60 mm: una tira de 0.8 a lo largo del canal colgada de una raíz de 2 mm, con un diente al final que entra 0.4 bajo el
 * labio de 0.6 de la ranura (BROCHES 'tapa': ε = 1.5·y·h/L²). Ranuras < 14 mm no llevan tapa (el canal va cerrado).
 *   eje: a lo largo · k: eje de la abertura (signo sn) · a0..a1: la ranura a lo largo · cT: su centro transversal ·
 *   hwR: su medio ancho · fIn: cara de adentro (la del hueco) · fOut: la cara de afuera
 */
function tapasRanura(canal: string, n0: number, eje: number, k: number, sn: number, a0: number, a1: number, cT: number, hwR: number, fIn: number, fOut: number): PiezaImpresa[] {
  const out: PiezaImpresa[] = [];
  const c = HOL_LADO(), aw = 3 - eje - k, b = BROCHES.find((x) => x.id === 'tapa')!;
  const largoTot = a1 - a0 - 2 * c;
  if (largoTot < 14) return out;
  const n = Math.ceil(largoTot / 120), paso = (largoTot + 0.4) / n;
  const P = (vEje: number, vAw: number, vK: number): V3 => { const p: V3 = [0, 0, 0]; p[eje] = vEje; p[aw] = vAw; p[k] = vK; return p; };
  for (let i = 0; i < n; i++) {
    const s0 = a0 + c + i * paso, s1 = s0 + paso - 0.4, Lp = s1 - s0;
    const ops: OpSolido[] = [{ ...sumaCaja(cajaDe(P(s0, cT - hwR + c, fIn), P(s1, cT + hwR - c, fOut)), `tapa ${canal}`), tag: 'T' }];
    const pares = Math.max(1, Math.round(Lp / 60)), L = Math.min(b.L, Lp / pares - 4);
    if (L >= 5) for (let j = 0; j < pares; j++) {
      const r0 = s0 + (j + 0.5) * (Lp / pares) - L / 2;
      for (const lado of [-1, 1]) {
        const e = cT + lado * (hwR - c), t0 = e - lado * b.h;
        ops.push({ ...sumaCaja(cajaDe(P(r0, t0, fIn), P(r0 + 2, e, fIn - sn * 1.5)), 'raíz de la pata'), tag: 'T' });
        ops.push({ ...sumaCaja(cajaDe(P(r0, t0, fIn - sn * 0.3), P(r0 + L, e, fIn - sn * 1.5)), 'pata'), tag: 'T' });
        ops.push({ ...sumaCaja(cajaDe(P(r0 + L - 2, e, fIn - sn * 0.3), P(r0 + L, e + lado * (b.y + c), fIn - sn * 1.5)), 'diente'), tag: 'T' });
      }
    }
    const ab: V3 = [0, 0, 0]; ab[k] = sn;
    out.push({ id: `tapa-${canal}-${n0 + out.length + 1}`, nombre: `Tapa ${canal} · ${Lp.toFixed(0)} mm`, grupo: 'tapa', cama: `tapas-${canal}`, ops, abajo: ab, canal,
      broche: L >= 5 ? { L, h: b.h, y: b.y } : undefined, soportes: 'acostada, la cara de afuera en la cama: patas y dientes crecen hacia arriba; sin soporte' });
  }
  return out;
}
/** la cara de afuera de la columna hacia donde abre un tramo (en la columna las ranuras llegan hasta la cara) */
const caraColumna = (k: number, sn: number) => (k === 0 ? (sn > 0 ? COL.x1 : COL.x0) : k === 1 ? (sn > 0 ? COL.y1 : COL.y0) : sn > 0 ? COL.z1 : COL.z0);
/** el canal de una ruta: cuerpo (sección + paredes) y hueco (sección), abierto hacia su tapa; codos CERRADOS con su radio
 *  (R2: el cable se empuja por el codo, la sección le sobra ×2.5) y las tapas de cada tramo recto como piezas */
function opsCanal(r: Ruta, peines: Peine[] = []): { ops: OpSolido[]; tapas: PiezaImpresa[] } {
  const o: OpSolido[] = [], tapas: PiezaImpresa[] = [];
  const p = r.canalPts ?? r.puntos, sec = r.seccion, R = sec.Rmin;
  const hw = Math.max(sec.w, sec.d) / 2, ext = hw + sec.pared;
  const radios = radiosDeDoblez(p);
  const tagDe = (a: V3, b: V3) => {
    const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    if (dentroCaja(m[0], m[1], m[2], COLUMNA)) return 'K';
    const n = aberturaTramo(a, b);
    return n[2] < 0 ? 'C' : 'B';
  };
  const recorte = (i: number) => (i >= 1 && i <= radios.length ? Math.min(R, radios[i - 1]) : 0);
  for (let s = 0; s + 1 < p.length; s++) {
    const a = p[s], b = p[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (L < 1e-6) continue;
    const tag = tagDe(a, b);
    const dv: V3 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L, (b[2] - a[2]) / L];
    const t0 = recorte(s) >= ext + 0.5 ? recorte(s) : 0, t1 = recorte(s + 1) >= ext + 0.5 ? recorte(s + 1) : 0;
    const A: V3 = [a[0] + dv[0] * t0, a[1] + dv[1] * t0, a[2] + dv[2] * t0], B: V3 = [b[0] - dv[0] * t1, b[1] - dv[1] * t1, b[2] - dv[2] * t1];
    const caj = (m: number, mEje = 0): Caja => caja(
      Math.min(A[0], B[0]) - (dv[0] ? mEje : m), Math.min(A[1], B[1]) - (dv[1] ? mEje : m), Math.min(A[2], B[2]) - (dv[2] ? mEje : m),
      Math.max(A[0], B[0]) + (dv[0] ? mEje : m), Math.max(A[1], B[1]) + (dv[1] ? mEje : m), Math.max(A[2], B[2]) + (dv[2] ? mEje : m));
    if (Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) < 0.05 || t0 + t1 > L) continue;   // tramo consumido por sus codos (o su bolsillo)
    o.push(op(sumaCaja(caj(ext, s === 0 || s === p.length - 2 ? 0 : (t0 && t1 ? 0 : ext)), `canal ${r.id}`), tag, { canal: true }));
    o.push(op(restaCaja(caj(hw, t0 && t1 ? 0.01 : hw), `hueco ${r.id}`), tag, { canal: true }));
    // el canal se PEGA a su superficie: el cuerpo se rellena por la espalda (−abertura) hasta la pared, el piso o la
    // cubierta (≤ 60 mm); si es una repisa horizontal en una pared, lleva cartela a 45° abajo (sin soporte)
    const n = aberturaTramo(a, b), k = n[0] ? 0 : n[1] ? 1 : 2, sn = n[k];
    if (tag !== 'K') {
      const atras = -n[k], cuerpoC = caj(ext, 0);
      const lo = ['x0', 'y0', 'z0'][k] as 'x0' | 'y0' | 'z0', hi = ['x1', 'y1', 'z1'][k] as 'x1' | 'y1' | 'z1';
      const meta = k === 2 ? (atras < 0 ? Z_PISO - 0.5 : Z_CUB.z0 + 0.5) : atras < 0 ? [INTERIOR.x0, INTERIOR.y0][k] - 0.5 : [INTERIOR.x1, INTERIOR.y1][k] + 0.5;
      const espalda = atras < 0 ? cuerpoC[lo] : cuerpoC[hi], hueco = Math.abs(espalda - meta);
      if (hueco > 0.01 && hueco <= 60) {
        const rel = { ...cuerpoC }; if (atras < 0) rel[lo] = meta; else rel[hi] = meta;
        o.push(op(sumaCaja(rel, `pegado ${r.id}`), tag, { canal: true }));
      }
      const ejeSeg = dv[0] ? 0 : dv[1] ? 1 : 2;
      if (tag === 'B' && k !== 2 && ejeSeg !== 2 && hueco <= 60) {
        const zb = cuerpoC.z0, pared = meta, fuera = atras < 0 ? cuerpoC[hi] : cuerpoC[lo], ancho = Math.abs(fuera - pared);
        const zc = Math.max(Z_PISO - 0.5, zb - ancho);
        const pts: [number, number][] = zc > Z_PISO - 0.5 ? [[pared, zb], [fuera, zb], [pared, zc]] : [[pared, zb], [fuera, zb], [fuera - Math.sign(fuera - pared) * (zb - zc), zc], [pared, zc]];
        const [d0, d1] = [Math.min(A[ejeSeg], B[ejeSeg]), Math.max(A[ejeSeg], B[ejeSeg])];
        if (zb > Z_PISO + 0.5 && d1 - d0 > 0.5) o.push(op({ t: 'prisma', s: 1, plano: ejeSeg === 0 ? 'YZ' : 'XZ', pts, desde: d0, hasta: d1, nota: `cartela ${r.id}`, tag: '' }, tag, { canal: true }));
      }
    }
    // la ranura de la tapa (sección 1.2 más angosta: deja el labio de 0.6 donde muerden las patas) y su TAPA
    const ejeSeg = dv[0] ? 0 : dv[1] ? 1 : 2, aw = 3 - ejeSeg - k;
    const a0 = Math.min(A[ejeSeg], B[ejeSeg]), a1 = Math.max(A[ejeSeg], B[ejeSeg]);
    if (aw < 0 || aw > 2 || aw === ejeSeg || a1 - a0 < 14) continue;   // ranura corta: el canal va cerrado
    // en el bloque macizo del pie de la columna (abajo de la cubierta) el canal es un barreno cerrado: el cable se empuja
    if (tag === 'K' && Math.max(A[2], B[2]) <= Z_CUB.z0 + 0.01) continue;
    const eje = A[k], fIn = eje + sn * hw, fOut = tag === 'K' ? caraColumna(k, sn) : eje + sn * ext;
    const ra = caj(hw - 0.6, 0.01);
    const lo = ['x0', 'y0', 'z0'][k] as 'x0' | 'y0' | 'z0', hi = ['x1', 'y1', 'z1'][k] as 'x1' | 'y1' | 'z1';
    if (sn > 0) { ra[lo] = eje; ra[hi] = fOut + 1; } else { ra[hi] = eje; ra[lo] = fOut - 1; }
    o.push(op(restaCaja(ra, `tapa ${r.id}`), tag, { canal: true }));
    tapas.push(...tapasRanura(r.id, tapas.length, ejeSeg, k, sn, a0, a1, A[aw], hw - 0.6, fIn, fOut));
  }
  // S cortas: el cable hace dos arcos de θ = acos(1 − m/2R) que ocupan R·sen θ de los tramos de afuera → un BOLSILLO
  // que contiene esa curva (cuerpo con pared, hueco y su tapa) en lugar de dos codos de 90° de radio chico
  const enS = esquinasEnS(p, R);
  for (let c = 1; c + 1 <= p.length - 2; c++) {
    const d0 = [p[c][0] - p[c - 1][0], p[c][1] - p[c - 1][1], p[c][2] - p[c - 1][2]], d2v = [p[c + 2][0] - p[c + 1][0], p[c + 2][1] - p[c + 1][1], p[c + 2][2] - p[c + 1][2]];
    const L0 = Math.hypot(d0[0], d0[1], d0[2]), m = Math.hypot(p[c + 1][0] - p[c][0], p[c + 1][1] - p[c][1], p[c + 1][2] - p[c][2]);
    const u0: V3 = [d0[0] / L0, d0[1] / L0, d0[2] / L0], L2 = Math.hypot(d2v[0], d2v[1], d2v[2]);
    if (!(enS[c] && enS[c + 1]) || Math.abs(u0[0] - d2v[0] / L2) + Math.abs(u0[1] - d2v[1] / L2) + Math.abs(u0[2] - d2v[2] / L2) > 1e-6 || m >= 2 * R) continue;
    const Ls = R * Math.sin(Math.acos(1 - m / (2 * R)));
    const A: V3 = [p[c][0] - u0[0] * Ls, p[c][1] - u0[1] * Ls, p[c][2] - u0[2] * Ls], Bq: V3 = [p[c + 1][0] + u0[0] * Ls, p[c + 1][1] + u0[1] * Ls, p[c + 1][2] + u0[2] * Ls];
    const bb = (k: number): Caja => caja(Math.min(A[0], Bq[0], p[c][0], p[c + 1][0]) - k, Math.min(A[1], Bq[1], p[c][1], p[c + 1][1]) - k, Math.min(A[2], Bq[2], p[c][2], p[c + 1][2]) - k,
      Math.max(A[0], Bq[0], p[c][0], p[c + 1][0]) + k, Math.max(A[1], Bq[1], p[c][1], p[c + 1][1]) + k, Math.max(A[2], Bq[2], p[c][2], p[c + 1][2]) + k);
    const tag = tagDe(p[c - 1], p[c]);
    o.push(op(sumaCaja(bb(ext), `bolsillo de la S ${r.id}`), tag, { canal: true }), op(restaCaja(bb(hw), `bolsillo hueco ${r.id}`), tag, { canal: true }));
    const n = aberturaTramo(p[c - 1], p[c]), k = n[0] ? 0 : n[1] ? 1 : 2, sn = n[k], ra = bb(hw - 0.6);
    const lo = ['x0', 'y0', 'z0'][k] as 'x0' | 'y0' | 'z0', hi = ['x1', 'y1', 'z1'][k] as 'x1' | 'y1' | 'z1', mid = (ra[lo] + ra[hi]) / 2;
    const hueco = bb(hw), cuerpo = bb(ext), fIn = sn > 0 ? hueco[hi] : hueco[lo], fOut = tag === 'K' ? caraColumna(k, sn) : sn > 0 ? cuerpo[hi] : cuerpo[lo];
    if (sn > 0) { ra[lo] = mid; ra[hi] = fOut + 1; } else { ra[hi] = mid; ra[lo] = fOut - 1; }
    o.push(op(restaCaja(ra, `tapa del bolsillo ${r.id}`), tag, { canal: true }));
    // su tapa: a lo largo del lado más largo del bolsillo
    const ejes = [0, 1, 2].filter((q) => q !== k), lar = (q: number) => ra[(['x1', 'y1', 'z1'] as const)[q]] - ra[(['x0', 'y0', 'z0'] as const)[q]];
    const eL = lar(ejes[0]) >= lar(ejes[1]) ? ejes[0] : ejes[1], eT = 3 - k - eL;
    const L0s = (['x0', 'y0', 'z0'] as const), L1s = (['x1', 'y1', 'z1'] as const);
    tapas.push(...tapasRanura(r.id, tapas.length, eL, k, sn, ra[L0s[eL]], ra[L1s[eL]], (ra[L0s[eT]] + ra[L1s[eT]]) / 2, lar(eT) / 2, fIn, fOut));
  }
  for (let c = 1; c < p.length - 1; c++) {
    if (enS[c]) continue;   // la S ya va en su bolsillo
    const a = p[c - 1], b = p[c], e = p[c + 1];
    const n1 = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n2 = Math.hypot(e[0] - b[0], e[1] - b[1], e[2] - b[2]);
    const d1: V3 = [(b[0] - a[0]) / n1, (b[1] - a[1]) / n1, (b[2] - a[2]) / n1], d2: V3 = [(e[0] - b[0]) / n2, (e[1] - b[1]) / n2, (e[2] - b[2]) / n2];
    const Rc = Math.min(R, radios[c - 1]), tag = tagDe(a, b);
    if (Rc < ext + 0.5) {   // codo cerrado (lo marca C3 si es menor que 6·Ø)
      o.push(op(sumaCaja(caja(b[0] - ext, b[1] - ext, b[2] - ext, b[0] + ext, b[1] + ext, b[2] + ext), `esquina ${r.id}`), tag, { canal: true }));
      o.push(op(restaCaja(caja(b[0] - hw, b[1] - hw, b[2] - hw, b[0] + hw, b[1] + hw, b[2] + hw), `esquina hueca ${r.id}`), tag, { canal: true }));
      continue;
    }
    const centro: V3 = [b[0] + (d2[0] - d1[0]) * Rc, b[1] + (d2[1] - d1[1]) * Rc, b[2] + (d2[2] - d1[2]) * Rc];
    const ax: V3 = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]];
    const u: V3 = [-d2[0], -d2[1], -d2[2]];
    o.push(op({ t: 'codo', s: 1, centro, u, a: ax, r0: Rc - ext, r1: Rc + ext, h: ext, nota: `codo ${r.id}`, tag: '' }, tag, { canal: true }));
    o.push(op({ t: 'codo', s: -1, centro, u, a: ax, r0: Rc - hw, r1: Rc + hw, h: hw, nota: `codo hueco ${r.id}`, tag: '' }, tag, { canal: true }));
  }
  // peines y abrazaderas: dos dientes que angostan el canal al ancho del manojo (abrazadera: 0.2 mm de interferencia)
  const filas = Math.max(1, Math.floor(sec.d / sec.od)), deLado = Math.ceil(r.seccion.areaCables / (Math.PI * sec.od * sec.od / 4) / filas);
  const manojo = deLado * sec.od;
  for (const pe of peines) {
    const ax = pe.dir[0] ? 0 : pe.dir[1] ? 1 : 2;
    const dIni = Math.hypot(pe.pos[0] - p[0][0], pe.pos[1] - p[0][1], pe.pos[2] - p[0][2]), dFin = Math.hypot(pe.pos[0] - p[p.length - 1][0], pe.pos[1] - p[p.length - 1][1], pe.pos[2] - p[p.length - 1][2]);
    const seg = dIni <= dFin ? [p[0], p[1]] : [p[p.length - 2], p[p.length - 1]];
    const n = aberturaTramo(seg[0] as V3, seg[1] as V3), an = n[0] ? 0 : n[1] ? 1 : 2, aw = 3 - ax - an;
    if (an === ax || aw < 0 || aw > 2) continue;
    const gap = Math.min(hw * 2 - 1, pe.tipo === 'abrazadera' ? manojo - 0.2 : manojo + 0.3) / 2;
    const tag = dentroCaja(pe.pos[0], pe.pos[1], pe.pos[2], COLUMNA) ? 'K' : n[2] < 0 ? 'C' : 'B';
    for (const sg of [-1, 1]) {
      const lo: V3 = [0, 0, 0], hi: V3 = [0, 0, 0];
      lo[ax] = pe.pos[ax] - 3; hi[ax] = pe.pos[ax] + 3;
      lo[an] = pe.pos[an] - hw; hi[an] = pe.pos[an] + hw;
      lo[aw] = sg > 0 ? pe.pos[aw] + gap : pe.pos[aw] - hw - 0.01; hi[aw] = sg > 0 ? pe.pos[aw] + hw + 0.01 : pe.pos[aw] - gap;
      o.push(op(sumaCaja(caja(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]), `${pe.tipo} ${r.id}`), tag, { canal: true }));
    }
  }
  return { ops: o, tapas };
}
const ETIQUETA_TEJA = (id: string) => (id.startsWith('base') ? 'B' : id.startsWith('cub') ? 'C' : id.startsWith('ducto') ? 'D' : id.startsWith('col') ? 'K' : 'M');
/** ¿la operación va en esta teja? */
export function opEnTeja(o: OpSolido, t: Teja): boolean {
  const tag = o.tag ?? '';
  if (tag === t.id) return true;
  if (o.canal && t.id.startsWith('col')) return true;
  return tag === ETIQUETA_TEJA(t.id);
}
/** las operaciones de todo el cuerpo (doc frame), cada una con su etiqueta */
export function opsSolidos(d: DisenoCuerpo): { porTeja: Record<string, OpSolido[]>; piezas: PiezaImpresa[] } {
  const B: OpSolido[] = [], tapas: PiezaImpresa[] = [];
  const add = (tag: string, ...xs: OpSolido[]) => { for (const x of xs) B.push(op(x, tag)); };
  // ── la base: piso + 4 paredes ──
  add('B', sumaCaja(caja(BASE.x0, BASE.y0, BASE.z0, BASE.x1, BASE.y1, Z_PISO), 'piso'),
    sumaCaja(caja(BASE.x0, BASE.y0, Z_PISO, BASE.x0 + PARED, BASE.y1, Z_CUB.z0), 'pared izquierda'),
    sumaCaja(caja(BASE.x1 - PARED, BASE.y0, Z_PISO, BASE.x1, BASE.y1, Z_CUB.z0), 'pared derecha'),
    sumaCaja(caja(BASE.x0, BASE.y0, Z_PISO, BASE.x1, BASE.y0 + PARED, Z_CUB.z0), 'pared del frente'),
    sumaCaja(caja(BASE.x0, BASE.y1 - PARED, Z_PISO, BASE.x1, BASE.y1, Z_CUB.z0), 'pared de atrás'));
  // filetes pared–piso (r 6: Kt de la esquina de 4 mm baja de ∞ a notchKt(4, 6))
  const rf = 6, cuarto = (u0: number, v0: number, su: number): [number, number][] => {
    const p: [number, number][] = [[u0, v0]]; for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; p.push([u0 + su * rf * (1 - Math.sin(a)), v0 + rf * (1 - Math.cos(a))]); } return p;
  };
  add('B', { t: 'prisma', s: 1, plano: 'YZ', pts: cuarto(BASE.y0 + PARED, Z_PISO, 1), desde: BASE.x0, hasta: BASE.x1, nota: 'filete', tag: '' },
    { t: 'prisma', s: 1, plano: 'YZ', pts: cuarto(BASE.y1 - PARED, Z_PISO, -1), desde: BASE.x0, hasta: BASE.x1, nota: 'filete', tag: '' },
    { t: 'prisma', s: 1, plano: 'XZ', pts: cuarto(BASE.x0 + PARED, Z_PISO, 1), desde: BASE.y0, hasta: BASE.y1, nota: 'filete', tag: '' },
    { t: 'prisma', s: 1, plano: 'XZ', pts: cuarto(BASE.x1 - PARED, Z_PISO, -1), desde: BASE.y0, hasta: BASE.y1, nota: 'filete', tag: '' });
  // cunas de la LRS (labios a lo largo; entra deslizando desde la derecha y la frena el escape)
  const lrs = bahia('LRS').caja;
  add('B', sumaCaja(caja(lrs.x0 + 10, lrs.y0 - 5, Z_PISO, lrs.x1 - 10, lrs.y0, lrs.z0 + 14), 'cuna LRS'), sumaCaja(caja(lrs.x0 + 10, lrs.y1, Z_PISO, lrs.x1 - 10, lrs.y1 + 2, lrs.z0 + 14), 'cuna LRS'));
  // postes de la cubierta en la franja libre entre la placa de C (y ≤ 48) y la LRS (y ≥ 60)
  for (const x of POSTES_CUB) add('B', sumaCaja(caja(x - 5, 49, Z_PISO, x + 5, 59, Z_CUB.z0), 'poste de la cubierta'));
  // ventanas y rejillas de la base
  const v = d.ventanas;
  for (const w of v.filter((q) => q.id === 'USB' || q.id === 'IEC')) add('B', restaCaja(w.c, `ventana ${w.id}`));
  add('B', ...rejilla('x', BASE.x0 + PARED / 2, -78, -2, -108, -32, 'rejilla: entrada de C'));
  add('B', ...rejilla('x', BASE.x0 + PARED / 2, -78, 78, MESA_G.piso.z1, Z_CUB.z0, 'rejilla: escape de la mesa'));
  add('B', ...rejilla('x', BASE.x1 - PARED / 2, MESA_G.vent.y0 + 3, MESA_G.vent.y1 - 3, -102, -26, 'rejilla: entrada de la mesa'));
  add('B', ...rejilla('x', BASE.x1 - PARED / 2, 64, 180, -118, -82, 'rejilla: escape de la LRS'));
  add('B', ...rejilla('x', BASE.x1 - PARED / 2, 34, 56, -118, -30, 'rejilla: escape de C atrás'));
  add('B', ...rejilla('y', BASE.y0 + PARED / 2, 88, 140, -118, -68, 'rejilla: escape de C al frente'));
  add('B', ...rejilla('y', BASE.y1 - PARED / 2, -110, -60, -118, -82, 'rejilla: entrada de la LRS'));
  add('B', ...rejilla('y', BASE.y1 - PARED / 2, 60, 125, -118, -82, 'rejilla: entrada de la LRS'));
  // cunas de los ventiladores (labios arriba y abajo: entran a presión)
  const vc = bahia('VENTILADOR').caja, vm = MESA_G.vent;
  add('B', sumaCaja(caja(vc.x0, vc.y0 - 4, Z_PISO, vc.x1, vc.y0, vc.z1 + 2), 'cuna vent C'), sumaCaja(caja(vc.x0, vc.y1, Z_PISO, vc.x1, vc.y1 + 4, vc.z1 + 2), 'cuna vent C'));
  add('B', sumaCaja(caja(vm.x0, vm.y0 - 4, Z_PISO, vm.x1, vm.y0, vm.z1), 'cuna vent mesa'), sumaCaja(caja(vm.x0, vm.y1, Z_PISO, vm.x1, vm.y1 + 4, vm.z1), 'cuna vent mesa'), sumaCaja(caja(vm.x0, vm.y0, Z_PISO, vm.x1, vm.y1, vm.z0), 'asiento vent mesa'));
  // la subida del aire de la mesa: caja de 2 mm del ventilador al ducto
  const sb = MESA_G.subida;
  // la subida: tres paredes de 2 mm del piso a la charola, con el fondo en rampa de 45° (gira el aire hacia arriba y se imprime sin soporte)
  add('B', sumaCaja(caja(sb.x0 - 2, sb.y0 - 2, Z_PISO, sb.x1, sb.y1 + 2, MESA_G.piso.z0), 'subida'), restaCaja(caja(sb.x0, sb.y0, sb.z0 + 2, sb.x1 + 1, sb.y1, MESA_G.piso.z0 + 1), 'subida hueca'),
    { t: 'prisma', s: -1, plano: 'XZ', pts: [[sb.x0, sb.z0 + 2 + (sb.x1 - sb.x0)], [sb.x1 + 1, sb.z0 + 1], [sb.x1 + 1, sb.z0 + 2 + (sb.x1 - sb.x0)]], desde: sb.y0, hasta: sb.y1, nota: 'subida hueca', tag: '' });
  // muesca del pie de la columna + mejillas con el carril hembra (x = ±55)
  add('B', restaCaja(caja(COL.x0, COL.y0, COL_PIE_Z - 1, COL.x1, BASE.y1 + 1, Z_CUB.z0 + 1), 'muesca del pie'));
  const hol = clearance(PERFIL_K1) / 2;
  for (const s of [-1, 1]) {
    const x = s * COL.x1;
    add('B', sumaCaja(caja(s > 0 ? x : x - 12, COL.y0, COL_PIE_Z, s > 0 ? x + 12 : x, BASE.y1, Z_CUB.z0), 'mejilla del pie'));
    const yc = Y_CARRIL;
    add('B', { t: 'prisma', s: -1, plano: 'XY', pts: [[x - s * 0.01, yc - 5 - hol], [x - s * 0.01, yc + 5 + hol], [x + s * (COLA.prof + hol), yc + 7 + hol], [x + s * (COLA.prof + hol), yc - 7 - hol]], desde: COL_PIE_Z, hasta: Z_CUB.z0 + 1, nota: 'carril hembra del pie', tag: '' });
    B.push(op({ t: 'prisma', s: 1, plano: 'XY', pts: [[x - s * 0.5, yc - 5], [x - s * 0.5, yc + 5], [x + s * COLA.prof, yc + 7], [x + s * COLA.prof, yc - 7]], desde: COL_PIE_Z + 2, hasta: Z_CUB.z0, nota: 'carril macho del pie', tag: '' }, 'col-1', { libre: true }));
  }
  // ventanas para los ganchos de la cubierta
  for (let x = BASE.x0 + 20; x < BASE.x1 - 10; x += 30) {
    if (Math.abs(x) < COL.x1 + 14) continue;
    add('B', restaCaja(caja(x - 4.5, BASE.y0 - 1, -35, x + 4.5, BASE.y0 + PARED + 1, -30.5), 'ventana del gancho'), restaCaja(caja(x - 4.5, BASE.y1 - PARED - 1, -35, x + 4.5, BASE.y1 + 1, -30.5), 'ventana del gancho'));
  }
  // colas de milano del piso (llaves en los 4 mm del piso)
  for (const y of [-80, -20]) B.push(...colaMilano('x', X_SPLIT, y, true, BASE.z0, Z_PISO, 'base-fi', 'base-fd'));
  for (const y of [90, 130]) B.push(...colaMilano('x', X_SPLIT, y, true, BASE.z0, Z_PISO, 'base-ti', 'base-td'));
  for (const x of [-120, -60]) B.push(...colaMilano('y', Y_SPLIT, x, true, BASE.z0, Z_PISO, 'base-fi', 'base-ti'));
  for (const x of [60, 120]) B.push(...colaMilano('y', Y_SPLIT, x, true, BASE.z0, Z_PISO, 'base-fd', 'base-td'));
  // ── la cubierta: tapa todo; bolsillo por abajo sobre el ducto (deja una piel de 2 mm: el techo de las cámaras),
  //    hueco pasante sólo sobre la mesa (con el labio de 3 mm donde apoyan las tiras de silicato) ──
  const L = MESA_G.lado, dx0 = MESA_G.ducto.x0, dx1 = MESA_G.ducto.x1;
  add('C', sumaCaja(caja(BASE.x0, BASE.y0, Z_CUB.z0, BASE.x1, BASE.y1, Z_CUB.z1), 'cubierta'));
  add('C', restaCaja(caja(dx0, -L - 8, Z_CUB.z0 - 1, dx1, L + 8, -14), 'bolsillo del ducto'));
  add('C', restaCaja(caja(-84, -L + 1, -15, 84, L - 1, Z_CUB.z1 + 1), 'hueco de la mesa'));
  add('C', ...rejilla('x', BASE.x0 + PARED / 2, -78, 78, Z_CUB.z0 - 1, -14, 'rejilla: escape de la mesa (canto)'));
  for (let y = -77; y + 3 <= 78; y += 5) add('C', restaCaja(caja(-140, y, -15, -100, y + 3, Z_CUB.z1 + 1), 'rejilla: escape de la mesa (cubierta)'));
  add('C', restaCaja(caja(COL.x0, COL.y0, Z_CUB.z0 - 1, COL.x1, COL.y1 + 1, Z_CUB.z1 + 1), 'pie de la columna'));
  add('C', restaCaja(v.find((q) => q.id === 'PARO')!.c, 'ventana del PARO'));
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add('C', restaCaja(caja(sx * 104 - 8, sy * 104 - 8, -18, sx * 104 + 8, sy * 104 + 8, Z_CUB.z1 + 1), 'zócalo de la mordaza'));
  for (let x = BASE.x0 + 20; x < BASE.x1 - 10; x += 30) {
    if (Math.abs(x) < COL.x1 + 14) continue;
    add('C', sumaCaja(caja(x - 4, BASE.y0 + PARED, -34, x + 4, BASE.y0 + PARED + 1.6, Z_CUB.z0), 'gancho'), sumaCaja(caja(x - 4, BASE.y0 + PARED - 0.9, -34, x + 4, BASE.y0 + PARED, -31), 'diente del gancho'));
    add('C', sumaCaja(caja(x - 4, BASE.y1 - PARED - 1.6, -34, x + 4, BASE.y1 - PARED, Z_CUB.z0), 'gancho'), sumaCaja(caja(x - 4, BASE.y1 - PARED, -34, x + 4, BASE.y1 - PARED + 0.9, -31), 'diente del gancho'));
  }
  for (const y of [-102, 120, 165]) { if (y > 94 && y < 190 && Math.abs(X_CUB) < COL.x1 && y >= COL.y0) continue; B.push(...colaMilano('x', X_CUB, y, true, Z_CUB.z0, Z_CUB.z1, y < 40 ? 'cub-fi' : 'cub-ti', y < 40 ? 'cub-fd' : 'cub-td')); }
  for (const x of [120, 138]) B.push(...colaMilano('y', Y_SPLIT, x, true, Z_CUB.z0, Z_CUB.z1, 'cub-fd', 'cub-td'));
  // ── la charola del ducto: piso + paredes + alas con cartela a 45° (cuelga del bolsillo de la cubierta) ──
  const xPcb = bahia('PLACA_PCB').caja.x0;
  void xPcb;
  add('D', sumaCaja(caja(dx0, -L - 2, MESA_G.piso.z0, dx1, L + 2, MESA_G.piso.z1), 'piso del ducto'),
    sumaCaja(caja(dx0, -L - 2, MESA_G.piso.z1, dx1, -L, -14), 'pared del ducto'), sumaCaja(caja(dx0, L, MESA_G.piso.z1, dx1, L + 2, -14), 'pared del ducto'),
    { t: 'prisma', s: 1, plano: 'YZ', pts: [[L + 2, -14], [L + 8, -14], [L + 8, -16], [L + 2, -22]], desde: dx0, hasta: dx1, nota: 'ala', tag: '' },
    { t: 'prisma', s: 1, plano: 'YZ', pts: [[-L - 2, -14], [-L - 2, -22], [-L - 8, -16], [-L - 8, -14]], desde: dx0, hasta: dx1, nota: 'ala', tag: '' },
    sumaCaja(caja(-80, -L, MESA_G.piso.z1, 80, -72, -20), 'repisa de los postes'), sumaCaja(caja(-80, 72, MESA_G.piso.z1, 80, L, -20), 'repisa de los postes'),
    restaCaja(caja(MESA_G.subida.x0, MESA_G.subida.y0, MESA_G.piso.z0 - 1, MESA_G.subida.x1, MESA_G.subida.y1, MESA_G.piso.z1 + 1), 'boca de la subida'),
    restaCaja(caja(dx0 - 1, -78, MESA_G.piso.z1, dx0 + 0.01, 78, -14), 'salida izquierda'));
  for (const y of [-60, 60]) B.push(...colaMilano('x', -14, y, true, MESA_G.piso.z0, MESA_G.piso.z1, 'ducto-i', 'ducto-d'));
  // ── la columna ──
  add('K', sumaCaja(COLUMNA, 'columna'));
  // el camino del humo por el pie: garganta (cara del frente) → se angosta a 45° → paso con techo a 45° → collar en gota
  const g = HUMO.garganta, ps = HUMO.paso, cl = COLLAR, yRampa = g.y1 + (ps.z1 - g.z1);
  add('K', restaCaja(caja(g.x0, g.y0, g.z0, g.x1, g.y1, g.z1), 'garganta del humo'));
  add('K', { t: 'prisma', s: -1, plano: 'XY', pts: [[g.x0, g.y1 - 0.01], [g.x1, g.y1 - 0.01], [ps.x1, g.y1 + (g.x1 - ps.x1)], [ps.x0, g.y1 + (ps.x0 - g.x0)]], desde: ps.z0, hasta: g.z1, nota: 'el paso se angosta a 45°', tag: '' });
  add('K', { t: 'prisma', s: -1, plano: 'YZ', pts: [[g.y1 - 0.01, ps.z0], [ps.y1 + 1, ps.z0], [ps.y1 + 1, ps.z1], [yRampa, ps.z1], [g.y1 - 0.01, g.z1]], desde: ps.x0, hasta: ps.x1, nota: 'paso del humo (techo del frente a 45°)', tag: '' });
  add('K', { t: 'prisma', s: -1, plano: 'XZ', pts: [[ps.x0, ps.z1 - 0.01], [ps.x1, ps.z1 - 0.01], [(ps.x0 + ps.x1) / 2, ps.pico]], desde: yRampa, hasta: ps.y1 + 1, nota: 'techo a 45° del paso', tag: '' });
  add('K', { t: 'prisma', s: -1, plano: 'XZ', pts: gota(cl.x, cl.z, cl.rInt), desde: COL.y1 - 6, hasta: COL.y1 + cl.largo + 1, nota: 'boca del collar', tag: '' });
  B.push(op({ t: 'prisma', s: 1, plano: 'XZ', pts: gota(cl.x, cl.z, cl.r), desde: COL.y1 - 0.5, hasta: COL.y1 + cl.largo, nota: 'collar Ø100', tag: '' }, 'col-1', { libre: true }));
  // la tapa de arriba: la columna acaba 3 mm abajo y sus caras de los lados y de atrás llevan el rebaje de las faldas
  const tc = TAPA_COL;
  add('K', restaCaja(caja(COL.x0 - 1, COL.y0 - 1, tc.z0, COL.x1 + 1, COL.y1 + 1, COL.z1 + 1), 'lugar de la tapa de arriba'));
  for (const sx of [-1, 1]) {
    const x = sx > 0 ? COL.x1 : COL.x0;
    add('K', restaCaja(caja(sx > 0 ? x - tc.falda : x - 1, COL.y0 + tc.margenFrente, tc.z0 - tc.L, sx > 0 ? x + 1 : x + tc.falda, COL.y1 + 1, tc.z0 + 1), 'rebaje de la falda'));
    add('K', restaCaja(caja(sx > 0 ? x - tc.falda - tc.diente - 0.3 : x - 1, COL.y0 + tc.margenFrente, tc.z0 - tc.L - 0.3, sx > 0 ? x + 1 : x + tc.falda + tc.diente + 0.3, COL.y1 + 1, tc.z0 - tc.L + 2.4), 'ranura del diente de la falda'));
  }
  add('K', restaCaja(caja(COL.x0 - 1, COL.y1 - tc.falda, tc.z0 - tc.L, COL.x1 + 1, COL.y1 + 1, tc.z0 + 1), 'rebaje de la falda de atrás'),
    restaCaja(caja(COL.x0 - 1, COL.y1 - tc.falda - tc.diente - 0.3, tc.z0 - tc.L - 0.3, COL.x1 + 1, COL.y1 + 1, tc.z0 - tc.L + 2.4), 'ranura del diente de atrás'));
  add('K', { t: 'prisma', s: -1, plano: 'XY', pts: [[-RIEL.anchoBoca / 2, COL.y0 - 0.01], [RIEL.anchoBoca / 2, COL.y0 - 0.01], [RIEL.anchoFondo / 2, COL.y0 + RIEL.profundidad], [-RIEL.anchoFondo / 2, COL.y0 + RIEL.profundidad]], desde: RIEL.z0, hasta: COL.z1 + 1, nota: 'riel hembra (cola de milano)', tag: '' });
  for (const w of v.filter((q) => q.id === 'A.POT' || q.id === 'A.SEN')) add('K', ventanaGablete(w.c.x0, w.c.x1, w.c.z0, w.c.z1, w.c.y0, w.c.y1, `ventana ${w.id}`));
  // broche del riel: lengüeta de 25 × 12 × 2.5 con diente en z 340 (A entra de arriba, la lengüeta cede y lo atrapa)
  add('K', restaCaja(caja(-8, COL.y0 + RIEL.profundidad, RIEL.z1 - 25, -6, COL.y0 + 12, RIEL.z1 + 4), 'ranura del broche'), restaCaja(caja(6, COL.y0 + RIEL.profundidad, RIEL.z1 - 25, 8, COL.y0 + 12, RIEL.z1 + 4), 'ranura del broche'),
    restaCaja(caja(-6, COL.y0 + RIEL.profundidad + 2.5, RIEL.z1 - 25, 6, COL.y0 + 12, RIEL.z1 + 4), 'respaldo de la lengüeta'));
  add('K', sumaCaja(caja(-6, COL.y0 + RIEL.profundidad - 2, RIEL.z1, 6, COL.y0 + RIEL.profundidad, RIEL.z1 + 4), 'diente del broche'));
  // la junta de las dos columnas: dos espigas a los lados del ducto (macho en col-1, hembra en col-2) y 4 broches
  for (const e of ESPIGAS) {
    B.push(op(sumaCaja(caja(e.x0, e.y0, Z_COL - 1, e.x1, e.y1, Z_COL + 25), 'espiga'), 'col-1', { libre: true }));
    B.push(op(restaCaja(caja(e.x0 - hol, e.y0 - hol, Z_COL - 0.5, e.x1 + hol, e.y1 + hol, Z_COL + 25 + hol), 'hembra de la espiga'), 'col-2'));
  }
  for (const gr of grapasColumna(d)) add('K', ...gr.enColumna);
  // ── los canales (con su etiqueta por lugar) y sus tapas ──
  for (const c of d.canales) if (c.ruta.modo === 'astar' && !c.ruta.compartido) {
    const r = opsCanal(c.ruta, c.peines); B.push(...r.ops); tapas.push(...r.tapas);
    c.ranuras = r.ops.filter((o) => o.s < 0 && /^tapa (del bolsillo )?K\d+$/.test(o.nota ?? '')).length;
  }
  for (const c of d.canales) if (c.ruta.compartido) c.ranuras = d.canales.find((q) => q.conexion.id === c.ruta.compartido)?.ranuras ?? 0;
  // K11, K12 y K13 en el ducto: paso por el piso de la charola (los 6 hilos suben de las islas de C en una columna en x 82.5,
  // y −77.3…−60.8: placa.ts) y broches abiertos (el cable se mete de lado)
  const pm = PASO_MESA;
  add('D', restaCaja(caja(pm.x0, pm.y0, MESA_G.piso.z0 - 1, pm.x1, pm.y1, MESA_G.piso.z1 + 1), 'paso de C.MESA'));
  add('D', sumaCaja(caja(71, -72, MESA_G.piso.z1, 75, -66, -17), 'broche K13'), restaCaja(caja(70.5, -69.8, -19.6, 75.5, -68.2, -16.5), 'ranura del broche K13'));
  // el asiento del termostato (MESA.TERM): dos rieles de 1 × 2.5 y un tope; la lata abajo, los hilos a +x
  const tm = MESA_G.termostato, tx0 = tm.x - tm.largo / 2, tx1 = tm.x + tm.largo / 2;
  add('D', sumaCaja(caja(tx0 - 1, tm.y - tm.ancho / 2 - 1.3, MESA_G.piso.z1, tx1 - 3, tm.y - tm.ancho / 2 - 0.3, MESA_G.piso.z1 + 2.5), 'riel del termostato'),
    sumaCaja(caja(tx0 - 1, tm.y + tm.ancho / 2 + 0.3, MESA_G.piso.z1, tx1 - 3, tm.y + tm.ancho / 2 + 1.3, MESA_G.piso.z1 + 2.5), 'riel del termostato'),
    sumaCaja(caja(tx0 - 2.3, tm.y - tm.ancho / 2 - 1.3, MESA_G.piso.z1, tx0 - 0.3, tm.y + tm.ancho / 2 + 1.3, MESA_G.piso.z1 + 2.5), 'tope del termostato'));
  // los remaches charola → cubierta: botón bajo el ala (charola) y el agujero por botón, ala y piel (charola y cubierta)
  for (const r of REMACHES) {
    const sg = Math.sign(r.y);
    add('D', sumaCaja(caja(r.x - 6, sg > 0 ? MESA_G.lado + 2 : -MESA_G.lado - 8, -20, r.x + 6, sg > 0 ? MESA_G.lado + 8 : -MESA_G.lado - 2, -16), 'botón del remache'));
    for (const t of ['D', 'C']) add(t, restaCaja(caja(r.x - 4.2, r.y - 2.6, -21, r.x + 4.2, r.y + 2.6, Z_CUB.z1 + 1), 'agujero del remache'));
  }
  // la silla de silicato de K05 (si hace falta): hueco en la cubierta con un reborde de 1 mm abajo
  if (d.k05?.silla) { const sl = d.k05.silla; add('C', restaCaja(caja(sl.x0 + 1, sl.y0, Z_CUB.z0 - 1, sl.x1 - 1, sl.y1 - 1, Z_CUB.z1 + 1), 'hueco de la silla de K05'), restaCaja(caja(sl.x0, sl.y0, Z_CUB.z0 + 2, sl.x1, sl.y1, Z_CUB.z1 + 1), 'reborde de la silla de K05')); }
  // la campana entra con dos espigas en la cubierta
  for (const x of [HUMO.cuerpo.x0 - 1, HUMO.cuerpo.x1 + 1]) add('C', restaCaja(caja(x - 1.2, 137.8, Z_CUB.z1 - 3.5, x + 1.2, 142.2, Z_CUB.z1 + 1), 'agujero de la espiga de la campana'));
  // el peine del puente K09 (poste del piso con su ranura) y los agujeros de las patas del difusor
  add('B', sumaCaja(caja(PEINE_K09[0] - 3, PEINE_K09[1] - 6, Z_PISO, PEINE_K09[0] + 3, PEINE_K09[1] + 6, PEINE_K09[2] + 4), 'peine del puente K09'),
    restaCaja(caja(PEINE_K09[0] - 1.3, PEINE_K09[1] - 7, PEINE_K09[2] - 1, PEINE_K09[0] + 1.3, PEINE_K09[1] + 7, PEINE_K09[2] + 0.4), 'ranura del peine K09'));
  for (const y of PATAS_DIFUSOR) add('B', restaCaja(caja(-110.3, y - 2.3, BASE.z0 + 1, -105.7, y + 2.3, Z_PISO + 0.1), 'agujero de la pata del difusor'));
  // la cuna del disipador de C: el bolsillo de PETG que carga el tope de silicato (sólo toca silicato)
  const tp = CUNA_HS.tope, bw = CUNA_HS.bolsillo.pared;
  add('B', sumaCaja(caja(tp.x0 - bw, INTERIOR.y0, Z_PISO, tp.x0, tp.y1 - 3, tp.z1), 'bolsillo del tope (lado)'), sumaCaja(caja(tp.x1, INTERIOR.y0, Z_PISO, tp.x1 + bw, tp.y1 - 3, tp.z1), 'bolsillo del tope (lado)'),
    sumaCaja(caja(tp.x0, INTERIOR.y0, Z_PISO, tp.x1, tp.y1 - 3, tp.z0), 'repisa del tope'));
  add('D', sumaCaja(caja(87, -72, MESA_G.piso.z1, 91, -66, -14.8), 'broche K12'), restaCaja(caja(86.5, -69.8, -16.3, 91.5, -68.2, -13), 'ranura del broche K12'));
  for (const z of [-40, -80]) add('B', sumaCaja(caja(96, MESA_G.subida.y0, z - 2, 100, -45.5, z + 2), 'broche K12'), restaCaja(caja(97.2, -47.8, z - 3, 98.8, -44, z + 3), 'ranura del broche K12'));
  // ── mordazas: poste + brazo resorte (30 × 10 × 3) que aprieta un taco de silicato de 25 mm (comprado) ──
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * 104, y = sy * 104, u = (q: number) => q;   // poste en la esquina del anillo de la cubierta
    add('M', sumaCaja(caja(x - 8, y - 8, -18, x + 8, y + 8, 16), 'poste de la mordaza (entra a presión en su zócalo)'));
    add('M', { t: 'prisma', s: 1, plano: 'XY', pts: [[u(x - sx * 3), u(y - sy * 9)], [u(x - sx * 9), u(y - sy * 3)], [u(x - sx * 30), u(y - sy * 24)], [u(x - sx * 24), u(y - sy * 30)]], desde: 13, hasta: 16, nota: 'brazo resorte', tag: '' });
  }
  const out: Record<string, OpSolido[]> = {};
  for (const t of d.tejas) out[t.id] = B.filter((o) => opEnTeja(o, t) && (o.libre || o.s < 0 || intersecta(cajaOp(o), t.caja)));
  return { porTeja: out, piezas: [...tapas, ...piezasSueltas(d)] };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 11b. LAS PIEZAS SUELTAS (REGLAS.todoImprimible) Y SUS CAMAS
// ════════════════════════════════════════════════════════════════════════════════════════════
/** el carril de cola de milano del pie: adelante (y 163…177), lejos de K06 que sube en y 195 */
export const Y_CARRIL = COL.y0 + 20;
/** la tapa de arriba de la columna: placa de 3 mm (la columna acaba en z0) y faldas de 1.6 × 14 a los lados y atrás,
 *  con un diente de 0.6 abajo que cae en su ranura (BROCHES 'tapa-col'). Adelante no lleva falda: ahí está el módulo A. */
export const TAPA_COL = { z0: COL.z1 - 3, L: 14, falda: 1.6, diente: 0.6, margenFrente: 8 };
/** el paso de los 6 hilos de la mesa por el piso de la charola: 4 × 20 mm (80 mm²) sobre la columna de islas de C */
export const PASO_MESA = { x0: 80.5, x1: 84.5, y0: -79, y1: -59 };
/** los 8 remaches de la charola: por fuera de la campana (x ±45) y de los zócalos de las mordazas (x ±96…112) */
export const REMACHES = [-130, -75, 60, 85].flatMap((x) => [{ x, y: -(MESA_G.lado + 5) }, { x, y: MESA_G.lado + 5 }]);
/** las patas del difusor (y) */
export const PATAS_DIFUSOR = [-88, 0];
/** la cara del doc que va a la cama → −z (rotación propia: no espeja, los triángulos no cambian de vuelta) */
export function rotarAbajo(p: V3, abajo: V3): V3 {
  const [x, y, z] = p;
  if (abajo[2] < 0) return [x, y, z];
  if (abajo[2] > 0) return [x, -y, -z];
  if (abajo[0] < 0) return [-z, y, x];
  if (abajo[0] > 0) return [z, y, -x];
  if (abajo[1] < 0) return [x, -z, y];
  return [x, z, -y];
}
/** la caja de una pieza ya girada para imprimirse (de sus sumas) */
export function cajaGirada(pz: PiezaImpresa): { min: V3; max: V3; tam: [number, number, number] } {
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const o of pz.ops.filter((q) => q.s > 0)) {
    const c = cajaOp(o);
    for (const x of [c.x0, c.x1]) for (const y of [c.y0, c.y1]) for (const z of [c.z0, c.z1]) {
      const q = rotarAbajo([x, y, z], pz.abajo);
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], q[k]); max[k] = Math.max(max[k], q[k]); }
    }
  }
  return { min, max, tam: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}
/** acomoda las piezas de cada cama en filas dentro de la K1 (220 − 2·5 de margen; 4 mm entre piezas); si no caben,
 *  abre otra cama con el mismo nombre y un número */
export function acomodarCamas(piezas: PiezaImpresa[]): Cama[] {
  const X = IMPRESORA.cama[0] - 2 * IMPRESORA.margen, Y = IMPRESORA.cama[1] - 2 * IMPRESORA.margen, gap = 4;
  const grupos = new Map<string, PiezaImpresa[]>();
  for (const p of piezas) grupos.set(p.cama, [...(grupos.get(p.cama) ?? []), p]);
  const camas: Cama[] = [];
  for (const [id, ps] of grupos) {
    const orden = [...ps].sort((a, b) => cajaGirada(b).tam[1] - cajaGirada(a).tam[1]);
    let actual: Acomodo[] = [], x = 0, y = 0, fila = 0, n = 0;
    const cerrar = () => {
      if (!actual.length) return;
      const cid = n === 0 ? id : `${id}-${n + 1}`;
      const caja3: [number, number, number] = [Math.max(...actual.map((a) => a.dx + a.caja[0])), Math.max(...actual.map((a) => a.dy + a.caja[1])), Math.max(...actual.map((a) => a.caja[2]))];
      camas.push({ id: cid, piezas: actual.map((a) => a.id), url: `/modelos/laboratorio/cuerpo/${cid}.bin`, stl: `models/stl/laboratorio/cuerpo/${cid}.stl`, acomodo: actual, caja: caja3 });
      for (const a of actual) { const pz = ps.find((q) => q.id === a.id)!; pz.cama = cid; }
      actual = []; x = 0; y = 0; fila = 0; n++;
    };
    for (const p of orden) {
      const t = cajaGirada(p).tam;
      if (x > 0 && x + t[0] > X) { x = 0; y += fila + gap; fila = 0; }
      if (y > 0 && y + t[1] > Y) cerrar();
      actual.push({ id: p.id, dx: x, dy: y, caja: t });
      x += t[0] + gap; fila = Math.max(fila, t[1]);
    }
    cerrar();
  }
  return camas;
}
/** las grapas columna 1 ↔ columna 2 (broche col-col): sobre la junta de z 140, en las caras de los lados y, si ahí no
 *  caben (los canales que suben pegados a la cara llevan su ranura), en la de atrás; cada una con su rebaje y sus dos
 *  bolsillos en la columna */
export function grapasColumna(d: DisenoCuerpo): { pieza: PiezaImpresa; enColumna: OpSolido[] }[] {
  const b = BROCHES.find((x) => x.id === 'col-col')!, z0 = Z_COL, med = 21, prof = 2.2;
  const caras = [{ eje: 0, sn: -1, nombre: 'izquierda' }, { eje: 0, sn: 1, nombre: 'derecha' }, { eje: 1, sn: 1, nombre: 'atrás' }];
  const ocupado = caras.map(() => [] as [number, number][]);
  for (const c of d.canales) {
    if (c.ruta.modo !== 'astar' || c.ruta.compartido) continue;
    const p = c.ruta.canalPts ?? c.ruta.puntos, ext = Math.max(c.ruta.seccion.w, c.ruta.seccion.d) / 2 + c.ruta.seccion.pared;
    for (let i = 0; i + 1 < p.length; i++) {
      const a = p[i], q = p[i + 1];
      if (Math.max(a[2], q[2]) + ext < z0 - med - 4 || Math.min(a[2], q[2]) - ext > z0 + med + 4) continue;
      caras.forEach((f, k) => {
        const cara = f.eje === 0 ? (f.sn > 0 ? COL.x1 : COL.x0) : COL.y1, lat = 1 - f.eje, n = aberturaTramo(a, q);
        const cerca = f.sn > 0 ? Math.max(a[f.eje], q[f.eje]) + ext > cara - 8 : Math.min(a[f.eje], q[f.eje]) - ext < cara + 8;
        if (n[f.eje] === f.sn || cerca) ocupado[k].push([Math.min(a[lat], q[lat]) - ext - 2, Math.max(a[lat], q[lat]) + ext + 2]);
      });
    }
  }
  const candidatos = (f: { eje: number }) => (f.eje === 0 ? [164, 180, 196, 212, 220, 172, 204] : [-38, 38, -20, 20, 0]);
  const elegidas: { f: typeof caras[number]; lat: number }[] = [];
  caras.forEach((f, k) => {
    const tope = f.eje === 0 ? 2 : b.n;
    for (const v of candidatos(f)) {
      if (elegidas.length >= b.n || elegidas.filter((e) => e.f === f).length >= tope) break;
      if (ocupado[k].some(([lo, hi]) => v + 7 > lo && v - 7 < hi)) continue;
      if (elegidas.some((e) => e.f === f && Math.abs(e.lat - v) < 16)) continue;
      elegidas.push({ f, lat: v });
    }
  });
  return elegidas.map(({ f, lat }) => {
    const cara = f.eje === 0 ? (f.sn > 0 ? COL.x1 : COL.x0) : COL.y1, adentro = (mm: number) => cara - f.sn * mm;
    const C = (n0: number, n1: number, l0: number, l1: number, zz0: number, zz1: number): Caja => {
      const [a0, a1] = [Math.min(adentro(n0), adentro(n1)), Math.max(adentro(n0), adentro(n1))];
      return f.eje === 0 ? caja(a0, l0, zz0, a1, l1, zz1) : caja(l0, a0, zz0, l1, a1, zz1);
    };
    const enColumna = [
      restaCaja(C(prof, -1, lat - 5.2, lat + 5.2, z0 - med - 0.2, z0 + med + 0.2), 'rebaje de la grapa'),
      restaCaja(C(prof + b.y + 0.3, prof, lat - 5.2, lat + 5.2, z0 + med - 3.4, z0 + med + 0.2), 'bolsillo de la grapa'),
      restaCaja(C(prof + b.y + 0.3, prof, lat - 5.2, lat + 5.2, z0 - med - 0.2, z0 - med + 3.4), 'bolsillo de la grapa'),
    ];
    const ops: OpSolido[] = [
      { ...sumaCaja(C(b.h + 0.2, 0.2, lat - 5, lat + 5, z0 - med, z0 + med), 'grapa'), tag: 'P' },
      { ...sumaCaja(C(b.h + 0.2 + b.y, b.h + 0.2, lat - 5, lat + 5, z0 + med - 3, z0 + med), 'diente'), tag: 'P' },
      { ...sumaCaja(C(b.h + 0.2 + b.y, b.h + 0.2, lat - 5, lat + 5, z0 - med, z0 - med + 3), 'diente'), tag: 'P' },
    ];
    const ab: V3 = [0, 0, 0]; ab[f.eje] = f.sn;
    return { enColumna, pieza: { id: `grapa-${f.nombre}-${lat}`, nombre: `Grapa columna 1 ↔ 2 (cara ${f.nombre}, ${f.eje === 0 ? 'y' : 'x'} ${lat})`, grupo: 'grapa' as const, cama: 'broches', ops, abajo: ab, broche: { L: b.L, h: b.h, y: b.y }, soportes: 'acostada sobre su cara de afuera: los dientes crecen hacia arriba; flexiona en el plano de las capas' } };
  });
}
/** todas las piezas sueltas menos las tapas de canal (que salen de opsCanal) */
export function piezasSueltas(d: DisenoCuerpo): PiezaImpresa[] {
  const out: PiezaImpresa[] = grapasColumna(d).map((g) => g.pieza);
  const T = (o: OpSolido): OpSolido => ({ ...o, tag: 'P' });
  // los remaches de la charola (broche ducto-cub): horquilla que entra por abajo y engancha arriba de la cubierta
  const br = BROCHES.find((x) => x.id === 'ducto-cub')!;
  for (const r of REMACHES) {
    const { x, y } = r, zb = -26, zt = Z_CUB.z1, w = br.w / 2, t = br.h, s0 = 1;   // s0: medio hueco entre las patas
    const ops = [
      T(sumaCaja(caja(x - w, y - s0 - t, zb, x + w, y + s0 + t, zb + 2), 'puente')),
      T(sumaCaja(caja(x - w, y - s0 - t, zb, x + w, y - s0, zt + 1.4), 'pata')),
      T(sumaCaja(caja(x - w, y + s0, zb, x + w, y + s0 + t, zt + 1.4), 'pata')),
      T(sumaCaja(caja(x - w, y - s0 - t - 1.5, -21.6, x + w, y - s0 - t, -20), 'hombro')),
      T(sumaCaja(caja(x - w, y + s0 + t, -21.6, x + w, y + s0 + t + 1.5, -20), 'hombro')),
      T({ t: 'prisma', s: 1, plano: 'YZ', pts: [[y - s0 - t, zt], [y - s0 - t, zt + 1.4], [y - s0 - t - br.y, zt]], desde: x - w, hasta: x + w, nota: 'diente', tag: '' }),
      T({ t: 'prisma', s: 1, plano: 'YZ', pts: [[y + s0 + t, zt], [y + s0 + t + br.y, zt], [y + s0 + t, zt + 1.4]], desde: x - w, hasta: x + w, nota: 'diente', tag: '' }),
    ];
    out.push({ id: `remache-${x}-${y > 0 ? 't' : 'f'}`, nombre: `Remache charola → cubierta (x ${x}, y ${y})`, grupo: 'remache', cama: 'broches', ops, abajo: [-1, 0, 0], broche: { L: zt - (zb + 2), h: br.h, y: br.y }, soportes: 'acostado de canto: las patas flexionan en el plano de las capas' });
  }
  // la tapa de arriba de la columna
  const tc = TAPA_COL, c = HOL_LADO(), bt = BROCHES.find((x) => x.id === 'tapa-col')!;
  const opsT: OpSolido[] = [T(sumaCaja(caja(COL.x0, COL.y0, tc.z0 + c, COL.x1, COL.y1, COL.z1), 'tapa'))];
  for (const sx of [-1, 1]) {
    const x = sx > 0 ? COL.x1 : COL.x0, xi = x - sx * (tc.falda - c);
    opsT.push(T(sumaCaja(caja(Math.min(x, xi), COL.y0 + tc.margenFrente + c, tc.z0 - tc.L, Math.max(x, xi), COL.y1, tc.z0 + c + 0.01), 'falda')));
    opsT.push(T(sumaCaja(caja(Math.min(xi, xi - sx * tc.diente), COL.y0 + tc.margenFrente + c, tc.z0 - tc.L, Math.max(xi, xi - sx * tc.diente), COL.y1, tc.z0 - tc.L + 2), 'diente')));
  }
  opsT.push(T(sumaCaja(caja(COL.x0, COL.y1 - tc.falda + c, tc.z0 - tc.L, COL.x1, COL.y1, tc.z0 + c + 0.01), 'falda de atrás')),
    T(sumaCaja(caja(COL.x0 + tc.falda, COL.y1 - tc.falda + c - tc.diente, tc.z0 - tc.L, COL.x1 - tc.falda, COL.y1 - tc.falda + c, tc.z0 - tc.L + 2), 'diente de atrás')));
  out.push({ id: 'tapa-columna', nombre: 'Tapa de arriba de la columna (cierra el riel: el módulo A ya no sale por arriba)', grupo: 'tapa-columna', cama: 'tapa-columna', ops: opsT, abajo: [0, 0, 1], broche: { L: bt.L, h: bt.h, y: bt.y }, soportes: 'boca abajo: la placa en la cama y las faldas hacia arriba; sin soporte' });
  // el difusor (bahía DIFUSOR): cuerpo, brida de entrada, patas
  const g = DIFUSOR_G, s2 = g.t * Math.SQRT2;
  const opsD: OpSolido[] = [
    T({ t: 'prisma', s: 1, plano: 'XZ', pts: [[g.x0, g.salida.z0 - g.t], [g.x1, g.salida.z0 - g.t], [g.x1, g.salida.z1 + s2], [g.x0, g.salida.z1 + s2 + (g.x1 - g.x0)]], desde: g.salida.y0 - g.t, hasta: g.salida.y1 + g.t, nota: 'difusor', tag: '' }),
    T({ t: 'prisma', s: -1, plano: 'XZ', pts: [[g.x0 + g.t, g.salida.z0], [g.x1 + 0.1, g.salida.z0], [g.x1 + 0.1, g.salida.z1], [g.x0 + g.t, g.salida.z1 + (g.x1 - g.x0 - g.t)]], desde: g.salida.y0, hasta: g.salida.y1, nota: 'difusor hueco', tag: '' }),
    T(restaCaja(caja(g.x0 - 0.1, g.entrada.y0, g.entrada.z0, g.x0 + g.t + 0.1, g.entrada.y1, g.entrada.z1), 'ventana del ventilador')),
    ...PATAS_DIFUSOR.flatMap((y) => [T(sumaCaja(caja(-112, y - 4, Z_PISO, -104, y + 4, g.salida.z0 - g.t + 0.01), 'pata')), T(sumaCaja(caja(-110, y - 2, Z_PISO - 3, -106, y + 2, Z_PISO + 0.01), 'espiga de la pata'))]),
  ];
  out.push({ id: 'difusor', nombre: 'Difusor del ventilador de la placa (80 × 80 → 106 × 55)', grupo: 'difusor', cama: 'difusor', ops: opsD, abajo: [1, 0, 0], soportes: 'de pie sobre su boca de salida: el techo a 45° crece hacia afuera; la brida de entrada hace un puente de 8 mm sobre la ventana' });
  // la campana de PETG (la embocadura de Al es comprada/cortada: va encima de su frente)
  const cu = HUMO.cuerpo, e = HUMO.embocadura;
  const opsC: OpSolido[] = [
    T(sumaCaja(caja(CAMP.x0, cu.y0, CAMP.z0, CAMP.x1, cu.y1, CAMP.z1), 'campana')),
    T({ t: 'prisma', s: -1, plano: 'XY', pts: [[cu.x0, cu.y0 - 0.1], [e.gx1, cu.y0 - 0.1], [cu.x1, cu.y1 + 0.1], [cu.x0, cu.y1 + 0.1]], desde: CAMP.z0 - 0.1, hasta: e.gz1, nota: 'campana hueca (difusor suave)', tag: '' }),
    T({ t: 'prisma', s: -1, plano: 'YZ', pts: [[cu.y0 - 0.1, e.gz1 - 0.01], [cu.y1 + 0.1, e.gz1 - 0.01], [cu.y1 + 0.1, cu.z1]], desde: cu.x0, hasta: e.gx1, nota: 'techo que sube 7 mm', tag: '' }),
    T(restaCaja(caja(CAMP.x0 - 0.1, cu.y0 - 0.1, CAMP.z0 - 0.1, e.gx0 + 0.1 + 0.2, cu.y0 + 6, e.gz1 - 0.1), 'ranura de la lámina (izq.)')),
    T(restaCaja(caja(e.gx1 - 0.1, cu.y0 - 0.1, CAMP.z0 - 0.1, e.gx1 + e.t + 0.1, cu.y0 + 6, e.gz1 - 0.1), 'ranura de la lámina (der.)')),
    T(restaCaja(caja(e.gx0 - 0.1, cu.y0 - 0.1, e.gz1 - 0.1, e.gx1 + e.t + 0.1, cu.y0 + 6, e.gz1 + e.t + 0.1), 'ranura de la lámina (techo)')),
    T(sumaCaja(caja(CAMP.x0, 138, CAMP.z0 - 3, CAMP.x0 + 2, 142, CAMP.z0 + 0.01), 'espiga')),
    T(sumaCaja(caja(CAMP.x1 - 2, 138, CAMP.z0 - 3, CAMP.x1, 142, CAMP.z0 + 0.01), 'espiga')),
  ];
  out.push({ id: 'campana', nombre: 'Campana de humo (PETG, detrás de la embocadura de aluminio)', grupo: 'campana', cama: 'campana', ops: opsC, abajo: [0, 1, 0], soportes: 'de pie sobre su cara de atrás: paredes y techo suben con ≤ 12° de inclinación; sin soporte' });
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 12. EL JUEZ
// ════════════════════════════════════════════════════════════════════════════════════════════
export interface Hallazgo { nivel: 'error' | 'aviso' | 'contrato'; regla: string; donde: string; texto: string }
/** Silfos (Cu-P con 15 % Ag, D4): sólido hasta ~645 °C */
export const SILFOS = { solidus: 645 };
/**
 *   C1 canal continuo de puerto a puerto (una conexión sin ruta es ERROR con su porqué) · C2 llenado ≤ 0.4
 *   C3 doblez ≥ 6·Ø · C4 potencia a ≥ 15 mm de señal · C5 fuera de bahías ajenas · C6 fuera de la zona caliente
 *   C7 peine/abrazadera junto a cada puerto · C8 área del lazo (aviso) · C9 sale y llega en la dirección de cada puerto
 *   C10 REGLAS.lazoArco: K05 y K06 a ≤ 25 mm entre ejes de C al pie de la columna
 *   T1 cada teja y cada cama caben en la K1 · T2 broches y patas ε ≤ ε_adm · T3 holgura de las colas = dfm.clearance
 *   I1 REGLAS.todoImprimible: tapas, grapas, remaches, tapa de la columna, difusor y campana existen como piezas
 *   S1–S5 estructura SF ≥ 2
 *   H1 PETG ≤ 70 °C · H2 la mesa sostiene 150–300 °C · H3 la oreja del MARCO (Silfos) · H4 K05 al aire: llega ≤ 70 °C a
 *   su tubo y no toca PETG caliente · H5 fuga (aviso) · H6 el termostato no abre de más y abre a tiempo · H7 la cuna del
 *   disipador de C: PETG ≤ 70 °C con el disipador a 90
 *   A1 ventilador de C · A2 escape de la LRS · A3 captura del humo ≥ REGLAS.capturaHumoMin (Dalla Valle)
 * Los hallazgos que corresponden a un PEDIDO (misma conexión y regla) salen con nivel 'contrato'.
 */
export function juzgarCuerpo(d: DisenoCuerpo): Hallazgo[] {
  const h: Hallazgo[] = [];
  const E = (regla: string, donde: string, texto: string) => h.push({ nivel: 'error', regla, donde, texto });
  const A = (regla: string, donde: string, texto: string) => h.push({ nivel: 'aviso', regla, donde, texto });
  const ajenas = BAHIAS.filter((b) => b.duenio !== 'B').map((b) => b.caja);
  for (const id of todasLasConexiones().map((c) => c.id)) if (!d.canales.some((c) => c.conexion.id === id)) E('C1', id, `${id}: no tiene canal`);
  for (const c of d.canales) {
    const id = c.conexion.id, r = c.ruta, [ia, ib] = extremos(c.conexion), PA = puertoO(ia), PB = puertoO(ib);
    const p = r.puntos, pc = r.canalPts ?? p;
    if (!PA || !PB) { E('C1', id, `${id}: el puerto ${!PA ? ia : ib} no está en el contrato`); continue; }
    const pa = PA.pos, pb = PB.pos;
    if (r.modo === 'sin-ruta' || p.length < 2) { E('C1', id, `${id}: sin canal de ${ia} a ${ib}${r.nota ? ` (${r.nota})` : ''}`); continue; }
    const igual = (u: V3, w: V3) => Math.hypot(u[0] - w[0], u[1] - w[1], u[2] - w[2]) < 0.5;
    if (!igual(p[0], pa) || !igual(p[p.length - 1], pb)) E('C1', id, `${id}: el canal no arranca/termina en sus puertos`);
    if (r.modo === 'astar') for (let s = 0; s + 1 < pc.length; s++) {
      const dd = [pc[s + 1][0] - pc[s][0], pc[s + 1][1] - pc[s][1], pc[s + 1][2] - pc[s][2]].filter((x) => Math.abs(x) > 1e-6).length;
      if (dd > 1) { E('C1', id, `${id}: el tramo ${s} no es recto (canal roto)`); break; }
    }
    if (r.modo === 'directo' && !c.conexion.puente) E('C1', id, `${id}: sin canal (puente de ${largo(p).toFixed(0)} mm) y el contrato no la declara puente`);
    if (r.modo === 'directo') {   // puente: los hilos de fábrica, sujetos con un peine a ≤ 25 mm de la soldadura de C
      const isla = [pa, pb].find((_, i) => (i ? PB : PA).modulo === 'PLACA_PCB') ?? pb;
      if (!c.peines.some((q) => Math.hypot(q.pos[0] - isla[0], q.pos[1] - isla[1], q.pos[2] - isla[2]) <= 25)) E('C7', id, `${id}: el puente no tiene peine a ≤ 25 mm de la soldadura`);
      continue;
    }
    if (r.seccion.llenado > REGLAS.llenadoMax) E('C2', id, `${id}: llenado ${(r.seccion.llenado * 100).toFixed(0)} % > ${REGLAS.llenadoMax * 100} % (${r.seccion.areaCables.toFixed(1)} mm² en ${r.seccion.w}×${r.seccion.d})`);
    const Rmin = radioDisponible(p, (i) => enAbanico(c.conexion, p[i]));
    if (Rmin < r.seccion.Rmin - 0.01) E('C3', id, `${id}: doblez de ${Rmin.toFixed(1)} mm < ${r.seccion.Rmin.toFixed(1)} (6 × Ø ${r.seccion.od})`);
    // C9: sale de su puerto a lo largo de dir y llega en contra de dir
    const dirTramo = (u: V3, w: V3) => { const v = [w[0] - u[0], w[1] - u[1], w[2] - u[2]], L = Math.hypot(...v) || 1; return v.map((x) => x / L); };
    const d0 = dirTramo(p[0], p[1]), d1 = dirTramo(p[p.length - 2], p[p.length - 1]);
    if (d0[0] * PA.dir[0] + d0[1] * PA.dir[1] + d0[2] * PA.dir[2] < 0.99) E('C9', id, `${id}: sale de ${ia} hacia (${d0.map((x) => x.toFixed(1)).join(', ')}) y el puerto mira a (${PA.dir.join(', ')})`);
    if (-(d1[0] * PB.dir[0] + d1[1] * PB.dir[1] + d1[2] * PB.dir[2]) < 0.99) E('C9', id, `${id}: llega a ${ib} yendo hacia (${d1.map((x) => x.toFixed(1)).join(', ')}) y el puerto mira a (${PB.dir.join(', ')})`);
    // muestreo del eje del canal
    const muestras: V3[] = [];
    for (let s = 0; s + 1 < p.length; s++) {
      const L = Math.hypot(p[s + 1][0] - p[s][0], p[s + 1][1] - p[s][1], p[s + 1][2] - p[s][2]), n = Math.max(1, Math.ceil(L / 2.5));
      for (let i = 0; i <= n; i++) muestras.push([p[s][0] + (p[s + 1][0] - p[s][0]) * i / n, p[s][1] + (p[s + 1][1] - p[s][1]) * i / n, p[s][2] + (p[s + 1][2] - p[s][2]) * i / n]);
    }
    const lejos = (q: V3) => Math.hypot(q[0] - pa[0], q[1] - pa[1], q[2] - pa[2]) > RADIO_ACOMETIDA && Math.hypot(q[0] - pb[0], q[1] - pb[1], q[2] - pb[2]) > RADIO_ACOMETIDA;
    const invade = muestras.find((q) => lejos(q) && ajenas.some((b) => dentroCaja(q[0], q[1], q[2], b, -0.5)));
    if (invade) E('C5', id, `${id}: el canal entra a una bahía ajena en (${invade.map((x) => x.toFixed(0)).join(', ')})`);
    if (r.modo === 'ducto') {
      // en el aire frío del ducto: el cable (doblado con su radio) a ≥ 2 mm del bloque caliente; el NTC entra al bloque
      const bl: Caja = { x0: MESA_G.bloque.x0, x1: MESA_G.bloque.x1, y0: MESA_G.bloque.y0, y1: MESA_G.bloque.y1, z0: MESA_G.bloque.zBase0 - 3, z1: MESA_G.bloque.zBase1 };
      const cam = suavizar(p, r.seccion.Rmin).filter((q) => Math.hypot(q[0] - pb[0], q[1] - pb[1], q[2] - pb[2]) > (id === 'K11' ? 8 : 0));
      const dmin = Math.min(...cam.map((q) => Math.hypot(Math.max(bl.x0 - q[0], 0, q[0] - bl.x1), Math.max(bl.y0 - q[1], 0, q[1] - bl.y1), Math.max(bl.z0 - q[2], 0, q[2] - bl.z1)))) - r.seccion.od / 2;
      // el cable vive en el aire FRÍO de la entrada (~4 m/s, h ≈ 50 W/m²K en un hilo): lo que le llega es radiación del
      // aluminio sin anodizar (ε 0.1) con F ≤ 0.5 → +ΔT; con ≥ 2 mm de aire en medio no hay conducción que importe
      const Tal = d.mesa.peor.T, Tcable = MESA_TERMICA.Tin + (0.5 * ALUMINIO.eps * 0.9 * SIGMA * ((Tal + 273.15) ** 4 - (MESA_TERMICA.Tin + 273.15) ** 4)) / 50;
      if (dmin < 2 || Tcable > 150) E('C6', id, `${id}: el cable pasa a ${dmin.toFixed(1)} mm del bloque (mínimo 2) y llega a ${Tcable.toFixed(0)} °C (silicona 200 °C)`);
    } else if (id !== 'K05') {
      const cal = muestras.find((q) => dentroCaja(q[0], q[1], q[2], ZONA_CALIENTE, r.seccion.r));
      if (cal) E('C6', id, `${id}: el canal pasa por la zona caliente de la mesa en (${cal.map((x) => x.toFixed(0)).join(', ')})`);
    }
    // C7: peine junto a cada extremo de su canal (K05: en C y donde entrega al aire; la oreja del marco es Silfos)
    const extremosCanal: V3[] = [pc[0], pc[pc.length - 1]];
    for (const pt of extremosCanal) {
      const pe = c.peines.find((q) => Math.hypot(q.pos[0] - pt[0], q.pos[1] - pt[1], q.pos[2] - pt[2]) <= 25);
      if (!pe) E('C7', id, `${id}: falta el peine junto a ${pt.map((x) => x.toFixed(0)).join(', ')} (alivio de la soldadura)`);
      else if (c.conexion.awg <= 10 && Math.hypot(pe.pos[0] - pt[0], pe.pos[1] - pt[1], pe.pos[2] - pt[2]) > 15) E('C7', id, `${id}: la abrazadera del cal ${c.conexion.awg} está a más de 15 mm de la isla soldada`);
      else if (c.conexion.awg <= 10 && pe.tipo !== 'abrazadera') E('C7', id, `${id}: el cal ${c.conexion.awg} lleva abrazadera (la soldadura no carga), no peine`);
    }
  }
  // C4: separación borde a borde entre potencia y señal (fuera de las zonas de los puertos que comparten)
  const pot = d.canales.filter((c) => c.ruta.modo === 'astar' && CLASE[c.conexion.funcion] === 'potencia');
  const sen = d.canales.filter((c) => c.ruta.modo === 'astar' && CLASE[c.conexion.funcion] === 'senal');
  for (const s of sen) for (const q of pot) {
    const comp = extremos(s.conexion).filter((x) => extremos(q.conexion).includes(x)).map((x) => puertoX(x).pos);
    const m = sepMin(s.ruta.puntos, q.ruta.puntos, comp) - (s.ruta.seccion.w + q.ruta.seccion.w) / 2;
    if (m < REGLAS.separacionPotenciaSenalMm - 0.01) E('C4', s.conexion.id, `${s.conexion.id} (señal) va a ${m.toFixed(1)} mm de ${q.conexion.id} (${q.conexion.funcion}); mínimo ${REGLAS.separacionPotenciaSenalMm}`);
  }
  if (d.lazo && d.lazo.areaCm2 > 50) A('C8', 'K05/K06', `lazo del arco ${d.lazo.areaCm2.toFixed(0)} cm² (${d.lazo.nota})`);
  if (!d.lazo) E('C10', 'K05/K06', 'el lazo del arco no se puede medir: K05 o K06 no tienen ruta');
  else if (d.lazo.sepMax > REGLAS.lazoArco.sepMaxMm + 0.01) E('C10', 'K05/K06', `K05 y K06 se separan ${d.lazo.sepMax.toFixed(1)} mm entre ejes de C al pie de la columna (máximo ${REGLAS.lazoArco.sepMaxMm})`);
  // tejas, camas y broches
  for (const t of d.tejas) {
    const [a, b, c] = cajaImpresion(t);
    if (!cabeEnLaCama(a, b, c)) E('T1', t.id, `${t.nombre}: ${a.toFixed(0)}×${b.toFixed(0)}×${c.toFixed(0)} no cabe en la K1 (${IMPRESORA.cama.join('×')} − ${IMPRESORA.margen})`);
  }
  for (const cm of d.camas) if (!cabeEnLaCama(...cm.caja)) E('T1', cm.id, `la cama ${cm.id}: ${cm.caja.map((x) => x.toFixed(0)).join('×')} no cabe en la K1`);
  for (const b of d.broches) { const e = epsBroche(b); if (e > PETG.epsAdm) E('T2', b.id, `broche ${b.donde}: ε = ${(e * 100).toFixed(2)} % > ${(PETG.epsAdm * 100).toFixed(1)} %`); }
  for (const pz of d.piezas) if (pz.broche) { const e = (1.5 * pz.broche.y * pz.broche.h) / pz.broche.L ** 2; if (e > PETG.epsAdm) E('T2', pz.id, `${pz.nombre}: sus patas doblan ε = ${(e * 100).toFixed(2)} % > ${(PETG.epsAdm * 100).toFixed(1)} %`); }
  const hol = clearance(PERFIL_K1);
  for (const u of d.uniones) if (u.tipo !== 'broche' && Math.abs(u.holgura - hol) > 1e-9) E('T3', u.id, `${u.id}: holgura ${u.holgura} ≠ ${hol} de dfm.clearance (PETG en la K1)`);
  // I1: todo lo que se cuenta sale como pieza (REGLAS.todoImprimible)
  if (REGLAS.todoImprimible) {
    const n = (g: PiezaImpresa['grupo']) => d.piezas.filter((p) => p.grupo === g).length;
    for (const c of d.canales) if (c.ruta.modo === 'astar' && c.ranuras > 0 && c.tapas < 1) E('I1', c.conexion.id, `${c.conexion.id}: su canal tiene ranuras de tapa y ninguna tapa impresa`);
    const pide: [PiezaImpresa['grupo'], number, string][] = [
      ['grapa', BROCHES.find((b) => b.id === 'col-col')!.n, 'grapas columna ↔ columna'], ['remache', BROCHES.find((b) => b.id === 'ducto-cub')!.n, 'remaches charola → cubierta'],
      ['tapa-columna', 1, 'tapa de arriba de la columna'], ['difusor', 1, 'difusor'], ['campana', 1, 'campana'],
    ];
    for (const [g, k, nombre] of pide) if (n(g) !== k) E('I1', g, `${nombre}: ${n(g)} piezas impresas y se cuentan ${k}`);
    for (const pz of d.piezas) {
      if (!pz.ops.some((o) => o.s > 0)) E('I1', pz.id, `${pz.nombre}: no tiene sólido`);
      if (!d.camas.some((cm) => cm.piezas.includes(pz.id))) E('I1', pz.id, `${pz.nombre}: no está en ninguna cama (sin STL)`);
    }
  }
  // estructura
  const s = d.estructura;
  if (s.SFcol < 2) E('S1', 'columna', `columna: σ ${s.sigma.toFixed(2)} MPa, SF ${s.SFcol.toFixed(1)} < 2`);
  if (s.SFesp < 2) E('S2', 'espiga', `junta de la columna: SF ${s.SFesp.toFixed(1)} < 2`);
  if (s.SFpie < 2) E('S3', 'pie', `pie de la columna: SF ${s.SFpie.toFixed(1)} < 2`);
  if (s.SFcub < 2) E('S4', 'cubierta', `cubierta bajo la mesa: SF ${s.SFcub.toFixed(1)} < 2`);
  if (s.SFposte < 2) E('S5', 'postes', `postes de silicato: SF ${s.SFposte.toFixed(1)} < 2`);
  // térmico
  for (const q of d.mesa.petg) if (q.T > PETG.tUso) E('H1', q.donde, `${q.donde}: PETG a ${q.T.toFixed(0)} °C > ${PETG.tUso} (${q.nota})`);
  const malos = d.mesa.control.filter((q) => !q.ok);
  if (malos.length) E('H2', 'mesa', `la mesa no sostiene ${malos.map((q) => q.Tset).join(', ')} °C con el escape ≤ ${MESA_TERMICA.TexMax} °C`);
  if (d.mesa.marco.T > SILFOS.solidus - 100) E('H3', 'MARCO', `el marco llega a ${d.mesa.marco.T.toFixed(0)} °C: a menos de 100 °C del sólido del Silfos (${SILFOS.solidus})`);
  if (d.mesa.fuga.sinVentilador > SILFOS.solidus) A('H3', 'MARCO', `con el ventilador muerto y el arco pegado la mesa llegaría a ${d.mesa.fuga.sinVentilador.toFixed(0)} °C: el termostato corta antes`);
  const k5 = d.k05;
  if (!k5) E('H4', 'K05', 'K05 sin tramo al aire (sin ruta): no se puede revisar el cobre caliente');
  else {
    if (k5.Tcanal > PETG.tUso) E('H4', 'K05', `K05 llega a ${k5.Tcanal.toFixed(0)} °C a su tubo de PETG (${k5.largo.toFixed(0)} mm al aire; el cobre necesita ${d.mesa.marco.largoCaliente.toFixed(0)} mm para bajar de ${d.mesa.marco.T.toFixed(0)} a 70 °C)`);
    for (const q of k5.holguras) if (q.material === 'PETG' && q.mm < 2) E('H4', 'K05', `K05 a ${q.T.toFixed(0)} °C pasa a ${q.mm.toFixed(1)} mm de ${q.donde} (PETG; mínimo 2 mm)`);
  }
  if (d.mesa.fuga.conVentilador > MESA_TERMICA.TexMax) A('H5', 'mesa', `fuga: con el arco pegado la mesa sube a ${d.mesa.fuga.conVentilador.toFixed(0)} °C (${d.mesa.fuga.sinVentilador.toFixed(0)} sin ventilador): el NTC corta por firmware y MESA.TERM (70 °C NC, en serie con SD) corta por hardware`);
  const tm = d.mesa.termostato, tg = MESA_G.termostato;
  if (tm.Tnormal > tg.abre - tg.tol) E('H6', 'MESA.TERM', `el piso bajo el termostato está a ${tm.Tnormal.toFixed(0)} °C en el punto de 300 °C: con su tolerancia (${tg.abre} − ${tg.tol}) abriría sin falla`);
  if (tm.TcentroAbre > 80) E('H6', 'MESA.TERM', `con el ventilador muerto el termostato abre cuando el piso del centro ya está a ${tm.TcentroAbre.toFixed(0)} °C (PETG Tg 80)`);
  const cn = d.cuna;
  for (const [donde, T] of [['tope de silicato: pared de PETG detrás', cn.Tpetg], ['pared del frente que ve el disipador', cn.Tvista], ['boca del difusor frente a las aletas', cn.Tboca]] as [string, number][])
    if (T > PETG.tUso) E('H7', 'cuna del disipador', `${donde}: PETG a ${T.toFixed(0)} °C con el disipador a ${CUNA_HS.Ths} °C`);
  if (cn.juego < 0) E('H7', 'cuna del disipador', `el tope de silicato se mete ${(-cn.juego).toFixed(1)} mm en el disipador`);
  // aire
  const a = d.aire;
  if (a.pcb.dT > 10) E('A1', 'ventilador de C', `el aire de C sube ${a.pcb.dT.toFixed(1)} K (${(a.pcb.Q * 3600).toFixed(0)} m³/h)`);
  if (a.pcb.Q * 3600 < AIRE_C.pide_m3h) E('A1', 'ventilador de C', `el ventilador de C da ${(a.pcb.Q * 3600).toFixed(1)} m³/h y C pide ≥ ${AIRE_C.pide_m3h} (${AIRE_C.fuente})`);
  if (a.lrs.fraccionPmax > 0.25) A('A2', 'LRS', `las rejillas de la LRS se comen ${(a.lrs.fraccionPmax * 100).toFixed(0)} % de la presión de sus ventiladores`);
  if (a.extractor.vCaptura < REGLAS.capturaHumoMin) E('A3', 'extractor', `la campana captura a ${a.extractor.vCaptura.toFixed(2)} m/s en el arco (Dalla Valle con pestaña, X ${(a.extractor.X * 1000).toFixed(0)} mm, ${a.extractor.m3h.toFixed(0)} m³/h) < ${REGLAS.capturaHumoMin} m/s`);
  // los pedidos
  for (const x of h) {
    const p = d.pedidos.find((q) => q.reglas.includes(x.regla) && (q.conexion ? q.conexion === x.donde : true) && (q.conexion || x.regla === 'A3'));
    if (p && x.nivel === 'error') { x.nivel = 'contrato'; x.texto += ` → CAMBIO DE CONTRATO PEDIDO ${p.id}`; }
  }
  return h;
}
/** separación mínima entre dos polilíneas (eje a eje), ignorando lo que está cerca de puertos compartidos */
function sepMin(a: V3[], b: V3[], exentos: V3[]): number {
  const pts = (p: V3[]) => { const o: V3[] = []; for (let s = 0; s + 1 < p.length; s++) { const L = Math.hypot(p[s + 1][0] - p[s][0], p[s + 1][1] - p[s][1], p[s + 1][2] - p[s][2]), n = Math.max(1, Math.ceil(L / 2.5)); for (let i = 0; i <= n; i++) o.push([p[s][0] + (p[s + 1][0] - p[s][0]) * i / n, p[s][1] + (p[s + 1][1] - p[s][1]) * i / n, p[s][2] + (p[s + 1][2] - p[s][2]) * i / n]); } return o; };
  const ok = (q: V3) => !exentos.some((e) => Math.hypot(q[0] - e[0], q[1] - e[1], q[2] - e[2]) < RADIO_PUERTO_COMPARTIDO);
  const A2 = pts(a).filter(ok), B2 = pts(b).filter(ok);
  let m = Infinity;
  for (const p of A2) for (const q of B2) { const dd = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (dd < m) m = dd; }
  return m;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// 13. PARA VERLO EN LA FORJA
// ════════════════════════════════════════════════════════════════════════════════════════════
export function piezasCuerpo(d: DisenoCuerpo): PiezaLab[] {
  const p: PiezaLab[] = [];
  const PETG_COLOR = '#d9dde3';
  for (const t of d.tejas) p.push({ id: `cuerpo-${t.id}`, name: t.nombre, kind: 'malla', url: t.url, x: 0, y: 0, z: 0, color: t.id.startsWith('col') ? '#c9ced6' : PETG_COLOR, mat: 'filamento', rayos: 0.18 });
  // las piezas sueltas: una malla por cama (menos mallas = menos llamadas de dibujo)
  const colorCama = (id: string) => (id.startsWith('tapas') ? '#e7eaee' : id === 'campana' ? '#d9dde3' : id === 'difusor' ? '#cfd6de' : '#bfc7d1');
  for (const cm of d.camas) p.push({ id: `cuerpo-${cm.id}`, name: `${cm.id} (${cm.piezas.length} pieza${cm.piezas.length > 1 ? 's' : ''})`, kind: 'malla', url: cm.url, x: 0, y: 0, z: 0, color: colorCama(cm.id), mat: 'filamento', rayos: 0.18 });
  for (const c of d.canales) {
    const r = c.ruta;
    if (r.puntos.length < 2) {   // sin ruta: la recta entre sus puertos, en rojo (lo que el juez marca)
      const [ia, ib] = extremos(c.conexion), A = puertoO(ia), B = puertoO(ib);
      if (A && B) p.push({ id: `canal-${c.conexion.id}`, name: `${c.conexion.id} · ${c.conexion.funcion} · SIN RUTA`, kind: 'tubo', path: [A.pos, B.pos], r: 1.2, x: 0, y: 0, z: 0, color: '#ff2d2d', mat: 'plastico', encima: true });
      continue;
    }
    const camino = c.conexion.id === 'K05' && d.k05 ? [...suavizar(r.canalPts ?? r.puntos, Math.min(r.seccion.Rmin, 30)), ...d.k05.curva.map((q) => q.p).reverse().slice(1)] : suavizar(r.puntos, Math.min(r.seccion.Rmin, 30));
    p.push({
      id: `canal-${c.conexion.id}`, name: `${c.conexion.id} · ${c.conexion.funcion} · ${c.largo.toFixed(0)} mm${r.modo !== 'astar' ? ` · ${r.modo === 'directo' ? 'PUENTE' : r.modo.toUpperCase()}` : ''}${c.conexion.id === 'K05' && d.k05 ? ` · ${d.k05.largo.toFixed(0)} al aire` : ''}`,
      kind: 'tubo', path: camino, r: Math.max(0.8, r.seccion.od * 0.6 + (c.conexion.hilos.length > 1 ? 0.6 : 0)),
      x: 0, y: 0, z: 0, color: r.modo === 'sin-ruta' ? '#ff2d2d' : COLOR_FUNCION_LAB[c.conexion.funcion], mat: 'plastico', encima: true,
    });
  }
  if (d.k05 && d.k05.manga > 0) p.push({ id: 'k05-manga', name: `K05 · manga de fibra de vidrio (${d.k05.manga.toFixed(0)} mm)`, kind: 'tubo', path: d.k05.curva.filter((q) => q.s <= d.k05!.manga).map((q) => q.p), r: OD_AWG[8].od / 2 + 0.6, x: 0, y: 0, z: 0, color: '#f3efe2', mat: 'goma' });
  // la embocadura de aluminio (lámina de 1 mm doblada en U, comprada/cortada) y lo de silicato
  const e = HUMO.embocadura;
  p.push({ id: 'embocadura', name: 'Embocadura de la campana (Al 1 mm en U, bocina arriba y a la derecha)', kind: 'grupo', x: 0, y: 0, z: 0, color: '#c9ced4', hijos: [
    { id: 'emb-techo', name: 'techo', kind: 'caja', w: e.gx1 + e.t - (CAMP.x0), d: e.y1 - e.y0, h: e.t, x: (CAMP.x0 + e.gx1 + e.t) / 2, y: (e.y0 + e.y1) / 2, z: e.gz1 + e.t / 2, color: '#c9ced4', mat: 'aluminio' },
    { id: 'emb-izq', name: 'lado izquierdo', kind: 'caja', w: e.t, d: e.y1 - e.y0, h: e.gz1 - CAMP.z0, x: CAMP.x0 + e.t / 2, y: (e.y0 + e.y1) / 2, z: (CAMP.z0 + e.gz1) / 2, color: '#c9ced4', mat: 'aluminio' },
    { id: 'emb-der', name: 'lado derecho', kind: 'caja', w: e.t, d: e.y1 - e.y0, h: e.gz1 - CAMP.z0, x: e.gx1 + e.t / 2, y: (e.y0 + e.y1) / 2, z: (CAMP.z0 + e.gz1) / 2, color: '#c9ced4', mat: 'aluminio' },
    { id: 'emb-bocina', name: 'bocina (labios enrollados)', kind: 'caja', w: CAMP.x1 - CAMP.x0, d: HUMO.labio, h: e.t, x: 0, y: e.y0 + HUMO.labio / 2, z: CAMP.z1 - e.t / 2, color: '#c9ced4', mat: 'aluminio', opacity: 0.8 },
  ] });
  if (d.k05?.silla) { const sl = d.k05.silla; p.push({ id: 'silla-k05', name: 'Silla de silicato bajo K05', kind: 'caja', w: sl.x1 - sl.x0, d: sl.y1 - sl.y0, h: 6, x: (sl.x0 + sl.x1) / 2, y: (sl.y0 + sl.y1) / 2, z: Z_CUB.z1 - 3, color: '#efe9dc', mat: 'ceramica' }); }
  const tp = CUNA_HS.tope;
  p.push({ id: 'tope-disipador', name: 'Tope de silicato de la cuna del disipador de C', kind: 'caja', w: tp.x1 - tp.x0, d: tp.y1 - tp.y0, h: tp.z1 - tp.z0, x: (tp.x0 + tp.x1) / 2, y: (tp.y0 + tp.y1) / 2, z: (tp.z0 + tp.z1) / 2, color: '#efe9dc', mat: 'ceramica' });
  const tm = MESA_G.termostato;
  p.push({ id: 'termostato-mesa', name: 'Termostato NC 70 °C de la mesa (MESA.TERM, acostado)', kind: 'caja', w: tm.largo, d: tm.ancho, h: tm.alto, x: tm.x, y: tm.y, z: MESA_G.piso.z1 + tm.alto / 2, color: '#9aa3ad', mat: 'aluminio' });
  // lo comprado
  p.push({ id: 'lrs', name: 'Mean Well LRS-1200-48', kind: 'malla', url: '/modelos/banco-arco/lrs-1200.bin', x: LRS_STEP.origen[0], y: LRS_STEP.origen[1], z: LRS_STEP.origen[2], rx: LRS_STEP.rx, color: '#c3c8ce', mat: 'aluminio' });
  const m = MESA_G;
  p.push({ id: 'placa-acero', name: 'Placa de trabajo 150×150×6', kind: 'caja', w: 150, d: 150, h: 6, x: 0, y: 0, z: -3, color: '#8f969e', mat: 'acero' });
  const al = d.mesa.aletas, nAl = al.alto ? Math.floor(144 / al.paso) : 0;
  p.push({ id: 'bloque', name: `Bloque de aluminio 160×160×6 + ${nAl} aletas de ${al.alto} mm`, kind: 'grupo', x: 0, y: 0, z: 0, color: '#b8bec6', hijos: [
    { id: 'bloque-base', name: 'base', kind: 'caja', w: 160, d: 160, h: 6, x: 0, y: 0, z: -9, color: '#b8bec6', mat: 'aluminio' },
    ...Array.from({ length: nAl }, (_, i) => ({ id: `aleta-${i}`, name: `aleta ${i + 1}`, kind: 'caja' as const, w: 160, d: al.t, h: al.alto, x: 0, y: -72 + al.paso * (i + 0.5), z: -12 - al.alto / 2, color: '#b8bec6', mat: 'aluminio' as const })),
  ] });
  p.push({ id: 'marco', name: 'Marco de cobre 20×3 embutido (contacto +)', kind: 'grupo', x: 0, y: 0, z: 0, color: '#c4572b', hijos: [
    { id: 'm1', name: 'lado', kind: 'caja', w: 150, d: 20, h: 3, x: 0, y: -65, z: -7.5, color: '#c4572b', mat: 'cobre' },
    { id: 'm2', name: 'lado', kind: 'caja', w: 150, d: 20, h: 3, x: 0, y: 65, z: -7.5, color: '#c4572b', mat: 'cobre' },
    { id: 'm3', name: 'lado', kind: 'caja', w: 20, d: 110, h: 3, x: -65, y: 0, z: -7.5, color: '#c4572b', mat: 'cobre' },
    { id: 'm4', name: 'lado', kind: 'caja', w: 20, d: 110, h: 3, x: 65, y: 0, z: -7.5, color: '#c4572b', mat: 'cobre' },
    { id: 'oreja', name: 'oreja del MARCO', kind: 'caja', w: 15, d: 20, h: 3, x: -82.5, y: 0, z: -6, color: '#c4572b', mat: 'cobre' },
  ] });
  for (const [x, y] of [[-74, -74], [74, -74], [-74, 74], [74, 74]]) p.push({ id: `poste-${x}-${y}`, name: 'poste de silicato Ø8×12', kind: 'cilindro', r: 4, h: 12, x, y, z: -16, color: '#efe9dc', mat: 'ceramica' });
  p.push({ id: 'tiras', name: 'Tiras de silicato 12×6 (tapan el hueco lateral)', kind: 'grupo', x: 0, y: 0, z: 0, color: '#efe9dc', hijos: [
    { id: 't1', name: 'tira', kind: 'caja', w: 160, d: 12, h: 6, x: 0, y: -86, z: -9, color: '#efe9dc', mat: 'ceramica' },
    { id: 't2', name: 'tira', kind: 'caja', w: 160, d: 12, h: 6, x: 0, y: 86, z: -9, color: '#efe9dc', mat: 'ceramica' },
  ] });
  p.push({ id: 'ntc', name: 'NTC 100 k de vidrio (en el bloque)', kind: 'cilindro', r: 1, h: 5, x: m.ntc[0], y: m.ntc[1], z: m.ntc[2] + 2.5, color: '#3f6fd6', mat: 'plastico' });
  const vm = m.vent;
  p.push({ id: 'vent-mesa', name: `Ventilador de la mesa ${VENT_MESA.nombre}`, kind: 'caja', w: vm.x1 - vm.x0, d: vm.y1 - vm.y0, h: vm.z1 - vm.z0, x: (vm.x0 + vm.x1) / 2, y: (vm.y0 + vm.y1) / 2, z: (vm.z0 + vm.z1) / 2, color: '#222', mat: 'plastico', rad: 3 });
  const vc = bahia('VENTILADOR').caja;
  p.push({ id: 'vent-pcb', name: `Ventilador de la placa ${VENT_PCB.nombre}`, kind: 'caja', w: vc.x1 - vc.x0, d: vc.y1 - vc.y0, h: vc.z1 - vc.z0, x: (vc.x0 + vc.x1) / 2, y: (vc.y0 + vc.y1) / 2, z: (vc.z0 + vc.z1) / 2, color: '#222', mat: 'plastico', rad: 3 });
  const ic = IEC_CUERPO;
  p.push({ id: 'iec', name: 'IEC C14 con interruptor y fusible', kind: 'caja', w: ic.x1 - ic.x0, d: ic.y1 - ic.y0, h: ic.z1 - ic.z0, x: (ic.x0 + ic.x1) / 2, y: (ic.y0 + ic.y1) / 2, z: (ic.z0 + ic.z1) / 2, color: '#1b1b1b', mat: 'plastico', rad: 2 });
  p.push({ id: 'paro', name: 'PARO de emergencia', kind: 'grupo', x: 110, y: -85, z: 0, color: '#d32f2f', hijos: [
    { id: 'hongo', name: 'hongo Ø40', kind: 'cilindro', r: 20, h: 14, x: 0, y: 0, z: -2, color: '#d32f2f', mat: 'plastico' },
    { id: 'cuello', name: 'cuello Ø22', kind: 'cilindro', r: 11, h: 10, x: 0, y: 0, z: -12, color: '#f2c94c', mat: 'plastico' },
    { id: 'contactos', name: 'bloque de contactos (2 NC + 1 NC aux)', kind: 'caja', w: 36, d: 36, h: 45, x: 0, y: 0, z: -40, color: '#e6e6e6', mat: 'plastico' },
  ] });
  return p;
}
/** redondea las esquinas de la polilínea con su radio (para que el tubo se vea como el cable doblado) */
export function suavizar(p: V3[], R: number): V3[] {
  if (p.length < 3) return p;
  const o: V3[] = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], b = p[i], c = p[i + 1];
    const la = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), lc = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]);
    const r = Math.min(R, i === 1 ? la : la / 2, i === p.length - 2 ? lc : lc / 2);   // el primer y el último tramo no se comparten
    const u: V3 = [(a[0] - b[0]) / la, (a[1] - b[1]) / la, (a[2] - b[2]) / la], w: V3 = [(c[0] - b[0]) / lc, (c[1] - b[1]) / lc, (c[2] - b[2]) / lc];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      // Bézier cuadrática b + u·r → b → b + w·r
      const q0: V3 = [b[0] + u[0] * r, b[1] + u[1] * r, b[2] + u[2] * r], q2: V3 = [b[0] + w[0] * r, b[1] + w[1] * r, b[2] + w[2] * r];
      o.push([(1 - t) ** 2 * q0[0] + 2 * (1 - t) * t * b[0] + t * t * q2[0], (1 - t) ** 2 * q0[1] + 2 * (1 - t) * t * b[1] + t * t * q2[1], (1 - t) ** 2 * q0[2] + 2 * (1 - t) * t * b[2] + t * t * q2[2]]);
    }
  }
  o.push(p[p.length - 1]);
  return o;
}
