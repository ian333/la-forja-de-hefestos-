/**
 * Agujero negro — Schwarzschild + Kerr (sólo geometría) con disco de acreción
 * estilo Novikov-Thorne, Doppler beaming, gravitational redshift y un anillo de
 * fotones.
 *
 * Lo que es REAL (no decorativo):
 *   - Radios de Schwarzschild (r_s = 2GM/c²), foton sphere (1.5 r_s) e ISCO
 *     (6GM/c² Schwarzschild, fórmula Bardeen-Press-Teukolsky para Kerr).
 *   - Temperatura del disco T(r) ∝ r⁻³ᐟ⁴ (Shakura-Sunyaev, slab geom-thin).
 *   - Velocidad orbital newtoniana v(r) = √(GM/r), usada para Doppler.
 *   - Redshift gravitacional 1+z = (1 - r_s/r)⁻¹ᐟ².
 *   - Doppler factor δ = 1/(γ(1 − β cos θ)).
 *
 * Lo que es APROXIMACIÓN (con aviso):
 *   - El "lensing" en pantalla es un shader screen-space que comprime
 *     ángulos cerca de la sombra (ad hoc, no ray-tracing de geodésicas).
 *     Aun así reproduce la sombra ~ 5.2 r_s y el anillo brillante.
 *   - Kerr sólo cambia r_ISCO; no hay ergosfera ni frame dragging.
 *
 * Presets reales (M en M☉):
 *   - Cygnus X-1 (21)
 *   - Sgr A*    (4.154 × 10⁶)
 *   - M87*       (6.5  × 10⁹)
 *   - Gargantua (1.0  × 10⁸, a* = 0.9999999)
 *   - TON 618   (6.6  × 10¹⁰)
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useAudience } from '@/physics/context';
import { c as cLight, G, AU, YEAR } from '@/lib/physics/constants';
import { schwarzschildRadius } from '@/lib/physics/relativity';
import BHRaytraced from '@/labs/components/BHRaytraced';

// ── Tipos ─────────────────────────────────────────────────────────────
type PresetId = 'cygnus' | 'sgrA' | 'm87' | 'gargantua' | 'ton618' | 'custom';
const M_SUN = 1.98892e30;

interface Preset {
  id: PresetId;
  name: string;
  M_sol: number;
  spin: number;      // a* = a c / (G M), |a*| ≤ 1
  disk: boolean;
  inclinationDeg: number;
  note: string;
  flavor: string;    // tag de color en UI
}

const PRESETS: Preset[] = [
  { id: 'cygnus', name: 'Cygnus X-1 (estelar)', M_sol: 21, spin: 0.95, disk: true, inclinationDeg: 27,
    note: 'BH estelar real. Era una estrella supergigante; ahora un disco caliente brilla en rayos X.',
    flavor: '#4FC3F7' },
  { id: 'sgrA', name: 'Sgr A* (centro Vía Láctea)', M_sol: 4.154e6, spin: 0.5, disk: false, inclinationDeg: 50,
    note: 'El monstruo del centro galáctico. EHT 2022. Acreción mínima — calmado, raro entre AGNs.',
    flavor: '#A78BFA' },
  { id: 'm87', name: 'M87* (la foto del EHT)', M_sol: 6.5e9, spin: 0.9, disk: true, inclinationDeg: 17,
    note: 'El que viste fotografiado el 10 abril 2019. Jet relativista de 5000 años-luz. Aluminio cinéfilo.',
    flavor: '#FDB813' },
  { id: 'gargantua', name: 'Gargantua (Interstellar)', M_sol: 1.0e8, spin: 0.9999999, disk: true, inclinationDeg: 9,
    note: 'Kip Thorne supervisó. a*=0.9999999 (casi extremal). Miller\'s planet a 1.49 r_s — 1 h = 7 años.',
    flavor: '#F472B6' },
  { id: 'ton618', name: 'TON 618 (el más masivo)', M_sol: 6.6e10, spin: 0.7, disk: true, inclinationDeg: 35,
    note: 'Cuásar a 10.4 Gly. r_s ≈ 1300 UA — la órbita de Neptuno cabe DENTRO del horizonte.',
    flavor: '#FACC15' },
];

// ── ISCO Kerr (Bardeen-Press-Teukolsky 1972) ──────────────────────────
function rIscoKerr(M_kg: number, aStar: number, prograde = true): number {
  const a = Math.max(-0.9999999, Math.min(0.9999999, aStar));
  const rg = G * M_kg / (cLight * cLight);            // GM/c²
  const Z1 = 1 + Math.cbrt(1 - a*a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const Z2 = Math.sqrt(3*a*a + Z1*Z1);
  const sign = prograde ? -1 : 1;
  return rg * (3 + Z2 + sign * Math.sqrt((3 - Z1) * (3 + Z1 + 2*Z2)));
}

// ── Hawking ───────────────────────────────────────────────────────────
function hawkingTemperatureK(M_kg: number): number {
  // T = ℏ c³ / (8 π G M k_B). Use values directly to avoid importing more constants.
  const hbar = 1.054571817e-34;
  const kB = 1.380649e-23;
  return hbar * Math.pow(cLight, 3) / (8 * Math.PI * G * M_kg * kB);
}
function hawkingEvaporationYears(M_kg: number): number {
  // τ ≈ 5120 π G² M³ / (ℏ c⁴) — Page 1976
  const hbar = 1.054571817e-34;
  const tau = 5120 * Math.PI * G * G * Math.pow(M_kg, 3) / (hbar * Math.pow(cLight, 4));
  return tau / YEAR;
}

// ── Formato humano ────────────────────────────────────────────────────
function fmtMass(M_kg: number): string {
  return `${(M_kg / M_SUN).toExponential(2)} M☉`;
}
function fmtLength(m: number): string {
  if (m < 1e3) return `${m.toFixed(1)} m`;
  if (m < 1e9) return `${(m/1e3).toFixed(2)} km`;
  if (m < AU * 0.1) return `${(m/1e6).toFixed(2)} Mm`;
  return `${(m/AU).toExponential(2)} UA`;
}
function fmtSci(x: number, d = 2) { return isFinite(x) ? x.toExponential(d) : 'NaN'; }

// ────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────
export default function BlackHole() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<PresetId>('gargantua');
  const [customM, setCustomM] = useState<number>(1.0e8);   // M_sol
  const [customSpin, setCustomSpin] = useState<number>(0.9999999);
  const [inclinationDeg, setInclinationDeg] = useState<number>(9);
  const [showLensing, setShowLensing] = useState(true);
  const [showPhotonRing, setShowPhotonRing] = useState(true);
  const [diskVisible, setDiskVisible] = useState(true);

  // Cuando cambias preset, sincroniza también custom
  const preset = useMemo(() => {
    if (presetId === 'custom') {
      return { id: 'custom' as PresetId, name: 'Personalizado', M_sol: customM, spin: customSpin,
        disk: diskVisible, inclinationDeg, note: 'Tus parámetros.', flavor: '#22D3EE' };
    }
    const p = PRESETS.find(p => p.id === presetId)!;
    return p;
  }, [presetId, customM, customSpin, inclinationDeg, diskVisible]);

  // Si se selecciona un preset (no custom), sus valores ganan
  const effectiveM_sol = preset.id === 'custom' ? customM : preset.M_sol;
  const effectiveSpin  = preset.id === 'custom' ? customSpin : preset.spin;
  const effectiveIncl  = preset.id === 'custom' ? inclinationDeg : preset.inclinationDeg;

  // Diagnósticos físicos
  const diag = useMemo(() => {
    const M_kg = effectiveM_sol * M_SUN;
    const rs   = schwarzschildRadius(M_kg);
    const rph  = 1.5 * rs;
    const isco = rIscoKerr(M_kg, effectiveSpin, true);
    const isco_rs = isco / rs;
    // Gravedad superficial en horizonte: κ = c⁴ / (4 G M)
    const surfaceGravity = Math.pow(cLight, 4) / (4 * G * M_kg);
    // Tidal Δa entre la cabeza y los pies de un humano (2 m) a r_s
    // tidal = 2 G M L / r³ (Newtoniano)
    const tidalAtHorizon = 2 * G * M_kg * 2 / (rs * rs * rs);
    const Thawking = hawkingTemperatureK(M_kg);
    const evapYears = hawkingEvaporationYears(M_kg);
    // Time dilation factor at Miller's planet style orbit (just above ISCO)
    const rMiller = isco * 1.001;
    const td = Math.sqrt(Math.max(1e-12, 1 - rs / rMiller));
    const millerFactor = td > 1e-6 ? 1 / td : Infinity;
    return { M_kg, rs, rph, isco, isco_rs, surfaceGravity, tidalAtHorizon, Thawking, evapYears, millerFactor };
  }, [effectiveM_sol, effectiveSpin]);

  return (
    <div className="grid grid-cols-[1fr_360px] gap-0" style={{ height: 'calc(100vh - 60px)' }}>
      {/* ── Viewport 3D ───────────────────────────────────────────────── */}
      <div className="relative">
        <div
          className="relative w-full h-full"
          style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}
        >
          <Canvas
            camera={{ position: [0, 1.5, 6.5], fov: 45, near: 0.001, far: 200 }}
            dpr={[0.55, 1]}
            gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
            style={{ background: 'transparent', width: '100%', height: '100%' }}
          >
            <BlackHoleScene
              rsUnits={1}
              isco_rs={diag.isco_rs}
              inclinationDeg={effectiveIncl}
              spin={effectiveSpin}
              showDisk={diskVisible}
              showLensing={showLensing}
              showPhotonRing={showPhotonRing}
              massHueShift={(Math.log10(Math.max(1, effectiveM_sol)) - 1) / 11}
            />
            <OrbitControls enablePan={false} enableDamping dampingFactor={0.08}
                           minDistance={3} maxDistance={30} />
          </Canvas>
        </div>

        {/* Heads-up display */}
        <div className="absolute top-4 left-4 rounded-lg bg-black/70 backdrop-blur border border-[#1E293B] px-4 py-3 font-mono text-[11px] text-[#CBD5E1] max-w-[400px]">
          <div className="text-[9px] uppercase tracking-[0.25em]" style={{ color: preset.flavor }}>
            {preset.name}
          </div>
          <div className="text-[14px] font-semibold text-white mt-1 leading-tight">
            M = {fmtMass(diag.M_kg)}  ·  a* = {effectiveSpin.toFixed(7)}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2 text-[10px]">
            <Stat label="r_s"        value={fmtLength(diag.rs)} />
            <Stat label="r_fotón"    value={fmtLength(diag.rph)} />
            <Stat label="r_ISCO"     value={`${fmtLength(diag.isco)} = ${diag.isco_rs.toFixed(2)} r_s`} />
            <Stat label="κ horizonte" value={`${fmtSci(diag.surfaceGravity, 2)} m/s²`} />
            <Stat label="T_Hawking"  value={`${fmtSci(diag.Thawking, 2)} K`} />
            <Stat label="τ evap."    value={`${fmtSci(diag.evapYears, 2)} años`} />
          </div>
        </div>

        {/* Leyenda inferior */}
        <div className="absolute bottom-4 left-4 rounded-lg bg-black/70 backdrop-blur border border-[#1E293B] px-3 py-2 text-[10px] text-[#94A3B8] space-y-1 max-w-[460px]">
          <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-black border border-white/20" /><span>Sombra ≈ 5.2 r_s (radio aparente del horizonte tras lensing)</span></div>
          <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{ background: 'radial-gradient(circle, #FFFFFF 30%, #FDB813 100%)' }} /><span>Anillo de fotones — última órbita estable de la luz</span></div>
          {diskVisible && (
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(90deg, #FFFFFF, #FDB813, #B91C1C)' }} /><span>Disco de acreción · brillo asimétrico = Doppler beaming</span></div>
          )}
        </div>

        {/* Spaghettification warning para BHs pequeños */}
        {diag.tidalAtHorizon > 100 && (
          <div className="absolute top-4 right-4 rounded-lg bg-[#7F1D1D]/60 backdrop-blur border border-[#F87171]/50 px-3 py-2 text-[10px] text-[#FECACA] max-w-[200px]">
            ⚠ Δa cabeza-pies en horizonte = {fmtSci(diag.tidalAtHorizon, 1)} m/s².<br/>
            Te rompe MUCHO antes de cruzar.
          </div>
        )}
        {diag.tidalAtHorizon < 1e-3 && (
          <div className="absolute top-4 right-4 rounded-lg bg-[#1E3A5F]/60 backdrop-blur border border-[#4FC3F7]/40 px-3 py-2 text-[10px] text-[#BAE6FD] max-w-[200px]">
            ⓘ A esta masa, cruzas el horizonte sin sentir nada. La marea es ~{fmtSci(diag.tidalAtHorizon, 1)} m/s². Cooper sobrevivió.
          </div>
        )}
      </div>

      {/* ── Panel lateral ─────────────────────────────────────────────── */}
      <aside className="border-l border-[#1E293B] bg-[#070B12] overflow-y-auto text-[12px] text-[#CBD5E1]">
        <Section title="Preset">
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map(p => (
              <button key={p.id}
                onClick={() => { setPresetId(p.id); }}
                data-testid={`bh-preset-${p.id}`}
                className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                  presetId === p.id
                    ? 'border-white/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}
                style={presetId === p.id ? {
                  background: `linear-gradient(135deg, ${p.flavor}24, ${p.flavor}05)`,
                  borderColor: p.flavor + '88',
                } : undefined}
              >
                <div className="text-[13px] font-semibold flex items-center justify-between">
                  <span>{p.name}</span>
                  <span className="text-[10px] font-mono opacity-70">{p.M_sol.toExponential(1)} M☉</span>
                </div>
                {presetId === p.id && (
                  <div className="text-[10.5px] mt-1 leading-snug" style={{ color: p.flavor }}>{p.note}</div>
                )}
              </button>
            ))}
            <button onClick={() => setPresetId('custom')}
              className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                presetId === 'custom'
                  ? 'bg-gradient-to-br from-[#22D3EE]/20 to-[#22D3EE]/5 border-[#22D3EE]/50 text-white'
                  : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
              }`}>
              <div className="text-[13px] font-semibold">Personalizado · sliders</div>
            </button>
          </div>
        </Section>

        {presetId === 'custom' && (
          <Section title="Masa & espín">
            <SliderLabel label="log₁₀(M/M☉)" value={Math.log10(customM).toFixed(2)} />
            <input type="range" min={0} max={11} step={0.05}
              value={Math.log10(customM)}
              onChange={e => setCustomM(Math.pow(10, Number(e.target.value)))}
              className="w-full" />
            <div className="text-[10px] text-[#64748B] mt-1">
              {customM < 1 ? 'sub-estelar (Hawking domina)' :
               customM < 100 ? 'estelar' :
               customM < 1e5 ? 'intermedio (raros)' :
               customM < 1e9 ? 'supermasivo' :
               'ultramasivo'}
            </div>

            <SliderLabel label="a* (espín)" value={customSpin.toFixed(7)} />
            <input type="range" min={0} max={0.9999999} step={0.0000001}
              value={customSpin}
              onChange={e => setCustomSpin(Number(e.target.value))}
              className="w-full" />
            <div className="text-[10px] text-[#64748B] mt-1">
              a* = 0 → Schwarzschild · a* → 1 → Kerr extremal (límite Thorne).
            </div>
          </Section>
        )}

        <Section title="Vista">
          <SliderLabel label="Inclinación" value={`${effectiveIncl.toFixed(0)}°`} />
          <input type="range" min={0} max={89} step={1}
            value={effectiveIncl}
            onChange={e => setInclinationDeg(Number(e.target.value))}
            className="w-full" />
          <div className="text-[10px] text-[#64748B] mt-1 mb-3">
            Ángulo de observación al plano del disco. M87* se ve a 17°; Gargantua a 9°.
          </div>

          <Toggle label="Disco de acreción" value={diskVisible} onChange={setDiskVisible} />
          <Toggle label="Anillo de fotones" value={showPhotonRing} onChange={setShowPhotonRing} />
          <Toggle label="Lente gravitacional" value={showLensing} onChange={setShowLensing} />
        </Section>

        {audience === 'researcher' && (
          <Section title="Ecuaciones">
            <KaTeXLine math={String.raw`r_s = \dfrac{2GM}{c^2}`} />
            <KaTeXLine math={String.raw`r_{\rm fotón} = \tfrac{3}{2} r_s`} />
            <KaTeXLine math={String.raw`r_{\rm ISCO}^{a=0} = 3 r_s = \tfrac{6 GM}{c^2}`} />
            <KaTeXLine math={String.raw`r_{\rm ISCO}^{a=1} = \tfrac{GM}{c^2} = \tfrac{1}{2} r_s`} />
            <KaTeXLine math={String.raw`T(r) \propto r^{-3/4}\ \text{(Shakura-Sunyaev)}`} />
            <KaTeXLine math={String.raw`\delta_{\rm Doppler} = \dfrac{1}{\gamma(1-\beta\cos\theta)}`} />
            <KaTeXLine math={String.raw`1+z = (1 - r_s/r)^{-1/2}`} />
            <KaTeXLine math={String.raw`T_H = \dfrac{\hbar c^3}{8\pi G M k_B}`} />
          </Section>
        )}

        <Section title="Datos en vivo">
          <Row label="Tipo" value={
            effectiveM_sol < 100 ? 'estelar' :
            effectiveM_sol < 1e5 ? 'intermedio' :
            effectiveM_sol < 1e9 ? 'supermasivo' : 'ultramasivo'
          } />
          <Row label="Masa" value={fmtMass(diag.M_kg)} />
          <Row label="r_s" value={fmtLength(diag.rs)} />
          <Row label="r_s en UA" value={(diag.rs / AU).toExponential(2)} />
          <Row label="r_ISCO" value={fmtLength(diag.isco)} />
          <Row label="r_ISCO / r_s" value={diag.isco_rs.toFixed(3)} />
          <Row label="κ horizonte" value={`${fmtSci(diag.surfaceGravity, 2)} m/s²`} />
          <Row label="T Hawking" value={`${fmtSci(diag.Thawking, 2)} K`} />
          <Row label="τ evap." value={`${fmtSci(diag.evapYears, 2)} años`} />
          <Row label="Dilatación @ ISCO" value={`${fmtSci(diag.millerFactor, 2)}×`} highlight />
          <Row label="Δa (2 m) @ r_s" value={`${fmtSci(diag.tidalAtHorizon, 2)} m/s²`}
            highlight={diag.tidalAtHorizon > 100} />
        </Section>

        <Section title="¿Qué estás viendo?">
          <p className="text-[11.5px] leading-relaxed text-[#94A3B8]">
            La sombra negra del centro NO es el horizonte de eventos — es la región
            de donde no escapa luz hacia ti después de doblarse por la curvatura.
            Por geometría su radio aparente es ≈ √27 · GM/c² ≈ 2.6 r_s = 5.2 GM/c².
            El "anillo" brillante alrededor es la luz que pasó por la esfera de
            fotones (1.5 r_s) dando vueltas antes de salir.
          </p>
          <p className="text-[11.5px] leading-relaxed text-[#94A3B8] mt-2">
            La asimetría del disco — un lado mucho más brillante que el otro — es
            el <em>Doppler beaming</em> relativista: el material que viene hacia
            ti emite con mayor intensidad. Es la imagen que Kip Thorne calculó
            para Interstellar antes de que ningún telescopio mostrara una.
          </p>
        </Section>
      </aside>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// SCENE
// ────────────────────────────────────────────────────────────────────────
function BlackHoleScene(props: {
  rsUnits: number;
  isco_rs: number;
  inclinationDeg: number;
  spin: number;
  showDisk: boolean;
  showLensing: boolean;
  showPhotonRing: boolean;
  massHueShift: number;
}) {
  // Raytracing fullscreen — un solo shader hace BH + disco + lensing + estrellas
  // con curvatura de geodésicas Schwarzschild. Reemplaza Mesh por Mesh las
  // cuatro pasadas anteriores (Starfield, LensingSphere, EventHorizon,
  // PhotonRing, AccretionDisk).
  //
  // showLensing en este modo controla la densidad estelar (sin él = casi
  // sin estrellas), porque las estrellas SON el background lensed.
  return (
    <BHRaytraced
      rs={props.rsUnits}
      rIn={props.isco_rs}
      rOut={Math.max(props.isco_rs + 2, 16)}
      inclinationDeg={props.inclinationDeg}
      diskOpacity={props.showDisk ? 1.0 : 0.0}
      starDensity={props.showLensing ? 1.0 : 0.15}
      photonRing={props.showPhotonRing}
      starSeed={props.massHueShift * 7}
    />
  );
}

// ── Horizonte: esfera matte black con un halo emisivo apenas perceptible ───
function EventHorizon({ rs }: { rs: number }) {
  return (
    <mesh renderOrder={2}>
      <sphereGeometry args={[rs * 1.005, 64, 64]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
  );
}

// ── Photon ring: torus delgado a 2.6 r_s (sombra aparente) ───────────────
function PhotonRing({ rs }: { rs: number }) {
  // El "ring" observado debido al lensing está a r_shadow = √27 GM/c² ≈ 2.6 r_s.
  // El plano del anillo coincide con el de visión, no con el del disco — por eso
  // lo ponemos cara a cámara.
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.lookAt(camera.position);
  });
  return (
    <mesh ref={ref} renderOrder={5}>
      <ringGeometry args={[2.55 * rs, 2.78 * rs, 256]} />
      <shaderMaterial
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        uniforms={{
          uInner: { value: 2.55 * rs },
          uOuter: { value: 2.78 * rs },
        }}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vPos;
          void main() {
            vUv = uv;
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          varying vec3 vPos;
          uniform float uInner;
          uniform float uOuter;
          void main() {
            float r = length(vPos.xy);
            float mid = 0.5 * (uInner + uOuter);
            float w = (uOuter - uInner) * 0.5;
            float d = abs(r - mid) / w;
            float a = exp(-d*d * 8.0);
            vec3 col = mix(vec3(1.0, 0.9, 0.55), vec3(1.0, 1.0, 1.0), 1.0 - d);
            gl_FragColor = vec4(col * (1.2 + 1.5 * a), a);
          }
        `}
      />
    </mesh>
  );
}

// ── Lensing: esfera grande tras la BH con shader que comprime UVs ─────────
function LensingSphere({ rs }: { rs: number }) {
  // Truco: una esfera "ambient sky" gigante con shader que distorsiona UVs
  // según el ángulo desde el centro hacia la BH (proyección screen-space).
  const matRef = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh renderOrder={0} scale={[80, 80, 80]}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{
          uTime: { value: 0 },
          uRs:   { value: rs },
        }}
        vertexShader={`
          varying vec3 vWorldDir;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldDir = normalize(wp.xyz - cameraPosition);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          varying vec3 vWorldDir;
          uniform float uTime;
          uniform float uRs;
          // Hash + value noise para estrellas — un kernel cheap
          float hash(vec3 p) {
            p = fract(p * 0.3183099 + .1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }
          vec3 stars(vec3 dir) {
            vec3 d = normalize(dir);
            vec3 c = vec3(0.0);
            float scale = 600.0;
            vec3 g = d * scale;
            vec3 fl = floor(g);
            for (int dx=-1; dx<=1; dx++) {
              for (int dy=-1; dy<=1; dy++) {
                for (int dz=-1; dz<=1; dz++) {
                  vec3 cell = fl + vec3(dx, dy, dz);
                  float h = hash(cell);
                  if (h > 0.994) {
                    vec3 starPos = (cell + vec3(hash(cell + 1.7), hash(cell + 3.1), hash(cell + 7.7))) / scale;
                    starPos = normalize(starPos);
                    float dot_ = dot(d, starPos);
                    float ang = (1.0 - dot_) * 8000.0;
                    float intensity = exp(-ang) * (h - 0.994) * 220.0;
                    float t = hash(cell + 11.0);
                    vec3 tint = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.85, 0.6), t);
                    if (t > 0.85) tint = vec3(1.0, 1.0, 1.0);
                    c += tint * intensity;
                  }
                }
              }
            }
            // milky way band
            float mw = exp(- d.y*d.y * 5.0) * 0.04;
            mw *= 0.6 + 0.4 * hash(d * 80.0);
            c += vec3(0.55, 0.5, 0.7) * mw;
            return c;
          }
          void main() {
            // Direction del fragmento desde la cámara
            vec3 dir = normalize(vWorldDir);
            // Vector desde la cámara hacia el BH (origen en mundo)
            vec3 toBh = normalize(-cameraPosition);
            // Ángulo entre dir y toBh — cuán cerca del BH apunta este pixel
            float cosA = dot(dir, toBh);
            float ang = acos(clamp(cosA, -1.0, 1.0));
            // r aparente del BH a la distancia |cam| → α_shadow ≈ asin(2.6 rs / |cam|)
            float dCam = length(cameraPosition);
            float aShadow = atan(2.6 * uRs, dCam);
            // Deflexión total Einstein: α_def ≈ 4GM/(c² b) = 2 rs / b en weak field
            // En screen-space, sigmoid suave: cuanto más cerca del BH, más comprime.
            float aPlus = aShadow * 1.05;            // umbral lensing
            float t = smoothstep(aPlus, aPlus * 6.0, ang);
            // Distorsión: deflect direction hacia los lados, alejando del BH
            // dirección perpendicular a toBh dentro del plano del BH-camera-dir
            vec3 perp = normalize(dir - toBh * cosA);
            // Sample dirección "distorsionada": ángulo original + delta
            float delta = (1.0 - t) * 0.0015 / max(ang*ang, 1e-4);
            delta = clamp(delta, 0.0, 0.6);
            float newAng = ang + delta;
            vec3 newDir = cos(newAng) * toBh + sin(newAng) * perp;
            vec3 col = stars(newDir);
            // Dentro de la sombra → negro
            if (ang < aShadow) col = vec3(0.0);
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// ── Accretion disk: anillo plano con shader Doppler + redshift + T(r) ────
function AccretionDisk({ rs, rIn, rOut, hueShift, spin }: {
  rs: number; rIn: number; rOut: number; hueShift: number; spin: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock, camera }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
    matRef.current.uniforms.uCamPos.value.copy(camera.position);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
      <ringGeometry args={[rIn * rs, rOut * rs, 256, 64]} />
      <shaderMaterial
        ref={matRef}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uRs: { value: rs },
          uRIn: { value: rIn * rs },
          uROut: { value: rOut * rs },
          uHueShift: { value: hueShift },
          uSpin: { value: spin },
          uCamPos: { value: new THREE.Vector3() },
        }}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vViewDir;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            vViewDir = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          precision highp float;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vViewDir;
          uniform float uTime;
          uniform float uRs;
          uniform float uRIn;
          uniform float uROut;
          uniform float uHueShift;
          uniform float uSpin;
          uniform vec3  uCamPos;

          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash21(i);
            float b = hash21(i + vec2(1, 0));
            float c = hash21(i + vec2(0, 1));
            float d = hash21(i + vec2(1, 1));
            vec2 u = f*f*(3.0 - 2.0*f);
            return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
          }
          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 5; i++) {
              v += a * noise(p);
              p *= 2.07;
              a *= 0.5;
            }
            return v;
          }

          // Blackbody-ish color por temperatura normalizada [0,1]
          // 0 → frío rojizo, 0.4 → naranja, 0.7 → blanco, 1 → azul-violeta
          vec3 blackbody(float t) {
            t = clamp(t, 0.0, 1.0);
            vec3 c0 = vec3(0.50, 0.05, 0.02);   // rojo profundo
            vec3 c1 = vec3(1.00, 0.32, 0.05);   // naranja
            vec3 c2 = vec3(1.00, 0.92, 0.60);   // amarillo cálido
            vec3 c3 = vec3(1.00, 1.00, 1.00);   // blanco
            vec3 c4 = vec3(0.60, 0.78, 1.00);   // azul claro
            vec3 c5 = vec3(0.45, 0.32, 1.00);   // violeta
            if (t < 0.2)        return mix(c0, c1, t / 0.2);
            if (t < 0.45)       return mix(c1, c2, (t-0.2) / 0.25);
            if (t < 0.65)       return mix(c2, c3, (t-0.45) / 0.20);
            if (t < 0.85)       return mix(c3, c4, (t-0.65) / 0.20);
            return mix(c4, c5, (t-0.85) / 0.15);
          }

          void main() {
            vec3 p = vWorldPos;
            float r = length(p.xz);
            float phi = atan(p.z, p.x);
            float u = clamp((r - uRIn) / (uROut - uRIn), 0.0, 1.0);

            // T ∝ r^(-3/4) Shakura-Sunyaev
            float tNorm = pow(uRIn / r, 0.75);

            // β = v/c, prograde keplerian
            float beta = sqrt(uRs / (2.0 * r));
            beta = clamp(beta, 0.0, 0.96);

            // Doppler factor δ = 1 / [γ (1 - β cosθ)] — I ∝ δ⁴ bolométrico
            vec3 vOrb = vec3(-sin(phi), 0.0, cos(phi));
            float cosTheta = dot(vOrb, vViewDir);
            float gamma = 1.0 / sqrt(1.0 - beta*beta);
            float delta = 1.0 / (gamma * (1.0 - beta * cosTheta));
            float boost = pow(delta, 4.0);

            // Redshift gravitacional
            float zFactor = sqrt(max(1e-3, 1.0 - uRs / r));

            // Streamers logarítmicos (turbulencia magneto-rotacional)
            float lr = log(r / uRIn + 0.1);
            vec2 swirl = vec2(phi * 4.0 + lr * 6.0 - uTime * 0.7,
                              lr * 5.0 - uTime * 0.35);
            float turb1 = fbm(swirl);
            float turb2 = fbm(swirl * 3.5 + vec2(uTime * 0.6, 0.0));
            float turb = mix(turb1, turb2, 0.45);
            float streamer = pow(0.55 + 0.45 * turb, 1.5);

            // Bordes
            float edge = smoothstep(0.0, 0.04, u) * (1.0 - smoothstep(0.85, 1.0, u));

            // Densidad
            float density = pow(uRIn / r, 1.5) * 1.1 + 0.25;

            // Color
            float tempForColor = clamp(tNorm * zFactor + 0.1, 0.0, 1.0);
            vec3 col = blackbody(tempForColor);

            // Doppler boost MUY visible
            col *= boost * streamer * density * edge * 1.8;

            // Hot edge brillante (rim near ISCO)
            float hotEdge = exp(-pow((r - uRIn) / (uRIn * 0.25), 2.0)) * 1.6;
            col += vec3(1.0, 0.85, 0.55) * hotEdge * density * edge;

            float alpha = clamp(edge * density * (0.6 + 0.4 * streamer) * (0.4 + 0.6 * boost / 4.0), 0.0, 1.0);
            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </mesh>
  );
}

// ── Starfield extra (puntos físicos) — más densidad que la del shader ─────
function Starfield() {
  const stars = useMemo(() => {
    const N = 800;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Distribuir en esfera radio 70
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 70 + Math.random() * 5;
      arr[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
      arr[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i*3+2] = r * Math.cos(phi);
    }
    return arr;
  }, []);
  return (
    <points renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={stars.length / 3} array={stars} itemSize={3} args={[stars, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#FFFFFF" size={0.06} sizeAttenuation transparent opacity={0.8} />
    </points>
  );
}

// ────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ────────────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={highlight ? 'text-[#FACC15]' : 'text-white'}>{value}</span>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </>
  );
}
function SliderLabel({ label, value }: { label: string; value: string }) {
  return (
    <label className="block text-[11px] text-[#94A3B8] mt-2">
      {label} — <span className="font-mono text-white">{value}</span>
    </label>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer">
      <span className="text-[11.5px] text-[#CBD5E1]">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition ${value ? 'bg-[#FDB813]/80' : 'bg-[#1E293B]'}`}
        type="button"
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${value ? 'left-4' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

function KaTeXLine({ math }: { math: string }) {
  // Lo dejamos como texto simple — el panel del módulo no necesita KaTeX runtime
  return (
    <div className="font-mono text-[11px] text-[#CBD5E1] py-0.5">{math}</div>
  );
}
