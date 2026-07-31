/**
 * SISTEMA DE ALIMENTACIÓN (COLADA) — Kazmer cap 6 "Feed System Design"
 * =====================================================================
 * Runners fríos y CALIENTES: caída de presión por segmento (power-law en
 * conducto circular), volumen del sistema, y OPTIMIZACIÓN de diámetros
 * mínimos dado un ΔP máximo (Eq 6.8 + asignación proporcional Eq 6.9).
 * Verificado contra el hot-runner del laptop bezel (p.139-144).
 */
import type { MeltMaterial } from './filling';

export interface RunnerSegment {
  name: string;
  /** Largo del segmento (m). */
  L: number;
  /** Radio del conducto (m). */
  R: number;
  /** Caudal volumétrico por ESTE segmento (m³/s) — se divide en cada rama. */
  Vdot: number;
  /** Número de veces que aparece (ramas paralelas) — para el volumen total. */
  count?: number;
}

/** Eq (6.2): número de Reynolds del fundido en el runner (<2300 = laminar). */
export function reynolds(rhoKgM3: number, VdotM3s: number, muPaS: number, dMeters: number): number {
  return (4 * rhoKgM3 * VdotM3s) / (Math.PI * muPaS * dMeters);
}

/** Eq (6.4): tasa de corte en conducto circular γ̇ = 4·V̇/(π·R³). */
export const shearRateRunner = (VdotM3s: number, rMeters: number): number =>
  (4 * VdotM3s) / (Math.PI * Math.pow(rMeters, 3));

/** Eq (6.5): ΔP power-law de un segmento: (2kL/R)·[(3+1/n)·V̇/(π·R³)]^n  (Pa). */
export function pressureDropRunner(m: MeltMaterial, seg: RunnerSegment): number {
  return ((2 * m.k * seg.L) / seg.R) *
    Math.pow(((3 + 1 / m.n) * seg.Vdot) / (Math.PI * Math.pow(seg.R, 3)), m.n);
}

/** ΔP total del sistema (suma de la RUTA nozzle→gate, no de las ramas paralelas). */
export function feedPressureDrop(m: MeltMaterial, path: RunnerSegment[]): number {
  return path.reduce((p, s) => p + pressureDropRunner(m, s), 0);
}

/** Eq (6.6): volumen total del sistema (con multiplicidad de ramas) en m³. */
export function feedVolume(segments: RunnerSegment[]): number {
  return segments.reduce((v, s) => v + (s.count ?? 1) * s.L * Math.PI * s.R * s.R, 0);
}

/**
 * Eq (6.8): RADIO MÍNIMO de un segmento para no exceder ΔP_max:
 * R = [ (2kL/ΔP)^(1/n) · (3+1/n)·V̇/π ]^( 1/(3+1/n) )
 */
export function minRunnerRadius(m: MeltMaterial, L: number, VdotM3s: number, dPmaxPa: number): number {
  const a = Math.pow((2 * m.k * L) / dPmaxPa, 1 / m.n);
  const b = ((3 + 1 / m.n) * VdotM3s) / Math.PI;
  return Math.pow(a * b, 1 / (3 + 1 / m.n));
}

/**
 * §6.4.7 — TIEMPO DE ENFRIAMIENTO del runner (cilindro, Eq 9.6 con 1.60):
 * t_c = D²/(23.1·α) · ln( 1.60 · (Tmelt−Tcool)/(Teject−Tcool) )
 * VERIFICADO contra el runner ⌀4.76 del cup/lid: 22.9 s ✓ (p.203).
 * ⚠ ERRATA: la Tabla 6.2 imprime 0.692 y su ejemplo del sprue ⌀5.4 da 26.7 s,
 * que NO reproduce ni con 0.692 (17.3) ni con 1.60 (29.5). El coeficiente 1.60
 * es el de Eq (9.6) y reproduce EXACTO el caso de p.203 ⇒ ese es el canon.
 * El diseñador compara este t_c contra el de la pieza: si el runner DOMINA el
 * ciclo, reducir su diámetro (el libro lo advierte: no rigidez de pieza).
 */
export function runnerCoolingTimeS(alphaM2s: number, dM: number, tMelt: number, tCool: number, tEject: number): number {
  return (dM * dM) / (23.1 * alphaM2s) * Math.log(1.60 * (tMelt - tCool) / (tEject - tCool));
}

/** §6.5.4 — fresas ESTÁNDAR (mm) para redondear diámetros de runner. */
export const STANDARD_RUNNER_DIAMM = [2, 3, 4, 4.5, 5, 6, 8, 10, 12];
/** §6.5.5 — STEEL SAFE: redondear HACIA ABAJO al estándar (quitar acero después es fácil). */
export function steelSafeDiaMm(diaMm: number): number {
  const smaller = STANDARD_RUNNER_DIAMM.filter((d) => d <= diaMm);
  return smaller.length ? smaller[smaller.length - 1] : STANDARD_RUNNER_DIAMM[0];
}

/** Apéndice A (p.390-393, LITERAL) — propiedades térmicas/proceso por material
 *  para el diseño de la colada. tCool/tMelt = medios de los rangos impresos. */
export const FEED_MATERIALS: Record<string, {
  k: number; n: number; alpha: number; tMelt: number; tCool: number;
  tEject: number; tNoFlow: number; shearMax: number; rhoMeltKgM3: number;
}> = {
  PP:  { k: 5300,  n: 0.378, alpha: 8.15e-8, tMelt: 220, tCool: 40, tEject: 80,   tNoFlow: 176, shearMax: 100000, rhoMeltKgM3: 781 },
  ABS: { k: 17100, n: 0.348, alpha: 8.73e-8, tMelt: 239, tCool: 60, tEject: 96.7, tNoFlow: 132, shearMax: 50000,  rhoMeltKgM3: 930 },
};

/**
 * DISEÑO DEL SPRUE de colada fría con gate directo (§6.3.1 + §7.2.1) — el caso
 * del vaso centro-inyectado: boquilla → sprue CÓNICO a través del bushing y la
 * placa A → gate de sprue en el centro de la pieza. Proceso del libro:
 *   1. V̇ = V_pieza / t_llenado (§6.4.6: el flujo lo fija la cavidad)
 *   2. R medio por Eq (6.8) con el ΔP asignado al sprue (p.147 usa 20 MPa)
 *   3. Cono §6.3.1: entrada = orificio de boquilla + holgura; salida = el mayor
 *      de (R de diseño, entrada + L·tan(taper)) — extraíble Y suficiente
 *   4. Chequeos: γ̇ (Tabla 7.2) vs Apéndice A · Re (Eq 6.2) · t_c del sprue vs
 *      t_c de la pieza (§6.4.7: si el sprue DOMINA el ciclo, reducirlo) ·
 *      freeze del gate (Tabla 7.4) · volumen/regrind (Eq 6.6)
 */
export function designSprueFeed(o: {
  material: string; partVolumeCc: number; partWallMm: number; sprueLenMm: number;
  fillTimeS?: number; dPAllocMPa?: number; nozzleOrificeMm?: number; taperDeg?: number;
}) {
  const m = FEED_MATERIALS[o.material] ?? FEED_MATERIALS.PP;
  const mm = m as unknown as MeltMaterial;                         // FEED_MATERIALS trae el subconjunto power-law que usan estas Eq
  const tFill = o.fillTimeS ?? 1;                                  // convención de los ejemplos del libro
  const Vdot = (o.partVolumeCc * 1e-6) / tFill;                    // m³/s
  const L = o.sprueLenMm / 1000;
  const dP = (o.dPAllocMPa ?? 20) * 1e6;                           // p.147: 20 MPa al sprue
  const Rdesign = minRunnerRadius(mm, L, Vdot, dP);
  const rNozzle = (o.nozzleOrificeMm ?? 4.5) / 2 / 1000;           // orificio estándar de boquilla
  const rTop = rNozzle + 0.25e-3;                                  // §6.3.1: entrada > orificio (que la rebaba quede en la boquilla)
  const taper = ((o.taperDeg ?? 1.5) * Math.PI) / 180;             // taper por lado (extracción)
  const rBase = Math.max(Rdesign, rTop + L * Math.tan(taper));     // salida (lado pieza)
  const rMean = (rTop + rBase) / 2;
  const seg: RunnerSegment = { name: 'sprue', L, R: rMean, Vdot };
  const dPMPa = pressureDropRunner(mm, seg) / 1e6;
  const shear = shearRateRunner(Vdot, rTop);                       // γ̇ máximo = en la sección MÁS angosta
  const re = reynolds(m.rhoMeltKgM3, Vdot, 100, 2 * rMean);
  const volCc = ((Math.PI * L) / 3) * (rTop * rTop + rTop * rBase + rBase * rBase) * 1e6;  // cono truncado
  const tcSprueS = runnerCoolingTimeS(m.alpha, 2 * rBase, m.tMelt, m.tCool, m.tEject);
  const h = (o.partWallMm / 1000);
  const tcPartS = (h * h) / (Math.PI * Math.PI * m.alpha) * Math.log((4 / Math.PI) * (m.tMelt - m.tCool) / (m.tEject - m.tCool));  // Eq 9.5
  const freezeGateS = gateFreezeCylSFeed(m.alpha, 2 * rBase, m.tMelt, m.tCool, m.tNoFlow);
  const regrindPct = (volCc / o.partVolumeCc) * 100;
  const rows: Array<{ k: string; v: string; ref: string; warn?: boolean }> = [
    { k: 'V̇ de diseño', v: `${(Vdot * 1e6).toFixed(1)} cc/s`, ref: `V pieza ${o.partVolumeCc.toFixed(0)} cc / ${tFill} s` },
    { k: 'sprue ⌀ entrada→salida', v: `${(2 * rTop * 1000).toFixed(1)} → ${(2 * rBase * 1000).toFixed(1)} mm`, ref: `Eq 6.8 con ΔP=${(dP / 1e6).toFixed(0)} MPa + taper ${o.taperDeg ?? 1.5}°/lado §6.3.1` },
    { k: 'ΔP del sprue', v: `${dPMPa.toFixed(1)} MPa`, ref: 'Eq 6.5 power-law · <50 MPa §6.2.2', warn: dPMPa > 50 },
    { k: 'γ̇ en la entrada', v: `${Math.round(shear).toLocaleString()} 1/s`, ref: `Tabla 7.2 · máx ${m.shearMax.toLocaleString()} (Apéndice A)`, warn: shear > m.shearMax },
    { k: 'Re', v: re.toExponential(1), ref: 'Eq 6.2 · <2300 laminar', warn: re > 2300 },
    { k: 'V colada / regrind', v: `${volCc.toFixed(1)} cc · ${regrindPct.toFixed(1)} %`, ref: 'Eq 6.6 · <30 % §6.2.3', warn: regrindPct > 30 },
    { k: 't_c sprue vs pieza', v: `${tcSprueS.toFixed(1)} s vs ${tcPartS.toFixed(1)} s`, ref: '§6.4.7: si el sprue domina el ciclo, reducir ⌀ (steel-safe)', warn: tcSprueS > tcPartS },
    { k: 'freeze del gate', v: `${freezeGateS.toFixed(1)} s`, ref: 'Tabla 7.4 (T_no_flow Apéndice A) · fija el tiempo de EMPAQUE' },
  ];
  return { rTopMm: rTop * 1000, rBaseMm: rBase * 1000, VdotCcS: Vdot * 1e6, dPMPa, shear, re, volCc, regrindPct, tcSprueS, tcPartS, freezeGateS, rows };
}
// (copia local para no ciclar imports con gating.ts)
function gateFreezeCylSFeed(alpha: number, dM: number, tMelt: number, tCool: number, tNoFlow: number): number {
  return (dM * dM) / (23.1 * alpha) * Math.log(0.692 * (tMelt - tCool) / (tNoFlow - tCool));
}

/** Volumen APROXIMADO de la pieza (cáscara: base + paredes) en cc — para fijar V̇. */
export function estPartVolumeCc(c: { shape?: string; widthMm: number; lenMm?: number; depthMm: number; wallMm?: number }): number {
  const w = c.wallMm ?? 2;
  return (c.shape === 'round'
    ? Math.PI * (c.widthMm / 2) ** 2 * w + Math.PI * c.widthMm * c.depthMm * w
    : (c.widthMm * (c.lenMm ?? c.widthMm) + 2 * (c.widthMm + (c.lenMm ?? c.widthMm)) * c.depthMm) * w) / 1000;
}

/** LA FUENTE ÚNICA del sprue: mismos números para el barreno de las placas
 *  (standardHoles), la geometría del fundido y el reporte del árbol. */
export function sprueDesignFromCavity(
  plastic: string | undefined,
  cavity: { shape?: string; widthMm: number; lenMm?: number; depthMm: number; wallMm?: number },
  sprueLenMm: number,
) {
  return designSprueFeed({
    material: plastic ?? 'PP', partVolumeCc: estPartVolumeCc(cavity),
    partWallMm: cavity.wallMm ?? 2, sprueLenMm,
  });
}

/** Una vuelta del lazo de diseño del feed, con la razón citada de por qué se dio. */
export interface FeedIteration {
  paso: number; diaBaseMm: number; dPMPa: number; tcSprueS: number; accion: string;
}

/**
 * EL SISTEMA DE ALIMENTACIÓN COMO LAZO — §6.4.5 + §6.4.7 + §6.5.5
 * ================================================================
 * El libro NO diseña el feed de una pasada: asigna el ΔP, calcula, y si el
 * enfriamiento de la colada DOMINA el ciclo, REGRESA a reducir el diámetro
 * ("reducir el diámetro del sprue, albeit with a higher pressure drop", §6.4.7).
 * Ese retorno es el primer lazo real de la Máquina.
 *
 * El lazo tiene un CONFLICTO built-in y hay que decirlo en voz alta: bajar el ⌀
 * arregla el ciclo (§6.4.7) y empeora la presión (§6.2.2). Cuando no existe ⌀ que
 * satisfaga ambos, la función NO elige por su cuenta — reporta el conflicto para
 * que lo arbitre el humano (§1.2: "It is up to the mold designer to consider the
 * relative importance of the conflicting requirements").
 *
 * Y el diámetro final se redondea HACIA ABAJO a talla de catálogo (§6.5.5,
 * steel-safe): se puede abrir en el tryout, cerrarlo cuesta soldadura.
 */
export function designFeedSystem(o: {
  material: string; partVolumeCc: number; partWallMm: number; sprueLenMm: number;
  nCav: number; fillMPa: number; fillTimeS?: number; nozzleOrificeMm?: number; taperDeg?: number;
  /** colada caliente: el límite de volumen es otro (§6.2.3, n_turns ≈ 1) */
  hotRunner?: boolean;
}) {
  const m = FEED_MATERIALS[o.material] ?? FEED_MATERIALS.PP;
  const mm = m as unknown as MeltMaterial;                       // FEED_MATERIALS trae el subconjunto power-law que usan estas Eq
  const tFill = o.fillTimeS ?? 1;
  const Vdot = (o.partVolumeCc * 1e-6) / tFill;
  const L = o.sprueLenMm / 1000;
  const limDPMPa = Math.min(0.5 * o.fillMPa, 50);                // §6.2.2
  const limPct = o.hotRunner ? 100 : 30;                         // §6.2.3
  const rNozzle = (o.nozzleOrificeMm ?? 4.5) / 2 / 1000;
  const rTop = rNozzle + 0.25e-3;                                // §6.3.1: entrada > orificio
  const taper = ((o.taperDeg ?? 1.5) * Math.PI) / 180;

  // t_c de la PIEZA (Eq 9.5) — la referencia contra la que se juzga la colada.
  const h = o.partWallMm / 1000;
  const tcPartS = (h * h) / (Math.PI * Math.PI * m.alpha)
    * Math.log((4 / Math.PI) * (m.tMelt - m.tCool) / (m.tEject - m.tCool));

  /** Evalúa un ⌀ de base concreto: ΔP, t_c, volumen, corte, Reynolds. */
  const evalDia = (diaBaseMm: number) => {
    const rBase = diaBaseMm / 2 / 1000;
    const rMean = (rTop + rBase) / 2;
    const dPMPa = pressureDropRunner(mm, { name: 'sprue', L, R: rMean, Vdot }) / 1e6;
    const tcSprueS = runnerCoolingTimeS(m.alpha, 2 * rBase, m.tMelt, m.tCool, m.tEject);
    const volCc = ((Math.PI * L) / 3) * (rTop * rTop + rTop * rBase + rBase * rBase) * 1e6;
    return {
      diaBaseMm, dPMPa, tcSprueS, volCc,
      shear: shearRateRunner(Vdot, rTop),                        // γ̇ máx = sección más angosta
      re: reynolds(m.rhoMeltKgM3, Vdot, 100, 2 * rMean),
      pctRegrind: (volCc / (o.partVolumeCc * o.nCav)) * 100,
    };
  };

  // ── PASO 1 (§6.4.5): ⌀ de arranque por el ΔP asignado, acotado por extracción ──
  const rDesign = minRunnerRadius(mm, L, Vdot, limDPMPa * 1e6);
  const rBase0 = Math.max(rDesign, rTop + L * Math.tan(taper));
  const diaDesign = rBase0 * 2 * 1000;
  const cat = STANDARD_RUNNER_DIAMM;
  const iters: FeedIteration[] = [];

  // §6.5.5 pide redondear HACIA ABAJO a catálogo (steel-safe). Pero el steel-safe
  // NO puede romper el presupuesto de presión que §6.4.5 acaba de asignar: bajar el
  // ⌀ sube ΔP, y arriba del catálogo los escalones son grandes (9.5→8 mm ya duplica
  // el ΔP). Se aplica sólo si el ⌀ de catálogo sigue cumpliendo §6.2.2; si no, se
  // conserva el ⌀ de diseño y se DICE por qué no se aplicó (el sesgo declarado de
  // §3.3.1.3 vale también para las reglas que decidimos NO aplicar).
  const diaSafe = steelSafeDiaMm(diaDesign);
  const evSafe = evalDia(diaSafe);
  let dia: number, ev: ReturnType<typeof evalDia>;
  if (evSafe.dPMPa <= limDPMPa) {
    dia = diaSafe; ev = evSafe;
    iters.push({ paso: 1, diaBaseMm: dia, dPMPa: ev.dPMPa, tcSprueS: ev.tcSprueS,
      accion: `§6.4.5 ⌀ por ΔP asignado (${limDPMPa.toFixed(1)} MPa) = ${diaDesign.toFixed(2)} mm → §6.5.5 steel-safe a catálogo hacia abajo` });
  } else {
    dia = diaDesign; ev = evalDia(dia);
    iters.push({ paso: 1, diaBaseMm: dia, dPMPa: ev.dPMPa, tcSprueS: ev.tcSprueS,
      accion: `§6.4.5 ⌀ por ΔP asignado = ${diaDesign.toFixed(2)} mm · §6.5.5 steel-safe NO aplicado: bajar a ⌀${diaSafe} daría ΔP ${evSafe.dPMPa.toFixed(1)} > ${limDPMPa.toFixed(1)} MPa (el sprue no se rige por el catálogo de fresas del runner)` });
  }

  // ── PASO 2+ (§6.4.7): mientras la colada DOMINE el ciclo, bajar un escalón ──
  let conflicto: string | null = null;
  for (let paso = 2; paso <= 8; paso++) {
    if (ev.tcSprueS <= tcPartS) break;                           // la pieza manda el ciclo: listo
    // siguiente escalón por DEBAJO del ⌀ actual (el actual puede no estar en catálogo)
    const i = cat.findIndex((d) => d >= dia);
    if (i <= 0) {
      conflicto = `§6.4.7 vs catálogo: la colada domina el ciclo (t_c ${ev.tcSprueS.toFixed(1)} s > ${tcPartS.toFixed(1)} s de la pieza) y ya estás en el ⌀ más chico del catálogo (${dia} mm)`;
      break;
    }
    const next = evalDia(cat[i - 1]);
    if (next.dPMPa > limDPMPa) {
      // El conflicto del libro, explícito: no lo resuelve el software.
      conflicto = `§6.4.7 (ciclo) CHOCA con §6.2.2 (presión): bajar de ⌀${dia.toFixed(2)} a ⌀${cat[i - 1]} mm arreglaría el ciclo (t_c ${ev.tcSprueS.toFixed(1)}→${next.tcSprueS.toFixed(1)} s) pero rompe el presupuesto de presión (ΔP ${next.dPMPa.toFixed(1)} > ${limDPMPa.toFixed(1)} MPa). Lo arbitra el humano §1.2 — el libro admite que "el runner no necesita la misma rigidez que la pieza" §9.2.1`;
      break;
    }
    dia = cat[i - 1]; ev = next;
    iters.push({ paso, diaBaseMm: dia, dPMPa: ev.dPMPa, tcSprueS: ev.tcSprueS,
      accion: `§6.4.7 la colada dominaba el ciclo → bajar un escalón de catálogo (sube ΔP, es el costo declarado)` });
  }

  const notas: string[] = [];
  if (ev.dPMPa > limDPMPa) notas.push(`ΔP ${ev.dPMPa.toFixed(1)} > ${limDPMPa.toFixed(1)} MPa §6.2.2`);
  if (ev.pctRegrind > limPct) notas.push(`volumen ${ev.pctRegrind.toFixed(1)} % > ${limPct} % §6.2.3`);
  if (ev.tcSprueS > tcPartS) notas.push(`la colada domina el ciclo §6.4.7`);
  if (ev.shear > m.shearMax) notas.push(`γ̇ ${Math.round(ev.shear)} > ${m.shearMax} 1/s §7.1.4`);

  return {
    diaBaseMm: dia, diaTopMm: rTop * 2 * 1000, sprueLenMm: o.sprueLenMm,
    dPMPa: ev.dPMPa, limDPMPa,
    volCc: ev.volCc, pctRegrind: ev.pctRegrind, limPct,
    tcSprueS: ev.tcSprueS, tcPartS,
    shear: ev.shear, shearMax: m.shearMax, re: ev.re,
    VdotCcS: Vdot * 1e6,
    iteraciones: iters, conflicto, notas,
    ok: notas.length === 0 && !conflicto,
  };
}
export type FeedSystemDesign = ReturnType<typeof designFeedSystem>;

/**
 * OPTIMIZADOR del libro (§6.4.5): asigna ΔP_max proporcional a la longitud de
 * cada segmento de la ruta (Eq 6.9) y despeja el radio mínimo (Eq 6.8).
 */
export function optimizeFeedSystem(
  m: MeltMaterial, path: Array<Omit<RunnerSegment, 'R'>>, dPmaxPa: number,
): Array<RunnerSegment & { dPAllocPa: number }> {
  const Ltot = path.reduce((s, p) => s + p.L, 0);
  return path.map((p) => {
    const dPi = dPmaxPa * (p.L / Ltot);
    return { ...p, dPAllocPa: dPi, R: minRunnerRadius(m, p.L, p.Vdot, dPi) };
  });
}
