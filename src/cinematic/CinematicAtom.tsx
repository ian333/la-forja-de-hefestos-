/**
 * CinematicAtom v3 — cinema, no documental.
 *
 *   "El átomo no es un objeto. Es un evento."
 *   "El asombro no está en el núcleo. Está en el VACÍO que cruzas para llegar."
 *
 * Estructura cinemática (18s — escenas largas, todo respira):
 *   CUT 1  0.0-3.0s    DESPERTAR — close-up íntimo, capas nacen
 *   CUT 2  3.0-10.5s   VIAJE — LA CAÍDA por la nada: dejas la nube, cruzas el
 *                      vacío (el átomo es 99.9999% espacio vacío), el núcleo
 *                      es un punto lejano que crece. Powers of Ten honesto.
 *   CUT 3  10.5-15.0s  MIRADA — 4.5s desde el núcleo; los electrones son estrellas
 *   CUT 4  15.0-18.0s  REGRESO — zoom out; el átomo se reforma COMPLETO y
 *                      aterriza ~17s, sostiene, luego se disuelve en el logo
 *
 * Núcleo = cúmulo de nucleones con shader propio: densidad de estrella de
 * neutrones (fresnel que sangra luz) + tensión de fuerza fuerte (micro-vibración
 * + pulso de energía contenida). NO meshStandard — eso eran caramelos glow.
 *
 * Tiempo determinista: window.__cinematicAtom.renderAt(t) ∈ [0, 15].
 */

import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, BrightnessContrast, HueSaturation, ToneMapping, Noise } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import {
  elementByZ, type Element,
} from '@/lib/chem/quantum/periodic-table';
import {
  populateAtom, atomExtent, nucleusInfo,
  subshellColor, subshellColorLive, subshellLabel,
  type PopulatedOrbital,
} from '@/lib/chem/quantum/atom-builder';
import { ORBITALS, sampleOrbital } from '@/lib/chem/quantum/orbitals';
import { loadAtomAbInitio, bundleFromAbInitio } from '@/lib/chem/quantum/atom-abinitio';
import { win } from './capas';

// ── EL BEAT DE LAS BANDAS ────────────────────────────────────────────────────
// Ian, 2026-08-11: "se pueden opacar y mostrar nubes individuales — las nubes SON las
// bandas y los orbitales". Hasta hoy la cascada de `uRevealMask` encendía cada subcapa
// y la dejaba PRENDIDA para siempre: al segundo 2 el átomo era una bola con todo
// encima, que es justo el defecto que Ian ya había cazado en la serie de moléculas
// ("ACÁ ESTÁ ENCENDIDO TODO TODO EL TIEMPO").
//
// El mecanismo es el del GANADOR (O₂/N₂), copiado literal: cuando una nube está en
// turno sube a 1 y las OTRAS caen a un PISO — no a cero. Las partículas no
// desaparecen, se OPACAN; así el ojo lee "es la misma nube, ahora miro esta parte"
// en vez de "apareció otra cosa". Allá era `sigmaMul = lerp(1, ..., solo)`; aquí es
// `bandaMask`, y la ventana de cada banda es la MISMA que ya usaba su etiqueta, así
// que el nombre `3d⁷` se enciende exactamente cuando su nube toma el escenario.
const BANDA_T0 = 15.2;        // arranca el barrido (idéntico al que ya tenían las etiquetas)
const BANDA_COLA = 3.4;       // tras la última banda: el campo B y el cierre
// Las nubes que NO están en turno. 0.05, no 0.12: con los canales por ORBITAL lo que define
// a un p es su NODO —el hueco en el núcleo— y a un d sus lóbulos separados. Las otras nubes,
// que viven justo ahí, RELLENABAN el nodo y la mancuerna se leía como una bola alargada
// (medido en el neón, 2026-08-11). Se queda un rastro para no perder el contexto de dónde
// vive el orbital, pero la forma manda.
const BANDA_PISO = 0.05;
const BANDA_ENCUADRE = 3.2;   // distancia de cámara en radios de la banda (ver bandaRadio)
// AL MAGNIFICAR UNA BANDA HAY QUE ENGORDAR EL PUNTO. Medido en el cromo: una banda sola
// aporta ~50 000 puntos y, repartidos en los 8.3 Mpx del cuadro 4K, cubren el 2.4 % — o sea
// puntitos sueltos sobre negro, no una nube (media 1.5/255 en las ocho bandas). El átomo
// COMPLETO llena con sus ~200 000. Engordar el sprite ×3 sube la cobertura al orden del 20 %
// y devuelve la masa luminosa continua del canon, sin inventar puntos que no se calcularon.
const BANDA_PUNTO = 3.0;
const BANDA_LUZ = 1.6;        // y un empujón de alfa: menos capas sumando en aditivo

/**
 * Segundos por banda. Pocas → cada una respira; muchas → barrido ágil (el Gd tiene 14).
 * Los valores salen de una restricción REAL, no del gusto: la narración tiene que caber.
 * A 2.21 palabras/segundo (ritmo medido del butírico: 128 palabras en 57.89 s con VEL=1.10
 * y 0.40 de silencio entre líneas), una banda necesita ~2 s para nombrarse y verse. Con la
 * tabla anterior (2.4/1.9/1.35) los cinco guiones se pasaban de largo entre 3 y 10 s, y un
 * video que se queda sin cuadros antes que sin voz congela el último frame.
 */
function bandaDur(total: number): number {
  return total <= 3 ? 3.2 : total <= 5 ? 2.6 : total <= 8 ? 2.2 : 1.5;
}
/** Ventana [t0,t1] en que la subcapa `idx` es la protagonista. */
function bandaWindow(idx: number, total: number): [number, number] {
  const d = bandaDur(total);
  const t0 = BANDA_T0 + idx * d;
  return [t0, t0 + d];
}

// Duración VARIABLE por # de subcapas: ahora la define el BARRIDO DE BANDAS —
// gancho+viaje+mirada (15.2s, congelados) + una ventana por subcapa + la cola del
// campo magnético. H (1 banda) ≈ 21s; Fe (7) ≈ 32s; Gd (14) ≈ 37s.
let RUN_DURATION = 18;
function durationForShells(n: number): number {
  return Math.round((BANDA_T0 + Math.max(1, n) * bandaDur(n) + BANDA_COLA) * 10) / 10;
}

/**
 * Opacidad de la subcapa `idx` en el instante t.
 *   · Antes de 15.2s → la cascada de nacimiento de siempre (0.3-2.0s), intacta.
 *   · Durante el barrido → 1 si es su turno, BANDA_PISO si le toca a otra.
 *   · Después → todas vuelven a 1 y el átomo se ve COMPLETO para el cierre.
 */
function bandaMask(time: number, idx: number, total: number, e = 1, eMax = 1): number {
  const nacer = fadeIn(time, shellRevealTime(idx, total), 0.85);
  const mia = win(time, ...bandaWindow(idx, total), 0.45);
  const barrido = win(time, BANDA_T0, bandaWindow(total - 1, total)[1], 0.45);
  // COMPENSACIÓN DE POBLACIÓN. Los puntos se reparten POR ELECTRÓN, así que una banda
  // de 1 e⁻ tiene diez veces menos puntos que una de 10 y al mismo alfa se ve diez veces
  // más tenue. Medido en el cromo: con ganancia plana el 4s¹ salía a media 1.1/255 (negro)
  // mientras el 2p⁶ saturaba, y en el turno del 3s² la pantalla se veía ROJA porque el
  // 2p⁶ apagado al piso seguía ganándole. Se compensa con √(eMax/e) — raíz, no lineal:
  // el brillo aditivo ya crece sublinealmente con la densidad de puntos.
  const gan = Math.min(2.6, Math.sqrt(eMax / Math.max(1, e)));
  return nacer * lerp(1, BANDA_PISO + (gan - BANDA_PISO) * mia, barrido);
}

/**
 * Posición CONTINUA dentro del barrido: 0 al empezar la banda 0, `total` al acabar
 * la última. Fuera del barrido devuelve null (la escena usa sus valores de siempre).
 */
function bandaFase(time: number, total: number): number | null {
  const u = (time - BANDA_T0) / bandaDur(total);
  return u <= 0 || u >= total ? null : u;
}

/**
 * EL RADIO QUE LA CÁMARA DEBE MIRAR EN ESTE INSTANTE.
 *
 * ⚠ ESTO NO ES ESTÉTICA, ES LO QUE HACE QUE EL BARRIDO EXISTA (medido 2026-08-11):
 * con la cámara clavada al extent del átomo completo, las bandas internas salían en
 * cuadros de media 1.0/255 — NEGROS. El 1s del cromo vive dentro del 1 % del radio
 * atómico: desde afuera es sub-píxel, y soloarlo no muestra nada. Para VER una banda
 * hay que estar a la escala de esa banda.
 *
 * Efecto secundario y honesto: como las subcapas salen de adentro hacia afuera, la
 * cámara RETROCEDE banda por banda. El espectador viaja hacia afuera por el átomo.
 */
function bandaRadio(time: number, shellR: Float32Array, piso = 0): number | null {
  const n = shellR.length;
  const u = bandaFase(time, n);
  if (u === null) return null;
  const i = Math.min(n - 1, Math.floor(u));
  const frac = u - i;
  // Se SOSTIENE el 65 % de la ventana (para leer la forma) y viaja en el 35 % final.
  const r = lerp(shellR[i], shellR[Math.min(n - 1, i + 1)], smoothstep((frac - 0.65) / 0.35));
  // PISO: el 1s de un átomo pesado es más chico que el propio cúmulo de nucleones, y sin
  // tope la cámara se metía DENTRO del núcleo (medido: cuadro amarillo al 90 % de píxeles
  // encendidos). Una banda se mira desde afuera o no se mira.
  return Math.max(r, piso);
}
const SAMPLES_PER_ELECTRON = 16000;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
export function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
function fadeIn(time: number, start: number, dur = 0.9): number {
  return smoothstep((time - start) / dur);
}

// ── CUT SYSTEM ─────────────────────────────────────────────────────
type Vec3 = [number, number, number];
type CutSpec = {
  t0: number; t1: number;
  cam: (localT: number, extent: number) => {
    pos: Vec3;
    lookAt?: Vec3;       // optional off-center look
    fov: number;
  };
  bloom: number;
  vignette: number;
  chroma?: boolean;
  name: string;
};

function sph(dist: number, elev: number, azim: number): Vec3 {
  return [
    dist * Math.cos(elev) * Math.cos(azim),
    dist * Math.sin(elev),
    dist * Math.cos(elev) * Math.sin(azim),
  ];
}

const CUTS: CutSpec[] = [
  {
    // 0.0-3.0s · GOLPE + REVELACIÓN (cold-open EN la simulación).
    //   0.0-1.3s: el NÚCLEO llena el cuadro y SE ACERCA (looming) — sorpresa +
    //     1-objeto + contraste desde el frame 0. Front-load del money-shot que el
    //     detector midió en ~10s con z+11.8 (docs/NEUROCIENCIA-DEL-GANCHO.md).
    //     bloom alto → el cúmulo REVIENTA; órbita enérgica = movimiento.
    //   1.3-3.0s: pull-back que REVELA el átomo completo y entrega al 'viaje'
    //     (termina en ex*0.95 = inicio exacto del viaje, corte invisible).
    t0: 0.0, t1: 3.0, name: 'golpe', bloom: 0.95, vignette: 0.5,
    cam: (t, ex) => {
      // ESTALLIDO @ frame0 (regla #1: el pico debe estar al INICIO, no llegar a él).
      // En t=0 el núcleo YA llena el cuadro (máx contraste + 1-objeto) y en los
      // primeros ~0.25s SE ABALANZA hacia la cámara (looming explosivo: dist baja,
      // fov cierra) → el pico de movimiento+sorpresa cae a ~0.15s, no a 0.75s.
      if (t < 0.083) {                                  // 0-0.25s · el estallido
        const u = smoothstep(t / 0.083);
        const dist = lerp(ex * 0.0110, ex * 0.0058, u); // se abalanza: crece rápido hacia ti
        const azim = 1.2 + u * 1.3;                      // giro enérgico inmediato
        return { pos: sph(dist, 0.06, azim), lookAt: [0, 0, 0], fov: lerp(40, 32, u) };
      }
      const u = smoothstep((t - 0.083) / 0.917);        // 0.25-3.0s · pull-back revelador
      const dist = lerp(ex * 0.0058, ex * 0.95, u);
      const azim = 2.5 + u * 0.7;
      const elev = lerp(0.06, 0.26, u);
      return { pos: sph(dist, elev, azim), lookAt: [0, 0, 0], fov: lerp(34, 34, u) };
    },
  },
  {
    // 3.0-10.5s · LA CAÍDA (7.5s) — Powers of Ten honesto. Caída a velocidad
    // logarítmica casi constante (e≈t): dejas la nube en ~2s y luego cruzas el
    // VACÍO — segundos de casi-nada donde el núcleo es un puntito lejano que
    // crece, los electrones son estrellas dispersas. FOV estable = dolly puro.
    t0: 3.0, t1: 10.5, name: 'viaje', bloom: 0.50, vignette: 0.62,
    cam: (t, ex) => {
      // FLY-THROUGH: no es caer radial — la cámara VUELA ATRAVESANDO la nube.
      // Barrido lateral GRANDE (azim ~195°) + clavado desde el borde de la nube
      // hasta el núcleo + cruce del plano vertical (+0.28→−0.28) → "viaje POR el
      // átomo": las capas/electrones pasan ROZANDO la cámara. fov ancho = inmersión.
      // El núcleo queda de ANCLA (lookAt al centro) para no perder el encuadre.
      const u = smoothstep(t);
      const az = 0.2 + u * 3.4;                       // de un lado al otro, atravesando
      // closest = ex·0.18: vuela por la nube RICA (mid), NO se clava al centro
      // vacío/granulado (ahí el point-cloud tirita en movimiento rápido). El barrido
      // veloz (u~0.5) queda donde la nube se ve DENSA y suave, no en el hueco.
      const r  = ex * lerp(1.0, 0.18, Math.pow(u, 0.7));
      const el = 0.28 * Math.cos(u * Math.PI);        // cruza el plano: arriba → abajo
      return { pos: sph(r, el, az), lookAt: [0, 0, 0], fov: 44 };
    },
  },
  {
    // 10.5-15.0s · MIRADA (4.5s) — DESDE el núcleo. Órbita lenta, cielo estrellado.
    t0: 10.5, t1: 15.0, name: 'mirada', bloom: 0.55, vignette: 0.50,
    cam: (t, ex) => {
      // SEGUNDO BEAT: órbita ENÉRGICA alrededor del núcleo (swoop) — antes era
      // demasiado plácida; ahora tiene su propio empuje (feedback: faltaba 2º beat).
      const nucDist = ex * (0.0090 - 0.0030 * Math.sin(t * Math.PI)); // push-in y sale
      const azim = 2.2 + t * 1.15;                   // órbita más rápida = movimiento sentido
      const elev = 0.04 + 0.22 * Math.sin(t * Math.PI); // arco vertical (swoop)
      return { pos: sph(nucDist, elev, azim), lookAt: [0, 0, 0], fov: lerp(40, 34, t) };
    },
  },
  {
    // 15.0s → RUN_DURATION · REGRESO (3-8s, VARIABLE) — zoom out; el átomo se
    // reforma completo, ATERRIZA al 62% del corte, sostiene, y se disuelve en el
    // logo. Más capas → regreso más largo → la cascada de etiquetas TERMINA.
    // (t1 es placeholder; findCut usa RUN_DURATION como fin real)
    // CONTEMPLACIÓN (mantiene name 'regreso' porque findCut usa eso para el fin).
    // Pull-out RÁPIDO al átomo completo, luego HOLD lento y lejano = el respiro
    // tranquilo que pediste para LEER la forma de la nube + el campo magnético.
    // bloom BAJO (0.34): más luz lava a blanco; bajarlo deja ver los lóbulos.
    t0: 15.0, t1: 99.0, name: 'regreso', bloom: 0.34, vignette: 0.62,
    cam: (t, ex) => {
      const land = smoothstep(Math.min(1, t / 0.18));         // llega RÁPIDO a vista lejana (contempl. corta)
      const dist = ex * 0.007 * Math.pow(143, land);          // → ex·1.00 (se aleja MENOS: feedback)
      const azim = 2.9 + t * 0.22;                            // órbita LENTA, tranquila
      const elev = lerp(0.02, 0.28, land);
      return { pos: sph(dist, elev, azim), lookAt: [0, 0, 0], fov: lerp(38, 31, land) };
    },
  },
];

// Hueco de la nube según el momento. Normalmente pequeño (solo el núcleo). Al
// VIAJAR al núcleo, el hueco CRECE para vaciar el centro de electrones: así no
// se quema, el cúmulo de nucleones se ve limpio, y los electrones lejanos
// quedan como cielo estrellado alrededor.
function holeForTime(time: number, nucR: number, ex: number): number {
  void ex;
  const base = nucR * 0.9;
  const deep = nucR * 3.2;                            // limpia el entorno del cúmulo
  // Cold-open (0-1.3s): hueco PROFUNDO → el cúmulo de nucleones se ve limpio en
  // el golpe. 1.3-2.6s: la nube vuelve conforme la cámara hace pull-back.
  if (time < 1.3) return deep;
  if (time < 2.6) return lerp(deep, base, smoothstep((time - 1.3) / 1.3));
  if (time < 3.5) return base;
  if (time < 10.5) return lerp(base, deep, smoothstep((time - 3.5) / 6.0));
  if (time < 15.0) return deep;
  return lerp(deep, base, smoothstep((time - 15.0) / 2.0));
}

function findCut(time: number): { cut: CutSpec; localT: number; isCutBoundary: boolean } {
  for (const cut of CUTS) {
    // El regreso termina en RUN_DURATION (variable), no en su t1 placeholder.
    const t1 = cut.name === 'regreso' ? RUN_DURATION : cut.t1;
    if (time >= cut.t0 && time < t1) {
      const localT = (time - cut.t0) / (t1 - cut.t0);
      const isCutBoundary = (time - cut.t0) < 0.04;
      return { cut, localT, isCutBoundary };
    }
  }
  // After end → last cut at t=1
  const cut = CUTS[CUTS.length - 1];
  return { cut, localT: 1, isCutBoundary: false };
}

// Reveal de la NUBE — todas las capas visibles en el despertar (antes del viaje).
function shellRevealTime(idx: number, total: number): number {
  if (total <= 1) return 0.3;
  return 0.3 + (idx / Math.max(1, total - 1)) * 1.7;
}

// Cascada de ETIQUETAS — durante el regreso (15s → RUN_DURATION), una capa tras
// otra conforme la cámara sale. Se reparte sobre todo el regreso variable, así
// que termina justo antes del cierre sin importar cuántas capas haya.
function shellLabelTime(idx: number, total: number): number {
  // La etiqueta enciende cuando SU nube toma el escenario: mismo reloj que
  // `bandaMask`. Antes la cascada de nombres corría por su cuenta y podías estar
  // leyendo `3d⁷` mientras brillaba el `1s²`.
  return bandaWindow(idx, total)[0];
}

// ── Sample bundle ───────────────────────────────────────────────────
export interface AtomBundle {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  shellIdx: Float32Array;
  // `electrons` = los que REALMENTE se dibujan en esa subcapa. Importa en los 57 elementos
  // con pseudopotencial (Z≥37): ahí el core no existe y sumarlos NO da Z.
  shells: { label: string; n: number; l: number; color: THREE.Color; electrons?: number }[];
}

// `live` = laboratorio interactivo. Cambia SOLO dos cosas y las dos están medidas en la
// memoria lab-atomo-vista: la paleta segura en aditivo (la del video suma a blanco: azul+naranja
// = 255,255,255) y la modulación por densidad INVERTIDA (los puntos ya se muestrean ∝|ψ|², así
// que multiplicar tamaño y brillo por d otra vez pinta densidad² = confeti en el halo).
// Con `live=false` —o sea en TODO render de video— esta función es byte por byte la de antes.
export function buildAtomBundle(element: Element, live = false): AtomBundle {
  const tono = (n: number, l: number) => (live ? subshellColorLive(n, l) : subshellColor(n, l));
  const populated = populateAtom(element);
  const subshellGroups = new Map<string, { orbs: PopulatedOrbital[]; total: number; n: number; l: number }>();
  for (const o of populated) {
    const key = subshellLabel(o.n, o.l);
    const g = subshellGroups.get(key) ?? { orbs: [], total: 0, n: o.n, l: o.l };
    g.orbs.push(o);
    g.total += o.electrons;
    subshellGroups.set(key, g);
  }

  const shells = Array.from(subshellGroups.entries())
    .sort((a, b) => {
      const ga = a[1], gb = b[1];
      return ga.n !== gb.n ? ga.n - gb.n : ga.l - gb.l;
    })
    .map(([label, g]) => ({
      label, n: g.n, l: g.l,
      color: new THREE.Color(tono(g.n, g.l)),
      electrons: g.total,
    }));

  const totalElectrons = populated.reduce((s, o) => s + o.electrons, 0);
  // Puntos por electrón ADAPTATIVO. Menos muestras = menos solape aditivo = el
  // centro NO se lava a blanco y la FORMA del orbital (lóbulos, tréboles) se ve
  // nítida en vez de fundirse en una bola. Cap total ~70k para mar de color, no confeti.
  const spe = Math.min(SAMPLES_PER_ELECTRON, Math.max(3000, Math.floor(200000 / totalElectrons)));
  const totalPts = totalElectrons * spe;

  const positions = new Float32Array(totalPts * 3);
  const colors = new Float32Array(totalPts * 3);
  const sizes = new Float32Array(totalPts);
  const shellIdx = new Float32Array(totalPts);

  let cursor = 0;
  for (let si = 0; si < shells.length; si++) {
    const shellKey = shells[si].label;
    const baseColor = shells[si].color;
    const g = subshellGroups.get(shellKey)!;
    for (const orb of g.orbs) {
      const orbital = ORBITALS[orb.orbitalKey];
      if (!orbital) continue;
      const npts = orb.electrons * spe;
      const pts = sampleOrbital(orbital, npts, orb.Zeff, 42 + si * 17 + orb.n);
      // Color base SATURADO: en additive, el color = saturación (sumar brillo
      // lava a blanco). Empujamos la saturación y acotamos la luminancia para que
      // las capas conserven su color puro aun donde se solapan (mar de colores).
      const baseHSL = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(baseHSL);
      const richColor = new THREE.Color().setHSL(
        baseHSL.h, Math.min(1, baseHSL.s * 1.3), Math.min(0.60, baseHSL.l),
      );
      for (const p of pts) {
        positions[cursor * 3 + 0] = p.x;
        positions[cursor * 3 + 1] = p.y;
        positions[cursor * 3 + 2] = p.z;
        const tint = richColor.clone();
        // signo de ψ → matiz ligeramente distinto (los dos lóbulos de un p se
        // distinguen): comunica la fase real de la función de onda.
        if (p.sign < 0) tint.offsetHSL(0.06, 0.0, 0.0);
        // brillo PLANO (no dispara el additive): la densidad modula sutil, no quema.
        // En `live` la modulación va INVERTIDA (ver el comentario de buildAtomBundle y
        // bundleFromAbInitio): grande y tenue en el halo ralo, chico y sobrio en el core denso.
        const bright = live ? 0.42 - 0.12 * p.density : 0.70 + 0.20 * p.density;
        colors[cursor * 3 + 0] = tint.r * bright;
        colors[cursor * 3 + 1] = tint.g * bright;
        colors[cursor * 3 + 2] = tint.b * bright;
        // puntos más finos → estrellas nítidas, no glow gordo que se funde.
        sizes[cursor] = live ? 0.085 - 0.048 * p.density : 0.030 + 0.055 * p.density;
        shellIdx[cursor] = si;
        cursor++;
      }
    }
  }
  return {
    positions: positions.subarray(0, cursor * 3),
    colors: colors.subarray(0, cursor * 3),
    sizes: sizes.subarray(0, cursor),
    shellIdx: shellIdx.subarray(0, cursor),
    shells,
  };
}

function makeSpriteTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const POINTS_VERT = /* glsl */ `
uniform float uRevealMask[16];
uniform float uGlobalRot;
uniform float uTime;
uniform float uHoleR;
uniform float uCoreR;
uniform float uBright;
uniform float uBokeh;
// uPix = alto_del_framebuffer / 3840 (el alto del MASTER 4K vertical). Copiado de O2Cloud,
// el renderizador de los GANADORES (O2, N2, C2, agua v2). gl_PointSize esta en PIXELES:
// sin este factor el mismo electron ocupa el MISMO numero de pixeles a 760 px que a 3840,
// o sea que EN PROPORCION sale 5 veces mas chico en el laboratorio = confeti. En el 4K
// uPix=1 y el look queda identico al del video. Es la leccion de
// feedback_juzgar_a_resolucion_del_master: O2Cloud si la tenia, ElectronCloud nunca.
uniform float uPix;
// uPixGain = LA OTRA MITAD DE LA REGLA. uPix encoge el punto (bien: mata el quemado) pero el
// area del sprite cae con uPix^2 — a 760 px del lab eso es 11 veces menos luz por electron y
// la nube se lee como motas separadas. El canon dice "achicar -> SUBIR BRILLO"; esto es el
// brillo. Vale 1.0 en el render 4K (uPix=1) o sea que el VIDEO NO CAMBIA.
uniform float uPixGain;
// uBandScale = EL ENCUADRE POR BANDA. gl_PointSize va como aSize/distancia, y en el barrido
// la distancia es el radio de la BANDA (no el del átomo): entre el 1s y el 4s del cromo eso
// son dos ordenes de magnitud. Sin compensar, las bandas internas salian con puntos enormes
// (CONFETI medido: motas separadas llenando el cuadro) y las externas chocaban contra el
// piso de 1.2 px y se veian NEGRAS (media 1.07/255). Valiendo 3.2*r_banda/extent, el punto
// conserva EXACTAMENTE el tamano en pantalla que tiene en la vista del atomo completo, que
// es el del canon. Vale 1.0 fuera del barrido, o sea que nada mas cambia.
uniform float uBandScale;
// uSizeMask = COMPENSACION DE POBLACION EN EL TAMANO, por subcapa. El alfa no basta: subirlo
// satura los pocos puntos que hay pero la nube sigue siendo puntos sueltos sobre negro. Lo
// que le falta a una banda flaca es COBERTURA, y eso se compra con area. Medido en el cromo:
// el 4s tiene UN electron (8 300 puntos) contra los seis del 2p (50 000) y salia invisible.
uniform float uSizeMask[16];
uniform float uCoreFloor;
attribute vec3 aColor;
attribute float aSize;
attribute float aShellIdx;
varying vec3 vCol;
varying float vAlpha;
varying float vBokeh;

void main() {
  int idx = int(aShellIdx + 0.5);
  float reveal = uRevealMask[idx];
  vCol = aColor;

  // Hueco nuclear: no dibujar electrones dentro del radio del núcleo, para que
  // el cúmulo de nucleones quede limpio en el centro y las capas se vean AFUERA.
  if (length(position) < uHoleR) {
    vAlpha = 0.0; gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  // Fase única por electrón (hash de su posición de muestreo)
  float ph = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831853;

  // Rotación global de la nube
  float c = cos(uGlobalRot), s = sin(uGlobalRot);
  vec3 p = vec3(c * position.x + s * position.z, position.y, -s * position.x + c * position.z);

  // Movimiento cuántico: respiración radial + circulación tangencial.
  // La densidad PROMEDIO (|ψ|²) se conserva — esto comunica que el electrón
  // no es un punto fijo, sino una probabilidad viva. La circulación tangencial
  // es la corriente de probabilidad real de los orbitales con momento angular.
  float r = length(p) + 1e-4;
  vec3 radial = p / r;
  vec3 tang = normalize(vec3(-p.z, 0.0, p.x) + vec3(1e-4));
  // Movimiento SUTIL (la mitad que antes): respira y circula vivo, pero NO
  // difumina la forma del orbital. Los lóbulos-p, tréboles-d, formas-f quedan
  // nítidos. La circulación tangencial es la corriente de probabilidad real.
  float breath = sin(uTime * 1.4 + ph);
  float swirl  = sin(uTime * 0.9 + ph * 1.7);
  p += radial * (0.008 * r * breath) + tang * (0.010 * r * swirl);

  // Vida cuántica con PISO de presencia: cada electrón titila con su ritmo, pero
  // nunca desaparece del todo (piso 0.55) → la FORMA del orbital se ve siempre,
  // con un parpadeo (0.45) encima que comunica que es probabilidad viva, no punto.
  float u = fract(ph * 0.15915494);              // 0..1 por punto
  float rate = 0.5 + 0.8 * u;                    // ritmo distinto por electrón
  float life = fract(uTime * rate + u);          // ciclo de vida
  float flick = smoothstep(0.0, 0.25, life) * (1.0 - smoothstep(0.55, 1.0, life));
  float pulse = 0.55 + 0.45 * flick;
  // Atenuación SUAVE del corazón: el core hiperdenso (1s/2s) acumula additive y
  // se quema a blanco. Bajamos su alfa gradualmente (no corte duro) → el centro
  // deja de reventar y las capas externas con FORMA (p,d,f) lucen su color. El
  // core esférico no tiene forma interesante, así que no se pierde nada bello.
  // uCoreFloor = 0.16 en el VIDEO (el valor de siempre). En el lab baja en proporcion a
  // uPixGain: la ganancia por resolucion es para el HALO, que perdio area; el corazon ya
  // estaba en su punto y multiplicarlo por 3.4 lo devuelve a blanco quemado (medido: 0.22 %
  // de pixeles reventados y 4.3 % lavados en el carbono cuando la ganancia lo tocaba).
  float coreAtten = uCoreR > 0.0001
    ? mix(uCoreFloor, 1.0, smoothstep(0.0, uCoreR, length(position)))
    : 1.0;
  vAlpha = reveal * pulse * uBright * coreAtten * uPixGain;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // BOKEH (profundidad de campo) — solo cuando uBokeh>0 (moléculas, cámara
  // acotada). Foco en el centro de la nube (origen); los puntos lejos del plano
  // de foco se vuelven discos suaves y tenues = lente real. En átomos uBokeh=0.
  float focusDepth = -(modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
  float coc = uBokeh > 0.0001 ? clamp(abs(-mv.z - focusDepth) * uBokeh - 0.12, 0.0, 1.0) : 0.0;
  vBokeh = coc;
  float spread = 1.0 + coc * 4.0;
  float maxSz = (uBokeh > 0.0001 ? 58.0 : 22.0) * uPix;
  gl_PointSize = clamp(aSize * uBandScale * uSizeMask[idx] * 520.0 * (0.7 + 0.5 * pulse) / -mv.z * spread * uPix, 1.2, maxSz);
}
`;
const POINTS_FRAG = /* glsl */ `
uniform sampler2D uSprite;
varying vec3 vCol;
varying float vAlpha;
varying float vBokeh;
void main() {
  vec2 uv = gl_PointCoord;
  // ⚠ RECORTE CIRCULAR — ESTO ES LO QUE HACÍA "CUBOS" (Ian, 2026-07-31: "ESTOY VIENDO
  // LITERALMENTE CUBOS"). Este shader era el ÚNICO del archivo que no lo tenía: confiaba en
  // que el sprite se apagara solo en las esquinas. En aditivo eso no alcanza — si en la
  // esquina queda medio por ciento de alfa y ahí se encinan diez mil puntos, ese medio por
  // ciento se SUMA hasta hacerse visible, y lo que se ve es el CONTORNO CUADRADO de la
  // textura. Por eso salía en Ne, Mg, Al, Si, S, Cl, Ar, Ca, Ti, Cr, Fe, Cu, Zn, Br, Kr —
  // los de core denso— y no en H o Li, cuya nube difusa nunca satura.
  // El resto de los shaders de puntos de este archivo ya hacen exactamente esto.
  vec2 d = uv - 0.5;
  if (dot(d, d) > 0.25) discard;
  vec4 t = texture2D(uSprite, uv);
  float a = t.a * vAlpha;
  // bokeh: el disco desenfocado reparte su energía → más tenue y plano
  a *= mix(1.0, 0.32, vBokeh);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol, a);
}
`;

// Exponente de la compensacion de brillo por resolucion (solo live). 1.0 = calibrado a ojo y
// medido; `?pk=` lo barre sin recompilar (0 = apagado, 2 = compensacion total del area).
function pixGainExp(): number {
  if (typeof window === 'undefined') return 1;
  const v = parseFloat(new URLSearchParams(window.location.search).get('pk') || '');
  return Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 1;
}

export function ElectronCloud({ bundle, time, holeRadius = 0, coreRadius = 0, brightness = 1, bokeh = 0, rotRate = 0.55, revealAll = false, live = false, bandScale = 1 }: { bundle: AtomBundle; time: number; holeRadius?: number; coreRadius?: number; brightness?: number; bokeh?: number; rotRate?: number; revealAll?: boolean; live?: boolean; bandScale?: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const sprite = useMemo(() => makeSpriteTexture(), []);
  const { gl } = useThree();          // para leer el alto REAL del framebuffer (uPix)
  const pk = useMemo(() => (live ? pixGainExp() : 0), [live]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(bundle.positions, 3));
    g.setAttribute('aColor',   new THREE.BufferAttribute(bundle.colors,    3));
    g.setAttribute('aSize',    new THREE.BufferAttribute(bundle.sizes,     1));
    g.setAttribute('aShellIdx',new THREE.BufferAttribute(bundle.shellIdx,  1));
    return g;
  }, [bundle]);

  const uniforms = useMemo(() => ({
    uSprite:     { value: sprite },
    uRevealMask: { value: new Float32Array(16) },
    uGlobalRot:  { value: 0 },
    uTime:       { value: 0 },
    uHoleR:      { value: 0 },
    uCoreR:      { value: 0 },
    uPix:        { value: 1 },
    uPixGain:    { value: 1 },
    uBandScale:  { value: 1 },
    uSizeMask:   { value: new Float32Array(16).fill(1) },
    uCoreFloor:  { value: 0.16 },
    uBright:     { value: 1 },
    uBokeh:      { value: 0 },
  }), [sprite]);

  // Banda más poblada del átomo: la referencia contra la que se compensan las flacas.
  const eMax = useMemo(
    () => bundle.shells.reduce((m, s) => Math.max(m, s.electrons ?? 1), 1),
    [bundle],
  );
  useEffect(() => {
    if (!matRef.current) return;
    const mask = matRef.current.uniforms.uRevealMask.value as Float32Array;
    const smask = matRef.current.uniforms.uSizeMask.value as Float32Array;
    // El área del sprite crece con el CUADRADO del tamaño, así que para recuperar un factor
    // `p` de cobertura basta con √p en el radio. Solo se aplica a la banda EN TURNO y solo
    // dentro del barrido: fuera de él vale 1 y el átomo se ve exactamente como siempre.
    const fase = bundle.shells.length > 0 ? bandaFase(time, bundle.shells.length) : null;
    for (let i = 0; i < 16; i++) {
      if (i >= bundle.shells.length) { mask[i] = 0; smask[i] = 1; continue; }
      const mia = revealAll || fase === null
        ? 0 : win(time, ...bandaWindow(i, bundle.shells.length), 0.45);
      const p = Math.min(4.0, eMax / Math.max(1, bundle.shells[i].electrons ?? 1));
      smask[i] = 1 + (Math.sqrt(p) - 1) * mia;
      // revealAll: nube COMPLETA desde t=0 (átomos que ya existen, p.ej. los dos O
      // que se acercan a formar O₂ — no deben "materializarse" capa por capa).
      mask[i] = revealAll ? 1
        : bandaMask(time, i, bundle.shells.length, bundle.shells[i].electrons ?? 1, eMax);
    }
    // rotRate=0 en moléculas (la nube debe quedar alineada con los núcleos; la
    // cámara orbita). En átomos gira para dar vida al cúmulo.
    matRef.current.uniforms.uGlobalRot.value = time * rotRate;
    matRef.current.uniforms.uTime.value = time;
    matRef.current.uniforms.uHoleR.value = holeRadius;
    matRef.current.uniforms.uCoreR.value = coreRadius;
    // uPix se mide del framebuffer REAL en cada cuadro: el lab corre a ~760-1200 px y el
    // render 4K a 3840. Sin esto el mismo átomo se ve con puntos 5× más chicos en el lab.
    const px = Math.max(0.28, gl.domElement.height / 3840);
    matRef.current.uniforms.uPix.value = px;
    // ACHICAR → SUBIR BRILLO: el area del sprite cae con px^2, así que el brillo sube con
    // px^-pk. pk=0 (video, y cualquier consumidor que no pida live) deja la ganancia en 1
    // EXACTO — el render 4K ni se entera de que este uniform existe.
    const gain = pk > 0 ? Math.min(4, Math.pow(px, -pk)) : 1;
    matRef.current.uniforms.uPixGain.value = gain;
    matRef.current.uniforms.uCoreFloor.value = 0.16 / gain;   // gain=1 (video) ⇒ 0.16 EXACTO
    matRef.current.uniforms.uBright.value = brightness;
    matRef.current.uniforms.uBandScale.value = bandScale;
    matRef.current.uniforms.uBokeh.value = bokeh;
    matRef.current.uniformsNeedUpdate = true;
  }, [time, bundle, holeRadius, coreRadius, brightness, bokeh, rotRate, revealAll, pk, eMax, bandScale]);

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={POINTS_VERT}
        fragmentShader={POINTS_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Núcleo como cúmulo de nucleones reales: protones (rojos) + neutrones (gris-azul).
// En close-up se distinguen; en wide se funden en un punto brillante (bloom).
function nucleonField(protons: number, neutrons: number, Rc: number) {
  const total = Math.max(1, protons + neutrons);
  let s = (Math.imul(total, 2654435761) >>> 0) || 1;
  const rnd = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // cúmulo DENSO de nucleones PEQUEÑOS — grano fino (más realista, como un
  // núcleo real de muchos nucleones diminutos), con ligero traslape para que
  // se funda en masa y no se vean como bolas grandes separadas.
  const rn = (Rc / Math.cbrt(total)) * (total <= 2 ? 0.95 : 1.05);
  const inner = Math.max(0, Rc - rn * 0.30);
  const types: number[] = [];
  for (let i = 0; i < protons; i++) types.push(1);
  for (let i = 0; i < neutrons; i++) types.push(0);
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  const pos: Vec3[] = [];
  // UN solo nucleón (hidrógeno) = el núcleo ES ese nucleón: va EXACTO en el origen.
  // Sembrarlo al azar dentro del cúmulo lo dejaba hasta `inner` (0.039 bohr con Rc=0.055)
  // fuera del centro, y en "La ley de Gauss" eso se vio feo: las líneas de campo, que SÍ
  // nacen en el origen, convergían visiblemente abajo-a-la-izquierda del protón (medido en
  // un crop 1:1 a 4K). Con un nucleón no hay cúmulo que distribuir.
  if (total === 1) { pos.push([0, 0, 0]); return { total, pos, types, rn }; }
  for (let i = 0; i < total; i++) {
    let x = 0, y = 0, z = 0, d2 = 2;
    while (d2 > 1 || d2 < 1e-4) { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; d2 = x * x + y * y + z * z; }
    const rr = Math.cbrt(rnd()) * inner, inv = rr / Math.sqrt(d2);
    pos.push([x * inv, y * inv, z * inv]);
  }
  return { total, pos, types, rn };
}

// Shader de nucleón — NO meshStandard (eso eran caramelos glow). Densidad de
// estrella de neutrones (fresnel que sangra luz HDR por los bordes) + tensión
// de fuerza fuerte (micro-vibración por nucleón) + pulso de energía contenida.
const NUCLEON_VERT = /* glsl */ `
uniform float uTime;
uniform float uVib;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
varying float vPh;
void main() {
  #ifdef USE_INSTANCING
    mat4 im = instanceMatrix;
  #else
    mat4 im = mat4(1.0);
  #endif
  vec3 center = im[3].xyz;
  // fase única por nucleón (hash de su posición en el cúmulo)
  float ph = fract(sin(dot(center, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831853;
  vPh = ph;
  vObj = normalize(position);                  // dirección de superficie (para turbulencia)
  // micro-vibración VIOLENTA: la fuerza fuerte amarra a los nucleones, tiemblan
  // unidos a alta frecuencia. Amplitud en espacio unidad → escala con rn.
  vec3 vib = vec3(
    sin(uTime * 33.0 + ph),
    cos(uTime * 29.0 + ph * 1.3),
    sin(uTime * 37.0 + ph * 0.7)
  ) * uVib;
  vec4 mvPosition = modelViewMatrix * im * vec4(position + vib, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;
// Diseño MOLTEN/SALVAJE: superficie de metal fundido / plasma que FLUYE
// (turbulencia, no esfera lisa) — valles oscuros, crestas blancas-incandescentes
// que sangran luz. Iridiscencia como TORNASOL en el borde (no domina). Specular
// PULIDO agudo. Pulso + crepitar violento. La fuerza más salvaje del universo.
const NUCLEON_FRAG = /* glsl */ `
uniform vec3 uHot;        // color incandescente (oro fundido / plasma)
uniform float uHueBase;   // sesgo de matiz de la iridiscencia (cálido vs frío)
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
varying float vPh;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  float ndv = max(dot(N, V), 0.0);
  float fres = pow(1.0 - ndv, 1.7);

  // TURBULENCIA — superficie molten que fluye. Capas de seno sobre la posición
  // de superficie + tiempo = crestas calientes y valles oscuros (vPh decorrela
  // cada nucleón). NO una esfera lisa de videojuego.
  vec3 q = vObj * 5.0 + vec3(vPh) + vec3(0.0, uTime * 0.35, 0.0);
  float tt = sin(q.x * 1.7 + q.y) + sin(q.y * 1.3 - q.z * 1.1) + sin(q.z * 1.9 + q.x * 0.7);
  float turb = pow(clamp(tt / 3.0 * 0.5 + 0.5, 0.0, 1.0), 1.4);

  // base MOLTEN — incandescente profundo modulado por turbulencia
  vec3 col = uHot * mix(0.18, 1.25, turb);

  // grietas INCANDESCENTES — las crestas más calientes sangran luz blanca
  col += uHot * smoothstep(0.72, 1.0, turb) * 1.4;

  // iridiscencia como TORNASOL en el borde (sheen, intenso pero no domina)
  float band = fres * 2.4 + uHueBase + vPh * 0.1;
  vec3 iri = 0.5 + 0.5 * cos(6.2831853 * (band + vec3(0.0, 0.33, 0.67)));
  col += pow(iri, vec3(0.6)) * fres * 1.3;

  // PULIDO — specular agudo (superficie reflejante, no mate)
  vec3 L = normalize(vec3(0.4, 0.6, 0.75));
  vec3 H = normalize(V + L);
  col += vec3(2.0, 1.95, 1.9) * pow(max(dot(N, H), 0.0), 120.0);

  // VIOLENCIA — pulso lento + crepitar de alta frecuencia
  float pulse = 0.82 + 0.18 * sin(uTime * 3.0 + vPh)
                     + 0.12 * sin(uTime * 21.0 + vPh * 2.3);
  col *= pulse;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function Nucleus({ protons, neutrons, time, clusterRadius = 0.1, pHot, pHue, nHot, nHue }: { protons: number; neutrons: number; time: number; clusterRadius?: number; pHot?: [number, number, number]; pHue?: number; nHot?: [number, number, number]; nHue?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const pRef = useRef<THREE.InstancedMesh>(null);
  const nRef = useRef<THREE.InstancedMesh>(null);
  const pMat = useRef<THREE.ShaderMaterial>(null);
  const nMat = useRef<THREE.ShaderMaterial>(null);
  const field = useMemo(() => nucleonField(protons, neutrons, clusterRadius), [protons, neutrons, clusterRadius]);
  // posiciones separadas por tipo → un instancedMesh por color (robusto, sin instanceColor)
  const split = useMemo(() => {
    const pPos: Vec3[] = [], nPos: Vec3[] = [];
    field.pos.forEach((p, i) => (field.types[i] ? pPos : nPos).push(p));
    return { pPos, nPos };
  }, [field]);

  // uniforms ESTABLES (ver feedback_r3f_stable_uniforms). Iridiscencia + núcleo
  // incandescente. Protón = sesgo cálido (oro-magenta), neutrón = sesgo frío
  // (cian-violeta). Distinguibles, pero NUNCA el rojo/azul plano de siempre.
  // Defaults = look aprobado de la serie de átomos. Los videos de ENLACE (Li₂/Be₂)
  // pasan un neutrón AZUL-HIELO tenue (nHot bajo, sin rojo) para que el núcleo CHICO
  // NO bloomee a estrella magenta ("punto morado") y dominen los protones dorados.
  const pc = pHot ?? [2.4, 1.05, 0.28];                   // ORO FUNDIDO (protón)
  const nc = nHot ?? [0.95, 0.65, 2.6];                   // PLASMA violeta-azul (neutrón)
  const pUniforms = useMemo(() => ({
    uTime: { value: 0 }, uVib: { value: 0.07 },
    uHot: { value: new THREE.Color(pc[0], pc[1], pc[2]) },
    uHueBase: { value: pHue ?? 0.04 },                    // tornasol oro-magenta
  }), [pc[0], pc[1], pc[2], pHue]);
  const nUniforms = useMemo(() => ({
    uTime: { value: 0 }, uVib: { value: 0.07 },
    uHot: { value: new THREE.Color(nc[0], nc[1], nc[2]) },
    uHueBase: { value: nHue ?? 0.46 },                    // tornasol cian-violeta
  }), [nc[0], nc[1], nc[2], nHue]);

  useEffect(() => {
    const m = new THREE.Matrix4();
    const fill = (mesh: THREE.InstancedMesh | null, pts: Vec3[]) => {
      if (!mesh) return;
      for (let i = 0; i < pts.length; i++) {
        m.makeScale(field.rn, field.rn, field.rn);
        m.setPosition(pts[i][0], pts[i][1], pts[i][2]);
        mesh.setMatrixAt(i, m);
      }
      mesh.count = pts.length;
      mesh.instanceMatrix.needsUpdate = true;
    };
    fill(pRef.current, split.pPos);
    fill(nRef.current, split.nPos);
  }, [split, field.rn]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.5;
      groupRef.current.rotation.x = time * 0.22;
      // Cold-open: el núcleo está LLENO desde el frame 0 (el money-shot abre la
      // escena, no nace despacio). +0.5 → smoothstep(1)=1 en t=0.
      groupRef.current.scale.setScalar(smoothstep((time + 0.5) / 0.5));
    }
    if (pMat.current) pMat.current.uniforms.uTime.value = time;
    if (nMat.current) nMat.current.uniforms.uTime.value = time;
  }, [time]);

  return (
    <group ref={groupRef}>
      <instancedMesh ref={pRef} frustumCulled={false} args={[undefined as never, undefined as never, Math.max(1, split.pPos.length)]}>
        <sphereGeometry args={[1, 24, 24]} />
        <shaderMaterial ref={pMat} uniforms={pUniforms} vertexShader={NUCLEON_VERT} fragmentShader={NUCLEON_FRAG} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={nRef} frustumCulled={false} args={[undefined as never, undefined as never, Math.max(1, split.nPos.length)]}>
        <sphereGeometry args={[1, 24, 24]} />
        <shaderMaterial ref={nMat} uniforms={nUniforms} vertexShader={NUCLEON_VERT} fragmentShader={NUCLEON_FRAG} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// Variación de trayectoria por elemento — PREPARADO, off por default (tv=0).
// Activar pasando ?tv=0.3 en la URL: cada Z obtiene un giro orbital + distancia
// ligeramente distintos (determinista), para que los 50 no se muevan idénticos.
// Con tv=0 el resultado es EXACTAMENTE el de los CUTS originales (no-op).
function trajectoryOffset(seed: number, tv: number): { dAzim: number; dElev: number; dDist: number } {
  if (tv <= 0) return { dAzim: 0, dElev: 0, dDist: 1 };
  let s = (Math.imul(seed || 1, 2654435761)) >>> 0;
  const rnd = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    dAzim: (rnd() - 0.5) * tv * 2.6,   // ±azimut amplio: cada átomo orbita distinto
    dElev: (rnd() - 0.5) * tv * 1.3,   // ±elevación: unos desde arriba, otros abajo
    dDist: 1 + (rnd() - 0.5) * tv * 0.30,
  };
}

export function CameraRig({ extent, time, vertical, tv, seed, shellR }: {
  extent: number; time: number; vertical: boolean; tv: number; seed: number;
  shellR?: Float32Array | null;
}) {
  const { camera } = useThree();
  useEffect(() => {
    const { cut, localT } = findCut(time);
    // Durante el barrido de bandas la cámara vive a la ESCALA DE LA BANDA en turno
    // (ver bandaRadio). Fuera del barrido, el extent del átomo completo de siempre.
    // El piso va en radios del cúmulo de nucleones (nucR = extent·0.0010): 14× deja al
    // núcleo como una perla dentro de la banda, no como una pared.
    const rb = cut.name === 'regreso' && shellR ? bandaRadio(time, shellR, extent * 0.014) : null;
    // CÁMARA PROPIA DEL BARRIDO — no puede heredar la curva de `regreso`.
    // `regreso` arranca PEGADO al núcleo y se abre con pow(143, land); su `land` no llega
    // a 1 hasta ~3 s después de que empieza el barrido, así que las primeras bandas se
    // encuadraban al 3.4 % de su distancia y la cámara terminaba DENTRO del cúmulo de
    // nucleones (medido: cuadro de burbujas naranjas al 90 % de píxeles encendidos).
    // Aquí la distancia es exactamente el radio de la banda × encuadre, y la órbita es
    // lenta para leer la forma.
    const { pos, fov, lookAt } = rb !== null
      ? { pos: sph(rb * BANDA_ENCUADRE, 0.26, 2.9 + time * 0.17), fov: 34, lookAt: undefined }
      : cut.cam(localT, extent);

    // Perturbación de trayectoria (no-op si tv=0)
    const off = trajectoryOffset(seed, tv);
    let px = pos[0] * off.dDist, py = pos[1] * off.dDist, pz = pos[2] * off.dDist;
    if (off.dAzim !== 0) {
      const ca = Math.cos(off.dAzim), sa = Math.sin(off.dAzim);
      const rx = ca * px + sa * pz, rz = -sa * px + ca * pz;
      px = rx; pz = rz;
    }
    if (off.dElev !== 0) py += off.dElev * Math.hypot(px, pz);
    camera.position.set(px, py, pz);

    let la = lookAt ?? [0, 0, 0];
    // En vertical, los off-center horizontales (regla de tercios de 16:9) dejan
    // el átomo pegado a un lado con mucho vacío. Centramos en X/Z, suavizamos Y.
    if (vertical) la = [0, la[1] * 0.5, 0];
    camera.lookAt(la[0], la[1], la[2]);
    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      const cam = camera as THREE.PerspectiveCamera;
      // FOV de three es vertical; en 9:16 el frame angosto recortaría el átomo
      // por los lados, así que ampliamos el campo para que respire y componga.
      cam.fov = vertical ? fov * 1.42 : fov;
      // near/far DINÁMICOS: el viaje al núcleo llega a distancias minúsculas;
      // sin esto la cámara recortaría todo. near sigue a la distancia actual.
      const d = Math.hypot(px, py, pz);
      cam.near = Math.max(1e-4, d * 0.02);
      cam.far = Math.max(200, extent * 30);
      cam.updateProjectionMatrix();
    }
  }, [time, extent, camera, vertical, tv, seed, shellR]);
  return null;
}

export function FrameDriver({ time }: { time: number }) {
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [time, invalidate]);
  return null;
}

export function DynamicPostFX({ time, live = false }: { time: number; live?: boolean }) {
  // Resolve cut-driven postFX params for current time
  const { cut, isCutBoundary } = findCut(time);
  const bloomIntensity = cut.bloom;
  const vignetteDark = cut.vignette;
  // Chromatic aberration: on cut boundary OR if cut.chroma is true
  const chromaOn = isCutBoundary || (cut.chroma ?? false);
  const chromaOffset: [number, number] = chromaOn ? [0.0025, 0.0025] : [0.0, 0.0];

  // aberración cromática: leve CONSTANTE (lente real, más fuerte en bordes) +
  // golpe en los cortes. La modulación radial la hace sentir como vidrio real.
  const caBase = chromaOn ? 0.0026 : 0.0010;

  // En live (lab, GPUs diversas) MSAA=0: el combo multisampling + render target
  // HDR-float es lo MENOS soportado entre GPUs/drivers (Intel, ANGLE, software) y
  // suele reventar el postFX a blanco aunque la GPU de dev lo renderee bien. El
  // render headless 4K (live=false) conserva MSAA=4. frameBufferType explícito =
  // HDR consistente (no depender de la auto-detección).
  return (
    <EffectComposer multisampling={live ? 0 : 4} frameBufferType={THREE.HalfFloatType}>
      <Bloom
        intensity={bloomIntensity * 0.95}
        luminanceThreshold={0.38}
        luminanceSmoothing={0.30}
        radius={0.72}
        mipmapBlur
      />
      {/* Tonemap filmico ACES — las altas luces (núcleo molten, estrellas densas)
          ruedan a dorado/blanco como película, en vez de recortar planas. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* Grado de color: curva-S de contraste + saturación RICA (mar de colores,
          no confeti lavado). La saturación alta saca el color puro de cada capa. */}
      <BrightnessContrast brightness={-0.02} contrast={0.18} />
      <HueSaturation saturation={0.24} />
      <ChromaticAberration
        offset={new THREE.Vector2(caBase, caBase)}
        radialModulation
        modulationOffset={0.35}
      />
      {/* Grano de película — textura orgánica, no render clínico. */}
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.06} />
      <Vignette eskil={false} offset={0.20} darkness={vignetteDark} />
    </EffectComposer>
  );
}

// ── Cinematic letterbox (CSS overlay) ───────────────────────────────
export function Letterbox({ vertical, pct }: { vertical: boolean; pct?: number }) {
  // Horizontal → cinemascope 2.39:1 (barras ~12.8%).
  // Vertical (reel 9:16) → barras delgadas tipo cine (~5%), no comen el frame.
  // `pct` sobreescribe el porcentaje: la serie de enlaces en 16:9 lo usa para NO
  // comerse el cuadro (CLAUDE.md: cero letterbox 2.39:1 en el entregable).
  const pctH = pct ?? (vertical ? 5.0 : ((1 - (16 / 9) / 2.39) / 2) * 100);
  return (
    <>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: `${pctH}%`, background: '#000',
        pointerEvents: 'none', zIndex: 10,
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: `${pctH}%`, background: '#000',
        pointerEvents: 'none', zIndex: 10,
      }} />
    </>
  );
}

// ── Vignette overlay (CSS) — refuerzo cinematográfico, fotografía espacial ──
export function CinemaVignette() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9,
      background:
        'radial-gradient(ellipse 75% 65% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
    }} />
  );
}

// ── Atom title overlay (name + Z + shell config) ────────────────────
const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
function fmtShellLabel(lbl: string): string {
  return lbl.replace(/(\d+)$/, (_, d: string) =>
    d.split('').map((c: string) => SUPERSCRIPTS[c] ?? c).join(''));
}

// ¿De dónde salió cada elemento? Origen por nucleosíntesis REAL (español mexicano).
// Clasificación astrofísica por Z: Big Bang → rayos cósmicos → estrellas →
// supernovas → choques de estrellas de neutrones. Aparece arriba en TODOS.
function originPhrase(Z: number): string {
  // Sintéticos — no existen (o casi nada) en la naturaleza; los hicimos nosotros
  if (Z === 43) return 'El primer elemento que crearon los humanos.';          // Tecnecio
  if (Z === 61) return 'Casi no existes en la naturaleza; te hicimos nosotros.'; // Prometio
  if (Z >= 93) return 'No existías en la Tierra: te crearon los humanos.';      // transuránicos
  // Big Bang
  if (Z === 1) return 'Naciste en el Big Bang.';
  if (Z === 2) return 'Del Big Bang, hace 13.8 mil millones de años.';
  // Rayos cósmicos (espalación)
  if (Z <= 5) return 'Te forjaron los rayos cósmicos.';
  // Estrellas pequeñas al morir
  if (Z <= 7) return 'Saliste de estrellas pequeñas al morir.';
  // Estrellas gigantes (fusión hasta el calcio)
  if (Z <= 20) return 'Te cocinaron las estrellas gigantes.';
  // Supernovas — pico del hierro
  if (Z <= 30) return 'Naciste en el fuego de una supernova.';
  // Proceso-s — estrellas moribundas capturando neutrones, una a una
  if (Z <= 51) return 'Te tejieron estrellas moribundas, neutrón a neutrón.';
  // Mezcla supernova + choques de estrellas de neutrones
  if (Z <= 82) return 'De supernovas y choques de estrellas de neutrones.';
  // Proceso-r puro — lo más pesado que la naturaleza forja
  return 'De choques de estrellas de neutrones.';
}

// Factor de escala REAL: cuántas veces más pequeño es el núcleo que el átomo.
// radio nuclear ≈ 1.2·A^(1/3) fm · radio atómico en pm (1 pm = 1000 fm).
function realScaleFactor(element: Element): number {
  const A = Math.max(1, Math.round(element.mass));
  const rNuc = 1.2 * Math.cbrt(A);                       // fm
  const rAtom = element.atomicRadius ?? element.covalentRadius ?? 100; // pm
  return Math.round((rAtom * 1000 / rNuc) / 1000) * 1000; // redondeo a miles
}

// Nota de escala — aparece durante el viaje al núcleo. Deja CLARO que es una
// representación y enseña el factor real (el núcleo es ~25 000× más chico).
function ScaleNote({ element, time, vertical }: { element: Element; time: number; vertical: boolean }) {
  const opacity = smoothstep((time - 11.5) / 0.9) * Math.min(1, Math.max(0, (14.5 - time) / 0.7));
  if (opacity < 0.01) return null;
  const f = realScaleFactor(element).toLocaleString('es-MX');
  return (
    <div style={{
      position: 'absolute', top: vertical ? '20%' : '20%', left: '8%', right: '8%',
      zIndex: 11, pointerEvents: 'none', opacity, textAlign: 'center',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: vertical ? '3vw' : '1.1vw', fontWeight: 400,
      color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em',
      textShadow: '0 2px 16px rgba(0,0,0,0.9)',
    }}>
      representación · en realidad el núcleo es {f}× más pequeño
    </div>
  );
}

function DatoCurioso({ element, time, vertical }: {
  element: Element; time: number; vertical: boolean;
}) {
  const fact = originPhrase(element.Z);
  if (!fact) return null;
  // Aparece en la MIRADA desde el núcleo (10.5-15) — ventana contemplativa
  const fi = smoothstep((time - 11.0) / 1.0);
  const fo = Math.min(1, Math.max(0, (14.7 - time) / 0.8));
  const opacity = fi * fo;
  if (opacity < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', top: vertical ? '13%' : '12%',
      left: '8%', right: '8%', zIndex: 11, pointerEvents: 'none',
      opacity, textAlign: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontWeight: 300, color: 'rgba(255,255,255,0.92)',
      fontSize: vertical ? '5vw' : '1.9vw',
      lineHeight: 1.25, letterSpacing: '-0.01em',
      textShadow: '0 2px 30px rgba(0,0,0,0.9)',
    }}>
      {fact}
    </div>
  );
}

function AtomTitle({ element, shells, time, vertical }: {
  element: Element;
  shells: { label: string; n: number; l: number }[];
  time: number;
  vertical: boolean;
}) {
  const fadeIn = Math.min(1, Math.max(0, (time - 2.0) / 0.9));
  const opacity = fadeIn;
  if (opacity < 0.01) return null;

  // Tamaños en vw → escalan idénticos en 1080×1920 y 2160×3840.
  const nameSize  = vertical ? '11vw'  : '3.1vw';
  const subSize   = vertical ? '3.4vw' : '0.85vw';
  const shellSize = vertical ? '4.2vw' : '1.0vw';

  return (
    <div style={{
      position: 'absolute', bottom: vertical ? '14%' : '16%', left: '7%',
      zIndex: 11, pointerEvents: 'none', opacity,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        fontSize: nameSize, fontWeight: 200, color: '#fff',
        letterSpacing: '-0.03em', lineHeight: 1,
        textShadow: '0 4px 40px rgba(0,0,0,0.85)',
      }}>
        {element.name}
      </div>
      <div style={{
        fontSize: subSize, fontWeight: 400, color: 'rgba(255,255,255,0.55)',
        letterSpacing: '0.15em', marginTop: vertical ? '1.2vw' : 12,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      }}>
        {element.symbol} · Z={element.Z}
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: vertical ? '2.2vw' : 20, alignItems: 'center',
        marginTop: vertical ? '2.4vw' : 22, maxWidth: vertical ? '86vw' : '70vw',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: shellSize, fontWeight: 500, letterSpacing: '0.05em',
      }}>
        {shells.map((sh, i) => {
          const revealAt = shellLabelTime(i, shells.length);
          const shOpacity = smoothstep((time - revealAt) / 0.7);
          if (shOpacity < 0.01) return null;
          const hex = subshellColor(sh.n, sh.l);
          // La banda EN TURNO se agranda y brilla; las ya vistas se quedan de testigo
          // a media luz. Es el mismo `mia` que gobierna su nube, así que el nombre y
          // la forma laten juntos — sin eso el ojo no sabe cuál de las dos está leyendo.
          const mia = win(time, ...bandaWindow(i, shells.length), 0.45);
          return (
            <span key={sh.label} style={{
              opacity: shOpacity * (0.42 + 0.58 * mia),
              color: hex,
              transform: `scale(${1 + 0.22 * mia})`,
              display: 'inline-block',
              textShadow: `0 0 ${28 + 26 * mia}px ${hex}${mia > 0.5 ? 'dd' : '99'}, 0 2px 12px rgba(0,0,0,0.85)`,
            }}>
              {fmtShellLabel(sh.label)}
            </span>
          );
        })}
      </div>
    </div>
  );
}


// ── FÍSICA VISIBLE: campo E, campo B, radioactividad ────────────────
// El usuario lo pidió: que se SIENTA la física. Cada capa es real y va gated al
// momento de la MIRADA al núcleo (t≈10.5-15) para que se lea sin saturar el wide.

// Electrones desapareados por regla de Hund → momento magnético del átomo.
// Subcapa con e electrones y m=2l+1 orbitales: llena de a uno (Hund) primero.
function unpairedElectrons(element: Element): number {
  let u = 0;
  for (const s of element.config) {
    const m = 2 * s.l + 1;
    u += s.electrons <= m ? s.electrons : 2 * m - s.electrons;
  }
  return u;
}
// Isótopo inestable: Tecnecio, Prometio, y todo Z≥84 (Po en adelante).
function isRadioactive(Z: number): boolean {
  return Z === 43 || Z === 61 || Z >= 84;
}

// Ventana de opacidad para el campo ELÉCTRICO (correcto en el núcleo: Coulomb +Ze).
// Entra en la mirada al núcleo, sale antes de la contemplación.
function physOpacity(time: number): number {
  return smoothstep((time - 10.3) / 1.0) * Math.min(1, Math.max(0, (14.6 - time) / 0.9));
}
// Ventana del campo MAGNÉTICO — distinta del E. El magnetismo del átomo es
// ELECTRÓNICO (e⁻ desapareados), NO nuclear, así que se muestra en la
// CONTEMPLACIÓN (cámara lejos, a escala atómica envolviendo la nube), NO encima
// del núcleo donde leería como nuclear y chocaría. Sale a ~RUN_DURATION-1.2.
function bFieldOpacity(time: number): number {
  // El campo entra DESPUÉS del barrido de bandas (que ahora dura lo que tenga que
  // durar: 3 subcapas en el C, 14 en el Gd), para que no compitan. Antes el 17.3
  // estaba QUEMADO y en un átomo pesado el dipolo aparecía encima de la banda 4.
  const t0 = RUN_DURATION - BANDA_COLA;
  return smoothstep((time - t0) / 0.7) * Math.min(1, Math.max(0, (RUN_DURATION - 0.7 - time) / 0.7));
}

// CAMPO ELÉCTRICO — el núcleo tiene carga +Ze. Líneas de campo radiales (Coulomb,
// E∝Z/r²) saliendo del núcleo: el "erizo" de Faraday. Brillan y respiran.
const EFIELD_VERT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uBright;
attribute float aSeed;
attribute float aAlong;
varying float vA;
varying float vR;
void main() {
  // pulso viajando hacia afuera por la línea (la "tensión" del campo saliendo)
  float wave = sin(aAlong * 12.0 - uTime * 4.0 + aSeed * 6.28);
  vA = uBright * uOpacity * (0.35 + 0.65 * smoothstep(0.2, 1.0, wave)) * (1.0 - aAlong * 0.35);
  vR = aAlong;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const EFIELD_FRAG = /* glsl */ `
varying float vA;
varying float vR;
void main() {
  // ámbar→blanco cálido (campo eléctrico = energía); discard al final de la línea
  vec3 col = mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.95, 0.8), vR);
  gl_FragColor = vec4(col, vA);
}`;

function ElectricField({ Z, time, radius }: { Z: number; time: number; radius: number }) {
  const op = physOpacity(time);
  const { geo } = useMemo(() => {
    // erizo de líneas radiales (direcciones de Fibonacci en la esfera). Cap más
    // bajo para no saturar en pesados (Z alto): el campo se SIENTE sin tapar todo.
    // Densidad ∝ Z (Coulomb: el campo ES más fuerte mientras más protones). H
    // = erizo ralo; Au = erizo denso. Rango amplio para que se NOTE la diferencia.
    const N = Math.max(10, Math.min(72, Math.round(9 + Z * 0.7)));
    const seg = 14;
    const pos: number[] = [];
    const seed: number[] = [];
    const along: number[] = [];
    const R = radius * 3.4;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * 2.399963229;
      const dir = new THREE.Vector3(Math.cos(phi) * rr, y, Math.sin(phi) * rr);
      const s = (i * 73 % 100) / 100;
      for (let j = 0; j < seg; j++) {
        const a0 = j / seg, a1 = (j + 1) / seg;
        for (const a of [a0, a1]) {
          const p = dir.clone().multiplyScalar(radius * 0.5 + a * R);
          pos.push(p.x, p.y, p.z);
          seed.push(s);
          along.push(a);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(seed), 1));
    g.setAttribute('aAlong', new THREE.BufferAttribute(new Float32Array(along), 1));
    return { geo: g };
  }, [Z, radius]);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  // Brillo ∝ Z (sub-lineal sqrt para no quemar): H tenue, Au intenso. El campo
  // es más FUERTE mientras más carga nuclear (E∝Z) — corrige y da variedad.
  const bright = 0.7 + 0.55 * Math.sqrt(Z / 30);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 }, uBright: { value: 1 } }), []);
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = time;
    matRef.current.uniforms.uOpacity.value = op;
    matRef.current.uniforms.uBright.value = bright;
  }, [time, op, bright]);
  if (op < 0.01) return null;
  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={EFIELD_VERT}
        fragmentShader={EFIELD_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

// CAMPO MAGNÉTICO — solo si hay e⁻ desapareados (paramagnético). Líneas de un
// dipolo real (r = L·sin²θ) saliendo de un polo y entrando por el otro. La
// intensidad escala con μ (nº de desapareados). Diamagnético → nada.
// CAMPO MAGNÉTICO como CAMPO (no líneas): miles de PARTÍCULAS que FLUYEN a lo
// largo del dipolo. Brillo y tamaño ∝ |B| (∝ 1/r³·√(1+3cos²θ): intenso cerca del
// átomo y en los polos, se desvanece lejos). El pulso viajando = la dirección del
// flujo. Es ELECTRÓNICO (mu = e⁻ desapareados), a escala atómica, en la contemplación.
const BFIELD_VERT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uSize;
attribute float aAlong;   // 0..1 a lo largo de la línea de campo (θ/π)
attribute float aMag;     // brillo base ∝ |B|
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // partículas FLUYENDO: pulso brillante viajando a lo largo del campo = dirección.
  // VIOLENTO: flujo rápido + segundo armónico = energía nerviosa, no tranquila.
  float flow = 0.4 + 0.6 * sin(aAlong * 34.0 - uTime * 4.2)
                   + 0.25 * sin(aAlong * 71.0 - uTime * 7.3);
  vA = uOpacity * aMag * clamp(flow, 0.0, 1.4);
  gl_PointSize = uSize * (0.3 + 1.3 * aMag) * (0.6 + 0.7 * flow);   // partículas más chicas
  gl_Position = projectionMatrix * mv;
}`;
const BFIELD_FRAG = /* glsl */ `
varying float vA;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = vA * smoothstep(0.5, 0.0, r);          // partícula redonda suave
  // cian ELÉCTRICO brillante (se distingue del azul de los electrones) + núcleo blanco
  gl_FragColor = vec4(mix(vec3(0.3, 0.85, 1.0), vec3(0.9, 1.0, 1.0), a) , a * 1.3);
}`;

export function MagneticField({ element, time, radius, mu: muOverride, op: opOverride }: { element?: Element; time: number; radius: number; mu?: number; op?: number }) {
  // mu = momento magnético (e⁻ desapareados). Átomo: regla de Hund. MOLÉCULA: se
  // pasa directo (O₂ → 2 desapareados en los π* antienlazantes = paramagnético).
  const mu = muOverride ?? (element ? unpairedElectrons(element) : 0);
  // op propio para la molécula (su ventana de revelado); átomo usa bFieldOpacity.
  const op = opOverride ?? (bFieldOpacity(time) * Math.min(1, mu / 3));
  const geo = useMemo(() => {
    if (mu === 0) return null;
    const pos: number[] = [], along: number[] = [], mag: number[] = [];
    const nAz = 46;                                          // densidad azimutal → llena el espacio
    const shells = [0.4, 0.55, 0.72, 0.92, 1.14, 1.4, 1.7, 2.05, 2.4]; // más conchas = más volumen
    const steps = 66;
    const tilt = 0.5;                                  // eje del dipolo inclinado (estético)
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let a = 0; a < nAz; a++) {
      const phi = (a / nAz) * Math.PI * 2;
      for (const Lf of shells) {
        const L = radius * 2.2 * Lf;
        for (let i = 0; i < steps; i++) {
          const tt = 0.03 + (i / steps) * 0.94;
          const th = tt * Math.PI;
          const s = Math.sin(th), c = Math.cos(th);
          const r = L * s * s;                          // r = L·sin²θ (línea de campo real)
          const x = r * s * Math.cos(phi);
          const y = r * c;
          const z = r * s * Math.sin(phi);
          const yt = ct * y - st * z, zt = st * y + ct * z;
          pos.push(x, yt, zt); along.push(tt);
          // brillo ∝ |B|: ∝ 1/r³·√(1+3cos²θ) → más cerca (concha interna) y en polos.
          const poleBoost = 0.4 + 0.6 * Math.abs(c);
          const shellFall = Math.pow(0.4 / Lf, 1.7);    // conchas internas más brillantes
          mag.push(Math.max(0.12, Math.min(1, poleBoost * shellFall)));
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aAlong', new THREE.BufferAttribute(new Float32Array(along), 1));
    g.setAttribute('aMag', new THREE.BufferAttribute(new Float32Array(mag), 1));
    return g;
  }, [mu, radius]);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 }, uSize: { value: 8.0 } }), []);
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = time;
    matRef.current.uniforms.uOpacity.value = op;
  }, [time, op]);
  if (!geo || op < 0.01) return null;
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={BFIELD_VERT}
        fragmentShader={BFIELD_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// RADIOACTIVIDAD — isótopos inestables. Partículas α (núcleo de He: 2p+2n)
// disparadas radialmente desde el núcleo a tiempos escalonados (determinista por
// t), con estela; + un latido de glow azul-verde (Cherenkov / radio que brilla).
// Que se SIENTA peligroso. Solo en Tc, Pm, Z≥84.
const DECAY_VERT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uNucR;
attribute vec3 aDir;     // dirección de emisión (unitaria)
attribute float aPhase;  // 0..1 desfase de emisión
attribute float aTrail;  // 0=cabeza, >0 = posición en la estela
varying float vA;
varying float vHead;
void main() {
  float speed = uNucR * 34.0;        // más rápido → se SIENTE el disparo violento
  float period = 1.3;
  float life = fract(uTime / period + aPhase);
  float dist = uNucR * 2.0 + life * speed - aTrail * uNucR * 2.4;  // estela larga
  vec3 p = aDir * max(uNucR * 1.5, dist);
  float head = smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.75, 1.0, life));
  vHead = aTrail < 0.5 ? 1.0 : 0.0;  // marca la cabeza (más brillante)
  vA = uOpacity * head * (1.0 - aTrail * 0.22);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // cabeza GRANDE y brillante; la estela adelgaza
  gl_PointSize = clamp((1.0 - aTrail * 0.22) * uNucR * 1500.0 / -mv.z, 2.0, 30.0);
}`;
const DECAY_FRAG = /* glsl */ `
varying float vA;
varying float vHead;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float glow = smoothstep(0.5, 0.0, r);
  // VERDE-LIMA radiactivo intenso. La CABEZA es HDR (revienta en bloom a blanco
  // incandescente) para DESTACAR del cielo estrellado verde de los electrones d/f.
  // La estela queda verde-lima venenoso. Color de radio/Cherenkov.
  vec3 base = vec3(0.5, 1.0, 0.12);
  vec3 col = mix(base, vec3(1.0, 1.0, 0.9), glow * glow * (0.4 + 0.6 * vHead));
  float boost = 1.0 + vHead * 2.6;          // cabeza HDR → revienta y se ve
  gl_FragColor = vec4(col * boost, vA * glow);
}`;

// Halo radiactivo — glow verde-enfermizo que LATE alrededor del núcleo. Es la
// señal inequívoca "inestable / peligroso" que se lee al instante, aunque no
// alcances a ver una partícula α. Sprite billboard aditivo, palpita ~2 Hz.
const HALO_VERT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uNucR;
varying float vA;
varying float vTime;
void main() {
  vA = uOpacity;
  vTime = uTime;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
  // sprite GRANDE (envuelve bien al núcleo) para que los anillos salgan afuera.
  gl_PointSize = clamp(uNucR * 16000.0 / -mv.z, 8.0, 1200.0);
}`;
const HALO_FRAG = /* glsl */ `
varying float vA;
varying float vTime;
// Anillos de RADIACIÓN expandiéndose (sonar/ping): cada ping nace en el núcleo y
// se expande hacia afuera desvaneciéndose. Inequívoco: "está emitiendo". Verde
// radiactivo. 3 pings escalonados → emisión continua.
float ping(float r, float phase) {
  float life = fract(vTime * 0.7 + phase);     // 0..1 ciclo del anillo
  float rr = 0.08 + life * 0.42;               // radio crece 0.08 → 0.5
  float w = 0.035;                             // grosor del anillo
  float ring = smoothstep(w, 0.0, abs(r - rr));
  return ring * (1.0 - life);                  // se apaga al expandirse
}
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float e = ping(r, 0.0) + ping(r, 0.33) + ping(r, 0.66);
  // glow central tenue que late, para que el núcleo "respire" radiactivo
  float throb = 0.5 + 0.5 * sin(vTime * 5.0);
  float core = smoothstep(0.34, 0.12, r) * throb * 0.5;
  vec3 col = vec3(0.45, 1.0, 0.3);             // verde radiactivo
  gl_FragColor = vec4(col * (e * 1.6 + core), vA * (e + core * 0.6));
}`;

function RadioHalo({ time, nucR }: { time: number; nucR: number }) {
  const op = physOpacity(time);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
    return g;
  }, []);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 }, uNucR: { value: nucR } }), [nucR]);
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = time;
    matRef.current.uniforms.uOpacity.value = op;
    matRef.current.uniforms.uNucR.value = nucR;
  }, [time, op, nucR]);
  if (op < 0.01) return null;
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={HALO_VERT}
        fragmentShader={HALO_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function RadioactiveDecay({ Z, time, nucR }: { Z: number; time: number; nucR: number }) {
  const op = physOpacity(time);
  const { geo, count } = useMemo(() => {
    const nParticles = 10;
    const trailLen = 5;
    const pos: number[] = [], dir: number[] = [], phase: number[] = [], trail: number[] = [];
    for (let i = 0; i < nParticles; i++) {
      const y = 1 - (i / (nParticles - 1)) * 2;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * 2.399963229;
      const d = [Math.cos(phi) * rr, y, Math.sin(phi) * rr];
      const ph = (i * 0.6180339887) % 1;
      for (let tIdx = 0; tIdx < trailLen; tIdx++) {
        pos.push(0, 0, 0);
        dir.push(d[0], d[1], d[2]);
        phase.push(ph);
        trail.push(tIdx);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aDir', new THREE.BufferAttribute(new Float32Array(dir), 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(phase), 1));
    g.setAttribute('aTrail', new THREE.BufferAttribute(new Float32Array(trail), 1));
    return { geo: g, count: nParticles * trailLen };
  }, []);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0 }, uNucR: { value: nucR } }), [nucR]);
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = time;
    matRef.current.uniforms.uOpacity.value = op;
    matRef.current.uniforms.uNucR.value = nucR;
  }, [time, op, nucR]);
  void count;
  if (op < 0.01) return null;
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={DECAY_VERT}
        fragmentShader={DECAY_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ── Main ────────────────────────────────────────────────────────────
function CinematicAtomInner({ Z, live = false }: { Z: number; live?: boolean }) {
  const element = useMemo(() => elementByZ(Z) ?? elementByZ(1)!, [Z]);
  // NUBE AB INITIO si existe .bin para este Z; si no, el modelo hidrogenoide de siempre.
  // Se arranca SIEMPRE con el hidrogenoide (es síncrono) y se cambia cuando llega el fetch:
  // así no hay cuadro en blanco ni espera, y si el .bin falla la escena sigue viva.
  // `window.__atomFuente` deja que el lab diga en pantalla cuál se está viendo — la
  // diferencia importa y no se esconde.
  // ⚠ EL HIDROGENOIDE YA NO SE CONSTRUYE DE ENTRADA EN EL LAB. Estaba aquí como "respaldo
  // instantáneo" mientras llegaba el .bin, pero `buildAtomBundle` muestrea hasta 200 000
  // puntos orbital por orbital de forma SÍNCRONA: medido con el arnés de telemetría, tocar
  // un elemento daba INP ≈ 5000 ms en una RTX 4070 Ti. O sea que el "respaldo instantáneo"
  // era justo lo que congelaba el teléfono 5 segundos por toque — y la audiencia real corre
  // en Mali-G52 y Adreno 610. El .bin llega del borde en ~200 ms, así que ahora se espera:
  // solo se construye el hidrogenoide si ese elemento NO tiene .bin (los 15 superpesados) o
  // fuera del lab (el render de video, que lo necesita síncrono y determinista).
  // Cuántas subcapas tiene el elemento, SIN muestrear: populateAtom solo llena la
  // configuración electrónica. Así la duración y el brillo no esperan a la nube.
  const nSubcapas = useMemo(() => {
    const vistas = new Set(populateAtom(element).map(o => `${o.n}-${o.l}`));
    return Math.max(1, vistas.size);
  }, [element]);
  const [sinBin, setSinBin] = useState(!live);
  const hidro = useMemo(
    () => (sinBin ? buildAtomBundle(element, live) : null),
    [element, live, sinBin],
  );
  const [abin, setAbin] = useState<ReturnType<typeof bundleFromAbInitio> | null>(null);
  // ¿YA SE SABE QUÉ NUBE ES LA BUENA? El .bin ab initio se baja ASÍNCRONO y mientras tanto
  // se dibuja el respaldo hidrogenoide. `ready` se exponía en true desde el montaje, así que
  // el arnés de render podía empezar a capturar ANTES de que llegara el SCF y grabar los
  // primeros cuadros con la nube de Slater. Justo lo contrario de por qué se re-renderiza
  // este lote. Ahora `ready` espera a que la carga RESUELVA — haya bin o no lo haya.
  const [binResuelto, setBinResuelto] = useState(false);
  useEffect(() => {
    let vivo = true;
    setAbin(null);
    setBinResuelto(false);
    if (live) setSinBin(false);          // mientras carga NO se paga el muestreo síncrono
    loadAtomAbInitio(element.Z).then(d => {
      if (!vivo) return;
      if (!d && live) setSinBin(true);    // sin .bin (Z>=104): ahí sí toca el hidrogenoide
      setAbin(d ? bundleFromAbInitio(d, live) : null);
      (window as unknown as Record<string, unknown>).__atomFuente =
        d ? { Z: element.Z, fuente: 'abinitio', shells: d.shells.length }
          : { Z: element.Z, fuente: 'hidrogenoide' };
      setBinResuelto(true);
    });
    return () => { vivo = false; };
  }, [element.Z, live]);
  // Mientras no haya ninguno de los dos se mantiene el ANTERIOR: cambiar de elemento deja
  // la nube vieja ~200 ms en vez de parpadear a vacío, que se lee mejor y no cuesta nada.
  const ultimo = useRef<AtomBundle | null>(null);
  const bundle = abin ?? hidro ?? ultimo.current;
  if (bundle) ultimo.current = bundle;
  // Duración variable por # de subcapas (define la longitud del zoom-out). Se fija
  // en el módulo (RUN_DURATION) para que findCut/shellLabelTime la lean.
  const duration = useMemo(() => {
    RUN_DURATION = durationForShells(bundle?.shells.length ?? nSubcapas);
    return RUN_DURATION;
  }, [bundle]);
  const extent = useMemo(() => atomExtent(element), [element]);
  // RADIO DE CADA BANDA, medido de la MISMA nube que se dibuja (p90 de |r| entre sus
  // puntos) — así las unidades cuadran solas y no hay una tabla que se pueda desfasar
  // del .bin. Se fuerza monótono: una capa interna nunca pide más distancia que una
  // externa, aunque su cola difusa llegue lejos.
  const shellR = useMemo(() => {
    if (!bundle) return null;
    const n = bundle.shells.length;
    const acc: number[][] = Array.from({ length: n }, () => []);
    const P = bundle.positions, S = bundle.shellIdx;
    for (let k = 0; k < S.length; k++) {
      const i = S[k] | 0;
      if (i < n) acc[i].push(Math.hypot(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]));
    }
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = acc[i];
      if (!a.length) { out[i] = extent; continue; }
      a.sort((x, y) => x - y);
      out[i] = Math.max(1e-4, a[Math.floor(a.length * 0.90)]);
    }
    for (let i = 1; i < n; i++) out[i] = Math.max(out[i], out[i - 1]);
    return out;
  }, [bundle, extent]);
  const nuc = useMemo(() => nucleusInfo(element), [element]);
  // Radio del núcleo proporcional al átomo (~escala real-ish): de lejos es un
  // punto diminuto, y solo al VIAJAR hasta él se revela como cúmulo de nucleones.
  const nucR = useMemo(() => extent * 0.0010, [extent]);
  // Radio de atenuación del corazón: crece con Z (más capas internas densas que
  // queman el additive). H/He ≈ casi nada; pesados ≈ 12% del extent. Así el core
  // no revienta a blanco y las capas externas con forma lucen su color.
  // Atenúa el centro: el núcleo brillante LAVA la estructura de la nube. Más
  // hueco central → se ven las capas/lóbulos exteriores (la FORMA) al rotar.
  // En el LAB el radio lleva PISO (0.12·extent), no factor. La ganancia de brillo por
  // resolución también le pega al corazón y en los LIGEROS (C, O) la cúspide 1s/2s vive
  // justo AFUERA del radio viejo (0.059·extent) → 0.18 % de píxeles reventados y 4.3 %
  // lavados. Probado antes con un factor ×2.4 y fue peor el remedio: a los PESADOS, cuyo
  // radio ya vale 0.12-0.16, les comió la nube entera (Mo: 60 % del anillo en negro, Nd
  // 70 %). El piso sube a los ligeros y deja intactos a los pesados. Video: factor 1.
  // Y el piso NO aplica a H/He: con UNA sola subcapa no hay nada que queme (medido: 0 % de
  // píxeles reventados y 0 % lavados en las dos), y 0.12·extent les vaciaba el centro —
  // justo lo único que tienen que enseñar.
  const coreR = useMemo(
    () => extent * (live && element.Z >= 3
      ? Math.max(0.12, 0.03 + 0.16 * (1 - Math.exp(-element.Z / 30)))
      : 0.03 + 0.16 * (1 - Math.exp(-element.Z / 30))),
    [extent, element.Z, live],
  );
  // El techo de brillo `3.4/√Z` existe para que el CORE de los pesados no queme el aditivo.
  // Pero en los 57 elementos con pseudopotencial (Z≥37) ese core NO SE DIBUJA: el oro
  // enseña 19 electrones, no 79, y aun así se le aplicaba el castigo del 79 — quedaban
  // apagados (medido: Mo con anY 12 contra 34 del resto). En `live` el techo cuenta los
  // electrones DIBUJADOS. En un átomo todo-electrón la suma ES Z, o sea: sin cambio.
  // El video sigue leyendo element.Z, punto.
  const zBrillo = useMemo(() => {
    if (!live) return element.Z;
    const e = bundle?.shells.reduce((s, x) => s + (x.electrons ?? 0), 0) ?? element.Z;
    return e > 0 ? e : element.Z;
  }, [live, bundle, element.Z]);
  const [time, setTime] = useState(0);
  const [vertical, setVertical] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  );
  // Variación de trayectoria: off por default; ?tv=0.3 la activa (ver CameraRig).
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

  // API determinista para el RENDER offline de video (no en modo live).
  useEffect(() => {
    if (live) return;
    const api = {
      renderAt: (t: number) => setTime(Math.max(0, Math.min(duration, t))),
      // NO es `true` de arranque: espera a que se resuelva la carga del .bin ab initio,
      // porque hasta entonces lo que se dibuja es el respaldo hidrogenoide (ver binResuelto).
      ready: binResuelto,
      duration,
      Z,
      element: element.symbol,
      fuente: abin ? 'abinitio' : 'hidrogenoide',
    };
    (window as unknown as { __cinematicAtom: typeof api }).__cinematicAtom = api;
    return () => {
      delete (window as unknown as { __cinematicAtom?: unknown }).__cinematicAtom;
    };
  }, [Z, element.symbol, duration, live, binResuelto, abin]);

  // Modo LIVE (lab): reloj propio que reproduce la coreografía en LOOP eterno.
  useEffect(() => {
    if (!live) return;
    let raf = 0, start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      setTime(((now - start) / 1000) % duration);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live, duration]);

  // Liberar el contexto WebGL al desmontar (solo live): el lab cambia de pestaña
  // seguido y Chrome limita ~16 contextos; sin esto el más viejo se pierde y la
  // escena se ennegrece. El render headless 4K no toca esto.
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  useEffect(() => () => { if (live) { try { glRef.current?.forceContextLoss(); glRef.current?.dispose(); } catch { /* noop */ } } }, [live]);

  // CÁMARA: el video arranca CERCA a propósito (viaja después). El lab no viaja, así que si
  // arrancara ahí el núcleo con bloom se comería la nube y no se leerían las capas de color
  // —justo lo que se vino a ver—. En live abre a 0.95·extent = el átomo COMPLETO con aire,
  // y de ahí el usuario acerca con el dedo.
  // `flat` SIEMPRE: el tonemap ACES lo hace el EffectComposer. Si además lo hiciera el
  // renderer serían DOS (defecto documentado en CLAUDE.md §doble tonemap).
  // DPR: en el lab bajamos el techo porque ahora hay postFX y los teléfonos REALES de la
  // audiencia son Mali-G52/G57 y Adreno 610/619 (medido en la telemetría de hoy). A 2× con
  // bloom se arrastran; a 1.5× se ve igual en una pantalla de 6".
  return (
    <div style={{ position: live ? 'absolute' : 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        flat
        onCreated={({ gl }) => { glRef.current = gl; }}
        camera={{ position: [0, 0, extent * (live ? 0.95 : 0.5)], fov: 35, near: 0.01, far: 200 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={live ? [1, 1.5] : [1, 2]}
        frameloop="always"
        style={{ background: '#000' }}
      >
        <color attach="background" args={['#000']} />
        {/* nucleones y electrones usan shaders propios — no dependen de luces */}
        <FrameDriver time={time} />
        {/* El video necesita cámara PURA en t (determinismo del render por lotes).
            El lab necesita que la puedas girar con el dedo. Misma escena, dos manos. */}
        {live
          ? <OrbitControls enablePan={false} enableDamping dampingFactor={0.08}
              minDistance={extent * 0.004} maxDistance={extent * 2.2} autoRotate autoRotateSpeed={0.55} />
          : <CameraRig extent={extent} time={time} vertical={vertical} tv={tv} seed={Z} shellR={shellR} />}
        <Nucleus protons={nuc.protons} neutrons={nuc.neutrons} time={time} clusterRadius={nucR} />
        {bundle && <ElectronCloud bundle={bundle} time={time} holeRadius={holeForTime(time, nucR, extent)}
          /* La atenuación del corazón existe para que el centro no reviente a blanco
             cuando TODAS las capas están encendidas. Durante el barrido solo hay una
             protagonista, así que no hay nada que reventar — y con el coreR normal se
             comía justo las bandas internas (1s/2s/3s del Cr viven dentro del 11.8 %
             del extent, que es exactamente el radio de atenuación). Se acota para que
             nunca muerda la banda en turno. */
          coreRadius={(() => {
            const rb = shellR ? bandaRadio(time, shellR, extent * 0.014) : null;
            return rb === null ? coreR : Math.min(coreR, rb * 0.30);
          })()}
          bandScale={(() => {
            const rb = shellR ? bandaRadio(time, shellR, extent * 0.014) : null;
            return rb === null ? 1 : (rb * BANDA_ENCUADRE * BANDA_PUNTO) / extent;
          })()}
          live={live}
          rotRate={1.15}
          /* La nube cede 45 % de brillo para que el campo B se lea — pero SOLO cuando el
             campo entra, no a un segundo quemado (antes 17.3, que en el Fe caía encima de
             la banda 2 y apagaba el barrido entero). Mismo reloj que bFieldOpacity. */
          brightness={Math.min(0.82, 3.4 / Math.sqrt(zBrillo))
            * (1 - 0.45 * smoothstep((time - (duration - BANDA_COLA)) / 0.8))
            * (shellR && bandaFase(time, shellR.length) !== null ? BANDA_LUZ : 1)} />}
        {/* Física visible (gated a la mirada al núcleo): campo eléctrico de
            Coulomb, campo magnético dipolar si es paramagnético, y decaimiento
            radiactivo si el isótopo es inestable. Todo determinista en t. */}
        {/* Los campos ROTAN con el átomo (misma rotación que el núcleo) — antes
            quedaban fijos mientras el cúmulo giraba y se veía desconectado. */}
        <group rotation={[time * 0.22, time * 0.5, 0]}>
          <ElectricField Z={element.Z} time={time} radius={nucR} />
          {/* Campo B a escala ATÓMICA (envuelve la nube) — el magnetismo es
              electrónico, no nuclear. Ventana = contemplación (bFieldOpacity). */}
          <MagneticField element={element} time={time} radius={extent * 0.55} />
        </group>
        {isRadioactive(element.Z) && <>
          <RadioHalo time={time} nucR={nucR} />
          <RadioactiveDecay Z={element.Z} time={time} nucR={nucR} />
        </>}
        {/* EL MISMO POSTFX QUE EL VIDEO, TAMBIÉN EN EL LAB (Ian, 2026-07-31: "esas
            simulaciones de los átomos no se parecen en nada a nuestros videos").
            Tenía razón y la causa era esta línea: el lab renderizaba SIN EffectComposer,
            o sea SIN BLOOM — y el bloom de umbral bajo es exactamente lo que hace que
            los picos revienten y la nube se vea como en el reel. Sin él es el mismo
            cálculo con otra fotografía.
            POR QUÉ ESTABA APAGADO: el combo MSAA + render target HDR-float reventaba a
            blanco en Intel/ANGLE D3D11. Esa mitigación YA EXISTÍA sin usarse —
            DynamicPostFX acepta `live` y pone multisampling=0 justo para eso— así que
            aquí solo se conecta. Y la telemetría de hoy dice que el riesgo no está en la
            audiencia real: de los visitantes medidos, 100 % reporta webgl2 sobre Apple
            GPU, Mali-G52/G57, Adreno 610/619 y PowerVR. Cero Intel/ANGLE D3D11. */}
        <DynamicPostFX time={time} live={live} />
      </Canvas>
      <CinemaVignette />
      {/* En el lab (live) ocultamos los overlays/letterbox: el dock ya muestra la
          info y el viewport no es 9:16 fullscreen. Solo el átomo contemplativo. */}
      {!live && <>
        <DatoCurioso element={element} time={time} vertical={vertical} />
        <ScaleNote element={element} time={time} vertical={vertical} />
        {bundle && <AtomTitle element={element} shells={bundle.shells} time={time} vertical={vertical} />}
        <Letterbox vertical={vertical} />
      </>}
    </div>
  );
}

export default memo(CinematicAtomInner);
