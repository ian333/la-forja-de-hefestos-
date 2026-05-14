/**
 * Mapas conformes — Joukowski airfoil + Poincaré disk.
 *
 * Una función holomorfa con f'(z) ≠ 0 es CONFORME: preserva ángulos. Para
 * Joukowski w = z + 1/z, un círculo descentrado se vuelve un ala.
 *
 * Animación continua: partículas advectadas en tiempo real por el campo de
 * velocidad alrededor del cilindro. Las MISMAS partículas se muestran
 * transformadas por w(z) alrededor del ala — vés el viento moviéndose por
 * ambas geometrías sincronizadas.
 *
 * Conexión EM real: el potencial complejo Φ = ϕ + iψ describe simultáneamente
 *   - flujo de aire 2D irrotacional (ψ = streamline)
 *   - campo electrostático 2D (ϕ = potencial, líneas-ψ = líneas-E)
 *   - conducción térmica estacionaria
 */

import { useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface ConformalLessonState {
  preset: string;
  alpha: number;
  offsetX: number;
  offsetY: number;
}

// ── Complex helpers ────────────────────────────────────────────────────

type C = [number, number];

const cAdd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cSub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const cMul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cDiv = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  if (d < 1e-12) return [NaN, NaN];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};

const JOUK_C = 1;
const joukowski = (z: C): C => cAdd(z, cDiv([JOUK_C * JOUK_C, 0], z));

// ── Potential flow past a cylinder ─────────────────────────────────────

function flowVelocity(z: C, R: number, alpha: number, zc: C, gamma: number): { u: number; v: number } {
  const zRel = cSub(z, zc);
  const eMinusIα: C = [Math.cos(alpha), -Math.sin(alpha)];
  const ePlusIα: C  = [Math.cos(alpha), +Math.sin(alpha)];
  const RsqOverZsq = cDiv([R * R, 0], cMul(zRel, zRel));
  const vortexTerm = cDiv([0, -gamma / (2 * Math.PI)], zRel);
  const dPhi = cAdd(cSub(eMinusIα, cMul(ePlusIα, RsqOverZsq)), vortexTerm);
  return { u: dPhi[0], v: -dPhi[1] };
}

function airfoilParams(offsetX: number, offsetY: number): { zc: C; R: number } {
  const zc: C = [offsetX, offsetY];
  const R = Math.hypot(1 - offsetX, -offsetY);
  return { zc, R };
}

function kuttaCirculation(R: number, alpha: number, zc: C): number {
  const beta = Math.atan2(zc[1], 1 - zc[0]);
  return -4 * Math.PI * R * Math.sin(alpha + beta);
}

function sampleCircleContour(zc: C, R: number, n: number): C[] {
  const out: C[] = [];
  for (let i = 0; i <= n; i++) {
    const θ = (2 * Math.PI * i) / n;
    out.push([zc[0] + R * Math.cos(θ), zc[1] + R * Math.sin(θ)]);
  }
  return out;
}

// ── Streamline traces (static background) ─────────────────────────────

function traceStreamline(
  startX: number, startY: number, R: number, alpha: number, zc: C, gamma: number,
  steps: number, dt: number,
): C[] {
  const pts: C[] = [];
  let x = startX, y = startY;
  for (let i = 0; i < steps; i++) {
    pts.push([x, y]);
    const k1 = flowVelocity([x, y], R, alpha, zc, gamma);
    const k2 = flowVelocity([x + 0.5 * dt * k1.u, y + 0.5 * dt * k1.v], R, alpha, zc, gamma);
    const k3 = flowVelocity([x + 0.5 * dt * k2.u, y + 0.5 * dt * k2.v], R, alpha, zc, gamma);
    const k4 = flowVelocity([x + dt * k3.u, y + dt * k3.v], R, alpha, zc, gamma);
    x += (dt / 6) * (k1.u + 2 * k2.u + 2 * k3.u + k4.u);
    y += (dt / 6) * (k1.v + 2 * k2.v + 2 * k3.v + k4.v);
    if (Math.abs(x) > 3 || Math.abs(y) > 3) { pts.push([x, y]); break; }
    const drx = x - zc[0], dry = y - zc[1];
    if (drx * drx + dry * dry < R * R * 0.98) break;
  }
  return pts;
}

// ── Hyperbolic geodesics ──────────────────────────────────────────────

function geodesicArc(phi1: number, phi2: number, n: number): C[] {
  const half = (phi2 - phi1) / 2;
  const mid = (phi1 + phi2) / 2;
  if (Math.abs(Math.sin(half)) < 1e-3) {
    return [[Math.cos(phi1), Math.sin(phi1)], [Math.cos(phi2), Math.sin(phi2)]];
  }
  const cx = Math.cos(mid) / Math.cos(half);
  const cy = Math.sin(mid) / Math.cos(half);
  const r = Math.abs(Math.tan(half));
  const a1 = Math.atan2(Math.sin(phi1) - cy, Math.cos(phi1) - cx);
  const a2 = Math.atan2(Math.sin(phi2) - cy, Math.cos(phi2) - cx);
  let da = a2 - a1;
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

Aplicale eso a un círculo descentrado y obtenés el perfil de un ALA.

En el plano z resolvés flujo de fluido alrededor de un cilindro (problema trivial). En el plano w aparece automáticamente el MISMO flujo, pero ahora alrededor del ALA correspondiente.

Las partículas que ves moverse son las MISMAS en ambos planos — solo el espacio se transforma. Eso es "conforme": preserva ángulos localmente.

Y aquí viene el shock: la misma matemática describe
  • Flujo aerodinámico 2D irrotacional
  • Campo electrostático 2D en vacío
  • Conducción de calor estacionario en 2D

i (la unidad imaginaria) unifica aerodinámica y electromagnetismo en el plano.`,
  },

  steps: [
    {
      title: 'Mapeo geométrico — círculo → ala',
      duration: 5500,
      body: `Empezá sin flujo. Solo el contorno.

Izquierda: círculo descentrado a (-0.1, 0.05), radio elegido para pasar por z = 1 — eso fabrica la "punta" del borde de salida (cusp).

Derecha: después de w = z + 1/z. Lo que era círculo es ahora perfil de ala con borde de ataque redondo y borde de salida puntiagudo.

Conforme NO destruye los ángulos locales — solo los enrolla.`,
      formula: 'w = z + 1/z',
      keyframes: [
        { at: 0, state: { preset: 'joukowski-geometric', alpha: 0, offsetX: -0.1, offsetY: 0.05 } },
        { at: 1, state: { preset: 'joukowski-geometric', alpha: 0, offsetX: -0.1, offsetY: 0.05 } },
      ],
    },
    {
      title: 'Flujo simétrico — sin sustentación',
      duration: 5500,
      body: `Ahora viento horizontal U sobre el círculo. α = 0, Γ = 0.

Izquierda: partículas se separan al frente, abrazan el círculo, se recombinan atrás. Patrón simétrico arriba/abajo → empuje neto vertical = 0.

Derecha: las MISMAS partículas (vía Joukowski) corren alrededor del ala. Pero α = 0 → tampoco hay sustentación.`,
      formula: 'Φ(z) = U·(z + R²/z)        α = 0',
      keyframes: [
        { at: 0, state: { preset: 'joukowski-flow', alpha: 0, offsetX: -0.1, offsetY: 0.05 } },
        { at: 1, state: { preset: 'joukowski-flow', alpha: 0, offsetX: -0.1, offsetY: 0.05 } },
      ],
    },
    {
      title: 'Ángulo de ataque → SUSTENTACIÓN nace',
      duration: 6500,
      body: `Inclino el viento α = 15°. Las streamlines superiores se APRIETAN, las inferiores se RELAJAN — Bernoulli: presión arriba BAJA, abajo SUBE.

Fuerza neta hacia ARRIBA. Sustentación.

La condición de Kutta impone Γ = −4πUR·sin(α + β) para que el flujo salga LIMPIO por el borde de salida.

En realidad esto sale de la viscosidad al despegar — el "starting vortex" detrás del avión.`,
      formula: 'Γ_Kutta = −4πUR·sin(α + β)\nL\' = ρ·U·Γ    (Kutta-Joukowski)',
      keyframes: [
        { at: 0, state: { preset: 'joukowski-flow', alpha: 0.0,  offsetX: -0.1, offsetY: 0.05 } },
        { at: 1, state: { preset: 'joukowski-flow', alpha: 0.26, offsetX: -0.1, offsetY: 0.05 } },
      ],
    },
    {
      title: 'Camber — curvatura del ala = más lift',
      duration: 6000,
      body: `Aumento el descentrado vertical del círculo. El ala se vuelve más CURVA. Más camber → más sustentación para el mismo α.

Por eso las alas reales NO son simétricas — son curvas. La curvatura da lift incluso sin ángulo de ataque.

Ves la flecha verde de sustentación crecer.`,
      formula: 'L\' = ρUΓ\nΓ = −4πUR·sin(α + atan(y₀/(1-x₀)))',
      keyframes: [
        { at: 0, state: { preset: 'joukowski-flow', alpha: 0.18, offsetX: -0.1,  offsetY: 0.05 } },
        { at: 1, state: { preset: 'joukowski-flow', alpha: 0.18, offsetX: -0.15, offsetY: 0.18 } },
      ],
    },
    {
      title: 'Plano hiperbólico — Poincaré disk',
      duration: 5000,
      body: `Cambio de escena. Mismo análisis complejo, otra geometría: el disco de Poincaré.

Cada arco coloreado es una RECTA hiperbólica — la geodésica entre dos puntos del disco. Las rectas son arcos circulares perpendiculares al borde unitario.

Aquí la suma de los ángulos del triángulo es MENOR que π. Los modelos de Escher con peces decrecientes hacia el borde están dibujados acá.

Las isometrías de este plano son Möbius. Bumeang teórico: lo de la primera clase.`,
      formula: 'd_hyper(z, w) = arctanh(|z − w|/|1 − z̄w|)',
      keyframes: [
        { at: 0, state: { preset: 'poincare', alpha: 0, offsetX: 0, offsetY: 0 } },
        { at: 1, state: { preset: 'poincare', alpha: 0, offsetX: 0, offsetY: 0 } },
      ],
    },
  ],

  connect: {
    body: `Mapas conformes son la base de:

• Diseño aerodinámico clásico — antes del CFD, TODA ala se calculaba con Joukowski + correcciones. Sigue siendo el "first cut" educativo.

• Electromagnetismo 2D — un capacitor de cualquier forma se calcula resolviendo flujo potencial alrededor del electrodo + mapeo conforme. Las streamlines SON las líneas de campo eléctrico. Idéntico math.

• Conducción térmica — Φ = T da campo de temperatura estacionario, ψ = flujo de calor.

• Cartografía — proyección Mercator es CONFORME. Los meridianos y paralelos siguen siendo perpendiculares. Por eso se navega con compás sobre un Mercator.

• Geometría hiperbólica — relatividad en 2+1D, modelos de Escher, teoría de cuerdas.

Magia con licencia profesional.`,
    links: [
      { label: 'Campos EM — líneas de E = streamlines', href: '/physics.html#em/fields' },
      { label: 'Möbius — isometrías del disco de Poincaré', href: '#complex/mobius' },
      { label: 'Newton fractals — la otra mitad de Análisis Complejo', href: '#complex/roots' },
    ],
  },
};

// ── Scene component (with useFrame for animation) ──────────────────────

const Z_OFFSET = -2.8;
const W_OFFSET = 2.8;
const N_PARTICLES = 70;

function clamp(v: number) { return Math.max(-2.5, Math.min(2.5, v)); }

function JoukowskiFlowScene({
  preset, alpha, offsetX, offsetY,
}: {
  preset: 'joukowski-geometric' | 'joukowski-flow';
  alpha: number; offsetX: number; offsetY: number;
}) {
  const { zc, R } = useMemo(() => airfoilParams(offsetX, offsetY), [offsetX, offsetY]);
  const gamma = useMemo(
    () => preset === 'joukowski-flow' ? kuttaCirculation(R, alpha, zc) : 0,
    [preset, R, alpha, zc],
  );

  const cylinderPts = useMemo(() => sampleCircleContour(zc, R, 120), [zc, R]);
  const airfoilPts  = useMemo(() => cylinderPts.map(joukowski), [cylinderPts]);

  // Static streamlines (background reference)
  const streamlines = useMemo(() => {
    if (preset !== 'joukowski-flow') return [];
    const lines: { color: string; zPts: C[]; wPts: C[] }[] = [];
    const startsY = [-1.7, -1.2, -0.8, -0.45, -0.15, 0.15, 0.45, 0.8, 1.2, 1.7];
    const palette = ['#82B1FF', '#A78BFA', '#F472B6', '#FB7185', '#FDB813',
                     '#A3E635', '#34D399', '#22D3EE', '#60A5FA', '#A78BFA'];
    for (let i = 0; i < startsY.length; i++) {
      const zPts = traceStreamline(-2.6, startsY[i], R, alpha, zc, gamma, 380, 0.022);
      const wPts = zPts.map(joukowski);
      lines.push({ color: palette[i % palette.length], zPts, wPts });
    }
    return lines;
  }, [preset, R, alpha, zc, gamma]);

  // Animated particles in z plane (advected). Each particle has [x, y].
  const particlesRef = useRef<Float32Array>(
    new Float32Array(N_PARTICLES * 2),
  );
  // Initialize particle positions on first render
  const initParticles = useRef(false);
  if (!initParticles.current) {
    for (let i = 0; i < N_PARTICLES; i++) {
      particlesRef.current[i * 2 + 0] = -2.6 - Math.random() * 0.4;
      particlesRef.current[i * 2 + 1] = -1.9 + (i / N_PARTICLES) * 3.8;
    }
    initParticles.current = true;
  }

  // Mesh refs for the particle instances (z plane and w plane)
  const zPartsRef = useRef<THREE.InstancedMesh>(null);
  const wPartsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Pulsating lift arrow
  const liftArrowRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (preset !== 'joukowski-flow') return;
    const dt = Math.min(0.05, delta) * 0.85;
    const arr = particlesRef.current;

    for (let i = 0; i < N_PARTICLES; i++) {
      const x = arr[i * 2 + 0];
      const y = arr[i * 2 + 1];

      // RK2 step
      const v1 = flowVelocity([x, y], R, alpha, zc, gamma);
      const xMid = x + 0.5 * dt * v1.u;
      const yMid = y + 0.5 * dt * v1.v;
      const v2 = flowVelocity([xMid, yMid], R, alpha, zc, gamma);
      let nx = x + dt * v2.u;
      let ny = y + dt * v2.v;

      // Recycle particles that exit the domain
      if (nx > 2.5 || Math.abs(ny) > 2.2 || !isFinite(nx)) {
        nx = -2.6 - Math.random() * 0.3;
        ny = -1.9 + Math.random() * 3.8;
      }
      // Bounce particles that enter the cylinder
      const drx = nx - zc[0], dry = ny - zc[1];
      if (drx * drx + dry * dry < R * R * 1.02) {
        const ang = Math.atan2(dry, drx);
        nx = zc[0] + R * 1.05 * Math.cos(ang);
        ny = zc[1] + R * 1.05 * Math.sin(ang);
      }

      arr[i * 2 + 0] = nx;
      arr[i * 2 + 1] = ny;

      // Update z-plane instance
      if (zPartsRef.current) {
        dummy.position.set(Z_OFFSET + clamp(nx), ny, 0.02);
        dummy.updateMatrix();
        zPartsRef.current.setMatrixAt(i, dummy.matrix);
      }
      // Update w-plane instance (same particle, transformed)
      if (wPartsRef.current) {
        const wz = joukowski([nx, ny]);
        if (isFinite(wz[0]) && isFinite(wz[1])) {
          dummy.position.set(W_OFFSET + clamp(wz[0]), clamp(wz[1]), 0.02);
          dummy.updateMatrix();
          wPartsRef.current.setMatrixAt(i, dummy.matrix);
        }
      }
    }
    if (zPartsRef.current) zPartsRef.current.instanceMatrix.needsUpdate = true;
    if (wPartsRef.current) wPartsRef.current.instanceMatrix.needsUpdate = true;

    // Lift arrow pulse
    if (liftArrowRef.current) {
      const t = performance.now() * 0.003;
      const pulse = 1 + 0.06 * Math.sin(t * 2);
      liftArrowRef.current.scale.y = pulse;
    }
  });

  return (
    <>
      <PlaneBackdrop center={[Z_OFFSET, 0, 0]} />
      <PlaneBackdrop center={[W_OFFSET, 0, 0]} />

      {/* Cylinder + Airfoil */}
      <Line
        points={cylinderPts.map(p => [Z_OFFSET + p[0], p[1], 0] as [number, number, number])}
        color="#FDB813"
        lineWidth={2}
      />
      <Line
        points={airfoilPts.map(p => [W_OFFSET + clamp(p[0]), p[1], 0] as [number, number, number])}
        color="#FDB813"
        lineWidth={2}
      />

      {/* Static streamlines */}
      {streamlines.flatMap((sl, i) => {
        const zSegs = splitFiniteSegs(sl.zPts, Z_OFFSET);
        const wSegs = splitFiniteSegs(sl.wPts, W_OFFSET);
        return [
          ...zSegs.map((seg, k) => (
            <Line key={`zsl-${i}-${k}`} points={seg} color={sl.color} lineWidth={1} transparent opacity={0.4} />
          )),
          ...wSegs.map((seg, k) => (
            <Line key={`wsl-${i}-${k}`} points={seg} color={sl.color} lineWidth={1} transparent opacity={0.4} />
          )),
        ];
      })}

      {/* Animated particles */}
      {preset === 'joukowski-flow' && (
        <>
          <instancedMesh ref={zPartsRef} args={[undefined, undefined, N_PARTICLES]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#7DD3FC" emissiveIntensity={1.2} />
          </instancedMesh>
          <instancedMesh ref={wPartsRef} args={[undefined, undefined, N_PARTICLES]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FBBF77" emissiveIntensity={1.2} />
          </instancedMesh>
        </>
      )}

      {/* Lift arrow on w plane */}
      {preset === 'joukowski-flow' && Math.abs(gamma) > 0.05 && (
        <group ref={liftArrowRef} position={[W_OFFSET + 0.2, 0, 0.06]}>
          <LiftArrow L={-gamma} />
        </group>
      )}

      {/* Axes */}
      <Axes center={[Z_OFFSET, 0, 0]} />
      <Axes center={[W_OFFSET, 0, 0]} />
    </>
  );
}

function PoincareScene() {
  const geodesics = useMemo(() => {
    const arcs: { color: string; pts: C[] }[] = [];
    const palette = ['#F472B6', '#4FC3F7', '#FDB813', '#34D399', '#A78BFA', '#FB7185', '#60A5FA', '#A3E635'];
    const N = 8;
    for (let i = 0; i < N; i++) {
      const phi1 = (2 * Math.PI * i) / N;
      const phi2 = phi1 + 2 * Math.PI * 3 / 7;
      arcs.push({ color: palette[i % palette.length], pts: geodesicArc(phi1, phi2, 60) });
    }
    return arcs;
  }, []);

  // Animated "traveler" along a geodesic
  const travelerRef = useRef<THREE.Mesh>(null);
  const trailGeomRef = useRef<THREE.BufferGeometry>(null);
  const TRAIL_CAP = 24;
  const trailBuffer = useMemo(() => new Float32Array(TRAIL_CAP * 3), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Travel along a chosen geodesic
    const arc = geodesicArc(0.4, 0.4 + Math.PI * 1.0, 200);
    const cycle = (t * 0.18) % 1;
    const idx = Math.floor(cycle * (arc.length - 1));
    const p = arc[idx];
    if (travelerRef.current) {
      travelerRef.current.position.set(p[0] * 1.5, p[1] * 1.5, 0.05);
    }
    // Trail
    for (let i = 0; i < TRAIL_CAP; i++) {
      const k = Math.max(0, idx - i);
      const q = arc[k];
      trailBuffer[i * 3 + 0] = q[0] * 1.5;
      trailBuffer[i * 3 + 1] = q[1] * 1.5;
      trailBuffer[i * 3 + 2] = 0.03;
    }
    if (trailGeomRef.current) {
      (trailGeomRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
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
      {geodesics.map((arc, i) => (
        <Line
          key={i}
          points={arc.pts.map(p => [p[0] * 1.5, p[1] * 1.5, 0] as [number, number, number])}
          color={arc.color}
          lineWidth={1.5}
          transparent
          opacity={0.85}
        />
      ))}
      {/* Center dot */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1} />
      </mesh>
      {/* Animated traveler */}
      <mesh ref={travelerRef}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#F472B6" emissiveIntensity={2} />
      </mesh>
      {/* Trail */}
      <line>
        <bufferGeometry ref={trailGeomRef}>
          <bufferAttribute
            attach="attributes-position"
            count={TRAIL_CAP}
            array={trailBuffer}
            itemSize={3}
            args={[trailBuffer, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#F472B6" transparent opacity={0.7} />
      </line>
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────

export default function ConformalMaps() {
  const { audience } = useAudience();
  const [preset, setPreset] = useState<'joukowski-geometric' | 'joukowski-flow' | 'poincare'>('joukowski-flow');
  const [alpha, setAlpha] = useState(0.26);
  const [offsetX, setOffsetX] = useState(-0.1);
  const [offsetY, setOffsetY] = useState(0.05);

  const { zc, R } = useMemo(() => airfoilParams(offsetX, offsetY), [offsetX, offsetY]);
  const gamma = useMemo(() => kuttaCirculation(R, alpha, zc), [R, alpha, zc]);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={preset === 'poincare' ? 4 : 7.5} bloomIntensity={0.5} bloomThreshold={0.55}>
          {preset === 'poincare'
            ? <PoincareScene />
            : <JoukowskiFlowScene preset={preset} alpha={alpha} offsetX={offsetX} offsetY={offsetY} />}
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          {preset === 'joukowski-flow' && (
            <>
              <div>α = {(alpha * 180 / Math.PI).toFixed(1)}°</div>
              <div>centro círculo = ({offsetX.toFixed(2)}, {offsetY.toFixed(2)})</div>
              <div>R = {R.toFixed(3)}</div>
              <div className={(-gamma) > 0.1 ? 'text-[#34D399]' : 'text-[#94A3B8]'}>
                Γ = {gamma.toFixed(3)} → L'/ρU² = {(-gamma).toFixed(3)}
              </div>
              <div className="text-[#64748B] text-[10px] mt-1">partículas advectadas en tiempo real</div>
            </>
          )}
          {preset === 'joukowski-geometric' && (
            <>
              <div>w = z + 1/z</div>
              <div>círculo descentrado → cusp → ala</div>
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
          if (typeof patch.preset === 'string') setPreset(patch.preset as typeof preset);
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
                Φ = U·(zR e^(-iα) + R²e^(iα)/zR) + (Γ/2πi)·log(zR). RK2 sobre {N_PARTICLES} partículas a ~60 fps.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

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

function PlaneBackdrop({ center }: { center: [number, number, number] }) {
  const [cx, cy, cz] = center;
  const size = 2.4;
  return (
    <mesh position={[cx, cy, cz - 0.005]}>
      <planeGeometry args={[size * 2, size * 2]} />
      <meshBasicMaterial color="#0B1220" transparent opacity={0.55} />
    </mesh>
  );
}

function Axes({ center }: { center: [number, number, number] }) {
  const [cx, cy, cz] = center;
  const size = 2.4;
  return (
    <>
      <Line points={[[cx - size, cy, cz], [cx + size, cy, cz]]} color="#334155" lineWidth={0.8} transparent opacity={0.55} />
      <Line points={[[cx, cy - size, cz], [cx, cy + size, cz]]} color="#334155" lineWidth={0.8} transparent opacity={0.55} />
    </>
  );
}

function LiftArrow({ L }: { L: number }) {
  const len = Math.min(1.4, Math.abs(L) * 0.4);
  const sign = L >= 0 ? 1 : -1;
  return (
    <>
      <Line points={[[0, 0, 0], [0, sign * len, 0]]} color="#34D399" lineWidth={3} />
      <mesh position={[0, sign * (len + 0.1), 0]} rotation={[0, 0, sign > 0 ? 0 : Math.PI]}>
        <coneGeometry args={[0.08, 0.18, 16]} />
        <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={0.8} />
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
