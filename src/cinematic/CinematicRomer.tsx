/**
 * CinematicRomer — "LAS IDEAS GENERAN VALOR · EL VALOR GENERA RIQUEZA" (Romer · Nobel 2018).
 * Cápsula #2 del molde (EL MECANISMO desnudo) — serie "los Nobel son fenómenos naturales".
 *
 * LA MATEMÁTICA (real, integrada — no curvas inventadas):
 *   Y = A · K^α · L^(1-α)          (producción)
 *   dK/dt = s·Y − δ·K              (acumulación de capital → steady state K* = (sA/δ)^(1/(1-α)))
 *   dA/dt = g·A                    (las ideas se COMPONEN — crecimiento endógeno, Romer 1990)
 * El modelo se integra con Euler dt=0.02 y las partículas OBEDECEN esa integración:
 *   K(t) → cuántas partículas viven (capital = cosas RIVALES)
 *   A(t) → cuánto brilla/arde cada partícula (la IDEA multiplica el valor de lo mismo)
 * Rendimientos decrecientes = el LAVADO a blanco del blending aditivo (más partículas
 * a la misma nube ya no suman color) — el fenómeno del render ES la ley K^α.
 *
 * EL DICCIONARIO (fijo para toda la serie):
 *   PARTÍCULAS = lo rival (maíz, máquinas, dinero) · CAMPO cian = la idea (no-rival,
 *   toca todo sin gastarse) · CONEXIÓN de campos = la copia gratis (el vecino enciende
 *   y tú no pierdes NADA).
 *
 * TIMELINE (62 s) — LA NAVAJA:
 *   FF   0.0-1.5   FLASH-FORWARD: las dos economías ardiendo conectadas (clímax) → corte
 *   A1   1.5-12    LA TRAMPA — la nube acumula partículas y el crecimiento SE FRENA (K→K*)
 *   A2   12-20     LA PREGUNTA — la nube saturada, quieta, muerta. Algo falta.
 *   A3   20-32     LA IDEA — el campo entra y BARRE: cada partícula que toca ENCIENDE (A↑)
 *   A4   32-42     LA COPIA — aparece el vecino pobre; el campo SE CONECTA; enciende TAMBIÉN
 *   A5   42-52     BOLA DE NIEVE — dA/dt=g·A: el campo se densifica, las dos crecen juntas
 *   A6   52-62     LA PAZ — wide contemplativo (aquí cae "ideas→valor→riqueza" + sello Nobel)
 *
 * Determinista: window.__cinematicRomer.renderAt(t) PURO en t ∈ [0,62].
 * (alias window.__cinematicAtom para reusar o2-clip.cjs / stills.)
 */
import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import CinematicPostFX from './CinematicPostFX';

const DURATION = 62;
type Vec3 = [number, number, number];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);
const ss = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const ease = (x: number) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const hash = (n: number) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

// ── EL MODELO (Solow→Romer), integrado UNA vez: arrays muestreados a 0.1 s ──
const ALPHA = 1 / 3, S1 = 0.55, S2 = 0.30, DELTA = 0.13;
const T_IDEA = 20, T_COPY = 36, G_IDEAS = 0.058;
const KSTAR = Math.pow(S1 / DELTA, 1 / (1 - ALPHA));        // steady state SIN ideas (la trampa)
const KSTAR2 = Math.pow(S2 / DELTA, 1 / (1 - ALPHA));       // steady state del VECINO (más pobre: ahorra menos)
const KCAP = 3.2 * KSTAR;                                    // presupuesto de partículas (norm nube 1)
const KCAP2 = 3.4 * KSTAR2;                                  // norm PROPIA del vecino (visible aunque pobre)
type ModelRow = { K1: number; A1: number; K2: number; A2: number };
function integrateModel(): ModelRow[] {
  const rows: ModelRow[] = [];
  let K1 = 0.35, A1 = 1, K2 = 0.22, A2 = 1;
  const dt = 0.02;
  for (let tau = 0; tau <= 70 + 1e-9; tau += dt) {
    if (Math.round(tau * 10) / 10 === Math.round((rows.length) * 0.1 * 10) / 10 && rows.length <= tau * 10 + 0.5) {
      rows.push({ K1, A1, K2, A2 });
    }
    const g1 = G_IDEAS * ss((tau - T_IDEA) / 4);             // la idea PRENDE en τ=20 (rampa suave)
    const g2 = G_IDEAS * ss((tau - (T_COPY + 1.5)) / 4);     // el vecino la COPIA en τ=37.5
    const Y1 = A1 * Math.pow(Math.max(K1, 1e-6), ALPHA);
    const Y2 = A2 * Math.pow(Math.max(K2, 1e-6), ALPHA);
    K1 += (S1 * Y1 - DELTA * K1) * dt;
    K2 += (S2 * Y2 - DELTA * K2) * dt;
    A1 += g1 * A1 * dt;
    A2 += g2 * A2 * dt;
  }
  return rows;
}
const MODEL = integrateModel();
function modelAt(tau: number): ModelRow {
  const x = Math.max(0, Math.min(MODEL.length - 1.001, tau * 10));
  const i = Math.floor(x), f = x - i;
  const a = MODEL[i], b = MODEL[i + 1];
  return { K1: a.K1 + (b.K1 - a.K1) * f, A1: a.A1 + (b.A1 - a.A1) * f, K2: a.K2 + (b.K2 - a.K2) * f, A2: a.A2 + (b.A2 - a.A2) * f };
}
// FLASH-FORWARD puro en t: los primeros 1.5 s enseñan el clímax (τ≈50) y CORTE seco a τ=t.
const modelTau = (t: number) => (t < 1.5 ? 49 + t * 2.0 : t);

// ── GEOMETRÍA DE ESCENA ──
const R = 1.5;                                                // radio nube (unidades escena)
const C1: Vec3 = [0, 1.55, 0];                                // economía NUESTRA (arriba)
const C2: Vec3 = [0, -1.85, 0];                               // el VECINO (abajo — apilado vertical llena 9:16)
const SPARK: Vec3 = [0.95, 2.75, 0.25];                       // de dónde entra la idea (pegado al borde de la nube)

// ── NUBE JOYA (la economía): K(t)=cuántas · A(t)=cuánto arde cada una ──
const CLOUD_VERT = /* glsl */ `
attribute vec3 aColor; attribute float aBirth; attribute float aR; attribute float aGl;
uniform float uCount, uSweep, uGlowA, uBright, uSize;
varying vec3 vC; varying float vA;
void main(){
  float alive = 1.0 - smoothstep(uCount - 0.02, uCount, aBirth);   // vive si aBirth < uCount (K crece → nube CRECE)
  float ign = clamp((uSweep - aR) / 0.22, 0.0, 1.0);
  vec3 fire = vec3(1.0, 0.72, 0.26);
  vC = mix(aColor, fire, ign * 0.72);
  float glow = 1.0 + ign * (uGlowA - 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float near = smoothstep(0.14, 0.75, -mv.z);
  vA = alive * uBright * glow * (0.72 + 0.55 * aGl) * near;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(uSize * 300.0 / -mv.z, 9.0) * (1.0 + 0.65 * ign);
}`;
const CLOUD_FRAG = /* glsl */ `
varying vec3 vC; varying float vA;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float d2 = dot(q, q);
  float fall = exp(-d2 * 14.0) - 0.018;
  float a = max(vA * fall, 0.0);
  gl_FragColor = vec4(vC * a, a);
}`;
function JewelCloud({ center, N, count, sweep, glowA, bright, seed }:
  { center: Vec3; N: number; count: number; sweep: number; glowA: number; bright: number; seed: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const birth = new Float32Array(N), rad = new Float32Array(N), gl = new Float32Array(N);
    // paleta JOYA de la serie: core oro cálido + valencia violeta/cian + glints blancos
    const core: Vec3 = [1.0, 0.74, 0.34], valV: Vec3 = [0.62, 0.32, 1.0], valC: Vec3 = [0.26, 0.64, 1.0];
    for (let i = 0; i < N; i++) {
      const h1 = hash(seed + i * 3 + 1), h2 = hash(seed + i * 3 + 2), h3 = hash(seed + i * 3 + 3), h4 = hash(seed + i * 7 + 5);
      // radial exponencial (denso al centro, cola difusa) + dirección isotrópica
      const r = R * Math.min(1.6, -0.42 * Math.log(Math.max(1e-4, 1 - h1 * 0.985)));
      const th = Math.acos(2 * h2 - 1), ph = 2 * Math.PI * h3;
      pos[i * 3] = center[0] + r * Math.sin(th) * Math.cos(ph);
      pos[i * 3 + 1] = center[1] + r * Math.cos(th) * 0.92;
      pos[i * 3 + 2] = center[2] + r * Math.sin(th) * Math.sin(ph);
      const s = ss((r / R - 0.14) / 0.34);                    // núcleo cálido → velo frío (violeta/cian presentes PRONTO — riqueza joya)
      let vr: number, vg: number, vb: number;
      if (h4 < 0.30) { vr = valC[0]; vg = valC[1]; vb = valC[2]; }
      else if (h4 > 0.955) { vr = 1.0; vg = 0.95; vb = 1.0; } // glints (puntos brillosos)
      else { vr = valV[0]; vg = valV[1]; vb = valV[2]; }
      col[i * 3] = core[0] * (1 - s) + vr * s;
      col[i * 3 + 1] = core[1] * (1 - s) + vg * s;
      col[i * 3 + 2] = core[2] * (1 - s) + vb * s;
      birth[i] = hash(seed + i * 11 + 9);                     // orden de llegada aleatorio-determinista
      rad[i] = r / R;
      gl[i] = hash(seed + i * 13 + 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1));
    g.setAttribute('aR', new THREE.BufferAttribute(rad, 1));
    g.setAttribute('aGl', new THREE.BufferAttribute(gl, 1));
    return g;
  }, [N, center, seed]);
  const uniforms = useMemo(() => ({
    uCount: { value: 0 }, uSweep: { value: 0 }, uGlowA: { value: 1 }, uBright: { value: 0.4 }, uSize: { value: 0.068 },
  }), []);
  useEffect(() => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uCount.value = count; u.uSweep.value = sweep; u.uGlowA.value = glowA; u.uBright.value = bright;
  }, [count, sweep, glowA, bright]);
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={CLOUD_VERT} fragmentShader={CLOUD_FRAG}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ── EL CAMPO (la idea): arcos suaves y CONTINUOS — no se gastan al tocar ──
const FIELD_VERT = /* glsl */ `
attribute float aS; attribute float aL; varying float vS; varying float vL;
void main(){ vS=aS; vL=aL; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const FIELD_FRAG = /* glsl */ `
uniform float uOp; uniform vec3 uCol; uniform float uT; varying float vS; varying float vL;
void main(){ float s=clamp(vS,0.0,1.0);
  float base=0.32*pow(max(sin(3.14159*s),0.0),0.38);
  float ph=fract(uT*0.06 + vL*0.13);
  float dd=s-ph; dd=dd-floor(dd+0.5);
  float glow=exp(-dd*dd*7.0);
  float a=uOp*(base + 0.13*glow);
  gl_FragColor=vec4(uCol*a*2.0, a); }`;
function bezier(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t;
  return [0, 1, 2].map(k =>
    u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]) as Vec3;
}
const sampleBezier = (p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, LP: number): Vec3[] => {
  const out: Vec3[] = [];
  for (let i = 0; i < LP; i++) out.push(bezier(p0, p1, p2, p3, i / (LP - 1)));
  return out;
};
// IdeaField dibuja POLILÍNEAS ya muestreadas (dipolo/bezier) con la línea continua+swell
function IdeaField({ lines, op, time, col }:
  { lines: Vec3[][]; op: number; time: number; col: Vec3 }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const built = useMemo(() => {
    let nseg = 0;
    for (const ln of lines) nseg += ln.length - 1;
    const pos = new Float32Array(nseg * 6), aS = new Float32Array(nseg * 2), aL = new Float32Array(nseg * 2);
    let op6 = 0, os = 0, ol = 0;
    for (let j = 0; j < lines.length; j++) {
      const ln = lines[j], LP = ln.length;
      for (let sIdx = 1; sIdx < LP; sIdx++) {
        pos[op6++] = ln[sIdx - 1][0]; pos[op6++] = ln[sIdx - 1][1]; pos[op6++] = ln[sIdx - 1][2];
        pos[op6++] = ln[sIdx][0]; pos[op6++] = ln[sIdx][1]; pos[op6++] = ln[sIdx][2];
        aS[os++] = (sIdx - 1) / (LP - 1); aS[os++] = sIdx / (LP - 1);
        aL[ol++] = j; aL[ol++] = j;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    g.setAttribute('aL', new THREE.BufferAttribute(aL, 1));
    return g;
  }, [lines]);
  const uniforms = useMemo(() => ({
    uOp: { value: 0 }, uCol: { value: new THREE.Color(col[0], col[1], col[2]) }, uT: { value: 0 },
  }), []);
  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uOp.value = op;
    matRef.current.uniforms.uT.value = time;
  }, [op, time]);
  if (op < 0.01) return null;
  return (
    <lineSegments geometry={built} frustumCulled={false}>
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={FIELD_VERT} fragmentShader={FIELD_FRAG}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}
// EL CAMPO como DIPOLO COHERENTE (la fórmula del imán del O₂: r = L·sin²θ) con el
// eje apuntando al SPARK — la idea ENVUELVE a la economía con líneas que fluyen
// juntas (topología física, no maraña aleatoria) + rayos directos del spark.
function makeFieldLines(n: number, seed: number, from: Vec3, center: Vec3): Vec3[][] {
  const out: Vec3[][] = [];
  // eje del dipolo = hacia el spark (el campo "emana" de donde vino la idea)
  const ax: Vec3 = [from[0] - center[0], from[1] - center[1], from[2] - center[2]];
  const axL = Math.hypot(ax[0], ax[1], ax[2]);
  const a: Vec3 = [ax[0] / axL, ax[1] / axL, ax[2] / axL];
  const tmp: Vec3 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u: Vec3 = [a[1] * tmp[2] - a[2] * tmp[1], a[2] * tmp[0] - a[0] * tmp[2], a[0] * tmp[1] - a[1] * tmp[0]];
  const uL = Math.hypot(u[0], u[1], u[2]);
  const U: Vec3 = [u[0] / uL, u[1] / uL, u[2] / uL];
  const V: Vec3 = [a[1] * U[2] - a[2] * U[1], a[2] * U[0] - a[0] * U[2], a[0] * U[1] - a[1] * U[0]];
  const nWrap = Math.floor(n * 0.82);
  const LP = 56, GOLD = Math.PI * (3 - Math.sqrt(5));
  for (let j = 0; j < nWrap; j++) {                            // líneas de dipolo (jaula coherente)
    const h1 = hash(seed + j * 5 + 1), h2 = hash(seed + j * 5 + 2);
    const phi = j * GOLD + 0.35 * (h1 - 0.5);                  // azimut distribuido uniforme (golden angle)
    const L = R * (1.25 + 1.05 * h2);                          // concha del arco
    const thMin = Math.asin(Math.sqrt(Math.min(1, R * 0.32 / L)));  // nace/muere cerca del polo
    const ln: Vec3[] = [];
    for (let i = 0; i < LP; i++) {
      const th = thMin + (Math.PI - 2 * thMin) * (i / (LP - 1));
      const r = Math.max(L * Math.sin(th) * Math.sin(th), R * 0.3);
      const cA = r * Math.cos(th), cU = r * Math.sin(th) * Math.cos(phi), cV = r * Math.sin(th) * Math.sin(phi);
      ln.push([
        center[0] + cA * a[0] + cU * U[0] + cV * V[0],
        center[1] + cA * a[1] + cU * U[1] + cV * V[1],
        center[2] + cA * a[2] + cU * U[2] + cV * V[2],
      ]);
    }
    out.push(ln);
  }
  for (let j = nWrap; j < n; j++) {                            // rayos del SPARK → clavan a la nube
    const h1 = hash(seed + j * 5 + 1), h2 = hash(seed + j * 5 + 2), h3 = hash(seed + j * 5 + 3);
    const th = Math.acos(2 * h1 - 1), ph = 2 * Math.PI * h2;
    const r = R * (0.3 + 0.5 * h3);
    const T: Vec3 = [center[0] + r * Math.sin(th) * Math.cos(ph), center[1] + r * Math.cos(th) * 0.9, center[2] + r * Math.sin(th) * Math.sin(ph)];
    const P1: Vec3 = [from[0] + (T[0] - from[0]) * 0.3 + 0.5 * (h2 - 0.5), from[1] + (T[1] - from[1]) * 0.22 + 0.4 * h1, from[2] + (T[2] - from[2]) * 0.3 + 0.5 * (h3 - 0.5)];
    const P2: Vec3 = [from[0] + (T[0] - from[0]) * 0.72, from[1] + (T[1] - from[1]) * 0.75, from[2] + (T[2] - from[2]) * 0.72];
    out.push(sampleBezier(from, P1, P2, T, LP));
  }
  return out;
}
// puentes nube1 → nube2 (LA COPIA: el campo se CONECTA, como los dos campos del Li₂)
function makeBridgeLines(n: number, seed: number): Vec3[][] {
  const out: Vec3[][] = [];
  for (let j = 0; j < n; j++) {
    const h1 = hash(seed + j * 7 + 1), h2 = hash(seed + j * 7 + 2), h3 = hash(seed + j * 7 + 3);
    const a = 2 * Math.PI * h1;
    const S: Vec3 = [C1[0] + Math.cos(a) * R * (0.5 + 0.4 * h2), C1[1] - R * (0.35 + 0.4 * h3), C1[2] + Math.sin(a) * R * (0.5 + 0.4 * h2)];
    const T: Vec3 = [C2[0] + Math.cos(a + 1.7) * R * (0.4 + 0.4 * h3), C2[1] + R * (0.3 + 0.4 * h2), C2[2] + Math.sin(a + 1.7) * R * (0.4 + 0.4 * h3)];
    const side = h2 > 0.5 ? 1 : -1;
    const bow = 0.55 + 0.85 * h3;
    const P1: Vec3 = [S[0] + side * bow, lerp(S[1], T[1], 0.3), S[2] + side * bow * 0.6];
    const P2: Vec3 = [T[0] + side * bow, lerp(S[1], T[1], 0.7), T[2] + side * bow * 0.6];
    out.push(sampleBezier(S, P1, P2, T, 56));
  }
  return out;
}

// ── EL SPARK (el origen de la idea): estrella pequeña, brillante, cian-blanca ──
function Spark({ scale, time }: { scale: number; time: number }) {
  if (scale < 0.01) return null;
  const s = scale * (1 + 0.06 * Math.sin(time * 5.2));
  return (
    <group position={SPARK}>
      {/* núcleo chico y BRILLANTE — el halo lo pone el bloom, no una esfera plana */}
      <mesh scale={[s * 0.055, s * 0.055, s * 0.055]}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial color={new THREE.Color(3.2, 5.2, 6.6)} toneMapped={false} transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ── CÁMARA (pura en t, con peso; apilado vertical llena el 9:16) ──
function cameraAt(t: number): { pos: Vec3; target: Vec3; fov: number } {
  const bx = Math.sin(t * 0.21) * 0.05;                       // respiro handheld con peso
  const orbit = (c: Vec3, d: number, el: number, az: number): Vec3 =>
    [c[0] + d * Math.cos(el) * Math.sin(az), c[1] + d * Math.sin(el), c[2] + d * Math.cos(el) * Math.cos(az)];
  if (t < 1.5) {                                              // FF: el clímax en tu cara (two-shot COMPLETO ardiendo)
    const k = t / 1.5;
    const mid: Vec3 = [0, -0.30, 0];
    return { pos: orbit(mid, 10.6 - 0.8 * k, 0.06, 0.55 + 0.20 * k + bx), target: mid, fov: 44 };
  }
  if (t < 12) {                                               // A1 LA TRAMPA: medium, dolly-in lento
    const k = ease((t - 1.5) / 10.5);
    return { pos: orbit(C1, lerp(4.9, 3.6, k), lerp(0.06, 0.13, k), 0.25 + 0.10 * k + bx), target: C1, fov: 42 };
  }
  if (t < 20) {                                               // A2 LA PREGUNTA: push a la nube muerta
    const k = ease((t - 12) / 8);
    return { pos: orbit(C1, lerp(3.6, 2.75, k), lerp(0.13, 0.05, k), 0.35 + 0.16 * k + bx), target: C1, fov: 42 };
  }
  if (t < 32) {                                               // A3 LA IDEA: el barrido — pull-back con órbita
    const k = ease((t - 20) / 12);
    const tg: Vec3 = [lerp(C1[0], SPARK[0] * 0.14, ss(k * 2)), lerp(C1[1], C1[1] + 0.18, ss(k * 2)), 0];
    return { pos: orbit(C1, lerp(2.75, 4.6, k), lerp(0.05, 0.13, k), 0.51 + 0.55 * k + bx), target: tg, fov: lerp(42, 40, k) };
  }
  if (t < 42) {                                               // A4 LA COPIA: two-shot vertical (las DOS nubes en cuadro)
    const k = ease((t - 32) / 10);
    const mid: Vec3 = [0, lerp(C1[1], -0.30, k), 0];
    return { pos: orbit(mid, lerp(4.6, 9.4, k), lerp(0.13, 0.07, k), 1.06 + 0.28 * k + bx), target: mid, fov: lerp(40, 43, k) };
  }
  if (t < 52) {                                               // A5 BOLA DE NIEVE: retirada wide
    const k = ease((t - 42) / 10);
    const mid: Vec3 = [0, -0.30, 0];
    return { pos: orbit(mid, lerp(9.4, 11.0, k), lerp(0.07, 0.10, k), 1.34 + 0.24 * k + bx), target: mid, fov: 43 };
  }
  const k = ease((t - 52) / 10);                              // A6 LA PAZ: drift lentísimo
  const mid: Vec3 = [0, -0.30, 0];
  return { pos: orbit(mid, 11.0 + 0.3 * k, 0.10, 1.58 + 0.12 * k + bx), target: mid, fov: 43 };
}
function CameraRig({ time }: { time: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const { pos, target, fov } = cameraAt(time);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(target[0], target[1], target[2]);
    (camera as THREE.PerspectiveCamera).fov = fov;
    camera.updateProjectionMatrix();
  }, [time, camera]);
  return null;
}
function FrameDriver({ time }: { time: number }) {
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [time, invalidate]);
  return null;
}

// ── ESCENA ──
function CinematicRomerInner() {
  const [time, setTime] = useState(0.01);
  const live = useMemo(() => new URLSearchParams(window.location.search).has('live'), []);

  useEffect(() => {
    if (live) return;
    const api = {
      renderAt: (t: number) => setTime(Math.max(0, Math.min(DURATION, t))),
      ready: true, duration: DURATION,
    };
    (window as unknown as { __cinematicRomer: typeof api }).__cinematicRomer = api;
    (window as unknown as { __cinematicAtom: typeof api }).__cinematicAtom = api;    // alias p/tooling (o2-clip, stills)
    return () => {
      delete (window as unknown as { __cinematicRomer?: unknown }).__cinematicRomer;
      delete (window as unknown as { __cinematicAtom?: unknown }).__cinematicAtom;
    };
  }, [live]);
  useEffect(() => {
    if (!live) return;
    let raf = 0, start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      setTime(((now - start) / 1000) % DURATION);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  const tau = modelTau(time);
  const m = modelAt(tau);
  // K → cuántas partículas viven · A → cuánto arde cada una (log: brillo crece SIN lavar)
  const count1 = Math.min(1, m.K1 / KCAP), count2 = Math.min(1, m.K2 / KCAP2);
  const glow1 = 1 + 1.15 * Math.log(m.A1), glow2 = 1 + 1.15 * Math.log(m.A2);
  // el BARRIDO de ignición sigue al campo (τ=20 nube 1 · τ=37.5 nube 2)
  const sweep1 = 1.45 * ease((tau - 20.6) / 9.5);
  const sweep2 = 1.45 * ease((tau - 38.0) / 6.5);
  // reveals del campo — al final el campo CEDE protagonismo a la riqueza que creó
  const fieldOp = ss((tau - 20) / 2.2) * 0.85 * (1 - 0.4 * ss((tau - 46) / 7));
  const denseOp = ss((tau - 42.5) / 4.5) * 0.35;              // bola de nieve: MÁS líneas (sutiles, no tapan)
  const bridgeOp = ss((tau - 36) / 2.0) * 1.0;                // LA COPIA = money-shot: puentes presentes
  const sparkScale = ss((tau - 19.3) / 1.2);
  // el vecino existe tenue desde A4 (la cámara lo revela)
  const nb = ss((tau - 31) / 2.5);

  const linesA = useMemo(() => makeFieldLines(110, 101, SPARK, C1), []);
  const linesDense = useMemo(() => makeFieldLines(58, 707, SPARK, C1), []);
  const linesB = useMemo(() => makeBridgeLines(54, 303), []);
  const CYAN: Vec3 = [0.5, 0.86, 1.3];

  return (
    <div style={{ position: live ? 'absolute' : 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        flat={false}
        camera={{ position: [0, 1.4, 5], fov: 42, near: 0.05, far: 300 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]}
        frameloop="always"
        style={{ background: '#000' }}
      >
        <color attach="background" args={['#020308']} />
        <FrameDriver time={time} />
        <CameraRig time={time} />
        <JewelCloud center={C1} N={50000} count={count1} sweep={sweep1} glowA={glow1}
          bright={0.50 * (1 + 0.5 * ss((tau - 30) / 8))} seed={11} />   {/* la riqueza encendida DOMINA los planos wide */}
        <JewelCloud center={C2} N={30000} count={count2} sweep={sweep2} glowA={glow2} bright={0.50 * (0.35 + 0.65 * nb)} seed={77} />
        <Spark scale={sparkScale} time={time} />
        <IdeaField lines={linesA} op={fieldOp} time={time} col={CYAN} />
        <IdeaField lines={linesDense} op={denseOp} time={time} col={CYAN} />
        <IdeaField lines={linesB} op={bridgeOp} time={time} col={CYAN} />
        {!live && (
          <CinematicPostFX preset="pulsar" bloomIntensity={0.75} bloomThreshold={0.32}
            saturation={0.2} contrast={0.15} grainOpacity={0.06} vignetteDarkness={0.6} />
        )}
      </Canvas>
    </div>
  );
}

export default memo(CinematicRomerInner);
