/**
 * EL CIRCUITO DE AGUA — la vista 3D del enfriamiento (§9.2.7 · L10).
 * ============================================================================
 * El molde en TRANSPARENCIA con las líneas de agua SÓLIDAS adentro (tapones
 * incluidos), el refrigerante coloreado por su ΔT ACUMULADO conforme recorre el
 * circuito — el argumento de Fig 9.12: el agua se calienta y la última impresión
 * enfría peor — y ROJO en cada intersección con un componente, que es la Fig 9.9
 * puesta en el espacio.
 *
 * El trazo NO se inventa aquí: sale de `coolingCircuit` (§9.2, paso Eq 9.24,
 * profundidad Eq 9.22, steel-safe direccional) y la contabilidad de choques y
 * ΔT vive en `vista3d-agua-datos.ts`, que es puro. Esta pantalla es PIEL.
 *
 * Escala de color FIJA (`ESC_AGUA`) con el lado del riesgo declarado.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';

import { rampa, rampaHex, norm, num } from './estudio-vivo-datos';
import {
  ESC_AGUA, cajaVacia, meter, encajar, fmt, medidaRotulo, altoLeyenda, specDeEnsamble,
  type PropsVista3D,
} from './vista3d-comun';
import { datosAgua, estacionEn, type DatosAgua, type CircuitoLado } from './vista3d-agua-datos';
import { Rotulo, Leyenda, Cota, Varilla, type LineaRotulo } from './vista3d-rotulo';

export const META = {
  id: 'agua',
  nombre: 'EL CIRCUITO DE AGUA',
  icono: '❄',
  seccion: '§9.2.7 · L10',
  control: { etiqueta: 'recorrido del refrigerante', min: 0, max: 1, paso: 0.005, inicial: 0.5 },
};

export type { PropsVista3D } from './vista3d-comun';

const ORO = '#c9a227';
const ROJO = '#e8402a';
const AMBAR = '#ffb347';
const ACERO = '#8ea3bd';
const LATON = '#b08d3a';

/* ────────────────────────────────────────────────────────────────────────── */
/* El tubo del refrigerante                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Barrido de un anillo a lo largo del recorrido, con COLOR POR ESTACIÓN. Un
 * cilindro por tramo serían ~700 draw calls; esto es UNA malla. Las juntas se
 * dejan a tope (sin mitrar): el canal REAL son barrenos rectos que se cruzan,
 * así que la esquina viva es lo honesto.
 */
function tuboDeRuta(ruta: Array<{ x: number; y: number; z: number; dtC: number }>, radio: number, lados = 10): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const n = ruta.length;
  if (n < 2) return g;
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  const up = new THREE.Vector3(0, 0, 1);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  let base = 0;
  for (let i = 0; i + 1 < n; i++) {
    a.set(ruta[i].x, ruta[i].y, ruta[i].z);
    b.set(ruta[i + 1].x, ruta[i + 1].y, ruta[i + 1].z);
    d.subVectors(b, a);
    if (d.lengthSq() < 1e-12) continue;
    d.normalize();
    e1.copy(Math.abs(d.dot(up)) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).cross(d).normalize();
    e2.crossVectors(d, e1).normalize();
    const c0 = rampa(norm(ruta[i].dtC, ESC_AGUA.dom));
    const c1 = rampa(norm(ruta[i + 1].dtC, ESC_AGUA.dom));
    for (let k = 0; k <= lados; k++) {
      const th = (k / lados) * Math.PI * 2;
      const nx = e1.x * Math.cos(th) + e2.x * Math.sin(th);
      const ny = e1.y * Math.cos(th) + e2.y * Math.sin(th);
      const nz = e1.z * Math.cos(th) + e2.z * Math.sin(th);
      pos.push(a.x + nx * radio, a.y + ny * radio, a.z + nz * radio);
      nor.push(nx, ny, nz); col.push(c0[0], c0[1], c0[2]);
      pos.push(b.x + nx * radio, b.y + ny * radio, b.z + nz * radio);
      nor.push(nx, ny, nz); col.push(c1[0], c1[1], c1[2]);
    }
    for (let k = 0; k < lados; k++) {
      const p = base + k * 2;
      idx.push(p, p + 1, p + 2, p + 2, p + 1, p + 3);
    }
    base += (lados + 1) * 2;
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function Refrigerante({ c, radio }: { c: CircuitoLado; radio: number }) {
  const geom = useMemo(() => tuboDeRuta(c.ruta, radio), [c, radio]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial vertexColors roughness={0.28} metalness={0.05} emissiveIntensity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Caja translúcida con aristas: el acero que deja ver adentro. */
function Placa({ x0, y0, z0, x1, y1, z1, color, opacidad, onDown, onClick }: {
  x0: number; y0: number; z0: number; x1: number; y1: number; z1: number;
  color: string; opacidad: number;
  onDown?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const w = x1 - x0, d = y1 - y0, h = z1 - z0;
  const c: [number, number, number] = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const aristas = useMemo(() => {
    const g = new THREE.BoxGeometry(w, d, h);
    const e = new THREE.EdgesGeometry(g);
    g.dispose();
    return e;
  }, [w, d, h]);
  useEffect(() => () => aristas.dispose(), [aristas]);
  return (
    <group position={c}>
      <mesh onPointerDown={onDown} onPointerUp={onClick}>
        <boxGeometry args={[w, d, h]} />
        <meshStandardMaterial color={color} transparent opacity={opacidad} depthWrite={false} side={THREE.DoubleSide} roughness={0.5} metalness={0.4} />
      </mesh>
      <lineSegments geometry={aristas}>
        <lineBasicMaterial color={color} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

/**
 * LA TARJETA DE DATOS del circuito. Fuera del componente porque el ENCUADRE
 * necesita MEDIRLA antes de dibujarla (y porque así se lee de un jalón todo lo
 * que la vista se obliga a imprimir).
 */
function tarjetaAgua(dd: DatosAgua): LineaRotulo[] {
  const crit = dd.choques.filter((c) => c.sev === 'CRÍTICO').length;
  const adv = dd.choques.filter((c) => c.sev === 'ADVERTENCIA').length;
  return [
    { txt: `${META.icono} ${META.nombre} · ${META.seccion}`, color: ORO, peso: 700, sz: 1.0 },
    { txt: `⌀${fmt(dd.diaMm, 2)} mm · ${dd.circuitos[0].nLineas} líneas/lado (el proceso pedía ${dd.proceso.nPerSideDiseno}) · placa ${dd.spec.widthMm}×${dd.D} mm`, color: '#8fa3bd', sz: 0.74 },
    { txt: '', sz: 0.3 },
    { txt: `REFRIGERANTE entra a ${fmt(dd.proceso.tInC, 0)} °C · Q̇ ${fmt(dd.proceso.qCoolingW, 0)} W · V̇ ${fmt(dd.proceso.vDotLineGPM, 2)} GPM/línea · Re ${dd.proceso.reynolds.toLocaleString('es-MX')}`, color: '#dbe5f2', peso: 700, sz: 0.84 },
    ...dd.circuitos.map<LineaRotulo>((c) => ({
      txt: `  ${c.lado}: ΔT total ${fmt(c.dtTotalC, 2)} °C en ${fmt(c.largoMm, 0)} mm (${fmt(c.largoBajoCavidadMm, 0)} bajo impresión) → sale a ${fmt(dd.proceso.tInC + c.dtTotalC, 2)} °C`,
      color: c.dtTotalC > 1 ? AMBAR : '#dbe5f2', peso: c.dtTotalC > 1 ? 700 : 400, sz: 0.78,
    })),
    { txt: '  Fig 9.12: Eq 9.13 dimensiona ≤1 °C POR LÍNEA — en SERIE se acumula y la ÚLTIMA impresión enfría con agua ya caliente', color: '#8b93a3', sz: 0.72 },
    { txt: '', sz: 0.3 },
    ...dd.circuitos.map<LineaRotulo>((c) => ({
      txt: `  ${c.lado}: H = ${fmt(c.hMm, 1)} mm = ${fmt(c.hSobreDia, 2)} ⌀ a la superficie moldeante — Eq 9.22 pide 2–5 ⌀`,
      color: c.hOk ? '#dbe5f2' : AMBAR, peso: c.hOk ? 400 : 700, sz: 0.78,
    })),
    { txt: '', sz: 0.3 },
    {
      txt: `§9.2.7  holgura MÍNIMA ${fmt(dd.holguraMinMm, 2)} mm  vs  ½⌀ = ${fmt(dd.claroExigidoMm, 2)} mm exigido`,
      color: dd.holguraMinMm < dd.claroExigidoMm ? ROJO : '#7fc47f', peso: 700, sz: 0.86,
    },
    {
      txt: `  ${crit} intersección(es) CRÍTICA(s) · ${adv} advertencia(s) — en ROJO sobre el molde`,
      color: crit ? ROJO : '#8fa3bd', peso: 700, sz: 0.78,
    },
    ...dd.choques.slice(0, 2).map<LineaRotulo>((c) => ({
      txt: `   ${c.sev === 'CRÍTICO' ? '✗' : '⚠'} ${c.componente} → ${fmt(c.holguraMm, 2)} mm (${c.lado})`,
      color: c.sev === 'CRÍTICO' ? ROJO : AMBAR, sz: 0.72,
    })),
    ...(dd.pinContorneado ? [{
      txt: '   el pin CONTORNEADO §11.2.5 lo agrega esta vista: NO está en `standardHoles` — el ruteador no lo VE y por eso no lo esquiva',
      color: '#8b93a3', sz: 0.7,
    } as LineaRotulo] : []),
    ...(dd.avisos.length ? [{ txt: `⚠ ${dd.avisos[0]}`.slice(0, 116), color: AMBAR, sz: 0.72 } as LineaRotulo] : []),
  ];
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function Vista({ malla, caja, spec, t, onLectura }: PropsVista3D): JSX.Element {
  const sd = useMemo(() => specDeEnsamble(spec, malla, caja), [spec, malla, caja]);
  const d: DatosAgua | { error: string } = useMemo(() => {
    try { return datosAgua(sd.spec); } catch (e) { return { error: String(e).slice(0, 240) }; }
  }, [sd]);

  const L = Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0) || 100;
  const cbRef = useRef(onLectura); cbRef.current = onLectura;
  const grupo = useRef<THREE.Group>(null);
  const [marca, setMarca] = useState<[number, number, number] | null>(null);

  const ok = !('error' in d);
  const dd = ok ? (d as DatosAgua) : null;

  /* ── LA TARJETA DE DATOS. Se arma ANTES del encuadre porque su alto REAL es
       lo que decide cuánto sitio hay que reservar: estimarlo a ojo dejó la
       tarjeta cortada arriba en la segunda corrida del arnés. La nota de escala
       (que depende del encuadre) se agrega al final; aquí se reserva su sitio. ── */
  const anchoCard = dd ? 0.98 * dd.spec.widthMm : L;
  const anchoLey = dd ? 0.72 * dd.spec.widthMm : L;
  const lineasCard = useMemo<LineaRotulo[]>(() => (dd ? tarjetaAgua(dd) : []), [dd]);
  const altoCard = useMemo(
    () => medidaRotulo([...lineasCard, { txt: 'x'.repeat(120), sz: 0.74 }], 72).alto(anchoCard),
    [lineasCard, anchoCard],
  );
  const altoLey = useMemo(() => altoLeyenda(ESC_AGUA, anchoLey), [anchoLey]);

  /* ── ENCAJE: el molde entero dentro de la caja de la pieza ── */
  const enc = useMemo(() => {
    const b = cajaVacia();
    if (dd) {
      for (const p of dd.placas) { meter(b, 0, 0, p.z0); meter(b, p.w, p.d, p.z1); }
      // sitio MEDIDO para los rótulos (arriba y abajo del bloque de acero)
      const W = dd.spec.widthMm, D = dd.D;
      const zA = Math.max(...dd.placas.map((p) => p.z1)), zB = Math.min(...dd.placas.map((p) => p.z0));
      meter(b, -0.03 * W, D / 2, zA + 0.05 * W + altoCard);
      meter(b, -0.03 * W + anchoCard, D / 2, zA + 0.05 * W);
      meter(b, -0.03 * W, D / 2, zB - 0.05 * W - altoLey);
      meter(b, 1.00 * W, D / 2, zB - 0.05 * W);
    } else { meter(b, caja.x0, caja.y0, caja.z0); meter(b, caja.x1, caja.y1, caja.z1); }
    return encajar(b, caja);
  }, [dd, caja, altoCard, altoLey, anchoCard]);

  /* ── la estación del recorrido en t ── */
  const est = useMemo(() => (dd ? dd.circuitos.map((c) => estacionEn(c, t)) : []), [dd, t]);

  /* ── SONDA ── */
  const abajo = useRef<{ x: number; y: number } | null>(null);
  const down = useCallback((e: ThreeEvent<PointerEvent>) => { abajo.current = { x: e.clientX, y: e.clientY }; }, []);
  const sondar = useCallback((e: ThreeEvent<PointerEvent>) => {
    const a = abajo.current; abajo.current = null;
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) return;
    if (!dd || !grupo.current) return;
    e.stopPropagation();
    const p = grupo.current.worldToLocal(e.point.clone());        // ← coords de MOLDE (mm reales)
    setMarca([p.x, p.y, p.z]);
    // la estación más cercana de TODO el circuito
    let mejor: { c: CircuitoLado; i: number; dist: number } | null = null;
    for (const c of dd.circuitos) for (let i = 0; i < c.ruta.length; i++) {
      const q = c.ruta[i];
      const dist = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) - dd.diaMm / 2;
      if (!mejor || dist < mejor.dist) mejor = { c, i, dist };
    }
    if (!mejor) return;
    const q = mejor.c.ruta[mejor.i];
    cbRef.current?.({
      titulo: 'agua en el punto tocado',
      valor: `a ${num(Math.max(0, mejor.dist), 1)} mm de la línea más cercana  ·  ΔT acumulado ahí ${num(q.dtC, 2)} °C`,
      nota: `lado ${mejor.c.lado} · el agua entró a ${dd.proceso.tInC} °C y ahí va en ${num(dd.proceso.tInC + q.dtC, 2)} °C (recorrido ${num(q.sMm, 0)} de ${num(mejor.c.largoMm, 0)} mm) · ${mejor.c.hNota} · §9.2.7 exige ½⌀ = ${fmt(dd.claroExigidoMm, 2)} mm a cualquier componente`,
      seccion: META.seccion,
    });
  }, [dd]);

  /* ── primera lectura ── */
  const ya = useRef('');
  useEffect(() => {
    if (!dd) return;
    const k = `${dd.spec.name}|${dd.diaMm}`;
    if (ya.current === k) return;
    ya.current = k;
    const cr = dd.choques.filter((c) => c.sev === 'CRÍTICO').length;
    cbRef.current?.({
      titulo: 'circuito de agua',
      valor: `⌀${fmt(dd.diaMm, 2)} · ${dd.circuitos.length} lado(s) · ΔT total ${fmt(dd.circuitos[0]?.dtTotalC ?? 0, 2)} °C`,
      nota: `holgura mínima a componentes ${fmt(dd.holguraMinMm, 2)} mm (§9.2.7 exige ${fmt(dd.claroExigidoMm, 2)}) · ${cr} intersección(es) CRÍTICA(s) · toca el molde para leer distancia y ΔT locales`,
      seccion: META.seccion,
    });
  }, [dd]);

  /* ── API del arnés ── */
  useEffect(() => {
    const w = (window as any);
    w.__vista3d = w.__vista3d || {};
    if (!dd) { w.__vista3d.agua = { meta: META, error: (d as any).error }; return; }
    w.__vista3d.agua = {
      meta: META, t,
      origenSpec: sd.origen, molde: `${dd.spec.widthMm}×${dd.D} mm`,
      diaMm: dd.diaMm, claroExigidoMm: dd.claroExigidoMm, holguraMinMm: dd.holguraMinMm,
      nChoques: dd.choques.length,
      nCriticos: dd.choques.filter((c) => c.sev === 'CRÍTICO').length,
      choques: dd.choques.slice(0, 8).map((c) => ({ sev: c.sev, holguraMm: c.holguraMm, exigidoMm: c.exigidoMm, componente: c.componente, lado: c.lado })),
      pinContorneado: dd.pinContorneado,
      circuitos: dd.circuitos.map((c) => ({
        lado: c.lado, nLineas: c.nLineas, largoMm: c.largoMm, largoBajoCavidadMm: c.largoBajoCavidadMm,
        dtTotalC: c.dtTotalC, hMm: c.hMm, hSobreDia: c.hSobreDia, hOk: c.hOk, avisos: c.avisos,
      })),
      estacion: est.map((e, i) => ({ lado: dd.circuitos[i].lado, sMm: e.sMm, dtC: e.dtC, bajoCavidad: e.bajoCavidad, tOutC: +(dd.proceso.tInC + e.dtC).toFixed(2) })),
      proceso: dd.proceso,
      dom: ESC_AGUA.dom, unidad: ESC_AGUA.unidad, riesgo: ESC_AGUA.riesgo,
      escalaEncaje: +enc.escala.toFixed(4), notaEncaje: enc.nota,
      notas: dd.notas, avisos: dd.avisos,
    };
  }, [dd, d, t, est, enc, sd]);

  if (!dd) {
    return (
      <group name="vista3d-agua">
        <Rotulo
          lineas={[
            { txt: '✗ EL CIRCUITO DE AGUA no se pudo armar', color: ROJO, peso: 700, sz: 1 },
            { txt: String((d as any).error).slice(0, 120), color: '#dbe5f2', sz: 0.8 },
          ]}
          position={[(caja.x0 + caja.x1) / 2, (caja.y0 + caja.y1) / 2, caja.z1]}
          ancho={L} ancla="centro"
        />
      </group>
    );
  }

  const W = dd.spec.widthMm, D = dd.D;
  const r = dd.diaMm / 2;
  const zA = Math.max(...dd.placas.map((p) => p.z1)), zB = Math.min(...dd.placas.map((p) => p.z0));
  const cav0 = dd.cavidades[0];

  return (
    <group name="vista3d-agua" position={enc.offset} scale={enc.escala}>
      {/* la traslación −centro es la que pone la composición EN el encuadre: sin
          ella el molde nace desplazado medio molde y la cámara del Estudio lo
          deja arriba a la izquierda (cazado en la primera corrida del arnés). */}
      <group ref={grupo} position={[-enc.centro[0], -enc.centro[1], -enc.centro[2]]}>
        {/* ── EL ACERO EN TRANSPARENCIA ── */}
        {dd.placas.map((p) => (
          <Placa
            key={p.role} x0={0} y0={0} z0={p.z0} x1={p.w} y1={p.d} z1={p.z1}
            color={p.role === 'A' ? '#7f93ad' : '#6d829c'} opacidad={0.085}
            onDown={down} onClick={sondar}
          />
        ))}

        {/* ── LAS IMPRESIONES (la superficie moldeante de referencia) ── */}
        {dd.cavidades.map((c, i) => (
          <mesh key={i} position={[c.cx, c.cy, dd.zPart + c.depthMm / 2]}>
            {c.round
              ? <cylinderGeometry args={[c.fx / 2, c.fx / 2, c.depthMm, 32]} />
              : <boxGeometry args={[c.fx, c.fy, c.depthMm]} />}
            <meshStandardMaterial color="#cfd6e2" transparent opacity={0.30} roughness={0.8} depthWrite={false} />
          </mesh>
        ))}

        {/* ── LOS COMPONENTES (para que el ROJO no flote solo) ──
             se dibuja SOLO el tramo que convive con el agua (recortado al bloque
             A+B): el vástago que baja al paquete expulsor no interviene en §9.2.7
             y estirado deformaba el encuadre de toda la vista. */}
        {dd.componentes.map((c, i) => {
          const z0 = Math.max(c.z0, zB), z1 = Math.min(c.z1, zA);
          if (z1 - z0 < 0.5) return null;
          return (
          <mesh key={i} position={[c.x, c.y, (z0 + z1) / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[c.dia / 2, c.dia / 2, z1 - z0, 12]} />
            <meshStandardMaterial
              color={c.choca === 'CRÍTICO' ? ROJO : c.choca === 'ADVERTENCIA' ? AMBAR : ACERO}
              transparent opacity={c.choca ? 0.95 : 0.30} roughness={0.55} metalness={0.5}
              emissive={c.choca === 'CRÍTICO' ? ROJO : '#000000'} emissiveIntensity={c.choca === 'CRÍTICO' ? 0.55 : 0}
            />
          </mesh>
          );
        })}

        {/* ── EL PIN CONTORNEADO §11.2.5 (recortado al bloque A+B, igual) ── */}
        {dd.pinContorneado && (() => {
          const p = dd.pinContorneado!;
          const choca = dd.choques.some((c) => /CONTORNEADO/.test(c.componente));
          const z0 = Math.max(p.z0, zB), z1 = Math.min(p.z1, zA);
          return (
            <mesh position={[p.x, p.y, (z0 + z1) / 2]}>
              <boxGeometry args={[p.ladoMm, p.ladoMm, Math.max(1, z1 - z0)]} />
              <meshStandardMaterial
                color={choca ? ROJO : '#9fb0c6'} transparent opacity={choca ? 0.95 : 0.5}
                emissive={choca ? ROJO : '#000000'} emissiveIntensity={choca ? 0.6 : 0} roughness={0.5} metalness={0.5}
              />
            </mesh>
          );
        })()}

        {/* ── EL AGUA, SÓLIDA, coloreada por ΔT acumulado ── */}
        {dd.circuitos.map((c) => <Refrigerante key={c.lado} c={c} radio={r} />)}

        {/* ── TAPONES (plugs) y PUERTOS ── */}
        {dd.circuitos.map((c) => (
          <group key={`t-${c.lado}`}>
            {c.plugs.map((p, i) => (
              <mesh key={i} position={[p[0], p[1], c.z]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[r * 1.25, r * 1.25, dd.diaMm * 1.15, 14]} />
                <meshStandardMaterial color={LATON} roughness={0.35} metalness={0.85} />
              </mesh>
            ))}
            <mesh position={[c.puertos.inXY[0], c.puertos.inXY[1], c.z]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[r * 1.9, dia3(dd.diaMm), 16]} />
              <meshStandardMaterial color="#3fa7ff" roughness={0.3} metalness={0.4} />
            </mesh>
            <mesh position={[c.puertos.outXY[0], c.puertos.outXY[1], c.z]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[r * 1.9, dia3(dd.diaMm), 16]} />
              <meshStandardMaterial color={rampaHex(norm(c.dtTotalC, ESC_AGUA.dom))} roughness={0.3} metalness={0.4} />
            </mesh>
            <Rotulo
              lineas={[{ txt: `IN ${fmt(dd.proceso.tInC, 0)}°C ${c.lado}`, color: '#7fc4ff', peso: 700, sz: 0.85 }]}
              position={[c.puertos.inXY[0] - W * 0.015, c.puertos.inXY[1], c.z]} ancho={W * 0.17} ancla="sup-der"
            />
            {/* el OUT se baja un ⌀: con 2 canales el puerto de salida cae del
                MISMO lado que el de entrada y los dos rótulos se encimaban */}
            <Rotulo
              lineas={[{ txt: `OUT ${fmt(dd.proceso.tInC + c.dtTotalC, 1)}°C +${fmt(c.dtTotalC, 2)}`, color: rampaHex(norm(c.dtTotalC, ESC_AGUA.dom)), peso: 700, sz: 0.85 }]}
              position={[c.puertos.outXY[0] - W * 0.015, c.puertos.outXY[1], c.z - dd.diaMm * 1.6]} ancho={W * 0.25} ancla="sup-der"
            />
          </group>
        ))}

        {/* ── ROJO en cada intersección (Fig 9.9) ── */}
        {dd.choques.map((c, i) => (
          <group key={i} position={[c.x, c.y, c.z]}>
            <mesh>
              <sphereGeometry args={[r * (c.sev === 'CRÍTICO' ? 2.1 : 1.6), 20, 20]} />
              <meshBasicMaterial color={c.sev === 'CRÍTICO' ? ROJO : AMBAR} transparent opacity={0.5} depthTest={false} toneMapped={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[r * 0.85, 16, 16]} />
              <meshBasicMaterial color={c.sev === 'CRÍTICO' ? ROJO : AMBAR} toneMapped={false} />
            </mesh>
          </group>
        ))}
        {dd.choques.length > 0 && (
          <Rotulo
            lineas={[
              { txt: `✗ ${dd.choques[0].sev} §9.2.7 — holgura ${fmt(dd.choques[0].holguraMm, 2)} mm`, color: dd.choques[0].sev === 'CRÍTICO' ? ROJO : AMBAR, peso: 700, sz: 0.9 },
              { txt: dd.choques[0].componente, color: '#dbe5f2', sz: 0.76 },
            ]}
            position={[dd.choques[0].x + W * 0.03, dd.choques[0].y + D * 0.10, dd.choques[0].z + dd.diaMm * 1.2]}
            ancho={W * 0.44} ancla="inf-izq" max={44}
          />
        )}

        {/* ── LA COTA H: distancia de la línea a la superficie moldeante, en ⌀ ── */}
        {dd.circuitos.map((c, i) => {
          const x = cav0 ? cav0.cx : W / 2;
          // cada lado a una Y distinta: con los dos a la misma, los dos rótulos
          // se encimaban y ninguno se leía
          const y = cav0 ? cav0.cy + (i === 0 ? -1 : 1) * (cav0.fy / 2) * 0.8 : D / 2;
          const zSup = c.lado === 'B' ? dd.zPart : dd.zPart + (cav0 ? cav0.depthMm : 0);
          return (
            <Cota
              key={`h-${c.lado}`}
              a={[x, y, c.z]} b={[x, y, zSup]} radio={dd.diaMm * 0.09} ancho={W * 0.30}
              texto={[
                { txt: `H = ${fmt(c.hMm, 1)} = ${fmt(c.hSobreDia, 2)}⌀ (${c.lado})`, color: c.hOk ? ORO : AMBAR, peso: 700, sz: 0.88 },
                { txt: 'Eq 9.22: 2–5⌀', color: '#8fa3bd', sz: 0.72 },
              ]}
            />
          );
        })}

        {/* ── EL RECORRIDO: dónde va el agua en `t` ── */}
        {dd.circuitos.map((c, i) => {
          const e = est[i];
          if (!e) return null;
          const alto = dd.diaMm * (i === 0 ? 3.4 : 6.4);      // escalonados: no se encimen
          return (
            <group key={`e-${c.lado}`}>
              <mesh position={[e.x, e.y, e.z]}>
                <sphereGeometry args={[r * 1.7, 22, 22]} />
                <meshBasicMaterial color={ORO} toneMapped={false} />
              </mesh>
              <Varilla a={[e.x, e.y, e.z]} b={[e.x, e.y, e.z + alto]} radio={dd.diaMm * 0.07} color={ORO} sinProfundidad />
              <Rotulo
                lineas={[
                  { txt: `${c.lado}: ${fmt(e.sMm, 0)}/${fmt(c.largoMm, 0)} mm · agua a ${fmt(dd.proceso.tInC + e.dtC, 2)} °C (+${fmt(e.dtC, 2)})`, color: rampaHex(norm(e.dtC, ESC_AGUA.dom)), peso: 700, sz: 0.86 },
                  { txt: e.bajoCavidad ? 'bajo la impresión: aquí ENTRA el calor' : 'tramo de conexión: aquí no entra calor', color: '#8fa3bd', sz: 0.72 },
                ]}
                position={[e.x, e.y, e.z + alto]} ancho={W * 0.42} ancla="inf-izq" max={46}
              />
            </group>
          );
        })}

        {/* ── tarjeta de datos + leyenda de escala FIJA ──
             la nota de ESCALA se agrega aquí (depende del encuadre); su sitio ya
             quedó reservado al medir la tarjeta */}
        <Rotulo
          lineas={[...lineasCard, { txt: enc.nota, color: '#8b93a3', sz: 0.74 }]}
          position={[-0.03 * W, D / 2, zA + 0.05 * W]} ancho={anchoCard} ancla="inf-izq" max={72}
        />
        <Leyenda escala={ESC_AGUA} position={[-0.03 * W, D / 2, zB - 0.05 * W]} ancho={anchoLey} ancla="sup-izq" />

        {marca && (
          <mesh position={marca}>
            <sphereGeometry args={[dd.diaMm * 0.55, 18, 18]} />
            <meshBasicMaterial color={ORO} toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** largo del cono de puerto (proporcional al ⌀ de la línea) */
const dia3 = (d: number) => d * 2.2;
