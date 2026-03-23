/**
 * GAIA Forge — STEP/IGES/BREP Importer
 * ======================================
 * Uses occt-import-js (OpenCASCADE compiled to WASM) to parse
 * industry-standard CAD files in the browser — zero server needed.
 *
 * Produces Three.js-ready BufferGeometry + materials with per-face colors.
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ImportedFace {
  first: number;
  last: number;
  color: [number, number, number] | null;
}

export interface ImportedMesh {
  name: string;
  color: [number, number, number] | null;
  geometry: THREE.BufferGeometry;
  faces: ImportedFace[];
}

export interface ImportedNode {
  name: string;
  meshIndices: number[];
  children: ImportedNode[];
}

export interface ImportedModel {
  success: boolean;
  root: ImportedNode;
  meshes: ImportedMesh[];
  threeGroup: THREE.Group;
  stats: {
    nodeCount: number;
    meshCount: number;
    triangleCount: number;
    vertexCount: number;
  };
}

export type ImportFormat = 'step' | 'iges' | 'brep';

// ═══════════════════════════════════════════════════════════════
// WASM Loader (singleton)
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _occtPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOcct(): Promise<any> {
  if (!_occtPromise) {
    // occt-import-js exports a factory function that returns a Promise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const occtFactory = (await import('occt-import-js')) as any;
    const factory = occtFactory.default ?? occtFactory;
    // locateFile tells Emscripten where to find the .wasm binary.
    // It lives in public/ so Vite serves it at the root URL.
    _occtPromise = factory({
      locateFile: (path: string) => `/${path}`,
    });
  }
  return _occtPromise;
}

// ═══════════════════════════════════════════════════════════════
// Parser
// ═══════════════════════════════════════════════════════════════

function detectFormat(filename: string): ImportFormat {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'step' || ext === 'stp') return 'step';
  if (ext === 'iges' || ext === 'igs') return 'iges';
  if (ext === 'brep' || ext === 'brp') return 'brep';
  return 'step'; // default to STEP
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildNode(raw: any): ImportedNode {
  return {
    name: raw.name ?? '',
    meshIndices: raw.meshes ?? [],
    children: (raw.children ?? []).map(buildNode),
  };
}

function countNodes(node: ImportedNode): number {
  return 1 + node.children.reduce((s, c) => s + countNodes(c), 0);
}

/**
 * Import a STEP/IGES/BREP file from a Uint8Array or File.
 * Returns a full Three.js Group with colored meshes.
 */
export async function importCADFile(
  fileOrBuffer: File | Uint8Array,
  filename?: string,
): Promise<ImportedModel> {
  // Read file contents
  let buffer: Uint8Array;
  let name: string;
  if (fileOrBuffer instanceof File) {
    name = fileOrBuffer.name;
    const ab = await fileOrBuffer.arrayBuffer();
    buffer = new Uint8Array(ab);
  } else {
    buffer = fileOrBuffer;
    name = filename ?? 'model.step';
  }

  // Load WASM
  const occt = await getOcct();

  // Detect format and call appropriate reader
  const format = detectFormat(name);
  const params = {
    linearUnit: 'millimeter',
    linearDeflection: 0.05,   // ~0.05 mm curvatura máxima por triángulo
    angularDeflection: 0.08,  // ~4.6° por segmento → círculos suaves (~80 lados)
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;
  switch (format) {
    case 'step': result = occt.ReadStepFile(buffer, params); break;
    case 'iges': result = occt.ReadIgesFile(buffer, params); break;
    case 'brep': result = occt.ReadBrepFile(buffer, params); break;
  }

  if (!result || !result.success) {
    return {
      success: false,
      root: { name: '', meshIndices: [], children: [] },
      meshes: [],
      threeGroup: new THREE.Group(),
      stats: { nodeCount: 0, meshCount: 0, triangleCount: 0, vertexCount: 0 },
    };
  }

  // Convert meshes to Three.js geometries
  const meshes: ImportedMesh[] = [];
  let totalTris = 0;
  let totalVerts = 0;

  for (const rawMesh of result.meshes) {
    const geo = new THREE.BufferGeometry();

    // Positions
    const posArr = new Float32Array(rawMesh.attributes.position.array);
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    totalVerts += posArr.length / 3;

    // Normals
    if (rawMesh.attributes.normal) {
      const norArr = new Float32Array(rawMesh.attributes.normal.array);
      geo.setAttribute('normal', new THREE.BufferAttribute(norArr, 3));
    } else {
      geo.computeVertexNormals();
    }

    // Index
    if (rawMesh.index) {
      const idxArr = new Uint32Array(rawMesh.index.array);
      geo.setIndex(new THREE.BufferAttribute(idxArr, 1));
      totalTris += idxArr.length / 3;
    } else {
      totalTris += posArr.length / 9;
    }

    // Per-face vertex colors
    if (rawMesh.brep_faces && rawMesh.brep_faces.length > 0) {
      const vertCount = posArr.length / 3;
      const colors = new Float32Array(vertCount * 3);
      // Default color (light gray)
      const defaultColor: [number, number, number] = rawMesh.color
        ? [rawMesh.color[0] / 255, rawMesh.color[1] / 255, rawMesh.color[2] / 255]
        : [0.7, 0.7, 0.75];

      colors.fill(0);
      for (let i = 0; i < vertCount; i++) {
        colors[i * 3] = defaultColor[0];
        colors[i * 3 + 1] = defaultColor[1];
        colors[i * 3 + 2] = defaultColor[2];
      }

      // Override with face-specific colors
      for (const face of rawMesh.brep_faces) {
        if (!face.color) continue;
        const r = face.color[0] / 255;
        const g = face.color[1] / 255;
        const b = face.color[2] / 255;

        if (rawMesh.index) {
          // Indexed geometry
          const idxArr = rawMesh.index.array;
          for (let t = face.first; t <= face.last; t++) {
            for (let v = 0; v < 3; v++) {
              const vi = idxArr[t * 3 + v];
              colors[vi * 3] = r;
              colors[vi * 3 + 1] = g;
              colors[vi * 3 + 2] = b;
            }
          }
        } else {
          // Non-indexed
          for (let t = face.first; t <= face.last; t++) {
            for (let v = 0; v < 3; v++) {
              const vi = t * 3 + v;
              colors[vi * 3] = r;
              colors[vi * 3 + 1] = g;
              colors[vi * 3 + 2] = b;
            }
          }
        }
      }

      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    geo.computeBoundingBox();

    meshes.push({
      name: rawMesh.name ?? '',
      color: rawMesh.color ?? null,
      geometry: geo,
      faces: rawMesh.brep_faces ?? [],
    });
  }

  // Build Three.js Group from node hierarchy
  const threeGroup = new THREE.Group();
  threeGroup.name = name.replace(/\.\w+$/, '');

  function buildThreeNode(node: ImportedNode, parent: THREE.Group) {
    const group = new THREE.Group();
    group.name = node.name || 'Component';

    for (const idx of node.meshIndices) {
      const m = meshes[idx];
      if (!m) continue;

      const hasVertexColors = m.geometry.hasAttribute('color');
      const baseColor = m.color
        ? new THREE.Color(m.color[0] / 255, m.color[1] / 255, m.color[2] / 255)
        : new THREE.Color(0.5, 0.55, 0.6);

      const material = new THREE.MeshStandardMaterial({
        color: hasVertexColors ? 0xffffff : baseColor,
        vertexColors: hasVertexColors,
        metalness: 0.2,
        roughness: 0.5,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(m.geometry, material);
      mesh.name = m.name || `Mesh_${idx}`;
      // STEP uses mm, our world is also mm-scale but we display at 1unit = 1mm
      // For large models, we may need to scale down
      group.add(mesh);
    }

    for (const child of node.children) {
      buildThreeNode(child, group);
    }

    parent.add(group);
  }

  const rootNode = buildNode(result.root);
  buildThreeNode(rootNode, threeGroup);

  // Auto-scale: if the model is huge (>100 units bounding), scale down
  const bbox = new THREE.Box3().setFromObject(threeGroup);
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 100) {
    const scale = 10 / maxDim;
    threeGroup.scale.setScalar(scale);
  } else if (maxDim < 0.1) {
    const scale = 5 / maxDim;
    threeGroup.scale.setScalar(scale);
  }

  // Center the model
  const centerBox = new THREE.Box3().setFromObject(threeGroup);
  const center = centerBox.getCenter(new THREE.Vector3());
  threeGroup.position.sub(center);
  threeGroup.position.y -= centerBox.min.y;

  return {
    success: true,
    root: rootNode,
    meshes,
    threeGroup,
    stats: {
      nodeCount: countNodes(rootNode),
      meshCount: meshes.length,
      triangleCount: totalTris,
      vertexCount: totalVerts,
    },
  };
}

/**
 * Import from a URL (for loading test models).
 */
export async function importCADFromUrl(
  url: string,
  filename?: string,
): Promise<ImportedModel> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const buffer = new Uint8Array(await response.arrayBuffer());
  return importCADFile(buffer, filename ?? url.split('/').pop() ?? 'model.step');
}

// ═══════════════════════════════════════════════════════════════
// Assembly Decomposition
// ═══════════════════════════════════════════════════════════════

export interface DecomposedComponent {
  name: string;
  path: string;           // Full tree path: "Assembly > SubAssy > Part"
  depth: number;          // Nesting depth
  meshIndices: number[];  // Indices into ImportedModel.meshes
  meshCount: number;
  triangleCount: number;
  boundingBox: { min: [number, number, number]; max: [number, number, number] } | null;
  threeObject: THREE.Object3D | null;
}

/**
 * Decompose an imported assembly into its individual components.
 * Traverses the node hierarchy recursively and returns a flat list
 * of all components with their tree paths.
 *
 * Use this to auto-decompose entire Fusion 360 assemblies imported as STEP:
 * - Each component = a separate body/part
 * - Components with no meshes but children are sub-assemblies
 * - Leaf components with meshes are the actual bodies
 */
export function decomposeAssembly(model: ImportedModel): DecomposedComponent[] {
  const components: DecomposedComponent[] = [];

  function walk(node: ImportedNode, path: string, depth: number, threeParent: THREE.Object3D | null) {
    const fullPath = path ? `${path} > ${node.name || 'Component'}` : (node.name || 'Root');

    // Find the matching Three.js object
    let threeObj: THREE.Object3D | null = null;
    if (threeParent) {
      threeObj = threeParent.children.find(c => c.name === (node.name || 'Component')) ?? null;
    }

    // Count triangles for this component
    let triCount = 0;
    for (const idx of node.meshIndices) {
      const mesh = model.meshes[idx];
      if (mesh) {
        const geo = mesh.geometry;
        if (geo.index) {
          triCount += geo.index.count / 3;
        } else {
          const pos = geo.getAttribute('position');
          if (pos) triCount += pos.count / 3;
        }
      }
    }

    // Compute bounding box from geometry
    let bbox: DecomposedComponent['boundingBox'] = null;
    if (threeObj) {
      const box = new THREE.Box3().setFromObject(threeObj);
      if (!box.isEmpty()) {
        bbox = {
          min: [box.min.x, box.min.y, box.min.z],
          max: [box.max.x, box.max.y, box.max.z],
        };
      }
    }

    // Only add components that have meshes (bodies) or are meaningful sub-assemblies
    if (node.meshIndices.length > 0 || node.children.length > 0) {
      components.push({
        name: node.name || `Component_${components.length}`,
        path: fullPath,
        depth,
        meshIndices: node.meshIndices,
        meshCount: node.meshIndices.length,
        triangleCount: triCount,
        boundingBox: bbox,
        threeObject: threeObj,
      });
    }

    // Recurse children
    for (const child of node.children) {
      walk(child, fullPath, depth + 1, threeObj);
    }
  }

  walk(model.root, '', 0, model.threeGroup);
  return components;
}

/**
 * Get assembly statistics
 */
export function assemblyStats(components: DecomposedComponent[]): {
  totalComponents: number;
  bodies: number;          // Components with meshes
  subAssemblies: number;   // Components with children but no meshes
  maxDepth: number;
} {
  let bodies = 0;
  let subAssemblies = 0;
  let maxDepth = 0;

  for (const c of components) {
    if (c.meshCount > 0) bodies++;
    else subAssemblies++;
    maxDepth = Math.max(maxDepth, c.depth);
  }

  return {
    totalComponents: components.length,
    bodies,
    subAssemblies,
    maxDepth,
  };
}
