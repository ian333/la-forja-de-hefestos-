/**
 * EL MOLDE ABRE — vista 3D ANIMADA para EL ESTUDIO VIVO (§11.4 · lámina L6).
 * ============================================================================
 * "Esas vistas no me sirven de nada si no es en 3D e integrada a La Forja." La lámina L6
 * ya trae la cinemática, los mecanismos y el barrido de interferencia; aquí se MUEVEN.
 *
 * QUÉ SE VE (todo sale de `lamina-apertura.ts`, cero física nueva):
 *  · el molde CORTADO por el plano del sprue — el MISMO corte que secciona la lámina L6,
 *    pero en 3D y moviéndose. Sin el corte esto es un ladrillo de acero: probado con
 *    placas en rayos X al 0.10 y el resultado medido fue una masa ámbar sin nada legible.
 *    Con el corte se ven el paquete expulsor, el pin contorneado, las líneas de agua,
 *    los insertos, la colada y el moldeo.
 *  · el slider `t` recorre el ciclo COMPLETO: apertura (mitad móvil bajando, correderas
 *    saliendo por su ley d·tan φ) y después expulsión (el paquete empujando).
 *  · **las COLISIONES en ROJO cuando OCURREN** — no una bandera precocinada: en cada t
 *    se vuelve a MEDIR la penetración de sección (mm²) con el motor exacto de polígonos,
 *    y una esfera roja marca DÓNDE. Es lo que destapó L6 y las 4 figuras del libro no
 *    muestran: la carrera de expulsión que no cabe en el housing y el pin contorneado
 *    cruzando la línea de agua.
 *
 * REGLAS QUE ESTE ARCHIVO CUMPLE:
 *  · PURO EN `t`: sin `Math.random()`, sin reloj, sin `useFrame`. Mismo t ⇒ mismo frame,
 *    siempre. Por eso el arnés puede capturarlo y compararlo.
 *  · Devuelve un `<group>`: NADA de DOM aquí dentro y nada de `<Text>` de drei (la
 *    leyenda va como overlay del panel — se exporta `LeyendaApertura` para eso).
 *  · Materiales creados con `useMemo` y MUTADOS (`.color`, `.opacity`); nunca inline.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';

import {
  construirApertura, estadoApertura, lecturaApertura, hallazgosApertura,
  specParaMolde, encajeEnCaja, planoDeCorte, ESTILO_ROL, ROJO_CHOQUE, AMBAR_CONTACTO,
  type EscenaApertura,
} from './vista3d-apertura-datos';
import type { Caja, MallaSimple } from './estudio-vivo-datos';

export const META = {
  id: 'apertura' as const,
  nombre: 'EL MOLDE ABRE',
  icono: '⇕',
  seccion: '§11.4 · L6',
  control: { etiqueta: 'apertura', min: 0, max: 1, paso: 0.005, inicial: 0 },
  reproducible: true,
};

export interface PropsVista3D {
  malla: MallaSimple;
  caja: Caja;
  spec: any | null;
  /** 0..1 — recorrido del ciclo (apertura y después expulsión) */
  t: number;
  onLectura?: (l: { titulo: string; valor: string; nota?: string; seccion: string }) => void;
  /** OPCIONALES (el contrato no los exige; el Estudio puede ignorarlos) */
  nombre?: string;
  paredMm?: number;
  /** ventanas (undercuts) declaradas de la pieza → generan corredera / núcleo móvil §11.3.7 */
  ventanas?: Array<{ lado: 1 | -1; anchoMm: number; altoMm: number; desdeMm: number; hidraulico?: boolean }>;
  /** encajar el molde en la caja de la PIEZA (el visor del Estudio encuadra la pieza).
   *  'ninguno' = coordenadas de placa reales, para un visor que encuadre el molde. */
  ajuste?: 'caja' | 'ninguno';
  /** CORTE por el plano del sprue (el de L6). Sin él el molde es un ladrillo opaco.
   *  `false` = molde entero, para quien quiera ver el exterior. */
  corte?: boolean;
  onEscena?: (e: EscenaApertura | null) => void;
}

/* ── cache de escenas: construirla cuesta (barrido de interferencia); moverla, no ── */
const CACHE = new Map<string, EscenaApertura>();

/** placeholder mientras se construye: la caja de la pieza en alambre, para que el visor
 *  no se quede en negro sin explicación (el panel además recibe la lectura "construyendo"). */
function Esperando({ caja }: { caja: Caja }) {
  const g = useMemo(() => {
    const b = new THREE.Box3(
      new THREE.Vector3(caja.x0, caja.y0, caja.z0),
      new THREE.Vector3(caja.x1, caja.y1, caja.z1),
    );
    return new THREE.Box3Helper(b, new THREE.Color('#c9a227'));
  }, [caja]);
  useEffect(() => () => { (g as any).geometry?.dispose?.(); }, [g]);
  return <primitive object={g} />;
}

/**
 * Prende el recorte LOCAL del renderer. Solo afecta a materiales que declaren
 * `clippingPlanes` (los de esta vista), así que no toca nada del resto del Estudio;
 * aun así se restaura el valor previo al desmontar — no se deja el renderer tocado.
 */
function Recorte() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const antes = gl.localClippingEnabled;
    gl.localClippingEnabled = true;
    return () => { gl.localClippingEnabled = antes; };
  }, [gl]);
  return null;
}

/** un sólido del molde: geometría una vez, material mutado. */
function Solido({
  positions, indices, color, opacidad, metal, rug, transparente, orden, planos, onClic,
}: {
  positions: Float32Array; indices: Uint32Array;
  color: string; opacidad: number; metal: number; rug: number;
  transparente: boolean; orden: number; planos: THREE.Plane[] | null;
  onClic: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [positions, indices]);
  useEffect(() => () => geom.dispose(), [geom]);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    flatShading: true, side: THREE.DoubleSide,
  }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    mat.color.set(color);
    mat.opacity = opacidad;
    mat.transparent = transparente;
    mat.depthWrite = !transparente;
    mat.metalness = metal;
    mat.roughness = rug;
    mat.emissive.set(color);
    mat.emissiveIntensity = transparente ? 0 : 0.075;
    mat.clippingPlanes = planos;
    mat.clipShadows = true;
    mat.needsUpdate = true;
  }, [mat, color, opacidad, transparente, metal, rug, planos]);

  const abajo = useRef<{ x: number; y: number } | null>(null);
  const down = useCallback((e: ThreeEvent<PointerEvent>) => { abajo.current = { x: e.clientX, y: e.clientY }; }, []);
  const up = useCallback((e: ThreeEvent<PointerEvent>) => {
    const a = abajo.current; abajo.current = null;
    if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 4) return;   // fue arrastre de órbita
    e.stopPropagation();
    onClic(e);
  }, [onClic]);

  return <mesh geometry={geom} material={mat} renderOrder={orden} onPointerDown={down} onPointerUp={up} />;
}

export default function Vista(p: PropsVista3D) {
  const { malla, caja, spec, t, onLectura } = p;

  /* ── EL SPEC: lo que dé el Estudio, o derivado de la malla (declarándolo) ── */
  const sp = useMemo(
    () => specParaMolde(spec, malla, caja, { nombre: p.nombre, paredMm: p.paredMm }),
    [spec, malla, caja, p.nombre, p.paredMm],
  );

  const clave = useMemo(() => {
    const a = sp.asm;
    return [
      a?.code ?? a?.name ?? 'molde', a?.widthMm, a?.depthMm,
      a?.cavity?.widthMm, a?.cavity?.lenMm, a?.cavity?.depthMm, a?.cavity?.shape, a?.cavity?.wallMm,
      a?.ejectors?.type, a?.ejectors?.diaMm,
      (p.ventanas ?? []).map((v) => `${v.lado}:${v.anchoMm}:${v.altoMm}:${v.desdeMm}:${v.hidraulico ? 'H' : 'C'}`).join(','),
    ].join('|');
  }, [sp, p.ventanas]);

  /* ── construcción DIFERIDA: se pinta el placeholder ANTES de bloquear ── */
  const [esc, setEsc] = useState<EscenaApertura | null>(() => CACHE.get(clave) ?? null);
  const [fallo, setFallo] = useState('');
  useEffect(() => {
    const hit = CACHE.get(clave);
    if (hit) { setEsc(hit); setFallo(''); return; }
    setEsc(null); setFallo('');
    let vivo = true;
    const id = window.setTimeout(() => {
      if (!vivo) return;
      try {
        const e = construirApertura(
          { spec: sp.asm, maquina: sp.maquina, ventanas: p.ventanas },
          sp,
        );
        CACHE.set(clave, e);
        if (vivo) setEsc(e);
      } catch (err) {
        if (vivo) setFallo(String(err).slice(0, 220));
      }
    }, 30);
    return () => { vivo = false; window.clearTimeout(id); };
  }, [clave, sp, p.ventanas]);

  useEffect(() => { p.onEscena?.(esc); }, [esc]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ── ESTADO EN t (puro). Se cuantiza al paso del control: el resultado sigue siendo
       una función de t y así arrastrar el slider no re-mide 200 veces por segundo. ── */
  const paso = META.control.paso;
  const tq = Math.round(Math.max(0, Math.min(1, t)) / paso) * paso;
  const st = useMemo(() => (esc ? estadoApertura(esc, tq) : null), [esc, tq]);

  /* ── ENCAJE: el molde mide ~10× la pieza y vive en coords de placa ── */
  const enc = useMemo(
    () => (esc && p.ajuste !== 'ninguno' ? encajeEnCaja(esc.cajaBarrida, caja) : null),
    [esc, caja, p.ajuste],
  );

  /* ── LA SEMEJANZA del encaje (escala + traslación) y EL PLANO DE CORTE en mundo ── */
  const { escala, off, planos } = useMemo(() => {
    const k = enc ? enc.escala : 1;
    const o: [number, number, number] = enc
      ? [enc.centro[0] - enc.centroMolde[0] * k, enc.centro[1] - enc.centroMolde[1] * k, enc.centro[2] - enc.centroMolde[2] * k]
      : [0, 0, 0];
    if (!esc || p.corte === false) return { escala: k, off: o, planos: null as THREE.Plane[] | null };
    const pc = planoDeCorte(esc.meta, k, o);
    return {
      escala: k, off: o,
      planos: [new THREE.Plane(new THREE.Vector3(pc.normal[0], pc.normal[1], pc.normal[2]), pc.constante)],
    };
  }, [esc, enc, p.corte]);

  /* ── LECTURA + API del arnés ──
     `onLectura` va por REF a propósito. Si entrara en las dependencias del efecto y el
     Estudio pasara una lambda sin memoizar (lo normal), tendríamos: efecto → setState
     del padre → re-render → callback NUEVA → efecto… un bucle infinito que se lleva la
     pestaña. La vista no puede exigirle al que la monta que memoize; se protege sola. */
  const [sonda, setSonda] = useState<string>('');
  const cbLectura = useRef(onLectura);
  cbLectura.current = onLectura;
  useEffect(() => {
    const onLectura = cbLectura.current;
    if (!onLectura) return;
    if (fallo) { onLectura({ titulo: 'EL MOLDE ABRE', valor: '⚠ no se pudo construir el molde', nota: fallo, seccion: META.seccion }); return; }
    if (!esc || !st) { onLectura({ titulo: 'EL MOLDE ABRE', valor: 'construyendo el molde y barriendo interferencias…', nota: sp.nota, seccion: META.seccion }); return; }
    const l = lecturaApertura(esc, st);
    onLectura({
      ...l,
      nota: [l.nota, sonda, enc ? `vista a escala 1:${(1 / enc.escala).toFixed(1)} (el molde real mide ${(esc.cajaBarrida.x1 - esc.cajaBarrida.x0).toFixed(0)}×${(esc.cajaBarrida.y1 - esc.cajaBarrida.y0).toFixed(0)}×${(esc.cajaBarrida.z1 - esc.cajaBarrida.z0).toFixed(0)} mm barridos)` : null, sp.nota]
        .filter(Boolean).join(' · '),
    });
  }, [esc, st, fallo, sonda, enc, sp.nota]);

  useEffect(() => {
    const w = window as any;
    w.__vista3d = w.__vista3d || {};
    w.__vista3d.apertura = esc && st ? {
      listo: true, t: st.t, tMm: +st.tMm.toFixed(3), d: +st.d.toFixed(3), e: +st.e.toFixed(3),
      pose: st.pose.id, fase: st.fase,
      recorridoMm: +esc.recorridoMm.toFixed(2),
      aperturaTotalMm: +esc.meta.aperturaTotalMm.toFixed(2),
      expulsionMm: +esc.meta.expulsionMm.toFixed(2),
      expulsionDisponibleMm: +esc.meta.expulsionDisponibleMm.toFixed(2),
      nSolidos: esc.solidos.length,
      paresVigilados: esc.pares.length,
      paresInterfieren: esc.vigilados.filter((v) => v.estado === 'INTERFIERE').length,
      choquesAhora: st.choques.filter((c) => c.toca).map((c) => ({ a: c.a, b: c.b, areaMm2: c.areaMm2 })),
      rojos: [...st.rojos], ambares: [...st.ambares],
      hallazgos: hallazgosApertura(esc).map((h) => `${h.id}: ${h.texto}`),
      escala: enc ? +enc.escala.toFixed(5) : 1,
      msConstruccion: esc.ms,
      origenSpec: esc.spec.origen,
      avisos: esc.avisos,
    } : { listo: false, fallo: fallo || null };
    return () => { if (w.__vista3d) w.__vista3d.apertura = { listo: false }; };
  }, [esc, st, fallo, enc]);

  const clicSolido = useCallback((id: string, nombre: string, grupo: string) => {
    if (!esc || !st) return;
    const d = st.desp.get(id) ?? [0, 0, 0];
    const rec = Math.hypot(d[0], d[1], d[2]);
    const choca = st.choques.filter((c) => c.a === id || c.b === id);
    setSonda(`sonda: ${nombre} [${grupo}] · recorrido ${rec.toFixed(1)} mm`
      + (choca.length ? ` · CHOCA con ${choca.map((c) => (c.a === id ? c.b : c.a)).join(', ')}` : ''));
  }, [esc, st]);

  /* ── ESCENA ── */
  if (fallo) return <group />;
  if (!esc || !st) return <group userData={{ vista: 'apertura-esperando' }}><Esperando caja={caja} /></group>;

  // radio del marcador de choque: proporcional al molde, no a un número tecleado
  const rMarca = Math.max(1.5, 0.012 * Math.max(
    esc.cajaBarrida.x1 - esc.cajaBarrida.x0,
    esc.cajaBarrida.y1 - esc.cajaBarrida.y0,
    esc.cajaBarrida.z1 - esc.cajaBarrida.z0,
  ));

  return (
    <group position={off} scale={[escala, escala, escala]}>
      {planos && <Recorte />}
      {esc.solidos.map((s) => {
        const est = ESTILO_ROL[s.rol];
        const rojo = st.rojos.has(s.id);
        const ambar = !rojo && st.ambares.has(s.id);
        const color = rojo ? ROJO_CHOQUE : ambar ? AMBAR_CONTACTO : est.hex;
        // un sólido que CHOCA deja de ser transparente: el hallazgo no puede quedar
        // escondido detrás del rayos X de las placas.
        const opac = rojo ? 1 : ambar ? Math.max(0.75, est.opacidad) : est.opacidad;
        const transp = opac < 0.999;
        const d = st.desp.get(s.id) ?? [0, 0, 0];
        return (
          <group key={s.id} position={[d[0], d[1], d[2]]}>
            <Solido
              positions={s.malla.positions}
              indices={s.malla.indices}
              color={color}
              opacidad={opac}
              metal={est.metal}
              rug={est.rug}
              transparente={transp}
              orden={transp ? 2 : 1}
              planos={planos}
              onClic={() => clicSolido(s.id, s.nombre, s.grupo)}
            />
          </group>
        );
      })}

      {/* DÓNDE choca: esfera roja en el centroide de la penetración, siempre visible
          (depthTest off) — si quedara tapada por una placa el hallazgo se perdería. */}
      {st.choques.filter((c) => c.toca && c.mundo).map((c, i) => (
        <group key={`${c.a}|${c.b}|${i}`} position={c.mundo as [number, number, number]}>
          <mesh renderOrder={20}>
            <sphereGeometry args={[rMarca, 20, 20]} />
            <meshBasicMaterial color={ROJO_CHOQUE} depthTest={false} transparent opacity={0.95} />
          </mesh>
          <mesh renderOrder={19}>
            <sphereGeometry args={[rMarca * 2.4, 20, 20]} />
            <meshBasicMaterial color={ROJO_CHOQUE} depthTest={false} transparent opacity={0.18} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LEYENDA (overlay DOM — se monta FUERA del Canvas)                          */
/* ══════════════════════════════════════════════════════════════════════════ */

const MONO = "'JetBrains Mono', monospace";

/** La leyenda de la vista. Va como overlay DOM del panel: dentro del Canvas está
 *  PROHIBIDO el texto (regla del proyecto: drei/Text revienta con postFX). */
export function LeyendaApertura({ esc }: { esc: EscenaApertura | null }) {
  const filas: Array<[string, string]> = [
    [ESTILO_ROL.placa.hex, 'placas (rayos X: para ver adentro)'],
    [ESTILO_ROL.inserto.hex, 'insertos de cavidad y núcleo'],
    [ESTILO_ROL.componente.hex, 'expulsores · pin contorneado · corredera'],
    [ESTILO_ROL.moldeo.hex, 'MOLDEO (la pieza de plástico)'],
    [ESTILO_ROL.agua.hex, 'líneas de agua'],
    [ESTILO_ROL.colada.hex, 'colada / bebedero'],
    [AMBAR_CONTACTO, 'CONTACTO: holgura 0 sin penetrar (§11.4 lo EXIGE en el talón)'],
    [ROJO_CHOQUE, 'CHOCA: penetración de sección > 0 medida en ese t'],
  ];
  return (
    <div style={{ font: `400 10.5px ${MONO}`, color: '#c3d0e0', lineHeight: 1.55 }}>
      <div style={{ font: `700 10.5px ${MONO}`, color: '#c9a227', marginBottom: 5 }}>
        LEYENDA — colores FIJOS por rol (no se auto-ajustan)
      </div>
      {filas.map(([c, txt]) => (
        <div key={txt} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <span style={{ width: 11, height: 11, background: c, borderRadius: 2, flex: '0 0 auto', border: '1px solid #223046' }} />
          <span>{txt}</span>
        </div>
      ))}
      {esc && (
        <div style={{ marginTop: 7, color: '#8fa3bd' }}>
          {/* LO QUE ESTA VISTA NO ES: el MOLDEO que se ve NO es la malla del cliente.
              `solidosApertura` solo talla la malla real cuando la pieza declara ventanas;
              en el resto de los casos dibuja la "cáscara nominal del spec" (§4.2). El
              sólido lo trae escrito y aquí se IMPRIME: quien lo mire tiene que saber que
              esa forma naranja es la impresión nominal, no su STL. */}
          <div style={{ color: '#ffb347', marginBottom: 4 }}>
            MOLDEO: {esc.solidos.find((s) => s.id === 'moldeo')?.nota ?? 'sin nota'} — la vista del molde
            NO redibuja tu malla; para eso está la capa FORMA del Estudio.
          </div>
          {esc.pares.length} pares vigilados en {esc.recorridoMm.toFixed(0)} mm de recorrido ·{' '}
          {esc.vigilados.filter((v) => v.estado === 'INTERFIERE').length} interfieren ·{' '}
          {esc.medidas.excluidos.length} excluidos (barrenos que el modelo no resta) ·{' '}
          barrido en el PLANO DEL SPRUE: un choque fuera de ese plano no lo ve
        </div>
      )}
    </div>
  );
}
