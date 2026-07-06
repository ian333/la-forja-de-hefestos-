/**
 * StellarStructure — equilibrio hidrostático + politropo Lane-Emden en 3D.
 *
 * FÍSICA REAL:
 *   Ecuación de Lane-Emden:  d/dξ(ξ²·dθ/dξ) + ξ²·θⁿ = 0
 *   Integrada con RK4 desde ξ=0 (θ=1, dθ/dξ=0) hasta θ=0 (superficie).
 *   Perfil de densidad:   ρ(ξ) = ρ_c · θⁿ
 *   Presión:              P(ξ) = K · ρ^((n+1)/n)  → P ∝ θ^(n+1)
 *   Temperatura (ideal):  T(ξ) ∝ P/ρ = K·ρ^(1/n) ∝ θ
 *   Equilibrio hidrostático: dP/dr = −G·ρ·m(r)/r²
 *
 * Índices politrópicos:
 *   n=1.5  →  gas completamente convectivo (estrella de baja masa, Sun)
 *   n=3    →  solución de Eddington (GV masiva, Sol ~exacto)
 *   n=4    →  estrella muy masiva, radiación domina
 *   n=0    →  densidad uniforme (incompresible)
 *
 * Visualización: esfera de capas emisivas coloreadas por temperatura
 * (corona azul-blanca → núcleo ámbar-naranja). Point cloud con 80k partículas
 * distribuidas según ρ(r) (muestreo con rechazo). Diagrama HR en billboard.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface StellarState {
  polyIndex: number;   // índice politrópico n (0 a 5)
  showLayer: string;   // 'all' | 'density' | 'pressure' | 'temperature'
  showHR: boolean;
}

// ─── Física: integrador RK4 de Lane-Emden ───────────────────────────────────

interface LEPoint {
  xi:    number;   // variable adimensional (radio)
  theta: number;   // solución normalizada (θ=1 en centro, θ=0 en superficie)
  dtheta: number;  // derivada
  mass:  number;   // masa adimensional ξ²·|dθ/dξ| en superficie
}

function laneEmdenRK4(n: number, steps = 2000): LEPoint[] {
  // Condiciones iniciales: θ(0)=1, θ'(0)=0
  // Singularidad en ξ=0 → series de Taylor: θ≈1 - ξ²/6 + n·ξ⁴/120
  const dxi = 0.005;
  // Arrancar con paso pequeño desde ξ=ε para evitar 0/0
  const xiStart = 1e-8;
  let theta = 1 - xiStart * xiStart / 6;
  let dtheta = -xiStart / 3;
  let xi = xiStart;
  const pts: LEPoint[] = [{ xi, theta, dtheta, mass: 0 }];

  // f(ξ,θ,θ') = -θⁿ - 2/ξ·θ'  (RHS de la ecuación 2a derivada)
  const f = (xii: number, th: number, dth: number): number => {
    if (th <= 0) return 0;
    const thn = Math.pow(Math.max(th, 0), n);
    return -thn - (2 / xii) * dth;
  };

  for (let i = 0; i < steps; i++) {
    // RK4
    const k1_th = dtheta;
    const k1_dth = f(xi, theta, dtheta);

    const xi2 = xi + dxi / 2;
    const k2_th = dtheta + dxi / 2 * k1_dth;
    const k2_dth = f(xi2, theta + dxi / 2 * k1_th, dtheta + dxi / 2 * k1_dth);

    const k3_th = dtheta + dxi / 2 * k2_dth;
    const k3_dth = f(xi2, theta + dxi / 2 * k2_th, dtheta + dxi / 2 * k2_dth);

    const xi3 = xi + dxi;
    const k4_th = dtheta + dxi * k3_dth;
    const k4_dth = f(xi3, theta + dxi * k3_th, dtheta + dxi * k3_dth);

    const newTheta  = theta  + dxi / 6 * (k1_th  + 2*k2_th  + 2*k3_th  + k4_th);
    const newDtheta = dtheta + dxi / 6 * (k1_dth + 2*k2_dth + 2*k3_dth + k4_dth);
    xi += dxi;
    theta = newTheta;
    dtheta = newDtheta;

    if (theta <= 0) {
      // θ=0 → superficie de la estrella
      pts.push({ xi, theta: 0, dtheta, mass: xi * xi * Math.abs(dtheta) });
      break;
    }
    pts.push({ xi, theta, dtheta, mass: 0 });
  }
  return pts;
}

// Tabla de 256 samples del perfil de Lane-Emden
function buildProfile(n: number): Float32Array {
  const raw = laneEmdenRK4(n);
  const xiMax = raw[raw.length - 1].xi;
  const out = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const frac = i / 255;
    const xiTarget = frac * xiMax;
    // Interpolación lineal en la tabla
    let lo = 0;
    let hi = raw.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (raw[mid].xi < xiTarget) lo = mid; else hi = mid;
    }
    const t = raw[hi].xi > raw[lo].xi
      ? (xiTarget - raw[lo].xi) / (raw[hi].xi - raw[lo].xi)
      : 0;
    const theta = Math.max(0, raw[lo].theta * (1 - t) + raw[hi].theta * t);
    out[i] = theta;
  }
  return out;
}

// ─── Colores por temperatura (Wien → color) ─────────────────────────────────
// T ∝ θ; mapear θ ∈ [0,1] a color espectral negro-cuerpo simplificado
function tempToColor(theta: number): [number, number, number] {
  // Núcleo: blanco-azul. Superficie: naranja-rojo.
  const t = Math.max(0, Math.min(1, theta));
  // Interpolación manual: azul-blanco→amarillo→naranja-rojo
  if (t > 0.7) {
    // núcleo: blanco a azul-blanco
    const s = (t - 0.7) / 0.3;
    return [0.9 + 0.1 * s, 0.9 + 0.05 * s, 1.0];
  } else if (t > 0.4) {
    // zona convectiva: amarillo a blanco
    const s = (t - 0.4) / 0.3;
    return [1.0, 0.85 + 0.15 * s, 0.3 + 0.7 * s];
  } else if (t > 0.15) {
    // fotosfera: naranja a amarillo
    const s = (t - 0.15) / 0.25;
    return [1.0, 0.55 + 0.3 * s, 0.05 + 0.25 * s];
  } else {
    // cromosfera: rojo-naranja
    return [0.95 + 0.05 * t / 0.15, 0.25 + 0.3 * t / 0.15, 0.02];
  }
}

// ─── Lesson ──────────────────────────────────────────────────────────────────

const LESSON: Lesson<StellarState> = {
  hook: {
    title: 'Una estrella no colapsa. ¿Por qué? Dos fuerzas en un equilibrio perfecto.',
    body: `El Sol tiene 2×10³⁰ kg y tiene 4.6 mil millones de años de edad. Todo ese material quiere colapsar gravitacionalmente — si solo existiera la gravedad, el Sol tardaría ~29 minutos en hundirse sobre sí mismo.

No colapsa porque hay una presión que lo sostiene. No mecánica, sino TÉRMICA: el plasma caliente en el núcleo (15 millones K) empuja hacia afuera con exactamente la fuerza que necesita para equilibrar la gravedad.

Este equilibrio — hidrostático — es la condición dP/dr = −G·ρ·m(r)/r² que describe el interior de TODA estrella en la secuencia principal.

El modelo politrópico de Lane-Emden (1870) da la solución analítica de ese equilibrio en función de un solo parámetro: el índice politrópico n. La estructura completa del Sol emerge de n≈3.`,
  },

  steps: [
    {
      title: 'Equilibrio hidrostático — la ecuación maestra',
      duration: 6000,
      body: `La condición de equilibrio: la presión debe sostenerse contra su propio peso en cada capa.

dP/dr = −G·ρ(r)·m(r)/r²

Lado izquierdo: gradiente de presión hacia afuera. Lado derecho: peso de la columna de gas por unidad de área. Deben ser iguales y opuestos en cada radio r.

Combinando con la ecuación de continuidad de masa dm/dr = 4π·r²·ρ y una ecuación de estado politrópica P = K·ρ^((n+1)/n), la única solución consistente es la ecuación de Lane-Emden.

Mirá las capas: cada shell tiene su propio balance presión/gravedad.`,
      formula: 'dP/dr = −G·ρ·m(r)/r²\nd m/dr = 4π r²ρ\nP = K·ρ^((n+1)/n)',
      keyframes: [
        { at: 0, state: { polyIndex: 3, showLayer: 'pressure', showHR: false } },
        { at: 1, state: { polyIndex: 3, showLayer: 'pressure', showHR: false } },
      ],
    },
    {
      title: 'Lane-Emden n=3 — el Sol, Eddington (1926)',
      duration: 6500,
      body: `Con P ∝ ρ^(4/3) (gas ideal + radiación), la ecuación de Lane-Emden da una solución que describe el Sol con un error <5% en el perfil de densidad.

El modelo de Eddington: n=3, llamado "politropo estándar". El cociente ρ_c/ρ̄ = 54.2 — la densidad central del Sol es 54 veces la media.

La solución termina en ξ₁ = 6.897 (donde θ=0). La masa adimensional en la superficie: |ξ²·dθ/dξ|_{ξ₁} = 2.018.

En el Sol real: ρ_c = 150 g/cm³ (¡más denso que el plomo!) con T_c = 1.5×10⁷ K.`,
      formula: 'n=3:  ξ₁=6.897,  ρ_c/ρ̄=54.2\nT_c = (4/3)·μ·m_H/(k_B)·GM/R  ≈ 1.57×10⁷ K',
      keyframes: [
        { at: 0, state: { polyIndex: 3, showLayer: 'density', showHR: false } },
        { at: 1, state: { polyIndex: 3, showLayer: 'density', showHR: false } },
      ],
    },
    {
      title: 'n=1.5 — gas completamente convectivo (estrellas de baja masa)',
      duration: 6000,
      body: `Para P ∝ ρ^(5/3) (gas monoatómico adiabático, convectivo), n=1.5.

Las enanas rojas (<0.35 M☉) son COMPLETAMENTE convectivas: n=1.5 de adentro hacia afuera. Sin zona radiativa.

El perfil de densidad cae más suavemente que para n=3. La razón ρ_c/ρ̄ = 5.99 — mucho más homogénea.

La solución termina en ξ₁ = 3.654 (más compacta que el Sol). Esto es consistente con el hecho de que las enanas rojas son mucho más pequeñas y densas (en relación a su masa) que el Sol.`,
      formula: 'n=1.5:  ξ₁=3.654,  ρ_c/ρ̄=5.99\nP = K·ρ^(5/3)  (gas adiabático)',
      keyframes: [
        { at: 0, state: { polyIndex: 1.5, showLayer: 'temperature', showHR: false } },
        { at: 1, state: { polyIndex: 1.5, showLayer: 'temperature', showHR: false } },
      ],
    },
    {
      title: 'n=4 — estrella masiva, presión de radiación dominante',
      duration: 6000,
      body: `Para estrellas muy masivas (>10 M☉), la presión de radiación se vuelve comparable o dominante sobre la presión del gas.

El límite de Eddington: si la luminosidad supera L_Edd = 4πGMc/κ, la presión de radiación supera a la gravedad y la estrella pierde masa.

Con n→5, la ecuación de Lane-Emden da solución analítica, pero θ→0 solo en ξ→∞ (estrella de "radio infinito"). Las estrellas masivas están cercanas a este límite inestable.

n=4 da un compromiso: perfil de densidad con gradiente fuerte, temperatura interior muy alta, pero estructura aún estable.`,
      formula: 'L_Edd = 4πGMc/κ  (límite de estabilidad)\nn→5: θ = 1/√(1 + ξ²/3)  (analítica)',
      keyframes: [
        { at: 0, state: { polyIndex: 4, showLayer: 'all', showHR: true } },
        { at: 1, state: { polyIndex: 4, showLayer: 'all', showHR: true } },
      ],
    },
    {
      title: 'Diagrama HR — donde vive cada estrella',
      duration: 5500,
      body: `El diagrama Hertzsprung-Russell mapea luminosidad vs temperatura superficial (efectiva). Las estrellas no se distribuyen uniformemente: la secuencia principal es la región donde el equilibrio hidrostático Y la fusión nuclear son simultáneamente estables.

La posición en la secuencia principal determina todo: n politrópico, estructura interior, vida útil, destino final.

Sol: clase G, T_eff=5778 K, L=L☉, n≈3. Enana roja: clase M, T_eff<3500 K, n≈1.5. Supergigante azul: clase O, T_eff>30000 K, n≈4.

El tiempo de vida principal ∝ M/L ∝ M^(-2.5) — las más masivas viven MENOS.`,
      formula: 'τ_MS ≈ M/L ~ M^(-2.5) [años]\nL ∝ M^4  (relación masa-luminosidad)',
      keyframes: [
        { at: 0, state: { polyIndex: 3, showLayer: 'all', showHR: true } },
        { at: 1, state: { polyIndex: 3, showLayer: 'all', showHR: true } },
      ],
    },
  ],

  connect: {
    body: `El modelo politrópico de Lane-Emden es el punto de entrada a la astrofísica estelar.

De aquí emergen:
• Modelos de interior solar (helioseismología: medir el interior del Sol con ondas sonoras)
• Estructura de enanas blancas (con soporte de degeneración electrónica → n=1.5 relativista o Chandrasekhar n=3)
• Estrellas de neutrones (n=0.5 a 1, ecuación de estado desconocida → la física más extrema del universo)
• Masa de Chandrasekhar: M_Ch = 1.44 M☉ — el límite donde una enana blanca colapsa en supernova tipo Ia.

La conexión profunda: el mismo equilibrio hidrostático, la misma ecuación de Lane-Emden, pero con ecuaciones de estado radicalmente distintas para materia ordinaria → degenerada → nuclear → quark.`,
    links: [
      { label: 'Schwarzschild — métrica y horizonte de eventos', href: '#schwarzschild' },
      { label: 'Sistema Solar — N-cuerpos newtonianos', href: '#solar-system' },
      { label: 'Agujero Negro — BH Gargantua', href: '#black-hole' },
    ],
  },
};

// ─── Configuraciones de presets ──────────────────────────────────────────────

interface PolyPreset {
  n: number;
  label: string;
  starType: string;
  color: string;   // color principal de la estrella
  teff: number;    // temperatura efectiva [K] (para HR)
  logL: number;    // log10(L/L☉)
}

const POLY_PRESETS: PolyPreset[] = [
  { n: 0,   label: 'n=0 (incompresible)', starType: 'Teórica uniforme', color: '#E0E0FF', teff: 5000,  logL: 0    },
  { n: 1,   label: 'n=1',                  starType: 'Enana de neutrones*', color: '#A0C8FF', teff: 6000,  logL: 0.3  },
  { n: 1.5, label: 'n=1.5 (convectivo)',  starType: 'Enana roja (<0.35M☉)', color: '#FF6B35', teff: 3200,  logL: -1.5 },
  { n: 3,   label: 'n=3 (Eddington)',     starType: 'Sol (G2V)',            color: '#FDB813', teff: 5778,  logL: 0    },
  { n: 4,   label: 'n=4 (masiva)',        starType: 'Estrella masiva O/B',   color: '#88BBFF', teff: 25000, logL: 4.5  },
];

function findPreset(n: number): PolyPreset {
  return POLY_PRESETS.find(p => Math.abs(p.n - n) < 0.01) ?? POLY_PRESETS[3];
}

// ─── Generador de geometría de partículas ────────────────────────────────────

const N_PARTICLES = 80_000;

function buildStarCloud(
  profile: Float32Array,
  n: number,
  showLayer: string,
): THREE.BufferGeometry {
  const positions = new Float32Array(N_PARTICLES * 3);
  const colors    = new Float32Array(N_PARTICLES * 3);

  let idx = 0;
  // Muestreo por rechazo: distribuir partículas según ρ(r)=θⁿ
  // Normalizar radio a unidad (R=1)
  let attempts = 0;
  const maxAttempts = N_PARTICLES * 20;

  while (idx < N_PARTICLES && attempts < maxAttempts) {
    attempts++;
    // Punto aleatorio en esfera unitaria
    const u = Math.random() * 2 - 1;
    const v = Math.random() * 2 - 1;
    const w = Math.random() * 2 - 1;
    const r2 = u*u + v*v + w*w;
    if (r2 > 1 || r2 < 1e-10) continue;

    const r = Math.sqrt(r2);
    // Índice en tabla de perfil
    const iProf = Math.min(255, Math.floor(r * 255));
    const theta = profile[iProf];

    // Densidad local ρ ∝ θⁿ
    const rho = n > 0 ? Math.pow(Math.max(theta, 0), n) : (theta > 0 ? 1 : 0);

    // Rechazo proporcional a densidad
    if (Math.random() > rho) continue;

    // Filtrar capas
    if (showLayer === 'density'     && r > 0.5) continue;
    if (showLayer === 'pressure'    && (r < 0.3 || r > 0.7)) continue;
    if (showLayer === 'temperature' && r < 0.5) continue;

    positions[idx*3+0] = u;
    positions[idx*3+1] = v;
    positions[idx*3+2] = w;

    const [cr, cg, cb] = tempToColor(theta);
    colors[idx*3+0] = cr;
    colors[idx*3+1] = cg;
    colors[idx*3+2] = cb;
    idx++;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, idx * 3), 3));
  geom.setAttribute('color',    new THREE.BufferAttribute(colors.subarray(0, idx * 3), 3));
  return geom;
}

// ─── Componente interno (dentro del Canvas) ──────────────────────────────────

function StarSphere({ polyIndex, showLayer, showHR }: StellarState) {
  const tex = useMemo(() => getParticleTexture(), []);
  const groupRef = useRef<THREE.Group>(null);
  const shellRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pointsRef = useRef<THREE.Points>(null);

  // Recalcular perfil cuando cambia n
  const profile = useMemo(() => buildProfile(polyIndex), [polyIndex]);
  const geom    = useMemo(
    () => buildStarCloud(profile, polyIndex, showLayer),
    [profile, polyIndex, showLayer],
  );

  // Shells emisivas (capas de la estrella)
  const shellCount = 7;
  const shellData = useMemo(() => {
    return Array.from({ length: shellCount }, (_, i) => {
      const frac = (i + 1) / shellCount;
      const iProf = Math.min(255, Math.floor(frac * 255));
      const theta = profile[iProf];
      const [r, g, b] = tempToColor(theta);
      return {
        radius: frac,
        theta,
        color: new THREE.Color(r, g, b),
        emissive: new THREE.Color(r * 0.6, g * 0.5, b * 0.4),
      };
    });
  }, [profile]);

  // Rotación suave
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.07;
    }
    // Pulsar las shells más internas suavemente
    const t = performance.now() / 1000;
    shellRefs.current.forEach((m, i) => {
      if (!m) return;
      const base = shellData[i].radius;
      const pulse = 1 + 0.012 * Math.sin(t * (1.2 + i * 0.15) + i);
      m.scale.setScalar(base * pulse);
    });
  });

  const preset = findPreset(polyIndex);

  return (
    <group ref={groupRef}>
      {/* Capas de la estrella — shells semitransparentes */}
      {shellData.map((s, i) => (
        <mesh
          key={i}
          ref={el => { shellRefs.current[i] = el; }}
          scale={s.radius}
        >
          <sphereGeometry args={[1, 48, 32]} />
          <meshStandardMaterial
            color={s.color}
            emissive={s.emissive}
            emissiveIntensity={1.4 - i * 0.15}
            transparent
            opacity={0.045 + (shellCount - i) * 0.018}
            side={THREE.FrontSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Núcleo sólido emisivo */}
      <mesh>
        <sphereGeometry args={[0.08, 32, 24]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#FFFDE0"
          emissiveIntensity={4}
          toneMapped={false}
        />
      </mesh>

      {/* Nube de partículas distribuida según ρ(r) */}
      <points ref={pointsRef} geometry={geom}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.025}
          sizeAttenuation
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* Etiqueta del tipo de estrella */}
      {showHR && (
        <Html position={[1.4, 0.9, 0]} center>
          <div style={{
            color: preset.color,
            fontSize: 11,
            fontFamily: 'monospace',
            background: 'rgba(5,6,10,0.75)',
            border: `1px solid ${preset.color}55`,
            borderRadius: 4,
            padding: '3px 7px',
            whiteSpace: 'nowrap',
          }}>
            {preset.starType}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Panel de perfil radial inline ──────────────────────────────────────────

function RadialProfileChart({ profile, n }: { profile: Float32Array; n: number }) {
  const svgH = 80;
  const svgW = 230;
  const pad = { l: 28, r: 8, t: 8, b: 18 };
  const w = svgW - pad.l - pad.r;
  const h = svgH - pad.t - pad.b;

  const toX = (frac: number) => pad.l + frac * w;
  const toY = (val: number) => pad.t + (1 - val) * h;

  // ρ/ρ_c = θⁿ
  const rhoPoints: string[] = [];
  // T/T_c = θ
  const tPoints: string[] = [];
  // P/P_c = θ^(n+1)
  const pPoints: string[] = [];

  for (let i = 0; i < 256; i++) {
    const r = i / 255;
    const th = profile[i];
    const rho = n > 0 ? Math.pow(Math.max(th, 0), n) : (th > 0 ? 1 : 0);
    const temp = th;
    const pres = Math.pow(Math.max(th, 0), n + 1);
    rhoPoints.push(`${toX(r).toFixed(1)},${toY(rho).toFixed(1)}`);
    tPoints.push(`${toX(r).toFixed(1)},${toY(temp).toFixed(1)}`);
    pPoints.push(`${toX(r).toFixed(1)},${toY(pres).toFixed(1)}`);
  }

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ width: '100%', maxWidth: svgW, display: 'block', background: 'transparent' }}
    >
      {/* Ejes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + h} stroke="#334155" strokeWidth="0.8" />
      <line x1={pad.l} y1={pad.t + h} x2={pad.l + w} y2={pad.t + h} stroke="#334155" strokeWidth="0.8" />
      <text x={pad.l - 3} y={pad.t + 4} fill="#64748B" fontSize="6" textAnchor="end">1</text>
      <text x={pad.l - 3} y={pad.t + h} fill="#64748B" fontSize="6" textAnchor="end">0</text>
      <text x={pad.l} y={svgH - 2} fill="#64748B" fontSize="6">0</text>
      <text x={pad.l + w} y={svgH - 2} fill="#64748B" fontSize="6" textAnchor="end">R</text>

      {/* Curvas */}
      <polyline points={pPoints.join(' ')}  fill="none" stroke="#4FC3F7" strokeWidth="1.2" />
      <polyline points={rhoPoints.join(' ')} fill="none" stroke="#FDB813" strokeWidth="1.2" />
      <polyline points={tPoints.join(' ')}  fill="none" stroke="#F472B6" strokeWidth="1.2" />

      {/* Leyenda */}
      <circle cx={pad.l + 10} cy={pad.t + 4} r="2" fill="#4FC3F7" />
      <text x={pad.l + 14} y={pad.t + 7} fill="#4FC3F7" fontSize="6">P/P_c</text>
      <circle cx={pad.l + 45} cy={pad.t + 4} r="2" fill="#FDB813" />
      <text x={pad.l + 49} y={pad.t + 7} fill="#FDB813" fontSize="6">ρ/ρ_c</text>
      <circle cx={pad.l + 80} cy={pad.t + 4} r="2" fill="#F472B6" />
      <text x={pad.l + 84} y={pad.t + 7} fill="#F472B6" fontSize="6">T/T_c</text>
    </svg>
  );
}

// ─── Helpers UI ──────────────────────────────────────────────────────────────

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
      <span className={highlight ? 'text-[#F87171]' : 'text-white'}>{value}</span>
    </div>
  );
}

function Slider({ label, v, min, max, step, on }: {
  label: string; v: number; min: number; max: number; step: number;
  on: (v: number) => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function StellarStructure() {
  const { audience } = useAudience();

  const [polyIndex, setPolyIndex]  = useState<number>(3);
  const [showLayer, setShowLayer]  = useState<string>('all');
  const [showHR, setShowHR]        = useState<boolean>(false);

  // Pre-calcular perfil para el panel lateral
  const profile = useMemo(() => buildProfile(polyIndex), [polyIndex]);

  // Estadísticas derivadas del politropo
  const rawPts  = useMemo(() => laneEmdenRK4(polyIndex), [polyIndex]);
  const xiSurf  = rawPts[rawPts.length - 1].xi;
  const dthSurf = Math.abs(rawPts[rawPts.length - 1].dtheta);
  const massAdim = xiSurf * xiSurf * dthSurf;
  const rhoRatio = polyIndex > 0
    ? (polyIndex === 5 ? Infinity : massAdim / (3 * dthSurf / xiSurf))
    : 1;

  const preset = findPreset(polyIndex);

  // Exponer estado al LessonPanel
  const [lessonState] = useState<StellarState>({ polyIndex, showLayer, showHR });
  useEffect(() => {}, [lessonState]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      {/* Canvas 3D */}
      <div className="relative">
        <Stage
          cameraDistance={3.5}
          autoRotate={false}
          bloomIntensity={1.2}
          bloomThreshold={0.05}
          bgColor="#02040A"
        >
          <StarSphere polyIndex={polyIndex} showLayer={showLayer} showHR={showHR} />
        </Stage>

        {/* HUD — parámetros físicos */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] pointer-events-none">
          <div className="text-[#FDB813] font-semibold mb-1">{preset.label}</div>
          <div><span className="text-[#64748B]">ξ₁&nbsp;&nbsp;</span>= {xiSurf.toFixed(3)}</div>
          <div><span className="text-[#64748B]">ρ_c/ρ̄</span>= {rhoRatio.toFixed(2)}</div>
          <div><span className="text-[#64748B]">tipo</span>  = <span className="text-[#94A3B8]">{preset.starType}</span></div>
        </div>

        {/* Controles overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          {(['all', 'density', 'pressure', 'temperature'] as const).map(l => (
            <button
              key={l}
              onClick={() => setShowLayer(l)}
              className={`text-[10px] px-2 py-1 rounded border transition ${
                showLayer === l
                  ? 'border-[#FDB813]/60 text-[#FDB813] bg-[#FDB813]/10'
                  : 'border-[#1E293B] text-[#64748B] hover:text-white'
              }`}
            >
              {l === 'all' ? 'todo' : l === 'density' ? 'núcleo' : l === 'pressure' ? 'manto' : 'corteza'}
            </button>
          ))}
          <button
            onClick={() => setShowHR(h => !h)}
            className={`text-[10px] px-2 py-1 rounded border transition ${
              showHR
                ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
                : 'border-[#1E293B] text-[#64748B] hover:text-white'
            }`}
          >
            HR
          </button>
        </div>
      </div>

      {/* Panel lateral */}
      <LessonPanel<StellarState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.polyIndex !== undefined) setPolyIndex(patch.polyIndex);
          if (patch.showLayer !== undefined) setShowLayer(patch.showLayer);
          if (patch.showHR   !== undefined) setShowHR(patch.showHR);
        }}
        sandbox={
          <>
            <Section title="Índice politrópico n">
              <div className="grid grid-cols-1 gap-1.5 mb-3">
                {POLY_PRESETS.map(p => (
                  <button
                    key={p.n}
                    onClick={() => setPolyIndex(p.n)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      Math.abs(polyIndex - p.n) < 0.01
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#FDB813]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                    style={{ borderLeft: `3px solid ${p.color}55` }}
                  >
                    <span style={{ color: p.color }} className="font-mono">{p.label}</span>
                    <span className="ml-2 text-[10px] text-[#64748B]">{p.starType}</span>
                  </button>
                ))}
              </div>

              {audience === 'researcher' && (
                <Slider label="n" v={polyIndex} min={0} max={4.9} step={0.05}
                  on={v => setPolyIndex(v)} />
              )}
            </Section>

            <Section title="Perfil radial (RK4)">
              <RadialProfileChart profile={profile} n={polyIndex} />
              <div className="mt-2 text-[10px] text-[#64748B]">
                ρ(r) = ρ_c·θⁿ  |  T ∝ θ  |  P ∝ θ^(n+1)
              </div>
            </Section>

            <Section title="Parámetros (Lane-Emden)">
              <Row label="n"     value={polyIndex.toFixed(2)} />
              <Row label="ξ₁"   value={xiSurf.toFixed(4)} />
              <Row label="ρ_c/ρ̄" value={isFinite(rhoRatio) ? rhoRatio.toFixed(2) : '∞'} highlight={rhoRatio > 100} />
              <Row label="−ξ²θ'" value={massAdim.toFixed(4)} />
              <Row label="tipo"  value={preset.starType} />
            </Section>

            <Section title="Capa visible">
              {(['all', 'density', 'pressure', 'temperature'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setShowLayer(l)}
                  className={`block w-full text-left px-2 py-1.5 rounded mb-1 text-[11px] border transition ${
                    showLayer === l
                      ? 'border-[#FDB813]/40 text-[#FDB813] bg-[#FDB813]/10'
                      : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                  }`}
                >
                  {l === 'all' ? 'Toda la estrella' : l === 'density' ? 'Núcleo (ρ alta)' : l === 'pressure' ? 'Zona de presión' : 'Envolvente externa (T)'}
                </button>
              ))}
            </Section>

            <Section title="Diagrama HR">
              <button
                onClick={() => setShowHR(h => !h)}
                className={`block w-full text-center py-1.5 rounded text-[11px] border transition ${
                  showHR
                    ? 'border-[#4FC3F7]/40 text-[#4FC3F7] bg-[#4FC3F7]/10'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}
              >
                {showHR ? 'Ocultar etiqueta HR' : 'Mostrar etiqueta HR'}
              </button>
            </Section>
          </>
        }
      />
    </div>
  );
}
