/**
 * useMoldStudio — TODO el estado y la lógica del MOLDE del Part Studio en un
 * solo hook (paso 2.3, el corte grande de la extracción del monolito):
 * partes/visibilidad/colores del árbol, el EFECTO DE ARMADO (buildMoldParts,
 * con banner y telemetría), alarma de colisiones, análisis por componente,
 * llenado §5.5.5, tornillería, térmica FDM, FEA, t_c, el CURSO ALWIS completo
 * y loadFlaneraMold (el molde paramétrico con sólidos del splitMold).
 * Compone useMoldLive (la sesión viva) y re-exporta su bolsa.
 * Interfaz angosta: { oc, setCollapsed, setDocName } — nada más del Studio.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import * as THREE from 'three';
import * as OCC from './occt';
import { tessellate, makeCompound } from './occt';
import { buildMoldParts, packageToAssemblySpec, plateStackZ, type MoldPart } from '../mold/mold-plano-set';
import { insertarPercha, escalaContraccion, layoutDosCavidades, lineaParticion, toolingSplitCurso, toolingSplitCursoCarve, guiasCurso } from '../mold/curso-flow';
import { flanera } from '../mold/flanera';
import { splitMold, shapeBBox, scaleForShrinkage } from '../mold/mold';
import { fastenerPlan } from '../mold/mold-fasteners';
import { moldRecipe } from '../mold/mold-recipe';
import { componentDims, verifyDims } from '../mold/mold-dimensions';
import { computeMoldAlarm } from './MoldScene';
import { useMoldLive } from './useMoldLive';
import { moldAnalysis, componentAnalysis } from '../mold/mold-analysis';
import { createThermalSim, type ThermalSim } from '../mold/mold-thermal-fdm';
import { tcLocalMap, waterAdvice } from '../mold/mold-tc-map';
import { insertDims } from '../mold/mold-drawing-set';
import { moldOpeningStrokeMm } from '../mold/threeplate';
import { surfaceFlowLength } from '../mold/flowlen-surface';
import { ABS_MG47, convergeVelocity, shearRatePowerLaw, viscosityPowerLaw, pressureDropSegment } from '../mold/filling';
import { runMoldFea, type MoldFeaOverlay } from '../mold/mold-fea';
import { moldMachine, type MoldPackage } from '../mold/moldmachine';
import { estacion1Dado, estacion2Dado, estacion3Dado, dadoRectoShape, construirAceroE3, verificacionE3, cotasCicloE3, type Estacion1Dado, type Estacion2Dado, type Estacion3Dado, type VerificacionE3 } from '../mold/estudio-molde-datos';
import { layoutBranched, layoutRadial, layoutSeries, layoutHybrid, applyResistanceNetwork, type FeedNetwork } from '../mold/feed-layouts';
import { mark } from '../telemetry-forja';

/** EL DADO como sólido: caja − caja, abierto abajo (pared 2, techo 2).
 *  UNA fuente para todas las estaciones — la spec numérica es DADO_SPEC. */
function dadoShape(oc: any) {
  const outer = OCC.makeBox(oc, 40, 40, 40);
  const inner = OCC.transformShape(oc, OCC.makeBox(oc, 36, 36, 39), { translate: [2, 2, -0.5] });
  return OCC.cut(oc, outer, inner);
}

export function useMoldStudio({ oc, setCollapsed, setDocName }: {
  oc: any;
  setCollapsed: Dispatch<SetStateAction<Record<string, boolean>>>;
  setDocName: (name: string) => void;
}) {
  const { liveMoldSpec, setLiveMoldSpec, liveMoldMesh, setLiveMoldMesh, liveDfm,
    liveRealSolidsRef, liveRealSolidsRev, setLiveRealSolidsRev } = useMoldLive();
  // árbol: aislar / ocultar / opacidad, como Fusion/SolidWorks. Con primitivas.
  const [moldParts, setMoldParts] = useState<MoldPart[]>([]);
  // EL PAQUETE de la Máquina de Moldes del molde en pantalla. loadFlaneraMold YA
  // calculaba moldMachine(spec) y lo TIRABA tras sacar las placas — el mismo bug
  // de contabilidad (dato bien calculado que no llega al juez), versión React.
  // Con él guardado, MoldPanels puede mostrar semáforos §4.3.3, cotización e
  // invariantes SIN recalcular nada a espaldas del flujo que armó el molde.
  const [moldPkg, setMoldPkg] = useState<MoldPackage | null>(null);
  // EL CICLO DEL DADO (orden 2026-08-10-ciclo-dado-estacion1): el molde del cubo se
  // construye estación por estación EN ORDEN DE LIBRO. `estacion` = dónde vamos;
  // `e1` = el juicio de la estación 1 (macizo REPROBADO vs dado APROBADO, Eq 9.5).
  const [ciclo, setCiclo] = useState<{ estacion: number; e1: Estacion1Dado; e2?: Estacion2Dado; e3?: Estacion3Dado; e3v?: VerificacionE3; e3cotas?: CotaSet[] } | null>(null);
  // DEMO de redes de colada (Figs 6.14/6.15): partes sin spec — el efecto de
  // armado NO debe barrerlas cuando liveMoldSpec es null.
  const [feedDemo, setFeedDemo] = useState(false);
  // Aviso "ARMANDO MOLDE…": el build es SÍNCRONO y congela el tab (segundos en
  // moldes redondos, MINUTOS en cajas con 63 pines) — sin este banner el usuario
  // solo ve una página muerta y le da Ctrl+Shift+R (freeze del 2026-07-24).
  const [moldBuilding, setMoldBuilding] = useState(false);
  const [moldHidden, setMoldHidden] = useState<Record<string, boolean>>({});
  const [moldOpacity, setMoldOpacity] = useState<Record<string, number>>({});
  const [moldSelected, setMoldSelected] = useState<string | null>(null);   // componente resaltado desde el árbol
  const [moldHover, setMoldHover] = useState<string | null>(null);         // placa bajo el cursor en 3D (feedback de pick)
  const [moldMoveMode, setMoldMoveMode] = useState(false);                  // gizmo de mover activo
  const [moldOffset, setMoldOffset] = useState<Record<string, [number, number, number]>>({});  // desplazamiento por componente
  // APERTURA ANIMADA (▶): refs imperativos — cero re-render por frame
  const moldAnimRefs = useRef<Record<string, THREE.Group | null>>({});
  const moldOpenRef = useRef<{ on: boolean; manual: number | null; manualE: number | null; t0: number }>({ on: false, manual: null, manualE: null, t0: 0 });
  const [moldOpenOn, setMoldOpenOn] = useState(false);
  const moldMoveRef = useRef<THREE.Group>(null);                            // grupo que arrastra el gizmo
  const [moldColors, setMoldColors] = useState<Record<string, string>>({});  // color por componente (override del usuario)
  // NUBE DE ALARMA: puntos ROJOS exactamente donde dos sólidos comparten acero — se ve
  // desde CUALQUIER ángulo (lo que el número no me deja ver a ojo). La enciende moldAlarm().
  const [alarmCloud, setAlarmCloud] = useState<Float32Array | null>(null);
  const [moldExpanded, setMoldExpanded] = useState<Record<string, boolean>>({});  // componente desplegado (cuerpos + historia)
  // ANÁLISIS POR COMPONENTE (cada placa sus números con su ecuación) — perezoso.
  const moldCompAnalysis = useMemo(() => {
    if (!liveMoldSpec) return null;
    try { return componentAnalysis(liveMoldSpec); } catch (e) { console.warn('COMP_ANALYSIS_ERR', e); return null; }
  }, [liveMoldSpec]);
  // OJO AL ORDEN: esta línea DEBE ir antes del `useMemo` de abajo. El array de
  // dependencias `[flowOn, ...]` se evalúa EN EL ACTO, así que una `const` declarada
  // más abajo revienta con TDZ: "Cannot access 'kn' before initialization" — y tumba
  // el CAD entero en producción. TypeScript NO lo ve (el hook es una llamada válida)
  // y `vite dev` tampoco: solo truena en el bundle.
  const [flowOn, setFlowOn] = useState(false);                   // 💧 el llenado sobre la pieza (§5.5.5)
  // 💧 EL ESTUDIO DEL LLENADO — los números del cap 5 sobre la L REAL de la pieza.
  // "mientras más datos haya más errores puedes cachar" (user): cada fila trae su
  // ecuación, y las que salen del rango del libro se pintan en ROJO. Un panel que solo
  // dice "todo bien" no sirve para cazar nada.
  const liveFlow = useMemo(() => {
    if (!flowOn || !liveMoldSpec) return null;
    const pieza = moldParts.find((p) => p.role === 'pieza');
    if (!pieza) return null;
    try {
      const P = pieza.positions;
      let cx = 0, cy = 0, zLo = Infinity;
      for (let i = 0; i < P.length; i += 3) { cx += P[i]; cy += P[i + 1]; if (P[i + 2] < zLo) zLo = P[i + 2]; }
      cx /= P.length / 3; cy /= P.length / 3;
      const wallMm = liveMoldSpec.cavity.wallMm ?? 2;
      const sf = surfaceFlowLength({ positions: pieza.positions, indices: pieza.indices, normals: pieza.normals }, { x: cx, y: cy, z: zLo }, wallMm);
      const melt = ABS_MG47, wallM = wallMm / 1000;
      const v = convergeVelocity(melt, wallM);                      // Eq 5.23, iterada
      const gam = shearRatePowerLaw(v, wallM, melt.n);              // Eq 5.21
      const mu = viscosityPowerLaw(melt, gam);                      // μ = k·γ̇^(n−1)
      const L = sf.maxFlowLenMm / 1000;
      const dP = pressureDropSegment(melt, L, wallM, v) / 1e6;      // Eq 5.19
      const tFill = L / v;
      const ratio = sf.maxFlowLenMm / wallMm;                       // L/T: el número que manda
      const rows: Array<{ k: string; v: string; ref: string; warn?: boolean }> = [
        // ⚠ ESTA FILA DICE LA VERDAD SOBRE ESTE PANEL. La malla del kernel es gruesa
        // (aristas ~33 mm) y Dijkstra zigzaguea ⇒ esta L sobreestima ~85 % contra el
        // vóxel (137.95 mm en el vaso, que ≈ radio + alto). El ORDEN de llegada —lo que
        // pinta el color— es correcto; los MILÍMETROS no. Un panel que se calla su error
        // conocido miente con cara de dato: por eso sale en rojo y con el número real.
        { k: 'longitud de flujo L', v: `${sf.maxFlowLenMm} mm`, ref: '§5.5.5 · MEDIDA del hueco A/B, no de una fórmula por figura' },
        { k: '⚠ L en verificación', v: 'sobreestima ~85%', ref: 'malla gruesa (arista ~33 mm) ⇒ Dijkstra zigzaguea. El vóxel da 137.95 en el vaso. El COLOR (orden de llegada) sí vale; los mm no', warn: true },
        { k: 'razón L/T', v: `${ratio.toFixed(0)} : 1`, ref: 'regla de industria (NO del libro): el criterio de Kazmer es ΔP §5.1, no L/T', warn: ratio > 200 },
        { k: 'v̄ de diseño', v: `${v.toFixed(2)} m/s`, ref: 'Eq 5.23 (balance corte↔pérdida de calor, iterada)' },
        { k: 'γ̇ en la pared', v: `${gam.toFixed(0)} 1/s`, ref: 'Eq 5.21 · >50k degrada el polímero', warn: gam > 50000 },
        { k: 'μ al γ̇ actual', v: `${mu.toFixed(0)} Pa·s`, ref: 'μ = k·γ̇^(n−1) · pseudoplástico' },
        // §5.1: el techo de DISEÑO es 100 MPa aunque la máquina dé ~200 — el margen
        // de 2× es a propósito (feed system + varianzas). El 140 anterior no salía
        // del libro. Y §5.1 tiene DOS colas: una ΔP muy baja también reprueba
        // ("indicative of a poor molded part design": pared gruesa = material y
        // ciclo desperdiciados → adelgazar y poner costillas §2.3.2). El libro no
        // da umbral inferior numérico, así que se advierte sin inventar uno.
        { k: 'ΔP de llenado', v: `${dP.toFixed(1)} MPa`,
          ref: dP < 20
            ? '§5.1 ¡MUY BAJA! pared engordada → adelgazar + costillas §2.3.2 (umbral 20 declarado NUESTRO, el libro no lo fija)'
            : 'Eq 5.19 · techo de DISEÑO 100 MPa §5.1 (la máquina da ~200: el margen 2× es a propósito)',
          warn: dP > 100 || dP < 20 },
        { k: 't de llenado', v: `${tFill.toFixed(3)} s`, ref: 'L/v̄ · ~1.4 % del ciclo: por eso NO se ve a tiempo real' },
        { k: 'sin llenar', v: `${sf.unreachable} vértices`, ref: 'short shot §5.5 — sin camino al gate', warn: sf.unreachable > 0 },
      ];
      return { maxFlowLenMm: sf.maxFlowLenMm, rows };
    } catch (e) { console.warn('FLOW_ERR', e); return null; }
  }, [flowOn, liveMoldSpec, moldParts]);
  // CARRERA DE APERTURA (§6.3.2 = 2.5 × altura de pieza) — la MISMA función que usa el
  // selector de máquina para juzgar el daylight. Sin spec no hay pieza que medir: 0
  // (el molde se queda cerrado) en vez de inventar un número.
  const moldOpenStrokeMm = useMemo(
    () => (liveMoldSpec ? moldOpeningStrokeMm(liveMoldSpec.cavity.depthMm) : 0),
    [liveMoldSpec],
  );
  // ESTUDIO DE TORNILLERÍA EN VIVO (Shigley cap.8 + FED-STD-H28): la ELECCIÓN del
  // tornillo por CARGA para cada mitad. fastenerPlan es PURA y toma el spec → se llama
  // aquí directo (nada que plomear por mold-live.json).
  const liveFastener = useMemo(() => {
    if (!liveMoldSpec) return null;
    try {
      return {
        cavity: fastenerPlan(liveMoldSpec, { half: 'cavity' }),
        core: fastenerPlan(liveMoldSpec, { half: 'core' }),
      };
    } catch (e) { console.warn('FASTENER_PLAN_ERR', e); return null; }
  }, [liveMoldSpec]);
  const [fastHalf, setFastHalf] = useState<'cavity' | 'core'>('cavity');
  // ── COTAS 3D: la receta CONTRA el sólido construido ────────────────────────
  // "como no hay suficiente información en pantalla no extraes todos los errores"
  // (user). Los dims salen de la RECETA (params del timeline, que ya sabe sus cotas)
  // y se CONTRASTAN con el bbox REAL del componente que se armó. Si no cuadran, la
  // cota sale roja: el error se ve, no se deduce.
  const [cotasOn, setCotasOn] = useState(false);
  const cotaRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cotaAperturaRef = useRef<HTMLDivElement | null>(null);   // 📐 la carrera, cotada en vivo
  const liveCotas: CotaSet[] = useMemo(() => {
    // EL CICLO DEL DADO trae sus propias cotas (dims VISUALES en 3D — orden de ian):
    // misma tubería 📐 (CotaLines+CotaLabels), doble cifra, rojo si no cuadra.
    if (cotasOn && ciclo?.e3cotas?.length) return ciclo.e3cotas;
    if (!cotasOn || !liveMoldSpec || !moldParts.length) return [];
    try {
      return moldRecipe(liveMoldSpec).map((c) => {
        const pt = moldParts.find((p) => p.role === c.role);
        let measure;
        if (pt?.positions?.length) {
          const P = pt.positions, mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
          for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
          measure = { bbox: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] as [number, number, number], min: mn as [number, number, number] };
        }
        return { role: c.role, dims: verifyDims(componentDims(c), measure).dims };
      });
    } catch (e) { console.warn('COTAS_ERR', e); return []; }
  }, [cotasOn, liveMoldSpec, moldParts, ciclo]);
  const cotaErrors = liveCotas.reduce((n, s) => n + s.dims.filter((d) => d.ok === false).length, 0);
  // SIMULACIÓN del molde (térmico §9 + estructural §12, Kazmer) — al activar se calcula
  // el análisis completo sobre el spec vivo y se pinta el CAMPO de temperatura (Fig 9.7).
  const [moldSimOn, setMoldSimOn] = useState(false);
  const moldSim: MoldAnalysis | null = useMemo(() => {
    if (!moldSimOn || !liveMoldSpec) return null;
    try { return moldAnalysis(liveMoldSpec); } catch (e) { console.warn('MOLD_SIM_ERR', e); return null; }
  }, [moldSimOn, liveMoldSpec]);
  const moldPartingZ = useMemo(() => {
    if (!liveMoldSpec) return 0;
    try { const z = plateStackZ(liveMoldSpec); return z.A; } catch { return 0; }
  }, [liveMoldSpec]);
  // 🩻 RAYOS X: todo el molde translúcido — se ve el interior SIN sección.
  const [moldXray, setMoldXray] = useState(false);
  // 🌡 TRANSITORIO: la PDE de calor (FDM 3D) viva — se crea al activar la sim.
  const moldThermalSim: ThermalSim | null = useMemo(() => {
    if (!moldSimOn || !liveMoldSpec) return null;
    // el calor entra con la FORMA 3D de la pieza real (espesor local por columna)
    try {
      // celda VIVA más gruesa (≈N/3): el paso espectral baja de ~75 ms a ~15 — "se traba,
      // va lento" (user). El análisis fino se queda para scripts/video; la UI necesita fps.
      // LA GEOMETRÍA REAL manda: si no hay malla de sesión viva, se usa la de la
      // PIEZA ya construida (moldParts). Sin ella el modelo es una placa plana
      // simétrica ⇒ cavidad y núcleo salen IDÉNTICOS y el estudio no dice nada
      // (el núcleo debe estar más caliente: lo rodea el plástico, §9.3.6).
      const piezaPart = moldParts.find((p) => p.role === 'pieza');
      const mesh = liveMoldMesh ?? (piezaPart ? { positions: piezaPart.positions, indices: piezaPart.indices } : undefined);
      const sim = createThermalSim(liveMoldSpec, { partMesh: mesh, cell: Math.max(8, Math.round(liveMoldSpec.widthMm / 36)) });
      // RÉGIMEN, no arranque frío (Kazmer §9.1: el molde de producción cicla).
      // Arrancando en frío el contraste era 2.5 °C y "no se veía nada"; a régimen
      // son ~6 °C con el gradiente REAL alrededor de cada cavidad.
      sim.warmUp(8);
      // EL CAMPO CON FORMA (cycle-averaged, k variable): a partir de aquí la
      // escena pinta ESTE campo — el plástico es un aislante con la geometría
      // del vaso y el calor tiene que rodearlo (§9.2 + práctica BEM/Moldflow).
      sim.computeSteady();
      return sim;
    } catch (e) { console.warn('MOLD_FDM_ERR', e); return null; }
  }, [moldSimOn, liveMoldSpec, liveMoldMesh, moldParts]);
  // rebanada térmica 3D: eje + posición (el molde NO es 2D)
  const [moldSliceAxis, setMoldSliceAxis] = useState<'x' | 'y' | 'z'>('z');
  const [moldSliceFrac, setMoldSliceFrac] = useState(0.5);
  // ⏱ t_c LOCAL sobre la pieza (Eq 9.5 por pared medida) + consejo de agua
  const [moldTcOn, setMoldTcOn] = useState(false);
  const moldTc = useMemo(() => {
    if (!moldTcOn || !liveMoldSpec || !liveMoldMesh) return null;
    try {
      const map = tcLocalMap(liveMoldMesh);
      if (!map) return null;
      return { map, advice: waterAdvice(liveMoldSpec, map) };
    } catch (e) { console.warn('TC_MAP_ERR', e); return null; }
  }, [moldTcOn, liveMoldSpec, liveMoldMesh]);
  // 🏗 FEA mecánico real (malla tet + CG) — bajo demanda (tarda ~5-20 s en wasm).
  const [moldFea, setMoldFea] = useState<MoldFeaOverlay | null>(null);
  const [moldFeaBusy, setMoldFeaBusy] = useState(false);
  const runMoldFeaNow = useCallback(() => {
    if (!oc || !liveMoldSpec || moldFeaBusy) return;
    setMoldFeaBusy(true);
    setTimeout(() => {
      try { setMoldFea(runMoldFea(OCC, oc, liveMoldSpec, { pMeltMPa: 80, resolution: 22 })); }
      catch (e) { console.warn('MOLD_FEA_ERR', e); setMoldFea(null); }
      setMoldFeaBusy(false);
    }, 60);
  }, [oc, liveMoldSpec, moldFeaBusy]);
  useEffect(() => { setMoldFea(null); setMoldXray(false); }, [liveMoldSpec]);
  useEffect(() => {
    if (!oc || !liveMoldSpec) { if (!feedDemo) setMoldParts([]); setMoldBuilding(false); return; }
    let cancelled = false;
    setMoldBuilding(true);         // el banner pinta ANTES de que el build congele el tab
    const t = setTimeout(() => {   // deja pintar antes del build síncrono (segundos…minutos)
      const t0 = performance.now();
      try {
        const parts = buildMoldParts(OCC, oc, liveMoldSpec, 'blocks', liveMoldMesh ?? undefined, liveRealSolidsRef.current ?? undefined);
        // TELEMETRÍA del tiempo REAL del armado — la op más pesada del estudio.
        // El freeze de hoy fue exactamente esto sin medir ni avisar.
        mark('mold-build', performance.now() - t0, { name: liveMoldSpec.name ?? '?', parts: parts.length });
        if (!cancelled) {
          // platinas de la máquina ocultas por defecto (contexto): el molde se ve limpio.
          setMoldParts(parts); setMoldHidden({ 'platina-fija': true, 'platina-movil': true }); setMoldOpacity({}); setMoldSelected(null); setMoldOffset({}); setMoldMoveMode(false); setMoldColors({});
          // al cargar el molde: ABRE el árbol de componentes (Documento) y CIERRA el
          // ruido (Caras=0, Simulación, Parámetros de croquis, Análisis de pieza) — así
          // la pantalla no se amontona: sólo se ve lo que importa del molde.
          setCollapsed((c) => ({ ...c, features: false, faces: true, sim: true, params: true, analysis: true }));
          if (liveMoldSpec.name) setDocName(liveMoldSpec.name);   // el encabezado refleja el molde, no "Pieza 1"
        }
      }
      catch (e) {
        console.error('MOLD_BUILD_ERR:', e);
        mark('mold-build', performance.now() - t0, { name: liveMoldSpec.name ?? '?', ok: false, err: String((e as Error)?.message ?? e).slice(0, 200) });
        if (!cancelled) setMoldParts([]);
      }
      finally { if (!cancelled) setMoldBuilding(false); }
    }, 60);
    return () => { cancelled = true; clearTimeout(t); };
  }, [oc, liveMoldSpec, liveMoldMesh, liveRealSolidsRev, feedDemo]);
  const toggleMoldPlate = useCallback((role: string) => setMoldHidden((h) => ({ ...h, [role]: !h[role] })), []);
  const showAllMold = useCallback(() => setMoldHidden({}), []);
  // 🚨 Botón ALARMA: enciende/apaga la nube roja de colisiones + deja las placas fantasma.
  // Así el usuario (que SÍ puede girar la figura) ve el acero compartido desde cualquier lado.
  const toggleMoldAlarm = useCallback(() => {
    if (alarmCloud) { setAlarmCloud(null); setMoldOpacity({}); setMoldColors({}); return; }
    const { cloud } = computeMoldAlarm(moldParts);
    setAlarmCloud(cloud.length ? cloud : null);
    const opac: Record<string, number> = {}; moldParts.forEach((pt) => { opac[pt.role] = 0.1; });
    setMoldOpacity(opac); setMoldHidden({}); setMoldColors({});
  }, [alarmCloud, moldParts]);

  // ── MOLD TOOLS · CURSO ALWIS (PROCESO-1): el pipeline del curso, botón por botón.
  //    Cada botón = una feature del tutorial (Insert Part → Scale → Move/Copy →
  //    Parting Lines → Tooling Split → Hole Wizard), llamando al kernel (curso-flow.ts).
  //    Los botones se DESHABILITAN hasta su etapa (como Tooling Split gris en SW).
  const [cursoStage, setCursoStage] = useState(0);
  const [cursoBusy, setCursoBusy] = useState(false);
  const [cursoReport, setCursoReport] = useState<string[]>([]);
  const [cursoCollapsed, setCursoCollapsed] = useState(false);   // plegar el panel para no tapar el sólido
  const cursoRef = useRef<{
    pieza?: OCC.Shape; piezaE?: OCC.Shape; cuerpos?: [OCC.Shape, OCC.Shape]; cav?: OCC.Shape; core?: OCC.Shape;
    carved?: boolean; vols: Record<string, number>; stage: number; report: string[];
  }>({ vols: {}, stage: 0, report: [] });
  const cursoPart = useCallback((shape: OCC.Shape, role: string, name: string, color: string, opacity = 1, deflection = 0.8): MoldPart => {
    const m = OCC.tessellate(oc!, shape, deflection, deflection);
    const positions = m.positions instanceof Float32Array ? m.positions : new Float32Array(m.positions);
    const indices = m.indices instanceof Uint32Array ? m.indices : new Uint32Array(m.indices);
    const normals = new Float32Array(positions.length);
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const q of [a, b, c]) { normals[q] += nx; normals[q + 1] += ny; normals[q + 2] += nz; }
    }
    for (let i = 0; i < normals.length; i += 3) { const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1; normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l; }
    return { role, name, material: role.startsWith('pieza') ? 'PP' : 'AISI P20', positions, normals, indices, color, opacity };
  }, [oc]);
  // la línea de partición como LISTÓN dorado (quad por segmento, 0.25 mm sobre el lazo)
  const cursoLoopPart = useCallback((loops: Array<{ pts: Array<[number, number, number]> }>): MoldPart => {
    const pos: number[] = []; const idx: number[] = [];
    for (const L of loops) {
      const n = L.pts.length;
      for (let i = 0; i < n; i++) {
        const p = L.pts[i], q = L.pts[(i + 1) % n];
        const dx = q[0] - p[0], dy = q[1] - p[1]; const len = Math.hypot(dx, dy) || 1;
        const ox = (-dy / len) * 0.9, oy = (dx / len) * 0.9;
        // 0.6 mm DEBAJO del lazo: encima lo tapa la pieza (depth-sort) — cazado
        // en el video del kernel; abajo se lee como contorno dorado alrededor.
        const f = pos.length / 3;
        pos.push(p[0] - ox, p[1] - oy, p[2] - 0.6, p[0] + ox, p[1] + oy, p[2] - 0.6,
          q[0] + ox, q[1] + oy, q[2] - 0.6, q[0] - ox, q[1] - oy, q[2] - 0.6);
        idx.push(f, f + 1, f + 2, f, f + 2, f + 3);
      }
    }
    const positions = new Float32Array(pos); const indices = new Uint32Array(idx);
    const normals = new Float32Array(positions.length);
    for (let i = 0; i < normals.length; i += 3) normals[i + 2] = 1;
    return { role: 'parting-line', name: 'Línea de partición', material: '—', positions, normals, indices, color: '#f0b429', opacity: 1 };
  }, []);
  const cursoRun = useCallback((fn: () => void) => {
    if (!oc || cursoBusy) return;
    setCursoBusy(true);
    setTimeout(() => {
      try { fn(); } catch (e) {
        console.error('CURSO_ERR:', e);
        setCursoReport((r) => { const nr = [...r, `ERROR: ${String(e).slice(0, 140)}`]; cursoRef.current.report = nr; return nr; });
      } finally { setCursoBusy(false); }
    }, 60);
  }, [oc, cursoBusy]);
  const cursoSet = useCallback((stage: number, report: string[], parts: MoldPart[]) => {
    cursoRef.current.stage = stage; cursoRef.current.report = report;
    setCursoStage(stage); setCursoReport(report); setMoldParts(parts);
  }, []);
  const cursoInsertar = useCallback(() => cursoRun(() => {
    const r = insertarPercha(oc!);
    cursoRef.current = { ...cursoRef.current, pieza: r.shape, vols: { pieza: r.volMm3 } };
    setMoldHidden({}); setMoldOpacity({}); setMoldColors({}); setMoldOffset({}); setMoldSelected(null);
    setDocName('Molde percha ×2 · curso Alwis');
    cursoSet(1, r.report, [cursoPart(r.shape, 'pieza', 'PERCHA (curso)', '#e2554a')]);
  }), [cursoRun, cursoSet, cursoPart, oc]);
  const cursoFlanera = useCallback(() => cursoRun(() => {
    const r = flanera(oc!);                                   // vaso PP Ø80→Ø72 · H40 · pared 1.2
    cursoRef.current = { ...cursoRef.current, pieza: r.shape, vols: { flanera: r.volMm3 } };
    setMoldHidden({}); setMoldOpacity({}); setMoldColors({}); setMoldOffset({}); setMoldSelected(null);
    setDocName('Flanera PP · vaso (revolución)');
    cursoSet(1, r.report, [cursoPart(r.shape, 'pieza', 'FLANERA (vaso PP)', '#e8dcc0', 0.96, 0.08)]);
  }), [cursoRun, cursoSet, cursoPart, oc]);
  // EL DADO — la pieza mínima verificable: cubo hueco 40×40×40, pared 2, abierto
  // abajo. Sólido REAL por booleana (caja − caja); draft 1.5° DECLARADO, no tallado
  // (tallarlo es asunto de la estación 3). Se muestran LAS DOS entradas lado a lado:
  // el macizo como fantasma rojo (reprobado) y el dado sólido (aprobado).
  const loadDado = useCallback(() => {
    if (!oc) return;
    try {
      const e1 = estacion1Dado();
      const dado = dadoRectoShape(oc);
      const macizo = OCC.transformShape(oc, OCC.makeBox(oc, 50, 50, 50), { translate: [-75, -5, 0] });
      setCiclo({ estacion: 1, e1 });
      setDocName('EL DADO · ciclo de Kazmer — estación 1 (DFM cap 2)');
      // abrir el panel de features (donde vive el CicloPanel) — mismo gesto del ARMADO
      setCollapsed((c) => ({ ...c, features: false }));
      cursoSet(1, [
        'CICLO DEL DADO · estación 1 — DFM de la pieza (cap 2)',
        `macizo: ${e1.macizo.veredicto} — t_c ${(e1.macizo.tcS / 60).toFixed(1)} min (Eq 9.5) · ${e1.macizo.dfm.errors} errores §2.3`,
        `dado: ${e1.dado.veredicto} — t_c ${e1.dado.tcS.toFixed(1)} s · pared 2 uniforme · draft 1.5° (Tabla 2.14)`,
      ], [
        cursoPart(macizo, 'macizo', 'cubo MACIZO 50³ — REPROBADO', '#f27a6c', 0.30, 0.05),
        cursoPart(dado, 'pieza', 'EL DADO 40×40×40 · pared 2 — APROBADO', '#7ee0a0', 0.96, 0.08),
      ]);
    } catch (e) { console.warn('DADO_ERR', e); }
  }, [oc, cursoSet, cursoPart, setDocName, setCollapsed]);
  // ── ESTACIÓN 2: ECONOMÍA (cap 3) — las FAMILIAS candidatas en 3D ──
  // "debemos ser espléndidos… todo debe de explicarse" (ian): el ganador ×1 en
  // DORADO y los perdedores ×2/×4 como fantasmas — NO se borran, se ve qué NO
  // elegir y el panel dice por cuánto pierde cada uno (amortización desglosada).
  // Corre la Máquina 6 veces (variantes + banda A-050): ~1 s síncrono, aceptable.
  const cicloEstacion2 = useCallback(() => {
    if (!oc || !ciclo) return;
    try {
      const e2 = estacion2Dado();
      const d = dadoShape(oc);
      const at = (x: number, y: number) => OCC.transformShape(oc, d, { translate: [x, y, 0] });
      const gana = e2.variantes.find((v) => v.ganadora);
      const v2 = e2.variantes.find((v) => v.nCav === 2 && v.arch === 'cold-2placas');
      const v4 = e2.variantes.find((v) => v.nCav === 4 && v.arch === 'cold-2placas');
      setCiclo({ ...ciclo, estacion: 2, e2 });
      setDocName('EL DADO · estación 2 — ECONOMÍA (cap 3): ¿cuántas cavidades?');
      setCollapsed((c) => ({ ...c, features: false }));
      cursoSet(2, [
        'CICLO DEL DADO · estación 2 — ECONOMÍA (cap 3)',
        `GANA ×${gana?.nCav}: molde $${gana?.moldeUSD.toLocaleString()} · $${gana?.totalPzaUSD}/pza a 100k`,
        e2.bandaLectura,
      ], [
        cursoPart(at(0, 0), 'pieza', `×1 GANADOR — $${gana?.totalPzaUSD}/pza`, '#f4d27a', 0.98, 0.1),
        cursoPart(at(80, -25), 'fam2a', `×2 pierde — $${v2?.totalPzaUSD}/pza`, '#8fa0b8', 0.22, 0.02),
        cursoPart(at(80, 25), 'fam2b', '×2 (la otra cavidad)', '#8fa0b8', 0.22, 0.02),
        cursoPart(at(170, -25), 'fam4a', `×4 pierde — $${v4?.totalPzaUSD}/pza`, '#8fa0b8', 0.16, 0.02),
        cursoPart(at(170, 25), 'fam4b', '×4', '#8fa0b8', 0.16, 0.02),
        cursoPart(at(220, -25), 'fam4c', '×4', '#8fa0b8', 0.16, 0.02),
        cursoPart(at(220, 25), 'fam4d', '×4', '#8fa0b8', 0.16, 0.02),
      ]);
    } catch (e) { console.warn('E2_ERR', e); }
  }, [oc, ciclo, cursoSet, cursoPart, setDocName, setCollapsed]);
  // ── ESTACIÓN 3: ARQUITECTURA (cap 4) — nace el primer acero ──
  // El dado gana su draft REAL (1.5° por loft — hasta la E2 iba declarado: se VE el
  // momento en que el acero se lo impone, decisión de ian). splitMold (el mismo de la
  // flanera, convención boca ARRIBA) talla cavidad+núcleo con ESCALA 1.0 a propósito:
  // la contracción es la estación 9 y ese retorno se declara, no se adelanta.
  // setMoldPkg(pkg) DESPIERTA los semáforos §4.3.3 que ya viven en MoldAnalisisPanel.
  const cicloEstacion3 = useCallback(() => {
    if (!oc || !ciclo?.e2) return;
    try {
      const pkg = ciclo.e2.pkg;
      const e3 = estacion3Dado(pkg);
      // EL ACERO VERIFICADO (orden e3-verificacion): construirAceroE3 talla con las
      // dims de COMPRA (insertDims — el bug de ian: 60/16 declarados vs 52/14
      // dibujados) y verificacionE3 mide TODO del B-Rep: 17 cotas declarado≈medido,
      // draft por rebanadas, Σ volúmenes = bloque, cuerpos=2. La tabla va al panel.
      const acero = construirAceroE3(oc, pkg);
      const dadoD = acero.dadoD;
      const r = acero.r;
      // SIN computeMoldAlarm aquí: congelaba el tab MINUTOS (vóxeles sobre bloques
      // de 120³ en el hilo del click) y además es REDUNDANTE — cavity/macho/pieza son
      // una PARTICIÓN EXACTA del bloque por construcción booleana, y la fila
      // "Σ cavidad+macho+pieza = bloque" ya lo prueba: traslape = suma > 100 %.
      const e3v = verificacionE3(oc, acero);
      const e3cotas = cotasCicloE3(e3v, acero, 34);   // 34 = el lift con que la escena abre el núcleo
      setCotasOn(true);                               // las dimensiones SE VEN, no se buscan
      const partPlano = OCC.transformShape(oc, OCC.makeBox(oc, 150, 150, 0.8), { translate: [-55, -55, 39.1] });
      const placaA = OCC.transformShape(oc, OCC.makeBox(oc, 196, 196, 66), { translate: [-78, -78, -79] });
      const placaB = OCC.transformShape(oc, OCC.makeBox(oc, 196, 196, 22), { translate: [-78, -78, 96] });
      setMoldPkg(pkg);
      setCiclo({ ...ciclo, estacion: 3, e3, e3v, e3cotas });
      setDocName('EL DADO · estación 3 — ARQUITECTURA (cap 4): nace el primer acero');
      setCollapsed((c) => ({ ...c, features: false }));
      cursoSet(3, [
        'CICLO DEL DADO · estación 3 — ARQUITECTURA (cap 4)',
        `cavidad 120×120×60 · núcleo 120×120×16 (P20) · base 196×196 comprada (§4.3.2)`,
        'draft 1.5° TALLADO — y los semáforos §4.3.3 despiertan (mira el panel de análisis)',
      ], [
        cursoPart(r.cavityPlate, 'cavidad', 'INSERTO DE CAVIDAD (hembra) · P20 · talla el exterior', '#9db4d0', 0.40, 0.03),
        cursoPart(OCC.transformShape(oc, r.corePlate, { translate: [0, 0, 34] }), 'nucleo', 'INSERTO DE NÚCLEO + macho · P20 (abierto +34 mm)', '#b8c6da', 0.92, 0.07),
        cursoPart(dadoD, 'pieza', 'EL DADO v2 — draft 1.5° TALLADO (ya no declarado)', '#7ee0a0', 0.52, 0.06),
        cursoPart(partPlano, 'particion', 'PARTICIÓN plana en la boca — A-061', '#f4d27a', 0.30, 0.04),
        cursoPart(placaA, 'placa-a-ghost', 'placa A 196×196×66 — el acero COMPRADO que aloja la cavidad', '#8fa0b8', 0.07, 0.01),
        cursoPart(placaB, 'placa-b-ghost', 'placa B 196×196×22 — aloja el núcleo', '#8fa0b8', 0.07, 0.01),
      ]);
    } catch (e) { console.warn('E3_ERR', e); }
  }, [oc, ciclo, cursoSet, cursoPart, setDocName, setCollapsed]);
  // De la flanera → CORE + CAVIDAD (los dos insertos TORNEABLES). El vaso se
  // revoluciona en +Y; el molde parte en Z → rotamos el eje del vaso a +Z (+90° en X),
  // y splitMold (probado en el banco: cup/lid) saca cavidad+núcleo+macho.
  // MOLDE COMPLETO de la flanera — UN SOLO PIPELINE: la FIGURA (sólido real) ES la
  // cavidad. moldMachine da los NÚMEROS (placas, fuerza, cotización); splitMold da la
  // GEOMETRÍA real (cavidad/núcleo del vaso). NADA de tubos regenerados de cotas.
  const loadFlaneraMold = useCallback(() => {
    try {
      const spec: MachineSpec = {
        name: 'Flanera Ø80×40 · PP · 4 cav',
        Lmm: 80, Wmm: 80, Hmm: 40, cavityShape: 'round',
        surfaceMm2: 15080, volumeMm3: 14266, wallMm: 1.2,
        annualVolume: 500000, plastic: 'PP', finish: 'SPI B-3',
      };
      const pkg = moldMachine(spec);                            // NÚMEROS (placas/fuerza/costo)
      // 4 CAVIDADES con la BASE de su variante real (no un override a ciegas):
      // la economía recomienda 1, pero el molde didáctico enseña la RED de
      // canales — se elige la variante cold-2placas×4 del propio paquete.
      const v4 = pkg.variantes.find((v: any) => v.arch === 'cold-2placas' && v.nCav === 4);
      if (v4?.factible) pkg.recomendacion = { arch: 'cold-2placas', nCav: 4, porQue: ['demo didáctica: red de canales en rejilla 2×2'] };
      setMoldPkg(pkg);                                          // el paquete VIVE: MoldPanels lo lee
      const aspec = packageToAssemblySpec(pkg);
      const id = insertDims(aspec);
      // FIGURA REAL → SÓLIDOS: el vaso se revoluciona en +Y; el molde parte en Z →
      // rotamos el eje del vaso a +Z (+90° X). splitMold (banco: cup/lid) saca cavidad+núcleo.
      const _T0 = performance.now(); const _mark = (n: string) => console.log('PERF flanera', n, Math.round(performance.now() - _T0), 'ms');
      const f = flanera(oc!); _mark('vaso');
      const up = OCC.transformShape(oc!, f.shape, { translate: [0, 0, 0], rotateAngle: Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [1, 0, 0] } });
      // BLOQUE del inserto ACOTADO a la placa (no el auto-margen gigante de splitMold, que
      // dejaba el inserto 24mm más alto que la placa A → se metía en el clamp). Ancho = la
      // orilla del libro (id.ifx/ify); alto = grosor de placa A menos holgura de asiento.
      const sc = scaleForShrinkage(oc!, up, 1.015);
      const bb = shapeBBox(oc!, sc);
      const zPartSplit = bb.max[2] - 0.5;                       // partición = boca del vaso (pinch)
      const tA = aspec.plates.A ?? 56;
      const cavH = Math.min(tA - 4, bb.max[2] - bb.min[2] + 12); // cabe en A, con piso bajo la base
      const block = { w: id.ifx, d: id.ify, h: cavH, x: (bb.max[0] + bb.min[0]) / 2, y: (bb.max[1] + bb.min[1]) / 2, z: zPartSplit - cavH / 2 };
      // §4.2.1 (Fig 4.13): el RESPALDO del inserto (rear→partición) = mínimo 3× el ⌀ de la
      // línea de enfriamiento (acero detrás de la superficie moldeante, evita esfuerzo §12).
      // El boss (macho, ARRIBA de la partición) SÍ es la profundidad real del vaso; el
      // respaldo NO — antes usaba dep+26 (sumaba la prof que va arriba) → core GIGANTE 90mm.
      const coolDiaMm = aspec.cooling?.diaMm ?? 8;
      const coreBackMm = Math.min((aspec.plates.B ?? 56) - 4, Math.max(12, Math.round(3 * coolDiaMm)));
      const r = splitMold(oc!, up, { scale: 1.015, zPart: zPartSplit, block, plateThickness: coreBackMm, pinch: 0.5 }); _mark('splitMold');
      // VERDAD DEL KERNEL: intersección booleana EXACTA cav∩core (sin mallas). Si >0,
      // los sólidos REALMENTE comparten acero; si ≈0, lo que reporte el estudio de
      // contacto de mallas en este par es artefacto de teselación.
      try {
        // GOTCHA OCC: common() se CUELGA con la placa A nueva (76mm) en el camino stripper
        // — kernel frágil, no determinista. Se salta para stripper; el par cav↔core queda
        // a juicio de malla (artefacto conocido de la pared 1.2 facetada, ~13k falsos).
        if (aspec.ejectors.type === 'stripper') throw new Error('skip-exact-stripper');
        const interVol = OCC.volume(oc!, OCC.common(oc!, r.cavityPlate, r.corePlate));
        (window as any).__flaneraCavCoreInterMm3 = +interVol.toFixed(1);
        // REGISTRO DE VERDADES EXACTAS: el kernel (booleana OCC) MANDA sobre la malla.
        // Para el par cav↔core la intersección exacta es 0 → cualquier "colisión" que la
        // malla reporte ahí es ARTEFACTO de teselación (pared 1.2mm facetada), no acero.
        (window as any).__exactPairsMm3 = { 'inserto-cav↔inserto-core': +interVol.toFixed(1) };
        console.log('CAV∩CORE exacto:', interVol.toFixed(1), 'mm³');
      } catch { (window as any).__flaneraCavCoreInterMm3 = null; }
      // ── STRIPPER (§11.3.4 Fig 11.19): el núcleo = macho + LAND deslizante + respaldo
      // anclado al SOPORTE ("core inserts fastened to the support plate"). El LAND
      // (⌀ = interior − 0.6 del escalado = el witness-offset de Fig 11.21) cruza el
      // anillo stripper; el bore del anillo = land + 0.10 (desliza). El respaldo (16 mm)
      // queda ABAJO, sobre el soporte — el anillo flota entre él y la placa A.
      let coreSolid = r.corePlate;
      if (aspec.ejectors.type === 'stripper') {
        try {
          const tBz = aspec.plates.B ?? 36;
          const landR = (id.fx - 2 * id.wall) / 2;               // MISMA fórmula que el bore (fuente única)
          const landH = tBz - 16;
          const land = OCC.makeCylinder(oc!, landR, landH, { origin: [0, 0, r.zPart], dir: [0, 0, 1] });
          let backing = OCC.makeBox(oc!, id.ifx, id.ify, 16);
          backing = OCC.transformShape(oc!, backing, { translate: [-id.ifx / 2, -id.ify / 2, r.zPart + landH] });
          // COMPOUND, no fuse: los tres cuerpos se apilan cara-a-cara — la booleana de
          // caras tangentes es CARÍSIMA en OCC (colgaba el build) y aquí no aporta nada.
          coreSolid = OCC.makeCompound(oc!, [r.macho, land, backing]);   // apilados cara-a-cara, sin booleana
        } catch (e) { console.warn('STRIPPER_CORE_ERR', e); coreSolid = r.corePlate; }
      }
      // Los SÓLIDOS viajan tal cual (marco local de splitMold): buildFunctionalParts los
      // ESPEJA al ensamble y los TALADRA ahí. La pieza = vaso a escala de cavidad (sc).
      liveRealSolidsRef.current = { cav: r.cavityPlate, core: coreSolid, piece: sc, zPartSplit: r.zPart };
      setLiveRealSolidsRev((v) => v + 1);
      setLiveMoldMesh(null);
      setLiveMoldSpec(aspec); _mark('fin-click');
    } catch (e) { console.error('FLANERA_MOLD_ERR', e); liveRealSolidsRef.current = null; setLiveRealSolidsRev((v) => v + 1); }
  }, [oc]);
  const cursoFlaneraMold = useCallback(() => cursoRun(() => {
    const f = flanera(oc!);
    const up = OCC.transformShape(oc!, f.shape, { translate: [0, 0, 0], rotateAngle: Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [1, 0, 0] } });
    const r = splitMold(oc!, up, { scale: 1.015, margin: 26, plateThickness: 24, pinch: 0.5 });
    cursoRef.current = { ...cursoRef.current, cav: r.cavityPlate, core: r.corePlate };
    setMoldHidden({}); setMoldOpacity({}); setMoldColors({}); setMoldSelected(null);
    setMoldOffset({ core: [0, 0, 55], cavity: [0, 0, 0] });   // EXPLOTA: núcleo arriba → se ve el hueco + el macho
    setDocName('Molde flanera · core/cavidad');
    cursoSet(2, [...f.report, ...r.report], [
      cursoPart(r.cavityPlate, 'cavity', 'CAVIDAD — forma el exterior (torneable)', '#e8a8bc', 0.62, 0.12),
      cursoPart(r.corePlate, 'core', 'NÚCLEO + macho — forma el interior (torneable)', '#a8c8e8', 1, 0.12),
    ]);
  }), [cursoRun, cursoSet, cursoPart, oc]);
  const cursoEscala = useCallback(() => cursoRun(() => {
    const r = escalaContraccion(oc!, cursoRef.current.pieza!, 1.015);
    cursoRef.current.piezaE = r.shape; cursoRef.current.vols.piezaE = r.volDespues;
    cursoSet(2, [...cursoRef.current.report, ...r.report], [cursoPart(r.shape, 'pieza', 'PERCHA ×1.015', '#e2554a')]);
  }), [cursoRun, cursoSet, cursoPart, oc]);
  const cursoLayout = useCallback(() => cursoRun(() => {
    const r = layoutDosCavidades(oc!, cursoRef.current.piezaE!);
    cursoRef.current.cuerpos = r.cuerpos; cursoRef.current.vols.total = r.volTotal;
    cursoRef.current.vols.sinTraslape = r.sinTraslape ? 1 : 0;
    cursoSet(3, [...cursoRef.current.report, ...r.report], [
      cursoPart(r.cuerpos[0], 'pieza', 'Cavidad 1', '#e2554a'),
      cursoPart(r.cuerpos[1], 'pieza-2', 'Cavidad 2', '#e2554a'),
    ]);
  }), [cursoRun, cursoSet, cursoPart, oc]);
  const cursoParting = useCallback(() => cursoRun(() => {
    const r = lineaParticion(oc!, cursoRef.current.cuerpos!);
    cursoRef.current.vols.nVertices = r.nVertices; cursoRef.current.vols.mensajeVerde = r.ok ? 1 : 0;
    setMoldParts((cur) => [...cur.filter((p) => p.role !== 'parting-line'), cursoLoopPart(r.loops)]);
    const rep = [...cursoRef.current.report, ...r.report];
    cursoRef.current.stage = 4; cursoRef.current.report = rep;
    setCursoStage(4); setCursoReport(rep);
  }), [cursoRun, cursoLoopPart, oc]);
  // MALLA → MoldPart directo (para los insertos TALLADOS por heightfield, que no
  // son B-Rep sino superficies rasterizadas — no pasan por cursoPart/tessellate).
  const meshToMoldPart = useCallback((m: { positions: Float32Array; normals: Float32Array; indices: Uint32Array }, role: string, name: string, color: string, opacity = 1): MoldPart => ({
    role, name, material: 'AISI P20', positions: m.positions, normals: m.normals, indices: m.indices, color, opacity,
  }), []);
  const cursoSplit = useCallback(() => cursoRun(() => {
    let planar = false;
    try {
      const r = toolingSplitCurso(oc!, cursoRef.current.cuerpos!);
      planar = true;
      cursoRef.current.cav = r.cavityPlate; cursoRef.current.core = r.corePlate; cursoRef.current.carved = false;
      cursoRef.current.vols.cavity = r.vols.cavity; cursoRef.current.vols.core = r.vols.core; cursoRef.current.vols.tmp = r.vols.tmp;
      // cavidad rosa TRASLÚCIDA arriba, núcleo verde abajo (render del curso). Alza 0.5mm
      // visuales: su cara inferior es coplanar con el núcleo → sin gap hace z-fighting.
      setMoldOffset((o) => ({ ...o, cavity: [0, 0, 0.5] }));
      cursoSet(5, [...cursoRef.current.report, ...r.report], [
        cursoPart(r.cavityPlate, 'cavity', 'Placa CAVIDAD 350×630×145', '#e8a8bc', 0.42),
        cursoPart(r.corePlate, 'core', 'Placa NÚCLEO 350×630×90', '#9ed0a8'),
        cursoPart(cursoRef.current.cuerpos![0], 'pieza', 'Cavidad 1', '#e2554a'),
        cursoPart(cursoRef.current.cuerpos![1], 'pieza-2', 'Cavidad 2', '#e2554a'),
      ]);
    } catch (e) {
      if (planar) throw e;   // el error salió DESPUÉS del split → no es el de "no plana"
      // PARTICIÓN NO PLANA (percha real curva) → TALLADO por heightfield (0.5s, robusto).
      const c = toolingSplitCursoCarve(oc!, cursoRef.current.cuerpos!);
      cursoRef.current.carved = true; cursoRef.current.cav = undefined; cursoRef.current.core = undefined;
      cursoRef.current.vols.deltaZ = c.deltaZ;
      setMoldOffset((o) => ({ ...o, 'inserto-cav': [0, 0, 0.5] }));
      cursoSet(5, [...cursoRef.current.report, ...c.report], [
        meshToMoldPart(c.cavMesh, 'inserto-cav', 'Inserto CAVIDAD tallado (impronta de las perchas)', '#e8a8bc', 0.6),
        meshToMoldPart(c.coreMesh, 'inserto-core', 'Inserto NÚCLEO tallado (macho)', '#9ed0a8', 1),
        cursoPart(cursoRef.current.cuerpos![0], 'pieza', 'Cavidad 1', '#e2554a'),
        cursoPart(cursoRef.current.cuerpos![1], 'pieza-2', 'Cavidad 2', '#e2554a'),
      ]);
    }
  }), [cursoRun, cursoSet, cursoPart, meshToMoldPart, oc]);
  const cursoGuias = useCallback(() => cursoRun(() => {
    if (cursoRef.current.carved || !cursoRef.current.cav) {
      // insertos TALLADOS (heightfield) = mallas, no B-Rep → el Hole Wizard de guías
      // (cortes cilíndricos B-Rep) no aplica aquí. Se declara honesto y se marca 6/6.
      const rep = [...cursoRef.current.report, 'Hole Wizard: guías ⌀48/⌀35 sobre las PLACAS del bloque (los insertos tallados van montados dentro) — corte B-Rep pendiente para el molde no plano (v2)'];
      cursoRef.current.stage = 6; cursoRef.current.report = rep;
      setCursoStage(6); setCursoReport(rep);
      return;
    }
    const r = guiasCurso(oc!, cursoRef.current.cav!, cursoRef.current.core!);
    cursoRef.current.cav = r.cavity; cursoRef.current.core = r.core;
    cursoRef.current.vols.quitadoCav = r.volQuitadoCav; cursoRef.current.vols.quitadoCore = r.volQuitadoCore;
    cursoSet(6, [...cursoRef.current.report, ...r.report], [
      cursoPart(r.cavity, 'cavity', 'Placa CAVIDAD + bushings ⌀48', '#e8a8bc', 0.5),
      cursoPart(r.core, 'core', 'Placa NÚCLEO + pernos ⌀35', '#9ed0a8'),
      cursoPart(cursoRef.current.cuerpos![0], 'pieza', 'Cavidad 1', '#e2554a'),
      cursoPart(cursoRef.current.cuerpos![1], 'pieza-2', 'Cavidad 2', '#e2554a'),
    ]);
  }), [cursoRun, cursoSet, cursoPart, oc]);
  const isolateMoldPlate = useCallback((role: string) => {
    setMoldHidden((h) => {
      const already = !h[role] && moldParts.every((p) => p.role === role || h[p.role]);
      if (already) return {};
      const next: Record<string, boolean> = {};
      for (const p of moldParts) next[p.role] = p.role !== role;
      return next;
    });
  }, [moldParts]);
  const setMoldPlateOpacity = useCallback((role: string, v: number) => setMoldOpacity((o) => ({ ...o, [role]: v })), []);
  // ── DEMO REDES DE COLADA (standalone: "solo lo conectaremos") ──
  // Reproduce las figuras del libro como sólidos de fundido + cavidades
  // fantasma; cada vértice sabe CUÁNDO le llega el frente (flowT).
  const loadFeedDemo = useCallback((kind: 'ramificada' | 'radial' | 'serie' | 'hibrida') => {
    if (!oc) return;
    const net: FeedNetwork = kind === 'radial' ? layoutRadial({}) : kind === 'serie' ? layoutSeries({}) : kind === 'hibrida' ? layoutHybrid({}) : layoutBranched({});
    applyResistanceNetwork(net);          // V̇ y tiempos FÍSICOS (§6.4.6), no estimados
    try {
      const solids = net.segs.map((sg) => {
        const dx = sg.b[0] - sg.a[0], dy = sg.b[1] - sg.a[1], dz = sg.b[2] - sg.a[2];
        const L = Math.hypot(dx, dy, dz);
        const axis = { origin: sg.a as [number, number, number], dir: [dx / L, dy / L, dz / L] as [number, number, number] };
        if (sg.level === 'sprue') return OCC.makeCone(oc!, sg.rMm, sg.rMm * 0.6, L, axis);   // §6.3.1
        // TÚNEL Fig 7.12: CONO que se ADELGAZA hacia el orificio en la pared
        if (sg.level === 'gate-sumergido') return OCC.makeCone(oc!, sg.rMm, 0.55, L, axis);
        return OCC.makeCylinder(oc!, sg.rMm, L, axis);
      });
      // ── EL DISPARO COMO UNA SOLA PIEZA (feedback user: 'si llenan sin
      // tocarse no está simulado'). Dos verdades separadas:
      //  1) CONECTIVIDAD = geometría: se FUSIONAN runners+gates+cavidades; si
      //     algo no toca, quedan ISLAS y el contador lo delata (no se esconde).
      //  2) TIEMPO = fórmula de Kazmer: V/V̇ acumulado por la ruta (la distancia
      //     geodésica NO es tiempo cuando el ⌀ cambia — el frente va más lento
      //     en un runner gordo que en el gate delgado, a igual longitud).
      const cavSolids = net.cavities.map((c) => OCC.makeCylinder(oc!, 8, 10, { origin: [c.x, c.y, -10], dir: [0, 0, 1] }));
      let shot: any;
      try { shot = OCC.fuseAll(oc!, [...solids, ...cavSolids]); }
      catch { shot = OCC.makeCompound(oc!, [...solids, ...cavSolids]); }
      const mesh = tessellate(oc!, shot, 0.25, 0.35);
      // ISLAS: union-find sobre vértices soldados (1 isla = todo tocándose)
      const nV = mesh.positions.length / 3;
      const rep = new Int32Array(nV);
      const key = new Map<string, number>();
      for (let v = 0; v < nV; v++) {
        const k = `${Math.round(mesh.positions[3 * v] * 100)},${Math.round(mesh.positions[3 * v + 1] * 100)},${Math.round(mesh.positions[3 * v + 2] * 100)}`;
        const hit = key.get(k);
        if (hit === undefined) { key.set(k, v); rep[v] = v; } else rep[v] = hit;
      }
      const uf = new Int32Array(nV);
      for (let v = 0; v < nV; v++) uf[v] = rep[v];
      const find = (a: number): number => { while (uf[a] !== a) { uf[a] = uf[uf[a]]; a = uf[a]; } return a; };
      const uni = (a: number, b: number) => { const ra = find(rep[a]), rb = find(rep[b]); if (ra !== rb) uf[ra] = rb; };
      for (let t = 0; t + 2 < mesh.indices.length; t += 3) {
        uni(mesh.indices[t], mesh.indices[t + 1]); uni(mesh.indices[t + 1], mesh.indices[t + 2]);
      }
      const islas = new Set<number>();
      for (let v = 0; v < nV; v++) if (rep[v] === v) islas.add(find(v));
      // TIEMPO por vértice: el segmento/cavidad más cercano da su reloj V/V̇
      const flowT = new Float32Array(nV);
      for (let i = 0; i < nV; i++) {
        const px = mesh.positions[3 * i], py = mesh.positions[3 * i + 1], pz = mesh.positions[3 * i + 2];
        let best = Infinity, bt = 0;
        for (const sg of net.segs) {
          const ux = sg.b[0] - sg.a[0], uy = sg.b[1] - sg.a[1], uz = sg.b[2] - sg.a[2];
          const L2 = ux * ux + uy * uy + uz * uz;
          const f = Math.max(0, Math.min(1, ((px - sg.a[0]) * ux + (py - sg.a[1]) * uy + (pz - sg.a[2]) * uz) / L2));
          const qx = sg.a[0] + f * ux - px, qy = sg.a[1] + f * uy - py, qz = sg.a[2] + f * uz - pz;
          const d = qx * qx + qy * qy + qz * qz - sg.rMm * sg.rMm;
          if (d < best) { best = d; bt = sg.tStartS + f * sg.tFillS; }
        }
        for (const c of net.cavities) {
          const dx = px - c.x, dy = py - c.y;
          const d = dx * dx + dy * dy - 8 * 8;
          if (d < best) {
            best = d;
            const dg = Math.hypot(px - c.gx, py - c.gy, pz - c.gz);
            bt = c.tStartS + Math.min(1, dg / 26) * c.tFillS;      // frente radial desde SU gate
          }
        }
        flowT[i] = bt;
      }
      const parts: MoldPart[] = [{
        role: 'colada',
        name: `Disparo ${kind} · ${islas.size === 1 ? 'UNA pieza ✓ todo conectado' : `⚠ ${islas.size} ISLAS sueltas`}`,
        material: 'fundido',
        positions: mesh.positions, normals: mesh.normals, indices: mesh.indices,
        color: '#ffb347', opacity: 0.95, bodies: net.segs.length + net.cavities.length,
        features: [
          `conectividad: ${islas.size} isla(s) tras FUSIONAR — 1 = el disparo sale de una pieza`,
          `tiempo: V/V̇ acumulado por ruta (Kazmer) — total ${net.totalFillS.toFixed(3)} s`,
          ...net.rows.map((r) => `${r.k}: ${r.v} [${r.ref}]`),
        ], edges: undefined,
        flowT, flowTotalS: net.totalFillS,
      } as unknown as MoldPart];
      setLiveMoldSpec(null);
      liveRealSolidsRef.current = null;
      setFeedDemo(true);
      setMoldParts(parts);
      setMoldHidden({}); setMoldOpacity({}); setMoldColors({});
      setFlowOn(true);
      setDocName(`Red de colada ${kind} · Fig ${({ radial: '6.15', serie: '6.13', hibrida: '6.16' } as Record<string, string>)[kind] ?? '6.14'}`);
      mark('feed-demo', 0, { kind });
    } catch (e) { console.error('FEED_DEMO_ERR', e); }
  }, [oc]);

  // BOLSA MEMOIZADA: identidad estable entre renders. Sin esto, cada render del
  // Studio crea un objeto nuevo y la instrumentación DEV de React 19
  // (logComponentRender→addObjectDiffToProperties) re-camina TODO el diff de
  // props de los paneles — con moldParts (Float32Arrays de millones) eso es el
  // main thread muerto. Cazado con Debugger.pause el 2026-07-27.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ moldSim, moldThermalSim, liveCotas, loadFeedDemo, feedDemo, liveMoldSpec, setLiveMoldSpec, liveMoldMesh, setLiveMoldMesh, liveDfm, liveRealSolidsRef, liveRealSolidsRev, setLiveRealSolidsRev, moldParts, setMoldParts, moldPkg, setMoldPkg, ciclo, loadDado, cicloEstacion2, cicloEstacion3, moldBuilding, setMoldBuilding, moldHidden, setMoldHidden, moldOpacity, setMoldOpacity, moldSelected, setMoldSelected, moldHover, setMoldHover, moldMoveMode, setMoldMoveMode, moldOffset, setMoldOffset, moldAnimRefs, moldOpenRef, moldOpenOn, setMoldOpenOn, moldMoveRef, moldColors, setMoldColors, alarmCloud, setAlarmCloud, moldExpanded, setMoldExpanded, moldCompAnalysis, flowOn, setFlowOn, liveFlow, moldOpenStrokeMm, liveFastener, fastHalf, setFastHalf, cotasOn, setCotasOn, cotaRefs, cotaAperturaRef, cotaErrors, moldSimOn, setMoldSimOn, moldPartingZ, moldXray, setMoldXray, moldSliceAxis, setMoldSliceAxis, moldSliceFrac, setMoldSliceFrac, moldTcOn, setMoldTcOn, moldTc, moldFea, setMoldFea, moldFeaBusy, setMoldFeaBusy, runMoldFeaNow, toggleMoldPlate, showAllMold, toggleMoldAlarm, cursoStage, setCursoStage, cursoBusy, setCursoBusy, cursoReport, setCursoReport, cursoCollapsed, setCursoCollapsed, cursoRef, cursoPart, cursoLoopPart, cursoRun, cursoSet, cursoInsertar, cursoFlanera, loadFlaneraMold, cursoFlaneraMold, cursoEscala, cursoLayout, cursoParting, meshToMoldPart, cursoSplit, cursoGuias, isolateMoldPlate, setMoldPlateOpacity }), [moldSim, moldThermalSim, liveCotas, loadFeedDemo, feedDemo, liveMoldSpec, setLiveMoldSpec, liveMoldMesh, setLiveMoldMesh, liveDfm, liveRealSolidsRef, liveRealSolidsRev, setLiveRealSolidsRev, moldParts, setMoldParts, moldPkg, setMoldPkg, ciclo, loadDado, cicloEstacion2, cicloEstacion3, moldBuilding, setMoldBuilding, moldHidden, setMoldHidden, moldOpacity, setMoldOpacity, moldSelected, setMoldSelected, moldHover, setMoldHover, moldMoveMode, setMoldMoveMode, moldOffset, setMoldOffset, moldAnimRefs, moldOpenRef, moldOpenOn, setMoldOpenOn, moldMoveRef, moldColors, setMoldColors, alarmCloud, setAlarmCloud, moldExpanded, setMoldExpanded, moldCompAnalysis, flowOn, setFlowOn, liveFlow, moldOpenStrokeMm, liveFastener, fastHalf, setFastHalf, cotasOn, setCotasOn, cotaRefs, cotaAperturaRef, cotaErrors, moldSimOn, setMoldSimOn, moldPartingZ, moldXray, setMoldXray, moldSliceAxis, setMoldSliceAxis, moldSliceFrac, setMoldSliceFrac, moldTcOn, setMoldTcOn, moldTc, moldFea, setMoldFea, moldFeaBusy, setMoldFeaBusy, runMoldFeaNow, toggleMoldPlate, showAllMold, toggleMoldAlarm, cursoStage, setCursoStage, cursoBusy, setCursoBusy, cursoReport, setCursoReport, cursoCollapsed, setCursoCollapsed, cursoRef, cursoPart, cursoLoopPart, cursoRun, cursoSet, cursoInsertar, cursoFlanera, loadFlaneraMold, cursoFlaneraMold, cursoEscala, cursoLayout, cursoParting, meshToMoldPart, cursoSplit, cursoGuias, isolateMoldPlate, setMoldPlateOpacity]);
}
