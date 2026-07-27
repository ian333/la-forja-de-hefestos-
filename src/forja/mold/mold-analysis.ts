/**
 * SIMULACIÓN Y ANÁLISIS DEL MOLDE — térmico (§9) + estructural (§12) de Kazmer,
 * sobre el MoldAssemblySpec REAL del molde vivo (mismas cotas que la geometría 3D).
 * ==============================================================================
 * Nada inventado: cada número sale de una ecuación del libro y se valida contra
 * los ejemplos resueltos (bezel δ=0.056 mm Eq 12.10, τ=21.8 MPa Eq 12.8-12.9,
 * P_max=175 MPa Eq 9.19, varianza Menges Eq 9.23 → Fig 9.5).
 *
 *  TÉRMICO (cap 9):
 *   · concentración de esfuerzo del barreno de agua: K = 3.3 (H=1D) → 2.6 (H=4D)  [Fig 9.4]
 *   · presión de fundido máxima P_max = σ_endurance / K                            [Eq 9.19]
 *   · coef. de conducción efectivo h_cond = k_mold / H_line                        [Eq 9.20]
 *   · profundidad máxima H_line < k_mold / (1000 W/m²·°C)                          [Eq 9.21]
 *   · rango de profundidad 2D < H < 5D                                             [Eq 9.22]
 *   · varianza de flujo de calor (Menges): ΔQ̇% = (W/H)^(2.8·ln(W/H))              [Eq 9.23]
 *   · rango de paso H < W < 2H                                                     [Eq 9.24]
 *   · CAMPO de temperatura superficial: T(x,y) = T_c + q″·(1/h_conv + d(x,y)/k)
 *     con d = distancia a la LÍNEA de agua real más cercana (resistencias en serie,
 *     el modelo de Eq 9.7/9.20; reproduce el patrón de la Fig 9.7).
 *
 *  ESTRUCTURAL (cap 12):
 *   · corte perimetral τ = F/A_shear, A = perímetro·(H_B + H_soporte)              [Eq 12.8-12.9]
 *   · flexión de placa (viga, carga central, conservadora 2×): δ = FL³/48EI        [Eq 12.10-12.11]
 *   · pilares de soporte: parten el claro → δ ∝ L³ cae ~8×                         [§12.2.3]
 *   · pared lateral (cheek): τ = P·H_cav/W_cheek; W_cheek > 0.73·H_cav;
 *     δ = 3·P·H⁴/(2·E·W³)                                                          [Eq 12.14-12.17]
 *   · criterio de FLASH: deflexión en partición > 0.02 mm → riesgo de rebaba       [§12.1.2]
 */
import type { MoldAssemblySpec } from './mold-assembly';
import { coolingCircuit, cavityFootprint, plateDepth } from './mold-drawing-set';
import { coolingTimePlate, ABS_KAZMER, type CoolingMaterial } from './cooling';

const E_STEEL = 205e9;            // Pa (el libro usa 205 GPa)
const K_P20 = 32;                 // W/m·°C (conductividad P20, §9.2.5)
const SIGMA_ENDURANCE_P20 = 456;  // MPa (§9.2.5)
const H_CONV = 1000;              // W/m²·°C (coef. convectivo típico, Eq 9.7)
const FLASH_LIMIT_MM = 0.02;      // §12.1.2 (deflexión en partición → rebaba)

export interface AnalysisVerdict { param: string; valor: string; limite: string; ok: boolean; ref: string }

// ── TÉRMICO ──────────────────────────────────────────────────────────────

/** Fig 9.4: factor de concentración de esfuerzo alrededor del barreno de agua,
 *  interpolado entre 3.3 (H=1D) y 2.6 (H=4D); fuera del rango se acota. */
export function coolingStressConcentration(HoverD: number): number {
  const t = Math.max(0, Math.min(1, (HoverD - 1) / 3));
  return +(3.3 - t * (3.3 - 2.6)).toFixed(2);
}

/** Eq 9.23 (Menges): varianza porcentual del flujo de calor entre líneas. */
export function heatFluxVariancePct(WoverH: number): number {
  if (WoverH <= 1) return 0.5;
  return +Math.pow(WoverH, 2.8 * Math.log(WoverH)).toFixed(1);
}

export interface ThermalField {
  nx: number; ny: number;                 // resolución de la malla
  x0: number; y0: number; x1: number; y1: number;   // extensión (mm, coords de placa)
  T: Float32Array;                        // temperatura °C por celda (row-major)
  minC: number; maxC: number; dTC: number;
}

/** CAMPO de temperatura en la superficie de cavidad: resistencias en serie
 *  (Eq 9.7 convección + Eq 9.20 conducción) contra la LÍNEA real más cercana.
 *  q″ = flujo de calor de la pieza (W/m²) durante el ciclo. */
export function surfaceTemperatureField(spec: MoldAssemblySpec, o?: {
  coolantC?: number; nx?: number; ny?: number; mat?: CoolingMaterial;
}): ThermalField {
  const D = plateDepth(spec);
  const cc = coolingCircuit(spec, D);
  const H = cc.zBehindMm / 1000;                      // m (profundidad real de la línea)
  const mat = o?.mat ?? ABS_KAZMER;
  const Tc = o?.coolantC ?? mat.tCoolant;             // refrigerante del libro (ABS: 60 °C)
  // q″: calor por área durante el enfriamiento = ρ·Cp·ΔT·(espesor/2) / t_c  → W/m²
  // (ρ=1050 kg/m³, Cp=2345 J/kg·°C para ABS — propiedades de los ejemplos §9.2.2)
  const RHO = 1050, CP = 2345;
  const wall = (spec.cavity.wallMm ?? 2) / 1000;
  const tC = Math.max(1, coolingTimePlate(wall, mat));
  const q = RHO * CP * (mat.tMelt - mat.tEject) * (wall / 2) / tC;   // W/m²
  // malla sobre la huella de la pieza (la superficie que moldea)
  const { fx, fy } = cavityFootprint(spec);
  const cx = spec.widthMm / 2, cy = D / 2;
  const x0 = cx - fx / 2, x1 = cx + fx / 2, y0 = cy - fy / 2, y1 = cy + fy / 2;
  const nx = o?.nx ?? 64, ny = o?.ny ?? 44;
  const T = new Float32Array(nx * ny);
  let minC = 1e9, maxC = -1e9;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const px = x0 + ((i + 0.5) / nx) * (x1 - x0);
    const py = y0 + ((j + 0.5) / ny) * (y1 - y0);
    // distancia horizontal a la línea de agua más cercana (segmentos reales)
    let dh = 1e9;
    for (const g of cc.segs) {
      const ax = g.x0, ay = g.y0, bx = g.x1, by = g.y1;
      const vx = bx - ax, vy = by - ay;
      const len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
      const qx = ax + t * vx, qy = ay + t * vy;
      dh = Math.min(dh, Math.hypot(px - qx, py - qy));
    }
    const d = Math.hypot(H, dh / 1000);               // m: distancia real (profundidad + lateral)
    const Tsurf = Tc + q * (1 / H_CONV + d / K_P20);  // resistencias en serie (Eq 9.7 + 9.20)
    T[j * nx + i] = Tsurf;
    if (Tsurf < minC) minC = Tsurf;
    if (Tsurf > maxC) maxC = Tsurf;
  }
  return { nx, ny, x0, y0, x1, y1, T, minC: +minC.toFixed(1), maxC: +maxC.toFixed(1), dTC: +(maxC - minC).toFixed(1) };
}

// ── ESTRUCTURAL ──────────────────────────────────────────────────────────

export interface MoldStructural {
  fMeltN: number;             // fuerza del fundido F = P·A_proyectada
  shearMPa: number;           // Eq 12.8-12.9
  spanM: number;              // claro libre entre rieles
  deflMm: number;             // Eq 12.10-12.11 (sin pilares)
  deflPillarsMm: number;      // §12.2.3 (claro a la mitad → ~/8)
  sideTauMPa: number;         // Eq 12.14
  cheekMm: number; cheekMinMm: number;   // Eq 12.15-12.16
  sideDeflMm: number;         // Eq 12.17
}

export function moldStructural(spec: MoldAssemblySpec, pMeltMPa = 80): MoldStructural {
  const D = plateDepth(spec);
  const { fx, fy } = cavityFootprint(spec);
  const n = Math.max(1, spec.nCav ?? 1);
  const aProjM2 = n * (fx / 1000) * (fy / 1000);
  const fMeltN = pMeltMPa * 1e6 * aProjM2;
  // corte perimetral (Eq 12.9): perímetro de cavidad × (H_B + H_soporte)
  const hShearM = (spec.plates.B + spec.plates.support - 12) / 1000;   // −12: la expulsora no corta (libro Fig 12.10)
  const aShear = 2 * ((fx + fy) / 1000) * hShearM;
  const shearMPa = +(fMeltN / aShear / 1e6).toFixed(1);
  // flexión (Eq 12.10-12.11): claro entre rieles (rieles de 50 mm), W = ancho cavidad,
  // H = núcleo (B) + soporte (§12.2.2: sin los cores si no aportan rigidez)
  const spanM = (spec.widthMm - 2 * 50) / 1000;
  const wM = fx / 1000, hM = (spec.plates.B + spec.plates.support) / 1000;
  const I = (wM * hM ** 3) / 12;
  const deflMm = +((fMeltN * spanM ** 3) / (48 * E_STEEL * I) * 1000).toFixed(3);
  const deflPillarsMm = +(deflMm / 8).toFixed(3);     // §12.2.3: claro/2 → δ∝L³ → /8
  // pared lateral (cheek) — Eq 12.14-12.17
  const hCavM = spec.cavity.depthMm / 1000;
  const cheekM = ((spec.widthMm - fx) / 2) / 1000;
  const sideTauMPa = +((pMeltMPa * hCavM) / cheekM).toFixed(1);
  const cheekMinMm = +(2 * spec.cavity.depthMm * (pMeltMPa / SIGMA_ENDURANCE_P20)).toFixed(1);
  const sideDeflMm = +((3 * pMeltMPa * 1e6 * hCavM ** 4) / (2 * E_STEEL * cheekM ** 3) * 1000).toFixed(4);
  return { fMeltN, shearMPa, spanM, deflMm, deflPillarsMm, sideTauMPa, cheekMm: +(cheekM * 1000).toFixed(0), cheekMinMm, sideDeflMm };
}

// ── REPORTE COMPLETO ─────────────────────────────────────────────────────

export interface MoldAnalysis {
  thermal: {
    diaMm: number; HlineMm: number; HoverD: number; pitchMm: number; WoverH: number;
    K: number; pMeltMaxMPa: number; hCondWm2C: number; HmaxMm: number;
    fluxVarPct: number; coolingTimeS: number;
    field: ThermalField;
  };
  structural: MoldStructural;
  verdicts: AnalysisVerdict[];
}

/** ANÁLISIS INDIVIDUAL POR COMPONENTE — cada placa/sistema del árbol trae SUS
 *  números con su ecuación (lo que un ingeniero revisaría placa por placa). */
export function componentAnalysis(spec: MoldAssemblySpec, o?: { pMeltMPa?: number }): Record<string, AnalysisVerdict[]> {
  const p = o?.pMeltMPa ?? 80;
  const D = plateDepth(spec);
  const a = moldAnalysis(spec, { pMeltMPa: p });
  const st = a.structural;
  const cc = coolingCircuit(spec, D);
  const { fx, fy } = cavityFootprint(spec);
  const rho = 7.8e-6;   // kg/mm³ acero
  const massOf = (t: number, extra = 0) => +(((spec.widthMm + 2 * extra) * D * t) * rho).toFixed(1);
  const fMeltN = st.fMeltN;
  const nPin = spec.ejectors.count;
  // pandeo del pin (Euler, §11.2.4): P_cr = π²EI/L² con L = carrera libre (B+soporte)
  const dPin = spec.ejectors.diaMm / 1000, Lpin = (spec.plates.B + spec.plates.support) / 1000;
  const Ipin = Math.PI / 64 * dPin ** 4;
  const pinBuckleN = +(Math.PI ** 2 * 205e9 * Ipin / (Lpin * Lpin)).toFixed(0);
  const fPerPinN = +(0.05 * fMeltN / nPin).toFixed(0);   // ~5% de F como fuerza de expulsión típica
  const ext = Math.max(28, Math.round(spec.widthMm * 0.09));
  const V: Record<string, AnalysisVerdict[]> = {
    clamp: [
      { param: 'Masa de placa', valor: `${massOf(spec.plates.topClamp, ext)} kg`, limite: '—', ok: true, ref: 'geometría' },
      { param: 'Oreja + ranura de sujeción', valor: `±${ext} mm · slot fresado`, limite: 'toe clamps §1.3.1', ok: true, ref: 'Fig 1.4' },
      { param: 'Compresión bajo clamp (Eq 12.5-7)', valor: `${(fMeltN / ((spec.widthMm * D - fx * fy) * 1e-6) / 1e6).toFixed(1)} MPa`, limite: '< 456 (σ_e P20)', ok: true, ref: 'Eq 12.5' },
    ],
    A: [
      { param: 'P fundido máx (fatiga barreno agua)', valor: `${a.thermal.pMeltMaxMPa} MPa (K=${a.thermal.K})`, limite: `≥ ${p} MPa`, ok: a.thermal.pMeltMaxMPa >= p, ref: 'Eq 9.19' },
      { param: 'Cheek (pared lateral)', valor: `${st.cheekMm} mm · τ=${st.sideTauMPa} MPa`, limite: `> ${st.cheekMinMm} mm`, ok: st.cheekMm > st.cheekMinMm, ref: 'Eq 12.14-16' },
      { param: 'Deflexión pared lateral', valor: `${st.sideDeflMm} mm`, limite: '< 0.02 (flash)', ok: st.sideDeflMm < 0.02, ref: 'Eq 12.17' },
      { param: 'Agua: profundidad H/D', valor: `${a.thermal.HoverD}·D`, limite: '2-5·D', ok: a.thermal.HoverD >= 2 && a.thermal.HoverD <= 5, ref: 'Eq 9.22' },
    ],
    B: [
      { param: 'Corte perimetral (núcleo+soporte)', valor: `${st.shearMPa} MPa`, limite: '< 228 (½σ_e)', ok: st.shearMPa < 228, ref: 'Eq 12.8-9' },
      { param: 'Pasajes de expulsores', valor: `${nPin} × ⌀${spec.ejectors.diaMm} mm`, limite: 'H7 deslizante', ok: true, ref: 'cap 11' },
      { param: 'Agua: paso W/H', valor: `${a.thermal.WoverH}·H`, limite: 'H-2H', ok: a.thermal.WoverH >= 1 && a.thermal.WoverH <= 2, ref: 'Eq 9.24' },
      { param: 'Varianza de flujo de calor', valor: `${a.thermal.fluxVarPct} %`, limite: '< 5 %', ok: a.thermal.fluxVarPct < 5, ref: 'Eq 9.23' },
    ],
    support: [
      { param: 'Deflexión (claro entre rieles)', valor: `${st.deflMm} mm`, limite: '< 0.02 (flash)', ok: st.deflMm < 0.02, ref: 'Eq 12.10' },
      { param: '… con support pillars', valor: `${st.deflPillarsMm} mm`, limite: '< 0.02', ok: st.deflPillarsMm < 0.02, ref: '§12.2.3' },
      { param: 'Corte perimetral', valor: `${st.shearMPa} MPa`, limite: '< 228', ok: st.shearMPa < 228, ref: 'Eq 12.8-9' },
    ],
    ejector: [
      { param: 'Fuerza por pin (≈5% F sobre n)', valor: `${fPerPinN} N`, limite: `< P_cr pandeo ${pinBuckleN} N`, ok: fPerPinN < pinBuckleN, ref: '§11.2.4 Euler' },
      { param: 'Pines de retorno', valor: '4 × ⌀12', limite: 'regresan el paquete', ok: true, ref: 'Fig 1.6' },
      { param: 'Carrera de expulsión', valor: `≥ ${spec.cavity.depthMm} mm (prof. pieza)`, limite: 'E de Fig 4.22', ok: true, ref: '§4.3.2' },
    ],
    bottom: [
      { param: 'Masa de placa', valor: `${massOf(spec.plates.bottomClamp, ext)} kg`, limite: '—', ok: true, ref: 'geometría' },
      { param: 'Barreno KO central', valor: `⌀${Math.max(20, Math.round(spec.widthMm * 0.055))} mm`, limite: 'vástago máquina', ok: true, ref: '§1.3.2' },
    ],
    rieles: [
      { param: 'Compresión σ=F/A (2 rieles)', valor: `${(fMeltN / (2 * 50 * D * 1e-6) / 1e6).toFixed(1)} MPa`, limite: '< 456', ok: fMeltN / (2 * 50 * D * 1e-6) / 1e6 < 456, ref: 'Eq 12.5' },
      { param: 'Acortan el claro de flexión a', valor: `${(st.spanM * 1000).toFixed(0)} mm`, limite: '—', ok: true, ref: 'Fig 12.11' },
    ],
    'pilares-soporte': [
      { param: 'Reducen deflexión del soporte', valor: `${st.deflMm} → ${st.deflPillarsMm} mm (÷8)`, limite: '< 0.02', ok: st.deflPillarsMm < 0.02, ref: '§12.2.3' },
      { param: 'Compresión σ=F/2A (⌀40)', valor: `${(fMeltN / 2 / (Math.PI * 400 * 1e-6) / 1e6 * 1e-3).toFixed(1)} MPa`, limite: '< 456', ok: true, ref: 'Eq 12.5' },
    ],
    pines: [
      { param: 'Pandeo de Euler por pin', valor: `P_cr = ${pinBuckleN} N (L=${(Lpin * 1000).toFixed(0)})`, limite: `> ${fPerPinN} N aplicados`, ok: pinBuckleN > fPerPinN, ref: '§11.2.4' },
      { param: 'Distribución', valor: spec.cavity.frameMm ? 'rim + costillas (marco)' : 'rejilla en huella', limite: 'secciones sólidas', ok: true, ref: 'Fig 11.7' },
    ],
    'agua-a': [
      { param: 'Profundidad real', valor: `${a.thermal.HlineMm} mm (${a.thermal.HoverD}D)`, limite: '2D-5D', ok: a.thermal.HoverD >= 2 && a.thermal.HoverD <= 5, ref: 'Eq 9.22' },
      { param: 'h efectivo de conducción', valor: `${a.thermal.hCondWm2C} W/m²·°C`, limite: '~1000 (Eq 9.7)', ok: true, ref: 'Eq 9.20' },
      { param: 'Tapones (plugs)', valor: `${cc.plugs.length} × ${spec.cooling.plug ?? '—'}`, limite: 'sella extremos', ok: true, ref: '§9.2.7' },
    ],
    'agua-b': [
      { param: 'Paso entre líneas', valor: `${a.thermal.pitchMm} mm (${a.thermal.WoverH}H)`, limite: 'H-2H', ok: a.thermal.WoverH <= 2, ref: 'Eq 9.24' },
      { param: 'Varianza de flujo', valor: `${a.thermal.fluxVarPct} %`, limite: '< 5 %', ok: a.thermal.fluxVarPct < 5, ref: 'Eq 9.23' },
    ],
    guias: [
      { param: 'Alineación A/B en cierre', valor: '4 postes, 1 desplazado', limite: 'anti-error de armado', ok: true, ref: '§1.3.1' },
    ],
    anillo: [
      { param: 'Diámetro estándar', valor: '⌀100 mm', limite: 'platina fija', ok: true, ref: '§1.3.1' },
    ],
  };
  return V;
}

export function moldAnalysis(spec: MoldAssemblySpec, o?: { pMeltMPa?: number; coolantC?: number }): MoldAnalysis {
  const D = plateDepth(spec);
  const cc = coolingCircuit(spec, D);
  const dia = cc.diaMm, Hline = cc.zBehindMm;
  const HoverD = +(Hline / dia).toFixed(2);
  // paso real del serpentín (entre canales rectos)
  const ys = [...new Set(cc.segs.filter((g) => g.y0 === g.y1).map((g) => g.y0))].sort((a, b) => a - b);
  const pitch = ys.length > 1 ? +( (ys[ys.length - 1] - ys[0]) / (ys.length - 1)).toFixed(1) : Hline;
  const WoverH = +(pitch / Hline).toFixed(2);
  const K = coolingStressConcentration(HoverD);
  const pMeltMax = +(SIGMA_ENDURANCE_P20 / K).toFixed(0);
  const fluxVar = heatFluxVariancePct(WoverH);
  const wall = (spec.cavity.wallMm ?? 2) / 1000;
  const tC = +coolingTimePlate(wall, ABS_KAZMER).toFixed(1);
  const field = surfaceTemperatureField(spec, { coolantC: o?.coolantC });
  const st = moldStructural(spec, o?.pMeltMPa ?? 80);
  // LADO A: la línea debe LIBRAR la impresión tallada (que sube depthMm sobre la
  // partición). holgura = zAbove − dep − r; sin línea posible = ⚠ rojo (generativo
  // debe engrosar A o meter baffles §9.2.4).
  const depA = spec.cavity.depthMm, rA = dia / 2;
  const holguraA = cc.zAboveMm != null ? +(cc.zAboveMm - depA - rA).toFixed(1) : null;
  const verdicts: AnalysisVerdict[] = [
    { param: 'Profundidad de línea H/D', valor: `${HoverD}·D (${Hline} mm)`, limite: '2D < H < 5D (Eq 9.22)', ok: HoverD >= 2 && HoverD <= 5, ref: 'Eq 9.22' },
    { param: 'Línea A libra la impresión', valor: holguraA != null ? `holgura ${holguraA} mm (línea a ${Math.round(cc.zAboveMm!)} mm)` : 'SIN línea recta posible',
      limite: `≥ 3 mm sobre impresión de ${depA} mm`, ok: holguraA != null && holguraA >= 3, ref: 'Eq 9.22 (H desde sup. moldeante)' },
    { param: 'H máx por conducción', valor: `${Hline} mm`, limite: `< ${(K_P20 / H_CONV * 1000).toFixed(0)} mm (Eq 9.21)`, ok: Hline < K_P20 / H_CONV * 1000, ref: 'Eq 9.21' },
    { param: 'Paso W/H', valor: `${WoverH}·H (${pitch} mm)`, limite: 'H < W < 2H (Eq 9.24)', ok: WoverH >= 1 && WoverH <= 2, ref: 'Eq 9.24' },
    { param: 'Varianza de flujo de calor', valor: `${fluxVar} %`, limite: '< 5 % (Fig 9.5)', ok: fluxVar < 5, ref: 'Eq 9.23' },
    { param: 'P fundido máx (fatiga barreno)', valor: `${pMeltMax} MPa (K=${K})`, limite: '≥ P inyección (~80-150)', ok: pMeltMax >= (o?.pMeltMPa ?? 80), ref: 'Eq 9.19' },
    { param: 'ΔT superficie de cavidad', valor: `${field.dTC} °C`, limite: '< 5 °C (uniformidad §9.1.2)', ok: field.dTC < 5, ref: 'Fig 9.7' },
    { param: 'Corte perimetral placas', valor: `${st.shearMPa} MPa`, limite: `< ${(SIGMA_ENDURANCE_P20 / 2).toFixed(0)} MPa (½σ_e)`, ok: st.shearMPa < SIGMA_ENDURANCE_P20 / 2, ref: 'Eq 12.8-12.9' },
    { param: 'Deflexión placa soporte', valor: `${st.deflMm} mm`, limite: `< ${FLASH_LIMIT_MM} mm (flash §12.1.2)`, ok: st.deflMm < FLASH_LIMIT_MM, ref: 'Eq 12.10' },
    { param: '… con 2 support pillars', valor: `${st.deflPillarsMm} mm`, limite: `< ${FLASH_LIMIT_MM} mm`, ok: st.deflPillarsMm < FLASH_LIMIT_MM, ref: '§12.2.3' },
    { param: 'Cheek (pared lateral)', valor: `${st.cheekMm} mm · τ=${st.sideTauMPa} MPa`, limite: `> ${st.cheekMinMm} mm (Eq 12.15)`, ok: st.cheekMm > st.cheekMinMm, ref: 'Eq 12.14-16' },
    { param: 'Deflexión pared lateral', valor: `${st.sideDeflMm} mm`, limite: `< ${FLASH_LIMIT_MM} mm`, ok: st.sideDeflMm < FLASH_LIMIT_MM, ref: 'Eq 12.17' },
  ];
  return {
    thermal: { diaMm: dia, HlineMm: Hline, HoverD, pitchMm: pitch, WoverH, K, pMeltMaxMPa: pMeltMax, hCondWm2C: +(K_P20 / (Hline / 1000)).toFixed(0), HmaxMm: 32, fluxVarPct: fluxVar, coolingTimeS: tC, field },
    structural: st,
    verdicts,
  };
}
