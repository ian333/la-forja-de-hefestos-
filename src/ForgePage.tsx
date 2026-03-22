/**
 * ⚒️ La Forja de Hefestos — F-Rep CAD Engine v2
 * ================================================
 * /forge — Free, public, no login.
 *
 * Fusión 360 mexicano con motor F-Rep + Three.js rasterization.
 * SDF → Marching Cubes (Web Worker) → Three.js BufferGeometry → 60fps.
 * Export STL, planos de producción, simulación cinemática.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type SdfNode,
  type SdfPrimitive,
  type SdfOperation,
  isPrimitive,
  findNode,
} from '@/lib/sdf-engine';
import { useForgeStore } from '@/lib/useForgeStore';
import ForgeViewport from '@/lib/ForgeViewport';
import { downloadSTL } from '@/lib/stl-export';
import { downloadBlueprint } from '@/lib/blueprint-export';
import { animateBicycle, computeSceneStats, createSimState, type SimulationState, type SceneStats } from '@/lib/simulation';

// ═══════════════════════════════════════════════════════════════
// Design tokens — Fusion 360 palette
// ═══════════════════════════════════════════════════════════════

const PANEL = 'bg-[#2d2d2d] border border-[#3c3c3c]';
const PANEL_HEADER = 'bg-[#383838] border-b border-[#4a4a4a]';
const ACCENT = '#0696D7'; // Autodesk blue
const BTN = 'px-2 py-1 rounded text-[11px] transition-all duration-100';
const BTN_TOOL = `${BTN} hover:bg-[#505050] text-[#ccc] flex flex-col items-center gap-0.5`;
const BTN_ACTIVE = `${BTN} bg-[#0696D7]/20 text-[#0696D7] border border-[#0696D7]/30`;

const TYPE_ICONS: Record<string, string> = {
  sphere: '●', box: '■', cylinder: '◆', torus: '◎', cone: '▲', capsule: '┃',
  union: '∪', subtract: '∖', intersect: '∩', smoothUnion: '⊕',
};

const TYPE_LABELS: Record<string, string> = {
  sphere: 'Esfera', box: 'Caja', cylinder: 'Cilindro', torus: 'Toroide', cone: 'Cono', capsule: 'Tubo',
  union: 'Unión', subtract: 'Resta', intersect: 'Intersección', smoothUnion: 'Suave',
};

const PRIM_PARAMS: Record<string, { key: string; label: string; unit: string; min: number; max: number; step: number }[]> = {
  sphere: [{ key: 'radius', label: 'Radio', unit: 'mm', min: 0.05, max: 5, step: 0.05 }],
  box: [
    { key: 'sizeX', label: 'Ancho', unit: 'mm', min: 0.05, max: 5, step: 0.05 },
    { key: 'sizeY', label: 'Alto', unit: 'mm', min: 0.05, max: 5, step: 0.05 },
    { key: 'sizeZ', label: 'Prof.', unit: 'mm', min: 0.05, max: 5, step: 0.05 },
  ],
  cylinder: [
    { key: 'radius', label: 'Radio', unit: 'mm', min: 0.05, max: 5, step: 0.05 },
    { key: 'height', label: 'Altura', unit: 'mm', min: 0.05, max: 5, step: 0.05 },
  ],
  torus: [
    { key: 'majorRadius', label: 'R Mayor', unit: 'mm', min: 0.1, max: 5, step: 0.05 },
    { key: 'minorRadius', label: 'R Menor', unit: 'mm', min: 0.01, max: 2, step: 0.01 },
  ],
  cone: [
    { key: 'radius', label: 'Radio', unit: 'mm', min: 0.05, max: 5, step: 0.05 },
    { key: 'height', label: 'Altura', unit: 'mm', min: 0.05, max: 5, step: 0.05 },
  ],
  capsule: [
    { key: 'ax', label: 'A.x', unit: 'mm', min: -10, max: 10, step: 0.05 },
    { key: 'ay', label: 'A.y', unit: 'mm', min: -10, max: 10, step: 0.05 },
    { key: 'az', label: 'A.z', unit: 'mm', min: -10, max: 10, step: 0.05 },
    { key: 'bx', label: 'B.x', unit: 'mm', min: -10, max: 10, step: 0.05 },
    { key: 'by', label: 'B.y', unit: 'mm', min: -10, max: 10, step: 0.05 },
    { key: 'bz', label: 'B.z', unit: 'mm', min: -10, max: 10, step: 0.05 },
    { key: 'radius', label: 'Radio', unit: 'mm', min: 0.005, max: 1, step: 0.005 },
  ],
};

const OP_TYPES: { value: SdfOperation['type']; label: string }[] = [
  { value: 'union', label: 'Unión' },
  { value: 'subtract', label: 'Resta' },
  { value: 'intersect', label: 'Intersección' },
  { value: 'smoothUnion', label: 'Suave' },
];

// ═══════════════════════════════════════════════════════════════
// Micro-components — Engineering-precision inputs
// ═══════════════════════════════════════════════════════════════

function ParamInput({ label, value, onChange, min = -10, max = 10, step = 0.05, unit }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] group">
      <span className="text-[#999] w-12 shrink-0 text-right text-[10px] truncate">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-[2px] appearance-none bg-[#555] rounded-full cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#0696D7] [&::-webkit-slider-thumb]:shadow
                   [&::-webkit-slider-thumb]:shadow-[#0696D7]/30 group-hover:[&::-webkit-slider-thumb]:scale-125
                   [&::-webkit-slider-thumb]:transition-transform"
      />
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v))); }}
        className="w-14 bg-[#1a1a1a] border border-[#4a4a4a] rounded px-1.5 py-0.5 text-right font-mono text-[10px]
                   text-[#ddd] focus:border-[#0696D7] focus:text-white outline-none tabular-nums
                   [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {unit && <span className="text-[9px] text-[#777] w-5">{unit}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Browser Tree (Left Panel)
// ═══════════════════════════════════════════════════════════════

function TreeItem({ node, depth, selectedId, onSelect }: {
  node: SdfNode; depth: number; selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const isOp = !isPrimitive(node);
  const isSel = node.id === selectedId;

  return (
    <>
      <button
        onClick={() => onSelect(node.id)}
        className={`w-full flex items-center gap-1.5 py-[5px] px-1.5 rounded text-[11px] transition-all text-left ${
          isSel
            ? 'bg-[#0696D7]/15 text-[#0696D7] ring-1 ring-[#0696D7]/30'
            : 'text-[#bbb] hover:bg-[#3c3c3c] hover:text-white'
        }`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        <span className={`text-[10px] ${isOp ? 'text-[#b4a0ff]' : 'text-[#0696D7]'}`}>
          {TYPE_ICONS[node.type]}
        </span>
        <span className="truncate flex-1">{node.label}</span>
        <span className="text-[9px] text-[#666] font-mono shrink-0">
          {TYPE_LABELS[node.type]}
        </span>
      </button>
      {isOp && (node as SdfOperation).children.map(child => (
        <TreeItem key={child.id} node={child} depth={depth + 1}
          selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function countNodes(n: SdfNode): number {
  if (isPrimitive(n)) return 1;
  return 1 + (n as SdfOperation).children.reduce((s, c) => s + countNodes(c), 0);
}

// ═══════════════════════════════════════════════════════════════
// Main Component — Fusion 360 Layout
// ═══════════════════════════════════════════════════════════════

export default function ForgePage() {
  // Zustand store
  const scene = useForgeStore(s => s.scene);
  const selectedId = useForgeStore(s => s.selectedId);
  const meshing = useForgeStore(s => s.meshing);
  const meshQuality = useForgeStore(s => s.meshQuality);
  const mesh = useForgeStore(s => s.mesh);
  const initWorker = useForgeStore(s => s.initWorker);
  const destroyWorker = useForgeStore(s => s.destroyWorker);
  const setSelectedId = useForgeStore(s => s.setSelectedId);
  const addPrimitive = useForgeStore(s => s.addPrimitive);
  const addOperation = useForgeStore(s => s.addOperation);
  const deleteNode = useForgeStore(s => s.deleteNode);
  const updateNode = useForgeStore(s => s.updateNode);
  const updateParam = useForgeStore(s => s.updateParam);
  const updatePosition = useForgeStore(s => s.updatePosition);
  const updateRotation = useForgeStore(s => s.updateRotation);
  const setScene = useForgeStore(s => s.setScene);
  const undo = useForgeStore(s => s.undo);
  const redo = useForgeStore(s => s.redo);

  // Local state
  const [fps, setFps] = useState(60);
  const [sim, setSim] = useState<SimulationState>(() => createSimState());
  const [exporting, setExporting] = useState<string | null>(null);
  const [showTree, setShowTree] = useState(true);
  const [showProps, setShowProps] = useState(true);
  const baseSceneRef = useRef<SdfOperation | null>(null);

  const selectedNode = selectedId ? findNode(scene, selectedId) : null;
  const nodeCount = useMemo(() => countNodes(scene), [scene]);
  const triCount = mesh?.triCount ?? 0;
  const stats = useMemo<SceneStats>(() => computeSceneStats(scene), [scene]);

  // ── Init/destroy worker ──
  useEffect(() => {
    initWorker();
    return () => destroyWorker();
  }, [initWorker, destroyWorker]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && selectedId !== scene.id && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault(); deleteNode(selectedId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, deleteNode, selectedId, scene.id]);

  // ── Simulation loop ──
  useEffect(() => {
    if (!sim.running) return;
    if (!baseSceneRef.current) baseSceneRef.current = scene;
    let lastTime = performance.now();
    let id: number;
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setSim(prev => ({ ...prev, time: prev.time + dt * prev.speed }));
      setScene(animateBicycle(scene, dt, sim.speed) as SdfOperation);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.running, sim.speed]);

  // ── Export handlers ──
  const handleExportSTL = useCallback(async () => {
    setExporting('STL');
    await new Promise(r => requestAnimationFrame(r));
    const count = downloadSTL(scene, 'la-forja-pieza.stl', 128);
    setExporting(null);
    alert(`STL exportado: ${count.toLocaleString()} triángulos`);
  }, [scene]);

  const handleExportBlueprint = useCallback(async () => {
    setExporting('Plano');
    await new Promise(r => requestAnimationFrame(r));
    downloadBlueprint(scene, {
      title: 'PIEZA — LA FORJA DE HEFESTOS',
      material: 'Acero AISI 4130 Cromoly',
      author: 'Ingeniero',
    });
    setExporting(null);
  }, [scene]);

  // ═══════════════════════════════════════════════════════
  // RENDER — Fusion 360 Layout
  // ═══════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 bg-[#2d2d2d] text-[#ddd] overflow-hidden select-none flex flex-col">

      {/* ═══════════════════════════════════════════════
           TOOLBAR — Top (Fusion 360 ribbon style)
         ═══════════════════════════════════════════════ */}
      <header className="h-[72px] bg-[#383838] border-b border-[#4a4a4a] flex flex-col shrink-0 z-20">
        {/* Top row — brand + file ops */}
        <div className="h-7 flex items-center px-3 gap-3 border-b border-[#4a4a4a]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-[#0696D7] to-[#005B96] flex items-center justify-center">
              <svg viewBox="0 0 16 16" className="w-3 h-3 text-white" fill="currentColor">
                <path d="M8 1L2 4v4l6 3 6-3V4L8 1zM3 5l5 2.5L13 5l-5-2.5L3 5zm5 3.7L3 6.2v2.6l5 2.5 5-2.5V6.2L8 8.7z"/>
              </svg>
            </div>
            <span className="text-[12px] font-semibold text-white tracking-tight">La Forja</span>
            <span className="text-[9px] text-[#888] font-mono">v2.0</span>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <button onClick={undo} className="px-1.5 py-0.5 text-[11px] text-[#999] hover:text-white hover:bg-[#505050] rounded" title="Deshacer (Ctrl+Z)">↶</button>
            <button onClick={redo} className="px-1.5 py-0.5 text-[11px] text-[#999] hover:text-white hover:bg-[#505050] rounded" title="Rehacer (Ctrl+Y)">↷</button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-[10px]">
            <button onClick={handleExportSTL} disabled={!!exporting}
              className="px-2 py-0.5 rounded bg-[#0696D7]/15 text-[#0696D7] hover:bg-[#0696D7]/25 disabled:opacity-40 border border-[#0696D7]/20">
              {exporting === 'STL' ? '⏳...' : '⬇ STL'}
            </button>
            <button onClick={handleExportBlueprint} disabled={!!exporting}
              className="px-2 py-0.5 rounded bg-[#505050] text-[#ccc] hover:bg-[#5a5a5a] disabled:opacity-40 border border-[#5a5a5a]">
              {exporting === 'Plano' ? '⏳...' : '📐 Plano'}
            </button>
            <a href="/" className="text-[#888] hover:text-[#0696D7] text-[10px]">← Inicio</a>
          </div>
        </div>

        {/* Bottom row — tool ribbon */}
        <div className="flex-1 flex items-center px-3 gap-1">
          {/* Primitives */}
          <div className="flex items-center gap-0.5 px-2 border-r border-[#4a4a4a] h-full">
            <span className="text-[8px] text-[#888] uppercase tracking-wider mr-1">Crear</span>
            {(['sphere', 'box', 'cylinder', 'torus', 'cone', 'capsule'] as SdfPrimitive['type'][]).map(t => (
              <button key={t} onClick={() => addPrimitive(t)} title={TYPE_LABELS[t]}
                className={BTN_TOOL}>
                <span className="text-[14px]">{TYPE_ICONS[t]}</span>
                <span className="text-[8px]">{TYPE_LABELS[t]}</span>
              </button>
            ))}
          </div>

          {/* Operations */}
          <div className="flex items-center gap-0.5 px-2 border-r border-[#4a4a4a] h-full">
            <span className="text-[8px] text-[#888] uppercase tracking-wider mr-1">CSG</span>
            {OP_TYPES.map(o => (
              <button key={o.value} onClick={() => addOperation(o.value)} title={o.label}
                className={BTN_TOOL}>
                <span className="text-[14px]">{TYPE_ICONS[o.value]}</span>
                <span className="text-[8px]">{o.label}</span>
              </button>
            ))}
          </div>

          {/* Simulation */}
          <div className="flex items-center gap-1 px-2 h-full">
            <button
              onClick={() => {
                if (!sim.running) baseSceneRef.current = scene;
                setSim(p => ({ ...p, running: !p.running }));
              }}
              className={`${BTN} text-[10px] ${sim.running
                ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              }`}>
              {sim.running ? '⏸ Pausar' : '▶ Simular'}
            </button>
            {sim.running && (
              <>
                <button onClick={() => { setSim(p => ({ ...p, running: false, time: 0 })); if (baseSceneRef.current) setScene(baseSceneRef.current); }}
                  className={`${BTN} text-[10px] text-[#999]`}>⏹</button>
                {[0.5, 1, 2, 4].map(s => (
                  <button key={s} onClick={() => setSim(p => ({ ...p, speed: s }))}
                    className={`px-1 py-0.5 text-[9px] rounded ${sim.speed === s ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#888]'}`}>
                    {s}×
                  </button>
                ))}
                <span className="text-[9px] font-mono text-[#888] ml-1">t={sim.time.toFixed(1)}s</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* View toggles */}
          <div className="flex items-center gap-1">
            <button onClick={() => setShowTree(p => !p)}
              className={`${BTN} text-[10px] ${showTree ? BTN_ACTIVE : 'text-[#888] hover:bg-[#505050]'}`}>
              ☰ Escena
            </button>
            <button onClick={() => setShowProps(p => !p)}
              className={`${BTN} text-[10px] ${showProps ? BTN_ACTIVE : 'text-[#888] hover:bg-[#505050]'}`}>
              ◈ Props
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════
           BODY — panels + viewport
         ═══════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — Browser / Scene Tree */}
        {showTree && (
          <aside className={`w-56 ${PANEL} flex flex-col shrink-0 z-10`}>
            <div className={`px-3 py-2 ${PANEL_HEADER} flex items-center justify-between`}>
              <h2 className="text-[10px] font-semibold text-[#ccc] uppercase tracking-wider">Explorador</h2>
              <span className="text-[9px] text-[#888] font-mono">{nodeCount}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-1 space-y-px">
              <TreeItem node={scene} depth={0} selectedId={selectedId} onSelect={setSelectedId} />
            </div>

            {/* Quick add + delete */}
            <div className="p-2 border-t border-[#4a4a4a] space-y-1.5">
              {selectedId && selectedId !== scene.id && (
                <button onClick={() => deleteNode(selectedId)}
                  className="w-full py-1 text-[10px] rounded bg-red-500/8 text-red-400/70 hover:bg-red-500/15 hover:text-red-300 border border-red-500/10">
                  Eliminar seleccionado
                </button>
              )}
              {/* Stats */}
              <div className="text-[9px] text-[#777] space-y-0.5">
                <div className="flex justify-between"><span>Piezas</span><span className="text-[#aaa]">{stats.totalParts}</span></div>
                <div className="flex justify-between"><span>Vol.</span><span className="text-[#aaa]">{stats.estimatedVolumeCm3} cm³</span></div>
                <div className="flex justify-between"><span>Masa</span><span className="text-[#aaa]">{stats.estimatedMassKg} kg</span></div>
              </div>
            </div>
          </aside>
        )}

        {/* CENTER — Three.js Viewport */}
        <div className="flex-1 relative bg-[#1a1a1a]">
          <ForgeViewport
            className="absolute inset-0"
            onFps={setFps}
          />
          {/* Meshing indicator */}
          {meshing && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded bg-[#383838]/90 border border-[#4a4a4a] text-[10px] text-[#0696D7] flex items-center gap-2 z-10">
              <div className="w-2 h-2 rounded-full bg-[#0696D7] animate-pulse" />
              Generando malla ({meshQuality})…
            </div>
          )}
        </div>

        {/* RIGHT — Properties */}
        {showProps && selectedNode && (
          <aside className={`w-64 ${PANEL} flex flex-col shrink-0 z-10`}>
            {/* Header */}
            <div className={`px-3 py-2 ${PANEL_HEADER}`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${isPrimitive(selectedNode) ? 'text-[#0696D7]' : 'text-[#b4a0ff]'}`}>
                  {TYPE_ICONS[selectedNode.type]}
                </span>
                <input type="text" value={selectedNode.label}
                  onChange={e => updateNode(selectedNode.id, { label: e.target.value })}
                  className="bg-transparent border-b border-[#555] text-[11px] font-medium text-white
                             focus:border-[#0696D7] outline-none flex-1 pb-0.5" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[8px] text-[#666] font-mono">{selectedNode.id.slice(0, 8)}</span>
                <span className="text-[8px] text-[#888] bg-[#3c3c3c] rounded px-1">{TYPE_LABELS[selectedNode.type]}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {isPrimitive(selectedNode) && (
                <>
                  {/* Position */}
                  <section>
                    <div className="text-[9px] text-[#888] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0696D7]/50" />Posición
                    </div>
                    <div className="space-y-1">
                      <ParamInput label="X" value={selectedNode.position[0]} onChange={v => updatePosition(selectedNode.id, 0, v)} min={-10} max={10} unit="mm" />
                      <ParamInput label="Y" value={selectedNode.position[1]} onChange={v => updatePosition(selectedNode.id, 1, v)} min={-2} max={10} unit="mm" />
                      <ParamInput label="Z" value={selectedNode.position[2]} onChange={v => updatePosition(selectedNode.id, 2, v)} min={-10} max={10} unit="mm" />
                    </div>
                  </section>

                  {/* Rotation */}
                  {selectedNode.type !== 'capsule' && (
                    <section>
                      <div className="text-[9px] text-[#888] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400/50" />Rotación
                      </div>
                      <div className="space-y-1">
                        <ParamInput label="Rx" value={+(((selectedNode.rotation?.[0] ?? 0) * 180 / Math.PI).toFixed(1))} onChange={v => updateRotation(selectedNode.id, 0, v * Math.PI / 180)} min={-180} max={180} step={1} unit="°" />
                        <ParamInput label="Ry" value={+(((selectedNode.rotation?.[1] ?? 0) * 180 / Math.PI).toFixed(1))} onChange={v => updateRotation(selectedNode.id, 1, v * Math.PI / 180)} min={-180} max={180} step={1} unit="°" />
                        <ParamInput label="Rz" value={+(((selectedNode.rotation?.[2] ?? 0) * 180 / Math.PI).toFixed(1))} onChange={v => updateRotation(selectedNode.id, 2, v * Math.PI / 180)} min={-180} max={180} step={1} unit="°" />
                      </div>
                    </section>
                  )}

                  {/* Dimensions */}
                  <section>
                    <div className="text-[9px] text-[#888] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0696D7]/50" />Dimensiones
                    </div>
                    <div className="space-y-1">
                      {(PRIM_PARAMS[selectedNode.type] || []).map(p => (
                        <ParamInput key={p.key} label={p.label}
                          value={selectedNode.params[p.key] ?? 1}
                          onChange={v => updateParam(selectedNode.id, p.key, v)}
                          min={p.min} max={p.max} step={p.step} unit={p.unit} />
                      ))}
                    </div>
                  </section>
                </>
              )}

              {!isPrimitive(selectedNode) && (
                <>
                  <section>
                    <div className="text-[9px] text-[#888] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#b4a0ff]/50" />Tipo de Operación
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {OP_TYPES.map(o => (
                        <button key={o.value} onClick={() => updateNode(selectedNode.id, { type: o.value })}
                          className={`${BTN} text-center text-[10px] ${
                            (selectedNode as SdfOperation).type === o.value
                              ? 'bg-[#0696D7]/15 text-[#0696D7] border border-[#0696D7]/25'
                              : 'text-[#888] hover:bg-[#505050] border border-transparent'
                          }`}>
                          {TYPE_ICONS[o.value]} {o.label}
                        </button>
                      ))}
                    </div>
                  </section>
                  {(selectedNode as SdfOperation).type === 'smoothUnion' && (
                    <section>
                      <div className="text-[9px] text-[#888] uppercase tracking-wider mb-1.5">Suavizado</div>
                      <ParamInput label="k" value={(selectedNode as SdfOperation).smoothness}
                        onChange={v => updateNode(selectedNode.id, { smoothness: v })} min={0.01} max={1} step={0.01} />
                    </section>
                  )}
                  <div className="text-[10px] text-[#777] font-mono">
                    {(selectedNode as SdfOperation).children.length} hijos
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
           STATUS BAR — Bottom
         ═══════════════════════════════════════════════ */}
      <footer className="h-6 bg-[#007ACC] flex items-center justify-between px-3 shrink-0 z-20">
        <div className="flex items-center gap-3 text-[10px] text-white/90">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            F-Rep + Three.js
          </span>
          <span className="text-white/60">|</span>
          <span>{nodeCount} nodos</span>
          <span className="text-white/60">|</span>
          <span>{triCount.toLocaleString()} triángulos</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/90">
          <span>LOD: {meshQuality}</span>
          <span className="text-white/60">|</span>
          <span className={fps < 30 ? 'text-red-300' : ''}>{fps} FPS</span>
        </div>
      </footer>
    </div>
  );
}
