/**
 * CinematicGargantua — un solo plano continuo de ~30s: caída lentísima hacia
 * Gargantua. La cámara empieza lejísimos (el agujero como joya en el cosmos) y
 * desciende en espiral hasta casi rozar el photon ring, pasando de una vista
 * casi-de-frente (anillo lensado) a edge-on (la "ceja" de Interstellar).
 *
 *   "No es un zoom. Es una caída."
 *
 * Sin cortes: la transformación de la geometría de lente ES la animación.
 * El disco se renderiza con el raytrace real de geodésicas Schwarzschild
 * (BHRaytraced) — temperatura T∝r^-¾, Doppler δ⁴, photon ring √27/2·rs.
 *
 * ── DOCTRINA DE CINE (re-cableado 2026-05-31) ───────────────────────────────
 *  · Canvas calidad cine: dpr alto + antialias, gl.toneMapping = NoToneMapping
 *    (el tonemap ACES lo hace UNA sola vez el postFX → BHRaytraced linearOutput).
 *  · Postproceso cinematográfico via <CinematicPostFX preset="bh"> — Bloom de
 *    threshold BAJO (el photon ring REVIENTA), DOF con foco en el ring,
 *    aberración cromática, grano, viñeta, flare anamórfico.
 *  · Cámara con PESO: micro-shake determinista + inercia (CinematicCamera);
 *    más lenta/pesada; Gargantua sale del encuadre al final (= no cabe = enorme).
 *  · <ScaleReference>: una sonda diminuta a la deriva cerca del horizonte —
 *    escala instantánea (el truco de Interstellar).
 *  · Sujeto en la columna central segura → el recorte vertical 9:16 funciona.
 *
 * REGLAS DURAS respetadas: física intacta (geodésicas/Doppler/photon ring),
 * sin doble tonemap, determinismo total (todo función pura de t), uniforms del
 * shader nunca inline (viven en BHRaytraced con su useMemo).
 *
 * Tiempo determinista: window.__cinematicBH.renderAt(t) ∈ [0, 30].
 * El tiempo vive en un ref (escrito síncronamente por renderAt) para que el loop
 * de useFrame nunca dependa de un closure de estado desactualizado. getT() lee
 * ese ref → la cámara con peso queda 100% reproducible frame a frame.
 */

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import BHRaytraced from '@/labs/components/BHRaytraced';
import { makeRenderer } from '@/lib/webgl-fallback';
import CinematicPostFX from './CinematicPostFX';
import ScaleReference from './ScaleReference';
import {
  spherical, lerp, smooth, smootherstep, easeExp,
  WeightedRig, type CameraState, type Vec3,
} from './CinematicCamera';

const RS = 1.0;

/**
 * Parámetros de cámara/escena por URL (?mode=&az=&el=&d=&fov=&incl=&dur=&sweep=).
 * Leídos UNA sola vez al cargar → renderAt sigue siendo función PURA de t. Permite
 * generar MUCHOS reels de Gargantua con vantage distinto desde el MISMO build, sin
 * recompilar (cada render = una URL con query distinto). Sin query = el plano
 * "caída" original idéntico.
 */
function readCamParams() {
  const q =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams('');
  const n = (k: string, d: number) => {
    const v = parseFloat(q.get(k) ?? '');
    return Number.isFinite(v) ? v : d;
  };
  const mode = q.get('mode') || 'fall';
  return {
    mode: (['fall', 'orbit', 'pull', 'push'].includes(mode) ? mode : 'fall') as
      | 'fall'
      | 'orbit'
      | 'pull'
      | 'push',
    az: n('az', -0.55), // azimut base (rad) — desde qué lado se ve
    el: n('el', 40), // elevación (°): ~10 edge-on "ceja", ~60 de frente (anillo lensado)
    d: n('d', 70), // distancia base (·rs)
    fov: n('fov', 40), // campo de visión (°)
    incl: n('incl', 90), // inclinación del disco (°)
    dur: n('dur', 30), // duración del programa (s) — reels cortos = 12
    sweep: n('sweep', 1.0), // barrido de azimut a lo largo del plano (rad)
  };
}
const CAM = readCamParams();
const DURATION = Math.max(2, CAM.dur);

/**
 * Programa de cámara — caída continua far→near, ahora PESADA y lenta.
 *
 *   distancia : caída exponencial 130·rs → 40·rs (easeExp k<0 = se frena al
 *               final, sensación de masa que cuesta acercarse).
 *   elevación : alta (disco abierto, anillo lensado) → baja (edge-on, "ceja").
 *               Siempre >~24° para no rasar el disco y perder la composición.
 *   azimut    : órbita lenta para parallax (más lenta que antes).
 *   fov       : 44° → 33° (push sutil), pero al FINAL Gargantua se sale del
 *               encuadre porque el sujeto se desplaza fuera del centro: el
 *               target se corre hacia abajo-derecha → "no cabe = es enorme".
 *
 * Función PURA de t. El PESO (micro-shake + inercia) lo añade el WeightedRig.
 */
function cameraProgram(t: number): CameraState {
  const p = t / DURATION; // 0..1

  // ORBIT: distancia y elevación FIJAS, el azimut barre → plano contemplativo.
  // Con sweep=2π el último frame == el primero = LOOP perfecto. La asimetría
  // Doppler del disco (lado que se acerca = más brillante) gira en el cuadro.
  if (CAM.mode === 'orbit') {
    const dist = CAM.d * RS;
    const azim = CAM.az + p * CAM.sweep;
    const pos = spherical(azim, (CAM.el * Math.PI) / 180, dist);
    return { pos, target: [0, 0, 0], fov: CAM.fov };
  }

  // PULL: reveal cerca→lejos (la joya emerge del cosmos) + leve parallax.
  if (CAM.mode === 'pull') {
    const dist = lerp(CAM.d * 0.42, CAM.d, smootherstep(p)) * RS;
    const azim = CAM.az + p * CAM.sweep * 0.5;
    const pos = spherical(azim, (CAM.el * Math.PI) / 180, dist);
    return { pos, target: [0, 0, 0], fov: CAM.fov };
  }

  // PUSH: empuje lejos→cerca suave (sin la salida de cuadro del modo fall).
  if (CAM.mode === 'push') {
    const dist = lerp(CAM.d, CAM.d * 0.5, smootherstep(p)) * RS;
    const azim = CAM.az + p * CAM.sweep * 0.5;
    const elev = lerp(CAM.el + 8, CAM.el - 8, smooth(p));
    const pos = spherical(azim, (elev * Math.PI) / 180, dist);
    return { pos, target: [0, 0, 0], fov: lerp(CAM.fov + 3, CAM.fov - 4, smooth(p)) };
  }

  // FALL (default): caída exponencial far→near con CAM como punto medio + salida
  // de cuadro al final (escala por "no cabe"). easeExp k<0 = se frena al final.
  const d0 = CAM.d * 1.85, d1 = CAM.d * 0.57;
  const dEase = easeExp(smootherstep(p), -2.2);
  const dist = d0 * Math.pow(d1 / d0, dEase) * RS;
  const elev = lerp(CAM.el + 14, CAM.el - 14, smooth(p)); // disco abierto → edge-on
  const azim = CAM.az + p * 1.15;
  const fov = lerp(CAM.fov + 4, CAM.fov - 7, smooth(p));
  const pos = spherical(azim, (elev * Math.PI) / 180, dist);
  // Target: centrado el 72% del plano (recorte 9:16 seguro) y al final DESLIZA
  // fuera del centro → Gargantua sale del encuadre (escala por "no cabe").
  const exit = smootherstep((p - 0.72) / 0.28);
  const target: Vec3 = [exit * dist * 0.16, exit * dist * -0.1, 0];
  return { pos, target, fov };
}

export default function CinematicGargantua() {
  const timeRef = useRef(0);
  const [animTime, setAnimTime] = useState(0);

  useEffect(() => {
    const api = {
      renderAt: (t: number) => {
        const c = Math.max(0, Math.min(DURATION, t));
        timeRef.current = c;     // cámara + ScaleReference: síncrono, sin closure
        setAnimTime(c);          // disco: prop a BHRaytraced (animación determinista)
      },
      ready: true,
      duration: DURATION,
      // t expuesto para que el WeightedRig (getT) y cualquier consumidor lean el
      // MISMO tiempo determinista. Se mantiene en sync con timeRef.
      get t() { return timeRef.current; },
    };
    (window as unknown as { __cinematicBH: typeof api }).__cinematicBH = api;
    return () => {
      delete (window as unknown as { __cinematicBH?: unknown }).__cinematicBH;
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas
        frameloop="always"
        camera={{ position: [0, 40, 130], fov: 44, near: 0.01, far: 600 }}
        // Calidad de cine: antialias ON. El techo de dpr sube (el supersample
        // fuerte lo hace el script de render offline). makeRenderer mantiene el
        // fallback WebGL del proyecto.
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={[1.5, 2]}
        onCreated={({ gl }) => {
          // NoToneMapping: el tonemap ACES lo aplica el postFX UNA sola vez
          // (BHRaytraced emite HDR lineal con linearOutput). Cero doble tonemap.
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        {/* Cámara con PESO: el programa puro de arriba + micro-shake determinista
            + inercia. getT lee el t del renderAt → reproducible frame a frame.
            Amplitudes en unidades de mundo: pequeñas frente a dist ~40-130, se
            sienten como una grúa pesada, no como nervios. lag = arrastre. */}
        <WeightedRig
          programAt={cameraProgram}
          getT={() => timeRef.current}
          dt={1 / 60}
          lag={0.55}
          posAmp={0.65}
          targetAmp={0.40}
        />

        {/* Sujeto: el agujero negro raytrace. linearOutput → NO hace ACES inline
            (el postFX tonemap-ea). nebulaBoost levanta el fondo lensado para dar
            planos/parallax; chromaticAberration sutil en los bordes muy lensados.
            Físicamente intacto: rs, T∝r^-¾, Doppler δ⁴, photon ring √27/2·rs. */}
        <BHRaytraced
          rs={RS}
          rIn={2.5}
          rOut={14.0}
          inclinationDeg={CAM.incl}   /* disco en plano XZ (default 90); ?incl varía el ladeo */
          diskOpacity={1.0}
          dopplerStrength={1.0}
          starDensity={0.6}
          starSeed={1.7}
          diskTint="#FFE0A0"
          photonRing
          animTime={animTime}
          linearOutput
          exposure={1.5}
          nebulaBoost={0.8}
          chromaticAberration={0.0}
        />

        {/* Referencia de escala: sonda diminuta a la deriva cerca del horizonte.
            MISMO t determinista (timeRef). Mota apenas reconocible como artificial
            → magnitud + parallax instantáneos. Sus balizas emiten HDR (el postFX
            las tonemap-ea, el Bloom las hace pulsar). */}
        <ScaleReference
          t={animTime}
          scale={0.9}
          emissiveColor="#ffd2a0"
          seed={7}
          path={{
            center: [9.5, 2.2, -4.5],
            amplitude: [1.6, 0.9, 1.2],
            speed: [0.012, 0.017, 0.010],
            drift: [-0.05, 0.012, 0.02],
            tumble: [0.05, 0.018, 0.03],
          }}
        />

        {/* Postproceso cinematográfico — hermano de la escena 3D (igual que
            DynamicPostFX en CinematicAtom). Preset 'bh': Bloom threshold BAJO
            (photon ring revienta), DOF, aberración cromática, grano, viñeta,
            flare anamórfico. Hace el ÚNICO tonemap ACES del pipeline.
            DOF: foco profundo (~el sujeto central a media distancia) para que el
            anillo quede nítido y los planos lejanos/cercanos se separen. */}
        <CinematicPostFX
          preset="bh"
          bloomThreshold={0.12}
          dofBokehScale={0}
          anamorphic
        />
      </Canvas>
    </div>
  );
}
