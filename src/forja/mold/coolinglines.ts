/**
 * DISEÑO DEL SISTEMA DE ENFRIAMIENTO — layout de líneas de agua (Kazmer §9.2.3-6).
 * =================================================================================
 * "Un molde son ecuaciones a resolver": dado el CALOR que hay que sacar del
 * plástico por ciclo, este módulo RESUELVE el sistema de refrigeración real —
 * caudal de agua, diámetro de línea (acotado por turbulencia Y presión),
 * plug comercial, profundidad y pitch. Nada 2D: es flujo de tubería (Reynolds,
 * Darcy) con las propiedades reales del refrigerante.
 *
 *  · caudal (Eq 9.13):  V = Q_line / (ΔT_permitido · ρ · Cp)
 *  · Ø máx  (Eq 9.15):  turbulencia Re>4000 → Dmax = 4ρV/(π·μ·4000)
 *  · Ø mín  (Eq 9.17):  caída de presión → Dmin = (ρ·L·V²/(10π·ΔP))^(1/5)
 *  · profundidad/pitch (§9.2.5-6): 1-3·Ø a la cavidad, pitch 3-5·Ø
 *
 * Reproduce el ejemplo del cup/lid del libro: 260 W → V 6.2e-5 m³/s (1 GPM),
 * 3.7 mm < Ø < 20 mm, Ø elegido 6.35 mm. PURO: node-testeable.
 */

export interface Coolant { name: string; rhoKgM3: number; cpJkgC: number; muPaS: number; turbulent: boolean }
// Apéndice C (a temperatura de uso típica).
export const WATER: Coolant = { name: 'agua', rhoKgM3: 1000, cpJkgC: 4200, muPaS: 0.001, turbulent: true };
export const GLYCOL: Coolant = { name: 'etilenglicol', rhoKgM3: 1100, cpJkgC: 2400, muPaS: 0.0157, turbulent: false };
export const OIL: Coolant = { name: 'aceite ISO 32', rhoKgM3: 870, cpJkgC: 1900, muPaS: 0.03, turbulent: false };

// Tabla 9.2: plugs DME comerciales (Ø de línea, mm).
export const COOLING_PLUGS = [
  { dme: 'JP-250', npt: '1/16', diaMm: 4.76 }, { dme: 'JP-251', npt: '1/8', diaMm: 6.35 },
  { dme: 'JP-352', npt: '1/4', diaMm: 9.53 }, { dme: 'JP-553', npt: '3/8', diaMm: 11.1 },
  { dme: 'JP-554', npt: '1/2', diaMm: 15.9 },
];
// Tabla 9.1: controladores comerciales (caudal máx m³/s, presión máx Pa).
export const CONTROLLERS = [
  { name: 'VacTherm (agua)', maxFlowM3s: 1e-3, maxPressurePa: 200e3, minC: 10, maxC: 99, coolKW: 14.6 },
  { name: 'IMSelect (aceite)', maxFlowM3s: 3e-3, maxPressurePa: 29e3 * 6.895, minC: 32, maxC: 304, coolKW: 16 },
];

/** Eq 9.13: caudal de agua para no subir más de ΔT_permitido a lo largo de la línea. */
export function coolantFlowRate(qLineW: number, dTallowC: number, c: Coolant = WATER): number {
  return qLineW / (dTallowC * c.rhoKgM3 * c.cpJkgC);
}

/** Número de Reynolds del refrigerante en la línea (Eq 9.14). */
export function reynolds(flowM3s: number, diaM: number, c: Coolant = WATER): number {
  return (4 * c.rhoKgM3 * flowM3s) / (Math.PI * c.muPaS * diaM);
}

/** Eq 9.15: Ø MÁXIMO para mantener flujo turbulento (Re>4000). */
export function maxLineDiameter(flowM3s: number, c: Coolant = WATER): number {
  return (4 * c.rhoKgM3 * flowM3s) / (Math.PI * c.muPaS * 4000);
}

/** Caída de presión en la línea (Eq 9.16 turbulento / Eq 9.18 Hagen-Poiseuille laminar). */
export function linePressureDrop(flowM3s: number, lineLenM: number, diaM: number, c: Coolant = WATER): number {
  if (c.turbulent) return (c.rhoKgM3 * lineLenM * flowM3s * flowM3s) / (10 * Math.PI * Math.pow(diaM, 5));
  return (128 * c.muPaS * lineLenM * flowM3s) / (Math.PI * Math.pow(diaM, 4));   // laminar (glicol/aceite)
}

/** Eq 9.17: Ø MÍNIMO para no exceder la caída de presión permitida (agua, turbulento). */
export function minLineDiameter(flowM3s: number, lineLenM: number, dPmaxPa: number, c: Coolant = WATER): number {
  if (c.turbulent) return Math.pow((c.rhoKgM3 * lineLenM * flowM3s * flowM3s) / (10 * Math.PI * dPmaxPa), 1 / 5);
  return Math.pow((128 * c.muPaS * lineLenM * flowM3s) / (Math.PI * dPmaxPa), 1 / 4);  // laminar
}

export interface CoolingLineDesign {
  coolant: string; flowM3s: number; flowGPM: number;
  dMinMm: number; dMaxMm: number; plug: { dme: string; diaMm: number } | null;
  reAtPlug: number; turbulento: boolean;
  depthMm: number; pitchMm: number; nLines: number;
  controller: string | null; totalFlowM3s: number; ok: boolean; notas: string[];
}

/** RESUELVE el sistema de enfriamiento completo dado el calor a disipar por ciclo. */
export function designCoolingLines(o: {
  qTotalW: number;                    // calor total a sacar del molde por unidad de tiempo (todas las cavidades)
  nLines: number;                     // nº de circuitos (líneas) en paralelo
  lineLenM: number;                   // longitud de UNA línea
  dTallowC?: number;                  // subida permitida del agua (1°C típico, 0.1 preciso)
  dPmaxPa?: number;                   // caída de presión permitida (½ de la del controlador)
  coolant?: Coolant;
}): CoolingLineDesign {
  const c = o.coolant ?? WATER;
  const dTallow = o.dTallowC ?? 1, dPmax = o.dPmaxPa ?? 100e3;
  const qLine = o.qTotalW / o.nLines;                       // calor por línea
  const flow = coolantFlowRate(qLine, dTallow, c);          // caudal por línea (Eq 9.13)
  const dMax = maxLineDiameter(flow, c);                    // Eq 9.15
  const dMin = minLineDiameter(flow, o.lineLenM, dPmax, c); // Eq 9.17
  const notas: string[] = [];
  // plug comercial estándar en el rango [dMin, dMax] — NO el mínimo absoluto (se
  // dejaría al límite de la caída de presión); el más chico con margen 1.3·dMin
  // y maquinable (§9.2.4: "readily machinable"). Para el cup da 6.35 mm (libro).
  const target = Math.max(1.3 * dMin, dMin);
  const plug = COOLING_PLUGS.find((p) => p.diaMm / 1000 >= target && p.diaMm / 1000 <= dMax)
    ?? COOLING_PLUGS.find((p) => p.diaMm / 1000 >= dMin && p.diaMm / 1000 <= dMax) ?? null;
  if (!plug) notas.push(`ningún plug DME en el rango ${(dMin * 1000).toFixed(1)}-${(dMax * 1000).toFixed(1)} mm → línea a medida`);
  const dSel = plug ? plug.diaMm / 1000 : Math.max(dMin, 0.00476);
  const re = reynolds(flow, dSel, c);
  const totalFlow = flow * o.nLines;
  // controlador comercial que aguante el caudal total
  const ctrl = CONTROLLERS.find((k) => totalFlow <= k.maxFlowM3s && dPmax <= k.maxPressurePa && c.name.includes(k.name.includes('agua') ? 'agua' : 'aceite')) ?? CONTROLLERS[0];
  const ok = re > 4000 && !!plug && totalFlow <= ctrl.maxFlowM3s;
  if (re <= 4000) notas.push(`Re ${re.toFixed(0)} < 4000: flujo NO turbulento — subir caudal o bajar Ø`);
  return {
    coolant: c.name, flowM3s: flow, flowGPM: flow / 6.309e-5,
    dMinMm: dMin * 1000, dMaxMm: dMax * 1000,
    plug: plug ? { dme: plug.dme, diaMm: plug.diaMm } : null,
    reAtPlug: re, turbulento: re > 4000,
    depthMm: dSel * 1000 * 2, pitchMm: dSel * 1000 * 3.5,   // §9.2.5-6: profundidad ~2Ø, pitch ~3-5Ø
    nLines: o.nLines, controller: ctrl?.name ?? null, totalFlowM3s: totalFlow, ok, notas,
  };
}
