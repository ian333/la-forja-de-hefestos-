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

/** Factor de apertura del libro (§6.3.2): "apertura típica = 2 a 3 × la ALTURA de la
 *  pieza". 2.5 = el centro del rango. */
export const OPEN_FACTOR = 2.5;

/** CARRERA DE APERTURA de la partición A-B (mm) — §6.3.2, TÉRMINO DE LA PIEZA.
 *  La pieza tiene que salir del núcleo Y dejar el hueco para caer, por eso son 2-3
 *  alturas y no una. ⚠ Esto NO es la carrera completa: el § pide además sacar el
 *  FEED SYSTEM. Para la carrera que se le pide a la máquina usa `carreraDeApertura`,
 *  que suma el bebedero — esta función es su primer sumando.
 *
 *  FUENTE ÚNICA: la usan el layout de 3 placas, el selector de máquina (el daylight
 *  debe tragar stack + ESTO) y la apertura animada. Si alguien vuelve a teclear un
 *  número fijo (había un `OPEN = 80` en la animación), el molde de la pantalla deja
 *  de ser el molde del estudio. */
export function moldOpeningStrokeMm(partHeightMm: number, factor = OPEN_FACTOR): number {
  return +(factor * Math.max(0, partHeightMm)).toFixed(1);
}

/**
 * CARRERA DE APERTURA COMPLETA (mm) — §6.3.2 · LA ÚNICA VERDAD de "cuánto abre".
 * ============================================================================
 * El § le pide DOS cosas al MISMO movimiento, y hasta 2026-09-21 el código solo
 * contaba la primera:
 *   1) *"The free length of the stripper bolt must be sufficient to allow for the
 *      EJECTION OF THE MOLDED PARTS. A typical mold open distance between the A and
 *      B plates is equal to TWO TO THREE TIMES THE HEIGHT of the molded parts."*
 *      → `moldOpeningStrokeMm` = 2.5 · H (sacar la pieza del núcleo Y el hueco
 *      para que caiga: por eso son 2-3 alturas y no una).
 *   2) *"…the length of the X plate stripper bolt must be sufficient to allow for
 *      the REMOVAL OF THE FEED SYSTEM."* Y §1.4.1: *"a large mold opening stroke is
 *      needed to eject the cold runner"*.
 * La COLADA no cabe dentro del 2.5·H de la pieza: es material moldeado EXTRA que
 * sale con ella (bebedero cónico de la partición a la cara de la sujeción). Por eso
 * la carrera = (2-3)·H + el largo de colada que viaja SOBRE la pieza. Con colada 0
 * la fórmula se reduce EXACTAMENTE a la regla vieja: no cambia nada donde no hay
 * bebedero que sacar.
 *
 * MEDIDO (plan de inspección 2026-09-21, 4 piezas reales — punto 3.1 fallaba 4/4):
 *   carcasa 1594C Box  2.5·H = 83.3 → 152.5 mm (pide 112.5)
 *   tapa    1594C Lid  2.5·H = 35.2 →  93.7 mm (pide  82.5)
 *   1599HBK            2.5·H = 88.8 → 175.8 mm (pide 132.5)
 *   1557BGY            2.5·H = 78.0 → 139.3 mm (pide 102.5)
 *
 * PURA. La consumen: el 3D (`useMoldStudio.moldOpenStrokeMm` → `MoldOpenDriver`),
 * el selector de máquina (`moldmachine` → `selectInjectionMachine` → daylight) y
 * la lámina L5 de apertura. Si alguien vuelve a teclear `2.5 * altura` en su rincón,
 * el molde de la pantalla deja de ser el molde del estudio (ya pasó dos veces).
 */
export function carreraDeApertura(o: {
  /** altura de la pieza moldeada SOBRE la partición (mm) */
  alturaPiezaMm: number;
  /** largo de colada/bebedero que sale CON la pieza, medido SOBRE ella (mm). 0 = colada caliente o sin bebedero. */
  coladaMm?: number;
  /** 2..3 del libro; default OPEN_FACTOR = 2.5 (el centro del rango) */
  factor?: number;
}): { mm: number; piezaMm: number; coladaMm: number; factor: number; porque: string } {
  const factor = o.factor ?? OPEN_FACTOR;
  const H = Math.max(0, Number.isFinite(o.alturaPiezaMm) ? o.alturaPiezaMm : 0);
  const colada = Math.max(0, Number.isFinite(o.coladaMm ?? 0) ? (o.coladaMm ?? 0) : 0);
  const pieza = +(factor * H).toFixed(1);
  return {
    mm: +(pieza + colada).toFixed(1), piezaMm: pieza, coladaMm: +colada.toFixed(1), factor,
    porque: `§6.3.2: ${factor}×${H.toFixed(1)} mm de pieza = ${pieza} mm (sale del núcleo y cae) + ${colada.toFixed(1)} mm de colada que viaja con ella ("sufficient to allow for the removal of the feed system")`,
  };
}

/** DAYLIGHT REQUERIDO (mm) = altura de cierre + carrera de apertura (Tabla 6.1:
 *  2 placas 264 + 75 = 339; 3 placas 308 + 250 = 558). El molde CERRADO cabiendo en
 *  el daylight NO basta: si no sobra la carrera, la máquina nunca lo abre. */
export function daylightNeededMm(stackMm: number, openStrokeMm: number): number {
  return +(stackMm + openStrokeMm).toFixed(1);
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

  const openAB = moldOpeningStrokeMm(s.partHeightMm, s.openFactorAB ?? OPEN_FACTOR);   // 2-3× altura (libro)
  const openAX = (s.runnerClearMm ?? 60);                       // caída libre de la colada
  const openTotal = openAB + openAX;
  const v = moldOpeningVelocity(s.clampTons);
  return {
    stack: rows, stackMm: z,
    partingABz, partingAXz,
    openABMm: openAB, openAXMm: openAX, openTotalMm: openTotal,
    daylightMm: daylightNeededMm(z, openTotal),
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
