/**
 * ⚒️ La Forja de Hefestos — Main Interface
 * ==========================================
 * Variable-first parametric CAD/CAM with:
 * - Omnibar universal search (Ctrl+K)
 * - Machine library (.mch import)
 * - Assembly decomposition
 * - GPU SDF ray marching
 * - Professional dark/gold design
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  type SdfNode,
  type SdfPrimitive,
  type SdfOperation,
  type SdfModule,
  isPrimitive,
  isModule,
  isContainer,
  findNode,
} from '@/lib/sdf-engine';
import { useForgeStore, getSessionSyncActive } from '@/lib/useForgeStore';
import ForgeViewport from '@/lib/ForgeViewport';
import { downloadSTL } from '@/lib/stl-export';
import { downloadBlueprint } from '@/lib/blueprint-export';
import { computeSceneStats, type SceneStats } from '@/lib/simulation';
import { PARAM_LABELS, type GaiaVariable } from '@/lib/gaia-variables';
import MarkingMenu, { type MarkingMenuItem, type MarkingMenuSection } from '@/components/MarkingMenu';
import Omnibar, { type OmniAction } from '@/components/Omnibar';
import ShortcutOverlay, { type ShortcutTool } from '@/components/ShortcutOverlay';
import Timeline, { type TimelineEntry } from '@/components/Timeline';
import SketchPanel from '@/components/SketchPanel';
import type { SketchTool } from '@/lib/SketchInViewport';
import { STANDARD_VIEWS, type StandardView } from '@/lib/viewport';
import type { SectionAxis } from '@/lib/viewport';
import {
  Menubar, MenubarMenu, MenubarTrigger, MenubarContent,
  MenubarItem, MenubarSeparator, MenubarSub, MenubarSubTrigger,
  MenubarSubContent, MenubarShortcut,
} from '@/components/ui/menubar';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Search, Download, Ruler, Loader2 } from 'lucide-react';
import {
  extrudeRect, extrudeCircle,
  type SketchShape, type SketchRect, type SketchCircle, type SketchPlane,
  PLANE_COLORS,
} from '@/lib/sketch-engine';
import { cpuRayMarch, detectFace, type Vec3 } from '@/lib/sdf-cpu';
import {
  type MachineConfig,
  machineIcon,
  formatEnvelope,
  machineDisplayString,
} from '@/lib/machine-config';
import { decomposeAssembly, assemblyStats } from '@/lib/step-import';
import BlueprintPanel from '@/components/BlueprintPanel';
import ManufacturingTimeline, { type VizFeature } from '@/components/ManufacturingTimeline';
import ThemePanel from '@/components/ThemePanel';
import { useThemeStore } from '@/lib/useThemeStore';
import { THEME_PROFILES } from '@/lib/theme-profiles';
import { playClick, playCreate, playComplete, playDelete, playUndo, playError } from '@/lib/forge-audio';

// ═══════════════════════════════════════════════════════════════
// Design Tokens — La Forja de Hefestos
// ═══════════════════════════════════════════════════════════════

const ICONS: Record<string, string> = {
  sphere: '●', box: '■', cylinder: '◆', torus: '◎', cone: '▲', capsule: '┃',
  union: '∪', subtract: '∖', intersect: '∩', smoothUnion: '⊕',
};
const LABELS: Record<string, string> = {
  sphere: 'Esfera', box: 'Caja', cylinder: 'Cilindro', torus: 'Toroide',
  cone: 'Cono', capsule: 'Cápsula',
  union: 'Unión', subtract: 'Resta', intersect: 'Intersección', smoothUnion: 'Suave',
};

// Theme colors — referencia a CSS variables (se usan como fallback inline)
const T = {
  bg:           'var(--c-base)',
  bgPanel:      'var(--c-surface)',
  bgInput:      'var(--c-base)',
  bgDeep:       'var(--c-surface-up)',
  bgOverlay:    'var(--c-overlay)',
  border:       'var(--c-border)',
  borderSub:    'var(--c-border-sub)',
  borderHi:     'var(--c-border-hi)',
  textPrimary:  'var(--c-text-1)',
  textSecondary:'var(--c-text-2)',
  textMuted:    'var(--c-text-3)',
  textDim:      'var(--c-text-4)',
  gold:         'var(--c-gold)',
  goldDim:      'var(--c-gold-dim)',
  goldGlow:     'var(--c-gold-glow)',
  accent:       'var(--c-blue)',
  green:        'var(--c-green)',
  red:          'var(--c-red)',
  orange:       'var(--c-orange)',
} as const;

// ═══════════════════════════════════════════════════════════════
// CAD Import Constants
// ═══════════════════════════════════════════════════════════════

const ACCEPTED_CAD_FORMATS = '.step,.stp,.iges,.igs,.brep,.brp,.mch';

// ═══════════════════════════════════════════════════════════════
// Toolbar types for menu items
// ═══════════════════════════════════════════════════════════════

interface DropdownItem {
  label?: string;
  icon?: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
  sub?: DropdownItem[];
}

/** Renders a list of DropdownItems as shadcn MenubarItems with sub-menu support */
function renderMenuItems(items: DropdownItem[], close?: () => void) {
  return items.map((item, i) => {
    if (item.divider) return <MenubarSeparator key={i} />;
    if (item.sub) {
      return (
        <MenubarSub key={i}>
          <MenubarSubTrigger disabled={item.disabled}>
            {item.icon && <span className="mr-2 text-[13px] opacity-60">{item.icon}</span>}
            {item.label}
          </MenubarSubTrigger>
          <MenubarSubContent>
            {renderMenuItems(item.sub, close)}
          </MenubarSubContent>
        </MenubarSub>
      );
    }
    return (
      <MenubarItem
        key={i}
        disabled={item.disabled}
        onClick={() => item.action?.()}
      >
        {item.icon && <span className="mr-2 text-[13px] opacity-60">{item.icon}</span>}
        {item.label}
        {item.shortcut && <MenubarShortcut>{item.shortcut}</MenubarShortcut>}
      </MenubarItem>
    );
  });
}

// ═══════════════════════════════════════════════════════════════
// Inline Components
// ═══════════════════════════════════════════════════════════════

/* ── Tree Item (para la sidebar expandida) ── */
function TreeNode({ node, depth, selectedId, activeModuleId, onSelect, onActivateModule, onRenameModule }: {
  node: SdfNode;
  depth: number;
  selectedId: string | null;
  activeModuleId?: string | null;
  onSelect: (id: string) => void;
  onActivateModule?: (id: string) => void;
  onRenameModule?: (id: string, name: string) => void;
}) {
  const isMod    = isModule(node);
  const isOp     = isContainer(node);
  const isSel    = node.id === selectedId;
  const isActive = isMod && node.id === activeModuleId;
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(node.label);
  const label = node.label;
  useEffect(() => { setRenameVal(label); }, [label]);
  const modColor = isMod ? (node as SdfModule).color : undefined;

  return (
    <>
      <div
        className={`group w-full flex items-center gap-1.5 py-1.5 rounded-md text-left transition-all cursor-pointer ${
          isSel ? 'bg-gold/10' : 'hover:bg-surface-up'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px`, ...(isActive ? { outline: `1px solid ${modColor}40` } : {}) }}
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => isMod && setRenaming(true)}
      >
        {isOp ? (
          <span onClick={e => { e.stopPropagation(); setOpen(p => !p); }}
            className="w-4 text-center text-[10px] text-text-3 hover:text-text-2 cursor-pointer shrink-0">
            {open ? '▾' : '▸'}
          </span>
        ) : <span className="w-4 shrink-0" />}

        {isMod ? (
          <span className="text-[13px] shrink-0" style={{ color: modColor }}>◈</span>
        ) : (
          <span className={`text-[13px] shrink-0 ${isContainer(node) ? 'text-[#bc8cff]' : 'text-gold'}`}>
            {ICONS[(node as SdfPrimitive | SdfOperation).type]}
          </span>
        )}

        {renaming ? (
          <input autoFocus value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={() => { onRenameModule?.(node.id, renameVal || label); setRenaming(false); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onRenameModule?.(node.id, renameVal || label); setRenaming(false); }
              if (e.key === 'Escape') { setRenameVal(label); setRenaming(false); }
              e.stopPropagation();
            }}
            onClick={e => e.stopPropagation()}
            className="flex-1 bg-overlay border border-gold/50 rounded px-1.5 text-[11px] font-mono text-text-1 outline-none h-5"
          />
        ) : (
          <span
            className={`flex-1 truncate text-[12px] ${isSel ? 'text-gold' : isMod ? 'font-medium' : 'text-text-2'} ${isActive ? 'underline decoration-dotted underline-offset-2' : ''}`}
            style={isMod && !isSel ? { color: modColor } : undefined}>
            {label}
          </span>
        )}

        {isMod && (
          <button
            onClick={e => { e.stopPropagation(); onActivateModule?.(isActive ? '' : node.id); }}
            title={isActive ? 'Módulo activo — clic para desactivar' : 'Activar módulo'}
            className={`w-4 h-4 shrink-0 flex items-center justify-center rounded text-[8px] transition-all ${
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
            }`}
            style={{ color: modColor, background: `${modColor}22` }}>
            {isActive ? '◉' : '◯'}
          </button>
        )}
      </div>

      {isOp && open && (node as SdfOperation | SdfModule).children.map(c => (
        <TreeNode key={c.id} node={c} depth={depth + 1}
          selectedId={selectedId} activeModuleId={activeModuleId}
          onSelect={onSelect}
          onActivateModule={onActivateModule}
          onRenameModule={onRenameModule}
        />
      ))}
    </>
  );
}

/* ── Variable Chip (for variable bar) ── */
function VarChip({ variable, onUpdate, onSelect }: {
  variable: GaiaVariable;
  onUpdate: (id: string, expr: string) => void;
  onSelect: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(variable.expression);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  useEffect(() => { setDraft(variable.expression); }, [variable.expression]);

  const commit = () => {
    setEditing(false);
    if (draft !== variable.expression) onUpdate(variable.id, draft);
  };

  const hasError = isNaN(variable.resolvedValue);

  return (
    <button
      className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-[12px] font-mono transition-all shrink-0 ${
        hasError
          ? 'bg-red/10 border border-red/30 text-red'
          : 'bg-base border border-border-hi text-text-1 hover:border-gold/40'
      }`}
      onClick={() => { if (!editing) { setEditing(true); onSelect(); } }}
    >
      <span className="text-[11px] text-gold font-semibold">{variable.name}</span>
      <span className="text-text-3">=</span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(variable.expression); setEditing(false); } }}
          className="w-20 bg-transparent border-b border-gold outline-none text-[12px] text-text-1 font-mono px-0"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span>{hasError ? 'ERR' : variable.resolvedValue % 1 === 0
          ? variable.resolvedValue
          : variable.resolvedValue.toFixed(3)}</span>
      )}
      {variable.unit !== 'none' && (
        <span className="text-[10px] text-[#484f58]">{variable.unit}</span>
      )}
    </button>
  );
}

/* ── Floating Properties Panel ── */
function FloatingProperties({ node, variables, onClose }: {
  node: SdfNode;
  variables: GaiaVariable[];
  onClose: () => void;
}) {
  const updateNode = useForgeStore(s => s.updateNode);
  const updateParam = useForgeStore(s => s.updateParam);
  const updatePosition = useForgeStore(s => s.updatePosition);
  const updateRotation = useForgeStore(s => s.updateRotation);
  const updateVariableExpression = useForgeStore(s => s.updateVariableExpression);
  const deleteNode = useForgeStore(s => s.deleteNode);
  const scene = useForgeStore(s => s.scene);

  const linkedVars = variables.filter(v => v.linkedPrimId === node.id);

  return (
    <div className="absolute top-3 left-16 z-20 w-72 forge-glass overflow-hidden animate-scaleIn">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--c-border-sub)' }}>
        <span className="text-[14px]" style={{ color: isPrimitive(node) ? 'var(--c-gold)' : 'var(--c-purple)' }}>
          {ICONS[(node as SdfPrimitive | SdfOperation).type] ?? '◈'}
        </span>
        <input
          type="text"
          value={node.label}
          onChange={e => updateNode(node.id, { label: e.target.value })}
          className="flex-1 bg-transparent text-[13px] font-semibold outline-none transition-colors"
          style={{ color: 'var(--c-text-1)', borderBottom: '1px solid transparent' }}
          onFocus={e => (e.target.style.borderBottomColor = 'var(--panel-glass-border)')}
          onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
        />
        <button onClick={onClose} className="forge-btn" style={{ padding: '2px 6px', fontSize: '12px' }}>✕</button>
      </div>

      <div className="px-4 py-3 space-y-4 max-h-[50vh] overflow-y-auto">
        {/* Dimensions (via linked variables) */}
        {isPrimitive(node) && linkedVars.length > 0 && (
          <section>
            <h3 className="forge-label mb-2">Dimensiones</h3>
            <div className="space-y-2">
              {linkedVars.map(v => {
                const meta = PARAM_LABELS[node.type]?.[v.linkedParamKey ?? ''];
                return (
                  <div key={v.id} className="flex items-center gap-2">
                    <span className="text-[12px] text-text-2 w-20 shrink-0 truncate">{meta?.label ?? v.linkedParamKey}</span>
                    <div className="flex-1 flex items-center gap-1.5">
                      <span className="text-[10px] text-gold font-mono">$</span>
                      <input
                        type="text"
                        value={v.expression}
                        onChange={e => updateVariableExpression(v.id, e.target.value)}
                        className="forge-input flex-1"
                      />
                      <span className="text-[10px] text-text-3 shrink-0">{v.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Raw params for primitives without variables (capsule) */}
        {isPrimitive(node) && linkedVars.length === 0 && (
          <section>
            <h3 className="forge-label mb-2">Parámetros</h3>
            <div className="space-y-2">
              {Object.entries(node.params).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[12px] text-text-2 w-20 shrink-0">{key}</span>
                  <input
                    type="number" step={0.05} value={val}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParam(node.id, key, v); }}
                    className="forge-input flex-1"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Position */}
        {isPrimitive(node) && (
          <section>
            <h3 className="forge-label mb-2">Posición</h3>
            <div className="grid grid-cols-3 gap-2">
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <div key={axis}>
                  <span className="text-[10px] text-text-3 block mb-0.5">{axis}</span>
                  <input
                    type="number" step={0.1}
                    value={+node.position[i].toFixed(3)}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) updatePosition(node.id, i as 0|1|2, v); }}
                    className="forge-input w-full"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rotation */}
        {isPrimitive(node) && node.type !== 'capsule' && (
          <section>
            <h3 className="forge-label mb-2">Rotación</h3>
            <div className="grid grid-cols-3 gap-2">
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <div key={axis}>
                  <span className="text-[10px] text-text-3 block mb-0.5">{axis}°</span>
                  <input
                    type="number" step={1}
                    value={+((node.rotation?.[i] ?? 0) * 180 / Math.PI).toFixed(1)}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateRotation(node.id, i as 0|1|2, v * Math.PI / 180); }}
                    className="forge-input w-full"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Operation type */}
        {!isPrimitive(node) && (
          <section>
            <h3 className="forge-label mb-2">Operación</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {(['union', 'subtract', 'intersect', 'smoothUnion'] as const).map(t => (
                <button key={t}
                  onClick={() => updateNode(node.id, { type: t })}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-[12px] transition-all ${
                    (node as SdfOperation).type === t
                      ? 'bg-gold/10 text-gold ring-1 ring-gold/25'
                      : 'text-text-2 hover:bg-surface-up hover:text-text-1'
                  }`}>
                  <span className="text-[14px]">{ICONS[t]}</span>
                  {LABELS[t]}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer: delete */}
      {node.id !== scene.id && (
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--c-border-sub)' }}>
          <button
            onClick={() => { deleteNode(node.id); onClose(); }}
            className="forge-btn forge-btn-red w-full justify-center py-1.5"
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function countNodes(n: SdfNode): number {
  if (isPrimitive(n)) return 1;
  return 1 + (n as SdfOperation | SdfModule).children.reduce((s, c) => s + countNodes(c), 0);
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ForgePage() {
  // ── Store ──
  const scene = useForgeStore(s => s.scene);
  const selectedId = useForgeStore(s => s.selectedId);
  const variables = useForgeStore(s => s.variables);
  const meshing = useForgeStore(s => s.meshing);
  const meshQuality = useForgeStore(s => s.meshQuality);
  const history = useForgeStore(s => s.history);
  const historyIndex = useForgeStore(s => s.historyIndex);
  const importedModels = useForgeStore(s => s.importedModels);
  const importing = useForgeStore(s => s.importing);
  const importError = useForgeStore(s => s.importError);
  const initWorker = useForgeStore(s => s.initWorker);
  const destroyWorker = useForgeStore(s => s.destroyWorker);
  const setSelectedId = useForgeStore(s => s.setSelectedId);
  const addPrimitive = useForgeStore(s => s.addPrimitive);
  const addOperation = useForgeStore(s => s.addOperation);
  const addExtrudedPrimitive = useForgeStore(s => s.addExtrudedPrimitive);
  const deleteNode = useForgeStore(s => s.deleteNode);
  const updateVariableExpression = useForgeStore(s => s.updateVariableExpression);
  const addVariable = useForgeStore(s => s.addVariable);
  const importFile = useForgeStore(s => s.importFile);
  const removeImportedModel = useForgeStore(s => s.removeImportedModel);
  const clearImportError = useForgeStore(s => s.clearImportError);
  const machines = useForgeStore(s => s.machines);
  const selectedMachine = useForgeStore(s => s.selectedMachine);
  const machineImporting = useForgeStore(s => s.machineImporting);
  const importMachine = useForgeStore(s => s.importMachine);
  const selectMachine = useForgeStore(s => s.selectMachine);
  const removeMachine = useForgeStore(s => s.removeMachine);
  // Reverse Engineering
  const reverseEngineerImported = useForgeStore(s => s.reverseEngineerImported);
  const reverseEngineering = useForgeStore(s => s.reverseEngineering);
  const reverseEngineeringResult = useForgeStore(s => s.reverseEngineeringResult);
  const clearReverseEngineering = useForgeStore(s => s.clearReverseEngineering);
  // CT-Scan Decomposition
  const ctScanImported = useForgeStore(s => s.ctScanImported);
  const ctScanning = useForgeStore(s => s.ctScanning);
  const ctScanResult = useForgeStore(s => s.ctScanResult);
  const clearCtScan = useForgeStore(s => s.clearCtScan);
  // Sketch Fitting
  const fittedSlices = useForgeStore(s => s.fittedSlices);
  const sketchFitting = useForgeStore(s => s.sketchFitting);
  const fitSketches = useForgeStore(s => s.fitSketches);
  const scanModel = useForgeStore(s => s.scanModel);
  const gpuFittedPlanes = useForgeStore(s => s.gpuFittedPlanes);
  const gpuFitting = useForgeStore(s => s.gpuFitting);
  const clearFittedSlices = useForgeStore(s => s.clearFittedSlices);
  const setModelMaterial = useForgeStore(s => s.setModelMaterial);
  // 3D Reconstruction
  const reconstruction = useForgeStore(s => s.reconstruction);
  const reconstructing = useForgeStore(s => s.reconstructing);
  const reconstructModel = useForgeStore(s => s.reconstructModel);
  const clearReconstruction = useForgeStore(s => s.clearReconstruction);
  const [sketchFilterAxis, setSketchFilterAxis] = useState<'X' | 'Y' | 'Z' | null>(null);
  const [selectedSliceIndex, setSelectedSliceIndex] = useState<number | null>(null);
  // Inline feature decomposition (Fusion 360-style)
  const [vizFeatures, setVizFeatures] = useState<VizFeature[] | null>(null);
  const [selectedFeatureIdx, setSelectedFeatureIdx] = useState<number | null>(null);
  const [scanViewMode, setScanViewMode] = useState<'slices' | 'features'>('slices');
  // Módulos
  const activeModuleId = useForgeStore(s => s.activeModuleId);
  const addModule     = useForgeStore(s => s.addModule);
  const renameModule  = useForgeStore(s => s.renameModule);
  const removeModule  = useForgeStore(s => s.removeModule);
  const setActiveModule = useForgeStore(s => s.setActiveModule);
  const undo = useForgeStore(s => s.undo);
  const redo = useForgeStore(s => s.redo);
  // Section view
  const section = useForgeStore(s => s.section);
  const toggleSection = useForgeStore(s => s.toggleSection);
  const setSectionEnabled = useForgeStore(s => s.setSectionEnabled);
  const setSectionAxis = useForgeStore(s => s.setSectionAxis);
  const setSectionDistance = useForgeStore(s => s.setSectionDistance);
  const setSectionFlip = useForgeStore(s => s.setSectionFlip);

  // ── Local state ──
  const [fps, setFps] = useState(60);
  const [exporting, setExporting] = useState<string | null>(null);
  const [treeExpanded, setTreeExpanded] = useState(false);
  const treePinned = useRef(false);
  const [sketchMode, setSketchMode] = useState<{ plane: SketchPlane } | null>(null);
  const [sketchShapes, setSketchShapes] = useState<SketchShape[]>([]);
  const [sketchTool, setSketchTool] = useState<SketchTool>('rect');
  const [sketchCursor, setSketchCursor] = useState<[number, number]>([0, 0]);
  const [extrudeDistance, setExtrudeDistance] = useState(1);
  const [facePicking, setFacePicking] = useState(false);
  const [showNewVarInput, setShowNewVarInput] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarExpr, setNewVarExpr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const machineInputRef = useRef<HTMLInputElement>(null);
  // Overlays
  const [markingMenu, setMarkingMenu] = useState<{ x: number; y: number } | null>(null);
  const [omnibarOpen, setOmnibarOpen] = useState(false);
  const [shortcutOverlay, setShortcutOverlay] = useState<{ x: number; y: number } | null>(null);
  const [machinePanel, setMachinePanel] = useState(false);
  const [blueprintPanel, setBlueprintPanel] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [materialPanel, setMaterialPanel] = useState<number | null>(null);
  // Camera transitions
  const [targetView, setTargetView] = useState<StandardView | null>(null);

  // ── Derived ──
  const selectedNode = selectedId ? findNode(scene, selectedId) : null;
  const nodeCount = useMemo(() => countNodes(scene), [scene]);
  const stats = useMemo<SceneStats>(() => computeSceneStats(scene), [scene]);

  // ── Init/destroy worker ──
  useEffect(() => { initWorker(); return () => destroyWorker(); }, [initWorker, destroyWorker]);

  // ── Load viz-data features after scan completes ──
  useEffect(() => {
    if (fittedSlices.length === 0 || importedModels.length === 0) {
      setVizFeatures(null);
      setSelectedFeatureIdx(null);
      return;
    }
    const slug = (importedModels[0].threeGroup.name || 'model')
      .replace(/\.(step|stp|iges|igs)$/i, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    fetch(`/viz-data/${slug}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.features) {
          setVizFeatures(data.features);
          setScanViewMode('features');
        }
      })
      .catch(() => {});
  }, [fittedSlices.length, importedModels]);

  // ── Feature click → find matching slice and fly camera ──
  const handleFeatureSelect = useCallback((idx: number | null) => {
    setSelectedFeatureIdx(idx);
    if (idx == null || !vizFeatures) { setSelectedSliceIndex(null); return; }
    const feat = vizFeatures[idx];
    if (!feat.normal || fittedSlices.length === 0) {
      // Fallback: map by axis label
      if (feat.normal) {
        const axes = ['X', 'Y', 'Z'] as const;
        const absN = feat.normal.map(Math.abs);
        const maxAxis = axes[absN.indexOf(Math.max(...absN))];
        // Pick the middle slice of that axis (most representative)
        const candidates = fittedSlices
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => s.axis === maxAxis);
        if (candidates.length > 0) {
          setSelectedSliceIndex(candidates[Math.floor(candidates.length / 2)].i);
        }
      }
      return;
    }
    const fn = feat.normal;
    // Score each slice by: (1) normal alignment, (2) offset distance to feature
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < fittedSlices.length; i++) {
      const s = fittedSlices[i];
      if (!s.uAxis || !s.vAxis || !s.planeOrigin) continue;
      // Slice normal from cross(u, v)
      const nx = s.uAxis[1] * s.vAxis[2] - s.uAxis[2] * s.vAxis[1];
      const ny = s.uAxis[2] * s.vAxis[0] - s.uAxis[0] * s.vAxis[2];
      const nz = s.uAxis[0] * s.vAxis[1] - s.uAxis[1] * s.vAxis[0];
      const dot = Math.abs(fn[0] * nx + fn[1] * ny + fn[2] * nz);
      if (dot < 0.85) continue; // Normal must be roughly aligned
      // Prefer slices with more contours (richer cross-section)
      const richness = s.contours.length;
      const score = dot * 100 + richness;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      setSelectedSliceIndex(bestIdx);
    }
  }, [vizFeatures, fittedSlices]);

  // ── Reset sketch shapes when entering/leaving sketch mode ──
  useEffect(() => {
    if (sketchMode) {
      setSketchShapes([]);
      setSketchTool('rect');
      // Fly camera to face the sketch plane orthogonally
      const planeToView: Record<SketchPlane, StandardView> = {
        XY: 'front',  // look along -Z → see XY
        XZ: 'top',    // look along -Y → see XZ
        YZ: 'right',  // look along -X → see YZ
      };
      setTargetView(planeToView[sketchMode.plane]);
    }
  }, [sketchMode?.plane]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault(); setOmnibarOpen(p => !p); return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault(); setOmnibarOpen(p => !p); return;
      }
      if (isInput) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); playUndo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); playUndo(); }
      if (e.key === 'Escape') {
        if (sketchMode) { setSketchMode(null); setSketchShapes([]); playClick(); return; }
        if (facePicking) setFacePicking(false);
        else if (selectedId) setSelectedId(null);
        playClick();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && selectedId !== scene.id) {
        e.preventDefault(); deleteNode(selectedId); playDelete();
      }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setShortcutOverlay(p => p ? null : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
        playClick();
      }
      if (e.key === 'S' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleSection();
        playClick();
      }
      // Number pad views (for desktops with numpad)
      if (e.code === 'Numpad1' && !e.ctrlKey) { e.preventDefault(); setTargetView('front'); }
      if (e.code === 'Numpad1' && e.ctrlKey)  { e.preventDefault(); setTargetView('back'); }
      if (e.code === 'Numpad7' && !e.ctrlKey) { e.preventDefault(); setTargetView('top'); }
      if (e.code === 'Numpad7' && e.ctrlKey)  { e.preventDefault(); setTargetView('bottom'); }
      if (e.code === 'Numpad3' && !e.ctrlKey) { e.preventDefault(); setTargetView('right'); }
      if (e.code === 'Numpad3' && e.ctrlKey)  { e.preventDefault(); setTargetView('left'); }
      if (e.code === 'Numpad0') { e.preventDefault(); setTargetView('iso'); }
      // F-key views (for laptops without numpad)
      if (e.key === 'F1' && !isInput) { e.preventDefault(); setTargetView('front'); }
      if (e.key === 'F2' && !isInput) { e.preventDefault(); setTargetView('right'); }
      if (e.key === 'F3' && !isInput) { e.preventDefault(); setTargetView('top'); }
      if (e.key === 'F4' && !isInput) { e.preventDefault(); setTargetView('iso'); }
      // Home key → reset to isometric
      if (e.key === 'Home' && !isInput) { e.preventDefault(); setTargetView('iso'); }
      if (e.key === '1') { addPrimitive('box'); playCreate(); }
      if (e.key === '2') { addPrimitive('sphere'); playCreate(); }
      if (e.key === '3') { addPrimitive('cylinder'); playCreate(); }
      if (e.key === '4') { addPrimitive('torus'); playCreate(); }
      if (e.key === '5') { addPrimitive('cone'); playCreate(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, deleteNode, selectedId, scene.id, addPrimitive, facePicking, setSelectedId, sketchMode, toggleSection]);

  // ── Handlers ──
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!facePicking) setMarkingMenu({ x: e.clientX, y: e.clientY });
  }, [facePicking]);

  const handleFacePick = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!facePicking) return;
    const cam = useForgeStore.getState().cameraRef;
    if (!cam) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(x, y), cam);
    const ro: Vec3 = [rc.ray.origin.x, rc.ray.origin.y, rc.ray.origin.z];
    const rd: Vec3 = [rc.ray.direction.x, rc.ray.direction.y, rc.ray.direction.z];
    const hit = cpuRayMarch(scene, ro, rd);
    if (hit.hit) {
      const face = detectFace(hit.normal, hit.position);
      setFacePicking(false);
      setSketchMode({ plane: face.plane });
    }
  }, [facePicking, scene]);

  const handleExportSTL = useCallback(async () => {
    setExporting('STL');
    await new Promise(r => requestAnimationFrame(r));
    downloadSTL(scene, 'gaia-forge-pieza.stl', 128);
    setExporting(null);
  }, [scene]);

  const handleExportBlueprint = useCallback(async () => {
    setExporting('SVG');
    await new Promise(r => requestAnimationFrame(r));
    downloadBlueprint(scene, { title: 'GAIA FORGE', material: 'ABS', author: 'GAIA' });
    setExporting(null);
  }, [scene]);

  const handleSketchFinish = useCallback(() => {
    if (!sketchMode || sketchShapes.length === 0) return;
    for (const shape of sketchShapes) {
      if (shape.kind === 'rect') {
        const r = shape as SketchRect;
        const res = extrudeRect(r, sketchMode.plane, extrudeDistance);
        addExtrudedPrimitive(res.type, res.position, res.rotation, res.params,
          `Ext. ${r.width.toFixed(1)}×${r.height.toFixed(1)}×${extrudeDistance.toFixed(1)}`);
      } else {
        const c = shape as SketchCircle;
        const res = extrudeCircle(c, sketchMode.plane, extrudeDistance);
        addExtrudedPrimitive(res.type, res.position, res.rotation, res.params,
          `Cil. R${c.radius.toFixed(2)}×${extrudeDistance.toFixed(1)}`);
      }
    }
    setSketchMode(null);
    setSketchShapes([]);
  }, [sketchMode, sketchShapes, extrudeDistance, addExtrudedPrimitive]);

  const handleAddVariable = useCallback(() => {
    if (newVarName.trim() && newVarExpr.trim()) {
      addVariable(newVarName.trim(), newVarExpr.trim());
      setNewVarName('');
      setNewVarExpr('');
      setShowNewVarInput(false);
    }
  }, [newVarName, newVarExpr, addVariable]);

  // ── Import Handlers ──
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      importFile(file);
    }
    // Reset so same file can be re-imported
    e.target.value = '';
  }, [importFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    let hadMch = false;
    for (const file of Array.from(files)) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (['step', 'stp', 'iges', 'igs', 'brep', 'brp'].includes(ext ?? '')) {
        importFile(file);
      } else if (ext === 'mch') {
        await importMachine(file);
        hadMch = true;
      }
    }
    if (hadMch) setMachinePanel(true);
  }, [importFile, importMachine]);

  // ── Commands / Shortcuts / Menus ──
  const handleImportMachine = useCallback(() => {
    machineInputRef.current?.click();
  }, []);

  const handleMachineFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await importMachine(file);
    }
    e.target.value = '';
    setMachinePanel(true);
  }, [importMachine]);

  const omniActions: OmniAction[] = useMemo(() => {
    const actions: OmniAction[] = [
      // ── Crear ──
      { id: 'box', label: 'Crear Caja', description: 'Primitiva cúbica paramétrica', icon: '■', shortcut: '1', category: 'Crear', keywords: ['box', 'cube', 'cubo'], action: () => { addPrimitive('box'); playCreate(); } },
      { id: 'sphere', label: 'Crear Esfera', description: 'Esfera paramétrica', icon: '●', shortcut: '2', category: 'Crear', keywords: ['sphere', 'ball', 'bola'], action: () => { addPrimitive('sphere'); playCreate(); } },
      { id: 'cylinder', label: 'Crear Cilindro', description: 'Cilindro paramétrico', icon: '◆', shortcut: '3', category: 'Crear', keywords: ['cylinder', 'tubo'], action: () => { addPrimitive('cylinder'); playCreate(); } },
      { id: 'torus', label: 'Crear Toroide', description: 'Toroide paramétrico', icon: '◎', shortcut: '4', category: 'Crear', keywords: ['torus', 'donut', 'anillo'], action: () => { addPrimitive('torus'); playCreate(); } },
      { id: 'cone', label: 'Crear Cono', description: 'Cono paramétrico', icon: '▲', shortcut: '5', category: 'Crear', keywords: ['cone'], action: () => { addPrimitive('cone'); playCreate(); } },
      { id: 'capsule', label: 'Crear Cápsula', description: 'Cápsula paramétrica', icon: '┃', category: 'Crear', keywords: ['capsule', 'pill'], action: () => { addPrimitive('capsule'); playCreate(); } },

      // ── Booleana ──
      { id: 'union', label: 'Unión', description: 'Combinar cuerpos sólidos', icon: '∪', category: 'Booleana', keywords: ['combine', 'join', 'merge'], action: () => { addOperation('union'); playComplete(); } },
      { id: 'subtract', label: 'Resta', description: 'Restar un cuerpo de otro', icon: '∖', category: 'Booleana', keywords: ['cut', 'cortar', 'remove'], action: () => { addOperation('subtract'); playComplete(); } },
      { id: 'intersect', label: 'Intersección', description: 'Quedarse con la intersección', icon: '∩', category: 'Booleana', keywords: ['common', 'overlap'], action: () => { addOperation('intersect'); playComplete(); } },
      { id: 'smooth', label: 'Unión Suave', description: 'Combinar con redondeo suave', icon: '⊕', category: 'Booleana', keywords: ['fillet', 'blend', 'smooth'], action: () => { addOperation('smoothUnion'); playComplete(); } },

      // ── Sketch ──
      { id: 'sketch-xy', label: 'Sketch — Plano XY', icon: '✎', category: 'Sketch', keywords: ['draw', 'dibujar'], action: () => setSketchMode({ plane: 'XY' }) },
      { id: 'sketch-xz', label: 'Sketch — Plano XZ', icon: '✎', category: 'Sketch', action: () => setSketchMode({ plane: 'XZ' }) },
      { id: 'sketch-yz', label: 'Sketch — Plano YZ', icon: '✎', category: 'Sketch', action: () => setSketchMode({ plane: 'YZ' }) },
      { id: 'sketch-face', label: 'Sketch en Cara…', description: 'Clic en una cara para ubicar sketch', icon: '◎', category: 'Sketch', action: () => setFacePicking(true) },

      // ── Archivo ──
      { id: 'export-stl', label: 'Exportar STL', description: 'Exportar geometría para impresión 3D', icon: '⬇', category: 'Archivo', keywords: ['download', 'descargar', '3d print', 'stl'], action: handleExportSTL },
      { id: 'export-svg', label: 'Exportar Plano SVG', description: 'Plano técnico vectorial', icon: '📐', category: 'Archivo', keywords: ['blueprint', 'plano', 'drawing'], action: handleExportBlueprint },
      { id: 'import-cad', label: 'Importar STEP/IGES/BREP', description: 'Abrir modelo CAD existente', icon: '📦', category: 'Archivo', keywords: ['open', 'abrir', 'load', 'step', 'iges'], action: handleImportClick },
      { id: 'import-machine', label: 'Importar Máquina (.mch)', description: 'Cargar configuración CNC / impresora 3D', icon: '🏭', category: 'Archivo', keywords: ['cnc', 'machine', 'maquina', 'mch', 'printer', 'impresora'], action: handleImportMachine },

      // ── Editar ──
      { id: 'undo', label: 'Deshacer', icon: '↶', shortcut: 'Ctrl+Z', category: 'Editar', action: undo },
      { id: 'redo', label: 'Rehacer', icon: '↷', shortcut: 'Ctrl+Y', category: 'Editar', action: redo },

      // ── Vistas de Cámara ──
      ...STANDARD_VIEWS.map(v => ({
        id: `view-${v.key}`, label: `Vista ${v.label}`, icon: v.icon,
        category: 'Vista', keywords: ['camera', 'view', 'vista', v.key],
        shortcut: v.shortcut, action: () => setTargetView(v.key),
      })),

      // ── Inspección ──
      { id: 'section-toggle', label: section.enabled ? 'Desactivar Sección' : 'Activar Sección', icon: '✂', category: 'Inspección', keywords: ['section', 'clip', 'cortar', 'corte'], action: toggleSection },
      { id: 'section-x', label: 'Sección Eje X', icon: '✂', category: 'Inspección', keywords: ['section', 'clip'], action: () => { setSectionAxis('X'); setSectionEnabled(true); } },
      { id: 'section-y', label: 'Sección Eje Y', icon: '✂', category: 'Inspección', keywords: ['section', 'clip'], action: () => { setSectionAxis('Y'); setSectionEnabled(true); } },
      { id: 'section-z', label: 'Sección Eje Z', icon: '✂', category: 'Inspección', keywords: ['section', 'clip'], action: () => { setSectionAxis('Z'); setSectionEnabled(true); } },
      { id: 'reverse-engineer', label: 'Ingeniería Inversa', description: 'Descomponer modelo importado en primitivas SDF' , icon: '🔬', category: 'Inspección', keywords: ['reverse', 'engineer', 'decompose', 'descomponer', 'primitivas', 'feature recognition'], action: () => { if (importedModels.length > 0) reverseEngineerImported(0); } },
      { id: 'ct-scan', label: 'CT-Scan Decomposición', description: 'Descomponer pieza por secciones transversales (3 ejes)' , icon: '🩻', category: 'Inspección', keywords: ['ct', 'scan', 'cross', 'section', 'sección', 'contorno', 'perfil', 'descomponer', 'slice', 'corte'], action: () => { if (importedModels.length > 0) ctScanImported(0); } },
      { id: 'scan-model', label: 'Escanear Pieza', description: 'GPU Scan: planos guiados por geometría + winding-number → error mínimo', icon: '⚒️', category: 'Inspección', keywords: ['scan', 'escanear', 'ct', 'gpu', 'geometry', 'fit', 'sketch', 'winding', 'plane', 'plano'], action: () => { if (importedModels.length > 0) scanModel(0); } },
      { id: 'reconstruct-3d', label: 'Reconstruir 3D', description: 'Genera pieza 3D extrudiendo perfiles ajustados', icon: '🏗️', category: 'Inspección', keywords: ['reconstruct', 'reconstruir', '3d', 'extrude', 'extruir', 'build', 'pieza', 'solid'], action: reconstructModel },
      { id: 'clear-reconstruction', label: 'Limpiar Reconstrucción', description: 'Eliminar la reconstrucción 3D actual', icon: '🧹', category: 'Inspección', keywords: ['clear', 'limpiar', 'reconstruction', 'reconstrucción', 'borrar'], action: clearReconstruction },

      // ── Perfiles de Color ──
      { id: 'theme-open', label: 'Perfiles de Color', description: 'Abrir selector de perfiles de color', icon: '🎨', category: 'Configuración', keywords: ['theme', 'tema', 'color', 'perfil', 'profile', 'dark', 'oscuro', 'settings', 'configuración'], action: () => setThemePanelOpen(true) },
      ...THEME_PROFILES.map(tp => ({
        id: `theme-${tp.id}`, label: `${tp.icon} ${tp.name}`, description: tp.description,
        icon: '🎨', category: 'Perfiles de Color', keywords: ['theme', 'tema', 'color', tp.name.toLowerCase()],
        action: () => useThemeStore.getState().setTheme(tp.id),
      })),

      // ── Materiales ──
      { id: 'mat-pla', label: 'PLA', description: 'Ácido poliláctico — Impresión 3D FDM', icon: '🧱', category: 'Materiales', keywords: ['plastico', 'filament', 'filamento', 'fdm', 'fff'], action: () => {} },
      { id: 'mat-abs', label: 'ABS', description: 'Acrilonitrilo butadieno estireno — Alta resistencia', icon: '🧱', category: 'Materiales', keywords: ['plastico', 'resistente', 'automotive'], action: () => {} },
      { id: 'mat-petg', label: 'PETG', description: 'Polietileno tereftalato glicol', icon: '🧱', category: 'Materiales', keywords: ['plastico', 'transparente'], action: () => {} },
      { id: 'mat-nylon', label: 'Nylon (PA)', description: 'Poliamida — Flexible y durable', icon: '🧱', category: 'Materiales', keywords: ['poliamida', 'flexible', 'engineering'], action: () => {} },
      { id: 'mat-al6061', label: 'Aluminio 6061-T6', description: 'Aleación ligera — CNC milling', icon: '🔩', category: 'Materiales', keywords: ['aluminum', 'metal', 'lightweight', 'ligero', 'mecanizado'], action: () => {} },
      { id: 'mat-al7075', label: 'Aluminio 7075-T6', description: 'Aleación aeroespacial de alta resistencia', icon: '🔩', category: 'Materiales', keywords: ['aerospace', 'aeroespacial', 'high strength'], action: () => {} },
      { id: 'mat-steel1018', label: 'Acero 1018', description: 'Acero al carbono bajo — Uso general', icon: '🔩', category: 'Materiales', keywords: ['steel', 'carbon', 'carbono', 'mild'], action: () => {} },
      { id: 'mat-steel4140', label: 'Acero 4140', description: 'Acero aleado al cromo-molibdeno', icon: '🔩', category: 'Materiales', keywords: ['steel', 'alloy', 'aleado', 'chromoly'], action: () => {} },
      { id: 'mat-ss304', label: 'Inox 304', description: 'Acero inoxidable austenítico', icon: '🔩', category: 'Materiales', keywords: ['stainless', 'inoxidable', 'food grade'], action: () => {} },
      { id: 'mat-ss316', label: 'Inox 316', description: 'Acero inoxidable marine/médico', icon: '🔩', category: 'Materiales', keywords: ['stainless', 'marinro', 'medical'], action: () => {} },
      { id: 'mat-ti6al4v', label: 'Titanio Ti-6Al-4V', description: 'Aleación alfa-beta — Aeroespacial/médica', icon: '🔩', category: 'Materiales', keywords: ['titanium', 'aerospace', 'implant'], action: () => {} },
      { id: 'mat-brass', label: 'Latón C360', description: 'Latón de corte libre', icon: '🔩', category: 'Materiales', keywords: ['brass', 'copper', 'cobre', 'free machining'], action: () => {} },
      { id: 'mat-copper', label: 'Cobre C110', description: 'Cobre electrolítico — Conductividad', icon: '🔩', category: 'Materiales', keywords: ['copper', 'conductive', 'electrical'], action: () => {} },

      // ── Colores ──
      { id: 'col-silver', label: 'Plata', description: 'Acabado metálico plateado', icon: '◉', category: 'Colores', keywords: ['silver', 'metal', 'gris'], action: () => {} },
      { id: 'col-gold', label: 'Dorado', description: 'Acabado dorado / latón', icon: '◉', category: 'Colores', keywords: ['gold', 'brass', 'oro'], action: () => {} },
      { id: 'col-black', label: 'Negro Mate', description: 'Acabado negro sin brillo', icon: '◉', category: 'Colores', keywords: ['black', 'matte', 'mate', 'dark'], action: () => {} },
      { id: 'col-white', label: 'Blanco', description: 'Acabado blanco brillante', icon: '◉', category: 'Colores', keywords: ['white', 'bright', 'clean'], action: () => {} },
      { id: 'col-red', label: 'Rojo', description: 'Color rojo intenso', icon: '◉', category: 'Colores', keywords: ['red', 'danger'], action: () => {} },
      { id: 'col-blue', label: 'Azul', description: 'Azul metalizado', icon: '◉', category: 'Colores', keywords: ['blue', 'metallic'], action: () => {} },
      { id: 'col-green', label: 'Verde', description: 'Verde anodizado', icon: '◉', category: 'Colores', keywords: ['green', 'anodized'], action: () => {} },
      { id: 'col-orange', label: 'Naranja', description: 'Naranja de seguridad', icon: '◉', category: 'Colores', keywords: ['orange', 'safety'], action: () => {} },

      // ── Máquinas (from loaded configs) ──
      ...machines.map(m => ({
        id: `machine-${m.id}`,
        label: `${m.vendor} ${m.model}`,
        description: `${m.capabilities.join(', ')} · ${m.axisCount} ejes · ${formatEnvelope(m)}${m.maxSpindleSpeed ? ' · ' + m.maxSpindleSpeed + ' RPM' : ''}`,
        icon: machineIcon(m),
        category: 'Máquinas',
        keywords: [m.vendor, m.model, ...m.capabilities, 'cnc', 'máquina'],
        action: () => selectMachine(m.id),
      })),

      // ── Fabricación ──
      { id: 'fab-cam-setup', label: 'Configurar CAM', description: 'Crear setup de mecanizado', icon: '⚙️', category: 'Fabricación', keywords: ['cam', 'setup', 'machining', 'mecanizado'], disabled: true, action: () => {} },
      { id: 'fab-toolpath', label: 'Generar Toolpath', description: 'Calcular trayectorias de herramienta', icon: '🔧', category: 'Fabricación', keywords: ['toolpath', 'trajectory', 'gcode'], disabled: true, action: () => {} },
      { id: 'fab-simulate', label: 'Simular Mecanizado', description: 'Simulación de remoción de material', icon: '▶', category: 'Fabricación', keywords: ['simulate', 'simular', 'verificar'], disabled: true, action: () => {} },
      { id: 'fab-gcode', label: 'Exportar G-Code', description: 'Post-procesar y generar G-Code', icon: '📄', category: 'Fabricación', keywords: ['gcode', 'post', 'nc', 'cnc'], disabled: true, action: () => {} },

      // ── Vista ──
      { id: 'view-machine-lib', label: 'Biblioteca de Máquinas', description: 'Ver máquinas cargadas', icon: '🏭', category: 'Vista', keywords: ['machines', 'library', 'biblioteca'], action: () => setMachinePanel(p => !p) },
    ];

    return actions;
  }, [addPrimitive, addOperation, undo, redo, handleExportSTL, handleExportBlueprint, handleImportClick, handleImportMachine, machines, selectMachine, importedModels, reverseEngineerImported, ctScanImported, fitSketches, scanModel, reconstructModel, clearReconstruction]);

  const shortcutTools: ShortcutTool[] = useMemo(() => [
    { label: 'Caja', icon: '■', shortcut: '1', action: () => addPrimitive('box') },
    { label: 'Esfera', icon: '●', shortcut: '2', action: () => addPrimitive('sphere') },
    { label: 'Cilindro', icon: '◆', shortcut: '3', action: () => addPrimitive('cylinder') },
    { label: 'Toroide', icon: '◎', shortcut: '4', action: () => addPrimitive('torus') },
    { label: 'Cono', icon: '▲', shortcut: '5', action: () => addPrimitive('cone') },
    { label: 'Unión', icon: '∪', shortcut: 'U', action: () => addOperation('union') },
    { label: 'Resta', icon: '∖', shortcut: 'X', action: () => addOperation('subtract') },
  ], [addPrimitive, addOperation]);

  const markingMenuSections: MarkingMenuSection[] = useMemo(() => {
    const hasSelection = selectedId && selectedId !== scene.id;

    const crear: MarkingMenuSection = {
      label: 'Crear', icon: '✦', items: [
        { label: 'Caja', icon: '■', shortcut: '1', action: () => { addPrimitive('box'); playCreate(); } },
        { label: 'Esfera', icon: '●', shortcut: '2', action: () => { addPrimitive('sphere'); playCreate(); } },
        { label: 'Cilindro', icon: '◆', shortcut: '3', action: () => { addPrimitive('cylinder'); playCreate(); } },
        { label: 'Toroide', icon: '◎', shortcut: '4', action: () => { addPrimitive('torus'); playCreate(); } },
        { label: 'Cono', icon: '▲', shortcut: '5', action: () => { addPrimitive('cone'); playCreate(); } },
        { label: 'Cápsula', icon: '┃', action: () => { addPrimitive('capsule'); playCreate(); } },
      ],
    };

    const sketch: MarkingMenuSection = {
      label: 'Sketch', icon: '✎', items: [
        { label: 'Plano XY', icon: '⬜', action: () => setSketchMode({ plane: 'XY' }) },
        { label: 'Plano XZ', icon: '⬜', action: () => setSketchMode({ plane: 'XZ' }) },
        { label: 'Plano YZ', icon: '⬜', action: () => setSketchMode({ plane: 'YZ' }) },
        { label: 'En Cara…', icon: '◎', action: () => setFacePicking(true) },
      ],
    };

    const booleana: MarkingMenuSection = {
      label: 'Booleana', icon: '∪', items: [
        { label: 'Unión', icon: '∪', action: () => { addOperation('union'); playComplete(); } },
        { label: 'Resta', icon: '∖', action: () => { addOperation('subtract'); playComplete(); } },
        { label: 'Intersección', icon: '∩', action: () => { addOperation('intersect'); playComplete(); } },
        { label: 'Suave', icon: '⊕', action: () => { addOperation('smoothUnion'); playComplete(); } },
      ],
    };

    const exportar: MarkingMenuSection = {
      label: 'Exportar', icon: '⬇', items: [
        { label: 'STL', icon: '⬇', action: handleExportSTL },
        { label: 'Plano SVG', icon: '📐', action: handleExportBlueprint },
      ],
    };

    const vista: MarkingMenuSection = {
      label: 'Vista', icon: '◇', items: STANDARD_VIEWS.map(v => ({
        label: v.label, icon: v.icon, shortcut: v.shortcut, action: () => setTargetView(v.key),
      })),
    };

    const seccion: MarkingMenuSection = {
      label: section.enabled ? 'Sección ✂' : 'Sección', icon: '✂',
      action: () => { toggleSection(); playClick(); },
    };

    const buscar: MarkingMenuSection = {
      label: 'Buscar', icon: '⌘', shortcut: '⌘K',
      action: () => setOmnibarOpen(true),
    };

    if (hasSelection) {
      return [
        crear,
        booleana,
        sketch,
        { label: 'Deshacer', icon: '↶', shortcut: '⌘Z', action: () => { undo(); playUndo(); } },
        exportar,
        seccion,
        buscar,
        { label: 'Eliminar', icon: '✕', shortcut: 'Del', action: () => { deleteNode(selectedId!); playDelete(); } },
      ];
    }

    return [
      crear,
      sketch,
      booleana,
      { label: 'Importar', icon: '📦', action: handleImportClick },
      exportar,
      vista,
      seccion,
      buscar,
    ];
  }, [addPrimitive, addOperation, selectedId, scene.id, deleteNode, undo,
      handleExportSTL, handleExportBlueprint, handleImportClick, section.enabled, toggleSection]);

  const timelineEntries: TimelineEntry[] = useMemo(() =>
    history.map((_, i) => ({
      id: i,
      label: i === 0 ? 'Inicio' : `Paso ${i}`,
      icon: i === 0 ? '◉' : '◆',
      type: 'modify' as const,
    })),
  [history]);

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  const syncActive = getSessionSyncActive();

  return (
    <TooltipProvider delayDuration={300}>
    <div className="fixed inset-0 overflow-hidden select-none flex flex-col" style={{ background: 'var(--c-base)', color: 'var(--c-text-1)', fontFamily: 'var(--font-sans)' }}>

      {/* ════════════════════════════════════════════════════
          HEADER — shadcn Menubar — La Forja de Hefestos
          ════════════════════════════════════════════════════ */}
      <header className="h-11 flex items-center pl-3 pr-2 gap-1.5 shrink-0 z-30 border-b border-border" style={{ background: 'var(--panel-glass)', backdropFilter: 'blur(32px) saturate(1.5)', WebkitBackdropFilter: 'blur(32px) saturate(1.5)' }}>
        {/* Brand */}
        <div className="flex items-center gap-2 mr-1">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `linear-gradient(135deg, var(--c-gold) 0%, var(--c-gold-warm) 100%)`, boxShadow: '0 0 12px var(--c-gold-glow)' }}>
            <svg viewBox="0 0 16 16" className="w-3 h-3" fill="rgba(255,255,255,0.95)">
              <path d="M8 1L2 4v4l6 3 6-3V4L8 1zM3 5l5 2.5L13 5l-5-2.5L3 5zm5 3.7L3 6.2v2.6l5 2.5 5-2.5V6.2L8 8.7z"/>
            </svg>
          </div>
          <span className="text-[10px] font-semibold tracking-[0.16em] hidden lg:block text-primary">HEFESTOS</span>
        </div>

        {/* ─── FUSION-STYLE MENUBAR ─── */}
        <Menubar className="border-none bg-transparent h-8 p-0 gap-1">

          {/* SKETCH */}
          <MenubarMenu>
            <MenubarTrigger className="text-[11px] font-medium tracking-wide px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/60 transition-colors duration-150">
              SKETCH
            </MenubarTrigger>
            <MenubarContent className="min-w-[240px]">
              {renderMenuItems([
                { label: 'Create Sketch', icon: '✎', action: () => setSketchMode({ plane: 'XY' }) },
                { label: 'Sketch en Cara…', icon: '◎', action: () => setFacePicking(true) },
                { divider: true },
                { label: 'Plano XY', icon: '⬜', action: () => setSketchMode({ plane: 'XY' }) },
                { label: 'Plano XZ', icon: '⬜', action: () => setSketchMode({ plane: 'XZ' }) },
                { label: 'Plano YZ', icon: '⬜', action: () => setSketchMode({ plane: 'YZ' }) },
                { divider: true },
                { label: 'Line', icon: '╱', disabled: true },
                { label: 'Rectangle', icon: '▭', sub: [
                  { label: 'Center Rectangle', icon: '⊞', action: () => setSketchMode({ plane: 'XY' }) },
                  { label: '2-Point Rectangle', icon: '▭', disabled: true },
                  { label: '3-Point Rectangle', icon: '▱', disabled: true },
                ]},
                { label: 'Circle', icon: '○', sub: [
                  { label: 'Center Diameter', icon: '○', action: () => setSketchMode({ plane: 'XY' }) },
                  { label: '2-Point Circle', icon: '◯', disabled: true },
                  { label: '3-Point Circle', icon: '◯', disabled: true },
                ]},
                { label: 'Arc', icon: '⌒', sub: [
                  { label: '3-Point Arc', icon: '⌒', disabled: true },
                  { label: 'Center Point Arc', icon: '⌓', disabled: true },
                  { label: 'Tangent Arc', icon: '⌢', disabled: true },
                ]},
                { label: 'Polygon', icon: '⬠', disabled: true },
                { label: 'Ellipse', icon: '⬯', disabled: true },
                { label: 'Slot', icon: '⊖', disabled: true },
                { label: 'Spline', icon: '∿', disabled: true },
                { label: 'Point', icon: '·', disabled: true },
                { label: 'Text', icon: 'T', disabled: true },
                { divider: true },
                { label: 'Fillet', icon: '◗', disabled: true },
                { label: 'Chamfer', icon: '◢', disabled: true },
                { label: 'Trim', icon: '✂', disabled: true },
                { label: 'Extend', icon: '→', disabled: true },
                { label: 'Offset', icon: '⧈', disabled: true },
                { label: 'Mirror', icon: '⧻', disabled: true },
                { label: 'Pattern', icon: '⊞', sub: [
                  { label: 'Rectangular Pattern', icon: '⊞', disabled: true },
                  { label: 'Circular Pattern', icon: '◎', disabled: true },
                ]},
                { divider: true },
                { label: 'Constraints', icon: '📐', sub: [
                  { label: 'Coincident', icon: '⊙', disabled: true },
                  { label: 'Horizontal', icon: '—', disabled: true },
                  { label: 'Vertical', icon: '│', disabled: true },
                  { label: 'Perpendicular', icon: '⊥', disabled: true },
                  { label: 'Parallel', icon: '∥', disabled: true },
                  { label: 'Tangent', icon: '⌢', disabled: true },
                ]},
                { label: 'Dimension', icon: '↔', disabled: true },
              ])}
            </MenubarContent>
          </MenubarMenu>

          {/* SOLID */}
          <MenubarMenu>
            <MenubarTrigger className="text-[11px] font-medium tracking-wide px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/60 transition-colors duration-150">
              SOLID
            </MenubarTrigger>
            <MenubarContent className="min-w-[240px]">
              {renderMenuItems([
                { label: 'Create', icon: '🧊', sub: [
                  { label: 'Extrude', icon: '⬆', shortcut: 'E', action: () => setSketchMode({ plane: 'XY' }) },
                  { label: 'Revolve', icon: '↻', disabled: true },
                  { label: 'Sweep', icon: '⤴', disabled: true },
                  { label: 'Loft', icon: '⋔', disabled: true },
                  { divider: true },
                  { label: 'Hole', icon: '⊘', disabled: true },
                  { label: 'Thread', icon: '⎈', disabled: true },
                  { label: 'Rib', icon: '▯', disabled: true },
                  { divider: true },
                  { label: 'Box', icon: '■', shortcut: '1', action: () => addPrimitive('box') },
                  { label: 'Cylinder', icon: '◆', shortcut: '3', action: () => addPrimitive('cylinder') },
                  { label: 'Sphere', icon: '●', shortcut: '2', action: () => addPrimitive('sphere') },
                  { label: 'Torus', icon: '◎', shortcut: '4', action: () => addPrimitive('torus') },
                  { label: 'Cone', icon: '▲', shortcut: '5', action: () => addPrimitive('cone') },
                  { label: 'Capsule', icon: '┃', action: () => addPrimitive('capsule') },
                  { label: 'Coil', icon: '⌀', disabled: true },
                  { label: 'Pipe', icon: '◌', disabled: true },
                  { divider: true },
                  { label: 'Pattern', icon: '⊞', sub: [
                    { label: 'Rectangular Pattern', icon: '⊞', disabled: true },
                    { label: 'Circular Pattern', icon: '◎', disabled: true },
                    { label: 'Pattern on Path', icon: '⤳', disabled: true },
                  ]},
                  { label: 'Mirror', icon: '⧻', disabled: true },
                ]},
                { divider: true },
                { label: 'Modify', icon: '🔧', sub: [
                  { label: 'Fillet', icon: '◗', disabled: true },
                  { label: 'Chamfer', icon: '◢', disabled: true },
                  { label: 'Shell', icon: '⊟', disabled: true },
                  { label: 'Draft', icon: '◸', disabled: true },
                  { label: 'Scale', icon: '⤡', disabled: true },
                  { divider: true },
                  { label: 'Combine', icon: '⊕', disabled: true },
                  { label: 'Split Body', icon: '⊘', disabled: true },
                  { label: 'Split Face', icon: '⊘', disabled: true },
                  { label: 'Move/Copy', icon: '↔', disabled: true },
                  { label: 'Align', icon: '⊞', disabled: true },
                  { divider: true },
                  { label: 'Physical Material', icon: '🧱', disabled: true },
                  { label: 'Appearance', icon: '🎨', disabled: true },
                ]},
                { divider: true },
                { label: 'Boolean', icon: '∪', sub: [
                  { label: 'Union', icon: '∪', action: () => addOperation('union') },
                  { label: 'Subtract', icon: '∖', action: () => addOperation('subtract') },
                  { label: 'Intersect', icon: '∩', action: () => addOperation('intersect') },
                  { label: 'Smooth Union', icon: '⊕', action: () => addOperation('smoothUnion') },
                ]},
              ])}
            </MenubarContent>
          </MenubarMenu>

          {/* SURFACE */}
          <MenubarMenu>
            <MenubarTrigger className="text-[11px] font-medium tracking-wide px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/60 transition-colors duration-150">
              SURFACE
            </MenubarTrigger>
            <MenubarContent>
              {renderMenuItems([
                { label: 'Extrude', icon: '⬆', disabled: true },
                { label: 'Revolve', icon: '↻', disabled: true },
                { label: 'Sweep', icon: '⤴', disabled: true },
                { label: 'Loft', icon: '⋔', disabled: true },
                { divider: true },
                { label: 'Patch', icon: '◻', disabled: true },
                { label: 'Ruled', icon: '▯', disabled: true },
                { label: 'Offset', icon: '⧈', disabled: true },
                { divider: true },
                { label: 'Trim', icon: '✂', disabled: true },
                { label: 'Untrim', icon: '↩', disabled: true },
                { label: 'Extend', icon: '→', disabled: true },
                { label: 'Stitch', icon: '🧵', disabled: true },
                { label: 'Unstitch', icon: '✄', disabled: true },
                { label: 'Thicken', icon: '▮', disabled: true },
              ])}
            </MenubarContent>
          </MenubarMenu>

          {/* SHEET METAL */}
          <MenubarMenu>
            <MenubarTrigger className="text-[11px] font-medium tracking-wide px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/60 transition-colors duration-150">
              METAL
            </MenubarTrigger>
            <MenubarContent>
              {renderMenuItems([
                { label: 'Flange', icon: '⌐', disabled: true },
                { label: 'Bend', icon: '⌒', disabled: true },
                { label: 'Flat Pattern', icon: '▭', disabled: true },
                { label: 'Unfold', icon: '↗', disabled: true },
                { label: 'Refold', icon: '↙', disabled: true },
                { divider: true },
                { label: 'Sheet Metal Rules', icon: '📏', disabled: true },
              ])}
            </MenubarContent>
          </MenubarMenu>

          {/* CONSTRUCT */}
          <MenubarMenu>
            <MenubarTrigger className="text-[11px] font-medium tracking-wide px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/60 transition-colors duration-150">
              CONSTRUCT
            </MenubarTrigger>
            <MenubarContent>
              {renderMenuItems([
                { label: 'Offset Plane', icon: '⊟', disabled: true },
                { label: 'Plane at Angle', icon: '◸', disabled: true },
                { label: 'Tangent Plane', icon: '⊞', disabled: true },
                { label: 'Midplane', icon: '⊡', disabled: true },
                { divider: true },
                { label: 'Axis Through Cylinder', icon: '│', disabled: true },
                { label: 'Axis Through 2 Points', icon: '│', disabled: true },
                { label: 'Axis Perpendicular', icon: '│', disabled: true },
                { divider: true },
                { label: 'Point at Vertex', icon: '·', disabled: true },
                { label: 'Point Through 2 Edges', icon: '·', disabled: true },
                { label: 'Point at Center', icon: '·', disabled: true },
              ])}
            </MenubarContent>
          </MenubarMenu>

          {/* INSPECT */}
          <MenubarMenu>
            <MenubarTrigger className="text-[11px] font-medium tracking-wide px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/60 transition-colors duration-150">
              INSPECT
            </MenubarTrigger>
            <MenubarContent>
              {renderMenuItems([
                { label: 'Measure', icon: '📏', disabled: true },
                { label: section.enabled ? '✂ Section OFF' : '✂ Section ON', icon: '⊢', action: toggleSection, shortcut: 'Shift+S' },
                { label: 'Interference', icon: '⊗', disabled: true },
                { label: 'Curvature Comb', icon: '∿', disabled: true },
                { label: 'Zebra Analysis', icon: '▤', disabled: true },
                { label: 'Draft Analysis', icon: '◸', disabled: true },
                { divider: true },
                { label: '🔬 Reverse Engineer', icon: '⚙', action: () => { if (importedModels.length > 0) reverseEngineerImported(0); }, disabled: importedModels.length === 0 || reverseEngineering },
                { label: '⚒️ Escanear Pieza', icon: '⚙', action: () => { if (importedModels.length > 0) scanModel(0); }, disabled: importedModels.length === 0 || sketchFitting },
                { label: fittedSlices.length > 0 ? '🧹 Clear Sketches' : '🧹 Clear Sketches', icon: '✕', action: clearFittedSlices, disabled: fittedSlices.length === 0 },
                { label: '🏗️ Reconstruir 3D', icon: '⚙', action: reconstructModel, disabled: fittedSlices.length === 0 || reconstructing },
                { label: '🧹 Clear Reconstrucción', icon: '✕', action: clearReconstruction, disabled: !reconstruction },
                { divider: true },
                { label: '📐 Extracción de Planos', icon: '📐', action: () => setBlueprintPanel(true) },
                { label: 'Component Color Cycling', icon: '🎨', disabled: true },
                { label: '🎨 Perfiles de Color', icon: '⚙', action: () => setThemePanelOpen(true) },
                { divider: true },
                { label: 'Standard Views', icon: '◇', sub: [
                  ...STANDARD_VIEWS.map(v => ({
                    label: v.label,
                    icon: v.icon,
                    shortcut: v.shortcut,
                    action: () => setTargetView(v.key),
                  })),
                ]},
              ])}
            </MenubarContent>
          </MenubarMenu>

          {/* INSERT */}
          <MenubarMenu>
            <MenubarTrigger className="text-[11px] font-medium tracking-wide px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/60 transition-colors duration-150">
              INSERT
            </MenubarTrigger>
            <MenubarContent>
              {renderMenuItems([
                { label: 'Import STEP/IGES/BREP…', icon: '📦', action: handleImportClick },
                { divider: true },
                { label: 'Insert SVG', icon: '🖼', disabled: true },
                { label: 'Insert DXF', icon: '📐', disabled: true },
                { label: 'Insert OBJ/STL', icon: '△', disabled: true },
                { label: 'Insert Canvas', icon: '🖼', disabled: true },
                { divider: true },
                { label: 'Decal', icon: '🏷', disabled: true },
              ])}
            </MenubarContent>
          </MenubarMenu>

          {/* ASSEMBLE */}
          <MenubarMenu>
            <MenubarTrigger className="text-[11px] font-medium tracking-wide px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/60 transition-colors duration-150">
              ASSEMBLE
            </MenubarTrigger>
            <MenubarContent>
              {renderMenuItems([
                { label: 'New Component', icon: '📦', disabled: true },
                { label: 'Joint', icon: '🔗', disabled: true },
                { label: 'As-built Joint', icon: '🔗', disabled: true },
                { label: 'Joint Origin', icon: '⊙', disabled: true },
                { label: 'Rigid Group', icon: '🔒', disabled: true },
                { divider: true },
                { label: 'Ground', icon: '⚓', disabled: true },
                { label: 'Unground', icon: '⚡', disabled: true },
                { label: 'Tangent Relationship', icon: '⌢', disabled: true },
              ])}
            </MenubarContent>
          </MenubarMenu>

        </Menubar>

        <div className="flex-1" />

        {/* Omnibar trigger */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOmnibarOpen(true)}
              className="flex items-center gap-2 px-3 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all duration-200 min-w-[180px] max-w-[280px] border border-border"
            >
              <Search className="w-3.5 h-3.5 opacity-50" />
              <span className="flex-1 text-left truncate">Buscar…</span>
              <kbd className="text-[9px] font-mono opacity-30 border border-border rounded px-1.5 py-0.5">⌘K</kbd>
            </button>
          </TooltipTrigger>
          <TooltipContent>Buscar acción, material, máquina…</TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {machines.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setMachinePanel(p => !p)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-primary hover:bg-accent transition-all duration-150"
                >
                  <span>{machineIcon(selectedMachine ?? machines[0])}</span>
                  <span className="max-w-[100px] truncate">
                    {machines.length > 1
                      ? `${machines.length} máquinas`
                      : `${machines[0].vendor || ''} ${machines[0].model || machines[0].fileName}`.trim()}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Gestionar máquinas</TooltipContent>
            </Tooltip>
          )}
          {machineImporting && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              Cargando…
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleExportSTL} disabled={!!exporting}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-primary hover:bg-accent transition-all disabled:opacity-30">
                <Download className="w-3.5 h-3.5" />
                STL
              </button>
            </TooltipTrigger>
            <TooltipContent>Exportar STL</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleExportBlueprint} disabled={!!exporting}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all disabled:opacity-30">
                <Ruler className="w-3.5 h-3.5" />
                Plano
              </button>
            </TooltipTrigger>
            <TooltipContent>Exportar plano técnico SVG</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setBlueprintPanel(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-blue hover:text-text-1 hover:bg-blue/15 transition-all">
                📐
                <span>Planos 2D</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Extracción de planos — secciones 2D de 37 modelos STEP</TooltipContent>
          </Tooltip>

          {/* Theme / color profile selector */}
          <div className="forge-sep" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setThemePanelOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-accent-foreground hover:bg-accent transition-all">
                🎨
              </button>
            </TooltipTrigger>
            <TooltipContent>Perfiles de Color</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Hidden file inputs for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_CAD_FORMATS}
        multiple
        className="hidden"
        onChange={handleFileInput}
      />
      <input
        ref={machineInputRef}
        type="file"
        accept=".mch"
        multiple
        className="hidden"
        onChange={handleMachineFileInput}
      />

      {/* ════════════════════════════════════════════════════
          BODY — Icon tree + Viewport + Optional sketch panel
          ════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — Collapsible Icon Tree */}
        <aside
          className="relative shrink-0 z-20"
          style={{ background: 'var(--panel-glass)', borderRight: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          onMouseEnter={() => { if (!treePinned.current) setTreeExpanded(true); }}
          onMouseLeave={() => { if (!treePinned.current) setTreeExpanded(false); }}
        >
          {/* Collapsed: 48px icons */}
          <div className={`flex flex-col items-center py-3 gap-1 w-12 ${treeExpanded ? 'hidden' : ''}`}>
            {scene.children.length === 0 ? (
              <span className="text-[20px] text-border-hi/40 mt-8">⬡</span>
            ) : (
              scene.children.map(n => (
                <button key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  title={n.label}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-[14px] transition-all ${
                    n.id === selectedId
                      ? 'bg-gold/10 text-gold shadow-[0_0_12px_rgba(201,168,76,0.1)]'
                      : 'text-text-3 hover:text-text-2 hover:bg-white/[0.03]'
                  }`}>
                  {isModule(n)
                    ? <span style={{ color: (n as SdfModule).color }}>◈</span>
                    : ICONS[(n as SdfOperation | SdfPrimitive).type]
                  }
                </button>
              ))
            )}
          </div>

          {/* Expanded: 240px overlay */}
          {treeExpanded && (
            <div className="absolute top-0 left-0 bottom-0 w-64 z-30 flex flex-col animate-slideRight" style={{ background: 'var(--panel-glass)', borderRight: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(32px) saturate(1.5)', WebkitBackdropFilter: 'blur(32px) saturate(1.5)', boxShadow: '8px 0 48px rgba(0,0,0,0.4), inset 0 0 0.5px rgba(255,255,255,0.06)' }}>
              <div className="px-4 py-3 flex flex-col gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--c-text-2)', letterSpacing: '0.06em' }}>ESCENA</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-3 font-mono">{nodeCount}</span>
                    <button
                      onClick={() => addModule(`Módulo ${scene.children.filter(isModule).length + 1}`)}
                      title="Nuevo Módulo"
                      className="px-2.5 py-1 rounded-lg text-[10px] border border-gold/20 text-gold bg-gold/5 hover:bg-gold/12 transition-all font-medium">
                      + Módulo
                    </button>
                    <button
                      onClick={() => { treePinned.current = !treePinned.current; if (!treePinned.current) setTreeExpanded(false); }}
                      title={treePinned.current ? 'Desfijar panel' : 'Fijar panel'}
                      className={`w-5 h-5 flex items-center justify-center rounded text-[11px] transition-all ${
                        treePinned.current ? 'text-gold bg-gold/10' : 'text-text-3 hover:text-text-2'
                      }`}>
                      📌
                    </button>
                  </div>
                </div>
                {/* Active module indicator */}
                {activeModuleId && (() => {
                  const mod = findNode(scene, activeModuleId);
                  if (!mod || !isModule(mod)) return null;
                  return (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-overlay border border-border-hi/50">
                      <span className="text-[11px]" style={{ color: (mod as SdfModule).color }}>◉</span>
                      <span className="text-[11px] text-text-2 flex-1 truncate" style={{ color: (mod as SdfModule).color }}>{mod.label}</span>
                      <button onClick={() => setActiveModule(null)}
                        className="text-[9px] text-text-3 hover:text-text-2 transition-all">✕</button>
                    </div>
                  );
                })()}
              </div>
              <div className="flex-1 overflow-y-auto p-1.5">
                {scene.children.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[28px] text-border-hi/30 mb-3">⬡</p>
                    <p className="text-[13px] text-text-3 font-medium">Escena vacía</p>
                    <p className="text-[11px] text-text-4 mt-2">Presiona <kbd className="font-mono bg-white/[0.03] border border-white/[0.06] rounded px-1.5 py-0.5 text-[10px]">S</kbd> para atajos rápidos</p>
                  </div>
                ) : (
                  <TreeNode node={scene} depth={0} selectedId={selectedId}
                    activeModuleId={activeModuleId}
                    onSelect={setSelectedId}
                    onActivateModule={id => setActiveModule(id || null)}
                    onRenameModule={renameModule}
                  />
                )}
              </div>
              <div className="px-4 py-2.5 flex justify-between text-[11px]" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: 'var(--c-text-3)' }}>
                <span>{stats.totalParts} piezas</span>
                <span>{stats.estimatedVolumeCm3} cm³</span>
                <span>{stats.estimatedMassKg} kg</span>
              </div>
            </div>
          )}
        </aside>

        {/* CENTER — Viewport (with drag-and-drop for import) */}
        <div className="flex-1 relative"
          onContextMenu={handleContextMenu}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <ForgeViewport
            className="absolute inset-0"
            onFps={setFps}
            sketchPlane={sketchMode?.plane ?? null}
            sketchTool={sketchMode ? sketchTool : null}
            sketchShapes={sketchShapes}
            onSketchShapeAdd={s => setSketchShapes(prev => [...prev, s])}
            onSketchDrawingChange={() => {}}
            onSketchCursorMove={(x, y) => setSketchCursor([x, y])}
            targetView={targetView}
            onViewTransitionComplete={() => setTargetView(null)}
            fittedSlices={fittedSlices}
            sketchFilterAxis={sketchFilterAxis}
            selectedSliceIndex={selectedSliceIndex}
            reconstruction={reconstruction}
          />

          {/* Drag-and-drop overlay */}
          {dragOver && (
            <div className="absolute inset-0 z-40 bg-gold/5 border-2 border-dashed border-gold/30 flex items-center justify-center backdrop-blur-sm pointer-events-none rounded-2xl m-2">
              <div className="px-10 py-8 rounded-2xl border border-gold/20 text-center" style={{ background: 'var(--panel-glass)', backdropFilter: 'blur(24px)', boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 40px var(--c-gold-glow)' }}>
                <div className="text-[40px] mb-2">📦</div>
                <p className="text-[16px] text-gold font-semibold">Soltar archivo CAD</p>
                <p className="text-[12px] text-text-2 mt-1">STEP · IGES · BREP · MCH</p>
              </div>
            </div>
          )}

          {/* Importing indicator */}
          {importing && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl bg-overlay/95 border border-gold/30 text-[12px] text-gold flex items-center gap-3 backdrop-blur-md shadow-lg z-30">
              <div className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              Importando modelo CAD — Cargando WASM…
            </div>
          )}

          {/* Import error toast */}
          {importError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl bg-overlay/95 border border-red/30 text-[12px] text-red flex items-center gap-3 backdrop-blur-md shadow-lg z-30 animate-scaleIn">
              <span>⚠</span>
              <span>{importError}</span>
              <button onClick={clearImportError}
                className="ml-2 px-2 py-0.5 rounded text-[11px] bg-red/10 hover:bg-red/20 transition-all">
                Cerrar
              </button>
            </div>
          )}

          {/* Import success banner (shows imported model stats) */}
          {importedModels.length > 0 && !importing && (
            <div className="absolute top-4 right-4 z-20 space-y-2">
              {importedModels.map((model, i) => (
                <div key={i} className="space-y-1">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-overlay/90 border border-gold/25 text-[11px] text-gold backdrop-blur-sm shadow-lg animate-scaleIn">
                  <span>📦</span>
                  <span className="text-text-1 font-medium truncate max-w-[180px]">{model.threeGroup.name}</span>
                  <span className="text-text-3">·</span>
                  <span>{model.stats.meshCount} meshes</span>
                  <span className="text-text-3">·</span>
                  <span>{(model.stats.triangleCount / 1000).toFixed(1)}K △</span>
                  <button
                    onClick={() => reverseEngineerImported(i)}
                    disabled={reverseEngineering}
                    className="ml-1 px-1.5 py-0.5 rounded text-[10px] text-gold hover:text-text-1 hover:bg-gold/20 transition-all disabled:opacity-40"
                    title="Descomponer en primitivas SDF (Ingeniería Inversa)">
                    {reverseEngineering ? '⏳' : '🔬'}
                  </button>
                  <button
                    onClick={() => scanModel(i)}
                    disabled={sketchFitting}
                    className="ml-1 px-2.5 py-1 rounded text-[10px] font-bold text-green hover:text-text-1 bg-green/10 hover:bg-green/25 border border-green/25 transition-all disabled:opacity-40"
                    title="Escanear: barrido continuo GPU + fitting → error mínimo">
                    {gpuFitting ? '⏳ Escaneando...' : '⚒️ Escanear'}
                  </button>
                  <button
                    onClick={() => setBlueprintPanel(true)}
                    className="ml-1 px-2.5 py-1 rounded text-[10px] font-bold text-blue hover:text-text-1 bg-blue/10 hover:bg-blue/25 border border-blue/25 transition-all"
                    title="Ver planos extraídos — secciones 2D con cotas">
                    📐 Planos
                  </button>
                  <button
                    onClick={reconstructModel}
                    disabled={fittedSlices.length === 0 || reconstructing}
                    className="ml-1 px-2.5 py-1 rounded text-[10px] font-bold text-orange hover:text-text-1 bg-orange/10 hover:bg-orange/25 border border-orange/25 transition-all disabled:opacity-40"
                    title="Reconstruir pieza 3D desde sketches ajustados">
                    {reconstructing ? '⏳ Reconstruyendo...' : '🏗️ 3D'}
                  </button>
                  <button onClick={() => removeImportedModel(i)}
                    className="ml-1 px-1.5 py-0.5 rounded text-[10px] text-text-3 hover:text-red hover:bg-red/10 transition-all"
                    title="Eliminar modelo importado">
                    ✕
                  </button>
                  <button onClick={() => setMaterialPanel(materialPanel === i ? null : i)}
                    className={`ml-1 px-1.5 py-0.5 rounded text-[10px] transition-all ${materialPanel === i ? 'text-gold bg-gold/15' : 'text-text-3 hover:text-gold hover:bg-gold/10'}`}
                    title="Cambiar apariencia / material">
                    🎨
                  </button>
                </div>
                {/* Material editor row */}
                {materialPanel === i && (
                  <div className="flex items-center gap-3 px-3 py-2 mt-1 rounded-lg bg-overlay/80 border border-gold/15 animate-scaleIn">
                    <label className="flex items-center gap-1.5 text-[9px] text-text-2">
                      Color
                      <input type="color" defaultValue="#808c99"
                        onChange={e => setModelMaterial(i, { color: e.target.value })}
                        className="w-6 h-5 rounded border border-gold/20 bg-transparent cursor-pointer" />
                    </label>
                    <label className="flex items-center gap-1 text-[9px] text-text-2">
                      Metal
                      <input type="range" min="0" max="100" defaultValue="20"
                        onChange={e => setModelMaterial(i, { metalness: +e.target.value / 100 })}
                        className="w-16 h-1 accent-gold" />
                    </label>
                    <label className="flex items-center gap-1 text-[9px] text-text-2">
                      Rugosidad
                      <input type="range" min="0" max="100" defaultValue="50"
                        onChange={e => setModelMaterial(i, { roughness: +e.target.value / 100 })}
                        className="w-16 h-1 accent-gold" />
                    </label>
                    {/* Quick material presets */}
                    <div className="flex gap-1 ml-auto">
                      {[
                        { label: 'Acero', color: '#8a9199', metal: 0.8, rough: 0.3 },
                        { label: 'Aluminio', color: '#c0c6cc', metal: 0.9, rough: 0.15 },
                        { label: 'Latón', color: '#c9a84c', metal: 0.7, rough: 0.25 },
                        { label: 'Plástico', color: '#3a8fd4', metal: 0.0, rough: 0.6 },
                        { label: 'Mate', color: '#555555', metal: 0.0, rough: 0.95 },
                      ].map(preset => (
                        <button key={preset.label}
                          onClick={() => setModelMaterial(i, { color: preset.color, metalness: preset.metal, roughness: preset.rough })}
                          className="px-1.5 py-0.5 rounded text-[8px] border border-gold/15 hover:border-gold/40 transition-all"
                          style={{ color: preset.color }}
                          title={preset.label}>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              ))}
            </div>
          )}

          {/* Reverse Engineering Results Panel */}
          {reverseEngineeringResult && (
            <div className="absolute top-4 left-4 z-20 w-72 max-h-[70vh] overflow-y-auto rounded-xl bg-overlay/95 border border-gold/30 backdrop-blur-md shadow-2xl animate-scaleIn">
              <div className="sticky top-0 bg-overlay border-b border-gold/20 px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔬</span>
                  <span className="text-[12px] font-bold text-gold tracking-wide">INGENIERÍA INVERSA</span>
                </div>
                <button onClick={clearReverseEngineering}
                  className="text-[10px] text-text-3 hover:text-red px-1.5 py-0.5 rounded hover:bg-red/10 transition-all">
                  ✕
                </button>
              </div>
              {/* Stats */}
              <div className="px-3 py-2 border-b border-gold/10 text-[10px] grid grid-cols-2 gap-x-3 gap-y-1">
                <span className="text-text-2">Componentes:</span>
                <span className="text-text-1 font-medium">{reverseEngineeringResult.stats.totalComponents}</span>
                <span className="text-text-2">Features detectados:</span>
                <span className="text-text-1 font-medium text-green">{reverseEngineeringResult.stats.detectedFeatures}</span>
                <span className="text-text-2">Desconocidos:</span>
                <span className="text-text-1 font-medium">{reverseEngineeringResult.stats.unknownFeatures}</span>
                <span className="text-text-2">Confianza prom.:</span>
                <span className="text-text-1 font-medium">{(reverseEngineeringResult.stats.averageConfidence * 100).toFixed(0)}%</span>
                <span className="text-text-2">Tiempo:</span>
                <span className="text-text-1 font-medium">{reverseEngineeringResult.stats.processingTimeMs.toFixed(0)}ms</span>
                <span className="text-text-2">Variables creadas:</span>
                <span className="text-text-1 font-medium">{reverseEngineeringResult.variables.length}</span>
              </div>
              {/* Detected Primitives List */}
              <div className="px-2 py-1.5 space-y-1">
                {reverseEngineeringResult.detectedPrimitives.map((prim, i) => {
                  const typeIcons: Record<string, string> = {
                    box: '◻', cylinder: '⬡', sphere: '●', cone: '△', torus: '◎', unknown: '?',
                  };
                  const typeColors: Record<string, string> = {
                    box: '#4ade80', cylinder: '#60a5fa', sphere: '#f472b6',
                    cone: '#facc15', torus: '#c084fc', unknown: '#6b7280',
                  };
                  return (
                    <div key={i}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gold/5 text-[10px] transition-colors group">
                      <span style={{ color: typeColors[prim.type] ?? '#6b7280' }}
                        className="text-[13px] w-4 text-center flex-shrink-0">
                        {typeIcons[prim.type] ?? '?'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-text-1 font-medium truncate">{prim.label}</div>
                        <div className="text-text-3 text-[9px]">
                          {prim.type === 'box' && `${prim.params.sizeX?.toFixed(2)} × ${prim.params.sizeY?.toFixed(2)} × ${prim.params.sizeZ?.toFixed(2)}`}
                          {prim.type === 'cylinder' && `r=${prim.params.radius?.toFixed(2)} h=${prim.params.height?.toFixed(2)}`}
                          {prim.type === 'sphere' && `r=${prim.params.radius?.toFixed(2)}`}
                          {prim.type === 'cone' && `r=${prim.params.radius?.toFixed(2)} h=${prim.params.height?.toFixed(2)}`}
                          {prim.type === 'torus' && `R=${prim.params.majorRadius?.toFixed(2)} r=${prim.params.minorRadius?.toFixed(2)}`}
                          {prim.type === 'unknown' && `≈ ${prim.params.sizeX?.toFixed(2)} × ${prim.params.sizeY?.toFixed(2)} × ${prim.params.sizeZ?.toFixed(2)}`}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[9px]" style={{ color: prim.confidence > 0.7 ? '#4ade80' : prim.confidence > 0.4 ? '#facc15' : '#f87171' }}>
                          {(prim.confidence * 100).toFixed(0)}%
                        </div>
                        <div className="text-text-3 text-[8px]">{prim.sourceTriCount}△</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CT-Scan Results Panel */}
          {ctScanResult && (
            <div className="absolute top-4 right-4 z-20 w-80 max-h-[70vh] overflow-y-auto rounded-xl bg-overlay/95 border border-[#60a5fa]/30 backdrop-blur-md shadow-2xl animate-scaleIn">
              <div className="sticky top-0 bg-overlay border-b border-[#60a5fa]/20 px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🩻</span>
                  <span className="text-[12px] font-bold text-blue tracking-wide">CT-SCAN DECOMPOSICIÓN</span>
                </div>
                <button onClick={clearCtScan}
                  className="text-[10px] text-text-3 hover:text-red px-1.5 py-0.5 rounded hover:bg-red/10 transition-all">
                  ✕
                </button>
              </div>
              {/* Stats */}
              <div className="px-3 py-2 border-b border-[#60a5fa]/10 text-[10px] grid grid-cols-2 gap-x-3 gap-y-1">
                <span className="text-text-2">Features totales:</span>
                <span className="text-text-1 font-medium text-green">{ctScanResult.stats.totalFeatures}</span>
                <span className="text-text-2">Extrusiones:</span>
                <span className="text-text-1 font-medium">{ctScanResult.stats.extrusions}</span>
                <span className="text-text-2">Revoluciones:</span>
                <span className="text-text-1 font-medium">{ctScanResult.stats.revolutions}</span>
                <span className="text-text-2">Agujeros:</span>
                <span className="text-text-1 font-medium">{ctScanResult.stats.holes}</span>
                <span className="text-text-2">Tiempo:</span>
                <span className="text-text-1 font-medium">{ctScanResult.stats.processingTimeMs.toFixed(0)}ms</span>
              </div>
              {/* Axis breakdown */}
              <div className="px-3 py-1.5 border-b border-[#60a5fa]/10 text-[10px]">
                <div className="text-text-2 mb-1">Bandas topológicas por eje:</div>
                {(['X', 'Y', 'Z'] as const).map(axis => {
                  const scan = ctScanResult.scans[axis];
                  return (
                    <div key={axis} className="flex items-center gap-2 text-[9px] py-0.5">
                      <span className="text-blue font-bold w-3">{axis}</span>
                      <span className="text-text-1">{scan.bands.length} bandas</span>
                      <span className="text-text-3">·</span>
                      <span className="text-text-3">{scan.slices.filter(s => s.totalArea > 0).length}/{scan.slices.length} cortes con material</span>
                    </div>
                  );
                })}
              </div>
              {/* Features List */}
              <div className="px-2 py-1.5 space-y-1">
                {ctScanResult.features.map((feat, i) => {
                  const typeIcons: Record<string, string> = {
                    extrusion: '▬', revolution: '◎', hole: '◯', pocket: '▢', boss: '▣', unknown: '?',
                  };
                  const typeColors: Record<string, string> = {
                    extrusion: '#4ade80', revolution: '#c084fc', hole: '#f87171',
                    pocket: '#facc15', boss: '#60a5fa', unknown: '#6b7280',
                  };
                  return (
                    <div key={i}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blue/5 text-[10px] transition-colors">
                      <span style={{ color: typeColors[feat.type] ?? '#6b7280' }}
                        className="text-[13px] w-4 text-center flex-shrink-0">
                        {typeIcons[feat.type] ?? '?'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-text-1 font-medium truncate">{feat.label}</div>
                        <div className="text-text-3 text-[9px]">
                          {feat.axis}-axis · h={feat.height.toFixed(2)}
                          {feat.radius ? ` · r=${feat.radius.toFixed(2)}` : ''}
                          {feat.holes.length > 0 ? ` · ${feat.holes.length} agujero(s)` : ''}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[9px]" style={{ color: feat.confidence > 0.7 ? '#4ade80' : feat.confidence > 0.4 ? '#facc15' : '#f87171' }}>
                          {(feat.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sketch Fitting Results Panel — Precision Dashboard */}
          {fittedSlices.length > 0 && (() => {
            const allContours = fittedSlices.flatMap(s => s.contours);
            const totalEntities = allContours.reduce((s, c) => s + c.entities.length, 0);
            const totalLines = allContours.reduce((s, c) => s + c.entities.filter(e => e.type === 'line').length, 0);
            const totalArcs = allContours.reduce((s, c) => s + c.entities.filter(e => e.type === 'arc' && !e.isFullCircle).length, 0);
            const totalCircles = allContours.reduce((s, c) => s + c.entities.filter(e => e.type === 'arc' && e.isFullCircle).length, 0);
            const totalConstraints = allContours.reduce((s, c) => s + c.constraints.length, 0);
            const maxErr = allContours.reduce((m, c) => Math.max(m, c.error?.maxError ?? 0), 0);
            const avgErr = allContours.length > 0
              ? allContours.reduce((s, c) => s + (c.error?.avgError ?? 0), 0) / allContours.length
              : 0;
            const avgCov = allContours.length > 0
              ? allContours.reduce((s, c) => s + (c.error?.coverage ?? 0), 0) / allContours.length
              : 0;
            const errColor = maxErr < 0.01 ? '#4ade80' : maxErr < 0.1 ? '#facc15' : '#f87171';
            const errLabel = maxErr < 0.01 ? 'PRECISO' : maxErr < 0.1 ? 'ACEPTABLE' : 'IMPRECISO';
            // Constraint type counts
            const cTypes: Record<string, number> = {};
            for (const c of allContours) for (const con of c.constraints) cTypes[con.type] = (cTypes[con.type] ?? 0) + 1;
            const cIcons: Record<string, string> = {
              tangent: '⟛', perpendicular: '⊥', collinear: '∥', horizontal: '─',
              vertical: '│', concentric: '◎', equal_radius: '⊜',
            };

            return (
            <div className="absolute bottom-4 right-4 z-20 w-80 max-h-[50vh] overflow-y-auto rounded-xl bg-surface/95 border border-gold/25 backdrop-blur-md shadow-2xl animate-scaleIn"
              style={{ boxShadow: '0 0 40px rgba(0,0,0,0.6), 0 0 12px var(--c-gold-glow)' }}>
              {/* Header */}
              <div className="sticky top-0 bg-surface border-b border-gold/15 px-3 py-2 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{'⚒️'}</span>
                  <span className="text-[11px] font-bold text-gold tracking-wider">
                    FORGE SCAN
                  </span>
                  {gpuFittedPlanes.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider"
                      style={{ background: 'var(--c-green)', color: 'white', opacity: 0.9 }}>
                      {gpuFittedPlanes.length} PLANOS
                    </span>
                  )}
                  <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider"
                    style={{ background: `${errColor}15`, color: errColor, border: `1px solid ${errColor}30` }}>
                    {errLabel}
                  </span>
                </div>
                <button onClick={clearFittedSlices}
                  className="text-[10px] text-text-3 hover:text-red px-1.5 py-0.5 rounded hover:bg-red/10 transition-all">✕</button>
              </div>

              {/* Precision Metrics */}
              <div className="px-3 py-2 border-b border-white/[0.04]">
                <div className="text-[8px] text-text-3 uppercase tracking-widest mb-1.5 font-semibold">Precisión</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-[13px] font-bold font-mono" style={{ color: errColor }}>{maxErr < 0.001 ? maxErr.toExponential(1) : maxErr.toFixed(4)}</div>
                    <div className="text-[7px] text-text-3 uppercase tracking-wider mt-0.5">Max Error</div>
                  </div>
                  <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-[13px] font-bold font-mono text-blue">{avgErr < 0.001 ? avgErr.toExponential(1) : avgErr.toFixed(4)}</div>
                    <div className="text-[7px] text-text-3 uppercase tracking-wider mt-0.5">Avg Error</div>
                  </div>
                  <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-[13px] font-bold font-mono text-gold">{(avgCov * 100).toFixed(1)}%</div>
                    <div className="text-[7px] text-text-3 uppercase tracking-wider mt-0.5">Cobertura</div>
                  </div>
                </div>
              </div>

              {/* Entity Stats */}
              <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-0.5 inline-block rounded-full bg-[#f0ece4]" />
                  <span className="text-[9px] text-text-2">{totalLines} Líneas</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 inline-block rounded-full border border-[#c084fc]" style={{ borderWidth: 1.5 }} />
                  <span className="text-[9px] text-text-2">{totalArcs} Arcos</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 inline-block rounded-full border border-gold" style={{ borderWidth: 1.5 }} />
                  <span className="text-[9px] text-text-2">{totalCircles} Círculos</span>
                </div>
                <span className="text-[9px] text-text-3 ml-auto font-mono">{totalEntities}e</span>
              </div>

              {/* Constraint Badges */}
              {totalConstraints > 0 && (
                <div className="px-3 py-1.5 border-b border-white/[0.04]">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[8px] text-text-3 uppercase tracking-widest font-semibold mr-1">Constraints</span>
                    {Object.entries(cTypes).map(([type, count]) => (
                      <span key={type} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono"
                        style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)', border: '1px solid var(--panel-glass-border)' }}>
                        <span className="text-[9px]">{cIcons[type] ?? '?'}</span>
                        <span>{count}</span>
                      </span>
                    ))}
                    <span className="text-[8px] text-text-3 ml-auto">{totalConstraints} total</span>
                  </div>
                </div>
              )}

              {/* View mode toggle: Slices vs Features */}
              {vizFeatures && vizFeatures.length > 0 && (
                <div className="px-3 py-1.5 border-b border-white/[0.04] flex items-center gap-1">
                  <button onClick={() => setScanViewMode('slices')}
                    className={`px-2.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                      scanViewMode === 'slices' ? 'bg-gold/15 text-gold' : 'text-text-3 hover:text-text-2'
                    }`}>Slices</button>
                  <button onClick={() => setScanViewMode('features')}
                    className={`px-2.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                      scanViewMode === 'features' ? 'bg-gold/15 text-gold' : 'text-text-3 hover:text-text-2'
                    }`}>
                    Features
                    <span className="ml-1 text-[8px] font-mono opacity-70">{vizFeatures.length}</span>
                  </button>
                </div>
              )}

              {/* ── Features view ── */}
              {scanViewMode === 'features' && vizFeatures && vizFeatures.length > 0 ? (
                <div className="px-1.5 py-1 space-y-px max-h-[30vh] overflow-y-auto">
                  {vizFeatures.map((feat, i) => {
                    const isSelected = selectedFeatureIdx === i;
                    const fIcons: Record<string, string> = {
                      hole: '⊙', slot: '▬', rect_pocket: '▭', fillet_pocket: '▭',
                      polygon_pocket: '⬡', freeform_pocket: '◇', circle: '○', keyhole: '⊚',
                      pattern_circular: '⊙×', pattern_linear: '▤', revolution: '◉',
                    };
                    const fColors: Record<string, string> = {
                      hole: '#f87171', slot: '#facc15', rect_pocket: '#4ade80', fillet_pocket: '#4ade80',
                      polygon_pocket: '#a78bfa', freeform_pocket: '#38bdf8', circle: '#60a5fa',
                      keyhole: '#fb923c', pattern_circular: '#c084fc', pattern_linear: '#c084fc',
                    };
                    const icon = fIcons[feat.type] ?? '◆';
                    const color = fColors[feat.type] ?? '#c9a84c';
                    const isPattern = feat.type.startsWith('pattern_');
                    // Build param string
                    const parts: string[] = [];
                    if (feat.params) {
                      if (feat.params.diameter) parts.push(`ø${feat.params.diameter.toFixed(1)}`);
                      if (feat.params.width && feat.params.height) parts.push(`${feat.params.width.toFixed(1)}×${feat.params.height.toFixed(1)}`);
                      if (feat.params.depth && feat.params.depth > 0) parts.push(`↧${feat.params.depth.toFixed(1)}`);
                    }
                    if (!parts.some(p => p.startsWith('↧')) && feat.depth && feat.depth > 0) {
                      parts.push(`↧${feat.depth.toFixed(1)}`);
                    }

                    return (
                      <div key={i}
                        onClick={() => handleFeatureSelect(isSelected ? null : i)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] cursor-pointer transition-all ${
                          isSelected
                            ? 'ring-1 ring-gold/40 shadow-[0_0_8px_rgba(201,168,76,0.15)]'
                            : 'hover:bg-white/[0.03]'
                        }`}
                        style={isSelected ? { background: `${color}10` } : undefined}>
                        <span className="font-mono w-4 text-right text-[8px]" style={{ color: 'var(--c-text-3)' }}>{i + 1}</span>
                        <span style={{ color, fontSize: 11 }}>{icon}</span>
                        <span className="text-text-1 flex-1 truncate">{feat.label}</span>
                        {parts.length > 0 && (
                          <span className="font-mono text-[8px] shrink-0" style={{ color: 'var(--c-text-3)' }}>
                            {parts.join(' ')}
                          </span>
                        )}
                        {isPattern && feat.count && (
                          <span className="text-[7px] font-bold px-1 rounded"
                            style={{ background: `${color}20`, color }}>×{feat.count}</span>
                        )}
                        {feat.confidence != null && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: feat.confidence > 0.7 ? '#4ade80' : feat.confidence > 0.4 ? '#facc15' : '#f87171' }}
                            title={`${(feat.confidence * 100).toFixed(0)}%`} />
                        )}
                        {isSelected && (
                          <span className="text-[8px] font-bold tracking-wider animate-pulse" style={{ color }}>◉</span>
                        )}
                      </div>
                    );
                  })}
                  {selectedFeatureIdx != null && (
                    <button
                      onClick={() => handleFeatureSelect(null)}
                      className="w-full mt-1 px-2 py-1 rounded-lg text-[9px] text-gold/70 hover:text-gold hover:bg-gold/10 transition-all text-center">
                      ← Ver todos los features
                    </button>
                  )}
                </div>
              ) : (
              <>
              {/* Axis filter */}
              <div className="px-3 py-1.5 border-b border-white/[0.04] flex items-center gap-1">
                <span className="text-[8px] text-text-3 uppercase tracking-widest font-semibold mr-1">Eje</span>
                {(['X', 'Y', 'Z'] as const).map(ax => {
                  const count = fittedSlices.filter(s => s.axis === ax).length;
                  const axCol: Record<string, string> = { X: 'var(--c-red)', Y: 'var(--c-green)', Z: 'var(--c-blue)' };
                  return (
                    <button key={ax}
                      onClick={() => setSketchFilterAxis(prev => prev === ax ? null : ax)}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                        sketchFilterAxis === ax
                          ? 'ring-1'
                          : 'opacity-50 hover:opacity-80'
                      }`}
                      style={sketchFilterAxis === ax ? { background: `${axCol[ax]}15`, color: axCol[ax], boxShadow: `inset 0 0 0 1px ${axCol[ax]}40` } : { color: axCol[ax] }}
                    >
                      {ax}<span className="font-normal ml-0.5 text-[8px]">{count}</span>
                    </button>
                  );
                })}
                <button onClick={() => setSketchFilterAxis(null)}
                  className={`px-2 py-0.5 rounded text-[9px] transition-all ${
                    sketchFilterAxis === null ? 'bg-gold/15 text-gold font-bold' : 'text-text-3 hover:text-text-2'
                  }`}>ALL</button>
              </div>

              {/* Per-slice rows — clickable for focus */}
              <div className="px-1.5 py-1 space-y-px max-h-[22vh] overflow-y-auto">
                {(sketchFilterAxis ? fittedSlices.filter(s => s.axis === sketchFilterAxis) : fittedSlices).map((slice, i) => {
                  // Find the real index in the unfiltered fittedSlices array
                  const realIdx = sketchFilterAxis ? fittedSlices.indexOf(slice) : i;
                  const isSelected = selectedSliceIndex === realIdx;
                  const entities = slice.contours.reduce((s, c) => s + c.entities.length, 0);
                  const lines = slice.contours.reduce((s, c) => s + c.entities.filter(e => e.type === 'line').length, 0);
                  const arcs = slice.contours.reduce((s, c) => s + c.entities.filter(e => e.type === 'arc').length, 0);
                  const sliceMaxErr = slice.contours.reduce((m, c) => Math.max(m, c.error?.maxError ?? 0), 0);
                  const sliceErrCol = sliceMaxErr < 0.01 ? '#4ade80' : sliceMaxErr < 0.1 ? '#facc15' : '#f87171';
                  const axColors: Record<string, string> = { X: '#f87171', Y: '#4ade80', Z: '#60a5fa' };
                  return (
                    <div key={i}
                      onClick={() => setSelectedSliceIndex(isSelected ? null : realIdx)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gold/15 ring-1 ring-gold/40 shadow-[0_0_8px_rgba(201,168,76,0.15)]'
                          : 'hover:bg-white/[0.03]'
                      }`}>
                      <span style={{ color: axColors[slice.axis] }} className="font-bold w-3 text-[10px]">{slice.axis}</span>
                      <span className="text-[#6b6050] font-mono w-10 text-right">{slice.value.toFixed(2)}</span>
                      <span className="text-text-1">{slice.contours.length}c</span>
                      <span className="text-text-3 flex-1">{entities}e <span className="text-[8px]">({lines}L {arcs}A)</span></span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: sliceErrCol }} title={`maxErr: ${sliceMaxErr.toFixed(6)}`} />
                      {isSelected && (
                        <span className="text-[8px] text-gold font-bold tracking-wider animate-pulse">◉</span>
                      )}
                    </div>
                  );
                })}
                {selectedSliceIndex != null && (
                  <button
                    onClick={() => setSelectedSliceIndex(null)}
                    className="w-full mt-1 px-2 py-1 rounded-lg text-[9px] text-gold/70 hover:text-gold hover:bg-gold/10 transition-all text-center">
                    ← Ver todos los sketches
                  </button>
                )}
              </div>
              </>
              )}
            </div>
            );
          })()}

          {/* 3D Reconstruction Info Panel */}
          {reconstruction && (
            <div className="absolute bottom-4 left-4 z-20 w-64 rounded-xl bg-surface/95 border border-orange/25 backdrop-blur-md shadow-2xl animate-scaleIn"
              style={{ boxShadow: '0 0 30px rgba(0,0,0,0.5), 0 0 8px rgba(251,146,60,0.15)' }}>
              <div className="px-3 py-2 border-b border-orange/15 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏗️</span>
                  <span className="text-[11px] font-bold text-orange tracking-wider">RECONSTRUCCIÓN 3D</span>
                </div>
                <button onClick={clearReconstruction}
                  className="text-[10px] text-text-3 hover:text-red px-1.5 py-0.5 rounded hover:bg-red/10 transition-all">✕</button>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-text-3">Bandas</span>
                  <span className="text-text-1 font-mono">{reconstruction.bands.length}</span>
                </div>
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-text-3">Tiempo</span>
                  <span className="text-text-1 font-mono">{reconstruction.timeMs.toFixed(0)} ms</span>
                </div>
                {reconstruction.warnings.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    <div className="text-[8px] text-orange uppercase tracking-widest font-semibold">Warnings</div>
                    {reconstruction.warnings.map((w, i) => (
                      <div key={i} className="text-[8px] text-text-3 leading-tight pl-2 border-l border-orange/20">{w}</div>
                    ))}
                  </div>
                )}
                {reconstruction.bands.map((band, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[8px] text-text-2">
                    <span className="font-bold" style={{ color: Math.abs(band.normal[0]) > 0.9 ? '#f87171' : Math.abs(band.normal[1]) > 0.9 ? '#4ade80' : '#60a5fa' }}>
                      [{band.normal.map(d => d.toFixed(2)).join(', ')}]
                    </span>
                    <span>{band.contourCount} slices</span>
                    <span className="text-text-3">·</span>
                    <span>depth {band.depthRange[0].toFixed(2)}–{band.depthRange[1].toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sketch Fitting indicator */}
          {sketchFitting && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl bg-overlay/95 border border-gold/30 text-[12px] text-gold flex items-center gap-3 backdrop-blur-md shadow-lg z-30">
              <Loader2 className="w-4 h-4 animate-spin" />
              Fitting sketches...
            </div>
          )}

          {/* Face-picking overlay */}
          {facePicking && (
            <div className="absolute inset-0 z-20 cursor-crosshair" onPointerDown={handleFacePick}>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl bg-overlay/95 border border-gold/30 text-[12px] text-gold flex items-center gap-2.5 backdrop-blur-md shadow-lg">
                <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                Clic en una cara para ubicar el Sketch
                <button onClick={e => { e.stopPropagation(); setFacePicking(false); }}
                  className="ml-2 px-2.5 py-1 rounded-md text-[11px] text-text-3 hover:text-text-1 bg-border-hi/50 hover:bg-border-hi transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Meshing indicator */}
          {meshing && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl flex items-center gap-2.5 z-10" style={{ background: 'var(--panel-glass)', border: '1px solid var(--panel-glass-border)', backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 12px var(--c-gold-glow)' }}>
              <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <span className="text-[12px] text-gold font-medium">Generando malla — {meshQuality}</span>
            </div>
          )}

          {/* Sketch mode badge */}
          {sketchMode && (
            <div className="absolute top-4 right-4 z-10">
              <div className="px-4 py-2 rounded-xl text-[12px] font-medium border flex items-center gap-2"
                style={{
                  background: `${PLANE_COLORS[sketchMode.plane]}08`,
                  color: PLANE_COLORS[sketchMode.plane],
                  borderColor: `${PLANE_COLORS[sketchMode.plane]}20`,
                  backdropFilter: 'blur(16px)',
                  boxShadow: `0 0 20px ${PLANE_COLORS[sketchMode.plane]}08`,
                }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PLANE_COLORS[sketchMode.plane] }} />
                Sketch — {sketchMode.plane}
              </div>
            </div>
          )}

          {/* ═══ FLOATING SKETCH CONTEXT BAR ═══ */}
          {sketchMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-lg animate-scaleIn"
              style={{ background: 'var(--panel-glass)', border: '1px solid var(--panel-glass-border)', backdropFilter: 'blur(24px)' }}>
              {/* Tools */}
              <div className="flex items-center gap-1">
                <button onClick={() => setSketchTool('rect')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    sketchTool === 'rect' ? 'bg-gold/15 text-gold ring-1 ring-gold/20' : 'text-text-2 hover:text-text-1 hover:bg-white/[0.04]'
                  }`}>
                  ■ Rect
                </button>
                <button onClick={() => setSketchTool('circle')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    sketchTool === 'circle' ? 'bg-gold/15 text-gold ring-1 ring-gold/20' : 'text-text-2 hover:text-text-1 hover:bg-white/[0.04]'
                  }`}>
                  ● Círculo
                </button>
              </div>

              <div className="w-px h-5 bg-white/[0.06]" />

              {/* Shape count */}
              <span className="text-[10px] text-text-3 font-mono">{sketchShapes.length} perfil{sketchShapes.length !== 1 ? 'es' : ''}</span>

              <div className="w-px h-5 bg-white/[0.06]" />

              {/* Extrude distance */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-text-3">Ext:</span>
                <input type="number" min={0.1} max={10} step={0.05} value={extrudeDistance}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setExtrudeDistance(v); }}
                  className="w-14 rounded-md px-2 py-0.5 text-right font-mono text-[11px] text-text-1 outline-none
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />
                <span className="text-[10px] text-text-3">mm</span>
              </div>

              <div className="w-px h-5 bg-white/[0.06]" />

              {/* Actions */}
              <button onClick={() => { setSketchMode(null); setSketchShapes([]); }}
                className="px-2.5 py-1 rounded-md text-[11px] text-text-2 hover:text-text-1 hover:bg-white/[0.04] transition-all">
                Cancelar
              </button>
              <button onClick={handleSketchFinish}
                disabled={sketchShapes.length === 0}
                className="px-3 py-1 rounded-md text-[11px] font-medium transition-all disabled:opacity-25"
                style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)', border: '1px solid var(--panel-glass-border)' }}>
                ▤ Extruir
              </button>

              {/* Coords */}
              <div className="text-[9px] font-mono text-text-3 pl-2 border-l border-white/[0.06] min-w-[70px] text-right">
                {sketchCursor[0].toFixed(2)}, {sketchCursor[1].toFixed(2)}
              </div>
            </div>
          )}

          {/* Floating Properties Panel (near tree, not a sidebar) */}
          {selectedNode && !sketchMode && !isModule(selectedNode) && (
            <FloatingProperties
              node={selectedNode}
              variables={variables}
              onClose={() => setSelectedId(null)}
            />
          )}

          {/* ═══ FLOATING SECTION CONTROL BAR ═══ */}
          {section.enabled && !sketchMode && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-lg animate-scaleIn"
              style={{ background: 'var(--panel-glass)', border: '1px solid rgba(248,113,113,0.12)', backdropFilter: 'blur(24px)' }}>
              <span className="text-[10px] font-bold text-red">✂ SECCIÓN</span>

              <div className="w-px h-5 bg-white/[0.06]" />

              {/* Axis selector */}
              <div className="flex items-center gap-0.5">
                {(['X', 'Y', 'Z'] as SectionAxis[]).map(ax => (
                  <button key={ax} onClick={() => setSectionAxis(ax)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                      section.axis === ax
                        ? ax === 'X' ? 'bg-red-500/20 text-red-400' : ax === 'Y' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                        : 'text-text-3 hover:text-text-2 hover:bg-white/[0.04]'
                    }`}>
                    {ax}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-white/[0.06]" />

              {/* Distance slider */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-text-3 font-mono">d:</span>
                <input type="range" min={-5} max={5} step={0.01} value={section.distance}
                  onChange={e => setSectionDistance(parseFloat(e.target.value))}
                  className="w-24 h-1 accent-[#f87171] rounded-full cursor-pointer" />
                <input type="number" min={-10} max={10} step={0.05} value={section.distance}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setSectionDistance(v); }}
                  className="w-12 rounded-md px-1.5 py-0.5 text-right font-mono text-[10px] text-text-1 outline-none
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />
              </div>

              <div className="w-px h-5 bg-white/[0.06]" />

              {/* Flip */}
              <button onClick={() => setSectionFlip(!section.flip)}
                className="px-2 py-0.5 rounded text-[10px] text-text-2 hover:text-text-1 hover:bg-white/[0.04] transition-all"
                title="Voltear lado del corte">
                ⇄ Flip
              </button>

              {/* Close */}
              <button onClick={() => setSectionEnabled(false)}
                className="px-2 py-0.5 rounded text-[10px] text-text-2 hover:text-text-1 hover:bg-white/[0.04] transition-all">
                ✕
              </button>
            </div>
          )}

          {/* ═══ CAMERA VIEW BUTTONS (bottom-left) ═══ */}
          {!sketchMode && (
            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1">
              {STANDARD_VIEWS.slice(0, 7).map(v => (
                <button key={v.key} onClick={() => setTargetView(v.key)}
                  title={v.label}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] text-text-3 hover:text-gold hover:bg-gold/8 transition-all"
                  style={{ background: 'var(--panel-glass)', backdropFilter: 'blur(8px)' }}>
                  {v.icon}
                </button>
              ))}
              <div className="w-px h-5 bg-white/[0.04] mx-0.5" />
              <button onClick={toggleSection}
                title={section.enabled ? 'Desactivar sección' : 'Activar sección'}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] transition-all ${
                  section.enabled
                    ? 'text-red bg-red/10 ring-1 ring-[#f87171]/20'
                    : 'text-text-3 hover:text-red hover:bg-red/8'
                }`}
                style={!section.enabled ? { background: 'var(--panel-glass)', backdropFilter: 'blur(8px)' } : undefined}>
                ✂
              </button>
            </div>
          )}

          {/* Empty scene — hint mínimo (esquina inferior) */}
          {nodeCount <= 1 && importedModels.length === 0 && !sketchMode && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-0 pointer-events-none animate-fadeIn select-none">
              <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl" style={{ background: 'var(--panel-glass)', border: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
                <kbd className="text-[10px] font-mono text-text-3 bg-white/[0.03] border border-white/[0.06] rounded-md px-1.5 py-0.5">⌘K</kbd>
                <span className="text-[11px] text-text-3">·</span>
                <span className="text-[11px] text-text-3">1–5 primitivas</span>
                <span className="text-[11px] text-text-3">·</span>
                <span className="text-[11px] text-text-3">arrastra STEP o .mch</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Sketch Panel (only when sketching — DISABLED: now using in-viewport sketch) */}
        {/* {sketchMode && (
          <SketchPanel
            plane={sketchMode.plane}
            onFinish={handleSketchFinish}
            onCancel={() => setSketchMode(null)}
          />
        )} */}
      </div>

      {/* ════════════════════════════════════════════════════
          VARIABLE BAR — 36px — Editable variable chips
          ════════════════════════════════════════════════════ */}
      <div className="h-10 border-t flex items-center px-4 gap-3 shrink-0 z-20 overflow-x-auto scrollbar-thin" style={{ background: 'var(--panel-glass)', borderColor: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <span className="text-[12px] text-text-4 font-mono font-medium shrink-0 select-none">$</span>

        {variables.map(v => (
          <VarChip
            key={v.id}
            variable={v}
            onUpdate={updateVariableExpression}
            onSelect={() => { if (v.linkedPrimId) setSelectedId(v.linkedPrimId); }}
          />
        ))}

        {variables.length === 0 && !showNewVarInput && (
          <span className="text-[11px] text-border-hi italic select-none">
            Variables se crean automáticamente al agregar geometría
          </span>
        )}

        {showNewVarInput ? (
          <div className="flex items-center gap-1.5 shrink-0 animate-fadeIn">
            <input autoFocus placeholder="nombre" value={newVarName}
              onChange={e => setNewVarName(e.target.value)}
              className="w-24 bg-surface border border-border-hi rounded-md px-2 py-1 text-[12px] font-mono text-text-1 outline-none focus:border-gold/60" />
            <span className="text-text-4">=</span>
            <input placeholder="expresión" value={newVarExpr}
              onChange={e => setNewVarExpr(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddVariable(); if (e.key === 'Escape') setShowNewVarInput(false); }}
              className="w-28 bg-surface border border-border-hi rounded-md px-2 py-1 text-[12px] font-mono text-text-1 outline-none focus:border-gold/60" />
            <button onClick={handleAddVariable}
              className="px-2 py-0.5 rounded-md text-[11px] text-gold hover:bg-gold/10 transition-all">✓</button>
            <button onClick={() => setShowNewVarInput(false)}
              className="px-1 py-0.5 rounded-md text-[11px] text-text-4 hover:text-text-2 transition-all">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowNewVarInput(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-text-4 hover:text-gold hover:bg-gold/8 transition-all shrink-0"
            title="Agregar variable personalizada">
            + Variable
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
          MANUFACTURING TIMELINE (Fusion 360-style)
          ════════════════════════════════════════════════════ */}
      {vizFeatures && vizFeatures.length > 0 && (
        <ManufacturingTimeline
          features={vizFeatures}
          selectedIdx={selectedFeatureIdx}
          onSelect={handleFeatureSelect}
        />
      )}

      {/* ════════════════════════════════════════════════════
          TIMELINE — 32px
          ════════════════════════════════════════════════════ */}
      <Timeline
        entries={timelineEntries}
        currentIndex={historyIndex}
        onSeek={i => {
          const diff = i - historyIndex;
          if (diff < 0) for (let j = 0; j < -diff; j++) undo();
          if (diff > 0) for (let j = 0; j < diff; j++) redo();
        }}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />

      {/* ════════════════════════════════════════════════════
          STATUS BAR — 24px
          ════════════════════════════════════════════════════ */}
      <footer className="h-7 border-t flex items-center justify-between px-4 shrink-0 z-30" style={{ background: 'var(--panel-glass)', borderColor: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-4 text-[11px] text-text-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.3)' }} />
            <span className="font-medium">GPU Ray March</span>
          </span>
          <span className="opacity-20">|</span>
          <span>{nodeCount} nodos</span>
          <span className="opacity-20">|</span>
          <span>{variables.length} vars</span>
          {machines.length > 0 && (
            <>
              <span className="opacity-20">|</span>
              <span className="text-gold">🏭 {machines.length} máquina{machines.length > 1 ? 's' : ''}</span>
            </>
          )}
          {importedModels.length > 0 && (
            <>
              <span className="opacity-20">|</span>
              <span className="text-text-2">📦 {importedModels.length} importado{importedModels.length > 1 ? 's' : ''}</span>
            </>
          )}
          {section.enabled && (
            <>
              <span className="opacity-20">|</span>
              <span className="text-red">✂ Sección {section.axis}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-text-3">
          <span>{stats.estimatedVolumeCm3} cm³</span>
          <span className="opacity-20">|</span>
          <span className={fps < 30 ? 'text-red font-bold' : fps < 55 ? 'text-[#d29922]' : ''}>
            {fps} FPS
          </span>
          <span className="opacity-20">|</span>
          <span className="text-text-4 font-medium">Hefestos v0.1</span>
        </div>
      </footer>

      {/* ════════════════════════════════════════════════════
          OVERLAYS
          ════════════════════════════════════════════════════ */}
      {markingMenu && (
        <MarkingMenu sections={markingMenuSections} position={markingMenu} onClose={() => setMarkingMenu(null)} />
      )}
      <Omnibar
        actions={omniActions}
        open={omnibarOpen}
        onClose={() => setOmnibarOpen(false)}
        placeholder="Buscar comandos, materiales, máquinas…"
      />

      {machinePanel && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md" onClick={() => setMachinePanel(false)}>
            <div className="w-[580px] max-h-[70vh] rounded-2xl border overflow-hidden animate-scaleIn" style={{ background: 'var(--panel-glass)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(40px) saturate(1.6)', WebkitBackdropFilter: 'blur(40px) saturate(1.6)', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1), inset 0 0.5px 0 rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div>
                <h2 className="text-[15px] font-semibold text-text-1">Biblioteca de Máquinas</h2>
                <p className="text-[11px] text-text-3 mt-0.5">{machines.length} máquina{machines.length !== 1 ? 's' : ''} cargada{machines.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleImportMachine}
                  className="px-3 py-1.5 rounded-lg text-[12px] border border-gold/30 text-gold bg-gold/8 hover:bg-gold/15 transition-all">
                  + Importar .mch
                </button>
                <button onClick={() => setMachinePanel(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-border-hi transition-all">
                  ✕
                </button>
              </div>
            </div>
            {machines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="text-[40px]">🏭</div>
                <p className="text-[13px] text-text-3">No hay máquinas cargadas</p>
                <button onClick={handleImportMachine}
                  className="px-4 py-2 rounded-lg text-[12px] border border-gold/30 text-gold bg-gold/8 hover:bg-gold/15 transition-all">
                  Importar primera máquina (.mch)
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[calc(70vh-80px)] divide-y divide-border-hi/50">
                {machines.map(m => (
                  <div key={m.id} className={`flex items-center gap-3 px-5 py-3 transition-all hover:bg-overlay cursor-pointer ${
                    selectedMachine?.id === m.id ? 'bg-gold/5 border-l-2 border-gold' : ''
                  }`} onClick={() => selectMachine(m.id)}>
                    <div className="text-[22px]">{machineIcon(m)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-text-1 truncate">{m.model || m.vendor || m.fileName}</p>
                      <p className="text-[11px] text-text-3 truncate">{machineDisplayString(m)}</p>
                    </div>
                    {(m.workEnvelope.x > 0 || m.workEnvelope.y > 0) && (
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-text-2 font-mono">{formatEnvelope(m)}</p>
                      </div>
                    )}
                    <button onClick={e => { e.stopPropagation(); removeMachine(m.id); }}
                      className="w-6 h-6 flex items-center justify-center rounded text-text-4 hover:text-red hover:bg-red/10 transition-all text-[11px]">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {shortcutOverlay && (
        <ShortcutOverlay tools={shortcutTools} position={shortcutOverlay} onClose={() => setShortcutOverlay(null)} />
      )}

      {blueprintPanel && (
        <BlueprintPanel onClose={() => setBlueprintPanel(false)} />
      )}

      <ThemePanel open={themePanelOpen} onOpenChange={setThemePanelOpen} />
    </div>
    </TooltipProvider>
  );
}
