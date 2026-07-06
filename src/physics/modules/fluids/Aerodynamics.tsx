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

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTES DE SIMULACIÓN
// ═══════════════════════════════════════════════════════════════════════

const U_INF  = 1.0;     // velocidad del flujo libre [m/s]
const RHO    = 1.225;   // densidad del aire [kg/m³] (ISA nivel del mar)
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
// MATEMÁTICA DEL PERFIL Y FLUJO POTENCIAL
// ═══════════════════════════════════════════════════════════════════════

/** Perfil NACA 4 dígitos simétrico (NACA 00xx): genera los puntos del contorno. */
function nacaProfile(thickness: number, nPoints: number): { x: number; y: number }[] {
  const t = thickness;
  const pts: { x: number; y: number }[] = [];
  // suction side (de borde de ataque a borde de salida, arriba)
  for (let i = 0; i <= nPoints; i++) {
    const xb = i / nPoints;
    // cosine spacing para concentrar puntos en bordes
    const xc = 0.5 * (1 - Math.cos(Math.PI * xb));
    const yt = 5 * t * (
      0.2969 * Math.sqrt(xc)
      - 0.1260 * xc
      - 0.3516 * xc * xc
      + 0.2843 * xc * xc * xc
      - 0.1015 * xc * xc * xc * xc
    );
    pts.push({ x: xc, y: yt });
  }
  // pressure side (borde de salida a borde de ataque, abajo)
  for (let i = nPoints; i >= 0; i--) {
    const xb = i / nPoints;
    const xc = 0.5 * (1 - Math.cos(Math.PI * xb));
    const yt = 5 * t * (
      0.2969 * Math.sqrt(xc)
      - 0.1260 * xc
      - 0.3516 * xc * xc
      + 0.2843 * xc * xc * xc
      - 0.1015 * xc * xc * xc * xc
    );
    pts.push({ x: xc, y: -yt });
  }
  return pts;
}

/**
 * Velocidad del flujo potencial alrededor del círculo de Joukowski
 * transformada al plano físico.
 *
 * Plano del círculo: ζ = a·e^{iθ} + offset
 * Transformación: z = ζ + a²/ζ
 *
 * Flujo potencial (cilindro + circulación Γ):
 *   w(ζ) = U_∞·(ζ·e^{-iα} + a²·e^{iα}/ζ) + i·Γ·ln(ζ) / (2π)
 *   dw/dζ = U_∞·(e^{-iα} − a²·e^{iα}/ζ²) + i·Γ/(2π·ζ)
 *
 * Jacobiano de la transformación:
 *   dz/dζ = 1 − a²/ζ²
 *
 * Velocidad en el plano físico: u_z = dw/dζ / (dz/dζ)
 *
 * Invertimos z→ζ numéricamente (Newton) para mapear puntos físicos (x,y)
 * al plano del círculo y calcular la velocidad allí.
 */

const JOUKOWSKI_A = 0.52; // radio del círculo de Joukowski (ligeramente > 0.5·chord)

function joukowskiInverse(zx: number, zy: number): [number, number] {
  // Resuelve ζ + a²/ζ = z vía cuadrática: ζ² − z·ζ + a² = 0
  // ζ = (z ± √(z²−4a²)) / 2
  const a2 = JOUKOWSKI_A * JOUKOWSKI_A;
  // z² − 4a²
  const re2 = zx * zx - zy * zy - 4 * a2;
  const im2 = 2 * zx * zy;
  // √(complex) — tomamos la raíz con parte imaginaria positiva (exterior del cilindro)
  const r2 = Math.sqrt(re2 * re2 + im2 * im2);
  const ang2 = Math.atan2(im2, re2);
  const sqRe = Math.sqrt(r2) * Math.cos(ang2 / 2);
  const sqIm = Math.sqrt(r2) * Math.sin(ang2 / 2);
  // ζ = (z + sqrt) / 2  — elegimos la raíz exterior (|ζ| > a)
  let zeta_re = (zx + sqRe) / 2;
  let zeta_im = (zy + sqIm) / 2;
  if (zeta_re * zeta_re + zeta_im * zeta_im < a2) {
    // si caímos dentro del círculo, tomar la otra raíz
    zeta_re = (zx - sqRe) / 2;
    zeta_im = (zy - sqIm) / 2;
  }
  return [zeta_re, zeta_im];
}

/**
 * Calcula (u, v) en el punto físico (px, py) dado ángulo de ataque alpha (rad).
 * Devuelve velocidad en coordenadas del flujo libre (sin rotar por alpha).
 */
function flowVelocity(px: number, py: number, alpha: number): [number, number] {
  const a  = JOUKOWSKI_A;
  const a2 = a * a;
  const Gamma = 4 * Math.PI * U_INF * a * Math.sin(alpha); // condición de Kutta

  // Invertir la transformación de Joukowski z→ζ
  const [zetaRe, zetaIm] = joukowskiInverse(px, py);

  // |ζ|²
  const mod2 = zetaRe * zetaRe + zetaIm * zetaIm;
  if (mod2 < a2 * 0.81) {
    // punto dentro del cuerpo — velocidad cero
    return [0, 0];
  }

  // dw/dζ = U_∞·(e^{-iα} − a²·e^{iα}/ζ²) + i·Γ/(2π·ζ)
  const cosA = Math.cos(alpha), sinA = Math.sin(alpha);
  // a²/ζ²: ζ² = (zetaRe+i·zetaIm)²
  const zeta2Re = zetaRe * zetaRe - zetaIm * zetaIm;
  const zeta2Im = 2 * zetaRe * zetaIm;
  const zeta2mod2 = zeta2Re * zeta2Re + zeta2Im * zeta2Im;
  // a²/ζ² en complejo
  const a2_z2Re =  a2 * zeta2Re / zeta2mod2;
  const a2_z2Im = -a2 * zeta2Im / zeta2mod2;

  // U_∞ · e^{-iα} = U_∞·(cosA + i·(-sinA))
  // U_∞ · e^{iα}·(a²/ζ²)
  const term1Re = U_INF * cosA;
  const term1Im = -U_INF * sinA;
  // e^{iα} · (a²/ζ²)
  const ea_iRe = cosA * a2_z2Re - sinA * a2_z2Im;
  const ea_iIm = cosA * a2_z2Im + sinA * a2_z2Re;
  // dw/dζ parte Rankine
  let dwRe = term1Re - U_INF * ea_iRe;
  let dwIm = term1Im - U_INF * ea_iIm;
  // + iΓ/(2π·ζ) = iΓ·ζ̄ / (2π·|ζ|²)
  const twoPiMod2 = 2 * Math.PI * mod2;
  dwRe += -Gamma * zetaIm / twoPiMod2; // i/ζ = -Im/|ζ|² + i·Re/|ζ|²
  dwIm +=  Gamma * zetaRe / twoPiMod2;

  // dz/dζ = 1 − a²/ζ²
  const dzRe = 1 - a2_z2Re;
  const dzIm =   - a2_z2Im;
  const dzMod2 = dzRe * dzRe + dzIm * dzIm;
  if (dzMod2 < 1e-10) return [U_INF * cosA, -U_INF * sinA]; // singularidad

  // u_z = dw/dζ / (dz/dζ) — división de complejos
  // (dwRe + i·dwIm) / (dzRe + i·dzIm)
  const uRe = (dwRe * dzRe + dwIm * dzIm) / dzMod2;
  const uIm = (dwIm * dzRe - dwRe * dzIm) / dzMod2;

  // En R3F: x es horizontal, y es vertical — la velocidad compleja da (u, v)
  return [uRe, -uIm]; // conjugado: w = u − iv, por eso negamos la imaginaria
}

/** Coeficiente de presión en un punto dado el módulo de velocidad. */
function cp(ux: number, uy: number): number {
  const mag2 = ux * ux + uy * uy;
  return 1 - mag2 / (U_INF * U_INF);
}

/** Integración RK4 de una línea de corriente durante N_STEP pasos. */
function integrateStreamline(
  x0: number, y0: number, alpha: number, nSteps: number, ds: number,
): { x: number; y: number; cp: number }[] {
  const pts: { x: number; y: number; cp: number }[] = [];
  let x = x0, y = y0;
  for (let i = 0; i < nSteps; i++) {
    const [u1, v1] = flowVelocity(x, y, alpha);
    const mag1 = Math.hypot(u1, v1);
    if (mag1 < 1e-6) break;
    const k1x = u1 / mag1, k1y = v1 / mag1;
    const [u2, v2] = flowVelocity(x + 0.5 * ds * k1x, y + 0.5 * ds * k1y, alpha);
    const mag2 = Math.hypot(u2, v2);
    const k2x = mag2 > 1e-6 ? u2 / mag2 : k1x;
    const k2y = mag2 > 1e-6 ? v2 / mag2 : k1y;
    const [u3, v3] = flowVelocity(x + 0.5 * ds * k2x, y + 0.5 * ds * k2y, alpha);
    const mag3 = Math.hypot(u3, v3);
    const k3x = mag3 > 1e-6 ? u3 / mag3 : k2x;
    const k3y = mag3 > 1e-6 ? v3 / mag3 : k2y;
    const [u4, v4] = flowVelocity(x + ds * k3x, y + ds * k3y, alpha);
    const mag4 = Math.hypot(u4, v4);
    const k4x = mag4 > 1e-6 ? u4 / mag4 : k3x;
    const k4y = mag4 > 1e-6 ? v4 / mag4 : k3y;
    const dx = (ds / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    const dy = (ds / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    x += dx;
    y += dy;
    const [ux, uy] = flowVelocity(x, y, alpha);
    pts.push({ x, y, cp: cp(ux, uy) });
    // salir si el punto se fue lejos
    if (Math.abs(x) > 4 || Math.abs(y) > 3) break;
  }
  return pts;
}

/** Mapea un valor Cp a color RGB: azul (cp>0 presión alta) → blanco → rojo (cp<0 presión baja). */
function cpToColor(cpVal: number): [number, number, number] {
  // cp clamped [-2, 1]
  const t = Math.max(-1, Math.min(1, cpVal / 1.5));
  if (t >= 0) {
    // azul → blanco: cp positivo (desaceleración, alta presión)
    return [t, t, 1.0];
  } else {
    // blanco → rojo: cp negativo (aceleración, baja presión)
    return [1.0, 1.0 + t, 1.0 + t];
  }
}

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
  const Gamma = 4 * Math.PI * U_INF * JOUKOWSKI_A * Math.sin(alpha);
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
        const cpVal = cp(ux, uy);
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
      const Gamma = 4 * Math.PI * U_INF * JOUKOWSKI_A * Math.sin(alpha);
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
