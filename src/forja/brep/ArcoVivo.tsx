/**
 * ARCO VIVO — la simulación del BANCO DEL ARCO dentro del visor del CAD (órdenes 2026-11-04-banco-arco-vivo y
 * 2026-11-05-campos-reales-banco-v2)
 * ===========================================================================================================
 * NO crea un lienzo R3F propio: <ArcoVivoEscena> vive dentro del grupo Z-arriba del CadViewport (mm del doc) y
 * <ArcoVivoHUD> es DOM encima del visor. La física es arcoFisica.ts (el canon, portado). Los CAMPOS son calculados
 * (motor v2 de src/lib/physics/em.ts + CampoReal.tsx), con la gramática del rey (docs/CANON-VIDEO.md):
 *
 *   · B DEL LAZO (mundo AZUL): Biot-Savart de la geometría REAL del circuito (cables, antorcha, arco, placa).
 *     Las líneas se trazan una vez con I = 1 A en un worker; el shader multiplica por I(t): el campo RESPIRA con la
 *     onda. Color = log|B| real (1 µT azul profundo → mT blanco); el pulso corre en el sentido de B.
 *   · LA CARGA en el lazo: puntos dorados finos en el sentido convencional de I (rapidez simbólica: la deriva real
 *     de los electrones es de µm/s) — la CAUSA del campo.
 *   · LA LUZ DEL ARCO a escala real (luz puntual + halo aditivo; el CAD prohíbe EffectComposer).
 *   · EL DETALLE A ×20: E calculado (cargas simuladas + imágenes, mundo MAGENTA, |E| real por vértice, fluye de la
 *     placa a la gota), B calculado del alambre + la columna + la corriente que converge en la placa (AZUL), el
 *     plasma como nube de partículas (núcleo blanco → halo magenta), la gota de acero fundido (ORO), el cordón.
 * Todo lo que se mueve se escribe por ref en useFrame: React no se re-renderiza por cuadro.
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  nuevoArco, PARAMS_ARCO, correrArco, pasoArco, resolverCampoE, lineasE, equipotenciales, magE, altoCordon, estiramiento,
  f2Hz, bRecto, pellizco, RW, ICRIT, type ArcoEstado, type ArcoParams, type CampoE,
} from './arcoFisica';
import { LineasFlujo, ChispasCampo, useCampoDelLazo, trazarCampoMm, geoDeLineas, PALETA_B, PALETA_E, type GeoLineas } from './CampoReal';
import { crearPlumaSim, pasoPluma, pasoTermico, type PlumaSim } from './plumaSistema';
import { CalorPluma } from './PlumaCircuito';

export type V3 = [number, number, number];
/** Lo que el documento dice del arco: dónde está (mm del doc) y dónde flota el detalle. */
export interface ArcoConfig { punta: V3; detalle: { centro: V3; escala: number } }
/** Polilíneas en coordenadas del doc, ya resueltas por el estudio (desde los tubos de las piezas de referencia). */
export interface ArcoTrazas { lazo: V3[][]; anillos: V3[][] }
export interface ArcoSim {
  s: ArcoEstado; p: ArcoParams;
  lenta: number; pausa: boolean;
  verE: boolean; verB: boolean; verFlujo: boolean;
  campo: { c: CampoE; Epunta: number; t: number } | null;
  fps: number;
  infoB: string;   // lo que trazó el motor de campos (líneas, vértices, ms)
  // LA PLUMA (orden 2026-11-05-la-pluma-circuito-cableado): el circuito real, en el MNA, decide la corriente de la gota
  pluma: PlumaSim | null; circuitoOn: boolean; verCircuito: boolean; ventilador: boolean;
  lentaEfectiva: number; lrsSobre: number;
}
/** Los agentes 02/04/06 (docs/investigacion-arco/): con 10 V/mm el hueco de 4 mm pide 46 V (ni el buck ni la LRS
 *  lo dan) y 40 A funden ~1.8 m/min, no 3 → hueco 1.8 mm y alambre 1.8 m/min por omisión. */
export function crearArcoSim(): ArcoSim {
  return { s: nuevoArco(), p: { ...PARAMS_ARCO, gap: 1.8, vf: 1.8 }, lenta: 1 / 300, pausa: false, verE: true, verB: true, verFlujo: true,
    campo: null, fps: 60, infoB: '', pluma: crearPlumaSim(), circuitoOn: true, verCircuito: true, ventilador: true, lentaEfectiva: 1 / 300, lrsSobre: 0 };
}
const PASOS_MAX = 240;   // ~9 ms de CPU por cuadro a 37 µs/paso: el circuito limita la cámara lenta a ~×1/150

// ── utilidades de trazas ──
function remuestrear(polys: V3[][], paso: number): { pts: Float32Array; n: number } {
  const all: THREE.Vector3[] = [];
  for (const pl of polys) for (const p of pl) all.push(new THREE.Vector3(p[0], p[1], p[2]));
  if (all.length < 2) return { pts: new Float32Array(0), n: 0 };
  const out: number[] = [all[0].x, all[0].y, all[0].z];
  let falta = paso;
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1], b = all[i], d = a.distanceTo(b);
    if (d < 1e-9) continue;
    let s = falta;
    while (s <= d) { const t = s / d; out.push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); s += paso; }
    falta = s - d;
  }
  return { pts: Float32Array.from(out), n: out.length / 3 };
}
let _halo: THREE.Texture | null = null;
function halo(): THREE.Texture {
  if (_halo) return _halo;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.16, 'rgba(235,220,255,0.9)');
  g.addColorStop(0.42, 'rgba(210,90,230,0.28)'); g.addColorStop(1, 'rgba(120,40,200,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _halo = new THREE.CanvasTexture(c); return _halo;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3();

// ════════════════════════════════════════════════════════════════════════════════════════════
export function ArcoVivoEscena({ sim, cfg, trazas }: { sim: MutableRefObject<ArcoSim>; cfg: ArcoConfig; trazas: ArcoTrazas }) {
  const lazo = useMemo(() => remuestrear(trazas.lazo, 3), [trazas.lazo]);
  // densidad del rey: estaciones cada 26 mm con 6 radios (8 → 120 mm) + el campo lejano que atraviesa el lazo
  const campo = useCampoDelLazo(trazas.lazo.length ? trazas.lazo : null, { cada: 26, radios: [8, 14, 24, 40, 70, 120], lejanas: 90 });
  const corriente = useRef(0), velB = useRef(0.3);
  const nFlujo = Math.min(260, Math.max(40, Math.round((lazo.n * 3) / 20)));
  const flujoRef = useRef<THREE.InstancedMesh>(null);
  const luzRef = useRef<THREE.PointLight>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const off = useRef(0);
  const geoBola = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  useEffect(() => () => geoBola.dispose(), [geoBola]);
  useEffect(() => {
    sim.current.infoB = campo.g ? `${campo.lineas} líneas de B calculadas (${campo.cerradas} cerradas) · ${campo.vert.toLocaleString('es-MX')} vértices · ${campo.ms.toFixed(0)} ms en el worker`
      : campo.error ? `campo B: ${campo.error}` : 'calculando el campo B…';
  }, [campo, sim]);

  useFrame((_, dtw) => {
    const S = sim.current; const dt = Math.min(dtw, 0.05);
    if (!S.pausa) {
      const pl = S.pluma;
      if (S.circuitoOn && pl) {
        // EL LAZO CERRADO: firmware (PI) → compuerta → MNA → corriente REAL → la gota → voltaje del arco → MNA
        const quiero = dt * S.lenta, n = Math.min(PASOS_MAX, Math.max(1, Math.round(quiero / pl.dt)));
        S.lentaEfectiva = (n * pl.dt) / Math.max(dt, 1e-4);
        for (let k = 0; k < n; k++) { pasoPluma(pl, S.s.V, S.s.Iref, S.s.corto); pasoArco(S.s, S.p, pl.dt, Math.max(0, pl.Iout)); }
        pasoTermico(pl, dt, S.ventilador);     // en tiempo de pared: «si el arco corriera así, continuo»
        // la LRS real: >105 % por 5 s o >130 % de golpe → se apaga (hipo); el tablero lo dice
        S.lrsSobre = pl.lrsCarga > 1.05 ? S.lrsSobre + dt : Math.max(0, S.lrsSobre - dt);
        if (S.lrsSobre > 5) pl.lrsApagada = true;
      } else { correrArco(S.s, S.p, dt * S.lenta, 2e-6); S.lentaEfectiva = S.lenta; }
    }
    S.fps = S.fps * 0.94 + (1 / Math.max(dtw, 1e-3)) * 0.06;
    const I = S.s.I, prendido = !S.s.corto;
    corriente.current = I;                                   // B = I·B₁: el shader multiplica
    velB.current = 0.08 + Math.abs(I) / 160;                 // el pulso corre más rápido con más corriente
    // ── la carga en el lazo (sentido convencional, rapidez simbólica ∝ |I|)
    const fm = flujoRef.current;
    if (fm) {
      fm.visible = S.verFlujo && lazo.n > 1;
      if (fm.visible) {
        if (!S.pausa) off.current += dt * (25 + 2.4 * Math.abs(I));
        const L = lazo.n * 3, esc = 0.9 + Math.abs(I) / 90;
        for (let k = 0; k < nFlujo; k++) {
          const sk = ((k * L) / nFlujo + off.current) % L;
          const i = Math.min(lazo.n - 1, Math.floor(sk / 3));
          _m.makeScale(esc, esc, esc).setPosition(lazo.pts[3 * i], lazo.pts[3 * i + 1], lazo.pts[3 * i + 2]);
          fm.setMatrixAt(k, _m);
        }
        fm.instanceMatrix.needsUpdate = true;
      }
    }
    // ── la luz del arco a escala real
    const parpadeo = 0.85 + 0.15 * Math.sin(S.s.t * 2 * Math.PI * 97) * Math.sin(S.s.t * 2 * Math.PI * 13);
    if (luzRef.current) luzRef.current.intensity = prendido ? (Math.abs(I) / 40) * 2.6e4 * parpadeo : 0;
    if (haloRef.current) {
      const e = prendido ? 14 + Math.abs(I) * 0.32 : 0.01;
      haloRef.current.scale.set(e * parpadeo, e * parpadeo, 1);
    }
  });

  const verB = () => sim.current.verB;
  return (
    <group>
      {campo.g && (
        <>
          <LineasFlujo g={campo.g} paleta={PALETA_B} logLo={-5.6} logHi={-2.5} escala={corriente} vel={velB} si={verB} />
          <ChispasCampo g={campo.g} paleta={PALETA_B} logLo={-5.6} logHi={-2.5} escala={corriente} porLinea={2} px={2600} si={verB} />
        </>
      )}
      <instancedMesh ref={flujoRef} args={[geoBola, undefined, nFlujo]} frustumCulled={false} renderOrder={5}>
        <meshBasicMaterial color="#ffc94a" toneMapped={false} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <pointLight ref={luzRef} position={[cfg.punta[0], cfg.punta[1], cfg.punta[2] + 4]} color="#e6dcff" intensity={0} distance={900} decay={2} />
      <sprite ref={haloRef} position={cfg.punta} renderOrder={6}>
        <spriteMaterial map={halo()} color="#ffffff" toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
      </sprite>
      <DetalleA sim={sim} cfg={cfg} />
      <CalorPluma sim={sim} />
    </group>
  );
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// DETALLE A ×20 — la punta del alambre, la gota, el arco y sus campos CALCULADOS (mm locales, z desde la placa)
// ════════════════════════════════════════════════════════════════════════════════════════════
const Z_MED = 5.2;      // mm locales: el centro de la burbuja
const R_BURBUJA = 11.5; // mm locales
const N_AZ_E = 40;      // planos en que se giran las líneas de E (el campo es axisimétrico)
const CAP_E = 16 * 320 * N_AZ_E * 2;     // vértices
const CAP_EQ = 6000 * 2 * 3;
const N_PLASMA = 3600;

const VERT_PLASMA = `
attribute vec3 aP; attribute float aR;
uniform float uZ0; uniform float uZ1; uniform float uRb; uniform float uT; uniform float uBri; uniform float uPx;
varying float vA; varying float vW;
void main(){
  float u = aP.z;
  float rad = uRb * mix(0.42, 1.0, 1.0 - u);                      // campana: ancha en el ánodo (abajo), angosta en la gota
  vec3 p = vec3(aP.x * rad * 0.5, aP.y * rad * 0.5, mix(uZ0, uZ1, u));
  float rr = length(aP.xy);
  vW = exp(-rr * rr * 0.9);                                        // el núcleo arde más que el halo
  vA = uBri * (0.55 + 0.45 * sin(uT * 31.0 + aR * 40.0));          // parpadeo propio por partícula
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uPx / max(1.0, -mv.z), 1.0, 7.0);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG_PLASMA = `
varying float vA; varying float vW;
void main(){ vec2 q = gl_PointCoord - 0.5; float a = vA * exp(-dot(q, q) * 14.0) * (0.2 + 0.8 * vW);
  gl_FragColor = vec4(mix(vec3(0.92, 0.18, 0.86), vec3(1.0, 0.96, 1.0), vW) * a * 1.7, a); }`;

function DetalleA({ sim, cfg }: { sim: MutableRefObject<ArcoSim>; cfg: ArcoConfig }) {
  const { camera } = useThree();
  const esc = cfg.detalle.escala;
  const grupo = useRef<THREE.Group>(null);
  const fondo = useRef<THREE.Group>(null);
  const gota = useRef<THREE.Mesh>(null);
  const alambre = useRef<THREE.Mesh>(null);
  const punta = useRef<THREE.Mesh>(null);
  const plasma = useRef<THREE.Points>(null);
  const vuelan = useRef<THREE.InstancedMesh>(null);
  const cordon = useRef<THREE.InstancedMesh>(null);
  const equiRef = useRef<THREE.LineSegments>(null);
  const marca = useRef<THREE.Mesh>(null);
  const tCampo = useRef(-1);
  const corriente = useRef(0), velB = useRef(0.4), unoE = useRef(1), velE = useRef(0.9);
  const [etq, setEtq] = useState('');
  const tEtq = useRef(0);

  const geo = useMemo(() => {
    // E: geometría de capacidad fija que se reescribe en su lugar (sin basura por cuadro)
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CAP_E * 3), 3));
    eGeo.setAttribute('aMag', new THREE.BufferAttribute(new Float32Array(CAP_E), 1));
    eGeo.setAttribute('aU', new THREE.BufferAttribute(new Float32Array(CAP_E), 1));
    eGeo.setAttribute('aF', new THREE.BufferAttribute(new Float32Array(CAP_E), 1));
    eGeo.setDrawRange(0, 0);
    const eqPos = new THREE.BufferGeometry(); eqPos.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CAP_EQ), 3));
    const guiaG = new THREE.BufferGeometry(); guiaG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    // plasma: muestras normalizadas (radio gaussiano, eje con más densidad en las dos caídas: cátodo y ánodo)
    const aP = new Float32Array(N_PLASMA * 3), aR = new Float32Array(N_PLASMA);
    for (let i = 0; i < N_PLASMA; i++) {
      const u1 = Math.random() || 1e-6, u2 = Math.random();
      const r = Math.sqrt(-2 * Math.log(u1)) * 0.55, th = 2 * Math.PI * u2;
      const w = Math.random(); const u = w < 0.5 ? Math.pow(Math.random(), 1.8) * 0.5 : 1 - Math.pow(Math.random(), 1.8) * 0.5;
      aP[i * 3] = r * Math.cos(th); aP[i * 3 + 1] = r * Math.sin(th); aP[i * 3 + 2] = u; aR[i] = Math.random();
    }
    const plasmaG = new THREE.BufferGeometry();
    plasmaG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_PLASMA * 3), 3));   // (lo calcula el shader)
    plasmaG.setAttribute('aP', new THREE.BufferAttribute(aP, 3));
    plasmaG.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
    const plasmaM = new THREE.ShaderMaterial({
      uniforms: { uZ0: { value: 1 }, uZ1: { value: 4 }, uRb: { value: 1 }, uT: { value: 0 }, uBri: { value: 1 }, uPx: { value: 3200 } },
      vertexShader: VERT_PLASMA, fragmentShader: FRAG_PLASMA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    return {
      eGeo, eqPos, guiaG, plasmaG, plasmaM,
      bola: new THREE.SphereGeometry(1, 48, 32),
      alambre: new THREE.CylinderGeometry(0.4, 0.4, 1, 28).rotateX(Math.PI / 2),
      punta: new THREE.CylinderGeometry(2.4, 2.4, 2, 40).rotateX(Math.PI / 2),
      disco: new THREE.CircleGeometry(R_BURBUJA, 96),
      aro: new THREE.RingGeometry(R_BURBUJA, R_BURBUJA + 0.08, 128),
      marcaAro: new THREE.RingGeometry(0.8, 1, 48),
    };
  }, []);
  useEffect(() => () => { Object.values(geo).forEach((g) => (g as { dispose?: () => void }).dispose?.()); }, [geo]);
  const gE = useMemo<GeoLineas>(() => ({ geo: geo.eGeo, nLineas: 0, nVert: 0, polis: [], pos: new Float32Array(0), mag: new Float32Array(0) }), [geo]);
  // la guía punteada (objeto de three: <line> en JSX choca con el <line> de SVG)
  const guiaObj = useMemo(() => {
    const l = new THREE.Line(geo.guiaG, new THREE.LineDashedMaterial({ color: '#f4b942', dashSize: 9, gapSize: 6, transparent: true, opacity: 0.7, toneMapped: false }));
    l.frustumCulled = false; return l;
  }, [geo]);
  useEffect(() => () => { (guiaObj.material as THREE.Material).dispose(); }, [guiaObj]);

  // B del detalle: CALCULADO con el motor v2 — la corriente llega por la placa convergiendo al pie del arco (12 rayos de
  // 1/12 A cada uno), sube por la columna del arco y por el alambre (1 A). Geometría nominal; B = I·B₁ (el shader multiplica).
  const [gB, setGB] = useState<GeoLineas | null>(null);
  useEffect(() => {
    const p = sim.current.p, hC = altoCordon(p), zw = hC + p.gap;
    const polis: V3[][] = [], Is: number[] = [];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * Math.PI; polis.push([[7 * Math.cos(a), 7 * Math.sin(a), 0], [0, 0, 0]]); Is.push(1 / 12); }
    polis.push([[0, 0, 0], [0, 0, hC], [0, 0, zw], [0, 0, zw + 9]]); Is.push(1);
    const sem: number[] = [];
    for (const zh of [hC + (zw - hC) * 0.25, hC + (zw - hC) * 0.55, hC + (zw - hC) * 0.85, zw + 1.6, zw + 4.2]) for (const r of [0.6, 1.0, 1.6, 2.6, 4.2, 6.5]) for (let k = 0; k < 3; k++) {
      const a = k * 2.09 + r; sem.push(r * Math.cos(a), r * Math.sin(a), zh);
    }
    let vivo = true;
    trazarCampoMm(polis, Float64Array.from(sem), { hMin: 0.01, hMax: 0.6, maxPasos: 700, rDentro: 0.42, caja: [[-12, -12, -2], [12, 12, zw + 12]] }, Is)
      .then((pq) => { if (vivo) setGB(geoDeLineas(pq, 0.55)); }).catch(() => {});
    return () => { vivo = false; };
  }, [sim]);

  useFrame((_, dtw) => {
    const S = sim.current, s = S.s, p = S.p, G = grupo.current; if (!G) return;
    const I = s.I, prendido = !s.corto;
    corriente.current = I; velB.current = 0.15 + Math.abs(I) / 90;
    const hC = altoCordon(p);
    const zw = hC + p.gap;                                  // punta del alambre (mm sobre la placa)
    const a = s.a * 1e3, sz = estiramiento(s.q), sxy = 1 / Math.sqrt(sz);
    const cz = zw - a * sz, zFondo = zw - 2 * a * sz;       // centro y fondo de la gota
    // ── la burbuja mira siempre a la cámara (vacío negro detrás de lo que se dibuja)
    G.updateWorldMatrix(true, false);
    const centroW = _v.set(0, 0, Z_MED).applyMatrix4(G.matrixWorld).clone();
    if (fondo.current) {
      G.getWorldQuaternion(_q);
      fondo.current.quaternion.copy(_q.invert()).multiply(camera.quaternion);
      const camL = G.worldToLocal(camera.position.clone());
      const dir = camL.sub(new THREE.Vector3(0, 0, Z_MED)).normalize();
      fondo.current.position.set(0, 0, Z_MED).addScaledVector(dir, -11);
    }
    // ── la guía punteada: del arco real al borde de la burbuja
    const pw = new THREE.Vector3(...cfg.punta);
    const borde = centroW.clone().add(pw.clone().sub(centroW).normalize().multiplyScalar(R_BURBUJA * esc));
    {
      const arr = guiaObj.geometry.getAttribute('position') as THREE.BufferAttribute;
      arr.setXYZ(0, pw.x, pw.y, pw.z); arr.setXYZ(1, borde.x, borde.y, borde.z); arr.needsUpdate = true;
      guiaObj.computeLineDistances();
    }
    if (marca.current) { marca.current.position.copy(pw); marca.current.quaternion.copy(camera.quaternion); marca.current.scale.setScalar(16); }
    // ── alambre, punta de contacto, gota (oro: el metal es la palabra)
    if (alambre.current) { alambre.current.position.set(0, 0, zw + 3); alambre.current.scale.set(1, 1, 6); }
    if (punta.current) punta.current.position.set(0, 0, zw + 7);
    if (gota.current) { gota.current.position.set(0, 0, cz); gota.current.scale.set(a * sxy, a * sxy, a * sz); }
    // ── el plasma: nube de partículas entre la gota y el cordón; se apaga en corto
    const pm = plasma.current;
    if (pm) {
      pm.visible = prendido;
      const u = geo.plasmaM.uniforms;
      u.uZ0.value = hC; u.uZ1.value = zFondo; u.uRb.value = 1.1 + 0.018 * Math.abs(I);
      u.uT.value += Math.min(dtw, 0.05); u.uBri.value = Math.min(1.6, 0.25 + Math.abs(I) / 55);
    }
    // ── gotas en vuelo y cordón (las depositadas se van con la placa y se enfrían)
    const vm = vuelan.current;
    if (vm) {
      for (let i = 0; i < 8; i++) {
        const g = s.vuelan[i];
        if (g) _m.makeScale(g.a, g.a, g.a * 1.08).setPosition(0, 0, g.z); else _m.makeScale(0, 0, 0);
        vm.setMatrixAt(i, _m);
      }
      vm.instanceMatrix.needsUpdate = true;
    }
    const cm = cordon.current;
    if (cm) {
      const n = s.cordon.length, col = new THREE.Color();
      for (let i = 0; i < 60; i++) {
        const c = s.cordon[n - 1 - i];
        if (c && c.x < 6) {
          _m.makeScale(c.a * 1.5, c.a * 1.35, Math.max(hC * 0.62, c.a * 0.7)).setPosition(c.x, 0, hC * 0.38);
          const frio = Math.min(1, c.x / 4);
          col.setRGB(1 - 0.62 * frio, 0.62 - 0.27 * frio, 0.2 + 0.2 * frio);
          cm.setColorAt(i, col);
        } else _m.makeScale(0, 0, 0);
        cm.setMatrixAt(i, _m);
      }
      cm.instanceMatrix.needsUpdate = true; if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    }
    // ── el campo E CALCULADO (cargas simuladas + imágenes), ~12 veces por segundo, |E| real en cada vértice
    const now = performance.now();
    if (S.verE && now - tCampo.current > 80) {
      tCampo.current = now;
      const V = Math.max(2, s.V);
      const c = resolverCampoE({ zw: p.gap, a: Math.max(0.2, a), sz, V });
      const Ep = magE(c, 0, p.gap - 2 * a * sz - 0.02);
      S.campo = { c, Epunta: Ep, t: s.t };
      const lin = lineasE(c, 7, p.gap + 6, 3);
      const P = geo.eGeo.getAttribute('position') as THREE.BufferAttribute, M = geo.eGeo.getAttribute('aMag') as THREE.BufferAttribute;
      const U = geo.eGeo.getAttribute('aU') as THREE.BufferAttribute, F = geo.eGeo.getAttribute('aF') as THREE.BufferAttribute;
      let n = 0;
      lin.forEach((l, li) => {
        const m = Math.min(l.length, 320);
        // largo acumulado (para que el pulso corra de la placa hacia la gota: E apunta del + al −)
        const sAc = new Float32Array(m); for (let i = 1; i < m; i++) sAc[i] = sAc[i - 1] + Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
        const mg = new Float32Array(m); for (let i = 0; i < m; i++) mg[i] = magE(c, l[i][0], l[i][1]);
        for (let az = 0; az < N_AZ_E; az++) {
          const ang = (az / N_AZ_E) * Math.PI * 2 + li * 0.17, ca = Math.cos(ang), sa = Math.sin(ang), fase = (az * 0.618 + li * 0.37) % 1;
          for (let i = 1; i < m && n < CAP_E - 2; i++) for (const j of [i - 1, i]) {
            P.setXYZ(n, l[j][0] * ca, l[j][0] * sa, l[j][1] + hC); M.setX(n, mg[j]); U.setX(n, (sAc[m - 1] - sAc[j]) / 0.6); F.setX(n, fase); n++;
          }
        }
      });
      P.needsUpdate = true; M.needsUpdate = true; U.needsUpdate = true; F.needsUpdate = true; geo.eGeo.setDrawRange(0, n);
      const seg = equipotenciales(c, [1, 2, 3, 4, 5].map((k) => (-V * k) / 6), 7, p.gap + 4, 0.14);
      const qa = geo.eqPos.getAttribute('position') as THREE.BufferAttribute; let m2 = 0;
      for (let i = 0; i + 3 < seg.length && m2 < CAP_EQ / 3 - 4; i += 4) {
        for (const sg of [1, -1]) { qa.setXYZ(m2++, sg * seg[i], 0, seg[i + 1] + hC); qa.setXYZ(m2++, sg * seg[i + 2], 0, seg[i + 3] + hC); }
      }
      qa.needsUpdate = true; geo.eqPos.setDrawRange(0, m2);
    }
    velE.current = 0.6 + Math.abs(I) / 80;
    if (equiRef.current) equiRef.current.visible = S.verE;
    // ── la etiqueta (DOM) se refresca 4 veces por segundo
    if (now - tEtq.current > 250) {
      tEtq.current = now;
      setEtq(`DETALLE A · ×${esc} · cámara lenta ×1/${Math.round(1 / S.lenta)}${s.corto ? ' · CORTO' : ''}`);
    }
  });

  const c = cfg.detalle.centro;
  return (
    <>
      <primitive object={guiaObj} />
      <mesh ref={marca} geometry={geo.marcaAro} renderOrder={7}>
        <meshBasicMaterial color="#f4b942" toneMapped={false} transparent opacity={0.9} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      <group ref={grupo} position={[c[0], c[1], c[2] - Z_MED * esc]} scale={esc}>
        <group ref={fondo}>
          <mesh geometry={geo.disco} renderOrder={-2}>
            <meshBasicMaterial color="#020308" transparent opacity={0.93} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={geo.aro} renderOrder={-1}>
            <meshBasicMaterial color="#f4b942" toneMapped={false} transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
        {/* la placa (corte): acero OSCURO — una placa gris grande era la «forma grande y sobria» que el portero reprueba;
            el ánodo (donde cae el arco) arde */}
        <mesh position={[0, 0, -0.8]}>
          <boxGeometry args={[9, 5, 1.6]} />
          <meshPhysicalMaterial color="#2c3138" metalness={0.85} roughness={0.42} clearcoat={0.15} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <circleGeometry args={[1.3, 48]} />
          <meshBasicMaterial color="#ff8a2a" toneMapped={false} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <instancedMesh ref={cordon} args={[geo.bola, undefined, 60]} frustumCulled={false}>
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        {/* alambre y punta de contacto (cobre, translúcida para ver el alambre adentro) */}
        <mesh ref={alambre} geometry={geo.alambre}>
          <meshPhysicalMaterial color="#9aa1aa" metalness={0.85} roughness={0.4} />
        </mesh>
        <mesh ref={punta} geometry={geo.punta}>
          <meshPhysicalMaterial color="#7a4a26" metalness={0.9} roughness={0.35} transparent opacity={0.22} depthWrite={false} />
        </mesh>
        {/* la gota: acero fundido (ORO) */}
        <mesh ref={gota} geometry={geo.bola} renderOrder={2}>
          <meshStandardMaterial color="#ffb347" emissive="#ff9a2e" emissiveIntensity={2.4} toneMapped={false} roughness={0.25} />
        </mesh>
        <instancedMesh ref={vuelan} args={[geo.bola, undefined, 8]} frustumCulled={false}>
          <meshStandardMaterial color="#ffb347" emissive="#ff9a2e" emissiveIntensity={2.4} toneMapped={false} />
        </instancedMesh>
        {/* el plasma: nube de partículas (núcleo blanco → halo magenta) */}
        <points ref={plasma} geometry={geo.plasmaG} material={geo.plasmaM} frustumCulled={false} renderOrder={3} />
        {/* E CALCULADO (magenta) + equipotenciales tenues; B CALCULADO del arco, alambre y placa (azul) */}
        <LineasFlujo g={gE} paleta={PALETA_E} logLo={0.0} logHi={1.8} escala={unoE} vel={velE} opacidad={1.5} si={() => sim.current.verE} />
        <lineSegments ref={equiRef} geometry={geo.eqPos} frustumCulled={false} renderOrder={4}>
          <lineBasicMaterial color="#e070e8" toneMapped={false} transparent opacity={0.16} depthWrite={false} />
        </lineSegments>
        {gB && <LineasFlujo g={gB} paleta={PALETA_B} logLo={-3.6} logHi={-1.7} escala={corriente} vel={velB} opacidad={1.4} si={() => sim.current.verB} />}
        <Html position={[0, 0, Z_MED + R_BURBUJA + 0.9]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="av-etq" data-testid="detalle-a">{etq}</div>
        </Html>
      </group>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// EL TABLERO (DOM): modo, perillas, lecturas y el osciloscopio
// ════════════════════════════════════════════════════════════════════════════════════════════
const LENTAS = [1000, 300, 100, 30];
export function ArcoVivoHUD({ sim, onCerrar }: { sim: MutableRefObject<ArcoSim>; onCerrar: () => void }) {
  const [, setTick] = useState(0);
  const [min, setMin] = useState(false);
  const [nota, setNota] = useState(false);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 110); return () => clearInterval(id); }, []);
  const S = sim.current, s = S.s, p = S.p;
  const fija = <K extends keyof ArcoParams>(k: K, v: ArcoParams[K]) => { S.p = { ...S.p, [k]: v }; setTick((t) => t + 1); };
  const reinicia = () => { S.s = nuevoArco(); S.pluma = crearPlumaSim(); S.lrsSobre = 0; setTick((t) => t + 1); };
  // estadística de las gotas recientes
  const ult = s.tamanos.slice(-12);
  const med = ult.length ? ult.reduce((x, y) => x + y, 0) / ult.length : 0;
  const sd = ult.length > 1 ? Math.sqrt(ult.reduce((x, y) => x + (y - med) ** 2, 0) / ult.length) : 0;
  const recientes = s.sueltas.filter((t) => t > s.t - 0.1);
  const porSeg = recientes.length >= 2 ? (recientes.length - 1) / (recientes[recientes.length - 1] - recientes[0] || 1) : 0;
  // osciloscopio: los últimos 40 ms simulados
  const W = 330, H = 96, VENT = 0.04;
  const h = s.hist, t1 = s.t, t0 = t1 - VENT;
  const x = (t: number) => ((t - t0) / VENT) * W;
  const traza = (f: (m: (typeof h)[number]) => number, lo: number, hi: number) => {
    let d = ''; const paso = Math.max(1, Math.floor(h.length / 400));
    for (let i = 0; i < h.length; i += paso) {
      const m = h[i]; if (m.t < t0) continue;
      const yy = H - ((f(m) - lo) / (hi - lo)) * H;
      d += `${d ? 'L' : 'M'}${x(m.t).toFixed(1)},${Math.max(0, Math.min(H, yy)).toFixed(1)}`;
    }
    return d;
  };
  const a = s.a * 1e3;
  const Bal = bRecto(s.I, RW) * 1e3;
  return (
    <div className={`av-hud ${min ? 'min' : ''}`} data-testid="arco-hud">
      <style>{CSS_AV}</style>
      <div className="av-cab">
        <button className="av-tit" onClick={() => setMin((m) => !m)}>{min ? '▸' : '▾'} SIMULACIÓN EN VIVO · EL ARCO</button>
        <button className={`av-circ ${S.verCircuito ? 'on' : ''}`} onClick={() => { S.verCircuito = !S.verCircuito; setTick((t) => t + 1); }} title="el circuito de La Pluma, vivo">⚡ circuito</button>
        <span className="av-fps">{Math.round(S.fps)} fps</span>
        <button className="av-x" onClick={onCerrar} title="apagar la simulación">✕</button>
      </div>
      {!min && (<>
        <div className="av-fila">
          <button className={p.modo === 'campanazo' ? 'on' : ''} onClick={() => { fija('modo', 'campanazo'); reinicia(); }} data-testid="arco-campanazo">CAMPANAZO a f₂</button>
          <button className={p.modo === 'cc' ? 'on' : ''} onClick={() => { fija('modo', 'cc'); reinicia(); }} data-testid="arco-cc">ARCO CC</button>
          <button onClick={() => { S.pausa = !S.pausa; setTick((t) => t + 1); }} data-testid="arco-pausa">{S.pausa ? '▶' : '❚❚'}</button>
          <select value={Math.round(1 / S.lenta)} onChange={(e) => { S.lenta = 1 / Number(e.target.value); setTick((t) => t + 1); }} title="cámara lenta">
            {LENTAS.map((l) => <option key={l} value={l}>×1/{l}</option>)}
          </select>
        </div>
        <div className="av-per">
          <Perilla et="corriente base" u="A" v={p.I0} min={15} max={130} paso={1} on={(v) => fija('I0', v)} />
          {p.modo === 'campanazo' && <Perilla et="onda a f₂" u="A" v={p.I1} min={0} max={60} paso={1} on={(v) => fija('I1', v)} />}
          {p.modo === 'campanazo' && <Perilla et="gota pedida" u="mm" v={p.aObj} min={0.32} max={0.62} paso={0.01} on={(v) => fija('aObj', v)} />}
          <Perilla et="alambre" u="m/min" v={p.vf} min={1} max={8} paso={0.1} on={(v) => fija('vf', v)} />
          <Perilla et="hueco" u="mm" v={p.gap} min={0.8} max={6} paso={0.1} on={(v) => fija('gap', v)} />
        </div>
        <div className="av-lec">
          <Lec et={S.circuitoOn ? 'I real / pedida' : 'I'} v={S.circuitoOn ? `${s.I.toFixed(0)} / ${s.Iref.toFixed(0)} A` : `${s.I.toFixed(0)} A`} c="#f4b942" />
          <Lec et="V arco" v={s.corto ? 'CORTO' : `${s.V.toFixed(1)} V`} c="#4fd6ff" />
          <Lec et="largo" v={`${Math.max(0, s.L).toFixed(2)} mm`} />
          <Lec et="gota" v={`${a.toFixed(3)} mm`} c="#ffb45c" />
          <Lec et="f₂ gota" v={`${f2Hz(s.a).toFixed(0)} Hz`} />
          <Lec et="B alambre" v={`${Bal.toFixed(1)} mT`} c="#ff9f43" />
          <Lec et="pellizco/σ" v={`${(pellizco(s.I) * 100).toFixed(1)} %`} c="#ff6bd6" />
          <Lec et="|E| punta" v={S.campo ? `${S.campo.Epunta.toFixed(0)} V/mm` : '—'} c="#4fd6ff" />
          <Lec et="gotas/s" v={porSeg ? porSeg.toFixed(0) : '—'} />
          <Lec et="tamaño" v={med ? `${med.toFixed(3)}±${sd.toFixed(3)}` : '—'} />
          <Lec et="gotas" v={`${s.gotas}`} />
          <Lec et="cortos" v={`${s.cortos}`} c={s.cortos ? '#ff8a80' : undefined} />
        </div>
        {S.circuitoOn && S.pluma && (
          <div className={`av-lrs ${S.pluma.lrsApagada ? 'mal' : S.pluma.lrsCarga > 1.05 ? 'w' : ''}`}>
            LRS {(S.pluma.lrsCarga * 100).toFixed(0)} %{S.pluma.lrsApagada ? ' · SE APAGÓ (sobrecarga) — reinicia' : S.pluma.lrsCarga > 1.05 ? ` · sobrecarga ${S.lrsSobre.toFixed(1)}/5 s${S.pluma.lrsLimitando ? ' · limita a 30 A, el bus se cae' : ''}` : ''}
            {S.lentaEfectiva < S.lenta * 0.95 ? ` · el circuito limita la cámara lenta a ×1/${Math.round(1 / S.lentaEfectiva)}` : ''}
          </div>
        )}
        <svg className="av-osc" viewBox={`0 0 ${W} ${H}`} width={W} height={H} data-testid="arco-osc">
          {[0.25, 0.5, 0.75].map((k) => <line key={k} x1={0} x2={W} y1={H * k} y2={H * k} stroke="rgba(159,179,200,0.12)" />)}
          {s.sueltas.filter((t) => t > t0).map((t, i) => <line key={i} x1={x(t)} x2={x(t)} y1={0} y2={H} stroke="rgba(255,180,92,0.45)" strokeDasharray="2 3" />)}
          <path d={traza((m) => m.q, -0.8, 1.2)} fill="none" stroke="#e8edf3" strokeWidth={1} opacity={0.75} />
          <path d={traza((m) => m.V, 0, 70)} fill="none" stroke="#4fd6ff" strokeWidth={1.3} />
          <path d={traza((m) => m.I, 0, 140)} fill="none" stroke="#f4b942" strokeWidth={1.6} />
        </svg>
        <div className="av-ley">
          <span style={{ color: '#f4b942' }}>━ I</span> <span style={{ color: '#4fd6ff' }}>━ V</span> <span style={{ color: '#e8edf3' }}>━ q (forma de la gota)</span> <span style={{ color: '#ffb45c' }}>┆ se suelta</span> · 40 ms
        </div>
        <div className="av-fila chica">
          {([['verE', 'E'], ['verB', 'B'], ['verFlujo', 'corriente']] as const).map(([k, et]) => (
            <label key={k}><input type="checkbox" checked={S[k]} onChange={(e) => { S[k] = e.target.checked; setTick((t) => t + 1); }} /> {et}</label>
          ))}
          <button onClick={reinicia}>reiniciar</button>
        </div>
        <button className="av-q" onClick={() => setNota((n) => !n)}>{nota ? '▾' : '▸'} ¿qué estoy viendo?</button>
        {nota && <div className="av-nota">
          <b style={{ color: '#7fb4ff' }}>azul = campo B CALCULADO</b> (Biot-Savart de la geometría real del lazo; color = |B| real,
          1 µT → mT; el pulso corre en el sentido de B y respira con I(t)) · <b style={{ color: '#f08ce8' }}>magenta = campo E
          CALCULADO</b> (cargas simuladas + imágenes: electrostático del hueco; con el arco prendido el plasma conduce y la columna
          lleva ~1–2 V/mm) · nube = el plasma del arco · oro = el metal · puntos dorados = sentido de la corriente (rapidez
          simbólica) · pellizco/σ = (I/{ICRIT} A)² · el campanazo usa la f₂ verdadera (el oído real la mide). Modelo:
          scripts/canon/canon_gota.py · motor: src/lib/physics/em.ts.
          <div style={{ marginTop: 4, color: '#9fb4c8' }}>{S.infoB}</div>
        </div>}
      </>)}
    </div>
  );
}
function Perilla({ et, u, v, min, max, paso, on }: { et: string; u: string; v: number; min: number; max: number; paso: number; on: (v: number) => void }) {
  return (
    <label className="av-perilla">
      <span>{et}</span>
      <input type="range" min={min} max={max} step={paso} value={v} onChange={(e) => on(Number(e.target.value))} />
      <b>{paso < 1 ? v.toFixed(paso < 0.1 ? 2 : 1) : v.toFixed(0)} {u}</b>
    </label>
  );
}
function Lec({ et, v, c }: { et: string; v: string; c?: string }) {
  return <div className="av-l"><span>{et}</span><b style={c ? { color: c } : undefined}>{v}</b></div>;
}
const CSS_AV = `
.av-hud{position:absolute;right:12px;bottom:44px;z-index:7;width:356px;max-height:calc(100% - 60px);overflow:auto;
  background:rgba(6,10,16,0.88);border:1px solid rgba(159,179,200,0.2);border-radius:10px;padding:8px 10px 9px;
  font:11px/1.35 'JetBrains Mono',ui-monospace,monospace;color:#cfd8e3;box-shadow:0 10px 30px rgba(0,0,0,0.45);}
.av-hud.min{width:auto;}
.av-cab{display:flex;align-items:center;gap:8px;}
.av-tit{all:unset;cursor:pointer;color:#f4b942;font-weight:700;letter-spacing:.06em;font-size:10.5px;flex:1;}
.av-fps{color:#6f8196;font-size:10px;}
.av-x{all:unset;cursor:pointer;color:#8193a8;padding:0 3px;}
.av-circ{all:unset;cursor:pointer;font-size:10px;padding:2px 7px;border-radius:5px;border:1px solid rgba(79,214,255,.4);color:#9fe7ff;}
.av-circ.on{background:rgba(79,214,255,.14);}
.av-lrs{margin-top:6px;font-size:10px;color:#8fe0a5;} .av-lrs.w{color:#f4d27a;} .av-lrs.mal{color:#ff9a9a;font-weight:700;}
.av-fila{display:flex;gap:5px;margin-top:7px;align-items:center;flex-wrap:wrap;}
.av-fila button,.av-fila select{all:unset;cursor:pointer;padding:4px 7px;border-radius:5px;border:1px solid rgba(159,179,200,0.22);color:#cfd8e3;font-size:10.5px;}
.av-fila button.on{background:rgba(244,185,66,0.16);border-color:#f4b942;color:#f4d27a;}
.av-fila.chica{font-size:10.5px;gap:10px;}
.av-fila.chica input{accent-color:#f4b942;vertical-align:-2px;}
.av-per{display:grid;grid-template-columns:1fr;gap:2px;margin-top:7px;}
.av-perilla{display:grid;grid-template-columns:92px 1fr 76px;align-items:center;gap:6px;color:#8fa1b5;}
.av-perilla input{accent-color:#f4b942;width:100%;}
.av-perilla b{color:#e3e9f0;font-weight:600;text-align:right;}
.av-lec{display:grid;grid-template-columns:repeat(3,1fr);gap:3px 8px;margin-top:8px;}
.av-l{display:flex;flex-direction:column;}
.av-l span{color:#6f8196;font-size:9.5px;}
.av-l b{color:#e3e9f0;font-size:12px;font-weight:600;}
.av-osc{display:block;margin-top:8px;background:rgba(0,0,0,0.35);border-radius:5px;border:1px solid rgba(159,179,200,0.12);width:100%;height:auto;}
.av-ley{margin-top:3px;font-size:9.5px;color:#8193a8;}
.av-q{all:unset;cursor:pointer;display:block;margin-top:6px;color:#8fa1b5;font-size:10px;}
.av-nota{margin-top:5px;padding-top:6px;border-top:1px solid rgba(159,179,200,0.14);font-size:9.5px;color:#7d8fa3;}
.av-etq{white-space:nowrap;font:600 11px 'JetBrains Mono',ui-monospace,monospace;color:#f4d27a;letter-spacing:.06em;
  background:rgba(6,10,16,0.75);padding:2px 7px;border-radius:4px;border:1px solid rgba(244,185,66,0.45);}
@media (max-width:760px){.av-hud{left:8px;right:8px;width:auto;bottom:40px;max-height:46%;}}
`;
