/**
 * EL CIRCUITO DE AGUA — la geometría 3D del enfriamiento (§9.2.7 · L10).
 * ============================================================================
 * La lámina L10 dibuja el serpentín en PLANTA. Pero el circuito es un objeto en
 * el espacio que convive con expulsores, pernos y pilares, y el conflicto que
 * §9.2.7 anuncia ("limits the placement of other mold components such as ejector
 * pins and bolts") solo se ve en 3D. Este módulo NO rutea nada: el trazo lo hace
 * `coolingCircuit` (§9.2, con el paso de Eq 9.24, la profundidad de Eq 9.22 y el
 * steel-safe direccional) y aquí se le pone lo que la planta no puede mostrar:
 *
 *  1. EL RECORRIDO ORDENADO del refrigerante, de IN a OUT, con el ΔT ACUMULADO
 *     en cada estación. Ese es el argumento de Fig 9.12: Eq 9.13 dimensiona el
 *     caudal para ≤1 °C POR LÍNEA, pero el serpentín pone las N líneas del lado
 *     EN SERIE — la última impresión recibe agua que ya se calentó N veces.
 *     El calor se reparte SOLO donde la línea pasa bajo una impresión (que es
 *     donde entra), no uniforme; si ningún tramo pasa bajo una, se dice.
 *
 *  2. LAS INTERSECCIONES con componentes. §9.2.7 LITERAL: "at least HALF A
 *     COOLING DIAMETER between the surface of the cooling line and the surface
 *     of any other mold component". Se mide contra los barrenos reales
 *     (`enumerateVFeatures`) Y contra el PIN CONTORNEADO de §11.2.5, que el
 *     ruteador NO esquiva porque no está en `standardHoles` — es decir, no lo
 *     VE. Ahí es donde aparece la Fig 9.9 de verdad.
 *
 * PURO → node-testeable (sin DOM, sin three, sin React).
 */
import { coolingCircuit, plateDepth, plateDefs, cavityGrid, cavityFootprint, insertDims } from './mold-drawing-set';
import { plateStackZ } from './mold-plano-set';
import { enumerateVFeatures, type VFeature } from './mold-coords';
import { AGUA, PLASTICOS_A } from './cooling-design';
import type { MoldAssemblySpec } from './mold-assembly';
import { fmt } from './vista3d-comun';

/* ────────────────────────────────────────────────────────────────────────── */

export interface Estacion {
  x: number; y: number; z: number;
  /** arco recorrido desde el puerto IN (mm) */
  sMm: number;
  /** subida de temperatura ACUMULADA desde IN (°C) */
  dtC: number;
  /** ¿este tramo va por debajo/encima de una impresión? (ahí entra el calor) */
  bajoCavidad: boolean;
}

export interface CircuitoLado {
  lado: 'B' | 'A';
  z: number;
  /** el recorrido, ordenado IN → OUT */
  ruta: Estacion[];
  largoMm: number;
  largoBajoCavidadMm: number;
  dtTotalC: number;
  /** distancia de la línea a la SUPERFICIE MOLDEANTE */
  hMm: number; hSobreDia: number;
  hOk: boolean; hNota: string;
  nLineas: number;
  puertos: { inXY: [number, number]; outXY: [number, number] };
  plugs: Array<[number, number]>;
  avisos: string[];
}

export type Sev = 'CRÍTICO' | 'ADVERTENCIA';

export interface Choque {
  x: number; y: number; z: number;
  sev: Sev;
  holguraMm: number; exigidoMm: number;
  componente: string;
  lado: 'B' | 'A';
  /** el componente que choca, para dibujarlo */
  pieza: { x: number; y: number; z0: number; z1: number; dia?: number; ancho?: number; fondo?: number };
}

export interface DatosAgua {
  spec: MoldAssemblySpec;
  D: number; zPart: number;
  diaMm: number;
  circuitos: CircuitoLado[];
  choques: Choque[];
  /** holgura MÍNIMA medida (viaja siempre, haya o no hallazgo) */
  holguraMinMm: number;
  claroExigidoMm: number;
  placas: Array<{ role: string; name: string; z0: number; z1: number; w: number; d: number; mat: string }>;
  cavidades: Array<{ cx: number; cy: number; fx: number; fy: number; round: boolean; depthMm: number }>;
  componentes: Array<{ x: number; y: number; dia: number; z0: number; z1: number; tipo: string; kind: string; choca: Sev | null }>;
  pinContorneado: { x: number; y: number; z0: number; z1: number; ladoMm: number } | null;
  proceso: {
    tInC: number; qCoolingW: number; qLadoW: number;
    vDotLineM3s: number; vDotLineGPM: number; reynolds: number;
    tcS: number; plastico: string; nPerSideDiseno: number;
  };
  notas: string[];
  avisos: string[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Recorrido del serpentín                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** distancia de un punto al segmento [a,b] en el plano */
function distPuntoSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

/** distancia de un punto a un rectángulo alineado (0 si está dentro) */
function distPuntoRect(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy);
}

/**
 * Reconstruye el ORDEN del serpentín. `coolingCircuit` empuja primero los N
 * canales horizontales (en Y creciente) y después los cross-drill que conectan
 * el canal i con el i+1; el agua entra por `ports[0]` y sale por `ports[1]`.
 * Sin este orden no hay "acumulado" que valga: un color por segmento suelto no
 * dice nada del recorrido.
 */
export function rutaSerpentin(cc: ReturnType<typeof coolingCircuit>, z: number): Array<[number, number, number]> {
  const hs = cc.segs.filter((g) => g.y0 === g.y1).slice().sort((a, b) => a.y0 - b.y0);
  const vs = cc.segs.filter((g) => g.x0 === g.x1);
  const inP = cc.ports.find((p) => p.label === 'IN') ?? cc.ports[0];
  const outP = cc.ports.find((p) => p.label === 'OUT') ?? cc.ports[cc.ports.length - 1];
  if (!hs.length) return [];
  const pts: Array<[number, number, number]> = [[inP.x, hs[0].y0, z]];
  for (let i = 0; i < hs.length; i++) {
    const cruce = i < hs.length - 1
      ? vs.find((v) => (Math.min(v.y0, v.y1) === Math.min(hs[i].y0, hs[i + 1].y0) && Math.max(v.y0, v.y1) === Math.max(hs[i].y0, hs[i + 1].y0)))
      : null;
    const xFin = cruce ? cruce.x0 : outP.x;
    pts.push([xFin, hs[i].y0, z]);
    if (cruce) pts.push([xFin, hs[i + 1].y0, z]);
  }
  return pts;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* El pin contorneado §11.2.5                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * EL PIN CONTORNEADO (§11.2.5 Fig 11.13) colocado con la MISMA regla que
 * `lamina-apertura.ts`: se alinea con la cara interior de una pared de la
 * impresión (la del macho) y sube desde la placa expulsora hasta la partición.
 *
 * POR QUÉ ESTÁ AQUÍ Y NO EN EL RUTEADOR: `coolingCircuit` esquiva los obstáculos
 * de `standardHoles`, y este pin NO está ahí. El ruteador no lo VE, así que no
 * puede esquivarlo — y un componente que cruza la línea de agua es exactamente
 * el defecto que Fig 9.9 dibuja. Se declara, no se esconde.
 */
export function pinContorneado(s: MoldAssemblySpec): { x: number; y: number; z0: number; z1: number; ladoMm: number } | null {
  if (s.ejectors.type === 'stripper') return null;                 // no hay pines
  const D = plateDepth(s);
  const z = plateStackZ(s);
  const id = insertDims(s);
  const cells = cavityGrid(s, D);
  if (!cells.length) return null;
  const c = cells[0];
  const dPin = s.ejectors.diaMm;
  // pared −Y de la impresión (el `ladoPin = −1` por defecto de lamina-apertura)
  const yI = c.cy - (id.fy / 2 - id.wall);
  return { x: c.cx, y: yI - dPin / 2, z0: z.ejector, z1: z.A, ladoMm: dPin };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* El armado completo                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export function datosAgua(spec: MoldAssemblySpec): DatosAgua {
  const D = plateDepth(spec);
  const z = plateStackZ(spec);
  const zPart = z.A;
  const cc = coolingCircuit(spec, D);
  const dia = cc.diaMm;
  const cd = cc.design;
  const mat = PLASTICOS_A[(spec.plastic ?? 'ABS').toUpperCase()] ?? PLASTICOS_A.ABS;
  const defs = plateDefs(spec);
  const thick = (r: string) => defs.find((d) => d.role === r)?.thick ?? 40;

  const { fx, fy, round } = cavityFootprint(spec);
  const cells = cavityGrid(spec, D);
  const cavidades = cells.map((c) => ({ cx: c.cx, cy: c.cy, fx, fy, round, depthMm: spec.cavity.depthMm }));

  const notas: string[] = [];
  const avisos: string[] = [...(cc.avisos ?? [])];

  /* ── LOS DOS PLANOS DE AGUA ── */
  const planos: Array<{ lado: 'B' | 'A'; z: number; hMm: number }> = [];
  // lado B: la línea corre por el respaldo del inserto de núcleo; H se mide
  // desde la superficie moldeante, que en B es la PARTICIÓN.
  planos.push({ lado: 'B', z: zPart - Math.min(thick('B') - dia / 2 - 1, cc.zBehindMm), hMm: cc.zBehindMm });
  if (cc.zAboveMm != null) {
    // lado A: la impresión SUBE depthMm sobre la partición, así que H_eff
    // se mide desde el techo de la impresión (Eq 9.22 mide desde el moldeante).
    planos.push({ lado: 'A', z: zPart + Math.min(cc.zAboveMm, thick('A') - dia / 2 - 1), hMm: cc.zAboveMm - spec.cavity.depthMm });
  } else if (cc.aWarn) {
    avisos.push(cc.aWarn);
  }

  /* ── EL PROCESO (§9.2): de dónde sale el ΔT ── */
  const qCooling = cd?.qCoolingW ?? 0;
  const vDot = cd?.vDotLineM3s ?? 0;
  const qLado = qCooling / Math.max(1, planos.length);
  const nLineas = cc.segs.filter((g) => g.y0 === g.y1).length;
  // Eq 9.13 al revés: con el caudal de UNA línea, un serpentín que pone las N
  // líneas del lado EN SERIE sube ΔT = Q_lado/(ρ·cp·V̇) de punta a punta.
  const dtTotal = vDot > 0 ? qLado / (AGUA.rhoKgM3 * AGUA.cpJkgC * vDot) : 0;

  notas.push(
    `el trazo conecta las ${nLineas} líneas del lado EN SERIE (un circuito por lado): ΔT total = Q_lado/(ρ·cp·V̇) = ${fmt(qLado, 0)}/(${AGUA.rhoKgM3}·${AGUA.cpJkgC}·${vDot.toExponential(2)}) = ${fmt(dtTotal, 2)} °C`,
    `Eq 9.13 dimensionó V̇ para ≤ ${fmt(cd ? (cd.qLineW / (AGUA.rhoKgM3 * AGUA.cpJkgC * (cd.vDotLineM3s || 1))) : 1, 2)} °C POR LÍNEA — el serpentín ACUMULA (Fig 9.12)`,
    `el calor se reparte solo donde la línea pasa por la huella de una impresión (ahí entra), no uniforme a lo largo del barreno`,
  );

  /* ── LOS CIRCUITOS, con el acumulado ── */
  const circuitos: CircuitoLado[] = planos.map((pl) => {
    const pts = rutaSerpentin(cc, pl.z);
    // muestreo fino para pesar el calor y para pintar el gradiente
    const PASO = Math.max(2, Math.round(spec.widthMm / 240));
    const crudo: Array<{ x: number; y: number; z: number; s: number; bajo: boolean }> = [];
    let s = 0;
    const dentro = (x: number, y: number) => cavidades.some((c) => (
      c.round ? Math.hypot(x - c.cx, y - c.cy) <= c.fx / 2 : Math.abs(x - c.cx) <= c.fx / 2 && Math.abs(y - c.cy) <= c.fy / 2
    ));
    if (pts.length) crudo.push({ x: pts[0][0], y: pts[0][1], z: pts[0][2], s: 0, bajo: dentro(pts[0][0], pts[0][1]) });
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(L / PASO));
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
        s += L / n;
        crudo.push({ x, y, z: pl.z, s, bajo: dentro(x, y) });
      }
    }
    const largo = s;
    let bajoLargo = 0;
    for (let i = 1; i < crudo.length; i++) if (crudo[i].bajo) bajoLargo += crudo[i].s - crudo[i - 1].s;
    const uniforme = bajoLargo < 1e-6;
    const ruta: Estacion[] = [];
    let acum = 0;
    for (let i = 0; i < crudo.length; i++) {
      if (i > 0) {
        const dl = crudo[i].s - crudo[i - 1].s;
        acum += uniforme ? dl / Math.max(1e-9, largo) : (crudo[i].bajo ? dl / Math.max(1e-9, bajoLargo) : 0);
      }
      ruta.push({ x: crudo[i].x, y: crudo[i].y, z: crudo[i].z, sMm: +crudo[i].s.toFixed(2), dtC: +(acum * dtTotal).toFixed(4), bajoCavidad: crudo[i].bajo });
    }
    const hOverD = pl.hMm / dia;
    const hMaxTermMm = (32 / 1000) * 1000;    // Eq 9.21 con k del P20: H < k/1000 (m) → mm
    const hOk = hOverD >= 2 && hOverD <= 5;
    const inP = cc.ports.find((p) => p.label === 'IN') ?? cc.ports[0];
    const outP = cc.ports.find((p) => p.label === 'OUT') ?? cc.ports[cc.ports.length - 1];
    const av: string[] = [];
    if (uniforme) av.push('ningún tramo pasa por la huella de una impresión: el calor se repartió UNIFORME (declarado, no medido)');
    if (!hOk) av.push(`H/⌀ = ${fmt(hOverD, 2)} fuera de la ventana 2–5 ⌀ de Eq 9.22`);
    if (pl.hMm > hMaxTermMm) av.push(`H = ${fmt(pl.hMm, 1)} mm > k/1000 = ${fmt(hMaxTermMm, 0)} mm (Eq 9.21): la línea, de tan honda, alarga el ciclo`);
    return {
      lado: pl.lado, z: pl.z, ruta, largoMm: +largo.toFixed(1), largoBajoCavidadMm: +bajoLargo.toFixed(1),
      dtTotalC: +dtTotal.toFixed(3), hMm: +pl.hMm.toFixed(1), hSobreDia: +hOverD.toFixed(2), hOk,
      hNota: `H = ${fmt(pl.hMm, 1)} mm = ${fmt(hOverD, 2)} ⌀ — Eq 9.22 pide 2–5 ⌀ (medido desde la SUPERFICIE MOLDEANTE${pl.lado === 'A' ? `, o sea desde el techo de la impresión a ${spec.cavity.depthMm} mm sobre la partición` : ' = la partición'})`,
      nLineas, puertos: { inXY: [inP.x, inP.y], outXY: [outP.x, outP.y] },
      plugs: cc.plugs.map((p) => [p.x, p.y] as [number, number]), avisos: av,
    };
  });

  /* ── LAS INTERSECCIONES (§9.2.7) ── */
  const feats: VFeature[] = enumerateVFeatures(spec);
  const pin = pinContorneado(spec);
  const claro = dia / 2;                                     // ½⌀ LITERAL del libro
  const choques: Choque[] = [];
  let holguraMin = Infinity;
  const compPorClave = new Map<string, Sev | null>();

  for (const pl of planos) {
    const hs = cc.segs;
    // barrenos (cilindros verticales)
    for (const f of feats) {
      if (f.zLo > pl.z || f.zHi < pl.z) continue;             // no llega a ese plano
      let d = Infinity, mejor = { x: 0, y: 0 };
      for (const g of hs) {
        const dd = distPuntoSeg(f.x, f.y, g.x0, g.y0, g.x1, g.y1) - dia / 2 - f.dia / 2;
        if (dd < d) { d = dd; mejor = { x: f.x, y: f.y }; }
      }
      if (!Number.isFinite(d)) continue;
      if (d < holguraMin) holguraMin = d;
      const clave = `${f.plate}|${f.type}|${f.x}|${f.y}`;
      let sev: Sev | null = null;
      if (d < claro) sev = 'CRÍTICO'; else if (d < claro * 1.5) sev = 'ADVERTENCIA';
      if (sev) {
        choques.push({
          x: mejor.x, y: mejor.y, z: pl.z, sev, holguraMm: +d.toFixed(2), exigidoMm: +claro.toFixed(2),
          componente: `${f.type} @(${f.x},${f.y}) en placa ${f.plate}`, lado: pl.lado,
          pieza: { x: f.x, y: f.y, z0: f.zLo, z1: f.zHi, dia: f.dia },
        });
        const prev = compPorClave.get(clave);
        if (prev !== 'CRÍTICO') compPorClave.set(clave, sev);
      } else if (!compPorClave.has(clave)) compPorClave.set(clave, null);
    }
    // el PIN CONTORNEADO (sección cuadrada): distancia rect ↔ eje del canal
    if (pin && pin.z0 <= pl.z && pin.z1 >= pl.z) {
      const half = pin.ladoMm / 2;
      let d = Infinity, px = pin.x, py = pin.y;
      for (const g of hs) {
        const L = Math.hypot(g.x1 - g.x0, g.y1 - g.y0);
        const n = Math.max(1, Math.ceil(L / 1));
        for (let k = 0; k <= n; k++) {
          const f = k / n;
          const x = g.x0 + (g.x1 - g.x0) * f, y = g.y0 + (g.y1 - g.y0) * f;
          const dd = distPuntoRect(x, y, pin.x - half, pin.y - half, pin.x + half, pin.y + half) - dia / 2;
          if (dd < d) { d = dd; px = x; py = y; }
        }
      }
      if (d < holguraMin) holguraMin = d;
      const sev: Sev | null = d < claro ? 'CRÍTICO' : d < claro * 1.5 ? 'ADVERTENCIA' : null;
      if (sev) {
        choques.push({
          x: px, y: py, z: pl.z, sev, holguraMm: +d.toFixed(2), exigidoMm: +claro.toFixed(2),
          componente: `pin CONTORNEADO §11.2.5 ${pin.ladoMm}×${pin.ladoMm} mm @(${pin.x.toFixed(0)},${pin.y.toFixed(0)})`,
          lado: pl.lado,
          pieza: { x: pin.x, y: pin.y, z0: pin.z0, z1: pin.z1, ancho: pin.ladoMm, fondo: pin.ladoMm },
        });
        avisos.push(`el pin contorneado §11.2.5 queda a ${fmt(d, 2)} mm de la línea de agua del lado ${pl.lado} (§9.2.7 exige ${fmt(claro, 2)} mm): el ruteador NO lo esquiva porque no está en \`standardHoles\` — no lo ve`);
      }
    }
  }
  choques.sort((a, b) => (a.sev === 'CRÍTICO' ? 0 : 1) - (b.sev === 'CRÍTICO' ? 0 : 1) || a.holguraMm - b.holguraMm);

  /* ── los componentes que se DIBUJAN (para que el rojo no flote solo) ── */
  const zMin = Math.min(...planos.map((p) => p.z)), zMax = Math.max(...planos.map((p) => p.z));
  const componentes = feats
    .filter((f) => f.zHi >= zMin - 2 && f.zLo <= zMax + 2)
    .map((f) => {
      const clave = `${f.plate}|${f.type}|${f.x}|${f.y}`;
      return { x: f.x, y: f.y, dia: f.dia, z0: f.zLo, z1: f.zHi, tipo: f.type, kind: f.kind, choca: compPorClave.get(clave) ?? null };
    });

  const placas = defs
    .filter((d) => d.role === 'A' || d.role === 'B')
    .map((d) => ({ role: d.role, name: d.name, z0: z[d.role] ?? 0, z1: (z[d.role] ?? 0) + d.thick, w: spec.widthMm, d: D, mat: d.mat }));

  notas.push(
    'MOLDE EN TRANSPARENCIA: se dibujan las placas A y B (las que hospedan el agua). El resto del stack no interviene en §9.2.7.',
    `§9.2.7 LITERAL: "at least HALF A COOLING DIAMETER between the surface of the cooling line and the surface of any other mold component" → ½⌀ = ${fmt(claro, 2)} mm`,
  );

  return {
    spec, D, zPart, diaMm: dia, circuitos, choques,
    holguraMinMm: Number.isFinite(holguraMin) ? +holguraMin.toFixed(2) : NaN,
    claroExigidoMm: +claro.toFixed(2),
    placas, cavidades, componentes, pinContorneado: pin,
    proceso: {
      tInC: mat.tCoolC, qCoolingW: +(qCooling).toFixed(0), qLadoW: +qLado.toFixed(0),
      vDotLineM3s: vDot, vDotLineGPM: +(cd?.vDotLineGPM ?? 0).toFixed(3),
      reynolds: +(cd?.reynolds ?? 0).toFixed(0), tcS: +(cd?.tcS ?? 0).toFixed(2),
      plastico: (spec.plastic ?? 'ABS').toUpperCase(), nPerSideDiseno: cd?.nPerSide ?? 0,
    },
    notas, avisos,
  };
}

/** La estación del recorrido en la fracción `t` del circuito (0 = IN, 1 = OUT). */
export function estacionEn(c: CircuitoLado, t: number): Estacion {
  if (!c.ruta.length) return { x: 0, y: 0, z: c.z, sMm: 0, dtC: 0, bajoCavidad: false };
  const q = Math.max(0, Math.min(1, t)) * c.largoMm;
  let lo = 0, hi = c.ruta.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (c.ruta[m].sMm < q) lo = m + 1; else hi = m; }
  return c.ruta[lo];
}
