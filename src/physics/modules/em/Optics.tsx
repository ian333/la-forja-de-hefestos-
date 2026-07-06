/**
 * Optics — Óptica ondulatoria y geométrica en 3D.
 *
 * Física implementada:
 *   • Ley de Snell:     n₁ sin θ₁ = n₂ sin θ₂
 *   • Lente delgada:    1/f = 1/dₒ + 1/dᵢ  (lente convergente/divergente)
 *   • Doble rendija:    I(y) ∝ cos²(π d y / λ L)  (interferencia de Young)
 *
 * Visualización:
 *   - Tres modos: REFRACCIÓN, LENTE, DOBLE RENDIJA
 *   - Rayos trazados como líneas THREE.Line con materiales emisivos
 *   - Patrón de interferencia como point cloud en la pantalla
 *   - Fondo negro real, materiales emissive que REVIENTAN con el bloom del Stage
 *
 * Ian — La Forja, 2026-06-01
 */

import { useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ─── Tipos de estado de la lección ──────────────────────────────────────────

interface OpticsLessonState {
  mode: 'refraction' | 'lens' | 'double-slit';
}

// ─── Constantes físicas ──────────────────────────────────────────────────────

const λ_NM: Record<string, number> = {
  violeta: 420,
  azul:    470,
  verde:   530,
  amarillo:580,
  rojo:    650,
};

/** Longitud de onda en metros a color RGB [0-1] — aproximación de la función CIE */
function wavelengthToRGB(λ_nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if      (λ_nm >= 380 && λ_nm < 440) { r = (440 - λ_nm) / 60; g = 0; b = 1; }
  else if (λ_nm >= 440 && λ_nm < 490) { r = 0; g = (λ_nm - 440) / 50; b = 1; }
  else if (λ_nm >= 490 && λ_nm < 510) { r = 0; g = 1; b = (510 - λ_nm) / 20; }
  else if (λ_nm >= 510 && λ_nm < 580) { r = (λ_nm - 510) / 70; g = 1; b = 0; }
  else if (λ_nm >= 580 && λ_nm < 645) { r = 1; g = (645 - λ_nm) / 65; b = 0; }
  else if (λ_nm >= 645 && λ_nm <= 750) { r = 1; g = 0; b = 0; }
  // atenuación en extremos
  let factor = 1;
  if      (λ_nm >= 380 && λ_nm < 420) factor = 0.3 + 0.7 * (λ_nm - 380) / 40;
  else if (λ_nm >= 700 && λ_nm <= 750) factor = 0.3 + 0.7 * (750 - λ_nm) / 50;
  return [r * factor, g * factor, b * factor];
}

// ─── Física: Snell ───────────────────────────────────────────────────────────

/** Devuelve ángulo refractado (rad) o null si hay reflexión total. n₁ sinθ₁ = n₂ sinθ₂ */
function snellRefract(theta1: number, n1: number, n2: number): number | null {
  const sinTheta2 = (n1 / n2) * Math.sin(theta1);
  if (Math.abs(sinTheta2) > 1) return null; // reflexión total interna
  return Math.asin(sinTheta2);
}

/** Fresnel — reflectancia TE para ángulo de incidencia θ₁ (Brewster obvio en la UI) */
function fresnelR(theta1: number, n1: number, n2: number): number {
  const t2 = snellRefract(theta1, n1, n2);
  if (t2 === null) return 1;
  const a = n1 * Math.cos(theta1) - n2 * Math.cos(t2);
  const b = n1 * Math.cos(theta1) + n2 * Math.cos(t2);
  return (a / b) ** 2;
}

// ─── Física: lente delgada ───────────────────────────────────────────────────

/** 1/f = 1/dₒ + 1/dᵢ  → dᵢ = f·dₒ / (dₒ - f)  (signo convencional cartesiano) */
function thinLensImage(do_: number, f: number): number {
  if (Math.abs(do_ - f) < 1e-6) return Infinity;
  return (f * do_) / (do_ - f);
}

/** Ampliación lateral m = -dᵢ/dₒ */
function magnification(do_: number, di: number): number {
  return -di / do_;
}

// ─── Física: doble rendija ───────────────────────────────────────────────────

/**
 * Intensidad de interferencia Young:
 *   I(y) = I₀ · cos²( π · d · y / (λ · L) )
 * donde d = separación de rendijas, L = distancia rendija-pantalla, y = posición en pantalla.
 */
function youngIntensity(y: number, d: number, lambda: number, L: number): number {
  const delta = (Math.PI * d * y) / (lambda * L);
  return Math.cos(delta) ** 2;
}

// ─── LECCIÓN ─────────────────────────────────────────────────────────────────

const LESSON: Lesson<OpticsLessonState> = {
  hook: {
    title: '¿Por qué se dobla la luz al cambiar de medio?',
    body: `La luz viaja más lento en el agua que en el aire. El índice de refracción n mide eso: n = c/v.

Cuando un rayo entra al agua con ángulo, las diferentes partes del frente de onda viajan a velocidades distintas — el resultado es que se "dobla". Esa es la ley de Snell.

La misma física de ondas, llevada más lejos, produce algo asombroso: si juntas dos rendijas estrechas, la luz forma un PATRÓN de bandas brillantes y oscuras — franjas de interferencia. Thomas Young las midió en 1801, demostrando que la luz es una onda.

Aquí vas a ver los tres fenómenos en 3D:
• Refracción (Snell) — el rayo cambia dirección.
• Lente delgada — todos los rayos convergen en el foco.
• Doble rendija — interferencia constructiva y destructiva.`,
  },

  steps: [
    {
      title: 'Ley de Snell — n₁ sinθ₁ = n₂ sinθ₂',
      duration: 6000,
      body: `El rayo de luz entra al bloque de vidrio (n₂ = 1.5) desde el aire (n₁ = 1.0).

La componente tangencial del vector de onda debe conservarse en la interfaz. Eso impone Snell: n₁ sinθ₁ = n₂ sinθ₂.

Como n₂ > n₁, el rayo se acerca a la normal al entrar — lo ves doblarse "hacia adentro". Al salir del otro lado se restaura el ángulo original (bloque de caras paralelas).

Mueve el slider de ángulo de incidencia. A cierto ángulo crítico θ_c = arcsin(n₁/n₂), si vinieras desde el vidrio no saldría nada — reflexión total interna. Esa es la base de la fibra óptica.`,
      formula: 'n₁ sinθ₁ = n₂ sinθ₂\nθ_c = arcsin(n₁/n₂) = 41.8° (vidrio→aire)',
      keyframes: [
        { at: 0, state: { mode: 'refraction' } },
        { at: 1, state: { mode: 'refraction' } },
      ],
    },
    {
      title: 'Lente delgada — 1/f = 1/dₒ + 1/dᵢ',
      duration: 6000,
      body: `Una lente convergente (f > 0) toma todos los rayos paralelos y los reúne en el punto focal.

La ecuación de la lente delgada dice que un objeto a distancia dₒ forma una imagen a dᵢ = f·dₒ/(dₒ−f).

Si dₒ > f → imagen real e invertida al otro lado.
Si dₒ < f → imagen virtual y del mismo lado (lupa).
Si dₒ = f → los rayos salen paralelos (telescopio / colimador).

La ampliación lateral m = −dᵢ/dₒ dice cuánto más grande o chica es la imagen y si está invertida.`,
      formula: '1/f = 1/dₒ + 1/dᵢ\nm = −dᵢ/dₒ',
      keyframes: [
        { at: 0, state: { mode: 'lens' } },
        { at: 1, state: { mode: 'lens' } },
      ],
    },
    {
      title: 'Doble rendija — interferencia de Young',
      duration: 6000,
      body: `Dos rendijas separadas d envían ondas coherentes que se superponen en una pantalla a distancia L.

Donde las crestas se encuentran: interferencia CONSTRUCTIVA → franja brillante.
Donde cresta encuentra valle: interferencia DESTRUCTIVA → franja oscura.

La condición de máximos: d·sinθ = m·λ → posiciones yₘ ≈ m·λL/d.

La anchura de las franjas Δy = λL/d dice que la luz de mayor longitud de onda (roja) produce franjas MÁS ANCHAS que la violeta. Eso es la dispersión — base del espectrógrafo.`,
      formula: 'I(y) = I₀ cos²(πdy/λL)\nyₘ = m λL/d  (máximos, m=0,±1,±2,…)',
      keyframes: [
        { at: 0, state: { mode: 'double-slit' } },
        { at: 1, state: { mode: 'double-slit' } },
      ],
    },
    {
      title: 'Dispersión — cada λ se refracta diferente',
      duration: 5500,
      body: `El índice de refracción n NO es constante: depende de la longitud de onda λ.

Para el vidrio común: n_violeta ≈ 1.52, n_rojo ≈ 1.51. Una diferencia pequeña pero real.

Al pasar por una superficie curva esa diferencia acumula ángulos distintos → el "blanco" se descompone en el espectro. Eso es un prisma, un arcoíris, la aberración cromática de una lente.

La relación n(λ) se llama curva de dispersión — Cauchy la modeló como n(λ) = A + B/λ². La constante de Abbe V = (n_D − 1)/(n_F − n_C) cuantifica qué tan "dispersivo" es un vidrio.`,
      formula: 'n(λ) ≈ A + B/λ²  (fórmula de Cauchy)\nV = (n_D−1)/(n_F−n_C)  (número de Abbe)',
      keyframes: [
        { at: 0, state: { mode: 'refraction' } },
        { at: 1, state: { mode: 'refraction' } },
      ],
    },
  ],

  connect: {
    body: `La óptica que viste aquí no es solo "rayos de luz bonitos". Es la física que mueve tecnologías enteras:

• Fibra óptica → reflexión total interna (Snell) + pulsos a λ distintas (WDM)
• Microscopio / telescopio → ecuación de la lente delgada aplicada N veces
• Litografía de chips → doble rendija (interferometría) define la resolución mínima
• Espectrógrafo → dispersión diferencial por λ para identificar elementos en estrellas
• LIGO → interferometría de precisión para detectar ondas gravitacionales (ΔL ~ 10⁻¹⁸ m)

Y la doble rendija tiene un giro cuántico: si haces pasar fotones de uno en uno, igual aparece el patrón de interferencia. La partícula interfiere consigo misma. Eso es mecánica cuántica — el siguiente módulo.`,
    links: [
      { label: 'Ondas EM — Maxwell completo', href: '#em-waves' },
      { label: 'Mecánica cuántica — Schrödinger 1D', href: '#schrodinger-1d' },
    ],
  },
};

// ─── Colores predefinidos para rayos ─────────────────────────────────────────

const RAY_COLORS: Array<{ name: string; nm: number }> = [
  { name: 'rojo',    nm: 650 },
  { name: 'verde',   nm: 530 },
  { name: 'violeta', nm: 420 },
];

// ─── Componente principal ────────────────────────────────────────────────────

export default function Optics() {
  const { audience } = useAudience();
  const [mode, setMode] = useState<OpticsLessonState['mode']>('refraction');

  // Parámetros de refracción
  const [n1, setN1] = useState(1.0);
  const [n2, setN2] = useState(1.5);
  const [theta1Deg, setTheta1Deg] = useState(35);

  // Parámetros de lente
  const [focalLen, setFocalLen] = useState(1.5); // metros escena
  const [objDist, setObjDist] = useState(3.0);
  const [lensType, setLensType] = useState<'converging' | 'diverging'>('converging');

  // Parámetros de doble rendija
  const [slitSep, setSlitSep] = useState(0.4);   // unidades escena
  const [screenDist, setScreenDist] = useState(4.0);
  const [wavelengthNm, setWavelengthNm] = useState(530);

  // Física derivada — refracción
  const theta1 = (theta1Deg * Math.PI) / 180;
  const theta2 = snellRefract(theta1, n1, n2);
  const isTotalInternal = theta2 === null;
  const theta2Deg = theta2 !== null ? (theta2 * 180) / Math.PI : null;
  const fresnelRefl = fresnelR(theta1, n1, n2);

  // Física derivada — lente
  const fSign = lensType === 'converging' ? focalLen : -focalLen;
  const imgDist = thinLensImage(objDist, fSign);
  const mag = isFinite(imgDist) ? magnification(objDist, imgDist) : 0;

  // Física derivada — doble rendija
  const lambdaScene = wavelengthNm * 1e-9 * 1e7; // escalar nm a unidades de escena ≈ 1

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={6} bloomIntensity={0.9} bloomThreshold={0.1} autoRotate={mode === 'double-slit'}>
          <OpticsScene
            mode={mode}
            n1={n1} n2={n2} theta1={theta1} theta2={theta2}
            fSign={fSign} objDist={objDist} imgDist={imgDist}
            slitSep={slitSep} screenDist={screenDist} wavelengthNm={wavelengthNm}
          />
        </Stage>

        {/* HUD — métricas en vivo */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          {mode === 'refraction' && (
            <>
              <div><span className="text-[#64748B]">θ₁&nbsp;&nbsp;&nbsp;</span>= {theta1Deg.toFixed(1)}°</div>
              <div><span className="text-[#64748B]">θ₂&nbsp;&nbsp;&nbsp;</span>= {theta2Deg !== null ? theta2Deg.toFixed(1) + '°' : <span className="text-[#F87171]">TIR</span>}</div>
              <div><span className="text-[#64748B]">n₁/n₂&nbsp;</span>= {(n1/n2).toFixed(3)}</div>
              <div><span className="text-[#64748B]">R_Fresnel</span>= {(fresnelRefl * 100).toFixed(1)}%</div>
            </>
          )}
          {mode === 'lens' && (
            <>
              <div><span className="text-[#64748B]">f&nbsp;&nbsp;&nbsp;</span>= {fSign.toFixed(2)} m</div>
              <div><span className="text-[#64748B]">dₒ&nbsp;&nbsp;</span>= {objDist.toFixed(2)} m</div>
              <div><span className="text-[#64748B]">dᵢ&nbsp;&nbsp;</span>= {isFinite(imgDist) ? imgDist.toFixed(2) + ' m' : '∞'}</div>
              <div><span className="text-[#64748B]">m&nbsp;&nbsp;&nbsp;</span>= {isFinite(mag) ? mag.toFixed(2) + '×' : '—'}</div>
            </>
          )}
          {mode === 'double-slit' && (
            <>
              <div><span className="text-[#64748B]">λ&nbsp;&nbsp;&nbsp;&nbsp;</span>= {wavelengthNm} nm</div>
              <div><span className="text-[#64748B]">d&nbsp;&nbsp;&nbsp;&nbsp;</span>= {slitSep.toFixed(2)} u</div>
              <div><span className="text-[#64748B]">L&nbsp;&nbsp;&nbsp;&nbsp;</span>= {screenDist.toFixed(1)} u</div>
              <div><span className="text-[#64748B]">Δy&nbsp;&nbsp;&nbsp;</span>= {((wavelengthNm * 1e-9 * 1e7 * screenDist) / slitSep).toFixed(3)} u</div>
            </>
          )}
        </div>

        {/* Selector de modo */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          {(['refraction', 'lens', 'double-slit'] as const).map(m => (
            <ModeBtn key={m} active={mode === m} onClick={() => setMode(m)}>
              {m === 'refraction' ? 'Snell' : m === 'lens' ? 'Lente' : 'Doble Rendija'}
            </ModeBtn>
          ))}
        </div>
      </div>

      <LessonPanel<OpticsLessonState>
        lesson={LESSON}
        onApplyState={patch => {
          if (patch.mode !== undefined) setMode(patch.mode);
        }}
        sandbox={
          <>
            <Section title="Modo">
              <div className="grid grid-cols-1 gap-1.5">
                {([
                  { id: 'refraction', label: 'Refracción (Snell)' },
                  { id: 'lens',       label: 'Lente delgada' },
                  { id: 'double-slit',label: 'Doble rendija (Young)' },
                ] as const).map(opt => (
                  <button key={opt.id} onClick={() => setMode(opt.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      mode === opt.id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>{opt.label}</button>
                ))}
              </div>
            </Section>

            {mode === 'refraction' && (
              <Section title="Refracción">
                <Slider label="θ₁ (°)" v={theta1Deg} min={0} max={89} step={0.5}
                  on={v => setTheta1Deg(v)} />
                <Slider label="n₁" v={n1} min={1.0} max={2.0} step={0.01}
                  on={v => setN1(v)} />
                <Slider label="n₂" v={n2} min={1.0} max={2.5} step={0.01}
                  on={v => setN2(v)} />
                {isTotalInternal && (
                  <div className="mt-2 text-[11px] text-[#F87171] font-mono">
                    ⚠ Reflexión total interna — θ &gt; θ_c
                  </div>
                )}
                <div className="mt-3 text-[10px] text-[#64748B]">
                  θ_c = arcsin(n₁/n₂) = {n2 > n1 ? ((Math.asin(n1/n2)*180/Math.PI).toFixed(1) + '°') : 'n/a (n₂&lt;n₁)'}
                </div>
              </Section>
            )}

            {mode === 'lens' && (
              <Section title="Lente delgada">
                <div className="flex gap-2 mb-3">
                  {(['converging', 'diverging'] as const).map(lt => (
                    <button key={lt} onClick={() => setLensType(lt)}
                      className={`flex-1 text-[11px] py-1.5 rounded border transition ${
                        lensType === lt
                          ? 'border-[#4FC3F7]/50 text-[#4FC3F7] bg-[#4FC3F7]/10'
                          : 'border-[#1E293B] text-[#94A3B8] hover:text-white'
                      }`}>{lt === 'converging' ? 'Convergente' : 'Divergente'}</button>
                  ))}
                </div>
                <Slider label="f (m)" v={focalLen} min={0.5} max={4} step={0.05}
                  on={v => setFocalLen(v)} />
                <Slider label="dₒ (m)" v={objDist} min={0.3} max={8} step={0.05}
                  on={v => setObjDist(v)} />
                {audience !== 'child' && (
                  <div className="mt-2 space-y-0.5">
                    <Row label="dᵢ" value={isFinite(imgDist) ? imgDist.toFixed(3) + ' m' : '∞'} />
                    <Row label="m" value={isFinite(mag) ? mag.toFixed(3) + '×' : '—'} highlight={isFinite(mag) && Math.abs(mag) > 3} />
                  </div>
                )}
              </Section>
            )}

            {mode === 'double-slit' && (
              <Section title="Doble rendija">
                <div className="mb-3">
                  <div className="text-[10px] text-[#64748B] mb-1">Longitud de onda</div>
                  <div className="grid grid-cols-3 gap-1">
                    {RAY_COLORS.map(rc => {
                      const [r, g, b] = wavelengthToRGB(rc.nm);
                      const hex = `rgb(${(r*255)|0},${(g*255)|0},${(b*255)|0})`;
                      return (
                        <button key={rc.nm}
                          onClick={() => setWavelengthNm(rc.nm)}
                          style={{ borderColor: wavelengthNm === rc.nm ? hex : undefined,
                                   color: wavelengthNm === rc.nm ? hex : undefined }}
                          className={`text-[10px] py-1 rounded border transition ${
                            wavelengthNm === rc.nm ? 'bg-white/5' : 'border-[#1E293B] text-[#94A3B8]'
                          }`}
                        >{rc.name}</button>
                      );
                    })}
                  </div>
                  <input type="range" min={380} max={700} step={5}
                    value={wavelengthNm} onChange={e => setWavelengthNm(Number(e.target.value))}
                    className="w-full mt-2" />
                  <div className="text-right text-[10px] font-mono text-[#94A3B8] mt-0.5">{wavelengthNm} nm</div>
                </div>
                <Slider label="Separación d" v={slitSep} min={0.1} max={1.5} step={0.02}
                  on={v => setSlitSep(v)} />
                <Slider label="Distancia L" v={screenDist} min={1} max={8} step={0.1}
                  on={v => setScreenDist(v)} />
              </Section>
            )}

            <Section title="Fórmula">
              {mode === 'refraction' && (
                <div className="font-mono text-[11px] text-[#FDB813] leading-snug">
                  n₁ sinθ₁ = n₂ sinθ₂<br />
                  θ_c = arcsin(n₁/n₂)
                </div>
              )}
              {mode === 'lens' && (
                <div className="font-mono text-[11px] text-[#FDB813] leading-snug">
                  1/f = 1/dₒ + 1/dᵢ<br />
                  m = −dᵢ/dₒ
                </div>
              )}
              {mode === 'double-slit' && (
                <div className="font-mono text-[11px] text-[#FDB813] leading-snug">
                  I(y) = I₀ cos²(πdy/λL)<br />
                  Δy = λL/d
                </div>
              )}
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D ───────────────────────────────────────────────────────────────

interface SceneProps {
  mode: OpticsLessonState['mode'];
  // Refraction
  n1: number; n2: number; theta1: number; theta2: number | null;
  // Lens
  fSign: number; objDist: number; imgDist: number;
  // Double slit
  slitSep: number; screenDist: number; wavelengthNm: number;
}

function OpticsScene(props: SceneProps) {
  return (
    <>
      {props.mode === 'refraction' && <RefractionScene {...props} />}
      {props.mode === 'lens' && <LensScene {...props} />}
      {props.mode === 'double-slit' && <DoubleSlitScene {...props} />}
    </>
  );
}

// ─── Escena Refracción ────────────────────────────────────────────────────────

function RefractionScene({ theta1, theta2, n1, n2 }: SceneProps) {
  // Bloque de vidrio: plano z=0 horizontal
  const interfaceY = 0; // Y de la interfaz (plano horizontal)
  const blockThickness = 2.5;
  const blockW = 5;

  // Geometría del rayo incidente (viene de arriba-izquierda)
  const rayLen = 3.5;
  const incidentStart: [number, number, number] = [
    -Math.sin(theta1) * rayLen,
    Math.cos(theta1) * rayLen,
    0,
  ];
  const interfacePoint: [number, number, number] = [0, interfaceY, 0];

  // Rayo refractado (va hacia abajo dentro del bloque)
  const refractedEnd: [number, number, number] = theta2 !== null
    ? [Math.sin(theta2) * blockThickness, -blockThickness, 0]
    : [0, 0, 0];

  // Segunda interfaz (parte inferior del bloque)
  const exitPoint: [number, number, number] = theta2 !== null
    ? [Math.sin(theta2) * blockThickness, -blockThickness, 0]
    : [0, -blockThickness, 0];

  // Rayo emergente — mismo ángulo θ₁ (bloque de caras paralelas)
  const emergentEnd: [number, number, number] = theta2 !== null
    ? [
        exitPoint[0] + Math.sin(theta1) * 2,
        exitPoint[1] - Math.cos(theta1) * 2,
        0,
      ]
    : [0, 0, 0];

  // Rayo reflejado
  const reflectedEnd: [number, number, number] = [
    Math.sin(theta1) * rayLen * 0.8,
    Math.cos(theta1) * rayLen * 0.8,
    0,
  ];

  // Normal a la interfaz
  const fresnelRefl = fresnelR(theta1, n1, n2);

  return (
    <group>
      {/* Bloque de vidrio — semitransparente */}
      <mesh position={[0, -blockThickness / 2, 0]}>
        <boxGeometry args={[blockW, blockThickness, 1.5]} />
        <meshStandardMaterial
          color="#4FC3F7"
          emissive="#1a3a4a"
          emissiveIntensity={0.4}
          transparent opacity={0.18}
          roughness={0.05} metalness={0.0}
        />
      </mesh>
      {/* Bordes del bloque */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(blockW, blockThickness, 1.5)]} />
        <lineBasicMaterial color="#4FC3F7" transparent opacity={0.4} />
      </lineSegments>

      {/* Etiqueta n₁ / n₂ — esfera indicadora */}
      <mesh position={[-blockW / 2 + 0.5, 1.0, 0]}>
        <sphereGeometry args={[0.08, 16, 12]} />
        <meshStandardMaterial color="#CBD5E1" emissive="#CBD5E1" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-blockW / 2 + 0.5, -1.0, 0]}>
        <sphereGeometry args={[0.08, 16, 12]} />
        <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={0.8} />
      </mesh>

      {/* Rayo incidente — amarillo */}
      <Line points={[incidentStart, interfacePoint]} color="#FDB813" lineWidth={2.5} />

      {/* Rayo refractado — dentro del bloque */}
      {theta2 !== null && (
        <Line points={[interfacePoint, refractedEnd]} color="#34D399" lineWidth={2.5} />
      )}

      {/* Rayo emergente — misma dirección que incidente, desplazado */}
      {theta2 !== null && (
        <Line points={[exitPoint, emergentEnd]} color="#FDB813" lineWidth={2.5} />
      )}

      {/* Rayo reflejado — atenuado por Fresnel */}
      <Line
        points={[interfacePoint, reflectedEnd]}
        color="#F472B6"
        lineWidth={Math.max(0.5, fresnelRefl * 3)}
      />

      {/* Normal a la interfaz */}
      <Line
        points={[[0, -1.2, 0], [0, 1.2, 0]]}
        color="#475569"
        lineWidth={1}
        dashed dashScale={5} dashSize={0.15} gapSize={0.15}
      />

      {/* Punto de impacto */}
      <mesh position={interfacePoint}>
        <sphereGeometry args={[0.07, 20, 16]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>

      {/* TIR warning sphere */}
      {theta2 === null && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.15, 20, 16]} />
          <meshStandardMaterial color="#F87171" emissive="#F87171" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      )}

      {/* Eje óptico */}
      <Line points={[[-blockW / 2, 0, 0], [blockW / 2, 0, 0]]} color="#1E293B" lineWidth={0.8} />
    </group>
  );
}

// ─── Escena Lente ─────────────────────────────────────────────────────────────

/** N rayos paralelos convergiendo en el foco */
const N_RAYS = 9;

function LensScene({ fSign, objDist, imgDist }: SceneProps) {
  const lensX = 0;
  const lensH = 3.5; // semialtura visual de la lente

  const rays: Array<{ start: [number, number, number]; mid: [number, number, number]; end: [number, number, number] }> = [];

  for (let i = 0; i < N_RAYS; i++) {
    const h = ((i / (N_RAYS - 1)) * 2 - 1) * lensH * 0.85; // altura en la lente [-lensH, lensH]
    // Objeto a la izquierda
    const objX = -objDist;
    const startPt: [number, number, number] = [objX, h, 0];
    const midPt: [number, number, number] = [lensX, h, 0]; // llega a la lente en altura h

    // Después de la lente: la lente delgada mapea h → dirección hacia el foco
    // Para lente convergente f>0: todos los rayos paralelos convergen en (f, 0)
    // Para rayo de objeto en (objX, h): usando refracción paraxial
    // slope_out = slope_in - h/f  (matriz ABCD)
    const slope_in = (h - 0) / (lensX - objX); // pendiente hacia la lente desde objeto en (objX, 0) punto alto
    // objeto puntual en (objX, 0) → rayo hacia (lensX, h)
    // slope_in del rayo en el plano de la lente: (h - 0) / (lensX - objX)

    // Ley ABCD (óptica paraxial): slope_out = slope_in - h/f
    const slope_out = slope_in - h / fSign;

    // Fin del rayo: hasta la imagen o hasta el borde de pantalla
    const travelX = isFinite(imgDist) ? imgDist + 1.5 : 6;
    const endX = lensX + travelX;
    const endY = h + slope_out * travelX;
    const endPt: [number, number, number] = [endX, endY, 0];

    rays.push({ start: startPt, mid: midPt, end: endPt });
  }

  // Color de los rayos según tipo de lente
  const rayColor = fSign > 0 ? '#FDB813' : '#F472B6';
  const focalColor = fSign > 0 ? '#34D399' : '#F87171';

  return (
    <group>
      {/* Eje óptico */}
      <Line points={[[-objDist - 1, 0, 0], [objDist + 2, 0, 0]]} color="#1E2A3A" lineWidth={0.8} />

      {/* Lente — elipse plana */}
      <LensShape halfHeight={lensH} converging={fSign > 0} />

      {/* Rayos de luz */}
      {rays.map((r, i) => (
        <group key={i}>
          <Line points={[r.start, r.mid]} color={rayColor} lineWidth={1.5} transparent opacity={0.7} />
          <Line points={[r.mid, r.end]}   color={rayColor} lineWidth={1.5} transparent opacity={0.7} />
        </group>
      ))}

      {/* Punto focal */}
      <mesh position={[fSign, 0, 0]}>
        <sphereGeometry args={[0.09, 20, 16]} />
        <meshStandardMaterial color={focalColor} emissive={focalColor} emissiveIntensity={2} toneMapped={false} />
      </mesh>

      {/* Imagen (si es real y finita) */}
      {isFinite(imgDist) && imgDist > 0 && (
        <mesh position={[imgDist, 0, 0]}>
          <sphereGeometry args={[0.12, 20, 16]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      )}

      {/* Objeto */}
      <mesh position={[-objDist, 0, 0]}>
        <coneGeometry args={[0.15, 0.6, 20]} />
        <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>

      {/* Plano de imagen vertical */}
      {isFinite(imgDist) && (
        <mesh position={[imgDist, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.5, lensH * 2]} />
          <meshStandardMaterial color="#FFFFFF" transparent opacity={0.04} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

/** Silueta de lente convergente o divergente */
function LensShape({ halfHeight, converging }: { halfHeight: number; converging: boolean }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = 64;
    if (converging) {
      // Lente biconvexa — perfil elíptico
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI * 2;
        const y = Math.sin(t) * halfHeight;
        const x = Math.cos(t) * 0.25;
        pts.push(new THREE.Vector3(x, y, 0));
      }
    } else {
      // Lente bicóncava — perfil cóncavo
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI * 2;
        const y = Math.sin(t) * halfHeight;
        const x = -Math.abs(Math.cos(t)) * 0.35 + 0.15;
        pts.push(new THREE.Vector3(x, y, 0));
      }
    }
    return pts;
  }, [halfHeight, converging]);

  return (
    <group>
      {/* Cuerpo de la lente */}
      <mesh>
        <extrudeGeometry args={[
          (() => {
            const shape = new THREE.Shape();
            const N = 64;
            if (converging) {
              shape.moveTo(0, halfHeight);
              for (let i = 1; i <= N; i++) {
                const t = ((N - i) / N) * Math.PI;
                shape.lineTo(Math.cos(t) * 0.25, Math.sin(t) * halfHeight);
              }
              for (let i = 0; i <= N; i++) {
                const t = (i / N) * Math.PI;
                shape.lineTo(-Math.cos(t) * 0.25, Math.sin(t) * halfHeight);
              }
            } else {
              shape.moveTo(-0.15, halfHeight);
              for (let i = 0; i <= N; i++) {
                const frac = i / N;
                const y = halfHeight * (1 - 2 * frac);
                const x = 0.15 - Math.abs(Math.sin(frac * Math.PI)) * 0.35;
                shape.lineTo(x, y);
              }
              for (let i = N; i >= 0; i--) {
                const frac = i / N;
                const y = halfHeight * (1 - 2 * frac);
                const x = -(0.15 - Math.abs(Math.sin(frac * Math.PI)) * 0.35);
                shape.lineTo(x, y);
              }
            }
            shape.closePath();
            return shape;
          })(),
          { depth: 0.05, bevelEnabled: false },
        ]} />
        <meshStandardMaterial
          color="#7DD3FC"
          emissive="#1E40AF"
          emissiveIntensity={0.5}
          transparent opacity={0.25}
          roughness={0.02} metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Contorno brillante */}
      <Line points={points} color="#7DD3FC" lineWidth={1.5} transparent opacity={0.8} />
    </group>
  );
}

// ─── Escena Doble Rendija ─────────────────────────────────────────────────────

const SCREEN_POINTS = 500; // puntos en el patrón de intensidad

function DoubleSlitScene({ slitSep, screenDist, wavelengthNm }: SceneProps) {
  // Escalar λ para que el patrón sea visible en la escena (unidades de la escena ≈ metros * 1e7)
  const lambdaScene = wavelengthNm * 1e-9 * 1e7;

  // Color del rayo según λ
  const [rC, gC, bC] = wavelengthToRGB(wavelengthNm);
  const rayColorHex = `rgb(${(rC * 255) | 0},${(gC * 255) | 0},${(bC * 255) | 0})`;

  // Pantalla de interferencia — geometría de puntos
  const screenGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(SCREEN_POINTS * 3);
    const col = new Float32Array(SCREEN_POINTS * 3);
    const screenH = 4.5;
    for (let i = 0; i < SCREEN_POINTS; i++) {
      const y = ((i / (SCREEN_POINTS - 1)) * 2 - 1) * screenH;
      const intensity = youngIntensity(y, slitSep, lambdaScene, screenDist);
      pos[i * 3 + 0] = screenDist;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = 0;
      col[i * 3 + 0] = rC * intensity;
      col[i * 3 + 1] = gC * intensity;
      col[i * 3 + 2] = bC * intensity;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [slitSep, lambdaScene, screenDist, rC, gC, bC]);

  // Rayos de las dos rendijas hacia la pantalla (algunos representativos)
  const slitY1 = slitSep / 2;
  const slitY2 = -slitSep / 2;
  const slitX = 0;
  const nFanRays = 11;
  const screenH = 4.5;

  // Barrera con rendijas
  const barrierH = 5;

  return (
    <group>
      {/* Eje óptico */}
      <Line points={[[-3, 0, 0], [screenDist + 0.5, 0, 0]]} color="#1E2A3A" lineWidth={0.8} />

      {/* Fuente de luz — onda incidente */}
      <mesh position={[-2.5, 0, 0]}>
        <sphereGeometry args={[0.12, 20, 16]} />
        <meshStandardMaterial
          color={rayColorHex} emissive={rayColorHex} emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>

      {/* Rayo incidente */}
      <Line points={[[-2.5, 0, 0], [slitX - 0.05, slitY1, 0]]} color={rayColorHex} lineWidth={1.2} transparent opacity={0.5} />
      <Line points={[[-2.5, 0, 0], [slitX - 0.05, slitY2, 0]]} color={rayColorHex} lineWidth={1.2} transparent opacity={0.5} />

      {/* Barrera */}
      <BarrierWithSlits halfH={barrierH / 2} slitY1={slitY1} slitY2={slitY2} slitW={0.15} />

      {/* Rendijas — puntos brillantes */}
      {[slitY1, slitY2].map((sy, i) => (
        <mesh key={i} position={[slitX, sy, 0]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial
            color={rayColorHex} emissive={rayColorHex} emissiveIntensity={3}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Rayos en abanico desde las dos rendijas */}
      {[slitY1, slitY2].map((sy, si) =>
        Array.from({ length: nFanRays }, (_, i) => {
          const yTarget = ((i / (nFanRays - 1)) * 2 - 1) * screenH * 0.9;
          return (
            <Line
              key={`${si}-${i}`}
              points={[[slitX, sy, 0], [screenDist, yTarget, 0]]}
              color={rayColorHex}
              lineWidth={0.6}
              transparent
              opacity={0.15}
            />
          );
        })
      )}

      {/* Patrón de interferencia en la pantalla */}
      <points geometry={screenGeom}>
        <pointsMaterial
          vertexColors size={0.06} sizeAttenuation
          transparent opacity={1.0}
          blending={THREE.AdditiveBlending} depthWrite={false}
        />
      </points>

      {/* Pantalla física */}
      <mesh position={[screenDist, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.5, screenH * 2]} />
        <meshStandardMaterial color="#0F172A" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Marco de pantalla */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(0.05, screenH * 2, 1.5)]} />
        <lineBasicMaterial color="#334155" transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

/** Barrera opaca con dos rendijas */
function BarrierWithSlits({
  halfH, slitY1, slitY2, slitW,
}: { halfH: number; slitY1: number; slitY2: number; slitW: number }) {
  // Tres rectángulos: top, middle, bottom
  const topH   = halfH - slitY1 - slitW / 2;
  const topY   = slitY1 + slitW / 2 + topH / 2;
  const midH   = slitY1 - slitW / 2 - (slitY2 + slitW / 2);
  const midY   = (slitY1 - slitW / 2 + slitY2 + slitW / 2) / 2;
  const botH   = slitY2 - slitW / 2 + halfH;
  const botY   = slitY2 - slitW / 2 - botH / 2;
  const depth  = 0.3;
  const w      = 0.12;

  return (
    <group>
      {[
        { y: topY, h: topH },
        { y: midY, h: Math.max(0.01, midH) },
        { y: botY, h: Math.max(0.01, botH) },
      ].map((seg, i) => (
        <mesh key={i} position={[0, seg.y, 0]}>
          <boxGeometry args={[w, seg.h, depth]} />
          <meshStandardMaterial color="#1E293B" emissive="#0F172A" emissiveIntensity={0.2} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

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

function Slider({ label, v, min, max, step, on }: {
  label: string; v: number; min: number; max: number; step: number; on: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between text-[11px] font-mono mb-1">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function ModeBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`text-[11px] px-3 py-1.5 rounded-md border transition ${
        active
          ? 'border-[#FDB813]/50 text-[#FDB813] bg-[#FDB813]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>
      {children}
    </button>
  );
}
