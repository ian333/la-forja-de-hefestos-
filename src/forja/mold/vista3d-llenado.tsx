/**
 * EL FRENTE LLENA — vista 3D ANIMADA para EL ESTUDIO VIVO (§5.5.4 · lámina L14).
 * ============================================================================
 * La lámina L14 pinta las isócronas en planta y son ESTÁTICAS. Aquí el plástico ENTRA:
 * el slider `t` es el tiempo de llenado normalizado y el hueco se va llenando DESDE LA
 * COMPUERTA, con el mismo campo que ya calcula `flowlen.ts` — sin física nueva.
 *
 * LO QUE EMERGE (no se dibuja a gusto, sale del campo):
 *  · el ORDEN de llenado es por RESISTENCIA, no por cercanía (§5.5.5): una pared gruesa
 *    lejana se llena ANTES que una delgada cercana. Eso es el race tracking, y se ve.
 *  · las LÍNEAS DE SOLDADURA aparecen (en blanco) cuando llega el SEGUNDO frente al
 *    lugar donde el fundido rodeó un núcleo y se reencontró (`computeWeldMask`).
 *  · las TRAMPAS DE GAS (rojo) se marcan donde el frente CIERRA en el INTERIOR de la
 *    huella — §5.5.4: ahí el venteo de la partición no llega y el aire se quema. Las
 *    que cierran en el borde salen en ámbar: son venteables, no son el mismo defecto.
 *
 * EL INVARIANTE, POR CONSTRUCCIÓN Y MEDIDO: el llenado es el PREFIJO de un arreglo de
 * vóxeles ordenado por resistencia ⇒ subir `t` solo puede AÑADIR vóxeles. El volumen
 * llenado no puede bajar. Aun así `serieLlenado()` lo mide y el arnés lo comprueba
 * barriendo el slider de verdad.
 *
 * ESCALA DE COLOR FIJA: el color de cada vóxel es el % de llenado al que ese punto se
 * llena, dominio [0,1] CONSTANTE (la leyenda va como overlay DOM: `LeyendaLlenado`).
 * Regla dura del Estudio — auto-escalar borraría el criterio de comparar dos piezas.
 *
 * PURO EN `t`: sin `useFrame`, sin reloj, sin azar. Mismo t ⇒ mismo frame.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';

import {
  construirLlenado, estadoLlenado, lecturaLlenado, lecturaPunto, serieLlenado,
  MARCAS_LLENADO, COLOR_SOLDADURA, COLOR_TRAMPA_GAS, COLOR_VENTEABLE, COLOR_COMPUERTA,
  type EscenaLlenado,
} from './vista3d-llenado-datos';
import { rampaHex, type Caja, type MallaSimple } from './estudio-vivo-datos';

export const META = {
  id: 'llenado' as const,
  nombre: 'EL FRENTE LLENA',
  icono: '≈',
  seccion: '§5.5.4 · L14',
  control: { etiqueta: 'tiempo de llenado', min: 0, max: 1, paso: 0.005, inicial: 0 },
  reproducible: true,
};

export interface PropsVista3D {
  malla: MallaSimple;
  caja: Caja;
  spec: any | null;
  /** 0..1 — tiempo de llenado normalizado (= fracción de volumen inyectada, §5.4) */
  t: number;
  onLectura?: (l: { titulo: string; valor: string; nota?: string; seccion: string }) => void;
  /** OPCIONALES (el contrato no los exige) */
  maxVoxels?: number;
  paredMm?: number;
  onEscena?: (e: EscenaLlenado | null) => void;
}

const CACHE = new Map<string, EscenaLlenado>();

/** clave estable de la malla SIN hashear millones de floats: tamaño + caja + una
 *  muestra determinista de vértices. Dos mallas distintas con la misma caja y las
 *  mismas 24 muestras no existen en este banco. */
function claveMalla(m: MallaSimple, caja: Caja, extra: string): string {
  const P = m.positions;
  const n = P.length;
  let s = '';
  for (let k = 0; k < 24; k++) {
    const i = Math.floor((k / 24) * (n / 3)) * 3;
    s += (P[i] ?? 0).toFixed(2) + ',' + (P[i + 1] ?? 0).toFixed(2) + ',' + (P[i + 2] ?? 0).toFixed(2) + ';';
  }
  return `${n}|${m.indices.length}|${caja.x0.toFixed(2)},${caja.y0.toFixed(2)},${caja.z0.toFixed(2)},${caja.x1.toFixed(2)},${caja.y1.toFixed(2)},${caja.z1.toFixed(2)}|${s}|${extra}`;
}

export default function Vista(p: PropsVista3D) {
  const { malla, caja, t, onLectura } = p;
  const maxVox = p.maxVoxels ?? 160_000;
  const clave = useMemo(() => claveMalla(malla, caja, `${maxVox}|${p.paredMm ?? ''}`), [malla, caja, maxVox, p.paredMm]);

  /* ── construcción DIFERIDA (voxelizar + Dijkstra + venteos cuesta segundos) ── */
  const [esc, setEsc] = useState<EscenaLlenado | null>(() => CACHE.get(clave) ?? null);
  const [fallo, setFallo] = useState('');
  useEffect(() => {
    const hit = CACHE.get(clave);
    if (hit) { setEsc(hit); setFallo(''); return; }
    setEsc(null); setFallo('');
    let vivo = true;
    const id = window.setTimeout(() => {
      if (!vivo) return;
      try {
        const e = construirLlenado(malla, { maxVoxels: maxVox, wallMm: p.paredMm });
        CACHE.set(clave, e);
        if (vivo) setEsc(e);
      } catch (err) {
        if (vivo) setFallo(String(err).slice(0, 220));
      }
    }, 30);
    return () => { vivo = false; window.clearTimeout(id); };
  }, [clave, malla, maxVox, p.paredMm]);

  useEffect(() => { p.onEscena?.(esc); }, [esc]);   // eslint-disable-line react-hooks/exhaustive-deps

  const paso = META.control.paso;
  const tq = Math.round(Math.max(0, Math.min(1, t)) / paso) * paso;
  const st = useMemo(() => (esc ? estadoLlenado(esc, tq) : null), [esc, tq]);
  const serie = useMemo(() => (esc ? serieLlenado(esc, 41) : null), [esc]);

  /* ── EL PLÁSTICO: un InstancedMesh de vóxeles ORDENADOS por resistencia. Llenar =
       subir `count`. Es una asignación por frame y hace la monotonía IMPOSIBLE de
       romper: t solo puede añadir vóxeles al prefijo, nunca quitarlos de en medio. ── */
  const plastico = useMemo(() => {
    if (!esc || !esc.n) return null;
    const g = new THREE.BoxGeometry(esc.cellMm, esc.cellMm, esc.cellMm);
    const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, vertexColors: false });
    const im = new THREE.InstancedMesh(g, m, esc.n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const mat4 = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let s = 0; s < esc.n; s++) {
      mat4.makeTranslation(esc.xyz[s * 3], esc.xyz[s * 3 + 1], esc.xyz[s * 3 + 2]);
      im.setMatrixAt(s, mat4);
      col.setRGB(esc.colores[s * 3], esc.colores[s * 3 + 1], esc.colores[s * 3 + 2]);
      im.setColorAt(s, col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    // LA ESFERA ENVOLVENTE SE CALCULA CON EL COUNT COMPLETO, ANTES de vaciarlo.
    // `InstancedMesh.raycast` la calcula perezosamente la PRIMERA vez y la CACHEA: si
    // ese primer rayo cae con `count = 0`, la esfera queda de radio 0 en el origen y la
    // malla se vuelve INSONDABLE para siempre. Es un cache envenenado, y no se nota
    // hasta que el clic de sonda no devuelve nada.
    im.computeBoundingSphere();
    im.count = 0;
    im.frustumCulled = false;
    return im;
  }, [esc]);
  useEffect(() => () => { plastico?.geometry.dispose(); (plastico?.material as THREE.Material)?.dispose(); }, [plastico]);
  useEffect(() => { if (plastico && st) plastico.count = st.nLlenos; }, [plastico, st]);

  /* ── LAS SOLDADURAS: mismo truco, ordenadas por el instante en que se forman ── */
  const soldaduras = useMemo(() => {
    if (!esc || !esc.nWeld) return null;
    const s = esc.cellMm * 1.34;                      // sobresalen: si no, quedan enterradas
    const g = new THREE.BoxGeometry(s, s, s);
    const m = new THREE.MeshStandardMaterial({
      color: COLOR_SOLDADURA, emissive: COLOR_SOLDADURA, emissiveIntensity: 0.55,
      roughness: 0.3, metalness: 0,
    });
    const im = new THREE.InstancedMesh(g, m, esc.nWeld);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const mat4 = new THREE.Matrix4();
    for (let i = 0; i < esc.nWeld; i++) {
      mat4.makeTranslation(esc.weldXyz[i * 3], esc.weldXyz[i * 3 + 1], esc.weldXyz[i * 3 + 2]);
      im.setMatrixAt(i, mat4);
    }
    im.instanceMatrix.needsUpdate = true;
    im.count = 0;
    im.frustumCulled = false;
    im.renderOrder = 2;
    return im;
  }, [esc]);
  useEffect(() => () => { soldaduras?.geometry.dispose(); (soldaduras?.material as THREE.Material)?.dispose(); }, [soldaduras]);
  useEffect(() => { if (soldaduras && st) soldaduras.count = st.nSoldaduras; }, [soldaduras, st]);

  /* ── EL FANTASMA: la superficie de la pieza, para ver el hueco que FALTA por llenar ── */
  const fantasma = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = malla.positions instanceof Float32Array ? malla.positions : new Float32Array(malla.positions);
    const idx = malla.indices instanceof Uint32Array ? malla.indices : new Uint32Array(malla.indices);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [malla]);
  useEffect(() => () => fantasma.dispose(), [fantasma]);

  /* ── SONDA sobre el plástico: e.instanceId ES el índice del arreglo ordenado ── */
  const [sonda, setSonda] = useState<{ titulo: string; valor: string; nota?: string } | null>(null);
  const [nClics, setNClics] = useState(0);
  const abajo = useRef<{ x: number; y: number } | null>(null);
  const down = useCallback((e: ThreeEvent<PointerEvent>) => {
    setNClics((n) => n + 1);
    abajo.current = { x: e.clientX, y: e.clientY };
  }, []);
  /** vóxel más cercano a un punto (mm). 2e4 puntos: un barrido lineal por clic es nada,
   *  y hace que la sonda funcione TAMBIÉN al picar el fantasma o una soldadura — el
   *  operador pica LA PIEZA, no un InstancedMesh. */
  const masCercano = useCallback((x: number, y: number, z: number): number => {
    if (!esc) return -1;
    let mejor = -1, d2 = Infinity;
    for (let i = 0; i < esc.n; i++) {
      const dx = esc.xyz[i * 3] - x, dy = esc.xyz[i * 3 + 1] - y, dz = esc.xyz[i * 3 + 2] - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < d2) { d2 = d; mejor = i; }
    }
    return mejor;
  }, [esc]);
  const up = useCallback((e: ThreeEvent<PointerEvent>) => {
    const a = abajo.current; abajo.current = null;
    if (!a || !esc || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) return;   // fue órbita
    const id = (e as any).instanceId ?? masCercano(e.point.x, e.point.y, e.point.z);
    if (id == null || id < 0) return;
    e.stopPropagation();
    const l = lecturaPunto(esc, id);
    setSonda({ titulo: l.titulo, valor: l.valor, nota: l.nota });
  }, [esc, masCercano]);

  /* ── LECTURA + API del arnés ──
     `onLectura` va por REF a propósito: si entrara en las dependencias y el Estudio
     pasara una lambda sin memoizar (lo normal), sería efecto → setState del padre →
     callback nueva → efecto… bucle infinito. La vista se protege sola. */
  const cbLectura = useRef(onLectura);
  cbLectura.current = onLectura;
  useEffect(() => {
    const onLectura = cbLectura.current;
    if (!onLectura) return;
    if (fallo) { onLectura({ titulo: 'EL FRENTE LLENA', valor: '⚠ el campo de flujo no se pudo calcular', nota: fallo, seccion: META.seccion }); return; }
    if (!esc || !st) { onLectura({ titulo: 'EL FRENTE LLENA', valor: 'voxelizando el hueco y midiendo la longitud de flujo…', nota: 'flowlen: Dijkstra por RESISTENCIA (§5.5.5), no por distancia', seccion: META.seccion }); return; }
    const l = lecturaLlenado(esc, st);
    onLectura({ ...l, nota: [l.nota, sonda ? `${sonda.titulo}: ${sonda.valor} — ${sonda.nota ?? ''}` : null].filter(Boolean).join(' · ') });
  }, [esc, st, fallo, sonda]);

  useEffect(() => {
    const w = window as any;
    w.__vista3d = w.__vista3d || {};
    w.__vista3d.llenado = esc && st && serie ? {
      listo: true, t: st.t, pct: st.pct,
      volumenMm3: st.volumenMm3, volumenTotalMm3: esc.volumenMm3,
      nLlenos: st.nLlenos, nVox: esc.n, cellMm: +esc.cellMm.toFixed(3),
      lenMaxMm: st.lenMaxMm, maxFlowLenMm: esc.maxFlowLenMm,
      resistenciaFrente: st.resistenciaFrente,
      nSoldaduras: st.nSoldaduras, nSoldadurasTotal: esc.nWeld,
      trampasAlcanzadas: st.trampasAlcanzadas, trampasTotal: st.trampasTotal,
      venteos: esc.venteos.length,
      gate: esc.gate,
      monotona: serie.monotona, fallaMonotonia: serie.falla, cierraEnTotal: serie.cierraEnTotal,
      serieVol: serie.vol,
      msConstruccion: esc.ms,
      avisos: esc.avisos, notas: esc.notas,
      sonda: sonda ? sonda.valor : null,
      // diagnóstico del arnés: si esto es 0, el clic ni siquiera llegó a la escena
      // (problema de eventos); si es > 0 y `sonda` es null, el problema es el picking
      clicsRecibidos: nClics,
    } : { listo: false, fallo: fallo || null };
    return () => { if (w.__vista3d) w.__vista3d.llenado = { listo: false }; };
  }, [esc, st, serie, fallo, sonda, nClics]);

  /* ── ESCENA ── */
  if (fallo) return <group />;
  if (!esc || !st) {
    return (
      <group userData={{ vista: 'llenado-esperando' }}>
        <mesh geometry={fantasma} renderOrder={3}>
          <meshStandardMaterial color="#6f88a8" transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }

  const rMarca = Math.max(esc.cellMm * 1.1, 0.010 * Math.max(
    esc.caja.x1 - esc.caja.x0, esc.caja.y1 - esc.caja.y0, esc.caja.z1 - esc.caja.z0,
  ));

  return (
    <group>
      {/* TODO LO SONDEABLE en un grupo con manejadores: el fantasma (la pieza entera),
          el plástico y las soldaduras. Dos razones, las dos medidas:
          · los manejadores en el `<primitive>` del InstancedMesh NO producían lectura;
            en el GRUPO sí, porque R3F interseca los objetos interactivos en modo
            RECURSIVO y así el evento llega con su `instanceId`.
          · picando el FANTASMA (la pared que aún no se llena) también se obtiene
            lectura: se resuelve al vóxel más cercano. El operador pica la PIEZA. */}
      <group onPointerDown={down} onPointerUp={up}>
        {/* el hueco que falta por llenar */}
        <mesh geometry={fantasma} renderOrder={3}>
          <meshStandardMaterial color="#6f88a8" transparent opacity={0.085} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {plastico && <primitive object={plastico} />}
        {soldaduras && <primitive object={soldaduras} />}
      </group>

      {/* LA COMPUERTA: de aquí entra el fundido */}
      <group position={[esc.gate.x, esc.gate.y, esc.gate.z]}>
        <mesh renderOrder={20}>
          <sphereGeometry args={[rMarca * 0.9, 18, 18]} />
          <meshBasicMaterial color={COLOR_COMPUERTA} depthTest={false} />
        </mesh>
        <mesh renderOrder={19}>
          <sphereGeometry args={[rMarca * 2.2, 18, 18]} />
          <meshBasicMaterial color={COLOR_COMPUERTA} depthTest={false} transparent opacity={0.20} />
        </mesh>
      </group>

      {/* VENTEOS §8.2.2 clasificados por §5.5.4: rojo = TRAMPA DE GAS (cierre interior,
          no venteable desde la partición) · ámbar = cierre en el borde, sí venteable.
          Aparecen cuando el frente LLEGA, no antes. */}
      {esc.venteos.map((v, i) => (
        <mesh
          key={`v${i}`}
          position={[v.x, v.y, v.z]}
          visible={v.fracLlenado <= st.t}
          renderOrder={21}
        >
          <octahedronGeometry args={[rMarca * (v.interior ? 1.5 : 1.05), 0]} />
          <meshBasicMaterial
            color={v.interior ? COLOR_TRAMPA_GAS : COLOR_VENTEABLE}
            depthTest={false}
            transparent
            opacity={v.interior ? 0.95 : 0.62}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LEYENDA (overlay DOM — se monta FUERA del Canvas)                          */
/* ══════════════════════════════════════════════════════════════════════════ */

const MONO = "'JetBrains Mono', monospace";

export function LeyendaLlenado({ esc }: { esc: EscenaLlenado | null }) {
  const rampaCss = `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => rampaHex(v)).join(', ')})`;
  return (
    <div style={{ font: `400 10.5px ${MONO}`, color: '#c3d0e0', lineHeight: 1.55 }}>
      <div style={{ font: `700 10.5px ${MONO}`, color: '#c9a227', marginBottom: 5 }}>
        ESCALA FIJA — % de llenado al que llega cada punto (dominio 0-100 %, no se auto-ajusta)
      </div>
      <div style={{ height: 11, borderRadius: 3, background: rampaCss, border: '1px solid #223046' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8fa3bd', marginTop: 2 }}>
        {MARCAS_LLENADO.map((m) => <span key={m.et}>{m.et}</span>)}
      </div>
      <div style={{ marginTop: 7 }}>
        {([
          [COLOR_COMPUERTA, 'compuerta (§7.2.2): por aquí entra el fundido'],
          [COLOR_SOLDADURA, 'LÍNEA DE SOLDADURA: dos frentes se reencontraron'],
          [COLOR_TRAMPA_GAS, 'TRAMPA DE GAS (§5.5.4): el frente cierra en el INTERIOR — no venteable'],
          [COLOR_VENTEABLE, 'fin de flujo en el BORDE: se ventea desde la partición (§8.2.2)'],
        ] as Array<[string, string]>).map(([c, txt]) => (
          <div key={txt} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <span style={{ width: 11, height: 11, background: c, borderRadius: 2, flex: '0 0 auto', border: '1px solid #223046' }} />
            <span>{txt}</span>
          </div>
        ))}
      </div>
      {esc && (
        <div style={{ marginTop: 7, color: '#8fa3bd' }}>
          {esc.n.toLocaleString('es-MX')} vóxeles · celda {esc.cellMm.toFixed(2)} mm ·{' '}
          {(esc.volumenMm3 / 1000).toFixed(2)} cc alcanzables · L máx {esc.maxFlowLenMm.toFixed(1)} mm
          {esc.notas.length ? <div style={{ marginTop: 3 }}>{esc.notas[0]}</div> : null}
          {esc.avisos.length ? <div style={{ color: '#ffb347', marginTop: 3 }}>⚠ {esc.avisos[0]}</div> : null}
        </div>
      )}
    </div>
  );
}
