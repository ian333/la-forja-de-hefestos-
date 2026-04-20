/**
 * Escritorio paramétrico — acero + MDF, presupuesto MX$2.040 (~US$115)
 * =====================================================================
 * Lienzo autoral de Claude. Edita este archivo para modificar la figura.
 * Vite HMR re-hidrata la escena al guardar.
 *
 * Dimensiones en unidades de escena (1 = 1 m).
 *
 * ── Diseño ──────────────────────────────────────────────────────────
 *   Cubierta:  1400 × 700 × 25 mm   (MDF laminado)
 *   Patas:     40 × 40 × 2 mm RHS   (acero negro)
 *   Travesaños:30 × 30 × 1.5 mm RHS (acero negro)
 *   Tornillería: 8 × M6×40 + insertos rosca M6 + 4 zapatas niveladoras
 *
 * ── Presupuesto (MX$, mercado mexicano abril 2026) ──────────────────
 *   MDF 18 mm laminado 1.4×0.7 m           MX$   550
 *   Acero RHS 40×40×2 mm, 3.5 m             MX$   580
 *   Acero RHS 30×30×1.5 mm, 2.5 m           MX$   280
 *   Tornillos M6×40 (bolsa de 20)           MX$    45
 *   Insertos rosca-madera M6×12 × 8         MX$    85
 *   Zapatas niveladoras M8 × 4              MX$   120
 *   Tapones plásticos PVC × 8               MX$    30
 *   Pintura electrostática + soldadura      MX$   350
 *                                          ─────────
 *   Total                                   MX$ 2.040    (~US$ 115)
 *
 *   Tiempo estimado armado: 2 h
 *   Herramienta: taladro, llave allen 5mm, escuadra, lija 220
 */

import { defineScene } from './api';

export default defineScene((f) => {
  // ═══════════════════════════════════════════════════════════════
  // Variables de diseño (aparecen en el panel de variables)
  // ═══════════════════════════════════════════════════════════════

  const anchoMesa   = f.variable('anchoMesa',   1.40,  { unit: 'm', description: 'Ancho de la cubierta' });
  const fondoMesa   = f.variable('fondoMesa',   0.70,  { unit: 'm', description: 'Profundidad de la cubierta' });
  const altoMesa    = f.variable('altoMesa',    0.75,  { unit: 'm', description: 'Altura total desde el piso' });
  const espCubierta = f.variable('espCubierta', 0.025, { unit: 'm', description: 'Espesor MDF cubierta' });

  const perfilPata  = f.variable('perfilPata',  0.04,  { unit: 'm', description: 'Sección cuadrada de la pata (40mm RHS)' });
  const retranqueo  = f.variable('retranqueo',  0.05,  { unit: 'm', description: 'Inset de la pata desde el borde' });

  const perfilTrav  = f.variable('perfilTrav',  0.03,  { unit: 'm', description: 'Sección del travesaño (30mm RHS)' });
  const alturaTrav  = f.variable('alturaTrav',  0.20,  { unit: 'm', description: 'Distancia del travesaño bajo la cubierta' });

  const diamTorn    = f.variable('diamTorn',    0.006, { unit: 'm', description: 'Diámetro M6' });
  const diamZapata  = f.variable('diamZapata',  0.05,  { unit: 'm', description: 'Diámetro zapata niveladora' });

  // ═══════════════════════════════════════════════════════════════
  // Geometría derivada
  // ═══════════════════════════════════════════════════════════════

  const alturaPata = altoMesa - espCubierta;
  const yCentroPata = alturaPata / 2;
  const yCentroCubierta = altoMesa - espCubierta / 2;
  const yTravesaño = altoMesa - espCubierta - alturaTrav;

  // Centros de patas en planta (X,Z)
  const xPata = anchoMesa / 2 - retranqueo - perfilPata / 2;
  const zPata = fondoMesa / 2 - retranqueo - perfilPata / 2;

  // ═══════════════════════════════════════════════════════════════
  // Cubierta MDF
  // ═══════════════════════════════════════════════════════════════

  const cubierta = f.box({
    size: [anchoMesa, espCubierta, fondoMesa],
    at:   [0, yCentroCubierta, 0],
    name: 'Cubierta MDF 18mm',
  });

  // ═══════════════════════════════════════════════════════════════
  // Patas — 4 perfiles RHS 40×40
  // ═══════════════════════════════════════════════════════════════

  const patas = [
    [+xPata, yCentroPata, +zPata],
    [-xPata, yCentroPata, +zPata],
    [+xPata, yCentroPata, -zPata],
    [-xPata, yCentroPata, -zPata],
  ].map((pos, i) =>
    f.box({
      size: [perfilPata, alturaPata, perfilPata],
      at:   pos as [number, number, number],
      name: `Pata ${i + 1}`,
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  // Travesaños — 2 laterales (along Z) + 1 trasero (along X)
  // ═══════════════════════════════════════════════════════════════

  const traveseñoDerecho = f.box({
    size: [perfilTrav, perfilTrav, 2 * zPata],
    at:   [+xPata, yTravesaño, 0],
    name: 'Travesaño derecho',
  });
  const traveseñoIzquierdo = f.box({
    size: [perfilTrav, perfilTrav, 2 * zPata],
    at:   [-xPata, yTravesaño, 0],
    name: 'Travesaño izquierdo',
  });
  const traveseñoPosterior = f.box({
    size: [2 * xPata, perfilTrav, perfilTrav],
    at:   [0, yTravesaño, -zPata],
    name: 'Travesaño posterior',
  });

  // ═══════════════════════════════════════════════════════════════
  // Tornillería — 8 tornillos M6×40 visibles desde arriba
  // ═══════════════════════════════════════════════════════════════

  const offsetTorn = perfilPata / 2 - 0.008; // 8mm desde borde del tubo
  const yTornillo = altoMesa + 0.003;         // cabeza 3mm sobre la cubierta
  const hTornillo = espCubierta + 0.010;

  const tornillos = [
    [+xPata + offsetTorn, +zPata],
    [+xPata - offsetTorn, +zPata],
    [-xPata + offsetTorn, +zPata],
    [-xPata - offsetTorn, +zPata],
    [+xPata + offsetTorn, -zPata],
    [+xPata - offsetTorn, -zPata],
    [-xPata + offsetTorn, -zPata],
    [-xPata - offsetTorn, -zPata],
  ].map(([x, z], i) =>
    f.cylinder({
      r: diamTorn / 2,
      h: hTornillo,
      at: [x, yTornillo - hTornillo / 2, z],
      name: `Tornillo M6 #${i + 1}`,
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  // Zapatas niveladoras — 4 discos bajo cada pata
  // ═══════════════════════════════════════════════════════════════

  const hZapata = 0.008;
  const zapatas = [
    [+xPata, +zPata],
    [-xPata, +zPata],
    [+xPata, -zPata],
    [-xPata, -zPata],
  ].map(([x, z], i) =>
    f.cylinder({
      r: diamZapata / 2,
      h: hZapata,
      at: [x, hZapata / 2, z],
      name: `Zapata niveladora ${i + 1}`,
    }),
  );

  // ═══════════════════════════════════════════════════════════════
  // Ensamble
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // Demo: laptop articulada sobre el escritorio
  // (demuestra el sistema de Joints — scrubber abre/cierra la tapa)
  // ═══════════════════════════════════════════════════════════════

  const laptopX = 0.25;
  const laptopZ = 0.0;
  const yMesa = altoMesa;

  // Base: teclado + palmrest
  const laptopBase = f.group('Laptop — base',
    f.box({
      size: [0.32, 0.02, 0.22],
      at:   [laptopX, yMesa + 0.01, laptopZ],
      name: 'Base',
    }),
  );

  // Tapa: modelada cerrada (rotación 0). El joint la abre.
  // La bisagra vive en la arista trasera: z = laptopZ - 0.11
  const yBisagra = yMesa + 0.02;
  const zBisagra = laptopZ - 0.11;
  // Tapa arrancando en la bisagra, extendiéndose +Z (adelante) cuando cerrada
  const laptopTapa = f.group('Laptop — tapa',
    f.box({
      size: [0.32, 0.015, 0.22],
      // centered so front edge aligns with back edge of base when open 90°
      at:   [laptopX, yBisagra + 0.015 / 2 + 0.001, zBisagra + 0.11],
      name: 'Tapa',
    }),
  );

  const bisagraLaptop = f.joint.revolute(laptopBase, laptopTapa, {
    origin: [laptopX, yBisagra, zBisagra],
    axis:   [1, 0, 0], // bisagra a lo largo de X
    limits: { min: 0, max: Math.PI - 0.2 }, // 0° cerrada, ~160° abierta
    drive:  Math.PI * 0.55,                 // arranca abierta a ~100°
    label:  'Bisagra laptop',
  });
  void bisagraLaptop; // referenciada por store vía `f.joint.*`

  f.add(
    f.group('Cubierta', cubierta),
    f.group('Patas', ...patas),
    f.group('Travesaños', traveseñoDerecho, traveseñoIzquierdo, traveseñoPosterior),
    f.group('Tornillería M6×40', ...tornillos),
    f.group('Zapatas niveladoras', ...zapatas),
    laptopBase,
    laptopTapa,
  );
});
