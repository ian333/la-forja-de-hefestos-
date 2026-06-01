/**
 * ReportContext — el puente entre el SHELL del Math Lab (que tiene el boton de
 * exportar) y el MODULO activo (que tiene el canvas 3D y, si es mapeable, el
 * resultado del solver).
 *
 * El modulo no conoce al shell ni viceversa: se comunican por este contexto.
 *   - CanvasCapture (hijo R3F de Stage) registra `capture()` -> dataURL PNG.
 *   - El modulo mapeable, via useSolverFor, publica `setSolverResult(r)`.
 *   - El modulo publica su identidad con `setModuleMeta({ nombre, rama, ... })`.
 *   - El shell (ExportReportButton) lee capture/result/meta al exportar.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Resultado } from '@/solver/engine';

export interface ModuleMeta {
  nombre: string;
  rama: string;
  moduleId: string;
  /** Blurb / marco teorico corto del modulo (del registry). */
  marco?: string;
}

interface ReportContextValue {
  /** El hijo R3F registra aqui su capturador sincronico. null = sin canvas. */
  registerCapture: (fn: (() => string | null) | null) => void;
  /** Invoca el capturador registrado. Devuelve dataURL PNG o null. */
  capture: () => string | null;
  /** El modulo mapeable publica su resultado del solver (o null). */
  setSolverResult: (r: Resultado | null) => void;
  solverResult: Resultado | null;
  /** El modulo publica su identidad. */
  setModuleMeta: (m: ModuleMeta | null) => void;
  moduleMeta: ModuleMeta | null;
  /** True si hay un canvas capturable montado. */
  hasCanvas: boolean;
}

const Ctx = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
  const captureFnRef = useRef<(() => string | null) | null>(null);
  const [solverResult, setSolverResult] = useState<Resultado | null>(null);
  const [moduleMeta, setModuleMeta] = useState<ModuleMeta | null>(null);
  const [hasCanvas, setHasCanvas] = useState(false);

  const registerCapture = useCallback((fn: (() => string | null) | null) => {
    captureFnRef.current = fn;
    setHasCanvas(!!fn);
  }, []);

  const capture = useCallback((): string | null => {
    try {
      return captureFnRef.current ? captureFnRef.current() : null;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<ReportContextValue>(
    () => ({
      registerCapture,
      capture,
      setSolverResult,
      solverResult,
      setModuleMeta,
      moduleMeta,
      hasCanvas,
    }),
    [registerCapture, capture, solverResult, moduleMeta, hasCanvas],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Hook seguro: si un modulo se monta FUERA del provider (p.ej. en otra pagina),
 * devuelve un stub inerte en vez de crashear. Asi los modulos pueden llamar
 * useReport() sin asumir que el shell del lab esta presente.
 */
export function useReport(): ReportContextValue {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  return {
    registerCapture: () => {},
    capture: () => null,
    setSolverResult: () => {},
    solverResult: null,
    setModuleMeta: () => {},
    moduleMeta: null,
    hasCanvas: false,
  };
}
