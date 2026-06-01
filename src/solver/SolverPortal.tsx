/**
 * SolverPortal — el Resolvedor simbolico PASO A PASO de GAIA.
 *
 *   Filosofia (regla dura del proyecto): correccion matematica real, casos
 *   canonicos verificables, NADA de caja negra. El motor es TypeScript puro
 *   (src/solver/engine), asi cada paso es inspeccionable y exacto. Esta UI solo
 *   recoge la entrada, llama a `solve(...)` y dibuja los pasos con KaTeX.
 *
 *   "GAIA hace tu tarea, pero te ENSENA cada paso."
 */
import { useEffect, useState } from 'react';
import katex from 'katex';
import { solve } from './engine';
import type { Resultado, Paso } from './engine';

// ── Paleta GAIA ──────────────────────────────────────────────────────────────
const BG = '#05060A';
const ACCENT = '#4FC3F7'; // azul
const ACCENT2 = '#FDB813'; // ambar

type Modo = 'lineal' | 'determinante' | 'derivada' | 'integral';

const MODOS: { key: Modo; label: string; sub: string }[] = [
  { key: 'lineal', label: 'Sistema lineal', sub: 'Gauss-Jordan' },
  { key: 'determinante', label: 'Determinante', sub: 'reduccion triangular' },
  { key: 'derivada', label: 'Derivada', sub: 'd/dx' },
  { key: 'integral', label: 'Integral', sub: '∫ … dx' },
];

// ── Helpers de KaTeX ─────────────────────────────────────────────────────────
function tex(latex: string, displayMode = true): { __html: string } {
  try {
    return {
      __html: katex.renderToString(latex, { throwOnError: false, displayMode }),
    };
  } catch {
    return { __html: `<code>${latex}</code>` };
  }
}

function Math({ latex, display = true, className = '' }: { latex: string; display?: boolean; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={tex(latex, display)} />;
}

// ── Render de un paso ────────────────────────────────────────────────────────
function PasoCard({ paso, idx }: { paso: Paso; idx: number }) {
  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#0A0D14] px-5 py-4">
      <div className="flex items-baseline gap-3">
        <span
          className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-[12px] font-bold text-[#05060A] font-mono"
          style={{ background: ACCENT }}
        >
          {idx + 1}
        </span>
        <div className="text-[15px] font-semibold text-white">{paso.titulo}</div>
      </div>
      {paso.operacion && (
        <div className="mt-2 ml-10 inline-block rounded-md bg-[#0B0F17] border border-[#1E293B] px-3 py-1 text-[13px] font-mono text-[#FDB813]">
          {paso.operacion}
        </div>
      )}
      {paso.matrizLatex && (
        <div className="mt-3 ml-10 overflow-x-auto text-[#E2E8F0]">
          <Math latex={paso.matrizLatex} />
        </div>
      )}
      {paso.nota && <div className="mt-2 ml-10 text-[12px] text-[#94A3B8] leading-relaxed">{paso.nota}</div>}
    </div>
  );
}

// ── Rejilla editable de matriz/vector ────────────────────────────────────────
function MatrixEditor({
  rows,
  cols,
  matrix,
  vector,
  onMatrix,
  onVector,
  onResize,
}: {
  rows: number;
  cols: number;
  matrix: string[][];
  vector?: string[]; // si se pasa → modo sistema (columna b)
  onMatrix: (r: number, c: number, v: string) => void;
  onVector?: (r: number, v: string) => void;
  onResize: (n: number) => void;
}) {
  const cellCls =
    'w-14 h-11 rounded-md bg-[#05060A] border border-[#1E293B] text-center text-[14px] font-mono text-white outline-none focus:border-[#4FC3F7] transition';
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[12px] text-[#94A3B8] font-mono">Tamaño:</span>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => onResize(n)}
            className={`px-3 py-1 rounded-md text-[12px] font-mono border transition ${
              rows === n
                ? 'border-[#4FC3F7] text-[#4FC3F7] bg-[#4FC3F7]/10'
                : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155]'
            }`}
          >
            {n}×{n}
          </button>
        ))}
      </div>
      <div className="inline-flex items-center gap-3 rounded-xl border border-[#1E293B] bg-[#0A0D14] p-4">
        {/* bracket izquierdo */}
        <div className="text-[#334155] text-[44px] leading-none font-thin select-none">[</div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-2">
              {Array.from({ length: cols }).map((_, c) => (
                <input
                  key={c}
                  value={matrix[r]?.[c] ?? ''}
                  onChange={(e) => onMatrix(r, c, e.target.value)}
                  className={cellCls}
                  inputMode="text"
                  aria-label={`a${r + 1}${c + 1}`}
                />
              ))}
              {vector && onVector && (
                <>
                  <span className="mx-1 text-[#475569] text-[18px] font-mono">|</span>
                  <input
                    value={vector[r] ?? ''}
                    onChange={(e) => onVector(r, e.target.value)}
                    className={cellCls + ' border-[#3a2f12] focus:border-[#FDB813]'}
                    inputMode="text"
                    aria-label={`b${r + 1}`}
                  />
                </>
              )}
            </div>
          ))}
        </div>
        <div className="text-[#334155] text-[44px] leading-none font-thin select-none">]</div>
      </div>
    </div>
  );
}

// ── Estado inicial: los casos canonicos como ejemplos sembrados ──────────────
const SEED_LINEAL = {
  A: [
    ['2', '1', '-1'],
    ['-3', '-1', '2'],
    ['-2', '1', '2'],
  ],
  b: ['8', '-11', '-3'],
};
const SEED_DET = [
  ['6', '1', '1'],
  ['4', '-2', '5'],
  ['2', '8', '7'],
];

function emptyGrid(n: number, seed?: string[][]): string[][] {
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => seed?.[r]?.[c] ?? ''),
  );
}
function emptyVec(n: number, seed?: string[]): string[] {
  return Array.from({ length: n }, (_, r) => seed?.[r] ?? '');
}

function parseNum(s: string): number {
  const t = s.trim();
  if (t === '' || t === '-' || t === '+') return 0;
  // soporta fracciones simples "a/b" en la entrada
  if (t.includes('/')) {
    const [a, b] = t.split('/');
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb) && nb !== 0) return na / nb;
  }
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}

export default function SolverPortal() {
  const [modo, setModo] = useState<Modo>('lineal');

  // matrices
  const [n, setN] = useState(3);
  const [matLin, setMatLin] = useState<string[][]>(emptyGrid(3, SEED_LINEAL.A));
  const [vecLin, setVecLin] = useState<string[]>(emptyVec(3, SEED_LINEAL.b));
  const [matDet, setMatDet] = useState<string[][]>(emptyGrid(3, SEED_DET));

  // calculo
  const [exprDer, setExprDer] = useState('x*sin(x)');
  const [exprInt, setExprInt] = useState('2x+3');

  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState('');

  // El portal scrollea (main.css ata body a overflow:hidden para apps full-screen).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { ho: html.style.overflow, hh: html.style.height, bo: body.style.overflow, bh: body.style.height };
    html.style.overflow = 'auto';
    html.style.height = 'auto';
    body.style.overflow = 'auto';
    body.style.height = 'auto';
    return () => {
      html.style.overflow = prev.ho;
      html.style.height = prev.hh;
      body.style.overflow = prev.bo;
      body.style.height = prev.bh;
    };
  }, []);

  function resize(nuevo: number) {
    setN(nuevo);
    setMatLin((m) => Array.from({ length: nuevo }, (_, r) => Array.from({ length: nuevo }, (_, c) => m[r]?.[c] ?? '')));
    setVecLin((v) => Array.from({ length: nuevo }, (_, r) => v[r] ?? ''));
    setMatDet((m) => Array.from({ length: nuevo }, (_, r) => Array.from({ length: nuevo }, (_, c) => m[r]?.[c] ?? '')));
    setResultado(null);
    setError('');
  }

  function setMatLinCell(r: number, c: number, val: string) {
    setMatLin((m) => m.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? val : x)) : row)));
  }
  function setVecLinCell(r: number, val: string) {
    setVecLin((v) => v.map((x, ri) => (ri === r ? val : x)));
  }
  function setMatDetCell(r: number, c: number, val: string) {
    setMatDet((m) => m.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? val : x)) : row)));
  }

  function resolver() {
    setError('');
    setResultado(null);
    try {
      if (modo === 'lineal') {
        const A = matLin.map((row) => row.map(parseNum));
        const b = vecLin.map(parseNum);
        if (A.flat().some(Number.isNaN) || b.some(Number.isNaN)) {
          setError('Hay celdas con valores no numericos. Usa numeros enteros, decimales o fracciones a/b.');
          return;
        }
        setResultado(solve('lineal', { A, b }));
      } else if (modo === 'determinante') {
        const A = matDet.map((row) => row.map(parseNum));
        if (A.flat().some(Number.isNaN)) {
          setError('Hay celdas con valores no numericos. Usa numeros enteros, decimales o fracciones a/b.');
          return;
        }
        setResultado(solve('determinante', { A }));
      } else if (modo === 'derivada') {
        if (!exprDer.trim()) {
          setError('Escribe una expresion en x, por ejemplo  x^2 + 3x + 1.');
          return;
        }
        setResultado(solve('derivada', { expr: exprDer, variable: 'x' }));
      } else {
        if (!exprInt.trim()) {
          setError('Escribe una expresion en x, por ejemplo  2x + 3.');
          return;
        }
        setResultado(solve('integral', { expr: exprInt, variable: 'x' }));
      }
    } catch (e: any) {
      setError(e?.message ?? 'No pudimos resolver esta entrada.');
    }
  }

  const ejemplos: Record<Modo, string[]> = {
    lineal: [],
    determinante: [],
    derivada: ['x^3', 'x^2 + 3x + 1', 'sin(x)', 'x*sin(x)', 'exp(x)*cos(x)'],
    integral: ['x^2', '2x + 3', 'cos(x)', '1/x', 'exp(x)'],
  };

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-x-hidden">
      {/* Ambient lights */}
      <div
        className="fixed top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-20 blur-[130px]"
        style={{ background: 'radial-gradient(circle, #4FC3F7 0%, transparent 70%)' }}
      />
      <div
        className="fixed bottom-[-25%] left-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none opacity-15 blur-[130px]"
        style={{ background: 'radial-gradient(circle, #FDB813 0%, transparent 70%)' }}
      />

      {/* Header */}
      <header className="relative z-10 px-6 py-6 max-w-[1100px] mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center font-bold text-[#05060A] text-[20px]"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
          >
            Γ
          </div>
          <div>
            <div className="text-[16px] font-bold tracking-tight">GAIA · Resolvedor</div>
            <div className="text-[10px] text-[#64748B] uppercase tracking-[0.2em]">paso a paso, sin caja negra</div>
          </div>
        </a>
        <div className="flex items-center gap-4 text-[12px] font-mono">
          <a href="/escuela.html" className="text-[#94A3B8] hover:text-white transition">
            ← Escuela
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-[820px] mx-auto px-6 pt-8 pb-8 text-center">
        <h1 className="text-[40px] md:text-[56px] font-extrabold leading-none tracking-tight text-white">
          GAIA hace tu tarea —<br className="hidden md:block" /> y te{' '}
          <span style={{ color: ACCENT2 }}>enseña</span> cada paso.
        </h1>
        <p className="mt-5 text-[15px] text-[#94A3B8] max-w-[620px] mx-auto leading-relaxed">
          Aritmetica racional <span className="text-[#E2E8F0]">exacta</span> (sin redondeos) y derivadas/integrales
          con reglas explicitas. No es una caja negra: cada renglon de la solucion es inspeccionable.
        </p>
      </section>

      {/* Selector de operacion */}
      <section className="relative z-10 max-w-[920px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MODOS.map((m) => {
            const active = modo === m.key;
            return (
              <button
                key={m.key}
                onClick={() => {
                  setModo(m.key);
                  setResultado(null);
                  setError('');
                }}
                className={`rounded-xl px-4 py-3 text-left border transition ${
                  active
                    ? 'border-[#4FC3F7] bg-[#4FC3F7]/10'
                    : 'border-[#1E293B] bg-[#0A0D14] hover:border-[#334155]'
                }`}
              >
                <div className={`text-[14px] font-semibold ${active ? 'text-white' : 'text-[#CBD5E1]'}`}>
                  {m.label}
                </div>
                <div className="text-[11px] font-mono text-[#64748B] mt-0.5">{m.sub}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Entrada */}
      <section className="relative z-10 max-w-[920px] mx-auto px-6 pt-7">
        <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-6">
          {modo === 'lineal' && (
            <>
              <div className="text-[13px] text-[#94A3B8] mb-4 leading-relaxed">
                Sistema <span className="font-mono text-[#E2E8F0]">A·x = b</span>. La columna ambar (a la derecha de la
                barra) es <span className="font-mono text-[#FDB813]">b</span>. Se resuelve por Gauss-Jordan exacto.
              </div>
              <MatrixEditor
                rows={n}
                cols={n}
                matrix={matLin}
                vector={vecLin}
                onMatrix={setMatLinCell}
                onVector={setVecLinCell}
                onResize={resize}
              />
              <div className="mt-5">
                <a
                  href="/math.html"
                  className="inline-flex items-center gap-1.5 text-[13px] font-mono transition hover:opacity-80"
                  style={{ color: ACCENT }}
                >
                  Ver la intuicion 3D →
                </a>
              </div>
            </>
          )}

          {modo === 'determinante' && (
            <>
              <div className="text-[13px] text-[#94A3B8] mb-4 leading-relaxed">
                Determinante de una matriz cuadrada, por reduccion triangular (registrando el signo). Valor{' '}
                <span className="text-[#E2E8F0]">exacto</span>.
              </div>
              <MatrixEditor rows={n} cols={n} matrix={matDet} onMatrix={setMatDetCell} onResize={resize} />
            </>
          )}

          {(modo === 'derivada' || modo === 'integral') && (
            <>
              <div className="text-[13px] text-[#94A3B8] mb-3 leading-relaxed">
                {modo === 'derivada' ? (
                  <>
                    Derivada respecto a <span className="font-mono text-[#E2E8F0]">x</span>. Funciones: sin, cos, tan,
                    exp, ln, sqrt. Operadores <span className="font-mono">+ - * / ^</span> y parentesis.
                  </>
                ) : (
                  <>
                    Integral indefinida respecto a <span className="font-mono text-[#E2E8F0]">x</span> (linealidad +
                    tabla basica + sustitucion lineal). Siempre <span className="font-mono">+ C</span>.
                  </>
                )}
              </div>
              <div className="flex items-stretch gap-2">
                <span className="grid place-items-center px-3 rounded-l-xl bg-[#05060A] border border-r-0 border-[#1E293B] text-[#64748B] font-mono text-[14px]">
                  {modo === 'derivada' ? 'd/dx' : '∫'}
                </span>
                <input
                  value={modo === 'derivada' ? exprDer : exprInt}
                  onChange={(e) => (modo === 'derivada' ? setExprDer(e.target.value) : setExprInt(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && resolver()}
                  placeholder={modo === 'derivada' ? 'x*sin(x)' : '2x + 3'}
                  className="flex-1 px-4 py-3 bg-[#05060A] border border-[#1E293B] text-white text-[15px] font-mono outline-none focus:border-[#4FC3F7] transition"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {modo === 'integral' && (
                  <span className="grid place-items-center px-3 rounded-r-xl bg-[#05060A] border border-l-0 border-[#1E293B] text-[#64748B] font-mono text-[14px]">
                    dx
                  </span>
                )}
                {modo === 'derivada' && (
                  <span className="grid place-items-center px-3 rounded-r-xl bg-[#05060A] border border-l-0 border-[#1E293B] text-[#64748B] font-mono text-[14px]">
                    )
                  </span>
                )}
              </div>
              {ejemplos[modo].length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-[#64748B] font-mono">ejemplos:</span>
                  {ejemplos[modo].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => (modo === 'derivada' ? setExprDer(ex) : setExprInt(ex))}
                      className="px-2.5 py-1 rounded-md text-[12px] font-mono border border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-[#CBD5E1] transition"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Boton Resolver */}
          <button
            onClick={resolver}
            className="mt-6 w-full md:w-auto px-8 py-3 rounded-xl font-semibold text-[15px] text-[#05060A] transition hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` }}
          >
            Resolver
          </button>

          {error && (
            <div className="mt-4 rounded-lg border border-[#FB7185]/40 bg-[#FB7185]/10 px-4 py-3 text-[13px] text-[#FECDD3]">
              {error}
            </div>
          )}
        </div>
      </section>

      {/* Resultado */}
      {resultado && (
        <section className="relative z-10 max-w-[920px] mx-auto px-6 pt-8 pb-16">
          <ResultadoVista resultado={resultado} />
        </section>
      )}

      {!resultado && (
        <section className="relative z-10 max-w-[920px] mx-auto px-6 pt-8 pb-16 text-center">
          <p className="text-[12px] text-[#475569] font-mono">
            Los pasos aparecen aqui. Cada operacion es exacta y verificable.
          </p>
        </section>
      )}

      <footer className="relative z-10 border-t border-[#0F172A] py-6 text-center text-[11px] text-[#475569] font-mono">
        Γ GAIA · Resolvedor paso a paso · matematicas que se ven, no que se creen
      </footer>
    </div>
  );
}

// ── Vista del resultado segun la operacion ───────────────────────────────────
function ResultadoVista({ resultado }: { resultado: Resultado }) {
  const pasos = resultado.pasos;

  // Encabezado / respuesta final segun el tipo de operacion.
  let titulo = '';
  let respuesta: React.ReactNode = null;
  let advertencia: React.ReactNode = null;

  switch (resultado.op) {
    case 'lineal': {
      titulo = 'Sistema lineal · Gauss-Jordan';
      if (resultado.tipo === 'unica' && resultado.solucion) {
        const latex = resultado.solucion.map((f, i) => `x_{${i + 1}} = ${f.toLatex()}`).join(', \\quad ');
        respuesta = <Math latex={latex} />;
      } else if (resultado.tipo === 'infinitas') {
        respuesta = <span className="text-[#FDB813] font-semibold">Infinitas soluciones</span>;
        advertencia = resultado.nota ? <span>{resultado.nota}</span> : null;
      } else {
        respuesta = <span className="text-[#FB7185] font-semibold">El sistema no tiene solucion</span>;
        advertencia = resultado.nota ? <span>{resultado.nota}</span> : null;
      }
      break;
    }
    case 'determinante': {
      titulo = 'Determinante';
      respuesta = <Math latex={`\\det(A) = ${resultado.valor.toLatex()}`} />;
      break;
    }
    case 'derivada':
    case 'integral': {
      titulo = resultado.op === 'derivada' ? 'Derivada' : 'Integral indefinida';
      if (!resultado.soportado) {
        respuesta = <span className="text-[#FB7185] font-semibold">No soportado todavia</span>;
        advertencia = (
          <span>{resultado.nota ?? 'Esta expresion sale del alcance del motor. No inventamos un resultado.'}</span>
        );
      } else if (resultado.resultadoLatex) {
        respuesta = <Math latex={resultado.resultadoLatex} />;
      }
      break;
    }
  }

  return (
    <div>
      {/* Respuesta destacada */}
      <div className="rounded-2xl border border-[#4FC3F7]/30 bg-[#0A0D14] p-6 mb-6">
        <div className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">{titulo} · respuesta</div>
        <div className="mt-3 text-[#E2E8F0] overflow-x-auto">{respuesta}</div>
        {advertencia && <div className="mt-3 text-[13px] text-[#94A3B8] leading-relaxed">{advertencia}</div>}
      </div>

      {/* Pasos */}
      {pasos.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-[#1E293B]" />
            <span className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">
              {pasos.length} paso{pasos.length === 1 ? '' : 's'}
            </span>
            <div className="h-px flex-1 bg-[#1E293B]" />
          </div>
          <div className="space-y-3">
            {pasos.map((p, i) => (
              <PasoCard key={i} paso={p} idx={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
