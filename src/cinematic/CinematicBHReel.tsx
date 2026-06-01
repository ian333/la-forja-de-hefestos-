/**
 * CinematicBHReel — el comercial de cine de Gargantua, por BEATS.
 * ============================================================================
 * Evolución de CinematicGargantua: en vez de UN solo plano continuo de 30s,
 * una BIBLIOTECA de beats deterministas de ~15s, cada uno con su propia idea de
 * cámara (corte motivado) + caption + cue de sonido. El comercial es una CADENA
 * curada de beats; los explainers futuros reusan los mismos beats en otro orden.
 *
 *   "EL FOTÓN QUE CAE" — tú ERES un fotón cayendo hacia Gargantua.
 *
 * ── DIRECCIÓN (brief maestro) ───────────────────────────────────────────────
 *  B1 DESCENSO ORBITAL  — órbita pesada, Gargantua ya imponente, cae 130→8·rs.
 *  B2 FOTÓN POV         — match-cut por el anillo: cámara = fotón, espiral a b_crit.
 *  B3 SLOW DOWN         — el tiempo se frena DE VERDAD: slow = √(1-rs/r) reparametriza
 *                          la pose Y la animación del disco. El silencio es el límite.
 *  B4 ABISMO ZOOM-OUT   — dolly-back: el fotón "suelta", Gargantua entero se revela.
 *
 * ── HONESTIDAD FÍSICA (regla dura) ──────────────────────────────────────────
 *  · El motor es BHRaytraced: geodésicas Schwarzschild (raymarch 200 pasos),
 *    T∝r⁻¾ (Shakura-Sunyaev), Doppler δ⁴, photon ring en b_crit=√27/2·rs=2.598·rs,
 *    redshift/dilatación √(1-rs/r). Eso NO se toca: el cine es solo cámara/luz/
 *    lente/color/sonido/edición.
 *  · La TRAYECTORIA del fotón POV (B2) es SCRIPTED (evocativa): la geodésica nula
 *    real vive por-pixel en el fragment y nunca vuelve a JS, así que la cámara no
 *    puede engancharla. El lensing que se VE sí es física real del shader. El
 *    caption de B2 lleva la etiqueta "evocación" (obligatoria).
 *  · El SLOW-DOWN de B3 SÍ es física exacta y NO se etiqueta: slow=√(1-rs/r) es el
 *    MISMO factor de dilatación que el shader usa por-pixel (zFactor), recomputado
 *    EN JS sobre la r de la trayectoria (pura en t) porque el shader no lo expone.
 *    En POV esa r ES el radio del fotón → imagen lenta + tick estirado salen del
 *    MISMO √(1-rs/r). El silencio es el límite matemático cuando r→rs.
 *
 * ── DOCTRINA DE CINE (heredada de Gargantua) ────────────────────────────────
 *  · Canvas calidad cine: dpr alto + antialias; gl.toneMapping = NoToneMapping
 *    (el ÚNICO ACES lo hace CinematicPostFX → BHRaytraced linearOutput=true).
 *  · CinematicPostFX preset 'bh' (Bloom threshold bajo + grade). El grade PESADO
 *    de DaVinci (halación roja-ámbar, 10-bit+dither, grano, gate-weave, LUT) vive
 *    en la SEGUNDA etapa de ffmpeg OFFLINE, NO aquí.
 *  · Cámara con PESO vía WeightedRig (CinematicCamera): cada beat ajusta lag y
 *    amplitudes. SIEMPRE función pura de t.
 *  · ScaleReference a scale 0.05 (mota, NO hero-shot): inmensidad por escala.
 *  · Sujeto en la columna central segura → el recorte vertical 9:16 funciona.
 *
 * ── DETERMINISMO TOTAL (habilita el CACHE de beats) ─────────────────────────
 *  window.__cinematicBHReel.renderAt(t) ∈ [0, duration]. Todo (cámara,
 *  animación del disco, escala, slow-down) es función PURA de t. Cero
 *  aleatoriedad runtime, cero reloj del sistema, cero clock de three, cero rAF de
 *  pared, cero setState en el camino de render. El slow-down vive ENTERO en el
 *  mapeo t→pose (NO toca el avance de t del render), precisamente para no romper
 *  el cache. Mismo t → mismo frame → CACHE HIT.
 *  El audio NO vive aquí: es función pura de t mezclada en la etapa B (ffmpeg).
 *
 * Camino de render 100% SÍNCRONO: renderAt(t) escribe timeRef + dynRef (props
 * dinámicos del BH y t de la sonda) en REFS, NUNCA en estado React. Cada hijo los
 * lee en su propio useFrame EN EL MISMO TICK que la cámara → cero skew de 1 frame.
 * La cámara, BHRaytraced (getDynamic) y ScaleReference (getT) leen del MISMO timeRef.
 * El reloj de fase del disco φ(t) es una integral MONÓTONA de √(1-rs/r) (nunca
 * fluye en reversa). El kind del beat (pesos del rig) se deriva PURO en t dentro
 * del useFrame del rig (sin rAF de pared, sin remontar el rig en el corte).
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import BHRaytraced from '@/labs/components/BHRaytraced';
import { makeRenderer } from '@/lib/webgl-fallback';
import CinematicPostFX from './CinematicPostFX';
import ScaleReference from './ScaleReference';
import {
  spherical, lerp, smooth, smootherstep, easeExp, clamp01,
  type CameraState, type Vec3, type LagState,
  addWeight, cameraAt,
} from './CinematicCamera';

// ============================================================================
// Constantes de mundo
// ============================================================================
const RS = 1.0;                 // radio Schwarzschild en unidades de escena
const B_CRIT = 2.598 * RS;      // √27/2·rs — radio de la sombra / photon ring (shader)

// ============================================================================
// Slow-down físico — dilatación temporal gravitacional √(1 - rs/r).
// ----------------------------------------------------------------------------
// MISMO número que el shader usa por-pixel (zFactor), recomputado EN JS sobre la
// r de la trayectoria. Devuelve un factor en (0,1]: 1 lejos, →0 cuando r→rs.
// Lejos del horizonte el tiempo corre normal; pegado al horizonte se vuelve
// melaza. Clampeo r≥rs·1.001 para no dividir por cero exacto en el horizonte.
// PURA en r → PURA en t (porque r(t) es pura en t).
// ============================================================================
function dilation(r: number): number {
  const rr = Math.max(r, RS * 1.001);
  return Math.sqrt(Math.max(1e-4, 1 - RS / rr));
}

// ============================================================================
// Reloj de fase del disco φ(t) — CONTINUO y MONÓTONO en TODA la cadena.
// ----------------------------------------------------------------------------
// El swirl/turbulencia del disco viven en uTime del shader. Si uTime DECRECE el
// disco fluye en reversa (físicamente imposible). Por eso φ NO se calcula como el
// producto scaleAnchor·slow (que baja cuando slow baja) sino como la INTEGRAL del
// factor slow a lo largo de la trayectoria:  φ(t) = ∫₀ᵗ slow(r(τ)) dτ.
// Como slow=√(1-rs/r) > 0 SIEMPRE, φ es estrictamente creciente → el disco nunca
// retrocede; y cuando r→rs (B3) slow→0, dφ/dt→0 → el disco se CONGELA (no se
// invierte). En B4, al alejarse, slow→1 y el disco vuelve a fluir normal.
//
// La integral se hace por suma de Riemann con paso FIJO determinista (PHI_DT) a lo
// largo de la r(t) de cada beat (beatRadiusById). Pura en t: mismo t → misma φ.
// Cacheamos los aportes por nodo de paso (phiTable) para que no sea O(n) por frame.
// ============================================================================
const PHI_DT = 1 / 60; // paso de integración (s). Fino: el disco no "salta".

// Radio de la trayectoria del fotón por beat (·rs). MISMA fuente que la pose:
// las funciones distB1..distB4 (definidas en la sección de beats) son la única
// definición de la r(t) de cada beat → cero divergencia entre la pose y el slow.
function beatRadiusById(id: string, tLocal: number): number {
  switch (id) {
    case 'B1_DESCENSO_ORBITAL':   return distB1(tLocal);
    case 'B2_FOTON_POV':          return distB2(tLocal);
    case 'B3_SLOWDOWN_DILATACION':return distB3(tLocal);
    case 'B4_ABISMO_ZOOMOUT':     return distB4(tLocal);
    default:                      return distB1(tLocal);
  }
}

// Tabla de φ acumulada (precalc por cadena resuelta). phi[i] = φ en t = i·PHI_DT.
// Determinista: solo depende de los segmentos (no de reloj ni random).
function buildPhiTable(segments: ResolvedSegment[], duration: number): number[] {
  const n = Math.max(1, Math.ceil(duration / PHI_DT));
  const table = new Array<number>(n + 1);
  table[0] = 0;
  let phi = 0;
  for (let i = 1; i <= n; i++) {
    const tGlobal = i * PHI_DT;
    const { seg, tLocal } = locate(segments, duration, tGlobal);
    const r = beatRadiusById(seg.beat.id, tLocal);
    // dφ = slow·dt; slow∈(0,1] → φ monótona creciente.
    phi += dilation(r) * PHI_DT;
    table[i] = phi;
  }
  return table;
}

// φ(tGlobal) leída de la tabla con interpolación lineal (continua, monótona).
function phiAt(table: number[], tGlobal: number, duration: number): number {
  const t = Math.max(0, Math.min(duration, tGlobal));
  const x = t / PHI_DT;
  const i = Math.min(table.length - 1, Math.floor(x));
  const j = Math.min(table.length - 1, i + 1);
  const f = x - i;
  return lerp(table[i], table[j], f);
}

// ============================================================================
// Props del BH que pueden variar por beat. Lo que NO se lista usa el default
// del beat base (joya fría, disco lleno, photon ring on, linearOutput, etc).
// chromaticAberration es prop del SHADER (per-pixel, honesto): solo sube en los
// bordes muy lensados del cruce POV.
// ============================================================================
export interface BHBeatProps {
  exposure: number;             // multiplica el HDR lineal ANTES del único ACES (físico)
  chromaticAberration: number;  // separación R/G/B en bordes lensados (0 = limpio)
  rIn: number;                  // borde interno del disco (·rs)
  rOut: number;                 // borde externo del disco (·rs)
  /**
   * Tiempo de animación del disco = φ(t), el reloj de fase del disco CONTINUO y
   * MONÓTONO (integral de √(1-rs/r); ver buildPhiTable). NUNCA decrece → el swirl
   * jamás fluye en reversa; donde r→rs (B3) dφ/dt→0 → el disco se congela en
   * melaza. Función pura de t.
   */
  diskTime: number;
}

// Lo que produce el programa de un beat en cada instante LOCAL del beat.
export interface BeatFrame {
  cam: CameraState;             // pos/target/fov para el WeightedRig
  bh: BHBeatProps;              // props del BH para este instante
  scaleT: number;               // t que alimenta a ScaleReference (continuo entre beats)
}

export type BeatKind = 'orbital' | 'pov' | 'zoomout';

export interface Beat {
  id: string;
  durationS: number;
  kind: BeatKind;
  caption: string;
  /**
   * Programa del beat: tLocal ∈ [0, durationS] → BeatFrame. PURO en tLocal.
   * scaleAnchor es el t base para ScaleReference (la deriva de la sonda es
   * continua a lo largo de TODA la cadena para que el match-cut no salte).
   * diskPhase = φ(t) GLOBAL del reloj de fase del disco (CONTINUO y MONÓTONO):
   * el program lo pasa tal cual a diskTime → el disco nunca fluye en reversa.
   */
  program: (tLocal: number, scaleAnchor: number, diskPhase: number) => BeatFrame;
}

// Pesos del WeightedRig por tipo de cámara (peso de grúa vs partícula nerviosa).
const RIG_BY_KIND: Record<BeatKind, { lag: number; posAmp: number; targetAmp: number }> = {
  // órbita pesada = grúa con inercia
  orbital: { lag: 0.55, posAmp: 0.65, targetAmp: 0.40 },
  // POV = partícula nerviosa: poco arrastre, amplitud pequeña
  pov:     { lag: 0.30, posAmp: 0.25, targetAmp: 0.18 },
  // dolly-back = peso del cosmos: mucho arrastre, amplitud mínima
  zoomout: { lag: 0.60, posAmp: 0.30, targetAmp: 0.20 },
};

// Props base del disco que comparten todos los beats (joya fría de Gargantua).
const BASE_DISK = { rIn: 2.5, rOut: 14.0 };

const BEAT_D = 15; // duración nominal de cada beat (s).
// Duraciones POR BEAT del comercial (override del nominal). La caída se siente
// corta → la alargamos; el abismo/silencio también pide más aire.
const B1_DUR = 20; // caída más larga y salvaje
const B4_DUR = 15; // beat completo del abismo (la cadena toma una cola más larga)

// ============================================================================
// CONTINUIDAD DE MATCH-CUT — ventanas de slice + estados de entrega (handoff).
// ----------------------------------------------------------------------------
// La DEFAULT_CHAIN recorta los beats EN MEDIO (no en p=0/p=1), así que la
// continuidad geométrica del anillo se logra empatando los EXTREMOS DE SLICE que
// la cadena usa de verdad. Cada beat interpola sobre una "progresión de slice"
// s∈[0,1] normalizada a SU ventana por defecto: en s=0 arranca en el estado donde
// terminó el slice anterior; en s=1 entrega el estado al siguiente. Fuera de la
// ventana (reuso en otros órdenes) extrapola suave por clamp.
//   B1: slice [0,15]   → entrega HANDOFF_B1
//   B2: slice [0,7]    → arranca en HANDOFF_B1, entrega HANDOFF_B2
//   B3: slice [4,12]   → arranca en HANDOFF_B2, entrega HANDOFF_B3
//   B4: slice [11,15]  → arranca en HANDOFF_B3 (corte DURO al silencio)
// Estados {dist (·rs), azim (rad), elev (°), fov (°)}.
const SLICE = {
  B1: { in: 0, out: 15 },
  B2: { in: 0, out: 7 },
  B3: { in: 4, out: 12 },
  B4: { in: 11, out: 15 },
} as const;

// Estado al final de cada slice (= arranque del siguiente). Continuo en geometría.
// fov AMPLIO en el POV (B1.out→B2→B3): mirando al hueco de cerca, un fov estrecho
// mete toda la sombra en el cuadro = negro. fov ≥ 44° mantiene el disco/anillo en
// el borde. dist en la zona luminosa (>~7·rs) por la misma ley geométrica.
const HANDOFF_B1 = { dist: 10.0, azim: 0.60, elev: 26, fov: 44 }; // B1 out → B2 in
const HANDOFF_B2 = { dist: 10.0, azim: 1.55, elev: 18, fov: 44 }; // B2 out → B3 in
// dist 9.0·rs: el fotón frena en la ZONA LUMINOSA. LEY GEOMÉTRICA (verificada
// numéricamente): mirando al hueco, si el medio-ángulo de la sombra asin(b_crit/r)
// ≥ fov/2, la sombra LLENA el cuadro = NEGRO. A r=3·rs la sombra es ~58° vs fov/2
// ~23° → negro total. Para que el disco/anillo sea visible: r > b_crit/sin(fov/2);
// con fov~46° eso es r>~6.6·rs. 9·rs deja margen para el agrandamiento por lente.
// El drama del slow-down NO viene de acercarse al horizonte (eso es solo negro):
// viene de la cámara congelándose + el disco congelándose (φ) + el tick frenando.
const HANDOFF_B3 = { dist: 9.0, azim: 2.65, elev: 16, fov: 40 };  // B3 out → B4 in

// progreso de slice s∈[0,1]: 0 en SLICE.in, 1 en SLICE.out (clamp fuera).
function sliceProgress(tLocal: number, win: { in: number; out: number }): number {
  return clamp01((tLocal - win.in) / Math.max(1e-4, win.out - win.in));
}

// ============================================================================
// r(t) por beat — ÚNICA fuente de la trayectoria. La usan la pose Y el reloj de
// fase del disco (beatRadiusById) → la dilatación slow y el swirl jamás divergen.
// ============================================================================
function distB1(tLocal: number): number {
  const p = clamp01(tLocal / B1_DUR);
  // 150·rs → 6·rs. Caída MÁS SALVAJE: easeExp k=+1.6 (acelera al caer, vértigo)
  // en vez del freno suave. La masa no frena la caída — la ACELERA.
  const dEase = easeExp(p, 1.6);
  // termina en 7.5·rs (no 6): a 6·rs con fov 52° la sombra empieza a llenar el
  // cuadro (sh~26° vs fov/2 26°). 7.5·rs deja el disco lensado dominando, salvaje
  // pero luminoso, justo cuando el anillo revienta → corte al silencio.
  return 150 * Math.pow(7.5 / 150, dEase) * RS;
}
function distB2(tLocal: number): number {
  const s = sliceProgress(tLocal, SLICE.B2);
  // Arranca en HANDOFF_B1.dist (continuo con B1) y cae acelerando a HANDOFF_B2.
  return lerp(HANDOFF_B1.dist, HANDOFF_B2.dist, easeExp(s, 2.0)) * RS;
}
function distB3(tLocal: number): number {
  const s = sliceProgress(tLocal, SLICE.B3);
  // Arranca en HANDOFF_B2.dist (continuo con B2) y baja LENTO a HANDOFF_B3 (freno
  // gravitacional cerca del horizonte: easeExp k<0 desacelera al final).
  return lerp(HANDOFF_B2.dist, HANDOFF_B3.dist, easeExp(smootherstep(s), -2.6)) * RS;
}
function distB4(tLocal: number): number {
  // CORTE DURO, no dolly: el regreso al plano inicial es un CORTE de golpe (no una
  // cámara que retrocede sola — eso "no es física", es movimiento sin motivo). B4
  // es un plano FIJO del agujero lejano (130·rs, = frame 1 de B1) en silencio. El
  // salto lo hace el corte B1→B4. Distancia constante = cámara quieta = nítido.
  return 130 * RS;
}

// Radio de B3 en función del progreso de slice s∈[0,1] (sin reconstruir tLocal).
function distB3FromS(s: number): number {
  return lerp(HANDOFF_B2.dist, HANDOFF_B3.dist, easeExp(smootherstep(clamp01(s)), -2.6)) * RS;
}

// Tabla de "tiempo propio dilatado" de B3: cumulativo NORMALIZADO de slow(r(s)).
// phys(s) = ∫₀ˢ slow ds' / ∫₀¹ slow ds'. Monótono (slow>0), ∈[0,1], CONTINUO por
// interp lineal entre nodos. Precalc determinista UNA vez (módulo).
const B3_PHYS_N = 48;
const B3_PHYS_TABLE: number[] = (() => {
  const t = new Array<number>(B3_PHYS_N + 1);
  t[0] = 0;
  let acc = 0;
  for (let k = 1; k <= B3_PHYS_N; k++) {
    acc += dilation(distB3FromS((k - 0.5) / B3_PHYS_N)); // punto medio
    t[k] = acc;
  }
  const tot = t[B3_PHYS_N] || 1;
  for (let k = 0; k <= B3_PHYS_N; k++) t[k] /= tot;
  return t;
})();
function b3Phys(s: number): number {
  const x = clamp01(s) * B3_PHYS_N;
  const i = Math.min(B3_PHYS_N, Math.floor(x));
  const j = Math.min(B3_PHYS_N, i + 1);
  return lerp(B3_PHYS_TABLE[i], B3_PHYS_TABLE[j], x - i);
}

// ============================================================================
// BIBLIOTECA DE BEATS — cada uno determinista, cacheable, una idea de cámara.
// ============================================================================

/* ── B1 DESCENSO ORBITAL ──────────────────────────────────────────────────
 * Órbita pesada (motor de A reescalado). Gargantua entra ya imponente y crece
 * hasta NO CABER. exposure sube en el último tercio (físico, monotónico): el
 * anillo revienta = el frame sobreexpuesto ES el match-cut.
 *   dist : 130·rs → 8·rs (= HANDOFF_B1) vía easeExp (freno final = masa).
 *   elev : 54° → 26° (disco abierto → edge-on, la "ceja").
 *   azim : -0.55 → 0.60 (órbita lenta = parallax estelar).
 *   fov  : 44° → 33° (push sutil).
 *   target: exit corre el sujeto fuera del centro solo el último 28% (sobrevive
 *           el crop 9:16 el 72% del plano).
 */
function programB1(tLocal: number, scaleAnchor: number, diskPhase: number): BeatFrame {
  const p = clamp01(tLocal / B1_DUR);

  const dist = distB1(tLocal);
  // Elevación que CAE a casi de canto (54°→10°): la "ceja" se dobla, ves la
  // DEFORMACIÓN del espaciotiempo (lo que pediste), no un disco plano de frente.
  const elev = lerp(54, 10, smooth(p));
  // Órbita más amplia (parallax salvaje al caer): -0.7 → +1.1 rad.
  const azim = lerp(-0.70, 1.10, smooth(p));
  // fov se ABRE al caer (45→52): el disco crece hasta desbordar = vértigo.
  const fov = lerp(45, 52, smooth(p));

  const pos = spherical(azim, (elev * Math.PI) / 180, dist);

  // El sujeto sale del centro solo al cierre (no cabe = enorme), centrado el 72%.
  const exit = smootherstep((p - 0.72) / 0.28);
  const target: Vec3 = [exit * dist * 0.16, exit * dist * -0.10, 0];

  // exposure 1.4→1.7 SOLO en el último tercio (físico: multiplica el HDR lineal).
  const expo = lerp(1.4, 1.7, smootherstep((p - 0.66) / 0.34));

  return {
    cam: { pos, target, fov },
    bh: { exposure: expo, chromaticAberration: 0.0, ...BASE_DISK, diskTime: diskPhase },
    scaleT: scaleAnchor,
  };
}

/* ── B2 FOTÓN POV ─────────────────────────────────────────────────────────
 * MATCH-CUT a través del anillo: la cámara ES un fotón en POV. Espiral
 * cerrándose desde HANDOFF_B1 (8·rs, continuo con B1) hacia el campo fuerte.
 * chromaticAberration del SHADER sube con la CERCANÍA a b_crit (cantidad
 * observable: proximidad normalizada de dist al borde de la sombra), no con un
 * cruce inventado de la photon sphere.
 * fov MODERADO (NO ojo-de-pez, marea en vertical-mano).
 *
 * NOTA: TRAYECTORIA SCRIPTED = EVOCATIVA. El shader integra la geodésica nula
 * por-pixel y jamás la devuelve a JS; por eso el caption lleva "evocación".
 */
function programB2(tLocal: number, scaleAnchor: number, diskPhase: number): BeatFrame {
  const s = sliceProgress(tLocal, SLICE.B2);

  const dist = distB2(tLocal);
  const azim = lerp(HANDOFF_B1.azim, HANDOFF_B2.azim, s);  // gira mientras cae
  const elev = lerp(HANDOFF_B1.elev, HANDOFF_B2.elev, smooth(s));
  const fov = lerp(HANDOFF_B1.fov, HANDOFF_B2.fov, smooth(s));

  const pos = spherical(azim, (elev * Math.PI) / 180, dist);
  // ENCUADRE ICÓNICO (el que SÍ funciona a toda distancia, como B1/B4): miramos al
  // AGUJERO. El disco lensado WRAPPEA alrededor de la sombra y llena el cuadro; la
  // sombra es el corazón negro dramático, NO toda la pantalla. (Probado: apuntar a
  // un punto del disco "por delante" salía negro o lavado; mirar al origen con el
  // disco abrazando el hueco es la toma Interstellar y se ve a 8·rs y a 3·rs.) La
  // sensación POV la dan la espiral del azimut + el peso de cámara, no el target.
  const target: Vec3 = [0, 0, 0];

  // chromaticAberration atada a la CERCANÍA a b_crit (cantidad OBSERVABLE), pero
  // con TOPE BAJO: a >0.2 el shader separa R/G/B sobre el starfield ruidoso y sale
  // CONFETI verde/rojo (visto en el primer Gargantua). 0.18 da el sangrado de lente
  // en los bordes muy lensados SIN romper el campo de estrellas.
  const nearCrit = clamp01((HANDOFF_B1.dist * RS - dist) / (HANDOFF_B1.dist * RS - B_CRIT));
  const ca = 0.18 * nearCrit;

  // exposure como B1 (1.5): el disco wrappeado a distancia media NO satura como a
  // quemarropa; 1.5 da el disco incandescente sin lavar.
  const expo = lerp(1.5, 1.6, smooth(s));

  return {
    cam: { pos, target, fov },
    bh: { exposure: expo, chromaticAberration: ca, ...BASE_DISK, diskTime: diskPhase },
    scaleT: scaleAnchor,
  };
}

/* ── B3 SLOW DOWN (dilatación) ────────────────────────────────────────────
 * Continúa al B2 sin corte (mismo POV, continuo en geometría desde HANDOFF_B2).
 * El fotón sigue cayendo pero el TIEMPO se frena DE VERDAD. El slow NO toca el
 * avance de t del render: vive en el mapeo t→pose. r(t)=distB3 frena cerca del
 * horizonte; el factor slow=√(1-rs/r(t)) reparametriza:
 *   · el reparto de t DENTRO del beat (la pose avanza en "tiempo propio
 *     dilatado", phys ∝ ∫slow → todo se vuelve melaza al acercarse a rs),
 *   · la animación del disco va por diskPhase = φ(t) GLOBAL (∫slow): el disco se
 *     CONGELA al acercarse al horizonte y NUNCA fluye en reversa.
 *   · el fov se cierra en el frenazo.
 * Mismo √(1-rs/r) que el shader usa por-pixel y que respeta el photon ring.
 * El tick de audio (etapa B ffmpeg) usa el MISMO factor: dilatación AUDIBLE.
 * SIN etiqueta: es física exacta. El silencio es el límite cuando r→rs.
 *
 * CLÍMAX LUMINOSO: NO miramos al origen desde DENTRO de la sombra (b_crit) — eso
 * sobre-llenaba el cuadro de negro. El target sube al borde de la sombra (el
 * photon ring, ~b_crit en el plano del disco) y el fov ABRE en el clímax para
 * que entre el disco/anillo INCANDESCENTE. El clímax llena de LUZ, no de negro.
 */
function programB3(tLocal: number, scaleAnchor: number, diskPhase: number): BeatFrame {
  const s = sliceProgress(tLocal, SLICE.B3);

  // r(t) de la trayectoria POV: HANDOFF_B2.dist → ~1.05·rs (misma fuente que el
  // slow y el reloj de fase φ). Es el RADIO de la cámara en POV.
  const r = distB3(tLocal);

  // "Tiempo propio dilatado": el giro de la pose avanza como la INTEGRAL del slow
  // sobre el slice, phys(s) = ∫₀ˢ slow(r) ds' / ∫₀¹ slow(r) ds'. Como slow>0 SIEMPRE,
  // phys es MONÓTONO creciente (la espiral nunca retrocede) pero con tasa que CAE
  // al acercarse a rs (slow→0) = melaza, coherente con el disco congelado por φ.
  // Mismo √(1-rs/r) del shader (zFactor). Suma de Riemann fija + interp lineal
  // entre nodos → CONTINUO en s (sin escalones de azimut). PURO en t.
  const phys = b3Phys(s);

  // Espiral POV continuando la de B2, ahora en melaza (arranca en HANDOFF_B2).
  const azim = lerp(HANDOFF_B2.azim, HANDOFF_B3.azim, phys);
  const elev = lerp(HANDOFF_B2.elev, HANDOFF_B3.elev, smooth(s));
  // fov: se cierra al entrar al frenazo y vuelve a ABRIR en el clímax (que entre
  // el disco incandescente, no solo negro). Mínimo a media-fase, abre al final.
  // fov ABIERTO sostenido (NO cerrar a 28°: cerca del horizonte un fov estrecho
  // mirando al centro = puro negro). Mantenerlo amplio deja entrar el disco/anillo.
  const fov = lerp(HANDOFF_B2.fov, 48, smooth(s));

  const pos = spherical(azim, (elev * Math.PI) / 180, r);

  // Target al disco/anillo INCANDESCENTE bien por delante (radio amplio): el aro
  // lensado y la "ceja" dominan el frame en el clímax. NO al borde de la sombra
  // ENCUADRE ICÓNICO: miramos al AGUJERO (origen). A 3·rs el disco lensado y la
  // "ceja" wrappean la sombra y llenan el cuadro — el clímax es LUMINOSO. (Probado:
  // apuntar a un punto del disco salía negro en s≈0.4-0.95.) El slow-down se SIENTE
  // por la espiral casi congelada + el disco congelado (φ) + el tick de audio.
  const target: Vec3 = [0, 0, 0];

  // chromaticAberration: continua con B2 (~0.18) y sube SOLO un poco; TOPE 0.26 para
  // no disparar el confeti del starfield. El sangrado de lente vive en el borde
  // lensado del aro, no en cada estrella.
  const ca = lerp(0.18, 0.26, smooth(s));

  // exposure como B1 (el disco wrappeado a 3·rs no satura): 1.5→1.7 para el destello
  // del frenazo. El clímax llena de LUZ, no de velo blanco ni de negro.
  const expo = lerp(1.5, 1.7, smootherstep((s - 0.4) / 0.4));

  return {
    cam: { pos, target, fov },
    // diskTime = φ(t) GLOBAL: monótono y, vía ∫slow, casi congelado aquí. (slow se
    // usa arriba para la pose; el disco lo respeta a través de φ.)
    bh: { exposure: expo, chromaticAberration: ca, ...BASE_DISK, diskTime: diskPhase },
    scaleT: scaleAnchor,
  };
}

/* ── B4 ABISMO ZOOM-OUT ───────────────────────────────────────────────────
 * CORTE DURO en el pico (match-cut por el lensing): MISMA dist que el final de B3
 * (HANDOFF_B3, 1.05·rs) pero el target y la luz cortan duro. El fotón "suelta" la
 * escena y la cámara RETROCEDE pesada (dolly-back): Gargantua entero se revela —
 * disco completo lensado, la "ceja" arriba y abajo, la sombra de radio b_crit, la
 * sonda encogiéndose en el void que CRECE cada frame. El agujero queda
 * pequeño-pero-total en el tercio superior central: inmensidad por CONTRASTE.
 *   dist : 1.05·rs → 120·rs vía easeExp(k<0) (sale rápido, FRENA al final).
 *   elev : 22° → 48° (abre el disco completo y la "ceja").
 *   fov  : 30° → 44° (acentúa el vacío).
 * La cadena toma SOLO la COLA (slice [11,15]): los ~4s donde dist≈116→120·rs y la
 * cámara se asienta = el "Gargantua pequeño-pero-total" + silencio del brief.
 * El zoom-out es elección de cámara (dolly de revelación), no afirma trayectoria
 * de partícula → no requiere etiqueta. El silencio del vacío es física honesta.
 */
function programB4(tLocal: number, scaleAnchor: number, diskPhase: number): BeatFrame {
  const p = clamp01(tLocal / B4_DUR);

  // PLANO FIJO = el frame 1 de B1 (130·rs, elev 54°, fov 45°, azim -0.55): tras la
  // caída, CORTE de golpe de vuelta a la toma amplia inicial, en silencio. La
  // cámara NO se mueve (apenas una micro-deriva imperceptible para que no se sienta
  // congelada). El agujero queda lejano y sereno: el vacío después de la furia.
  const dist = distB4(tLocal);
  const elev = 54;
  const azim = -0.55 + smooth(p) * 0.06;   // micro-deriva mínima (no es dolly)
  const fov = 45;
  const pos = spherical(azim, (elev * Math.PI) / 180, dist);

  // Target al horizonte, centrado: Gargantua como joya lejana en la columna central.
  const target: Vec3 = [0, 0, 0];

  // exposure serena (el plano inicial). Sin clímax aquí — la furia ya pasó.
  const expo = lerp(1.5, 1.45, smooth(p));

  return {
    cam: { pos, target, fov },
    // CA a 0 rápido: el zoom-out de revelación muestra TODO el starfield; cualquier
    // aberración aquí = confeti verde/rojo sobre las estrellas. Arranca en 0.26
    // (continuo con B3) y cae a 0 en el primer cuarto.
    bh: { exposure: expo, chromaticAberration: lerp(0.26, 0.0, smooth(clamp01(p / 0.25))), ...BASE_DISK, diskTime: diskPhase },
    scaleT: scaleAnchor,
  };
}

// La biblioteca completa (los 4 beats existen para recombinarse en explainers).
export const BEAT_LIBRARY: Beat[] = [
  { id: 'B1_DESCENSO_ORBITAL', durationS: B1_DUR, kind: 'orbital', caption: 'No es un zoom. Es una caída.', program: programB1 },
  { id: 'B2_FOTON_POV',        durationS: 15, kind: 'pov',     caption: 'Eres un fotón. · Cayendo hacia Gargantua (trayectoria evocativa)', program: programB2 },
  { id: 'B3_SLOWDOWN_DILATACION', durationS: 15, kind: 'pov',  caption: 'Aquí el tiempo se frena. · √(1 − rs/r) — real', program: programB3 },
  { id: 'B4_ABISMO_ZOOMOUT',   durationS: B4_DUR, kind: 'zoomout', caption: 'Y tú estabas ahí.', program: programB4 },
];

// ============================================================================
// CADENA configurable. Cada eslabón referencia un beat y un recorte [in,out]
// LOCAL (en segundos del beat). El comercial del brief: B1 completo + B2/B3
// recortados + cola de B4. duration total = suma de (out-in).
// ============================================================================
export interface ChainLink {
  /** id del beat en BEAT_LIBRARY */
  beat: string;
  /** in/out LOCAL del beat en segundos (default 0..durationS) */
  in?: number;
  out?: number;
}

// Comercial del brief (~30s + outro fuera de esta escena):
//   B1 completo (0-15s) → B2 recortado ~7s → B3 recortado ~8s → COLA de B4 (~4s).
// Las ventanas usan las MISMAS SLICE.* con las que los programas anclan sus
// handoffs → el match-cut por el anillo es continuo en geometría (salvo el corte
// DURO a B4, que mantiene la MISMA dist pero corta target/luz al silencio).
// COMERCIAL v1 — los DOS beats que salen CINE 10/10: el descenso majestuoso y el
// abismo revelado. B1 completo (caída orbital, el anillo revienta al final = match
// a la sobreexposición) → CORTE DURO al SILENCIO → cola de B4 (Gargantua entero
// lensado, la "ceja", la sonda en el void que crece). Los beats POV (B2/B3) viven
// en BEAT_LIBRARY para v2/explainers, pero NO entran al comercial (salían planos).
export const DEFAULT_CHAIN: ChainLink[] = [
  { beat: 'B1_DESCENSO_ORBITAL', in: 0, out: B1_DUR },   // caída completa 20s (más larga, más salvaje)
  { beat: 'B4_ABISMO_ZOOMOUT',   in: 0, out: B4_DUR },   // CORTE al silencio + revelado completo 15s (Gargantua GRANDE, se asienta nítido)
];

interface ResolvedSegment {
  beat: Beat;
  start: number;   // start global en la cadena (s)
  end: number;     // end global (s)
  in: number;      // in local del beat (s)
  out: number;     // out local (s)
}

// Resuelve la cadena a segmentos globales contiguos. scaleAnchor (deriva de la
// sonda) es GLOBAL y continuo en toda la cadena → la mota nunca salta en el corte.
function resolveChain(chain: ChainLink[]): { segments: ResolvedSegment[]; duration: number } {
  const byId = new Map(BEAT_LIBRARY.map((b) => [b.id, b]));
  const segments: ResolvedSegment[] = [];
  let cursor = 0;
  for (const link of chain) {
    const beat = byId.get(link.beat);
    if (!beat) {
      console.warn('[CinematicBHReel] beat desconocido en la cadena:', link.beat);
      continue;
    }
    const inL = link.in ?? 0;
    const outL = link.out ?? beat.durationS;
    const len = Math.max(0, outL - inL);
    segments.push({ beat, start: cursor, end: cursor + len, in: inL, out: outL });
    cursor += len;
  }
  return { segments, duration: cursor };
}

// Mapea un t GLOBAL al segmento activo y su tLocal del beat. Pura.
function locate(segments: ResolvedSegment[], duration: number, tGlobal: number) {
  const t = Math.max(0, Math.min(duration, tGlobal));
  // último segmento cuyo start <= t (clamp al final en t == duration)
  let seg = segments[0];
  for (let i = 0; i < segments.length; i++) {
    if (t >= segments[i].start) seg = segments[i];
    else break;
  }
  const tLocal = seg.in + (t - seg.start); // in + offset dentro del segmento
  return { seg, tLocal };
}

// ============================================================================
// Escena
// ============================================================================
export interface CinematicBHReelProps {
  /** Cadena a renderizar. Default = comercial del brief. */
  chain?: ChainLink[];
}

export default function CinematicBHReel({ chain = DEFAULT_CHAIN }: CinematicBHReelProps) {
  // Resolvemos la cadena UNA vez por identidad de `chain` (no rehacer arrays por
  // render). El reloj de fase del disco φ(t) se precalcula con los mismos
  // segmentos (tabla determinista). Ambos memoizados → estables entre renders.
  const resolved = useMemo(() => resolveChain(chain), [chain]);
  const { segments, duration } = resolved;
  const phiTable = useMemo(() => buildPhiTable(segments, duration), [segments, duration]);

  // Tiempo determinista: timeRef (síncrono, sin closure stale) alimenta TODO el
  // camino de render. NADA va por estado React: los props del BH que varían por
  // beat (exposure/CA/diskTime=φ) y el t de la sonda viven en refs escritos por
  // renderAt y leídos en useFrame por el MISMO mecanismo síncrono que la cámara →
  // cero skew de 1 frame, cero setState en el camino de render (100% puro en t).
  const timeRef = useRef(0);
  const dynRef = useRef<{ exposure: number; chromaticAberration: number; diskTime: number; scaleT: number }>({
    exposure: 1.4, chromaticAberration: 0, diskTime: 0, scaleT: 0,
  });

  // Calcula el frame del beat activo en t GLOBAL. PURO en t (locate + φ + program).
  const evalAt = useRef((tGlobal: number): BeatFrame => {
    const { seg, tLocal } = locate(segments, duration, tGlobal);
    return seg.beat.program(tLocal, tGlobal, phiAt(phiTable, tGlobal, duration));
  });
  evalAt.current = (tGlobal: number): BeatFrame => {
    const { seg, tLocal } = locate(segments, duration, tGlobal);
    return seg.beat.program(tLocal, tGlobal, phiAt(phiTable, tGlobal, duration));
  };

  // El cameraProgram que ve el WeightedRig: pose PURA en t (el rig le suma peso).
  const cameraProgram = useRef((tGlobal: number): CameraState => evalAt.current(tGlobal).cam);
  cameraProgram.current = (tGlobal: number): CameraState => evalAt.current(tGlobal).cam;

  // getter síncrono de props dinámicos del BH para BHRaytraced (lee en su useFrame).
  const getBHDynamic = useRef(() => ({
    animTime: dynRef.current.diskTime,
    exposure: dynRef.current.exposure,
    chromaticAberration: dynRef.current.chromaticAberration,
  }));

  useEffect(() => {
    const dur = duration;
    const api = {
      renderAt: (t: number) => {
        const c = Math.max(0, Math.min(dur, t));
        timeRef.current = c; // síncrono: lo leen rig + BHRaytraced + sonda en useFrame
        const frame = evalAt.current(c);
        // Props dinámicos del BH + t de la sonda → REFS (NO estado): los lee el
        // useFrame de cada hijo en el mismo tick. Cero re-render, cero skew.
        dynRef.current.exposure = frame.bh.exposure;
        dynRef.current.chromaticAberration = frame.bh.chromaticAberration;
        dynRef.current.diskTime = frame.bh.diskTime;
        dynRef.current.scaleT = frame.scaleT;
      },
      ready: true,
      duration: dur,
      get t() { return timeRef.current; },
      // Mapa de beats para que el render CACHEE por beat (start/end globales).
      // Expone el caption desde la BIBLIOTECA (DRY: el .cjs lo lee de aquí en vez
      // de hardcodear su propio mapa → cero divergencia).
      beats: segments.map((s) => ({
        id: s.beat.id, start: s.start, end: s.end, kind: s.beat.kind, caption: s.beat.caption,
      })),
      // La cadena cruda (para introspección / cache key).
      chain,
    };
    (window as unknown as { __cinematicBHReel: typeof api }).__cinematicBHReel = api;
    return () => {
      delete (window as unknown as { __cinematicBHReel?: unknown }).__cinematicBHReel;
    };
  }, [chain, duration, segments]);

  // fov inicial = el del primer frame del primer segmento.
  const initialFov = segments[0]?.beat.program(segments[0].in, 0, 0).cam.fov ?? 44;

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas
        frameloop="always"
        camera={{ position: [0, 40, 130], fov: initialFov, near: 0.01, far: 700 }}
        // Calidad de cine: antialias ON. El supersample fuerte lo hace el script
        // de render offline (deviceScaleFactor). makeRenderer mantiene el fallback
        // WebGL del proyecto (en iangpu puede caer a llvmpipe/CPU; B1/B4 viven
        // fuera del campo fuerte para abaratar el raymarch).
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={[1.5, 2]}
        onCreated={({ gl }) => {
          // NoToneMapping: el ACES lo aplica el postFX UNA sola vez (BHRaytraced
          // emite HDR lineal con linearOutput). Cero doble tonemap.
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        {/* Cámara con PESO: el programa de la cadena (puro en t) + micro-shake
            determinista + inercia. getT lee el t global del renderAt. El kind del
            beat activo (para lag/amp) es función PURA de t: el rig lo deriva en su
            propio useFrame con getKind (sin rAF de pared, sin setState). */}
        <BeatWeightedRig
          getProgram={() => cameraProgram.current}
          getT={() => timeRef.current}
          getKind={() => locate(segments, duration, timeRef.current).seg.beat.kind}
        />

        {/* Luz tenue para que la SILUETA del derelicto se lea (issue 10): el casco
            es mate y oscuro; sin luz solo se verían las balizas emisivas. Una
            ambient muy baja + una point cálida débil dan volumen mínimo SIN lavar
            el negro del void (el sujeto sigue siendo el BH). El BH es un quad
            fullscreen sin iluminación de escena, así que estas luces NO lo tocan. */}
        <ambientLight intensity={0.08} />
        <pointLight position={[12, 6, 4]} intensity={6} distance={40} decay={2} color="#ffd2a0" />

        {/* Sujeto: el agujero negro raytrace. linearOutput → NO hace ACES inline.
            rIn/rOut son CONSTANTES (BASE_DISK) → props estables. Los props que
            VARÍAN por beat (exposure físico, chromaticAberration por cercanía a
            b_crit, diskTime=φ monótono) entran por getDynamic: un getter SÍNCRONO
            que lee dynRef en el MISMO useFrame que la cámara (cero skew, cero
            state). Físicamente intacto: geodésicas Schwarzschild, T∝r⁻¾, Doppler
            δ⁴, photon ring √27/2·rs. */}
        <BHRaytraced
          rs={RS}
          rIn={BASE_DISK.rIn}
          rOut={BASE_DISK.rOut}
          inclinationDeg={90}    /* disco en el plano XZ; la cámara hace el trabajo */
          diskOpacity={1.0}
          dopplerStrength={1.0}
          starDensity={0.6}
          starSeed={1.7}
          diskTint="#FFE0A0"
          photonRing
          linearOutput
          nebulaBoost={0.8}
          maxSteps={110}    /* aligera el raymarch para render 4K sin TDR del GPU */
          getDynamic={() => getBHDynamic.current()}
        />

        {/* Referencia de escala: sonda DIMINUTA (scale 0.05 = mota, NO hero-shot).
            getT lee el t GLOBAL síncrono del renderAt (mismo tick que la cámara →
            la deriva no salta ni se atrasa en el corte). Anclada en la columna
            central segura para sobrevivir el crop 9:16. Sus balizas emiten HDR
            (el Bloom las pulsa); con la luz tenue de arriba el casco da silueta. */}
        <ScaleReference
          t={0}
          getT={() => dynRef.current.scaleT}
          scale={0.05}
          emissiveColor="#ffd2a0"
          seed={7}
          path={{
            center: [6.5, 1.6, -3.2],
            amplitude: [1.1, 0.6, 0.8],
            speed: [0.012, 0.017, 0.010],
            drift: [-0.04, 0.010, 0.018],
            tumble: [0.05, 0.018, 0.03],
          }}
        />

        {/* Postproceso cinematográfico — preset 'bh'. Hace el ÚNICO tonemap ACES.
            DOF apagado (bokehScale 0): el BH raytrace es un quad fullscreen SIN
            depth, así que el DOF desenfocaría todo el cuadro uniforme. El grade
            PESADO (halación roja-ámbar, 10-bit+dither, grano determinista,
            gate-weave, LUT Kodak-2383, flare anamórfico real) va en la SEGUNDA
            etapa de ffmpeg offline, NO aquí. */}
        <CinematicPostFX
          preset="bh"
          bloomThreshold={0.12}
          dofBokehScale={0}
          anamorphic
        />
      </Canvas>
    </div>
  );
}

// ============================================================================
// BeatWeightedRig — rig con PESO cuyo lag/amp cambia con el beat ACTIVO, 100%
// PURO en t. (Antes había un rAF de PARED que muestreaba getKind con setState +
// key={kind} para remontar el WeightedRig: eso introducía no-determinismo —
// dependía del reloj de pared del navegador, rompía el cache, y al remontar
// reseteaba lagState=null en el corte = "jitter de peso".)
// ----------------------------------------------------------------------------
// Ahora el kind del beat se deriva DENTRO del useFrame como función PURA de t
// (locate→beat.kind) y de ahí se eligen lag/posAmp/targetAmp en el momento. El
// lagState es ÚNICO y PERSISTENTE (no se resetea en el corte) → sin jitter. Como
// t avanza monótono y determinista en el render, el filtro de inercia es 100%
// reproducible. Reemplaza al <WeightedRig> (que fija opts por render) por un
// addWeight directo con opts elegidas por frame.
// ============================================================================
function BeatWeightedRig({
  getProgram,
  getT,
  getKind,
}: {
  getProgram: () => (t: number) => CameraState;
  getT: () => number;
  getKind: () => BeatKind;
}) {
  const { camera } = useThree();
  // Estado de inercia ÚNICO y persistente entre frames (NO se resetea en el corte).
  const lagState = useRef<LagState>({ pos: null, target: null });

  useFrame(() => {
    const t = getT();
    const prog = getProgram()(t);
    // kind del beat = función PURA de t → elige el peso (lag/amp) aquí mismo.
    const rig = RIG_BY_KIND[getKind()];
    const { pos, target } = addWeight(prog.pos, prog.target, t, {
      lag: rig.lag,
      posAmp: rig.posAmp,
      targetAmp: rig.targetAmp,
      lagState: lagState.current,
      dt: 1 / 60,
    });
    cameraAt(camera as THREE.PerspectiveCamera, pos, target, prog.fov);
  });

  return null;
}
