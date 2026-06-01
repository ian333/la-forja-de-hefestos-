/**
 * ⚒️ La Forja — EL PRIMER MOMENTO DEL DISEÑADOR (Part Studio B-Rep)
 * =================================================================
 * Flujo CAD mínimo pero REAL: el diseñador define un perfil 2D paramétrico
 * (rectángulo con cotas, o círculo con radio) y lo EXTRUYE a un sólido B-Rep
 * EXACTO vía OpenCASCADE (CPU/WASM). El sólido se TESELA (BRepMesh) y se
 * renderiza en R3F (GPU) con la estética GAIA.
 *
 * Filosofía: la geometría es exacta (no SDF, no malla aproximada de entrada).
 * Cada extrusión reporta sus INVARIANTES en vivo:
 *   - Volumen del kernel (GProp) vs. volumen analítico → coinciden a 1e-6.
 *   - Topología (V−E+F) → Euler = 2 para sólido simple.
 *
 * UI (Plasticity/Onshape): el viewport es el producto (100% de pantalla, fondo
 * casi-negro). Los paneles flotan encima como vidrio. El documento es un grafo
 * de features (Sketch → Extrude), no un archivo.
 *
 * Frontera de cómputo: CPU(OCCT)=geometría exacta + STEP. GPU(R3F)=render.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Environment } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import {
  initOCCT,
  _setActiveOCCT,
  extrudePolygon,
  extrudeCircle,
  tessellate,
  topology,
  volume,
  surfaceArea,
  exportSTEP,
  type OC,
  type Pt2,
  type TessellatedMesh,
} from './occt';

// ──────────────────────────────────────────────────────────────────
// Paleta GAIA
// ──────────────────────────────────────────────────────────────────
const GOLD = '#FDB813';
const GOLD_DIM = '#c9a84c';
const STEEL = '#9fb3c8';
const INK = '#05060A';

// ──────────────────────────────────────────────────────────────────
// Tipos del documento (grafo de features)
// ──────────────────────────────────────────────────────────────────
type ProfileKind = 'rect' | 'circle';

interface SketchParams {
  kind: ProfileKind;
  /** rectángulo: ancho (mm). círculo: ignorado. */
  width: number;
  /** rectángulo: alto (mm). círculo: ignorado. */
  height: number;
  /** círculo: radio (mm). rectángulo: ignorado. */
  radius: number;
}

interface ExtrudeParams {
  /** distancia de extrusión a lo largo de la normal del plano (mm). */
  depth: number;
}

interface BuildResult {
  mesh: TessellatedMesh;
  topo: { faces: number; edges: number; vertices: number; euler: number };
  volExact: number;
  volKernel: number;
  area: number;
  stepBytes: number;
  /** error relativo |vol_kernel − vol_analítico| / vol_analítico. */
  volErr: number;
}

// ──────────────────────────────────────────────────────────────────
// Construcción del perfil 2D paramétrico (cerrado, CCW)
// ──────────────────────────────────────────────────────────────────
function rectProfile(w: number, h: number): Pt2[] {
  // Centrado en el origen del plano de boceto.
  const hx = w / 2;
  const hy = h / 2;
  return [
    { x: -hx, y: -hy },
    { x: hx, y: -hy },
    { x: hx, y: hy },
    { x: -hx, y: hy },
  ];
}

// ──────────────────────────────────────────────────────────────────
// Render del sólido teselado (malla EXACTA del kernel → BufferGeometry)
// ──────────────────────────────────────────────────────────────────
function SolidMesh({ mesh, faded }: { mesh: TessellatedMesh; faded: boolean }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [mesh]);

  // Aristas verdaderas (no del wireframe de la malla): usamos EdgesGeometry con
  // umbral angular para marcar solo los bordes geométricos del sólido.
  const edges = useMemo(() => new THREE.EdgesGeometry(geom, 25), [geom]);

  useEffect(() => () => { geom.dispose(); edges.dispose(); }, [geom, edges]);

  return (
    <group>
      {/* Metal mecanizado: lo lee el HDR studio (reflejos), no la emisión.
          El tinte cálido + roughness medio dan acabado de aluminio anodizado. */}
      <mesh geometry={geom} castShadow receiveShadow>
        <meshStandardMaterial
          color={faded ? '#8a96a4' : '#bcc6d2'}
          metalness={0.82}
          roughness={0.52}
          emissive={'#16110a'}
          emissiveIntensity={0.2}
          envMapIntensity={0.9}
        />
      </mesh>
      {/* Aristas reales del sólido (EdgesGeometry, no wireframe de malla). */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={GOLD} transparent opacity={0.7} />
      </lineSegments>
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────
// El perfil 2D flotando en su plano (el "sketch" antes de extruir)
// ──────────────────────────────────────────────────────────────────
function ProfileGhost({ pts }: { pts: Pt2[] }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr: number[] = [];
    const n = pts.length;
    for (let i = 0; i <= n; i++) {
      const p = pts[i % n];
      arr.push(p.x, p.y, 0);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, [pts]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <line>
      <bufferGeometry attach="geometry" {...geo} />
      <lineBasicMaterial color={GOLD} transparent opacity={0.9} />
    </line>
  );
}

// ──────────────────────────────────────────────────────────────────
// Plano de boceto sutil (rejilla mínima, NO agresiva)
// ──────────────────────────────────────────────────────────────────
function SketchPlane() {
  return (
    <gridHelper
      args={[120, 24, new THREE.Color('#243140'), new THREE.Color('#161e29')]}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, -0.01]}
    />
  );
}

// ──────────────────────────────────────────────────────────────────
// HUD: cota numérica de un parámetro (estilo Onshape — clic = editable)
// ──────────────────────────────────────────────────────────────────
function Dim({
  label,
  value,
  unit,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <label className="fb-dim">
      <span className="fb-dim-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="fb-dim-val">
        {value.toFixed(step < 1 ? 1 : 0)}
        <em>{unit}</em>
      </span>
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────
export default function ForgeBRepStudio() {
  const [oc, setOc] = useState<OC | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [sketch, setSketch] = useState<SketchParams>({
    kind: 'rect',
    width: 40,
    height: 24,
    radius: 14,
  });
  const [extrude, setExtrude] = useState<ExtrudeParams>({ depth: 12 });
  const [result, setResult] = useState<BuildResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [showSketch, setShowSketch] = useState(true);
  const [hideChrome, setHideChrome] = useState(false);
  const stepBlobUrl = useRef<string | null>(null);

  // Perfil 2D vivo (para el ghost).
  const profilePts = useMemo<Pt2[]>(() => {
    if (sketch.kind === 'rect') return rectProfile(sketch.width, sketch.height);
    // círculo aproximado solo para el ghost visual (la geometría real es exacta)
    const pts: Pt2[] = [];
    const N = 64;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * sketch.radius, y: Math.sin(a) * sketch.radius });
    }
    return pts;
  }, [sketch]);

  // Volumen analítico esperado (el norte).
  const volAnalytic = useMemo(() => {
    if (sketch.kind === 'rect') return sketch.width * sketch.height * extrude.depth;
    return Math.PI * sketch.radius * sketch.radius * extrude.depth;
  }, [sketch, extrude]);

  // ── Boot del kernel OCCT-WASM (en el navegador) ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const instance = await initOCCT();
        if (!alive) return;
        _setActiveOCCT(instance);
        setOc(instance);
      } catch (e) {
        if (!alive) return;
        setBootErr(String((e as Error)?.message ?? e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── Construcción B-Rep: perfil → extrusión → malla + invariantes ──
  const build = useCallback(() => {
    if (!oc) return;
    setBuilding(true);
    // Defer para que el botón muestre el estado antes del cómputo síncrono WASM.
    requestAnimationFrame(() => {
      try {
        let shape;
        if (sketch.kind === 'rect') {
          shape = extrudePolygon(oc, rectProfile(sketch.width, sketch.height), extrude.depth);
        } else {
          shape = extrudeCircle(oc, { x: 0, y: 0 }, sketch.radius, extrude.depth);
        }
        const mesh = tessellate(oc, shape, 0.08, 0.3);
        const topo = topology(oc, shape);
        const volKernel = volume(oc, shape);
        const area = surfaceArea(oc, shape);
        const step = exportSTEP(oc, shape, 'forja-part.step');
        const volErr = Math.abs(volKernel - volAnalytic) / Math.max(volAnalytic, 1e-9);

        // Prepara descarga STEP.
        if (stepBlobUrl.current) URL.revokeObjectURL(stepBlobUrl.current);
        stepBlobUrl.current = URL.createObjectURL(
          new Blob([step], { type: 'application/step' }),
        );

        setResult({
          mesh,
          topo,
          volExact: volAnalytic,
          volKernel,
          area,
          stepBytes: step.length,
          volErr,
        });
        shape.delete?.();
      } catch (e) {
        setBootErr(String((e as Error)?.message ?? e));
      } finally {
        setBuilding(false);
      }
    });
  }, [oc, sketch, extrude, volAnalytic]);

  // Auto-build cuando el kernel está listo y cuando cambian los parámetros.
  useEffect(() => {
    if (oc) build();
  }, [oc, build]);

  // Tecla H: esconder/mostrar el chrome (la pieza es la protagonista).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') setHideChrome((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── QA hook headless (Playwright en iangpu) ──
  useEffect(() => {
    const api = {
      get ready() {
        return !!oc && !!result;
      },
      get invariants() {
        return result
          ? {
              kind: sketch.kind,
              faces: result.topo.faces,
              edges: result.topo.edges,
              vertices: result.topo.vertices,
              euler: result.topo.euler,
              vol_kernel: result.volKernel,
              vol_analytic: result.volExact,
              vol_err: result.volErr,
              area: result.area,
              step_bytes: result.stepBytes,
              tris: result.mesh.triangleCount,
            }
          : null;
      },
      setSketch,
      setExtrude,
    };
    (window as unknown as { __forgeBrep?: typeof api }).__forgeBrep = api;
    return () => {
      delete (window as unknown as { __forgeBrep?: unknown }).__forgeBrep;
    };
  }, [oc, result, sketch.kind]);

  const cameraDist = useMemo(() => {
    const span = sketch.kind === 'rect'
      ? Math.max(sketch.width, sketch.height, extrude.depth)
      : Math.max(sketch.radius * 2, extrude.depth);
    return Math.max(40, span * 2.4);
  }, [sketch, extrude]);

  const ok = result ? result.volErr < 1e-5 && result.topo.euler === 2 : false;

  return (
    <div className="fb-root">
      <style>{CSS}</style>

      {/* ── VIEWPORT (el producto) ── */}
      <div className="fb-viewport">
        <Stage
          cameraDistance={cameraDist}
          autoRotate
          bgColor={INK}
          bloomIntensity={0.45}
          bloomThreshold={0.95}
          minDistance={cameraDist * 0.25}
          maxDistance={cameraDist * 4}
        >
          {/* HDR studio: da reflejos PBR al metal mecanizado (no es fondo). */}
          <Environment
            files="/hdri/studio_small_03_1k.hdr"
            backgroundIntensity={0}
            environmentIntensity={1.0}
          />
          {/* El sólido se modela centrado en el plano y se extruye en +Z; lo
              recolocamos para que se asiente sobre el plano de boceto. */}
          <group rotation={[-Math.PI / 2, 0, 0]}>
            {showSketch && <SketchPlane />}
            {showSketch && <ProfileGhost pts={profilePts} />}
            {result && (
              <SolidMesh mesh={result.mesh} faded={building} />
            )}
          </group>
        </Stage>
      </div>

      {/* ── CHROME flotante (vidrio) ── */}
      {!hideChrome && (
        <>
          {/* Encabezado del documento */}
          <header className="fb-header">
            <div className="fb-mark">⚒</div>
            <div className="fb-titles">
              <h1>La Forja · Part Studio</h1>
              <p>Sketch → Extrude · kernel B-Rep exacto (OpenCASCADE)</p>
            </div>
            <div className={`fb-kernel ${oc ? 'on' : 'off'}`}>
              <span className="dot" />
              {oc ? 'OCCT-WASM listo' : bootErr ? 'kernel falló' : 'cargando kernel…'}
            </div>
          </header>

          {/* Panel izquierdo: el grafo de features */}
          <aside className="fb-features">
            <div className="fb-feat-head">Documento</div>
            <div className="fb-feat-node">
              <span className="ico">▣</span>
              <div>
                <strong>Sketch 1</strong>
                <em>{sketch.kind === 'rect' ? 'Rectángulo' : 'Círculo'} · Plano XY</em>
              </div>
            </div>
            <div className="fb-feat-arrow">↓ extrude</div>
            <div className="fb-feat-node accent">
              <span className="ico">⬓</span>
              <div>
                <strong>Extrude 1</strong>
                <em>{extrude.depth.toFixed(0)} mm · sólido nuevo</em>
              </div>
            </div>
          </aside>

          {/* Panel derecho: parámetros (cotas) */}
          <aside className="fb-params">
            <div className="fb-seg">
              <button
                className={sketch.kind === 'rect' ? 'on' : ''}
                onClick={() => setSketch((s) => ({ ...s, kind: 'rect' }))}
              >
                Rectángulo
              </button>
              <button
                className={sketch.kind === 'circle' ? 'on' : ''}
                onClick={() => setSketch((s) => ({ ...s, kind: 'circle' }))}
              >
                Círculo
              </button>
            </div>

            {sketch.kind === 'rect' ? (
              <>
                <Dim label="Ancho" value={sketch.width} unit="mm" min={4} max={80} step={1}
                  onChange={(v) => setSketch((s) => ({ ...s, width: v }))} />
                <Dim label="Alto" value={sketch.height} unit="mm" min={4} max={80} step={1}
                  onChange={(v) => setSketch((s) => ({ ...s, height: v }))} />
              </>
            ) : (
              <Dim label="Radio" value={sketch.radius} unit="mm" min={3} max={40} step={1}
                onChange={(v) => setSketch((s) => ({ ...s, radius: v }))} />
            )}

            <div className="fb-divider" />

            <Dim label="Profundidad" value={extrude.depth} unit="mm" min={2} max={60} step={1}
              onChange={(v) => setExtrude({ depth: v })} />

            <div className="fb-actions">
              <button onClick={() => setShowSketch((v) => !v)}>
                {showSketch ? 'Ocultar boceto' : 'Mostrar boceto'}
              </button>
              <a
                className="fb-export"
                href={stepBlobUrl.current ?? '#'}
                download="forja-part.step"
                aria-disabled={!result}
              >
                Exportar STEP
              </a>
            </div>
          </aside>

          {/* Panel inferior: INVARIANTES en vivo (la corrección visible) */}
          <footer className={`fb-invariants ${ok ? 'ok' : 'pending'}`}>
            {result ? (
              <>
                <div className="inv">
                  <span className="k">Topología</span>
                  <span className="v">
                    V {result.topo.vertices} − E {result.topo.edges} + F {result.topo.faces}
                    {' = '}
                    <b>{result.topo.euler}</b>
                  </span>
                  <span className="chk">{result.topo.euler === 2 ? '✓ sólido simple' : '⚠'}</span>
                </div>
                <div className="inv">
                  <span className="k">Volumen (GProp)</span>
                  <span className="v mono">{result.volKernel.toFixed(3)} mm³</span>
                  <span className="chk">
                    vs analítico {result.volExact.toFixed(3)} · err {result.volErr.toExponential(1)}
                    {' '}
                    {result.volErr < 1e-5 ? '✓ exacto' : '⚠'}
                  </span>
                </div>
                <div className="inv">
                  <span className="k">Malla / STEP</span>
                  <span className="v mono">
                    {result.mesh.triangleCount} △ · {(result.stepBytes / 1024).toFixed(1)} KB STEP
                  </span>
                  <span className="chk">{building ? 'recomputando…' : 'CPU(OCCT) → GPU(R3F)'}</span>
                </div>
              </>
            ) : (
              <div className="inv">
                <span className="k">Estado</span>
                <span className="v">{bootErr ? `Error: ${bootErr}` : 'Extruyendo el primer sólido…'}</span>
              </div>
            )}
          </footer>
        </>
      )}

      {/* Toggle de chrome (tecla H también) */}
      <button className="fb-hide" onClick={() => setHideChrome((v) => !v)} title="Esconder UI (la pieza es la protagonista)">
        {hideChrome ? '◳' : '◲'}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Estilos (vidrio sobre viewport — feel Plasticity/Onshape)
// ──────────────────────────────────────────────────────────────────
const CSS = `
.fb-root{position:fixed;inset:0;overflow:hidden;background:${INK};
  font-family:'Inter',system-ui,sans-serif;color:#e9eef5;}
.fb-viewport{position:absolute;inset:0;}

/* Glass primitives */
.fb-header,.fb-features,.fb-params,.fb-invariants{
  position:absolute;backdrop-filter:blur(14px) saturate(1.2);
  background:rgba(13,18,28,0.62);border:1px solid rgba(159,179,200,0.12);
  border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.5);}

.fb-header{top:18px;left:18px;display:flex;align-items:center;gap:14px;
  padding:11px 16px;}
.fb-mark{font-size:22px;color:${GOLD};filter:drop-shadow(0 0 8px ${GOLD}88);}
.fb-titles h1{font-size:14px;font-weight:600;letter-spacing:.2px;margin:0;}
.fb-titles p{font-size:11px;margin:2px 0 0;color:${STEEL};opacity:.8;}
.fb-kernel{display:flex;align-items:center;gap:7px;font-size:11px;
  padding:5px 11px;border-radius:20px;margin-left:8px;
  background:rgba(0,0,0,0.3);}
.fb-kernel .dot{width:7px;height:7px;border-radius:50%;}
.fb-kernel.on{color:#8ff0a4;}.fb-kernel.on .dot{background:#4ade80;box-shadow:0 0 8px #4ade80;}
.fb-kernel.off{color:#fbbf24;}.fb-kernel.off .dot{background:#fbbf24;box-shadow:0 0 8px #fbbf24;}

.fb-features{top:18px;right:18px;width:208px;padding:12px;}
.fb-feat-head{font-size:10px;text-transform:uppercase;letter-spacing:1.4px;
  color:${STEEL};opacity:.6;margin-bottom:10px;}
.fb-feat-node{display:flex;gap:10px;align-items:center;padding:9px 10px;
  border-radius:9px;background:rgba(255,255,255,0.03);
  border:1px solid rgba(159,179,200,0.08);}
.fb-feat-node.accent{border-color:${GOLD}55;background:${GOLD}10;}
.fb-feat-node .ico{font-size:16px;color:${GOLD_DIM};}
.fb-feat-node.accent .ico{color:${GOLD};}
.fb-feat-node strong{display:block;font-size:12px;font-weight:600;}
.fb-feat-node em{display:block;font-size:10px;color:${STEEL};opacity:.75;font-style:normal;margin-top:1px;}
.fb-feat-arrow{text-align:center;font-size:10px;color:${STEEL};opacity:.5;margin:6px 0;}

.fb-params{right:18px;top:200px;width:208px;padding:14px;}
.fb-seg{display:flex;gap:4px;background:rgba(0,0,0,0.3);padding:3px;
  border-radius:9px;margin-bottom:14px;}
.fb-seg button{flex:1;border:0;background:transparent;color:${STEEL};
  font-size:11px;padding:6px;border-radius:6px;cursor:pointer;font-weight:500;}
.fb-seg button.on{background:${GOLD};color:#1a1206;font-weight:600;}

.fb-dim{display:block;margin-bottom:13px;}
.fb-dim-label{display:block;font-size:10px;text-transform:uppercase;
  letter-spacing:1px;color:${STEEL};opacity:.7;margin-bottom:5px;}
.fb-dim input[type=range]{width:100%;accent-color:${GOLD};height:4px;cursor:pointer;}
.fb-dim-val{display:block;text-align:right;font-size:13px;font-weight:600;
  font-family:'JetBrains Mono',monospace;color:${GOLD};margin-top:3px;}
.fb-dim-val em{font-size:10px;color:${STEEL};font-style:normal;margin-left:3px;}
.fb-divider{height:1px;background:rgba(159,179,200,0.12);margin:6px 0 14px;}

.fb-actions{display:flex;flex-direction:column;gap:8px;margin-top:6px;}
.fb-actions button,.fb-export{border:1px solid rgba(159,179,200,0.18);
  background:rgba(255,255,255,0.04);color:#e9eef5;font-size:11px;
  padding:8px;border-radius:8px;cursor:pointer;text-align:center;
  text-decoration:none;font-weight:500;transition:.15s;}
.fb-actions button:hover,.fb-export:hover{border-color:${GOLD}66;background:${GOLD}14;}
.fb-export[aria-disabled=true]{opacity:.4;pointer-events:none;}

.fb-invariants{left:18px;bottom:18px;right:18px;max-width:760px;margin:0 auto;
  display:flex;gap:0;padding:0;overflow:hidden;}
.fb-invariants .inv{flex:1;padding:11px 16px;display:flex;flex-direction:column;
  gap:3px;border-right:1px solid rgba(159,179,200,0.1);}
.fb-invariants .inv:last-child{border-right:0;}
.fb-invariants .k{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;
  color:${STEEL};opacity:.6;}
.fb-invariants .v{font-size:13px;font-weight:600;}
.fb-invariants .v.mono{font-family:'JetBrains Mono',monospace;font-size:12px;}
.fb-invariants .v b{color:${GOLD};}
.fb-invariants .chk{font-size:10px;color:${STEEL};opacity:.85;}
.fb-invariants.ok{border-color:${GOLD}44;}

.fb-hide{position:absolute;bottom:18px;right:18px;width:34px;height:34px;
  border-radius:9px;border:1px solid rgba(159,179,200,0.15);
  background:rgba(13,18,28,0.7);color:${STEEL};font-size:15px;cursor:pointer;
  backdrop-filter:blur(10px);z-index:5;}
.fb-hide:hover{color:${GOLD};border-color:${GOLD}55;}
`;
