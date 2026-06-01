/**
 * ⚒️ La Forja — Part Studio B-Rep INTERACTIVO (crear piezas POR CLIC)
 * ===================================================================
 * El diseñador NO programa: hace CLIC. Croquis → Extrude → Barreno → Fillet →
 * Chamfer → Shell → Revolve. Cada operación es un BOTÓN con su PANEL DE
 * OPCIONES en vivo, llama al kernel exacto (OpenCASCADE/WASM) y agrega un
 * FeatureNode al GRAFO del documento (editable, re-computable: history-replay).
 *
 * Filosofía (igual que el kernel): corrección primero. El primer "análisis"
 * real que ve el diseñador es masa / volumen / centro-de-masa / inercia
 * EXACTOS por GProp_GProps — no estimados, no malla: integración geométrica.
 *
 * Frontera de cómputo: CPU(OCCT)=geometría exacta + STEP + propiedades de masa.
 * GPU(R3F)=render + picking (raycast a la malla teselada para seleccionar
 * cara/arista de Hole/Fillet/Shell).
 *
 * Estética GAIA: viewport oscuro protagonista, paneles de vidrio, oro como
 * acento, invariantes visibles. data-testid en los controles clave para que
 * Playwright haga clic de forma estable (btn-extrude, input-altura, …).
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Environment } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import {
  initOCCT,
  _setActiveOCCT,
  extrudePolygon,
  extrudeCircle,
  drillHole,
  filletEdges,
  chamferEdges,
  shellSolid,
  revolvePolygon,
  tessellate,
  topology,
  volume,
  surfaceArea,
  massProperties,
  enumerateFaces,
  enumerateEdges,
  exportSTEP,
  type OC,
  type Pt2,
  type Shape,
  type TessellatedMesh,
  type FaceRef,
  type EdgeRef,
  type MassProperties,
} from './occt';

// ──────────────────────────────────────────────────────────────────
// Paleta GAIA
// ──────────────────────────────────────────────────────────────────
const GOLD = '#FDB813';
const GOLD_DIM = '#c9a84c';
const STEEL = '#9fb3c8';
const INK = '#05060A';

// ──────────────────────────────────────────────────────────────────
// Materiales (densidad en g/mm³) — para el análisis de masa exacto
// ──────────────────────────────────────────────────────────────────
const MATERIALS: Record<string, { label: string; density: number }> = {
  alu: { label: 'Aluminio 6061', density: 2.70e-3 },
  steel: { label: 'Acero 1045', density: 7.85e-3 },
  abs: { label: 'ABS (impresión)', density: 1.04e-3 },
  pla: { label: 'PLA (impresión)', density: 1.24e-3 },
  brass: { label: 'Latón', density: 8.50e-3 },
  ti: { label: 'Titanio Ti-6Al-4V', density: 4.43e-3 },
};

// ──────────────────────────────────────────────────────────────────
// El documento = grafo de features (sketch base + operaciones ordenadas)
// ──────────────────────────────────────────────────────────────────
type SketchKind = 'rect' | 'circle' | 'lprofile';

interface SketchFeature {
  id: 'sketch';
  kind: SketchKind;
  width: number;   // rect / L
  height: number;  // rect / L
  radius: number;  // circle
  legW: number;    // L: ancho de pata
}

type OpType = 'extrude' | 'hole' | 'fillet' | 'chamfer' | 'shell' | 'revolve';

interface ExtrudeOp { id: string; type: 'extrude'; depth: number; symmetric: boolean; }
interface HoleOp { id: string; type: 'hole'; x: number; y: number; diameter: number; through: boolean; depth: number; }
interface FilletOp { id: string; type: 'fillet'; radius: number; edges: number[]; }
interface ChamferOp { id: string; type: 'chamfer'; dist: number; edges: number[]; }
interface ShellOp { id: string; type: 'shell'; thickness: number; faces: number[]; }
interface RevolveOp { id: string; type: 'revolve'; angle: number; }
type Op = ExtrudeOp | HoleOp | FilletOp | ChamferOp | ShellOp | RevolveOp;

interface BuildResult {
  mesh: TessellatedMesh;
  topo: { faces: number; edges: number; vertices: number; euler: number };
  volKernel: number;
  area: number;
  stepBytes: number;
  mass: MassProperties;
  faces: FaceRef[];
  edges: EdgeRef[];
}

// ──────────────────────────────────────────────────────────────────
// Perfil 2D paramétrico → puntos (CCW, centrado / a un lado del eje)
// ──────────────────────────────────────────────────────────────────
function rectProfile(w: number, h: number): Pt2[] {
  const hx = w / 2, hy = h / 2;
  return [{ x: -hx, y: -hy }, { x: hx, y: -hy }, { x: hx, y: hy }, { x: -hx, y: hy }];
}
function lProfile(w: number, h: number, leg: number): Pt2[] {
  // L con esquina inferior-izquierda en (−w/2, −h/2). Perfil CCW.
  const x0 = -w / 2, y0 = -h / 2;
  return [
    { x: x0, y: y0 },
    { x: x0 + w, y: y0 },
    { x: x0 + w, y: y0 + leg },
    { x: x0 + leg, y: y0 + leg },
    { x: x0 + leg, y: y0 + h },
    { x: x0, y: y0 + h },
  ];
}
function circleGhost(radius: number): Pt2[] {
  const pts: Pt2[] = [];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  return pts;
}

// ──────────────────────────────────────────────────────────────────
// Replay del grafo de features a través del kernel → Shape final
// ──────────────────────────────────────────────────────────────────
function buildShape(oc: OC, sketch: SketchFeature, ops: Op[]): Shape {
  // 1) Sketch base → primer sólido (extrude implícito lo hace la op 'extrude').
  //    El sketch por sí solo no es sólido; el grafo SIEMPRE empieza por extrude
  //    o revolve. Aquí preparamos el perfil; la primera op lo solidifica.
  let shape: Shape | null = null;
  const profile = (): Pt2[] => {
    if (sketch.kind === 'rect') return rectProfile(sketch.width, sketch.height);
    if (sketch.kind === 'lprofile') return lProfile(sketch.width, sketch.height, sketch.legW);
    return circleGhost(sketch.radius); // solo para revolve poligonal; circle usa extrudeCircle
  };

  for (const op of ops) {
    if (op.type === 'extrude') {
      if (shape) continue; // primer sólido ya creado; ignora extrudes posteriores
      // Simétrico: el plano de boceto se baja −depth/2 y se extruye depth, así
      // el sólido queda centrado en z=0 (no cambia volumen ni topología).
      const plane = op.symmetric
        ? { origin: [0, 0, -op.depth / 2] as [number, number, number], uDir: [1, 0, 0] as [number, number, number], vDir: [0, 1, 0] as [number, number, number] }
        : undefined;
      if (sketch.kind === 'circle') {
        shape = extrudeCircle(oc, { x: 0, y: 0 }, sketch.radius, op.depth, plane);
      } else {
        shape = extrudePolygon(oc, profile(), op.depth, plane);
      }
    } else if (op.type === 'revolve') {
      if (shape) continue;
      // Revolve usa el perfil como medio-perfil a un lado del eje Y.
      shape = revolvePolygon(oc, profile(), op.angle);
    } else if (op.type === 'hole' && shape) {
      // zTop = altura del sólido extruido (depende del extrude previo).
      const ex = ops.find((o) => o.type === 'extrude') as ExtrudeOp | undefined;
      const zTop = ex?.depth ?? 12;
      shape = drillHole(oc, shape, {
        x: op.x, y: op.y, diameter: op.diameter, zTop,
        depth: op.depth, through: op.through,
      });
    } else if (op.type === 'fillet' && shape) {
      shape = filletEdges(oc, shape, op.radius, op.edges);
    } else if (op.type === 'chamfer' && shape) {
      shape = chamferEdges(oc, shape, op.dist, op.edges);
    } else if (op.type === 'shell' && shape) {
      shape = shellSolid(oc, shape, op.thickness, op.faces);
    }
  }
  if (!shape) throw new Error('El documento no tiene sólido: agrega Extrude o Revolve.');
  return shape;
}

// ──────────────────────────────────────────────────────────────────
// Render del sólido teselado + picking de cara/arista (raycast)
// ──────────────────────────────────────────────────────────────────
function SolidMesh({
  mesh, faded, faces, edges, selFaces, selEdges, pickMode, onPickFace, onPickEdge,
}: {
  mesh: TessellatedMesh;
  faded: boolean;
  faces: FaceRef[];
  edges: EdgeRef[];
  selFaces: number[];
  selEdges: number[];
  pickMode: 'none' | 'face' | 'edge';
  onPickFace: (i: number) => void;
  onPickEdge: (i: number) => void;
}) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [mesh]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(geom, 25), [geom]);
  useEffect(() => () => { geom.dispose(); edgesGeo.dispose(); }, [geom, edgesGeo]);

  // Geometría de RESALTE: por cada cara seleccionada, extraemos sus grupos
  // (faceGroups del kernel) y construimos una sub-malla con los MISMOS
  // triángulos. Render con emissive de oro encima del sólido → la cara se
  // "enciende". (No usamos vertex colors para que el material brille con bloom.)
  const highlightGeo = useMemo(() => {
    if (!selFaces.length) return null;
    const sel = new Set(selFaces);
    const idx: number[] = [];
    for (const grp of mesh.faceGroups) {
      if (sel.has(grp.faceId)) {
        for (let k = grp.start; k < grp.start + grp.count; k++) {
          idx.push(mesh.indices[k]);
        }
      }
    }
    if (!idx.length) return null;
    const g = new THREE.BufferGeometry();
    // Atributos PROPIOS (no compartidos con `geom`) sobre los mismos datos: así
    // disponer un geometry no libera el buffer GPU del otro.
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    return g;
  }, [mesh, selFaces]);
  useEffect(() => () => { highlightGeo?.dispose(); }, [highlightGeo]);

  // Picking REAL: el raycast de three.js entrega el ÍNDICE DEL TRIÁNGULO
  // intersectado (e.faceIndex). El kernel etiquetó cada triángulo con su cara
  // OCCT (mesh.faceIds), así que triángulo → faceId es directo y exacto
  // (no heurístico): la cara que devolvemos es la que está REALMENTE bajo el
  // cursor, no la del centroide más cercano. Para aristas seguimos por
  // proximidad al punto-medio (las aristas no se teselan como triángulos).
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (pickMode === 'none') return;
    e.stopPropagation();
    if (pickMode === 'face') {
      const ti = e.faceIndex;
      if (ti != null && ti >= 0 && ti < mesh.faceIds.length) {
        onPickFace(mesh.faceIds[ti]);
        return;
      }
      // Fallback (raro): si no hubo faceIndex, usa el centroide más cercano.
      const p = e.point;
      let best = -1, bd = Infinity;
      for (const f of faces) {
        const d = (f.center[0] - p.x) ** 2 + (f.center[1] - p.y) ** 2 + (f.center[2] - p.z) ** 2;
        if (d < bd) { bd = d; best = f.index; }
      }
      if (best >= 0) onPickFace(best);
    } else {
      const p = e.point;
      let best = -1, bd = Infinity;
      for (const ed of edges) {
        const d = (ed.mid[0] - p.x) ** 2 + (ed.mid[1] - p.y) ** 2 + (ed.mid[2] - p.z) ** 2;
        if (d < bd) { bd = d; best = ed.index; }
      }
      if (best >= 0) onPickEdge(best);
    }
  }, [pickMode, mesh, faces, edges, onPickFace, onPickEdge]);

  return (
    <group>
      <mesh geometry={geom} castShadow receiveShadow onClick={handleClick}>
        <meshStandardMaterial
          color={faded ? '#8a96a4' : '#bcc6d2'}
          metalness={0.82}
          roughness={0.52}
          emissive={'#16110a'}
          emissiveIntensity={0.2}
          envMapIntensity={0.9}
        />
      </mesh>

      {/* CARA RESALTADA: misma topología, material de oro emisivo encima. */}
      {highlightGeo && (
        <mesh geometry={highlightGeo} renderOrder={2}>
          <meshStandardMaterial
            color={'#ffd24a'}
            emissive={GOLD}
            emissiveIntensity={0.9}
            metalness={0.3}
            roughness={0.35}
            transparent
            opacity={0.92}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      )}

      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color={GOLD} transparent opacity={0.5} />
      </lineSegments>

      {/* Marcador puntual de cara seleccionada (esfera verde en su centroide),
          además del resalte de superficie — doble feedback del picking. */}
      {selFaces.map((i) => {
        const f = faces.find((x) => x.index === i);
        if (!f) return null;
        return (
          <mesh key={`sf${i}`} position={f.center}>
            <sphereGeometry args={[1.6, 16, 16]} />
            <meshBasicMaterial color={'#4ade80'} transparent opacity={0.9} />
          </mesh>
        );
      })}
      {selEdges.map((i) => {
        const ed = edges.find((x) => x.index === i);
        if (!ed) return null;
        return (
          <mesh key={`se${i}`} position={ed.mid}>
            <sphereGeometry args={[1.4, 16, 16]} />
            <meshBasicMaterial color={GOLD} transparent opacity={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

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

function SketchPlane() {
  return (
    <gridHelper
      args={[160, 32, new THREE.Color('#243140'), new THREE.Color('#161e29')]}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, -0.01]}
    />
  );
}

// ──────────────────────────────────────────────────────────────────
// Cota numérica con slider (estilo Onshape) + testid
// ──────────────────────────────────────────────────────────────────
function Dim({ label, value, unit, onChange, min, max, step, testid }: {
  label: string; value: number; unit: string; onChange: (v: number) => void;
  min: number; max: number; step: number; testid?: string;
}) {
  return (
    <label className="fb-dim">
      <span className="fb-dim-label">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        data-testid={testid}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="fb-dim-val">
        {value.toFixed(step < 1 ? 1 : 0)}<em>{unit}</em>
      </span>
    </label>
  );
}

let opCounter = 0;
const newId = (t: string) => `${t}-${++opCounter}`;

/**
 * Etiqueta semántica de una cara para la lista determinista (Playwright):
 * superior/inferior por la normal en Z (planos), lateral para el resto. Permite
 * que el test elija "la cara superior" sin depender de coordenadas del viewport.
 */
function faceLabel(f: FaceRef): string {
  if (f.kind === 'plane') {
    const nz = f.normal[2];
    if (nz > 0.7) return 'superior';
    if (nz < -0.7) return 'inferior';
    return 'lateral';
  }
  return f.kind === 'cylinder' ? 'cilíndrica' : f.kind;
}

// ──────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────
export default function ForgeBRepStudio() {
  const [oc, setOc] = useState<OC | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [opErr, setOpErr] = useState<string | null>(null);

  const [sketch, setSketch] = useState<SketchFeature>({
    id: 'sketch', kind: 'rect', width: 40, height: 24, radius: 14, legW: 10,
  });
  // El grafo arranca con un extrude (el "primer momento": sketch→sólido).
  const [ops, setOps] = useState<Op[]>([
    { id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false },
  ]);
  const [activeOp, setActiveOp] = useState<string | null>(ops[0].id);
  const [material, setMaterial] = useState<keyof typeof MATERIALS>('alu');

  const [result, setResult] = useState<BuildResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [showSketch, setShowSketch] = useState(true);
  const [hideChrome, setHideChrome] = useState(false);
  const [pickMode, setPickMode] = useState<'none' | 'face' | 'edge'>('none');
  // Última CARA elegida por clic (índice estable OCCT) — se resalta SIEMPRE y se
  // muestra en el HUD, independiente de que haya una op de Shell activa.
  const [selectedFaceId, setSelectedFaceId] = useState<number | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null);
  const stepBlobUrl = useRef<string | null>(null);

  // Perfil vivo (ghost del sketch base).
  const profilePts = useMemo<Pt2[]>(() => {
    if (sketch.kind === 'rect') return rectProfile(sketch.width, sketch.height);
    if (sketch.kind === 'lprofile') return lProfile(sketch.width, sketch.height, sketch.legW);
    return circleGhost(sketch.radius);
  }, [sketch]);

  // ── Boot del kernel ──
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
    return () => { alive = false; };
  }, []);

  // ── Replay del grafo → malla + invariantes + análisis de masa ──
  const rebuild = useCallback(() => {
    if (!oc) return;
    setBuilding(true);
    setOpErr(null);
    requestAnimationFrame(() => {
      try {
        const shape = buildShape(oc, sketch, ops);
        const mesh = tessellate(oc, shape, 0.08, 0.3);
        const topo = topology(oc, shape);
        const volKernel = volume(oc, shape);
        const area = surfaceArea(oc, shape);
        const mass = massProperties(oc, shape, MATERIALS[material].density);
        const faces = enumerateFaces(oc, shape);
        const edges = enumerateEdges(oc, shape);
        const step = exportSTEP(oc, shape, 'forja-part.step');

        if (stepBlobUrl.current) URL.revokeObjectURL(stepBlobUrl.current);
        stepBlobUrl.current = URL.createObjectURL(
          new Blob([step], { type: 'application/step' }),
        );

        setResult({ mesh, topo, volKernel, area, stepBytes: step.length, mass, faces, edges });
        shape.delete?.();
      } catch (e) {
        setOpErr(String((e as Error)?.message ?? e));
      } finally {
        setBuilding(false);
      }
    });
  }, [oc, sketch, ops, material]);

  useEffect(() => { if (oc) rebuild(); }, [oc, rebuild]);

  // Al cambiar la ESTRUCTURA del documento (nº de ops) la topología cambia y los
  // índices de cara/arista dejan de ser válidos: limpia la selección puntual.
  const opCount = ops.length;
  useEffect(() => { setSelectedFaceId(null); setSelectedEdgeId(null); }, [opCount]);

  // Tecla H: chrome on/off.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') setHideChrome((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Mutadores del grafo ──
  const updateOp = useCallback((id: string, patch: Partial<Op>) => {
    setOps((cur) => cur.map((o) => (o.id === id ? ({ ...o, ...patch } as Op) : o)));
  }, []);
  const addOp = useCallback((type: OpType) => {
    let op: Op;
    const ex = (ops.find((o) => o.type === 'extrude') as ExtrudeOp | undefined)?.depth ?? 12;
    switch (type) {
      case 'extrude': op = { id: newId('extrude'), type, depth: 12, symmetric: false }; break;
      case 'hole': op = { id: newId('hole'), type, x: 0, y: 0, diameter: 8, through: true, depth: ex }; break;
      case 'fillet': op = { id: newId('fillet'), type, radius: 3, edges: [] }; break;
      case 'chamfer': op = { id: newId('chamfer'), type, dist: 2, edges: [] }; break;
      case 'shell': op = { id: newId('shell'), type, thickness: 2, faces: [] }; break;
      case 'revolve': op = { id: newId('revolve'), type, angle: 360 }; break;
    }
    setOps((cur) => [...cur, op]);
    setActiveOp(op.id);
    if (type === 'fillet' || type === 'chamfer') setPickMode('edge');
    else if (type === 'shell') setPickMode('face');
    else setPickMode('none');
  }, [ops]);
  const removeOp = useCallback((id: string) => {
    setOps((cur) => cur.filter((o) => o.id !== id));
    setActiveOp(null);
    setPickMode('none');
  }, []);

  // Selección (toggle) de cara/arista para la op activa. SIEMPRE fija el
  // selectedFaceId/selectedEdgeId (para el HUD + resalte), y además, si hay una
  // op que consume caras/aristas (Shell / Fillet / Chamfer), togglea su lista.
  const togglePickFace = useCallback((i: number) => {
    setSelectedFaceId(i);
    const op = ops.find((o) => o.id === activeOp);
    if (!op || op.type !== 'shell') return;
    const cur = (op as ShellOp).faces;
    const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
    updateOp(op.id, { faces: next } as Partial<Op>);
  }, [ops, activeOp, updateOp]);
  const togglePickEdge = useCallback((i: number) => {
    setSelectedEdgeId(i);
    const op = ops.find((o) => o.id === activeOp);
    if (!op || (op.type !== 'fillet' && op.type !== 'chamfer')) return;
    const cur = (op as FilletOp | ChamferOp).edges;
    const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
    updateOp(op.id, { edges: next } as Partial<Op>);
  }, [ops, activeOp, updateOp]);

  // El picking se puede activar SIN una op (modo "inspección"): permite elegir
  // cara/arista para ver el ID en el HUD antes de crear el feature.
  const enableFacePick = useCallback(() => {
    setActiveOp(null);
    setPickMode((m) => (m === 'face' ? 'none' : 'face'));
  }, []);

  // Caras/aristas resaltadas = selección de la op activa ∪ la cara/arista que
  // se acaba de elegir por clic (selectedFaceId/Id). Así el resalte aparece
  // incluso en modo inspección (sin op de Shell/Fillet activa).
  const activeOpObj = ops.find((o) => o.id === activeOp) ?? null;
  const selFaces = useMemo(() => {
    const s = new Set<number>(activeOpObj?.type === 'shell' ? activeOpObj.faces : []);
    if (selectedFaceId != null) s.add(selectedFaceId);
    return [...s];
  }, [activeOpObj, selectedFaceId]);
  const selEdges = useMemo(() => {
    const s = new Set<number>(
      activeOpObj && (activeOpObj.type === 'fillet' || activeOpObj.type === 'chamfer') ? activeOpObj.edges : [],
    );
    if (selectedEdgeId != null) s.add(selectedEdgeId);
    return [...s];
  }, [activeOpObj, selectedEdgeId]);

  // ── QA hook headless (Playwright) ──
  useEffect(() => {
    const api = {
      get ready() { return !!oc && !!result; },
      get invariants() {
        return result ? {
          ops: ops.map((o) => o.type),
          faces: result.topo.faces,
          edges: result.topo.edges,
          vertices: result.topo.vertices,
          euler: result.topo.euler,
          vol_kernel: result.volKernel,
          area: result.area,
          mass_g: result.mass.mass,
          com: result.mass.centerOfMass,
          principal: result.mass.principal,
          step_bytes: result.stepBytes,
          tris: result.mesh.triangleCount,
          n_faces: result.faces.length,
          n_edges: result.edges.length,
        } : null;
      },
      get error() { return opErr; },
      get selectedFaceId() { return selectedFaceId; },
      get selectedEdgeId() { return selectedEdgeId; },
      addOp,
      updateOp,
      setSketch,
      setMaterial,
      setPickMode,
      pickFace: togglePickFace,
      pickEdge: togglePickEdge,
      listFaces: () => result?.faces ?? [],
      listEdges: () => result?.edges ?? [],
      // Diagnóstico del teselado etiquetado: nº de grupos por cara + faceIds.
      get tessTags() {
        return result ? {
          n_groups: result.mesh.faceGroups.length,
          n_face_ids: result.mesh.faceIds.length,
          distinct_face_ids: new Set(Array.from(result.mesh.faceIds)).size,
        } : null;
      },
    };
    (window as unknown as { __forgeBrep?: typeof api }).__forgeBrep = api;
    return () => { delete (window as unknown as { __forgeBrep?: unknown }).__forgeBrep; };
  }, [oc, result, ops, opErr, addOp, updateOp, togglePickFace, togglePickEdge, selectedFaceId, selectedEdgeId]);

  const cameraDist = useMemo(() => {
    const span = Math.max(sketch.width, sketch.height, sketch.radius * 2, 30);
    return Math.max(60, span * 2.6);
  }, [sketch]);

  // El <canvas> lo crea R3F dentro del viewport; le ponemos data-testid para
  // que Playwright pueda clicar por COORDENADAS del viewport de forma estable.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const cv = viewportRef.current?.querySelector('canvas');
    if (cv) cv.setAttribute('data-testid', 'viewport-canvas');
  }, [result]);

  const ok = result ? result.topo.euler === 2 : false;
  const mat = MATERIALS[material];

  return (
    <div className="fb-root">
      <style>{CSS}</style>

      {/* ── VIEWPORT ── */}
      <div className="fb-viewport" data-testid="viewport" ref={viewportRef}>
        <Stage
          cameraDistance={cameraDist}
          autoRotate={pickMode === 'none'}
          bgColor={INK}
          bloomIntensity={0.42}
          bloomThreshold={0.95}
          minDistance={cameraDist * 0.2}
          maxDistance={cameraDist * 4}
        >
          <Environment files="/hdri/studio_small_03_1k.hdr" backgroundIntensity={0} environmentIntensity={1.0} />
          <group rotation={[-Math.PI / 2, 0, 0]}>
            {showSketch && <SketchPlane />}
            {showSketch && <ProfileGhost pts={profilePts} />}
            {result && (
              <SolidMesh
                mesh={result.mesh}
                faded={building}
                faces={result.faces}
                edges={result.edges}
                selFaces={selFaces}
                selEdges={selEdges}
                pickMode={pickMode}
                onPickFace={togglePickFace}
                onPickEdge={togglePickEdge}
              />
            )}
          </group>
        </Stage>

        {pickMode !== 'none' && (
          <div className="fb-pick-hint" data-testid="pick-hint">
            Clic en {pickMode === 'face' ? 'una CARA' : 'una ARISTA'} del sólido para seleccionarla
          </div>
        )}

        {/* HUD de selección: el faceId/edgeId que el picking acaba de fijar.
            Playwright lee este nodo para verificar que el clic cambió la cara. */}
        <div className="fb-hud-sel" data-testid="hud-selected-face">
          {selectedFaceId != null ? (
            <>
              <span className="lbl">Cara</span>
              <b>#{selectedFaceId}</b>
              {(() => {
                const f = result?.faces.find((x) => x.index === selectedFaceId);
                return f ? <span className="meta">{f.kind} · {f.area.toFixed(0)}mm²</span> : null;
              })()}
            </>
          ) : (
            <span className="lbl">Ninguna cara seleccionada</span>
          )}
          {selectedEdgeId != null && (
            <span className="meta edge" data-testid="hud-selected-edge">Arista #{selectedEdgeId}</span>
          )}
        </div>
      </div>

      {!hideChrome && (
        <>
          {/* Encabezado */}
          <header className="fb-header">
            <div className="fb-mark">⚒</div>
            <div className="fb-titles">
              <h1>La Forja · Part Studio</h1>
              <p>Crea por clic · kernel B-Rep exacto (OpenCASCADE)</p>
            </div>
            <div className={`fb-kernel ${oc ? 'on' : 'off'}`} data-testid="kernel-status">
              <span className="dot" />
              {oc ? 'OCCT-WASM listo' : bootErr ? 'kernel falló' : 'cargando kernel…'}
            </div>
          </header>

          {/* ── TOOLBAR de operaciones (botones) ── */}
          <div className="fb-toolbar" data-testid="toolbar">
            <span className="fb-tb-label">Operaciones</span>
            <button data-testid="btn-extrude" onClick={() => addOp('extrude')} title="Extrude (boss/base)">⬓ Extrude</button>
            <button data-testid="btn-hole" onClick={() => addOp('hole')} title="Barreno / corte cilíndrico">◎ Hole</button>
            <button data-testid="btn-fillet" onClick={() => addOp('fillet')} title="Redondeo de aristas">◜ Fillet</button>
            <button data-testid="btn-chamfer" onClick={() => addOp('chamfer')} title="Bisel de aristas">◹ Chamfer</button>
            <button data-testid="btn-shell" onClick={() => addOp('shell')} title="Vaciado / pared delgada">▢ Shell</button>
            <button data-testid="btn-revolve" onClick={() => addOp('revolve')} title="Revolución del perfil">⟳ Revolve</button>
          </div>

          {/* ── Panel izquierdo: GRAFO de features (clic = editar) ── */}
          <aside className="fb-features" data-testid="feature-tree">
            <div className="fb-feat-head">Documento</div>
            <div
              className={`fb-feat-node ${activeOp === 'sketch' ? 'active' : ''}`}
              data-testid="feat-sketch"
              onClick={() => { setActiveOp('sketch'); setPickMode('none'); }}
            >
              <span className="ico">▣</span>
              <div>
                <strong>Sketch 1</strong>
                <em>{sketch.kind === 'rect' ? 'Rectángulo' : sketch.kind === 'circle' ? 'Círculo' : 'Perfil L'} · Plano XY</em>
              </div>
            </div>
            {ops.map((op, i) => (
              <div key={op.id}>
                <div className="fb-feat-arrow">↓</div>
                <div
                  className={`fb-feat-node accent ${activeOp === op.id ? 'active' : ''}`}
                  data-testid={`feat-${op.type}`}
                  onClick={() => {
                    setActiveOp(op.id);
                    if (op.type === 'fillet' || op.type === 'chamfer') setPickMode('edge');
                    else if (op.type === 'shell') setPickMode('face');
                    else setPickMode('none');
                  }}
                >
                  <span className="ico">{opIcon(op.type)}</span>
                  <div>
                    <strong>{opTitle(op.type)} {i + 1}</strong>
                    <em>{opSubtitle(op)}</em>
                  </div>
                </div>
              </div>
            ))}
          </aside>

          {/* ── Lista SIEMPRE disponible de caras (selección determinista) ──
              Independiente de la op activa: clic en una entrada fija
              selectedFaceId (y, si hay Shell activo, togglea su cara abierta).
              Playwright elige la cara superior/inferior/lateral por testid sin
              depender de coordenadas del viewport. */}
          <aside className="fb-facelist" data-testid="face-list">
            <div className="fb-feat-head">
              Caras del sólido <b>{result?.faces.length ?? 0}</b>
            </div>
            <button className="fb-pick-btn" data-testid="btn-pick-face-global"
              onClick={enableFacePick}>
              {pickMode === 'face' ? '◉ Picking de cara activo' : '○ Activar picking en viewport'}
            </button>
            <div className="fb-facelist-items">
              {(result?.faces ?? []).map((f) => (
                <button key={f.index}
                  data-testid={`face-item-${f.index}`}
                  className={selFaces.includes(f.index) ? 'sel' : ''}
                  onClick={() => togglePickFace(f.index)}
                  title={`Cara ${f.index} · ${f.kind}`}>
                  <span className="fi-idx">#{f.index}</span>
                  <span className="fi-lbl">{faceLabel(f)}</span>
                  <span className="fi-meta">{f.kind} · {f.area.toFixed(0)}mm²</span>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Panel derecho: OPCIONES de la op activa ── */}
          <aside className="fb-params" data-testid="op-panel">
            {activeOp === 'sketch' && (
              <>
                <div className="fb-panel-title">Sketch · Perfil</div>
                <div className="fb-seg">
                  <button data-testid="seg-rect" className={sketch.kind === 'rect' ? 'on' : ''}
                    onClick={() => setSketch((s) => ({ ...s, kind: 'rect' }))}>Rect</button>
                  <button data-testid="seg-circle" className={sketch.kind === 'circle' ? 'on' : ''}
                    onClick={() => setSketch((s) => ({ ...s, kind: 'circle' }))}>Círculo</button>
                  <button data-testid="seg-lprofile" className={sketch.kind === 'lprofile' ? 'on' : ''}
                    onClick={() => setSketch((s) => ({ ...s, kind: 'lprofile' }))}>L</button>
                </div>
                {sketch.kind === 'circle' ? (
                  <Dim label="Radio" value={sketch.radius} unit="mm" min={3} max={50} step={1} testid="input-radio"
                    onChange={(v) => setSketch((s) => ({ ...s, radius: v }))} />
                ) : (
                  <>
                    <Dim label="Ancho" value={sketch.width} unit="mm" min={6} max={100} step={1} testid="input-ancho"
                      onChange={(v) => setSketch((s) => ({ ...s, width: v }))} />
                    <Dim label="Alto" value={sketch.height} unit="mm" min={6} max={100} step={1} testid="input-alto"
                      onChange={(v) => setSketch((s) => ({ ...s, height: v }))} />
                    {sketch.kind === 'lprofile' && (
                      <Dim label="Ancho de pata" value={sketch.legW} unit="mm" min={3} max={40} step={1} testid="input-pata"
                        onChange={(v) => setSketch((s) => ({ ...s, legW: v }))} />
                    )}
                  </>
                )}
              </>
            )}

            {activeOpObj?.type === 'extrude' && (
              <>
                <div className="fb-panel-title">Extrude · Boss/Base</div>
                <Dim label="Altura" value={activeOpObj.depth} unit="mm" min={2} max={80} step={1} testid="input-altura"
                  onChange={(v) => updateOp(activeOpObj.id, { depth: v } as Partial<Op>)} />
                <label className="fb-check">
                  <input type="checkbox" data-testid="chk-simetrico" checked={activeOpObj.symmetric}
                    onChange={(e) => updateOp(activeOpObj.id, { symmetric: e.target.checked } as Partial<Op>)} />
                  Simétrico al plano
                </label>
              </>
            )}

            {activeOpObj?.type === 'hole' && (
              <>
                <div className="fb-panel-title">Hole · Barreno</div>
                <Dim label="Diámetro" value={activeOpObj.diameter} unit="mm" min={1} max={40} step={0.5} testid="input-diametro"
                  onChange={(v) => updateOp(activeOpObj.id, { diameter: v } as Partial<Op>)} />
                <Dim label="Posición X" value={activeOpObj.x} unit="mm" min={-50} max={50} step={1} testid="input-pos-x"
                  onChange={(v) => updateOp(activeOpObj.id, { x: v } as Partial<Op>)} />
                <Dim label="Posición Y" value={activeOpObj.y} unit="mm" min={-50} max={50} step={1} testid="input-pos-y"
                  onChange={(v) => updateOp(activeOpObj.id, { y: v } as Partial<Op>)} />
                <label className="fb-check">
                  <input type="checkbox" data-testid="chk-pasante" checked={activeOpObj.through}
                    onChange={(e) => updateOp(activeOpObj.id, { through: e.target.checked } as Partial<Op>)} />
                  Pasante (through all)
                </label>
                {!activeOpObj.through && (
                  <Dim label="Profundidad" value={activeOpObj.depth} unit="mm" min={1} max={80} step={1} testid="input-prof-barreno"
                    onChange={(v) => updateOp(activeOpObj.id, { depth: v } as Partial<Op>)} />
                )}
              </>
            )}

            {(activeOpObj?.type === 'fillet' || activeOpObj?.type === 'chamfer') && (
              <>
                <div className="fb-panel-title">{activeOpObj.type === 'fillet' ? 'Fillet · Redondeo' : 'Chamfer · Bisel'}</div>
                <Dim
                  label={activeOpObj.type === 'fillet' ? 'Radio' : 'Distancia'}
                  value={activeOpObj.type === 'fillet' ? activeOpObj.radius : activeOpObj.dist}
                  unit="mm" min={0.5} max={12} step={0.5}
                  testid={activeOpObj.type === 'fillet' ? 'input-radio-fillet' : 'input-dist-chamfer'}
                  onChange={(v) => updateOp(activeOpObj.id,
                    (activeOpObj.type === 'fillet' ? { radius: v } : { dist: v }) as Partial<Op>)}
                />
                <div className="fb-sel-head">
                  Aristas <b data-testid="count-edges-sel">{(activeOpObj.edges).length}</b> seleccionadas
                  {(activeOpObj.edges).length === 0 && <em> (vacío = todas)</em>}
                </div>
                <button className="fb-pick-btn" data-testid="btn-pick-edge"
                  onClick={() => setPickMode((m) => (m === 'edge' ? 'none' : 'edge'))}>
                  {pickMode === 'edge' ? '◉ Picking activo' : '○ Seleccionar en viewport'}
                </button>
                <div className="fb-sel-list" data-testid="edge-list">
                  {(result?.edges ?? []).map((ed) => (
                    <button key={ed.index}
                      data-testid={`edge-${ed.index}`}
                      className={activeOpObj.edges.includes(ed.index) ? 'sel' : ''}
                      onClick={() => togglePickEdge(ed.index)}>
                      Arista {ed.index} · {ed.kind} · {ed.length.toFixed(1)}mm
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeOpObj?.type === 'shell' && (
              <>
                <div className="fb-panel-title">Shell · Vaciado</div>
                <Dim label="Espesor de pared" value={activeOpObj.thickness} unit="mm" min={0.5} max={10} step={0.5} testid="input-espesor"
                  onChange={(v) => updateOp(activeOpObj.id, { thickness: v } as Partial<Op>)} />
                <div className="fb-sel-head">
                  Caras abiertas <b data-testid="count-faces-sel">{activeOpObj.faces.length}</b>
                </div>
                <button className="fb-pick-btn" data-testid="btn-pick-face"
                  onClick={() => setPickMode((m) => (m === 'face' ? 'none' : 'face'))}>
                  {pickMode === 'face' ? '◉ Picking activo' : '○ Seleccionar cara en viewport'}
                </button>
                <div className="fb-sel-list" data-testid="face-list">
                  {(result?.faces ?? []).map((f) => (
                    <button key={f.index}
                      data-testid={`face-${f.index}`}
                      className={activeOpObj.faces.includes(f.index) ? 'sel' : ''}
                      onClick={() => togglePickFace(f.index)}>
                      Cara {f.index} · {f.kind} · {f.area.toFixed(0)}mm²
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeOpObj?.type === 'revolve' && (
              <>
                <div className="fb-panel-title">Revolve · Revolución</div>
                <Dim label="Ángulo" value={activeOpObj.angle} unit="°" min={10} max={360} step={5} testid="input-angulo"
                  onChange={(v) => updateOp(activeOpObj.id, { angle: v } as Partial<Op>)} />
                <p className="fb-hint-txt">El perfil gira alrededor del eje Y (x=0). Usa el sketch a un lado del eje.</p>
              </>
            )}

            {activeOpObj && (
              <button className="fb-del-btn" data-testid="btn-del-op" onClick={() => removeOp(activeOpObj.id)}>
                ✕ Eliminar feature
              </button>
            )}

            <div className="fb-divider" />
            <div className="fb-actions">
              <button data-testid="btn-toggle-sketch" onClick={() => setShowSketch((v) => !v)}>
                {showSketch ? 'Ocultar boceto' : 'Mostrar boceto'}
              </button>
              <a className="fb-export" data-testid="btn-export-step"
                href={stepBlobUrl.current ?? '#'} download="forja-part.step"
                aria-disabled={!result}>Exportar STEP</a>
            </div>
          </aside>

          {/* ── Panel de ANÁLISIS / PROPIEDADES (masa exacta GProp) ── */}
          <aside className="fb-analysis" data-testid="analysis-panel">
            <div className="fb-panel-title">Análisis · Propiedades de masa</div>
            <label className="fb-mat">
              <span>Material</span>
              <select data-testid="select-material" value={material}
                onChange={(e) => setMaterial(e.target.value as keyof typeof MATERIALS)}>
                {Object.entries(MATERIALS).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </select>
            </label>
            {result ? (
              <div className="fb-mass">
                <Row k="Volumen" v={`${result.volKernel.toFixed(2)} mm³`} testid="an-volumen" />
                <Row k="Área" v={`${result.area.toFixed(1)} mm²`} testid="an-area" />
                <Row k="Densidad" v={`${(mat.density * 1000).toFixed(2)} g/cm³`} />
                <Row k="Masa" v={`${result.mass.mass.toFixed(3)} g`} hi testid="an-masa" />
                <Row k="Centro de masa"
                  v={`(${result.mass.centerOfMass.map((c) => c.toFixed(1)).join(', ')}) mm`}
                  testid="an-com" />
                <Row k="Inercia principal"
                  v={result.mass.principal.map((p) => p.toExponential(2)).join(' · ')}
                  testid="an-inercia" />
              </div>
            ) : (
              <div className="fb-mass"><Row k="Estado" v="construyendo…" /></div>
            )}
          </aside>

          {/* ── Invariantes (la corrección visible) ── */}
          <footer className={`fb-invariants ${ok ? 'ok' : 'pending'}`} data-testid="invariants">
            {result ? (
              <>
                <div className="inv">
                  <span className="k">Topología</span>
                  <span className="v">V {result.topo.vertices} − E {result.topo.edges} + F {result.topo.faces} = <b>{result.topo.euler}</b></span>
                  <span className="chk">{result.topo.euler === 2 ? '✓ sólido simple' : 'sólido compuesto'}</span>
                </div>
                <div className="inv">
                  <span className="k">Volumen (GProp)</span>
                  <span className="v mono">{result.volKernel.toFixed(3)} mm³</span>
                  <span className="chk">exacto por integración geométrica</span>
                </div>
                <div className="inv">
                  <span className="k">Malla / STEP</span>
                  <span className="v mono">{result.mesh.triangleCount} △ · {(result.stepBytes / 1024).toFixed(1)} KB</span>
                  <span className="chk">{building ? 'recomputando…' : 'CPU(OCCT) → GPU(R3F)'}</span>
                </div>
              </>
            ) : (
              <div className="inv">
                <span className="k">Estado</span>
                <span className="v">{opErr ? `Error: ${opErr}` : bootErr ? `Kernel: ${bootErr}` : 'Construyendo…'}</span>
              </div>
            )}
            {opErr && result && (
              <div className="inv err"><span className="k">Última op</span><span className="v">{opErr}</span></div>
            )}
          </footer>
        </>
      )}

      <button className="fb-hide" data-testid="btn-hide-chrome" onClick={() => setHideChrome((v) => !v)}>
        {hideChrome ? '◳' : '◲'}
      </button>
    </div>
  );
}

function Row({ k, v, hi, testid }: { k: string; v: string; hi?: boolean; testid?: string }) {
  return (
    <div className={`fb-row ${hi ? 'hi' : ''}`}>
      <span className="rk">{k}</span>
      <span className="rv" data-testid={testid}>{v}</span>
    </div>
  );
}

function opIcon(t: OpType): string {
  return { extrude: '⬓', hole: '◎', fillet: '◜', chamfer: '◹', shell: '▢', revolve: '⟳' }[t];
}
function opTitle(t: OpType): string {
  return { extrude: 'Extrude', hole: 'Hole', fillet: 'Fillet', chamfer: 'Chamfer', shell: 'Shell', revolve: 'Revolve' }[t];
}
function opSubtitle(op: Op): string {
  switch (op.type) {
    case 'extrude': return `${op.depth.toFixed(0)} mm`;
    case 'hole': return `⌀${op.diameter.toFixed(1)} · ${op.through ? 'pasante' : `${op.depth.toFixed(0)}mm`}`;
    case 'fillet': return `R${op.radius.toFixed(1)} · ${op.edges.length || 'todas'} aristas`;
    case 'chamfer': return `${op.dist.toFixed(1)}mm · ${op.edges.length || 'todas'} aristas`;
    case 'shell': return `pared ${op.thickness.toFixed(1)} · ${op.faces.length} caras`;
    case 'revolve': return `${op.angle.toFixed(0)}°`;
  }
}

// ──────────────────────────────────────────────────────────────────
// Estilos (vidrio sobre viewport — feel Plasticity/Onshape, acento oro GAIA)
// ──────────────────────────────────────────────────────────────────
const CSS = `
.fb-root{position:fixed;inset:0;overflow:hidden;background:${INK};
  font-family:'Inter',system-ui,sans-serif;color:#e9eef5;}
.fb-viewport{position:absolute;inset:0;}
.fb-pick-hint{position:absolute;top:74px;left:50%;transform:translateX(-50%);
  background:${GOLD};color:#1a1206;font-size:12px;font-weight:600;padding:7px 16px;
  border-radius:20px;box-shadow:0 4px 20px ${GOLD}66;z-index:6;pointer-events:none;}

.fb-hud-sel{position:absolute;top:112px;left:50%;transform:translateX(-50%);
  display:flex;align-items:center;gap:8px;z-index:6;pointer-events:none;
  background:rgba(13,18,28,0.78);border:1px solid ${GOLD}44;border-radius:20px;
  padding:6px 14px;backdrop-filter:blur(10px);font-size:12px;color:#e9eef5;}
.fb-hud-sel .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${STEEL};opacity:.7;}
.fb-hud-sel b{color:${GOLD};font-family:'JetBrains Mono',monospace;font-size:14px;}
.fb-hud-sel .meta{font-size:11px;color:${STEEL};font-family:'JetBrains Mono',monospace;}
.fb-hud-sel .meta.edge{color:#8ff0a4;}

.fb-facelist{position:absolute;left:18px;bottom:18px;width:210px;padding:12px;max-height:34vh;
  overflow:auto;display:flex;flex-direction:column;gap:8px;}
.fb-facelist .fb-feat-head{display:flex;justify-content:space-between;}
.fb-facelist .fb-feat-head b{color:${GOLD};}
.fb-facelist-items{display:flex;flex-direction:column;gap:3px;overflow:auto;}
.fb-facelist-items button{display:flex;align-items:baseline;gap:8px;text-align:left;
  border:1px solid rgba(159,179,200,0.1);background:rgba(255,255,255,0.02);color:${STEEL};
  font-size:10px;padding:5px 8px;border-radius:6px;cursor:pointer;font-family:'JetBrains Mono',monospace;}
.fb-facelist-items button:hover{border-color:${GOLD}55;}
.fb-facelist-items button.sel{background:${GOLD};color:#1a1206;border-color:${GOLD};font-weight:600;}
.fb-facelist-items .fi-idx{font-weight:700;min-width:26px;}
.fb-facelist-items .fi-lbl{flex:1;}
.fb-facelist-items .fi-meta{opacity:.7;font-size:9px;}

.fb-header,.fb-features,.fb-params,.fb-invariants,.fb-toolbar,.fb-analysis{
  position:absolute;backdrop-filter:blur(14px) saturate(1.2);
  background:rgba(13,18,28,0.66);border:1px solid rgba(159,179,200,0.12);
  border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.5);}

.fb-header{top:18px;left:18px;display:flex;align-items:center;gap:14px;padding:11px 16px;}
.fb-mark{font-size:22px;color:${GOLD};filter:drop-shadow(0 0 8px ${GOLD}88);}
.fb-titles h1{font-size:14px;font-weight:600;letter-spacing:.2px;margin:0;}
.fb-titles p{font-size:11px;margin:2px 0 0;color:${STEEL};opacity:.8;}
.fb-kernel{display:flex;align-items:center;gap:7px;font-size:11px;padding:5px 11px;
  border-radius:20px;margin-left:8px;background:rgba(0,0,0,0.3);}
.fb-kernel .dot{width:7px;height:7px;border-radius:50%;}
.fb-kernel.on{color:#8ff0a4;}.fb-kernel.on .dot{background:#4ade80;box-shadow:0 0 8px #4ade80;}
.fb-kernel.off{color:#fbbf24;}.fb-kernel.off .dot{background:#fbbf24;box-shadow:0 0 8px #fbbf24;}

.fb-toolbar{top:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;
  gap:6px;padding:8px 12px;}
.fb-tb-label{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:${STEEL};
  opacity:.55;margin-right:4px;}
.fb-toolbar button{border:1px solid rgba(159,179,200,0.16);background:rgba(255,255,255,0.04);
  color:#e9eef5;font-size:12px;padding:7px 11px;border-radius:8px;cursor:pointer;font-weight:500;
  transition:.13s;}
.fb-toolbar button:hover{border-color:${GOLD}77;background:${GOLD}18;color:${GOLD};}

.fb-features{top:78px;left:18px;width:210px;padding:12px;max-height:38vh;overflow:auto;}
.fb-feat-head{font-size:10px;text-transform:uppercase;letter-spacing:1.4px;color:${STEEL};
  opacity:.6;margin-bottom:10px;}
.fb-feat-node{display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:9px;
  background:rgba(255,255,255,0.03);border:1px solid rgba(159,179,200,0.08);cursor:pointer;
  transition:.12s;}
.fb-feat-node:hover{border-color:${GOLD}44;}
.fb-feat-node.active{border-color:${GOLD};background:${GOLD}1a;box-shadow:0 0 0 1px ${GOLD}55 inset;}
.fb-feat-node.accent .ico{color:${GOLD};}
.fb-feat-node .ico{font-size:16px;color:${GOLD_DIM};}
.fb-feat-node strong{display:block;font-size:12px;font-weight:600;}
.fb-feat-node em{display:block;font-size:10px;color:${STEEL};opacity:.78;font-style:normal;margin-top:1px;}
.fb-feat-arrow{text-align:center;font-size:11px;color:${STEEL};opacity:.4;margin:3px 0;}

.fb-params{right:18px;top:18px;width:230px;padding:14px;max-height:64vh;overflow:auto;}
.fb-panel-title{font-size:11px;font-weight:600;color:${GOLD};margin-bottom:12px;
  text-transform:uppercase;letter-spacing:.6px;}
.fb-seg{display:flex;gap:4px;background:rgba(0,0,0,0.3);padding:3px;border-radius:9px;margin-bottom:14px;}
.fb-seg button{flex:1;border:0;background:transparent;color:${STEEL};font-size:11px;padding:6px;
  border-radius:6px;cursor:pointer;font-weight:500;}
.fb-seg button.on{background:${GOLD};color:#1a1206;font-weight:600;}

.fb-dim{display:block;margin-bottom:13px;}
.fb-dim-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;
  color:${STEEL};opacity:.7;margin-bottom:5px;}
.fb-dim input[type=range]{width:100%;accent-color:${GOLD};height:4px;cursor:pointer;}
.fb-dim-val{display:block;text-align:right;font-size:13px;font-weight:600;
  font-family:'JetBrains Mono',monospace;color:${GOLD};margin-top:3px;}
.fb-dim-val em{font-size:10px;color:${STEEL};font-style:normal;margin-left:3px;}
.fb-divider{height:1px;background:rgba(159,179,200,0.12);margin:12px 0;}

.fb-check{display:flex;align-items:center;gap:8px;font-size:11px;color:${STEEL};margin-bottom:12px;cursor:pointer;}
.fb-check input{accent-color:${GOLD};}
.fb-hint-txt{font-size:10px;color:${STEEL};opacity:.7;line-height:1.4;margin:4px 0 0;}

.fb-sel-head{font-size:11px;color:${STEEL};margin:6px 0 8px;}
.fb-sel-head b{color:${GOLD};}.fb-sel-head em{font-style:normal;opacity:.6;font-size:10px;}
.fb-pick-btn{width:100%;border:1px solid ${GOLD}44;background:${GOLD}10;color:${GOLD};
  font-size:11px;padding:8px;border-radius:8px;cursor:pointer;margin-bottom:8px;font-weight:600;}
.fb-pick-btn:hover{background:${GOLD}22;}
.fb-sel-list{display:flex;flex-direction:column;gap:3px;max-height:160px;overflow:auto;}
.fb-sel-list button{text-align:left;border:1px solid rgba(159,179,200,0.1);
  background:rgba(255,255,255,0.02);color:${STEEL};font-size:10px;padding:5px 8px;
  border-radius:6px;cursor:pointer;font-family:'JetBrains Mono',monospace;}
.fb-sel-list button:hover{border-color:${GOLD}55;}
.fb-sel-list button.sel{background:${GOLD};color:#1a1206;border-color:${GOLD};font-weight:600;}

.fb-del-btn{width:100%;border:1px solid rgba(248,113,113,0.3);background:rgba(248,113,113,0.08);
  color:#fca5a5;font-size:11px;padding:7px;border-radius:8px;cursor:pointer;margin-top:12px;}
.fb-del-btn:hover{background:rgba(248,113,113,0.16);}

.fb-actions{display:flex;flex-direction:column;gap:8px;}
.fb-actions button,.fb-export{border:1px solid rgba(159,179,200,0.18);background:rgba(255,255,255,0.04);
  color:#e9eef5;font-size:11px;padding:8px;border-radius:8px;cursor:pointer;text-align:center;
  text-decoration:none;font-weight:500;transition:.15s;}
.fb-actions button:hover,.fb-export:hover{border-color:${GOLD}66;background:${GOLD}14;}
.fb-export[aria-disabled=true]{opacity:.4;pointer-events:none;}

.fb-analysis{right:18px;bottom:18px;width:230px;padding:14px;}
.fb-mat{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;font-size:11px;color:${STEEL};}
.fb-mat select{flex:1;background:rgba(0,0,0,0.4);color:#e9eef5;border:1px solid rgba(159,179,200,0.18);
  border-radius:7px;padding:6px;font-size:11px;cursor:pointer;}
.fb-mass{display:flex;flex-direction:column;gap:2px;}
.fb-row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:5px 0;
  border-bottom:1px solid rgba(159,179,200,0.07);}
.fb-row:last-child{border-bottom:0;}
.fb-row .rk{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:${STEEL};opacity:.65;}
.fb-row .rv{font-size:12px;font-family:'JetBrains Mono',monospace;text-align:right;}
.fb-row.hi .rv{color:${GOLD};font-weight:600;font-size:14px;}

.fb-invariants{left:50%;transform:translateX(-50%);bottom:18px;max-width:640px;
  display:flex;gap:0;padding:0;overflow:hidden;}
.fb-invariants .inv{flex:1;padding:11px 16px;display:flex;flex-direction:column;gap:3px;
  border-right:1px solid rgba(159,179,200,0.1);}
.fb-invariants .inv:last-child{border-right:0;}
.fb-invariants .inv.err{background:rgba(248,113,113,0.1);}
.fb-invariants .k{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:${STEEL};opacity:.6;}
.fb-invariants .v{font-size:13px;font-weight:600;}
.fb-invariants .v.mono{font-family:'JetBrains Mono',monospace;font-size:12px;}
.fb-invariants .v b{color:${GOLD};}
.fb-invariants .chk{font-size:10px;color:${STEEL};opacity:.85;}
.fb-invariants.ok{border-color:${GOLD}44;}

.fb-hide{position:absolute;bottom:18px;right:260px;width:34px;height:34px;border-radius:9px;
  border:1px solid rgba(159,179,200,0.15);background:rgba(13,18,28,0.7);color:${STEEL};
  font-size:15px;cursor:pointer;backdrop-filter:blur(10px);z-index:5;}
.fb-hide:hover{color:${GOLD};border-color:${GOLD}55;}
`;
