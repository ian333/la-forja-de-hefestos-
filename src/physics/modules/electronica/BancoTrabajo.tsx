/**
 * BancoTrabajo — la tienda NOVA hecha banco de trabajo.
 *
 * "Generar ingresos de manera justa enseñando cómo se usa lo que vendemos."
 * El estudiante carga un circuito ÚTIL (luz nocturna, alarma de calor…), juega
 * con el sensor / la perilla y lo ve RESPONDER en vivo (motor MNA real:
 * src/lib/nova/protoboard.ts), y de un clic compra el kit con sus precios MXN
 * y tiempos de entrega. Cada pieza de la tienda es a la vez modelo simulable.
 *
 * v1: tableros armados (los clásicos) + simulación viva + carrito.
 * Roadmap: armado libre con drag, vista esquemática autogenerada.
 */
import { useMemo, useState, useEffect } from 'react';
import {
  buildNetlist, type Placement, type Hole, holeKey,
} from '@/lib/nova/protoboard';
import { dcOperatingPoint } from '@/lib/circuitos/spice';
import {
  CATALOGO, skuById, fmtPrecio, type Sku, type Entrega,
} from '@/lib/nova/catalogo';
import { TABLEROS, aplicarControl, type TableroArmado } from '@/lib/nova/recetas-armadas';

// ── Geometría de la protoboard en pantalla ───────────────────────────────

const PITCH = 21;
const X0 = 30;
const RAIL_TOP0 = 16, RAIL_TOP1 = 34;
const MAIN_Y0 = 64;
const CHANNEL = 22;
const VIEW_COLS = 30; // ventana visible (las recetas caben en <28)

function holeXY(h: Hole): { x: number; y: number } {
  if (h.kind === 'rail') {
    const y = h.rail === 0 ? RAIL_TOP0 : h.rail === 1 ? RAIL_TOP1 : 0;
    return { x: X0 + (h.col - 1) * PITCH, y };
  }
  const y = MAIN_Y0 + h.row * PITCH + (h.row >= 5 ? CHANNEL : 0);
  return { x: X0 + (h.col - 1) * PITCH, y };
}

const BOARD_W = X0 + VIEW_COLS * PITCH + 10;
const BOARD_H = MAIN_Y0 + 9 * PITCH + CHANNEL + 20;

// ── Colores de bandas de resistencia (E12 real) ──────────────────────────

const BAND = ['#1a1a1a', '#7a4012', '#e02020', '#f08000', '#f0d000', '#30b030', '#3060e0', '#9040d0', '#909090', '#f0f0f0'];
function resistorBands(ohms: number): string[] {
  let s = ohms, mult = 0;
  while (s >= 100) { s /= 10; mult++; }
  const d1 = Math.floor(s / 10), d2 = Math.floor(s % 10);
  return [BAND[d1] ?? '#000', BAND[d2] ?? '#000', BAND[mult] ?? '#000'];
}

// ── Estado derivado de la simulación ─────────────────────────────────────

interface SimOut {
  v: number[];
  nodePin: Map<string, number[]>;
  warnings: string[];
  ok: boolean;
}

function simulate(placements: Placement[], jumpers: { id: string; a: Hole; b: Hole }[]): SimOut {
  const net = buildNetlist(placements, jumpers);
  const op = dcOperatingPoint(net.circuit);
  return { v: op?.v ?? [], nodePin: net.nodePin, warnings: net.warnings, ok: !!op };
}

/** Corriente por un LED = corriente por su resistor en serie (robusto). */
function ledCurrent(id: string, placements: Placement[], sim: SimOut): number {
  const ledPins = sim.nodePin.get(id);
  if (!ledPins || !sim.ok) return 0;
  const ledNodes = new Set(ledPins);
  for (const p of placements) {
    const sk = skuById(p.skuId);
    if (sk?.spice?.kind !== 'R') continue;
    const rp = sim.nodePin.get(p.id);
    if (!rp || rp.filter((n) => ledNodes.has(n)).length !== 1) continue;
    return Math.abs((sim.v[rp[0]] ?? 0) - (sim.v[rp[1]] ?? 0)) / (sk.spice as { ohms: number }).ohms;
  }
  return 0;
}

// ════════════════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════════════════

type Tab = 'recetas' | 'bom' | 'catalogo';

export default function BancoTrabajo() {
  const [tableroId, setTableroId] = useState(TABLEROS[0].recetaId);
  const tablero = useMemo(() => TABLEROS.find((t) => t.recetaId === tableroId)!, [tableroId]);
  const [controls, setControls] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>('recetas');
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('nova-cart') || '{}'); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem('nova-cart', JSON.stringify(cart)); }, [cart]);

  // reset de controles al cambiar de tablero
  useEffect(() => {
    const init: Record<string, number> = {};
    for (const it of tablero.interactives) init[it.placementId + ':' + it.campo] = it.valor;
    setControls(init);
  }, [tablero]);

  // aplicar controles a los placements
  const placements = useMemo(() => {
    let ps = tablero.placements;
    for (const it of tablero.interactives) {
      const key = it.placementId + ':' + it.campo;
      if (controls[key] != null) ps = aplicarControl(ps, it, controls[key]);
    }
    return ps;
  }, [tablero, controls]);

  const sim = useMemo(() => simulate(placements, tablero.jumpers), [placements, tablero]);

  const addToCart = (skuId: string, qty = 1) =>
    setCart((c) => ({ ...c, [skuId]: (c[skuId] ?? 0) + qty }));
  const addBoardToCart = () => {
    setCart((c) => {
      const next = { ...c };
      for (const p of tablero.placements) next[p.skuId] = (next[p.skuId] ?? 0) + 1;
      return next;
    });
    setTab('bom');
  };
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 h-full p-3 overflow-hidden">
      {/* ── Protoboard + controles ── */}
      <div className="flex flex-col gap-3 min-h-0 overflow-auto">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABLEROS.map((t) => (
            <button key={t.recetaId} onClick={() => { setTableroId(t.recetaId); setTab('recetas'); }}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
                t.recetaId === tableroId ? 'bg-[#d4b050] text-[#181d2e] border-[#d4b050]'
                  : 'bg-[#1e2538] text-[#a0947e] border-[#2c2818] hover:border-[#3e3624]'}`}>
              {t.titulo}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-[#2c2818] bg-[#0c1a10] p-2">
          <BoardSVG tablero={tablero} placements={placements} sim={sim} />
          {!sim.ok && (
            <div className="text-[11px] text-[#f87171] px-2 pt-1">El circuito no resuelve — revisa las conexiones.</div>
          )}
        </div>

        {/* Controles interactivos del tablero */}
        <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3">
          <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e] pb-1">Juega con el circuito</div>
          <p className="text-[12px] text-[#c9bfa8] leading-relaxed pb-2">{tablero.observa}</p>
          {tablero.interactives.map((it) => {
            const key = it.placementId + ':' + it.campo;
            const val = controls[key] ?? it.valor;
            return (
              <label key={key} className="block mb-2">
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[#c9bfa8]">{it.label}</span>
                  <span className="font-mono text-[#ead080]">{it.fmt(val)}</span>
                </div>
                <input type="range" min={it.min} max={it.max} step={it.step} value={val}
                  onChange={(e) => setControls((c) => ({ ...c, [key]: parseFloat(e.target.value) }))}
                  className="w-full accent-[#d4b050]" />
                <div className="text-[10px] text-[#6a5e4e] mt-0.5">{it.pista}</div>
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Panel derecho: recetas / BOM / catálogo ── */}
      <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
        <div className="flex gap-1 text-[12px]">
          {(['recetas', 'bom', 'catalogo'] as Tab[]).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`flex-1 py-1.5 rounded-md border capitalize ${
                tab === tb ? 'bg-[#1e2538] border-[#d4b050] text-[#ead080]' : 'bg-[#14160f] border-[#2c2818] text-[#a0947e]'}`}>
              {tb === 'bom' ? `Carrito${cartCount ? ` (${cartCount})` : ''}` : tb}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {tab === 'recetas' && <RecetaPanel tablero={tablero} sim={sim} placements={placements} onBuy={addBoardToCart} />}
          {tab === 'bom' && <CartPanel cart={cart} setCart={setCart} />}
          {tab === 'catalogo' && <CatalogPanel onAdd={addToCart} cart={cart} />}
        </div>
      </div>
    </div>
  );
}

// ── La protoboard dibujada ───────────────────────────────────────────────

function BoardSVG({ tablero, placements, sim }: { tablero: TableroArmado; placements: Placement[]; sim: SimOut }) {
  return (
    <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} className="w-full" style={{ maxHeight: 360 }}>
      {/* cuerpo de la protoboard */}
      <rect x={4} y={6} width={BOARD_W - 8} height={BOARD_H - 12} rx={8} fill="#13261a" stroke="#1e3a28" strokeWidth={1.5} />
      {/* rieles de poder */}
      <line x1={X0 - 6} y1={RAIL_TOP0} x2={X0 + (VIEW_COLS - 1) * PITCH + 6} y2={RAIL_TOP0} stroke="#7a2520" strokeWidth={1} opacity={0.5} />
      <line x1={X0 - 6} y1={RAIL_TOP1} x2={X0 + (VIEW_COLS - 1) * PITCH + 6} y2={RAIL_TOP1} stroke="#23508a" strokeWidth={1} opacity={0.5} />
      <text x={10} y={RAIL_TOP0 + 3} fontSize={11} fill="#e06a5a">+</text>
      <text x={11} y={RAIL_TOP1 + 4} fontSize={12} fill="#5a9ae0">−</text>
      {/* hoyitos */}
      {railHoles().map((h) => <Hole key={holeKey(h)} h={h} />)}
      {mainHoles().map((h) => <Hole key={holeKey(h)} h={h} />)}
      {/* canal central */}
      <rect x={X0 - 8} y={MAIN_Y0 + 5 * PITCH - 2} width={(VIEW_COLS - 1) * PITCH + 16} height={CHANNEL} fill="#0a1610" opacity={0.6} />

      {/* componentes */}
      {placements.map((p) => (
        <ComponentBody key={p.id} placement={p} all={placements} sim={sim} />
      ))}
      {/* jumpers */}
      {tablero.jumpers.map((j) => {
        const a = holeXY(j.a), b = holeXY(j.b);
        return <path key={j.id} d={`M${a.x},${a.y} Q${(a.x + b.x) / 2},${Math.min(a.y, b.y) - 22} ${b.x},${b.y}`}
          fill="none" stroke="#d0d0d0" strokeWidth={2.5} opacity={0.8} strokeLinecap="round" />;
      })}
    </svg>
  );
}

function Hole({ h }: { h: Hole }) {
  const { x, y } = holeXY(h);
  return <circle cx={x} cy={y} r={2.2} fill="#0a140d" stroke="#2c4a36" strokeWidth={0.8} />;
}

function railHoles(): Hole[] {
  const hs: Hole[] = [];
  for (let c = 1; c <= VIEW_COLS; c++) { hs.push({ kind: 'rail', rail: 0, col: c }); hs.push({ kind: 'rail', rail: 1, col: c }); }
  return hs;
}
function mainHoles(): Hole[] {
  const hs: Hole[] = [];
  for (let c = 1; c <= VIEW_COLS; c++) for (let r = 0; r < 10; r++) hs.push({ kind: 'main', col: c, row: r });
  return hs;
}

// ── El cuerpo real de cada componente ────────────────────────────────────

function ComponentBody({ placement, all, sim }: { placement: Placement; all: Placement[]; sim: SimOut }) {
  const sku = skuById(placement.skuId);
  if (!sku) return null;
  const pts = placement.pins.map(holeXY);
  const kind = sku.spice?.kind;
  // punto medio del cuerpo
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

  const leg = (a: { x: number; y: number }, b: { x: number; y: number }, color = '#b8b8b8') =>
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={1.6} />;

  // ── LED: domo con su color, brilla si circula corriente ──
  if (kind === 'D' && (sku.spice as { egEv?: number }).egEv != null) {
    const i = ledCurrent(placement.id, all, sim);
    // brillo PERCEPTUAL (el ojo ve la luz casi logarítmica): así un dimmer se
    // ve atenuar gradualmente en vez de saltar de prendido a apagado.
    const bright = i <= 1e-6 ? 0 : Math.min(1, Math.pow(i / 0.02, 0.45));
    const c = ledColor(sku);
    return (
      <g>
        {leg(pts[0], { x: cx, y: cy })}
        {leg(pts[1], { x: cx, y: cy })}
        {bright > 0.05 && <circle cx={cx} cy={cy} r={11 + bright * 7} fill={c} opacity={0.25 * bright} />}
        <circle cx={cx} cy={cy} r={7} fill={c} opacity={0.35 + bright * 0.6} stroke={c} strokeWidth={1.2} />
        <circle cx={cx - 2} cy={cy - 2} r={2} fill="#ffffff" opacity={0.4 + bright * 0.5} />
      </g>
    );
  }

  // ── Resistencia: cuerpo beige con bandas ──
  if (kind === 'R' && sku.cat === 'pasivos') {
    const bands = resistorBands((sku.spice as { ohms: number }).ohms);
    const horiz = Math.abs(pts[0].x - pts[1].x) >= Math.abs(pts[0].y - pts[1].y);
    const w = 26, hh = 9;
    return (
      <g>
        {leg(pts[0], { x: cx, y: cy })}
        {leg(pts[1], { x: cx, y: cy })}
        <g transform={`translate(${cx} ${cy}) rotate(${horiz ? 0 : 90})`}>
          <rect x={-w / 2} y={-hh / 2} width={w} height={hh} rx={3} fill="#d8c79a" stroke="#9c8a5c" strokeWidth={0.8} />
          {bands.map((b, k) => <rect key={k} x={-w / 2 + 5 + k * 5} y={-hh / 2} width={2.5} height={hh} fill={b} />)}
        </g>
      </g>
    );
  }

  // ── Fuente / pila ──
  if (kind === 'V') {
    return (
      <g>
        {leg(pts[0], { x: cx, y: cy }, '#e06a5a')}
        {leg(pts[1], { x: cx, y: cy }, '#5a9ae0')}
        <rect x={cx - 14} y={cy - 9} width={28} height={18} rx={3} fill="#2a2a2a" stroke="#d4b050" strokeWidth={1} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fill="#ead080" fontFamily="JetBrains Mono">
          {(placement.state?.volts ?? (sku.spice as { volts: number }).volts).toFixed(0)}V
        </text>
      </g>
    );
  }

  // ── MOSFET (TO-220) ──
  if (kind === 'M') {
    return (
      <g>
        {pts.map((p, k) => leg(p, { x: cx + (k - 1) * 7, y: cy + 9 }))}
        <rect x={cx - 13} y={cy - 12} width={26} height={20} rx={2} fill="#1a1a1a" stroke="#555" strokeWidth={1} />
        <rect x={cx - 13} y={cy - 12} width={26} height={6} rx={2} fill="#888" />
        <text x={cx} y={cy + 3} textAnchor="middle" fontSize={7} fill="#bbb" fontFamily="JetBrains Mono">FET</text>
      </g>
    );
  }

  // ── LDR ──
  if (kind === 'LDR') {
    const luz = placement.state?.luz ?? 0.5;
    return (
      <g>
        {leg(pts[0], { x: cx, y: cy })}
        {leg(pts[1], { x: cx, y: cy })}
        <circle cx={cx} cy={cy} r={9} fill="#caa84a" stroke="#8a7020" strokeWidth={1} opacity={0.3 + luz * 0.7} />
        <path d={`M${cx - 5},${cy - 3} l4,3 l-4,3 M${cx + 1},${cy - 3} l4,3 l-4,3`} stroke="#5a3a00" strokeWidth={1} fill="none" />
        <text x={cx} y={cy - 13} textAnchor="middle" fontSize={11}>{luz < 0.2 ? '🌑' : luz > 0.7 ? '☀️' : '🌤️'}</text>
      </g>
    );
  }

  // ── NTC ──
  if (kind === 'NTC') {
    const t = placement.state?.tempC ?? 25;
    const hot = Math.min(1, Math.max(0, (t - 20) / 60));
    return (
      <g>
        {leg(pts[0], { x: cx, y: cy })}
        {leg(pts[1], { x: cx, y: cy })}
        <circle cx={cx} cy={cy} r={7} fill={`rgb(${120 + hot * 135},${90 - hot * 60},${90 - hot * 70})`} stroke="#444" strokeWidth={1} />
        <text x={cx} y={cy - 11} textAnchor="middle" fontSize={9} fill="#c9bfa8" fontFamily="JetBrains Mono">{t.toFixed(0)}°</text>
      </g>
    );
  }

  // ── Pot ──
  if (kind === 'POT') {
    const f = placement.state?.frac ?? 0.5;
    return (
      <g>
        {pts.map((p, k) => leg(p, { x: cx + (k - 1) * 8, y: cy + 8 }))}
        <circle cx={cx} cy={cy} r={11} fill="#2a3550" stroke="#d4b050" strokeWidth={1.2} />
        <line x1={cx} y1={cy} x2={cx + 9 * Math.cos((f - 0.5) * 2.4)} y2={cy + 9 * Math.sin((f - 0.5) * 2.4)} stroke="#ead080" strokeWidth={2} />
      </g>
    );
  }

  // ── Buzzer / genérico ──
  return (
    <g>
      {pts.map((p) => leg(p, { x: cx, y: cy }))}
      <circle cx={cx} cy={cy} r={9} fill="#181818" stroke="#555" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={2.5} fill="#333" />
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize={8} fill="#6a5e4e" fontFamily="JetBrains Mono">
        {sku.nombre.split(' ')[0]}
      </text>
    </g>
  );
}

function ledColor(sku: Sku): string {
  const name = sku.nombre.toLowerCase();
  if (name.includes('rojo')) return '#ff3b30';
  if (name.includes('amarillo')) return '#ffcc00';
  if (name.includes('verde')) return '#34c759';
  if (name.includes('azul')) return '#0a84ff';
  if (name.includes('blanco')) return '#eaf2ff';
  return '#ff8030';
}

// ── Panel de receta (qué es + comprar el kit) ────────────────────────────

function RecetaPanel({ tablero, sim, placements, onBuy }: {
  tablero: TableroArmado; sim: SimOut; placements: Placement[]; onBuy: () => void;
}) {
  const total = tablero.placements.reduce((s, p) => s + (skuById(p.skuId)?.precio ?? 0), 0);
  const entrega: Entrega = tablero.placements.every((p) => skuById(p.skuId)?.entrega === 'local') ? 'local' : 'lote';
  // estado del LED (encendido?) para el feedback
  const led = placements.find((p) => skuById(p.skuId)?.spice?.kind === 'D');
  const iLed = led ? ledCurrent(led.id, placements, sim) : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3">
        <div className="text-[14px] font-semibold text-[#ead080]">{tablero.titulo}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${iLed > 0.0003 ? 'bg-[#4ade80]' : 'bg-[#3a3018]'}`}
            style={iLed > 0.0003 ? { boxShadow: '0 0 8px #4ade80' } : undefined} />
          <span className="text-[12px] text-[#a0947e]">
            {iLed > 0.0003 ? `Encendido · ${(iLed * 1000).toFixed(iLed < 0.01 ? 1 : 0)} mA por el LED` : 'Apagado'}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3">
        <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e] pb-2">Lista de piezas</div>
        {dedupe(tablero.placements).map(({ sku, qty }) => (
          <div key={sku.id} className="flex items-center justify-between text-[12px] py-1 border-b border-[#1a1d12] last:border-0">
            <span className="text-[#c9bfa8]">{qty > 1 && <b className="text-[#ead080]">{qty}× </b>}{sku.nombre}</span>
            <span className="flex items-center gap-2">
              <EntregaBadge entrega={sku.entrega} />
              <span className="font-mono text-[#a0947e]">{fmtPrecio(sku.precio * qty)}</span>
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2c2818]">
          <span className="text-[12px] text-[#a0947e]">Kit completo</span>
          <span className="font-mono text-[15px] text-[#ead080]">{fmtPrecio(total)}</span>
        </div>
        <div className="mt-1 text-[11px] text-[#6a5e4e]">
          {entrega === 'local' ? '🇲🇽 Entrega 24-48h (todo en stock local)' : '✈️ Algunas piezas por lote: pre-orden 2-3 semanas'}
        </div>
        <button onClick={onBuy}
          className="mt-3 w-full py-2 rounded-md bg-[#d4b050] text-[#181d2e] font-semibold text-[13px] hover:bg-[#ead080]">
          Agregar el kit al carrito
        </button>
      </div>
    </div>
  );
}

function EntregaBadge({ entrega }: { entrega: Entrega }) {
  return entrega === 'local'
    ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#14301c] text-[#7fd99a] border border-[#235]">24-48h</span>
    : <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2a2410] text-[#d4b050] border border-[#3e3624]">lote</span>;
}

function dedupe(placements: Placement[]): { sku: Sku; qty: number }[] {
  const map = new Map<string, { sku: Sku; qty: number }>();
  for (const p of placements) {
    const sku = skuById(p.skuId);
    if (!sku) continue;
    const e = map.get(sku.id);
    if (e) e.qty++; else map.set(sku.id, { sku, qty: 1 });
  }
  return [...map.values()];
}

// ── Carrito ──────────────────────────────────────────────────────────────

function CartPanel({ cart, setCart }: { cart: Record<string, number>; setCart: (f: (c: Record<string, number>) => Record<string, number>) => void }) {
  const items = Object.entries(cart).map(([id, qty]) => ({ sku: skuById(id), qty })).filter((x) => x.sku) as { sku: Sku; qty: number }[];
  const total = items.reduce((s, { sku, qty }) => s + sku.precio * qty, 0);
  const hayLote = items.some((x) => x.sku.entrega === 'lote');
  const setQty = (id: string, qty: number) => setCart((c) => {
    const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n;
  });

  if (items.length === 0) {
    return <div className="text-[12px] text-[#6a5e4e] p-4 text-center">Tu carrito está vacío. Carga una receta y dale "Agregar el kit".</div>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3">
        {items.map(({ sku, qty }) => (
          <div key={sku.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-[#1a1d12] last:border-0">
            <span className="text-[#c9bfa8] flex-1">{sku.nombre}</span>
            <span className="flex items-center gap-2">
              <button onClick={() => setQty(sku.id, qty - 1)} className="w-5 h-5 rounded bg-[#1e2538] text-[#a0947e]">−</button>
              <span className="font-mono w-5 text-center text-[#ead080]">{qty}</span>
              <button onClick={() => setQty(sku.id, qty + 1)} className="w-5 h-5 rounded bg-[#1e2538] text-[#a0947e]">+</button>
              <span className="font-mono text-[#a0947e] w-16 text-right">{fmtPrecio(sku.precio * qty)}</span>
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2c2818]">
          <span className="text-[13px] text-[#a0947e]">Total</span>
          <span className="font-mono text-[17px] text-[#ead080]">{fmtPrecio(total)}</span>
        </div>
      </div>
      <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3 text-[11px] text-[#a0947e] leading-relaxed">
        {hayLote
          ? '✈️ Tu pedido tiene piezas por lote: es una PRE-ORDEN. Juntamos el lote, lo traemos y te entregamos en ~2-3 semanas con descuento por anticipar.'
          : '🇲🇽 Todo en stock local: entrega en 24-48h.'}
      </div>
      <button className="w-full py-2.5 rounded-md bg-[#d4b050] text-[#181d2e] font-semibold text-[13px] hover:bg-[#ead080]">
        {hayLote ? 'Pre-ordenar el kit' : 'Comprar ahora'} · {fmtPrecio(total)}
      </button>
      <p className="text-[10px] text-[#6a5e4e] text-center">El pago se procesa con Mercuria (conexión en curso).</p>
    </div>
  );
}

// ── Catálogo ─────────────────────────────────────────────────────────────

function CatalogPanel({ onAdd, cart }: { onAdd: (id: string) => void; cart: Record<string, number> }) {
  const cats = [...new Set(CATALOGO.map((s) => s.cat))];
  return (
    <div className="flex flex-col gap-3">
      {cats.map((cat) => (
        <div key={cat} className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3">
          <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e] pb-2 capitalize">{cat}</div>
          {CATALOGO.filter((s) => s.cat === cat).map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-[#1a1d12] last:border-0">
              <div className="flex-1">
                <div className="text-[12px] text-[#c9bfa8]">{s.nombre}</div>
                <div className="text-[10px] text-[#6a5e4e] leading-snug">{s.util}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <EntregaBadge entrega={s.entrega} />
                <span className="font-mono text-[11px] text-[#a0947e]">{fmtPrecio(s.precio)}</span>
                <button onClick={() => onAdd(s.id)}
                  className="text-[10px] px-2 py-0.5 rounded bg-[#1e2538] text-[#ead080] border border-[#3e3624] hover:bg-[#272f46]">
                  + {cart[s.id] ? `(${cart[s.id]})` : ''}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
