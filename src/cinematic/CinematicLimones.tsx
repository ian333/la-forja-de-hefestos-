/**
 * CinematicLimones v2 — "El mercado de los limones" (Akerlof 1970, Nobel 2001).
 * EPISODIO 1 de la serie "Los Nobel son fenómenos naturales".
 *
 * Sigue docs/FORMULA-SERIE.md (golpe 0.1s → gap → viaje → pico ÚNICO → paraíso →
 * semilla) + FILOSOFIA-CINE (planos FIJOS + teletransportes; llenar el cuadro;
 * infierno→paraíso) + las voces YA generadas (dist-audio/cinematic-limones/).
 *
 * LA IMAGEN-SÍMBOLO: la estrella-gota vertiendo su río de oro que se envenena
 * de verde — y el silencio del anillo cuando el río se corta.
 *
 * CAPAS:
 *   · BinaryMarket — dos estrellas alimentándose (Roche + RK4 + Kepler, físico).
 *   · MarketNebula — la nebulosa-mercado (turbulencia Kolmogorov, 2.5M carros).
 *   · Tipografía IN-SCENE (canvas plane 3D, el sistema la ocluye — refs IG).
 *   · El colapso final a sombra+anillo es EVOCATIVO (metáfora del modelo) y se
 *     etiqueta en pantalla. La física de la binaria es real.
 *
 * TIMELINE (88 s) clavado a las voces existentes:
 *   T0 GOLPE    0.0-1.5   el flujo YA cruzando + "UN MERCADO"
 *   T1 WIDE     1.5-9.5   b1@1.5 "esto es un mercado… dos estrellas alimentándose"
 *   T2 PUENTE   9.5-21.5  b2@10  "la dorada vende, la azul compra… cada chispa un trato"
 *   T3 LIMONES  21.5-32.5 b3@22  reveal verde 23.5-26 · CIEGO 28-32.5
 *   T4 RETIRADA 32.5-43.5 b4@33  θ→0.75 (la 1ª iteración de Akerlof)
 *   T5 CASCADA  43.5-53.5 b5@44  θ→0.56→0.42→0.32 (el flujo se adelgaza/envenena)
 *   T6 EL PICO  53.5-67.5 b6@54.5 CORTE del flujo → COLAPSO → "NADA ESCAPA"
 *                          → SILENCIO con el anillo (63.1-67.5)
 *   T7 PARAÍSO  67.5-88   b7@68  renacer dorado de lejos + "CONFIANZA" + título
 *
 * Determinista: window.__cinematicLimones.renderAt(t) PURO en t ∈ [0, 88].
 */
import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CinematicPostFX from './CinematicPostFX';
import BinaryMarket, { type BinaryDrive } from './BinaryMarket';

const DURATION = 88;

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function sstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * clamp01(t); }

// ── ECONOMÍA (Akerlof real: θ' = 0.75·θ por iteración) sincronizada a la voz ──
const WAVES: Array<{ t: number; theta: number }> = [
  { t: 0,    theta: 1.0 },
  { t: 38,   theta: 0.75 },   // b4: "prefiere quedarse su producto… y deja de vender"
  { t: 45,   theta: 0.5625 }, // b5: "menos buenos: peor calidad"
  { t: 48.5, theta: 0.4219 }, // b5: "peor calidad: menor precio"
  { t: 51.5, theta: 0.3164 }, // b5: "el flujo se envenena… y se adelgaza"
];
function thetaAt(t: number): number {
  let th = WAVES[0].theta;
  for (let i = 1; i < WAVES.length; i++) {
    th = lerp(th, WAVES[i].theta, sstep(WAVES[i].t, WAVES[i].t + 3.0, t));
  }
  return th;
}
function revealAt(t: number) { return sstep(23.5, 26, t); }                          // b3 "limones"
function blindAt(t: number) { return sstep(28, 29.2, t) * (1 - sstep(31.8, 33, t)); } // b3 "todo brilla igual"
function cutAt(t: number) { return sstep(54.5, 58.5, t); }                            // b6 "hasta que se corta"
function collapseAt(t: number) { return sstep(58.5, 63, t); }                         // b6 "colapsa bajo su propio peso"
function rebirthAt(t: number) { return sstep(70, 78, t); }                            // b7 "la cura existe…"

// ── CÁMARA: planos FIJOS + teletransportes (cortes secos). Micro-drift de peso. ──
type Vec3 = [number, number, number];
type Shot = { t0: number; t1: number; pos: Vec3; look: Vec3; fov: number; drift?: number };
const SHOTS: Shot[] = [
  // T0 GOLPE — encima del río de plasma, el flujo cruza el cuadro YA vivo
  { t0: 0,    t1: 1.5,  pos: [3.6, 1.4, 7.8],   look: [1.2, 0.1, 0],  fov: 46, drift: 0.10 },
  // T1 WIDE — la binaria en el corazón de su nebulosa (b1)
  { t0: 1.5,  t1: 9.5,  pos: [6, 7.5, 24],      look: [0, 0, 0],      fov: 44, drift: 0.05 },
  // T2 PUENTE — de lado, ambas estrellas + el río legible (b2)
  { t0: 9.5,  t1: 21.5, pos: [2.4, 2.8, 13.5],  look: [0.5, 0, 0],    fov: 42, drift: 0.07 },
  // T3 LIMONES — pegado al flujo: las chispas como individuos (b3)
  { t0: 21.5, t1: 32.5, pos: [3.4, 1.1, 7.6],   look: [2.4, -0.4, 0], fov: 44, drift: 0.09 },
  // T4 RETIRADA — el sistema entero; el flujo empieza a ralear (b4)
  { t0: 32.5, t1: 43.5, pos: [-4.5, 3.4, 12.5], look: [0.3, 0, 0],    fov: 42, drift: 0.06 },
  // T5 CASCADA — otro ángulo; el verde domina (b5)
  { t0: 43.5, t1: 53.5, pos: [7.5, 4.5, 14],    look: [0, -0.2, 0],   fov: 42, drift: 0.06 },
  // T6a EL CORTE — cerca de L1: ver morir el río (b6)
  { t0: 53.5, t1: 60,   pos: [2.6, 1.4, 8.4],   look: [0.9, 0, 0],    fov: 44, drift: 0.08 },
  // T6b LA SOMBRA — el anillo en el silencio
  { t0: 60,   t1: 67.5, pos: [-3.5, 2.2, 16],   look: [0, 0, 0],      fov: 42, drift: 0.04 },
  // T7 PARAÍSO — lejos, quieto, el renacer dorado (b7) — peak-end
  { t0: 67.5, t1: 88.1, pos: [10, 9, 27],       look: [0, 0, 0],      fov: 43, drift: 0.03 },
];
function cameraAt(t: number): { pos: Vec3; look: Vec3; fov: number } {
  let s = SHOTS[SHOTS.length - 1];
  for (const sh of SHOTS) { if (t >= sh.t0 && t < sh.t1) { s = sh; break; } }
  const k = (t - s.t0) / Math.max(0.001, s.t1 - s.t0);
  // micro-drift determinista (peso de grúa): dolly-in 3% + bob suave
  const d = s.drift ?? 0.05;
  const f = 1 - 0.03 * sstep(0, 1, k);
  const bobY = Math.sin(t * 0.45 + s.t0) * d * 0.4;
  const bobX = Math.cos(t * 0.33 + s.t0 * 2) * d * 0.3;
  return {
    pos: [s.pos[0] * f + bobX, s.pos[1] * f + bobY, s.pos[2] * f],
    look: s.look, fov: s.fov,
  };
}

// ── LA NEBULOSA-MERCADO (entorno; capa de carros) ──
const NEB_VERT = /* glsl */ `
attribute float aBright;
uniform float uTime, uTheta, uBlind, uReveal, uCure, uDim, uScale, uSize, uPx;
varying vec3 vCol; varying float vA;
float hash(vec3 p){ p=fract(p*0.3183+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  float q  = hash(floor(position * 53.7));
  float h2 = hash(floor(position * 91.3) + 3.0);
  float ang = uTime * 0.03;
  mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec3 pr = position; pr.xz = R * pr.xz;
  float out_ = smoothstep(0.0, 0.05, q - uTheta);
  float drift = smoothstep(0.0, 0.35, q - uTheta);
  pr *= 1.0 + drift * 0.55;
  float alive = 1.0 - out_;
  vec3 lemon = vec3(0.38, 1.0, 0.12);
  vec3 amber = mix(vec3(1.0, 0.36, 0.07), vec3(1.0, 0.62, 0.20), h2);
  float isLemon = 1.0 - smoothstep(0.28, 0.33, q);
  vec3 col = mix(amber, lemon, isLemon * uReveal);
  col = mix(col, vec3(0.52, 0.60, 0.72), uBlind);
  float tw = 0.82 + 0.18 * sin(uTime * (0.7 + h2 * 1.3) + q * 6.2831);
  float cured = uCure * isLemon;
  vCol = col;
  vA = alive * tw * (1.0 - cured * 0.92);
  vec3 p = pr * uScale;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(uSize * (0.5 + 1.2 * aBright) * (uPx / -mv.z), 7.0);
}`;
const NEB_FRAG = /* glsl */ `
precision highp float;
uniform float uExposure, uDim;
varying vec3 vCol; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float a = exp(-r2 * 3.2);
  vec3 c = vCol * (0.030 + 0.155 * vA) * a * uExposure * uDim;
  gl_FragColor = vec4(c, a * vA);
}`;

function MarketNebula({ time, dimNow, url, layerScale = 1, dim = 1, rotOff = 0 }: {
  time: number; dimNow: number; url: string; layerScale?: number; dim?: number; rotOff?: number;
}) {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url).then(r => r.arrayBuffer()).then(buf => {
      if (!alive) return;
      const f = new Float32Array(buf);
      const n = Math.floor(f.length / 4);
      const pos = new Float32Array(n * 3);
      const bri = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = f[i * 4]; pos[i * 3 + 1] = f[i * 4 + 1]; pos[i * 3 + 2] = f[i * 4 + 2];
        bri[i] = f[i * 4 + 3];
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aBright', new THREE.BufferAttribute(bri, 1));
      setGeo(g);
    }).catch(e => console.error('[MarketNebula] no cargó', url, e));
    return () => { alive = false; };
  }, [url]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uTheta: { value: 1 }, uBlind: { value: 0 },
      uReveal: { value: 0 }, uCure: { value: 0 }, uDim: { value: 1 },
      uScale: { value: 14.0 * layerScale }, uSize: { value: 2.0 },
      uExposure: { value: 0.22 * dim }, uPx: { value: 300.0 },
    },
    vertexShader: NEB_VERT, fragmentShader: NEB_FRAG,
  }), [layerScale, dim]);

  useEffect(() => {
    const rb = rebirthAt(time);
    mat.uniforms.uTime.value = time + rotOff;
    // la nebulosa también RENACE (peak-end con el cuadro LLENO, nunca void muerto)
    mat.uniforms.uTheta.value = lerp(thetaAt(time), 1.0, rb);
    mat.uniforms.uBlind.value = blindAt(time);
    mat.uniforms.uReveal.value = revealAt(time) * (1 - rb);
    mat.uniforms.uCure.value = rb;
    mat.uniforms.uDim.value = dimNow;
  }, [time, mat, rotOff, dimNow]);

  if (!geo) return null;
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-40} />;
}

// ── FONDO (cero negro muerto) + STARFIELD ──
function DeepBackground() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vP;
      void main(){
        float u = normalize(vP).y * 0.5 + 0.5;
        vec3 top = vec3(0.012, 0.022, 0.055);
        vec3 mid = vec3(0.020, 0.014, 0.040);
        vec3 bot = vec3(0.045, 0.022, 0.016);
        vec3 c = mix(bot, mid, smoothstep(0.0, 0.45, u));
        c = mix(c, top, smoothstep(0.45, 1.0, u));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }), []);
  return <mesh material={mat}><sphereGeometry args={[400, 24, 24]} /></mesh>;
}
function Starfield() {
  const geo = useMemo(() => {
    const N = 5200;
    let s = 987654321 >>> 0;
    const rnd = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let z = Math.imul(s ^ (s >>> 15), 1 | s);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
    const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3); const sz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let x = 0, y = 0, z = 0, d2 = 2;
      while (d2 > 1 || d2 < 1e-4) { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; d2 = x * x + y * y + z * z; }
      const r = 300 / Math.sqrt(d2);
      pos[i * 3] = x * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = z * r;
      const u = rnd();
      const c = u < 0.78 ? [0.75, 0.85, 1.0] : u < 0.93 ? [1.0, 0.95, 0.85] : [1.0, 0.72, 0.45];
      const b = 0.35 + 0.65 * rnd() * rnd();
      col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
      sz[i] = 1.1 + 3.0 * rnd() * rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSz', new THREE.BufferAttribute(sz, 1));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aCol; attribute float aSz;
      varying vec3 vC;
      void main(){
        vC = aCol;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSz;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vC;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d, d);
        if (r2 > 0.25) discard;
        float a = exp(-r2 * 7.0);
        gl_FragColor = vec4(vC * a * 0.85, a);
      }`,
  }), []);
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-60} />;
}

// ── TIPOGRAFÍA IN-SCENE (refs IG: la palabra es un objeto que el sistema ocluye) ──
function WordInScene({ text, position, rotationY = 0, height = 4, window: win, peak = 0.92 }: {
  text: string; position: Vec3; rotationY?: number; height?: number;
  window: [number, number]; peak?: number;
}) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = '900 300px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.letterSpacing = '8px';
    ctx.fillText(text, c.width / 2, c.height / 2 + 12);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [text]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
  }), [tex]);
  const ref = useRef<THREE.Mesh>(null);
  const [t0, t1] = win;
  useEffect(() => {
    // opacidad la maneja el driver de tiempo del padre vía userData
    if (ref.current) ref.current.userData.win = [t0, t1, peak];
  }, [t0, t1, peak]);
  // El padre actualiza opacity vía el clock global; aquí con useFrame leemos el reloj de escena
  useFrame(() => {
    const t = (window as unknown as { __limonesT?: number }).__limonesT ?? 0;
    const o = sstep(t0, t0 + 0.6, t) * (1 - sstep(t1 - 0.8, t1, t));
    mat.opacity = o * peak;
  });
  const w = height * 4; // aspecto del canvas 4:1
  return (
    <mesh ref={ref} position={position} rotation={[0, rotationY, 0]} material={mat} renderOrder={-10}>
      <planeGeometry args={[w, height]} />
    </mesh>
  );
}

// ── Rig + driver ──
function CameraRig({ time, vertical }: { time: number; vertical: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    const { pos, look, fov } = cameraAt(time);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(look[0], look[1], look[2]);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = vertical ? fov * 1.38 : fov;
    cam.near = 0.1; cam.far = 900;
    cam.updateProjectionMatrix();
  }, [time, camera, vertical]);
  return null;
}
function FrameDriver({ time }: { time: number }) {
  const { invalidate } = useThree();
  useEffect(() => {
    (window as unknown as { __limonesT: number }).__limonesT = time;
    invalidate();
  }, [time, invalidate]);
  return null;
}

// ── Overlays mínimos ──
function EvocativeLabel({ time }: { time: number }) {
  const o = sstep(58.5, 60, time) * (1 - sstep(65.5, 67, time));
  if (o < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', top: '8%', left: 0, right: 0, textAlign: 'center',
      zIndex: 11, pointerEvents: 'none', opacity: o * 0.5,
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: '0.85vw', letterSpacing: '0.12em', color: 'rgba(220,225,235,0.8)',
      textShadow: '0 2px 16px rgba(0,0,0,0.9)',
    }}>
      el colapso es metáfora del modelo · la física de la binaria es real
    </div>
  );
}
function TitleCoda({ time, vertical }: { time: number; vertical: boolean }) {
  const o = sstep(83.5, 85.5, time);
  if (o < 0.01) return null;
  return (
    <div style={{
      position: 'absolute', bottom: vertical ? '16%' : '14%', left: 0, right: 0,
      textAlign: 'center', zIndex: 11, pointerEvents: 'none', opacity: o,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        fontSize: vertical ? '7vw' : '2.5vw', fontWeight: 200, color: '#fff',
        letterSpacing: '-0.02em', textShadow: '0 4px 40px rgba(0,0,0,0.9)',
      }}>
        El mercado de los limones
      </div>
      <div style={{
        marginTop: vertical ? '1.6vw' : 10,
        fontSize: vertical ? '3vw' : '0.9vw', fontWeight: 400,
        color: 'rgba(255,255,255,0.55)', letterSpacing: '0.18em',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      }}>
        AKERLOF · 1970 · NOBEL 2001
      </div>
    </div>
  );
}

// ── Main ──
function CinematicLimonesInner({ live = false }: { live?: boolean }) {
  const [time, setTime] = useState(0);
  const [vertical, setVertical] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth,
  );
  useEffect(() => {
    const onR = () => setVertical(window.innerHeight > window.innerWidth);
    onR(); window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  useEffect(() => {
    if (live) return;
    const api = {
      renderAt: (t: number) => setTime(Math.max(0, Math.min(DURATION, t))),
      ready: true,
      duration: DURATION,
      beats: [
        { name: 'T0-golpe', t0: 0, t1: 1.5 },
        { name: 'T1-wide', t0: 1.5, t1: 9.5 },
        { name: 'T2-puente', t0: 9.5, t1: 21.5 },
        { name: 'T3-limones', t0: 21.5, t1: 32.5 },
        { name: 'T4-retirada', t0: 32.5, t1: 43.5 },
        { name: 'T5-cascada', t0: 43.5, t1: 53.5 },
        { name: 'T6-pico', t0: 53.5, t1: 67.5 },
        { name: 'T7-paraiso', t0: 67.5, t1: DURATION },
      ],
    };
    (window as unknown as { __cinematicLimones: typeof api }).__cinematicLimones = api;
    return () => { delete (window as unknown as { __cinematicLimones?: unknown }).__cinematicLimones; };
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

  // drive económico (puro en t) → binaria
  const drive: BinaryDrive = useMemo(() => ({
    theta: thetaAt(time),
    reveal: revealAt(time),
    blind: blindAt(time),
    cut: cutAt(time),
    collapse: collapseAt(time),
    rebirth: rebirthAt(time),
  }), [time]);

  // compensación de exposición de la nebulosa según distancia de cámara
  const dimNow = useMemo(() => {
    const { pos } = cameraAt(time);
    const d = Math.hypot(pos[0], pos[1], pos[2]);
    return clamp01(lerp(0.45, 1.0, (d - 8) / 22));
  }, [time]);

  return (
    <div style={{ position: live ? 'absolute' : 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        flat={false}
        camera={{ position: [6, 7.5, 24], fov: 44, near: 0.1, far: 900 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        dpr={[1, 2]}
        frameloop="always"
        style={{ background: '#000' }}
      >
        <color attach="background" args={['#04050c']} />
        <FrameDriver time={time} />
        <CameraRig time={time} vertical={vertical} />
        <DeepBackground />
        <Starfield />
        {/* nebulosa-mercado: capa trasera (profundidad) + capa media (entorno) */}
        <MarketNebula time={time} dimNow={dimNow} url="/limones-nebula.bin" layerScale={2.1} dim={0.35} rotOff={37} />
        <MarketNebula time={time} dimNow={dimNow} url="/limones-nebula.bin" />
        {/* EL CORAZÓN: dos estrellas alimentándose */}
        <BinaryMarket time={time} drive={drive} />
        {/* tipografía in-scene (el sistema la ocluye) */}
        <WordInScene text="UN MERCADO" position={[1.2, 1.5, -9]} window={[0.3, 4.2]} height={3.0} />
        <WordInScene text="NADA ESCAPA" position={[0.4, 0.5, -10]} rotationY={-0.12} window={[60.5, 66.5]} height={2.9} />
        <WordInScene text="CONFIANZA" position={[0.5, 1.6, -13]} rotationY={0.10} window={[79, 84]} height={4.0} peak={0.8} />
        {!live && (
          <CinematicPostFX preset="pulsar" bloomIntensity={0.55} bloomThreshold={0.38}
            saturation={0.24} contrast={0.15} grainOpacity={0.07} vignetteDarkness={0.62} />
        )}
      </Canvas>
      {!live && <>
        <EvocativeLabel time={time} />
        <TitleCoda time={time} vertical={vertical} />
      </>}
    </div>
  );
}

export default memo(CinematicLimonesInner);
