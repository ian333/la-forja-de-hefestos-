/**
 * DustFigure — PERSONA DE POLVO para las cápsulas cine (destilado del Sandman).
 *
 * El elenco de la serie: figuras humanas hechas de granos (mesh Mixamo riggeado,
 * muestreo de superficie ponderado por área + skinning CPU por frame → la figura
 * RESPIRA con el clip Idle). Se QUEDAN en pantalla; lo que viaja es la LUZ:
 *
 *   · Apagada: silueta azul-pizarra apenas visible contra la nebulosa.
 *   · igniteAt: una chispa nace en el PECHO y la figura se enciende de adentro
 *     hacia afuera (rampa ámbar→oro, radio creciente) + pointLight REAL para
 *     que los GLB vecinos reciban su luz. La idea es una persona iluminándose.
 *
 * Determinista: lee el reloj de la clase (useCineTime) y mixer.setTime(t) es
 * puro en t. Cada figura desfasa su Idle (idleOffset) para no respirar en coro.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useCineTime } from './useCineTime';

export interface DustFigureProps {
  url?: string;
  position?: [number, number, number];
  rotationY?: number;
  height?: number;
  grains?: number;
  igniteAt?: number;          // t de la chispa (Infinity = nunca)
  idleOffset?: number;        // desfase del clip Idle (que no respiren en coro)
  seed?: number;
  exposure?: number;
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

const VERT = /* glsl */ `
attribute float aJit;
uniform float uTime, uR, uPx, uRS, uExposure;
uniform vec3 uHeart;
varying vec3 vC; varying float vA;
void main(){
  float d = distance(position, uHeart);
  float ign = 1.0 - smoothstep(uR - 0.22, uR + 0.12, d);   // dentro del radio de la luz
  float heat = clamp(exp(-d * 0.9) * ign, 0.0, 1.0);
  vec3 cold  = vec3(0.055, 0.075, 0.135);                   // silueta azul-pizarra
  vec3 amber = vec3(1.0, 0.46, 0.11);
  vec3 gold  = vec3(1.0, 0.74, 0.30);                       // pico ORO saturado, no blanco
  vec3 c = mix(cold, mix(amber, gold, heat), ign);
  float tw = 0.82 + 0.18 * sin(uTime * (1.2 + aJit * 2.2) + aJit * 6.2831);
  vC = c * tw * uExposure;
  vA = 0.42 + 0.36 * ign;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min((1.15 + 0.75 * ign) * (uPx * uRS / -mv.z), 4.2 * uRS);
}`;
const FRAG = /* glsl */ `
precision highp float;
varying vec3 vC; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float a = exp(-r2 * 3.2);
  gl_FragColor = vec4(vC * (0.30 + 0.45 * vA) * a, a * vA);
}`;

interface FigRig {
  root: THREE.Object3D;
  holder: THREE.Group;
  meshes: THREE.SkinnedMesh[];
  mixer: THREE.AnimationMixer;
  clipDur: number;
  nVerts: number;
  skinned: Float32Array;
  lastT: number;
  ia: Uint32Array; ib: Uint32Array; ic: Uint32Array;
  wa: Float32Array; wb: Float32Array; wc: Float32Array;
  chest: THREE.Object3D | null;
}

function skinAll(rig: FigRig) {
  const v = new THREE.Vector3();
  let off = 0;
  for (const mesh of rig.meshes) {
    const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
    mesh.skeleton.update();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      mesh.applyBoneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld);
      const o = (off + i) * 3;
      rig.skinned[o] = v.x; rig.skinned[o + 1] = v.y; rig.skinned[o + 2] = v.z;
    }
    off += posAttr.count;
  }
}
function setRigTime(rig: FigRig, t: number) {
  const tc = ((t % rig.clipDur) + rig.clipDur) % rig.clipDur;
  if (rig.lastT === tc) return;
  rig.mixer.setTime(tc);
  rig.holder.updateMatrixWorld(true);
  skinAll(rig);
  rig.lastT = tc;
}

async function loadFigRig(url: string, pos: [number, number, number], rotY: number,
  height: number, grains: number, seed: number): Promise<FigRig> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh); });
  const mixer = new THREE.AnimationMixer(root);
  const clip = gltf.animations.find(a => a.name === 'Idle') ?? gltf.animations[0];
  mixer.clipAction(clip).play();

  let nVerts = 0;
  const vertOff: number[] = [];
  for (const m of meshes) { vertOff.push(nVerts); nVerts += (m.geometry.attributes.position as THREE.BufferAttribute).count; }

  // holder = transform de escena (posición/orientación de ESTA figura)
  const holder = new THREE.Group();
  holder.position.set(pos[0], pos[1], pos[2]);
  holder.rotation.y = rotY;
  holder.add(root);

  const rig: FigRig = {
    root, holder, meshes, mixer, clipDur: Math.max(0.5, clip.duration - 1e-3),
    nVerts, skinned: new Float32Array(nVerts * 3), lastT: -1,
    ia: new Uint32Array(grains), ib: new Uint32Array(grains), ic: new Uint32Array(grains),
    wa: new Float32Array(grains), wb: new Float32Array(grains), wc: new Float32Array(grains),
    chest: null,
  };
  root.traverse(o => { if (o.name === 'mixamorig:Spine2') rig.chest = o; });

  // normaliza EN ESPACIO LOCAL del holder: pies al piso, centro XZ, altura dada
  holder.position.set(0, 0, 0); holder.rotation.y = 0;
  setRigTime(rig, 0);
  let minY = 1e9, maxY = -1e9, cx = 0, cz = 0;
  for (let i = 0; i < nVerts; i++) {
    const y = rig.skinned[i * 3 + 1];
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    cx += rig.skinned[i * 3]; cz += rig.skinned[i * 3 + 2];
  }
  cx /= nVerts; cz /= nVerts;
  const s = height / Math.max(0.5, maxY - minY);
  root.scale.setScalar(s);
  root.position.set(-cx * s, -minY * s, -cz * s);
  holder.position.set(pos[0], pos[1], pos[2]);
  holder.rotation.y = rotY;
  rig.lastT = -1;
  setRigTime(rig, 0);

  // muestreo de superficie ponderado por área (semilla fija → determinista)
  const rnd = mulberry32(seed);
  const S = rig.skinned;
  const tris: { a: number; b: number; c: number; cum: number }[] = [];
  let acc = 0;
  for (let mi = 0; mi < meshes.length; mi++) {
    const g = meshes[mi].geometry;
    const idx = g.index as THREE.BufferAttribute;
    const off = vertOff[mi];
    for (let f = 0; f < idx.count; f += 3) {
      const a = off + idx.getX(f), b = off + idx.getX(f + 1), c = off + idx.getX(f + 2);
      const ax = S[a * 3], ay = S[a * 3 + 1], az = S[a * 3 + 2];
      const abx = S[b * 3] - ax, aby = S[b * 3 + 1] - ay, abz = S[b * 3 + 2] - az;
      const acx = S[c * 3] - ax, acy = S[c * 3 + 1] - ay, acz = S[c * 3 + 2] - az;
      const crx = aby * acz - abz * acy, cry = abz * acx - abx * acz, crz = abx * acy - aby * acx;
      const area = 0.5 * Math.hypot(crx, cry, crz);
      if (area > 1e-9) { acc += area; tris.push({ a, b, c, cum: acc }); }
    }
  }
  for (let i = 0; i < grains; i++) {
    const target = rnd() * acc;
    let lo = 0, hi = tris.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid].cum < target) lo = mid + 1; else hi = mid; }
    const tr = tris[lo];
    const r1 = Math.sqrt(rnd()), r2 = rnd();
    rig.ia[i] = tr.a; rig.ib[i] = tr.b; rig.ic[i] = tr.c;
    rig.wa[i] = 1 - r1; rig.wb[i] = r1 * (1 - r2); rig.wc[i] = r1 * r2;
  }
  return rig;
}

export default function DustFigure({
  url = '/models/library/people/human-rigged.glb',
  position = [0, 0, 0], rotationY = 0, height = 1.8,
  grains = 42000, igniteAt = Infinity, idleOffset = 0, seed = 20260709,
  exposure = 1.0,
}: DustFigureProps) {
  const timeRef = useCineTime();
  const gl = useThree(s => s.gl);
  const bufSize = useMemo(() => new THREE.Vector2(), []);
  const [rig, setRig] = useState<FigRig | null>(null);

  useEffect(() => {
    let alive = true;
    loadFigRig(url, position, rotationY, height, grains, seed)
      .then(r => { if (alive) setRig(r); })
      .catch(e => console.error('[DustFigure] no cargó', url, e));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, grains, seed]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(grains * 3), 3));
    const rnd = mulberry32(seed ^ 0x5bd1);
    const jit = new Float32Array(grains);
    for (let i = 0; i < grains; i++) jit[i] = rnd();
    g.setAttribute('aJit', new THREE.BufferAttribute(jit, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(position[0], position[1] + height / 2, position[2]), height * 2.5);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grains, seed]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uR: { value: 0 }, uPx: { value: 300 }, uRS: { value: 1 },
      uExposure: { value: exposure },
      uHeart: { value: new THREE.Vector3(position[0], position[1] + height * 0.72, position[2]) },
    },
    vertexShader: VERT, fragmentShader: FRAG,
  }), [exposure]);  // eslint-disable-line react-hooks/exhaustive-deps

  const light = useRef<THREE.PointLight>(null);
  const heartW = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!rig) return;
    const t = timeRef.current;
    setRigTime(rig, t + idleOffset);
    // granos = interpolación barycentric del mesh skineado (mundo)
    const attr = geo.attributes.position as THREE.BufferAttribute;
    const P = attr.array as Float32Array;
    const S = rig.skinned;
    const n = rig.ia.length;
    for (let i = 0; i < n; i++) {
      const a3 = rig.ia[i] * 3, b3 = rig.ib[i] * 3, c3 = rig.ic[i] * 3;
      const wa = rig.wa[i], wb = rig.wb[i], wc = rig.wc[i];
      const o = i * 3;
      P[o] = S[a3] * wa + S[b3] * wb + S[c3] * wc;
      P[o + 1] = S[a3 + 1] * wa + S[b3 + 1] * wb + S[c3 + 1] * wc;
      P[o + 2] = S[a3 + 2] * wa + S[b3 + 2] * wb + S[c3 + 2] * wc;
    }
    attr.needsUpdate = true;
    // la LUZ-IDEA: radio creciente desde el pecho + pointLight real
    const dt = t - igniteAt;
    const R = dt > 0 ? 2.6 * (1 - Math.exp(-dt / 1.1)) : 0;
    if (rig.chest) rig.chest.getWorldPosition(heartW);
    else heartW.set(position[0], position[1] + height * 0.72, position[2]);
    mat.uniforms.uTime.value = t;
    mat.uniforms.uR.value = R;
    (mat.uniforms.uHeart.value as THREE.Vector3).copy(heartW);
    gl.getDrawingBufferSize(bufSize);
    mat.uniforms.uRS.value = Math.max(bufSize.x, bufSize.y) / 1920;
    if (light.current) {
      light.current.position.copy(heartW);
      const flash = dt > 0 ? 1 + 1.2 * Math.exp(-dt / 0.5) : 0;
      light.current.intensity = dt > 0 ? 3.2 * Math.min(1, dt / 0.4) * flash : 0;
    }
  });

  if (!rig) return null;
  return (
    <group>
      <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-30} />
      <pointLight ref={light} color="#FFC97A" intensity={0} distance={14} decay={2} />
    </group>
  );
}
