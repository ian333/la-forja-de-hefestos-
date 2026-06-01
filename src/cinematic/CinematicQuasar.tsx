/**
 * CinematicQuasar — el comercial de cine del QUÁSAR, por BEATS. 9:16 vertical.
 * Hermano de CinematicGargantua / CinematicBHReel. Muestra la FURIA y la
 * GRANDEZA de un jet relativista Blandford-Znajek.
 * ============================================================================
 *
 *   "La batería rotacional del universo."
 *
 * El sujeto es la sim HÉROE QuasarBZ (jet precomputado con la cadena relativista
 * completa: BZ poloidal de potencia, B_φ∝1/R radiante, aceleración Asada+2014,
 * densidad por conservación de masa, sincrotrón Rybicki-Lightman, Doppler
 * Lind-Blandford). Aquí REUSAMOS su geometría (loadBZData) y su shader del jet,
 * y el motor central (BHRaytraced, disco S-S T∝r⁻¾ + photon ring) — NO se toca
 * la física: el cine es solo cámara / luz / lente / color / edición.
 *
 * ── ENCUADRE (regla dura, pagada con sangre) ────────────────────────────────
 *  El jet es una AGUJA ~58:1 a lo largo de +Y mundo. Visto A LA CARA (end-on) es
 *  un punto borroso y NO hay boost. La FURIA se ve DE COSTADO/ESCORZO, a ~18-20°
 *  del eje (como M87/HST-1): la aguja se ve LARGA y el Doppler δ^(2+α) EXISTE
 *  (la zona γ>5, el azul relativista). Toda la cámara vive a elevación alta
 *  (~70-72° desde el plano XZ ⇒ ~18-20° del eje +Y) → escorzo, nunca de canto
 *  perfecto (eso aplanaría la aguja) ni de cara (punto).
 *
 * ── BEATS (cámara PURA en t vía WeightedRig, con PESO) ───────────────────────
 *  B1 EL MOTOR    — arranca pegado al disco/horizonte: el big blue bump azul-
 *                   blanco, el motor del que NACE el jet. La furia empieza aquí.
 *  B2 EL CHORRO   — la cámara sube/retrocede en escorzo y revela el jet
 *                   disparando: nudos brillando por Doppler, velocidad. Furia
 *                   desatada. El boost δ es DETERMINISTA (uObserverDir de la pose).
 *  B3 LA GRANDEZA — revela la escala: el jet completo + una ScaleReference (una
 *                   sonda-galaxia diminuta) JUNTO a un nudo brillante para el
 *                   contraste mota-vs-chorro. (NO se saca el sujeto del cuadro:
 *                   con una aguja eso no funciona — la escala se vende con la
 *                   mota junto al nudo.)
 *
 * ── DETERMINISMO TOTAL (regla dura) ─────────────────────────────────────────
 *  window.__cinematicQuasar.renderAt(t) ∈ [0, duration]. TODO es función PURA de
 *  t. Cero OrbitControls, cero autoRotate, cero state.clock, cero rAF de pared,
 *  cero setState en el camino de render. CRÍTICO: uObserverDir del jet NO sale de
 *  camera.getWorldDirection en vivo (eso es 1 frame stale y depende del rig) sino
 *  de la pose PROGRAMADA en t (normalize(camPos - target)) leída por un getter
 *  síncrono en el MISMO useFrame → el Doppler-boost es 100% reproducible y casa
 *  con la cámara frame a frame. Mismo t → mismo frame → CACHE HIT.
 *
 * ── DOCTRINA DE CINE (heredada de Gargantua/BHReel) ─────────────────────────
 *  · Canvas calidad cine: dpr alto + antialias; gl.toneMapping = NoToneMapping
 *    (el ÚNICO ACES lo hace CinematicPostFX → BHRaytraced linearOutput, jet HDR
 *    sin clamp). Cero doble tonemap.
 *  · CinematicPostFX preset 'quasar' (bloom 2.6 / threshold 0.14, anamórfico).
 *    dofBokehScale=0: el BHRaytraced del motor es un quad fullscreen SIN depth →
 *    el DOF desenfocaría todo. chromaticAberration BAJA (CA alta sobre starfield
 *    = confeti).
 *  · Uniforms NUNCA inline (useMemo). NO drei <Text> en Canvas (rompe el
 *    EffectComposer): el HUD/caption es overlay DOM, quemado por el render.
 *  · Sujeto en la columna central segura → el recorte vertical 9:16 funciona.
 *
 * ── HONESTIDAD FÍSICA ────────────────────────────────────────────────────────
 *  · El color del jet es por γ_bulk = PROXY de aceleración (base roja → punta
 *    azul), NO el azul sincrotrón medido de M87 (etiquetado en el shader y el HUD).
 *  · La trayectoria de cámara es elección de DIRECCIÓN (no afirma seguir una
 *    partícula) → no requiere etiqueta. El boost Doppler que se VE sí es la
 *    física del .bin (δ^(2+α), γ del flujo, β=√(1-1/γ²)).
 *  · El HUD quema los números CITABLES de la sim héroe (η>100%, P_BZ, Ω_H): la
 *    furia CUANTIFICADA — el BH como batería rotacional (Blandford-Znajek).
 *
 * ── RENDER OFFLINE (en iangpu, ver cinematic-quasar-main.tsx) ────────────────
 *  Sincronizar el source a iangpu ANTES del vite build (iangpu tiene su propio
 *  filesystem). Render frame a frame por window.__cinematicQuasar.renderAt(t).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import BHRaytraced from '@/labs/components/BHRaytraced';
import { makeRenderer } from '@/lib/webgl-fallback';
import CinematicPostFX from './CinematicPostFX';
import ScaleReference from './ScaleReference';
import {
  spherical, lerp, smooth, smootherstep, easeExp, clamp01,
  addWeight, cameraAt,
  type CameraState, type Vec3, type LagState,
} from './CinematicCamera';
import { loadBZData, BZ, type BZData } from '@/quasar/QuasarBZ';

// ============================================================================
// Geometría del mundo (en las unidades del .bin: z_jet → +Y mundo, SCALE 0.0008,
// ver BZ_SCALE en QuasarBZ). El jet llega a ~80 wu (z=10⁵ r_g · 0.0008) a lo
// largo de +Y. El motor (BHRaytraced) vive en el origen con rs=0.5 → disco de
// radio rOut=12·rs=6 wu, a escala de la BASE del jet. Las poses de cámara y la
// ScaleReference se componen en ESTE mismo espacio.
// ============================================================================

// ============================================================================
// Cinematic JetMesh — MISMA geometría + MISMO shader que QuasarBZ.JetMesh, pero
// el uniform uObserverDir se alimenta de un getter SÍNCRONO (derivado de la pose
// PROGRAMADA en t), NO de camera.getWorldDirection en vivo. Esto hace el boost
// Doppler 100% determinista y casado con la cámara en el MISMO tick (la versión
// interactiva sí usa la cámara viva — son módulos distintos a propósito).
//
// El shader es copia verbatim del de QuasarBZ (no se toca la física):
//   · β = √(1-1/γ²), cosθ = v̂·n̂, δ = 1/[γ(1-βcosθ)], S ∝ δ^(2+α) (jet continuo)
//   · color por γ_bulk = PROXY de aceleración (NO azul sincrotrón medido)
//   · compresión perceptual pow(0.18) (display log VLBI), HDR sin clamp a 1
// ============================================================================
function CinematicJetMesh({
  data,
  mirror = false,
  getObserverDir,
}: {
  data: BZData;
  mirror?: boolean;
  getObserverDir: () => THREE.Vector3;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',   new THREE.BufferAttribute(data.positions,  3));
    g.setAttribute('brightness', new THREE.BufferAttribute(data.brightness, 1));
    g.setAttribute('gamma',      new THREE.BufferAttribute(data.gamma,      1));
    g.setIndex(new THREE.BufferAttribute(data.indices, 1));
    return g;
  }, [data]);

  // Uniforms ESTABLES (useMemo, nunca inline): un objeto nuevo por render
  // reasigna material.uniforms y se pierden las updates GPU.
  const uniforms = useMemo(() => ({
    uObserverDir: { value: new THREE.Vector3(0, 0, 1) },
    uAlphaSpec:   { value: 0.7 },            // índice espectral AGN (α≈0.7, p≈2.5)
    uMirror:      { value: mirror ? 1.0 : 0.0 },
    uBoost:       { value: 1.0 },
  }), [mirror]);

  // getter vivo en un ref (sin closure stale).
  const getDirRef = useRef(getObserverDir);
  getDirRef.current = getObserverDir;

  useFrame(() => {
    if (!matRef.current) return;
    // DETERMINISTA: dirección "hacia el observador" derivada de la pose PROGRAMADA
    // en t (no camera.getWorldDirection en vivo). Mismo tick que la cámara.
    matRef.current.uniforms.uObserverDir.value.copy(getDirRef.current());
  });

  return (
    <group scale={mirror ? [1, -1, 1] : [1, 1, 1]}>
      <lineSegments geometry={geom}>
        <shaderMaterial
          ref={matRef}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          uniforms={uniforms}
          vertexShader={`
            attribute float brightness;
            attribute float gamma;
            varying float vBrightness;
            varying float vGamma;
            varying float vDoppler;
            uniform vec3 uObserverDir;
            uniform float uAlphaSpec;
            uniform float uMirror;
            void main() {
              vBrightness = brightness;
              vGamma = gamma;
              // Velocidad del fluido jet: dirección Y mundo (mirror → -Y).
              vec3 vJet = vec3(0.0, uMirror > 0.5 ? -1.0 : 1.0, 0.0);
              float beta = sqrt(max(0.0, 1.0 - 1.0/(gamma*gamma)));
              float cosTheta = dot(vJet, normalize(uObserverDir));
              float delta = 1.0 / (gamma * (1.0 - beta * cosTheta) + 1e-6);
              vDoppler = pow(max(delta, 0.001), 2.0 + uAlphaSpec);  // δ^(2+α) jet continuo
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying float vBrightness;
            varying float vGamma;
            varying float vDoppler;
            uniform float uBoost;
            void main() {
              float intensity = vBrightness * vDoppler * uBoost;
              // Color por γ_bulk = PROXY de aceleración (NO azul sincrotrón medido).
              vec3 hot  = vec3(0.43, 0.65, 1.00);   // azul: γ alto (flujo rápido)
              vec3 mid  = vec3(1.00, 0.95, 0.82);   // blanco: γ medio
              vec3 cool = vec3(1.00, 0.40, 0.22);   // naranja-rojo: γ bajo (base lenta)
              float gn  = clamp((vGamma - 1.05) / (8.8 - 1.05), 0.0, 1.0);
              vec3 col  = mix(mix(cool, mid, clamp(gn*2.0, 0.0, 1.0)),
                              hot, clamp((gn - 0.5) * 2.0, 0.0, 1.0));
              // Compresión perceptual (display log VLBI): la base domina pero la
              // zona acelerada (γ>5, azul) ya BRILLA. HDR sin clamp (revienta bloom).
              float visI = pow(max(intensity, 0.0), 0.18);
              float hdr  = visI * 2.4;
              vec3 final = col * hdr;
              float a    = clamp(visI * 1.1, 0.0, 0.95);
              gl_FragColor = vec4(final, a);
            }
          `}
        />
      </lineSegments>
    </group>
  );
}

// ============================================================================
// PROGRAMA DE CÁMARA — beats puros en t. Escorzo ~18-20° del eje +Y SIEMPRE.
// ----------------------------------------------------------------------------
// elev = elevación desde el plano XZ. El ángulo de visión respecto al eje +Y del
// jet es (90° - elev). Para el escorzo M87 (~18-20° off-axis) mantenemos
// elev ∈ [68°, 73°] → la aguja se ve LARGA y hay boost Doppler (la pose tiene
// gran componente +Y → cosθ alto → δ grande en el jet que se acerca).
//
// dist/target/fov coreografían los tres beats. Todo función PURA de t; el PESO
// (micro-shake + inercia) lo añade el WeightedRig. Devolvemos también el target
// para poder derivar uObserverDir = normalize(camPos - target) DETERMINISTA.
// ============================================================================
const DURATION = 33;

// Límites de beat (s). B1 motor, B2 chorro, B3 grandeza.
const B1_END = 11;   // 0..11  EL MOTOR
const B2_END = 22;   // 11..22 EL CHORRO
//                      22..33 LA GRANDEZA

// Ángulo de visión off-axis del jet (grados). 18-20° = sweet spot M87/HST-1:
// aguja larga + boost Doppler máximo (δ_max ≈ γ en sinθ=1/γ). elev = 90 - θoff.
function offAxisElev(thetaOffDeg: number): number { return 90 - thetaOffDeg; }

function cameraProgram(t: number): CameraState {
  const tc = Math.max(0, Math.min(DURATION, t));

  // Azimut: órbita lenta y continua a lo largo de TODO el plano (parallax suave,
  // peso de grúa). Una sola rampa monótona evita saltos entre beats.
  const pAll = tc / DURATION;
  const azim = lerp(-0.55, 0.85, smooth(pAll));

  let dist: number, elevDeg: number, fov: number;
  let target: Vec3;

  if (tc < B1_END) {
    // ── B1 EL MOTOR ──────────────────────────────────────────────────────────
    // Pegados al disco/horizonte (el big blue bump). dist pequeña → el motor
    // domina. Empezamos casi de canto-alto y subimos un pelín; target en el
    // origen (el disco S-S coaxial con el jet, normal +Y). La furia empieza aquí.
    const p = clamp01(tc / B1_END);
    // 11 wu → 20 wu: nos despegamos despacio del motor (el disco rOut≈6 wu llena
    // el cuadro al inicio y empieza a leerse el arranque del jet al final).
    dist = lerp(11, 20, easeExp(smooth(p), -1.6));
    // Escorzo apretado: 19° off-axis (elev 71°). El motor + base del jet en
    // escorzo, NUNCA de cara.
    elevDeg = offAxisElev(lerp(20, 19, smooth(p)));
    fov = lerp(40, 44, smooth(p));
    // Target sube levemente desde el disco hacia la base del jet (lo que nace).
    target = [0, lerp(0, 6, smooth(p)), 0];
  } else if (tc < B2_END) {
    // ── B2 EL CHORRO ─────────────────────────────────────────────────────────
    // La cámara SUBE y RETROCEDE en escorzo: el jet relativista disparando, los
    // nudos brillando por Doppler. dist crece, el target sube por el eje del jet
    // → el chorro se despliega LARGO en el cuadro. Furia desatada.
    const p = clamp01((tc - B1_END) / (B2_END - B1_END));
    dist = lerp(20, 55, easeExp(smooth(p), 1.2));         // acelera el retroceso (vértigo)
    elevDeg = offAxisElev(lerp(19, 18, smooth(p)));        // escorzo M87 exacto (18°)
    fov = lerp(44, 46, smooth(p));
    // El target trepa por el eje: seguimos la punta acelerada (la zona azul γ>5).
    target = [0, lerp(6, 34, smooth(p)), 0];
  } else {
    // ── B3 LA GRANDEZA ────────────────────────────────────────────────────────
    // Retroceso final que revela el JET COMPLETO. dist al máximo, fov amplio,
    // target a media altura del jet → el chorro entero entra en el cuadro y la
    // ScaleReference (mota junto a un nudo brillante) vende la escala. No sacamos
    // el sujeto del cuadro: con una aguja la escala se vende con el contraste.
    const p = clamp01((tc - B2_END) / (DURATION - B2_END));
    dist = lerp(55, 96, easeExp(smootherstep(p), -2.4));  // freno final → se asienta nítido
    elevDeg = offAxisElev(lerp(18, 20, smooth(p)));        // abre un pelín el escorzo
    fov = lerp(46, 50, smooth(p));
    // Target a media altura del jet: el chorro completo de la base a la punta.
    target = [0, lerp(34, 42, smooth(p)), 0];
  }

  const pos = spherical(azim, (elevDeg * Math.PI) / 180, dist);
  return { pos, target, fov };
}

// Pesos del rig por beat (grúa pesada; el motor un poco más nervioso/cercano).
function rigWeightsAt(t: number): { lag: number; posAmp: number; targetAmp: number } {
  if (t < B1_END) return { lag: 0.50, posAmp: 0.30, targetAmp: 0.22 }; // motor: cercano, vivo
  if (t < B2_END) return { lag: 0.55, posAmp: 0.55, targetAmp: 0.35 }; // chorro: grúa
  return { lag: 0.60, posAmp: 0.45, targetAmp: 0.30 };                 // grandeza: peso del cosmos
}

// Caption por beat (overlay DOM, quemado por el render — NO drei <Text>).
function captionAt(t: number): string {
  if (t < B1_END) return 'El motor: el big blue bump del que nace el chorro.';
  if (t < B2_END) return 'El chorro relativista — los nudos brillan por Doppler.';
  return 'La grandeza: un jet de miles de años luz. Esa mota es una galaxia.';
}

// ============================================================================
// uObserverDir DETERMINISTA — dirección "hacia el observador" desde la pose
// PROGRAMADA en t. El shader del jet la usa para δ = 1/[γ(1-βcosθ)]. cosθ =
// v̂_jet · n̂_obs con n̂_obs apuntando del jet HACIA la cámara = normalize(pos -
// target). Pura en t → boost reproducible y casado con la cámara. (La escala -1
// del counter-jet ya la maneja el uniform uMirror dentro del shader.)
// ============================================================================
function observerDirAt(t: number, out: THREE.Vector3): THREE.Vector3 {
  const { pos, target } = cameraProgram(t);
  out.set(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]).normalize();
  return out;
}

// ============================================================================
// Rig con PESO cuyo lag/amp cambia con el beat ACTIVO, 100% PURO en t (mismo
// patrón que BeatWeightedRig de CinematicBHReel: lagState ÚNICO y persistente,
// kind derivado en el useFrame). No remonta en el corte → sin jitter de peso.
// ============================================================================
function QuasarRig({ getT }: { getT: () => number }) {
  const { camera } = useThree();
  const lagState = useRef<LagState>({ pos: null, target: null });
  useFrame(() => {
    const t = getT();
    const prog = cameraProgram(t);
    const w = rigWeightsAt(t);
    const { pos, target } = addWeight(prog.pos, prog.target, t, {
      lag: w.lag,
      posAmp: w.posAmp,
      targetAmp: w.targetAmp,
      lagState: lagState.current,
      dt: 1 / 60,
    });
    cameraAt(camera as THREE.PerspectiveCamera, pos, target, prog.fov);
  });
  return null;
}

// ScaleReference cuya trayectoria se ancla JUNTO a un nudo brillante del jet
// (no en el origen): una mota-galaxia a media altura del chorro, al lado del eje,
// para el contraste mota-vs-chorro. Solo visible/relevante en la grandeza, pero
// deriva continua (no salta). Posiciones en wu del .bin.
const PROBE_PATH = {
  center: [4.5, 38, -3.0] as [number, number, number], // al lado de un nudo a media altura
  amplitude: [1.2, 2.0, 1.0] as [number, number, number],
  speed: [0.010, 0.013, 0.009] as [number, number, number],
  drift: [0.02, 0.06, 0.015] as [number, number, number], // sube lento junto al jet
  tumble: [0.05, 0.02, 0.03] as [number, number, number],
};

// ============================================================================
// Escena 3D (dentro del Canvas). Carga el .bin, monta motor + jet + counter-jet
// + sonda + postFX. Todos los t deterministas vienen de timeRef (síncrono).
// ============================================================================
function QuasarScene({
  timeRef,
  getObserverDir,
}: {
  timeRef: React.MutableRefObject<number>;
  getObserverDir: () => THREE.Vector3;
}) {
  const [data, setData] = useState<BZData | null>(null);
  useEffect(() => {
    let alive = true;
    loadBZData().then((d) => { if (alive) setData(d); }).catch((e) => console.error('[CinematicQuasar] loadBZData falló:', e));
    return () => { alive = false; };
  }, []);

  return (
    <>
      {/* Cámara con PESO: pose pura en t + micro-shake determinista + inercia. */}
      <QuasarRig getT={() => timeRef.current} />

      {/* MOTOR CENTRAL: disco S-S + horizonte vía raytracer Schwarzschild. El
          disco normal +Y es COAXIAL con el eje del jet (+Y) → el motor del que
          NACE el chorro. rs=0.5 → rOut=12·rs=6 wu, a escala de la base del jet
          (FIX-3 de la sim héroe). linearOutput → el ÚNICO ACES lo hace el postFX.
          chromaticAberration=0: el motor es un quad fullscreen sin depth, la CA
          del lensado = confeti. Tinte #DDEAFF = big blue bump azul-blanco. */}
      <BHRaytraced
        rs={0.5}
        rIn={2.4}
        rOut={12.0}
        inclinationDeg={68}
        diskOpacity={1.0}
        dopplerStrength={1.0}
        starDensity={1.0}
        starSeed={2.8}
        diskTint="#DDEAFF"
        photonRing
        linearOutput
        exposure={2.2}
        nebulaBoost={0.7}
        chromaticAberration={0}
      />

      {data && (
        <>
          {/* Jet principal (up) — uObserverDir DETERMINISTA de la pose en t. */}
          <CinematicJetMesh data={data} getObserverDir={getObserverDir} />
          {/* Counter-jet (mirror -Y) — Doppler-DIMMED automático (se aleja). */}
          <CinematicJetMesh data={data} mirror getObserverDir={getObserverDir} />

          {/* ESCALA: sonda-galaxia diminuta JUNTO a un nudo brillante a media
              altura del chorro (contraste mota-vs-chorro). getT síncrono = mismo
              tick que la cámara. emissive azul-blanco para casar con la paleta. */}
          <ScaleReference
            t={0}
            getT={() => timeRef.current}
            scale={0.7}
            emissiveColor="#bcd8ff"
            seed={11}
            path={PROBE_PATH}
          />
        </>
      )}

      {/* Postproceso cinematográfico — preset 'quasar'. Hace el ÚNICO tonemap
          ACES. dofBokehScale=0 (motor = quad sin depth → DOF desenfocaría todo).
          chromaticAberration BAJA (caOffset del preset es 0.0016, suave; CA alta
          sobre el starfield = confeti). anamórfico = el rayo de lente del jet. */}
      <CinematicPostFX
        preset="quasar"
        bloomThreshold={0.14}
        dofBokehScale={0}
        anamorphic
      />
    </>
  );
}

// ============================================================================
// HUD overlay DOM — la FURIA cuantificada, quemable por el render. NO drei
// <Text> en Canvas (rompe el EffectComposer). Números CITABLES de la sim héroe
// (BZ = bzPhysics(0.95, 6e9)): η>100% (MAD, extrae spin), P_BZ en W, Ω_H. El
// caption cambia por beat. Todo PURO en t (lee el animTime de estado, solo para
// el texto — no toca el camino de render 3D determinista).
// ============================================================================
function QuasarHUD({ t }: { t: number }) {
  const caption = captionAt(t);
  return (
    <>
      {/* Letterbox fino tipo cine (9:16) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4.5%', background: '#000', pointerEvents: 'none', zIndex: 10 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4.5%', background: '#000', pointerEvents: 'none', zIndex: 10 }} />

      {/* La furia CUANTIFICADA (columna central segura, arriba). */}
      <div
        style={{
          position: 'absolute', top: '7%', left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          pointerEvents: 'none', zIndex: 11, lineHeight: 1.5,
        }}
      >
        <div style={{ color: '#7DD3FC', fontSize: '13px', letterSpacing: '0.04em' }}>
          η_jet = P_BZ/(Ṁc²) ≈ {(BZ.etaMAD * 100).toFixed(0)}%
        </div>
        <div style={{ color: '#FCA5A5', fontSize: '11px', marginTop: '2px' }}>
          &gt;100% — el chorro extrae el SPIN del agujero negro
        </div>
        <div style={{ color: '#A7F3D0', fontSize: '11px', marginTop: '4px' }}>
          P_BZ ≈ {BZ.pBZ.toExponential(1)} W · Ω_H = {BZ.omegaH.toFixed(3)} c³/GM
        </div>
      </div>

      {/* Caption por beat (columna central segura, abajo). */}
      <div
        style={{
          position: 'absolute', bottom: '9%', left: '8%', right: '8%',
          textAlign: 'center', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          color: '#E8EEF7', fontSize: '15px', letterSpacing: '0.02em',
          textShadow: '0 2px 12px rgba(0,0,0,0.9)', pointerEvents: 'none', zIndex: 11,
        }}
      >
        {caption}
      </div>

      {/* Crédito de honestidad física (minúsculo, esquina). */}
      <div
        style={{
          position: 'absolute', bottom: '5.2%', left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'ui-monospace, monospace', color: '#475569', fontSize: '9px',
          pointerEvents: 'none', zIndex: 11, opacity: 0.8,
        }}
      >
        Blandford-Znajek · a*=0.95 · color por γ_bulk (proxy de aceleración)
      </div>
    </>
  );
}

// ============================================================================
// Componente raíz. Expone window.__cinematicQuasar.renderAt(t). timeRef es la
// fuente síncrona que alimenta TODO el camino de render (cámara, jet, sonda).
// setAnimTime solo refresca el HUD DOM (texto), NO el 3D determinista.
// ============================================================================
const gl = makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });

export default function CinematicQuasar() {
  const timeRef = useRef(0);
  const [animTime, setAnimTime] = useState(0);

  // scratch reutilizable para uObserverDir (cero allocs por frame).
  const obsScratch = useRef(new THREE.Vector3(0, 0, 1));
  const getObserverDir = useRef(() => observerDirAt(timeRef.current, obsScratch.current));

  useEffect(() => {
    const api = {
      renderAt: (t: number) => {
        const c = Math.max(0, Math.min(DURATION, t));
        timeRef.current = c;   // síncrono: cámara + jet + sonda lo leen en useFrame
        setAnimTime(c);        // solo el HUD DOM (texto); no toca el 3D determinista
      },
      ready: true,
      duration: DURATION,
      get t() { return timeRef.current; },
      // Mapa de beats para que el render cachee / queme captions por tramo.
      beats: [
        { id: 'B1_MOTOR',    start: 0,       end: B1_END,    caption: captionAt(0) },
        { id: 'B2_CHORRO',   start: B1_END,  end: B2_END,    caption: captionAt(B1_END) },
        { id: 'B3_GRANDEZA', start: B2_END,  end: DURATION,  caption: captionAt(B2_END) },
      ],
    };
    (window as unknown as { __cinematicQuasar: typeof api }).__cinematicQuasar = api;
    return () => {
      delete (window as unknown as { __cinematicQuasar?: unknown }).__cinematicQuasar;
    };
  }, []);

  const initialFov = cameraProgram(0).fov ?? 40;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      <Canvas
        frameloop="always"
        camera={{ position: [12, 24, 12], fov: initialFov, near: 0.001, far: 500 }}
        gl={gl}
        dpr={[1.5, 2]}
        onCreated={({ gl }) => {
          // NoToneMapping: el ÚNICO ACES lo aplica el postFX (BHRaytraced
          // linearOutput, jet HDR sin clamp). Cero doble tonemap.
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        <QuasarScene timeRef={timeRef} getObserverDir={() => getObserverDir.current()} />
      </Canvas>

      {/* HUD overlay DOM (fuera del Canvas): no rompe el EffectComposer. */}
      <QuasarHUD t={animTime} />
    </div>
  );
}
