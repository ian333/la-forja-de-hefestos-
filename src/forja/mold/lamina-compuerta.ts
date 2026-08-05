/**
 * L7 · DETALLE EN SECCIÓN DE LA COMPUERTA (+ PERFIL DEL CANAL) — Kazmer caps 6-7
 * ============================================================================
 * El ZOOM en sección sobre el gate, con ángulos y diámetros ACOTADOS sobre el
 * propio dibujo, más el panel comparativo del perfil transversal del runner.
 * No hay motor de corte nuevo: esta lámina consume el de L5
 * (`lamina-seccion.ts` · `seccionarPorPlano`) con otra ventana de encuadre.
 *
 * Cubre once verificaciones del pliego:
 *   V7.2  §7.2.1 Fig 7.2-7.3  — sprue gate: vestigio contra el plano de apoyo (rim / gate well)
 *   V7.3  §7.2.2 Fig 7.4      — pin-point: el REVERSE TAPER (signo del cono) y la razón L/⌀
 *   V7.5  §7.2.5 Fig 7.7-7.8  — fan gate: ancho del abanico ≈ ancho de la pieza + resistencia
 *   V7.6  §7.2.6 Fig 7.9-7.10 — espesor del gate (a minimizar) y extensión de la línea testigo
 *   V7.7  §7.2.7 Fig 7.11-13  — tunnel gate: 45° al parting · cono ≥ 20° · ≥ 3 ⌀ del plano
 *   V7.8  §7.2.7 Fig 7.14     — submarine extendido: la trayectoria no cruza superficie visible
 *   V7.9  §7.2.8 Fig 7.15-16  — gate térmico: orificios estrechos vs. bore abierto
 *   V7.10 §7.2.9 Fig 7.17     — valve gate: escalón cara del vástago ↔ cavidad ≈ 0
 *   V6.3  §6.5.1 Fig 6.20     — eficiencia del perfil del runner (área vs. perímetro mojado)
 *   V6.4  §6.5.1 Fig 6.21     — sección ANULAR del valve gate (⌀ hidráulico equivalente)
 *   V6.5  §6.5.2 Fig 6.22     — intrusión del sucker pin en el canal
 *
 * ═══ QUÉ ES LITERAL Y QUÉ ES EXTENSIÓN ══════════════════════════════════════
 * Los umbrales duros salen del libro CON su § al lado, en el punto donde se usan:
 *   · §7.2.7 "a nominal 45 degree angle should be maintained between [el eje del
 *     túnel y el plano de partición]" · "an included taper angle of at least 20
 *     degrees" · "at least three tunnel diameters off the parting plane"
 *   · §6.5.1 Tabla 6.3 — redondo 100 % · trapezoide de fondo redondo 87.9 % ·
 *     trapezoidal 78.5 % · medio redondo 61.2 % (y el ranking verbal)
 *   · §6.5.2 sucker: ⌀ "slightly less than the diameter of the associated runner";
 *     "Typical heights and taper angles are one half the runner diameter and 5
 *     degrees"; "it is preferred to align the top of the ejector pin with the
 *     bottom of the runner"
 *   · §7.2.9 "the face of the valve pin presents a mold shut-off surface to the
 *     mold cavity when closed" → escalón ≈ 0
 *   · §7.2.2 "A properly designed pin-point gate will have a reverse taper between
 *     the cavity surface and the gate breakpoint"; largo "on the order of its diameter"
 *   · §7.2.3 "the thickness of the edge gate should be less than the wall thickness
 *     of the molding" · "The width of the gate should be less than the diameter of
 *     the runner"
 *   · §7.3.2 semilla de espesor: pared para gates gruesos, ½·pared para los delgados
 *   · §6.5.5 el ⌀ de canal se redondea HACIA ABAJO a fresa de catálogo (steel-safe)
 * Todo lo demás va marcado EXTENSIÓN DECLARADA en el código Y en la lámina, y lo
 * que NO se puede medir sale SIN CABLEAR (ámbar) y tumba el veredicto: jamás verde.
 *
 * ═══ EL SIGNO DEL REVERSE TAPER (§7.2.2) — decisión declarada ═══════════════
 * "Reverse" se juzga CONTRA EL BEBEDERO, que es el cono normal del molde: el
 * bebedero se extrae hacia la pieza, así que su ⌀ CRECE hacia la pieza (§6.3.1,
 * y es lo que calcula `designSprueFeed`: rBase > rTop). El pin-point se extrae al
 * REVÉS (sube con la placa de coladas del molde de tres placas), así que su cono
 * crece hacia el BREAKPOINT — invertido respecto al bebedero, que es lo que el
 * libro llama "inverted sprue". Por eso el plug sale hacia arriba y REVIENTA en
 * la cara de la cavidad, dejando el vestigio mínimo. Se juzga el SIGNO de la
 * pendiente, nunca su magnitud, y el signo de referencia se MIDE en el dibujo
 * del bebedero, no se teclea.
 *
 * ═══ LA EFICIENCIA DEL PERFIL SE VERIFICA SIN CITAR AL LIBRO ════════════════
 * El ranking de Fig 6.20 no se copia: EMERGE del cociente isoperimétrico
 * Q = 4πA/P², que vale 1 SOLO en el círculo (desigualdad isoperimétrica) y es
 * invariante de escala. Con la construcción de aquí da
 * redondo 1.000 > fondo redondo 0.854 > trapecio 0.781 > medio redondo 0.747,
 * que es exactamente el orden que §6.5.1 publica. Se reporta además Dh/⌀ (misma
 * envolvente, que es la métrica de la Tabla 6.3: reproduce 61.1 % del medio
 * redondo contra el 61.2 % impreso) y el % LITERAL de la tabla.
 */
import type { MoldAssemblySpec } from './mold-assembly';
import type { Lamina } from './laminas-visuales';
import {
  seccionarPorPlano, mallaCaja, mallaCilindro, unirMallas,
  type MallaSec, type SolidoSeccion, type PlanoCorte, type Seccion,
  type LazoSeccion, type PiezaSeccionada, type Vec2, type Vec3, type EstadoV,
} from './lamina-seccion';
import { steelSafeDiaMm, FEED_MATERIALS, sprueDesignFromCavity } from './feed';
import { shearRateCyl, shearRateStrip, gateDropStripPL, GATE_TABLE, type GateType } from './gating';
import { suckerPinDesign } from './threeplate';
import { verificarTamanoMinimo, type RasgoBajoJuicio } from '../verificacion/fiducial';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/** Los diez tipos de la Tabla 7.1 + los dos que el capítulo dibuja aparte
 *  (diaphragm §7.2.6 y el submarino extendido "banana" §7.2.7 Fig 7.14). */
export type TipoCompuerta =
  | 'sprue' | 'pin-point' | 'edge' | 'tab' | 'fan' | 'flash' | 'diaphragm'
  | 'tunnel' | 'banana' | 'valve' | 'thermal-pin' | 'thermal-sprue';

/** Los cuatro perfiles de Fig 6.20 + el hexágono, que NO es del libro y solo
 *  entra como fixture analítico (Dh = √3·a en forma cerrada). */
export type PerfilId = 'redondo' | 'trapezoide-fondo-redondo' | 'trapezoidal' | 'medio-redondo' | 'hexagonal';

/** CUMPLE/ADVIERTE/VIOLA/SIN CABLEAR son los de L5. Se agregan dos que esta
 *  lámina necesita para no mentir: NO APLICA (la verificación no rige a ESTE
 *  tipo de compuerta — no es lo mismo que "no medido") y DESCRIPTIVA (el libro
 *  publica la geometría SIN par bueno/malo; se mide y se reporta, no se juzga). */
export type EstadoC = EstadoV | 'NO APLICA' | 'DESCRIPTIVA';

export interface VeredictoC {
  id: string; titulo: string; cita: string;
  estado: EstadoC;
  medido?: string; limite?: string;
  porque: string;
}

export type CotaC =
  /** cota lineal entre dos puntos del MUNDO (mm), sacada `offPx` píxeles */
  | { k: 'lin'; id: string; texto: string; ref: string; estado: EstadoC; p: Vec2; q: Vec2; offPx: number }
  /** cota angular: vértice + dos direcciones en grados del mundo (x→derecha, z→arriba) */
  | { k: 'ang'; id: string; texto: string; ref: string; estado: EstadoC; v: Vec2; a0: number; a1: number; rPx: number }
  /** llamada con línea de referencia (para cotas que no se ven, tipo escalón ≈ 0) */
  | { k: 'nota'; id: string; texto: string; ref: string; estado: EstadoC; p: Vec2; dxPx: number; dyPx: number };

export interface PerfilGeom {
  id: PerfilId; nombre: string;
  /** polígono CERRADO del perfil en (x,z) mm, ya colocado respecto al plano de
   *  partición (z=0): el redondo lo cruza a la mitad, los demás cuelgan de él. */
  pts: Vec2[];
  diaNomMm: number;
  areaMm2: number; perimMm: number; dhMm: number;
  /** cociente isoperimétrico 4πA/P² — 1 SOLO en el círculo, invariante de escala */
  qIso: number;
  /** Dh/⌀ nominal: la métrica de la Tabla 6.3 (misma envolvente) */
  efDhPct: number;
  /** % LITERAL de la Tabla 6.3 (null en el hexágono, que no es del libro) */
  efLibroPct: number | null;
  /** ¿se maquina en las DOS mitades del molde? */
  dosPlacas: boolean;
  nota: string;
}

export interface MetaCompuerta {
  tipo: TipoCompuerta;
  familia: 'axial' | 'lateral';
  nombre: string;
  /** cotas resueltas (mm) */
  paredMm: number; runnerDiaMm: number; gateEspesorMm: number; gateAnchoMm: number; gateLargoMm: number;
  perfil: PerfilGeom | null;
  /** z del plano de partición en el marco local (siempre 0: el marco se ancla ahí) */
  zPartMm: number;
  /** superficie de la pieza clasificada (para V7.8) */
  visibles: Array<[Vec2, Vec2]>;
  ocultas: Array<[Vec2, Vec2]>;
  /** ventana del zoom en mm */
  ventana: { u0: number; u1: number; v0: number; v1: number };
  /** lo COMANDADO — el gate compara contra lo MEDIDO en el dibujo, nunca al revés */
  comandado: Record<string, number>;
  /** flujo, si se pudo resolver */
  VdotM3s: number | null; material: string; shearMaxS: number | null;
  extensiones: string[];
  avisos: string[];
}

export interface MedidasCompuerta {
  cotas: CotaC[];
  veredictos: VeredictoC[];
  datos: Record<string, number | string | null>;
  /** verde SOLO si no hay VIOLA y no hay SIN CABLEAR */
  verde: boolean;
}

export interface OpcionesCompuerta {
  tipo: TipoCompuerta;
  /** de aquí salen pared, ⌀ de canal (§6.3.1+§6.5.5) y V̇ (§6.4.6) si vienen */
  spec?: MoldAssemblySpec;
  perfil?: PerfilId;
  nombre?: string;
  paredMm?: number;
  runnerDiaMm?: number;
  gateEspesorMm?: number;
  gateAnchoMm?: number;
  gateLargoMm?: number;
  // ── tunnel / banana (§7.2.7) ──
  tunelEjeDeg?: number;        // nominal 45 (LITERAL)
  tunelConoDeg?: number;       // ≥ 20 incluido (LITERAL)
  tunelOffsetDia?: number;     // ≥ 3 ⌀ del plano (LITERAL)
  // ── pin-point (§7.2.2) ──
  reverseTaper?: boolean;      // false = el defecto que V7.3 caza
  // ── sprue (§7.2.1) ──
  vestigioMm?: number | null;  // sin declarar ⇒ V7.2 SIN CABLEAR
  gateWellMm?: number;         // rebaje de Fig 7.3
  rimMm?: number;              // rim de Fig 7.2
  // ── valve (§7.2.9) ──
  pose?: 'cerrada' | 'abierta';
  vastagoDiaMm?: number; canalCalienteDiaMm?: number;
  escalonMm?: number;          // el defecto a medir (0 = al ras)
  tolEscalonMm?: number;
  carreraMm?: number;
  // ── sucker pin (§6.5.2) ──
  suckerPin?: boolean; suckerIntrusionMm?: number; suckerDiaMm?: number;
  // ── fan (§7.2.5) ──
  fanAnchoMm?: number; piezaAnchoMm?: number;
  // ── térmicos (§7.2.8) ──
  nOrificios?: number; orificioDiaMm?: number; boreDiaMm?: number; pielMm?: number;
  // ── flujo ──
  VdotM3s?: number; material?: string;
  /** amplía/reduce la ventana del zoom SIN tocar ninguna cota (invariancia) */
  zoom?: number;
  ancho?: number; alto?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// §6.5.1 — LOS PERFILES DE Fig 6.20 Y SU EFICIENCIA
// ─────────────────────────────────────────────────────────────────────────────

/** Tabla 6.3 (LITERAL): eficiencia relativa de cada sección de canal. */
export const TABLA_6_3: Record<PerfilId, number | null> = {
  'redondo': 100,
  'trapezoide-fondo-redondo': 87.9,
  'trapezoidal': 78.5,
  'medio-redondo': 61.2,
  'hexagonal': null,
};
/** El ranking VERBAL de §6.5.1, de mejor a peor (es el que la lámina verifica). */
export const ORDEN_LIBRO: PerfilId[] = ['redondo', 'trapezoide-fondo-redondo', 'trapezoidal', 'medio-redondo'];

const NOMBRE_PERFIL: Record<PerfilId, string> = {
  'redondo': 'redondo completo',
  'trapezoide-fondo-redondo': 'trapezoide de fondo redondo',
  'trapezoidal': 'trapezoidal',
  'medio-redondo': 'medio redondo',
  'hexagonal': 'hexagonal (NO es del libro)',
};

/** área con signo (zapatero) y perímetro de un polígono cerrado */
function areaPerim(pts: Vec2[]): { area: number; perim: number } {
  let a = 0, p = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i], r = pts[(i + 1) % pts.length];
    a += q[0] * r[1] - r[0] * q[1];
    p += Math.hypot(r[0] - q[0], r[1] - q[1]);
  }
  return { area: a / 2, perim: p };
}
/** deja el polígono en sentido ANTIHORARIO (área positiva) */
function ccw(pts: Vec2[]): Vec2[] {
  return areaPerim(pts).area < 0 ? pts.slice().reverse() : pts;
}

/**
 * Genera el perfil de un canal de ⌀ nominal D, YA COLOCADO respecto al plano de
 * partición (z = 0).
 *   · redondo y hexagonal: CENTRADOS en la partición (se maquinan en las dos
 *     mitades — es el costo que §6.5.1 le cobra al redondo).
 *   · medio redondo, trapecios: cuelgan de la partición (una sola mitad).
 * Las proporciones del trapecio (ancho = ⌀, profundidad = ⌀, 5° por lado) son
 * EXTENSIÓN DECLARADA: el pliego publica el ranking y los %, no las cotas de
 * Fig 6.20. Por eso el ORDEN se juzga con Q (invariante de escala) y no con el %.
 */
export function perfilRunner(id: PerfilId, D: number, o?: {
  n?: number; anchoRel?: number; profRel?: number; taperDeg?: number;
}): PerfilGeom {
  const n = Math.max(16, o?.n ?? 128);
  const W = D * (o?.anchoRel ?? 1);
  const H = D * (o?.profRel ?? 1);
  const th = ((o?.taperDeg ?? 5) * Math.PI) / 180;
  const t = Math.tan(th);
  let pts: Vec2[] = [];
  let dosPlacas = false;
  let nota = '';
  if (id === 'redondo') {
    const r = D / 2;
    for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    dosPlacas = true;
    nota = 'centrado en la partición: exige maquinar las DOS mitades';
  } else if (id === 'hexagonal') {
    const r = D / 2;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 2 * Math.PI; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    dosPlacas = true;
    nota = 'EXTENSIÓN: no está en Fig 6.20 — entra como fixture (Dh = √3·a exacto)';
  } else if (id === 'medio-redondo') {
    const r = D / 2;
    pts.push([r, 0]);
    for (let i = 1; i < n; i++) { const a = -(i / n) * Math.PI; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    pts.push([-r, 0]);
    nota = 'una sola mitad: la cara plana ES la del plato opuesto (y va mojada)';
  } else if (id === 'trapezoidal') {
    pts = [[W / 2, 0], [W / 2 - H * t, -H], [-W / 2 + H * t, -H], [-W / 2, 0]];
    nota = `EXTENSIÓN: ancho ${W.toFixed(1)} × prof ${H.toFixed(1)} mm, ${(o?.taperDeg ?? 5)}°/lado (Fig 6.20 no acota)`;
  } else {
    // trapecio con FONDO REDONDO tangente a los dos flancos, misma envolvente
    const a0 = W / 2;
    const r = ((a0 * Math.cos(th)) - H * Math.sin(th)) / (1 - Math.sin(th));
    const zc = H - r;                                   // centro del arco
    const tt = a0 * Math.sin(th) + zc * Math.cos(th);   // avance hasta el punto de tangencia
    const Tx = a0 - tt * Math.sin(th), Tz = -tt * Math.cos(th);
    pts.push([a0, 0], [Tx, Tz]);
    const f0 = Math.atan2(Tz + zc, Tx);                 // ángulo del punto de tangencia
    const f1 = Math.PI - f0;
    const m = Math.max(8, Math.round(n / 2));
    for (let i = 1; i < m; i++) {                        // arco por ABAJO (de f0 hacia f1 pasando por −90°)
      const a = f0 - (i / m) * (2 * Math.PI - (f1 - f0));
      pts.push([r * Math.cos(a), -zc + r * Math.sin(a)]);
    }
    pts.push([-Tx, Tz], [-a0, 0]);
    nota = `EXTENSIÓN: mismo envolvente que el trapecio, fondo ⌀${(2 * r).toFixed(2)} TANGENTE a los flancos`;
  }
  pts = ccw(pts);
  const { area, perim } = areaPerim(pts);
  const dh = (4 * area) / perim;
  return {
    id, nombre: NOMBRE_PERFIL[id], pts, diaNomMm: D,
    areaMm2: area, perimMm: perim, dhMm: dh,
    qIso: (4 * Math.PI * area) / (perim * perim),
    efDhPct: (dh / D) * 100,
    efLibroPct: TABLA_6_3[id],
    dosPlacas, nota,
  };
}

/** Los cuatro de Fig 6.20 ordenados por Q (así el ranking del libro se VERIFICA,
 *  no se copia: Q es un teorema, no una tabla). */
export function rankingPorQ(D: number, o?: Parameters<typeof perfilRunner>[2]): PerfilGeom[] {
  return ORDEN_LIBRO.map((id) => perfilRunner(id, D, o)).sort((a, b) => b.qIso - a.qIso);
}

// ─────────────────────────────────────────────────────────────────────────────
// MALLAS PROPIAS DE ESTA LÁMINA (las de L5 no cubren eje inclinado ni revolución)
// Convención: el plano de corte es y = 0, así que todo se factoriza para que el
// plano pase por VÉRTICES de la malla → la sección es EXACTA, no interpolada.
// ─────────────────────────────────────────────────────────────────────────────

/** Extruye un polígono (x,z) a lo largo de Y. Normales SALIENTES (volumen > 0). */
export function mallaPrismaPerfil(pts: Vec2[], y0: number, y1: number, dz = 0): MallaSec {
  const P: number[] = [], I: number[] = [];
  const m = pts.length;
  for (const q of pts) P.push(q[0], y0, q[1] + dz);
  for (const q of pts) P.push(q[0], y1, q[1] + dz);
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    I.push(i, m + i, m + j, i, m + j, j);
  }
  let cx = 0, cz = 0;
  for (const q of pts) { cx += q[0] / m; cz += (q[1] + dz) / m; }
  const c0 = P.length / 3; P.push(cx, y0, cz);
  const c1 = P.length / 3; P.push(cx, y1, cz);
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    I.push(c0, i, j);
    I.push(c1, m + j, m + i);
  }
  return { positions: P, indices: I };
}

/**
 * BARRIDO de radio variable por una trayectoria que VIVE en el plano y = 0.
 * El marco de cada anillo pone e1 dentro del plano de corte, así que con `n` PAR
 * y fase 0 hay vértices exactamente sobre y = 0: la sección de un tronco recto
 * es el trapecio EXACTO de área L·(r₀+r₁), y la de un barrido curvo es un lazo
 * cerrado sin interpolación. Sirve para el túnel a 45° y para el banana.
 */
export function mallaBarrido(centros: Vec3[], radios: number[], n = 48): MallaSec {
  const N = centros.length;
  const P: number[] = [], I: number[] = [];
  const anillos: number[] = [];
  for (let k = 0; k < N; k++) {
    const a = centros[Math.min(k + 1, N - 1)], b = centros[Math.max(k - 1, 0)];
    let tx = a[0] - b[0], tz = a[2] - b[2];
    const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
    const e1: Vec3 = [tz, 0, -tx];                    // e1 × ŷ = tangente (terna derecha)
    anillos.push(P.length / 3);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th), r = radios[k];
      P.push(centros[k][0] + r * c * e1[0], centros[k][1] + r * s, centros[k][2] + r * c * e1[2]);
    }
  }
  for (let k = 0; k + 1 < N; k++) {
    const A = anillos[k], B = anillos[k + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      I.push(A + i, A + j, B + j, A + i, B + j, B + i);
    }
  }
  const cA = P.length / 3; P.push(centros[0][0], centros[0][1], centros[0][2]);
  const cB = P.length / 3; P.push(centros[N - 1][0], centros[N - 1][1], centros[N - 1][2]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    I.push(cA, anillos[0] + j, anillos[0] + i);
    I.push(cB, anillos[N - 1] + i, anillos[N - 1] + j);
  }
  return { positions: P, indices: I };
}

/** Tronco de cono de eje ARBITRARIO dentro del plano de corte. */
export function mallaTronco(p0: Vec3, p1: Vec3, r0: number, r1: number, n = 48): MallaSec {
  return mallaBarrido([p0, p1], [r0, r1], n);
}

/**
 * SÓLIDO DE REVOLUCIÓN alrededor del eje vertical que pasa por (cx, cy).
 * `perfil` = polígono cerrado en (r, z) con r ≥ 0, sentido antihorario.
 * Invariante que el gate usa: la sección por el eje = DOS copias del perfil, o
 * sea área = 2·área(perfil) EXACTA. Con eso se modela el pin ranurado del sucker
 * (§6.5.2), el torpedo térmico y el vestigio del bebedero sin booleanas.
 */
export function mallaRevolucion(perfil: Vec2[], cx: number, cy: number, n = 64): MallaSec {
  const pts = ccw(perfil);
  const m = pts.length;
  const P: number[] = [], I: number[] = [];
  for (const q of pts) {
    for (let i = 0; i < n; i++) {
      const th = (i / n) * 2 * Math.PI;
      P.push(cx + q[0] * Math.cos(th), cy + q[0] * Math.sin(th), q[1]);
    }
  }
  for (let k = 0; k < m; k++) {
    const kk = (k + 1) % m, A = k * n, B = kk * n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      I.push(A + i, A + j, B + j, A + i, B + j, B + i);
    }
  }
  return { positions: P, indices: I };
}

// ─────────────────────────────────────────────────────────────────────────────
// EL MODELO DEL DETALLE — sólidos en un marco LOCAL con z = 0 en la partición
// (para las compuertas axiales, z = 0 es la superficie de cavidad gateada y el
//  plano de partición se declara aparte: no cae dentro del zoom).
// ─────────────────────────────────────────────────────────────────────────────

const YE = 30;          // medio-largo fuera del plano de corte (mm)
const NF = 64;          // facetas (PAR: el plano de corte pasa por vértices)

/** §7.3.2: gates "delgados" arrancan en ½ de la pared; los gruesos, en la pared. */
const GATE_DELGADO: Record<TipoCompuerta, boolean> = {
  'sprue': false, 'pin-point': true, 'edge': false, 'tab': false, 'fan': false,
  'flash': true, 'diaphragm': true, 'tunnel': true, 'banana': true,
  'valve': false, 'thermal-pin': true, 'thermal-sprue': false,
};
const FAMILIA: Record<TipoCompuerta, 'axial' | 'lateral'> = {
  'sprue': 'axial', 'pin-point': 'axial', 'diaphragm': 'axial', 'valve': 'axial',
  'thermal-pin': 'axial', 'thermal-sprue': 'axial',
  'edge': 'lateral', 'tab': 'lateral', 'fan': 'lateral', 'flash': 'lateral',
  'tunnel': 'lateral', 'banana': 'lateral',
};
/** mapeo al catálogo de `gating.ts` (banana y diaphragm no están en la Tabla 7.1) */
const A_GATETYPE: Partial<Record<TipoCompuerta, GateType>> = {
  'sprue': 'sprue', 'pin-point': 'pin-point', 'edge': 'edge', 'tab': 'tab', 'fan': 'fan',
  'flash': 'flash', 'tunnel': 'tunnel', 'valve': 'valve',
  'thermal-pin': 'thermal-pin', 'thermal-sprue': 'thermal-sprue',
};

export interface ModeloCompuerta { solidos: SolidoSeccion[]; plano: PlanoCorte; meta: MetaCompuerta }

const caja = (x0: number, z0: number, x1: number, z1: number): MallaSec =>
  mallaCaja(x0, -YE, z0, x1, YE, z1);

/**
 * Arma el detalle. Todo sólido se construye para que el plano y = 0 lo corte por
 * vértices, y ninguno se traslapa consigo mismo (los lazos de una misma pieza se
 * pintan con `evenodd`: dos cajas encimadas dejarían un agujero falso).
 */
export function modeloCompuerta(o: OpcionesCompuerta): ModeloCompuerta {
  const ext: string[] = [], avisos: string[] = [];
  const tipo = o.tipo, familia = FAMILIA[tipo];
  const h = o.paredMm ?? o.spec?.cavity.wallMm ?? 2;

  // ── ⌀ del canal: del ⌀ de salida del bebedero (§6.3.1) redondeado HACIA ABAJO
  //    a fresa de catálogo (§6.5.5, steel-safe: el acero se quita, no se pone) ──
  let D: number;
  if (o.runnerDiaMm != null) D = o.runnerDiaMm;
  else if (o.spec) {
    const fd = sprueDesignFromCavity(o.spec.plastic, o.spec.cavity, 60);
    D = steelSafeDiaMm(2 * fd.rBaseMm);
    ext.push(`⌀ del canal = ⌀ de salida del bebedero ${(2 * fd.rBaseMm).toFixed(2)} mm (§6.3.1) → §6.5.5 steel-safe a fresa de catálogo: ⌀${D}`);
  } else {
    D = steelSafeDiaMm(2 * h);
    ext.push(`sin spec ni ⌀ dado: ⌀ del canal = 2·pared redondeado steel-safe (⌀${D}) — el libro NO da esa regla`);
  }

  // ── espesor y ancho del gate: semilla §7.3.2 ──
  const t = o.gateEspesorMm ?? h * (GATE_DELGADO[tipo] ? 0.5 : 1);
  const w = o.gateAnchoMm ?? 2 * t;
  const Lg = o.gateLargoMm ?? Math.max(0.8, t);
  if (o.gateEspesorMm == null) ext.push(`espesor del gate = semilla §7.3.2 (${GATE_DELGADO[tipo] ? '½·pared, gate delgado' : 'pared, gate grueso'}) = ${t.toFixed(2)} mm`);
  if (o.gateLargoMm == null) ext.push(`largo del land = max(0.8, espesor) = ${Lg.toFixed(2)} mm (el libro solo acota el pin-point: "on the order of its diameter")`);

  // ── flujo (para γ̇ y ΔP con las fórmulas del propio libro) ──
  const material = o.material ?? o.spec?.plastic ?? 'PP';
  const mat = FEED_MATERIALS[material] ?? null;
  let Vdot: number | null = o.VdotM3s ?? null;
  if (Vdot == null && o.spec) Vdot = sprueDesignFromCavity(o.spec.plastic, o.spec.cavity, 60).VdotCcS * 1e-6;

  const S: SolidoSeccion[] = [];
  const visibles: Array<[Vec2, Vec2]> = [];
  const ocultas: Array<[Vec2, Vec2]> = [];
  const cmd: Record<string, number> = { paredMm: h, runnerDiaMm: D, espesorMm: t, anchoMm: w, largoMm: Lg };
  let perfil: PerfilGeom | null = null;
  const acero = (id: string, nombre: string, m: MallaSec, nota?: string) =>
    S.push({ id, nombre, rol: 'inserto', material: 'acero de molde', malla: m, nota });
  const plast = (id: string, nombre: string, m: MallaSec, nota?: string) =>
    S.push({ id, nombre, rol: 'colada', malla: m, nota });
  const pieza = (m: MallaSec, nota?: string) =>
    S.push({ id: 'moldeo', nombre: 'PIEZA (moldeo)', rol: 'moldeo', malla: m, nota });
  const comp = (id: string, nombre: string, m: MallaSec, nota?: string) =>
    S.push({ id, nombre, rol: 'componente', malla: m, nota });

  let ventana = { u0: -6, u1: 6, v0: -6, v1: 6 };

  if (familia === 'lateral') {
    // ══ LATERAL: canal sobre la partición (z=0) y pieza a la derecha ══
    perfil = perfilRunner(o.perfil ?? 'redondo', D, { n: 96 });
    const kDia = o.tunelOffsetDia ?? 3;                       // §7.2.7 ≥ 3 ⌀
    const ejeDeg = o.tunelEjeDeg ?? 45;                       // §7.2.7 nominal 45°
    const conoDeg = o.tunelConoDeg ?? 20;                     // §7.2.7 incluido ≥ 20°

    if (tipo === 'tunnel') {
      // el 45° AMARRA la geometría: bajar k·⌀ obliga a correrse k·⌀ en X
      const dGate = t;                                        // el "tunnel diameter" es el ⌀ del gate en la pieza
      const off = kDia * dGate;
      const rad = (ejeDeg * Math.PI) / 180;
      const xPieza = 0;
      const dz = off, dx = off / Math.tan(rad);
      const xRun = xPieza - dx;
      const dep = Math.max(off * 2.2, 4 * h);
      // pieza: pared vertical + piso, cajas DISJUNTAS
      pieza(unirMallas([
        caja(xPieza, -dep + h, xPieza + h, 0),
        caja(xPieza, -dep, xPieza + 9 * h, -dep + h),
      ]), 'pared + piso (la pieza vive del lado del núcleo)');
      visibles.push([[xPieza, 0], [xPieza, -dep + h]]);        // cara EXTERIOR de la pared: se ve
      ocultas.push([[xPieza + h, 0], [xPieza + h, -dep + h]]);
      acero('ins-A', 'Inserto de CAVIDAD (placa A)', caja(xRun - 6 * D, 0, xPieza + 9 * h, 6 * D));
      acero('ins-B', 'Inserto de NÚCLEO (placa B)', unirMallas([
        caja(xRun - 6 * D, -dep - 4 * h, xPieza, 0),
        caja(xPieza + h, -dep - 4 * h, xPieza + 9 * h, -dep + h),
        caja(xPieza + h, -dep + h, xPieza + 9 * h, 0),
      ]));
      plast('runner', `Canal ⌀${D} · ${perfil.nombre}`, mallaPrismaPerfil(perfil.pts.map((p) => [p[0] + xRun, p[1]] as Vec2), -YE, YE), perfil.nota);
      // el cono del túnel: del punto de entrada a la pieza al centro del canal
      const P0: Vec3 = [xPieza, 0, -dz];
      const P1: Vec3 = [xRun, 0, 0];
      const L = Math.hypot(P1[0] - P0[0], P1[2] - P0[2]);
      const r0 = dGate / 2, r1 = r0 + L * Math.tan((conoDeg / 2 * Math.PI) / 180);
      plast('gate', 'Tunnel gate §7.2.7', mallaTronco(P0, P1, r0, r1, NF), `⌀${(2 * r0).toFixed(2)} → ⌀${(2 * r1).toFixed(2)}`);
      cmd.offsetMm = off; cmd.ejeDeg = ejeDeg; cmd.conoDeg = conoDeg; cmd.offsetDia = kDia; cmd.dGateMm = dGate;
      cmd.xRun = xRun;
      ventana = { u0: xRun - 1.5 * D, u1: xPieza + 2.6 * h + 1, v0: -off - 2.1 * h, v1: 1.25 * D };
      if (o.suckerPin !== false) agregaSucker(S, comp, plast, xRun, D, o, ext, cmd);
    } else if (tipo === 'banana') {
      // ══ SUBMARINO EXTENDIDO (Fig 7.14): el gate DA LA VUELTA por debajo de la
      //    cara vista y entra por el costado de un boss — superficie OCULTA.
      //    La geometría se cierra sola: raíz recta a 45° desde el canal (que es
      //    donde §7.2.7 mide el ángulo con el plano de partición) + arco tangente
      //    que termina HORIZONTAL contra el boss. Con eso el radio del arco NO se
      //    elige a gusto: sale de exigir que la raíz arranque en la partición.
      const dGate = t, hb = 3 * h, xP = 0;
      const zE = -(h + hb / 2);                                // altura de entrada al boss
      const xE = xP + 2 * h;                                   // cara IZQUIERDA del boss (oculta)
      const Lr = 1.2 * h;                                      // largo de la raíz recta
      const c45 = Math.SQRT1_2;
      const Ra = (-zE - c45 * Lr) / (1 - c45);                 // ⇐ la raíz nace en z = 0
      const Cc: Vec2 = [xE, zE + Ra];
      const semi = (conoDeg / 2 * Math.PI) / 180;
      const arco = (Math.PI / 4);                              // de −45° a 0°
      const Ltot = Lr + Ra * arco;
      const rAt = (s: number) => dGate / 2 + s * Math.tan(semi);   // s = recorrido desde la boca
      const m = 20;
      const cen: Vec3[] = [], rr: number[] = [];
      for (let i = 0; i <= m; i++) {
        const th = -(i / m) * arco;                            // de 0 (boca) a −45° (raíz)
        cen.push([Cc[0] + Ra * Math.sin(th), 0, Cc[1] - Ra * Math.cos(th)]);
        rr.push(rAt((i / m) * Ra * arco));
      }
      const A0 = cen[m];                                       // arranque del arco = fin de la raíz
      const Prun: Vec3 = [A0[0] - Lr * c45, 0, A0[2] + Lr * c45];
      const dep = -zE + 4 * h;
      pieza(unirMallas([
        caja(xP, -h, xP + 9 * h, 0),
        caja(xP + 2 * h, -h - hb, xP + 4 * h, -h),
      ]), 'cara vista arriba + boss colgado (Fig 7.14 gatea por debajo)');
      visibles.push([[xP, 0], [xP + 9 * h, 0]], [[xP, 0], [xP, -h]]);
      ocultas.push([[xE, -h], [xE, -h - hb]], [[xP, -h], [xP + 2 * h, -h]]);
      acero('ins-A', 'Inserto de CAVIDAD (placa A)', caja(Prun[0] - 4 * D, 0, xP + 9 * h, 6 * D));
      acero('ins-B', 'Inserto de NÚCLEO (placa B)', unirMallas([
        caja(Prun[0] - 4 * D, -dep, xP, 0),
        caja(xP, -dep, xP + 2 * h, -h),
        caja(xP + 2 * h, -dep, xP + 4 * h, -h - hb),
        caja(xP + 4 * h, -dep, xP + 9 * h, -h),
      ]));
      plast('runner', `Canal ⌀${D} · ${perfil.nombre}`, mallaPrismaPerfil(perfil.pts.map((p) => [p[0] + Prun[0], p[1]] as Vec2), -YE, YE), perfil.nota);
      plast('gate', 'Raíz recta del submarino §7.2.7 (aquí se mide el 45°)',
        mallaTronco(A0, Prun, rAt(Ra * arco), rAt(Ltot), NF));
      plast('gate-curva', 'Submarino EXTENDIDO — banana/cashew (Fig 7.14)', mallaBarrido(cen, rr, NF),
        'entra por la cara OCULTA del boss: el vestigio no se ve');
      cmd.offsetMm = -zE; cmd.ejeDeg = ejeDeg; cmd.conoDeg = conoDeg; cmd.offsetDia = (-zE) / dGate;
      cmd.dGateMm = dGate; cmd.xRun = Prun[0]; cmd.bocaX = xE; cmd.bocaZ = zE; cmd.arcoRaMm = Ra;
      ext.push(`el radio del arco (${Ra.toFixed(2)} mm) NO se elige: sale de exigir que la raíz recta a ${ejeDeg}° nazca EN el plano de partición y el arco muera HORIZONTAL contra el boss`);
      ventana = { u0: Prun[0] - 1.6 * D, u1: xP + 5.4 * h, v0: -h - hb - 1.4 * h, v1: 1.3 * D };
      if (o.suckerPin !== false) agregaSucker(S, comp, plast, Prun[0], D, o, ext, cmd);
    } else {
      // edge / tab / fan / flash: canal a la izquierda, land, pieza a la derecha
      const xRun = 0;
      const xg0 = D / 2, xg1 = xg0 + Lg;
      const hPieza = tipo === 'edge' ? 0.6 * h : h;            // Fig 7.5: el edge cae a sección DELGADA
      if (tipo === 'edge') ext.push('Fig 7.5 se reproduce con el gate cayendo a sección delgada (0.6·pared): es el defecto que §7.2.3-7.2.4 corrige con la tab');
      const Ltab = tipo === 'tab' ? 3 * h : 0;
      const xp0 = xg1 + Ltab;
      const t1 = tipo === 'fan' ? t * 0.55 : t;                 // el abanico ADELGAZA al abrirse
      pieza(unirMallas([
        ...(Ltab > 0 ? [caja(xg1, 0, xp0, h)] : []),
        caja(xp0, 0, xp0 + 9 * h, hPieza),
      ]), Ltab > 0 ? 'tab de espesor nominal + pieza (Fig 7.6)' : 'pieza');
      visibles.push([[xp0, hPieza], [xp0 + 9 * h, hPieza]]);
      ocultas.push([[xp0, 0], [xp0 + 9 * h, 0]]);
      acero('ins-A', 'Inserto de CAVIDAD (placa A)', caja(xRun - 4 * D, 0, xp0 + 9 * h, 6 * D));
      acero('ins-B', 'Inserto de NÚCLEO (placa B)', caja(xRun - 4 * D, -6 * D, xp0 + 9 * h, 0));
      plast('runner', `Canal ⌀${D} · ${perfil.nombre}`, mallaPrismaPerfil(perfil.pts, -YE, YE), perfil.nota);
      // el land del gate: prisma de sección trapecial en (x,z) — el fan adelgaza
      const gp: Vec2[] = [[xg0, 0], [xg1, 0], [xg1, t1], [xg0, t]];
      plast('gate', `${tipo === 'fan' ? 'Fan gate §7.2.5' : tipo === 'flash' ? 'Flash gate §7.2.6' : tipo === 'tab' ? 'Tab gate §7.2.4' : 'Edge gate §7.2.3'}`,
        mallaPrismaPerfil(gp, -w / 2, w / 2), `espesor ${t.toFixed(2)} mm · ancho ${w.toFixed(1)} mm`);
      cmd.xg0 = xg0; cmd.xg1 = xg1; cmd.hPiezaMm = hPieza; cmd.tSalidaMm = t1;
      ventana = { u0: -1.25 * D, u1: xp0 + 3.2 * h, v0: -1.15 * D, v1: Math.max(1.5 * h, 1.05 * D) };
      if (o.suckerPin !== false) agregaSucker(S, comp, plast, xRun, D, o, ext, cmd);
    }
  } else {
    // ══ AXIAL: el gate baja por el eje; z = 0 es la superficie de cavidad ══
    const cavArriba = 8 * Math.max(h, D);
    if (tipo === 'sprue') {
      const fd = o.spec ? sprueDesignFromCavity(o.spec.plastic, o.spec.cavity, 60) : null;
      const rBase = fd ? fd.rBaseMm : D / 2, rTop = fd ? fd.rTopMm : D / 2 - 0.6;
      const well = o.gateWellMm ?? 0, rim = o.rimMm ?? 0;
      const vest = o.vestigioMm ?? null;
      const Rp = Math.max(3.4 * rBase, 4 * h);
      const rW = 2.2 * rBase;                                  // radio del rebaje
      // pieza: fondo con rebaje (Fig 7.3) y/o rim perimetral (Fig 7.2) + vestigio
      const trozos: MallaSec[] = [];
      trozos.push(mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: -h, a1: -well, r: rW, n: NF }));
      trozos.push(mallaRevolucion([[rW, -h], [Rp - (rim > 0 ? 1.6 * h : 0), -h], [Rp - (rim > 0 ? 1.6 * h : 0), 0], [rW, 0]], 0, 0, NF));
      if (rim > 0) trozos.push(mallaRevolucion([[Rp - 1.6 * h, -h], [Rp, -h], [Rp, rim], [Rp - 1.6 * h, rim]], 0, 0, NF));
      if (vest != null && vest > 0) trozos.push(mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: -well, a1: -well + vest, r: rBase, n: NF }));
      pieza(unirMallas(trozos), `fondo del vaso · ${well > 0 ? `gate well ${well} mm (Fig 7.3)` : rim > 0 ? `rim ${rim} mm (Fig 7.2)` : 'sin rim ni rebaje'}`);
      acero('ins-A', 'Inserto de CAVIDAD (placa A)', caja(-Rp - 3 * h, 0, Rp + 3 * h, cavArriba));
      acero('ins-B', 'Inserto de NÚCLEO (placa B)', caja(-Rp - 3 * h, -h - 6 * h, Rp + 3 * h, -h));
      // El bebedero se dibuja DESDE el plano de corte del degatado hacia arriba:
      // lo que queda pegado a la pieza es el VESTIGIO (plástico de la pieza), y si
      // el cono lo tapara, V7.2 no se podría mirar. `zCorte` es ese plano.
      const zCorte = -well + Math.max(0, vest ?? 0);
      plast('gate', 'Bebedero §6.3.1 / sprue gate §7.2.1',
        mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: zCorte, a1: -well + cavArriba * 0.8, r: rBase, r1: rTop, n: NF }),
        `⌀${(2 * rBase).toFixed(2)} en la pieza → ⌀${(2 * rTop).toFixed(2)} en la boquilla`);
      cmd.zCorteMm = zCorte;
      cmd.rBaseMm = rBase; cmd.rTopMm = rTop; cmd.wellMm = well; cmd.rimMm = rim; cmd.vestigioMm = vest ?? -1;
      cmd.zApoyoMm = rim > 0 ? rim : 0;
      ventana = { u0: -Rp * 1.10, u1: Rp * 1.10, v0: -h - 1.4 * h, v1: Math.max(2.6 * rBase, 3 * h) };
      visibles.push([[rW, 0], [Rp, 0]]);
      ocultas.push([[0, -h], [Rp, -h]]);
    } else if (tipo === 'pin-point') {
      const rev = o.reverseTaper !== false;
      const rGate = t / 2;
      const semi = ((o.tunelConoDeg ?? 20) / 2 * Math.PI) / 180;
      const rBP = rGate + Lg * Math.tan(semi);
      // reverse: ⌀ CRECE hacia el breakpoint (invertido respecto al bebedero)
      const rAbajo = rev ? rGate : rBP, rArriba = rev ? rBP : rGate;
      const Rp = 8 * h;
      pieza(caja(-Rp, -h, Rp, 0), 'pared de la pieza bajo el gate');
      acero('ins-A', 'Inserto de CAVIDAD (placa A)', caja(-Rp, 0, Rp, Lg));
      acero('placa-X', 'Placa de coladas (molde de 3 placas)', caja(-Rp, Lg, Rp, Lg + 5 * D));
      acero('ins-B', 'Inserto de NÚCLEO (placa B)', caja(-Rp, -h - 5 * h, Rp, -h));
      plast('gate', `Pin-point gate §7.2.2 ${rev ? '(reverse taper)' : '(cono DIRECTO — el defecto)'}`,
        mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: 0, a1: Lg, r: rAbajo, r1: rArriba, n: NF }),
        `⌀${(2 * rAbajo).toFixed(2)} en la cavidad → ⌀${(2 * rArriba).toFixed(2)} en el breakpoint`);
      perfil = perfilRunner(o.perfil ?? 'redondo', D, { n: 96 });
      plast('runner', `Canal ⌀${D} · ${perfil.nombre}`,
        mallaPrismaPerfil(perfil.pts.map((p) => [p[0], p[1] + Lg + D / 2] as Vec2), -YE, YE),
        'el canal vive en la placa de coladas y sube con ella');
      cmd.rGateMm = rGate; cmd.rBPMm = rBP; cmd.LgMm = Lg; cmd.reverse = rev ? 1 : 0;
      ventana = { u0: -1.6 * D, u1: 1.6 * D, v0: -1.7 * h, v1: Lg + 1.35 * D };
      visibles.push([[-Rp, 0], [Rp, 0]]);
    } else if (tipo === 'diaphragm') {
      const R = Math.max(5 * h, 2.5 * D);                        // radio interior del tubo
      const tDisc = h, dep = 6 * h;
      const landL = Math.max(0.8, t);
      pieza(unirMallas([
        mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: 0, a1: tDisc, r: R - landL, n: NF }),
        mallaRevolucion([[R - landL, 0], [R, 0], [R, t], [R - landL, t]], 0, 0, NF),
        mallaRevolucion([[R, -dep], [R + h, -dep], [R + h, 0], [R, 0]], 0, 0, NF),
      ]), 'diafragma + land + pared del tubo');
      acero('ins-A', 'Inserto de CAVIDAD (placa A)', caja(-R - 4 * h, tDisc, R + 4 * h, tDisc + 5 * h));
      acero('ins-B', 'Núcleo (mandril) + placa B', unirMallas([
        mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: -dep - 3 * h, a1: 0, r: R, n: NF }),
        mallaRevolucion([[R + h, -dep - 3 * h], [R + 4 * h, -dep - 3 * h], [R + 4 * h, tDisc], [R + h, tDisc]], 0, 0, NF),
        mallaRevolucion([[R, -dep - 3 * h], [R + h, -dep - 3 * h], [R + h, -dep], [R, -dep]], 0, 0, NF),
      ]));
      plast('gate', 'Diaphragm gate §7.2.6 (Fig 7.10)',
        mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: tDisc, a1: tDisc + 4 * h, r: D / 2, r1: D / 2 - 0.4, n: NF }),
        'bebedero que alimenta el diafragma');
      cmd.RdiafMm = R; cmd.tLandMm = t; cmd.landLMm = landL; cmd.tDiscMm = tDisc;
      cmd.lineaTestigoMm = 2 * Math.PI * R;
      ventana = { u0: -R * 1.22, u1: R * 1.22, v0: -dep * 0.5, v1: tDisc + 2.3 * h };
      visibles.push([[R, 0], [R, -dep]]);
    } else if (tipo === 'valve') {
      const Db = o.canalCalienteDiaMm ?? Math.max(2.2 * D, 6);
      const dv = o.vastagoDiaMm ?? Math.max(t * 1.2, 0.45 * Db);
      const esc = o.escalonMm ?? 0;
      const abierta = o.pose === 'abierta';
      const carrera = o.carreraMm ?? Math.max(1.5 * t, 1.2);
      const Rp = Math.max(1.35 * Db, 3.2 * h);
      const zPin = abierta ? esc + carrera : esc;
      pieza(unirMallas([
        caja(-Rp, -h, Rp, 0),
        ...(esc > 0 ? [mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: 0, a1: esc, r: dv / 2, n: NF })] : []),
      ]), esc > 0 ? `pared + vestigio de ${esc.toFixed(2)} mm bajo el vástago` : 'pared de la pieza (el vástago hace de superficie de cierre)');
      acero('ins-A', 'Boquilla de canal caliente (§6.5.1)', unirMallas([
        mallaRevolucion([[Db / 2, 0], [Rp, 0], [Rp, 9 * h], [Db / 2, 9 * h]], 0, 0, NF),
      ]));
      acero('ins-B', 'Inserto de NÚCLEO (placa B)', caja(-Rp, -h - 5 * h, Rp, -h));
      plast('canal', `Canal caliente ⌀${Db.toFixed(1)} (sección ANULAR §6.5.1 Fig 6.21)`,
        mallaRevolucion([[dv / 2, zPin], [Db / 2, zPin], [Db / 2, 9 * h], [dv / 2, 9 * h]], 0, 0, NF),
        `corona entre ⌀${dv.toFixed(2)} y ⌀${Db.toFixed(1)}`);
      comp('vastago', 'Vástago de la válvula §7.2.9',
        mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: zPin, a1: zPin + 9 * h, r: dv / 2, n: NF }),
        abierta ? `RETRAÍDO ${carrera.toFixed(2)} mm (llenando)` : 'AVANZADO (sellando)');
      cmd.DbMm = Db; cmd.dvMm = dv; cmd.escalonMm = esc; cmd.zPinMm = zPin; cmd.carreraMm = carrera;
      cmd.dhAnularMm = Db - dv;
      ventana = { u0: -Rp * 0.92, u1: Rp * 0.92, v0: -h - 1.5 * h, v1: 3.2 * h };
      visibles.push([[-Rp, 0], [Rp, 0]]);
    } else {
      // thermal-pin (Fig 7.15) y thermal-sprue (Fig 7.16)
      const Db = o.boreDiaMm ?? Math.max(2.4 * D, 6);
      const piel = o.pielMm ?? Math.max(0.2, 0.08 * Db);
      const nOri = o.nOrificios ?? 4;                            // §7.2.8 "three or four orifices"
      const dOri = o.orificioDiaMm ?? Math.max(0.6, t);
      const Rp = Math.max(1.5 * Db, 3 * h);
      const zTip = 1.2 * Db;
      pieza(caja(-Rp, -h, Rp, 0), 'pared de la pieza');
      acero('ins-A', 'Boquilla / bushing térmico §7.2.8', mallaRevolucion([[Db / 2, 0], [Rp, 0], [Rp, 9 * h], [Db / 2, 9 * h]], 0, 0, NF));
      acero('ins-B', 'Inserto de NÚCLEO (placa B)', caja(-Rp, -h - 5 * h, Rp, -h));
      // capa aislante de plástico solidificado que el libro describe
      plast('piel', 'Capa solidificada (aislante) §7.2.8',
        mallaRevolucion([[Db / 2 - piel, 0], [Db / 2, 0], [Db / 2, 9 * h], [Db / 2 - piel, 9 * h]], 0, 0, NF),
        `${piel.toFixed(2)} mm — "a thin solidified layer will remain"`);
      if (tipo === 'thermal-pin') {
        const rT = Db / 2 - piel - dOri * 1.15;
        comp('torpedo', 'Torpedo §7.2.8', unirMallas([
          mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: zTip, a1: 9 * h, r: rT, n: NF }),
          mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: 0, a1: zTip, r: rT, r1: rT * 0.25, n: NF }),
        ]), 'la punta obliga al flujo a pasar por los orificios');
        const xo = rT + dOri / 2 + 0.05;
        const ori: MallaSec[] = [];
        for (const sx of [-1, 1]) ori.push(mallaCilindro({ eje: 'z', c1: sx * xo, c2: 0, a0: 0, a1: zTip, r: dOri / 2, n: 32 }));
        plast('orificios', `${nOri} orificios ⌀${dOri.toFixed(2)} §7.2.8`, unirMallas(ori),
          `en la sección se ven 2 de ${nOri}: "three or four orifices"`);
        cmd.nOrificios = nOri; cmd.dOriMm = dOri; cmd.areaFlujoMm2 = nOri * Math.PI * dOri * dOri / 4;
      } else {
        const dLibre = Db - 2 * piel;
        plast('bore', `Bore ABIERTO ⌀${dLibre.toFixed(2)} §7.2.8`,
          mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: 0, a1: 9 * h, r: dLibre / 2, n: NF }),
          '"open flow bore within the nozzle… reduced shear rates and pressure drop"');
        cmd.nOrificios = 0; cmd.dLibreMm = dLibre; cmd.areaFlujoMm2 = Math.PI * dLibre * dLibre / 4;
      }
      cmd.DbMm = Db; cmd.pielMm = piel;
      ventana = { u0: -Db * 0.95, u1: Db * 0.95, v0: -h - 1.3 * h, v1: zTip + 0.55 * Db };
      visibles.push([[-Rp, 0], [Rp, 0]]);
    }
  }

  // ── zoom: SOLO cambia el encuadre; ninguna cota depende de él ──
  const z = o.zoom ?? 1;
  if (z !== 1) {
    const cu = (ventana.u0 + ventana.u1) / 2, cv = (ventana.v0 + ventana.v1) / 2;
    const au = (ventana.u1 - ventana.u0) / 2 * z, av = (ventana.v1 - ventana.v0) / 2 * z;
    ventana = { u0: cu - au, u1: cu + au, v0: cv - av, v1: cv + av };
  }

  const meta: MetaCompuerta = {
    tipo, familia, nombre: o.nombre ?? `${tipo}`,
    paredMm: h, runnerDiaMm: D, gateEspesorMm: t, gateAnchoMm: w, gateLargoMm: Lg,
    perfil, zPartMm: 0, visibles, ocultas, ventana, comandado: cmd,
    VdotM3s: Vdot, material, shearMaxS: mat ? mat.shearMax : null,
    extensiones: ext, avisos,
  };
  if (familia === 'axial' && tipo !== 'diaphragm') {
    avisos.push('compuerta AXIAL: el plano de partición NO cae en la ventana del zoom (z = 0 es la superficie de cavidad gateada)');
  }
  return { solidos: S, plano: { p0: [0, 0, 0], n: [0, -1, 0], arriba: [0, 0, 1] }, meta };
}

/** §6.5.2 — el sucker: pin ranurado bajo el canal. El hueco cónico (alto ½·⌀ y
 *  5°, LITERALES) va MAQUINADO EN LA CARA DEL PIN, y por eso el tope del pin
 *  puede quedar al ras del fondo del canal, que es lo que el libro prefiere. */
function agregaSucker(
  S: SolidoSeccion[],
  comp: (id: string, nombre: string, m: MallaSec, nota?: string) => void,
  plast: (id: string, nombre: string, m: MallaSec, nota?: string) => void,
  xRun: number, D: number, o: OpcionesCompuerta, ext: string[], cmd: Record<string, number>,
): void {
  const dis = o.suckerDiaMm ?? suckerPinDesign(D).diaMm;      // reusa el motor de threeplate.ts
  const hs = D / 2;                                           // LITERAL §6.5.2
  const tap = (5 * Math.PI) / 180;                            // LITERAL §6.5.2
  const intr = o.suckerIntrusionMm ?? 0;
  const zTop = -D / 2 + intr;                                 // fondo del canal = −⌀/2 en todos los perfiles de aquí
  const rP = dis / 2, rHueco = rP - 0.15 * D;
  const rHuecoAb = rHueco + hs * Math.tan(tap);               // se abre HACIA ABAJO: retiene la colada
  comp('sucker', 'Sucker pin ranurado §6.5.2 (Fig 6.22 izq.)', mallaRevolucion([
    [0, zTop - 4 * D], [rP, zTop - 4 * D], [rP, zTop], [rHueco, zTop], [rHuecoAb, zTop - hs], [0, zTop - hs],
  ], xRun, 0, NF), `⌀${dis} · hueco ${hs.toFixed(2)} mm a 5° (§6.5.2)`);
  plast('slug', 'Slug retenido en el sucker', mallaRevolucion([
    [0, zTop - hs], [rHuecoAb, zTop - hs], [rHueco, zTop], [0, zTop],
  ], xRun, 0, NF));
  cmd.suckerDiaMm = dis; cmd.suckerAltoMm = hs; cmd.suckerTaperDeg = 5;
  cmd.suckerIntrusionMm = intr; cmd.zFondoCanalMm = -D / 2;
  if (o.suckerDiaMm == null) ext.push(`⌀ del sucker = ${dis} mm de suckerPinDesign() (0.6·⌀canal) — el libro solo dice "slightly less than the diameter of the associated runner"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDICIÓN — todo se lee de los LAZOS de la sección (el dibujo), nunca del input
// ─────────────────────────────────────────────────────────────────────────────

const pz = (sec: Seccion, id: string): PiezaSeccionada | null => sec.piezas.find((p) => p.id === id) ?? null;

/** vértices reales del lazo: sin duplicados y sin puntos colineales */
export function verticesLazo(L: LazoSeccion, tol = 1e-7): Vec2[] {
  const p: Vec2[] = [];
  for (const q of L.pts) {
    const l = p[p.length - 1];
    if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > tol) p.push([q[0], q[1]]);
  }
  while (p.length > 1 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) <= tol) p.pop();
  const out: Vec2[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
    const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const esc = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (esc > 0 && Math.abs(cr) / esc > 1e-9) out.push(b);
  }
  return out.length >= 3 ? out : p;
}

export interface TroncoMedido {
  /** centro de la boca (extremo más cercano a `ref`) y del otro extremo */
  c0: Vec2; c1: Vec2;
  r0: number; r1: number; largoMm: number;
  /** dirección c0→c1 y su ángulo con la HORIZONTAL (plano de partición), en [0,90] */
  dir: Vec2; ejeDeg: number; ejeCrudoDeg: number;
  /** ángulo incluido del cono = 2·atan((r1−r0)/L). Signo + si abre alejándose de c0 */
  incluidoDeg: number; semiDeg: number;
  /** pendiente radial dr/ds alejándose de la boca (mm/mm): el SIGNO es el juicio */
  pendiente: number;
}

/**
 * Mide un tronco de cono SOBRE SU LAZO (no sobre el input): busca el par de
 * aristas paralelas más separadas — que son las dos bases del trapecio —, saca
 * sus puntos medios y sus medias-longitudes, y de ahí el eje, los radios y los
 * ángulos. Con la sección exacta reproduce lo comandado a ~1e-15.
 */
export function medirTronco(L: LazoSeccion, ref?: Vec2): TroncoMedido | null {
  const V = verticesLazo(L);
  if (V.length < 4) return null;
  const n = V.length;
  const ar = (i: number) => {
    const a = V[i], b = V[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return { a, b, dx: dx / l, dy: dy / l, l, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Vec2 };
  };
  let mejor: { i: number; j: number; sep: number } | null = null;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const A = ar(i), B = ar(j);
    if (Math.abs(A.dx * B.dy - A.dy * B.dx) > 1e-9) continue;             // no son paralelas
    const sep = Math.abs((B.mid[0] - A.mid[0]) * A.dy - (B.mid[1] - A.mid[1]) * A.dx);
    if (!mejor || sep > mejor.sep) mejor = { i, j, sep };
  }
  if (!mejor) return null;
  let A = ar(mejor.i), B = ar(mejor.j);
  if (ref) {
    const dA = Math.hypot(A.mid[0] - ref[0], A.mid[1] - ref[1]);
    const dB = Math.hypot(B.mid[0] - ref[0], B.mid[1] - ref[1]);
    if (dB < dA) { const t = A; A = B; B = t; }
  }
  const dx = B.mid[0] - A.mid[0], dy = B.mid[1] - A.mid[1];
  const largo = Math.hypot(dx, dy);
  const r0 = A.l / 2, r1 = B.l / 2;
  const crudo = (Math.atan2(dy, dx) * 180) / Math.PI;
  let ang = Math.abs(crudo) % 180; if (ang > 90) ang = 180 - ang;
  const semi = (Math.atan((r1 - r0) / largo) * 180) / Math.PI;
  return {
    c0: A.mid, c1: B.mid, r0, r1, largoMm: largo,
    dir: [dx / largo, dy / largo], ejeDeg: ang, ejeCrudoDeg: crudo,
    semiDeg: semi, incluidoDeg: 2 * semi, pendiente: (r1 - r0) / largo,
  };
}

/** máximo/mínimo de v entre los puntos del lazo con u dentro del rango */
function vEnRangoU(p: PiezaSeccionada | null, u0: number, u1: number): { vMin: number; vMax: number } | null {
  if (!p) return null;
  let vMin = Infinity, vMax = -Infinity;
  for (const L of p.lazos) for (const q of L.pts) {
    if (q[0] < u0 - 1e-9 || q[0] > u1 + 1e-9) continue;
    if (q[1] < vMin) vMin = q[1];
    if (q[1] > vMax) vMax = q[1];
  }
  return vMin === Infinity ? null : { vMin, vMax };
}
/** |u| máximo entre los puntos que están a la altura v (± tol) */
function uMaxEnV(p: PiezaSeccionada | null, v: number, tol = 1e-6): number | null {
  if (!p) return null;
  let m = -Infinity;
  for (const L of p.lazos) for (const q of L.pts) if (Math.abs(q[1] - v) <= tol) m = Math.max(m, Math.abs(q[0]));
  return m === -Infinity ? null : m;
}
/** La BOCA de un barrido curvo (banana): el extremo de mayor u. Devuelve el ⌀
 *  (largo de la tapa, que el barrido deja EXACTA en el plano de corte) y su
 *  centro — todo leído del lazo, nada del input. */
function bocaBarrido(p: PiezaSeccionada | null): { d: number; u: number; v: number } | null {
  if (!p || p.vacio) return null;
  // la tapa es una ARISTA del lazo (la que une los dos puntos del anillo final);
  // se identifica como la arista cuyo PUNTO MEDIO está más a la derecha. Buscar
  // el vértice de u máxima no sirve: la tapa va ligeramente inclinada y solo un
  // vértice queda en el extremo.
  let best: { d: number; u: number; v: number } | null = null;
  for (const L of p.lazos) {
    const Vv = verticesLazo(L);
    for (let i = 0; i < Vv.length; i++) {
      const a = Vv[i], b = Vv[(i + 1) % Vv.length];
      const mu = (a[0] + b[0]) / 2, mv = (a[1] + b[1]) / 2;
      if (!best || mu > best.u) best = { d: Math.hypot(b[0] - a[0], b[1] - a[1]), u: mu, v: mv };
    }
  }
  return best;
}

/** distancia mínima de un lazo a un segmento del mundo */
function distLazoASegmento(p: PiezaSeccionada, s: [Vec2, Vec2]): number {
  const [a, b] = s;
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  let best = Infinity;
  for (const L of p.lazos) for (const q of L.pts) {
    let t = L2 > 0 ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(q[0] - (a[0] + t * dx), q[1] - (a[1] + t * dy)));
  }
  return best;
}

const V_TITULOS: Array<[string, string, string]> = [
  ['V7.2', 'Sprue gate: el vestigio contra el plano de apoyo', '§7.2.1 · Fig 7.2-7.3'],
  ['V7.3', 'Pin-point: reverse taper y razón largo/⌀', '§7.2.2 · Fig 7.4'],
  ['V7.5', 'Fan gate: ancho del abanico y resistencia transversal', '§7.2.5 · Fig 7.7-7.8'],
  ['V7.6', 'Espesor del gate (a minimizar) y línea testigo', '§7.2.6 · Fig 7.9-7.10'],
  ['V7.7', 'Tunnel gate: 45° · cono ≥ 20° · ≥ 3 ⌀ del parting', '§7.2.7 · Fig 7.11-7.13'],
  ['V7.8', 'Submarino extendido: no cruzar superficie visible', '§7.2.7 · Fig 7.14'],
  ['V7.9', 'Gate térmico: orificios estrechos vs. bore abierto', '§7.2.8 · Fig 7.15-7.16'],
  ['V7.10', 'Valve gate: escalón vástago↔cavidad ≈ 0', '§7.2.9 · Fig 7.17'],
  ['V6.3', 'Eficiencia del perfil del canal', '§6.5.1 · Fig 6.20 · Tabla 6.3'],
  ['V6.4', 'Sección ANULAR del valve gate (Dh equivalente)', '§6.5.1 · Fig 6.21'],
  ['V6.5', 'Intrusión del sucker pin en el canal', '§6.5.2 · Fig 6.22'],
];

/** Las once verificaciones que L7 debe cubrir, en el orden del pliego. */
export const VERIFICACIONES_L7 = V_TITULOS.map(([id, titulo, cita]) => ({ id, titulo, cita }));

export function medirCompuerta(sec: Seccion, meta: MetaCompuerta, o: OpcionesCompuerta): MedidasCompuerta {
  const cotas: CotaC[] = [];
  const datos: MedidasCompuerta['datos'] = {};
  const V = new Map<string, VeredictoC>();
  const put = (id: string, estado: EstadoC, porque: string, medido?: string, limite?: string) => {
    const f = V_TITULOS.find((x) => x[0] === id)!;
    V.set(id, { id, titulo: f[1], cita: f[2], estado, medido, limite, porque });
  };
  const noAplica = (id: string, razon: string) => put(id, 'NO APLICA', razon);
  const tipo = meta.tipo, h = meta.paredMm, D = meta.runnerDiaMm;
  const cmd = meta.comandado;

  // ═══ V6.3 · EFICIENCIA DEL PERFIL (§6.5.1) ═══════════════════════════════
  const runner = pz(sec, 'runner');
  if (meta.perfil && runner && !runner.vacio) {
    const P = meta.perfil;
    // el área se MIDE en la sección; el perímetro sale del mismo lazo dibujado
    const Lz = runner.lazos.reduce((a, b) => (Math.abs(b.areaMm2) > Math.abs(a.areaMm2) ? b : a), runner.lazos[0]);
    let per = 0;
    for (let i = 0; i < Lz.pts.length; i++) {
      const a = Lz.pts[i], b = Lz.pts[(i + 1) % Lz.pts.length];
      per += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const areaSec = runner.areaMm2, dh = (4 * areaSec) / per, q = (4 * Math.PI * areaSec) / (per * per);
    const rank = rankingPorQ(D);
    const ordenOK = rank.every((p, i) => p.id === ORDEN_LIBRO[i]);
    datos.perfil = P.id; datos.perfilAreaMm2 = +areaSec.toFixed(6); datos.perfilPerimMm = +per.toFixed(6);
    datos.perfilDhMm = +dh.toFixed(6); datos.perfilQ = +q.toFixed(6); datos.perfilEfDhPct = +((dh / D) * 100).toFixed(3);
    datos.perfilEfLibroPct = P.efLibroPct; datos.rankingQCoincide = ordenOK ? 1 : 0;
    put('V6.3', P.id === 'redondo' ? 'CUMPLE' : 'ADVIERTE',
      `"The results indicate that the full round runner is the most efficient section design, followed by the round bottom trapezoid, the trapezoid, and the half-round" (§6.5.1). `
      + `El orden NO se copia de la Tabla 6.3: se REPRODUCE con el cociente isoperimétrico Q=4πA/P² medido sobre el lazo dibujado, que solo vale 1 en el círculo — y sale ${ordenOK ? 'IGUAL al del libro' : 'DISTINTO al del libro (revisar las proporciones declaradas del trapecio)'}. `
      + (P.id === 'trapezoidal' ? '"the sections near the four corners conduct very little flow down the length of the runner". ' : '')
      + (P.dosPlacas ? 'Costo: exige maquinar las DOS mitades del molde.' : 'Se maquina en UNA sola mitad (más barato, menos eficiente).'),
      `A ${areaSec.toFixed(3)} mm² · P ${per.toFixed(3)} mm · Dh ${dh.toFixed(3)} · Q ${q.toFixed(4)} · Dh/⌀ ${((dh / D) * 100).toFixed(1)} %`,
      `Tabla 6.3: ${P.efLibroPct != null ? P.efLibroPct + ' %' : 'no listado'}`);
  } else {
    noAplica('V6.3', `${meta.tipo} no lleva canal frío en este detalle: no hay perfil que juzgar (Fig 6.20 aplica al runner).`);
  }

  // ═══ V6.5 · SUCKER PIN (§6.5.2) ══════════════════════════════════════════
  const sucker = pz(sec, 'sucker'), slug = pz(sec, 'slug');
  if (sucker && !sucker.vacio && runner && !runner.vacio) {
    const zPin = sucker.bbox!.v1, zFondo = runner.bbox!.v0;
    const intr = zPin - zFondo;
    const dPin = 2 * (uMaxEnV(sucker, zPin) ?? 0) === 0 ? 0 : 2 * (uMaxEnV(sucker, zPin) ?? 0) - 2 * (cmd.xRun ?? 0);
    const dPinMed = 2 * Math.max(...sucker.lazos.flatMap((L) => L.pts.map((q) => Math.abs(q[0] - (cmd.xRun ?? 0)))));
    let alto: number | null = null, taper: number | null = null;
    if (slug && !slug.vacio) {
      alto = slug.bbox!.v1 - slug.bbox!.v0;
      const xa = Math.max(...slug.lazos.flatMap((L) => L.pts.filter((q) => Math.abs(q[1] - slug.bbox!.v0) < 1e-6).map((q) => Math.abs(q[0] - (cmd.xRun ?? 0)))));
      const xb = Math.max(...slug.lazos.flatMap((L) => L.pts.filter((q) => Math.abs(q[1] - slug.bbox!.v1) < 1e-6).map((q) => Math.abs(q[0] - (cmd.xRun ?? 0)))));
      taper = (Math.atan((xa - xb) / alto) * 180) / Math.PI;
    }
    datos.intrusionMm = +intr.toFixed(6); datos.suckerDiaMedidoMm = +dPinMed.toFixed(4);
    datos.suckerAltoMedidoMm = alto != null ? +alto.toFixed(6) : null;
    datos.suckerTaperMedidoDeg = taper != null ? +taper.toFixed(9) : null;
    const razonDia = dPinMed / D;
    cotas.push({
      k: 'lin', id: 'intr', texto: intr === 0 ? 'intrusión 0.00' : `intrusión ${intr.toFixed(2)}`,
      ref: '§6.5.2 tope del pin ≡ fondo del canal', estado: intr > 1e-9 ? 'VIOLA' : intr < -1e-9 ? 'ADVIERTE' : 'CUMPLE',
      p: [(cmd.xRun ?? 0) - dPinMed / 2 - 0.15, zFondo], q: [(cmd.xRun ?? 0) - dPinMed / 2 - 0.15, zPin], offPx: -26,
    });
    if (alto != null) cotas.push({
      k: 'lin', id: 'hsuck', texto: `h ${alto.toFixed(2)} = ⌀/2`, ref: '§6.5.2 LITERAL', estado: Math.abs(alto - D / 2) < 1e-6 ? 'CUMPLE' : 'ADVIERTE',
      p: [(cmd.xRun ?? 0) - dPinMed / 2 - 0.15, zPin - alto], q: [(cmd.xRun ?? 0) - dPinMed / 2 - 0.15, zPin], offPx: -52,
    });
    put('V6.5', intr > 1e-9 ? 'VIOLA' : intr < -1e-9 ? 'ADVIERTE' : 'CUMPLE',
      (intr > 1e-9
        ? `el pin "protrudes slightly into the runner section" y eso causa "an undesired disruption or instability in the flow front". `
        : intr < -1e-9
          ? `el pin queda HUNDIDO ${(-intr).toFixed(3)} mm: no estrangula el flujo, pero el libro pide alinearlo. `
          : `"it is preferred to align the top of the ejector pin with the bottom of the runner" — alineado exacto. `)
      + `El hueco de retención va MAQUINADO EN LA CARA DEL PIN (Fig 6.22 izq., "the slotted ejector is much simpler to machine"), por eso el tope puede quedar al ras. `
      + `⌀ del sucker ${dPinMed.toFixed(2)} = ${(razonDia * 100).toFixed(0)} % del canal: el libro pide "slightly less than the diameter of the associated runner"${razonDia < 0.75 ? ' — 60 % NO es "slightly less" (viene de suckerPinDesign(), EXTENSIÓN)' : ''}.`,
      `intrusión ${intr.toFixed(3)} mm · h ${alto != null ? alto.toFixed(3) : '—'} mm (⌀/2 = ${(D / 2).toFixed(3)}) · taper ${taper != null ? taper.toFixed(2) : '—'}°`,
      'intrusión = 0 · h = ½·⌀ · 5° (§6.5.2)');
  } else if (meta.familia === 'axial' || tipo === 'valve' || tipo === 'thermal-pin' || tipo === 'thermal-sprue') {
    noAplica('V6.5', `${tipo}: sin canal frío que retener, el sucker pin de §6.5.2 no existe en este detalle.`);
  } else {
    put('V6.5', 'SIN CABLEAR', 'hay canal frío pero NO se modeló el sucker pin: la retención de la colada en la mitad móvil queda sin verificar (§6.5.2). No cuenta como cumplido.');
  }

  // ═══ V7.6 · ESPESOR DEL GATE Y LÍNEA TESTIGO (§7.2.6 + §7.3.2) ═══════════
  const gate = pz(sec, 'gate');
  let tMed: number | null = null, testigo: number | null = null, testigoMedido = false;
  if (tipo === 'valve') {
    // el "gate" del valve es el orificio que tapa el vástago: su ⌀ se mide en la
    // cara del vástago, y la línea testigo es su circunferencia completa
    const vas = pz(sec, 'vastago');
    if (vas && !vas.vacio) {
      const anchos = vas.lazos.map((L) => Math.max(...L.pts.map((q) => q[0])) - Math.min(...L.pts.map((q) => q[0])));
      tMed = Math.max(...anchos);
      testigo = Math.PI * tMed; testigoMedido = true;
    }
  } else if (tipo === 'thermal-pin' || tipo === 'thermal-sprue') {
    const p = pz(sec, tipo === 'thermal-pin' ? 'orificios' : 'bore');
    if (p && !p.vacio) {
      const anchos = p.lazos.map((L) => Math.max(...L.pts.map((q) => q[0])) - Math.min(...L.pts.map((q) => q[0])));
      tMed = anchos.reduce((a, b) => a + b, 0) / anchos.length;
      testigo = (tipo === 'thermal-pin' ? (cmd.nOrificios || 1) : 1) * Math.PI * tMed; testigoMedido = true;
    }
  } else if (gate && !gate.vacio) {
    if (meta.familia === 'lateral' && tipo !== 'tunnel' && tipo !== 'banana') {
      const ex = vEnRangoU(gate, (cmd.xg1 ?? 0) - 1e-6, (cmd.xg1 ?? 0) + 1e-6);
      tMed = ex ? ex.vMax - ex.vMin : null;
      testigo = meta.gateAnchoMm;
    } else if (tipo === 'diaphragm') {
      const R = uMaxEnV(pz(sec, 'moldeo'), cmd.tLandMm ?? 0) ?? cmd.RdiafMm;
      tMed = cmd.tLandMm;
      testigo = 2 * Math.PI * (R ?? 0); testigoMedido = true;
    } else {
      const bb = tipo === 'banana' ? bocaBarrido(pz(sec, 'gate-curva')) : null;
      if (bb) tMed = bb.d;
      else {
        const tr = medirTronco(gate.lazos[0], meta.familia === 'axial' ? [0, 0] : [0, -(cmd.offsetMm ?? 0)]);
        tMed = tr ? 2 * tr.r0 : null;
      }
      testigo = tMed != null ? Math.PI * tMed : null; testigoMedido = true;
    }
  }
  if (tMed != null) {
    const semilla = h * (GATE_DELGADO[tipo] ? 0.5 : 1);
    // La cota de §7.2.3 ("menor que la pared") y la semilla de §7.3.2 rigen a los
    // gates que el diseñador dimensiona. En los que el ⌀ lo fija el HERRAJE
    // (bebedero, valve, térmicos — los que §7.3.5 marca como NO agrandables:
    // "lo fija el bushing" / "en caliente, abrir cuesta caro") aplicar esa regla
    // sería inventar un criterio que el libro no da: se MIDE y se reporta.
    const loFijaElHerraje = ['sprue', 'valve', 'thermal-pin', 'thermal-sprue'].includes(tipo);
    // La pared que manda es la LOCAL en el punto de entrada, no la nominal: es la
    // diferencia entre Fig 7.5 (edge a sección delgada) y Fig 7.6 (tab de espesor
    // nominal). Y §7.2.3 tolera explícitamente que el espesor SE ACERQUE a la
    // pared: "may approach the thickness of the molding if shear rates are a
    // concern" ⇒ igualarla es ADVIERTE, pasarse es VIOLA.
    const hLocal = (cmd.hPiezaMm as number | undefined) ?? h;
    const est: EstadoC = loFijaElHerraje ? 'DESCRIPTIVA'
      : tMed < hLocal * (1 - 1e-9) ? 'CUMPLE' : tMed <= hLocal * (1 + 1e-9) ? 'ADVIERTE' : 'VIOLA';
    datos.paredEnElGateMm = +hLocal.toFixed(6);
    datos.espesorGateMedidoMm = +tMed.toFixed(6);
    datos.lineaTestigoMm = testigo != null ? +testigo.toFixed(3) : null;
    put('V7.6', est,
      `Todo gate deja "a witness line, so it is desired to minimize the thickness of the gate itself" (§7.2.6). `
      + (loFijaElHerraje
        ? `En un gate ${tipo} el ⌀ NO lo elige el diseñador: lo fija el herraje (§7.3.5 lo marca como no agrandable), así que la cota de §7.2.3 —que es del EDGE gate— no rige y aquí solo se mide. Quien juzga el vestigio de este gate es ${tipo === 'sprue' ? 'V7.2 (rim / gate well)' : tipo === 'valve' ? 'V7.10 (escalón ≈ 0)' : 'V7.9'}. `
        : `Manda la cota de §7.2.3: "the thickness of the edge gate should be less than the wall thickness of the molding, but may approach the thickness of the molding if shear rates are a concern" — y la pared que cuenta es la LOCAL en el punto de entrada (${hLocal.toFixed(2)} mm${Math.abs(hLocal - h) > 1e-9 ? `, no la nominal ${h.toFixed(2)}: aquí el gate cae a sección DELGADA, que es el defecto de Fig 7.5` : ''}). La semilla de §7.3.2 era ${semilla.toFixed(2)} mm. `)
      + (testigoMedido
        ? `La línea testigo SÍ se mide en esta sección (${testigo!.toFixed(2)} mm de recorrido).`
        : `La extensión de la línea testigo (${testigo!.toFixed(2)} mm) es el ANCHO del gate: corre PERPENDICULAR al corte, así que esta vista no la mide — se declara, no se acredita.`),
      `espesor medido ${tMed.toFixed(3)} mm (pared ${h.toFixed(2)}) · testigo ${testigo != null ? testigo.toFixed(2) + ' mm' : '—'}${testigoMedido ? '' : ' (declarado)'}`,
      loFijaElHerraje ? 'sin cota del libro para este tipo' : `< ${hLocal.toFixed(2)} mm §7.2.3`);
  } else {
    put('V7.6', 'SIN CABLEAR', 'no se pudo medir el espesor del gate sobre la sección.');
  }

  // ═══ V7.2 · SPRUE GATE (§7.2.1) ══════════════════════════════════════════
  if (tipo === 'sprue') {
    const mol = pz(sec, 'moldeo')!;
    const rB = cmd.rBaseMm;
    const apoyo = vEnRangoU(mol, 2.3 * rB, Infinity);
    const vest = vEnRangoU(mol, -1.02 * rB, 1.02 * rB);
    const declarado = cmd.vestigioMm >= 0;
    if (!declarado) {
      put('V7.2', 'SIN CABLEAR',
        'el libro NO da la altura del vestigio del bebedero: sin declararla, la comparación contra el plano de apoyo no existe. Se mide en el tryout y se vuelve a correr. No cuenta como cumplido.',
        `plano de apoyo z=${apoyo!.vMax.toFixed(2)} · rebaje ${cmd.wellMm.toFixed(2)} · rim ${cmd.rimMm.toFixed(2)} mm`);
    } else {
      const sobresale = vest!.vMax - apoyo!.vMax;
      datos.vestigioSobreApoyoMm = +sobresale.toFixed(6);
      datos.planoApoyoMm = +apoyo!.vMax.toFixed(6);
      cotas.push({
        k: 'lin', id: 'vest', texto: `vestigio ${(vest!.vMax - (-cmd.wellMm)).toFixed(2)}`, ref: '§7.2.1',
        estado: sobresale <= 0 ? 'CUMPLE' : 'VIOLA', p: [-rB, -cmd.wellMm], q: [-rB, vest!.vMax], offPx: 34,
      });
      cotas.push({
        k: 'lin', id: 'apoyo', texto: `sobre el apoyo ${sobresale >= 0 ? '+' : ''}${sobresale.toFixed(2)}`, ref: '§7.2.1 debe ser ≤ 0',
        estado: sobresale <= 0 ? 'CUMPLE' : 'VIOLA', p: [2.35 * rB, apoyo!.vMax], q: [2.35 * rB, vest!.vMax], offPx: -34,
      });
      put('V7.2', sobresale <= 0 ? 'CUMPLE' : 'VIOLA',
        (cmd.rimMm > 0
          ? '"a small rim has been provided around the perimeter of the base so the cup may sit flat after sprue removal" (Fig 7.2). '
          : cmd.wellMm > 0
            ? 'el gate well rebajado "to provide clearance for the gate vestige" (Fig 7.3). '
            : 'sin rim ni gate well: el vestigio queda a la intemperie sobre el plano de apoyo. ')
        + (sobresale <= 0
          ? `El vestigio queda ${(-sobresale).toFixed(2)} mm POR DEBAJO del plano de apoyo: la pieza asienta plana.`
          : `El vestigio SOBRESALE ${sobresale.toFixed(2)} mm del plano de apoyo: la pieza se mece. Profundizar el rebaje o subir el rim.`),
        `vestigio a z=${vest!.vMax.toFixed(2)} · apoyo a z=${apoyo!.vMax.toFixed(2)} → Δ ${sobresale >= 0 ? '+' : ''}${sobresale.toFixed(3)} mm`,
        'Δ ≤ 0 (§7.2.1)');
    }
    // el bebedero es el cono NORMAL: su signo es la referencia del reverse taper
    const tr = gate ? medirTronco(gate.lazos[0], [0, -cmd.wellMm]) : null;
    if (tr) {
      datos.pendienteRadialPorMm = +tr.pendiente.toFixed(9);
      datos.gateAreaSecMm2 = +gate!.areaMm2.toFixed(6);
      cotas.push({ k: 'lin', id: 'dsp', texto: `⌀ ${(2 * tr.r0).toFixed(2)}`, ref: '§6.3.1 salida del bebedero', estado: 'DESCRIPTIVA', p: [-tr.r0, tr.c0[1]], q: [tr.r0, tr.c0[1]], offPx: -22 });
    }
  } else noAplica('V7.2', `${tipo}: el vestigio del bebedero de §7.2.1 no existe aquí.`);

  // ═══ V7.3 · PIN-POINT: REVERSE TAPER (§7.2.2) ════════════════════════════
  if (tipo === 'pin-point') {
    const tr = gate ? medirTronco(gate.lazos[0], [0, 0]) : null;
    if (!tr) put('V7.3', 'SIN CABLEAR', 'no se pudo medir el cono del gate sobre la sección.');
    else {
      const dCav = 2 * tr.r0, razon = tr.largoMm / dCav;
      const reverse = tr.pendiente > 0;                    // ⌀ crece hacia el BREAKPOINT
      datos.pendienteRadialPorMm = +tr.pendiente.toFixed(9);
      datos.gateLargoDiaRazon = +razon.toFixed(6);
      datos.gateDiaCavidadMm = +dCav.toFixed(6);
      datos.gateDiaBreakpointMm = +(2 * tr.r1).toFixed(6);
      const razonOK = razon >= 0.5 && razon <= 2;
      // Las dos cotas se sacan HACIA AFUERA del cono, cada una del lado de su propio
      // extremo. Con los signos invertidos (cavidad −26 / breakpoint +26) se CRUZABAN:
      // el gate mide 1.20 mm, o sea que el corrimiento de 26 px es más largo que la
      // pieza acotada, y la etiqueta "cavidad" terminaba arriba (lado del canal) y
      // "breakpoint" abajo, dentro de la pieza. Los números eran correctos y el cono
      // estaba bien dibujado, pero quien leyera la lámina concluía que el reverse taper
      // iba al revés — justo el veredicto que L7 existe para dar. El check G-cotas
      // compara las coordenadas del DIBUJO para que no reincida.
      cotas.push({ k: 'lin', id: 'dcav', texto: `⌀ ${dCav.toFixed(2)} cavidad`, ref: '§7.2.2', estado: 'DESCRIPTIVA', p: [-tr.r0, tr.c0[1]], q: [tr.r0, tr.c0[1]], offPx: 26 });
      cotas.push({ k: 'lin', id: 'dbp', texto: `⌀ ${(2 * tr.r1).toFixed(2)} breakpoint`, ref: '§7.2.2', estado: 'DESCRIPTIVA', p: [-tr.r1, tr.c1[1]], q: [tr.r1, tr.c1[1]], offPx: -26 });
      cotas.push({ k: 'lin', id: 'Lg', texto: `L ${tr.largoMm.toFixed(2)} = ${razon.toFixed(2)}·⌀`, ref: '§7.2.2 "on the order of its diameter"', estado: razonOK ? 'CUMPLE' : 'ADVIERTE', p: [tr.r1 + 0.2, tr.c0[1]], q: [tr.r1 + 0.2, tr.c1[1]], offPx: 30 });
      put('V7.3', reverse ? (razonOK ? 'CUMPLE' : 'ADVIERTE') : 'VIOLA',
        `"A properly designed pin-point gate will have a reverse taper between the cavity surface and the gate breakpoint" (§7.2.2). `
        + `REVERSE se juzga por SIGNO contra el cono normal del molde, el bebedero, que crece HACIA la pieza porque se extrae hacia ella (§6.3.1). Aquí el ⌀ ${reverse ? 'crece hacia el breakpoint (invertido = correcto: el plug sube con la placa de coladas y revienta en la cara de la cavidad)' : 'crece hacia la CAVIDAD, igual que un bebedero: el plug no puede salir hacia arriba y arranca pedazo de pieza'}. `
        + `Largo "typically on the order of its diameter": L/⌀ = ${razon.toFixed(2)}${razonOK ? ' ✓' : ' fuera de la banda 0.5-2 declarada como EXTENSIÓN de "on the order of"'}.`,
        `pendiente dr/ds = ${tr.pendiente >= 0 ? '+' : ''}${tr.pendiente.toFixed(4)} mm/mm · ⌀ ${dCav.toFixed(2)} → ${(2 * tr.r1).toFixed(2)} · L/⌀ ${razon.toFixed(2)}`,
        'signo OPUESTO al del bebedero · L/⌀ ≈ 1');
    }
  } else noAplica('V7.3', `${tipo}: no hay pin-point gate en este detalle (§7.2.2).`);

  // ═══ V7.5 · FAN GATE (§7.2.5) ════════════════════════════════════════════
  if (tipo === 'fan') {
    const anchoFan = o.fanAnchoMm ?? meta.gateAnchoMm;
    const anchoPieza = o.piezaAnchoMm ?? null;
    if (anchoPieza == null) {
      put('V7.5', 'SIN CABLEAR',
        '"the fan gate must span the width of the molding across which linear flow is desired": sin el ancho de la pieza declarado no hay razón que medir. Además el abanico corre PERPENDICULAR al corte: esta vista sola no lo mide (la planta esquemática lo dibuja, L14 lo confirma con el frente recto).');
    } else {
      const razon = anchoFan / anchoPieza;
      datos.fanRazonAncho = +razon.toFixed(6);
      // 2ª condición: ΔP transversal (a lo ancho del abanico) vs. ΔP del land
      let segunda: string, okSeg: boolean | null = null;
      const mat = FEED_MATERIALS[meta.material];
      if (meta.VdotM3s != null && mat) {
        const mm = mat as unknown as Parameters<typeof gateDropStripPL>[0];
        const dpTrans = gateDropStripPL(mm, anchoFan / 2 / 1000, meta.gateEspesorMm / 1000, meta.gateEspesorMm / 1000, meta.VdotM3s / 2) / 1e6;
        const dpLand = gateDropStripPL(mm, meta.gateLargoMm / 1000, anchoFan / 1000, cmd.tSalidaMm / 1000, meta.VdotM3s) / 1e6;
        const r = dpTrans / (dpLand || 1e-9);
        okSeg = r <= 0.1;
        datos.fanRazonResistencia = +r.toFixed(4);
        segunda = `resistencia transversal ΔP ${dpTrans.toFixed(2)} MPa contra ${dpLand.toFixed(2)} MPa del land = ${(r * 100).toFixed(0)} % (Tabla 7.3 power-law; "negligible" se declara como ≤ 10 % — EXTENSIÓN).`;
      } else {
        segunda = 'la segunda condición ("the flow resistance across the width of the fan gate must be negligible") necesita V̇ y material: SIN CABLEAR.';
      }
      const estado: EstadoC = okSeg == null ? 'SIN CABLEAR' : (razon >= 0.95 && okSeg) ? 'CUMPLE' : 'ADVIERTE';
      put('V7.5', estado,
        `"First, the fan gate must span the width of the molding across which linear flow is desired. Second, the flow resistance across the width of the fan gate must be negligible" (§7.2.5). ${segunda}`,
        `ancho abanico ${anchoFan.toFixed(1)} / ancho pieza ${anchoPieza.toFixed(1)} = ${razon.toFixed(3)}`,
        'razón ≈ 1 · resistencia transversal despreciable');
    }
  } else noAplica('V7.5', `${tipo}: el abanico de §7.2.5 no aplica.`);

  // ═══ V7.7 · TUNNEL GATE: LAS TRES COTAS DURAS (§7.2.7) ═══════════════════
  if (tipo === 'tunnel' || tipo === 'banana') {
    const curva = pz(sec, 'gate-curva');
    const boca: Vec2 = tipo === 'banana' ? [cmd.bocaX, cmd.bocaZ] : [0, -(cmd.offsetMm ?? 0)];
    const tr = gate ? medirTronco(gate.lazos[0], boca) : null;
    if (!tr) put('V7.7', 'SIN CABLEAR', 'no se pudo medir el cono del túnel sobre la sección.');
    else {
      // la BOCA del banana no está en la raíz: es el extremo del barrido curvo, y
      // ahí es donde §7.2.7 pide contar los ⌀ hasta el plano de partición.
      let dGate = 2 * tr.r0, zBoca = tr.c0[1], uBoca = tr.c0[0];
      const bb = tipo === 'banana' ? bocaBarrido(curva) : null;
      if (bb) { dGate = bb.d; zBoca = bb.v; uBoca = bb.u; }
      const offMed = Math.abs(zBoca - meta.zPartMm);
      const enDia = offMed / dGate;
      const a = tr.ejeDeg, inc = tr.incluidoDeg;
      datos.tunelEjeDeg = +a.toFixed(9);
      datos.tunelConoIncluidoDeg = +inc.toFixed(9);
      datos.tunelOffsetMm = +offMed.toFixed(6);
      datos.tunelOffsetEnDia = +enDia.toFixed(6);
      datos.gateDiaCavidadMm = +dGate.toFixed(6);
      datos.gateAreaSecMm2 = +gate!.areaMm2.toFixed(6);
      const okA = Math.abs(a - 45) <= 5, okC = inc >= 20 - 1e-9, okO = enDia >= 3 - 1e-9;
      const est: EstadoC = okA && okC && okO ? 'CUMPLE' : (!okC || !okO) ? 'VIOLA' : 'ADVIERTE';
      const ejeDegCrudo = (Math.atan2(tr.dir[1], tr.dir[0]) * 180) / Math.PI;
      cotas.push({ k: 'ang', id: 'a45', texto: `${a.toFixed(1)}°`, ref: '§7.2.7 nominal 45°', estado: okA ? 'CUMPLE' : 'VIOLA', v: tr.c0, a0: Math.abs(ejeDegCrudo) > 90 ? 180 : 0, a1: ejeDegCrudo, rPx: 52 });
      const semiRad = (tr.semiDeg * Math.PI) / 180;
      const ejeRad = Math.atan2(tr.dir[1], tr.dir[0]);
      cotas.push({
        k: 'ang', id: 'a20', texto: `cono ${inc.toFixed(1)}°`, ref: '§7.2.7 ≥ 20°', estado: okC ? 'CUMPLE' : 'VIOLA',
        v: [tr.c0[0] - tr.dir[0] * (tr.r0 / Math.tan(semiRad || 1e-6)), tr.c0[1] - tr.dir[1] * (tr.r0 / Math.tan(semiRad || 1e-6))],
        a0: ((ejeRad - semiRad) * 180) / Math.PI, a1: ((ejeRad + semiRad) * 180) / Math.PI, rPx: 74,
      });
      cotas.push({ k: 'lin', id: 'off3d', texto: `${offMed.toFixed(2)} = ${enDia.toFixed(2)}·⌀`, ref: '§7.2.7 ≥ 3 ⌀', estado: okO ? 'CUMPLE' : 'VIOLA', p: [uBoca, meta.zPartMm], q: [uBoca, zBoca], offPx: -44 });
      const pp: Vec2 = tipo === 'banana' ? [0, 1] : [tr.dir[1], -tr.dir[0]];
      cotas.push({
        k: 'lin', id: 'dtun', texto: `⌀ boca ${dGate.toFixed(2)}`, ref: '§7.2.7 el ⌀ que cuenta', estado: 'DESCRIPTIVA',
        p: [uBoca - (dGate / 2) * pp[0], zBoca - (dGate / 2) * pp[1]],
        q: [uBoca + (dGate / 2) * pp[0], zBoca + (dGate / 2) * pp[1]], offPx: -20,
      });
      put('V7.7', est,
        `Las tres cotas duras de §7.2.7, medidas sobre el dibujo: "a nominal 45 degree angle should be maintained" → ${a.toFixed(2)}°${okA ? ' ✓' : ' ✗'} (banda ±5° declarada como EXTENSIÓN de "nominal"); `
        + `"the tunnel gate should have an included taper angle of at least 20 degrees" → ${inc.toFixed(2)}°${okC ? ' ✓' : ' ✗'}; `
        + `"the tunnel gate should be located at least three tunnel diameters off the parting plane" → ${enDia.toFixed(2)} ⌀${okO ? ' ✓' : ' ✗'} (el ⌀ del túnel se toma en la BOCA, que es el que nombra al gate: ⌀${dGate.toFixed(2)}). `
        + `Con eso "the motion of the core insert away from the cavity insert causes the tunnel gate to break at its junction with the molding".`,
        `eje ${a.toFixed(2)}° · cono ${inc.toFixed(2)}° · offset ${offMed.toFixed(2)} mm = ${enDia.toFixed(2)} ⌀`,
        '45° · ≥ 20° · ≥ 3 ⌀');
    }
  } else noAplica('V7.7', `${tipo}: sin túnel que acotar (§7.2.7).`);

  // ═══ V7.8 · SUBMARINO EXTENDIDO vs. SUPERFICIE VISIBLE (§7.2.7 Fig 7.14) ═
  if (tipo === 'tunnel' || tipo === 'banana') {
    const piezas = [pz(sec, 'gate'), pz(sec, 'gate-curva')].filter((p): p is PiezaSeccionada => !!p && !p.vacio);
    let dVis = Infinity, dOcu = Infinity;
    for (const p of piezas) {
      for (const s of meta.visibles) dVis = Math.min(dVis, distLazoASegmento(p, s));
      for (const s of meta.ocultas) dOcu = Math.min(dOcu, distLazoASegmento(p, s));
    }
    datos.distASuperficieVisibleMm = +dVis.toFixed(6);
    datos.distASuperficieOcultaMm = Number.isFinite(dOcu) ? +dOcu.toFixed(6) : null;
    const toca = dVis <= 1e-6;
    put('V7.8', toca ? 'ADVIERTE' : 'CUMPLE',
      toca
        ? `la trayectoria del gate MUERE sobre superficie VISIBLE (distancia ${dVis.toFixed(3)} mm): el vestigio queda a la vista. Es exactamente lo que resuelve el submarino extendido ("banana"/"cashew", Fig 7.14) llevando el gate por debajo de la superficie vista. El juicio estético formal es de V7.1.`
        : `la trayectoria curva pasa a ${dVis.toFixed(2)} mm de la superficie visible y entra por la cara oculta (${dOcu.toFixed(2)} mm): el vestigio no se ve. El libro advierte que a cambio el degatado es más delicado.`,
      `min. distancia a superficie visible ${dVis.toFixed(3)} mm`, '> 0 (no cruzar)');
  } else noAplica('V7.8', `${tipo}: no es submarino (§7.2.7 Fig 7.14).`);

  // ═══ V7.9 · GATES TÉRMICOS (§7.2.8) ══════════════════════════════════════
  if (tipo === 'thermal-pin' || tipo === 'thermal-sprue') {
    const esPin = tipo === 'thermal-pin';
    const p = pz(sec, esPin ? 'orificios' : 'bore');
    if (!p || p.vacio) put('V7.9', 'SIN CABLEAR', 'no se pudo medir el paso de flujo sobre la sección.');
    else {
      // ⌀ MEDIDO: ancho del lazo (orificio) o del bore
      const anchos = p.lazos.map((L) => Math.max(...L.pts.map((q) => q[0])) - Math.min(...L.pts.map((q) => q[0])));
      const dMed = anchos.reduce((a, b) => a + b, 0) / anchos.length;
      const nOri = esPin ? (cmd.nOrificios || 4) : 1;
      const area = nOri * Math.PI * dMed * dMed / 4;
      datos.pasoDiaMedidoMm = +dMed.toFixed(6);
      datos.pasoNumero = nOri;
      datos.pasoAreaMm2 = +area.toFixed(6);
      let est: EstadoC = 'DESCRIPTIVA', med = `${esPin ? `${nOri} orificios` : 'bore abierto'} ⌀${dMed.toFixed(2)} · A ${area.toFixed(2)} mm²`;
      let extra = '';
      if (meta.VdotM3s != null && meta.shearMaxS != null) {
        const g = shearRateCyl(meta.VdotM3s / nOri, dMed / 2000);
        datos.pasoShearS = Math.round(g);
        est = g <= meta.shearMaxS ? 'CUMPLE' : 'VIOLA';
        med += ` · γ̇ ${Math.round(g).toLocaleString()} 1/s`;
        extra = ` γ̇ por paso = ${Math.round(g).toLocaleString()} 1/s contra el máximo ${meta.shearMaxS.toLocaleString()} del Apéndice A (Tabla 7.2, cilindro).`;
      } else {
        est = 'SIN CABLEAR';
        extra = ' El juicio de cizallamiento necesita V̇ y material: SIN CABLEAR.';
      }
      put('V7.9', est,
        esPin
          ? `el pin-point térmico usa "three or four orifices" → alto cizallamiento y riesgo de degradación en estancamiento.${extra}`
          : `el sprue térmico tiene "open flow bore within the nozzle… reduced shear rates and pressure drop"; tras la apertura "an annulus of the solidified material will be broken around the torpedo tip. However, a thin solidified layer will remain" (${cmd.pielMm.toFixed(2)} mm dibujados).${extra}`,
        med, meta.shearMaxS != null ? `γ̇ ≤ ${meta.shearMaxS.toLocaleString()} 1/s` : undefined);
    }
  } else noAplica('V7.9', `${tipo}: no es gate térmico (§7.2.8).`);

  // ═══ V7.10 · VALVE GATE: ESCALÓN ≈ 0 (§7.2.9) ════════════════════════════
  if (tipo === 'valve') {
    const vas = pz(sec, 'vastago'), mol = pz(sec, 'moldeo');
    if (!vas || vas.vacio || !mol) put('V7.10', 'SIN CABLEAR', 'no se pudo medir la cara del vástago sobre la sección.');
    else if (o.pose === 'abierta') {
      put('V7.10', 'SIN CABLEAR',
        '"the valve pin is retracted to provide access to the mold cavity" — en la pose ABIERTA el escalón no se juzga; el criterio de §7.2.9 vive en la pose CERRADA. Esta lámina la trae como recuadro, pero el veredicto exige la lámina cerrada.');
    } else {
      const zCara = vas.bbox!.v0;
      const zCav = vEnRangoU(mol, (cmd.dvMm ?? 0) * 0.9, Infinity)!.vMax;   // superficie de cavidad lejos del vástago
      const esc = zCara - zCav;
      const tol = o.tolEscalonMm ?? 0.02;
      datos.escalonMedidoMm = +esc.toFixed(6);
      const est: EstadoC = Math.abs(esc) <= tol ? 'CUMPLE' : Math.abs(esc) <= 5 * tol ? 'ADVIERTE' : 'VIOLA';
      cotas.push({ k: 'nota', id: 'esc', texto: `escalón ${esc >= 0 ? '+' : ''}${esc.toFixed(3)} mm`, ref: '§7.2.9 ≈ 0', estado: est, p: [0, Math.max(zCara, zCav)], dxPx: 96, dyPx: -54 });
      put('V7.10', est,
        `"the face of the valve pin presents a mold shut-off surface to the mold cavity when closed and thereby significantly reduces the gate vestige" (§7.2.9): la cara del vástago debe quedar AL RAS. `
        + (Math.abs(esc) <= tol ? 'Medido al ras.' : esc > 0 ? `Queda ${esc.toFixed(3)} mm RETRASADA: el plástico llena ese escalón y ES el vestigio.` : `Queda ${(-esc).toFixed(3)} mm ADELANTADA: el vástago marca la pieza y golpea acero contra acero.`)
        + ` La banda de "≈ 0" (±${tol} mm) es EXTENSIÓN DECLARADA: el libro dice "al ras", no da número.`,
        `escalón ${esc >= 0 ? '+' : ''}${esc.toFixed(4)} mm`, `|escalón| ≤ ${tol} mm`);
    }
  } else noAplica('V7.10', `${tipo}: sin vástago de válvula (§7.2.9).`);

  // ═══ V6.4 · SECCIÓN ANULAR DEL VALVE GATE (§6.5.1 Fig 6.21) ══════════════
  if (tipo === 'valve') {
    const can = pz(sec, 'canal');
    if (!can || can.vacio) put('V6.4', 'SIN CABLEAR', 'no se pudo medir la corona anular sobre la sección.');
    else {
      const us = can.lazos.flatMap((L) => L.pts.map((q) => Math.abs(q[0])));
      const Db = 2 * Math.max(...us), dv = 2 * Math.min(...us);
      const dh = Db - dv;                                    // forma cerrada: 4A/P = D − d
      // OJO con la contabilidad: lo que el corte da es el área de la sección
      // AXIAL (dos bandas), NO el área de FLUJO de la corona. La de flujo es
      // π/4·(D²−d²) y se deriva de los ⌀ MEDIDOS. Confundirlas fue un bug real.
      const largoCanal = can.bbox!.v1 - can.bbox!.v0;
      const areaFlujo = (Math.PI / 4) * (Db * Db - dv * dv);
      datos.anularDbMm = +Db.toFixed(6); datos.anularDvMm = +dv.toFixed(6); datos.anularDhMm = +dh.toFixed(6);
      datos.anularAreaSeccionAxialMm2 = +can.areaMm2.toFixed(6);
      datos.anularLargoMm = +largoCanal.toFixed(6);
      datos.anularAreaFlujoMm2 = +areaFlujo.toFixed(6);
      cotas.push({ k: 'lin', id: 'anu', texto: `corona ${(dh / 2).toFixed(2)} · Dh ${dh.toFixed(2)}`, ref: '§6.5.1 Dh = D − d', estado: 'DESCRIPTIVA', p: [dv / 2, cmd.zPinMm + 2.2], q: [Db / 2, cmd.zPinMm + 2.2], offPx: -30 });
      put('V6.4', 'DESCRIPTIVA',
        `Fig 6.21 publica la geometría para el ⌀ hidráulico equivalente SIN par bueno/malo, así que aquí se MIDE y se reporta, no se califica. La corona entre vástago y pared da Dh = 4A/P = D − d en forma cerrada. Lo que el corte entrega es el área de la sección AXIAL (${can.areaMm2.toFixed(2)} mm² = (D−d)·largo); el área de FLUJO de la corona es π/4·(D²−d²) y se deriva de los ⌀ medidos — son dos números distintos y la lámina no los confunde.`,
        `⌀ canal ${Db.toFixed(2)} · ⌀ vástago ${dv.toFixed(2)} → Dh ${dh.toFixed(3)} mm · A_flujo ${areaFlujo.toFixed(2)} mm²`);
    }
  } else noAplica('V6.4', `${tipo}: sin canal caliente con vástago (§6.5.1 Fig 6.21).`);

  // ── cotas comunes: ⌀ del canal y espesor del gate ──
  if (runner && !runner.vacio && meta.perfil) {
    const b = runner.bbox!;
    cotas.push({ k: 'lin', id: 'dcanal', texto: `⌀ ${D}`, ref: '§6.5.5 steel-safe', estado: 'DESCRIPTIVA', p: [b.u0, b.v0 - 0.02], q: [b.u1, b.v0 - 0.02], offPx: -26 });
  }
  if (tipo === 'diaphragm' && tMed != null) {
    const R = uMaxEnV(pz(sec, 'moldeo'), cmd.tLandMm ?? 0) ?? cmd.RdiafMm;
    cotas.push({ k: 'lin', id: 'tland', texto: `land t ${tMed.toFixed(2)}`, ref: '§7.2.6 minimizar', estado: V.get('V7.6')!.estado, p: [R, 0], q: [R, tMed], offPx: 30 });
    cotas.push({ k: 'lin', id: 'rdia', texto: `R ${R.toFixed(2)} → testigo ${(2 * Math.PI * R).toFixed(1)} mm`, ref: '§7.2.6 línea testigo = TODA la circunferencia', estado: 'DESCRIPTIVA', p: [0, 0], q: [R, 0], offPx: -26 });
    cotas.push({ k: 'lin', id: 'tdisc', texto: `diafragma ${(cmd.tDiscMm ?? 0).toFixed(2)}`, ref: '§7.2.6', estado: 'DESCRIPTIVA', p: [0, 0], q: [0, cmd.tDiscMm ?? 0], offPx: 22 });
  }
  if ((tipo === 'thermal-pin' || tipo === 'thermal-sprue') && tMed != null) {
    const p = pz(sec, tipo === 'thermal-pin' ? 'orificios' : 'bore');
    if (p && p.bbox) {
      const v = p.bbox.v0 + (p.bbox.v1 - p.bbox.v0) * 0.35;
      const uc = tipo === 'thermal-pin' ? Math.max(...p.lazos.flatMap((L) => L.pts.map((q) => q[0]))) - tMed / 2 : 0;
      cotas.push({ k: 'lin', id: 'dpaso', texto: `⌀ ${tMed.toFixed(2)} ${tipo === 'thermal-pin' ? `× ${cmd.nOrificios}` : 'bore abierto'}`, ref: '§7.2.8', estado: V.get('V7.9')!.estado, p: [uc - tMed / 2, v], q: [uc + tMed / 2, v], offPx: -24 });
    }
    const piel = pz(sec, 'piel');
    if (piel && piel.bbox) {
      const v = piel.bbox.v0 + (piel.bbox.v1 - piel.bbox.v0) * 0.72;
      cotas.push({ k: 'lin', id: 'piel', texto: `capa ${(cmd.pielMm ?? 0).toFixed(2)}`, ref: '§7.2.8 "a thin solidified layer will remain"', estado: 'DESCRIPTIVA', p: [(cmd.DbMm ?? 0) / 2 - (cmd.pielMm ?? 0), v], q: [(cmd.DbMm ?? 0) / 2, v], offPx: 26 });
    }
  }
  if (tipo === 'valve' && tMed != null) {
    cotas.push({ k: 'lin', id: 'dvast', texto: `⌀ vástago ${tMed.toFixed(2)}`, ref: '§7.2.9 la cara ES la superficie de cierre', estado: 'DESCRIPTIVA', p: [-tMed / 2, cmd.zPinMm ?? 0], q: [tMed / 2, cmd.zPinMm ?? 0], offPx: -28 });
  }
  if (tMed != null && meta.familia === 'lateral' && tipo !== 'tunnel' && tipo !== 'banana') {
    cotas.push({ k: 'lin', id: 'tg', texto: `t ${tMed.toFixed(2)}`, ref: '§7.2.6 minimizar', estado: V.get('V7.6')!.estado, p: [cmd.xg1, 0], q: [cmd.xg1, tMed], offPx: 24 });
    cotas.push({ k: 'lin', id: 'lg', texto: `land ${(cmd.xg1 - cmd.xg0).toFixed(2)}`, ref: '§7.2.3', estado: 'DESCRIPTIVA', p: [cmd.xg0, 0], q: [cmd.xg1, 0], offPx: -22 });
  }

  const veredictos = V_TITULOS.map(([id]) => V.get(id)!).filter(Boolean);
  const verde = !veredictos.some((v) => v.estado === 'VIOLA' || v.estado === 'SIN CABLEAR');
  datos.tipo = tipo;
  datos.nCumple = veredictos.filter((v) => v.estado === 'CUMPLE').length;
  datos.nSinCablear = veredictos.filter((v) => v.estado === 'SIN CABLEAR').length;
  datos.nViola = veredictos.filter((v) => v.estado === 'VIOLA').length;
  return { cotas, veredictos, datos, verde };
}

// ─────────────────────────────────────────────────────────────────────────────
// LA LÁMINA
// ─────────────────────────────────────────────────────────────────────────────

const ESC = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS7 = `
  .bg{fill:#0b0f16}
  .tit{fill:#e9eef5;font:700 19px 'JetBrains Mono',monospace}
  .sub{fill:#8fa3bd;font:400 12px 'JetBrains Mono',monospace}
  .cita{fill:#c9a227;font:700 12px 'JetBrains Mono',monospace}
  .lbl{fill:#c3d0e0;font:400 11.5px 'JetBrains Mono',monospace}
  .lblSm{fill:#8fa3bd;font:400 10px 'JetBrains Mono',monospace}
  .cot{fill:#e9eef5;font:700 10.5px 'JetBrains Mono',monospace}
  .cotSm{fill:#e9eef5;font:700 9.5px 'JetBrains Mono',monospace}
`;

const COLOR_C: Record<EstadoC, string> = {
  'CUMPLE': '#59d98c', 'ADVIERTE': '#ffb347', 'VIOLA': '#ff5c5c',
  'SIN CABLEAR': '#ffd166', 'NO APLICA': '#5c6a7e', 'DESCRIPTIVA': '#7fb6d9',
};
const PAL7: Record<string, { base: string; linea: string; solido?: boolean }> = {
  placa: { base: '#161e2b', linea: '#7d90ab' },
  inserto: { base: '#1b2434', linea: '#9db6d2' },
  componente: { base: '#2b2513', linea: '#d7b23c' },
  moldeo: { base: '#ff9d4d', linea: '#ffd0a0', solido: true },
  agua: { base: '#2aa6e8', linea: '#bfe9ff', solido: true },
  colada: { base: '#e3c96a', linea: '#fff0b8', solido: true },
};

interface Caja { x: number; y: number; w: number; h: number }

/** Pinta una sección dentro de una caja de pantalla. Devuelve el SVG y el mapeo
 *  (lo reusan el dibujo principal y los recuadros de apoyo: planta del abanico,
 *  pose abierta del valve gate). */
function pintaSeccion(sec: Seccion, ven: { u0: number; u1: number; v0: number; v1: number }, box: Caja, idClip: string, defs: string[]) {
  const aw = Math.max(1e-6, ven.u1 - ven.u0), ah = Math.max(1e-6, ven.v1 - ven.v0);
  const k = Math.min(box.w / aw, box.h / ah);
  const cu = (ven.u0 + ven.u1) / 2, cv = (ven.v0 + ven.v1) / 2;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const X = (u: number) => cx + (u - cu) * k;
  const Y = (v: number) => cy - (v - cv) * k;
  const out: string[] = [];
  defs.push(`<clipPath id="${idClip}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/></clipPath>`);
  sec.piezas.forEach((p, i) => {
    if (p.vacio) return;
    const pal = PAL7[p.rol] ?? PAL7.componente;
    let fill = pal.base;
    if (!pal.solido) {
      const pid = `hx7-${idClip}-${i}`;
      const paso = p.rol === 'inserto' ? 7 : 5;
      const ang = p.id === 'ins-A' ? 45 : p.id === 'ins-B' ? -45 : p.id.includes('vast') || p.id.includes('torpedo') ? 25 : -25;
      defs.push(`<pattern id="${pid}" width="${paso}" height="${paso}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ang})">`
        + `<rect width="${paso}" height="${paso}" fill="${pal.base}"/>`
        + `<line x1="0" y1="0" x2="0" y2="${paso}" stroke="${pal.linea}" stroke-width="0.85" opacity="0.55"/></pattern>`);
      fill = `url(#${pid})`;
    }
    const d = p.lazos.map((L) => 'M' + L.pts.map((q) => `${X(q[0]).toFixed(2)},${Y(q[1]).toFixed(2)}`).join('L') + 'Z').join('');
    out.push(`<path d="${d}" fill="${fill}" fill-rule="evenodd"/>`);
    const b = p.bordes.map((e) => `M${X(e[0]).toFixed(2)},${Y(e[1]).toFixed(2)}L${X(e[2]).toFixed(2)},${Y(e[3]).toFixed(2)}`).join('');
    out.push(`<path d="${b}" fill="none" stroke="${pal.linea}" stroke-width="${pal.solido ? 1.1 : 0.8}" opacity="0.95"/>`);
  });
  return { svg: out.join(''), X, Y, k, box };
}

/**
 * LÁMINA L7 — el zoom en sección sobre la compuerta.
 * Devuelve el mismo objeto `Lamina` que el resto del juego (id/titulo/cita/
 * queMirar/svg) más las medidas crudas, para que el gate y el ojo de los agentes
 * miren exactamente lo mismo.
 */
export function laminaCompuerta(o: OpcionesCompuerta): Lamina & {
  medidas: MedidasCompuerta; seccion: Seccion; meta: MetaCompuerta; perfiles: PerfilGeom[];
} {
  const W = o.ancho ?? 1080, H = o.alto ?? 760;
  const mod = modeloCompuerta(o);
  const sec = seccionarPorPlano(mod.solidos, mod.plano);
  const meta = mod.meta;
  const med = medirCompuerta(sec, meta, o);
  const perfiles = ORDEN_LIBRO.map((id) => perfilRunner(id, meta.runnerDiaMm, { n: 128 }));

  const defs: string[] = [];
  const PX = 676, PW = W - PX - 16;
  const BOX: Caja = { x: 40, y: 100, w: 616, h: 520 };
  const CH = Math.floor(PW / 6.05);
  const CHP = Math.floor((W - 80) / 6.05);
  const rec = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1) + '…');

  const dib = pintaSeccion(sec, meta.ventana, BOX, 'c7', defs);

  // ── ¿SE PUEDE JUZGAR LO QUE ESTA LÁMINA JUZGA? (arnés de render 3D) ──────────
  // Un rasgo de 1.5 px no es "difícil de ver": es IMPOSIBLE. El tunnel gate ⌀0.30
  // en una lámina de 5 px/mm medía exactamente eso. La lámina ahora MIDE si cada
  // cota que promete juzgar alcanza el mínimo legible, y si no, lo DICE en el pie
  // en vez de fingir que la dibujó.
  const kPxMm = Math.min(BOX.w / Math.max(1e-6, meta.ventana.u1 - meta.ventana.u0),
                         BOX.h / Math.max(1e-6, meta.ventana.v1 - meta.ventana.v0));
  const rasgos: RasgoBajoJuicio[] = [
    { nombre: 'espesor del gate', tamanoMm: meta.gateEspesorMm, queSeJuzga: 'V7.6 espesor a minimizar' },
    { nombre: '⌀ del canal', tamanoMm: meta.runnerDiaMm, queSeJuzga: 'V6.3 perfil del runner' },
    { nombre: 'pared de la pieza', tamanoMm: meta.paredMm, queSeJuzga: 'V7.6 gate vs pared local' },
  ].map((r) => ({ ...r } as RasgoBajoJuicio));
  const tam = verificarTamanoMinimo(rasgos, { k: kPxMm, dir: [0, 0, -1] } as never);
  const { X, Y, k } = dib;
  const cuerpo: string[] = [dib.svg];

  // ── plano de partición (§1.3.2: el molde ABRE aquí) ──
  if (meta.zPartMm >= meta.ventana.v0 && meta.zPartMm <= meta.ventana.v1 && meta.familia === 'lateral') {
    const yp = Y(meta.zPartMm);
    cuerpo.push(`<line x1="${BOX.x + 2}" y1="${yp.toFixed(1)}" x2="${BOX.x + BOX.w - 2}" y2="${yp.toFixed(1)}" stroke="#c9a227" stroke-width="1.1" stroke-dasharray="11 4 2 4" opacity="0.95"/>`
      + `<rect x="${BOX.x + 3}" y="${(yp - 14).toFixed(1)}" width="106" height="12" fill="#0b0f16" fill-opacity="0.85" rx="2"/>`
      + `<text class="lblSm" style="fill:#c9a227" x="${BOX.x + 6}" y="${(yp - 4.6).toFixed(1)}">PARTICIÓN A|B</text>`);
  }
  // ── plano de corte del degatado (§7.2.1: "their removal will leave a witness mark") ──
  if (meta.tipo === 'sprue' && meta.comandado.zCorteMm != null) {
    const yc = Y(meta.comandado.zCorteMm), xr = (meta.comandado.rBaseMm ?? 1) * k * 1.7;
    cuerpo.push(`<line x1="${(X(0) - xr).toFixed(1)}" y1="${yc.toFixed(1)}" x2="${(X(0) + xr).toFixed(1)}" y2="${yc.toFixed(1)}" stroke="#ff5c5c" stroke-width="1.1" stroke-dasharray="6 3" opacity="0.9"/>`
      + `<text class="lblSm" style="fill:#ff5c5c" x="${(X(0) + xr + 5).toFixed(1)}" y="${(yc + 3.5).toFixed(1)}">corte del degatado</text>`);
  }
  // ── superficie VISIBLE de la pieza (la que V7.8 vigila) ──
  for (const s of meta.visibles) {
    cuerpo.push(`<line x1="${X(s[0][0]).toFixed(1)}" y1="${Y(s[0][1]).toFixed(1)}" x2="${X(s[1][0]).toFixed(1)}" y2="${Y(s[1][1]).toFixed(1)}" stroke="#59d98c" stroke-width="3" opacity="0.9" stroke-dasharray="7 3"/>`);
  }

  // ── cotas ──
  const flecha = (x: number, y: number, ang: number, col: string) =>
    `<path d="M${x.toFixed(1)},${y.toFixed(1)} L${(x + 7 * Math.cos(ang + 0.28)).toFixed(1)},${(y + 7 * Math.sin(ang + 0.28)).toFixed(1)} L${(x + 7 * Math.cos(ang - 0.28)).toFixed(1)},${(y + 7 * Math.sin(ang - 0.28)).toFixed(1)} Z" fill="${col}"/>`;
  const chip = (x: number, y: number, txt: string, col: string, cls = 'cot') => {
    const wd = txt.length * 6.1 + 8;
    return `<rect x="${(x - wd / 2).toFixed(1)}" y="${(y - 9.5).toFixed(1)}" width="${wd.toFixed(1)}" height="13" rx="2.5" fill="#0b0f16" fill-opacity="0.88" stroke="${col}" stroke-width="0.5"/>`
      + `<text class="${cls}" style="fill:${col}" x="${x.toFixed(1)}" y="${(y + 0.6).toFixed(1)}" text-anchor="middle">${ESC(txt)}</text>`;
  };
  const cotasSvg: string[] = [];
  /** Resolución de encimados: en un zoom de detalle TODAS las cotas nacen en el
   *  mismo par de milímetros. Se prueba el lugar preferido y, si está tomado, se
   *  va alejando en la dirección del desplazamiento (o alternando arriba/abajo),
   *  y se tira una guía fina para que la cota no quede "flotando". */
  const puestas: Array<{ x: number; y: number; w: number }> = [];
  const acomoda = (x: number, y: number, txt: string, dirX = 0, dirY = 1) => {
    const w = txt.length * 6.1 + 10;
    const choca = (px: number, py: number) =>
      puestas.some((q) => Math.abs(q.y - py) < 14 && Math.abs(q.x - px) < (q.w + w) / 2 + 4)
      || px - w / 2 < BOX.x + 2 || px + w / 2 > BOX.x + BOX.w - 2 || py < BOX.y + 10 || py > BOX.y + BOX.h - 6;
    let px = x, py = y;
    for (let g = 0; g < 14 && choca(px, py); g++) {
      const paso = 15 * (Math.floor(g / 2) + 1) * (g % 2 ? -1 : 1);
      px = x + (dirX ? paso * 2.2 : 0);
      py = y + (dirX ? 0 : paso);
      if (px - w / 2 < BOX.x + 2) px = BOX.x + 2 + w / 2;
      if (px + w / 2 > BOX.x + BOX.w - 2) px = BOX.x + BOX.w - 2 - w / 2;
    }
    puestas.push({ x: px, y: py, w });
    return { x: px, y: py, movido: Math.hypot(px - x, py - y) > 6 };
  };
  // El GATE es lo que la lámina viene a enseñar: se marca su corredor como
  // ocupado ANTES de colocar un solo rótulo. Sin esto, en un zoom de 3 mm los
  // chips caen justo encima del cono y la lámina no sirve para lo que existe.
  for (const id of ['gate', 'gate-curva', 'orificios', 'bore']) {
    const p = pz(sec, id);
    if (!p || p.vacio) continue;
    for (const L of p.lazos) for (let i = 0; i < L.pts.length; i += Math.max(1, Math.floor(L.pts.length / 24))) {
      puestas.push({ x: X(L.pts[i][0]), y: Y(L.pts[i][1]), w: 2 });
    }
  }
  const guia = (x0: number, y0: number, x1: number, y1: number, col: string) =>
    `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${col}" stroke-width="0.45" opacity="0.55"/>`;
  for (const c of med.cotas) {
    const col = COLOR_C[c.estado];
    if (c.k === 'lin') {
      const P = [X(c.p[0]), Y(c.p[1])], Q = [X(c.q[0]), Y(c.q[1])];
      let dx = Q[0] - P[0], dy = Q[1] - P[1];
      const L = Math.hypot(dx, dy);
      if (L < 1e-6) { dx = 1; dy = 0; }
      const ux = L > 1e-6 ? dx / L : 1, uy = L > 1e-6 ? dy / L : 0;
      const nx = -uy, ny = ux;
      const off = c.offPx;
      const P2 = [P[0] + nx * off, P[1] + ny * off], Q2 = [Q[0] + nx * off, Q[1] + ny * off];
      cotasSvg.push(`<line x1="${P[0].toFixed(1)}" y1="${P[1].toFixed(1)}" x2="${(P2[0] + nx * 4).toFixed(1)}" y2="${(P2[1] + ny * 4).toFixed(1)}" stroke="${col}" stroke-width="0.5" opacity="0.6"/>`
        + `<line x1="${Q[0].toFixed(1)}" y1="${Q[1].toFixed(1)}" x2="${(Q2[0] + nx * 4).toFixed(1)}" y2="${(Q2[1] + ny * 4).toFixed(1)}" stroke="${col}" stroke-width="0.5" opacity="0.6"/>`);
      if (L > 9) {
        cotasSvg.push(`<line x1="${P2[0].toFixed(1)}" y1="${P2[1].toFixed(1)}" x2="${Q2[0].toFixed(1)}" y2="${Q2[1].toFixed(1)}" stroke="${col}" stroke-width="1"/>`
          + flecha(P2[0], P2[1], Math.atan2(uy, ux), col) + flecha(Q2[0], Q2[1], Math.atan2(-uy, -ux), col));
      } else {
        cotasSvg.push(`<line x1="${(P2[0] - ux * 9).toFixed(1)}" y1="${(P2[1] - uy * 9).toFixed(1)}" x2="${(Q2[0] + ux * 9).toFixed(1)}" y2="${(Q2[1] + uy * 9).toFixed(1)}" stroke="${col}" stroke-width="1"/>`
          + flecha(P2[0], P2[1], Math.atan2(-uy, -ux), col) + flecha(Q2[0], Q2[1], Math.atan2(uy, ux), col));
      }
      const corta = L < 9;
      const mx = corta ? (P2[0] + Q2[0]) / 2 + Math.sign(c.offPx) * 26 : (P2[0] + Q2[0]) / 2 + nx * 11;
      const my0 = corta ? (P2[1] + Q2[1]) / 2 : (P2[1] + Q2[1]) / 2 + ny * 11;
      const pos = acomoda(mx, my0, c.texto, corta || Math.abs(nx) > Math.abs(ny) ? 1 : 0, 1);
      if (corta) cotasSvg.push(guia((P2[0] + Q2[0]) / 2, (P2[1] + Q2[1]) / 2, pos.x, pos.y, col));
      if (pos.movido) cotasSvg.push(guia(mx, my0, pos.x, pos.y, col));
      cotasSvg.push(chip(pos.x, pos.y, c.texto, col));
    } else if (c.k === 'ang') {
      const VC = [X(c.v[0]), Y(c.v[1])];
      if (VC[0] < BOX.x - 10 || VC[0] > BOX.x + BOX.w + 10 || VC[1] < BOX.y - 10 || VC[1] > BOX.y + BOX.h + 10) {
        // el vértice del cono cae fuera del zoom: se reporta como llamada, no se
        // finge un arco cuyo centro nadie puede ver
        const px = Math.min(Math.max(VC[0], BOX.x + 70), BOX.x + BOX.w - 70);
        const py = Math.min(Math.max(VC[1], BOX.y + 24), BOX.y + BOX.h - 24);
        const pos = acomoda(px, py, c.texto + ' (vértice fuera)', 0, 1);
        cotasSvg.push(chip(pos.x, pos.y, c.texto + ' (vértice fuera)', col));
        continue;
      }
      const a0 = -(c.a0 * Math.PI) / 180, a1 = -(c.a1 * Math.PI) / 180;
      const r = c.rPx;
      const p0 = [VC[0] + r * Math.cos(a0), VC[1] + r * Math.sin(a0)];
      const p1 = [VC[0] + r * Math.cos(a1), VC[1] + r * Math.sin(a1)];
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      cotasSvg.push(`<line x1="${VC[0].toFixed(1)}" y1="${VC[1].toFixed(1)}" x2="${(VC[0] + (r + 12) * Math.cos(a0)).toFixed(1)}" y2="${(VC[1] + (r + 12) * Math.sin(a0)).toFixed(1)}" stroke="${col}" stroke-width="0.5" opacity="0.65"/>`
        + `<line x1="${VC[0].toFixed(1)}" y1="${VC[1].toFixed(1)}" x2="${(VC[0] + (r + 12) * Math.cos(a1)).toFixed(1)}" y2="${(VC[1] + (r + 12) * Math.sin(a1)).toFixed(1)}" stroke="${col}" stroke-width="0.5" opacity="0.65"/>`
        + `<path d="M${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${r},${r} 0 0 ${da > 0 ? 1 : 0} ${p1[0].toFixed(1)},${p1[1].toFixed(1)}" fill="none" stroke="${col}" stroke-width="1.1"/>`
        + flecha(p0[0], p0[1], a0 + (da > 0 ? Math.PI / 2 : -Math.PI / 2), col)
        + flecha(p1[0], p1[1], a1 + (da > 0 ? -Math.PI / 2 : Math.PI / 2), col));
      const am = a0 + da / 2;
      const lx = VC[0] + (r + 20) * Math.cos(am), ly = VC[1] + (r + 20) * Math.sin(am);
      const pos = acomoda(lx, ly, c.texto, 0, 1);
      if (pos.movido) cotasSvg.push(guia(lx, ly, pos.x, pos.y, col));
      cotasSvg.push(chip(pos.x, pos.y, c.texto, col));
    } else {
      const P = [X(c.p[0]), Y(c.p[1])];
      const Q = [P[0] + c.dxPx, P[1] + c.dyPx];
      cotasSvg.push(`<line x1="${P[0].toFixed(1)}" y1="${P[1].toFixed(1)}" x2="${Q[0].toFixed(1)}" y2="${Q[1].toFixed(1)}" stroke="${col}" stroke-width="0.8"/>`
        + `<circle cx="${P[0].toFixed(1)}" cy="${P[1].toFixed(1)}" r="2.6" fill="${col}"/>`
        + chip(...(([pp]) => [pp.x, pp.y] as const)([acomoda(Q[0], Q[1], c.texto, 0, 1)]), c.texto, col));
    }
  }

  // ── rótulos de los sólidos (leader corto al centroide del lazo mayor) ──
  const rot: string[] = [];
  const ROT: Record<string, string> = {
    'runner': 'CANAL', 'gate': 'GATE', 'gate-curva': 'BANANA', 'moldeo': 'PIEZA',
    'sucker': 'SUCKER PIN', 'slug': 'slug', 'vastago': 'VÁSTAGO', 'canal': 'CANAL CALIENTE',
    'orificios': 'ORIFICIOS', 'bore': 'BORE ABIERTO', 'torpedo': 'TORPEDO', 'piel': 'capa aislante',
    'ins-A': 'INSERTO A', 'ins-B': 'INSERTO B', 'placa-X': 'PLACA DE COLADAS',
  };
  for (const p of sec.piezas) {
    if (p.vacio || !ROT[p.id] || !p.bbox) continue;
    const esAcero = p.rol === 'inserto';
    const ax = esAcero ? p.bbox.u0 + (p.bbox.u1 - p.bbox.u0) * 0.08 : (p.bbox.u0 + p.bbox.u1) / 2;
    const az = esAcero ? p.bbox.v0 + (p.bbox.v1 - p.bbox.v0) * 0.5 : (p.bbox.v0 + p.bbox.v1) / 2;
    const sx0 = X(ax), sy0 = Y(az);
    if (sx0 < BOX.x + 4 || sx0 > BOX.x + BOX.w - 4 || sy0 < BOX.y + 4 || sy0 > BOX.y + BOX.h - 4) continue;
    const pos = acomoda(sx0, sy0, ROT[p.id], 0, 1);
    const col = (PAL7[p.rol] ?? PAL7.componente).linea;
    rot.push(`<text class="lblSm" style="fill:${col};font-weight:700;paint-order:stroke;stroke:#0b0f16;stroke-width:2.6" x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" text-anchor="middle">${ESC(ROT[p.id])}</text>`);
  }

  // ── barra de escala (sin escala no hay lámina que se pueda medir a ojo) ──
  const anchoMm = meta.ventana.u1 - meta.ventana.u0;
  const paso = anchoMm > 40 ? 10 : anchoMm > 16 ? 5 : anchoMm > 6 ? 2 : 1;
  const ex = BOX.x + 10, ey = BOX.y + BOX.h - 12;
  const escala = `<rect x="${ex - 8}" y="${ey - 20}" width="${(paso * k + 16).toFixed(1)}" height="28" rx="3" fill="#0b0f16" fill-opacity="0.82"/>`
    + `<line x1="${ex}" y1="${ey}" x2="${ex + paso * k}" y2="${ey}" stroke="#8fa3bd" stroke-width="1.5"/>`
    + `<line x1="${ex}" y1="${ey - 4}" x2="${ex}" y2="${ey + 4}" stroke="#8fa3bd" stroke-width="1.5"/>`
    + `<line x1="${ex + paso * k}" y1="${ey - 4}" x2="${ex + paso * k}" y2="${ey + 4}" stroke="#8fa3bd" stroke-width="1.5"/>`
    + `<text class="lblSm" x="${ex + paso * k / 2}" y="${ey - 7}" text-anchor="middle">${paso} mm</text>`;

  // ── recuadro de apoyo: planta del abanico (V7.5) o pose ABIERTA (V7.10) ──
  let inset = '';
  const IB: Caja = { x: BOX.x + BOX.w - 214, y: BOX.y + 8, w: 206, h: 132 };
  if (meta.tipo === 'fan') {
    const wf = o.fanAnchoMm ?? meta.gateAnchoMm, wp = o.piezaAnchoMm ?? wf;
    const s = Math.min((IB.w - 46) / Math.max(wp, wf), (IB.h - 54) / (6 * meta.paredMm));
    const cxI = IB.x + IB.w / 2, y0 = IB.y + 34;
    const yG = y0 + 26, yP = y0 + 46;
    inset = `<rect x="${IB.x}" y="${IB.y}" width="${IB.w}" height="${IB.h}" rx="4" fill="#0d131c" fill-opacity="0.94" stroke="#33415a"/>`
      + `<text class="lblSm" style="fill:#c3d0e0;font-weight:700" x="${IB.x + 8}" y="${IB.y + 15}">PLANTA DEL ABANICO §7.2.5</text>`
      + `<rect x="${(cxI - meta.runnerDiaMm * s / 2).toFixed(1)}" y="${y0 - 4}" width="${(meta.runnerDiaMm * s).toFixed(1)}" height="8" fill="#e3c96a" opacity="0.9"/>`
      + `<path d="M${(cxI - meta.runnerDiaMm * s / 2).toFixed(1)},${y0 + 4} L${(cxI - wf * s / 2).toFixed(1)},${yG} L${(cxI + wf * s / 2).toFixed(1)},${yG} L${(cxI + meta.runnerDiaMm * s / 2).toFixed(1)},${y0 + 4} Z" fill="#e3c96a" opacity="0.75"/>`
      + `<rect x="${(cxI - wp * s / 2).toFixed(1)}" y="${yG}" width="${(wp * s).toFixed(1)}" height="${(yP - yG + 22).toFixed(1)}" fill="#ff9d4d" opacity="0.9" stroke="#ffd0a0"/>`
      + `<line x1="${(cxI - wf * s / 2).toFixed(1)}" y1="${yG - 8}" x2="${(cxI + wf * s / 2).toFixed(1)}" y2="${yG - 8}" stroke="#e9eef5" stroke-width="0.9"/>`
      + chip(cxI, IB.y + IB.h - 10, `abanico ${wf.toFixed(1)} / pieza ${wp.toFixed(1)} = ${(wf / wp).toFixed(2)}`, COLOR_C[med.veredictos.find((v) => v.id === 'V7.5')!.estado], 'cotSm');
  } else if (meta.tipo === 'valve' && o.pose !== 'abierta') {
    const m2 = modeloCompuerta({ ...o, pose: 'abierta' });
    const s2 = seccionarPorPlano(m2.solidos, m2.plano);
    const p2 = pintaSeccion(s2, m2.meta.ventana, { x: IB.x + 6, y: IB.y + 22, w: IB.w - 12, h: IB.h - 32 }, 'c7b', defs);
    inset = `<rect x="${IB.x}" y="${IB.y}" width="${IB.w}" height="${IB.h}" rx="4" fill="#0d131c" fill-opacity="0.96" stroke="#33415a"/>`
      + `<text class="lblSm" style="fill:#c3d0e0;font-weight:700" x="${IB.x + 8}" y="${IB.y + 15}">POSE ABIERTA (llenando) §7.2.9</text>`
      + `<g clip-path="url(#c7b)">${p2.svg}</g>`;
  }

  // ── panel derecho 1: los cuatro perfiles de Fig 6.20 ──
  const pan: string[] = [];
  let py = 112;
  pan.push(`<text class="lbl" style="font-weight:700" x="${PX}" y="${py}">PERFIL DEL CANAL · Fig 6.20 (⌀${meta.runnerDiaMm} nominal)</text>`);
  py += 6;
  const anchoCol = PW / 4;
  // los cuatro perfiles NO tienen la misma envolvente vertical (el redondo cruza
  // la partición; los otros cuelgan de ella), así que la línea base se calcula de
  // los extremos REALES o los rótulos caen encima de las siluetas.
  const zAlto = Math.max(...perfiles.flatMap((P) => P.pts.map((q) => q[1])));
  const zBajo = Math.min(...perfiles.flatMap((P) => P.pts.map((q) => q[1])));
  const escP = Math.min((anchoCol - 16) / meta.runnerDiaMm, 44 / Math.max(1e-6, zAlto - zBajo));
  const yBase = py + 16 + zAlto * escP;
  perfiles.forEach((P, i) => {
    const cxP = PX + anchoCol * (i + 0.5);
    const sel = meta.perfil?.id === P.id;
    const d = 'M' + P.pts.map((q) => `${(cxP + q[0] * escP).toFixed(2)},${(yBase - q[1] * escP).toFixed(2)}`).join('L') + 'Z';
    pan.push(`<path d="${d}" fill="${sel ? '#e3c96a' : '#2a3446'}" fill-opacity="${sel ? 0.92 : 0.85}" stroke="${sel ? '#fff0b8' : '#7d90ab'}" stroke-width="${sel ? 1.4 : 0.8}"/>`);
    pan.push(`<line x1="${(cxP - anchoCol / 2 + 5).toFixed(1)}" y1="${yBase.toFixed(1)}" x2="${(cxP + anchoCol / 2 - 5).toFixed(1)}" y2="${yBase.toFixed(1)}" stroke="#c9a227" stroke-width="0.6" stroke-dasharray="4 3" opacity="0.75"/>`);
    const col = sel ? '#fff0b8' : '#8fa3bd';
    const yTx = yBase - zBajo * escP + 13;
    pan.push(`<text class="lblSm" style="fill:${col};font-weight:${sel ? 700 : 400}" x="${cxP.toFixed(1)}" y="${yTx.toFixed(1)}" text-anchor="middle">Q ${P.qIso.toFixed(3)}</text>`);
    pan.push(`<text class="lblSm" style="fill:${col}" x="${cxP.toFixed(1)}" y="${(yTx + 11).toFixed(1)}" text-anchor="middle">${P.efLibroPct} % T6.3</text>`);
    pan.push(`<text class="lblSm" style="fill:${col}" x="${cxP.toFixed(1)}" y="${(yTx + 22).toFixed(1)}" text-anchor="middle">${rec(P.id.replace('trapezoide-fondo-redondo', 'fondo red.').replace('medio-redondo', 'medio red.').replace('trapezoidal', 'trapecio'), 13)}</text>`);
  });
  py = yBase - zBajo * escP + 52;
  const qs = perfiles.map((P) => P.qIso);
  const ordenOK = qs.every((q, i) => i === 0 || qs[i - 1] > q);
  pan.push(`<text class="lblSm" style="fill:${ordenOK ? '#59d98c' : '#ff5c5c'}" x="${PX}" y="${py}">${ESC(rec(`Q = 4πA/P² (máx. 1 en el círculo) ordena ${ordenOK ? 'IGUAL' : 'DISTINTO'} que Tabla 6.3`, CH))}</text>`);
  py += 12;
  pan.push(`<text class="lblSm" x="${PX}" y="${py}">${ESC(rec(`Dh/⌀ del medio redondo ${perfiles[3].efDhPct.toFixed(1)} % vs 61.2 % impreso`, CH))}</text>`);
  py += 18;

  // ── panel derecho 2: los once veredictos ──
  pan.push(`<text class="lbl" style="font-weight:700" x="${PX}" y="${py}">LAS ONCE QUE L7 DEBE JUZGAR</text>`);
  py += 14;
  for (const v of med.veredictos) {
    const col = COLOR_C[v.estado];
    pan.push(`<circle cx="${PX + 3.5}" cy="${(py - 3.4).toFixed(1)}" r="3.2" fill="${col}"/>`);
    pan.push(`<text class="lblSm" style="fill:${col};font-weight:700" x="${PX + 11}" y="${py}">${ESC(v.id)} ${ESC(v.estado)}</text>`);
    pan.push(`<text class="lblSm" style="fill:#6f8098" x="${PX + 11 + (v.id.length + v.estado.length + 2) * 6.05}" y="${py}">${ESC(rec(v.titulo, Math.max(2, CH - v.id.length - v.estado.length - 4)))}</text>`);
    py += 11;
    if (v.medido) {
      pan.push(`<text class="lblSm" style="fill:#c3d0e0" x="${PX + 11}" y="${py}">${ESC(rec('· ' + v.medido + (v.limite ? `  [${v.limite}]` : ''), CH - 2))}</text>`);
      py += 11;
    }
    py += 3;
  }

  // ── pie: el hallazgo, lo SIN CABLEAR y las extensiones ──
  const pie: string[] = [];
  let fy = 660;
  const peor = med.veredictos.find((v) => v.estado === 'VIOLA')
    ?? med.veredictos.find((v) => v.estado === 'SIN CABLEAR')
    ?? med.veredictos.find((v) => v.estado === 'ADVIERTE')
    ?? med.veredictos.find((v) => v.estado === 'CUMPLE');
  if (peor) {
    const txt = `${peor.estado} ${peor.id} (${peor.cita}): ${peor.porque}`;
    let resto = txt;
    for (let i = 0; i < 2 && resto; i++) {
      let corte = resto.length > CHP ? resto.lastIndexOf(' ', CHP) : resto.length;
      if (corte < CHP * 0.6) corte = CHP;
      pie.push(`<text class="lblSm" style="fill:${COLOR_C[peor.estado]}" x="40" y="${fy}">${ESC(resto.slice(0, corte))}</text>`);
      resto = resto.slice(corte).trim();
      fy += 13;
    }
  }
  const sinC = med.veredictos.filter((v) => v.estado === 'SIN CABLEAR').map((v) => v.id);
  const na = med.veredictos.filter((v) => v.estado === 'NO APLICA').map((v) => v.id);
  pie.push(`<text class="lblSm" style="fill:${sinC.length ? '#ffd166' : '#59d98c'}" x="40" y="${fy}">${ESC(rec(`SIN CABLEAR — no cuenta como cumplido: ${sinC.length ? sinC.join(' · ') : 'ninguna'}`, CHP))}</text>`);
  fy += 13;
  pie.push(`<text class="lblSm" style="fill:#5c6a7e" x="40" y="${fy}">${ESC(rec(`NO APLICA a una compuerta ${meta.tipo} (se declara, no se acredita): ${na.length ? na.join(' · ') : 'ninguna'}`, CHP))}</text>`);
  fy += 13;
  const exts = [...meta.extensiones, ...meta.avisos];
  pie.push(`<text class="lblSm" style="fill:#a98be0" x="40" y="${fy}">${ESC(rec(`EXTENSIONES DECLARADAS (${exts.length}): ${exts.join(' · ') || 'ninguna'}`, CHP))}</text>`);
  fy += 13;
  pie.push(`<text class="lblSm" style="fill:#8fa3bd" x="40" y="${fy}">${ESC(rec(`MEDIDO SOBRE EL DIBUJO: ángulos y ⌀ de los lazos de la sección · Q y Dh del perímetro mojado real · nada se copia del input`, CHP))}</text>`);

  const veredicto = med.verde ? 'VERDE' : med.datos.nViola ? 'CON VIOLACIONES' : 'INCOMPLETA';
  const colV = med.verde ? '#59d98c' : med.datos.nViola ? '#ff5c5c' : '#ffd166';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<style>${CSS7}</style><defs>${defs.join('')}</defs>`
    + `<rect class="bg" width="${W}" height="${H}"/>`
    + `<text class="tit" x="40" y="38">L7 · DETALLE DE LA COMPUERTA — ${ESC(meta.tipo.toUpperCase())}${meta.nombre && meta.nombre !== meta.tipo ? ' · ' + ESC(meta.nombre) : ''}</text>`
    + `<text class="sub" x="40" y="57">zoom en sección sobre el gate · pared ${meta.paredMm} mm · canal ⌀${meta.runnerDiaMm} · gate t ${meta.gateEspesorMm.toFixed(2)} mm · ${meta.material}</text>`
    + `<text class="cita" x="40" y="76">§6.5.1-6.5.2 · §7.2.1-7.2.9 · Fig 6.20-6.22 · Fig 7.2-7.17</text>`
    + `<text class="cot" style="fill:${colV}" x="${W - 24}" y="38" text-anchor="end">${veredicto}</text>`
    + `<text class="lblSm" x="${W - 24}" y="55" text-anchor="end">${med.datos.nCumple} cumple · ${med.datos.nViola} viola · ${med.datos.nSinCablear} sin cablear · ${na.length} no aplica</text>`
    + `<rect x="${BOX.x - 4}" y="${BOX.y - 4}" width="${BOX.w + 8}" height="${BOX.h + 8}" rx="4" fill="none" stroke="#2a3446"/>`
    + `<g clip-path="url(#c7)">${cuerpo.join('')}</g>`
    + escala + inset
    + `<g>${cotasSvg.join('')}</g>`
    + `<g>${rot.join('')}</g>`
    + `<line x1="${PX - 10}" y1="96" x2="${PX - 10}" y2="632" stroke="#2a3446"/>`
    + pan.join('') + pie.join('')
    + `</svg>`;

  return {
    id: `L7-${meta.tipo}`,
    titulo: `L7 · Detalle de la compuerta — ${meta.tipo}`,
    cita: '§7.2 Gate Design · §6.5 Runner Design · Fig 7.2-7.17 / 6.20-6.22',
    queMirar: `Los ángulos y ⌀ están acotados SOBRE el dibujo: ¿el cono abre para el lado correcto, el eje del túnel llega a 45°, el escalón del vástago es cero, el pin del sucker está al ras del fondo del canal? Y en el panel: ¿el perfil elegido es el más eficiente que la pieza tolera?`,
    svg, medidas: med, seccion: sec, meta, perfiles,
  };
}

/** Cobertura de las once verificaciones sobre un JUEGO de láminas (una L7 sola
 *  no puede juzgar las once: cada tipo de compuerta activa las suyas). */
export function coberturaL7(meds: MedidasCompuerta[]): Record<string, EstadoC> {
  const rank: EstadoC[] = ['NO APLICA', 'SIN CABLEAR', 'DESCRIPTIVA', 'ADVIERTE', 'VIOLA', 'CUMPLE'];
  const out: Record<string, EstadoC> = {};
  for (const { id } of VERIFICACIONES_L7) {
    let mejor: EstadoC = 'NO APLICA';
    for (const m of meds) {
      const v = m.veredictos.find((x) => x.id === id);
      if (v && rank.indexOf(v.estado) > rank.indexOf(mejor)) mejor = v.estado;
    }
    out[id] = mejor;
  }
  return out;
}
