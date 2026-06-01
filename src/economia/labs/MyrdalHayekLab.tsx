/**
 * MyrdalHayekLab — laboratorio del premio Nobel 1974 (Myrdal + Hayek).
 *
 * El click: "Nadie sabe hacer un taco. Y aun así, hoy comiste uno."
 * El mercado es una red de señales de precios. Cuando un insumo escasea,
 * el precio sube y TODOS los agentes de la cadena reaccionan sin que nadie
 * les avise. Eso es el "orden espontáneo" de Hayek.
 *
 * Modelo real:
 *   - N nodos (productores/mercados) en una red. Cada nodo i tiene:
 *       q_i(t): inventario actual
 *       p_i(t): precio local
 *   - Dinámica de precio local (tatônnement extendido en red):
 *       dp_i/dt = κ · (D_i − q_i)   donde D_i = demanda base (parámetro)
 *   - Flujo entre nodos (arbitraje): cuando p_j > p_i + τ (costo de transporte),
 *       q_i decrece y q_j aumenta; el diferencial de precio es la "señal".
 *       dq_i/dt = Σ_j  flow_ij  + producción_i − demanda_i
 *   - Shock: un nodo productor pierde inventario (cosecha helada).
 *     Con precios libres: la señal se propaga y el sistema busca nuevo equilibrio.
 *     Con precio topado:  p_i fijado ≤ p_tope → el flujo no se activa → el nodo
 *                         agota inventario → escasez acumulada.
 *
 * Visualización 2D: grafo de nodos con tamaño proporcional a inventario,
 * color=precio, aristas animadas mostrando flujo activo.
 */

import { useEffect, useRef, useState } from 'react';

// ── Constantes de layout ──────────────────────────────────────────────────────
const W = 820;
const H = 380;
const STEP = 1 / 60;        // paso fijo de simulación (segundos)
const N = 8;                 // número de nodos en la red
const KAPPA = 0.8;           // velocidad de ajuste de precio (tatônnement)
const TRANSPORT = 0.3;       // costo de transporte (umbral de arbitraje)
const FLOW_K = 1.4;          // velocidad de flujo de inventario entre nodos
const PROD_BASE = 0.25;      // producción base por nodo (unidades/s)
const DEM_BASE = 0.22;       // demanda base por nodo (unidades/s)
const Q_MAX = 10;            // inventario máximo (para normalización visual)
const P_MIN = 0.1;
const P_MAX_VAL = 6;
const SHOCK_LOSS = 6.0;      // pérdida de inventario del nodo shockeado

// ── Posiciones fijas de los nodos (coordenadas canvas CSS) ───────────────────
const NODE_POS: Array<[number, number]> = [
  [130, 80],    // 0 productor maíz (norte)
  [400, 55],    // 1 distribuidor central
  [670, 80],    // 2 productor aguacate (noroeste)
  [90,  210],   // 3 tianguis local
  [300, 195],   // 4 súper / intermediario
  [530, 200],   // 5 mercado regional
  [710, 210],   // 6 exportador
  [400, 315],   // 7 consumidor final (taquero)
];

const NODE_LABELS = [
  'maíz', 'distribu­dor', 'aguacate', 'tianguis',
  'súper', 'regional', 'expor­tador', 'TAQUERO',
];

// Aristas (pares de nodos conectados)
const EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [0, 3], [1, 4], [2, 5], [2, 6],
  [3, 4], [4, 5], [4, 7], [5, 7],
];

// Nodo productor principal (se puede shockear)
const SHOCK_NODE = 0;

// ── Estado de la simulación ───────────────────────────────────────────────────
interface NodeState {
  q: number;    // inventario
  p: number;    // precio
  excess: number; // escasez acumulada (solo con tope)
}

interface Params {
  priceCap: boolean;
  capLevel: number;
  demandBoost: number; // multiplicador de demanda 0.5..2.0
  paused: boolean;
}

function initNodes(): NodeState[] {
  return Array.from({ length: N }, (_, i) => ({
    q: 4 + (i % 3),
    p: 1.2 + (i * 0.15),
    excess: 0,
  }));
}

// ── Funciones de cálculo ──────────────────────────────────────────────────────

/** Flujo neto de inventario desde nodo j hacia nodo i a través de una arista.
 *  Solo fluye cuando el diferencial de precio supera el costo de transporte. */
function edgeFlow(pi: number, pj: number, qi: number, qj: number, capOn: boolean, cap: number): number {
  const pEff_i = capOn ? Math.min(pi, cap) : pi;
  const pEff_j = capOn ? Math.min(pj, cap) : pj;
  const diff = pEff_j - pEff_i;  // j más caro → fluye de j a i (barato hacia caro)
  if (diff > TRANSPORT && qj > 0.05) {
    return FLOW_K * (diff - TRANSPORT) * Math.min(qj, 1);
  }
  if (diff < -TRANSPORT && qi > 0.05) {
    return -FLOW_K * (-diff - TRANSPORT) * Math.min(qi, 1);
  }
  return 0;
}

function simulate(
  nodes: NodeState[],
  params: Params,
  dt: number,
): NodeState[] {
  const { priceCap, capLevel, demandBoost } = params;
  const next: NodeState[] = nodes.map(n => ({ ...n }));

  // Calcular flujos por arista
  const flowTo: number[] = Array(N).fill(0);
  for (const [a, b] of EDGES) {
    const f = edgeFlow(
      nodes[a].p, nodes[b].p,
      nodes[a].q, nodes[b].q,
      priceCap, capLevel,
    );
    // f > 0 → fluye de b→a; f < 0 → fluye de a→b
    flowTo[a] += f;
    flowTo[b] -= f;
  }

  for (let i = 0; i < N; i++) {
    const n = nodes[i];
    // Producción local y demanda
    const prod = PROD_BASE;
    const dem = DEM_BASE * demandBoost;

    // Actualizar inventario
    let dq = (prod - dem + flowTo[i]) * dt;
    next[i].q = Math.max(0, Math.min(Q_MAX, n.q + dq));

    // Precio: sube cuando escasea, baja cuando sobra (tatônnement)
    const excessDemand = dem - prod - flowTo[i] / Math.max(0.1, n.q);
    let dp = KAPPA * excessDemand * dt;
    let pNew = n.p + dp;
    pNew = Math.max(P_MIN, Math.min(P_MAX_VAL, pNew));

    if (priceCap) {
      // Con tope: el precio visible queda capado
      const effective = Math.min(pNew, capLevel);
      next[i].p = effective;
      // Escasez acumulada: cuánto faltó (precio "de sombra" sobre tope)
      const shadow = Math.max(0, pNew - capLevel);
      next[i].excess = Math.min(20, n.excess + shadow * dt);
    } else {
      next[i].p = pNew;
      next[i].excess = Math.max(0, n.excess - 0.5 * dt); // se disipa con mercado libre
    }
  }

  return next;
}

// ── Utilidades de dibujo ──────────────────────────────────────────────────────

/** Color del nodo según precio (azul frío=barato, naranja/rojo=caro). */
function priceColor(p: number, excess: number): string {
  // Si hay escasez acumulada, tiñe el nodo de rojo profundo
  if (excess > 0.5) {
    const t = Math.min(1, excess / 8);
    const r = Math.round(100 + t * 155);
    const g = Math.round(20 * (1 - t));
    const b = Math.round(20 * (1 - t));
    return `rgb(${r},${g},${b})`;
  }
  const t = (p - P_MIN) / (P_MAX_VAL - P_MIN);
  const r = Math.round(20 + t * 220);
  const g = Math.round(180 - t * 120);
  const b = Math.round(230 - t * 180);
  return `rgb(${r},${g},${b})`;
}

/** Radio del nodo según inventario. */
function nodeRadius(q: number): number {
  return 10 + (q / Q_MAX) * 16;
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Params2 extends Params {
  shockActive: boolean;
}

export default function MyrdalHayekLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NodeState[]>(initNodes());
  const paramsRef = useRef<Params2>({
    priceCap: false,
    capLevel: 1.8,
    demandBoost: 1.0,
    paused: false,
    shockActive: false,
  });

  const [priceCap, setPriceCap] = useState(false);
  const [capLevel, setCapLevel] = useState(1.8);
  const [demandBoost, setDemandBoost] = useState(1.0);
  const [paused, setPaused] = useState(false);
  const [shockActive, setShockActive] = useState(false);
  const [stats, setStats] = useState({
    avgP: 0,
    totalExcess: 0,
    flowCount: 0,
  });

  // Sync params ref
  useEffect(() => {
    paramsRef.current = { priceCap, capLevel, demandBoost, paused, shockActive };
  }, [priceCap, capLevel, demandBoost, paused, shockActive]);

  // Aplicar shock cuando se activa
  useEffect(() => {
    if (shockActive) {
      const n = nodesRef.current;
      n[SHOCK_NODE] = { ...n[SHOCK_NODE], q: Math.max(0, n[SHOCK_NODE].q - SHOCK_LOSS) };
    }
  }, [shockActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frame = 0;

    function draw(nodes: NodeState[], p: Params2) {
      if (!ctx) return;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Calcular flujos para animar aristas
      const flowList: Array<{ a: number; b: number; f: number }> = [];
      for (const [a, b] of EDGES) {
        const f = edgeFlow(
          nodes[a].p, nodes[b].p,
          nodes[a].q, nodes[b].q,
          p.priceCap, p.capLevel,
        );
        flowList.push({ a, b, f });
      }

      // Dibujar aristas
      for (const { a, b, f } of flowList) {
        const [ax, ay] = NODE_POS[a];
        const [bx, by] = NODE_POS[b];
        const active = Math.abs(f) > 0.01;
        ctx.save();
        ctx.globalAlpha = active ? 0.9 : 0.18;
        ctx.strokeStyle = active
          ? (f > 0 ? '#34D399' : '#F472B6')
          : '#334155';
        ctx.lineWidth = active ? 2.5 + Math.abs(f) * 1.2 : 1.2;
        ctx.setLineDash(active ? [] : [4, 6]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Flecha de dirección en la mitad
        if (active) {
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          const ang = f > 0
            ? Math.atan2(ay - by, ax - bx)  // fluye b→a
            : Math.atan2(by - ay, bx - ax); // fluye a→b
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(ang);
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = f > 0 ? '#34D399' : '#F472B6';
          ctx.beginPath();
          ctx.moveTo(-5, -4);
          ctx.lineTo(5, 0);
          ctx.lineTo(-5, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Dibujar nodos
      for (let i = 0; i < N; i++) {
        const [x, y] = NODE_POS[i];
        const nd = nodes[i];
        const r = nodeRadius(nd.q);
        const col = priceColor(nd.p, nd.excess);

        // Halo de glow
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = nd.excess > 0.5 ? 28 : 14;

        // Círculo del nodo
        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        grad.addColorStop(0, col);
        grad.addColorStop(1, '#0B0F17');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Borde
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Etiqueta del nodo
        ctx.fillStyle = '#E2E8F0';
        ctx.font = `bold 9.5px ui-sans-serif, system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(NODE_LABELS[i].toUpperCase(), x, y + r + 12);

        // Precio encima
        ctx.fillStyle = col;
        ctx.font = `bold 10px ui-monospace, monospace`;
        ctx.fillText(`$${nd.p.toFixed(2)}`, x, y - r - 5);

        // Indicador de escasez
        if (nd.excess > 0.5) {
          ctx.fillStyle = '#EF4444';
          ctx.font = `bold 9px ui-sans-serif, system-ui`;
          ctx.fillText(`▼${nd.excess.toFixed(1)}`, x, y - r - 14);
        }

        // Inventario (mini barra)
        const barW = 28;
        const barH = 4;
        const bx2 = x - barW / 2;
        const by2 = y + r + 4;
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(bx2, by2, barW, barH);
        const fillW = (nd.q / Q_MAX) * barW;
        ctx.fillStyle = nd.q < 1.5 ? '#EF4444' : '#4FC3F7';
        ctx.fillRect(bx2, by2, fillW, barH);
      }

      // Marcador del shock
      if (p.shockActive) {
        const [sx, sy] = NODE_POS[SHOCK_NODE];
        ctx.fillStyle = '#EF4444';
        ctx.font = `bold 13px ui-sans-serif, system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText('❄ COSECHA HELADA', sx, sy - 36);
      }

      // Leyenda de precio
      const lx = W - 105;
      const ly = 14;
      const lw = 90;
      const lh = 10;
      const lg = ctx.createLinearGradient(lx, ly, lx + lw, ly);
      lg.addColorStop(0, 'rgb(20,180,230)');
      lg.addColorStop(0.5, 'rgb(180,140,80)');
      lg.addColorStop(1, 'rgb(240,40,40)');
      ctx.fillStyle = lg;
      ctx.fillRect(lx, ly, lw, lh);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('precio', lx, ly - 2);
      ctx.fillText('barato', lx, ly + lh + 9);
      ctx.textAlign = 'right';
      ctx.fillText('caro', lx + lw, ly + lh + 9);

      // Banner de tope de precio
      if (p.priceCap) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#7F1D1D';
        ctx.fillRect(0, H - 28, W, 28);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FCA5A5';
        ctx.font = 'bold 12px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(
          `PRECIO TOPADO en $${p.capLevel.toFixed(1)} — señales bloqueadas — la escasez se acumula silenciosamente`,
          W / 2, H - 10,
        );
        ctx.restore();
      } else {
        ctx.fillStyle = '#065F46';
        ctx.fillRect(0, H - 22, W, 22);
        ctx.fillStyle = '#6EE7B7';
        ctx.font = 'bold 11px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(
          '✓ precios libres — la señal fluye — la red se autocoordina',
          W / 2, H - 6,
        );
      }

      // Pausa
      if (p.paused) {
        ctx.fillStyle = 'rgba(5,6,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 16px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⏸ en pausa', W / 2, H / 2);
      }

      // Stats cada 8 frames
      if (frame % 8 === 0) {
        const avgP = nodes.reduce((s, n) => s + n.p, 0) / N;
        const totalExcess = nodes.reduce((s, n) => s + n.excess, 0);
        const flowCount = flowList.filter(f => Math.abs(f.f) > 0.01).length;
        setStats({ avgP, totalExcess, flowCount });
      }
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = paramsRef.current;
      if (!p.paused) {
        acc += dt;
        while (acc >= STEP) {
          nodesRef.current = simulate(nodesRef.current, p, STEP);
          acc -= STEP;
        }
      }
      draw(nodesRef.current, p);
      frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const totalExcess = stats.totalExcess;
  const insight =
    priceCap && totalExcess > 2
      ? `Con precio topado en $${capLevel.toFixed(1)}, la señal de escasez ya no viaja por la red. Los nodos no saben que otros están cortos. La escasez se acumula: ${totalExcess.toFixed(1)} unidades "fantasmas" que el mercado no puede moverse.`
      : shockActive && !priceCap
      ? `La cosecha se heló. El precio del maíz subió. Sin que nadie mandara un memo, el taquero vio el precio y buscó sustitutos. Así es el orden espontáneo: información distribuida que fluye sola.`
      : `Observa cómo los precios (los números sobre cada círculo) viajan por las aristas. Cuando un nodo escasea, su precio sube y los vecinos mandan más. Nadie coordina eso — lo hace la señal del precio.`;

  const handleReset = () => {
    nodesRef.current = initNodes();
    setShockActive(false);
  };

  const handleShock = () => {
    setShockActive(true);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#0B0F17] block"
              style={{ width: W, height: H }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7] hover:bg-[#4FC3F7]/20 transition"
            >
              {paused ? '▶ reanudar' : '⏸ pausa'}
            </button>
            <button
              onClick={handleShock}
              disabled={shockActive}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                shockActive
                  ? 'border-[#EF4444]/30 bg-[#EF4444]/5 text-[#EF4444]/50 cursor-not-allowed'
                  : 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20'
              }`}
            >
              ❄ helar la cosecha
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 transition"
            >
              ↺ reiniciar red
            </button>
            <button
              onClick={() => setPriceCap(v => !v)}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                priceCap
                  ? 'border-[#F472B6]/50 bg-[#F472B6]/10 text-[#F472B6]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {priceCap ? '🔒 tope: ON' : '○ tope de precio'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatBox label="precio promedio" value={`$${stats.avgP.toFixed(2)}`} accent="#4FC3F7" />
            <StatBox
              label="escasez oculta"
              value={totalExcess < 0.1 ? 'ninguna' : totalExcess.toFixed(1)}
              accent={totalExcess < 0.1 ? '#34D399' : '#EF4444'}
            />
            <StatBox
              label="rutas activas"
              value={`${stats.flowCount} / ${EDGES.length}`}
              accent="#A78BFA"
            />
          </div>

          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">
              ✦ ¿Qué estás viendo?
            </div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">
            ⚙ Controla la red
          </div>

          <Slider
            label="Demanda del mercado"
            value={demandBoost}
            min={0.5}
            max={2.0}
            step={0.05}
            onChange={setDemandBoost}
            fmt={v => v < 0.8 ? 'baja' : v < 1.3 ? 'normal' : 'alta'}
            hint="Más demanda sube precios en toda la red."
          />

          {priceCap && (
            <Slider
              label="Tope de precio"
              value={capLevel}
              min={0.5}
              max={4.0}
              step={0.05}
              onChange={setCapLevel}
              fmt={v => `$${v.toFixed(2)}`}
              hint="Si pones el tope abajo del precio de equilibrio, la señal se bloquea y aparece la escasez invisible."
            />
          )}

          <div className="space-y-2 border-t border-[#1E293B] pt-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#64748B] font-mono">
              Cómo leer el grafo
            </div>
            <div className="space-y-1.5 text-[11px] text-[#64748B] leading-snug">
              <div><span className="text-[#4FC3F7]">● azul</span> → precio bajo</div>
              <div><span className="text-[#EF4444]">● rojo</span> → precio alto / escasez</div>
              <div><span className="text-[#34D399]">→ verde</span> → flujo de inventario (arbitraje)</div>
              <div><span className="text-[#F472B6]">→ rosa</span> → flujo inverso</div>
              <div>■ barra azul → inventario del nodo</div>
            </div>
          </div>

          <div className="space-y-2 border-t border-[#1E293B] pt-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#64748B] font-mono">
              El click de Hayek
            </div>
            <p className="text-[11px] text-[#64748B] leading-snug">
              La señal viaja en verde cuando hay diferencial de precio mayor al costo de transporte.
              Con tope activado, esa señal se apaga — y nadie le avisa al TAQUERO que el maíz escasea.
              La escasez crece en silencio.
            </p>
          </div>

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            modelo: dp/dt = κ·(D−q) + Σ flujos<br />
            flujo ij si |p_j − p_i| &gt; τ (transporte)<br />
            Hayek, "The Use of Knowledge in Society" (1945)<br />
            Myrdal, "Asian Drama" (1968) · Nobel 1974
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[18px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt, hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono text-[#FDB813]">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#4FC3F7]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
