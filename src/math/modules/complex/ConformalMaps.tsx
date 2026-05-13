/**
 * Mapas conformes — Needham §4-5 / Kreyszig "Advanced Engineering Math" §17.
 *
 * Una función holomorfa f: ℂ → ℂ con f'(z) ≠ 0 es CONFORME: localmente
 * preserva los ángulos. Eso es lo que la convierte en la herramienta de
 * ingeniería más subestimada del siglo XX.
 *
 * EL caso canónico: la transformación de Joukowski
 *
 *   w = z + c²/z
 *
 * Mapea un círculo en el plano z a un perfil de ala en el plano w. Si en el
 * plano z resolvés flujo potencial alrededor del círculo (problema trivial),
 * el mapeo te REGALA el flujo alrededor del ala correspondiente (problema
 * que de otro modo necesita CFD).
 *
 * Pero la magia más profunda es esta: la MISMA matemática describe
 *   - Flujo aerodinámico 2D irrotacional (función de corriente ψ)
 *   - Campo electrostático 2D en vacío (potencial complejo Φ + iψ)
 *   - Conducción de calor estacionario en 2D
 *   - Sumideros/fuentes de fluido (= cargas eléctricas)
 *
 * Es decir: si entendés el mapa de Joukowski para alas, también podés diseñar
 * la geometría de un capacitor con campo uniforme.
 *
 * Tercera vista: el disco de Poincaré. La misma familia conforme da la
 * geometría hiperbólica de Lobachevsky — donde la suma de ángulos del
 * triángulo es < π y las rectas son arcos perpendiculares al borde.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface ConformalLessonState {
  preset: string;
  alpha: number;       // ángulo de ataque (rad)
  offsetX: number;     // descentrado del círculo en X (genera asimetría)
  offsetY: number;     // descentrado en Y (genera lift)
}

// ── Complex helpers ────────────────────────────────────────────────────

type C = [number, number];

const c = {
  add: (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]],
  sub: (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]],
  mul: (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a: C, b: C): C => {
    const denom = b[0] * b[0] + b[1] * b[1];
    if (denom < 1e-12) return [NaN, NaN];
    return [(a[0] * b[0] + a[1] * b[1]) / denom, (a[1] * b[0] - a[0] * b[1]) / denom];
  },
  abs: (a: C): number => Math.hypot(a[0], a[1]),
  exp: (a: C): C => {
    const e = Math.exp(a[0]);
    return [e * Math.cos(a[1]), e * Math.sin(a[1])];
  },
};

// ── Joukowski ─────────────────────────────────────────────────────────

// w = z + c²/z. Aquí fijamos c = 1.
const JOUK_C = 1;

function joukowski(z: C): C {
  return c.add(z, c.div([JOUK_C * JOUK_C, 0], z));
}

// ── Streamline trace for flow past a cylinder ─────────────────────────
//
// Potential flow past a cylinder of radius R at angle α:
//   Φ(z) = U·(z·e^(-iα) + R²·e^(iα)/z)
//   Complex velocity (conjugate of velocity vector):
//     dΦ/dz = U·(e^(-iα) − R²·e^(iα)/z²)
//   Real velocity (u, v) = (Re(dΦ/dz), -Im(dΦ/dz))

function flowVelocity(
  z: C, R: number, alpha: number, zc: C, gamma: number
): { u: number; v: number } {
  // Move into the cylinder's frame
  const zRel = c.sub(z, zc);
  // Far-field velocity at angle α
  const eMinusIα: C = [Math.cos(alpha), -Math.sin(alpha)];
  const ePlusIα: C  = [Math.cos(alpha), +Math.sin(alpha)];
  const RsqOverZsq = c.div([R * R, 0], c.mul(zRel, zRel));
  // dΦ/dz = e^(-iα) - R²e^(iα)/z² + (Γ/2πi)/z
  // Vortex term (gamma) puts circulation — gives lift (Kutta condition)
  const vortexTerm = c.div([0, -gamma / (2 * Math.PI)], zRel);
  const dPhi = c.add(
    c.sub(eMinusIα, c.mul(ePlusIα, RsqOverZsq)),
    vortexTerm,
  );
  return { u: dPhi[0], v: -dPhi[1] };
}

function traceStreamline(
  startX: number, startY: number, R: number, alpha: number, zc: C, gamma: number,
  steps: number, dt: number,
): C[] {
  const pts: C[] = [];
  let x = startX, y = startY;
  for (let i = 0; i < steps; i++) {
    pts.push([x, y]);
    // RK4
    const k1 = flowVelocity([x, y], R, alpha, zc, gamma);
    const k2 = flowVelocity([x + 0.5 * dt * k1.u, y + 0.5 * dt * k1.v], R, alpha, zc, gamma);
    const k3 = flowVelocity([x + 0.5 * dt * k2.u, y + 0.5 * dt * k2.v], R, alpha, zc, gamma);
    const k4 = flowVelocity([x + dt * k3.u, y + dt * k3.v], R, alpha, zc, gamma);
    x += (dt / 6) * (k1.u + 2 * k2.u + 2 * k3.u + k4.u);
    y += (dt / 6) * (k1.v + 2 * k2.v + 2 * k3.v + k4.v);
    if (Math.abs(x) > 3 || Math.abs(y) > 3) { pts.push([x, y]); break; }
    // Don't enter the cylinder
    const drx = x - zc[0], dry = y - zc[1];
    if (drx * drx + dry * dry < R * R * 0.98) break;
  }
  return pts;
}

// ── Joukowski airfoil from circle ─────────────────────────────────────
// Pick a circle that passes through z = +1 (so its image has a cusp = trailing edge).
// Center zc = (offsetX, offsetY); radius R = |zc - (1, 0)|.

function airfoilCircleParams(offsetX: number, offsetY: number): { zc: C; R: number } {
  const zc: C = [offsetX, offsetY];
  const R = Math.hypot(1 - offsetX, -offsetY);
  return { zc, R };
}

// Kutta condition gives circulation Γ = -4πU·R·sin(α + β) where β = atan2(offsetY, 1 - offsetX)
function kuttaCirculation(R: number, alpha: number, zc: C): number {
  const beta = Math.atan2(zc[1], 1 - zc[0]);
  return -4 * Math.PI * R * Math.sin(alpha + beta);
}

// ── Sample a closed curve along the airfoil contour ────────────────────

function sampleCircleContour(zc: C, R: number, n: number): C[] {
  const out: C[] = [];
  for (let i = 0; i <= n; i++) {
    const θ = (2 * Math.PI * i) / n;
    out.push([zc[0] + R * Math.cos(θ), zc[1] + R * Math.sin(θ)]);
  }
  return out;
}

// ── Hyperbolic geodesics on Poincaré disk ──────────────────────────────
// A "line" in the Poincaré disk model is either a diameter or a circular
// arc that meets the unit boundary at right angles.
//
// Build a geodesic between two boundary points e^(iφ₁), e^(iφ₂):
//   Center is at (cos((φ₁+φ₂)/2)/cos((φ₂-φ₁)/2), sin(...)/cos(...))
//   Radius = tan((φ₂-φ₁)/2)
// If the two points are antipodal (φ₂ = φ₁ + π), it's a diameter.

function geodesicArc(phi1: number, phi2: number, n: number): C[] {
  const half = (phi2 - phi1) / 2;
  const mid = (phi1 + phi2) / 2;
  // Diameter case
  if (Math.abs(Math.sin(half)) < 1e-3) {
    return [
      [Math.cos(phi1), Math.sin(phi1)],
      [Math.cos(phi2), Math.sin(phi2)],
    ];
  }
  const cx = Math.cos(mid) / Math.cos(half);
  const cy = Math.sin(mid) / Math.cos(half);
  const r = Math.abs(Math.tan(half));
  // Find the arc parameters that go from one boundary point to the other
  const a1 = Math.atan2(Math.sin(phi1) - cy, Math.cos(phi1) - cx);
  const a2 = Math.atan2(Math.sin(phi2) - cy, Math.cos(phi2) - cx);
  let da = a2 - a1;
  // Normalize to short arc
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const out: C[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const θ = a1 + da * t;
    out.push([cx + r * Math.cos(θ), cy + r * Math.sin(θ)]);
  }
  return out;
}

// ── Lesson ────────────────────────────────────────────────────────────

const LESSON: Lesson<ConformalLessonState> = {
  hook: {
    title: 'Una sola fórmula convierte un círculo en un ala — y resuelve el flujo de aire gratis.',
    body: `La transformación de Joukowski:    w = z + 1/z

Aplicale eso a un círculo levemente descentrado del origen y obtenés el perfil de un ALA. Pero la verdadera magia es esta:

En el plano z (con el círculo), resolvés algo aburrido: flujo de fluido alrededor de un cilindro. Lo sabés desde la facultad: las líneas se deforman, vuelven a juntarse, no hay sustentación.

En el plano w (con el ala), el MISMO flujo aparece automáticamente — pero ahora alrededor de un ALA. Con ángulo de ataque, las líneas son ASIMÉTRICAS arriba/abajo, y eso es exactamente el origen de la sustentación.

Y aquí viene el SHOCK: la misma matemática (función de corriente ψ = Im(Φ), potencial φ = Re(Φ)) describe:
  • Flujo aerodinámico 2D
  • Campo electrostático 2D (las líneas de campo eléctrico son las "streamlines")
  • Conducción de calor estacionario
  • Difusión

Es decir — i (la unidad imaginaria) NO es un truco; es la herramienta que UNIFICA aerodinámica y electromagnetismo en el plano.`,
  },

  steps: [
    {
      title: 'Mapeo geométrico puro — círculo → ala',
      duration: 5500,
      body: `Empezá sin flujo. Solo el contorno.

A la izquierda: un círculo descentrado a (-0.1, 0.05), radio elegido para pasar por z = 1 (eso fabrica la "punta" del borde de salida — el famoso "cusp").

A la derecha: lo mismo después de w = z + 1/z. Lo que era un círculo es ahora un perfil de ala — borde de ataque redondo, borde de salida puntiagudo.

La transformación NO destruye los ángulos locales — eso es lo que "conforme" significa. Solo los enrolla.`,
      formula: 'w = z + 1/z      (círculo con cusp → airfoil)',
      keyframes: [
        { at: 0, state: { preset: 'joukowski-geometric', alpha: 0, offsetX: -0.1, offsetY: 0.05 } },
        { at: 1, state: { preset: 'joukowski-geometric', alpha: 0, offsetX: -0.1, offsetY: 0.05 } },
      ],
    },
    {
      title: 'Flujo simétrico — sin sustentación',
      duration: 5500,
      body: `Ahora viento horizontal U sobre el círculo. α = 0, sin circulación.

A la izquierda ves las streamlines clásicas: el aire se separa en el frente, abraza el círculo, se recombina atrás. Patrón simétrico arriba/abajo → empuje neto vertical = 0.

A la derecha, las MISMAS streamlines aparecen alrededor del ala. Pero como α = 0 y el ala es casi simétrica, tampoco hay sustentación.

Esto es lo que Newton creyó (mal) que pasaba siempre. Los aviones no volarían.`,
      formula: 'Φ(z) = U·(z + R²/z)        (sin ángulo de ataque)',
      keyframes: [
        { at: 0, state: { preset: 'joukowski-flow', alpha: 0, offsetX: -0.1, offsetY: 0.05 } },
        { at: 1, state: { preset: 'joukowski-flow', alpha: 0, offsetX: -0.1, offsetY: 0.05 } },
      ],
    },
    {
      title: 'Ángulo de ataque → SUSTENTACIÓN nace',
      duration: 6500,
      body: `Inclino el viento un ángulo α = 15° respecto al ala. Ahora las streamlines del LADO superior se aprietan, las del INFERIOR se relajan — Bernoulli dice que arriba la presión BAJA y abajo SUBE.

Resultado: fuerza neta hacia ARRIBA. Eso es sustentación.

La condición de Kutta impone una circulación específica Γ = −4πUR·sin(α + β) para que el flujo salga LIMPIO por el borde de salida (sin oscilación infinita).

En la realidad esto se logra por la viscosidad que arranca al despegar — el famoso "starting vortex" que queda detrás del avión.`,
      formula: 'Γ_Kutta = −4πUR·sin(α + β)\nL = ρ·U·Γ    (Kutta-Joukowski)',
      keyframes: [
        { at: 0, state: { preset: 'joukowski-flow', alpha: 0.0,  offsetX: -0.1, offsetY: 0.05 } },
        { at: 1, state: { preset: 'joukowski-flow', alpha: 0.26, offsetX: -0.1, offsetY: 0.05 } },
      ],
    },
    {
      title: 'Curvatura del ala — más asimetría, más lift',
      duration: 6000,
      body: `Aumento el descentrado vertical del círculo. El ala se vuelve más CURVA (más camber). Más asimetría → más sustentación por el mismo ángulo de ataque.

Esto es por qué las alas reales NO son simétricas, son curvas hacia abajo en la parte inferior. La curvatura ya da sustentación incluso sin ángulo de ataque.

Sliders en sandbox: jugá con α y con la posición del centro del círculo. Ves directamente cómo cambia la forma del ala y su comportamiento aerodinámico.`,
      formula: 'L = ρUΓ\nΓ = −4πUR·sin(α + atan(y₀/(1-x₀)))',
      keyframes: [
        { at: 0, state: { preset: 'joukowski-flow', alpha: 0.18, offsetX: -0.1,  offsetY: 0.05 } },
        { at: 1, state: { preset: 'joukowski-flow', alpha: 0.18, offsetX: -0.15, offsetY: 0.18 } },
      ],
    },
    {
      title: 'El plano hiperbólico — Poincaré disk',
      duration: 5000,
      body: `Cambio de escena. Mismo análisis complejo, otra geometría: el disco de Poincaré.

Cada arco coloreado es una RECTA en geometría hiperbólica — la "recta" más corta entre dos puntos del disco. Las rectas son arcos circulares perpendiculares al borde unitario.

En este mundo, la suma de los ángulos de un triángulo es MENOR que π. Los modelos de Escher con peces que se hacen infinitamente chiquitos hacia el borde están dibujados acá.

Y todas las isometrías de este plano son... transformaciones de Möbius. Bumeang teórico: lo de la primera clase.`,
      formula: 'd_hyper(z, w) = arctanh(|z − w|/|1 − z̄w|)\nIsometrías = SU(1,1) ≅ subgrupo de Möbius',
      keyframes: [
        { at: 0, state: { preset: 'poincare', alpha: 0, offsetX: 0, offsetY: 0 } },
        { at: 1, state: { preset: 'poincare', alpha: 0, offsetX: 0, offsetY: 0 } },
      ],
    },
  ],

  connect: {
    body: `Mapas conformes son la base de:

• Diseño aerodinámico clásico — antes del CFD, TODA ala se calculaba con Joukowski + correcciones (Theodorsen, Karman-Trefftz). El método sigue siendo el "first cut" en aero educativa.

• Electromagnetismo 2D — un capacitor de cualquier forma se calcula resolviendo flujo potencial alrededor del electrodo y aplicando el mapeo conforme. Las "streamlines" SON las líneas de campo eléctrico. Idéntico math.

• Conducción térmica — Φ = T da el campo de temperatura estacionario, ψ = flujo de calor.

• Cartografía — la proyección Mercator es CONFORME. Los meridianos y paralelos siguen siendo perpendiculares (preserva ángulos). Por eso navegar con compás funciona en un mapa Mercator.

• Geometría hiperbólica — relatividad general en 2+1D, modelos de Escher, sustrato de la cuántica de cuerdas.

El truco común: una vez que tenés una solución analítica en geometría simple (cilindro, semi-plano, disco), CUALQUIER otra geometría con la misma topología sale por composición conforme. Es magia, pero es magia con licencia profesional.`,
    links: [
      { label: 'Campos EM (líneas de E = streamlines)', href: '/physics.html#em/fields' },
      { label: 'Möbius — isometrías del disco de Poincaré', href: '#complex/mobius' },
      { label: 'Newton fractals — la otra mitad de Análisis Complejo', href: '#complex/roots' },
    ],
  },
};

// ── Component ─────────────────────────────────────────────────────────

const Z_OFFSET = -2.8;
const W_OFFSET = 2.8;

export default function ConformalMaps() {
  const { audience } = useAudience();
  const [preset, setPreset] = useState<'joukowski-geometric' | 'joukowski-flow' | 'poincare'>('joukowski-flow');
  const [alpha, setAlpha] = useState(0.26);
  const [offsetX, setOffsetX] = useState(-0.1);
  const [offsetY, setOffsetY] = useState(0.05);

  const { zc, R } = useMemo(() => airfoilCircleParams(offsetX, offsetY), [offsetX, offsetY]);
  const gamma = useMemo(() => kuttaCirculation(R, alpha, zc), [R, alpha, zc]);

  // Airfoil contour (in z plane and w plane)
  const cylinderPts = useMemo(() => sampleCircleContour(zc, R, 120), [zc, R]);
  const airfoilPts = useMemo(() => cylinderPts.map(joukowski), [cylinderPts]);

  // Streamlines (only when flow is on)
  const streamlines = useMemo(() => {
    if (preset !== 'joukowski-flow') return [];
    const lines: { color: string; zPts: C[]; wPts: C[] }[] = [];
    const startsY = [-1.8, -1.4, -1.0, -0.65, -0.3, 0.0, 0.3, 0.65, 1.0, 1.4, 1.8];
    const palette = ['#4FC3F7', '#82B1FF', '#A78BFA', '#F472B6', '#FB7185', '#FDB813', '#A3E635', '#34D399', '#22D3EE', '#60A5FA', '#A78BFA'];
    for (let i = 0; i < startsY.length; i++) {
      const y0 = startsY[i];
      const zPts = traceStreamline(-2.6, y0, R, alpha, zc, gamma, 380, 0.022);
      const wPts = zPts.map(joukowski);
      lines.push({ color: palette[i % palette.length], zPts, wPts });
    }
    return lines;
  }, [preset, R, alpha, zc, gamma]);

  // Poincaré geodesics (only when active)
  const geodesics = useMemo(() => {
    if (preset !== 'poincare') return [];
    const arcs: { color: string; pts: C[] }[] = [];
    const palette = ['#F472B6', '#4FC3F7', '#FDB813', '#34D399', '#A78BFA', '#FB7185', '#60A5FA', '#A3E635'];
    // A pencil of geodesics through different boundary pairs
    const N = 8;
    for (let i = 0; i < N; i++) {
      const phi1 = (2 * Math.PI * i) / N;
      const phi2 = phi1 + 2 * Math.PI * 3 / 7;  // irrational-ish to give variety
      arcs.push({ color: palette[i % palette.length], pts: geodesicArc(phi1, phi2, 60) });
    }
    return arcs;
  }, [preset]);

  // 3D rendering helpers
  const lift = useMemo(() => {
    if (preset !== 'joukowski-flow') return 0;
    // L' = ρ U Γ → per unit span; we'll display in arbitrary "units" with ρ=U=1
    return -gamma; // magnitude (gamma is negative for positive lift in this sign convention)
  }, [preset, gamma]);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={preset === 'poincare' ? 4 : 7.5} bloomIntensity={0.45} bloomThreshold={0.6}>
          {preset !== 'poincare' && (
            <>
              {/* z plane backdrop */}
              <PlaneBackdrop center={[Z_OFFSET, 0, 0]} label="plano z (cilindro)" />
              {/* w plane backdrop */}
              <PlaneBackdrop center={[W_OFFSET, 0, 0]} label="plano w (ala)" />

              {/* Cylinder on left */}
              <Line
                points={cylinderPts.map(p => [Z_OFFSET + p[0], p[1], 0] as [number, number, number])}
                color="#FDB813"
                lineWidth={2}
              />
              {/* Airfoil on right */}
              <Line
                points={airfoilPts.map(p => [W_OFFSET + clamp(p[0]) , p[1], 0] as [number, number, number])}
                color="#FDB813"
                lineWidth={2}
              />

              {/* Streamlines */}
              {streamlines.flatMap((sl, i) => {
                const zSegs = splitFiniteSegs(sl.zPts, Z_OFFSET);
                const wSegs = splitFiniteSegs(sl.wPts, W_OFFSET);
                return [
                  ...zSegs.map((seg, k) => (
                    <Line key={`zsl-${i}-${k}`} points={seg} color={sl.color} lineWidth={1.2} transparent opacity={0.85} />
                  )),
                  ...wSegs.map((seg, k) => (
                    <Line key={`wsl-${i}-${k}`} points={seg} color={sl.color} lineWidth={1.2} transparent opacity={0.85} />
                  )),
                ];
              })}

              {/* Axes (subtle) */}
              <Axes center={[Z_OFFSET, 0, 0]} />
              <Axes center={[W_OFFSET, 0, 0]} />

              {/* Lift indicator on w plane */}
              {preset === 'joukowski-flow' && Math.abs(lift) > 0.05 && (
                <LiftArrow center={[W_OFFSET, 0, 0]} L={lift} />
              )}
            </>
          )}

          {preset === 'poincare' && (
            <>
              {/* Unit disk boundary */}
              <Line
                points={Array.from({ length: 96 }, (_, i) => {
                  const θ = (i / 95) * 2 * Math.PI;
                  return [Math.cos(θ) * 1.5, Math.sin(θ) * 1.5, 0] as [number, number, number];
                })}
                color="#FDB813"
                lineWidth={2}
              />
              {/* Geodesics */}
              {geodesics.map((arc, i) => (
                <Line
                  key={i}
                  points={arc.pts.map(p => [p[0] * 1.5, p[1] * 1.5, 0] as [number, number, number])}
                  color={arc.color}
                  lineWidth={1.5}
                  transparent
                  opacity={0.9}
                />
              ))}
              {/* Center dot */}
              <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.04, 16, 16]} />
                <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1} />
              </mesh>
            </>
          )}
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          {preset === 'joukowski-flow' && (
            <>
              <div>α = {(alpha * 180 / Math.PI).toFixed(1)}°</div>
              <div>centro círculo = ({offsetX.toFixed(2)}, {offsetY.toFixed(2)})</div>
              <div>R = {R.toFixed(3)}</div>
              <div className={lift > 0.1 ? 'text-[#34D399]' : 'text-[#94A3B8]'}>
                Γ = {gamma.toFixed(3)} → L' = {(-gamma).toFixed(3)} ρU²
              </div>
            </>
          )}
          {preset === 'joukowski-geometric' && (
            <>
              <div>w = z + 1/z</div>
              <div>círculo descentrado pasa por z=1 → cusp</div>
            </>
          )}
          {preset === 'poincare' && (
            <>
              <div>Disco de Poincaré</div>
              <div className="text-[10px] text-[#64748B]">rectas = arcos ⊥ borde</div>
            </>
          )}
        </div>
      </div>

      <LessonPanel<ConformalLessonState>
        lesson={LESSON}
        onApplyState={patch => {
          if (patch.preset !== undefined) setPreset(patch.preset as typeof preset);
          if (typeof patch.alpha === 'number') setAlpha(patch.alpha);
          if (typeof patch.offsetX === 'number') setOffsetX(patch.offsetX);
          if (typeof patch.offsetY === 'number') setOffsetY(patch.offsetY);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Escena</div>
              <div className="grid grid-cols-1 gap-1.5">
                <PresetBtn current={preset} id="joukowski-geometric" label="Joukowski (geometría)" onClick={setPreset} />
                <PresetBtn current={preset} id="joukowski-flow"      label="Joukowski (flujo aire)"     onClick={setPreset} />
                <PresetBtn current={preset} id="poincare"            label="Poincaré (hiperbólico)"     onClick={setPreset} />
              </div>
            </div>

            {preset === 'joukowski-flow' && (
              <>
                <div className="border-t border-[#1E293B] pt-3 space-y-2">
                  <SliderRow label="α (ángulo de ataque)"
                    value={alpha} min={-0.4} max={0.4} step={0.01}
                    fmt={v => `${(v * 180 / Math.PI).toFixed(1)}°`}
                    onChange={setAlpha} />
                  <SliderRow label="centro círculo X"
                    value={offsetX} min={-0.3} max={0.0} step={0.005}
                    fmt={v => v.toFixed(3)}
                    onChange={setOffsetX} />
                  <SliderRow label="centro círculo Y"
                    value={offsetY} min={-0.25} max={0.25} step={0.005}
                    fmt={v => v.toFixed(3)}
                    onChange={setOffsetY} />
                </div>
                <div className="border-t border-[#1E293B] pt-3 text-[10px] font-mono text-[#94A3B8] space-y-0.5">
                  <div>R = {R.toFixed(4)}</div>
                  <div>β = {(Math.atan2(zc[1], 1 - zc[0]) * 180 / Math.PI).toFixed(2)}°</div>
                  <div className="text-[#FDB813]">L' / (ρU²) = {(-gamma).toFixed(3)}</div>
                </div>
              </>
            )}

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Potencial Φ = U·(zR + R²·e^(2iα)/zR) + (Γ/2πi)·log(zR) en frame relativo. zR = z − zc. RK4 con dt = 0.022.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function clamp(v: number) { return Math.max(-2.5, Math.min(2.5, v)); }

function splitFiniteSegs(pts: C[], xOffset: number): [number, number, number][][] {
  const segs: [number, number, number][][] = [];
  let cur: [number, number, number][] = [];
  for (const p of pts) {
    if (!isFinite(p[0]) || !isFinite(p[1])) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
      continue;
    }
    cur.push([xOffset + clamp(p[0]), p[1], 0]);
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

function PlaneBackdrop({ center, label }: { center: [number, number, number]; label: string }) {
  const [cx, cy, cz] = center;
  const size = 2.4;
  return (
    <>
      <mesh position={[cx, cy, cz - 0.005]}>
        <planeGeometry args={[size * 2, size * 2]} />
        <meshBasicMaterial color="#0B1220" transparent opacity={0.55} />
      </mesh>
      <mesh position={[cx, cy + size + 0.15, cz]}>
        <planeGeometry args={[3, 0.3]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <PlaneLabel position={[cx, cy + size + 0.18, cz]} text={label} />
    </>
  );
}

function PlaneLabel({ position }: { position: [number, number, number]; text: string }) {
  // Defer to a tiny THREE Sprite via mesh; since drei <Text> can hang fonts in
  // headless contexts, we just hide the label and rely on the HUD overlay.
  return <mesh position={position}><planeGeometry args={[0.001, 0.001]} /><meshBasicMaterial transparent opacity={0} /></mesh>;
}

function Axes({ center }: { center: [number, number, number] }) {
  const [cx, cy, cz] = center;
  const size = 2.4;
  return (
    <>
      <Line points={[[cx - size, cy, cz], [cx + size, cy, cz]]} color="#334155" lineWidth={0.8} transparent opacity={0.6} />
      <Line points={[[cx, cy - size, cz], [cx, cy + size, cz]]} color="#334155" lineWidth={0.8} transparent opacity={0.6} />
    </>
  );
}

function LiftArrow({ center, L }: { center: [number, number, number]; L: number }) {
  const [cx, cy, cz] = center;
  const len = Math.min(1.4, Math.abs(L) * 0.4);
  const sign = L >= 0 ? 1 : -1;
  return (
    <>
      <Line
        points={[[cx, cy, cz + 0.05], [cx, cy + sign * len, cz + 0.05]]}
        color="#34D399"
        lineWidth={3}
      />
      {/* Arrowhead */}
      <mesh position={[cx, cy + sign * (len + 0.1), cz + 0.05]} rotation={[0, 0, sign > 0 ? 0 : Math.PI]}>
        <coneGeometry args={[0.08, 0.18, 16]} />
        <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={0.6} />
      </mesh>
    </>
  );
}

function PresetBtn({
  current, id, label, onClick,
}: {
  current: string;
  id: 'joukowski-geometric' | 'joukowski-flow' | 'poincare';
  label: string;
  onClick: (id: 'joukowski-geometric' | 'joukowski-flow' | 'poincare') => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`text-[11px] px-2 py-1.5 rounded border transition text-left ${
        current === id
          ? 'bg-[#F472B6]/15 border-[#F472B6]/50 text-white'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#F472B6]/30'
      }`}
    >
      {label}
    </button>
  );
}

function SliderRow({
  label, value, min, max, step, fmt, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-[#94A3B8] mb-0.5">
        <span>{label}</span>
        <span className="text-[#FDB813] font-mono">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#F472B6]"
      />
    </div>
  );
}
