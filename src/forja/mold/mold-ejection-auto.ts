/**
 * mold-ejection-auto.ts — EL CEREBRO de la eyección automática (Fase 2).
 * ============================================================================
 * Visión del user: "la flanera solo debería ser el objeto que cargamos; el módulo
 * de eyección y return pins se AUTO-GENERA en base a la figura y la fuerza de
 * expulsión". Aquí está el cerebro: de la FIGURA + MATERIAL sale la fuerza (Eq 11.7),
 * el TIPO correcto (pin/blade/sleeve/stripper según §11.2-5) y el dimensionado
 * (Eq 11.10/11.12), con las tolerancias reales (fits.ts). La geometría se proyecta
 * de este plan — nunca al revés.
 *
 * Clave que el user cazó: un VASO de pared delgada NO se expulsa con pines (perforan
 * el fondo de 1.2 mm) → chooseEjectorType lo manda a STRIPPER (empuja el borde).
 */
import { ejectionForce, effectiveArea, ejectorPinSizing, type EjectionMaterial, ABS_EJECT } from './ejection';
import { chooseEjectorType, type EjectorType } from './ejectortypes';
import { ejectorPinFit } from './fits';

// ── Materiales de EXPULSIÓN por plástico (E, CTE, T, µ, σy, ρ). ABS del libro. ──
export const PP_EJECT: EjectionMaterial = { E: 1.5e9, cte: 1.5e-4, tSolid: 130, tEject: 90, mu: 0.4, sigmaYield: 35e6, rho: 905 };
export const PS_EJECT: EjectionMaterial = { E: 3.2e9, cte: 7.0e-5, tSolid: 100, tEject: 70, mu: 0.5, sigmaYield: 40e6, rho: 1040 };
export const PC_EJECT: EjectionMaterial = { E: 2.4e9, cte: 6.5e-5, tSolid: 150, tEject: 130, mu: 0.5, sigmaYield: 60e6, rho: 1200 };
export const EJECT_MATERIALS: Record<string, EjectionMaterial> = { ABS: ABS_EJECT, PP: PP_EJECT, PS: PS_EJECT, PC: PC_EJECT };

export interface PartFigure {
  kind: 'cup' | 'box' | 'flat' | 'ribbed';
  Lmm: number; Wmm: number; Hmm: number; wallMm: number; draftDeg: number;
  round?: boolean;
  boss?: boolean; rib?: boolean;          // rasgos que fuerzan sleeve/blade
}

export interface EjectionPlan {
  type: EjectorType; porQue: string;
  forceN: number; forceKN: number; aEffM2: number;
  nPins?: number; pinDiaMm?: number; holeDiaMm?: number;   // si type=pin/blade
  positions?: Array<{ x: number; y: number }>;
  stripper?: { pushPerimeterMm: number; note: string };    // si type=stripper
  report: string[];
}

/** Cerebro: figura + material → plan de eyección (tipo + fuerza + dimensionado). */
export function autoEjectionPlan(fig: PartFigure, materialKey = 'ABS'): EjectionPlan {
  const m = EJECT_MATERIALS[materialKey] ?? ABS_EJECT;
  // área efectiva de agarre = fricción del plástico sobre el core (paredes laterales)
  const aEff = fig.round
    ? Math.PI * (fig.Lmm - 2 * fig.wallMm) * 1e-3 * fig.Hmm * 1e-3   // vaso redondo: π·D_int·H
    : effectiveArea({ h: fig.Hmm * 1e-3, L: fig.Lmm * 1e-3, W: fig.Wmm * 1e-3 });
  const F = ejectionForce(m, fig.draftDeg, aEff);

  // ELIGE el tipo desde la figura (§11.2-5)
  const thin = fig.wallMm < 1.5;
  const feat = {
    fullPerimeter: fig.kind === 'cup' && thin,   // vaso delgado → empuje perimetral (stripper)
    boss: fig.boss, rib: fig.rib,
    thinWall: thin, flatPushArea: fig.kind === 'box' || fig.kind === 'flat',
  };
  const { type, porQue } = chooseEjectorType(feat);

  const plan: EjectionPlan = { type, porQue, forceN: F, forceKN: F / 1000, aEffM2: aEff, report: [] };
  plan.report.push(`Fuerza de expulsión ${(F / 1000).toFixed(2)} kN (µ=${m.mu}, draft ${fig.draftDeg.toFixed(1)}°, A_eff ${(aEff * 1e4).toFixed(0)} cm²) — Eq 11.7`);
  plan.report.push(`Tipo: ${type.toUpperCase()} — ${porQue}`);

  if (type === 'pin' || type === 'blade') {
    // Diámetro ESTÁNDAR por tamaño de pieza; la CUENTA sale de la fuerza (el cortante
    // en el plástico, Eq 11.12, suele gobernar → muchos pines chicos, no pocos gigantes).
    const stdDia = fig.Lmm > 120 ? 12 : fig.Lmm > 60 ? 10 : 8;    // mm
    const nComp = Math.ceil(4 * (F / 450e6) / (Math.PI * (stdDia * 1e-3) ** 2));   // Eq 11.10 (compresión/fatiga)
    const nShear = Math.ceil((2 * F / (m.sigmaYield * fig.wallMm * 1e-3)) / (Math.PI * stdDia * 1e-3)); // Eq 11.12 (cortante)
    const nPins = Math.max(4, nComp, nShear);
    const holeDia = ejectorPinFit(stdDia).holeDiaMm;
    plan.nPins = nPins; plan.pinDiaMm = stdDia; plan.holeDiaMm = holeDia;
    // rejilla nx×ny bajo la huella (margen 15%)
    const nx = Math.max(2, Math.round(Math.sqrt(nPins))), ny = Math.ceil(nPins / nx);
    const mx = fig.Lmm * 0.15, my = fig.Wmm * 0.15; const pos: Array<{ x: number; y: number }> = [];
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx && pos.length < nPins; c++)
      pos.push({ x: Math.round(mx + (c * (fig.Lmm - 2 * mx)) / Math.max(1, nx - 1)), y: Math.round(my + (r * (fig.Wmm - 2 * my)) / Math.max(1, ny - 1)) });
    plan.positions = pos;
    plan.report.push(`${nPins} pines ⌀${stdDia} mm (cortante gobierna, Eq 11.12) · barreno ⌀${holeDia} (holgura 0.13, fits.ts)`);
    if (nPins > 30) plan.report.push(`⚠ ${nPins} pines es MUCHO — sube el draft (hoy ${fig.draftDeg.toFixed(1)}°) para bajar la fuerza de expulsión`);
  } else if (type === 'stripper') {
    const perim = fig.round ? Math.PI * ((fig.Lmm + fig.Wmm) / 2) : 2 * (fig.Lmm + fig.Wmm);
    plan.stripper = { pushPerimeterMm: +perim.toFixed(0), note: 'placa botadora empuja TODO el borde' };
    plan.report.push(`PLACA BOTADORA (stripper): empuje en ${perim.toFixed(0)} mm de perímetro · la pared de ${fig.wallMm} mm NO se perfora (por eso no van pines)`);
  } else if (type === 'sleeve') {
    plan.report.push(`SLEEVE (buje expulsor) sobre el core pin del boss — empuja el fondo del boss (§11.3.3)`);
  }
  return plan;
}
