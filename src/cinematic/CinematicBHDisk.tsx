/**
 * CinematicBHDisk — disco de acreción de agujero negro como PARTÍCULAS físicas
 * (bh-disk-sim.py: Kepler + MRI vía operador cara-i). Vista edge-on: el gradiente de
 * temperatura (T∝r^−¾) + el beaming Doppler δ⁴ = el look del disco. (Sin lente aún;
 * la lente gravitacional se añade después — primer paso: el disco físico se LEE.)
 */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';
import CinematicPostFX from './CinematicPostFX';
import BHDiskParticles from './BHDiskParticles';
import { spherical, lerp, smooth, WeightedRig, type CameraState, type Vec3 } from './CinematicCamera';

function readParams() {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
  const n = (k: string, d: number) => { const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? v : d; };
  return { dur: n('dur', 18), incl: n('incl', 12), d0: n('d', 40), dop: n('dop', 1.0) };
}
const PAR = readParams();
const DURATION = Math.max(2, PAR.dur);

function Starfield() {
  const geo = useMemo(() => {
    const N = 1200; const pos = new Float32Array(N * 3); let s = 9931.0;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1, th = rnd() * 6.2832, rr = 90 + rnd() * 60, p = Math.sqrt(1 - u * u);
      pos[i*3] = rr*p*Math.cos(th); pos[i*3+1] = rr*u; pos[i*3+2] = rr*p*Math.sin(th);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, []);
  return <points geometry={geo}><pointsMaterial size={0.13} color="#cfe0ff" transparent opacity={0.7} sizeAttenuation toneMapped={false} /></points>;
}

function cameraProgram(t: number): CameraState {
  const p = t / DURATION;
  const dist = lerp(PAR.d0, PAR.d0 * 0.8, smooth(p));
  const azim = -0.5 + p * 1.0;
  const phi = (PAR.incl * Math.PI) / 180;     // bajo = edge-on
  return { pos: spherical(azim, phi, dist), target: [0, 0, 0] as Vec3, fov: lerp(40, 36, smooth(p)) };
}

export default function CinematicBHDisk() {
  const timeRef = useRef(0);
  useEffect(() => {
    const N = 6;
    const beats = Array.from({ length: N }, (_, i) => ({
      id: `bhd_${String(i).padStart(2, '0')}`, start: (i*DURATION)/N, end: ((i+1)*DURATION)/N, kind: 'cine',
    }));
    const api = { renderAt: (t: number) => { timeRef.current = Math.max(0, Math.min(DURATION, t)); },
      ready: true, duration: DURATION, beats, get t() { return timeRef.current; } };
    (window as unknown as { __cinematicBHDisk: typeof api }).__cinematicBHDisk = api;
    return () => { delete (window as unknown as { __cinematicBHDisk?: unknown }).__cinematicBHDisk; };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas frameloop="always" camera={{ position: [0, 6, 40], fov: 40, near: 0.01, far: 600 }}
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={[1.5, 2]} onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; }}>
        <WeightedRig programAt={cameraProgram} getT={() => timeRef.current} dt={1/60} lag={0.4} posAmp={0.06} targetAmp={0.03} />
        <Starfield />
        <BHDiskParticles url="/bh-disk.bin" scale={14} rs={2.0} size={1.8} exposure={0.035}
          dopplerStrength={PAR.dop} getTime={() => timeRef.current} />
        <CinematicPostFX preset="bh" />
      </Canvas>
    </div>
  );
}
