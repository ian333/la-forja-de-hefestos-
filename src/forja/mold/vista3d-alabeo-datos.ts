/**
 * LA PIEZA SE DEFORMA — el campo 3D del alabeo (§10.3.1, Ec. 10.17 a 10.20).
 * ============================================================================
 * La FÍSICA ya existe y NO se re-escribe aquí: `warpage.ts` (`alabeoPorEspesor`
 * con Ec. 10.17-10.18 y `alabeoPorArea` con el pandeo de Ec. 10.19-10.20, ambas
 * verificadas contra los ejemplos del libro — δ 1.59 vs 1.6 publicado). Este
 * módulo hace UNA cosa: convertir esos escalares en un CAMPO DE DESPLAZAMIENTO
 * sobre la malla real, que es la dimensión que la lámina 2D pierde.
 *
 * ── LA GEOMETRÍA, Y POR QUÉ CIERRA ────────────────────────────────────────
 * Ec. 10.17 escribe el radio como R = 2h/Δs. Ojo con el 2: la curvatura de una
 * placa con Δs de deformación repartida en el espesor h es κ = Δs/h, o sea
 * R_verdadero = h/Δs = R_Kazmer/2. Y entonces la FLECHA del arco verdadero a
 * media anchura W,
 *        sagita = R_v · (1 − cos(W/R_v))
 * vale, para el bezel del libro, 4525·(1−cos(120/4525)) = 1.5912 mm — que es
 * EXACTAMENTE δ = W·sin(W/R_Kazmer) = 120·sin(120/9050) = 1.5911 de Ec. 10.18.
 * Coinciden a 5 dígitos, y no por casualidad: Ec. 10.18 es la sagita del arco
 * verdadero escrita con la convención de R de Ec. 10.17. Esa coincidencia se
 * calcula en `campoAlabeo().arco` y se IMPRIME: es un chequeo de que la forma
 * 3D que ves y el número del libro son la misma cosa, no dos cosas parecidas.
 *
 * ── LA EXAGERACIÓN ────────────────────────────────────────────────────────
 * Se amplifica el CAMPO DE DESPLAZAMIENTO REAL por un factor lineal (`x' = x +
 * F·u`), la convención de post-proceso de cualquier FEA. Dos consecuencias que
 * el arnés MIDE, no supone:
 *   · F = 0 ⇒ la deformada es la original BIT A BIT (no "casi igual");
 *   · δ escala LINEALMENTE con F (duplicar F duplica δ) — elasticidad lineal.
 * Y una advertencia que se declara: a ×F grande la forma NO es la deformada de
 * gran desplazamiento; es el campo REAL multiplicado. Por eso el factor va
 * IMPRESO en pantalla siempre: una deformación exagerada sin su factor es un
 * engaño.
 *
 * PURO → node-testeable (sin DOM, sin three, sin React).
 */
import { alabeoPorEspesor, alabeoPorArea, type AlabeoEspesor, type AlabeoArea } from './warpage';
import { ABS_TAIT, type TaitCoeffs } from './shrinkage';
import type { Caja, MallaSimple } from './estudio-vivo-datos';
import { escalon125, fmt } from './vista3d-comun';

/**
 * Los parámetros de PROCESO del ejemplo de §10.3.1, LITERALES y los MISMOS que
 * `revisar-modelo.ts` pasa a la lámina L17 — para que la vista 3D y la lámina no
 * puedan discrepar. Si mañana el proceso cambia, cambia en un solo lugar.
 */
export const PROCESO_LIBRO = {
  /** T del plástico junto al inserto de CAVIDAD (lado +Z) al final del empaque */
  tCavityC: 132,
  /** T del plástico junto al inserto de NÚCLEO (lado −Z) — el lado caliente */
  tCoreC: 134,
  pPackPa: 66e6,
  /** el modo de ÁREA se evalúa a T uniforme: lo que varía es la PRESIÓN */
  tC: 132, pCenterPa: 66e6, pEdgePa: 0,
} as const;

export type Topologia = 'marco' | 'placa' | 'mixta';

export interface ChequeoArco {
  rKazmerMm: number; rVerdaderoMm: number;
  sagitaMm: number; deltaEcMm: number; difMm: number; coincide: boolean;
}

export interface CampoAlabeo {
  wallMm: number; halfWidthMm: number; topologia: Topologia;
  esp: AlabeoEspesor;
  are: AlabeoArea;
  /** cuál de las DOS formas del libro manda en esta pieza */
  modo: 'espesor' | 'area';
  razonModo: string;
  /** curvatura REAL con signo (1/mm). + = cóncava hacia +Z (cavidad) */
  kappa: number;
  /** δ del modo dominante (mm) — el número del libro, sin exagerar */
  deltaModoMm: number;
  arco: ChequeoArco;
  dtC: number;
  centro: { x: number; y: number; zMid: number };
  proceso: typeof PROCESO_LIBRO;
  /** el criterio de pandeo con SUS DOS NÚMEROS, como lo escribe el libro */
  criterioPandeo: { izq: number; der: number; texto: string; cumple: boolean };
  notas: string[];
}

/** Semiancho W del libro: del CENTRO al borde, por el lado CORTO de la planta. */
export const semianchoDe = (c: Caja): number => Math.min(c.x1 - c.x0, c.y1 - c.y0) / 2;

/**
 * El campo de alabeo de la pieza. `wallMm` es la pared NOMINAL (la que el
 * Estudio ya midió), `topologia` la de `dfmFromMesh().warpageTopology` — §10.3.1
 * es explícito en que un MARCO no pandea aunque cumpla el criterio.
 */
export function campoAlabeo(caja: Caja, o: {
  wallMm: number;
  topologia?: Topologia;
  tait?: TaitCoeffs;
  proceso?: typeof PROCESO_LIBRO;
}): CampoAlabeo {
  const tait = o.tait ?? ABS_TAIT;
  const p = o.proceso ?? PROCESO_LIBRO;
  const W = semianchoDe(caja);
  const h = o.wallMm > 0 ? o.wallMm : 2;
  const topologia: Topologia = o.topologia ?? 'placa';

  const esp = alabeoPorEspesor(tait, {
    wallMm: h, halfWidthMm: W, tCoreC: p.tCoreC, tCavityC: p.tCavityC, pPackPa: p.pPackPa,
  });
  const are = alabeoPorArea(tait, {
    wallMm: h, halfWidthMm: W, tC: p.tC, pCenterPa: p.pCenterPa, pEdgePa: p.pEdgePa, topologia,
  });

  // curvatura con SIGNO. s viene en %, la curvatura en 1/mm.
  // κ = (s_cavidad − s_núcleo)/h con la cavidad en +Z: si el NÚCLEO (−Z) contrae
  // más (es el lado caliente), κ < 0 y la pieza queda cóncava hacia −Z, que es
  // exactamente lo que dibuja Fig 10.14 — el lado que más contrae queda ADENTRO.
  const kappa = ((esp.sCavityPct - esp.sCorePct) / 100) / h;
  const kAbs = Math.abs(kappa);
  const rVerdadero = kAbs > 1e-15 ? 1 / kAbs : Infinity;
  const sagita = kAbs > 1e-15 ? (1 - Math.cos(kAbs * W)) / kAbs : 0;
  const dif = Math.abs(sagita - esp.deltaMm);
  const arco: ChequeoArco = {
    rKazmerMm: esp.radiusMm,
    rVerdaderoMm: Number.isFinite(rVerdadero) ? +rVerdadero.toFixed(0) : Infinity,
    sagitaMm: +sagita.toFixed(4), deltaEcMm: esp.deltaMm, difMm: +dif.toFixed(4),
    // el redondeo de `deltaMm` a 2 decimales ya vale 0.005: la tolerancia lo respeta
    coincide: dif <= Math.max(0.006, 0.01 * esp.deltaMm),
  };

  const pandeaDeVerdad = are.aplica && are.pandea;
  const modo: 'espesor' | 'area' = pandeaDeVerdad && are.deltaMm > esp.deltaMm ? 'area' : 'espesor';
  const razonModo = modo === 'area'
    ? `PANDEO (Fig 10.15): el área cerrada da δ ${fmt(are.deltaMm)} mm > los ${fmt(esp.deltaMm)} mm de la curvatura por espesor`
    : pandeaDeVerdad
      ? `CURVATURA (Fig 10.14): δ ${fmt(esp.deltaMm)} mm manda sobre los ${fmt(are.deltaMm)} mm del pandeo`
      : are.aplica
        ? `CURVATURA (Fig 10.14): el criterio de pandeo NO se cumple (${are.deltaS.toFixed(4)} ≤ ${are.umbral.toFixed(4)}), así que la única forma activa es la del espesor`
        : `CURVATURA (Fig 10.14): §10.3.1 declara el pandeo NO APLICABLE en un MARCO — el material no está en contacto continuo`;

  const criterioPandeo = {
    izq: are.deltaS, der: are.umbral,
    texto: `(s_borde − s_centro) > 0.44·(h/W)²  →  ${are.deltaS.toFixed(4)} ${are.deltaS > are.umbral ? '>' : '≤'} ${are.umbral.toFixed(4)}`,
    cumple: are.deltaS > are.umbral,
  };

  const notas: string[] = [
    `proceso del libro §10.3.1: cavidad ${p.tCavityC} °C · núcleo ${p.tCoreC} °C · empaque ${(p.pPackPa / 1e6).toFixed(0)} MPa · borde ${(p.pEdgePa / 1e6).toFixed(0)} MPa`,
    'la curvatura se dibuja RADIAL (plato): la Δs por espesor es isótropa, así que curva igual en las dos direcciones del plano. Fig 10.14 la dibuja en corte (cilíndrica) porque es un corte.',
    'CAVIDAD = +Z, NÚCLEO = −Z (la dirección de apertura del Estudio). Si la pieza va volteada en el molde, los dos lados intercambian y el alabeo cambia de sentido.',
  ];
  if (!arco.coincide) {
    notas.push(`⚠ la sagita del arco dibujado (${fmt(arco.sagitaMm, 3)} mm) NO coincide con δ de Ec. 10.18 (${fmt(arco.deltaEcMm)} mm): la forma 3D y el número NO son la misma cosa`);
  }
  if (modo === 'area') notas.push(`⚠ ${are.advertencia}`);
  if (!are.aplica) notas.push(are.nota);

  return {
    wallMm: h, halfWidthMm: W, topologia, esp, are, modo, razonModo,
    kappa, deltaModoMm: modo === 'area' ? are.deltaMm : esp.deltaMm, arco,
    dtC: +(p.tCoreC - p.tCavityC).toFixed(2),
    centro: { x: (caja.x0 + caja.x1) / 2, y: (caja.y0 + caja.y1) / 2, zMid: (caja.z0 + caja.z1) / 2 },
    proceso: p, criterioPandeo, notas,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* El campo de desplazamiento sobre la malla                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CampoDesplazamiento {
  /** u REAL (mm), 3 floats por vértice — SIN exagerar */
  u: Float32Array;
  /** |u_z| máximo real (mm) */
  uzMaxMm: number;
  /** |u| máximo real (mm) */
  uMaxMm: number;
  /** vértice donde ocurre el máximo de |u_z| (para colgar la cota de δ) */
  iMax: number;
  modo: 'espesor' | 'area';
  nota: string;
}

/**
 * u(x) REAL sobre cada vértice.
 *
 * MODO ESPESOR — flexión pura de la placa sobre su superficie media, con la
 * curvatura κ del campo (radial). El punto (r, ζ) va a
 *      ρ' = sin(θ)/κ − ζ·sin(θ)          [ = (R − ζ)·sin θ ]
 *      z' = z_mid + 2·sin²(θ/2)/κ + ζ·cos(θ)
 * con θ = κ·r y ζ = z − z_mid. Escrito ASÍ y no como R(1−cos θ) a propósito:
 * con R ~ 4525 mm y θ ~ 0.026, `R − R·cos θ` es una resta de dos números casi
 * iguales y pierde la mitad de los dígitos; `2·sin²(θ/2)/κ` es la misma
 * identidad sin cancelación.
 *
 * MODO ÁREA — el CONO que Ec. 10.20 encodea: a radio de material r la pieza
 * ocupa r(1−Δs) en el plano y la diferencia sube como altura, δ·(1 − r/W). Solo
 * se toma la componente FUERA DE PLANO: la parte en el plano es contracción
 * (§10.1), no alabeo, y amplificarla ×N encogería la pieza a la vista.
 */
export function desplazamientoReal(malla: MallaSimple, campo: CampoAlabeo): CampoDesplazamiento {
  const P = malla.positions;
  const n = Math.floor(P.length / 3);
  const u = new Float32Array(n * 3);
  const { x: cx, y: cy, zMid } = campo.centro;
  let uzMax = 0, uMax = 0, iMax = 0;

  if (campo.modo === 'espesor') {
    const k = campo.kappa;
    if (Math.abs(k) > 1e-15) {
      for (let i = 0; i < n; i++) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        const dx = x - cx, dy = y - cy;
        const r = Math.hypot(dx, dy);
        const zeta = z - zMid;
        const th = k * r;
        const s = Math.sin(th), sh = Math.sin(th / 2);
        const rho = s / k - zeta * s;                       // (R − ζ)·sin θ
        const zz = zMid + (2 * sh * sh) / k + zeta * Math.cos(th);
        const ux = r > 1e-9 ? (rho * (dx / r) - dx) : 0;
        const uy = r > 1e-9 ? (rho * (dy / r) - dy) : 0;
        const uz = zz - z;
        u[i * 3] = ux; u[i * 3 + 1] = uy; u[i * 3 + 2] = uz;
        const a = Math.abs(uz);
        if (a > uzMax) { uzMax = a; iMax = i; }
        const m = Math.hypot(ux, uy, uz);
        if (m > uMax) uMax = m;
      }
    }
  } else {
    const W = campo.halfWidthMm, d = campo.are.deltaMm;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1];
      const r = Math.hypot(x - cx, y - cy);
      const uz = d * Math.max(0, 1 - r / W);
      u[i * 3] = 0; u[i * 3 + 1] = 0; u[i * 3 + 2] = uz;
      const a = Math.abs(uz);
      if (a > uzMax) { uzMax = a; iMax = i; }
      if (a > uMax) uMax = a;
    }
  }

  return {
    u, uzMaxMm: uzMax, uMaxMm: uMax, iMax, modo: campo.modo,
    nota: campo.modo === 'espesor'
      ? 'flexión pura sobre la superficie media con κ = Δs/h (Ec. 10.17); el campo trae las tres componentes'
      : 'cono de Ec. 10.20 anclado en el borde (r = W); SOLO la componente fuera de plano — la del plano es contracción, no alabeo',
  };
}

/**
 * Deformada = original + F·u. `F = 0` devuelve una COPIA BIT A BIT: no es una
 * optimización, es el invariante que el arnés mide (con exageración 0 la pieza
 * deformada TIENE que ser la original, o la vista está mintiendo desde el
 * primer frame).
 */
export function deformar(pos: Float32Array | number[], u: Float32Array, factor: number): Float32Array {
  const P = pos instanceof Float32Array ? pos : new Float32Array(pos);
  const out = new Float32Array(P.length);
  if (factor === 0) { out.set(P); return out; }
  for (let i = 0; i < P.length; i++) out[i] = P[i] + factor * u[i];
  return out;
}

/** |u_z| máximo de la deformada AMPLIFICADA — el número que se ve en pantalla. */
export function deltaEnPantalla(d: CampoDesplazamiento, factor: number): number {
  return d.uzMaxMm * Math.abs(factor);
}

/**
 * El factor máximo del control (t = 1). Se elige para que la flecha llegue a
 * ~18 % del tamaño de la pieza (visible sin volverse una caricatura) y se
 * REDONDEA al escalón 1-2-5 para que el número impreso sea una elección
 * declarada y no un decimal cocinado al dato.
 */
export function factorMaximo(campo: CampoDesplazamiento, caja: Caja): number {
  const L = Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0, caja.z1 - caja.z0) || 100;
  if (!(campo.uzMaxMm > 1e-9)) return 1;
  return Math.max(1, escalon125((0.18 * L) / campo.uzMaxMm));
}

/** t (0..1 del control) → factor de exageración. LINEAL a propósito: es lo que
 *  hace que "duplicar el factor duplique δ" sea comprobable con el control. */
export const factorDe = (t: number, fMax: number): number => t * fMax;

/**
 * LOS DOS INVARIANTES, medidos aquí para que el arnés no tenga que creerle a la
 * pantalla: (1) F=0 ⇒ deformada idéntica bit a bit; (2) δ(2F) = 2·δ(F).
 * Devuelve números, no un "ok" — un gate que solo dice ok no se puede auditar.
 */
export function invariantes(malla: MallaSimple, campo: CampoDesplazamiento, fMax: number): {
  ceroEsIdentico: boolean; nDiferentes: number;
  linealidad: { f1: number; f2: number; d1: number; d2: number; razon: number; ok: boolean };
} {
  const P = malla.positions instanceof Float32Array ? malla.positions : new Float32Array(malla.positions);
  const a = deformar(P, campo.u, 0);
  let nDif = 0;
  for (let i = 0; i < P.length; i++) if (a[i] !== P[i]) nDif++;

  const f1 = fMax * 0.25, f2 = fMax * 0.5;
  const b1 = deformar(P, campo.u, f1), b2 = deformar(P, campo.u, f2);
  const dz = (q: Float32Array) => {
    let m = 0;
    for (let i = 2; i < q.length; i += 3) { const v = Math.abs(q[i] - P[i]); if (v > m) m = v; }
    return m;
  };
  const d1 = dz(b1), d2 = dz(b2);
  const razon = d1 > 1e-9 ? d2 / d1 : NaN;
  return {
    ceroEsIdentico: nDif === 0, nDiferentes: nDif,
    linealidad: { f1: +f1.toFixed(4), f2: +f2.toFixed(4), d1: +d1.toFixed(6), d2: +d2.toFixed(6), razon: +(razon || 0).toFixed(5), ok: Math.abs(razon - 2) < 1e-3 },
  };
}
