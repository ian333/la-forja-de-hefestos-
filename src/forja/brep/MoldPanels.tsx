/**
 * MoldPanels — los paneles DOM del molde (paso 2.4 de la extracción del
 * monolito): el ÁRBOL de componentes (placas/aislar/ocultar/opacidad + los
 * toggles 🌡🏗🩻📐💧▶⏱ y sus reportes), el panel del CURSO ALWIS y el banner
 * de ARMANDO MOLDE. Reciben la BOLSA de useMoldStudio como prop — cero estado
 * propio, puro render. El grupo del ribbon se queda en el Studio (usa <Ic>).
 */
import type { useMoldStudio } from './useMoldStudio';
import { GOLD } from './ui-theme';
import { Ic } from './icons';

type MoldBag = ReturnType<typeof useMoldStudio>;

export function MoldBuildingBanner({ on }: { on: boolean }) {
  if (!on) return null;
  return (
        <div data-testid="mold-building" style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 98000,
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 10,
          background: '#131a28ee', border: '1px solid #FDB81355', color: '#f4d27a',
          fontSize: 13, fontWeight: 700, letterSpacing: 1, boxShadow: '0 6px 24px #0009',
        }}>
          <span style={{ animation: 'fbBootPulse2 1.1s ease-in-out infinite alternate' }}>⚒</span>
          ARMANDO MOLDE… (la pestaña puede pausarse — es normal, no recargues)
          <style>{'@keyframes fbBootPulse2{from{opacity:.35}to{opacity:1}}'}</style>
        </div>
  );
}

export function CursoPanel({ mold }: { mold: MoldBag }) {
  const { cursoStage, cursoReport, cursoCollapsed, setCursoCollapsed } = mold;
  if (cursoReport.length === 0) return null;
          const gate = cursoReport.find((l) => l.startsWith('La línea de partición'));   // el mensaje verde nunca se pierde
          const tail = cursoReport.slice(-6);
          return (
            <div data-testid="curso-report" style={{
              position: 'absolute', left: 16, top: 138, zIndex: 5, width: 300,
              background: 'rgba(9,14,21,0.94)', border: '1px solid #2c3a50', borderRadius: 8,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#dfe7f2',
              boxShadow: '0 6px 20px rgba(0,0,0,.5)',
            }}>
              <button
                onClick={() => setCursoCollapsed((c) => !c)}
                title={cursoCollapsed ? 'Mostrar el registro del curso' : 'Plegar (no tapar el sólido)'}
                style={{
                  all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', width: '100%',
                  padding: '8px 12px', color: GOLD, fontWeight: 700, fontSize: 11.5,
                }}>
                <span>MOLD TOOLS — curso Alwis · paso {cursoStage}/6</span>
                <span style={{ color: '#8a97a8' }}>{cursoCollapsed ? '▸' : '▾'}</span>
              </button>
              {!cursoCollapsed && (
                <div style={{ maxHeight: 168, overflowY: 'auto', padding: '0 12px 10px' }}>
                  {gate && !tail.includes(gate) && (
                    <div style={{ marginBottom: 4, lineHeight: 1.35, color: '#22c55e' }}>{gate}</div>
                  )}
                  {tail.map((l, i) => {
                    const isGate = l.startsWith('La línea de partición');
                    const isErr = l.startsWith('ERROR');
                    const isLast = i === tail.length - 1;
                    return (
                      <div key={i} style={{
                        marginTop: 4, lineHeight: 1.35,
                        color: isGate ? '#22c55e' : isErr ? '#ef4444' : isLast ? '#dfe7f2' : '#7f8da3',
                        opacity: isGate || isErr || isLast ? 1 : 0.55,
                      }}>{l}</div>
                    );
                  })}
                </div>
              )}
            </div>
          );
}

// kernelReady (booleano) y NUNCA `oc`: pasar el módulo WASM como prop = la
// instrumentación dev de React camina el heap entero de embind (freeze cazado).
export function MoldTreePanel({ mold, kernelReady }: { mold: MoldBag; kernelReady: boolean }) {
  const { moldSim, moldThermalSim, liveDfm, moldParts, moldHidden, moldOpacity, moldSelected, setMoldSelected, moldMoveMode, setMoldMoveMode, moldOffset, setMoldOffset, moldOpenRef, moldOpenOn, setMoldOpenOn, moldColors, setMoldColors, moldExpanded, setMoldExpanded, moldCompAnalysis, flowOn, setFlowOn, liveFlow, liveFastener, fastHalf, setFastHalf, cotasOn, setCotasOn, cotaErrors, moldSimOn, setMoldSimOn, moldXray, setMoldXray, moldSliceAxis, setMoldSliceAxis, moldSliceFrac, setMoldSliceFrac, moldTcOn, setMoldTcOn, moldTc, moldFea, setMoldFea, moldFeaBusy, runMoldFeaNow, toggleMoldPlate, showAllMold, isolateMoldPlate, setMoldPlateOpacity } = mold;
  if (moldParts.length === 0) return null;
  return (
              <>
                <div className="fb-feat-subhead" data-testid="mold-parts-head">
                  🏭 Molde · placas <b data-testid="mold-visible-count">{moldParts.filter((p) => !moldHidden[p.role]).length}/{moldParts.length}</b> vis.
                  <button className={`fb-feat-act ${moldSimOn ? 'on' : ''}`} data-testid="mold-sim-toggle" style={{ marginLeft: 'auto' }}
                    title="SIMULACIÓN TÉRMICA TRANSITORIA: PDE de calor (FDM 3D) con inyección por ciclo + líneas de agua reales — Kazmer §9"
                    onClick={() => setMoldSimOn((v) => !v)}>🌡</button>
                  <button className={`fb-feat-act ${moldFea ? 'on' : ''}`} data-testid="mold-fea-run"
                    title="FEA MECÁNICO real (malla tet + CG): presión de fundido sobre la cavidad, rieles empotrados → von Mises + deflexión — §12"
                    onClick={() => (moldFea ? setMoldFea(null) : runMoldFeaNow())}>{moldFeaBusy ? '⏳' : '🏗'}</button>
                  <button className={`fb-feat-act ${moldXray ? 'on' : ''}`} data-testid="mold-xray-toggle"
                    title="RAYOS X: todo el molde translúcido — ver esfuerzos/térmico por dentro sin sección"
                    onClick={() => setMoldXray((v) => !v)}>🩻</button>
                  <button className={`fb-feat-act ${cotasOn ? 'on' : ''}`} data-testid="mold-cotas-toggle"
                    style={cotasOn && cotaErrors ? { color: '#ff6b6b', borderColor: '#ff6b6b' } : undefined}
                    title="COTAS 3D: las medidas sobre la pieza, sin andar midiendo. Cada cota trae DOS cifras — lo que la RECETA dice vs lo que el SÓLIDO mide. Si no cuadran, sale en ROJO."
                    onClick={() => setCotasOn((v) => !v)}>📐{cotasOn && cotaErrors ? ` ${cotaErrors}` : ''}</button>
                  <button className={`fb-feat-act ${flowOn ? 'on' : ''}`} data-testid="mold-flow-toggle"
                    title="LLENADO §5.5.5: la pieza pintada por CUÁNDO le llega el fundido. La longitud de flujo se MIDE del hueco A/B (Dijkstra sobre la malla), NO de una fórmula por figura — un vaso, una carcasa o un juguete entran igual. Amarillo = entra primero · morado = lo último (llega frío y a máxima presión) · ROJO = nunca se llena (short shot)."
                    onClick={() => setFlowOn((v) => !v)}>💧</button>
                  <button className={`fb-feat-act ${moldOpenOn ? 'on' : ''}`} data-testid="mold-open-toggle"
                    title="APERTURA animada: el lado A sube y las correderas SE RETRAEN con la cinemática del perno inclinado (u = apertura·tanφ, Eq 11.26)"
                    onClick={() => { setMoldOpenOn((v) => { moldOpenRef.current.on = !v; moldOpenRef.current.t0 = performance.now(); return !v; }); }}>▶</button>
                  <button className={`fb-feat-act ${moldTcOn ? 'on' : ''}`} data-testid="mold-tc-toggle"
                    title="⏱ t_c LOCAL: la pieza pintada por lo que tarda SU pared (Eq 9.5) + consejo de agua (mover línea / baffle §9.3.5.2)"
                    onClick={() => setMoldTcOn((v) => !v)}>⏱</button>
                  {moldSimOn && (
                    <span data-testid="mold-slice-controls" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      {(['x', 'y', 'z'] as const).map((ax) => (
                        <button key={ax} className={`fb-feat-act ${moldSliceAxis === ax ? 'on' : ''}`} data-testid={`mold-slice-${ax}`}
                          title={`REBANADA térmica ⊥${ax.toUpperCase()} — recorre el molde por dentro (el campo es 3D)`}
                          onClick={() => setMoldSliceAxis(ax)}>{ax.toUpperCase()}</button>
                      ))}
                      <input type="range" min={0} max={1} step={0.02} value={moldSliceFrac} data-testid="mold-slice-frac"
                        style={{ width: 64 }} title="posición del corte a lo largo del eje"
                        onChange={(e) => setMoldSliceFrac(Number(e.target.value))} />
                    </span>
                  )}
                  <button className={`fb-feat-act ${moldMoveMode ? 'on' : ''}`} data-testid="mold-move-mode"
                    title={moldSelected ? 'Mover el componente seleccionado (arrastra la flecha)' : 'Selecciona un componente y actívalo para moverlo'}
                    onClick={() => setMoldMoveMode((v) => !v)}>✥</button>
                  {Object.keys(moldOffset).length > 0 && (
                    <button className="fb-feat-act" data-testid="mold-reset-move" title="Reponer posiciones (todo a su lugar)"
                      onClick={() => setMoldOffset({})}>↺</button>
                  )}
                  <button className="fb-feat-act" data-testid="mold-show-all" title="Mostrar todas las placas" onClick={showAllMold}>👁</button>
                </div>
                {moldTc && (
                  <div className="fb-comp-tree" data-testid="mold-tc-report" style={{ margin: '4px 0 8px 4px' }}>
                    <div className="fb-comp-row hdr">⏱ t_c LOCAL (Eq 9.5) · pared {moldTc.map.thMaxMm} mm manda · rango {moldTc.map.tcMinS}–{moldTc.map.tcMaxS} s</div>
                    {moldTc.advice.rows.map((v, i) => (
                      <div key={i} className="fb-comp-row feat" title={`límite: ${v.limite}`}>
                        {v.ok ? '✓' : '⚠'} {v.param}: <b style={{ color: v.ok ? '#7ee0a0' : '#f2b45c' }}>{v.valor}</b> <span style={{ opacity: 0.6 }}>[{v.ref}]</span>
                      </div>
                    ))}
                  </div>
                )}
                {moldSimOn && moldSim && (
                  <div className="fb-comp-tree" data-testid="mold-sim-report" style={{ margin: '4px 0 8px 4px' }}>
                    <div className="fb-comp-row hdr">🌡 TRANSITORIO (PDE FDM 3D, ×10) · t_c {moldSim.thermal.coolingTimeS}s · azul=frío rojo=caliente</div>
                    {moldThermalSim && (() => {
                      // ¿QUÉ ZONA CONTROLA EL CICLO? — espesor local MEDIDO de la malla
                      // (t_c ∝ h², §9.1): la columna más gruesa manda en el enfriamiento
                      // ⚠ EL MÁXIMO CRUDO MIENTE. Una columna de PARED VERTICAL mide su
                      // ALTURA, no su espesor: la carcasa RPi4 reportaba "26.5 mm controla
                      // el ciclo → t_c ×17.1" cuando su pared real son ~6 mm (los gussets).
                      // Es el MISMO fantasma que `tcLocalMap` ya resolvió (erosión ×2 +
                      // acotar al p95) — este display leía la malla en bruto: dos caminos a
                      // la misma cantidad física, uno arreglado y el otro no.
                      // Aquí se usa el P95 (robusto: una columna monstruo no puede ser el
                      // p95) y, si el mapa t_c está activo, su `thMaxMm` YA erosionado.
                      const g = moldThermalSim.thGrid;
                      const ths: number[] = [];
                      let iM = 0, jM = 0, thNom = 0, nCols = 0, rawMax = 0;
                      for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
                        const th = g.thMm[j * g.nx + i];
                        if (th <= 0) continue;
                        nCols++; thNom += th; ths.push(th);
                        if (th > rawMax) { rawMax = th; iM = i; jM = j; }
                      }
                      if (!nCols) return null;
                      thNom /= nCols;
                      ths.sort((a, b) => a - b);
                      const p95 = ths[Math.min(ths.length - 1, (ths.length * 0.95) | 0)] ?? rawMax;
                      const thMax = moldTc?.thMaxMm ?? p95;      // el eroded si existe; si no, p95
                      const ratio = thMax / Math.max(0.1, thNom);
                      return (
                        <div className="fb-comp-row feat" data-testid="mold-cycle-driver" title="t_c ∝ h² (§9.1): la pared más gruesa fija el tiempo de enfriamiento del ciclo">
                          {ratio > 1.8 ? '⚠' : '✓'} Zona que CONTROLA el ciclo: <b style={{ color: ratio > 1.8 ? '#f2b45c' : '#7ee0a0' }}>
                            {thMax.toFixed(1)} mm @({Math.round((iM + 0.5) * g.cellMm)},{Math.round((jM + 0.5) * g.cellMm)})</b>
                          {' '}vs media {thNom.toFixed(1)} mm → t_c ×{(ratio * ratio).toFixed(1)} <span style={{ opacity: 0.6 }}>[t_c ∝ h², §9.1]</span>
                          {rawMax > thMax * 1.5 && (
                            <span style={{ opacity: 0.55 }}> · (máx crudo {rawMax.toFixed(1)} mm descartado: pared vertical midiendo su altura)</span>
                          )}
                        </div>
                      );
                    })()}
                    <div className="fb-comp-row hdr">🏗 Estructural §12 · δ soporte <b>{moldSim.structural.deflMm} mm</b> → pilares <b>{moldSim.structural.deflPillarsMm} mm</b></div>
                    {moldFea && (
                      <div className="fb-comp-row hdr" data-testid="mold-fea-report">⚙ FEA REAL ({moldFea.nNodes} nodos · {(moldFea.ms / 1000).toFixed(1)}s) · δ <b>{moldFea.maxDispMm} mm</b> · σ_vm <b>{moldFea.maxVonMisesMPa} MPa</b> <span style={{ opacity: 0.65 }}>(viga Eq 12.10: {moldFea.beamDeflMm} mm — subestima el cortante)</span></div>
                    )}
                    {moldSim.verdicts.map((v, i) => (
                      <div key={i} className="fb-comp-row feat" title={`límite: ${v.limite}`}>
                        {v.ok ? '✓' : '⚠'} {v.param}: <b style={{ color: v.ok ? '#7ee0a0' : '#f2b45c' }}>{v.valor}</b> <span style={{ opacity: 0.6 }}>[{v.ref}]</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="fb-bodies-list" data-testid="mold-parts-list">
                  {moldParts.map((pt) => {
                    const hidden = !!moldHidden[pt.role];
                    const op = moldOpacity[pt.role] ?? pt.opacity;
                    const exp = !!moldExpanded[pt.role];
                    return (
                      <div key={pt.role} data-testid={`mold-comp-${pt.role}`}>
                      <div className={`fb-feat-node comp ${moldSelected === pt.role ? 'active' : ''}`} data-testid={`mold-part-${pt.role}`}
                        style={hidden ? { opacity: 0.5 } : undefined}
                        onClick={() => setMoldSelected((s) => (s === pt.role ? null : pt.role))}
                        onDoubleClick={() => isolateMoldPlate(pt.role)} title="Clic = resaltar en 3D · Doble-clic = AISLAR">
                        <button className="fb-comp-chev" data-testid={`mold-expand-${pt.role}`}
                          onClick={(e) => { e.stopPropagation(); setMoldExpanded((m) => ({ ...m, [pt.role]: !m[pt.role] })); }}
                          title="Ver cuerpos e historia del componente">{exp ? '▾' : '▸'}</button>
                        <input type="color" className="fb-color-dot" style={{ borderRadius: '50%', width: 14, height: 14, flex: '0 0 auto' }}
                          value={moldColors[pt.role] ?? pt.color} data-testid={`mold-color-${pt.role}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setMoldColors((c) => ({ ...c, [pt.role]: e.target.value }))} title="Color del componente" />
                        <div className="fb-feat-body">
                          <strong>{pt.name}</strong>
                          <em>{pt.material} · {hidden ? 'oculta' : 'visible'}</em>
                          <input type="range" min={0.15} max={1} step={0.05} value={op} data-testid={`mold-opacity-${pt.role}`}
                            onChange={(e) => setMoldPlateOpacity(pt.role, Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()} title={`Opacidad ${Math.round(op * 100)}%`} style={{ width: '100%', marginTop: 3 }} />
                        </div>
                        <div className="fb-feat-actions">
                          <button className="fb-feat-act" data-testid={`mold-isolate-${pt.role}`}
                            onClick={(e) => { e.stopPropagation(); isolateMoldPlate(pt.role); }} title="Aislar (solo esta)">◎</button>
                          <button className="fb-feat-act" data-testid={`mold-hide-${pt.role}`}
                            onClick={(e) => { e.stopPropagation(); toggleMoldPlate(pt.role); }} title={hidden ? 'Mostrar placa' : 'Ocultar placa'}>{hidden ? '🙈' : '👁'}</button>
                        </div>
                      </div>
                      {exp && (
                        <div className="fb-comp-tree" data-testid={`mold-comp-tree-${pt.role}`}>
                          <div className="fb-comp-row hdr">🔩 Cuerpos <b>({pt.bodies ?? 1})</b></div>
                          {pt.features && pt.features.length > 0 && <div className="fb-comp-row hdr">🕮 Historia</div>}
                          {(pt.features ?? []).map((f, i) => <div key={i} className="fb-comp-row feat">· {f}</div>)}
                          {pt.role === 'pieza' && flowOn && liveFlow && (
                            <div data-testid="mold-flow-study">
                              <div className="fb-comp-row hdr">
                                💧 LLENADO — <b style={{ color: '#7ee0a0' }}>L máx {liveFlow.maxFlowLenMm} mm</b>
                                <span style={{ opacity: 0.6 }}> [Kazmer cap 5 · §5.5.5]</span>
                              </div>
                              {liveFlow.rows.map((r, i) => (
                                <div key={i} className="fb-comp-row feat" style={r.warn ? { color: '#ff6b6b' } : undefined}>
                                  {r.warn ? '⚠ ' : '· '}{r.k}: <b>{r.v}</b> <span style={{ opacity: 0.55 }}>{r.ref}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {pt.role === 'tornillos' && liveFastener && (() => {
                            const fp = liveFastener[fastHalf];
                            return (
                              <div data-testid="mold-fastener-study">
                                <div className="fb-comp-row hdr">
                                  🔩 ELECCIÓN DEL TORNILLO — <b style={{ color: '#7ee0a0' }}>{fp.count}× {fp.desig}</b>
                                  <span style={{ opacity: 0.6 }}> [Shigley cap.8 · FED-STD-H28 · §12.4]</span>
                                </div>
                                <div className="fb-comp-row feat" style={{ display: 'flex', gap: 6 }}>
                                  {(['cavity', 'core'] as const).map((h) => (
                                    <button key={h} data-testid={`mold-fast-half-${h}`}
                                      onClick={(e) => { e.stopPropagation(); setFastHalf(h); }}
                                      style={{ flex: 1, cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                                        border: `1px solid ${fastHalf === h ? '#7ee0a0' : '#555'}`,
                                        background: fastHalf === h ? 'rgba(126,224,160,0.14)' : 'transparent',
                                        color: fastHalf === h ? '#7ee0a0' : '#aaa', fontSize: 11 }}>
                                      {h === 'cavity' ? 'mitad CAVIDAD (A)' : 'mitad NÚCLEO (B)'}
                                    </button>
                                  ))}
                                </div>
                                <div className="fb-comp-row feat" title="§12.4 Fig 12.33: el molde colgado de UN tornillo con n_g=10 de choque de grúa. La carga NO se reparte: ese tornillo la ve solo.">
                                  · carga sobre <b>UN</b> tornillo (§12.4 Fig 12.33, choque de grúa n_g=10): <b>{fp.perBoltKN} kN</b> de {fp.capacityKN} que aguanta = <b style={{ color: fp.utilPct < 90 ? '#7ee0a0' : '#f2b45c' }}>{fp.utilPct}%</b>
                                </div>
                                <div className="fb-comp-row feat" style={{ opacity: 0.7 }}>
                                  · se colocan <b>{fp.count}</b> por mitad (redundancia y sujeción) — pero el Ø lo manda el peor caso de UNO solo
                                </div>
                                <div className="fb-comp-row feat" title="FED-STD-H28: el hilo externo rompe a tensión ANTES de barrer el interno">
                                  · engrane: <b style={{ color: fp.engagementOK ? '#7ee0a0' : '#f27a6c' }}>{fp.engagementMm} mm</b> en placa de {fp.availableMm} mm {fp.engagementOK ? '✓ cabe' : '✗ NO CABE'} <span style={{ opacity: 0.55 }}>(acero Sy {fp.plateSyMPa} MPa)</span>
                                </div>
                                <div className="fb-comp-row feat">
                                  · apriete <b>{fp.torqueNm} N·m</b> · broca piloto ⌀{fp.tapDrillMm} · área esf {fp.stressAreaMm2} mm²
                                </div>
                                <div className="fb-comp-row hdr" style={{ opacity: 0.85 }}>📋 Candidatos evaluados <span style={{ opacity: 0.6, fontWeight: 400 }}>— {fp.criterion}</span></div>
                                {fp.candidates.map((c) => (
                                  <div key={c.desig} className="fb-comp-row feat" data-testid={`mold-fast-cand-${c.desig}`}
                                    title={c.why}
                                    style={{ background: c.chosen ? 'rgba(126,224,160,0.10)' : undefined, opacity: c.fits ? 1 : 0.5 }}>
                                    {c.chosen ? '★' : c.fits ? '·' : '✗'} <b style={{ color: c.chosen ? '#7ee0a0' : undefined }}>{String(c.count).padStart(2)}× {c.desig}</b>
                                    <span style={{ opacity: 0.75 }}> · {c.utilPct}% util · engrane {c.engagementMm} mm</span>
                                    <span style={{ opacity: 0.55 }}> — {c.why}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          {pt.role === 'pieza' && liveDfm && (
                            <>
                              <div className="fb-comp-row hdr" data-testid="mold-dfm-pieza">⚖ Moldeabilidad (Kazmer §2.3) — <b style={{
                                color: liveDfm.moldable === 'si' ? '#7ee0a0' : liveDfm.moldable === 'con-mecanismos' ? '#f2b45c' : '#f27a6c',
                              }}>{liveDfm.moldable === 'si' ? 'MOLDEABLE (dos placas)' : liveDfm.moldable === 'con-mecanismos' ? 'CON MECANISMOS §11.3' : 'NO MOLDEABLE'}</b></div>
                              {liveDfm.verdicts.map((v, i) => (
                                <div key={i} className="fb-comp-row feat" title={`límite: ${v.limite}`}>
                                  {v.ok ? '✓' : '⚠'} {v.param}: <b style={{ color: v.ok ? '#7ee0a0' : '#f2b45c' }}>{v.valor}</b> <span style={{ opacity: 0.55 }}>[{v.ref}]</span>
                                </div>
                              ))}
                            </>
                          )}
                          {moldCompAnalysis?.[pt.role] && (
                            <>
                              <div className="fb-comp-row hdr" data-testid={`mold-comp-analysis-${pt.role}`}>📊 Análisis de esta placa</div>
                              {moldCompAnalysis[pt.role].map((v, i) => (
                                <div key={i} className="fb-comp-row feat" title={`límite: ${v.limite}`}>
                                  {v.ok ? '✓' : '⚠'} {v.param}: <b style={{ color: v.ok ? '#7ee0a0' : '#f2b45c' }}>{v.valor}</b> <span style={{ opacity: 0.55 }}>[{v.ref}]</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </>
  );
}

/** El grupo del ribbon MOLDE · CURSO ALWIS (Flanera/Vaso/Core-Cav + los 6
 *  pasos del curso). Incluye su separador. */
export function MoldRibbonGroup({ mold, kernelReady }: { mold: MoldBag; kernelReady: boolean }) {
  const { loadFeedDemo, cursoStage, cursoBusy, cursoInsertar, cursoFlanera, loadFlaneraMold, cursoFlaneraMold, cursoEscala, cursoLayout, cursoParting, cursoSplit, cursoGuias } = mold;
  return (
    <>
            <span className="fb-tb-sep" />
            <div className="fb-group">
              <div className="fb-group-row">
                <button className="fb-big" data-testid="btn-flanera" onClick={loadFlaneraMold} disabled={!kernelReady}
                  title="Molde COMPLETO de la flanera (24 partes: placas, insertos sólidos, eyección, agua, guías) — como el del Tupper"><Ic name="revolucion" /><span>Flanera</span></button>
                <button className="fb-big" data-testid="btn-flanera-vaso" onClick={cursoFlanera} disabled={!kernelReady || cursoBusy}
                  title="Solo el VASO de la flanera (revolución torneable — el producto)"><Ic name="pieza" /><span>Vaso</span></button>
                <button className="fb-big" data-testid="btn-flanera-mold" onClick={cursoFlaneraMold} disabled={!kernelReady || cursoBusy}
                  title="Core/Cavidad de la flanera: los dos insertos torneables (splitMold) — el molde del vaso"><Ic name="extrude" /><span>Core/Cav</span></button>
                <button className="fb-big" data-testid="btn-curso-pieza" onClick={cursoInsertar} disabled={!kernelReady || cursoBusy}
                  title="Insert > Part: la percha del curso (silueta declarada a proporción)"><Ic name="pieza" /><span>Pieza</span></button>
                <button className="fb-big" data-testid="btn-curso-escala" onClick={cursoEscala} disabled={cursoBusy || cursoStage < 1}
                  title="Scale: about Origin, uniforme ×1.015 (PP 1.5% — cota del curso)"><Ic name="escala" /><span>Escala</span></button>
                <button className="fb-big" data-testid="btn-curso-layout" onClick={cursoLayout} disabled={cursoBusy || cursoStage < 2}
                  title="Move/Copy Body: layout de 2 cavidades (copia rotada, sin traslape)"><Ic name="pattern" /><span>Move/Copy</span></button>
                <button className="fb-big" data-testid="btn-curso-parting" onClick={cursoParting} disabled={cursoBusy || cursoStage < 3}
                  title="Parting Lines: transición +/− del draft → lazo AUTOMÁTICO + mensaje verde (el curso pica 18 aristas a mano)"><Ic name="parting" /><span>Parting Line</span></button>
                <button className="fb-big" data-testid="btn-curso-split" onClick={cursoSplit} disabled={cursoBusy || cursoStage < 4}
                  title="Tooling Split: bloque 350×630, placas 145/90 (cotas del curso) — split + placa rectangular en UNA operación"><Ic name="extrude" /><span>Tooling Split</span></button>
                <button className="fb-big" data-testid="btn-curso-guias" onClick={cursoGuias} disabled={cursoBusy || cursoStage < 5}
                  title="Hole Wizard: bushings ⌀48+caja ⌀54×10 y pernos ⌀35+caja ⌀40×8 en ±142/±277 (cotas del curso)"><Ic name="hole" /><span>Guías</span></button>
                <button className="fb-big" data-testid="btn-red-6-14" onClick={() => loadFeedDemo('ramificada')} disabled={!kernelReady}
                  title="RED RAMIFICADA (Fig 6.14): sprue → 2 primarios → 4 secundarios → 8 gates sumergidos §7.2.7 — la carga se REPARTE ½ en cada unión (Eq 6.1). Prende 💧 para verla fluir."><Ic name="patron" /><span>Red 6.14</span></button>
                <button className="fb-big" data-testid="btn-red-6-15" onClick={() => loadFeedDemo('radial')} disabled={!kernelReady}
                  title="RED RADIAL (Fig 6.15): N brazos desde el diafragma del sprue — balanceada, poco volumen (Eq 6.1 con n=N)."><Ic name="engrane" /><span>Red 6.15</span></button>
                <button className="fb-big" data-testid="btn-red-6-13" onClick={() => loadFeedDemo('serie')} disabled={!kernelReady}
                  title="RED EN SERIE (Fig 6.13): compacta pero DESBALANCEADA — mira en 💧 cómo las cavidades lejanas llenan TARDE; el libro la balancea artificialmente adelgazando los secundarios cercanos."><Ic name="careado" /><span>Red 6.13</span></button>
                <button className="fb-big" data-testid="btn-red-6-16" onClick={() => loadFeedDemo('hibrida')} disabled={!kernelReady}
                  title="RED HÍBRIDA (Fig 6.16): ramificada → 4 clusters RADIALES ×4 = 16 cavidades — menos material que la ramificada pura con balance natural (p.136)."><Ic name="cajacic" /><span>Red 6.16</span></button>
              </div>
              <div className="fb-group-cap">MOLDE · CURSO ALWIS</div>
            </div>
    </>
  );
}
