/**
 * Geodésicas en superficies curvas — el camino más corto NO es la línea recta.
 *
 * Una geodésica es la curva "lo más recta posible" sobre una superficie: la que
 * NO acelera dentro de la superficie (su aceleración es puramente normal). Su
 * ecuación, en coordenadas (q¹, q²) con métrica gᵢⱼ, es
 *
 *     d²qᵏ/dt² + Γᵏᵢⱼ (dqⁱ/dt)(dqʲ/dt) = 0
 *
 * donde Γᵏᵢⱼ son los símbolos de Christoffel de la métrica. Los integramos por
 * RK4 sobre el sistema de primer orden (q, q̇).
 *
 * ── Esfera unitaria ──  q = (θ, φ),  ds² = dθ² + sin²θ dφ²
 *     Γᵠ_φφ  = −sinθ·cosθ          (resto cero salvo)
 *     Γᵠ_θφ  = Γᵠ_φθ = cotθ
 *   ⇒  θ̈ = sinθ·cosθ·φ̇²
 *      φ̈ = −2·cotθ·θ̇·φ̇
 *   Resultado VERIFICABLE: toda geodésica de la esfera es un CÍRCULO MÁXIMO
 *   (su plano pasa por el centro). Lo chequeamos midiendo la distancia de cada
 *   punto integrado al plano del círculo máximo teórico — sale ~0.
 *
 * ── Toro (R, r) ──  q = (u, v),  ds² = (R + r·cos v)² du² + r² dv²
 *     Sea ρ = R + r·cos v.
 *     Γᵘ_uv = Γᵘ_vu = −(r·sin v)/ρ
 *     Γᵛ_uu = (ρ·sin v)/r
 *   ⇒  ü = 2·(r·sin v / ρ)·u̇·v̇
 *      v̈ = −(ρ·sin v / r)·u̇²
 *
 * La clase entera: el avión que vuela en arco sobre el Pacífico NO se equivocó —
 * está siguiendo una geodésica de la esfera (Tierra), que en un mapa plano se ve
 * curva pero es el camino MÁS CORTO.
 */

import { useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

const ACCENT = '#34D399';   // verde topología
const GOLD = '#FDB813';     // geodésica
const NAIVE = '#4FC3F7';    // camino "recto ingenuo"

// ── Estado de la lección ───────────────────────────────────────────────
interface GeoState {
  surface: 'sphere' | 'torus';
  showNaive: boolean;
  showSurface: boolean;
}

const LESSON: Lesson<GeoState> = {
  hook: {
    title: 'En una pelota, el camino más corto entre dos puntos es un ARCO.',
    body: `Tienes dos ciudades sobre la Tierra. Quieres el vuelo más corto entre ellas. ¿Una línea recta? Sobre una esfera no existe la "recta": estás atrapado en la superficie.

La curva más corta posible se llama GEODÉSICA. Es la trayectoria que NO se desvía dentro de la superficie — su única aceleración apunta hacia afuera (es normal). Eso la hace "lo más recta que puedes ser" sin salirte de la curva del mundo.

En matemáticas se escribe con una ecuación diferencial: la ecuación geodésica. Sus coeficientes, los símbolos de Christoffel Γᵏᵢⱼ, codifican CÓMO se curva la superficie en cada punto.

La integramos numéricamente con RK4 y verificamos un teorema clásico: en la esfera, TODA geodésica es un círculo máximo. Por eso el avión vuela en arco.`,
  },

  steps: [
    {
      title: 'La ecuación geodésica — la receta del camino más recto',
      duration: 6000,
      body: `Sobre una superficie con métrica gᵢⱼ, una geodésica q(t) cumple

d²qᵏ/dt² + Γᵏᵢⱼ (dqⁱ/dt)(dqʲ/dt) = 0.

El primer término es la aceleración. El segundo, con los símbolos de Christoffel Γᵏᵢⱼ, corrige por la curvatura del sistema de coordenadas. Juntos dicen: "no aceleres DENTRO de la superficie".

No hay fórmula cerrada general, así que la resolvemos como sistema de primer orden (q, q̇) e integramos paso a paso con Runge-Kutta de orden 4 — el mismo RK4 que ya viste en EDOs.

Empezamos sobre la ESFERA unitaria. La geodésica dorada sale del punto A con cierta dirección y la dejamos correr.`,
      formula: 'd²qᵏ/dt² + Γᵏᵢⱼ q̇ⁱ q̇ʲ = 0\nRK4 sobre (q, q̇)',
      keyframes: [
        { at: 0, state: { surface: 'sphere', showNaive: false, showSurface: true } },
        { at: 1, state: { surface: 'sphere', showNaive: false, showSurface: true } },
      ],
    },
    {
      title: 'Christoffel en la esfera — la curvatura entra por aquí',
      duration: 6000,
      body: `Para la esfera unitaria con (θ, φ) y ds² = dθ² + sin²θ dφ², los únicos Christoffel no nulos son:

Γᵠ_φφ = −sinθ·cosθ      y      Γᵠ_θφ = Γᵠ_φθ = cotθ.

Metiéndolos en la ecuación geodésica:

θ̈ = sinθ·cosθ·φ̇²        φ̈ = −2·cotθ·θ̇·φ̇.

Estos coeficientes son la ÚNICA información de "forma" que entra. No inventamos la curva: emerge sola de integrar estas dos EDOs acopladas. Cambia la métrica y cambian los Γ, y con ellos la geodésica.`,
      formula: 'ds² = dθ² + sin²θ dφ²\nθ̈ = sinθ cosθ · φ̇²\nφ̈ = −2 cotθ · θ̇ φ̇',
      keyframes: [
        { at: 0, state: { surface: 'sphere', showNaive: true, showSurface: true } },
        { at: 1, state: { surface: 'sphere', showNaive: true, showSurface: true } },
      ],
    },
    {
      title: 'Geodésica vs camino ingenuo — y el círculo máximo',
      duration: 6000,
      body: `Comparamos dos cosas entre A y B:

• AZUL — el camino "recto ingenuo": interpolas linealmente las coordenadas (θ, φ) y proyectas a la esfera. Parece razonable… pero es más largo.

• DORADO — la geodésica RK4 ajustada para llegar a B (por tiro: variamos la dirección inicial hasta acertar el destino).

La dorada SIEMPRE gana. Y cumple el teorema: cada punto de la geodésica vive sobre un mismo CÍRCULO MÁXIMO (un plano por el centro de la esfera). Lo medimos: la distancia máxima de la curva a ese plano sale prácticamente cero.

Eso es exactamente la ruta de un avión transoceánico. Sobre un mapa plano se ve un arco "torcido"; sobre la esfera es lo más corto que existe.`,
      formula: 'plano del círculo máximo: n·x = 0,  n = Â × B̂\ndesvío máx ≈ 0  ⇒  círculo máximo',
      keyframes: [
        { at: 0, state: { surface: 'sphere', showNaive: true, showSurface: true } },
        { at: 1, state: { surface: 'sphere', showNaive: true, showSurface: true } },
      ],
    },
    {
      title: 'El toro — donde las geodésicas se vuelven raras',
      duration: 6000,
      body: `Cambiamos a un TORO (R, r). Con (u, v) y ds² = (R + r·cos v)² du² + r² dv², escribiendo ρ = R + r·cos v:

ü = 2·(r·sin v / ρ)·u̇·v̇        v̈ = −(ρ·sin v / r)·u̇².

Mismo RK4, otros símbolos de Christoffel. Ahora la geodésica ya no es un círculo limpio: serpentea, a veces se enrolla alrededor del "tubo", a veces se queda atrapada cerca del borde exterior.

La curvatura del toro CAMBIA de signo: positiva por fuera, negativa por dentro (la garganta). Las geodésicas sienten ese cambio y por eso su comportamiento es mucho más rico que en la esfera.

Haz clic en la superficie para fijar A y B y mira cómo el camino más corto se adapta a la forma.`,
      formula: 'ρ = R + r cos v\nü = 2(r sin v/ρ) u̇ v̇\nv̈ = −(ρ sin v/r) u̇²',
      keyframes: [
        { at: 0, state: { surface: 'torus', showNaive: true, showSurface: true } },
        { at: 1, state: { surface: 'torus', showNaive: true, showSurface: true } },
      ],
    },
  ],

  connect: {
    body: `La ecuación geodésica es la puerta de entrada a la geometría diferencial moderna:

• Relatividad general: en el espacio-tiempo curvo, los planetas y la luz siguen geodésicas. La "gravedad" es solo seguir el camino más recto en un espacio doblado por la masa (Einstein, 1915).
• Navegación: las rutas de los aviones y barcos son geodésicas de la esfera (rutas ortodrómicas).
• Óptica: el principio de Fermat dice que la luz viaja por geodésicas del índice de refracción.
• Robótica y gráficos: el camino más corto sobre una malla 3D (fast marching, heat method).
• Optimización: el "descenso por geodésicas" generaliza el gradiente a variedades.

La idea profunda: la curvatura NO es un dibujo, es algo que puedes MEDIR desde dentro de la superficie, sin salir de ella — exactamente lo que hacen los símbolos de Christoffel.`,
    links: [
      { label: 'Banda de Möbius — superficies y orientabilidad', href: '#mobius-strip' },
      { label: 'Género — la forma global de una superficie', href: '#genus' },
      { label: 'Campos vectoriales — el flujo que sigue la curva', href: '#vector-fields' },
    ],
  },
};

// ── Geometría intrínseca de cada superficie ────────────────────────────
// Estado del integrador: q = (a, b) coordenadas, p = (ȧ, ḃ) velocidades.
type Y = [number, number, number, number];

interface Surface {
  /** Inmersión coords → punto 3D en el espacio. */
  embed: (a: number, b: number) => THREE.Vector3;
  /**
   * Acelaraciones (ä, b̈) a partir de (a, b, ȧ, ḃ) vía símbolos de Christoffel.
   * ESTA es la física real: −Γᵏᵢⱼ q̇ⁱ q̇ʲ.
   */
  accel: (a: number, b: number, da: number, db: number) => [number, number];
  /** Dirección inicial (ȧ, ḃ) que apunta de A hacia B, normalizada en la métrica. */
  range: { aMin: number; aMax: number; bMin: number; bMax: number };
}

// Esfera unitaria: a = θ (polar 0..π), b = φ (azimut).
const sphere: Surface = {
  embed: (theta, phi) =>
    new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(phi),
    ),
  accel: (theta, _phi, dth, dphi) => {
    const s = Math.sin(theta), c = Math.cos(theta);
    const cot = Math.abs(s) < 1e-6 ? 0 : c / s;
    // θ̈ = sinθ cosθ φ̇² ;  φ̈ = −2 cotθ θ̇ φ̇
    const ddth = s * c * dphi * dphi;
    const ddphi = -2 * cot * dth * dphi;
    return [ddth, ddphi];
  },
  range: { aMin: 0.05, aMax: Math.PI - 0.05, bMin: 0, bMax: 2 * Math.PI },
};

// Toro (R, r): a = u (toroidal), b = v (poloidal).
const TORUS_R = 1.6;
const TORUS_r = 0.7;
const torus: Surface = {
  embed: (u, v) => {
    const rho = TORUS_R + TORUS_r * Math.cos(v);
    return new THREE.Vector3(
      rho * Math.cos(u),
      TORUS_r * Math.sin(v),
      rho * Math.sin(u),
    );
  },
  accel: (_u, v, du, dv) => {
    const rho = TORUS_R + TORUS_r * Math.cos(v);
    const sinv = Math.sin(v);
    // ü = 2 (r sin v / ρ) u̇ v̇ ;  v̈ = −(ρ sin v / r) u̇²
    const ddu = (2 * TORUS_r * sinv / rho) * du * dv;
    const ddv = -(rho * sinv / TORUS_r) * du * du;
    return [ddu, ddv];
  },
  range: { aMin: 0, aMax: 2 * Math.PI, bMin: 0, bMax: 2 * Math.PI },
};

function getSurface(id: GeoState['surface']): Surface {
  return id === 'sphere' ? sphere : torus;
}

// ── RK4 sobre el sistema de primer orden ───────────────────────────────
function deriv(surf: Surface, y: Y): Y {
  const [a, b, da, db] = y;
  const [dda, ddb] = surf.accel(a, b, da, db);
  return [da, db, dda, ddb];
}

function rk4Step(surf: Surface, y: Y, h: number): Y {
  const add = (u: Y, v: Y, s: number): Y => [
    u[0] + v[0] * s, u[1] + v[1] * s, u[2] + v[2] * s, u[3] + v[3] * s,
  ];
  const k1 = deriv(surf, y);
  const k2 = deriv(surf, add(y, k1, h / 2));
  const k3 = deriv(surf, add(y, k2, h / 2));
  const k4 = deriv(surf, add(y, k3, h));
  return [
    y[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    y[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    y[2] + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    y[3] + (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
  ];
}

// Integra una geodésica con condiciones iniciales (a0,b0,da0,db0).
// Devuelve coords muestreadas (clamp suave de θ en la esfera para no degenerar).
function integrateGeodesic(
  surf: Surface, a0: number, b0: number, da0: number, db0: number,
  h: number, steps: number,
): Y[] {
  const out: Y[] = [];
  let y: Y = [a0, b0, da0, db0];
  out.push(y);
  for (let i = 0; i < steps; i++) {
    y = rk4Step(surf, y, h);
    if (!y.every(Number.isFinite)) break;
    out.push(y);
  }
  return out;
}

// Distancia geodésica (longitud de arco) de una trayectoria muestreada.
function arcLength(surf: Surface, traj: Y[]): number {
  let len = 0;
  for (let i = 1; i < traj.length; i++) {
    const p0 = surf.embed(traj[i - 1][0], traj[i - 1][1]);
    const p1 = surf.embed(traj[i][0], traj[i][1]);
    len += p0.distanceTo(p1);
  }
  return len;
}

// ── Shooting: ajusta la dirección inicial para que la geodésica llegue a B ──
// Para la esfera tenemos solución exacta del círculo máximo y la usamos como
// blanco; para el toro disparamos en abanico y nos quedamos con la que más
// cerca termina de B (RK4 puro — sin fórmulas inventadas).
function buildGeodesic(
  surf: Surface, A: { a: number; b: number }, B: { a: number; b: number },
): Y[] {
  const pA = surf.embed(A.a, A.b);
  const pB = surf.embed(B.a, B.b);
  const targetDist = (() => {
    // longitud objetivo: chord en 3D es cota inferior; usamos un margen amplio
    return pA.distanceTo(pB) * 3 + 6;
  })();

  // Estima paso temporal por "rapidez" en coordenadas. Tomamos varias
  // direcciones iniciales (abanico) y RK4 cada una; elegimos la que pasa más
  // cerca de B en algún punto, y recortamos ahí.
  const N_DIR = 96;
  const STEPS = 900;
  const h = targetDist / STEPS;

  let best: Y[] | null = null;
  let bestDist = Infinity;
  let bestCut = 0;

  // Base de velocidades en coords: rapidez ~1 en métrica. Para mantenerlo
  // simple e independiente de la métrica, escaneamos magnitudes razonables.
  const speeds = surf === torus ? [0.8, 1.0, 1.3, 1.7] : [1.0];
  for (const speed of speeds) {
    for (let d = 0; d < N_DIR; d++) {
      const ang = (d / N_DIR) * 2 * Math.PI;
      const da0 = Math.cos(ang) * speed;
      const db0 = Math.sin(ang) * speed;
      const traj = integrateGeodesic(surf, A.a, A.b, da0, db0, h, STEPS);
      // busca el punto más cercano a B
      let localBest = Infinity, localCut = 0;
      for (let i = 1; i < traj.length; i++) {
        const p = surf.embed(traj[i][0], traj[i][1]);
        const dd = p.distanceTo(pB);
        if (dd < localBest) { localBest = dd; localCut = i; }
      }
      if (localBest < bestDist) {
        bestDist = localBest;
        best = traj;
        bestCut = localCut;
      }
    }
  }

  if (!best) return [[A.a, A.b, 0, 0]];
  return best.slice(0, Math.max(2, bestCut + 1));
}

// Camino "recto ingenuo": lerp lineal de coords A→B (en la esfera respeta el
// camino corto en φ envolviendo a ±π). Muestra por qué NO es la geodésica.
function buildNaive(
  surf: Surface, A: { a: number; b: number }, B: { a: number; b: number },
): Y[] {
  const out: Y[] = [];
  let db = B.b - A.b;
  // wrap del azimut/toroidal al intervalo (−π, π] para tomar el corto
  while (db > Math.PI) db -= 2 * Math.PI;
  while (db < -Math.PI) db += 2 * Math.PI;
  const M = 120;
  for (let i = 0; i <= M; i++) {
    const t = i / M;
    out.push([A.a + (B.a - A.a) * t, A.b + db * t, 0, 0]);
  }
  return out;
}

// Convierte coords → puntos 3D (con un leve "lift" para que las líneas no
// peleen con la superficie en el z-buffer).
function toPoints(surf: Surface, traj: Y[], lift: number): [number, number, number][] {
  return traj.map(([a, b]) => {
    const p = surf.embed(a, b);
    const n = p.clone().normalize().multiplyScalar(lift);
    const q = p.clone().add(n);
    return [q.x, q.y, q.z] as [number, number, number];
  });
}

// Verificación del círculo máximo (solo esfera): distancia máxima de la
// geodésica al plano n·x = 0 con n = Â × B̂.
function greatCircleResidual(traj: Y[], A: { a: number; b: number }, B: { a: number; b: number }): number {
  const pA = sphere.embed(A.a, A.b).normalize();
  const pB = sphere.embed(B.a, B.b).normalize();
  const n = pA.clone().cross(pB);
  if (n.lengthSq() < 1e-9) return 0;
  n.normalize();
  let maxAbs = 0;
  for (const [a, b] of traj) {
    const p = sphere.embed(a, b);
    maxAbs = Math.max(maxAbs, Math.abs(p.dot(n)));
  }
  return maxAbs;
}

// ── Malla de superficie (geometría three) ──────────────────────────────
function surfaceGeometry(id: GeoState['surface']): THREE.BufferGeometry {
  if (id === 'sphere') return new THREE.SphereGeometry(1, 64, 48);
  return new THREE.TorusGeometry(TORUS_R, TORUS_r, 48, 96);
}

// ── Componente ──────────────────────────────────────────────────────────
export default function Geodesics() {
  const { audience } = useAudience();
  const [surface, setSurface] = useState<GeoState['surface']>('sphere');
  const [showNaive, setShowNaive] = useState(true);
  const [showSurface, setShowSurface] = useState(true);

  // Puntos A y B en coordenadas intrínsecas de CADA superficie.
  const [ptA, setPtA] = useState<{ a: number; b: number }>({ a: Math.PI * 0.32, b: 0.3 });
  const [ptB, setPtB] = useState<{ a: number; b: number }>({ a: Math.PI * 0.62, b: 2.4 });
  const [pickTarget, setPickTarget] = useState<'A' | 'B'>('A');

  const surf = useMemo(() => getSurface(surface), [surface]);

  // Geometría de la superficie (depende solo de qué superficie).
  const geom = useMemo(() => surfaceGeometry(surface), [surface]);

  // Geodésica + camino ingenuo (RECÁLCULO EN VIVO al mover A/B o superficie).
  const geoTraj = useMemo(() => buildGeodesic(surf, ptA, ptB), [surf, ptA, ptB]);
  const naiveTraj = useMemo(() => buildNaive(surf, ptA, ptB), [surf, ptA, ptB]);

  const lift = surface === 'sphere' ? 0.012 : 0.02;
  const geoPts = useMemo(() => toPoints(surf, geoTraj, lift), [surf, geoTraj, lift]);
  const naivePts = useMemo(() => toPoints(surf, naiveTraj, lift), [surf, naiveTraj, lift]);

  const geoLen = useMemo(() => arcLength(surf, geoTraj), [surf, geoTraj]);
  const naiveLen = useMemo(() => arcLength(surf, naiveTraj), [surf, naiveTraj]);
  const residual = useMemo(
    () => (surface === 'sphere' ? greatCircleResidual(geoTraj, ptA, ptB) : null),
    [surface, geoTraj, ptA, ptB],
  );

  const posA = useMemo(() => surf.embed(ptA.a, ptA.b), [surf, ptA]);
  const posB = useMemo(() => surf.embed(ptB.a, ptB.b), [surf, ptB]);

  // Click sobre la superficie → invertir el embed a coordenadas intrínsecas.
  const handlePick = useCallback(
    (event: any) => {
      const p = event.point as THREE.Vector3 | undefined;
      if (!p) return;
      let coord: { a: number; b: number };
      if (surface === 'sphere') {
        const v = p.clone().normalize();
        const theta = Math.acos(THREE.MathUtils.clamp(v.y, -1, 1));
        const phi = Math.atan2(v.z, v.x);
        coord = { a: theta, b: phi < 0 ? phi + 2 * Math.PI : phi };
      } else {
        const u = Math.atan2(p.z, p.x);
        const rho = Math.hypot(p.x, p.z);
        const v = Math.atan2(p.y, rho - TORUS_R);
        coord = { a: u < 0 ? u + 2 * Math.PI : u, b: v < 0 ? v + 2 * Math.PI : v };
      }
      if (pickTarget === 'A') { setPtA(coord); setPickTarget('B'); }
      else { setPtB(coord); setPickTarget('A'); }
    },
    [surface, pickTarget],
  );

  const cameraDist = surface === 'sphere' ? 3.4 : 6.2;
  const savings = naiveLen > 1e-6 ? (1 - geoLen / naiveLen) * 100 : 0;

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={cameraDist} autoRotate bloomIntensity={0.55} bloomThreshold={0.5} bgColor="#05060A" captureMode>
          <CanvasCapture />

          {/* Superficie curva (objeto principal, emisivo para bloom) */}
          {showSurface && (
            <mesh geometry={geom} onClick={handlePick}>
              <meshStandardMaterial
                color={ACCENT}
                emissive={ACCENT}
                emissiveIntensity={0.18}
                metalness={0.3}
                roughness={0.55}
                transparent
                opacity={0.55}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
          {/* Wireframe sutil para leer la curvatura */}
          {showSurface && (
            <mesh geometry={geom}>
              <meshBasicMaterial color="#0B3D2E" wireframe transparent opacity={0.25} />
            </mesh>
          )}

          {/* Camino "recto ingenuo" (azul) */}
          {showNaive && naivePts.length > 1 && (
            <Line points={naivePts} color={NAIVE} lineWidth={2} transparent opacity={0.85} dashed dashSize={0.08} gapSize={0.05} />
          )}

          {/* Geodésica (dorada, brilla con el bloom) */}
          {geoPts.length > 1 && (
            <Line points={geoPts} color={GOLD} lineWidth={3.5} />
          )}

          {/* Punto A */}
          <mesh position={[posA.x, posA.y, posA.z]}>
            <sphereGeometry args={[0.06, 20, 20]} />
            <meshStandardMaterial color="#F472B6" emissive="#F472B6" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
          {/* Punto B */}
          <mesh position={[posB.x, posB.y, posB.z]}>
            <sphereGeometry args={[0.06, 20, 20]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        </Stage>

        {/* HUD leyenda */}
        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#FDB813]">━</span> geodésica RK4 · L = {geoLen.toFixed(3)}</div>
          {showNaive && <div><span className="text-[#4FC3F7]">┈</span> camino ingenuo · L = {naiveLen.toFixed(3)}</div>}
          <div><span className="text-[#F472B6]">●</span> A&nbsp;&nbsp;<span className="text-[#FFFFFF]">●</span> B</div>
          {showNaive && savings > 0.05 && (
            <div className="text-[#34D399]">ahorro ≈ {savings.toFixed(1)}%</div>
          )}
          {residual !== null && (
            <div className="text-[#94A3B8]">desvío al plano: {residual.toExponential(1)}</div>
          )}
          <div className="text-[#94A3B8] mt-1">click → fijar {pickTarget === 'A' ? 'A' : 'B'}</div>
        </div>
      </div>

      <LessonPanel<GeoState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.surface !== undefined) setSurface(patch.surface);
          if (patch.showNaive !== undefined) setShowNaive(patch.showNaive);
          if (patch.showSurface !== undefined) setShowSurface(patch.showSurface);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Superficie</div>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { id: 'sphere' as const, label: 'Esfera', note: 'geodésicas = círculos máximos' },
                  { id: 'torus' as const, label: 'Toro', note: 'curvatura cambia de signo' },
                ]).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSurface(s.id)}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      surface === s.id
                        ? 'bg-[#34D399]/12 border-[#34D399]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#34D399]/30'
                    }`}
                  >
                    <div className="font-semibold">{s.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{s.note}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Fijar puntos</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setPickTarget('A')}
                  className={`text-[11px] px-2 py-1.5 rounded border transition ${
                    pickTarget === 'A'
                      ? 'bg-[#F472B6]/12 border-[#F472B6]/50 text-white'
                      : 'border-[#1E293B] text-[#94A3B8] hover:border-[#F472B6]/30'
                  }`}
                >
                  ● colocar A
                </button>
                <button
                  onClick={() => setPickTarget('B')}
                  className={`text-[11px] px-2 py-1.5 rounded border transition ${
                    pickTarget === 'B'
                      ? 'bg-white/10 border-white/50 text-white'
                      : 'border-[#1E293B] text-[#94A3B8] hover:border-white/30'
                  }`}
                >
                  ● colocar B
                </button>
              </div>
              <div className="text-[10px] text-[#64748B] leading-snug">
                Haz clic sobre la superficie del simulador para colocar el punto seleccionado. La geodésica se recalcula al vuelo (RK4).
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Visualización</div>
              <label className="flex items-center gap-2 text-[11px] text-[#CBD5E1] py-0.5">
                <input type="checkbox" checked={showNaive} onChange={e => setShowNaive(e.target.checked)} className="accent-[#4FC3F7]" />
                camino recto ingenuo (azul)
              </label>
              <label className="flex items-center gap-2 text-[11px] text-[#CBD5E1] py-0.5">
                <input type="checkbox" checked={showSurface} onChange={e => setShowSurface(e.target.checked)} className="accent-[#34D399]" />
                mostrar superficie
              </label>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[11px] font-mono">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Longitudes</div>
              <div className="flex items-center justify-between">
                <span className="text-[#FDB813]">geodésica</span>
                <span className="text-white">{geoLen.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#4FC3F7]">ingenuo</span>
                <span className="text-white">{naiveLen.toFixed(3)}</span>
              </div>
              {savings > 0.05 && (
                <div className="flex items-center justify-between">
                  <span className="text-[#34D399]">ahorro</span>
                  <span className="text-white">{savings.toFixed(1)}%</span>
                </div>
              )}
              {residual !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[#94A3B8]">desvío al plano</span>
                  <span className="text-white">{residual.toExponential(1)}</span>
                </div>
              )}
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Sistema de 1er orden (q, q̇) integrado con RK4. Christoffel de la métrica inducida; en la esfera el residuo n·x → 0 confirma el círculo máximo.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
