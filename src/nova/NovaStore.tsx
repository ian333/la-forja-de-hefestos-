/**
 * NovaStore — NOVA · gaiaprime. La tienda de electrónica que te enseña.
 *
 * Página AISLADA (nova.html). Estética: taller de forja nocturno — carbón,
 * oro fundido, placas de especificación. La vara: más práctica que LCSC,
 * con un diseño que ni LCSC ni JLCPCB ni AG ni UNIT tienen.
 *
 * El diferenciador en cada card: "pruébalo en el simulador ANTES de comprarlo"
 * (→ physics.html#electronica/banco). Carrito compartido con el Banco de
 * Trabajo vía localStorage 'nova-cart'.
 *
 * Datos: src/lib/nova/catalogo.ts (42 SKUs + recetas) — un solo origen de verdad.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATALOGO, RECETAS, skuById, fmtPrecio, recetaPrecio, recetaEntrega,
  type Sku, type Entrega, type Receta,
} from '@/lib/nova/catalogo';

// ── carrito (compartido con el Banco de Trabajo) ─────────────────────────

function useCart() {
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('nova-cart') || '{}'); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem('nova-cart', JSON.stringify(cart)); }, [cart]);
  const add = (id: string, qty = 1) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + qty }));
  const setQty = (id: string, qty: number) => setCart((c) => {
    const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n;
  });
  const clear = () => setCart({});
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = Object.entries(cart).reduce((s, [id, q]) => s + (skuById(id)?.precio ?? 0) * q, 0);
  return { cart, add, setQty, clear, count, total };
}

const CAT_LABELS: Record<Sku['cat'], string> = {
  'pasivos': 'Pasivos',
  'semiconductores': 'Semiconductores',
  'optoelectrónica': 'Optoelectrónica',
  'sensores': 'Sensores',
  'electromecánica': 'Electromecánica',
  'energía': 'Energía',
  'base': 'Banco de trabajo',
};

const SIM_URL = '/physics.html#electronica/banco';

// ── raíz ─────────────────────────────────────────────────────────────────

export default function NovaStore() {
  const cart = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<Sku['cat'] | 'todo'>('todo');
  const catalogRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOGO.filter((s) =>
      (cat === 'todo' || s.cat === cat) &&
      (!q || s.nombre.toLowerCase().includes(q) || s.util.toLowerCase().includes(q)),
    );
  }, [query, cat]);

  const goCatalog = () => catalogRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="nv-grain min-h-screen nv-scroll" style={{ background: 'var(--nv-coal)', color: 'var(--nv-chalk)' }}>
      <TopBar count={cart.count} onCart={() => setDrawerOpen(true)} />
      <Hero onCatalog={goCatalog} />
      <Manifiesto />
      <Kits cartAdd={cart.add} onOpenCart={() => setDrawerOpen(true)} />
      <div ref={catalogRef}>
        <Catalog visible={visible} query={query} setQuery={setQuery} cat={cat} setCat={setCat} cartAdd={cart.add} cartMap={cart.cart} />
      </div>
      <Footer />
      {drawerOpen && <CartDrawer cart={cart} onClose={() => setDrawerOpen(false)} />}
      {/* barra inferior móvil */}
      {cart.count > 0 && !drawerOpen && (
        <button onClick={() => setDrawerOpen(true)}
          className="fixed bottom-3 inset-x-3 z-40 md:hidden nv-mono text-[13px] py-3 rounded-lg font-bold"
          style={{ background: 'var(--nv-gold)', color: '#181d2e', boxShadow: '0 8px 30px -6px rgba(212,176,80,0.5)' }}>
          Ver carrito · {cart.count} {cart.count === 1 ? 'pieza' : 'piezas'} · {fmtPrecio(cart.total)}
        </button>
      )}
    </div>
  );
}

// ── barra superior ───────────────────────────────────────────────────────

function TopBar({ count, onCart }: { count: number; onCart: () => void }) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(11,13,18,0.82)', borderBottom: '1px solid var(--nv-line)' }}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 flex items-center gap-4">
        <a href="/nova.html" className="flex items-baseline gap-2 select-none">
          <span className="nv-display font-extrabold text-[20px] tracking-tight nv-molten">NOVA</span>
          <span className="nv-mono text-[10px] tracking-[0.25em] uppercase" style={{ color: 'var(--nv-ash)' }}>gaiaprime</span>
        </a>
        <nav className="hidden md:flex items-center gap-5 ml-6 text-[12.5px]" style={{ color: 'var(--nv-ash)' }}>
          <a href="#kits" className="hover:text-[#ead080] transition-colors">Kits</a>
          <a href="#catalogo" className="hover:text-[#ead080] transition-colors">Catálogo</a>
          <a href={SIM_URL} className="hover:text-[#ead080] transition-colors">Simulador</a>
          <a href="/physics.html#electronica/micro-corriente" className="hover:text-[#ead080] transition-colors">Aprende</a>
        </nav>
        <div className="flex-1" />
        <a href={SIM_URL}
          className="hidden sm:flex items-center gap-2 nv-mono text-[11px] px-3 py-1.5 rounded-md transition-colors"
          style={{ border: '1px solid var(--nv-line-hi)', color: 'var(--nv-gold)' }}>
          <span className="nv-pulse inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80' }} />
          simulador en vivo
        </a>
        <button onClick={onCart} className="relative nv-mono text-[12px] px-3.5 py-1.5 rounded-md font-bold transition-transform hover:scale-[1.03]"
          style={{ background: 'var(--nv-gold)', color: '#181d2e' }}>
          Carrito{count > 0 && <span className="ml-1.5">({count})</span>}
        </button>
      </div>
    </header>
  );
}

// ── hero ─────────────────────────────────────────────────────────────────

const EMBERS = Array.from({ length: 14 }, (_, i) => ({
  left: `${4 + (i * 167) % 92}%`,
  size: 2 + ((i * 53) % 4),
  dur: 6 + ((i * 97) % 7),
  delay: (i * 73) % 60 / 10,
  drift: ((i % 2 ? 1 : -1) * (10 + (i * 31) % 30)),
}));

function Hero({ onCatalog }: { onCatalog: () => void }) {
  return (
    <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--nv-line)' }}>
      {/* resplandor de fragua abajo */}
      <div className="absolute inset-x-0 bottom-0 h-56 pointer-events-none"
        style={{ background: 'radial-gradient(60% 100% at 50% 100%, rgba(255,138,58,0.13) 0%, rgba(212,176,80,0.05) 45%, transparent 75%)' }} />
      {EMBERS.map((e, i) => (
        <span key={i} className="nv-ember" style={{
          left: e.left, width: e.size, height: e.size,
          animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s`,
          ['--drift' as string]: `${e.drift}px`,
        }} />
      ))}

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-14 pb-16 md:pt-20 md:pb-24 grid md:grid-cols-[1fr_auto] gap-10 items-center">
        <div>
          <p className="nv-mono text-[11px] tracking-[0.3em] uppercase nv-reveal" style={{ color: 'var(--nv-ash)', ['--d' as string]: '0ms' }}>
            Tienda de electrónica · hecha en México
          </p>
          <h1 className="nv-display font-extrabold leading-[0.95] mt-4 nv-reveal"
            style={{ fontSize: 'clamp(40px, 7.5vw, 84px)', letterSpacing: '-0.02em', ['--d' as string]: '90ms' }}>
            Componentes que<br />
            <span className="nv-molten">ya sabes usar.</span>
          </h1>
          <p className="mt-5 max-w-[52ch] text-[15px] md:text-[16px] leading-relaxed nv-reveal" style={{ color: 'var(--nv-ash)', ['--d' as string]: '180ms' }}>
            Cada pieza de este catálogo se puede <b style={{ color: 'var(--nv-chalk)' }}>armar y simular gratis</b> en
            el banco de trabajo antes de pagar un peso. Cuando el LED prende en tu pantalla,
            pides el kit y prende en tu mesa. <span className="nv-mono text-[13px]">Sin miedo. Sin desperdicio.</span>
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 nv-reveal" style={{ ['--d' as string]: '270ms' }}>
            <button onClick={onCatalog} className="nv-display font-bold text-[15px] px-6 py-3 rounded-lg transition-transform hover:scale-[1.02]"
              style={{ background: 'linear-gradient(120deg, var(--nv-gold), var(--nv-gold-hi))', color: '#181d2e', boxShadow: '0 10px 36px -10px rgba(212,176,80,0.55)' }}>
              Ver el catálogo
            </button>
            <a href={SIM_URL} className="nv-mono text-[12.5px] px-5 py-3 rounded-lg transition-colors hover:border-[#d4b050]"
              style={{ border: '1px solid var(--nv-line-hi)', color: 'var(--nv-chalk)' }}>
              ⚡ Primero quiero probar gratis
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 nv-mono text-[11px] nv-reveal" style={{ color: 'var(--nv-ash-2)', ['--d' as string]: '360ms' }}>
            <span><b style={{ color: 'var(--nv-gold)' }}>42</b> piezas curadas — cero relleno</span>
            <span><b style={{ color: 'var(--nv-gold)' }}>🇲🇽 24-48h</b> en stock local</span>
            <span><b style={{ color: 'var(--nv-gold)' }}>100%</b> con lección incluida</span>
          </div>
        </div>

        {/* sello giratorio */}
        <div className="hidden md:block relative w-[210px] h-[210px] select-none nv-reveal" style={{ ['--d' as string]: '300ms' }}>
          <svg viewBox="0 0 200 200" className="nv-seal w-full h-full" style={{ opacity: 0.9 }}>
            <defs>
              <path id="circ" d="M 100,100 m -78,0 a 78,78 0 1,1 156,0 a 78,78 0 1,1 -156,0" />
            </defs>
            <circle cx="100" cy="100" r="96" fill="none" stroke="var(--nv-line-hi)" strokeWidth="1" />
            <circle cx="100" cy="100" r="60" fill="none" stroke="var(--nv-line)" strokeWidth="1" />
            <text fontSize="13.5" fill="var(--nv-gold)" fontFamily="JetBrains Mono" letterSpacing="3.5">
              <textPath href="#circ">APRENDE GRATIS · CONSTRUYE BARATO · COMPITE EN LO CARO ·</textPath>
            </text>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="nv-display font-extrabold text-[44px] nv-molten">⚒</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── marquee manifiesto ───────────────────────────────────────────────────

function Manifiesto() {
  const items = [
    'ingresos justos: te enseñamos a usar lo que vendemos',
    'cada pieza tiene su simulación',
    'el catálogo anti-DigiKey: 42 piezas que SÍ sirven',
    'de la protoboard a las máquinas CNC',
    'español, pesos, México',
  ];
  const row = items.map((t, i) => (
    <span key={i} className="nv-mono text-[11px] tracking-[0.18em] uppercase mx-6" style={{ color: 'var(--nv-ash-2)' }}>
      {t} <span style={{ color: 'var(--nv-gold)' }}>✦</span>
    </span>
  ));
  return (
    <div className="nv-marquee py-3" style={{ borderBottom: '1px solid var(--nv-line)', background: 'var(--nv-coal-2)' }}>
      <div className="nv-marquee-inner">{row}{row}</div>
    </div>
  );
}

// ── kits estrella ────────────────────────────────────────────────────────

function Kits({ cartAdd, onOpenCart }: { cartAdd: (id: string, qty?: number) => void; onOpenCart: () => void }) {
  const addReceta = (r: Receta) => {
    for (const it of r.items) cartAdd(it.skuId, it.qty);
    onOpenCart();
  };
  return (
    <section id="kits" className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-7">
        <div>
          <p className="nv-mono text-[11px] tracking-[0.3em] uppercase" style={{ color: 'var(--nv-ash-2)' }}>Kits estrella</p>
          <h2 className="nv-display font-extrabold text-[28px] md:text-[36px] mt-1" style={{ letterSpacing: '-0.01em' }}>
            Circuitos útiles, <span className="nv-molten">no juguetes.</span>
          </h2>
        </div>
        <a href={SIM_URL} className="nv-mono text-[12px]" style={{ color: 'var(--nv-gold)' }}>ármalos primero en el simulador →</a>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {RECETAS.map((r, i) => {
          const precio = recetaPrecio(r);
          const entrega = recetaEntrega(r);
          return (
            <article key={r.id} className="nv-plate rounded-xl p-5 flex flex-col nv-reveal" style={{ ['--d' as string]: `${i * 70}ms` }}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="nv-display font-bold text-[18px] leading-snug">{r.nombre}</h3>
                <Dificultad nivel={r.dificultad} />
              </div>
              <p className="mt-2 text-[13px] leading-relaxed flex-1" style={{ color: 'var(--nv-ash)' }}>{r.problema}</p>
              <div className="mt-4 nv-mono text-[11px] flex items-center" style={{ color: 'var(--nv-ash-2)' }}>
                <span>{r.items.reduce((s, it) => s + it.qty, 0)} piezas</span>
                <span className="nv-leader" />
                <EntregaBadge entrega={entrega} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="nv-mono font-bold text-[20px]" style={{ color: 'var(--nv-gold-hi)' }}>{fmtPrecio(precio)}</span>
                <button onClick={() => addReceta(r)}
                  className="nv-mono text-[11.5px] font-bold px-3.5 py-2 rounded-md transition-transform hover:scale-[1.04]"
                  style={{ background: 'var(--nv-gold)', color: '#181d2e' }}>
                  Agregar kit +
                </button>
              </div>
            </article>
          );
        })}
        {/* card del que viene: la escalera */}
        <article className="rounded-xl p-5 flex flex-col justify-between nv-reveal"
          style={{ border: '1px dashed var(--nv-line-hi)', background: 'transparent', ['--d' as string]: `${RECETAS.length * 70}ms` }}>
          <div>
            <p className="nv-mono text-[10px] tracking-[0.25em] uppercase" style={{ color: 'var(--nv-ember)' }}>Próximamente</p>
            <h3 className="nv-display font-bold text-[18px] mt-1.5" style={{ color: 'var(--nv-ash)' }}>
              La escalera de máquinas
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--nv-ash-2)' }}>
              Plotter láser → CNC → PLC → brazo robótico. Aprende a competir en lo caro,
              no en el commodity. Las máquinas se pagan solas.
            </p>
          </div>
          <span className="nv-mono text-[11px] mt-4" style={{ color: 'var(--nv-ash-2)' }}>cerebro: placa NOVA · 2026</span>
        </article>
      </div>
    </section>
  );
}

function Dificultad({ nivel }: { nivel: 1 | 2 | 3 }) {
  return (
    <span className="flex gap-1 mt-1.5 shrink-0" title={`dificultad ${nivel}/3`}>
      {[1, 2, 3].map((k) => (
        <span key={k} className="w-1.5 h-1.5 rounded-full"
          style={{ background: k <= nivel ? 'var(--nv-ember)' : 'var(--nv-line-hi)' }} />
      ))}
    </span>
  );
}

// ── catálogo ─────────────────────────────────────────────────────────────

function Catalog({ visible, query, setQuery, cat, setCat, cartAdd, cartMap }: {
  visible: Sku[]; query: string; setQuery: (s: string) => void;
  cat: Sku['cat'] | 'todo'; setCat: (c: Sku['cat'] | 'todo') => void;
  cartAdd: (id: string) => void; cartMap: Record<string, number>;
}) {
  const cats = Object.keys(CAT_LABELS) as Sku['cat'][];
  return (
    <section id="catalogo" className="max-w-7xl mx-auto px-4 md:px-8 pb-16">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <p className="nv-mono text-[11px] tracking-[0.3em] uppercase" style={{ color: 'var(--nv-ash-2)' }}>Catálogo curado</p>
          <h2 className="nv-display font-extrabold text-[28px] md:text-[36px] mt-1" style={{ letterSpacing: '-0.01em' }}>
            42 piezas. <span style={{ color: 'var(--nv-ash)' }}>Cero estorbo.</span>
          </h2>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="busca: led, mosfet, sensor…"
          className="nv-mono text-[13px] px-4 py-2.5 rounded-lg w-full sm:w-[280px] outline-none focus:border-[#d4b050] transition-colors"
          style={{ background: 'var(--nv-coal-2)', border: '1px solid var(--nv-line)', color: 'var(--nv-chalk)' }} />
      </div>

      {/* rail de categorías */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 nv-scroll">
        <CatChip active={cat === 'todo'} onClick={() => setCat('todo')} label={`Todo (${CATALOGO.length})`} />
        {cats.map((c) => (
          <CatChip key={c} active={cat === c} onClick={() => setCat(c)}
            label={`${CAT_LABELS[c]} (${CATALOGO.filter((s) => s.cat === c).length})`} />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="nv-mono text-[13px] py-12 text-center" style={{ color: 'var(--nv-ash-2)' }}>
          Nada con "{query}" — prueba "resistencia", "motor", "sensor"…
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {visible.map((s, i) => (
            <SkuPlate key={s.id} sku={s} inCart={cartMap[s.id] ?? 0} onAdd={() => cartAdd(s.id)} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function CatChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="nv-mono text-[11.5px] px-3.5 py-1.5 rounded-full whitespace-nowrap transition-colors"
      style={active
        ? { background: 'var(--nv-gold)', color: '#181d2e', fontWeight: 700 }
        : { border: '1px solid var(--nv-line)', color: 'var(--nv-ash)', background: 'transparent' }}>
      {label}
    </button>
  );
}

// ── placa de especificación de un SKU ────────────────────────────────────

function SkuPlate({ sku, inCart, onAdd, index }: { sku: Sku; inCart: number; onAdd: () => void; index: number }) {
  const simulable = sku.spice != null;
  return (
    <article className="nv-plate rounded-lg p-4 flex flex-col nv-reveal" style={{ ['--d' as string]: `${Math.min(index, 11) * 40}ms` }}>
      <div className="flex items-center nv-mono text-[10px]" style={{ color: 'var(--nv-ash-2)' }}>
        <span className="tracking-[0.15em] uppercase">{sku.id}</span>
        <span className="nv-leader" />
        <EntregaBadge entrega={sku.entrega} />
      </div>
      <h3 className="nv-display font-bold text-[15.5px] leading-snug mt-2.5">{sku.nombre}</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed flex-1" style={{ color: 'var(--nv-ash)' }}>{sku.util}</p>

      <div className="mt-3.5 flex items-center justify-between">
        <span className="nv-mono font-bold text-[17px]" style={{ color: 'var(--nv-gold-hi)' }}>{fmtPrecio(sku.precio)}</span>
        <button onClick={onAdd}
          className="nv-mono text-[11px] font-bold px-3 py-1.5 rounded transition-transform hover:scale-[1.05]"
          style={{ background: 'var(--nv-gold)', color: '#181d2e' }}>
          {inCart > 0 ? `+ (${inCart})` : 'Agregar +'}
        </button>
      </div>

      {simulable ? (
        <a href={SIM_URL} className="mt-3 flex items-center gap-1.5 nv-mono text-[10.5px] transition-colors hover:text-[#ead080]"
          style={{ color: '#7fd99a' }}>
          <span className="nv-pulse inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80' }} />
          pruébalo gratis antes de comprarlo
        </a>
      ) : (
        <span className="mt-3 nv-mono text-[10.5px]" style={{ color: 'var(--nv-ash-2)' }}>
          simulación en camino · {sku.nota ?? 'se vende listo para usar'}
        </span>
      )}
    </article>
  );
}

function EntregaBadge({ entrega }: { entrega: Entrega }) {
  return entrega === 'local' ? (
    <span className="nv-mono text-[9.5px] font-bold px-2 py-0.5 rounded-sm whitespace-nowrap"
      style={{ background: 'rgba(74,222,128,0.12)', color: '#7fd99a', border: '1px solid rgba(74,222,128,0.25)' }}>
      🇲🇽 24-48 H
    </span>
  ) : (
    <span className="nv-mono text-[9.5px] font-bold px-2 py-0.5 rounded-sm whitespace-nowrap"
      style={{ background: 'rgba(212,176,80,0.1)', color: 'var(--nv-gold)', border: '1px solid rgba(212,176,80,0.3)' }}>
      ✈ LOTE 2-3 SEM
    </span>
  );
}

// ── drawer del carrito ───────────────────────────────────────────────────

function CartDrawer({ cart, onClose }: {
  cart: ReturnType<typeof useCart>; onClose: () => void;
}) {
  const items = Object.entries(cart.cart)
    .map(([id, qty]) => ({ sku: skuById(id), qty }))
    .filter((x): x is { sku: Sku; qty: number } => !!x.sku);
  const hayLote = items.some((x) => x.sku.entrega === 'lote');

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0" style={{ background: 'rgba(5,6,10,0.6)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <aside className="nv-drawer absolute right-0 top-0 bottom-0 w-full max-w-[420px] flex flex-col nv-scroll"
        style={{ background: 'var(--nv-coal-2)', borderLeft: '1px solid var(--nv-line-hi)' }}>
        <div className="flex items-center justify-between px-5 h-14" style={{ borderBottom: '1px solid var(--nv-line)' }}>
          <h3 className="nv-display font-bold text-[17px]">Tu pedido</h3>
          <button onClick={onClose} className="nv-mono text-[18px] px-2" style={{ color: 'var(--nv-ash)' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="text-center pt-16">
              <p className="text-[14px]" style={{ color: 'var(--nv-ash)' }}>Tu carrito está vacío.</p>
              <p className="nv-mono text-[11.5px] mt-2" style={{ color: 'var(--nv-ash-2)' }}>
                Empieza por un kit estrella, o ármalo<br />gratis en el simulador primero.
              </p>
            </div>
          ) : items.map(({ sku, qty }) => (
            <div key={sku.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--nv-line)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate">{sku.nombre}</p>
                <p className="nv-mono text-[10.5px]" style={{ color: 'var(--nv-ash-2)' }}>{fmtPrecio(sku.precio)} c/u</p>
              </div>
              <div className="flex items-center gap-1.5 nv-mono text-[13px]">
                <QtyBtn onClick={() => cart.setQty(sku.id, qty - 1)}>−</QtyBtn>
                <span className="w-6 text-center" style={{ color: 'var(--nv-gold-hi)' }}>{qty}</span>
                <QtyBtn onClick={() => cart.setQty(sku.id, qty + 1)}>+</QtyBtn>
              </div>
              <span className="nv-mono text-[12.5px] w-[74px] text-right" style={{ color: 'var(--nv-ash)' }}>
                {fmtPrecio(sku.precio * qty)}
              </span>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4" style={{ borderTop: '1px solid var(--nv-line-hi)', background: 'var(--nv-coal)' }}>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="nv-mono text-[12px]" style={{ color: 'var(--nv-ash)' }}>Total ({cart.count} pzas)</span>
              <span className="nv-mono font-bold text-[22px]" style={{ color: 'var(--nv-gold-hi)' }}>{fmtPrecio(cart.total)}</span>
            </div>
            <p className="nv-mono text-[10.5px] leading-relaxed mb-3" style={{ color: 'var(--nv-ash-2)' }}>
              {hayLote
                ? '✈ Incluye piezas por lote: tu pedido es PRE-ORDEN (2-3 semanas) con precio de lote.'
                : '🇲🇽 Todo en stock local — sale en 24-48h.'}
            </p>
            <button className="w-full py-3 rounded-lg nv-display font-bold text-[15px] transition-transform hover:scale-[1.01]"
              style={{ background: 'linear-gradient(120deg, var(--nv-gold), var(--nv-gold-hi))', color: '#181d2e' }}>
              {hayLote ? 'Pre-ordenar' : 'Comprar'} · {fmtPrecio(cart.total)}
            </button>
            <p className="nv-mono text-[9.5px] text-center mt-2" style={{ color: 'var(--nv-ash-2)' }}>
              pago seguro vía Mercuria · conexión en curso
            </p>
            <button onClick={cart.clear} className="w-full text-center nv-mono text-[10px] mt-1.5 underline" style={{ color: 'var(--nv-ash-2)' }}>
              vaciar carrito
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function QtyBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:border-[#d4b050]"
      style={{ border: '1px solid var(--nv-line-hi)', color: 'var(--nv-ash)' }}>
      {children}
    </button>
  );
}

// ── footer ───────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--nv-line)', background: 'var(--nv-coal-2)' }}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 grid md:grid-cols-3 gap-8">
        <div>
          <p className="nv-display font-extrabold text-[18px]"><span className="nv-molten">NOVA</span>
            <span className="nv-mono text-[10px] tracking-[0.25em] uppercase ml-2" style={{ color: 'var(--nv-ash-2)' }}>gaiaprime</span>
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed max-w-[38ch]" style={{ color: 'var(--nv-ash-2)' }}>
            Generamos ingresos de manera justa: enseñándote a usar lo que vendemos.
            De la protoboard a las máquinas.
          </p>
        </div>
        <div className="nv-mono text-[12px] space-y-2" style={{ color: 'var(--nv-ash)' }}>
          <p className="text-[10px] tracking-[0.25em] uppercase" style={{ color: 'var(--nv-ash-2)' }}>Aprende gratis</p>
          <p><a href={SIM_URL} className="hover:text-[#ead080]">Banco de trabajo (simulador)</a></p>
          <p><a href="/physics.html#electronica/micro-corriente" className="hover:text-[#ead080]">El microscopio de la corriente</a></p>
          <p><a href="/physics.html#electronica/circuit-sim" className="hover:text-[#ead080]">Simulador de circuitos SPICE</a></p>
        </div>
        <div className="nv-mono text-[12px] space-y-2" style={{ color: 'var(--nv-ash)' }}>
          <p className="text-[10px] tracking-[0.25em] uppercase" style={{ color: 'var(--nv-ash-2)' }}>La casa</p>
          <p><a href="/" className="hover:text-[#ead080]">GAIA University</a></p>
          <p><a href="/forja-brep.html" className="hover:text-[#ead080]">La Forja (CAD)</a></p>
          <p style={{ color: 'var(--nv-ash-2)' }}>México · 2026</p>
        </div>
      </div>
    </footer>
  );
}
