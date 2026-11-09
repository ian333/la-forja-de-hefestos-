/**
 * EL CIRCUITO DE LA PLUMA, VIVO (orden 2026-11-05-la-pluma-circuito-cableado)
 * ===========================================================================
 * El esquemático se dibuja de los mismos elementos que simula el MNA (plumaSistema.ts): la corriente que corre por
 * cada cable es la de su rama, los voltajes son los de sus nodos, la compuerta se prende cuando el PI del firmware la
 * prende. Tres pestañas: ⚡ circuito · 🔌 cables (lista de corte + revisor) · 🌡 límites (dónde se rompe el diseño).
 * <CalorPluma> pinta en el 3D el calor de cada pieza (con su temperatura simulada).
 * Ultraliviano: SVG + refs; React no se re-renderiza por cuadro (solo el contenido de las pestañas, 4 veces por s).
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  CABLES, CALIBRES, CALOR, Z0_BANCO, listaDeCorte, revisarCableado, limitesPluma, tempEstable, TERMICO, type PlumaSim,
  PINES, revisarPines, slicePWM, RP2350B, J_PWR_PINOUT,
} from './plumaSistema';

interface ConPluma { current: { pluma: PlumaSim | null; verCircuito: boolean; ventilador: boolean; circuitoOn: boolean } }

// ── las ramas del esquemático: id, trazo SVG y de dónde sale su corriente ──
type Fuente = (p: PlumaSim) => number;
const RAMAS: Array<{ id: string; d: string; I: Fuente }> = [
  { id: 'lrs', d: 'M120 60 H200', I: (p) => (p.st.v[1] - p.st.v[2]) / p.p.Rlrs },
  { id: 'bus', d: 'M200 60 H380 V96', I: (p) => p.st.hist.get('Q1')?.i ?? 0 },
  { id: 'cbus', d: 'M230 60 V150', I: (p) => p.st.hist.get('Cbus')?.i ?? 0 },
  { id: 'cfilm', d: 'M290 60 V150', I: (p) => p.st.hist.get('Cfilm')?.i ?? 0 },
  { id: 'd1', d: 'M380 270 V182', I: (p) => p.st.hist.get('D1')?.i ?? 0 },
  { id: 'l', d: 'M380 180 H540', I: (p) => p.IL },
  { id: 'out', d: 'M540 180 H700', I: (p) => p.Iout },
  { id: 'arco', d: 'M700 180 H780', I: (p) => p.Iout },
  { id: 'ret', d: 'M780 180 H800 V270 H20 V120', I: (p) => p.Iout },
];

export function PlumaPanel({ sim }: { sim: ConPluma }) {
  const [tab, setTab] = useState<'circ' | 'cables' | 'pines' | 'lim'>('circ');
  const [min, setMin] = useState(false);
  const [, tick] = useState(0);
  const rama = useRef<Record<string, SVGPathElement | null>>({});
  const txt = useRef<Record<string, SVGTextElement | null>>({});
  const gate = useRef<SVGCircleElement | null>(null);
  const osc = useRef<Record<string, SVGPathElement | null>>({});
  const off = useRef<Record<string, number>>({});
  const revision = useMemo(() => revisarCableado(), []);
  const corte = useMemo(() => listaDeCorte(), []);
  const revPines = useMemo(() => revisarPines(), []);
  useEffect(() => { const id = setInterval(() => tick((t) => t + 1), 250); return () => clearInterval(id); }, []);
  // 60 fps: corriente que corre, voltajes, compuerta, osciloscopio — por refs
  useEffect(() => {
    let raf = 0, t0 = performance.now();
    const f = (now: number) => {
      raf = requestAnimationFrame(f);
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      const p = sim.current.pluma; if (!p || min || tab !== 'circ') return;
      for (const r of RAMAS) {
        const el = rama.current[r.id]; if (!el) continue;
        const I = r.I(p), a = Math.abs(I);
        off.current[r.id] = ((off.current[r.id] ?? 0) - Math.sign(I) * dt * (8 + a * 2.2)) % 1000;
        el.style.strokeDashoffset = String(off.current[r.id]);
        el.style.strokeWidth = String(1.4 + Math.min(4.5, a / 12));
        el.style.opacity = String(0.35 + Math.min(0.65, a / 40));
      }
      const v = p.st.v, T = (k: string, s: string) => { const e = txt.current[k]; if (e) e.textContent = s; };
      T('vbus', `${p.Vbus.toFixed(1)} V`); T('vsw', `${p.Vsw.toFixed(1)} V`); T('vout', `${(v[8] ?? 0).toFixed(1)} V`);
      T('iout', `${p.Iout.toFixed(1)} A`); T('il', `I_L ${p.IL.toFixed(1)} A`); T('varc', `arco ${p.Vout.toFixed(1)} V`);
      T('duty', `D = ${p.D.toFixed(3)}`); T('iref', `pide ${p.Iref.toFixed(1)} A`); T('lrs', `${(p.lrsCarga * 100).toFixed(0)} %${p.lrsApagada ? ' APAGADA' : p.lrsLimitando ? ' · LIMITA 30 A' : ''}`);
      T('ibus', `${p.IrmsBus.toFixed(1)} A rms`); T('ifilm', `${p.IrmsFilm.toFixed(1)} A rms`);
      for (const [k, key] of [['tq1', 'Q1'], ['td1', 'D1'], ['tl', 'L'], ['tc', 'Cbus'], ['tsh', 'Rsh']] as const) T(k, `${p.T[key].toFixed(0)}°`);
      if (gate.current) gate.current.style.fill = p.gate ? '#4fd6ff' : '#1d2733';
      // osciloscopio: los últimos 40 µs
      const h = p.hist; if (h.length > 2) {
        const tf = h[h.length - 1].t, ti = tf - 40e-6, W = 300, H = 92;
        const x = (t: number) => ((t - ti) / 40e-6) * W;
        const linea = (g: (m: (typeof h)[number]) => number, lo: number, hi: number) => {
          let d = ''; for (const m of h) { if (m.t < ti) continue; const y = H - ((g(m) - lo) / (hi - lo)) * H; d += `${d ? 'L' : 'M'}${x(m.t).toFixed(1)},${Math.max(0, Math.min(H, y)).toFixed(1)}`; }
          return d;
        };
        osc.current.i?.setAttribute('d', linea((m) => m.Iout, 0, 90));
        osc.current.r?.setAttribute('d', linea((m) => m.Iref, 0, 90));
        osc.current.g?.setAttribute('d', linea((m) => m.gate * 0.18 + 0.02, 0, 1));
        osc.current.v?.setAttribute('d', linea((m) => m.Vsw, -5, 55));
      }
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [sim, min, tab]);

  const S = sim.current, p = S.pluma;
  if (!S.verCircuito || !p) return null;
  const errores = revision.filter((x) => x.nivel === 'error'), avisos = revision.filter((x) => x.nivel === 'aviso');
  const lims = limitesPluma(p, S.ventilador);
  const Te = tempEstable(p, S.ventilador);
  const pasa = lims.filter((l) => l.estado === 'pasa').length;
  const temp = (k: 'tq1' | 'td1' | 'tl' | 'tc' | 'tsh', x: number, y: number) => (
    <g><rect x={x - 2} y={y - 11} width={34} height={14} rx={3} className="pc-temp" /><text ref={(e) => { txt.current[k] = e; }} x={x + 15} y={y} className="pc-temp-t" textAnchor="middle">—</text></g>
  );
  return (
    <div className={`pc-panel ${min ? 'min' : ''}`} data-testid="pluma-panel">
      <style>{CSS_PC}</style>
      <div className="pc-cab">
        <button className="pc-tit" onClick={() => setMin((m) => !m)}>{min ? '▸' : '▾'} LA PLUMA · CIRCUITO VIVO</button>
        <span className={`pc-chip ${S.circuitoOn ? 'on' : ''}`}>{S.circuitoOn ? 'MNA real · 100 kHz' : 'corriente ideal'}</span>
        <span className={`pc-chip ${pasa ? 'mal' : 'ok'}`}>{pasa ? `${pasa} límite${pasa > 1 ? 's' : ''} rebasado${pasa > 1 ? 's' : ''}` : 'dentro de límites'}</span>
        <span className={`pc-chip ${errores.length ? 'mal' : 'ok'}`}>{errores.length ? `${errores.length} error de cableado` : `cableado sin errores · ${CABLES.length} cables`}</span>
        <button className="pc-x" onClick={() => { sim.current.verCircuito = false; tick((t) => t + 1); }}>✕</button>
      </div>
      {!min && (<>
        <div className="pc-tabs">
          {([['circ', '⚡ circuito'], ['cables', '🔌 cables'], ['pines', '📍 pines RP2350'], ['lim', '🌡 límites']] as const).map(([k, n]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>
          ))}
          <label className="pc-chk"><input type="checkbox" checked={S.circuitoOn} onChange={(e) => { sim.current.circuitoOn = e.target.checked; tick((t) => t + 1); }} /> circuito real</label>
          <label className="pc-chk"><input type="checkbox" checked={S.ventilador} onChange={(e) => { sim.current.ventilador = e.target.checked; tick((t) => t + 1); }} /> ventilador</label>
        </div>
        {tab === 'circ' && (
          <div className="pc-cuerpo">
            <svg viewBox="0 0 960 300" className="pc-esq">
              {/* control: Pico → PWM → IR2110 */}
              <path d="M880 104 V22 H325 V118" className="pc-ctrl" />
              <text x={600} y={16} className="pc-lbl c">PWM 100 kHz · PI del RP2350</text>
              {/* rieles */}
              <path d="M20 270 H920" className="pc-alambre" />
              <path d="M200 60 H380" className="pc-alambre" />
              {RAMAS.map((r) => <path key={r.id} ref={(e) => { rama.current[r.id] = e; }} d={r.d} className="pc-corr" />)}
              {/* LRS */}
              <rect x={20} y={36} width={100} height={84} rx={6} className="pc-caja" />
              <text x={70} y={58} className="pc-lbl" textAnchor="middle">LRS-1200-48</text>
              <text x={70} y={76} className="pc-lbl d" textAnchor="middle">48 V · 1200 W</text>
              <text ref={(e) => { txt.current.lrs = e; }} x={70} y={102} className="pc-val a" textAnchor="middle">—</text>
              <path d="M140 54 h30 v12 h-30 z" className="pc-sim" /><text x={155} y={48} className="pc-lbl d" textAnchor="middle">40 A</text>
              <text ref={(e) => { txt.current.vbus = e; }} x={206} y={50} className="pc-val">—</text>
              {/* capacitores */}
              <path d="M220 150 h20 M220 157 q10 -5 20 0 M230 157 V270" className="pc-sim" />
              <text x={226} y={186} className="pc-lbl d">2×2200µ</text><text ref={(e) => { txt.current.ibus = e; }} x={226} y={200} className="pc-val">—</text>
              <path d="M280 150 h20 M280 157 h20 M290 157 V270" className="pc-sim" />
              <text x={286} y={214} className="pc-lbl d">3×10µ</text><text ref={(e) => { txt.current.ifilm = e; }} x={286} y={228} className="pc-val">—</text>
              {temp('tc', 240, 140)}
              {/* Q1 + compuerta */}
              <path d="M380 96 V108 M366 108 V152 M372 108 V152 M372 112 H380 V96 M372 148 H380 V180 M352 130 H366" className="pc-sim" />
              <text x={394} y={118} className="pc-lbl">Q1 IRFB4227</text>
              <text ref={(e) => { txt.current.duty = e; }} x={394} y={134} className="pc-val">—</text>
              <rect x={300} y={118} width={50} height={26} rx={4} className="pc-caja" /><text x={325} y={135} className="pc-lbl d" textAnchor="middle">IR2110</text>
              <circle ref={gate} cx={352} cy={130} r={5} className="pc-gate" />
              {temp('tq1', 394, 156)}
              <text ref={(e) => { txt.current.vsw = e; }} x={392} y={198} className="pc-val">—</text>
              {/* D1 */}
              <path d="M370 236 h20 l-10 -16 z M370 220 h20" className="pc-sim" /><text x={330} y={236} className="pc-lbl">D1</text>
              {temp('td1', 394, 238)}
              {/* choque */}
              <path d="M420 180 q8 -16 16 0 q8 -16 16 0 q8 -16 16 0 q8 -16 16 0" className="pc-sim grueso" />
              <text x={428} y={156} className="pc-lbl">15 µH</text>
              <text ref={(e) => { txt.current.il = e; }} x={428} y={204} className="pc-val">—</text>
              {temp('tl', 492, 156)}
              {/* Cout + D2 */}
              <path d="M550 180 V214 M540 214 h20 M540 221 h20 M550 221 V270" className="pc-sim" />
              <path d="M590 180 V120 M580 132 h20 l-10 -14 z M580 118 h20 M590 118 V60" className="pc-sim delgado" />
              <text x={604} y={110} className="pc-lbl d">D2 → bus</text>
              <text ref={(e) => { txt.current.vout = e; }} x={548} y={168} className="pc-val">—</text>
              {/* barra + y arco */}
              <text x={612} y={172} className="pc-lbl d">barra + → mesa</text>
              <text ref={(e) => { txt.current.iout = e; }} x={612} y={198} className="pc-val a">—</text>
              <circle cx={700} cy={180} r={4} className="pc-nodo" /><text x={690} y={162} className="pc-lbl">MESA +</text>
              <path d="M708 180 l10 -10 l8 16 l8 -18 l8 18 l8 -16 l10 10" className="pc-arco" />
              <text ref={(e) => { txt.current.varc = e; }} x={712} y={212} className="pc-val m">—</text>
              <circle cx={780} cy={180} r={4} className="pc-nodo" /><text x={768} y={162} className="pc-lbl">ALAMBRE −</text>
              {/* shunt + INA240 + Pico */}
              <path d="M794 222 h12 v24 h-12 z" className="pc-sim" /><text x={812} y={238} className="pc-lbl d">0.5 mΩ</text>
              {temp('tsh', 812, 256)}
              <rect x={840} y={206} width={70} height={30} rx={4} className="pc-caja" /><text x={875} y={225} className="pc-lbl d" textAnchor="middle">INA240</text>
              <path d="M806 226 H840" className="pc-ctrl" />
              <rect x={830} y={104} width={100} height={52} rx={6} className="pc-caja pico" />
              <text x={880} y={124} className="pc-lbl" textAnchor="middle">RP2350</text>
              <text ref={(e) => { txt.current.iref = e; }} x={880} y={142} className="pc-val" textAnchor="middle">—</text>
              <path d="M875 206 V156" className="pc-ctrl" />
              <path d="M12 270 h16 M15 276 h10 M18 282 h4" className="pc-alambre" />
            </svg>
            <div className="pc-osc">
              <svg viewBox="0 0 300 92" className="pc-osc-svg">
                {[0.25, 0.5, 0.75].map((k) => <line key={k} x1={0} x2={300} y1={92 * k} y2={92 * k} className="pc-grid" />)}
                <path ref={(e) => { osc.current.g = e; }} className="pc-o-g" />
                <path ref={(e) => { osc.current.v = e; }} className="pc-o-v" />
                <path ref={(e) => { osc.current.r = e; }} className="pc-o-r" />
                <path ref={(e) => { osc.current.i = e; }} className="pc-o-i" />
              </svg>
              <div className="pc-ley"><span className="i">━ I salida</span> <span className="r">┄ I pedida</span> <span className="v">━ V_sw</span> <span className="g">▁ compuerta</span> · 40 µs</div>
            </div>
          </div>
        )}
        {tab === 'cables' && (
          <div className="pc-cuerpo col">
            <div className="pc-rev">{errores.length ? errores.map((e, i) => <div key={i} className="e">✗ {e.regla} · {e.texto}</div>)
              : <div className="ok">✓ El revisor no encontró errores en {CABLES.length} cables (pines, ampacidad, caída, fuentes por red, DCEN, PARO en la fase, pares, colores).</div>}
              {avisos.map((e, i) => <div key={'a' + i} className="w">⚠ {e.regla} · {e.texto}</div>)}</div>
            <table className="pc-tabla">
              <thead><tr><th>#</th><th>cable</th><th>de → a</th><th>calibre</th><th></th><th>corte</th><th>carga</th></tr></thead>
              <tbody>{corte.map((c) => (
                <tr key={c.id}><td>{c.id}</td><td>{c.nombre}</td><td className="m">{c.de} → {c.a}</td><td>{c.calibre}</td>
                  <td><i style={{ background: c.color }} /></td><td>{c.largo_mm} mm</td><td className={c.carga_pct > 60 ? 'w' : ''}>{c.carga_pct} %</td></tr>
              ))}</tbody>
            </table>
            <div className="pc-pie">cobre total {(corte.reduce((a, c) => a + c.largo_mm, 0) / 1000).toFixed(2)} m · el largo sale de la ruta 3D ×1.08 + 50 mm de pelado y terminal · calibres: {[...new Set(CABLES.map((c) => CALIBRES[c.calibre].nombre))].join(', ')}</div>
          </div>
        )}
        {tab === 'pines' && (
          <div className="pc-cuerpo col">
            <div className="pc-rev">{revPines.some((e) => e.nivel === 'error') ? revPines.filter((e) => e.nivel === 'error').map((e, i) => <div key={i} className="e">✗ {e.regla} · {e.texto}</div>)
              : <div className="ok">✓ {PINES.length} GPIO revisados contra el SDK del RP2350B (rp2350b_interface_pins.json): slices de PWM sin choques de frecuencia, ADC solo en GP40–47 ({PINES.filter((q) => q.tipo === 'adc').length}/{RP2350B.adcCanales}), UART en su tabla, el plano J_PWR sin hilos repetidos.</div>}</div>
            <table className="pc-tabla">
              <thead><tr><th>GPIO</th><th>tipo</th><th>va a</th><th>por</th><th>nota</th></tr></thead>
              <tbody>{PINES.map((q) => {
                const sl = q.tipo === 'pwm' ? slicePWM(q.gpio) : null;
                return (<tr key={q.gpio}><td>GP{q.gpio}</td><td>{q.tipo}{sl ? ` · ${sl.slice}${sl.canal} · ${(q.frec ?? 0) / 1e3} kHz` : q.tipo === 'adc' ? ` · ch${q.gpio - RP2350B.adcBase}` : ''}</td>
                  <td>{q.va}</td><td className="m">{q.por ?? ''}</td><td className="m">{q.nota ?? ''}</td></tr>);
              })}</tbody>
            </table>
            <div className="pc-pie">plano J_PWR (10 hilos): {J_PWR_PINOUT.map((n, i) => `${i + 1} ${n}`).join(' · ')} · el Pico 2 (RP2350A) solo da 3 ADC libres; el RP2350B de nuestra PCB da 8 → hay NTC en el disipador y en el choque, y el termostato NC sigue como protección de fierro.</div>
          </div>
        )}
        {tab === 'lim' && (
          <div className="pc-cuerpo col">
            <table className="pc-tabla">
              <thead><tr><th>límite</th><th>ahora</th><th>tope</th><th></th></tr></thead>
              <tbody>{lims.map((l) => (
                <tr key={l.nombre} title={l.nota}><td>{l.nombre}</td><td>{l.valor}</td><td className="m">{l.tope}</td>
                  <td className={l.estado === 'pasa' ? 'e' : l.estado === 'justo' ? 'w' : 'ok'}>{l.estado === 'pasa' ? '✗ se pasa' : l.estado === 'justo' ? '⚠ justo' : '✓'}</td></tr>
              ))}</tbody>
            </table>
            <div className="pc-pie">
              pérdidas ahora: Q1 {p.P.Q1.toFixed(1)} W · D1 {p.P.D1.toFixed(1)} W · choque {p.P.L.toFixed(1)} W · electrolíticos {p.P.Cbus.toFixed(2)} W · shunt {p.P.Rsh.toFixed(2)} W · al arco {p.P.arco.toFixed(0)} W de {p.P.LRS.toFixed(0)} W ({p.P.LRS > 1 ? ((100 * p.P.arco) / p.P.LRS).toFixed(0) : '—'} %)
              · temperaturas: «ahora» corre en tiempo de pared como si el arco no parara; «estable» es a dónde llega. Disipador {Te.disipador.toFixed(0)} °C estable (θ {S.ventilador ? TERMICO.disipador.thetaSA_vent : TERMICO.disipador.thetaSA_aire} K/W {S.ventilador ? 'con' : 'sin'} ventilador).
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// EL CALOR EN EL 3D: cada pieza brilla con su temperatura simulada
// ════════════════════════════════════════════════════════════════════════════════════════════
let _tex: THREE.Texture | null = null;
function tex(): THREE.Texture {
  if (_tex) return _tex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _tex = new THREE.CanvasTexture(c); return _tex;
}
const colorT = (T: number, c: THREE.Color) => {
  const u = Math.max(0, Math.min(1, (T - 35) / 110));   // 35 °C frío → 145 °C blanco-rojo
  return c.setRGB(0.25 + 0.75 * Math.min(1, u * 1.6), 0.3 + 0.5 * Math.max(0, u - 0.5) * 2 * 0.6, 0.9 * (1 - u) + 0.15 * Math.max(0, u - 0.8) * 5);
};
export function CalorPluma({ sim }: { sim: ConPluma }) {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const p = sim.current.pluma, on = !!p && sim.current.circuitoOn;
    CALOR.forEach((c, i) => {
      const s = refs.current[i]; if (!s) return;
      s.visible = on;
      if (!p || !on) return;
      const T = p.T[c.pieza], d = Math.max(0, T - 35);
      const k = c.r * (0.5 + Math.min(1.6, d / 60));
      s.scale.set(k, k, 1);
      const m = s.material as THREE.SpriteMaterial;
      colorT(T, m.color); m.opacity = Math.min(0.85, 0.08 + d / 120);
    });
  });
  return (
    <group>
      {CALOR.map((c, i) => (
        <sprite key={c.pieza} ref={(e) => { refs.current[i] = e; }} position={[c.pos[0], c.pos[1], c.pos[2] + Z0_BANCO]} renderOrder={6}>
          <spriteMaterial map={tex()} color={colorT(30, col.clone())} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

const CSS_PC = `
.pc-panel{position:absolute;left:258px;bottom:92px;z-index:7;width:min(760px,calc(100% - 650px));min-width:560px;
  background:rgba(5,9,15,0.9);border:1px solid rgba(159,179,200,0.2);border-radius:10px;padding:8px 10px;
  font:11px/1.35 'JetBrains Mono',ui-monospace,monospace;color:#cfd8e3;box-shadow:0 10px 30px rgba(0,0,0,0.45);}
.pc-panel.min{width:auto;min-width:0;}
.pc-cab{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.pc-tit{all:unset;cursor:pointer;color:#f4b942;font-weight:700;letter-spacing:.06em;font-size:10.5px;}
.pc-chip{font-size:9.5px;padding:2px 7px;border-radius:9px;border:1px solid rgba(159,179,200,0.25);color:#9fb0c3;}
.pc-chip.on{border-color:#4fd6ff;color:#9fe7ff;} .pc-chip.ok{border-color:#2e9d4a;color:#8fe0a5;} .pc-chip.mal{border-color:#e05252;color:#ff9a9a;}
.pc-x{all:unset;cursor:pointer;margin-left:auto;color:#8193a8;}
.pc-tabs{display:flex;gap:6px;margin:7px 0 6px;align-items:center;flex-wrap:wrap;}
.pc-tabs button{all:unset;cursor:pointer;padding:3px 9px;border-radius:5px;border:1px solid rgba(159,179,200,0.22);font-size:10.5px;}
.pc-tabs button.on{background:rgba(244,185,66,0.16);border-color:#f4b942;color:#f4d27a;}
.pc-chk{font-size:10px;color:#9fb0c3;} .pc-chk input{accent-color:#f4b942;vertical-align:-2px;}
.pc-cuerpo{display:flex;gap:10px;align-items:flex-start;} .pc-cuerpo.col{flex-direction:column;align-items:stretch;max-height:300px;overflow:auto;}
.pc-esq{flex:1 1 auto;min-width:0;height:auto;background:rgba(0,0,0,0.3);border-radius:6px;border:1px solid rgba(159,179,200,0.1);}
.pc-alambre{fill:none;stroke:#566476;stroke-width:1.6;}
.pc-corr{fill:none;stroke:#ffc94a;stroke-dasharray:6 9;stroke-linecap:round;filter:drop-shadow(0 0 3px rgba(255,190,70,.6));}
.pc-ctrl{fill:none;stroke:#4fd6ff;stroke-width:1.2;stroke-dasharray:3 4;opacity:.7;}
.pc-sim{fill:none;stroke:#cfd8e3;stroke-width:1.8;} .pc-sim.grueso{stroke:#d8935a;stroke-width:2.6;} .pc-sim.delgado{stroke-width:1.2;opacity:.75;}
.pc-arco{fill:none;stroke:#f08ce8;stroke-width:2.4;filter:drop-shadow(0 0 5px #e070e8);}
.pc-caja{fill:#0d141e;stroke:#3a4a5e;} .pc-caja.pico{stroke:#2e9d4a;}
.pc-gate{stroke:#4fd6ff;stroke-width:1;} .pc-nodo{fill:#f4b942;}
.pc-lbl{fill:#9fb0c3;font-size:10px;} .pc-lbl.d{fill:#6f8196;font-size:9px;} .pc-lbl.c{fill:#4fd6ff;font-size:9px;}
.pc-val{fill:#e3e9f0;font-size:10.5px;font-weight:600;} .pc-val.a{fill:#f4b942;} .pc-val.m{fill:#f08ce8;}
.pc-temp{fill:#1a1210;stroke:#e0763a;stroke-width:.8;} .pc-temp-t{fill:#ffb37a;font-size:9.5px;font-weight:700;}
.pc-osc{flex:0 0 220px;} .pc-osc-svg{width:100%;height:auto;background:rgba(0,0,0,.35);border-radius:5px;border:1px solid rgba(159,179,200,.12);}
.pc-grid{stroke:rgba(159,179,200,.12);} .pc-o-i{fill:none;stroke:#f4b942;stroke-width:1.5;} .pc-o-r{fill:none;stroke:#f4b942;stroke-width:1;stroke-dasharray:3 3;opacity:.7;}
.pc-o-v{fill:none;stroke:#4fd6ff;stroke-width:1;opacity:.7;} .pc-o-g{fill:none;stroke:#8fe0a5;stroke-width:1;}
.pc-ley{font-size:9px;color:#7d8fa3;margin-top:3px;} .pc-ley .i,.pc-ley .r{color:#f4b942;} .pc-ley .v{color:#4fd6ff;} .pc-ley .g{color:#8fe0a5;}
.pc-rev{font-size:10.5px;} .pc-rev .ok{color:#8fe0a5;} .pc-rev .e{color:#ff9a9a;} .pc-rev .w{color:#f4d27a;}
.pc-tabla{width:100%;border-collapse:collapse;font-size:10px;margin-top:5px;}
.pc-tabla th{text-align:left;color:#6f8196;font-weight:600;border-bottom:1px solid rgba(159,179,200,.18);padding:3px 5px;}
.pc-tabla td{padding:2px 5px;border-bottom:1px solid rgba(159,179,200,.07);} .pc-tabla td.m{color:#8193a8;}
.pc-tabla td.ok{color:#8fe0a5;} .pc-tabla td.e{color:#ff9a9a;font-weight:700;} .pc-tabla td.w{color:#f4d27a;}
.pc-tabla i{display:inline-block;width:14px;height:8px;border-radius:2px;border:1px solid rgba(255,255,255,.25);}
.pc-pie{margin-top:6px;font-size:9.5px;color:#7d8fa3;}
@media (max-width:1100px){.pc-panel{left:8px;right:8px;width:auto;min-width:0;bottom:92px;} .pc-osc{display:none;}}
`;
