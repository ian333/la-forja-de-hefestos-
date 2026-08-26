/**
 * MoldPanels — los paneles DOM del molde (paso 2.4 de la extracción del
 * monolito): el ÁRBOL de componentes (placas/aislar/ocultar/opacidad + los
 * toggles 🌡🏗🩻📐💧▶⏱ y sus reportes), el panel del CURSO ALWIS y el banner
 * de ARMANDO MOLDE. Reciben la BOLSA de useMoldStudio como prop — cero estado
 * propio, puro render. El grupo del ribbon se queda en el Studio (usa <Ic>).
 */
import { Fragment, useMemo } from 'react';
import type { useMoldStudio } from './useMoldStudio';
import { GOLD } from './ui-theme';
import { Ic } from './icons';
import { moldThermalResistanceStudy, heatToExtractW } from '../mold/thermal-resistance';
import { estPartVolumeCc } from '../mold/feed';
import { coolingCircuit, plateDepth } from '../mold/mold-drawing-set';
import type { CalcPaso } from '../mold/cooling-design';
import { construirMolde, CICLO_KAZMER } from '../mold/estudio-molde-datos';
import { mallaCaja } from '../mold/lamina-seccion';

type MoldBag = ReturnType<typeof useMoldStudio>;

/**
 * LA PANTALLA DE FÓRMULAS — el cálculo automático EXPLICADO (orden del user:
 * "quiero la pantalla de sus fórmulas y la explicación del cálculo… para que
 * cacemos más errores"). Cada paso: la fórmula del libro, la sustitución con
 * LOS NÚMEROS DE ESTE MOLDE y el resultado. Un paso que viola su regla se
 * pinta rojo — el error salta a la vista en la sustitución, no en el código.
 */
export function CalcRows({ pasos, testid }: { pasos: CalcPaso[]; testid: string }) {
  return (
    <div data-testid={testid}>
      {pasos.map((p, i) => (
        <div key={i} className="fb-comp-row feat" title={p.nota ?? p.ref}
          style={{ display: 'block', padding: '5px 6px 6px', marginTop: 3, borderRadius: 6,
            background: p.ok === false ? 'rgba(242,122,108,0.10)' : 'rgba(255,255,255,0.03)',
            borderLeft: `2px solid ${p.ok === false ? '#f27a6c' : '#2c3a50'}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: p.ok === false ? '#f27a6c' : '#dfe7f2' }}>
            {p.ok === false ? '✗ ' : '· '}{p.titulo} <span style={{ opacity: 0.55, fontWeight: 400 }}>[{p.ref}]</span>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: '#9fb2c8', marginTop: 2, whiteSpace: 'pre-wrap' }}>{p.formula}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: '#7f8da3', marginTop: 1, whiteSpace: 'pre-wrap' }}>= {p.sustitucion}</div>
          <div style={{ fontSize: 11.5, marginTop: 2 }}>
            → <b style={{ color: p.ok === false ? '#f27a6c' : '#7ee0a0' }}>{p.resultado}</b>
            {p.nota && <span style={{ opacity: 0.62, fontSize: 10.5 }}> — {p.nota}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

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
  const { liveMoldSpec, moldSim, moldThermalSim, liveDfm, moldParts, moldHidden, moldOpacity, moldSelected, setMoldSelected, moldMoveMode, setMoldMoveMode, moldOffset, setMoldOffset, moldOpenRef, moldOpenOn, setMoldOpenOn, moldColors, setMoldColors, moldExpanded, setMoldExpanded, moldCompAnalysis, flowOn, setFlowOn, liveFlow, liveFastener, fastHalf, setFastHalf, cotasOn, setCotasOn, cotaErrors, moldSimOn, setMoldSimOn, moldXray, setMoldXray, moldSliceAxis, setMoldSliceAxis, moldSliceFrac, setMoldSliceFrac, moldTcOn, setMoldTcOn, moldTc, moldFea, setMoldFea, moldFeaBusy, runMoldFeaNow, toggleMoldPlate, showAllMold, isolateMoldPlate, setMoldPlateOpacity } = mold;
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
                {moldSimOn && moldThermalSim && (() => {
                  // ESTUDIO POR PLACA (§9.2-9.3) — no un mapa difuso: cada cara
                  // moldeante con sus números, la profundidad que SIENTE el ciclo
                  // (δ=√(α·t)) y el flujo que cada lado entrega al acero.
                  const st = moldThermalSim.surfaceStudy();
                  const dPl = st.core.meanC - st.cav.meanC;
                  return (
                  <div className="fb-comp-tree" data-testid="mold-plate-study" style={{ margin: '4px 0 8px 4px' }}>
                    <div className="fb-comp-row hdr">🌡 ESTUDIO POR PLACA · cara moldeante (§9.2-9.3)</div>
                    <div className="fb-comp-row feat">
                      CAVIDAD (A): <b style={{ color: '#7ee0a0' }}>{st.cav.meanC}°C</b> media · {st.cav.minC}–{st.cav.maxC} · ΔT <b>{st.cav.dTC}°C</b>
                    </div>
                    <div className="fb-comp-row feat">
                      NÚCLEO (B): <b style={{ color: '#f2b45c' }}>{st.core.meanC}°C</b> media · {st.core.minC}–{st.core.maxC} · ΔT <b>{st.core.dTC}°C</b>
                    </div>
                    <div className="fb-comp-row feat" title="§9.3.6: el núcleo lo rodea el plástico y tiene menos acero para disipar">
                      Δ entre placas (FDM): <b style={{ color: '#8fa3bd' }}>{dPl >= 0 ? '+' : ''}{dPl.toFixed(2)}°C</b>
                      <span style={{ opacity: 0.7 }}> ⚠ el FDM difunde con α uniforme: no ve el aislamiento del plástico</span>
                    </div>
                    {(() => {
                      // LA ASIMETRÍA, ANALÍTICA (§9.2-9.3): red de resistencias con la
                      // geometría real — lo que el campo numérico no puede resolver.
                      const cc = liveMoldSpec ? coolingCircuit(liveMoldSpec, plateDepth(liveMoldSpec)) : null;
                      if (!liveMoldSpec || !cc) return null;
                      const an = moldThermalResistanceStudy({
                        nCav: liveMoldSpec.nCav ?? 1,
                        fxMm: liveMoldSpec.cavity.widthMm, fyMm: liveMoldSpec.cavity.lenMm ?? liveMoldSpec.cavity.widthMm,
                        depthMm: liveMoldSpec.cavity.depthMm, round: liveMoldSpec.cavity.shape === 'round',
                        qTotalW: heatToExtractW({
                          nCav: liveMoldSpec.nCav ?? 1, volCcPerCav: estPartVolumeCc(liveMoldSpec.cavity),
                          rhoMeltKgM3: 781, cpJkgC: 2100, tMeltC: 220, tEjectC: 80, cycleS: 30,
                        }),
                        lineDiaMm: cc.diaMm, lineDepthMm: cc.zBehindMm, lineLenMm: cc.segs.reduce((a, g) => a + Math.hypot(g.x1 - g.x0, g.y1 - g.y0), 0),
                        tCoolantC: moldThermalSim.coolantC, kSteel: 32, hC: 1000, coreBaffle: false,
                      });
                      return (<>
                        <div className="fb-comp-row hdr">📐 ANALÍTICO · red de resistencias (lo que el FDM no ve)</div>
                        {an.rows.map((r, i) => (
                          <div key={i} className="fb-comp-row feat" title={r.ref}>
                            {r.k}: <b style={{ color: r.warn ? '#ff8c5a' : '#7ee0a0' }}>{r.v}</b>
                            <span style={{ opacity: 0.6 }}> [{r.ref.slice(0, 64)}]</span>
                          </div>
                        ))}
                      </>);
                    })()}
                    <div className="fb-comp-row feat" title="δ=√(α·t_ciclo): el acero más profundo NO siente el ciclo">
                      velocidad de conducción: δ = <b style={{ color: '#6ba8ff' }}>{st.deltaMm} mm</b> por ciclo <span style={{ opacity: 0.7 }}>(P20 · más allá, bulk estable)</span>
                    </div>
                    <div className="fb-comp-row feat">
                      flujo al acero: cav <b>{(st.fluxCavWm2 / 1000).toFixed(1)}</b> · núcleo <b>{(st.fluxCoreWm2 / 1000).toFixed(1)}</b> kW/m²
                      <span style={{ opacity: 0.7 }}> · gradiente cara→agua: {st.dTSteelCavC}° / {st.dTSteelCoreC}° [Eq 9.21]</span>
                    </div>
                  </div>);
                })()}
                {moldSimOn && moldThermalSim && (
                  <div className="fb-comp-tree" data-testid="mold-field-legend" style={{ margin: '4px 0 8px 4px' }}>
                    <div className="fb-comp-row hdr">
                      🌡 CAMPO VIVO · t {moldThermalSim.timeS.toFixed(0)} s (régimen: 8 ciclos precalentados)
                    </div>
                    <div className="fb-comp-row feat">
                      escala AUTO <b style={{ color: '#6ba8ff' }}>{moldThermalSim.minC.toFixed(1)}°</b> →
                      <b style={{ color: '#ff6b3b' }}> {moldThermalSim.maxC.toFixed(1)}°C</b>
                      <span style={{ opacity: 0.65 }}> · Δ {(moldThermalSim.maxC - moldThermalSim.minC).toFixed(1)}°C sobre el agua a {moldThermalSim.coolantC}°</span>
                    </div>
                    <div className="fb-comp-row feat" style={{ opacity: 0.75 }}>
                      plástico en el centro: <b style={{ color: '#ffb347' }}>{moldThermalSim.plasticCenterMaxC().toFixed(0)}°C</b>
                      <span style={{ opacity: 0.7 }}> · el acero sube POCO sobre el agua (R_conv domina, Eq 9.7/9.21)</span>
                    </div>
                  </div>
                )}
                {moldSimOn && moldSim && (
                  <div className="fb-comp-tree" data-testid="mold-sim-report" style={{ margin: '4px 0 8px 4px' }}>
                    <div className="fb-comp-row hdr">🌡 TRANSITORIO (PDE FDM 3D, ×10) · t_c {moldSim.thermal.coolingTimeS}s · azul=frío rojo=caliente</div>
                    {moldThermalSim?.pasos && (
                      <CalcRows pasos={moldThermalSim.pasos()} testid="mold-calc-termica" />
                    )}
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
                          {pt.calc && (
                            <>
                              <div className="fb-comp-row hdr" title="Cada paso: la fórmula del libro, la sustitución con LOS NÚMEROS de este molde, y el resultado. Rojo = viola la regla.">
                                𝑓 EL CÁLCULO, PASO A PASO — <b style={{ color: pt.calc.some((p) => p.ok === false) ? '#f27a6c' : '#7ee0a0' }}>
                                  {pt.calc.filter((p) => p.ok !== false).length}/{pt.calc.length} reglas ✓</b>
                                <span style={{ opacity: 0.6 }}> [Kazmer]</span>
                              </div>
                              <CalcRows pasos={pt.calc} testid={`mold-calc-${pt.role}`} />
                            </>
                          )}
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
  // HIGIENE (v1·2): los CARGADORES de demo (dado, probeta, espiral, N2, flanera,
  // vaso, core/cav, percha, redes) viven en el LOBBY — sección "Banco de pruebas".
  // El ribbon es para OPERAR la pieza: aquí solo quedan los MOLD TOOLS.
  const { cursoStage, cursoBusy, cursoEscala, cursoLayout, cursoParting, cursoSplit, cursoGuias } = mold;
  return (
    <>
            <span className="fb-tb-sep" />
            <div className="fb-group">
              <div className="fb-group-row">
                <button className="fb-big" data-testid="btn-curso-escala" onClick={cursoEscala} disabled={!kernelReady || cursoBusy || cursoStage < 1}
                  title="Scale: about Origin, uniforme ×1.015 (PP 1.5% — cota del curso)"><Ic name="escala" /><span>Escala</span></button>
                <button className="fb-big" data-testid="btn-curso-layout" onClick={cursoLayout} disabled={cursoBusy || cursoStage < 2}
                  title="Move/Copy Body: layout de 2 cavidades (copia rotada, sin traslape)"><Ic name="pattern" /><span>Move/Copy</span></button>
                <button className="fb-big" data-testid="btn-curso-parting" onClick={cursoParting} disabled={cursoBusy || cursoStage < 3}
                  title="Parting Lines: transición +/− del draft → lazo AUTOMÁTICO + mensaje verde (el curso pica 18 aristas a mano)"><Ic name="parting" /><span>Parting Line</span></button>
                <button className="fb-big" data-testid="btn-curso-split" onClick={cursoSplit} disabled={cursoBusy || cursoStage < 4}
                  title="Tooling Split: bloque 350×630, placas 145/90 (cotas del curso) — split + placa rectangular en UNA operación"><Ic name="extrude" /><span>Tooling Split</span></button>
                <button className="fb-big" data-testid="btn-curso-guias" onClick={cursoGuias} disabled={cursoBusy || cursoStage < 5}
                  title="Hole Wizard: bushings ⌀48+caja ⌀54×10 y pernos ⌀35+caja ⌀40×8 en ±142/±277 (cotas del curso)"><Ic name="hole" /><span>Guías</span></button>
              </div>
              <div className="fb-group-cap">MOLD TOOLS</div>
            </div>
    </>
  );
}

/**
 * ANÁLISIS DEL MOLDE §4.3.3/§4.3.4 — los números del paquete de la Máquina, EN el CAD.
 * (Orden 2026-08-10-limpieza-molde: esto vivía en la pantalla duplicada EstudioMolde —
 * 746 líneas con su propio Canvas de cajas — y se migró aquí, donde el visor es el
 * molde B-Rep REAL de al lado.) Todo sale de `construirMolde(pkg)`: semáforos con su
 * cita, cotización, masa por geometría e invariantes del modelo analítico. La malla
 * que se le pasa es la CAJA de la pieza — solo pinta la masa del MOLDEO (gramos);
 * el sólido real de la pieza ya está en el viewport, no se duplica aquí.
 */
export function MoldAnalisisPanel({ mold }: { mold: MoldBag }) {
  const { moldPkg, moldParts } = mold;
  const arm = useMemo(() => {
    if (!moldPkg) return null;
    try {
      const s: any = moldPkg.spec;
      const caja = { x0: 0, y0: 0, z0: 0, x1: s.Lmm, y1: s.Wmm, z1: s.Hmm };
      const m = mallaCaja(0, 0, 0, s.Lmm, s.Wmm, s.Hmm);
      return construirMolde(moldPkg, caja, { positions: m.positions, indices: m.indices }, s.name ?? 'pieza');
    } catch (e) { console.warn('MOLD_ANALISIS_ERR', e); return null; }
  }, [moldPkg]);
  if (!arm || moldParts.length === 0) return null;
  const n = arm.numeros;
  const COLOR: Record<string, string> = { CUMPLE: '#7ee0a0', ADVIERTE: '#f4d27a', VIOLA: '#f27a6c', 'SIN MEDIR': '#7f8da3' };
  const invMal = arm.invariantes.filter((i) => i.ok === false);
  const fila = (k: string, v: string) => (
    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, padding: '1px 6px' }}>
      <span style={{ color: '#8fa1b8' }}>{k}</span><b style={{ color: '#dfe7f2', textAlign: 'right' }}>{v}</b>
    </div>
  );
  return (
    <>
      <div className="fb-feat-subhead" data-testid="mold-analisis">
        📋 Análisis del molde <span style={{ opacity: 0.6, fontWeight: 400 }}>· {(moldPkg as any).spec?.name ?? 'pieza'} · {arm.ms} ms</span>
      </div>
      {fila('bloque L×W×H', `${n.Lmm}×${n.Wmm}×${n.Hmm} mm`)}
      {fila('masa Σ vol×ρ · macizo', `${n.masaAceroKg} kg · ${n.masaBloqueKg} kg`)}
      {fila('cavidades · arquitectura', `${n.nCav} · ${n.arquitecturaEs}`)}
      {n.costoMoldeUSD != null && fila('molde → precio', `$${n.costoMoldeUSD.toLocaleString()} → $${(n.precioMoldeUSD ?? 0).toLocaleString()}`)}
      {n.costoPiezaUSD != null && fila('costo por pieza', `$${n.costoPiezaUSD}`)}
      {n.entregaSemanas != null && fila('entrega · inyectora', `${n.entregaSemanas} sem · ${n.maquina ?? '—'}`)}
      {n.sinPaquete && <div style={{ fontSize: 10.5, color: '#f4d27a', padding: '2px 6px' }}>⚠ {n.sinPaquete}</div>}
      {n.semaforos.map((s) => (
        <div key={s.id} className="fb-comp-row feat" data-testid={`mold-semaforo-${s.id}`} title={`${s.porque} · ${s.seccion}`}
          style={{ display: 'block', padding: '4px 6px', marginTop: 3, borderRadius: 6,
            background: s.estado === 'VIOLA' ? 'rgba(242,122,108,0.10)' : 'rgba(255,255,255,0.03)',
            borderLeft: `2px solid ${COLOR[s.estado]}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLOR[s.estado] }}>{s.estado} · {s.nombre}</div>
          <div style={{ fontSize: 10.5, color: '#9fb2c8', fontFamily: "'JetBrains Mono', monospace" }}>{s.medido}</div>
          <div style={{ fontSize: 10, color: '#7f8da3' }}>vs {s.limite} · {s.seccion}</div>
        </div>
      ))}
      <div data-testid="mold-invariantes" style={{ fontSize: 11, padding: '3px 6px', color: invMal.length ? '#f27a6c' : '#7ee0a0' }}>
        invariantes: {arm.invariantes.filter((i) => i.ok === true).length}/{arm.invariantes.length} PASAN
        {invMal.length > 0 && ` — ✘ ${invMal.map((i) => i.nombre).join(' · ')}`}
      </div>
      {arm.avisos.map((a, i) => (
        <div key={i} style={{ fontSize: 10.5, color: '#f4d27a', padding: '1px 6px' }}>⚠ {a}</div>
      ))}
    </>
  );
}

/**
 * EL CICLO DE KAZMER — el conductor visible (orden 2026-08-10-ciclo-dado-estacion1).
 * El molde del dado se construye estación por estación EN ORDEN DE LIBRO; este panel
 * dice SIEMPRE dónde estamos, qué existe ya y qué retorno puede reabrir cada paso.
 * La estación 1 muestra el juicio de las dos entradas lado a lado: el cubo MACIZO
 * reprobado con su t_c real (Eq 9.5) y el DADO aprobado — el visual de "el libro
 * corrige la pieza ANTES de gastar un gramo de acero".
 */
export function CicloPanel({ mold }: { mold: MoldBag }) {
  const { ciclo, cicloEstacion2, cicloEstacion3, cicloEstacion4, cicloEstacion5, cicloEstacion6, cicloEstacion7, cicloEstacion8, cicloEstacion9, cicloEstacion10, cicloEstacion11, cicloEstacion12, cicloPlaying, cicloProg, cicloActo, cicloPlayToggle } = mold;
  if (!ciclo) return null;
  const cand = (c: { nombre: string; veredicto: string; tcS: number; porque: string[] }, testid: string) => {
    const mal = c.veredicto === 'REPROBADO';
    return (
      <div className="fb-comp-row feat" data-testid={testid}
        style={{ display: 'block', padding: '5px 6px', marginTop: 3, borderRadius: 6,
          background: mal ? 'rgba(242,122,108,0.10)' : 'rgba(126,224,160,0.07)',
          borderLeft: `2px solid ${mal ? '#f27a6c' : '#7ee0a0'}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: mal ? '#f27a6c' : '#7ee0a0' }}>
          {mal ? '✗' : '✓'} {c.nombre} — {c.veredicto}
        </div>
        <div style={{ fontSize: 10.5, color: '#9fb2c8', fontFamily: "'JetBrains Mono', monospace" }}>
          t_c = {c.tcS > 120 ? (c.tcS / 60).toFixed(1) + ' min' : c.tcS.toFixed(1) + ' s'} (Eq 9.5)
        </div>
        {c.porque.slice(1).map((q, i) => (
          <div key={i} style={{ fontSize: 10, color: mal ? '#e0a9a2' : '#7f8da3', marginTop: 1 }}>{q}</div>
        ))}
      </div>
    );
  };
  return (
    <>
      <div className="fb-feat-subhead" data-testid="ciclo-head">
        🔁 CICLO DE KAZMER <span style={{ opacity: 0.6, fontWeight: 400 }}>· estación {ciclo.estacion}/12</span>
      </div>
      <div data-testid="ciclo-estaciones" style={{ padding: '2px 6px', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {CICLO_KAZMER.map((e) => {
          const hecha = e.n < ciclo.estacion, activa = e.n === ciclo.estacion;
          return (
            <span key={e.n} data-testid={`ciclo-est-${e.n}`}
              title={`${e.titulo} (${e.cap}) — ${e.aparece}${e.retorno ? ' · RETORNO: ' + e.retorno : ''}`}
              style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, whiteSpace: 'nowrap',
                border: `1px solid ${activa ? GOLD : hecha ? '#3a5a45' : '#2c3a50'}`,
                color: activa ? GOLD : hecha ? '#7ee0a0' : '#66748a',
                fontWeight: activa ? 700 : 400 }}>
              {hecha ? '✓' : activa ? '▶' : e.n} {e.titulo}
            </span>
          );
        })}
      </div>
      {ciclo.estacion === 1 && (<>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '3px 6px' }}>
        estación 1 — DFM de la pieza (cap 2): dos entradas, un juez
      </div>
      {cand(ciclo.e1.macizo, 'ciclo-macizo')}
      {cand(ciclo.e1.dado, 'ciclo-dado')}
      <div data-testid="ciclo-comparacion" style={{ padding: '2px 6px' }}>
        {ciclo.e1.comparacion.map((c, i) => (
          <div key={i} style={{ fontSize: 10.5, color: '#f4d27a', marginTop: 2 }}>→ {c}</div>
        ))}
      </div>
      </>)}
      {ciclo.estacion === 1 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e2" onClick={cicloEstacion2} style={{ margin: '6px 6px 2px' }}
          title="ECONOMÍA (cap 3): ¿cuántas cavidades? — la Máquina corre las variantes, el break-even A-049, la banda de sensibilidad A-050 y la lectura de sobrediseño A-054. Todavía CERO acero: puro dinero.">
          ▶ estación 2 — ECONOMÍA: ¿cuántos dados por disparo?
        </button>
      )}
      {ciclo.estacion === 2 && ciclo.e2 && <CicloE2 e2={ciclo.e2} onE3={cicloEstacion3} />}
      {ciclo.estacion === 4 && ciclo.e4 && <CicloE4 e4={ciclo.e4} onE5={cicloEstacion5} />}
      {ciclo.estacion === 5 && ciclo.e5 && <CicloE5 e5={ciclo.e5} e5v={ciclo.e5v} datums={ciclo.e5datums} tuberia={ciclo.e5tuberia} onE6={cicloEstacion6} />}
      {ciclo.estacion === 6 && ciclo.e6 && <CicloE6 e6={ciclo.e6} onE7={cicloEstacion7} />}
      {ciclo.estacion === 7 && ciclo.e7 && <CicloE7 e7={ciclo.e7} onE8={cicloEstacion8} />}
      {ciclo.estacion === 8 && ciclo.e8 && <CicloE8 e8={ciclo.e8} onE9={cicloEstacion9} />}
      {ciclo.estacion === 9 && ciclo.e9 && <CicloE9 e9={ciclo.e9} onE10={cicloEstacion10} />}
      {ciclo.estacion === 10 && ciclo.e10 && <CicloE10 e10={ciclo.e10} onE11={cicloEstacion11} />}
      {ciclo.estacion === 11 && ciclo.e11 && <CicloE11 e11={ciclo.e11} onE12={cicloEstacion12} />}
      {ciclo.estacion === 12 && ciclo.e12 && <CicloE12 acta={ciclo.e12} />}
      {/* ▶ EL CICLO COMPLETO — caza de ian: "en prod no hay manera de animar esto".
          El ▶ del árbol solo ABRE y EXPULSA; el LLENADO vivía nada más en
          window.__forgeBrep, o sea que la máquina trabajando era del ARNÉS, no del
          producto. Misma línea de tiempo que el video: llenar → abrir → expulsar. */}
      {ciclo.frenteGrid && (
        <div style={{ padding: '6px 6px 2px' }}>
          <button className="fb-fea-run" data-testid="btn-ciclo-play" onClick={cicloPlayToggle}
            style={{ width: '100%', background: cicloPlaying ? 'rgba(244,210,122,0.16)' : undefined,
              borderColor: cicloPlaying ? GOLD : undefined, color: cicloPlaying ? GOLD : undefined }}
            title="El CICLO COMPLETO en tiempo real (12 s, en bucle): llena por la colada, empaca, abre la carrera del estudio y los pines expulsan la pieza. Vuelve a pulsar para soltar el molde.">
            {cicloPlaying ? '⏸ PARAR EL CICLO' : '▶ VER EL CICLO COMPLETO (llenar · abrir · expulsar)'}
          </button>
          {cicloPlaying && (
            <div data-testid="ciclo-play-prog" style={{ marginTop: 4 }}>
              <div style={{ height: 4, background: '#1b2432', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(cicloProg * 100).toFixed(1)}%`, background: GOLD }} />
              </div>
              <div style={{ fontSize: 10, color: GOLD, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                {cicloActo} · {(cicloProg * 100).toFixed(0)} %
              </div>
            </div>
          )}
        </div>
      )}
      {ciclo.estacion === 3 && ciclo.e3 && <CicloE3 e3={ciclo.e3} e3v={ciclo.e3v} rayo={ciclo.rayo} interMm3={ciclo.interMm3} cicloEstacion3={cicloEstacion3} onE4={ciclo.pieza ? undefined : cicloEstacion4} piezaDelArbol={!!ciclo.pieza} />}
    </>
  );
}

/** Estación 2 desplegada — TODO explicado ("no números sueltos: su porqué al lado").
 *  La columna clave es el DESGLOSE: amortización (molde$/Q, declarando que ignora el
 *  factor de mantenimiento §3.4.1) + material/proceso = total. La tabla ES la prueba:
 *  se puede sumar a mano. */
function CicloE2({ e2, onE3 }: { e2: import('../mold/estudio-molde-datos').Estacion2Dado; onE3?: () => void }) {
  return (
    <>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px 2px' }}>
        estación 2 — economía (cap 3): la tabla se puede sumar a mano (amort + resto = total)
      </div>
      {e2.variantes.map((v, i) => (
        <div key={i} className="fb-comp-row feat" data-testid={`e2-var-${v.arch}-${v.nCav}`} title={v.porque}
          style={{ display: 'block', padding: '4px 6px', marginTop: 2, borderRadius: 6,
            background: v.ganadora ? 'rgba(244,210,122,0.10)' : 'rgba(255,255,255,0.02)',
            borderLeft: `2px solid ${v.ganadora ? '#f4d27a' : '#2c3a50'}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: v.ganadora ? '#f4d27a' : '#9fb2c8' }}>
            {v.ganadora ? '★ ' : ''}{v.arch} ×{v.nCav} <span style={{ opacity: 0.6, fontWeight: 400 }}>· molde ${v.moldeUSD.toLocaleString()}</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#9fb2c8', fontFamily: "'JetBrains Mono', monospace" }}>
            ${v.amortPzaUSD} amort + ${v.restoPzaUSD} mat/proc = <b style={{ color: v.ganadora ? '#7ee0a0' : '#dfe7f2' }}>${v.totalPzaUSD}/pza</b>
          </div>
          {!v.ganadora && <div style={{ fontSize: 10, color: '#7f8da3', marginTop: 1 }}>{v.porque}</div>}
        </div>
      ))}
      <div data-testid="e2-breakeven" style={{ fontSize: 10.5, color: '#8fa1b8', padding: '4px 6px 0' }}>
        <b style={{ color: '#dfe7f2' }}>A-049 break-even:</b> {e2.breakEven.join(' · ')}
      </div>
      <div data-testid="e2-banda" style={{ padding: '4px 6px 0' }}>
        <div style={{ fontSize: 10.5, color: '#dfe7f2', fontWeight: 700 }}>A-050 ¿y si vendieras MÁS? — la banda de sensibilidad</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
          {e2.banda.map((b, i) => {
            const cambia = i > 0 && (b.nCav !== e2.banda[i - 1].nCav || b.arch !== e2.banda[i - 1].arch);
            return (
              <span key={b.q} data-testid={`e2-banda-${b.q}`}
                title={`a ${b.q.toLocaleString()} piezas totales gana ${b.arch} ×${b.nCav} con $${b.pzaUSD}/pza`}
                style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8,
                  border: `1px solid ${cambia ? GOLD : '#2c3a50'}`, color: cambia ? GOLD : '#9fb2c8', fontWeight: cambia ? 700 : 400 }}>
                {b.q / 1000}k → ×{b.nCav} (${b.pzaUSD})
              </span>
            );
          })}
        </div>
        <div style={{ fontSize: 10.5, color: '#f4d27a', marginTop: 3 }}>→ {e2.bandaLectura}</div>
      </div>
      <div data-testid="e2-proporcion" style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px' }}>
        <b style={{ color: '#dfe7f2' }}>A-054 sobrediseño:</b> molde ${e2.proporcion.moldeUSD.toLocaleString()} vs producción ${e2.proporcion.produccionUSD.toLocaleString()} — {e2.proporcion.lectura}
      </div>
      <div style={{ fontSize: 10.5, color: '#7ee0a0', padding: '0 6px 4px' }}>
        veredicto: {e2.veredicto.viable ? 'VIABLE ✓' : 'REVISAR ⚠'} · precio molde ${e2.veredicto.precioMoldeUSD.toLocaleString()} · {e2.veredicto.entregaSemanas} semanas
      </div>
      {onE3 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e3" onClick={() => onE3()} style={{ margin: '4px 6px 6px' }}
          title="ARQUITECTURA (cap 4): el dado gana su draft REAL (1.5° tallado), splitMold talla cavidad y núcleo, la base se compra con su aritmética a la vista — y los semáforos §4.3.3 despiertan.">
          ▶ estación 3 — ARQUITECTURA: nace el primer acero
        </button>
      )}
    </>
  );
}


/** Estación 3 desplegada — la arquitectura EXPLICADA: cada dimensión con la
 *  aritmética que la produjo (la base no "es" 196: NECESITA 184 y 196 es la
 *  primera medida del catálogo). Los retornos van declarados al pie: este acero
 *  se va a REABRIR y el panel lo dice desde hoy. */
function CicloE3({ e3, e3v, rayo, interMm3, cicloEstacion3, onE4, piezaDelArbol }: { e3: import('../mold/estudio-molde-datos').Estacion3Dado; e3v?: import('../mold/estudio-molde-datos').VerificacionE3; rayo?: import('../mold/estudio-molde-datos').PruebaRayo; interMm3?: number; cicloEstacion3?: (malo?: boolean) => void; onE4?: () => void; piezaDelArbol?: boolean }) {
  const fila = (titulo: string, cuerpo: string, porque: string, testid: string, color = '#9db4d0') => (
    <div className="fb-comp-row feat" data-testid={testid} title={porque}
      style={{ display: 'block', padding: '4px 6px', marginTop: 2, borderRadius: 6,
        background: 'rgba(255,255,255,0.02)', borderLeft: `2px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#dfe7f2' }}>{titulo}</div>
      <div style={{ fontSize: 10.5, color: '#9fb2c8', fontFamily: "'JetBrains Mono', monospace" }}>{cuerpo}</div>
      <div style={{ fontSize: 10, color: '#7f8da3', marginTop: 1 }}>{porque}</div>
    </div>
  );
  return (
    <>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px 2px' }}>
        estación 3 — arquitectura (cap 4): el primer acero, con su aritmética a la vista
      </div>
      {fila('A-060 · dirección de apertura', 'Z', e3.apertura, 'e3-apertura', '#7ee0a0')}
      {fila('A-061 · línea de partición', 'plana · z = boca', e3.particion, 'e3-particion', '#f4d27a')}
      {fila('§2.3.6 · el draft se TALLA', '1.5° reales (loft)', e3.draft, 'e3-draft', '#7ee0a0')}
      {e3.insertos.map((i, k) => fila(i.nombre, i.dims, i.porque, `e3-inserto-${k}`))}
      {fila('§4.3.2 · la base SE COMPRA', e3.base.aritmetica, e3.base.porque, 'e3-base', '#f4d27a')}
      <div data-testid="e3-stack" style={{ padding: '3px 6px' }}>
        <div style={{ fontSize: 10.5, color: '#dfe7f2', fontWeight: 700 }}>EL STACK — {e3.stackMm} mm, acero por placa</div>
        {e3.stack.map((f, k) => (
          <div key={k} title={f.porque} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10.5, padding: '1px 0', color: '#9fb2c8' }}>
            <span>{f.nombre}</span><span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{f.espesorMm} mm · {f.acero}</span>
          </div>
        ))}
        <div style={{ fontSize: 10, color: '#7f8da3', marginTop: 2 }}>P20 SOLO donde se moldea; C45 donde solo se sujeta — pagar acero de molde en una placa de sujeción es tirar dinero (§4.4.4)</div>
      </div>
      {rayo && cicloEstacion3 && !piezaDelArbol && (
        <button className="fb-fea-run" data-testid="btn-rayo-undercut" onClick={() => cicloEstacion3(true)} style={{ margin: '4px 6px 0' }}
          title="Carga el MISMO dado con el draft INVERTIDO — un molde que NO puede abrir. Si el mapa no se pinta de rojo, la prueba no sirve.">
          🧪 probar el caso ROTO (draft invertido) — ¿el mapa lo caza?
        </button>
      )}
      {rayo && (
        <div data-testid="e3-rayo" style={{ padding: '5px 6px 2px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: rayo.atrapados === 0 ? '#7ee0a0' : '#f27a6c' }}>
            🎯 LA PRUEBA DEL RAYO — {rayo.veredicto} · atrapadas: {rayo.atrapados}
          </div>
          <div style={{ fontSize: 10, color: '#7f8da3', margin: '1px 0 3px' }}>
            cada mitad se retira en su dirección; sus caras que MIRAN a la salida tienen que
            estar libres. Si su propio acero las tapa = undercut = el molde no abre.
            <b> atrapadas = 0 ES el teorema.</b>
          </div>
          {rayo.mitades.map((m, k) => (
            <div key={k} data-testid={`e3-rayo-${k}`} style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: m.nAtrapados ? '#f27a6c' : '#9fb2c8' }}>
              {m.nAtrapados ? '✗' : '✓'} {m.nombre}: {m.nSalen} libres · {m.nVerticales} verticales · {m.nAtrapados} ATRAPADAS{m.nAtrapados ? ` (${m.areaAtrapadaMm2} mm²)` : ''}
            </div>
          ))}
          <div style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: (interMm3 ?? 1) < 1 ? '#9fb2c8' : '#f27a6c' }}>
            {(interMm3 ?? 1) < 1 ? '✓' : '✗'} cavidad ∩ núcleo = {interMm3} mm³ (los dos aceros no se comen)
          </div>
          <div style={{ fontSize: 10, color: '#7f8da3', marginTop: 2 }}>
            🟩 libre · 🟦 se libera por draft · ⬜ pared vertical · 🟥 ATRAPADA — el mapa está sobre el acero
          </div>
        </div>
      )}
      {e3v && (
        <div data-testid="e3-medidas" style={{ padding: '4px 6px 2px' }}>
          <div style={{ fontSize: 10.5, color: '#dfe7f2', fontWeight: 700 }}>
            📏 MEDIDAS — declarado vs MEDIDO del sólido (dibujo técnico: cada cota en su vista)
          </div>
          <div style={{ fontSize: 10, color: e3v.ok ? '#7ee0a0' : '#f27a6c', margin: '2px 0' }}>{e3v.resumen} · interferencia: IMPOSIBLE por construcción (las 3 piezas parten el bloque; la fila Σ=bloque lo mide)</div>
          {e3v.medidas.map((m, k) => (
            <div key={k} data-testid={`e3-medida-${k}`} title={m.vista}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace", padding: '1px 0',
                color: m.ok ? '#9fb2c8' : '#f27a6c', fontWeight: m.ok ? 400 : 700 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.ok ? '✓' : '✗'} {m.componente} · {m.cota}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{m.declarado} ≈ {m.medido}</span>
            </div>
          ))}
        </div>
      )}
      <div data-testid="e3-semaforos-nota" style={{ fontSize: 10.5, color: '#f4d27a', padding: '2px 6px' }}>
        🚦 los semáforos §4.3.3 DESPERTARON — míralos arriba en «Análisis del molde» (el daylight ya ADVIERTE con 8 mm)
      </div>
      {e3.retornos.map((r, k) => (
        <div key={k} data-testid={`e3-retorno-${k}`} style={{ fontSize: 10.5, color: '#8fa1b8', padding: '1px 6px' }}>{r}</div>
      ))}
      {onE4 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e4" onClick={onE4} style={{ margin: '4px 6px 6px' }}
          title="LLENADO (cap 5): la pieza pintada por cuándo le llega el plástico, el lazo de convergencia de la velocidad, y la última zona en llenarse — que es dónde irá el venteo.">
          ▶ estación 4 — LLENADO: ¿dónde muere el aire?
        </button>
      )}
      {!onE4 && piezaDelArbol && (
        // v1·3 desbloqueó la E3 para la pieza del árbol; el LLENADO (E4+) sigue
        // cableado al cubo (dentroDadoLocal). Decirlo > fingir.
        <div data-testid="ciclo-e4-bloqueada" style={{ margin: '4px 6px 6px', padding: '7px 9px', borderRadius: 6, border: '1px dashed #3a4a60', fontSize: 10.5, color: '#8fa1b8', lineHeight: 1.4 }}>
          ⏸ estación 4 — LLENADO en adelante sigue cableado al CUBO; para TU pieza llega en un ticket posterior. Hasta aquí YA son tuyos: DFM (E1), economía (E2) y el ACERO con sus medidas y su rayo (E3) — medidos de TU sólido.
        </div>
      )}
    </>
  );
}

/** Estación 4 — LLENADO (cap 5). El lazo de convergencia se DIBUJA iterando (el libro
 *  itera; aquí se ve), y los defectos que el dado delata se ANUNCIAN con su estación
 *  destino: el proceso es un GRAFO CON RETORNOS (§1.5 Fig 1.9), no una fila. */
function CicloE4({ e4, onE5 }: { e4: import('../mold/estudio-molde-datos').Estacion4Dado; onE5?: () => void }) {
  const COL: Record<string, string> = { CUMPLE: '#7ee0a0', ADVIERTE: '#f4d27a', VIOLA: '#f27a6c' };
  const max = Math.max(...e4.escalera, 1e-9);
  return (
    <>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px 2px' }}>
        estación 4 — llenado (cap 5): la velocidad no se elige, se RESUELVE iterando
      </div>
      <div data-testid="e4-escalera" style={{ padding: '2px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 34 }}>
          {e4.escalera.map((v, i) => (
            <div key={i} title={`vuelta ${i}: ${v} m/s`} style={{ flex: 1, height: `${(v / max) * 100}%`,
              background: i === e4.escalera.length - 1 ? GOLD : '#2f4a63', borderRadius: '2px 2px 0 0' }} />
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#7f8da3', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
          A-088 · {e4.escalera[0]} → {e4.vMs} m/s en {e4.vueltas} vueltas · {e4.convergio ? 'CONVERGE ✓' : 'NO CONVERGE ✗'}
        </div>
      </div>
      {e4.filas.map((r) => (
        <div key={r.id} className="fb-comp-row feat" data-testid={`e4-${r.id}`} title={r.porque}
          style={{ display: 'block', padding: '4px 6px', marginTop: 2, borderRadius: 6,
            background: r.estado === 'VIOLA' ? 'rgba(242,122,108,0.10)' : 'rgba(255,255,255,0.02)',
            borderLeft: `2px solid ${COL[r.estado]}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COL[r.estado] }}>{r.estado} · {r.titulo}</div>
          <div style={{ fontSize: 10.5, color: '#9fb2c8', fontFamily: "'JetBrains Mono', monospace" }}>{r.valor}</div>
          <div style={{ fontSize: 10, color: '#7f8da3' }}>vs {r.limite} · {r.seccion}</div>
        </div>
      ))}
      {e4.ultimaZona && (
        <div data-testid="e4-ultima-zona" style={{ fontSize: 10.5, color: '#c9a6ff', padding: '4px 6px' }}>
          🟣 <b>A-104 · la ÚLTIMA zona en llenarse</b> ({e4.ultimaZona.x}, {e4.ultimaZona.y}, {e4.ultimaZona.z}) a {e4.ultimaZona.tS} s
          <div style={{ fontSize: 10, color: '#7f8da3' }}>ahí muere el aire — el cap 5 le pasa la coordenada al cap 8: es DÓNDE VA EL VENTEO (estación 7)</div>
        </div>
      )}
      {e4.anuncios.length > 0 && (
        <div data-testid="e4-anuncios" style={{ padding: '4px 6px 6px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f4d27a' }}>
            ⟲ lo que este dado YA delata — y NO se arregla aquí ({e4.anuncios.length})
          </div>
          {e4.anuncios.map((a, k) => (
            <div key={k} data-testid={`e4-anuncio-${k}`} style={{ fontSize: 10.5, color: '#e0c98a', marginTop: 3 }}>
              <b>→ estación {a.estacion}:</b> {a.titulo}
              <div style={{ fontSize: 10, color: '#8fa1b8' }}>{a.detalle} · {a.seccion}</div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#7f8da3', marginTop: 3 }}>
            el proceso del libro es un GRAFO CON RETORNOS (§1.5 Fig 1.9): el defecto se ANUNCIA en la estación que lo descubre y se ARREGLA en la que manda.
          </div>
        </div>
      )}
      {onE5 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e5" onClick={() => onE5()} style={{ margin: '4px 6px 6px' }}
          title="ALIMENTACIÓN (cap 6): bebedero dimensionado desde el orificio de la boquilla, runner steel-safe, pozo de escoria y compuerta de canto — y la cuenta CERRADA de presión que el cap 5 dejó abierta a propósito.">
          ▶ estación 5 — ALIMENTACIÓN: que la colada ESTRECHE hacia la pieza
        </button>
      )}
    </>
  );
}

/** Estación 5 — ALIMENTACIÓN (cap 6). Nació de "se sigue viendo raro el sprue": la
 *  conicidad estaba bien (medida), pero la colada terminaba en su punto MÁS ANCHO justo
 *  donde tocaba una pared de 2 mm. Aquí la sección BAJA monótona hasta la compuerta, y
 *  cada número sale de `feed.ts`/`gating.ts` — esta estación no inventa una sola fórmula. */
function CicloE5({ e5, e5v, datums, tuberia, onE6 }: {
  e5: import('../mold/estudio-molde-datos').Estacion5Dado;
  e5v?: import('../mold/colada').VerificacionColada;
  datums?: import('../mold/colada').DatumsColada;
  tuberia?: { unreachable: number; snapMm: number; volColadaVoxCc: number; volPiezaCc: number };
  onE6?: () => void;
}) {
  const COL: Record<string, string> = { CUMPLE: '#7ee0a0', ADVIERTE: '#f4d27a', VIOLA: '#f27a6c' };
  const E = e5.estrecha;
  return (
    <>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px 2px' }}>
        estación 5 — alimentación (cap 6): boquilla → bebedero → runner → pozo → compuerta → pieza
      </div>
      {/* ⚠ EL CONFLICTO ESPACIAL, PRIMERO. datumsColada lo detecta (el eje del bushing
          cae sobre la BOCA → el sprue centrado PERFORA el macho) pero el CAD lo dibujaba
          sin decirlo — la revisión con ojos lo cazó: el bebedero muere DENTRO del hueco.
          La decisión (desplazar cavidad / voltear pieza) es de ian = retorno a la E3. */}
      {datums && datums.conflictos.length > 0 && (
        <div data-testid="e5-conflicto" style={{ margin: '4px 6px', padding: '6px 8px', borderRadius: 6,
          background: 'rgba(242,122,108,0.14)', border: '1px solid rgba(242,122,108,0.5)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f27a6c' }}>
            ⛔ CONFLICTO ESPACIAL ({datums.modo}) — esta colada NO se puede tallar así
          </div>
          {datums.conflictos.map((c, k) => (
            <div key={k} style={{ fontSize: 10.5, color: '#f4a9a0', marginTop: 3 }}>{c}</div>
          ))}
          <div style={{ fontSize: 10, color: '#c9a6ff', marginTop: 3 }}>
            ⟲ retorno a la ESTACIÓN 3 — el layout decide; mientras, el sólido dibujado es el testigo del conflicto
          </div>
        </div>
      )}
      {/* LA ALARMA DE LA TUBERÍA ÚNICA — nació de que NO existía: el llenado y la colada
          eran dos dominios desconectados y nada gritó (ian: "el hecho de que no haya
          levantado una alarma quiere decir que está mal todo"). El campo conjunto la
          hace medible: unreachable = vóxeles que el fundido NO alcanza desde la boquilla. */}
      {tuberia && (() => {
        // la alarma exige LAS DOS: 0 inalcanzables Y la semilla en la boquilla pedida —
        // measureFlowLength teleporta la semilla al vóxel más cercano si el punto no cae
        // en el dominio, y eso mataría la alarma con la tubería rota.
        const ok = tuberia.unreachable === 0 && tuberia.snapMm <= 2;
        return (
          <div data-testid="e5-tuberia" style={{ fontSize: 10.5, padding: '3px 6px', margin: '2px 6px', borderRadius: 6,
            background: ok ? 'rgba(126,224,160,0.10)' : 'rgba(242,122,108,0.16)',
            border: `1px solid ${ok ? 'rgba(126,224,160,0.4)' : 'rgba(242,122,108,0.6)'}`,
            color: ok ? '#7ee0a0' : '#f27a6c', fontWeight: 700 }}>
            {ok
              ? `✓ UNA SOLA TUBERÍA — boquilla → bebedero → runner → compuerta → pieza: 0 vóxeles inalcanzables · semilla EN la boquilla (desvío ${tuberia.snapMm.toFixed(1)} mm) · colada ${tuberia.volColadaVoxCc.toFixed(1)} cc + pieza ${tuberia.volPiezaCc.toFixed(1)} cc en UN campo`
              : tuberia.snapMm > 2
                ? `⛔ TUBERÍA ROTA — la semilla se TELEPORTÓ ${tuberia.snapMm.toFixed(0)} mm desde la boquilla (el dominio no la contiene): el fundido no entra por donde debe.`
                : `⛔ TUBERÍA ROTA — ${tuberia.unreachable} vóxeles NO alcanzables desde la boquilla: el fundido no tiene camino. Revisa compuerta/posición de la cavidad.`}
          </div>
        );
      })()}
      {/* LA ALARMA DE BALANCE (§6.6 "naturally balanced" · §4.3 layouts simétricos ·
          Fig 7.2: una cavidad = al centro). Nació de que moví TODO el layout 29.2 mm y
          ningún check gritó — y el del marco lo edité yo para que lo esperara. */}
      {datums && tuberia && (() => {
        // centroide de la cavidad desde los datums: en sprue+runner el destino es el
        // labio CERCANO (x0) → centroide = x0 + semiancho; en requiere-offset el destino
        // es el labio LEJANO (x1) → centroide = x1 − semiancho; en directo, el eje mismo.
        const halfW = 20;                                          // semiancho del dado (cota E1)
        const centroX = datums.modo === 'sprue-directo' ? datums.ejeX
          : datums.modo === 'requiere-offset' ? datums.destino.x - halfW : datums.destino.x + halfW;
        const desb = Math.abs(centroX - datums.ejeX);
        const umbral = 9.8;                                        // 5 % de la base 196 — EXTENSIÓN DECLARADA
        const ok = desb <= umbral;
        return (
          <div data-testid="e5-balance" style={{ fontSize: 10.5, padding: '3px 6px', margin: '2px 6px', borderRadius: 6,
            background: ok ? 'rgba(126,224,160,0.10)' : 'rgba(242,122,108,0.16)',
            border: `1px solid ${ok ? 'rgba(126,224,160,0.4)' : 'rgba(242,122,108,0.6)'}`,
            color: ok ? '#7ee0a0' : '#f27a6c', fontWeight: 700 }}>
            {ok
              ? `✓ BALANCE — el centroide de la cavidad está en el eje de la máquina (desbalance ${desb.toFixed(1)} mm ≤ ${umbral} mm)`
              : `⛔ DESBALANCE — la cavidad está a ${desb.toFixed(1)} mm del eje de la máquina (umbral ${umbral} mm, §6.6/§4.3). La fuerza de cierre queda excéntrica. ⟲ E3: voltear la pieza = sprue directo AL CENTRO (Fig 7.2).`}
          </div>
        );
      })()}
      {/* LA CASCADA: es LO que se veía al revés, y ahora se lee de un golpe */}
      <div data-testid="e5-cascada" style={{ padding: '4px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
          {[{ n: 'bebedero', v: E.sprueBaseMm }, { n: 'runner', v: E.runnerMm }, { n: 'compuerta', v: E.gateMm }].map((x, i, a) => (
            <Fragment key={x.n}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: Math.max(6, x.v * 3.2), height: Math.max(6, x.v * 3.2), borderRadius: '50%',
                  background: GOLD, opacity: 0.85, margin: '0 auto' }} />
                <div style={{ fontSize: 9.5, color: '#9fb2c8', marginTop: 2 }}>{x.n}</div>
                <div style={{ fontSize: 10, color: GOLD }}>{x.v.toFixed(1)}</div>
              </div>
              {i < a.length - 1 && <span style={{ color: '#7f8da3' }}>▸</span>}
            </Fragment>
          ))}
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: E.ok ? '#7ee0a0' : '#f27a6c' }}>
            {E.ok ? 'ESTRECHA ✓' : 'NO ESTRECHA ✗'}
          </span>
        </div>
      </div>
      {e5v && (
        <div data-testid="e5-medido" style={{ fontSize: 10.5, padding: '2px 6px', color: e5v.ok ? '#7ee0a0' : '#f27a6c' }}>
          📏 MEDIDO del sólido por <code>verificacionColada</code> — {e5v.resumen}
          {e5v.medidas.filter((m) => !m.ok).map((m, k) => (
            <div key={k} style={{ fontSize: 10, color: '#f27a6c' }}>✘ {m.cota}: {m.declarado} vs {m.medido} ({m.seccion})</div>
          ))}
          <div style={{ fontSize: 10, color: '#7f8da3' }}>la MISMA verificación que corre el gate — no mediciones sueltas en la pantalla</div>
        </div>
      )}
      {e5.filas.map((r) => (
        <div key={r.id} className="fb-comp-row feat" data-testid={`e5-${r.id}`} title={r.porque}
          style={{ display: 'block', padding: '4px 6px', marginTop: 2, borderRadius: 6,
            background: r.estado === 'VIOLA' ? 'rgba(242,122,108,0.10)' : 'rgba(255,255,255,0.02)',
            borderLeft: `2px solid ${COL[r.estado]}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COL[r.estado] }}>{r.estado} · {r.titulo}</div>
          <div style={{ fontSize: 10.5, color: '#9fb2c8', fontFamily: "'JetBrains Mono', monospace" }}>{r.valor}</div>
          <div style={{ fontSize: 10, color: '#7f8da3' }}>vs {r.limite} · {r.seccion}</div>
        </div>
      ))}
      {e5.anuncios.length > 0 && (
        <div data-testid="e5-anuncios" style={{ padding: '4px 6px 6px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f4d27a' }}>
            ⟲ lo que esta colada delata — y NO se arregla aquí ({e5.anuncios.length})
          </div>
          {e5.anuncios.map((a, k) => (
            <div key={k} data-testid={`e5-anuncio-${k}`} style={{ fontSize: 10.5, color: '#e0c98a', marginTop: 3 }}>
              <b>→ estación {a.estacion}:</b> {a.titulo}
              <div style={{ fontSize: 10, color: '#8fa1b8' }}>{a.detalle} · {a.seccion}</div>
            </div>
          ))}
        </div>
      )}
      {onE6 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e6" onClick={() => onE6()} style={{ margin: '4px 6px 6px' }}
          title="EMPAQUE (cap 7): sostener presión hasta que el gate congela — el retorno de la E4 se resuelve aquí, y la contracción pvT entrega su número a la E9">
          ▶ estación 6 — EMPAQUE: compensar la contracción
        </button>
      )}
    </>
  );
}

/** Estación 6 — EMPAQUE (cap 7). El retorno de la E4 CERRADO (el gate real es el
 *  sprue de la Fig 7.2), la contracción pvT con su número para la E9, y LA BANDERA
 *  de exageración SIEMPRE visible (pedido de ian: exagerar el encogimiento en
 *  escena, jamás sin rótulo — el número real manda en filas y gates). */
function CicloE6({ e6, onE7 }: { e6: import('../mold/estudio-molde-datos').Estacion6Dado; onE7?: () => void }) {
  const COL: Record<string, string> = { CUMPLE: '#7ee0a0', ADVIERTE: '#f4d27a', VIOLA: '#f27a6c' };
  return (
    <>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px 2px' }}>
        estación 6 — empaque (cap 7): sostener presión hasta que el gate congela
      </div>
      <div data-testid="e6-bandera" style={{ margin: '4px 6px', padding: '5px 7px', background: '#3a2f14', border: '1px solid #f4d27a', borderRadius: 6, fontSize: 10.5, color: '#f4d27a', fontWeight: 700 }}>
        ⚠ LA ESCENA EXAGERA LA CONTRACCIÓN ×{e6.contraccion.exag} — real: {e6.contraccion.linealPct} % lineal
        <div style={{ fontWeight: 400, color: '#e0c98a', fontSize: 10 }}>
          práctica estándar (Moldflow pinta el warp escalado y rotulado); mueve el reloj 💧 para ver el encogimiento
        </div>
      </div>
      <div style={{ margin: '2px 6px' }}>
        {e6.filas.map((f) => (
          <div key={f.id} data-testid={`e6-fila-${f.id}`} style={{ padding: '4px 6px', marginBottom: 3, background: '#141a22', borderRadius: 6, borderLeft: `3px solid ${COL[f.estado]}` }}>
            <div style={{ fontSize: 10.5, color: '#dfe8f4' }}>
              <b>{f.titulo}</b> · <span style={{ color: COL[f.estado], fontWeight: 700 }}>{f.estado}</span>
            </div>
            <div style={{ fontSize: 10.5, color: '#a8bad0' }}>{f.valor} <span style={{ color: '#6f8199' }}>(límite: {f.limite})</span></div>
            <div style={{ fontSize: 10, color: '#8fa1b8' }}>{f.porque} · {f.seccion}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: '2px 6px 6px', padding: '5px 7px', background: '#12202b', borderRadius: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9fd0f4' }}>la CADENA del gate (§7.3.4 · el retorno de la E4)</div>
        {e6.gate.cadena.map((c, k) => (
          <div key={k} style={{ fontSize: 10, color: '#a8bad0', marginTop: 2 }}>· {c}</div>
        ))}
      </div>
      {e6.anuncios.length > 0 && (
        <div style={{ margin: '2px 6px 8px', padding: '5px 7px', background: '#241a10', borderRadius: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f4d27a' }}>⟲ anuncios ({e6.anuncios.length})</div>
          {e6.anuncios.map((a, k) => (
            <div key={k} data-testid={`e6-anuncio-${k}`} style={{ fontSize: 10.5, color: '#e0c98a', marginTop: 3 }}>
              <b>→ estación {a.estacion}:</b> {a.titulo}
              <div style={{ fontSize: 10, color: '#8fa1b8' }}>{a.detalle} · {a.seccion}</div>
            </div>
          ))}
        </div>
      )}
      {onE7 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e7" onClick={() => onE7()} style={{ margin: '4px 6px 6px' }}
          title="VENTEO (cap 8): el mapa de candidatos MEDIDO del campo — el aire sale por donde el melt llega al último">
          ▶ estación 7 — VENTEO: dejar salir el aire
        </button>
      )}
    </>
  );
}

/** Estación 7 — VENTEO (cap 8). El mapa MEDIDO del campo (fin-de-flujo en la
 *  partición), la banda h_min/h_max del libro, los 3 handbooks citados, y LA
 *  BANDERA del espesor exagerado (patrón E6: el 0.02 mm real es invisible). */
function CicloE7({ e7, onE8 }: { e7: import('../mold/estudio-molde-datos').Estacion7Dado; onE8?: () => void }) {
  const COL: Record<string, string> = { CUMPLE: '#7ee0a0', ADVIERTE: '#f4d27a', VIOLA: '#f27a6c' };
  return (
    <>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px 2px' }}>
        estación 7 — venteo (cap 8): el aire sale por donde el melt llega al último
      </div>
      <div data-testid="e7-bandera" style={{ margin: '4px 6px', padding: '5px 7px', background: '#3a2f14', border: '1px solid #f4d27a', borderRadius: 6, fontSize: 10.5, color: '#f4d27a', fontWeight: 700 }}>
        ⚠ SOLO el espesor del LAND va ×{e7.exag} en escena — real: {e7.banda.hPropMm} mm (§8.3.1 · Menges 0.015–0.03)
        <div style={{ fontWeight: 400, color: '#e0c98a', fontSize: 10 }}>
          alivio (canal 3×2 mm) y salida (⌀3) van a escala REAL — anatomía Fig 8.6; posición y planta son las MEDIDAS
        </div>
      </div>
      <div style={{ margin: '2px 6px' }}>
        {e7.filas.map((f) => (
          <div key={f.id} data-testid={`e7-fila-${f.id}`} style={{ padding: '4px 6px', marginBottom: 3, background: '#141a22', borderRadius: 6, borderLeft: `3px solid ${COL[f.estado]}` }}>
            <div style={{ fontSize: 10.5, color: '#dfe8f4' }}>
              <b>{f.titulo}</b> · <span style={{ color: COL[f.estado], fontWeight: 700 }}>{f.estado}</span>
            </div>
            <div style={{ fontSize: 10.5, color: '#a8bad0' }}>{f.valor} <span style={{ color: '#6f8199' }}>(límite: {f.limite})</span></div>
            <div style={{ fontSize: 10, color: '#8fa1b8' }}>{f.porque} · {f.seccion}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: '2px 6px 6px', padding: '5px 7px', background: '#12202b', borderRadius: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9fd0f4' }}>el MAPA (§8.2.2 — posiciones medidas del campo)</div>
        {e7.candidatos.map((c, k) => (
          <div key={k} data-testid={`e7-candidato-${k}`} style={{ fontSize: 10, color: '#a8bad0', marginTop: 2 }}>
            · {c.lado} ({c.xMm}, {c.yMm}, {c.zMm}) — {c.tipo} · <b style={{ color: c.estado === 'obligatorio' ? '#7ee0a0' : c.estado.includes('FUERA') ? '#f27a6c' : '#f4d27a' }}>{c.estado}</b>
          </div>
        ))}
      </div>
      {e7.anuncios.length > 0 && (
        <div style={{ margin: '2px 6px 8px', padding: '5px 7px', background: '#241a10', borderRadius: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f4d27a' }}>⟲ anuncios ({e7.anuncios.length})</div>
          {e7.anuncios.map((a, k) => (
            <div key={k} data-testid={`e7-anuncio-${k}`} style={{ fontSize: 10.5, color: '#e0c98a', marginTop: 3 }}>
              <b>→ estación {a.estacion}:</b> {a.titulo}
              <div style={{ fontSize: 10, color: '#8fa1b8' }}>{a.detalle} · {a.seccion}</div>
            </div>
          ))}
        </div>
      )}
      {onE8 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e8" onClick={() => onE8()} style={{ margin: '4px 6px 6px' }}
          title="ENFRIAMIENTO (cap 9): el rey del ciclo — el agua, y el hallazgo de que el BEBEDERO manda el tiempo de ciclo">
          ▶ estación 8 — ENFRIAMIENTO: el agua (el rey del ciclo)
        </button>
      )}
    </>
  );
}

/** Estación 8 — ENFRIAMIENTO (cap 9). El rey del ciclo: los 7 pasos NARRADOS
 *  (fórmula → sustitución → resultado, la pantalla que hace que los errores
 *  salten), el veredicto del ciclo (el bebedero manda ×8.2) y EL RETORNO A LA
 *  E2 con DINERO — la única estación que cambia el precio de la pieza. */
function CicloE8({ e8, onE9 }: { e8: import('../mold/estudio-molde-datos').Estacion8Dado; onE9?: () => void }) {
  const COL: Record<string, string> = { CUMPLE: '#7ee0a0', ADVIERTE: '#f4d27a', VIOLA: '#f27a6c' };
  return (
    <>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px 2px' }}>
        estación 8 — enfriamiento (cap 9): el rey del ciclo
      </div>
      <div data-testid="e8-ciclo" style={{ margin: '4px 6px', padding: '5px 7px', background: e8.ciclo.manda === 'bebedero' ? '#3a2f14' : '#12281c', border: `1px solid ${e8.ciclo.manda === 'bebedero' ? '#f4d27a' : '#7ee0a0'}`, borderRadius: 6, fontSize: 10.5, color: e8.ciclo.manda === 'bebedero' ? '#f4d27a' : '#7ee0a0', fontWeight: 700 }}>
        ⏱ MANDA EL {e8.ciclo.manda.toUpperCase()}: pieza {e8.ciclo.tcPiezaS} s (Eq 9.5) vs bebedero ⌀{e8.bushing.diaActualMm} {e8.ciclo.tcSprueS} s (Eq 9.6) = ×{e8.ciclo.factor}
        <div style={{ fontWeight: 400, color: '#e0c98a', fontSize: 10 }}>
          §9.2.1: "the cycle time can be dominated by the cooling of the cold runners" — el ciclo del dado NO es el de su pared
        </div>
      </div>
      <div style={{ margin: '2px 6px' }}>
        {e8.filas.map((f) => (
          <div key={f.id} data-testid={`e8-fila-${f.id}`} style={{ padding: '4px 6px', marginBottom: 3, background: '#141a22', borderRadius: 6, borderLeft: `3px solid ${COL[f.estado]}` }}>
            <div style={{ fontSize: 10.5, color: '#dfe8f4' }}>
              <b>{f.titulo}</b> · <span style={{ color: COL[f.estado], fontWeight: 700 }}>{f.estado}</span>
            </div>
            <div style={{ fontSize: 10.5, color: '#a8bad0' }}>{f.valor} <span style={{ color: '#6f8199' }}>(límite: {f.limite})</span></div>
            <div style={{ fontSize: 10, color: '#8fa1b8' }}>{f.porque} · {f.seccion}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: '2px 6px 6px', padding: '5px 7px', background: '#12202b', borderRadius: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9fd0f4' }}>EL CRUCE E6↔E8 — la cadena del bushing</div>
        {e8.bushing.cadena.map((c, k) => (
          <div key={k} data-testid={`e8-cadena-${k}`} style={{ fontSize: 10, color: '#a8bad0', marginTop: 2 }}>· {c}</div>
        ))}
      </div>
      <div data-testid="e8-circuito" style={{ margin: '2px 6px 6px', padding: '5px 7px', background: '#102028', borderRadius: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7fd8f0' }}>
          💧 EL CIRCUITO REAL (E8b) — juez {e8.circuito.juez.ok ? '✓ VERDE' : '✗ ROJO'} · {e8.circuito.conexionesPorMitad} conexiones por mitad (§9.1.6)
        </div>
        <div style={{ fontSize: 10, color: '#a8bad0', marginTop: 2 }}>
          A: anillo perimetral en el inserto (H {e8.circuito.ladoA.hMm} = {e8.circuito.ladoA.hOverD}D) · {e8.circuito.ladoA.nBarrenos} barrenos · {e8.circuito.ladoA.nTapones} tapones · {e8.circuito.ladoA.nSellos} O-rings — trampa §9.3.1(d) declarada: con runner frío el centro genera calor (la salida (c) hot-sprue la elimina)
        </div>
        <div style={{ fontSize: 10, color: '#a8bad0', marginTop: 2 }}>
          B: serpentina (H {e8.circuito.ladoB.hMm} = {e8.circuito.ladoB.hOverD}D) + BAFFLE ⌀{e8.circuito.baffle.boreDiaMm} hasta {e8.circuito.baffle.claroApiceMm} mm del ápice · {e8.circuito.ladoB.nBarrenos} barrenos · {e8.circuito.ladoB.nTapones} tapones · {e8.circuito.ladoB.nSellos} sello
        </div>
        {e8.circuito.recortes.map((r, k) => (
          <div key={k} data-testid={`e8-recorte-${k}`} style={{ fontSize: 10, color: '#f4d27a', marginTop: 2 }}>✂ {r}</div>
        ))}
        {e8.circuito.juez.claros.map((c, k) => (
          <div key={k} style={{ fontSize: 10, color: c.ok ? '#7ee0a0' : '#f27a6c', marginTop: 1 }}>
            {c.ok ? '✓' : '✗'} {c.contra}: {c.claroMm} ≥ {c.minMm} mm
          </div>
        ))}
      </div>
      <div style={{ margin: '2px 6px 6px', padding: '5px 7px', background: '#1b2416', borderRadius: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#a8e07e' }}>
          💵 EL RETORNO A LA E2 — la E2 cotizó {e8.dinero.cicloEq323S} s (Eq 3.23, ciega a la colada) → ${e8.dinero.partUSDdeclarado}/pza
        </div>
        {e8.dinero.salidas.map((x) => (
          <div key={x.id} data-testid={`e8-salida-${x.id}`} style={{ fontSize: 10.5, color: '#c8d8a8', marginTop: 3 }}>
            <b>({x.id}) {x.titulo}</b> — ciclo {x.cicloS} s → <b>${x.partUSD.toFixed(3)}/pza</b> ({x.deltaUSD >= 0 ? '+' : ''}${x.deltaUSD.toFixed(3)})
            <div style={{ fontSize: 10, color: '#8fa1b8' }}>{x.nota}</div>
          </div>
        ))}
      </div>
      <details style={{ margin: '2px 6px 6px' }}>
        <summary style={{ fontSize: 10.5, color: '#9fd0f4', cursor: 'pointer' }}>los {e8.cd.pasos.length} PASOS del §9.2 — fórmula → sustitución → resultado</summary>
        {e8.cd.pasos.map((p, k) => (
          <div key={k} data-testid={`e8-paso-${k}`} style={{ padding: '4px 6px', marginTop: 3, background: '#0f151c', borderRadius: 6, borderLeft: `3px solid ${p.ok === false ? '#f27a6c' : '#3d5a72'}` }}>
            <div style={{ fontSize: 10.5, color: '#dfe8f4' }}><b>{p.titulo}</b> <span style={{ color: '#6f8199' }}>{p.ref}</span></div>
            <div style={{ fontSize: 10, color: '#9fd0f4', fontFamily: 'monospace' }}>{p.formula}</div>
            <div style={{ fontSize: 10, color: '#a8bad0', fontFamily: 'monospace' }}>{p.sustitucion}</div>
            <div style={{ fontSize: 10.5, color: '#a8e07e', fontFamily: 'monospace' }}>= {p.resultado}</div>
            {p.nota && <div style={{ fontSize: 10, color: '#8fa1b8' }}>{p.nota}</div>}
          </div>
        ))}
      </details>
      {e8.anuncios.length > 0 && (
        <div style={{ margin: '2px 6px 8px', padding: '5px 7px', background: '#241a10', borderRadius: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f4d27a' }}>⟲ anuncios ({e8.anuncios.length})</div>
          {e8.anuncios.map((a, k) => (
            <div key={k} data-testid={`e8-anuncio-${k}`} style={{ fontSize: 10.5, color: '#e0c98a', marginTop: 3 }}>
              <b>→ estación {a.estacion}:</b> {a.titulo}
              <div style={{ fontSize: 10, color: '#8fa1b8' }}>{a.detalle} · {a.seccion}</div>
            </div>
          ))}
        </div>
      )}
      {onE9 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e9" onClick={() => onE9()} style={{ margin: '4px 6px 6px' }}
          title="CONTRACCIÓN (cap 10): el acero SE TALLA ESCALADO — la escala 1.0 que la E3 dejó declarada se paga aquí, steel-safe">
          ▶ estación 9 — CONTRACCIÓN: tallar el acero escalado
        </button>
      )}
    </>
  );
}

/** Estación 9 — CONTRACCIÓN (cap 10). Las fuentes CONFRONTADAS (nunca
 *  auto-corregir en silencio), la banda §10.1.6 con la alarma de sobre-empaque
 *  VIVA (el techo del proceso), la decisión steel-safe con responsable, y el
 *  acero tallado con cotas MEDIDAS. */
function CicloE9({ e9, onE10 }: { e9: import('../mold/estudio-molde-datos').Estacion9Dado; onE10?: () => void }) {
  const COL: Record<string, string> = { CUMPLE: '#7ee0a0', ADVIERTE: '#f4d27a', VIOLA: '#f27a6c' };
  return (
    <>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px 2px' }}>
        estación 9 — contracción (cap 10): el acero escalado, con responsable
      </div>
      <div data-testid="e9-decision" style={{ margin: '4px 6px', padding: '5px 7px', background: '#12202b', borderRadius: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9fd0f4' }}>LAS FUENTES CONFRONTADAS (§10.1.7 — la brecha SE MUESTRA)</div>
        {e9.decision.fuentes.map((f, k) => (
          <div key={k} data-testid={`e9-fuente-${k}`} style={{ fontSize: 10, color: '#a8bad0', marginTop: 2 }}>
            · <b>{f.fuente}</b>: {f.sPct} — {f.nota}
          </div>
        ))}
        <div style={{ fontSize: 10.5, color: '#a8e07e', marginTop: 3 }}>
          ELEGIDA: {e9.decision.elegida} · s esperada {e9.decision.sEsperadaPct} % · <b>opción {e9.decision.opcion}</b>: cavidad {e9.decision.sCavPct} % / macho {e9.decision.sCorePct} %
        </div>
        <div style={{ fontSize: 10, color: '#8fa1b8' }}>{e9.decision.responsable}</div>
      </div>
      <div style={{ margin: '2px 6px' }}>
        {e9.filas.map((f) => (
          <div key={f.id} data-testid={`e9-fila-${f.id}`} style={{ padding: '4px 6px', marginBottom: 3, background: '#141a22', borderRadius: 6, borderLeft: `3px solid ${COL[f.estado]}` }}>
            <div style={{ fontSize: 10.5, color: '#dfe8f4' }}>
              <b>{f.titulo}</b> · <span style={{ color: COL[f.estado], fontWeight: 700 }}>{f.estado}</span>
            </div>
            <div style={{ fontSize: 10.5, color: '#a8bad0' }}>{f.valor} <span style={{ color: '#6f8199' }}>(límite: {f.limite})</span></div>
            <div style={{ fontSize: 10, color: '#8fa1b8' }}>{f.porque} · {f.seccion}</div>
          </div>
        ))}
      </div>
      {e9.anuncios.length > 0 && (
        <div style={{ margin: '2px 6px 8px', padding: '5px 7px', background: '#241a10', borderRadius: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f4d27a' }}>⟲ anuncios ({e9.anuncios.length})</div>
          {e9.anuncios.map((a, k) => (
            <div key={k} data-testid={`e9-anuncio-${k}`} style={{ fontSize: 10.5, color: '#e0c98a', marginTop: 3 }}>
              <b>→ estación {a.estacion}:</b> {a.titulo}
              <div style={{ fontSize: 10, color: '#8fa1b8' }}>{a.detalle} · {a.seccion}</div>
            </div>
          ))}
        </div>
      )}
      {onE10 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e10" onClick={() => onE10()} style={{ margin: '4px 6px 6px' }}
          title="EXPULSIÓN (cap 11): los pines — con juzgarPines esperando desde la E1, las knit de la E7 y el s de la E9">
          ▶ estación 10 — EXPULSIÓN: los pines (los ciclos)
        </button>
      )}
    </>
  );
}

/** Estación 10 — EXPULSIÓN (cap 11). Los CICLOS ejercidos: R34→R46 (pared),
 *  R52 (pandeo→escalonado), A-239 al revés (los pines ceden el carril del
 *  baffle). Con juzgarPines convocado y el juez contra el agua REAL. */
function CicloE10({ e10, onE11 }: { e10: import('../mold/estudio-molde-datos').Estacion10Dado; onE11?: () => void }) {
  const COL: Record<string, string> = { CUMPLE: '#7ee0a0', ADVIERTE: '#f4d27a', VIOLA: '#f27a6c' };
  return (
    <>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px 2px' }}>
        estación 10 — expulsión (cap 11): los ciclos de decisión, no el pipeline
      </div>
      <div data-testid="e10-ciclo" style={{ margin: '4px 6px', padding: '5px 7px', background: '#12202b', borderRadius: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9fd0f4' }}>EL CICLO DE DECISIÓN (cada conflicto, real)</div>
        {e10.cicloDecision.map((c, k) => (
          <div key={k} data-testid={`e10-paso-${k}`} style={{ fontSize: 10, color: c.startsWith('⚠') ? '#f4d27a' : '#a8bad0', marginTop: 2 }}>· {c}</div>
        ))}
      </div>
      <div style={{ margin: '2px 6px' }}>
        {e10.filas.map((f) => (
          <div key={f.id} data-testid={`e10-fila-${f.id}`} style={{ padding: '4px 6px', marginBottom: 3, background: '#141a22', borderRadius: 6, borderLeft: `3px solid ${COL[f.estado]}` }}>
            <div style={{ fontSize: 10.5, color: '#dfe8f4' }}>
              <b>{f.titulo}</b> · <span style={{ color: COL[f.estado], fontWeight: 700 }}>{f.estado}</span>
            </div>
            <div style={{ fontSize: 10.5, color: '#a8bad0' }}>{f.valor} <span style={{ color: '#6f8199' }}>(límite: {f.limite})</span></div>
            <div style={{ fontSize: 10, color: '#8fa1b8' }}>{f.porque} · {f.seccion}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: '2px 6px 6px', padding: '5px 7px', background: '#102028', borderRadius: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7fd8f0' }}>el JUEZ pines↔todo — {e10.juez.ok ? '✓ VERDE' : '✗ LA E8 SE REABRE'}</div>
        {e10.juez.claros.slice(0, 8).map((c, k) => (
          <div key={k} style={{ fontSize: 10, color: c.ok ? '#7ee0a0' : '#f27a6c', marginTop: 1 }}>{c.ok ? '✓' : '✗'} {c.contra}: {c.claroMm} ≥ {c.minMm} mm</div>
        ))}
        <div style={{ fontSize: 10, color: '#6f8199', marginTop: 2 }}>({e10.juez.claros.length} claros medidos · juzgarPines: {e10.juicioPines.peor})</div>
      </div>
      {e10.anuncios.length > 0 && (
        <div style={{ margin: '2px 6px 8px', padding: '5px 7px', background: '#241a10', borderRadius: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f4d27a' }}>⟲ anuncios ({e10.anuncios.length})</div>
          {e10.anuncios.map((a, k) => (
            <div key={k} data-testid={`e10-anuncio-${k}`} style={{ fontSize: 10.5, color: '#e0c98a', marginTop: 3 }}>
              <b>→ estación {a.estacion}:</b> {a.titulo}
              <div style={{ fontSize: 10, color: '#8fa1b8' }}>{a.detalle} · {a.seccion}</div>
            </div>
          ))}
        </div>
      )}
      {onE11 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e11" onClick={() => onE11()} style={{ margin: '4px 6px 6px' }}
          title="ESTRUCTURA (cap 12): todo lo perforado rinde cuentas — K de los barrenos, hoop del macho, deflexión vs venteo, R90">
          ▶ estación 11 — ESTRUCTURA: ¿el acero aguanta?
        </button>
      )}
    </>
  );
}

/** Estación 11 — ESTRUCTURA (cap 12). Los K de NUESTROS barrenos, la alarma
 *  maestra de deflexión-vs-venteo, el hoop del macho y el checklist R90. */
function CicloE11({ e11, onE12 }: { e11: import('../mold/estudio-molde-datos').Estacion11Dado; onE12?: () => void }) {
  const COL: Record<string, string> = { CUMPLE: '#7ee0a0', ADVIERTE: '#f4d27a', VIOLA: '#f27a6c' };
  return (
    <>
      <div style={{ fontSize: 10.5, color: '#8fa1b8', padding: '5px 6px 2px' }}>
        estación 11 — estructura (cap 12): el acero que quedó, rindiendo cuentas
      </div>
      <div data-testid="e11-r90" style={{ margin: '4px 6px', padding: '5px 7px', background: e11.r90.yieldOk && e11.r90.fatigaOk && e11.r90.flashOk ? '#12281c' : '#3a1414', border: `1px solid ${e11.r90.yieldOk && e11.r90.fatigaOk && e11.r90.flashOk ? '#7ee0a0' : '#f27a6c'}`, borderRadius: 6, fontSize: 10.5, fontWeight: 700, color: e11.r90.yieldOk && e11.r90.fatigaOk && e11.r90.flashOk ? '#7ee0a0' : '#f27a6c' }}>
        R90 · (1) sobrepresión {e11.r90.yieldOk ? '✓' : '✗'} · (2) fatiga {e11.r90.fatigaOk ? '✓' : '✗'} · (3) flash {e11.r90.flashOk ? '✓' : '✗'} — tres veredictos INDEPENDIENTES
      </div>
      <div style={{ margin: '2px 6px' }}>
        {e11.filas.map((f) => (
          <div key={f.id} data-testid={`e11-fila-${f.id}`} style={{ padding: '4px 6px', marginBottom: 3, background: '#141a22', borderRadius: 6, borderLeft: `3px solid ${COL[f.estado]}` }}>
            <div style={{ fontSize: 10.5, color: '#dfe8f4' }}>
              <b>{f.titulo}</b> · <span style={{ color: COL[f.estado], fontWeight: 700 }}>{f.estado}</span>
            </div>
            <div style={{ fontSize: 10.5, color: '#a8bad0' }}>{f.valor} <span style={{ color: '#6f8199' }}>(límite: {f.limite})</span></div>
            <div style={{ fontSize: 10, color: '#8fa1b8' }}>{f.porque} · {f.seccion}</div>
          </div>
        ))}
      </div>
      {e11.anuncios.length > 0 && (
        <div style={{ margin: '2px 6px 8px', padding: '5px 7px', background: '#241a10', borderRadius: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f4d27a' }}>⟲ anuncios ({e11.anuncios.length})</div>
          {e11.anuncios.map((a, k) => (
            <div key={k} data-testid={`e11-anuncio-${k}`} style={{ fontSize: 10.5, color: '#e0c98a', marginTop: 3 }}>
              <b>→ estación {a.estacion}:</b> {a.titulo}
              <div style={{ fontSize: 10, color: '#8fa1b8' }}>{a.detalle} · {a.seccion}</div>
            </div>
          ))}
        </div>
      )}
      {onE12 && (
        <button className="fb-fea-run" data-testid="btn-ciclo-e12" onClick={() => onE12()} style={{ margin: '4px 6px 6px' }}
          title="EL ACTA (§13.10): las decisiones aprobadas y documentadas — el cubo se firma">
          ✍ estación 12 — EL ACTA: firmar el molde
        </button>
      )}
    </>
  );
}

/** Estación 12 — EL ACTA (§13.10). R92: decisiones con costo/beneficio/riesgo
 *  y responsable · retornos cerrados · tryout steel-safe (R119) · erratas. */
function CicloE12({ acta }: { acta: import('../mold/estudio-molde-datos').ActaDado }) {
  const ok = acta.veredicto === 'FIRMADO';
  return (
    <>
      <div data-testid="e12-veredicto" style={{ margin: '4px 6px', padding: '7px 9px', background: ok ? '#12281c' : '#3a1414', border: `2px solid ${ok ? '#7ee0a0' : '#f27a6c'}`, borderRadius: 6, fontSize: 12, fontWeight: 800, color: ok ? '#7ee0a0' : '#f27a6c', textAlign: 'center' }}>
        {ok ? `✍ EL ACTA — FIRMADO · el molde del dado está CERRADO` : `ACTA INCOMPLETA — faltan: ${acta.faltantes.join(', ')}`}
      </div>
      {ok && (<>
        <div style={{ fontSize: 10, color: '#8fa1b8', padding: '0 8px 4px', textAlign: 'center' }}>
          {acta.conteo.estaciones} estaciones · {acta.conteo.checksGate} checks del gate · {acta.retornosCerrados.length} retornos cerrados · {acta.erratas.length} erratas cazadas
        </div>
        {acta.decisiones.map((dd, k) => (
          <div key={k} data-testid={`e12-decision-${dd.id}`} style={{ margin: '3px 6px', padding: '5px 7px', background: '#141a22', borderRadius: 6, borderLeft: '3px solid #9fd0f4' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#dfe8f4' }}>{dd.titulo}</div>
            <div style={{ fontSize: 10.5, color: '#a8e07e' }}>{dd.decision}</div>
            <div style={{ fontSize: 10, color: '#a8bad0' }}>costo: {dd.costo}</div>
            <div style={{ fontSize: 10, color: '#a8bad0' }}>beneficio: {dd.beneficio}</div>
            <div style={{ fontSize: 10, color: '#f4d27a' }}>riesgo: {dd.riesgo}</div>
            <div style={{ fontSize: 10, color: '#6f8199' }}>firma: {dd.responsable} · {dd.seccion}</div>
          </div>
        ))}
        <div style={{ margin: '3px 6px', padding: '5px 7px', background: '#12202b', borderRadius: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9fd0f4' }}>⟲ LOS RETORNOS CERRADOS (ciclos, no pipeline)</div>
          {acta.retornosCerrados.map((r, k) => (
            <div key={k} style={{ fontSize: 10, color: '#a8bad0', marginTop: 2 }}>· {r.de}→{r.a}: {r.historia}</div>
          ))}
        </div>
        <div style={{ margin: '3px 6px', padding: '5px 7px', background: '#1b2416', borderRadius: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#a8e07e' }}>PLAN DE TRYOUT steel-safe (R119: "especifica corto, prueba, crece")</div>
          {acta.tryout.map((t, k) => (<div key={k} style={{ fontSize: 10, color: '#c8d8a8', marginTop: 2 }}>{k + 1}. {t}</div>))}
        </div>
        <div style={{ margin: '3px 6px', padding: '5px 7px', background: '#241a10', borderRadius: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f4d27a' }}>ERRATAS DEL LIBRO cazadas (quien herede el molde debe saberlas)</div>
          {acta.erratas.map((e, k) => (<div key={k} style={{ fontSize: 10, color: '#e0c98a', marginTop: 2 }}>· {e}</div>))}
        </div>
        <div style={{ margin: '3px 6px 8px', padding: '5px 7px', background: '#1a1522', borderRadius: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#c8a8e0' }}>PENDIENTES DECLARADOS (un hueco declarado vale más que un número inventado)</div>
          {acta.pendientes.map((pp, k) => (<div key={k} style={{ fontSize: 10, color: '#b8a8d0', marginTop: 2 }}>· {pp}</div>))}
        </div>
      </>)}
    </>
  );
}