/**
 * SchellingCiudad — clase pura animación del premio 2005 (Thomas Schelling).
 *
 * El modelo de segregación de Schelling (1971), REAL: una cuadrícula de dos
 * tipos de vecinos. Cada agente solo quiere que una fracción `t` de sus vecinos
 * sea como él (preferencia TIBIA). Los infelices se mudan a una casa vacía al
 * azar. Resultado emergente y brutal: preferencias tibias → segregación total
 * que NADIE quería ni diseñó.
 *
 * Raíz animal: lo mismo que ordena un cardumen, una bandada, una manada o el
 * sorteo de larvas de las hormigas — reglas locales chiquitas → orden global
 * sin arquitecto. Schelling lo vio con monedas en un tablero.
 *
 * Es una clase que SE REPRODUCE SOLA por actos (gancho → regla → corre → el
 * giro → biología → tu vida → modo dios), con bloom (doble pase blur+lighter),
 * captions que entran con fade y un índice de segregación que trepa. Sin R3F:
 * canvas 2D, robusto. Los textos son HTML overlay (no drei <Text>).
 */

import { useEffect, useRef, useState } from 'react';

const W = 960;
const H = 600;
const GRID = 40;
const EMPTY_FRAC = 0.08;
const STEP = 1 / 60;
const TICK = 0.1;          // cada cuánto se mudan agentes
const BATCH = 22;          // cuántos infelices se mudan por tick

const A = '#34D399';       // tipo 1 (verde)
const B = '#F472B6';       // tipo 2 (rosa)

interface Trail { x0: number; y0: number; x1: number; y1: number; c: string; life: number; }

interface CaptItem { title: string; sub: (t: number) => string; }
const CAPTS: CaptItem[] = [
  { title: 'Una ciudad. Dos tipos de vecinos.', sub: () => 'A nadie le molesta el otro… casi.' },
  { title: 'La única regla:', sub: (t) => `cada quien quiere que ${Math.round(t * 10)} de cada 10 vecinos sean como él. Nada más. Tibio.` },
  { title: 'Cada quien, incómodo, se muda tantito.', sub: () => 'Nadie odia a nadie. Solo buscan estar un poquito más cómodos.' },
  { title: 'Nadie quería esto.', sub: () => 'Preferencias TIBIAS, sumadas, levantaron un muro que nadie construyó. Eso es Schelling.' },
  { title: 'No es maldad — es biología.', sub: () => 'Lo mismo ordena un cardumen, una bandada, una manada: reglas locales chiquitas → orden global que nadie diseñó.' },
  { title: 'Tu colonia. Tu escuela. Tu timeline.', sub: () => 'La burbuja en la que vives casi nadie la eligió a propósito. Emergió sola.' },
  { title: 'Ahora juégale tú 🎛️', sub: () => '¿Qué tan tibio basta para partir una ciudad? Mueve la tolerancia y vuelve a correr.' },
];

export default function SchellingCiudad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<Int8Array>(new Int8Array(GRID * GRID));
  const trailsRef = useRef<Trail[]>([]);
  const tRef = useRef(0);
  const tickAccRef = useRef(0);
  const climaxRef = useRef<number | null>(null);
  const segRef = useRef(0.5);
  const tolRef = useRef(0.4);
  const pausedRef = useRef(false);

  const [act, setAct] = useState(0);
  const [seg, setSeg] = useState(50);
  const [tol, setTol] = useState(0.4);
  const [paused, setPaused] = useState(false);

  useEffect(() => { tolRef.current = tol; }, [tol]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  function init() {
    const g = gridRef.current;
    for (let i = 0; i < g.length; i++) {
      g[i] = Math.random() < EMPTY_FRAC ? 0 : (Math.random() < 0.5 ? 1 : 2);
    }
    trailsRef.current = [];
    tRef.current = 0;
    tickAccRef.current = 0;
    climaxRef.current = null;
    segRef.current = 0.5;
  }

  useEffect(() => {
    init();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = W; canvas.height = H;

    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const octx = off.getContext('2d');
    if (!octx) return;

    // Geometría del tablero (cuadrado centrado).
    const board = H - 40;
    const cell = board / GRID;
    const ox = (W - board) / 2;
    const oy = (H - board) / 2;
    const cx = (x: number) => ox + x * cell + cell / 2;
    const cy = (y: number) => oy + y * cell + cell / 2;

    let raf = 0, last = performance.now();
    let frame = 0;

    function happy(i: number, g: Int8Array, t: number): boolean {
      const me = g[i]; if (me === 0) return true;
      const x = i % GRID, y = (i / GRID) | 0;
      let same = 0, occ = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        const v = g[ny * GRID + nx];
        if (v !== 0) { occ++; if (v === me) same++; }
      }
      if (occ === 0) return true;
      return same / occ >= t;
    }

    function tick() {
      const g = gridRef.current;
      const t = tolRef.current;
      const unhappy: number[] = [];
      const empties: number[] = [];
      for (let i = 0; i < g.length; i++) {
        if (g[i] === 0) empties.push(i);
        else if (!happy(i, g, t)) unhappy.push(i);
      }
      // mezcla los infelices y muda un lote
      for (let k = unhappy.length - 1; k > 0; k--) {
        const j = (Math.random() * (k + 1)) | 0;
        const tmp = unhappy[k]; unhappy[k] = unhappy[j]; unhappy[j] = tmp;
      }
      let moved = 0;
      for (const src of unhappy) {
        if (moved >= BATCH || empties.length === 0) break;
        const ei = (Math.random() * empties.length) | 0;
        const dst = empties[ei];
        empties[ei] = empties[empties.length - 1]; empties.pop();
        const type = g[src];
        g[dst] = type; g[src] = 0;
        empties.push(src);
        const sx = src % GRID, sy = (src / GRID) | 0, dx2 = dst % GRID, dy2 = (dst / GRID) | 0;
        const trails = trailsRef.current;
        if (trails.length < 500) trails.push({ x0: cx(sx), y0: cy(sy), x1: cx(dx2), y1: cy(dy2), c: type === 1 ? A : B, life: 1 });
        moved++;
      }
    }

    function segregation(): number {
      const g = gridRef.current;
      let sum = 0, n = 0;
      for (let i = 0; i < g.length; i++) {
        const me = g[i]; if (me === 0) continue;
        const x = i % GRID, y = (i / GRID) | 0;
        let same = 0, occ = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          const v = g[ny * GRID + nx];
          if (v !== 0) { occ++; if (v === me) same++; }
        }
        if (occ > 0) { sum += same / occ; n++; }
      }
      return n ? sum / n : 0.5;
    }

    function computeAct(t: number): number {
      if (climaxRef.current !== null) {
        return Math.min(6, 3 + Math.floor((t - climaxRef.current) / 6));
      }
      if (t >= 8.5) return 2;
      if (t >= 4) return 1;
      return 0;
    }

    function drawBoard() {
      if (!octx) return;
      octx.clearRect(0, 0, W, H);
      octx.fillStyle = '#05060A';
      octx.fillRect(0, 0, W, H);
      const g = gridRef.current;
      const r = cell * 0.42;
      for (let i = 0; i < g.length; i++) {
        const v = g[i]; if (v === 0) continue;
        const x = i % GRID, y = (i / GRID) | 0;
        octx.fillStyle = v === 1 ? A : B;
        octx.beginPath();
        octx.arc(cx(x), cy(y), r, 0, Math.PI * 2);
        octx.fill();
      }
      // estela de las mudanzas
      const trails = trailsRef.current;
      octx.lineCap = 'round';
      for (const tr of trails) {
        octx.globalAlpha = Math.max(0, tr.life) * 0.8;
        octx.strokeStyle = tr.c;
        octx.lineWidth = 2.4;
        octx.beginPath();
        octx.moveTo(tr.x0, tr.y0); octx.lineTo(tr.x1, tr.y1);
        octx.stroke();
      }
      octx.globalAlpha = 1;

      // resaltar la regla en el acto 1
      if (computeAct(tRef.current) === 1) {
        const fx = 20, fy = 20;
        octx.strokeStyle = '#FDB813'; octx.lineWidth = 2;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          octx.globalAlpha = (dx === 0 && dy === 0) ? 1 : 0.5;
          octx.beginPath();
          octx.arc(cx(fx + dx), cy(fy + dy), cell * 0.5, 0, Math.PI * 2);
          octx.stroke();
        }
        octx.globalAlpha = 1;
      }
    }

    function render() {
      if (!ctx) return;
      // pase nítido
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#05060A';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(off, 0, 0);
      // pase bloom (blur + lighter)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      ctx.filter = 'blur(7px)';
      ctx.drawImage(off, 0, 0);
      ctx.restore();
      ctx.filter = 'none';
      // viñeta
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!pausedRef.current) {
        tRef.current += dt;
        const a = computeAct(tRef.current);
        // mover solo desde el acto 2
        if (a >= 2) {
          tickAccRef.current += dt;
          while (tickAccRef.current >= TICK) { tick(); tickAccRef.current -= TICK; }
        }
        // estelas se apagan
        const trails = trailsRef.current;
        for (const tr of trails) tr.life -= dt * 2.2;
        trailsRef.current = trails.filter(tr => tr.life > 0);
      }
      drawBoard();
      render();

      // estado throttled
      if (frame % 10 === 0) {
        const s = segregation();
        segRef.current = s;
        if (climaxRef.current === null && tRef.current >= 8.5 && (s > 0.8 || tRef.current > 30)) {
          climaxRef.current = tRef.current;
        }
        setSeg(Math.round(s * 100));
        setAct(computeAct(tRef.current));
      }
      frame++;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function replay() {
    init();
    setAct(0); setSeg(50);
  }

  const cap = CAPTS[Math.min(act, CAPTS.length - 1)];

  return (
    <div className="w-full">
      <style>{`@keyframes schCapIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`}</style>

      <div className="relative rounded-xl overflow-hidden border border-[#1E293B]" style={{ background: '#05060A' }}>
        <canvas ref={canvasRef} className="w-full block" style={{ maxWidth: W, aspectRatio: `${W}/${H}` }} />

        {/* índice de segregación */}
        <div className="absolute right-4 top-4 text-right">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#94A3B8] font-mono">índice de segregación</div>
          <div className="text-[28px] font-extrabold font-mono leading-none mt-0.5"
               style={{ color: seg > 75 ? '#F472B6' : seg > 60 ? '#FDB813' : '#34D399' }}>
            {seg}%
          </div>
          <div className="mt-1 w-[140px] h-1.5 rounded-full bg-[#11161F] overflow-hidden ml-auto">
            <div className="h-full rounded-full transition-all duration-300"
                 style={{ width: `${(seg - 50) / 0.5}%`, background: seg > 75 ? '#F472B6' : '#34D399' }} />
          </div>
        </div>

        {/* caption cinematográfico */}
        <div key={act} className="absolute left-5 bottom-5 max-w-[64%]"
             style={{ animation: 'schCapIn 0.7s ease both' }}>
          <div className="text-[20px] md:text-[26px] font-extrabold text-white leading-tight"
               style={{ textShadow: '0 2px 18px rgba(0,0,0,0.9)' }}>
            {cap.title}
          </div>
          <div className="mt-1.5 text-[13px] md:text-[15px] text-[#CBD5E1] leading-snug"
               style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}>
            {cap.sub(tol)}
          </div>
        </div>

        {/* leyenda tipos */}
        <div className="absolute left-5 top-4 flex items-center gap-4 text-[11px] font-mono text-[#94A3B8]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: A }} /> tipo A</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: B }} /> tipo B</span>
        </div>
      </div>

      {/* controles — modo dios */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => setPaused(p => !p)}
                className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#A78BFA]/40 bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/20 transition">
          {paused ? '▶ reanudar' : '⏸ pausa'}
        </button>
        <button onClick={replay}
                className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#475569] hover:text-[#CBD5E1] transition">
          ↺ volver a empezar
        </button>
        <div className="flex items-center gap-2 ml-1">
          <label className="text-[12px] text-[#94A3B8]">tu tolerancia</label>
          <input type="range" min={0.12} max={0.62} step={0.02} value={tol}
                 onChange={e => setTol(Number(e.target.value))} className="w-40 accent-[#A78BFA]" />
          <span className="text-[12px] font-mono text-[#FDB813] w-[120px]">
            quiero {Math.round(tol * 10)} de 10 iguales
          </span>
        </div>
      </div>
      <div className="mt-2 text-[10px] font-mono text-[#475569]">
        modelo de Schelling (1971): cada agente se muda si menos de tu tolerancia de sus vecinos es de su tipo · orden emergente, real
      </div>
    </div>
  );
}
