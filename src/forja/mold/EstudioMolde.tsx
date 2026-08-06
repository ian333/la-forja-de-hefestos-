/**
 * EL MOLDE — la pantalla donde el sujeto es LA HERRAMIENTA COMPLETA.
 * ============================================================================
 * "El problema es que me muestras PIEZAS DIFERENTES cuando yo quiero ver EL
 *  MOLDE, jajaja, no piezas individuales." (operador)
 *
 * Y tiene razón. EstudioVivo, EstudioCiclo y las vista3d-* están armadas
 * alrededor de UNA PIEZA con su selector arriba y le pintan la superficie. Esto
 * es una máquina de MOLDES: el entregable es la herramienta. Aquí la pieza baja a
 * PARÁMETRO — un renglón que dice "molde PARA esto" — y el protagonista es el
 * bloque de acero con sus placas, sus tripas y SUS NÚMEROS.
 *
 * CUATRO MANERAS DE MIRAR LA MISMA HERRAMIENTA:
 *   ARMADO   · el bloque cerrado, con color por placa (una máquina, no un diagrama)
 *   DESPIECE · las placas separadas por el eje de apertura, con sus nombres
 *   CORTE    · `vista3d-corte.tsx` IMPORTADA (el plano de sección movible)
 *   ABRIENDO · `vista3d-apertura.tsx` IMPORTADA (la cinemática §11.4 · L6)
 *
 * Y los SUBSISTEMAS se prenden y se apagan: agua · expulsores · colada · insertos
 * · tornillos · el moldeo · las placas. Con "rayos X" el acero se vuelve
 * translúcido y se ve el circuito de agua DENTRO del bloque.
 *
 * REGLAS DE LA CASA QUE ESTE ARCHIVO CUMPLE:
 *  · NO modifica ningún módulo existente: solo IMPORTA.
 *  · Cero `<Text>` de drei dentro del Canvas: los rótulos son sprites de canvas
 *    (`vista3d-rotulo.tsx`) y el resto del texto es overlay DOM.
 *  · Materiales creados con `useMemo` y MUTADOS; nunca inline.
 *  · Lo no medido sale GRIS con su razón. Nunca verde por omisión.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import { parseSTL } from './stl';
import { cajaDe, volumenArea, PIEZAS, type Caja, type MallaSimple } from './estudio-vivo-datos';
import { Rotulo } from './vista3d-rotulo';

import VistaCorte from './vista3d-corte';
import VistaApertura from './vista3d-apertura';

import {
  construirMolde, lecturaDePieza, colorDe, SUBSISTEMAS, MODOS, tituloDelMolde,
  type MoldeArmado, type PiezaMolde, type SubId, type ModoMolde, type Lectura, type Bbox,
} from './estudio-molde-datos';

const ORO = '#c9a227';
const FONDO = '#05070b';
const MONO = "'JetBrains Mono', monospace";
const COL_ESTADO: Record<string, string> = {
  CUMPLE: '#59d98c', ADVIERTE: '#ffb347', VIOLA: '#ff5c5c', 'SIN MEDIR': '#8fa3bd',
};

const cajaCss: React.CSSProperties = {
  background: 'rgba(14,20,30,0.82)', border: '1px solid #223046', borderRadius: 9, padding: '9px 11px',
};
const btn = (on: boolean, ancho?: number): React.CSSProperties => ({
  background: on ? 'rgba(201,162,39,0.16)' : 'rgba(20,28,40,0.8)',
  border: `1px solid ${on ? ORO : '#2a3a52'}`, color: on ? ORO : '#c3d0e0',
  borderRadius: 7, padding: '6px 9px', font: `600 11px ${MONO}`, cursor: 'pointer',
  textAlign: 'left', width: ancho, whiteSpace: 'nowrap',
});

/* ══════════════════════════════════════════════════════════════════════════ */
/* ESCENA                                                                     */
/* ══════════════════════════════════════════════════════════════════════════ */

/** Distancia a la que la caja llena el cuadro (con margen: el visor lleva paneles
 *  encima y un objeto pegado al borde se lee como recortado). */
function distanciaPara(caja: Bbox, camera: THREE.Camera): { d: number; r: number; c: [number, number, number] } {
  const cx = (caja.x0 + caja.x1) / 2, cy = (caja.y0 + caja.y1) / 2, cz = (caja.z0 + caja.z1) / 2;
  const r = 0.5 * Math.hypot(caja.x1 - caja.x0, caja.y1 - caja.y0, caja.z1 - caja.z0) || 100;
  const fov = ((camera as THREE.PerspectiveCamera).fov ?? 36) * Math.PI / 180;
  return { d: (r / Math.tan(fov / 2)) * 1.10, r, c: [cx, cy, cz] };
}

/** Encuadre determinista: la caja objetivo llena el cuadro desde el 3/4 canónico.
 *  Solo se dispara con `sello` (cambio de modo o botón), así orbitar nunca pelea
 *  contra la cámara. */
function Encuadre({ caja, controles, sello }: { caja: Bbox | null; controles: React.RefObject<any>; sello: number }) {
  const { camera } = useThree();
  useEffect(() => {
    if (!caja) return;
    const { d, r, c } = distanciaPara(caja, camera);
    // 3/4 alto: es el ángulo con el que se fotografía una herramienta en catálogo —
    // se leen a la vez el apilado (Z) y la planta (X/Y).
    const dir = [0.60, -0.66, 0.45];
    const n = Math.hypot(dir[0], dir[1], dir[2]);
    camera.up.set(0, 0, 1);
    camera.position.set(c[0] + (d * dir[0]) / n, c[1] + (d * dir[1]) / n, c[2] + (d * dir[2]) / n);
    (camera as THREE.PerspectiveCamera).near = Math.max(0.5, r * 0.008);
    (camera as THREE.PerspectiveCamera).far = r * 80;
    camera.updateProjectionMatrix();
    camera.lookAt(c[0], c[1], c[2]);
    if (controles.current) { controles.current.target.set(c[0], c[1], c[2]); controles.current.update(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sello]);
  return null;
}

/**
 * AJUSTE DE DISTANCIA — el objeto cambia de tamaño (el despiece crece 3×, las
 * vistas importadas viven en OTRAS coordenadas) y la cámara tiene que seguirlo SIN
 * perder el ángulo que el operador eligió con la órbita.
 *
 * En la primera corrida faltaba esto y se vio feo dos veces: en DESPIECE a t=0 el
 * molde quedaba diminuto (la cámara estaba encuadrada al despiece pleno) y en
 * CORTE el molde se salía por la esquina inferior izquierda (esa vista aplica un
 * `desfase` para caer sobre la pieza, así que ni siquiera está donde el bloque).
 */
function AjusteDistancia({ caja, controles }: { caja: Bbox | null; controles: React.RefObject<any> }) {
  const { camera } = useThree();
  const clave = caja ? [caja.x0, caja.y0, caja.z0, caja.x1, caja.y1, caja.z1].map((v) => Math.round(v)).join(',') : '';
  useEffect(() => {
    if (!caja) return;
    const { d, r, c } = distanciaPara(caja, camera);
    const t = controles.current?.target as THREE.Vector3 | undefined;
    const dir = new THREE.Vector3(
      camera.position.x - (t ? t.x : 0), camera.position.y - (t ? t.y : 0), camera.position.z - (t ? t.z : 0),
    );
    if (dir.lengthSq() < 1e-9) dir.set(0.60, -0.66, 0.45);
    dir.normalize();
    camera.position.set(c[0] + dir.x * d, c[1] + dir.y * d, c[2] + dir.z * d);
    (camera as THREE.PerspectiveCamera).near = Math.max(0.5, r * 0.008);
    (camera as THREE.PerspectiveCamera).far = r * 80;
    camera.updateProjectionMatrix();
    if (controles.current) { controles.current.target.set(c[0], c[1], c[2]); controles.current.update(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return null;
}

/** Un componente del molde. Geometría una vez; el material se MUTA (nunca inline). */
function SolidoMolde({ pieza, malla, color, opacidad, dz, onClic }: {
  pieza: PiezaMolde;
  malla: { positions: ArrayLike<number>; indices: ArrayLike<number> };
  color: string; opacidad: number; dz: number;
  onClic: (q: PiezaMolde) => void;
}) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const P = malla.positions instanceof Float32Array ? malla.positions : new Float32Array(malla.positions as ArrayLike<number>);
    const I = malla.indices instanceof Uint32Array ? malla.indices : new Uint32Array(malla.indices as ArrayLike<number>);
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setIndex(new THREE.BufferAttribute(I, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [malla]);
  useEffect(() => () => geom.dispose(), [geom]);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    const acero = pieza.rol === 'placa' || pieza.rol === 'inserto' || pieza.rol === 'componente';
    const transp = opacidad < 0.999;
    mat.color.set(color);
    mat.emissive.set(color);
    mat.emissiveIntensity = transp ? 0.26 : (pieza.rol === 'agua' ? 0.45 : 0.07);
    // METALNESS BAJA A PROPÓSITO: sin environment map, `metalness` alta deja las
    // caras NEGRAS salvo el brillo especular directo — en la primera corrida el
    // molde armado salió como un ladrillo negro-azul. Con 0.3 el color difuso
    // (que es el que codifica CADA placa) sí llega al ojo.
    mat.metalness = acero ? 0.30 : 0.16;
    mat.roughness = pieza.rol === 'agua' ? 0.25 : acero ? 0.50 : 0.62;
    mat.opacity = opacidad;
    mat.transparent = transp;
    mat.depthWrite = !transp;
    mat.needsUpdate = true;
  }, [mat, color, opacidad, pieza.rol]);

  const abajo = useRef<{ x: number; y: number } | null>(null);
  const down = useCallback((e: ThreeEvent<PointerEvent>) => { abajo.current = { x: e.clientX, y: e.clientY }; }, []);
  const up = useCallback((e: ThreeEvent<PointerEvent>) => {
    const a = abajo.current; abajo.current = null;
    // 4 px: el mismo criterio con el que la sonda del corte distingue clic de ÓRBITA.
    // Sin esto cada giro de cámara dejaba una lectura falsa.
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) return;
    e.stopPropagation();
    onClic(pieza);
  }, [onClic, pieza]);

  return (
    <group position={[0, 0, dz]}>
      <mesh geometry={geom} material={mat} renderOrder={opacidad < 0.999 ? 2 : 1} onPointerDown={down} onPointerUp={up} />
    </group>
  );
}

/** LA PARTICIÓN A|B — el molde ABRE aquí (§1.3.2). Una línea dorada alrededor del
 *  bloque: sin ella el stack es una torre de cajas y no se sabe dónde se separa. */
function Particion({ bloque, z }: { bloque: Bbox; z: number }) {
  const geo = useMemo(() => {
    const m = 0.04 * Math.max(bloque.x1 - bloque.x0, bloque.y1 - bloque.y0);
    const x0 = bloque.x0 - m, x1 = bloque.x1 + m, y0 = bloque.y0 - m, y1 = bloque.y1 + m;
    const p = new Float32Array([
      x0, y0, z, x1, y0, z, x1, y0, z, x1, y1, z,
      x1, y1, z, x0, y1, z, x0, y1, z, x0, y0, z,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, [bloque, z]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color(ORO), transparent: true, opacity: 0.9, toneMapped: false, depthTest: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  return <lineSegments geometry={geo} material={mat} renderOrder={12} />;
}

/** El molde como UNA herramienta: todos sus sólidos en su sitio, con el despiece. */
function ElMolde({ molde, despiece, visibles, rayosX, onClic }: {
  molde: MoldeArmado; despiece: number; visibles: Set<SubId>; rayosX: boolean;
  onClic: (q: PiezaMolde) => void;
}) {
  const porId = useMemo(() => new Map(molde.solidos.map((s) => [s.id, s.malla])), [molde]);
  const anchoRot = (molde.bloque.x1 - molde.bloque.x0) * 0.52;
  return (
    <group>
      {molde.piezas.map((q) => {
        if (!visibles.has(q.sub)) return null;
        const malla = porId.get(q.id);
        if (!malla) return null;
        const acero = q.rol === 'placa' || q.rol === 'inserto';
        const op = rayosX ? (acero ? 0.12 : q.rol === 'componente' ? 0.42 : 1) : 1;
        return (
          <SolidoMolde
            key={q.id} pieza={q} malla={malla}
            color={colorDe(q.id, q.rol)} opacidad={op}
            dz={despiece * q.dzPleno} onClic={onClic}
          />
        );
      })}

      <Particion bloque={molde.bloque} z={molde.meta.zPart} />

      {/* NOMBRES: solo cuando el despiece los separa (encimados no rotulan nada).
          Se ALTERNAN de lado (+Y / −Y) por rango: con todos en la misma esquina,
          las piezas del fondo salían amontonadas e ilegibles en la 1ª corrida. */}
      {despiece > 0.02 && molde.piezas.map((q) => {
        if (!visibles.has(q.sub)) return null;
        if (q.rol === 'componente' || q.rol === 'colada') return null;   // finos: el rótulo tapa más de lo que dice
        const zc = (q.bbox.z0 + q.bbox.z1) / 2 + despiece * q.dzPleno;
        const y = q.rango % 2 === 0 ? molde.bloque.y1 : molde.bloque.y0;
        // el agua/moldeo no son ACERO: su "masa" en kg despista (el agua es un
        // barreno, no una pieza). Cada rol dice lo que de verdad lo describe.
        const detalle = q.rol === 'agua'
          ? (q.nota ?? 'circuito §9.2')
          : q.masaKg < 0.1
            ? `${(q.bbox.z1 - q.bbox.z0).toFixed(1)} mm · ${(q.masaKg * 1000).toFixed(0)} g · ${q.material}`
            : `${(q.bbox.z1 - q.bbox.z0).toFixed(1)} mm · ${q.masaKg.toFixed(1)} kg · ${q.material}`;
        return (
          <Rotulo
            key={`rot-${q.id}`}
            lineas={[
              { txt: q.nombre, color: colorDe(q.id, q.rol), peso: 700, sz: 0.95 },
              { txt: detalle, color: '#8fa3bd', sz: 0.72 },
            ]}
            position={[molde.bloque.x1 + anchoRot * 0.10, y, zc]}
            ancho={anchoRot}
            ancla="centro"
            max={54}
          />
        );
      })}
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LA PANTALLA                                                                */
/* ══════════════════════════════════════════════════════════════════════════ */

export default function EstudioMolde({ onClose }: { onClose: () => void }) {
  const [piezaId, setPiezaId] = useState(PIEZAS[0].id);
  const [modo, setModo] = useState<ModoMolde>('armado');
  const [despiece, setDespiece] = useState(0);
  const [tCorte, setTCorte] = useState(0.5);
  const [tApertura, setTApertura] = useState(0);
  const [rayosX, setRayosX] = useState(false);
  const [visibles, setVisibles] = useState<Set<SubId>>(() => new Set(SUBSISTEMAS.map((s) => s.id)));
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [sello, setSello] = useState(0);
  const controles = useRef<any>(null);

  const pieza = PIEZAS.find((p) => p.id === piezaId) ?? PIEZAS[0];

  /* ── LA MALLA (mismo camino y misma guarda del "200 mentiroso" del Estudio) ── */
  const [malla, setMalla] = useState<MallaSimple | null>(null);
  const [cargando, setCargando] = useState('cargando…');
  useEffect(() => {
    let activo = true;
    setMalla(null); setCargando(`cargando ${pieza.nombre}…`); setLectura(null);
    (async () => {
      try {
        const pareceHtml = (b: ArrayBuffer) => {
          const t = new TextDecoder().decode(b.slice(0, 512)).trimStart().toLowerCase();
          return t.startsWith('<!doctype html') || t.startsWith('<html');
        };
        let r = await fetch('/' + pieza.ruta);
        let buf = r.ok ? await r.arrayBuffer() : null;
        if (!buf || pareceHtml(buf)) {
          const r2 = await fetch('/@fs/home/ian/Orkesta/la-forja/' + pieza.ruta);
          if (r2.ok) { const b2 = await r2.arrayBuffer(); if (!pareceHtml(b2)) buf = b2; }
        }
        if (!buf) throw new Error(`HTTP ${r.status} al pedir ${pieza.ruta}`);
        if (pareceHtml(buf)) throw new Error(`${pieza.ruta} NO ESTÁ PUBLICADO: la petición devolvió el index.html, no el STL`);
        const m = parseSTL(buf);
        if (activo) { setMalla(m); setCargando(''); }
      } catch (e) {
        if (activo) setCargando(`⚠ ${String(e).slice(0, 180)}`);
      }
    })();
    return () => { activo = false; };
  }, [pieza.ruta, pieza.nombre]);

  const cajaPieza = useMemo(() => (malla ? cajaDe(malla) : null), [malla]);

  /** El spec que la Máquina de Moldes entiende (mismo que arma EstudioVivo). */
  const spec = useMemo(() => {
    if (!malla || !cajaPieza) return null;
    const va = volumenArea(malla);
    return {
      name: pieza.nombre,
      Lmm: +(cajaPieza.x1 - cajaPieza.x0).toFixed(1),
      Wmm: +(cajaPieza.y1 - cajaPieza.y0).toFixed(1),
      Hmm: +(cajaPieza.z1 - cajaPieza.z0).toFixed(1),
      surfaceMm2: Math.round(va.areaMm2), volumeMm3: Math.round(va.volumeMm3),
      wallMm: 2, plastic: 'ABS', annualVolume: 500_000,
    };
  }, [malla, cajaPieza, pieza.nombre]);

  /* ── EL MOLDE ── */
  const [molde, setMolde] = useState<MoldeArmado | null>(null);
  const [fallo, setFallo] = useState('');
  useEffect(() => {
    if (!malla || !cajaPieza) { setMolde(null); return; }
    let vivo = true;
    setMolde(null); setFallo('');
    const id = window.setTimeout(() => {
      if (!vivo) return;
      try {
        const m = construirMolde(spec, cajaPieza, malla, pieza.nombre);
        if (vivo) { setMolde(m); setSello((s) => s + 1); }
      } catch (e) {
        if (vivo) setFallo(String(e).slice(0, 260));
      }
    }, 20);
    return () => { vivo = false; window.clearTimeout(id); };
  }, [malla, cajaPieza, spec, pieza.nombre]);

  /* ── la caja de las vistas IMPORTADAS (viven en sus propias coordenadas) ── */
  const [cajaCorte, setCajaCorte] = useState<Bbox | null>(null);
  const [aperturaMm, setAperturaMm] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      const vc = (window as any).__vista3dCorte;
      if (vc && vc.cajaMolde) setCajaCorte((c) => (c && c.x0 === vc.cajaMolde.x0 && c.z1 === vc.cajaMolde.z1 ? c : vc.cajaMolde));
      const va = (window as any).__vista3d?.apertura;
      if (va && va.listo) setAperturaMm((a) => (Math.abs(a - (va.recorridoMm ?? 0)) < 0.5 ? a : (va.recorridoMm ?? 0)));
    }, 450);
    return () => window.clearInterval(id);
  }, []);

  /** A qué caja se encuadra en cada modo. Es lo que evita que el DESPIECE se salga
   *  del cuadro (mide ~3× el bloque), que a despiece 0 el molde quede diminuto, o
   *  que las vistas IMPORTADAS —que viven en sus propias coordenadas— se salgan por
   *  una esquina. En despiece la caja INTERPOLA con t (cuantizada a 1/5 para no
   *  recalcular el encuadre en cada frame del arrastre). */
  const cajaObjetivo = useMemo<Bbox | null>(() => {
    if (!molde) return null;
    if (modo === 'despiece') {
      const q = Math.round(despiece * 5) / 5;
      const b = molde.bloque, e = molde.cajaDespiece;
      const mez = (a: number, c: number) => a + (c - a) * q;
      return {
        x0: mez(b.x0, e.x0), y0: mez(b.y0, e.y0), z0: mez(b.z0, e.z0),
        x1: mez(b.x1, e.x1), y1: mez(b.y1, e.y1), z1: mez(b.z1, e.z1),
      };
    }
    if (modo === 'corte') return cajaCorte ?? molde.bloque;
    if (modo === 'abriendo') {
      const b = molde.bloque, a = Math.max(aperturaMm, (b.z1 - b.z0) * 0.6);
      return { ...b, z0: b.z0 - a, z1: b.z1 + a * 0.15 };
    }
    return molde.bloque;
  }, [molde, modo, despiece, cajaCorte, aperturaMm]);

  /* ── SONDA ── */
  const alClic = useCallback((q: PiezaMolde) => {
    if (!molde) return;
    setLectura(lecturaDePieza(molde, q));
  }, [molde]);

  const alternar = useCallback((id: SubId) => {
    setVisibles((v) => { const n = new Set(v); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const soloEste = useCallback((id: SubId) => {
    setVisibles(new Set<SubId>([id]));
    setRayosX(true);
  }, []);

  /* ── TELEMETRÍA para el arnés (el gate lee NÚMEROS, no píxeles) ── */
  useEffect(() => {
    (window as any).__estudioMolde = {
      listo: !!molde, error: fallo || null, cargando: cargando || null,
      pieza: { id: pieza.id, nombre: pieza.nombre, ruta: pieza.ruta },
      modo, despiece, tCorte, tApertura, rayosX,
      subsistemas: [...visibles].sort(),
      numeros: molde ? molde.numeros : null,
      placas: molde ? molde.placas : null,
      piezas: molde ? molde.piezas.map((q) => ({
        id: q.id, nombre: q.nombre, rol: q.rol, sub: q.sub, material: q.material,
        z0: +q.bbox.z0.toFixed(2), z1: +q.bbox.z1.toFixed(2),
        volCc: +(q.volMm3 / 1000).toFixed(1), masaKg: +q.masaKg.toFixed(2),
        rango: q.rango, dzPleno: +q.dzPleno.toFixed(2), nTri: q.nTri,
      })) : null,
      conteos: molde ? molde.conteos : null,
      invariantes: molde ? molde.invariantes : null,
      bloque: molde ? molde.bloque : null,
      cajaDespiece: molde ? molde.cajaDespiece : null,
      cajaObjetivo,
      zPartMm: molde ? +molde.meta.zPart.toFixed(2) : null,
      origen: molde ? molde.origen : null,
      supuesto: molde ? molde.supuesto : null,
      avisos: molde ? molde.avisos : null,
      extensiones: molde ? molde.extensiones : null,
      ms: molde ? molde.ms : null,
      lectura,
    };
  }, [molde, fallo, cargando, pieza, modo, despiece, tCorte, tApertura, rayosX, visibles, lectura, cajaObjetivo]);

  const propsVista = malla && cajaPieza ? { malla, caja: cajaPieza, spec } : null;
  const modoDef = MODOS.find((m) => m.id === modo)!;

  return (
    <div
      data-testid="estudio-molde-view"
      style={{ position: 'fixed', inset: 0, background: FONDO, color: '#e9eef5', fontFamily: MONO, display: 'flex', overflow: 'hidden' }}
    >
      {/* ═══ VISOR ═══ */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }} data-testid="em-visor">
        {propsVista ? (
          <Canvas
            data-testid="em-canvas"
            camera={{ fov: 36, position: [600, -600, 420], up: [0, 0, 1] }}
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 2]}
            onCreated={({ gl }) => { gl.setClearColor(FONDO); (window as any).__emCanvasOk = true; }}
          >
            <ambientLight intensity={0.52} />
            <directionalLight position={[1, -1.4, 2.2]} intensity={1.5} />
            <directionalLight position={[-1.7, 1.2, -0.6]} intensity={0.5} color="#7fa6d8" />
            <directionalLight position={[0.2, 1.6, 0.4]} intensity={0.34} color="#e8c98a" />
            {/* relleno desde abajo: sin él la base del bloque y las tripas del
                housing quedaban en negro y el molde parecía flotar sobre nada */}
            <directionalLight position={[-0.4, -0.5, -1.8]} intensity={0.42} color="#8fa6c4" />
            <Encuadre caja={cajaObjetivo} controles={controles} sello={sello} />
            <AjusteDistancia caja={cajaObjetivo} controles={controles} />

            {molde && (modo === 'armado' || modo === 'despiece') && (
              <ElMolde molde={molde} despiece={modo === 'despiece' ? despiece : 0} visibles={visibles} rayosX={rayosX} onClic={alClic} />
            )}
            {modo === 'corte' && <VistaCorte {...propsVista} t={tCorte} eje="x" />}
            {modo === 'abriendo' && <VistaApertura {...propsVista} t={tApertura} ajuste="ninguno" corte />}

            <OrbitControls ref={controles} makeDefault enableDamping dampingFactor={0.1} />
          </Canvas>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#8fa3bd', font: `600 13px ${MONO}` }}>
            {cargando || 'preparando el molde…'}
          </div>
        )}

        {/* título: EL MOLDE. La pieza va en chico, como parámetro. */}
        <div style={{ position: 'absolute', left: 16, top: 13, pointerEvents: 'none', maxWidth: '72%' }}>
          <div style={{ font: `700 17px ${MONO}`, color: ORO, letterSpacing: 1.2 }}>⚒ EL MOLDE</div>
          <div data-testid="em-subtitulo" style={{ font: `400 11px ${MONO}`, color: '#8fa3bd', marginTop: 3 }}>
            {molde ? tituloDelMolde(molde, pieza.nombre) : (fallo ? `⚠ ${fallo}` : cargando)}
          </div>
          <div style={{ font: `700 10.5px ${MONO}`, color: '#c3d0e0', marginTop: 5 }}>
            {modoDef.icono} {modoDef.nombre} — <span style={{ color: '#8fa3bd', fontWeight: 400 }}>{modoDef.que}</span>
          </div>
        </div>

        {/* MODOS */}
        <div style={{ position: 'absolute', right: 14, top: 13, display: 'flex', gap: 6 }}>
          {MODOS.map((m) => (
            <button
              key={m.id} data-testid={`em-modo-${m.id}`}
              onClick={() => { setModo(m.id); setSello((s) => s + 1); }}
              style={btn(modo === m.id)}
            >
              {m.icono} {m.nombre}
            </button>
          ))}
          <button data-testid="em-encuadrar" onClick={() => setSello((s) => s + 1)} style={btn(false)}>⛶ encuadrar</button>
          <button data-testid="em-cerrar" onClick={onClose} style={btn(false)}>✕</button>
        </div>

        {/* SUBSISTEMAS — solo tienen sentido sobre el molde propio, no sobre las
            vistas importadas (que dibujan su propio mundo). */}
        {(modo === 'armado' || modo === 'despiece') && (
          <div style={{ position: 'absolute', left: 14, top: 96, width: 258, ...cajaCss }} data-testid="em-subsistemas">
            <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 6 }}>SUBSISTEMAS — prende y apaga</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SUBSISTEMAS.map((s) => {
                const c = molde?.conteos.find((x) => x.id === s.id);
                const on = visibles.has(s.id);
                return (
                  <div key={s.id} style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                    <button data-testid={`em-sub-${s.id}`} onClick={() => alternar(s.id)} style={{ ...btn(on), flex: 1 }}>
                      <span style={{ opacity: on ? 1 : 0.45 }}>{s.icono} {s.nombre}</span>
                      <span style={{ float: 'right', color: on ? '#e9eef5' : '#5d6b7e' }}>{c ? `${c.n}` : '—'}</span>
                    </button>
                    <button data-testid={`em-solo-${s.id}`} onClick={() => soloEste(s.id)} title={`solo ${s.nombre}, dentro del bloque transparente`} style={{ ...btn(false), padding: '6px 7px' }}>solo</button>
                  </div>
                );
              })}
            </div>
            <button data-testid="em-todos" onClick={() => { setVisibles(new Set(SUBSISTEMAS.map((x) => x.id))); setRayosX(false); }} style={{ ...btn(false), width: '100%', marginTop: 6, textAlign: 'center' }}>
              todo el molde
            </button>
            <button data-testid="em-rayosx" onClick={() => setRayosX((v) => !v)} style={{ ...btn(rayosX), width: '100%', marginTop: 4, textAlign: 'center' }}>
              {rayosX ? '◍ rayos X: EL ACERO TRANSPARENTE' : '◌ rayos X'}
            </button>
            {molde && (
              <div style={{ font: `400 9.5px ${MONO}`, color: '#8fa3bd', marginTop: 6, lineHeight: 1.45 }}>
                {molde.conteos.find((c) => c.id === 'agua')?.detalle}
              </div>
            )}
          </div>
        )}

        {/* EL CONTROL de cada modo */}
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 13, ...cajaCss }} data-testid="em-control">
          {modo === 'despiece' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ font: `700 11px ${MONO}`, color: ORO, whiteSpace: 'nowrap' }}>despiece</span>
              <input
                data-testid="em-despiece" type="range" min={0} max={1} step={0.005}
                value={despiece} onChange={(e) => setDespiece(+e.target.value)}
                style={{ flex: 1, accentColor: ORO }}
              />
              <span data-testid="em-despiece-v" style={{ font: `700 11px ${MONO}`, color: '#e9eef5', width: 46, textAlign: 'right' }}>{despiece.toFixed(2)}</span>
              <span style={{ font: `400 10px ${MONO}`, color: '#8fa3bd' }}>
                las placas se separan a lo largo del eje de apertura (Z) · a 0 el molde está ARMADO
              </span>
            </div>
          )}
          {modo === 'corte' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ font: `700 11px ${MONO}`, color: ORO, whiteSpace: 'nowrap' }}>posición del corte</span>
              <input
                data-testid="em-corte" type="range" min={0} max={1} step={0.005}
                value={tCorte} onChange={(e) => setTCorte(+e.target.value)}
                style={{ flex: 1, accentColor: ORO }}
              />
              <span style={{ font: `700 11px ${MONO}`, color: '#e9eef5', width: 46, textAlign: 'right' }}>{tCorte.toFixed(2)}</span>
              <span style={{ font: `400 10px ${MONO}`, color: '#8fa3bd' }}>vista3d-corte.tsx IMPORTADA — el mismo molde, cortado</span>
            </div>
          )}
          {modo === 'abriendo' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ font: `700 11px ${MONO}`, color: ORO, whiteSpace: 'nowrap' }}>apertura</span>
              <input
                data-testid="em-apertura" type="range" min={0} max={1} step={0.005}
                value={tApertura} onChange={(e) => setTApertura(+e.target.value)}
                style={{ flex: 1, accentColor: ORO }}
              />
              <span style={{ font: `700 11px ${MONO}`, color: '#e9eef5', width: 46, textAlign: 'right' }}>{tApertura.toFixed(2)}</span>
              <span style={{ font: `400 10px ${MONO}`, color: '#8fa3bd' }}>vista3d-apertura.tsx IMPORTADA — §11.4 · L6</span>
            </div>
          )}
          {modo === 'armado' && (
            <div style={{ font: `400 10.5px ${MONO}`, color: '#8fa3bd' }}>
              La herramienta completa, cerrada. Clic en cualquier componente para saber qué es · la línea dorada es la PARTICIÓN A|B (§1.3.2: el molde abre ahí).
            </div>
          )}
        </div>
      </div>

      {/* ═══ PANEL: LOS NÚMEROS DEL MOLDE ═══ */}
      <div style={{ width: 396, borderLeft: '1px solid #223046', padding: 11, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Numeros molde={molde} />
        <Sonda lectura={lectura} />
        <Aceros molde={molde} />
        <Invariantes molde={molde} />

        {/* LA PIEZA — degradada a parámetro, hasta abajo y en chico */}
        <div style={cajaCss} data-testid="em-pieza">
          <div style={{ font: `700 10.5px ${MONO}`, color: '#8fa3bd', marginBottom: 5 }}>
            molde PARA: <span style={{ color: '#e9eef5' }}>{pieza.nombre}</span> · {molde ? molde.numeros.nCav : '—'} cavidad(es)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {PIEZAS.map((p) => (
              <button key={p.id} data-testid={`em-pieza-${p.id}`} onClick={() => setPiezaId(p.id)} style={{ ...btn(p.id === piezaId), font: `600 10px ${MONO}`, padding: '4px 7px' }}>
                {p.nombre}
              </button>
            ))}
          </div>
          <div style={{ font: `400 9.5px ${MONO}`, color: '#5d6b7e', marginTop: 6, lineHeight: 1.45 }}>
            La pieza es la ENTRADA del molde, no el sujeto de esta pantalla. Cambiarla vuelve a correr la Máquina de Moldes y rearma la herramienta.
          </div>
          {molde?.supuesto && (
            <div style={{ font: `400 9.5px ${MONO}`, color: '#ffb347', marginTop: 5, lineHeight: 1.45 }}>⚠ {molde.supuesto}</div>
          )}
          {molde && (
            <div style={{ font: `400 9.5px ${MONO}`, color: '#5d6b7e', marginTop: 5, lineHeight: 1.45 }}>
              {molde.origen} · armado en {molde.ms} ms
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* PANELES                                                                    */
/* ══════════════════════════════════════════════════════════════════════════ */

const fila = (k: string, v: string, col = '#e9eef5'): React.ReactElement => (
  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, font: `400 10.5px ${MONO}`, color: '#8fa3bd' }}>
    <span>{k}</span><span style={{ color: col, fontWeight: 700, textAlign: 'right' }}>{v}</span>
  </div>
);

function Numeros({ molde }: { molde: MoldeArmado | null }) {
  if (!molde) return <div style={{ ...cajaCss, font: `400 11px ${MONO}`, color: '#8fa3bd' }}>armando el molde…</div>;
  const n = molde.numeros;
  const $ = (x: number | null) => (x == null ? '—' : '$' + x.toLocaleString('en-US'));
  return (
    <div style={cajaCss} data-testid="em-numeros">
      <div style={{ font: `700 11px ${MONO}`, color: ORO, marginBottom: 6 }}>LOS NÚMEROS DEL MOLDE</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {fila('bloque L×W×H', `${n.Lmm} × ${n.Wmm} × ${n.Hmm} mm`)}
        {fila('altura del stack', `${n.stackMm} mm`)}
        {fila('masa (Σ vol×ρ)', `${n.masaAceroKg.toFixed(0)} kg`)}
        {fila('  bloque macizo §12.4', `${n.masaBloqueKg.toFixed(0)} kg`, '#8fa3bd')}
        {n.masaCotizacionKg != null && fila('  mold base cotizado', `${n.masaCotizacionKg.toFixed(0)} kg`, '#8fa3bd')}
        {fila('cavidades', `${n.nCav}`)}
        {fila('arquitectura', n.arquitecturaEs, n.arquitectura ? '#e9eef5' : '#8fa3bd')}
        {fila('costo del molde', $(n.costoMoldeUSD), n.costoMoldeUSD == null ? '#8fa3bd' : '#e9eef5')}
        {fila('precio sugerido', $(n.precioMoldeUSD), n.precioMoldeUSD == null ? '#8fa3bd' : '#59d98c')}
        {fila('costo por pieza', n.costoPiezaUSD == null ? '—' : `$${n.costoPiezaUSD.toFixed(3)}`, n.costoPiezaUSD == null ? '#8fa3bd' : '#e9eef5')}
        {fila('entrega', n.entregaSemanas == null ? '—' : `${n.entregaSemanas} semanas`, n.entregaSemanas == null ? '#8fa3bd' : '#e9eef5')}
        {fila('inyectora', n.maquina ?? '—', n.maquina ? '#e9eef5' : '#8fa3bd')}
      </div>
      {n.sinPaquete && <div style={{ font: `400 9.5px ${MONO}`, color: '#ffb347', marginTop: 6, lineHeight: 1.45 }}>⚠ {n.sinPaquete}</div>}

      <div style={{ font: `700 10.5px ${MONO}`, color: ORO, margin: '9px 0 5px' }}>COMPATIBILIDAD CON LA MÁQUINA §4.3.3</div>
      <div data-testid="em-semaforos" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {n.semaforos.map((s) => (
          <div key={s.id} style={{ borderLeft: `3px solid ${COL_ESTADO[s.estado]}`, paddingLeft: 7 }}>
            <div style={{ font: `700 10px ${MONO}`, color: COL_ESTADO[s.estado] }}>{s.estado} · {s.nombre}</div>
            <div style={{ font: `400 9.5px ${MONO}`, color: '#c3d0e0' }}>{s.medido} vs {s.limite}</div>
            <div style={{ font: `400 9.5px ${MONO}`, color: '#8fa3bd', lineHeight: 1.4 }}>{s.porque} <span style={{ color: ORO }}>{s.seccion}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Aceros({ molde }: { molde: MoldeArmado | null }) {
  if (!molde) return null;
  return (
    <div style={cajaCss} data-testid="em-aceros">
      <div style={{ font: `700 11px ${MONO}`, color: ORO, marginBottom: 6 }}>EL STACK — placa por placa, de arriba hacia abajo</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[...molde.placas].reverse().map((p) => (
          <div key={p.id} style={{ display: 'flex', gap: 6, alignItems: 'center', font: `400 10px ${MONO}` }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, flex: '0 0 auto', background: colorDe(p.id, 'placa'), border: '1px solid #223046' }} />
            <span style={{ flex: 1, color: p.flotante ? '#8fa3bd' : '#e9eef5' }}>
              {p.nombre}{p.flotante ? ' (flota)' : ''}
            </span>
            <span style={{ color: '#c3d0e0', fontWeight: 700 }}>{p.espesor} mm</span>
            <span style={{ color: '#8fa3bd', width: 96, textAlign: 'right' }}>{p.materialNombre}</span>
            <span style={{ color: '#8fa3bd', width: 52, textAlign: 'right' }}>{p.masaKg.toFixed(0)} kg</span>
          </div>
        ))}
      </div>
      <div style={{ font: `400 9.5px ${MONO}`, color: '#5d6b7e', marginTop: 6, lineHeight: 1.45 }}>
        Z de cada placa: `plateStackZ` · espesores y aceros: `plateDefs` (§4.4.4 para la base, el metal del inserto lo elige `selectMetal` por volumen/abrasión). La masa es geométrica: Σ volumen×densidad.
      </div>
    </div>
  );
}

function Sonda({ lectura }: { lectura: Lectura | null }) {
  return (
    <div style={cajaCss} data-testid="em-sonda">
      <div style={{ font: `700 11px ${MONO}`, color: ORO, marginBottom: 5 }}>SONDA — clic en cualquier componente</div>
      {lectura ? (
        <>
          <div style={{ font: `700 12px ${MONO}`, color: '#e9eef5' }}>{lectura.titulo}</div>
          <div style={{ font: `700 11px ${MONO}`, color: '#59d98c', margin: '3px 0 5px' }}>{lectura.valor}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {lectura.cotas.map(([k, v]) => fila(k, v))}
          </div>
          {lectura.nota && <div style={{ font: `400 9.5px ${MONO}`, color: '#8fa3bd', marginTop: 5, lineHeight: 1.45 }}>{lectura.nota}</div>}
          <div style={{ font: `700 10px ${MONO}`, color: ORO, marginTop: 4 }}>{lectura.seccion}</div>
        </>
      ) : (
        <div style={{ font: `400 10.5px ${MONO}`, color: '#8fa3bd' }}>sin lectura todavía — toca una placa, un inserto, el agua o un expulsor</div>
      )}
    </div>
  );
}

function Invariantes({ molde }: { molde: MoldeArmado | null }) {
  if (!molde) return null;
  const malos = molde.invariantes.filter((i) => i.ok === false).length;
  return (
    <div style={cajaCss} data-testid="em-invariantes">
      <div style={{ font: `700 11px ${MONO}`, color: malos ? '#ff5c5c' : ORO, marginBottom: 5 }}>
        INVARIANTES — se MIDEN sobre la geometría {malos ? `· ${malos} REPROBADO(S)` : '· todos pasan'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {molde.invariantes.map((i) => {
          const col = i.ok == null ? '#8fa3bd' : i.ok ? '#59d98c' : '#ff5c5c';
          return (
            <div key={i.id} style={{ borderLeft: `3px solid ${col}`, paddingLeft: 7 }}>
              <div style={{ font: `700 9.5px ${MONO}`, color: col }}>{i.ok == null ? 'SIN MEDIR' : i.ok ? 'PASA' : 'FALLA'} · {i.nombre}</div>
              <div style={{ font: `400 9.5px ${MONO}`, color: '#c3d0e0', lineHeight: 1.4 }}>{i.medido}</div>
              <div style={{ font: `400 9px ${MONO}`, color: '#5d6b7e', lineHeight: 1.4 }}>esperado: {i.esperado}</div>
            </div>
          );
        })}
      </div>
      {molde.extensiones.length > 0 && (
        <div style={{ font: `400 9px ${MONO}`, color: '#8fa3bd', marginTop: 7, lineHeight: 1.45 }}>
          <span style={{ color: '#ffb347', fontWeight: 700 }}>EXTENSIONES DECLARADAS</span> (lo que se modeló con un supuesto que el libro NO da):
          <ul style={{ margin: '3px 0 0 14px', padding: 0 }}>
            {molde.extensiones.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      {molde.avisos.length > 0 && (
        <div style={{ font: `400 9px ${MONO}`, color: '#ffb347', marginTop: 6, lineHeight: 1.45 }}>
          {molde.avisos.map((a, i) => <div key={i}>⚠ {a}</div>)}
        </div>
      )}
    </div>
  );
}
