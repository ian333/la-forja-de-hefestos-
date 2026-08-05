/**
 * ÍNDICE DE CONVERGENCIA DE MALLA (GCI) + RECIPROCIDAD DE MAXWELL-BETTI
 * =====================================================================
 * Cómo se le pone BARRA DE ERROR a un resultado de simulación.
 *
 * ASME V&V 20-2009 (fluidos/calor) y V&V 10 (sólidos) separan TRES cosas distintas:
 *   1. verificación de CÓDIGO    — ¿resuelve bien las ecuaciones? (soluciones manufacturadas)
 *   2. verificación de SOLUCIÓN  — ¿ESTA malla alcanza?           ← ESTO es el GCI
 *   3. validación                — ¿coincide con la realidad?     (experimento)
 * Este módulo cubre la 2 y, de regalo, un pedazo de la 1 (Betti).
 *
 * LA FUENTE (nada de aquí se inventa)
 * -----------------------------------
 * · Roache, P.J. (1994) "Perspective: A Method for Uniform Reporting of Grid Refinement
 *   Studies", J. Fluids Eng. 116(3):405-413 — define el GCI.
 * · Celik, Ghia, Roache & Freitas (2008) "Procedure for Estimation and Reporting of
 *   Uncertainty Due to Discretization in CFD Applications", J. Fluids Eng. 130:078001 —
 *   es el procedimiento editorial de la ASME y trae la forma IMPLÍCITA del orden p para
 *   razón de refinamiento NO uniforme (r21 != r32).
 * · NASA Glenn / WIND-US "Examining Spatial (Grid) Convergence" — el mismo juego de
 *   fórmulas con el chequeo de rango asintótico escrito explícito.
 *
 * LAS FÓRMULAS, LITERALES
 * -----------------------
 *   f1 = solución en la malla MÁS FINA, f2 la media, f3 la más gruesa.
 *   r21 = h2/h1 > 1,  r32 = h3/h2 > 1        (h = tamaño representativo de celda)
 *   e21 = f2 - f1,    e32 = f3 - f2          (DIFERENCIAS crudas, con signo)
 *
 *   orden observado, caso r21 = r32 = r:
 *       p = ln( e32 / e21 ) / ln(r)
 *   orden observado, caso GENERAL (Celik 2008, se resuelve por iteración de punto fijo):
 *       p = | ln|e32/e21| + q(p) | / ln(r21)
 *       q(p) = ln( (r21^p - s) / (r32^p - s) ),   s = sign(e32/e21)
 *       (con r21 = r32 se tiene q ≡ 0 y se recupera la forma cerrada)
 *
 *   error relativo aparente:   ea21 = | (f2 - f1) / f1 |
 *   GCI de la malla FINA:      GCI21 = Fs · ea21 / (r21^p - 1)
 *   GCI de la malla GRUESA:    GCI32 = Fs · ea21 · r21^p / (r21^p - 1)
 *   Fs = 1.25  para estudios de TRES o más mallas (Fs = 3.0 con sólo dos: Roache 1994)
 *
 *   extrapolación de Richardson (el valor al que tiende con h → 0):
 *       f_ext = (r21^p · f1 - f2) / (r21^p - 1)
 *
 *   RANGO ASINTÓTICO — sin esto el GCI NO ES VÁLIDO:
 *       GCI32 / ( r21^p · GCI21 ) ≈ 1
 *   donde GCI32 = Fs · |(f3-f2)/f2| / (r32^p - 1). Si eso no da ≈1, las tres mallas no
 *   están todavía en el régimen donde el error es una potencia limpia de h: se DECLARA,
 *   no se tapa.
 *
 *   El GCI se REPORTA como banda al 95 %: f1 ± GCI21·|f1|.
 *
 * LO QUE EL CHEQUEO ASINTÓTICO REALMENTE MIDE — medido aquí, no supuesto
 * ---------------------------------------------------------------------
 * Para una serie de POTENCIA PURA f(h) = fe + C·h^p, la razón asintótica sale
 * EXACTAMENTE |f1|/|f2| (se verifica a 1e-12 en `scripts/verif-gci-test.cjs`, A3):
 *     GCI32 = Fs·|C|·h2^p/|f2| ,  r21^p·GCI21 = Fs·|C|·h2^p/|f1|  ⇒  razón = |f1|/|f2|
 * O sea que el chequeo NO comprueba que la serie sea una potencia limpia: comprueba que
 * las dos mallas finas ya estén cerca entre sí (|f1/f2 − 1| ≈ error relativo aparente).
 * CONSECUENCIA DURA, y hay que decirla: con TRES mallas el ajuste f = fe + C·h^p tiene
 * tres datos y tres incógnitas ⇒ SIEMPRE cierra exacto. NINGÚN estudio de tres mallas
 * puede detectar que el error es de ORDEN MIXTO (p.ej. a·h + b·h³). El único detector
 * real es una CUARTA malla: `consistenciaOrden()` compara el p de dos tripletes que se
 * traslapan y si no coinciden, la serie no es una potencia única.
 *
 * LO QUE EL GCI *NO* PUEDE HACER (y este módulo lo declara en vez de fingir)
 * -------------------------------------------------------------------------
 * · CONVERGENCIA OSCILATORIA — si e32/e21 < 0 la solución no se acerca por un lado:
 *   el GCI clásico (que supone f(h) = f_exacto + C·h^p con C fijo) NO APLICA. Se declara.
 * · DIVERGENCIA — si |e32| <= |e21| entonces p <= 0: las diferencias CRECEN al refinar.
 *   Eso es lo que hace una SINGULARIDAD (esquina viva, carga puntual): no hay valor
 *   límite, no hay barra de error. Ponerle una sería mentir.
 * · CONVERGENCIA YA ALCANZADA — si las tres diferencias caen al ruido de redondeo, p no
 *   es identificable (0/0). El error de discretización está POR DEBAJO del ruido; se
 *   reporta esa cota y se dice que no es un GCI.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SEGUNDA PARTE: RECIPROCIDAD DE MAXWELL-BETTI — la verificación más barata que existe
 * ═══════════════════════════════════════════════════════════════════════════
 * En un sólido elástico LINEAL, el trabajo del sistema de cargas A a través de los
 * desplazamientos que produce B es IGUAL al de B a través de los de A:
 *
 *      W_AB = f_A · u_B  =  f_B · u_A = W_BA
 *
 * Es álgebra pura: u = K⁻¹f con K SIMÉTRICA ⇒ f_A·K⁻¹f_B = f_B·K⁻¹f_A. Por eso:
 *   · NO necesita solución exacta ni de referencia,
 *   · NO necesita refinar nada (se cumple en CUALQUIER malla, por burda que sea),
 *   · NO necesita geometría bonita.
 * Y por eso caza justo lo que el GCI no ve: matriz de rigidez ASIMÉTRICA, ensamble mal
 * hecho, cargas o condiciones de frontera mal aplicadas. Si K es simétrica y el solver
 * es exacto, el residuo relativo es 0 en aritmética exacta y del orden de la tolerancia
 * del solver iterativo en la práctica (eso es MEDIBLE: baja la tolerancia, baja el
 * residuo — si no baja, la asimetría es real).
 *
 * PURO: sin DOM, sin kernel, sin reloj, sin random. Sirve a CUALQUIER campo escalar
 * (esfuerzo, presión, temperatura, arrastre), no sólo a elasticidad.
 */

import type { Lamina } from '../mold/laminas-visuales';

const ESC = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ═══════════════════════════════════════════════════════════════════════════
// 1. CONSTANTES DE LA FUENTE
// ═══════════════════════════════════════════════════════════════════════════

/** Factor de seguridad de Roache (1994) para estudios de TRES o más mallas. */
export const FS_TRES_MALLAS = 1.25;
/** Factor de seguridad con SÓLO DOS mallas (Roache 1994): mucho más conservador. */
export const FS_DOS_MALLAS = 3.0;

/**
 * UMBRAL DECLARADO (no sale de la norma): la literatura sólo dice que la razón
 * asintótica debe ser "≈ 1". Aquí se fija 0.05 para el semáforo VERDE y 0.20 para el
 * ÁMBAR. Es una convención de ESTE repo y se imprime en la lámina como tal.
 */
export const TOL_ASINTOTICO_VERDE = 0.05;
export const TOL_ASINTOTICO_AMBAR = 0.20;
/** Por debajo de esto (relativo a la escala del campo) las diferencias son ruido. */
export const RUIDO_REL_DEFECTO = 1e-11;

// ═══════════════════════════════════════════════════════════════════════════
// 2. GCI
// ═══════════════════════════════════════════════════════════════════════════

export type Regimen =
  | 'monotona'      // e32/e21 > 1: converge por un lado, p > 0 → el GCI vale
  | 'oscilatoria'   // e32/e21 < 0: el GCI clásico NO aplica
  | 'divergente'    // 0 < e32/e21 <= 1 ⇒ p <= 0: las diferencias CRECEN al refinar
  | 'convergida'    // diferencias al nivel del ruido: p no identificable
  | 'indeterminada';// la serie no es una potencia de h (o e21 = 0 con e32 != 0)

export type Semaforo = 'verde' | 'ambar' | 'rojo';

export interface OpcionesGCI {
  /** factor de seguridad. 1.25 con tres mallas (defecto), 3.0 con dos. */
  Fs?: number;
  /** |asintótico − 1| máximo para declarar RANGO ASINTÓTICO. Defecto TOL_ASINTOTICO_VERDE. */
  tolAsintotico?: number;
  /** |asintótico − 1| máximo para el semáforo ÁMBAR. Defecto TOL_ASINTOTICO_AMBAR. */
  tolAsintoticoAmbar?: number;
  /** diferencias por debajo de esto × escala del campo = ruido de redondeo. */
  ruidoRel?: number;
  /** iteraciones de punto fijo para la forma implícita de p. */
  maxIter?: number;
  /** tolerancia de la iteración de p. */
  tolIter?: number;
  /** orden TEÓRICO del esquema, sólo informativo (se imprime al lado del observado). */
  pTeorico?: number;
}

export interface ResultadoGCI {
  f1: number; f2: number; f3: number;
  r21: number; r32: number;
  Fs: number;
  /** orden OBSERVADO de convergencia. null si no es identificable. */
  p: number | null;
  pMetodo: 'directa' | 'implicita-celik' | 'directa-indicativa' | 'no-identificable';
  /** diferencias crudas CON SIGNO */
  e21: number; e32: number;
  /** razón e32/e21 — el discriminador del régimen */
  razon: number | null;
  /** error relativo aparente |(f2−f1)/f1| */
  eRel21: number | null;
  /** GCI de la malla FINA, como FRACCIÓN (0.05 = 5 %) */
  gciFino: number | null;
  /** GCI de la malla GRUESA, como fracción */
  gciGrueso: number | null;
  /** GCI del par 3-2, como fracción (entra en el chequeo asintótico) */
  gci32: number | null;
  /** GCI32 / (r21^p · GCI21) — debe dar ≈ 1 */
  asintotico: number | null;
  enRangoAsintotico: boolean;
  semaforo: Semaforo;
  /** banda al 95 % alrededor de f1. null cuando NO hay barra de error defendible. */
  banda95: [number, number] | null;
  /** valor extrapolado de Richardson (h → 0) */
  fExtrapolado: number | null;
  /** |(f_ext − f1)/f_ext| */
  errorExtrapoladoRel: number | null;
  /** HECHO, no estimador: [min, max] de las tres soluciones */
  rangoObservado: [number, number];
  /** cota por RUIDO (Fs · max|e| / |f1|). NO es un GCI; sólo se llena en 'convergida'. */
  cotaRuido: number | null;
  regimen: Regimen;
  /** qué se puede afirmar y qué no, en una frase */
  nota: string;
}

const finito = (x: number) => Number.isFinite(x);

/**
 * EL ESTIMADOR. f1 = malla MÁS FINA. `r` = razón de refinamiento h2/h1 (= h3/h2), o
 * `{r21, r32}` si el refinamiento NO es uniforme. Ambas deben ser > 1.
 */
export function gci(
  f1: number, f2: number, f3: number,
  r: number | { r21: number; r32: number },
  o: OpcionesGCI = {},
): ResultadoGCI {
  const Fs = o.Fs ?? FS_TRES_MALLAS;
  const tolA = o.tolAsintotico ?? TOL_ASINTOTICO_VERDE;
  const tolAmbar = o.tolAsintoticoAmbar ?? TOL_ASINTOTICO_AMBAR;
  const ruidoRel = o.ruidoRel ?? RUIDO_REL_DEFECTO;
  const maxIter = o.maxIter ?? 200;
  const tolIter = o.tolIter ?? 1e-13;

  const r21 = typeof r === 'number' ? r : r.r21;
  const r32 = typeof r === 'number' ? r : r.r32;
  if (!finito(f1) || !finito(f2) || !finito(f3)) throw new Error('gci: f1/f2/f3 deben ser finitos');
  if (!(r21 > 1) || !(r32 > 1)) {
    throw new Error(`gci: la razón de refinamiento debe ser > 1 (r21=${r21}, r32=${r32}); f1 es la malla MÁS FINA`);
  }

  const e21 = f2 - f1, e32 = f3 - f2;
  const escala = Math.max(Math.abs(f1), Math.abs(f2), Math.abs(f3)) || 1;
  const rangoObservado: [number, number] = [Math.min(f1, f2, f3), Math.max(f1, f2, f3)];

  const base = {
    f1, f2, f3, r21, r32, Fs,
    e21, e32, rangoObservado,
    p: null as number | null, pMetodo: 'no-identificable' as ResultadoGCI['pMetodo'],
    razon: null as number | null, eRel21: null as number | null,
    gciFino: null as number | null, gciGrueso: null as number | null, gci32: null as number | null,
    asintotico: null as number | null, enRangoAsintotico: false, semaforo: 'rojo' as Semaforo,
    banda95: null as [number, number] | null,
    fExtrapolado: null as number | null, errorExtrapoladoRel: null as number | null,
    cotaRuido: null as number | null,
  };

  // ── CASO 1: ya convergido — las diferencias son ruido de redondeo ⇒ p es 0/0.
  const ruido = ruidoRel * escala;
  if (Math.abs(e21) <= ruido && Math.abs(e32) <= ruido) {
    const cota = (Fs * Math.max(Math.abs(e21), Math.abs(e32))) / Math.max(Math.abs(f1), 1e-300);
    return {
      ...base, regimen: 'convergida', cotaRuido: cota,
      nota: `CONVERGIDA: |e21| = ${Math.abs(e21).toExponential(2)} y |e32| = ${Math.abs(e32).toExponential(2)} `
        + `están por debajo del ruido declarado (${ruidoRel.toExponential(0)} × ${escala.toExponential(3)}). `
        + `El orden p NO es identificable (0/0) y el GCI no se calcula: el error de discretización está por `
        + `DEBAJO de ${(100 * cota).toExponential(2)} % — esa cota NO es un GCI, es el ruido × Fs.`,
    };
  }
  // ── CASO 2: e21 = 0 con e32 != 0 ⇒ la razón revienta.
  if (e21 === 0) {
    return {
      ...base, regimen: 'indeterminada',
      nota: 'INDETERMINADA: f2 − f1 = 0 exacto pero f3 − f2 != 0 — la serie no es una potencia de h; sin orden, sin banda.',
    };
  }

  const razon = e32 / e21;
  // ── CASO 3: convergencia OSCILATORIA.
  if (razon < 0) {
    return {
      ...base, razon, regimen: 'oscilatoria',
      nota: `OSCILATORIA: e32/e21 = ${razon.toFixed(4)} < 0 — la solución no se acerca por un lado, así que `
        + `f(h) = f_exacto + C·h^p con C fijo NO describe la serie y el GCI clásico NO APLICA. `
        + `Hecho medido: las tres soluciones caen en [${rangoObservado[0].toPrecision(6)}, ${rangoObservado[1].toPrecision(6)}] — `
        + `eso es un RANGO OBSERVADO, no una barra de error al 95 %.`,
    };
  }

  // ── orden observado
  const p0 = Math.log(Math.abs(razon)) / Math.log(r21);
  const mismoR = Math.abs(Math.log(r32 / r21)) < 1e-12;

  // ── CASO 4: DIVERGENCIA. La razón e32/e21 en función de p vale
  //      razon(p) = r21^p · (r32^p − 1)/(r21^p − 1)
  //    y es MONÓTONA CRECIENTE en p, con razon(0) = ln(r32)/ln(r21) (el límite 0/0).
  //    Así que p <= 0 ⟺ |razon| <= ln(r32)/ln(r21). Se clasifica AQUÍ, ANTES de intentar
  //    la iteración implícita: esa iteración es de Celik para p > 0 y con p < 0 no tiene
  //    por qué converger — declarar "indeterminada" cuando la verdad medible es
  //    "DIVERGENTE" sería tapar el diagnóstico.
  const razonEnCero = Math.log(r32) / Math.log(r21);
  if (Math.abs(razon) <= razonEnCero) {
    return {
      ...base, razon, p: p0, pMetodo: mismoR ? 'directa' : 'directa-indicativa', regimen: 'divergente',
      nota: `DIVERGENTE: |e32/e21| = ${Math.abs(razon).toFixed(4)} <= ${razonEnCero.toFixed(4)} = ln(r32)/ln(r21), `
        + `que es el valor de la razón cuando p = 0 ⇒ p = ${p0.toFixed(4)} <= 0. Las diferencias CRECEN al refinar: `
        + `la serie NO tiende a un valor límite. Es la firma de una SINGULARIDAD (esquina viva, carga puntual, `
        + `apoyo de un solo nodo). NO hay barra de error: el GCI clásico daría r21^p − 1 < 0, o sea un "intervalo" `
        + `negativo. Se reporta el rango observado [${rangoObservado[0].toPrecision(6)}, ${rangoObservado[1].toPrecision(6)}] `
        + `y se DECLARA que no converge.`,
    };
  }

  let p = p0;
  let pMetodo: ResultadoGCI['pMetodo'] = 'directa';
  if (!mismoR) {
    const s = Math.sign(razon);   // +1 monótona, −1 oscilatoria (aquí siempre +1)
    const lnR = Math.log(Math.abs(razon));
    const lnr21 = Math.log(r21);
    let pk = p0 > 0.05 ? p0 : 2;   // arranque de Celik cuando el directo no sirve
    let ok = false;
    for (let k = 0; k < maxIter; k++) {
      const a = Math.pow(r21, pk) - s, b = Math.pow(r32, pk) - s;
      if (!(a > 0) || !(b > 0)) { ok = false; break; }
      const q = Math.log(a / b);
      const pn = Math.abs(lnR + q) / lnr21;
      if (!finito(pn)) { ok = false; break; }
      const d = Math.abs(pn - pk);
      pk = pn;
      if (d < tolIter) { ok = true; break; }
      ok = true;   // se acepta si no reventó; el chequeo duro es el residuo de abajo
    }
    if (ok && finito(pk) && pk > 0) {
      // CHEQUEO DURO: ¿ese p reproduce la razón medida? (r21^p·(r32^p−s)/(r21^p−s))
      const pred = Math.pow(r21, pk) * (Math.pow(r32, pk) - s) / (Math.pow(r21, pk) - s);
      if (Math.abs(pred - Math.abs(razon)) / Math.abs(razon) < 1e-6) { p = pk; pMetodo = 'implicita-celik'; }
      else {
        return {
          ...base, razon, regimen: 'indeterminada',
          nota: `INDETERMINADA: con r21 = ${r21} != r32 = ${r32} la ecuación implícita de Celik (2008) converge a `
            + `p = ${pk.toFixed(4)}, pero ese p NO reproduce la razón medida (predice ${pred.toFixed(6)} vs `
            + `${Math.abs(razon).toFixed(6)}). La serie no es una potencia de h: sin orden, sin banda.`,
        };
      }
    } else {
      return {
        ...base, razon, p: p0, regimen: 'indeterminada',
        nota: `INDETERMINADA: con r21 = ${r21} != r32 = ${r32} la iteración implícita de Celik (2008) no converge `
          + `(arranque p = ${p0.toFixed(4)}). Sin orden identificable no hay banda de error.`,
      };
    }
  }

  // ── el estimador, con todo en regla (p > 0 garantizado por el filtro de divergencia)
  const rp21 = Math.pow(r21, p), rp32 = Math.pow(r32, p);
  const den = Math.abs(f1) > 0 ? Math.abs(f1) : escala;
  const den2 = Math.abs(f2) > 0 ? Math.abs(f2) : escala;
  const eRel21 = Math.abs(e21) / den;
  const eRel32 = Math.abs(e32) / den2;
  const gciFino = (Fs * eRel21) / (rp21 - 1);
  const gciGrueso = (Fs * eRel21 * rp21) / (rp21 - 1);
  const g32 = (Fs * eRel32) / (rp32 - 1);
  const asintotico = g32 / (rp21 * gciFino);
  const fExtrapolado = (rp21 * f1 - f2) / (rp21 - 1);
  const errorExtrapoladoRel = Math.abs(fExtrapolado) > 0
    ? Math.abs((fExtrapolado - f1) / fExtrapolado) : null;
  const desvio = Math.abs(asintotico - 1);
  const enRango = finito(asintotico) && desvio <= tolA;
  const semaforo: Semaforo = enRango ? 'verde' : desvio <= tolAmbar ? 'ambar' : 'rojo';
  const banda95: [number, number] = [f1 - gciFino * Math.abs(f1), f1 + gciFino * Math.abs(f1)];

  const nota = enRango
    ? `EN RANGO ASINTÓTICO (razón ${asintotico.toFixed(4)}, |Δ| ${(100 * desvio).toFixed(2)} % <= ${(100 * tolA).toFixed(0)} % declarado): `
      + `la banda al 95 % es válida — f1 = ${f1.toPrecision(6)} ± ${(gciFino * Math.abs(f1)).toPrecision(4)} (${(100 * gciFino).toFixed(2)} %).`
    : `FUERA DEL RANGO ASINTÓTICO: la razón GCI32/(r21^p·GCI21) da ${asintotico.toFixed(4)} y debería dar ≈1 `
      + `(|Δ| ${(100 * desvio).toFixed(2)} % > ${(100 * tolA).toFixed(0)} % declarado). Las tres mallas todavía NO están en el régimen `
      + `de potencia limpia de h, así que la banda ±${(100 * gciFino).toFixed(2)} % es INDICATIVA, no una garantía al 95 %. `
      + `Se declara: hace falta refinar más (o refinar DONDE vive el máximo).`;

  return {
    ...base, razon, p, pMetodo, eRel21,
    gciFino, gciGrueso, gci32: g32, asintotico, enRangoAsintotico: enRango, semaforo,
    banda95, fExtrapolado, errorExtrapoladoRel, regimen: 'monotona', nota,
  };
}

/**
 * Igual que `gci` pero con los TAMAÑOS de malla en vez de las razones: `hs` en el mismo
 * orden que `fs` (fino → grueso). Evita el error #1 del estudio de convergencia:
 * meter r al revés.
 */
export function gciDeMallas(
  fs: [number, number, number], hs: [number, number, number], o: OpcionesGCI = {},
): ResultadoGCI {
  const [h1, h2, h3] = hs;
  if (!(h1 < h2 && h2 < h3)) {
    throw new Error(`gciDeMallas: se esperaba h1 < h2 < h3 (fino → grueso), llegó ${h1}, ${h2}, ${h3}`);
  }
  return gci(fs[0], fs[1], fs[2], { r21: h2 / h1, r32: h3 / h2 }, o);
}

export interface ConsistenciaOrden {
  /** un GCI por cada triplete consecutivo (fino→grueso) */
  tripletes: ResultadoGCI[];
  /** los p observados de cada triplete (null donde no es identificable) */
  ps: Array<number | null>;
  /** dispersión relativa de p: (max−min)/max|p|. null si algún triplete no da p. */
  dispersionP: number | null;
  /** true si todos los tripletes dan el MISMO p dentro de `tolP` */
  consistente: boolean;
  tolP: number;
  nota: string;
}

/**
 * EL DETECTOR DE ORDEN MIXTO — necesita CUATRO mallas o más.
 * Con tres mallas el ajuste f = f_exacto + C·h^p tiene tres datos y tres incógnitas:
 * SIEMPRE cierra, así que un p "bonito" no prueba nada. Con una cuarta malla hay dos
 * tripletes que se traslapan; si el error fuera una potencia única, los dos tendrían que
 * dar EL MISMO p. Si no coinciden, el error es de orden mixto (o hay ruido) y la banda
 * del GCI no es de fiar aunque el chequeo asintótico salga verde.
 * `fs` y `hs` van de FINO a GRUESO.
 */
export function consistenciaOrden(
  fs: number[], hs: number[], o: OpcionesGCI & { tolP?: number } = {},
): ConsistenciaOrden {
  if (fs.length !== hs.length) throw new Error('consistenciaOrden: fs y hs deben tener el mismo largo');
  if (fs.length < 4) throw new Error(`consistenciaOrden: hacen falta AL MENOS 4 mallas (llegaron ${fs.length}) — con 3 el ajuste de potencia siempre cierra`);
  for (let i = 1; i < hs.length; i++) {
    if (!(hs[i] > hs[i - 1])) throw new Error(`consistenciaOrden: se esperaba h creciente (fino → grueso), llegó ${hs.join(', ')}`);
  }
  const tolP = o.tolP ?? 0.15;
  const tripletes: ResultadoGCI[] = [];
  for (let i = 0; i + 2 < fs.length; i++) {
    tripletes.push(gciDeMallas([fs[i], fs[i + 1], fs[i + 2]], [hs[i], hs[i + 1], hs[i + 2]], o));
  }
  const ps = tripletes.map((t) => t.p);
  const validos = ps.filter((x): x is number => x != null && finito(x));
  if (validos.length !== ps.length || validos.length < 2) {
    return {
      tripletes, ps, dispersionP: null, consistente: false, tolP,
      nota: `NO CONSISTENTE: ${ps.length - validos.length} de ${ps.length} tripletes no dan orden identificable `
        + `(${tripletes.map((t) => t.regimen).join(', ')}). Sin dos p comparables no se puede afirmar que el error sea una potencia única.`,
    };
  }
  const pMin = Math.min(...validos), pMax = Math.max(...validos);
  const dispersionP = (pMax - pMin) / Math.max(Math.abs(pMax), Math.abs(pMin), 1e-12);
  const consistente = dispersionP <= tolP;
  return {
    tripletes, ps, dispersionP, consistente, tolP,
    nota: consistente
      ? `CONSISTENTE: los ${ps.length} tripletes dan p = ${validos.map((x) => x.toFixed(4)).join(', ')} — dispersión `
        + `${(100 * dispersionP).toFixed(2)} % <= ${(100 * tolP).toFixed(0)} %. El error se comporta como UNA potencia de h.`
      : `ORDEN MIXTO O RUIDO: los tripletes dan p = ${validos.map((x) => x.toFixed(4)).join(', ')} — dispersión `
        + `${(100 * dispersionP).toFixed(2)} % > ${(100 * tolP).toFixed(0)} %. El error NO es una potencia única de h, así que `
        + `la banda del GCI no es de fiar aunque el chequeo asintótico salga verde (ese chequeo sólo mira |f1|/|f2|).`,
  };
}

/**
 * TAMAÑO REPRESENTATIVO DE CELDA (Celik 2008 §2, ec. 1): h = [ (1/N) Σ ΔV_i ]^(1/D).
 * Para malla uniforme se reduce al lado del elemento. `dim` = 1, 2 o 3.
 */
export function hRepresentativo(medidaTotal: number, nCeldas: number, dim: 1 | 2 | 3): number {
  if (!(nCeldas > 0)) throw new Error('hRepresentativo: nCeldas debe ser > 0');
  return Math.pow(medidaTotal / nCeldas, 1 / dim);
}

/** Extrapolación de Richardson con p conocido: el valor al que tiende la serie con h → 0. */
export function richardson(f1: number, f2: number, r: number, p: number): number {
  const rp = Math.pow(r, p);
  return (rp * f1 - f2) / (rp - 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. RECIPROCIDAD DE MAXWELL-BETTI
// ═══════════════════════════════════════════════════════════════════════════

export interface SistemaCarga {
  /** vector de cargas nodales CONSISTENTES, un valor por GDL */
  f: ArrayLike<number>;
  /** desplazamientos que ESE sistema produce, un valor por GDL */
  u: ArrayLike<number>;
  nombre?: string;
}

export interface ResiduoBetti {
  wAB: number; wBA: number;
  /** |W_AB − W_BA| / max(|W_AB|, |W_BA|) */
  residuo: number;
  tol: number;
  pasa: boolean;
  n: number;
  nombreA: string; nombreB: string;
  nota: string;
}

/** Producto de trabajo f·u (un escalar con unidades de energía por unidad de espesor). */
export function trabajo(f: ArrayLike<number>, u: ArrayLike<number>): number {
  if (f.length !== u.length) throw new Error(`trabajo: longitudes distintas (${f.length} vs ${u.length})`);
  // suma de Kahan: el residuo de Betti se mide contra el redondeo, así que la suma no
  // puede ser la que meta el error.
  let s = 0, c = 0;
  for (let i = 0; i < f.length; i++) {
    const y = f[i] * u[i] - c;
    const t = s + y;
    c = t - s - y;
    s = t;
  }
  return s;
}

/**
 * EL CHECK DE RECIPROCIDAD. Dos sistemas de carga sobre la MISMA malla, la MISMA
 * geometría y las MISMAS condiciones de frontera (homogéneas): W_AB debe ser igual a
 * W_BA. Si no lo es, la culpa está en K (asimétrica / mal ensamblada) o en cómo se
 * aplicaron las cargas o los apoyos.
 *
 * Con Dirichlet HOMOGÉNEO (u = 0 en los GDL fijos) las reacciones no contribuyen al
 * producto y basta sumar sobre TODOS los GDL. Con Dirichlet no homogéneo hay que pasar
 * los vectores restringidos a los GDL LIBRES (o incluir las reacciones), y este módulo
 * no lo adivina: lo declara aquí.
 */
export function bettiResiduo(A: SistemaCarga, B: SistemaCarga, o: { tol?: number } = {}): ResiduoBetti {
  const tol = o.tol ?? 1e-10;
  const n = A.f.length;
  if (B.f.length !== n || A.u.length !== n || B.u.length !== n) {
    throw new Error(`bettiResiduo: los 4 vectores deben tener el mismo largo (${A.f.length}, ${A.u.length}, ${B.f.length}, ${B.u.length})`);
  }
  const wAB = trabajo(A.f, B.u);
  const wBA = trabajo(B.f, A.u);
  const esc = Math.max(Math.abs(wAB), Math.abs(wBA));
  const residuo = esc > 0 ? Math.abs(wAB - wBA) / esc : Math.abs(wAB - wBA);
  const nombreA = A.nombre ?? 'A', nombreB = B.nombre ?? 'B';
  const pasa = residuo <= tol;
  return {
    wAB, wBA, residuo, tol, pasa, n, nombreA, nombreB,
    nota: pasa
      ? `RECIPROCIDAD OK: W_${nombreA}${nombreB} = ${wAB.toPrecision(12)} vs W_${nombreB}${nombreA} = ${wBA.toPrecision(12)} `
        + `⇒ residuo ${residuo.toExponential(3)} <= ${tol.toExponential(0)}. La matriz de rigidez es simétrica, el `
        + `ensamble es consistente y las cargas/apoyos están aplicados igual en los dos sistemas.`
      : `RECIPROCIDAD ROTA: W_${nombreA}${nombreB} = ${wAB.toPrecision(12)} != W_${nombreB}${nombreA} = ${wBA.toPrecision(12)} `
        + `⇒ residuo ${residuo.toExponential(3)} > ${tol.toExponential(0)}. Maxwell-Betti se cumple en CUALQUIER malla `
        + `y CUALQUIER geometría, así que esto NO es error de discretización: es K asimétrica, ensamble mal hecho o `
        + `condiciones de frontera aplicadas distinto entre los dos sistemas.`,
  };
}

/** Residuo de simetría de una matriz densa: max|Kij − Kji| / max|Kij|. El diagnóstico directo. */
export function residuoSimetria(K: number[][] | Float64Array[], n = K.length): number {
  let maxDif = 0, maxAbs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = K[i][j], b = K[j][i];
      if (Math.abs(a) > maxAbs) maxAbs = Math.abs(a);
      const d = Math.abs(a - b);
      if (d > maxDif) maxDif = d;
    }
  }
  return maxAbs > 0 ? maxDif / maxAbs : maxDif;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. LA LÁMINA — el resultado CON su barra de error, de un golpe
// ═══════════════════════════════════════════════════════════════════════════

const CSS_GCI = `
  .bg{fill:#0b0f16}
  .tit{fill:#e9eef5;font:700 19px 'JetBrains Mono',monospace}
  .sub{fill:#8fa3bd;font:400 12px 'JetBrains Mono',monospace}
  .cita{fill:#c9a227;font:700 12px 'JetBrains Mono',monospace}
  .lbl{fill:#c3d0e0;font:400 11.5px 'JetBrains Mono',monospace}
  .lblSm{fill:#8fa3bd;font:400 10px 'JetBrains Mono',monospace}
  .num{fill:#e9eef5;font:700 12.5px 'JetBrains Mono',monospace}
  .big{fill:#e9eef5;font:700 22px 'JetBrains Mono',monospace}
  .ok{fill:#59d98c} .mal{fill:#ff5c5c} .warn{fill:#ffb347}
`;
const COL: Record<Semaforo, string> = { verde: '#59d98c', ambar: '#ffb347', rojo: '#ff5c5c' };

export interface SerieMalla {
  etiqueta: string;
  /** tamaño representativo de celda */
  h: number;
  /** nº de elementos (informativo) */
  n?: number;
  /** el valor del funcional en esa malla */
  f: number;
}

export interface PanelGCI {
  titulo: string;
  unidad: string;
  /** fino → grueso */
  series: [SerieMalla, SerieMalla, SerieMalla];
  res: ResultadoGCI;
}

/** Corta un texto en líneas de ~n caracteres (sin partir palabras). */
function envuelve(s: string, n: number): string[] {
  const w = s.split(' '), out: string[] = [];
  let cur = '';
  for (const x of w) {
    if ((cur + ' ' + x).trim().length > n) { out.push(cur.trim()); cur = '  ' + x; }
    else cur += ' ' + x;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const fmt = (v: number | null, d = 3): string => (v == null || !finito(v) ? '—' : v.toFixed(d));
const pct = (v: number | null, d = 2): string => (v == null || !finito(v) ? '—' : (100 * v).toFixed(d) + ' %');

/**
 * Dibuja un panel f(h): los tres puntos, la curva de potencia ajustada, la
 * extrapolación de Richardson en h = 0 y la BARRA DE ERROR al 95 % sobre la malla fina.
 * Cuando no hay banda (oscilatoria / divergente / indeterminada), lo dice y dibuja la
 * flecha de hacia dónde se va la serie.
 */
function panelPlot(P: PanelGCI, x0: number, y0: number, w: number, h: number): string {
  const { res, series } = P;
  const hs = series.map((s) => s.h), fsv = series.map((s) => s.f);
  const hMax = Math.max(...hs) * 1.12;
  const sinBanda = !(res.banda95 && res.fExtrapolado != null);
  const vals = [...fsv];
  if (res.banda95) vals.push(res.banda95[0], res.banda95[1]);
  if (res.fExtrapolado != null && finito(res.fExtrapolado)) vals.push(res.fExtrapolado);
  let vMin = Math.min(...vals), vMax = Math.max(...vals);
  const rango0 = vMax - vMin || Math.max(1e-9, Math.abs(vMax));
  // sin banda se dibuja la FLECHA de fuga: hay que dejarle aire del lado al que se va
  const sube = fsv[0] > fsv[2];
  if (sinBanda) { if (sube) vMax += rango0 * 0.26; else vMin -= rango0 * 0.26; }
  const pad = (vMax - vMin) * 0.12;
  vMin -= pad; vMax += pad;
  const PX = (hh: number) => x0 + 52 + ((w - 68) * hh) / hMax;
  const PY = (v: number) => y0 + h - 30 - ((h - 30) * (v - vMin)) / (vMax - vMin);

  const out: string[] = [];
  // TÍTULO ARRIBA del marco (adentro chocaba con la etiqueta del eje)
  out.push(`<text class="lblSm" x="${x0}" y="${(y0 - 6).toFixed(1)}">${ESC(P.titulo)} [${ESC(P.unidad)}]</text>`);
  // marco + rejilla
  out.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#101725" stroke="#26344a" stroke-width="1"/>`);
  for (let i = 0; i <= 4; i++) {
    const v = vMin + ((vMax - vMin) * i) / 4;
    out.push(`<line x1="${PX(0).toFixed(1)}" y1="${PY(v).toFixed(1)}" x2="${PX(hMax).toFixed(1)}" y2="${PY(v).toFixed(1)}" stroke="#1e2a3d" stroke-width="0.8"/>`);
    out.push(`<text class="lblSm" text-anchor="end" x="${(x0 + 48).toFixed(1)}" y="${(PY(v) + 3.5).toFixed(1)}">${v.toPrecision(4)}</text>`);
  }
  out.push(`<line x1="${PX(0).toFixed(1)}" y1="${(y0 + h - 30).toFixed(1)}" x2="${PX(hMax).toFixed(1)}" y2="${(y0 + h - 30).toFixed(1)}" stroke="#46566e" stroke-width="1"/>`);
  out.push(`<text class="lblSm" text-anchor="middle" x="${PX(0).toFixed(1)}" y="${(y0 + h - 16).toFixed(1)}">h=0</text>`);
  for (const s of series) {
    out.push(`<text class="lblSm" text-anchor="middle" x="${PX(s.h).toFixed(1)}" y="${(y0 + h - 16).toFixed(1)}">${s.h.toFixed(2)}</text>`);
  }
  out.push(`<text class="lblSm" text-anchor="end" x="${(x0 + w - 6).toFixed(1)}" y="${(y0 + h - 4).toFixed(1)}">h [tamaño de celda] →  grueso</text>`);

  // banda 95 % (franja) + extrapolación
  if (res.banda95 && res.fExtrapolado != null) {
    const [lo, hi] = res.banda95;
    out.push(`<rect x="${PX(0).toFixed(1)}" y="${PY(hi).toFixed(1)}" width="${(PX(hMax) - PX(0)).toFixed(1)}" height="${Math.abs(PY(lo) - PY(hi)).toFixed(1)}" fill="${COL[res.semaforo]}" opacity="0.17"/>`);
    out.push(`<line x1="${PX(0).toFixed(1)}" y1="${PY(res.fExtrapolado).toFixed(1)}" x2="${PX(hMax).toFixed(1)}" y2="${PY(res.fExtrapolado).toFixed(1)}" stroke="#6db3f2" stroke-width="1.2" stroke-dasharray="6 4"/>`);
    out.push(`<text class="lblSm" style="fill:#6db3f2" x="${(PX(hMax) - 4).toFixed(1)}" text-anchor="end" y="${(PY(res.fExtrapolado) - 5).toFixed(1)}">Richardson h→0 = ${res.fExtrapolado.toPrecision(5)}</text>`);
    // curva de potencia f(h) = f_ext + C h^p
    if (res.p != null) {
      const C = (fsv[0] - res.fExtrapolado) / Math.pow(hs[0], res.p);
      const pts: string[] = [];
      for (let i = 0; i <= 60; i++) {
        const hh = (hMax * i) / 60;
        pts.push(`${PX(hh).toFixed(1)},${PY(res.fExtrapolado + C * Math.pow(hh, res.p)).toFixed(1)}`);
      }
      out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#c9a227" stroke-width="1.4" opacity="0.85"/>`);
    }
  } else {
    // sin banda: se dibuja la línea que une los puntos y una flecha con el sentido de fuga
    out.push(`<polyline points="${series.map((s) => `${PX(s.h).toFixed(1)},${PY(s.f).toFixed(1)}`).join(' ')}" fill="none" stroke="#ff5c5c" stroke-width="1.4" stroke-dasharray="5 3"/>`);
    const xf = PX(hs[0] * 0.22), yf = PY(fsv[0] + (sube ? 1 : -1) * (vMax - vMin) * 0.19);
    out.push(`<line x1="${PX(hs[0]).toFixed(1)}" y1="${PY(fsv[0]).toFixed(1)}" x2="${xf.toFixed(1)}" y2="${yf.toFixed(1)}" stroke="#ff5c5c" stroke-width="1.6"/>`);
    out.push(`<polygon points="${xf.toFixed(1)},${yf.toFixed(1)} ${(xf + 6).toFixed(1)},${(yf + (sube ? 9 : -9)).toFixed(1)} ${(xf - 6).toFixed(1)},${(yf + (sube ? 9 : -9)).toFixed(1)}" fill="#ff5c5c"/>`);
    // el rótulo va SIEMPRE al pie del panel: pegado a la flecha se encimaba con el título
    out.push(`<text class="mal" style="font:700 12px 'JetBrains Mono',monospace" x="${(x0 + 60).toFixed(1)}" y="${(y0 + h - 76).toFixed(1)}">SIN LÍMITE — no hay barra de error</text>`);
    out.push(`<text class="lblSm" x="${(x0 + 60).toFixed(1)}" y="${(y0 + h - 62).toFixed(1)}">el pico CRECE al refinar: no hay valor al que tienda</text>`);
    out.push(`<text class="lblSm" x="${(x0 + 60).toFixed(1)}" y="${(y0 + h - 48).toFixed(1)}">rango observado [${Math.min(...fsv).toPrecision(5)}, ${Math.max(...fsv).toPrecision(5)}] = HECHO, no intervalo</text>`);
  }

  // los tres puntos
  for (let i = 0; i < 3; i++) {
    const cx = PX(hs[i]), cy = PY(fsv[i]);
    out.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${i === 0 ? 5.2 : 4}" fill="${i === 0 ? '#e9eef5' : '#8fa3bd'}" stroke="#0b0f16" stroke-width="1"/>`);
    out.push(`<text class="lblSm" text-anchor="middle" x="${cx.toFixed(1)}" y="${(cy - 10).toFixed(1)}">${fsv[i].toPrecision(5)}</text>`);
  }
  // la BARRA DE ERROR sobre la malla fina
  if (res.banda95) {
    const [lo, hi] = res.banda95;
    const cx = PX(hs[0]);
    out.push(`<line x1="${cx.toFixed(1)}" y1="${PY(lo).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${PY(hi).toFixed(1)}" stroke="${COL[res.semaforo]}" stroke-width="2.4"/>`);
    for (const v of [lo, hi]) {
      out.push(`<line x1="${(cx - 8).toFixed(1)}" y1="${PY(v).toFixed(1)}" x2="${(cx + 8).toFixed(1)}" y2="${PY(v).toFixed(1)}" stroke="${COL[res.semaforo]}" stroke-width="2.4"/>`);
    }
    out.push(`<text class="lblSm" style="fill:${COL[res.semaforo]}" x="${(cx + 12).toFixed(1)}" y="${PY((lo + hi) / 2).toFixed(1)}">±${pct(res.gciFino)} (95 %)</text>`);
  }
  return out.join('');
}

export function laminaGCI(o: {
  titulo: string;
  subtitulo: string;
  cita: string;
  principal: PanelGCI;
  singularidad?: PanelGCI;
  betti?: { residuo: number; tol: number; wAB: number; wBA: number; controlResiduo: number; controlDelta: string };
  declarado: string[];
}): Lamina {
  const W = 1080, H = 760, PAD = 30;
  const R = o.principal.res;
  const S: string[] = [];

  // ── encabezado
  const PW = 566;                       // ancho de la columna izquierda (los dos paneles)
  const CHtit = Math.floor((W - 2 * PAD) / 6.05);
  S.push(`<text class="tit" x="${PAD}" y="26">${ESC(o.titulo)}</text>`);
  S.push(`<text class="cita" x="${PAD}" y="44">${ESC(o.cita)}</text>`);
  const subs = envuelve(o.subtitulo, CHtit).slice(0, 3);
  for (const [i, l] of subs.entries()) {
    S.push(`<text class="lblSm" x="${PAD}" y="${58 + i * 12}">${ESC(l)}</text>`);
  }

  // ── panel principal
  const PY0 = 62 + subs.length * 12 + 14, PH = 234;
  S.push(panelPlot(o.principal, PAD, PY0, PW, PH));

  // ── el resultado GRANDE + semáforo
  const yRes = PY0 + PH + 32;
  const col = COL[R.semaforo];
  const val = R.banda95
    ? `${R.f1.toPrecision(5)} ± ${(R.gciFino! * Math.abs(R.f1)).toPrecision(3)} ${o.principal.unidad}`
    : `${R.f1.toPrecision(5)} ${o.principal.unidad}  ·  SIN BARRA DE ERROR`;
  S.push(`<circle cx="${PAD + 14}" cy="${yRes - 7}" r="11" fill="${col}"/>`);
  S.push(`<text class="big" x="${PAD + 34}" y="${yRes}">${ESC(val)}</text>`);
  const veredicto = R.regimen !== 'monotona'
    ? `${R.regimen.toUpperCase()} — el GCI clásico NO aplica`
    : R.enRangoAsintotico
      ? `EN RANGO ASINTÓTICO (razón ${fmt(R.asintotico, 4)} ≈ 1): banda al 95 % VÁLIDA`
      : `FUERA DE RANGO ASINTÓTICO (razón ${fmt(R.asintotico, 4)}, debe ser ≈ 1): banda INDICATIVA`;
  const clsVer = R.semaforo === 'verde' ? 'ok' : R.semaforo === 'ambar' ? 'warn' : 'mal';
  // el veredicto se ENVUELVE al ancho de la columna izquierda: suelto se metía en la
  // columna derecha y pisaba el bloque de Betti.
  const vLin = envuelve(veredicto, Math.floor((PW - 34) / 7.5));
  for (const [i, l] of vLin.entries()) {
    S.push(`<text class="${clsVer}" style="font:700 12.5px 'JetBrains Mono',monospace" x="${PAD + 34}" y="${yRes + 17 + i * 14}">${ESC(l)}</text>`);
  }
  const yP = yRes + 17 + vLin.length * 14;
  S.push(`<text class="lblSm" x="${PAD + 34}" y="${yP}">orden OBSERVADO p = ${fmt(R.p, 3)} (${R.pMetodo}) · r21 = ${R.r21.toFixed(4)} · r32 = ${R.r32.toFixed(4)} · Fs = ${R.Fs}</text>`);

  // ── panel de la singularidad
  if (o.singularidad) {
    const SY = yP + 26;
    S.push(panelPlot(o.singularidad, PAD, SY, PW, H - SY - 18));
  }

  // ── columna derecha
  const RX = PAD + PW + 22, RW = W - RX - 16;
  const CH = Math.floor(RW / 6.05);
  let y = PY0 + 4;
  const row = (t: string, cls = 'lbl', dy = 15) => { S.push(`<text class="${cls}" x="${RX}" y="${y}">${ESC(t)}</text>`); y += dy; };
  const kv = (k: string, v: string, cls = 'num') => {
    S.push(`<text class="lbl" x="${RX}" y="${y}">${ESC(k)}</text><text class="${cls}" x="${RX + 232}" y="${y}">${ESC(v)}</text>`);
    y += 15;
  };

  row('LA MATEMÁTICA (Roache 1994 · Celik et al. 2008)', 'cita', 16);
  row('p = ln(e32/e21)/ln(r)   [r21=r32]', 'lblSm', 12);
  row('p = |ln|e32/e21| + q(p)|/ln(r21),  q=ln((r21^p-s)/(r32^p-s))', 'lblSm', 12);
  row('GCI_fino = Fs*|(f2-f1)/f1| / (r21^p - 1),   Fs = 1.25', 'lblSm', 12);
  row('asintotico = GCI32 / (r21^p * GCI21)  debe dar ~ 1', 'lblSm', 17);

  row('LAS TRES MALLAS', 'cita', 15);
  S.push(`<text class="lblSm" x="${RX}" y="${y}">malla</text>`
    + `<text class="lblSm" x="${RX + 118}" y="${y}">h</text>`
    + `<text class="lblSm" x="${RX + 182}" y="${y}">elem</text>`
    + `<text class="lblSm" x="${RX + 268}" y="${y}">valor</text>`);
  y += 14;
  for (const s of o.principal.series) {
    S.push(`<text class="lbl" x="${RX}" y="${y}">${ESC(s.etiqueta)}</text>`
      + `<text class="num" x="${RX + 118}" y="${y}">${s.h.toFixed(3)}</text>`
      + `<text class="lbl" x="${RX + 182}" y="${y}">${s.n != null ? s.n : '—'}</text>`
      + `<text class="num" x="${RX + 268}" y="${y}">${s.f.toPrecision(6)}</text>`);
    y += 15;
  }
  y += 5;

  row('EL ESTIMADOR', 'cita', 15);
  kv('orden observado p', fmt(R.p, 4));
  kv('e21 = f2 - f1', R.e21.toPrecision(5));
  kv('e32 = f3 - f2', R.e32.toPrecision(5));
  kv('razón e32/e21', fmt(R.razon, 4));
  kv('GCI malla FINA', pct(R.gciFino));
  kv('GCI malla GRUESA', pct(R.gciGrueso));
  kv('razón asintótica', fmt(R.asintotico, 4), R.enRangoAsintotico ? 'ok' : 'warn');
  kv('Richardson h→0', R.fExtrapolado == null ? '—' : R.fExtrapolado.toPrecision(6));
  kv('banda 95 %', R.banda95 ? `[${R.banda95[0].toPrecision(5)}, ${R.banda95[1].toPrecision(5)}]` : 'NO HAY');
  y += 4;

  if (o.betti) {
    row('MAXWELL-BETTI — reciprocidad (gratis y exacta)', 'cita', 15);
    row('W_AB = f_A·u_B  =  f_B·u_A  en CUALQUIER malla', 'lblSm', 13);
    kv('W_AB', o.betti.wAB.toPrecision(12));
    kv('W_BA', o.betti.wBA.toPrecision(12));
    kv('residuo relativo', o.betti.residuo.toExponential(3), o.betti.residuo <= o.betti.tol ? 'ok' : 'mal');
    kv('control NEGATIVO', o.betti.controlResiduo.toExponential(3), 'mal');
    for (const l of envuelve(`(control: ${o.betti.controlDelta})`, CH)) row(l, 'lblSm', 11.5);
    y += 4;
  }

  row('LO DECLARADO — no medido NO es verificado', 'warn', 14);
  // GUARDA DE DESBORDE: si no cabe, se dice cuántos renglones faltan en vez de escribir
  // fuera del lienzo (que es exactamente la forma de "declarar" algo y que no se lea).
  const lineas = o.declarado.flatMap((d) => envuelve('· ' + d, CH));
  let cortadas = 0;
  for (const l of lineas) {
    if (y > H - 16) { cortadas++; continue; }
    row(l, 'lblSm', 11);
  }
  if (cortadas) S.push(`<text class="mal" x="${RX}" y="${H - 6}">(${cortadas} renglones no caben — recorta el texto declarado)</text>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS_GCI}</style><rect class="bg" width="${W}" height="${H}"/>
${S.join('\n')}
</svg>`;

  return {
    id: 'gci-banda',
    titulo: o.titulo,
    cita: o.cita,
    queMirar: 'El SEMÁFORO y la barra vertical sobre la malla fina: si está verde, el número de arriba se puede '
      + 'entregar con esa banda al 95 %; si está ámbar, las tres mallas todavía no están en el rango asintótico y la '
      + 'banda es indicativa. El panel de abajo es el control: una SINGULARIDAD no tiene valor límite, la serie se '
      + 'fuga hacia arriba al refinar y el estimador se niega a ponerle barra de error.',
    svg,
  };
}
