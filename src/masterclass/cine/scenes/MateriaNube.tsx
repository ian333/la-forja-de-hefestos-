/**
 * MateriaNube — TODA la cosecha de la granja en 3D estilo O₂ (Ian: "hazlos 3d
 * como o2 n2 h2, li2 c2 — con los mismos colores").
 *
 * UNA escena genérica: ?sys=<name> elige el .bin (public/precomputed/materia/),
 * producido por precompute-materia-particulas.py con el MISMO método del O₂
 * viral (campos ab initio → inverse-CDF → partículas lagrangianas).
 *
 * Shader = O2FLOW (gaussiano procedural + vNear) + MOVIMIENTO CUÁNTICO de
 * CinematicAtom (breath/swirl/flicker conservando |ψ|²) — la lección del 0/10:
 * partículas quietas comunican "millones de electrones"; la probabilidad VIVE.
 *
 * 3 nubes por rol físico (colores EXACTOS del O₂):
 *   acc  oro→ámbar (corazones ORO BLANCO, del .bin) — la carga acumulada
 *   dep  azul profundo [0.18,0.42,0.95] — el vaciado
 *   spin violeta [0.80,0.34,1.0] — el electrón desapareado (si-boro: EL HUECO)
 *
 * 24 s contemplativos (serie de átomos): nace ardiendo (sin fade: doctrina),
 * la cámara entra, orbita, sale. Loop limpio.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCineTime } from '../useCineTime';

export const T = { dentro: 6.0, vaciado: 10.0, extra: 15.0, salida: 19.0, fin: 24.0 };

export const SYS_INFO: Record<string, { name: string; sub: string }> = {
  'si-boro':      { name: 'El hueco',     sub: 'silicio + boro · tipo-p' },
  'c-diamante':   { name: 'El diamante',  sub: 'carbono · el enlace más denso' },
  'nacl':         { name: 'La sal',       sub: 'NaCl · el robo de carga' },
  'mgo':          { name: 'El aislante',  sub: 'MgO · iónico' },
  'na-metal':     { name: 'El metal',     sub: 'sodio · mar de electrones' },
  'capacitor-h2o':         { name: 'El agua',   sub: 'polarizada en campo E' },
  'capacitor-diacetileno': { name: 'El alambre', sub: 'diacetileno en campo E' },
};
for (const n of [2,4,6,8,10]) SYS_INFO[`cadena-h${n}`] = { name: `H${n}`, sub: `${n} átomos apilados` };
for (const n of [2,4,6,8]) SYS_INFO[`cadena-li${n}`] = { name: `Li${n}`, sub: `${n} átomos · casi metal` };
for (const n of [1,2,3,4]) SYS_INFO[`cadena-poliino${n}`] = { name: `Poliino ${n}`, sub: 'el alambre de carbono' };

export function sysParam(): string {
  return new URLSearchParams(window.location.search).get('sys') || 'nacl';
}

// ── shader del O₂ + vida cuántica (idéntico al validado en SilicioNube) ──
const FLOW_VERT = /* glsl */ `
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vNear;
  varying float vPulse;
  uniform float uSize;
  uniform float uTime;
  void main() {
    vColor = aColor;
    float ph = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831853;
    vec3 p = position;
    float r = length(p) + 1e-4;
    vec3 radial = p / r;
    vec3 tang = normalize(vec3(-p.z, 0.0, p.x) + vec3(1e-4));
    float breath = sin(uTime * 1.4 + ph);
    float swirl  = sin(uTime * 0.9 + ph * 1.7);
    p += radial * (0.055 * r * breath) + tang * (0.070 * r * swirl);
    float u = fract(ph * 0.15915494);
    float rate = 0.5 + 0.8 * u;
    float life = fract(uTime * rate + u);
    float flick = smoothstep(0.0, 0.25, life) * (1.0 - smoothstep(0.55, 1.0, life));
    vPulse = 0.42 + 0.58 * flick;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNear = smoothstep(0.22, 0.85, -mv.z);
    gl_PointSize = min(uSize * (300.0 / -mv.z) * (0.75 + 0.5 * vPulse), 64.0);
    gl_Position = projectionMatrix * mv;
  }`;
const FLOW_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vNear;
  varying float vPulse;
  uniform float uBright;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vNear * vPulse;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * a * uBright, a);
  }`;

type Nubes = {
  accPos: Float32Array; accCol: Float32Array;
  depPos: Float32Array; spinPos: Float32Array;
  nAcc: number; nDep: number; nSpin: number;
};

function useNubes(sys: string): Nubes | null {
  const [d, setD] = useState<Nubes | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/precomputed/materia/${sys}-particulas.bin`)
      .then(r => { if (!r.ok) throw new Error(`bin ${r.status}`); return r.arrayBuffer(); })
      .then(buf => {
        if (!alive) return;
        const dv = new DataView(buf);
        const nAcc = dv.getInt32(0, true), nDep = dv.getInt32(4, true), nSpin = dv.getInt32(8, true);
        let o = 16;
        const cb = new Uint8Array(buf.slice(o, o + nAcc * 3)); o += nAcc * 3;
        const accCol = new Float32Array(nAcc * 3);
        for (let i = 0; i < nAcc * 3; i++) accCol[i] = cb[i] / 255;
        const accPos = new Float32Array(buf.slice(o, o + nAcc * 12)); o += nAcc * 12;
        const depPos = new Float32Array(buf.slice(o, o + nDep * 12)); o += nDep * 12;
        const spinPos = new Float32Array(buf.slice(o, o + nSpin * 12));
        setD({ accPos, accCol, depPos, spinPos, nAcc, nDep, nSpin });
        // contrato con render-clase.cjs (espera __nebulaReady antes del frame 0)
        (window as any).__nebulaReady = true;
      })
      .catch(e => console.error('[MateriaNube] bin:', e));
    return () => { alive = false; };
  }, [sys]);
  return d;
}

function Nube({ pos, col, n, bright, size }:
  { pos: Float32Array; col: Float32Array; n: number; bright: number; size: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return g;
  }, [pos, col]);
  const uni = useMemo(() => ({
    uSize: { value: size }, uBright: { value: bright }, uTime: { value: 0 },
  }), []);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    mat.current.uniforms.uBright.value = bright;
    mat.current.uniforms.uSize.value = size;
    mat.current.uniforms.uTime.value = clock.elapsedTime;
  });
  if (n === 0) return null;
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} uniforms={uni} vertexShader={FLOW_VERT} fragmentShader={FLOW_FRAG}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export default function MateriaNube() {
  const sys = useMemo(() => sysParam(), []);
  const d = useNubes(sys);
  const tRef = useCineTime();
  const { camera } = useThree();
  const grp = useRef<THREE.Group>(null);
  const [br, setBr] = useState({ acc: 0.5, dep: 0, spin: 0 });

  const depCol = useMemo(() => {
    if (!d) return new Float32Array(0);
    const c = new Float32Array(d.nDep * 3);
    for (let i = 0; i < d.nDep; i++) { c[i*3] = 0.18; c[i*3+1] = 0.42; c[i*3+2] = 0.95; }
    return c;
  }, [d]);
  const spinCol = useMemo(() => {
    if (!d) return new Float32Array(0);
    const c = new Float32Array(d.nSpin * 3);
    for (let i = 0; i < d.nSpin; i++) { c[i*3] = 0.80; c[i*3+1] = 0.34; c[i*3+2] = 1.0; }
    return c;
  }, [d]);

  useFrame(() => {
    const t = tRef.current;
    // sin fade desde negro (doctrina): el oro ARDE en el frame 0
    const acc = 0.50;
    const dep = 0.26 * THREE.MathUtils.smoothstep(t, T.vaciado, T.vaciado + 2.5);
    // el espín (si existe: EL HUECO del boro) es el clímax
    const spin = 0.62 * THREE.MathUtils.smoothstep(t, T.extra, T.extra + 2.5);
    setBr({ acc, dep, spin });
    if (grp.current) grp.current.rotation.y = t * 0.17;
    let dist: number, alt = 0.22;
    if (t < T.dentro) {
      dist = 11.5 - 6.0 * THREE.MathUtils.smoothstep(t, 0, T.dentro);
    } else if (t < T.extra) {
      dist = 5.5 - 2.4 * THREE.MathUtils.smoothstep(t, T.dentro, T.extra);   // DENTRO
    } else if (t < T.salida) {
      dist = 3.1 + 1.6 * THREE.MathUtils.smoothstep(t, T.extra, T.salida);
      alt = 0.30;
    } else {
      dist = 4.7 + 5.2 * THREE.MathUtils.smoothstep(t, T.salida, T.fin);
      alt = 0.26;
    }
    const a = 0.6 + t * 0.10;
    camera.position.set(Math.sin(a) * dist, dist * alt, Math.cos(a) * dist);
    camera.lookAt(0, 0, 0);
  });

  if (!d) return null;
  return (
    <group ref={grp}>
      <Nube pos={d.accPos} col={d.accCol} n={d.nAcc} bright={br.acc} size={0.20} />
      <Nube pos={d.depPos} col={depCol} n={d.nDep} bright={br.dep} size={0.17} />
      <Nube pos={d.spinPos} col={spinCol} n={d.nSpin} bright={br.spin} size={0.22} />
    </group>
  );
}
