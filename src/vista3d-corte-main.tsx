/**
 * Entrada de DESARROLLO/ARNÉS de EL CORTE VIVO.
 * ============================================================================
 * El destino de producción es EL ESTUDIO VIVO (`EstudioVivo.tsx` monta el
 * `<group>` de `vista3d-corte.tsx` dentro de SU Canvas). Esta página monta el
 * MISMO componente con las MISMAS luces y la MISMA cámara que el Estudio, para
 * que `scripts/vista3d-corte-ss.cjs` lo pueda MANEJAR de verdad sin tocar el
 * panel de 1300 líneas — y para poder abrir la vista sola, sin OCCT.
 *
 * NO se agrega a `vite.config.ts`: es una entrada de dev, se abre por su .html.
 */
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { parseSTL } from './forja/mold/stl';
import { cajaDe, volumenArea, PIEZAS, type Caja, type MallaSimple } from './forja/mold/estudio-vivo-datos';
import VistaCorte, { META, type PropsVista3D } from './forja/mold/vista3d-corte';
import type { Eje, Lectura } from './forja/mold/vista3d-corte-datos';

const ORO = '#c9a227';
const FONDO = '#05070b';
const MONO = "'JetBrains Mono', monospace";

/** encuadre: coloca la cámara para que la caja llene el cuadro (como el Estudio).
 *  Se mira MAYORMENTE a lo largo del eje del corte, con un sesgo de 3/4: de frente
 *  la cara del corte se lee como la lámina, y el sesgo deja ver que es 3D. */
function Encuadre({ caja, controles, sello, eje }: { caja: Caja | null; controles: React.RefObject<any>; sello: number; eje: Eje }) {
  const { camera } = useThree();
  useEffect(() => {
    if (!caja) return;
    const cx = (caja.x0 + caja.x1) / 2, cy = (caja.y0 + caja.y1) / 2, cz = (caja.z0 + caja.z1) / 2;
    // radio de la ESFERA que envuelve la caja (no el lado mayor): con el lado
    // mayor, el molde de 300×230×248 se salía del cuadro por las esquinas
    const r = 0.5 * Math.hypot(caja.x1 - caja.x0, caja.y1 - caja.y0, caja.z1 - caja.z0) || 50;
    const fov = ((camera as THREE.PerspectiveCamera).fov ?? 38) * Math.PI / 180;
    const d = (r / Math.tan(fov / 2)) * 1.08;
    const dir = eje === 'x' ? [0.84, -0.40, 0.30] : eje === 'y' ? [0.40, -0.84, 0.30] : [0.40, -0.42, 0.86];
    camera.position.set(cx + d * dir[0], cy + d * dir[1], cz + d * dir[2]);
    camera.up.set(0, 0, 1);
    camera.lookAt(cx, cy, cz);
    (camera as THREE.PerspectiveCamera).near = Math.max(0.1, r * 0.01);
    (camera as THREE.PerspectiveCamera).far = r * 60;
    camera.updateProjectionMatrix();
    if (controles.current) { controles.current.target.set(cx, cy, cz); controles.current.update(); }
  }, [caja, camera, controles, sello, eje]);
  return null;
}

const caja: React.CSSProperties = {
  background: 'rgba(14,20,30,0.82)', border: '1px solid #223046', borderRadius: 9, padding: '9px 11px',
};
const btn = (on: boolean): React.CSSProperties => ({
  background: on ? 'rgba(201,162,39,0.16)' : 'rgba(20,28,40,0.8)',
  border: `1px solid ${on ? ORO : '#2a3a52'}`, color: on ? ORO : '#c3d0e0',
  borderRadius: 7, padding: '6px 9px', font: `600 11px ${MONO}`, cursor: 'pointer', textAlign: 'left',
});

function Pagina() {
  const [piezaId, setPiezaId] = useState(PIEZAS[0].id);
  const [t, setT] = useState<number>(META.control.inicial);
  const [eje, setEje] = useState<Eje>('x');
  const [conSpec, setConSpec] = useState(true);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [malla, setMalla] = useState<MallaSimple | null>(null);
  const [fallo, setFallo] = useState('');
  const [foco, setFoco] = useState<'molde' | 'pieza'>('molde');
  const [sello, setSello] = useState(0);
  const controles = useRef<any>(null);
  const pieza = PIEZAS.find((p) => p.id === piezaId) ?? PIEZAS[0];

  useEffect(() => {
    let vivo = true;
    setMalla(null); setFallo(''); setLectura(null);
    (async () => {
      try {
        let r = await fetch('/' + pieza.ruta);
        if (!r.ok) r = await fetch('/@fs/home/ian/Orkesta/la-forja/' + pieza.ruta);
        if (!r.ok) throw new Error(`HTTP ${r.status} al pedir ${pieza.ruta}`);
        const m = parseSTL(await r.arrayBuffer());
        if (vivo) setMalla(m);
      } catch (e) { if (vivo) setFallo(String(e).slice(0, 200)); }
    })();
    return () => { vivo = false; };
  }, [pieza.ruta]);

  const cajaPieza = useMemo(() => (malla ? cajaDe(malla) : null), [malla]);

  /** el spec que el Estudio ya sabe armar (EstudioVivo.tsx hace exactamente esto
   *  para el térmico). Con `conSpec=false` se prueba el camino de respaldo. */
  const spec = useMemo(() => {
    if (!malla || !cajaPieza || !conSpec) return null;
    const va = volumenArea(malla);
    return {
      name: pieza.nombre,
      Lmm: +(cajaPieza.x1 - cajaPieza.x0).toFixed(1),
      Wmm: +(cajaPieza.y1 - cajaPieza.y0).toFixed(1),
      Hmm: +(cajaPieza.z1 - cajaPieza.z0).toFixed(1),
      surfaceMm2: Math.round(va.areaMm2), volumeMm3: Math.round(va.volumeMm3),
      wallMm: 2, plastic: 'ABS', annualVolume: 500_000,
    };
  }, [malla, cajaPieza, conSpec, pieza.nombre]);

  const [cajaMolde, setCajaMolde] = useState<Caja | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const v = (window as any).__vista3dCorte;
      if (v && v.cajaMolde) {
        setCajaMolde((c) => (c && c.x0 === v.cajaMolde.x0 && c.z1 === v.cajaMolde.z1 ? c : v.cajaMolde));
      }
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  const props: PropsVista3D | null = malla && cajaPieza
    ? { malla, caja: cajaPieza, spec, t, eje, onLectura: setLectura }
    : null;

  const irAlSprue = () => {
    const v = (window as any).__vista3dCorte;
    if (v && v.tSprue) setT(v.tSprue[eje]);
  };

  return (
    <div
      data-testid="vista3d-corte-view"
      style={{ position: 'fixed', inset: 0, background: FONDO, color: '#e9eef5', fontFamily: MONO, display: 'flex', overflow: 'hidden' }}
    >
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }} data-testid="vc-visor">
        {props ? (
          <Canvas
            data-testid="vc-canvas"
            camera={{ fov: 38, position: [120, -120, 90], up: [0, 0, 1] }}
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 2]}
            onCreated={({ gl }) => { gl.setClearColor(FONDO); (window as any).__vcCanvasOk = true; }}
          >
            <ambientLight intensity={0.55} />
            <directionalLight position={[1, -1.4, 2.2]} intensity={1.55} />
            <directionalLight position={[-1.6, 1.1, -0.7]} intensity={0.55} color="#7fa6d8" />
            <Encuadre caja={foco === 'molde' ? (cajaMolde ?? cajaPieza) : cajaPieza} controles={controles} sello={sello} eje={eje} />
            <VistaCorte {...props} />
            <OrbitControls ref={controles} makeDefault enableDamping dampingFactor={0.11} />
          </Canvas>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#8fa3bd', font: `600 13px ${MONO}` }}>
            {fallo ? `⚠ ${fallo}` : `cargando ${pieza.nombre}…`}
          </div>
        )}

        <div style={{ position: 'absolute', left: 16, top: 14, pointerEvents: 'none' }}>
          <div style={{ font: `700 15px ${MONO}`, color: ORO, letterSpacing: 0.5 }}>{META.icono} {META.nombre}</div>
          <div style={{ font: `400 11px ${MONO}`, color: '#8fa3bd', marginTop: 3 }}>
            {pieza.nombre} · {META.seccion}
          </div>
        </div>

        {/* EL CONTROL: el corte se arrastra y el molde se abre en vivo */}
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14, ...caja }} data-testid="vc-control">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ font: `700 11px ${MONO}`, color: ORO, whiteSpace: 'nowrap' }}>{META.control.etiqueta}</span>
            <input
              data-testid="vc-corte" type="range"
              min={META.control.min} max={META.control.max} step={META.control.paso}
              value={t} onChange={(e) => setT(+e.target.value)}
              style={{ flex: 1, accentColor: ORO }}
            />
            <span data-testid="vc-t" style={{ font: `700 11px ${MONO}`, color: '#e9eef5', width: 52, textAlign: 'right' }}>{t.toFixed(3)}</span>
            {(['x', 'y', 'z'] as Eje[]).map((e) => (
              <button key={e} data-testid={`vc-eje-${e}`} onClick={() => setEje(e)} style={btn(eje === e)}>eje {e.toUpperCase()}</button>
            ))}
            <button data-testid="vc-sprue" onClick={irAlSprue} style={btn(false)}>al sprue (L5)</button>
          </div>
        </div>
      </div>

      {/* panel de lectura + verificación */}
      <div style={{ width: 340, borderLeft: '1px solid #223046', padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PIEZAS.map((p) => (
            <button key={p.id} data-testid={`vc-pieza-${p.id}`} onClick={() => setPiezaId(p.id)} style={btn(p.id === piezaId)}>{p.nombre}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button data-testid="vc-spec" onClick={() => setConSpec((v) => !v)} style={btn(conSpec)}>
            {conSpec ? 'spec de la Máquina' : 'sin spec (derivado)'}
          </button>
          <button data-testid="vc-foco" onClick={() => { setFoco((f) => (f === 'molde' ? 'pieza' : 'molde')); setSello((s) => s + 1); }} style={btn(true)}>
            encuadre: {foco}
          </button>
        </div>

        <div style={caja} data-testid="vc-lectura">
          <div style={{ font: `700 11px ${MONO}`, color: ORO, marginBottom: 5 }}>SONDA — clic en la cara del corte</div>
          {lectura ? (
            <>
              <div style={{ font: `700 12px ${MONO}`, color: '#e9eef5' }}>{lectura.titulo}</div>
              <div style={{ font: `700 13px ${MONO}`, color: '#59d98c', margin: '3px 0' }}>{lectura.valor}</div>
              <div style={{ font: `400 10.5px ${MONO}`, color: '#8fa3bd', lineHeight: 1.45 }}>{lectura.nota}</div>
              <div style={{ font: `700 10px ${MONO}`, color: ORO, marginTop: 4 }}>{lectura.seccion}</div>
            </>
          ) : (
            <div style={{ font: `400 11px ${MONO}`, color: '#8fa3bd' }}>sin lectura todavía</div>
          )}
        </div>

        <Verificacion />
      </div>
    </div>
  );
}

/** la barra de verdad: veredictos del libro sobre el corte ACTUAL */
function Verificacion() {
  const [v, setV] = useState<any>(null);
  useEffect(() => {
    const id = window.setInterval(() => setV({ ...(window as any).__vista3dCorte }), 350);
    return () => window.clearInterval(id);
  }, []);
  if (!v || !v.listo) return <div style={{ ...caja, font: `400 11px ${MONO}`, color: '#8fa3bd' }}>armando el molde…</div>;
  const col: Record<string, string> = { CUMPLE: '#59d98c', ADVIERTE: '#ffb347', VIOLA: '#ff5c5c', 'SIN CABLEAR': '#8fa3bd' };
  return (
    <div style={caja} data-testid="vc-verificacion">
      <div style={{ font: `700 11px ${MONO}`, color: ORO, marginBottom: 5 }}>VERIFICACIÓN</div>
      <div style={{ font: `400 10.5px ${MONO}`, color: '#8fa3bd', lineHeight: 1.5 }}>
        corte en {v.cMm} mm (eje {v.eje}) · {v.cortadas} componentes cortados · {v.areaMm2} mm²<br />
        {v.ms} ms por corte · molde {v.nTriMolde} tri · tapas fallidas {v.tapasFallidas} · lazos abiertos {v.lazosAbiertos}<br />
        {v.origen}
        {v.supuesto ? <><br /><span style={{ color: '#ffb347' }}>⚠ {v.supuesto}</span></> : null}
        {v.carasTangentes ? <><br /><span style={{ color: '#ffb347' }}>⚠ {v.carasTangentes} triángulos tangentes al plano</span></> : null}
        {v.corrimientoMm ? <><br /><span style={{ color: '#8fa3bd' }}>plano corrido {v.corrimientoMm} mm para salir de una cara tangente</span></> : null}
        {v.aviso ? <><br /><span style={{ color: '#ffb347' }}>{v.aviso}</span></> : null}
        {v.razonSinCotas ? <><br /><span style={{ color: '#ffb347' }}>{v.razonSinCotas}</span></> : null}
      </div>
      <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(v.veredictos ?? []).map((x: any) => (
          <div key={x.id} style={{ font: `400 10px ${MONO}`, color: col[x.estado] ?? '#8fa3bd' }}>
            <b>{x.estado}</b> · {x.id} {x.medido ? `· ${x.medido}` : ''} {x.limite ? `· ${x.limite}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
