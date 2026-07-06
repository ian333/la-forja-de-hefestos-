/**
 * 200 COMPONENTES REALES — dimensiones de NORMA (no inventadas) para recrearlos
 * a manita con el SDK de La Forja y aprender las limitaciones.
 *
 * Fuente = la norma/datasheet de cada familia (DIN/ISO/JEDEC/series de rodamiento/
 * NEMA). Son dimensiones de ingeniería establecidas (lo que un dibujante usa). Cada
 * entrada lleva el `builder` (cómo recrearla con el SDK) y `cant` (qué NO captura el
 * tool hoy = la limitación que probamos).
 */

// ── helpers ──
const E = (name, family, builder, dims, source, cant) => ({ name, family, builder, dims, source, cant });

const items = [];
const push = (...a) => items.push(...a);

// ════════ 1) SUJETADORES (DIN/ISO) — [thread_d, head_AF, head_h, len] ════════
// DIN 933 / ISO 4017 tornillo hexagonal: AF entre caras, altura de cabeza.
const HEX_BOLT = { M3:[3,5.5,2], M4:[4,7,2.8], M5:[5,8,3.5], M6:[6,10,4], M8:[8,13,5.3], M10:[10,17,6.4], M12:[12,19,7.5], M16:[16,24,10] };
for (const [k, [d, af, h]] of Object.entries(HEX_BOLT))
  push(E(`Tornillo hex ${k}×${d * 3} (DIN933)`, 'fastener', 'boltHex', { thread_d: d, head_af: af, head_h: h, length: d * 3 }, 'DIN 933 / ISO 4017', 'sin rosca; cabeza+vástago = 2 cuerpos'));
// DIN 934 / ISO 4032 tuerca hexagonal: [AF, thickness]
const HEX_NUT = { M3:[5.5,2.4], M4:[7,3.2], M5:[8,4.7], M6:[10,5.2], M8:[13,6.8], M10:[17,8.4], M12:[19,10.8] };
for (const [k, [af, t]] of Object.entries(HEX_NUT))
  push(E(`Tuerca hex ${k} (DIN934)`, 'fastener', 'nutHex', { af, thick: t, bore: +k.slice(1) }, 'DIN 934 / ISO 4032', 'sin rosca interna'));
// ISO 7089 arandela plana: [ID, OD, thickness]
const WASHER = { M3:[3.2,7,0.5], M4:[4.3,9,0.8], M5:[5.3,10,1], M6:[6.4,12,1.6], M8:[8.4,16,1.6], M10:[10.5,20,2], M12:[13,24,2.5] };
for (const [k, [id, od, t]] of Object.entries(WASHER))
  push(E(`Arandela plana ${k} (ISO7089)`, 'fastener', 'washer', { id, od, thick: t }, 'ISO 7089', 'ok (anillo plano)'));
// DIN 912 socket head cap screw: [thread_d, head_d, head_h]
const SHCS = { M3:[3,5.5,3], M4:[4,7,4], M5:[5,8.5,5], M6:[6,10,6], M8:[8,13,8], M10:[10,16,10] };
for (const [k, [d, hd, hh]] of Object.entries(SHCS))
  push(E(`Tornillo Allen ${k}×${d * 4} (DIN912)`, 'fastener', 'capScrew', { thread_d: d, head_d: hd, head_h: hh, length: d * 4 }, 'DIN 912 / ISO 4762', 'sin rosca; hexágono interno del Allen no modelado'));

// ════════ 2) RODAMIENTOS — [ID, OD, width] ════════
const BEARING = {
  '608':[8,22,7],'623':[3,10,4],'624':[4,13,5],'625':[5,16,5],'626':[6,19,6],'627':[7,22,7],'688':[8,16,5],'698':[8,19,6],
  '6000':[10,26,8],'6001':[12,28,8],'6002':[15,32,9],'6003':[17,35,10],'6004':[20,42,12],
  '6200':[10,30,9],'6201':[12,32,10],'6202':[15,35,11],'6203':[17,40,12],'6204':[20,47,14],
  '6800':[10,19,5],'6801':[12,21,5],'6802':[15,24,5],
};
for (const [k, [id, od, w]] of Object.entries(BEARING))
  push(E(`Rodamiento ${k}ZZ`, 'bearing', 'bearing', { id, od, width: w }, `serie ${k} (ISO 15)`, 'sin bolas/jaula/pistas; solo anillo macizo'));
// Bujes lineales LMxUU — [ID, OD, length]
const LM = { LM6UU:[6,12,19], LM8UU:[8,15,24], LM10UU:[10,19,29], LM12UU:[12,21,30] };
for (const [k, [id, od, l]] of Object.entries(LM))
  push(E(`Buje lineal ${k}`, 'bearing', 'bearing', { id, od, width: l }, 'estándar LMxUU', 'sin balineras/recirculación'));

// ════════ 3) PAQUETES DE POTENCIA (JEDEC) — body box + patas ════════
// [body_w, body_thick, body_tall, leads, pitch, lead_d, lead_len]
const PKG = [
  ['TO-92 (2N2222)', 4.8, 4.0, 5.2, 3, 1.27, 0.4, 14],
  ['TO-126', 7.8, 2.8, 10.6, 3, 2.3, 0.7, 12],
  ['TO-220 (IRF540)', 10.16, 4.58, 8.7, 3, 2.54, 0.6, 13],
  ['TO-220F aislado', 10.16, 2.5, 9.0, 3, 2.54, 0.6, 13],
  ['TO-247 (IGBT)', 15.9, 5.0, 20.0, 3, 5.45, 0.8, 20],
  ['TO-263 D2PAK', 10.0, 4.5, 15.0, 3, 2.54, 0.8, 2],
  ['TO-252 DPAK', 6.5, 2.3, 6.1, 3, 2.28, 0.7, 1.5],
  ['SOT-23', 2.9, 1.3, 1.1, 3, 1.9, 0.4, 0.5],
  ['SOT-223', 6.5, 1.6, 3.5, 4, 2.3, 0.7, 1.8],
  ['DO-41 (1N4007)', 2.7, 2.7, 5.2, 2, 0, 0.8, 28],
  ['DO-201 (1N5408)', 5.2, 5.2, 9.5, 2, 0, 1.3, 30],
  ['Bridge KBPC', 28.6, 28.6, 8.6, 4, 12, 1.2, 18],
  ['Bridge GBU', 18.8, 18.8, 3.7, 4, 5, 1.0, 16],
  ['TRIAC BTA16 TO-220', 10.16, 4.58, 8.7, 3, 2.54, 0.6, 13],
  ['SCR TO-247', 15.9, 5.0, 20.0, 3, 5.45, 0.8, 20],
];
for (const [name, bw, bt, bh, legs, pitch, ld, ll] of PKG)
  push(E(name, 'power', legs === 2 ? 'diode' : 'package', { body_w: bw, body_t: bt, body_h: bh, leads: legs, pitch, lead_d: ld, lead_len: ll }, 'datasheet/JEDEC', 'patas verticales (componentes solo rotan en Z); cuerpo simplificado'));

// ════════ 4) LÓGICA / CONECTORES — body + filas de patas ════════
// DIP: [body_w(across), rows_pitch=7.62/15.24, pins_per_side, pitch=2.54]
const DIP = { 'DIP-8':[9.8,7.62,4], 'DIP-14':[19.3,7.62,7], 'DIP-16':[19.3,7.62,8], 'DIP-28':[34.7,15.24,14], 'DIP-40':[52.3,15.24,20] };
for (const [k, [len, rowp, perSide]] of Object.entries(DIP))
  push(E(`CI ${k}`, 'connector', 'dip', { body_len: len, body_w: rowp - 2.5, row_pitch: rowp, per_side: perSide, pitch: 2.54, lead_len: 5 }, 'JEDEC MS-001', 'patas verticales; muesca no modelada'));
// Headers 2.54
for (const n of [2, 4, 6, 8, 10, 20, 40])
  push(E(`Header macho 1×${n} (2.54mm)`, 'connector', 'header', { pins: n, pitch: 2.54, base: 2.5, pin_d: 0.64, pin_len: 11.5, rows: 1 }, 'paso 2.54mm', 'pines como cilindros; plástico base ok'));
for (const n of [4, 8, 10])
  push(E(`Header macho 2×${n} (2.54mm)`, 'connector', 'header', { pins: n, pitch: 2.54, base: 2.5, pin_d: 0.64, pin_len: 11.5, rows: 2 }, 'paso 2.54mm', 'doble fila'));
// JST-XH y bornera
for (const n of [2, 3, 4])
  push(E(`JST-XH ${n}P`, 'connector', 'box', { w: 2.5 * n + 1.5, d: 5.75, h: 8.0 }, 'JST XH (2.5mm)', 'caja simplificada; contactos no modelados'));
for (const n of [2, 3])
  push(E(`Bornera ${n}P (5.08mm)`, 'connector', 'box', { w: 5.08 * n, d: 7, h: 10 }, 'paso 5.08mm', 'caja; tornillos no modelados'));
push(E('Jack DC 5.5/2.1mm', 'connector', 'box', { w: 9, d: 14.5, h: 11 }, 'barrel jack estándar', 'caja; barreno interno no modelado'));
push(E('Botón táctil 6×6mm', 'connector', 'box', { w: 6, d: 6, h: 4.3 }, 'tact switch 6mm', 'émbolo no modelado'));

// ════════ 5) PASIVOS ════════
// Electrolíticos radiales [dia, height], paso 2.5/3.5/5
const CAP = [['100µF/16V',6.3,11],['220µF/25V',8,11.5],['470µF/25V',10,12.5],['1000µF/25V',10,20],['2200µF/35V',13,25]];
for (const [n, d, h] of CAP)
  push(E(`Cap electrolítico ${n}`, 'passive', 'capRadial', { dia: d, height: h, lead_d: 0.6, lead_len: 5, pitch: d <= 6.3 ? 2.5 : 5 }, 'radial estándar', 'patas verticales; banda no modelada'));
// Resistor axial 1/4W [body_len, body_d]
push(E('Resistor 1/4W axial', 'passive', 'axial', { body_len: 6.3, body_d: 2.3, lead_d: 0.55, lead_len: 28 }, 'DO-204 / CFR-25', 'PATAS AXIALES: el componente no se orienta horizontal (solo rz)'));
push(E('Resistor 1/2W axial', 'passive', 'axial', { body_len: 9, body_d: 3.2, lead_d: 0.6, lead_len: 28 }, 'DO-204', 'patas axiales no orientables'));
push(E('Diodo 1N4148', 'passive', 'axial', { body_len: 3.5, body_d: 1.8, lead_d: 0.55, lead_len: 25 }, 'DO-35', 'patas axiales'));
push(E('Cristal HC-49', 'passive', 'box', { w: 11.5, d: 4.5, h: 13.5 }, 'HC-49/U', 'cuerpo metálico simplificado'));
push(E('Cristal HC-49S (bajo)', 'passive', 'box', { w: 11.5, d: 4.5, h: 3.5 }, 'HC-49/US', 'ok'));
push(E('Inductor radial 10mm', 'passive', 'capRadial', { dia: 10, height: 12, lead_d: 0.6, lead_len: 5, pitch: 5 }, 'inductor radial', 'devanado no modelado'));
push(E('Toroide T50 (bobina)', 'passive', 'toroid', { od: 12.7, id: 7.7, height: 4.8 }, 'núcleo T50', 'NÚCLEO ok como anillo; DEVANADO helicoidal alrededor = imposible hoy'));
push(E('Bobina/choke axial', 'passive', 'axial', { body_len: 9, body_d: 4, lead_d: 0.6, lead_len: 20 }, 'choke axial', 'patas axiales; espiras no modeladas'));
push(E('Trimpot 3296', 'passive', 'box', { w: 9.5, d: 4.8, h: 10 }, 'Bourns 3296W', 'tornillo de ajuste no modelado'));
push(E('Potenciómetro RV09', 'passive', 'potRV', { body: 9, height: 5, shaft_d: 6, shaft_len: 15 }, 'RV09 estándar', 'eje ok; pista no modelada'));

// ════════ 6) MOTORES / TRANSMISIÓN ════════
push(E('NEMA17 stepper', 'motor', 'nema', { body: 42.3, height: 39, shaft_d: 5, shaft_len: 24, hole_pitch: 31, hole_d: 3 }, 'NEMA 17 (42mm)', 'cuerpo+eje ok; agujeros de montaje patrón; bobinas internas no'));
push(E('NEMA23 stepper', 'motor', 'nema', { body: 56.4, height: 51, shaft_d: 6.35, shaft_len: 21, hole_pitch: 47.14, hole_d: 4.5 }, 'NEMA 23 (57mm)', 'cuerpo+eje ok'));
push(E('NEMA14 stepper', 'motor', 'nema', { body: 35.2, height: 28, shaft_d: 5, shaft_len: 21, hole_pitch: 26, hole_d: 3 }, 'NEMA 14', 'cuerpo+eje ok'));
push(E('Servo SG90', 'motor', 'box', { w: 22.8, d: 12.2, h: 22.5 }, 'SG90 microservo', 'caja; horn/brida no modelados'));
push(E('Servo MG996R', 'motor', 'box', { w: 40.7, d: 19.7, h: 42.9 }, 'MG996R', 'caja; orejas de montaje no'));
push(E('Motor 28BYJ-48', 'motor', 'nema', { body: 28, height: 19, shaft_d: 5, shaft_len: 10, hole_pitch: 35, hole_d: 4 }, '28BYJ-48', 'cuerpo redondo aprox cuadrado'));
push(E('Gearmotor N20', 'motor', 'box', { w: 12, d: 10, h: 24 }, 'N20 micro gearmotor', 'caja+eje; caja de engranes no'));
// Poleas GT2 — [bore, OD, flange_OD, width, teeth]
const GT2 = [['20T',5,12.2,15.5,7,20],['16T',5,9.7,13,7,16],['idler 20T liso',5,12,15.5,7,0]];
for (const [n, bore, od, fod, w] of GT2)
  push(E(`Polea GT2 ${n}`, 'motor', 'pulley', { bore, od, flange_od: fod, width: w }, 'perfil GT2 2mm', 'DIENTES GT2 no modelados (cilindro liso + bridas)'));
push(E('Husillo T8 (8mm)', 'motor', 'leadscrew', { d: 8, lead: 8, length: 100 }, 'tornillo T8 trapecial', 'ROSCA TRAPECIAL no modelada (cilindro liso)'));
push(E('Tuerca T8 latón', 'motor', 'nutRound', { od: 22, height: 10, bore: 8, flange_od: 22, flange_h: 3.5 }, 'tuerca T8', 'rosca interna no'));
push(E('Acople rígido 5→8mm', 'motor', 'coupling', { od: 18, length: 25, bore1: 5, bore2: 8 }, 'acople de aluminio', 'tornillos prisioneros no'));
push(E('Acople flexible (araña)', 'motor', 'coupling', { od: 25, length: 30, bore1: 6.35, bore2: 8 }, 'acople jaw/spider', 'araña elastomérica no'));

// ════════ 7) ENGRANES / ESTRUCTURAL ════════
// Engranes rectos (involuta REAL — el tool SÍ los hace): [module, Z, thickness, bore]
const GEARS = [[1,20,8,4],[1,40,8,5],[1.5,18,10,5],[1.5,30,10,6],[2,20,12,6],[2,15,12,5],[2,40,12,8],[2.5,20,15,8],[3,18,15,10]];
for (const [m, z, t, b] of GEARS)
  push(E(`Engrane recto m${m} Z${z}`, 'gear', 'gear', { m, Z: z, thickness: t, bore: b }, 'involuta DIN 867', 'involuta REAL ✓ (lo que el tool SÍ hace bien)'));
// Perfiles de aluminio T-slot — recreación del CONTORNO (slots internos = límite)
const EXTRU = [['2020',20,20,5,5.3],['2040',20,40,5,5.3],['4040',40,40,8,10.2],['V-slot 2020',20,20,6,5]];
for (const [n, w, h, slot, bore] of EXTRU)
  push(E(`Perfil aluminio ${n}`, 'structural', 'extrusion', { w, h, slot, bore }, `extrusión T-slot ${n}`, 'PERFIL T-SLOT complejo: solo contorno + barreno central; ranuras no'));
push(E('Sprocket #25 16T', 'structural', 'pulley', { bore: 8, od: 33, flange_od: 33, width: 4 }, 'cadena #25', 'dientes de cadena no modelados'));
push(E('Riel MGN12 (sección)', 'structural', 'box', { w: 12, d: 60, h: 8 }, 'riel lineal MGN12', 'perfil del riel simplificado a barra'));
push(E('Carro MGN12H', 'structural', 'box', { w: 27, d: 45.4, h: 13 }, 'carro MGN12H', 'recirculación/balineras no'));

// ════════ 8) MÁS SUJETADORES ════════
const CSK = { M4:[4,8.96,2.48], M5:[5,11.2,3.1], M6:[6,13.44,3.72], M8:[8,17.92,4.96] }; // DIN7991 avellanado [d, head_d, head_h]
for (const [k, [d, hd, hh]] of Object.entries(CSK))
  push(E(`Avellanado ${k}×${d * 4} (DIN7991)`, 'fastener', 'capScrew', { thread_d: d, head_d: hd, head_h: hh, length: d * 4 }, 'DIN 7991', 'cabeza cónica aprox cilíndrica; sin rosca'));
for (const [k, hexAF, h] of [['M3', 5.5, 5], ['M3', 5.5, 10], ['M3', 5.5, 15], ['M3', 5.5, 20]])
  push(E(`Separador hex latón ${k}×${h}mm`, 'fastener', 'standoff', { af: hexAF, height: h, bore: 3 }, 'standoff hex M3', 'rosca interna no; hex ok'));
push(E('Varilla roscada M6×300', 'fastener', 'rod', { d: 6, length: 300 }, 'DIN 975', 'rosca no (cilindro liso)'));
push(E('Varilla roscada M8×300', 'fastener', 'rod', { d: 8, length: 300 }, 'DIN 975', 'rosca no'));
push(E('Tuerca mariposa M6', 'fastener', 'nutHex', { af: 10, thick: 5, bore: 6 }, 'DIN 315', 'alas no modeladas'));
push(E('Prisionero M5 (DIN913)', 'fastener', 'rod', { d: 5, length: 8 }, 'DIN 913', 'rosca + hex interno no'));
push(E('Espaciador nylon M3×10', 'fastener', 'standoffRound', { od: 6, height: 10, bore: 3.2 }, 'espaciador nylon', 'ok (tubo)'));

// ════════ 9) MÁS RODAMIENTOS ════════
const BEAR2 = { '6005':[25,47,12],'6006':[30,55,13],'6205':[25,52,15],'6206':[30,62,16],'6300':[10,35,11],'6301':[12,37,12],'6302':[15,42,13] };
for (const [k, [id, od, w]] of Object.entries(BEAR2))
  push(E(`Rodamiento ${k}ZZ`, 'bearing', 'bearing', { id, od, width: w }, `serie ${k}`, 'anillo macizo; sin internos'));
push(E('Rodamiento axial 51100', 'bearing', 'bearing', { id: 10, od: 24, width: 9 }, '51100 thrust', 'sin pistas/bolas'));
push(E('Rodamiento F623 (brida)', 'bearing', 'flanged', { id: 3, od: 10, flange_od: 12, width: 4, flange_h: 1 }, 'F623ZZ', 'brida ok; sin internos'));
push(E('Rodamiento F688 (brida)', 'bearing', 'flanged', { id: 8, od: 16, flange_od: 18, width: 5, flange_h: 1 }, 'F688ZZ', 'brida ok'));

// ════════ 10) MÁS POTENCIA / REGULADORES ════════
for (const n of ['7805 (TO-220)', 'LM317 (TO-220)', 'L7812 (TO-220)', 'IRFZ44N (TO-220)'])
  push(E(n, 'power', 'package', { body_w: 10.16, body_t: 4.58, body_h: 8.7, leads: 3, pitch: 2.54, lead_d: 0.6, lead_len: 13 }, 'datasheet TO-220', 'patas verticales; cuerpo simplificado'));
push(E('TO-3P (alta potencia)', 'power', 'package', { body_w: 15.5, body_t: 4.7, body_h: 20, leads: 3, pitch: 5.46, lead_d: 0.8, lead_len: 20 }, 'TO-3P', 'patas verticales'));

// ════════ 11) MÁS CONECTORES ════════
push(E('IDC ribbon 2×5 (10p)', 'connector', 'box', { w: 17, d: 7, h: 9 }, 'IDC 2.54', 'caja; contactos no'));
push(E('IDC ribbon 2×8 (16p)', 'connector', 'box', { w: 22, d: 7, h: 9 }, 'IDC 2.54', 'caja'));
push(E('RJ45 jack', 'connector', 'box', { w: 16, d: 21, h: 13.5 }, 'RJ45 8P8C', 'caja; contactos/blindaje no'));
push(E('USB-A hembra', 'connector', 'box', { w: 14, d: 14, h: 7 }, 'USB-A receptáculo', 'caja; lengüeta interna no'));
push(E('USB-C hembra', 'connector', 'box', { w: 9, d: 7.5, h: 3.3 }, 'USB-C receptáculo', 'caja; pines no'));
push(E('Micro-USB hembra', 'connector', 'box', { w: 8, d: 6, h: 3 }, 'micro-USB', 'caja'));
push(E('Relé SRD-05VDC', 'connector', 'box', { w: 19, d: 15.5, h: 15.5 }, 'SRD-05VDC-SL-C', 'caja sellada; pines no'));
push(E('DIP switch 4 vías', 'connector', 'box', { w: 11, d: 9.8, h: 5.6 }, 'DIP switch 2.54', 'palancas no'));

// ════════ 12) MÁS PASIVOS / OPTO ════════
push(E('Cap cerámico disco 5mm', 'passive', 'capDisc', { dia: 5, thick: 2.5, lead_d: 0.5, lead_len: 5, pitch: 2.54 }, 'cerámico disco', 'patas verticales'));
push(E('Cap film 100nF (caja)', 'passive', 'box', { w: 7.2, d: 2.5, h: 6.5 }, 'film MKT', 'patas verticales no modeladas'));
push(E('Cap tantalio gota', 'passive', 'capRadial', { dia: 4, height: 7, lead_d: 0.5, lead_len: 5, pitch: 2.54 }, 'tantalio radial', 'patas verticales'));
push(E('LED 5mm', 'passive', 'led', { dia: 5, body_h: 8.6, lead_d: 0.5, lead_len: 25 }, 'LED 5mm T1-3/4', 'domo aprox cilindro+nada; patas axiales no orientadas'));
push(E('LED 3mm', 'passive', 'led', { dia: 3, body_h: 5.3, lead_d: 0.5, lead_len: 24 }, 'LED 3mm T1', 'idem'));
push(E('Display 7 seg 0.56"', 'passive', 'box', { w: 19, d: 12.7, h: 8 }, '7-seg 0.56in', 'segmentos no modelados'));
push(E('Fotoresistor LDR 5mm', 'passive', 'led', { dia: 5, body_h: 2, lead_d: 0.5, lead_len: 20 }, 'GL5528', 'rejilla no'));
push(E('Buzzer pasivo 12mm', 'passive', 'capRadial', { dia: 12, height: 9, lead_d: 0.6, lead_len: 6, pitch: 6.5 }, 'buzzer 12mm', 'membrana no'));

// ════════ 13) MÁS MOTORES ════════
for (const [n, w, d, h, sd, sl] of [['DC 130', 20, 15.5, 25, 2, 9], ['DC 280', 24, 21, 30, 2, 8], ['DC 775', 42, 42, 67, 5, 17]])
  push(E(`Motor ${n}`, 'motor', 'dcmotor', { body_d: w, length: h, shaft_d: sd, shaft_len: sl }, `motor ${n}`, 'cuerpo cilíndrico + eje; internos no'));
push(E('Motor vibración moneda', 'motor', 'capRadial', { dia: 10, height: 3, lead_d: 0.5, lead_len: 10, pitch: 0 }, 'coin vibration', 'masa excéntrica interna no'));

// ════════ 14) ENGRANES ESPECIALES (probar el LÍMITE) ════════
push(E('Engrane cónico (bisel) m2 Z20', 'gear', 'gearSpecial', { m: 2, Z: 20, thickness: 12, bore: 6 }, 'engrane cónico', 'BISEL: el tool solo hace rectos → se aproxima con recto (LÍMITE)'));
push(E('Tornillo sinfín (worm) m2', 'gear', 'gearSpecial', { m: 2, length: 40, d: 16, bore: 6 }, 'worm', 'SINFÍN helicoidal: no modelable (rosca) → cilindro (LÍMITE)'));
push(E('Corona sinfín Z40 m2', 'gear', 'gearSpecial', { m: 2, Z: 40, thickness: 12, bore: 8 }, 'worm wheel', 'corona cóncava: aprox engrane recto (LÍMITE)'));
push(E('Cremallera (rack) m2', 'gear', 'gearSpecial', { m: 2, length: 100, h: 15, w: 12 }, 'rack', 'CREMALLERA: dientes lineales no → barra (LÍMITE)'));
push(E('Engrane interno (anillo) m2 Z40', 'gear', 'gearSpecial', { m: 2, Z: 40, thickness: 12, bore: 70 }, 'ring gear', 'DENTADO INTERNO no → anillo liso (LÍMITE)'));

// ════════ 15) MÁS ESTRUCTURAL ════════
for (const [n, w, h, slot, bore] of [['2060', 20, 60, 5, 5.3], ['3030', 30, 30, 8, 6.8], ['3060', 30, 60, 8, 6.8]])
  push(E(`Perfil aluminio ${n}`, 'structural', 'extrusion', { w, h, slot, bore }, `T-slot ${n}`, 'ranuras no'));
push(E('Riel MGN9 (sección)', 'structural', 'box', { w: 9, d: 60, h: 7 }, 'MGN9', 'perfil simplificado'));
push(E('Riel MGN15 (sección)', 'structural', 'box', { w: 15, d: 60, h: 9.5 }, 'MGN15', 'perfil simplificado'));
push(E('Eje lineal cromado Ø8', 'structural', 'rod', { d: 8, length: 200 }, 'eje endurecido Ø8', 'ok (cilindro)'));
push(E('Eje lineal cromado Ø10', 'structural', 'rod', { d: 10, length: 200 }, 'eje endurecido Ø10', 'ok'));
push(E('Escuadra 2020', 'structural', 'box', { w: 20, d: 20, h: 20 }, 'corner bracket 2020', 'forma L con refuerzos no'));

module.exports = { items };
