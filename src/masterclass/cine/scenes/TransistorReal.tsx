/**
 * TransistorReal — EL TRANSISTOR MÁS PEQUEÑO EN PRODUCCIÓN, ÁTOMO POR ÁTOMO.
 *
 * Nodo de 2 nm · GAA nanosheet · TSMC N2 (producción masiva desde 4Q2025).
 *
 * ⚠️ ESTA ESCENA NO INVENTA NI UNA POSICIÓN. Todo lo que se dibuja viene de
 * `public/precomputed/transistor-2nm.bin`, calculado por
 * `scripts/precompute-transistor.py` desde datos publicados:
 *   · red diamante del Si, a = 5.431 Å (medido) → el enlace sale 0.235169 nm y
 *     el ángulo sp³ 109.4712° = arccos(-1/3), con error 0.000000° (el
 *     precompute lo verifica con assert: si no emerge, falla y no genera nada)
 *   · Lg=14 nm · W=15 nm · T=6 nm · gate pitch 48 nm   [IRDS 2022, nodo 2 nm]
 *   · dopaje source/drain 1e20 cm^-3 → 153 dopantes por lado (CONTABLES)
 *   · canal INTRÍNSECO: 0 dopantes, a propósito (random dopant fluctuation)
 *
 * La v1 de este video se RECHAZÓ por inventada (la red estaba tecleada a mano
 * en un arreglo BASE8) y aun así sacó el MEJOR score de los gates: miden ojo,
 * no verdad. Ver _archivo/rechazados/transistor-v1-inventado/.
 *
 * Tiempo determinista: window.__cinematicTransistor.renderAt(t) puro en t.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCineTime } from '../useCineTime';

// ── beats (s) — cada uno existe para decir UNA verdad medida ──
export const T = {
  red:        0.0,   // la red: 48 nm de punta a punta. "2 nm" es el nombre, no la medida
  conteo:     7.0,   // 62,925 átomos en el canal — se cuentan
  dopantes:  14.0,   // los 153 dopantes de la fuente se encienden. UNO por UNO
  canal:     22.0,   // el canal: CERO dopantes (intrínseco a propósito)
  campo:     29.0,   // LA COMPUERTA LLAMA: el campo E de Poisson (|E|máx 119 MV/m)
  electrones: 36.0,  // LOS ELECTRONES PASAN: Monte Carlo, cuasi-balístico
  nube:      45.0,   // la nube |ψ|²: no tocan las paredes, están en el centro
  escala:    52.0,   // alejarse: 313 millones por mm²
  fin:       60.0,
};

// dimensiones REALES del dispositivo (nm) — las mismas del precompute
const DEV = { L: 48, W: 15, T: 6, lg: 14, x0: 17, x1: 31 };

type Geo = {
  si: Float32Array; rol: Uint8Array;
  dop: Float32Array; gate: Float32Array;
  nSi: number; nDop: number; nGate: number;
};

function useTransistorGeo(): Geo | null {
  const [geo, setGeo] = useState<Geo | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/precomputed/transistor-2nm.bin')
      .then(r => { if (!r.ok) throw new Error(`bin ${r.status}`); return r.arrayBuffer(); })
      .then(buf => {
        if (!alive) return;
        const dv = new DataView(buf);
        const nSi = dv.getInt32(0, true), nDop = dv.getInt32(4, true), nGate = dv.getInt32(8, true);
        let o = 16;
        const si = new Float32Array(buf.slice(o, o + nSi * 12)); o += nSi * 12;
        const rol = new Uint8Array(buf.slice(o, o + nSi)); o += nSi;
        const dop = new Float32Array(buf.slice(o, o + nDop * 12)); o += nDop * 12;
        const gate = new Float32Array(buf.slice(o, o + nGate * 12));
        setGeo({ si, rol, dop, gate, nSi, nDop, nGate });
        // contrato con las herramientas de render (peek/shot/render-clase)
        (window as any).__transistorReady = true;
      })
      .catch(e => console.error('[TransistorReal] no cargó la geometría:', e));
    return () => { alive = false; };
  }, []);
  return geo;
}

type ElData = {
  tray: Float32Array;   // [frame][el][3] en nm
  nz: Float32Array;     // n(z) normalizada (128)
  ez: Float32Array;     // E(z) en MV/m (128)
  nEl: number; nFr: number; dtFs: number;
};

function useElectrones(): ElData | null {
  const [d, setD] = useState<ElData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/precomputed/transistor-electrones.bin')
      .then(r => { if (!r.ok) throw new Error(`bin ${r.status}`); return r.arrayBuffer(); })
      .then(buf => {
        if (!alive) return;
        const dv = new DataView(buf);
        const nEl = dv.getInt32(0, true), nFr = dv.getInt32(4, true);
        const dtFs = dv.getFloat32(8, true);
        let o = 16;
        const tray = new Float32Array(buf.slice(o, o + nFr * nEl * 12)); o += nFr * nEl * 12;
        const nz = new Float32Array(buf.slice(o, o + 128 * 4)); o += 128 * 4;
        const ez = new Float32Array(buf.slice(o, o + 128 * 4));
        setD({ tray, nz, ez, nEl, nFr, dtFs });
      })
      .catch(e => console.error('[TransistorReal] no cargaron los electrones:', e));
    return () => { alive = false; };
  }, []);
  return d;
}

function makeSprite(): THREE.Texture {
  const size = 128;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.10)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}

// ── shader de la RED (los 221k átomos de Si) ──
// Receta de CinematicAtom (118 videos): sprite gaussiano + titileo cuántico +
// additive. CULL por EXPULSIÓN DE CLIP — nunca maquillar con max()/clamp: un
// gl_Position con w<0 rasteriza degenerado y CUELGA la GPU (costó un día).
const SI_VERT = /* glsl */ `
uniform float uTime;
uniform float uPx;        // alto del viewport (px) → tamaño en px, no en unidades
uniform float uReveal;    // 0..1 cascada de aparición a lo largo de x
uniform float uCanalHi;   // resalta el canal (0..1)
uniform float uFade;      // atenuación global
attribute float aRol;     // 0=canal 1=source 2=drain
varying vec3 vCol;
varying float vA;
void main() {
  // ── VIBRACIÓN TÉRMICA REAL (Debye-Waller) ──
  // A 300 K los átomos NO están quietos: oscilan con desplazamiento cuadrático
  // medio √<u²> ≈ 0.0085 nm en el Si (factor Debye-Waller, medido por difracción).
  // Una red congelada sería 0 K = la única mentira que quedaba aquí. Además,
  // romper la alineación PERFECTA reduce el moiré que salía de la periodicidad
  // exacta — el arreglo honesto y el arreglo visual son EL MISMO.
  float h1 = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float h2 = fract(sin(dot(position, vec3(93.989, 27.131, 45.164))) * 24634.6345);
  float h3 = fract(sin(dot(position, vec3(41.234, 61.987, 19.443))) * 31415.9265);
  vec3 therm = vec3(
    sin(uTime * 9.1 + h1 * 6.2831853),
    sin(uTime * 8.3 + h2 * 6.2831853),
    sin(uTime * 9.7 + h3 * 6.2831853)
  ) * 0.0085;                       // nm — amplitud RMS medida del Si a 300 K
  vec3 pos = position + therm;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  // CULL detrás de cámara: expulsar del clip (receta CinematicAtom)
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;

  // titileo cuántico: hash de la posición (determinista, puro en t)
  float ph = h1 * 6.2831853;
  float blink = 0.72 + 0.28 * sin(uTime * 2.1 + ph);

  // COLOR POR ROL FÍSICO (no por gusto):
  //   canal intrínseco = azul frío (silicio puro, sin dopar)
  //   source/drain n+  = gris-cálido (la región dopada)
  vec3 cCanal  = vec3(0.42, 0.62, 0.95);
  vec3 cSD     = vec3(0.62, 0.60, 0.58);
  vCol = aRol < 0.5 ? cCanal : cSD;
  vCol = mix(vCol, cCanal * 1.5, aRol < 0.5 ? uCanalHi : 0.0);

  // cascada de aparición por x (el cristal "se construye" de source a drain).
  // OJO: la geometría va CENTRADA en el origen (el JS resta DEV.L/2), así que
  // position.x ∈ [-24, +24] — sin el +24 el xr sale negativo y todo el cristal
  // nace de golpe en el frame 0 (la cascada no se veía).
  float xr = (position.x + 24.0) / 48.0;
  float born = smoothstep(xr - 0.06, xr + 0.02, uReveal);

  // ⚠️ ADITIVO CON 221,073 PUNTOS: cada línea de visión atraviesa ~100 átomos y
  // sus alfas SE SUMAN. Con alfa "normal" (0.9) el cristal es un LADRILLO BLANCO
  // saturado — pasó en la 1ª captura. Regla del proyecto: más luz ≠ más color;
  // el color aparece BAJANDO el brillo. Cada átomo aporta un susurro (~0.02) y
  // el VOLUMEN hace el resto: así se lee cristal translúcido y el azul sobrevive.
  vA = born * blink * uFade * (aRol < 0.5 ? 0.075 : 0.052);
  gl_PointSize = born < 0.02 ? 0.0 : clamp(0.30 * (uPx / pz), 0.0, 3.4);
}
`;

// ── shader de los DOPANTES (306 átomos que SE CUENTAN) ──
// Se encienden UNO POR UNO: el índice manda. Son pocos y eso ES el punto.
const DOP_VERT = /* glsl */ `
uniform float uTime;
uniform float uPx;
uniform float uOn;        // 0..1 → cuántos dopantes encendidos (por índice)
uniform float uHalo;      // 0..1 → crece la nube del donor (a* = 2.38 nm)
attribute float aIdx;
varying float vA;
varying float vHot;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;
  // encendido secuencial: el dopante i prende cuando uOn pasa su índice
  float on = smoothstep(aIdx - 0.5, aIdx + 0.5, uOn * 306.0);
  float ph = fract(sin(aIdx * 78.233) * 43758.5453) * 6.2831853;
  float pulse = 0.75 + 0.25 * sin(uTime * 3.4 + ph);
  vHot = on;
  vA = on * pulse;
  // los dopantes son GRANDES en pantalla: son 306 entre 221,073. Deben leerse.
  gl_PointSize = on < 0.02 ? 0.0 : clamp((2.6 + uHalo * 9.0) * (uPx / pz), 0.0, 44.0);
}
`;
const DOP_FRAG = /* glsl */ `
uniform sampler2D uSprite;
varying float vA;
varying float vHot;
void main() {
  vec4 t = texture2D(uSprite, gl_PointCoord);
  float a = t.a * vA;
  if (a < 0.01) discard;
  // oro: el fósforo donor. Cálido = carga que SOBRA (un electrón de más).
  vec3 col = mix(vec3(1.0, 0.72, 0.22), vec3(1.0, 0.94, 0.72), vHot * 0.5);
  gl_FragColor = vec4(col, a);
}
`;

const SI_FRAG = /* glsl */ `
uniform sampler2D uSprite;
varying vec3 vCol;
varying float vA;
void main() {
  vec4 t = texture2D(uSprite, gl_PointCoord);
  float a = t.a * vA;
  // ⚠️ umbral 0.002, NO 0.01 (el de CinematicAtom): aquí cada átomo aporta un
  // susurro (~0.07) y con 0.01 se descartaba CASI TODO el cristal — el bloque
  // se volvía invisible mientras los dopantes seguían viéndose. El cristal lo
  // hace la SUMA de miles de aportes mínimos; si los podas, no queda nada.
  if (a < 0.002) discard;
  gl_FragColor = vec4(vCol, a);
}
`;

// ── la COMPUERTA que envuelve (GAA = gate all around) ──
const GATE_VERT = /* glsl */ `
uniform float uTime;
uniform float uPx;
uniform float uOn;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;
  vA = uOn * (0.72 + 0.28 * sin(uTime * 1.7 + position.x * 2.0));
  gl_PointSize = uOn < 0.02 ? 0.0 : clamp(1.5 * (uPx / pz), 0.0, 14.0);
}
`;
const GATE_FRAG = /* glsl */ `
uniform sampler2D uSprite;
varying float vA;
void main() {
  vec4 t = texture2D(uSprite, gl_PointCoord);
  float a = t.a * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.45, 0.92, 1.0), a);   // cian = el metal de la compuerta
}
`;

// ── LOS ELECTRONES (Monte Carlo real) ──
// Trayectorias de precompute-electrones.py: z muestreada de |ψ|² del
// Poisson-Schrödinger, x por Monte Carlo con colisiones (proceso de Poisson,
// τ=44.3 fs). Verificado: 5.74 choques medidos vs 5.86 teóricos; v satura sola
// en 97 km/s vs 100 medidos; ningún electrón sale del pozo.
// NO son partículas decorativas: son el cálculo.
const EL_VERT = /* glsl */ `
uniform float uPx;
uniform float uOn;
uniform float uTime;
attribute float aIdx;
varying float vA;
varying float vSpeed;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;
  float ph = fract(sin(aIdx * 12.9898) * 43758.5453) * 6.2831853;
  vA = uOn * (0.80 + 0.20 * sin(uTime * 6.0 + ph));
  vSpeed = 1.0;
  gl_PointSize = uOn < 0.02 ? 0.0 : clamp(2.1 * (uPx / pz), 0.0, 26.0);
}
`;
const EL_FRAG = /* glsl */ `
uniform sampler2D uSprite;
varying float vA;
void main() {
  vec4 t = texture2D(uSprite, gl_PointCoord);
  float a = t.a * vA;
  if (a < 0.006) discard;
  // CIAN eléctrico = carga en movimiento (frío = el campo/los portadores;
  // cálido = la carga fija de los dopantes). Color por ROL físico.
  gl_FragColor = vec4(vec3(0.36, 0.93, 1.0), a);
}
`;

// ── EL CAMPO ELÉCTRICO (de Poisson, no dibujado) ──
// Rayos de la compuerta hacia el canal, con brillo ∝ |E(z)| REAL del solver.
const FIELD_VERT = /* glsl */ `
uniform float uPx;
uniform float uOn;
uniform float uTime;
attribute float aE;      // |E| normalizado en ese punto (del solver)
attribute float aAlong;  // 0..1 a lo largo del rayo (compuerta → canal)
varying float vA;
varying float vE;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  if (-mv.z < 0.10) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  gl_Position = projectionMatrix * mv;
  float pz = -mv.z;
  // pulso viajero: el campo EMPUJA hacia adentro (de la compuerta al canal)
  float travel = fract(aAlong - uTime * 0.6);
  float wave = smoothstep(0.72, 1.0, travel);
  vE = aE;
  vA = uOn * aE * (0.30 + 0.70 * wave);
  gl_PointSize = uOn < 0.02 ? 0.0 : clamp(1.1 * (uPx / pz), 0.0, 8.0);
}
`;
const FIELD_FRAG = /* glsl */ `
uniform sampler2D uSprite;
varying float vA;
varying float vE;
void main() {
  vec4 t = texture2D(uSprite, gl_PointCoord);
  float a = t.a * vA;
  if (a < 0.004) discard;
  // violeta→blanco con |E|: el campo es fuerza, no carga
  vec3 col = mix(vec3(0.55, 0.38, 0.95), vec3(0.92, 0.86, 1.0), vE);
  gl_FragColor = vec4(col, a);
}
`;

export default function TransistorReal() {
  const geo = useTransistorGeo();
  const el = useElectrones();
  const tRef = useCineTime();          // reloj del CineStage (sincronizado al audio)
  const sprite = useMemo(() => makeSprite(), []);
  const { size, camera } = useThree();
  const siMat = useRef<THREE.ShaderMaterial>(null);
  const dopMat = useRef<THREE.ShaderMaterial>(null);
  const gateMat = useRef<THREE.ShaderMaterial>(null);
  const elGeoRef = useRef<THREE.BufferGeometry>(null);
  const grp = useRef<THREE.Group>(null);

  // uniforms estables (regla del proyecto: useMemo + mutar .value, NUNCA inline)
  const uSi = useMemo(() => ({
    uTime: { value: 0 }, uPx: { value: 900 }, uReveal: { value: 0 },
    uCanalHi: { value: 0 }, uFade: { value: 1 }, uSprite: { value: sprite },
  }), [sprite]);
  const uDop = useMemo(() => ({
    uTime: { value: 0 }, uPx: { value: 900 }, uOn: { value: 0 },
    uHalo: { value: 0 }, uSprite: { value: sprite },
  }), [sprite]);
  const uGate = useMemo(() => ({
    uTime: { value: 0 }, uPx: { value: 900 }, uOn: { value: 0 }, uSprite: { value: sprite },
  }), [sprite]);
  const uEl = useMemo(() => ({
    uTime: { value: 0 }, uPx: { value: 900 }, uOn: { value: 0 }, uSprite: { value: sprite },
  }), [sprite]);
  const uField = useMemo(() => ({
    uTime: { value: 0 }, uPx: { value: 900 }, uOn: { value: 0 }, uSprite: { value: sprite },
  }), [sprite]);

  // atributos: posiciones REALES del .bin, centradas en el origen
  const siGeo = useMemo(() => {
    if (!geo) return null;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(geo.si.length);
    for (let i = 0; i < geo.nSi; i++) {
      p[i*3]   = geo.si[i*3]   - DEV.L / 2;
      p[i*3+1] = geo.si[i*3+1] - DEV.W / 2;
      p[i*3+2] = geo.si[i*3+2] - DEV.T / 2;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aRol', new THREE.BufferAttribute(Float32Array.from(geo.rol), 1));
    return g;
  }, [geo]);

  const dopGeo = useMemo(() => {
    if (!geo) return null;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(geo.dop.length);
    for (let i = 0; i < geo.nDop; i++) {
      p[i*3]   = geo.dop[i*3]   - DEV.L / 2;
      p[i*3+1] = geo.dop[i*3+1] - DEV.W / 2;
      p[i*3+2] = geo.dop[i*3+2] - DEV.T / 2;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aIdx', new THREE.BufferAttribute(Float32Array.from({ length: geo.nDop }, (_, i) => i), 1));
    return g;
  }, [geo]);

  const gateGeo = useMemo(() => {
    if (!geo) return null;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(geo.gate.length);
    for (let i = 0; i < geo.nGate; i++) {
      p[i*3]   = geo.gate[i*3]   - DEV.L / 2;
      p[i*3+1] = geo.gate[i*3+1] - DEV.W / 2;
      p[i*3+2] = geo.gate[i*3+2] - DEV.T / 2;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, [geo]);

  // ── los electrones: buffer que se REESCRIBE cada frame con la trayectoria ──
  const elGeo = useMemo(() => {
    if (!el) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(el.nEl * 3), 3));
    g.setAttribute('aIdx', new THREE.BufferAttribute(Float32Array.from({ length: el.nEl }, (_, i) => i), 1));
    return g;
  }, [el]);

  // ── el CAMPO: rayos de la compuerta al canal, brillo ∝ |E(z)| del solver ──
  const fieldGeo = useMemo(() => {
    if (!el) return null;
    const RAYS = 26, STEPS = 30;          // 26 rayos × 30 pasos por rayo
    const pos: number[] = [], aE: number[] = [], aAlong: number[] = [];
    const eMax = Math.max(...Array.from(el.ez).map(Math.abs)) || 1;
    for (let r = 0; r < RAYS; r++) {
      // los rayos entran a lo largo de la compuerta (x ∈ [x0,x1]) por arriba
      const x = DEV.x0 + (DEV.lg * (r + 0.5)) / RAYS - DEV.L / 2;
      for (let s = 0; s < STEPS; s++) {
        const a = s / (STEPS - 1);                    // 0 = compuerta, 1 = centro
        const zTop = DEV.T / 2 + 1.4;                 // el metal, 1.4 nm afuera
        const z = zTop * (1 - a) + 0 * a;             // baja hasta el centro
        // |E| REAL en esa z (interpolado del solver de Poisson)
        const zi = Math.min(127, Math.max(0, Math.round(((z + DEV.T/2) / DEV.T) * 127)));
        pos.push(x, 0, z);
        aE.push(Math.min(1, Math.abs(el.ez[zi]) / eMax));
        aAlong.push(a);
        // simétrico por abajo (la compuerta ENVUELVE: GAA)
        pos.push(x, 0, -z);
        aE.push(Math.min(1, Math.abs(el.ez[zi]) / eMax));
        aAlong.push(a);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aE', new THREE.BufferAttribute(new Float32Array(aE), 1));
    g.setAttribute('aAlong', new THREE.BufferAttribute(new Float32Array(aAlong), 1));
    return g;
  }, [el]);

  useFrame(() => {
    const t = tRef.current;
    const px = size.height;
    // ── la película, beat por beat (pura en t: sin reloj, sin random) ──
    const reveal = THREE.MathUtils.smoothstep(t, 0.4, 7.0);          // el cristal se construye
    const dopOn  = THREE.MathUtils.smoothstep(t, T.dopantes, T.dopantes + 7.5);
    const canalHi = THREE.MathUtils.smoothstep(t, T.canal, T.canal + 2.0)
                  * (1 - THREE.MathUtils.smoothstep(t, T.nube + 6, T.nube + 9));
    const gateOn = THREE.MathUtils.smoothstep(t, T.canal - 2, T.canal + 2);
    // el halo del donor: crece a a*=2.38 nm (el electrón del dopante NO CABE)
    const halo   = THREE.MathUtils.smoothstep(t, T.nube, T.nube + 3.0)
                 * (1 - THREE.MathUtils.smoothstep(t, T.escala - 2, T.escala + 1));
    // EL CAMPO: la compuerta llama (|E|máx = 119 MV/m del solver)
    const fieldOn = THREE.MathUtils.smoothstep(t, T.campo, T.campo + 2.5)
                  * (1 - THREE.MathUtils.smoothstep(t, T.escala, T.escala + 2));
    // LOS ELECTRONES: llegan DESPUÉS del campo (el campo es la causa, no al revés)
    const elOn = THREE.MathUtils.smoothstep(t, T.electrones, T.electrones + 2.0)
               * (1 - THREE.MathUtils.smoothstep(t, T.escala + 1, T.escala + 3));

    uSi.uTime.value = t; uSi.uPx.value = px;
    uSi.uReveal.value = reveal; uSi.uCanalHi.value = canalHi;
    // el cristal se ATENÚA cuando entran los electrones: son los protagonistas
    uSi.uFade.value = 1 - 0.45 * THREE.MathUtils.smoothstep(t, T.electrones, T.electrones + 2);
    uDop.uTime.value = t; uDop.uPx.value = px; uDop.uOn.value = dopOn; uDop.uHalo.value = halo;
    uGate.uTime.value = t; uGate.uPx.value = px; uGate.uOn.value = gateOn;
    uField.uTime.value = t; uField.uPx.value = px; uField.uOn.value = fieldOn;
    uEl.uTime.value = t; uEl.uPx.value = px; uEl.uOn.value = elOn;

    // ── reproducir las trayectorias Monte Carlo (loop sobre los 260 fs) ──
    if (el && elGeo && elOn > 0.001) {
      // 260 frames de 1 fs se reproducen en ~4.3 s de video: el tiempo real
      // del electrón (133 fs para cruzar) es INVISIBLE — hay que dilatarlo.
      const fr = Math.floor(((t - T.electrones) * 60) % el.nFr);
      const src = el.tray;
      const attr = elGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const off = fr * el.nEl * 3;
      for (let i = 0; i < el.nEl; i++) {
        arr[i*3]   = src[off + i*3]     - DEV.L / 2;   // x (nm) → centrado
        arr[i*3+1] = src[off + i*3 + 1] - DEV.W / 2;
        arr[i*3+2] = src[off + i*3 + 2] - DEV.T / 2;
      }
      attr.needsUpdate = true;
    }

    // ── cámara: viaje deliberado, no cortes random ──
    // (a) la red entera 48 nm → (b) baja al átomo → (c) los dopantes →
    // (d) el canal → (e) el donor que no cabe → (f) se aleja: millones
    let dist: number, ang: number, ty = 0;
    if (t < T.conteo) {
      const k = THREE.MathUtils.smoothstep(t, 0, T.conteo);
      dist = 78 - 30 * k; ang = 0.35 + 0.28 * k;
    } else if (t < T.dopantes) {
      const k = THREE.MathUtils.smoothstep(t, T.conteo, T.dopantes);
      dist = 48 - 22 * k; ang = 0.63 + 0.5 * k;
    } else if (t < T.canal) {
      const k = THREE.MathUtils.smoothstep(t, T.dopantes, T.canal);
      dist = 26 + 6 * k; ang = 1.13 + 0.7 * k; ty = -2 * k;
    } else if (t < T.campo) {
      // al canal: la cámara se pone de LADO para ver el corte (z = el pozo)
      const k = THREE.MathUtils.smoothstep(t, T.canal, T.campo);
      dist = 32 - 14 * k; ang = 1.83 + 0.9 * k; ty = -2 + 2 * k;
    } else if (t < T.electrones) {
      // el campo entrando: cámara casi de perfil, el pozo se ve como corte
      const k = THREE.MathUtils.smoothstep(t, T.campo, T.electrones);
      dist = 18 - 4 * k; ang = 2.73 + 0.35 * k;
    } else if (t < T.nube) {
      // los electrones cruzando: seguir el flujo, casi a ras del canal
      const k = THREE.MathUtils.smoothstep(t, T.electrones, T.nube);
      dist = 14 + 3 * k; ang = 3.08 + 0.5 * k; ty = 0.4 * k;
    } else if (t < T.escala) {
      const k = THREE.MathUtils.smoothstep(t, T.nube, T.escala);
      dist = 17 - 5 * k; ang = 3.58 + 0.4 * k; ty = 0.4;
    } else {
      // salida exponencial: de 12 nm a 900 nm → "313 millones por mm²"
      const k = THREE.MathUtils.smoothstep(t, T.escala, T.fin);
      dist = 12 * Math.pow(900 / 12, k); ang = 3.98 + 0.6 * k;
    }
    camera.position.set(Math.sin(ang) * dist, ty + dist * 0.22, Math.cos(ang) * dist);
    camera.lookAt(0, ty * 0.5, 0);
    camera.updateProjectionMatrix();
  });

  if (!geo || !siGeo || !dopGeo || !gateGeo) return null;

  return (
    <group ref={grp}>
      {/* los 221,073 átomos de silicio — posiciones de la red diamante real */}
      <points geometry={siGeo} frustumCulled={false}>
        <shaderMaterial ref={siMat} uniforms={uSi} vertexShader={SI_VERT} fragmentShader={SI_FRAG}
          transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {/* la compuerta que ENVUELVE (GAA) */}
      <points geometry={gateGeo} frustumCulled={false}>
        <shaderMaterial ref={gateMat} uniforms={uGate} vertexShader={GATE_VERT} fragmentShader={GATE_FRAG}
          transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {/* EL CAMPO ELÉCTRICO — brillo ∝ |E(z)| del solver de Poisson */}
      {fieldGeo && (
        <points geometry={fieldGeo} frustumCulled={false}>
          <shaderMaterial uniforms={uField} vertexShader={FIELD_VERT} fragmentShader={FIELD_FRAG}
            transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      )}
      {/* LOS ELECTRONES — trayectorias Monte Carlo reales (z de |ψ|²) */}
      {elGeo && (
        <points geometry={elGeo} frustumCulled={false}>
          <shaderMaterial uniforms={uEl} vertexShader={EL_VERT} fragmentShader={EL_FRAG}
            transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      )}
      {/* los 306 dopantes — se cuentan uno por uno */}
      <points geometry={dopGeo} frustumCulled={false}>
        <shaderMaterial ref={dopMat} uniforms={uDop} vertexShader={DOP_VERT} fragmentShader={DOP_FRAG}
          transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}
