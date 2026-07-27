/**
 * TUPPER DE COMIDA — REDONDO, CON TAPA, EN PP.
 * ============================================
 * "el cuadrado es trampa, haz un tupper circular mi chavo" (user 2026-07-15). Tenía razón:
 * la caja rectangular ESCONDE la maquinaria. Con un prisma todo sale fácil y falso —
 * bolsa recta, inserto cuadrado, expulsores en rejilla. El círculo obliga a que todo sea
 * de verdad: núcleo redondo (§12.3.2 hoop, el ejemplo del VASO del libro), inserto
 * redondo, expulsores REPARTIDOS en un círculo. Y la TAPA obliga a lo que ninguna caja
 * suelta pide: dos piezas que EMBONAN, o sea una cota que le pertenece a las dos.
 *
 * EL MATERIAL — la corrección más importante y la más aburrida:
 * el tupper anterior estaba en ABS. **Un tupper de comida no es ABS: es PP.** PP es la
 * resina de los contenedores de comida del mundo real (contacto con alimento, microondas,
 * lavavajillas) y encima cuesta menos ($1.50/kg vs $2.16 de ABS, `PLASTICS`). Poner ABS en
 * un tupper es exactamente el tipo de detalle que hace que un molde salga caro y mal.
 *
 * LO QUE EL LIBRO MANDA (nada inventado):
 *  · §2.3.1 pared UNIFORME (lo grueso hunde y enfría lento: t_c ∝ h²)
 *  · §2.3.6 + Tabla 2.14 salida — OJO: la tabla del libro NO tiene fila de PP (son 5 filas
 *    LITERALES). `draftForFinish` cae a la fila del mismo ACABADO y DECLARA cuál usó, en
 *    vez de inventar un ángulo para PP.
 *  · §9.1 el alto = profundidad de cavidad → manda el cheek del inserto (§4.2.2)
 *
 * EL AJUSTE TAPA↔BOCA: la falda de la tapa monta SOBRE la boca del vaso. Esa holgura es
 * una sola cota que viven las dos piezas — por eso sale de UNA función (`lidFitMm`) y las
 * dos recetas la leen. Duplicarla sería el pecado de esta sesión por quinta vez.
 */
import type { Component, Feature } from '../timeline';
import { DRAFT_TABLE_2_14 } from '../dfm-mesh';

export interface TupperParams {
  /** ⌀ exterior de la BOCA — solo para la variante redonda (`tupperRecipe`) */
  diaMm: number;
  /** PLANTA del tupper REAL: rectangular con esquinas MUY redondeadas (lo que se vende) */
  lenMm: number; widMm: number;
  /** radio de esquina en planta — grande, R20 típico: no es cilindro ni caja */
  cornerRMm: number;
  /** LABIO de cierre: sobresale `lipOutMm` por lado, `lipHMm` de alto. Es el reborde
   *  donde engancha la tapa — y un ENGROSAMIENTO real (§2.3.1): enfría lento y hunde.
   *  Que sea "defectuoso" es el punto: una pieza sin defectos no prueba nada. */
  lipOutMm: number; lipHMm: number;
  /** alto del vaso */
  heightMm: number;
  /** pared nominal §2.3.1 — uniforme, es LA regla del diseño de inyección */
  wallMm: number;
  /** alto de la falda de la tapa (lo que monta sobre la boca) */
  lidSkirtMm: number;
  /** resina + acabado → el ángulo de salida sale de la Tabla 2.14 */
  resin: string; finish: string;
}

export const TUPPER_DEFAULT: TupperParams = {
  // TUPPER DE COMIDA REAL (~1 L, el rectangular de cocina): 165×120×65 con esquinas R20.
  // "eso que hiciste está ultrasencillo y no se pueden cazar tantos errores" (user
  // 2026-07-16) — tenía razón: un cilindro liso NO TIENE CON QUÉ FALLAR. El de verdad sí:
  //  · LABIO de cierre → undercut + engrosamiento (sink mark §2.3.1, enfría lento t_c∝h²)
  //  · esquinas R20 → el frente llega DESIGUAL (para eso existe §5.5.5)
  //  · planta rectangular con radios → ni cilindro ni caja: nada se resuelve "por fórmula"
  diaMm: 140, heightMm: 65,
  lenMm: 165, widMm: 120, cornerRMm: 20,
  lipOutMm: 2, lipHMm: 3,
  wallMm: 1.2,                     // §2.3.1: pared de contenedor de comida en PP
  lidSkirtMm: 12,
  resin: 'PP', finish: 'SPI B-3',  // PP = grado alimenticio (NO ABS)
};

/** ángulo de salida LITERAL de la Tabla 2.14 según resina+acabado (nada inventado).
 *  Si la resina no está en la tabla del libro (p.ej. PP), cae a la fila del mismo
 *  ACABADO y lo DICE en `row` — el usuario merece saber con qué fila se le acotó. */
export function draftForFinish(resin: string, finish: string): { deg: number; row: string } {
  const exacta = DRAFT_TABLE_2_14.find((r) => r.finish === finish && r.resin === resin);
  if (exacta) return { deg: exacta.draftDeg, row: `${exacta.finish} / ${exacta.resin} (fila exacta)` };
  const porAcabado = DRAFT_TABLE_2_14.find((r) => r.finish === finish);
  if (porAcabado) return { deg: porAcabado.draftDeg, row: `${porAcabado.finish} / ${porAcabado.resin} — la Tabla 2.14 no trae fila de ${resin}: se usa la del mismo acabado` };
  const porResina = DRAFT_TABLE_2_14.find((r) => r.resin === resin);
  if (porResina) return { deg: porResina.draftDeg, row: `${porResina.finish} / ${porResina.resin} (por resina)` };
  return { deg: 1.5, row: 'mínimo §2.3.6 (0.5°) con margen' };
}

/** HOLGURA de la falda de la tapa sobre la boca del vaso (mm, por lado).
 *  UNA SOLA FUENTE: la leen la receta del vaso y la de la tapa. Si cada una se la
 *  inventara, la tapa no cerraría — y nadie se enteraría hasta el molde.
 *  0.15 mm por lado = ajuste deslizante de tapa (el PP tiene juego de sobra: §11.3.5
 *  "most plastics have a strain to yield above 2%"). */
export function lidFitMm(): number { return 0.15; }

/** ⌀ interior de la falda de la tapa = boca del vaso + 2 holguras. Que la tapa NAZCA
 *  de la boca es el punto: son dos piezas, una cota. */
export function lidInnerDiaMm(p: TupperParams = TUPPER_DEFAULT): number {
  return +(p.diaMm + 2 * lidFitMm()).toFixed(2);
}

/**
 * RECETA DEL VASO (redondo). El ORDEN es cómo se maquina, no capricho:
 *  1. croquis CÍRCULO con el ⌀ de la BOCA
 *  2. extruir el alto
 *  3. SALIDA con el plano neutro ARRIBA: la boca conserva su cota y la pieza se ANGOSTA
 *     hacia el fondo — así sale del núcleo. (Con el neutro en z=0 la boca CRECE: lo cazó
 *     una cota en la versión rectangular, "boca 162.98 vs 160".)
 *  4. VACIAR al final: el cascarón hereda la salida en las dos caras → pared uniforme.
 *
 * Sin `fillet`: un vaso redondo NO tiene esquinas verticales que redondear (para eso era
 * el `only:'vertical'` del rectangular). El radio del fondo lo da el maquinado del núcleo.
 */
export function tupperRecipe(p: TupperParams = TUPPER_DEFAULT): Component {
  const d = draftForFinish(p.resin, p.finish);
  const tl: Feature[] = [
    { id: 'sk-boca', type: 'sketch-circle', label: `Croquis · boca ⌀${p.diaMm}`,
      params: { cx: p.diaMm / 2, cy: p.diaMm / 2, r: p.diaMm / 2, z: 0 },
      why: 'la BOCA manda: es la sección más ancha y por donde la pieza sale del núcleo' },
    { id: 'ex-alto', type: 'extrude', label: `Extruir · alto ${p.heightMm} mm`,
      params: { distance: p.heightMm, op: 'new' },
      why: '§9.1: el alto = profundidad de cavidad → manda el cheek del inserto (§4.2.2) y t_c ∝ h²' },
    { id: 'salida', type: 'draft', label: `Salida · ${d.deg}° (Tabla 2.14)`,
      params: { angleDeg: d.deg, neutralZ: p.heightMm },
      why: `Tabla 2.14 · ${d.row}. Sin salida la pieza se raya contra el núcleo al expulsar; el mínimo absoluto es 0.5° (§2.3.6)` },
    { id: 'vaciado', type: 'shell', label: `Vaciar · pared ${p.wallMm} mm`,
      params: { thickness: p.wallMm, open: 'top' },
      why: '§2.3.1: pared UNIFORME. Lo grueso enfría lento (t_c ∝ h²), se contrae de más y hunde (sink marks)' },
  ];
  return { name: `Vaso ⌀${p.diaMm}×${p.heightMm} (${p.resin})`, role: 'pieza', material: p.resin, timeline: tl };
}

/**
 * RECETA DE LA TAPA. Una tapa ES un vaso corto: falda + techo. Se modela con la MISMA
 * orientación que el vaso (boca arriba, neutro arriba, vaciado por arriba) y en el
 * ENSAMBLE se voltea sobre la boca — igual que en el molde, donde la tapa se coloca con
 * su boca hacia el núcleo. Modelarla "al revés" (neutro abajo + vaciar por abajo) es
 * pelearse con el kernel sin ganar nada: MEDIDO, el neutro abajo AGRANDA la falda
 * (croquis ⌀142.70 → sólido ⌀143.33, +0.63 = 2·h·tan1.5°) y el vaciado ya no halla su
 * cara. Es el mismo gotcha del plano neutro que cazó la cota en el rectangular.
 *
 * Su ⌀ interior sale de `lidInnerDiaMm` (boca + holgura) → la tapa NACE de la cota del
 * vaso: dos piezas, UNA cota.
 */
export function lidRecipe(p: TupperParams = TUPPER_DEFAULT): Component {
  const d = draftForFinish(p.resin, p.finish);
  const inner = lidInnerDiaMm(p);
  const outer = +(inner + 2 * p.wallMm).toFixed(2);   // la falda por fuera de la boca
  const tl: Feature[] = [
    { id: 'sk-tapa', type: 'sketch-circle', label: `Croquis · falda ⌀${outer}`,
      params: { cx: outer / 2, cy: outer / 2, r: outer / 2, z: 0 },
      why: `⌀ interior ${inner} = boca ⌀${p.diaMm} + 2×${lidFitMm()} de holgura (lidFitMm — la MISMA cota que el vaso, no una copia)` },
    { id: 'ex-falda', type: 'extrude', label: `Extruir · falda ${p.lidSkirtMm} mm`,
      params: { distance: p.lidSkirtMm, op: 'new' },
      why: 'la falda es lo que agarra la boca: sin ella la tapa solo se posa y no sella' },
    { id: 'salida', type: 'draft', label: `Salida · ${d.deg}° (Tabla 2.14)`,
      params: { angleDeg: d.deg, neutralZ: p.lidSkirtMm },
      why: `Tabla 2.14 · ${d.row}. Neutro ARRIBA: la falda conserva su ⌀ de agarre y se angosta hacia el techo — así sale del núcleo` },
    { id: 'vaciado', type: 'shell', label: `Vaciar · pared ${p.wallMm} mm`,
      params: { thickness: p.wallMm, open: 'top' },
      why: '§2.3.1 pared uniforme. La cara cerrada es el TECHO de la tapa; en el ensamble se voltea sobre la boca del vaso' },
  ];
  return { name: `Tapa ⌀${outer}×${p.lidSkirtMm} (${p.resin})`, role: 'pieza', material: p.resin, timeline: tl };
}


/**
 * ══ EL TUPPER REAL ══ el banco de pruebas que SÍ caza errores.
 * "prefiero que busques un tupper de comida REAL... eso que hiciste está ultrasencillo y
 *  no se pueden cazar tantos errores" (user 2026-07-16). Tenía razón: mi cilindro liso no
 * tenía CON QUÉ fallar, así que "0 errores" no probaba nada. Un tupper de cocina de
 * verdad (~1 L, 165×120×65) trae los tres problemas que un molde real tiene que resolver:
 *
 *   1. LABIO DE CIERRE — el reborde donde engancha la tapa. Sobresale ⇒ es un UNDERCUT
 *      (§2.3.7 · Fig 2.7) y además un ENGROSAMIENTO: al ser más grueso que la pared,
 *      enfría lento (t_c ∝ h², §9.1) y HUNDE (sink mark §2.3.1). Que salga "mal" en el
 *      DFM es EL PUNTO — así se ve si el análisis sirve.
 *   2. ESQUINAS R20 EN PLANTA — ni cilindro ni caja. El frente llega DESIGUAL a las
 *      esquinas y a los lados rectos: para eso existe §5.5.5 (flow leaders).
 *   3. PARED 1.2 EN PP con 65 mm de fondo — L/T alto: el número que decide si hace falta
 *      colada caliente o más compuertas (cap 5).
 *
 * ORDEN (es cómo se maquina, no capricho): croquis → extruir → salida → radios de esquina
 * → VACIAR → labio. El labio va AL FINAL y macizo a propósito: así se moldea de verdad y
 * así aparece el engrosamiento que el análisis debe cazar.
 */
export function tupperRealRecipe(p: TupperParams = TUPPER_DEFAULT): Component {
  const d = draftForFinish(p.resin, p.finish);
  const cx = p.lenMm / 2, cy = p.widMm / 2;
  const tl: Feature[] = [
    { id: 'sk-boca', type: 'sketch-rect', label: `Croquis · boca ${p.lenMm}×${p.widMm}`,
      params: { cx, cy, w: p.lenMm, h: p.widMm, z: 0 },
      why: 'la BOCA manda: es la sección más ancha y por donde la pieza sale del núcleo' },
    { id: 'ex-alto', type: 'extrude', label: `Extruir · alto ${p.heightMm} mm`,
      params: { distance: p.heightMm, op: 'new' },
      why: '§9.1: el alto = profundidad de cavidad → manda el cheek del inserto (§4.2.2) y t_c ∝ h²' },
    { id: 'salida', type: 'draft', label: `Salida · ${d.deg}° (Tabla 2.14)`,
      params: { angleDeg: d.deg, neutralZ: p.heightMm },
      why: `Tabla 2.14 · ${d.row}. Neutro ARRIBA: la boca conserva su cota y la pieza se angosta hacia el fondo — así sale del núcleo` },
    { id: 'radios', type: 'fillet', label: `Radios de esquina · R${p.cornerRMm}`,
      params: { r: p.cornerRMm, only: 'vertical' },
      why: '§2.3.4: la esquina viva concentra esfuerzo, estorba el flujo y es cara de maquinar. R20 es lo que trae un tupper real — y hace que el frente llegue DESIGUAL a esquinas vs lados (§5.5.5). Solo las VERTICALES: `filletAllEdges` deja un sólido que este OCCT-WASM ya no puede VACIAR' },
    { id: 'vaciado', type: 'shell', label: `Vaciar · pared ${p.wallMm} mm`,
      params: { thickness: p.wallMm, open: 'top' },
      why: '§2.3.1: pared UNIFORME. Lo grueso enfría lento (t_c ∝ h²), se contrae de más y hunde' },
    // OJO: el labio necesita SU PROPIO croquis. `extrude` usa el `profile` del croquis
    // ANTERIOR — un `params.sketch` anidado se IGNORA EN SILENCIO y el paso igual reporta
    // ✓: medido, el labio re-extruía la boca desde z=0 y dejaba un macizo en el FONDO
    // (bbox 165×120 cuando debía ser 169×124, y +30 cc de plástico fantasma). Un ✓ que no
    // verifica el resultado no vale nada: lo cazó el BBOX, no el estado del paso.
    { id: 'sk-labio', type: 'sketch-rect', label: `Croquis · labio ${p.lenMm + 2 * p.lipOutMm}×${p.widMm + 2 * p.lipOutMm}`,
      params: { cx, cy, w: p.lenMm + 2 * p.lipOutMm, h: p.widMm + 2 * p.lipOutMm, z: p.heightMm - p.lipHMm },
      why: `el labio sobresale ${p.lipOutMm} mm por lado sobre la boca ${p.lenMm}×${p.widMm}: ahí engancha la tapa` },
    { id: 'labio', type: 'extrude', label: `Labio de cierre · +${p.lipOutMm} por lado × ${p.lipHMm} alto`,
      params: { distance: p.lipHMm, op: 'add' },
      why: 'el reborde donde engancha la tapa. Sobresale ⇒ UNDERCUT (§2.3.7) y ENGROSAMIENTO: más grueso que la pared ⇒ enfría lento (t_c ∝ h²) y HUNDE (sink §2.3.1)' },
    // ⚠ EL BUG QUE CAZÓ EL USER A OJO (2026-07-17): el extrude del labio es una PLACA
    // COMPLETA 169×124 — sobre un cascarón ABIERTO eso lo SELLA: el tupper quedaba con
    // TAPA soldada (63 cc de más), una caja cerrada IMPOSIBLE de moldear ("en un molde
    // es imposible que haya voladizos... estás inyectando todo el tupper con tapa").
    // El DFM lo había dicho — "cavidad interna CERRADA" — y yo lo descarté como
    // artefacto. El ojo del user cazó lo que yo justifiqué. Este pocket REABRE la boca:
    // el labio queda como ANILLO (3.5 cc), que es lo que un tupper real tiene.
    { id: 'boca-abierta', type: 'pocket', label: `Reabrir boca · ${(p.lenMm - 2 * p.wallMm).toFixed(1)}×${(p.widMm - 2 * p.wallMm).toFixed(1)}`,
      params: { cx, cy, w: p.lenMm - 2 * p.wallMm, h: p.widMm - 2 * p.wallMm, z: p.heightMm - p.lipHMm, depth: p.lipHMm + 1 },
      why: 'el labio es un ANILLO, no una tapa: sin este corte la pieza queda SELLADA (caja cerrada = no moldeable; el DFM la marcaba "cavidad interna CERRADA")' },
  ];
  return { name: `Tupper ${p.lenMm}×${p.widMm}×${p.heightMm} (${p.resin})`, role: 'pieza', material: p.resin, timeline: tl };
}

/** MachineSpec del TUPPER REAL. */
export function tupperRealMachineSpec(p: TupperParams = TUPPER_DEFAULT) {
  const surf = 2 * (p.lenMm + p.widMm) * p.heightMm + p.lenMm * p.widMm;
  return {
    name: 'tupper real', Lmm: p.lenMm, Wmm: p.widMm, Hmm: p.heightMm,
    surfaceMm2: Math.round(surf), volumeMm3: Math.round(surf * p.wallMm),
    wallMm: p.wallMm, annualVolume: 2_000_000, plastic: p.resin, finish: p.finish,
  };
}

/** MachineSpec del VASO — lo que se le entrega a la Máquina de Moldes. */
export function tupperMachineSpec(p: TupperParams = TUPPER_DEFAULT) {
  const R = p.diaMm / 2;
  // cascarón: pared lateral (πDh) + fondo (πR²). La boca va abierta.
  const surf = Math.PI * p.diaMm * p.heightMm + Math.PI * R * R;
  return {
    name: 'tupper redondo', Lmm: p.diaMm, Wmm: p.diaMm, Hmm: p.heightMm,
    cavityShape: 'round' as const,        // pieza de revolución: cavidad/inserto/núcleo REDONDOS
    surfaceMm2: Math.round(surf), volumeMm3: Math.round(surf * p.wallMm),
    wallMm: p.wallMm, annualVolume: 2_000_000, plastic: p.resin, finish: p.finish,
  };
}

/** MachineSpec de la TAPA — pieza aparte: su propio molde, su propio ciclo. */
export function lidMachineSpec(p: TupperParams = TUPPER_DEFAULT) {
  const outer = lidInnerDiaMm(p) + 2 * p.wallMm, R = outer / 2;
  const surf = Math.PI * outer * p.lidSkirtMm + Math.PI * R * R;   // falda + techo
  return {
    name: 'tapa tupper', Lmm: +outer.toFixed(1), Wmm: +outer.toFixed(1), Hmm: p.lidSkirtMm,
    cavityShape: 'round' as const,
    surfaceMm2: Math.round(surf), volumeMm3: Math.round(surf * p.wallMm),
    wallMm: p.wallMm, annualVolume: 2_000_000, plastic: p.resin, finish: p.finish,
  };
}
