/**
 * SilicioNube — EL SILICIO DOPADO EN 3D, con el MOTOR del O₂ viral.
 *
 * Ian: "o2 y los demás átomos vienen con su código, y si no estoy mal debes de
 * precomputar los valores, ¿no?" — exacto. Este archivo NO calcula nada:
 * `scripts/precompute-silicio-particulas.py` (PySCF/PBC) resuelve el campo, lo
 * muestrea en partículas por inverse-CDF y escribe el .bin. Aquí solo se DIBUJA.
 *
 * Shader = O2FLOW_VERT/FRAG de CinematicMolecule.tsx, COPIADO TAL CUAL (es el
 * que sobrevivió al O₂ viral y a la serie de enlaces):
 *   · gaussiano PROCEDURAL (smoothstep(0.5,0,d)) — sin textura de sprite
 *   · vNear = smoothstep(0.22, 0.85, -mv.z) → el polvo se APARTA del lente al
 *     volar dentro de la nube (y de paso mata el alpha detrás de cámara)
 *   · gl_PointSize = min(uSize * (300/-mv.z), 64) · AdditiveBlending
 *
 * LAS 3 NUBES (roles y colores de la serie — Ian eligió "los del O₂ viral"):
 *   · acumulación → ORO→ÁMBAR, corazón ORO BLANCO = el ENLACE (Δρ>0: la carga
 *     que SE MOVIÓ al puente). Los colores vienen EN el .bin, por rol físico.
 *   · vaciado     → AZUL PROFUNDO [0.18,0.42,0.95] (no teal: "daba tinte verdoso")
 *   · espín       → VIOLETA [0.80,0.34,1.0] = EL ELECTRÓN DEL DOPANTE. En el Si
 *     puro esta nube estaría VACÍA. Existe porque cambiamos UN átomo por fósforo.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCineTime } from '../useCineTime';

export const T = {
  enlace:  0.0,    // el cristal ARDIENDO desde el frame 0 (sin fade: doctrina)
  dentro:  8.0,    // la cámara ENTRA en la nube
  vaciado: 14.0,   // el azul: de dónde salió la carga
  donor:   21.0,   // el VIOLETA: el electrón que el fósforo regala
  campoE:  28.0,   // ⚡ ESA CARGA GENERA CAMPO ELÉCTRICO (Poisson sobre Δρ real)
  iman:    35.0,   // 🧲 Y EL ESPÍN ES UN IMÁN: campo dipolar (μ ≈ 1 μ_B)
  solo:    42.0,   // solo el electrón + su imán: ESE conduce, ESE es el qubit
  fin:     52.0,
};

// ── el shader del O₂ + el MOVIMIENTO CUÁNTICO de CinematicAtom ──
// ⚠️ La 1ª versión dibujaba las partículas FIJAS. Ian: "en el punto más salvaje
// donde un electrón aparece y desaparece, ¿todo está fijo?" y —peor— "me da a
// entender que hay millones de electrones, no una nube de 1 electrón moviéndose".
// Tenía razón, y era un ERROR FÍSICO, no estético: |ψ|² NO son 20,000 electrones;
// son las posiciones POSIBLES de UNO. Dibujarlas quietas comunica una mentira.
// La receta correcta ya estaba en CinematicAtom (118 videos): respiración radial
// + circulación tangencial (la corriente de probabilidad real) + titileo por
// partícula — todo CONSERVANDO la densidad promedio |ψ|². El electrón no es un
// punto: es una probabilidad VIVA que aparece y desaparece.
const FLOW_VERT = /* glsl */ `
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vNear;
  varying float vPulse;
  uniform float uSize;
  uniform float uTime;
  uniform float uLive;     // 0..1 — cuánta vida cuántica (0 = congelado)
  void main() {
    vColor = aColor;
    // fase única por partícula (hash de su posición: determinista, puro en t)
    float ph = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831853;

    // MOVIMIENTO CUÁNTICO — la densidad PROMEDIO se conserva
    vec3 p = position;
    float r = length(p) + 1e-4;
    vec3 radial = p / r;
    vec3 tang = normalize(vec3(-p.z, 0.0, p.x) + vec3(1e-4));
    float breath = sin(uTime * 1.4 + ph);            // respira
    float swirl  = sin(uTime * 0.9 + ph * 1.7);      // circula (corriente de prob.)
    p += (radial * (0.055 * r * breath) + tang * (0.070 * r * swirl)) * uLive;

    // VIDA CUÁNTICA: cada partícula aparece y DESAPARECE con su propio ritmo.
    // Piso 0.42 → la forma nunca se pierde, pero el parpadeo dice "probabilidad".
    float u = fract(ph * 0.15915494);
    float rate = 0.5 + 0.8 * u;
    float life = fract(uTime * rate + u);
    float flick = smoothstep(0.0, 0.25, life) * (1.0 - smoothstep(0.55, 1.0, life));
    vPulse = mix(1.0, 0.42 + 0.58 * flick, uLive);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // el polvo SE APARTA del lente al volar DENTRO de la nube
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
    float a = smoothstep(0.5, 0.0, d) * vNear * vPulse;   // gaussiano PROCEDURAL
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * a * uBright, a);
  }`;

// ── LOS CAMPOS: el donor no es un punto, es carga (E) + espín (B) ──
// Ian: "la carga genera campos magnéticos y eléctricos, no veo nada de eso".
// E de Poisson sobre Δρ real; B del momento magnético del espín (μ ≈ 1 μ_B):
// un átomo de fósforo en silicio ES UN IMÁN (por eso sirve de qubit, Kane 1998).
const FIELD_VERT = /* glsl */ `
  attribute float aAlong;    // 0..1 a lo largo de la línea
  attribute float aLine;     // índice de línea
  varying float vA;
  uniform float uTime;
  uniform float uSize;
  uniform float uOn;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float near = smoothstep(0.22, 0.85, -mv.z);
    // PULSO VIAJERO: el campo no es un dibujo estático, se PROPAGA
    float trav = fract(aAlong * 1.6 - uTime * 0.55 + aLine * 0.13);
    float wave = smoothstep(0.55, 1.0, trav);
    vA = uOn * near * (0.16 + 0.84 * wave);
    // ⚠️ TAMAÑO: uSize=0.11 daba puntos de 4 px a distancia 8 (0.11*300/8) —
    // 1,728 puntitos INVISIBLES entre 86,000 partículas de nube. Las líneas
    // tienen que COMPETIR con la nube, no esconderse en ella. A 0.9 → 34 px.
    gl_PointSize = min(uSize * (300.0 / -mv.z), 48.0);
    gl_Position = projectionMatrix * mv;
  }`;
const FIELD_FRAG = /* glsl */ `
  varying float vA;
  uniform vec3 uCol;
  uniform float uBright;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uCol * a * uBright, a);
  }`;

type Nubes = {
  accPos: Float32Array; accCol: Float32Array;
  depPos: Float32Array; spinPos: Float32Array;
  nAcc: number; nDep: number; nSpin: number; escala: number;
};

function useNubes(): Nubes | null {
  const [d, setD] = useState<Nubes | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/precomputed/silicio-particulas.bin')
      .then(r => { if (!r.ok) throw new Error(`bin ${r.status}`); return r.arrayBuffer(); })
      .then(buf => {
        if (!alive) return;
        const dv = new DataView(buf);
        const nAcc = dv.getInt32(0, true), nDep = dv.getInt32(4, true), nSpin = dv.getInt32(8, true);
        const escala = dv.getFloat32(12, true);
        let o = 16;
        const cb = new Uint8Array(buf.slice(o, o + nAcc * 3)); o += nAcc * 3;
        const accCol = new Float32Array(nAcc * 3);
        for (let i = 0; i < nAcc * 3; i++) accCol[i] = cb[i] / 255;
        const accPos = new Float32Array(buf.slice(o, o + nAcc * 12)); o += nAcc * 12;
        const depPos = new Float32Array(buf.slice(o, o + nDep * 12)); o += nDep * 12;
        const spinPos = new Float32Array(buf.slice(o, o + nSpin * 12));
        setD({ accPos, accCol, depPos, spinPos, nAcc, nDep, nSpin, escala });
        // ⚠️ CONTRATO con render-clase.cjs: espera `window.__nebulaReady === true`
        // (línea 152) antes del primer frame. Sin esto el render muere en el
        // frame 0 con "waitForFunction: Timeout 30000ms" y no escribe NADA.
        // El nombre es histórico (NebulaWorld) pero lo usan TODAS las escenas.
        (window as any).__nebulaReady = true;
      })
      .catch(e => console.error('[SilicioNube] no cargó el .bin:', e));
    return () => { alive = false; };
  }, []);
  return d;
}

type Campos = { E: Float32Array; B: Float32Array; nE: number; nB: number; lp: number };
function useCampos(): Campos | null {
  const [d, setD] = useState<Campos | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/precomputed/silicio-campos.bin')
      .then(r => { if (!r.ok) throw new Error(`campos ${r.status}`); return r.arrayBuffer(); })
      .then(buf => {
        if (!alive) return;
        const dv = new DataView(buf);
        const nE = dv.getInt32(0, true), nB = dv.getInt32(4, true), lp = dv.getInt32(8, true);
        let o = 16;
        const E = new Float32Array(buf.slice(o, o + nE * lp * 12)); o += nE * lp * 12;
        const B = new Float32Array(buf.slice(o, o + nB * lp * 12));
        setD({ E, B, nE, nB, lp });
      })
      .catch(e => console.error('[SilicioNube] campos:', e));
    return () => { alive = false; };
  }, []);
  return d;
}

function Nube({ pos, col, n, bright, size, live }:
  { pos: Float32Array; col: Float32Array; n: number; bright: number; size: number; live: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return g;
  }, [pos, col]);
  // uniforms estables (regla del proyecto: useMemo + mutar .value, nunca inline)
  const uni = useMemo(() => ({
    uSize: { value: size }, uBright: { value: bright },
    uTime: { value: 0 }, uLive: { value: live },
  }), []);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    u.uSize.value = size; u.uBright.value = bright; u.uLive.value = live;
    u.uTime.value = clock.elapsedTime;
  });
  if (n === 0) return null;
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} uniforms={uni} vertexShader={FLOW_VERT} fragmentShader={FLOW_FRAG}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function LineasCampo({ data, n, lp, col, bright, size }:
  { data: Float32Array; n: number; lp: number; col: [number,number,number]; bright: number; size: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data, 3));
    const along = new Float32Array(n * lp), line = new Float32Array(n * lp);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < lp; j++) { along[i*lp+j] = j/(lp-1); line[i*lp+j] = i; }
    g.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    g.setAttribute('aLine', new THREE.BufferAttribute(line, 1));
    return g;
  }, [data, n, lp]);
  const uni = useMemo(() => ({
    uSize: { value: size }, uBright: { value: bright }, uOn: { value: 1 },
    uTime: { value: 0 }, uCol: { value: new THREE.Vector3(...col) },
  }), []);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    mat.current.uniforms.uBright.value = bright;
    mat.current.uniforms.uTime.value = clock.elapsedTime;
  });
  if (bright <= 0.001) return null;
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} uniforms={uni} vertexShader={FIELD_VERT} fragmentShader={FIELD_FRAG}
        transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export default function SilicioNube() {
  const d = useNubes();
  const campos = useCampos();
  const tRef = useCineTime();
  const { camera } = useThree();
  const grp = useRef<THREE.Group>(null);
  const [br, setBr] = useState({ acc: 0, dep: 0, spin: 0, E: 0, B: 0, live: 1 });

  // colores planos de las nubes dep/spin (los del O₂, exactos)
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
    // ── brillos por beat (los del O₂: BAJOS — "más luz ≠ más color") ──
    // ⚠️ SIN FADE DESDE NEGRO. La neurociencia del gancho lo prohíbe: "Fade desde
    // negro" está en la lista de lo que NO puede haber en los primeros 100 ms —
    // "el onset abrupto es lo que captura". El cristal YA ESTÁ ARDIENDO en el
    // frame 0. (Y de paso: con fade, el frame 0 salía negro y render-clase lo
    // rechazaba como "context-lost" — el mismo error que me costó un día.)
    const acc = 0.50 * (1 - 0.80 * THREE.MathUtils.smoothstep(t, T.iman, T.iman + 2.5));
    const dep = 0.26 * THREE.MathUtils.smoothstep(t, T.vaciado, T.vaciado + 3)
              * (1 - 0.8 * THREE.MathUtils.smoothstep(t, T.campoE, T.campoE + 3));
    // el espín se ATENÚA cuando entran los campos: si no, las líneas se pierden
    // dentro de la nube (mismo color, y la cámara adentro). Un dipolo SOLO se
    // lee desde afuera y con espacio — como la brújula de la cápsula #2.
    const spin = 0.62 * THREE.MathUtils.smoothstep(t, T.donor, T.donor + 3)
               * (1 - 0.85 * THREE.MathUtils.smoothstep(t, T.iman, T.iman + 2.5));
    // ⚡ el campo E: la carga del donor lo genera (Poisson sobre Δρ real)
    const E = 0.85 * THREE.MathUtils.smoothstep(t, T.campoE, T.campoE + 2.5)
            * (1 - 0.7 * THREE.MathUtils.smoothstep(t, T.iman, T.iman + 3));
    // 🧲 el campo B: el ESPÍN del donor es un imán (μ ≈ 1 μ_B) → dipolo real
    const B = 1.0 * THREE.MathUtils.smoothstep(t, T.iman, T.iman + 2.5);
    setBr({ acc, dep, spin, E, B, live: 1 });

    // rotación lenta (la nube RESPIRA; el objeto contempla)
    if (grp.current) grp.current.rotation.y = t * 0.16;

    // ── cámara: fuera → DENTRO de la nube → sale ──
    let dist: number;
    if (t < T.dentro) {
      dist = 9.5 - 5.2 * THREE.MathUtils.smoothstep(t, 0, T.dentro);
    } else if (t < T.donor) {
      dist = 4.3 - 2.6 * THREE.MathUtils.smoothstep(t, T.dentro, T.donor);   // DENTRO
    } else if (t < T.campoE) {
      dist = 1.7 + 1.4 * THREE.MathUtils.smoothstep(t, T.donor, T.campoE);
    } else if (t < T.iman) {
      // el campo E: retroceder para ver de dónde SALE la carga
      dist = 3.1 + 2.2 * THREE.MathUtils.smoothstep(t, T.campoE, T.iman);
    } else {
      // 🧲 EL IMÁN: SALIR a ver el dipolo COMPLETO. Un dipolo solo se lee desde
      // afuera: adentro es puro ruido. La brújula (cápsula #2) enseñó esto.
      dist = 5.3 + 3.6 * THREE.MathUtils.smoothstep(t, T.iman, T.fin);
    }
    const a = 0.5 + t * 0.09;
    // en el beat del imán la cámara sube: el dipolo se lee de LADO (los lóbulos
    // norte-sur), nunca desde el eje — visto por el polo se ve un círculo y ya.
    const alt = t > T.iman ? 0.42 : 0.20;
    camera.position.set(Math.sin(a) * dist, dist * alt, Math.cos(a) * dist);
    camera.lookAt(0, 0, 0);
  });

  if (!d) return null;
  return (
    <group ref={grp}>
      {/* EL ENLACE — la carga que se movió al puente (colores del .bin, por rol) */}
      <Nube pos={d.accPos} col={d.accCol} n={d.nAcc} bright={br.acc} size={0.20} live={br.live} />
      {/* EL VACIADO — de dónde salió (bruma, no protagonista: bright 0.26) */}
      <Nube pos={d.depPos} col={depCol} n={d.nDep} bright={br.dep} size={0.17} live={br.live} />
      {/* EL ELECTRÓN DEL DOPANTE — violeta. En el Si puro esto estaría VACÍO. */}
      <Nube pos={d.spinPos} col={spinCol} n={d.nSpin} bright={br.spin} size={0.22} live={br.live} />
      {/* ⚡ CAMPO ELÉCTRICO — cian pálido. La carga del donor lo GENERA. */}
      {campos && (
        <LineasCampo data={campos.E} n={campos.nE} lp={campos.lp}
          col={[0.45, 0.86, 1.0]} bright={br.E} size={0.75} />
      )}
      {/* 🧲 CAMPO MAGNÉTICO — violeta-blanco. El espín ES un imán: μ ≈ 1 μ_B.
          Dipolo real (r = L·sin²θ, la misma ley que la brújula de la cápsula #2). */}
      {campos && (
        <LineasCampo data={campos.B} n={campos.nB} lp={campos.lp}
          col={[0.92, 0.74, 1.0]} bright={br.B} size={0.95} />
      )}
    </group>
  );
}
