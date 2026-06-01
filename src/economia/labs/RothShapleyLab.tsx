/**
 * RothShapleyLab — laboratorio del premio 2012 (Alvin Roth & Lloyd Shapley).
 *
 * El click: cuando no hay precio, el ORDEN importa todo.
 * Gale-Shapley (1962) demostró que siempre existe un emparejamiento ESTABLE:
 * ningún par preferiría escaparse juntos fuera del sistema.
 *
 * Algoritmo real — Gale-Shapley "Deferred Acceptance" (propuestas de estudiantes):
 *   1. Cada estudiante sin pareja propone a su #1 de su lista (si no lo ha propuesto ya).
 *   2. Cada escuela acepta "provisionalmente" al mejor entre su tentativo + el nuevo.
 *      Rechaza al resto.
 *   3. El rechazado pasa a proponer a su siguiente favorita.
 *   4. Se repite hasta que nadie queda sin pareja o sin opciones.
 *
 * Invariante de estabilidad: si estudiante A prefiere escuela X sobre su match actual,
 *   entonces X prefiere a su propio match actual sobre A. → no hay "pares bloqueadores".
 *
 * Roth lo convirtió en ingeniería real:
 *   - NRMP: 50,000 médicos ← hospitales (EE.UU.)
 *   - Boston / NYC: niños ← escuelas públicas
 *   - Cadenas de donación de riñón (con pesos de compatibilidad)
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/* ─── dimensiones ─────────────────────────────────────────────────── */
const W = 820;
const H = 380;

/* ─── paleta ──────────────────────────────────────────────────────── */
const C = {
  bg:      '#070A11',
  bgCard:  '#0B0F17',
  border:  '#1E293B',
  student: '#38BDF8',   // azul cielo
  school:  '#FB923C',   // naranja
  match:   '#34D399',   // verde éxito
  reject:  '#EF4444',   // rojo rechazo
  text:    '#E2E8F0',
  dim:     '#64748B',
  gold:    '#FDB813',
  propose: '#A78BFA',   // violeta = propuesta en vuelo
};

/* ─── tipos ───────────────────────────────────────────────────────── */
const NAMES_S = ['Ana', 'Beto', 'Cara', 'Dani', 'Elio'];
const NAMES_E = ['UNAM', 'IPN', 'UAM', 'ITAM', 'TEC'];

interface Agent {
  id: number;
  name: string;
}

interface MatchState {
  /** índice en prefs[i] del próximo que propone estudiante i */
  nextProp: number[];
  /** match provisional de cada escuela (-1 = libre) */
  schoolMatch: number[];
  /** match final de cada estudiante (-1 = sin emparejar) */
  studentMatch: number[];
  done: boolean;
  round: number;
  lastProposals: Array<{ s: number; e: number; accepted: boolean }>;
}

/* ─── helpers ─────────────────────────────────────────────────────── */
function makeRandomPrefs(n: number): number[][] {
  return Array.from({ length: n }, () => {
    const row = Array.from({ length: n }, (_, i) => i);
    for (let i = row.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [row[i], row[j]] = [row[j], row[i]];
    }
    return row;
  });
}

function initMatch(n: number): MatchState {
  return {
    nextProp:     Array(n).fill(0),
    schoolMatch:  Array(n).fill(-1),
    studentMatch: Array(n).fill(-1),
    done: false,
    round: 0,
    lastProposals: [],
  };
}

/**
 * Avanza UN paso del algoritmo G-S.
 * Devuelve nuevo estado (inmutable).
 */
function stepGS(
  state: MatchState,
  prefsS: number[][],   // prefsS[student][rank] = school
  prefsE: number[][],   // prefsE[school][rank]  = student
  n: number,
): MatchState {
  const np    = [...state.nextProp];
  const sm    = [...state.schoolMatch];
  const stm   = [...state.studentMatch];
  const proposals: Array<{ s: number; e: number; accepted: boolean }> = [];

  // Recolecta propuestas de todos los estudiantes libres que aún tienen opciones
  let anyProp = false;
  for (let s = 0; s < n; s++) {
    if (stm[s] !== -1) continue;           // ya emparejado
    if (np[s] >= n)    continue;           // sin opciones
    const e = prefsS[s][np[s]];
    np[s]++;
    anyProp = true;

    // Escuela e evalúa
    const current = sm[e];
    let accept = false;
    if (current === -1) {
      accept = true;
    } else {
      // ¿Prefiere a s sobre current?
      const rankS       = prefsE[e].indexOf(s);
      const rankCurrent = prefsE[e].indexOf(current);
      accept = rankS < rankCurrent;
    }

    if (accept) {
      if (current !== -1) {
        stm[current] = -1;   // rechaza al anterior
        proposals.push({ s: current, e, accepted: false });
      }
      sm[e]  = s;
      stm[s] = e;
      proposals.push({ s, e, accepted: true });
    } else {
      proposals.push({ s, e, accepted: false });
    }
  }

  const done = !anyProp;
  return {
    nextProp:     np,
    schoolMatch:  sm,
    studentMatch: stm,
    done,
    round: state.round + (anyProp ? 1 : 0),
    lastProposals: proposals,
  };
}

/**
 * Devuelve todos los pares bloqueadores (inestabilidades).
 * Un par (s, e) es bloqueador si:
 *   - s prefiere e a su match actual
 *   - e prefiere s a su match actual
 */
function findBlockingPairs(
  studentMatch: number[],
  schoolMatch: number[],
  prefsS: number[][],
  prefsE: number[][],
  n: number,
): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let s = 0; s < n; s++) {
    for (let e = 0; e < n; e++) {
      if (studentMatch[s] === e) continue;   // ya emparejados
      const rankE_for_s       = prefsS[s].indexOf(e);
      const rankMatch_for_s   = studentMatch[s] === -1 ? n : prefsS[s].indexOf(studentMatch[s]);
      const rankS_for_e       = prefsE[e].indexOf(s);
      const rankMatch_for_e   = schoolMatch[e] === -1 ? n : prefsE[e].indexOf(schoolMatch[e]);
      if (rankE_for_s < rankMatch_for_s && rankS_for_e < rankMatch_for_e) {
        pairs.push([s, e]);
      }
    }
  }
  return pairs;
}

/* ─── posiciones visuales ─────────────────────────────────────────── */
function posStudent(i: number, n: number): [number, number] {
  const margin = 80, colW = (W * 0.38);
  const step = (H - margin * 2) / Math.max(n - 1, 1);
  return [80, margin + i * step];
}
function posSchool(i: number, n: number): [number, number] {
  const margin = 80, startX = W - 80;
  const step = (H - margin * 2) / Math.max(n - 1, 1);
  return [startX, margin + i * step];
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function RothShapleyLab() {
  const N = 5;

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const stateRef   = useRef<MatchState>(initMatch(N));
  const prefsSRef  = useRef<number[][]>(makeRandomPrefs(N));
  const prefsERef  = useRef<number[][]>(makeRandomPrefs(N));
  const animRef    = useRef<number>(0);
  const flashRef   = useRef<number>(0);  // contador de frames para flash de propuestas

  const [matchState, setMatchState] = useState<MatchState>(initMatch(N));
  const [prefsS, setPrefsS]         = useState<number[][]>(() => prefsSRef.current);
  const [prefsE, setPrefsE]         = useState<number[][]>(() => prefsERef.current);
  const [autoPlay, setAutoPlay]     = useState(false);
  const [speed, setSpeed]           = useState(60);  // frames entre pasos auto
  const [viewMode, setViewMode]     = useState<'match' | 'prefs'>('match');
  const autoFrameRef = useRef(0);

  /* ─── sincronizar refs ──────────────────────────────────────────── */
  useEffect(() => { stateRef.current = matchState; }, [matchState]);
  useEffect(() => { prefsSRef.current = prefsS; },   [prefsS]);
  useEffect(() => { prefsERef.current = prefsE; },   [prefsE]);

  /* ─── reset ─────────────────────────────────────────────────────── */
  const reset = useCallback((randomize = false) => {
    if (randomize) {
      const ps = makeRandomPrefs(N);
      const pe = makeRandomPrefs(N);
      prefsSRef.current = ps;
      prefsERef.current = pe;
      setPrefsS(ps);
      setPrefsE(pe);
    }
    const s = initMatch(N);
    stateRef.current = s;
    setMatchState(s);
    setAutoPlay(false);
    flashRef.current = 0;
  }, []);

  /* ─── paso manual ─────────────────────────────────────────────────*/
  const doStep = useCallback(() => {
    if (stateRef.current.done) return;
    const next = stepGS(stateRef.current, prefsSRef.current, prefsERef.current, N);
    stateRef.current = next;
    setMatchState({ ...next });
    flashRef.current = 40;  // 40 frames de flash para propuestas
  }, []);

  /* ─── run all at once ────────────────────────────────────────────── */
  const doAll = useCallback(() => {
    let s = stateRef.current;
    let iterations = 0;
    while (!s.done && iterations < 200) {
      s = stepGS(s, prefsSRef.current, prefsERef.current, N);
      iterations++;
    }
    stateRef.current = s;
    setMatchState({ ...s });
    flashRef.current = 60;
  }, []);

  /* ─── auto-play ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!autoPlay) return;
    const id = setInterval(() => {
      if (stateRef.current.done) {
        setAutoPlay(false);
        return;
      }
      const next = stepGS(stateRef.current, prefsSRef.current, prefsERef.current, N);
      stateRef.current = next;
      setMatchState({ ...next });
      flashRef.current = speed * 0.7;
    }, speed * 16);
    return () => clearInterval(id);
  }, [autoPlay, speed]);

  /* ─── draw loop ─────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    function draw() {
      if (!ctx) return;
      const st = stateRef.current;
      const ps = prefsSRef.current;
      const pe = prefsERef.current;

      // Fondo
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);

      // ── líneas de match final ──
      for (let s = 0; s < N; s++) {
        const e = st.studentMatch[s];
        if (e === -1) continue;
        const [sx, sy] = posStudent(s, N);
        const [ex, ey] = posSchool(e, N);
        ctx.save();
        ctx.strokeStyle = C.match;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = C.match;
        ctx.shadowBlur = 8;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(sx + 22, sy);
        ctx.lineTo(ex - 22, ey);
        ctx.stroke();
        ctx.restore();
      }

      // ── propuestas en vuelo (flash) ──
      if (flashRef.current > 0) {
        flashRef.current = Math.max(0, flashRef.current - 1);
        const alpha = Math.min(1, flashRef.current / 20);
        for (const p of st.lastProposals) {
          const [sx, sy] = posStudent(p.s, N);
          const [ex, ey] = posSchool(p.e, N);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = p.accepted ? C.match : C.reject;
          ctx.lineWidth = p.accepted ? 3 : 1.5;
          ctx.setLineDash(p.accepted ? [] : [5, 4]);
          ctx.shadowColor = p.accepted ? C.match : C.reject;
          ctx.shadowBlur = p.accepted ? 14 : 6;
          ctx.beginPath();
          ctx.moveTo(sx + 22, sy);
          ctx.lineTo(ex - 22, ey);
          ctx.stroke();
          // Flecha en el centro
          const mx = (sx + ex) / 2, my = (sy + ey) / 2;
          const ang = Math.atan2(ey - sy, ex - sx);
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(-8, -5); ctx.lineTo(0, 0); ctx.lineTo(-8, 5);
          ctx.strokeStyle = p.accepted ? C.match : C.reject;
          ctx.lineWidth = p.accepted ? 2.5 : 1.5;
          ctx.stroke();
          ctx.restore();
          ctx.restore();
        }
      }

      // ── nodo escuela ──
      for (let e = 0; e < N; e++) {
        const [x, y] = posSchool(e, N);
        const matched = st.schoolMatch[e] !== -1;

        ctx.save();
        ctx.shadowColor = matched ? C.school : C.dim;
        ctx.shadowBlur  = matched ? 18 : 6;
        // círculo fondo
        ctx.fillStyle = matched ? C.school : C.border;
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();
        // aro
        ctx.strokeStyle = matched ? C.school : C.dim;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = matched ? C.bg : C.dim;
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(NAMES_E[e], x, y);
        ctx.textBaseline = 'alphabetic';

        // Lista preferencias (ranking comprimido)
        ctx.fillStyle = C.dim;
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'left';
        const rankStr = pe[e].map(sid => NAMES_S[sid][0]).join('>');
        ctx.fillText(rankStr, x + 25, y + 3);
      }

      // ── nodo estudiante ──
      for (let s = 0; s < N; s++) {
        const [x, y] = posStudent(s, N);
        const e = st.studentMatch[s];
        const matched = e !== -1;
        const nextIdx = st.nextProp[s];

        ctx.save();
        ctx.shadowColor = matched ? C.student : (nextIdx < N ? C.student : C.reject);
        ctx.shadowBlur  = matched ? 18 : 8;
        ctx.fillStyle   = matched ? C.student : (nextIdx < N ? '#1E3A5F' : '#3B1111');
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = matched ? C.student : (nextIdx < N ? C.student : C.reject);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = matched ? C.bg : C.text;
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(NAMES_S[s], x, y);
        ctx.textBaseline = 'alphabetic';

        // Lista de preferencias del estudiante (a la izquierda)
        const rankStr = ps[s].map(eid => NAMES_E[eid][0]).join('>');
        ctx.fillStyle = C.dim;
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(rankStr, x - 24, y + 3);
        ctx.textAlign = 'left';

        // Indicador de próximo a proponer
        if (!matched && nextIdx < N) {
          const nextE = ps[s][nextIdx];
          ctx.fillStyle = C.propose;
          ctx.font = '9px ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`→${NAMES_E[nextE][0]}`, x - 15, y + 28);
        }
      }

      // ── etiquetas laterales ──
      ctx.fillStyle = C.student;
      ctx.font = 'bold 11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('ESTUDIANTES', 80, 30);
      ctx.fillStyle = C.school;
      ctx.fillText('ESCUELAS', W - 80, 30);

      // ── estado central ──
      const blockingPairs = st.done
        ? findBlockingPairs(st.studentMatch, st.schoolMatch, ps, pe, N)
        : [];

      ctx.textAlign = 'center';
      ctx.font = 'bold 13px ui-sans-serif, system-ui';
      if (st.done) {
        if (blockingPairs.length === 0) {
          ctx.fillStyle = C.match;
          ctx.shadowColor = C.match; ctx.shadowBlur = 10;
          ctx.fillText('✓ EMPAREJAMIENTO ESTABLE', W / 2, H - 16);
        } else {
          ctx.fillStyle = C.reject;
          ctx.fillText(`⚠ ${blockingPairs.length} par(es) bloqueador(es)`, W / 2, H - 16);
        }
      } else if (st.round === 0) {
        ctx.fillStyle = C.dim;
        ctx.fillText('Presiona ▶ para iniciar el algoritmo', W / 2, H - 16);
      } else {
        ctx.fillStyle = C.gold;
        ctx.fillText(`Ronda ${st.round} — ${st.lastProposals.length} propuesta(s)`, W / 2, H - 16);
      }
      ctx.shadowBlur = 0;

      // ── flecha central indicativa ──
      ctx.fillStyle = C.dim;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('propone →', W / 2, H / 2 - 6);
      ctx.fillText('← acepta/rechaza', W / 2, H / 2 + 10);
    }

    function loop() {
      draw();
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  /* ─── helpers de presentación ─────────────────────────────────────*/
  const blocking = matchState.done
    ? findBlockingPairs(matchState.studentMatch, matchState.schoolMatch, prefsS, prefsE, N)
    : [];

  const insight = !matchState.done && matchState.round === 0
    ? 'Da click en "paso" o "auto" para ver cómo el algoritmo encuentra el emparejamiento estable. Cada estudiante propone en orden de su preferencia; cada escuela guarda provisionalmente al mejor.'
    : matchState.done && blocking.length === 0
      ? 'Emparejamiento estable logrado: ningún estudiante y escuela preferirían escaparse juntos fuera del sistema. Eso es exactamente lo que Gale y Shapley probaron que siempre existe.'
      : matchState.done
        ? `Hay ${blocking.length} par(es) bloqueador(es): alguien preferiría cambiarse. Un algoritmo mal diseñado deja estas "fugas". Gale-Shapley las elimina siempre.`
        : `Ronda ${matchState.round}: los estudiantes proponen a su siguiente favorito; las escuelas comparan con su provisional actual y guardan al mejor.`;

  /* ─── editor de preferencias ─────────────────────────────────────── */
  const moveRank = (
    side: 'student' | 'school',
    idx: number,
    rankPos: number,
    dir: -1 | 1,
  ) => {
    const newPos = rankPos + dir;
    if (newPos < 0 || newPos >= N) return;
    if (side === 'student') {
      const next = prefsS.map((row, i) => {
        if (i !== idx) return row;
        const r = [...row];
        [r[rankPos], r[newPos]] = [r[newPos], r[rankPos]];
        return r;
      });
      prefsSRef.current = next;
      setPrefsS(next);
    } else {
      const next = prefsE.map((row, i) => {
        if (i !== idx) return row;
        const r = [...row];
        [r[rankPos], r[newPos]] = [r[newPos], r[rankPos]];
        return r;
      });
      prefsERef.current = next;
      setPrefsE(next);
    }
    reset(false);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* ── Canvas + controles ── */}
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <canvas
              ref={canvasRef}
              className="rounded-lg border border-[#1E293B] bg-[#070A11] block"
              style={{ width: W, height: H }}
            />
          </div>

          {/* Botones */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={doStep}
              disabled={matchState.done}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#A78BFA]/40 bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/20 transition disabled:opacity-40"
            >
              ▶ paso
            </button>
            <button
              onClick={() => setAutoPlay(v => !v)}
              disabled={matchState.done}
              className={`px-3 py-1.5 text-[12px] font-mono rounded border transition disabled:opacity-40 ${
                autoPlay
                  ? 'border-[#FDB813]/50 bg-[#FDB813]/10 text-[#FDB813]'
                  : 'border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#38BDF8] hover:bg-[#38BDF8]/20'
              }`}
            >
              {autoPlay ? '⏸ pausa auto' : '⏩ auto'}
            </button>
            <button
              onClick={doAll}
              disabled={matchState.done}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] hover:bg-[#34D399]/20 transition disabled:opacity-40"
            >
              ⚡ completar
            </button>
            <button
              onClick={() => reset(false)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] transition"
            >
              ↺ reiniciar
            </button>
            <button
              onClick={() => reset(true)}
              className="px-3 py-1.5 text-[12px] font-mono rounded border border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1] transition"
            >
              🎲 nuevas prefs
            </button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#475569]">velocidad</span>
              <input
                type="range" min={10} max={120} step={5} value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                className="w-20 accent-[#FDB813]"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="rondas" value={String(matchState.round)} accent={C.gold} />
            <Stat
              label="emparejados"
              value={`${matchState.studentMatch.filter(e => e !== -1).length}/${N}`}
              accent={C.match}
            />
            <Stat
              label="pares bloqueadores"
              value={matchState.done ? String(blocking.length) : '—'}
              accent={blocking.length === 0 && matchState.done ? C.match : C.reject}
            />
          </div>

          {/* Insight */}
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#4FC3F7] font-mono mb-2">✦ ¿Qué estás viendo?</div>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* ── Panel lateral ── */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('match')}
              className={`flex-1 py-1.5 text-[11px] font-mono rounded border transition ${
                viewMode === 'match'
                  ? 'border-[#38BDF8]/50 bg-[#38BDF8]/10 text-[#38BDF8]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              resultado
            </button>
            <button
              onClick={() => setViewMode('prefs')}
              className={`flex-1 py-1.5 text-[11px] font-mono rounded border transition ${
                viewMode === 'prefs'
                  ? 'border-[#FB923C]/50 bg-[#FB923C]/10 text-[#FB923C]'
                  : 'border-[#1E293B] text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              preferencias
            </button>
          </div>

          {viewMode === 'match' && (
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#94A3B8] font-mono mb-3">
                Emparejamiento actual
              </div>
              {Array.from({ length: N }, (_, s) => {
                const e = matchState.studentMatch[s];
                const rankE = e !== -1 ? prefsS[s].indexOf(e) + 1 : null;
                return (
                  <div key={s} className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-mono" style={{ color: C.student }}>
                      {NAMES_S[s]}
                    </span>
                    <span className="text-[10px] text-[#475569]">→</span>
                    <span className="text-[12px] font-mono" style={{ color: e !== -1 ? C.school : C.dim }}>
                      {e !== -1 ? NAMES_E[e] : '…'}
                    </span>
                    {rankE !== null && (
                      <span className="text-[10px] font-mono text-[#475569]">
                        (op.{rankE})
                      </span>
                    )}
                  </div>
                );
              })}

              {blocking.length > 0 && matchState.done && (
                <div className="mt-3 pt-3 border-t border-[#1E293B]">
                  <div className="text-[10px] text-[#EF4444] font-mono mb-1">⚠ pares bloqueadores:</div>
                  {blocking.map(([s, e]) => (
                    <div key={`${s}-${e}`} className="text-[11px] font-mono text-[#EF4444]">
                      {NAMES_S[s]} ↔ {NAMES_E[e]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'prefs' && (
            <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#94A3B8] font-mono">
                Edita preferencias (↑↓)
              </div>
              <div className="text-[10px] text-[#475569] leading-snug mb-2">
                Cambia el orden y presiona "reiniciar" para ver cómo cambia el resultado.
              </div>

              <div className="text-[10px] font-mono mb-1" style={{ color: C.student }}>Estudiantes</div>
              {Array.from({ length: N }, (_, s) => (
                <div key={s} className="space-y-0.5">
                  <div className="text-[10px] font-mono text-[#64748B]">{NAMES_S[s]}:</div>
                  <div className="flex gap-1 flex-wrap">
                    {prefsS[s].map((eid, rank) => (
                      <div key={eid} className="flex items-center gap-0.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0F172A] border border-[#1E293B]"
                              style={{ color: C.school }}>
                          {NAMES_E[eid]}
                        </span>
                        <div className="flex flex-col gap-0">
                          <button onClick={() => moveRank('student', s, rank, -1)}
                                  className="text-[8px] text-[#475569] hover:text-white leading-none px-0.5">▲</button>
                          <button onClick={() => moveRank('student', s, rank, 1)}
                                  className="text-[8px] text-[#475569] hover:text-white leading-none px-0.5">▼</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="text-[10px] font-mono mt-2 mb-1" style={{ color: C.school }}>Escuelas</div>
              {Array.from({ length: N }, (_, e) => (
                <div key={e} className="space-y-0.5">
                  <div className="text-[10px] font-mono text-[#64748B]">{NAMES_E[e]}:</div>
                  <div className="flex gap-1 flex-wrap">
                    {prefsE[e].map((sid, rank) => (
                      <div key={sid} className="flex items-center gap-0.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0F172A] border border-[#1E293B]"
                              style={{ color: C.student }}>
                          {NAMES_S[sid]}
                        </span>
                        <div className="flex flex-col gap-0">
                          <button onClick={() => moveRank('school', e, rank, -1)}
                                  className="text-[8px] text-[#475569] hover:text-white leading-none px-0.5">▲</button>
                          <button onClick={() => moveRank('school', e, rank, 1)}
                                  className="text-[8px] text-[#475569] hover:text-white leading-none px-0.5">▼</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] font-mono text-[#475569] border border-[#1E293B] rounded-lg p-3 leading-relaxed">
            algoritmo: Gale-Shapley<br />
            Deferred Acceptance (1962)<br />
            garantía: estabilidad ∀ prefs<br />
            Roth lo convirtió en software<br />
            real (NRMP, Boston Mech, riñones)
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── componentes auxiliares ──────────────────────────────────────── */
function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#64748B] font-mono mb-1">{label}</div>
      <div className="text-[19px] font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  );
}
