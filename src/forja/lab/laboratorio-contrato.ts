/**
 * EL LABORATORIO DE LA PLUMA · EL CONTRATO (orden 2026-11-05-laboratorio-contrato · ronda 2: 2026-11-06-laboratorio-ronda2)
 * ======================================================================================================================
 * Divide y vencerás. Tres agentes diseñan tres partes de UNA máquina a la vez:
 *   A · EL MÓDULO DEL ALAMBRE: carrete + empuje (NEMA 17) + control de distancia + la punta
 *   B · EL CUERPO: la figura impresa que es estructura Y cableado (canales, sin tornillos)
 *   C · LA ELECTRÓNICA: una placa soldada, el mínimo de componentes, sin conectores de proto
 * Lo único que comparten es ESTE archivo: dónde vive cada quien (bahías), por dónde salen sus cables
 * (puertos) y qué se conecta con qué (conexiones). Nadie lo edita durante la ronda: si algo no cabe, el
 * agente diseña con lo que hay y escribe «CAMBIO DE CONTRATO PEDIDO» con números en su reporte.
 *
 * Marco: mm del doc, Z ARRIBA, origen = centro de la cara de arriba de la placa de trabajo.
 * El arco vive en el origen: la punta de contacto termina en z = 14, el alambre sale 12 mm (stickout)
 * y el arco mide ~2 mm hasta la placa (z = 0). DCEN: placa +, alambre −.
 *
 * RONDA 2 (2026-11-06): los 11 pedidos de la ronda 1 entran todos (CAMBIOS_R2 dice cuál, de quién y por qué), más dos
 * consecuencias que el orquestador encontró al juntarlos: la base crece con la columna (y1 230) y el IEC se va a la
 * pared nueva; el MARCO queda en x = −40, en el mismo plano que C.OUTP y A.POT (el lazo del arco más chico).
 */

export type V3 = [number, number, number];
export interface Caja { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
export type Agente = 'A' | 'B' | 'C' | 'comprada';

export const CONTRATO_RONDA = 2;

// ── LA IMPRESORA Y EL MATERIAL ──────────────────────────────────────────────────────────────
/** Creality K1 (src/forja/mech/printsim.ts): volumen 220 × 220 × 250. Toda pieza impresa cabe con 5 mm de margen. */
export const IMPRESORA = { nombre: 'Creality K1', cama: [220, 220, 250] as V3, margen: 5 };
/** SUPUESTO hasta que ian confirme: PETG (Tg ~80 °C → nada impreso arriba de 70 °C en uso). Ronda 2: se diseña para PETG (D1). */
export const MATERIAL = { nombre: 'PETG', tUsoMaxC: 70, supuesto: true };

// ── DECISIONES DEL ORQUESTADOR (lo que ian no contestó todavía; se diseña con esto y él lo puede voltear) ──
export interface Decision { id: string; tema: string; decision: string; porque: string; afecta: Agente[] }
export const DECISIONES: Decision[] = [
  { id: 'D1', tema: 'material', afecta: ['A', 'B'],
    decision: 'PETG para todo lo impreso; silicato de calcio clase 1000 °C en placa de 25 mm (k ≈ 0.07 W/mK, el SUPUESTO de B)',
    porque: 'la K1 imprime PETG sin cámara caliente; el silicato es el aislante rígido que se consigue en placa' },
  { id: 'D2', tema: 'SMD en la cara de abajo', afecta: ['C'],
    decision: 'sí: IR2110S y su bootstrap abajo, debajo de Q1 (lazo de compuerta ~10 mm contra 40 mm del DIP arriba)',
    porque: 'a 100 kHz con picos de 100 A el lazo de compuerta corto vale más que armar de un solo lado; a mano se suelda igual' },
  { id: 'D3', tema: 'soldar las islas de cal 8', afecta: ['C'],
    decision: 'cautín ≥ 80 W con punta cincel de 5 mm + la placa precalentada a ~100 °C con aire por abajo. Orden de armado: SMD abajo → piezas de arriba → islas de cal 8 al final',
    porque: '2 oz sin alivio térmico: un cautín de 60 W no llega a mojar la isla; el precalentado no derrite lo ya soldado' },
  { id: 'D4', tema: 'juntas calientes (portapuntas–OUT−, oreja del marco–OUT+)', afecta: ['A', 'B'],
    decision: 'soldadura fuerte Silfos (cobre-fósforo con 15 % de plata, la de los refrigeristas) con soplete MAP; fundente sólo si una cara es latón. Estaño sólo donde la junta vive < 150 °C',
    porque: 'el portapuntas llega a 357 °C y el marco a 300 °C: el estaño se derrite; Silfos funde a ~640 °C y se compra en cualquier refaccionaria de refrigeración' },
  { id: 'D5', tema: 'carrete abajo con el arco de PTFE', afecta: ['A'],
    decision: 'se acepta (~1 N de las 5.41 N del empuje); el balero de la loca es 625-ZZ',
    porque: 'el par sobra ×2.01 y el arco aísla al carrete de la retracción (f_n 0.38 Hz)' },
  { id: 'D6', tema: 'ventilador de la mesa', afecta: ['B', 'C'],
    decision: '80 × 80 × 38, 12 V, ~0.55 A (clase Delta AFB0812); K12 presupuesta 1 A',
    porque: 'el SUPUESTO de B da la mesa a 150–300 °C con ese caudal; C reserva corriente de sobra' },
];

// ── LAS BAHÍAS: el volumen de cada quien (no se invaden) ────────────────────────────────────
/** `cede` = volúmenes DENTRO de la caja que no son del dueño (una bahía en L sin inventar otro tipo). */
export interface Bahia { id: string; nombre: string; caja: Caja; duenio: Agente; nota: string; cede?: Caja[] }
export const BAHIAS: Bahia[] = [
  { id: 'PLACA', nombre: 'Placa de trabajo + marco de cobre (contacto +)', duenio: 'B',
    caja: { x0: -80, y0: -80, z0: -12, x1: 80, y1: 80, z1: 0 },
    nota: 'placa de acero 150×150×6 y marco de cobre (comprados/cortados) sobre la mesa disipadora de aluminio; B hace las mordazas impresas y el bolsillo' },
  { id: 'BASE', nombre: 'Base (envolvente exterior)', duenio: 'B',
    caja: { x0: -150, y0: -110, z0: -125, x1: 150, y1: 230, z1: -12 },
    nota: 'cubierta (deck) z −20…−12; piso z −125…−121; se parte en tejas que caben en la K1. R2: y1 190 → 230 para que el pie de la columna de 80 mm apoye completo' },
  { id: 'COLUMNA', nombre: 'Columna trasera (sostiene el módulo del alambre)', duenio: 'B',
    caja: { x0: -55, y0: 150, z0: -12, x1: 55, y1: 230, z1: 360 },
    nota: 'riel de cola de milano en su cara y = 150 donde ENTRA el módulo A; ducto del extractor adentro y collar Ø100 atrás (y = 230) a z ≈ 10, a la altura de la garganta de la campana (arriba, los dos codos dejaban 0.416 m/s). R2: 80 de fondo (P3/P5/P10)' },
  { id: 'CAMPANA', nombre: 'Campana de humo (boca baja, detrás de la placa)', duenio: 'B',
    caja: { x0: -45, y0: 96, z0: -12, x1: 45, y1: 150, z1: 24 },
    nota: 'R2 (P5): la boca mira a −y desde y ≈ 96 (84 mm del arco contra 150 de la boca al pie de la columna) y su garganta entra al ducto de la columna. Lleva por dentro el tramo al aire de K05 (el cobre se enfría antes de tocar PETG)' },
  { id: 'ALAMBRE', nombre: 'Módulo del alambre (carrete + empuje + punta)', duenio: 'A',
    caja: { x0: -80, y0: -45, z0: 24, x1: 80, y1: 150, z1: 360 },
    nota: 'se desliza en el riel de la columna (cara y = 150) y se queda por presión/broche, sin tornillos' },
  { id: 'LANZA', nombre: 'La lanza: guía recta + punta de contacto', duenio: 'A',
    caja: { x0: -14, y0: -14, z0: 10, x1: 14, y1: 14, z1: 24 },
    nota: 'la punta de contacto termina en z = 14 sobre el origen; de aquí para arriba el alambre va GUIADO hasta el rodillo' },
  { id: 'LRS', nombre: 'Fuente Mean Well LRS-1200-48 (comprada)', duenio: 'comprada',
    caja: { x0: -110, y0: 60, z0: -121, x1: 125, y1: 184, z1: -78 },
    nota: 'acostada (230 × 124 × 41, STEP en models/step/banco-arco/LRS-1200-3D.stp); su bornera mira a −x con 36 mm libres hasta la pared (radio de doblez del cal 10)' },
  { id: 'PLACA_PCB', nombre: 'La placa electrónica (y su disipador, choque y capacitores)', duenio: 'C',
    caja: { x0: -119, y0: -100, z0: -121, x1: 85, y1: 48, z1: -26 },
    cede: [{ x0: -119, y0: -100, z0: -121, x1: -96, y1: 10, z1: -26 }],
    nota: 'C usa lo que necesite DENTRO; el resto lo aprovecha B para canales y aire. USB en el borde del frente (y = −100). R2: z1 −24 → −26 (P7: 2 mm de aire bajo el piso del ducto de la mesa) y cede x −119…−96 en y −100…10 al difusor (P8)' },
  { id: 'DIFUSOR', nombre: 'Difusor del ventilador de la placa (80 → 125 mm)', duenio: 'B',
    caja: { x0: -121, y0: -100, z0: -121, x1: -96, y1: 10, z1: -26 },
    nota: 'R2 (P8): abre el chorro del ventilador de 80 al disipador de 125 a 45° por lado; mismo caudal de operación (~37 m³/h a 11 Pa)' },
  { id: 'VENTILADOR', nombre: 'Ventilador de la placa (80 × 80 × 25)', duenio: 'B',
    caja: { x0: -146, y0: -80, z0: -110, x1: -121, y1: 0, z1: -30 },
    nota: 'pared izquierda, sopla hacia +x por el difusor sobre el disipador de C; salida por rejillas de la pared derecha' },
  { id: 'IEC', nombre: 'Entrada de AC: IEC C14 con interruptor y fusible (comprada)', duenio: 'B',
    caja: { x0: -146, y0: 190, z0: -110, x1: -114, y1: 230, z1: -50 },
    nota: 'pared trasera (R2: la pared se fue a y = 230 con la base)' },
  { id: 'PARO', nombre: 'PARO de emergencia (hongo arriba, bloque de contactos abajo)', duenio: 'B',
    caja: { x0: 90, y0: -105, z0: -62, x1: 130, y1: -65, z1: -12 },
    nota: 'en la cubierta, adelante a la derecha: a la mano' },
];

// ── LA INTERFAZ MECÁNICA ENTRE A Y B: el riel de la columna ─────────────────────────────────
/**
 * Cola de milano VERTICAL en la cara y = 150 de la columna. B hace la HEMBRA (ranura en la columna), A hace el MACHO
 * (lengüeta en la espalda de su módulo) con la holgura de deslizamiento de dfm.ts para el material. El módulo entra
 * de arriba hacia abajo y lo detiene un tope en z0; un broche (snap) en z1 lo deja atrapado sin tornillos.
 * Las ventanas de los puertos A.POT y A.SEN atraviesan la columna: B las abre, A pone ahí sus salidas.
 */
export const RIEL = {
  cara: 'y = 150 (la columna está detrás, en y > 150)',
  centroX: 0, anchoBoca: 30, anchoFondo: 40, profundidad: 8,   // trapecio: boca (en la cara) 30, fondo 40 (adentro de la columna)
  z0: 40, z1: 340,                                              // tope abajo, broche arriba
  ventanas: [{ puerto: 'A.POT', ancho: 22, alto: 22 }, { puerto: 'A.SEN', ancho: 18, alto: 14 }],
};

// ── LOS PUERTOS: por dónde cruza cada cable la frontera de su módulo ────────────────────────
export interface Puerto { id: string; modulo: string; pos: V3; dir: V3; nota?: string }
/**
 * dir = normal HACIA AFUERA del módulo. Los dueños ponen ahí la salida; B lleva el canal de puerto a puerto.
 * Un puerto entre dueños distintos vive en una CARA de su bahía; uno de un componente de B (ventilador de la mesa,
 * termostato) puede vivir adentro de la bahía de B, porque B es quien rutea.
 */
export const PUERTOS: Puerto[] = [
  { id: 'A.POT', modulo: 'ALAMBRE', pos: [-40, 150, 210], dir: [0, 1, 0], nota: 'OUT− grueso hasta la punta de contacto. R2: z 60 → 210 (pedido de A: el cable ya sube junto al cuello; se ahorran ~150 mm de cal 8)' },
  { id: 'A.SEN', modulo: 'ALAMBRE', pos: [40, 150, 120], dir: [0, 1, 0], nota: 'NEMA 17 (4 hilos) + AS5600 (3 hilos)' },
  { id: 'C.BUS', modulo: 'PLACA_PCB', pos: [-100, 48, -60], dir: [0, 1, 0], nota: 'BUS+ y BUS− de la LRS' },
  { id: 'C.OUTP', modulo: 'PLACA_PCB', pos: [-40, 48, -60], dir: [0, 1, 0], nota: 'OUT+ hacia el marco de cobre. R2 (P1): junto a C.OUTN, sale hacia atrás' },
  { id: 'C.OUTN', modulo: 'PLACA_PCB', pos: [-20, 48, -60], dir: [0, 1, 0], nota: 'OUT− hacia el módulo A' },
  { id: 'C.SEN', modulo: 'PLACA_PCB', pos: [40, 48, -40], dir: [0, 1, 0], nota: 'motor + encoder hacia el módulo A' },
  { id: 'C.FAN', modulo: 'PLACA_PCB', pos: [-119, 20, -50], dir: [-1, 0, 0], nota: 'R2 (P2/P8): fuera del difusor; K09 llega como puente directo' },
  { id: 'C.PARO', modulo: 'PLACA_PCB', pos: [85, -85, -50], dir: [1, 0, 0], nota: 'contacto auxiliar NC del PARO. R2 (P4): cara derecha, fuera del ducto de la mesa' },
  { id: 'C.USB', modulo: 'PLACA_PCB', pos: [40, -100, -100], dir: [0, -1, 0], nota: 'el USB del micro asoma por el frente (B abre la ventana)' },
  { id: 'C.MESA', modulo: 'PLACA_PCB', pos: [80.5, -69, -26], dir: [0, 0, 1], nota: 'R2 (P6): NTC, ventilador y termostato de la mesa; cara de arriba, bajo la entrada fría del ducto' },
  { id: 'LRS.T', modulo: 'LRS', pos: [-110, 120, -100], dir: [-1, 0, 0], nota: 'bornera: AC (L, N, FG) adelante en y ≈ 80 y DC (V+, V−) atrás en y ≈ 150, leídas del STEP por B' },
  { id: 'IEC', modulo: 'IEC', pos: [-130, 190, -80], dir: [0, -1, 0], nota: 'las patas del IEC miran hacia adentro' },
  { id: 'PARO', modulo: 'PARO', pos: [110, -85, -62], dir: [0, 0, -1], nota: '2 NC de potencia (L y N) + 1 NC auxiliar, por abajo' },
  { id: 'MARCO', modulo: 'PLACA', pos: [-40, 80, -9], dir: [0, 1, 0], nota: 'oreja del marco de cobre (+), cara de atrás. R2 (P1): en x = −40, el plano de C.OUTP y A.POT: K05 y K06 viajan juntos' },
  { id: 'MESA.NTC', modulo: 'PLACA', pos: [78, -69, -12], dir: [0, 0, -1], nota: 'NTC 100 k de vidrio en un barreno Ø2 vertical en la cara de abajo del bloque' },
  { id: 'MESA.TERM', modulo: 'BASE', pos: [45, -60, -22], dir: [1, 0, 0], nota: 'termostato NC 70 °C PLANO (clase KSD9700) acostado sobre el piso del ducto, bajo el bloque: si el ventilador de la mesa muere, el piso se calienta por radiación y corta. R2 (P9 de B): de pie no cabía (7 mm entre piso y aletas)' },
  { id: 'VMESA', modulo: 'BASE', pos: [108, -47, -95], dir: [-1, 0, 0], nota: 'hilos del ventilador de la mesa (esquina de su cara de salida)' },
  { id: 'FAN', modulo: 'VENTILADOR', pos: [-121, -40, -70], dir: [1, 0, 0] },
];

// ── LAS CONEXIONES: el netlist entre módulos (C puede subir calibres; nadie agrega cables sin pedirlo) ──
export type Funcion = 'ac' | 'pe' | 'bus' | 'potencia' | 'motor' | 'senal' | 'ventilador';
export interface Conexion {
  id: string; de: string; a: string; hilos: string[]; funcion: Funcion;
  Irms: number; Ipico?: number; V: number; awg: number; par?: boolean; nota?: string;
  /** sin canal: los hilos de fábrica del componente se sueldan directo al pad; B sólo los sujeta con un peine */
  puente?: boolean;
}
/** Números de la Pluma (plumaSistema.ts, orden I): bus 25 A rms, salida 40 A rms con picos de 100 A del bang-bang. */
export const CONEXIONES: Conexion[] = [
  { id: 'K01', de: 'IEC', a: 'PARO', hilos: ['L', 'N'], funcion: 'ac', Irms: 6.6, V: 230, awg: 16, par: true, nota: 'el PARO corta los DOS polos' },
  { id: 'K02', de: 'PARO', a: 'LRS.T', hilos: ['L', 'N'], funcion: 'ac', Irms: 6.6, V: 230, awg: 16, par: true },
  { id: 'K03', de: 'IEC', a: 'LRS.T', hilos: ['PE'], funcion: 'pe', Irms: 0, V: 0, awg: 16 },
  { id: 'K04', de: 'LRS.T', a: 'C.BUS', hilos: ['V+', 'V−'], funcion: 'bus', Irms: 25, Ipico: 27, V: 48, awg: 10, par: true },
  { id: 'K05', de: 'C.OUTP', a: 'MARCO', hilos: ['OUT+'], funcion: 'potencia', Irms: 40, Ipico: 100, V: 48, awg: 8,
    nota: 'R2: sale de C junto a K06 y llega al marco por atrás; su primer tramo desde el marco va al aire dentro de la campana (D4: Silfos en la oreja)' },
  { id: 'K06', de: 'C.OUTN', a: 'A.POT', hilos: ['OUT−'], funcion: 'potencia', Irms: 40, Ipico: 100, V: 48, awg: 8,
    nota: 'K05 y K06 son el lazo del arco: viajan JUNTOS (REGLAS.lazoArco) de C hasta el pie de la columna' },
  { id: 'K07', de: 'C.SEN', a: 'A.SEN', hilos: ['A+', 'A−', 'B+', 'B−'], funcion: 'motor', Irms: 1.4, V: 12, awg: 22, par: true,
    nota: 'R2: VM 12 V (pedido de C); A corre a 0.85 A rms, 1.4 es el tope del TMC2209 sin pasar de ~100 °C' },
  { id: 'K08', de: 'C.SEN', a: 'A.SEN', hilos: ['3V3', 'GND', 'ENC'], funcion: 'senal', Irms: 0.02, V: 3.3, awg: 26, nota: 'AS5600 en modo analógico; LEJOS de K06' },
  { id: 'K09', de: 'C.FAN', a: 'FAN', hilos: ['+12', '−'], funcion: 'ventilador', Irms: 0.25, V: 12, awg: 24, par: true, puente: true,
    nota: 'R2 (P2): puente directo, los hilos de fábrica del ventilador al pad de C' },
  { id: 'K10', de: 'C.PARO', a: 'PARO', hilos: ['AUX1', 'AUX2'], funcion: 'senal', Irms: 0.01, V: 3.3, awg: 24, par: true },
  { id: 'K11', de: 'C.MESA', a: 'MESA.NTC', hilos: ['NTC', 'GND'], funcion: 'senal', Irms: 0.001, V: 3.3, awg: 24, par: true,
    nota: 'R2 (P6): NTC de la mesa; silicona de 200 °C en el aire frío de la entrada del ducto' },
  { id: 'K12', de: 'C.MESA', a: 'VMESA', hilos: ['+12', '−'], funcion: 'ventilador', Irms: 1.0, V: 12, awg: 22, par: true,
    nota: 'R2 (P6): ventilador de la mesa (D6)' },
  { id: 'K13', de: 'C.MESA', a: 'MESA.TERM', hilos: ['T1', 'T2'], funcion: 'senal', Irms: 0.01, V: 3.3, awg: 24, par: true,
    nota: 'R2 (pedido de B a C): termostato NC 70 °C en serie con el del disipador en la cadena de apagado (SD)' },
  { id: 'K14', de: 'C.SEN', a: 'A.SEN', hilos: ['T1', 'T2'], funcion: 'senal', Irms: 0.01, V: 3.3, awg: 24, par: true,
    nota: 'R2 (pedido de A): termostato NC 70 °C ±3 (KSD301) con la tapa contra el inserto de silicato del zócalo del cuello, en serie en la misma cadena SD; viaja con K08 (señal). Con la pluma directa (0 % de captura, el caso de diseño) lee 62.3 °C y no corta; en falla corta a ≤ 73 °C, antes del límite de respaldo de 75 (Tg − 5)' },
];

// ── REGLAS COMUNES (las tres partes las cumplen y las prueban) ──────────────────────────────
export const REGLAS = {
  /** el alambre está a potencial OUT− (≈ tierra del bus por el shunt): la ÚNICA entrada de corriente es la punta de contacto.
   *  Rodillo, NEMA y encoder NO pueden formar un camino paralelo (el PETG los aísla; nada metálico los une a OUT−). */
  unicaEntradaDeCorriente: 'punta',
  /** todo se SUELDA (ian: los protos siempre meten falsos contactos). Excepciones con razón escrita: bornera de la LRS,
   *  el IEC, el PARO (sus terminales son de tornillo/faston de fábrica). */
  soldado: true,
  /** separación entre canales de potencia (ac, bus, potencia, motor) y de señal */
  separacionPotenciaSenalMm: 15,
  /** llenado máximo de un canal (área de cables / área del canal) */
  llenadoMax: 0.4,
  /** radio mínimo de doblez = k · diámetro exterior del cable */
  dobladoMinK: 6,
  /** sin tornillos donde se pueda: broches (snap), colas de milano, ajuste a presión, bisagras impresas en su lugar */
  sinTornillos: true,
  /** R2 (P5): velocidad de captura del humo EN EL ARCO (Dalla Valle, boca con pestaña), m/s */
  capturaHumoMin: 0.5,
  /** R2 (P1): K05 y K06 a ≤ sepMaxMm entre ejes desde C hasta el pie de la columna (el lazo del arco) */
  lazoArco: { sepMaxMm: 25 },
  /** R2: lo que el juez cuenta (tapas, broches, cubiertas) sale como PIEZA imprimible con su STL, no como número */
  todoImprimible: true,
};

// ── LO QUE CAMBIÓ EN LA RONDA 2 (para los jueces y para leerlo sin abrir los reportes) ──────
export interface CambioR2 { id: string; pidio: Agente | 'orquestador'; que: string; porque: string }
export const CAMBIOS_R2: CambioR2[] = [
  { id: 'P1', pidio: 'B', que: 'C.OUTP a (−40, 48, −60) +y junto a C.OUTN; MARCO a la cara de atrás (−40, 80, −9) +y', porque: 'el cal 8 no voltea en 18 mm bajo la mesa y el marco a 300 °C necesita su tramo al aire' },
  { id: 'P2', pidio: 'B', que: 'K09 puente directo; C.FAN a (−119, 20, −50)', porque: 'no cabía un canal en 2 mm' },
  { id: 'P3', pidio: 'B', que: 'COLUMNA y1 190 → 230', porque: 'el cal 8 de A.POT voltea con 41 mm y había ~30' },
  { id: 'P4', pidio: 'B', que: 'C.PARO a (85, −85, −50) +x', porque: 'caía dentro del ducto de la mesa' },
  { id: 'P5', pidio: 'B', que: 'bahía CAMPANA y REGLAS.capturaHumoMin 0.5 m/s', porque: 'la boca al pie de la columna capturaba a 0.29 m/s' },
  { id: 'P6', pidio: 'B', que: 'C.MESA, MESA.NTC, VMESA, MESA.TERM; K11, K12, K13', porque: 'la mesa disipadora necesita su NTC, su ventilador y un termostato que corte si el ventilador muere' },
  { id: 'P7', pidio: 'B', que: 'PLACA_PCB z1 −24 → −26', porque: '2 mm de aire bajo el piso del ducto de la mesa' },
  { id: 'P8', pidio: 'B', que: 'PLACA_PCB cede x −119…−96 en y −100…10; bahía DIFUSOR', porque: 'el chorro de 80 cubría 78 de los 125 mm del disipador' },
  { id: 'A1', pidio: 'A', que: 'A.POT z 60 → 210', porque: 'el OUT− ya sube junto al cuello: se ahorran ~150 mm de cal 8' },
  { id: 'C1', pidio: 'C', que: 'K07 a 12 V, Irms tope 1.4', porque: 'el TMC2209 a 1.7 A llega a ~117 °C; A corre a 0.85 A' },
  { id: 'P9', pidio: 'B', que: 'MESA.TERM a (45, −60, −22) +x, termostato plano clase KSD9700', porque: 'de pie no cabía: 7 mm entre el piso del ducto y las aletas' },
  { id: 'P10', pidio: 'B', que: 'collar del extractor a z ≈ 10', porque: 'abajo, junto a la garganta de la campana, sin los dos codos: 0.525 m/s en el arco contra 0.416' },
  { id: 'A2', pidio: 'A', que: 'K14: termostato NC 70 °C ±3 en el zócalo del cuello, en serie en la cadena SD', porque: 'el zócalo se diseña sin contar con la campana (inserto de silicato: PETG a 62.3 °C con la pluma directa); el termostato es el respaldo si algo más falla; un termostato donde está el daño es 1 pieza y 2 hilos, contra un sensor de flujo en el extractor' },
  { id: 'O1', pidio: 'orquestador', que: 'BASE y1 190 → 230; IEC a y 190…230', porque: 'la columna de 80 mm quedaba 40 mm volada atrás de la base' },
  { id: 'O2', pidio: 'orquestador', que: 'MARCO en x = −40 (B lo pidió en x = 0); REGLAS.lazoArco', porque: 'K05 y K06 en el mismo plano que C.OUTP y A.POT: el lazo más chico' },
  { id: 'O3', pidio: 'orquestador', que: 'REGLAS.todoImprimible', porque: 'en la ronda 1 las tapas y los broches de la columna quedaron como números' },
];

// ── LA PIEZA PARA VERLA EN LA FORJA (la misma forma que RefPart del estudio) ────────────────
export type MatLab = 'acero' | 'aluminio' | 'cromo' | 'cobre' | 'laton' | 'plastico' | 'goma' | 'pintura' | 'ceramica' | 'pcb' | 'filamento';
export interface PiezaLab {
  id: string; name: string; kind: 'malla' | 'caja' | 'cilindro' | 'torno' | 'tubo' | 'placa' | 'grupo';
  url?: string;                         // 'malla': .bin FMSH bajo /modelos/laboratorio/…
  w?: number; d?: number; h?: number; r?: number; rad?: number; lados?: number;
  perfil?: [number, number][]; path?: V3[]; hijos?: PiezaLab[];
  x: number; y: number; z: number; rx?: number; ry?: number; rz?: number;
  color: string; opacity?: number; metalness?: number; mat?: MatLab; aristas?: boolean; encima?: boolean; rayos?: number;
}

// ── utilidades del contrato ─────────────────────────────────────────────────────────────────
export const bahia = (id: string): Bahia => { const b = BAHIAS.find((x) => x.id === id); if (!b) throw new Error(`bahía ${id}`); return b; };
export const puerto = (id: string): Puerto => { const p = PUERTOS.find((x) => x.id === id); if (!p) throw new Error(`puerto ${id}`); return p; };
export const dentro = (p: V3, c: Caja, tol = 0) =>
  p[0] >= c.x0 - tol && p[0] <= c.x1 + tol && p[1] >= c.y0 - tol && p[1] <= c.y1 + tol && p[2] >= c.z0 - tol && p[2] <= c.z1 + tol;
/** adentro de la bahía Y fuera de lo que cede (para PLACA_PCB: fuera del difusor). Estrictamente adentro de lo cedido = no. */
export const enBahia = (p: V3, b: Bahia, tol = 0) =>
  dentro(p, b.caja, tol) && !(b.cede ?? []).some((c) => p[0] > c.x0 && p[0] < c.x1 && p[1] > c.y0 && p[1] < c.y1 && p[2] > c.z0 && p[2] < c.z1);
/** volumen en común de dos cajas (0 si sólo se tocan) */
export const traslape = (a: Caja, b: Caja) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
export const cabeEnLaCama = (dx: number, dy: number, dz: number) => {
  const [X, Y, Z] = IMPRESORA.cama, m = IMPRESORA.margen;
  const [a, b] = [dx, dy].sort((u, v) => v - u);
  return a <= X - 2 * m && b <= Y - 2 * m && dz <= Z - m;
};
