// WaterMD.tsx — renderer del auto-ensamble del agua (lee public/precomputed/water-md.bin,
// formato MDW2 de scripts/md-water.py). 10 moléculas se buscan y se pegan SOLAS por sus
// campos eléctricos; la forma EMERGE (nada pre-seteado). Paleta = agua v2: ORO + MORADO
// (los pares libres), NADA de cian. La nube ab initio SIGUE a cada átomo → vibra. El campo
// eléctrico se recalculó por frame en Python → aquí baila con el pulso del δ+ al δ−.
//
// Todo determinista en `time` (render headless 4K: renderAt(t) puro).
import * as THREE from 'three';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';

type Vec3 = [number, number, number];

// ── geometría del template (misma que water_template en el .py) ──────────────
const R0_OH = 0.9578;
const HALF = (104.478 / 2) * Math.PI / 180;
const O_TMPL: Vec3 = [0, 0, 0];
const H1_TMPL: Vec3 = [R0_OH * Math.sin(HALF), R0_OH * Math.cos(HALF), 0];
const H2_TMPL: Vec3 = [-R0_OH * Math.sin(HALF), R0_OH * Math.cos(HALF), 0];
const ATOM_TMPL: Vec3[] = [O_TMPL, H1_TMPL, H2_TMPL];

// paleta v2 del agua (idéntica a h2o v2)
const GOLD: Vec3 = [1.0, 0.72, 0.30];
const PURPLE: Vec3 = [0.82, 0.28, 1.0];      // pares libres / lóbulos
const FIELD_COL: Vec3 = [0.72, 0.42, 1.0];   // campo eléctrico violeta (combina, no cian)

interface MDData {
  NFR: number; NMOL: number; NL: number; LP: number; NCLD: number; NAT: number;
  POSQ: number; Thi: number; Tlo: number;
  cloud: Float32Array; anchor: Int8Array; traj: Float32Array; fields: Float32Array;
  ex: number; exEarly: number; exLate: number;
}

// percentil p (0..1) de |átomo| en un frame → extensión robusta (ignora la evaporada)
function frameExtent(traj: Float32Array, NAT: number, frame: number, p: number): number {
  const b = frame * NAT * 3; const d: number[] = [];
  for (let a = 0; a < NAT; a++) d.push(Math.hypot(traj[b + a * 3], traj[b + a * 3 + 1], traj[b + a * 3 + 2]));
  d.sort((x, y) => x - y);
  return d[Math.min(d.length - 1, Math.floor(p * d.length))];
}

export function parseMD(buf: ArrayBuffer): MDData {
  const dv = new DataView(buf);
  // magic 'MDW2' (4 bytes) + 6 int32
  let off = 4;
  const rdi = () => { const v = dv.getInt32(off, true); off += 4; return v; };
  const NFR = rdi(), NMOL = rdi(), NL = rdi(), LP = rdi(), NCLD = rdi(), NAT = rdi();
  const POSQ = dv.getFloat32(off, true); off += 4;
  const Thi = dv.getFloat32(off, true); off += 4;
  const Tlo = dv.getFloat32(off, true); off += 4;
  const inv = 1 / POSQ;
  const rd16 = (n: number) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) { a[i] = dv.getInt16(off, true) * inv; off += 2; } return a; };
  const cloud = rd16(NCLD * 3);
  const anchor = new Int8Array(NCLD); for (let i = 0; i < NCLD; i++) { anchor[i] = dv.getInt8(off); off += 1; }
  const traj = rd16(NFR * NAT * 3);
  const fields = rd16(NFR * NL * LP * 3);
  // extensión máxima (fallback) + robustas por-frame (encuadre que LLENA, ignora la evaporada)
  let ex = 1;
  for (let i = 0; i < traj.length; i += 3) ex = Math.max(ex, Math.hypot(traj[i], traj[i + 1], traj[i + 2]));
  const exEarly = frameExtent(traj, NAT, 0, 0.9);
  const exLate = frameExtent(traj, NAT, NFR - 1, 0.82);   // cluster ensamblado (excluye la evaporada)
  return { NFR, NMOL, NL, LP, NCLD, NAT, POSQ, Thi, Tlo, cloud, anchor, traj, fields, ex, exEarly, exLate };
}

// ── shader de nube aditiva (puntos suaves billboard) ─────────────────────────
const PT_VERT = `
  attribute vec3 aColor;
  varying vec3 vColor;
  uniform float uSize; uniform float uBright;
  void main(){
    vColor = aColor * uBright;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (330.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const PT_FRAG = `
  varying vec3 vColor;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    float a = exp(-dot(d, d) * 7.0);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * a, a);
  }`;

// ── shader de líneas de campo con FLUJO (pulso del δ+ al δ−) ──────────────────
const FL_VERT = `attribute float aU; varying float vU;
  void main(){ vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FL_FRAG = `varying float vU; uniform float uT; uniform float uOp; uniform vec3 uCol;
  void main(){
    float flow = fract(vU * 2.2 - uT * 0.55);
    float p = 0.30 + 0.85 * smoothstep(0.0, 0.22, flow) * (1.0 - smoothstep(0.5, 0.95, flow));
    gl_FragColor = vec4(uCol * p * uOp * 2.2, p * uOp);
  }`;

// mezcla lineal de dos colores
function mix3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t);
}

// ── la nube de las 10 moléculas: UNA geometría grande, posiciones recomputadas
//    por frame (cada punto sigue a SU átomo → vibra). Color baked una vez. ────
function MoleculeClouds({ wd, atoms, bright }: { wd: MDData; atoms: Float32Array; bright: number }) {
  // offsets de cada punto respecto a su átomo ancla (marco molecular) + color baked
  const { geo, offsets, anchors } = useMemo(() => {
    const N = wd.NCLD, M = wd.NMOL;
    const offs = new Float32Array(N * 3);
    const anch = new Int8Array(N);
    for (let i = 0; i < N; i++) {
      const k = wd.anchor[i]; anch[i] = k; const a = ATOM_TMPL[k];
      offs[i * 3] = wd.cloud[i * 3] - a[0];
      offs[i * 3 + 1] = wd.cloud[i * 3 + 1] - a[1];
      offs[i * 3 + 2] = wd.cloud[i * 3 + 2] - a[2];
    }
    // color por punto: O en el lado de los pares libres (y<0) = MORADO, hacia los H = ORO.
    // ADELGAZAR el núcleo: los puntos densos pegados al O (rad chico) se atenúan → no
    // revientan a blanco (tema v2); los lóbulos (rad medio) quedan brillantes.
    const colOne: Vec3[] = [];
    for (let i = 0; i < N; i++) {
      if (wd.anchor[i] === 0) {
        const y = wd.cloud[i * 3 + 1];
        const rad = Math.hypot(wd.cloud[i * 3], y, wd.cloud[i * 3 + 2]);
        const dim = 0.30 + 0.70 * smoothstep(0.18, 0.78, rad);
        const c = mix3(PURPLE, GOLD, smoothstep(-0.15, 0.55, y));
        colOne.push([c[0] * dim, c[1] * dim, c[2] * dim]);
      } else colOne.push(GOLD);
    }
    const pos = new Float32Array(N * M * 3);
    const col = new Float32Array(N * M * 3);
    for (let m = 0; m < M; m++) {
      for (let i = 0; i < N; i++) {
        const c = colOne[i]; const j = (m * N + i) * 3;
        col[j] = c[0]; col[j + 1] = c[1]; col[j + 2] = c[2];
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return { geo: g, offsets: offs, anchors: anch };
  }, [wd]);

  const uniforms = useMemo(() => ({ uSize: { value: 0.24 }, uBright: { value: bright } }), []);
  uniforms.uBright.value = bright;

  // recomputar posiciones cada vez que cambian los átomos (determinista en time)
  useLayoutEffect(() => {
    const N = wd.NCLD, M = wd.NMOL;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
    const u1 = new THREE.Vector3(), u2 = new THREE.Vector3();
    const O = new THREE.Vector3(), aw = new THREE.Vector3(), tmp = new THREE.Vector3();
    const atomW: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let m = 0; m < M; m++) {
      const b = m * 3 * 3;
      O.set(atoms[b], atoms[b + 1], atoms[b + 2]);
      atomW[0].copy(O);
      atomW[1].set(atoms[b + 3], atoms[b + 4], atoms[b + 5]);
      atomW[2].set(atoms[b + 6], atoms[b + 7], atoms[b + 8]);
      // marco molecular actual: Y=bisectriz, Z=normal al plano, X=Y×Z
      u1.copy(atomW[1]).sub(O).normalize();
      u2.copy(atomW[2]).sub(O).normalize();
      Y.copy(u1).add(u2).normalize();
      Z.copy(u1).cross(u2).normalize();
      X.copy(Y).cross(Z).normalize();
      for (let i = 0; i < N; i++) {
        const k = anchors[i]; aw.copy(atomW[k]);
        const ox = offsets[i * 3], oy = offsets[i * 3 + 1], oz = offsets[i * 3 + 2];
        // world = atom_k + R·offset   (R columnas X,Y,Z)
        tmp.set(X.x * ox + Y.x * oy + Z.x * oz,
                X.y * ox + Y.y * oy + Z.y * oz,
                X.z * ox + Y.z * oy + Z.z * oz).add(aw);
        const j = (m * N + i) * 3;
        P[j] = tmp.x; P[j + 1] = tmp.y; P[j + 2] = tmp.z;
      }
    }
    pos.needsUpdate = true;
  }, [atoms, geo, wd, offsets, anchors]);

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial args={[{ uniforms, vertexShader: PT_VERT, fragmentShader: PT_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }]} />
    </points>
  );
}

// ── cores del centro: puntos glow SUAVES (mismo shader aditivo que la nube) en
//    cada átomo. NO esferas sólidas (eso rompía el estilo v1/v2) — solo un centro
//    luminoso oro (H) / morado (O) que define la molécula sin "bola de plástico". ─
function CloudCores({ wd, atoms, bright }: { wd: MDData; atoms: Float32Array; bright: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(wd.NAT * 3);
    const col = new Float32Array(wd.NAT * 3);
    for (let a = 0; a < wd.NAT; a++) {
      const c = a % 3 === 0 ? PURPLE : GOLD;
      col[a * 3] = c[0]; col[a * 3 + 1] = c[1]; col[a * 3 + 2] = c[2];
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return g;
  }, [wd]);
  const uniforms = useMemo(() => ({ uSize: { value: 0.5 }, uBright: { value: bright } }), []);
  uniforms.uBright.value = bright * 1.5;   // el centro un poco más brillante que el polvo
  useLayoutEffect(() => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    for (let i = 0; i < wd.NAT * 3; i++) P[i] = atoms[i];
    pos.needsUpdate = true;
  }, [atoms, geo, wd]);
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial args={[{ uniforms, vertexShader: PT_VERT, fragmentShader: PT_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }]} />
    </points>
  );
}

// ── campo eléctrico: NL líneas × LP puntos, recomputadas por frame ───────────
function FieldLines({ wd, fieldFrame, time, reveal }: { wd: MDData; fieldFrame: Float32Array; time: number; reveal: number }) {
  const { geo, mat } = useMemo(() => {
    const seg = wd.LP - 1; const nv = wd.NL * seg * 2;
    const pos = new Float32Array(nv * 3); const us = new Float32Array(nv);
    let uo = 0;
    for (let j = 0; j < wd.NL; j++) for (let s = 0; s < seg; s++) { us[uo++] = s / seg; us[uo++] = (s + 1) / seg; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aU', new THREE.BufferAttribute(us, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uOp: { value: 1 }, uCol: { value: new THREE.Color(...FIELD_COL) } },
      vertexShader: FL_VERT, fragmentShader: FL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    return { geo: g, mat: m };
  }, [wd]);

  useLayoutEffect(() => {
    const seg = wd.LP - 1;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const P = pos.array as Float32Array; let o = 0;
    for (let j = 0; j < wd.NL; j++) {
      const b = j * wd.LP * 3;
      for (let s = 0; s < seg; s++) {
        const i0 = b + s * 3, i1 = b + (s + 1) * 3;
        P[o++] = fieldFrame[i0]; P[o++] = fieldFrame[i0 + 1]; P[o++] = fieldFrame[i0 + 2];
        P[o++] = fieldFrame[i1]; P[o++] = fieldFrame[i1 + 1]; P[o++] = fieldFrame[i1 + 2];
      }
    }
    pos.needsUpdate = true;
  }, [fieldFrame, geo, wd]);
  mat.uniforms.uT.value = time; mat.uniforms.uOp.value = reveal;
  return <lineSegments geometry={geo} material={mat} />;
}

// ── cámara con peso: arranca CERCA (se ven moléculas vibrando) → se abre al
//    cluster completo mientras se auto-ensambla. Determinista en time. ────────
function MDCamera({ time, exEarly, exLate, dur }: { time: number; exEarly: number; exLate: number; dur: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const k = Math.min(1, time / dur);
    const kEase = k * k * (3 - 2 * k);
    // órbita amplia + cambio de altura → el PARALLAX revela el volumen 3D REAL (el z de
    // la simulación), visto desde ángulos. El 3D no se pinta: se descubre moviéndose.
    const az = 0.3 + 2.1 * kEase + 0.10 * Math.sin(time * 0.22);
    const el = 0.08 + 0.44 * Math.sin(k * Math.PI * 0.9);
    // encuadre que LLENA (mandato PANTALLA COMPLETA): sigue la extensión del cluster
    // (disperso → ensamblado), con margen para el campo. ×1.5 = casi lleno, poco void.
    const framing = exEarly + (exLate - exEarly) * kEase;
    const dist = framing * (1.9 - 0.05 * Math.sin(k * Math.PI * 2));
    const cp = Math.cos(el);
    const pos: Vec3 = [dist * cp * Math.cos(az), dist * Math.sin(el), dist * cp * Math.sin(az)];
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 42; cam.near = Math.max(0.02, dist * 0.02); cam.far = 300; cam.updateProjectionMatrix();
  }, [time, exEarly, exLate, dur, camera]);
  return null;
}

export function WaterMD({ time, dur, onReady }: { time: number; dur: number; onReady?: (r: boolean) => void }) {
  const [wd, setWd] = useState<MDData | null>(null);
  useEffect(() => {
    let alive = true; setWd(null);
    fetch('/precomputed/water-md.bin').then(r => r.arrayBuffer())
      .then(buf => { if (alive) { setWd(parseMD(buf)); onReady?.(true); } })
      .catch(e => console.error('water-md load failed', e));
    return () => { alive = false; };
  }, [onReady]);

  // frame interpolado (600 datos → suave a cualquier fps)
  const { atoms, fieldFrame } = useMemo(() => {
    if (!wd) return { atoms: new Float32Array(0), fieldFrame: new Float32Array(0) };
    const ff = Math.min(1, Math.max(0, time / dur)) * (wd.NFR - 1);
    const f0 = Math.floor(ff), f1 = Math.min(wd.NFR - 1, f0 + 1), a = ff - f0;
    const na = wd.NAT * 3, nf = wd.NL * wd.LP * 3;
    const atoms = new Float32Array(na);
    for (let i = 0; i < na; i++) atoms[i] = wd.traj[f0 * na + i] * (1 - a) + wd.traj[f1 * na + i] * a;
    const fieldFrame = new Float32Array(nf);
    for (let i = 0; i < nf; i++) fieldFrame[i] = wd.fields[f0 * nf + i] * (1 - a) + wd.fields[f1 * nf + i] * a;
    return { atoms, fieldFrame };
  }, [wd, time, dur]);

  if (!wd) return null;
  const k = Math.min(1, time / dur);
  // brillo moderado: que el ORO+MORADO respiren, sin reventar el núcleo O a blanco (tema v2)
  const bright = 0.20 + 0.10 * (0.6 + 0.4 * Math.sin(time * 6.0));   // latido tenue de la densidad
  const reveal = Math.min(1, time / 0.4 + 0.5);
  void k;
  return (
    <>
      <MDCamera time={time} exEarly={wd.exEarly} exLate={wd.exLate} dur={dur} />
      <MoleculeClouds wd={wd} atoms={atoms} bright={bright} />
      <CloudCores wd={wd} atoms={atoms} bright={bright} />
      <FieldLines wd={wd} fieldFrame={fieldFrame} time={time} reveal={reveal} />
    </>
  );
}
