/**
 * ══════════════════════════════════════════════════════════════════════
 *  discovery/pharmacology — Biblioteca de candidatos y PK/PD
 * ══════════════════════════════════════════════════════════════════════
 *
 * Representa cada candidato terapéutico como un objeto pequeño con:
 *
 *   · Familia (proteína recombinante, anticuerpo, factor crecimiento,
 *     molécula pequeña, etc.)
 *   · Farmacocinética (onset, half-life) — modelo Bateman de 1 compartimento
 *   · Efecto en los parámetros reguladores (ΔF, Δk) del modelo RD, que
 *     representan la activación/inhibición de la cascada correspondiente
 *     (BMP, Wnt, TGF-β, …)
 *   · Selectividad espacial: local (gaussiana en sitio de aplicación) o
 *     sistémica (uniforme sobre el dominio)
 *   · Riesgo de efectos adversos (multiplicador para score de seguridad)
 *
 * Esto es `parametric pharmacology`: no hacemos docking/MD aquí, asumimos
 * que un paso upstream ya caracterizó cada candidato. En la pipeline real,
 * `deltaF` y `deltaK` vendrían de simulaciones MD del complejo proteína-
 * target + calibración contra assay in vitro.
 *
 * Ref:
 *   · Bateman 1910 — kinetics (también nuclear decay chains; la misma
 *     matemática describe absorción/eliminación farmacológica).
 *   · Rowland & Tozer, "Clinical Pharmacokinetics", 4ª ed., 2011.
 *   · Brockes & Kumar 2008 — BMP, Wnt en regeneración de extremidades.
 */

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

export type DrugFamily =
  | 'growth-factor'        // proteína recombinante (BMP-2, FGF-10, Wnt7a)
  | 'signaling-inhibitor'  // anticuerpo/molécula que bloquea TGF-β, etc.
  | 'reprogrammer'         // Yamanaka partial, valproic acid
  | 'senolytic'            // mata células senescentes
  | 'cytokine'             // IL-4, IL-10 (M2 macrófagos)
  | 'small-molecule'       // rapamicina, metformina
  | 'placebo';

export type DeliveryMode = 'local' | 'systemic';

export interface Drug {
  id: string;
  name: string;
  family: DrugFamily;
  /** Efecto sobre F de Gray-Scott (positivo empuja hacia α/regenerativo). */
  deltaF: number;
  /** Efecto sobre k. */
  deltaK: number;
  /** Onset a pico en horas ficticias de simulación. */
  onset: number;
  /** Half-life en horas ficticias. */
  halfLife: number;
  /** Modo de entrega. */
  delivery: DeliveryMode;
  /**
   * Riesgo de tumor: multiplicador del score de seguridad (>1 = peor).
   * Se pagan los efectos fuertes que empujan al sistema a α permanente.
   */
  tumorRisk: number;
  /** Descripción corta para la UI. */
  blurb: string;
  /** Referencia bibliográfica. */
  ref: string;
  /** Color de acento para la UI. */
  accent: string;
}

// ═══════════════════════════════════════════════════════════════
// Biblioteca — inspirada en compuestos reales de medicina regenerativa
// ═══════════════════════════════════════════════════════════════

export const DRUG_LIBRARY: Drug[] = [
  {
    id: 'bmp2',
    name: 'BMP-2 recombinante',
    family: 'growth-factor',
    deltaF: -0.040, deltaK: +0.002,
    onset: 4, halfLife: 24,
    delivery: 'local',
    tumorRisk: 1.3,
    blurb:
      'Factor de crecimiento óseo. Activa cascada SMAD. In vivo: repara ' +
      'defectos óseos (Infuse Bone Graft). Off-target: osificación ectópica.',
    ref: 'Wozney 1988, Science 242:1528',
    accent: '#F97316',
  },
  {
    id: 'wnt7a',
    name: 'Wnt7a recombinante',
    family: 'growth-factor',
    deltaF: -0.050, deltaK: +0.001,
    onset: 6, halfLife: 18,
    delivery: 'local',
    tumorRisk: 1.8,
    blurb:
      'Ligando Wnt canónico. Reactivado en blastema de salamandra. En ' +
      'ratón, acelera regeneración muscular. Riesgo: carcinogénesis.',
    ref: 'von Maltzahn 2011, Nat Cell Biol 13:1120',
    accent: '#A855F7',
  },
  {
    id: 'fgf10',
    name: 'FGF-10',
    family: 'growth-factor',
    deltaF: -0.030, deltaK: 0,
    onset: 3, halfLife: 12,
    delivery: 'local',
    tumorRisk: 1.1,
    blurb:
      'Factor crecimiento fibroblástico. Esencial para yema de extremidad ' +
      'embrionaria. En axolote reactiva morfogénesis. Relativamente seguro.',
    ref: 'Yokoyama 2001, Dev Biol 233:72',
    accent: '#10B981',
  },
  {
    id: 'anti-tgfb',
    name: 'Anti-TGF-β (Juvista-like)',
    family: 'signaling-inhibitor',
    deltaF: -0.015, deltaK: -0.002,
    onset: 8, halfLife: 96,
    delivery: 'systemic',
    tumorRisk: 0.7,
    blurb:
      'Anticuerpo neutraliza TGF-β1/2. Reduce cicatriz sin bloquear ' +
      'reparación. Ensayos clínicos fase II para cicatrices quirúrgicas.',
    ref: 'Ferguson 2009, Lancet 373:1264',
    accent: '#60A5FA',
  },
  {
    id: 'il4',
    name: 'IL-4 agonista',
    family: 'cytokine',
    deltaF: -0.020, deltaK: -0.001,
    onset: 2, halfLife: 8,
    delivery: 'local',
    tumorRisk: 0.9,
    blurb:
      'Polariza macrófagos a fenotipo M2 (pro-regenerativo). Promueve ' +
      'regeneración cardíaca en pez cebra; efecto parcial en mamífero.',
    ref: 'Aurora 2014, J Clin Invest 124:1382',
    accent: '#EC4899',
  },
  {
    id: 'noggin',
    name: 'Noggin (antagonista BMP)',
    family: 'signaling-inhibitor',
    deltaF: +0.025, deltaK: +0.001,
    onset: 5, halfLife: 30,
    delivery: 'local',
    tumorRisk: 0.8,
    blurb:
      'Atrapa BMP-2/4/7 en matriz extracelular. Útil para regular el ' +
      'balance activador-inhibidor — empuja al régimen NO regenerativo.',
    ref: 'Zimmerman 1996, Cell 86:599',
    accent: '#FCD34D',
  },
  {
    id: 'rapa-partial',
    name: 'Rapamicina pulsátil',
    family: 'small-molecule',
    deltaF: -0.010, deltaK: -0.001,
    onset: 1, halfLife: 16,
    delivery: 'systemic',
    tumorRisk: 0.5,
    blurb:
      'Inhibidor mTORC1. En régimen pulsátil: rejuvenece tejidos sin ' +
      'inmunosupresión crónica. Amplía ventana pro-regenerativa.',
    ref: 'Harrison 2009, Nature 460:392',
    accent: '#22D3EE',
  },
  {
    id: 'yam-partial',
    name: 'Yamanaka parcial (2d/sem)',
    family: 'reprogrammer',
    deltaF: -0.055, deltaK: +0.003,
    onset: 24, halfLife: 48,
    delivery: 'local',
    tumorRisk: 2.2,
    blurb:
      'Oct4/Sox2/Klf4 en pulsos 2 días/semana. Rejuvenece epigenética. ' +
      'Dosis excesiva → teratomas. Alto riesgo, alto upside.',
    ref: 'Ocampo 2016, Cell 167:1719',
    accent: '#F472B6',
  },
  {
    id: 'senolytic',
    name: 'Senolítico (Dasatinib + Q)',
    family: 'senolytic',
    deltaF: -0.005, deltaK: -0.0005,
    onset: 12, halfLife: 36,
    delivery: 'systemic',
    tumorRisk: 0.4,
    blurb:
      'Elimina células senescentes que secretan SASP pro-inflamatorio. ' +
      'Efecto indirecto: el tejido "rejuvenece" y responde mejor a otros.',
    ref: 'Zhu 2015, Aging Cell 14:644',
    accent: '#94A3B8',
  },
  {
    id: 'placebo',
    name: 'Placebo (suero salino)',
    family: 'placebo',
    deltaF: 0, deltaK: 0,
    onset: 1, halfLife: 4,
    delivery: 'systemic',
    tumorRisk: 1.0,
    blurb: 'Control. No modifica parámetros regulatorios. Para calibración.',
    ref: '—',
    accent: '#475569',
  },
];

// ═══════════════════════════════════════════════════════════════
// PK/PD — perfil Bateman de un compartimento
// ═══════════════════════════════════════════════════════════════

/**
 * Concentración normalizada en el sitio de acción (pico = 1).
 *
 *   c(t) = dose · (k_a / (k_a − k_e)) · (exp(−k_e t) − exp(−k_a t))
 *
 * donde k_a = ln(2)/(onset·ln(2)/ln(2)) → k_a = 1/onset aprox.
 *       k_e = ln(2)/halfLife
 *
 * Normalizado a c_peak = 1. Antes de t=0, devuelve 0.
 */
export function pkBateman(t: number, drug: Drug, dose = 1): number {
  if (t <= 0) return 0;
  const ka = 1 / Math.max(drug.onset, 0.01);
  const ke = Math.LN2 / Math.max(drug.halfLife, 0.1);
  if (Math.abs(ka - ke) < 1e-6) {
    // Caso degenerado (k_a = k_e) — usar forma límite: c(t) = dose·k·t·exp(-kt)
    return dose * ke * t * Math.exp(-ke * t) / Math.exp(-1);
  }
  const norm = (ka / (ka - ke)) *
    (Math.exp(-ke * timeToPeak(drug)) - Math.exp(-ka * timeToPeak(drug)));
  const raw = (ka / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t));
  return dose * (raw / Math.max(norm, 1e-9));
}

/** Tiempo del pico: t_max = ln(k_a/k_e) / (k_a − k_e). */
export function timeToPeak(drug: Drug): number {
  const ka = 1 / Math.max(drug.onset, 0.01);
  const ke = Math.LN2 / Math.max(drug.halfLife, 0.1);
  if (Math.abs(ka - ke) < 1e-6) return 1 / ke;
  return Math.log(ka / ke) / (ka - ke);
}

// ═══════════════════════════════════════════════════════════════
// Selectividad espacial
// ═══════════════════════════════════════════════════════════════

/**
 * Peso espacial de una dosis local (gaussiana centrada en xc, yc) o
 * sistémica (constante). Normalizado: pico (local) = 1; sistémica = 1.
 */
export function spatialWeight(
  drug: Drug, x: number, y: number, xc: number, yc: number, radius: number,
): number {
  if (drug.delivery === 'systemic') return 1;
  const dx = x - xc, dy = y - yc;
  const r2 = dx * dx + dy * dy;
  return Math.exp(-r2 / (2 * radius * radius));
}

// ═══════════════════════════════════════════════════════════════
// Schedule — lista de administraciones + superposición
// ═══════════════════════════════════════════════════════════════

export interface Administration {
  drugId: string;
  /** Tiempo t (hr sim) en que se aplica. */
  t0: number;
  /** Dosis relativa (default 1). */
  dose: number;
  /** Centro espacial (para local). [-1, 1]² en coordenadas normalizadas. */
  xc?: number;
  yc?: number;
  /** Radio del pulso local (en coords normalizadas). */
  radius?: number;
}

export interface Schedule {
  administrations: Administration[];
}

/**
 * Efecto total en (F, k) a tiempo t y punto (x, y), superponiendo todas
 * las administraciones. Devuelve (ΔF, Δk) a sumar al baseline "humano".
 */
export function currentModulation(
  schedule: Schedule,
  t: number, x: number, y: number,
  library: Drug[] = DRUG_LIBRARY,
): { dF: number; dK: number; totalExposure: number; tumorPressure: number } {
  let dF = 0, dK = 0, exposure = 0, tumorP = 0;
  for (const adm of schedule.administrations) {
    const drug = library.find(d => d.id === adm.drugId);
    if (!drug) continue;
    const c = pkBateman(t - adm.t0, drug, adm.dose);
    if (c <= 0) continue;
    const w = spatialWeight(drug, x, y, adm.xc ?? 0, adm.yc ?? 0, adm.radius ?? 0.25);
    const cw = c * w;
    dF += drug.deltaF * cw;
    dK += drug.deltaK * cw;
    exposure += cw;
    tumorP += cw * drug.tumorRisk;
  }
  return { dF, dK, totalExposure: exposure, tumorPressure: tumorP };
}

// ═══════════════════════════════════════════════════════════════
// Scoring — heal, safety, overall
// ═══════════════════════════════════════════════════════════════

/**
 * Score de sanación: fracción de la región herida que recuperó ≥ θ_v del
 * valor objetivo (v_target), penalizado por desviación en tejido sano.
 */
export function healScore(
  fieldU: Float32Array,  // longitud RES²·4
  RES: number,
  mask: Uint8Array,      // 1 donde estaba la herida, 0 resto. longitud RES²
  vTarget = 0.25,
  theta = 0.6,
): number {
  let woundOk = 0, woundTotal = 0, healthyDev = 0, healthyTotal = 0;
  for (let i = 0; i < RES * RES; i++) {
    const v = fieldU[i * 4 + 1];
    if (mask[i]) {
      woundTotal++;
      if (v >= theta * vTarget) woundOk++;
    } else {
      healthyTotal++;
      healthyDev += Math.abs(v - vTarget);
    }
  }
  const heal = woundTotal > 0 ? woundOk / woundTotal : 0;
  const devPenalty = healthyTotal > 0 ? healthyDev / (healthyTotal * vTarget) : 0;
  return Math.max(0, heal - 0.3 * devPenalty);
}

/**
 * Score de seguridad: 1 − presión acumulada de tumor promedio.
 * Integra tumorPressure(t) sobre el horizonte de simulación.
 */
export function safetyScore(cumulativeTumorPressure: number, tEnd: number): number {
  const avg = cumulativeTumorPressure / Math.max(tEnd, 1);
  return Math.max(0, 1 - avg * 0.5);
}

/**
 * Score general = heal · safety. Ambos en [0,1] ⇒ resultado en [0,1].
 * Pensado para maximizar en auto-search.
 */
export function overallScore(heal: number, safety: number): number {
  return heal * safety;
}
