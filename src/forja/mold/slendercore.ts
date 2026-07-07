/**
 * ENFRIAMIENTO DE CORES ESBELTOS — Kazmer §9.3.5 (Tabla 9.3).
 * ==============================================================================
 * Un core con L/Ø alto no transfiere calor por la longitud (ni con acero
 * conductivo) → hay que meter un canal AXIAL por dentro. Cada opción es una
 * pieza mecánica distinta según el Ø del core (Tabla 9.3):
 *
 *   inserto de enfriamiento  Ø>50mm   barreno>25mm  muy alto  (custom, caro)
 *   baffle (deflector)       12-75mm  6-25mm        muy alto  (estándar, PREFERIDO)
 *   bubbler (burbujeador)    6-30mm   3-12mm        alto      (2 canales, sin carga)
 *   heat pipe                5-20mm   3-12mm        medio
 *   pin conductivo           <5mm     —             bajo
 *
 * Regla del libro: el BAFFLE se prefiere siempre que se pueda (componente
 * estándar barato vs inserto custom). El baffle carga radial limitado y el
 * bubbler NADA → el espesor de pared se dimensiona por §12.3 [[cores]].
 * Reproduce la Tabla 9.3 + el ejemplo (core 60mm → baffle 12mm, Fig 9.21). PURO.
 */

export type SlenderCoolingMethod = 'inserto' | 'baffle' | 'bubbler' | 'heat-pipe' | 'pin-conductivo';

export interface SlenderCoolingOption {
  method: SlenderCoolingMethod;
  coreMinMm: number; coreMaxMm: number;      // rango de Ø de core
  holeMinMm: number; holeMaxMm: number;      // rango de Ø de barreno
  rate: 'muy alto' | 'alto' | 'medio' | 'bajo';
  cargaAxial: boolean; cargaRadial: 'limitada' | 'ninguna' | 'plena';
  estandar: boolean;
}

/** Tabla 9.3 (rangos del libro). */
export const SLENDER_COOLING: SlenderCoolingOption[] = [
  { method: 'inserto', coreMinMm: 50, coreMaxMm: 1e9, holeMinMm: 25, holeMaxMm: 1e9, rate: 'muy alto', cargaAxial: true, cargaRadial: 'plena', estandar: false },
  { method: 'baffle', coreMinMm: 12, coreMaxMm: 75, holeMinMm: 6, holeMaxMm: 25, rate: 'muy alto', cargaAxial: false, cargaRadial: 'limitada', estandar: true },
  { method: 'bubbler', coreMinMm: 6, coreMaxMm: 30, holeMinMm: 3, holeMaxMm: 12, rate: 'alto', cargaAxial: false, cargaRadial: 'ninguna', estandar: true },
  { method: 'heat-pipe', coreMinMm: 5, coreMaxMm: 20, holeMinMm: 3, holeMaxMm: 12, rate: 'medio', cargaAxial: false, cargaRadial: 'ninguna', estandar: true },
  { method: 'pin-conductivo', coreMinMm: 0, coreMaxMm: 5, holeMinMm: 0, holeMaxMm: 0, rate: 'bajo', cargaAxial: false, cargaRadial: 'ninguna', estandar: true },
];

export interface SlenderCoreCooling {
  needsAxial: boolean; slenderness: number;
  method: SlenderCoolingMethod; option: SlenderCoolingOption;
  holeDiaMm: number; rate: string; porQue: string; notas: string[];
}

/**
 * Elige el método de enfriamiento del core por su Ø (Tabla 9.3), prefiriendo el
 * BAFFLE cuando aplica (estándar/barato). Avisa si el core es esbelto (necesita
 * canal axial) y si el método carga o no (para el espesor de pared por §12.3).
 */
export function chooseSlenderCoreCooling(coreDiaMm: number, coreLenMm: number): SlenderCoreCooling {
  const slender = coreLenMm / coreDiaMm;
  const needsAxial = slender > 3;             // L/Ø>3: la conducción por la longitud ya no basta
  const notas: string[] = [];
  // preferencia: baffle si el Ø cae en su rango; si es muy grande → inserto; muy chico → hacia pin
  let opt: SlenderCoolingOption;
  if (coreDiaMm >= 12 && coreDiaMm <= 75) opt = SLENDER_COOLING.find((o) => o.method === 'baffle')!;
  else if (coreDiaMm > 75) opt = SLENDER_COOLING.find((o) => o.method === 'inserto')!;
  else if (coreDiaMm >= 6) opt = SLENDER_COOLING.find((o) => o.method === 'bubbler')!;
  else if (coreDiaMm >= 5) opt = SLENDER_COOLING.find((o) => o.method === 'heat-pipe')!;
  else opt = SLENDER_COOLING.find((o) => o.method === 'pin-conductivo')!;

  // Ø de barreno recomendado: ~el mayor que quepa en el core dejando pared (≤ ⅔·Ø_core por §12.3.2)
  const holeCap = Math.min(opt.holeMaxMm, (2 / 3) * coreDiaMm);
  const holeDia = Math.max(opt.holeMinMm, Math.min(holeCap, coreDiaMm * 0.4));

  if (opt.method === 'inserto') notas.push('inserto CUSTOM (4 ejes/torno): caro y con riesgo — usar solo si el baffle no alcanza el Ø');
  if (opt.method === 'baffle') notas.push('baffle estándar de catálogo (barato); carga radial limitada → verificar pared por §12.3');
  if (opt.method === 'bubbler') notas.push('bubbler: 2 canales (fuera + dentro), sin carga → pared libre, pero instalación más cara');
  if (opt.method === 'pin-conductivo') notas.push('core muy fino: pin conductivo (Cu/BeCu), tasa BAJA → puede limitar el ciclo');
  if (!needsAxial) notas.push(`L/Ø ${slender.toFixed(1)} < 3: el core no es esbelto, quizá basta enfriamiento perimetral`);

  return {
    needsAxial, slenderness: +slender.toFixed(1),
    method: opt.method, option: opt, holeDiaMm: +holeDia.toFixed(1), rate: opt.rate,
    porQue: `Ø core ${coreDiaMm}mm → ${opt.method} (Tabla 9.3: ${opt.coreMinMm}-${opt.coreMaxMm === 1e9 ? '∞' : opt.coreMaxMm}mm, tasa ${opt.rate})`,
    notas,
  };
}
