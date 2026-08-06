/**
 * LA PIEZA SE DEFORMA — la vista 3D del alabeo (§10.3.1 · L17).
 * ============================================================================
 * La lámina L17 muestra dos paneles planos de un fenómeno TRIDIMENSIONAL. Aquí
 * la pieza REAL se dobla en el espacio con el campo de `warpage.ts`, y al lado
 * queda el CAMPO QUE LA CAUSA: el ΔT núcleo↔cavidad que curva (Fig 10.14) o el
 * gradiente de contracción centro↔borde que pandea (Fig 10.15).
 *
 * Lo que esta vista se obliga a IMPRIMIR (regla dura del pliego):
 *   · el FACTOR DE EXAGERACIÓN, siempre, nunca implícito — una deformación
 *     exagerada sin su factor es un engaño;
 *   · el radio de curvatura y la δ máxima, ACOTADA sobre la pieza;
 *   · el criterio de pandeo con SUS DOS NÚMEROS, como el libro:
 *     (s_borde − s_centro) > 0.44·(h/W)² → "0.0135 > 0.0011".
 *
 * La escala de color es FIJA (`ESC_DESPLAZAMIENTO`) con el lado del riesgo
 * declarado; auto-escalar destruiría el criterio de Kazmer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';

import { coloresDesde, rampa, rampaHex, norm, num, type Caja } from './estudio-vivo-datos';
import {
  ESC_DESPLAZAMIENTO, ESC_DT_MOLDE, ESC_CONTRACCION,
  cajaVacia, meter, encajar, fmt, medidaRotulo, altoLeyenda, type PropsVista3D,
} from './vista3d-comun';
import {
  campoAlabeo, desplazamientoReal, factorMaximo, factorDe, invariantes,
  type CampoAlabeo, type Topologia,
} from './vista3d-alabeo-datos';
import { Rotulo, Leyenda, Cota, Polilinea, type LineaRotulo } from './vista3d-rotulo';

export const META = {
  id: 'alabeo',
  nombre: 'LA PIEZA SE DEFORMA',
  icono: '≋',
  seccion: '§10.3.1 · L17',
  control: { etiqueta: 'exageración', min: 0, max: 1, paso: 0.005, inicial: 0.5 },
};

export type { PropsVista3D } from './vista3d-comun';

const ORO = '#c9a227';
const ROJO = '#e04a2f';
const GRIS = '#5a6675';

/* ────────────────────────────────────────────────────────────────────────── */

/** La pieza DEFORMADA: la geometría se construye una vez y las posiciones se
 *  MUTAN al mover el control (reconstruirla en cada tick tiraría el atributo de
 *  color y haría parpadear los 80 k vértices). */
function PiezaDeformada({ malla, u, factor, colores, onSonda }: {
  malla: PropsVista3D['malla']; u: Float32Array; factor: number; colores: Float32Array;
  onSonda: (p: THREE.Vector3, tri: number) => void;
}) {
  const base = useMemo(() => (
    malla.positions instanceof Float32Array ? malla.positions : new Float32Array(malla.positions)
  ), [malla]);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const idx = malla.indices instanceof Uint32Array ? malla.indices : new Uint32Array(malla.indices);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base), 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base.length), 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [malla, base]);
  useEffect(() => () => geom.dispose(), [geom]);

  useEffect(() => {
    const a = geom.getAttribute('color') as THREE.BufferAttribute;
    if (!a || a.array.length !== colores.length) return;
    (a.array as Float32Array).set(colores);
    a.needsUpdate = true;
  }, [geom, colores]);

  useEffect(() => {
    const a = geom.getAttribute('position') as THREE.BufferAttribute;
    const arr = a.array as Float32Array;
    if (factor === 0) arr.set(base);                                   // BIT A BIT
    else for (let i = 0; i < arr.length; i++) arr[i] = base[i] + factor * u[i];
    a.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
  }, [geom, base, u, factor]);

  const abajo = useRef<{ x: number; y: number } | null>(null);
  const down = useCallback((e: ThreeEvent<PointerEvent>) => { abajo.current = { x: e.clientX, y: e.clientY }; }, []);
  const up = useCallback((e: ThreeEvent<PointerEvent>) => {
    const a = abajo.current; abajo.current = null;
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) return;   // fue órbita
    e.stopPropagation();
    onSonda(e.point.clone(), e.faceIndex ?? -1);
  }, [onSonda]);

  return (
    <mesh geometry={geom} onPointerDown={down} onPointerUp={up}>
      <meshStandardMaterial vertexColors flatShading roughness={0.6} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** El FANTASMA de la pieza sin deformar + el plano original: la referencia
 *  contra la que se lee la curvatura. Sin esto "se ve doblada" no es un dato. */
function Fantasma({ malla, caja }: { malla: PropsVista3D['malla']; caja: Caja }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = malla.positions instanceof Float32Array ? malla.positions : new Float32Array(malla.positions);
    const idx = malla.indices instanceof Uint32Array ? malla.indices : new Uint32Array(malla.indices);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }, [malla]);
  useEffect(() => () => geom.dispose(), [geom]);
  const zMid = (caja.z0 + caja.z1) / 2;
  const m = 0.02 * Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0);
  const p: Array<[number, number, number]> = [
    [caja.x0 - m, caja.y0 - m, zMid], [caja.x1 + m, caja.y0 - m, zMid],
    [caja.x1 + m, caja.y1 + m, zMid], [caja.x0 - m, caja.y1 + m, zMid], [caja.x0 - m, caja.y0 - m, zMid],
  ];
  const r = 0.0022 * Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0);
  return (
    <group>
      <mesh geometry={geom}>
        <meshBasicMaterial color={GRIS} transparent opacity={0.16} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <Polilinea puntos={p} radio={r} color="#7d8798" opacidad={0.75} />
    </group>
  );
}

/** EL CAMPO QUE LA CAUSA, modo ESPESOR: el sándwich cavidad / plástico / núcleo
 *  de Fig 10.14, con cada mitad del acero coloreada por su ΔT respecto a la
 *  media. Es literalmente la sección del libro, puesta en el espacio. */
function CampoEspesor({ campo, x, y, z, lado }: {
  campo: CampoAlabeo; x: number; y: number; z: number; lado: number;
}) {
  const media = (campo.proceso.tCavityC + campo.proceso.tCoreC) / 2;
  const cCav = rampaHex(norm(campo.proceso.tCavityC - media, ESC_DT_MOLDE.dom));
  const cCore = rampaHex(norm(campo.proceso.tCoreC - media, ESC_DT_MOLDE.dom));
  const e = lado * 0.20;         // espesor de cada mitad de acero
  const g = lado * 0.055;        // el plástico entre las dos
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0, (g + e) / 2]}>
        <boxGeometry args={[lado, lado, e]} />
        <meshStandardMaterial color={cCav} roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh>
        <boxGeometry args={[lado * 0.98, lado * 0.98, g]} />
        <meshStandardMaterial color="#cfd6e2" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, -(g + e) / 2]}>
        <boxGeometry args={[lado, lado, e]} />
        <meshStandardMaterial color={cCore} roughness={0.5} metalness={0.25} />
      </mesh>
    </group>
  );
}

/** EL CAMPO QUE LA CAUSA, modo ÁREA: el disco de contracción s(r) del centro al
 *  borde (Fig 10.15) — el gradiente que un área cerrada solo puede resolver
 *  saliéndose del plano. */
function CampoArea({ campo, x, y, z, radio }: {
  campo: CampoAlabeo; x: number; y: number; z: number; radio: number;
}) {
  const geom = useMemo(() => {
    const NR = 28, NA = 64;
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const sC = campo.are.sCenterPct, sE = campo.are.sEdgePct;
    for (let i = 0; i <= NR; i++) {
      const f = i / NR, r = f * radio;
      const s = sC + (sE - sC) * f;
      const c = rampa(norm(s, ESC_CONTRACCION.dom));
      for (let j = 0; j <= NA; j++) {
        const a = (j / NA) * Math.PI * 2;
        pos.push(r * Math.cos(a), r * Math.sin(a), 0);
        col.push(c[0], c[1], c[2]);
      }
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) {
      const a = i * (NA + 1) + j, b = a + NA + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [campo, radio]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom} position={[x, y, z]}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function Vista({ malla, caja, spec, t, onLectura }: PropsVista3D): JSX.Element {
  /* ── pared y topología: del spec si el Estudio lo trae; si no, declarado ── */
  const paredMm: number = (spec && spec.cavity && spec.cavity.wallMm) || 2;
  const topologia: Topologia = (spec && spec.warpageTopology && spec.warpageTopology.tipo)
    || (spec && spec.cavity && spec.cavity.frameMm ? 'marco' : 'placa');

  const campo = useMemo(() => campoAlabeo(caja, { wallMm: paredMm, topologia }), [caja, paredMm, topologia]);
  /** la escala del CAMPO QUE LA CAUSA depende del modo dominante */
  const escalaCampo = campo.modo === 'espesor' ? ESC_DT_MOLDE : ESC_CONTRACCION;
  const desp = useMemo(() => desplazamientoReal(malla, campo), [malla, campo]);
  const fMax = useMemo(() => factorMaximo(desp, caja), [desp, caja]);
  const F = factorDe(Math.max(0, Math.min(1, t)), fMax);

  /* ── COLOR: |u_z| REAL en la escala FIJA (el color no se exagera; si se
       exagerara, el dominio dejaría de significar milímetros) ── */
  const pintura = useMemo(() => {
    const nV = Math.floor((malla.positions as any).length / 3);
    return coloresDesde(nV, ESC_DESPLAZAMIENTO.dom, (v) => Math.abs(desp.u[v * 3 + 2]));
  }, [malla, desp]);

  /* ── LA COMPOSICIÓN: dónde va cada cosa, en coords de la pieza ── */
  const L = Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0) || 100;
  const cx = (caja.x0 + caja.x1) / 2, cy = (caja.y0 + caja.y1) / 2, zMid = (caja.z0 + caja.z1) / 2;
  const campoX = caja.x1 + 0.46 * L;
  const campoLado = 0.36 * L;
  /** δ ANALÍTICA del modo (el número del libro, en r = 0 / en el borde) contra el
   *  máximo que de verdad hay SOBRE LA MALLA: si ningún vértice cae en el punto
   *  del máximo teórico, el número que se ve es menor — y decirlo es obligatorio. */
  const deltaTeorica = campo.deltaModoMm;
  const difTeorica = Math.abs(deltaTeorica - desp.uzMaxMm) > 0.02 * Math.max(1e-9, deltaTeorica);
  const ecModo = campo.modo === 'espesor' ? 'Ec. 10.18' : 'Ec. 10.20';

  /* ── el máximo, para la COTA de δ ── */
  const P = malla.positions;
  const iMax = desp.iMax;
  const pMax: [number, number, number] = [P[iMax * 3], P[iMax * 3 + 1], P[iMax * 3 + 2]];
  const pMaxDef: [number, number, number] = [
    pMax[0] + F * desp.u[iMax * 3], pMax[1] + F * desp.u[iMax * 3 + 1], pMax[2] + F * desp.u[iMax * 3 + 2],
  ];

  /* ── el ARCO de curvatura (modo espesor): la superficie media, exagerada ── */
  const arco = useMemo(() => {
    if (campo.modo !== 'espesor' || !(Math.abs(campo.kappa) > 1e-15)) return null;
    const k = campo.kappa, W = campo.halfWidthMm;
    const dx = pMax[0] - cx, dy = pMax[1] - cy;
    const h = Math.hypot(dx, dy) || 1;
    const ux = dx / h, uy = dy / h;
    const pts: Array<[number, number, number]> = [];
    for (let i = -24; i <= 24; i++) {
      const r = (i / 24) * W;
      const th = k * r;
      const sh = Math.sin(th / 2);
      const rho = Math.sin(th) / k;
      const dz = (2 * sh * sh) / k;
      pts.push([cx + rho * ux, cy + rho * uy, zMid + F * dz]);
    }
    return pts;
  }, [campo, F, cx, cy, zMid, pMax]);

  /* ── LOS RÓTULOS ── */
  const are = campo.are, esp = campo.esp;
  const lineasCard: LineaRotulo[] = useMemo(() => {
    const l: LineaRotulo[] = [
      { txt: `${META.icono} ${META.nombre} · ${META.seccion}`, color: ORO, peso: 700, sz: 1.0 },
      { txt: `EXAGERACIÓN ×${fmt(F, F < 10 ? 2 : 1)}   (×1 = tamaño real · máx ×${fmt(fMax, 0)})`, color: F === 0 ? '#8fa3bd' : '#ffd76a', peso: 700, sz: 0.95 },
      { txt: F === 0 ? 'sin exagerar: lo que ves ES la pieza nominal' : `δ máx sobre la malla ${fmt(desp.uzMaxMm)} mm → en pantalla ${fmt(desp.uzMaxMm * F)} mm`, color: '#8fa3bd', sz: 0.78 },
      ...(difTeorica ? [{
        txt: `δ analítica del modo ${fmt(deltaTeorica)} mm (${ecModo}); la malla llega a ${fmt(desp.uzMaxMm)} mm porque ningún vértice cae en el punto del máximo teórico`,
        color: '#8b93a3', sz: 0.72,
      } as LineaRotulo] : []),
      { txt: `modo dominante: ${campo.modo === 'espesor' ? 'A TRAVÉS DEL ESPESOR (Fig 10.14)' : 'A TRAVÉS DEL ÁREA = PANDEO (Fig 10.15)'}`, color: '#e9eef5', peso: 700, sz: 0.85 },
      { txt: campo.razonModo, color: '#8fa3bd', sz: 0.74 },
      { txt: '', sz: 0.35 },
      { txt: `CURVATURA  R = ${esp.radiusMm.toLocaleString('es-MX')} mm (Ec. 10.17)  ·  δ = ${fmt(esp.deltaMm)} mm (Ec. 10.18)`, color: '#dbe5f2', peso: 700, sz: 0.85 },
      { txt: `  ΔT núcleo↔cavidad = ${fmt(campo.dtC, 1)} °C  (${fmt(campo.proceso.tCoreC, 1)} vs ${fmt(campo.proceso.tCavityC, 1)})`, color: '#dbe5f2', sz: 0.8 },
      { txt: `  s_núcleo ${fmt(esp.sCorePct, 4)} %  vs  s_cavidad ${fmt(esp.sCavityPct, 4)} %  ·  pared h = ${fmt(campo.wallMm)} mm · W = ${fmt(campo.halfWidthMm, 1)} mm`, color: '#8fa3bd', sz: 0.74 },
      { txt: `  contracción total borde a borde ${fmt(esp.contraccionTotalMm)} mm → el alabeo ${esp.superaContraccion ? 'LA SUPERA' : 'no la supera'}`, color: esp.superaContraccion ? '#ffb347' : '#8fa3bd', peso: esp.superaContraccion ? 700 : 400, sz: 0.76 },
      { txt: '', sz: 0.35 },
      { txt: `PANDEO (Ec. 10.19)  ${campo.criterioPandeo.texto}`, color: '#dbe5f2', peso: 700, sz: 0.85 },
      {
        txt: `  → ${!are.aplica ? 'NO APLICA: es un MARCO (§10.3.1, área abierta)' : are.pandea ? `PANDEA · δ = ${fmt(are.deltaMm)} mm (Ec. 10.20, cota conservadora)` : 'no pandea'}`,
        color: are.pandea ? '#ffb347' : '#8fa3bd', peso: are.pandea ? 700 : 400, sz: 0.8,
      },
      { txt: `  s_centro ${fmt(are.sCenterPct, 4)} %  vs  s_borde ${fmt(are.sEdgePct, 4)} %  ·  topología ${campo.topologia}`, color: '#8fa3bd', sz: 0.74 },
      { txt: '', sz: 0.35 },
      {
        txt: `verificación: sagita del arco dibujado ${fmt(campo.arco.sagitaMm, 4)} mm vs δ Ec. 10.18 ${fmt(campo.arco.deltaEcMm)} mm → Δ ${fmt(campo.arco.difMm, 4)} mm ${campo.arco.coincide ? '✓ misma cosa' : '✗ NO coinciden'}`,
        color: campo.arco.coincide ? '#7fc47f' : ROJO, peso: 700, sz: 0.72,
      },
      { txt: 'amplificación LINEAL del campo real (convención de post-proceso): a ×N la forma NO es la deformada de gran desplazamiento', color: '#8b93a3', sz: 0.7 },
    ];
    return l;
  }, [F, fMax, campo, esp, are, desp, difTeorica, deltaTeorica, ecModo]);

  /* ── ENCAJE: la composición entera dentro de la caja de la pieza.
       Los rótulos se MIDEN (`medidaRotulo`/`altoLeyenda`), no se estiman: con el
       alto a ojo la tarjeta se salía del cuadro en cuanto una línea envolvía. ── */
  const anchoCard = 1.22 * L, anchoLey = 0.92 * L;
  const altoCard = useMemo(() => medidaRotulo(lineasCard, 78).alto(anchoCard), [lineasCard, anchoCard]);
  const altoLey1 = useMemo(() => altoLeyenda(ESC_DESPLAZAMIENTO, anchoLey), [anchoLey]);
  const altoLey2 = useMemo(() => altoLeyenda(escalaCampo, anchoLey), [escalaCampo, anchoLey]);
  // el 1.18 es HOLGURA DECLARADA: `medidaRotulo` estima el ancho del renglón con
  // el avance nominal de la mono (0.6 em) y sale un pelo corto contra el
  // `measureText` real, así que las dos leyendas apiladas se rozaban. Con la
  // holgura no se tocan y el encuadre sigue siendo determinista.
  const HOLGURA = 1.18;
  const zLey1 = caja.z0 - 0.12 * L;                              // leyenda del desplazamiento
  const zLey2 = zLey1 - altoLey1 * HOLGURA - 0.06 * L;           // leyenda del campo, debajo
  const enc = useMemo(() => {
    const b = cajaVacia();
    const flecha = Math.max(desp.uzMaxMm * fMax, 0.02 * L);
    meter(b, caja.x0, caja.y0, caja.z0 - flecha);
    meter(b, caja.x1, caja.y1, caja.z1 + flecha);
    meter(b, campoX - campoLado * 0.8, cy - campoLado * 0.8, zMid - campoLado * 0.8);
    meter(b, campoX + campoLado * 0.8, cy + campoLado * 0.8, zMid + campoLado * 0.8);
    meter(b, caja.x0 - 0.06 * L, cy, caja.z1 + 0.12 * L + altoCard * HOLGURA);    // tarjeta arriba
    meter(b, caja.x0 - 0.06 * L + anchoCard, cy, caja.z1 + 0.12 * L);
    // las dos leyendas van APILADAS, no lado a lado: en la vista isométrica dos
    // sprites separados sólo en X se encimaban en pantalla (se vio en la captura)
    meter(b, caja.x0 - 0.06 * L, cy, zLey2 - altoLey2 * HOLGURA);
    meter(b, caja.x0 - 0.06 * L + anchoLey, cy, zLey1);
    return encajar(b, caja);
  }, [caja, campoX, campoLado, cy, zMid, L, desp.uzMaxMm, fMax, altoCard, altoLey2, anchoCard, anchoLey, zLey1, zLey2, HOLGURA]);

  /* ── SONDA ── */
  const cbRef = useRef(onLectura); cbRef.current = onLectura;
  const grupo = useRef<THREE.Group>(null);
  const [marca, setMarca] = useState<[number, number, number] | null>(null);

  const sondar = useCallback((pw: THREE.Vector3, tri: number) => {
    // `e.point` viene en MUNDO; la marca se dibuja DENTRO del grupo encajado, así
    // que hay que bajarla a coords locales o queda a media pantalla del dedo.
    const p = grupo.current ? grupo.current.worldToLocal(pw.clone()) : pw;
    const idx = malla.indices as any;
    // el vértice se busca sobre la malla ORIGINAL por el triángulo tocado
    // (índice exacto, sin invertir escalas)
    let v = 0;
    if (tri >= 0 && idx && tri * 3 + 2 < idx.length) v = idx[tri * 3];
    const uz = desp.u[v * 3 + 2];
    const ux = desp.u[v * 3], uy = desp.u[v * 3 + 1];
    setMarca([p.x, p.y, p.z]);
    cbRef.current?.({
      titulo: 'desplazamiento local por alabeo',
      valor: `${num(Math.abs(uz), 3)} mm fuera de plano  (|u| = ${num(Math.hypot(ux, uy, uz), 3)} mm)`,
      nota: `en pantalla ×${fmt(F, 2)} → ${num(Math.abs(uz) * F, 2)} mm · MODO DOMINANTE: ${campo.modo === 'espesor' ? 'a través del ESPESOR (curvatura, Fig 10.14)' : 'a través del ÁREA (pandeo, Fig 10.15)'} · ${campo.razonModo}`,
      seccion: META.seccion,
    });
  }, [malla, desp, F, campo]);

  // primera lectura sin tocar nada: el máximo. Que el panel nazca con un dato.
  const yaReporte = useRef('');
  useEffect(() => {
    const k = `${campo.modo}|${desp.uzMaxMm}`;
    if (yaReporte.current === k) return;
    yaReporte.current = k;
    cbRef.current?.({
      titulo: 'δ máxima de la pieza',
      valor: `${num(desp.uzMaxMm, 3)} mm fuera de plano`,
      nota: `${campo.razonModo} · toca la pieza para leer el desplazamiento LOCAL`,
      seccion: META.seccion,
    });
  }, [campo, desp]);

  /* ── API del arnés: números, no píxeles ── */
  useEffect(() => {
    const inv = invariantes(malla, desp, fMax);
    const w = (window as any);
    w.__vista3d = w.__vista3d || {};
    w.__vista3d.alabeo = {
      meta: META, t, factor: F, factorMax: fMax,
      modo: campo.modo, razonModo: campo.razonModo,
      deltaRealMm: +desp.uzMaxMm.toFixed(5), deltaPantallaMm: +(desp.uzMaxMm * F).toFixed(5),
      radioKazmerMm: campo.esp.radiusMm, radioVerdaderoMm: campo.arco.rVerdaderoMm,
      arco: campo.arco,
      criterioPandeo: campo.criterioPandeo,
      pandea: campo.are.pandea, aplicaPandeo: campo.are.aplica, deltaPandeoMm: campo.are.deltaMm,
      dtC: campo.dtC, paredMm: campo.wallMm, halfWidthMm: campo.halfWidthMm, topologia: campo.topologia,
      dom: ESC_DESPLAZAMIENTO.dom, unidad: ESC_DESPLAZAMIENTO.unidad, riesgo: ESC_DESPLAZAMIENTO.riesgo,
      escalaEncaje: +enc.escala.toFixed(4), notaEncaje: enc.nota,
      sinDatoPct: +(100 * pintura.nSinDato / Math.max(1, Math.floor((malla.positions as any).length / 3))).toFixed(2),
      invariantes: inv,
      notas: campo.notas,
    };
  }, [malla, desp, fMax, F, t, campo, enc, pintura]);

  /* ══════════════════════════════════════════════════════════════════════ */
  const rCota = 0.004 * L;

  return (
    <group name="vista3d-alabeo" position={enc.offset} scale={enc.escala}>
      <group ref={grupo} position={[-enc.centro[0], -enc.centro[1], -enc.centro[2]]}>
        <Fantasma malla={malla} caja={caja} />
        <PiezaDeformada malla={malla} u={desp.u} factor={F} colores={pintura.colores} onSonda={sondar} />

        {/* la COTA de δ, sobre el punto donde de verdad ocurre */}
        {F > 0 && desp.uzMaxMm > 1e-9 && (
          <Cota
            a={pMax} b={pMaxDef} radio={rCota} ancho={0.52 * L} anclaTexto="inf-izq"
            texto={[
              { txt: `δ máx = ${fmt(desp.uzMaxMm, 3)} mm  (${ecModo})`, color: ORO, peso: 700, sz: 0.95 },
              { txt: `en pantalla ×${fmt(F, 2)} = ${fmt(desp.uzMaxMm * F, 2)} mm`, color: '#dbe5f2', sz: 0.8 },
            ]}
          />
        )}

        {/* el ARCO de curvatura de la superficie media */}
        {arco && (
          <>
            <Polilinea puntos={arco} radio={rCota * 0.8} color={ORO} opacidad={0.95} />
            <Rotulo
              lineas={[
                { txt: `R = ${campo.esp.radiusMm.toLocaleString('es-MX')} mm (Ec. 10.17 = 2h/Δs)`, color: ORO, peso: 700, sz: 0.9 },
                { txt: `κ = 2/R = 1/${campo.arco.rVerdaderoMm.toLocaleString('es-MX')} mm⁻¹ — el arco que ves`, color: '#8fa3bd', sz: 0.76 },
              ]}
              position={[arco[0][0], arco[0][1], arco[0][2]]}
              ancho={0.56 * L} ancla="sup-der" max={44}
            />
          </>
        )}

        {/* EL CAMPO QUE LA CAUSA, al lado */}
        {campo.modo === 'espesor'
          ? <CampoEspesor campo={campo} x={campoX} y={cy} z={zMid} lado={campoLado} />
          : <CampoArea campo={campo} x={campoX} y={cy} z={zMid} radio={campoLado * 0.62} />}
        <Rotulo
          lineas={campo.modo === 'espesor' ? [
            { txt: 'EL CAMPO QUE LA CAUSA', color: ORO, peso: 700, sz: 0.9 },
            { txt: `CAVIDAD (+Z)  ${fmt(campo.proceso.tCavityC, 1)} °C`, color: rampaHex(norm(campo.proceso.tCavityC - (campo.proceso.tCavityC + campo.proceso.tCoreC) / 2, ESC_DT_MOLDE.dom)), peso: 700, sz: 0.82 },
            { txt: `NÚCLEO  (−Z)  ${fmt(campo.proceso.tCoreC, 1)} °C`, color: rampaHex(norm(campo.proceso.tCoreC - (campo.proceso.tCavityC + campo.proceso.tCoreC) / 2, ESC_DT_MOLDE.dom)), peso: 700, sz: 0.82 },
            { txt: `ΔT = ${fmt(campo.dtC, 1)} °C  →  el lado caliente contrae MÁS y la pieza se abarquilla`, color: '#dbe5f2', sz: 0.74 },
          ] : [
            { txt: 'EL CAMPO QUE LA CAUSA', color: ORO, peso: 700, sz: 0.9 },
            { txt: `s_centro ${fmt(campo.are.sCenterPct, 4)} %  →  s_borde ${fmt(campo.are.sEdgePct, 4)} %`, color: '#dbe5f2', peso: 700, sz: 0.82 },
            { txt: `P_centro ${(campo.proceso.pCenterPa / 1e6).toFixed(0)} MPa → P_borde ${(campo.proceso.pEdgePa / 1e6).toFixed(0)} MPa (el empaque cae)`, color: '#8fa3bd', sz: 0.74 },
          ]}
          position={[campoX + campoLado * 0.55, cy, zMid + campoLado * 0.95]}
          ancho={0.66 * L} ancla="sup-izq" max={44}
        />

        {/* tarjeta de datos + las dos leyendas de escala FIJA */}
        <Rotulo lineas={lineasCard} position={[caja.x0 - 0.06 * L, cy, caja.z1 + 0.12 * L]} ancho={anchoCard} ancla="inf-izq" max={78} />
        <Leyenda escala={ESC_DESPLAZAMIENTO} position={[caja.x0 - 0.06 * L, cy, zLey1]} ancho={anchoLey} ancla="sup-izq" />
        <Leyenda escala={escalaCampo} position={[caja.x0 - 0.06 * L, cy, zLey2]} ancho={anchoLey} ancla="sup-izq" />

        {/* la marca de la sonda */}
        {marca && (
          <mesh position={marca}>
            <sphereGeometry args={[0.014 * L, 18, 18]} />
            <meshBasicMaterial color={ORO} toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}
