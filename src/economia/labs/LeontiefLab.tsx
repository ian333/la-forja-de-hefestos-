/**
 * LeontiefLab — laboratorio del premio 1973 (Wassily Leontief).
 *
 * El click: la economía NO es suma de mercados independientes.
 * Es una red de dominós: jala uno y todos se mueven.
 * Leontief la dibujó con álgebra lineal (1941) y la llamó análisis input-output.
 *
 * Matemática REAL:
 *   Economía con N sectores. Cada sector i produce xᵢ unidades.
 *   La matriz técnica A: aᵢⱼ = cuántas unidades del sector i
 *     consume el sector j para producir 1 unidad.
 *
 *   Demanda final d (del consumidor + gobierno + exportaciones).
 *   Balance: producción = insumos + demanda final
 *     x = A·x + d   →   (I − A)·x = d   →   x = L·d,  L = (I − A)⁻¹
 *
 *   L es la matriz de Leontief (inversa). Lᵢⱼ = cuántas unidades
 *   del sector i hay que producir para entregar 1 unidad final del sector j.
 *
 *   Multiplicador de producción del sector j: mⱼ = ΣᵢLᵢⱼ
 *   (cuánto se activa en TODA la economía por 1 unidad extra de demanda en j).
 *
 *   Shock: si el sector k sufre una restricción de oferta (aumento de costo),
 *   se traslada como un vector de variación Δd → Δx = L·Δd.
 *
 * El usuario puede jalar un sector (slider de choque de oferta) y ver
 * en tiempo real cuánto cae la producción de CADA sector, con la
 * propagación calculada exactamente con L.
 */

import { useEffect, useRef, useState, useMemo } from 'react';

// ── Dimensiones del canvas ──────────────────────────────────────────────────
const W = 820;
const H = 400;

// ── Sectores de la economía (6 sectores representativos de México) ──────────
const SECTORS = [
  { id: 0, name: 'Energía',      emoji: '⚡', color: '#FDB813' },
  { id: 1, name: 'Acero',        emoji: '🔩', color: '#94A3B8' },
  { id: 2, name: 'Autos',        emoji: '🚗', color: '#4FC3F7' },
  { id: 3, name: 'Alimentos',    emoji: '🌽', color: '#34D399' },
  { id: 4, name: 'Servicios',    emoji: '🏢', color: '#A78BFA' },
  { id: 5, name: 'Construcción', emoji: '🏗', color: '#FB923C' },
] as const;

type SectorId = 0 | 1 | 2 | 3 | 4 | 5;
const N = SECTORS.length;

/**
 * Matriz técnica A (coeficientes input-output calibrados en estructura
 * aproximada de la tabla de Insumo-Producto de México, INEGI 2018).
 * aᵢⱼ = fracción de insumos del sector i que usa el sector j por unidad producida.
 * Filas = productor del insumo, Columnas = sector que lo consume.
 *
 * Cada columna debe sumar < 1 para que (I−A) sea invertible (Hawkins-Simon).
 */
const A_BASE: number[][] = [
  // Energía  Acero  Autos  Alim.  Serv.  Constr.
  [ 0.05,   0.12,  0.06,  0.04,  0.03,  0.08  ],  // Energía
  [ 0.01,   0.08,  0.18,  0.01,  0.01,  0.22  ],  // Acero
  [ 0.00,   0.02,  0.05,  0.01,  0.01,  0.04  ],  // Autos
  [ 0.02,   0.01,  0.01,  0.12,  0.05,  0.02  ],  // Alimentos
  [ 0.06,   0.05,  0.08,  0.07,  0.12,  0.09  ],  // Servicios
  [ 0.01,   0.03,  0.01,  0.01,  0.02,  0.06  ],  // Construcción
];

/** Demanda final base (relativa) de cada sector. */
const D_BASE: number[] = [0.20, 0.12, 0.18, 0.30, 0.15, 0.05];

// ── Álgebra lineal mínima (sin dependencias de Node) ──────────────────────


function matVec(M: number[][], v: number[]): number[] {
  return M.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
}

function eye(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))
  );
}

/**
 * Invierte una matriz n×n por eliminación de Gauss con pivoteo parcial.
 * Devuelve null si la matriz es singular.
 */
function invertMatrix(M: number[][]): number[][] | null {
  const n = M.length;
  const a = M.map(row => [...row]);
  const b = eye(n);
  for (let col = 0; col < n; col++) {
    // Pivoteo parcial
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(a[row][col]) > Math.abs(a[maxRow][col])) maxRow = row;
    [a[col], a[maxRow]] = [a[maxRow], a[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];
    const pivot = a[col][col];
    if (Math.abs(pivot) < 1e-12) return null;
    for (let j = 0; j < n; j++) { a[col][j] /= pivot; b[col][j] /= pivot; }
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = 0; j < n; j++) {
        a[row][j] -= factor * a[col][j];
        b[row][j] -= factor * b[col][j];
      }
    }
  }
  return b;
}

/**
 * Calcula la matriz de Leontief L = (I − A)⁻¹.
 * Los multiplicadores de producción son las sumas de columnas de L.
 */
function leontiefMatrix(A: number[][]): number[][] {
  const n = A.length;
  const IminA = eye(n).map((row, i) =>
    row.map((v, j) => v - A[i][j])
  );
  return invertMatrix(IminA) ?? eye(n);
}

// ── Componente principal ────────────────────────────────────────────────────

export default function LeontiefLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // shock[k] ∈ [-1, 0]: reducción porcentual de demanda final del sector k
  const [shocks, setShocks] = useState<number[]>(Array(N).fill(0));
  const [highlightSector, setHighlightSector] = useState<SectorId | null>(null);

  // Calcular L y resultados cada vez que cambian los shocks
  const result = useMemo(() => {
    const L = leontiefMatrix(A_BASE);

    // Producción base: x₀ = L · d_base
    const x0 = matVec(L, D_BASE);

    // Demanda con shocks: dk' = dk · (1 + shock[k])
    const dShocked = D_BASE.map((d, k) => d * (1 + shocks[k]));

    // Producción con shocks: x' = L · d'
    const x1 = matVec(L, dShocked);

    // Variación porcentual por sector
    const pct = x0.map((v, i) => (v > 1e-9 ? (x1[i] - v) / v : 0));

    // Multiplicadores de producción (suma de columnas de L)
    const multipliers = Array.from({ length: N }, (_, j) =>
      L.reduce((s, row) => s + row[j], 0)
    );

    return { L, x0, x1, pct, multipliers };
  }, [shocks]);

  // Refs para paso al canvas
  const resultRef = useRef(result);
  const highlightRef = useRef<SectorId | null>(null);
  useEffect(() => { resultRef.current = result; }, [result]);
  useEffect(() => { highlightRef.current = highlightSector; }, [highlightSector]);

  // ── Loop de animación ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;

    // Posiciones de los 6 nodos en el canvas (hexágono)
    const cx = W / 2, cy = H / 2 - 10;
    const R = 140;
    const nodePos: Array<{ x: number; y: number }> = SECTORS.map((_, i) => ({
      x: cx + R * Math.cos((i / N) * 2 * Math.PI - Math.PI / 2),
      y: cy + R * Math.sin((i / N) * 2 * Math.PI - Math.PI / 2),
    }));

    function drawArrow(
      x1: number, y1: number,
      x2: number, y2: number,
      width: number, color: string, alpha: number
    ) {
      if (alpha < 0.02) return;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;
      const ux = dx / len, uy = dy / len;
      const nodeR = 28;
      // Acortar extremos para no entrar al círculo del nodo
      const sx = x1 + ux * nodeR, sy = y1 + uy * nodeR;
      const ex = x2 - ux * nodeR, ey = y2 - uy * nodeR;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // Punta
      const headLen = 8 + width;
      const angle = Math.atan2(ey - sy, ex - sx);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(angle - 0.4), ey - headLen * Math.sin(angle - 0.4));
      ctx.lineTo(ex - headLen * Math.cos(angle + 0.4), ey - headLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function draw() {
      if (!ctx) return;
      const { pct } = resultRef.current;
      const hl = highlightRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Aristas — flujos input-output
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          // El flujo del sector i al sector j está representado por A[i][j]
          // (insumo del sector i que requiere j).
          const flow = A_BASE[i][j];
          if (flow < 0.005) continue;
          const isActive = hl === null || hl === i || hl === j;
          const alpha = isActive ? Math.min(0.85, flow * 5) : 0.06;
          const w = Math.max(0.8, flow * 10);
          // Color del sector proveedor
          drawArrow(
            nodePos[i].x, nodePos[i].y,
            nodePos[j].x, nodePos[j].y,
            w, SECTORS[i].color, alpha
          );
        }
      }

      // Nodos
      for (let i = 0; i < N; i++) {
        const { x, y } = nodePos[i];
        const sec = SECTORS[i];
        const shock = pct[i];
        const isHL = hl === i;
        const nodeR = 28;

        // Glow proporcional al shock (rojo = baja, verde = sube)
        if (Math.abs(shock) > 0.005) {
          ctx.save();
          ctx.shadowColor = shock < 0 ? '#EF4444' : '#34D399';
          ctx.shadowBlur = 20 + Math.abs(shock) * 40;
          ctx.beginPath();
          ctx.arc(x, y, nodeR + 2, 0, Math.PI * 2);
          ctx.fillStyle = shock < 0
            ? `rgba(239,68,68,${Math.min(0.3, Math.abs(shock) * 0.6)})`
            : `rgba(52,211,153,${Math.min(0.3, shock * 0.6)})`;
          ctx.fill();
          ctx.restore();
        }

        // Círculo base
        ctx.save();
        if (isHL) { ctx.shadowColor = sec.color; ctx.shadowBlur = 18; }
        const grad = ctx.createRadialGradient(x - 7, y - 7, 3, x, y, nodeR);
        grad.addColorStop(0, sec.color + 'DD');
        grad.addColorStop(1, sec.color + '44');
        ctx.beginPath();
        ctx.arc(x, y, nodeR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = isHL ? sec.color : sec.color + '88';
        ctx.lineWidth = isHL ? 2.5 : 1.5;
        ctx.stroke();
        ctx.restore();

        // Emoji
        ctx.font = '16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sec.emoji, x, y - 5);

        // Nombre abreviado
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(sec.name, x, y + 8);

        // Variación %
        if (Math.abs(shock) > 0.003) {
          const sign = shock > 0 ? '+' : '';
          ctx.font = 'bold 10px ui-monospace, monospace';
          ctx.fillStyle = shock < 0 ? '#EF4444' : '#34D399';
          ctx.fillText(`${sign}${(shock * 100).toFixed(1)}%`, x, y + nodeR + 13);
        }
      }

      // Título/leyenda
      ctx.font = 'bold 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#64748B';
      ctx.fillText('Red de insumo-producto · Leontief 1973', W / 2, 6);

      // Leyenda de flujos
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.fillText('→ flujo de insumos entre sectores  |  % = cambio en producción total', 8, H - 14);

      ctx.textBaseline = 'alphabetic';

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const setShock = (k: number, v: number) => {
    setShocks(prev => { const next = [...prev]; next[k] = v; return next; });
  };
  const resetShocks = () => setShocks(Array(N).fill(0));

  // ── Insight dinámico ─────────────────────────────────────────────────────
  const { pct, multipliers } = result;
  const maxDrop = Math.min(...pct);
  const maxDropIdx = pct.indexOf(maxDrop);
  const activeShocks = shocks.filter(s => s !== 0).length;

  const insight = activeShocks === 0
    ? 'Aplica un choque a cualquier sector con el slider. La red no se rompe un solo eslabón — se sacude TODA.'
    : maxDrop < -0.01
      ? `El sector más golpeado es ${SECTORS[maxDropIdx].name} (${(maxDrop * 100).toFixed(1)}%), aunque tú solo movieras otro. Eso es la propagación de Leontief: el efecto viaja por la red de insumos.`
      : 'Los choques son tan pequeños que apenas se notan en cadena. Sube algún slider para ver la propagación.';

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Canvas */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botón reset */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={resetShocks}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              ↺ reiniciar choques
            </button>
            <span className="text-[11px] text-[#475569] font-mono">
              x = L · d  ,  L = (I − A)⁻¹
            </span>
          </div>

          {/* Tabla de producción */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {SECTORS.map((s, i) => {
              const now = result.x1[i];
              const delta = pct[i];
              const isNeg = delta < -0.003;
              const isPos = delta > 0.003;
              return (
                <div
                  key={s.id}
                  className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-2 cursor-pointer transition hover:border-[#334155]"
                  style={{ borderColor: highlightSector === i ? s.color + '88' : undefined }}
                  onMouseEnter={() => setHighlightSector(i as SectorId)}
                  onMouseLeave={() => setHighlightSector(null)}
                >
                  <div className="text-[9px] uppercase tracking-[0.15em] text-[#64748B] font-mono mb-0.5">{s.emoji} {s.name}</div>
                  <div className="text-[15px] font-bold font-mono" style={{ color: s.color }}>
                    {now.toFixed(3)}
                  </div>
                  <div
                    className="text-[10px] font-mono"
                    style={{ color: isNeg ? '#EF4444' : isPos ? '#34D399' : '#64748B' }}
                  >
                    {isNeg ? '' : isPos ? '+' : ''}
                    {delta !== 0 ? `${(delta * 100).toFixed(1)}%` : 'sin cambio'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Panel de control */}
        <div className="space-y-4 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Choques de oferta
          </div>
          <div className="text-[11px] text-[#64748B] leading-snug mb-2">
            Mueve un slider hacia la izquierda para simular que ese sector produce menos
            (crisis, escasez, guerra). Ve cómo cae TODA la red.
          </div>

          {SECTORS.map((s, i) => {
            const shock = shocks[i];
            const pctDisplay = (shock * 100).toFixed(0);
            return (
              <div key={s.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    className="text-[12px] font-medium cursor-pointer"
                    style={{ color: s.color }}
                    onMouseEnter={() => setHighlightSector(i as SectorId)}
                    onMouseLeave={() => setHighlightSector(null)}
                  >
                    {s.emoji} {s.name}
                  </label>
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: shock < -0.005 ? '#EF4444' : shock > 0.005 ? '#34D399' : '#475569' }}
                  >
                    {shock >= 0 ? '+' : ''}{pctDisplay}%
                  </span>
                </div>
                <input
                  type="range"
                  min={-0.8}
                  max={0.5}
                  step={0.01}
                  value={shock}
                  onChange={e => setShock(i, Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: s.color }}
                  onMouseEnter={() => setHighlightSector(i as SectorId)}
                  onMouseLeave={() => setHighlightSector(null)}
                />
              </div>
            );
          })}

          <div className="border-t border-[#1E293B] pt-3 space-y-1">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#94A3B8] font-mono mb-2">
              Multiplicadores de producción
            </div>
            {SECTORS.map((s, i) => (
              <div key={s.id} className="flex justify-between items-center">
                <span className="text-[10px] text-[#64748B] font-mono">{s.emoji} {s.name}</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${Math.round(multipliers[i] * 20)}px`,
                      backgroundColor: s.color,
                      opacity: 0.7,
                    }}
                  />
                  <span className="text-[10px] font-mono" style={{ color: s.color }}>
                    {multipliers[i].toFixed(2)}×
                  </span>
                </div>
              </div>
            ))}
            <p className="text-[9px] text-[#334155] pt-1 leading-snug">
              Multiplicador = cuánto activa toda la economía 1 unidad extra de demanda en ese sector
              (suma de columna de la inversa de Leontief).
            </p>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            Leontief, The Structure of the American Economy 1919–1939 (1941)<br />
            x = (I − A)⁻¹ · d · comité Nobel 1973
          </div>
        </div>
      </div>
    </div>
  );
}
