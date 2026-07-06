/**
 * Canal Iónico — Hodgkin-Huxley + Nernst en 3D cine.
 *
 * FÍSICA REAL:
 *   Potencial de Nernst:  E_ion = (RT / zF) · ln([ion]_out / [ion]_in)
 *     R = 8.314 J/(mol·K), T = 310 K (37°C fisiológico),
 *     F = 96485 C/mol, z = carga del ion
 *   Potencial de membrana equilibrio:  E_m ~ -70 mV (Goldman-Hodgkin-Katz)
 *
 *   Hodgkin-Huxley (1952, Nobel 1963):
 *     C_m · dV/dt = I_ext − g_Na·m³·h·(V−E_Na) − g_K·n⁴·(V−E_K) − g_L·(V−E_L)
 *     dm/dt = α_m(V)·(1−m) − β_m(V)·m
 *     dh/dt = α_h(V)·(1−h) − β_h(V)·h
 *     dn/dt = α_n(V)·(1−n) − β_n(V)·n
 *
 *   Parámetros canónicos (Hodgkin & Huxley, J Physiol 1952):
 *     C_m = 1 µF/cm², g_Na = 120 mS/cm², g_K = 36 mS/cm², g_L = 0.3 mS/cm²
 *     E_Na = +55 mV, E_K = −77 mV, E_L = −54.4 mV
 *
 * Visualización 3D:
 *   - Canal transmembrana cilíndrico central (poro como anillo biomolecular)
 *   - Iones Na⁺ (naranja) y K⁺ (cyan) fluyendo como partículas
 *   - Curva de potencial de acción flotante en 3D (ribbon)
 *   - Compuertas m/h/n como anillos giratorios en el canal
 */

import { useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ── Constantes físicas ────────────────────────────────────────────────

const R_GAS  = 8.314;     // J/(mol·K)
const TEMP   = 310.0;     // K  (37°C)
const F_FARADAY = 96485; // C/mol
// RT/F en mV
const RT_F_mV = (R_GAS * TEMP / F_FARADAY) * 1000; // ≈ 26.7 mV

// Parámetros HH canónicos (Hodgkin & Huxley 1952)
const C_M    = 1.0;   // µF/cm²
const G_NA   = 120.0; // mS/cm²
const G_K    = 36.0;  // mS/cm²
const G_L    = 0.3;   // mS/cm²
const E_NA   = 55.0;  // mV
const E_K    = -77.0; // mV
const E_L    = -54.4; // mV
const V_REST = -65.0; // mV  (potencial de reposo inicial)

// ── Nernst ───────────────────────────────────────────────────────────

function nernstMV(z: number, concOut: number, concIn: number): number {
  return (RT_F_mV / z) * Math.log(concOut / concIn);
}

// ── Hodgkin-Huxley — tasas de transición ────────────────────────────

// V en mV, desplazado a convención HH (V_hh = V_m − V_rest donde V_rest = -65)
// usamos la convención moderna (V en mV, potencial absoluto):

function alpha_m(V: number): number {
  const dv = V + 40.0;
  if (Math.abs(dv) < 1e-7) return 1.0;
  return (0.1 * dv) / (1.0 - Math.exp(-dv / 10.0));
}
function beta_m(V: number): number {
  return 4.0 * Math.exp(-(V + 65.0) / 18.0);
}
function alpha_h(V: number): number {
  return 0.07 * Math.exp(-(V + 65.0) / 20.0);
}
function beta_h(V: number): number {
  return 1.0 / (1.0 + Math.exp(-(V + 35.0) / 10.0));
}
function alpha_n(V: number): number {
  const dv = V + 55.0;
  if (Math.abs(dv) < 1e-7) return 0.1;
  return (0.01 * dv) / (1.0 - Math.exp(-dv / 10.0));
}
function beta_n(V: number): number {
  return 0.125 * Math.exp(-(V + 65.0) / 80.0);
}

// ── Estado HH ────────────────────────────────────────────────────────

interface HHState {
  V: number;  // mV
  m: number;  // activación Na
  h: number;  // inactivación Na
  n: number;  // activación K
  t: number;  // ms
}

function hhInit(): HHState {
  const V = V_REST;
  const am = alpha_m(V), bm = beta_m(V);
  const ah = alpha_h(V), bh = beta_h(V);
  const an = alpha_n(V), bn = beta_n(V);
  return {
    V,
    m: am / (am + bm),
    h: ah / (ah + bh),
    n: an / (an + bn),
    t: 0,
  };
}

/** RK4 step para Hodgkin-Huxley */
function hhStep(s: HHState, I_ext: number, dt: number): HHState {
  function deriv(st: HHState): { dV: number; dm: number; dh: number; dn: number } {
    const { V, m, h, n } = st;
    const I_Na = G_NA * m * m * m * h * (V - E_NA);
    const I_K  = G_K  * n * n * n * n * (V - E_K);
    const I_L  = G_L  * (V - E_L);
    const dV = (I_ext - I_Na - I_K - I_L) / C_M;
    const dm = alpha_m(V) * (1 - m) - beta_m(V) * m;
    const dh = alpha_h(V) * (1 - h) - beta_h(V) * h;
    const dn = alpha_n(V) * (1 - n) - beta_n(V) * n;
    return { dV, dm, dh, dn };
  }

  const k1 = deriv(s);
  const s2: HHState = { V: s.V + 0.5*dt*k1.dV, m: s.m + 0.5*dt*k1.dm, h: s.h + 0.5*dt*k1.dh, n: s.n + 0.5*dt*k1.dn, t: s.t };
  const k2 = deriv(s2);
  const s3: HHState = { V: s.V + 0.5*dt*k2.dV, m: s.m + 0.5*dt*k2.dm, h: s.h + 0.5*dt*k2.dh, n: s.n + 0.5*dt*k2.dn, t: s.t };
  const k3 = deriv(s3);
  const s4: HHState = { V: s.V + dt*k3.dV, m: s.m + dt*k3.dm, h: s.h + dt*k3.dh, n: s.n + dt*k3.dn, t: s.t };
  const k4 = deriv(s4);

  return {
    V: s.V + (dt/6) * (k1.dV + 2*k2.dV + 2*k3.dV + k4.dV),
    m: Math.max(0, Math.min(1, s.m + (dt/6) * (k1.dm + 2*k2.dm + 2*k3.dm + k4.dm))),
    h: Math.max(0, Math.min(1, s.h + (dt/6) * (k1.dh + 2*k2.dh + 2*k3.dh + k4.dh))),
    n: Math.max(0, Math.min(1, s.n + (dt/6) * (k1.dn + 2*k2.dn + 2*k3.dn + k4.dn))),
    t: s.t + dt,
  };
}

// ── Lesson ───────────────────────────────────────────────────────────

interface IonLessonState {
  presetId: string;
}

const LESSON: Lesson<IonLessonState> = {
  hook: {
    title: 'Un solo impulso eléctrico recorre tu axón a 100 m/s. Así funciona.',
    body: `En este momento, millones de canales iónicos en tus neuronas se abren y cierran en milisegundos con una precisión asombrosa.

El mecanismo es electroquímico: dentro de una neurona hay más K⁺ que afuera, y más Na⁺ afuera que adentro. Esa diferencia de concentración genera el potencial de Nernst — una "batería química" para cada ion.

El potencial de reposo de la membrana es –70 mV. Cuando llega un estímulo, los canales de Na⁺ se abren, el voltaje sube hasta +40 mV, y eso dispara una cascada de apertura y cierre de canales.

Hodgkin y Huxley (1952) describieron todo esto con ecuaciones diferenciales — sin saber qué proteínas eran los canales. Por eso ganaron el Nobel. Aquí lo ves en tiempo real.`,
  },

  steps: [
    {
      title: 'Potencial de Nernst — la batería química',
      duration: 6000,
      body: `Antes del potencial de acción, hay que entender la BATERÍA que lo impulsa.

Dentro de la célula: [K⁺]_in = 140 mM, [Na⁺]_in = 12 mM.
Afuera de la célula: [K⁺]_out = 4 mM, [Na⁺]_out = 145 mM.

La ecuación de Nernst dice cuál es el voltaje de equilibrio para cada ion si la membrana fuera SOLO permeable a ese ion:
  E_K = (RT/F)·ln([K⁺]_out/[K⁺]_in) ≈ −90 mV
  E_Na = (RT/F)·ln([Na⁺]_out/[Na⁺]_in) ≈ +67 mV

El potencial real (≈ −70 mV) es la media ponderada — la membrana en reposo es más permeable al K⁺ que al Na⁺. Cuando los canales de Na⁺ se abren, la membrana corre hacia +67 mV.`,
      formula: 'E_ion = (RT/zF) · ln([ion]_out / [ion]_in)\nE_K ≈ −90 mV  |  E_Na ≈ +67 mV',
      keyframes: [
        { at: 0, state: { presetId: 'rest' } },
        { at: 1, state: { presetId: 'rest' } },
      ],
    },
    {
      title: 'Canal de Na⁺ — apertura ultrarrápida',
      duration: 6000,
      body: `Hodgkin-Huxley modelan la conductancia de Na⁺ con TRES compuertas:
  • m (activación): se abre rápido cuando V sube — voltaje-dependiente.
  • h (inactivación): se CIERRA poco después — timer de seguridad.
  • El canal conduce Na⁺ solo si m³·h ≠ 0 (las tres compuertas m abierta y h abierta).

En reposo, m ≈ 0.05, h ≈ 0.6. Cuando el voltaje sube a −55 mV (umbral), m sube a 0.9 en ~1 ms, y la corriente Na⁺ revienta.

Pero h cae a ~0 en ~4 ms — el canal se inactiva SOLO. Ese es el mecanismo de refractariedad: el canal no puede disparar de nuevo hasta que h se recupere.

Ves los iones Na⁺ (naranja) fluyendo HACIA ADENTRO durante el pico.`,
      formula: 'I_Na = g_Na · m³ · h · (V − E_Na)\ng_Na = 120 mS/cm²  |  E_Na = +55 mV',
      keyframes: [
        { at: 0, state: { presetId: 'action' } },
        { at: 1, state: { presetId: 'action' } },
      ],
    },
    {
      title: 'Canal de K⁺ — repolarización lenta',
      duration: 6000,
      body: `El canal de K⁺ tiene UNA sola compuerta n (activación lenta).
  • n sube más lento que m: tarda ~5–10 ms en abrirse.
  • No tiene compuerta de inactivación — permanece abierto más tiempo.

Esa asimetría es el diseño: cuando Na⁺ entra y dispara el pico, K⁺ empieza a salir lento. Cuando Na⁺ se inactiva, K⁺ todavía fluye, llevando el voltaje de vuelta a −65 mV.

En realidad lo lleva un poco más lejos, a ≈ −80 mV (hiperpolarización). Eso es la "fase refractaria relativa" — el canal K⁺ aún está abierto.

La corriente K⁺ es I_K = g_K · n⁴ · (V − E_K). La potencia n⁴ viene de CUATRO subunidades idénticas. Se confirmó cuando clonaron el gen Shaker (Drosophila, 1987).`,
      formula: 'I_K = g_K · n⁴ · (V − E_K)\ng_K = 36 mS/cm²  |  E_K = −77 mV',
      keyframes: [
        { at: 0, state: { presetId: 'action' } },
        { at: 1, state: { presetId: 'action' } },
      ],
    },
    {
      title: 'Potencial de acción completo — todo junto',
      duration: 7000,
      body: `Juntando todo en la ecuación maestra:
  C_m · dV/dt = I_ext − I_Na − I_K − I_L

Donde I_L (leak) = g_L·(V − E_L) es la corriente de fuga (canales siempre abiertos).

La dinámica tiene 4 fases:
  1. Reposo: V ≈ −65 mV. m pequeño, h grande, n pequeño.
  2. Despolarización (0–2 ms): Na⁺ entra en avalancha — m³h domina.
  3. Repolarización (2–6 ms): h cae, n sube — K⁺ sale, devuelve el voltaje.
  4. Hiperpolarización (6–10 ms): n aún abierto, V < −65 mV. Período refractario.

Esta curva se mide HOY en patch-clamp. Las ecuaciones de Hodgkin-Huxley predicen cada milisegundo con < 5% de error — 70 años después.`,
      formula: 'C_m dV/dt = I_ext − g_Na m³h(V−E_Na) − g_K n⁴(V−E_K) − g_L(V−E_L)',
      keyframes: [
        { at: 0, state: { presetId: 'action' } },
        { at: 1, state: { presetId: 'action' } },
      ],
    },
  ],

  connect: {
    body: `Hodgkin y Huxley derivaron sus ecuaciones de experimentos en calamar gigante (Loligo), cuyo axón mide 1 mm de diámetro — 1000x el axón humano, manejable con electrodos de la época.

El modelo predijo en 1952 la velocidad de propagación del impulso (≈ 20 m/s en axón sin mielina) sin datos previos. Ganaron el Nobel en 1963.

Hoy los canales iónicos son el BLANCO PRINCIPAL de fármacos neurológicos:
• Anestésicos locales (lidocaína) → bloquean canales Nav
• Antiepilépticos (carbamazepina) → estabilizan la inactivación h
• Antiarrítmicos cardíacos → canales Kv y Nav cardíacos (HH aplica igual)
• Analgésicos (ziconotida) → bloquean canales Cav2.2 en dolor crónico

Los canales que ves en 3D son reales: los cristalografistas de rayos X y cryo-EM han resuelto la estructura atómica de Nav1.2, Kv1.2, TRPV1 — y se parecen exactamente a lo que HH predijo funcionalmente.`,
    links: [
      { label: 'Proteína Folding — estructura de los canales', href: '#protein-folding' },
      { label: 'Drug Discovery — Nav/Kv como targets', href: '#drug-discovery' },
      { label: 'Double Helix — codifica a los canales', href: '#double-helix' },
    ],
  },
};

// ── Presets ───────────────────────────────────────────────────────────

interface Preset {
  id: string;
  name: string;
  I_ext: number;  // µA/cm²
  note: string;
}

const PRESETS: Preset[] = [
  { id: 'rest',   name: 'Reposo (I=0)',         I_ext: 0,   note: 'Membrana en equilibrio. Los canales están mayoritariamente cerrados.' },
  { id: 'sub',    name: 'Subumbral (I=5)',       I_ext: 5,   note: 'Estímulo insuficiente. El voltaje regresa sin disparar un PA.' },
  { id: 'action', name: 'Potencial de acción (I=10)', I_ext: 10,  note: 'Un solo pulso de 1 ms dispara el potencial de acción completo.' },
  { id: 'train',  name: 'Tren de pulsos (I=20)',  I_ext: 20,  note: 'Estímulo sostenido — varios PAs seguidos (rafaga de disparos).' },
];

// Concentraciones fisiológicas (mM)
const ION_CONC = {
  K_in: 140, K_out: 4,
  Na_in: 12,  Na_out: 145,
};

// ── Partículas de iones ───────────────────────────────────────────────

const N_ION_NA = 200;
const N_ION_K  = 200;

function initIonPositions(n: number): Float32Array {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const theta = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.random() * 1.2;
    arr[i*3+0] = Math.cos(theta) * r;
    arr[i*3+1] = (Math.random() - 0.5) * 3.5;
    arr[i*3+2] = Math.sin(theta) * r;
  }
  return arr;
}

// ── Curva de voltaje en 3D (ribbon) ─────────────────────────────────

const VTRACE_LEN = 300;
const V_SCALE    = 0.035; // mV → unidades de escena
const T_SCALE    = 0.04;  // ms → unidades de escena

// ── Sub-componente de simulación (useFrame dentro del Canvas) ────────

interface SimProps {
  hhRef:       React.MutableRefObject<HHState>;
  I_ext:       number;
  running:     boolean;
  simDt:       number;
  // geometrías de partículas
  geomNa:      THREE.BufferGeometry;
  geomK:       THREE.BufferGeometry;
  // ribbon de voltaje
  vtracePts:   React.MutableRefObject<Float32Array>;
  vtraceIdx:   React.MutableRefObject<number>;
  vtraceGeom:  THREE.BufferGeometry;
  // refs de compuertas (rotación visual)
  gateM:       React.RefObject<THREE.Mesh | null>;
  gateH:       React.RefObject<THREE.Mesh | null>;
  gateN:       React.RefObject<THREE.Mesh | null>;
  // membrane glow
  membrane:    React.RefObject<THREE.Mesh | null>;
  // Na/K inner/outer labels (Html)
  onStateChange: (s: HHState) => void;
}

function IonSim({
  hhRef, I_ext, running, simDt,
  geomNa, geomK,
  vtracePts, vtraceIdx, vtraceGeom,
  gateM, gateH, gateN,
  membrane,
  onStateChange,
}: SimProps) {
  const frameCount = useRef(0);
  const lastUIUpdate = useRef(0);

  // posiciones base (randomizadas una vez)
  const baseNa = useMemo(() => initIonPositions(N_ION_NA), []);
  const baseK  = useMemo(() => initIonPositions(N_ION_K),  []);

  useFrame((_, delta) => {
    if (!running) return;

    // HH sub-steps (10 pasos de simDt por frame para estabilidad)
    const SUB = 10;
    const dt = simDt / SUB;
    for (let i = 0; i < SUB; i++) {
      hhRef.current = hhStep(hhRef.current, I_ext, dt);
    }

    const { V, m, h, n, t } = hhRef.current;

    // ── voltaje: normalizado −80..+60 → 0..1
    const Vnorm = (V - (-80)) / (60 - (-80));
    const Vcl   = Math.max(0, Math.min(1, Vnorm));

    // ── mover iones ──
    // Na⁺: fluye DENTRO (−y) durante despolarización (V sube, m³h grande)
    // K⁺:  fluye AFUERA (+y) durante repolarización (n grande, V bajando)
    const naFlux = G_NA * m * m * m * h * Math.max(0, V - E_NA) / 4000;  // normalizado
    const kFlux  = G_K  * n * n * n * n * Math.max(0, E_K - V) / 1500;

    const posNA = geomNa.attributes.position as THREE.BufferAttribute;
    const posK  = geomK.attributes.position as THREE.BufferAttribute;
    const arr = posNA.array as Float32Array;
    const arrK = posK.array as Float32Array;

    for (let i = 0; i < N_ION_NA; i++) {
      // partícula Na: oscila + drift hacia adentro si naFlux > 0
      const bx = baseNa[i*3+0], by = baseNa[i*3+1], bz = baseNa[i*3+2];
      const phase = (frameCount.current * 0.02 + i * 0.31) % (Math.PI * 2);
      // Na+ empieza afuera (r > 0 en base), si fluye entra (r cae)
      const r = Math.sqrt(bx*bx + bz*bz);
      const flux = naFlux * (1.5 - Math.min(r, 1.5)); // empuje radial hacia centro
      arr[i*3+0] = bx * (1 - flux * 0.15) + Math.sin(phase * 0.7) * 0.06;
      arr[i*3+1] = by + naFlux * (-0.4) * Math.sin(phase + i);
      arr[i*3+2] = bz * (1 - flux * 0.15) + Math.cos(phase * 0.9) * 0.06;
    }
    posNA.needsUpdate = true;

    for (let i = 0; i < N_ION_K; i++) {
      const bx = baseK[i*3+0], by = baseK[i*3+1], bz = baseK[i*3+2];
      const phase = (frameCount.current * 0.018 + i * 0.27) % (Math.PI * 2);
      const r = Math.sqrt(bx*bx + bz*bz);
      const flux = kFlux * (1.5 - Math.min(r, 1.5));
      arrK[i*3+0] = bx * (1 + flux * 0.12) + Math.sin(phase * 0.8) * 0.05;
      arrK[i*3+1] = by + kFlux * 0.35 * Math.sin(phase + i * 0.5);
      arrK[i*3+2] = bz * (1 + flux * 0.12) + Math.cos(phase * 0.75) * 0.05;
    }
    posK.needsUpdate = true;

    // ── compuertas — girar según gating variables ──
    if (gateM.current) gateM.current.rotation.y = m * Math.PI * 2;
    if (gateH.current) gateH.current.rotation.y = (1 - h) * Math.PI;
    if (gateN.current) gateN.current.rotation.y = n * Math.PI * 1.5;

    // ── membrana — color según voltaje ──
    if (membrane.current) {
      const mat = membrane.current.material as THREE.MeshStandardMaterial;
      // reposo=cyan tenue, pico=naranja brillante
      const R = Vcl * 1.0;
      const G = Vcl * 0.45;
      const B = (1 - Vcl) * 0.7;
      mat.emissive.setRGB(R, G, B);
      mat.emissiveIntensity = 0.2 + Vcl * 1.8;
    }

    // ── ribbon de voltaje ──
    const vi = vtraceIdx.current;
    const pts = vtracePts.current;
    const tOff = (t % (VTRACE_LEN * simDt)) * T_SCALE;
    pts[vi*3+0] = (vi / VTRACE_LEN) * VTRACE_LEN * simDt * T_SCALE - VTRACE_LEN * simDt * T_SCALE * 0.5;
    pts[vi*3+1] = V * V_SCALE + 3.5;    // offset vertical para separarlo del canal
    pts[vi*3+2] = -3.5;                 // al fondo de la escena
    vtraceIdx.current = (vi + 1) % VTRACE_LEN;
    const vpos = vtraceGeom.attributes.position as THREE.BufferAttribute;
    (vpos.array as Float32Array).set(pts);
    vpos.needsUpdate = true;
    vtraceGeom.setDrawRange(0, VTRACE_LEN);

    frameCount.current++;

    // UI update cada ~100ms
    const now = performance.now();
    if (now - lastUIUpdate.current > 100) {
      onStateChange({ ...hhRef.current });
      lastUIUpdate.current = now;
    }
  });

  return null;
}

// ── Canal 3D: anillos, poro, segmentos transmembrana ────────────────

const GateRing = forwardRef<THREE.Mesh, { color: string; radius: number; y: number }>(
  function GateRing({ color, radius, y }, ref) {
    return (
      <mesh ref={ref} position={[0, y, 0]}>
        <torusGeometry args={[radius, 0.06, 8, 40]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          metalness={0.3}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
    );
  }
);

function ChannelGeometry({ gateMRef, gateHRef, gateNRef, memRef }: {
  gateMRef: React.RefObject<THREE.Mesh | null>;
  gateHRef: React.RefObject<THREE.Mesh | null>;
  gateNRef: React.RefObject<THREE.Mesh | null>;
  memRef:   React.RefObject<THREE.Mesh | null>;
}) {
  // 8 hélices transmembrana como cilindros inclinados
  const helixData = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const r = 0.72;
      return {
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        angle,
      };
    });
  }, []);

  return (
    <group>
      {/* Membrana plasmática — dos láminas */}
      <mesh ref={memRef} position={[0, 0.22, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.25, 48, 1, true]} />
        <meshStandardMaterial
          color="#1a3a4a"
          emissive="#004466"
          emissiveIntensity={0.3}
          side={THREE.DoubleSide}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.25, 48, 1, true]} />
        <meshStandardMaterial
          color="#1a2a3a"
          emissive="#003355"
          emissiveIntensity={0.2}
          side={THREE.DoubleSide}
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>

      {/* Hélices transmembrana (segmentos S1-S6 estilizados) */}
      {helixData.map((h, i) => (
        <mesh key={i} position={[h.x, 0, h.z]} rotation={[Math.PI/2, h.angle, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshStandardMaterial
            color="#2a5566"
            emissive="#1a4455"
            emissiveIntensity={0.5}
            metalness={0.6}
            roughness={0.3}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Poro central — tubo brillante */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 1.1, 20, 1, true]} />
        <meshStandardMaterial
          color="#00aaff"
          emissive="#0088ff"
          emissiveIntensity={0.9}
          side={THREE.DoubleSide}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Compuertas m (activación Na) — naranja arriba */}
      <GateRing ref={gateMRef} color="#ff8800" radius={0.28} y={0.42} />

      {/* Compuerta h (inactivación Na) — rojo abajo */}
      <GateRing ref={gateHRef} color="#ff3344" radius={0.22} y={-0.42} />

      {/* Compuerta n (activación K) — cyan medio */}
      <GateRing ref={gateNRef} color="#00e5ff" radius={0.35} y={0.0} />
    </group>
  );
}

// ── Ribbon de voltaje ─────────────────────────────────────────────────

function VoltageRibbon({ geom }: { geom: THREE.BufferGeometry }) {
  return (
    <points geometry={geom}>
      <pointsMaterial
        color="#a0ff60"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

// ── Etiqueta de membrana en Html ──────────────────────────────────────

function MembraneLabel({ y, text, color }: { y: number; text: string; color: string }) {
  return (
    <Html position={[2.4, y, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <div style={{ color, fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap', opacity: 0.85 }}>
        {text}
      </div>
    </Html>
  );
}

// ── Componente principal ──────────────────────────────────────────────

export default function IonChannel() {
  const { audience } = useAudience();

  const [presetId, setPresetId]   = useState('action');
  const preset = PRESETS.find(p => p.id === presetId)!;

  const [running, setRunning]     = useState(true);
  const [simDt, setSimDt]         = useState(0.025); // ms por paso
  const [uiState, setUiState]     = useState<HHState>(hhInit());

  const hhRef = useRef<HHState>(hhInit());

  const reset = () => { hhRef.current = hhInit(); };
  useEffect(() => { reset(); }, [presetId]);

  // geometrías de partículas
  const geomNa = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(initIonPositions(N_ION_NA), 3));
    return g;
  }, []);
  const geomK = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(initIonPositions(N_ION_K), 3));
    return g;
  }, []);

  // ribbon de voltaje
  const vtracePts  = useRef(new Float32Array(VTRACE_LEN * 3));
  const vtraceIdx  = useRef(0);
  const vtraceGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VTRACE_LEN * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  const gateMRef = useRef<THREE.Mesh | null>(null);
  const gateHRef = useRef<THREE.Mesh | null>(null);
  const gateNRef = useRef<THREE.Mesh | null>(null);
  const memRef   = useRef<THREE.Mesh | null>(null);

  const tex = useMemo(() => getParticleTexture(), []);

  const E_K_mv  = nernstMV(1, ION_CONC.K_out,  ION_CONC.K_in);
  const E_Na_mv = nernstMV(1, ION_CONC.Na_out, ION_CONC.Na_in);

  const fmt  = (x: number, d = 2) => isFinite(x) ? x.toFixed(d) : '—';
  const fmtP = (x: number)        => (x * 100).toFixed(1) + '%';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={6.5} bloomIntensity={1.1} bloomThreshold={0.08} autoRotate>
          {/* Canal 3D central */}
          <ChannelGeometry
            gateMRef={gateMRef}
            gateHRef={gateHRef}
            gateNRef={gateNRef}
            memRef={memRef}
          />

          {/* Iones Na⁺ — naranja, afuera → adentro */}
          <points geometry={geomNa}>
            <pointsMaterial
              map={tex} alphaMap={tex}
              color="#ff8800"
              size={0.13}
              sizeAttenuation
              transparent opacity={0.85}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </points>

          {/* Iones K⁺ — cyan, adentro → afuera */}
          <points geometry={geomK}>
            <pointsMaterial
              map={tex} alphaMap={tex}
              color="#00e5ff"
              size={0.11}
              sizeAttenuation
              transparent opacity={0.80}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </points>

          {/* Ribbon de voltaje */}
          <VoltageRibbon geom={vtraceGeom} />

          {/* Etiquetas */}
          <MembraneLabel y={1.2}  text="Extracelular  [Na⁺]₀=145mM  [K⁺]₀=4mM"  color="#ff8844" />
          <MembraneLabel y={-1.2} text="Intracelular  [Na⁺]ᵢ=12mM   [K⁺]ᵢ=140mM" color="#44ddff" />

          {/* Simulación — useFrame solo aquí, dentro del Canvas */}
          <IonSim
            hhRef={hhRef}
            I_ext={preset.I_ext}
            running={running}
            simDt={simDt}
            geomNa={geomNa}
            geomK={geomK}
            vtracePts={vtracePts}
            vtraceIdx={vtraceIdx}
            vtraceGeom={vtraceGeom}
            gateM={gateMRef}
            gateH={gateHRef}
            gateN={gateNRef}
            membrane={memRef}
            onStateChange={setUiState}
          />
        </Stage>

        {/* HUD — estado en tiempo real */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-3 font-mono text-[11px] text-[#CBD5E1] space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1.5">Hodgkin-Huxley</div>
          <div className="flex justify-between gap-4">
            <span className="text-[#64748B]">V</span>
            <span className={uiState.V > 0 ? 'text-[#f97316]' : uiState.V < -75 ? 'text-[#38bdf8]' : 'text-white'}>
              {fmt(uiState.V, 1)} mV
            </span>
          </div>
          <div className="flex justify-between gap-4"><span className="text-[#64748B]">m (Na act)</span><span className="text-[#f97316]">{fmtP(uiState.m)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-[#64748B]">h (Na inact)</span><span className="text-[#ef4444]">{fmtP(uiState.h)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-[#64748B]">n (K act)</span><span className="text-[#38bdf8]">{fmtP(uiState.n)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-[#64748B]">t</span><span>{fmt(uiState.t, 2)} ms</span></div>
        </div>

        {/* Leyenda de colores */}
        <div className="absolute top-4 right-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-3 py-2.5 text-[10px] space-y-1">
          <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ff8800]" />Na⁺ <span className="text-[#64748B]">E={fmt(E_Na_mv,0)} mV</span></div>
          <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#00e5ff]" />K⁺ <span className="text-[#64748B]">E={fmt(E_K_mv,0)} mV</span></div>
          <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#a0ff60]" />V(t) <span className="text-[#64748B]">ribbon</span></div>
          <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ff8800]" style={{opacity:0.7}}/>m-gate</div>
          <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ef4444]" />h-gate</div>
          <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />n-gate</div>
        </div>

        {/* Controles de playback */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IcnBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IcnBtn>
          <IcnBtn onClick={reset} title="Reiniciar">↺</IcnBtn>
        </div>
      </div>

      {/* ── Panel pedagógico ── */}
      <LessonPanel<IonLessonState>
        lesson={LESSON}
        onApplyState={(patch) => { if (patch.presetId) setPresetId(patch.presetId); }}
        sandbox={
          <>
            <Section title="Preset de estímulo">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => setPresetId(p.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id
                        ? 'bg-gradient-to-br from-[#7c2d12]/40 to-[#0c4a6e]/40 border-[#f97316]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>{p.name}</button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-[#94A3B8] italic">{preset.note}</div>
            </Section>

            <Section title="Potencial de Nernst">
              <Row label="E_Na" value={`${fmt(E_Na_mv, 1)} mV`} />
              <Row label="E_K"  value={`${fmt(E_K_mv,  1)} mV`} />
              <Row label="E_L"  value={`${E_L} mV`} />
              <div className="mt-2 text-[10px] text-[#64748B]">
                E = (RT/zF) ln([out]/[in])<br />
                RT/F = {RT_F_mV.toFixed(1)} mV  (T=37°C)
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Estado HH (tiempo real)">
                <Row label="V"        value={`${fmt(uiState.V, 2)} mV`} highlight={uiState.V > 0} />
                <Row label="m³·h"     value={fmt(uiState.m**3 * uiState.h, 4)} />
                <Row label="n⁴"       value={fmt(uiState.n**4, 4)} />
                <Row label="I_Na"     value={`${fmt(G_NA * uiState.m**3 * uiState.h * (uiState.V - E_NA), 2)} µA`} />
                <Row label="I_K"      value={`${fmt(G_K  * uiState.n**4 * (uiState.V - E_K),  2)} µA`} />
                <Row label="t"        value={`${fmt(uiState.t, 2)} ms`} />
              </Section>
            )}

            {audience === 'child' && (
              <Section title="Lo que ves">
                <p className="text-[12px] text-[#CBD5E1] leading-relaxed">
                  Los puntos <span className="text-[#f97316]">naranjas</span> son sodio (Na⁺) — entran a la célula cuando el canal se abre.<br /><br />
                  Los puntos <span className="text-[#00e5ff]">cyan</span> son potasio (K⁺) — salen para devolver el voltaje a normal.<br /><br />
                  La curva <span className="text-[#a0ff60]">verde</span> es el voltaje de la membrana en tiempo real.
                </p>
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Parámetros de integración">
                <Slider label="dt (ms)" v={simDt} min={0.005} max={0.1} step={0.005}
                  on={v => setSimDt(v)} />
                <div className="text-[10px] text-[#64748B]">RK4 — 10 sub-pasos/frame. Inestable si dt {'>'} 0.05 ms.</div>
              </Section>
            )}

            <Section title="Ecuación maestra">
              <div className="text-[10px] font-mono text-[#CBD5E1] leading-snug space-y-0.5">
                <div className="text-white text-[11px]">C_m dV/dt = I − I_Na − I_K − I_L</div>
                <div className="text-[#94A3B8]">I_Na = g_Na m³h(V−E_Na)</div>
                <div className="text-[#94A3B8]">I_K  = g_K  n⁴(V−E_K)</div>
                <div className="text-[#94A3B8]">I_L  = g_L  (V−E_L)</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={highlight ? 'text-[#f97316]' : 'text-white'}>{value}</span>
    </div>
  );
}

function Slider({ label, v, min, max, step, on }: {
  label: string; v: number; min: number; max: number; step: number; on: (v: number) => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(3)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function IcnBtn({ children, onClick, active, title }: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
        active
          ? 'border-[#f97316]/60 text-[#f97316] bg-[#f97316]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>
      {children}
    </button>
  );
}
