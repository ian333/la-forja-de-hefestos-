/**
 * BinaryMarket — DOS ESTRELLAS ALIMENTÁNDOSE (el corazón del mercado).
 * Binaria semidetached con transferencia de masa. Cada chispa del flujo = una
 * transacción; la capa económica (Akerlof) vive en uniforms dirigidos por la escena.
 *
 * FÍSICA REAL (regla dura de La Forja):
 *   · Marco corotante: potencial de Roche Φ = -GM₁/r₁ - GM₂/r₂ - ½ω²ρ².
 *     L1 hallado por bisección del equilibrio de fuerzas en el eje.
 *   · CORRIENTE: trayectoria balística integrada (RK4) desde L1 con Coriolis
 *     −2ω×v (à la Lubow & Shu 1975) — la curva "se dobla hacia atrás" y cae a
 *     la acretora. NO es una curva dibujada: EMERGE del potencial.
 *   · DISCO de acreción: órbitas keplerianas ω∝r^{-3/2} (¡cizalla visible!),
 *     color Shakura-Sunyaev T∝r^{-3/4} (interior blanco-azul → borde ámbar).
 *   · DONANTE llena su lóbulo: esfera elongada hacia L1 (gota), granulación
 *     convectiva de gigante fría. ACRETORA compacta blanca-azul.
 *   · El par ORBITA el CM con ω=2π/P — la danza se VE.
 *   · COLAPSO (evocativo, metáfora del modelo — etiquetado en la pieza): el
 *     sistema cae a una sombra con anillo de fotones (geometría correcta:
 *     sombra ~2.6 r y anillo fino que revienta).
 *
 * Determinista: TODO es f(hash, t) + uniforms puros en t. Sin estado mutable.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

// ── Sistema (unidades de escena) ──
const A_SEP = 7.0;
const Q12 = 1.25;                 // M1(donante)/M2(acretora)
const P_ORB = 26;                 // periodo orbital (s) — danza visible
const R_DONOR = 2.3;
const R_ACC = 0.5;
const R_DISK_OUT = 2.7;
const R_DISK_IN = 0.6;
const N_STREAM = 64000;
const N_DISK = 110000;
const T_FLOW = 6.5;               // s de viaje de una chispa por la corriente

const M1 = 1, M2 = 1 / Q12, MT = M1 + M2;
const X_DONOR = -(M2 / MT) * A_SEP;
const X_ACC = (M1 / MT) * A_SEP;
export const OMEGA = (2 * Math.PI) / P_ORB;
const GMT = OMEGA * OMEGA * A_SEP ** 3;     // ω²a³ = G·Mtot
const GM1 = GMT * (M1 / MT);
const GM2 = GMT * (M2 / MT);
export const BINARY = { A_SEP, X_DONOR, X_ACC, R_DONOR, R_ACC, R_DISK_OUT, P_ORB };

// ── L1: equilibrio de fuerzas en el eje x (bisección) ──
function fxEff(x: number): number {
  const d1 = x - X_DONOR, d2 = x - X_ACC;
  return -GM1 * Math.sign(d1) / (d1 * d1) - GM2 * Math.sign(d2) / (d2 * d2) + OMEGA * OMEGA * x;
}
function findL1(): number {
  let lo = X_DONOR + 0.2, hi = X_ACC - 0.2;
  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2;
    if (fxEff(mid) > 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

// ── Corriente balística RK4 (gravedad de ambas + centrífuga + Coriolis) ──
function integrateStream(): THREE.Vector3[] {
  const L1 = findL1();
  const acc = (px: number, py: number, vx: number, vy: number) => {
    const d1x = px - X_DONOR, d2x = px - X_ACC;
    const r1 = Math.hypot(d1x, py) + 1e-9, r2 = Math.hypot(d2x, py) + 1e-9;
    const g1 = -GM1 / (r1 * r1 * r1), g2 = -GM2 / (r2 * r2 * r2);
    return [
      g1 * d1x + g2 * d2x + OMEGA * OMEGA * px + 2 * OMEGA * vy,
      g1 * py + g2 * py + OMEGA * OMEGA * py - 2 * OMEGA * vx,
    ];
  };
  // sale de L1 con empujón térmico pequeño hacia la acretora (vx bajo → la
  // trayectoria se curva más por Coriolis = el RÍO se LEE, no es un destello)
  let px = L1 + 0.02, py = 0, vx = 0.20, vy = -0.06;
  const raw: Array<[number, number]> = [[px, py]];
  const dt = 0.0035;
  for (let i = 0; i < 90000; i++) {
    // RK4 en (px,py,vx,vy)
    const a1 = acc(px, py, vx, vy);
    const p2x = px + vx * dt / 2, p2y = py + vy * dt / 2, v2x = vx + a1[0] * dt / 2, v2y = vy + a1[1] * dt / 2;
    const a2 = acc(p2x, p2y, v2x, v2y);
    const p3x = px + v2x * dt / 2, p3y = py + v2y * dt / 2, v3x = vx + a2[0] * dt / 2, v3y = vy + a2[1] * dt / 2;
    const a3 = acc(p3x, p3y, v3x, v3y);
    const p4x = px + v3x * dt, p4y = py + v3y * dt, v4x = vx + a3[0] * dt, v4y = vy + a3[1] * dt;
    const a4 = acc(p4x, p4y, v4x, v4y);
    px += (vx + 2 * v2x + 2 * v3x + v4x) * dt / 6;
    py += (vy + 2 * v2y + 2 * v3y + v4y) * dt / 6;
    vx += (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]) * dt / 6;
    vy += (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]) * dt / 6;
    if (i % 30 === 0) raw.push([px, py]);
    const rA = Math.hypot(px - X_ACC, py);
    if (rA < R_DISK_OUT * 0.85) break;          // tocó el disco → hot spot
    if (rA > A_SEP * 2.5) break;                 // escape (no debería)
  }
  // remuestrear a 96 puntos uniformes por longitud de arco
  const pts = raw.map(([x, y]) => new THREE.Vector3(x, y, 0));
  const L: number[] = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = L[L.length - 1];
  const out: THREE.Vector3[] = [];
  for (let k = 0; k < 96; k++) {
    const target = (k / 95) * total;
    let i = 1; while (i < L.length - 1 && L[i] < target) i++;
    const f = (target - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]);
    out.push(pts[i - 1].clone().lerp(pts[i], f));
  }
  return out;
}

// ── Shaders ──
const STREAM_VERT = /* glsl */ `
uniform vec3 uCurve[96];
uniform float uTime, uPhase, uPx, uTheta, uReveal, uBlind, uCut, uCollapse;
attribute float aSeed;
varying vec3 vCol; varying float vA;
float h1(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  float q   = h1(aSeed * 7.13);          // calidad de ESTA transacción
  float ph  = h1(aSeed * 3.71);          // fase en la corriente
  float u = fract(ph + uTime / ${T_FLOW.toFixed(2)});
  float fi = u * 95.0;
  int i0 = int(fi);
  vec3 p = mix(uCurve[i0], uCurve[min(i0 + 1, 95)], fract(fi));
  // grosor del chorro (apretado al salir, se abre al caer)
  float w = 0.10 + 0.26 * u;
  p += (vec3(h1(aSeed*91.7), h1(aSeed*57.3), h1(aSeed*13.1)) - 0.5) * w;

  // ── ECONOMÍA ──
  // Akerlof: si q > θ, el vendedor bueno YA NO ENVÍA esta chispa (el flujo
  // se adelgaza de arriba hacia abajo en calidad).
  float alive = 1.0 - smoothstep(0.0, 0.05, q - uTheta);
  // EL CORTE: el flujo muere desde el origen (L1) hacia adelante.
  alive *= smoothstep(uCut - 0.12, uCut, u);
  // colapso final: nada fluye
  alive *= 1.0 - uCollapse;

  // color: ámbar profundo → se CALIENTA al caer (energía cinética real);
  // limón (q<0.3) revelado = verde tóxico
  vec3 amber = mix(vec3(1.0, 0.38, 0.08), vec3(1.0, 0.72, 0.28), smoothstep(0.45, 1.0, u));
  float isLemon = (1.0 - smoothstep(0.27, 0.32, q)) * uReveal;
  vec3 col = mix(amber, vec3(0.42, 1.0, 0.10), isLemon);
  col = mix(col, vec3(0.55, 0.62, 0.75), uBlind);    // vista ciega del comprador

  float c = cos(uPhase), s = sin(uPhase);
  p = vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
  vCol = col;
  vA = alive;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min((1.5 + 1.4 * smoothstep(0.7, 1.0, u)) * (uPx / -mv.z), 10.0);
}`;
const POINT_FRAG = /* glsl */ `
precision highp float;
varying vec3 vCol; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float a = exp(-r2 * 5.0) * vA;
  gl_FragColor = vec4(vCol * a, a);
}`;

const DISK_VERT = /* glsl */ `
uniform float uTime, uPhase, uPx, uBlind, uCollapse, uFlow;
attribute float aSeed;
varying vec3 vCol; varying float vA;
float h1(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  float s1 = h1(aSeed * 3.1), s2 = h1(aSeed * 17.9), s3 = h1(aSeed * 41.3);
  float r0 = mix(${R_DISK_IN.toFixed(2)}, ${R_DISK_OUT.toFixed(2)}, pow(s1, 1.7));
  // COLAPSO: el disco drena hacia adentro (inspiral)
  float r = mix(r0, ${R_DISK_IN.toFixed(2)} * 0.35, uCollapse * (0.4 + 0.6 * s2));
  float om = 2.7 * pow(max(r, 0.2), -1.5);          // Kepler: cizalla visible
  float ang = s2 * 6.2831853 + uTime * om;
  // el centro del disco MIGRA al CM durante el colapso: el material drena EN la sombra
  float cx = mix(${X_ACC.toFixed(3)}, 0.0, smoothstep(0.25, 0.9, uCollapse));
  vec3 p = vec3(cx + r * cos(ang), r * sin(ang) * 0.94, (s3 - 0.5) * 0.05 * r);
  float c = cos(uPhase), s = sin(uPhase);
  p = vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
  // Shakura-Sunyaev T∝r^-3/4 → interior blanco-azul pálido (#94b1ff clamp), borde ámbar
  float tn = pow(${R_DISK_IN.toFixed(2)} / max(r, 0.2), 0.75);
  vec3 cool = vec3(1.0, 0.50, 0.13);
  vec3 hot  = vec3(0.58, 0.69, 1.0);
  vCol = mix(cool, hot, smoothstep(0.3, 1.0, tn));
  vCol = mix(vCol, vec3(0.55, 0.62, 0.75), uBlind);
  // brillo contenido (el aditivo de 110k puntos satura — más luz ≠ más color)
  float feed = max(uFlow, uCollapse * (1.0 - smoothstep(0.7, 1.0, uCollapse)) * 1.1);
  vA = (0.26 + 0.50 * h1(aSeed * 5.3)) * feed * (1.0 - smoothstep(0.85, 1.0, uCollapse));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min((1.0 + 1.5 * tn) * (uPx / -mv.z), 8.0);
}`;

const DONOR_VERT = /* glsl */ `
uniform float uPhase, uCollapse;
varying vec3 vP; varying float vTow;
void main(){
  vec3 pos = position;
  float tow = smoothstep(-0.25, 1.0, position.x);    // lado hacia L1 (+x)
  pos *= 1.0 + 0.40 * tow * tow;                      // lóbulo de Roche (gota)
  pos *= ${R_DONOR.toFixed(2)} * (1.0 - uCollapse);   // colapsa a nada
  vec4 w = vec4(pos + vec3(${X_DONOR.toFixed(3)}, 0.0, 0.0), 1.0);
  float c = cos(uPhase), s = sin(uPhase);
  w.xy = vec2(c * w.x - s * w.y, s * w.x + c * w.y);
  vP = normalize(position);
  vTow = tow;
  gl_Position = projectionMatrix * modelViewMatrix * w;
}`;
const DONOR_FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uBlind;
varying vec3 vP; varying float vTow;
void main(){
  // granulación convectiva (gigante fría) — 2 octavas para romper la periodicidad
  vec3 q1 = vP * 5.5 + vec3(0.0, uTime * 0.09, 0.0);
  vec3 q2 = vP * 11.0 + vec3(uTime * 0.05, 0.0, uTime * 0.03);
  float g1 = sin(q1.x*1.9 + q1.y) * sin(q1.y*1.7 - q1.z) * sin(q1.z*2.1 + q1.x);
  float g2 = sin(q2.x*1.3 - q2.z) * sin(q2.y*2.3 + q2.x) * sin(q2.z*1.7 - q2.y);
  float gran = 0.62 + 0.26 * smoothstep(-0.6, 0.8, g1) + 0.14 * smoothstep(-0.5, 0.8, g2);
  vec3 base = vec3(1.0, 0.40, 0.09) * gran;            // brillo contenido: textura legible
  base += vec3(1.0, 0.82, 0.5) * vTow * vTow * 0.5;    // el lado que vierte, caliente
  base = mix(base, vec3(0.50, 0.57, 0.70), uBlind);
  gl_FragColor = vec4(base, 1.0);
}`;

const ACC_VERT = /* glsl */ `
uniform float uPhase, uCollapse;
void main(){
  vec3 pos = position * ${R_ACC.toFixed(2)} * (1.0 + uCollapse * 0.6);
  vec4 w = vec4(pos + vec3(${X_ACC.toFixed(3)}, 0.0, 0.0), 1.0);
  float c = cos(uPhase), s = sin(uPhase);
  w.xy = vec2(c * w.x - s * w.y, s * w.x + c * w.y);
  gl_Position = projectionMatrix * modelViewMatrix * w;
}`;
const ACC_FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uBlind, uCollapse;
void main(){
  float puls = 0.88 + 0.12 * sin(uTime * 8.0);
  vec3 c = vec3(0.80, 0.88, 1.0) * 2.2 * puls;        // blanca-azul pálida (Planck clamp)
  c = mix(c, vec3(0.6, 0.66, 0.8), uBlind);
  c *= 1.0 - smoothstep(0.5, 0.9, uCollapse);          // se apaga al colapsar
  gl_FragColor = vec4(c, 1.0);
}`;

// La sombra + anillo de fotones (colapso). Geometría correcta: sombra circular
// con el anillo fino que REVIENTA (bloom) en el borde. Billboard hacia cámara.
const BH_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv * 2.0 - 1.0;
  // billboard: anula la rotación de la vista
  vec4 c4 = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  gl_Position = projectionMatrix * (c4 + vec4(position.xy, 0.0, 0.0));
}`;
const BH_FRAG = /* glsl */ `
precision highp float;
uniform float uOn;       // 0→1 el colapso lo enciende
uniform float uTime;
varying vec2 vUv;
void main(){
  float r = length(vUv);
  if (r > 1.0) discard;
  // sombra negra hasta 0.62; anillo de fotones fino en 0.66; glow ámbar afuera
  float shadow = 1.0 - smoothstep(0.60, 0.65, r);
  float ring = smoothstep(0.63, 0.665, r) * (1.0 - smoothstep(0.665, 0.71, r));
  float glow = (1.0 - smoothstep(0.66, 1.0, r)) * 0.20;
  float flicker = 0.92 + 0.08 * sin(uTime * 11.0 + r * 40.0);
  vec3 col = vec3(1.0, 0.74, 0.32) * (ring * 3.2 * flicker + glow);
  float a = uOn * max(max(ring, glow * 1.2), shadow);
  // dentro de la sombra: NEGRO puro (tapa lo de atrás)
  col *= 1.0 - shadow;
  gl_FragColor = vec4(col * uOn, a);
}`;

export interface BinaryDrive {
  theta: number;     // umbral de calidad de Akerlof (1 → 0.1)
  reveal: number;    // los limones se ven verdes
  blind: number;     // vista del comprador
  cut: number;       // 0→1 el flujo se corta desde L1
  collapse: number;  // 0→1 colapso (estrellas → sombra+anillo)
  rebirth: number;   // 0→1 renacer (el sistema vuelve dorado)
}

export default function BinaryMarket({ time, drive }: { time: number; drive: BinaryDrive }) {
  const curve = useMemo(() => integrateStream(), []);

  const mkSeeds = (n: number, seed: number) => {
    const a = new Float32Array(n); let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < n; i++) a[i] = rnd();
    return a;
  };
  const streamGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_STREAM * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(mkSeeds(N_STREAM, 1234567), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), A_SEP * 3);
    return g;
  }, []);
  const diskGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_DISK * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(mkSeeds(N_DISK, 7654321), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), A_SEP * 3);
    return g;
  }, []);

  const curveArr = useMemo(() => curve.map(v => v.clone()), [curve]);
  const streamMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uCurve: { value: curveArr }, uTime: { value: 0 }, uPhase: { value: 0 },
      uPx: { value: 165 }, uTheta: { value: 1 }, uReveal: { value: 0 },
      uBlind: { value: 0 }, uCut: { value: 0 }, uCollapse: { value: 0 },
    },
    vertexShader: STREAM_VERT, fragmentShader: POINT_FRAG,
  }), [curveArr]);
  const diskMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uPhase: { value: 0 }, uPx: { value: 130 },
      uBlind: { value: 0 }, uCollapse: { value: 0 }, uFlow: { value: 1 },
    },
    vertexShader: DISK_VERT, fragmentShader: POINT_FRAG,
  }), []);
  const donorMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPhase: { value: 0 }, uBlind: { value: 0 }, uCollapse: { value: 0 } },
    vertexShader: DONOR_VERT, fragmentShader: DONOR_FRAG, toneMapped: false,
  } as THREE.ShaderMaterialParameters), []);
  const accMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPhase: { value: 0 }, uBlind: { value: 0 }, uCollapse: { value: 0 } },
    vertexShader: ACC_VERT, fragmentShader: ACC_FRAG, toneMapped: false,
  } as THREE.ShaderMaterialParameters), []);
  const bhMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uOn: { value: 0 }, uTime: { value: 0 } },
    vertexShader: BH_VERT, fragmentShader: BH_FRAG,
  }), []);

  const all = useRef<THREE.ShaderMaterial[]>([]);
  all.current = [streamMat, diskMat, donorMat, accMat, bhMat];
  useEffect(() => {
    // renacer: el sistema regresa (colapso se deshace, flujo dorado limpio)
    const collapse = drive.collapse * (1 - drive.rebirth);
    const theta = drive.theta + (1 - drive.theta) * drive.rebirth;
    const phase = OMEGA * time;
    for (const m of all.current) {
      const u = m.uniforms;
      if (u.uTime) u.uTime.value = time;
      if (u.uPhase) u.uPhase.value = phase;
      if (u.uTheta) u.uTheta.value = theta;
      if (u.uReveal) u.uReveal.value = drive.reveal * (1 - drive.rebirth);
      if (u.uBlind) u.uBlind.value = drive.blind;
      if (u.uCut) u.uCut.value = drive.cut * (1 - drive.rebirth);
      if (u.uCollapse) u.uCollapse.value = collapse;
      if (u.uFlow) u.uFlow.value = (1 - drive.cut) * (1 - collapse) + drive.rebirth;
      if (u.uOn) u.uOn.value = collapse;
    }
  }, [time, drive]);

  return (
    <group>
      <mesh material={donorMat}><sphereGeometry args={[1, 48, 48]} /></mesh>
      <mesh material={accMat}><sphereGeometry args={[1, 24, 24]} /></mesh>
      <points geometry={streamGeo} material={streamMat} frustumCulled={false} />
      <points geometry={diskGeo} material={diskMat} frustumCulled={false} />
      {/* sombra + anillo de fotones del colapso (billboard en el CM) */}
      <mesh material={bhMat} renderOrder={10}><planeGeometry args={[7.5, 7.5]} /></mesh>
    </group>
  );
}
