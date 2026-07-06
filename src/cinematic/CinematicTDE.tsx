/**
 * CinematicTDE — "LA CENA DEL MONSTRUO": un agujero negro devorando una estrella.
 * Primera monstruosidad del catálogo (docs/FILOSOFIA-CINE.md §5).
 *
 * Una sola toma continua que CONTEMPLA (la narración/caption informa): la estrella
 * cae hacia el BH → cruza el radio de marea → se ESPAGUETIFICA en una corriente que
 * se enrosca y ENCIENDE el disco → fogonazo de acreción. Cámara edge-on (incl ~76°)
 * para que el beaming δ⁴ se LEA y la lente doble el disco; push-in lento conforme
 * crece la violencia (la velocidad/poder se SIENTE por el beaming + la espiral, no
 * por marear). Escala: la estrella entera siendo desgarrada da la referencia; el
 * starfield da parallax.
 *
 * Determinista: window.__cinematicTDE.renderAt(t) PURO en t. CinematicPostFX preset
 * 'bh' (bloom de threshold bajo → los picos REVIENTAN; un solo ACES). Parametrizable
 * por URL (?incl=&dur=&az=&d=&dop=&str=) — un build, muchos encuadres para la farm.
 */
import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';
import CinematicPostFX from './CinematicPostFX';
import BHDevour from './BHDevour';
import { spherical, lerp, smooth, WeightedRig, type CameraState, type Vec3 } from './CinematicCamera';

function readParams() {
  const q = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search) : new URLSearchParams('');
  const n = (k: string, d: number) => {
    const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? v : d;
  };
  return {
    incl: n('incl', 76),      // edge-on: beaming visible + lente dobla el disco
    dur: n('dur', 18),        // duración (s)
    az0: n('az', -0.5),       // azimut inicial (rad)
    sweep: n('sweep', 0.7),   // barrido azimutal total (rad)
    d0: n('d', 50),           // distancia inicial (·rs)
    d1: n('d1', 38),          // distancia final (push-in suave; no aplastar la estructura)
    dop: n('dop', 1.0),       // fuerza del beaming Doppler (1 = físico δ⁴)
    str: n('str', 7.0),       // estiramiento de la espaguetificación
  };
}
const PAR = readParams();
const DURATION = Math.max(2, PAR.dur);

// EL VIAJE — vuelo continuo de cámara (el disco vive en el plano XZ, normal +Y, así
// que phi = ángulo SOBRE el plano: phi→0 = edge-on/adentro, phi alto = picado).
// 4 actos: (1) wide edge-on GIGANTE, (2) descenso rasante al plasma, (3) PLUNGE
// ADENTRO del disco (partícula en el infierno), (4) pull-back que REVELA la escala.
function cameraProgram(t: number): CameraState {
  const p = t / DURATION;
  const azim = PAR.az0 + 0.55 * smooth(p);   // deriva azimutal lenta = parallax
  let dist: number, phiDeg: number, fov: number;
  if (p < 0.27) {                            // (1) establecer: disco gigante edge-on, lejos
    const s = smooth(p / 0.27);
    dist = lerp(62, 34, s); phiDeg = lerp(17, 10, s); fov = lerp(36, 42, s);
  } else if (p < 0.5) {                      // (2) descenso rasante a la superficie del plasma
    const s = smooth((p - 0.27) / 0.23);
    dist = lerp(34, 11, s); phiDeg = lerp(10, 3.0, s); fov = lerp(42, 58, s);
  } else if (p < 0.7) {                      // (3) PLUNGE: ADENTRO del disco, plasma rodeando, sombra encima
    const s = smooth((p - 0.5) / 0.2);
    dist = lerp(11, 6.4, s); phiDeg = lerp(3.0, 1.3, s); fov = lerp(58, 72, s);
  } else {                                   // (4) pull-back REVEAL: salir y subir → la escala completa
    const s = smooth((p - 0.7) / 0.3);
    dist = lerp(6.4, 54, s); phiDeg = lerp(1.3, 28, s); fov = lerp(72, 38, s);
  }
  const pos = spherical(azim, (phiDeg * Math.PI) / 180, dist);
  const target: Vec3 = [0, 0, 0];
  return { pos, target, fov };
}

export default function CinematicTDE() {
  const timeRef = useRef(0);
  useEffect(() => {
    // Cadena de beats para render-bh-comercial.cjs (worker con GPU FRESCA por beat
    // → cero fuga de VRAM a 4K). Una toma continua partida en chunks de ~3s; el
    // grade DaVinci es idéntico entre beats (look consistente, frameOffset da el grano).
    const N = 6;
    const beats = Array.from({ length: N }, (_, i) => ({
      id: `tde_${String(i).padStart(2, '0')}`,
      start: (i * DURATION) / N,
      end: ((i + 1) * DURATION) / N,
      kind: 'cine',
    }));
    const api = {
      renderAt: (t: number) => { timeRef.current = Math.max(0, Math.min(DURATION, t)); },
      ready: true, duration: DURATION, beats,
      get t() { return timeRef.current; },
    };
    (window as unknown as { __cinematicTDE: typeof api }).__cinematicTDE = api;
    return () => { delete (window as unknown as { __cinematicTDE?: unknown }).__cinematicTDE; };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas
        frameloop="always"
        camera={{ position: [0, 10, 46], fov: 40, near: 0.01, far: 600 }}
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={[1.5, 2]}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; }}
      >
        <WeightedRig programAt={cameraProgram} getT={() => timeRef.current} dt={1 / 60}
          lag={0.35} posAmp={0.1} targetAmp={0.05} />
        <BHDevour
          rs={1} rIn={2.6} rOut={13} rStart={15} rTidal={7} starR={1.7}
          stretch={PAR.str} windings={1.6} duration={DURATION}
          inclinationDeg={90} dopplerStrength={PAR.dop}
          getTime={() => timeRef.current} exposure={0.92} maxSteps={190}
          linearOutput starSeed={3.0} />
        <CinematicPostFX preset="tde" />
      </Canvas>
    </div>
  );
}
