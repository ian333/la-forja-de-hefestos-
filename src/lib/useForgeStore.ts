/**
 * ⚒️ La Forja — Zustand Store
 * ============================
 * Central state: scene graph, selection, history (undo/redo), mesh cache.
 * Drives the SDF→Worker→Three.js pipeline.
 */

import { create } from 'zustand';
import * as THREE from 'three';
import type { SdfNode, SdfPrimitive, SdfOperation, SdfModule } from './sdf-engine';
import {
  isPrimitive,
  isModule,
  isContainer,
  createDefaultScene,
  findNode,
  updateNodeInTree,
  addChildToNode,
  removeNodeFromTree,
  makeSphere,
  makeBox,
  makeCylinder,
  makeTorus,
  makeCone,
  makeCapsule,
  makeOp,
  makeModule,
} from './sdf-engine';
import {
  type GaiaVariable,
  createVariable,
  resolveVariables,
  autoCreateVariablesForPrimitive,
} from './gaia-variables';
import { type ImportedModel, importCADFile } from './step-import';
import { type MachineConfig, importMachineFile } from './machine-config';
import { type Joint, clampDrive } from './joints';
import { bakeJointTransforms, collectModules } from './joint-transforms';
import { detectCollisions, rigidPairKeys } from './collisions';
import { DEFAULT_SECTION, type SectionState, type SectionAxis } from './viewport/SectionPlane';
import { type ReverseEngineeredModel, reverseEngineerModel, reverseEngineerAssembly } from './reverse-engineer';
import { decomposeBySlicing, sliceMesh, type DecomposedFeatures, type SliceAxis } from './cross-section';
import { decompositionToScene, type ProfileToSdfResult } from './profile-to-sdf';
import { fitContour, reconstructionError, type FittedSlice, type FittedContour } from './sketch-fitting';
import type { GPUFittedPlane } from './gpu-cross-section';
import type { ReconstructionResult } from './sketch-reconstruct';
import { consolidateFeatures, toVizFeatures, type ConsolidationResult } from './feature-consolidation';

// ── Types ──

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  triCount: number;
}

export type MeshQuality = 'draft' | 'medium' | 'high';

const RESOLUTION: Record<MeshQuality, number> = {
  draft: 96,
  medium: 160,
  high: 288,
};

interface ForgeState {
  // Scene
  scene: SdfOperation;
  selectedId: string | null;

  // Módulos — agrupaciones nombradas (concepto tipo Components de Fusion 360)
  activeModuleId: string | null;

  // Variables — every dimension is a named variable
  variables: GaiaVariable[];

  // Joints — kinematic connections between modules (assembly)
  joints: Joint[];
  selectedJointId: string | null;
  /** Module ids currently interpenetrating (non-rigid pairs only). */
  collidingModuleIds: Set<string>;

  // Imported CAD models (STEP/IGES/BREP)
  importedModels: ImportedModel[];
  importing: boolean;
  importError: string | null;

  // Machine configurations (.mch files)
  machines: MachineConfig[];
  selectedMachine: MachineConfig | null;
  machineImporting: boolean;

  // Mesh (from worker)
  mesh: MeshData | null;
  meshQuality: MeshQuality;
  meshing: boolean;

  // Section view (clip plane)
  section: SectionState;

  // History
  history: SdfOperation[];
  historyIndex: number;

  // Worker
  worker: Worker | null;

  // Camera ref (for CPU ray march / face picking)
  cameraRef: THREE.PerspectiveCamera | null;
  setCameraRef: (cam: THREE.PerspectiveCamera) => void;

  // Actions
  initWorker: () => void;
  destroyWorker: () => void;
  requestMesh: (quality?: MeshQuality) => void;

  setSelectedId: (id: string | null) => void;
  updateNode: (id: string, updates: Record<string, unknown>) => void;
  updateParam: (id: string, key: string, value: number) => void;
  updatePosition: (id: string, axis: 0 | 1 | 2, value: number) => void;
  updateRotation: (id: string, axis: 0 | 1 | 2, value: number) => void;
  addPrimitive: (type: SdfPrimitive['type']) => void;
  addOperation: (type: SdfOperation['type']) => void;
  addExtrudedPrimitive: (type: SdfPrimitive['type'], position: [number,number,number], rotation: [number,number,number], params: Record<string,number>, label?: string) => void;
  deleteNode: (id: string) => void;
  setScene: (scene: SdfOperation) => void;

  // Import actions
  importFile: (file: File) => Promise<void>;
  removeImportedModel: (index: number) => void;
  clearImportError: () => void;

  // Reverse Engineering
  reverseEngineeringResult: ReverseEngineeredModel | null;
  reverseEngineering: boolean;
  reverseEngineerImported: (modelIndex: number, useAssembly?: boolean) => void;
  clearReverseEngineering: () => void;

  // CT-Scan Decomposition (v2 — cross-section based)
  ctScanResult: DecomposedFeatures | null;
  ctScanning: boolean;
  ctScanImported: (modelIndex: number) => void;
  clearCtScan: () => void;

  // Fitted sketch slices (from CT-scan → sketch fitting)
  fittedSlices: FittedSlice[];
  sketchFitting: boolean;
  fitSketches: (modelIndex: number) => Promise<void>;
  clearFittedSlices: () => void;

  // GPU CT Scanner — unified continuous sweep + GPU winding-number rendering
  gpuFittedPlanes: GPUFittedPlane[];
  gpuFitting: boolean;
  rendererRef: THREE.WebGLRenderer | null;
  setRendererRef: (renderer: THREE.WebGLRenderer) => void;
  /** Unified scan: geometry-driven planes → GPU rendering → entity fitting */
  scanModel: (modelIndex: number) => Promise<void>;
  clearGPUFittedPlanes: () => void;

  // Continuous Sweep (barrido continuo)
  sweepResult: import('./gpu-cross-section').CrossAxisResult | null;
  sweeping: boolean;
  sweepProgress: string;
  /** Continuous sweep: dense sampling on all 3 axes + cross-axis correlation */
  sweepModel: (modelIndex: number) => Promise<void>;
  clearSweep: () => void;

  // ⚒️ Consolidated features (deduplicated manufacturing operations)
  consolidation: ConsolidationResult | null;

  // 3D Reconstruction from fitted sketches
  reconstruction: ReconstructionResult | null;
  reconstructing: boolean;
  reconstructModel: () => void;
  clearReconstruction: () => void;

  /** Change material appearance of an imported model */
  setModelMaterial: (modelIndex: number, props: { color?: string; metalness?: number; roughness?: number }) => void;

  // Machine actions
  importMachine: (file: File) => Promise<void>;
  selectMachine: (id: string | null) => void;
  removeMachine: (id: string) => void;

  // Módulo actions
  addModule: (name: string, color?: string) => string;
  renameModule: (id: string, name: string) => void;
  removeModule: (id: string) => void;
  setActiveModule: (id: string | null) => void;

  // Variable actions
  addVariable: (name: string, expression: string, opts?: Partial<GaiaVariable>) => string;
  updateVariableExpression: (id: string, expression: string) => void;
  renameVariable: (id: string, newName: string) => void;
  removeVariable: (id: string) => void;
  syncVariablesToScene: () => void;

  // Joint actions
  addJoint: (joint: Joint) => void;
  removeJoint: (id: string) => void;
  renameJoint: (id: string, label: string) => void;
  /** Set the drive value of a revolute/slider joint (clamped to limits). */
  driveJoint: (id: string, value: number) => void;
  setJoints: (joints: Joint[]) => void;
  setSelectedJoint: (id: string | null) => void;

  // Section actions
  setSectionEnabled: (enabled: boolean) => void;
  setSectionAxis: (axis: SectionAxis) => void;
  setSectionDistance: (distance: number) => void;
  setSectionFlip: (flip: boolean) => void;
  toggleSection: () => void;

  undo: () => void;
  redo: () => void;
}

function pushHistory(state: ForgeState, newScene: SdfOperation) {
  const history = state.history.slice(0, state.historyIndex + 1);
  history.push(newScene);
  // Cap at 50 entries
  if (history.length > 50) history.shift();
  return { scene: newScene, history, historyIndex: history.length - 1 };
}

function countPrimType(node: SdfNode, type: string): number {
  if (isPrimitive(node)) return node.type === type ? 1 : 0;
  return (node as SdfOperation).children.reduce((s, c) => s + countPrimType(c, type), 0);
}

export const useForgeStore = create<ForgeState>((set, get) => ({
  scene: createDefaultScene(),
  selectedId: null,
  activeModuleId: null,
  variables: [],
  joints: [],
  selectedJointId: null,
  collidingModuleIds: new Set<string>(),
  importedModels: [],
  importing: false,
  importError: null,
  reverseEngineeringResult: null,
  reverseEngineering: false,
  ctScanResult: null,
  ctScanning: false,
  fittedSlices: [],
  sketchFitting: false,
  gpuFittedPlanes: [],
  gpuFitting: false,
  rendererRef: null,
  sweepResult: null,
  sweeping: false,
  sweepProgress: '',
  consolidation: null,
  reconstruction: null,
  reconstructing: false,
  machines: [],
  selectedMachine: null,
  machineImporting: false,
  mesh: null,
  meshQuality: 'medium',
  meshing: false,
  section: DEFAULT_SECTION,
  history: [createDefaultScene()],
  historyIndex: 0,
  worker: null,
  cameraRef: null,
  setCameraRef: (cam) => set({ cameraRef: cam }),

  initWorker: () => {
    const w = new Worker(new URL('./mc-worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      if (e.data.type === 'mesh') {
        set({ mesh: e.data, meshing: false });
      }
    };
    set({ worker: w });
    // Initial mesh
    setTimeout(() => get().requestMesh('medium'), 50);
  },

  destroyWorker: () => {
    const w = get().worker;
    if (w) { w.terminate(); set({ worker: null }); }
  },

  requestMesh: (quality) => {
    const state = get();
    const q = quality || state.meshQuality;
    const w = state.worker;
    if (!w) return;
    // Don't mesh if scene is empty
    if (state.scene.children.length === 0) {
      set({ mesh: null, meshing: false, meshQuality: q });
      return;
    }
    set({ meshing: true, meshQuality: q });
    // Bake joint drives into the scene before meshing so worker ignores joints.
    const baked = state.joints.length > 0
      ? bakeJointTransforms(state.scene, state.joints)
      : state.scene;
    w.postMessage({ type: 'mesh', scene: baked, resolution: RESOLUTION[q] });
  },

  setSelectedId: (id) => set({ selectedId: id }),

  updateNode: (id, updates) => {
    const state = get();
    const newScene = updateNodeInTree(state.scene, id, updates) as SdfOperation;
    set(pushHistory(state, newScene));
    // GPU ray march handles visualization; no MC needed for param edits
  },

  updateParam: (id, key, value) => {
    const state = get();
    const node = findNode(state.scene, id);
    if (!node || !isPrimitive(node)) return;
    const newScene = updateNodeInTree(state.scene, id, {
      params: { ...node.params, [key]: value },
    }) as SdfOperation;
    set(pushHistory(state, newScene));

    // Sync the linked variable expression
    const linkedVar = state.variables.find(
      v => v.linkedPrimId === id && v.linkedParamKey === key,
    );
    if (linkedVar) {
      set(s => ({
        variables: s.variables.map(v =>
          v.id === linkedVar.id ? { ...v, expression: String(value), resolvedValue: value } : v,
        ),
      }));
    }
  },

  updatePosition: (id, axis, value) => {
    const state = get();
    const node = findNode(state.scene, id);
    if (!node || !isPrimitive(node)) return;
    const pos: [number, number, number] = [...node.position];
    pos[axis] = value;
    const newScene = updateNodeInTree(state.scene, id, { position: pos }) as SdfOperation;
    set(pushHistory(state, newScene));
  },

  updateRotation: (id, axis, value) => {
    const state = get();
    const node = findNode(state.scene, id);
    if (!node || !isPrimitive(node)) return;
    const rot: [number, number, number] = [...(node.rotation || [0, 0, 0])];
    rot[axis] = value;
    const newScene = updateNodeInTree(state.scene, id, { rotation: rot }) as SdfOperation;
    set(pushHistory(state, newScene));
  },

  addPrimitive: (type) => {
    const state = get();
    const factories: Record<string, () => SdfPrimitive> = {
      sphere: () => makeSphere([0, 1, 0]),
      box: () => makeBox([0, 0.5, 0]),
      cylinder: () => makeCylinder([0, 0.5, 0]),
      torus: () => makeTorus([0, 0.5, 0]),
      cone: () => makeCone([0, 0, 0]),
      capsule: () => makeCapsule([0, 0, 0], [0, 1, 0]),
    };
    const n = factories[type]();
    let newScene: SdfOperation;

    // Unified Body/Component policy: every primitive lives inside a module.
    // Priority: selectedId container > activeModuleId > auto-create "Cuerpo N".
    const targetId = (() => {
      if (state.selectedId) {
        const sel = findNode(state.scene, state.selectedId);
        if (sel && isContainer(sel)) return state.selectedId;
      }
      if (state.activeModuleId) {
        const mod = findNode(state.scene, state.activeModuleId);
        if (mod && isContainer(mod)) return state.activeModuleId;
      }
      return null; // signal: create a fresh module
    })();

    if (targetId) {
      newScene = addChildToNode(state.scene, targetId, n) as SdfOperation;
    } else {
      // Auto-wrap: create a new module "Cuerpo N" and place the primitive inside.
      const bodyCount = state.scene.children.filter(c => c.kind === 'module').length;
      const mod = makeModule(`Cuerpo ${bodyCount + 1}`);
      mod.children = [n];
      newScene = { ...state.scene, children: [...state.scene.children, mod] } as SdfOperation;
      set({ activeModuleId: mod.id });
    }

    set({ ...pushHistory(state, newScene), selectedId: n.id });

    // Auto-create variables for this primitive's dimensions
    const count = countPrimType(state.scene, type);
    const newVars = autoCreateVariablesForPrimitive(type, n.id, n.params, count);
    if (newVars.length > 0) {
      set(s => ({ variables: [...s.variables, ...newVars] }));
    }

    get().requestMesh('medium');
  },

  addOperation: (type) => {
    const state = get();
    const n = makeOp(type, [], 0.2);
    let newScene: SdfOperation;

    // Priority: selectedId container > activeModuleId > root
    const targetId = (() => {
      if (state.selectedId) {
        const sel = findNode(state.scene, state.selectedId);
        if (sel && isContainer(sel)) return state.selectedId;
      }
      if (state.activeModuleId) {
        const mod = findNode(state.scene, state.activeModuleId);
        if (mod && isContainer(mod)) return state.activeModuleId;
      }
      return state.scene.id;
    })();

    newScene = addChildToNode(state.scene, targetId, n) as SdfOperation;

    set({ ...pushHistory(state, newScene), selectedId: n.id });
    get().requestMesh('medium');
  },

  addExtrudedPrimitive: (type, position, rotation, params, label) => {
    const state = get();
    const factories: Record<string, () => SdfPrimitive> = {
      sphere: () => makeSphere(position),
      box: () => makeBox(position),
      cylinder: () => makeCylinder(position),
      torus: () => makeTorus(position),
      cone: () => makeCone(position),
      capsule: () => makeCapsule([0,0,0], [0,1,0]),
    };
    const factory = factories[type];
    if (!factory) return;
    const prim = factory();
    prim.position = position;
    prim.rotation = rotation;
    prim.params = { ...prim.params, ...params };
    if (label) prim.label = label;

    const newScene: SdfOperation = { ...state.scene, children: [...state.scene.children, prim] };
    set({ ...pushHistory(state, newScene), selectedId: prim.id });
    get().requestMesh('medium');
  },

  deleteNode: (id) => {
    const state = get();
    if (id === state.scene.id) return;
    const r = removeNodeFromTree(state.scene, id);
    if (!r) return;
    set({
      ...pushHistory(state, r as SdfOperation),
      selectedId: null,
      // Remove variables linked to deleted primitive
      variables: state.variables.filter(v => v.linkedPrimId !== id),
    });
    get().requestMesh('medium');
  },

  setScene: (scene) => {
    const state = get();
    set(pushHistory(state, scene));
    get().requestMesh('medium');
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    const newIdx = state.historyIndex - 1;
    set({ scene: state.history[newIdx], historyIndex: newIdx });
    get().requestMesh('medium');
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const newIdx = state.historyIndex + 1;
    set({ scene: state.history[newIdx], historyIndex: newIdx });
    get().requestMesh('medium');
  },

  // ── Section View Actions ──

  setSectionEnabled: (enabled) => set(s => ({ section: { ...s.section, enabled } })),
  setSectionAxis: (axis) => set(s => ({ section: { ...s.section, axis } })),
  setSectionDistance: (distance) => set(s => ({ section: { ...s.section, distance } })),
  setSectionFlip: (flip) => set(s => ({ section: { ...s.section, flip } })),
  toggleSection: () => set(s => ({ section: { ...s.section, enabled: !s.section.enabled } })),

  // ── Import Actions ──

  importFile: async (file) => {
    set({ importing: true, importError: null });
    try {
      const model = await importCADFile(file);
      if (!model.success) {
        set({ importing: false, importError: `Error al importar ${file.name}` });
        return;
      }
      set(s => ({
        importedModels: [...s.importedModels, model],
        importing: false,
      }));
    } catch (err) {
      set({ importing: false, importError: `Error: ${err instanceof Error ? err.message : String(err)}` });
    }
  },

  removeImportedModel: (index) => {
    set(s => {
      const models = [...s.importedModels];
      // Dispose Three.js resources
      const model = models[index];
      if (model) {
        model.threeGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        });
      }
      models.splice(index, 1);
      return { importedModels: models };
    });
  },

  clearImportError: () => set({ importError: null }),

  // ── Reverse Engineering Actions ──

  reverseEngineerImported: (modelIndex, useAssembly = true) => {
    const state = get();
    const model = state.importedModels[modelIndex];
    if (!model) return;

    set({ reverseEngineering: true });

    try {
      // Use requestAnimationFrame to keep UI responsive
      const result = useAssembly && model.stats.nodeCount > 1
        ? reverseEngineerAssembly(model)
        : reverseEngineerModel(model);

      // Replace scene with reverse-engineered SDF tree
      const newScene = result.scene;

      // Merge variables
      const merged = resolveVariables([...state.variables, ...result.variables]);

      set({
        ...pushHistory(state, newScene),
        variables: merged,
        reverseEngineeringResult: result,
        reverseEngineering: false,
      });

      get().requestMesh('medium');
    } catch (err) {
      console.error('[RE] Reverse engineering failed:', err);
      set({
        reverseEngineering: false,
        importError: `Rev. Eng. falló: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  },

  clearReverseEngineering: () => set({ reverseEngineeringResult: null }),

  // ── CT-Scan Decomposition Actions ──

  ctScanImported: (modelIndex) => {
    const state = get();
    const model = state.importedModels[modelIndex];
    if (!model) return;

    set({ ctScanning: true });

    // Defer heavy work to next frame so UI can show "scanning..." state
    setTimeout(() => {
    try {
      const isAssembly = model.meshes.length > 1;
      const modelLabel = (model.threeGroup.name || 'Pieza').replace(/\.[^.]+$/, '');

      console.group(`%c🩻 CT-SCAN ANALYSIS: ${modelLabel}`, 'color:#60a5fa;font-size:14px;font-weight:bold');
      console.log(`%cMeshes: ${model.meshes.length}  |  Triángulos: ${model.stats.triangleCount.toLocaleString()}  |  Vértices: ${model.stats.vertexCount.toLocaleString()}`, 'color:#8a7e6b');
      console.log(`%cEnsamble: ${isAssembly ? 'SÍ — análisis per-componente' : 'NO — pieza única'}`, 'color:#c9a84c');

      // ═══ Per-component analysis (for assemblies) ═══
      const perMeshDecomps: { name: string; decomp: ReturnType<typeof decomposeBySlicing>; triCount: number; geo: THREE.BufferGeometry }[] = [];

      if (isAssembly) {
        console.group('%c📦 Análisis per-componente', 'color:#4ade80;font-weight:bold');
        for (let mi = 0; mi < model.meshes.length; mi++) {
          const mesh = model.meshes[mi];
          const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
          if (!posAttr || posAttr.count < 9) continue;

          const idx = mesh.geometry.getIndex();
          const triCount = idx ? idx.count / 3 : posAttr.count / 3;

          mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox!;
          const size = new THREE.Vector3();
          bb.getSize(size);

          const decomp = decomposeBySlicing(mesh.geometry, 40);

          perMeshDecomps.push({ name: mesh.name || `Mesh_${mi}`, decomp, triCount, geo: mesh.geometry });

          // Per-component console report
          console.group(`%c[${mi}] ${mesh.name || 'Mesh_' + mi}  (${triCount} △)`, 'color:#f0ece4');
          console.log(`  BBox: [${bb.min.x.toFixed(2)}, ${bb.min.y.toFixed(2)}, ${bb.min.z.toFixed(2)}] → [${bb.max.x.toFixed(2)}, ${bb.max.y.toFixed(2)}, ${bb.max.z.toFixed(2)}]`);
          console.log(`  Tamaño: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`);
          console.log(`  Features: ${decomp.stats.totalFeatures} (ext:${decomp.stats.extrusions} rev:${decomp.stats.revolutions} holes:${decomp.stats.holes} unk:${decomp.stats.unknown})`);
          console.log(`  Tiempo: ${decomp.stats.processingTimeMs.toFixed(1)}ms`);

          // Band summary per axis
          for (const ax of ['X', 'Y', 'Z'] as const) {
            const scan = decomp.scans[ax];
            const filled = scan.slices.filter(s => s.totalArea > 0).length;
            console.log(`  ${ax}: ${scan.bands.length} bandas, ${filled}/${scan.slices.length} cortes con material, rango [${scan.range[0].toFixed(2)}..${scan.range[1].toFixed(2)}]`);
          }

          // Feature details
          if (decomp.features.length > 0 && decomp.features.length <= 20) {
            console.table(decomp.features.map(f => ({
              tipo: f.type,
              eje: f.axis,
              centro: `(${f.center[0].toFixed(2)}, ${f.center[1].toFixed(2)}, ${f.center[2].toFixed(2)})`,
              altura: f.height.toFixed(3),
              radio: f.radius?.toFixed(3) ?? '—',
              agujeros: f.holes.length,
              confianza: (f.confidence * 100).toFixed(0) + '%',
              label: f.label,
            })));
          }
          console.groupEnd();
        }
        console.groupEnd();
      }

      // ═══ Merged (full model) analysis ═══
      const allPositions: number[] = [];
      const allNormals: number[] = [];
      const allIndices: number[] = [];
      let vertexOffset = 0;

      for (const mesh of model.meshes) {
        const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const normAttr = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
        const idx = mesh.geometry.getIndex();
        if (!posAttr) continue;

        for (let i = 0; i < posAttr.count; i++) {
          allPositions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
          if (normAttr) allNormals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
          else allNormals.push(0, 1, 0);
        }

        if (idx) {
          for (let i = 0; i < idx.count; i++) allIndices.push(idx.getX(i) + vertexOffset);
        } else {
          for (let i = 0; i < posAttr.count; i++) allIndices.push(i + vertexOffset);
        }
        vertexOffset += posAttr.count;
      }

      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(new Float32Array(allPositions), 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(allNormals), 3));
      merged.setIndex(new THREE.BufferAttribute(new Uint32Array(allIndices), 1));
      merged.computeBoundingBox();

      const bb = merged.boundingBox!;
      const size = new THREE.Vector3();
      bb.getSize(size);

      console.group('%c🔬 Análisis global (merged)', 'color:#c084fc;font-weight:bold');
      console.log(`BBox: [${bb.min.x.toFixed(2)}, ${bb.min.y.toFixed(2)}, ${bb.min.z.toFixed(2)}] → [${bb.max.x.toFixed(2)}, ${bb.max.y.toFixed(2)}, ${bb.max.z.toFixed(2)}]`);
      console.log(`Tamaño global: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`);

      // Full 3-axis CT scan
      const decomp = decomposeBySlicing(merged, 50);

      console.log(`%cFeatures totales: ${decomp.stats.totalFeatures}`, 'color:#4ade80;font-weight:bold');
      console.log(`  Extrusiones: ${decomp.stats.extrusions}`);
      console.log(`  Revoluciones: ${decomp.stats.revolutions}`);
      console.log(`  Agujeros: ${decomp.stats.holes}`);
      console.log(`  Desconocidos: ${decomp.stats.unknown}`);
      console.log(`  Tiempo total: ${decomp.stats.processingTimeMs.toFixed(1)}ms`);

      // Detailed axis analysis
      for (const ax of ['X', 'Y', 'Z'] as const) {
        const scan = decomp.scans[ax];
        const filled = scan.slices.filter(s => s.totalArea > 0).length;
        console.group(`%c  Eje ${ax}: ${scan.bands.length} bandas, ${filled}/${scan.slices.length} cortes`, 'color:#60a5fa');

        // Band details table
        if (scan.bands.length <= 30) {
          console.table(scan.bands.map((b, i) => ({
            banda: i,
            desde: b.zStart.toFixed(3),
            hasta: b.zEnd.toFixed(3),
            alto: (b.zEnd - b.zStart).toFixed(3),
            tipo: b.featureType,
            β0: b.slice.beta0,
            β1: b.slice.beta1,
            χ: b.slice.eulerChar,
            area: b.slice.totalArea.toFixed(2),
            outers: b.outerContours.length,
            holes: b.holeContours.length,
            circular: b.outerContours.some(c => c.isCircular) ? '●' : '',
          })));
        }
        console.groupEnd();
      }

      // Complete features table
      if (decomp.features.length <= 60) {
        console.group('%c📋 Todos los features detectados', 'color:#facc15;font-weight:bold');
        console.table(decomp.features.map((f, i) => ({
          '#': i,
          tipo: f.type,
          eje: f.axis,
          cx: f.center[0].toFixed(2),
          cy: f.center[1].toFixed(2),
          cz: f.center[2].toFixed(2),
          altura: f.height.toFixed(3),
          radio: f.radius?.toFixed(3) ?? '—',
          n_agujeros: f.holes.length,
          pts_perfil: f.profile.length,
          confianza: (f.confidence * 100).toFixed(0) + '%',
          label: f.label,
        })));
        console.groupEnd();
      }

      // ═══ Cross-axis verification summary ═══
      console.group('%c✅ Verificación inter-ejes', 'color:#4ade80;font-weight:bold');
      const circularByAxis: Record<string, number> = { X: 0, Y: 0, Z: 0 };
      for (const f of decomp.features) {
        if (f.radius && f.radius > 0.01) circularByAxis[f.axis]++;
      }
      console.log(`Features circulares por eje: X=${circularByAxis.X}, Y=${circularByAxis.Y}, Z=${circularByAxis.Z}`);

      // Group features by approximate center location (for cross-validation)
      const centerBuckets = new Map<string, typeof decomp.features>();
      for (const f of decomp.features) {
        const key = `${Math.round(f.center[0] * 2) / 2},${Math.round(f.center[1] * 2) / 2},${Math.round(f.center[2] * 2) / 2}`;
        if (!centerBuckets.has(key)) centerBuckets.set(key, []);
        centerBuckets.get(key)!.push(f);
      }
      const multiAxisLocations = [...centerBuckets.entries()].filter(([, v]) => {
        const axes = new Set(v.map(f => f.axis));
        return axes.size > 1;
      });
      console.log(`Ubicaciones detectadas desde múltiples ejes: ${multiAxisLocations.length}`);
      for (const [pos, feats] of multiAxisLocations.slice(0, 10)) {
        console.log(`  ${pos}: ${feats.map(f => `${f.axis}:${f.type}`).join(' + ')} → confianza reforzada`);
      }
      console.groupEnd();

      // ═══ Assembly decomposition summary (if applicable) ═══
      if (isAssembly && perMeshDecomps.length > 1) {
        console.group('%c🧩 Resumen de ensamble', 'color:#ff7043;font-weight:bold');
        console.table(perMeshDecomps.map(m => ({
          componente: m.name,
          triángulos: m.triCount,
          features: m.decomp.stats.totalFeatures,
          extrusiones: m.decomp.stats.extrusions,
          revoluciones: m.decomp.stats.revolutions,
          agujeros: m.decomp.stats.holes,
          tiempo_ms: m.decomp.stats.processingTimeMs.toFixed(1),
        })));
        console.groupEnd();
      }

      console.groupEnd(); // end merged analysis

      // ═══ Build SDF scene ═══
      const result = decompositionToScene(decomp, modelLabel);

      if (result.warnings.length > 0) {
        console.warn('[CT-Scan] Warnings:', result.warnings);
      }

      const newScene = result.scene;
      const mergedVars = resolveVariables([...state.variables, ...result.variables]);

      set({
        ...pushHistory(state, newScene),
        variables: mergedVars,
        ctScanResult: decomp,
        ctScanning: false,
      });

      get().requestMesh('medium');
      merged.dispose();
    } catch (err) {
      console.error('[CT-Scan] Failed:', err);
      set({
        ctScanning: false,
        importError: `CT-Scan falló: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    }, 16); // defer to next frame
  },

  clearCtScan: () => set({ ctScanResult: null, fittedSlices: [] }),

  // ── Sketch Fitting Actions ──

  fitSketches: async (modelIndex) => {
    const state = get();
    const model = state.importedModels[modelIndex];
    if (!model) return;

    set({ sketchFitting: true });

    try {
      // Merge all meshes into one geometry
      const allPositions: number[] = [];
      const allIndices: number[] = [];
      let vertexOffset = 0;

      for (const mesh of model.meshes) {
        const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const idx = mesh.geometry.getIndex();
        if (!posAttr) continue;

        for (let i = 0; i < posAttr.count; i++) {
          allPositions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        }

        if (idx) {
          for (let i = 0; i < idx.count; i++) allIndices.push(idx.getX(i) + vertexOffset);
        } else {
          for (let i = 0; i < posAttr.count; i++) allIndices.push(i + vertexOffset);
        }
        vertexOffset += posAttr.count;
      }

      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(new Float32Array(allPositions), 3));
      merged.setIndex(new THREE.BufferAttribute(new Uint32Array(allIndices), 1));
      merged.computeBoundingBox();

      const bb = merged.boundingBox!;
      const size = new THREE.Vector3();
      bb.getSize(size);
      const diag = size.length();
      const tol = Math.max(0.001, diag * 0.0001);

      const axes: SliceAxis[] = ['X', 'Y', 'Z'];
      const mins = [bb.min.x, bb.min.y, bb.min.z];
      const sizes = [size.x, size.y, size.z];
      const NUM_SLICES = 8; // 8 slices per axis = 24 total

      const fittedSlices: FittedSlice[] = [];
      let totalEntities = 0;

      console.group('%c✏️ SKETCH FITTING', 'color:#c9a84c;font-size:14px;font-weight:bold');

      for (let ai = 0; ai < 3; ai++) {
        const axis = axes[ai];
        const lo = mins[ai];
        const range = sizes[ai];

        for (let si = 0; si < NUM_SLICES; si++) {
          const t = (si + 0.5) / NUM_SLICES;
          const val = lo + range * 0.01 + t * range * 0.98;
          const result = sliceMesh(merged, axis, val);

          if (result.contours.length === 0) continue;

          const contourResults: FittedContour[] = [];

          for (const contour of result.contours) {
            if (contour.points.length < 6) continue;

            const { entities, constraints } = fitContour(contour.points, tol);
            if (entities.length === 0) continue;

            const error = reconstructionError(contour.points, entities, tol);
            contourResults.push({ entities, constraints, originalPoints: contour.points, error });
            totalEntities += entities.length;
          }

          if (contourResults.length > 0) {
            fittedSlices.push({ axis, value: val, contours: contourResults });
          }

          // Yield to keep UI responsive every 2 slices
          if ((si + ai * NUM_SLICES) % 2 === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
        }
      }

      const lines = fittedSlices.flatMap(s => s.contours.flatMap(c => c.entities.filter(e => e.type === 'line'))).length;
      const arcs = fittedSlices.flatMap(s => s.contours.flatMap(c => c.entities.filter(e => e.type === 'arc' && !e.isFullCircle))).length;
      const circles = fittedSlices.flatMap(s => s.contours.flatMap(c => c.entities.filter(e => e.type === 'arc' && e.isFullCircle))).length;

      console.log(`Slices: ${fittedSlices.length} | Entities: ${totalEntities} (${lines}L + ${arcs}A + ${circles}⊙)`);
      console.groupEnd();

      merged.dispose();
      set({ fittedSlices, sketchFitting: false });
    } catch (err) {
      console.error('[Sketch Fit] Failed:', err);
      set({ sketchFitting: false });
    }
  },

  clearFittedSlices: () => set({ fittedSlices: [], gpuFittedPlanes: [] }),

  setRendererRef: (renderer) => set({ rendererRef: renderer }),

  clearGPUFittedPlanes: () => set({ gpuFittedPlanes: [], fittedSlices: [], reconstruction: null }),

  sweepModel: async (modelIndex) => {
    const state = get();
    const model = state.importedModels[modelIndex];
    const renderer = state.rendererRef;
    if (!model || !renderer) {
      console.warn('[Sweep] No model or renderer');
      return;
    }

    set({ sweeping: true, sweepProgress: 'Iniciando barrido...' });

    try {
      model.threeGroup.updateMatrixWorld(true);
      const { gpuContinuousSweep, gpuSlice } = await import('./gpu-cross-section');
      const { fitContour, reconstructionError } = await import('./sketch-fitting');

      console.group('%c⚒️ FORGE SWEEP — Adaptive 3-Axis Bisection', 'color:#c9a84c;font-size:14px;font-weight:bold');
      set({ sweepProgress: 'Phase 1: Barrido 3 ejes...' });
      const result = await gpuContinuousSweep(renderer, model.threeGroup, {
        sweepResolution: 512,
        onProgress: (phase, done, total) => {
          console.log(`  [${done}/${total}] ${phase}`);
        },
      });

      console.log(`⚒️ Sweep: ${result.features.length} features, ${result.discoveredPlanes.length} boundary planes, ${result.totalMs.toFixed(0)}ms`);

      // ── Phase 2: Generate gpuFittedPlanes at discovered positions ──
      // For each axis, take transition boundaries → build stable intervals → 
      // place a representative slice at the midpoint of each interval.
      const THREE = await import('three');
      const bb = new THREE.Box3();
      model.threeGroup.traverse((c: any) => { if (c.isMesh) bb.expandByObject(c); });
      const diag = bb.getSize(new THREE.Vector3()).length();
      const tol = Math.max(0.001, diag * 0.0001);

      const axes: ('X' | 'Y' | 'Z')[] = ['X', 'Y', 'Z'];
      type SliceAxis = 'X' | 'Y' | 'Z';
      const representativePlanes: { normal: THREE.Vector3; depth: number; axis: SliceAxis; label: string }[] = [];

      for (const axis of axes) {
        const sweep = result.sweeps[axis];
        const normal = new THREE.Vector3(
          axis === 'X' ? 1 : 0, axis === 'Y' ? 1 : 0, axis === 'Z' ? 1 : 0,
        );
        const bbMin = axis === 'X' ? bb.min.x : axis === 'Y' ? bb.min.y : bb.min.z;
        const bbMax = axis === 'X' ? bb.max.x : axis === 'Y' ? bb.max.y : bb.max.z;
        const range = bbMax - bbMin;
        const margin = range * 0.02;

        // Sort transitions by depth to get interval boundaries
        const boundaries = sweep.transitions
          .map(t => (t.fromDepth + t.toDepth) / 2)
          .sort((a, b) => a - b);

        // Build intervals: [start, b1, b2, ..., bn, end]
        const edges = [bbMin + margin, ...boundaries, bbMax - margin];

        for (let i = 0; i < edges.length - 1; i++) {
          const lo = edges[i], hi = edges[i + 1];
          const width = hi - lo;
          if (width < range * 0.005) continue; // skip tiny intervals

          const mid = (lo + hi) / 2;
          representativePlanes.push({
            normal: normal.clone(),
            depth: mid,
            axis,
            label: `${axis} @${mid.toFixed(1)} [${lo.toFixed(1)}→${hi.toFixed(1)}]`,
          });
        }
      }

      console.log(`⚒️ Generating ${representativePlanes.length} high-res slices from stable intervals...`);
      set({ sweepProgress: `Phase 2: 0/${representativePlanes.length} planos...` });

      // ── Phase 3: GPU slice + entity fitting at 1024 res ──
      const gpuPlanes: import('./gpu-cross-section').GPUFittedPlane[] = [];
      const fitted: FittedSlice[] = [];
      const t3 = performance.now();

      for (let pi = 0; pi < representativePlanes.length; pi++) {
        const rp = representativePlanes[pi];
        const plane = {
          origin: rp.normal.clone().multiplyScalar(rp.depth),
          normal: rp.normal.clone(),
          label: rp.label,
        };

        const sr = gpuSlice(renderer, model.threeGroup, plane, 1024);
        if (sr.contours.length === 0) continue;

        const fittedContours: import('./gpu-cross-section').GPUFittedPlane['contours'] = [];

        for (const contour of sr.contours) {
          if (contour.points.length < 6) continue;
          const { entities, constraints } = fitContour(contour.points, tol);
          if (entities.length === 0) continue;
          const error = reconstructionError(contour.points, entities, tol);
          fittedContours.push({ entities, constraints, originalPoints: contour.points, error });
        }

        if (fittedContours.length > 0) {
          gpuPlanes.push({ plane, sliceResult: sr, contours: fittedContours, entityCount: fittedContours.reduce((s, c) => s + c.entities.length, 0) });
          fitted.push({
            axis: rp.axis,
            value: rp.depth,
            contours: fittedContours,
            uAxis: sr.uAxis.toArray() as [number, number, number],
            vAxis: sr.vAxis.toArray() as [number, number, number],
            planeOrigin: sr.planeOrigin.toArray() as [number, number, number],
          });
        }

        // Yield every 3 planes + update progress
        if (pi % 3 === 0) {
          set({ sweepProgress: `Phase 2: ${pi + 1}/${representativePlanes.length} planos...` });
          await new Promise(r => setTimeout(r, 0));
        }
      }

      const totalEntities = gpuPlanes.reduce((s, p) => s + p.entityCount, 0);
      const t3end = performance.now();
      console.log(`⚒️ Phase 3: ${gpuPlanes.length} planes, ${totalEntities} entities in ${(t3end - t3).toFixed(0)}ms`);

      // ── Phase 4: Consolidate features ──
      set({ sweepProgress: 'Phase 3: Consolidando...' });
      const t4 = performance.now();
      const consolidation = consolidateFeatures(fitted, diag);
      const t4end = performance.now();
      console.log(`⚒️ Phase 4: ${consolidation.stats.inputContours} contours → ${consolidation.stats.outputFeatures} features (${consolidation.stats.reductionRatio.toFixed(1)}× reduction) in ${(t4end - t4).toFixed(0)}ms`);
      if (consolidation.patterns.length > 0) {
        console.log(`⚒️ Patterns: ${consolidation.patterns.map(p => `${p.type}×${p.count}`).join(', ')}`);
      }
      console.groupEnd();

      set({
        sweepResult: result,
        gpuFittedPlanes: gpuPlanes,
        fittedSlices: fitted,
        consolidation,
        sweeping: false,
      });
    } catch (err) {
      console.error('[Sweep] Failed:', err);
      set({ sweeping: false });
    }
  },

  clearSweep: () => set({ sweepResult: null }),

  reconstructModel: () => {
    const { fittedSlices } = get();
    if (fittedSlices.length === 0) return;
    set({ reconstructing: true });
    // Use dynamic import to avoid importing Three.js code at store init
    import('./sketch-reconstruct').then(({ reconstructFromSlices }) => {
      try {
        const result = reconstructFromSlices(fittedSlices);
        console.log(`[Reconstruct] ${result.bands.length} bands, ${result.warnings.length} warnings, ${result.timeMs.toFixed(0)}ms`);
        if (result.warnings.length > 0) {
          console.warn('[Reconstruct] Warnings:', result.warnings);
        }
        set({ reconstruction: result, reconstructing: false });
      } catch (err) {
        console.error('[Reconstruct] Failed:', err);
        set({ reconstructing: false });
      }
    });
  },

  clearReconstruction: () => {
    const { reconstruction } = get();
    if (reconstruction) {
      // Dispose geometries and materials
      reconstruction.group.traverse((obj: any) => {
        if (obj.isMesh) {
          obj.geometry?.dispose();
          obj.material?.dispose();
        }
      });
    }
    set({ reconstruction: null });
  },

  setModelMaterial: (modelIndex, props) => {
    const model = get().importedModels[modelIndex];
    if (!model) return;
    model.threeGroup.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        const mat = obj.material as THREE.MeshStandardMaterial;
        if (props.color != null) { mat.color.set(props.color); mat.vertexColors = false; mat.needsUpdate = true; }
        if (props.metalness != null) mat.metalness = props.metalness;
        if (props.roughness != null) mat.roughness = props.roughness;
        // Mark as user-overridden so theme changes don't reset it
        obj.userData._userMaterial = true;
      }
    });
    // Trigger re-render by shallow-copying the array
    set({ importedModels: [...get().importedModels] });
  },

  scanModel: async (modelIndex) => {
    const state = get();
    const model = state.importedModels[modelIndex];
    const renderer = state.rendererRef;
    console.log('[Scan] scanModel called — modelIndex:', modelIndex, '| model:', !!model, '| renderer:', !!renderer, '| importedModels.length:', state.importedModels.length);
    if (!model || !renderer) {
      console.warn('[Scan] No model or renderer — fallback to CPU');
      return state.fitSketches(modelIndex);
    }

    set({ gpuFitting: true, sketchFitting: true });

    try {
      // Force matrixWorld update — Three.js only computes this during render,
      // but we need correct world transforms for GPU slicing
      model.threeGroup.updateMatrixWorld(true);

      const { gpuFitPipeline } = await import('./gpu-cross-section');

      console.group('%c⚒️ FORGE SCAN — Geometry-Driven', 'color:#00ff88;font-size:14px;font-weight:bold');
      console.log('Config: geometry-driven planes, adaptive depth, 2048² GPU render');
      const t0 = performance.now();

      const results = await gpuFitPipeline(renderer, model.threeGroup, {
        resolution: 2048,
        onProgress: (done, total, label) => {
          if (done % 50 === 0 || done === total) {
            console.log(`  [${done}/${total}] ${label}`);
          }
        },
      });

      const elapsed = performance.now() - t0;

      // Convert to FittedSlice[] for backward compat — include plane basis for correct 3D mapping
      const fittedSlices: FittedSlice[] = results.map(r => {
        const n = r.plane.normal;
        const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
        let axis: SliceAxis = 'Z';
        if (ax > ay && ax > az) axis = 'X';
        else if (ay > ax && ay > az) axis = 'Y';
        const value = r.plane.origin.dot(r.plane.normal);
        const sr = r.sliceResult;
        return {
          axis, value, contours: r.contours,
          uAxis: sr.uAxis.toArray() as [number, number, number],
          vAxis: sr.vAxis.toArray() as [number, number, number],
          planeOrigin: sr.planeOrigin.toArray() as [number, number, number],
        };
      });

      const totalEntities = results.reduce((s, r) => s + r.entityCount, 0);
      const totalContours = results.reduce((s, r) => s + r.contours.length, 0);
      console.log(`⚒️ Scan complete: ${results.length} planes, ${totalContours} contours, ${totalEntities} entities in ${elapsed.toFixed(0)}ms`);
      console.groupEnd();

      set({
        gpuFittedPlanes: results,
        fittedSlices,
        gpuFitting: false,
        sketchFitting: false,
      });
    } catch (err) {
      console.error('[Scan] GPU failed, falling back to CPU:', err);
      set({ gpuFitting: false, sketchFitting: false });
      return get().fitSketches(modelIndex);
    }
  },

  // ── Machine Actions ──

  importMachine: async (file) => {
    set({ machineImporting: true });
    try {
      const config = await importMachineFile(file);
      set(s => ({
        machines: [...s.machines, config],
        selectedMachine: config,
        machineImporting: false,
      }));
    } catch (err) {
      set({ machineImporting: false, importError: `Error máquina: ${err instanceof Error ? err.message : String(err)}` });
    }
  },

  selectMachine: (id) => {
    set(s => ({
      selectedMachine: id ? s.machines.find(m => m.id === id) ?? null : null,
    }));
  },

  removeMachine: (id) => {
    set(s => ({
      machines: s.machines.filter(m => m.id !== id),
      selectedMachine: s.selectedMachine?.id === id ? null : s.selectedMachine,
    }));
  },

  // ── Módulo Actions ──

  addModule: (name, color) => {
    const state = get();
    const m = makeModule(name, color);
    const newScene = { ...state.scene, children: [...state.scene.children, m] } as SdfOperation;
    set({ ...pushHistory(state, newScene), activeModuleId: m.id, selectedId: m.id });
    return m.id;
  },

  renameModule: (id, name) => {
    const state = get();
    const newScene = updateNodeInTree(state.scene, id, { label: name }) as SdfOperation;
    set(pushHistory(state, newScene));
  },

  removeModule: (id) => {
    const state = get();
    const mod = findNode(state.scene, id);
    if (!mod || !isModule(mod)) return;
    // Promueve los hijos del módulo a la raíz y elimina el módulo
    let rebuilt = removeNodeFromTree(state.scene, id) as SdfOperation;
    if (rebuilt && mod.children.length > 0) {
      rebuilt = { ...rebuilt, children: [...rebuilt.children, ...mod.children] };
    }
    set({
      ...pushHistory(state, rebuilt ?? state.scene),
      activeModuleId: state.activeModuleId === id ? null : state.activeModuleId,
      selectedId: state.selectedId === id ? null : state.selectedId,
    });
    get().requestMesh('medium');
  },

  setActiveModule: (id) => set({ activeModuleId: id }),

  // ── Variable Actions ──

  addVariable: (name, expression, opts) => {
    const v = createVariable(name, expression, opts);
    set(s => ({ variables: resolveVariables([...s.variables, v]) }));
    return v.id;
  },

  updateVariableExpression: (id, expression) => {
    set(s => {
      const updated = s.variables.map(v =>
        v.id === id ? { ...v, expression } : v,
      );
      return { variables: resolveVariables(updated) };
    });
    // Sync resolved values to SDF scene
    get().syncVariablesToScene();
  },

  renameVariable: (id, newName) => {
    set(s => ({
      variables: s.variables.map(v => v.id === id ? { ...v, name: newName } : v),
    }));
  },

  removeVariable: (id) => {
    set(s => ({ variables: s.variables.filter(v => v.id !== id) }));
  },

  // ── Joint Actions ──

  addJoint: (joint) => set(s => ({ joints: [...s.joints, joint] })),

  removeJoint: (id) => set(s => ({ joints: s.joints.filter(j => j.id !== id) })),

  renameJoint: (id, label) => set(s => ({
    joints: s.joints.map(j => j.id === id ? { ...j, label } : j),
  })),

  driveJoint: (id, value) => {
    set(s => ({
      joints: s.joints.map(j => {
        if (j.id !== id) return j;
        if (j.type === 'rigid') return j;
        return { ...j, drive: clampDrive(j, value) };
      }),
    }));
    // Bake, mesh, and detect collisions on the new configuration.
    const st = get();
    const baked = bakeJointTransforms(st.scene, st.joints);
    const modules = collectModules(baked);
    const colliding = detectCollisions(baked, modules, rigidPairKeys(st.joints));
    set({ collidingModuleIds: colliding });
    get().requestMesh('draft'); // low-res during scrub for responsiveness
  },

  setJoints: (joints) => set({ joints }),

  setSelectedJoint: (id) => set({ selectedJointId: id }),

  syncVariablesToScene: () => {
    const state = get();
    // Group param updates by primitive ID
    const paramUpdates = new Map<string, Record<string, number>>();
    for (const v of state.variables) {
      if (v.linkedPrimId && v.linkedParamKey && isFinite(v.resolvedValue)) {
        const existing = paramUpdates.get(v.linkedPrimId) ?? {};
        existing[v.linkedParamKey] = v.resolvedValue;
        paramUpdates.set(v.linkedPrimId, existing);
      }
    }
    // Apply all updates to the SDF tree
    let scene = state.scene;
    for (const [primId, params] of paramUpdates) {
      scene = updateNodeInTree(scene, primId, { params }) as SdfOperation;
    }
    if (scene !== state.scene) {
      set(pushHistory(state, scene));
    }
  },
}));

// ═══════════════════════════════════════════════════════════════
// Multi-Window Session Sync — BroadcastChannel
// ═══════════════════════════════════════════════════════════════
// Cualquier cambio en escena/variables/máquinas se propaga a todas
// las ventanas abiertas del mismo origen (misma sesión, dos monitores).

interface ForgeSync {
  type: 'forge-state-sync';
  scene: SdfOperation;
  variables: GaiaVariable[];
  machines: MachineConfig[];
}

let _suppressSync = false;
const _bc: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('forge-session-v1') : null;

if (_bc) {
  _bc.onmessage = (e: MessageEvent<ForgeSync>) => {
    if (e.data?.type !== 'forge-state-sync') return;
    _suppressSync = true;
    useForgeStore.setState({
      scene: e.data.scene,
      variables: e.data.variables,
      machines: e.data.machines,
    });
    // Re-request mesh after scene sync
    setTimeout(() => useForgeStore.getState().requestMesh(), 10);
    _suppressSync = false;
  };
}

useForgeStore.subscribe((state) => {
  if (_suppressSync || !_bc) return;
  const msg: ForgeSync = {
    type: 'forge-state-sync',
    scene: state.scene,
    variables: state.variables,
    machines: state.machines,
  };
  _bc.postMessage(msg);
});

/** Expose sync channel status for UI indicators */
export const getSessionSyncActive = () => _bc !== null;
