// camera-shots.ts — GRAMÁTICA DE TOMAS (shot grammar) para la serie de enlaces.
//
// ⚠️ ANTES DE TOCAR ESTO LEE docs/CANON-VIDEO.md (Regla #0). La cámara de un video
// nuevo NO se escribe desde cero: se COPIA la del último ganador (O₂/N₂/C₂/H₂O) y se
// EXTIENDE aquí con tomas nuevas (twoShot, orbitOne, pushToBridge, crashIn…). Cámara
// fija inventada = el fallo #1. La cámara SIEMPRE VIAJA (playShots, puro en t).
//
// EL PROBLEMA que resuelve: molCamera era UNA escalera de fases hardcodeada y
// TODAS las moléculas hacían el MISMO viaje (nacimiento→choque→órbita→clavado→
// núcleo→salida). Aburre. Aquí la cámara se vuelve un VOCABULARIO de tomas
// componibles: cada pieza ensambla su propia SECUENCIA (lista de tomas) → la
// variedad es DATOS, no reescribir la cámara.
//
// Cada toma está MAPEADA a un principio de docs/NEUROCIENCIA-DEL-CINE.md:
//   loomPush     → §6 looming (colículo-amígdala): el objeto CRECE = alarma de colisión
//   craneUnder   → §3 ángulo bajo = PODER/MONSTRUOSIDAD (el objeto te DOMINA)
//   eyeLevelLock → §3 nivel de ojo = CONFIANZA (el beat del DATO "nada inventado")
//   diveToNucleus→ §4 close-up = EMPATÍA (antropomorfiza) + §6 looming
//   heroOrbit    → §5 movimiento = INMERSIÓN encarnada (órbita con peso)
//   staticBreath → el SILENCIO como recurso (contraste; el siguiente golpe pega más)
//   whipParallax → energía/parallax (barrido lateral rápido entre los dos átomos)
//   dutchDrift   → inquietud (roll cantado; usar con MODERACIÓN, §3 contraste)
//   pullOut      → Powers-of-Ten de regreso (escala sentida)
//   crashIn      → la FORMACIÓN pegada (el enlace enciende llenando el cuadro)
//
// DETERMINISMO (regla dura del proyecto): todo es función PURA de t. Cero random,
// cero reloj. El secuenciador da continuidad C0 automática (blend en costuras) →
// ya NO hay que empatar a mano azim=9.1+2π etc. Reordenas tomas y sigue continuo.
//
// CONVENCIÓN DE EJES (idéntica a molCamera): el enlace va sobre X (núcleos en
// ±nucX). roll=π/2 pone el eje VERTICAL en pantalla (llena el 9:16). El rig de
// 16:9 le resta el π/2 solo (MolCameraRig) → las tomas SIEMPRE se escriben en
// convención vertical.

export type Vec3 = [number, number, number];
export interface Pose { pos: Vec3; fov: number; target: Vec3; roll: number; }

/** Geometría del sujeto en t, que la escena pasa a cada toma. */
export interface ShotCtx {
  ex: number;      // extent: radio característico de la nube (bohr). r se mide en múltiplos de esto.
  nucX: number;    // x del núcleo objetivo (Re/2) — hacia dónde se clava el dive.
  bondR: number;   // separación viva del enlace en t (para seguir la vibración si hace falta).
  t: number;       // t global (para micro-vida coherente y continua entre tomas).
}

/** Una toma: progreso local u∈[0,1] → Pose. */
export type Shot = (u: number, ctx: ShotCtx) => Pose;

/** Entrada de la lista de tomas de una pieza. */
export interface ShotEntry { shot: Shot; dur: number; label?: string; }

const ROLL = Math.PI / 2;                 // convención vertical (el rig de 16:9 lo resuelve)
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const smoother = (t: number) => { const x = clamp01(t); return x * x * x * (x * (x * 6 - 15) + 10); };

function sph(dist: number, elev: number, azim: number): Vec3 {
  return [dist * Math.cos(elev) * Math.cos(azim), dist * Math.sin(elev), dist * Math.cos(elev) * Math.sin(azim)];
}
function orbitAround(C: Vec3, r: number, elev: number, azim: number): Vec3 {
  const o = sph(r, elev, azim); return [C[0] + o[0], C[1] + o[1], C[2] + o[2]];
}
// distancia mínima de seguridad: nunca dentro del sujeto (evita frame negro).
const MINR = 0.14;

// ────────────────────────────────────────────────────────────────────────────
// LA BIBLIOTECA — cada factory devuelve un Shot (u,ctx)=>Pose. Parametrizable.
// ────────────────────────────────────────────────────────────────────────────

/** heroOrbit — §5 INMERSIÓN. Órbita lenta con peso; el sujeto DOMINA el cuadro.
 *  dir=+1/−1 invierte el giro (variedad). rMul en múltiplos de ex (~1.3 llena). */
export function heroOrbit(o: { rMul?: number; elev?: number; azim0?: number; span?: number; dir?: number; fov?: number } = {}): Shot {
  const { rMul = 1.34, elev = 0.16, azim0 = 0.7, span = 1.5, dir = 1, fov = 33 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * (rMul - 0.12 * Math.sin(u * Math.PI)));   // respira acercándose a mitad
    const az = azim0 + dir * span * smooth(u);
    const el = elev + Math.sin(u * Math.PI * 1.3) * 0.14;
    return { pos: sph(r, el, az), fov, target: [0, 0, 0], roll: ROLL };
  };
}

/** loomPush — §6 LOOMING (alarma de colisión). r SE ENCOGE fuerte: el objeto crece
 *  hacia ti. Úsalo en el pico dramático (el dato monstruoso, la ignición). */
export function loomPush(o: { rFrom?: number; rTo?: number; elev?: number; azim?: number; fov?: number } = {}): Shot {
  const { rFrom = 1.5, rTo = 0.72, elev = 0.10, azim = 0.9, fov = 34 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * lerp(rFrom, rTo, smoother(u)));            // acelera al final = se viene encima
    return { pos: sph(r, elev + 0.05 * Math.sin(u * Math.PI), azim), fov, target: [0, 0, 0], roll: ROLL };
  };
}

/** craneUnder — §3 ÁNGULO BAJO = PODER/MONSTRUOSIDAD. La cámara BAJA (elev negativa)
 *  y el objeto se ALZA sobre ti. Gesto, no estado (alternar da la fuerza). */
export function craneUnder(o: { rMul?: number; elevFrom?: number; elevTo?: number; azim0?: number; span?: number; fov?: number } = {}): Shot {
  const { rMul = 1.28, elevFrom = 0.12, elevTo = -0.42, azim0 = 1.0, span = 0.7, fov = 36 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * rMul);
    const el = lerp(elevFrom, elevTo, smoother(u));                           // cae por debajo → mira hacia arriba
    return { pos: sph(r, el, azim0 + span * smooth(u)), fov, target: [0, 0, 0], roll: ROLL };
  };
}

/** eyeLevelLock — §3 NIVEL DE OJO = CONFIANZA. Casi estático, elev≈0, de FRENTE.
 *  El beat del DATO ("μ medido 9.0 D", "verificado al 0.5%"): honestidad. */
export function eyeLevelLock(o: { rMul?: number; azim?: number; fov?: number } = {}): Shot {
  const { rMul = 1.30, azim = Math.PI / 2, fov = 32 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * rMul);
    // micro-deriva mínima (peso), pero se queda de frente a nivel de ojo.
    return { pos: sph(r, 0.02 * Math.sin(u * Math.PI), azim + 0.05 * Math.sin(u * Math.PI * 0.6)), fov, target: [0, 0, 0], roll: ROLL };
  };
}

/** staticBreath — el SILENCIO. Casi quieta, solo peso. Contraste: el siguiente
 *  movimiento pega más fuerte. Úsalo en el beat contemplativo (el electrón solo). */
export function staticBreath(o: { rMul?: number; elev?: number; azim?: number; fov?: number } = {}): Shot {
  const { rMul = 1.42, elev = 0.14, azim = 0.8, fov = 33 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * (rMul + 0.03 * Math.sin(u * Math.PI * 2)));
    return { pos: sph(r, elev + 0.03 * Math.sin(u * Math.PI * 1.5), azim + 0.06 * Math.sin(u * Math.PI)), fov, target: [0, 0, 0], roll: ROLL };
  };
}

/** whipParallax — energía. Barrido lateral RÁPIDO: parallax violento entre los dos
 *  átomos (el electrón que salta, el choque). azim recorre rango amplio veloz. */
export function whipParallax(o: { rMul?: number; elevAmp?: number; azim0?: number; span?: number; fov?: number } = {}): Shot {
  const { rMul = 1.05, elevAmp = 0.22, azim0 = -1.6, span = 2.6, fov = 38 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * rMul * (1 - 0.06 * Math.sin(u * Math.PI * 2)));
    const az = azim0 + span * smoother(u);                                    // arranca lento, azota, frena
    return { pos: sph(r, elevAmp * Math.sin(u * Math.PI), az), fov, target: [0, 0, 0], roll: ROLL };
  };
}

/** dutchDrift — INQUIETUD. roll cantado (deriva de π/2): algo está "torcido".
 *  Con MODERACIÓN (§3): un solo beat, no todo el video. */
export function dutchDrift(o: { rMul?: number; elev?: number; azim0?: number; span?: number; rollAmp?: number; fov?: number } = {}): Shot {
  const { rMul = 1.22, elev = 0.12, azim0 = 0.9, span = 0.9, rollAmp = 0.26, fov = 34 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * rMul);
    const roll = ROLL + rollAmp * Math.sin(u * Math.PI);                      // entra y sale del cantado (C0 en costuras)
    return { pos: sph(r, elev, azim0 + span * smooth(u)), fov, target: [0, 0, 0], roll };
  };
}

/** crashIn — la FORMACIÓN pegada. r pequeño y estable mientras los velos chocan y
 *  el enlace enciende llenando el cuadro. */
export function crashIn(o: { rMul?: number; elev?: number; azim0?: number; span?: number; fov?: number } = {}): Shot {
  const { rMul = 0.98, elev = 0.02, azim0 = Math.PI / 2 - 1.2, span = 1.1, fov = 36 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * rMul * (1 - 0.07 * Math.sin(u * Math.PI * 2)));   // dolly con PULSO (violencia)
    return { pos: sph(r, elev + 0.16 * smooth(u), azim0 + span * smooth(u)), fov, target: [0, 0, 0], roll: ROLL };
  };
}

/** diveToNucleus — §4 CLOSE-UP (empatía) + §6 LOOMING. Caída EXPONENCIAL al núcleo
 *  (Powers-of-Ten): de la molécula a la escala nuclear. El target migra a [nucX,0,0]. */
export function diveToNucleus(o: { rFromMul?: number; rTo?: number; fovFrom?: number; fovTo?: number; spin?: number } = {}): Shot {
  const { rFromMul = 1.44, rTo = 0.18, fovFrom = 33, fovTo = 42, spin = 2.2 } = o;
  return (u, c) => {
    const r0 = c.ex * rFromMul;
    const r = Math.max(MINR, r0 * Math.pow(rTo / r0, smooth(u)));             // exponencial = escala SENTIDA
    const az = 2.3 + spin * u;                                                // espiral al caer (no elevador)
    const el = lerp(0.18, 0.06, u);
    const m = smooth(Math.min(1, u / 0.35));                                  // el centro migra a núcleo TEMPRANO
    const cen: Vec3 = [lerp(0, c.nucX, m), 0, 0];
    return { pos: orbitAround(cen, r, el, az), fov: lerp(fovFrom, fovTo, u), target: cen, roll: ROLL };
  };
}

/** nucleusOrbit — órbita ÍNTIMA del núcleo: nucleones GIGANTES, vibración de punto
 *  cero visible. Barrido amplio (el núcleo ROTA de verdad en cuadro). */
export function nucleusOrbit(o: { r?: number; elevAmp?: number; azim0?: number; span?: number; fov?: number } = {}): Shot {
  // A r muy cercano (~0.2 bohr) el encuadre es HIPERSENSIBLE: span/elev grandes
  // sacan el cúmulo del cuadro (frame negro). Ranges DOMADOS: elev con sesgo +,
  // barrido moderado. El núcleo siempre en target → centrado.
  const { r = 0.205, elevAmp = 0.10, azim0 = 4.5, span = 2.2, fov = 42 } = o;
  return (u, c) => {
    const cen: Vec3 = [c.nucX, 0, 0];
    const rr = Math.max(MINR, r + 0.012 * Math.sin(u * Math.PI * 3));         // respira
    const el = 0.04 + elevAmp * Math.sin(u * Math.PI * 1.2);                  // sesgo + → nunca lo pierde arriba/abajo
    return { pos: orbitAround(cen, rr, el, azim0 + span * u), fov, target: cen, roll: ROLL };
  };
}

/** pullOut — Powers-of-Ten de REGRESO: el átomo se hace chico, vuelve la molécula
 *  completa. Cierra o encadena al héroe/loop. */
export function pullOut(o: { rTdMul?: number; fovFrom?: number; fovTo?: number; azim0?: number; span?: number } = {}): Shot {
  const { rTdMul = 1.30, fovFrom = 42, fovTo = 33, azim0 = 7.9, span = 1.2 } = o;
  return (u, c) => {
    const r0 = 0.18, r1 = c.ex * rTdMul;
    const r = Math.max(MINR, r0 * Math.pow(r1 / r0, smooth(u)));
    const m = smooth(Math.min(1, u / 0.6));                                   // la mirada regresa a la molécula
    const cen: Vec3 = [lerp(c.nucX, 0, m), 0, 0];
    return { pos: orbitAround(cen, r, lerp(-0.16, 0.20, u), azim0 + span * u), fov: lerp(fovFrom, fovTo, u), target: cen, roll: ROLL };
  };
}

/** approachWide — abre con los DOS átomos visibles, standoff amplio, lento. */
export function approachWide(o: { rFromMul?: number; rToMul?: number; elev?: number; azim0?: number; span?: number; fov?: number } = {}): Shot {
  const { rFromMul = 1.9, rToMul = 1.4, elev = 0.06, azim0 = 0.5, span = 0.8, fov = 40 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * lerp(rFromMul, rToMul, smoother(u)));
    return { pos: sph(r, elev + 0.10 * Math.sin(u * Math.PI), azim0 + span * smooth(u)), fov: lerp(fov, fov - 5, u), target: [0, 0, 0], roll: ROLL };
  };
}

// ────────────────────────────────────────────────────────────────────────────
// TOMAS DEL PAR (2 moléculas + el ESPACIO ENTRE ELLAS + el campo). Extienden el
// sistema más allá de la diatómica simple. Convención: las dos moléculas sobre X
// en ±nucX; el HUECO/puente en el origen. (investigación NEUROCIENCIA-DEL-CINE §3-6)
// ────────────────────────────────────────────────────────────────────────────

/** twoShot — §5 INMERSIÓN, plano de DOS. Órbita AMPLIA que enmarca a las dos
 *  moléculas (target = punto medio) → siempre ves el par mientras la cámara viaja. */
export function twoShot(o: { rMul?: number; elev?: number; azim0?: number; span?: number; dir?: number; fov?: number } = {}): Shot {
  const { rMul = 1.7, elev = 0.14, azim0 = 0.6, span = 1.4, dir = 1, fov = 40 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * (rMul - 0.10 * Math.sin(u * Math.PI)));
    return { pos: sph(r, elev + 0.10 * Math.sin(u * Math.PI * 1.1), azim0 + dir * span * smooth(u)), fov, target: [0, 0, 0], roll: ROLL };
  };
}

/** throughBridge — §6 el VUELO por el eje O-O: la cámara CRUZA el hueco entre las dos
 *  moléculas (pasa por el puente / el Δρ). De un lado, por el centro, al otro = volar
 *  ENTRE ellas. Único del par (una diatómica no tiene "entre"). */
export function throughBridge(o: { side?: number; rSpan?: number; off?: number; fov?: number } = {}): Shot {
  const { side = 1, rSpan = 0.72, off = 0.34, fov = 48 } = o;
  return (u, c) => {
    const x = side * c.ex * rSpan * (1 - 2 * smoother(u));                     // +fuera → 0 (puente) → −fuera
    const lat = off * c.ex * Math.sin(u * Math.PI);                            // arco lateral (con vida, no línea recta)
    const tx = side * c.ex * rSpan * (1 - 2 * smoother(Math.min(1, u + 0.16)));// mira hacia ADELANTE (sensación de volar)
    return { pos: [x, lat * 0.35, lat], fov, target: [tx, 0, 0], roll: ROLL };
  };
}

/** craneOverPair — §3 ÁNGULO BAJO sobre el PAR entero (no un núcleo): la cámara cae por
 *  debajo y el par se ALZA = poder/monstruosidad del enlace. Con moderación (alternar). */
export function craneOverPair(o: { rMul?: number; elevFrom?: number; elevTo?: number; azim0?: number; span?: number; fov?: number } = {}): Shot {
  const { rMul = 1.55, elevFrom = 0.16, elevTo = -0.5, azim0 = 1.3, span = 0.9, fov = 42 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * rMul);
    return { pos: sph(r, lerp(elevFrom, elevTo, smoother(u)), azim0 + span * smooth(u)), fov, target: [0, 0, 0], roll: ROLL };
  };
}

/** pushToBridge — §6 LOOMING sobre EL PUENTE (el origen, donde nace el Δρ) — NO a un
 *  núcleo. La carga que LLEGA se te viene encima; el enlace = la nube, se acerca. */
export function pushToBridge(o: { rFrom?: number; rTo?: number; elev?: number; azim?: number; fov?: number } = {}): Shot {
  const { rFrom = 1.75, rTo = 0.62, elev = 0.08, azim = 1.1, fov = 40 } = o;
  return (u, c) => {
    const r = Math.max(MINR, c.ex * lerp(rFrom, rTo, smoother(u)));
    return { pos: sph(r, elev + 0.05 * Math.sin(u * Math.PI), azim), fov, target: [0, 0, 0], roll: ROLL };
  };
}

/** orbitOne — §4 CLOSE-UP: órbita ÍNTIMA de UNA molécula (target a ±nucX) → su nube y su
 *  campo de cerca mientras la otra existe al borde. side=+1/−1 elige cuál. */
export function orbitOne(o: { side?: number; rMul?: number; elev?: number; azim0?: number; span?: number; fov?: number } = {}): Shot {
  const { side = 1, rMul = 0.44, elev = 0.14, azim0 = 0.8, span = 1.9, fov = 38 } = o;
  return (u, c) => {
    const cen: Vec3 = [side * c.nucX, 0, 0];
    return { pos: orbitAround(cen, Math.max(MINR, c.ex * rMul), elev + 0.12 * Math.sin(u * Math.PI * 1.2), azim0 + span * smooth(u)), fov, target: cen, roll: ROLL };
  };
}

// ────────────────────────────────────────────────────────────────────────────
// EL SECUENCIADOR — encadena la lista con continuidad C0 automática (blend en
// costuras). Reordenas/cambias tomas y sigue sin saltos.
// ────────────────────────────────────────────────────────────────────────────

const BLEND = 0.6;                        // s de mezcla a cada lado de la costura

function blendPose(a: Pose, b: Pose, w: number): Pose {
  const L = (x: number, y: number) => x + (y - x) * w;
  return {
    pos: [L(a.pos[0], b.pos[0]), L(a.pos[1], b.pos[1]), L(a.pos[2], b.pos[2])],
    target: [L(a.target[0], b.target[0]), L(a.target[1], b.target[1]), L(a.target[2], b.target[2])],
    fov: L(a.fov, b.fov),
    roll: L(a.roll, b.roll),
  };
}

/**
 * playShots — evalúa la lista de tomas en t con continuidad C0. Añade una micro-
 * vida global (respiro con peso) coherente y continua entre costuras.
 *
 * Continuidad: en la costura entre la toma i (u→1) y la i+1 (u→0), mezcla ambas
 * con peso smoothstep en una ventana de BLEND s. Cero empates a mano.
 */
export function playShots(list: ShotEntry[], t: number, ctx: ShotCtx): Pose {
  // límites acumulados
  let total = 0; for (const e of list) total += e.dur;
  const tt = list.length ? Math.max(0, Math.min(total - 1e-4, t)) : 0;

  // localizar toma activa
  let acc = 0, i = 0;
  for (; i < list.length; i++) { if (tt < acc + list[i].dur) break; acc += list[i].dur; }
  if (i >= list.length) i = list.length - 1;
  const local = tt - acc;
  const dur = list[i].dur;
  const u = clamp01(local / dur);

  let pose = list[i].shot(u, ctx);

  // blend con la SIGUIENTE en la ventana final
  if (i < list.length - 1 && dur - local < BLEND) {
    const w = smooth((BLEND - (dur - local)) / (2 * BLEND));     // 0→0.5 en la ventana
    const nx = list[i + 1].shot(0, ctx);
    pose = blendPose(pose, nx, w);
  }
  // blend con la ANTERIOR en la ventana inicial
  if (i > 0 && local < BLEND) {
    const w = smooth((BLEND - local) / (2 * BLEND));             // 0→0.5
    const pv = list[i - 1].shot(1, ctx);
    pose = blendPose(pose, pv, w);
  }

  // micro-vida global (peso): respiro lento continuo, no rompe C0.
  const bx = 0.012 * Math.sin(ctx.t * 0.22);
  pose.pos = [pose.pos[0], pose.pos[1] + bx, pose.pos[2]];
  pose.roll = pose.roll + 0.015 * Math.sin(ctx.t * 0.13);
  return pose;
}
