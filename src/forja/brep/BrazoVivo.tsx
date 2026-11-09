/**
 * BRAZO VIVO — la escena y el tablero del brazo de 3 ejes, dentro del visor del CAD (orden 2026-11-05-brazo-robotico)
 * ===================================================================================================================
 * Mismo patrón que ArcoVivo.tsx: NO crea un lienzo R3F propio. <BrazoVivoEscena> vive dentro del grupo Z-arriba del
 * CadViewport (mm del doc) y <BrazoVivoHUD> es DOM encima del visor. La física es brazoVivo.ts (puro, probado).
 *
 *   · EL BRAZO: tubos de PLA ámbar, placas y carcasas grafito, cicloidales con la carcasa del anillo translúcida (se ven los
 *     5 discos con el perfil REAL de cycloidal.ts y los 17 pernos del anillo, que giran con la salida: config B), etapas
 *     planetarias de aluminio, motores con su tapa y bornes, el par de conductores de cada motor (rojo +, negro −).
 *     Ultraliviano: UNA SkinnedMesh por material con 8 huesos (base, torreta, brazo, antebrazo, pinza, 2 dedos, carga):
 *     un draw call por familia aunque cada cuerpo se mueva por su lado; nada se re-renderiza por cuadro.
 *   · LA CARGA en los cables: puntos dorados en el sentido convencional de I (rapidez simbólica ∝ I).
 *   · EL CAMPO B (mundo AZUL): líneas trazadas UNA vez por fuente (inducido y cable de cada motor, en el marco de su
 *     cuerpo) con I = 1 A en el worker del motor v2; el shader multiplica por la corriente VIVA de su motor.
 *   · EL GAUSSÍMETRO: una sonda que se arrastra; lee |B| y su dirección sumando TODAS las fuentes vivas (Biot-Savart).
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three-stdlib';   // como el estudio: la de three/examples daba «Multiple instances of Three.js» en dev
import { LineasFlujo, trazarCampoMm, geoDeLineas, remuestrearPolis, PALETA_B, type GeoLineas } from './CampoReal';
import { semillasAlrededor, type Vec3 } from '../../lib/physics/em';
import {
  PARAMS_BRAZO, nuevoBrazo, correrBrazo, leerBrazo, referenciaBrazoTs, disposicion, posesCuerpos, nuevasPoses, aRaiz, enEje,
  fuentesDelBrazo, gaussimetro, nuevaLecturaB, cicloidal, cargaEnPinza, puntaDe, derivarJunta, D_PINZA,
  BRAZO_CFG, piezasBancoBrazo,
  type BrazoParams, type BrazoEstado, type BrazoConfig, type FuenteB, type RutaCable, type LecturaB, type V3, type Caja,
  type Pose, type ModoTray, type ModoCtrl, type PiezaRef,
} from './brazoVivo';

export { piezasBancoBrazo, BRAZO_CFG };
export type { BrazoConfig, PiezaRef };

export interface BrazoSim {
  s: BrazoEstado; p: BrazoParams;
  lenta: number;            // 1 = tiempo real
  pausa: boolean;
  verB: boolean; verFlujo: boolean; verSonda: boolean;
  sonda: V3;                // mm, marco del brazo (origen en la mesa, bajo el eje de la base)
  lectura: LecturaB;        // lo que lee el gaussímetro (T)
  fuentes: FuenteB[]; rutas: RutaCable[];
  poses: Pose[];
  fps: number; infoB: string;
}
export function crearBrazoSim(): BrazoSim {
  const p = PARAMS_BRAZO;
  const { fuentes, rutas } = fuentesDelBrazo(p);
  return {
    s: nuevoBrazo(p), p, lenta: 1, pausa: false, verB: true, verFlujo: true, verSonda: true,
    sonda: [40, 150, 330], lectura: nuevaLecturaB(), fuentes, rutas, poses: nuevasPoses(), fps: 60, infoB: 'calculando el campo B…',
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// geometría (mm, marco de cada cuerpo)
// ════════════════════════════════════════════════════════════════════════════════════════════
const _Y = new THREE.Vector3(0, 1, 0);
function cil(a: V3, b: V3, r: number, seg = 28): THREE.BufferGeometry {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, Math.max(L, 1e-3), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_Y, B.clone().sub(A).normalize()));
  const m = A.add(B).multiplyScalar(0.5); g.translate(m.x, m.y, m.z);
  return g;
}
function caja(k: Caja, rad = 2): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(k.w, k.d, k.h, 2, Math.min(rad, Math.min(k.w, k.d, k.h) / 2 - 0.01));
  g.translate(k.c[0], k.c[1], k.c[2]);
  return g;
}
function tuboDe(pts: V3[], r: number): THREE.BufferGeometry {
  const curva = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), false, 'centripetal');
  return new THREE.TubeGeometry(curva, Math.max(8, pts.length * 2), r, 6, false);
}
/** Base ⟂ a e: (u, v) con u × v = e. */
function basePerp(e: V3): [THREE.Vector3, THREE.Vector3, THREE.Vector3] {
  const E = new THREE.Vector3(...e).normalize();
  const a = Math.abs(E.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const u = a.clone().cross(E).normalize(), v = E.clone().cross(u);
  return [u, v, E];
}
type Familia = 'pla' | 'graf' | 'alu' | 'acero' | 'negro' | 'cobre' | 'disco' | 'vidrio' | 'cable' | 'laton';
interface Pieza { f: Familia; g: THREE.BufferGeometry; h: number; col?: [number, number, number] }
/** Huesos: 0 base · 1 torreta · 2 brazo · 3 antebrazo · 4 pinza (nivelada) · 5, 6 dedos · 7 carga. */
const N_HUESOS = 8;

function piezasDelBrazo(p: BrazoParams, fuentes: FuenteB[]): { piezas: Pieza[]; latas: { h: number; g: THREE.BufferGeometry }[] } {
  const d = disposicion(p), piezas: Pieza[] = [], latas: { h: number; g: THREE.BufferGeometry }[] = [];
  const pon = (f: Familia, h: number, geo: THREE.BufferGeometry, col?: [number, number, number]) => piezas.push({ f, g: geo, h, col });
  // ── los accionamientos: estator, discos, planetaria y motor en el PADRE; anillo con pernos en el HIJO
  d.mont.forEach((m, j) => {
    const J = p.juntas[j], cd = cicloidal(J.cic), [u, v, E] = basePerp(m.e);
    pon('graf', m.padre, cil(enEje(m, -3), enEje(m, 0), m.rCic, 40));
    const forma = new THREE.Shape(cd.perfil.map((q) => new THREE.Vector2(q.x, q.y)));
    const disco0 = new THREE.ExtrudeGeometry(forma, { depth: J.cic.t, bevelEnabled: false, curveSegments: 1 });
    for (let k = 0; k < J.cic.discos; k++) {
      const s0 = -3 - cd.pila + k * (J.cic.t + J.cic.gap);
      const P = new THREE.Vector3(...enEje(m, s0)).addScaledVector(u, J.cic.E * (k % 2 ? -1 : 1));   // discos a 180° (balance)
      const M = new THREE.Matrix4().makeBasis(u, v, E).setPosition(P);
      pon('disco', m.padre, disco0.clone().applyMatrix4(M));
    }
    disco0.dispose();
    pon('acero', m.padre, cil(enEje(m, -cd.largo + 3), enEje(m, m.previa[0]), 3.5, 12));                // eje excéntrico
    pon('alu', m.padre, cil(enEje(m, m.previa[0]), enEje(m, m.previa[1]), m.rPrev, 36));                // planetaria
    pon('alu', m.padre, cil(enEje(m, m.previa[0]), enEje(m, m.previa[0] + 4), m.rPrev + 3, 36));       // brida
    latas.push({ h: m.padre, g: cil(enEje(m, m.motor[0]), enEje(m, m.motor[1] - 6), m.rMot, 40) });   // la lata del motor
    pon('negro', m.padre, cil(enEje(m, m.motor[1] - 6), enEje(m, m.motor[1]), m.rMot - 0.8, 40));      // tapa trasera
    for (const sg of [1, -1]) {
      const o = new THREE.Vector3(...m.qMag).multiplyScalar(5 * sg);
      const a = new THREE.Vector3(...enEje(m, m.motor[1])).add(o), b = new THREE.Vector3(...enEje(m, m.motor[1] + 4)).add(o);
      pon('cobre', m.padre, cil([a.x, a.y, a.z], [b.x, b.y, b.z], 1.4, 8));                              // bornes
    }
    pon('vidrio', m.hijo, cil(enEje(m, -cd.largo + 3, true), enEje(m, -3, true), m.rCic + 0.6, 48));   // carcasa del anillo
    pon('pla', m.hijo, cil(enEje(m, -cd.largo, true), enEje(m, -cd.largo + 3, true), m.rCic + 0.6, 48)); // tapa del anillo
    for (let k = 0; k < cd.pernos; k++) {
      const a = (2 * Math.PI * k) / cd.pernos, o = u.clone().multiplyScalar(J.cic.R * Math.cos(a)).addScaledVector(v, J.cic.R * Math.sin(a));
      const A = new THREE.Vector3(...enEje(m, -3 - cd.pila, true)).add(o), B = new THREE.Vector3(...enEje(m, -3, true)).add(o);
      pon('acero', m.hijo, cil([A.x, A.y, A.z], [B.x, B.y, B.z], J.cic.Rr, 8));
    }
  });
  // ── torreta
  pon('graf', 1, cil(d.platoTorreta.a, d.platoTorreta.b, d.platoTorreta.r, 64));
  d.placasTorreta.forEach((k) => pon('graf', 1, caja(k)));
  // ── brazo
  pon('pla', 2, cil(d.cuboHombro.a, d.cuboHombro.b, d.cuboHombro.r, 40));
  pon('pla', 2, cil(d.tuboBrazo.a, d.tuboBrazo.b, d.tuboBrazo.r, 32));
  d.horquillaCodo.forEach((k) => pon('graf', 2, caja(k)));
  // ── antebrazo (la muñeca va fija: collar entre los dos tubos de brazo.ts)
  pon('pla', 3, cil(d.cuboCodo.a, d.cuboCodo.b, d.cuboCodo.r, 40));
  pon('pla', 3, cil(d.tubo2.a, d.tubo2.b, d.tubo2.r, 32));
  pon('pla', 3, cil(d.tubo3.a, d.tubo3.b, d.tubo3.r, 32));
  pon('alu', 3, cil(d.collar.a, d.collar.b, d.collar.r, 32));
  pon('alu', 3, cil([d.punta, -18, 0], [d.punta, 18, 0], 12, 28));                      // nudillo de la pinza
  // ── la pinza nivelada (hueso 4: origen en la punta, x a lo largo del brazo en planta, z arriba) y los dedos (5, 6)
  pon('alu', 4, cil([0, 0, 0], [0, 0, -24], 5, 16));
  pon('graf', 4, caja({ c: [0, 0, -29], w: 34, d: 80, h: 12 }));
  for (const h of [5, 6]) pon('graf', h, caja({ c: [0, 0, 0], w: 16, d: 6, h: 58 }, 1.2));
  // ── la carga (hueso 7): latón
  pon('laton', 7, cil([0, 0, -p.tray.hObj / 2], [0, 0, p.tray.hObj / 2], p.tray.rObj, 40));
  // ── los cables: el par de conductores de cada motor, tramo por tramo, fijo a su cuerpo
  for (const f of fuentes) if (f.tipo === 'cable') {
    pon('cable', f.cuerpo, tuboDe(f.polis[0], 1.2), [0.75, 0.12, 0.1]);
    pon('cable', f.cuerpo, tuboDe(f.polis[1], 1.2), [0.07, 0.075, 0.085]);
  }
  return { piezas, latas };
}
/** Funde las piezas de una familia en UNA geometría con skinIndex/skinWeight (cada vértice 100 % a su hueso). */
function fundir(pz: Pieza[]): THREE.BufferGeometry | null {
  if (!pz.length) return null;
  const gs = pz.map((q) => {
    const x = q.g.index ? q.g.toNonIndexed() : q.g;
    if (x !== q.g) q.g.dispose();
    x.deleteAttribute('uv');
    const n = x.getAttribute('position').count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = q.h; sw[i * 4] = 1; }
    x.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    x.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    if (q.col) {
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.set(q.col, i * 3);
      x.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    }
    return x;
  });
  const m = mergeGeometries(gs, false);
  gs.forEach((x) => x.dispose());
  return m;
}
function materiales(): Record<Familia, THREE.Material> {
  return {
    pla: new THREE.MeshPhysicalMaterial({ color: '#e8a33d', roughness: 0.58, metalness: 0, clearcoat: 0.06, sheen: 0.35, sheenColor: new THREE.Color('#ffd28a') }),
    graf: new THREE.MeshPhysicalMaterial({ color: '#2a2e35', roughness: 0.64, metalness: 0.05, clearcoat: 0.05 }),
    alu: new THREE.MeshPhysicalMaterial({ color: '#b8bec6', metalness: 0.9, roughness: 0.32 }),
    acero: new THREE.MeshPhysicalMaterial({ color: '#cfd4db', metalness: 0.95, roughness: 0.24 }),
    negro: new THREE.MeshPhysicalMaterial({ color: '#131519', metalness: 0.1, roughness: 0.5, clearcoat: 0.3 }),
    cobre: new THREE.MeshPhysicalMaterial({ color: '#c47a3a', metalness: 0.95, roughness: 0.28 }),
    disco: new THREE.MeshPhysicalMaterial({ color: '#e9e3d4', roughness: 0.62 }),
    vidrio: new THREE.MeshPhysicalMaterial({ color: '#f0b04a', roughness: 0.35, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide }),
    cable: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.5 }),
    laton: new THREE.MeshPhysicalMaterial({ color: '#c9a23a', metalness: 0.92, roughness: 0.3 }),
  };
}

// ── semillas de las líneas de B (mm, marco del cuerpo) ──
interface GrupoCampo { cuerpo: number; motor: number; polis: V3[][]; sem: Float64Array; caja: [Vec3, Vec3] }
function gruposCampo(fuentes: FuenteB[], p: BrazoParams): GrupoCampo[] {
  const mapa = new Map<string, FuenteB[]>();
  for (const f of fuentes) { const k = `${f.cuerpo}-${f.motor}`; mapa.set(k, [...(mapa.get(k) ?? []), f]); }
  const out: GrupoCampo[] = [];
  for (const fs of mapa.values()) {
    const polis: V3[][] = [], sem: number[] = [];
    for (const f of fs) {
      polis.push(...f.polis);
      if (f.tipo === 'inducido' && f.centro && f.e && f.qMag && f.radio && f.largo) {
        const c = f.centro, e = f.e, q = f.qMag, r = f.radio, l = f.largo, rM = p.juntas[f.motor].motor.radio;
        const w: V3 = [e[1] * q[2] - e[2] * q[1], e[2] * q[0] - e[0] * q[2], e[0] * q[1] - e[1] * q[0]];
        const pt = (t: number, a: number, va: V3, b = 0, vb: V3 = w) => sem.push(c[0] + t * e[0] + a * va[0] + b * vb[0], c[1] + t * e[1] + a * va[1] + b * vb[1], c[2] + t * e[2] + a * va[2] + b * vb[2]);
        for (const t of [-0.36, -0.18, 0, 0.18, 0.36]) for (const o of [0, 0.4, -0.4]) pt(t * l, o * r, w);
        for (const t of [-0.25, 0.25]) for (const sg of [1, -1]) { pt(t * l, sg * (rM + 8), q); pt(t * l, sg * (rM + 22), q); }
        for (const sg of [1, -1]) pt(0, sg * (rM + 12), w);
      } else if (f.tipo === 'cable') {
        const s = semillasAlrededor(remuestrearPolis([f.polis[0]], 6) as Vec3[][], 34, [2.6, 6, 12]);
        for (let i = 0; i < s.length; i++) sem.push(s[i]);
      }
    }
    const pts = polis.flat();
    const mn = [0, 1, 2].map((k) => Math.min(...pts.map((v) => v[k])) - 140) as Vec3, mx = [0, 1, 2].map((k) => Math.max(...pts.map((v) => v[k])) + 140) as Vec3;
    out.push({ cuerpo: fs[0].cuerpo, motor: fs[0].motor, polis, sem: Float64Array.from(sem), caja: [mn, mx] });
  }
  return out;
}

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _vv = new THREE.Vector3(), _l: V3 = [0, 0, 0], _pr: V3 = [0, 0, 0];
const COL_J = ['#f4b942', '#ff7a45', '#c8d3df'];
const NOMBRE_J = ['base', 'hombro', 'codo'];

// ════════════════════════════════════════════════════════════════════════════════════════════
// LA ESCENA
// ════════════════════════════════════════════════════════════════════════════════════════════
export function BrazoVivoEscena({ sim, cfg }: { sim: MutableRefObject<BrazoSim>; cfg: BrazoConfig }) {
  const controls = useThree((st) => st.controls) as unknown as { enabled: boolean } | null;
  const camera = useThree((st) => st.camera);
  const gl = useThree((st) => st.gl);
  const raiz = useRef<THREE.Group>(null);
  const sondaRef = useRef<THREE.Group>(null);
  const etqRef = useRef<HTMLDivElement>(null);
  const puntosRef = useRef<THREE.InstancedMesh>(null);
  const tEtq = useRef(0);
  const off = useRef([0, 0, 0]);
  const apertura = useRef(12);
  const corr = useMemo(() => [0, 1, 2].map(() => ({ current: 0 }) as MutableRefObject<number>), []);
  const vel = useMemo(() => [0, 1, 2].map(() => ({ current: 0.35 }) as MutableRefObject<number>), []);

  // ── el brazo: huesos + una SkinnedMesh por familia + las latas de los motores (brillan con I²R)
  const arm = useMemo(() => {
    const S = sim.current;
    const huesos = Array.from({ length: N_HUESOS }, () => { const b = new THREE.Bone(); b.matrixAutoUpdate = false; return b; });
    const skel = new THREE.Skeleton(huesos, huesos.map(() => new THREE.Matrix4()));
    const mats = materiales();
    const { piezas, latas } = piezasDelBrazo(S.p, S.fuentes);
    const mallas: THREE.SkinnedMesh[] = [];
    (Object.keys(mats) as Familia[]).forEach((f) => {
      const geo = fundir(piezas.filter((q) => q.f === f)); if (!geo) return;
      const m = new THREE.SkinnedMesh(geo, mats[f]);
      m.bind(skel, new THREE.Matrix4());
      m.frustumCulled = false;
      if (f === 'vidrio') m.renderOrder = 3;
      mallas.push(m);
    });
    const matLata = [0, 1, 2].map(() => new THREE.MeshPhysicalMaterial({ color: '#3a3f47', metalness: 0.85, roughness: 0.34, clearcoat: 0.2, emissive: new THREE.Color('#ff5a1f'), emissiveIntensity: 0 }));
    const lataMallas = latas.map((l, j) => { const m = new THREE.Mesh(l.g, matLata[j]); huesos[l.h].add(m); return m; });
    // puntos de corriente: uno cada ~14 mm del lazo de cada motor
    const nPorRuta = S.rutas.map((r) => Math.max(8, Math.round(r.largo / 14)));
    const bola = new THREE.SphereGeometry(1, 8, 6);
    return { huesos, skel, mats, mallas, matLata, lataMallas, nPorRuta, nPuntos: nPorRuta.reduce((a, b) => a + b, 0), bola };
  }, [sim]);
  useEffect(() => () => {
    arm.mallas.forEach((m) => m.geometry.dispose());
    Object.values(arm.mats).forEach((m) => m.dispose());
    arm.lataMallas.forEach((m) => m.geometry.dispose());
    arm.matLata.forEach((m) => m.dispose());
    arm.skel.dispose(); arm.bola.dispose();
  }, [arm]);

  // ── las líneas de B: trazadas UNA vez por (cuerpo, motor) con 1 A, en el worker
  const [lineas, setLineas] = useState<{ cuerpo: number; motor: number; g: GeoLineas }[]>([]);
  useEffect(() => {
    let vivo = true;
    const S = sim.current, gr = gruposCampo(S.fuentes, S.p), t0 = performance.now();
    Promise.all(gr.map((G) => trazarCampoMm(G.polis, G.sem, { hMin: 0.2, hMax: 10, maxPasos: 520, rDentro: 0.7, caja: G.caja })
      .then((pq) => ({ cuerpo: G.cuerpo, motor: G.motor, g: geoDeLineas(pq, 26), n: pq.inicio.length, cerradas: pq.cerradas, v: pq.mag.length }))))
      .then((res) => {
        if (!vivo) { res.forEach((r) => r.g.geo.dispose()); return; }
        setLineas(res.map(({ cuerpo, motor, g }) => ({ cuerpo, motor, g })));
        const n = res.reduce((a, r) => a + r.n, 0), c = res.reduce((a, r) => a + r.cerradas, 0), v = res.reduce((a, r) => a + r.v, 0);
        sim.current.infoB = `${n} líneas de B calculadas (${c} cerradas) en ${gr.length} fuentes · ${v.toLocaleString('es-MX')} vértices · ${(performance.now() - t0).toFixed(0)} ms en el worker`;
      })
      .catch((e) => { if (vivo) sim.current.infoB = `campo B: ${String(e)}`; });
    return () => { vivo = false; };
  }, [sim]);
  useEffect(() => () => { lineas.forEach((l) => l.g.geo.dispose()); }, [lineas]);

  // ── el gaussímetro: flecha de B + etiqueta
  const flecha = useMemo(() => {
    const a = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 40, 0x4fd6ff, 10, 6);
    (a.line.material as THREE.LineBasicMaterial).toneMapped = false;
    (a.cone.material as THREE.MeshBasicMaterial).toneMapped = false;
    a.renderOrder = 6;
    return a;
  }, []);
  useEffect(() => () => flecha.dispose(), [flecha]);

  useFrame((_, dtw) => {
    const S = sim.current, s = S.s, p = S.p;
    const dt = Math.min(dtw, 0.05), dtSim = S.pausa ? 0 : dt * S.lenta;
    if (dtSim > 0) correrBrazo(s, p, dtSim);
    S.fps = S.fps * 0.94 + (1 / Math.max(dtw, 1e-3)) * 0.06;
    const P = posesCuerpos(p, s.q, S.poses);
    // ── huesos de los cuerpos
    for (let b = 0; b < 4; b++) {
      const R = P[b].R, o = P[b].o, h = arm.huesos[b];
      h.matrix.set(R[0], R[1], R[2], o[0], R[3], R[4], R[5], o[1], R[6], R[7], R[8], o[2], 0, 0, 0, 1);
      h.matrixWorldNeedsUpdate = true;
    }
    // ── la pinza nivelada (gira solo con la base), los dedos y la carga
    const tip = aRaiz(P[3], [p.geo.L2 + p.geo.L3, 0, 0], _pr);
    _m.makeRotationZ(s.q[0]).setPosition(tip[0], tip[1], tip[2]);
    arm.huesos[4].matrix.copy(_m); arm.huesos[4].matrixWorldNeedsUpdate = true;
    apertura.current += ((s.pegada ? 0 : 12) - apertura.current) * Math.min(1, dt * 8);
    [1, -1].forEach((sg, k) => {
      _m2.makeTranslation(0, sg * (p.tray.rObj + 3 + apertura.current), -D_PINZA);
      arm.huesos[5 + k].matrix.multiplyMatrices(_m, _m2); arm.huesos[5 + k].matrixWorldNeedsUpdate = true;
    });
    const c = s.pegada ? cargaEnPinza(p, s.q) : s.obj;
    arm.huesos[7].matrix.makeTranslation(c[0], c[1], c[2]); arm.huesos[7].matrixWorldNeedsUpdate = true;
    // ── los motores: el campo respira con su corriente; la lata brilla con I²R
    for (let j = 0; j < 3; j++) {
      const I = s.i[j];
      corr[j].current = I;
      if (I > 0.3) vel[j].current = 0.35; else if (I < -0.3) vel[j].current = -0.35;   // el pulso corre en el sentido de B
      arm.matLata[j].emissiveIntensity = Math.min(1.6, (s.Mo.R[j] * I * I) / 22);
    }
    // ── la carga en los cables (sentido convencional; rapidez simbólica ∝ I)
    const pm = puntosRef.current;
    if (pm) {
      pm.visible = S.verFlujo;
      if (pm.visible) {
        let idx = 0;
        S.rutas.forEach((ru, r) => {
          const m = ru.motor, I = s.i[m], nD = arm.nPorRuta[r];
          off.current[m] = (((off.current[m] + dtSim * Math.max(-260, Math.min(260, 45 * I))) % ru.largo) + ru.largo) % ru.largo;
          const esc = Math.min(2.6, 0.9 + 0.22 * Math.abs(I));
          for (let k = 0; k < nD; k++) {
            let sa = ((((k * ru.largo) / nD + off.current[m]) % ru.largo) + ru.largo) % ru.largo;
            let t = ru.tramos[0];
            for (const tr of ru.tramos) { t = tr; if (sa <= tr.largo) break; sa -= tr.largo; }
            const f = Math.min(t.n - 1.0001, (sa / Math.max(t.largo, 1e-6)) * (t.n - 1)), i0 = Math.floor(f), fr = f - i0, a = 3 * i0;
            _l[0] = t.pts[a] + (t.pts[a + 3] - t.pts[a]) * fr; _l[1] = t.pts[a + 1] + (t.pts[a + 4] - t.pts[a + 1]) * fr; _l[2] = t.pts[a + 2] + (t.pts[a + 5] - t.pts[a + 2]) * fr;
            aRaiz(P[t.cuerpo], _l, _pr);
            _m.makeScale(esc, esc, esc).setPosition(_pr[0], _pr[1], _pr[2]);
            pm.setMatrixAt(idx++, _m);
          }
        });
        pm.instanceMatrix.needsUpdate = true;
      }
    }
    // ── el gaussímetro: B de TODAS las fuentes vivas en la punta de la sonda
    const L = gaussimetro(S.fuentes, P, s.i, S.sonda, S.lectura);
    const G = sondaRef.current;
    if (G) {
      G.visible = S.verSonda;
      G.position.set(S.sonda[0], S.sonda[1], S.sonda[2]);
      if (L.mod > 1e-12) {
        flecha.setDirection(_vv.set(L.B[0] / L.mod, L.B[1] / L.mod, L.B[2] / L.mod));
        const len = Math.max(10, Math.min(110, 14 * (Math.log10(L.mod) + 7.3)));
        flecha.setLength(len, Math.min(12, len * 0.3), Math.min(7, len * 0.18));
        flecha.visible = true;
      } else flecha.visible = false;
      const now = performance.now();
      if (etqRef.current && now - tEtq.current > 110) { tEtq.current = now; etqRef.current.textContent = `|B| ${fmtB(L.mod)}`; }
    }
  });

  // ── arrastrar la sonda (patrón de SectionGizmo: plano frente a la cámara, escucha en window)
  const empezar = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const R = raiz.current; if (!R) return;
    if (controls) controls.enabled = false;
    R.updateWorldMatrix(true, false);
    const pw = R.localToWorld(new THREE.Vector3(...sim.current.sonda));
    const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), pw);
    const ray = new THREE.Raycaster(), rect = gl.domElement.getBoundingClientRect();
    const golpe = (cx: number, cy: number) => {
      ray.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1), camera);
      const h = new THREE.Vector3(); return ray.ray.intersectPlane(plano, h) ? h : null;
    };
    const h0 = golpe(e.clientX, e.clientY), corrimiento = h0 ? pw.clone().sub(h0) : new THREE.Vector3();
    const mover = (ev: PointerEvent) => {
      const h = golpe(ev.clientX, ev.clientY); if (!h) return;
      const l = R.worldToLocal(h.add(corrimiento));
      sim.current.sonda = [l.x, l.y, Math.max(-20, l.z)];
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar);
      if (controls) controls.enabled = true;
    };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  };

  const verB = () => sim.current.verB;
  return (
    <group ref={raiz} position={cfg.origen}>
      {arm.huesos.map((h, b) => (
        <primitive key={`h${b}`} object={h}>
          {lineas.filter((l) => l.cuerpo === b).map((l) => (
            <LineasFlujo key={`${l.cuerpo}-${l.motor}`} g={l.g} paleta={PALETA_B} logLo={-5.6} logHi={-2.4} escala={corr[l.motor]} vel={vel[l.motor]} si={verB} />
          ))}
        </primitive>
      ))}
      {arm.mallas.map((m, k) => <primitive key={`m${k}`} object={m} />)}
      <instancedMesh ref={puntosRef} args={[arm.bola, undefined, arm.nPuntos]} frustumCulled={false} renderOrder={5}>
        <meshBasicMaterial color="#ffc94a" toneMapped={false} transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      {/* EL GAUSSÍMETRO: sonda Hall que se arrastra (la lectura es la punta) */}
      <group ref={sondaRef}>
        <mesh onPointerDown={empezar} renderOrder={6}>
          <sphereGeometry args={[4, 24, 16]} />
          <meshStandardMaterial color="#4fd6ff" emissive="#4fd6ff" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
        <mesh onPointerDown={empezar} visible={false}>
          <sphereGeometry args={[16, 12, 8]} />
          <meshBasicMaterial />
        </mesh>
        <mesh position={[0, 0, 75]} rotation={[Math.PI / 2, 0, 0]} onPointerDown={empezar}>
          <cylinderGeometry args={[2.2, 2.2, 142, 12]} />
          <meshPhysicalMaterial color="#2b2f36" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 190]} rotation={[Math.PI / 2, 0, 0]} onPointerDown={empezar}>
          <cylinderGeometry args={[7, 7, 92, 20]} />
          <meshPhysicalMaterial color="#14161a" roughness={0.5} clearcoat={0.4} />
        </mesh>
        <mesh position={[0, 0, 146]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[7.4, 7.4, 6, 20]} />
          <meshStandardMaterial color="#4fd6ff" emissive="#4fd6ff" emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
        <primitive object={flecha} />
        <Html position={[0, 0, 250]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={etqRef} className="bv-etq" data-testid="gauss-etq">|B| —</div>
        </Html>
      </group>
    </group>
  );
}
function fmtB(T: number): string {
  if (!(T > 0)) return '0';
  if (T >= 1e-3) return `${(T * 1e3).toFixed(T >= 1e-2 ? 1 : 2)} mT`;
  if (T >= 1e-6) return `${(T * 1e6).toFixed(T >= 1e-4 ? 0 : 1)} µT`;
  return `${(T * 1e9).toFixed(0)} nT`;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// EL TABLERO (DOM): trayectoria, perillas, lecturas, energía, osciloscopio y gaussímetro
// ════════════════════════════════════════════════════════════════════════════════════════════
const LENTAS = [1, 2, 5, 20];
export function BrazoVivoHUD({ sim, onCerrar }: { sim: MutableRefObject<BrazoSim>; onCerrar: () => void }) {
  const [, setTick] = useState(0);
  const [min, setMin] = useState(false);
  const [nota, setNota] = useState(false);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 120); return () => clearInterval(id); }, []);
  const S = sim.current, s = S.s, p = S.p;
  const toca = () => setTick((t) => t + 1);
  const fijaTray = <K extends keyof BrazoParams['tray']>(k: K, v: BrazoParams['tray'][K]) => { S.p = { ...S.p, tray: { ...S.p.tray, [k]: v } }; toca(); };
  const fijaCtrl = <K extends keyof BrazoParams['ctrl']>(k: K, v: BrazoParams['ctrl'][K]) => { S.p = { ...S.p, ctrl: { ...S.p.ctrl, [k]: v } }; toca(); };
  const reinicia = () => { S.s = nuevoBrazo(S.p); toca(); };
  const L = leerBrazo(s, p);
  const ref = referenciaBrazoTs(p, s.pegada);
  const der = p.juntas.map((j) => derivarJunta(j));
  const tip = puntaDe(p, s.q);
  // osciloscopio: los últimos 4 s (corriente arriba, ángulo abajo)
  const W = 330, H = 116, h2 = H / 2 - 3, H_ = s.hist;
  const orden: number[] = [];
  for (let k = 0; k < H_.lleno; k++) orden.push((H_.cab - H_.lleno + k + H_.n) % H_.n);
  const t1 = s.t, t0 = t1 - 4;
  const x = (t: number) => ((t - t0) / 4) * W;
  const rango = (arr: Float32Array, j: number, esc: number) => {
    let lo = Infinity, hi = -Infinity;
    for (const c of orden) for (let k = 0; k < 3; k++) { const v = arr[3 * c + k] * esc; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!isFinite(lo)) { lo = -1; hi = 1; }
    if (hi - lo < 1e-3) { lo -= 0.5; hi += 0.5; }
    void j; return [lo, hi] as const;
  };
  const traza = (arr: Float32Array, j: number, esc: number, lo: number, hi: number, y0: number) => {
    let d = '';
    for (const c of orden) {
      const t = H_.t[c]; if (t < t0) continue;
      const y = y0 + h2 - ((arr[3 * c + j] * esc - lo) / (hi - lo)) * h2;
      d += `${d ? 'L' : 'M'}${x(t).toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  };
  const [iLo, iHi] = rango(H_.i, 0, 1), [qLo, qHi] = rango(H_.q, 0, 180 / Math.PI);
  const B = S.lectura, totM = B.porMotor.reduce((a, b) => a + b, 0) || 1, dom = B.porMotor.indexOf(Math.max(...B.porMotor));
  const modoT: [ModoTray, string][] = [['tomar', 'TOMAR Y DEJAR'], ['saludo', 'SALUDO'], ['sostener', 'SOSTENER']];
  const modoC: [ModoCtrl, string][] = [['pid', 'PID + peso'], ['par', 'PAR COMPUTADO']];
  return (
    <div className={`bv-hud ${min ? 'min' : ''}`} data-testid="brazo-hud">
      <style>{CSS_BV}</style>
      <div className="bv-cab">
        <button className="bv-tit" onClick={() => setMin((m) => !m)}>{min ? '▸' : '▾'} SIMULACIÓN EN VIVO · EL BRAZO</button>
        <span className="bv-fps">{Math.round(S.fps)} fps · t {s.t.toFixed(1)} s</span>
        <button className="bv-x" onClick={onCerrar} title="apagar la simulación">✕</button>
      </div>
      {!min && (<>
        <div className="bv-fila">
          {modoT.map(([m, et]) => <button key={m} className={p.tray.modo === m ? 'on' : ''} onClick={() => fijaTray('modo', m)} data-testid={`brazo-${m}`}>{et}</button>)}
        </div>
        <div className="bv-fila">
          {modoC.map(([m, et]) => <button key={m} className={p.ctrl.modo === m ? 'on' : ''} onClick={() => fijaCtrl('modo', m)}>{et}</button>)}
          <button onClick={() => { S.pausa = !S.pausa; toca(); }} data-testid="brazo-pausa">{S.pausa ? '▶' : '❚❚'}</button>
          <select value={Math.round(1 / S.lenta)} onChange={(e) => { S.lenta = 1 / Number(e.target.value); toca(); }} title="cámara lenta">
            {LENTAS.map((l) => <option key={l} value={l}>{l === 1 ? 'tiempo real' : `×1/${l}`}</option>)}
          </select>
        </div>
        <div className="bv-per">
          <Perilla et="carga" u="kg" v={p.carga} min={0} max={1.5} paso={0.05} on={(v) => { S.p = { ...S.p, carga: v }; toca(); }} />
          <Perilla et="t por movimiento" u="s" v={p.tray.Tmov} min={0.6} max={3} paso={0.1} on={(v) => fijaTray('Tmov', v)} />
          <Perilla et="ancho de banda" u="Hz" v={p.ctrl.wn / (2 * Math.PI)} min={0.5} max={6} paso={0.1} on={(v) => fijaCtrl('wn', 2 * Math.PI * v)} />
          <Perilla et="amortiguamiento ζ" u="" v={p.ctrl.zeta} min={0.3} max={1.5} paso={0.05} on={(v) => fijaCtrl('zeta', v)} />
          <Perilla et="integral Ki" u="×" v={p.ctrl.ki} min={0} max={2} paso={0.05} on={(v) => fijaCtrl('ki', v)} />
        </div>
        <table className="bv-tab">
          <thead><tr><th />{NOMBRE_J.map((n, j) => <th key={n} style={{ color: COL_J[j] }}>{n}</th>)}</tr></thead>
          <tbody>
            <Fila et="ángulo" v={L.qDeg.map((q) => `${q.toFixed(1)}°`)} />
            <Fila et="error" v={L.errDeg.map((q) => `${q.toFixed(2)}°`)} />
            <Fila et="ω salida" v={L.wDeg.map((q) => `${q.toFixed(0)}°/s`)} />
            <Fila et="motor" v={L.rpm.map((r) => `${r.toFixed(0)} rpm`)} />
            <Fila et="I" v={L.I.map((i) => `${i.toFixed(2)} A`)} c="#f4b942" />
            <Fila et="PWM D" v={L.D.map((d) => `${(100 * d).toFixed(0)} %`)} />
            <Fila et="V motor" v={L.V.map((v) => `${v.toFixed(1)} V`)} c="#4fd6ff" />
            <Fila et="par n·k·i" v={L.tau.map((t) => `${t.toFixed(2)} N·m`)} />
            <Fila et="G(q) peso" v={L.G.map((t) => `${t.toFixed(2)} N·m`)} />
            <Fila et="I²R" v={L.Pj.map((w) => `${w.toFixed(1)} W`)} c="#ff8a5c" />
            <Fila et="rizo PWM" v={L.rizo.map((r) => `${r.toFixed(2)} App`)} />
            <Fila et="reducción" v={der.map((d) => `${d.n}:1`)} />
            <Fila et="cicloidal" v={L.margen.map((m, j) => `×${m > 99 ? '>99' : m.toFixed(1)} de ${L.capacidad[j].toFixed(0)}`)} />
          </tbody>
        </table>
        <div className="bv-lec">
          <Lec et="cinética" v={`${L.K.toFixed(2)} J`} />
          <Lec et="potencial" v={`${L.U.toFixed(2)} J`} />
          <Lec et="½Li²" v={`${(L.Emag * 1e3).toFixed(2)} mJ`} />
          <Lec et="suministrada" v={`${L.Esup.toFixed(1)} J`} c="#f4b942" />
          <Lec et="Joule" v={`${L.Ejoule.toFixed(1)} J`} c="#ff8a5c" />
          <Lec et="fricción" v={`${L.Efric.toFixed(1)} J`} />
          <Lec et="potencia bus" v={`${L.Psup.toFixed(1)} W`} c="#f4b942" />
          <Lec et="con la carga" v={`${L.Ecarga.toFixed(2)} J`} />
          <Lec et="balance" v={`${(100 * L.residuoRel).toExponential(1)} %`} c={L.residuoRel < 0.005 ? '#8be28b' : '#ff8a80'} />
        </div>
        <div className="bv-ref">
          brazo extendido · hombro/codo: brazo.ts {ref.brazoTs[0].toFixed(2)}/{ref.brazoTs[1].toFixed(2)} N·m · RNEA tubos {ref.tubos[0].toFixed(2)}/{ref.tubos[1].toFixed(2)} · con accionamientos {ref.completo[0].toFixed(2)}/{ref.completo[1].toFixed(2)}
        </div>
        <svg className="bv-osc" viewBox={`0 0 ${W} ${H}`} width={W} height={H} data-testid="brazo-osc">
          <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="rgba(159,179,200,0.18)" />
          {[0, 1, 2].map((j) => <path key={`i${j}`} d={traza(H_.i, j, 1, iLo, iHi, 2)} fill="none" stroke={COL_J[j]} strokeWidth={1.4} />)}
          {[0, 1, 2].map((j) => <path key={`q${j}`} d={traza(H_.q, j, 180 / Math.PI, qLo, qHi, H / 2 + 2)} fill="none" stroke={COL_J[j]} strokeWidth={1.1} strokeDasharray="3 2" opacity={0.85} />)}
          <text x={4} y={11} className="bv-ot">I {iHi.toFixed(1)} A</text><text x={4} y={H / 2 - 4} className="bv-ot">{iLo.toFixed(1)} A</text>
          <text x={4} y={H / 2 + 12} className="bv-ot">θ {qHi.toFixed(0)}°</text><text x={4} y={H - 4} className="bv-ot">{qLo.toFixed(0)}°</text>
        </svg>
        <div className="bv-ley">━ corriente · ┅ ángulo · 4 s · {NOMBRE_J.map((n, j) => <span key={n} style={{ color: COL_J[j] }}> {n}</span>)}</div>
        <div className="bv-gauss" data-testid="gaussimetro">
          <div className="bv-gt">GAUSSÍMETRO <span>(arrastra la sonda cian)</span></div>
          <div className="bv-gm">{fmtB(B.mod)}</div>
          <div className="bv-gc">B = ({(B.B[0] * 1e6).toFixed(1)}, {(B.B[1] * 1e6).toFixed(1)}, {(B.B[2] * 1e6).toFixed(1)}) µT · domina el motor del {NOMBRE_J[dom]} ({((100 * B.porMotor[dom]) / totM).toFixed(0)} %)</div>
          <div className="bv-gc">sonda en ({S.sonda.map((v) => v.toFixed(0)).join(', ')}) mm · punta del brazo ({tip.map((v) => v.toFixed(0)).join(', ')}) · {s.pegada ? 'carga EN LA PINZA' : 'carga en la mesa'}</div>
        </div>
        <div className="bv-fila chica">
          {([['verB', 'campo B'], ['verFlujo', 'corriente'], ['verSonda', 'gaussímetro']] as const).map(([k, et]) => (
            <label key={k}><input type="checkbox" checked={S[k]} onChange={(e) => { S[k] = e.target.checked; toca(); }} /> {et}</label>
          ))}
          <button onClick={reinicia}>reiniciar</button>
        </div>
        <button className="bv-q" onClick={() => setNota((n) => !n)}>{nota ? '▾' : '▸'} ¿qué estoy viendo? · supuestos</button>
        {nota && <div className="bv-nota">
          <b style={{ color: '#7fb4ff' }}>azul = campo B CALCULADO</b> (Biot-Savart de los conductores de cada motor: el inducido — que el
          conmutador mantiene fijo en el espacio, su FMM apunta al eje de escobillas — y el par de cables; color = |B| real, el pulso
          corre en el sentido de B y respira con la corriente VIVA de su motor) · <b style={{ color: '#f4b942' }}>puntos dorados</b> =
          sentido convencional de I (rapidez simbólica) · la lata brilla ∝ I²R (no es temperatura) · gaussímetro = suma de TODAS
          las fuentes vivas en la punta de la sonda.
          <div style={{ marginTop: 4 }}>
            Física: RNEA (Newton-Euler recursivo) con los tubos de brazo.ts + accionamientos; RK4 del estado completo a {Math.round(1 / p.dt / 1000)} kHz;
            L·di/dt = D·V_bus − R·i − k_e·ω; control posición {p.fCtl} Hz → corriente → PWM. Reducción = planetaria 5:1 × cicloidal (config B:
            pernos = lóbulos + 1 = {der[0].cic.rel}). Energía: lo suministrado = ΔE + Joule + fricción (balance arriba).
          </div>
          <div style={{ marginTop: 4, color: '#9fb4c8' }}>
            SUPUESTOS: motores ⌀30/⌀40 de 24 V del orden de catálogo (no números de parte) · planetaria η 0.90 · cicloidal η 0.85 · fricciones
            de junta · V_bus 24 V · PWM 20 kHz (modelo promedio; el rizo es estimado) · reductor rígido sin juego · sin hierro ni imán en el
            campo (afuera del motor está sobreestimado: la carcasa de acero lo blinda) · la carga, masa puntual en la punta · sin choques.
          </div>
          <div style={{ marginTop: 4, color: '#9fb4c8' }}>{S.infoB}</div>
          {s.eventos.length > 0 && <div style={{ marginTop: 4, color: '#8193a8' }}>{s.eventos.slice(-3).join(' · ')}</div>}
        </div>}
      </>)}
    </div>
  );
}
function Perilla({ et, u, v, min, max, paso, on }: { et: string; u: string; v: number; min: number; max: number; paso: number; on: (v: number) => void }) {
  return (
    <label className="bv-perilla">
      <span>{et}</span>
      <input type="range" min={min} max={max} step={paso} value={v} onChange={(e) => on(Number(e.target.value))} />
      <b>{v.toFixed(paso < 0.1 ? 2 : paso < 1 ? 1 : 0)} {u}</b>
    </label>
  );
}
function Fila({ et, v, c }: { et: string; v: string[]; c?: string }) {
  return <tr><td>{et}</td>{v.map((x, j) => <td key={j} style={c ? { color: c } : undefined}>{x}</td>)}</tr>;
}
function Lec({ et, v, c }: { et: string; v: string; c?: string }) {
  return <div className="bv-l"><span>{et}</span><b style={c ? { color: c } : undefined}>{v}</b></div>;
}
const CSS_BV = `
.bv-hud{position:absolute;right:12px;bottom:44px;z-index:7;width:372px;max-height:calc(100% - 60px);overflow:auto;
  background:rgba(6,10,16,0.88);border:1px solid rgba(159,179,200,0.2);border-radius:10px;padding:8px 10px 9px;
  font:11px/1.35 'JetBrains Mono',ui-monospace,monospace;color:#cfd8e3;box-shadow:0 10px 30px rgba(0,0,0,0.45);}
.bv-hud.min{width:auto;}
.bv-cab{display:flex;align-items:center;gap:8px;}
.bv-tit{all:unset;cursor:pointer;color:#f4b942;font-weight:700;letter-spacing:.06em;font-size:10.5px;flex:1;}
.bv-fps{color:#6f8196;font-size:10px;}
.bv-x{all:unset;cursor:pointer;color:#8193a8;padding:0 3px;}
.bv-fila{display:flex;gap:5px;margin-top:7px;align-items:center;flex-wrap:wrap;}
.bv-fila button,.bv-fila select{all:unset;cursor:pointer;padding:4px 7px;border-radius:5px;border:1px solid rgba(159,179,200,0.22);color:#cfd8e3;font-size:10.5px;}
.bv-fila button.on{background:rgba(244,185,66,0.16);border-color:#f4b942;color:#f4d27a;}
.bv-fila.chica{font-size:10.5px;gap:10px;}
.bv-fila.chica input{accent-color:#f4b942;vertical-align:-2px;}
.bv-per{display:grid;grid-template-columns:1fr;gap:2px;margin-top:7px;}
.bv-perilla{display:grid;grid-template-columns:112px 1fr 70px;align-items:center;gap:6px;color:#8fa1b5;}
.bv-perilla input{accent-color:#f4b942;width:100%;}
.bv-perilla b{color:#e3e9f0;font-weight:600;text-align:right;}
.bv-tab{width:100%;border-collapse:collapse;margin-top:8px;font-size:10.5px;}
.bv-tab th{font-weight:700;text-align:right;padding:1px 3px;font-size:10px;letter-spacing:.04em;}
.bv-tab td{text-align:right;padding:1px 3px;color:#e3e9f0;white-space:nowrap;}
.bv-tab td:first-child{text-align:left;color:#6f8196;}
.bv-lec{display:grid;grid-template-columns:repeat(3,1fr);gap:3px 8px;margin-top:8px;}
.bv-l{display:flex;flex-direction:column;}
.bv-l span{color:#6f8196;font-size:9.5px;}
.bv-l b{color:#e3e9f0;font-size:12px;font-weight:600;}
.bv-ref{margin-top:6px;font-size:9.5px;color:#8fa1b5;}
.bv-osc{display:block;margin-top:8px;background:rgba(0,0,0,0.35);border-radius:5px;border:1px solid rgba(159,179,200,0.12);width:100%;height:auto;}
.bv-ot{fill:#6f8196;font-size:8.5px;font-family:inherit;}
.bv-ley{margin-top:3px;font-size:9.5px;color:#8193a8;}
.bv-gauss{margin-top:8px;padding:6px 8px;border-radius:6px;border:1px solid rgba(79,214,255,0.35);background:rgba(79,214,255,0.06);}
.bv-gt{color:#4fd6ff;font-weight:700;font-size:10px;letter-spacing:.06em;}
.bv-gt span{color:#6f8196;font-weight:400;letter-spacing:0;}
.bv-gm{color:#e8f9ff;font-size:18px;font-weight:700;margin:2px 0;}
.bv-gc{color:#9fb4c8;font-size:9.5px;}
.bv-q{all:unset;cursor:pointer;display:block;margin-top:6px;color:#8fa1b5;font-size:10px;}
.bv-nota{margin-top:5px;padding-top:6px;border-top:1px solid rgba(159,179,200,0.14);font-size:9.5px;color:#7d8fa3;}
.bv-etq{white-space:nowrap;font:600 11px 'JetBrains Mono',ui-monospace,monospace;color:#bff1ff;letter-spacing:.04em;
  background:rgba(6,10,16,0.78);padding:2px 7px;border-radius:4px;border:1px solid rgba(79,214,255,0.5);}
@media (max-width:760px){.bv-hud{left:8px;right:8px;width:auto;bottom:40px;max-height:46%;}}
`;
