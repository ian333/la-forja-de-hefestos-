/**
 * ErrorBoundary específico para módulos del lab.
 *
 * Cuando un módulo lanza un error (NaN en three, falta de WebGL, import falla,
 * etc.), en lugar de mostrar pantalla negra render UN CARD legible con el
 * mensaje + stack para que el usuario reporte de qué se trata.
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  moduleName: string;
  branchAccent: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export default class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[ModuleErrorBoundary:${this.props.moduleName}]`, error, info);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  reset = () => this.setState({ hasError: false, error: null, componentStack: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    const e = this.state.error;
    return (
      <div className="h-full flex items-center justify-center bg-[#05060A] p-6 overflow-y-auto">
        <div className="max-w-2xl space-y-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono"
               style={{ color: this.props.branchAccent }}>
            error en {this.props.moduleName}
          </div>
          <h2 className="text-[18px] font-semibold text-white">
            El módulo falló al renderizar.
          </h2>
          <pre className="text-[11px] font-mono text-[#EF5350] bg-[#1E0F0F] border border-[#EF5350]/30 rounded px-3 py-2 whitespace-pre-wrap leading-relaxed">
            {e?.name}: {e?.message}
          </pre>
          {e?.stack && (
            <details className="text-[10px] font-mono text-[#94A3B8]">
              <summary className="cursor-pointer hover:text-white">stack</summary>
              <pre className="mt-2 whitespace-pre-wrap leading-relaxed bg-[#0B0F17] border border-[#1E293B] rounded px-3 py-2">
                {e.stack}
              </pre>
            </details>
          )}
          {this.state.componentStack && (
            <details className="text-[10px] font-mono text-[#94A3B8]">
              <summary className="cursor-pointer hover:text-white">component stack</summary>
              <pre className="mt-2 whitespace-pre-wrap leading-relaxed bg-[#0B0F17] border border-[#1E293B] rounded px-3 py-2">
                {this.state.componentStack}
              </pre>
            </details>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={this.reset}
              className="text-[11px] px-3 py-1.5 rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20"
            >
              Reintentar
            </button>
            <button
              onClick={() => { window.location.hash = ''; window.location.reload(); }}
              className="text-[11px] px-3 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#4FC3F7]/30 hover:text-white"
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
