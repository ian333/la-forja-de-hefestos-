/**
 * AI Control Panel — shows the state of the AI-driven scene script.
 * Floats at top-right; click to expand. Lets the human see what Claude
 * did and copy diagnostic context back to Claude.
 */

import { useEffect, useState, useCallback } from 'react';
import { useForgeStore } from '@/lib/useForgeStore';
import { isPrimitive, isModule, type SdfNode } from '@/lib/sdf-engine';
import { describeJoint } from '@/lib/joints';
import type { RunResult } from './runner';

const SCRIPT_PATH = 'src/forja/scene.ts';

interface AIPanelProps {
  onReload: () => void;
}

function summarizeNode(node: SdfNode, depth = 0): string {
  const indent = '  '.repeat(depth);
  if (isPrimitive(node)) {
    const pos = node.position.map((n) => n.toFixed(2)).join(', ');
    const params = Object.entries(node.params)
      .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(3) : v}`)
      .join(' ');
    return `${indent}${node.type}[${node.label}] @(${pos}) ${params}`;
  }
  if (isModule(node)) {
    const children = node.children.map((c) => summarizeNode(c, depth + 1)).join('\n');
    return `${indent}group "${node.label}"${children ? '\n' + children : ''}`;
  }
  const children = node.children.map((c) => summarizeNode(c, depth + 1)).join('\n');
  return `${indent}${node.type}${children ? '\n' + children : ''}`;
}

export default function AIPanel({ onReload }: AIPanelProps) {
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState<RunResult | null>(null);
  const [copied, setCopied] = useState(false);
  const scene = useForgeStore((s) => s.scene);
  const variables = useForgeStore((s) => s.variables);
  const joints = useForgeStore((s) => s.joints);

  useEffect(() => {
    const handler = (e: Event) => setRun((e as CustomEvent<RunResult>).detail);
    window.addEventListener('forja:run', handler);
    const last = (globalThis as { __forjaLastRun?: RunResult }).__forjaLastRun;
    if (last) setRun(last);
    return () => window.removeEventListener('forja:run', handler);
  }, []);

  const copyContext = useCallback(() => {
    const varLines = variables
      .map((v) => `  ${v.name} = ${v.expression}  → ${v.resolvedValue.toFixed(3)} ${v.unit !== 'none' ? v.unit : ''}`)
      .join('\n');
    const jointLines = joints.map((j) => `  ${describeJoint(j)}`).join('\n');
    const sceneText = summarizeNode(scene);
    const text = [
      `# La Forja — current scene`,
      `Script file: ${SCRIPT_PATH}`,
      run?.ok
        ? `Status: OK — ${run.summary}`
        : run
          ? `Status: ERROR — ${run.error}`
          : 'Status: (not run yet)',
      '',
      `## Variables`,
      varLines || '(none)',
      '',
      `## Joints`,
      jointLines || '(none)',
      '',
      `## Scene tree`,
      sceneText,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [scene, variables, joints, run]);

  const status = run?.ok
    ? { dot: 'var(--c-green)', text: `✓ ${run.summary}` }
    : run
      ? { dot: 'var(--c-red)', text: `✗ error` }
      : { dot: 'var(--c-gold-dim)', text: '· esperando script' };

  return (
    <div
      className="absolute top-14 right-3 z-30"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] forge-glass hover:brightness-110"
        style={{ border: '1px solid var(--c-border)', background: 'var(--panel-glass)' }}
        title="AI Control — Claude edita src/forja/scene.ts"
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: status.dot, boxShadow: `0 0 6px ${status.dot}` }}
        />
        <span className="font-semibold tracking-wider text-[10px]" style={{ color: 'var(--c-gold)' }}>
          AI
        </span>
        <span className="text-muted-foreground">{status.text}</span>
      </button>

      {open && (
        <div
          className="mt-1.5 w-[340px] rounded-md forge-glass p-3 text-[11px]"
          style={{ border: '1px solid var(--c-border)', background: 'var(--panel-glass)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold" style={{ color: 'var(--c-gold)' }}>
              Control por IA
            </span>
            <button
              onClick={onReload}
              className="px-2 py-0.5 rounded text-[10px] hover:bg-accent/60"
              style={{ border: '1px solid var(--c-border-sub)' }}
            >
              ↻ recargar
            </button>
          </div>

          <div className="mb-2 text-muted-foreground leading-snug">
            Claude edita{' '}
            <code
              className="px-1 py-0.5 rounded"
              style={{ background: 'var(--c-surface-up)', color: 'var(--c-gold)' }}
            >
              {SCRIPT_PATH}
            </code>{' '}
            — cualquier cambio al archivo recarga la escena en vivo.
          </div>

          {run && !run.ok && (
            <div
              className="mb-2 p-2 rounded text-[10px]"
              style={{ background: 'rgba(239,83,80,0.12)', color: 'var(--c-red)' }}
            >
              {run.error}
            </div>
          )}

          <div className="mb-2">
            <div className="text-[10px] uppercase tracking-wider mb-1 text-muted-foreground">
              Variables ({variables.length})
            </div>
            {variables.length === 0 ? (
              <div className="text-muted-foreground italic">—</div>
            ) : (
              <div className="space-y-0.5 max-h-28 overflow-y-auto pr-1">
                {variables.slice(0, 10).map((v) => (
                  <div key={v.id} className="flex justify-between gap-2 font-mono">
                    <span style={{ color: 'var(--c-gold-dim)' }}>{v.name}</span>
                    <span className="text-muted-foreground truncate">
                      {v.resolvedValue.toFixed(3)}
                      {v.unit !== 'none' ? ` ${v.unit}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {joints.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] uppercase tracking-wider mb-1 text-muted-foreground">
                Joints ({joints.length})
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto pr-1">
                {joints.slice(0, 8).map((j) => (
                  <div key={j.id} className="font-mono text-[10px] truncate" style={{ color: 'var(--c-gold-dim)' }}>
                    {j.type} · {j.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={copyContext}
            className="w-full px-2 py-1 rounded text-[10px] hover:bg-accent/60 transition"
            style={{ border: '1px solid var(--c-border-sub)' }}
          >
            {copied ? '✓ copiado' : '⎘ copiar contexto para Claude'}
          </button>
        </div>
      )}
    </div>
  );
}
