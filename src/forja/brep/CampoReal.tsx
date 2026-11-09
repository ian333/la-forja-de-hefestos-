/**
 * CAMPO REAL — el visualizador de campos v2 (orden 2026-11-05-campos-reales-banco-v2)
 * ====================================================================================
 * «Estas líneas no son adorno: son el campo calculado» (LAS LEYES DEL REY, docs/CANON-VIDEO.md). La técnica es la
 * del rey (`WaterFieldLines` de CinematicMolecule.tsx): filamentos finos aditivos con un pulso que CORRE en el sentido
 * del campo. Lo nuevo:
 *   · cada vértice lleva el valor REAL del campo (|B| en T por ampere, o |E| en V/mm) y el color sale de su LOGARITMO:
 *     dónde el campo es fuerte se ve blanco-cian, dónde es débil se apaga a azul profundo — la jerarquía
 *     núcleo → halo → filamentos sale de la física, no se pinta;
 *   · B = I·B₁(r) en un circuito en serie: las líneas se trazan UNA vez (worker, motor v2 de em.ts) y aquí solo se
 *     multiplica por I(t) en el shader → el campo RESPIRA con la corriente sin recalcular nada (liviano);
 *   · un solo draw call para todas las líneas + unos cientos de chispas que corren encima.
 * Dos mundos de color (ley #1 del rey): AZUL = campo magnético, MAGENTA = campo eléctrico / plasma. El oro es el metal.
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { empacarSegmentos, semillasAlrededor, trazarLineasB, type PaqueteLineasB, type OpcionesLineaB, type Vec3 } from '../../lib/physics/em';

export type V3 = [number, number, number];

// ── paletas (4 paradas: débil → fuerte) ──
export const PALETA_B: [number, number, number][] = [[0.03, 0.06, 0.38], [0.12, 0.34, 1.0], [0.42, 0.84, 1.0], [1.0, 1.0, 1.0]];
export const PALETA_E: [number, number, number][] = [[0.28, 0.02, 0.32], [0.85, 0.12, 0.75], [1.0, 0.55, 0.95], [1.0, 0.96, 1.0]];

/** Líneas listas para dibujar: pares de vértices + valor del campo (unidades de `escala` = 1) + fase a lo largo. */
export interface GeoLineas { geo: THREE.BufferGeometry; nLineas: number; nVert: number; polis: { ini: number; n: number }[]; pos: Float32Array; mag: Float32Array }

/** Paquete del motor (polilíneas concatenadas) → geometría de segmentos con aMag, aU (largo/λ) y aF (fase por línea). */
export function geoDeLineas(pq: { pos: Float32Array; mag: Float32Array; inicio: Uint32Array; cuenta: Uint32Array }, lambda: number, invertir = false): GeoLineas {
  let nSeg = 0;
  for (let j = 0; j < pq.cuenta.length; j++) nSeg += Math.max(0, pq.cuenta[j] - 1);
  const pos = new Float32Array(nSeg * 6), mag = new Float32Array(nSeg * 2), u = new Float32Array(nSeg * 2), f = new Float32Array(nSeg * 2);
  let o = 0;
  const polis: { ini: number; n: number }[] = [];
  for (let j = 0; j < pq.cuenta.length; j++) {
    const ini = pq.inicio[j], n = pq.cuenta[j];
    polis.push({ ini, n });
    const fase = ((j * 0.6180339887) % 1);
    // largo acumulado a lo largo de la línea
    const s = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      const a = (ini + i - 1) * 3, b = (ini + i) * 3;
      s[i] = s[i - 1] + Math.hypot(pq.pos[b] - pq.pos[a], pq.pos[b + 1] - pq.pos[a + 1], pq.pos[b + 2] - pq.pos[a + 2]);
    }
    const Lt = s[n - 1] || 1;
    for (let i = 1; i < n; i++) {
      for (const [k, idx] of [[0, i - 1], [1, i]] as const) {
        const v = ini + idx;
        pos[(o * 2 + k) * 3] = pq.pos[v * 3]; pos[(o * 2 + k) * 3 + 1] = pq.pos[v * 3 + 1]; pos[(o * 2 + k) * 3 + 2] = pq.pos[v * 3 + 2];
        mag[o * 2 + k] = pq.mag[v];
        u[o * 2 + k] = (invertir ? Lt - s[idx] : s[idx]) / lambda;
        f[o * 2 + k] = fase;
      }
      o++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
  geo.setAttribute('aU', new THREE.BufferAttribute(u, 1));
  geo.setAttribute('aF', new THREE.BufferAttribute(f, 1));
  geo.computeBoundingSphere();
  return { geo, nLineas: pq.cuenta.length, nVert: nSeg * 2, polis, pos: pq.pos, mag: pq.mag };
}

const VERT = `
attribute float aMag; attribute float aU; attribute float aF;
uniform float uEsc; uniform float uLo; uniform float uHi;
varying float vL; varying float vU; varying float vF;
void main(){
  float v = aMag * uEsc;
  vL = clamp((log(max(v, 1e-12)) / 2.302585 - uLo) / (uHi - uLo), 0.0, 1.0);
  vU = aU; vF = aF;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = `
uniform float uT; uniform float uVel; uniform float uOp; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
varying float vL; varying float vU; varying float vF;
vec3 paleta(float x){ return x < 0.38 ? mix(uC0, uC1, x / 0.38) : x < 0.74 ? mix(uC1, uC2, (x - 0.38) / 0.36) : mix(uC2, uC3, (x - 0.74) / 0.26); }
void main(){
  float flow = fract(vU - uT * uVel + vF);
  float p = 0.26 + 0.95 * smoothstep(0.0, 0.16, flow) * (1.0 - smoothstep(0.42, 0.9, flow));
  float a = uOp * p * (0.06 + 0.94 * vL * vL);
  gl_FragColor = vec4(paleta(vL) * a * 2.3, a);
}`;

/**
 * Filamentos de campo con flujo. `escala` = ref al multiplicador vivo (la corriente en A para B; 1 para E);
 * logLo/logHi = log10 del campo que pinta azul profundo / blanco (B: −6 = 1 µT … −2 = 10 mT).
 */
export function LineasFlujo({ g, paleta, logLo, logHi, escala, vel, opacidad = 1, si }: {
  g: GeoLineas; paleta: [number, number, number][]; logLo: number; logHi: number;
  escala: MutableRefObject<number>; vel?: MutableRefObject<number>; opacidad?: number; si?: () => boolean;
}) {
  const obj = useRef<THREE.LineSegments>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uEsc: { value: 1 }, uLo: { value: logLo }, uHi: { value: logHi }, uT: { value: 0 }, uVel: { value: 0.4 }, uOp: { value: opacidad },
      uC0: { value: new THREE.Vector3(...paleta[0]) }, uC1: { value: new THREE.Vector3(...paleta[1]) },
      uC2: { value: new THREE.Vector3(...paleta[2]) }, uC3: { value: new THREE.Vector3(...paleta[3]) },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), [paleta, logLo, logHi, opacidad]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    mat.uniforms.uEsc.value = Math.abs(escala.current);
    mat.uniforms.uVel.value = vel ? vel.current : 0.4;
    mat.uniforms.uT.value += Math.min(dt, 0.05);
    if (obj.current && si) obj.current.visible = si();
  });
  return <lineSegments ref={obj} geometry={g.geo} material={mat} frustumCulled={false} renderOrder={4} />;
}

/** Chispas que corren sobre las líneas (el «glitter» del rey): pocas, aditivas, con halo gaussiano. */
const VERT_P = `
attribute float aMag; uniform float uEsc; uniform float uLo; uniform float uHi; uniform float uPx;
varying float vL;
void main(){
  float v = aMag * uEsc;
  vL = clamp((log(max(v, 1e-12)) / 2.302585 - uLo) / (uHi - uLo), 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(uPx * (0.6 + 1.6 * vL) / max(1.0, -mv.z) , 1.5, 14.0);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG_P = `
uniform vec3 uC2; uniform vec3 uC3; uniform float uOp; varying float vL;
void main(){ vec2 q = gl_PointCoord - 0.5; float a = uOp * exp(-dot(q, q) * 16.0) * (0.15 + 0.85 * vL);
  gl_FragColor = vec4(mix(uC2, uC3, vL) * a * 1.8, a); }`;
export function ChispasCampo({ g, paleta, logLo, logHi, escala, porLinea = 2, px = 900, si }: {
  g: GeoLineas; paleta: [number, number, number][]; logLo: number; logHi: number; escala: MutableRefObject<number>; porLinea?: number; px?: number; si?: () => boolean;
}) {
  const obj = useRef<THREE.Points>(null);
  const n = g.nLineas * porLinea;
  const { geo, mat, fases } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aMag', new THREE.BufferAttribute(new Float32Array(n), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uEsc: { value: 1 }, uLo: { value: logLo }, uHi: { value: logHi }, uPx: { value: px }, uOp: { value: 1 },
        uC2: { value: new THREE.Vector3(...paleta[2]) }, uC3: { value: new THREE.Vector3(...paleta[3]) } },
      vertexShader: VERT_P, fragmentShader: FRAG_P, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const fases = Float32Array.from({ length: n }, (_, i) => ((i * 0.754877666) % 1));
    return { geo, mat, fases };
  }, [n, paleta, logLo, logHi, px]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (obj.current && si) { obj.current.visible = si(); if (!obj.current.visible) return; }
    t.current += Math.min(dt, 0.05) * (0.05 + Math.abs(escala.current) / 400);
    mat.uniforms.uEsc.value = Math.abs(escala.current);
    const P = geo.getAttribute('position') as THREE.BufferAttribute, M = geo.getAttribute('aMag') as THREE.BufferAttribute;
    for (let k = 0; k < n; k++) {
      const L = g.polis[Math.floor(k / porLinea)]; if (!L || L.n < 2) continue;
      const x = ((fases[k] + t.current) % 1) * (L.n - 1), i0 = Math.floor(x), fr = x - i0, i1 = Math.min(L.n - 1, i0 + 1);
      const a = (L.ini + i0) * 3, b = (L.ini + i1) * 3;
      P.setXYZ(k, g.pos[a] + (g.pos[b] - g.pos[a]) * fr, g.pos[a + 1] + (g.pos[b + 1] - g.pos[a + 1]) * fr, g.pos[a + 2] + (g.pos[b + 2] - g.pos[a + 2]) * fr);
      M.setX(k, g.mag[L.ini + i0]);
    }
    P.needsUpdate = true; M.needsUpdate = true;
  });
  return <points ref={obj} geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// El cálculo: worker del motor v2 (con respaldo síncrono si el navegador no da workers)
// ════════════════════════════════════════════════════════════════════════════════════════════
let _worker: Worker | null = null, _id = 0;
const _pend = new Map<number, (r: PaqueteLineasB | { error: string }) => void>();
function worker(): Worker | null {
  if (_worker) return _worker;
  try {
    _worker = new Worker(new URL('../../lib/physics/campoB.worker.ts', import.meta.url), { type: 'module' });
    _worker.onmessage = (e: MessageEvent<PaqueteLineasB & { id: number; error?: string }>) => {
      const f = _pend.get(e.data.id); _pend.delete(e.data.id); f?.(e.data.error ? { error: e.data.error } : e.data);
    };
  } catch { _worker = null; }
  return _worker;
}
function trazar(polis: V3[][], semillas: Float64Array, o: OpcionesLineaB, unidad: number, corrientes?: number[]): Promise<PaqueteLineasB> {
  // cada polilínea con SU corriente (por omisión 1 A: un lazo en serie)
  const segs: Array<{ a: Vec3; b: Vec3; I: number }> = [];
  polis.forEach((p, k) => { for (let i = 1; i < p.length; i++) segs.push({ a: p[i - 1] as Vec3, b: p[i] as Vec3, I: corrientes?.[k] ?? 1 }); });
  const S = empacarSegmentos(segs, unidad);
  const w = worker();
  if (!w) return Promise.resolve(trazarLineasB(S, semillas, o));
  return new Promise((ok, mal) => {
    const id = ++_id;
    _pend.set(id, (r) => ('error' in r ? mal(new Error(r.error)) : ok(r)));
    w.postMessage({ id, S, semillas, o });
  });
}

/** Remuestrea polilíneas a un paso fijo (segmentos del motor: ni miles ni pocos). */
export function remuestrearPolis(polis: V3[][], paso: number): V3[][] {
  return polis.map((p) => {
    if (p.length < 2) return p;
    const out: V3[] = [p[0]]; let falta = paso;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      let s = falta;
      while (s < d) { const t = s / d; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); s += paso; }
      falta = s - d;
    }
    out.push(p[p.length - 1]);
    return out;
  });
}

/** Semillas del campo lejano: una rejilla en el plano medio del lazo, solo los puntos ADENTRO de su contorno. */
function semillasDentroDelLazo(polis: V3[][], n: number): number[] {
  const pts = polis.flat(); if (pts.length < 4) return [];
  const c = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / pts.length) as V3;
  // plano medio: normal = dirección de menor varianza (potencia inversa sobre la covarianza)
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; }
  const tr = C[0][0] + C[1][1] + C[2][2]; const M = C.map((f, i) => f.map((v, j) => (i === j ? tr : 0) - v));
  let nv = [0.3, 0.5, 0.8];
  for (let k = 0; k < 40; k++) { const w = [0, 1, 2].map((i) => M[i][0] * nv[0] + M[i][1] * nv[1] + M[i][2] * nv[2]); const l = Math.hypot(...w) || 1; nv = w.map((v) => v / l); }
  const N = new THREE.Vector3(...nv).normalize();
  const U = new THREE.Vector3().crossVectors(N, Math.abs(N.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)).normalize();
  const W = new THREE.Vector3().crossVectors(N, U);
  const p2 = pts.map((p) => { const d = new THREE.Vector3(p[0] - c[0], p[1] - c[1], p[2] - c[2]); return [d.dot(U), d.dot(W)]; });
  const xs = p2.map((q) => q[0]), ys = p2.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const dentro = (x: number, y: number) => {   // número de vueltas del contorno (cerrado) alrededor del punto
    let w = 0;
    for (let i = 0; i < p2.length; i++) {
      const [ax, ay] = p2[i], [bx, by] = p2[(i + 1) % p2.length];
      if (ay <= y) { if (by > y && (bx - ax) * (y - ay) - (x - ax) * (by - ay) > 0) w++; }
      else if (by <= y && (bx - ax) * (y - ay) - (x - ax) * (by - ay) < 0) w--;
    }
    return w !== 0;
  };
  const out: number[] = []; const k = Math.ceil(Math.sqrt(n * 2));
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    const x = x0 + ((i + 0.5) / k) * (x1 - x0), y = y0 + ((j + 0.5) / k) * (y1 - y0);
    if (dentro(x, y) && out.length / 3 < n) { const q = new THREE.Vector3(...c).addScaledVector(U, x).addScaledVector(W, y); out.push(q.x, q.y, q.z); }
  }
  return out;
}

/** Traza líneas de B de una geometría cualquiera (polilíneas en mm, I = 1 A) con semillas dadas. */
export function trazarCampoMm(polis: V3[][], semillas: Float64Array, o: OpcionesLineaB, corrientes?: number[]): Promise<PaqueteLineasB> {
  return trazar(polis, semillas, o, 1e-3, corrientes);
}

export interface EstadoCampo { g: GeoLineas | null; ms: number; lineas: number; cerradas: number; vert: number; error: string | null }
/**
 * Las líneas de B REALES de un lazo de corriente (polilíneas en mm, en el sentido convencional de I).
 * Se trazan una vez por geometría, en el worker.
 */
export function useCampoDelLazo(polis: V3[][] | null, o: { cada?: number; radios?: number[]; lejanas?: number; extra?: number[] } = {}): EstadoCampo {
  const [st, setSt] = useState<EstadoCampo>({ g: null, ms: 0, lineas: 0, cerradas: 0, vert: 0, error: null });
  const clave = useMemo(() => (polis ? JSON.stringify(polis.map((p) => [p.length, p[0], p[p.length - 1]])) + JSON.stringify(o) : ''), [polis, o]);
  useEffect(() => {
    if (!polis || !polis.length) { setSt({ g: null, ms: 0, lineas: 0, cerradas: 0, vert: 0, error: null }); return; }
    let vivo = true;
    const segs = remuestrearPolis(polis, 14);
    const cerca = semillasAlrededor(remuestrearPolis(polis, 6) as Vec3[][], o.cada ?? 48, o.radios ?? [10, 20, 40, 80]);
    const lejos = semillasDentroDelLazo(polis, o.lejanas ?? 48);
    const sem = new Float64Array(cerca.length + lejos.length + (o.extra?.length ?? 0));
    sem.set(cerca, 0); sem.set(lejos, cerca.length); if (o.extra) sem.set(o.extra, cerca.length + lejos.length);
    const pts = polis.flat();
    const mn = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])) - 450), mx = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])) + 450);
    trazar(segs, sem, { hMin: 0.4, hMax: 22, maxPasos: 900, rDentro: 3.5, caja: [mn as Vec3, mx as Vec3] }, 1e-3)
      .then((pq) => { if (vivo) setSt({ g: geoDeLineas(pq, 38), ms: pq.ms, lineas: pq.inicio.length, cerradas: pq.cerradas, vert: pq.mag.length, error: null }); })
      .catch((e) => { if (vivo) setSt((s) => ({ ...s, error: String(e) })); });
    return () => { vivo = false; };
  }, [clave]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { st.g?.geo.dispose(); }, [st.g]);
  return st;
}
