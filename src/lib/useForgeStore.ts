/**
 * ⚒️ La Forja — Zustand Store
 * ============================
 * Central state: scene graph, selection, history (undo/redo), mesh cache.
 * Drives the SDF→Worker→Three.js pipeline.
 */

import { create } from 'zustand';
import type { SdfNode, SdfPrimitive, SdfOperation } from './sdf-engine';
import {
  isPrimitive,
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
} from './sdf-engine';

// ── Types ──

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  triCount: number;
}

export type MeshQuality = 'draft' | 'medium' | 'high';

const RESOLUTION: Record<MeshQuality, number> = {
  draft: 64,
  medium: 128,
  high: 256,
};

interface ForgeState {
  // Scene
  scene: SdfOperation;
  selectedId: string | null;

  // Mesh (from worker)
  mesh: MeshData | null;
  meshQuality: MeshQuality;
  meshing: boolean;

  // History
  history: SdfOperation[];
  historyIndex: number;

  // Worker
  worker: Worker | null;

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
  deleteNode: (id: string) => void;
  setScene: (scene: SdfOperation) => void;

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

export const useForgeStore = create<ForgeState>((set, get) => ({
  scene: createDefaultScene(),
  selectedId: null,
  mesh: null,
  meshQuality: 'medium',
  meshing: false,
  history: [createDefaultScene()],
  historyIndex: 0,
  worker: null,

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
    set({ meshing: true, meshQuality: q });
    w.postMessage({ type: 'mesh', scene: state.scene, resolution: RESOLUTION[q] });
  },

  setSelectedId: (id) => set({ selectedId: id }),

  updateNode: (id, updates) => {
    const state = get();
    const newScene = updateNodeInTree(state.scene, id, updates) as SdfOperation;
    set(pushHistory(state, newScene));
    get().requestMesh('draft');
  },

  updateParam: (id, key, value) => {
    const state = get();
    const node = findNode(state.scene, id);
    if (!node || !isPrimitive(node)) return;
    const newScene = updateNodeInTree(state.scene, id, {
      params: { ...node.params, [key]: value },
    }) as SdfOperation;
    set(pushHistory(state, newScene));
    get().requestMesh('draft');
  },

  updatePosition: (id, axis, value) => {
    const state = get();
    const node = findNode(state.scene, id);
    if (!node || !isPrimitive(node)) return;
    const pos: [number, number, number] = [...node.position];
    pos[axis] = value;
    const newScene = updateNodeInTree(state.scene, id, { position: pos }) as SdfOperation;
    set(pushHistory(state, newScene));
    get().requestMesh('draft');
  },

  updateRotation: (id, axis, value) => {
    const state = get();
    const node = findNode(state.scene, id);
    if (!node || !isPrimitive(node)) return;
    const rot: [number, number, number] = [...(node.rotation || [0, 0, 0])];
    rot[axis] = value;
    const newScene = updateNodeInTree(state.scene, id, { rotation: rot }) as SdfOperation;
    set(pushHistory(state, newScene));
    get().requestMesh('draft');
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

    if (state.selectedId) {
      const target = findNode(state.scene, state.selectedId);
      if (target && !isPrimitive(target)) {
        newScene = addChildToNode(state.scene, state.selectedId, n) as SdfOperation;
      } else {
        newScene = { ...state.scene, children: [...state.scene.children, n] };
      }
    } else {
      newScene = { ...state.scene, children: [...state.scene.children, n] };
    }

    set({ ...pushHistory(state, newScene), selectedId: n.id });
    get().requestMesh('medium');
  },

  addOperation: (type) => {
    const state = get();
    const n = makeOp(type, [], 0.2);
    let newScene: SdfOperation;

    if (state.selectedId) {
      const target = findNode(state.scene, state.selectedId);
      if (target && !isPrimitive(target)) {
        newScene = addChildToNode(state.scene, state.selectedId, n) as SdfOperation;
      } else {
        newScene = { ...state.scene, children: [...state.scene.children, n] };
      }
    } else {
      newScene = { ...state.scene, children: [...state.scene.children, n] };
    }

    set({ ...pushHistory(state, newScene), selectedId: n.id });
    get().requestMesh('medium');
  },

  deleteNode: (id) => {
    const state = get();
    if (id === state.scene.id) return;
    const r = removeNodeFromTree(state.scene, id);
    if (!r) return;
    set({ ...pushHistory(state, r as SdfOperation), selectedId: null });
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
}));
