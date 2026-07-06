/**
 * BandStructure — Modelo de Kronig-Penney en 3D cine.
 *
 * FÍSICA REAL: potencial periódico unidimensional (pozos cuadrados de ancho b
 * separados por barreras de ancho a). La condición de autovalores exacta es:
 *
 *   cos(ka) = cos(βb) + P·sin(βb)/(βb)
 *
 * donde:
 *   β  = sqrt(2mE)/ℏ  (vector de onda dentro del pozo)
 *   P  = m·V₀·b·a / ℏ²  (parámetro de Kronig-Penney, mide fuerza del potencial)
 *   k  ∈ [−π/a, π/a]  (vector de onda en la primera zona de Brillouin)
 *
 * Cuando |cos(ka)| ≤ 1 → banda PERMITIDA.
 * Cuando |cos(ka)| > 1 → banda PROHIBIDA (gap).
 *
 * La estructura de bandas E(k) se calcula numéricamente: barremos E de 0
 * a E_max, evaluamos f(E) = cos(βb) + P·sin(βb)/(βb), y detectamos cruces
 * con [−1, +1] en cos(ka). Cada cruce = solución exacta para ese k.
 *
 * VISUALIZACIÓN 3D CINE:
 *   - Curvas E(k) como tubos emisivos coloreados por banda (Bloch spectrum).
 *   - Gaps como planos horizontales semitransparentes (forbidden zones).
 *   - Point cloud aditivo: densidad de estados ρ(E) ∝ 1/|∂E/∂k| que brilla
 *     en los bordes de zona (van Hove singularities).
 *   - Eje k horizontal (zona de Brillouin), eje E vertical.
 *   - Stage autoRotate lento — la estructura se CONTEMPLA.
 *
 * REGLA useFrame: SOLO dentro de sub-componentes hijos de <Stage>.
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ─── Constantes (unidades atómicas ℏ=m=1) ─────────────────────────────────
const HBAR = 1.0;
const MASS = 1.0;

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface KPParams {
  P: number;      // parámetro de Kronig-Penney (adimensional)
  b: number;      // ancho del pozo (u.a.)
  numBands: number; // cuántas bandas mostrar
}

interface BandPoint {
  k: number;   // vector de onda [-π/a, π/a], a=1
  E: number;   // energía (u.a.)
  band: number; // índice de banda 0,1,2,...
}

// ─── Kronig-Penney: condición de dispersión ────────────────────────────────
// f(E) = cos(β·b) + P·sin(β·b)/(β·b)  donde β=sqrt(2mE)/ℏ
// Soluciones: f(E) = cos(k·a), k ∈ [-π/a, π/a], a=1 (período)
function kpDispersion(E: number, P: number, b: number): number {
  if (E <= 0) return -1e10;
  const beta = Math.sqrt(2 * MASS * E) / HBAR;
  const betab = beta * b;
  if (Math.abs(betab) < 1e-12) return 1 + P - (P * betab * betab) / 6; // límite small-arg
  return Math.cos(betab) + P * Math.sin(betab) / betab;
}

// Calcula bandas: devuelve array de BandPoint para una grilla de k
function computeBands(P: number, b: number, numBands: number): BandPoint[] {
  const NK = 200;        // puntos de k en zona de Brillouin
  const NE = 8000;       // puntos de energía en el barrido
  const E_MAX = Math.max(80, (numBands + 1) * (numBands + 1) * Math.PI * Math.PI / 2);
  const dE = E_MAX / NE;

  const points: BandPoint[] = [];

  // Para cada k, buscar todas las E donde f(E) = cos(k)
  for (let ik = 0; ik <= NK; ik++) {
    const k = (ik / NK) * Math.PI; // k en [0, π] (zona reducida, simetría k→-k)
    const cosKA = Math.cos(k);

    let bandCount = 0;
    let fPrev = kpDispersion(dE, P, b) - cosKA;
    for (let ie = 1; ie <= NE && bandCount < numBands; ie++) {
      const E = ie * dE;
      const f = kpDispersion(E, P, b) - cosKA;
      if (fPrev * f < 0) {
        // Cruce de signo — bisección para refinar
        let E_lo = (ie - 1) * dE;
        let E_hi = E;
        for (let iter = 0; iter < 30; iter++) {
          const E_mid = (E_lo + E_hi) / 2;
          const fm = kpDispersion(E_mid, P, b) - cosKA;
          if (fm * fPrev < 0) E_hi = E_mid;
          else { E_lo = E_mid; fPrev = fm; }
        }
        const E_sol = (E_lo + E_hi) / 2;
        points.push({ k, E: E_sol, band: bandCount });

        // También el k negativo (simetría)
        if (k > 1e-6) {
          points.push({ k: -k, E: E_sol, band: bandCount });
        }
        bandCount++;
      }
      fPrev = f;
    }
  }
  return points;
}

// ─── Gaps: intervalos de energía donde f(E) > 1 o < -1 para todos los k ──
interface GapInterval { Emin: number; Emax: number }
function computeGaps(P: number, b: number, numBands: number): GapInterval[] {
  const NE = 8000;
  const E_MAX = Math.max(80, (numBands + 1) * (numBands + 1) * Math.PI * Math.PI / 2);
  const dE = E_MAX / NE;
  const gaps: GapInterval[] = [];
  let inGap = false;
  let gapStart = 0;

  for (let ie = 1; ie <= NE; ie++) {
    const E = ie * dE;
    const f = kpDispersion(E, P, b);
    const forbidden = Math.abs(f) > 1;
    if (!inGap && forbidden) { inGap = true; gapStart = E; }
    if (inGap && !forbidden) {
      gaps.push({ Emin: gapStart, Emax: E });
      inGap = false;
      if (gaps.length >= numBands) break;
    }
  }
  return gaps;
}

// ─── Colores por banda (emisivos, tipo espectro visible) ──────────────────
const BAND_COLORS = [
  new THREE.Color('#FF4040'), // rojo  — banda 0
  new THREE.Color('#FF8C00'), // naranja
  new THREE.Color('#FFE600'), // amarillo
  new THREE.Color('#00E87A'), // verde
  new THREE.Color('#00C8FF'), // cyan
  new THREE.Color('#4080FF'), // azul
  new THREE.Color('#A040FF'), // violeta
  new THREE.Color('#FF40C0'), // magenta
];
function bandColor(b: number): THREE.Color {
  return BAND_COLORS[b % BAND_COLORS.length];
}

// ─── LESSON ────────────────────────────────────────────────────────────────

interface BandState {
  P: number;
  b: number;
  numBands: number;
}

const LESSON: Lesson<BandState> = {
  hook: {
    title: 'Por qué el cobre conduce y el diamante aísla — mismo átomo, diferente red.',
    body: `Un electrón libre viaja en todas direcciones con E = ℏ²k²/2m — una parábola continua. Todo valor de E está permitido.

Pon ese electrón en un cristal: cada átomo es un pozo de potencial periódico. La interferencia de las funciones de Bloch ψ_k(x) = e^{ikx}·u_k(x) abre BRECHAS de energía donde no puede existir ningún estado.

Esas brechas son los gaps. Todo el comportamiento eléctrico de la materia — conductores, aislantes, semiconductores — emerge de si el nivel de Fermi cae dentro de una banda o dentro de un gap.

Esto es el modelo de Kronig-Penney (1931): la solución exacta más simple que captura toda la física.`,
  },

  steps: [
    {
      title: 'Electrón libre → parábola continua',
      duration: 6000,
      body: `Con P = 0 no hay potencial. La energía es E = ℏ²k²/2m — parábola sin interrupciones.

Todas las energías están permitidas. El "cristal" es transparente al electrón.

En la zona de Brillouin reducida [−π/a, π/a] la parábola se "dobla" (zona scheme): los brazos de las bandas superiores son la parábola periódicamente mapeada. Pero sin gap: todo está conectado.

Esta es la referencia: el metal perfecto, sin red iónica.`,
      formula: 'E(k) = ℏ²k²/2m  (libre, P = 0)',
      keyframes: [
        { at: 0, state: { P: 0.01, b: 1.0, numBands: 4 } },
        { at: 1, state: { P: 0.01, b: 1.0, numBands: 4 } },
      ],
    },
    {
      title: 'P pequeño → gaps estrechos (metal)',
      duration: 6500,
      body: `Subimos P = 3: el potencial iónico es débil. Las bandas se parecen a la parábola libre PERO aparecen pequeñas brechas en k = 0 y k = ±π/a (borde de zona).

En esos puntos el electrón tiene velocidad de grupo ∂E/∂k = 0: forma ondas estacionarias. Dos combinaciones sin θ(x) y cos θ(x) tienen energías distintas → gap.

Con gaps pequeños y la banda de conducción medio-llena: METAL. El nivel de Fermi corta una banda → hay estados disponibles a energía infinitesimal.`,
      formula: 'cos(ka) = cos(βb) + P·sin(βb)/(βb)\nGap ≪ Bandwidth',
      keyframes: [
        { at: 0, state: { P: 3, b: 1.0, numBands: 4 } },
        { at: 1, state: { P: 3, b: 1.0, numBands: 4 } },
      ],
    },
    {
      title: 'P grande → gaps amplios (aislante/semiconductor)',
      duration: 7000,
      body: `P = 10: potencial iónico fuerte. Las bandas se vuelven casi PLANAS — el electrón está casi localizado en el pozo. Los gaps son enormes.

Si la última banda ocupada está completamente llena y el gap > 3 eV: AISLANTE (diamante: 5.5 eV).
Si el gap ≈ 1-2 eV: SEMICONDUCTOR (Si: 1.1 eV, Ge: 0.67 eV).

La diferencia entre el cobre y el cuarzo no es el átomo — es la geometría de la red y la fuerza del potencial iónico.`,
      formula: 'P→∞: E_n = n²π²ℏ²/2mb²  (pozo infinito)\nGap ≫ Bandwidth',
      keyframes: [
        { at: 0, state: { P: 10, b: 1.0, numBands: 4 } },
        { at: 1, state: { P: 10, b: 1.0, numBands: 4 } },
      ],
    },
    {
      title: 'Singularidades de van Hove — densidad de estados diverge',
      duration: 6500,
      body: `En los bordes de zona (k = 0, ±π/a), la velocidad de grupo vg = ℏ⁻¹ ∂E/∂k → 0.

La densidad de estados ρ(E) ∝ 1/|∂E/∂k| DIVERGE logarítmicamente (en 1D) o en raíz cuadrada (3D real). Se llaman singularidades de van Hove.

En la visualización: la nube de puntos se espesa en los extremos de cada banda — ahí hay más estados por intervalo de energía. Eso genera los picos en la absorción óptica de semiconductores.`,
      formula: 'ρ(E) ∝ 1/|∇_k E(k)|\n→ ∞ en bordes de zona (van Hove 1953)',
      keyframes: [
        { at: 0, state: { P: 6, b: 1.0, numBands: 5 } },
        { at: 1, state: { P: 6, b: 1.0, numBands: 5 } },
      ],
    },
  ],

  connect: {
    body: `Kronig-Penney (1931) fue el primer modelo que demostró matemáticamente que los gaps son inevitables en cualquier cristal periódico, sin importar cuán débil sea el potencial.

El formalismo completo usa el Teorema de Bloch (ψ_k = e^{ikx}u_k(x)) y la Teoría de Perturbaciones de Onda Plana para cristales reales 3D. Los resultados cualitativos son los mismos.

Aplicaciones directas:
• Diseño de semiconductores (dopar Si/Ge controla el nivel de Fermi)
• Hetero-estructuras (GaAs/AlGaAs: quantum wells artificiales)
• Cristales fotónicos (mismo modelo para fotones en medios periódicos)
• Topología: bandas con número de Chern ≠ 0 → aislantes topológicos (Nobel 2016)

Si entendiste los gaps de Kronig-Penney, ya entendiste por qué existe la electrónica moderna.`,
    links: [
      { label: 'Schrödinger 1D — paquete de onda en el cristal', href: '#schrodinger-1d' },
      { label: 'Átomo de Hidrógeno — niveles discretos (otro gap)', href: '#hydrogen' },
      { label: 'Oscilador cuántico — pozos armónicos', href: '#quantum-harmonic' },
    ],
  },
};

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────

export default function BandStructure() {
  const { audience } = useAudience();

  const [params, setParams] = useState<KPParams>({ P: 6, b: 1.0, numBands: 4 });

  // Calcular bandas (memo: recalcula solo cuando params cambian)
  const { bandPoints, gaps, Emax } = useMemo(() => {
    const bp = computeBands(params.P, params.b, params.numBands);
    const gs = computeGaps(params.P, params.b, params.numBands);
    const Em = bp.length > 0 ? bp.reduce((m, p) => Math.max(m, p.E), 0) * 1.1 : 10;
    return { bandPoints: bp, gaps: gs, Emax: Em };
  }, [params]);

  // Escala visual: k en [-π, π] → x en [-3, 3], E → y en [0, 5]
  const KX_SCALE = 3.0 / Math.PI;
  const EY_SCALE = 5.0 / Math.max(Emax, 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={8} bloomIntensity={0.9} bloomThreshold={0.1} autoRotate>
          <BandScene
            bandPoints={bandPoints}
            gaps={gaps}
            Emax={Emax}
            KX_SCALE={KX_SCALE}
            EY_SCALE={EY_SCALE}
            numBands={params.numBands}
          />
        </Stage>

        {/* HUD info */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/75 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1]">
          <div><span className="text-[#64748B]">P&nbsp;&nbsp;&nbsp;&nbsp;</span>= {params.P.toFixed(2)}</div>
          <div><span className="text-[#64748B]">b&nbsp;&nbsp;&nbsp;&nbsp;</span>= {params.b.toFixed(2)} u.a.</div>
          <div><span className="text-[#64748B]">bandas</span>= {params.numBands}</div>
          <div><span className="text-[#64748B]">gaps&nbsp;&nbsp;</span>= {gaps.length}</div>
        </div>
      </div>

      <LessonPanel<BandState>
        lesson={LESSON}
        onApplyState={(patch) => {
          setParams(prev => ({
            P:        patch.P        ?? prev.P,
            b:        patch.b        ?? prev.b,
            numBands: patch.numBands ?? prev.numBands,
          }));
        }}
        sandbox={
          <>
            <Section title="Parámetro de Kronig-Penney">
              <Slider
                label="P (fuerza del potencial)"
                v={params.P} min={0} max={20} step={0.1}
                on={v => setParams(p => ({ ...p, P: v }))}
              />
              <div className="text-[10px] text-[#64748B] mt-1">
                P ≈ 0 → electrón libre. P → ∞ → pozos infinitos.
              </div>
            </Section>

            <Section title="Geometría de la red">
              <Slider
                label="b (ancho del pozo, u.a.)"
                v={params.b} min={0.2} max={2.0} step={0.05}
                on={v => setParams(p => ({ ...p, b: v }))}
              />
              <div className="flex gap-2 mt-2">
                {[3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setParams(p => ({ ...p, numBands: n }))}
                    className={`flex-1 py-1 rounded border text-[11px] transition ${
                      params.numBands === n
                        ? 'border-[#4FC3F7]/50 text-[#4FC3F7] bg-[#4FC3F7]/10'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155]'
                    }`}
                  >
                    {n}B
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-[#64748B] mt-1">número de bandas</div>
            </Section>

            {audience !== 'child' && (
              <Section title="Presets físicos">
                <div className="grid grid-cols-1 gap-1.5">
                  {PRESETS.map(pr => (
                    <button
                      key={pr.label}
                      onClick={() => setParams(pr.params)}
                      className="text-left px-3 py-2 rounded-md border border-[#1E293B] text-[12px] text-[#94A3B8] hover:border-[#334155] hover:text-white transition"
                    >
                      <span className="text-white font-mono">{pr.label}</span>
                      <span className="text-[#64748B] ml-2">{pr.desc}</span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Condición de dispersión">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">cos(ka) = f(E)</div>
                <div className="text-[#94A3B8]">f(E) = cos(βb) + P·sin(βb)/(βb)</div>
                <div className="text-[#94A3B8]">β = √(2mE)/ℏ</div>
                <div className="mt-2 text-[#64748B] text-[10px]">
                  |f(E)| ≤ 1 → banda permitida<br/>
                  |f(E)| &gt; 1 → gap prohibido
                </div>
              </div>
            </Section>

            {audience === 'researcher' && (
              <Section title="Info">
                <Row label="pts en bandas" value={String(bandPoints.length)} />
                <Row label="gaps" value={String(gaps.length)} />
                {gaps.slice(0, 3).map((g, i) => (
                  <Row
                    key={i}
                    label={`gap ${i + 1}`}
                    value={`${g.Emin.toFixed(1)}–${g.Emax.toFixed(1)} u.a.`}
                  />
                ))}
              </Section>
            )}
          </>
        }
      />
    </div>
  );
}

// ─── Presets físicos ──────────────────────────────────────────────────────

const PRESETS: Array<{ label: string; desc: string; params: KPParams }> = [
  { label: 'Libre',        desc: 'P≈0, sin red',         params: { P: 0.01, b: 1.0, numBands: 4 } },
  { label: 'Metal',        desc: 'P=3, gaps pequeños',   params: { P: 3,    b: 1.0, numBands: 4 } },
  { label: 'Si análogo',   desc: 'P=6, gap moderado',    params: { P: 6,    b: 1.0, numBands: 5 } },
  { label: 'Aislante',     desc: 'P=12, gaps amplios',   params: { P: 12,   b: 1.0, numBands: 4 } },
  { label: 'Pozo ancho',   desc: 'b=1.8 u.a.',           params: { P: 6,    b: 1.8, numBands: 4 } },
];

// ─── Escena 3D ──────────────────────────────────────────────────────────────

interface BandSceneProps {
  bandPoints: BandPoint[];
  gaps: GapInterval[];
  Emax: number;
  KX_SCALE: number;
  EY_SCALE: number;
  numBands: number;
}

function BandScene({ bandPoints, gaps, Emax, KX_SCALE, EY_SCALE, numBands }: BandSceneProps) {
  // Agrupar puntos por banda
  const byBand = useMemo(() => {
    const map = new Map<number, BandPoint[]>();
    for (const pt of bandPoints) {
      if (!map.has(pt.band)) map.set(pt.band, []);
      map.get(pt.band)!.push(pt);
    }
    return map;
  }, [bandPoints]);

  // Geometrías de tubes para cada banda (recalcular con cambio de props)
  const tubeGeoms = useMemo(() => {
    const result: Array<{ geom: THREE.TubeGeometry; color: THREE.Color; band: number }> = [];
    for (const [band, pts] of byBand.entries()) {
      if (pts.length < 2) continue;
      // Ordenar por k
      const sorted = [...pts].sort((a, b) => a.k - b.k);
      // Construir CatmullRomCurve3
      const curvePoints = sorted.map(
        pt => new THREE.Vector3(pt.k * KX_SCALE, pt.E * EY_SCALE, 0)
      );
      try {
        const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.5);
        const geom = new THREE.TubeGeometry(curve, Math.min(curvePoints.length * 2, 400), 0.025, 8, false);
        result.push({ geom, color: bandColor(band), band });
      } catch {
        // Si la curva tiene puntos insuficientes, skip
      }
    }
    return result;
  }, [byBand, KX_SCALE, EY_SCALE]);

  // Point cloud para densidad de estados (van Hove)
  const dosCloud = useMemo(() => {
    const N = Math.min(bandPoints.length, 6000);
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const sorted = [...bandPoints].sort((a, b) => a.k - b.k);
    // Calcular |dk/dE| local (proxy de DOS) con diferencias finitas entre vecinos
    // Para eso, agrupamos por banda y calculamos |Δk/ΔE|
    const byBandLocal = new Map<number, BandPoint[]>();
    for (const pt of sorted) {
      if (!byBandLocal.has(pt.band)) byBandLocal.set(pt.band, []);
      byBandLocal.get(pt.band)!.push(pt);
    }
    let idx = 0;
    for (const [band, pts] of byBandLocal.entries()) {
      const s = [...pts].sort((a, b) => a.k - b.k);
      const c = bandColor(band);
      for (let i = 0; i < s.length && idx < N; i++) {
        const dkdE = i > 0 && i < s.length - 1
          ? Math.abs((s[i+1].k - s[i-1].k) / (s[i+1].E - s[i-1].E + 1e-10))
          : 1;
        // Peso: más puntos donde DOS es alta (borde de zona)
        const weight = Math.min(dkdE * 5, 1.0);
        if (Math.random() > weight * 0.5 + 0.1) continue;
        // Scatter ligeramente en Z para efecto 3D
        const zoff = (Math.random() - 0.5) * 0.3;
        pos[idx*3+0] = s[i].k * KX_SCALE;
        pos[idx*3+1] = s[i].E * EY_SCALE;
        pos[idx*3+2] = zoff;
        col[idx*3+0] = c.r;
        col[idx*3+1] = c.g;
        col[idx*3+2] = c.b;
        idx++;
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, idx * 3), 3));
    geom.setAttribute('color',    new THREE.BufferAttribute(col.slice(0, idx * 3), 3));
    return geom;
  }, [bandPoints, KX_SCALE, EY_SCALE]);

  // Gap planes (forbidden zone visualization)
  const gapMeshes = useMemo(() => {
    return gaps.map((g, i) => {
      const yMid   = ((g.Emin + g.Emax) / 2) * EY_SCALE;
      const height = Math.max((g.Emax - g.Emin) * EY_SCALE, 0.02);
      return { yMid, height, key: i };
    });
  }, [gaps, EY_SCALE]);

  // Eje Y máx escala
  const yMax = Emax * EY_SCALE;

  return (
    <>
      {/* Ejes */}
      <Axes yMax={yMax} />

      {/* Planos de gap (zonas prohibidas) */}
      {gapMeshes.map(g => (
        <mesh key={g.key} position={[0, g.yMid, -0.1]}>
          <planeGeometry args={[Math.PI * 2 * KX_SCALE * 2, g.height]} />
          <meshStandardMaterial
            color="#FF2020"
            emissive="#FF2020"
            emissiveIntensity={0.15}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Tubos de banda E(k) */}
      {tubeGeoms.map(({ geom, color, band }) => (
        <mesh key={band} geometry={geom}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.4}
            toneMapped={false}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>
      ))}

      {/* Point cloud aditivo: densidad de estados */}
      <points geometry={dosCloud}>
        <pointsMaterial
          vertexColors
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Etiqueta zona de Brillouin */}
      <BZLabels yMax={yMax} KX_SCALE={KX_SCALE} numBands={numBands} />

      {/* Animación de glow pulsante en tubos */}
      <PulseDriver tubeGeoms={tubeGeoms} />
    </>
  );
}

// ─── Sub-componente con useFrame (DENTRO del Canvas) ─────────────────────

function PulseDriver({ tubeGeoms }: { tubeGeoms: Array<{ geom: THREE.TubeGeometry; color: THREE.Color; band: number }> }) {
  // Referencia a los meshes para mutar emissiveIntensity (glow pulsante)
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // Cada banda pulsa a frecuencia levemente distinta
      mat.emissiveIntensity = 1.2 + 0.4 * Math.sin(t * 1.2 + i * 0.8);
    });
  });

  return (
    <>
      {tubeGeoms.map(({ geom, color, band }, i) => (
        <mesh
          key={band}
          geometry={geom}
          ref={el => { meshRefs.current[i] = el; }}
        >
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.2}
            toneMapped={false}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>
      ))}
    </>
  );
}

// ─── Ejes de referencia ───────────────────────────────────────────────────

function Axes({ yMax }: { yMax: number }) {
  return (
    <group>
      {/* Eje E (vertical) */}
      <mesh position={[0, yMax / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, yMax, 8]} />
        <meshStandardMaterial color="#334155" emissive="#334155" emissiveIntensity={0.5} />
      </mesh>
      {/* Eje k (horizontal) */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, Math.PI * 2 * 3.0 / Math.PI + 0.5, 8]} />
        <meshStandardMaterial color="#334155" emissive="#334155" emissiveIntensity={0.5} />
      </mesh>
      {/* Bordes de zona de Brillouin: k = ±π/a */}
      {[-1, 1].map(sign => (
        <mesh key={sign} position={[sign * 3.0, yMax / 2, 0]}>
          <cylinderGeometry args={[0.006, 0.006, yMax, 8]} />
          <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={0.4} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Etiquetas de zona de Brillouin (HUD overlay via position proyectada) ──
// Nota: tres text no se pueden usar dentro del Canvas (rompe EffectComposer).
// Usamos marcadores 3D simples (esferas pequeñas) en los puntos de alta simetría.

function BZLabels({ yMax, KX_SCALE, numBands }: { yMax: number; KX_SCALE: number; numBands: number }) {
  // Puntos de alta simetría: Γ (k=0), X (k=±π/a)
  return (
    <group>
      {/* Γ point (k=0) */}
      <mesh position={[0, -0.15, 0]}>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshStandardMaterial color="#FFE600" emissive="#FFE600" emissiveIntensity={2.0} toneMapped={false} />
      </mesh>
      {/* X points (k=±π/a) */}
      {[-1, 1].map(sign => (
        <mesh key={sign} position={[sign * Math.PI * KX_SCALE, -0.15, 0]}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={2.0} toneMapped={false} />
        </mesh>
      ))}
      {/* Tick marks por energía */}
      {Array.from({ length: Math.min(numBands + 1, 6) }, (_, i) => {
        const y = (i / Math.max(numBands, 1)) * yMax;
        return (
          <mesh key={i} position={[-3.3, y, 0]}>
            <boxGeometry args={[0.12, 0.012, 0.012]} />
            <meshStandardMaterial color="#475569" emissive="#475569" emissiveIntensity={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── UI helpers ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function Slider({
  label, v, min, max, step, on,
}: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
