/**
 * CinematicMolecule — el salto de átomo a MOLÉCULA, con física real.
 *
 * Reusa la maquinaria cinematográfica de CinematicAtom (cuts de cámara, postFX,
 * núcleos, nube de electrones con movimiento). La nube electrónica NO se calcula
 * en el cliente: se PRECOMPUTA en iangpu muestreando la densidad LCAO real
 * (orbitales moleculares de canonical-molecules.ts) y se carga como .bin.
 *
 * Color por simetría del MO: cian = enlaces σ, rosa = pares libres (los que
 * causan el ángulo 104.5° del agua). Geometría VSEPR real.
 *
 * Tiempo determinista: window.__cinematicAtom.renderAt(t) ∈ [0, 15].
 */
import { useEffect, useMemo, useState, memo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, BrightnessContrast, HueSaturation, ToneMapping, Noise } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { elementByZ } from '@/lib/chem/quantum/periodic-table';
import { nucleusInfo } from '@/lib/chem/quantum/atom-builder';
import { vibrationalAnalysis, FF_H2O } from '@/lib/chem/quantum/vibrations';
import {
  Nucleus, ElectronCloud, FrameDriver, Letterbox, CinemaVignette, MagneticField, smoothstep, buildAtomBundle, type AtomBundle,
} from './CinematicAtom';
import { CATALOG_KEYS, CATALOG_FIELD, CATALOG_FIELD_SUB, CATALOG_META, CATALOG_SCALE } from './catalog-data';
import {
  playShots, type ShotEntry,
  approachWide, whipParallax, craneUnder, diveToNucleus, nucleusOrbit, pullOut,
  crashIn, heroOrbit, loomPush, staticBreath, dutchDrift,
  twoShot, throughBridge, craneOverPair, pushToBridge, orbitOne,
  ringWide, ringFaceOn, ringEdgeToFace, ringOne, ringToBridge, eyeLevelLock,
} from './camera-shots';
import { evalCapas, type CapasSpec } from './capas';
import katex from 'katex';
import { WaterMD } from './WaterMD';

const DURATION = 22;   // más largo: la escena RESPIRA (cámara lenta y lejana)
const MD_DURATION = 16;   // agua MD: 10 moléculas se auto-ensamblan (dinámica real)
const WPAIR_DURATION = 77;
const CARGAS_DURATION = 83.2;
const FARADAY_DURATION = 46.0;  // primer corte MUDO para aprobar a ojo (sin voz todavía)   // 6 etapas de cargas + EL ÁTOMO DE HIDRÓGENO, a la voz REAL (82.80s, 19 frases, TAKES=4 mediana, 300 líneas)
const WTRI_DURATION = 77.7;
const WTET_DURATION = 88.0;   // EL CUARTETO: voz 85.51s (segs.json, 27 líneas) + 2.5s de cola
const WHEX6_DURATION = 97.74; // EL HEXÁGONO v2: voz 95.24s (segs.json, 31 líneas) + 2.5s de cola
const HEMO_DURATION = 77;
const WSAL_DURATION = 77;     // LA SAL (Na⁺ + H₂O): provisional = la del rey; recalibrar con segs.json     // LA CAZADORA (hemoglobina): corte de STILLS — recalibrar con segs.json
// (WTRI_DURATION: voz 91.0s + 3s de cola · WPAIR_DURATION: 1 min, beats sincronizados al guion)
// SLOW-MO de la formación O₂: el choque de Morse REAL dura ~1.1s (rapidísimo a
// escala atómica). Para PODER VER cómo se forma el enlace lo vemos en cámara
// lenta ×3 (slow-motion de una dinámica real, no falseo): acercamiento ~3.3s +
// overshoot/vibración visible 3-7s. La física no cambia, solo el reloj de cámara.
// PELÍCULA de 30s (no reel rápido): el enlace se forma DESPACIO, contemplativo.
const O2_FILM_DURATION = 70;   // narración v5 ~65.7s + cola en silencio
const CARO_DURATION = 45;   // FLAGSHIP caroteno: la curva de retención dice que 70s
                            // pierde (solo 19% llega); 45s aprieta el ritmo, sube el % completado
const O2_SLOWMO = 10.0;   // punto dulce: dinámico desde el inicio pero sin atropellar
                          // (13.5 se veía muerto al arranque, 7 iba muy rápido)
// Escala de las nubes atómicas de O (buildAtomBundle ~3 bohr) para que se lean
// como DOS densidades separadas al inicio (núcleos a ±2.7 bohr) y se fundan.
const ATOM_CLOUD_SCALE = 0.82;
// FLASH de energía de enlace: al formarse el O₂ se liberan ~498 kJ/mol (energía
// del doble enlace). Físicamente la energía cinética de la caída al pozo de Morse
// se libera al pasar por re (primer overshoot) → destello + onda expansiva. El
// pico cae en el momento del choque (en tiempo de cámara lenta ≈ 3.5 s).
const O2_FLASH_T = 7.8;   // el choque cae a ~7.8s (con el Morse lento)
function o2Flash(t: number): number {
  const d = t - O2_FLASH_T;
  if (d < -0.9 || d > 6) return 0;
  // sube (gaussiana ancha) y decae lento — en la película el destello RESPIRA, no parpadea
  return d < 0 ? Math.exp(-(d * d) / (2 * 0.28 * 0.28)) : Math.exp(-d / 1.1);
}
// ── CATÁLOGO de enlaces AB INITIO (la serie): cada diatómica con su Re MEDIDO
// (bohr, para el drive de Morse) y mu = e⁻ desapareados (el imán; 0 = no magnético).
// El .bin <mol>-abinitio.bin lo genera scripts/precompute-bond-abinitio.py.
// swirl = giro del anillo π (rad/s) alrededor del eje de enlace — la firma hipnótica
// de los enlaces con π fuerte (el dónut de carga π circulando). Real: el sistema π es
// cilíndrico. El O₂ ya tiene su remolino (el campo magnético), así que swirl bajo.
// pi = color de la 3a nube en singletes = la densidad π REAL (los MO π del enlace
// múltiple), un anillo cian/frío alrededor del puente σ dorado. En O₂ la 3a nube es
// el ESPÍN (violeta, el imán); sin pi definido cae al violeta por defecto.
const BOND_ABINITIO: Record<string, { Re: number; mu: number; swirl: number; pi?: [number, number, number]; boost?: number; piColors?: [number, number, number][]; shellR?: number; ionic?: boolean }> = {
  o2: { Re: 2.283, mu: 2, swirl: 0.10, boost: 1.3 },   // doble enlace · paramagnético · boost: su nube de espín tiene la mitad de masa que el π de N₂ → más luz
  n2: { Re: 2.074, mu: 0, swirl: 0.55, pi: [0.80, 0.34, 1.0] },  // triple · anillo π VIOLETA (el violeta hipnótico de O₂ — dorado+rojos+morados)
  f2: { Re: 2.668, mu: 0, swirl: 0.0, boost: 1.35 },    // enlace simple · sin π (no gira)
  c2: { Re: 2.348, mu: 0, swirl: 0.5, boost: 1.35, pi: [0.45, 0.75, 1.0], piColors: [[0.62, 0.86, 1.0], [0.30, 0.52, 1.0]] },  // ¡doble enlace de PURO π! — dos anillos hielo/azul (diamante)
  h2: { Re: 1.401, mu: 0, swirl: 0.0, boost: 1.45 },    // solo σ · 2 electrones = la nube más tenue → más luz
  li2: { Re: 5.051, mu: 0, swirl: 0.0, boost: 1.5, shellR: 1.767 },    // boost de serie (O₂ ~1.3-1.5): nube densa violeta/cian/oro con puntos brillosos, sin lavar
  be2: { Re: 4.637, mu: 0, swirl: 0.0, boost: 1.6, pi: [0.32, 0.80, 1.0], shellR: 1.098 },  // FANTASMA orden 0: acc=σ2g oro + 3ª nube=σ2u* CIAN; shellR=valle Be
  // NaCl — EL ROBO: primer enlace IÓNICO (y primer heteronuclear) de la serie.
  // El Δρ es ASIMÉTRICO total: el oro cae SOBRE el cloro (lo robado), el azul
  // vacía al sodio (lo perdido) — en covalentes el oro va EN MEDIO; aquí no.
  // Re = 4.462 bohr (2.3609 Å, Honig 1954). Verificado: μ(Re) = 9.10 D calc vs
  // 9.00 D medido (1%). Singlete: sin π, sin espín. Curva q/μ por R en
  // nacl-transfer.json (RHF exagera lo iónico a R grande — etiquetado).
  nacl: { Re: 4.462, mu: 0, swirl: 0.0, boost: 1.45, ionic: true },
  // HF — EL TIRANO: polar covalente (el contraste con el robo total de NaCl).
  // El F (electronegatividad MÁXIMA, 3.98) jala pero NO arranca: q_H ≈ +0.35
  // (NaCl era +0.98). El puente EXISTE (desplazado hacia el F) → glow covalente
  // normal, sin bandera ionic. Re = 1.7325 bohr (0.9168 Å medido).
  // μ(Re) = 1.94 D calc vs 1.826 medido (RHF exagera ~6% — etiquetado).
  hf: { Re: 1.7325, mu: 0, swirl: 0.0, boost: 1.4 },
  // CO — EL ABRAZO ASESINO: el enlace más fuerte de la naturaleza (1072 kJ/mol,
  // triple, isoelectrónico con N₂). Heteronuclear pero CASI balanceado: μ medido
  // 0.11 D — vive en el punto de cruce donde q_C cambia de signo (el scan real
  // lo muestra: +0.19 a 1.23 Å, −0.20 a 0.93 Å). Verificado por Re, NO por μ
  // (RHF invierte el signo de μ en CO — caso de libro, etiquetado): Re(RHF/cc-pVTZ)
  // = 1.105 Å vs 1.1283 medido (2.1%). Identidad visual: anillos π BRASA/CARMESÍ
  // (el asesino silencioso — se agarra de tu sangre). Re = 2.1322 bohr.
  co: { Re: 2.1322, mu: 0, swirl: 0.5, boost: 1.15, pi: [1.0, 0.40, 0.35], piColors: [[1.0, 0.48, 0.30], [0.95, 0.24, 0.40]] },
  // NO — EL MENSAJERO: radical de capa abierta. UN electrón desapareado en un π*
  // ANTIENLAZANTE → orden de enlace 2.5 (media unión deshecha). Ese electrón suelto
  // es la NUBE DE ESPÍN, y es la protagonista: por eso es un radical y por eso tu
  // cuerpo lo usa para señalizar. mu: 1 = paramagnético de UN electrón (O₂ tiene 2).
  // Color CIAN-AQUA (la señal): distinto del brasa de CO y del violeta de N₂/O₂.
  // Re = 2.1747 bohr (1.1508 Å medido). Verificado por Re (3.0%) + ⟨S²⟩=0.795 vs
  // 0.75 de doblete puro — μ NO sirve de gate aquí (0.159 D medido, campo medio lo
  // erra 4×, mismo caso que CO).
  no: { Re: 2.1747, mu: 1, swirl: 0.35, boost: 1.3, pi: [0.30, 0.95, 0.90] },
  // HCl — EL ÁCIDO: covalente polar (misma familia que HF, jalón más suave). Capa
  // cerrada, sin π, sin espín → nube dorada como HF/H2 (la identidad la dan la
  // HISTORIA y la serie del jalón q(H): NaCl +0.98 → HF +0.35 → HCl +0.17). El Cl
  // es GORDO → la nube es asimétrica y grande hacia la derecha. Re = 2.4086 bohr
  // (1.2746 Å medido). Gate por Re (0.5%); μ RHF exagera ~17% (etiquetado).
  hcl: { Re: 2.4086, mu: 0, swirl: 0.0, boost: 1.35 },
  // H₂O — EL AGUA: primer TRIATÓMICO. El ángulo entra a la serie. Re aquí = distancia
  // O-H de equilibrio (1.81 bohr) → R=Re·_appr brackets el escaneo de FORMACIÓN del
  // bin (Svals·D_OH). La nube bent y los PARES LIBRES vienen directos del bin (O2Cloud
  // dibuja posiciones crudas). Sin π (thirdRing=0); la 3ª nube = pares libres (violeta).
  // V2 (métricas del agua = éxito): más COLOR. `pi` = MORADO vívido para los PARES
  // LIBRES (isPi los sube de 0.34 → 0.55+glow y los pinta) — son la estrella (las
  // "orejas" que doblan el agua) y contestan el comentario "por qué la nube no es
  // simétrica". boost 1.55 = todo más luminoso. La gente ama los morados.
  h2o: { Re: 1.8098, mu: 0, swirl: 0.0, boost: 1.12, pi: [0.82, 0.28, 1.0] },
};
// Triatómicas: geometría MEDIDA (los núcleos se fuerzan a esta pose, alineada con el
// Δρ del bin — igual que los diatómicos se fuerzan a ±Re/2 en X). O en origen, 2 H en
// el plano XY a D_OH·_appr, ángulo fijo. El eje C2 (dipolo) en +X.
const TRIATOMIC: Record<string, { dOH: number; angle: number }> = {
  h2o: { dOH: 1.8098, angle: 104.478 },   // bohr, grados (medidos)
};
const isTri = (k: string): boolean => k in TRIATOMIC;
const isBond = (k: string): boolean => k in BOND_ABINITIO;

type Vec3 = [number, number, number];

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function sph(dist: number, elev: number, azim: number): Vec3 {
  return [dist * Math.cos(elev) * Math.cos(azim), dist * Math.sin(elev), dist * Math.cos(elev) * Math.sin(azim)];
}
// órbita alrededor de un centro C (para el VIAJE: clavarse en un núcleo y orbitarlo)
function orbitAround(C: Vec3, r: number, elev: number, azim: number): Vec3 {
  const o = sph(r, elev, azim);
  return [C[0] + o[0], C[1] + o[1], C[2] + o[2]];
}

// ── helpers vectoriales para el marco principal de la molécula ──
const crossV = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normV = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Marco geométrico de la molécula: eje principal (a) + plano perpendicular (p1,p2),
// centroide (c), semilongitud (L) y radio perpendicular (Rp). `chain` = la molécula
// es ALARGADA (cadena) → la cámara la ATRAVIESA en vez de orbitarla.
interface Frame { ex: number; chain: boolean; L: number; Rp: number; a: Vec3; p1: Vec3; p2: Vec3; c: Vec3; planeN: Vec3; dna?: boolean; o2?: boolean; nucX?: number; mk?: string; }

function frameFromNuclei(nuclei: { pos: Vec3 }[], ex: number): Frame {
  const base: Frame = { ex, chain: false, L: ex, Rp: ex * 0.4, a: [1, 0, 0], p1: [0, 1, 0], p2: [0, 0, 1], c: [0, 0, 0], planeN: [0, 0, 1] };
  if (nuclei.length < 2) return base;
  let c: Vec3 = [0, 0, 0];
  nuclei.forEach(n => { c = [c[0] + n.pos[0], c[1] + n.pos[1], c[2] + n.pos[2]]; });
  c = [c[0] / nuclei.length, c[1] / nuclei.length, c[2] / nuclei.length];
  // covarianza (xx,yy,zz,xy,xz,yz) → eigenvector principal por power iteration
  const cov = [0, 0, 0, 0, 0, 0];
  nuclei.forEach(n => { const d = [n.pos[0] - c[0], n.pos[1] - c[1], n.pos[2] - c[2]];
    cov[0] += d[0] * d[0]; cov[1] += d[1] * d[1]; cov[2] += d[2] * d[2];
    cov[3] += d[0] * d[1]; cov[4] += d[0] * d[2]; cov[5] += d[1] * d[2]; });
  const mv = (x: Vec3): Vec3 => [cov[0] * x[0] + cov[3] * x[1] + cov[4] * x[2],
    cov[3] * x[0] + cov[1] * x[1] + cov[5] * x[2], cov[4] * x[0] + cov[5] * x[1] + cov[2] * x[2]];
  let v: Vec3 = [1, 0.41, 0.17];
  for (let i = 0; i < 28; i++) v = normV(mv(v));
  const a = v;
  const t: Vec3 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const p1 = normV(crossV(a, t)), p2 = normV(crossV(a, p1));
  let L = 0, Rp = 0, v1 = 0, v2 = 0;
  nuclei.forEach(n => { const dx = n.pos[0] - c[0], dy = n.pos[1] - c[1], dz = n.pos[2] - c[2];
    const s = Math.abs(dx * a[0] + dy * a[1] + dz * a[2]); const perp = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - s * s));
    L = Math.max(L, s); Rp = Math.max(Rp, perp);
    const a1 = dx * p1[0] + dy * p1[1] + dz * p1[2], a2 = dx * p2[0] + dy * p2[1] + dz * p2[2];
    v1 += a1 * a1; v2 += a2 * a2; });
  // normal del plano molecular = dirección perpendicular de MENOR dispersión (en
  // una cadena conjugada plana, el plano contiene el eje; la normal es la cara π).
  const planeN = v1 < v2 ? p1 : p2;
  const elong = L / Math.max(Rp, 1e-3);
  return { ex, chain: nuclei.length >= 6 && elong > 2.2, L: L || ex, Rp: Rp || ex * 0.3, a, p1, p2, c, planeN };
}

interface Shot { pos: Vec3; fov: number; target: Vec3; roll: number; }

export const DNA_DURATION = 26;   // el ADN dura más: es un VIAJE de escala

// ── Cámara de ADN: VIAJE DE ESCALA (Powers of Ten). Arranca PEGADA a un punto de
// la hélice (escala atómica, "lo mini") y se aleja EXPONENCIALMENTE — revelando un
// par de bases → una vuelta → la doble hélice → la estructura gigante. Espiral
// lenta de revelado, la mirada migra del detalle al conjunto. Un viaje hermoso. ──
function dnaCamera(t: number, f: Frame): Shot {
  const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
  const a = f.a, c = f.c, p1 = f.p1, p2 = f.p2;
  const Rp = Math.max(f.Rp, 1), L = Math.max(f.L, 1), ext = Math.hypot(L, Rp);
  const T = Math.max(0, Math.min(1, t / DNA_DURATION));
  const zoomT = Math.min(1, T / 0.76), k = ease(zoomT);   // el zoom-out ocupa el 76%
  const hold = Math.max(0, (T - 0.76) / 0.24);             // HOLD + órbita en la vista COMPLETA
  // punto focal: cerca de la superficie, a media altura — de ahí arranca (en un clúster)
  const fp: Vec3 = [c[0] + p1[0] * Rp * 0.45, c[1] + p1[1] * Rp * 0.45, c[2] + p1[2] * Rp * 0.45];
  // distancia EXPONENCIAL (Powers of Ten): de un CLÚSTER (Rp·0.32, no el vacío) a
  // la estructura COMPLETA con aire (ext·3.4) — bastante zoom out.
  const dmin = Rp * 0.32, dmax = ext * 3.4;
  const d = dmin * Math.pow(dmax / dmin, k);
  const ph = 0.5 + k * Math.PI * 1.4 + hold * 0.8;         // espiral + sigue girando lento en el hold
  const elev = k * 0.40;
  let dir: Vec3 = [
    p1[0] * Math.cos(ph) + p2[0] * Math.sin(ph) + a[0] * Math.sin(elev) * 1.3,
    p1[1] * Math.cos(ph) + p2[1] * Math.sin(ph) + a[1] * Math.sin(elev) * 1.3,
    p1[2] * Math.cos(ph) + p2[2] * Math.sin(ph) + a[2] * Math.sin(elev) * 1.3];
  const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1; dir = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
  const pos: Vec3 = [fp[0] + dir[0] * d, fp[1] + dir[1] * d, fp[2] + dir[2] * d];
  const target: Vec3 = [lerp(fp[0], c[0], k), lerp(fp[1], c[1], k), lerp(fp[2], c[2], k)];
  return { pos, fov: lerp(52, 32, k), target, roll: 0.04 * Math.sin(t * 0.3) };
}

// ── Cámara de molécula. Dos modos:
//   COMPACTA → orbit VIOLENTO: embiste, gira duro con banking, órbita rápida, asienta.
//   CADENA   → TRAVERSAL: entra por un extremo, ATRAVIESA el esqueleto tejiendo con
//              roll, sale por el otro extremo y se abre a la vista lateral heroica.
// FÍSICA REAL de la formación del enlace: oscilador de Morse AMORTIGUADO.
// V(x) = De(1 − e^{−a(x−1)})²   (x = r/re). Integra F = −dV/dx con amortiguamiento
// (la energía radiada al enlazar). Los dos átomos CAEN al pozo, SOBREPASAN re
// (comprimen), rebotan en la pared repulsiva y VIBRAN amortiguándose hasta asentarse
// en re — eso ES la formación del enlace. La forma (asimétrica: fall→overshoot→
// vibración→settle) es física real; la escala temporal es cinematográfica.
let _morseCache: Float32Array | null = null;
function morseR(t: number): number {
  if (!_morseCache) {
    const N = 1500, dt = 0.013, a = 2.4, De = 1.0, gamma = 0.30, tScale = 5.5;
    const arr = new Float32Array(N);
    let x = 2.18, v = -0.20;   // ARRANCAN LEJOS y en deriva lenta: primero se VEN como individuos.
    // gamma bajo (0.30): tras la captura el enlace REBOTA y vibra VISIBLE muchas veces
    // (±12% aún a los 30s de película) — el "entrelazamiento" se ve una y otra vez.
    for (let i = 0; i < N; i++) {
      arr[i] = x;
      const e = Math.exp(-a * (x - 1));
      const F = -2 * De * a * e * (1 - e);              // −dV/dx (Morse)
      const acc = (F - gamma * v) * tScale;             // amortiguado (energía liberada)
      v += acc * dt;
      x += v * dt * tScale;
      if (x < 0.5) { x = 0.5; v = Math.abs(v) * 0.4; }  // pared repulsiva dura
    }
    _morseCache = arr;
  }
  // interpolación LINEAL entre muestras → R(t) CONTINUO. Con floor() se ESCALONA
  // R en la aproximación (donde la cámara casi no se mueve): a 60fps cada valor se
  // repite ~10 cuadros y se ve TRABADO. Interpolar = advección suave, 60fps real.
  const dt = 0.013;
  const x = Math.max(0, t / dt);
  const i0 = Math.min(_morseCache.length - 1, Math.floor(x));
  const i1 = Math.min(_morseCache.length - 1, i0 + 1);
  const f = x - i0;
  return _morseCache[i0] * (1 - f) + _morseCache[i1] * f;
}

// ── bondR(t): la SEPARACIÓN y la UNIÓN suceden VARIAS VECES (espacio continuo,
// cero cortes). Llaves: abre FORMADA (el pico = frame 1) → se separa ante tus ojos
// → individuos → UNIÓN #1 en "se funden" (13.1) → rebote → UNIÓN #2 (17.6, queda
// formada para el explicador σ/π/π) → respira → UNIÓN #3 SNAP en "el agarre más
// fuerte" (27) → formada para el viaje. Catmull-Rom (suave, C1) + clamp al bin. ──
const BOND_KEYS: [number, number][] = [
  [0.0, 0.98], [1.2, 1.06], [5.5, 2.05], [9.0, 1.78], [12.2, 1.22],
  [13.05, 0.88], [13.7, 1.04], [15.3, 1.50], [17.15, 0.90], [17.9, 1.02],
  [23.3, 1.00], [24.4, 1.40], [25.55, 0.90], [26.3, 1.01], [28.0, 1.00],
];
function bondR(t: number, mol = 'n2'): number {
  if (mol === 'o2') return 1.0;   // la SECUELA no re-cuenta la formación: molécula formada SIEMPRE (zpv aparte)
  if (mol === 'h2o') return 1.0;  // AGUA v2 (aprobada): molécula FORMADA (frame 1 = pico ardiendo); el zpv da el latido
  if (mol === 'li2') {            // Li₂: caen desde 3.8·Re → SOBREPASAN Re → VIBRAN amortiguado → se asientan.
    // El asentamiento ES el pozo de energía hecho movimiento: caen dentro, rebotan, quedan
    // ATRAPADOS oscilando en Re (vibración de punto cero real) = por qué NO se sueltan.
    if (t >= 27) return 1.0;                                        // asentados en el fondo del pozo
    if (t < 19) { const k = t / 19; return 3.8 + (1.0 - 3.8) * (k * k); }   // caen acelerando hasta Re en t19
    const u = t - 19;                                              // vibración amortiguada alrededor de Re
    return 1.0 - 0.18 * Math.sin(u * 1.9) * Math.exp(-u * 0.5);    // sobrepasan (bondR<1), rebotan, decaen a 1
  }
  const K = BOND_KEYS;
  if (t <= K[0][0]) return K[0][1];
  if (t >= K[K.length - 1][0]) return K[K.length - 1][1];
  let i = 0;
  while (i < K.length - 2 && K[i + 1][0] < t) i++;
  const p0 = K[Math.max(0, i - 1)], p1 = K[i], p2 = K[i + 1], p3 = K[Math.min(K.length - 1, i + 2)];
  const dt = p2[0] - p1[0], u = (t - p1[0]) / dt;
  // Catmull-Rom (tangentes escaladas por el paso local)
  const m1 = dt * (p2[1] - p0[1]) / (p2[0] - p0[0]);
  const m2 = dt * (p3[1] - p1[1]) / (p3[0] - p1[0]);
  const u2 = u * u, u3 = u2 * u;
  const x = (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
  return Math.max(0.86, Math.min(2.15, x));
}

// TIME-WARP cinematográfico con DESPLOME (C1): deriva lenta 0–9s (los INDIVIDUOS,
// tensión) → el tiempo ACELERA 2× más rápido que O₂ en 10.5–13 (la CAÍDA se siente
// violenta: los velos se estrellan) → asienta a ritmo normal tras la fusión. La
// compresión máxima cae en "sus nubes se funden" (14.1s). Cache determinista.
let _tauCache: Float32Array | null = null;
function morseTau(t: number): number {
  const dt = 1 / 60;
  if (!_tauCache) {
    const N = Math.ceil(90 / dt);
    const arr = new Float32Array(N);
    const S = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    let tau = 0;
    for (let i = 0; i < N; i++) {
      arr[i] = tau;
      const tt = i * dt;
      const rate = (1 / 43) + (1 / 16 - 1 / 43) * S((tt - 9.0) / 2.5)    // acelera al desplome
                 + (1 / 12.3 - 1 / 16) * S((tt - 13.4) / 2.0);           // asienta tras el choque
      tau += rate * dt;
    }
    _tauCache = arr;
  }
  const x = Math.max(0, t / dt);
  const i0 = Math.min(_tauCache.length - 1, Math.floor(x));
  const i1 = Math.min(_tauCache.length - 1, i0 + 1);
  const f = x - i0;
  return _tauCache[i0] * (1 - f) + _tauCache[i1] * f;
}

// ── LISTAS DE TOMAS por pieza (la VARIEDAD es datos, no código) ──────────────
// Cada viaje ensambla la gramática de camera-shots.ts distinto, pero TODOS caen
// en los mismos anclajes narrativos: dive al núcleo ~32-40s ("ven, mira el
// corazón"), órbita íntima ~44-52, salida ~52-66. Lo que cambia es la APERTURA,
// la TOMA-FIRMA y el ritmo → deja de ser el mismo viaje. Suman ~66s (cubren el
// render; la última toma sostiene si sobra). Opt-in: solo estas moléculas usan
// la gramática; o2/n2/f2/li2/caroteno/cadenas conservan su cámara a medida.
// La COLA (dive→núcleo→salida→héroe) está SINCRONIZADA al horario del contenido
// (transitDim, ~línea 2270): dim al entrar (30-32.5), núcleo brillante (39-51),
// warp-out en la zona-muerta intencional (51.2-52.7) y el BRILLO REGRESA con la
// molécula (53.9-56.2). Por eso la cola comparte TIEMPOS entre piezas — pero el
// contenido difiere. La VARIEDAD vive en los primeros 27s: apertura + toma-firma
// distintas por pieza (whip / loom / staticBreath / dutch / craneUnder).
const TAIL: ShotEntry[] = [
  { shot: diveToNucleus({ spin: 2.2 }), dur: 12, label: 'clavado 27-39' },
  { shot: nucleusOrbit({}), dur: 12, label: 'corazón 39-51' },
  { shot: pullOut({}), dur: 5, label: 'warp-out 51-56' },
  { shot: heroOrbit({ dir: 1, span: 1.1, rMul: 1.32 }), dur: 10, label: 'héroe/loop 56-66' },
];
const CAMERA_SHOTS: Record<string, ShotEntry[]> = {
  // CARGAS — LA LEY DE GAUSS: el sujeto es EL CAMPO, no las bolitas. El hexágono vive en el
  // plano z=0, así que DE FRENTE (face-on) es la toma que muestra la cuenta: se ven las líneas
  // escapar por los huecos… y dejar de escapar cuando entra la sexta carga.
  // Los cortes caen EN LOS SILENCIOS de la voz (segs.json de dist-video/cargas-narracion):
  // 10.7 · 16.9 · 23.7 · 30.7 · 38.0 · 46.1 · 50.5 · 54.8 · 63.7 · 72.2 → suman 84.0 s.
  cargas: [
    // GANCHO: el hexágono CERRADO, denso, oro + violeta. Es la imagen que captura (la receta
    // medida de los frame 0 que sí funcionaron), y la voz la nombra: "seis cargas…".
    // EN 3D Y EN MOVIMIENTO, no de frente. El hexágono vive en el plano z=0 y en la convención
    // del rig azim=π/2 pone la cámara SOBRE su normal → se ve plano, "desde arriba", y todo el
    // 3D se desperdicia (Ian: "eso lo arruina todo"). azim0≈0.8 es tres cuartos —entre el canto
    // y el frente— con elevación: se ven las líneas SALIR DEL PLANO hacia ti. Y orbita.
    { shot: heroOrbit({ rMul: 1.18, elev: 0.34, azim0: 0.80, span: 0.85, fov: 38 }), dur: 10.7, label: 'GANCHO 3D: 6 cargas, 3 y 3, orbitando (voz 0.4-8.2)' },
    // …y REBOBINA a una sola carga, ENCIMA: con rMul 1.02 el cuadro salía 96.8% NEGRO.
    { shot: ringFaceOn({ rMul: 0.52, azim0: Math.PI / 2 + 0.25, span: 0.30, elev: 0.06, fov: 40 }), dur: 6.0, label: 'UNA carga sola, ENCIMA: todo escapa (voz 6.3-10.7)' },
    { shot: ringFaceOn({ rMul: 0.95, azim0: Math.PI / 2 + 0.3, span: 0.3, elev: 0.10, fov: 34 }), dur: 6.6, label: 'entra el − : las 60 MUEREN (voz 11.3-18.0)' },
    { shot: heroOrbit({ rMul: 1.12, elev: 0.34, azim0: 1.2, span: 1.1, fov: 35 }), dur: 6.9, label: 'órbita 3 y 4 cargas: el campo es 3D (voz 18.6-24.9)' },
    { shot: ringFaceOn({ rMul: 1.20, azim0: Math.PI / 2, span: 0.22, elev: 0.05, fov: 36 }), dur: 7.3, label: 'GAUSS: contar lo que sale (voz 25.5-32.2)' },
    { shot: ringFaceOn({ rMul: 1.34, azim0: Math.PI / 2, span: 0.18, elev: 0.04, fov: 36 }), dur: 7.9, label: 'la SEXTA cierra: 180 de 180 (voz 32.8-40.3)' },
    // "y en el centro el campo vale cero exacto": la cámara SE METE al hueco del hexágono.
    // El cero no se dibuja (Ian lo mandó quitar) — se ve: ahí no pasa NINGUNA línea.
    { shot: crashIn({ elev: 0.05, azim0: Math.PI / 2, fov: 34 }), dur: 4.4, label: 'AL CENTRO: el hueco donde E=0 (voz 40.9-44.9)' },
    { shot: pullOut({ azim0: 1.0, span: 0.9, rFromMul: 0.72, rTdMul: 1.45, fovFrom: 34, fovTo: 40 }), dur: 4.2, label: '"pero son bolitas ideales" (voz 45.5-49.2)' },
    // EL ÁTOMO: se entra despacio (el sujeto pasa de 11 a 4.6 bohr) y se orbita para que se
    // vea que la nube ENVUELVE al protón en 3D — no es un disco.
    { shot: crashIn({ elev: 0.18, azim0: 0.4, fov: 34 }), dur: 8.9, label: 'ENTRA el átomo: protón + su nube (voz 49.8-57.6)' },
    { shot: heroOrbit({ rMul: 0.72, elev: 0.30, azim0: 1.1, span: 1.2, fov: 33 }), dur: 8.6, label: 'la nube ENVUELVE al protón (voz 58.2-66.3)' },
    { shot: heroOrbit({ rMul: 0.62, elev: -0.18, azim0: 2.6, span: 1.6, fov: 35 }), dur: 11.7, label: 'las líneas SE APAGAN dentro de la nube (voz 66.9-76.4)' },
  ],
  // FARADAY — LA JAULA: el "rayo" (carga externa) se acerca y el campo NO ENTRA.
  // Mismo lenguaje que cargas: 3/4 en 3D (nunca de frente al plano), la cámara ORBITA,
  // y el corte al hueco central donde se ve que no pasa ni una línea.
  faraday: [
    // NUNCA meter la cámara DENTRO del cubo: sin un vértice y dos aristas convergiendo el
    // cerebro no lee "jaula", lee "muro de azulejos" (veredicto de los agentes, 2026-07-30).
    // Todas las tomas en 3/4 y por fuera; lo que cambia es el ángulo y la distancia.
    { shot: heroOrbit({ rMul: 1.45, elev: 0.34, azim0: 0.80, span: 0.7, fov: 36 }), dur: 10.0, label: 'la jaula en 3/4, el rayo lejos' },
    { shot: heroOrbit({ rMul: 1.30, elev: 0.20, azim0: 1.35, span: 0.6, fov: 36 }), dur: 9.0, label: 'se acerca: las líneas se doblan hacia la jaula' },
    { shot: heroOrbit({ rMul: 1.20, elev: -0.26, azim0: 2.20, span: 0.8, fov: 36 }), dur: 9.0, label: 'órbita baja: las líneas ABRAZAN el cubo' },
    { shot: ringFaceOn({ rMul: 1.15, azim0: 0.95, span: 0.30, elev: 0.30, fov: 34 }), dur: 9.0, label: 'el hueco NEGRO de adentro contra el campo de afuera' },
    { shot: pullOut({ azim0: 0.9, span: 0.8, rFromMul: 1.05, rTdMul: 1.55, fovFrom: 34, fovTo: 40 }), dur: 9.0, label: 'payoff: el rayo encima y el interior intacto' },
  ],
  // NaCl — EL ROBO A DISTANCIA: ver los dos separados → el electrón SALTA (whip) →
  // el Cl⁻ se ALZA sobre ti (ángulo bajo = poder del ladrón) → COLA.
  nacl: [
    { shot: approachWide({ rFromMul: 2.0, rToMul: 1.5 }), dur: 8, label: 'ver los dos' },
    { shot: whipParallax({ azim0: -1.6, span: 2.8 }), dur: 7, label: 'el salto' },
    { shot: craneUnder({ elevTo: -0.44 }), dur: 12, label: 'el ladrón domina' },
    ...TAIL,
  ],
  // CO — EL ABRAZO ASESINO: formación pegada (el abrazo) → órbita mostrando los 3
  // anillos → "1072" SE VIENE ENCIMA (loom = fuerza-amenaza) → COLA.
  co: [
    { shot: crashIn({}), dur: 13, label: 'el abrazo' },
    { shot: heroOrbit({ dir: 1, span: 1.6, rMul: 1.3 }), dur: 8, label: '3 anillos' },
    { shot: loomPush({ rFrom: 1.4, rTo: 0.72 }), dur: 6, label: '1072 encima' },
    ...TAIL,
  ],
  // NO — EL MENSAJERO (16:9): acercarse → QUIETUD sobre el electrón solo (silencio,
  // contraste) → órbita AL REVÉS (variedad) por los conos de espín → COLA.
  no: [
    { shot: approachWide({ rFromMul: 1.55, rToMul: 1.32 }), dur: 12, label: 'acercarse' },
    { shot: staticBreath({ rMul: 1.4 }), dur: 6, label: 'el electrón solo' },
    { shot: heroOrbit({ dir: -1, span: 1.6, azim0: 2.4 }), dur: 9, label: 'conos de espín' },
    ...TAIL,
  ],
  // HCl — EL ÁCIDO: acercarse → la polaridad (héroe) → algo TORCIDO en "δ+ δ−"
  // (dutch, con moderación) → COLA.
  hcl: [
    { shot: approachWide({ rFromMul: 1.55, rToMul: 1.3 }), dur: 8, label: 'acercarse' },
    { shot: heroOrbit({ dir: 1, span: 1.6 }), dur: 10, label: 'polaridad' },
    { shot: dutchDrift({ rollAmp: 0.24 }), dur: 9, label: 'torcido' },
    ...TAIL,
  ],
  // H₂O — EL AGUA (TRIATÓMICO): viaje PROPIO (no la cola diatómica). El clímax es la
  // MOLÉCULA ENTERA ("disuelve, el hielo flota, no habría vida"), NO el núcleo → el
  // dive es corto y TARDÍO ("mira el corazón", l8), y la cámara se queda en la "V"
  // bent para el payoff. La firma: RECORRER EL ÁNGULO (edge-on→face-on: azim ~0 de
  // canto → ~π/2 de frente = la V de 104.5° se ABRE). Anclado a la voz (54s).
  h2o: [
    // V2: FRAME 1 = EL PICO (molécula ardiendo cerca) + MÁS MOVIMIENTO (feedback Ian:
    // "no se mueven lo suficiente") → órbitas AMPLIAS, un looming, buceo con más giro.
    // La cámara VUELA alrededor de la V bent, no la contempla quieta.
    { shot: heroOrbit({ dir: 1, azim0: 1.35, span: 1.6, elev: 0.18, rMul: 1.22 }), dur: 8.5, label: 'la gota ardiendo (l1)' },
    { shot: heroOrbit({ dir: 1, azim0: -0.25, span: 2.3, elev: 0.20, rMul: 1.4 }), dur: 11.5, label: 'abre el ángulo (l3)' },
    { shot: heroOrbit({ dir: -1, azim0: 2.0, span: 2.1, elev: 0.26, rMul: 1.36 }), dur: 8.5, label: 'los pares libres (l4-5)' },
    { shot: craneUnder({ azim0: 1.4, span: 1.0, elevTo: -0.44, rMul: 1.32 }), dur: 11.5, label: 'polar, domina (l6)' },
    { shot: loomPush({ rFrom: 1.55, rTo: 1.02, elev: 0.16, azim: 0.6 }), dur: 7.5, label: 'disuelve/flota — se viene encima (l7)' },
    { shot: diveToNucleus({ spin: 2.8 }), dur: 5.5, label: 'al corazón O (l8)' },
    { shot: nucleusOrbit({ span: 2.4 }), dur: 5, label: '8 protones' },
    { shot: pullOut({}), dur: 3, label: 'salida' },
    { shot: heroOrbit({ dir: 1, span: 1.7, rMul: 1.34 }), dur: 3.5, label: 'clímax (l9)' },
  ],
  // EL PUENTE (2 aguas) — la pieza Y SU VARIANTE DE CÁMARA viven aquí como DATOS.
  // (v1 de wpair creó constantes sueltas WPAIR_SHOTS/WPAIR_SHOTS_B + componente propio =
  // el reguero que Ian cachó. Una variante nueva = OTRA ENTRADA + ?cam=<x>, cero código.)
  // Duraciones IDÉNTICAS entre variantes → siguen clavadas a la voz (7,9,4,8,11,10,9,9,10).
  wpair: [
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 1.4, elev: 0.15, rMul: 1.58 }), dur: 7, label: 'espectáculo — plano de dos (l1-2)' },
    { shot: orbitOne({ side: 1, azim0: 0.8, span: 2.0, rMul: 0.5 }), dur: 9, label: 'electrones de UNA, close (l3-4)' },
    { shot: orbitOne({ side: -1, azim0: 2.5, span: 1.3, rMul: 0.5 }), dur: 4, label: 'probabilidad — nube de UNA, close (l5-6)' },
    { shot: orbitOne({ side: -1, azim0: 1.6, span: 1.8, rMul: 0.5 }), dur: 8, label: 'el corazón dorado O (l7-8)' },
    { shot: craneOverPair({ azim0: 1.3, span: 1.0, elevTo: -0.42, rMul: 1.5 }), dur: 11, label: 'cargas parciales — ángulo bajo (l9-11)' },
    { shot: twoShot({ dir: -1, azim0: 2.4, span: 1.7, elev: 0.22, rMul: 1.5 }), dur: 10, label: 'el campo — órbita (l12-14)' },
    { shot: pushToBridge({ rFrom: 1.7, rTo: 0.86, azim: 1.15 }), dur: 9, label: 'se acercan — looming al puente (l15-16)' },
    { shot: crashIn({ rMul: 1.02, azim0: 1.3, span: 1.1, elev: 0.06 }), dur: 9, label: 'el puente=nube — el enlace llena el cuadro (l17-18)' },
    { shot: pullOut({}), dur: 10, label: 'payoff (l19-20)' },
  ],
  // EL VIAJE ENTRE LOS ÁTOMOS (2026-08-27, spike de ian): MISMA simulación del rey, cero
  // re-cálculo — solo otra coreografía. Se activa con ?cam=viaje. La diferencia con el rey:
  // el rey MIRA desde fuera; este ATRAVIESA. `throughBridge` cruza el hueco entre las dos
  // moléculas (es el único plano que una diatómica no puede tener), y se usa DOS veces:
  // entrando y saliendo por el otro lado. Σ = 50 s (clip corto, no los 77 del rey).
  'wpair-viaje': [
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 1.0, elev: 0.15, rMul: 1.58 }), dur: 6, label: 'gancho: las dos' },
    { shot: throughBridge({ side: 1, rSpan: 0.78, off: 0.30 }), dur: 7, label: 'VIAJE: cruza entre ellas' },
    { shot: orbitOne({ side: 1, azim0: 0.8, span: 1.6, rMul: 0.5 }), dur: 8, label: 'qué ES una nube' },
    { shot: diveToNucleus({ spin: 1.6 }), dur: 7, label: 'clavado al corazón' },
    { shot: nucleusOrbit({}), dur: 7, label: 'por dentro del núcleo' },
    { shot: throughBridge({ side: -1, rSpan: 0.78, off: 0.30 }), dur: 6, label: 'sale volando por el otro lado' },
    { shot: craneOverPair({ azim0: 1.3, span: 1.0, elevTo: -0.42, rMul: 1.5 }), dur: 9, label: 'el ángulo: por qué 104.5°' },
  ],
  // LA SILLA VACÍA (2026-08-27): quick win del rey en 50 s. Verificado con 14 stills (vuelta
  // completa a cada oxígeno con el campo al 15 %): el lóbulo magenta de Δρ que RECIBE el puente
  // se ve claro en el oxígeno de side:-1 → esa es "la silla"; orbitOne(side:-1) la mira.
  // Σ = 50. Duraciones PROVISIONALES (recalibrar a los arranques reales de segs.json).
  wsilla: [
    // Arranques REALES de segs.json (voz 49.3 s): l1 0.4 · l2 4.2 · l3 7.0 · l4 9.7 · l5 13.7 ·
    // l6 16.2 · l7 20.2 · l8 25.2 · l9 30.7 · l10 35.6 · l11 40.6 · l12 46.1. Σ = 50.
    // Los primeros 7 s NO cortan (ley #6 del rey) y caen EXACTO en el arranque de l3.
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 1.0, elev: 0.15, rMul: 1.58 }), dur: 7.0, label: 'las dos se jalan · el jalón tiene domicilio (l1-2)' },
    { shot: orbitOne({ side: -1, azim0: 0.8, span: 1.6, rMul: 0.5 }), dur: 9.2, label: 'MAGENTA: el oxígeno de cerca, sus dos nubes, las sillas (l3-5)' },
    { shot: craneOverPair({ azim0: 1.3, span: 1.0, elevTo: -0.42, rMul: 1.5 }), dur: 4.0, label: 'el hidrógeno de la otra apunta justo ahí (l6)' },
    { shot: eyeLevelLock({ rMul: 1.15, azim: 1.2 }), dur: 5.0, label: 'QUITA LAS NUBES: nada, ni palito ni resorte (l7)' },
    { shot: pushToBridge({ rFrom: 1.7, rTo: 0.86, azim: 1.15 }), dur: 5.5, label: 'PRÉNDELAS: looming al puente, carga llegando a la silla (l8)' },
    { shot: crashIn({ rMul: 1.02, azim0: 1.3, span: 1.1, elev: 0.06 }), dur: 5.3, label: 'dos manos, dos sillas: cuatro (l9)' },
    { shot: pullOut({}), dur: 14.0, label: 'tetraedro · flota · y tú · GAIA (l10-12)' },
  ],
  // LA SILLA EN 16:9 (?cam=w, 2026-08-28): MISMAS tomas y MISMAS duraciones, radios apretados.
  // Por qué: la FOV de three.js es VERTICAL, así que al pasar de 9:16 a 16:9 el cuadro pierde
  // altura y el sujeto se queda del mismo tamaño angular con negro a los lados. Medido en el
  // primer render ancho: fill 0.252 y void máx 46.6 % (el vertical da 0.434/23.6 %; los
  // ganadores 0.74-0.82). Acercar es la cura; el canon prohíbe el void muerto.
  'wsilla-w': [
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 1.0, elev: 0.15, rMul: 0.95 }), dur: 7.0, label: 'las dos se jalan · el jalón tiene domicilio (l1-2)' },
    { shot: orbitOne({ side: -1, azim0: 0.8, span: 1.6, rMul: 0.32 }), dur: 9.2, label: 'MAGENTA: el oxígeno de cerca, sus dos nubes (l3-5)' },
    { shot: craneOverPair({ azim0: 1.3, span: 1.0, elevTo: -0.42, rMul: 0.92 }), dur: 4.0, label: 'el hidrógeno de la otra apunta justo ahí (l6)' },
    { shot: eyeLevelLock({ rMul: 0.72, azim: 1.2 }), dur: 5.0, label: 'QUITA LAS NUBES: nada (l7)' },
    { shot: pushToBridge({ rFrom: 1.05, rTo: 0.55, azim: 1.15 }), dur: 5.5, label: 'PRÉNDELAS: looming al puente (l8)' },
    { shot: crashIn({ rMul: 0.66, azim0: 1.3, span: 1.1, elev: 0.06 }), dur: 5.3, label: 'dos manos, dos sillas: cuatro (l9)' },
    { shot: pullOut({ rTdMul: 0.85 }), dur: 14.0, label: 'tetraedro · flota · y tú · GAIA (l10-12) — mismo arranque que el vertical, cierre MÁS CERCA (1.30→0.85) para no vaciar el cuadro ancho' },
  ],
  // EL ALCOHOL — el par NO es simétrico como el rey: el etanol es una masa grande (su esqueleto
  // de carbono) y el agua un blob compacto. Ese contraste ES la historia (un lado grasoso, un
  // lado con cara de agua), así que las tomas lo USAN en vez de disimularlo: se mira primero
  // al grande, luego al chico, y el puente nace entre los dos. orbitOne(side:-1) = el ALCOHOL.
  // Σ = 79 s y NUEVE tomas: la plantilla LITERAL del rey (canon §LAS LEYES DEL REY), no las
  // 7 tomas de 55 s del primer tanteo. El guion del alcohol tiene DOS payoffs (se mezcla con
  // el agua · agarra grasa) y en 55 s no cabían: 174 palabras = 79 s a 0.455 s/palabra.
  // Radios ~20 % más cerrados que el primer intento (los stills daban fill ~0.30 contra el
  // 0.74-0.82 de los ganadores) y fuera la toma de "el agua sola" a rMul 0.44, que se quedaba
  // SIN SUJETO en pantalla. El clímax (crashIn) cae en t=62 = 78 % del video, como el rey.
  // ═══ BRAZO B del experimento de RITMO (canon §EL RITMO, 2026-09-03) ═══
  // MISMO bin, MISMO guion, MISMA voz que wcampor (brazo A). Cambian SOLO dos perillas:
  //   · 21 tomas en 62 s = 19.4 cortes/min (A: 9 en 75 s = 6.4). Referencia externa 20-40.
  //   · VEL del TTS 1.25 (en el manifiesto) → la voz pasa de 73.6 s a ~59 s.
  // Los cortes se hacen ALTERNANDO ángulo (dir ±1, azim desfasado, side ±1) para que un corte
  // se LEA como corte y no como el mismo plano partido. Los beats son los de A escalados ×0.8;
  // se recalibran a segs.json en cuanto haya TTS. Duraciones PROVISIONALES.
  // La toma de "quita las nubes" (l09) se deja UNA sola a propósito: la NADA necesita quietud
  // — y así queda declarado que ahí el brazo B no corta, para no confundir el efecto.
  wcamporb: [
    // l01-04 · EL GANCHO: los dos campos encimados (0 → 11.5)
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 0.5, elev: 0.15, rMul: 1.10 }), dur: 3.51, label: 'B · gancho 1/4' },
    { shot: twoShot({ dir: -1, azim0: 2.4, span: 0.5, elev: 0.20, rMul: 1.05 }), dur: 3.51, label: 'B · gancho 2/4 (ángulo opuesto)' },
    { shot: craneOverPair({ azim0: 1.3, span: 0.4, elevTo: -0.40, rMul: 1.05 }), dur: 3.51, label: 'B · gancho 3/4 (grúa)' },
    { shot: twoShot({ dir: 1, azim0: 3.9, span: 0.5, elev: 0.10, rMul: 1.10 }), dur: 3.51, label: 'B · gancho 4/4' },
    // l05-06 · SOLO el positivo (11.5 → 16.4)
    { shot: orbitOne({ side: -1, azim0: 0.8, span: 0.6, rMul: 0.72 }), dur: 2.765, label: 'B · rojo, molécula A' },
    { shot: orbitOne({ side: 1, azim0: 2.5, span: 0.6, rMul: 0.72 }), dur: 2.765, label: 'B · rojo, molécula B' },
    // l07-08 · SOLO el negativo (16.4 → 22.2)
    { shot: orbitOne({ side: 1, azim0: 1.6, span: 0.6, rMul: 0.60 }), dur: 3.09, label: 'B · cian, cerca' },
    { shot: craneOverPair({ azim0: 2.6, span: 0.4, elevTo: -0.35, rMul: 1.05 }), dur: 3.09, label: 'B · cian, grúa' },
    // l09 · la nube PELADA — una sola toma, a propósito (22.2 → 26.5)
    { shot: eyeLevelLock({ rMul: 0.78, azim: 1.2 }), dur: 4.67, label: 'B · la NADA (sin cortar: la quietud es el argumento)' },
    // l10-13 · los dos otra vez + los números (26.5 → 37.9)
    { shot: twoShot({ dir: -1, azim0: 2.4, span: 0.5, elev: 0.20, rMul: 1.05 }), dur: 2.99, label: 'B · los dos 1/4' },
    { shot: crashIn({ rMul: 0.80, azim0: 1.3, span: 0.4, elev: 0.06 }), dur: 2.99, label: 'B · los dos 2/4 (crash)' },
    { shot: twoShot({ dir: 1, azim0: 0.4, span: 0.5, elev: 0.12, rMul: 1.10 }), dur: 2.99, label: 'B · los dos 3/4' },
    { shot: orbitOne({ side: -1, azim0: 3.0, span: 0.6, rMul: 0.72 }), dur: 3.0, label: 'B · los dos 4/4 (íntima)' },
    // l14-16 · la SUMA: lo que sobra (37.9 → 47.7)
    { shot: pushToBridge({ rFrom: 1.20, rTo: 0.70, azim: 1.15 }), dur: 3.24, label: 'B · suma 1/3 (looming)' },
    { shot: crashIn({ rMul: 0.80, azim0: 2.8, span: 0.4, elev: 0.06 }), dur: 3.24, label: 'B · suma 2/3' },
    { shot: eyeLevelLock({ rMul: 0.78, azim: 2.4 }), dur: 3.24, label: 'B · suma 3/3 (conecta)' },
    // l17-19 · payoff (47.7 → 62.0)
    { shot: pullOut({ rFromMul: 0.62, rTdMul: 0.95 }), dur: 2.378, label: 'B · payoff 1/5' },
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 0.5, elev: 0.15, rMul: 1.10 }), dur: 2.378, label: 'B · payoff 2/5' },
    { shot: orbitOne({ side: 1, azim0: 0.9, span: 0.6, rMul: 0.72 }), dur: 2.378, label: 'B · payoff 3/5' },
    { shot: twoShot({ dir: -1, azim0: 2.9, span: 0.5, elev: 0.20, rMul: 1.05 }), dur: 2.378, label: 'B · payoff 4/5' },
    { shot: pullOut({ rFromMul: 0.62, rTdMul: 0.95 }), dur: 2.378, label: 'B · payoff 5/5 + GAIA' },
  ],
  wcampor: [
    // DURACIONES CALIBRADAS a segs.json (2026-08-31), no a los cortes de cámara que puse a
    // ojo. Cada corte cae en el ARRANQUE de su línea (regla de §LA MECÁNICA DEL O₂). Lo que
    // lo obligó: con las ventanas provisionales, "Míralas acercarse hasta que el puente se
    // arma solo" (l10) caía DENTRO de la pantalla negra — la voz pedía mirar algo que no
    // estaba. Arranques: l1 0.40 · l3 10.01 · l5 18.00 · l7 27.66 · l9 38.10 · l11 46.33 ·
    // l12 51.45 · l14 59.71 · l16 66.48 · fin 79.00.
    // ⚠ EL `rMul` DE ESTAS TOMAS NO MANDA — y perder medio día con eso ya estaba advertido en
    // camera-shots.ts:39. `playShots` aplica la LEY DE ENCUADRE: mide rCore contra TODOS los
    // `pts` y clava la distancia en dMin = rCore/tan(SAFE·corto). Con el etanol esos puntos
    // incluyen la cola de carbono entera (~11 Å de punta a punta), así que dMin queda lejísimos
    // y CUALQUIER rMul por debajo da el MISMO cuadro. Probado: rMul 1.10, 0.605 y 0.08 dan
    // fill 0.171 idéntico en t=2. Los valores de abajo son los originales, sin maquillar.
    //
    // Quien acerque esta pieza tiene dos caminos: declarar `rCore` en la toma (lo que hace
    // ringOne en el hexámero) o `?zoom=`, que se aplica DESPUÉS de la ley. Aquí se usa zoom
    // 0.55, declarado en videos/mol-etoh-el-alcohol.json: barrido 0.45/0.55/0.65/0.75 con fill
    // medido en 7 tiempos. 0.45 llena más pero SACA al agua por el borde y ya no se pueden
    // CONTAR dos moléculas (canon §LEGIBILIDAD); 0.55 sube el tercio explicativo de 0.06 a
    // 0.17-0.20, deja el clímax en 0.50, y los dos protagonistas siguen legibles.
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 1.2, elev: 0.15, rMul: 1.10 }), dur: 14.4, label: 'AZUL: los dos, uno grande y uno chico — el hueco (l1-2)' },
    { shot: orbitOne({ side: -1, azim0: 0.8, span: 1.8, rMul: 0.72 }), dur: 8.07, label: 'MAGENTA: EL ALCOHOL, su cola de carbono (l3-4)' },
    { shot: craneOverPair({ azim0: 1.3, span: 1.0, elevTo: -0.40, rMul: 1.05 }), dur: 7.25, label: 'el hidroxilo: la cara de agua (l5-6)' },
    { shot: orbitOne({ side: -1, azim0: 2.1, span: 1.2, rMul: 0.60 }), dur: 5.41, label: 'ORO: el corazón dorado y sus dos sillas (l7-8)' },
    { shot: twoShot({ dir: -1, azim0: 2.4, span: 1.6, elev: 0.20, rMul: 1.05 }), dur: 6.54, label: 'AZUL: el campo real entre las dos (l9-10)' },
    { shot: eyeLevelLock({ rMul: 0.78, azim: 1.2 }), dur: 7.76, label: 'QUITA LAS NUBES: la NADA como argumento (l11)' },
    { shot: pushToBridge({ rFrom: 1.20, rTo: 0.70, azim: 1.15 }), dur: 7.61, label: 'PRÉNDELAS: rampa de looming al puente (l12)' },
    { shot: crashIn({ rMul: 0.80, azim0: 1.3, span: 1.1, elev: 0.06 }), dur: 8.31, label: 'CLÍMAX (t=62 = 78 %): el 96 % y por qué se mezcla (l13-15)' },
    { shot: pullOut({ rFromMul: 0.62, rTdMul: 0.95 }), dur: 9.65, label: 'payoff: una mano al agua, otra a la grasa + GAIA (l16-18)' },
  ],
  wcolor: [
    // DURACIONES CALIBRADAS a segs.json (2026-08-31), no a los cortes de cámara que puse a
    // ojo. Cada corte cae en el ARRANQUE de su línea (regla de §LA MECÁNICA DEL O₂). Lo que
    // lo obligó: con las ventanas provisionales, "Míralas acercarse hasta que el puente se
    // arma solo" (l10) caía DENTRO de la pantalla negra — la voz pedía mirar algo que no
    // estaba. Arranques: l1 0.40 · l3 10.01 · l5 18.00 · l7 27.66 · l9 38.10 · l11 46.33 ·
    // l12 51.45 · l14 59.71 · l16 66.48 · fin 79.00.
    // ⚠ EL `rMul` DE ESTAS TOMAS NO MANDA — y perder medio día con eso ya estaba advertido en
    // camera-shots.ts:39. `playShots` aplica la LEY DE ENCUADRE: mide rCore contra TODOS los
    // `pts` y clava la distancia en dMin = rCore/tan(SAFE·corto). Con el etanol esos puntos
    // incluyen la cola de carbono entera (~11 Å de punta a punta), así que dMin queda lejísimos
    // y CUALQUIER rMul por debajo da el MISMO cuadro. Probado: rMul 1.10, 0.605 y 0.08 dan
    // fill 0.171 idéntico en t=2. Los valores de abajo son los originales, sin maquillar.
    //
    // Quien acerque esta pieza tiene dos caminos: declarar `rCore` en la toma (lo que hace
    // ringOne en el hexámero) o `?zoom=`, que se aplica DESPUÉS de la ley. Aquí se usa zoom
    // 0.55, declarado en videos/mol-etoh-el-alcohol.json: barrido 0.45/0.55/0.65/0.75 con fill
    // medido en 7 tiempos. 0.45 llena más pero SACA al agua por el borde y ya no se pueden
    // CONTAR dos moléculas (canon §LEGIBILIDAD); 0.55 sube el tercio explicativo de 0.06 a
    // 0.17-0.20, deja el clímax en 0.50, y los dos protagonistas siguen legibles.
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 1.2, elev: 0.15, rMul: 1.10 }), dur: 7.5, label: 'AZUL: los dos, uno grande y uno chico — el hueco (l1-2)' },
    { shot: orbitOne({ side: -1, azim0: 0.8, span: 1.8, rMul: 0.72 }), dur: 7.61, label: 'MAGENTA: EL ALCOHOL, su cola de carbono (l3-4)' },
    { shot: craneOverPair({ azim0: 1.3, span: 1.0, elevTo: -0.40, rMul: 1.05 }), dur: 9.14, label: 'el hidroxilo: la cara de agua (l5-6)' },
    { shot: orbitOne({ side: -1, azim0: 2.1, span: 1.2, rMul: 0.60 }), dur: 8.95, label: 'ORO: el corazón dorado y sus dos sillas (l7-8)' },
    { shot: twoShot({ dir: -1, azim0: 2.4, span: 1.6, elev: 0.20, rMul: 1.05 }), dur: 6.6, label: 'AZUL: el campo real entre las dos (l9-10)' },
    { shot: eyeLevelLock({ rMul: 0.78, azim: 1.2 }), dur: 4.85, label: 'QUITA LAS NUBES: la NADA como argumento (l11)' },
    { shot: pushToBridge({ rFrom: 1.20, rTo: 0.70, azim: 1.15 }), dur: 6.68, label: 'PRÉNDELAS: rampa de looming al puente (l12)' },
    { shot: crashIn({ rMul: 0.80, azim0: 1.3, span: 1.1, elev: 0.06 }), dur: 6.69, label: 'CLÍMAX (t=62 = 78 %): el 96 % y por qué se mezcla (l13-15)' },
    { shot: pullOut({ rTdMul: 0.95 }), dur: 13.98, label: 'payoff: una mano al agua, otra a la grasa + GAIA (l16-18)' },
  ],
  wcampo: [
    // DURACIONES CALIBRADAS a segs.json (2026-08-31), no a los cortes de cámara que puse a
    // ojo. Cada corte cae en el ARRANQUE de su línea (regla de §LA MECÁNICA DEL O₂). Lo que
    // lo obligó: con las ventanas provisionales, "Míralas acercarse hasta que el puente se
    // arma solo" (l10) caía DENTRO de la pantalla negra — la voz pedía mirar algo que no
    // estaba. Arranques: l1 0.40 · l3 10.01 · l5 18.00 · l7 27.66 · l9 38.10 · l11 46.33 ·
    // l12 51.45 · l14 59.71 · l16 66.48 · fin 79.00.
    // ⚠ EL `rMul` DE ESTAS TOMAS NO MANDA — y perder medio día con eso ya estaba advertido en
    // camera-shots.ts:39. `playShots` aplica la LEY DE ENCUADRE: mide rCore contra TODOS los
    // `pts` y clava la distancia en dMin = rCore/tan(SAFE·corto). Con el etanol esos puntos
    // incluyen la cola de carbono entera (~11 Å de punta a punta), así que dMin queda lejísimos
    // y CUALQUIER rMul por debajo da el MISMO cuadro. Probado: rMul 1.10, 0.605 y 0.08 dan
    // fill 0.171 idéntico en t=2. Los valores de abajo son los originales, sin maquillar.
    //
    // Quien acerque esta pieza tiene dos caminos: declarar `rCore` en la toma (lo que hace
    // ringOne en el hexámero) o `?zoom=`, que se aplica DESPUÉS de la ley. Aquí se usa zoom
    // 0.55, declarado en videos/mol-etoh-el-alcohol.json: barrido 0.45/0.55/0.65/0.75 con fill
    // medido en 7 tiempos. 0.45 llena más pero SACA al agua por el borde y ya no se pueden
    // CONTAR dos moléculas (canon §LEGIBILIDAD); 0.55 sube el tercio explicativo de 0.06 a
    // 0.17-0.20, deja el clímax en 0.50, y los dos protagonistas siguen legibles.
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 1.2, elev: 0.15, rMul: 1.10 }), dur: 13.71, label: 'AZUL: los dos, uno grande y uno chico — el hueco (l1-2)' },
    { shot: orbitOne({ side: -1, azim0: 0.8, span: 1.8, rMul: 0.72 }), dur: 6.08, label: 'MAGENTA: EL ALCOHOL, su cola de carbono (l3-4)' },
    { shot: craneOverPair({ azim0: 1.3, span: 1.0, elevTo: -0.40, rMul: 1.05 }), dur: 6.87, label: 'el hidroxilo: la cara de agua (l5-6)' },
    { shot: orbitOne({ side: -1, azim0: 2.1, span: 1.2, rMul: 0.60 }), dur: 5.78, label: 'ORO: el corazón dorado y sus dos sillas (l7-8)' },
    { shot: twoShot({ dir: -1, azim0: 2.4, span: 1.6, elev: 0.20, rMul: 1.05 }), dur: 6.5, label: 'AZUL: el campo real entre las dos (l9-10)' },
    { shot: eyeLevelLock({ rMul: 0.78, azim: 1.2 }), dur: 7.32, label: 'QUITA LAS NUBES: la NADA como argumento (l11)' },
    { shot: pushToBridge({ rFrom: 1.20, rTo: 0.70, azim: 1.15 }), dur: 7.57, label: 'PRÉNDELAS: rampa de looming al puente (l12)' },
    { shot: crashIn({ rMul: 0.80, azim0: 1.3, span: 1.1, elev: 0.06 }), dur: 8.31, label: 'CLÍMAX (t=62 = 78 %): el 96 % y por qué se mezcla (l13-15)' },
    { shot: pullOut({ rTdMul: 0.95 }), dur: 7.86, label: 'payoff: una mano al agua, otra a la grasa + GAIA (l16-18)' },
  ],
  wetanol: [
    // DURACIONES CALIBRADAS a segs.json (2026-08-31), no a los cortes de cámara que puse a
    // ojo. Cada corte cae en el ARRANQUE de su línea (regla de §LA MECÁNICA DEL O₂). Lo que
    // lo obligó: con las ventanas provisionales, "Míralas acercarse hasta que el puente se
    // arma solo" (l10) caía DENTRO de la pantalla negra — la voz pedía mirar algo que no
    // estaba. Arranques: l1 0.40 · l3 10.01 · l5 18.00 · l7 27.66 · l9 38.10 · l11 46.33 ·
    // l12 51.45 · l14 59.71 · l16 66.48 · fin 79.00.
    // ⚠ EL `rMul` DE ESTAS TOMAS NO MANDA — y perder medio día con eso ya estaba advertido en
    // camera-shots.ts:39. `playShots` aplica la LEY DE ENCUADRE: mide rCore contra TODOS los
    // `pts` y clava la distancia en dMin = rCore/tan(SAFE·corto). Con el etanol esos puntos
    // incluyen la cola de carbono entera (~11 Å de punta a punta), así que dMin queda lejísimos
    // y CUALQUIER rMul por debajo da el MISMO cuadro. Probado: rMul 1.10, 0.605 y 0.08 dan
    // fill 0.171 idéntico en t=2. Los valores de abajo son los originales, sin maquillar.
    //
    // Quien acerque esta pieza tiene dos caminos: declarar `rCore` en la toma (lo que hace
    // ringOne en el hexámero) o `?zoom=`, que se aplica DESPUÉS de la ley. Aquí se usa zoom
    // 0.55, declarado en videos/mol-etoh-el-alcohol.json: barrido 0.45/0.55/0.65/0.75 con fill
    // medido en 7 tiempos. 0.45 llena más pero SACA al agua por el borde y ya no se pueden
    // CONTAR dos moléculas (canon §LEGIBILIDAD); 0.55 sube el tercio explicativo de 0.06 a
    // 0.17-0.20, deja el clímax en 0.50, y los dos protagonistas siguen legibles.
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 1.2, elev: 0.15, rMul: 1.10 }), dur: 10.01, label: 'AZUL: los dos, uno grande y uno chico — el hueco (l1-2)' },
    { shot: orbitOne({ side: -1, azim0: 0.8, span: 1.8, rMul: 0.72 }), dur: 7.99, label: 'MAGENTA: EL ALCOHOL, su cola de carbono (l3-4)' },
    { shot: craneOverPair({ azim0: 1.3, span: 1.0, elevTo: -0.40, rMul: 1.05 }), dur: 9.66, label: 'el hidroxilo: la cara de agua (l5-6)' },
    { shot: orbitOne({ side: -1, azim0: 2.1, span: 1.2, rMul: 0.60 }), dur: 10.44, label: 'ORO: el corazón dorado y sus dos sillas (l7-8)' },
    { shot: twoShot({ dir: -1, azim0: 2.4, span: 1.6, elev: 0.20, rMul: 1.05 }), dur: 8.23, label: 'AZUL: el campo real entre las dos (l9-10)' },
    { shot: eyeLevelLock({ rMul: 0.78, azim: 1.2 }), dur: 5.12, label: 'QUITA LAS NUBES: la NADA como argumento (l11)' },
    { shot: pushToBridge({ rFrom: 1.20, rTo: 0.70, azim: 1.15 }), dur: 8.26, label: 'PRÉNDELAS: rampa de looming al puente (l12)' },
    { shot: crashIn({ rMul: 0.80, azim0: 1.3, span: 1.1, elev: 0.06 }), dur: 6.77, label: 'CLÍMAX (t=62 = 78 %): el 96 % y por qué se mezcla (l13-15)' },
    { shot: pullOut({ rTdMul: 0.95 }), dur: 12.52, label: 'payoff: una mano al agua, otra a la grasa + GAIA (l16-18)' },
  ],
  // LA SAL (2026-08-26): Na⁺ (índice 0, en −x) + agua (O en +x). Hermana literal del rey: mismo
  // eje, mismo régimen (~13 bohr), mismas 9 tomas. `orbitOne(side:-1)` mira al ION, `side:+1` al agua.
  wsal: [
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 1.4, elev: 0.15, rMul: 1.58 }), dur: 7, label: 'espectáculo — el ion y el agua (l1-2)' },
    { shot: orbitOne({ side: -1, azim0: 0.8, span: 2.0, rMul: 0.5 }), dur: 9, label: 'EL ION solo: un electrón de menos (l3-4)' },
    { shot: orbitOne({ side: 1, azim0: 2.5, span: 1.3, rMul: 0.5 }), dur: 4, label: 'el agua (l5-6)' },
    { shot: orbitOne({ side: 1, azim0: 1.6, span: 1.8, rMul: 0.5 }), dur: 8, label: 'el corazón dorado O (l7-8)' },
    { shot: craneOverPair({ azim0: 1.3, span: 1.0, elevTo: -0.42, rMul: 1.5 }), dur: 11, label: 'el campo del ion — ángulo bajo (l9-11)' },
    { shot: twoShot({ dir: -1, azim0: 2.4, span: 1.7, elev: 0.22, rMul: 1.5 }), dur: 10, label: 'el agua se voltea — órbita (l12-14)' },
    { shot: pushToBridge({ rFrom: 1.7, rTo: 0.86, azim: 1.15 }), dur: 9, label: 'se acercan — looming (l15-16)' },
    { shot: crashIn({ rMul: 1.02, azim0: 1.3, span: 1.1, elev: 0.06 }), dur: 9, label: 'se pega — la nube llena el cuadro (l17-18)' },
    { shot: pullOut({}), dur: 10, label: 'payoff (l19-20)' },
  ],
  // LA CAZADORA (v10, sitio activo) — tomas del PUENTE, porque es su hermana literal: el
  // Fe en el ORIGEN y el O₂ sobre +X = la convención `nucX` que ya usa el dímero. `pts` =
  // el trío (Fe,O,O), así que orbitOne(side:-1) mira al HIERRO y side:+1 a la presa.
  // Duraciones PROVISIONALES (Σ = 77): recalibrar a los segundos reales de segs.json.
  hemo: [
    { shot: twoShot({ dir: 1, azim0: 0.7, span: 1.3, elev: 0.16, rMul: 1.50 }), dur: 8, label: 'espectáculo: hierro y presa (l1-2)' },
    { shot: orbitOne({ side: -1, azim0: 0.9, span: 1.9, rMul: 0.50 }), dur: 8, label: 'EL HIERRO solo, close (l3-4)' },
    { shot: craneOverPair({ azim0: 1.2, span: 1.0, elevTo: -0.40, rMul: 1.45 }), dur: 10, label: 'el imán que no cabe — ángulo bajo (l5-7)' },
    { shot: twoShot({ dir: -1, azim0: 2.3, span: 1.6, elev: 0.22, rMul: 1.45 }), dur: 9, label: 'llega la presa (l8-9)' },
    { shot: pushToBridge({ rFrom: 1.65, rTo: 0.80, azim: 1.10 }), dur: 11, label: 'LA NUBE MORADA — looming al enlace (l10-12)' },
    { shot: crashIn({ rMul: 1.00, azim0: 1.3, span: 1.1, elev: 0.05 }), dur: 12, label: 'CLÍMAX: los imanes se apagan, el Fe entra (l13-15)' },
    { shot: orbitOne({ side: -1, azim0: 2.6, span: 1.5, rMul: 0.58 }), dur: 10, label: 'la palanca: jala la histidina (l16-17)' },
    { shot: pullOut({ rFromMul: 0.7 }), dur: 9, label: 'payoff: y esto pasó en ti (l18-20)' },
  ],
  // EL ANILLO (trímero, 3 aguas / 9 átomos). Cuenta lo que 2 aguas NO pueden:
  //  · COOPERATIVIDAD — los 3 puentes juntos ligan MÁS que la suma de los pares
  //    (medido: −2.05 kcal/mol = 11.8% del enlace; nace de 0.5% al cerrarse el anillo)
  //  · FRUSTRACIÓN por número impar — el anillo NO es plano (pucker |z| 0.33-0.46 bohr,
  //    medido del bin): una agua queda volteada. Se ve DE CANTO → esa es la toma firma.
  // Duraciones provisionales (77s): RECALIBRAR a los segundos reales de segs.json
  // cuando exista la narración (CANON-VIDEO §sincronía).
  // DURACIONES = los ARRANQUES REALES de la voz, con los huecos incluidos (2026-07-28).
  // BUG que estuvo entregado: `playShots` encadena por SUMA ACUMULADA de `dur`, pero aquí
  // estaban los ANCHOS de cada ventana del manifiesto SIN los 0.4 s de hueco entre líneas.
  // Resultado: cada toma arrancaba 0.4·i segundos ANTES que su línea (−3.7 s al final), las
  // capas quedaban desfasadas de las tomas (las flechas del dipolo entraban 2.5 s tarde y se
  // derramaban a la toma siguiente), y como Σ dur = 90.3 < WTRI_DURATION = 94, los últimos
  // 3.7 s la cámara quedaba CONGELADA por el clamp de playShots. Ahora dur[i] = ini[i+1]−ini[i].
  // DISTANCIAS Y ÁNGULOS DELIBERADAMENTE DISTINTOS (Ian, 2026-07-28: "en algún momento ya se
  // siente demasiado repetido"). MEDIDO sobre el 1080 entregado con autocorrelación del ritmo
  // visual: pico en 23 s, y los pares más parecidos son t=59.5≈t=73.2 (similitud 1.99),
  // t=51≈t=73 y t=51≈t=59.5 — o sea que del segundo 41 al 80 CUATRO tomas daban casi la misma
  // imagen, porque todas caían en la misma banda de distancia (1.0-1.55) y elevación parecida.
  // Ahora el tramo tiene ritmo de ESCALA: ENCIMA (0.92) → medio (1.16) → LEJOS y de canto
  // (1.92, elev 0.03) → CRASH muy cerca (0.74). Cada toma se ve distinta de sus vecinas.
  wtri: [
    // CORTE 2026-07-28 (Ian: "es muy largo y tarda mucho para llegar a los vectores"). Fuera 7
    // líneas de relleno — la firma pasa del segundo 59.6 al 42.8 y el video de 92 a 72.9 s.
    // `eyeLevelLock` se quedó SIN líneas al cortar el beat del dato y se elimina: además era
    // una de las cuatro tomas que caían en la misma banda de distancia y se parecían entre sí.
    // Ritmo de ESCALA deliberado: encima (0.92) → lejos y de canto (1.92) → crash (0.74).
    { shot: ringWide({ rMul: 1.14, azim0: 0.55, span: 1.0, elev: 0.30, fov: 34 }), dur: 10.91, label: 'las TRES separadas — que se CUENTEN 3' },
    { shot: ringOne({ which: 0, rMul: 1.05, azim0: 0.7, span: 1.4, fov: 21 }), dur: 8.34, label: 'una sola en teleobjetivo (fuera de la nube)' },
    { shot: ringFaceOn({ rMul: 1.45, span: 0.5 }), dur: 8.89, label: 'DE FRENTE: el anillo entero con aire' },
    { shot: ringToBridge({ a: 0, b: 1, rFrom: 1.5, rTo: 1.12, azim: 0.9, fov: 30 }), dur: 5.29, label: 'el PUENTE entre dos (sin entrar a la nube)' },
    { shot: ringFaceOn({ rMul: 1.30, azim0: 1.35, span: 0.45, elev: 0.12 }), dur: 4.46, label: 'el anillo CIERRA — se ven las tres' },
    { shot: loomPush({ rFrom: 1.62, rTo: 0.92, elev: 0.34, azim: 1.1, fov: 32 }), dur: 8.49, label: 'COOPERATIVIDAD: SE VIENE ENCIMA' },
    { shot: ringEdgeToFace({ rMul: 1.92, elev: 0.03, span: 0.62 }), dur: 12.27, label: 'FIRMA: DE CANTO real y lejos → se ve que una quedó al revés' },
    { shot: crashIn(), dur: 7.62, label: 'aguanta más — CRASH IN' },
    { shot: pullOut({ azim0: 0.9, span: 1.2, rFromMul: 0.72, rTdMul: 1.42 }), dur: 11.41, label: 'payoff — SALE del anillo (no de dentro de la nube)' },
  ],
  // EL CUARTETO (tetrámero, 4 aguas / 12 átomos). Cuenta lo que el trímero NO puede:
  //  · ENCAJA — con N par los H libres alternan arriba-abajo todo el ciclo, así que el anillo
  //    se aplana y el optimizador deja los 4 puentes IDÉNTICOS (2.841 Å ×4, medido; en el
  //    trímero salieron 2.888/2.880/2.874 = los tres distintos).
  //  · COOPERATIVIDAD casi DOBLE — 18.7% del enlace contra 11.8% del trímero.
  // MISMAS TOMAS que el anillo: son genéricas en N, se reusan tal cual (Regla #0). La FIRMA
  // sigue siendo ringEdgeToFace, pero aquí dice lo OPUESTO: ahí se veía la volteada, aquí se
  // ve que por fin es PLANO. Misma imagen, significado invertido — ese es el remate.
  // ⚠ DURACIONES PROVISIONALES (copiadas del anillo, Σ=77.7) para poder verificar ENCUADRE en
  // still 4K antes de grabar. RECALIBRAR a los arranques REALES de segs.json en cuanto exista
  // la voz: dur[i] = ini[i+1] − ini[i], NO los anchos de ventana (ese bug estuvo entregado).
  // ⚡ IN MEDIAS RES (Ian, 2026-07-31): "lo que me gustó fue la imagen, la voz, el color y las
  // flechas — ESA ESCENA DEBERÍA ESTAR AL INICIO". Tenía razón y el canon lo dice igual:
  // "Frame 1 = el pico, abrir con la molécula FORMADA ardiendo, nada de fade-in tímido".
  // El corte anterior guardaba su mejor imagen para el segundo 40 y abría con el anillo
  // ABIERTO — que no cabe en 9:16, se recorta y no se pueden contar cuatro.
  //
  // Ahora la toma 1 REPRODUCE el estado que tenía el viejo t=40, no una versión parecida:
  // misma cámara (ringEdgeToFace de canto), anillo CERRADO (apertura 0.10), flechas del
  // dipolo encendidas, nubes al 66 % para que las flechas se lean, campo en su base 0.55.
  // Ver WTET_CAPAS, donde cada uno de esos valores está puesto para caer en t=0.
  //
  // DURACIONES REALES de segs.json (dur[i] = arranque[i+1] − arranque[i], con los huecos de
  // respiración incluidos — NO los anchos de ventana: ese bug estuvo entregado en el anillo y
  // congelaba la cámara al final). Σ = 88.00 = WTET_DURATION.
  // Ritmo de ESCALA: de canto cerca (1.72) → de canto lejos (1.95) → de frente (1.46) →
  // teleobjetivo a UNA (0.98) → puente (1.12) → encima (0.92) → crash (0.74) → salida.
  wtet: [
    { shot: ringEdgeToFace({ rMul: 1.72, elev: 0.10, span: 0.34 }), dur: 6.93, label: 'EL GANCHO — de canto, cerrado, las 4 flechas (era el segundo 40)' },
    { shot: ringEdgeToFace({ rMul: 1.95, elev: 0.03, span: 0.42 }), dur: 6.59, label: 'de canto y MÁS LEJOS: se ve que es plano de verdad' },
    { shot: ringFaceOn({ rMul: 1.46, azim0: 0.2, span: 0.55, elev: 0.24 }), dur: 4.92, label: 'la otra vez viste tres / tres no encajaban — el anillo se ABRE' },
    { shot: ringFaceOn({ rMul: 1.30, azim0: 2.4, span: 0.7, elev: 0.36 }), dur: 7.92, label: 'impar, una al revés, con cuatro no' },
    { shot: ringOne({ which: 0, rMul: 0.98, azim0: 0.7, span: 1.5, fov: 21 }), dur: 7.48, label: 'LEGIBILIDAD: un O y dos H = UNA molécula' },
    { shot: ringToBridge({ a: 0, b: 1, rFrom: 1.5, rTo: 1.12, azim: 0.9, fov: 30 }), dur: 8.06, label: 'se acomodan: presta y recibe — el puente es NUBE' },
    { shot: ringFaceOn({ rMul: 1.24, azim0: 1.35, span: 0.5, elev: 0.10 }), dur: 8.33, label: 'los 4 puentes — el cálculo los da IDÉNTICOS' },
    { shot: ringFaceOn({ rMul: 1.44, azim0: 3.3, span: 0.45, elev: 0.30 }), dur: 3.78, label: 'contraste: en el trímero ninguno medía igual' },
    { shot: loomPush({ rFrom: 1.62, rTo: 0.92, elev: 0.34, azim: 1.1, fov: 32 }), dur: 7.09, label: 'COOPERATIVIDAD: se viene encima' },
    { shot: ringEdgeToFace({ rMul: 1.80, elev: 0.08, span: 0.38 }), dur: 10.56, label: 'VUELVE la firma con los números: 12% a 19%, +28% por agua' },
    // ⚠ `rFrom`/`rTo` NO EXISTEN en crashIn (su firma es rMul/elev/azim0/span/fov) → esbuild
    // los tira sin avisar (vite build NO corre tsc) y esta toma rindió con los DEFAULTS. La
    // pieza entregada es esa, así que los valores se quedan; pero NO los copies: para acercar
    // el crash se usa `rMul`. Ver whex6 más abajo, que ya usa la firma real.
    { shot: crashIn(), dur: 3.82, label: 'física cuántica real — CRASH IN (rindió con defaults, ver aviso)' },
    { shot: pullOut({ azim0: 0.9, span: 1.2, rFromMul: 0.72, rTdMul: 1.42 }), dur: 12.52, label: 'payoff — SALE del anillo, gancho abierto al hexámero' },
  ],
  // EL HEXÁGONO (H₂O)₆ — mismos builders que el cuarteto (son genéricos en N), otra SECUENCIA.
  //
  // LA DIFERENCIA DE DISEÑO con wtet, y es del guion: el gancho del cuarteto era "de canto,
  // es plano" → ringEdgeToFace en el frame 0. Aquí la línea 1 es «cuenta las puntas de un copo
  // … ahora cuenta los LADOS de esto» → el frame 0 tiene que ser DE FRENTE o no hay nada que
  // contar. Lo plano pasa a ser un beat propio (t46.5, la voz lo pide literal: «míralo de canto»).
  //
  // DURACIONES = arranques REALES de segs.json (dur[i] = ini[i+1] − ini[i], NO los anchos de
  // ventana: ese bug estuvo entregado en el anillo). Σ = 94.55 = WHEX6_DURATION.
  // RIMA: la toma 15 vuelve al hexágono de frente justo en «repite esta misma forma de seis»
  // — el mismo encuadre del frame 0, para que el ojo cierre el círculo antes que la voz.
  // EL HEXÁGONO v2 — REESTRUCTURADO (Ian, 2026-08-04: "el destello del campo debería ser el
  // inicio; todo lo del 0-27 ponlo al final"). El bloque que abría —contar las puntas del
  // copo— ahora CIERRA, y ahí gana: deja de ser la premisa y se vuelve la PRUEBA.
  //
  // ⚠ LO QUE IMPACTA ES UNA TRANSICIÓN, NO UN ESTADO. Lo que Ian vio en el viejo segundo 28
  // fue el campo ENCENDIÉNDOSE (campo 0.55 → 1.05). Mover la cámara de esa toma al frente sin
  // mover el ENCENDIDO no reproduce nada: por eso `campo` arranca en 0.25 y sube a 1.20 con la
  // rampa de 0.6s de `win()` — el destello ocurre entre t=0.4 y t=1.0, sobre la primera frase.
  //
  // El verificador de atención (atencion-verify.py) dijo que el tramo 27-35 NO era el pico
  // (5.25 vs 6.00 del "de canto") y que el valle real era 52-67, la cooperatividad. Ian tiene
  // el voto de calidad (el canon: 65% ojo / 35% métricas), pero el valle SÍ se ataca: la
  // cooperatividad ahora trae loomPush + la firma de canto + un cierre que aprieta, en vez de
  // tres planos parecidos mientras la voz recita números.
  //
  // DURACIONES = arranques REALES de segs.json (voz 95.24s). Σ = 97.74 = WHEX6_DURATION.
  // BUTÍRICO — la grasa mínima de la mantequilla. Tomas con la MISMA gramática del hexámero
  // (heroOrbit/ringFaceOn del registro), no un modo automático: sin entrada aquí la cámara
  // caía al modo por defecto y dejaba el sujeto en un tercio del cuadro (83 % de negro contra
  // el 36 % del hexámero, medido). Los rMul son los suyos porque `ex` usa su mismo ratio 2.38.
  // BUTÍRICO — duraciones = arranques REALES de segs.json (voz 83.88 s) + 2.5 de cola. Σ = 86.4.
  // La cámara ACOMPAÑA la apertura: lejos cuando los átomos están sueltos, cerrada cuando la
  // molécula se forma. `ex` está medido en la molécula FORMADA, así que el tramo abierto
  // necesita rMul grande — para eso es loomPush, la toma de la casa que mueve r dentro del beat.
  // rMul del tramo abierto MEDIDO, no estimado: con 5.0 esos 11 s salían al 91 % de negro (el
  // hexámero en su cuadro más abierto llega a 65 %). Con 3.35 los átomos llenan el cuadro.
  // BUTÍRICO — duraciones = arranques REALES de segs.json (voz 83.88 s) + 2.5 de cola. Σ = 86.4.
  // VIAJE, no sólo movimiento (Ian, 2026-08-06: "hay muy poco viaje, viajar entre las
  // moléculas"). `diveToNucleus` es la toma de la casa que ATRAVIESA —la del clavado de O₂—:
  // cae exponencialmente hasta la escala nuclear en espiral, y ahí el cuadro deja de ser una
  // órbita alrededor de una bolita y se vuelve un lugar por donde se pasa.
  // ⚠ throughBridge con rSpan 1.05 SALE POR EL OTRO LADO y se queda mirando el vacío: el 4K
  // del 7-ago tuvo 157 CUADROS 100 % NEGROS seguidos (t 69.9-75.1) por eso, agravado porque
  // el tránsito atenuaba las nubes en la misma ventana. Es el defecto que este archivo ya
  // documenta para pullOut ("11 s sin ningún sujeto en pantalla"). rSpan 0.58 = cruza pero
  // no se despega, y el tránsito baja a -0.42 ahí.
  // ⚠ Y el guardián de cuadro negro NO puede ser por TAMAÑO a 4K: un cuadro 100 % negro pesa
  // 200 KB porque el grano de película lo vuelve incompresible. Se verifica por PÍXELES.
  // ⚠ FIRMAS: pullOut es (rFromMul/rTdMul/fovFrom/fovTo/azim0/span) y throughBridge es
  // (side/rSpan/off/fov). Escribí rFrom/rTo/elev/rMul y esbuild los TIRA EN SILENCIO — el
  // mismo gotcha que este archivo ya documenta para crashIn. Copiar la firma, no suponerla.
  // BUTÍRICO — duraciones = arranques REALES de segs.json (voz 57.89 s) + 2.5 de cola. Σ = 60.4.
  //
  // REGLA DE ESTA LISTA: **toda toma apunta a la molécula.** El 4K del 7-ago salió con 162
  // cuadros 100 % NEGROS (157 seguidos) porque usé `throughBridge`, que vuela de UNA molécula
  // a la OTRA pasando por el puente: con un solo sujeto, la segunda mitad mira al vacío. No es
  // cosa de acortarle el rango — es la toma equivocada. Para "viaje" sin riesgo de cuadro
  // vacío: loomPush (dolly), diveToNucleus (entra, y su target MIGRA al núcleo) y whipParallax
  // (barrido lateral violento que SIEMPRE apunta al centro).
  butirico: [
    { shot: heroOrbit({ rMul: 1.95, elev: 0.14, azim0: 0.85, span: 0.55, fov: 34 }), dur: 11.66, label: 'GANCHO: la molécula HECHA — "esto huele a mantequilla" (l1-4)' },
    { shot: loomPush({ rFrom: 2.4, rTo: 3.35, elev: 0.18, azim: 1.30, fov: 35 }), dur: 7.34, label: 'REBOBINA y ABRE: los átomos sueltos, cada uno con su campo (l5-6)' },
    { shot: loomPush({ rFrom: 3.35, rTo: 1.95, elev: 0.10, azim: 1.75, fov: 34 }), dur: 12.14, label: 'LA FORMACIÓN: se juntan y la carga cae a los enlaces (l7-10)' },
    { shot: diveToNucleus({ rFromMul: 1.85, rTo: 0.78, fovFrom: 34, fovTo: 44, spin: 2.0 }), dur: 10.83, label: 'CLAVADO: entra con "0.87 electrones / trece enlaces" (l11-12)' },
    { shot: pullOut({ rFromMul: 0.78, rTdMul: 2.05, fovFrom: 44, fovTo: 34, azim0: 2.30, span: 1.2 }), dur: 4.29, label: 'SALE volando — "nada de esto está dibujado" (l13)' },
    { shot: whipParallax({ rMul: 1.62, elevAmp: 0.26, azim0: 2.60, span: 2.4, fov: 37 }), dur: 7.29, label: 'BARRIDO con parallax: "las líneas son el campo real" (l14)' },
    { shot: ringFaceOn({ rMul: 1.72, azim0: 1.50, span: 0.30, elev: 0.10 }), dur: 6.85, label: 'EL REMATE: "el olor de la mantequilla es esta forma" (l15-16)' },
  ],
  whex6: [
    { shot: ringToBridge({ a: 0, b: 1, rFrom: 1.30, rTo: 1.05, azim: 1.20, fov: 34 }), dur: 4.04, label: 'EL DESTELLO — el campo ENCIENDE sobre "mira cómo se agarran"' },
    { shot: ringToBridge({ a: 2, b: 3, rFrom: 1.45, rTo: 1.10, azim: 2.60, fov: 32 }), dur: 6.03, label: 'presta y recibe — otro puente, el Δρ ardiendo' },
    { shot: ringFaceOn({ rMul: 2.70, azim0: 1.50, span: 0.22, elev: 0.06 }), dur: 3.37, label: 'LOS SEIS a la vez: "seis puentes, encendiendo a la vez"' },
    { shot: loomPush({ rFrom: 2.30, rTo: 1.45, elev: 0.20, azim: 1.35, fov: 34 }), dur: 4.15, label: '"es carga eléctrica de verdad" — se viene encima' },
    { shot: ringFaceOn({ rMul: 2.55, azim0: 1.57, span: 0.24, elev: 0.05 }), dur: 3.27, label: 'de frente: el cálculo los da IDÉNTICOS' },
    { shot: ringFaceOn({ rMul: 2.40, azim0: 4.60, span: 0.30, elev: 0.10 }), dur: 4.39, label: '2.821 Å los seis — LA OTRA CARA, para que no sea truco de ángulo' },
    { shot: ringEdgeToFace({ rMul: 1.95, elev: 0.03, span: 0.20 }), dur: 4.50, label: 'DE CANTO y se queda de canto: el anillo es PLANO' },
    { shot: loomPush({ rFrom: 2.45, rTo: 1.30, elev: 0.34, azim: 0.85, fov: 33 }), dur: 5.52, label: 'VALLE ATACADO (1/3): "juntos jalan más" se viene ENCIMA' },
    { shot: ringEdgeToFace({ rMul: 2.05, elev: 0.10, span: 0.42 }), dur: 6.78, label: 'VALLE ATACADO (2/3): la firma abre mientras caen 12% y 19%' },
    { shot: ringFaceOn({ rMul: 2.60, azim0: 1.20, span: 0.46, elev: 0.18 }), dur: 6.17, label: 'VALLE ATACADO (3/3): 25% y "más se aprietan" — cierra a la cara' },
    { shot: crashIn({ rMul: 1.28, azim0: 1.20, span: 0.60, elev: 0.10 }), dur: 3.74, label: 'física cuántica real — CRASH IN' },
    { shot: ringFaceOn({ rMul: 2.30, azim0: 1.95, span: 0.30, elev: 0.12 }), dur: 5.24, label: '"la parte que importa" / "cuando el agua se congela"' },
    { shot: ringFaceOn({ rMul: 2.80, azim0: 1.57, span: 0.18, elev: 0.04 }), dur: 6.31, label: 'LA FORMA, limpia y de frente: "repite esta misma forma de seis"' },
    { shot: ringFaceOn({ rMul: 2.75, azim0: 1.45, span: 0.20, elev: 0.05 }), dur: 7.44, label: 'EL REMATE: "cuenta las puntas de un copo" / "cuenta los lados de esto"' },
    { shot: ringFaceOn({ rMul: 2.50, azim0: 1.70, span: 0.34, elev: 0.14 }), dur: 6.75, label: '"seis también / no es casualidad / son seis MOLÉCULAS"' },
    { shot: ringOne({ which: 0, rMul: 2.4, azim0: 0.7, span: 1.2, fov: 21, rCore: 2.6 }), dur: 7.52, label: 'H dos O — el close-up que solo existe con rCore (ver ringOne)' },
    { shot: ringFaceOn({ rMul: 2.60, azim0: 2.40, span: 0.40, elev: 0.20 }), dur: 6.22, label: '"la otra vez viste cuatro / seis encajan igual de bien"' },
    { shot: pullOut({ azim0: 1.57, span: 0.50, rFromMul: 2.60, rTdMul: 3.30 }), dur: 6.30, label: 'payoff — "no es adorno. Es esta forma, hecha grande"' },
  ],
  // ── CADENA "LA FORMA MANDA", pieza 1: EL CODO ───────────────────────────────────────────
  // Una entrada en CAMERA_SHOTS MANDA sobre el modo automático (molCamera revisa esta tabla
  // ANTES de decidir orbit-vs-traversal por elongación). Aquí eso es indispensable: la cadena
  // es larga, así que el automático elige TRAVERSAL y la cámara se mete DENTRO de la molécula.
  // Para el caroteno eso es correcto —el sujeto es el río π por el que se vuela—, pero aquí
  // el sujeto es la SILUETA: si la cámara va por dentro, el codo no existe.
  //
  // Medido en stills antes de rendir nada (que para eso son): con traversal se veían pedazos
  // sueltos de enlaces y CERO codo. Estas tomas miran desde AFUERA y de perfil, que es el
  // único ángulo donde un codo de 125.5° se lee.
  estearico: [
    { shot: heroOrbit({ rMul: 3.40, elev: 0.10, azim0: 1.35, span: 0.45, fov: 34 }), dur: 7, label: 'la vara completa, de perfil' },
    { shot: heroOrbit({ rMul: 3.10, elev: 0.28, azim0: 2.10, span: 0.65, fov: 34 }), dur: 8, label: 'gira despacio: sigue siendo recta desde cualquier lado' },
    { shot: heroOrbit({ rMul: 3.60, elev: 0.05, azim0: 0.60, span: 0.42, fov: 32 }), dur: 7, label: 'de canto — el zigzag del esqueleto' },
  ],
  oleico: [
    { shot: heroOrbit({ rMul: 3.40, elev: 0.10, azim0: 1.35, span: 0.45, fov: 34 }), dur: 7, label: 'EL CODO — mismo encuadre que el esteárico, para que la comparación sea justa' },
    { shot: heroOrbit({ rMul: 3.10, elev: 0.28, azim0: 2.10, span: 0.65, fov: 34 }), dur: 8, label: 'gira: el codo no se endereza desde ningún ángulo' },
    { shot: heroOrbit({ rMul: 3.60, elev: 0.05, azim0: 0.60, span: 0.42, fov: 32 }), dur: 7, label: 'de canto — se ve dónde vive el doble enlace' },
  ],
  'wpair-b': [
    { shot: twoShot({ dir: -1, azim0: 2.7, span: 1.9, elev: 0.5, rMul: 1.75 }), dur: 7, label: 'espectáculo — plano alto opuesto (l1-2)' },
    { shot: orbitOne({ side: -1, azim0: 3.4, span: 2.4, rMul: 0.44, elev: -0.15 }), dur: 9, label: 'electrones de la OTRA, close bajo (l3-4)' },
    { shot: orbitOne({ side: 1, azim0: 0.3, span: 1.7, rMul: 0.42, elev: 0.2 }), dur: 4, label: 'probabilidad — flip de molécula (l5-6)' },
    { shot: orbitOne({ side: 1, azim0: 2.2, span: 2.2, rMul: 0.48, elev: 0.35 }), dur: 8, label: 'el corazón dorado O — elevado (l7-8)' },
    { shot: craneOverPair({ azim0: 2.9, span: 1.5, elevFrom: 0.5, elevTo: -0.55, rMul: 1.35 }), dur: 11, label: 'cargas parciales — grúa profunda otro azimut (l9-11)' },
    { shot: twoShot({ dir: 1, azim0: 0.5, span: 2.3, elev: -0.12, rMul: 1.42 }), dur: 10, label: 'el campo — barrido bajo opuesto (l12-14)' },
    { shot: pushToBridge({ rFrom: 1.95, rTo: 0.8, azim: 2.6, elev: 0.12 }), dur: 9, label: 'se acercan — looming otro lado (l15-16)' },
    { shot: crashIn({ rMul: 1.05, azim0: 2.7, span: 1.5, elev: 0.2 }), dur: 9, label: 'el puente=nube — otro ángulo de choque (l17-18)' },
    { shot: pullOut({ azim0: 1.0, span: 1.4 }), dur: 10, label: 'payoff con órbita (l19-20)' },
  ],
  // EL SUDOR (2026-08-25): las 8 tomas de B + la SALIDA del rey. El pullOut con órbita de B
  // cruzaba un VACÍO del campo justo bajo la línea del payoff: 4.5 s al 8-13 % de pantalla
  // (medido en el master). La salida del rey (pullOut({})) remata al 80 %, que es la ley #5.
  'wpair-c': [
    { shot: twoShot({ dir: -1, azim0: 2.7, span: 1.9, elev: 0.5, rMul: 1.75 }), dur: 7, label: 'espectáculo — plano alto opuesto (l1-2)' },
    { shot: orbitOne({ side: -1, azim0: 3.4, span: 2.4, rMul: 0.44, elev: -0.15 }), dur: 9, label: 'electrones de la OTRA, close bajo (l3-4)' },
    { shot: orbitOne({ side: 1, azim0: 0.3, span: 1.7, rMul: 0.42, elev: 0.2 }), dur: 4, label: 'probabilidad — flip de molécula (l5-6)' },
    { shot: orbitOne({ side: 1, azim0: 2.2, span: 2.2, rMul: 0.48, elev: 0.35 }), dur: 8, label: 'el corazón dorado O — elevado (l7-8)' },
    { shot: craneOverPair({ azim0: 2.9, span: 1.5, elevFrom: 0.5, elevTo: -0.55, rMul: 1.35 }), dur: 11, label: 'cargas parciales — grúa profunda otro azimut (l9-11)' },
    { shot: twoShot({ dir: 1, azim0: 0.5, span: 2.3, elev: -0.12, rMul: 1.42 }), dur: 10, label: 'el campo — barrido bajo opuesto (l12-14)' },
    { shot: pushToBridge({ rFrom: 1.95, rTo: 0.8, azim: 2.6, elev: 0.12 }), dur: 9, label: 'se acercan — looming otro lado (l15-16)' },
    { shot: crashIn({ rMul: 1.05, azim0: 2.7, span: 1.5, elev: 0.2 }), dur: 9, label: 'el puente=nube — otro ángulo de choque (l17-18)' },
    { shot: pullOut({}), dur: 10, label: 'payoff — la salida del REY (B caía en un vacío)' },
  ],
};

function molCamera(t: number, f: Frame): Shot {
  if (f.dna) return dnaCamera(t, f);
  // GRAMÁTICA DE TOMAS (opt-in): si la molécula tiene lista, la cámara es
  // componible (variedad por pieza). Convención de núcleo: -nucX = átomo izquierdo
  // (el que la narración nombra), igual que la cámara a medida original.
  const shotList = f.mk ? CAMERA_SHOTS[f.mk] : undefined;
  // +nucX = átomo índice 1 = el B de els=(A,B): el PESADO que la voz nombra (Cl en
  // NaCl/HCl, O en CO/NO). Clavar ahí = "17 protones del cloro" se VE (no al H de 1).
  // Triatómico (H₂O): el corazón es el O en el ORIGEN → nucX=0.
  if (shotList) return playShots(shotList, t, { ex: f.ex, nucX: isTri(f.mk ?? '') ? 0 : (f.nucX ?? f.ex * 0.5), bondR: bondR(t, f.mk), t });
  const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
  const P = (s: number, o1: number, o2: number): Vec3 => [
    f.c[0] + f.a[0] * s + f.p1[0] * o1 + f.p2[0] * o2,
    f.c[1] + f.a[1] * s + f.p1[1] * o1 + f.p2[1] * o2,
    f.c[2] + f.a[2] * s + f.p1[2] * o1 + f.p2[2] * o2];

  // ── CAROTENO FLAGSHIP: la cámara VIAJA a lo largo del río π (más espacio para
  // viajar). roll pone la cadena VERTICAL → llena el 9:16 (truco O₂). Timeline 45s
  // sincronizado al nacimiento del color: crecer(0-13) → IGNICIÓN(13-19) → héroe
  // volando por el río(19-33) → revelar cadena completa + loop(33-45). ──
  if (f.mk === 'caroteno') {
    // VUELO CONTINUO POR DENTRO del río π (NO desde afuera): UNA sola trayectoria,
    // cero cortes. La cámara viaja A TRAVÉS de la cadena mirando hacia ADELANTE por
    // el eje → el río de electrones fluye hacia nosotros y LLENA la pantalla (como el
    // clavado de O₂, pero a lo largo de la cadena = "más espacio para viajar").
    const L = Math.max(f.L, 0.8);
    const k = ease(t / 45);                          // barrido único suave (sin fases → sin costuras)
    // CAÑÓN DE ORO: cámara MUY cerca del eje viendo pocos carbonos → las cintas π
    // gruesas ENVUELVEN y llenan el cuadro. roll=π/2 → cadena VERTICAL (llena el 9:16).
    // dolly continuo por toda la cadena + órbita lenta alrededor del eje (parallax, vida,
    // sensación de estar ADENTRO viajando). Cero cortes (funciones puras de t).
    // VUELA CON el frente de formación: la cámara avanza mientras la cadena CRECE
    // adelante (el reveal va un poco por delante → siempre estamos en el oro ya
    // formado, nunca en el vacío). De un extremo (formación) hacia el otro.
    const s = lerp(-0.9 * L, 0.6 * L, k);
    const d = 3.2;                                    // bohr: cerca (cañón), 2-3 carbonos, cintas gruesas
    const ph = 0.6 + t * 0.13;                        // órbita lenta alrededor del eje (parallax 3D)
    return {
      pos: P(s, Math.cos(ph) * d, Math.sin(ph) * d),
      target: P(s, 0, 0),                             // mira al eje (siempre hay río alrededor)
      fov: 46,
      roll: Math.PI / 2 + 0.12 * Math.sin(t * 0.1),   // cadena VERTICAL + micro-vaivén con peso
    };
  }

  if (f.chain) {
    // DOLLY AL COSTADO, LENTO: la cámara viaja a lo largo de la cadena a un standoff
    // perpendicular GRANDE (cadena COMPLETA en cuadro) y orbita SUAVE — la cadena
    // pasa de lado como cuerda luminosa, con tiempo de respirar. Sin barril.
    const L = Math.max(f.L, 0.6), Rp = Math.max(f.Rp, 0.6);
    const stand = Math.max(Rp * 3.0, L * 0.7);
    if (t < 4.5) {                                  // ABRE — entra LENTO desde un extremo
      const k = ease(t / 4.5);
      const s = lerp(-L * 1.3, -L * 0.9, k), off = lerp(stand * 1.5, stand, k), ph = 0.4 + k * 0.5;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: lerp(40, 36, k),
        target: P(s * 0.5, 0, 0), roll: 0.06 * Math.sin(t * 0.6) };
    } else if (t < 12.0) {                           // VIAJA — dolly LENTO + órbita suave (pasa de lado)
      const k = ease((t - 4.5) / 7.5);
      const s = lerp(-L * 0.9, L * 0.9, k);
      const off = stand * (1.0 + 0.10 * Math.sin(k * Math.PI * 2.0)), ph = 0.7 + k * 2.6;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: 36,
        target: P(s + L * 0.15, 0, 0), roll: 0.12 * Math.sin(k * Math.PI * 2.0) };
    } else if (t < 18.0) {                           // REVELA — vista completa lateral (héroe), con calma
      const k = ease((t - 12.0) / 6.0);
      const s = lerp(L * 0.9, 0, k), off = lerp(stand, Math.max(L * 2.0, stand * 2.0), k), ph = 0.6 + k * 1.0;
      return { pos: P(s, Math.cos(ph) * off, Math.sin(ph) * off), fov: lerp(36, 32, k), target: f.c, roll: lerp(0.1, 0.0, k) };
    } else {                                         // ASIENTA — órbita lenta 3/4
      const k = ease((t - 18.0) / 4.0), off = Math.max(L * 2.0, stand * 2.0), ph = 1.6 + k * 0.5;
      return { pos: P(lerp(0, -L * 0.15, k), Math.cos(ph) * off, Math.sin(ph) * off), fov: 32, target: f.c, roll: 0 };
    }
  }

  // FORMACIÓN O₂ — cámara DEDICADA: los dos átomos GEMELOS apilados VERTICAL (roll=π/2
  // pone el eje de enlace en pantalla-vertical → llena el 9:16, cero void) cayendo uno
  // hacia el otro por Morse. Al enlazar (~3.5s) la cámara ROTA suave hacia la órbita
  // héroe — sin corte: al final (t=4.5) empata exactamente la rama CONTEMPLA de abajo.
  if (f.o2) {
    // PELÍCULA de 30s — cámara con PESO, lenta, contemplativa (cine, no reel arcade):
    //   0–9.5s   APROXIMACIÓN+ENLACE: dos átomos GEMELOS verticales, CERCA, cayendo
    //            despacio (roll=π/2 → eje vertical, llena 9:16); la cámara casi no se
    //            mueve (el movimiento lo hacen los átomos). Choque ~7.8s.
    //   9.5–14s  ASIENTA+REVELA: rota vertical→órbita y jala a standoff héroe (sin corte).
    //   14–30s   HÉROE: órbita LENTÍSIMA con peso, respira distancia y elevación.
    const ex0 = f.ex;
    const bx = Math.sin(t * 0.22) * 0.012;          // respiro lento (handheld con peso)
    const NX = f.nucX ?? 1.14;                       // x del núcleo objetivo (bohr) = Re/2
    const NUC: Vec3 = [-NX, 0, 0];                   // clavamos al átomo de la IZQUIERDA
    // Li₂: ABRE en el shot del CAMPO (hero pulled-back, NO el velo cercano que quema),
    // y los átomos se SEPARAN y se re-UNEN dentro del encuadre. Empata C0 con el héroe (t14).
    // Li₂: CÁMARA COMPLETA sincronizada a la narración (58.6s). De LADO (azim ~π/2 =
    // perpendicular al eje) durante el acercamiento → se VE la deformación del campo.
    if (f.mk === 'li2') {
      const roll0 = Math.PI / 2 + 0.04 * Math.sin(t * 0.17);   // más vida
      if (t < 22) {                        // FORMACIÓN RECIA: lejos → choque (voz: se repelen, se pegan)
        const k = ease(t / 22);
        const dist = ex0 * lerp(2.4, 1.34, ease(Math.pow(k, 1.25)));       // se acerca acelerando (con el choque)
        const azim = lerp(Math.PI / 2 + 0.2, 0.7, k) + bx + 0.14 * Math.sin(k * Math.PI * 2);  // barrido de lado con vida
        return { pos: sph(dist, lerp(0.06, 0.18, k), azim), fov: lerp(44, 33, k), target: [0, 0, 0], roll: roll0 };
      } else if (t < 30) {                 // HÉROE (voz: 3 electrones, el más flojo)
        const k = ease((t - 22) / 8);
        const dist = ex0 * (1.34 + 0.14 * Math.sin(k * Math.PI));
        return { pos: sph(dist, 0.18 + 0.12 * Math.sin(k * Math.PI), 0.7 + k * 1.8 + bx), fov: 33, target: [0, 0, 0], roll: roll0 };
      } else if (t < 38) {                 // CLAVADO al núcleo (voz: muy adentro, 3 protones)
        const k = ease((t - 30) / 8);
        const r = ex0 * lerp(1.34, 0.16, k);
        const cen: Vec3 = [lerp(0, NUC[0], ease(Math.min(1, k / 0.5))), 0, 0];
        return { pos: orbitAround(cen, r, lerp(0.18, 0.0, k), 2.5 + k * 2.0 + bx), fov: lerp(33, 42, k), target: cen, roll: roll0 };
      }
      // SALIDA: regresa a la molécula entera (cierre)
      const k = ease((t - 38) / 6);
      const cen: Vec3 = [lerp(NUC[0], 0, k), 0, 0];
      return { pos: orbitAround(cen, ex0 * lerp(0.16, 1.5, k), lerp(0.0, 0.16, k), 4.5 + k * 0.9 + bx), fov: lerp(42, 34, k), target: cen, roll: roll0 };
    }
    if (t < 9.5) {
      // VIAJE ENTRE LAS NUBES (in medias res): la cámara NACE rozando el velo del
      // átomo de abajo (looming — cerebro rápido), cruza el canal entre los dos con
      // parallax fuerte y se ABRE al two-shot. El átomo se mueve (Morse) y la cámara
      // lo sigue: viajas ENTRE los electrones, no los ves de lejos.
      const k = ease(t / 9.5);
      const xa = -NX * bondR(t, f.mk);                // el átomo de abajo, EN VIVO
      const m = ease(Math.max(0, (t - 4.0) / 5.5));  // la órbita migra: átomo → punto medio
      const cen: Vec3 = [lerp(xa, 0, m), 0, 0];
      const r = ex0 * lerp(0.50, 0.98, k) * (1 - 0.07 * Math.sin(k * Math.PI * 2));   // pegado al velo → two-shot; dolly con PULSO (violencia)
      const azim = Math.PI / 2 - 2.5 + k * 2.5 + bx; // barrido DOBLE = parallax violento entre los dos átomos
      const elev = lerp(-0.65, 0.02, k) + 0.10 * Math.sin(k * Math.PI * 1.7) * (1 - k);
      return { pos: orbitAround(cen, r, elev, azim), fov: lerp(50, 35, k), target: cen, roll: Math.PI / 2 };
    } else if (t < 14.0) {
      // EL DESPLOME visto de CERCA: la cámara se QUEDA pegada (1.26) mientras los
      // velos se estrellan y el enlace ENCIENDE llenando el cuadro; solo tras el
      // choque (12.6+) se abre al standoff del héroe. La FORMACIÓN es el show.
      const k = ease((t - 9.5) / 4.5);
      const kOut = ease(Math.max(0, (t - 12.6) / 1.4));
      const dist = ex0 * lerp(0.98, 1.32, kOut);
      const azim = lerp(Math.PI / 2, 0.7, k);
      const elev = lerp(0.02, 0.18, k);
      // roll SE QUEDA en π/2: el enlace VERTICAL llena el 9:16
      return { pos: sph(dist, elev, azim + bx), fov: lerp(35, 33, k), target: [0, 0, 0], roll: Math.PI / 2 };
    }
    // ── EL VIAJE DE ESCALA (Powers of Ten del enlace) — la molécula NO se entiende
    // desde afuera: los núcleos son 25000× más chicos que la nube. La cámara VIAJA:
    // contempla la molécula → SE CLAVA en un átomo (distancia EXPONENCIAL = escala
    // sentida) → órbita ÍNTIMA del núcleo (protones/neutrones GIGANTES, vibración de
    // punto cero visible) → SALE de regreso a la molécula entera. Todas las fases
    // empalman C0 (pos/target/fov continuos, cero cortes). Roll base continuo + swells
    // locales sin(kπ) que valen 0 en las costuras.
    // Fases SINCRONIZADAS a la narración v2 (beats desde segs.json REAL):
    //   "Ahora ven conmigo"=27.0 → clavado · "está el corazón"=39.3 → núcleo ·
    //   "Tú eres casi vacío"=52.2 → salida · "el candado sigue ahí"=56.3 → héroe final.
    const rollBase = 0.03 * Math.sin(t * 0.13);
    if (t < 26.6) {                                  // HÉROE — órbita VIVA, sujeto DOMINANTE (fill≥0.35)
      const k = ease((t - 14.0) / 12.6);
      const dist = ex0 * (lerp(1.32, 1.48, k) - 0.14 * Math.sin(k * Math.PI));   // PEGADO: el enlace LLENA la pantalla (mandato O₂)
      const azim = 0.7 + k * 1.6;                    // barrido amplio — nunca estática
      const elev = 0.18 + Math.sin(k * Math.PI * 1.3) * 0.16;
      return { pos: sph(dist, elev, azim + bx), fov: 33, target: [0, 0, 0], roll: Math.PI / 2 + rollBase };
    }
    // ── F₂: EL ACTO DE LA REPULSIÓN (el núcleo es de H₂ — aquí NO se repite). La
    // cámara se mete AL cinturón de pares libres, CRUZA el muro de carga tres veces
    // (locura con peso), recorre el callejón del enlace aplastado entre los dos
    // muros y sale. Costuras C0 exactas: k=0 de cada fase = k=1 de la anterior;
    // la salida aterriza en azim 9.1+2π ≡ 9.1 = el arranque del héroe final. ──
    if (f.mk === 'f2' && t < 56.0) {
      const ELEV0 = 0.18 + Math.sin(Math.PI * 1.3) * 0.16;   // elev exacta del fin del héroe
      if (t < 32.5) {                                // CLAVADO AL CINTURÓN (exponencial, sin llegar al núcleo)
        const k = ease((t - 26.6) / 5.9);
        const r = (ex0 * 1.48) * Math.pow(0.85 / (ex0 * 1.48), k);
        const m = ease(Math.min(1, k / 0.4));
        const cen: Vec3 = [lerp(0, NUC[0], m), 0, 0];
        return { pos: orbitAround(cen, r, lerp(ELEV0, -0.25, k), 2.3 + k * 2.6 + bx),
          fov: lerp(33, 44, k), target: cen, roll: Math.PI / 2 + rollBase + Math.sin(k * Math.PI) * 0.15 };
      } else if (t < 45.5) {                         // LOCURA — cruza el muro de carga 3 veces (A→B→A→B)
        const u = (t - 32.5) / 13.0;
        const cen: Vec3 = [-NX * Math.cos(Math.PI * 3 * u), 0, 0];
        const r = 0.85 + 0.20 * Math.sin(u * Math.PI * 2);
        const elev = -0.25 + Math.sin(u * Math.PI * 2) * 0.38;
        return { pos: orbitAround(cen, r, elev, 4.9 + u * 6.5 + bx),
          fov: 44 + Math.sin(u * Math.PI * 3) * 4, target: cen,
          roll: Math.PI / 2 + rollBase + Math.sin(u * Math.PI * 2) * 0.22 };
      } else if (t < 53.0) {                         // EL CALLEJÓN — B→A pegado al eje, muros a los lados
        const k = ease((t - 45.5) / 7.5);            // hasta 53.0: "aplastado entre dos muros" (l12 real 50.8-54.5) cae DENTRO
        const cen: Vec3 = [lerp(NX, -NX * 1.1, k), 0, 0];
        const r = lerp(0.85, 0.70, k) - 0.15 * Math.sin(k * Math.PI);
        return { pos: orbitAround(cen, r, lerp(-0.25, 0.10, k), 11.4 + k * 1.6 + bx),
          fov: 44, target: cen, roll: Math.PI / 2 + rollBase + Math.sin(k * Math.PI) * 0.10 };
      } else {                                       // SALIDA WARP → empata EXACTO el héroe final (t=56)
        const w = ease((t - 53.0) / 3.0);
        const r = 0.70 * Math.pow((ex0 * 1.25) / 0.70, w);
        const m = ease(Math.min(1, w / 0.6));
        const cen: Vec3 = [lerp(-NX * 1.1, 0, m), 0, 0];
        return { pos: orbitAround(cen, r, lerp(0.10, 0.20, w), lerp(13.0, 9.1 + Math.PI * 2, w) + bx),
          fov: lerp(44, 33, w), target: cen, roll: Math.PI / 2 + rollBase * (1 - w) };
      }
    }
    if (t < 39.0) {                                  // CLAVADO — caemos AL núcleo (exponencial, espiral)
      const k = ease((t - 26.6) / 12.4);
      const r = (ex0 * 1.48) * Math.pow(0.22 / (ex0 * 1.48), k);   // molécula → escala nuclear
      const azim = 2.3 + k * 2.2;                    // espiral al caer — viaje, no elevador
      const elev = lerp(0.18, 0.06, k);
      const m = ease(Math.min(1, k / 0.35));         // centro y mirada MIGRAN molécula→núcleo temprano
      const cen: Vec3 = [lerp(0, NUC[0], m), 0, 0];
      return { pos: orbitAround(cen, r, elev, azim + bx), fov: lerp(33, 42, k),
        target: cen, roll: Math.PI / 2 + rollBase + Math.sin(k * Math.PI) * 0.12 };
    } else if (t < 51.7) {                           // EL NÚCLEO — órbita íntima VIVA: nucleones GIGANTES, zpv visible
      const k = ease((t - 39.0) / 12.7);
      const r = lerp(0.22, 0.175, k) + 0.014 * Math.sin(k * Math.PI * 3);   // respira acercándose
      const azim = 4.5 + k * 3.4;                    // barrido amplio: el núcleo ROTA de verdad en cuadro
      const elev = 0.06 + Math.sin(k * Math.PI * 1.5) * 0.22;
      return { pos: orbitAround(NUC, r, elev, azim + bx), fov: 42, target: NUC,
        roll: Math.PI / 2 + rollBase + Math.sin(k * Math.PI) * 0.06 };
    } else if (t < 56.0) {                           // SALIDA — Powers of Ten de regreso (el átomo se hace chico)
      const k = ease((t - 51.7) / 4.3);
      // termina en 1.7·ex (no 2.4): la molécula ENLAZADA mide la mitad que los dos
      // átomos separados — más cerca para que siga DOMINANDO el cuadro al regresar
      const r = 0.175 * Math.pow((ex0 * 1.25) / 0.175, k);
      const azim = 7.9 + k * 1.2;
      const elev = lerp(-0.16, 0.20, k);
      const m = ease(Math.min(1, k / 0.6));          // la mirada regresa a la molécula completa
      const cen: Vec3 = [lerp(NUC[0], 0, m), 0, 0];
      return { pos: orbitAround(cen, r, elev, azim + bx), fov: lerp(42, 33, k),
        target: cen, roll: Math.PI / 2 + rollBase - Math.sin(k * Math.PI) * 0.10 };
    } else {                                         // HÉROE FINAL → LOOP: órbita viva y REGRESO al encuadre de apertura
      const k = (t - 56.0) / 14.0;
      // ret: los últimos ~7s VUELVEN a la composición de apertura (bond vertical
      // roll=π/2, elev −0.30, fov 42) → con el fade a negro, empalma con el frame 1.
      // dist 1.15·ex (no 1.65): la molécula enlazada es más chica que el par separado
      // — así el cierre LLENA el cuadro igual que la apertura (contraste sostenido).
      const ret = ease(Math.max(0, (t - 63.5) / 6.5));
      // FLYBY final: pasa CERCA (0.95·ex — dentro del polvo, la molécula LLENA el
      // cuadro) con barrido rápido; luego el regreso al encuadre de apertura (loop)
      const dive2 = ease(Math.min(1, k * 2.4));
      const dist = ex0 * lerp(lerp(1.25, 0.80, dive2) + 0.06 * Math.sin(k * Math.PI * 2), 0.95, ret);
      const azim = 9.1 + k * 2.6;
      const elev = lerp(0.20 + Math.sin(k * Math.PI * 1.2) * 0.12, -0.30, ret);
      const roll = Math.PI / 2 + (1 - ret) * 0.03 * Math.sin((t - 56.0) * 0.11);   // vertical SIEMPRE (9:16); el wobble muere al cierre
      return { pos: sph(dist, elev, azim + bx), fov: lerp(33, 42, ret), target: [0, 0, 0], roll };
    }
  }

  // ORBIT LENTO — compactas. Entra desde lejos (molécula COMPLETA), contempla con
  // calma, órbita lenta con peso, asienta. Respira. Cámara afuera (~2.3× extent).
  const ex = f.ex;
  const bx = Math.sin(t * 0.4) * 0.014 + Math.sin(t * 0.73) * 0.006;   // respiro suave (handheld lento)
  let dist: number, azim: number, elev: number, fov: number, roll: number;
  if (t < 0.28) {                                   // ESTALLIDO@frame0 — el campo revienta + looming
    const k = ease(t / 0.28);
    dist = ex * lerp(0.85, 0.6, k); azim = 0.15; elev = 0.05; fov = lerp(46, 40, k); roll = 0;
  } else if (t < 4.5) {                             // PULL-BACK revelador (cerca → órbita)
    const k = ease((t - 0.28) / 4.22);
    dist = ex * lerp(0.6, 2.25, k); azim = 0.15 + k * 0.55; elev = lerp(0.05, 0.16, k); fov = lerp(40, 33, k); roll = 0.04 * Math.sin(t * 0.5);
  } else if (t < 11.0) {                            // CONTEMPLA — barrido amplio y SUAVE
    const k = ease((t - 4.5) / 6.5);
    dist = ex * lerp(2.25, 2.35, k); azim = 0.7 + k * 1.7; elev = 0.16 + Math.sin(k * Math.PI) * 0.28; fov = 33; roll = 0.05 * Math.sin((t - 4.5) * 0.35);
  } else if (t < 17.5) {                            // ÓRBITA LENTA — con peso
    const k = ease((t - 11.0) / 6.5);
    dist = ex * lerp(2.35, 2.25, k); azim = 2.4 + k * 1.5; elev = 0.44 - Math.sin((t - 11.0) * 0.3) * 0.14; fov = 33; roll = 0.04 * Math.sin((t - 11.0) * 0.28);
  } else {                                          // ASIENTA — héroe, casi quieto
    const k = ease((t - 17.5) / 4.5);
    dist = ex * lerp(2.25, 2.30, k); azim = 3.9 + k * 0.25; elev = lerp(0.40, 0.30, k); fov = 33; roll = 0;
  }
  return { pos: sph(dist, elev, azim + bx), fov, target: [0, 0, 0], roll };
}

function MolCameraRig({ frame, time, vertical }: { frame: Frame; time: number; vertical: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    const { pos, fov, target, roll } = molCamera(time, frame);
    camera.position.set(pos[0], pos[1], pos[2]);
    // roll REAL alrededor del eje de vista (banking) — da violencia/energía
    const fwd = new THREE.Vector3(target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]).normalize();
    const up0 = new THREE.Vector3(0, 1, 0);
    if (Math.abs(fwd.dot(up0)) > 0.94) up0.set(0, 0, 1);
    const right = new THREE.Vector3().crossVectors(fwd, up0).normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    // 16:9 — la cámara de ENLACE compone el eje con roll≈π/2 (eje en pantalla-vertical)
    // para LLENAR el 9:16. En horizontal ese mismo roll deja la molécula atravesada con
    // void muerto a los lados; se le quita el cuarto de vuelta → el eje queda HORIZONTAL
    // y llena el 3840×2160. El wobble/banking authored se conserva intacto.
    const r = (roll || 0) - (!vertical && frame.o2 ? Math.PI / 2 : 0);
    camera.up.copy(trueUp.multiplyScalar(Math.cos(r)).add(right.multiplyScalar(Math.sin(r))));
    camera.lookAt(target[0], target[1], target[2]);
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.fov !== undefined) {
      cam.fov = vertical ? Math.min(95, fov * 1.42) : fov;
      const d = Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
      cam.near = Math.max(0.01, d * 0.03);
      cam.far = Math.max(100, frame.ex * 24);
      cam.updateProjectionMatrix();
    }
  }, [time, frame, camera, vertical]);
  return null;
}

// ── PostFX de molécula — grado de cine (ACES como en V8 — el look aprobado). El
// bokeh lo hace el shader de la nube (uBokeh), no aquí. ──
function MolPostFX({ live = false, sat = 0.5 }: { live?: boolean; sat?: number }) {
  // MSAA=0 en live: el combo multisampling + render target HDR-float revienta el
  // postFX a blanco en muchas GPUs (Intel, ANGLE, software) aunque la GPU de dev
  // lo renderee bien. Headless 4K (live=false) conserva MSAA=4. HDR buffer explícito.
  return (
    <EffectComposer multisampling={live ? 0 : 4} frameBufferType={THREE.HalfFloatType}>
      {/* receta O₂ ORIGINAL (la de los 160 likes): bloom suave envolviendo cada
          punto → densidad LUMINOSA continua, el look que hipnotiza */}
      <Bloom intensity={1.15} luminanceThreshold={0.20} luminanceSmoothing={0.6} radius={0.9} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <BrightnessContrast brightness={0.02} contrast={0.18} />
      <HueSaturation saturation={sat} />
      <ChromaticAberration offset={new THREE.Vector2(0.0010, 0.0010)} radialModulation modulationOffset={0.35} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.05} />
      <Vignette eskil={false} offset={0.20} darkness={0.68} />
    </EffectComposer>
  );
}

// ── Modos vibracionales reales del agua (Hessian → modos normales) ──
// Los calculamos en la geometría canónica (mismo frame que la nube precomputada)
// para que los desplazamientos queden alineados con los núcleos.
interface VibMode { label: string; wavenumber: number; disp: Vec3[]; }

function computeWaterModes(): VibMode[] {
  const R = 0.9584; // Å
  const half = (104.5 / 2) * Math.PI / 180;
  const posAng: number[][] = [
    [0, 0, 0],
    [R * Math.sin(half), 0, R * Math.cos(half)],
    [-R * Math.sin(half), 0, R * Math.cos(half)],
  ];
  const masses = [15.9994, 1.00784, 1.00784];
  const va = vibrationalAnalysis(posAng, FF_H2O.ff, masses);
  const labels = ['Flexión', 'Estiramiento simétrico', 'Estiramiento asimétrico'];
  // El modeVector (forma del movimiento) viene del cálculo; el número que
  // CITAMOS es el experimental medido (NIST), no el del campo de fuerzas SVFF.
  const expWN = FF_H2O.experimentalWavenumbers;
  return va.vibrational.slice(0, 3).map((m, i) => {
    // desplazamiento cartesiano = mass-weighted / √masa, normalizado a |max|=1
    const cart: Vec3[] = [];
    let maxMag = 1e-6;
    for (let a = 0; a < 3; a++) {
      const v: Vec3 = [
        m.modeVector[3 * a] / Math.sqrt(masses[a]),
        m.modeVector[3 * a + 1] / Math.sqrt(masses[a]),
        m.modeVector[3 * a + 2] / Math.sqrt(masses[a]),
      ];
      cart.push(v);
      maxMag = Math.max(maxMag, Math.hypot(...v));
    }
    const disp = cart.map(v => [v[0] / maxMag, v[1] / maxMag, v[2] / maxMag] as Vec3);
    return { label: labels[i] ?? `Modo ${i + 1}`, wavenumber: expWN[i] ?? Math.round(Math.abs(m.wavenumber)), disp };
  });
}

// Timeline de modos: qué modo vibra en cada ventana (amplitud 0..1 por modo).
// 0 bend · 1 sym · 2 asym. La ventana final hace vibrar los 3 juntos.
const VIS_AMP = 0.42;      // amplitud visual del desplazamiento (bohr)
const VIS_FREQ = 1.7;      // Hz visual (para VER la oscilación; el audio va a su tono real)

function modeAmps(t: number): [number, number, number] {
  const bump = (a: number, b: number) =>
    smoothstep((t - a) / 0.5) * (1 - smoothstep((t - (b - 0.5)) / 0.5));
  const all = t >= 17.5 ? smoothstep((t - 17.5) / 0.8) : 0;
  return [
    Math.max(bump(5.0, 9.0), all * 0.7),
    Math.max(bump(9.0, 13.0), all * 0.7),
    Math.max(bump(13.0, 17.0), all * 0.7),
  ];
}

interface Nuc { pos: Vec3; protons: number; neutrons: number; }
interface MolData { bundle: AtomBundle; nuclei: Nuc[]; extent: number; bonds: [number, number][]; }

const BASE_META: Record<string, { name: string; formula: string; fact: string }> = {
  h2o:  { name: 'El agua', formula: 'H₂O', fact: 'Un ángulo de 104.5° decide que estés vivo.' },
  wsilla: { name: 'La silla vacía', formula: 'H₂O···H₂O', fact: 'El puente no cae en cualquier lado: cae donde el oxígeno guarda sus dos nubes.' },
  wcolor: { name: 'De quién son', formula: 'C · O · H', fact: 'Cada color es un elemento, repartido por la regla de Hirshfeld — no a ojo.' },
  wcamporb: { name: 'Los dos campos', formula: 'E⁺ + E⁻', fact: 'Se cancelan el 99 % entre ellos. El puente del agua es lo que sobra.' },
  wcampor: { name: 'Los dos campos', formula: 'E⁺ + E⁻', fact: 'Se cancelan el 99 % entre ellos. El puente del agua es lo que sobra.' },
  wcampo: { name: 'Los dos campos', formula: 'E⁺ + E⁻', fact: 'El campo de los núcleos y el de los electrones se cancelan el 99 % — la química es lo que sobra.' },
  wetanol: { name: 'El alcohol', formula: 'C₂H₅OH···H₂O', fact: 'El puente del alcohol vale el 96 % del puente del agua — por eso se mezclan.' },
  wtri: { name: 'El anillo', formula: '(H₂O)₃', fact: 'Tres aguas se agarran MÁS fuerte que la suma de sus pares.' },
  wtet: { name: 'El cuarteto', formula: '(H₂O)₄', fact: 'Tres no encajaban. Cuatro sí: los cuatro puentes salen idénticos.' },
  whex6: { name: 'El hexágono', formula: '(H₂O)₆', fact: 'Cuenta los lados: seis. Es la misma forma que el agua repite al congelarse.' },
  faraday: { name: 'La jaula de Faraday', formula: 'E_dentro = 0', fact: 'Un marco de barras no te protege; una malla cerrada, 160 veces.' },
  cargas: { name: 'La ley de Gauss', formula: '∮E·dA = 4πQ', fact: 'Cuenta las líneas que se escapan: son exactamente la carga de adentro.' },
  ch4:  { name: 'Metano', formula: 'CH₄', fact: 'Cuatro enlaces perfectos a 109.5°: un tetraedro.' },
  nh3:  { name: 'Amoniaco', formula: 'NH₃', fact: 'Un par libre la vuelve una pirámide.' },
  co2:  { name: 'Dióxido de carbono', formula: 'CO₂', fact: 'Lineal y simétrica: 180° exactos.' },
  c2h4: { name: 'Etileno', formula: 'C₂H₄', fact: 'Un doble enlace: σ + π. Madura las frutas.' },
  c2h2: { name: 'Acetileno', formula: 'C₂H₂', fact: 'Un triple enlace: σ + 2π. Arde a 3000 °C.' },
  hcl:  { name: 'El ácido', formula: 'HCl', fact: 'El cloro jala el electrón del hidrógeno — y así se hace el ácido de tu estómago.' },
  c6h6: { name: 'Benceno', formula: 'C₆H₆', fact: 'Seis electrones bailando en círculo: aromático.' },
  h2:   { name: 'Hidrógeno', formula: 'H₂', fact: 'El enlace más simple del universo.' },
  f2:   { name: 'Flúor', formula: 'F₂', fact: 'El elemento más violento — con el enlace más débil.' },
  c2:   { name: 'Carbono', formula: 'C₂', fact: 'Doble enlace de puro π: el carbono rompe las reglas.' },
  hehp: { name: 'Hidruro de helio', formula: 'HeH⁺', fact: 'La primera molécula que existió.' },
  li2:  { name: 'Dilitio', formula: 'Li₂', fact: 'El primer enlace entre dos metales.' },
  nacl: { name: 'La sal', formula: 'NaCl', fact: 'El robo perfecto: el cloro le quita el electrón al sodio sin tocarlo.' },
  hf:   { name: 'El tirano', formula: 'HF', fact: 'El elemento más hambriento del universo no logra robar — solo torcer.' },
  be2:  { name: 'Diberilio', formula: 'Be₂', fact: 'Orden de enlace 0: no debería existir. Y existe — por pura correlación.' },
  n2:   { name: 'Nitrógeno', formula: 'N₂', fact: 'Triple enlace, el candado más fuerte: 78% del aire.' },
  o2:   { name: 'Oxígeno', formula: 'O₂', fact: 'Doble enlace magnético: lo que te mantiene vivo.' },
  co:   { name: 'El abrazo asesino', formula: 'CO', fact: 'El enlace más fuerte de la naturaleza — por eso el monóxido no te suelta.' },
  wdimer: { name: 'El puente', formula: 'H₂O···H₂O', fact: 'Dos moléculas de agua se agarran: el δ+ de un hidrógeno jala al δ− del oxígeno vecino.' },
  whex: { name: 'El hexágono', formula: '(H₂O)₆', fact: 'Seis aguas en anillo: por esto el hielo es hexagonal y el copo de nieve tiene 6 puntas.' },
  wsingle: { name: 'El agua', formula: 'H₂O', fact: 'Su campo eléctrico: del hidrógeno positivo al oxígeno negativo.' },
  wmd: { name: 'Se buscan', formula: '(H₂O)₁₀', fact: 'Diez moléculas de agua, sueltas en el vacío, se encuentran SOLAS: sus campos eléctricos las pegan.' },
  wsal:  { name: 'La sal', formula: 'Na⁺···H₂O', fact: 'Un ion con carga ENTERA: su campo es radial y ~10× el del agua. El agua le apunta el oxígeno y se pega (−24 kcal/mol, exacto al experimento). El celeste del ion es evocativo: Na⁺ es incoloro.' },
  wpair: { name: 'El puente', formula: 'H₂O···H₂O', fact: 'El campo de una molécula JALA los electrones de la otra: los ves llegar (morado) al lugar exacto que dice la cuántica.' },
  hemo: { name: 'La cazadora', formula: 'Hb·4O₂', fact: 'Una proteína de tu sangre caza cuatro oxígenos: cuando cae el primero, la máquina ENTERA se reacomoda (14° medidos) y los demás entran más fácil.' },
  no:   { name: 'El mensajero', formula: 'NO', fact: 'Un electrón suelto: por eso tu cuerpo lo usa para hablarle a tus arterias.' },
  // ── CADENAS — la cámara las ATRAVIESA ──
  butane:       { name: 'Butano', formula: 'C₄H₁₀', fact: 'Cuatro carbonos en zig-zag: el gas del encendedor.' },
  pentane:      { name: 'Pentano', formula: 'C₅H₁₂', fact: 'Cinco carbonos: ya es líquido, base de la gasolina.' },
  hexane:       { name: 'Hexano', formula: 'C₆H₁₄', fact: 'El esqueleto del carbono: enlaces σ a 109.5°.' },
  heptane:      { name: 'Heptano', formula: 'C₇H₁₆', fact: 'Siete carbonos: el cero del octanaje de la gasolina.' },
  octane:       { name: 'Octano', formula: 'C₈H₁₈', fact: 'Ocho carbones en cadena: la energía de la gasolina.' },
  nonane:       { name: 'Nonano', formula: 'C₉H₂₀', fact: 'Nueve eslabones: ya entra en el diésel.' },
  decane:       { name: 'Decano', formula: 'C₁₀H₂₂', fact: 'Diez eslabones de carbono, puro enlace σ.' },
  dodecane:     { name: 'Dodecano', formula: 'C₁₂H₂₆', fact: 'Doce carbonos: queroseno, lo que vuela los aviones.' },
  pentadecane:  { name: 'Pentadecano', formula: 'C₁₅H₃₂', fact: 'Quince carbonos: en feromonas de insectos.' },
  hexadecane:   { name: 'Hexadecano', formula: 'C₁₆H₃₄', fact: 'Dieciséis carbonos: el patrón del diésel (cetano).' },
  heptadecane:  { name: 'Heptadecano', formula: 'C₁₇H₃₆', fact: 'Diecisiete carbonos: cera líquida.' },
  eicosane:     { name: 'Eicosano', formula: 'C₂₀H₄₂', fact: 'Veinte carbonos: ya es cera sólida, vaselina.' },
  hexatriene:   { name: 'Hexatrieno', formula: 'C₆H₈', fact: 'Tres dobles enlaces conjugados: los electrones π se sueltan.' },
  octatetraene: { name: 'Octatetraeno', formula: 'C₈H₁₀', fact: 'Cuatro dobles en fila: el río π se alarga.' },
  decapentaene: { name: 'Decapentaeno', formula: 'C₁₀H₁₂', fact: 'Cinco dobles en fila: un río de electrones π.' },
  dodecahexaene:{ name: 'Dodecahexaeno', formula: 'C₁₂H₁₄', fact: 'Seis dobles conjugados: ya empieza a tener color.' },
  tetradecaheptaene: { name: 'Tetradecaheptaeno', formula: 'C₁₄H₁₆', fact: 'Siete dobles: el río π más largo, casi rojo.' },
  hexadecaoctaene:   { name: 'Hexadecaoctaeno', formula: 'C₁₆H₁₈', fact: 'Ocho dobles conjugados: absorbe color visible.' },
  caroteno:     { name: 'Caroteno (cromóforo)', formula: 'cadena π', fact: 'La cadena conjugada que pinta la zanahoria — y la que te deja VER.' },
  butirico:     { name: 'Ácido butírico', formula: 'C₄H₈O₂', fact: 'La grasa más corta de la MANTEQUILLA — le da su nombre (butyrum) y su olor. Cuatro carbonos y una cabeza de ácido: el esqueleto mínimo de una grasa.' },
  estearico:    { name: 'Ácido esteárico', formula: 'C₁₈H₃₆O₂', fact: 'La grasa de la mantequilla: recta, 179.9° — se apila como leña y queda sólida.' },
  oleico:       { name: 'Ácido oleico', formula: 'C₁₈H₃₄O₂', fact: 'La misma cadena con UN doble enlace: 125.5°. El codo impide apilarse — y por eso el aceite es líquido.' },
  // ── ADN — doble hélice B-form real ──
  brca1:    { name: 'ADN · BRCA1', formula: 'doble hélice', fact: 'Un trozo de tu gen BRCA1: cuando falla, aumenta el riesgo de cáncer.' },
  telomero: { name: 'ADN · telómero', formula: 'TTAGGG', fact: 'El extremo de tus cromosomas: se acorta cada vez que una célula se divide.' },
  tata:     { name: 'ADN · caja TATA', formula: 'promotor', fact: 'La señal donde la célula empieza a leer un gen.' },
};
const META: Record<string, { name: string; formula: string; fact: string }> = { ...BASE_META, ...CATALOG_META };

// Cadenas: se cargan de chain-<key>.bin y disparan la cámara TRAVERSAL.
// `estearico` y `oleico` (cadena LA FORMA MANDA, pieza 1 "El codo") entran aquí como dos
// claves más: el renderizador de cadenas y su cámara TRAVERSAL ya existían, así que la pieza
// no necesita escena nueva. Su .bin sí es distinto en ORIGEN —no en formato—: lo escribe
// scripts/precompute-cadena.py con geometría OPTIMIZADA y densidad |ψ|² real, en vez de
// orbitales localizados con longitudes de libro. Ver docs/CADENA-LA-FORMA-MANDA.md.
// GRASAS CALCULADAS: su .bin lo hace scripts/precompute-grasa.py con densidad ab initio y
// líneas de campo de campo_lineas.py. No van por CHAIN_KEYS porque esa familia PINTA los
// enlaces (lóbulos σ dibujados sobre longitudes de libro) y aquí el enlace EMERGE del Δρ.
const GRASA_KEYS = new Set(['butirico']);
// COREOGRAFÍA DEL BUTÍRICO. `apertura`: 0 = molécula formada, 1 = átomos sueltos.
// Las fronteras son los arranques REALES de segs.json (se llenan al tener la voz).
// La pieza ABRE FORMADA y REBOBINA: el cuadro de átomos sueltos sale en 91 % de negro y el
// canon pide primer cuadro denso, así que el gancho es la molécula hecha y de ahí se va atrás.
// voz REAL 57.89 s (16 líneas, VEL=1.10 en el TTS) + 2.5 de cola. Sin esto la escena reportaba los
// 22 s del default de cadenas y TODO lo posterior al segundo 22 se renderizaba congelado.
const BUTIRICO_DURATION = 60.4;
const BUTIRICO_CAPAS: CapasSpec = {
  // Fronteras = arranques REALES de segs.json (voz 57.89 s, 16 líneas).
  //
  // UNA NUBE A LA VEZ — el mecanismo de O₂/N₂ (`sigmaMul`/`pi1Mul`/`spinMul`), aquí en datos.
  // Allá, cuando un beat está "solo", la nube que toca sube y las OTRAS caen a un piso (0.34
  // en O₂, 0.14 en N₂). Esta pieza salió con las tres nubes y el campo a tope todo el tiempo:
  // Ian, 2026-08-06 — "acá está encendido TODO TODO el tiempo", y de ahí venían también el
  // quemado a blanco y que el campo se viera débil: competía con tres nubes al máximo.
  apertura: { base: 0, mods: [
    { wins: [[11.66, 19.00]], a: 1.0, label: 'REBOBINA: los átomos sueltos (l5-6)' },
    { wins: [[19.00, 20.80]], a: 0.78, label: '"míralos acercarse"' },
    { wins: [[20.80, 23.56]], a: 0.48, label: '"mira dónde se va la carga"' },
    { wins: [[23.56, 26.23]], a: 0.20, label: '"se cae al espacio de en medio"' },
    { wins: [[26.23, 31.14]], a: 0.05, label: 'casi cerrada mientras define qué es un enlace' },
  ] },
  acc: { base: 1, mods: [
    { wins: [[15.26, 18.60]], a: 0.28, label: 'SU beat: "cada uno con su nube…"' },
    { wins: [[20.80, 30.74]], a: -0.62, label: 'cede: el sujeto es la carga que CAE al enlace' },
    { wins: [[31.14, 41.97]], a: -0.52, label: 'cede: los números son del enlace' },
    { wins: [[45.09, 49.26]], a: -0.70, label: 'cede: "las líneas son el campo real"' },
  ] },
  spin: { base: 1, mods: [
    { wins: [[0.40, 19.00]], a: -0.80, label: 'no hay enlace que mostrar (átomos sueltos)' },
    { wins: [[20.80, 30.74]], a: 0.55, label: 'SU beat: la carga cae al espacio de en medio' },
    { wins: [[31.14, 41.97]], a: 0.45, label: 'SU beat: 0.87 electrones · trece enlaces' },
    { wins: [[45.09, 49.26]], a: -0.55, label: 'cede al campo' },
  ] },
  dep: { base: 0.85, mods: [
    { wins: [[45.09, 49.26]], a: -0.55, label: 'cede al campo' },
  ] },
  // TRÁNSITO — el `transitDim` de O₂/N₂. Cuando la cámara ENTRA a la nube, la densidad
  // aditiva por delante del lente se acumula y el cuadro revienta (medido: 45.7 % de píxeles
  // >200 en el clavado sin esto). La escena de enlaces apaga la nube al entrar "para que el
  // NUCLEÓN resalte" y devuelve el brillo al salir. Multiplica a las tres.
  transito: { base: 1, mods: [
    { wins: [[33.0, 41.97]], a: -0.75, label: 'CLAVADO: adentro, la nube cede al núcleo' },
    { wins: [[42.37, 44.90]], a: -0.55, label: 'salida: el brillo REGRESA con la molécula' },
  ] },
  // EL CAMPO: base alta (Ian lo pidió MÁS FUERTE) y dos beats donde se queda solo.
  campo: { base: 1.15, mods: [
    { wins: [[15.26, 20.80]], a: 0.85, label: 'SU beat: "con su campo eléctrico"' },
    { wins: [[45.09, 49.26]], a: 0.90, label: 'SU beat: "las líneas son el campo real"' },
    { wins: [[23.56, 41.97]], a: -0.35, label: 'cede mientras el sujeto es la carga del enlace' },
  ] },
};
/** Núcleo `i` en el instante del barrido R: MISMO bracket que usa O2Cloud para las nubes, así
 *  los núcleos y su densidad viajan juntos (si se dibujaran fijos, la nube se separaría de
 *  ellos y la formación se vería como un truco). */
function posNuc(g: WAPData, R: number, i: number): Vec3 {
  const { k, frac } = wapBracket(g.Rvals, g.K, R);
  const inv = 1 / (g.posq || O2AI_POSQ), mf = 1 - frac;
  const o0 = (k * g.NNUC + i) * 3, o1 = ((k + 1) * g.NNUC + i) * 3;
  return [(g.nucPos[o0] * mf + g.nucPos[o1] * frac) * inv,
          (g.nucPos[o0 + 1] * mf + g.nucPos[o1 + 1] * frac) * inv,
          (g.nucPos[o0 + 2] * mf + g.nucPos[o1 + 2] * frac) * inv];
}
const CHAIN_KEYS = new Set(['butane', 'pentane', 'hexane', 'heptane', 'octane', 'nonane', 'decane', 'dodecane', 'pentadecane', 'hexadecane', 'heptadecane', 'eicosane', 'hexatriene', 'octatetraene', 'decapentaene', 'dodecahexaene', 'tetradecaheptaene', 'hexadecaoctaene', 'caroteno', 'estearico', 'oleico']);
// Conjugadas (con sistema π): llevan campo de CARAS π (MEP). Los alcanos NO (apolares, planos eléctricamente → inertes).
const CONJUGATED_KEYS = new Set(['hexatriene', 'octatetraene', 'decapentaene', 'dodecahexaene', 'tetradecaheptaene', 'hexadecaoctaene', 'caroteno']);
// ADN: doble hélice B-form real (dna-<key>.bin). Alargada → cámara traversal vuela por el eje.
const DNA_KEYS = new Set(['brca1', 'telomero', 'tata']);

// ── Metadata pública para la galería del quimilab (montaje LIVE) ──
// nombre + fórmula de cualquier clave montable. Devuelve null si no la conocemos.
export function molMeta(key: string): { name: string; formula: string; fact: string } | null {
  return META[key] ?? null;
}

// Galería curada: SOLO claves con .bin precomputado (las que renderizan en vivo).
// El orden y agrupación reflejan el viaje conceptual: molécula → cadena → catálogo → vida.
export const MOLECULE_GALLERY: { label: string; hint: string; keys: string[] }[] = [
  { label: 'Moléculas', hint: 'geometría VSEPR · enlaces σ/π · pares libres',
    keys: ['h2o', 'co2', 'nh3', 'ch4', 'o2', 'n2', 'co', 'hcl', 'hf', 'nacl', 'hehp'] },
  { label: 'Cadenas · alcanos', hint: 'la cámara ATRAVIESA el esqueleto de carbono',
    keys: ['butane', 'pentane', 'hexane', 'heptane', 'octane', 'nonane', 'decane', 'dodecane', 'pentadecane', 'hexadecane', 'heptadecane', 'eicosane'] },
  { label: 'Cadenas · π conjugadas', hint: 'el río de electrones π — y el color',
    keys: ['hexatriene', 'octatetraene', 'decapentaene', 'dodecahexaene', 'tetradecaheptaene', 'hexadecaoctaene', 'caroteno'] },
  { label: 'Catálogo', hint: 'lo cotidiano: alcoholes, ácidos, gasolina, aromáticos',
    keys: ['metanol', 'etanol', 'isopropanol', 'acetona', 'acido-acetico', 'acido-formico', 'formaldehido', 'dimetileter', 'propano', 'isobutano', 'isooctano', 'ciclohexano', 'etileno', 'acetileno', 'benceno', 'butadieno', 'hcn', 'ch3nh2', 'h2o2', 'o3', 'so2'] },
  { label: 'ADN · la vida', hint: 'doble hélice B-form real — viaje de escala',
    keys: ['brca1', 'telomero', 'tata'] },
];

function parseBin(buf: ArrayBuffer): MolData {
  const dv = new DataView(buf);
  let off = 0;
  const N = dv.getInt32(off, true); off += 4;
  const K = dv.getInt32(off, true); off += 4;
  const extent = dv.getFloat32(off, true); off += 4;
  const nuclei: Nuc[] = [];
  const nucPos: Vec3[] = [];
  for (let i = 0; i < K; i++) {
    const x = dv.getFloat32(off, true); off += 4;
    const y = dv.getFloat32(off, true); off += 4;
    const z = dv.getFloat32(off, true); off += 4;
    const Z = dv.getFloat32(off, true); off += 4;
    const el = elementByZ(Math.round(Z));
    const info = el ? nucleusInfo(el) : { protons: Math.round(Z), neutrons: Math.round(Z) };
    nuclei.push({ pos: [x, y, z], protons: info.protons, neutrons: info.neutrons });
    nucPos.push([x, y, z]);
  }
  const positions = new Float32Array(buf, off, N * 3); off += N * 3 * 4;
  const colors = new Float32Array(buf, off, N * 3); off += N * 3 * 4;
  const sizes = new Float32Array(buf, off, N); off += N * 4;
  const shellIdx = new Float32Array(buf, off, N); off += N * 4;

  // enlaces POR DISTANCIA (no central→resto): conecta cada núcleo con sus vecinos
  // cercanos. Funciona para cadenas, anillos (benceno) y compactas por igual.
  // Umbral relativo a la distancia mínima (agnóstico a unidades bohr/Å).
  const bonds: [number, number][] = [];
  const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let dmin = Infinity;
  for (let i = 0; i < nucPos.length; i++) for (let j = i + 1; j < nucPos.length; j++) dmin = Math.min(dmin, dist(nucPos[i], nucPos[j]));
  const thr = (dmin === Infinity ? 1 : dmin) * 1.5;
  for (let i = 0; i < nucPos.length; i++) for (let j = i + 1; j < nucPos.length; j++) if (dist(nucPos[i], nucPos[j]) < thr) bonds.push([i, j]);

  const bundle: AtomBundle = {
    positions, colors, sizes, shellIdx,
    shells: [
      { label: 'core', n: 1, l: 0, color: new THREE.Color('#4FC3F7') },
      { label: 'enlaces', n: 2, l: 1, color: new THREE.Color('#8fe0ff') },
      { label: 'pares', n: 2, l: 1, color: new THREE.Color('#ff5da2') },
    ],
  };
  return { bundle, nuclei, extent, bonds };
}

// ═══ ENLACE O₂ AB INITIO — Δρ(r;R) de PySCF (UHF/cc-pVTZ, TRIPLETE real) ═══
// Generado por scripts/precompute-o2-abinitio.py: PySCF resuelve la Schrödinger
// electrónica del O₂ a cada separación R y guarda la DENSIDAD DE DEFORMACIÓN
// Δρ = ρ(O₂) − ρ(promolécula) — el ENLACE DESNUDO. Los cores 1s se CANCELAN, así
// que NO revienta a blanco como la ρ total (ese era el confeti). Tres nubes de
// partículas LAGRANGIANAS advectadas por R (semillas fijas → la carga FLUYE al
// enlace, no parpadea): acumulación (oro σ + ámbar π) · vaciado (azul frío) ·
// densidad de espín (violeta = los 2 e⁻ π* desapareados = el imán del O₂).
const O2AI_POSQ = 5000;           // bohr = posQ / O2AI_POSQ
interface O2AbInitio {
  accPos: Int16Array; depPos: Int16Array; spinPos: Int16Array;   // K*N*3 (cuantizadas)
  accColor: Uint8Array;                                          // Nacc*3 (oro→ámbar)
  Rvals: Float32Array;                                           // K (descendente Rmax→Rmin)
  accMass: Float32Array;                                         // K (carga en el ION — brillo de iónicos)
  bondMass: Float32Array;                                        // K (carga acumulada en el enlace → brillo)
  Nacc: number; Ndep: number; Nspin: number; K: number; Rmin: number; Rmax: number;
}
function parseO2AbInitio(buf: ArrayBuffer): O2AbInitio {
  const dv = new DataView(buf);
  let off = 0;
  const Nacc = dv.getInt32(off, true); off += 4;
  const Ndep = dv.getInt32(off, true); off += 4;
  const Nspin = dv.getInt32(off, true); off += 4;
  const K = dv.getInt32(off, true); off += 4;
  const Rmin = dv.getFloat32(off, true); off += 4;
  const Rmax = dv.getFloat32(off, true); off += 4;
  // CINTURÓN (2026-08-17): un .bin TRUNCADO (media copia, disco lleno, rsync cortado)
  // producía arrays cortos EN SILENCIO — nubes a medias sin ningún error. Ayer un master
  // a media copia dio "moov not found" en ffmpeg; un bin no tiene ni ese aviso.
  const esperado = 24 + K * 4 * 5 + Nacc * 3 + (Nacc + Ndep + Nspin) * K * 6;
  if (buf.byteLength < esperado) throw new Error(`bin WAP truncado: ${buf.byteLength} bytes < ${esperado} esperados (Nacc=${Nacc} Ndep=${Ndep} Nspin=${Nspin} K=${K})`);
  const Rvals = new Float32Array(buf.slice(off, off + K * 4)); off += K * 4;
  // accMass SÍ se usa ahora: en IÓNICOS (NaCl) el brillo se llavea a la carga
  // ACUMULADA EN EL ION (0.7→1.0 e⁻ desde lejos = el robo a distancia), porque
  // bondMass (carga en el punto MEDIO) es ≈0 en un iónico — no hay puente, esa
  // es su gracia. Con bondMass el video salía NEGRO todo el acercamiento.
  const accMass = new Float32Array(buf.slice(off, off + K * 4)); off += K * 4;
  off += K * 4 * 2;                                    // depMass,spinMass (no usados)
  const bondMass = new Float32Array(buf.slice(off, off + K * 4)); off += K * 4;  // carga del enlace → brillo
  const accColor = new Uint8Array(buf.slice(off, off + Nacc * 3)); off += Nacc * 3;
  const accPos = new Int16Array(buf.slice(off, off + K * Nacc * 3 * 2)); off += K * Nacc * 3 * 2;
  const depPos = new Int16Array(buf.slice(off, off + K * Ndep * 3 * 2)); off += K * Ndep * 3 * 2;
  const spinPos = new Int16Array(buf.slice(off, off + K * Nspin * 3 * 2)); off += K * Nspin * 3 * 2;
  return { accPos, depPos, spinPos, accColor, Rvals, accMass, bondMass, Nacc, Ndep, Nspin, K, Rmin, Rmax };
}

const O2FLOW_VERT = `
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vNear;
  varying float vW;
  varying float vTw;
  uniform float uSize;
  uniform float uPix;        // alto del framebuffer / 3840 → tamaño INVARIANTE a la resolución
  uniform float uRing;
  uniform float uCoreThin;
  uniform vec3  uCores[8];   // centros que ARDEN (núcleos), en bohr
  uniform vec3  uBondA[6];   // enlaces O–H: extremo A (el O)
  uniform vec3  uBondB[6];   // extremo B (el H)
  uniform int   uNBonds;
  uniform float uBondGlow;   // 0 = nada; >0 = el eje del enlace SE ENCIENDE
  float _distSeg(vec3 p, vec3 a, vec3 b) {
    vec3 ab = b - a, ap = p - a;
    float t = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    return length(ap - ab * t);
  }
  uniform int   uNCores;
  uniform float uCoreR;      // radio² del raleo por núcleo
  uniform float uTime;      // reloj para el PARPADEO (0 en las nubes que no parpadean)
  uniform float uTwinkle;   // profundidad del parpadeo (0 = apagado → idéntico a antes)
  void main() {
    vColor = aColor;
    // PARPADEO cuántico: cada punto aparece/desaparece a su propia fase (hash de su
    // posición) → nube de PROBABILIDAD de pocos electrones (no materia sólida). uTwinkle=0
    // en O2/los demás = sin efecto. Los electrones "están aquí, luego allá".
    float ph = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    vTw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * 7.0 + ph * 6.2831853));
    // ANILLO π EMERGENTE: las partículas REALES cerca del corazón del toro
    // (radio ≈1.05 bohr medido de la densidad π) brillan más — la estructura
    // emerge del polvo, no se dibuja encima. uRing=0 en las demás nubes.
    float dRing = length(vec2(length(position.yz) - 1.05, position.x * 0.8));
    vW = 1.0 + uRing * exp(-dRing * dRing / 0.16);
    // raleo del CORE: donde la suma ya es blanca, capas extra solo ENSUCIAN al
    // compresor — se atenúan las partículas pegadas al centro (la luz queda)
    // ANTI-QUEMADO GENERAL: ralear alrededor de CADA núcleo que arde, no solo del
    // ORIGEN. En O2/dímero el core que quema SÍ está en el centro; en el trímero los
    // tres oxígenos están en el anillo (r~3 bohr) y el origen es el HUECO → el raleo
    // viejo atenuaba el vacío y dejaba quemar los cores. Medido: 29% >240 vs 6.6%
    // del ganador. Con uNCores=0 el comportamiento es IDÉNTICO al de siempre.
    float thin = exp(-dot(position, position) / 0.30);          // compat: el origen
    for (int i = 0; i < 8; i++) {
      if (i >= uNCores) break;
      vec3 d = position - uCores[i];
      thin = max(thin, exp(-dot(d, d) / uCoreR));
    }
    vW *= 1.0 - uCoreThin * thin;
    // ESTRUCTURA QUE EMERGE (doctrina del proyecto: el polvo es real, no se dibuja encima).
    // La densidad electrónica del agua SÍ se concentra sobre el eje O–H: aquí solo se le sube
    // el peso a las partículas que ya están ahí → el enlace APARECE sin pintar un palito.
    if (uNBonds > 0 && uBondGlow > 0.0) {
      float bw = 0.0;
      for (int i = 0; i < 6; i++) {
        if (i >= uNBonds) break;
        float d = _distSeg(position, uBondA[i], uBondB[i]);
        bw = max(bw, exp(-d * d / 0.055));
      }
      vW *= 1.0 + uBondGlow * bw;
    }
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // el polvo SE APARTA del lente: al viajar DENTRO de la nube, las partículas
    // pegadas a cámara se desvanecen (vNear→0) pero el polvo cercano SÍ envuelve
    // (rango corto 0.85 bohr = inmersión al volar entre nubes); la pared blanca
    // del clavado la mata el transit-dim por fase, no este fade.
    vNear = smoothstep(0.22, 0.85, -mv.z);
    // uPix = alto_del_framebuffer / 3840 (el alto del MASTER 4K vertical, o sea el de los
    // ganadores O₂/N₂/C₂/agua v2 → uPix=1 y su look queda IDÉNTICO).
    // gl_PointSize está en PÍXELES: sin este factor el mismo electrón ocupa el DOBLE de
    // cuadro en un preview de 1080 de alto que en el master de 3840, y 4× en el 16:9 de
    // 1080. Medido el 2026-07-29 en t=20: radio/alto = 0.093% / 0.181% / 0.044% para
    // 1080×1920 / 1920×1080 / 2160×3840 — el radio en px era el MISMO (1.7-1.9). Por eso
    // "los electrones se ven difuminados": el preview NUNCA predecía el master.
    // El max(1.2) evita que en una ventana chica el punto caiga a sub-píxel y titile.
    gl_PointSize = max(1.2, min(uSize * (300.0 / -mv.z) * uPix, 64.0 * uPix));
    gl_Position = projectionMatrix * mv;
  }`;
const O2FLOW_FRAG = `
  varying vec3 vColor;
  varying float vNear;
  varying float vW;
  varying float vTw;
  uniform float uBright;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vNear * vTw;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * a * uBright * vW, a);
  }`;

// ═══ CAROTENO — el cromóforo que te deja VER. Reusa la DATA de chain-caroteno.bin
// (geometría + cintas π reales) pero la renderiza con el MOTOR de O₂: sprites
// grandes+tenues (densidad luminosa, no puntos), bloom, depth-fade. El WOW es
// FÍSICO: el color NACE del largo (partícula en una caja, E~1/L²). Cadena corta =
// frío/violeta (absorbe UV, "invisible"); al alargarse el salto HOMO-LUMO cae al
// visible → el río π ESTALLA en naranja (β-caroteno absorbe azul → lo ves naranja).
// Firma del viral: río CÁLIDO (figura) sobre campo FRÍO. ──
const CARO_VERT = `
  attribute float aAxis;    // 0..1 posición a lo largo del eje de la cadena
  attribute float aShell;   // 1 = espina σ · 2 = río π (el cromóforo)
  uniform float uSize;
  uniform float uReveal;     // frente de CRECIMIENTO REAL de la cadena (0→1): la conjugación
                             // se extiende unidad por unidad (posiciones REALES, en orden real)
  uniform float uTime;
  varying float vNear;
  varying float vShell;
  varying float vFlow;
  varying float vTip;
  void main() {
    vShell = aShell;
    // CRECIMIENTO por largo (formación real): lo que está más allá del frente aún no
    // existe; las partículas aparecen en su SITIO REAL, en orden real a lo largo del eje.
    float shown = smoothstep(uReveal + 0.02, uReveal - 0.06, aAxis);
    vTip = smoothstep(uReveal - 0.12, uReveal, aAxis) * shown;   // el frente donde crece brilla
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNear = smoothstep(0.22, 0.95, -mv.z) * shown;
    // el río FLUYE: una onda de brillo corre a lo largo del eje (los e⁻ π viajando)
    vFlow = 0.5 + 0.5 * sin(aAxis * 34.0 - uTime * 2.6);
    gl_PointSize = min(uSize * (300.0 / -mv.z), 60.0);
    gl_Position = projectionMatrix * mv;
  }`;
const CARO_FRAG = `
  precision highp float;
  uniform float uBright;
  uniform vec3 uColor;       // COLOR OBSERVADO REAL del cromóforo para el largo actual
                             // (LUT PySCF/FEMO: incoloro corto → naranja β-caroteno largo)
  varying float vNear;
  varying float vShell;
  varying float vFlow;
  varying float vTip;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vNear;
    if (a < 0.004) discard;
    vec3 col;
    if (vShell > 1.5) {
      // RÍO π (figura): el color que la molécula REFLEJA para su largo de conjugación
      // actual — física real por longitud (el salto HOMO-LUMO cae al visible al crecer).
      col = uColor;
    } else {
      // ESPINA σ: SIEMPRE fría (cian) — campo frío que hace POP al río (dual-cluster).
      col = vec3(0.24, 0.62, 1.0);
    }
    // el río π MANDA; la espina σ es solo una SUGERENCIA (hilo tenue que insinúa el
    // esqueleto, no compite ni sobresale). SATURACIÓN = menos brillo (más-luz-no-es-color).
    float shellB = (vShell > 1.5) ? (0.42 + 0.55 * vFlow) : (0.055 + 0.05 * vFlow);
    col += vec3(1.0, 0.85, 0.6) * vTip * 0.5;      // el frente de crecimiento chispea (tenue)
    gl_FragColor = vec4(col * a * uBright * shellB, a);
  }`;

function CarotenoFlow({ bundle, axis, cen, L, reveal, color, bright, time }:
  { bundle: AtomBundle; axis: Vec3; cen: Vec3; L: number; reveal: number; color: Vec3; bright: number; time: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const N = bundle.sizes.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(bundle.positions, 3));
    // aAxis = proyección normalizada sobre el eje de la cadena (0 punta izq → 1 der)
    const aAxis = new Float32Array(N);
    const halfL = Math.max(L, 0.5);
    for (let i = 0; i < N; i++) {
      const dx = bundle.positions[i * 3] - cen[0], dy = bundle.positions[i * 3 + 1] - cen[1], dz = bundle.positions[i * 3 + 2] - cen[2];
      const s = dx * axis[0] + dy * axis[1] + dz * axis[2];
      aAxis[i] = Math.max(0, Math.min(1, 0.5 + s / (2 * halfL)));
    }
    g.setAttribute('aAxis', new THREE.BufferAttribute(aAxis, 1));
    g.setAttribute('aShell', new THREE.BufferAttribute(bundle.shellIdx, 1));
    return g;
  }, [bundle, axis, cen, L]);
  const uniforms = useMemo(() => ({
    uSize: { value: 0.30 }, uBright: { value: bright }, uReveal: { value: reveal },
    uColor: { value: new THREE.Vector3(color[0], color[1], color[2]) }, uTime: { value: time },
  }), []);
  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uBright.value = bright;
    matRef.current.uniforms.uReveal.value = reveal;
    matRef.current.uniforms.uColor.value.set(color[0], color[1], color[2]);
    matRef.current.uniforms.uTime.value = time;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={CARO_VERT}
        fragmentShader={CARO_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// Una nube advectada: cada frame interpola las POSICIONES entre las dos separaciones
// que bracketean R(t) → las partículas se MUEVEN siguiendo la densidad (la carga
// fluye al enlace). El color es fijo por partícula (viene del .bin o constante).
function O2Cloud({ posQ, colors, Rvals, N, K, R, brightness, size, ring = 0, coreThin = 0, twinkle = 0, tw_time = 0, cores, coreR = 0.30, bonds, bondGlow = 0, qScale = O2AI_POSQ, premul = false }:
  { posQ: Int16Array; colors: Float32Array; Rvals: Float32Array; N: number; K: number; R: number; brightness: number; size: number; cores?: [number,number,number][]; coreR?: number; bonds?: [[number,number,number],[number,number,number]][]; bondGlow?: number; ring?: number; coreThin?: number; twinkle?: number; tw_time?: number; qScale?: number; premul?: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  // el tamaño del sprite se mide contra el ALTO REAL del framebuffer, no contra el píxel:
  // así el preview de 1080 muestra el mismo electrón que el master 4K (ver uPix en el vert).
  const gl = useThree(s => s.gl);
  const alto = useThree(s => s.size.height) * useThree(s => s.viewport.dpr);
  const uPix = useMemo(() => {
    const v = new THREE.Vector2(); gl.getDrawingBufferSize(v);
    return (v.y || alto || 3840) / 3840;
  }, [gl, alto]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [colors, N]);
  // CINTURÓN: el shader tiene uCores[8]/uBondA[6] FIJOS y el clamp de abajo DESCARTA los
  // que sobren EN SILENCIO — el butírico tiene 14 núcleos, o sea 6 sin anti-quemado y nadie
  // avisó. GLSL no truena por esto; el que tiene que gritar es JS.
  if ((cores?.length ?? 0) > 8) console.error(`O2Cloud: ${cores!.length} núcleos > uCores[8] — ${cores!.length - 8} SIN anti-quemado`);
  if ((bonds?.length ?? 0) > 6) console.error(`O2Cloud: ${bonds!.length} enlaces > uBondA[6] — ${bonds!.length - 6} SIN glow`);
  const uniforms = useMemo(() => ({ uSize: { value: size }, uPix: { value: 1 }, uBright: { value: brightness }, uRing: { value: ring }, uCoreThin: { value: coreThin }, uCores: { value: Array.from({length:8},(_,i)=> new THREE.Vector3(...(cores?.[i] ?? [0,0,0]))) }, uNCores: { value: Math.min(8, cores?.length ?? 0) }, uCoreR: { value: coreR }, uBondA: { value: Array.from({length:6},(_,i)=> new THREE.Vector3(...(bonds?.[i]?.[0] ?? [0,0,0]))) }, uBondB: { value: Array.from({length:6},(_,i)=> new THREE.Vector3(...(bonds?.[i]?.[1] ?? [0,0,0]))) }, uNBonds: { value: Math.min(6, bonds?.length ?? 0) }, uBondGlow: { value: bondGlow }, uTime: { value: 0 }, uTwinkle: { value: 0 } }), []);
  useEffect(() => {
    // bracket en Rvals (descendente Rmax→Rmin). frac entre k y k+1.
    let k = 0;
    if (R >= Rvals[0]) k = 0;
    else if (R <= Rvals[K - 1]) k = K - 2;
    else { while (k < K - 2 && Rvals[k + 1] > R) k++; }
    const r0 = Rvals[k], r1 = Rvals[k + 1];
    const frac = r0 === r1 ? 0 : Math.max(0, Math.min(1, (r0 - R) / (r0 - r1)));
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const o0 = k * N * 3, o1 = (k + 1) * N * 3, inv = 1 / qScale, mf = 1 - frac;
    for (let i = 0; i < N * 3; i++) arr[i] = (posQ[o0 + i] * mf + posQ[o1 + i] * frac) * inv;
    pos.needsUpdate = true;
    if (matRef.current) { matRef.current.uniforms.uSize.value = size; matRef.current.uniforms.uPix.value = uPix; matRef.current.uniforms.uBright.value = brightness;
      if (cores) { for (let i=0;i<8;i++) matRef.current.uniforms.uCores.value[i].set(...(cores[i] ?? [0,0,0])); matRef.current.uniforms.uNCores.value = Math.min(8, cores.length); matRef.current.uniforms.uCoreR.value = coreR; }
      if (bonds) { for (let i=0;i<6;i++){ matRef.current.uniforms.uBondA.value[i].set(...(bonds[i]?.[0] ?? [0,0,0])); matRef.current.uniforms.uBondB.value[i].set(...(bonds[i]?.[1] ?? [0,0,0])); } matRef.current.uniforms.uNBonds.value = Math.min(6, bonds.length); }
      matRef.current.uniforms.uBondGlow.value = bondGlow;
      matRef.current.uniforms.uRing.value = ring; matRef.current.uniforms.uCoreThin.value = coreThin; matRef.current.uniforms.uTime.value = tw_time; matRef.current.uniforms.uTwinkle.value = twinkle; }
  }, [posQ, Rvals, N, K, R, brightness, size, ring, coreThin, twinkle, tw_time, geo, cores, coreR, bonds, bondGlow, uPix]);
  return (
    <points geometry={geo} frustumCulled={false}>
      {/* premul: el frag YA sale multiplicado por `a`, pero AdditiveBlending sin
          premultipliedAlpha usa blendFunc(SRC_ALPHA, ONE) y lo vuelve a multiplicar →
          la contribución real es color·a², o sea ×0.57 de luz TIRADA y el núcleo del
          sprite ~40% más chico. Es la mitad del "sal y pimienta". Va como PROP porque
          el shader lo comparten O₂/N₂/C₂/agua v2, que son GANADORES: default false. */}
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={O2FLOW_VERT}
        fragmentShader={O2FLOW_FRAG} transparent depthWrite={false}
        premultipliedAlpha={premul} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ── Nube del ÁTOMO AISLADO (ρ atómica real, precompute-atom-cloud.py) ──
// El acto 1 de la película: DOS individuos, cada uno con su nube electrónica,
// que al acercarse SE ENTRELAZAN. Se desvanece cuando el enlace se forma (la
// atención pasa del átomo a la deformación Δρ = el enlace).
function AtomCloud({ posQ, x, brightness, shellR }:
  { posQ: Int16Array; x: number; brightness: number; shellR?: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const N = posQ.length / 3;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    // ⚠ O2AI_POSQ, NO `qScale`: qScale es un PARÁMETRO de O2Cloud que aquí no existe —
    // referenciarlo revienta la escena entera con "qScale is not defined" y el hook nunca
    // llega a ready. Así estuvo ROTO el acto de formación de las diatómicas (O₂ incluido)
    // desde que se parametrizó O2Cloud; nadie lo notó porque las aguas no pisan esta rama
    // y el typecheck lo reportaba como "error preexistente" que todos saltábamos. Lo cazó
    // la verificación de regresión de Ian (2026-08-17). El bin <mol>-atomcloud.bin es
    // bohr ×5000 (precompute-atom-cloud.py línea 12) = O2AI_POSQ.
    const inv = 1 / O2AI_POSQ;
    for (let i = 0; i < N * 3; i++) pos[i] = posQ[i] * inv;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // COLOR POR CAPA (real): la densidad radial del átomo tiene DOS picos — core 1s
    // (capa K, pegada al núcleo) y valencia 2s/2p (capa L). Corazón CÁLIDO dorado +
    // velo AZUL de valencia. Al acercarse los átomos se ve la verdad del enlace:
    // SOLO las capas de valencia se unen; los cores nunca se tocan. shellR = valle
    // radial 1s→2s REAL (calculado por elemento: O/N/F/C ~0.35, Li 1.77, Be 1.10).
    // Sin shellR usa el valle compacto de la 2ª fila (retrocompatible).
    const rv = shellR ?? 0.35, w = Math.max(0.12, rv * 0.5);
    // PALETA JOYA de la serie (O₂/C₂): core CÁLIDO oro (K, 1s pegada al núcleo) +
    // valencia MEZCLA violeta/cian con glints blancos (L, 2s difusa). Los "morados"
    // que el user pidió = la valencia violeta; la variedad (violeta·cian·glint) da el
    // destello tipo O₂. Mezcla DETERMINISTA por índice (hash) → reproducible por frame.
    const core: [number, number, number] = [1.0, 0.74, 0.34];   // ORO CÁLIDO (K)
    const valV: [number, number, number] = [0.62, 0.32, 1.0];   // VIOLETA (L) — los morados
    const valC: [number, number, number] = [0.26, 0.64, 1.0];   // CIAN (variedad joya)
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      const s = smoothstep((r - (rv - w)) / w);      // K→L centrado en el valle real
      const hRaw = (Math.sin(i * 12.9898) * 43758.5453) % 1; const h = hRaw < 0 ? hRaw + 1 : hRaw;
      let vr: number, vg: number, vb: number;
      if (h < 0.30) { vr = valC[0]; vg = valC[1]; vb = valC[2]; }        // ~30% cian
      else if (h > 0.955) { vr = 1.0; vg = 0.95; vb = 1.0; }             // ~4% glint blanco (los "puntos brillosos")
      else { vr = valV[0]; vg = valV[1]; vb = valV[2]; }                 // mayoría violeta
      col[i * 3] = core[0] * (1 - s) + vr * s;
      col[i * 3 + 1] = core[1] * (1 - s) + vg * s;
      col[i * 3 + 2] = core[2] * (1 - s) + vb * s;
    }
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return g;
  }, [posQ, N, shellR]);
  const uniforms = useMemo(() => ({ uSize: { value: 0.20 }, uBright: { value: brightness }, uRing: { value: 0 }, uCoreThin: { value: 0 } }), []);   // sprites finos = DESTELLO tipo O₂ (puntos distintos, no papilla); densidad + brillo hacen el glitter
  useEffect(() => { if (matRef.current) matRef.current.uniforms.uBright.value = brightness; }, [brightness]);
  return (
    <points geometry={geo} position={[x, 0, 0]} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={O2FLOW_VERT}
        fragmentShader={O2FLOW_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// La FORMACIÓN del enlace O₂ desde Δρ REAL: 3 nubes que fluyen al bajar R(t).
//   acumulación → color por partícula (oro σ en el eje → ámbar π): el ENLACE que nace.
//   vaciado     → azul frío tenue: de dónde salió la carga (bruma, no protagonista).
//   espín       → violeta: los 2 e⁻ π* desapareados = por qué el O₂ es magnético.
function O2BondFlow({ ai, R, swirl = 0, third, reveal = 1, aura = 1, RLag1 = 0, RLag2 = 0, ghost = 0, piSplit = null, sigmaMul = 1, pi1Mul = 1, pi2Mul = 1, spinMul = 1, boost = 1, piColors = null, thirdRing = 2.4, ionic = false, accMul = 1 }:
  { ai: O2AbInitio; R: number; swirl?: number; third?: [number, number, number]; reveal?: number; aura?: number; RLag1?: number; RLag2?: number; ghost?: number; piSplit?: Uint8Array | null; sigmaMul?: number; pi1Mul?: number; pi2Mul?: number; spinMul?: number; boost?: number; piColors?: [number, number, number][] | null; thirdRing?: number; ionic?: boolean; accMul?: number }) {
  const accColors = useMemo(() => {
    const c = new Float32Array(ai.Nacc * 3);
    for (let i = 0; i < c.length; i++) c[i] = ai.accColor[i] / 255;
    return c;
  }, [ai]);
  const depColors = useMemo(() => {
    const c = new Float32Array(ai.Ndep * 3);
    for (let i = 0; i < ai.Ndep; i++) { c[i * 3] = 0.18; c[i * 3 + 1] = 0.42; c[i * 3 + 2] = 0.95; }   // azul profundo (el teal 0.55-verde daba tinte verdoso)
    return c;
  }, [ai]);
  // 3a nube: violeta = espín (imán O₂) por defecto. Con piSplit (triple enlace):
  // la nube π se DIVIDE en sus dos MOs reales y perpendiculares → π¹ VIOLETA y
  // π² ROSA, cada uno prendible/apagable ("son tres a la vez" se VE).
  const spinColors = useMemo(() => {
    const [r, g, b] = third ?? [0.80, 0.34, 1.0];
    const c = new Float32Array(ai.Nspin * 3);
    for (let i = 0; i < ai.Nspin; i++) { c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; }
    return c;
  }, [ai, third]);
  const piAB = useMemo(() => {
    if (!piSplit || piSplit.length !== ai.Nspin) return null;
    const idxA: number[] = [], idxB: number[] = [];
    for (let i = 0; i < ai.Nspin; i++) (piSplit[i] > 127 ? idxA : idxB).push(i);
    const gather = (idx: number[]) => {
      const out = new Int16Array(ai.K * idx.length * 3);
      for (let k = 0; k < ai.K; k++) {
        const o = k * ai.Nspin * 3, oo = k * idx.length * 3;
        for (let j = 0; j < idx.length; j++) {
          const i3 = o + idx[j] * 3, j3 = oo + j * 3;
          out[j3] = ai.spinPos[i3]; out[j3 + 1] = ai.spinPos[i3 + 1]; out[j3 + 2] = ai.spinPos[i3 + 2];
        }
      }
      return out;
    };
    const cA = piColors?.[0] ?? [0.78, 0.36, 1.0];   // π¹ (default VIOLETA)
    const cB = piColors?.[1] ?? [1.0, 0.34, 0.62];   // π² (default ROSA)
    const colA = new Float32Array(idxA.length * 3); const colB = new Float32Array(idxB.length * 3);
    for (let j = 0; j < idxA.length; j++) { colA[j * 3] = cA[0]; colA[j * 3 + 1] = cA[1]; colA[j * 3 + 2] = cA[2]; }
    for (let j = 0; j < idxB.length; j++) { colB[j * 3] = cB[0]; colB[j * 3 + 1] = cB[1]; colB[j * 3 + 2] = cB[2]; }
    return { posA: gather(idxA), posB: gather(idxB), nA: idxA.length, nB: idxB.length, colA, colB };
  }, [ai, piSplit, piColors]);
  // BRILLO que se INTENSIFICA: la carga acumulada REAL en el enlace (bondMass ab initio,
  // normalizada) interpolada a R(t) → el enlace se ENCIENDE al formarse. Los electrones
  // NO aparecen/desaparecen (mismas partículas): solo brillan más donde la carga se junta.
  const bmNorm = useMemo(() => {
    // IÓNICO: la señal es la carga EN EL ION (accMass, alta desde lejos = el robo
    // a distancia); covalente: la carga en el PUENTE (bondMass, enciende al unirse).
    const src = ionic ? ai.accMass : ai.bondMass;
    let mx = 1e-6; for (let k = 0; k < ai.K; k++) mx = Math.max(mx, src[k]);
    const a = new Float32Array(ai.K); for (let k = 0; k < ai.K; k++) a[k] = src[k] / mx;
    return a;
  }, [ai, ionic]);
  let glow = 0;
  { const { Rvals, K } = ai; let k = 0;
    if (R >= Rvals[0]) k = 0; else if (R <= Rvals[K - 1]) k = K - 2;
    else { while (k < K - 2 && Rvals[k + 1] > R) k++; }
    const r0 = Rvals[k], r1 = Rvals[k + 1], f = r0 === r1 ? 0 : Math.max(0, Math.min(1, (r0 - R) / (r0 - r1)));
    glow = bmNorm[k] * (1 - f) + bmNorm[k + 1] * f; }
  const isPi = !!third;                    // 3a nube = anillo π (N₂) vs espín/imán (O₂)
  // accMul: dampener SOLO del oro (acc). H₂O v2 con cámara CERCA reventaba el oro
  // (whitegold del puente) a BLANCO por aditivo (feedback Ian) — sin tocar el morado.
  const accBright = (0.26 + 0.68 * glow) * boost * accMul;    // receta O₂: grandes+tenues = densidad LUMINOSA (no puntos duros)
  // el anillo π es la FIRMA de N₂ → más brillo y cuerpo que el espín, para que compita con
  // el puente σ dorado (como el violeta/cian competía en O₂). Ambos crecen con la carga.
  const spinBright = (isPi ? (0.55 + 0.72 * glow) : (0.34 + 0.42 * glow)) * boost;
  const spinSize = isPi ? 0.24 : 0.20;
  // sprites GRANDES y TENUES: se traslapan → densidad luminosa, no polvo. dep = bruma
  // sutil (bajita), spin/acc = brillo que crece con la carga (el enlace se enciende).
  // reveal gatea el acc (carga acumulada; esconde el artefacto RHF central a R grande).
  // aura = dep + π: la RIQUEZA que viste en O₂ desde el frame 1 — cada átomo trae su
  // aura azur (π atómica) y su bruma azul (vaciado) DESDE EL INICIO; al caer se ve la
  // carga FLUIR (advección) mientras el enlace enciende.
  return (
    <group>
      <O2Cloud posQ={ai.depPos} colors={depColors} Rvals={ai.Rvals} N={ai.Ndep} K={ai.K} R={R} brightness={(ionic ? 0.5 : 0.26) * aura * boost} size={ionic ? 0.27 : 0.17} />
      {/* π REAL girando: el ANILLO emerge de sus propias partículas. Con split:
          los DOS π perpendiculares en violeta y rosa, prendibles por separado */}
      <group rotation={[swirl * 0.7, 0, 0]}>
        {piAB ? (
          <>
            <O2Cloud posQ={piAB.posA} colors={piAB.colA} Rvals={ai.Rvals} N={piAB.nA} K={ai.K} R={R} brightness={spinBright * aura * pi1Mul} size={spinSize} ring={2.4 * reveal} />
            <O2Cloud posQ={piAB.posB} colors={piAB.colB} Rvals={ai.Rvals} N={piAB.nB} K={ai.K} R={R} brightness={spinBright * aura * pi2Mul} size={spinSize} ring={2.4 * reveal} />
          </>
        ) : (
          <O2Cloud posQ={ai.spinPos} colors={spinColors} Rvals={ai.Rvals} N={ai.Nspin} K={ai.K} R={R} brightness={spinBright * aura * spinMul} size={spinSize} ring={thirdRing * reveal} />
        )}
      </group>
      {/* ESTELAS DE FLUJO reales: doble exposición de la advección — cada partícula
          deja su fantasma en donde estaba hace 0.1s/0.2s → la dirección del flujo de
          carga se VE durante el desplome (motion-blur del dato, no dibujo) */}
      {ghost > 0.02 && RLag1 > 0 && (
        <O2Cloud posQ={ai.accPos} colors={accColors} Rvals={ai.Rvals} N={ai.Nacc} K={ai.K} R={RLag1} brightness={accBright * reveal * ghost * 0.5} size={0.20} />
      )}
      {ghost > 0.02 && RLag2 > 0 && (
        <O2Cloud posQ={ai.accPos} colors={accColors} Rvals={ai.Rvals} N={ai.Nacc} K={ai.K} R={RLag2} brightness={accBright * reveal * ghost * 0.25} size={0.18} />
      )}
      <group rotation={[swirl, 0, 0]}>
        <O2Cloud posQ={ai.accPos} colors={accColors} Rvals={ai.Rvals} N={ai.Nacc} K={ai.K} R={R} brightness={accBright * reveal * sigmaMul} size={ionic ? 0.34 : 0.22} coreThin={ionic ? 0.3 : (accMul < 1 ? 0.9 : 0.62)} />
      </group>
    </group>
  );
}

// ── Enlace: tubo emisivo tenue entre dos núcleos ──
function Bond({ a, b, time }: { a: Vec3; b: Vec3; time: number }) {
  const { mid, len, quat } = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { mid: va.clone().add(vb).multiplyScalar(0.5), len: dir.length(), quat: q };
  }, [a, b]);
  const appear = smoothstep((time - 1.2) / 1.2);
  if (appear < 0.01) return null;
  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[len * 0.012, len * 0.012, len, 10, 1, true]} />
      <meshBasicMaterial color="#bfeaff" transparent opacity={0.14 * appear} depthWrite={false} />
    </mesh>
  );
}

// DENSIDAD DE ENLACE — el término de SOLAPE 2·φ_A·φ_B del LCAO: la carga electrónica
// que se ACUMULA entre los núcleos al solaparse los orbitales. ESTO es físicamente el
// enlace (no un crossfade de dos imágenes). Se construye en un marco normalizado:
// x∈[-1,1] = a lo largo del eje de enlace (se escala entre los núcleos); el componente
// σ se concentra en el eje, el π (doble enlace de O₂) en lóbulos fuera del eje.
function buildBondBundle(): AtomBundle {
  const N = 7200;
  const positions = new Float32Array(N * 3), colors = new Float32Array(N * 3);
  const sizes = new Float32Array(N), shellIdx = new Float32Array(N);
  let s = 0x9e3779b1 >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const cSigma = new THREE.Color('#e6f3ff'), cPi = new THREE.Color('#86b8ff');
  for (let i = 0; i < N; i++) {
    const isPi = rnd() < 0.40;                         // ~40% π (doble enlace), 60% σ
    let x = gauss() * (isPi ? 0.40 : 0.42);
    x = Math.max(-0.98, Math.min(0.98, x));
    let ry: number, rz: number;
    if (isPi) { const a = rnd() * Math.PI * 2, rad = 0.24 + Math.abs(gauss()) * 0.13; ry = Math.cos(a) * rad; rz = Math.sin(a) * rad; }
    else { ry = gauss() * 0.14; rz = gauss() * 0.14; }
    positions[i * 3] = x; positions[i * 3 + 1] = ry; positions[i * 3 + 2] = rz;
    const c = isPi ? cPi : cSigma;
    const b = 0.5 + 0.5 * Math.exp(-(x * x) / (2 * 0.38 * 0.38));   // brillo máx al CENTRO (pico de densidad de enlace)
    colors[i * 3] = c.r * b; colors[i * 3 + 1] = c.g * b; colors[i * 3 + 2] = c.b * b;
    sizes[i] = 0.028 + 0.03 * (1 - Math.abs(x));
    shellIdx[i] = 0;
  }
  return { positions, colors, sizes, shellIdx, shells: [{ label: 'bond', n: 1, l: 0, color: cSigma }] };
}

// ── Explicador de los 3 ENLACES (prender/apagar) + la CARGA. Sincronizado a la
// narración: "son tres a la vez" (l05) enciende σ → π¹ → π² por separado; y en el
// clavado explica POR QUÉ el centro brilla blanco (render aditivo = densidad real). ──
const BOND_BEATS_MOL: Record<string, { t0: number; t1: number; big: string; sub: string; color: string }[]> = {
  n2: [
    { t0: 17.7, t1: 19.6, big: 'σ', sub: 'el primero — de frente', color: '#ffd76e' },
    { t0: 19.6, t1: 21.5, big: 'π', sub: 'el segundo — un anillo', color: '#c77dff' },
    { t0: 21.5, t1: 23.4, big: 'π', sub: 'el tercero — cruzado', color: '#ff7ab0' },
    { t0: 30.4, t1: 34.9, big: '', sub: 'ese brillo ES la carga: miles de cargas sumando su luz', color: '#ffffff' },
  ],
  o2: [
    { t0: 6.2, t1: 11.3, big: 'O=O', sub: 'DOS enlaces a la vez — σ y π', color: '#ffd76e' },
    { t0: 11.9, t1: 16.4, big: 'π*', sub: 'dos electrones sin pareja — EL IMÁN', color: '#c77dff' },
    { t0: 30.4, t1: 34.9, big: '', sub: 'ese brillo ES la carga: miles de cargas sumando su luz', color: '#ffffff' },
  ],
  h2: [
    { t0: 17.7, t1: 21.5, big: 'σ', sub: 'el ÚNICO — el enlace más simple del universo', color: '#ffd76e' },
    { t0: 30.4, t1: 34.9, big: '', sub: 'ese brillo ES la carga: dos electrones compartidos', color: '#ffffff' },
  ],
  f2: [
    { t0: 17.7, t1: 19.6, big: 'σ', sub: 'el único enlace — de frente', color: '#ffd76e' },
    { t0: 19.6, t1: 23.4, big: '6×2', sub: 'doce electrones apretados EMPUJÁNDOSE — por eso es débil', color: '#ff7a6a' },
    { t0: 32.6, t1: 37.4, big: '', sub: 'las líneas de la fuerza — cargas iguales SE EMPUJAN', color: '#9fc0ff' },
  ],
  c2: [
    { t0: 17.7, t1: 19.6, big: '¿σ?', sub: 'de frente... NO HAY — el carbono rompe las reglas', color: '#ffd76e' },
    { t0: 19.6, t1: 21.5, big: 'π', sub: 'un anillo puro', color: '#7db8ff' },
    { t0: 21.5, t1: 23.4, big: 'π', sub: 'y el otro, cruzado — DOBLE enlace sin frontal', color: '#a5d3ff' },
    { t0: 30.4, t1: 34.9, big: '', sub: 'ese brillo ES la carga: miles de cargas sumando su luz', color: '#ffffff' },
  ],
  // Li₂: cartas-título (como C2/O2) que ESPEJEAN la voz — el user las pidió de vuelta.
  li2: [
    { t0: 5.4, t1: 8.5, big: '+  +', sub: 'dos núcleos positivos — SE REPELEN', color: '#ff9a6a' },
    { t0: 16.0, t1: 20.4, big: '−', sub: 'la nube compartida jala a los DOS núcleos', color: '#8ec9ff' },
    { t0: 20.9, t1: 25.0, big: '', sub: 'el pozo de energía — caen al fondo y ahí se quedan', color: '#ffd76e' },
    { t0: 25.4, t1: 29.1, big: '3 e⁻', sub: 'dos amarrados al core · UNO que une', color: '#ffd76e' },
    { t0: 29.6, t1: 34.0, big: 'σ', sub: 'el más flojo — el primer enlace metal-metal', color: '#ffd76e' },
  ],
  // NaCl — EL ROBO A DISTANCIA (mecanismo del arpón). Los números salen de
  // nacl-transfer.json: q(Na) y μ por R del scan real; μ(Re) verificado al 1%.
  nacl: [
    { t0: 3.0, t1: 8.6, big: 'Na —— Cl', sub: 'AZUL: los electrones del sodio · ORO: lo que agarra el cloro', color: '#8ec9ff' },
    { t0: 14.5, t1: 19.2, big: 'MÍRALO', sub: 'el azul del sodio... se está yendo', color: '#8ec9ff' },
    { t0: 19.6, t1: 24.6, big: '¡SE LO ROBÓ!', sub: 'todo ese oro sobre el cloro ERA del sodio', color: '#ffd76e' },
    { t0: 25.2, t1: 29.6, big: '+ −', sub: 'dos iones que ya no pueden soltarse', color: '#ffd76e' },
    { t0: 30.1, t1: 34.4, big: '9 D', sub: 'el jalón gigante: calculado 9.1 — medido 9.0', color: '#c9a6ff' },
  ],
  // HF — EL JALONEO (polar): jala pero no arranca; el contraste con el robo de NaCl.
  hf: [
    { t0: 3.0, t1: 8.6, big: 'H —— F', sub: 'el átomo más chico · contra el más hambriento', color: '#8ec9ff' },
    { t0: 14.5, t1: 19.2, big: 'JALA', sub: 'el flúor tuerce la nube hacia él — pero no la arranca', color: '#8ec9ff' },
    { t0: 19.6, t1: 24.6, big: 'NO PUEDE', sub: 'el hidrógeno no suelta — la comparten TORCIDA', color: '#ffd76e' },
    { t0: 25.2, t1: 29.6, big: 'δ− δ+', sub: 'un lado casi negativo, otro casi positivo: POLAR', color: '#ffd76e' },
    { t0: 30.1, t1: 34.4, big: '1.9 D', sub: 'el jalón: calculado 1.94 — medido 1.83', color: '#c9a6ff' },
  ],
  // HCl — EL ÁCIDO: cierra la trilogía del jalón (NaCl robo / HF no puede / HCl suave
  // y cotidiano). Números del scan real (hcl-transfer.json): q(H)=+0.17. Beats ABSOLUTOS
  // (se reajustan con las duraciones reales del TTS). Anclados al buceo al núcleo ~33-48 s.
  hcl: [
    { t0: 2.4, t1: 8.9, big: 'H —— Cl', sub: 'el ácido que tienes AHORITA en el estómago', color: '#8ec9ff' },
    { t0: 13.9, t1: 20.5, big: 'JALA', sub: 'el cloro tuerce la nube hacia él — suave, no la arranca', color: '#8ec9ff' },
    { t0: 21.0, t1: 30.8, big: '+0.17', sub: 'el jalón más leve: robo 0.98 · flúor 0.35 · cloro 0.17', color: '#ffd76e' },
    { t0: 31.4, t1: 37.8, big: 'δ+ δ−', sub: 'un lado + y otro − : eso es POLAR', color: '#ffd76e' },
    { t0: 50.5, t1: 57.5, big: '1.27 Å', sub: 'la distancia medida — verificada al 0.5%', color: '#c9a6ff' },
  ],
  // CO — EL ABRAZO ASESINO. Números del scan real (co-transfer.json) y medidos:
  // 1072 kJ/mol (enlace más fuerte), hemoglobina ~240× vs O₂, μ = 0.11 D medido.
  // Beats ABSOLUTOS: anclados a las duraciones REALES del TTS (aire ≥0.48) Y al
  // buceo al núcleo de la escena (~33-50 s) — por eso "Ven. Mira el corazón" es
  // la línea 6, no la 8. Cada tarjeta cubre la línea que la nombra: la tarjeta
  // NUNCA dice el dato antes que la voz.
  co: [
    { t0: 2.4, t1: 8.5, big: 'C —— O', sub: 'dos átomos comunes — a punto del abrazo más fuerte que existe', color: '#8ec9ff' },
    { t0: 16.4, t1: 26.0, big: '≡', sub: 'TRES a la vez: σ y dos anillos π', color: '#ff7a6a' },
    { t0: 26.3, t1: 31.8, big: '1072', sub: 'kJ/mol — el enlace más fuerte de la naturaleza', color: '#ffd76e' },
    { t0: 38.8, t1: 47.8, big: '240×', sub: 'así se agarra de tu sangre — 240 veces más que el oxígeno', color: '#ff5a5a' },
    { t0: 53.8, t1: 60.8, big: '0.1 D', sub: 'y por fuera casi ni se nota: perfectamente balanceado', color: '#c9a6ff' },
  ],
  // NO — EL MENSAJERO. Beats ABSOLUTOS desde las duraciones reales del TTS (aire 0.70)
  // y anclados al buceo al núcleo (~33 s) → "Ven. Mira el corazón" es la línea 6.
  // Datos: 11 e⁻ de valencia (impar), orden 2.5, Nobel de Medicina 1998 (Furchgott,
  // Ignarro, Murad — el NO como señal que relaja el músculo liso vascular).
  no: [
    { t0: 2.4, t1: 8.6, big: 'N —— O', sub: 'del escape del coche… y de tus arterias', color: '#8ec9ff' },
    { t0: 14.0, t1: 20.2, big: '11 e⁻', sub: 'un número IMPAR — uno se queda solo', color: '#4ff0dc' },
    { t0: 20.7, t1: 26.5, big: 'RADICAL', sub: 'un electrón SIN PAREJA', color: '#4ff0dc' },
    { t0: 26.9, t1: 32.5, big: '2.5', sub: 'ni doble ni triple — medio enlace menos', color: '#ffd76e' },
    { t0: 44.1, t1: 50.0, big: '1998', sub: 'así le hablan tus arterias al músculo', color: '#c9a6ff' },
  ],
  // H₂O — EL AGUA (TRIATÓMICO): la historia es el ÁNGULO. 104.5° medido; los 2 pares
  // libres del O empujan → doblan la molécula → polar → disuelve/hielo flota/vida.
  // Beats DRAFT — se reajustan con las duraciones reales del TTS (beats absolutos).
  // v2: CONTESTA las preguntas de los comentarios y REFUERZA con tarjetas. Beats
  // absolutos a la voz nueva (l1 2.5 · l3 14.6 · l4 20.72 · l7 39.76 · l9 53.01).
  h2o: [
    { t0: 2.4, t1: 7.5, big: 'H₂O', sub: 'todo lo que eres cuelga de su forma', color: '#8ec9ff' },
    { t0: 14.6, t1: 20.4, big: 'chueca', sub: 'la nube se carga de un solo lado — ¿por qué?', color: '#ffd76e' },
    { t0: 20.7, t1: 32.8, big: '2 nubes', sub: 'los electrones que el oxígeno NO comparte: las moradas', color: '#c99cff' },
    { t0: 39.8, t1: 45.6, big: 'imán', sub: 'un lado + y otro − : por eso se pega a sí misma', color: '#ffd76e' },
    { t0: 52.9, t1: 59.5, big: 'ni mares', sub: 'si fuera recta, no habría gotas ni tú', color: '#ff9ac9' },
  ],
  // Be₂ FANTASMA: σ2g junta la carga, σ2u* la BORRA → orden 0; y aun así existe por correlación.
  be2: [
    { t0: 14.8, t1: 18.5, big: 'σ2g', sub: 'un enlace intenta formarse — la carga se junta', color: '#ffd76e' },
    { t0: 18.5, t1: 23.0, big: 'σ2u*', sub: 'pero su gemelo la BORRA — orden de enlace CERO', color: '#5ad0ff' },
    { t0: 23.5, t1: 29.2, big: '0', sub: 'no debería existir… y existe, atado por pura correlación', color: '#c9a6ff' },
    { t0: 30.4, t1: 34.9, big: '', sub: 'el enlace fantasma: un susurro que el diagrama no ve', color: '#ffffff' },
  ],
};
function BondExplainer({ time, vertical, mol = 'n2' }: { time: number; vertical: boolean; mol?: string }) {
  const BOND_BEATS = BOND_BEATS_MOL[mol] ?? BOND_BEATS_MOL.n2;
  const b = BOND_BEATS.find(x => time >= x.t0 && time <= x.t1 + 0.35);
  if (!b) return null;
  const op = Math.min(1, Math.max(0, (time - b.t0) / 0.3)) * Math.min(1, Math.max(0, (b.t1 + 0.35 - time) / 0.35));
  if (op < 0.01) return null;
  return (
    <div style={{ position: 'absolute', top: vertical ? '16%' : '12%', left: 0, right: 0, zIndex: 11,
      pointerEvents: 'none', opacity: op, textAlign: 'center', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {b.big && <div style={{ fontSize: vertical ? '13vw' : '4vw', fontWeight: 200, color: b.color, lineHeight: 1,
        textShadow: `0 0 46px ${b.color}66, 0 3px 30px rgba(0,0,0,0.9)` }}>{b.big}</div>}
      <div style={{ fontSize: vertical ? '3.6vw' : '1.1vw', fontWeight: 500, color: b.big ? b.color : 'rgba(255,255,255,0.92)',
        letterSpacing: '0.12em', marginTop: vertical ? '1.2vw' : 8, textTransform: 'uppercase',
        textShadow: '0 2px 24px rgba(0,0,0,0.9)' }}>{b.sub}</div>
    </div>
  );
}

// ── F₂: LÍNEAS DE FUERZA de la repulsión (las guías). Campo E REAL de dos cargas
// IGUALES (+,+) en los núcleos, integrado numéricamente: las líneas que nacen
// mirando al otro átomo se DOBLAN lejos del plano medio — el muro de carga se VE
// (cero flujo cruza el plano entre cargas iguales, física exacta). Pulsos viajan
// a lo largo = la dirección del empujón. Tenue: guía, no protagonista. ──
const REP_NP = 8;   // pulsos por línea
function RepulsionField({ nx, time }: { nx: number; time: number }) {
  // los tamaños de punto van en PÍXELES del buffer: escalar con la resolución real
  // (a 4K los sprites fijos se hacen polvo — gotcha frame-vacío-por-tamaño)
  const { size, viewport } = useThree();
  const pxScale = Math.max(1, (size.height * viewport.dpr) / 960);
  const built = useMemo(() => {
    const a1 = new THREE.Vector3(-nx, 0, 0), a2 = new THREE.Vector3(nx, 0, 0);
    const E = (p: THREE.Vector3) => {
      const d1 = p.clone().sub(a1), d2 = p.clone().sub(a2);
      const r1 = Math.max(d1.length(), 0.08), r2 = Math.max(d2.length(), 0.08);
      return d1.multiplyScalar(1 / (r1 * r1 * r1)).add(d2.multiplyScalar(1 / (r2 * r2 * r2)));
    };
    const polys: Float32Array[] = [];
    for (const sgn of [-1, 1]) {
      const org = sgn < 0 ? a1 : a2;
      for (let j = 0; j < 10; j++) {
        const th = (0.55 + 0.90 * ((j % 5) / 4));               // 31°..83° del eje, hacia el OTRO átomo
        const ph = (j < 5 ? 0 : Math.PI / 5) + (j % 5) * (2 * Math.PI / 5);
        const dir = new THREE.Vector3(-sgn * Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph));
        const p = org.clone().add(dir.multiplyScalar(0.55));
        const pts: number[] = [p.x, p.y, p.z];
        for (let s = 0; s < 150; s++) {
          const e = E(p); const el = e.length();
          if (el < 1e-6) break;
          p.add(e.multiplyScalar(0.045 / el));
          pts.push(p.x, p.y, p.z);
          if (p.length() > 4.4) break;
        }
        if (pts.length >= 25 * 3) polys.push(new Float32Array(pts));
      }
    }
    // segmentos fusionados (p_i → p_{i+1}) con parámetro de arco para el fade
    let nseg = 0;
    for (const pl of polys) nseg += pl.length / 3 - 1;
    const pos = new Float32Array(nseg * 6), aS = new Float32Array(nseg * 2);
    let o = 0, os = 0;
    for (const pl of polys) {
      const n = pl.length / 3;
      for (let i = 0; i < n - 1; i++) {
        pos.set(pl.subarray(i * 3, i * 3 + 6), o); o += 6;
        aS[os++] = i / (n - 1); aS[os++] = (i + 1) / (n - 1);
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lineGeo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    const ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(polys.length * REP_NP * 3), 3));
    const lineMat = new THREE.ShaderMaterial({
      uniforms: { uOp: { value: 0 }, uCol: { value: new THREE.Color(0.55, 0.72, 1.0) } },
      vertexShader: `attribute float aS; varying float vS;
        void main(){ vS=aS; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uOp; uniform vec3 uCol; varying float vS;
        void main(){
          float s = clamp(vS, 0.0, 1.0);
          // max() blinda contra sin() microscópicamente negativo: pow(neg)=NaN y el
          // bloom del composer propaga UN NaN a todo el frame (frame negro total)
          float a = uOp*(0.05+0.60*pow(max(sin(3.14159*s), 0.0), 1.3));
          gl_FragColor = vec4(uCol*a*3.2, a); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true });
    const ptsMat = new THREE.ShaderMaterial({
      uniforms: { uOp: { value: 0 }, uScale: { value: 1 }, uCol: { value: new THREE.Color(0.78, 0.87, 1.0) } },
      vertexShader: `uniform float uScale; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize=min(44.0*uScale, 34.0*uScale/max(0.35,-mv.z)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uOp; uniform vec3 uCol;
        void main(){ vec2 q=gl_PointCoord-0.5; float a=uOp*exp(-dot(q,q)*14.0); gl_FragColor=vec4(uCol*a*1.6,a); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    return { polys, lineGeo, ptsGeo, lineMat, ptsMat };
  }, [nx]);
  const op = smoothstep((time - 31.8) / 1.6) * (1 - smoothstep((time - 53.6) / 1.4));
  if (op < 0.01) return null;
  built.lineMat.uniforms.uOp.value = 0.85 * op;
  built.ptsMat.uniforms.uOp.value = 1.15 * op;
  built.ptsMat.uniforms.uScale.value = pxScale;
  // pulsos: viajan del nacimiento (junto al átomo) hacia AFUERA = la dirección del empujón
  const parr = built.ptsGeo.attributes.position.array as Float32Array;
  let k3 = 0;
  built.polys.forEach((pl, i) => {
    const n = pl.length / 3;
    for (let j = 0; j < REP_NP; j++) {
      const s = ((time * 0.11 + j / REP_NP + i * 0.037) % 1 + 1) % 1;
      const x = s * (n - 1), i0 = Math.floor(x), fr = x - i0, i1 = Math.min(n - 1, i0 + 1);
      parr[k3++] = pl[i0 * 3] * (1 - fr) + pl[i1 * 3] * fr;
      parr[k3++] = pl[i0 * 3 + 1] * (1 - fr) + pl[i1 * 3 + 1] * fr;
      parr[k3++] = pl[i0 * 3 + 2] * (1 - fr) + pl[i1 * 3 + 2] * fr;
    }
  });
  built.ptsGeo.attributes.position.needsUpdate = true;
  return <group>
    <lineSegments geometry={built.lineGeo} material={built.lineMat} />
    <points geometry={built.ptsGeo} material={built.ptsMat} />
  </group>;
}

// ═══ AGUA QUE INTERACTÚA — dímero/cluster + PUENTE DE HIDRÓGENO + campo E real ═══
// Lee water-<modo>.bin (precompute-water-field.py): Δρ de interacción (oro=acumula,
// azul=vacía), líneas de campo (cian, del δ+ H al δ− O vecino) y núcleos. Es la
// propiedad que define al agua: por qué se pega a sí misma → mares, gotas, hielo flota.
const WATER_POSQ = 2000;
interface WaterData {
  acc: Float32Array; dep: Float32Array | null; NL: number; LP: number;
  lines: Float32Array | null; nuc: { z: number; pos: Vec3 }[]; ex: number;
}
function parseWaterField(buf: ArrayBuffer): WaterData {
  const dv = new DataView(buf); const inv = 1 / WATER_POSQ;
  const accN = dv.getInt32(0, true), depN = dv.getInt32(4, true), NL = dv.getInt32(8, true), LP = dv.getInt32(12, true), NA = dv.getInt32(16, true);
  let off = 20;
  const rd = (n: number) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) { a[i] = dv.getInt16(off, true) * inv; off += 2; } return a; };
  const acc = rd(accN * 3);
  const dep = depN ? rd(depN * 3) : null;
  const lines = NL ? rd(NL * LP * 3) : null;
  const zs: number[] = []; for (let i = 0; i < NA; i++) { zs.push(dv.getInt16(off, true)); off += 2; }
  const nuc: { z: number; pos: Vec3 }[] = [];
  for (let i = 0; i < NA; i++) { const x = dv.getInt16(off, true) * inv; off += 2; const y = dv.getInt16(off, true) * inv; off += 2; const z = dv.getInt16(off, true) * inv; off += 2; nuc.push({ z: zs[i], pos: [x, y, z] }); }
  let ex = 1; for (const a of nuc) ex = Math.max(ex, Math.hypot(a.pos[0], a.pos[1], a.pos[2]));
  return { acc, dep, NL, LP, lines, nuc, ex };
}

// nube de puntos aditivos (reusa el shader O2FLOW) con color uniforme
function WaterCloud({ pos, color, size, bright }: { pos: Float32Array; color: [number, number, number]; size: number; bright: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) { c[i] = color[0]; c[i + 1] = color[1]; c[i + 2] = color[2]; }
    g.setAttribute('aColor', new THREE.BufferAttribute(c, 3));
    return g;
  }, [pos, color]);
  const uniforms = useMemo(() => ({ uSize: { value: size }, uBright: { value: bright }, uRing: { value: 0 }, uCoreThin: { value: 0 } }), [size, bright]);
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial uniforms={uniforms} vertexShader={O2FLOW_VERT} fragmentShader={O2FLOW_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// líneas de campo cian con FLUJO (pulso que corre del + al −)
const WFIELD_VERT = `attribute float aU; varying float vU; uniform float uT;
  void main(){ vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const WFIELD_FRAG = `varying float vU; uniform float uT; uniform float uOp; uniform vec3 uCol;
  void main(){ float flow = fract(vU*3.0 - uT*0.5); float p = 0.34 + 0.78*smoothstep(0.0,0.25,flow)*(1.0-smoothstep(0.55,0.95,flow));
    gl_FragColor = vec4(uCol*p*uOp*2.4, p*uOp); }`;
function WaterFieldLines({ lines, NL, LP, time, reveal }: { lines: Float32Array; NL: number; LP: number; time: number; reveal: number }) {
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const segPerLine = LP - 1; const nv = NL * segPerLine * 2;
    const pos = new Float32Array(nv * 3); const us = new Float32Array(nv);
    let o = 0, uo = 0;
    for (let j = 0; j < NL; j++) {
      const b = j * LP * 3;
      for (let s = 0; s < segPerLine; s++) {
        const i0 = b + s * 3, i1 = b + (s + 1) * 3;
        pos[o++] = lines[i0]; pos[o++] = lines[i0 + 1]; pos[o++] = lines[i0 + 2];
        pos[o++] = lines[i1]; pos[o++] = lines[i1 + 1]; pos[o++] = lines[i1 + 2];
        us[uo++] = s / segPerLine; us[uo++] = (s + 1) / segPerLine;
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aU', new THREE.BufferAttribute(us, 1));
    const m = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uOp: { value: 1 }, uCol: { value: new THREE.Color(0.31, 0.94, 0.86) } },
      vertexShader: WFIELD_VERT, fragmentShader: WFIELD_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return { geo: g, mat: m };
  }, [lines, NL, LP]);
  mat.uniforms.uT.value = time; mat.uniforms.uOp.value = reveal;
  return <lineSegments geometry={geo} material={mat} />;
}

// cámara del agua: órbita lenta con peso, eje O-O VERTICAL (roll π/2 → llena 9:16),
// mira al centro; el barrido abre el plano para que se vea el PUENTE entre las dos.
function WaterCamera({ time, ex, dur }: { time: number; ex: number; dur: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const t = time; const k = Math.min(1, t / dur);
    // FRAME 1 = EL PICO: abre CERCA y de frente al plano del campo (el puente llena
    // el cuadro, glorioso), luego respira hacia afuera revelando las dos moléculas.
    const kout = k * k * (3 - 2 * k);                                                   // ease del pull-back
    const az = 1.5 + 0.5 * Math.sin(k * Math.PI * 0.9) + 0.05 * Math.sin(t * 0.13);     // casi de frente al plano (líneas visibles)
    const el = 0.05 + 0.10 * Math.sin(k * Math.PI * 1.2);                               // casi a nivel del plano
    const dist = ex * (1.08 + 1.15 * kout - 0.06 * Math.sin(k * Math.PI * 2));          // MUY CERCA en t=0 (pico, llena el cuadro) → abre revelando
    const cp = Math.cos(el);
    const pos: Vec3 = [dist * cp * Math.cos(az), dist * Math.sin(el), dist * cp * Math.sin(az)];
    camera.position.set(pos[0], pos[1], pos[2]);
    const fwd = new THREE.Vector3(-pos[0], -pos[1], -pos[2]).normalize();
    const up0 = new THREE.Vector3(0, 1, 0); if (Math.abs(fwd.dot(up0)) > 0.94) up0.set(0, 0, 1);
    const right = new THREE.Vector3().crossVectors(fwd, up0).normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const roll = Math.PI / 2 + 0.02 * Math.sin(t * 0.11);
    camera.up.copy(trueUp.multiplyScalar(Math.cos(roll)).add(right.multiplyScalar(Math.sin(roll))));
    camera.lookAt(0, 0, 0);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 40; cam.near = Math.max(0.01, dist * 0.03); cam.far = 200; cam.updateProjectionMatrix();
  }, [time, ex, dur, camera]);
  return null;
}

function WaterField({ molKey, time, dur, onReady }: { molKey: string; time: number; dur: number; onReady?: (r: boolean) => void }) {
  const [wd, setWd] = useState<WaterData | null>(null);
  const mode = molKey === 'whex' ? 'hexamer' : molKey === 'wsingle' ? 'single' : 'dimer';
  useEffect(() => {
    let alive = true; setWd(null);
    fetch(`/precomputed/water-${mode}.bin`).then(r => r.arrayBuffer())
      .then(buf => { if (alive) { setWd(parseWaterField(buf)); onReady?.(true); } })
      .catch(e => console.error('water bin load failed', e));
    return () => { alive = false; };
  }, [mode, onReady]);
  if (!wd) return null;
  // FRAME 1 = EL PICO (regla dura): el puente ya está ENCENDIDO y glorioso desde el
  // segundo cero — el campo NO se hace esperar (antes t~3-7s = gancho débil, gancho 35/100).
  const reveal = Math.min(1, time / 0.5 + 0.55);
  return (
    <>
      <WaterCamera time={time} ex={wd.ex} dur={dur} />
      {wd.dep && <WaterCloud pos={wd.dep} color={[0.20, 0.45, 1.0]} size={0.22} bright={0.30} />}
      <WaterCloud pos={wd.acc} color={[1.0, 0.72, 0.30]} size={0.24} bright={0.5} />
      {wd.lines && <WaterFieldLines lines={wd.lines} NL={wd.NL} LP={wd.LP} time={time} reveal={reveal} />}
      {wd.nuc.map((n, i) => (
        <group key={i} position={n.pos}>
          <Nucleus protons={n.z} neutrons={n.z === 8 ? 8 : 0} time={time}
            clusterRadius={(n.z === 8 ? 0.10 : 0.055)} nHot={[0.62, 0.9, 1.35]} nHue={0.55} />
        </group>
      ))}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EL PUENTE (wpair) — 2 aguas ab initio acercándose. Render con O2Cloud de V1 (la
// nube DENSA), indexado por R(t): lejos → pegadas. Cuenta el mecanismo: el campo de
// una MODIFICA los electrones de la otra (Δρ REAL). acc=ρ (oro+morado), spin=Δρ>0
// (morado GLOW = electrones que LLEGAN, el puente), dep=Δρ<0 (azul = de dónde salen).
// ══════════════════════════════════════════════════════════════════════════════
interface WAPData {
  Nacc: number; Ndep: number; Nspin: number; K: number; NNUC: number; NL: number; LP: number;
  Rvals: Float32Array; bondMass: Float32Array; accColor: Float32Array; Z: Int16Array;
  accPos: Int16Array; depPos: Int16Array; spinPos: Int16Array; nucPos: Int16Array; fieldLines: Int16Array;
  /** escala de cuantización leída del ENCABEZADO (bohr = int16/posq). Los .bin viejos traen 5000. */
  posq: number;
}
function parseWAP2(buf: ArrayBuffer): WAPData {
  const dv = new DataView(buf); let off = 4;   // salta magic 'WAP2'
  const gi = () => { const v = dv.getInt32(off, true); off += 4; return v; };
  const Nacc = gi(), Ndep = gi(), Nspin = gi(), K = gi(), NNUC = gi(), NL = gi(), LP = gi();
  // POSQ SE LEE DEL ENCABEZADO (2026-07-28). Estaba escrito en el .bin desde siempre y el
  // parser lo tiraba, asumiendo O2AI_POSQ=5000 → techo de int16 en 32767/5000 = 6.5534
  // bohr POR EJE. Medido en el anillo abierto: 9.56 % de las partículas aplastadas contra
  // x=±6.5534 y 4.93 % contra y — un CUBO de caras planas, justo en los cuadros del gancho.
  // Leerlo es retro-compatible: los .bin viejos traen 5000 en el encabezado.
  const posq = dv.getFloat32(off, true);
  off += 4 + 8;   // POSQ + Rmin + Rmax
  const Rvals = new Float32Array(buf.slice(off, off + K * 4)); off += K * 4;
  const bondMass = new Float32Array(buf.slice(off, off + K * 4)); off += K * 4;
  const acU = new Uint8Array(buf.slice(off, off + Nacc * 3)); off += Nacc * 3;
  const accColor = new Float32Array(Nacc * 3); for (let i = 0; i < Nacc * 3; i++) accColor[i] = acU[i] / 255;
  const Z = new Int16Array(buf.slice(off, off + NNUC * 2)); off += NNUC * 2;
  const rd = (n: number) => { const a = new Int16Array(buf.slice(off, off + n * 2)); off += n * 2; return a; };
  const accPos = rd(K * Nacc * 3), depPos = rd(K * Ndep * 3), spinPos = rd(K * Nspin * 3);
  const nucPos = rd(K * NNUC * 3), fieldLines = rd(K * NL * LP * 3);
  return { Nacc, Ndep, Nspin, K, NNUC, NL, LP, posq, Rvals, bondMass, accColor, Z, accPos, depPos, spinPos, nucPos, fieldLines };
}
function wapBracket(Rvals: Float32Array, K: number, R: number) {
  let k = 0;
  if (R >= Rvals[0]) k = 0; else if (R <= Rvals[K - 1]) k = K - 2;
  else { while (k < K - 2 && Rvals[k + 1] > R) k++; }
  const r0 = Rvals[k], r1 = Rvals[k + 1];
  const frac = r0 === r1 ? 0 : Math.max(0, Math.min(1, (r0 - R) / (r0 - r1)));
  return { k, frac };
}
// CÁMARA QUE VIAJA — REUSA la gramática de tomas de la serie (playShots + camera-shots.ts),
// igual que O2/agua v2. NADA de cámara fija inventada. Secuencia mapeada al guion (77s).
// COREOGRAFÍA DE CAPAS COMO DATOS (capas.ts). Cada capa es un objeto direccionable:
// se prende, se apaga y se le sube el brillo por ventanas del guion — sin tocar el motor.
// Un video nuevo trae SU spec; esto puede vivir en videos/<id>.json o servir botones del CAD.
const WPAIR_CAPAS: CapasSpec = {
  nubes:    { base: 1,    mods: [{ wins: [[41.5, 50.8]], a: -0.42, label: 'el CAMPO solo (nubes a 58%, no a muerto — el verificador cazó "alambre azul")' }] },
  campo:    { base: 1,    mods: [{ wins: [[7.2, 19.6], [61.8, 68.8]], a: -0.85, label: 'campo BAJA: electrones (l3-6) y enlace=nube (l17-18)' }] },
  parpadeo: { base: 0.42, mods: [{ wins: [[7.2, 19.6]], a: 0.42, label: 'PARPADEO: "son poquitos, parpadeando"' }] },
  spin:     { base: 1,    mods: [{ wins: [[28.8, 40.5], [51.5, 68.8]], a: 0.9, label: 'Δρ magenta ARDE: cargas parciales + acercamiento/enlace' }] },
  acc:      { base: 1,    mods: [{ wins: [[19.8, 28.6]], a: 0.5, label: 'ORO del oxígeno ("el corazón dorado es el oxígeno")' }] },
};
// CAPAS DEL ANILLO — derivadas de la VOZ (recalibrar-beats.py sobre segs.json), no a mano.
const WTRI_CAPAS: CapasSpec = {
  // Fronteras REALES tras el corte de 7 líneas (voz 69.9 s, video 72.9 s):
  //   ringWide 0-10.3 · ringOne 10.7-18.3 · ringFaceOn 18.7-26.6 · ringToBridge 27.0-31.4
  //   ringFaceOn 31.8-35.7 · loomPush 36.1-42.4 · ringEdgeToFace 42.8-54.2 · crashIn 54.6-61.4
  //   pullOut 61.8-72.9
  campo:    { base: 0.55, mods: [
    { wins: [[0.0, 10.5]],  a: 1.00, label: 'FRAME 0 = EL PICO: el campo entra a tope' },
    { wins: [[28.1, 33.0]], a: 1.05, label: 'PROTAGONISTA: nace el puente / es carga moviéndose' },
    { wins: [[37.9, 46.0]], a: 0.85, label: 'la fuerza: los tres jalan más' },
    { wins: [[10.9, 18.9]], a: -0.40, label: 'baja cuando la voz mira los electrones de UNA' } ] },
  nubes:    { base: 1, mods: [{ wins: [[28.1, 33.0], [46.4, 58.3]], a: -0.34, label: 'deja LEER el puente y el pucker' }] },
  parpadeo: { base: 0.42, mods: [{ wins: [[10.9, 18.9]], a: 0.42, label: 'los electrones parpadean cuando se nombran' }] },
  spin:     { base: 1, mods: [{ wins: [[28.1, 33.0], [37.9, 46.0]], a: 0.85, label: 'Δρ ARDE: el puente y la cooperatividad' }] },
  acc:      { base: 1, mods: [{ wins: [[10.9, 18.9]], a: 0.45, label: 'ORO del oxígeno' }] },
  enlaces:  { base: 0, mods: [{ wins: [[0.0, 18.9], [46.4, 65.9]], a: 1.0, label: 'los 3 átomos desde el segundo 0 y la firma' }] },
  dipolo:   { base: 0, mods: [{ wins: [[46.4, 65.9]], a: 1.0, label: 'FIRMA: se ve que una apunta al contrario' }] },
  // los CEROS del campo: APAGADOS. La física está bien (E=0 exacto, |E| ~1e-20) y el JSON se
  // queda, pero el anillo cae donde el campo es MÁS DÉBIL — justo donde el corte térmico deja
  // de dibujar líneas. Resultado: un aro flotando en el vacío sin NADA que se vea cancelar.
  // Ian, 2026-07-29: "veo 3 círculos mostrando cómo se cancelan, pero nunca veo ninguna línea
  // cerca". Para revivirlos hay que resolver primero eso: dibujar las líneas que MUEREN en el
  // cero (integrar hacia el punto crítico en vez de cortar por |E| mínimo).
  ceros:    { base: 0, mods: [] },
  apertura: { base: 0.10, mods: [
    // EL VIAJE (Ian, 2026-07-28: "hay muy poca separación, no se muestra el viaje ni cómo se
    // va modificando el campo… que se alejen más y se acerquen, se queden un ratito vibrando
    // compartiendo carga, y se vuelvan a alejar"). Antes el recorrido se quedaba corto: la
    // apertura llegaba a 0.60 y el O–O a 4.5 Å. Ahora va hasta 0.92 (O–O 5.4 Å, el máximo
    // que el .bin tiene calculado ab initio) y BAJA a ~0.10 (2.9 Å) para quedarse VIBRANDO
    // mientras la voz habla del puente y de la cooperatividad. Cada tramo, motivado:
    { wins: [[0.0, 9.0]],   a: 0.82, label: 'LEJOS de verdad: tres moléculas sueltas, se cuentan' },
    { wins: [[9.7, 19.0]],  a: 0.55, label: 'siguen separadas mientras mira UNA' },
    { wins: [[19.5, 26.0]], a: 0.30, label: 'SE ACERCAN: se acomodan en un anillo' },
    { wins: [[19.5, 32.0]], a: 0.10, label: 'y CIERRAN en el puente / "el anillo cierra"' },
    // 33-58: QUIETAS Y VIBRANDO (la respiración del modo O···O manda) = compartiendo carga
    { wins: [[59.5, 66.0]], a: 0.30, label: '"AGUANTA MÁS": se estiran y VUELVEN' },
    { wins: [[70.0, 77.7]], a: 0.68, label: 'PAYOFF: se vuelven a alejar — el viaje cierra donde empezó' } ] },
};
// CAPAS DEL CUARTETO — fronteras tomadas de los ARRANQUES REALES de segs.json (voz 79.5 s).
// Portadas A MANO desde WTRI_CAPAS: recalibrar-beats.py regenera esta sección desde una
// plantilla vieja y pierde enlaces/dipolo/apertura (aviso ya pagado en el anillo).
//   ringWide 0.4-2.9 · ringOne 2.9-10.1 · faceOn lejos 10.1-14.7 · toBridge 14.7-23.2
//   faceOn cerca 23.2-31.8 · faceOn azim 31.8-38.8 · ALTERNANCIA 38.8-43.9 · FIRMA 43.9-49.1
//   loomPush 49.1-55.8 · números 55.8-66.2 · crashIn 66.2-70.0 · pullOut 70.0-82.0
const WTET_CAPAS: CapasSpec = {
  // FRONTERAS = arranques REALES de segs.json (voz 85.51 s, 27 líneas):
  //   GANCHO de canto 0-13.53 · contraste 13.53-26.37 · UNA molécula 26.37-33.85
  //   puentes 33.85-41.91 · idénticos 41.91-54.02 · cooperatividad 54.02-61.12
  //   firma+números 61.12-71.67 · crash 71.67-75.50 · payoff 75.50-88.00
  //
  // ⚡ TODO LO DE ABAJO ESTÁ PUESTO PARA QUE t=0 SEA EL VIEJO t=40, valor por valor:
  //   apertura 0.10 (CERRADO) · dipolo 1.0 (las flechas) · enlaces 1.0 · nubes 0.66 ·
  //   campo 0.55 (su base, sin realce) · spin 1.0 · acc 1.0 · parpadeo 0.42.
  // No es "parecido al segundo 40": es el mismo estado. Ian pidió ESA escena, no una versión.
  campo:    { base: 0.55, mods: [
    { wins: [[33.85, 41.91]], a: 1.05, label: 'PROTAGONISTA: "presta un hidrógeno" — el puente es carga moviéndose' },
    { wins: [[54.02, 61.12]], a: 0.85, label: 'la fuerza: los cuatro jalan más juntos' } ] },
  nubes:    { base: 1, mods: [
    { wins: [[0.0, 13.53]], a: -0.34, label: 'EL GANCHO: la nube cede para que se LEAN las 4 flechas' },
    { wins: [[33.85, 41.91], [61.12, 71.67]], a: -0.34, label: 'deja leer el puente y la firma' } ] },
  parpadeo: { base: 0.42, mods: [{ wins: [[26.37, 33.85]], a: 0.42, label: 'la molécula sola respira mientras se deletrea H₂O' }] },
  spin:     { base: 1, mods: [{ wins: [[33.85, 41.91], [54.02, 61.12]], a: 0.85, label: 'Δρ ARDE: los puentes y la cooperatividad' }] },
  acc:      { base: 1, mods: [{ wins: [[26.37, 33.85]], a: 0.45, label: 'ORO del oxígeno' }] },
  enlaces:  { base: 0, mods: [
    { wins: [[0.0, 13.53]], a: 1.0, label: 'desde el FRAME 0: los 3 átomos de cada una' },
    { wins: [[26.37, 33.85], [61.12, 75.50]], a: 1.0, label: 'legibilidad y firma' } ] },
  // LAS FLECHAS SON EL GANCHO. En el anillo el dipolo señalaba LA VOLTEADA (firma de la
  // frustración impar); aquí no hay volteada (reparto 2-2) y señalan la ALTERNANCIA: dos
  // arriba y dos abajo. Encendidas desde t=0 porque son justo lo que hace legible "encajan
  // perfectamente" — sin ellas la toma de canto es una franja de polvo bonita y muda.
  dipolo:   { base: 0, mods: [
    { wins: [[0.0, 13.53]], a: 1.0, label: 'FRAME 0: arriba, abajo, arriba, abajo' },
    { wins: [[61.12, 71.67]], a: 1.0, label: 'vuelven con los números' } ] },
  ceros:    { base: 0, mods: [] },
  apertura: { base: 0.10, mods: [
    // ARRANCA CERRADO. El corte anterior abría en 0.92 y por eso el anillo no cabía en el
    // cuadro: dos moléculas mordidas por los bordes y el tercio de arriba en negro muerto.
    // Ahora el anillo solo se abre cuando la voz REBOBINA a explicar ("la otra vez viste
    // tres" → "doce átomos"), que es cuando hace falta contarlas y ver una sola.
    { wins: [[13.53, 33.85]], a: 0.55, label: 'REBOBINA: se abre para contarlas y mirar UNA' },
    { wins: [[75.50, 88.0]],  a: 0.68, label: 'PAYOFF: se alejan — el viaje cierra' } ] },
};
// CAPAS DEL HEXÁGONO — fronteras = arranques REALES de segs.json (voz 92.05 s, 31 líneas).
// Portadas A MANO desde WTET_CAPAS (recalibrar-beats.py regenera de una plantilla vieja y
// pierde enlaces/dipolo/apertura — aviso ya pagado dos veces).
//   GANCHO "cuenta los lados" 0-14.77 · UNA molécula 14.77-22.52 · rebobina 22.52-28.74 ·
//   puentes 28.74-42.09 · 2.821 Å 42.09-46.52 · DE CANTO 46.52-51.08 ·
//   cooperatividad+números 51.08-66.42 · se aprietan + cuántica 66.42-73.43 · EL COPO 73.43-94.55
//
// ⚡ EL FRAME 0 ES UN HEXÁGONO CERRADO Y DE FRENTE. La línea 1 pide CONTAR LOS LADOS: si la
// apertura arranca alta (como arrancaba el cuarteto antes de arreglarlo) no hay hexágono que
// contar, hay seis manchas sueltas. apertura=0.10 desde t=0, y solo se abre cuando la voz
// rebobina a mirar UNA.
const WHEX6_CAPAS: CapasSpec = {
  // Fronteras = arranques REALES de segs.json (voz 95.24 s, 31 líneas), portadas A MANO.
  //   DESTELLO 0-17.59 · números 17.59-25.25 · de canto 25.25-29.75 ·
  //   cooperatividad 29.75-48.22 · cuántica 48.22-51.96 · el copo 51.96-63.51 ·
  //   EL REMATE (contar) 63.51-85.22 · callback 85.22-91.44 · cierre 91.44-97.74
  //
  // ⚡ EL ENCENDIDO ES LA PIEZA. `campo` arranca en 0.25 y la ventana abre en t=1.0: con la
  // rampa de 0.6s de win(), el campo sube 0.25 → 1.20 entre t=0.4 y t=1.0, justo sobre
  // "mira cómo se agarran". Eso es lo que Ian vio en el viejo segundo 28 y pidió al frente.
  // No se movió una toma: se movió una TRANSICIÓN.
  campo: { base: 0.25, mods: [
    { wins: [[1.0, 17.59]], a: 0.95, label: 'EL DESTELLO: el campo enciende sobre la primera frase' },
    { wins: [[10.07, 13.44]], a: 0.18, label: 'segundo golpe: "seis puentes, encendiendo a la vez"' },
    { wins: [[29.75, 48.22]], a: 0.72, label: 'la fuerza: los seis jalan juntos (tramo del valle)' },
    { wins: [[63.51, 85.22]], a: 0.30, label: 'el remate: algo sigue vivo mientras se cuenta' } ] },
  nubes: { base: 1, mods: [
    { wins: [[0.0, 17.59]], a: -0.30, label: 'la nube cede para que se LEAN los puentes encendiendo' },
    { wins: [[25.25, 29.75]], a: -0.34, label: 'deja leer el canto (que es plano)' },
    // DE CANTO LA NUBE SE APILA. Las seis moléculas se proyectan sobre una banda, así que la
    // densidad por píxel se multiplica; con `acc` a 1.45 eso REVENTÓ en pared blanca (mancha
    // clara conexa = 10.25% del cuadro en t=39, contra ≤3.3% en todo el resto). Ojo: el gate
    // de %quemado del canon NO lo caza, porque mide >240 y la zona reventada vive en 200-240
    // — lo que lo delata es el tamaño de la MANCHA CONEXA, no el conteo de píxeles sueltos.
    { wins: [[35.27, 42.05]], a: -0.42, label: 'la firma de canto: baja la nube o revienta' } ] },
  parpadeo: { base: 0.42, mods: [{ wins: [[77.70, 85.22]], a: 0.42, label: 'la molécula sola respira mientras se deletrea H₂O' }] },
  spin: { base: 1, mods: [
    { wins: [[0.0, 17.59]], a: 0.95, label: 'Δρ ARDE desde el frame 0 — es el destello' },
    { wins: [[29.75, 48.22]], a: 0.85, label: 'y vuelve a arder en la cooperatividad' } ] },
  // ORO ARRIBA, y es un DEFECTO MEDIDO, no gusto: atencion-verify.py dio firma cálido+frío
  // = 0% (las piezas ganadoras tienen cúmulos cálidos Y fríos a la vez, y esta era magenta
  // con azul). El oro de los oxígenos era demasiado chico para contar como cúmulo cálido.
  acc: { base: 1.45, mods: [
    { wins: [[0.0, 17.59]], a: 0.55, label: 'el ORO de los seis oxígenos contra el azul del campo' },
    { wins: [[35.27, 42.05]], a: -0.40, label: 'menos oro DE CANTO: ahí la nube ya viene apilada' },
    { wins: [[77.70, 85.22]], a: 0.55, label: 'y en el close-up, donde el O es el sujeto' } ] },
  enlaces: { base: 0, mods: [
    { wins: [[0.0, 17.59]], a: 1.0, label: 'desde el FRAME 0: cada vértice son 3 átomos' },
    { wins: [[63.51, 91.44]], a: 1.0, label: 'el remate: se cuenta lo que se VE' } ] },
  // Las flechas dibujan el hexágono. Encendidas en el destello (el circuito cerrado ES la
  // forma) y en el remate, que es donde la voz pide contar los lados.
  dipolo: { base: 0, mods: [
    { wins: [[0.0, 17.59]], a: 1.0, label: 'los seis en cadena: el circuito que se enciende' },
    { wins: [[63.51, 85.22]], a: 1.0, label: 'vuelven para que se cuenten los seis lados' } ] },
  ceros: { base: 0, mods: [] },
  // Apertura SIEMPRE cerrada: la pieza trata de una FORMA y abrir el anillo la deshace.
  // Medido en la v1: con apertura 0.45 la toma íntima daba 87% de cuadro negro, porque al
  // separarse el Δρ del puente desaparece — correcto en física, muerto en pantalla.
  apertura: { base: 0.10, mods: [] },
};
// CAPAS DE LA CAZADORA (hemoglobina, primera PROTEÍNA de la serie) — corte de STILLS, sin
// voz aún: fronteras provisionales, recalibrar con segs.json (canon §sincronía).
// `apertura` = la coordenada T→R del bin (1 = deoxi con los O₂ LEJOS, 0 = oxi capturado).
// Estructura del rey (el puente): abre en el CLÍMAX (todo unido, ardiendo), rebobina a T,
// caza ESCALONADA (α1 primero — la cooperatividad viene EN los datos del bin), clímax ~78%.
const HEMO_CAPAS: CapasSpec = {
  // v10: coreografía calcada de WPAIR_CAPAS (el rey) con las ventanas del guion del sitio
  // activo (20 líneas / ~69 s). Bases = las del agua: a esta escala el motor ya está en su
  // régimen, así que los realces de brillo de la v6-v9 sobran.
  // `apertura` recorre la coordenada Fe–O₂ del bin: 1 = el O₂ lejos (4.6 Å), 0 = CAPTURADO
  // (1.796 Å, la distancia del cristal).
  campo:    { base: 1, mods: [{ wins: [[14, 26]], a: -0.75, label: 'el campo baja mientras se mira el HIERRO solo' }] },
  nubes:    { base: 1, mods: [{ wins: [[38, 52]], a: -0.35, label: 'la nube cede para LEER el morado llegando' }] },
  parpadeo: { base: 0.42, mods: [{ wins: [[14, 26]], a: 0.42, label: 'el hierro esperando: los electrones respiran' }] },
  spin:     { base: 1, mods: [{ wins: [[38, 62]], a: 0.95, label: 'Δρ ARDE: los electrones LLEGAN al enlace Fe–O₂' }] },
  acc:      { base: 1, mods: [{ wins: [[14, 26]], a: 0.5, label: 'ORO del hierro y su anillo' }] },
  apertura: { base: 0.06, mods: [
    { wins: [[0, 6]],   a: 0.30, label: 'FRAME 0 = EL PICO: casi capturado, ardiendo' },
    { wins: [[8, 34]],  a: 0.90, label: 'REBOBINA: el O₂ lejos, el hierro esperando' },
    { wins: [[34, 46]], a: 0.45, label: 'LA CAZA: se acerca' },
    // 46→: cae a 0.06 = CAPTURADO. El clímax (imanes apagados, Fe al plano) al ~78 %.
  ] },
};
// LA SAL: coreografía provisional = la del rey; recalibrar a segs.json cuando exista la voz.
const WSAL_CAPAS: CapasSpec = WPAIR_CAPAS;
// CAPAS DE LA SILLA VACÍA (2026-08-27) — 50 s. Ventanas PROVISIONALES desde el plan del
// guion; recalibrar a los arranques reales de segs.json. Figura 3 de §LA MECÁNICA DEL O₂:
// "quita las nubes" apaga TODO (≤3 s, la NADA como argumento) y "préndelas" lo devuelve
// con el Δρ ardiendo. `apertura` la trae la pieza (0 = pegadas): arranca moderado, cierra
// en escalera desde "préndelas" para que el puente NAZCA bajo la voz que lo nombra.
const WSILLA_CAPAS: CapasSpec = {
  // Ventanas = arranques REALES de segs.json (ver CAMERA_SHOTS.wsilla). El corte de capa cae
  // en el ARRANQUE de la línea, no en su final (regla de §LA MECÁNICA DEL O₂).
  apertura: { base: 0.55, mods: [
    { wins: [[0, 3.0]], a: -0.30, label: 'arranque: casi pegadas, espectáculo (l1)' },
    { wins: [[25.2, 50]], a: -0.20, label: 'préndelas: empiezan a cerrar (l8)' },
    { wins: [[27.5, 50]], a: -0.20, label: '…más cerca' },
    { wins: [[29.5, 50]], a: -0.15, label: 'pegadas: "carga llegando a la silla"' },
  ] },
  nubes:    { base: 1,    mods: [{ wins: [[20.4, 24.6]], a: -1.0, label: 'QUITA LAS NUBES: nada — la NADA como argumento (l7)' }] },
  campo:    { base: 1,    mods: [
    { wins: [[7.0, 16.0]], a: -0.85, label: 'MAGENTA: el oxígeno de cerca (l3-5); vuelve en l6 para que el H APUNTE' },
    { wins: [[20.4, 24.6]], a: -1.0, label: 'ni palito ni resorte (l7)' },
    { wins: [[25.2, 36.0]], a: -0.60, label: 'préndelas: el puente es NUBE, campo bajo (l8-9)' },
  ] },
  parpadeo: { base: 0.42, mods: [{ wins: [[9.7, 15.8]], a: 0.42, label: 'estas dos nubes son suyas (l4-5)' }] },
  spin:     { base: 1,    mods: [{ wins: [[25.2, 36.0]], a: 0.9, label: 'ARDE: carga llegando a la silla (l8-9)' }] },
  acc:      { base: 1,    mods: [{ wins: [[7.0, 13.3]], a: 0.5, label: 'ORO: mira el oxígeno de cerca (l3-4)' }] },
};
const WETANOL_DURATION = 79;
// EL ALCOHOL — coreografía de capas, copiada de WSILLA_CAPAS. Ventanas PROVISIONALES (los
// arranques de CAMERA_SHOTS.wetanol); se recalibran a segs.json después del TTS, porque el
// corte de capa tiene que caer en el ARRANQUE de la línea (regla de §LA MECÁNICA DEL O₂).
const WETANOL_CAPAS: CapasSpec = {
  // Ventanas = arranques REALES de segs.json (ver CAMERA_SHOTS.wetanol). El corte de capa cae
  // en el ARRANQUE de la línea, no en su final (regla de §LA MECÁNICA DEL O₂).
  apertura: { base: 0.55, mods: [
    { wins: [[0, 3.0]], a: -0.30, label: 'arranque: casi pegadas, espectáculo (l1)' },
    { wins: [[51.45, 79]], a: -0.20, label: 'préndelas: empiezan a cerrar (l12)' },
    { wins: [[55.79, 79]], a: -0.20, label: '…más cerca (l13)' },
    { wins: [[59.71, 79]], a: -0.15, label: 'pegadas: el puente armado (l14)' },
  ] },
  nubes:    { base: 1,    mods: [{ wins: [[46.33, 51.45]], a: -1.0, label: 'QUITA LAS NUBES: ni palito ni resorte (l11)' }] },
  campo:    { base: 1,    mods: [
    { wins: [[10.01, 27.66]], a: -0.85, label: 'MAGENTA: el alcohol de cerca (l3-6) — el campo estorba en el close-up' },
    { wins: [[46.33, 51.45]], a: -1.0, label: 'la NADA (l11)' },
    { wins: [[51.45, 59.71]], a: -0.60, label: 'préndelas: el puente es NUBE, campo bajo (l12-13)' },
  ] },
  parpadeo: { base: 0.42, mods: [{ wins: [[27.66, 38.10]], a: 0.42, label: 'sus dos nubes, las que no comparte (l7-8)' }] },
  spin:     { base: 1,    mods: [{ wins: [[51.45, 66.48]], a: 0.9, label: 'ARDE: carga llegando a la silla (l12-15)' }] },
  acc:      { base: 1,    mods: [{ wins: [[27.66, 32.46]], a: 0.5, label: 'ORO: la palabra-color, el único cálido del video (l7)' }] },
};
const WCAMPORB_DURATION = 64;
// BRAZO B: los mismos beats que WCAMPOR_CAPAS, ventanas = arranques REALES de segs.json a
// VEL 1.25 (calibrado 2026-09-04; la voz termina en 61.81 s).
const WCAMPORB_CAPAS: CapasSpec = {
  apertura: { base: 0.55, mods: [{ wins: [[52.11, 64]], a: -0.35, label: 'al final se juntan (l17)' }] },
  nubes:    { base: 1,    mods: [{ wins: [[14.04, 25.75]], a: -0.55, label: 'baja la nube mientras se leen las partes (l05-08)' }] },
  campo:    { base: 0,    mods: [{ wins: [[42.39, 64]], a: 1.0, label: 'la suma: lo que queda (l14-19)' }] },
  campoNuc: { base: 0,    mods: [{ wins: [[0, 19.57]], a: 1.0, label: 'gancho + positivo solo (l01-06)' }, { wins: [[30.42, 42.39]], a: 1.0, label: 'los dos otra vez (l10-13)' }] },
  campoEle: { base: 0,    mods: [{ wins: [[0, 14.04]], a: 1.0, label: 'gancho (l01-04)' }, { wins: [[19.57, 25.75]], a: 1.0, label: 'negativo solo (l07-08)' }, { wins: [[30.42, 42.39]], a: 1.0, label: 'los dos otra vez (l10-13)' }] },
  parpadeo: { base: 0.42, mods: [{ wins: [[25.75, 30.42]], a: 0.42, label: 'la nube sola respira (l09)' }] },
  spin:     { base: 1,    mods: [{ wins: [[42.39, 64]], a: 0.9, label: 'el puente arde (l14-16)' }] },
  acc:      { base: 1,    mods: [] },
};
const WCAMPOR_DURATION = 75;
// LOS DOS CAMPOS · EL REY. Estructura INVERTIDA respecto de la versión del alcohol: ian vio
// el cuadro de los dos campos encimados y dijo "ESTO DEBE DE SER LA PRIMERA IMAGEN". Tiene
// razón y es canon (§frame 0 = el gancho): se enseña primero el cuadro fuerte y DESPUÉS se
// descompone. Ventanas = arranques REALES de segs.json.
const WCAMPOR_CAPAS: CapasSpec = {
  apertura: { base: 0.55, mods: [{ wins: [[57.28, 75]], a: -0.35, label: 'al final se juntan (l16)' }] },
  nubes:    { base: 1,    mods: [
    { wins: [[16.61, 29.96]], a: -0.55, label: 'baja la nube mientras se lee cada parte por separado' },
  ] },
  // el TOTAL solo al final: es el payoff, la miga que queda de la cancelación.
  campo:    { base: 0,    mods: [{ wins: [[49.67, 75]], a: 1.0, label: 'apágalos y esto es lo que queda (l14-19)' }] },
  campoNuc: { base: 0,    mods: [
    { wins: [[0, 22.71]], a: 1.0, label: 'EL GANCHO: los dos encimados (l01-04) y luego el positivo solo (l05-06)' },
    { wins: [[35.37, 49.67]], a: 1.0, label: 'los junto de nuevo (l10-13)' },
  ] },
  campoEle: { base: 0,    mods: [
    { wins: [[0, 16.61]], a: 1.0, label: 'EL GANCHO: encimado con el positivo (l01-04)' },
    { wins: [[22.71, 29.96]], a: 1.0, label: 'el negativo solo (l07-08)' },
    { wins: [[35.37, 49.67]], a: 1.0, label: 'los junto de nuevo (l10-13)' },
  ] },
  // l09 (29.96-35.37): los DOS campos apagados a propósito → queda la nube pelona mientras
  // la voz dice por qué no lleva líneas. La frase se prueba sola.
  parpadeo: { base: 0.42, mods: [{ wins: [[29.96, 35.37]], a: 0.42, label: 'la nube sola respira (l09)' }] },
  spin:     { base: 1,    mods: [{ wins: [[49.67, 75]], a: 0.9, label: 'el puente arde: la miga que sobra (l14-16)' }] },
  acc:      { base: 1,    mods: [] },
};
const WCOLOR_DURATION = 72;
// DE QUIÉN SON LOS ELECTRONES — la nube pintada POR ELEMENTO (Hirshfeld 1977, ver
// scripts/color-hirshfeld.py). El sujeto es LA NUBE, no el campo: las líneas se mantienen
// bajas para que el color se lea, y solo suben al final, cuando la voz habla del enlace.
// Ventanas = arranques REALES de segs.json.
const WCOLOR_CAPAS: CapasSpec = {
  apertura: { base: 0.55, mods: [{ wins: [[58.02, 72]], a: -0.35, label: 'se tocan las dos (l16-17)' }] },
  nubes:    { base: 1,    mods: [] },
  campo:    { base: 0.22, mods: [{ wins: [[58.02, 72]], a: 0.55, label: 'el enlace: ahí se mezclan los colores (l16-17)' }] },
  campoNuc: { base: 0,    mods: [] },
  campoEle: { base: 0,    mods: [] },
  parpadeo: { base: 0.42, mods: [{ wins: [[7.50, 15.11]], a: 0.35, label: 'los tres colores, nombrados (l03-04)' }] },
  spin:     { base: 0.55, mods: [{ wins: [[58.02, 72]], a: 0.8, label: 'el puente arde al final' }] },
  acc:      { base: 1,    mods: [{ wins: [[39.80, 51.33]], a: 0.35, label: 'ORO: la punta de oxígeno, la cara de agua (l11-13)' }] },
};
const WCAMPO_DURATION = 70;
// LOS DOS CAMPOS — la coreografía ES el argumento. Se enseña el positivo SOLO, luego el
// negativo SOLO, luego los dos ENCIMADOS (se ve que apuntan al revés), y al final se apagan
// los dos y queda la SUMA: la miga con estructura, que es el enlace.
// Ventanas PROVISIONALES (se recalibran a segs.json después del TTS).
const WCAMPO_CAPAS: CapasSpec = {
  // Ventanas = arranques REALES de segs.json. Cada corte cae en el ARRANQUE de su línea.
  // La coreografía ES el argumento — se enseña una parte a la vez y la frase se prueba sola:
  //   l04-05  SOLO el positivo (rojo, sale disparado)
  //   l06-07  SOLO el negativo (cian, cae a la nube)
  //   l08     NINGUNO: queda la nube pelona mientras la voz dice por qué no lleva líneas
  //   l09-12  LOS DOS encimados (se ve que apuntan al revés)
  //   l13-18  se apagan y aparece la SUMA: la miga con estructura = el enlace
  apertura: { base: 0.55, mods: [{ wins: [[53.83, 70]], a: -0.35, label: 'al final se juntan (l15)' }] },
  nubes:    { base: 1,    mods: [
    { wins: [[13.71, 26.66]], a: -0.55, label: 'baja la nube para que se lean las líneas de cada parte' },
    { wins: [[26.66, 32.44]], a: 0.0,  label: 'l08: la nube SOLA, sin ninguna línea — la frase se prueba aquí' },
  ] },
  campo:    { base: 0,    mods: [
    { wins: [[0, 13.71]], a: 1.0, label: 'lo que siempre te enseñamos: la suma (l01-03)' },
    { wins: [[46.26, 70]], a: 1.0, label: 'apágalos y esto es lo que queda (l13-18)' },
  ] },
  campoNuc: { base: 0,    mods: [
    { wins: [[13.71, 19.79]], a: 1.0, label: 'SOLO núcleos: positivo, hacia afuera (l04-05)' },
    { wins: [[32.44, 46.26]], a: 1.0, label: 'los dos encimados (l09-12)' },
  ] },
  campoEle: { base: 0,    mods: [
    { wins: [[19.79, 26.66]], a: 1.0, label: 'SOLO electrones: negativo, hacia la nube (l06-07)' },
    { wins: [[32.44, 46.26]], a: 1.0, label: 'los dos encimados (l09-12)' },
  ] },
  parpadeo: { base: 0.42, mods: [{ wins: [[26.66, 32.44]], a: 0.42, label: 'la nube sola respira (l08)' }] },
  spin:     { base: 1,    mods: [{ wins: [[46.26, 70]], a: 0.9, label: 'el puente arde: la miga que sobra (l13-15)' }] },
  acc:      { base: 1,    mods: [] },
};
const WSILLA_DURATION = 50;
const WPAIR_EX = 13;   // escala maestra del par (bohr) para la gramática de tomas
const WPAIR_CAM = (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('cam') : '') || 'a';
// ?zoom= — ACERCA la cámara sin tocar las tomas: escala la distancia al TARGET. Nació del 16:9
// (2026-08-28): la FOV de three.js es VERTICAL, así que al pasar de 9:16 a 16:9 el cuadro pierde
// altura, el sujeto queda del mismo tamaño angular y sobra negro a los lados — el primer 16:9 de
// LA SILLA dio fill 0.252 contra 0.434 del vertical. Escribir una lista de tomas apretada POR
// PIEZA no escala (hay 4 piezas y vienen más); un multiplicador de radio sirve para todas.
// Default 1 = todas las piezas verticales quedan BIT-IDÉNTICAS (renderizador congelado).
const CAM_ZOOM = (() => {
  const v = typeof location !== 'undefined' ? parseFloat(new URLSearchParams(location.search).get('zoom') || '') : NaN;
  return Number.isFinite(v) && v > 0.05 && v <= 3 ? v : 1;
})();
// Las tomas salen del REGISTRO (datos), no de constantes por video. Variante nueva =
// otra entrada en CAMERA_SHOTS + ?cam=<x>, sin tocar este componente. Ver docs/CANON-VIDEO.md.
// ?cam=<x> → CAMERA_SHOTS['wpair-<x>'], sin tocar este archivo por cada variante (canon Regla #0.5).
// 'a' (o sin cam) cae a 'wpair' = el rey; 'b' = 'wpair-b': idéntico a antes del 2026-08-25.
const WPAIR_SHOTS_ACTIVE = CAMERA_SHOTS[`wpair-${WPAIR_CAM}`] ?? CAMERA_SHOTS.wpair;
function WaterPairCamera({ time, R, shots, ex, pts }: { time: number; R: number; shots: ShotEntry[]; ex: number; pts?: Vec3[] }) {
  const { camera } = useThree();
  useEffect(() => {
    // R (bohr) = separación viva; nucX = R/2 (el O) para el dive. Vertical (reel) → roll intacto.
    const asp = (camera as THREE.PerspectiveCamera).aspect;
    const { pos: pos0, fov, target, roll } = playShots(shots, time, { ex, nucX: R / 2, bondR: R, t: time, pts, aspect: asp });
    // ?zoom= escala la distancia al target (1 = idéntico). Ver CAM_ZOOM.
    const pos: Vec3 = CAM_ZOOM === 1 ? pos0
      : [target[0] + (pos0[0] - target[0]) * CAM_ZOOM,
         target[1] + (pos0[1] - target[1]) * CAM_ZOOM,
         target[2] + (pos0[2] - target[2]) * CAM_ZOOM];
    camera.position.set(pos[0], pos[1], pos[2]);
    const fwd = new THREE.Vector3(target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]).normalize();
    const up0 = new THREE.Vector3(0, 1, 0); if (Math.abs(fwd.dot(up0)) > 0.94) up0.set(0, 0, 1);
    const right = new THREE.Vector3().crossVectors(fwd, up0).normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    // FORMATO: todo lo del reel (roll π/2 para poner el eje del anillo a lo largo del lado
    // ALTO, y el lente ×1.42 porque en 9:16 el eje angosto es el horizontal) vale SOLO en
    // vertical. En 16:9 el eje angosto se voltea: el roll deja el sujeto cruzado
    // desperdiciando los lados, y el ×1.42 aleja 42% de más. MolCameraRig ya condicionaba el
    // lente (línea 743); esta cámara no — por eso el anillo nunca se había podido sacar en
    // horizontal. Se deriva del ASPECTO de la cámara: vale para cualquier formato sin props.
    const cam = camera as THREE.PerspectiveCamera;
    const esVert = cam.aspect < 1;
    const r = esVert ? (roll || 0) : 0;
    camera.up.copy(trueUp.multiplyScalar(Math.cos(r)).add(right.multiplyScalar(Math.sin(r))));
    camera.lookAt(target[0], target[1], target[2]);
    cam.fov = esVert ? Math.min(95, fov * 1.42) : fov;
    const d = Math.hypot(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
    cam.near = Math.max(0.02, d * 0.03); cam.far = Math.max(100, ex * 24); cam.updateProjectionMatrix();
  }, [time, R, camera, shots, ex, pts]);
  return null;
}
// LA FAMILIA DEL AGUA — EL PUENTE (2 aguas), EL ANILLO (3), EL CUARTETO (4)… comparten
// formato WAP2 y renderer: solo cambian los bins y la secuencia de tomas del registro.
//
// ESTA TABLA ES LA PIEZA (2026-07-31). Antes el comportamiento del anillo estaba regado en
// ~15 comparaciones `mk === 'wtri'` a lo largo del archivo, así que una molécula nueva de la
// misma familia obligaba a cazarlas TODAS y a que alguna se quedara sin actualizar. Ahora
// `anillo` es un DATO: agregar el tetrámero (o el hexámero) es UN renglón aquí + sus tomas en
// CAMERA_SHOTS + su manifiesto. Cero código nuevo. (Ian: "ahora son objetos en lugar de andar
// hardcodeando, el renderizador".) Para wtri todos los valores son los que ya tenía → la
// pieza entregada no cambia.
type WaterEntry = {
  bin: string; ef: string; ex: number;
  /** LOS DOS CAMPOS POR SEPARADO (2026-09-01). `ef` es la SUMA — lo único físico y lo
   *  que la serie dibujó siempre. Estos dos son sus partes: `efNuc` el campo de los
   *  NÚCLEOS (positivo, sale hacia afuera) y `efEle` el de los ELECTRONES (negativo,
   *  entra hacia la nube). ian: "QUIERO VER EL CAMPO POSITIVO Y NEGATIVO". Medido en
   *  el etanol: se cancelan el 94 % a 6 bohr y el 99.4 % a 20, con coseno −0.9989 entre
   *  ellos. Sin declarar = la pieza queda idéntica a como estaba. */
  efNuc?: string; efEle?: string;
  anillo?: boolean;          // N-mero cíclico: palitos O–H, dipolos, tipografía y encuadre del ANILLO
  ceros?: string;            // json de los ceros del campo, si la pieza los calculó
  capas?: CapasSpec;         // coreografía (si falta, la de EL PUENTE)
  dur?: number;              // duración de la pieza
  /** multiplicador del TAMAÑO de sprite de las 3 nubes. La hemoglobina ocupa ~100× el
   *  volumen del dímero: con el sprite del agua los puntos son polvo suelto, no nube
   *  (ley de N₂: sprites GRANDES y TENUES = densidad luminosa continua). Default 1 =
   *  todas las piezas entregadas quedan bit-idénticas. */
  sizeMul?: number;
  /** alcance (bohr) del ORO alrededor de los núcleos cálidos en accColorWarm. Default 2.4
   *  (el del agua, sin cambio). La hemoglobina usa ~7: el bolsillo del hemo ES el corazón
   *  dorado — a escala de proteína 2.4 bohr deja el 99% de la nube en ámbar plano. */
  warmReach?: number;
  /** multiplicador del radio de los cúmulos de Nucleus. Default 1. A escala de proteína
   *  los 0.05 bohr del agua son SUBPÍXEL: el hierro desaparece. */
  nucMul?: number;
  /** usar los colores del BIN para la nube acc (el precompute manda la paleta: en la
   *  hemoglobina α=oro y β=morado — la arquitectura 2+2 se vuelve CONTABLE). Default
   *  false = accColorWarm de siempre; las piezas entregadas no cambian. */
  binColors?: boolean;
};
const WATER_BINS: Record<string, WaterEntry> = {
  wpair: { bin: 'water-approach', ef: 'water-approach-efield', ex: 13, dur: WPAIR_DURATION },
  // LA SILLA VACÍA: el bin del rey con SU coreografía y SU duración (quick win, 2026-08-27).
  wcamporb: { bin: 'water-approach', ef: 'water-approach-efield', ex: 13, dur: WCAMPORB_DURATION,
              efNuc: 'water-approach-efield-nuc', efEle: 'water-approach-efield-ele', capas: WCAMPORB_CAPAS },
  wcampor: { bin: 'water-approach', ef: 'water-approach-efield', ex: 13, dur: WCAMPOR_DURATION,
             efNuc: 'water-approach-efield-nuc', efEle: 'water-approach-efield-ele', capas: WCAMPOR_CAPAS },
  // binColors: SIN esta bandera la escena ignora accColor del .bin y usa su paleta cálida
  // (línea del O2Cloud: colors={W.binColors ? wd.accColor : accColorWarm}). Cazado con stills
  // ANTES de gastar voz y render: la nube salía toda roja y no se veía ni el carbono verde.
  wcolor: { bin: 'water-ethanol', ef: 'water-ethanol-efield', ex: 16, dur: WCOLOR_DURATION, sizeMul: 1.7,
            binColors: true, capas: WCOLOR_CAPAS },
  wcampo: { bin: 'water-ethanol', ef: 'water-ethanol-efield', ex: 16, dur: WCAMPO_DURATION, sizeMul: 1.7,
            efNuc: 'water-ethanol-efield-nuc', efEle: 'water-ethanol-efield-ele', capas: WCAMPO_CAPAS },
  wsilla: { bin: 'water-approach', ef: 'water-approach-efield', ex: 13, dur: WSILLA_DURATION, capas: WSILLA_CAPAS },
  // EL ALCOHOL (2026-08-29): etanol (9 átomos, DON) + agua (ACC). Bin NUEVO, no del rey.
  // `ex` sube a 16 porque el sistema mide ~11 Å de punta a punta contra los ~6 del dímero:
  // con ex 13 la cámara del rey se metería DENTRO del esqueleto de carbono.
  // sizeMul 1.7: el sistema mide ~11 Å contra los ~6 del dímero → casi 6× el VOLUMEN con el
  // mismo número de partículas, así que con el sprite del agua la nube sale como polvo suelto
  // (medido en los primeros stills). Es la misma cura que pidió la hemoglobina.
  wetanol: { bin: 'water-ethanol', ef: 'water-ethanol-efield', ex: 16, dur: WETANOL_DURATION, sizeMul: 1.7, capas: WETANOL_CAPAS,
             efNuc: 'water-ethanol-efield-nuc', efEle: 'water-ethanol-efield-ele' },
  // LA SAL (2026-08-26): Na⁺ + H₂O con PAR=na de precompute-water-approach.py. Mismo formato WAP2
  // (4 núcleos: Na, O, H, H), mismo eje, mismo régimen. Gate: −24.0 kcal/mol a 2.25 Å = experimento.
  wsal:  { bin: 'water-sodium', ef: 'water-sodium-efield', ex: 13, capas: WSAL_CAPAS, dur: WSAL_DURATION },
  // nube ±6.6 bohr: ex=15 dejaba void muerto
  wtri:  { bin: 'water-trimer',   ef: 'water-trimer-efield',   ex: 10, anillo: true,
           ceros: 'water-trimer-ceros', capas: WTRI_CAPAS, dur: WTRI_DURATION },
  // EL CUARTETO (H₂O)₄ — 4 aguas / 12 átomos. ex sube con el circunradio del polígono
  // (R/(2·sin(π/N)): +22 % de 3 a 4 lados), si no el anillo muerde los bordes del 9:16.
  // capas/dur se llenan cuando existan los tiempos REALES de la voz (§sincronía del canon).
  wtet:  { bin: 'water-tetramer', ef: 'water-tetramer-efield', ex: 12, anillo: true,
           capas: WTET_CAPAS, dur: WTET_DURATION },
  // EL HEXÁGONO (H₂O)₆ — 6 aguas / 18 átomos. `ex` MEDIDO, no estimado: el radio del núcleo
  // más lejano al origen es 4.40 bohr en el trímero (ex=10, ratio 2.27) y 5.03 en el cuarteto
  // (ex=12, ratio 2.384); el hexámero da 6.54 → ex = 2.384·6.54 = 15.6 ≈ 15.5 conserva EXACTO
  // el encuadre del cuarteto. Con el ex=14 que estimé del circunradio teórico, el ratio caía a
  // 2.14 (más apretado que ninguna pieza previa) y el anillo mordía los bordes del 9:16.
  // ⚠ La clave es `whex6` y no `whex`: `whex` ya la ocupa la escena vieja de agua MD.
  whex6: { bin: 'water-hexamer', ef: 'water-hexamer-efield', ex: 15.5, anillo: true,
           capas: WHEX6_CAPAS, dur: WHEX6_DURATION },
  // LA CAZADORA — hemoglobina + 4 O₂ (primera PROTEÍNA; precompute-hemoglobin.py, gates
  // 5/5: rotación cuaternaria 14.12° vs 12-15° de Baldwin-Chothia, Fe–O₂ 1.796 Å). El bin
  // es WAP2 puro: acc=proteína (4,344 átomos de 4HHB→2DN1), dep=los 4 hemos, spin=los 4 O₂
  // que LLEGAN, núcleos = tríos (Fe,O,O)×4 — así accColorWarm pinta ORO junto a los Fe,
  // los cores arden en los hierros y la cámara (pts=i%3==0) apunta a los 4 hemos SIN tocar
  // código. R = distancia media Fe–O₂ (33.3→3.4 bohr) = la coordenada T→R del video.
  // v10 — EL SITIO ACTIVO ab initio (precompute-heme-approach.py). Al dejar de estirar la
  // proteína y calcular lo que SÍ se puede, la pieza vuelve a ser hermana LITERAL del
  // puente: ~13 bohr = el régimen nativo del motor. Cero trucos de escala, cero
  // multiplicadores — los defaults del ganador. `binColors` porque el precompute manda la
  // paleta oro→morado igual que el agua, y las líneas son CAMPO ELÉCTRICO DE VERDAD (MEP).
  hemo:  { bin: 'hemoglobina', ef: 'hemoglobina-efield', ex: 9, binColors: true,
           capas: HEMO_CAPAS, dur: HEMO_DURATION },
};
/** ¿Es un anillo cíclico de N aguas? (wtri, wtet, …) — NO el dímero. */
const esAnillo = (mk: string) => !!WATER_BINS[mk]?.anillo;

/** WaterSticks — FLECHA DEL DIPOLO (los palitos de enlace se QUITARON: dibujar geometría
 * encima viola la doctrina "el polvo es real, la estructura EMERGE del polvo". El enlace O–H
 * ahora se ve porque la NUBE se enciende sobre su eje (uBondGlow en el shader). El vector sí
 * se dibuja: es la anotación de una MAGNITUD (dirección del dipolo), no una forma inventada.
 *
 * Por qué existen (agentes, 2026-07-27): sin palitos "una molécula, tres átomos" son tres
 * bolas sueltas y NUNCA se lee; y sin un vector por molécula, "una queda al revés" no tiene
 * forma que ver — son nueve puntos amarillos iguales. Esto NO inventa física: el enlace se
 * dibuja entre O y SUS dos H (del .bin) y el dipolo es la bisectriz H-O-H, que es la
 * dirección real del momento dipolar del agua (apunta del O hacia el lado de los H, que es
 * el positivo: p = Σ q·r con q_H>0). Es ANOTACIÓN sobre geometría medida, y se declara.
 */
function WaterSticks({ nuc, show = 1, showDip = 1, scale = 1 }:
  { nuc: Vec3[]; show?: number; showDip?: number; scale?: number }) {
  const mols = Math.floor(nuc.length / 3);
  const items = useMemo(() => {
    const out: { mid: Vec3; q: THREE.Quaternion; len: number; kind: 'bond' | 'dip'; impar: boolean }[] = [];
    const UP = new THREE.Vector3(0, 1, 0);
    // LA VOLTEADA SE DETECTA DE LA GEOMETRÍA, no se marca a mano. Se proyecta cada dipolo
    // sobre la NORMAL del anillo (de los 3 oxígenos): en el mínimo UUD dos apuntan a un lado
    // de ese plano y una al contrario. La que le lleva la contraria a la mayoría es la impar.
    // Antes las 3 flechas eran idénticas y blancas: aunque se vieran, NADA decía cuál quedó
    // al revés — un juez las leyó como "tres direcciones al azar" (2026-07-28).
    const Os = [0, 1, 2].map(m => new THREE.Vector3(...nuc[3 * m]));
    const nrm = mols >= 3
      ? Os[1].clone().sub(Os[0]).cross(Os[2].clone().sub(Os[0])).normalize()
      : new THREE.Vector3(0, 0, 1);
    const bis: THREE.Vector3[] = [];
    for (let m = 0; m < mols; m++) {
      const O = new THREE.Vector3(...nuc[3 * m]);
      const Hs = [new THREE.Vector3(...nuc[3 * m + 1]), new THREE.Vector3(...nuc[3 * m + 2])];
      bis.push(Hs[0].clone().sub(O).normalize().add(Hs[1].clone().sub(O).normalize()).normalize());
    }
    const sgn = bis.map(b => Math.sign(b.dot(nrm)));
    // FRUSTRACIÓN = que UNA se quede SOLA del lado contrario, y eso solo pasa con N IMPAR.
    // Con "la minoría" (la regla vieja, escrita para el trímero) el tetrámero reparte 2-2 y el
    // desempate marcaba DOS como volteadas — o sea, dibujaba la firma del trímero en la pieza
    // cuya física dice justo lo contrario (S₄: las cuatro equivalentes). Aquí solo hay impar si
    // el conteo deja exactamente una sola. Trímero (2-1): idéntico a antes. Tetrámero (2-2):
    // ninguna, que es la verdad.
    const nPos = sgn.filter(s => s > 0).length;
    const solitaria = nPos === 1 ? 1 : (mols - nPos) === 1 ? -1 : 0;
    for (let m = 0; m < mols; m++) {
      const O = new THREE.Vector3(...nuc[3 * m]);
      const b = bis[m];
      const impar = mols >= 3 && solitaria !== 0 && sgn[m] === solitaria;
      const L = (impar ? 1.85 : 1.55) * scale;      // la impar, MÁS LARGA además de otro color
      const q = new THREE.Quaternion().setFromUnitVectors(UP, b);
      out.push({ mid: O.clone().add(b.clone().multiplyScalar(L * 0.5)).toArray() as Vec3, q, len: L, kind: 'dip', impar });
    }
    return out;
  }, [nuc, mols, scale]);
  if (show <= 0.01 && showDip <= 0.01) return null;
  return (
    <>
      {items.map((it, i) => {
        const esDip = it.kind === 'dip';
        const op = esDip ? showDip : show;
        if (op <= 0.01) return null;
        return (
          <group key={i} position={it.mid} quaternion={it.q}>
            <mesh>
              <cylinderGeometry args={[esDip ? (it.impar ? 0.058 : 0.036) : 0.016, esDip ? (it.impar ? 0.058 : 0.036) : 0.016, it.len, 8]} />
              <meshBasicMaterial color={esDip ? (it.impar ? '#ffb03a' : '#bcd8ff') : '#ffd9a0'} transparent opacity={op * (esDip ? 0.95 : 0.5)} depthWrite={false} />
            </mesh>
            {esDip && (
              <mesh position={[0, it.len * 0.5 + 0.16, 0]}>
                {/* la punta de la IMPAR es más gorda: aunque el dipolo apunte casi a cámara y
                    el cilindro se escorce, sigue leyéndose CUÁL es la distinta. */}
                <coneGeometry args={[it.impar ? 0.17 : 0.10, it.impar ? 0.40 : 0.26, 12]} />
                <meshBasicMaterial color={it.impar ? '#ffb03a' : '#bcd8ff'} transparent opacity={op} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

function WaterPair({ time, onReady, mk = 'wpair' }: { time: number; onReady?: (r: boolean) => void; mk?: string }) {
  const W = WATER_BINS[mk] ?? WATER_BINS.wpair;
  const anillo = !!W.anillo;          // wtri, wtet… (ver WATER_BINS: el comportamiento es DATO)
  const [wd, setWd] = useState<WAPData | null>(null);
  const [bondEf, setBondEf] = useState<BondEFieldData | null>(null);
  /** las PARTES del campo: núcleos (positivo) y electrones (negativo). Se cargan solo si
   *  la pieza las declara; si no, quedan null y no se dibuja nada nuevo. */
  const [efNuc, setEfNuc] = useState<BondEFieldData | null>(null);
  const [efEle, setEfEle] = useState<BondEFieldData | null>(null);
  const [ceros, setCeros] = useState<CerosData | null>(null);
  useEffect(() => {
    let alive = true; setWd(null); setBondEf(null); setEfNuc(null); setEfEle(null);
    fetch(`/precomputed/${W.bin}.bin`).then(r => r.arrayBuffer())
      .then(b => { if (alive) { setWd(parseWAP2(b)); onReady?.(true); } })
      .catch(e => console.error('water-approach load failed', e));
    // CAMPO ELÉCTRICO real (MEP, muchas líneas que se CONECTAN, como Li₂) — bin aparte
    fetch(`/precomputed/${W.ef}.bin`).then(r => r.arrayBuffer())
      .then(b => { if (alive) setBondEf(parseBondEField(b)); })
      .catch(e => console.error('water-approach efield load failed', e));
    // LAS PARTES del campo (solo las piezas que las declaran)
    if (W.efNuc) fetch(`/precomputed/${W.efNuc}.bin`).then(r => r.arrayBuffer())
      .then(b => { if (alive) setEfNuc(parseBondEField(b)); }).catch(() => {});
    if (W.efEle) fetch(`/precomputed/${W.efEle}.bin`).then(r => r.arrayBuffer())
      .then(b => { if (alive) setEfEle(parseBondEField(b)); }).catch(() => {});
    // los CEROS del campo (solo las piezas que los calcularon los declaran en la tabla)
    if (W.ceros) fetch(`/precomputed/${W.ceros}.json`).then(r => r.json())
      .then(j => { if (alive) setCeros(parseCeros(j)); }).catch(() => {});
    return () => { alive = false; };
  }, [onReady]);
  const spinColors = useMemo(() => { const n = wd?.Nspin ?? 0; const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = 0.82; c[i * 3 + 1] = 0.30; c[i * 3 + 2] = 1.0; } return c; }, [wd]);
  const depColors = useMemo(() => { const n = wd?.Ndep ?? 0; const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = 0.20; c[i * 3 + 1] = 0.45; c[i * 3 + 2] = 1.0; } return c; }, [wd]);
  // PASO 1: color de la nube acc EXACTO como O2 (oro→ámbar-rojo→blanco-oro en el núcleo).
  // El rojo/ámbar es la riqueza que faltaba; el morado NO va aquí (va en el Δρ).
  const accColorWarm = useMemo(() => {
    if (!wd) return new Float32Array(0);
    const inv = 1 / (wd.posq || O2AI_POSQ), kRef = wd.K - 1;
    const nb = kRef * wd.NNUC * 3, pb = kRef * wd.Nacc * 3;
    // TODOS los oxígenos (átomos 0, 3, 6…), no dos. Estaba escrito a mano para el DÍMERO
    // (nb y nb+9) y el anillo lo heredó: el TERCER oxígeno no existía en el cálculo, así que
    // su nube caía siempre en `t=1` = ámbar puro. Luminancia Rec.709 del ámbar 0.387 contra
    // 0.724 del oro ⇒ UN TERCIO de la nube iba a la mitad de brillo y con otro tono. Eso es
    // parte del "muy poca saturación" que se reportó a ojo.
    const Os: number[][] = [];
    for (let m = 0; m * 3 < wd.NNUC; m++) {
      const o = nb + m * 9;
      Os.push([wd.nucPos[o] * inv, wd.nucPos[o + 1] * inv, wd.nucPos[o + 2] * inv]);
    }
    // MÁS SATURACIÓN: tonos más profundos (menos verde/azul) + núcleo menos blanco
    const gold = [1.0, 0.70, 0.14], amber = [1.0, 0.24, 0.03], whitegold = [1.0, 0.82, 0.42];
    const celeste = [0.55, 0.90, 1.0];
    const Nas: number[][] = [];
    for (let m = 0; m < wd.NNUC; m++) if (wd.Z[m] === 11) Nas.push([wd.nucPos[nb + m * 3] * inv, wd.nucPos[nb + m * 3 + 1] * inv, wd.nucPos[nb + m * 3 + 2] * inv]);
    const c = new Float32Array(wd.Nacc * 3);
    for (let i = 0; i < wd.Nacc; i++) {
      const x = wd.accPos[pb + i * 3] * inv, y = wd.accPos[pb + i * 3 + 1] * inv, z = wd.accPos[pb + i * 3 + 2] * inv;
      let dO = Infinity;
      for (const O of Os) { const d = Math.hypot(x - O[0], y - O[1], z - O[2]); if (d < dO) dO = d; }
      const t = Math.min(1, dO / (W.warmReach ?? 2.4));
      let col: number[];
      if (dO < 0.9) col = whitegold;
      else col = [gold[0] * (1 - t) + amber[0] * t, gold[1] * (1 - t) + amber[1] * t, gold[2] * (1 - t) + amber[2] * t];
      // EL ION ES CELESTE (LA SAL, 2026-08-26). Na⁺ perdió el electrón de la línea D: el ion es
      // INCOLORO (evocativo, se declara). Paleta por lo investigado (Palmer&Schloss, firma O₂):
      // figura cálida (el oro del O) contra un rival FRÍO-BRILLANTE = los dos ejes oponentes a
      // la vez. Sus 10 electrones, celestes; el agua conserva oro/ámbar. Solo si hay Na (Z=11).
      for (const N of Nas) { if (Math.hypot(x - N[0], y - N[1], z - N[2]) < 1.9) { col = celeste; break; } }
      c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2];
    }
    return c;
  }, [wd, W.warmReach]);
  // Partición del campo por PROTAGONISTA (solo piezas con ion, Z=11): cada línea se asigna al
  // núcleo (Na o O) más cercano a su primer punto en el cuadro de referencia.
  const efIon = useMemo(() => {
    if (!wd || !bondEf) return null;
    const inv = 1 / (wd.posq || O2AI_POSQ), kRef = wd.K - 1, nb = kRef * wd.NNUC * 3;
    const nas: number[][] = [], os: number[][] = [];
    for (let m = 0; m < wd.NNUC; m++) {
      const P = [wd.nucPos[nb + m * 3] * inv, wd.nucPos[nb + m * 3 + 1] * inv, wd.nucPos[nb + m * 3 + 2] * inv];
      if (wd.Z[m] === 11) nas.push(P); else if (wd.Z[m] === 8) os.push(P);
    }
    if (!nas.length) return null;
    const { K, NL, LP, frames, inten } = bondEf;
    const fr = frames[Math.min(kRef, frames.length - 1)];
    const esIon = new Array<boolean>(NL);
    for (let l = 0; l < NL; l++) {
      // punto medio de la línea (el primero puede estar en cualquiera de los dos extremos)
      const o = (l * LP + (LP >> 1)) * 3, x = fr[o], y = fr[o + 1], z = fr[o + 2];
      const dN = Math.min(...nas.map((N) => Math.hypot(x - N[0], y - N[1], z - N[2])));
      const dO = Math.min(...os.map((O) => Math.hypot(x - O[0], y - O[1], z - O[2])));
      esIon[l] = dN < dO;
    }
    const sub = (keep: boolean): BondEFieldData => {
      const idx: number[] = []; for (let l = 0; l < NL; l++) if (esIon[l] === keep) idx.push(l);
      const nl = idx.length;
      const fs: Float32Array[] = [], its: Uint8Array[] | null = inten ? [] : null;
      for (let k = 0; k < K; k++) {
        const f = new Float32Array(nl * LP * 3), src = frames[k];
        idx.forEach((l, j) => f.set(src.subarray(l * LP * 3, (l + 1) * LP * 3), j * LP * 3));
        fs.push(f);
        if (its && inten) { const t = new Uint8Array(nl * LP), si = inten[k]; idx.forEach((l, j) => t.set(si.subarray(l * LP, (l + 1) * LP), j * LP)); its.push(t); }
      }
      return { K, NL: nl, LP, Rvals: bondEf.Rvals, frames: fs, inten: its };
    };
    return { ion: sub(true), agua: sub(false) };
  }, [wd, bondEf]);
  if (!wd) return null;
  // ── BEATS SINCRONIZADOS AL GUION (narración 77s, ver scripts/guiones/wpair.txt) ──
  // Hook pegadas (0-4) → separan (revelan 2, 4-9) → APART mientras explica electrones/oxígeno/
  // cargas/campo (9-51) → se ACERCAN (líneas 15-16, 51-62) → pegadas: el enlace=nube (62-77).
  const T = time;
  const sw = (a: number, b: number) => { const t = Math.min(1, Math.max(0, (T - a) / (b - a))); return t * t * (3 - 2 * t); };
  const win = (a: number, b: number) => sw(a - 0.6, a) * (1 - sw(b, b + 0.6));   // 1 en [a,b], bordes suaves
  const Rmin = wd.Rvals[wd.K - 1], Rmax = wd.Rvals[0];
  // SE ACERCAN Y SE ALEJAN durante TODO el video (oscilación sobre los K=30 cálculos que YA
  // existen → "distintos cálculos, distintas separaciones"). Arranca pegadas (pico), oscila
  // ~2 veces, acercamiento limpio en "se acercan" (l15-16), y queda PEGADAS al final (el puente).
  // amplitud REDUCIDA: oscila entre pegadas y MODERADO (nunca max lejos → las nubes y el
  // campo SIEMPRE tienen cuerpo; el verificador cazó que "muy lejos" = cuadro vacío/muerto).
  // LAS CAPAS SE EVALÚAN AQUÍ ARRIBA porque `apertura` (abajo) las necesita. Estaba
  // declarada 34 líneas más abajo y el scene moría en TDZ: `page.waitForFunction`
  // timeout, la escena nunca llegaba a ready. Es el mismo gotcha del replace ciego
  // que ya mordió en los canales del molde.
  const C = evalCapas(W.capas ?? WPAIR_CAPAS, T);
  // LA APERTURA ES UNA CAPA (2026-07-28). Antes esta fórmula estaba QUEMADA aquí con los
  // segundos de EL PUENTE (`T−49`, `/13`) y el anillo la heredó. Medido sobre la curva vieja:
  // en t≈21 la voz dice "el anillo y quién le presta hidrógeno" con el anillo 65% ABIERTO;
  // en t≈37 dice "el anillo CIERRA" mientras se está ABRIENDO; y en t≈42 habla de
  // COOPERATIVIDAD con el anillo 64% abierto — cuando la cooperatividad SOLO existe con el
  // anillo cerrado. No era un defecto estético: la imagen contradecía la física de la voz.
  // (También explica la "L": abierto, el trímero NO CABE en 9:16 sin morder un borde.)
  // Si la pieza no declara `apertura`, se usa la fórmula de siempre → wpair queda idéntico.
  let es: number;
  if (C.apertura !== undefined) {
    // RESPIRACIÓN (Ian, 2026-07-28: "no se mueven las moléculas de distancia, por lo tanto NO
    // VEO EL CAMPO ACTUANDO ni que se repartan las cargas"). Tenía razón: al cerrar el anillo
    // para que dejara de contradecir a la voz lo dejé QUIETO, y sin cambio de distancia el Δρ
    // no crece — o sea que la carga repartiéndose, que es LO que el video cuenta, no ocurre.
    // Las ventanas de capas tienen MESETA: dan movimiento en los beats y luego se congelan
    // (medido: 7 tramos de >4 s sin cambio). Encima va una vibración continua.
    // ES FÍSICA REAL, DECLARADA: el modo intermolecular O···O del trímero está en ~180 cm⁻¹ y
    // su amplitud de punto cero es 0.102 Å (calculada, x_rms = √(ħ/2μω) con μ≈9 uma). Aquí se
    // dibuja EXAGERADA ×2.2 (±0.22 Å) para que se lea en pantalla, y RALENTIZADA: el periodo
    // real es 0.185 ps y aquí son 4 s (2×10¹³ veces más lento). Las dos licencias, declaradas.
    const respira = 0.08 * Math.sin(2 * Math.PI * T / 4.0);
    es = Math.max(0, Math.min(1, C.apertura + respira));
  } else {
    let esr = 0.30 + 0.34 * Math.cos(T * 0.30);      // 0 = pegadas, 0.64 = moderado
    esr *= smoothstep(T / 5);                        // pegadas al inicio (l1-2, espectáculo)
    esr *= (1 - smoothstep((T - 49) / 13));          // acercamiento final 49-62 → pegadas
    es = Math.max(0, Math.min(1, esr));
  }
  const R = Rmin + (Rmax - Rmin) * es;
  let bmMax = 1e-6; for (let i = 0; i < wd.K; i++) bmMax = Math.max(bmMax, wd.bondMass[i]);
  const bb = wapBracket(wd.Rvals, wd.K, R);
  const glow = (wd.bondMass[bb.k] * (1 - bb.frac) + wd.bondMass[bb.k + 1] * bb.frac) / bmMax;
  const inv = 1 / (wd.posq || O2AI_POSQ); const mf = 1 - bb.frac;
  const nucP: Vec3[] = [];
  for (let a = 0; a < wd.NNUC; a++) {
    const o0 = (bb.k * wd.NNUC + a) * 3, o1 = ((bb.k + 1) * wd.NNUC + a) * 3;
    nucP.push([(wd.nucPos[o0] * mf + wd.nucPos[o1] * bb.frac) * inv,
               (wd.nucPos[o0 + 1] * mf + wd.nucPos[o1 + 1] * bb.frac) * inv,
               (wd.nucPos[o0 + 2] * mf + wd.nucPos[o1 + 2] * bb.frac) * inv]);
  }
  // núcleos que ARDEN (los O: átomos 0,3,6…) → el raleo anti-quemado va AHÍ
  const oCores = nucP.filter((_, i) => i % 3 === 0) as [number,number,number][];
  // segmentos O–H reales del bin → el shader enciende la nube que vive sobre ellos
  // OJO: cálculo PLANO, no useMemo — aquí ya pasamos un `return null` temprano y un hook
  // condicional rompe el orden de hooks de React (la escena deja de llegar a `ready`).
  const ohBonds: [Vec3, Vec3][] = [];
  for (let m = 0; m * 3 + 2 < nucP.length; m++) { ohBonds.push([nucP[3 * m], nucP[3 * m + 1]]); ohBonds.push([nucP[3 * m], nucP[3 * m + 2]]); }
  // el ANILLO apila 3 moléculas: mismo brillo que el dímero = pared blanca (medido 30% >240
  // vs 6.6% del ganador). bF baja el brillo SIN tocar color ni saturación.
  // bF compensa las DOS ganancias nuevas: premultipliedAlpha (×1.75 de luz que antes se
  // tiraba porque el alfa se aplicaba dos veces) y sprites 1.35× de radio (área ×1.8).
  // Sin bajarlo, medido: meanY 123 y 3.7% de píxeles >240 = puré blanco sin estructura.
  // La regla del proyecto: la masa la da la DENSIDAD, no la intensidad por partícula.
  // bF se recalibró al arreglar uPix: con los sprites en su tamaño de PUNTO el área iluminada
  // cae ~4× y el cuadro se va a meanY 8 (rala y apagada). La masa la da la DENSIDAD y el BRILLO
  // del punto, no el radio: 0.34 → 0.85. Medido en el master 4K, no en un preview.
  const bF = anillo ? 1.5 : 1.0;
  const szM = W.sizeMul ?? 1;   // sprites a escala de la pieza (ver WaterEntry.sizeMul)
  const pulse = 0.92 + 0.08 * Math.sin(time * 2.0);   // el nebuloso RESPIRA (espectáculo vivo)
  // COREOGRAFÍA sincronizada al guion (segundos de segs.json):
  // CAPAS COMO OBJETOS (capas.ts): la coreografía vive en DATOS (WPAIR_CAPAS), no aquí.
  // Matemáticamente idéntica a las constantes que había — verificado frame a frame.
  const cloudGate = C.nubes, fieldGate = C.campo, twk = C.parpadeo, spinB = C.spin, accB = C.acc;
  // las partes arrancan APAGADAS (base 0 en la coreografía): una pieza que no las pide
  // no las ve, y la que sí las prende una por una para enseñar de qué está hecha la suma.
  const nucGate = C.campoNuc ?? 0, eleGate = C.campoEle ?? 0;
  // NADA de líneas de campo (una línea NO es el enlace ni el campo — es una convención que
  // engaña). El enlace ES la NUBE: el Δρ (magenta = electrones que LLEGAN al puente, azul =
  // de dónde salen), densidad electrónica REAL reacomodándose. Ab initio, no dibujado a mano.
  return (
    <>
      <WaterPairCamera time={time} R={R} ex={W.ex}
        shots={CAMERA_SHOTS[`${mk}-${WPAIR_CAM}`] ?? (mk === 'wpair' ? WPAIR_SHOTS_ACTIVE : (CAMERA_SHOTS[mk] ?? CAMERA_SHOTS.wpair))}
        pts={nucP.filter((_, i) => i % 3 === 0)} />
      {/* TAMAÑO EN FRACCIÓN DE CUADRO, no en píxeles. Antes esto se compensaba A MANO por
          resolución ("×1.85 para 4K") y quedaba a medias: el 16:9 de 1080 salió con electrones
          del DOBLE de tamaño que el preview vertical y 4× que el master (medido: radio/alto
          0.181% vs 0.093% vs 0.044%) → "se ven difuminados, no son puntos" (Ian, 2026-07-29).
          Ahora uPix normaliza contra 3840 de alto y estos números valen para TODA resolución.
          El valor se calibra contra el MASTER 4K, no contra el preview: en un crop 1:1 a 2160×3840
          estos tamaños son PUNTOS, y al duplicarlos se vuelven manchas suaves (el sprite tiene
          borde degradado: agrandarlo muestra la degradación, no el punto). O sea el look bueno
          era el del master; el preview de 1080 era el que mentía. */}
      <O2Cloud premul={anillo} qScale={wd.posq || O2AI_POSQ} posQ={wd.depPos} colors={depColors} Rvals={wd.Rvals} N={wd.Ndep} K={wd.K} R={R} brightness={0.26 * bF * (0.3 + 0.7 * glow) * cloudGate} size={(anillo ? 0.47 : 0.35) * szM} twinkle={twk} tw_time={time} cores={oCores} coreR={0.9} coreThin={0.55} />
      <O2Cloud premul={anillo} qScale={wd.posq || O2AI_POSQ} posQ={wd.accPos} colors={W.binColors ? wd.accColor : accColorWarm} Rvals={wd.Rvals} N={wd.Nacc} K={wd.K} R={R} brightness={0.30 * bF * pulse * cloudGate * accB} size={(anillo ? 0.59 : 0.44) * szM} coreThin={0.72} twinkle={twk} tw_time={time} bonds={anillo ? ohBonds : undefined} bondGlow={anillo ? (C.enlaces ?? 0) * 2.6 : 0} cores={oCores} coreR={0.55} />
      <O2Cloud premul={anillo} qScale={wd.posq || O2AI_POSQ} posQ={wd.spinPos} colors={spinColors} Rvals={wd.Rvals} N={wd.Nspin} K={wd.K} R={R} brightness={(0.34 + 1.05 * glow) * bF * pulse * cloudGate * spinB} size={(anillo ? 0.62 : 0.46) * szM} twinkle={twk} tw_time={time} cores={oCores} coreR={0.9} coreThin={0.80} />
      {/* EL CAMPO ELÉCTRICO (como Li₂): muchas líneas del MEP real que se CONECTAN al unirse.
          NO es el enlace (eso es la nube) — es el campo, la estructura completa. Se intensifica
          al conectarse (glow). Cian-violeta para combinar con oro+morado. */}
      {ceros && <FieldNulls data={ceros} R={R} reveal={C.ceros ?? 0} time={time} />}
      {bondEf && !efIon && <BondEField data={bondEf} R={R} time={time * 8} reveal={Math.min(1.15, 0.78 + 0.4 * glow) * fieldGate} col={[0.42, 0.72, 1.6]} />}
      {/* LAS PARTES. Color con el convenio de siempre: POSITIVO cálido, NEGATIVO frío.
          Prendidas a la vez se ven encimadas y apuntando al revés — que es el argumento. */}
      {efNuc && nucGate > 0.001 && <BondEField data={efNuc} R={R} time={time * 8} reveal={Math.min(1.15, 0.78 + 0.4 * glow) * nucGate} col={[1.75, 0.52, 0.22]} flujo={1} />}
      {efEle && eleGate > 0.001 && <BondEField data={efEle} R={R} time={time * 8} reveal={Math.min(1.15, 0.78 + 0.4 * glow) * eleGate} col={[0.22, 1.05, 1.70]} flujo={1} />}
      {/* LA SAL: el campo se parte en DOS instancias del mismo BondEField — las líneas que nacen
          en el ION, celestes (el erizo radial de una carga entera); las del agua, el azul de la
          serie. Cero shader nuevo: es el mismo componente con otro `col` y un subconjunto. */}
      {efIon && <BondEField data={efIon.agua} R={R} time={time * 8} reveal={Math.min(1.15, 0.78 + 0.4 * glow) * fieldGate} col={[0.42, 0.72, 1.6]} />}
      {efIon && <BondEField data={efIon.ion} R={R} time={time * 8} reveal={Math.min(1.15, 0.78 + 0.4 * glow) * fieldGate} col={[0.70, 1.30, 1.75]} />}
      {/* ENLACES O–H + DIPOLO — solo el anillo, y gobernados por las capas (datos):
          se PRENDEN en "un oxígeno y dos hidrógenos" y en la firma "una queda al revés". */}
      {anillo && <WaterSticks nuc={nucP} show={C.enlaces ?? 0} showDip={C.dipolo ?? 0} />}
      {nucP.map((p, i) => (
        <group key={i} position={p}>
          {/* BUG 5 (agentes): los H medían ~6 px ahogados por el bloom → "un oxígeno y dos
              hidrógenos" y "una queda al revés" eran INDECIDIBLES. En el anillo los H se
              agrandan y se pintan CÁLIDOS (el O queda frío) para que se cuenten 3 átomos
              por molécula y se LEA hacia dónde apunta cada H (= el volteo). */}
          <Nucleus protons={wd.Z[i]} neutrons={wd.Z[i] === 8 ? 8 : wd.Z[i] === 11 ? 12 : 0} time={time}
            clusterRadius={(wd.Z[i] === 11 ? 0.13 : wd.Z[i] === 8 ? (anillo ? 0.165 : 0.10) : (anillo ? 0.068 : 0.05)) * (W.nucMul ?? 1)}
            nHot={wd.Z[i] === 11 ? [0.95, 1.30, 1.75] : wd.Z[i] === 8 || !anillo ? [0.62, 0.9, 1.35] : [1.5, 0.72, 0.22]}
            nHue={wd.Z[i] === 11 ? 0.52 : wd.Z[i] === 8 || !anillo ? 0.55 : 0.08} />
        </group>
      ))}
    </>
  );
}

// ── LOS PUNTOS DONDE EL CAMPO VALE CERO ────────────────────────────────────────────────
// Ian, 2026-07-28: "sé que los campos se cancelan, MUÉSTRAMELO ENTONCES". Aquí están: entre
// cada oxígeno y el hidrógeno que le donan hay un punto con E = 0 EXACTO — medido en los 26
// cuadros con |E| entre 1e-14 y 1e-24, o sea cero a precisión de máquina
// (NWAT=3 scripts/precompute-water-ring.py --ceros). Una carga de prueba puesta ahí NO SE MUEVE.
//
// Y explica lo que se veía "raro": las líneas de campo no se desvanecen en el aire por un
// defecto de dibujo — LLEGAN a este punto y se acaban, porque más allá el campo cambia de
// signo. Es la frontera real del oxígeno.
//
// Se dibuja como un ANILLO fino y hueco: lo que hay ahí es nada, y un punto lleno diría lo
// contrario. Las posiciones se interpolan por R(t) igual que todo lo demás, así que viajan
// con las moléculas.
type CerosData = { K: number; Rvals: Float32Array; pts: Float32Array[] };
function parseCeros(j: { K: number; Rvals: number[]; cuadros: { ceros: number[][] }[] }): CerosData {
  return { K: j.K, Rvals: new Float32Array(j.Rvals),
           pts: j.cuadros.map(c => new Float32Array(c.ceros.flat())) };
}
function FieldNulls({ data, R, reveal, time, esc = 1 }: { data: CerosData; R: number; reveal: number; time: number; esc?: number }) {
  const { camera } = useThree();
  if (reveal < 0.01) return null;
  const { K, Rvals, pts } = data;
  let k = 0;
  if (R >= Rvals[0]) k = 0; else if (R <= Rvals[K - 1]) k = K - 2;
  else { while (k < K - 2 && Rvals[k + 1] > R) k++; }
  const r0 = Rvals[k], r1 = Rvals[k + 1];
  const f = r0 === r1 ? 0 : Math.max(0, Math.min(1, (r0 - R) / (r0 - r1)));
  const A = pts[k], B = pts[k + 1];
  const n = Math.min(A.length, B.length) / 3;
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) out.push([A[i * 3] * (1 - f) + B[i * 3] * f,
                                        A[i * 3 + 1] * (1 - f) + B[i * 3 + 1] * f,
                                        A[i * 3 + 2] * (1 - f) + B[i * 3 + 2] * f]);
  const pul = 0.86 + 0.14 * Math.sin(time * 2.4);
  return (
    <>
      {out.map((p, i) => (
        <sprite key={i} position={p} scale={[1.30 * pul * esc, 1.30 * pul * esc, 1]}>
          <spriteMaterial map={RING_TEX} color="#7dfbe0" transparent opacity={reveal * 0.95}
            depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </>
  );
}

// ── FÓRMULAS EN LaTeX (KaTeX) — la ecuación Y qué representa cada símbolo ──
// Va como overlay DOM sobre el canvas, no dentro del Canvas: drei <Text> revienta con
// EffectComposer (regla del proyecto). KaTeX ya es dependencia y su CSS entra por main.css.
// Cada fórmula aparece cuando su física está EN PANTALLA — la ecuación no es decoración,
// es el pie de foto de lo que se está viendo.
interface FormulaBeat { t0: number; t1: number; tex: string; que: string; }
// El rótulo de la serie (MoleculeTitle) vive de 2.4 s a 21.3 s y YA dice "∮E·dA = 4πQ".
// Por eso la de Gauss en LaTeX entra hasta 23.1 s, justo cuando la voz la nombra: dos veces
// la misma ecuación en pantalla al mismo tiempo es ruido, no énfasis.
const CARGAS_FORMULAS: FormulaBeat[] = [
// El `que` va a UNA sola línea: a 3.2vw sobre 84% de un 9:16 caben ~50 caracteres, y la
// segunda línea caía justo encima de la carga de arriba (medido en el still de t=36).
  { t0: 11.0, t1: 15.6, tex: String.raw`\vec{E}=\frac{q}{r^{2}}\,\hat{r}`,
    que: 'Coulomb: el campo cae con el CUADRADO de r' },
  { t0: 18.8, t1: 22.7, tex: String.raw`Q_{\text{dentro}} = (+q) + (-q) = 0`,
    que: 'Carga neta 0 adentro: las 100 líneas CIERRAN' },
  { t0: 30.4, t1: 37.1, tex: String.raw`\oint \vec{E}\cdot d\vec{A}=4\pi Q`,
    que: 'El flujo solo depende de la carga de ADENTRO' },
  { t0: 37.7, t1: 44.8, tex: String.raw`\sum q_i = 0 \;\Rightarrow\; N_{\text{escapan}} = 0`,
    que: '300 líneas: todas nacen en + y mueren en −' },
  { t0: 54.0, t1: 62.3, tex: String.raw`Q(r)=e^{-2r}\left(1+2r+2r^{2}\right)`,
    que: 'H 1s: la carga que queda DENTRO del radio r' },
  { t0: 66.9, t1: 77.2, tex: String.raw`\vec{E}(r)=\frac{Q(r)}{r^{2}}\,\hat{r}`,
    que: 'La nube se come la carga: el campo se APAGA' },
];

function FormulaOverlay({ time, vertical, beats }: { time: number; vertical: boolean; beats: FormulaBeat[] }) {
  const b = beats.find(x => time >= x.t0 - 0.5 && time <= x.t1 + 0.5);
  const html = useMemo(() => {
    if (!b) return '';
    try { return katex.renderToString(b.tex, { displayMode: true, throwOnError: false }); }
    catch { return ''; }
  }, [b]);
  if (!b || !html) return null;
  const op = smoothstep((time - (b.t0 - 0.5)) / 0.5) * (1 - smoothstep((time - b.t1) / 0.5));
  if (op < 0.01) return null;
  return (
    <div style={{ position: 'absolute', top: vertical ? '9%' : '7%', left: 0, right: 0, zIndex: 12,
      pointerEvents: 'none', opacity: op, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="chalk-katex" style={{ color: '#eaf6ff', fontSize: vertical ? '6.4vw' : '2.5vw',
        textShadow: '0 4px 42px rgba(0,0,0,0.9)' }}
        dangerouslySetInnerHTML={{ __html: html }} />
      <div style={{ marginTop: vertical ? '2.4vw' : '0.9vw', color: 'rgba(127,212,255,0.92)',
        fontSize: vertical ? '3.2vw' : '1.15vw', fontWeight: 500, lineHeight: 1.35,
        maxWidth: vertical ? '84%' : '58%', margin: '0 auto',
        textShadow: '0 2px 24px rgba(0,0,0,0.95)' }}>{b.que}</div>
    </div>
  );
}

// ══ LAS CARGAS — LA LEY DE GAUSS, VISIBLE ═══════════════════════════════════════════════
// No es química: son SEIS cargas puntuales en un hexágono, alternando + y −, que aparecen una
// por una (scripts/precompute-cargas.py, 24 cuadros). El motor es el MISMO del anillo: las
// líneas salen de `parseBondEField` (idéntico formato de .bin) y la cámara de `playShots`.
//
// Lo que se ve ES el teorema: se dibujan 30 líneas por unidad de carga, así que el número de
// líneas que ESCAPAN al infinito tiene que ser exactamente 30·Q_neta. Mientras falte una
// carga, Q≠0 y se escapan (14 con una sola +); cuando entra la sexta, Q=0 y NO SE ESCAPA
// NINGUNA: cada línea nace en un + y muere en un −, el campo se cierra sobre sí mismo. El
// script lo verifica cuadro por cuadro contra esa predicción (no es decorado: es la cuenta).
//
// Paleta: la de la casa (oro + morado, ver la serie del agua). El + es ORO porque de ahí NACEN
// las líneas; el − es MORADO porque ahí MUEREN. Las líneas, el mismo cian-azul de la serie.
// EL ASPECTO DE UNA CARGA. Ian (2026-07-30): "los puntos de carga se ven supersimples,
// aburridos". Lo eran: esferas de color plano con un degradado inventado encima. Dos cambios,
// y los dos vienen de la física, no del gusto:
//
//  1. El halo NO es una gaussiana: es |E| = q/r², el campo de verdad, pintado píxel a píxel y
//     saturado en el núcleo. Así el brillo alrededor de la carga CAE como cae el campo.
//  2. Un + y un − dejan de ser "la misma bolita de otro color": son distintos EN ESPECIE.
//     El + es una FUENTE (núcleo blanco ardiendo, de ahí nacen las líneas) y el − es un POZO
//     (centro OSCURO con un anillo luminoso: el campo se hunde ahí). Se lee de un vistazo
//     quién emite y quién traga, que es justo lo que la pieza está contando.
function _texCampo(pozo: boolean) {
  const N = 192, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d')!, im = g.createImageData(N, N), d = im.data;
  const R = N / 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x - R + 0.5) / R, dy = (y - R + 0.5) / R;
    const r = Math.hypot(dx, dy);
    let a = 0;
    if (r <= 1) {
      // |E| ∝ 1/r², normalizado a r=1 y saturado cerca del centro (donde diverge)
      a = Math.min(1, 0.020 / (r * r + 1e-4));
      if (pozo) {
        // POZO: el centro se vacía y queda un anillo — el campo ENTRA, no sale.
        const anillo = Math.exp(-Math.pow((r - 0.30) / 0.10, 2));
        a = Math.max(anillo, a * 0.45) * (r < 0.18 ? 0.10 : 1);
      }
      a *= 1 - Math.pow(r, 3);                     // borde limpio, sin corte duro
    }
    const i = (y * N + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = Math.round(255 * Math.max(0, Math.min(1, a)));
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
const FUENTE_TEX = _texCampo(false);   // carga +
const POZO_TEX = _texCampo(true);      // carga −

// textura del CERO: dos anillas concéntricas huecas. Va como SPRITE, no como toro, porque un
// sprite lo encara three.js EN EL MOMENTO DE DIBUJAR. Calculando yo el quaternion con
// camera.position quedaba un frame ATRASADO (el efecto que mueve la cámara corre DESPUÉS del
// render), y con la cámara en movimiento el anillo salía ladeado: medido 1.130 de alto/ancho
// en una toma con paneo contra 0.966 en una quieta. Un cero del campo no puede verse ovalado.
const RING_TEX = (() => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = N * 0.055;
  g.beginPath(); g.arc(N / 2, N / 2, N * 0.30, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.38)'; g.lineWidth = N * 0.022;
  g.beginPath(); g.arc(N / 2, N / 2, N * 0.44, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
})();

type CargasCuadro = { k: number; q: number[]; pos: number[][]; Q: number; n_activas: number; escapan: number; ceros: number[][]; atomo?: boolean };
type CargasMeta = { K: number; NL: number; LP: number; radio: number; por_carga: number; cuadros: CargasCuadro[] };

// Coreografía como DATOS (capas.ts). `paso` recorre los 24 cuadros con PAUSAS donde la voz
// explica: no es lineal en t, es lineal en la HISTORIA.
const CARGAS_CAPAS: CapasSpec = {
  // 0 → 1 = cuadro 0 → 23. Las pausas salen de repetir el mismo valor en dos ventanas.
  // IN MEDIAS RES (la estructura que ya funcionó en la serie): el segundo 0 abre con el
  // hexágono COMPLETO — el campo cerrado, lo más bonito que tiene la pieza — y a los ~4 s
  // rebobina a UNA sola carga para contar cómo se llegó ahí. Arrancar en la carga sola dejaba
  // el gancho casi en negro (medido: meanY 1.5, 97.7% del cuadro negro).
  // Las 6 ETAPAS del .bin (66 cuadros = 6 × 11). paso = (etapa·11 + 5)/65 cae en el centro de
  // cada etapa, así ninguna se salta: 1→2→3→4→5→6 cargas. Entre etapas el .bin interpola dos
  // configuraciones distintas, así que la carga nueva no aparece de golpe: las líneas SE
  // REACOMODAN. Y arranca con el hexágono COMPLETO (in medias res) porque abrir en la carga
  // sola dejaba el gancho casi en negro (medido: meanY 1.5, 97.7% del cuadro negro).
  // 7 etapas en el .bin (77 cuadros = 7 × 11): 1..6 cargas + EL ÁTOMO. El centro de la etapa s
  // es paso = (s·11 + 5)/76, así ninguna se salta. Base 0.066 = una sola carga.
  // ABRE EN EL HEXÁGONO CERRADO, y la voz lo dice ("ciento ochenta líneas… empecemos por una
  // sola") — así lo que se OYE es lo que se VE y aun así el gancho es la imagen densa.
  // Por qué: medido contra los frame 0 que SÍ funcionaron (dímero/trímero), una carga sola da
  // colorido 15 y detalle 1.2 contra 56-59 y 8-13 de los ganadores. Los ganadores también son
  // ~80% negro; ganan porque el 20% encendido tiene MUCHAS líneas CURVAS que se CRUZAN y 3-4
  // tonos a la vez. Un sujeto solo y simétrico no puede llegar ahí (ver feedback_frame0_es_el_gancho).
  // OJO con `evalCapas`: los mods SUMAN a `base`, no lo sustituyen. Por eso `a` es un DELTA
  // (s·11/76) sobre base=5/76 → paso = (s·11+5)/76 = el CENTRO de la etapa s, nunca el borde
  // entre dos configuraciones. Y cada ventana CIERRA 0.6 s antes de que abra la siguiente
  // (edge=0.6), así la caída de una coincide con la subida de la otra: el paso morfea sin
  // sumarse consigo mismo. La subida cae en el segundo EXACTO en que la voz lo dice
  // (segs.json: 8.68 · 16.15 · 19.75 · 25.82 · 30.08 · 48.29).
  paso:    { base: 0.0658, mods: [
    { wins: [[0.0, 10.4]],   a: 0.72368, label: 'GANCHO: 6 cargas, 3 y 3, las 300 líneas (voz 0.40-10.45)' },
    { wins: [[16.8, 23.4]],  a: 0.14474, label: '2 OPUESTAS: Q=0 y las 100 líneas CIERRAN (voz 16.15)' },
    { wins: [[24.0, 26.9]],  a: 0.28947, label: '3: vuelve a haber fuga (voz 23.33)' },
    { wins: [[27.5, 33.2]],  a: 0.43421, label: '4: cierra otra vez, 200 de 200 (voz 26.85)' },
    { wins: [[33.8, 37.7]],  a: 0.57895, label: '5: se van las que sobran (voz 33.15)' },
    { wins: [[38.3, 54.0]],  a: 0.72368, label: 'la SEXTA: 300 de 300 CIERRAN, cero fugas (voz 37.65)' },
    { wins: [[54.7, 83.2]],  a: 0.86842, label: 'EL ÁTOMO DE HIDRÓGENO: la misma ley en materia real (voz 54.04)' }],
  },
  campo:   { base: 0.95 },
  cargas:  { base: 1.0 },
};

function CargasHex({ time, onReady }: { time: number; onReady?: (r: boolean) => void }) {
  const [ef, setEf] = useState<BondEFieldData | null>(null);
  const [meta, setMeta] = useState<CargasMeta | null>(null);
  const bundleH = useMemo(() => buildAtomBundle(elementByZ(1)!), []);
  useEffect(() => {
    let alive = true;
    fetch('/precomputed/cargas-gauss-efield.bin').then(r => r.arrayBuffer())
      .then(b => { if (alive) { setEf(parseBondEField(b)); onReady?.(true); } })
      .catch(e => console.error('cargas efield load failed', e));
    fetch('/precomputed/cargas-gauss.json').then(r => r.json())
      .then(j => { if (alive) setMeta(j as CargasMeta); })
      .catch(e => console.error('cargas json load failed', e));
    return () => { alive = false; };
  }, [onReady]);
  if (!ef || !meta) return null;
  const C = evalCapas(CARGAS_CAPAS, time);
  const paso = Math.max(0, Math.min(1, C.paso));
  const kf = paso * (meta.K - 1);                 // cuadro continuo 0..K-1
  const R = meta.K - kf;                          // Rvals del .bin son [K, K-1, … 1] (descendente)
  const cu = meta.cuadros[Math.max(0, Math.min(meta.K - 1, Math.round(kf)))];
  const pul = 0.92 + 0.08 * Math.sin(time * 2.2);
  // ANCLA = el hexágono COMPLETO, siempre. Anclar a las cargas ya activas parecía más
  // "honesto" y era un error de encuadre: el centro de masa se mueve cada vez que entra una
  // carga, así que la composición NADA (en la etapa de 2 cargas el par se iba abajo-derecha y
  // media pantalla quedaba vacía). El hexágono es geometría FIJA y conocida: es el ancla.
  //
  // UNA excepción, medida: en la etapa de la carga SOLA el hexágono es un fantasma (5 de sus 6
  // vértices están vacíos) y encuadrarlo deja la estrella en (50%, 73%) con el 40% de arriba en
  // negro muerto (still de t=1.5) — justo el void que prohíbe la doctrina, y encima en el
  // gancho. Se corrige DESPLAZANDO el hexágono entero para que su centro caiga sobre la carga
  // viva, y el desplazamiento vuelve a cero entre 9.6 y 11.6 s. Desplazar TODOS los puntos por
  // igual deja rCore intacto (1.55 bohr) → la ley de encuadre se comporta idéntico; lo único
  // que se mueve es A DÓNDE MIRA la cámara. El arranque del retorno cae en el corte de 9.6 s.
  // La primera carga (ORDEN[0]) queda activa TODA la pieza, así que `iSola` no cambia y el
  // desplazamiento es continuo en t — no se puede condicionar a n_activas===1: ese salto
  // caería a mitad de la rampa (t≈9.3), dentro de la toma, y se vería el brinco de cámara.
  // `sola` = 1 SOLO mientras vive la carga única (5.4→11.4 s con bordes suaves). Fuera de esa
  // ventana el ancla es el hexágono real: al abrir en el hexágono cerrado (el gancho) hay que
  // encuadrarlo COMPLETO, no la carga.
  const iSola = cu.q.findIndex(q => Math.abs(q) > 1e-6);
  const sola = smoothstep((time - 10.1) / 0.9) * (1 - smoothstep((time - 16.2) / 0.9));
  const d0: Vec3 = (!cu.atomo && iSola >= 0 && sola > 0.001)
    ? [cu.pos[iSola][0] * sola, cu.pos[iSola][1] * sola, cu.pos[iSola][2] * sola]
    : [0, 0, 0];
  // …y el hexágono también se ENCOGE, no solo se mueve. La ley de encuadre (camera-shots.ts)
  // mide rCore sobre `pts` y aleja la cámara para que quepa: con el hexágono a tamaño real
  // clavaba la distancia mínima en 6.45 bohr y el `rMul` de la toma no hacía NADA (medido:
  // bajar rMul de 1.02 a 0.52 dejó el frame 0 igual, 96.4% negro). En la etapa de la carga
  // sola el hexágono es un fantasma, así que su radio no debe mandar sobre el encuadre.
  const esc = 1 - 0.72 * sola;
  const pts: Vec3[] = cu.pos.map(p => [p[0] * esc + d0[0], p[1] * esc + d0[1], p[2] * esc + d0[2]] as Vec3);
  return (
    <>
      {/* halo declarado por etapa: el hexágono llena ~11 bohr, el átomo muere a 3.95 bohr
          (donde su campo cae al umbral térmico). Sin esto la cámara encuadra el átomo con el
          tamaño del hexágono y queda un punto perdido en medio del cuadro. */}
      <CargasCamera time={time} pts={pts} radio={meta.radio} rHalo={cu.atomo ? 4.6 : 11.0} />
      {/* el CAMPO: mismas líneas del anillo, mismo shader, mismo color de la serie */}
      {/* LÍNEAS MÁS BRILLANTES que en el agua: aquí el campo ES el sujeto (en el agua compite
          con la nube de electrones). El color es aditivo, así que subirlo = línea más presente
          sin engordarla — engordarla exigiría cambiar de líneas WebGL (1 px fijo) a geometría. */}
      {/* aquí el campo ES el sujeto (no compite con una nube de electrones): cinta más gruesa */}
      <BondEField data={ef} R={R} time={time * 8} reveal={C.campo} col={[0.85, 1.45, 3.1]} ancho={10.5} rampa={1} />
      {/* EL ÁTOMO: un protón y SU nube real (buildAtomBundle del hidrógeno = la misma
          maquinaria de la serie de átomos). Las líneas de campo salen del .bin igual que
          antes; lo que cambia es que aquí el − no es otra bolita sino una nube de
          probabilidad, y por eso las líneas no MUEREN en nada: se APAGAN. */}
      {cu.atomo && (
        <>
          <Nucleus protons={1} neutrons={0} time={time} clusterRadius={0.055}
            nHot={[1.5, 0.72, 0.22]} nHue={0.08} />
          {/* la nube del H tiene POCOS electrones (uno) → sin subir el brillo lee como polvo
              de estrellas y no como una nube que ENVUELVE. 1.15 → 2.4, medido a ojo en 4K. */}
          <ElectronCloud bundle={bundleH} time={time} holeRadius={0.05} brightness={2.4} />
        </>
      )}
      {!cu.atomo && cu.pos.map((p, i) => {
        const q = cu.q[i];
        if (Math.abs(q) < 1e-6) return null;
        const mas = q > 0;
        // + = ORO ardiendo (de aquí NACEN las líneas) · − = MORADO hundiéndose (aquí MUEREN)
        const col = mas ? '#ffc247' : '#b76bff';
        const rad = 0.11 * pul * Math.min(1, Math.abs(q) * 1.6);
        return (
          <group key={i} position={[p[0], p[1], p[2]]}>
            {/* el núcleo SOLO en la fuente: el pozo no tiene centro brillante, tiene hueco */}
            {mas && <mesh><sphereGeometry args={[rad * 0.62, 20, 16]} />
              <meshBasicMaterial color="#fffdf2" /></mesh>}
            <sprite scale={[rad * 11, rad * 11, 1]}>
              <spriteMaterial map={mas ? FUENTE_TEX : POZO_TEX} color={col}
                transparent opacity={(mas ? 0.95 : 1.0) * C.cargas}
                depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>
          </group>
        );
      })}
      {/* El CERO del campo NO se dibuja. Ian lo mandó quitar ("quítale esas cosas feas que
          muestran dónde se cancela el campo") y tenía razón dos veces: el anillo es un símbolo
          pegado encima, no física que se vea. Aquí el cero se MUESTRA solo — la cámara se mete
          al hueco del hexágono y ahí no pasa ni una línea. El dato sigue en el .json
          (cu.ceros) por si vuelve a hacer falta. */}
    </>
  );
}

// ══ FARADAY — LA JAULA ═══════════════════════════════════════════════════════════════════
// REUSA TODO: el campo son las MISMAS cintas de BondEField (mismo .bin, mismo shader con
// difuminado y color por dirección), la cámara es playShots + CAMERA_SHOTS.faraday, y las
// cargas usan las mismas texturas FUENTE_TEX/POZO_TEX. Lo único propio es la geometría de
// la jaula, que viene del .json del solver.
type FaradayCuadro = { k: number; d: number; rq: number[]; apantalla: number; e_dentro: number; e_sin: number };
type FaradayMeta = { K: number; NL: number; LP: number; L: number; jaula: number[][]; apantalla_min: number; cuadros: FaradayCuadro[] };

const FARADAY_CAPAS: CapasSpec = {
  paso:  { base: 0, mods: [{ wins: [[0.0, FARADAY_DURATION]], a: 1.0, label: 'la carga se acerca de 26 a 5.6 bohr' }] },
  campo: { base: 0.95 },
};

function JaulaHilos({ pts, L }: { pts: number[][]; L: number }) {
  // los alambres, como puntos de acero tenue: NO deben competir con el campo (es el sujeto).
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const a = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => { a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; });
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }, [pts]);
  // CON TEXTURA REDONDA y CHICOS: sin `map`, PointsMaterial dibuja CUADRADOS sólidos y la
  // jaula sale como un tablero de Minecraft tapando el campo (medido a ojo en el still t=21).
  // Y tenues a propósito: el sujeto es el CAMPO, la jaula es el obstáculo.
  const mat = useMemo(() => new THREE.PointsMaterial({
    size: L * 0.030, sizeAttenuation: true, map: FUENTE_TEX,
    color: new THREE.Color(0.78, 0.86, 1.05),
    transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending,
  }), [L]);
  return <points geometry={geo} material={mat} />;
}

function FaradayJaula({ time, onReady }: { time: number; onReady?: (r: boolean) => void }) {
  const [ef, setEf] = useState<BondEFieldData | null>(null);
  const [meta, setMeta] = useState<FaradayMeta | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/precomputed/faraday-jaula-efield.bin').then(r => r.arrayBuffer())
      .then(b => { if (alive) { setEf(parseBondEField(b)); onReady?.(true); } })
      .catch(e => console.error('faraday efield load failed', e));
    fetch('/precomputed/faraday-jaula.json').then(r => r.json())
      .then(j => { if (alive) setMeta(j as FaradayMeta); })
      .catch(e => console.error('faraday json load failed', e));
    return () => { alive = false; };
  }, [onReady]);
  if (!ef || !meta) return null;
  const C = evalCapas(FARADAY_CAPAS, time);
  const paso = Math.max(0, Math.min(1, C.paso));
  const kf = paso * (meta.K - 1);
  const R = meta.K - kf;
  const cu = meta.cuadros[Math.max(0, Math.min(meta.K - 1, Math.round(kf)))];
  const rq = cu.rq as Vec3;
  const pul = 0.92 + 0.08 * Math.sin(time * 2.2);
  const rad = 0.30 * pul;
  // ANCLA: la jaula + la carga, para que ambas quepan mientras se acerca.
  // ANCLA = SOLO la jaula, geometría FIJA (misma lección del hexágono). Meter la carga en el
  // ancla movía el encuadre de 26 a 5.6 bohr y la composición nadaba en cada cuadro.
  const pts: Vec3[] = meta.jaula.map(p => [p[0], p[1], p[2]] as Vec3);
  return (
    <>
      <CargasCamera time={time} pts={pts} radio={meta.L * 0.5} rHalo={meta.L * 1.75} />
      <BondEField data={ef} R={R} time={time * 8} reveal={C.campo} col={[0.85, 1.45, 3.1]}
        ancho={10.5} rampa={1} caja={meta.L * 0.5} />
      <JaulaHilos pts={meta.jaula} L={meta.L} />
      {/* el "rayo": la carga externa, con la MISMA textura de fuente que en cargas */}
      <group position={rq}>
        <mesh><sphereGeometry args={[rad * 0.62, 20, 16]} /><meshBasicMaterial color="#fffdf2" /></mesh>
        <sprite scale={[rad * 11, rad * 11, 1]}>
          <spriteMaterial map={FUENTE_TEX} color="#ffc247" transparent opacity={0.95}
            depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
    </>
  );
}

/** Cámara de las cargas: el SUJETO es el campo, no las bolitas. Por eso rHalo se declara
 *  grande a mano — la ley de encuadre mide el núcleo con `pts` (radio del hexágono = 1.55
 *  bohr) y si no le dices que el halo llega a ~11 bohr, encuadra las cargas y CORTA el campo. */
function CargasCamera({ time, pts, radio, rHalo = 11.0 }: { time: number; pts: Vec3[]; radio: number; rHalo?: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const asp = size.width / Math.max(1, size.height);
    const p = playShots(CAMERA_SHOTS.cargas, time,
      { ex: radio * 4.2, nucX: 0, bondR: radio, t: time, pts, aspect: asp, rHalo });
    cam.position.set(p.pos[0], p.pos[1], p.pos[2]);
    cam.lookAt(p.target?.[0] ?? 0, p.target?.[1] ?? 0, p.target?.[2] ?? 0);
    const esVert = asp < 1;
    cam.rotation.z += esVert ? (p.roll ?? 0) : 0;
    cam.fov = esVert ? Math.min(95, p.fov * 1.42) : p.fov;
    cam.updateProjectionMatrix();
  }, [camera, size, time, pts, radio]);
  return null;
}

// ── CAMPO ELÉCTRICO de la diatómica (líneas de fuerza REALES, precompute-bond-efield.py) ──
// V(r)=núcleos(+) − electrones(−), E=−∇V, integradas a líneas. Brotan de cada núcleo y
// se curvan APANTALLADAS por las capas → el átomo COMPLETO, no un punto morado. Pulsos
// cian viajan hacia afuera (la dirección del campo). Mismas coords bohr que el enlace.
type BondEFieldData = { K: number; NL: number; LP: number; Rvals: Float32Array;
                        frames: Float32Array[]; inten: Uint8Array[] | null };
function parseBondEField(buf: ArrayBuffer): BondEFieldData {
  const dv = new DataView(buf);
  const K = dv.getInt32(0, true), NL = dv.getInt32(4, true), LP = dv.getInt32(8, true);
  let off = 12;
  const Rvals = new Float32Array(buf.slice(off, off + K * 4)); off += K * 4;
  const q = new Int16Array(buf, off, K * NL * LP * 3);
  const stride = NL * LP * 3;
  const frames: Float32Array[] = [];
  for (let k = 0; k < K; k++) {
    const fr = new Float32Array(stride);
    for (let i = 0; i < stride; i++) fr[i] = q[k * stride + i] / 2000;
    frames.push(fr);
  }
  // BLOQUE OPCIONAL AL FINAL: uint8 |E| por punto (log). Si el .bin no lo trae (los viejos
  // no lo traen), inten queda null y el shader usa el perfil de siempre. Sin este brillo la
  // línea termina CORTADA en el aire = el "despeinado"; con él se apaga sola.
  off += K * stride * 2;
  let inten: Uint8Array[] | null = null;
  if (buf.byteLength >= off + K * NL * LP) {
    const raw = new Uint8Array(buf, off, K * NL * LP);
    inten = [];
    for (let k = 0; k < K; k++) inten.push(raw.subarray(k * NL * LP, (k + 1) * NL * LP));
  }
  return { K, NL, LP, Rvals, frames, inten };
}

// El campo se INTERPOLA por R(t): a cada separación es el campo REAL calculado (dos campos
// radiales separados → uno molecular al juntarse). Líneas ESTABLES; un pulso viaja hacia
// afuera (dirección del campo). Sin sprites que se amontonen = sin "colapso".
// `ancho` = grosor de la línea EN PÍXELES DEL MASTER 4K (3840 de alto). Se normaliza por la
// resolución real, así el preview 1080 predice el master — misma lección que gl_PointSize
// (ver feedback_juzgar_a_resolucion_del_master). ANTES esto era <lineSegments>, o sea líneas
// WebGL de 1 px: en WebGL el grosor de línea NO se puede subir, y a 4K un píxel es NADA.
// Medido: el frame 0 de las cuatro piezas salía 80-97% negro contra 12-24% de los ganadores,
// y Ian lo cachó como "hay muy poco espectáculo visual". Ahora cada segmento es una CINTA
// orientada a la pantalla, con perfil suave a lo ancho para que lea como filamento de luz
// y no como listón plano.
// `rampa`: colorea la línea por la DIRECCIÓN del campo (oro donde nace en el +, violeta donde
// muere en el −). Ian: "usa colores, unos son positivos y otros negativos, aquí las líneas son
// iguales". Antes probé colorear por |E| y lo MEDÍ: bajaba el colorido de 41.2 a 39.4 (el oro
// competía con el de la carga y el cian desaturaba). Por dirección sí paga, y además enseña.
// Default 0 = apagada, para no mover el look ya aprobado de O₂/agua.
function BondEField({ data, R, time, reveal, col, ancho = 4.4, rampa = 0, caja, flujo = 0 }: { data: BondEFieldData; R: number; time: number; reveal: number; col?: [number, number, number]; ancho?: number; rampa?: number; caja?: number; flujo?: number }) {
  // `flujo` (0 = como siempre, bit-idéntico) convierte el pulso viajero en un COMETA con
  // cabeza y cola, para que se VEA hacia dónde va la línea.
  // POR QUÉ (ian, 2026-09-01, viendo los dos campos): "el negativo se ve igual al positivo,
  // tal vez sea eso, que son el mismo y no lo capto". No era él: era el dibujo. Lo ÚNICO que
  // distingue los dos campos es la DIRECCIÓN (el positivo sale, el negativo entra) y no la
  // estábamos dibujando — encima la densidad electrónica también se apiña en los núcleos, así
  // que hasta la forma les salía parecida. El trazador ya ordena cada línea a favor de E
  // (trace_field3d apila la pata de atrás invertida + la de adelante), así que el pulso YA
  // viaja en el sentido bueno: solo había que hacerlo visible.
  const { K, NL, LP, Rvals, frames, inten } = data;
  const cCol = col ?? [0.55, 0.85, 1.0];
  const gl = useThree(s => s.gl);
  const alto = useThree(s => s.size.height) * useThree(s => s.viewport.dpr);
  const built = useMemo(() => {
    // UNA TIRA CONTINUA POR LÍNEA (2 vértices por punto), no cuadros sueltos por
    // segmento. Con cuadros sueltos cada uno se ensancha perpendicular a SU propia
    // dirección y en cada unión los bordes no coinciden: a 10 px de ancho eso se ve
    // como RIZADO en todas las líneas (Ian, 2026-07-30). Con la tira, cada punto
    // conoce a sus DOS vecinos y se ensancha por el MITER (tangente promedio).
    const V = NL * LP;
    const pos = new Float32Array(V * 6), ant = new Float32Array(V * 6), sig = new Float32Array(V * 6);
    const aS = new Float32Array(V * 2), aL = new Float32Array(V * 2);
    const aE = new Float32Array(V * 2), aLado = new Float32Array(V * 2);
    const idx = new Uint32Array(NL * (LP - 1) * 6);
    let o = 0, oi = 0;
    for (let j = 0; j < NL; j++) {
      for (let s = 0; s < LP; s++) {
        const u = s / (LP - 1);
        aS[o] = u; aS[o + 1] = u;
        aL[o] = j; aL[o + 1] = j;
        aLado[o] = -1; aLado[o + 1] = 1;
        o += 2;
      }
      const b = j * LP * 2;
      for (let s = 0; s < LP - 1; s++) {
        const q = b + s * 2;
        idx[oi++] = q; idx[oi++] = q + 1; idx[oi++] = q + 2;
        idx[oi++] = q + 2; idx[oi++] = q + 1; idx[oi++] = q + 3;
      }
    }
    aE.fill(1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAnt', new THREE.BufferAttribute(ant, 3));
    geo.setAttribute('aSig', new THREE.BufferAttribute(sig, 3));
    geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    geo.setAttribute('aL', new THREE.BufferAttribute(aL, 1));
    geo.setAttribute('aE', new THREE.BufferAttribute(aE, 1));
    geo.setAttribute('aLado', new THREE.BufferAttribute(aLado, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uOp: { value: 0 }, uCol: { value: new THREE.Color(cCol[0], cCol[1], cCol[2]) },
                  uT: { value: 0 }, uUsaE: { value: inten ? 1 : 0 },
                  uRes: { value: new THREE.Vector2(2160, 3840) }, uW: { value: 4.4 },
                  uRampa: { value: 0 }, uCaja: { value: 0 }, uFlujo: { value: 0 } },
      // MITER en espacio de PANTALLA: la normal sale de la tangente PROMEDIO de los dos
      // segmentos que llegan al punto, y la anchura se divide entre cos(θ/2) para que la
      // cinta no se adelgace en las curvas. El clamp evita púas en giros muy cerrados.
      vertexShader: `attribute vec3 aAnt; attribute vec3 aSig; attribute float aS; attribute float aL; attribute float aE; attribute float aLado;
        uniform vec2 uRes; uniform float uW; uniform float uCaja;
        varying float vS; varying float vL; varying float vE; varying float vLado; varying float vDentro;
        void main(){ vS=aS; vL=aL; vE=aE; vLado=aLado;
          // 1 = el punto está DENTRO del cubo de semilado uCaja (0 = no hay caja)
          vec3 q = abs(position) - vec3(uCaja);
          float fuera = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
          vDentro = uCaja > 0.0 ? (1.0 - smoothstep(-0.15 * uCaja, 0.12 * uCaja, fuera)) : 0.0;
          vec4 cA=projectionMatrix*modelViewMatrix*vec4(aAnt,1.0);
          vec4 cC=projectionMatrix*modelViewMatrix*vec4(position,1.0);
          vec4 cS=projectionMatrix*modelViewMatrix*vec4(aSig,1.0);
          vec2 nA=cA.xy/cA.w, nC=cC.xy/cC.w, nS=cS.xy/cS.w;
          vec2 d1=(nC-nA)*uRes, d2=(nS-nC)*uRes;
          float l1=length(d1), l2=length(d2);
          vec2 t1 = l1>1e-6 ? d1/l1 : vec2(0.0);
          vec2 t2 = l2>1e-6 ? d2/l2 : vec2(0.0);
          vec2 tm = t1+t2;
          tm = length(tm)>1e-6 ? normalize(tm) : (l1>1e-6 ? t1 : (l2>1e-6 ? t2 : vec2(1.0,0.0)));
          vec2 nm = vec2(-tm.y, tm.x);
          vec2 n1 = l1>1e-6 ? vec2(-t1.y, t1.x) : nm;
          float cos2 = max(abs(dot(nm, n1)), 0.35);   // 1/cos(θ/2), acotado
          cC.xy += nm*(uW/uRes)*(aLado/cos2)*cC.w;
          gl_Position=cC; }`,
      // EL BRILLO ES |E|. Sin esto la línea se acaba de golpe donde se cortó y se lee
      // "despeinada" (Ian, 2026-07-28); con esto se apaga sola donde el campo ya no importa.
      // vE viene del .bin en escala LOG. uUsaE=0 → .bin viejo: perfil de siempre.
      fragmentShader: `uniform float uOp; uniform vec3 uCol; uniform float uT; uniform float uUsaE; uniform float uRampa; uniform float uFlujo;
        varying float vS; varying float vL; varying float vE; varying float vLado; varying float vDentro;
        void main(){ float s=clamp(vS,0.0,1.0);
          float perfil=pow(max(sin(3.14159*s),0.0),0.38);
          float campo=pow(clamp(vE,0.0,1.0),2.2);
          float base=0.44*mix(perfil,campo,uUsaE);
          float ph=fract(uT*0.06 + vL*0.13);
          float dd=s-ph; dd=dd-floor(dd+0.5);
          float glow=exp(-dd*dd*7.0);
          // COMETAS: VARIOS por línea, cabeza apretada y cola arrastrando por DETRÁS. Un
          // punto simétrico no dice hacia dónde va; una cola sí. Tres por línea para que el
          // sentido se lea aunque solo veas un tramo. Con uFlujo=0 queda el glow de siempre.
          float q      = fract(s*3.0 - uT*0.22 + vL*0.37);   // 0 = la cabeza
          float dq     = min(q, 1.0 - q);                     // distancia a la cabeza
          float cabeza = exp(-dq*dq*260.0);
          float cola   = pow(q, 5.0);                         // se enciende justo DETRÁS
          float pulso  = mix(glow, cabeza + 0.50*cola, clamp(uFlujo,0.0,1.0));
          float a=uOp*(base + (0.13 + 0.90*uFlujo)*pulso*mix(1.0,campo,uUsaE));
          // PERFIL A LO ANCHO EN DOS PARTES: núcleo apretado (el filamento nítido) +
          // halo ancho y tenue (la DIFUMINACIÓN que ocupa espacio y brilla).
          float l = abs(vLado);
          float nucleo = pow(max(0.0, 1.0 - l), 3.5);
          float halo   = pow(max(0.0, 1.0 - l*l), 1.6);
          a *= (nucleo + 0.68 * halo);
          // EL INTERIOR SE APAGA. No es truco: ahí el campo está 23-34x más débil (medido por
          // el solver). En proyección 2D no se distingue 'dentro' de 'delante/detrás', y sin
          // esto las líneas que pasan POR FUERA parecen atravesar la jaula — que es justo lo
          // contrario de lo que la pieza afirma.
          a *= (1.0 - 0.97 * vDentro);
          // EL COLOR ES LA DIRECCIÓN DEL CAMPO: en el precompute solo las cargas +
          // siembran líneas y se trazan hacia adelante, así que s=0 es SIEMPRE el
          // extremo + y s=1 el −. Oro donde nace, violeta donde muere.
          vec3 c = uCol;
          if (uRampa > 0.5) {
            vec3 nace  = vec3(2.35, 1.30, 0.40);
            vec3 muere = vec3(1.30, 0.42, 2.45);
            c = mix(nace, muere, smoothstep(0.12, 0.88, s));
          }
          gl_FragColor=vec4(c*a*2.0, a); }`,
      // DoubleSide OBLIGATORIO: el giro del triángulo depende de hacia dónde apunta la
      // línea EN PANTALLA; con FrontSide se descarta la mitad por culling.
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    return { geo, mat, pos, ant, sig, aE };
  }, [frames, NL, LP, inten]);
  const dib = useMemo(() => { const v = new THREE.Vector2(); gl.getDrawingBufferSize(v); return v; }, [gl, alto]);
  if (reveal < 0.01) return null;
  built.mat.uniforms.uOp.value = reveal;
  built.mat.uniforms.uT.value = time;
  built.mat.uniforms.uRes.value.set(dib.x || 2160, dib.y || 3840);
  built.mat.uniforms.uW.value = Math.max(1.0, ancho * ((dib.y || 3840) / 3840));
  built.mat.uniforms.uRampa.value = rampa;
  built.mat.uniforms.uCaja.value = caja ?? 0;
  built.mat.uniforms.uFlujo.value = flujo;
  // frame por R(t): el campo evoluciona CON los átomos (Rvals desc separado→junto)
  let k = 0;
  if (R >= Rvals[0]) k = 0; else if (R <= Rvals[K - 1]) k = K - 2;
  else { while (k < K - 2 && Rvals[k + 1] > R) k++; }
  const r0 = Rvals[k], r1 = Rvals[k + 1], f = r0 === r1 ? 0 : Math.max(0, Math.min(1, (r0 - R) / (r0 - r1)));
  const A = frames[k], B = frames[k + 1], pos = built.pos, ant = built.ant, sig = built.sig, stride = LP * 3;
  let o = 0;
  for (let j = 0; j < NL; j++) {
    const b0 = j * stride;
    for (let s = 0; s < LP; s++) {
      const i0 = b0 + s * 3;
      const x = A[i0] * (1 - f) + B[i0] * f, y = A[i0 + 1] * (1 - f) + B[i0 + 1] * f, z = A[i0 + 2] * (1 - f) + B[i0 + 2] * f;
      // vecinos: en las puntas se repite el propio punto → el shader lo detecta (d=0)
      const ia = b0 + Math.max(0, s - 1) * 3, is = b0 + Math.min(LP - 1, s + 1) * 3;
      const ax = A[ia] * (1 - f) + B[ia] * f, ay = A[ia + 1] * (1 - f) + B[ia + 1] * f, az = A[ia + 2] * (1 - f) + B[ia + 2] * f;
      const sx = A[is] * (1 - f) + B[is] * f, sy = A[is + 1] * (1 - f) + B[is + 1] * f, sz = A[is + 2] * (1 - f) + B[is + 2] * f;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;  pos[o + 3] = x; pos[o + 4] = y; pos[o + 5] = z;
      ant[o] = ax; ant[o + 1] = ay; ant[o + 2] = az;  ant[o + 3] = ax; ant[o + 4] = ay; ant[o + 5] = az;
      sig[o] = sx; sig[o + 1] = sy; sig[o + 2] = sz;  sig[o + 3] = sx; sig[o + 4] = sy; sig[o + 5] = sz;
      o += 6;
    }
  }
  built.geo.attributes.position.needsUpdate = true;
  built.geo.attributes.aAnt.needsUpdate = true;
  built.geo.attributes.aSig.needsUpdate = true;
  if (inten) {                                   // |E| por punto, interpolado por R(t)
    const EA = inten[k], EB = inten[k + 1], aE = built.aE, st2 = LP;
    let e = 0;
    for (let j = 0; j < NL; j++) {
      const b0 = j * st2;
      for (let s = 0; s < LP; s++) {
        const v = (EA[b0 + s] * (1 - f) + EB[b0 + s] * f) / 255;
        aE[e++] = v; aE[e++] = v;
      }
    }
    built.geo.attributes.aE.needsUpdate = true;
  }
  return <mesh geometry={built.geo} material={built.mat} frustumCulled={false} />;
}

// ── POZO DE ENERGÍA E(R) REAL del Li₂ (RHF/cc-pVTZ, electrón por electrón). El MÍNIMO
// es el POR QUÉ del enlace: los dos átomos caen al fondo y quedan atrapados (vibrando).
// HUD pinneado a la cámara (tercio inferior); la canica = la separación actual sobre la
// curva real. Aparece en el clímax "nace el enlace" y se apaga. renderAt(t) PURO.
const LI2_ER_R = [3.400, 3.774, 4.148, 4.522, 4.896, 5.270, 5.644, 6.019, 6.393, 6.767, 7.141, 7.515, 7.889, 8.263, 8.637, 9.011];
const LI2_ER_E = [-550.8, -1161.5, -1557.9, -1791.0, -1905.5, -1936.4, -1909.6, -1844.1, -1753.4, -1647.0, -1531.8, -1412.3, -1292.1, -1173.3, -1057.6, -946.1];
const LI2_ER_MIN = -1936.4, LI2_ER_RE = 5.270;   // fondo del pozo (bohr)
function li2EnergyAt(rBohr: number): number {
  const R = LI2_ER_R, E = LI2_ER_E;
  if (rBohr <= R[0]) return E[0];
  if (rBohr >= R[R.length - 1]) return E[E.length - 1];
  let i = 0; while (i < R.length - 1 && R[i + 1] < rBohr) i++;
  const f = (rBohr - R[i]) / (R[i + 1] - R[i]);
  return E[i] * (1 - f) + E[i + 1] * f;
}
function EnergyWell({ sepBohr, reveal }: { sepBohr: number; reveal: number }) {
  const { camera } = useThree();
  const grp = useRef<THREE.Group>(null);
  const ballRef = useRef<THREE.Mesh>(null);
  const curveMatRef = useRef<THREE.PointsMaterial>(null);
  const baseMatRef = useRef<THREE.PointsMaterial>(null);
  const ballMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const HW = 0.30, HH = 0.14;                       // media anchura/altura del HUD (cabe en el tercio inferior a z=-2.1, fov~33)
  const Rmin = 3.4, Rmax = 9.0;
  const xOf = (r: number) => -HW + ((r - Rmin) / (Rmax - Rmin)) * (2 * HW);
  const yOf = (e: number) => -HH + ((e - LI2_ER_MIN) / (0 - LI2_ER_MIN)) * (2 * HH);   // mínimo abajo, disociación arriba
  // curva (muestreo fino) + línea base E=0 (nivel "separados")
  const { curveGeo, baseGeo } = useMemo(() => {
    const NP = 320; const cp = new Float32Array(NP * 3);
    for (let i = 0; i < NP; i++) {
      const r = Rmin + (Rmax - Rmin) * (i / (NP - 1));
      cp[i * 3] = xOf(r); cp[i * 3 + 1] = yOf(li2EnergyAt(r)); cp[i * 3 + 2] = 0;
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
    const NB = 60; const bp = new Float32Array(NB * 3);
    for (let i = 0; i < NB; i++) { bp[i * 3] = -HW + (2 * HW) * (i / (NB - 1)); bp[i * 3 + 1] = yOf(0); bp[i * 3 + 2] = 0; }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    return { curveGeo: cg, baseGeo: bg };
  }, []);
  const st = useRef({ sep: 6, rev: 0 });
  st.current.sep = sepBohr; st.current.rev = reveal;
  useFrame(() => {
    const g = grp.current; const rev = st.current.rev;
    if (!g) return;
    if (rev <= 0.002) { g.visible = false; return; }
    g.visible = true;
    // pin al tercio inferior, frente a la cámara
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);
    g.translateY(-0.30); g.translateZ(-2.1);
    // canica en la separación actual (alineada al fondo del pozo real)
    const bR = Math.max(Rmin, Math.min(Rmax, st.current.sep * (LI2_ER_RE / (BOND_ABINITIO.li2.Re))));
    if (ballRef.current) ballRef.current.position.set(xOf(bR), yOf(li2EnergyAt(bR)) + 0.006, 0.01);
    if (curveMatRef.current) curveMatRef.current.opacity = rev * 0.95;
    if (baseMatRef.current) baseMatRef.current.opacity = rev * 0.22;
    if (ballMatRef.current) ballMatRef.current.opacity = rev;
  });
  return (
    <group ref={grp} visible={false}>
      <points geometry={baseGeo}>
        <pointsMaterial ref={baseMatRef} size={3.0} sizeAttenuation={false} color={new THREE.Color(0.5, 0.62, 0.8)}
          transparent opacity={0} depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points geometry={curveGeo}>
        <pointsMaterial ref={curveMatRef} size={6.5} sizeAttenuation={false} color={new THREE.Color(0.55, 0.95, 1.4)}
          transparent opacity={0} depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <mesh ref={ballRef}>
        <sphereGeometry args={[0.026, 24, 24]} />
        <meshBasicMaterial ref={ballMatRef} color={new THREE.Color(4.0, 2.6, 0.9)} transparent opacity={0}
          depthTest={false} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ── LAS DOS FUERZAS — POR QUÉ se pega el enlace (Hellmann-Feynman, REAL) ──
// En cada núcleo de Li conviven DOS fuerzas: el EMPUJE (repulsión nuclear Z²/R²,
// rojo, hacia AFUERA) y el JALÓN de la nube de electrones acumulada en el centro
// (cian, hacia el CENTRO). Magnitudes ∝ fuerzas reales de la curva E(R) de PySCF:
//   fRep = 9/R²   (Z=3)              ·  fPull = fRep + dE/dR
// Mientras se acercan (R>Re) dE/dR>0 → el JALÓN es mayor → CAEN juntos; en el
// fondo del pozo (R=Re) dE/dR=0 → se IGUALAN: el enlace ES ese balance. El margen
// (el "net" que decide) se amplifica ×G para que se LEA a ojo; dirección y signo
// son exactos (lo evocativo, etiquetado: es el margen, no la dirección).
function ForceDuel({ R, nx, op }: { R: number; nx: number; op: number }) {
  const pushCol = useMemo(() => new THREE.Color().setRGB(3.6, 0.40, 0.12), []);   // ROJO puro: empuje (repulsión) — distinto del oro del core
  const pullCol = useMemo(() => new THREE.Color().setRGB(0.42, 2.1, 3.6), []);    // CIAN puro: jalón de los electrones
  if (op < 0.01) return null;
  const dRd = 0.14;
  const dEdR = (li2EnergyAt(R + dRd) - li2EnergyAt(R - dRd)) / (2 * dRd);          // meV/bohr
  const netIn = Math.max(0, dEdR / 27211.4);                                       // au: jalón NETO hacia adentro (>0 si R>Re)
  const fRep = 9 / (R * R);                                                         // au: repulsión hacia afuera
  const S = 5.0, G = 3.0;
  const lenPush = Math.min(2.1, Math.max(0.85, S * fRep));
  const lenPull = Math.min(2.4, Math.max(0.85, S * fRep + S * G * netIn));
  const GAP = 0.5;              // arranca FUERA del brillo del core (no se entierra)
  const PY = 0.75;              // pequeño offset perpendicular (se lee al lado de la columna densa)
  const arrows: { pos: Vec3; rotZ: number; len: number; col: THREE.Color; thick: number }[] = [];
  for (const side of [1, -1]) {
    const outRotZ = side > 0 ? -Math.PI / 2 : Math.PI / 2;   // hacia AFUERA (lejos del centro)
    const inRotZ = side > 0 ? Math.PI / 2 : -Math.PI / 2;    // hacia el CENTRO
    arrows.push({ pos: [side * nx, PY, 0], rotZ: outRotZ, len: lenPush, col: pushCol, thick: 0.80 });  // EMPUJE
    arrows.push({ pos: [side * nx, PY, 0], rotZ: inRotZ, len: lenPull, col: pullCol, thick: 1.10 });   // JALÓN (más grueso: gana)
  }
  return (
    <group>
      {arrows.map((a, i) => (
        <group key={i} position={a.pos} rotation={[0, 0, a.rotZ]}>
          <mesh position={[0, GAP + a.len * 0.36, 0]}>
            <cylinderGeometry args={[0.045 * a.thick, 0.060 * a.thick, a.len * 0.72, 12]} />
            <meshBasicMaterial color={a.col} transparent opacity={op} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[0, GAP + a.len * 0.855, 0]}>
            <coneGeometry args={[0.17 * a.thick, a.len * 0.32, 14]} />
            <meshBasicMaterial color={a.col} transparent opacity={op} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function MoleculeTitle({ mkey, time, vertical }: { mkey: string; time: number; vertical: boolean }) {
  // RÓTULO POR MANIFIESTO (2026-08-25, EL SUDOR): `?titulo=` y `?formula=` sobreescriben el
  // nombre de BASE_META para una pieza que reusa la escena de otra (mismo bin, otra historia).
  // Sin query = idéntico a siempre (el rey no cambia ni un pixel).
  const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const base = META[mkey] ?? META.h2o;
  const m = { ...base, name: qs?.get('titulo') || base.name, formula: qs?.get('formula') || base.formula };
  const opacity = Math.min(1, Math.max(0, (time - 2.4) / 0.9)) * Math.min(1, Math.max(0, (21.3 - time) / 0.7));
  if (opacity < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', bottom: vertical ? '14%' : '16%', left: '7%',
      zIndex: 11, pointerEvents: 'none', opacity, fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontSize: vertical ? '11vw' : '3.1vw', fontWeight: 200, color: '#fff',
        letterSpacing: '-0.03em', lineHeight: 1, textShadow: '0 4px 40px rgba(0,0,0,0.85)' }}>{m.name}</div>
      <div style={{ fontSize: vertical ? '5vw' : '1.3vw', fontWeight: 500, color: 'rgba(127,212,255,0.9)',
        letterSpacing: '0.08em', marginTop: vertical ? '1.6vw' : 12,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{m.formula}</div>
    </div>
  );
}

// ── Placard "qué ves · la medida · qué significa" — elegante y entendible. Aparece
// en el VIAJE (cuando la nube es el foco); el campo toma el relevo en el revelado.
// Las medidas son REALES (NIST): longitudes y ángulos de enlace medidos. ──
interface ScaleInfo { what: string; measure: string; meaning: string; }
const BASE_SCALE: Record<string, ScaleInfo> = {
  // cadenas — alcanos (σ): todos comparten la misma medida de enlace
  ...Object.fromEntries(['butane', 'pentane', 'hexane', 'heptane', 'octane', 'nonane', 'decane', 'dodecane', 'pentadecane', 'hexadecane', 'heptadecane', 'eicosane'].map(k => [k,
    { what: 'Lo que ves: la nube de electrones', measure: 'enlace C–C · 1.54 Å', meaning: '1 Å = 0.1 nm, el tamaño de un átomo' }])),
  // cadenas — conjugadas (σ + π)
  ...Object.fromEntries(['hexatriene', 'octatetraene', 'decapentaene', 'dodecahexaene', 'tetradecaheptaene', 'hexadecaoctaene'].map(k => [k,
    { what: 'Lo que ves: la nube de electrones σ y π', measure: 'C=C 1.34 Å · C–C 1.45 Å', meaning: 'doble y simple alternados = "conjugado"' }])),
  caroteno: { what: 'Lo que ves: la nube π conjugada', measure: 'cadena π ≈ 2.4 nm', meaning: 'absorbe la luz azul → la ves naranja' },
  // ── ADN — medidas B-form reales (Arnott-Hukins 1972) ──
  ...Object.fromEntries(['brca1', 'telomero', 'tata'].map(k => [k,
    { what: 'Lo que ves: la doble hélice de tu ADN', measure: '3.4 Å por escalón · 10.5 bases/vuelta', meaning: 'dos metros de esto enrollados en CADA célula tuya' }])),
  // moléculas
  co2: { what: 'Lo que ves: la nube de electrones', measure: 'C=O · 1.16 Å · 180°', meaning: '1 Å = la diezmilmillonésima de un metro' },
  ch4: { what: 'Lo que ves: la nube de electrones', measure: 'C–H · 1.09 Å · 109.5°', meaning: 'cuatro enlaces: un tetraedro' },
  nh3: { what: 'Lo que ves: la nube de electrones', measure: 'N–H · 1.01 Å · 107°', meaning: 'el par libre la vuelve pirámide' },
  h2: { what: 'Lo que ves: la nube de electrones', measure: 'H–H · 0.74 Å', meaning: 'el primer enlace del universo' },
  f2: { what: 'Lo que ves: la nube de electrones', measure: 'F–F · 1.41 Å', meaning: 'el enlace más débil — por eso arde con todo' },
  c2: { what: 'Lo que ves: la nube de electrones', measure: 'C=C · 1.24 Å', meaning: 'doble enlace de puro π — sin enlace frontal' },
  n2: { what: 'Lo que ves: la nube de electrones', measure: 'N≡N · 1.10 Å', meaning: 'triple enlace: el candado del aire' },
  o2: { what: 'Lo que ves: la nube de electrones', measure: 'O=O · 1.21 Å', meaning: 'doble enlace — y es magnético' },
  co: { what: 'Lo que ves: la nube de electrones', measure: 'C≡O · 1.13 Å', meaning: 'el enlace más fuerte de la naturaleza' },
  no: { what: 'Lo que ves: la nube de electrones', measure: 'N=O · 1.15 Å', meaning: 'orden 2.5: medio enlace deshecho' },
  hcl: { what: 'Lo que ves: la nube de electrones', measure: 'H–Cl · 1.27 Å', meaning: 'el ácido de tu estómago' },
  hf: { what: 'Lo que ves: la nube de electrones', measure: 'H–F · 0.92 Å', meaning: 'el enlace más polar que hay' },
  nacl: { what: 'Lo que ves: la nube de electrones', measure: 'Na···Cl · 2.36 Å', meaning: 'un átomo le robó el electrón al otro' },
};
const SCALE: Record<string, ScaleInfo> = { ...BASE_SCALE, ...CATALOG_SCALE };

function ScaleNote({ molKey, time, vertical }: { molKey: string; time: number; vertical: boolean }) {
  const s = SCALE[molKey];
  if (!s) return null;
  const opacity = smoothstep((time - 4.5) / 0.9) * (1 - smoothstep((time - 10.5) / 0.9));
  if (opacity < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', top: vertical ? '10.5%' : '9%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontWeight: 300, color: 'rgba(255,255,255,0.94)',
        fontSize: vertical ? '4.4vw' : '1.6vw', lineHeight: 1.25,
        textShadow: '0 2px 30px rgba(0,0,0,0.92)' }}>{s.what}</div>
      <div style={{ fontWeight: 600, color: 'rgba(127,212,255,0.96)', marginTop: vertical ? '1.7vw' : 8,
        fontSize: vertical ? '4.6vw' : '1.55vw', letterSpacing: '0.03em',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        textShadow: '0 2px 22px rgba(0,0,0,0.92)' }}>{s.measure}</div>
      <div style={{ fontWeight: 400, color: 'rgba(222,227,238,0.74)', marginTop: vertical ? '1.0vw' : 5,
        fontSize: vertical ? '3.1vw' : '1.05vw', lineHeight: 1.2,
        textShadow: '0 2px 20px rgba(0,0,0,0.92)' }}>{s.meaning}</div>
    </div>
  );
}

// Explica el SONIDO (solo ADN): la secuencia real convertida en música. Aparece
// tras el placard, para que el espectador sepa qué está oyendo.
function AudioNote({ time, vertical }: { time: number; vertical: boolean }) {
  const opacity = smoothstep((time - 12.5) / 0.9) * (1 - smoothstep((time - 19.0) / 0.9));
  if (opacity < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', top: vertical ? '10.5%' : '9%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontWeight: 300, color: 'rgba(255,255,255,0.94)',
        fontSize: vertical ? '4.4vw' : '1.6vw', lineHeight: 1.25,
        textShadow: '0 2px 30px rgba(0,0,0,0.92)' }}>♪ Lo que oyes: tu ADN hecho música</div>
      <div style={{ fontWeight: 600, color: 'rgba(127,212,255,0.96)', marginTop: vertical ? '1.7vw' : 8,
        fontSize: vertical ? '4.2vw' : '1.45vw', letterSpacing: '0.03em',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        textShadow: '0 2px 22px rgba(0,0,0,0.92)' }}>cada letra · A · T · G · C · es una nota</div>
      <div style={{ fontWeight: 400, color: 'rgba(222,227,238,0.74)', marginTop: vertical ? '1.0vw' : 5,
        fontSize: vertical ? '3.1vw' : '1.05vw', lineHeight: 1.2,
        textShadow: '0 2px 20px rgba(0,0,0,0.92)' }}>la melodía ES tu secuencia real, leída 5′→3′</div>
    </div>
  );
}

// Etiqueta del modo vibracional activo — "se entiende qué vibra con qué".
function ModeLabel({ modes, time, vertical }: { modes: VibMode[] | null; time: number; vertical: boolean }) {
  if (!modes) return null;
  if (time > 12.5 && time < 18.3) return null;     // cede el lugar a la etiqueta del campo
  const amps = modeAmps(time);
  let active = -1, best = 0.12;
  for (let i = 0; i < amps.length; i++) if (amps[i] > best) { best = amps[i]; active = i; }
  const allMode = time >= 17.5;
  let label = '', sub = '';
  if (allMode) { label = 'Los tres modos a la vez'; sub = 'así vibra el agua real'; }
  else if (active >= 0) { label = modes[active].label; sub = `${modes[active].wavenumber} cm⁻¹`; }
  else return null;
  const opacity = allMode ? smoothstep((time - 17.6) / 0.6) : smoothstep(best / 0.3);
  if (opacity < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', top: vertical ? '11%' : '10%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontWeight: 300, color: 'rgba(255,255,255,0.95)',
        fontSize: vertical ? '5.4vw' : '2vw', lineHeight: 1.2,
        textShadow: '0 2px 30px rgba(0,0,0,0.9)' }}>{label}</div>
      <div style={{ fontWeight: 500, color: 'rgba(127,212,255,0.9)', marginTop: '1vw',
        fontSize: vertical ? '3.6vw' : '1.3vw', letterSpacing: '0.06em',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>{sub}</div>
    </div>
  );
}

// Etiqueta del CAMPO ELECTROSTÁTICO — solo en moléculas POLARES (las que tienen
// campo). Sub-texto por molécula (NO el del agua en todas).
const BASE_FIELD_SUB: Record<string, string> = {
  h2o: 'por esto el agua disuelve todo',
  hcl: 'el cloro jala los electrones',
  hf: 'el enlace más polar que hay',
  nacl: 'casi un ion: un lado + y otro −',
  co: 'un dipolo sutil e invertido',
  nh3: 'el par libre la vuelve polar',
  co2: 'cada enlace es polar (pero se cancelan)',
  // conjugadas: el campo son las CARAS π (electrón-ricas)
  hexatriene: 'las caras π son ricas en electrones',
  decapentaene: 'por las caras π reacciona y se apila',
  caroteno: 'estas caras π atrapan la luz: por eso ves',
  // alcanos: nube σ suave y uniforme (sin caras) → inertes
  butane: 'la nube σ, suave y sin caras: por eso es inerte',
  hexane: 'puro enlace σ, sin zonas reactivas',
  octane: 'la nube σ envuelve la cadena, fría y pareja',
  decane: 'σ uniforme — el alcano casi no reacciona',
  pentane: 'la nube σ, suave y pareja: inerte',
  heptane: 'puro enlace σ, sin zonas reactivas',
  nonane: 'la nube σ envuelve la cadena, fría',
  dodecane: 'σ uniforme — cadena larga, sigue inerte',
  hexadecane: 'σ pareja de punta a punta',
  octatetraene: 'las caras π, más largas, más ricas',
  dodecahexaene: 'el río π ya casi tiene color propio',
  pentadecane: 'σ pareja, cadena larga: inerte',
  heptadecane: 'la nube σ envuelve toda la cadena',
  eicosane: 'σ uniforme de punta a punta: cera inerte',
  tetradecaheptaene: 'caras π largas: el río ya casi es rojo',
  hexadecaoctaene: 'el río π más largo, absorbe color',
};
const FIELD_SUB: Record<string, string> = { ...BASE_FIELD_SUB, ...CATALOG_FIELD_SUB };

function FieldLabel({ molKey, polar, time, vertical }: { molKey: string; polar: boolean; time: number; vertical: boolean }) {
  if (!polar || molKey === 'nacl' || molKey === 'hf' || molKey === 'co' || molKey === 'no' || molKey === 'hcl' || molKey === 'h2o') return null;   // nacl/hf/co/no/hcl/h2o: los beats propios son dueños de esa ventana
  const opacity = smoothstep((time - 12.5) / 0.8) * Math.min(1, Math.max(0, (18.5 - time) / 0.7));
  if (opacity < 0.01) return null;
  const sub = FIELD_SUB[molKey] ?? 'esta molécula es polar';
  const title = (CONJUGATED_KEYS.has(molKey) || CATALOG_FIELD[molKey] === 'pi') ? 'El campo de la nube π'
    : (CHAIN_KEYS.has(molKey) || CATALOG_FIELD[molKey] === 'sigma') ? 'El campo σ'
      : 'El campo electrostático';
  return (
    <div style={{
      position: 'absolute', top: vertical ? '11%' : '10%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ fontWeight: 300, color: 'rgba(255,255,255,0.96)',
        fontSize: vertical ? '5.4vw' : '2vw', lineHeight: 1.2,
        textShadow: '0 2px 30px rgba(0,0,0,0.9)' }}>{title}</div>
      <div style={{ fontWeight: 500, color: 'rgba(190,205,255,0.92)', marginTop: '1vw',
        fontSize: vertical ? '3.6vw' : '1.3vw', letterSpacing: '0.04em',
        textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>{sub}</div>
    </div>
  );
}

// Posiciones de núcleos animadas por los modos vibracionales activos.
function animatedNuclei(base: Vec3[], modes: VibMode[] | null, t: number): Vec3[] {
  if (!modes) return base;
  const amps = modeAmps(t);
  return base.map((p, i) => {
    let x = p[0], y = p[1], z = p[2];
    for (let m = 0; m < modes.length; m++) {
      const a = amps[m];
      if (a < 0.001) continue;
      const osc = Math.sin(2 * Math.PI * VIS_FREQ * t + m * 2.094);
      const d = modes[m].disp[i];
      x += VIS_AMP * a * osc * d[0];
      y += VIS_AMP * a * osc * d[1];
      z += VIS_AMP * a * osc * d[2];
    }
    return [x, y, z];
  });
}

// ── CAMPO ELÉCTRICO CONTINUO — el campo NO son líneas, es un CONTINUO que llena
// el espacio: en cada punto hay un valor (el potencial V), y eso se PINTA con
// color. Azul = potencial + (lado de los hidrógenos δ+), rojo = − (pares libres
// del O δ−), brillo = intensidad. Fluye a lo largo del campo E (de + a −). Por
// esto el agua disuelve todo. Honesto: solo aparece en moléculas POLARES — en
// H₂/N₂/O₂ las cargas son iguales (electronegatividad igual) → no hay campo.
function partialCharges(nuclei: Nuc[]): number[] {
  const en = nuclei.map(n => elementByZ(n.protons)?.electronegativity ?? 2.2);
  const k = 0.42, q = nuclei.map(() => 0);
  for (let i = 1; i < nuclei.length; i++) {       // ligandos enlazados al átomo central
    q[i] += k * (en[0] - en[i]);                  // el más electronegativo jala → −
    q[0] += k * (en[i] - en[0]);
  }
  return q;
}

// El campo se renderiza como PLASMA volumétrico (raymarch): un medio continuo,
// fluido, que fluye — no partículas. Como la corona del sol o una aurora.
const PLASMA_VERT = /* glsl */ `
varying vec3 vWorld;
void main(){
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const PLASMA_FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uOpacity, uRf;
uniform int uN;
uniform vec3 uPos[8];
uniform float uQ[8];
varying vec3 vWorld;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.02 + 1.7; a *= 0.5; } return s; }
void main(){
  vec3 ro = cameraPosition, rd = normalize(vWorld - cameraPosition);
  // ray-esfera (centro origen, radio uRf): el volumen del campo
  float b = dot(ro, rd), c = dot(ro, ro) - uRf * uRf, h = b * b - c;
  if (h < 0.0) discard; h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h;
  if (t1 <= t0) discard;
  float dt = (t1 - t0) / 26.0;
  // JITTER por pixel: rompe el banding del raymarch (los anillos/"líneas") en ruido
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 26; i++){
    float t = t0 + (float(i) + jit) * dt;
    vec3 p = ro + rd * t;
    float V = 0.0, near = 1e9;
    for (int k = 0; k < 8; k++){ if (k >= uN) break; float d = length(p - uPos[k]); near = min(near, d); V += uQ[k] / (d + 0.35); }
    float mag = clamp(abs(V) * 2.3, 0.0, 1.0);
    // HUECO: el plasma se abre donde vive la molécula (cerca de los núcleos) para
    // que la nube/enlaces se vean DENTRO de su campo.
    float shell = smoothstep(0.6, 1.6, near);
    float dens = mag * shell;
    if (dens < 0.025) continue;
    // PLASMA: turbulencia fbm que fluye con el tiempo, modulada por el campo
    float n = fbm(p * 1.5 + vec3(0.0, uTime * 0.22, 0.0) + V * 1.2);
    n = smoothstep(0.42, 0.98, n);
    vec3 col = V > 0.0 ? vec3(0.30, 0.62, 1.0) : vec3(1.0, 0.30, 0.42);  // azul + / rojo −
    acc += col * (n * dens) * dt * 2.7;
  }
  gl_FragColor = vec4(acc * uOpacity, 1.0);
}`;

function PlasmaField({ nuclei, time }: { nuclei: Nuc[]; time: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { Rf, uPos, uQ, n, ok } = useMemo(() => {
    const fail = { Rf: 1, uPos: [] as THREE.Vector3[], uQ: [] as number[], n: 0, ok: false };
    if (nuclei.length < 2) return fail;
    const q = partialCharges(nuclei);
    if (!q.some(v => Math.abs(v) > 0.05)) return fail;     // apolar → sin campo
    let core = 0; nuclei.forEach(nu => { core = Math.max(core, Math.hypot(nu.pos[0], nu.pos[1], nu.pos[2])); });
    const Rf = Math.max(2.5, (core || 1) * 3.6);
    const N = Math.min(8, nuclei.length);
    const uPos: THREE.Vector3[] = [], uQ: number[] = [];
    for (let i = 0; i < 8; i++) {
      if (i < N) { uPos.push(new THREE.Vector3(nuclei[i].pos[0], nuclei[i].pos[1], nuclei[i].pos[2])); uQ.push(q[i]); }
      else { uPos.push(new THREE.Vector3()); uQ.push(0); }
    }
    return { Rf, uPos, uQ, n: N, ok: true };
  }, [nuclei]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uOpacity: { value: 0 }, uRf: { value: Rf }, uN: { value: n },
    uPos: { value: uPos }, uQ: { value: uQ },
  }), [Rf, n, uPos, uQ]);
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = time;
    matRef.current.uniforms.uOpacity.value = smoothstep((time - 11.5) / 2.5) * 0.92;
  }, [time]);

  if (!ok) return null;
  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[Rf, 24, 24]} />
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={PLASMA_VERT} fragmentShader={PLASMA_FRAG}
        transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ── CAMPO DE CARAS π (cadenas CONJUGADAS) ─ El potencial electrostático molecular
// (MEP) real: la nube π vive ARRIBA y ABAJO del plano → esas caras son ricas en
// electrones = potencial NEGATIVO (violeta/rojo), la periferia (H) levemente +
// (azul). No es un dipolo inventado: es la razón física de que reaccionen, se
// apilen y absorban luz. Analítico (no point-charges) → barato y sin tope de 8.
const CHAINFIELD_FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uOpacity, uRf, uL, uRp, uOff, uAlkane;
uniform vec3 uC, uAxis, uN;
varying vec3 vWorld;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.02 + 1.7; a *= 0.5; } return s; }
void main(){
  vec3 ro = cameraPosition, rd = normalize(vWorld - cameraPosition);
  vec3 oc = ro - uC; float b = dot(oc, rd), c = dot(oc, oc) - uRf * uRf, h = b * b - c;
  if (h < 0.0) discard; h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = -b + h; if (t1 <= t0) discard;
  float dt = (t1 - t0) / 26.0;
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 26; i++){
    float t = t0 + (float(i) + jit) * dt; vec3 p = ro + rd * t;
    vec3 rel = p - uC;
    float s = dot(rel, uAxis), dN = dot(rel, uN);
    vec3 ip = rel - uAxis * s - uN * dN; float w = length(ip);
    float along = smoothstep(uL * 1.15, uL * 0.82, abs(s));              // solo dentro de la cadena
    float rperp = sqrt(w * w + dN * dN);
    float V; vec3 col;
    if (uAlkane > 0.5) {
      // ALCANO: nube σ — tubo suave alrededor del eje (sin caras ni dipolo). Cuerpo
      // δ− (electrones del enlace), H en la periferia δ+. Frío y uniforme = inerte.
      float tube = exp(-(rperp * rperp) / (uRp * uRp * 0.9)) * along;
      float edge = smoothstep(uRp * 0.85, uRp * 1.5, rperp) * exp(-pow(rperp - uRp * 1.25, 2.0) / (uRp * uRp * 0.5)) * along;
      V = -tube + 0.55 * edge;
      col = V < 0.0 ? vec3(0.28, 0.85, 0.95) : vec3(1.0, 0.66, 0.32);    // teal frío σ / ámbar tenue (H δ+)
    } else {
      // CONJUGADA: caras π (electrón-ricas) arriba/abajo del plano molecular
      float face = exp(-pow(abs(dN) - uOff, 2.0) / 0.30) * exp(-(w * w) / (uRp * uRp * 0.7));
      float edge = exp(-(dN * dN) / 0.26) * smoothstep(uRp * 0.8, uRp * 1.4, w);
      V = (-face + 0.4 * edge) * along;
      col = V < 0.0 ? vec3(0.92, 0.34, 0.86) : vec3(0.32, 0.6, 1.0);     // caras π magenta / periferia azul
    }
    float mag = clamp(abs(V) * 1.5, 0.0, 1.0);
    if (mag < 0.03) continue;
    float n = fbm(p * 1.6 + vec3(0.0, uTime * 0.22, 0.0) + V * 1.3);
    n = smoothstep(0.45, 0.98, n);
    acc += col * (n * mag) * dt * 1.35;
  }
  gl_FragColor = vec4(acc * uOpacity, 1.0);
}`;

function ChainField({ frame, time, alkane }: { frame: Frame; time: number; alkane: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const off = 1.25;                                            // bohr: donde pica la densidad π fuera del plano
  const Rf = Math.max(frame.L * 1.2, frame.Rp * 1.7, off + 3.0);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uOpacity: { value: 0 }, uRf: { value: Rf }, uL: { value: frame.L },
    uRp: { value: Math.max(frame.Rp, 1.2) }, uOff: { value: off }, uAlkane: { value: alkane ? 1 : 0 },
    uC: { value: new THREE.Vector3(...frame.c) }, uAxis: { value: new THREE.Vector3(...frame.a) },
    uN: { value: new THREE.Vector3(...frame.planeN) },
  }), [frame, Rf, alkane]);
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = time;
    // entra al REVELAR, cuando la cámara YA se alejó (no en el túnel cerrado) — sutil.
    // El campo σ del alcano es DÉBIL (más tenue); el de caras π es más presente.
    matRef.current.uniforms.uOpacity.value = smoothstep((time - 13.0) / 3.0) * (alkane ? 0.26 : 0.33);
  }, [time, alkane]);
  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[Rf, 24, 24]} />
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={PLASMA_VERT} fragmentShader={CHAINFIELD_FRAG}
        transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function CinematicMoleculeInner({ molKey, live = false }: { molKey: string; live?: boolean }) {
  const [data, setData] = useState<MolData | null>(null);
  const [o2ai, setO2ai] = useState<O2AbInitio | null>(null);   // Δρ ab initio del enlace (O₂)
  const [atomCloud, setAtomCloud] = useState<Int16Array | null>(null);   // nube del átomo AISLADO (individuos)
  const [piSplit, setPiSplit] = useState<Uint8Array | null>(null);       // ¿a cuál π pertenece cada partícula? (triple enlace)
  const [bondEf, setBondEf] = useState<BondEFieldData | null>(null);  // campo E REAL por separación (Li₂/Be₂: el átomo COMPLETO evolucionando, no un punto)
  const [bondAttr, setBondAttr] = useState<BondEFieldData | null>(null);  // campo de ATRACCIÓN (el par − del centro jalando a los núcleos +) — lo que faltaba
  const [caroLUT, setCaroLUT] = useState<{ rgb: Vec3 }[] | null>(null);
  const [grasa, setGrasa] = useState<WAPData | null>(null);
  const [grasaEf, setGrasaEf] = useState<BondEFieldData | null>(null);   // color observado REAL por longitud (PySCF/FEMO)
  const [time, setTime] = useState(0);
  const modes = useMemo(() => (molKey === 'h2o' ? computeWaterModes() : null), [molKey]);
  const [vertical, setVertical] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth);
  const tv = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const v = parseFloat(new URLSearchParams(window.location.search).get('tv') || '0');
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  }, []);

  useEffect(() => {
    const onResize = () => setVertical(window.innerHeight > window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMD = molKey === 'wmd';   // agua = DINÁMICA MOLECULAR REAL (10 moléculas se auto-ensamblan)
  const isCargas = molKey === 'cargas';
  const isFaraday = molKey === 'faraday';   // LA JAULA: conductor + carga externa, no una molécula
  const isPair = molKey in WATER_BINS;   // LA FAMILIA DEL AGUA, mismo motor: dímero, anillo de 3, de 4… (ver WATER_BINS)
  const isWater = molKey === 'wdimer' || molKey === 'wsingle' || molKey === 'whex' || isMD || isPair || isCargas;   // agua que INTERACTÚA (cluster + campo)
  const [waterReady, setWaterReady] = useState(false);
  const isGrasa = GRASA_KEYS.has(molKey);
  const isChain = CHAIN_KEYS.has(molKey);
  const isCatalog = CATALOG_KEYS.has(molKey);
  const isDNA = DNA_KEYS.has(molKey);
  const catField = isCatalog ? CATALOG_FIELD[molKey] : null;   // 'pi' | 'sigma' | 'none'

  // Cargar la nube precomputada (cadenas → chain-…, catálogo → catalog-…, resto → mol-…)
  useEffect(() => {
    let alive = true;
    if (live) setData(null);   // al cambiar de molécula en el lab, no dejar la anterior visible
    if (isWater) return () => { alive = false; };   // el agua-cluster carga su propio bin (WaterField)
    if (isFaraday) return () => { alive = false; };  // la jaula carga SU bin (FaradayJaula); no hay mol-faraday.bin
    if (GRASA_KEYS.has(molKey)) {
      setGrasa(null); setGrasaEf(null);
      fetch(`/precomputed/grasa-${molKey}.bin`).then(r => (r.ok ? r.arrayBuffer() : null))
        .then(b => { if (alive && b) setGrasa(parseWAP2(b)); }).catch(e => console.error('grasa', e));
      fetch(`/precomputed/grasa-${molKey}-efield.bin`).then(r => (r.ok ? r.arrayBuffer() : null))
        .then(b => { if (alive && b) setGrasaEf(parseBondEField(b)); }).catch(() => {});
    }
    // OJO: el fetch de la grasa va ARRIBA de este return, o no corre nunca.
    if (isGrasa) return;   // la grasa no tiene mol-*.bin: sus núcleos vienen en el WAP2
    const prefix = isDNA ? 'dna' : isCatalog ? 'catalog' : isChain ? 'chain' : 'mol';
    fetch(`/precomputed/${prefix}-${molKey}.bin`)
      .then(r => r.arrayBuffer())
      .then(buf => { if (alive) setData(parseBin(buf)); })
      .catch(e => console.error('mol load failed', e));
    // CAROTENO: LUT del color OBSERVADO real por longitud de conjugación (calculado:
    // FEMO calibrado a λmax medida + verificado con PySCF). El "color nace del largo".
    if (molKey === 'caroteno') {
      setCaroLUT(null);
      fetch('/precomputed/caroteno-color.json')
        .then(r => (r.ok ? r.json() : null))
        .then(j => { if (alive && j) setCaroLUT(j); })
        .catch(() => { /* opcional */ });
    }
    // Enlaces AB INITIO (o2/n2/f2/h2): además la Δρ REAL de la formación (calculada)
    if (isBond(molKey)) {
      if (live) setO2ai(null);
      fetch(`/precomputed/${molKey}-abinitio.bin`)
        .then(r => r.arrayBuffer())
        .then(buf => { if (alive) setO2ai(parseO2AbInitio(buf)); })
        .catch(e => console.error('bond abinitio load failed', e));
      // nube del átomo AISLADO (acto 1: individuos que se entrelazan). Opcional (404 ok).
      setAtomCloud(null);
      fetch(`/precomputed/${molKey}-atomcloud.bin`)
        .then(r => (r.ok ? r.arrayBuffer() : null))
        .then(buf => { if (alive && buf) setAtomCloud(new Int16Array(buf.slice(4, 4 + new DataView(buf).getInt32(0, true) * 6))); })
        .catch(() => { /* opcional */ });
      // split π¹/π² (triple enlace — 3 colores para 3 enlaces). Opcional (404 ok).
      setPiSplit(null);
      fetch(`/precomputed/${molKey}-pisplit.bin`)
        .then(r => (r.ok ? r.arrayBuffer() : null))
        .then(buf => { if (alive && buf) setPiSplit(new Uint8Array(buf.slice(4, 4 + new DataView(buf).getInt32(0, true)))); })
        .catch(() => { /* opcional */ });
      // CAMPO ELÉCTRICO real (líneas de fuerza, precompute-bond-efield.py) — representa
      // TODO el átomo (núcleo + apantallamiento de las capas), no un punto. Opcional (404 ok).
      setBondEf(null);
      fetch(`/precomputed/${molKey}-efield.bin`)
        .then(r => (r.ok ? r.arrayBuffer() : null))
        .then(buf => { if (alive && buf) setBondEf(parseBondEField(buf)); })
        .catch(() => { /* opcional */ });
      // campo de ATRACCIÓN (electrones − del enlace convergiendo al centro = jalan a los +). Opcional (404 ok).
      setBondAttr(null);
      fetch(`/precomputed/${molKey}-attraction.bin`)
        .then(r => (r.ok ? r.arrayBuffer() : null))
        .then(buf => { if (alive && buf) setBondAttr(parseBondEField(buf)); })
        .catch(() => { /* opcional */ });
    }
    return () => { alive = false; };
  }, [molKey, isChain, isCatalog, isDNA, live]);

  // Marco geométrico (eje principal, elongación) → decide orbit vs traversal.
  // GRASA: los núcleos y la escala salen del propio .bin calculado.
  const nucGrasa = useMemo(() => {
    if (!grasa) return null;
    const inv = 1 / (grasa.posq || O2AI_POSQ);
    const nuc: { pos: Vec3; protons: number; neutrons: number }[] = [];
    let ex = 1;
    // La escala se mide en el cuadro FORMADO (el último), no en el 0. El cuadro 0 es el de los
    // átomos SUELTOS, 3.5× más grande: con él la cámara se iba lejísimos y la molécula quedaba
    // en un punto (medido: 90 % de negro en toda la pieza). El sujeto de la pieza es la
    // molécula; que el arranque desborde es correcto, y de eso se encarga la toma.
    const b0 = (grasa.K - 1) * grasa.NNUC * 3;
    for (let i = 0; i < grasa.NNUC; i++) {
      const p: Vec3 = [grasa.nucPos[b0 + i * 3] * inv, grasa.nucPos[b0 + i * 3 + 1] * inv, grasa.nucPos[b0 + i * 3 + 2] * inv];
      const el = elementByZ(grasa.Z[i]);
      const info = el ? nucleusInfo(el) : { protons: grasa.Z[i], neutrons: grasa.Z[i] };
      nuc.push({ pos: p, protons: info.protons, neutrons: info.neutrons });
      ex = Math.max(ex, Math.hypot(p[0], p[1], p[2]));
    }
    return { nuc, ex: ex * 2.38 };   // mismo ratio medido que usa el anillo de agua
  }, [grasa]);
  const frame = useMemo<Frame>(() => (nucGrasa
    ? { ...frameFromNuclei(nucGrasa.nuc, nucGrasa.ex), mk: molKey }
    : { ...frameFromNuclei(data?.nuclei ?? [], data?.extent ?? 8), dna: isDNA, o2: isBond(molKey), nucX: isBond(molKey) ? BOND_ABINITIO[molKey].Re / 2 : undefined, mk: molKey }), [data, isDNA, molKey, nucGrasa]);

  const isCaro = molKey === 'caroteno';
  const dur = isGrasa ? BUTIRICO_DURATION : isFaraday ? FARADAY_DURATION : isCargas ? CARGAS_DURATION : isPair ? (WATER_BINS[molKey].dur ?? WPAIR_DURATION) : isMD ? MD_DURATION : isWater ? 60 : isDNA ? DNA_DURATION : molKey === 'li2' ? 44 : isBond(molKey) ? O2_FILM_DURATION : isCaro ? CARO_DURATION : DURATION;   // Li₂ RECIO: 44s (retención) sincronizado a la voz de 38s

  // API determinista (render headless) — ready solo cuando la nube cargó.
  // En modo `live` (montado en el quimilab) NO exponemos la API: corre el RAF.
  useEffect(() => {
    if (live) return;
    const api = {
      renderAt: (t: number) => setTime(Math.max(0, Math.min(dur, t))),
      ready: (isWater || isFaraday) ? waterReady : isGrasa ? !!grasa : !!data, duration: dur, molecule: molKey,
    };
    (window as unknown as { __cinematicAtom: typeof api }).__cinematicAtom = api;
    return () => { delete (window as unknown as { __cinematicAtom?: unknown }).__cinematicAtom; };
  }, [molKey, data, live, dur, isWater, isFaraday, waterReady, isGrasa, grasa]);

  // Modo vivo: loop continuo (cuando se monta interactivo en el lab).
  useEffect(() => {
    if (!live) return;
    let raf = 0, start = 0;
    const loop = (now: number) => { if (!start) start = now; setTime(((now - start) / 1000) % dur); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live, dur]);

  // En el lab se cambia de pestaña seguido; cada Canvas crea un contexto WebGL y
  // Chrome limita ~16 → si no se liberan al desmontar, el más viejo se pierde
  // ("Context Lost") y la escena se ennegrece. Al desmontar (solo live) forzamos
  // la liberación inmediata del contexto. El render headless 4K NO toca esto.
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  useEffect(() => () => { if (live) { try { glRef.current?.forceContextLoss(); glRef.current?.dispose(); } catch { /* noop */ } } }, [live]);

  void tv;
  return (
    <div style={{ position: live ? 'absolute' : 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        flat={!live}
        onCreated={({ gl }) => { glRef.current = gl; }}
        camera={{ position: [0, 0, (data?.extent ?? 8) * 0.5], fov: 35, near: 0.01, far: 400 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]} frameloop="always" style={{ background: '#000' }}
      >
        <color attach="background" args={['#000']} />
        <FrameDriver time={time} />
        {isPair && <WaterPair time={time} onReady={setWaterReady} mk={molKey} />}
        {isCargas && <CargasHex time={time} onReady={setWaterReady} />}
              {isFaraday && <FaradayJaula time={time} onReady={setWaterReady} />}
        {isMD && <WaterMD time={time} dur={dur} onReady={setWaterReady} />}
        {isWater && !isMD && !isPair && !isCargas && <WaterField molKey={molKey} time={time} dur={60} onReady={setWaterReady} />}
        {/* ═══ GRASA CALCULADA ═══════════════════════════════════════════════════════
            El mismo montaje que los ganadores, con los MISMOS componentes de la casa:
            tres O2Cloud de la densidad de deformación + BondEField con las líneas del
            campo. Nada dibujado: el enlace EMERGE de Δρ y las líneas salen de
            campo_lineas.py (V = ΣZ/|r−R| − ∫ρ/|r−r'|, siembra en la superficie ρ=0.002). */}
        {grasa && nucGrasa && (() => {
          const pulse = 0.92 + 0.08 * Math.sin(time * 2.0);
          const bF = 1.5;
          const inv = 1 / (grasa.posq || O2AI_POSQ);
          // LA FORMACIÓN: R(t) recorre el barrido de escalas del .bin, de los átomos SUELTOS
          // (Rvals[0]) a la molécula FORMADA (Rvals[K-1]). El motor interpola entre cuadros y,
          // como las partículas llevan semillas fijas, la carga FLUYE hacia los enlaces en vez
          // de parpadear. Curva ease-out: llegan rápido y el nacimiento del enlace se saborea.
          const sLejos = grasa.Rvals[0], sCerca = grasa.Rvals[grasa.K - 1];
          // `apertura` = 0 formada, 1 átomos sueltos. Es una CAPA (capas.ts), como en el anillo
          // de agua: la coreografía vive en datos y se ata a los segundos REALES de segs.json.
          const C = evalCapas(BUTIRICO_CAPAS, time);
          const ap = Math.min(1, Math.max(0, C.apertura ?? 0));
          const tr = Math.max(0.08, C.transito ?? 1);   // atenuación al ENTRAR a la nube
          const Rt = sCerca + (sLejos - sCerca) * ap;
          // RALEO ANTI-QUEMADO en TODOS los átomos pesados, no solo los oxígenos. El anillo de
          // agua ralea en sus O porque son los únicos pesados que tiene; aquí los 4 carbonos
          // también concentran densidad y sin ralear reventaban en blanco sólido (medido: 10.8 %
          // de píxeles >200 contra el 4.8 % del hexámero). Caben: 6 pesados, 8 lugares.
          const cores: [number, number, number][] = [];
          for (let i = 0; i < grasa.NNUC && cores.length < 8; i++)
            if (grasa.Z[i] > 1) cores.push([grasa.nucPos[i * 3] * inv, grasa.nucPos[i * 3 + 1] * inv, grasa.nucPos[i * 3 + 2] * inv]);
          const plano = (n: number, r: number, g: number, b: number) => {
            const c = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; }
            return c;
          };
          return <>
            <MolCameraRig frame={frame} time={time} vertical={vertical} />
            {nucGrasa.nuc.map((n, i) => (
              <group key={i} position={posNuc(grasa, Rt, i)}>
                <Nucleus protons={n.protons} neutrons={n.neutrons} time={time}
                  clusterRadius={0.022 + 0.009 * Math.cbrt(n.protons + n.neutrons)} />
              </group>
            ))}
            <O2Cloud premul qScale={grasa.posq} posQ={grasa.depPos} colors={plano(grasa.Ndep, 0.20, 0.45, 1.0)}
              Rvals={grasa.Rvals} N={grasa.Ndep} K={grasa.K} R={Rt}
              brightness={0.26 * bF * Math.max(0, C.dep ?? 1) * tr} size={0.47} cores={cores} coreR={0.9} coreThin={0.55} />
            <O2Cloud premul qScale={grasa.posq} posQ={grasa.accPos} colors={grasa.accColor}
              Rvals={grasa.Rvals} N={grasa.Nacc} K={grasa.K} R={Rt}
              brightness={0.30 * bF * pulse * Math.max(0, C.acc ?? 1) * tr} size={0.59} coreThin={0.72} cores={cores} coreR={0.55} />
            <O2Cloud premul qScale={grasa.posq} posQ={grasa.spinPos} colors={plano(grasa.Nspin, 0.82, 0.30, 1.0)}
              Rvals={grasa.Rvals} N={grasa.Nspin} K={grasa.K} R={Rt}
              brightness={1.39 * bF * pulse * Math.max(0, C.spin ?? 1) * tr} size={0.62} cores={cores} coreR={0.9} coreThin={0.80} />
            {grasaEf && <BondEField data={grasaEf} R={Rt} time={time * 8} reveal={Math.max(0, C.campo ?? 1)} col={[0.42, 0.72, 1.6]} ancho={5.6} />}
          </>;
        })()}
        {data && !isWater && (() => {
          // FORMACIÓN DEL ENLACE (O₂) GUIADA POR LA FÍSICA: el oscilador de Morse
          // (morseR) da el acercamiento REAL — caen al pozo, sobrepasan re, rebotan
          // y vibran hasta asentarse. La nube/enlace/campo se forman cuando los
          // orbitales se SOLAPAN (r → re). Solo O₂ por ahora.
          const _base = animatedNuclei(data.nuclei.map(n => n.pos), modes, time);
          const _cen = _base.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]] as Vec3, [0, 0, 0] as Vec3).map(v => v / _base.length) as Vec3;
          // ESPACIO CONTINUO (cero cortes): abre FORMADA (el pico = frame 1) y la
          // separación/unión sucede VARIAS VECES en cámara (bondR coreografiado).
          const sceneT = time;
          // CAROTENO (45s): ABRE espectacular (río de ORO, frame 1 = lo más verga) →
          // LA PREGUNTA (se enfría y ENCOGE: "¿y si fuera más corta?") → REGROW: el
          // color NACE del largo (la lección, el re-gancho) → héroe + loop. reveal =
          // cuánta cadena existe; warm = el salto HOMO-LUMO en el visible (naranja).
          // FORMACIÓN REAL desde 0 (serie de la formación): la conjugación CRECE unidad
          // por unidad (reveal, posiciones reales en orden real). El color por longitud
          // sale de la FÍSICA precomputada (caroColorLUT: λmax real de cada polieno N vía
          // PySCF → sRGB) — NO un warm inventado. warm = índice en esa LUT según el largo.
          // reveal va un poco ADELANTE de la cámara (misma curva ease que molCamera) →
          // la cadena crece justo delante de nosotros y siempre volamos en lo ya formado.
          const _gk = (() => { const x = Math.max(0, Math.min(1, sceneT / 45)); return x * x * x * (x * (x * 6 - 15) + 10); })();
          const caroReveal = !isCaro ? 1 : Math.min(1, (_gk + 0.12) / 0.6);
          // COLOR OBSERVADO REAL para el largo actual: N = reveal·11 dobles → LUT
          // (interpolada) del color que el cromóforo refleja a ese largo. Física, no warm.
          let caroColor: Vec3 = [1, 0.53, 0.01];
          if (isCaro && caroLUT && caroLUT.length) {
            const x = Math.max(0, Math.min(1, caroReveal)) * (caroLUT.length - 1);
            const i0 = Math.floor(x), i1 = Math.min(caroLUT.length - 1, i0 + 1), f = x - i0;
            const a = caroLUT[i0].rgb, b = caroLUT[i1].rgb;
            caroColor = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
          }
          const caroBright = 0.62;   // tenue a propósito: el aditivo del río satura a blanco si subes
          const mr = isBond(molKey) ? bondR(sceneT, molKey) : 1.0;
          const formed = isBond(molKey) ? smoothstep((1.4 - mr) / 0.25) : 1;
          // VIBRACIÓN DE PUNTO CERO: aun en el estado base la molécula respira (energía
          // vibracional ωe). El enlace vibra sutil ±1.2% sobre re — nunca está del todo quieta.
          const zpv = isBond(molKey) ? formed * 0.025 * Math.sin(sceneT * 4.0) : 0;   // ±2.5%: el enlace RESPIRA visible (zpv real, amplitud legible)
          // clamp al rango del bin (el rebote del Morse baja de Rmin un instante: que
          // núcleos y nube compriman JUNTOS, no el núcleo solo)
          const _appr = Math.max(0.85, mr + zpv);   // separación relativa: R(t) = Re·_appr (bohr)
          // TRANSIT DIM por FASE del viaje: dentro de la nube la columna σ apila miles
          // de sprites aditivos → pared BLANCA. Clavado (30–44) y salida (58.5–64.5)
          // = túnel tenue (0.12); órbita del núcleo = bokeh moderado (0.45) para que
          // los nucleones (mallas, no sprites) RESALTEN. Afuera, intacta. Rampas suaves.
          const _sw = (a: number, b: number) => smoothstep((sceneT - a) / (b - a));
          let transitDim = 1;
          if (isBond(molKey) && molKey === 'f2') {
            // F₂ NO baja al núcleo: el acto medio vive DENTRO del velo (cinturones de
            // pares libres + callejón). Dim moderado para que las partículas RESUELVAN
            // sin pared blanca, y las guías de repulsión se lean encima.
            // DENTRO del velo todo el acto (cinturón+locura+callejón): 0.32. OJO
            // calibrado A 4K REAL: el probe 540p tiene sprites 4× más gordos (cap
            // en px) → quema con la mitad de luz. A 4K, 0.16 daba pantalla NEGRA
            // (brillo medio 0.01-0.05) y 0.32 da el acto vivo sin lavar la columna.
            transitDim = lerp(1, 0.32, _sw(27.8, 30.2));    // entra al cinturón (cruza el velo ~28.7)
            transitDim = lerp(transitDim, 1.0, _sw(54.2, 56.2));  // el brillo regresa con la molécula
          } else if (molKey === 'h2o') {
            // H₂O: la molécula (la V bent) es el show casi todo el tiempo → brillo pleno.
            // Dim SOLO durante el dive corto y tardío al O (47.5-58, "mira el corazón"),
            // el brillo REGRESA para el clímax de la molécula entera (l9 "si fuera recto").
            transitDim = lerp(1, 0.20, _sw(47.5, 50.0));    // dive corto al núcleo O
            transitDim = lerp(transitDim, 0.45, _sw(51.0, 52.5)); // órbita del núcleo (8 p⁺ resalta)
            transitDim = lerp(transitDim, 1.0, _sw(56.5, 58.5));  // el brillo regresa (clímax molécula)
          } else if (molKey === 'li2') {
            // Li₂ RECIO (voz 38s): clavado al núcleo t30–38 → dim para que el nucleón
            // resalte; el brillo REGRESA con la molécula en la salida (t40+).
            transitDim = lerp(1, 0.13, _sw(30.5, 33.0));    // entra al núcleo → APAGA la nube para que el NUCLEÓN resalte (como O2/N2)
            transitDim = lerp(transitDim, 1.0, _sw(40.0, 42.0));  // el brillo regresa (salida, cierre)
          } else if (isBond(molKey)) {
            // el dim entra cuando la cámara CRUZA el borde de la nube (~34.5s con el
            // clavado desde 1.95·ex) — NO antes: atenuar al sujeto en plano abierto
            // = pantalla muerta (lo cachó pantalla-verify: fill 0.06 en 30-35s)
            transitDim = lerp(1, 0.14, _sw(30.0, 32.5));    // entra a la nube
            transitDim = lerp(transitDim, 0.50, _sw(36.5, 39.0)); // llega al núcleo
            transitDim = lerp(transitDim, 0.15, _sw(51.2, 52.7)); // salida warp
            transitDim = lerp(transitDim, 1.0, _sw(53.9, 56.2));  // el BRILLO REGRESA con la molécula ("el candado sigue ahí" = 56.3 llegando a color)
          }
          const animPos = _base.map(p => [_cen[0] + (p[0] - _cen[0]) * _appr, _cen[1] + (p[1] - _cen[1]) * _appr, _cen[2] + (p[2] - _cen[2]) * _appr] as Vec3);
          // O₂: los núcleos DIBUJADOS se alinean con la densidad ab initio (eje X, ±R/2)
          // sin importar el eje del mol-o2.bin. R(t)=2.28·_appr bohr → ±1.14·_appr.
          // TRIATÓMICO (H₂O): 3 núcleos forzados a la geometría medida (O origen, 2 H a
          // D_OH·_appr en el plano XY al ángulo). Alinea con el Δρ del bin. R=Re·_appr
          // (Re=D_OH) → la distancia O-H de los núcleos = R del frame de la nube. Coherente.
          const drawPos: Vec3[] = isTri(molKey)
            ? (() => { const tg = TRIATOMIC[molKey]; const r = tg.dOH * _appr; const h = tg.angle * Math.PI / 360;
                const cx = r * Math.cos(h), cy = r * Math.sin(h);
                return [[0, 0, 0], [cx, cy, 0], [cx, -cy, 0]] as Vec3[]; })()
            : isBond(molKey)
              ? animPos.map((_, i) => [(i === 0 ? -1 : 1) * (BOND_ABINITIO[molKey].Re / 2) * _appr, 0, 0] as Vec3)
              : animPos;
          return <>
            <MolCameraRig frame={frame} time={isBond(molKey) ? sceneT : time} vertical={vertical} />
            {data.nuclei.map((nuc, i) => (
              <group key={i} position={drawPos[i]}>
                <Nucleus protons={nuc.protons} neutrons={nuc.neutrons} time={time}
                  clusterRadius={(molKey === 'li2' ? 0.055 : 0.022) + (molKey === 'li2' ? 0.014 : 0.009) * Math.cbrt(nuc.protons + nuc.neutrons)}
                  {...(isBond(molKey)
                    /* núcleo CHICO diatómico: neutrón azul-hielo TENUE (no violeta HDR) →
                       cero "punto morado"; los protones dorados dominan = "tres protones". */
                    ? { nHot: [0.62, 0.9, 1.35] as [number, number, number], nHue: 0.55 }
                    : {})} />

              </group>
            ))}
            {/* CAROTENO FLAGSHIP: la cadena por el MOTOR de O₂ (sprites grandes+tenues,
                río π cálido naciendo del largo) — reemplaza ElectronCloud+ChainField */}
            {isCaro && <CarotenoFlow bundle={data.bundle} axis={frame.a} cen={frame.c}
              L={frame.L} reveal={caroReveal} color={caroColor} bright={caroBright} time={sceneT} />}
            {/* nube MOLECULAR precomputada — OTRAS moléculas (O₂ usa la densidad real abajo) */}
            {!isBond(molKey) && !isCaro && <ElectronCloud bundle={data.bundle} time={time} holeRadius={0.04}
              bokeh={0.8 / Math.max(1, data.extent)} rotRate={0} brightness={formed} />}
            {/* O₂: Δρ AB INITIO (PySCF UHF/cc-pVTZ, triplete). La DEFORMACIÓN Δρ=ρ(O₂)−ρ(átomos)
                = el enlace DESNUDO: oro/ámbar donde la carga se acumula (σ+π), azul de dónde se
                vació, violeta = los π* desapareados (el imán). Fluye al bajar R(t)=2.28·_appr bohr. */}
            {/* ACTO 1: dos ÁTOMOS INDIVIDUALES (ρ atómica real) que se entrelazan al
                acercarse. Electrones = cian-blanco frío (juego de color: frío el átomo,
                cálido el enlace). Se desvanecen al formarse el enlace (pasa la atención
                a Δρ) pero no mueren: la molécula conserva sus nubes. */}
            {/* HANDOFF continuo: conforme el campo del enlace ENCIENDE (reveal), la
                foto atómica congelada CEDE — se ve la unión, no dos nubes cruzándose. */}
            {isBond(molKey) && atomCloud && !isTri(molKey) && [-1, 1].map(s => (
              <AtomCloud key={s} posQ={atomCloud} x={s * (BOND_ABINITIO[molKey].Re / 2) * _appr} shellR={BOND_ABINITIO[molKey].shellR}
                brightness={(molKey === 'li2'
                  ? 0.70 - 0.05 * formed   /* NO se apaga en las bandas tardías (pozo/σ, sin campo) — antes bajaba 0.14 al enlazar y quedaba oscuro/vacío (feedback) */
                  : 0.55 - 0.36 * smoothstep((1.7 - mr) / 0.35) - 0.15 * formed) * transitDim * (BOND_ABINITIO[molKey].boost ?? 1)} />
            ))}
            {isBond(molKey) && o2ai && (() => {
              const mrL1 = Math.max(0.86, bondR(Math.max(0, sceneT - 0.10), molKey));
              const mrL2 = Math.max(0.86, bondR(Math.max(0, sceneT - 0.22), molKey));
              const flowSpeed = Math.abs(mr - mrL2) / 0.22;          // |dR/dt| real
              const ghost = Math.min(1, flowSpeed * 3.2);            // estelas ∝ velocidad del flujo
              // PRENDER/APAGAR enlaces — N₂: σ → π¹ → π² · O₂: doble enlace → EL IMÁN (π*)
              const _win = (a: number, b: number) => smoothstep((time - a) / 0.28) * (1 - smoothstep((time - b) / 0.28));
              const isO2x = molKey === 'o2';
              const wS = isO2x ? _win(6.2, 11.3) : _win(17.7, 19.6);
              const w1 = isO2x ? 0 : _win(19.6, 21.5);
              const w2 = isO2x ? 0 : _win(21.5, 23.4);
              const wM = isO2x ? _win(11.9, 16.4) : 0;           // el IMÁN (spin/π* solo)
              const solo = Math.max(wS, w1, w2, wM);
              // pisos O₂ más altos: el beat resalta SIN apagar la molécula (feedback colores)
              const fO = isO2x ? 0.34 : 0.14, fP = isO2x ? 0.30 : 0.10;
              const sigmaMul = lerp(1, 1.30 * wS + fO * (1 - wS), solo);
              const pi1Mul = lerp(1, 1.45 * w1 + fP * (1 - w1), solo);
              const pi2Mul = lerp(1, 1.45 * w2 + fP * (1 - w2), solo);
              // Be₂: el σ2u* (3ª nube) NO es anillo π → sin toro (thirdRing 0) y atenuado
              // para que BALANCEE con el σ2g dorado = se vea la CANCELACIÓN (orden 0), no un mar cian.
              // Li₂: capa CERRADA → sin π, sin espín → rho_third≈0; sus N_SPIN partículas
              // muestrean campo cero y COLAPSAN al centro = el "punto morado" (artefacto NO
              // físico, coloreado magenta por default). Se OCULTA. El charco real = acc (σ2s dorado).
              // capa cerrada sin π real (li2/nacl/hf/hcl): la nube de espín está VACÍA y
              // colapsa al centro como un punto morado (feedback Ian en NaCl) → spinMul=0.
              const spinMul = isO2x ? lerp(1, 1.60 * wM + 0.35 * (1 - wM), solo) : (molKey === 'be2' ? 0.55 : (molKey === 'li2' || molKey === 'nacl' || molKey === 'hf' || molKey === 'hcl') ? 0 : 1);
              return <O2BondFlow ai={o2ai} R={BOND_ABINITIO[molKey].Re * _appr}
                swirl={(BOND_ABINITIO[molKey].swirl || 0) * sceneT} third={BOND_ABINITIO[molKey].pi}
                reveal={(BOND_ABINITIO[molKey].ionic ? smoothstep((5.4 - mr) / 1.6) : smoothstep((1.8 - mr) / 0.5)) * transitDim}
                aura={(BOND_ABINITIO[molKey].ionic ? (0.6 + 1.0 * smoothstep((sceneT - 13.5) / 1.5) * (1 - smoothstep((sceneT - 21) / 2.2))) : Math.max(smoothstep((1.8 - mr) / 0.5), 0.45)) * transitDim}
                RLag1={BOND_ABINITIO[molKey].Re * mrL1} RLag2={BOND_ABINITIO[molKey].Re * mrL2} ghost={ghost}
                thirdRing={molKey === 'be2' || molKey === 'li2' || molKey === 'h2o' ? 0 : 2.4}
                piSplit={piSplit} sigmaMul={BOND_ABINITIO[molKey].ionic ? (0.45 + 1.7 * smoothstep((sceneT - 19.5) / 1.8)) : sigmaMul} pi1Mul={pi1Mul} pi2Mul={pi2Mul} spinMul={spinMul} boost={BOND_ABINITIO[molKey].boost ?? 1} piColors={BOND_ABINITIO[molKey].piColors ?? null} ionic={!!BOND_ABINITIO[molKey].ionic} accMul={molKey === 'h2o' ? 0.58 : 1} />;
            })()}
            {/* O₂ PARAMAGNÉTICO: campo DIPOLAR real de los 2 e⁻ π* desapareados (μ=2).
                El oxígeno es de los poquísimos gases magnéticos — el O₂ líquido se cuelga
                de un imán. Aparece al asentarse el enlace (los π* ya viven) y brilla en el
                héroe. Líneas r=L·sin²θ, brillo ∝ |B|. Es física, no adorno. */}
            {isBond(molKey) && BOND_ABINITIO[molKey].mu > 0 && (
              <MagneticField mu={BOND_ABINITIO[molKey].mu} time={time} radius={frame.ex * 0.42}
                op={Math.min(0.82, (smoothstep((time - 11.7) / 1.5) * (1 - smoothstep((time - 27.5) / 1.5))
                  + smoothstep((time - 54.5) / 2.0)) * 0.82)} />
            )}
            {/* F₂: las GUÍAS de la repulsión — líneas de fuerza del campo de dos cargas
                iguales (integración numérica real) durante el acto medio. El muro que
                debilita el enlace, visible; etiquetadas en el caption de 31s. */}
            {molKey === 'f2' && <RepulsionField nx={BOND_ABINITIO.f2.Re / 2} time={time} />}
            {/* CAMPO ELÉCTRICO real (Li₂/Be₂): las líneas de fuerza calculadas rodean el
                átomo COMPLETO — reemplaza el "punto" del enlace por su CAMPO. Aparece con
                la molécula formada (héroe) y en el regreso; se apaga en el clavado al núcleo. */}
            {/* Li₂: LAS DOS FUERZAS (empuje repulsión + jalón electrones, el jalón GANA →
                caen; en el fondo se igualan). Es el POR QUÉ del enlace, calculado real.
                Vive el acto del acercamiento (t≈9-26, sobre la voz "la nube jala a los dos
                núcleos" → "la atracción vence a la repulsión"); se apaga antes del clavado. */}
            {molKey === 'li2' && (
              <ForceDuel R={BOND_ABINITIO.li2.Re * _appr} nx={(BOND_ABINITIO.li2.Re / 2) * _appr}
                op={smoothstep((sceneT - 8) / 1.5) * (1 - smoothstep((sceneT - 18) / 2.5)) * transitDim} />
            )}
            {/* CAMPO ELÉCTRICO REAL (Li₂/Be₂) — LA FIRMA que O2/N2/C2 no tienen: las líneas de
                fuerza calculadas (E=−∇V) que se CONECTAN en una sola al unirse los átomos
                ("cómo se conectan las líneas"). Vive el acto del acercamiento mostrando la
                UNIÓN de los dos campos → uno molecular; se apaga al bajar al núcleo (el campo
                es la historia del ENLACE, a escala nuclear desaparece). */}
            {isBond(molKey) && bondEf && (
              <BondEField data={bondEf} R={BOND_ABINITIO[molKey].Re * _appr} time={sceneT}
                col={molKey === 'be2' ? [0.95, 0.80, 0.60] : molKey === 'li2' ? [0.50, 0.86, 1.3] : [0.40, 0.78, 1.0]}
                reveal={(molKey === 'li2' || molKey === 'nacl')
                  ? smoothstep((sceneT - 1.2) / 1.4) * (1 - smoothstep((sceneT - 22) / 3.5)) * transitDim
                  : (0.6 + 0.4 * smoothstep(sceneT / 0.6)) * (1 - 0.82 * smoothstep((sceneT - 14) / 4.0)) * (1 - smoothstep((sceneT - 30) / 2.5))
                    + 0.4 * smoothstep((sceneT - 39) / 1.2) * (1 - smoothstep((sceneT - 44) / 1.0))} />
            )}
            {/* (gráfica del pozo QUITADA — rompía la estética de partículas; el pozo lo cuenta
                el MOVIMIENTO: caen, sobrepasan Re, vibran amortiguado y se asientan = atrapados.) */}
            {/* cilindro de enlace para OTRAS moléculas; en O₂ el PUENTE de densidad ES el enlace */}
            {!isBond(molKey) && formed > 0.05 && data.bonds.map(([i, j], k) => (
              <Bond key={k} a={animPos[i]} b={animPos[j]} time={time} />
            ))}
            {/* CAMPO eléctrico como PLASMA volumétrico — moléculas POLARES (dipolo).
                Los alcanos son apolares (sin campo); las cadenas CONJUGADAS llevan
                el campo de CARAS π (MEP real, no dipolo inventado). */}
            {!isChain && !isCatalog && !isDNA && !isBond(molKey) && <PlasmaField nuclei={data.nuclei} time={time} />}
            {/* O₂ paramagnético: el imán NO se dibuja con anillos (eso era HUD falso) —
                EMERGE de la densidad real de los π* (los lóbulos violeta = los 2 e⁻
                desapareados). La física lo muestra sola. */}
            {isChain && !isCaro && <ChainField frame={frame} time={time} alkane={!CONJUGATED_KEYS.has(molKey)} />}
            {isCatalog && catField === 'pi' && <ChainField frame={frame} time={time} alkane={false} />}
            {isCatalog && catField === 'sigma' && <ChainField frame={frame} time={time} alkane={true} />}
          </>;
        })()}
        {/* live: sin EffectComposer (HDR-float+MSAA revienta a blanco en GPUs
            diversas). flat={!live} → tonemap ACES del renderer. PostFX solo headless. */}
        {!live && <MolPostFX sat={isPair ? 0.65 : 0.5} />}
      </Canvas>
      {/* DOS viñetas se sumaban (esta DOM + la de MolPostFX): en wtri se queda UNA. */}
      {!esAnillo(molKey) && !isCargas && <CinemaVignette />}
      {!live && <>
        {!isCaro && !(isBond(molKey) && (BOND_BEATS_MOL[molKey] ?? []).some(b => time >= b.t0 - 0.4 && time <= b.t1 + 0.5)) &&
          <ScaleNote molKey={molKey} time={time} vertical={vertical} />}
        {isDNA && <AudioNote time={time} vertical={vertical} />}
        {!isBond(molKey) && <ModeLabel modes={modes} time={time} vertical={vertical} />}
        {!isCaro && <FieldLabel molKey={molKey} polar={isChain || (isCatalog && catField !== 'none') || (!isCatalog && !isDNA && !!data && partialCharges(data.nuclei).some(v => Math.abs(v) > 0.05))} time={time} vertical={vertical} />}
        {!isCaro && <MoleculeTitle mkey={molKey} time={time} vertical={vertical} />}
        {isBond(molKey) && <BondExplainer time={time} vertical={vertical} mol={molKey} />}
        {isCargas && <FormulaOverlay time={time} vertical={vertical} beats={CARGAS_FORMULAS} />}
        {/* 16:9 — el default horizontal es cinemascope 2.39:1 (barras de 12.8%) y eso
            se COME el cuadro; el mandato es PANTALLA COMPLETA. Se iguala a la barra
            fina de la serie en vertical (5%): firma de cine sin void muerto. */}
        {/* LETTERBOX — acotado a wtri (2026-07-28). El default vertical es 5% ARRIBA y 5%
            ABAJO = 10% del cuadro en negro DURO por construcción, y el anillo ya venía con
            55-88% de negro muerto medido por los jueces. Se apaga SOLO para 'wtri': O₂/N₂/C₂
            y agua v2 son GANADORES y su barra de cine se queda igual (canon regla #0). */}
        <Letterbox vertical={vertical} pct={esAnillo(molKey) || isCargas || isFaraday ? 0 : (vertical ? undefined : 4.5)} />
      </>}
    </div>
  );
}

export default memo(CinematicMoleculeInner);
