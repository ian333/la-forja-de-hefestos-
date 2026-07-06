/**
 * Fusión y Fisión Nuclear — curva de energía de enlace + defecto de masa.
 *
 * FÍSICA REAL implementada:
 *   - Fórmula de Bethe-Weizsäcker (liquid-drop model) para energía de enlace por nucleón:
 *     B(Z,A)/A = aV − aS·A^(-1/3) − aC·Z(Z-1)/A^(4/3) − aA·(A-2Z)²/A² − δ(Z,A)/A
 *     con constantes empíricas estándar (aV=15.75, aS=17.8, aC=0.711, aA=23.7, aP=11.18 MeV).
 *   - La curva sube rápido de H hacia Li/Be, llega al máximo en Fe-56 (8.79 MeV/nucleón),
 *     y decae suave hasta U-238 (~7.57 MeV/nucleón).
 *   - Defecto de masa: E = Δm·c² donde Δm = Z·mp + N·mn − M(Z,A).
 *     Para fusión D+T→He-4+n liberamos 17.6 MeV; para fisión U-235+n→Ba-141+Kr-92+3n liberamos ~200 MeV.
 *   - La energía LIBERADA es la diferencia en B/A: la reacción "cae" hacia Fe desde ambos lados.
 *
 * Visualización R3F / cine:
 *   - Curva 3D de B/A vs A (puntos emisivos + tubo) en el plano XZ.
 *   - Núcleos 3D representados como esferas emisivas con radio ∝ A^(1/3).
 *   - Animación de fusión: D + T se acercan → reacción → He-4 + n, con destello + onda de choque.
 *   - Animación de fisión: U-235 absorbe un neutrón → oscilación → ruptura → fragmentos + neutrones.
 *   - La cámara observa una de las dos reacciones según el modo activo.
 */

import { useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Constantes físicas ────────────────────────────────────────────────────────

// Parámetros de Bethe-Weizsäcker (MeV) — valores estándar de la literatura
const AV = 15.75;  // volumen
const AS = 17.8;   // superficie
const AC = 0.711;  // Coulomb
const AA = 23.7;   // asimetría
const AP = 11.18;  // pairing

// Masa del protón y neutrón (u)
const MP_MEV = 938.272;  // MeV/c²
const MN_MEV = 939.565;  // MeV/c²
const U_TO_MEV = 931.494; // 1 u = 931.494 MeV/c²

/** Energía de enlace total B(Z,A) en MeV via Bethe-Weizsäcker. */
function bindingEnergy(Z: number, A: number): number {
  if (A <= 0 || Z <= 0 || Z >= A) return 0;
  const N = A - Z;
  // Término de pairing δ
  const isEvenZ = Z % 2 === 0;
  const isEvenN = N % 2 === 0;
  let delta = 0;
  if (isEvenZ && isEvenN) delta = AP / Math.pow(A, 0.5);       // par-par
  else if (!isEvenZ && !isEvenN) delta = -AP / Math.pow(A, 0.5); // impar-impar
  // par-impar o impar-par: delta = 0

  const volTerm  = AV * A;
  const surTerm  = AS * Math.pow(A, 2 / 3);
  const coulTerm = AC * Z * (Z - 1) / Math.pow(A, 1 / 3);
  const asmTerm  = AA * (A - 2 * Z) ** 2 / A;

  return volTerm - surTerm - coulTerm - asmTerm + delta;
}

/** B/A en MeV/nucleón. */
function bindingPerNucleon(Z: number, A: number): number {
  if (A <= 0) return 0;
  return bindingEnergy(Z, A) / A;
}

/** Radio nuclear R = r0 · A^(1/3), r0 = 1.2 fm. Escalado para la escena. */
function nuclearRadius(A: number, scale = 0.18): number {
  return scale * Math.pow(Math.max(1, A), 1 / 3);
}

// ─── Datos de la curva B/A ─────────────────────────────────────────────────────

/** Genera puntos (A, Z_estable, B/A) para la curva de enlace. */
function buildBindingCurve(): Array<{ A: number; Z: number; BA: number }> {
  const pts: Array<{ A: number; Z: number; BA: number }> = [];
  // Para cada A usamos la línea de estabilidad aproximada: Z ≈ A/(1.98 + 0.0155·A^(2/3))
  for (let A = 2; A <= 240; A++) {
    const Z = Math.round(A / (1.98 + 0.0155 * Math.pow(A, 2 / 3)));
    const ba = bindingPerNucleon(Math.max(1, Math.min(Z, A - 1)), A);
    if (ba > 0) pts.push({ A, Z: Math.max(1, Math.min(Z, A - 1)), BA: ba });
  }
  return pts;
}

const CURVE_PTS = buildBindingCurve();

// ─── Tipos del Lesson ──────────────────────────────────────────────────────────

interface FusionState {
  mode: 'curve' | 'fusion' | 'fission';
}

// ─── Lesson ───────────────────────────────────────────────────────────────────

const LESSON: Lesson<FusionState> = {
  hook: {
    title: 'El hierro es el límite. Todo lo demás quiere ser él.',
    body: `En el núcleo de cada átomo hay una lucha. Los protones se repelen (Coulomb) y la fuerza nuclear fuerte los une. El balance de esas dos fuerzas crea una curva con UN solo ganador: el hierro-56, con 8.79 MeV por nucleón.

Los núcleos LIGEROS (hidrógeno, deuterio, tritio) tienen MENOS energía de enlace. Al fusionarse y acercarse al hierro, liberan energía. Eso es lo que alimenta el Sol.

Los núcleos PESADOS (uranio, plutonio) también tienen menos energía de enlace que el hierro. Al partirse, se acercan al hierro y también liberan energía. Eso es una bomba atómica o un reactor nuclear.

La curva de Bethe-Weizsäcker — calculada aquí con la fórmula real — lo muestra todo de un vistazo.`,
  },

  steps: [
    {
      title: 'La curva de energía de enlace — Bethe-Weizsäcker',
      duration: 7000,
      body: `La fórmula de Bethe-Weizsäcker calcula la energía que mantiene unido al núcleo:

B/A = aV − aS·A^(-1/3) − aC·Z(Z-1)/A^(4/3) − aA·(A-2Z)²/A² ± δ/A

Cinco términos físicos: el volumen (fuerte corto alcance), la superficie (nucleones sin vecinos), Coulomb (repulsión protón-protón), asimetría (preferencia por N≈Z) y pairing (pares núcleon-núcleon más estables).

Observa la curva: sube desde el hidrógeno, llega al máximo en Fe-56 (8.79 MeV/nucleón), y cae lentamente hacia el uranio. El hierro es el mínimo de energía potencial nuclear — el "fondo del pozo".`,
      formula: 'B/A|Fe-56 = 8.79 MeV\nB/A|U-238  = 7.57 MeV\nB/A|H-2    = 1.11 MeV',
      keyframes: [
        { at: 0, state: { mode: 'curve' } },
        { at: 1, state: { mode: 'curve' } },
      ],
    },
    {
      title: 'Fusión D+T → He-4 + n — el motor del Sol',
      duration: 7000,
      body: `Deuterio (Z=1, A=2) + Tritio (Z=1, A=3) → Helio-4 + neutrón.

Defecto de masa: Δm = m(D) + m(T) − m(He-4) − m(n).
Δm = 2.01410 + 3.01605 − 4.00260 − 1.00867 = 0.01888 u
E = Δm·c² = 0.01888 × 931.5 MeV ≈ 17.6 MeV por reacción.

Eso es 3.5 MeV por nucleón cedido al He-4 como energía cinética — el neutrón se lleva el resto. En el Sol la fusión pp produce ~26 MeV totales por He-4 (cadena completa).

En la escena: dos núcleos emisivos se acercan, chocan, destello → He-4 verde + neutrón blanco salen con alta energía cinética.`,
      formula: 'D + T → ⁴He + n + 17.6 MeV\nQ = (m_i − m_f)·c²',
      keyframes: [
        { at: 0, state: { mode: 'fusion' } },
        { at: 1, state: { mode: 'fusion' } },
      ],
    },
    {
      title: 'Fisión U-235 + n → Ba-141 + Kr-92 + 3n',
      duration: 7000,
      body: `Un neutrón lento impacta el U-235 (7.59 MeV/nucleón). El núcleo compuesto U-236 oscila como una gota líquida y se rompe:

U-235 + n → Ba-141 + Kr-92 + 3n

Defecto de masa total:
Δm ≈ 0.215 u → Q ≈ 200 MeV por fisión.

De esos 200 MeV: ~167 MeV van a energía cinética de los fragmentos, ~5 MeV a neutrones, el resto a rayos gamma + productos de decaimiento.

Los 3 neutrones emitidos pueden inducir nuevas fisiones — reacción en cadena. Un kilogramo de U-235 libera ~80 TJ. Equivalente a 17,000 toneladas de TNT.`,
      formula: 'U-235 + n → Ba-141 + Kr-92 + 3n\nQ ≈ 200 MeV = Δm·c²',
      keyframes: [
        { at: 0, state: { mode: 'fission' } },
        { at: 1, state: { mode: 'fission' } },
      ],
    },
    {
      title: 'Fusión vs Fisión — por qué el Sol funde pero los reactores fisionan',
      duration: 6000,
      body: `Fusión: une núcleos ligeros. Requiere superar la BARRERA de Coulomb (~10 keV), necesita temperaturas de 10⁸ K (efecto túnel cuántico lo reduce). En el Sol, la presión gravitacional crea esas condiciones. En la Tierra — ITER/tokamak — aún no se logra energía neta sostenida.

Fisión: divide núcleos pesados. Es más fácil de iniciar: un neutrón lento es captado, el U-235 entra en resonancia y se rompe. Sin barrera de Coulomb que superar.

La diferencia clave: en la curva de B/A, la "ganancia" por nucleón es MAYOR en fusión (~3.5 MeV/n en D+T) que en fisión (~0.85 MeV/n en U-235), pero la fisión es técnicamente más accesible con la tecnología actual.`,
      formula: 'Fusión: ΔB/A ≈ +3.5 MeV/n (H→He)\nFisión: ΔB/A ≈ +0.85 MeV/n (U→Ba,Kr)',
      keyframes: [
        { at: 0, state: { mode: 'curve' } },
        { at: 1, state: { mode: 'curve' } },
      ],
    },
  ],

  connect: {
    body: `La curva de Bethe-Weizsäcker es uno de los resultados más elegantes de la física nuclear. Con solo 5 parámetros ajustados a datos experimentales, predice la energía de enlace de todos los ~3000 núclidos conocidos con errores menores al 1%.

Las implicaciones son enormes:
• El hierro es el producto FINAL de la nucleosíntesis estelar — las estrellas masivas "mueren" cuando su núcleo es hierro puro, sin más combustible.
• Los elementos más pesados que el hierro (oro, plomo, uranio) solo se crean en explosiones de supernova y colisiones de estrellas de neutrones — donde se inyecta energía desde afuera.
• La energía nuclear (fusión + fisión) es hoy el 10% de la electricidad mundial. La fusión comercial podría ser revolucionaria: el combustible (deuterio del mar) es esencialmente infinito.

Siguiente: núcleos exóticos, halo nucleares (Li-11 con radio de Pb), línea de goteo de neutrones.`,
    links: [
      { label: 'Cadenas de decaimiento — vida media real', href: '#decay-chains' },
      { label: 'Estructura estelar — nucleosíntesis', href: '#stellar-structure' },
      { label: 'Mecánica cuántica — efecto túnel', href: '/math.html#quantum' },
    ],
  },
};

// ─── Helpers numéricos ────────────────────────────────────────────────────────

function fmt(x: number, d = 2): string {
  return isFinite(x) ? x.toFixed(d) : '—';
}

// ─── Top-level component ─────────────────────────────────────────────────────

export default function FusionFission() {
  const { audience } = useAudience();
  const [mode, setMode] = useState<'curve' | 'fusion' | 'fission'>('curve');
  const [showLabels, setShowLabels] = useState(true);

  // Datos de la curva ya calculados
  const curveData = useMemo(() => CURVE_PTS, []);

  // B/A de nuclidos clave para el HUD
  const baFe = bindingPerNucleon(26, 56);
  const baU  = bindingPerNucleon(92, 238);
  const baD  = bindingPerNucleon(1, 2);
  const baT  = bindingPerNucleon(1, 3);
  const baHe = bindingPerNucleon(2, 4);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={14} autoRotate={mode === 'curve'} bloomIntensity={0.9} bloomThreshold={0.1}>
          <SceneRouter mode={mode} curveData={curveData} showLabels={showLabels} />
        </Stage>

        {/* HUD datos físicos */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1">B/A (MeV/nucleón)</div>
          <div><span className="text-[#64748B]">Fe-56 </span><span className="text-[#FDB813]">{fmt(baFe, 3)}</span> ← máximo</div>
          <div><span className="text-[#64748B]">He-4  </span><span className="text-[#34D399]">{fmt(baHe, 3)}</span></div>
          <div><span className="text-[#64748B]">U-238 </span><span className="text-[#F87171]">{fmt(baU, 3)}</span></div>
          <div><span className="text-[#64748B]">D (H-2)</span><span className="text-[#60A5FA]">{fmt(baD, 3)}</span></div>
          <div><span className="text-[#64748B]">T (H-3)</span><span className="text-[#818CF8]">{fmt(baT, 3)}</span></div>
        </div>

        {/* Controles HUD */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <ModeBtn active={mode === 'curve'} onClick={() => setMode('curve')}>Curva B/A</ModeBtn>
          <ModeBtn active={mode === 'fusion'} onClick={() => setMode('fusion')}>Fusión D+T</ModeBtn>
          <ModeBtn active={mode === 'fission'} onClick={() => setMode('fission')}>Fisión U-235</ModeBtn>
          <div className="w-px h-6 bg-[#1E293B]" />
          <button
            onClick={() => setShowLabels(v => !v)}
            className={`text-[11px] px-2 py-1 rounded border transition ${
              showLabels ? 'border-[#4FC3F7]/40 text-[#4FC3F7]' : 'border-[#1E293B] text-[#475569]'
            }`}
          >
            etiquetas
          </button>
        </div>
      </div>

      <LessonPanel<FusionState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.mode !== undefined) setMode(patch.mode);
        }}
        sandbox={
          <>
            <Section title="Modo de visualización">
              <div className="grid grid-cols-1 gap-1.5">
                {(['curve', 'fusion', 'fission'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      mode === m
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>
                    {m === 'curve' ? 'Curva de Bethe-Weizsäcker' : m === 'fusion' ? 'Fusión D+T → He-4 + n' : 'Fisión U-235 + n → Ba+Kr'}
                  </button>
                ))}
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Energía liberada (Q-value)">
                <Row label="D+T→He-4+n" value="17.6 MeV" />
                <Row label="U-235 fisión" value="≈200 MeV" />
                <Row label="ΔB/A fusión" value="+3.5 MeV/n" />
                <Row label="ΔB/A fisión" value="+0.85 MeV/n" />
              </Section>
            )}

            <Section title="Fórmula de Bethe-Weizsäcker">
              <pre className="text-[10px] font-mono text-[#FDB813] bg-[#05060A] border border-[#1E293B] rounded px-2 py-2 whitespace-pre-wrap leading-relaxed">
{`B/A = aV − aS·A^(-1/3)
    − aC·Z(Z-1)/A^(4/3)
    − aA·(A-2Z)²/A²
    ± δ/A

aV=15.75  aS=17.8
aC=0.711  aA=23.7  aP=11.18`}
              </pre>
            </Section>

            {audience === 'researcher' && (
              <Section title="Verificación puntual">
                <Row label="Fe-56 calc." value={`${fmt(baFe, 4)} MeV/n`} />
                <Row label="Fe-56 exp." value="8.7906 MeV/n" />
                <Row label="U-238 calc." value={`${fmt(baU, 4)} MeV/n`} />
                <Row label="U-238 exp." value="7.5701 MeV/n" />
              </Section>
            )}
          </>
        }
      />
    </div>
  );
}

// ─── Router: escoge la sub-escena según mode ─────────────────────────────────

function SceneRouter({
  mode,
  curveData,
  showLabels,
}: {
  mode: 'curve' | 'fusion' | 'fission';
  curveData: Array<{ A: number; Z: number; BA: number }>;
  showLabels: boolean;
}) {
  if (mode === 'curve') return <CurveScene curveData={curveData} showLabels={showLabels} />;
  if (mode === 'fusion') return <FusionScene />;
  return <FissionScene />;
}

// ─── Escena 1: Curva de Bethe-Weizsäcker ────────────────────────────────────

function CurveScene({
  curveData,
  showLabels,
}: {
  curveData: Array<{ A: number; Z: number; BA: number }>;
  showLabels: boolean;
}) {
  const tex = useMemo(() => getParticleTexture(), []);

  // Geometría: puntos de la curva en el plano XZ
  // X = A escalado, Y = B/A escalado, Z = 0
  const SCALE_A  = 0.12;  // 240 nucleones → 28.8 unidades de escena
  const SCALE_BA = 1.5;   // 8.79 MeV → 13.2 unidades de escena

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(curveData.length * 3);
    const col = new Float32Array(curveData.length * 3);

    curveData.forEach((pt, i) => {
      const x = (pt.A - 120) * SCALE_A;   // centrado en A=120
      const y = pt.BA * SCALE_BA - 6;      // Y: B/A escalado, desplazado
      const z = 0;
      pos[i * 3 + 0] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // Color: gradiente por A — ligeros=azul, hierro=dorado, pesados=rojo
      const t = pt.A / 240;
      if (t < 0.2) {
        // Azul para ligeros
        col[i * 3 + 0] = 0.25 + t * 1.5;
        col[i * 3 + 1] = 0.55;
        col[i * 3 + 2] = 1.0;
      } else if (t < 0.45) {
        // Azul → dorado (zona Fe)
        const s = (t - 0.2) / 0.25;
        col[i * 3 + 0] = 0.55 + s * 0.44;
        col[i * 3 + 1] = 0.55 - s * 0.1;
        col[i * 3 + 2] = 1.0 - s * 0.94;
      } else {
        // Dorado → rojo-naranja para pesados
        const s = Math.min(1, (t - 0.45) / 0.55);
        col[i * 3 + 0] = 0.99;
        col[i * 3 + 1] = 0.44 - s * 0.27;
        col[i * 3 + 2] = 0.06 + s * 0.08;
      }
    });
    return [pos, col];
  }, [curveData]);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  // Línea de la curva (tubo fino) como objeto THREE.Line listo para <primitive>
  const lineObj = useMemo(() => {
    const pts: THREE.Vector3[] = curveData.map(pt => new THREE.Vector3(
      (pt.A - 120) * SCALE_A,
      pt.BA * SCALE_BA - 6,
      0,
    ));
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat  = new THREE.LineBasicMaterial({ color: '#334155', transparent: true, opacity: 0.4 });
    return new THREE.Line(geom, mat);
  }, [curveData]);

  // Núclidos clave para marcar: H-2, He-4, C-12, Fe-56, Mo-100, U-238
  const landmarks = useMemo<Array<{ label: string; A: number; Z: number; color: string }>>(() => [
    { label: 'H-2',   A: 2,   Z: 1,  color: '#60A5FA' },
    { label: 'He-4',  A: 4,   Z: 2,  color: '#34D399' },
    { label: 'C-12',  A: 12,  Z: 6,  color: '#818CF8' },
    { label: 'Fe-56', A: 56,  Z: 26, color: '#FDB813' },
    { label: 'Sr-88', A: 88,  Z: 38, color: '#F97316' },
    { label: 'U-238', A: 238, Z: 92, color: '#F87171' },
  ], []);

  // Rotación lenta del grupo en Y
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Puntos de la curva */}
      <points geometry={geom}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.28}
          sizeAttenuation
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Línea de contorno */}
      <primitive object={lineObj} />

      {/* Eje X (número másico) */}
      <mesh position={[0, -6.5, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 28, 8]} />
        <meshStandardMaterial color="#1E293B" emissive="#1E293B" emissiveIntensity={0.4} />
      </mesh>
      {/* Eje Y (B/A) */}
      <mesh position={[-14.5, -3.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 16, 8]} />
        <meshStandardMaterial color="#1E293B" emissive="#1E293B" emissiveIntensity={0.4} />
      </mesh>

      {/* Marcadores de nuclidos clave */}
      {landmarks.map(lm => {
        const x = (lm.A - 120) * SCALE_A;
        const ba = bindingPerNucleon(lm.Z, lm.A);
        const y = ba * SCALE_BA - 6;
        return (
          <group key={lm.label} position={[x, y, 0]}>
            <mesh>
              <sphereGeometry args={[0.22, 16, 16]} />
              <meshStandardMaterial
                color={lm.color}
                emissive={lm.color}
                emissiveIntensity={1.6}
                toneMapped={false}
              />
            </mesh>
            {showLabels && (
              <Html center distanceFactor={20} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: lm.color,
                  background: 'rgba(5,6,10,0.7)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  transform: 'translateY(-16px)',
                }}>
                  {lm.label} {ba.toFixed(2)}
                </div>
              </Html>
            )}
            {/* Línea vertical al eje */}
            <mesh position={[0, -(y + 6) / 2, 0]}>
              <cylinderGeometry args={[0.008, 0.008, y + 6, 6]} />
              <meshStandardMaterial color={lm.color} transparent opacity={0.25} />
            </mesh>
          </group>
        );
      })}

      {/* Etiqueta del máximo */}
      {showLabels && (
        <Html
          position={[(56 - 120) * SCALE_A, baFe * SCALE_BA - 6 + 1.5, 0]}
          center
          distanceFactor={20}
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#FDB813', fontWeight: 'bold' }}>
            Máximo: Fe-56
          </div>
        </Html>
      )}

      {/* Zona FUSIÓN (A &lt; 56) */}
      <mesh position={[-8, -4.5, -1]} rotation={[0, 0, 0]}>
        <planeGeometry args={[14, 0.8]} />
        <meshStandardMaterial color="#60A5FA" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      {showLabels && (
        <Html position={[-8, -3.8, 0]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#60A5FA', opacity: 0.7 }}>
            ← FUSIÓN libera energía
          </div>
        </Html>
      )}

      {/* Zona FISIÓN (A &gt; 56) */}
      <mesh position={[8, -4.5, -1]}>
        <planeGeometry args={[14, 0.8]} />
        <meshStandardMaterial color="#F87171" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      {showLabels && (
        <Html position={[8, -3.8, 0]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#F87171', opacity: 0.7 }}>
            FISIÓN libera energía →
          </div>
        </Html>
      )}
    </group>
  );
}

// Variable auxiliar para el cálculo de B/A del Fe-56 en el HUD (fuera del componente)
const baFe = bindingPerNucleon(26, 56);

// ─── Escena 2: Fusión D + T → He-4 + n ──────────────────────────────────────

// Estado de la animación de fusión
type FusionPhase = 'approach' | 'flash' | 'recoil';

function FusionScene() {
  const phase = useRef<FusionPhase>('approach');
  const phaseT = useRef(0);         // tiempo dentro de la fase actual (s)
  const flashScale = useRef(0);

  const dRef = useRef<THREE.Mesh>(null);    // Deuterio
  const tRef = useRef<THREE.Mesh>(null);    // Tritio
  const he4Ref = useRef<THREE.Mesh>(null);  // He-4 (aparece después de la fusión)
  const nRef = useRef<THREE.Mesh>(null);    // Neutrón
  const flashRef = useRef<THREE.Mesh>(null);
  const he4GroupRef = useRef<THREE.Group>(null);

  // Velocidades de salida (He-4 y n conservan momento — simplificado, masas en u)
  // m_He4=4, m_n=1, p_total ≈ 0; las partículas salen en direcciones opuestas
  const HE4_DIR = useMemo(() => new THREE.Vector3(-0.6, 0.8, 0).normalize(), []);
  const N_DIR   = useMemo(() => new THREE.Vector3(0.6, -0.8, 0).normalize(), []);

  useFrame((_, delta) => {
    phaseT.current += delta;

    if (phase.current === 'approach') {
      // D y T se acercan en 2 s desde ±4 hasta ±0.35
      const t = Math.min(1, phaseT.current / 2.0);
      const ease = 1 - (1 - t) ** 3;  // easeOutCubic
      const dist = 4.5 * (1 - ease) + 0.35 * ease;
      if (dRef.current) dRef.current.position.set(-dist, 0, 0);
      if (tRef.current) tRef.current.position.set(dist, 0, 0);

      // He-4 y n ocultos
      if (he4GroupRef.current) he4GroupRef.current.visible = false;
      if (flashRef.current)    flashRef.current.visible    = false;

      if (t >= 1) {
        phase.current = 'flash';
        phaseT.current = 0;
      }
    } else if (phase.current === 'flash') {
      // Destello + ocultar D y T, mostrar He-4 + n
      const t = phaseT.current;

      if (dRef.current)  dRef.current.visible  = false;
      if (tRef.current)  tRef.current.visible   = false;

      if (flashRef.current) {
        flashRef.current.visible = true;
        const s = Math.exp(-t * 4.0) * 3.5;
        flashRef.current.scale.setScalar(s);
        (flashRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = s * 1.2;
      }

      if (he4GroupRef.current) {
        he4GroupRef.current.visible = true;
        const speed = 2.5;
        const px = HE4_DIR.x * t * speed;
        const py = HE4_DIR.y * t * speed;
        he4GroupRef.current.position.set(px, py, 0);
      }
      if (nRef.current) {
        const speed = 4.5;  // neutrón más rápido (masa menor)
        nRef.current.position.set(N_DIR.x * t * speed, N_DIR.y * t * speed, 0);
      }

      if (t > 2.5) {
        phase.current = 'recoil';
        phaseT.current = 0;
      }
    } else {
      // recoil: reiniciar tras 1.5 s
      if (phaseT.current > 1.5) {
        phase.current = 'approach';
        phaseT.current = 0;
        if (dRef.current) { dRef.current.visible = true; dRef.current.position.set(-4.5, 0, 0); }
        if (tRef.current) { tRef.current.visible = true;  tRef.current.position.set(4.5, 0, 0); }
        if (he4GroupRef.current) he4GroupRef.current.visible = false;
        if (nRef.current) nRef.current.position.set(0, 0, 0);
        if (flashRef.current) flashRef.current.visible = false;
      }
    }
  });

  const rD  = nuclearRadius(2);
  const rT  = nuclearRadius(3);
  const rHe = nuclearRadius(4);
  const rN  = nuclearRadius(1, 0.14);

  return (
    <group>
      {/* Deuterio — azul claro */}
      <NucleusMesh ref={dRef} radius={rD} color="#60A5FA" emissiveIntensity={1.4} label="D (H-2)" />

      {/* Tritio — violeta */}
      <NucleusMesh ref={tRef} radius={rT} color="#818CF8" emissiveIntensity={1.4} label="T (H-3)" />

      {/* Flash de fusión */}
      <mesh ref={flashRef} visible={false}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FDB813" emissiveIntensity={3} toneMapped={false} transparent opacity={0.9} />
      </mesh>

      {/* He-4 — verde esmeralda */}
      <group ref={he4GroupRef} visible={false}>
        <NucleusMesh ref={he4Ref} radius={rHe} color="#34D399" emissiveIntensity={1.8} label="⁴He" />
      </group>

      {/* Neutrón — blanco frío */}
      <NucleusMesh ref={nRef} radius={rN} color="#CBD5E1" emissiveIntensity={1.0} label="n" />

      {/* Etiqueta Q = 17.6 MeV */}
      <Html position={[0, 3.5, 0]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#FDB813', textAlign: 'center', fontWeight: 'bold' }}>
          Q = 17.6 MeV
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#94A3B8', textAlign: 'center', marginTop: '2px' }}>
          D + T → ⁴He + n
        </div>
      </Html>
    </group>
  );
}

// ─── Escena 3: Fisión U-235 + n ──────────────────────────────────────────────

type FissionPhase = 'incoming' | 'oscillate' | 'split' | 'neutrons';

function FissionScene() {
  const phase = useRef<FissionPhase>('incoming');
  const phaseT = useRef(0);

  const uRef    = useRef<THREE.Mesh>(null);
  const nInRef  = useRef<THREE.Mesh>(null);   // neutrón entrante
  const flashRef = useRef<THREE.Mesh>(null);

  // Fragmentos
  const baRef  = useRef<THREE.Mesh>(null);    // Ba-141
  const krRef  = useRef<THREE.Mesh>(null);    // Kr-92
  const n1Ref  = useRef<THREE.Mesh>(null);
  const n2Ref  = useRef<THREE.Mesh>(null);
  const n3Ref  = useRef<THREE.Mesh>(null);
  const fragsRef = useRef<THREE.Group>(null);

  const rU  = nuclearRadius(236, 0.22);  // U-236 compuesto
  const rBa = nuclearRadius(141, 0.22);
  const rKr = nuclearRadius(92, 0.22);
  const rN  = nuclearRadius(1, 0.14);

  // Direcciones de los 3 neutrones secundarios
  const N_DIRS = useMemo(() => [
    new THREE.Vector3(0.7, 1.0, 0.3).normalize(),
    new THREE.Vector3(-0.5, 0.9, -0.6).normalize(),
    new THREE.Vector3(0.1, -1.0, 0.7).normalize(),
  ], []);

  useFrame((_, delta) => {
    phaseT.current += delta;

    if (phase.current === 'incoming') {
      // Neutrón entra desde la izquierda, llega al U-235 en 1.5 s
      const t = Math.min(1, phaseT.current / 1.5);
      const x = -8 + t * 8;
      if (nInRef.current) nInRef.current.position.set(x, 0, 0);
      if (uRef.current) uRef.current.visible = true;
      if (fragsRef.current) fragsRef.current.visible = false;
      if (flashRef.current) flashRef.current.visible = false;

      if (t >= 1) { phase.current = 'oscillate'; phaseT.current = 0; if (nInRef.current) nInRef.current.visible = false; }
    } else if (phase.current === 'oscillate') {
      // U-236 oscila como gota (deformación prolata) durante 1.2 s
      const t = phaseT.current;
      if (uRef.current) {
        const stretch = 1 + 0.35 * Math.sin(t * Math.PI * 3) * Math.exp(-t * 1.5);
        uRef.current.scale.set(stretch, 1 / Math.sqrt(stretch), stretch);
      }
      if (t > 1.2) { phase.current = 'split'; phaseT.current = 0; }
    } else if (phase.current === 'split') {
      // Flash + U desaparece, fragmentos aparecen
      const t = phaseT.current;
      if (t < 0.05 && uRef.current) uRef.current.visible = false;

      if (flashRef.current) {
        flashRef.current.visible = true;
        const s = Math.exp(-t * 5.0) * 4.0;
        flashRef.current.scale.setScalar(s);
        (flashRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = s;
      }

      if (fragsRef.current) {
        fragsRef.current.visible = true;
        const speed = 1.8;
        if (baRef.current) baRef.current.position.set(-t * speed, 0, 0);
        if (krRef.current) krRef.current.position.set(t * speed, 0, 0);
        N_DIRS.forEach((dir, i) => {
          const refs = [n1Ref, n2Ref, n3Ref];
          const r = refs[i].current;
          if (r) r.position.set(dir.x * t * 4.5, dir.y * t * 4.5, dir.z * t * 4.5);
        });
      }

      if (t > 3.0) { phase.current = 'neutrons'; phaseT.current = 0; }
    } else {
      // Reiniciar
      if (phaseT.current > 1.5) {
        phase.current = 'incoming';
        phaseT.current = 0;
        if (uRef.current) { uRef.current.visible = true; uRef.current.scale.setScalar(1); }
        if (nInRef.current) { nInRef.current.visible = true; nInRef.current.position.set(-8, 0, 0); }
        if (fragsRef.current) fragsRef.current.visible = false;
        if (flashRef.current) flashRef.current.visible = false;
      }
    }
  });

  return (
    <group>
      {/* U-235 */}
      <NucleusMesh ref={uRef} radius={rU} color="#F87171" emissiveIntensity={1.2} label="U-235" />

      {/* Neutrón entrante */}
      <NucleusMesh ref={nInRef} radius={rN} color="#CBD5E1" emissiveIntensity={1.0} label="n" />

      {/* Flash */}
      <mesh ref={flashRef} visible={false}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#F97316" emissiveIntensity={4} toneMapped={false} transparent opacity={0.85} />
      </mesh>

      {/* Fragmentos */}
      <group ref={fragsRef} visible={false}>
        <NucleusMesh ref={baRef} radius={rBa} color="#FDB813" emissiveIntensity={1.5} label="Ba-141" />
        <NucleusMesh ref={krRef} radius={rKr} color="#34D399" emissiveIntensity={1.5} label="Kr-92" />
        <NucleusMesh ref={n1Ref} radius={rN} color="#CBD5E1" emissiveIntensity={1.0} label="" />
        <NucleusMesh ref={n2Ref} radius={rN} color="#CBD5E1" emissiveIntensity={1.0} label="" />
        <NucleusMesh ref={n3Ref} radius={rN} color="#CBD5E1" emissiveIntensity={1.0} label="3n" />
      </group>

      {/* Etiqueta Q */}
      <Html position={[0, 5, 0]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#F97316', textAlign: 'center', fontWeight: 'bold' }}>
          Q ≈ 200 MeV
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#94A3B8', textAlign: 'center', marginTop: '2px' }}>
          U-235 + n → Ba-141 + Kr-92 + 3n
        </div>
      </Html>
    </group>
  );
}

// ─── Componente reutilizable: NucleusMesh ────────────────────────────────────

const NucleusMesh = forwardRef<
  THREE.Mesh,
  { radius: number; color: string; emissiveIntensity: number; label: string }
>(function NucleusMesh({ radius, color, emissiveIntensity, label }, ref) {
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[radius, 32, 24]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        metalness={0.15}
        roughness={0.35}
        toneMapped={false}
      />
    </mesh>
  );
});

// ─── UI helpers ───────────────────────────────────────────────────────────────

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

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-3 py-1.5 rounded-md border transition ${
        active
          ? 'border-[#FDB813]/60 text-[#FDB813] bg-[#FDB813]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
