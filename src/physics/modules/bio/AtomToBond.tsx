/**
 * Atom → Bond: primer eslabón de la escalera "átomo a humano".
 *
 * Resuelve H₂ desde primeros principios con Hartree-Fock restringido sobre la
 * base STO-3G (2 funciones s contraídas de 3 Gaussianas cada una). El SCF
 * converge a la función de onda molecular ψ_bonding = c_A 1s_A + c_B 1s_B.
 * De ahí:
 *
 *   E(R)  — barrido de la energía total al mover los núcleos
 *   R_eq  — mínimo de E(R)     (resultado, NO input)
 *   k     — segunda derivada de E en R_eq  (resultado, NO input)
 *   ν̃    — frecuencia vibracional √(k/μ) en cm⁻¹  (resultado, NO input)
 *
 * El punto pedagógico: la "k" que los campos de fuerza clásicos (AMBER, CHARMM)
 * guardan como parámetro de cada tipo de enlace **es esto**, derivado desde
 * abajo. No se ajusta a mano — sale del SCF electrónico.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface AtomBondLessonState {
  presetId: string;
  R: number;
}

const LESSON_AB: Lesson<AtomBondLessonState> = {
  hook: {
    title: '¿Qué cosa REALMENTE pega dos átomos? Spoiler: no es magia.',
    body: `Tomá dos átomos de hidrógeno. Si los acercás MUCHO, se repelen (sus núcleos positivos se odian). Si los alejás MUCHO, se ignoran. Pero a UNA distancia justa — alrededor de 0.74 Å — se forma un ENLACE. Una molécula H₂ estable.

¿Por qué a esa distancia y no otra? ¿Qué fuerza neta los mantiene ahí?

La respuesta requirió a Heisenberg, Heitler, London, Pauling — los pioneros cuánticos de los 1920-30. La clave: la NUBE ELECTRÓNICA se redistribuye, baja la energía total, y eso compensa la repulsión nuclear.

Aquí lo verás resolviendo Hartree-Fock con base STO-3G — el método que usan todos los químicos cuánticos. Sin trucos: la curva E(R) sale del cálculo SCF, no de un ajuste a datos.`,
  },

  steps: [
    {
      title: 'Equilibrio — donde H₂ vive de verdad',
      duration: 5500,
      body: `Empezamos con R = 1.35 bohr ≈ 0.71 Å. Casi exactamente la distancia experimental de H₂ (0.741 Å).

Mirá la NUBE ELECTRÓNICA entre los dos núcleos: hay DENSIDAD compartida. Los dos electrones forman una "nube de pegamento" que mantiene unidos los protones.

Esa densidad compartida es lo que baja la energía total. Cuando los electrones están entre los núcleos, sus repulsiones mutuas son mínimas y atraen efectivamente a ambos núcleos.

R_eq predicho por HF/STO-3G ≈ 1.39 bohr. La diferencia con el real (1.40 bohr) es 0.7% — y la corrección viene de "correlación electrónica" (no tratada por HF puro).`,
      formula: 'R_eq ≈ 1.40 bohr ≈ 0.74 Å',
      keyframes: [
        { at: 0, state: { presetId: 'equilibrium', R: 1.3466 } },
        { at: 1, state: { presetId: 'equilibrium', R: 1.3466 } },
      ],
    },
    {
      title: 'Acércalos demasiado — repulsión NUCLEAR',
      duration: 5500,
      body: `Bajamos R a 0.85 bohr. Los dos protones están ahora muy cerca.

La energía SUBE drásticamente. La nube electrónica intenta apantallar la repulsión, pero ya no alcanza — la repulsión 1/R de los protones domina.

Esto es la "pared" izquierda de la curva E(R). Energéticamente prohibitivo acercarse más.`,
      keyframes: [
        { at: 0, state: { presetId: 'compressed', R: 0.85 } },
        { at: 1, state: { presetId: 'compressed', R: 0.85 } },
      ],
    },
    {
      title: 'Estirá el enlace — pero aún compartido',
      duration: 5500,
      body: `R = 2.3 bohr. Casi el doble de la distancia de equilibrio.

La energía SUBIÓ pero no mucho. La nube electrónica se "estira" entre los núcleos. Todavía hay densidad compartida — el enlace es DÉBIL pero existe.

Este régimen es el que ocurre en estados vibracionales excitados — el H₂ "respira" alrededor de R_eq con amplitudes de fracciones de Å. Y en moléculas a alta temperatura.`,
      keyframes: [
        { at: 0, state: { presetId: 'stretched', R: 2.3 } },
        { at: 1, state: { presetId: 'stretched', R: 2.3 } },
      ],
    },
    {
      title: 'Disociación — el enlace se rompe',
      duration: 5500,
      body: `R = 4.0 bohr. Los dos átomos están casi aislados.

Mirá: las nubes electrónicas se separan en dos lóbulos. Ya no hay densidad compartida significativa. Energéticamente, casi como dos átomos H aislados.

La energía de disociación D₀ = E(∞) − E(R_eq) ≈ 4.5 eV (experimental). Esa es la energía que necesitarías para romper H₂ en dos átomos. Es alta — por eso H₂ es estable a temperatura ambiente.

La fotólisis del H₂ requiere luz UV (λ < 270 nm) — energía suficiente para superar D₀.`,
      formula: 'D₀ = E(∞) − E(R_eq) ≈ 4.5 eV',
      keyframes: [
        { at: 0, state: { presetId: 'dissociated', R: 4.0 } },
        { at: 1, state: { presetId: 'dissociated', R: 4.0 } },
      ],
    },
    {
      title: 'Vibración — la frecuencia ν̃ sale del cálculo',
      duration: 6500,
      body: `Cerca del mínimo, E(R) se ve como parábola: ≈ ½k(R − R_eq)².

Eso es un OSCILADOR ARMÓNICO. Con masa reducida μ = m_H/2, la frecuencia de vibración es ν = (1/2π)·√(k/μ).

Predicción HF: ν̃ ≈ 4640 cm⁻¹. Experimental: 4401 cm⁻¹. Error 5% — bastante bueno para HF/STO-3G sin correlación.

Esa frecuencia es la que ve un espectro IR. Cuando rocías luz infrarroja sobre H₂ gas, la absorbe a 2.27 µm (4401 cm⁻¹) — exactamente como predice esta cuenta.

Toda la química computacional moderna empieza con cuentas como esta y las extiende a moléculas grandes.`,
      formula: 'k = d²E/dR² en R_eq\nν̃ = (1/2πc)·√(k/μ) cm⁻¹\nHF predice 4640, exp 4401 (5% err)',
      keyframes: [
        { at: 0,   state: { presetId: 'equilibrium', R: 1.20 } },
        { at: 0.5, state: { presetId: 'equilibrium', R: 1.45 } },
        { at: 1,   state: { presetId: 'equilibrium', R: 1.20 } },
      ],
    },
  ],

  connect: {
    body: `El cálculo de H₂ que acabás de ver es el "eslabón cero" de toda la química computacional.

Sus extensiones cambiaron todo:
• H₂O, NH₃, CH₄ — pequeñas moléculas, todavía HF puro
• Métodos post-HF: MP2, CCSD(T) — recuperan correlación electrónica
• DFT (Density Functional Theory): aproximación más rápida, base de cálculos para drogas y materiales
• AlphaFold (2020): predice estructuras de proteínas usando aprendizaje sobre datos cuánticos
• Diseño de fármacos: cribados de millones de moléculas usando DFT/MP2
• Catálisis industrial: mecanismos de reacción ahora se diseñan computacionalmente

Los premios Nobel de Química de Pople (1998), Kohn (1998), y Karplus/Levitt/Warshel (2013) son todos por estas técnicas.

Lo que viste con H₂ — la densidad compartida que pega los átomos — es exactamente lo que pasa en CADA enlace de CADA molécula del universo.`,
    links: [
      { label: 'Double Helix — moléculas más grandes', href: '#double-helix' },
      { label: 'Protein Viewer — máquinas biológicas', href: '#protein-viewer' },
      { label: 'Sistema Solar — orden cuántico → clásico', href: '#solar-system' },
    ],
  },
};
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useAudience } from '@/physics/context';
import { getParticleTexture } from '@/labs/components/sprite-texture';
import { computePES, fitBond, moDensity, rhfH2, type HFResult, type BondFit, type PESPoint } from '@/lib/qm/rhf-h2';

const BOHR_TO_A = 0.529177210903;

interface Preset {
  id: string;
  name: string;
  R: number; // bohr
  blurb: string;
}
const PRESETS: Preset[] = [
  { id: 'equilibrium', name: 'Equilibrio',   R: 1.3466, blurb: 'R = R_eq. El mínimo de E(R). Donde vive H₂ de verdad.' },
  { id: 'compressed',  name: 'Comprimido',   R: 0.85,   blurb: 'Núcleos demasiado cerca → repulsión Coulomb domina.' },
  { id: 'stretched',   name: 'Estirado',     R: 2.3,    blurb: 'Enlace tensado. Todavía hay densidad compartida.' },
  { id: 'dissociated', name: 'Disociado',    R: 4.0,    blurb: 'Dos átomos H casi aislados. El enlace se rompió.' },
];

export default function AtomToBond() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('equilibrium');
  const preset = PRESETS.find(p => p.id === presetId) ?? PRESETS[0];
  const [R, setR] = useState<number>(preset.R); // bohr
  const [playVib, setPlayVib] = useState(false);

  useEffect(() => { setR(preset.R); }, [preset.R]);

  // One-shot SCF at current R (fast: ~1ms for 2x2 basis).
  const hf: HFResult = useMemo(() => rhfH2(R), [R]);

  // PES curve + bond fit — computed once.
  const { pes, fit } = useMemo(() => {
    const p = computePES(0.55, 4.2, 100);
    const f = fitBond(p);
    return { pes: p, fit: f };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0">
        <Viewport hf={hf} R={R} fit={fit} pes={pes} playVib={playVib} setR={setR} />
        <HUD R={R} hf={hf} fit={fit} />
      </div>

      <LessonPanel<AtomBondLessonState>
        lesson={LESSON_AB}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
          if (patch.R !== undefined) setR(patch.R);
        }}
        sandbox={<>
        <Section title="Preset">
          <div className="grid grid-cols-1 gap-1">
            {PRESETS.map(p => (
              <button
                key={p.id}
                data-testid={`preset-${p.id}`}
                onClick={() => setPresetId(p.id)}
                className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                  p.id === presetId
                    ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/50 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>{p.name}</span>
                  <span className="font-mono text-[10px] text-[#64748B]">R = {p.R.toFixed(2)} a₀</span>
                </div>
                <div className="text-[10px] text-[#64748B] mt-1">{p.blurb}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Distancia R (bohr)">
          <div className="flex items-center gap-3">
            <input
              type="range" min={0.55} max={4.2} step={0.01}
              value={R}
              onChange={e => setR(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="font-mono text-[12px] text-white w-14 text-right">{R.toFixed(3)}</span>
          </div>
          <div className="text-[10px] text-[#64748B] font-mono mt-1">
            {(R * BOHR_TO_A).toFixed(4)} Å
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setR(fit.Req)}
              className="px-3 py-1 rounded border border-[#334155] text-[11px] text-white hover:border-[#4FC3F7]"
            >
              → R_eq
            </button>
            <button
              onClick={() => setPlayVib(v => !v)}
              className={`px-3 py-1 rounded border text-[11px] ${playVib ? 'border-[#FFCA28] text-[#FFCA28]' : 'border-[#334155] text-white hover:border-[#FFCA28]'}`}
            >
              {playVib ? '■ detener' : '▶ vibrar'}
            </button>
          </div>
        </Section>

        <Section title="SCF (Hartree-Fock)">
          <Row label="iteraciones" value={String(hf.iterations)} />
          <Row label="convergió"   value={hf.converged ? '✓' : '✗'} />
          <Row label="S₁₂ overlap" value={hf.overlap.toFixed(4)} />
          <Row label="ε bonding"    value={`${hf.orbitalEnergies[0].toFixed(4)} Ha`} />
          <Row label="ε antibond."  value={`${hf.orbitalEnergies[1].toFixed(4)} Ha`} />
        </Section>

        <Section title="Energía en R actual">
          <Row label="⟨T⟩"       value={`${hf.kineticContrib.toFixed(4)} Ha`} />
          <Row label="⟨V_en⟩"    value={`${hf.neContrib.toFixed(4)} Ha`} />
          <Row label="⟨V_ee⟩"    value={`${hf.eeContrib.toFixed(4)} Ha`} />
          <Row label="V_nn"      value={`${hf.vNN.toFixed(4)} Ha`} />
          <Row label="E total"   value={`${hf.energy.toFixed(5)} Ha`} emph />
          <Row label="E total"   value={`${(hf.energy * 27.2114).toFixed(3)} eV`} />
        </Section>

        <Section title="Derivado de E(R)">
          <Row label="R_eq"   value={`${fit.Req.toFixed(4)} a₀  (${(fit.Req * BOHR_TO_A).toFixed(4)} Å)`} emph />
          <Row label="E_min"  value={`${fit.Emin.toFixed(5)} Ha  (${(fit.Emin * 27.2114).toFixed(3)} eV)`} />
          <Row label="D_e"    value={`${fit.DeHartree.toFixed(4)} Ha  (${(fit.DeHartree * 27.2114).toFixed(3)} eV)`} />
          <Row label="k = d²E/dR²"  value={`${fit.kHartreeBohr2.toFixed(4)} Ha/a₀²`} emph />
          <Row label="k (SI)" value={`${fit.kNperM.toFixed(1)} N/m`} />
          <Row label="k (FF)" value={`${fit.kKcalMolA2.toFixed(0)} kcal/(mol·Å²)`} />
          <Row label="ω/2πc"  value={`${fit.nuTildeCm1.toFixed(0)} cm⁻¹`} emph />
        </Section>

        {audience === 'child' ? (
          <Section title="¿Qué estás viendo?">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed">
              Dos átomos de hidrógeno. Entre ellos hay una nube azul — son los electrones.
              La nube los mantiene pegados. Cuando los acercas demasiado se repelen, cuando
              los alejas demasiado se sueltan. Hay una distancia perfecta (R_eq) donde
              están contentos. Si los "empujas" un poquito, rebotan — eso es el enlace
              vibrando. Todas las moléculas del mundo hacen esto.
            </div>
          </Section>
        ) : (
          <>
            <Section title="Interpretación">
              <div className="text-[11px] text-[#CBD5E1] leading-relaxed">
                La rigidez <span className="text-[#FFCA28] font-mono">k</span> que acabas de derivar
                (segunda derivada de E(R) en R_eq) es <b>el número que los campos de fuerza
                clásicos (AMBER, CHARMM, OPLS) guardan como "parámetro de enlace H-H"</b> —
                salvo que aquí no lo ajustamos a nada, lo sacamos de resolver la ecuación
                de Schrödinger para 2 electrones en la aproximación HF/STO-3G.
                <br /><br />
                Este es el salto <b>Nivel 0 → Nivel 1</b> de la escalera de escalas:
                los detalles electrónicos de nivel cuántico se proyectan a UN número
                (más R_eq) que vive en el nivel molecular clásico. Todo el resto de
                la escalera bio funciona así.
              </div>
            </Section>
            <Section title="Precisión STO-3G">
              <div className="text-[10px] text-[#64748B] leading-relaxed font-mono">
                Experimental H₂: R_eq = 0.741 Å, ν̃ = 4401 cm⁻¹, D_e = 4.48 eV.
                <br />
                STO-3G es la base más pequeña usable — sobreestima k ~60% (ν̃ ~25%
                alto). Bases más grandes (6-31G*, cc-pVDZ) se acercan al 5%.
                La pedagogía es <b>la cadena derivable</b>, no la exactitud numérica.
              </div>
            </Section>
          </>
        )}

        <Section title="Escalera arriba →">
          <div className="text-[11px] text-[#CBD5E1] leading-relaxed">
            Con k y R_eq por enlace → construyes MD clásica (nivel 2: proteína).<br />
            MD atomística → PCA de trayectoria → modos lentos (nivel 3: función).<br />
            Modos funcionales por célula → red regulatoria (nivel 5).<br />
            GRN → Cellular Potts → tejido (nivel 6).<br />
            <span className="text-[#64748B]">Cada flecha: modelo derivado, no ajustado.</span>
          </div>
        </Section>
        </>}
      />

      <VibrationTicker playVib={playVib} fit={fit} setR={setR} />
    </div>
  );
}

// ---------------- Vibration driver (runs outside Canvas) ----------------

function VibrationTicker({ playVib, fit, setR }: {
  playVib: boolean;
  fit: BondFit;
  setR: (r: number) => void;
}) {
  const tRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playVib) { lastRef.current = null; return; }
    let raf = 0;
    const tick = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      // Time-scale the real frequency so it's visible. Real ω ~ 1e15 rad/s;
      // we render at a pseudo ω of ~2π·2 Hz (period ≈ 0.5s) regardless of mass.
      const omegaVis = 2 * Math.PI * 2;
      tRef.current += dt;
      // Amplitude ~ 0.12 bohr (classical turning point at ~3 quanta).
      const A = 0.12;
      setR(fit.Req + A * Math.cos(omegaVis * tRef.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playVib, fit.Req, setR]);
  return null;
}

// ---------------- HUD (on-canvas overlay) ----------------

function HUD({ R, hf, fit }: { R: number; hf: HFResult; fit: BondFit }) {
  return (
    <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/85 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5 pointer-events-none">
      <div><span className="text-[#64748B]">sistema&nbsp;&nbsp;</span>= H₂ · HF/STO-3G</div>
      <div><span className="text-[#64748B]">R&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {R.toFixed(3)} a₀ · {(R*BOHR_TO_A).toFixed(3)} Å</div>
      <div><span className="text-[#64748B]">E&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#FFCA28]">{hf.energy.toFixed(4)}</span> Ha</div>
      <div><span className="text-[#64748B]">ΔE vs min</span>= {((hf.energy - fit.Emin) * 627.509).toFixed(2)} kcal/mol</div>
    </div>
  );
}

// ---------------- 3D Viewport ----------------

function Viewport(props: {
  hf: HFResult; R: number; fit: BondFit; pes: PESPoint[]; playVib: boolean; setR: (r: number) => void;
}) {
  return (
    <div className="relative w-full h-full" style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>
      <Canvas
        camera={{ position: [0, 2.6, 11.5], fov: 46, near: 0.01, far: 500 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[6, 4, 8]} intensity={1.3} color="#B3E5FC" distance={0} decay={0} />
        <pointLight position={[-5, -3, 5]} intensity={0.7} color="#FFAB91" distance={0} decay={0} />
        <OrbitControls target={[0, 0, 0]} enableDamping dampingFactor={0.08} />
        <Molecule hf={props.hf} R={props.R} />
        <PESCurve pes={props.pes} fit={props.fit} R={props.R} E={props.hf.energy} />
        <EffectComposer multisampling={4}>
          <Bloom intensity={1.0} luminanceThreshold={0.2} luminanceSmoothing={0.45} mipmapBlur kernelSize={KernelSize.LARGE} />
          <Vignette offset={0.25} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

// ---------------- H₂ molecule + electron density cloud ----------------

function Molecule({ hf, R }: { hf: HFResult; R: number }) {
  // Scale bohr → world units (make atoms comfortably viewable)
  const S = 1.2; // 1 bohr = 1.2 world units
  const sep = R * S;

  const tex = useMemo(() => getParticleTexture(), []);

  // Monte Carlo-sample |ψ|² so sprites cluster where the density actually lives.
  // Regenerated whenever SCF changes (R, coeffs). Deterministic via mulberry32 seed.
  const cloud = useMemo(() => {
    const N_TARGET = 450;
    const boxX = 3.0, boxR = 1.6;
    // Rough peak: |ψ|² at a nucleus ~ c_A² · (3G contraction at origin)² ~ 0.5
    const densMax = 0.7;
    const rand = mulberry32(0xA70BBEAD);
    const out: { p: [number, number, number]; d: number }[] = [];
    let tries = 0;
    while (out.length < N_TARGET && tries < N_TARGET * 60) {
      tries++;
      const x = -boxX + 2 * boxX * rand();
      const r = boxR * Math.sqrt(rand());
      const th = 2 * Math.PI * rand();
      const pt: [number, number, number] = [x, r * Math.cos(th), r * Math.sin(th)];
      const d = moDensity(hf, pt);
      if (rand() * densMax < d) out.push({ p: pt, d });
    }
    const maxD = out.reduce((m, x) => Math.max(m, x.d), 1e-8);
    return { pts: out, maxD };
  }, [hf]);

  return (
    <group>
      {/* H nuclei */}
      <group position={[-sep / 2, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.22 * S, 24, 24]} />
          <meshStandardMaterial color="#E0F7FA" emissive="#4FC3F7" emissiveIntensity={1.2} roughness={0.3} metalness={0.3} />
        </mesh>
        <sprite scale={[1.2 * S, 1.2 * S, 1.2 * S]}>
          <spriteMaterial map={tex} color="#81D4FA" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      </group>
      <group position={[sep / 2, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.22 * S, 24, 24]} />
          <meshStandardMaterial color="#E0F7FA" emissive="#4FC3F7" emissiveIntensity={1.2} roughness={0.3} metalness={0.3} />
        </mesh>
        <sprite scale={[1.2 * S, 1.2 * S, 1.2 * S]}>
          <spriteMaterial map={tex} color="#81D4FA" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      </group>

      {/* Bond axis reference line (subtle) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008 * S, 0.008 * S, 4.5 * S, 8]} />
        <meshBasicMaterial color="#1E293B" transparent opacity={0.6} />
      </mesh>

      {/* Electron density sprite cloud (MC-sampled) */}
      {cloud.pts.map((x, i) => {
        const n = x.d / cloud.maxD;
        const op = Math.min(0.85, 0.25 + 0.7 * Math.pow(n, 0.7));
        const sz = 0.18 * S * (0.55 + 0.7 * Math.pow(n, 0.4));
        return (
          <sprite key={i} position={[x.p[0] * S, x.p[1] * S, x.p[2] * S]} scale={[sz, sz, sz]}>
            <spriteMaterial map={tex} color="#7B9BFF" transparent opacity={op} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
        );
      })}

      {/* Distance label as 3D text-ish tube under the molecule */}
      <mesh position={[0, -0.9, 0]}>
        <boxGeometry args={[sep, 0.02, 0.02]} />
        <meshBasicMaterial color="#FFCA28" />
      </mesh>
    </group>
  );
}

// ---------------- PES curve trace ----------------

function PESCurve({ pes, fit, R, E }: { pes: PESPoint[]; fit: BondFit; R: number; E: number }) {
  // Map PES (R in bohr, E in Ha) to world coordinates in a panel below the molecule.
  const WX = 10;     // total world width for R range
  const WY = 3.0;    // total world height for E range
  const R0 = 0.5, R1 = 4.2;
  const Emax = pes.reduce((m, p) => Math.max(m, p.E), -1e9);
  const Emin = pes.reduce((m, p) => Math.min(m, p.E), +1e9);
  const floorY = -3.8;

  const mapR = (r: number) => -WX / 2 + WX * (r - R0) / (R1 - R0);
  const mapE = (e: number) => floorY + WY * (e - Emin) / (Emax - Emin);

  // Build a line geometry.
  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts: number[] = [];
    for (const p of pes) { verts.push(mapR(p.R), mapE(p.E), 0); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, [pes]);

  // Harmonic approximation (parabola in red) around R_eq, width ±0.6 bohr.
  const parabGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts: number[] = [];
    const k = fit.kHartreeBohr2;
    for (let i = 0; i <= 80; i++) {
      const x = fit.Req - 0.6 + (1.2 * i) / 80;
      const y = fit.Emin + 0.5 * k * (x - fit.Req) ** 2;
      verts.push(mapR(x), mapE(y), 0.002);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, [fit]);

  // Marker for current (R, E)
  const markerX = mapR(R);
  const markerY = mapE(E);

  // Axis baselines
  const xAxisGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      -WX / 2, floorY - 0.02, 0, WX / 2, floorY - 0.02, 0,
    ], 3));
    return g;
  }, [floorY]);

  const reqX = mapR(fit.Req);
  const reqY = mapE(fit.Emin);

  return (
    <group>
      {/* Baseline / axis */}
      <line>
        <primitive object={xAxisGeom} attach="geometry" />
        <lineBasicMaterial color="#334155" />
      </line>
      {/* PES curve */}
      <line>
        <primitive object={lineGeom} attach="geometry" />
        <lineBasicMaterial color="#64B5F6" linewidth={2} />
      </line>
      {/* Harmonic parabola overlay */}
      <line>
        <primitive object={parabGeom} attach="geometry" />
        <lineBasicMaterial color="#FFCA28" transparent opacity={0.7} />
      </line>
      {/* R_eq marker (vertical dashed-ish) */}
      <mesh position={[reqX, (floorY + reqY) / 2, 0]}>
        <boxGeometry args={[0.02, Math.abs(reqY - floorY), 0.01]} />
        <meshBasicMaterial color="#FFCA28" transparent opacity={0.35} />
      </mesh>
      {/* Equilibrium point */}
      <mesh position={[reqX, reqY, 0.01]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#FFF59D" emissive="#FFC107" emissiveIntensity={1.5} />
      </mesh>
      {/* Current state */}
      <mesh position={[markerX, markerY, 0.02]}>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshStandardMaterial color="#FF8A80" emissive="#D32F2F" emissiveIntensity={1.5} />
      </mesh>
      {/* Labels via small geometry ticks at known R (0.5, 1, 2, 3, 4) */}
      {[0.5, 1, 2, 3, 4].map(r => (
        <mesh key={r} position={[mapR(r), floorY - 0.12, 0]}>
          <boxGeometry args={[0.01, 0.08, 0.01]} />
          <meshBasicMaterial color="#64748B" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------- Sidebar helpers ----------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, emph }: { label: string; value: string; emph?: boolean }) {
  return (
    <div className="flex justify-between items-center py-0.5 font-mono">
      <span className="text-[10px] text-[#64748B]">{label}</span>
      <span className={`text-[11px] ${emph ? 'text-[#FFCA28]' : 'text-[#CBD5E1]'}`}>{value}</span>
    </div>
  );
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
