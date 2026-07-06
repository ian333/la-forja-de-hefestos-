/**
 * Galaxias y Materia Oscura — curva de rotación v(r) en 3D.
 *
 * Física real:
 *   • Componente estelar visible: perfil exponencial de disco Σ(r) = Σ₀ · e^(-r/h)
 *     → velocidad kepleriana aproximada vía masa integrada M(<r)
 *   • Componente gaseosa/ISM: disco exponencial secundario
 *   • Halo de materia oscura NFW (Navarro–Frenk–White 1996):
 *       ρ(r) = ρ_s / [(r/r_s)(1 + r/r_s)²]
 *       M_NFW(<r) = 4π ρ_s r_s³ [ln(1 + r/r_s) − r/r_s/(1 + r/r_s)]
 *   • Curva observada: v_total = √(v²_disk + v²_gas + v²_NFW)
 *   • Curva kepleriana pura: v_kep = √(GM_vis(<r)/r)  (sin DM → cae)
 *
 *   Parámetros default: Vía Láctea canónica
 *     h_disk = 3.5 kpc, M_disk = 5e10 M☉
 *     r_s = 20 kpc,  ρ_s ajustado para v_200 ≈ 220 km/s
 *
 * Visualización 3D:
 *   • ~12 000 partículas de estrella distribuidas según Σ(r) (disco +
 *     bulbo central) con dispersión de altura z ∝ sech²(z/z₀)
 *   • Curva de rotación como anillo de puntos coloreados:
 *       azul-cyan = kepleriana (sin DM, decae)
 *       naranja-ámbar = observada (plana, con DM)
 *   • Halo DM transparente esférico NFW
 *   • Disco rota en tiempo real vía Ω(r) = v(r)/r (diferencial)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Constantes físicas ───────────────────────────────────────────────────────

const G_SI  = 6.674e-11;      // m³ kg⁻¹ s⁻²
const M_SUN = 1.989e30;       // kg
const KPC   = 3.0857e19;      // m / kpc
const KM_S  = 1e3;            // m/s
// Unidades de trabajo: kpc, M☉, km/s → G en unidades galácticas
// G [kpc (km/s)² M☉⁻¹] = G_SI * M_SUN / KPC / KM_S²
const G_GAL = G_SI * M_SUN / KPC / (KM_S * KM_S); // ≈ 4.3009e-6

// ─── Perfiles de masa ─────────────────────────────────────────────────────────

/** Masa del disco estelar exponencial dentro de r (kpc).
 *  Σ(r) = Σ₀ e^{-r/h}  → M(<r) = 2π Σ₀ h² [1 − e^{-r/h}(1 + r/h)]
 *  Normalizamos: M_total = 2π Σ₀ h² → Σ₀ = M_total/(2π h²)
 */
function diskMass(r: number, M_disk: number, h: number): number {
  if (r <= 0) return 0;
  const x = r / h;
  return M_disk * (1 - Math.exp(-x) * (1 + x));
}

/** Masa del halo NFW dentro de r (kpc).
 *  ρ(r) = ρ_s / [(r/r_s)(1 + r/r_s)²]
 *  M(<r) = 4π ρ_s r_s³ [ln(1 + r/r_s) − (r/r_s)/(1 + r/r_s)]
 */
function nfwMass(r: number, rho_s: number, r_s: number): number {
  if (r <= 0) return 0;
  const x = r / r_s;
  return 4 * Math.PI * rho_s * r_s * r_s * r_s * (Math.log(1 + x) - x / (1 + x));
}

/** Velocidad circular de un componente esférico: v = √(GM(<r)/r) */
function vCirc(M_enclosed: number, r: number): number {
  if (r <= 0 || M_enclosed <= 0) return 0;
  return Math.sqrt(G_GAL * M_enclosed / r);
}

// ─── Parámetros del modelo ────────────────────────────────────────────────────

interface GalaxyParams {
  /** Masa del disco estelar (M☉) */
  M_disk: number;
  /** Escala radial del disco (kpc) */
  h_disk: number;
  /** Masa del gas (M☉) */
  M_gas: number;
  /** Escala radial del gas (kpc) */
  h_gas: number;
  /** Densidad característica NFW (M☉/kpc³) */
  rho_s: number;
  /** Radio de escala NFW (kpc) */
  r_s: number;
  /** Radio máximo de la curva (kpc) */
  r_max: number;
}

const PRESETS: Record<string, { name: string; note: string; params: GalaxyParams }> = {
  milky_way: {
    name: 'Vía Láctea',
    note: 'Parámetros canónicos: h=3.5 kpc, v_flat≈220 km/s. El 85% de la masa dentro de 50 kpc es materia oscura.',
    params: {
      M_disk: 5.0e10,  h_disk: 3.5,
      M_gas:  0.5e10,  h_gas:  7.0,
      rho_s:  8.5e6,   r_s:    20.0,
      r_max:  50.0,
    },
  },
  low_dm: {
    name: 'Poca materia oscura',
    note: 'Halo débil: la curva decae claramente — sin DM el disco no puede ser estable.',
    params: {
      M_disk: 5.0e10,  h_disk: 3.5,
      M_gas:  0.5e10,  h_gas:  7.0,
      rho_s:  0.5e6,   r_s:    20.0,
      r_max:  50.0,
    },
  },
  massive_dm: {
    name: 'Halo masivo (cuásar z≈2)',
    note: 'Halos más compactos y densos en el Universo temprano. La curva plana empieza ya a r≈2 kpc.',
    params: {
      M_disk: 8.0e10,  h_disk: 2.0,
      M_gas:  2.0e10,  h_gas:  4.0,
      rho_s:  5.0e7,   r_s:     8.0,
      r_max:  40.0,
    },
  },
};

// ─── Curva de rotación ────────────────────────────────────────────────────────

function computeRotCurve(p: GalaxyParams, N = 300): {
  r: Float32Array; v_kep: Float32Array; v_obs: Float32Array;
} {
  const r    = new Float32Array(N);
  const vkep = new Float32Array(N);
  const vobs = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const ri = (p.r_max * (i + 0.5)) / N;
    r[i] = ri;
    const M_vis  = diskMass(ri, p.M_disk, p.h_disk) + diskMass(ri, p.M_gas, p.h_gas);
    const M_nfw  = nfwMass(ri, p.rho_s, p.r_s);
    const v_d    = vCirc(diskMass(ri, p.M_disk, p.h_disk), ri);
    const v_g    = vCirc(diskMass(ri, p.M_gas,  p.h_gas),  ri);
    const v_nfw  = vCirc(M_nfw, ri);
    vkep[i] = vCirc(M_vis, ri);
    vobs[i] = Math.sqrt(v_d * v_d + v_g * v_g + v_nfw * v_nfw);
  }
  return { r, v_kep: vkep, v_obs: vobs };
}

// ─── Generador de estrellas ────────────────────────────────────────────────────

interface StarData {
  /** posición 3D en coordenadas de escena (unidades normalizadas) */
  positions: Float32Array;
  /** radio galáctico en kpc por estrella */
  radii_kpc: Float32Array;
  /** ángulo inicial φ₀ (rad) */
  phi0: Float32Array;
  /** colores RGB */
  colors: Float32Array;
  count: number;
}

function makeDiskStars(p: GalaxyParams, N: number, sceneScale: number, rng: () => number): StarData {
  const positions  = new Float32Array(N * 3);
  const radii_kpc  = new Float32Array(N);
  const phi0       = new Float32Array(N);
  const colors     = new Float32Array(N * 3);

  for (let i = 0; i < N; i++) {
    // Muestreo por rechazo de Σ(r) = e^{-r/h} · r  (= prob ∝ area × Σ)
    let r_kpc = 0;
    {
      // Método inverso: CDF de Σ·r = e^{-x}(x+1) inversamente con bisección
      // Más sencillo: muestreo de exponencial por transformada + sesgado a bulbo
      const u = rng();
      // 80% disco exponencial, 20% bulbo de Hernquist simplificado
      if (u < 0.8) {
        // Exponencial: muestrear con inverse-CDF aproximado (Método de Devroye)
        // P(r) ∝ r e^{-r/h} → Gamma(2, h) distribución
        const a = -Math.log(Math.max(1e-9, rng()));
        const b = -Math.log(Math.max(1e-9, rng()));
        r_kpc = (a + b) * p.h_disk;
      } else {
        // Bulbo: Hernquist r ~ a·x/(1-x)² con a=0.5 kpc
        const a_b = 0.5;
        const uv  = rng() * 0.92; // evitar singularidad
        r_kpc = a_b * uv / (1 - uv);
      }
    }
    r_kpc = Math.min(r_kpc, p.r_max * 0.98);

    const phi  = rng() * 2 * Math.PI;
    // Altura z: distribución sech²(z/z₀), z₀ = 0.3 kpc
    const z0   = 0.3;
    // Inversa de CDF de sech²: z = z₀ · 2·arctanh(2u − 1) (aprox)
    const uu   = rng() * 0.98 + 0.01;
    const z_kpc = z0 * 2 * Math.atanh(2 * uu - 1) * 0.5;

    const sc   = sceneScale;
    positions[i*3+0] = r_kpc * Math.cos(phi) * sc;
    positions[i*3+1] = z_kpc * sc;
    positions[i*3+2] = r_kpc * Math.sin(phi) * sc;

    radii_kpc[i] = r_kpc;
    phi0[i]      = phi;

    // Color: centro = azul-blanco (jóvenes/bulbo), exterior = amarillo-naranja (viejas)
    const t = Math.min(1, r_kpc / (p.h_disk * 3));
    // inner: 0.8, 0.9, 1.0 (blanco-azulado)
    // outer: 1.0, 0.85, 0.5 (amarillo-anaranjado)
    colors[i*3+0] = 0.8 + 0.2 * t;
    colors[i*3+1] = 0.9 - 0.05 * t;
    colors[i*3+2] = 1.0 - 0.5 * t;
  }

  return { positions, radii_kpc, phi0, colors, count: N };
}

// ─── Lección ──────────────────────────────────────────────────────────────────

interface DMLessonState {
  presetId: string;
  showDM: boolean;
}

const LESSON: Lesson<DMLessonState> = {
  hook: {
    title: 'Las galaxias giran demasiado rápido. Algo invisible las sostiene.',
    body: `En los años 70, Vera Rubin y Kent Ford midieron las velocidades de rotación en docenas de galaxias espirales. Esperaban lo obvio: igual que los planetas del sistema solar, las estrellas más alejadas del centro tendrían que moverse más despacio — curva kepleriana, v ∝ 1/√r.

No fue así. Las estrellas del borde exterior se mueven IGUAL DE RÁPIDO que las del interior. La curva de rotación es completamente PLANA hasta el límite observable.

Hay dos opciones: Newton está mal, o hay masa que no vemos. Hoy tenemos evidencia de al menos cinco tipos distintos de que existe la materia oscura — y que compone el 27% del cosmos. La "curva de rotación plana" fue la primera prueba directa.`,
  },

  steps: [
    {
      title: 'Predicción kepleriana — solo la masa visible',
      duration: 6000,
      body: `Si solo existiera la masa que VEMOS (estrellas + gas), la velocidad circular sería:

v_kep(r) = √(G·M_vis(<r) / r)

Fuera del disco, M_vis(<r) ≈ constante → v ∝ 1/√r. Igual que Kepler: Saturno es más lento que Mercurio.

Observa la curva azul-cyan: sube rápido (el disco acumula masa) y luego decae. Eso predice Newton puro.

El problema: las observaciones muestran la curva NARANJA-ÁMBAR — que es completamente plana hasta 50 kpc.`,
      formula: 'v_kep = √(G·M(<r)/r)\nM visible → v decae ∝ 1/√r',
      keyframes: [
        { at: 0, state: { presetId: 'milky_way', showDM: false } },
        { at: 1, state: { presetId: 'milky_way', showDM: false } },
      ],
    },
    {
      title: 'Halo NFW — la materia oscura salva la curva',
      duration: 6000,
      body: `Navarro, Frenk y White (1996) determinaron, vía simulaciones de N-cuerpos, que los halos de DM siguen un perfil universal:

ρ_NFW(r) = ρ_s / [(r/r_s)(1 + r/r_s)²]

Su masa crece como M(<r) ≈ ln(r) — lo suficientemente rápido para compensar el 1/r y mantener v constante.

Activa el halo NFW (esfera semitransparente). La curva naranja se vuelve plana. Para que funcione, la DM tiene que ser 5–10× más masiva que toda la materia visible dentro de r₂₀₀ ≈ 200 kpc.`,
      formula: 'ρ_NFW = ρ_s / [(r/r_s)(1+r/r_s)²]\nM_NFW(<r) = 4π·ρ_s·r_s³ [ln(1+x) − x/(1+x)]',
      keyframes: [
        { at: 0, state: { presetId: 'milky_way', showDM: true } },
        { at: 1, state: { presetId: 'milky_way', showDM: true } },
      ],
    },
    {
      title: 'Sin materia oscura — el disco se desintegraría',
      duration: 5500,
      body: `Compara con el preset "Poca materia oscura": el halo es débil.

La curva kepleriana (cyan) y la observada (naranja) casi se tocan. El disco no puede sostenerse: sin la gravedad del halo, las velocidades de rotación diferencial generan inestabilidades de Toomre y el disco se fragmenta.

Observacionalmente: galaxias "sin DM" como NGC 1052-DF2 son extremadamente raras y aún debatidas. Son la EXCEPCIÓN que confirma la regla.`,
      formula: 'v_total = √(v²_disco + v²_gas + v²_NFW)\nSin DM: v_total ≈ v_disco → decae',
      keyframes: [
        { at: 0, state: { presetId: 'low_dm', showDM: true } },
        { at: 1, state: { presetId: 'low_dm', showDM: true } },
      ],
    },
    {
      title: 'Universo temprano — halos más compactos',
      duration: 5500,
      body: `En z≈2 (hace 10 mil millones de años), los halos eran más densos y compactos: ρ_s mayor, r_s menor.

La curva plana empieza MÁS CERCA del centro. Las galaxias de alto corrimiento al rojo observadas con JWST confirman este patrón — sus halos son más concentrados.

Esto es una predicción del modelo ΛCDM (Lambda Cold Dark Matter): la estructura es jerárquica, los halos pequeños colapsan primero y se fusionan formando los grandes.`,
      formula: 'r_s ↓ cuando z ↑\n(halos más concentrados en el Universo joven)',
      keyframes: [
        { at: 0, state: { presetId: 'massive_dm', showDM: true } },
        { at: 1, state: { presetId: 'massive_dm', showDM: true } },
      ],
    },
  ],

  connect: {
    body: `La evidencia de la materia oscura no viene solo de las curvas de rotación:

• Lente gravitacional: grupos de galaxias desvían la luz más de lo que su masa visible predice (cúmulo Bala, 2006 — imagen definitiva)
• CMB: las oscilaciones acústicas del fondo de microondas requieren DM para reproducir los picos de potencia observados
• Formación de estructura: sin DM el Universo sería demasiado homogéneo — las galaxias no habrían formado a tiempo
• Efectos Sunyaev–Zel'dovich en cúmulos de galaxias

Lo que NO sabemos: qué ES la DM. Candidatos actuales: WIMPs (en busca), axiones (ADMX), partículas ultraligeras (bosones fuzzy), primordial black holes. Ninguno confirmado aún.

Si entendiste este módulo, entendiste por qué el 27% del Universo es materia oscura — invisible pero MEDIBLE.`,
    links: [
      { label: 'Schwarzschild — curvatura del espacio-tiempo', href: '#schwarzschild' },
      { label: 'Sistema Solar — Kepler newtoniano', href: '#solar-system' },
      { label: 'Cosmología — expansión y energía oscura', href: '#cosmology' },
    ],
  },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function GalaxiesDarkMatter() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('milky_way');
  const [showDM,   setShowDM]   = useState(true);
  const [running,  setRunning]  = useState(true);

  const preset = PRESETS[presetId];
  const params = preset.params;

  // Curva de rotación calculada una vez por preset
  const curve = useMemo(() => computeRotCurve(params, 300), [params]);

  // Velocidad máxima para normalizar la barra de la curva
  const vMax = useMemo(() => {
    let m = 0;
    for (let i = 0; i < curve.v_obs.length; i++) m = Math.max(m, curve.v_obs[i]);
    return m || 1;
  }, [curve]);

  // Escala escena: r_max kpc → 4 unidades
  const sceneScale = 4.0 / params.r_max;

  // Datos de estrellas, regenerados por preset con RNG seeded
  const starData = useMemo(() => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    return makeDiskStars(params, 12000, sceneScale, rng);
  }, [params, sceneScale]);

  // v(r) por estrella — se calcula una sola vez por preset
  const starVelocities = useMemo(() => {
    const omega = new Float32Array(starData.count);
    for (let i = 0; i < starData.count; i++) {
      const r = starData.radii_kpc[i];
      // Interpolar v_obs en la curva
      const idx = Math.min(
        Math.floor((r / params.r_max) * curve.v_obs.length),
        curve.v_obs.length - 1
      );
      const v_km_s = curve.v_obs[Math.max(0, idx)];
      // Ω = v/r  [km/s / kpc] → normalizar a velocidad angular de escena
      // Queremos que 1 vuelta ≈ 8-15 s de visualización (acelerado)
      // v_flat ≈ 220 km/s / 20 kpc ≈ 11 (km/s)/kpc → T_orbit real ≈ 250M yr
      // Factor de aceleración: 1 s pantalla = ~50 M yr → ×50e6 yr / (1 s)
      // Ω_vis = v / (r * scale) en unidades escena/s
      const SPEED_FACTOR = 0.018; // ajustado para que el disco rote visualmente
      omega[i] = r > 0.01 ? (v_km_s / r) * SPEED_FACTOR : 0;
    }
    return omega;
  }, [starData, curve, params]);

  const [, forceRender] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => forceRender(x => x + 1), 100);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={6.5} bloomIntensity={0.9} bloomThreshold={0.10} autoRotate={false}>
          <GalaxyScene
            starData={starData}
            starVelocities={starVelocities}
            curve={curve}
            params={params}
            sceneScale={sceneScale}
            vMax={vMax}
            showDM={showDM}
            running={running}
          />
        </Stage>

        {/* HUD top-left */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">Galaxia </span>{preset.name}</div>
          <div><span className="text-[#64748B]">r_max&nbsp;</span>= {params.r_max} kpc</div>
          <div><span className="text-[#64748B]">M_disco</span>= {(params.M_disk / 1e10).toFixed(1)}×10¹⁰ M☉</div>
          <div><span className="text-[#64748B]">r_s NFW</span>= {params.r_s} kpc</div>
        </div>

        {/* Leyenda curvas */}
        <div className="absolute bottom-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-3 py-2 text-[10px] text-[#94A3B8] space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: '#4FC3F7' }} />
            <span>Kepleriana (solo masa visible)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: '#FDB813' }} />
            <span>Observada (disco + gas + NFW)</span>
          </div>
          {showDM && (
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full border border-[#7E5BEF]/60" style={{ background: 'rgba(126,91,239,0.18)' }} />
              <span>Halo de materia oscura NFW</span>
            </div>
          )}
        </div>

        {/* Controles play/pause */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <button onClick={() => setRunning(r => !r)}
            className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
              running ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10' : 'border-[#1E293B] text-[#94A3B8]'
            }`}>
            {running ? '❚❚' : '▶'}
          </button>
          <button onClick={() => setShowDM(d => !d)}
            title="Mostrar/ocultar halo DM"
            className={`px-3 h-9 rounded-md border text-[11px] transition ${
              showDM ? 'border-[#7E5BEF]/60 text-[#A78BFA] bg-[#7E5BEF]/10' : 'border-[#1E293B] text-[#64748B]'
            }`}>
            DM
          </button>
        </div>
      </div>

      <LessonPanel<DMLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
          if (patch.showDM   !== undefined) setShowDM(patch.showDM);
        }}
        sandbox={
          <>
            <Section title="Galaxia">
              <div className="grid grid-cols-1 gap-1.5">
                {Object.entries(PRESETS).map(([id, pr]) => (
                  <button key={id} onClick={() => setPresetId(id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>
                    {pr.name}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
            </Section>

            <Section title="Materia oscura NFW">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[#94A3B8]">Mostrar halo</span>
                <button onClick={() => setShowDM(d => !d)}
                  className={`px-3 py-1 rounded-md border text-[11px] transition ${
                    showDM ? 'border-[#7E5BEF]/60 text-[#A78BFA] bg-[#7E5BEF]/10' : 'border-[#1E293B] text-[#64748B]'
                  }`}>
                  {showDM ? 'Visible' : 'Oculto'}
                </button>
              </div>
              {audience !== 'child' && (
                <>
                  <Row label="ρ_s"  value={`${(params.rho_s / 1e6).toFixed(1)}×10⁶ M☉/kpc³`} />
                  <Row label="r_s"  value={`${params.r_s} kpc`} />
                  <Row label="M_NFW(<50)" value={`${(nfwMass(50, params.rho_s, params.r_s) / 1e11).toFixed(2)}×10¹¹ M☉`} />
                </>
              )}
            </Section>

            {audience === 'researcher' && (
              <Section title="Parámetros del disco">
                <Row label="M_disk" value={`${(params.M_disk / 1e10).toFixed(1)}×10¹⁰ M☉`} />
                <Row label="h_disk" value={`${params.h_disk} kpc`} />
                <Row label="M_gas"  value={`${(params.M_gas / 1e10).toFixed(1)}×10¹⁰ M☉`} />
                <Row label="h_gas"  value={`${params.h_gas} kpc`} />
                <div className="mt-2 text-[10px] text-[#64748B]">
                  Σ(r) = Σ₀ · e^(-r/h), M(&lt;r) = M_total · [1 − e^(-r/h)(1+r/h)]
                </div>
              </Section>
            )}

            {audience !== 'child' && (
              <Section title="Velocidades (r = 10 kpc)">
                {(() => {
                  const r0 = 10;
                  const M_vis = diskMass(r0, params.M_disk, params.h_disk) + diskMass(r0, params.M_gas, params.h_gas);
                  const M_nfw = nfwMass(r0, params.rho_s, params.r_s);
                  const v_vis = vCirc(M_vis, r0);
                  const v_nfw = vCirc(M_nfw, r0);
                  const v_tot = Math.sqrt(v_vis * v_vis + v_nfw * v_nfw);
                  const frac_dm = v_nfw * v_nfw / (v_tot * v_tot);
                  return (
                    <>
                      <Row label="v_vis (r=10)"  value={`${v_vis.toFixed(1)} km/s`} />
                      <Row label="v_NFW (r=10)"  value={`${v_nfw.toFixed(1)} km/s`} />
                      <Row label="v_total"        value={`${v_tot.toFixed(1)} km/s`} />
                      <Row label="f_DM (cinética)" value={`${(frac_dm * 100).toFixed(1)} %`} highlight={frac_dm > 0.6} />
                    </>
                  );
                })()}
              </Section>
            )}

            <Section title="Fórmula NFW">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">ρ(r) = ρ_s / [(r/r_s)(1+r/r_s)²]</div>
                <div className="text-[#94A3B8]">M(&lt;r) = 4π·ρ_s·r_s³·f(r/r_s)</div>
                <div className="text-[#64748B] text-[10px]">f(x) = ln(1+x) − x/(1+x)</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D (sub-componente — DENTRO del Canvas provisto por Stage) ─────────

interface GalaxySceneProps {
  starData: StarData;
  starVelocities: Float32Array;
  curve: { r: Float32Array; v_kep: Float32Array; v_obs: Float32Array };
  params: GalaxyParams;
  sceneScale: number;
  vMax: number;
  showDM: boolean;
  running: boolean;
}

function GalaxyScene({
  starData, starVelocities, curve, params,
  sceneScale, vMax, showDM, running,
}: GalaxySceneProps) {
  const tex = useMemo(() => getParticleTexture(), []);

  // Geometría de estrellas — reconstruida cuando cambia starData
  const starGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(starData.positions.slice(), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(starData.colors.slice(),    3));
    return g;
  }, [starData]);

  // Ángulos acumulados por estrella (mutable, no reactive)
  const angles = useRef<Float32Array>(new Float32Array(0));
  useEffect(() => {
    angles.current = starData.phi0.slice(); // copia los ángulos iniciales
  }, [starData]);

  // Geometría de la curva de rotación — dos arcos de puntos en plano XZ
  // Mapeamos r → radio_escena y v → altura_Y para que sea legible en 3D
  const { kepGeom, obsGeom } = useMemo(() => {
    const N = curve.r.length;
    const kPos = new Float32Array(N * 3);
    const oPos = new Float32Array(N * 3);
    const kCol = new Float32Array(N * 3);
    const oCol = new Float32Array(N * 3);

    // La curva se despliega como una franja vertical en el plano X > 0, Z=0,
    // con X = r_escena y Y = v_normalizada * altura_curva
    const curveHeight = 2.5; // unidades de escena
    for (let i = 0; i < N; i++) {
      const x = curve.r[i] * sceneScale;
      const yk = (curve.v_kep[i] / vMax) * curveHeight - 0.1;
      const yo = (curve.v_obs[i] / vMax) * curveHeight - 0.1;

      kPos[i*3+0] = x; kPos[i*3+1] = yk; kPos[i*3+2] = 0;
      oPos[i*3+0] = x; oPos[i*3+1] = yo; oPos[i*3+2] = 0;

      // Color kepleriana: cyan degradado
      kCol[i*3+0] = 0.31; kCol[i*3+1] = 0.76; kCol[i*3+2] = 0.97;
      // Color observada: ámbar-naranja
      oCol[i*3+0] = 0.99; oCol[i*3+1] = 0.72; oCol[i*3+2] = 0.08;
    }
    const kg = new THREE.BufferGeometry();
    kg.setAttribute('position', new THREE.BufferAttribute(kPos, 3));
    kg.setAttribute('color',    new THREE.BufferAttribute(kCol, 3));

    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.BufferAttribute(oPos, 3));
    og.setAttribute('color',    new THREE.BufferAttribute(oCol, 3));

    return { kepGeom: kg, obsGeom: og };
  }, [curve, sceneScale, vMax]);

  // Halo DM — esfera NFW (semitransparente, no sólida)
  const haloGeom = useMemo(() => {
    const r200 = params.r_s * 10 * sceneScale; // r_200 ≈ 10 r_s típico
    const g = new THREE.SphereGeometry(r200, 32, 16);
    return g;
  }, [params.r_s, sceneScale]);

  // Animación: rotar las estrellas con Ω diferencial
  useFrame((_, dt) => {
    if (!running) return;
    const posAttr = starGeom.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const ang = angles.current;
    const radii = starData.radii_kpc;

    for (let i = 0; i < starData.count; i++) {
      const omega = starVelocities[i];
      ang[i] += omega * dt;
      const r_sc = radii[i] * sceneScale;
      arr[i*3+0] = r_sc * Math.cos(ang[i]);
      // y (altura) no cambia: arr[i*3+1] queda igual
      arr[i*3+2] = r_sc * Math.sin(ang[i]);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <>
      {/* Disco de estrellas */}
      <points geometry={starGeom}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.035}
          sizeAttenuation
          transparent
          opacity={0.82}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Curva kepleriana (sin DM) */}
      <points geometry={kepGeom} position={[0, -1.8, 0]}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Curva observada (con DM) */}
      <points geometry={obsGeom} position={[0, -1.8, 0]}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Línea de base de la curva */}
      <mesh position={[params.r_max * sceneScale * 0.5, -1.8 - 0.1, 0]}>
        <boxGeometry args={[params.r_max * sceneScale, 0.003, 0.003]} />
        <meshStandardMaterial color="#1E293B" emissive="#1E293B" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.8 + 1.1, 0]}>
        <boxGeometry args={[0.003, 2.2, 0.003]} />
        <meshStandardMaterial color="#1E293B" emissive="#1E293B" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>

      {/* Etiqueta v(r) — pequeño marcador en 3D */}
      <CurveLabel position={[-0.15, -1.8 + 2.3, 0]} />

      {/* Halo de materia oscura NFW */}
      {showDM && (
        <mesh geometry={haloGeom}>
          <meshStandardMaterial
            color="#7E5BEF"
            emissive="#7E5BEF"
            emissiveIntensity={0.12}
            transparent
            opacity={0.07}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {showDM && (
        <mesh geometry={haloGeom}>
          <meshStandardMaterial
            color="#7E5BEF"
            emissive="#7E5BEF"
            emissiveIntensity={0.08}
            transparent
            opacity={0.05}
            side={THREE.FrontSide}
            depthWrite={false}
            wireframe
          />
        </mesh>
      )}

      {/* Bulbo central */}
      <BulgeGlow />
    </>
  );
}

/** Pequeño sprite marcador para el eje Y de la curva */
function CurveLabel({ position }: { position: [number, number, number] }) {
  const tex = useMemo(() => getParticleTexture(), []);
  return (
    <sprite position={position} scale={[0.25, 0.25, 1]}>
      <spriteMaterial map={tex} color="#FDB813" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  );
}

/** Glow del bulbo galáctico central */
function BulgeGlow() {
  const tex = useMemo(() => getParticleTexture(), []);
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.scale.setScalar(1 + 0.04 * Math.sin(t * 0.7));
  });
  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial
          color="#FFF5CC"
          emissive="#FDB813"
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>
      <sprite scale={[1.2, 1.2, 1]}>
        <spriteMaterial map={tex} color="#FDB813" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  );
}

// ─── UI helpers ────────────────────────────────────────────────────────────────

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
