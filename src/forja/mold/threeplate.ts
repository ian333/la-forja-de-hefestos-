/**
 * MOLDE DE TRES PLACAS — Kazmer §6.3.2 + §6.5.2 (LITERAL).
 * =========================================================
 * La segunda partición ("A-X") entre la placa A y la placa STRIPPER (X) permite
 * runners SOBRE las cavidades (gating libre, pin-point §7.2.2) y separación
 * AUTOMÁTICA de la colada. Mecánica de apertura del libro:
 *  1) abre A-B primero (el resorte A-X puede adelantar su separación);
 *     carrera A-B limitada por el stripper bolt A→B; apertura típica
 *     = 2 a 3 × la ALTURA de la pieza.
 *  2) agotado ese bolt, la placa A viaja el largo libre del bolt de la X;
 *     la X se separa del clamp superior y el SUCKER PIN suelta la colada.
 * Números ancla (Tabla 6.1): 2 placas 264/75/339 mm y 0.36 s vs 3 placas
 * 308/250/558 mm y 1.2 s; v_apertura = 184 + 13·log10(F_clamp[t]) mm/s
 * (100 t → ~210 mm/s). PURO: node-testeable.
 */

export interface ThreePlateSpec {
  partHeightMm: number;                  // altura de la pieza moldeada
  runnerClearMm?: number;                // espacio para que CAIGA la colada (A-X)
  openFactorAB?: number;                 // 2..3 × altura de pieza (libro); default 2.5
  clampTons: number;
  /** espesores de placas (mm) — defaults compactos estilo libro */
  plates?: Partial<{ topClamp: number; stripperX: number; plateA: number; plateB: number; support: number; railH: number; rearClamp: number }>;
}

export interface ThreePlateLayout {
  /** stack de abajo (clamp trasero) hacia arriba (clamp superior), con z0/z1 */
  stack: Array<{ name: string; z0: number; z1: number; role: 'fija' | 'movil-B' | 'movil-A' | 'stripper' }>;
  stackMm: number;
  partingABz: number; partingAXz: number;
  openABMm: number; openAXMm: number; openTotalMm: number;
  daylightMm: number;                    // stack + apertura total
  boltABfreeMm: number; boltAXfreeMm: number;
  vOpenMmS: number; tOpenS: number;
}

/** Velocidad de apertura del molde (regresión del libro, nota de la Tabla 6.1). */
export function moldOpeningVelocity(clampTons: number): number {
  return 184 + 13 * Math.log10(clampTons);
}

export function threePlateLayout(s: ThreePlateSpec): ThreePlateLayout {
  const P = { topClamp: 25, stripperX: 20, plateA: 40, plateB: 40, support: 25, railH: 60, rearClamp: 20, ...(s.plates ?? {}) };
  // stack (de abajo hacia arriba): rear | rails(+eyección) | support | B | A | X | top
  const rows: ThreePlateLayout['stack'] = [];
  let z = 0;
  const push = (name: string, h: number, role: ThreePlateLayout['stack'][0]['role']) => {
    rows.push({ name, z0: z, z1: z + h, role }); z += h;
  };
  push('placa sujeción inferior', P.rearClamp, 'movil-B');
  push('rieles + eyección', P.railH, 'movil-B');
  push('placa soporte', P.support, 'movil-B');
  push('placa B (core)', P.plateB, 'movil-B');
  const partingABz = z;
  push('placa A (cavidad + drops cónicos)', P.plateA, 'movil-A');
  const partingAXz = z;
  push('placa X (stripper — runner en su cara)', P.stripperX, 'stripper');
  push('placa sujeción superior (sprue)', P.topClamp, 'fija');

  const openAB = (s.openFactorAB ?? 2.5) * s.partHeightMm;      // 2-3× altura (libro)
  const openAX = (s.runnerClearMm ?? 60);                       // caída libre de la colada
  const openTotal = openAB + openAX;
  const v = moldOpeningVelocity(s.clampTons);
  return {
    stack: rows, stackMm: z,
    partingABz, partingAXz,
    openABMm: openAB, openAXMm: openAX, openTotalMm: openTotal,
    daylightMm: z + openTotal,
    boltABfreeMm: openAB, boltAXfreeMm: openAX,
    vOpenMmS: +v.toFixed(1), tOpenS: +(openTotal / v).toFixed(2),
  };
}

/** CINEMÁTICA de la doble apertura (pura en u∈[0,1] del recorrido de la placa B):
 *  fase 1: B baja sola hasta agotar el bolt A-B (la pieza queda expuesta);
 *  fase 2: A la sigue, abriendo A-X hasta su bolt (la colada se despega de la X
 *  por los sucker pins y CAE). Devuelve desplazamientos de B, A y X (fija=0). */
export function openingSequence(layout: ThreePlateLayout, u: number): { dB: number; dA: number; dX: number; fase: 1 | 2 } {
  const total = layout.openTotalMm;
  const dB = Math.max(0, Math.min(1, u)) * total;
  if (dB <= layout.boltABfreeMm) return { dB, dA: 0, dX: 0, fase: 1 };
  return { dB, dA: dB - layout.boltABfreeMm, dX: 0, fase: 2 };
}

/** Comparativa 2 vs 3 placas al estilo de la Tabla 6.1 (con la física del libro). */
export function compareFeedSystems(inp: {
  twoPlate: { stackMm: number; openMm: number; massKg: number };
  threePlate: { stackMm: number; openMm: number; massKg: number };
  clampTons: number;
}) {
  const v = moldOpeningVelocity(inp.clampTons);
  const row = (x: { stackMm: number; openMm: number; massKg: number }) => ({
    stackMm: x.stackMm, openMm: x.openMm,
    daylightMm: x.stackMm + x.openMm, massKg: x.massKg,
    tOpenS: +(x.openMm / v).toFixed(2),
  });
  return { vOpenMmS: +v.toFixed(0), twoPlate: row(inp.twoPlate), threePlate: row(inp.threePlate) };
}

/** SUCKER PIN (§6.5.2): retiene la colada en la X sin estrangular el flujo —
 *  ⌀ y profundidad CHICOS vs el runner primario, lejos del sprue si estorba. */
export function suckerPinDesign(runnerDiaMm: number): { diaMm: number; depthMm: number; undercutMm: number; nota: string } {
  const dia = +(0.6 * runnerDiaMm).toFixed(1);              // menor que el runner (no restringe)
  return {
    diaMm: dia, depthMm: +(0.8 * runnerDiaMm).toFixed(1), undercutMm: +(0.15 * runnerDiaMm).toFixed(2),
    nota: 'chico vs runner primario para NO restringir flujo (§6.5.2); alejarlo del sprue si estorba',
  };
}
