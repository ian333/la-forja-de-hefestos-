/**
 * EL CICLO — el estudio organizado por TIEMPO REAL, no por capas.
 * ============================================================================
 * "Me gustan, pero no entiendo qué significan los resultados. **Son estudios,
 *  deberían de funcionar en el tiempo.**" (operador)
 *
 * El Estudio Vivo da CAPAS que se prenden y se apagan. Pero la inyección es un
 * PROCESO: inyectar → empacar → enfriar → abrir → expulsar. Esta pantalla pone
 * ese proceso en un reloj de SEGUNDOS REALES y cuelga las vistas de los momentos
 * del ciclo. Mueves el tiempo y:
 *
 *   · la VISTA 3D cambia sola según la fase (llenado · agua · apertura), y ninguna
 *     se rehace aquí: se IMPORTAN las que ya existen;
 *   · un panel dice EN CRISTIANO qué está pasando y qué se hace si va mal —
 *     la consecuencia en la pieza, no la cita del §;
 *   · la CURVA de enfriamiento se dibuja de verdad (T del centro contra el tiempo,
 *     serie de Fourier Eq 9.4) con la línea de T_eject: se VE por qué el molde no
 *     puede abrir antes.
 *
 * Las duraciones salen de los motores que ya existen y cada una trae su origen
 * (`ciclo-datos.ts`). Lo que NO sale del libro va marcado y pintado distinto:
 * los 5 s de apertura+cierre+inyección son el reparto grueso del repo
 * (`factory.ts:103`), no de Kazmer, y la pantalla lo dice donde se ve.
 *
 * REGLAS DE LA CASA QUE ESTE ARCHIVO CUMPLE:
 *  · NO modifica ningún módulo existente: solo importa.
 *  · NADA de `<Text>` de drei dentro del Canvas — todos los textos son overlay DOM.
 *  · Las vistas siguen siendo PURAS en su `t`: el reloj vive AQUÍ, no dentro de
 *    ellas, así que cada frame se puede reproducir y capturar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import { parseSTL } from './stl';
import { dfmFromMesh } from './dfm-mesh';
import { cajaDe, volumenArea, num, PIEZAS, type Caja, type MallaSimple } from './estudio-vivo-datos';

import VistaLlenado from './vista3d-llenado';
import VistaApertura from './vista3d-apertura';
import VistaAgua from './vista3d-agua';
import VistaAlabeo from './vista3d-alabeo';
import VistaCorte from './vista3d-corte';

import {
  construirCiclo, estadoCiclo, cristiano, verificarCiclo, reloj,
  type Ciclo, type VistaId,
} from './ciclo-datos';

const ORO = '#c9a227';
const FONDO = '#05070b';
const MONO = "'JetBrains Mono', monospace";

const cajaCss: React.CSSProperties = {
  background: 'rgba(14,20,30,0.82)', border: '1px solid #223046', borderRadius: 9, padding: '9px 11px',
};
const btn = (on: boolean): React.CSSProperties => ({
  background: on ? 'rgba(201,162,39,0.16)' : 'rgba(20,28,40,0.8)',
  border: `1px solid ${on ? ORO : '#2a3a52'}`, color: on ? ORO : '#c3d0e0',
  borderRadius: 7, padding: '6px 9px', font: `600 11px ${MONO}`, cursor: 'pointer', textAlign: 'left',
});

/** El MISMO encuadre del Estudio Vivo: determinista (mismo bbox ⇒ misma vista). */
function Encuadre({ caja, controles }: { caja: Caja; controles: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  useEffect(() => {
    const cx = (caja.x0 + caja.x1) / 2, cy = (caja.y0 + caja.y1) / 2, cz = (caja.z0 + caja.z1) / 2;
    const r = Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0, caja.z1 - caja.z0) || 50;
    camera.up.set(0, 0, 1);                       // Z ARRIBA: la dirección de apertura
    camera.position.set(cx + r * 1.15, cy - r * 1.35, cz + r * 1.05);
    camera.near = r / 100; camera.far = r * 60;
    camera.updateProjectionMatrix();
    camera.lookAt(cx, cy, cz);
    if (controles.current) { controles.current.target.set(cx, cy, cz); controles.current.update(); }
  }, [caja, camera, controles]);
  return null;
}

/** Vigila la dirección de la cámara para que el arnés pueda MEDIR que la órbita
 *  movió algo (y no juzgarlo por píxeles). Solo avisa si el giro pasa de ~1.5°. */
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

interface Lectura { titulo: string; valor: string; nota?: string; seccion: string }

/** Lo que las vistas 3D reportan en este instante. Lo que no llegue, no se menciona. */
interface Vivo {
  llenadoPct?: number; soldaduras?: number; trampasInterior?: number; lenFrenteMm?: number;
  choques?: number; areaChoqueMm2?: number;
  fracApertura?: number;
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function EstudioCiclo({ onClose }: { onClose: () => void }) {
  const [piezaId, setPiezaId] = useState(PIEZAS[0].id);
  const [tS, setTS] = useState(0);
  /** velocidad del reloj: 0 = pausa · 1 = tiempo REAL · 0.15 = cámara lenta */
  const [vel, setVel] = useState(0);
  /** vista de apoyo elegida a mano; null = la que manda la fase */
  const [apoyo, setApoyo] = useState<VistaId | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [vivo, setVivo] = useState<Vivo>({});
  const [camDir, setCamDir] = useState<[number, number, number]>([-0.6, 0.62, -0.5]);
  const controles = useRef<any>(null);

  const pieza = PIEZAS.find((p) => p.id === piezaId) ?? PIEZAS[0];

  /* ── LA MALLA (mismo camino y misma guarda del "200 mentiroso" que el Estudio) ── */
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

  const caja = useMemo(() => (malla ? cajaDe(malla) : null), [malla]);

  /** El MISMO `MachineSpec` que arma el Estudio Vivo para sus capas pesadas. */
  const machineSpec = useMemo(() => {
    if (!malla || !caja) return null;
    try {
      const va = volumenArea(malla);
      const dfm = dfmFromMesh(malla);
      return {
        name: pieza.nombre,
        Lmm: +(caja.x1 - caja.x0).toFixed(1), Wmm: +(caja.y1 - caja.y0).toFixed(1), Hmm: +(caja.z1 - caja.z0).toFixed(1),
        surfaceMm2: Math.round(va.areaMm2), volumeMm3: Math.round(va.volumeMm3),
        wallMm: dfm.wall.p50Mm || 2,
        plastic: 'ABS', annualVolume: 500_000,
        projectedAreaMm2: dfm.projectedAreaMm2,
        warpageTopology: dfm.warpageTopology,
      } as any;
    } catch { return null; }
  }, [malla, caja, pieza.nombre]);

  /* ── LA LÍNEA DE TIEMPO (diferida: se pinta "armando" ANTES de bloquear) ── */
  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  const [falloCiclo, setFalloCiclo] = useState('');
  useEffect(() => {
    if (!machineSpec) { setCiclo(null); return; }
    setCiclo(null); setFalloCiclo('');
    let activo = true;
    const id = window.setTimeout(() => {
      if (!activo) return;
      try {
        const c = construirCiclo({ spec: machineSpec });
        if (activo) { setCiclo(c); setTS(0); setVel(0); }
      } catch (e) {
        if (activo) setFalloCiclo(String(e).slice(0, 260));
      }
    }, 30);
    return () => { activo = false; window.clearTimeout(id); };
  }, [machineSpec]);

  /* ── EL RELOJ. Vive AQUÍ, nunca dentro de las vistas: por eso cada frame es
       reproducible y el arnés puede capturarlo. ── */
  useEffect(() => {
    if (!ciclo || vel <= 0) return;
    let raf = 0, ultimo = 0;
    const paso = (ms: number) => {
      if (!ultimo) ultimo = ms;
      const dt = ((ms - ultimo) / 1000) * vel;
      ultimo = ms;
      setTS((t) => {
        const n = t + dt;
        return n >= ciclo.cicloS ? n - ciclo.cicloS : n;      // el ciclo se repite: es un CICLO
      });
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [ciclo, vel]);

  /* ── LO QUE LAS VISTAS REPORTAN. Se lee su API documentada (`window.__vista3d`)
       en vez de recalcular sus escenas: recalcular duplicaría el barrido de
       interferencia y el Dijkstra en cada tick del reloj. ── */
  useEffect(() => {
    const id = window.setInterval(() => {
      const w = (window as any).__vista3d || {};
      const ll = w.llenado, ap = w.apertura;
      const n: Vivo = {};
      if (ll && ll.listo) {
        n.llenadoPct = Math.round(ll.pct * 1000) / 10;
        n.soldaduras = ll.nSoldaduras;
        n.trampasInterior = ll.trampasAlcanzadas;
        n.lenFrenteMm = Math.round(ll.lenMaxMm);
      }
      if (ap && ap.listo) {
        n.choques = (ap.choquesAhora || []).length;
        n.areaChoqueMm2 = (ap.choquesAhora || []).reduce((s: number, c: any) => s + (c.areaMm2 || 0), 0);
        if (ap.recorridoMm > 0) n.fracApertura = ap.aperturaTotalMm / ap.recorridoMm;
      }
      setVivo((v) => (JSON.stringify(v) === JSON.stringify(n) ? v : n));
    }, 220);
    return () => window.clearInterval(id);
  }, []);

  /** El reparto apertura↔expulsión DENTRO del control de la vista de apertura.
   *  Mientras la vista no publique el molde construido se usa la estimación del
   *  libro (2.5·H de apertura contra H de expulsión) y se DECLARA cuál se usó. */
  const fracEstimada = useMemo(() => {
    if (!ciclo) return 0.714;
    const a = ciclo.pkg.diseno.maquina.seleccion.apertura.strokeMm;
    const e = Math.max(1, Number(ciclo.pkg.spec.Hmm) || 1);
    return a / (a + e);
  }, [ciclo]);
  const fracApertura = vivo.fracApertura ?? fracEstimada;
  const fracMedida = vivo.fracApertura != null;

  /* ── ESTADO EN EL RELOJ (puro) ── */
  const est = useMemo(() => (ciclo ? estadoCiclo(ciclo, tS, fracApertura) : null), [ciclo, tS, fracApertura]);
  const vistaActiva: VistaId | null = apoyo ?? (est ? est.fase.mapa.vista : null);
  const txt = useMemo(() => (ciclo && est ? cristiano(ciclo, est, vivo) : null), [ciclo, est, vivo]);
  const ver = useMemo(() => (ciclo ? verificarCiclo(ciclo) : null), [ciclo]);

  /* ── Las vistas ya visitadas se quedan MONTADAS (ocultas). Construir cada escena
       cuesta segundos; desmontarla y volver a montarla al cambiar de fase haría que
       reproducir el ciclo se atorara en cada corte. ── */
  const [montadas, setMontadas] = useState<VistaId[]>([]);
  // el orden IMPORTA: al cambiar de pieza se vacía la lista y en el MISMO commit se
  // vuelve a meter la vista activa. Sin `piezaId` en las dependencias del segundo
  // efecto, cambiar de pieza sin cambiar de fase dejaba la lista VACÍA y el visor en
  // negro (los dos efectos usan actualización funcional, así que se componen bien).
  useEffect(() => { setMontadas([]); setApoyo(null); }, [piezaId]);
  useEffect(() => {
    if (!vistaActiva) return;
    setMontadas((m) => (m.includes(vistaActiva) ? m : [...m, vistaActiva]));
  }, [vistaActiva, piezaId]);

  /** `t` que le toca a cada vista. Las ocultas se quedan en un valor de reposo:
   *  siguen siendo puras y no cuesta nada tenerlas ahí. */
  const tDe = useCallback((v: VistaId): number => {
    if (est && vistaActiva === v) return est.tVista;
    return v === 'llenado' ? 1 : v === 'apertura' ? 0 : 0.5;
  }, [est, vistaActiva]);

  const onLectura = useCallback((l: Lectura) => setLectura(l), []);

  /* ── API del arnés: manejar y MEDIR la pantalla sin depender de píxeles ── */
  useEffect(() => {
    (window as any).__estudioCiclo = {
      listo: !!(ciclo && est),
      pieza: pieza.nombre, piezaId,
      cicloS: ciclo ? +ciclo.cicloS.toFixed(4) : null,
      cicloCosteoS: ciclo ? ciclo.cicloCosteoS : null,
      tS: +tS.toFixed(4),
      fase: est ? est.fase.id : null,
      faseNombre: est ? est.fase.nombre : null,
      u: est ? +est.u.toFixed(4) : null,
      vista: vistaActiva,
      apoyo,
      tVista: est ? +est.tVista.toFixed(4) : null,
      fracApertura: +fracApertura.toFixed(4), fracAperturaMedida: fracMedida,
      tempCentroC: est && est.tempCentroC != null ? +est.tempCentroC.toFixed(2) : null,
      tEjectC: ciclo ? ciclo.material.m.tEject : null,
      tCruceS: ciclo ? +ciclo.tCruceS.toFixed(4) : null,
      tEnfriamientoTotalS: ciclo ? +ciclo.tEnfriamientoTotalS.toFixed(4) : null,
      paredMm: ciclo ? ciclo.paredMm : null,
      materialProxy: ciclo ? ciclo.material.esProxy : null,
      fases: ciclo ? ciclo.fases.map((f) => ({
        id: f.id, nombre: f.nombre, durS: +f.durS.toFixed(4), t0S: +f.t0S.toFixed(4), t1S: +f.t1S.toFixed(4),
        vista: f.mapa.vista, delLibro: f.origen.delLibro,
        ecuacion: f.origen.ecuacion, seccion: f.origen.seccion, archivo: f.origen.archivo,
        sustitucion: f.origen.sustitucion,
      })) : null,
      invariantes: ver ? ver.invariantes : null,
      invariantesOk: ver ? ver.ok : null,
      cristiano: txt,
      hallazgos: ciclo ? ciclo.hallazgos : null,
      avisos: ciclo ? ciclo.avisos : null,
      lectura,
      vivo,
      velocidad: vel,
      montadas,
      camDir,
      setT: (s: number) => setTS(Math.max(0, Math.min(ciclo ? ciclo.cicloS : 0, s))),
      setVel: (v: number) => setVel(v),
      setApoyo: (v: VistaId | null) => setApoyo(v),
      /** T del centro de la pared muestreada N veces en la ventana de enfriamiento */
      curva: ciclo ? ciclo.curva.map((p) => [+p.tS.toFixed(3), +p.tempC.toFixed(2)]) : null,
    };
  }, [ciclo, est, tS, vistaActiva, apoyo, fracApertura, fracMedida, ver, txt, lectura, vivo, vel, pieza.nombre, piezaId, montadas, camDir]);

  /* ══════════════════════════════════════════════════════════════════════ */
  const anchoPanel = 428;
  return (
    <div
      data-testid="estudio-ciclo-view"
      style={{
        position: 'fixed', inset: 0, zIndex: 93, background: FONDO, color: '#e9eef5',
        fontFamily: MONO, display: 'flex', overflow: 'hidden',
      }}
    >
      {/* ─────────── VISOR + RELOJ ─────────── */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }} data-testid="ec-visor">
          {malla && caja && ciclo ? (
            <Canvas
              data-testid="ec-canvas"
              camera={{ fov: 38, position: [120, -120, 90], up: [0, 0, 1] }}
              gl={{ antialias: true, alpha: false }}
              dpr={[1, 2]}
              onCreated={({ gl }) => { gl.setClearColor(FONDO); (window as any).__estudioCicloCanvasOk = true; }}
            >
              <ambientLight intensity={0.55} />
              <directionalLight position={[1, -1.4, 2.2]} intensity={1.55} />
              <directionalLight position={[-1.6, 1.1, -0.7]} intensity={0.55} color="#7fa6d8" />
              <Encuadre caja={caja} controles={controles} />
              <VigilaCamara onDir={setCamDir} />

              {montadas.includes('llenado') && (
                <group visible={vistaActiva === 'llenado'}>
                  <VistaLlenado
                    malla={malla} caja={caja} spec={ciclo.pkg} t={tDe('llenado')}
                    onLectura={vistaActiva === 'llenado' ? onLectura : undefined}
                  />
                </group>
              )}
              {montadas.includes('agua') && (
                <group visible={vistaActiva === 'agua'}>
                  <VistaAgua
                    malla={malla} caja={caja} spec={ciclo.pkg} t={tDe('agua')}
                    onLectura={vistaActiva === 'agua' ? onLectura : undefined}
                  />
                </group>
              )}
              {montadas.includes('apertura') && (
                <group visible={vistaActiva === 'apertura'}>
                  <VistaApertura
                    malla={malla} caja={caja} spec={ciclo.pkg} t={tDe('apertura')}
                    nombre={pieza.nombre} paredMm={ciclo.paredMm}
                    onLectura={vistaActiva === 'apertura' ? onLectura : undefined}
                  />
                </group>
              )}
              {montadas.includes('alabeo') && (
                <group visible={vistaActiva === 'alabeo'}>
                  <VistaAlabeo
                    malla={malla} caja={caja} spec={ciclo.pkg} t={tDe('alabeo')}
                    onLectura={vistaActiva === 'alabeo' ? onLectura : undefined}
                  />
                </group>
              )}
              {montadas.includes('corte') && (
                <group visible={vistaActiva === 'corte'}>
                  <VistaCorte
                    malla={malla} caja={caja} spec={ciclo.pkg} t={tDe('corte')} eje="x"
                    onLectura={vistaActiva === 'corte' ? onLectura : undefined}
                  />
                </group>
              )}

              <OrbitControls ref={controles} makeDefault enableDamping dampingFactor={0.11} />
            </Canvas>
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#8fa3bd', font: `600 13px ${MONO}`, padding: 30, textAlign: 'center' }}>
              {falloCiclo ? `⚠ no se pudo armar la línea de tiempo: ${falloCiclo}` : (cargando || 'armando la línea de tiempo del ciclo…')}
            </div>
          )}

          {/* título + reloj grande (overlay DOM, nunca drei/Text) */}
          <div style={{ position: 'absolute', left: 16, top: 14, pointerEvents: 'none' }}>
            <div style={{ font: `700 15px ${MONO}`, color: ORO, letterSpacing: 0.5 }}>EL CICLO</div>
            <div style={{ font: `400 11px ${MONO}`, color: '#8fa3bd', marginTop: 3 }}>
              {pieza.nombre} · pared {ciclo ? num(ciclo.paredMm, 2) : '—'} mm · el estudio en el TIEMPO, no en capas
            </div>
            {est && ciclo && (
              <div style={{ marginTop: 10 }}>
                <div data-testid="ec-reloj" style={{ font: `700 40px/1 ${MONO}`, color: est.fase.color, letterSpacing: -1 }}>
                  {reloj(est.tS)}
                </div>
                <div style={{ font: `700 13px ${MONO}`, color: est.fase.color, marginTop: 4 }}>
                  {est.fase.icono} {est.fase.nombre}
                </div>
                <div style={{ font: `400 10.5px ${MONO}`, color: '#8fa3bd', marginTop: 2 }}>
                  de {num(ciclo.cicloS, 2)} s de ciclo · {num(est.pctCiclo, 0)} % · esta fase dura {num(est.fase.durS, 2)} s
                </div>
              </div>
            )}
          </div>

          {/* qué vista está prendida y por qué */}
          {est && (
            <div data-testid="ec-vista-activa" style={{ ...cajaCss, position: 'absolute', right: 16, top: 14, width: 300 }}>
              <div style={{ font: `700 10.5px ${MONO}`, color: ORO }}>
                VISTA 3D: {String(vistaActiva).toUpperCase()}{apoyo ? ' (de apoyo, elegida a mano)' : ' (la manda la fase)'}
              </div>
              <div style={{ font: `400 9.5px/1.4 ${MONO}`, color: apoyo ? '#ffb347' : '#8fa3bd', marginTop: 4 }}>
                {apoyo
                  // sin esto el rótulo describía la vista de la FASE mientras en pantalla
                  // estaba el apoyo ("la vista recorre apertura…" encima del alabeo).
                  ? `${apoyo === 'corte' ? 'EL CORTE' : 'EL ALABEO'} NO es un momento del ciclo: es un corte de inspección. `
                    + `Su control recibe el t de la fase (${est.fase.nombre}) solo para que se mueva — no lo manda el reloj.`
                  : est.fase.mapa.nota}
              </div>
              <div style={{ font: `600 9.5px ${MONO}`, color: '#c3d0e0', marginTop: 4 }}>
                control de la vista t = {num(est.tVista, 3)}
                {!apoyo && est.fase.mapa.tipo === 'aperturaSeg' && (
                  <span style={{ color: fracMedida ? '#59d98c' : '#ffb347' }}>
                    {' '}· corte apertura|expulsión en {num(fracApertura, 3)} ({fracMedida ? 'MEDIDO del molde construido' : 'estimado 2.5H:H — la vista aún no publica el molde'})
                  </span>
                )}
              </div>
              {lectura && (
                <div style={{ borderTop: '1px solid #223046', marginTop: 6, paddingTop: 5 }}>
                  <div style={{ font: `700 9.5px ${MONO}`, color: '#c3d0e0' }}>{lectura.titulo}</div>
                  <div style={{ font: `600 10px ${MONO}`, color: '#e9eef5', marginTop: 2 }}>{lectura.valor}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─────────── LA LÍNEA DE TIEMPO ─────────── */}
        {ciclo && est && (
          <div data-testid="ec-linea" style={{ borderTop: '1px solid #1b2536', background: 'rgba(8,12,19,0.96)', padding: '10px 16px 12px' }}>
            {/* ── LAS 5 FASES, SIEMPRE LEGIBLES ──
                La barra de abajo es PROPORCIONAL y por eso la inyección mide 0.8 % del
                ancho: honesto, pero de 11 px no se lee ni se puede picar (medido en la
                primera corrida del arnés: el tramo mostraba UNA letra por renglón). La
                barra no se falsea con un ancho mínimo — se le pone al lado esta fila de
                botones legibles, que es la que se maneja. */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
              {ciclo.fases.map((f) => {
                const on = f.id === est.fase.id;
                return (
                  <button
                    key={f.id}
                    data-testid={`ec-fase-${f.id}`}
                    title={`${f.nombre} — ${num(f.durS, 2)} s · ${f.origen.ecuacion} (${f.origen.seccion})`}
                    onClick={() => { setVel(0); setTS(f.t0S + f.durS * 0.5); }}
                    style={{
                      flex: 1, minWidth: 0, cursor: 'pointer', borderRadius: 6, textAlign: 'left',
                      backgroundColor: on ? f.color : 'rgba(20,28,40,0.8)',
                      color: on ? '#05070b' : '#c3d0e0',
                      border: `1px solid ${on ? f.color : '#2a3a52'}`,
                      font: `700 10px ${MONO}`, padding: '4px 7px', overflow: 'hidden',
                    }}
                  >
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.icono} {f.nombre}</div>
                    <div>
                      <span style={{ font: `700 13px ${MONO}` }}>{num(f.durS, 2)} s</span>
                      <span style={{ font: `400 9px ${MONO}`, opacity: 0.8 }}> · {num((100 * f.durS) / ciclo.cicloS, 0)} %</span>
                    </div>
                    <div style={{ font: `400 8.5px ${MONO}`, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: on ? '#05070b' : (f.origen.delLibro ? '#59d98c' : '#ffb347') }}>
                      {f.origen.delLibro ? `✓ ${f.origen.seccion}` : '⚠ reparto del repo'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* las fases como TRAMOS de colores, A ESCALA DE SEGUNDOS (la verdad
                proporcional: aquí se VE que el enfriamiento se come el ciclo) */}
            <div style={{ position: 'relative', display: 'flex', height: 26, borderRadius: 7, overflow: 'hidden', border: '1px solid #223046' }}>
              {ciclo.fases.map((f) => {
                const on = f.id === est.fase.id;
                const ancho = (100 * f.durS) / ciclo.cicloS;
                return (
                  <button
                    key={f.id}
                    data-testid={`ec-tramo-${f.id}`}
                    title={`${f.nombre} — ${num(f.durS, 2)} s · ${f.origen.ecuacion} (${f.origen.seccion})`}
                    onClick={() => { setVel(0); setTS(f.t0S + f.durS * 0.5); }}
                    style={{
                      width: `${ancho}%`, flex: `0 0 ${ancho}%`, minWidth: 0, cursor: 'pointer',
                      // ⚠ `backgroundColor` y NO `background`: mezclar la abreviada con
                      // `backgroundImage` en el mismo elemento dispara el error de React
                      // "Updating a style property during rerender … conflicting property"
                      // en CADA re-render del reloj (cazado por el arnés: 8 errores).
                      backgroundColor: on ? f.color : `${f.color}44`,
                      color: on ? '#05070b' : '#c3d0e0',
                      borderStyle: 'none', borderRight: '1px solid #05070b',
                      // las fases que NO salen del libro van rayadas: el ojo tiene que
                      // poder separar "esto lo dice Kazmer" de "esto lo repartió el repo"
                      backgroundImage: f.origen.delLibro ? undefined
                        : `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.30) 4px, rgba(0,0,0,0.30) 8px)`,
                      font: `700 10.5px ${MONO}`, padding: '0 4px', overflow: 'hidden', textAlign: 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {/* debajo del 7 % del ancho no cabe NADA legible: se deja el color
                        solo (y el título del hover). Meter una letra suelta es ruido. */}
                    {ancho >= 7 ? `${f.icono} ${num(f.durS, 2)} s` : ''}
                  </button>
                );
              })}
              {/* la aguja del reloj */}
              <div
                data-testid="ec-aguja"
                style={{
                  position: 'absolute', top: -2, bottom: -2, left: `${(100 * est.tS) / ciclo.cicloS}%`,
                  width: 2, background: '#ffffff', boxShadow: '0 0 7px rgba(255,255,255,0.85)', pointerEvents: 'none',
                }}
              />
            </div>

            {/* el slider EN SEGUNDOS REALES, no en 0..1 */}
            <input
              data-testid="ec-slider"
              type="range" min={0} max={ciclo.cicloS} step={0.01} value={est.tS}
              onChange={(e) => { setVel(0); setTS(Number(e.target.value)); }}
              style={{ width: '100%', marginTop: 8, accentColor: est.fase.color }}
            />

            <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <button data-testid="ec-play" style={btn(vel === 1)} onClick={() => setVel(vel === 1 ? 0 : 1)}>
                {vel === 1 ? '⏸ pausa' : '▶ tiempo REAL (1×)'}
              </button>
              <button data-testid="ec-lenta" style={btn(vel > 0 && vel < 1)} onClick={() => setVel(vel > 0 && vel < 1 ? 0 : 0.15)}>
                🐢 cámara lenta (0.15×)
              </button>
              <button data-testid="ec-reiniciar" style={btn(false)} onClick={() => { setVel(0); setTS(0); }}>⏮ al inicio</button>
              <span style={{ font: `400 10px ${MONO}`, color: '#6f7f95' }}>
                0 s ─────── el ciclo COMPLETO son {num(ciclo.cicloS, 2)} s ─────── {num(ciclo.cicloS, 2)} s
                {' · '}la barra va A ESCALA DE SEGUNDOS · el rayado = duración que NO sale del libro
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─────────── PANEL ─────────── */}
      <div style={{
        width: anchoPanel, flex: `0 0 ${anchoPanel}px`, borderLeft: '1px solid #1b2536',
        background: 'rgba(8,12,19,0.96)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 13px', borderBottom: '1px solid #1b2536' }}>
          <div style={{ font: `700 12px ${MONO}`, color: ORO }}>QUÉ ESTÁ PASANDO</div>
          <button data-testid="ec-cerrar" onClick={onClose} style={btn(false)}>✕ cerrar</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {/* ── EN CRISTIANO — lo primero, porque es lo que el operador pidió ── */}
          {txt && est && (
            <div data-testid="ec-cristiano" style={{ ...cajaCss, border: `1px solid ${est.fase.color}` }}>
              <div style={{ font: `700 13px ${MONO}`, color: est.fase.color }}>{txt.titulo}</div>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {txt.pasa.map((p, i) => (
                  <div key={i} style={{ font: `400 10.5px/1.5 ${MONO}`, color: '#e9eef5' }}>· {p}</div>
                ))}
              </div>
              <div style={{ font: `400 10px/1.5 ${MONO}`, color: '#8fa3bd', marginTop: 7, borderTop: '1px solid #223046', paddingTop: 6 }}>
                <b style={{ color: '#c3d0e0' }}>POR QUÉ IMPORTA: </b>{txt.porque}
              </div>
              {txt.mal && (
                <div
                  data-testid="ec-mal"
                  style={{
                    marginTop: 7, padding: '6px 8px', borderRadius: 6, border: '1px solid #ff5c5c',
                    background: 'rgba(60,14,18,0.5)', font: `600 10px/1.5 ${MONO}`, color: '#ffb3b3',
                  }}
                >
                  ⚠ {txt.mal}
                </div>
              )}
            </div>
          )}

          {/* ── LA CURVA DE ENFRIAMIENTO ── */}
          {ciclo && est && <Curva ciclo={ciclo} tS={est.tS} tempC={est.tempCentroC} />}

          {/* ── DE DÓNDE SALE CADA SEGUNDO ── */}
          {ciclo && (
            <div data-testid="ec-reparto" style={cajaCss}>
              <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 6 }}>DE DÓNDE SALE CADA SEGUNDO</div>
              {ciclo.fases.map((f) => (
                <div key={f.id} style={{ borderTop: '1px solid #1b2536', padding: '5px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, font: `700 10px ${MONO}`, color: f.color }}>
                    <span>{f.icono} {f.nombre}</span>
                    <span>{num(f.durS, 2)} s · {num((100 * f.durS) / ciclo.cicloS, 0)} %</span>
                  </div>
                  <div style={{ font: `600 9px ${MONO}`, color: f.origen.delLibro ? '#59d98c' : '#ffb347', marginTop: 2 }}>
                    {f.origen.delLibro ? '✓ DEL LIBRO' : '⚠ REPARTO DEL REPO — Kazmer no da tiempos de máquina'}
                    {' · '}{f.origen.ecuacion} · {f.origen.seccion}
                  </div>
                  <div style={{ font: `400 9px/1.4 ${MONO}`, color: '#8fa3bd', marginTop: 2 }}>{f.origen.sustitucion}</div>
                  <div style={{ font: `400 8.5px/1.35 ${MONO}`, color: '#6f7f95', marginTop: 2 }}>{f.origen.archivo}</div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #223046', marginTop: 6, paddingTop: 5, font: `700 10px ${MONO}`, color: '#e9eef5', display: 'flex', justifyContent: 'space-between' }}>
                <span>CICLO (suma de las fases)</span><span>{num(ciclo.cicloS, 2)} s</span>
              </div>
              <div style={{ font: `400 9px ${MONO}`, color: '#8fa3bd', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span>el COSTEO supone (Eq 3.23)</span><span>{num(ciclo.cicloCosteoS, 2)} s</span>
              </div>
            </div>
          )}

          {/* ── HALLAZGOS ── */}
          {ciclo && ciclo.hallazgos.length > 0 && (
            <div data-testid="ec-hallazgos" style={{ ...cajaCss, border: `1px solid ${ORO}` }}>
              <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 5 }}>LO QUE ESTA LÍNEA DESTAPA</div>
              {ciclo.hallazgos.map((h, i) => (
                <div key={i} style={{ font: `400 10px/1.5 ${MONO}`, color: '#e9eef5', marginTop: i ? 6 : 0 }}>· {h}</div>
              ))}
            </div>
          )}

          {/* ── VERIFICACIÓN: invariantes MEDIDOS ── */}
          {ver && (
            <div
              data-testid="ec-verificacion"
              style={{ ...cajaCss, border: `1px solid ${ver.ok ? '#223046' : '#ff5c5c'}`, background: ver.ok ? 'rgba(14,20,30,0.82)' : 'rgba(60,14,18,0.55)' }}
            >
              <div style={{ font: `700 10.5px ${MONO}`, color: ver.ok ? ORO : '#ff5c5c' }}>
                VERIFICACIÓN {ver.ok ? '· los invariantes se MIDEN y pasan' : '· ⚠ UN INVARIANTE FALLÓ'}
              </div>
              {ver.invariantes.map((i) => (
                <div key={i.id} style={{ marginTop: 5 }}>
                  <div style={{ font: `600 9.5px/1.35 ${MONO}`, color: i.ok ? '#59d98c' : '#ff5c5c' }}>
                    {i.ok ? '✓' : '✗'} {i.que}
                  </div>
                  <div style={{ font: `400 9px ${MONO}`, color: '#8fa3bd', wordBreak: 'break-word' }}>{i.medido}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── DECLARADO ── */}
          {ciclo && ciclo.avisos.length > 0 && (
            <div data-testid="ec-avisos" style={cajaCss}>
              <div style={{ font: `700 10.5px ${MONO}`, color: '#ffb347', marginBottom: 4 }}>DECLARADO (lo que NO es del libro)</div>
              {ciclo.avisos.map((a, i) => (
                <div key={i} style={{ font: `400 9px/1.45 ${MONO}`, color: '#8fa3bd', marginTop: i ? 5 : 0 }}>· {a}</div>
              ))}
            </div>
          )}

          {/* ── CONTROLES ── */}
          <div style={cajaCss}>
            <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 5 }}>VISTA DE APOYO (opcional)</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button data-testid="ec-apoyo-auto" style={btn(apoyo === null)} onClick={() => setApoyo(null)}>◆ la que manda la fase</button>
              {(['corte', 'alabeo'] as VistaId[]).map((v) => (
                <button key={v} data-testid={`ec-apoyo-${v}`} style={btn(apoyo === v)} onClick={() => setApoyo(apoyo === v ? null : v)}>
                  {v === 'corte' ? '⧅ EL CORTE' : '≋ EL ALABEO'}
                </button>
              ))}
            </div>
            <div style={{ font: `400 9px/1.4 ${MONO}`, color: '#6f7f95', marginTop: 4 }}>
              el corte y el alabeo NO son momentos del ciclo: son cortes de inspección que puedes dejar prendidos en cualquier instante.
            </div>

            <div style={{ font: `700 10.5px ${MONO}`, color: ORO, margin: '9px 0 5px' }}>PIEZA DEL BANCO</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {PIEZAS.map((p) => (
                <button key={p.id} data-testid={`ec-pieza-${p.id}`} onClick={() => setPiezaId(p.id)} style={{ ...btn(p.id === piezaId), width: '100%' }}>
                  {p.nombre}
                </button>
              ))}
            </div>
            {ciclo && (
              <div style={{ font: `400 9px ${MONO}`, color: '#6f7f95', marginTop: 6 }}>
                línea armada en {ciclo.ms} ms · material {ciclo.material.resina}
                {ciclo.material.esProxy ? ' (datos PRESTADOS del ABS)' : ''} · vistas montadas: {montadas.join(', ') || '—'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LA CURVA DE ENFRIAMIENTO — T del CENTRO contra el tiempo (Eq 9.4)          */
/* ══════════════════════════════════════════════════════════════════════════ */

function Curva({ ciclo, tS, tempC }: { ciclo: Ciclo; tS: number; tempC: number | null }) {
  const W = 386, H = 176, ML = 42, MR = 10, MT = 12, MB = 26;
  const gw = W - ML - MR, gh = H - MT - MB;
  const T0 = 40, T1 = Math.max(260, ciclo.material.m.tMelt + 15);

  const x = (t: number) => ML + (gw * Math.max(0, Math.min(ciclo.cicloS, t))) / Math.max(1e-9, ciclo.cicloS);
  const y = (T: number) => MT + gh * (1 - (Math.max(T0, Math.min(T1, T)) - T0) / (T1 - T0));

  const d = ciclo.curva.map((p, i) => `${i ? 'L' : 'M'}${x(p.tS).toFixed(2)},${y(p.tempC).toFixed(2)}`).join('');
  const yEject = y(ciclo.material.m.tEject);
  const yMelt = y(ciclo.material.m.tMelt);
  const yAgua = y(ciclo.material.m.tCoolant);

  return (
    <div data-testid="ec-curva" style={cajaCss}>
      <div style={{ font: `700 10.5px ${MONO}`, color: ORO }}>
        LA CURVA DE ENFRIAMIENTO — T del CENTRO de la pared
      </div>
      <div style={{ font: `400 9px/1.4 ${MONO}`, color: '#8fa3bd', margin: '3px 0 5px' }}>
        Eq 9.4 (serie de conducción transitoria, 400 términos) sobre la pared de {num(ciclo.paredMm, 2)} mm.
        El molde NO puede abrir mientras el centro esté arriba de {num(ciclo.material.m.tEject, 1)} °C.
        Con los 6 términos por defecto la curva SUBÍA 1.5 °C al arrancar — artefacto de truncar una serie
        alternante, no física; el invariante de monotonía lo cazó.
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
        {/* fases de fondo, con el mismo color de la línea de tiempo */}
        {ciclo.fases.map((f) => (
          <rect key={f.id} x={x(f.t0S)} y={MT} width={Math.max(0.5, x(f.t1S) - x(f.t0S))} height={gh} fill={f.color} opacity={0.13} />
        ))}
        <rect x={ML} y={MT} width={gw} height={gh} fill="none" stroke="#223046" />

        {/* T_melt · T_eject · agua */}
        <line x1={ML} x2={W - MR} y1={yMelt} y2={yMelt} stroke="#e04a2f" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
        <line x1={ML} x2={W - MR} y1={yEject} y2={yEject} stroke="#ffb347" strokeWidth={1.6} strokeDasharray="5 3" />
        <line x1={ML} x2={W - MR} y1={yAgua} y2={yAgua} stroke="#4f9ad4" strokeWidth={1} strokeDasharray="2 4" opacity={0.7} />
        <text x={ML - 4} y={yMelt + 3} textAnchor="end" fill="#e04a2f" style={{ font: `600 8px ${MONO}` }}>{ciclo.material.m.tMelt}</text>
        <text x={ML - 4} y={yEject + 3} textAnchor="end" fill="#ffb347" style={{ font: `700 8px ${MONO}` }}>{ciclo.material.m.tEject}</text>
        <text x={ML - 4} y={yAgua + 3} textAnchor="end" fill="#4f9ad4" style={{ font: `600 8px ${MONO}` }}>{ciclo.material.m.tCoolant}</text>
        <text x={W - MR} y={yEject - 4} textAnchor="end" fill="#ffb347" style={{ font: `700 8.5px ${MONO}` }}>T_eject — antes de aquí NO abre</text>

        {/* la curva */}
        <path d={d} fill="none" stroke="#ff8a5c" strokeWidth={2.2} />

        {/* el cruce */}
        <circle cx={x(ciclo.tCruceS)} cy={yEject} r={3.4} fill="#ffb347" />
        <text x={x(ciclo.tCruceS) - 4} y={yEject + 14} textAnchor="end" fill="#ffb347" style={{ font: `700 8.5px ${MONO}` }}>
          {num(ciclo.tCruceS, 2)} s
        </text>

        {/* dónde vas */}
        <line x1={x(tS)} x2={x(tS)} y1={MT} y2={MT + gh} stroke="#ffffff" strokeWidth={1.6} />
        {tempC != null && <circle cx={x(tS)} cy={y(tempC)} r={4} fill="#ffffff" />}

        {/* eje del tiempo */}
        <text x={ML} y={H - 8} fill="#6f7f95" style={{ font: `400 8.5px ${MONO}` }}>0 s</text>
        <text x={W - MR} y={H - 8} textAnchor="end" fill="#6f7f95" style={{ font: `400 8.5px ${MONO}` }}>{num(ciclo.cicloS, 1)} s</text>
        <text x={ML + gw / 2} y={H - 8} textAnchor="middle" fill="#8fa3bd" style={{ font: `600 8.5px ${MONO}` }}>tiempo del ciclo (s)</text>
      </svg>
      <div style={{ font: `700 10.5px ${MONO}`, color: tempC != null ? '#ff8a5c' : '#6f7f95', marginTop: 4 }}>
        {tempC != null
          ? `centro de la pared AHORA: ${num(tempC, 1)} °C`
          : (tS < ciclo.fases[0].t1S
            ? 'el plástico todavía va entrando: aún no hay pared que medir'
            : 'la pieza YA SALIÓ del molde — Eq 9.4 no la sigue enfriándose en el aire')}
      </div>
      <div style={{ font: `400 9px/1.4 ${MONO}`, color: '#8fa3bd', marginTop: 2 }}>
        el tramo de EMPAQUE cae dentro del enfriamiento: se empaca mientras la pieza ya se está enfriando, por eso
        el tramo verde es lo que QUEDA después de que la compuerta congela (así ningún segundo se cuenta dos veces).
      </div>
    </div>
  );
}
