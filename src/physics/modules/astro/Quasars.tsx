/**
 * Quásares — disco de acreción Shakura-Sunyaev + jet relativista Blandford-Znajek.
 *
 * FÍSICA REAL (no decorativa):
 *   - Temperatura del disco: T(r) ∝ r^(-3/4) (Shakura-Sunyaev 1973, thin disk).
 *     T(r) = T_max · (r/r_in)^(-3/4) · √(1 − √(r_in/r))
 *     donde r_in = ISCO = 6 GM/c² (Schwarzschild, a*=0).
 *     T_max ≈ (3 G M Ṁ / (8 π σ r_in³))^(1/4) — Novikov-Thorne completo.
 *
 *   - Color del disco → temperatura de color (cuerpo negro):
 *     λ_peak = b / T  (ley de Wien: b = 2.898e-3 m·K)
 *     UV→azul-blanco (10^5 K cerca del ISCO), IR→naranja (10^4 K exterior).
 *
 *   - Doppler boosting relativista: δ = 1 / (γ(1 − β cos θ_obs))
 *     β = v_φ/c = √(GM / (r c²)) (kepleriano).
 *     Flujo observado ∝ δ⁴ (Rybicki & Lightman).
 *     El lado izquierdo (orbitando HACIA el obs) se comprime y brilla; el
 *     derecho se aleja y se atenúa — asimetría azul/rojo característica.
 *
 *   - Potencia del jet Blandford-Znajek (1977):
 *     P_BZ = (κ / (4π c)) · Φ_B² · Ω_H²
 *     Ω_H = a* c³ / (2 G M r_H),  r_H = r_s/2 · (1 + √(1−a*²))
 *     Escalar práctico: P_BZ ∝ a*² · Ṁ c² (magnéticamente saturado, MAD).
 *     La longitud del jet L_jet ∝ (P_BZ / ρ_amb c²)^0.5 (expansión balística).
 *
 *   - Partículas del jet siguen una trayectoria helicoidal (campo B torcido):
 *     x(t) = r_j(z) cos(φ_0 + k z)
 *     y(t) = r_j(z) sin(φ_0 + k z)
 *     con r_j(z) ∝ z^(1/2) (expansión cónica moderada del jet).
 *
 * Sub-componente Sim (useFrame) vive DENTRO del Canvas (Stage) — regla crítica.
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ── Constantes físicas ───────────────────────────────────────────────────────
const G = 6.674e-11;       // m³ kg⁻¹ s⁻²
const c = 3e8;             // m/s
const M_SUN = 1.989e30;    // kg
const SIGMA_SB = 5.67e-8;  // W m⁻² K⁻⁴
const WIEN_B = 2.898e-3;   // m·K
const KAPPA = 0.044;       // constante de BZ adimensional (κ/4π)

// ── Presets (quásares reales) ────────────────────────────────────────────────
interface Preset {
  id: string;
  name: string;
  M_sol: number;          // masa en M☉
  Mdot_sol_yr: number;    // tasa de acreción en M☉/año
  spin: number;           // a* ∈ [0,1)
  incDeg: number;         // inclinación del disco (grados)
  note: string;
}

const PRESETS: Preset[] = [
  {
    id: '3c273', name: '3C 273 (el primer quásar)',
    M_sol: 8.86e8, Mdot_sol_yr: 10, spin: 0.87, incDeg: 25,
    note: 'Primer quásar identificado (Schmidt 1963). A 2450 Mpc. Jet visible a escala de Mpc.',
  },
  {
    id: 'ton618', name: 'TON 618 (el más masivo)',
    M_sol: 6.6e10, Mdot_sol_yr: 180, spin: 0.95, incDeg: 40,
    note: 'BH más masivo conocido. r_s ~ 195 UA. Luminosidad ~4×10¹⁴ L☉.',
  },
  {
    id: 'cygA', name: 'Cygnus A (radio-galaxy)',
    M_sol: 2.5e9, Mdot_sol_yr: 5, spin: 0.60, incDeg: 75,
    note: 'Caballo de batalla de la radioastronomía. Jets simétricos hasta 100 kpc.',
  },
  {
    id: 'sgrA_active', name: 'Sgr A* (activo hipotético)',
    M_sol: 4.154e6, Mdot_sol_yr: 0.5, spin: 0.50, incDeg: 20,
    note: 'Si Sgr A* tuviera un gas cloud como hace ~3.5 Gyr — así se vería.',
  },
];

// ── Lesson ───────────────────────────────────────────────────────────────────
interface QState { presetId: string; spin: number; incDeg: number }

const LESSON: Lesson<QState> = {
  hook: {
    title: 'Un quásar emite MÁS luz que toda una galaxia. Alimentado por un agujero negro.',
    body: `En 1963, Maarten Schmidt midió el corrimiento al rojo de un objeto puntual — 3C 273 — y descubrió que estaba a 2450 megapársecs. A esa distancia, para verse así de brillante, tenía que emitir como 4 BILLONES de soles.

El mecanismo: materia cayendo hacia un agujero negro supermasivo libera hasta el 42% de su masa en reposo como energía radiante (eficiencia máxima Kerr extremo). La fusión nuclear solo libera el 0.7%. El quásar es el motor más eficiente del universo.

El disco de acreción sigue la ley T(r) ∝ r^(−3/4) de Shakura-Sunyaev. Los jets relativistas son impulsados por el campo magnético entrelazado con el spin del agujero negro — mecanismo Blandford-Znajek.`,
  },

  steps: [
    {
      title: 'Disco de acreción — perfil de temperatura Shakura-Sunyaev',
      duration: 6000,
      body: `El disco delgado (thin disk) de Shakura-Sunyaev (1973) da:

T(r) = T₀ · (r/r_in)^(−3/4) · √(1 − √(r_in/r))

donde r_in = ISCO = 6 GM/c² (Schwarzschild). El factor √(...) viene del flujo viscoso — es cero en el ISCO (no torque al borde) y → 1 lejos.

Cerca del ISCO: T ~ 10⁵–10⁶ K → UV y rayos X suaves (azul-blanco). En la periferia: T ~ 10⁴ K → infrarrojo (naranja). El color gradiente que ves ES la temperatura real.`,
      formula: 'T(r) = T₀(r/r_in)^{−3/4}√(1−√(r_in/r))\nT₀ = [3GMṀ/(8πσr_in³)]^{1/4}',
      keyframes: [
        { at: 0, state: { presetId: '3c273', spin: 0.87, incDeg: 25 } },
        { at: 1, state: { presetId: '3c273', spin: 0.87, incDeg: 25 } },
      ],
    },
    {
      title: 'Doppler boosting δ⁴ — asimetría brillante/oscura',
      duration: 6000,
      body: `El disco orbita a velocidad kepleriana v = √(GM/r). Cerca del ISCO: v ~ 0.4c. El lado que orbita HACIA ti (izquierdo) se comprime y amplifica; el que se aleja, se atenúa.

Factor de boost: δ = 1 / [γ(1 − β cos θ_obs)]
Flujo ∝ δ⁴ (Rybicki & Lightman, factor 4 = dos aberraciones + dos doppler).

Con inclinación 25°: δ_max/δ_min ≈ 3–4 → el lado brillante tiene ~60–100× más flujo que el oscuro. En 3C 273 esta asimetría se mide en VLBI.`,
      formula: 'F_obs = F_emit · δ⁴\nδ = 1/[γ(1−β·cos θ_obs)]\nβ = v_φ/c = √(GM/rc²)',
      keyframes: [
        { at: 0, state: { presetId: '3c273', spin: 0.87, incDeg: 65 } },
        { at: 1, state: { presetId: '3c273', spin: 0.87, incDeg: 65 } },
      ],
    },
    {
      title: 'Jet Blandford-Znajek — spin × campo magnético',
      duration: 6500,
      body: `Blandford y Znajek (1977): el campo magnético entrelazado con la ergosfera extrae energía rotacional del BH.

P_BZ = (κ/4πc) Φ_B² Ω_H²
Ω_H = a* c³/(2GM r_H) — velocidad angular del horizonte.

En régimen MAD (Magnetically Arrested Disk): P_BZ ≈ 1.4 a*² Ṁ c². Con a*→1, la eficiencia sube al 42% — supera la fusión por 60×.

El jet emerge a lo largo del eje de spin, con campo helicoidal (rotación del BH enrolla las líneas de B). La expansión cónica r_jet ∝ z^(1/2) refleja el balance entre presión magnética y ram-pressure.`,
      formula: 'P_BZ ∝ a*² Ṁ c²\nr_H = (r_s/2)(1+√(1−a*²))\nL_jet ∝ √(P_BZ/ρ_amb c²)',
      keyframes: [
        { at: 0, state: { presetId: 'cygA', spin: 0.60, incDeg: 75 } },
        { at: 1, state: { presetId: 'cygA', spin: 0.95, incDeg: 75 } },
      ],
    },
    {
      title: 'TON 618 — el quásar más masivo conocido',
      duration: 5500,
      body: `TON 618: M_BH = 6.6×10¹⁰ M☉. Radio de Schwarzschild ~ 195 UA. Luminosidad ~ 4×10¹⁴ L☉.

Su disco de acreción tiene T_ISCO ~ 2×10⁴ K — más frío que Cygnus X-1 porque r_in ∝ M → más grande, más frío.

L_Eddington = 4πGMm_p c/σ_T ≈ 1.26×10³¹ · (M/M☉) W. TON 618 raya el límite de Eddington. Si lo supera momentáneamente, la presión de radiación expulsa el gas → apaga el quásar temporalmente.`,
      formula: 'L_Edd = 4πGMm_pc/σ_T\nT_in ∝ (Ṁ/M²)^{1/4}\n(r_in ∝ M → T_in ↓ con M)',
      keyframes: [
        { at: 0, state: { presetId: 'ton618', spin: 0.95, incDeg: 40 } },
        { at: 1, state: { presetId: 'ton618', spin: 0.95, incDeg: 40 } },
      ],
    },
  ],

  connect: {
    body: `Los quásares son los faros del universo temprano. A z > 6 (menos de 900 Myr del Big Bang), ya había BHs de 10⁹ M☉. No sabemos cómo crecieron tan rápido — es un problema abierto de astrofísica.

El mecanismo Blandford-Znajek es hoy el modelo estándar de jets en AGN, microquásares y GRBs. La misma física —spin + campo magnético— opera desde BHs estelares (M ~ 10 M☉) hasta monstruos de 10¹⁰ M☉.

Conexiones directas:
• Agujero negro (BH) — la métrica de Kerr dentro de la que orbita el disco
• Schwarzschild — el embedding de Flamm muestra la curvatura que "inclina" el disco
• Relatividad general — la precesión del periapsis y la ergosfera que alimenta el jet`,
    links: [
      { label: 'Agujero negro — métrica de Kerr + ISCO', href: '#black-hole' },
      { label: 'Schwarzschild — embedding de Flamm', href: '#schwarzschild' },
      { label: 'Estructura estelar — Chandrasekhar + Tolman-Oppenheimer', href: '#stellar-structure' },
    ],
  },
};

// ── Física auxiliar ──────────────────────────────────────────────────────────

function schwarzschildR(M_kg: number) {
  return 2 * G * M_kg / (c * c);
}

/** ISCO = 6 GM/c² para Schwarzschild (a*=0); fórmula completa Bardeen para Kerr. */
function iscoR(M_kg: number, a_star: number) {
  const rs = schwarzschildR(M_kg);
  const Z1 = 1 + Math.cbrt(1 - a_star * a_star) * (Math.cbrt(1 + a_star) + Math.cbrt(1 - a_star));
  const Z2 = Math.sqrt(3 * a_star * a_star + Z1 * Z1);
  const sign = a_star >= 0 ? 1 : -1;
  return (rs / 2) * (3 + Z2 - sign * Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2)));
}

/** Temperatura Shakura-Sunyaev completa (Novikov-Thorne). */
function diskTemp(r: number, r_in: number, M_kg: number, Mdot_kg_s: number): number {
  if (r <= r_in) return 0;
  const rr = r_in / r;
  const factor = 1 - Math.sqrt(rr);
  const T4 = (3 * G * M_kg * Mdot_kg_s) / (8 * Math.PI * SIGMA_SB * r * r * r) * factor;
  return T4 > 0 ? Math.pow(T4, 0.25) : 0;
}

/** λ_peak Wien → color RGB normalizado. */
function tempToColor(T: number): [number, number, number] {
  if (T <= 0) return [0, 0, 0];
  const lam = WIEN_B / T;  // metros
  // Mapeo heurístico: espectro visible (380–700 nm) + extensión UV/IR
  // UV (<380 nm)  → azul-blanco brillante
  // Visible       → arcoíris estándar
  // IR (>700 nm)  → naranja-rojo
  const nm = lam * 1e9;
  let r = 0, g = 0, b = 0;
  if (nm < 380) {
    // UV → violeta-azul muy brillante (quásar real)
    r = 0.5 + 0.5 * (380 - nm) / 80;
    g = 0.4;
    b = 1.0;
  } else if (nm < 440) {
    r = (440 - nm) / 60;
    g = 0;
    b = 1;
  } else if (nm < 490) {
    r = 0;
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    r = 0;
    g = 1;
    b = (510 - nm) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
    b = 0;
  } else if (nm < 645) {
    r = 1;
    g = (645 - nm) / 65;
    b = 0;
  } else {
    // IR → naranja-rojo
    r = 1;
    g = Math.max(0, (750 - nm) / 200) * 0.5;
    b = 0;
  }
  return [r, g, b];
}

/** Factor Doppler δ = 1/(γ(1−β cos θ)), φ = ángulo azimutal en el disco. */
function dopplerBoost(r: number, phi: number, M_kg: number, incRad: number): number {
  const v2_c2 = G * M_kg / (r * c * c);
  if (v2_c2 >= 1) return 1;
  const beta = Math.sqrt(v2_c2);
  const gamma = 1 / Math.sqrt(1 - v2_c2);
  // Componente de velocidad proyectada hacia el observador:
  // v̂ · n̂_obs = −sin(φ) · sin(incl)  (disco en plano xz, observador en yz)
  const cosTheta = -Math.sin(phi) * Math.sin(incRad);
  const delta = 1 / (gamma * (1 - beta * cosTheta));
  return delta;
}

/** Potencia BZ adimensional (normalizada a Ṁc²). */
function bzPowerNorm(a_star: number): number {
  // P_BZ / (Ṁ c²) ≈ 1.4 a*² (régimen MAD)
  return 1.4 * a_star * a_star;
}

// ── Geometría del disco (partículas) ────────────────────────────────────────
const N_DISK = 18000;
const N_JET  = 4000;

function buildDiskPositions(
  r_in: number, r_out: number, incRad: number,
): { positions: Float32Array; uvs: Float32Array } {
  const pos = new Float32Array(N_DISK * 3);
  const uvs = new Float32Array(N_DISK * 2); // r, phi

  // Distribución ∝ r dr (área uniforme en escala logarítmica para resolución en r_in)
  for (let i = 0; i < N_DISK; i++) {
    const u = Math.random();
    // Muestreo inverso de p(r) ∝ 1/r (log-uniforme → más partículas cerca)
    const r = r_in * Math.pow(r_out / r_in, u);
    const phi = Math.random() * 2 * Math.PI;
    // Disco en plano XZ, luego inclinado alrededor de eje X
    const x = r * Math.cos(phi);
    const z = r * Math.sin(phi);
    const y_disk = (Math.random() - 0.5) * r_in * 0.05; // pequeño espesor
    // Aplicar inclinación: rotar alrededor de eje X
    const y_inc = y_disk * Math.cos(incRad) - z * Math.sin(incRad);
    const z_inc = y_disk * Math.sin(incRad) + z * Math.cos(incRad);
    pos[i*3+0] = x;
    pos[i*3+1] = y_inc;
    pos[i*3+2] = z_inc;
    uvs[i*2+0] = r;
    uvs[i*2+1] = phi;
  }
  return { positions: pos, uvs };
}

function buildJetPositions(
  r_in: number, jetLen: number, spinSign: number,
): Float32Array {
  const pos = new Float32Array(N_JET * 2 * 3); // jet+ y jet-
  const N = N_JET;
  for (let side = 0; side < 2; side++) {
    const sgn = side === 0 ? 1 : -1;
    for (let i = 0; i < N; i++) {
      const frac = Math.pow(Math.random(), 0.7);
      const z = sgn * frac * jetLen;
      // Radio del jet crece como cono moderado r_jet = r_in * 0.1 * sqrt(|z|/jetLen)
      const r_jet = r_in * 0.25 * Math.sqrt(Math.abs(z) / jetLen + 0.01);
      const phi_j = Math.random() * 2 * Math.PI + spinSign * z * 2.5 / jetLen;
      const spread = (Math.random() - 0.5) * r_jet * 0.8;
      pos[(side * N + i) * 3 + 0] = r_jet * Math.cos(phi_j) + spread;
      pos[(side * N + i) * 3 + 1] = z;
      pos[(side * N + i) * 3 + 2] = r_jet * Math.sin(phi_j) + spread * 0.5;
    }
  }
  return pos;
}

// ── Sub-componente R3F (DENTRO del Canvas) ───────────────────────────────────

interface SimProps {
  M_kg: number;
  Mdot_kg_s: number;
  spin: number;
  incRad: number;
  scale: number;   // factor escala visual (r_in → unidades de escena)
}

function Sim({ M_kg, Mdot_kg_s, spin, incRad, scale }: SimProps) {
  const tex = useMemo(() => getParticleTexture(), []);
  const tRef = useRef(0);

  const r_in  = useMemo(() => iscoR(M_kg, spin), [M_kg, spin]);
  const r_out = r_in * 30;

  // ── Geometría del disco ────────────────────────────────────────────
  const diskGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const { positions, uvs } = buildDiskPositions(r_in, r_out, incRad);
    g.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_DISK * 3), 3));
    // Store r, phi for physics lookup
    g.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2));
    return g;
  }, [r_in, r_out, incRad]);

  // ── Colores iniciales del disco ────────────────────────────────────
  useMemo(() => {
    const col = diskGeo.attributes.color as THREE.BufferAttribute;
    const uv2 = diskGeo.attributes.uv2 as THREE.BufferAttribute;
    for (let i = 0; i < N_DISK; i++) {
      const r   = (uv2.array as Float32Array)[i * 2 + 0];
      const phi = (uv2.array as Float32Array)[i * 2 + 1];
      const T   = diskTemp(r, r_in, M_kg, Mdot_kg_s);
      const [cr, cg, cb] = tempToColor(T);
      const delta = dopplerBoost(r, phi, M_kg, incRad);
      const d4    = Math.min(delta * delta * delta * delta, 12);
      (col.array as Float32Array)[i*3+0] = cr * d4 * 0.5;
      (col.array as Float32Array)[i*3+1] = cg * d4 * 0.5;
      (col.array as Float32Array)[i*3+2] = cb * d4 * 0.5;
    }
    col.needsUpdate = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diskGeo, r_in, M_kg, Mdot_kg_s, incRad]);

  // ── Jet ───────────────────────────────────────────────────────────
  const jetLen = r_in * 40 * (1 + 5 * bzPowerNorm(spin));

  const jetGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = buildJetPositions(r_in, jetLen, spin >= 0 ? 1 : -1);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // Color: blanco-azul para el jet (plasma relativista)
    const col = new Float32Array(N_JET * 2 * 3);
    for (let i = 0; i < N_JET * 2; i++) {
      const z = Math.abs(pos[i * 3 + 1]);
      const frac = z / jetLen;
      // Brillante en la base (plasma denso), tenue al final
      const bright = Math.max(0, 1 - frac * 0.8);
      col[i*3+0] = bright * 0.7;
      col[i*3+1] = bright * 0.85;
      col[i*3+2] = bright * 1.0;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [r_in, jetLen, spin]);

  // ── Horizonte de eventos (esfera) ─────────────────────────────────
  const bhMesh = useRef<THREE.Mesh>(null);

  // ── Animación: rotar disco + pulsar jet ───────────────────────────
  const diskGroup = useRef<THREE.Group>(null);
  const jetGroup  = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    tRef.current += delta;
    const t = tRef.current;

    // Rotar el disco (velocidad angular kepleriana promedio en r=3r_in)
    const r_mid = r_in * 3;
    const omega = Math.sqrt(G * M_kg / (r_mid * r_mid * r_mid)) * 1e-9; // rad/ns → visual
    // Escalar omega para ver rotación cine: normalizar a ~0.15 rad/s visual
    const omegaVis = 0.15;
    if (diskGroup.current) {
      diskGroup.current.rotation.y = t * omegaVis * (1 - incRad / Math.PI);
    }

    // Pulsar jet — brillo oscilatorio imitando estructura de nudos (knots)
    if (jetGroup.current) {
      const pulseFactor = 0.8 + 0.2 * Math.sin(t * 2.1) * Math.cos(t * 0.7);
      jetGroup.current.scale.setScalar(pulseFactor);
    }

    // BH — pulso muy suave de emissive
    if (bhMesh.current) {
      const mat = bhMesh.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.05 + 0.05 * Math.sin(t * 0.5);
    }
  });

  // Escalar de metros a unidades de escena
  const S = scale / r_in;
  const r_s_vis = schwarzschildR(M_kg) * S * 0.5; // radio visual BH

  return (
    <group>
      {/* Agujero negro — esfera negra emisiva tenue */}
      <mesh ref={bhMesh}>
        <sphereGeometry args={[Math.max(r_s_vis, 0.04), 48, 32]} />
        <meshStandardMaterial
          color="#000000"
          emissive="#1a0a2e"
          emissiveIntensity={0.08}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* Anillo del horizonte de fotones — r_ph = 1.5 r_s */}
      <mesh rotation={[incRad, 0, 0]}>
        <torusGeometry args={[r_s_vis * 1.5, r_s_vis * 0.03, 12, 128]} />
        <meshStandardMaterial
          color="#ff9933"
          emissive="#ff6600"
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>

      {/* Disco de acreción — point cloud rotando */}
      <group ref={diskGroup} scale={[S, S, S]}>
        <points geometry={diskGeo}>
          <pointsMaterial
            vertexColors
            map={tex}
            alphaMap={tex}
            size={r_in * 0.35}
            sizeAttenuation
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      </group>

      {/* Jets relativistas */}
      <group ref={jetGroup} scale={[S, S, S]}>
        <points geometry={jetGeo}>
          <pointsMaterial
            vertexColors
            map={tex}
            alphaMap={tex}
            size={r_in * 0.5}
            sizeAttenuation
            transparent
            opacity={0.75}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      </group>

      {/* Halo tenue alrededor del BH (corona) */}
      <mesh>
        <sphereGeometry args={[r_s_vis * 2.5, 24, 16]} />
        <meshStandardMaterial
          color="#ff8844"
          emissive="#ff6600"
          emissiveIntensity={0.15}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ── Helpers de UI ────────────────────────────────────────────────────────────

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
      <span className={highlight ? 'text-[#FBBF24]' : 'text-white'}>{value}</span>
    </div>
  );
}

function Slider({
  label, v, min, max, step, on,
}: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function fmt(x: number, d = 3) { return isFinite(x) ? x.toFixed(d) : 'NaN'; }
function fmtSci(x: number) {
  if (!isFinite(x)) return 'NaN';
  const e = Math.floor(Math.log10(Math.abs(x)));
  const m = x / Math.pow(10, e);
  return `${m.toFixed(2)}×10^${e}`;
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function Quasars() {
  const { audience } = useAudience();

  const [presetId, setPresetId] = useState('3c273');
  const preset = PRESETS.find(p => p.id === presetId)!;

  const [spin, setSpin] = useState(preset.spin);
  const [incDeg, setIncDeg] = useState(preset.incDeg);
  const [mdotMult, setMdotMult] = useState(1.0);

  // Cuando el usuario cambia preset, sincronizar parámetros
  const prevPresetId = useRef(presetId);
  if (prevPresetId.current !== presetId) {
    prevPresetId.current = presetId;
    setSpin(preset.spin);
    setIncDeg(preset.incDeg);
    setMdotMult(1.0);
  }

  // Derivar cantidades físicas en SI
  const M_kg = preset.M_sol * M_SUN;
  const Mdot_kg_s = preset.Mdot_sol_yr * M_SUN / (365.25 * 24 * 3600) * mdotMult;
  const incRad = incDeg * Math.PI / 180;

  const r_in  = iscoR(M_kg, spin);
  const r_s   = schwarzschildR(M_kg);
  const T_isco = diskTemp(r_in, r_in * 1.01, M_kg, Mdot_kg_s);

  // Luminosidad bolométrica aprox (integración numérica de Stefan-Boltzmann sobre disco)
  const L_disk = (function () {
    // L ≈ ∫ 2πr σT⁴(r) dr × 2 caras, integrado numéricamente
    let sum = 0;
    const N = 200;
    const lnr_in = Math.log(r_in);
    const lnr_out = Math.log(r_in * 30);
    for (let i = 0; i < N; i++) {
      const r = Math.exp(lnr_in + (i + 0.5) * (lnr_out - lnr_in) / N);
      const T = diskTemp(r, r_in, M_kg, Mdot_kg_s);
      const dlnr = (lnr_out - lnr_in) / N;
      sum += 2 * Math.PI * r * r * SIGMA_SB * T * T * T * T * dlnr * 2; // 2 caras
    }
    return sum;
  })();

  const L_sun = 3.828e26;
  const L_Edd = 1.26e31 * preset.M_sol;
  const eddRatio = L_disk / L_Edd;
  const P_BZ_norm = bzPowerNorm(spin);
  const jetLen_r_in = 40 * (1 + 5 * P_BZ_norm);

  // Escala visual: r_in → 1 unidad R3F
  const SCALE = 1.0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage
          cameraDistance={6}
          autoRotate={true}
          bloomIntensity={1.4}
          bloomThreshold={0.05}
          bgColor="#020408"
        >
          <Sim
            M_kg={M_kg}
            Mdot_kg_s={Mdot_kg_s}
            spin={spin}
            incRad={incRad}
            scale={SCALE}
          />
        </Stage>

        {/* HUD — lecturas físicas */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#050A12]/80 backdrop-blur border border-[#1a2540] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5 pointer-events-none">
          <div><span className="text-[#64748B]">M        </span> {fmtSci(preset.M_sol)} M☉</div>
          <div><span className="text-[#64748B]">r_s      </span> {fmtSci(r_s / 1.496e11)} AU</div>
          <div><span className="text-[#64748B]">r_ISCO   </span> {fmtSci(r_in / 1.496e11)} AU</div>
          <div><span className="text-[#64748B]">T_ISCO   </span> {fmtSci(T_isco)} K</div>
          <div><span className="text-[#64748B]">L/L_Edd  </span>
            <span className={eddRatio > 0.9 ? 'text-[#F87171]' : eddRatio > 0.3 ? 'text-[#FBBF24]' : ''}>
              {fmt(eddRatio, 3)}
            </span>
          </div>
          <div><span className="text-[#64748B]">P_BZ/Ṁc²</span> {fmt(P_BZ_norm, 3)}</div>
          <div><span className="text-[#64748B]">spin a*  </span> {fmt(spin, 3)}</div>
        </div>
      </div>

      <LessonPanel<QState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
          if (patch.spin    !== undefined) setSpin(patch.spin);
          if (patch.incDeg  !== undefined) setIncDeg(patch.incDeg);
        }}
        sandbox={
          <>
            <Section title="Quásar">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => setPresetId(p.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id
                        ? 'bg-gradient-to-br from-[#78350F]/40 to-[#7C3AED]/30 border-[#FBBF24]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>{p.name}</button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">
                {preset.note}
              </div>
            </Section>

            <Section title="Parámetros">
              <Slider label="Spin a*" v={spin} min={0} max={0.999} step={0.001} on={setSpin} />
              <Slider label="Inclinación (°)" v={incDeg} min={5} max={85} step={1} on={setIncDeg} />
              <Slider label="Ṁ / Ṁ₀" v={mdotMult} min={0.01} max={5} step={0.01} on={setMdotMult} />
            </Section>

            {(audience === 'researcher') && (
              <Section title="Física del disco">
                <Row label="M (M☉)"    value={fmtSci(preset.M_sol)} />
                <Row label="r_s (AU)"  value={fmtSci(r_s / 1.496e11)} />
                <Row label="r_ISCO (AU)" value={fmtSci(r_in / 1.496e11)} />
                <Row label="T_ISCO (K)" value={fmtSci(T_isco)} />
                <Row label="L (L☉)"   value={fmtSci(L_disk / L_sun)} />
                <Row label="L/L_Edd"  value={fmt(eddRatio, 4)} highlight={eddRatio > 0.9} />
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Jet Blandford-Znajek">
                <Row label="P_BZ/Ṁc²" value={fmt(P_BZ_norm, 4)} />
                <Row label="L_jet/r_in" value={fmt(jetLen_r_in, 1)} />
                <div className="mt-2 text-[10px] text-[#64748B] leading-snug">
                  P_BZ ∝ a*² Ṁ c² (MAD).{'\n'}
                  Ω_H = a* c³/(2 G M r_H).
                </div>
              </Section>
            )}

            <Section title="Ecuaciones clave">
              <div className="text-[11px] font-mono text-[#94A3B8] leading-snug space-y-1">
                <div className="text-white">T(r) = T₀(r/r_in)^{'{-3/4}'}√(1−√(r_in/r))</div>
                <div>F_obs ∝ δ⁴,  δ = 1/[γ(1−β cos θ)]</div>
                <div>P_BZ ∝ a*² Ṁ c²</div>
                <div className="text-[#64748B] text-[10px]">Shakura-Sunyaev 1973 · BZ 1977</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}
