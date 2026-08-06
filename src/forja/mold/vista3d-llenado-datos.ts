/**
 * EL FRENTE LLENA — la lógica PURA de la vista 3D animada (sin React, sin three).
 * ============================================================================
 * La lámina L14 pinta las ISÓCRONAS de llenado en planta. Son bonitas y son ESTÁTICAS:
 * "en un libro no se puede ver un video; aquí sí". Este archivo prepara el MISMO campo
 * (`flowlen.ts` + `flowlen-mesh.ts` + `venting-locations.ts`, sin física nueva) para que
 * la escena 3D pueda pintar el plástico ENTRANDO.
 *
 * LA IDEA QUE HACE QUE ESTO SEA BARATO Y MONÓTONO POR CONSTRUCCIÓN:
 * el fundido llena por ORDEN DE RESISTENCIA (§5.5.5 race tracking: no por cercanía —
 * una pared gruesa lejana se llena antes que una delgada cercana). Ese orden es un
 * ORDEN TOTAL sobre los vóxeles. Si se ordenan una vez de menor a mayor resistencia,
 * "lo lleno en t" es sencillamente **el prefijo** `[0, n(t))` del arreglo:
 *
 *   · pintar = subir `count` de un InstancedMesh (una asignación, cero recorridos)
 *   · el volumen llenado es `n(t) · celda³` ⇒ **CRECE MONÓTONO CON t POR CONSTRUCCIÓN**,
 *     y aun así el gate lo MIDE (un invariante que no se comprueba no es un invariante).
 *
 * EL TIEMPO. `t` es el tiempo de llenado NORMALIZADO y se mapea a FRACCIÓN DE VOLUMEN
 * inyectada, que es la hipótesis estándar del libro (§5.4: caudal volumétrico constante
 * durante el llenado ⇒ volumen ∝ tiempo). Queda DECLARADO: no es un perfil de velocidad
 * de tornillo real; si algún día se simula el perfil, este mapeo es el que cambia.
 *
 * LAS SOLDADURAS Y LAS TRAMPAS DE GAS NO SE DIBUJAN A GUSTO: emergen del campo.
 *   · soldadura = `computeWeldMask` (compuertas distintas o reencuentro ASIMÉTRICO) UNIDA
 *     con `mascaraEncuentro()` de este archivo, que caza el reencuentro SIMÉTRICO que a
 *     la primera se le escapa con una sola compuerta (ver su comentario: medido, daba
 *     CERO soldaduras en una pieza llena de postes). Aparecen cuando llega el SEGUNDO
 *     frente, no antes.
 *   · trampa de gas = `enumerarVenteos` + `clasificarCierres` con `interior: true` —
 *     §5.5.4: el cierre en el INTERIOR de la huella no lo alcanza el venteo de la
 *     partición ⇒ "the trapped air will likely combust, causing a burn mark".
 *
 * ESCALA DE COLOR FIJA (regla dura del Estudio): el color es el % de llenado al que
 * llega ese punto, dominio [0,1] CONSTANTE. No se auto-ajusta al dato.
 */

import { measureFlowLength, computeWeldMask, type FlowField } from './flowlen';
import { solidFromMesh, defaultGate } from './flowlen-mesh';
import { enumerarVenteos, clasificarCierres, type CandidatoVenteo } from './venting-locations';
import { rampa, type RGB, type MallaSimple, type Caja } from './estudio-vivo-datos';

/* ────────────────────────────────────────────────────────────────────────── */
/* Leyenda: escala FIJA por % de llenado                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export const DOMINIO_LLENADO: [number, number] = [0, 1];
export const MARCAS_LLENADO: Array<{ v: number; et: string }> = [
  { v: 0, et: '0 % (compuerta)' },
  { v: 0.25, et: '25 %' },
  { v: 0.5, et: '50 %' },
  { v: 0.75, et: '75 %' },
  { v: 1, et: '100 % (último en llenarse)' },
];
/** colores RESERVADOS: ningún valor de la rampa los usa. */
export const COLOR_SOLDADURA = '#ffffff';
export const COLOR_TRAMPA_GAS = '#ff3b30';
export const COLOR_VENTEABLE = '#ffb347';
export const COLOR_COMPUERTA = '#c9a227';

/* ────────────────────────────────────────────────────────────────────────── */
/* La escena                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface MarcaVenteo extends CandidatoVenteo {
  /** §5.5.4: el cierre cae en el INTERIOR de la huella ⇒ TRAMPA DE GAS (no venteable
   *  desde la partición). `false` = cierre en el borde, se ventea y no quema. */
  interior: boolean;
}

export interface EscenaLlenado {
  campo: FlowField;
  /** compuerta (mm de la pieza) */
  gate: { x: number; y: number; z: number };
  /** vóxeles de hueco ALCANZABLES, ORDENADOS por resistencia (= orden real de llenado) */
  n: number;
  xyz: Float32Array;          // 3·n — centro de cada vóxel (mm)
  colores: Float32Array;      // 3·n — rampa fija del % de llenado en que ese vóxel se llena
  fracLlega: Float32Array;    // n   — % de llenado al que ese vóxel se llena (0..1)
  flowLenMm: Float32Array;    // n   — L recorrida hasta ese vóxel
  espesorMm: Float32Array;    // n   — espesor local (mm)
  resistencia: Float32Array;  // n   — resistencia acumulada (∝ ΔP, Eq 5.22) — el orden
  /** vóxeles de SOLDADURA, ordenados por el instante (frac) en que se forman */
  nWeld: number;
  weldXyz: Float32Array;      // 3·nWeld
  weldFrac: Float32Array;     // nWeld
  /** venteos (§8.2.2) clasificados por §5.5.4 */
  venteos: MarcaVenteo[];
  /** volumen alcanzable total (mm³) medido por el voxelizado */
  volumenMm3: number;
  cellMm: number;
  maxFlowLenMm: number;
  /** caja de la pieza */
  caja: Caja;
  /** lo que pone en DUDA los números (resolución, volumen que no cuadra) */
  avisos: string[];
  /** lo que el análisis REPORTA y no es un problema (conteo de venteos, etc.) */
  notas: string[];
  ms: number;
}

/**
 * DÓNDE SE ENCUENTRAN DOS FRENTES — el criterio que le faltaba al caso de UNA compuerta.
 * ============================================================================
 * `computeWeldMask` caza dos situaciones: (a) vecinos alimentados por compuertas
 * DISTINTAS y (b) vecinos con L muy diferente (reencuentro ASIMÉTRICO). Con una sola
 * compuerta y una pared uniforme, el reencuentro es SIMÉTRICO: las dos ramas rodean el
 * boss y llegan al mismo punto con la MISMA L — el ΔL entre vecinos es ~0 y la máscara
 * sale VACÍA. Medido en la carcasa RPi4 (2026-08-06): 0 soldaduras con ΔL = 20 mm,
 * teniendo la pieza postes que el frente obviamente rodea.
 *
 * EL CRITERIO QUE SÍ APLICA, y sale del mismo campo sin física nueva: el frente es una
 * superficie de ISO-RESISTENCIA que AVANZA. Si un vóxel tiene hueco en las dos
 * direcciones OPUESTAS de algún eje y AMBOS vecinos ya estaban llenos (resistencia
 * MENOR), entonces el fundido llegó ahí por los dos lados: **ahí se cerró el frente**.
 * Eso es la línea de unión de §5.5.4 — y donde el frente cierra, el aire queda pinzado
 * (§8.2.2), que es la razón por la que el libro las persigue.
 *
 * EXTENSIÓN DECLARADA: es MÍA, no del libro; el libro nombra el fenómeno, no el
 * detector. Se UNE con `computeWeldMask` (no la reemplaza) para no perder el caso de
 * varias compuertas. Ambas se marcan igual en la vista: donde el frente se junta.
 */
export function mascaraEncuentro(f: FlowField): Uint8Array {
  const m = new Uint8Array(f.cavity.length);
  const ejes: Array<[number, number, number]> = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let k = 0; k < f.nz; k++) for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) {
    const t = f.idx(i, j, k);
    if (!f.cavity[t] || !Number.isFinite(f.resistance[t])) continue;
    const r = f.resistance[t];
    for (const [di, dj, dk] of ejes) {
      const a = i + di, b = j + dj, c = k + dk;
      const p = i - di, q = j - dj, s = k - dk;
      if (a >= f.nx || b >= f.ny || c >= f.nz || p < 0 || q < 0 || s < 0) continue;
      const u = f.idx(a, b, c), v = f.idx(p, q, s);
      if (!f.cavity[u] || !f.cavity[v]) continue;
      if (!Number.isFinite(f.resistance[u]) || !Number.isFinite(f.resistance[v])) continue;
      // los DOS vecinos opuestos llegaron ANTES ⇒ el frente se cerró aquí
      if (f.resistance[u] < r && f.resistance[v] < r) { m[t] = 1; break; }
    }
  }
  return m;
}

/** cuántos vóxeles están llenos en t (prefijo del arreglo ordenado). MONÓTONA en t. */
export const llenosEn = (esc: { n: number }, t: number): number => {
  const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return Math.round(u * esc.n);
};

/**
 * CONSTRUYE la escena de llenado a partir de la malla de la pieza. Nada de figuras:
 * el hueco A/B es el interior del sólido (`solidFromMesh`) y la compuerta sale de
 * `defaultGate` (§7.2.2, bebedero central sobre la partición) salvo que se pase otra.
 */
export function construirLlenado(malla: MallaSimple, o?: {
  maxVoxels?: number; wallMm?: number; expectVolumeMm3?: number;
  gateMm?: { x: number; y: number; z: number };
  /** Δ de longitud de flujo entre vecinos que declara un REENCUENTRO de frentes (mm).
   *  §5.5.4: el frente rodea un núcleo y se vuelve a juntar. Default 20 mm (del libro:
   *  los venteos son del orden de la decena de mm; por debajo es ruido de rejilla). */
  reencuentroMm?: number;
  nMaquinar?: number;
}): EscenaLlenado {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const q = solidFromMesh(malla as any);
  const gate = o?.gateMm ?? defaultGate(q);
  const b = q.bbox;
  const bboxVol = Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0));
  const cell = Math.max(0.6, Math.cbrt(bboxVol / (o?.maxVoxels ?? 160_000)));
  const campo = measureFlowLength({
    x0: b.x0 - cell, y0: b.y0 - cell, z0: b.z0 - cell,
    x1: b.x1 + cell, y1: b.y1 + cell, z1: b.z1 + cell,
    cellMm: cell, gateMm: gate,
    inCavity: (x, y, z) => q.inside(x, y, z),
    wallMm: o?.wallMm, expectVolumeMm3: o?.expectVolumeMm3,
  });

  // ── el ORDEN DE LLENADO: resistencia creciente (§5.5.5), no distancia ──
  const idxs: number[] = [];
  for (let t = 0; t < campo.cavity.length; t++) {
    if (campo.cavity[t] && Number.isFinite(campo.resistance[t])) idxs.push(t);
  }
  idxs.sort((a, c) => campo.resistance[a] - campo.resistance[c]);
  const n = idxs.length;

  const xyz = new Float32Array(n * 3);
  const colores = new Float32Array(n * 3);
  const fracLlega = new Float32Array(n);
  const flowLenMm = new Float32Array(n);
  const espesorMm = new Float32Array(n);
  const resistencia = new Float32Array(n);
  const { nx, ny, cellMm, x0, y0, z0 } = campo;
  /** posición del índice lineal (el idx de flowlen es (k·ny + j)·nx + i) */
  const pos = (t: number): [number, number, number] => {
    const i = t % nx, r = (t - i) / nx, j = r % ny, k = (r - j) / ny;
    return [x0 + (i + 0.5) * cellMm, y0 + (j + 0.5) * cellMm, z0 + (k + 0.5) * cellMm];
  };
  const fracDe = new Float32Array(campo.cavity.length);   // índice lineal → frac de llegada
  for (let s = 0; s < n; s++) {
    const t = idxs[s];
    const p = pos(t);
    xyz[s * 3] = p[0]; xyz[s * 3 + 1] = p[1]; xyz[s * 3 + 2] = p[2];
    const f = n > 1 ? s / (n - 1) : 0;
    fracLlega[s] = f; fracDe[t] = f;
    flowLenMm[s] = campo.flowLenMm[t];
    espesorMm[s] = campo.thicknessMm[t];
    resistencia[s] = campo.resistance[t];
    const c: RGB = rampa(f);
    colores[s * 3] = c[0]; colores[s * 3 + 1] = c[1]; colores[s * 3 + 2] = c[2];
  }

  // ── SOLDADURAS: donde el frente se REENCUENTRA (una sola compuerta ⇒ el criterio
  //    que aplica es ΔL entre vecinos, no "de qué compuerta viene") ──
  const dL = o?.reencuentroMm ?? 20;
  const wm = computeWeldMask(campo as any, { sameGateDeltaLMm: dL });
  const enc = mascaraEncuentro(campo);
  const weld = new Uint8Array(wm.weld.length);
  for (let t = 0; t < weld.length; t++) weld[t] = (wm.weld[t] || enc[t]) ? 1 : 0;
  const weldIdx: number[] = [];
  for (let t = 0; t < weld.length; t++) if (weld[t]) weldIdx.push(t);
  // la soldadura EXISTE cuando llega el SEGUNDO frente: se ordena por ese instante
  weldIdx.sort((a, c) => fracDe[a] - fracDe[c]);
  const nWeld = weldIdx.length;
  const weldXyz = new Float32Array(nWeld * 3);
  const weldFrac = new Float32Array(nWeld);
  for (let s = 0; s < nWeld; s++) {
    const p = pos(weldIdx[s]);
    weldXyz[s * 3] = p[0]; weldXyz[s * 3 + 1] = p[1]; weldXyz[s * 3 + 2] = p[2];
    weldFrac[s] = fracDe[weldIdx[s]];
  }

  // ── VENTEOS §8.2.2 + clasificación §5.5.4 (interior = trampa de gas) ──
  let venteos: MarcaVenteo[] = [];
  // AVISOS = lo que pone en duda los números (resolución de la rejilla, volumen que no
  // cuadra). NOTAS = lo que el análisis reporta y no es un problema. Mezclarlos hace que
  // el ⚠ pierda significado: si todo lleva ⚠, nada lo lleva.
  const avisos = campo.warnings.slice();
  const notas: string[] = [];
  try {
    const plan = enumerarVenteos(campo, { weld, nMaquinar: o?.nMaquinar ?? 8 });
    venteos = clasificarCierres(campo, [...plan.maquinar, ...plan.reservados]) as MarcaVenteo[];
    for (const nota of plan.notas) notas.push(nota);
  } catch (e) {
    avisos.push(`venteos NO enumerados: ${String(e).slice(0, 120)}`);
  }

  return {
    campo, gate, n, xyz, colores, fracLlega, flowLenMm, espesorMm, resistencia,
    nWeld, weldXyz, weldFrac, venteos,
    volumenMm3: +(n * cellMm ** 3).toFixed(1),
    cellMm, maxFlowLenMm: campo.maxFlowLenMm,
    caja: { x0: b.x0, y0: b.y0, z0: b.z0, x1: b.x1, y1: b.y1, z1: b.z1 },
    avisos, notas,
    ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* EL ESTADO EN t — puro                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface EstadoLlenado {
  t: number;
  /** vóxeles llenos (prefijo) y su volumen (mm³) */
  nLlenos: number; volumenMm3: number;
  /** % de volumen llenado */
  pct: number;
  /** L máxima recorrida por el fundido con ese volumen inyectado (§5.19 manda la presión) */
  lenMaxMm: number;
  /** resistencia del frente (∝ ΔP acumulada) */
  resistenciaFrente: number;
  /** soldaduras ya formadas y trampas de gas ya alcanzadas */
  nSoldaduras: number;
  trampasAlcanzadas: number; trampasTotal: number;
  venteablesAlcanzados: number;
  /** ¿terminó? */
  completo: boolean;
}

export function estadoLlenado(esc: EscenaLlenado, t: number): EstadoLlenado {
  const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const nLlenos = llenosEn(esc, u);
  // L máxima del prefijo: se recorre el prefijo (n ~ 1e4, una vez por movimiento del
  // slider, no por frame). Es la L que manda la presión de inyección (Eq 5.19).
  let lMax = 0;
  for (let s = 0; s < nLlenos; s++) if (esc.flowLenMm[s] > lMax) lMax = esc.flowLenMm[s];
  let nW = 0;
  while (nW < esc.nWeld && esc.weldFrac[nW] <= u) nW++;
  let trampas = 0, venteables = 0, trampasTotal = 0;
  for (const v of esc.venteos) {
    if (v.interior) trampasTotal++;
    if (v.fracLlenado > u) continue;
    if (v.interior) trampas++; else venteables++;
  }
  const iR = Math.max(0, Math.min(esc.n - 1, nLlenos - 1));
  return {
    t: u, nLlenos,
    volumenMm3: +(nLlenos * esc.cellMm ** 3).toFixed(1),
    pct: esc.n ? +(100 * nLlenos / esc.n).toFixed(1) : 0,
    lenMaxMm: +lMax.toFixed(2),
    // la resistencia DEL FRENTE: la del último vóxel que entró (el frente es una
    // superficie de ISO-RESISTENCIA, §5.5.5 — no de iso-distancia)
    resistenciaFrente: esc.n && nLlenos > 0 ? +esc.resistencia[iR].toFixed(4) : 0,
    nSoldaduras: nW,
    trampasAlcanzadas: trampas, trampasTotal,
    venteablesAlcanzados: venteables,
    completo: nLlenos >= esc.n,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* EL INVARIANTE: el volumen llenado CRECE MONÓTONO con t                     */
/* ────────────────────────────────────────────────────────────────────────── */

export interface SerieLlenado {
  ts: number[]; vol: number[]; nvox: number[];
  monotona: boolean;
  /** el primer paso donde el volumen BAJÓ (o null si nunca) */
  falla: { i: number; t0: number; t1: number; v0: number; v1: number } | null;
  /** el volumen al final debe ser el volumen alcanzable completo */
  cierraEnTotal: boolean;
}

/**
 * Mide la serie volumen(t) y comprueba la monotonía. Por construcción no puede fallar
 * (el llenado es un prefijo de un arreglo ordenado), y aun así se MIDE: "un invariante
 * que nadie comprueba no es un invariante, es una intención".
 */
export function serieLlenado(esc: EscenaLlenado, pasos = 41): SerieLlenado {
  const ts: number[] = [], vol: number[] = [], nvox: number[] = [];
  for (let i = 0; i < pasos; i++) {
    const t = pasos > 1 ? i / (pasos - 1) : 0;
    const st = estadoLlenado(esc, t);
    ts.push(+t.toFixed(6)); vol.push(st.volumenMm3); nvox.push(st.nLlenos);
  }
  let falla: SerieLlenado['falla'] = null;
  for (let i = 1; i < vol.length && !falla; i++) {
    if (vol[i] < vol[i - 1] - 1e-9) falla = { i, t0: ts[i - 1], t1: ts[i], v0: vol[i - 1], v1: vol[i] };
  }
  return {
    ts, vol, nvox, monotona: !falla, falla,
    cierraEnTotal: Math.abs(vol[vol.length - 1] - esc.volumenMm3) <= 1e-6 + esc.volumenMm3 * 1e-9,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* La LECTURA                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface LecturaVista { titulo: string; valor: string; nota?: string; seccion: string }

export function lecturaLlenado(esc: EscenaLlenado, st: EstadoLlenado): LecturaVista {
  const valor = `${st.pct.toFixed(1)} % llenado · t = ${st.t.toFixed(3)} · L recorrida ${st.lenMaxMm.toFixed(1)} mm`;
  const partes: string[] = [];
  partes.push(`${(st.volumenMm3 / 1000).toFixed(2)} cc de ${(esc.volumenMm3 / 1000).toFixed(2)} cc alcanzables (celda ${esc.cellMm.toFixed(2)} mm)`);
  if (esc.nWeld) partes.push(`${st.nSoldaduras}/${esc.nWeld} vóxeles de SOLDADURA ya formados`);
  else partes.push('sin líneas de soldadura en este campo (el frente no se reencuentra)');
  if (st.trampasTotal) partes.push(`⚠ ${st.trampasAlcanzadas}/${st.trampasTotal} TRAMPAS DE GAS alcanzadas (§5.5.4: cierre interior, no venteable desde la partición)`);
  else partes.push('sin trampas de gas: todos los cierres del frente caen en el borde de la huella');
  if (esc.notas.length) partes.push(esc.notas[0]);
  if (esc.avisos.length) partes.push(`⚠ ${esc.avisos[0]}`);
  return { titulo: 'EL FRENTE LLENA', valor, nota: partes.join(' · '), seccion: '§5.5.4 · L14' };
}

/** Lectura de SONDA: qué pasa en un vóxel concreto (índice del arreglo ordenado). */
export function lecturaPunto(esc: EscenaLlenado, s: number): LecturaVista {
  const i = Math.max(0, Math.min(esc.n - 1, s | 0));
  const f = esc.fracLlega[i];
  return {
    titulo: 'sonda · llegada del frente',
    valor: `llega al ${(100 * f).toFixed(1)} % del llenado (t = ${f.toFixed(3)})`,
    nota: `L = ${esc.flowLenMm[i].toFixed(1)} mm desde la compuerta · espesor local ${esc.espesorMm[i].toFixed(2)} mm`
      + ` · L/t = ${esc.espesorMm[i] > 0 ? (esc.flowLenMm[i] / esc.espesorMm[i]).toFixed(0) : '—'}`,
    seccion: '§5.5.4 · L14',
  };
}
