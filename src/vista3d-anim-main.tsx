/**
 * BANCO DE PRUEBA de las DOS VISTAS 3D ANIMADAS (dev/arnés, no producción).
 * ============================================================================
 * Monta `vista3d-apertura.tsx` y `vista3d-llenado.tsx` EXACTAMENTE como los montará
 * `EstudioVivo.tsx`: mismo Canvas (fov 38, up = +Z, sin EffectComposer), mismas luces,
 * mismo `Encuadre` a la caja de la pieza, mismos OrbitControls, y la lectura impresa
 * como overlay DOM. Si algo se ve bien aquí, se ve bien allá; si algo se sale de cuadro
 * aquí, se saldría allá.
 *
 * NO toca ningún módulo existente: solo IMPORTA (`parseSTL`, `estudio-vivo-datos`).
 */
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import { parseSTL } from './forja/mold/stl';
import { cajaDe, volumenArea, PIEZAS, type Caja, type MallaSimple } from './forja/mold/estudio-vivo-datos';
import { dfmFromMesh } from './forja/mold/dfm-mesh';
import VistaApertura, { META as META_AP, LeyendaApertura } from './forja/mold/vista3d-apertura';
import VistaLlenado, { META as META_LL, LeyendaLlenado } from './forja/mold/vista3d-llenado';

const ORO = '#c9a227';
const FONDO = '#05070b';
const MONO = "'JetBrains Mono', monospace";

/** El MISMO encuadre del Estudio: determinista (mismo bbox ⇒ misma vista). */
function Encuadre({ caja, controles }: { caja: Caja; controles: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  useEffect(() => {
    const cx = (caja.x0 + caja.x1) / 2, cy = (caja.y0 + caja.y1) / 2, cz = (caja.z0 + caja.z1) / 2;
    const r = Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0, caja.z1 - caja.z0) || 50;
    camera.up.set(0, 0, 1);
    camera.position.set(cx + r * 1.15, cy - r * 1.35, cz + r * 1.05);
    camera.near = r / 100; camera.far = r * 60;
    camera.updateProjectionMatrix();
    camera.lookAt(cx, cy, cz);
    if (controles.current) { controles.current.target.set(cx, cy, cz); controles.current.update(); }
  }, [caja, camera, controles]);
  return null;
}

interface Lectura { titulo: string; valor: string; nota?: string; seccion: string }

const cajaBoton = (on: boolean): React.CSSProperties => ({
  background: on ? 'rgba(201,162,39,0.16)' : 'rgba(20,28,40,0.8)',
  border: `1px solid ${on ? ORO : '#2a3a52'}`, color: on ? ORO : '#c3d0e0',
  borderRadius: 7, padding: '7px 11px', font: `700 12px ${MONO}`, cursor: 'pointer',
});

function Banco() {
  const url = new URLSearchParams(location.search);
  const [vistaId, setVistaId] = useState<'apertura' | 'llenado'>((url.get('vista') as any) === 'llenado' ? 'llenado' : 'apertura');
  const [piezaId, setPiezaId] = useState(url.get('pieza') || PIEZAS[0].id);
  const [t, setT] = useState(Number(url.get('t') ?? 0));
  const [play, setPlay] = useState(false);
  const [malla, setMalla] = useState<MallaSimple | null>(null);
  const [cargando, setCargando] = useState('cargando…');
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [escAp, setEscAp] = useState<any>(null);
  const [escLl, setEscLl] = useState<any>(null);
  const controles = useRef<any>(null);

  const pieza = PIEZAS.find((x) => x.id === piezaId) ?? PIEZAS[0];

  useEffect(() => {
    let vivo = true;
    setMalla(null); setCargando(`cargando ${pieza.nombre}…`); setLectura(null);
    (async () => {
      try {
        let r = await fetch('/' + pieza.ruta);
        if (!r.ok) r = await fetch('/@fs/home/ian/Orkesta/la-forja/' + pieza.ruta);
        if (!r.ok) throw new Error(`HTTP ${r.status} al pedir ${pieza.ruta}`);
        const m = parseSTL(await r.arrayBuffer());
        if (vivo) { setMalla(m); setCargando(''); }
      } catch (e) {
        if (vivo) setCargando(`⚠ ${String(e).slice(0, 160)}`);
      }
    })();
    return () => { vivo = false; };
  }, [pieza.ruta, pieza.nombre]);

  const caja = useMemo(() => (malla ? cajaDe(malla) : null), [malla]);

  /** El MISMO spec que el Estudio arma para sus capas pesadas (camino `machine-spec`). */
  const spec = useMemo(() => {
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

  /* PLAY: barre t con rAF. La ESCENA sigue siendo pura en t — el reloj vive AQUÍ, en el
     banco, no dentro de las vistas (por eso se puede capturar frame a frame). */
  useEffect(() => {
    if (!play) return;
    let raf = 0, t0 = 0;
    const paso = (ms: number) => {
      if (!t0) t0 = ms;
      const u = ((ms - t0) / 5200) % 1;
      setT(+u.toFixed(3));
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [play]);

  const onLectura = useCallback((l: Lectura) => setLectura(l), []);
  const meta = vistaId === 'apertura' ? META_AP : META_LL;

  /* API del arnés: manejar la pantalla sin depender de píxeles */
  useEffect(() => {
    (window as any).__vista3dBanco = {
      vista: vistaId, pieza: pieza.id, t,
      lectura: lectura ? { ...lectura } : null,
      setVista: (v: 'apertura' | 'llenado') => setVistaId(v),
      setT: (x: number) => setT(Math.max(0, Math.min(1, x))),
      setPieza: (x: string) => setPiezaId(x),
      canvasOk: true,
    };
  }, [vistaId, pieza.id, t, lectura]);

  return (
    <div
      data-testid="vista3d-anim-view"
      style={{ position: 'fixed', inset: 0, background: FONDO, color: '#e9eef5', fontFamily: MONO, display: 'flex', overflow: 'hidden' }}
    >
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }} data-testid="v3d-visor">
        {malla && caja ? (
          <Canvas
            data-testid="v3d-canvas"
            camera={{ fov: 38, position: [120, -120, 90], up: [0, 0, 1] }}
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 2]}
            onCreated={({ gl }) => { gl.setClearColor(FONDO); (window as any).__vista3dCanvasOk = true; }}
          >
            <ambientLight intensity={0.55} />
            <directionalLight position={[1, -1.4, 2.2]} intensity={1.55} />
            <directionalLight position={[-1.6, 1.1, -0.7]} intensity={0.55} color="#7fa6d8" />
            <Encuadre caja={caja} controles={controles} />
            {vistaId === 'apertura'
              ? <VistaApertura key="ap" malla={malla} caja={caja} spec={spec} t={t} onLectura={onLectura} nombre={pieza.nombre} onEscena={setEscAp} />
              : <VistaLlenado key="ll" malla={malla} caja={caja} spec={spec} t={t} onLectura={onLectura} onEscena={setEscLl} />}
            <OrbitControls ref={controles} makeDefault enableDamping dampingFactor={0.11} />
          </Canvas>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#8fa3bd', font: `600 13px ${MONO}` }}>{cargando}</div>
        )}

        <div style={{ position: 'absolute', left: 16, top: 14, pointerEvents: 'none' }}>
          <div style={{ font: `700 15px ${MONO}`, color: ORO, letterSpacing: 0.5 }}>{meta.icono} {meta.nombre}</div>
          <div style={{ font: `400 11px ${MONO}`, color: '#8fa3bd', marginTop: 3 }}>
            {pieza.nombre} · {meta.seccion} · banco de prueba (dev)
          </div>
        </div>
      </div>

      {/* ── PANEL ── */}
      <div style={{ width: 400, flex: '0 0 400px', borderLeft: '1px solid #223046', padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <button data-testid="v3d-vista-apertura" style={cajaBoton(vistaId === 'apertura')} onClick={() => setVistaId('apertura')}>{META_AP.icono} {META_AP.nombre}</button>
          <button data-testid="v3d-vista-llenado" style={cajaBoton(vistaId === 'llenado')} onClick={() => setVistaId('llenado')}>{META_LL.icono} {META_LL.nombre}</button>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {PIEZAS.map((x) => (
            <button key={x.id} data-testid={`v3d-pieza-${x.id}`} style={{ ...cajaBoton(x.id === piezaId), font: `600 10.5px ${MONO}`, padding: '5px 8px' }} onClick={() => setPiezaId(x.id)}>{x.nombre}</button>
          ))}
        </div>

        <div style={{ background: 'rgba(14,20,30,0.82)', border: '1px solid #223046', borderRadius: 9, padding: '9px 11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: `700 11px ${MONO}`, color: ORO }}>
            <span>{meta.control.etiqueta}</span>
            <span data-testid="v3d-t">{t.toFixed(3)}</span>
          </div>
          <input
            data-testid="v3d-slider"
            type="range" min={meta.control.min} max={meta.control.max} step={meta.control.paso}
            value={t} onChange={(e) => { setPlay(false); setT(Number(e.target.value)); }}
            style={{ width: '100%', marginTop: 6, accentColor: ORO }}
          />
          {meta.reproducible && (
            <button data-testid="v3d-play" style={{ ...cajaBoton(play), marginTop: 6 }} onClick={() => setPlay((v) => !v)}>
              {play ? '⏸ pausa' : '▶ reproducir'}
            </button>
          )}
        </div>

        <div data-testid="v3d-lectura" style={{ background: 'rgba(14,20,30,0.82)', border: `1px solid ${ORO}`, borderRadius: 9, padding: '9px 11px' }}>
          <div style={{ font: `700 11px ${MONO}`, color: ORO }}>{lectura ? lectura.titulo : '—'}</div>
          <div style={{ font: `700 14px ${MONO}`, marginTop: 4 }}>{lectura ? lectura.valor : '…'}</div>
          {lectura?.nota && <div style={{ font: `400 10.5px ${MONO}`, color: '#8fa3bd', marginTop: 5, lineHeight: 1.5 }}>{lectura.nota}</div>}
          <div style={{ font: `400 10px ${MONO}`, color: '#6b7f99', marginTop: 5 }}>{lectura ? lectura.seccion : ''}</div>
        </div>

        <div data-testid="v3d-leyenda" style={{ background: 'rgba(14,20,30,0.82)', border: '1px solid #223046', borderRadius: 9, padding: '9px 11px' }}>
          {vistaId === 'apertura' ? <LeyendaApertura esc={escAp} /> : <LeyendaLlenado esc={escLl} />}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Banco />
  </StrictMode>,
);
