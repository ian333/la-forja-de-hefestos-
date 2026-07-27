/**
 * BrujulaCompas — LA BRÚJULA como LEY, no como animación a mano.
 *
 * La aguja ES el imán: su campo dipolar (r = L·sin²θ, |B| ∝ √(1+3cos²θ) — fórmula
 * real) gira CON ella. Perdida, deriva sin rumbo; cuando "despierta" (t=9, la idea),
 * el campo se DIBUJA en partículas que fluyen por las líneas y la aguja relaja al
 * norte por TORQUE real (péndulo magnético linealizado):
 *     θ(t) = Δ · e^(−(t−9)/τ) · cos(ω(t−9))          τ=1.9 s, ω=1.35 rad/s
 * Al clavar el norte, la letra N de la rosa FLAMEA. Desde t=17 (amanecer) las
 * líneas exteriores del campo se vuelven ORO — las rutas que conectaron el mundo.
 *
 * La rosa de los vientos es un grabado REAL (TikZ + EB Garamond,
 * scripts/brujula-rosa.tex → public/textures/brujula-rosa.png): máscara de tinta
 * que el shader convierte en oro grabado sobre laca oscura.
 *
 * TODO es función pura de t (window.__cineT) → determinista, cacheable en render.
 */
import { useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCineTime } from '../useCineTime';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ss = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

// ── parámetros de la cápsula ──
const R_CARD = 1.05;                     // radio de la rosa
const LN = 0.92, LSUR = 0.78, W = 0.050; // aguja: media norte, media sur, semiancho
const T_FIELD = 9.0;                     // la idea: el campo despierta
const TAU = 1.9, OMEGA = 1.35;           // relajación por torque (subamortiguada)
const T_DAWN = 17.0;                     // amanecer: las líneas exteriores → ORO

// deriva "perdida" (suma determinista de senos — sin rumbo, NERVIOSA desde el
// frame 0: el gancho abre con la aguja ya girando, in medias res). Las fases
// ponen el barrido MÁXIMO en t=0 (dθ/dt≈1.0 rad/s; con φ2=2.1 caía en un punto
// de retorno, dθ/dt≈0.03 → aguja quieta justo en la ventana de captura)
const wander = (t: number) =>
  1.55 * Math.sin(0.42 * t + 0.9) + 0.95 * Math.sin(0.71 * t + 0.35) + 0.5 * Math.sin(0.23 * t + 4.4);
const DELTA = wander(T_FIELD);           // ángulo al momento de la ignición (continuidad)
// aguja: perdida → péndulo magnético amortiguado hacia el norte (θN = 0)
const needleTheta = (t: number) =>
  t < T_FIELD ? wander(t) : DELTA * Math.exp(-(t - T_FIELD) / TAU) * Math.cos(OMEGA * (t - T_FIELD));
// instante en que la envolvente cae bajo ~3.5° → la N flamea
const T_LOCK = T_FIELD + TAU * Math.log(Math.abs(DELTA) / 0.06);

// ── campo dipolar de LÍNEAS DE NEÓN (receta de los átomos virales adaptada a
// cámara frontal): cada línea r=L·sin²θ son CIENTOS de puntos contiguos → una
// curva luminosa SÓLIDA, y el FLUJO es un pulso de brillo que VIAJA por ella
// (2 armónicos = energía nerviosa). Acimutes sesgados al plano de pantalla
// (los arcos se LEEN) + algunos fuera de plano (profundidad al serpentear). ──
const PHIS = [0, 0.28, -0.28, 0.65, -0.65, 1.1, -1.1,
  Math.PI, Math.PI + 0.28, Math.PI - 0.28, Math.PI + 0.65, Math.PI - 0.65, Math.PI + 1.1, Math.PI - 1.1];
const SHELL_LF = [1.5, 2.0, 2.6, 3.4, 4.4, 5.6, 7.0];  // conchas (L en unidades de escena)
const STEPS = 300;                        // puntos por línea → curva CONTINUA

const FIELD_VERT = /* glsl */`
attribute float aAlong; attribute float aMag; attribute float aShell; attribute float aGoldable;
uniform float uTime, uPx, uRS;
varying vec3 vC; varying float vA;
void main(){
  // el campo nace en cascada por concha (la idea ENCIENDE) y se dibuja del
  // polo norte hacia abajo — borde del reveal SUAVE (nada de bandas duras)
  float tIgn = ${T_FIELD.toFixed(2)} + aShell * 0.22;
  float born = smoothstep(tIgn, tIgn + 0.45, uTime);
  float reveal = smoothstep(0.0, 1.0, (uTime - tIgn) / 1.5) * 1.06;
  float vis = 1.0 - smoothstep(reveal - 0.04, reveal + 0.04, aAlong);
  // PRÓLOGO (gancho): el campo YA ARDE en el frame 0 — barre con la aguja
  // mientras la cámara se clava — y MUERE hacia t≈4 replegándose hacia la
  // aguja (conchas exteriores primero: la luz se apaga de afuera hacia adentro,
  // la idea "se pierde"). Renace a los 9 s = payoff del lazo abierto.
  float prologo = 1.0 - smoothstep(2.3 - aShell * 0.14, 4.1 - aShell * 0.14, uTime);
  // FLUJO: pulso de brillo viajando (violento: 2 armónicos, receta del átomo)
  float flow = 0.4 + 0.6 * sin(aAlong * 34.0 - uTime * 4.2)
                   + 0.25 * sin(aAlong * 71.0 - uTime * 7.3);
  flow = clamp(flow, 0.0, 1.4);
  // amanecer: conchas exteriores → ORO (las rutas que cruzan el mundo)
  float gold = smoothstep(0.0, 1.0, (uTime - (${T_DAWN.toFixed(1)} + aShell * 0.45)) / 2.4) * aGoldable;
  vec3 teal = vec3(0.30, 0.85, 1.00);
  vec3 hot  = vec3(0.90, 1.00, 1.00);
  vec3 oro  = vec3(1.10, 0.78, 0.30);
  vec3 base = mix(teal, hot, aMag * 0.55);
  vC = mix(base, oro, gold) * (0.45 + 1.15 * aMag) * (0.55 + 0.65 * flow);
  float pres = max(born * vis, prologo);
  vA = pres * (0.16 + 0.36 * aMag) * (0.5 + 0.75 * flow);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // pz BLINDADO: la cámara serpentea A TRAVÉS del campo → puntos detrás de la
  // cámara dan -mv.z ≤ 0 → gl_PointSize negativo/∞ = TDR del driver (D3D12
  // mata el contexto ENTERO). clamp() garantiza tamaño finito y positivo.
  float pz = max(0.12, -mv.z);
  gl_PointSize = clamp((1.7 + 2.6 * aMag) * (0.7 + 0.55 * flow) * (uPx * uRS / pz), 0.0, (5.4 + 2.2 * aMag) * uRS);
}`;
const FIELD_FRAG = /* glsl */`
precision highp float;
varying vec3 vC; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float a = smoothstep(0.25, 0.0, r2);
  gl_FragColor = vec4(vC * a, a * vA);
}`;

// la rosa: laca oscura + grabado que despierta a ORO + flama en la N al clavar norte
const CARD_FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap; uniform float uWake, uFlare, uTime, uExposure;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 c = vUv - 0.5;
  float rr = length(c) * 2.0;
  if (rr > 1.0) discard;
  float ink = 1.0 - texture2D(uMap, vUv).r;
  // laca profunda con veta sutil y brillo que respira hacia el borde
  float fib = 0.94 + 0.09 * hash(floor(vUv * 620.0));
  float sheen = 0.75 + 0.45 * pow(1.0 - rr, 1.4) + 0.22 * pow(rr, 6.0);
  vec3 laca = vec3(0.030, 0.035, 0.056) * sheen * fib;
  // grabado: acero DORMIDO apenas insinuado → oro despierto; resplandor giratorio
  float glint = 0.88 + 0.12 * sin(atan(c.y, c.x) * 2.0 + uTime * 0.35);
  vec3 frio = vec3(0.115, 0.145, 0.225);
  vec3 oro  = vec3(1.02, 0.74, 0.30);
  vec3 marca = mix(frio, oro, uWake) * glint * (0.15 + 0.95 * uWake);
  vec3 col = mix(laca, marca, ink);
  // la N (arriba, 81°) FLAMEA cuando la aguja clava el norte
  vec2 nPos = vec2(0.5695, 0.9315) - 0.5;
  float dN = length(c - nPos);
  col += vec3(1.25, 0.86, 0.34) * exp(-dN * dN / 0.0016) * uFlare * (0.75 + 0.25 * sin(uTime * 2.3));
  gl_FragColor = vec4(col * uExposure, 1.0);
}`;
const CARD_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// aguja: lanza norte oro con punta al blanco vivo; contrapeso sur de acero frío.
// El "bisel" (cresta central más viva que los cantos) la hace sentir forjada.
const NEEDLE_FRAG = /* glsl */`
precision highp float;
uniform float uWake, uTime, uExposure;
varying vec2 vP;
void main(){
  // cresta central viva + cantos que caen a sombra → se SIENTE forjada, no tubo.
  // OJO: max() antes del pow — la interpolación puede dar |x| = 1+ε y
  // pow(negativo) = NaN en GLSL → el bloom esparce el NaN → FRAME ENTERO negro.
  float bevel = 0.38 + 0.62 * pow(max(1.0 - abs(vP.x), 0.0), 1.7);
  vec3 col;
  if (vP.y > 0.0) {
    float tip = pow(vP.y, 2.1);
    col = mix(vec3(0.98, 0.66, 0.24), vec3(1.65, 1.38, 0.98), tip) * (0.55 + 0.85 * uWake);
    col += vec3(0.9, 0.75, 0.4) * tip * uWake * (0.6 + 0.4 * sin(uTime * 1.7));
  } else {
    col = vec3(0.165, 0.205, 0.33) * (0.40 + 0.22 * uWake);
  }
  gl_FragColor = vec4(col * bevel * uExposure, 1.0);
}`;
const NEEDLE_VERT = /* glsl */`
attribute vec2 aNP;
varying vec2 vP;
void main(){ vP = aNP; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// bisel del aro: destello especular que recorre el metal (vivo, determinista)
const RING_FRAG = /* glsl */`
precision highp float;
uniform float uTime, uWake, uExposure;
varying float vAng;
void main(){
  float glint = pow(max(cos(vAng - 0.9 - uTime * 0.22), 0.0), 10.0);
  float glint2 = pow(max(cos(vAng + 2.3 + uTime * 0.13), 0.0), 14.0);
  vec3 col = vec3(0.34, 0.26, 0.15) * (0.8 + 0.5 * uWake) + vec3(1.05, 0.82, 0.45) * (glint + glint2) * (0.5 + 0.7 * uWake);
  gl_FragColor = vec4(col * uExposure, 1.0);
}`;
const RING_VERT = /* glsl */`
varying float vAng;
void main(){ vAng = atan(position.y, position.x); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export default function BrujulaCompas() {
  const timeRef = useCineTime();
  const gl = useThree(s => s.gl);
  const bufSize = useMemo(() => new THREE.Vector2(), []);
  const rotor = useRef<THREE.Group>(null);

  const rosa = useLoader(THREE.TextureLoader, '/textures/brujula-rosa.png');
  useMemo(() => {
    rosa.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    rosa.colorSpace = THREE.NoColorSpace;
  }, [rosa, gl]);

  // ── campo dipolar DENSO (posiciones estáticas, flujo = pulso en el shader) ──
  const { fieldGeo, fieldMat } = useMemo(() => {
    const pos: number[] = [], along: number[] = [], mag: number[] = [];
    const shell: number[] = [], goldable: number[] = [];
    for (const phi of PHIS) {
      for (let si = 0; si < SHELL_LF.length; si++) {
        const L = SHELL_LF[si];
        for (let i = 0; i < STEPS; i++) {
          const tt = 0.04 + (i / STEPS) * 0.92;
          const th = tt * Math.PI;
          const s = Math.sin(th), c = Math.cos(th);
          const r = Math.max(L * s * s, 0.16);
          pos.push(r * s * Math.cos(phi), r * c, r * s * Math.sin(phi));
          along.push(tt);
          // |B| ∝ 1/r³·√(1+3cos²θ): polos calientes + conchas internas más vivas
          const poleBoost = 0.4 + 0.6 * Math.abs(c);
          const shellFall = Math.pow(1.5 / L, 1.35);
          mag.push(Math.max(0.10, Math.min(1, poleBoost * shellFall)));
          shell.push(si);
          goldable.push(L >= 3.4 ? 1 : 0);              // las rutas = conchas exteriores
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('aAlong', new THREE.BufferAttribute(new Float32Array(along), 1));
    geo.setAttribute('aMag', new THREE.BufferAttribute(new Float32Array(mag), 1));
    geo.setAttribute('aShell', new THREE.BufferAttribute(new Float32Array(shell), 1));
    geo.setAttribute('aGoldable', new THREE.BufferAttribute(new Float32Array(goldable), 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 30);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: 360 }, uRS: { value: 1 } },
      vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG,
    });
    return { fieldGeo: geo, fieldMat: mat };
  }, []);

  // ── la rosa (disco opaco) ──
  const cardMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: rosa }, uWake: { value: 0 }, uFlare: { value: 0 },
      uTime: { value: 0 }, uExposure: { value: 1.0 },
    },
    vertexShader: CARD_VERT, fragmentShader: CARD_FRAG,
  }), [rosa]);

  // ── aguja (cometa con coordenadas propias aNP: x∈[−1,1], y∈[−1,1]) ──
  const { needleGeo, needleMat } = useMemo(() => {
    const v = new Float32Array([
      0, LN, 0, W, 0, 0, 0, -LSUR, 0, -W, 0, 0,
    ]);
    const np = new Float32Array([0, 1, 1, 0, 0, -1, -1, 0]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    geo.setAttribute('aNP', new THREE.BufferAttribute(np, 2));
    geo.setIndex([0, 3, 1, 1, 3, 2]);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uWake: { value: 0 }, uTime: { value: 0 }, uExposure: { value: 1.0 } },
      vertexShader: NEEDLE_VERT, fragmentShader: NEEDLE_FRAG, side: THREE.DoubleSide,
    });
    return { needleGeo: geo, needleMat: mat };
  }, []);

  const ringMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uWake: { value: 0 }, uExposure: { value: 1.0 } },
    vertexShader: RING_VERT, fragmentShader: RING_FRAG,
  }), []);

  useFrame(() => {
    const t = timeRef.current;
    const wake = ss((t - T_FIELD) / 2.0);
    const flare = ss((t - T_LOCK) / 0.9);
    fieldMat.uniforms.uTime.value = t;
    gl.getDrawingBufferSize(bufSize);
    fieldMat.uniforms.uRS.value = Math.max(bufSize.x, bufSize.y) / 1920;
    cardMat.uniforms.uWake.value = wake;
    cardMat.uniforms.uFlare.value = flare;
    cardMat.uniforms.uTime.value = t;
    needleMat.uniforms.uWake.value = wake;
    needleMat.uniforms.uTime.value = t;
    ringMat.uniforms.uTime.value = t;
    ringMat.uniforms.uWake.value = wake;
    if (rotor.current) rotor.current.rotation.z = needleTheta(t);
  });

  return (
    <group>
      {/* rosa + aro (fijos): el mundo tiene norte; la aguja lo ENCUENTRA */}
      <mesh material={cardMat} renderOrder={-22}>
        <circleGeometry args={[R_CARD, 128]} />
      </mesh>
      <mesh material={ringMat} renderOrder={-21}>
        <torusGeometry args={[R_CARD + 0.048, 0.030, 24, 160]} />
      </mesh>
      {/* aguja + SU campo dipolar giran juntos (la aguja es el imán) */}
      <group ref={rotor}>
        <mesh geometry={needleGeo} material={needleMat} position={[0, 0, 0.075]} renderOrder={-19} />
        <points geometry={fieldGeo} material={fieldMat} frustumCulled={false} renderOrder={-18} />
      </group>
      {/* capitel del pivote */}
      <mesh position={[0, 0, 0.10]} renderOrder={-17}>
        <circleGeometry args={[0.046, 40]} />
        <meshBasicMaterial color="#E8C070" toneMapped={false} />
      </mesh>
    </group>
  );
}
