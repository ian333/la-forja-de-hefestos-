/**
 * EL ESTUDIO VIVO — el análisis del molde EN 3D, girable y consultable a dedo.
 * ============================================================================
 * "Necesito una PANTALLA donde pueda ver el análisis EN TIEMPO REAL y moverme en
 *  3D […] no puedo leer tanto, pero puedo ver en 3D." (operador)
 *
 * Lo que esta pantalla hace y ninguna lámina hace:
 *
 *  · La pieza REAL en 3D con OrbitControls: girar, acercar, encuadrar.
 *  · CAPAS de análisis que colorean la superficie. Los motores YA existen y aquí
 *    solo se REÚSAN (dfm-mesh · visibilidad · flowlen · mold-thermal-fdm): esta
 *    pantalla es PIEL, no física nueva. Si algún día un motor cambia de veredicto,
 *    la pantalla cambia sola.
 *  · MODO SONDA: clic sobre la pieza → el VALOR de la capa activa EN ESE PUNTO, con
 *    unidad y con su § del libro. La imagen y el número dejan de estar separados —
 *    que es justo lo que rompía el criterio en las láminas ("se ve rojo" no es un dato).
 *  · BARRA DE VERIFICACIÓN: la matrícula de la malla (si es incoherente lo dice en
 *    ROJO y avisa que todo lo de abajo se calculó sobre una malla rota), la banda de
 *    error de la capa (o "sin banda" — no se finge precisión) y, para el térmico,
 *    `resuelveLaPared()`: hoy da FALSE (celda ~6 mm vs pared 1.5 mm) y la pantalla lo
 *    DECLARA — lo que se ve es una mezcla, no la pieza.
 *  · FIDUCIAL en la esquina (verificacion/fiducial.ts) para orientarse y para que el
 *    arnés pueda verificar la cámara.
 *
 * ESCALA DE COLOR FIJA (regla dura): los dominios viven en `estudio-vivo-datos.ts`
 * como constantes con su leyenda. Auto-escalar destruiría el criterio de Kazmer
 * (que se juzga CONTANDO contornos). Lo que se sale se satura y la leyenda lo dice.
 *
 * NADA DE `<Text>` de drei aquí: todos los textos son overlay DOM (regla del proyecto;
 * drei/Text dentro de un Canvas con postFX crashea). Este Canvas además NO lleva
 * EffectComposer: la pantalla es un instrumento de medición, no un render de cine.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import { parseSTL } from './stl';
import { dfmFromMesh, type DfmMeshReport } from './dfm-mesh';
import { clasificarVisibilidad, type Visibilidad } from './visibilidad';
import { flowFieldFromMesh } from './revisar-modelo';
import type { FlowField } from './flowlen';
import { moldMachine } from './moldmachine';
import { packageToAssemblySpec } from './mold-plano-set';
import { createThermalSim, type ThermalSim } from './mold-thermal-fdm';
import { matriculaDeMalla, coherente, lineaMatricula, type Matricula, type Coherencia } from '../verificacion/matricula';
import { dibujarFiducial, fiducialPorDefecto, type CamaraOrto } from '../verificacion/fiducial';
import {
  CAPAS, capaDe, cajaDe, voltearMalla, volumenArea, coloresDesde, coloresPlanos,
  huellaDeGrid, piezaAPlaca, muestraColumnaCerca, muestraVox, rampaHex, hexDe,
  num, norm, PIEZAS, SIN_DATO,
  type CapaId, type Caja, type Huella, type MallaSimple,
} from './estudio-vivo-datos';

const ORO = '#c9a227';
const FONDO = '#05070b';
const MONO = "'JetBrains Mono', monospace";

/* ══════════════════════════════════════════════════════════════════════════ */
/* Tipos del estado de cálculo                                                */
/* ══════════════════════════════════════════════════════════════════════════ */

interface Base {
  malla: MallaSimple;
  caja: Caja;
  nTri: number;
  matricula: Matricula;
  coherencia: Coherencia;
  dfm: DfmMeshReport;
  volumeMm3: number;
  areaMm2: number;
  ms: number;
}

interface DatosVisible { tipo: 'visible'; vis: Visibilidad; ms: number }
interface DatosFlujo { tipo: 'flujo'; campo: FlowField; ms: number }
interface DatosTermico {
  tipo: 'termico'; sim: ThermalSim; huella: Huella | null;
  pared: { ok: boolean; celdaMm: number; paredMinMm: number; paredMaxMm: number; razon: string };
  ms: number;
}
type DatosCapa = DatosVisible | DatosFlujo | DatosTermico;

type EstadoCapa =
  | { e: 'calculando' }
  | { e: 'lista'; d: DatosCapa }
  | { e: 'error'; razon: string };

/** las capas que salen del raster ya calculado están listas desde el primer frame */
const LISTA_DEL_RASTER = { e: 'lista', d: null as unknown as DatosCapa } as const;

interface Lectura {
  capa: CapaId; etiqueta: string; valor: number; texto: string; unidad: string;
  seccion: string; nota: string; punto: [number, number, number]; color: string;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* La escena                                                                  */
/* ══════════════════════════════════════════════════════════════════════════ */

/** Encuadra la cámara a la caja de la pieza. Determinista: mismo bbox ⇒ misma vista
 *  (el arnés compara capturas entre corridas, así que no puede haber azar aquí). */
function Encuadre({ caja, controles }: { caja: Caja; controles: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  useEffect(() => {
    const cx = (caja.x0 + caja.x1) / 2, cy = (caja.y0 + caja.y1) / 2, cz = (caja.z0 + caja.z1) / 2;
    const r = Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0, caja.z1 - caja.z0) || 50;
    camera.up.set(0, 0, 1);                       // Z ARRIBA: la dirección de apertura del molde
    camera.position.set(cx + r * 1.15, cy - r * 1.35, cz + r * 1.05);
    camera.near = r / 100; camera.far = r * 60;
    camera.updateProjectionMatrix();
    camera.lookAt(cx, cy, cz);
    if (controles.current) { controles.current.target.set(cx, cy, cz); controles.current.update(); }
  }, [caja, camera, controles]);
  return null;
}

/** Vigila la dirección de la cámara para el fiducial 2D. Solo avisa cuando el giro
 *  supera ~1.5°, para no re-renderizar el panel en cada frame. */
function VigilaCamara({ onDir }: { onDir: (d: [number, number, number]) => void }) {
  const ultimo = useRef<[number, number, number]>([0, 0, 0]);
  const v = useRef(new THREE.Vector3());
  useFrame(({ camera, controls }) => {
    const t = (controls as any)?.target as THREE.Vector3 | undefined;
    v.current.set(
      (t ? t.x : 0) - camera.position.x,
      (t ? t.y : 0) - camera.position.y,
      (t ? t.z : 0) - camera.position.z,
    ).normalize();
    const d = ultimo.current;
    const cos = v.current.x * d[0] + v.current.y * d[1] + v.current.z * d[2];
    if (cos > 0.9997) return;
    ultimo.current = [v.current.x, v.current.y, v.current.z];
    onDir(ultimo.current);
  });
  return null;
}

/**
 * La pieza. La geometría se construye UNA vez por malla y el color se muta en su
 * atributo (needsUpdate) — cambiar de capa NO reconstruye la malla, por eso el
 * cambio se ve al instante.
 *
 * El clic de SONDA se distingue del arrastre de órbita midiendo el desplazamiento
 * del puntero entre down y up: sin eso, cada giro de cámara disparaba una lectura.
 */
function Pieza({
  malla, colores, sondaOn, onSonda, marca,
}: {
  malla: MallaSimple; colores: Float32Array; sondaOn: boolean;
  onSonda: (p: THREE.Vector3, tri: number) => void;
  marca: [number, number, number] | null;
}) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = malla.positions instanceof Float32Array ? malla.positions : new Float32Array(malla.positions);
    const idx = malla.indices instanceof Uint32Array ? malla.indices : new Uint32Array(malla.indices);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [malla]);
  useEffect(() => () => geom.dispose(), [geom]);
  useEffect(() => {
    const a = geom.getAttribute('color') as THREE.BufferAttribute;
    if (!a || a.array.length !== colores.length) return;
    (a.array as Float32Array).set(colores);
    a.needsUpdate = true;
  }, [geom, colores]);

  const abajo = useRef<{ x: number; y: number } | null>(null);
  const down = useCallback((e: ThreeEvent<PointerEvent>) => { abajo.current = { x: e.clientX, y: e.clientY }; }, []);
  const up = useCallback((e: ThreeEvent<PointerEvent>) => {
    const a = abajo.current; abajo.current = null;
    if (!sondaOn || !a) return;
    if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) return;   // fue un arrastre de órbita
    e.stopPropagation();
    onSonda(e.point.clone(), e.faceIndex ?? -1);
  }, [sondaOn, onSonda]);

  const r = geom.boundingSphere ? geom.boundingSphere.radius : 50;
  return (
    <group>
      <mesh geometry={geom} onPointerDown={down} onPointerUp={up}>
        <meshStandardMaterial vertexColors flatShading roughness={0.62} metalness={0.06} side={THREE.DoubleSide} />
      </mesh>
      {marca && (
        <group position={marca}>
          <mesh>
            <sphereGeometry args={[r * 0.022, 20, 20]} />
            <meshBasicMaterial color={ORO} />
          </mesh>
          <mesh>
            <sphereGeometry args={[r * 0.05, 20, 20]} />
            <meshBasicMaterial color={ORO} transparent opacity={0.22} depthTest={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* El panel                                                                   */
/* ══════════════════════════════════════════════════════════════════════════ */

const caja: React.CSSProperties = {
  background: 'rgba(14,20,30,0.82)', border: '1px solid #223046', borderRadius: 9, padding: '9px 11px',
};
const btn = (on: boolean): React.CSSProperties => ({
  background: on ? 'rgba(201,162,39,0.16)' : 'rgba(20,28,40,0.8)',
  border: `1px solid ${on ? ORO : '#2a3a52'}`, color: on ? ORO : '#c3d0e0',
  borderRadius: 7, padding: '6px 9px', font: `600 11px ${MONO}`, cursor: 'pointer', textAlign: 'left',
});

export default function EstudioVivo({ onClose }: { onClose: () => void }) {
  /* ── parámetros VIVOS (cambiarlos recalcula y se ve al momento) ── */
  const [piezaId, setPiezaId] = useState(PIEZAS[0].id);
  const [voltear, setVoltear] = useState(false);
  const [paredMm, setParedMm] = useState(0);           // 0 = derivar del raster
  const [capa, setCapa] = useState<CapaId>('espesor');
  const [resVis, setResVis] = useState(256);
  const [voxFlujo, setVoxFlujo] = useState(60_000);
  const [celdaTerm, setCeldaTerm] = useState(6);
  const [sondaOn, setSondaOn] = useState(true);

  /* ── malla ── */
  const [cruda, setCruda] = useState<MallaSimple | null>(null);
  const [cargando, setCargando] = useState<string>('');
  const [fallo, setFallo] = useState<string>('');

  const pieza = PIEZAS.find((p) => p.id === piezaId) ?? PIEZAS[0];

  useEffect(() => {
    let vivo = true;
    setCruda(null); setFallo(''); setCargando(`cargando ${pieza.nombre}…`);
    (async () => {
      try {
        // ⚠ EL 200 MENTIROSO. nginx sirve la app con `try_files $uri $uri/ /index.html`,
        // así que un archivo QUE NO EXISTE devuelve **200 con el index.html** en vez de
        // 404. Con `r.ok` a secas el respaldo nunca se dispara y el parser recibe HTML,
        // reportando "STL ilegible" — cierto pero engañoso: el archivo no está publicado.
        // Ya nos costó caro una vez (los .mp4 de la biblioteca daban 206 y nadie lo vio
        // en meses). Por eso aquí se verifica el CONTENIDO, no el código de estado.
        const pareceHtml = (b: ArrayBuffer) => {
          const t = new TextDecoder().decode(b.slice(0, 512)).trimStart().toLowerCase();
          return t.startsWith('<!doctype html') || t.startsWith('<html');
        };
        // dev sirve la raíz del repo; /@fs es el respaldo (mismo path en laptop e iangpu)
        let r = await fetch('/' + pieza.ruta);
        let buf = r.ok ? await r.arrayBuffer() : null;
        if (!buf || pareceHtml(buf)) {
          const r2 = await fetch('/@fs/home/ian/Orkesta/la-forja/' + pieza.ruta);
          if (r2.ok) { const b2 = await r2.arrayBuffer(); if (!pareceHtml(b2)) buf = b2; }
        }
        if (!buf) throw new Error(`HTTP ${r.status} al pedir ${pieza.ruta}`);
        if (pareceHtml(buf)) {
          throw new Error(`${pieza.ruta} NO ESTÁ PUBLICADO en este servidor: la petición `
            + `devolvió el index.html (el "200 mentiroso" de try_files), no el STL. `
            + `Los STL del banco se publican desde public/test-parts/.`);
        }
        const m = parseSTL(buf);
        if (vivo) { setCruda(m); setCargando(''); }
      } catch (e) {
        if (vivo) { setFallo(String(e).slice(0, 200)); setCargando(''); }
      }
    })();
    return () => { vivo = false; };
  }, [pieza.ruta, pieza.nombre]);

  const malla = useMemo(() => (cruda ? (voltear ? voltearMalla(cruda) : cruda) : null), [cruda, voltear]);
  // la caja del ENCUADRE depende SOLO de la malla: así, cambiar la pared nominal
  // recalcula los números sin sacudir la cámara que el operador ya acomodó.
  const cajaVista = useMemo(() => (malla ? cajaDe(malla) : null), [malla]);

  /* ── BASE: matrícula + raster de dfm. Es rápido (~60 ms en el banco) así que va
       síncrono; si algún día una malla lo vuelve lento, se mueve al mismo motor
       asíncrono de las capas de abajo. ── */
  const base: Base | { error: string } | null = useMemo(() => {
    if (!malla) return null;
    const t0 = performance.now();
    try {
      const mat = matriculaDeMalla({ positions: malla.positions, indices: malla.indices });
      const coh = coherente(mat);
      const dfm = dfmFromMesh(malla, paredMm > 0 ? { wallMm: paredMm } : {});
      const va = volumenArea(malla);
      return {
        malla, caja: cajaDe(malla), nTri: Math.floor(malla.indices.length / 3),
        matricula: mat, coherencia: coh, dfm,
        volumeMm3: va.volumeMm3, areaMm2: va.areaMm2, ms: Math.round(performance.now() - t0),
      };
    } catch (e) { return { error: String(e).slice(0, 220) }; }
  }, [malla, paredMm]);

  const baseOk = base && !('error' in base) ? base : null;

  /* ── CAPAS PESADAS (visible · flujo · térmico): motor asíncrono con cache.
       Se pinta "calculando" ANTES de bloquear (un rAF + un tick), que es la regla:
       si tarda, se avisa; congelar sin avisar está prohibido. ── */
  const [cache, setCache] = useState<Record<string, EstadoCapa>>({});
  // el cache se LEE por ref dentro del efecto: si entrara en las dependencias, el
  // propio `setCache({calculando})` re-dispararía el efecto, su cleanup mataría el
  // timer recién puesto y la capa se quedaría en ⏳ para siempre (deadlock clásico).
  const cacheRef = useRef(cache); cacheRef.current = cache;
  const clave = useMemo(() => {
    const extra = capa === 'visible' ? resVis : capa === 'flujo' ? voxFlujo : capa === 'termico' ? celdaTerm : 0;
    return `${piezaId}|${voltear ? 'V' : 'N'}|${paredMm}|${capa}|${extra}`;
  }, [piezaId, voltear, paredMm, capa, resVis, voxFlujo, celdaTerm]);

  useEffect(() => {
    if (!baseOk) return;
    if (capa === 'forma' || capa === 'espesor' || capa === 'draft') return;   // salen del raster ya hecho
    if (cacheRef.current[clave]) return;
    let vivo = true;
    setCache((c) => ({ ...c, [clave]: { e: 'calculando' } }));
    const id = window.setTimeout(() => {
      if (!vivo) return;
      const t0 = performance.now();
      try {
        let d: DatosCapa;
        if (capa === 'visible') {
          d = { tipo: 'visible', vis: clasificarVisibilidad(baseOk.malla, { res: resVis }), ms: 0 };
        } else if (capa === 'flujo') {
          const campo = flowFieldFromMesh(baseOk.malla, {
            wallMm: baseOk.dfm.wall.p50Mm || undefined,
            expectVolumeMm3: baseOk.volumeMm3, maxVoxels: voxFlujo,
          });
          d = { tipo: 'flujo', campo, ms: 0 };
        } else {
          const c = baseOk.caja;
          const spec = {
            name: pieza.nombre,
            Lmm: +(c.x1 - c.x0).toFixed(1), Wmm: +(c.y1 - c.y0).toFixed(1), Hmm: +(c.z1 - c.z0).toFixed(1),
            surfaceMm2: Math.round(baseOk.areaMm2), volumeMm3: Math.round(baseOk.volumeMm3),
            wallMm: paredMm > 0 ? paredMm : (baseOk.dfm.wall.p50Mm || 2),
            plastic: 'ABS', annualVolume: 500_000,
            projectedAreaMm2: baseOk.dfm.projectedAreaMm2,
            warpageTopology: baseOk.dfm.warpageTopology,
          } as any;
          const asm = packageToAssemblySpec(moldMachine(spec));
          const sim = createThermalSim(asm, {
            partMesh: {
              positions: baseOk.malla.positions instanceof Float32Array ? baseOk.malla.positions : new Float32Array(baseOk.malla.positions),
              indices: baseOk.malla.indices instanceof Uint32Array ? baseOk.malla.indices : new Uint32Array(baseOk.malla.indices),
            },
            cell: celdaTerm,
          });
          const pared = (sim as any).resuelveLaPared();
          sim.warmUp(6);            // §9.1: el molde de producción NO opera frío
          sim.computeSteady();      // campo cíclico-promedio con k variable
          d = { tipo: 'termico', sim, huella: huellaDeGrid(sim.thGrid), pared, ms: 0 };
        }
        (d as any).ms = Math.round(performance.now() - t0);
        if (vivo) setCache((c2) => ({ ...c2, [clave]: { e: 'lista', d } }));
      } catch (e) {
        if (vivo) setCache((c2) => ({ ...c2, [clave]: { e: 'error', razon: String(e).slice(0, 220) } }));
      }
    }, 50);
    return () => { vivo = false; window.clearTimeout(id); };
  }, [clave, baseOk, capa, resVis, voxFlujo, celdaTerm, paredMm, pieza.nombre]);

  // identidad ESTABLE (constante de módulo) para las capas que ya salen del raster:
  // un objeto nuevo por render volvería a repintar los ~80k vértices en cada frame.
  const estadoCapa: EstadoCapa | null = useMemo(() => (
    capa === 'forma' || capa === 'espesor' || capa === 'draft'
      ? (baseOk ? LISTA_DEL_RASTER : null)
      : (cache[clave] ?? null)
  ), [capa, baseOk, cache, clave]);
  const datos = estadoCapa && estadoCapa.e === 'lista' ? estadoCapa.d : null;
  const def = capaDe(capa);

  /* ── COLORES: el corazón de la pantalla. Una función de valor por vértice y la
       rampa FIJA del dominio de la capa. Gris = no medido, siempre. ── */
  const pintura = useMemo(() => {
    if (!baseOk) return null;
    const P = baseOk.malla.positions;
    const nV = Math.floor(P.length / 3);
    if (capa === 'forma' || !estadoCapa || estadoCapa.e !== 'lista') {
      return { colores: coloresPlanos(nV, [0.42, 0.47, 0.55]), nSinDato: 0, nBajo: 0, nAlto: 0 };
    }
    if (capa === 'espesor') {
      const m = baseOk.dfm.thickMap;
      return coloresDesde(nV, def.dom, (v) => muestraColumnaCerca(m, m.thick, P[v * 3], P[v * 3 + 1], 'max').v);
    }
    if (capa === 'draft') {
      const m = baseOk.dfm.draftMap;
      return coloresDesde(nV, def.dom, (v) => muestraColumnaCerca(m, m.deg, P[v * 3], P[v * 3 + 1], 'min').v);
    }
    if (capa === 'visible' && datos && datos.tipo === 'visible') {
      const f = datos.vis.fracMaxTri;
      // la malla del STL es sopa: 3 vértices por triángulo ⇒ color POR CARA exacto
      return coloresDesde(nV, def.dom, (v) => f[Math.floor(v / 3)] ?? NaN);
    }
    if (capa === 'flujo' && datos && datos.tipo === 'flujo') {
      const f = datos.campo;
      return coloresDesde(nV, def.dom, (v) => muestraVox(f, f.flowLenMm, P[v * 3], P[v * 3 + 1], P[v * 3 + 2], { agrega: 'min' }).v);
    }
    if (capa === 'termico' && datos && datos.tipo === 'termico') {
      const { sim, huella } = datos;
      if (!huella) return coloresDesde(nV, def.dom, () => NaN);
      const c = baseOk.caja;
      return coloresDesde(nV, def.dom, (v) => {
        const q = piezaAPlaca(huella, c, P[v * 3], P[v * 3 + 1]);
        const t = sim.plasticTempAt(q.x, q.y);
        return Number.isFinite(t) ? t : NaN;
      });
    }
    return { colores: coloresPlanos(nV, [0.42, 0.47, 0.55]), nSinDato: 0, nBajo: 0, nAlto: 0 };
  }, [baseOk, capa, datos, estadoCapa, def.dom]);

  /* ── SONDA ── */
  const [lectura, setLectura] = useState<Lectura | null>(null);
  useEffect(() => { setLectura(null); }, [piezaId, voltear, capa]);

  const sondar = useCallback((p: THREE.Vector3, tri: number) => {
    if (!baseOk) return;
    const punto: [number, number, number] = [p.x, p.y, p.z];
    const armar = (etiqueta: string, valor: number, texto: string, nota: string): Lectura => ({
      capa, etiqueta, valor, texto, unidad: def.unidad, seccion: def.seccion, nota, punto,
      color: Number.isFinite(valor) ? rampaHex(norm(valor, def.dom)) : hexDe(SIN_DATO),
    });
    if (capa === 'forma') {
      setLectura(armar('posición', NaN, `x ${num(p.x, 1)} · y ${num(p.y, 1)} · z ${num(p.z, 1)} mm`,
        `triángulo #${tri} de ${baseOk.nTri}. Sin capa activa no hay valor que leer — prende una capa.`));
      return;
    }
    if (capa === 'espesor') {
      const m = baseOk.dfm.thickMap;
      const r = muestraColumnaCerca(m, m.thick, p.x, p.y, 'max');
      const nominal = paredMm > 0 ? paredMm : baseOk.dfm.wall.p50Mm;
      setLectura(armar('espesor de pared', r.v, Number.isFinite(r.v) ? `${num(r.v, 2)} mm` : 'sin dato',
        Number.isFinite(r.v)
          ? `${num(r.v / (nominal || 1), 2)}× la pared nominal (${num(nominal, 2)} mm). ${r.anillo > 0 ? `columna vecina a ${r.anillo} celda(s) de ${num(m.sx, 2)} mm — el vértice cae en el borde del raster. ` : ''}Kazmer §2.3.1: "extreme differences … internal voids may be formed".`
          : `${def.porqueGris}`));
      return;
    }
    if (capa === 'draft') {
      const m = baseOk.dfm.draftMap;
      const r = muestraColumnaCerca(m, m.deg, p.x, p.y, 'min');
      setLectura(armar('ángulo de salida', r.v, Number.isFinite(r.v) ? `${num(r.v, 2)}°` : 'sin dato',
        Number.isFinite(r.v)
          ? `mínimo del libro ${m.minDeg}° · Tabla 2.14 pide ${m.tableDeg}° · ${r.v < m.minDeg ? 'POR DEBAJO DEL MÍNIMO: se raya al expulsar' : r.v < m.tableDeg ? 'cumple el mínimo pero NO la tabla del acabado' : 'cumple'}`
          : `${def.porqueGris}`));
      return;
    }
    if (capa === 'visible' && datos && datos.tipo === 'visible') {
      const f = datos.vis.fracMaxTri[tri];
      const pv = datos.vis.puntoVisible(punto);
      setLectura(armar('área visible del triángulo', f, Number.isFinite(f) ? `${num(f * 100, 1)} %` : 'sin dato',
        `el z-buffer dice ${pv.visible ? 'VISIBLE' : 'OCULTO'}${pv.vistas.length ? ` desde: ${pv.vistas.join(', ')}` : ''}. §7.1.3: la compuerta y los expulsores van en superficie NO visible.`));
      return;
    }
    if (capa === 'flujo' && datos && datos.tipo === 'flujo') {
      const f = datos.campo;
      const r = muestraVox(f, f.flowLenMm, p.x, p.y, p.z, { agrega: 'min' });
      // el espesor local: MÁXIMO del anillo y el 0 NO cuenta (un vóxel de acero trae
      // thickness = 0, un número finito y falso que fabricaba un L/t sin sentido)
      const h = muestraVox(f, f.thicknessMm, p.x, p.y, p.z, { agrega: 'max', ceroEsVacio: true });
      const razon = Number.isFinite(h.v) && h.v > 0
        ? `L/t = ${num(r.v / h.v, 0)} con espesor local ${num(h.v, 2)} mm`
        : 'L/t SIN DATO: el campo no trae espesor de pared en ese vóxel (la celda no lo resolvió)';
      setLectura(armar('longitud de flujo', r.v, Number.isFinite(r.v) ? `${num(r.v, 1)} mm` : 'sin dato',
        Number.isFinite(r.v)
          ? `${razon} · L máxima de la pieza ${num(f.maxFlowLenMm, 1)} mm · celda ${num(f.cellMm, 2)} mm`
          : `${def.porqueGris}`));
      return;
    }
    if (capa === 'termico' && datos && datos.tipo === 'termico') {
      const { sim, huella, pared } = datos;
      if (!huella) { setLectura(armar('temperatura', NaN, 'sin dato', 'el grid térmico no trae huella de cavidad')); return; }
      const q = piezaAPlaca(huella, baseOk.caja, p.x, p.y);
      const t = sim.plasticTempAt(q.x, q.y);
      setLectura(armar('T del plástico', t, Number.isFinite(t) ? `${num(t, 1)} °C` : 'sin dato',
        `${sim.material.esProxy ? `⚠ datos PRESTADOS de ${sim.material.datosDe} — la resina de la pieza es ${sim.material.resina}. ` : ''}${pared.ok ? '' : `⚠ la celda (${num(pared.celdaMm, 1)} mm) NO resuelve la pared (${num(pared.paredMinMm, 2)} mm): ESTE NÚMERO ES DE UNA MEZCLA plástico/acero. `}placa (${num(q.x, 1)}, ${num(q.y, 1)}) mm · §9.1`));
      return;
    }
    setLectura(armar('sin capa lista', NaN, 'sin dato', 'la capa activa todavía está calculando'));
  }, [baseOk, capa, datos, def, paredMm]);

  /* ── FIDUCIAL 2D (indicativo) ── */
  const [camDir, setCamDir] = useState<[number, number, number]>([-0.6, 0.62, -0.5]);
  const fidSvg = useMemo(() => {
    try {
      const f = fiducialPorDefecto(40);
      const cam: CamaraOrto = { nombre: 'estudio', dir: camDir, arriba: [0, 0, 1], k: 1.15, cx: 78, cy: 80, mira: [0, 0, 0] };
      return dibujarFiducial(f, cam, { grosor: 1.6, opacidad: 0.96, rotulo: 0.6 });
    } catch { return ''; }
  }, [camDir]);

  /* ── API para el arnés (el gate lee números, no píxeles) ── */
  useEffect(() => {
    (window as any).__estudioVivo = {
      pieza: pieza.nombre, capa, voltear, paredMm,
      estado: estadoCapa ? estadoCapa.e : 'sin-malla',
      nTri: baseOk?.nTri ?? 0,
      matricula: baseOk ? lineaMatricula(baseOk.matricula) : null,
      coherente: baseOk ? baseOk.coherencia.ok : null,
      dom: def.dom, unidad: def.unidad, seccion: def.seccion,
      sinDatoPct: pintura && baseOk ? +(100 * pintura.nSinDato / Math.max(1, Math.floor(baseOk.malla.positions.length / 3))).toFixed(1) : null,
      lectura: lectura ? { etiqueta: lectura.etiqueta, valor: lectura.valor, texto: lectura.texto, punto: lectura.punto } : null,
      resuelveLaPared: datos && datos.tipo === 'termico' ? datos.pared : null,
      camDir,
    };
  }, [pieza.nombre, capa, voltear, paredMm, estadoCapa, baseOk, def, pintura, lectura, datos, camDir]);

  /* ── verificación ── */
  const controles = useRef<any>(null);
  const coh = baseOk?.coherencia;
  const mallaRota = !!coh && !coh.ok;

  const bandaCapa: { txt: string; mal: boolean } = (() => {
    if (capa === 'forma') return { txt: 'la capa FORMA no mide nada: no hay banda que declarar', mal: false };
    if (capa === 'termico') {
      if (!datos || datos.tipo !== 'termico') return { txt: 'sin banda (el campo aún no está)', mal: false };
      if (!datos.pared.ok) return { txt: `SIN BANDA — ${datos.pared.razon}. Lo que ves es una MEZCLA plástico/acero, no la pieza.`, mal: true };
      return { txt: `la rejilla resuelve la pared (celda ${num(datos.pared.celdaMm, 1)} mm ≤ pared ${num(datos.pared.paredMinMm, 2)} mm): el sdf 3D aplica`, mal: false };
    }
    if (capa === 'flujo' && datos && datos.tipo === 'flujo' && datos.campo.warnings.length) {
      return { txt: `SIN BANDA — ${datos.campo.warnings[0]}`, mal: true };
    }
    return { txt: def.banda ?? 'sin banda', mal: !def.banda };
  })();

  /* ══════════════════════════════════════════════════════════════════════ */
  const anchoPanel = 372;
  return (
    <div
      data-testid="estudio-vivo-view"
      style={{
        position: 'fixed', inset: 0, zIndex: 93, background: FONDO, color: '#e9eef5',
        fontFamily: MONO, display: 'flex', overflow: 'hidden',
      }}
    >
      {/* ─────────── VISOR 3D ─────────── */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }} data-testid="ev-visor">
        {baseOk && pintura && cajaVista ? (
          <Canvas
            data-testid="ev-canvas"
            // up = +Z ANTES de que exista OrbitControls: el molde abre en Z y los
            // controles fijan su marco al construirse (si se cambia después, orbitan
            // alrededor del eje equivocado y la pieza "se acuesta" al girar).
            camera={{ fov: 38, position: [120, -120, 90], up: [0, 0, 1] }}
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 2]}
            onCreated={({ gl }) => { gl.setClearColor(FONDO); (window as any).__estudioVivoCanvasOk = true; }}
          >
            <ambientLight intensity={0.55} />
            <directionalLight position={[1, -1.4, 2.2]} intensity={1.55} />
            <directionalLight position={[-1.6, 1.1, -0.7]} intensity={0.55} color="#7fa6d8" />
            <Encuadre caja={cajaVista} controles={controles} />
            <VigilaCamara onDir={setCamDir} />
            <Pieza
              malla={baseOk.malla}
              colores={pintura.colores}
              sondaOn={sondaOn}
              onSonda={sondar}
              marca={lectura ? lectura.punto : null}
            />
            <OrbitControls ref={controles} makeDefault enableDamping dampingFactor={0.11} />
          </Canvas>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#8fa3bd', font: `600 13px ${MONO}` }}>
            {fallo ? `⚠ ${fallo}` : (cargando || 'preparando…')}
          </div>
        )}

        {/* título + estado de cálculo (overlay DOM, nunca drei/Text) */}
        <div style={{ position: 'absolute', left: 16, top: 14, pointerEvents: 'none' }}>
          <div style={{ font: `700 15px ${MONO}`, color: ORO, letterSpacing: 0.5 }}>EL ESTUDIO VIVO</div>
          <div style={{ font: `400 11px ${MONO}`, color: '#8fa3bd', marginTop: 3 }}>
            {pieza.nombre} · {baseOk ? `${baseOk.nTri.toLocaleString('es-MX')} triángulos` : '—'} · capa {def.nombre}
            {voltear ? ' · VOLTEADA π/X' : ''}
          </div>
          {estadoCapa && estadoCapa.e === 'calculando' && (
            <div data-testid="ev-calculando" style={{ marginTop: 7, font: `700 11px ${MONO}`, color: '#ffb347' }}>
              ⏳ calculando {def.nombre.toLowerCase()}… (la vista sigue girando)
            </div>
          )}
          {estadoCapa && estadoCapa.e === 'error' && (
            <div data-testid="ev-capa-error" style={{ marginTop: 7, font: `700 11px ${MONO}`, color: '#ff5c5c', maxWidth: 520 }}>
              ✗ esta capa NO se pudo calcular: {estadoCapa.razon}
            </div>
          )}
        </div>

        {/* LEYENDA de escala FIJA */}
        {capa !== 'forma' && (
          <div data-testid="ev-leyenda" style={{ ...caja, position: 'absolute', left: 16, bottom: 16, width: 268 }}>
            <div style={{ font: `700 10.5px ${MONO}`, color: ORO }}>
              ESCALA FIJA · {def.nombre} [{def.unidad}]
            </div>
            <div style={{ font: `400 9.5px ${MONO}`, color: '#8fa3bd', margin: '3px 0 7px' }}>
              dominio {def.dom[0]}–{def.dom[1]} {def.unidad} — CONSTANTE: no se ajusta a la pieza (si se ajustara,
              dos piezas distintas se verían igual y el conteo de contornos dejaría de significar algo)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                width: 17, borderRadius: 4, border: '1px solid #2a3a52',
                background: `linear-gradient(to top, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => `${rampaHex(t)} ${t * 100}%`).join(', ')})`,
              }}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between', minHeight: 92 }}>
                {def.marcas.map((m) => (
                  <div key={m.et} style={{ display: 'flex', alignItems: 'center', gap: 5, font: `${m.dura ? 700 : 400} 9.5px ${MONO}`, color: m.dura ? '#e9eef5' : '#8fa3bd' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: rampaHex(norm(m.v, def.dom)), display: 'inline-block', flex: '0 0 auto' }} />
                    <span>{m.et}{m.dura ? ' ◂ umbral' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* CUÁL EXTREMO ES EL RIESGO. Sin esto el rojo se lee siempre como "malo",
                y en DRAFT el rojo es lo BUENO (mucho ángulo): leer la rampa al revés
                es peor que no verla. */}
            <div data-testid="ev-riesgo" style={{ marginTop: 6, font: `700 9.5px/1.35 ${MONO}`, color: def.altoEsRiesgo ? '#e0714f' : '#5a9fd4' }}>
              RIESGO = el extremo {def.altoEsRiesgo ? 'ROJO (más alto)' : 'AZUL (más bajo)'}
              <span style={{ color: '#8fa3bd', fontWeight: 400 }}>
                {def.altoEsRiesgo ? ' — lo alto es lo que duele' : ' — poco ángulo = se raya al expulsar'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, font: `400 9.5px/1.35 ${MONO}`, color: '#8fa3bd' }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: hexDe(SIN_DATO), display: 'inline-block', flex: '0 0 auto' }} />
              <span>gris = NO MEDIDO ({def.porqueGris})</span>
            </div>
            {def.advertencia && (
              <div data-testid="ev-advertencia" style={{ marginTop: 6, paddingTop: 5, borderTop: '1px solid #223046', font: `400 9px/1.38 ${MONO}`, color: '#ffb347' }}>
                {def.advertencia}
              </div>
            )}
            {pintura && (
              <div style={{ marginTop: 4, font: `400 9.5px ${MONO}`, color: '#6f7f95' }}>
                {(() => {
                  const n = Math.max(1, Math.floor(baseOk!.malla.positions.length / 3));
                  return `sin dato ${num(100 * pintura.nSinDato / n, 1)} % · saturado arriba ${num(100 * pintura.nAlto / n, 1)} % · abajo ${num(100 * pintura.nBajo / n, 1)} % de los vértices`;
                })()}
              </div>
            )}
          </div>
        )}

        {/* FIDUCIAL */}
        <div data-testid="ev-fiducial" style={{ ...caja, position: 'absolute', right: 16, top: 14, width: 168, padding: '7px 8px' }}>
          <div style={{ font: `700 9.5px ${MONO}`, color: ORO }}>FIDUCIAL · orientación</div>
          <svg width={156} height={150} viewBox="0 0 156 150" style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: fidSvg }} />
          <div style={{ font: `400 8.5px/1.32 ${MONO}`, color: '#8fa3bd' }}>
            triada+cubo+esfera de <code style={{ color: '#c3d0e0' }}>verificacion/fiducial.ts</code>. Dibujo ORTOGRÁFICO
            sobre una vista en PERSPECTIVA ⇒ <b style={{ color: '#ffb347' }}>INDICATIVO</b> (da la dirección, no la
            escala). +Z = dirección de apertura.
          </div>
          <div style={{ font: `400 8.5px ${MONO}`, color: '#6f7f95', marginTop: 3 }}>
            mirada ({num(camDir[0], 2)}, {num(camDir[1], 2)}, {num(camDir[2], 2)})
          </div>
        </div>

        {/* SONDA */}
        <div data-testid="ev-sonda" style={{ ...caja, position: 'absolute', right: 16, bottom: 16, width: 330 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ font: `700 10.5px ${MONO}`, color: ORO }}>MODO SONDA</div>
            <button data-testid="ev-sonda-toggle" onClick={() => setSondaOn((s) => !s)} style={btn(sondaOn)}>
              {sondaOn ? '● activa' : '○ apagada'}
            </button>
          </div>
          {lectura ? (
            <div style={{ marginTop: 7 }}>
              <div style={{ font: `400 9.5px ${MONO}`, color: '#8fa3bd' }}>{lectura.etiqueta}</div>
              <div
                data-testid="ev-sonda-valor"
                style={{ font: `700 ${lectura.texto.length > 13 ? 17 : 26}px/1.14 ${MONO}`, color: lectura.color }}
              >
                {lectura.texto}
              </div>
              {lectura.seccion !== '—' && (
                <div style={{ font: `700 9.5px ${MONO}`, color: ORO, marginTop: 2 }}>Kazmer {lectura.seccion}</div>
              )}
              <div data-testid="ev-sonda-nota" style={{ font: `400 9.5px/1.38 ${MONO}`, color: '#c3d0e0', marginTop: 4 }}>
                {lectura.nota}
              </div>
              <div style={{ font: `400 9px ${MONO}`, color: '#6f7f95', marginTop: 4 }}>
                punto ({num(lectura.punto[0], 1)}, {num(lectura.punto[1], 1)}, {num(lectura.punto[2], 1)}) mm de la pieza
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 7, font: `400 10px/1.4 ${MONO}`, color: '#8fa3bd' }}>
              Haz CLIC sobre la pieza y aquí sale el valor de la capa activa EN ESE PUNTO, con unidad y con su §
              del libro. Arrastrar gira la cámara y no dispara lectura.
            </div>
          )}
        </div>
      </div>

      {/* ─────────── PANEL ─────────── */}
      <div style={{
        width: anchoPanel, flex: `0 0 ${anchoPanel}px`, borderLeft: '1px solid #1b2536',
        background: 'rgba(8,12,19,0.96)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 13px', borderBottom: '1px solid #1b2536' }}>
          <div style={{ font: `700 12px ${MONO}`, color: ORO }}>ANÁLISIS EN VIVO</div>
          <button data-testid="ev-cerrar" onClick={onClose} style={btn(false)}>✕ cerrar</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {/* BARRA DE VERIFICACIÓN — lo primero, porque manda sobre todo lo de abajo */}
          <div
            data-testid="ev-verificacion"
            style={{
              ...caja,
              borderColor: mallaRota ? '#ff5c5c' : '#223046',
              background: mallaRota ? 'rgba(60,14,18,0.55)' : 'rgba(14,20,30,0.82)',
            }}
          >
            <div style={{ font: `700 10.5px ${MONO}`, color: mallaRota ? '#ff5c5c' : ORO }}>
              VERIFICACIÓN {mallaRota ? '· ⚠ MALLA INCOHERENTE' : '· malla coherente'}
            </div>
            {baseOk ? (
              <>
                <div data-testid="ev-matricula" style={{ font: `400 9.5px/1.4 ${MONO}`, color: '#c3d0e0', marginTop: 5, wordBreak: 'break-all' }}>
                  {lineaMatricula(baseOk.matricula)}
                </div>
                <div style={{ font: `${mallaRota ? 700 : 400} 9.5px ${MONO}`, color: mallaRota ? '#ff5c5c' : '#59d98c', marginTop: 4 }}>
                  {mallaRota ? '✗ ' : '✓ '}{baseOk.coherencia.resumen}
                </div>
                {mallaRota && (
                  <div style={{ font: `700 9.5px/1.4 ${MONO}`, color: '#ff5c5c', marginTop: 4 }}>
                    TODO LO DE ABAJO SE CALCULÓ SOBRE UNA MALLA ROTA. Los colores y los números de la sonda no son
                    evidencia hasta que la malla se arregle.
                    {baseOk.coherencia.problemas.slice(0, 3).map((p) => (
                      <div key={p.codigo} style={{ font: `400 9px ${MONO}`, color: '#ffb3b3', marginTop: 2 }}>· {p.codigo}: {p.detalle}</div>
                    ))}
                  </div>
                )}
                <div style={{ borderTop: '1px solid #223046', marginTop: 7, paddingTop: 6 }}>
                  <div style={{ font: `700 9.5px ${MONO}`, color: '#8fa3bd' }}>BANDA DE ERROR · capa {def.nombre}</div>
                  <div data-testid="ev-banda" style={{ font: `${bandaCapa.mal ? 700 : 400} 9.5px/1.4 ${MONO}`, color: bandaCapa.mal ? '#ffb347' : '#c3d0e0', marginTop: 3 }}>
                    {bandaCapa.txt}
                  </div>
                </div>
                {datos && datos.tipo === 'termico' && (
                  <div
                    data-testid="ev-resuelve-pared"
                    style={{
                      marginTop: 7, padding: '6px 8px', borderRadius: 6,
                      border: `1px solid ${datos.pared.ok ? '#2a6b45' : '#ff5c5c'}`,
                      background: datos.pared.ok ? 'rgba(20,50,34,0.4)' : 'rgba(60,14,18,0.5)',
                      font: `700 9.5px/1.4 ${MONO}`, color: datos.pared.ok ? '#59d98c' : '#ff5c5c'
                    }}
                  >
                    {datos.pared.ok ? '✓ LA REJILLA RESUELVE LA PARED' : '✗ LA REJILLA NO RESUELVE LA PARED'}
                    <div style={{ font: `400 9px ${MONO}`, color: datos.pared.ok ? '#a9d9bd' : '#ffb3b3', marginTop: 2 }}>
                      celda {num(datos.pared.celdaMm, 2)} mm · pared mín {num(datos.pared.paredMinMm, 2)} mm · máx {num(datos.pared.paredMaxMm, 2)} mm
                    </div>
                    <div style={{ font: `400 9px ${MONO}`, color: datos.pared.ok ? '#a9d9bd' : '#ffb3b3', marginTop: 2 }}>
                      {datos.pared.razon}
                    </div>
                    {!datos.pared.ok && (
                      <div style={{ font: `700 9px ${MONO}`, color: '#ff9a9a', marginTop: 3 }}>
                        ⇒ el color del térmico es una MEZCLA plástico/acero, no la pieza. Baja la celda para que quepa
                        en la pared (cuesta tiempo: la PDE crece con 1/celda³).
                      </div>
                    )}
                  </div>
                )}
                {datos && datos.tipo === 'termico' && datos.sim.material.esProxy && (
                  <div style={{ marginTop: 5, font: `700 9px ${MONO}`, color: '#ffb347' }}>
                    ⚠ resina {datos.sim.material.resina} corriendo con datos de {datos.sim.material.datosDe}
                  </div>
                )}
              </>
            ) : (
              <div style={{ font: `400 9.5px ${MONO}`, color: '#8fa3bd', marginTop: 5 }}>
                {base && 'error' in base ? `✗ ${base.error}` : (fallo || cargando || 'sin malla')}
              </div>
            )}
          </div>

          {/* CAPAS */}
          <div style={caja}>
            <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 6 }}>CAPAS DE ANÁLISIS</div>
            <div style={{ display: 'grid', gap: 5 }}>
              {CAPAS.map((c) => {
                const on = c.id === capa;
                const st = c.id === capa ? estadoCapa : null;
                return (
                  <button
                    key={c.id}
                    data-testid={`ev-capa-${c.id}`}
                    onClick={() => setCapa(c.id)}
                    style={{ ...btn(on), display: 'block', width: '100%' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>{c.icono} {c.nombre}</span>
                      <span style={{ color: '#6f7f95', font: `400 9px ${MONO}` }}>
                        {st && st.e === 'calculando' ? '⏳' : st && st.e === 'error' ? '✗' : c.seccion}
                      </span>
                    </div>
                    {on && (
                      <div style={{ font: `400 9px/1.35 ${MONO}`, color: '#8fa3bd', marginTop: 3 }}>
                        {c.que}
                        <div style={{ color: '#6f7f95', marginTop: 2 }}>motor: {c.motor}</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PARÁMETROS VIVOS */}
          <div style={caja}>
            <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 6 }}>PARÁMETROS (recalculan al momento)</div>

            <div style={{ font: `400 9.5px ${MONO}`, color: '#8fa3bd', marginBottom: 3 }}>pieza del banco</div>
            <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
              {PIEZAS.map((p) => (
                <button key={p.id} data-testid={`ev-pieza-${p.id}`} onClick={() => setPiezaId(p.id)} style={{ ...btn(p.id === piezaId), width: '100%' }}>
                  {p.nombre}
                  {p.id === piezaId && <div style={{ font: `400 9px ${MONO}`, color: '#8fa3bd', marginTop: 2 }}>{p.nota}</div>}
                </button>
              ))}
            </div>

            <button data-testid="ev-voltear" onClick={() => setVoltear((v) => !v)} style={{ ...btn(voltear), width: '100%', marginBottom: 8 }}>
              {voltear ? '● VOLTEADA π sobre X' : '○ voltear pieza (π sobre X)'}
              <div style={{ font: `400 9px/1.35 ${MONO}`, color: '#8fa3bd', marginTop: 2 }}>
                cambia la dirección de apertura efectiva ⇒ el espesor, el draft y los undercuts se vuelven a medir.
                {baseOk && ` El raster ${baseOk.dfm.orient.flipRecommended ? 'RECOMIENDA voltear' : 'no pide voltear'} (relieve de núcleo ${num(baseOk.dfm.orient.coreReliefAsIsMm, 1)} vs ${num(baseOk.dfm.orient.coreReliefFlippedMm, 1)} mm/col · §11).`}
              </div>
            </button>

            <label style={{ display: 'block', font: `400 9.5px ${MONO}`, color: '#8fa3bd', marginBottom: 3 }}>
              pared nominal declarada — 0 = derivar del raster
            </label>
            <input
              data-testid="ev-pared"
              type="number" step="0.1" min="0" max="12" value={paredMm}
              onChange={(e) => setParedMm(Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
              style={{ width: '100%', background: '#0d1420', border: '1px solid #2a3a52', color: '#e9eef5', borderRadius: 6, padding: '5px 7px', font: `600 11px ${MONO}`, marginBottom: 3 }}
            />
            {baseOk && (
              <div style={{ font: `400 9px ${MONO}`, color: '#6f7f95', marginBottom: 8 }}>
                medida: p50 {num(baseOk.dfm.wall.p50Mm, 2)} · p95 {num(baseOk.dfm.wall.p95Mm, 2)} mm (razón {num(baseOk.dfm.wall.ratio, 2)}×)
              </div>
            )}

            {capa === 'visible' && (
              <Selector
                testid="ev-res-vis" etiqueta="resolución del z-buffer (px por lado)"
                opciones={[128, 256, 512]} valor={resVis} onChange={setResVis}
                nota="más resolución = borde más fino en la fracción visible; el costo es cuadrático"
              />
            )}
            {capa === 'flujo' && (
              <Selector
                testid="ev-vox-flujo" etiqueta="techo de vóxeles del campo"
                opciones={[30_000, 60_000, 150_000]} valor={voxFlujo} onChange={setVoxFlujo}
                nota="la celda sale de este techo; si no cabe en la pared, el propio campo lo avisa arriba"
              />
            )}
            {capa === 'termico' && (
              <Selector
                testid="ev-celda-term" etiqueta="celda del FDM (mm)"
                opciones={[4, 6, 9]} valor={celdaTerm} onChange={setCeldaTerm}
                nota="bájala para que resuelva la pared; el costo crece como 1/celda³ (y arriba se declara si NO la resuelve)"
              />
            )}
          </div>

          {/* NÚMEROS DE LA CAPA */}
          {baseOk && (
            <div style={caja} data-testid="ev-resumen">
              <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 5 }}>NÚMEROS DE ESTA PIEZA</div>
              <Fila k="volumen" v={`${num(baseOk.volumeMm3 / 1000, 2)} cc`} />
              <Fila k="área" v={`${num(baseOk.areaMm2 / 100, 1)} cm²`} />
              <Fila k="caja" v={`${num(baseOk.caja.x1 - baseOk.caja.x0, 1)} × ${num(baseOk.caja.y1 - baseOk.caja.y0, 1)} × ${num(baseOk.caja.z1 - baseOk.caja.z0, 1)} mm`} />
              <Fila k="área proyectada" v={`${num(baseOk.dfm.projectedAreaMm2 / 100, 1)} cm²`} />
              <Fila k="moldeable §2.3.7" v={baseOk.dfm.moldable} mal={baseOk.dfm.moldable === 'no'} />
              <Fila k="draft < 0.5° §2.3.6" v={`${num(baseOk.dfm.draft.pctBelowMin, 1)} % del área lateral`} mal={baseOk.dfm.draft.pctBelowMin > 5} />
              <Fila k="undercut §2.3.7" v={`${num(baseOk.dfm.undercut.columnsPct, 1)} % de columnas · ${baseOk.dfm.undercut.regions} región(es)`} mal={baseOk.dfm.undercut.enclosedVoids} />
              <Fila k="topología §10.3.1" v={baseOk.dfm.warpageTopology.tipo} />
              {datos && datos.tipo === 'visible' && (
                <Fila k="área visible §7.1.3" v={`${num(100 * datos.vis.areaVisibleMm2 / Math.max(1, datos.vis.areaTotalMm2), 1)} % (oculta por sí misma ${num(datos.vis.areaOcultaPorSiMismaMm2 / 100, 1)} cm²)`} />
              )}
              {datos && datos.tipo === 'flujo' && (
                <>
                  <Fila k="L máx §5.5.5" v={`${num(datos.campo.maxFlowLenMm, 1)} mm · celda ${num(datos.campo.cellMm, 2)} mm`} />
                  <Fila k="vóxeles sin llenar" v={`${datos.campo.unreachable}`} mal={datos.campo.unreachable > 0} />
                </>
              )}
              {datos && datos.tipo === 'termico' && (
                <>
                  <Fila k="acero §9.2" v={`${num(datos.sim.minC, 1)} – ${num(datos.sim.maxC, 1)} °C`} />
                  <Fila k="ciclo" v={`${num(datos.sim.cycleS, 1)} s · refrigerante ${num(datos.sim.coolantC, 0)} °C`} />
                </>
              )}
              <div style={{ font: `400 9px ${MONO}`, color: '#6f7f95', marginTop: 5 }}>
                raster + matrícula {baseOk.ms} ms{datos ? ` · capa ${(datos as any).ms} ms` : ''}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Fila({ k, v, mal }: { k: string; v: string; mal?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, font: `400 9.5px ${MONO}`, color: '#8fa3bd', padding: '2px 0' }}>
      <span>{k}</span>
      <span style={{ color: mal ? '#ff5c5c' : '#e9eef5', font: `600 9.5px ${MONO}`, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

function Selector({
  testid, etiqueta, opciones, valor, onChange, nota,
}: {
  testid: string; etiqueta: string; opciones: number[]; valor: number;
  onChange: (v: number) => void; nota: string;
}) {
  return (
    <div data-testid={testid}>
      <div style={{ font: `400 9.5px ${MONO}`, color: '#8fa3bd', marginBottom: 3 }}>{etiqueta}</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {opciones.map((o) => (
          <button key={o} data-testid={`${testid}-${o}`} onClick={() => onChange(o)} style={{ ...btn(o === valor), flex: 1, textAlign: 'center' }}>
            {o >= 1000 ? `${o / 1000}k` : o}
          </button>
        ))}
      </div>
      <div style={{ font: `400 9px/1.35 ${MONO}`, color: '#6f7f95', marginTop: 3 }}>{nota}</div>
    </div>
  );
}
