/**
 * ARNÉS de las VISTAS 3D DE CAMPO (alabeo · agua).
 * ============================================================================
 * Monta las dos vistas EXACTAMENTE como el Estudio Vivo las va a montar: le pasa
 * `malla`, `caja`, `spec`, `t` y recibe `onLectura`. Nada de esta página entra al
 * componente: si algo se ve bien aquí y mal en el Estudio, la culpa es del
 * contrato, no de la vista.
 *
 * El `spec` se arma con la MISMA cadena que usa la capa térmica del Estudio
 * (`dfmFromMesh` → `moldMachine` → `packageToAssemblySpec`), y se le cuelga
 * `warpageTopology` — que `MoldAssemblySpec` no lleva y la vista del alabeo sí
 * necesita para saber si la pieza es un MARCO (§10.3.1: un marco NO pandea).
 */
import { StrictMode, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import { parseSTL } from './forja/mold/stl';
import { dfmFromMesh } from './forja/mold/dfm-mesh';
import { moldMachine } from './forja/mold/moldmachine';
import { packageToAssemblySpec } from './forja/mold/mold-plano-set';
import { cajaDe, volumenArea, PIEZAS, type Caja, type MallaSimple } from './forja/mold/estudio-vivo-datos';
import type { LecturaVista3D } from './forja/mold/vista3d-comun';

const VistaAlabeo = lazy(() => import('./forja/mold/vista3d-alabeo'));
const VistaAgua = lazy(() => import('./forja/mold/vista3d-agua'));

const ORO = '#c9a227';
const FONDO = '#05070b';
const MONO = "'JetBrains Mono', monospace";

const VISTAS = [
  { id: 'alabeo', nombre: 'LA PIEZA SE DEFORMA', icono: '≋', seccion: '§10.3.1 · L17', etiqueta: 'exageración' },
  { id: 'agua', nombre: 'EL CIRCUITO DE AGUA', icono: '❄', seccion: '§9.2.7 · L10', etiqueta: 'recorrido del refrigerante' },
] as const;
type VistaId = typeof VISTAS[number]['id'];

/** Encuadre determinista a la caja de la pieza — copiado de `EstudioVivo.tsx`
 *  A PROPÓSITO: las vistas tienen que verse bien con ESE encuadre, no con uno
 *  hecho a su medida. Por eso las dos se encajan solas dentro de `caja`. */
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

const cajaUI: React.CSSProperties = {
  background: 'rgba(14,20,30,0.86)', border: '1px solid #223046', borderRadius: 9, padding: '9px 11px',
};
const btn = (on: boolean): React.CSSProperties => ({
  background: on ? 'rgba(201,162,39,0.16)' : 'rgba(20,28,40,0.8)',
  border: `1px solid ${on ? ORO : '#2a3a52'}`, color: on ? ORO : '#c3d0e0',
  borderRadius: 7, padding: '6px 9px', font: `600 11px ${MONO}`, cursor: 'pointer', textAlign: 'left',
});

function Pagina() {
  const [piezaId, setPiezaId] = useState(PIEZAS[0].id);
  const [vista, setVista] = useState<VistaId>('alabeo');
  const [t, setT] = useState(0.5);
  const [cruda, setCruda] = useState<MallaSimple | null>(null);
  const [cargando, setCargando] = useState('');
  const [fallo, setFallo] = useState('');
  const [lectura, setLectura] = useState<LecturaVista3D | null>(null);
  const controles = useRef<any>(null);

  const pieza = PIEZAS.find((p) => p.id === piezaId) ?? PIEZAS[0];

  useEffect(() => {
    let vivo = true;
    setCruda(null); setFallo(''); setCargando(`cargando ${pieza.nombre}…`);
    (async () => {
      try {
        let r = await fetch('/' + pieza.ruta);
        if (!r.ok) r = await fetch('/@fs/home/ian/Orkesta/la-forja/' + pieza.ruta);
        if (!r.ok) throw new Error(`HTTP ${r.status} al pedir ${pieza.ruta}`);
        const m = parseSTL(await r.arrayBuffer());
        if (vivo) { setCruda(m); setCargando(''); }
      } catch (e) {
        if (vivo) { setFallo(String(e).slice(0, 200)); setCargando(''); }
      }
    })();
    return () => { vivo = false; };
  }, [pieza.ruta, pieza.nombre]);

  const caja = useMemo(() => (cruda ? cajaDe(cruda) : null), [cruda]);

  /* ── el SPEC, con la misma cadena de la capa térmica del Estudio ── */
  const spec = useMemo(() => {
    if (!cruda || !caja) return null;
    try {
      const dfm = dfmFromMesh(cruda, {});
      const va = volumenArea(cruda);
      const entrada = {
        name: pieza.nombre,
        Lmm: +(caja.x1 - caja.x0).toFixed(1), Wmm: +(caja.y1 - caja.y0).toFixed(1), Hmm: +(caja.z1 - caja.z0).toFixed(1),
        surfaceMm2: Math.round(va.areaMm2), volumeMm3: Math.round(va.volumeMm3),
        wallMm: dfm.wall.p50Mm || 2, plastic: 'ABS', annualVolume: 500_000,
        projectedAreaMm2: dfm.projectedAreaMm2, warpageTopology: dfm.warpageTopology,
      } as any;
      const asm: any = packageToAssemblySpec(moldMachine(entrada));
      // `MoldAssemblySpec` no lleva la topología de alabeo y la vista L17 la
      // necesita (§10.3.1: un MARCO no pandea). Se cuelga aquí, declarado.
      asm.warpageTopology = dfm.warpageTopology;
      return asm;
    } catch (e) {
      setFallo(`spec: ${String(e).slice(0, 180)}`);
      return null;
    }
  }, [cruda, caja, pieza.nombre]);

  const onLectura = useCallback((l: LecturaVista3D) => setLectura(l), []);
  useEffect(() => { setLectura(null); }, [vista, piezaId]);

  useEffect(() => {
    (window as any).__vista3dApp = {
      pieza: pieza.nombre, vista, t,
      listo: !!cruda && !!caja,
      nTri: cruda ? Math.floor((cruda.indices as any).length / 3) : 0,
      spec: spec ? { widthMm: spec.widthMm, nCav: spec.nCav, coolingDiaMm: spec.cooling?.diaMm, wallMm: spec.cavity?.wallMm } : null,
      lectura, fallo,
    };
  }, [pieza.nombre, vista, t, cruda, caja, spec, lectura, fallo]);

  const def = VISTAS.find((v) => v.id === vista)!;

  return (
    <div data-testid="v3d-view" style={{ position: 'fixed', inset: 0, background: FONDO, color: '#e9eef5', fontFamily: MONO, display: 'flex', overflow: 'hidden' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }} data-testid="v3d-visor">
        {cruda && caja ? (
          <Canvas
            data-testid="v3d-canvas"
            camera={{ fov: 38, position: [120, -120, 90], up: [0, 0, 1] }}
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 2]}
            onCreated={({ gl }) => { gl.setClearColor(FONDO); (window as any).__vista3dCanvasOk = true; }}
          >
            <ambientLight intensity={0.62} />
            <directionalLight position={[1, -1.4, 2.2]} intensity={1.5} />
            <directionalLight position={[-1.6, 1.1, -0.7]} intensity={0.55} color="#7fa6d8" />
            <Encuadre caja={caja} controles={controles} />
            <Suspense fallback={null}>
              {vista === 'alabeo'
                ? <VistaAlabeo malla={cruda} caja={caja} spec={spec} t={t} onLectura={onLectura} />
                : <VistaAgua malla={cruda} caja={caja} spec={spec} t={t} onLectura={onLectura} />}
            </Suspense>
            <OrbitControls ref={controles} makeDefault enableDamping dampingFactor={0.11} />
          </Canvas>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#8fa3bd', font: `600 13px ${MONO}` }}>
            {fallo ? `⚠ ${fallo}` : (cargando || 'preparando…')}
          </div>
        )}
        <div style={{ position: 'absolute', left: 16, top: 14, pointerEvents: 'none' }}>
          <div style={{ font: `700 15px ${MONO}`, color: ORO, letterSpacing: 0.5 }}>VISTAS 3D DE CAMPO</div>
          <div style={{ font: `400 11px ${MONO}`, color: '#8fa3bd', marginTop: 3 }}>
            {pieza.nombre} · {def.icono} {def.nombre} · {def.seccion}
          </div>
        </div>
      </div>

      <div style={{ width: 344, flex: '0 0 auto', borderLeft: '1px solid #182234', background: '#080d16', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        <div style={cajaUI}>
          <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 6 }}>VISTA</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {VISTAS.map((v) => (
              <button key={v.id} data-testid={`v3d-vista-${v.id}`} style={btn(vista === v.id)} onClick={() => setVista(v.id)}>
                {v.icono} {v.nombre} — {v.seccion}
              </button>
            ))}
          </div>
        </div>

        <div style={cajaUI}>
          <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 6 }}>
            {def.etiqueta.toUpperCase()} · t = {t.toFixed(3)}
          </div>
          <input
            data-testid="v3d-t" type="range" min={0} max={1} step={0.005} value={t}
            onChange={(e) => setT(Number(e.target.value))}
            style={{ width: '100%', accentColor: ORO }}
          />
        </div>

        <div style={cajaUI} data-testid="v3d-lectura">
          <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 5 }}>LECTURA</div>
          {lectura ? (
            <>
              <div style={{ font: `600 11px ${MONO}`, color: '#c3d0e0' }}>{lectura.titulo}</div>
              <div style={{ font: `700 13px ${MONO}`, color: '#e9eef5', margin: '4px 0' }}>{lectura.valor}</div>
              {lectura.nota && <div style={{ font: `400 10px ${MONO}`, color: '#8fa3bd', lineHeight: 1.45 }}>{lectura.nota}</div>}
              <div style={{ font: `600 9.5px ${MONO}`, color: '#6f8099', marginTop: 5 }}>{lectura.seccion}</div>
            </>
          ) : (
            <div style={{ font: `400 10.5px ${MONO}`, color: '#8fa3bd' }}>toca la escena para sondear</div>
          )}
        </div>

        <div style={cajaUI}>
          <div style={{ font: `700 10.5px ${MONO}`, color: ORO, marginBottom: 6 }}>PIEZA</div>
          <div style={{ display: 'grid', gap: 5 }}>
            {PIEZAS.map((p) => (
              <button key={p.id} data-testid={`v3d-pieza-${p.id}`} style={btn(piezaId === p.id)} onClick={() => setPiezaId(p.id)}>
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
