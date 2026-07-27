/**
 * NebulaWorld — el MUNDO-NEBULOSA para las masterclass cine (el matrimonio:
 * los GLB explican al centro, la nebulosa embellece y NARRA de fondo).
 *
 * Reemplaza el piso gris + fog de CineStage por: gradiente profundo + starfield
 * + DOS capas de nube turbulenta real (turbulent-nebula-sim, cara-i + lagrangiano)
 * con un CLARO central (las escenas GLB viven despejadas en r < holeR).
 *
 * EL ARCO DE COLOR cuenta la misma historia que la clase (config por props):
 *   · fría (marrón-ámbar tenue + azul profundo) — el mundo antes de la idea
 *   · el FANTASMA palpita (ghostWindow) — el residuo que no se ve
 *   · PRIMERA IGNICIÓN (firstIgnite) — nace una estrella; el frente de
 *     ionización se propaga (formación estelar en cadena, Elmegreen & Lada)
 *   · CADENA (chain[]) — estrellas que encienden clavadas a beats de la voz
 *   · AMANECER (dawnAt) — el cúmulo pleno, la nube encendida dorada
 *
 * Lee el reloj de la clase por CineTimeContext (= audio.currentTime: la voz es
 * la fuente de verdad). Determinista: todo es f(t).
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCineTime } from './useCineTime';
import { voiceLevel } from './dynamics';

export interface NebulaWorldProps {
  /** Ruta del .bin de partículas (float32 x,y,z,bright). */
  url?: string;
  /** Escala de la nube (unidades de escena por unidad de bin). */
  scale?: number;
  /** Radio del CLARO central donde viven los GLB (unidades de escena). */
  holeR?: number;
  /** Ventana del "fantasma" que palpita [t0, t1]. */
  ghostWindow?: [number, number];
  /** t de la PRIMERA ignición (la idea). */
  firstIgnite?: number;
  /** Corazón de la ignición (coords de NUBE, no de escena). */
  heart?: [number, number, number];
  /** Tiempos de ignición de la cadena (clavados a beats de la voz). */
  chain?: number[];
  /** Dibuja los SPRITES de estrella de la ignición/cadena (default true).
   *  false = la energía/frente/amanecer siguen, pero sin bolas de luz en cuadro
   *  (p.ej. cápsulas donde la estrella compite con el objeto principal). */
  igniteStars?: boolean;
  /** t del amanecer pleno (la nube encendida al máximo). */
  dawnAt?: number;
  /** Exposición global de la nube. */
  exposure?: number;
  /** Brillo del starfield. */
  starBright?: number;
  /** Inicios de beat de la clase: al entrar cada animación la nube BAJA LA LUZ
   *  (dim 0.4) y recupera en ~5s — dirección de luz teatral automática. */
  beatTimes?: number[];
  /** Saturación del color de la nube (>1 satura; 1 = neutro). */
  sat?: number;
  /** Desde este t la nube se CALMA sostenidamente (cede al objeto final). 0 = off. */
  calmFrom?: number;
  /** Energía mínima del color (0.10 clase; subir ~0.30 en reels para que el gas
   *  "frío" ya tenga color y no se vea negro/vacío). */
  energyBase?: number;
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function sstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t);
}

// ── nube (shader compartido por ambas capas) ──
const CLOUD_VERT = /* glsl */ `
attribute float aBright;
uniform float uTime, uFrontR, uGhost, uDawn, uScale, uPx, uHoleR, uRS, uSat, uEnergyBase;
uniform vec3 uHeart;
varying vec3 vCol; varying float vA;
float hash(vec3 p){ p=fract(p*0.3183+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
// saturación REAL: aleja del gris de luma (no blanquea como subir brillo haría).
// s>1 satura; en render aditivo es la vía correcta para que el COLOR domine.
vec3 saturate3(vec3 c, float s){ float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return max(mix(vec3(l), c, s), 0.0); }
// ── ESPECTROGRAMA propio (mapa de calor cálido): energía 0→1 a COLOR, con el
// pico en oro/ámbar SATURADO — nunca blanco. Es la rampa que define toda la nube.
vec3 spectro(float e){
  // AMBOS mundos: azul frío en lo tenue, magenta SOLO de transición en el medio,
  // ámbar/oro cálido dominando lo denso/caliente. Pico oro saturado, no blanco.
  vec3 c0 = vec3(0.06, 0.14, 0.44);  // 0.00 azul-cobalto profundo (gas frío)
  vec3 c1 = vec3(0.16, 0.20, 0.56);  // 0.22 azul-índigo
  vec3 c2 = vec3(0.58, 0.15, 0.44);  // 0.40 magenta-púrpura (transición, banda estrecha)
  vec3 c3 = vec3(0.96, 0.32, 0.14);  // 0.58 rojo-naranja
  vec3 c4 = vec3(1.00, 0.55, 0.13);  // 0.78 ámbar profundo
  vec3 c5 = vec3(1.00, 0.72, 0.28);  // 1.00 oro PROFUNDO (pico satura a oro, no a blanco)
  e = clamp(e, 0.0, 1.0);
  if (e < 0.22) return mix(c0, c1, e / 0.22);
  if (e < 0.40) return mix(c1, c2, (e - 0.22) / 0.18);
  if (e < 0.58) return mix(c2, c3, (e - 0.40) / 0.18);
  if (e < 0.78) return mix(c3, c4, (e - 0.58) / 0.20);
  return mix(c4, c5, (e - 0.78) / 0.22);
}
void main(){
  float h2 = hash(floor(position * 91.3) + 3.0);
  float ang = uTime * 0.018;
  mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec3 pr = position; pr.xz = R * pr.xz;

  float dHeart = distance(position, uHeart);

  // ── ENERGÍA del punto → ESPECTROGRAMA. La densidad del bin (aBright) + el
  // encendido (frente/amanecer) definen la energía; la rampa propia da el color
  // (frío azul en el gas tenue → oro en lo denso/caliente), pico saturado no blanco.
  float ignited = (1.0 - smoothstep(uFrontR - 0.45, uFrontR, dHeart));
  ignited = max(ignited, uDawn);
  float energy = uEnergyBase + 0.46 * aBright + 0.52 * ignited;
  vec3 col = spectro(energy);
  // vetas frías de acento ([OIII] verde, Hβ cian) SOLO en el gas frío (no encendido)
  float reg = hash(floor(position * 4.1) + 17.0);
  float cool = 1.0 - ignited;
  col = mix(col, vec3(0.08, 0.92, 0.52), cool * smoothstep(0.55, 0.60, reg) * (1.0 - smoothstep(0.66, 0.71, reg)) * 0.75);
  col = mix(col, vec3(0.14, 0.46, 1.00), cool * smoothstep(0.30, 0.35, reg) * (1.0 - smoothstep(0.41, 0.46, reg)) * 0.75);

  // el fantasma palpita ([OIII] cian-verde espectral cerca del corazón)
  col += vec3(0.18, 0.72, 0.90) * uGhost * exp(-dHeart * 2.2);

  float tw = 0.85 + 0.15 * sin(uTime * (0.6 + h2) + h2 * 6.28);
  vCol = saturate3(col, uSat);
  vec3 p = pr * uScale;
  // CLARO central: la nube se abre alrededor del escenario GLB
  float hole = smoothstep(uHoleR * 0.85, uHoleR, length(p));
  vA = tw * (0.78 + 0.22 * ignited) * hole;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // CAP ABSOLUTO en px (SIN ·uRS): el tamaño pre-cap sí escala con uRS (lado/1920,
  // mismo grosor relativo), pero el TOPE queda clavado en px → el FILL aditivo
  // total de los ~12M de puntos es CONSTANTE = el nivel probado a 1080, en toda
  // resolución. Con cap ∝uRS, una cámara que encuadra la nebulosa ENTERA a
  // 2160×3840 pasa el límite TDR (~2s) del driver D3D12 y MATA el contexto
  // (VALIDATE_STATUS false con logs vacíos, frame blanco/negro/parcial).
  // Cazado en brújula v2 t=0 (bisect: sin nebulosa el 4K vivía).
  gl_PointSize = min(1.25 * (0.45 + 1.0 * aBright) * (uPx * uRS / -mv.z), 3.2);
}`;
const CLOUD_FRAG = /* glsl */ `
precision highp float;
uniform float uExposure, uDimT;
varying vec3 vCol; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  // falloff suave: cada punto se funde con sus vecinos (36M → niebla continua),
  // sin ser tan ancho que sobre-acumule y blanquee los picos densos.
  float a = exp(-r2 * 2.7);
  // peso BAJO por punto: el blanqueo viene de acumular brillo (additive→blanco),
  // NO de saturar. El color domina por pureza, no por brillo. (mas-luz-no-es-color)
  // peso por punto BAJO (36M partículas): el brillo sale de la DENSIDAD, no de
  // que cada punto pegue fuerte → los picos densos mantienen COLOR, no blanco.
  vec3 c = vCol * (0.015 + 0.075 * vA) * a * uExposure * uDimT;
  gl_FragColor = vec4(c, a * vA);
}`;

// ── estrellas de la cadena ──
const STARS_VERT = /* glsl */ `
uniform float uTime, uPx, uRS;
attribute vec3 aPos;
attribute float aTig;
attribute float aBig;
varying vec3 vCol; varying float vA;
void main(){
  float dt = uTime - aTig;
  float born = step(0.0, dt);
  float flash = exp(-max(dt, 0.0) * 2.2) * 1.7;   // flash CONTENIDO (no revienta a blanco)
  float stable = smoothstep(0.0, 0.6, dt);
  float L = born * (stable + flash);
  // estrellas CÁLIDAS (no azul-blanco): nacen oro brillante, no un punto blanco
  vec3 hotC = vec3(1.0, 0.86, 0.55);
  vec3 coolC = vec3(1.0, 0.74, 0.34);
  vCol = mix(coolC, hotC, clamp(flash * 0.5, 0.0, 1.0));
  vA = L;
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aBig * (12.0 + flash * 14.0) * (uPx * uRS / -mv.z), 220.0);
}`;
const STARS_FRAG = /* glsl */ `
precision highp float;
varying vec3 vCol; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * 11.0) * 1.35;   // núcleo menos cegador (no se quema a blanco)
  float halo = exp(-r * 1.8) * 0.8;
  float spikes = exp(-abs(d.x) * 26.0) * exp(-r * 4.0) + exp(-abs(d.y) * 26.0) * exp(-r * 4.0);
  float L = (core + halo + spikes * 0.5) * vA;
  gl_FragColor = vec4(vCol * L, clamp(L, 0.0, 1.0));
}`;

function buildChainStars(heart: THREE.Vector3, chain: number[], scale: number, holeR: number) {
  let s = 999331 >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pts: Array<{ p: THREE.Vector3; tIg: number; big: number }> = [];
  for (let i = 0; i < chain.length; i++) {
    // a lo largo de filamentos alrededor del claro: radio creciente con el índice
    let p: THREE.Vector3;
    let guard = 0;
    do {
      let x = 0, y = 0, z = 0, d2 = 9;
      while (d2 > 1) { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; d2 = x * x + y * y + z * z; }
      const r = (0.55 + 1.5 * (i / chain.length) + rnd() * 0.4);
      p = new THREE.Vector3(x, y * 0.7, z).normalize().multiplyScalar(r).add(heart.clone().multiplyScalar(0.3));
      guard++;
    } while (p.length() * scale < holeR * 1.05 && guard < 20);  // fuera del claro
    pts.push({ p, tIg: chain[i], big: i === 0 ? 1.7 : 0.6 + rnd() * 0.9 });
  }
  return pts;
}

export default function NebulaWorld({
  url = '/limones-nebula.bin',
  scale = 30,
  holeR = 10,
  ghostWindow = [76.5, 86],
  firstIgnite = 85.8,
  heart = [0.15, -0.1, 0.05],
  chain = [],
  igniteStars = true,
  dawnAt = 207,
  exposure = 0.52,
  starBright = 1.2,
  beatTimes = [],
  sat = 1.4,
  calmFrom = 0,
  energyBase = 0.10,
}: NebulaWorldProps) {
  const timeRef = useCineTime();
  const heartV = useMemo(() => new THREE.Vector3(...heart), [heart]);
  const gl = useThree(s => s.gl);
  const bufSize = useMemo(() => new THREE.Vector2(), []);

  // ── nube: geometría compartida desde el .bin ──
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    let alive = true;
    // señal para el render headless: NO capturar hasta que el .bin esté cargado
    // y subido a GPU (evita frames oscuros/vacíos por capturar antes de tiempo).
    (window as unknown as { __nebulaReady?: boolean }).__nebulaReady = false;
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
      // un par de frames después de montar la geometría, marca listo
      requestAnimationFrame(() => requestAnimationFrame(() => {
        (window as unknown as { __nebulaReady?: boolean }).__nebulaReady = true;
      }));
    }).catch(e => console.error('[NebulaWorld] no cargó', url, e));
    return () => { alive = false; };
  }, [url]);

  const mkCloudMat = (layerScale: number, dim: number) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uFrontR: { value: 0 }, uGhost: { value: 0 },
      uDawn: { value: 0 }, uScale: { value: scale * layerScale },
      uHoleR: { value: holeR }, uHeart: { value: heartV },
      uExposure: { value: exposure * dim }, uDimT: { value: 1 }, uPx: { value: 380.0 },
      uRS: { value: 1 }, uSat: { value: sat }, uEnergyBase: { value: energyBase },
    },
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
  });
  const matBack = useMemo(() => mkCloudMat(2.0, 0.40), [scale, holeR, exposure, heartV, sat, energyBase]);  // eslint-disable-line react-hooks/exhaustive-deps
  const matMain = useMemo(() => mkCloudMat(1.0, 1.0), [scale, holeR, exposure, heartV, sat, energyBase]);   // eslint-disable-line react-hooks/exhaustive-deps
  // capa ÍNTIMA: filamentos en primer plano (la cámara DENTRO de la nube)
  const matNear = useMemo(() => mkCloudMat(0.55, 0.30), [scale, holeR, exposure, heartV, sat, energyBase]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── estrellas de la cadena ──
  const allChain = useMemo(() => [firstIgnite, ...chain], [firstIgnite, chain]);
  const starGeo = useMemo(() => {
    const pts = buildChainStars(heartV, allChain, scale, holeR);
    const n = pts.length;
    const pos = new Float32Array(n * 3), tig = new Float32Array(n), big = new Float32Array(n);
    pts.forEach((st, i) => {
      pos[i * 3] = st.p.x * scale; pos[i * 3 + 1] = st.p.y * scale; pos[i * 3 + 2] = st.p.z * scale;
      tig[i] = st.tIg; big[i] = st.big;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPos', new THREE.BufferAttribute(pos.slice(), 3));
    g.setAttribute('aTig', new THREE.BufferAttribute(tig, 1));
    g.setAttribute('aBig', new THREE.BufferAttribute(big, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), scale * 4);
    return g;
  }, [heartV, allChain, scale, holeR]);
  const starMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 320 }, uRS: { value: 1 } },
    vertexShader: STARS_VERT, fragmentShader: STARS_FRAG,
  }), []);

  // ── fondo profundo + starfield ──
  const bgMat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vP;
      void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vP;
      void main(){
        float u = normalize(vP).y * 0.5 + 0.5;
        // CRUSH: void casi negro puro → los colores de la nube revientan por contraste
        vec3 top = vec3(0.003, 0.005, 0.014);
        vec3 mid = vec3(0.005, 0.004, 0.010);
        vec3 bot = vec3(0.014, 0.007, 0.003);
        vec3 c = mix(bot, mid, smoothstep(0.0, 0.45, u));
        c = mix(c, top, smoothstep(0.45, 1.0, u));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }), []);
  const starfield = useMemo(() => {
    const N = 9000;
    let s = 1122334 >>> 0;
    const rnd = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let z = Math.imul(s ^ (s >>> 15), 1 | s);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
    // tipos espectrales REALES (DOCTRINA-COLOR A2: B-V→color). Distribución: pocas
    // azules calientes, muchas naranjas/rojas frías — como el cielo real.
    const SPEC: [number, number, number][] = [
      [0.62, 0.70, 1.00],  // O/B azul
      [0.80, 0.85, 1.00],  // A blanco-azul
      [0.97, 0.97, 1.00],  // F blanco
      [1.00, 0.93, 0.76],  // G amarillo (Sol)
      [1.00, 0.80, 0.54],  // K naranja
      [1.00, 0.62, 0.40],  // M rojo-naranja
    ];
    const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3);
    const sz = new Float32Array(N); const spike = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let x = 0, y = 0, z = 0, d2 = 2;
      while (d2 > 1 || d2 < 1e-4) { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; d2 = x * x + y * y + z * z; }
      const r = 280 / Math.sqrt(d2);
      pos[i * 3] = x * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = z * r;
      const u = rnd();
      const c = u < 0.08 ? SPEC[0] : u < 0.20 ? SPEC[1] : u < 0.42 ? SPEC[2]
        : u < 0.62 ? SPEC[3] : u < 0.85 ? SPEC[4] : SPEC[5];
      const mag = Math.pow(rnd(), 3.0);           // pocas brillantes-grandes, mar de tenues
      const b = 0.28 + 1.05 * mag;
      col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
      sz[i] = 1.2 + 8.5 * mag;                     // las brillantes son grandes
      spike[i] = mag > 0.62 ? 1 : 0;               // y llevan destellos de difracción
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSz', new THREE.BufferAttribute(sz, 1));
    g.setAttribute('aSpike', new THREE.BufferAttribute(spike, 1));
    return g;
  }, []);
  const starfieldMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uB: { value: starBright }, uRS: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec3 aCol; attribute float aSz; attribute float aSpike;
      uniform float uRS;
      varying vec3 vC; varying float vSpike;
      void main(){
        vC = aCol; vSpike = aSpike;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSz * uRS;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uB;
      varying vec3 vC; varying float vSpike;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        if (r > 1.0) discard;
        // estrella REAL, no píxel: núcleo nítido + halo suave + destellos de
        // difracción en cruz (solo las brillantes) — como las fotos JWST/Hubble.
        float core = exp(-r * r * 8.0);          // núcleo un pelín más ancho = más brilloso
        float halo = exp(-r * 2.3) * 0.5;         // glow más generoso alrededor de cada estrella
        float L = core + halo;
        if (vSpike > 0.5) {
          float sx = exp(-abs(d.x) * 26.0) * exp(-r * 3.0);
          float sy = exp(-abs(d.y) * 26.0) * exp(-r * 3.0);
          L += (sx + sy) * 0.6;
        }
        gl_FragColor = vec4(vC * L * uB, clamp(L, 0.0, 1.0));
      }`,
  }), [starBright]);

  // ── driver: lee el reloj de la clase (audio) y actualiza uniforms ──
  const V_FRONT = useMemo(() => {
    // el frente cubre la nube (r≈2.4 en bin) entre firstIgnite y dawnAt
    return 2.4 / Math.max(20, dawnAt - firstIgnite);
  }, [firstIgnite, dawnAt]);
  useFrame(() => {
    const t = timeRef.current;
    // DIRECCIÓN DE LUZ: al ENTRAR cada animación (inicio de beat) la nube cede
    // el escenario (dim 0.40) y recupera su brillo en ~5 s.
    let dimT = 1;
    for (const bt of beatTimes) {
      if (t >= bt - 0.4 && t < bt + 6) {
        const k = sstep(bt + 1.2, bt + 6, t);            // recuperación
        const drop = 1 - sstep(bt - 0.4, bt + 0.3, t);   // caída al entrar
        dimT = Math.min(dimT, 0.40 + 0.60 * Math.max(drop, k));
      }
    }
    // CALMA sostenida del cierre: la nube cede el escenario al objeto final
    // (enjambre/idea) para que sea el protagonista, sin tapar con el oro pleno.
    if (calmFrom > 0 && t >= calmFrom - 0.5) {
      dimT = Math.min(dimT, 1 - 0.62 * sstep(calmFrom - 0.5, calmFrom + 3, t));
    }
    const front = t < firstIgnite ? 0 : (t - firstIgnite) * V_FRONT;
    const ghost = sstep(ghostWindow[0], ghostWindow[0] + 2, t) * (1 - sstep(ghostWindow[1] - 1.5, ghostWindow[1], t));
    const ghostPulse = ghost * (0.35 + 0.3 * Math.sin(t * 2.1) * Math.sin(t * 3.7));
    // amanecer como PULSO: clímax dorado en dawnAt (~5s) y luego DECAE → la última
    // escena queda sobre un fondo calmado y el objeto (enjambre/idea) es protagonista.
    const dawn = sstep(dawnAt, dawnAt + 5, t) * (1 - 0.72 * sstep(dawnAt + 10, dawnAt + 18, t));
    // PULSO DE VOZ: la nube respira con la narración de Matilda (envelope real,
    // determinista). Boost suave del brillo en los picos de voz → todo el fondo vive.
    const vl = voiceLevel();
    const voiceBoost = 1 + vl * 0.22;
    // escala de resolución: el look se afinó a 1080×1920 (lado largo 1920); a 4K
    // los puntos crecen proporcional para conservar el grosor RELATIVO aprobado
    gl.getDrawingBufferSize(bufSize);
    const rs = Math.max(bufSize.x, bufSize.y) / 1920;
    for (const m of [matBack, matMain, matNear]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uFrontR.value = front;
      m.uniforms.uGhost.value = ghostPulse;
      m.uniforms.uDawn.value = dawn * 0.42;   // amanecer ORO, contenido: no tapa los objetos
      m.uniforms.uDimT.value = dimT * voiceBoost;
      m.uniforms.uRS.value = rs;
    }
    starMat.uniforms.uTime.value = t;
    starMat.uniforms.uRS.value = rs;
    starfieldMat.uniforms.uRS.value = rs;
  });

  return (
    <group>
      <mesh material={bgMat} renderOrder={-70}><sphereGeometry args={[300, 24, 24]} /></mesh>
      <points geometry={starfield} material={starfieldMat} frustumCulled={false} renderOrder={-60} />
      {geo && <points geometry={geo} material={matBack} frustumCulled={false} renderOrder={-52} />}
      {geo && <points geometry={geo} material={matMain} frustumCulled={false} renderOrder={-50} />}
      {geo && <points geometry={geo} material={matNear} frustumCulled={false} renderOrder={-49} />}
      {igniteStars && <points geometry={starGeo} material={starMat} frustumCulled={false} renderOrder={-48} />}
    </group>
  );
}
