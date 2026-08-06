/**
 * EL CORTE VIVO — el plano de sección que se MUEVE, en 3D, dentro del Estudio.
 * ============================================================================
 * "Esas vistas no me sirven de nada si no es en 3D e integrada a La Forja."
 *
 * Las láminas de sección (L5/L7/L9) son imágenes planas: hay que decidir DÓNDE
 * cortar antes de dibujarlas y, si el corte no cayó donde estaba el problema, se
 * vuelve a generar la lámina. Aquí el plano es un control: se arrastra y el
 * molde se abre en vivo.
 *
 * CÓMO SE VE EL INTERIOR (dos mecanismos, uno para el ojo y otro para el dato):
 *
 *  1. `clippingPlanes` de three.js sobre los materiales de la PIEL. Es
 *     instantáneo (no recalcula geometría): el plano se muta en `useFrame` y la
 *     mitad que estorba desaparece. Además se AUTO-VOLTEA: la mitad que se quita
 *     es siempre la del lado de la cámara, así que orbitar nunca deja el corte
 *     mirando para afuera.
 *  2. La CARA DEL CORTE se rellena con geometría REAL: `seccionarPorPlano` da
 *     los lazos del corte y `tapaDeLazos` los triangula (contornos + huecos).
 *     Sin tapa, un sólido recortado se ve HUECO y parece un error.
 *
 *     Por qué no esténcil (que es lo que hace `sim/MoldSectionReveal.tsx`): el
 *     Canvas del Estudio se crea con `gl={{ antialias:true, alpha:false }}` —
 *     SIN buffer de esténcil— y esta vista no puede tocar ese Canvas. La tapa
 *     geométrica además sale COLOREADA POR COMPONENTE, que es exactamente lo que
 *     el achurado de Fig 1.6 hace en la lámina: el corte se lee, no solo se ve.
 *
 * LAS COTAS son las del libro y NO se reimplementan: `medirSeccion` (§4.2.1
 * altura de inserto, §4.2.2/§12.2.4 mejilla, §9.2.5 profundidad del agua en ⌀,
 * §12.3.2 cabeza del tornillo) mide sobre la sección del plano ACTUAL. Si el
 * plano no corta lo que hace falta, la cota no sale y el veredicto queda SIN
 * CABLEAR — gris con su razón, nunca verde por omisión.
 *
 * TEXTOS: sprites con textura de canvas. NADA de `<Text>` de drei (regla dura de
 * la casa) y nada de DOM: este componente devuelve un `<group>` y se monta dentro
 * del Canvas que ya existe.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';

import type { Caja, MallaSimple } from './estudio-vivo-datos';
import type { MallaSec } from './lamina-seccion';
import {
  construirMundo, cortar, corteEn, uv3d, xyz2uv, sondaDelCorte, lecturaDeSonda,
  COLOR_ROL, COLOR_ESTADO, ORDEN_TAPA, LAMINAS_CUBIERTAS,
  type CorteVivo, type Eje, type MundoCorte, type Lectura,
} from './vista3d-corte-datos';

export const META = {
  id: 'corte',
  nombre: 'EL CORTE',
  icono: '⧅',
  seccion: '§1.3.2 Fig 1.6 · L5·L7·L9·L18·L19',
  control: { etiqueta: 'posición del corte', min: 0, max: 1, paso: 0.005, inicial: 0.5 },
  eje: true,
} as const;

export interface PropsVista3D {
  malla: MallaSimple;
  caja: Caja;
  spec: any | null;
  /** 0..1 — la posición del corte a lo largo del eje */
  t: number;
  eje?: Eje;
  onLectura?: (l: Lectura) => void;
}

const IDX: Record<Eje, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
const EPS_TAPA = 0.05;          // mm que la tapa se separa del plano (anti z-fighting)
const FUENTE = "700 34px 'JetBrains Mono', ui-monospace, monospace";

/* ── geometría ─────────────────────────────────────────────────────────── */

function geoDeMalla(m: MallaSec): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const P = m.positions instanceof Float32Array ? m.positions : new Float32Array(m.positions as ArrayLike<number>);
  const I = m.indices instanceof Uint32Array ? m.indices : new Uint32Array(m.indices as ArrayLike<number>);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1));
  g.computeVertexNormals();
  return g;
}

function geoIndexada(positions: Float32Array, indices: Uint32Array): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  return g;
}

function geoDePuntos(pts: Float32Array): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  return g;
}

/* ── etiquetas (sprite con textura de canvas — nunca drei/Text) ─────────── */

interface Etiqueta { tex: THREE.CanvasTexture; aspecto: number }

function hazEtiqueta(texto: string, color: string): Etiqueta {
  const cv = document.createElement('canvas');
  const med = cv.getContext('2d')!;
  med.font = FUENTE;
  const w = Math.ceil(med.measureText(texto).width) + 26;
  const h = 52;
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  c.font = FUENTE;
  c.fillStyle = 'rgba(6,10,16,0.86)';
  c.strokeStyle = color; c.lineWidth = 2;
  const r = 10;
  c.beginPath();
  c.moveTo(r, 1); c.lineTo(w - r, 1); c.quadraticCurveTo(w - 1, 1, w - 1, r);
  c.lineTo(w - 1, h - r); c.quadraticCurveTo(w - 1, h - 1, w - r, h - 1);
  c.lineTo(r, h - 1); c.quadraticCurveTo(1, h - 1, 1, h - r);
  c.lineTo(1, r); c.quadraticCurveTo(1, 1, r, 1);
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = color; c.textBaseline = 'middle';
  c.fillText(texto, 13, h / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return { tex, aspecto: w / h };
}

/* ── las cotas, colocadas sobre el plano del corte ──────────────────────── */

/** `alto` va en FRACCIÓN DE PANTALLA, no en mm: un rótulo en unidades de mundo
 *  crece al acercarse (en la primera captura, "H_line 12.3" tapaba media vista al
 *  encuadrar la pieza). Con `sizeAttenuation:false` el texto se lee igual de
 *  lejos que de cerca, que es lo que hace una cota en un plano. */
interface Rotulo {
  pos: [number, number, number]; texto: string; color: string; alto: number;
  /** ancla del sprite (0 = el texto crece hacia la derecha/arriba desde el punto,
   *  1 = hacia la izquierda/abajo, 0.5 = centrado). Con el ancla al borde, el
   *  rótulo NUNCA se acuesta encima de la línea de cota que rotula. */
  ancla: [number, number];
}

const ALTO_COTA = 0.030;      // ≈ 4.4 % del alto del cuadro con fov 38°
const ALTO_PIEZA = 0.025;

/**
 * Las cotas de `medirSeccion` vienen en (u,v) del plano. Aquí se colocan igual
 * que en la lámina: línea de cota corrida hacia `lado`, líneas de extensión al
 * componente y el rótulo al aire. Las que compartirían carril se corren más
 * afuera — una cota que no se lee no cota.
 */
function armarCotas(corte: CorteVivo, span: number): { seg: Float32Array; rot: Rotulo[] } {
  const seg: number[] = [];
  const rot: Rotulo[] = [];
  const med = corte.med.medidas;
  if (!med || !corte.sec.bbox) return { seg: new Float32Array(0), rot };
  const off = Math.max(2, span * 0.05);
  const tick = span * 0.008;
  const pl = corte.sec.plano;
  const push = (u0: number, v0: number, u1: number, v1: number) => {
    const A = uv3d(pl, u0, v0), B = uv3d(pl, u1, v1);
    seg.push(A[0], A[1], A[2], B[0], B[1], B[2]);
  };
  const carriles = new Map<string, number>();
  for (const co of med.cotas) {
    const clave = `${co.tipo}${co.lado}`;
    const j = carriles.get(clave) ?? 0;
    carriles.set(clave, j + 1);
    const d = off * (1 + 0.9 * j);
    const col = COLOR_ESTADO[co.estado];
    if (co.tipo === 'v') {
      const uL = co.en + co.lado * d;
      push(uL, co.a, uL, co.b);
      push(co.en, co.a, uL + co.lado * off * 0.22, co.a);
      push(co.en, co.b, uL + co.lado * off * 0.22, co.b);
      push(uL - tick, co.a + tick, uL + tick, co.a - tick);
      push(uL - tick, co.b + tick, uL + tick, co.b - tick);
      const P = uv3d(pl, uL + co.lado * off * 0.14, (co.a + co.b) / 2);
      rot.push({ pos: [P[0], P[1], P[2]], texto: co.texto, color: col, alto: ALTO_COTA, ancla: [co.lado > 0 ? 0 : 1, 0.5] });
    } else {
      const vL = co.en + co.lado * d;
      push(co.a, vL, co.b, vL);
      push(co.a, co.en, co.a, vL + co.lado * off * 0.22);
      push(co.b, co.en, co.b, vL + co.lado * off * 0.22);
      push(co.a - tick, vL - tick, co.a + tick, vL + tick);
      push(co.b - tick, vL - tick, co.b + tick, vL + tick);
      const P = uv3d(pl, (co.a + co.b) / 2, vL + co.lado * off * 0.14);
      rot.push({ pos: [P[0], P[1], P[2]], texto: co.texto, color: col, alto: ALTO_COTA, ancla: [0.5, co.lado > 0 ? 0 : 1] });
    }
  }
  return { seg: new Float32Array(seg), rot };
}

/** rótulo de los componentes principales que el corte atraviesa */
function armarRotulosPiezas(corte: CorteVivo, span: number): Rotulo[] {
  const out: Rotulo[] = [];
  if (!corte.sec.bbox) return out;
  const pl = corte.sec.plano;
  const puestos: Array<[number, number]> = [];
  const CORTO: Record<string, string> = {
    moldeo: 'PIEZA', 'i-cav': 'INSERTO A', 'i-core': 'NÚCLEO B', agua: 'AGUA',
    colada: 'BEBEDERO', 'p-A': 'PLACA A', 'p-B': 'PLACA B', pines: 'EXPULSOR',
  };
  const dMin = span * 0.13;
  for (const p of corte.sec.piezas) {
    if (p.vacio || !CORTO[p.id] || !p.lazos.length) continue;
    const L = p.lazos.reduce((a, b) => (Math.abs(b.areaMm2) > Math.abs(a.areaMm2) ? b : a), p.lazos[0]);
    if (!L || Math.abs(L.areaMm2) < span * span * 0.0007) continue;
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (const q of L.pts) { u0 = Math.min(u0, q[0]); v0 = Math.min(v0, q[1]); u1 = Math.max(u1, q[0]); v1 = Math.max(v1, q[1]); }
    const u = (u0 + u1) / 2, v = (v0 + v1) / 2;
    if (puestos.some((q) => Math.hypot(q[0] - u, q[1] - v) < dMin)) continue;
    puestos.push([u, v]);
    const P = uv3d(pl, u, v);
    out.push({ pos: [P[0], P[1], P[2]], texto: CORTO[p.id], color: COLOR_ROL[p.rol].linea, alto: ALTO_PIEZA, ancla: [0.5, 0.5] });
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LA VISTA                                                                   */
/* ══════════════════════════════════════════════════════════════════════════ */

export default function VistaCorte(props: PropsVista3D) {
  const { malla, caja, spec, onLectura } = props;
  const { gl } = useThree();
  const eje: Eje = props.eje ?? 'x';
  const k = IDX[eje];

  // el recorte por material EXIGE esto (si no, `clippingPlanes` no hace nada)
  useEffect(() => {
    const antes = gl.localClippingEnabled;
    gl.localClippingEnabled = true;
    return () => { gl.localClippingEnabled = antes; };
  }, [gl]);

  /* ── EL MOLDE: una sola vez (mover el corte NO lo reconstruye) ── */
  const cajaK = `${caja.x0},${caja.y0},${caja.z0},${caja.x1},${caja.y1},${caja.z1}`;
  const mundo = useMemo<{ m: MundoCorte | null; err: string | null }>(() => {
    try { return { m: construirMundo(spec, caja, malla), err: null }; }
    catch (e) { return { m: null, err: String(e).slice(0, 240) }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, malla, cajaK]);

  /* ── EL CORTE: diferido + cacheado. El plano de recorte se mueve en el MISMO
       frame (useFrame lee el t vivo por ref); la tapa la recalcula React en
       cuanto puede. Así arrastrar el slider nunca se traba. ── */
  const tVivo = Math.max(0, Math.min(1, props.t));
  const tVivoRef = useRef(tVivo);
  tVivoRef.current = tVivo;
  const tDif = useDeferredValue(tVivo);
  const tq = Math.round(tDif / META.control.paso) * META.control.paso;
  const cacheRef = useRef<Map<string, CorteVivo>>(new Map());
  useEffect(() => { cacheRef.current.clear(); }, [mundo]);

  const corte = useMemo<CorteVivo | null>(() => {
    if (!mundo.m) return null;
    const clave = `${eje}|${tq.toFixed(4)}`;
    const hit = cacheRef.current.get(clave);
    if (hit) return hit;
    const c = cortar(mundo.m, eje, tq);
    cacheRef.current.set(clave, c);
    if (cacheRef.current.size > 40) cacheRef.current.delete(cacheRef.current.keys().next().value as string);
    return c;
  }, [mundo, eje, tq]);

  /* ── geometrías ── */
  const piel = useMemo(() => (mundo.m ? mundo.m.solidos.map((s) => ({ s, geo: geoDeMalla(s.malla) })) : []), [mundo]);
  useEffect(() => () => { piel.forEach((x) => x.geo.dispose()); }, [piel]);

  const tapas = useMemo(() => (corte
    ? corte.tapas.map((t) => ({
      pieza: t.pieza,
      geo: geoIndexada(t.geom.positions, t.geom.indices),
      bordes: t.geom.bordes.length ? geoDePuntos(t.geom.bordes) : null,
    }))
    : []), [corte]);
  useEffect(() => () => { tapas.forEach((t) => { t.geo.dispose(); t.bordes?.dispose(); }); }, [tapas]);

  const span = useMemo(() => {
    const b = corte?.sec.bbox;
    return b ? (Math.max(b.u1 - b.u0, b.v1 - b.v0) || 100) : 100;
  }, [corte]);

  const cotas = useMemo(() => (corte ? armarCotas(corte, span) : { seg: new Float32Array(0), rot: [] as Rotulo[] }), [corte, span]);
  const geoCotas = useMemo(() => (cotas.seg.length ? geoDePuntos(cotas.seg) : null), [cotas]);
  useEffect(() => () => geoCotas?.dispose(), [geoCotas]);

  const rotulosPieza = useMemo(() => (corte ? armarRotulosPiezas(corte, span) : []), [corte, span]);

  /* ── el cuadro del plano: invisible, pero clicable (el "aire" también se
       reporta: un clic que no devuelve nada parece una vista rota) ── */
  const geoCuadro = useMemo(() => {
    const b = corte?.sec.bbox;
    if (!b || !corte) return null;
    const pl = corte.sec.plano, m = span * 0.06;
    const q = [
      uv3d(pl, b.u0 - m, b.v0 - m), uv3d(pl, b.u1 + m, b.v0 - m),
      uv3d(pl, b.u1 + m, b.v1 + m), uv3d(pl, b.u0 - m, b.v1 + m),
    ];
    return geoIndexada(new Float32Array([...q[0], ...q[1], ...q[2], ...q[3]]), new Uint32Array([0, 1, 2, 0, 2, 3]));
  }, [corte, span]);
  useEffect(() => () => geoCuadro?.dispose(), [geoCuadro]);

  /* ── etiquetas: se cachean por texto+color y se liberan al desmontar ── */
  const etiquetasRef = useRef<Map<string, Etiqueta>>(new Map());
  const etiqueta = useCallback((texto: string, color: string): Etiqueta => {
    const clave = `${texto}|${color}`;
    let e = etiquetasRef.current.get(clave);
    if (!e) { e = hazEtiqueta(texto, color); etiquetasRef.current.set(clave, e); }
    return e;
  }, []);
  useEffect(() => {
    const mapa = etiquetasRef.current;
    return () => { mapa.forEach((e) => e.tex.dispose()); mapa.clear(); };
  }, []);

  /* ── materiales (uno por rol; el plano se MUTA, nunca se recrea) ── */
  const plano = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e9), []);
  const matPiel = useMemo(() => {
    const m: Record<string, THREE.MeshStandardMaterial> = {};
    for (const [rol, c] of Object.entries(COLOR_ROL)) {
      const metal = rol === 'placa' || rol === 'inserto' || rol === 'componente';
      m[rol] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(c.piel),
        emissive: new THREE.Color(c.piel), emissiveIntensity: 0.18,
        metalness: metal ? 0.6 : 0.15,
        roughness: rol === 'agua' ? 0.25 : 0.55,
        side: THREE.DoubleSide,
        clippingPlanes: [plano],
        clipShadows: true,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
    }
    return m;
  }, [plano]);
  // las tapas son COPLANARES (el barreno no se resta de la placa: el componente
  // se dibuja encima) ⇒ sin desempate de profundidad el z-buffer las alterna por
  // pixel y el pin sale MOTEADO. `polygonOffset` por orden de rol lo resuelve.
  const matTapa = useMemo(() => {
    const m: Record<string, THREE.MeshBasicMaterial> = {};
    for (const [rol, c] of Object.entries(COLOR_ROL)) {
      const o = ORDEN_TAPA[rol as keyof typeof ORDEN_TAPA] / 10;
      m[rol] = new THREE.MeshBasicMaterial({
        color: new THREE.Color(c.corte), side: THREE.DoubleSide, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -o, polygonOffsetUnits: -o * 4,
      });
    }
    return m;
  }, []);
  const matBorde = useMemo(() => {
    const m: Record<string, THREE.LineBasicMaterial> = {};
    for (const [rol, c] of Object.entries(COLOR_ROL)) {
      m[rol] = new THREE.LineBasicMaterial({
        color: new THREE.Color(c.linea), transparent: true, opacity: 0.95, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -36,
      });
    }
    return m;
  }, []);
  const matCuadro = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), []);
  const matCota = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color('#e9eef5'), transparent: true, opacity: 0.92, toneMapped: false, depthTest: false }), []);
  const matParticion = useMemo(() => new THREE.LineDashedMaterial({ color: new THREE.Color('#c9a227'), dashSize: 5, gapSize: 3.2, transparent: true, opacity: 0.95, toneMapped: false, depthTest: false }), []);
  useEffect(() => () => {
    Object.values(matPiel).forEach((x) => x.dispose());
    Object.values(matTapa).forEach((x) => x.dispose());
    Object.values(matBorde).forEach((x) => x.dispose());
    matCuadro.dispose(); matCota.dispose(); matParticion.dispose();
  }, [matPiel, matTapa, matBorde, matCuadro, matCota, matParticion]);

  /* ── línea de PARTICIÓN A|B (§1.3.2: el molde ABRE aquí) ── */
  const objParticion = useMemo(() => {
    if (!corte || !mundo.m || eje === 'z' || !corte.sec.bbox) return null;
    const b = corte.sec.bbox, z = mundo.m.meta.zPart, pl = corte.sec.plano;
    const A = uv3d(pl, b.u0 - span * 0.05, z), B = uv3d(pl, b.u1 + span * 0.05, z);
    const g = geoDePuntos(new Float32Array([A[0], A[1], A[2], B[0], B[1], B[2]]));
    const l = new THREE.Line(g, matParticion);
    l.computeLineDistances();
    l.renderOrder = 7;
    return l;
  }, [corte, mundo, eje, span, matParticion]);
  useEffect(() => () => objParticion?.geometry.dispose(), [objParticion]);

  /* ── el plano VIVO: se muta cada frame y se AUTO-VOLTEA hacia la cámara ── */
  const grupoTapa = useRef<THREE.Group>(null);
  const grupoRot = useRef<THREE.Group>(null);
  const ladoRef = useRef(1);
  const vTmp = useMemo(() => new THREE.Vector3(), []);
  const desfase: [number, number, number] = mundo.m ? mundo.m.desfase : [0, 0, 0];
  useFrame(({ camera }) => {
    if (!mundo.m) return;
    const cMolde = corteEn(mundo.m, eje, tVivoRef.current);
    const cMundo = cMolde + desfase[k];
    // histéresis: con la cámara casi EN el plano, voltear cada frame parpadearía
    const dCam = camera.position.getComponent(k) - cMundo;
    if (Math.abs(dCam) > span * 0.05) ladoRef.current = dCam >= 0 ? 1 : -1;
    const lado = ladoRef.current;
    plano.normal.set(k === 0 ? -lado : 0, k === 1 ? -lado : 0, k === 2 ? -lado : 0);
    plano.constant = lado * cMundo;
    if (grupoTapa.current) {
      // la tapa vive en el plano del ÚLTIMO corte calculado; mientras React
      // alcanza el t vivo se corre, para que no quede flotando a media pieza
      const cTapa = corte ? corte.c : cMolde;
      grupoTapa.current.position.setComponent(k, (cMolde - cTapa) + lado * EPS_TAPA);
    }

    // ── RÓTULOS: se proyectan a pantalla y se APAGAN los que se encimarían.
    //    Las cotas van primero en la lista, así que ganan el lugar; los nombres
    //    de componente ceden. Una cota encimada no cota (y en la lámina el
    //    mismo problema se resuelve corriendo la línea de cota hacia afuera).
    const g = grupoRot.current;
    if (g) {
      const cam = camera as THREE.PerspectiveCamera;
      const tanF = Math.tan(THREE.MathUtils.degToRad(cam.fov ?? 50) / 2) || 0.35;
      const asp = cam.aspect || 1;
      const puestos: Array<[number, number, number, number]> = [];
      for (const hijo of g.children) {
        const sp = hijo as THREE.Sprite;
        sp.getWorldPosition(vTmp);
        vTmp.project(camera);
        if (vTmp.z > 1 || Math.abs(vTmp.x) > 1.25 || Math.abs(vTmp.y) > 1.25) { sp.visible = false; continue; }
        const h = sp.scale.y / tanF, w = sp.scale.x / (tanF * asp);
        const cxs = sp.center.x, cys = sp.center.y;
        const r: [number, number, number, number] = [
          vTmp.x - w * cxs, vTmp.y - h * cys, vTmp.x + w * (1 - cxs), vTmp.y + h * (1 - cys),
        ];
        const choca = puestos.some((q) => !(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3]));
        sp.visible = !choca;
        if (!choca) puestos.push(r);
      }
    }
  });

  /* ── SONDA: clic sobre la cara del corte.
       El clic se distingue del ARRASTRE DE ÓRBITA midiendo el desplazamiento
       entre pointerdown y pointerup (mismo criterio, 4 px, que ya usa la sonda
       de la pieza en EstudioVivo). Sin esto, cada giro de cámara dejaba una
       lectura falsa: se vio en la primera corrida del arnés ("aire" reportado
       al soltar la órbita). ── */
  const lecturaRef = useRef<Lectura | null>(null);
  const abajo = useRef<{ x: number; y: number } | null>(null);
  const trazaRef = useRef({ downs: 0, ups: 0, sondas: 0, rechazos: 0, ultDown: [0, 0], ultUp: [0, 0] });
  const alApretar = useCallback((e: ThreeEvent<PointerEvent>) => {
    abajo.current = { x: e.clientX, y: e.clientY };
    trazaRef.current.downs++; trazaRef.current.ultDown = [e.clientX, e.clientY];
  }, []);
  const sondear = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!mundo.m || !corte) return;
    const a = abajo.current;
    trazaRef.current.ups++; trazaRef.current.ultUp = [e.clientX, e.clientY];
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) { trazaRef.current.rechazos++; return; }   // fue un arrastre
    trazaRef.current.sondas++;
    e.stopPropagation();
    const w = e.point;
    const local: [number, number, number] = [w.x - desfase[0], w.y - desfase[1], w.z - desfase[2]];
    const [u, v] = xyz2uv(corte.sec.plano, local);
    const pieza = sondaDelCorte(corte.sec, u, v);
    const l: Lectura = pieza
      ? lecturaDeSonda(pieza, corte.med.medidas, mundo.m, corte.med.razon)
      : {
        titulo: 'aire (el corte no toca material aquí)',
        valor: `u ${u.toFixed(1)} · v ${v.toFixed(1)} mm`,
        nota: 'el plano pasa por un hueco del ensamble: no hay componente que reportar. No es un defecto de la vista, es lo que hay en ese punto del molde.',
        seccion: '§1.3.2 · Fig 1.6',
      };
    lecturaRef.current = l;
    // el arnés lee la lectura del objeto de telemetría: si esperara al próximo
    // efecto, el clic ya habría pasado y el gate vería `lectura: null` con la
    // pantalla mostrando el dato — el clásico "el número existe pero no llegó".
    const tel = (window as any).__vista3dCorte;
    if (tel) { tel.lectura = l; tel.uv = [+u.toFixed(2), +v.toFixed(2)]; }
    onLectura?.(l);
  }, [mundo, corte, desfase, onLectura]);

  /* ── API del arnés (el gate lee números, no píxeles) ── */
  useEffect(() => {
    (window as any).__vista3dCorte = {
      listo: !!corte,
      error: mundo.err,
      eje, t: tVivo, tCalculado: corte ? corte.t : null,
      desfasado: corte ? Math.abs(corte.t - tVivo) > 1e-6 : null,
      cMm: corte ? +corte.c.toFixed(2) : null,
      rango: mundo.m ? mundo.m.rangos[eje] : null,
      // la caja del ENSAMBLE ya en coordenadas de la escena (con el desfase que
      // pone el molde encima de la pieza): sirve para encuadrar sin adivinar
      cajaMolde: mundo.m ? {
        x0: mundo.m.rangos.x.min + desfase[0], x1: mundo.m.rangos.x.max + desfase[0],
        y0: mundo.m.rangos.y.min + desfase[1], y1: mundo.m.rangos.y.max + desfase[1],
        z0: mundo.m.rangos.z.min + desfase[2], z1: mundo.m.rangos.z.max + desfase[2],
      } : null,
      tSprue: mundo.m ? mundo.m.tSprue : null,
      origen: mundo.m ? mundo.m.origen : null,
      supuesto: mundo.m ? mundo.m.supuesto : null,
      nTriMolde: mundo.m ? mundo.m.nTriMolde : null,
      nTriMoldeo: mundo.m ? mundo.m.nTriMoldeo : null,
      zPartMm: mundo.m ? +mundo.m.meta.zPart.toFixed(2) : null,
      // el molde que se está cortando, en números (para el arnés y para quien
      // integre: si la sección sale vacía, aquí se ve POR QUÉ)
      molde: mundo.m ? {
        nCav: mundo.m.asm.nCav ?? 1, W: mundo.m.meta.W, D: mundo.m.meta.D,
        fx: mundo.m.meta.fx, fy: mundo.m.meta.fy, ifx: mundo.m.meta.ifx, ify: mundo.m.meta.ify,
        Hc: mundo.m.meta.Hc, Hk: mundo.m.meta.Hk, round: mundo.m.meta.round,
        xSprue: mundo.m.meta.xSprue, ySprue: mundo.m.meta.ySprue, ejeSprue: mundo.m.meta.eje,
        nCavCortadasEnElSprue: mundo.m.meta.nCavCortadas,
      } : null,
      desfase,
      ms: corte ? corte.ms : null,
      cortadas: corte ? corte.cortadas : null,
      areaMm2: corte ? +corte.areaMm2.toFixed(1) : null,
      tapasFallidas: corte ? corte.falladas : null,
      lazosAbiertos: corte ? corte.abiertas : null,
      carasTangentes: corte ? corte.coplanares : null,
      corrimientoMm: corte ? corte.corrimientoMm : null,
      aviso: mundo.m ? mundo.m.aviso : null,
      tImpresiones: mundo.m ? mundo.m.tImpresiones : null,
      tapas: corte ? corte.tapas.map((t) => ({
        id: t.pieza.id, nombre: t.pieza.nombre, rol: t.pieza.rol,
        areaMm2: +Math.abs(t.pieza.areaMm2).toFixed(1),
        tris: t.geom.indices.length / 3,
      })) : [],
      cotas: corte?.med.medidas ? corte.med.medidas.cotas.map((c) => ({ id: c.id, texto: c.texto, estado: c.estado })) : [],
      veredictos: corte?.med.medidas ? corte.med.medidas.veredictos.map((v) => ({ id: v.id, estado: v.estado, medido: v.medido ?? null, limite: v.limite ?? null, porque: v.porque })) : [],
      datos: corte?.med.medidas ? corte.med.medidas.datos : null,
      razonSinCotas: corte ? corte.med.razon : null,
      rotulos: [...cotas.rot.map((r) => r.texto), ...rotulosPieza.map((r) => r.texto)],
      lectura: lecturaRef.current,
      traza: trazaRef.current,
      laminas: LAMINAS_CUBIERTAS,
    };
  }, [corte, mundo, eje, tVivo, desfase, cotas, rotulosPieza]);

  if (!mundo.m || !corte) return <group />;

  return (
    <group position={desfase}>
      {/* PIEL: el molde entero, recortado por el plano vivo */}
      {piel.map(({ s, geo }) => (
        <mesh key={s.id} geometry={geo} material={matPiel[s.rol]} renderOrder={1} />
      ))}

      {/* CARA DEL CORTE: geometría real de la sección → acero MACIZO, no hueco */}
      <group ref={grupoTapa}>
        {geoCuadro && <mesh geometry={geoCuadro} material={matCuadro} renderOrder={0} onPointerDown={alApretar} onPointerUp={sondear} />}

        {tapas.map((t) => (
          <mesh key={`tapa-${t.pieza.id}`} geometry={t.geo} material={matTapa[t.pieza.rol]} renderOrder={4} onPointerDown={alApretar} onPointerUp={sondear} />
        ))}
        {tapas.map((t) => (t.bordes
          ? <lineSegments key={`bor-${t.pieza.id}`} geometry={t.bordes} material={matBorde[t.pieza.rol]} renderOrder={6} />
          : null))}

        {objParticion && <primitive object={objParticion} />}
        {geoCotas && <lineSegments geometry={geoCotas} material={matCota} renderOrder={8} />}

        {/* los rótulos van en su propio grupo: `useFrame` los proyecta a pantalla
            y APAGA los que se encimarían (una cota encimada no cota) */}
        <group ref={grupoRot}>
          {[...cotas.rot, ...rotulosPieza].map((r, i) => {
            const e = etiqueta(r.texto, r.color);
            return (
              <sprite key={`rot-${i}-${r.texto}`} position={r.pos} center={r.ancla} scale={[r.alto * e.aspecto, r.alto, 1]} renderOrder={9}>
                <spriteMaterial map={e.tex} transparent depthTest={false} toneMapped={false} sizeAttenuation={false} />
              </sprite>
            );
          })}
        </group>
      </group>
    </group>
  );
}
