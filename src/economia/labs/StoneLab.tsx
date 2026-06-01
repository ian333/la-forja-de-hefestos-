/**
 * StoneLab — laboratorio del premio 1984 (Richard Stone).
 *
 * El click: el PIB no existía. Stone inventó la "libreta de contabilidad" que
 * todos los países del mundo usan igual — el Sistema de Cuentas Nacionales (SCN).
 * La identidad fundamental (enfoque gasto):
 *
 *   Y = C + I + G + NX
 *   donde NX = X − M (exportaciones netas)
 *
 * Identidad de ahorro-inversión (derivada):
 *   I = Sp + Sg + Sf
 *   Sp = Y − T − C  (ahorro privado)
 *   Sg = T − G      (ahorro gobierno, superávit/déficit)
 *   Sf = M − X = −NX (ahorro externo / déficit de cuenta corriente)
 *
 * Multiplicador keynesiano implícito:
 *   ΔY = ΔG / (1 − MPC)   cuando el resto constante
 *
 * El laboratorio muestra flujos animados entre sectores (Hogares, Empresas,
 * Gobierno, Exterior) y un desglose de barras del PIB que recalcula en vivo
 * cuando el usuario mueve los sliders. También hay un modo "crisis" para simular
 * un colapso de la inversión (2008-style) y ver cómo el gobierno puede compensar.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constantes de canvas ──────────────────────────────────────────────────
const W = 820;
const H = 380;

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface GDPParams {
  C: number;   // Consumo privado (% PIB potencial)
  I: number;   // Inversión privada (% PIB potencial)
  G: number;   // Gasto gobierno (% PIB potencial)
  X: number;   // Exportaciones (% PIB potencial)
  M: number;   // Importaciones (% PIB potencial)
}

interface Particle {
  x: number;
  y: number;
  tx: number;   // target x
  ty: number;   // target y
  t: number;    // progreso [0,1]
  speed: number;
  color: string;
  size: number;
  alpha: number;
}

// ─── Valores por defecto (aprox. estructura México 2023) ──────────────────
const DEFAULTS: GDPParams = { C: 65, I: 22, G: 13, X: 38, M: 38 };

// ─── Posiciones de los cuatro sectores en el canvas ──────────────────────
const SECTORS = {
  hogares:  { x: 160, y: 190, label: 'Hogares', color: '#4FC3F7' },
  empresas: { x: 410, y: 100, label: 'Empresas', color: '#FDB813' },
  gobierno: { x: 660, y: 190, label: 'Gobierno', color: '#A78BFA' },
  exterior: { x: 410, y: 300, label: 'Exterior', color: '#34D399' },
};

// ─── Parámetros estéticos ─────────────────────────────────────────────────
const SECTOR_R = 42;
const BAR_COLORS = {
  C: '#4FC3F7',
  I: '#FDB813',
  G: '#A78BFA',
  NX_pos: '#34D399',
  NX_neg: '#EF4444',
};

// ─── Helpers de GDP ──────────────────────────────────────────────────────
function gdpOf(p: GDPParams): number { return p.C + p.I + p.G + (p.X - p.M); }
function savingPriv(p: GDPParams, T: number): number { return gdpOf(p) - T - p.C; }
function savingGov(p: GDPParams, T: number): number { return T - p.G; }
function savingExt(p: GDPParams): number { return p.M - p.X; }
// Verificación SCN: Sp + Sg + Sf = I (siempre, por construcción)
function checkIdentity(p: GDPParams, T: number): boolean {
  const diff = Math.abs(savingPriv(p, T) + savingGov(p, T) + savingExt(p) - p.I);
  return diff < 0.01;
}

// ─── Generador de partículas entre dos sectores ──────────────────────────
function makeParticle(
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  jitter = 12,
): Particle {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * jitter;
  return {
    x: from.x + Math.cos(angle) * r,
    y: from.y + Math.sin(angle) * r,
    tx: to.x + Math.cos(angle + Math.PI) * r,
    ty: to.y + Math.sin(angle + Math.PI) * r,
    t: Math.random(),
    speed: 0.004 + Math.random() * 0.003,
    color,
    size: 2 + Math.random() * 2,
    alpha: 0.5 + Math.random() * 0.5,
  };
}

// ─── Lerp suave ──────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

export default function StoneLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<GDPParams>({ ...DEFAULTS });
  const particlesRef = useRef<Particle[]>([]);
  const crisisRef = useRef(false);

  const [C, setC] = useState(DEFAULTS.C);
  const [I, setI] = useState(DEFAULTS.I);
  const [G, setG] = useState(DEFAULTS.G);
  const [X, setX] = useState(DEFAULTS.X);
  const [M, setM] = useState(DEFAULTS.M);
  const [T, setT] = useState(18);            // impuestos (para identidad S-I)
  const [crisis, setCrisis] = useState(false);
  const [stats, setStats] = useState({ Y: 0, NX: 0, Sp: 0, Sg: 0, Sf: 0 });

  // Pre-crisis snapshot para volver
  const precrisisRef = useRef<GDPParams & { T: number }>({ ...DEFAULTS, T: 18 });

  // Sync params to ref
  useEffect(() => {
    paramsRef.current = { C, I, G, X, M };
    crisisRef.current = crisis;
  }, [C, I, G, X, M, crisis]);

  // Activar crisis: inversión colapsa, exportaciones caen
  const triggerCrisis = useCallback(() => {
    if (crisis) {
      // Restaurar
      const pre = precrisisRef.current;
      setC(pre.C); setI(pre.I); setG(pre.G); setX(pre.X); setM(pre.M); setT(pre.T);
      setCrisis(false);
    } else {
      precrisisRef.current = { C, I, G, X, M, T };
      setI(Math.max(4, I - 14));    // colapso inversión
      setX(Math.max(10, X - 10));   // caen exportaciones
      setCrisis(true);
    }
  }, [crisis, C, I, G, X, M, T]);

  // Rescate fiscal: gobierno sube gasto para compensar
  const triggerRescate = useCallback(() => {
    if (!crisis) return;
    setG(prev => Math.min(35, prev + 10));
  }, [crisis]);

  // ── Loop de animación ──────────────────────────────────────────────────
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

    // Inicializar partículas
    const flows: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; color: string; count: number }> = [
      { from: SECTORS.hogares, to: SECTORS.empresas,  color: BAR_COLORS.C,    count: 8  },   // C
      { from: SECTORS.empresas, to: SECTORS.hogares,  color: BAR_COLORS.I,    count: 5  },   // I (salarios/dividendos)
      { from: SECTORS.hogares, to: SECTORS.gobierno,  color: BAR_COLORS.G,    count: 4  },   // impuestos
      { from: SECTORS.gobierno, to: SECTORS.empresas, color: BAR_COLORS.G,    count: 4  },   // G (contratos)
      { from: SECTORS.empresas, to: SECTORS.exterior, color: BAR_COLORS.NX_pos, count: 5 },  // X
      { from: SECTORS.exterior, to: SECTORS.empresas, color: BAR_COLORS.NX_neg, count: 5 },  // M
    ];

    const parts: Particle[] = [];
    for (const f of flows) {
      for (let k = 0; k < f.count; k++) parts.push(makeParticle(f.from, f.to, f.color));
    }
    particlesRef.current = parts;

    let raf = 0;
    let frame = 0;

    function drawSector(sx: number, sy: number, label: string, color: string, sub: string) {
      // Glow exterior
      const grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, SECTOR_R + 14);
      grad.addColorStop(0, color + '44');
      grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, SECTOR_R + 14, 0, Math.PI * 2);
      ctx.fill();

      // Círculo principal
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.fillStyle = '#0B0F17';
      ctx.beginPath();
      ctx.arc(sx, sy, SECTOR_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Texto
      ctx.fillStyle = color;
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, sx, sy - 7);
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(sub, sx, sy + 8);
    }

    function drawFlow(from: { x: number; y: number }, to: { x: number; y: number }, label: string, color: string, width: number) {
      if (width < 0.5) return;
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.min(width, 12);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = color;
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.7;
      ctx.fillText(label, mx, my);
      ctx.globalAlpha = 1;
    }

    function drawParticles() {
      const p = paramsRef.current;
      const Y = gdpOf(p);

      // Escalas: tamaño del flujo ∝ magnitud de cada componente
      const scales: Record<number, number> = {
        0: p.C / 20,
        1: p.I / 10,
        2: 1.0,
        3: p.G / 12,
        4: p.X / 15,
        5: p.M / 15,
      };

      for (let i = 0; i < particlesRef.current.length; i++) {
        const pt = particlesRef.current[i];
        const flowIdx = Math.floor(i / 5) % 6;   // aprox 5 partículas por flujo
        const scale = scales[flowIdx] ?? 1;

        // Actualizar posición
        pt.t += pt.speed * scale;
        if (pt.t >= 1) { pt.t = 0; }

        const et = easeInOut(pt.t);
        const px = lerp(pt.x, pt.tx, et) + Math.sin(pt.t * Math.PI * 2 + i) * 5;
        const py = lerp(pt.y, pt.ty, et);

        const alpha = pt.alpha * Math.sin(pt.t * Math.PI);
        if (alpha <= 0) continue;

        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(px, py, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      return Y;
    }

    function drawBars(p: GDPParams, Y: number) {
      // Panel de barras en la esquina inferior derecha
      const bx = W - 185;
      const by = 28;
      const bw = 165;
      const bh = H - 56;

      // Fondo
      ctx.fillStyle = '#070A11';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = '#64748B';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('COMPOSICIÓN DEL PIB', bx + bw / 2, by + 10);

      if (Y <= 0) return;

      const barX = bx + 14;
      const barW = bw - 28;
      const barTop = by + 20;
      const barBot = by + bh - 34;
      const barH = barBot - barTop;

      const components: Array<{ label: string; value: number; color: string }> = [
        { label: 'C', value: p.C, color: BAR_COLORS.C },
        { label: 'I', value: p.I, color: BAR_COLORS.I },
        { label: 'G', value: p.G, color: BAR_COLORS.G },
        { label: 'NX', value: p.X - p.M, color: p.X - p.M >= 0 ? BAR_COLORS.NX_pos : BAR_COLORS.NX_neg },
      ];

      let yOff = barTop;
      for (const comp of components) {
        if (comp.value === 0) continue;
        const frac = Math.abs(comp.value) / Math.abs(Y);
        const h = frac * barH;
        const absH = Math.max(h, 0);

        ctx.save();
        ctx.shadowColor = comp.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = comp.color + 'CC';
        if (comp.value >= 0) {
          ctx.fillRect(barX, yOff, barW, absH);
          ctx.fillStyle = '#0B0F17';
          ctx.font = 'bold 10px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.shadowBlur = 0;
          ctx.fillText(comp.label, barX + barW / 2, yOff + Math.min(absH / 2, 10) + 2);
          yOff += absH + 2;
        } else {
          // NX negativo — barra hacia abajo distinta
          ctx.fillStyle = BAR_COLORS.NX_neg + '88';
          ctx.fillRect(barX, yOff, barW, absH);
          ctx.fillStyle = '#0B0F17';
          ctx.font = 'bold 10px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.shadowBlur = 0;
          ctx.fillText('NX−', barX + barW / 2, yOff + Math.min(absH / 2, 10) + 2);
          yOff += absH + 2;
        }
        ctx.restore();
      }

      // Etiqueta del PIB total
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Y = ${Y.toFixed(1)}`, bx + bw / 2, barBot + 14);
      ctx.fillStyle = '#475569';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText('(% base)', bx + bw / 2, barBot + 25);
    }

    function drawIdentityCheck(p: GDPParams, tValue: number) {
      const Sp = savingPriv(p, tValue);
      const Sg = savingGov(p, tValue);
      const Sf = savingExt(p);
      const ok = checkIdentity(p, tValue);

      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';

      const lx = 8, ly = H - 46;
      ctx.fillStyle = '#334155';
      ctx.fillText('SCN · identidad S-I:', lx, ly);
      ctx.fillStyle = ok ? '#34D399' : '#EF4444';
      ctx.fillText(`Sp(${Sp.toFixed(1)}) + Sg(${Sg.toFixed(1)}) + Sf(${Sf.toFixed(1)}) = I(${p.I.toFixed(1)})  ${ok ? '✓' : '✗'}`, lx, ly + 12);

      ctx.fillStyle = '#334155';
      ctx.fillText('Y = C + I + G + NX', lx, ly + 26);
    }

    function draw() {
      if (!ctx) return;
      const p = paramsRef.current;
      const isCrisis = crisisRef.current;

      // Fondo
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0B0F17');
      bg.addColorStop(1, '#070A11');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Overlay de crisis
      if (isCrisis) {
        ctx.fillStyle = 'rgba(239,68,68,0.035)';
        ctx.fillRect(0, 0, W - 185, H);
        ctx.fillStyle = '#EF444433';
        ctx.font = 'bold 11px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ CRISIS: inversión colapsada', (W - 185) / 2, 16);
      }

      const Y = gdpOf(p);
      const NX = p.X - p.M;

      // Flujos de fondo (líneas gruesas suaves)
      drawFlow(SECTORS.hogares, SECTORS.empresas, `C=${p.C.toFixed(0)}`, BAR_COLORS.C, p.C / 8);
      drawFlow(SECTORS.empresas, SECTORS.hogares, `I=${p.I.toFixed(0)}`, BAR_COLORS.I, p.I / 6);
      drawFlow(SECTORS.hogares, SECTORS.gobierno, `T=${T}`, BAR_COLORS.G, T / 6);
      drawFlow(SECTORS.gobierno, SECTORS.empresas, `G=${p.G.toFixed(0)}`, BAR_COLORS.G, p.G / 6);
      drawFlow(SECTORS.empresas, SECTORS.exterior, `X=${p.X.toFixed(0)}`, BAR_COLORS.NX_pos, p.X / 8);
      drawFlow(SECTORS.exterior, SECTORS.empresas, `M=${p.M.toFixed(0)}`, BAR_COLORS.NX_neg, p.M / 8);

      // Partículas
      drawParticles();

      // Sectores
      const Sp = savingPriv(p, T);
      const Sg = savingGov(p, T);
      drawSector(SECTORS.hogares.x,  SECTORS.hogares.y,  SECTORS.hogares.label,  SECTORS.hogares.color,  `C=${p.C.toFixed(0)}`);
      drawSector(SECTORS.empresas.x, SECTORS.empresas.y, SECTORS.empresas.label, SECTORS.empresas.color, `I=${p.I.toFixed(0)}`);
      drawSector(SECTORS.gobierno.x, SECTORS.gobierno.y, SECTORS.gobierno.label, SECTORS.gobierno.color, `G=${p.G.toFixed(0)}`);
      drawSector(SECTORS.exterior.x, SECTORS.exterior.y, SECTORS.exterior.label, SECTORS.exterior.color, `NX=${NX.toFixed(0)}`);

      // PIB total en el centro
      const cx = (W - 185) / 2;
      const cy = H / 2;
      ctx.save();
      ctx.shadowColor = '#FDB813';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#FDB813';
      ctx.font = 'bold 22px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Y = ${Y.toFixed(1)}`, cx, cy - 8);
      ctx.restore();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('C + I + G + NX', cx, cy + 14);

      // Barras
      drawBars(p, Y);

      // Identidad SCN al pie
      drawIdentityCheck(p, T);

      // Stats cada 12 frames
      if (frame % 12 === 0) {
        setStats({ Y, NX, Sp: savingPriv(p, T), Sg, Sf: savingExt(p) });
      }
    }

    function loop() {
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); };
  }, []); // solo al montar

  const NX = X - M;
  const Y = C + I + G + NX;
  const surplus = T - G;

  const insight = crisis
    ? Y < 90
      ? `Crisis activa: la inversión se desplomó ${(DEFAULTS.I - I).toFixed(0)} puntos. El PIB cayó a ${Y.toFixed(1)}. Dale "Rescate fiscal" para que el gobierno compense con gasto público — así lo hizo EE.UU. en 2009.`
      : `El gasto de gobierno compensó el colapso de inversión. PIB estabilizado en ${Y.toFixed(1)}. Así funciona la política fiscal anticíclica — sin las cuentas de Stone, nadie sabría cuánto gastar.`
    : Math.abs(NX) < 2
      ? 'Balanza comercial casi equilibrada. Tus importaciones igualan exportaciones. Intenta abrir la crisis para ver cómo un colapso de inversión impacta toda la estructura.'
      : NX > 0
        ? `Superávit comercial de ${NX.toFixed(1)}: exportas más de lo que importas. El exterior financia tu acumulación de activos.`
        : `Déficit comercial de ${Math.abs(NX).toFixed(1)}: el exterior te presta para financiar más consumo e inversión de lo que produces.`;

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

          {/* Botones de acción */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={triggerCrisis}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition ${
                crisis
                  ? 'border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20'
                  : 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20'
              }`}
            >
              {crisis ? '↩ restaurar economía' : '💥 crisis 2008 (I colapsa)'}
            </button>
            {crisis && (
              <button
                onClick={triggerRescate}
                className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#A78BFA]/40 bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/20 transition"
              >
                🏛 rescate fiscal (+G)
              </button>
            )}
          </div>

          {/* Stats rápidos */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="PIB total" value={`${Y.toFixed(1)}`} sub="C+I+G+NX" accent="#FDB813" />
            <Stat label="Balanza NX" value={`${NX >= 0 ? '+' : ''}${NX.toFixed(1)}`} sub={NX >= 0 ? 'superávit' : 'déficit'} accent={NX >= 0 ? '#34D399' : '#EF4444'} />
            <Stat label="Fisco Sg" value={`${surplus >= 0 ? '+' : ''}${surplus.toFixed(1)}`} sub={surplus >= 0 ? 'superávit' : 'déficit'} accent={surplus >= 0 ? '#A78BFA' : '#F472B6'} />
          </div>

          {/* Panel de insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>

          {/* Identidad S-I */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono mb-2">▸ identidad ahorro-inversión (SCN)</div>
            <div className="text-[12px] font-mono leading-relaxed space-y-1">
              <div className="flex gap-6 flex-wrap">
                <span className="text-[#4FC3F7]">Sp = Y−T−C = <b>{stats.Sp.toFixed(1)}</b></span>
                <span className="text-[#A78BFA]">Sg = T−G = <b>{stats.Sg.toFixed(1)}</b></span>
                <span className="text-[#34D399]">Sf = M−X = <b>{stats.Sf.toFixed(1)}</b></span>
              </div>
              <div className="text-[#FDB813]">
                Sp + Sg + Sf = {(stats.Sp + stats.Sg + stats.Sf).toFixed(1)} ≈ I = {I.toFixed(1)}
                <span className={`ml-2 ${Math.abs(stats.Sp + stats.Sg + stats.Sf - I) < 0.5 ? 'text-[#34D399]' : 'text-[#EF4444]'}`}>
                  {Math.abs(stats.Sp + stats.Sg + stats.Sf - I) < 0.5 ? '✓ SCN OK' : '≠ ajusta T'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de sliders */}
        <div className="space-y-5 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-5 h-fit">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono">⚙ Mueve la economía</div>

          <Slider
            label="C — Consumo privado"
            value={C} min={20} max={90} step={1}
            onChange={setC}
            fmt={v => `${v.toFixed(0)} %`}
            hint="Hogares gastan en bienes y servicios. Mayor MPC → mayor multiplicador."
            color="#4FC3F7"
          />
          <Slider
            label="I — Inversión privada"
            value={I} min={2} max={45} step={1}
            onChange={setI}
            fmt={v => `${v.toFixed(0)} %`}
            hint="Empresas invierten en capital físico. El componente más volátil del PIB."
            color="#FDB813"
          />
          <Slider
            label="G — Gasto gobierno"
            value={G} min={5} max={40} step={1}
            onChange={setG}
            fmt={v => `${v.toFixed(0)} %`}
            hint="Compras del sector público. Instrumento fiscal anticíclico."
            color="#A78BFA"
          />
          <Slider
            label="X — Exportaciones"
            value={X} min={5} max={70} step={1}
            onChange={setX}
            fmt={v => `${v.toFixed(0)} %`}
            hint="Demanda del exterior por tus bienes. Sube con tipo de cambio débil."
            color="#34D399"
          />
          <Slider
            label="M — Importaciones"
            value={M} min={5} max={70} step={1}
            onChange={setM}
            fmt={v => `${v.toFixed(0)} %`}
            hint="Bienes del exterior que consumes. Salen del PIB (NX = X − M)."
            color="#EF4444"
          />
          <Slider
            label="T — Impuestos"
            value={T} min={5} max={40} step={1}
            onChange={setT}
            fmt={v => `${v.toFixed(0)} %`}
            hint="Solo afecta el ahorro del gobierno (Sg = T−G) y privado (Sp = Y−T−C). No entra directo al PIB gasto."
            color="#FB923C"
          />

          <div className="text-[10px] font-mono text-[#475569] border-t border-[#1E293B] pt-3 leading-relaxed">
            Y = C + I + G + (X−M)<br />
            I = Sp + Sg + Sf (SCN · Stone 1953)<br />
            valores en % del PIB base
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] text-[#475569] font-mono mt-0.5">{sub}</div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt, hint, color,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string; color?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12px] text-[#94A3B8] font-medium">{label}</label>
        <span className="text-[12px] font-mono" style={{ color: color ?? '#FDB813' }}>
          {fmt ? fmt(value) : value.toFixed(1)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#4FC3F7]"
      />
      {hint && <div className="text-[10px] text-[#64748B] leading-snug">{hint}</div>}
    </div>
  );
}
