/**
 * TAMAÑO DE MÁQUINA — selección de inyectora comercial (Kazmer §4.3.3 + cap 5 +
 * cap 11). El capstone del sistema: consume las salidas del LLENADO (fuerza de
 * cierre, presión de inyección) y de la EXPULSIÓN (fuerza de expulsión) y resuelve
 * la máquina MÍNIMA de catálogo que aguanta las CUATRO restricciones acopladas:
 *
 *   1. CIERRE (Eq 5.29): F_clamp = P_cavidad · A_proyectada · SF   → tonelaje
 *   2. SHOT (§4.3.3): V_shot = V_pieza·n + V_colada, entre 25-50 % del barril
 *      (bajo → residencia larga/degradación; alto → fundido no homogéneo)
 *   3. PRESIÓN DE INYECCIÓN: la máquina debe entregar la P de llenado · SF
 *   4. EXPULSIÓN (cap 11): la máquina provee ~2 % del clamp como fuerza de
 *      expulsión; debe superar la F_eject del vector de expulsión
 *
 * Verificado contra el libro: cup → clamp 400 kN (≈41 t) / F_eject 1.8 kN;
 * bezel → clamp 1400 kN (≈143 t) / F_eject 4.7 kN (≈0.5 % del clamp, p.269).
 * PURO: node-testeable.
 */

import { clampMetricTons } from './filling';

export const TON_METRIC_N = 9806.65;      // 1 tonelada métrica (el libro, cap 4/5)

export interface InjectionMachine {
  name: string;
  clampTons: number;                       // fuerza de cierre (t métricas)
  shotCc: number;                          // capacidad máx de shot (cc, GPPS-equiv)
  maxInjPressureMPa: number;               // presión de inyección máx en boquilla
  plasticizeGs: number;                    // tasa de plastificación (g/s, GPPS)
  tieHmm: number; tieVmm: number;          // luz entre columnas
  minDaylightMm: number; maxDaylightMm: number;
  ejectionForceKN: number;                 // fuerza de expulsión provista (~2 % clamp)
}

/**
 * Catálogo de inyectoras comerciales (clase 50-500 t + la HM320 del libro). Cifras
 * representativas de máquinas hidráulicas de tornillo típicas LATAM; la expulsión
 * ≈ 2 % del clamp (survey del libro §11.2.2).
 */
export const INJECTION_MACHINES: InjectionMachine[] = [
  { name: 'IM-50',  clampTons: 50,  shotCc: 63,   maxInjPressureMPa: 210, plasticizeGs: 12, tieHmm: 310, tieVmm: 310, minDaylightMm: 150, maxDaylightMm: 420, ejectionForceKN: 9.8 },
  { name: 'IM-90',  clampTons: 90,  shotCc: 130,  maxInjPressureMPa: 210, plasticizeGs: 20, tieHmm: 360, tieVmm: 360, minDaylightMm: 180, maxDaylightMm: 500, ejectionForceKN: 17.7 },
  { name: 'IM-150', clampTons: 150, shotCc: 280,  maxInjPressureMPa: 200, plasticizeGs: 33, tieHmm: 460, tieVmm: 460, minDaylightMm: 220, maxDaylightMm: 600, ejectionForceKN: 29.4 },
  { name: 'IM-250', clampTons: 250, shotCc: 510,  maxInjPressureMPa: 200, plasticizeGs: 52, tieHmm: 570, tieVmm: 570, minDaylightMm: 280, maxDaylightMm: 720, ejectionForceKN: 49.0 },
  { name: 'Battenfeld HM320 (libro)', clampTons: 326, shotCc: 490, maxInjPressureMPa: 200, plasticizeGs: 60, tieHmm: 800, tieVmm: 630, minDaylightMm: 350, maxDaylightMm: 800, ejectionForceKN: 64 },
  { name: 'IM-350', clampTons: 350, shotCc: 900,  maxInjPressureMPa: 190, plasticizeGs: 70, tieHmm: 660, tieVmm: 660, minDaylightMm: 320, maxDaylightMm: 820, ejectionForceKN: 68.6 },
  { name: 'IM-500', clampTons: 500, shotCc: 1400, maxInjPressureMPa: 180, plasticizeGs: 95, tieHmm: 810, tieVmm: 810, minDaylightMm: 380, maxDaylightMm: 950, ejectionForceKN: 98.1 },
];

export interface MachineRequirements {
  clampNeedTons: number;                   // Eq 5.29 · SF
  shotNeedCc: number;                      // V_pieza·n + V_colada
  injPressureNeedMPa: number;              // P_llenado · SF
  ejectionNeedKN: number;                  // del vector de expulsión
  clampKN: number; ejectPctOfClamp: number;
}

/** RESUELVE los cuatro requerimientos físicos que la máquina debe satisfacer. */
export function machineRequirements(o: {
  projectedAreaM2: number; cavityPressureMPa: number;   // cierre (Eq 5.29)
  partVolumeCc: number; nCav: number; runnerVolumeCc?: number;  // shot
  fillPressureMPa: number;                              // presión de inyección
  ejectionForceN: number;                               // del vector (cap 11)
  clampSF?: number; pressureSF?: number;
}): MachineRequirements {
  const clampSF = o.clampSF ?? 1.1;                      // 10 % de margen (§4.3.3)
  const pSF = o.pressureSF ?? 1.15;
  const clampNeedTons = clampMetricTons(o.cavityPressureMPa * 1e6, o.projectedAreaM2) * clampSF;
  const clampKN = clampNeedTons * TON_METRIC_N / 1000;
  const shotNeedCc = o.partVolumeCc * o.nCav + (o.runnerVolumeCc ?? 0);
  const ejectKN = o.ejectionForceN / 1000;
  return {
    clampNeedTons, shotNeedCc,
    injPressureNeedMPa: o.fillPressureMPa * pSF,
    ejectionNeedKN: ejectKN, clampKN,
    ejectPctOfClamp: 100 * ejectKN / clampKN,
  };
}

export interface MachineSelection {
  machine: InjectionMachine | null;
  ok: boolean;
  governs: 'cierre' | 'shot' | 'presión' | 'expulsión' | 'ajuste' | null;
  shotPct: number;                         // % del barril usado
  clampUtilPct: number;                    // % del clamp usado
  checks: { cierre: boolean; shotVentana: boolean; presion: boolean; expulsion: boolean; ajuste: boolean };
  issues: string[];
}

/**
 * Selecciona la inyectora MÍNIMA (menor tonelaje) que satisface las cuatro
 * restricciones + el ajuste dimensional del molde. Reporta QUÉ restricción manda
 * el tamaño (para saber si conviene rediseñar: menos cavidades, colada fría, etc).
 */
export function selectInjectionMachine(
  req: MachineRequirements,
  mold: { wmm: number; lmm: number; stackMm: number },
  catalog: InjectionMachine[] = INJECTION_MACHINES,
): MachineSelection {
  const sorted = [...catalog].sort((a, b) => a.clampTons - b.clampTons);
  for (const m of sorted) {
    const cierre = m.clampTons >= req.clampNeedTons;
    const shotPct = 100 * req.shotNeedCc / m.shotCc;
    // ventana IDEAL 25-50 % (§4.3.3); pero <25 % es solo advertencia de residencia,
    // no fallo. El gate DURO es que el barril alcance el shot con cojín (≤85 %).
    const shotFits = shotPct <= 85;
    const shotVentana = shotPct >= 25 && shotPct <= 50;
    const presion = m.maxInjPressureMPa >= req.injPressureNeedMPa;
    const expulsion = m.ejectionForceKN >= req.ejectionNeedKN;
    // ajuste DURO: cabe entre columnas y NO excede el daylight abierto. Estar por
    // debajo del daylight mínimo es solo advertencia (se agregan risers), no fallo.
    const ajuste = mold.wmm <= m.tieHmm && mold.lmm <= m.tieVmm && mold.stackMm <= m.maxDaylightMm;
    if (cierre && shotFits && presion && expulsion && ajuste) {
      const issues: string[] = [];
      if (shotPct < 25) issues.push(`shot ${shotPct.toFixed(0)}% < 25%: barril grande para la pieza → subir cavidades o máquina más chica`);
      if (mold.stackMm < m.minDaylightMm) issues.push(`stack ${mold.stackMm.toFixed(0)} < daylight mín ${m.minDaylightMm}: agregar risers`);
      return {
        machine: m, ok: true, governs: 'cierre',
        shotPct: +shotPct.toFixed(1), clampUtilPct: +(100 * req.clampNeedTons / m.clampTons).toFixed(1),
        checks: { cierre, shotVentana, presion, expulsion, ajuste }, issues,
      };
    }
  }
  // ninguna calza: reportar la más grande y QUÉ falló (para diagnosticar el rediseño)
  const big = sorted[sorted.length - 1];
  const shotPct = 100 * req.shotNeedCc / big.shotCc;
  const checks = {
    cierre: big.clampTons >= req.clampNeedTons,
    shotVentana: shotPct >= 25 && shotPct <= 50,
    presion: big.maxInjPressureMPa >= req.injPressureNeedMPa,
    expulsion: big.ejectionForceKN >= req.ejectionNeedKN,
    ajuste: big.wmm ? false : (big.tieHmm >= mold.wmm && big.tieVmm >= mold.lmm),
  };
  const issues: string[] = [];
  if (!checks.cierre) issues.push(`clamp requerido ${req.clampNeedTons.toFixed(0)} t > ${big.clampTons} t (máquina más grande): dividir en 2 moldes o menos cavidades`);
  if (shotPct < 25) issues.push(`shot ${shotPct.toFixed(0)}% < 25%: barril muy grande → residencia larga`);
  if (shotPct > 50) issues.push(`shot ${shotPct.toFixed(0)}% > 50% del barril máximo: fundido no homogéneo`);
  if (!checks.presion) issues.push(`presión ${req.injPressureNeedMPa.toFixed(0)} MPa > ${big.maxInjPressureMPa}: pared más gruesa o material más fluido`);
  if (!checks.expulsion) issues.push(`expulsión ${req.ejectionNeedKN.toFixed(1)} kN > ${big.ejectionForceKN} kN provista`);
  const governs = !checks.cierre ? 'cierre' : shotPct > 50 ? 'shot' : !checks.presion ? 'presión' : !checks.expulsion ? 'expulsión' : 'ajuste';
  return {
    machine: big, ok: false, governs,
    shotPct: +shotPct.toFixed(1), clampUtilPct: +(100 * req.clampNeedTons / big.clampTons).toFixed(1),
    checks, issues,
  };
}
