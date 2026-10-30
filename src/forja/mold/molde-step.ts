/**
 * EL MOLDE EN STEP (orden K · EL MOLDE EN STEP Y CON NOMBRE ISO, 2026-10-30)
 * ==============================================================================================================
 * La planta abre el molde en SU CAD (Fusion, SolidWorks, FreeCAD) y ve cada cuerpo con su nombre de la norma. Este
 * módulo arma la lista de cuerpos B-Rep del molde que la app tiene armado (`MoldPart[]`, mallas) y mide la ida y vuelta
 * del archivo. El escritor/lector XCAF vive en occt.ts (`exportSTEPEnsamble` / `importSTEPEnsamble`).
 *
 * DE DÓNDE SALE EL SÓLIDO DE CADA CUERPO (medido, no supuesto — ver `inventario`):
 *  · casi todo cuerpo nace B-Rep y pasa por `tessellate`: occt.ts apunta de qué forma salió cada malla
 *    (`formaDeLaMalla`). Así llegan los insertos barrenados, la colada, los botadores, los tapones, las guías, los
 *    bujes, los pilares, los rieles, los retornos y el anillo — el MISMO sólido que la app teseló, sin re-construir.
 *  · las PLACAS de la base se arman NOMINALES con `buildPlateSolid` (el mismo constructor y el mismo spec que las
 *    láminas): la app las pinta con un rasurado anti-z-fight de 0.06–0.24 mm por lado (`shaveMm`, truco de render) y
 *    la placa A/B como caja «fantasma» sin bolsa — ninguna de las dos cosas va a un archivo que el taller acota.
 *  · los tornillos y los interlocks nacen como malla pura: su sólido lo da `MoldPart.brep()` (mold-plano-set.ts).
 *  · el agua (las líneas y el bore del baffle) es HUECO, no pieza: ya está barrenada dentro de los insertos y no se
 *    exporta como varilla maciza. Sí van sus componentes (tapones, O-rings, la lámina del baffle).
 * Un cuerpo por pieza física: un compound de la app (p. ej. «Postes guía (4)» = 8 cilindros, poste + collar) se parte
 * en sólidos y se funden los que comparten acero → 4 postes. Nombres de `TERMINOS_ISO` (mold-assembly.ts): los mismos
 * de la BOM.
 */
import type { MoldAssemblySpec } from './mold-assembly';
import { TERMINOS_ISO, type ClaveTermino } from './mold-assembly';
import { buildPlateSolid, plateStackZ, orejaDeSujecionMm, type MoldPart } from './mold-plano-set';
import { plateDefs, plateDepth, PILAR_SOPORTE_DIA_MM, returnPinLayout } from './mold-drawing-set';
import { guiaNominalMm } from './moldbase';
import { planInterlocks } from './mold-interlocks';

/* eslint-disable @typescript-eslint/no-explicit-any */
type K = any;
type Forma = any;

export interface CuerpoDelMolde {
  /** el nombre que va al STEP (español de la norma + medida + término inglés) */
  nombre: string;
  clave: ClaveTermino | null;
  /** el rol de la app del que salió (para compararlo contra su malla) */
  rol: string;
  forma: Forma;
  fuente: 'tessellate' | 'brep()' | 'placa nominal' | 'pieza del árbol';
}
export interface RenglonInventario {
  rol: string; nombre: string; tris: number;
  /** de dónde sale su B-Rep: la malla teselada · su brep() · la placa nominal de las láminas · ninguno */
  brep: 'tessellate' | 'brep()' | 'placa nominal' | 'pieza del árbol' | 'malla sola';
  /** cuántos cuerpos aporta al STEP (0 = no va) */
  alSTEP: number;
  porque?: string;
}

const cajaDe = (oc: any, sh: Forma): { min: number[]; max: number[] } => {
  const b = new oc.Bnd_Box_1();
  try { oc.BRepBndLib.AddOptimal(sh, b, false, false); } catch { oc.BRepBndLib.Add(sh, b, false); }
  const a = b.CornerMin(), c = b.CornerMax();
  const r = { min: [a.X(), a.Y(), a.Z()], max: [c.X(), c.Y(), c.Z()] };
  b.delete?.();
  return r;
};
export const cajaDeMalla = (P: ArrayLike<number>): { min: number[]; max: number[] } => {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < mn[k]) mn[k] = P[i + k]; if (P[i + k] > mx[k]) mx[k] = P[i + k]; }
  return { min: mn, max: mx };
};
/** volumen con signo de una malla cerrada (Σ a·(b×c)/6) — el mismo que pesa la huella del QA */
export const volumenDeMalla = (P: ArrayLike<number>, I: ArrayLike<number>): number => {
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v / 6;
};
const difCaja = (p: { min: number[]; max: number[] }, q: { min: number[]; max: number[] }) =>
  Math.max(...[0, 1, 2].flatMap((k) => [Math.abs(p.min[k] - q.min[k]), Math.abs(p.max[k] - q.max[k])]));
const unirCajas = (cs: Array<{ min: number[]; max: number[] }>) => ({
  min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c.min[k]))), max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c.max[k]))),
});
const f1 = (x: number) => +x.toFixed(1);
const f3 = (x: number) => +x.toFixed(3);
const nombreDe = (k: ClaveTermino, detalle = '') => { const t = TERMINOS_ISO[k]; return `${t.es}${detalle ? ` ${detalle}` : ''} (${t.en})`; };

/** Parte un compound en piezas FÍSICAS: sus sólidos, y los que comparten acero (∩ con volumen) se funden en uno. */
function piezasFisicas(Kn: K, oc: any, forma: Forma): Forma[] {
  const sol: Forma[] = Kn.solidsOf(oc, forma);
  if (sol.length <= 1) return sol.length ? sol : [forma];
  const caja = sol.map((s) => cajaDe(oc, s));
  const padre = sol.map((_, i) => i);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  for (let i = 0; i < sol.length; i++) for (let j = i + 1; j < sol.length; j++) {
    const a = caja[i], b = caja[j];
    let tocan = true;
    for (let k = 0; k < 3; k++) if (Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) <= 1e-6) tocan = false;
    if (!tocan) continue;
    let v = 0;
    try { v = Kn.volume(oc, Kn.common(oc, sol[i], sol[j])); } catch { v = 0; }
    if (v > 1e-3) padre[raiz(i)] = raiz(j);
  }
  const grupos = new Map<number, Forma[]>();
  sol.forEach((s, i) => { const r = raiz(i); if (!grupos.has(r)) grupos.set(r, []); grupos.get(r)!.push(s); });
  return [...grupos.values()].map((g) => (g.length === 1 ? g[0] : Kn.fuseAll(oc, g)));
}

/** Los roles de la app que son HUECO o contexto y no van al STEP, con su porqué. */
const FUERA: Array<[RegExp, string]> = [
  [/^agua-(A|B)-|^agua-a$|^agua-b$/, 'es el HUECO del agua (ya barrenado en el inserto/placa), no una pieza'],
  [/^particion$|^parting-line$/, 'lámina visual de 0.8 mm que marca la partición'],
  [/^platina-/, 'es la máquina, no el molde'],
];

export interface OpcionesCuerpos {
  spec: MoldAssemblySpec;
  partes: MoldPart[];
  /** la pieza moldeada como B-Rep YA colocada en la base (la pone quien llama: sólido del árbol + la colocación de la E3) */
  pieza?: Forma | null;
  /** la tabla de botadores (id, largo) en el orden de los pines de la E7 — la misma de la BOM */
  botadores?: Array<{ id: string; largoMm: number; puntaDiaMm?: number }>;
  /** tolerancia para aceptar el sólido de una malla: si su caja difiere más que esto de la malla, la malla se movió */
  tolCajaMm?: number;
}

/**
 * La lista de cuerpos B-Rep del molde, con nombre ISO, y el inventario de cada componente de la app (qué es B-Rep, qué
 * no, qué va al STEP y por qué). Lento lo justo: las placas se re-cortan (~1 s c/u en el navegador).
 */
export function cuerposDelMolde(Kn: K, oc: any, o: OpcionesCuerpos): { cuerpos: CuerpoDelMolde[]; inventario: RenglonInventario[] } {
  const tol = o.tolCajaMm ?? 1.0;
  const cuerpos: CuerpoDelMolde[] = [], inventario: RenglonInventario[] = [];
  const z = plateStackZ(o.spec), defs = plateDefs(o.spec), oreja = orejaDeSujecionMm(o.spec);
  const placa = (role: 'clamp' | 'A' | 'B' | 'support' | 'ejector' | 'ejector-ret' | 'bottom'): Forma | null => {
    const def = defs.find((d) => d.role === role);
    if (!def) return null;
    const ext = role === 'clamp' || role === 'bottom' ? oreja : 0;
    const { solid } = buildPlateSolid(Kn, oc, o.spec, def, 'full', ext, 0);
    return z[role] ? Kn.transformShape(oc, solid, { translate: [0, 0, z[role]] }) : solid;
  };
  const PLACAS: Record<string, { role: 'clamp' | 'A' | 'B' | 'support' | 'ejector' | 'ejector-ret' | 'bottom'; clave: ClaveTermino; detalle: string }> = {
    clamp: { role: 'clamp', clave: 'sujecion', detalle: 'superior' },
    'placa-a-ghost': { role: 'A', clave: 'placaA', detalle: '' }, A: { role: 'A', clave: 'placaA', detalle: '' },
    'placa-b-ghost': { role: 'B', clave: 'placaB', detalle: '' }, B: { role: 'B', clave: 'placaB', detalle: '' },
    support: { role: 'support', clave: 'soporte', detalle: '' },
    'ejector-ret': { role: 'ejector-ret', clave: 'retenedora', detalle: '' },
    ejector: { role: 'ejector', clave: 'expulsora', detalle: '' },
    bottom: { role: 'bottom', clave: 'sujecion', detalle: 'inferior' },
  };
  const mete = (rol: string, clave: ClaveTermino | null, detalle: string, forma: Forma, fuente: CuerpoDelMolde['fuente'], nombreLibre?: string) =>
    cuerpos.push({ rol, clave, forma, fuente, nombre: clave ? nombreDe(clave, detalle) : (nombreLibre ?? rol) });
  // el sólido de la malla, si salió de tessellate y la malla no se movió desde entonces
  const deMalla = (pt: MoldPart): { forma: Forma | null; porque?: string } => {
    const f = Kn.formaDeLaMalla?.(pt.positions) ?? null;
    if (!f) return { forma: null };
    try {
      const d = difCaja(cajaDe(oc, f), cajaDeMalla(pt.positions));
      return d <= tol ? { forma: f } : { forma: null, porque: `su sólido quedó ${f1(d)} mm lejos de la malla (la malla se movió después de teselar)` };
    } catch (e) { return { forma: null, porque: `sólido inservible (${String(e).slice(0, 60)})` }; }
  };
  const pines = new Map<number, { punta?: Forma; cuerpo?: Forma; fuente: CuerpoDelMolde['fuente'] }>();
  for (const pt of o.partes) {
    const tris = (pt.indices?.length ?? pt.positions.length / 3) / 3 | 0;
    const ren: RenglonInventario = { rol: pt.role, nombre: pt.name, tris, brep: 'malla sola', alSTEP: 0 };
    inventario.push(ren);
    const fuera = FUERA.find(([re]) => re.test(pt.role));
    // ── placas: nominales, del constructor de las láminas
    const pl = PLACAS[pt.role];
    if (pl) {
      const f = placa(pl.role);
      if (f) { mete(pt.role, pl.clave, pl.detalle, f, 'placa nominal'); ren.brep = 'placa nominal'; ren.alSTEP = 1; }
      else ren.porque = 'el spec no trae esa placa';
      continue;
    }
    const dm = deMalla(pt);
    const forma = dm.forma ?? (pt.brep ? (() => { try { return pt.brep!(); } catch { return null; } })() : null);
    ren.brep = dm.forma ? 'tessellate' : forma ? 'brep()' : (pt.role === 'pieza' && o.pieza ? 'pieza del árbol' : 'malla sola');
    const fuente: CuerpoDelMolde['fuente'] = dm.forma ? 'tessellate' : 'brep()';
    if (fuera) { ren.porque = fuera[1]; continue; }
    if (pt.role === 'pieza') {
      const fp = o.pieza ?? forma;
      if (fp) { mete('pieza', 'pieza', '', fp, o.pieza ? 'pieza del árbol' : fuente); ren.alSTEP = 1; }
      else ren.porque = 'sin el sólido de la pieza';
      continue;
    }
    if (!forma) { ren.porque = dm.porque ?? 'nace como malla y no trae su B-Rep'; continue; }
    const pin = /^pin-(punta|cuerpo)-(\d+)$/.exec(pt.role);
    if (pin) {
      const k = +pin[2]; const e = pines.get(k) ?? { fuente };
      if (pin[1] === 'punta') e.punta = forma; else e.cuerpo = forma;
      pines.set(k, e); ren.alSTEP = 1; ren.porque = 'punta + cuerpo = UN botador';
      continue;
    }
    const n0 = cuerpos.length;
    const r = pt.role;
    if (r === 'cavidad') mete(r, 'insertoCav', '', forma, fuente);
    else if (r === 'nucleo') mete(r, 'insertoNuc', '', forma, fuente);
    else if (r === 'colada') mete(r, 'colada', '', forma, fuente);
    else if (r === 'anillo') piezasFisicas(Kn, oc, forma).forEach((p) => { const c = cajaDe(oc, p); const d = c.max[0] - c.min[0];
      if (d > 60) mete(r, 'anillo', `D${f1(d)}`, p, fuente); else mete(r, 'bujeBebedero', `D${f1(d)}`, p, fuente); });
    else {
      const piezas = piezasFisicas(Kn, oc, forma);
      // la altura de la cabeza del perno (el largo NOMINAL de ISO 4762 se mide bajo la cabeza): de su ficha «⌀dk×k»
      const kCab = Number(/cabeza [^:]*: ⌀[\d.]+×([\d.]+)/.exec((pt.features ?? []).join(' '))?.[1] ?? 0);
      const CL: Record<string, ClaveTermino> = { guias: 'poste', bujes: 'buje', 'pilares-soporte': 'pilar', rieles: 'riel', 'pines-retorno': 'retorno',
        interlocks: 'interlock', 'tornillos-cav': 'tornillo', 'tornillos-core': 'tornillo', 'agua-baffle-lamina': 'baffle' };
      const clave: ClaveTermino | null = CL[r] ?? (/^agua-tapon-/.test(r) ? 'tapon' : /^agua-oring-/.test(r) ? 'oring' : null);
      piezas.forEach((p, i) => {
        const c = cajaDe(oc, p), dx = c.max[0] - c.min[0], dz = c.max[2] - c.min[2];
        // el Ø NOMINAL de la misma fuente que lo construyó (la caja del sólido trae el collar/la cabeza, no el nominal)
        const dNom = clave === 'poste' || clave === 'buje' ? guiaNominalMm(o.spec.widthMm) : clave === 'retorno' ? returnPinLayout(o.spec, plateDepth(o.spec)).diaMm
          : clave === 'interlock' ? (planInterlocks(o.spec).diaMm ?? f3(dx)) : f3(dx);
        const det = clave === 'pilar' ? `D${PILAR_SOPORTE_DIA_MM} x ${f1(dz)}` : clave === 'tornillo' ? `M${f1(Number(/M(\d+(?:\.\d+)?)/.exec(pt.name)?.[1] ?? NaN))} x ${f1(dz - kCab)}${r === 'tornillos-cav' ? ' lado fijo' : ' lado movil'}`
          : clave === 'poste' || clave === 'retorno' || clave === 'interlock' ? `D${dNom} x ${f1(dz)}` : clave === 'buje' ? `D${dNom}` : '';
        mete(r, clave, `${det}${piezas.length > 1 ? ` ${i + 1}/${piezas.length}` : ''}`.trim(), p, fuente, clave ? undefined : pt.name);
      });
    }
    ren.alSTEP = cuerpos.length - n0;
  }
  // los botadores: punta + cuerpo de la E7 = UN botador escalonado con su id (§11.2.6) — el mismo de la BOM
  for (const [k, e] of [...pines.entries()].sort((a, b) => a[0] - b[0])) {
    const partes = [e.cuerpo, e.punta].filter(Boolean) as Forma[];
    const f = partes.length === 2 ? Kn.fuse(oc, partes[0], partes[1]) : partes[0];
    const fila = o.botadores?.[k];
    const c = cajaDe(oc, f);
    const det = `${fila?.id ?? `EP-${String(k + 1).padStart(2, '0')}`} ${fila?.puntaDiaMm != null ? `D${fila.puntaDiaMm}/${o.spec.ejectors.diaMm}` : `D${o.spec.ejectors.diaMm}`} x ${fila?.largoMm ?? f1(c.max[2] - c.min[2])}`;
    mete(`pin-${k}`, e.punta && e.cuerpo ? 'botadorEsc' : 'botador', det, f, e.fuente);
  }
  return { cuerpos, inventario };
}

/* ── LA IDA Y VUELTA: el archivo se vuelve a LEER y se compara cuerpo por cuerpo ─────────────────────────────── */
export interface RenglonIdaVuelta {
  i: number; nombreEnviado: string; nombreLeido: string | null; nombreOk: boolean;
  volEnviado: number; volLeido: number; dVolRel: number;
  cajaLeida: number[]; dCajaMm: number; ok: boolean;
}
export interface RenglonContraLaApp {
  rol: string; cuerpos: number;
  volSTEP: number; volMalla: number; dVolPct: number;
  cajaSTEP: number[]; cajaMalla: number[]; dCajaMm: number;
  fuente: string; nota?: string;
}
/** TOLERANCIAS DECLARADAS. Archivo ↔ B-Rep enviado: el STEP guarda la geometría en texto; MEDIDO en la 1594C Box (corrida
 *  A, 2026-10-30): 69 de 72 cuerpos vuelven con Δvol < 1e-13 y Δcaja 0; los insertos 1e-10 y 1.2e-7 y la pieza del
 *  cliente (superficies libres) 1.7e-6. Se pide ≤ 1e-5 relativo en volumen y ≤ 1e-3 mm en caja. Archivo ↔ malla de la app: la malla es un
 *  poliedro INSCRITO de cuerda ≤ la flecha con que se teseló (0.03–0.95 mm según el cuerpo), así que la caja se pide
 *  ≤ 1.0 mm y el volumen se REPORTA (la malla siempre pesa un poco menos que el sólido curvo). */
export const TOL_IDA_VUELTA = { volRel: 1e-5, cajaMm: 1e-3, cajaAppMm: 1.0 };

export function idaYVuelta(Kn: K, oc: any, texto: string, enviados: CuerpoDelMolde[], nombres: string[], partes: MoldPart[]): { porCuerpo: RenglonIdaVuelta[]; contraLaApp: RenglonContraLaApp[]; leidos: number; ensamble: string | null; ok: boolean } {
  const v = Kn.importSTEPEnsamble(oc, texto) as { ensamble: string | null; cuerpos: Array<{ nombre: string; forma: Forma }> };
  const porCuerpo: RenglonIdaVuelta[] = enviados.map((c, i) => {
    const l = v.cuerpos[i];
    const vE = Kn.volume(oc, c.forma), vL = l ? Kn.volume(oc, l.forma) : NaN;
    const cE = cajaDe(oc, c.forma), cL = l ? cajaDe(oc, l.forma) : { min: [NaN, NaN, NaN], max: [NaN, NaN, NaN] };
    const dV = Math.abs(vL - vE) / Math.max(1e-9, Math.abs(vE)), dC = difCaja(cE, cL);
    const nombreOk = !!l && l.nombre === nombres[i];
    return { i, nombreEnviado: nombres[i], nombreLeido: l?.nombre ?? null, nombreOk, volEnviado: +vE.toFixed(3), volLeido: +vL.toFixed(3), dVolRel: dV, cajaLeida: [...cL.min, ...cL.max].map((x) => +x.toFixed(3)), dCajaMm: +dC.toFixed(6),
      ok: nombreOk && dV <= TOL_IDA_VUELTA.volRel && dC <= TOL_IDA_VUELTA.cajaMm };
  });
  // contra la app: por ROL, la unión de los cuerpos LEÍDOS de ese rol contra la malla que la app pinta
  const porRol = new Map<string, number[]>();
  enviados.forEach((c, i) => { const r = /^pin-\d+$/.test(c.rol) ? 'pin' : c.rol; if (!porRol.has(r)) porRol.set(r, []); porRol.get(r)!.push(i); });
  const contraLaApp: RenglonContraLaApp[] = [];
  for (const [rol, idx] of porRol) {
    const mallas = rol === 'pin' ? partes.filter((p) => /^pin-(punta|cuerpo)-\d+$/.test(p.role)) : partes.filter((p) => p.role === rol);
    if (!mallas.length) continue;
    const leidos = idx.map((i) => v.cuerpos[i]).filter(Boolean);
    const volSTEP = leidos.reduce((a, l) => a + Kn.volume(oc, l.forma), 0);
    const volMalla = mallas.reduce((a, m) => a + volumenDeMalla(m.positions, m.indices), 0);
    const cS = unirCajas(leidos.map((l) => cajaDe(oc, l.forma))), cM = unirCajas(mallas.map((m) => cajaDeMalla(m.positions)));
    contraLaApp.push({ rol, cuerpos: leidos.length, volSTEP: +volSTEP.toFixed(2), volMalla: +volMalla.toFixed(2), dVolPct: +(100 * (volMalla - volSTEP) / Math.max(1e-9, volSTEP)).toFixed(3),
      cajaSTEP: [...cS.min, ...cS.max].map((x) => +x.toFixed(2)), cajaMalla: [...cM.min, ...cM.max].map((x) => +x.toFixed(2)), dCajaMm: +difCaja(cS, cM).toFixed(3),
      fuente: enviados[idx[0]].fuente });
  }
  return { porCuerpo, contraLaApp, leidos: v.cuerpos.length, ensamble: v.ensamble, ok: v.cuerpos.length === enviados.length && porCuerpo.every((r) => r.ok) };
}
