/**
 * La Forja — Script Runner
 * =========================
 * Bridges the declarative DSL (src/forja/api.ts) to the live Zustand store.
 * Runs the scene script on page mount and on Vite HMR updates.
 */

import { makeOp, type SdfOperation } from '@/lib/sdf-engine';
import { createVariable } from '@/lib/gaia-variables';
import { useForgeStore } from '@/lib/useForgeStore';
import {
  ForjaContext,
  isSceneDefinition,
  type ScriptResult,
  type SceneDefinition,
} from './api';

export interface RunResult {
  ok: boolean;
  error?: string;
  primitiveCount: number;
  variableCount: number;
  jointCount: number;
  summary: string;
}

/** Count primitives in a tree (for the AI panel summary). */
function countPrimitives(node: SdfOperation | { kind: string; children?: unknown[] }): number {
  if ('kind' in node && node.kind === 'primitive') return 1;
  const children = 'children' in node && Array.isArray(node.children) ? node.children : [];
  let n = 0;
  for (const c of children) n += countPrimitives(c as SdfOperation);
  return n;
}

/** Execute a script definition and apply the result to the store. */
export async function runScene(def: unknown): Promise<RunResult> {
  if (!isSceneDefinition(def)) {
    return {
      ok: false,
      error: 'Script must export `export default defineScene(...)`',
      primitiveCount: 0,
      variableCount: 0,
      jointCount: 0,
      summary: '',
    };
  }

  const ctx = new ForjaContext();
  try {
    await def.builder(ctx);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      primitiveCount: 0,
      variableCount: 0,
      jointCount: 0,
      summary: '',
    };
  }

  const built = ctx._build();
  const scene = assembleScene(built);
  const variables = built.variables.map((v) =>
    createVariable(v.name, v.expression, {
      unit: v.opts.unit ?? 'none',
      group: v.opts.group ?? 'script',
      description: v.opts.description ?? '',
      min: v.opts.min,
      max: v.opts.max,
      source: 'user',
    }),
  );

  const store = useForgeStore.getState();
  store.setScene(scene);
  store.setJoints(built.joints);
  useForgeStore.setState({ variables });

  const primCount = countPrimitives(scene);
  const jCount = built.joints.length;
  const parts = [
    `${primCount} primitiva${primCount === 1 ? '' : 's'}`,
    `${variables.length} variable${variables.length === 1 ? '' : 's'}`,
  ];
  if (jCount > 0) parts.push(`${jCount} joint${jCount === 1 ? '' : 's'}`);
  const summary = parts.join(', ');

  return { ok: true, primitiveCount: primCount, variableCount: variables.length, jointCount: jCount, summary };
}

function assembleScene(built: ScriptResult): SdfOperation {
  if (built.rootOverride) return built.rootOverride;
  return makeOp('union', built.rootChildren);
}

/** Publish a run result on window so the AI panel can read it. */
interface ForjaWindow {
  __forjaLastRun?: RunResult;
  __forjaRunScene?: typeof runScene;
}

export function publishRunResult(result: RunResult): void {
  const w = globalThis as unknown as ForjaWindow;
  w.__forjaLastRun = result;
  w.__forjaRunScene = runScene;
  window.dispatchEvent(new CustomEvent('forja:run', { detail: result }));
}
