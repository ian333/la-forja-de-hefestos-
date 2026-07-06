/**
 * Fonones — vibraciones de red cristalina (cadena diatómica en 3D).
 *
 * FÍSICA REAL (cadena diatómica 1D, extendida a red 3D visual):
 *
 *   Dos masas m1, m2 por celda unidad, constante de fuerza κ.
 *   Dispersión exacta de la cadena diatómica:
 *
 *   ω²(k) = κ(1/m1 + 1/m2) ± κ√[(1/m1 + 1/m2)² − (4 sin²(ka/2))/(m1 m2)]
 *
 *   Rama óptica (signo +): vecinos oscilan en ANTIFASE (centro de masa fijo).
 *   Rama acústica (signo −): vecinos oscilan en FASE (onda de sonido).
 *
 *   En el límite k→0:
 *     ω_ac → v_s · k   (lineal, v_s = a√(κ/(2(m1+m2))))
 *     ω_opt → √(2κ(m1+m2)/(m1 m2))   (constante)
 *
 *   En el borde de zona (k = π/a):
 *     ω_ac = √(2κ/m2),  ω_opt = √(2κ/m1)   (gap entre ramas)
 *
 *   Desplazamiento en modo (k, rama):
 *     u_n(t) = A · exp(i(kna − ωt))  [masa liviana]
 *     v_n(t) = A · r · exp(i(kna − ωt))  [masa pesada]
 *   donde r = (2κ cos(ka/2)) / (m2 ω² − 2κ) — amplitud relativa real de la física.
 *
 * Visualización: red 3D con N×N×1 celdas. Cada átomo vibra en su modo
 * (k, rama) de acuerdo a la fase correcta. Bloom + colores emisivos.
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface PhononState {
  branchId: string;
  kFrac: number; // k como fracción de la zona de Brillouin [0,1]
}

// ─── Física real: dispersión cadena diatómica ─────────────────────────────────

interface DispParams {
  m1: number; // masa liviana (u.a.)
  m2: number; // masa pesada
  kappa: number; // constante de fuerza (N/m equivalente)
  a: number;  // parámetro de red (Å, solo para escala)
}

/**
 * ω²(k) para la cadena diatómica.
 * Devuelve { wAc, wOpt } en rad/s normalizados (sqrt(κ/m_ref)).
 */
function dispersion(k: number, p: DispParams): { wAc: number; wOpt: number } {
  const { m1, m2, kappa } = p;
  const sum = kappa * (1 / m1 + 1 / m2);
  // sin²(ka/2) con a=1 (normalizado; la escala de k va de 0 a π)
  const sin2 = Math.sin(k / 2) ** 2;
  const disc = sum * sum - (4 * sin2 * kappa * kappa) / (m1 * m2);
  const sqrtDisc = Math.sqrt(Math.max(disc, 0));
  return {
    wOpt: Math.sqrt(Math.max(sum + sqrtDisc, 0)),
    wAc: Math.sqrt(Math.max(sum - sqrtDisc, 0)),
  };
}

/**
 * Amplitud relativa del átomo pesado vs liviano para un modo (k, branch).
 * Derivada del sistema de ecuaciones de movimiento de la cadena diatómica:
 *   (m1 ω² − 2κ) A + 2κ cos(ka/2) B = 0
 *   => r = B/A = (m1 ω² − 2κ) / (2κ cos(ka/2))
 * Para la rama acústica, r ≈ +1 (en fase); óptica, r < 0 (antifase).
 */
function relAmplitude(k: number, omega: number, p: DispParams): number {
  const { m1, kappa } = p;
  const coshka = Math.cos(k / 2);
  const denom = 2 * kappa * coshka;
  if (Math.abs(denom) < 1e-10) return -1;
  return (m1 * omega * omega - 2 * kappa) / denom;
}

// ─── Lesson ───────────────────────────────────────────────────────────────────

const LESSON: Lesson<PhononState> = {
  hook: {
    title: 'El cristal CANTA — y cada nota tiene una frecuencia exacta.',
    body: `Un cristal de NaCl tiene ~10²³ átomos, todos vibrando a la vez. ¿Caos?

No. La simetría de la red CUANTIZA las vibraciones en modos exactos, llamados fonones. Cada modo tiene una frecuencia ω que depende del vector de onda k según una relación de dispersión exacta.

Para una cadena con DOS átomos por celda (como NaCl, GaAs, diamante), hay DOS ramas:
• Acústica: los vecinos oscilan EN FASE → onda de sonido.
• Óptica: los vecinos oscilan en ANTIFASE → puede absorber luz infrarroja.

Esta diferencia explica por qué los cristales tienen bandas de absorción infrarroja características — la "huella digital" del material.`,
  },

  steps: [
    {
      title: 'Rama acústica — onda de sonido en el cristal',
      duration: 6000,
      body: `En la rama ACÚSTICA, los dos átomos de la celda se mueven en la MISMA dirección. Es exactamente una onda de sonido — perturbación mecánica que se propaga.

Para k→0 (longitud de onda larga), ω ≈ v_s · k lineal. v_s es la velocidad del sonido en el cristal.

En el borde de zona (k = π/a), la onda acústica se "detiene": los átomos más ligeros forman un nodo.

Observa los átomos: todos se mueven en fase. El patrón de colores marca la fase de la onda.`,
      formula: 'ω²_ac = κ(1/m₁+1/m₂) − κ√[(1/m₁+1/m₂)²−4sin²(ka/2)/(m₁m₂)]\nk→0: ω ≈ a√(κ/2(m₁+m₂)) · k',
      keyframes: [
        { at: 0, state: { branchId: 'acoustic', kFrac: 0.3 } },
        { at: 1, state: { branchId: 'acoustic', kFrac: 0.3 } },
      ],
    },
    {
      title: 'Rama óptica — antifase y absorción infrarroja',
      duration: 6000,
      body: `La rama ÓPTICA es radicalmente distinta: los dos átomos de la celda oscilan en ANTIFASE. El centro de masa de la celda no se mueve.

Para k→0, la frecuencia óptica es CONSTANTE: ω_opt = √(2κ(m₁+m₂)/(m₁m₂)).

Este modo puede ACOPLARSE con la luz infrarroja. En NaCl, los iones Na⁺ y Cl⁻ tienen cargas opuestas — cuando oscilan en antifase crean un dipolo eléctrico oscilante que absorbe la radiación IR.

Observa: los átomos rosa y cyan oscilan exactamente opuestos.`,
      formula: 'ω²_opt = κ(1/m₁+1/m₂) + κ√[(1/m₁+1/m₂)²−4sin²(ka/2)/(m₁m₂)]\nk→0: ω_opt = √(2κ(m₁+m₂)/(m₁m₂))',
      keyframes: [
        { at: 0, state: { branchId: 'optical', kFrac: 0.1 } },
        { at: 1, state: { branchId: 'optical', kFrac: 0.1 } },
      ],
    },
    {
      title: 'Borde de zona — gap de fonones',
      duration: 5500,
      body: `En el borde de la zona de Brillouin (k = π/a), ocurre algo notable: las dos ramas NO se tocan — hay un GAP de frecuencias.

ω_ac(π/a) = √(2κ/m₁) [la masa pesada en reposo]
ω_opt(π/a) = √(2κ/m₂) [la masa liviana en reposo]

Entre estas dos frecuencias, NO existe ningún modo de vibración normal. La red es TRANSPARENTE a esas frecuencias — no puede propagarlas.

Este gap es la base de los filtros acústicos en materiales compuestos.`,
      formula: 'GAP: √(2κ/m₁) < ω < √(2κ/m₂)\n(m₁<m₂ → gap entre ramas en k=π/a)',
      keyframes: [
        { at: 0, state: { branchId: 'acoustic', kFrac: 0.98 } },
        { at: 0.5, state: { branchId: 'optical', kFrac: 0.98 } },
        { at: 1, state: { branchId: 'optical', kFrac: 0.98 } },
      ],
    },
    {
      title: 'Masa diferente — gap se abre o se cierra',
      duration: 5500,
      body: `El tamaño del gap depende de la RAZÓN de masas m₁/m₂. Cuando m₁ = m₂ (cadena monoatómica), el gap se CIERRA y queda solo una rama doblada.

Cuando la diferencia de masas crece, el gap se amplía. GaAs (masa Ga=70, As=75, ratio≈1.07) tiene gap pequeño. Diamante (1 especie) no tiene gap óptico-acústico de este tipo.

Ahora en el panel ajusta la masa m₂ y observa cómo las dos ramas cambian.`,
      formula: 'Δω² = 2κ(m₁−m₂)²/(m₁m₂(m₁+m₂))\n→ 0 cuando m₁=m₂',
      keyframes: [
        { at: 0, state: { branchId: 'acoustic', kFrac: 0.5 } },
        { at: 1, state: { branchId: 'optical', kFrac: 0.5 } },
      ],
    },
  ],

  connect: {
    body: `Los fonones son cuantos de vibración — el equivalente del fotón para las ondas mecánicas en un cristal. Su cuantización (Planck, Debye, Einstein) explica:

• Capacidad calorífica de los sólidos a baja T (T³ de Debye vs constante clásica).
• Superconductividad: los electrones se acoplan VÍA fonones (teoría BCS, Nobel 1972).
• Conductividad térmica: los fonones transportan calor; su dispersión limita conductores.
• Espectroscopía Raman: luz dispersada por fonones ópticos → huella digital del material.
• Piezoelectricidad: fonones ópticos + asimetría cristalina = voltaje macroscópico.

La relación de dispersión ω(k) que acabas de ver es medible con neutrones de baja energía (espectroscopía de neutrones inelásticos) con precisión de meV.`,
    links: [
      { label: 'Banda de conducción — electrones en red', href: '#band-structure' },
      { label: 'Schrödinger 1D — pozos cuánticos', href: '#schrodinger-1d' },
      { label: 'Oscilador armónico cuántico', href: '#quantum-harmonic' },
    ],
  },
};

// ─── Parámetros por defecto ───────────────────────────────────────────────────

const DEFAULT_PARAMS: DispParams = { m1: 1.0, m2: 2.5, kappa: 4.0, a: 1.0 };
const N = 12; // átomos por fila/columna en la red 3D

// ─── Componente principal ────────────────────────────────────────────────────

export default function Phonons() {
  const { audience } = useAudience();

  const [branch, setBranch] = useState<'acoustic' | 'optical'>('acoustic');
  const [kFrac, setKFrac] = useState(0.3); // [0,1] → k en [0, π]
  const [params, setParams] = useState<DispParams>(DEFAULT_PARAMS);
  const [running, setRunning] = useState(true);

  // k real en [0, π] (zona de Brillouin con a=1)
  const k = kFrac * Math.PI;
  const { wAc, wOpt } = dispersion(k, params);
  const omega = branch === 'acoustic' ? wAc : wOpt;
  const rAmp = relAmplitude(k, omega, params);

  // Velocidad de grupo: dω/dk numérica
  const dk = 0.001;
  const wAcP = dispersion(k + dk, params).wAc;
  const wOptP = dispersion(k + dk, params).wOpt;
  const vgAc = wAc > 1e-6 ? (wAcP - wAc) / dk : 0;
  const vgOpt = wOpt > 1e-6 ? (wOptP - wOpt) / dk : 0;
  const vg = branch === 'acoustic' ? vgAc : vgOpt;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={N * 0.85} autoRotate bloomIntensity={0.9} bloomThreshold={0.1}>
          <PhononLattice
            N={N}
            branch={branch}
            kFrac={kFrac}
            params={params}
            running={running}
          />
        </Stage>

        {/* HUD — métricas físicas */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">rama&nbsp;&nbsp;</span>{branch === 'acoustic' ? 'ACÚSTICA' : 'ÓPTICA'}</div>
          <div><span className="text-[#64748B]">k/kmax&nbsp;</span>{kFrac.toFixed(3)}</div>
          <div><span className="text-[#64748B]">ω_ac&nbsp;&nbsp;</span>{wAc.toFixed(4)} ω₀</div>
          <div><span className="text-[#64748B]">ω_opt&nbsp;&nbsp;</span>{wOpt.toFixed(4)} ω₀</div>
          <div><span className="text-[#64748B]">v_grupo</span>{vg.toFixed(4)} a·ω₀</div>
          <div><span className="text-[#64748B]">r (B/A)</span>{isFinite(rAmp) ? rAmp.toFixed(3) : '—'}</div>
        </div>

        {/* Controles de reproducción */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <PhononBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</PhononBtn>
          <PhononBtn onClick={() => setBranch(b => b === 'acoustic' ? 'optical' : 'acoustic')} title="Cambiar rama">
            {branch === 'acoustic' ? 'AC' : 'OPT'}
          </PhononBtn>
        </div>

        {/* Selector de rama flotante */}
        <div className="absolute top-4 right-4 flex flex-col gap-1">
          {(['acoustic', 'optical'] as const).map(br => (
            <button key={br} onClick={() => setBranch(br)}
              className={`px-3 py-1.5 rounded-md border text-[11px] font-mono transition ${
                branch === br
                  ? 'bg-gradient-to-br from-[#1E40AF]/40 to-[#7E22CE]/40 border-[#4FC3F7]/50 text-white'
                  : 'border-[#1E293B] text-[#64748B] hover:text-white hover:border-[#334155]'
              }`}>
              {br === 'acoustic' ? 'Acústica' : 'Óptica'}
            </button>
          ))}
        </div>
      </div>

      <LessonPanel<PhononState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.branchId !== undefined) setBranch(patch.branchId as 'acoustic' | 'optical');
          if (patch.kFrac !== undefined) setKFrac(patch.kFrac);
        }}
        sandbox={
          <>
            <Section title="Vector de onda k">
              <label className="block text-[11px] text-[#94A3B8] mb-1">
                k = {kFrac.toFixed(3)} × π/a
              </label>
              <input type="range" min={0.01} max={1} step={0.01}
                value={kFrac}
                onChange={e => setKFrac(Number(e.target.value))}
                className="w-full" />
              <div className="mt-1 text-[10px] text-[#64748B]">
                0 = centro de zona · 1 = borde (π/a)
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Parámetros de red">
                <PhSlider label="m₁ (liviana)" v={params.m1} min={0.2} max={5} step={0.05}
                  on={v => setParams(p => ({ ...p, m1: v }))} />
                <PhSlider label="m₂ (pesada)"  v={params.m2} min={0.2} max={8} step={0.05}
                  on={v => setParams(p => ({ ...p, m2: v }))} />
                <PhSlider label="κ (rigidez)"  v={params.kappa} min={0.5} max={12} step={0.1}
                  on={v => setParams(p => ({ ...p, kappa: v }))} />
                <div className="mt-2 text-[10px] text-[#64748B]">
                  ratio m₂/m₁ = {(params.m2 / params.m1).toFixed(2)} — gap ∝ (m₂−m₁)
                </div>
              </Section>
            )}

            <Section title="Dispersión — rama actual">
              <DispersionMini params={params} branch={branch} kFrac={kFrac} />
            </Section>

            {audience === 'child' && (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>Cada átomo <span className="text-[#4FC3F7]">cyan</span> y <span className="text-[#F472B6]">rosa</span> vibra según una onda exacta.</p>
                  <p>Rama <b>acústica</b>: se mueven <em>juntos</em> — onda de sonido.</p>
                  <p>Rama <b>óptica</b>: se mueven <em>opuestos</em> — absorbe luz IR.</p>
                </div>
              </Section>
            )}

            <Section title="Fórmula">
              <div className="text-[10px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-[#4FC3F7]">ω²= κ(1/m₁+1/m₂) ± R</div>
                <div className="text-[#94A3B8]">R = κ√[(1/m₁+1/m₂)²−4sin²(ka/2)/(m₁m₂)]</div>
                <div className="mt-1 text-[#64748B]">+→ óptica · −→ acústica</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D — sub-componente DENTRO del Canvas ─────────────────────────────

interface LatticeProps {
  N: number;
  branch: 'acoustic' | 'optical';
  kFrac: number;
  params: DispParams;
  running: boolean;
}

/** Sub-componente que vive DENTRO del Canvas; puede usar useFrame sin crash. */
function PhononLattice({ N, branch, kFrac, params, running }: LatticeProps) {
  const tex = useMemo(() => getParticleTexture(), []);
  const tRef = useRef(0);

  // Geometría compartida para los dos tipos de átomo
  const NMAX = N * N;

  // BufferGeometry para átomos tipo-1 (livianos, cyan) y tipo-2 (pesados, rosa)
  const geo1 = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(NMAX * 3);
    const col = new Float32Array(NMAX * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    return g;
  }, [NMAX]);

  const geo2 = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(NMAX * 3);
    const col = new Float32Array(NMAX * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    return g;
  }, [NMAX]);

  // Geometría de la red de conexiones (LineSegments)
  const bondGeo = useMemo(() => {
    // Cada celda tiene 2 átomos. Bonds: tipo1_n — tipo2_n (intra-celda) + tipo2_n — tipo1_{n+1} (inter-celda)
    // En 1D con N celdas y dirección x: 2*(N-1) + N = 3N-2 segments por fila, con N filas... simplificamos: solo intra-celda
    const nSegs = N * N; // un bond intra-celda por celda (tipo1 a tipo2)
    const pos = new Float32Array(nSegs * 2 * 3); // 2 puntos por segmento
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [N]);

  useFrame((_, delta) => {
    if (running) tRef.current += delta;
    const t = tRef.current;

    const k = kFrac * Math.PI; // k en [0, π] con a=1
    const { wAc, wOpt } = dispersion(k, params);
    const omega = branch === 'acoustic' ? wAc : wOpt;
    const r = relAmplitude(k, omega, params); // amplitud relativa masa-2/masa-1

    const spacing = 1.0; // distancia entre celdas
    const halfSize = ((N - 1) * spacing) / 2;
    const amp = 0.22; // amplitud de oscilación visual (fracción del spacing)

    const pos1 = geo1.attributes.position as THREE.BufferAttribute;
    const col1 = geo1.attributes.color as THREE.BufferAttribute;
    const pos2 = geo2.attributes.position as THREE.BufferAttribute;
    const col2 = geo2.attributes.color as THREE.BufferAttribute;
    const bondPos = bondGeo.attributes.position as THREE.BufferAttribute;

    const arr1p = pos1.array as Float32Array;
    const arr1c = col1.array as Float32Array;
    const arr2p = pos2.array as Float32Array;
    const arr2c = col2.array as Float32Array;
    const arrBp = bondPos.array as Float32Array;

    let idx = 0;
    let bidx = 0;

    for (let ix = 0; ix < N; ix++) {
      for (let iz = 0; iz < N; iz++) {
        // Posición de equilibrio de la celda
        const x0 = ix * spacing - halfSize;
        const z0 = iz * spacing - halfSize;

        // Fase de la onda: k · (posición x de la celda)
        const phase = k * ix - omega * t;

        // Desplazamiento átomo-1 (liviano): A · cos(fase)
        const dy1 = amp * Math.cos(phase);
        // Desplazamiento átomo-2 (pesado): r · A · cos(fase)
        const dy2 = amp * (isFinite(r) ? r : -1) * Math.cos(phase);

        // Posición átomo-1 (liviano, cyan): offset -0.25 en x dentro de la celda
        const x1 = x0 - 0.25;
        const y1 = dy1;
        const z1 = z0;

        // Posición átomo-2 (pesado, rosa): offset +0.25 en x
        const x2 = x0 + 0.25;
        const y2 = dy2;
        const z2 = z0;

        arr1p[idx * 3 + 0] = x1;
        arr1p[idx * 3 + 1] = y1;
        arr1p[idx * 3 + 2] = z1;

        arr2p[idx * 3 + 0] = x2;
        arr2p[idx * 3 + 1] = y2;
        arr2p[idx * 3 + 2] = z2;

        // Color basado en la fase — fase positiva = más brillante
        const phaseNorm = (Math.cos(phase) + 1) / 2; // [0,1]
        // Cyan con brillo modulado por fase
        arr1c[idx * 3 + 0] = 0.1 + 0.2 * phaseNorm;
        arr1c[idx * 3 + 1] = 0.5 + 0.5 * phaseNorm;
        arr1c[idx * 3 + 2] = 0.9 + 0.1 * phaseNorm;

        // Rosa modulado por la fase del átomo pesado
        const phaseNorm2 = (Math.cos(phase) * (isFinite(r) ? Math.sign(r) : -1) + 1) / 2;
        arr2c[idx * 3 + 0] = 0.9 + 0.1 * phaseNorm2;
        arr2c[idx * 3 + 1] = 0.2 + 0.3 * phaseNorm2;
        arr2c[idx * 3 + 2] = 0.5 + 0.4 * phaseNorm2;

        // Bond intra-celda (tipo1 → tipo2)
        arrBp[bidx * 6 + 0] = x1; arrBp[bidx * 6 + 1] = y1; arrBp[bidx * 6 + 2] = z1;
        arrBp[bidx * 6 + 3] = x2; arrBp[bidx * 6 + 4] = y2; arrBp[bidx * 6 + 5] = z2;

        idx++;
        bidx++;
      }
    }

    pos1.needsUpdate = true; col1.needsUpdate = true;
    pos2.needsUpdate = true; col2.needsUpdate = true;
    bondPos.needsUpdate = true;
    geo1.setDrawRange(0, NMAX);
    geo2.setDrawRange(0, NMAX);
    bondGeo.setDrawRange(0, N * N); // setDrawRange para LineSegments usa # de vértices
  });

  return (
    <>
      {/* Átomos livianos — cyan */}
      <points geometry={geo1}>
        <pointsMaterial
          vertexColors map={tex} alphaMap={tex}
          size={0.28} sizeAttenuation transparent opacity={0.95}
          blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}
        />
      </points>

      {/* Átomos pesados — rosa */}
      <points geometry={geo2}>
        <pointsMaterial
          vertexColors map={tex} alphaMap={tex}
          size={0.38} sizeAttenuation transparent opacity={0.90}
          blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}
        />
      </points>

      {/* Bonds intra-celda */}
      <lineSegments geometry={bondGeo}>
        <lineBasicMaterial color="#334155" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {/* Etiqueta de rama — Html de drei (no drei Text, para no romper EffectComposer) */}
      <Html position={[0, (N / 2) * 0.85 + 0.6, 0]} center>
        <div style={{
          fontFamily: 'monospace', fontSize: '11px', color: '#4FC3F7',
          background: 'rgba(5,6,10,0.7)', padding: '2px 8px',
          borderRadius: '4px', border: '1px solid rgba(79,195,247,0.3)',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          Fonón k={kFrac.toFixed(2)}π/a
        </div>
      </Html>

      {/* Luz de acento para bloom */}
      <pointLight position={[0, 2, 0]} intensity={0.6} distance={N * 1.5} color="#4FC3F7" />
      <pointLight position={[0, -2, 0]} intensity={0.4} distance={N * 1.5} color="#F472B6" />
    </>
  );
}

// ─── Mini gráfica de dispersión (canvas 2D externo al Canvas R3F) ─────────────

function DispersionMini({ params, branch, kFrac }: {
  params: DispParams;
  branch: 'acoustic' | 'optical';
  kFrac: number;
}) {
  const W = 240, H = 90;
  const NP = 60;

  // Calculamos puntos
  const acPts: [number, number][] = [];
  const optPts: [number, number][] = [];
  let maxW = 0;
  for (let i = 0; i <= NP; i++) {
    const kn = (i / NP) * Math.PI;
    const { wAc, wOpt } = dispersion(kn, params);
    acPts.push([i / NP, wAc]);
    optPts.push([i / NP, wOpt]);
    if (wOpt > maxW) maxW = wOpt;
  }

  const toX = (kn: number) => 8 + kn * (W - 16);
  const toY = (w: number) => H - 8 - (w / (maxW * 1.05)) * (H - 16);

  const pathOf = (pts: [number, number][]) =>
    pts.map(([kn, w], i) => `${i === 0 ? 'M' : 'L'}${toX(kn).toFixed(1)},${toY(w).toFixed(1)}`).join(' ');

  const curK = kFrac;
  const { wAc, wOpt } = dispersion(curK * Math.PI, params);
  const curW = branch === 'acoustic' ? wAc : wOpt;
  const dotX = toX(curK);
  const dotY = toY(curW);

  return (
    <svg width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
      <rect width={W} height={H} rx={4} fill="#0B0F17" />
      {/* Ejes */}
      <line x1={8} y1={H - 8} x2={W - 8} y2={H - 8} stroke="#1E293B" strokeWidth={1} />
      <line x1={8} y1={8} x2={8} y2={H - 8} stroke="#1E293B" strokeWidth={1} />
      {/* Ramas */}
      <path d={pathOf(acPts)} fill="none" stroke="#22D3EE" strokeWidth={1.5} opacity={branch === 'acoustic' ? 1 : 0.4} />
      <path d={pathOf(optPts)} fill="none" stroke="#F472B6" strokeWidth={1.5} opacity={branch === 'optical' ? 1 : 0.4} />
      {/* Punto actual */}
      <circle cx={dotX} cy={dotY} r={4} fill={branch === 'acoustic' ? '#22D3EE' : '#F472B6'} />
      {/* Labels */}
      <text x={12} y={18} fill="#64748B" fontSize={8} fontFamily="monospace">ω</text>
      <text x={W - 20} y={H - 2} fill="#64748B" fontSize={8} fontFamily="monospace">k</text>
      <text x={10} y={H - 2} fill="#64748B" fontSize={7} fontFamily="monospace">0</text>
      <text x={W - 18} y={H - 2} fill="#64748B" fontSize={7} fontFamily="monospace">π/a</text>
    </svg>
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

function PhSlider({ label, v, min, max, step, on }: {
  label: string; v: number; min: number; max: number; step: number;
  on: (v: number) => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function PhononBtn({ children, onClick, active, title }: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`min-w-[36px] h-9 px-2 rounded-md border text-[12px] font-mono transition flex items-center justify-center ${
        active
          ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>
      {children}
    </button>
  );
}
