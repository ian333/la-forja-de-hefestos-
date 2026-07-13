/**
 * Aerodynamics — Perfil alar NACA 4-dígitos, sustentación por circulación,
 * campo de presión + líneas de corriente 3D.
 *
 * FÍSICA REAL IMPLEMENTADA:
 *
 *   Perfil alar NACA 4-dígitos (NACA00xx):
 *     y_t = 5·t·c · (0.2969·√x̄ − 0.1260·x̄ − 0.3516·x̄² + 0.2843·x̄³ − 0.1015·x̄4)
 *     donde x̄ = x/c, t = grosor relativo, c = cuerda.
 *
 *   Transformación Joukowski (conformal mapping):
 *     z = ζ + a²/ζ   (donde ζ = x + iy en el círculo, z = punto en perfil)
 *     Genera un campo potencial analítico que satisface ∇²φ = 0 (flujo irrotacional).
 *
 *   Velocidad potencial alrededor de un cilindro con circulación Γ:
 *     w(z) = U·∞·(e^{-iα} + (a/z)²·e^{iα}) + iΓ/(2πz)
 *     u − iv = dw/dz  (velocidad compleja)
 *
 *   Condición de Kutta: Γ = 4π·U_∞·a·sin(α) — circulación que elimina el
 *     punto de estancamiento trasero, haciendo el flujo físicamente realizable.
 *
 *   Sustentación Kutta-Joukowski:
 *     L = ρ · U_∞ · Γ   [N/m]  (por unidad de envergadura)
 *
 *   Coeficiente de sustentación (thin-airfoil theory):
 *     Cl = 2π · sin(α)  →  Cl ≈ 2πα  para ángulos pequeños
 *
 *   Presión por Bernoulli (flujo incompresible):
 *     p = p_∞ + ½ρ(U_∞² − |u|²)
 *     Cp = (p − p_∞) / (½ρU_∞²) = 1 − |u/U_∞|²
 *
 *   Líneas de corriente: integración RK4 de dx/dt = u(x,y), dy/dt = v(x,y)
 *     en el campo de velocidades potencial transformado.
 *
 * VISUALIZACIÓN 3D R3F:
 *   - Perfil alar sólido emisivo (blanco-azul) — objeto principal contemplativo.
 *   - Líneas de corriente como tubes emisivos coloreados por Cp (azul=presión alta,
 *     rojo=presión baja), que rodean el perfil en el espacio.
 *   - Campo de presión como point cloud volumétrico aditivo.
 *   - Vector de sustentación animado (flecha verde emisiva).
 *   - Ángulo de ataque controlado en tiempo real.
 *
 * Referencias:
 *   · Abbott & von Doenhoff, "Theory of Wing Sections", Dover, 1959.
 *   · Kuethe & Chow, "Foundations of Aerodynamics", 5th ed., Wiley, 1998.
 *   · Joukowski, N.E., "On the shape of lifting surfaces of kites", 1910.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import {
  JOUKOWSKI_A, U_INF, RHO_0 as RHO, kuttaGamma,
  flowVelocity, cpValue, integrateStreamline, nacaProfile, cpToColor,
} from '@/aero/potencial';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTES DE SIMULACIÓN
// (la matemática del flujo vive en src/aero/potencial.ts — compartida con
//  el cine AeroClase y verificada por potencial.test.ts)
// ═══════════════════════════════════════════════════════════════════════

const CHORD  = 1.0;     // cuerda del perfil [m]
const N_STREAM = 24;    // líneas de corriente
const N_STEP   = 140;   // pasos de integración por línea
const DS       = 0.04;  // paso de integración [m] (RK4)
const N_FIELD  = 48;    // resolución del campo de presión (N×N puntos)
const THICKNESS = 0.12; // grosor relativo del perfil NACA (12%)

// ═══════════════════════════════════════════════════════════════════════
// LECCIÓN PEDAGÓGICA
// ═══════════════════════════════════════════════════════════════════════

interface AeroState {
  alpha: number; // ángulo de ataque [rad]
}

const LESSON: Lesson<AeroState> = {
  hook: {
    title: 'Un ala genera sustentación. ¿Por qué? Bernoulli no es la respuesta completa.',
    body: `El mito popular dice: "el aire encima del ala va más rápido porque recorre más camino, así que la presión baja y el ala sube". Incorrecto.

Las moléculas de arriba y abajo NO se reencuentran al final del borde de salida. El aire encima va MÁS rápido simplemente porque el perfil lo obliga a ello — pero la razón real es la CIRCULACIÓN.

La teoría de Kutta-Joukowski (1902-1906) dice algo preciso: toda la sustentación puede representarse como un vórtice de intensidad Γ que rodea el ala. La fuerza es exactamente L = ρ·U_∞·Γ — elegante, exacta, universal.

Esta simulación usa un mapa conforme (transformación de Joukowski) para calcular el campo de velocidades potencial EXACTO alrededor del perfil NACA. La presión viene de Bernoulli: Cp = 1 − |u/U_∞|². Las líneas de corriente son integración RK4 de ese campo. Física real en 3D.`,
  },

  steps: [
    {
      title: 'α = 0° — sin sustentación simétrica',
      duration: 6000,
      body: `Con ángulo de ataque cero (α=0), el perfil NACA 0012 es SIMÉTRICO. El campo de presión arriba y abajo es idéntico.

Las líneas de corriente se desvían simétricamente. La circulación Γ = 4π·U_∞·a·sin(0) = 0. La sustentación L = ρ·U_∞·Γ = 0.

Nota el punto de estancamiento: exactamente al frente del borde de ataque. El fluido se divide en dos corrientes perfectamente simétricas.

Cp = 1 en el punto de estancamiento (velocidad=0, presión máxima). Cp = mínimo en el borde de máximo espesor.`,
      formula: 'α = 0 → Γ = 0 → L = 0\nCp = 1 − |u/U_∞|²',
      keyframes: [
        { at: 0, state: { alpha: 0 } },
        { at: 1, state: { alpha: 0 } },
      ],
    },
    {
      title: 'α = 8° — circulación + sustentación',
      duration: 6500,
      body: `Al inclinar el ala α = 8°, la condición de Kutta obliga al punto de estancamiento trasero a estar EXACTAMENTE en el borde de salida (trailing edge). Esto determina la circulación:

Γ = 4π · U_∞ · a · sin(α) ≈ 4π · 1 · 0.5 · sin(8°) ≈ 1.10 m²/s

La sustentación por Kutta-Joukowski: L = ρ·U_∞·Γ = 1.225 · 1 · 1.10 ≈ 1.35 N/m.

Coeficiente de sustentación (thin-airfoil): Cl = 2π·sin(8°) ≈ 0.87.

Observa cómo las líneas de corriente encima del ala están comprimidas (velocidad alta, presión baja — azul claro) y debajo están expandidas (presión alta — rojo).`,
      formula: 'Γ = 4π U_∞ a sin(α)\nL = ρ U_∞ Γ\nCl = 2π sin(α)',
      keyframes: [
        { at: 0, state: { alpha: 8 * Math.PI / 180 } },
        { at: 1, state: { alpha: 8 * Math.PI / 180 } },
      ],
    },
    {
      title: 'Mapa conforme de Joukowski',
      duration: 6000,
      body: `El truco matemático central: la transformación z = ζ + a²/ζ mapea un CÍRCULO en el plano ζ a un perfil alar en el plano z.

En el plano del círculo, el flujo potencial alrededor de un cilindro con circulación Γ tiene solución analítica exacta. La transformación conforme preserva las ecuaciones de Laplace (∇²φ = 0), así que el campo mapeado al perfil también satisface las ecuaciones de flujo irrotacional.

La velocidad en el plano z: u − iv = (dw/dζ) / (dz/dζ), donde dz/dζ = 1 − a²/ζ². El punto ζ = a corresponde al borde de salida del perfil — el mapa es singular ahí (dz/dζ = 0), lo que fuerza que la velocidad sea finita solo si la circulación exacta Γ_Kutta se elige correctamente.

Esa condición de finitud en el borde de salida es la CONDICIÓN DE KUTTA.`,
      formula: 'z = ζ + a²/ζ   (Joukowski)\nw(ζ) = U_∞(ζ e^{-iα} + a²e^{iα}/ζ) + iΓ ln(ζ)/2π',
      keyframes: [
        { at: 0, state: { alpha: 12 * Math.PI / 180 } },
        { at: 1, state: { alpha: 12 * Math.PI / 180 } },
      ],
    },
    {
      title: 'Ángulo de ataque máximo — borde de pérdida',
      duration: 6000,
      body: `A α ≈ 15-18°, la teoría potencial predice sustentación creciente. Pero en la realidad, el flujo SE DESPEGA de la superficie superior — pérdida aerodinámica (stall).

La teoría de flujo potencial (este modelo) NO captura la separación viscosa — ese es su límite. Las ecuaciones de Navier-Stokes completas con CFD viscoso sí lo hacen.

Para la aviación práctica, el modelo potencial de Joukowski es válido para α < ~12°. Los coeficientes tabulados de perfiles reales (NACA Report 824, 1945) se obtuvieron en túneles de viento y corrigen la no-linealidad viscosa.

Lo que ves aquí es el límite superior teórico, inviscido — el "cielo limpio" de la aerodinámica.`,
      formula: 'Cl_max ≈ 2π sin(α_stall)\n(invíscido: sobreestima el máximo real)',
      keyframes: [
        { at: 0, state: { alpha: 15 * Math.PI / 180 } },
        { at: 1, state: { alpha: 15 * Math.PI / 180 } },
      ],
    },
  ],

  connect: {
    body: `La teoría de Kutta-Joukowski fue desarrollada independientemente por Martin Wilhelm Kutta (1902) y Nikolai Joukowski (1906). Es el fundamento de toda la aerodinámica de perfiles alares subsónica.

En aviación real se usa junto con:
• Tablas NACA/NACA Report 824 — datos empíricos de Cl, Cd vs α en túnel.
• Método de paneles (vórtice discreto) — extiende la teoría a perfiles arbitrarios.
• RANS/LES (CFD viscoso) — captura separación, turbulencia, pérdida.
• Correcciones de compresibilidad (Prandtl-Glauert) para flujo transónico.

El coeficiente de sustentación de thin-airfoil theory, Cl = 2πα, es notable: no depende del espesor del perfil ni de su forma exacta — solo del ángulo de ataque. Esto lo derivó Ludwig Prandtl alrededor de 1918.`,
    links: [
      { label: 'Navier-Stokes completo (viscoso)', href: '#navier-stokes-2d' },
      { label: 'SPH — partículas de fluido', href: '#sph' },
      { label: 'Flujo potencial — potencial complejo', href: '/math.html#complex-flow' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════
// GEOMETRÍA DEL PERFIL ALAR (para el mesh 3D)
// ═══════════════════════════════════════════════════════════════════════

function buildAirfoilGeometry(thickness: number, depth: number): THREE.BufferGeometry {
  const profile = nacaProfile(thickness, 60);
  // Extruir el perfil a lo largo de Z (envergadura)
  const shape = new THREE.Shape();
  shape.moveTo(profile[0].x - 0.5, profile[0].y);
  for (let i = 1; i < profile.length; i++) {
    shape.lineTo(profile[i].x - 0.5, profile[i].y);
  }
  shape.closePath();
  const extrudeSettings = { depth, bevelEnabled: false as const, steps: 1 };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

export default function Aerodynamics() {
  const { audience } = useAudience();
  const [alpha, setAlpha] = useState(8 * Math.PI / 180); // ángulo de ataque [rad]
  const [showPressure, setShowPressure] = useState(true);
  const [showStreamlines, setShowStreamlines] = useState(true);
  const [thickness, setThickness] = useState(THICKNESS);

  // Sustentación calculada
  const Gamma = kuttaGamma(alpha);
  const liftPerSpan = RHO * U_INF * Gamma; // L = ρ U_∞ Γ  [N/m]
  const Cl = 2 * Math.PI * Math.sin(alpha); // thin-airfoil
  const alphaDeg = (alpha * 180 / Math.PI).toFixed(1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={3.5} autoRotate bloomIntensity={0.9} bloomThreshold={0.1}>
          <AeroScene alpha={alpha} thickness={thickness} showPressure={showPressure} showStreamlines={showStreamlines} />
        </Stage>

        {/* HUD: datos físicos */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-3 font-mono text-[11px] text-[#CBD5E1] space-y-1">
          <div><span className="text-[#64748B]">α&nbsp;&nbsp;&nbsp;&nbsp; </span>= {alphaDeg}°</div>
          <div><span className="text-[#64748B]">Γ&nbsp;&nbsp;&nbsp;&nbsp; </span>= {Gamma.toFixed(3)} m²/s</div>
          <div><span className="text-[#64748B]">L/b&nbsp;&nbsp; </span>= <span className="text-[#4ADE80]">{liftPerSpan.toFixed(3)} N/m</span></div>
          <div><span className="text-[#64748B]">Cl&nbsp;&nbsp;&nbsp; </span>= {Cl.toFixed(4)}</div>
          <div><span className="text-[#64748B]">2πα&nbsp;&nbsp; </span>= {(2 * Math.PI * alpha).toFixed(4)}</div>
        </div>

        {/* Controles angulo de ataque */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-4 py-2.5">
          <span className="text-[11px] text-[#64748B] font-mono">α</span>
          <input
            type="range" min={-5} max={20} step={0.5}
            value={alpha * 180 / Math.PI}
            onChange={e => setAlpha(Number(e.target.value) * Math.PI / 180)}
            className="w-36"
          />
          <span className="text-[11px] text-white font-mono w-12">{alphaDeg}°</span>
        </div>
      </div>

      <LessonPanel<AeroState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.alpha !== undefined) setAlpha(patch.alpha);
        }}
        sandbox={
          <>
            <Section title="Perfil alar">
              <Slider label="Ángulo de ataque α" v={alpha * 180 / Math.PI} min={-5} max={20} step={0.5}
                on={v => setAlpha(v * Math.PI / 180)} unit="°" />
              {audience !== 'child' && (
                <Slider label="Grosor relativo t/c" v={thickness} min={0.06} max={0.24} step={0.01}
                  on={v => setThickness(v)} />
              )}
            </Section>

            <Section title="Visualización">
              <Toggle label="Campo de presión Cp" v={showPressure} on={setShowPressure} />
              <Toggle label="Líneas de corriente" v={showStreamlines} on={setShowStreamlines} />
            </Section>

            {audience !== 'child' && (
              <Section title="Fuerzas calculadas">
                <Row label="Γ (circulación)"   value={`${Gamma.toFixed(3)} m²/s`} />
                <Row label="L/b (sustentación)" value={`${liftPerSpan.toFixed(2)} N/m`} highlight />
                <Row label="Cl (2πα)"          value={Cl.toFixed(4)} />
                <Row label="ρ·U_∞·Γ = L"       value={`${(RHO * U_INF * Gamma).toFixed(3)} N/m`} />
              </Section>
            )}

            <Section title="Ecuaciones">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1.5">
                <div className="text-[#4ADE80]">L = ρ · U_∞ · Γ</div>
                <div>Γ = 4π U_∞ a sin(α)</div>
                <div>Cl = 2π sin(α)</div>
                <div className="text-[#64748B] mt-1">Cp = 1 − |u/U_∞|²</div>
                <div className="text-[#64748B]">z = ζ + a²/ζ (Joukowski)</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ESCENA 3D — SUB-COMPONENTE DENTRO DEL CANVAS
// ═══════════════════════════════════════════════════════════════════════

interface AeroSceneProps {
  alpha: number;
  thickness: number;
  showPressure: boolean;
  showStreamlines: boolean;
}

function AeroScene({ alpha, thickness, showPressure, showStreamlines }: AeroSceneProps) {
  // Referencia al grupo del ala para animar la rotación (ángulo de ataque visual)
  const wingGroupRef = useRef<THREE.Group>(null);
  const liftArrowRef = useRef<THREE.Mesh>(null);
  const liftShaftRef = useRef<THREE.Mesh>(null);

  // Geometría del perfil alar (recalcular al cambiar thickness)
  const airfoilGeo = useMemo(
    () => buildAirfoilGeometry(thickness, 1.6),
    [thickness],
  );

  // Líneas de corriente (recalcular al cambiar alpha)
  const streamlineData = useMemo(() => {
    const lines: { x: number; y: number; cp: number }[][] = [];
    // Puntos de inicio: columna vertical en x=-2.5
    for (let i = 0; i < N_STREAM; i++) {
      const y0 = -1.6 + (i / (N_STREAM - 1)) * 3.2;
      const pts = integrateStreamline(-2.5, y0, alpha, N_STEP, DS);
      if (pts.length > 2) lines.push(pts);
    }
    return lines;
  }, [alpha]);

  // Campo de presión (point cloud)
  const pressureField = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const step = 5.0 / N_FIELD;
    const halfStep = step / 2;
    for (let ix = 0; ix < N_FIELD; ix++) {
      for (let iy = 0; iy < N_FIELD; iy++) {
        const px = -2.0 + ix * step + halfStep;
        const py = -2.0 + iy * step + halfStep;
        const [ux, uy] = flowVelocity(px, py, alpha);
        const mag = Math.hypot(ux, uy);
        if (mag < 1e-4) continue; // dentro del perfil
        const cpVal = cpValue(ux, uy);
        const [r, g, b] = cpToColor(cpVal);
        // profundidad Z: distribuir a lo largo de la envergadura
        const nZ = 3;
        for (let iz = 0; iz < nZ; iz++) {
          const pz = -0.6 + iz * 0.6;
          positions.push(px, py, pz);
          colors.push(r * 0.7, g * 0.7, b * 0.7);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    return geo;
  }, [alpha]);

  // Geometría de líneas de corriente (tubes como LineSegments)
  const streamlineGeos = useMemo(() => {
    return streamlineData.map(pts => {
      if (pts.length < 2) return null;
      const positions: number[] = [];
      const colors: number[] = [];
      // Distribuir las líneas de corriente en el plano Z (envergadura)
      const zPositions = [-0.6, 0.0, 0.6];
      for (const pz of zPositions) {
        for (let i = 0; i < pts.length - 1; i++) {
          const p = pts[i], q = pts[i + 1];
          const cpAvg = (p.cp + q.cp) / 2;
          const [r, g, b] = cpToColor(cpAvg);
          positions.push(p.x, p.y, pz, q.x, q.y, pz);
          colors.push(r, g, b, r, g, b);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
      return geo;
    }).filter((g): g is THREE.BufferGeometry => g !== null);
  }, [streamlineData]);

  // Uniform del material del campo de presión — seguimos la regla: nunca inline
  const pressureMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        vertexColors: true,
        size: 0.055,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const streamlineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        linewidth: 1,
      }),
    [],
  );

  // useFrame — animar el ángulo de ataque del ala visualmente + flecha de sustentación
  useFrame(({ clock }) => {
    if (wingGroupRef.current) {
      // Aplicar la rotación de alpha al ala (gira en Z, que es la dirección de vuelo)
      wingGroupRef.current.rotation.z = alpha;
    }
    if (liftArrowRef.current && liftShaftRef.current) {
      const Gamma = kuttaGamma(alpha);
      const liftNorm = Math.min(Math.abs(RHO * U_INF * Gamma) / 3.0, 1.2);
      const sign = alpha >= 0 ? 1 : -1;
      // Flecha de sustentación: escalar su altura
      liftShaftRef.current.scale.y = Math.max(0.01, liftNorm);
      liftArrowRef.current.position.y = sign * (liftNorm + 0.15);
      liftArrowRef.current.rotation.z = alpha >= 0 ? 0 : Math.PI;
      // Pulso leve
      const pulse = 1 + 0.06 * Math.sin(clock.getElapsedTime() * 3.5);
      liftArrowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <>
      {/* Campo de presión */}
      {showPressure && (
        <points geometry={pressureField} material={pressureMat} />
      )}

      {/* Líneas de corriente */}
      {showStreamlines && streamlineGeos.map((geo, i) => (
        <lineSegments key={i} geometry={geo} material={streamlineMat} />
      ))}

      {/* Perfil alar — objeto principal */}
      <group ref={wingGroupRef}>
        <mesh geometry={airfoilGeo} castShadow>
          <meshStandardMaterial
            color="#B0C4DE"
            emissive="#2563EB"
            emissiveIntensity={0.7}
            metalness={0.55}
            roughness={0.25}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>

        {/* Bordes del perfil — anillo emisivo para que revienten con el bloom */}
        <mesh geometry={airfoilGeo}>
          <meshStandardMaterial
            color="#60A5FA"
            emissive="#93C5FD"
            emissiveIntensity={1.4}
            wireframe
            transparent
            opacity={0.18}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Flecha de sustentación (vector L perpendicular al eje de vuelo) */}
      <group position={[0, 0, 0]}>
        {/* Eje del vector */}
        <mesh ref={liftShaftRef} position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1, 12]} />
          <meshStandardMaterial
            color="#4ADE80"
            emissive="#4ADE80"
            emissiveIntensity={2.0}
            toneMapped={false}
          />
        </mesh>
        {/* Punta de flecha */}
        <mesh ref={liftArrowRef} position={[0, 1.15, 0]}>
          <coneGeometry args={[0.07, 0.22, 12]} />
          <meshStandardMaterial
            color="#4ADE80"
            emissive="#22C55E"
            emissiveIntensity={2.5}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Grid de referencia del "túnel de viento" */}
      <group position={[0, -1.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <gridHelper args={[8, 24, '#0F2040', '#0A1830']} />
      </group>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════════════

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
      <span className={highlight ? 'text-[#4ADE80]' : 'text-white'}>{value}</span>
    </div>
  );
}

function Slider({
  label, v, min, max, step, on, unit = '',
}: {
  label: string; v: number; min: number; max: number; step: number;
  on: (v: number) => void; unit?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(unit === '°' ? 1 : 3)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full mt-1" />
    </div>
  );
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (b: boolean) => void }) {
  return (
    <button
      onClick={() => on(!v)}
      className={`w-full flex items-center justify-between px-3 py-2 mb-1.5 rounded-md border text-[11px] transition ${
        v
          ? 'bg-[#1E3A5F]/40 border-[#3B82F6]/40 text-[#93C5FD]'
          : 'border-[#1E293B] text-[#64748B] hover:border-[#334155] hover:text-[#94A3B8]'
      }`}
    >
      <span>{label}</span>
      <span className={`w-2 h-2 rounded-full ${v ? 'bg-[#60A5FA]' : 'bg-[#334155]'}`} />
    </button>
  );
}
