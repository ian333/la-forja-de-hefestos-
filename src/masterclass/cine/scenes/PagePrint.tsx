/**
 * PagePrint — LA IMPRENTA como LEY, no como animación a mano.
 *
 * v2 (feedback Ian): HOJAS LITERALES. Cada página es un quad con una página de
 * incunable REAL tipografiada en LaTeX (EB Garamond, capitular, la idea de la
 * cápsula impresa — scripts/imprenta-pagina.tex → public/textures/imprenta-pagina.png).
 * La textura es tinta negra sobre blanco y el shader pone el color: papel crema,
 * tinta sepia, y la línea RECIÉN impresa brilla oro bajo la platina.
 *
 * La coreografía sigue siendo función pura de t (window.__cineT via useCineTime):
 *   · barra de impresión  uBar(t) ∈ [-0.06, 1.06]  (arriba→abajo, con overshoot
 *     para que ningún renglón nazca medio-impreso)
 *   · tinta revelada      = pageY < uBar            (lo ya barrido queda impreso)
 *   · nacimiento de copia = smoothstep(aBirth, aBirth+.45, t)  (nace ya impresa)
 * Sin keyframes: la ley mueve la imagen. Determinista → cacheable en render.
 */
import { useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCineTime } from '../useCineTime';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ss = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let z = Math.imul(s ^ (s >>> 15), 1 | s); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
}

// ── parámetros de la cápsula ──
const GENS = 6;                       // 0..5 → 1+2+4+8+16+32 = 63 páginas
const PW = 1.35, PH = 1.85;           // tamaño de página (135×185 mm del .tex)
const T_PRINT0 = 2.5, T_PRINT1 = 7.0; // ventana del barrido de impresión
const T_COPY = 9.0, DUP = 1.5;        // 1ª copia en t=9, cada generación +1.5 s
// overshoot [-0.06, 1.06]: la platina entra por ARRIBA de la hoja y sale por
// abajo — ningún renglón está impreso antes de empezar ni a medias al final.
const uBarAt = (t: number) => -0.06 + 1.12 * ss((t - T_PRINT0) / (T_PRINT1 - T_PRINT0));

// layout de páginas: gen g al fondo (z=-g·2.6); dentro de la gen, rejilla que se
// ABRE más ancha cada generación → 1 página → muchas que llenan y se alejan.
function pageLayout(): { cx: number; cy: number; cz: number; birth: number }[] {
  const r = rng(3312);
  const out: { cx: number; cy: number; cz: number; birth: number }[] = [];
  let P = 0; for (let g = 0; g < GENS; g++) P += 1 << g;
  for (let p = 0; p < P; p++) {
    const g = Math.floor(Math.log2(p + 1));
    const base = 1 << g, j = p + 1 - base;
    if (g === 0) { out.push({ cx: 0, cy: 0, cz: 0, birth: -1 }); continue; }
    const cols = Math.ceil(Math.sqrt(base)), rows = Math.ceil(base / cols);
    const col = j % cols, rw = Math.floor(j / cols);
    const spanX = 2.0 + g * 1.35, spanY = 2.7 + g * 1.7;
    const cx = (cols > 1 ? (col / (cols - 1) - 0.5) * spanX : 0) + (r() - 0.5) * 0.5;
    const cy = (rows > 1 ? (rw / (rows - 1) - 0.5) * spanY : 0) + (r() - 0.5) * 0.5;
    const cz = -g * 2.6 + (r() - 0.5) * 1.1;
    out.push({ cx, cy, cz, birth: T_COPY + (g - 1) * DUP });
  }
  return out;
}

const VERT = /* glsl */`
attribute vec3 aCenter; attribute vec2 aCorner; attribute float aBirth; attribute float aOrig; attribute float aJit;
uniform float uTime;
varying vec2 vUv; varying float vBorn; varying float vOrig; varying float vJit;
void main(){
  float born = smoothstep(aBirth, aBirth + 0.45, uTime);
  float pop = 0.6 + 0.4 * born;                            // aparece con un pequeño pop
  vec3 world = aCenter + vec3(aCorner * pop, 0.0);
  vUv = uv; vBorn = born; vOrig = aOrig; vJit = aJit;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}`;
const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap; uniform float uBar, uExposure;
varying vec2 vUv; varying float vBorn; varying float vOrig; varying float vJit;
// fibra del papel: ruido determinista chiquito (±4%) para que no sea plástico
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  if (vBorn <= 0.001) discard;
  float ink = 1.0 - texture2D(uMap, vUv).r;                // negro del .tex = tinta
  float pageY = 1.0 - vUv.y;                               // 0 arriba → 1 abajo
  // la ORIGINAL se revela con la platina; las COPIAS nacen ya impresas
  float printed = vOrig > 0.5 ? (1.0 - smoothstep(uBar - 0.006, uBar + 0.006, pageY)) : 1.0;
  // papel crema con fibra + esquinas apenas quemadas (viñeta de página vieja)
  float fib = 0.96 + 0.05 * hash(floor(vUv * 780.0));
  float edge = smoothstep(0.0, 0.10, vUv.x) * smoothstep(0.0, 0.10, 1.0 - vUv.x)
             * smoothstep(0.0, 0.10, vUv.y) * smoothstep(0.0, 0.10, 1.0 - vUv.y);
  vec3 paper = vec3(0.86, 0.79, 0.62) * (0.62 + 0.13 * edge) * fib * (0.92 + 0.08 * vJit);
  vec3 inkC  = vec3(0.16, 0.115, 0.075);
  vec3 col = mix(paper, inkC, ink * printed);
  // la línea RECIÉN impresa arde oro bajo la platina (solo mientras barre)
  if (vOrig > 0.5 && uBar > 0.0 && uBar < 1.06) {
    float band = exp(-pow((pageY - uBar) * 30.0, 2.0));
    col += vec3(1.15, 0.82, 0.30) * band * (0.25 + 1.35 * ink);
  }
  gl_FragColor = vec4(col * uExposure, vBorn);
}`;

export default function PagePrint() {
  const timeRef = useCineTime();
  const gl = useThree(s => s.gl);
  const barRef = useRef<THREE.Mesh>(null);
  const barMat = useRef<THREE.MeshBasicMaterial>(null);

  const map = useLoader(THREE.TextureLoader, '/textures/imprenta-pagina.png');
  useMemo(() => {
    map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    map.colorSpace = THREE.NoColorSpace;                    // máscara de tinta, no color
  }, [map, gl]);

  const { geo, mat } = useMemo(() => {
    const pages = pageLayout();
    const N = pages.length;
    const pos = new Float32Array(N * 4 * 3);                // requerido por three (no se usa)
    const aCenter = new Float32Array(N * 4 * 3), aCorner = new Float32Array(N * 4 * 2);
    const auv = new Float32Array(N * 4 * 2);
    const aBirth = new Float32Array(N * 4), aOrig = new Float32Array(N * 4), aJit = new Float32Array(N * 4);
    const idx: number[] = [];
    const r = rng(9091);
    const CORN = [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]];
    for (let pi = 0; pi < N; pi++) {
      const pg = pages[pi]; const jit = r();
      for (let c = 0; c < 4; c++) {
        const k = pi * 4 + c;
        aCenter[k * 3] = pg.cx; aCenter[k * 3 + 1] = pg.cy; aCenter[k * 3 + 2] = pg.cz;
        aCorner[k * 2] = CORN[c][0] * PW; aCorner[k * 2 + 1] = CORN[c][1] * PH;
        auv[k * 2] = CORN[c][2]; auv[k * 2 + 1] = CORN[c][3];
        aBirth[k] = pg.birth; aOrig[k] = pi === 0 ? 1 : 0; aJit[k] = jit;
      }
      const b = pi * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aCenter', new THREE.BufferAttribute(aCenter, 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(aCorner, 2));
    g.setAttribute('uv', new THREE.BufferAttribute(auv, 2));
    g.setAttribute('aBirth', new THREE.BufferAttribute(aBirth, 1));
    g.setAttribute('aOrig', new THREE.BufferAttribute(aOrig, 1));
    g.setAttribute('aJit', new THREE.BufferAttribute(aJit, 1));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -8), 40);
    const m2 = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true, depthTest: true, side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 }, uBar: { value: -0.06 }, uMap: { value: map }, uExposure: { value: 1.0 },
      },
      vertexShader: VERT, fragmentShader: FRAG,
    });
    return { geo: g, mat: m2 };
  }, [map]);

  useFrame(() => {
    const t = timeRef.current;
    const uBar = uBarAt(t);
    mat.uniforms.uTime.value = t;
    mat.uniforms.uBar.value = uBar;
    // la PLATINA: barra de luz que baja mientras imprime la original (2.5–7 s)
    if (barRef.current && barMat.current) {
      const y = (0.5 - uBar) * PH;
      barRef.current.position.set(0, y, 0.03);
      const on = ss((t - (T_PRINT0 - 0.2)) / 0.4) * (1 - ss((t - (T_PRINT1 - 0.1)) / 0.5));
      barMat.current.opacity = on;
      barRef.current.visible = on > 0.01;
    }
  });

  return (
    <group>
      <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={-20} />
      <mesh ref={barRef} renderOrder={-19}>
        <planeGeometry args={[PW * 1.12, 0.045]} />
        <meshBasicMaterial ref={barMat} color="#FFE7B0" transparent opacity={0}
          blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
