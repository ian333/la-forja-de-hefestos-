/**
 * LA COLADA — generador propio (Kazmer cap 6 "Feed System Design")
 * =====================================================================
 * Nació de que ian leyó el capítulo conmigo y dictó el diagnóstico correcto:
 * *"mi problema sigue siendo lo espacial, no es código"* y *"si no la viste es porque
 * estaba entre un bueno de código, cuando debería estar separada como todo lo demás"*.
 *
 * Tenía razón en las dos. `mold-plano-set.ts` YA construía la colada bien —con los
 * datums del libro— pero en la línea 1112 de 1619, entre el agua y los tornillos. Y la
 * estación 5 del ciclo, al no verla, se inventó otra: `L_sprue = 60`, eje en
 * `lado + rBase + 6`. Ninguna de esas dos cotas es de nadie.
 *
 * ESTE MÓDULO NO INVENTA NINGUNA COTA. Cada dimensión trae su PROCEDENCIA en `fuente`:
 * o es del libro con su sección, o es una EXTENSIÓN DECLARADA. Si el stack no da un
 * datum, se dice en `conflictos` — no se rellena con una constante.
 *
 * Las cuatro capas del patrón que hace verificables a las estaciones 1-4:
 *   1 · datumsColada(...)          PURO, sin kernel — node-testeable
 *   2 · construirColada(K, oc, d)  recibe el kernel → devuelve sólidos
 *   3 · verificacionColada(...)    MIDE el B-Rep: declarado ≈ medido
 *   4 · coladaMala(K, oc, d)       el control negativo, que DEBE reprobar
 *
 * Convención del archivo (la misma de `mold-plano-set`): lo que toca el kernel recibe
 * `(K, oc)` por parámetro; el módulo NO importa occt.
 */
import { designSprueFeed, steelSafeDiaMm, STANDARD_RUNNER_DIAMM } from './feed';
import { gateDesign } from './gating';

// ─────────────────────────────────────────────────────────────────
// 1 · DATUMS — puros, y cada uno con su procedencia
// ─────────────────────────────────────────────────────────────────

export interface DatumsColada {
  /** eje del bushing = CENTRO del molde (Fig 6.4: bushing + anillo centrador sobre el
   *  eje de la boquilla de la máquina). NO es una posición libre. */
  ejeX: number; ejeY: number;
  /** cara exterior del top clamp: donde apoya la boquilla */
  zCaraClampMm: number;
  /** dónde la colada ENTRA al plástico */
  zGateMm: number;
  /** plano de partición — por donde corre el runner */
  zPartMm: number;
  /** §6.3.1: "the length of the sprue is determined by the combined thicknesses of the
   *  top clamp plate and the A plate". NUNCA una constante. */
  LsprueMm: number;
  rTopMm: number; rBaseMm: number;
  /** §6.3.1: "the lengths of the runners are determined by the position of the cavities" */
  LrunnerMm: number; runnerDiaMm: number; runnerDiaCrudoMm: number;
  pozoLargoMm: number;
  gateEspesorMm: number; gateAnchoMm: number; gateLargoMm: number;
  /** punto de entrada al plástico (x,y,z) */
  destino: { x: number; y: number; z: number };
  /** §6.3.1: "a reverse taper is usually provided below the sprue" — el sprue puller.
   *  Su conicidad va AL REVÉS que la del bebedero: es un undercut que agarra. */
  puller: { diaMenorMm: number; diaMayorMm: number; largoMm: number };
  modo: 'sprue-directo' | 'sprue+runner' | 'requiere-offset';
  /** lo que el stack o el layout NO permiten — se DECLARA, no se rellena */
  conflictos: string[];
  /** de dónde salió cada cota: sección del libro, o EXTENSIÓN DECLARADA */
  fuente: Record<string, string>;
  VdotCcS: number;
}

export function datumsColada(o: {
  /** el stack REAL — de aquí sale L_sprue, no de una constante */
  plates: { bottomClamp: number; ejectorHousing: number; support: number; B: number; A: number; topClamp: number };
  moldWidthMm: number; moldDepthMm: number;
  zPartMm: number;
  /** la pieza en coords de placa: su huella y su base CERRADA */
  pieza: { x0: number; y0: number; x1: number; y1: number; zBaseCerradaMm: number; bocaEnParticion: boolean };
  plastic?: string; partVolCc: number; wallMm: number; fillTimeS?: number;
  /** EXTENSIÓN DECLARADA: acero mínimo entre el barreno del bebedero y la cavidad. */
  holguraAceroMm?: number;
}): DatumsColada {
  const conflictos: string[] = [];
  const fuente: Record<string, string> = {};

  // ── el EJE: el centro del molde. Fig 6.4 — el anillo centrador orienta el molde en la
  // platina y el bushing acopla la boquilla; el eje del sprue NO se elige.
  const ejeX = o.moldWidthMm / 2, ejeY = o.moldDepthMm / 2;
  fuente.eje = 'Fig 6.4 — bushing + anillo centrador sobre el eje de la boquilla';

  // ── el LARGO: el stack. §6.3.1 literal.
  const p = o.plates;
  const zCaraClampMm = p.bottomClamp + p.ejectorHousing + p.support + p.B + p.A + p.topClamp;
  if (!(p.topClamp > 0)) conflictos.push('el stack NO tiene TOP CLAMP PLATE: sin ella §6.3.1 no define L_sprue (el bebedero atraviesa top clamp + placa A). No se inventa el largo.');
  // §6.3.1 + el bug ya pagado en mold-plano-set: el cono NACE en la base CERRADA de la
  // pieza, NO en la partición — nacer en zPart lo mete DENTRO del macho (colisión de
  // 45.8 mm³ documentada). Si la boca mira a la partición, la base cerrada está abajo.
  const zGateMm = o.pieza.zBaseCerradaMm;
  fuente.LsprueMm = '§6.3.1 — "determined by the combined thicknesses of the top clamp plate and the A plate"';
  fuente.zGateMm = 'base CERRADA de la pieza (no la partición) — bug inserto-core↔colada 45.8 mm³ ya pagado';
  const LsprueMm = zCaraClampMm - zGateMm;

  // ── los RADIOS: del motor del libro (§6.3.1 + Eq 6.8), nunca a mano
  const fd = designSprueFeed({
    material: (o.plastic ?? 'ABS').toUpperCase().includes('PP') ? 'PP' : 'ABS',
    partVolumeCc: o.partVolCc, partWallMm: o.wallMm,
    sprueLenMm: Math.max(1, LsprueMm), fillTimeS: o.fillTimeS ?? 1,
  });
  fuente.radios = '§6.3.1 (orificio de boquilla + holgura) + Eq 6.8 (radio por ΔP asignado)';

  // ── ¿ALCANZA UN SPRUE DIRECTO? Ésta es la pregunta ESPACIAL, la que faltaba.
  // El eje cae en el centro del molde. Si ahí hay BOCA (hueco) en vez de plástico, un
  // sprue directo cae al vacío: hay que desplazar la cavidad o voltear la pieza.
  const dentroDeLaHuella = ejeX >= o.pieza.x0 && ejeX <= o.pieza.x1 && ejeY >= o.pieza.y0 && ejeY <= o.pieza.y1;
  const holguraAceroMm = o.holguraAceroMm ?? 4;
  fuente.holguraAceroMm = 'EXTENSIÓN DECLARADA — acero mínimo entre el barreno del bebedero y la cavidad';
  let modo: DatumsColada['modo'] = 'sprue-directo';
  let destino = { x: ejeX, y: ejeY, z: zGateMm };
  let LrunnerMm = 0;
  if (dentroDeLaHuella && o.pieza.bocaEnParticion) {
    modo = 'requiere-offset';
    const offsetMin = (o.pieza.x1 - o.pieza.x0) / 2 + fd.rBaseMm + holguraAceroMm;
    conflictos.push(
      `el eje del bushing (${ejeX.toFixed(1)}, ${ejeY.toFixed(1)}) cae SOBRE LA BOCA de la pieza: un sprue directo entraría al hueco. ` +
      `O se desplaza la cavidad ≥ ${offsetMin.toFixed(1)} mm del centro (retorno a la estación 3, que es la del layout), ` +
      `o se voltea la pieza para que su base cerrada mire a la placa A (sprue directo, §6.3.1).`);
    // la ruta que SÍ se puede construir hoy: bebedero al centro + runner al labio
    destino = { x: o.pieza.x1, y: ejeY, z: o.zPartMm };
    LrunnerMm = Math.max(0, destino.x - ejeX);
    fuente.LrunnerMm = '§6.3.1 — "determined by the position of the cavities"';
  } else if (!dentroDeLaHuella) {
    modo = 'sprue+runner';
    destino = { x: o.pieza.x1, y: ejeY, z: o.zPartMm };
    LrunnerMm = Math.max(0, destino.x - ejeX);
    fuente.LrunnerMm = '§6.3.1 — "determined by the position of the cavities"';
  }

  // ── la COMPUERTA (§7.3.1-7.3.2) y el RUNNER (§6.5.4/§6.5.5 + §7.1.5)
  const VdotM3s = fd.VdotCcS * 1e-6;
  const g = gateDesign({ type: 'edge', wallMm: o.wallMm, VdotM3s, shearMaxS: 50000 });
  const gateLargoMm = 1.0;
  fuente.gateLargoMm = 'EXTENSIÓN DECLARADA — land corto para que la compuerta se corte fácil';
  // el ⌀ del runner: steel-safe (§6.5.5) pero SIEMPRE mayor que la compuerta, o la
  // sección deja de bajar y la puerta no sella primero (§7.1.5).
  const runnerDiaCrudoMm = Math.max(g.thicknessMm * 1.5, 2 * fd.rBaseMm * 0.5);
  fuente.runnerDiaMm = '§6.5.4 fresa estándar · §6.5.5 steel-safe · §7.1.5 mayor que la compuerta';
  const runnerDiaMm = STANDARD_RUNNER_DIAMM.find((d) => d > g.thicknessMm && d >= steelSafeDiaMm(runnerDiaCrudoMm)) ?? 4;

  return {
    ejeX, ejeY, zCaraClampMm, zGateMm, zPartMm: o.zPartMm, LsprueMm,
    rTopMm: fd.rTopMm, rBaseMm: fd.rBaseMm,
    LrunnerMm, runnerDiaMm, runnerDiaCrudoMm,
    pozoLargoMm: runnerDiaMm,                              // §6.3.3: pozo de escoria = 1⌀
    gateEspesorMm: g.thicknessMm, gateAnchoMm: g.widthMm, gateLargoMm,
    destino,
    // §6.3.1: "a reverse taper is usually provided below the sprue" — AL REVÉS que el
    // bebedero: ancho ABAJO no, ancho ARRIBA no… ancho en el FONDO del pozo, para que al
    // jalar hacia B rompa el pequeño undercut y arrastre la colada.
    puller: { diaMenorMm: runnerDiaMm * 0.8, diaMayorMm: runnerDiaMm * 1.25, largoMm: runnerDiaMm * 1.2 },
    modo, conflictos, fuente, VdotCcS: fd.VdotCcS,
  };
}

// ─────────────────────────────────────────────────────────────────
// 2 · FORMA — recibe (K, oc), devuelve sólidos
// ─────────────────────────────────────────────────────────────────

export interface ColadaSolidos {
  bebedero: any; runner: any | null; pozo: any | null; compuerta: any | null; puller: any | null;
  /** el fundido completo, fusionado — lo que se dibuja */
  fundido: any;
}

/** EL BEBEDERO, solo — la primitiva que también usa `mold-plano-set` para el molde
 *  completo. Una sola definición de la conicidad (§6.3.1: r1 ANCHO en el origen, que es
 *  la partición; r2 angosto arriba, en la boquilla) para todo el repo. */
export function construirColadaSprue(K: any, oc: any, o: {
  x: number; y: number; zGate: number; Lsprue: number; rBaseMm: number; rTopMm: number;
}): any {
  return K.makeCone(oc, o.rBaseMm, o.rTopMm, o.Lsprue, { origin: [o.x, o.y, o.zGate], dir: [0, 0, 1] });
}

export function construirColada(K: any, oc: any, d: DatumsColada): ColadaSolidos {
  // §6.3.1: ANGOSTO en la boquilla (arriba), ANCHO en la partición (abajo) — así la
  // colada solidificada se extrae del bushing. r1 va en el ORIGEN del eje.
  const bebedero = construirColadaSprue(K, oc, {
    x: d.ejeX, y: d.ejeY, zGate: d.zGateMm, Lsprue: d.LsprueMm, rBaseMm: d.rBaseMm, rTopMm: d.rTopMm });
  let runner: any = null, pozo: any = null, compuerta: any = null, puller: any = null;
  if (d.LrunnerMm > 0) {
    const x0 = d.ejeX;
    runner = K.makeCylinder(oc, d.runnerDiaMm / 2, Math.max(0.1, d.LrunnerMm - d.gateLargoMm),
      { origin: [x0, d.ejeY, d.zPartMm], dir: [1, 0, 0] });
    // POZO DE ESCORIA: prolonga el runner del lado OPUESTO al destino, bajo el bebedero,
    // para que el tapón frío de la boquilla se quede ahí y no entre a la pieza.
    pozo = K.makeCylinder(oc, d.runnerDiaMm / 2, d.pozoLargoMm,
      { origin: [x0 - d.pozoLargoMm, d.ejeY, d.zPartMm], dir: [1, 0, 0] });
    compuerta = K.transformShape(oc,
      K.makeBox(oc, d.gateLargoMm, d.gateAnchoMm, d.gateEspesorMm),
      { translate: [d.destino.x - d.gateLargoMm, d.ejeY - d.gateAnchoMm / 2, d.zPartMm - d.gateEspesorMm] });
    // SPRUE PULLER: cono INVERTIDO bajo el pozo (ancho abajo = undercut que agarra).
    puller = K.makeCone(oc, d.puller.diaMenorMm / 2, d.puller.diaMayorMm / 2, d.puller.largoMm,
      { origin: [x0 - d.pozoLargoMm / 2, d.ejeY, d.zPartMm - d.puller.largoMm], dir: [0, 0, 1] });
  }
  const partes = [bebedero, runner, pozo, compuerta, puller].filter(Boolean);
  const fundido = partes.length > 1 ? K.fuseAll(oc, partes) : bebedero;
  return { bebedero, runner, pozo, compuerta, puller, fundido };
}

/** CONTROL NEGATIVO: la colada de la E5 de ayer — ⌀9.5 recto, fuera de eje, sin runner
 *  ni compuerta, naciendo en la PARTICIÓN. Debe REPROBAR la verificación; si no, el
 *  test no distingue lo roto y no es evidencia. */
export function coladaMala(K: any, oc: any, d: DatumsColada): ColadaSolidos {
  const bebedero = K.makeCone(oc, 4.75, 2.5, 60, { origin: [d.destino.x, d.ejeY, d.zPartMm], dir: [0, 0, 1] });
  return { bebedero, runner: null, pozo: null, compuerta: null, puller: null, fundido: bebedero };
}

// ─────────────────────────────────────────────────────────────────
// 3 · VERIFICACIÓN — mide el B-Rep: declarado ≈ medido
// ─────────────────────────────────────────────────────────────────

export interface MedidaColada {
  cota: string; declarado: number; medido: number; tolMm: number; ok: boolean; seccion: string;
}
export interface VerificacionColada {
  medidas: MedidaColada[]; ok: boolean; resumen: string;
  /** A-129 — la sección BAJA aguas abajo (lo que se veía "al revés") */
  estrecha: { bebederoMm: number; runnerMm: number; compuertaMm: number; ok: boolean };
  /** el eje cae donde manda la Fig 6.4 y no sobre la boca */
  ejeOk: boolean;
}

export function verificacionColada(K: any, oc: any, s: ColadaSolidos, d: DatumsColada): VerificacionColada {
  const bb = (sh: any) => {
    const b = new oc.Bnd_Box_1(); oc.BRepBndLib.Add(sh, b, false);
    const a = b.CornerMin(), c = b.CornerMax();
    return { x0: a.X(), y0: a.Y(), z0: a.Z(), x1: c.X(), y1: c.Y(), z1: c.Z(), dx: c.X() - a.X(), dy: c.Y() - a.Y(), dz: c.Z() - a.Z() };
  };
  const M: MedidaColada[] = [];
  const mide = (cota: string, declarado: number, medido: number, tolMm: number, seccion: string) =>
    M.push({ cota, declarado: +declarado.toFixed(3), medido: +medido.toFixed(3), tolMm, ok: Math.abs(medido - declarado) <= tolMm, seccion });

  const bS = bb(s.bebedero);
  mide('L_sprue (del STACK, no de una constante)', d.LsprueMm, bS.dz, 0.05, '§6.3.1');
  mide('⌀ del bebedero en la partición', 2 * d.rBaseMm, bS.dx, 0.05, '§6.3.1 · Eq 6.8');
  mide('eje X del bebedero = centro del molde', d.ejeX, (bS.x0 + bS.x1) / 2, 0.05, 'Fig 6.4');
  mide('eje Y del bebedero = centro del molde', d.ejeY, (bS.y0 + bS.y1) / 2, 0.05, 'Fig 6.4');
  mide('el bebedero ARRANCA en la base cerrada de la pieza', d.zGateMm, bS.z0, 0.05, '§6.3.1 (bug 45.8 mm³)');

  const bR = s.runner ? bb(s.runner) : null;
  const bG = s.compuerta ? bb(s.compuerta) : null;
  if (bR) mide('⌀ del runner', d.runnerDiaMm, bR.dy, 0.05, '§6.5.4 · §7.1.5');
  if (bG) {
    mide('espesor de la compuerta', d.gateEspesorMm, bG.dz, 0.05, '§7.3.1');
    mide('la compuerta TOCA la pieza', d.destino.x, bG.x1, 0.05, '§6.3.1');
  }
  if (s.puller) {
    const bP = bb(s.puller);
    // §6.3.1 "a reverse taper is usually provided below the sprue": el puller va AL REVÉS
    mide('el sprue puller existe y vive BAJO la partición', d.zPartMm - d.puller.largoMm, bP.z0, 0.05, '§6.3.1');
  }

  const estrecha = {
    bebederoMm: bS.dx, runnerMm: bR ? bR.dy : NaN, compuertaMm: bG ? bG.dz : NaN,
    ok: !!bR && !!bG && bS.dx > bR.dy && bR.dy > bG.dz,
  };
  const ejeOk = Math.abs((bS.x0 + bS.x1) / 2 - d.ejeX) <= 0.05 && Math.abs((bS.y0 + bS.y1) / 2 - d.ejeY) <= 0.05;
  const ok = M.every((m) => m.ok) && estrecha.ok && ejeOk;
  return {
    medidas: M, ok, estrecha, ejeOk,
    resumen: `${M.filter((m) => m.ok).length}/${M.length} cotas · ${estrecha.ok ? 'ESTRECHA ✓' : 'NO ESTRECHA ✗'} · ${ejeOk ? 'eje centrado ✓' : 'eje FUERA del centro ✗'}`,
  };
}
