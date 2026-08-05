/**
 * EL ARNÉS DE RENDER 3D — verificar que una vista dibuja LO QUE DICE dibujar.
 * =============================================================================
 *
 * EL PROBLEMA (no es descuido, es estructural):
 *   1. La proyección 2D de algo 3D es AMBIGUA POR CONSTRUCCIÓN: profundidad, orden
 *      de oclusión y espejeo colapsan en los mismos píxeles.
 *   2. Un render EQUIVOCADO se ve perfectamente bien: el rasterizador dibuja con
 *      toda fidelidad un modelo incorrecto y nada en la imagen grita.
 *   3. Sub-píxel = invisible. Un tunnel gate de 0.3 mm en una lámina de 5 px/mm mide
 *      1.5 px. No se puede juzgar mirándolo: es imposible, no es falta de atención.
 *   4. Fallan DOS capas distintas — el MODELO y el DIBUJO DEL MODELO — y se confunden.
 *      Caso real: en la lámina L7 el modelo y los números estaban perfectos y MINTIÓ
 *      EL DIBUJO (las cotas de ⌀ cruzadas hacían ver el cono al revés).
 *
 * LA REGLA QUE ESTE MÓDULO ENCODA:
 *   **Si la versión CORRUPTA de un render no se distingue de la correcta por un
 *   número, esa imagen NO ES EVIDENCIA y el criterio tiene que ser numérico.**
 *
 * LOS CUATRO MECANISMOS:
 *   §2 FIDUCIAL          — triada + cubo + esfera con proyección en FORMA CERRADA.
 *                          Caza escala, ejes y mano (espejo) en números, no a ojo.
 *   §3 MULTI-VISTA       — triangula un punto 3D conocido desde pares de vistas.
 *                          Fusiona lo que la cabeza no fusiona y devuelve un residuo.
 *   §4 DIFERENCIAL       — mueve un delta CONOCIDO y verifica la DERIVADA de la
 *                          imagen. Un signo o un eje mal salen aunque el cuadro
 *                          estático se vea bien.
 *   §5 RENDER CORRUPTO   — fabrica a propósito la versión mal (espejo, ejes
 *                          intercambiados, profundidad invertida) y MIDE la distancia.
 *                          Distancia ~0 ⇒ la vista NO DISCRIMINA ⇒ el arnés FALLA.
 *   §6 TAMAÑO MÍNIMO     — cada rasgo bajo juicio ocupa ≥ N px o se exige recuadro.
 *
 * MODELO DE CÁMARA: ORTOGRÁFICA, por dos razones duras.
 *   (a) Es la que usa el motor ya verificado (`mold/visibilidad.ts` rasteriza con
 *       z-buffer ortográfico) y la que usan TODAS las láminas técnicas.
 *   (b) En ortográfica la proyección del fiducial tiene FORMA CERRADA EXACTA, así
 *       que el residuo esperado es cero-máquina (1e-13 px), no "aceptablemente
 *       chico". Una tolerancia de 1e-9 px no se puede aflojar sin que se note.
 *
 * PURO: sin DOM, sin WebGL, sin estado. Todo es node-testeable.
 * Gate: `node --import tsx scripts/verif-render3d-test.cjs`
 */

// ─────────────────────────────────────────────────────────────────────────────
// §0 · TIPOS BASE
// ─────────────────────────────────────────────────────────────────────────────

export type P3 = [number, number, number];
export type Pt2 = [number, number];

/**
 * Cámara ORTOGRÁFICA. La convención de base es EXACTAMENTE la de
 * `mold/visibilidad.ts` (`baseConArribaZ`): `w` = dirección de mirada del OJO hacia
 * la escena, `v` = "arriba" ortonormalizado contra `w`, `u = v × w` = derecha de
 * pantalla. Con esa construcción det(u,v,w) = +1 SIEMPRE: la mano correcta está
 * fijada por el constructor, y cualquier desviación medida es un defecto real.
 * (El gate cruza mi proyección contra `proyectarParaLamina` para probar que no me
 * inventé otra convención.)
 */
export interface CamaraOrto {
  nombre: string;
  /** dirección de mirada, del OJO hacia la escena. Se normaliza. */
  dir: P3;
  /** "arriba" en mundo; se ortonormaliza contra `dir`. Por defecto +Z (+Y si dir ‖ Z). */
  arriba?: P3;
  /** escala: px por mm */
  k: number;
  /** centro del encuadre, en px */
  cx: number;
  cy: number;
  /** el punto del mundo que cae en (cx, cy). Por defecto el origen. */
  mira?: P3;
  /** la imagen tiene +Y hacia ABAJO (SVG/pantalla/canvas). Por defecto true. */
  yAbajo?: boolean;

  // — los dos siguientes existen SOLO para fabricar el render CORRUPTO a propósito
  //   (§5). Una cámara sana no los trae. Se declaran aquí para que la corrupción sea
  //   un dato explícito y no un parche escondido en el llamador.
  /** espejea la imagen en horizontal (u → −u): el defecto "mano invertida". */
  espejoX?: boolean;
  /** px por mm VERTICAL distinto del horizontal: el defecto "render anisótropo". */
  kY?: number;
}

export interface BaseCamara { u: P3; v: P3; w: P3 }

const norm3 = (d: P3): P3 => {
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / L, d[1] / L, d[2] / L];
};
const dot3 = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: P3, b: P3): P3 => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];

/** Base ortonormal de la cámara. MISMA convención que `visibilidad.baseConArribaZ`. */
export function baseCamara(cam: CamaraOrto): BaseCamara {
  const w = norm3(cam.dir);
  const arr: P3 = cam.arriba ?? (Math.abs(w[2]) > 0.999 ? [0, 1, 0] : [0, 0, 1]);
  const d = dot3(arr, w);
  let v: P3 = [arr[0] - d * w[0], arr[1] - d * w[1], arr[2] - d * w[2]];
  const lv = Math.hypot(v[0], v[1], v[2]);
  if (lv < 1e-12) throw new Error(`cámara "${cam.nombre}": "arriba" es paralelo a la mirada — la vista no está definida`);
  v = [v[0] / lv, v[1] / lv, v[2] / lv];
  const u = cross3(v, w);          // u = v × w  ⇒  det(u,v,w) = +1
  return { u, v, w };
}

/** Signo de la pantalla: −1 si +Y va hacia abajo (SVG), +1 si va hacia arriba. */
const sgnY = (cam: CamaraOrto) => (cam.yAbajo === false ? 1 : -1);

/** Proyecta un punto del mundo a píxeles. */
export function proyectar(cam: CamaraOrto, p: P3, b?: BaseCamara): Pt2 {
  const { u, v } = b ?? baseCamara(cam);
  const m = cam.mira ?? [0, 0, 0];
  const dx = p[0] - m[0], dy = p[1] - m[1], dz = p[2] - m[2];
  const su = dx * u[0] + dy * u[1] + dz * u[2];
  const sv = dx * v[0] + dy * v[1] + dz * v[2];
  const kx = (cam.espejoX ? -1 : 1) * cam.k;
  const ky = cam.kY ?? cam.k;
  return [cam.cx + kx * su, cam.cy + sgnY(cam) * ky * sv];
}

/** Profundidad de un punto: crece ALEJÁNDOSE del ojo (igual que el z-buffer de visibilidad.ts). */
export function profundidad(cam: CamaraOrto, p: P3, b?: BaseCamara): number {
  const { w } = b ?? baseCamara(cam);
  const m = cam.mira ?? [0, 0, 0];
  return (p[0] - m[0]) * w[0] + (p[1] - m[1]) * w[1] + (p[2] - m[2]) * w[2];
}

/**
 * Ángulos esféricos (θ, φ) de la mirada. Son el parámetro de la FORMA CERRADA:
 * w = (sinθ cosφ, sinθ sinφ, cosθ). Con arriba=+Z y sinθ > 0 la base sale en trig
 * explícita — un camino de cálculo DISTINTO al Gram-Schmidt de `baseCamara`, que es
 * justo lo que hace que compararlos sea una verificación y no una tautología.
 */
export function angulosDeVista(cam: CamaraOrto): { theta: number; phi: number; sinT: number; cosT: number } {
  const w = norm3(cam.dir);
  const cosT = Math.max(-1, Math.min(1, w[2]));
  const theta = Math.acos(cosT);
  const sinT = Math.sin(theta);
  const phi = Math.atan2(w[1], w[0]);
  return { theta, phi, sinT, cosT };
}

/**
 * FORMA CERRADA de la base, en trigonometría explícita (arriba = +Z, sinθ > 0):
 *   u = (−sinφ,  cosφ, 0)
 *   v = (−cosθ cosφ, −cosθ sinφ, sinθ)
 *   w = ( sinθ cosφ,  sinθ sinφ, cosθ)
 * Sale de v ∝ ẑ − (ẑ·w)w = −sinθ·ê_θ y de u = v × w = ê_φ.
 */
export function baseCerrada(cam: CamaraOrto): BaseCamara {
  const { phi, sinT, cosT } = angulosDeVista(cam);
  if (sinT < 1e-9) throw new Error(`forma cerrada no aplica: la mirada es paralela a +Z (sinθ=${sinT.toExponential(2)})`);
  const cp = Math.cos(phi), sp = Math.sin(phi);
  return {
    u: [-sp, cp, 0],
    v: [-cosT * cp, -cosT * sp, sinT],
    w: [sinT * cp, sinT * sp, cosT],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 · GEOMETRÍA 2D DE APOYO (área firmada, casco convexo, ajuste en O(2))
// ─────────────────────────────────────────────────────────────────────────────

/** Área FIRMADA del triángulo (a,b,c) en las coordenadas que se le den. El SIGNO es
 *  la mano de la imagen: es el único observable 2D que delata un espejo. */
export function areaFirmada(a: Pt2, b: Pt2, c: Pt2): number {
  return 0.5 * ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
}

/** Casco convexo (monotone chain). Devuelve el polígono en orden. */
export function cascoConvexo(pts: Pt2[]): Pt2[] {
  const P = pts.slice().sort((p, q) => (p[0] - q[0]) || (p[1] - q[1]));
  if (P.length < 3) return P;
  const cruz = (o: Pt2, a: Pt2, b: Pt2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt2[] = [];
  for (const p of P) { while (lo.length >= 2 && cruz(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const hi: Pt2[] = [];
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length >= 2 && cruz(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  lo.pop(); hi.pop();
  return lo.concat(hi);
}

/** Área (positiva) de un polígono por el teorema del zapato. */
export function areaPoligono(poly: Pt2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/**
 * Mejor alineación en O(2) de `a` sobre `b` (mismo número de vectores).
 * Devuelve el residuo con la mejor ROTACIÓN (det +1) y con la mejor REFLEXIÓN (det −1).
 *
 * PARA QUÉ: separa "los ejes 3D están mal" de "la imagen es el espejo de la correcta".
 * Un espejo es un elemento de O(2): si el residuo de reflexión es ~0, la medida es
 * EXACTAMENTE la imagen correcta espejeada, y el defecto es de MANO, no de ejes.
 * Si ninguno de los dos baja a ~0, los ejes 3D en sí están equivocados.
 */
export function ajusteO2(a: Pt2[], b: Pt2[]): { resRot: number; resRefl: number; angRot: number } {
  const res = (src: Pt2[]) => {
    let sc = 0, sd = 0;
    for (let i = 0; i < src.length; i++) {
      sc += src[i][0] * b[i][1] - src[i][1] * b[i][0];
      sd += src[i][0] * b[i][0] + src[i][1] * b[i][1];
    }
    const ang = Math.atan2(sc, sd);
    const co = Math.cos(ang), si = Math.sin(ang);
    let peor = 0;
    for (let i = 0; i < src.length; i++) {
      const x = co * src[i][0] - si * src[i][1], y = si * src[i][0] + co * src[i][1];
      peor = Math.max(peor, Math.hypot(x - b[i][0], y - b[i][1]));
    }
    return { peor, ang };
  };
  const r = res(a);
  const f = res(a.map((p) => [p[0], -p[1]] as Pt2));   // reflexión ∘ rotación = reflexión
  return { resRot: r.peor, resRefl: f.peor, angRot: r.ang };
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 · EL FIDUCIAL — objeto de calibración con proyección en FORMA CERRADA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EL FIDUCIAL. Tres piezas, cada una con UN trabajo distinto — esa separación es lo
 * que permite decir CUÁL de los tres defectos hay, en vez de solo "algo está mal":
 *
 *   · ESFERA de radio R  → su silueta ortográfica es un CÍRCULO de radio k·R,
 *     idéntico se mire de donde se mire. Aísla la ESCALA de la orientación.
 *     Y si sale ELIPSE, el render es anisótropo (px no cuadrados).
 *   · CUBO de lado a     → el área de su silueta es a²k²(|wx|+|wy|+|wz|). Mezcla
 *     escala y orientación: confirma que la dirección de vista es la declarada.
 *   · TRIADA de lado L   → las tres puntas dan las DIRECCIONES de cada eje y, por su
 *     área firmada, la MANO. Es la única pieza QUIRAL, y por eso la única que puede
 *     cazar un espejo.
 */
export interface Fiducial {
  /** origen del fiducial en el mundo (dónde se ancla en la escena) */
  origen: P3;
  /** longitud de los brazos de la triada (mm) */
  L: number;
  /** lado del cubo (mm) — arranca en `origen` y crece hacia +X+Y+Z */
  a: number;
  /** radio de la esfera (mm) — centrada en `origen` */
  R: number;
}

/** Fiducial por defecto: proporciones elegidas para que las tres piezas se lean sin
 *  taparse (cubo a=0.50L; esfera R=0.34L, que no llega a la esquina del cubo 0.87L). */
export function fiducialPorDefecto(L = 40, origen: P3 = [0, 0, 0]): Fiducial {
  return { origen, L, a: 0.50 * L, R: 0.34 * L };
}

/** Los 8 vértices del cubo, en orden canónico por bits (b0→X, b1→Y, b2→Z). */
export function verticesCubo(f: Fiducial): P3[] {
  const o = f.origen, a = f.a;
  const V: P3[] = [];
  for (let i = 0; i < 8; i++) V.push([o[0] + (i & 1 ? a : 0), o[1] + (i & 2 ? a : 0), o[2] + (i & 4 ? a : 0)]);
  return V;
}

/** Las 12 aristas del cubo, como pares de índices del orden canónico. */
export const ARISTAS_CUBO: Array<[number, number]> = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** Las tres puntas de la triada, en orden X, Y, Z. */
export function puntasTriada(f: Fiducial): [P3, P3, P3] {
  const o = f.origen, L = f.L;
  return [[o[0] + L, o[1], o[2]], [o[0], o[1] + L, o[2]], [o[0], o[1], o[2] + L]];
}

/** La proyección MEDIDA del fiducial: lo que la imagen realmente trae, más lo que la
 *  imagen DECLARA (la cámara y el fiducial que dice estar dibujando). */
export interface ProyeccionFiducial {
  /** lo que se DECLARA haber dibujado */
  fiducial: Fiducial;
  /** la cámara que se DECLARA haber usado */
  camara: CamaraOrto;
  origen: Pt2;
  /** puntas de la triada en px, en orden X, Y, Z */
  puntas: [Pt2, Pt2, Pt2];
  /** 8 vértices del cubo en px, orden canónico */
  cubo: Pt2[];
  /** muestras de la silueta de la esfera en px (círculo máximo ⊥ a la mirada) */
  esfera: Pt2[];
}

/**
 * Proyecta el fiducial. `camReal` es la cámara con la que el render REALMENTE dibuja;
 * `o.declarar` es la que la lámina dice haber usado (por defecto la misma). `o.mapa`
 * deforma el MODELO antes de proyectar (así se fabrican las corrupciones de modelo:
 * ejes intercambiados, espejo de geometría).
 */
export function proyectarFiducial(
  f: Fiducial, camReal: CamaraOrto,
  o?: { mapa?: (p: P3) => P3; declarar?: CamaraOrto; nSilueta?: number },
): ProyeccionFiducial {
  const M = o?.mapa ?? ((p: P3) => p);
  const b = baseCamara(camReal);
  const pr = (p: P3) => proyectar(camReal, M(p), b);
  const [pxT, pyT, pzT] = puntasTriada(f);
  // la silueta de una esfera bajo cámara ortográfica es su círculo máximo ⊥ a la
  // mirada: c + R(cos t · u + sin t · v). Como todos los mapas de corrupción que
  // usamos son ortogonales, la esfera mapeada sigue siendo esfera del mismo radio.
  const c = M(f.origen);
  const n = o?.nSilueta ?? 180;
  const sil: Pt2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI, ct = Math.cos(t), st = Math.sin(t);
    sil.push(proyectar(camReal, [
      c[0] + f.R * (ct * b.u[0] + st * b.v[0]),
      c[1] + f.R * (ct * b.u[1] + st * b.v[1]),
      c[2] + f.R * (ct * b.u[2] + st * b.v[2]),
    ], b));
  }
  return {
    fiducial: f, camara: o?.declarar ?? camReal,
    origen: pr(f.origen),
    puntas: [pr(pxT), pr(pyT), pr(pzT)],
    cubo: verticesCubo(f).map(pr),
    esfera: sil,
  };
}

/**
 * FORMA CERRADA de la proyección del fiducial: trigonometría explícita, sin pasar por
 * `baseCamara`. Este es el patrón de referencia contra el que se mide.
 *
 *   punta X → (−kL sinφ,      +σ kL cosθ cosφ)   relativa al origen proyectado
 *   punta Y → (+kL cosφ,      +σ kL cosθ sinφ)
 *   punta Z → ( 0,            −σ kL sinθ)                 (σ = +1 si +Y va hacia abajo)
 *   radio de la esfera        = kR                        (independiente de la vista)
 *   área de la silueta del cubo = a²k²(|wx|+|wy|+|wz|)
 *   área firmada de la triada = +σ k²L²(wx+wy+wz)/2       ← el observable de la MANO
 */
export interface FormaCerradaFiducial {
  origen: Pt2;
  puntas: [Pt2, Pt2, Pt2];
  cubo: Pt2[];
  /** radio del círculo de la esfera, px */
  rEsfera: number;
  /** área de la silueta del cubo, px² */
  areaCubo: number;
  /** área FIRMADA de la triada, px² — su signo es la mano esperada */
  areaTriada: number;
  /** |w·(1,1,1)| ∈ [0, √3]: cuánto discrimina ESTA vista la mano. 0 = nada. */
  poderMano: number;
  /** longitud proyectada de cada brazo, px: kL·√(1−w_i²) */
  largoEje: [number, number, number];
}

export function formaCerradaFiducial(f: Fiducial, cam: CamaraOrto): FormaCerradaFiducial {
  const { phi, sinT, cosT } = angulosDeVista(cam);
  if (sinT < 1e-9) throw new Error('forma cerrada no aplica: mirada paralela a +Z');
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const k = cam.k, L = f.L, a = f.a, s = sgnY(cam);
  const w: P3 = [sinT * cp, sinT * sp, cosT];
  const o = proyectar(cam, f.origen);
  const rel = (dx: number, dy: number): Pt2 => [o[0] + dx, o[1] + dy];
  const puntas: [Pt2, Pt2, Pt2] = [
    rel(-k * L * sp, -s * k * L * cosT * cp),
    rel(k * L * cp, -s * k * L * cosT * sp),
    rel(0, s * k * L * sinT),
  ];
  // el cubo, por combinación lineal de los mismos tres vectores unitarios de eje
  const eX: Pt2 = [-k * a * sp, -s * k * a * cosT * cp];
  const eY: Pt2 = [k * a * cp, -s * k * a * cosT * sp];
  const eZ: Pt2 = [0, s * k * a * sinT];
  const cubo: Pt2[] = [];
  for (let i = 0; i < 8; i++) {
    const bx = i & 1 ? 1 : 0, by = i & 2 ? 1 : 0, bz = i & 4 ? 1 : 0;
    cubo.push([o[0] + bx * eX[0] + by * eY[0] + bz * eZ[0], o[1] + bx * eX[1] + by * eY[1] + bz * eZ[1]]);
  }
  const sumW = w[0] + w[1] + w[2];
  return {
    origen: o, puntas, cubo,
    rEsfera: k * f.R,
    areaCubo: a * a * k * k * (Math.abs(w[0]) + Math.abs(w[1]) + Math.abs(w[2])),
    // DERIVACIÓN (se equivocó una vez, queda escrita): en el plano (su,sv) el área
    // firmada del triángulo de puntas vale (u×v)·(1,1,1)/2 = det(M)·(w·(1,1,1))/2, y
    // det(M)=+1 por construcción de `baseCamara`. El paso a píxeles es diag(k, σk),
    // cuyo determinante es σk² — NO −k². Por eso el factor es +σ y no −σ.
    // Comprobado a mano con la isométrica (−1,−1,−1): σ=−1, Σw=−√3 → +0.866 k²L².
    areaTriada: s * k * k * L * L * sumW / 2,
    poderMano: Math.abs(sumW),
    largoEje: [
      k * L * Math.sqrt(Math.max(0, 1 - w[0] * w[0])),
      k * L * Math.sqrt(Math.max(0, 1 - w[1] * w[1])),
      k * L * Math.sqrt(Math.max(0, 1 - w[2] * w[2])),
    ],
  };
}

/**
 * UMBRAL DE PODER DE MANO — EXTENSIÓN DECLARADA (nadie me la dio, la razono aquí).
 * |w·(1,1,1)| es exactamente 2·|área firmada| / (k²L²). Cuando vale 0 las tres puntas
 * de la triada son COLINEALES en la imagen y el espejo es literalmente el mismo
 * dibujo: NINGÚN método puede cazarlo desde esa vista. Pongo el corte en 0.10 porque
 * abajo de ahí el área firmada del triángulo cae por debajo del 6 % de su máximo
 * (√3/2) y el signo se lo come cualquier ruido de medición sub-píxel.
 * Si el poder queda bajo el umbral, `manoOK` NO se afirma: se DECLARA no medible.
 */
export const UMBRAL_PODER_MANO = 0.10;

/** Tolerancias por defecto del fiducial. En ortográfica la forma cerrada es EXACTA,
 *  así que 1e-9 px es holgado (lo medido cae en ~1e-13). Estas tolerancias NO se
 *  aflojan para que algo pase: si un check falla, se diagnostica. */
export const TOL_FIDUCIAL_PX = 1e-9;
export const TOL_FIDUCIAL_REL = 1e-9;

export type DiagnosticoFiducial =
  | 'OK' | 'NO-ORTOGRAFICA' | 'ESCALA' | 'EJES' | 'EJES+MANO' | 'MANO' | 'ENCUADRE' | 'MANO-NO-MEDIBLE';

export interface VeredictoFiducial {
  escalaOK: boolean;
  ejesOK: boolean;
  manoOK: boolean;
  /** máximo |medido − forma cerrada| en px, SIN permitir ninguna alineación */
  residuoPx: number;
  diagnostico: DiagnosticoFiducial;
  /** escala medida por la esfera (px/mm) — aislada de la orientación */
  kEsfera: number;
  /** escala medida por la triada, vía AAᵀ = k²I (px/mm) */
  kTriada: number;
  kDeclarada: number;
  /** defecto de ortogonalidad de la proyección: ‖AAᵀ/k² − I‖∞. >0 ⇒ no es ortográfica */
  defectoOrto: number;
  /** rMax/rMin de la silueta de la esfera. >1 ⇒ píxeles no cuadrados / render anisótropo */
  ovaloEsfera: number;
  manoMedida: -1 | 0 | 1;
  manoEsperada: -1 | 0 | 1;
  poderMano: number;
  manoMedible: boolean;
  areaTriadaMedida: number;
  areaTriadaCerrada: number;
  areaCuboMedida: number;
  areaCuboCerrada: number;
  /** residuo de los ejes tras permitir la mejor ROTACIÓN de imagen (px) */
  resRotPx: number;
  /** residuo de los ejes tras permitir la mejor REFLEXIÓN de imagen (px) */
  resReflPx: number;
  /** error por eje, en px, contra la forma cerrada */
  ejes: Array<{ eje: 'X' | 'Y' | 'Z'; medido: Pt2; cerrado: Pt2; errPx: number; largoMedido: number; largoCerrado: number }>;
  porque: string[];
}

/**
 * VERIFICAR EL FIDUCIAL. Compara la proyección MEDIDA contra la FORMA CERRADA de la
 * cámara DECLARADA y separa el defecto en tres cajas independientes:
 *
 *   escalaOK → la esfera (aislada de la orientación) y la triada (AAᵀ=k²I) dan la k
 *              declarada. Una escala 2× cae aquí y SOLO aquí.
 *   ejesOK   → las direcciones 3D de los ejes son las declaradas, permitiendo la mejor
 *              rotación/reflexión de imagen. Un intercambio de ejes cae aquí.
 *   manoOK   → el SIGNO del área firmada de la triada. Un espejo cae aquí y SOLO aquí,
 *              porque un espejo es un elemento de O(2): deja los ejes "alineables".
 *
 * `residuoPx` es el número maestro: si vale ~0, TODO está bien (escala, ejes, mano,
 * encuadre y roll). Los tres booleanos existen para decir CUÁL falló.
 */
export function verificarFiducial(
  proy: ProyeccionFiducial,
  o?: { tolPx?: number; tolRel?: number },
): VeredictoFiducial {
  const tolPx = o?.tolPx ?? TOL_FIDUCIAL_PX;
  const tolRel = o?.tolRel ?? TOL_FIDUCIAL_REL;
  const f = proy.fiducial, cam = proy.camara;
  const C = formaCerradaFiducial(f, cam);
  const porque: string[] = [];

  // — ESCALA por la ESFERA: su silueta es un círculo de radio kR se mire de donde se mire
  let cxE = 0, cyE = 0;
  for (const p of proy.esfera) { cxE += p[0]; cyE += p[1]; }
  cxE /= proy.esfera.length; cyE /= proy.esfera.length;
  let rSum = 0, rMin = Infinity, rMax = 0;
  for (const p of proy.esfera) {
    const r = Math.hypot(p[0] - cxE, p[1] - cyE);
    rSum += r; if (r < rMin) rMin = r; if (r > rMax) rMax = r;
  }
  const rEsf = rSum / proy.esfera.length;
  const kEsfera = rEsf / f.R;
  const ovalo = rMin > 1e-12 ? rMax / rMin : Infinity;

  // — ESCALA y ORTOGONALIDAD por la TRIADA: A = [pX pY pZ]/L es k·(dos filas de una
  //   matriz ortonormal), así que AAᵀ = k²I₂. Es la firma de "esto ES una proyección
  //   ortográfica"; si AAᵀ no es múltiplo de la identidad, ni siquiera vale preguntar
  //   por escala o ejes.
  const rel = proy.puntas.map((p) => [p[0] - proy.origen[0], p[1] - proy.origen[1]] as Pt2);
  const A = rel.map((p) => [p[0] / f.L, p[1] / f.L] as Pt2);
  const g11 = A[0][0] ** 2 + A[1][0] ** 2 + A[2][0] ** 2;
  const g22 = A[0][1] ** 2 + A[1][1] ** 2 + A[2][1] ** 2;
  const g12 = A[0][0] * A[0][1] + A[1][0] * A[1][1] + A[2][0] * A[2][1];
  const kTriada = Math.sqrt(Math.max(0, (g11 + g22) / 2));
  const k2 = kTriada * kTriada || 1;
  const defectoOrto = Math.max(Math.abs(g11 / k2 - 1), Math.abs(g22 / k2 - 1), Math.abs(g12 / k2));

  const errEscEsf = Math.abs(kEsfera / cam.k - 1);
  const errEscTri = Math.abs(kTriada / cam.k - 1);
  const escalaOK = errEscEsf < tolRel && errEscTri < tolRel;
  if (!escalaOK) porque.push(`escala medida ${kEsfera.toFixed(6)} px/mm (esfera) y ${kTriada.toFixed(6)} px/mm (triada) contra ${cam.k} declarada → factor ${(kEsfera / cam.k).toFixed(4)}×`);
  if (ovalo > 1 + 1e-6) porque.push(`la silueta de la esfera es una ELIPSE (rMax/rMin = ${ovalo.toFixed(4)}): el render no tiene píxeles cuadrados`);

  // — MANO por el ÁREA FIRMADA de la triada
  const areaMed = areaFirmada(proy.puntas[0], proy.puntas[1], proy.puntas[2]);
  const manoMedida = (Math.abs(areaMed) < 1e-12 ? 0 : Math.sign(areaMed)) as -1 | 0 | 1;
  const manoEsperada = (Math.abs(C.areaTriada) < 1e-12 ? 0 : Math.sign(C.areaTriada)) as -1 | 0 | 1;
  const manoMedible = C.poderMano >= UMBRAL_PODER_MANO;
  const manoOK = manoMedible ? manoMedida === manoEsperada : false;
  if (!manoMedible) porque.push(`MANO NO MEDIBLE desde esta vista: |w·(1,1,1)| = ${C.poderMano.toFixed(4)} < ${UMBRAL_PODER_MANO} — las tres puntas salen casi colineales y el espejo da el MISMO dibujo. No se afirma manoOK: se declara no medida.`);
  else if (!manoOK) porque.push(`MANO INVERTIDA: área firmada de la triada ${areaMed.toFixed(2)} px² contra ${C.areaTriada.toFixed(2)} px² de la forma cerrada — la imagen es el espejo de la declarada`);

  // — EJES: direcciones 3D correctas, permitiendo la mejor alineación en O(2)
  const relC = C.puntas.map((p) => [p[0] - C.origen[0], p[1] - C.origen[1]] as Pt2);
  const kMed = kEsfera > 1e-12 ? kEsfera : (kTriada || 1);
  const aN = rel.map((p) => [p[0] / kMed, p[1] / kMed] as Pt2);      // normalizados a mm
  const bN = relC.map((p) => [p[0] / cam.k, p[1] / cam.k] as Pt2);
  const fit = ajusteO2(aN, bN);
  const resRotPx = fit.resRot * cam.k;
  const resReflPx = fit.resRefl * cam.k;
  const ejesOK = Math.min(resRotPx, resReflPx) < tolPx;
  if (!ejesOK) porque.push(`EJES EQUIVOCADOS: ni rotando (${resRotPx.toFixed(3)} px) ni reflejando (${resReflPx.toFixed(3)} px) la imagen medida se llega a la declarada — las direcciones 3D no son las que dice`);

  const ejes = (['X', 'Y', 'Z'] as const).map((e, i) => ({
    eje: e, medido: proy.puntas[i], cerrado: C.puntas[i],
    errPx: Math.hypot(proy.puntas[i][0] - C.puntas[i][0], proy.puntas[i][1] - C.puntas[i][1]),
    largoMedido: Math.hypot(rel[i][0], rel[i][1]),
    largoCerrado: C.largoEje[i],
  }));

  // — RESIDUO MAESTRO: sin alineaciones, sin excusas
  let residuoPx = Math.hypot(proy.origen[0] - C.origen[0], proy.origen[1] - C.origen[1]);
  for (const e of ejes) residuoPx = Math.max(residuoPx, e.errPx);
  for (let i = 0; i < 8; i++) residuoPx = Math.max(residuoPx, Math.hypot(proy.cubo[i][0] - C.cubo[i][0], proy.cubo[i][1] - C.cubo[i][1]));
  residuoPx = Math.max(residuoPx, Math.abs(rEsf - C.rEsfera), Math.hypot(cxE - C.origen[0], cyE - C.origen[1]));

  const areaCuboMed = areaPoligono(cascoConvexo(proy.cubo));

  // — DIAGNÓSTICO, en orden de precedencia. Cada corrupción tiene UNA firma:
  //   2× escala   → defectoOrto 0, escala mal, ejes alineables, mano bien  → ESCALA
  //   espejo      → defectoOrto 0, escala bien, resRefl ≈ 0, mano al revés → MANO
  //   ejes X↔Y    → defectoOrto 0, escala bien, resRot y resRefl > 0       → EJES
  //   roll/encuadre → todo bien salvo el residuo crudo                     → ENCUADRE
  let diagnostico: DiagnosticoFiducial;
  if (defectoOrto > 1e-6) { diagnostico = 'NO-ORTOGRAFICA'; porque.unshift(`la proyección no cumple AAᵀ=k²I (defecto ${defectoOrto.toExponential(2)}): no es una cámara ortográfica válida`); }
  else if (!escalaOK) diagnostico = 'ESCALA';
  // Un mapa 3D IMPAR (espejo del modelo, o intercambiar dos ejes) rompe LOS DOS
  // canales a la vez, y eso no es un defecto del arnés: es un hecho geométrico —
  // toda reflexión es una transposición compuesta con un giro, así que no hay forma
  // de separarlas. Se reporta EJES+MANO en vez de elegir una y callar la otra.
  else if (!ejesOK) diagnostico = (manoMedible && !manoOK) ? 'EJES+MANO' : 'EJES';
  else if (manoMedible && !manoOK) diagnostico = 'MANO';
  else if (residuoPx > tolPx) { diagnostico = 'ENCUADRE'; porque.push(`escala y ejes correctos pero el residuo crudo es ${residuoPx.toFixed(3)} px: la imagen está rotada o corrida respecto a la declarada (roll, encuadre — o un espejo que ESTA vista no puede atribuir a la mano)`); }
  // MANO-NO-MEDIBLE va AL FINAL a propósito: significa "todo lo medible cuadró, pero
  // esta vista NO puede certificar la mano". Nunca debe tapar un residuo real.
  else if (!manoMedible) diagnostico = 'MANO-NO-MEDIBLE';
  else diagnostico = 'OK';

  if ((diagnostico === 'MANO' || diagnostico === 'EJES+MANO') && resReflPx < tolPx) porque.push('el residuo de REFLEXIÓN es cero: la imagen medida es EXACTAMENTE la correcta espejeada (puede ser espejo de cámara o una permutación IMPAR de ejes que esta vista no separa)');

  return {
    escalaOK, ejesOK, manoOK, residuoPx, diagnostico,
    kEsfera, kTriada, kDeclarada: cam.k, defectoOrto, ovaloEsfera: ovalo,
    manoMedida, manoEsperada, poderMano: C.poderMano, manoMedible,
    areaTriadaMedida: areaMed, areaTriadaCerrada: C.areaTriada,
    areaCuboMedida: areaCuboMed, areaCuboCerrada: C.areaCubo,
    resRotPx, resReflPx, ejes, porque,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §3 · CONSISTENCIA MULTI-VISTA — triangular lo que la cabeza no fusiona
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TRIANGULACIÓN ORTOGRÁFICA. Cada vista aporta DOS ecuaciones lineales exactas:
 *     k (u·p) = x − cx          k (v·p) = σ (cy − y)
 * así que dos vistas no paralelas ya sobre-determinan el punto (4 ecuaciones, 3
 * incógnitas) y la solución es EXACTA — no hay iteración ni linealización, el residuo
 * esperado es cero-máquina.
 *
 * ⚠ LO QUE HAY QUE SABER DE LA ORTOGRÁFICA, y que es justo el gotcha del arnés:
 * la PROFUNDIDAD NO ENTRA EN LA IMAGEN. Invertirla no es un cambio invisible: es
 * mirar desde el otro lado, w → −w. Como u = v × w también voltea, la imagen sale
 * ESPEJADA. Por eso una vista con la profundidad al revés SÍ revienta el residuo:
 * no por la z, sino por el espejo que la z arrastra.
 *
 * `condicion` es la razón entre el eigenvalor mayor y el menor de la matriz normal.
 * Si el menor es ~0, el juego de vistas NO determina el punto en alguna dirección
 * (p. ej. dos vistas paralelas): se reporta `determinado:false` y la dirección libre.
 * Un punto no determinado NO cuenta como verificado.
 */
export interface ResultadoTriangulacion {
  punto3D: P3;
  /** máximo error de reproyección, en px, sobre todas las vistas */
  residuoPx: number;
  /** residuo por vista */
  porVista: Array<{ vista: string; medido: Pt2; reproyectado: Pt2; errPx: number }>;
  determinado: boolean;
  condicion: number;
  /** dirección 3D peor determinada (el eigenvector del menor eigenvalor) */
  direccionLibre: P3;
  nEcuaciones: number;
}

/** Eigen de una simétrica 3×3 por rotaciones de Jacobi. Devuelve λ ordenados desc. */
function eigenSim3(Min: number[][]): { val: number[]; vec: P3[] } {
  const A = Min.map((r) => r.slice());
  let V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 24; sweep++) {
    let off = 0;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) off += A[i][j] * A[i][j];
    if (off < 1e-30) break;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      const R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      R[p][p] = c; R[q][q] = c; R[p][q] = s; R[q][p] = -s;
      const B = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], W = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        let sA = 0, sV = 0;
        for (let m = 0; m < 3; m++) { sA += R[m][i] * A[m][j]; sV += V[i][m] * R[m][j]; }
        B[i][j] = sA; W[i][j] = sV;
      }
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        let s2 = 0; for (let m = 0; m < 3; m++) s2 += B[i][m] * R[m][j];
        A[i][j] = s2;
      }
      V = W;
    }
  }
  const idx = [0, 1, 2].sort((a, b) => A[b][b] - A[a][a]);
  return { val: idx.map((i) => A[i][i]), vec: idx.map((i) => [V[0][i], V[1][i], V[2][i]] as P3) };
}

export function triangular(
  vistas: CamaraOrto[], puntos2D: Pt2[],
  o?: { umbralCondicion?: number },
): ResultadoTriangulacion {
  if (vistas.length !== puntos2D.length) throw new Error(`triangular: ${vistas.length} vistas contra ${puntos2D.length} puntos 2D`);
  if (vistas.length < 2) throw new Error('triangular: hacen falta al menos 2 vistas');
  const filas: Array<{ a: P3; c: number }> = [];
  for (let i = 0; i < vistas.length; i++) {
    const cam = vistas[i], b = baseCamara(cam), m = cam.mira ?? [0, 0, 0];
    const kx = (cam.espejoX ? -1 : 1) * cam.k, ky = cam.kY ?? cam.k, s = sgnY(cam);
    filas.push({ a: [kx * b.u[0], kx * b.u[1], kx * b.u[2]], c: puntos2D[i][0] - cam.cx + kx * dot3(m as P3, b.u) });
    filas.push({ a: [s * ky * b.v[0], s * ky * b.v[1], s * ky * b.v[2]], c: puntos2D[i][1] - cam.cy + s * ky * dot3(m as P3, b.v) });
  }
  const N = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const rhs = [0, 0, 0];
  for (const f of filas) {
    for (let i = 0; i < 3; i++) { rhs[i] += f.a[i] * f.c; for (let j = 0; j < 3; j++) N[i][j] += f.a[i] * f.a[j]; }
  }
  const { val, vec } = eigenSim3(N);
  const umbral = (o?.umbralCondicion ?? 1e10);
  const condicion = val[2] > 0 ? val[0] / val[2] : Infinity;
  const determinado = condicion < umbral && Number.isFinite(condicion);
  // pseudo-inversa por la descomposición espectral: se ignoran las direcciones que
  // el juego de vistas no determina, en vez de fingir un número inventado ahí.
  const corte = val[0] * 1e-12;
  const p: P3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (val[i] <= corte) continue;
    const q = vec[i], d = (q[0] * rhs[0] + q[1] * rhs[1] + q[2] * rhs[2]) / val[i];
    p[0] += d * q[0]; p[1] += d * q[1]; p[2] += d * q[2];
  }
  const porVista = vistas.map((cam, i) => {
    const rp = proyectar(cam, p);
    return { vista: cam.nombre, medido: puntos2D[i], reproyectado: rp, errPx: Math.hypot(rp[0] - puntos2D[i][0], rp[1] - puntos2D[i][1]) };
  });
  return {
    punto3D: p, residuoPx: Math.max(...porVista.map((v) => v.errPx)), porVista,
    determinado, condicion, direccionLibre: vec[2], nEcuaciones: filas.length,
  };
}

/** Triangula el MISMO punto desde TODOS los pares de vistas y reporta la dispersión.
 *  Un par que se sale del resto delata la vista mentirosa (no solo "algo falla"). */
export function triangularPorPares(vistas: CamaraOrto[], puntos2D: Pt2[]): {
  pares: Array<{ i: number; j: number; nombres: string; punto3D: P3; residuoPx: number; determinado: boolean }>;
  dispersionMm: number;
  peorPar: string;
} {
  const pares: Array<{ i: number; j: number; nombres: string; punto3D: P3; residuoPx: number; determinado: boolean }> = [];
  for (let i = 0; i < vistas.length; i++) for (let j = i + 1; j < vistas.length; j++) {
    const r = triangular([vistas[i], vistas[j]], [puntos2D[i], puntos2D[j]]);
    pares.push({ i, j, nombres: `${vistas[i].nombre}+${vistas[j].nombre}`, punto3D: r.punto3D, residuoPx: r.residuoPx, determinado: r.determinado });
  }
  const buenos = pares.filter((p) => p.determinado);
  let disp = 0, peor = '—';
  for (const a of buenos) for (const b of buenos) {
    const d = Math.hypot(a.punto3D[0] - b.punto3D[0], a.punto3D[1] - b.punto3D[1], a.punto3D[2] - b.punto3D[2]);
    if (d > disp) { disp = d; peor = `${a.nombres} vs ${b.nombres}`; }
  }
  return { pares, dispersionMm: disp, peorPar: peor };
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 · TEST DIFERENCIAL — la DERIVADA de la imagen contra un delta 3D conocido
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La idea, que ya funciona en el molde: abrir el molde 40 mm CORRE LA BBOX EXACTAMENTE
 * 40 mm (× la escala). El cuadro estático se puede ver bien con un eje cambiado, con
 * un signo cambiado o con la escala mal; la DERIVADA no.
 *
 * Se predicen tres respuestas, y dos de ellas NI SIQUIERA MIRAN LA CÁMARA — son
 * invariantes puros de la proyección ortográfica, así que no pueden "coincidir por
 * casualidad" con el mismo error del pipeline que están juzgando:
 *   · escala uniforme s alrededor de c → el ÁREA de la imagen se multiplica por s²
 *     y toda distancia en px por s. Sin importar la vista.
 *   · rotación de ángulo α ALREDEDOR DEL EJE DE VISTA → la imagen rota α y conserva
 *     todas las longitudes.
 *   · traslación t → todo punto se corre (k t·u, −σ k t·v). Uniforme: el corrimiento
 *     de la bbox tiene que ser IDÉNTICO al de cada ancla.
 */
export type Transformacion = (p: P3) => P3;

export interface DeltaConocido {
  tipo: 'traslacion' | 'rotacion' | 'escala';
  nombre?: string;
  /** traslación en mm (mundo) */
  t?: P3;
  /** rotación: eje unitario, ángulo en rad, centro (por defecto el origen) */
  eje?: P3; ang?: number; centro?: P3;
  /** escala uniforme alrededor de `centro` */
  s?: number;
}

/** Construye la transformación 3D del delta. Rodrigues explícito. */
export function transformacionDe(d: DeltaConocido): Transformacion {
  const c: P3 = d.centro ?? [0, 0, 0];
  if (d.tipo === 'traslacion') {
    const t = d.t ?? [0, 0, 0];
    return (p) => [p[0] + t[0], p[1] + t[1], p[2] + t[2]];
  }
  if (d.tipo === 'escala') {
    const s = d.s ?? 1;
    return (p) => [c[0] + s * (p[0] - c[0]), c[1] + s * (p[1] - c[1]), c[2] + s * (p[2] - c[2])];
  }
  const e = norm3(d.eje ?? [0, 0, 1]), a = d.ang ?? 0;
  const ca = Math.cos(a), sa = Math.sin(a);
  return (p) => {
    const r: P3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    const cr = cross3(e, r), de = dot3(e, r);
    return [
      c[0] + r[0] * ca + cr[0] * sa + e[0] * de * (1 - ca),
      c[1] + r[1] * ca + cr[1] * sa + e[1] * de * (1 - ca),
      c[2] + r[2] * ca + cr[2] * sa + e[2] * de * (1 - ca),
    ];
  };
}

/** Lo que el render devuelve: las anclas proyectadas y su bbox en px. */
export interface MedidaRender {
  anclas: Pt2[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /** área de la silueta en px², si se midió (opcional) */
  areaPx2?: number;
}

export interface EscalarDiferencial { nombre: string; medido: number; esperado: number; err: number; unidad: string }

export interface ResultadoDiferencial {
  delta: DeltaConocido;
  respuestaMedida: Pt2[];
  respuestaEsperada: Pt2[];
  /** máximo |medido − esperado| en px sobre anclas y escalares homogeneizados */
  err: number;
  errAnclasPx: number;
  escalares: EscalarDiferencial[];
  bboxMedida: [number, number, number, number];
  bboxEsperada: [number, number, number, number];
  porque: string[];
}

/**
 * Corre el test diferencial: llama al render con la identidad y con el delta, y
 * compara la RESPUESTA de la imagen contra la predicción en forma cerrada.
 * `render` es la caja negra bajo juicio; `cam` y `anclas3D` son lo que se declara.
 */
export function testDiferencial(
  render: (T: Transformacion) => MedidaRender,
  delta: DeltaConocido,
  o: { camara: CamaraOrto; anclas3D: P3[] },
): ResultadoDiferencial {
  const cam = o.camara, b = baseCamara(cam), s = sgnY(cam);
  const T = transformacionDe(delta);
  const m0 = render((p) => p);
  const m1 = render(T);
  if (m0.anclas.length !== o.anclas3D.length || m1.anclas.length !== o.anclas3D.length)
    throw new Error(`testDiferencial: el render devolvió ${m0.anclas.length}/${m1.anclas.length} anclas para ${o.anclas3D.length} declaradas`);

  const medida: Pt2[] = m1.anclas.map((p, i) => [p[0] - m0.anclas[i][0], p[1] - m0.anclas[i][1]]);
  const esperada: Pt2[] = o.anclas3D.map((p) => {
    const q = T(p), a = proyectar(cam, p, b), c = proyectar(cam, q, b);
    return [c[0] - a[0], c[1] - a[1]];
  });
  let errAnclas = 0;
  for (let i = 0; i < medida.length; i++) errAnclas = Math.max(errAnclas, Math.hypot(medida[i][0] - esperada[i][0], medida[i][1] - esperada[i][1]));

  const bboxMed: [number, number, number, number] = [m1.bbox.x0 - m0.bbox.x0, m1.bbox.y0 - m0.bbox.y0, m1.bbox.x1 - m0.bbox.x1, m1.bbox.y1 - m0.bbox.y1];
  const escalares: EscalarDiferencial[] = [];
  const porque: string[] = [];
  let bboxEsp: [number, number, number, number] = [0, 0, 0, 0];

  if (delta.tipo === 'traslacion') {
    const t = delta.t ?? [0, 0, 0];
    // FORMA CERRADA, sin re-proyectar: el corrimiento es el mismo para TODO el cuadro
    const dx = (cam.espejoX ? -1 : 1) * cam.k * dot3(t as P3, b.u);
    const dy = s * (cam.kY ?? cam.k) * dot3(t as P3, b.v);
    bboxEsp = [dx, dy, dx, dy];
    escalares.push({ nombre: 'corrimiento de la bbox en X', medido: bboxMed[0], esperado: dx, err: Math.abs(bboxMed[0] - dx), unidad: 'px' });
    escalares.push({ nombre: 'corrimiento de la bbox en Y', medido: bboxMed[1], esperado: dy, err: Math.abs(bboxMed[1] - dy), unidad: 'px' });
    const anchoMed = (m1.bbox.x1 - m1.bbox.x0) - (m0.bbox.x1 - m0.bbox.x0);
    escalares.push({ nombre: 'cambio de ANCHO de la bbox (una traslación no lo cambia)', medido: anchoMed, esperado: 0, err: Math.abs(anchoMed), unidad: 'px' });
    porque.push(`traslación de |t| = ${Math.hypot(t[0], t[1], t[2]).toFixed(3)} mm → la imagen debe correrse (${dx.toFixed(4)}, ${dy.toFixed(4)}) px y nada más`);
  } else if (delta.tipo === 'escala') {
    const sc = delta.s ?? 1;
    if (m0.areaPx2 != null && m1.areaPx2 != null) {
      const razon = m1.areaPx2 / (m0.areaPx2 || 1);
      escalares.push({ nombre: 'razón de ÁREA de la silueta (invariante: s², sin cámara)', medido: razon, esperado: sc * sc, err: Math.abs(razon - sc * sc), unidad: '×' });
    }
    // longitud entre anclas: escala por s exactamente, sin importar la vista
    if (o.anclas3D.length >= 2) {
      const d0 = Math.hypot(m0.anclas[1][0] - m0.anclas[0][0], m0.anclas[1][1] - m0.anclas[0][1]);
      const d1 = Math.hypot(m1.anclas[1][0] - m1.anclas[0][0], m1.anclas[1][1] - m1.anclas[0][1]);
      escalares.push({ nombre: 'razón de distancia ancla0→ancla1 (invariante: s, sin cámara)', medido: d1 / (d0 || 1), esperado: sc, err: Math.abs(d1 / (d0 || 1) - sc), unidad: '×' });
    }
    bboxEsp = [esperada.length ? bboxMed[0] : 0, 0, 0, 0];  // la bbox no se predice aquí
    porque.push(`escala s = ${sc}: el ÁREA de la imagen debe ir por s² = ${(sc * sc).toFixed(4)} y toda longitud por s, con CUALQUIER cámara`);
  } else {
    const e = norm3(delta.eje ?? [0, 0, 1]), a = delta.ang ?? 0;
    const alineado = Math.abs(Math.abs(dot3(e, b.w)) - 1) < 1e-9;
    if (alineado && o.anclas3D.length >= 2) {
      // rotación sobre el eje de vista: la imagen rota el MISMO ángulo y conserva
      // longitudes. Invariante puro, sin depender de la cámara más que en el signo.
      const v0: Pt2 = [m0.anclas[1][0] - m0.anclas[0][0], m0.anclas[1][1] - m0.anclas[0][1]];
      const v1: Pt2 = [m1.anclas[1][0] - m1.anclas[0][0], m1.anclas[1][1] - m1.anclas[0][1]];
      const angMed = Math.atan2(v0[0] * v1[1] - v0[1] * v1[0], v0[0] * v1[0] + v0[1] * v1[1]);
      // signo: con +Y hacia abajo y w = +e, el giro en imagen se ve invertido
      // el giro DERECHO alrededor de w manda u → u cosα + v sinα (porque w×u = v),
      // o sea +α en el plano (su,sv). Al pasar a píxeles con +Y hacia abajo el ángulo
      // se ve con el signo cambiado: por eso el factor es σ y no −σ.
      const angEsp = s * Math.sign(dot3(e, b.w)) * a;
      const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
      escalares.push({ nombre: 'ángulo girado EN LA IMAGEN (invariante: ±α)', medido: angMed, esperado: wrap(angEsp), err: Math.abs(wrap(angMed - angEsp)), unidad: 'rad' });
      const l0 = Math.hypot(v0[0], v0[1]), l1 = Math.hypot(v1[0], v1[1]);
      escalares.push({ nombre: 'razón de longitud (una rotación NO cambia longitudes)', medido: l1 / (l0 || 1), esperado: 1, err: Math.abs(l1 / (l0 || 1) - 1), unidad: '×' });
      porque.push(`rotación de ${(a * 180 / Math.PI).toFixed(2)}° sobre el EJE DE VISTA: la imagen debe girar ese mismo ángulo y conservar toda longitud`);
    } else {
      porque.push(`rotación de ${(a * 180 / Math.PI).toFixed(2)}° sobre un eje que NO es el de vista: no hay invariante libre de cámara, se juzga ancla por ancla contra la predicción re-proyectada`);
    }
    bboxEsp = [0, 0, 0, 0];
  }

  const errEsc = escalares.length ? Math.max(...escalares.map((e) => e.err)) : 0;
  return {
    delta, respuestaMedida: medida, respuestaEsperada: esperada,
    err: Math.max(errAnclas, delta.tipo === 'traslacion' ? errEsc : 0),
    errAnclasPx: errAnclas, escalares, bboxMedida: bboxMed, bboxEsperada: bboxEsp, porque,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §5 · EL TEST DEL RENDER CORRUPTO — el mecanismo más importante
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LA REGLA: se fabrica A PROPÓSITO la versión MAL del render y se MIDE la distancia
 * contra la correcta. Si la distancia es ~0, **esa imagen no es evidencia**: la vista
 * no discrimina y el criterio tiene que ser numérico, no visual.
 *
 * Esto no es paranoia teórica. Un cuerpo de revolución (la taza del libro) es
 * IDÉNTICO a su espejo: cualquier lámina de la taza que se ofrezca como prueba de
 * "la mano está bien" vale exactamente cero, y el arnés lo tiene que decir en vez de
 * dejar pasar una imagen bonita.
 */

export type TipoCorrupcion =
  | 'espejo-imagen' | 'espejo-modelo' | 'escala-2x' | 'ejes-XY' | 'ejes-YZ'
  | 'ejes-ciclico' | 'profundidad' | 'roll' | 'anisotropo';

export interface Corrupcion {
  tipo: TipoCorrupcion;
  nombre: string;
  /** qué defecto real del pipeline imita */
  imita: string;
  /** deformación del MODELO antes de proyectar */
  mapa: Transformacion;
  /** deformación de la CÁMARA con la que se dibuja */
  camara: (c: CamaraOrto) => CamaraOrto;
}

const ID: Transformacion = (p) => p;

/** El catálogo de corrupciones. Cada una imita un bug que YA pasó en este repo. */
export function corrupciones(): Corrupcion[] {
  return [
    { tipo: 'espejo-imagen', nombre: 'espejo de imagen (u → −u)', imita: 'el renderer voltea el eje horizontal: la lámina sale espejeada y el cono "va al revés"', mapa: ID, camara: (c) => ({ ...c, espejoX: true }) },
    { tipo: 'espejo-modelo', nombre: 'espejo del modelo (x → −x)', imita: 'una matriz de escala con −1: la PIEZA queda enantiomérica, no solo el dibujo', mapa: (p) => [-p[0], p[1], p[2]], camara: (c) => c },
    { tipo: 'escala-2x', nombre: 'escala 2×', imita: 'mm confundidos con otra unidad, o el fit del encuadre aplicado dos veces', mapa: ID, camara: (c) => ({ ...c, k: c.k * 2 }) },
    { tipo: 'ejes-XY', nombre: 'ejes X↔Y intercambiados', imita: 'el clásico (y,x) en vez de (x,y) al armar posiciones', mapa: (p) => [p[1], p[0], p[2]], camara: (c) => c },
    { tipo: 'ejes-YZ', nombre: 'ejes Y↔Z intercambiados', imita: 'mezclar convención Z-arriba con Y-arriba entre CAD y three.js', mapa: (p) => [p[0], p[2], p[1]], camara: (c) => c },
    { tipo: 'ejes-ciclico', nombre: 'ejes rotados X→Y→Z→X', imita: 'una permutación PAR: no cambia la mano, así que el espejo NO la caza', mapa: (p) => [p[2], p[0], p[1]], camara: (c) => c },
    { tipo: 'profundidad', nombre: 'profundidad invertida (w → −w)', imita: 'el z-buffer al revés / mirar desde el otro lado creyendo que es el mismo lado', mapa: ID, camara: (c) => ({ ...c, dir: [-c.dir[0], -c.dir[1], -c.dir[2]] }) },
    { tipo: 'roll', nombre: 'roll de 12° en el "arriba"', imita: 'perder la referencia +Z-arriba al armar la lámina', mapa: ID, camara: (c) => ({ ...c, arriba: [Math.sin(12 * Math.PI / 180), 0, Math.cos(12 * Math.PI / 180)] }) },
    { tipo: 'anisotropo', nombre: 'render anisótropo (kY = 0.85·k)', imita: 'viewBox y width/height del SVG con relaciones distintas: píxeles no cuadrados', mapa: ID, camara: (c) => ({ ...c, kY: c.k * 0.85 }) },
  ];
}

/** Espeja una malla y ARREGLA EL BOBINADO. Sin voltear los índices, las normales
 *  quedan invertidas y el z-buffer ve el interior: la corrupción medida ya no sería
 *  el espejo sino una malla rota, y el número saldría inflado por la razón incorrecta. */
export function espejarMalla(
  mesh: { positions: ArrayLike<number>; indices: ArrayLike<number> }, eje: 0 | 1 | 2 = 0,
): { positions: Float32Array; indices: Uint32Array } {
  const P = new Float32Array(mesh.positions.length);
  for (let i = 0; i < mesh.positions.length; i++) P[i] = (i % 3 === eje ? -1 : 1) * mesh.positions[i];
  const I = new Uint32Array(mesh.indices.length);
  for (let t = 0; t + 2 < mesh.indices.length; t += 3) { I[t] = mesh.indices[t]; I[t + 1] = mesh.indices[t + 2]; I[t + 2] = mesh.indices[t + 1]; }
  return { positions: P, indices: I };
}

// — LA IMAGEN: rasterización de lo que `visibilidad.proyectarParaLamina` ya proyecta.
//   Se acepta estructuralmente para no acoplar tipos (y para no tocar visibilidad.ts).

export interface CarasProyectadas {
  /** `pts` = [x0,y0,x1,y1,x2,y2] en px · `z` = profundidad del centroide ·
   *  `zv` = profundidad POR VÉRTICE (opcional pero MUY recomendada, ver abajo) */
  caras: Array<{ pts: number[]; vis: number; z: number; zv?: [number, number, number] }>;
  ancho: number; alto: number;
}

export interface ImagenOrto {
  res: number; ancho: number; alto: number;
  /** 1 donde hay pieza */
  mask: Uint8Array;
  /** profundidad del frente (Infinity donde no hay pieza) */
  z: Float32Array;
  /** canal de "sombreado": la visibilidad por cara que trae la proyección */
  vis: Float32Array;
  zMin: number; zMax: number; nPix: number;
  /** true si alguna cara vino SIN profundidad por vértice (el z mide la teselación) */
  zConstante: boolean;
}

/**
 * Rasteriza las caras proyectadas en una imagen de `res × res` con z-buffer.
 *
 * ⚠ LA PROFUNDIDAD SE INTERPOLA POR VÉRTICE cuando la cara trae `zv`. Esto NO es un
 * detalle: con la profundidad CONSTANTE POR TRIÁNGULO (el z del centroide, que es lo
 * único que `proyectarParaLamina` expone) el canal de profundidad mide LA TESELACIÓN,
 * no la superficie. Medido: la taza y su espejo —el MISMO sólido— salían con 46 % de
 * la huella "distinta" en la vista de frente, solo porque el espejo voltea la diagonal
 * con que se parte cada cuadrilátero y eso corre el centroide. Un falso positivo del
 * 46 % en el número que decide si una imagen es evidencia. Con interpolación por
 * vértice el error cae al orden de la sagita de la cuerda (0.011 mm en la taza).
 * Si la cara NO trae `zv` se usa el centroide y se avisa en `zConstante`.
 */
export function rasterizarProyeccion(proy: CarasProyectadas, o?: { res?: number }): ImagenOrto {
  const res = o?.res ?? 256;
  const sx = res / proy.ancho, sy = res / proy.alto;
  const z = new Float32Array(res * res).fill(Infinity);
  const vis = new Float32Array(res * res);
  const mask = new Uint8Array(res * res);
  let nSinZv = 0;
  for (const c of proy.caras) {
    if (!c.zv) nSinZv++;
    const x0p = c.pts[0] * sx, y0p = c.pts[1] * sy, x1p = c.pts[2] * sx, y1p = c.pts[3] * sy, x2p = c.pts[4] * sx, y2p = c.pts[5] * sy;
    const e = (x1p - x0p) * (y2p - y0p) - (y1p - y0p) * (x2p - x0p);
    if (Math.abs(e) < 1e-12) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0p, x1p, x2p)));
    const maxX = Math.min(res - 1, Math.ceil(Math.max(x0p, x1p, x2p)));
    const minY = Math.max(0, Math.floor(Math.min(y0p, y1p, y2p)));
    const maxY = Math.min(res - 1, Math.ceil(Math.max(y0p, y1p, y2p)));
    for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const l0 = ((x1p - cx) * (y2p - cy) - (y1p - cy) * (x2p - cx)) / e;
      const l1 = ((x2p - cx) * (y0p - cy) - (y2p - cy) * (x0p - cx)) / e;
      const l2 = 1 - l0 - l1;
      if (l0 < -1e-9 || l1 < -1e-9 || l2 < -1e-9) continue;
      const idx = py * res + px;
      const d = c.zv ? l0 * c.zv[0] + l1 * c.zv[1] + l2 * c.zv[2] : c.z;
      if (d < z[idx]) { z[idx] = d; vis[idx] = c.vis; mask[idx] = 1; }
    }
  }
  let zMin = Infinity, zMax = -Infinity, n = 0;
  for (let i = 0; i < z.length; i++) if (mask[i]) { n++; if (z[i] < zMin) zMin = z[i]; if (z[i] > zMax) zMax = z[i]; }
  return { res, ancho: proy.ancho, alto: proy.alto, mask, z, vis, zMin, zMax, nPix: n, zConstante: nSinZv > 0 };
}

/**
 * Proyecta una malla a `CarasProyectadas` CON profundidad por vértice, usando la
 * cámara de este módulo (que F0 del gate prueba idéntica en convención a la de
 * `visibilidad.proyectarParaLamina`). `visTri` es el canal de sombreado: lo natural es
 * pasarle `clasificarVisibilidad(...).fracMaxTri`, así la imagen que se compara es la
 * MISMA que juzga el motor de visibilidad.
 *
 * `ajustar:true` encuadra la malla en el lienzo igual que `proyectarParaLamina`
 * (escala al 92 % y centrado), para que dos renders se comparen por FORMA y no por
 * dónde quedó la pieza en el cuadro.
 */
export function proyectarMallaParaImagen(
  mesh: { positions: ArrayLike<number>; indices: ArrayLike<number> },
  cam: CamaraOrto,
  o?: { visTri?: ArrayLike<number>; ancho?: number; alto?: number; ajustar?: boolean },
): CarasProyectadas {
  const P = mesh.positions, I = mesh.indices;
  const ancho = o?.ancho ?? 600, alto = o?.alto ?? 620;
  const b = baseCamara(cam);
  const nV = Math.floor(P.length / 3);
  const su = new Float64Array(nV), sv = new Float64Array(nV), sw = new Float64Array(nV);
  for (let i = 0; i < nV; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    su[i] = x * b.u[0] + y * b.u[1] + z * b.u[2];
    sv[i] = x * b.v[0] + y * b.v[1] + z * b.v[2];
    sw[i] = x * b.w[0] + y * b.w[1] + z * b.w[2];
  }
  let k = cam.k, cx = cam.cx, cy = cam.cy;
  if (o?.ajustar !== false) {
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < nV; i++) {
      if (su[i] < u0) u0 = su[i]; if (su[i] > u1) u1 = su[i];
      if (sv[i] < v0) v0 = sv[i]; if (sv[i] > v1) v1 = sv[i];
    }
    k = Math.min(ancho / ((u1 - u0) || 1), alto / ((v1 - v0) || 1)) * 0.92;
    cx = ancho / 2 - ((u0 + u1) / 2) * k;
    cy = alto / 2 + ((v0 + v1) / 2) * k;
  }
  const caras: CarasProyectadas['caras'] = [];
  const nTri = Math.floor(I.length / 3);
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3], b2 = I[t * 3 + 1], c = I[t * 3 + 2];
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const bx = P[b2 * 3], by = P[b2 * 3 + 1], bz = P[b2 * 3 + 2];
    const cx3 = P[c * 3], cy3 = P[c * 3 + 1], cz3 = P[c * 3 + 2];
    const nx = (by - ay) * (cz3 - az) - (bz - az) * (cy3 - ay);
    const ny = (bz - az) * (cx3 - ax) - (bx - ax) * (cz3 - az);
    const nz = (bx - ax) * (cy3 - ay) - (by - ay) * (cx3 - ax);
    if (nx * b.w[0] + ny * b.w[1] + nz * b.w[2] >= 0) continue;   // cara de atrás
    caras.push({
      pts: [cx + su[a] * k, cy - sv[a] * k, cx + su[b2] * k, cy - sv[b2] * k, cx + su[c] * k, cy - sv[c] * k],
      vis: o?.visTri ? o.visTri[t] : 1,
      z: (sw[a] + sw[b2] + sw[c]) / 3,
      zv: [sw[a], sw[b2], sw[c]],
    });
  }
  return { caras, ancho, alto };
}

/**
 * UMBRAL DE DISCRIMINACIÓN — EXTENSIÓN DECLARADA.
 * Por debajo de 1.0 % de la HUELLA de la pieza, la diferencia entre el render correcto
 * y el corrupto vive en un borde de un píxel de grosor. Nadie —ojo humano o de
 * agente— la caza mirando, y ya sabemos qué pasa con los jueces que "miran" sin medir.
 * A partir de ahí la imagen deja de ser evidencia y el criterio TIENE que ser numérico.
 * El número es un parámetro, no una ley: se puede subir, nunca bajar para que pase algo.
 */
export const UMBRAL_DISCRIMINA_PCT = 1.0;

export interface DetalleDistinguibilidad {
  /** % de la HUELLA (A ∪ B) donde las dos imágenes difieren — el número que devuelve `distinguibilidad` */
  pctPieza: number;
  /** % del CUADRO completo donde difieren */
  pctCuadro: number;
  /** % de la huella que difiere solo por SILUETA (uno tiene pieza y el otro no) */
  pctSilueta: number;
  /** % que difiere solo por PROFUNDIDAD (misma silueta, otro frente) */
  pctProfundidad: number;
  /** % que difiere solo por SOMBREADO */
  pctSombreado: number;
  iou: number;
  nA: number; nB: number; nUnion: number; nDistintos: number;
  discrimina: boolean;
  umbralPct: number;
  veredicto: string;
}

/**
 * DISTINGUIBILIDAD entre dos renders. Devuelve **el porcentaje de la huella de la
 * pieza en el que las dos imágenes difieren de forma detectable**:
 *   · uno tiene pieza y el otro no (SILUETA), o
 *   · ambos tienen pieza pero el frente está a otra profundidad (> tolZ).
 *
 * ⚠ EL SOMBREADO NO CUENTA POR DEFECTO, y esto se pagó midiéndolo. El canal de
 * sombreado natural aquí es `fracMaxTri` de `clasificarVisibilidad`: una cantidad POR
 * TRIÁNGULO. Dos teselados del MISMO sólido (la taza y su espejo, partiendo cada
 * cuadrilátero por la otra diagonal) dan triángulos distintos y por lo tanto
 * fracciones distintas: medido, **67.6 % de "diferencia" entre una taza y su espejo,
 * que son la misma pieza**, con la silueta y la profundidad idénticas al bit. Un canal
 * que reporta 67.6 % de señal falsa no puede ir en el número que decide si una imagen
 * es evidencia. Se reporta aparte (`pctSombreado`) y se activa con `usarSombreado`
 * cuando lo que se está juzgando ES el sombreado y las dos mallas son la misma.
 *
 * Se normaliza contra A ∪ B y no contra el cuadro: el relleno del encuadre no debe
 * diluir el número (si no, basta con alejar la cámara para que "todo se parezca").
 *
 * 0.00 significa exactamente una cosa: **estas dos imágenes son la misma, y por lo
 * tanto esa vista no puede ser evidencia de nada que las separe.**
 */
export function distinguibilidad(a: ImagenOrto, b: ImagenOrto, o?: OpcDist): number {
  return distinguibilidadDetalle(a, b, o).pctPieza;
}

export interface OpcDist {
  /** tolerancia de profundidad, en unidades del modelo. Por defecto 0.1 % del espesor visible. */
  tolZ?: number;
  tolVis?: number;
  /** incluir el canal de SOMBREADO en la distancia. Por defecto FALSE: ver el aviso de arriba. */
  usarSombreado?: boolean;
}

export function distinguibilidadDetalle(
  a: ImagenOrto, b: ImagenOrto, o?: OpcDist,
): DetalleDistinguibilidad {
  if (a.res !== b.res) throw new Error(`distinguibilidad: resoluciones distintas (${a.res} vs ${b.res})`);
  const rango = Math.max(a.zMax - a.zMin, b.zMax - b.zMin, 1e-9);
  const tolZ = o?.tolZ ?? rango * 1e-3;      // 0.1 % del espesor visible de la pieza
  const tolVis = o?.tolVis ?? 1e-3;
  let nA = 0, nB = 0, nU = 0, nInter = 0, dSil = 0, dZ = 0, dV = 0;
  for (let i = 0; i < a.mask.length; i++) {
    const ma = a.mask[i], mb = b.mask[i];
    if (ma) nA++; if (mb) nB++;
    if (!ma && !mb) continue;
    nU++;
    if (ma !== mb) { dSil++; continue; }
    nInter++;
    if (Math.abs(a.z[i] - b.z[i]) > tolZ) { dZ++; continue; }
    if (Math.abs(a.vis[i] - b.vis[i]) > tolVis) dV++;
  }
  const nD = dSil + dZ + (o?.usarSombreado ? dV : 0);
  const pctPieza = nU > 0 ? (100 * nD) / nU : 0;
  const discrimina = pctPieza >= UMBRAL_DISCRIMINA_PCT;
  return {
    pctPieza, pctCuadro: (100 * nD) / a.mask.length,
    pctSilueta: nU > 0 ? (100 * dSil) / nU : 0,
    pctProfundidad: nU > 0 ? (100 * dZ) / nU : 0,
    pctSombreado: nU > 0 ? (100 * dV) / nU : 0,
    iou: nU > 0 ? nInter / nU : 1,
    nA, nB, nUnion: nU, nDistintos: nD, sombreadoContado: !!o?.usarSombreado,
    discrimina, umbralPct: UMBRAL_DISCRIMINA_PCT,
    veredicto: discrimina
      ? `DISCRIMINA: ${pctPieza.toFixed(2)} % de la huella cambia (silueta ${((nU ? 100 * dSil / nU : 0)).toFixed(2)} % · profundidad ${((nU ? 100 * dZ / nU : 0)).toFixed(2)} %${o?.usarSombreado ? ` · sombreado ${((nU ? 100 * dV / nU : 0)).toFixed(2)} %` : ''})`
      : `ESTA VISTA NO DISCRIMINA: solo ${pctPieza.toFixed(4)} % de la huella cambia (< ${UMBRAL_DISCRIMINA_PCT} %). La imagen NO ES EVIDENCIA — el criterio tiene que ser numérico.`,
  };
}

/** Veredicto formal de un par correcto/corrupto ofrecido como evidencia visual. */
export interface VeredictoDiscriminacion {
  nombre: string;
  corrupcion: string;
  distancia: number;
  discrimina: boolean;
  /** true = la vista SIRVE como evidencia contra esta corrupción */
  esEvidencia: boolean;
  detalle: DetalleDistinguibilidad;
  porque: string;
}

export function verificarDiscriminacion(
  nombre: string, corrupcion: string, correcto: ImagenOrto, corrupto: ImagenOrto,
  o?: OpcDist,
): VeredictoDiscriminacion {
  const d = distinguibilidadDetalle(correcto, corrupto, o);
  return {
    nombre, corrupcion, distancia: d.pctPieza, discrimina: d.discrimina, esEvidencia: d.discrimina, detalle: d,
    porque: d.discrimina
      ? `la vista "${nombre}" separa "${corrupcion}" con ${d.pctPieza.toFixed(2)} % de huella distinta: sirve como evidencia`
      : `la vista "${nombre}" NO separa "${corrupcion}" (${d.pctPieza.toFixed(4)} %): esta imagen no es evidencia, hace falta otro ángulo o un criterio numérico`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §6 · TAMAÑO MÍNIMO EN PANTALLA — el caso del gate de 1.5 px
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MIN_PX_DEFECTO — EXTENSIÓN DECLARADA, con su razón.
 * Un rasgo BAJO JUICIO no basta con que se vea: hay que poder juzgar su FORMA
 * (¿el cono abre hacia la pieza o hacia la colada?, ¿el filete es filete o chaflán?).
 * Para eso el rasgo necesita, como mínimo: 1 px de borde + 1 px de borde + interior
 * con al menos 3-4 px para que la forma tenga variación. 12 px de lado es el corte
 * donde eso empieza a existir. Debajo de 12 px el "juicio" es sobre 1-2 píxeles y no
 * distingue un cono de un cilindro: la lámina L7 con el tunnel gate a 1.5 px es el
 * caso REAL que motiva esta función.
 * Es un parámetro por rasgo (`minPx`); el default se puede subir, nunca bajar para
 * que un rasgo apruebe.
 */
export const MIN_PX_DEFECTO = 12;

export interface RasgoBajoJuicio {
  nombre: string;
  /** el tamaño característico EN MILÍMETROS de lo que se está juzgando */
  tamanoMm: number;
  /** dónde está en el mundo (para ubicar el recuadro de detalle) */
  en?: P3;
  /** dirección 3D del rasgo si es lineal (para el escorzo). Si falta, se toma
   *  isótropo (un ⌀ proyecta k·D sin importar la vista). */
  dir?: P3;
  /** px mínimos exigidos para ESTE rasgo */
  minPx?: number;
  /** qué se pretende juzgar con él (va en el recuadro) */
  queSeJuzga?: string;
}

export interface VeredictoRasgo {
  nombre: string;
  tamanoMm: number;
  /** factor de escorzo ∈ [0,1]: √(1−(d·w)²) para rasgos lineales, 1 para isótropos */
  escorzo: number;
  px: number;
  minPx: number;
  ok: boolean;
  queSeJuzga: string;
  /** si no llega al mínimo, el recuadro de detalle que hay que dibujar */
  recuadro?: { centroPx: Pt2; zoom: number; ladoPx: number; porque: string };
}

export interface VeredictoTamano {
  todosOK: boolean;
  camara: string;
  kPxPorMm: number;
  rasgos: VeredictoRasgo[];
  nExigenRecuadro: number;
  /** el rasgo más chico bajo juicio */
  peor: string;
  porque: string[];
}

/**
 * ¿Cada rasgo bajo juicio ocupa suficientes píxeles para poder JUZGARLO?
 *
 * Forma cerrada del escorzo: un segmento de longitud T en dirección d proyecta
 * k·T·√(1−(d·w)²). Un rasgo isótropo (⌀ de una compuerta, una esfera) proyecta k·T
 * sin importar la vista — por eso, cuando no se declara dirección, se usa 1.
 *
 * Lo que NO llega al mínimo no se declara "verificado a ojo": se le exige RECUADRO
 * DE DETALLE con el zoom calculado. Eso es lo que faltaba en la lámina del gate.
 */
export function verificarTamanoMinimo(
  rasgos: RasgoBajoJuicio[], cam: CamaraOrto, o?: { minPx?: number },
): VeredictoTamano {
  const b = baseCamara(cam);
  const minGlobal = o?.minPx ?? MIN_PX_DEFECTO;
  const porque: string[] = [];
  const out: VeredictoRasgo[] = rasgos.map((r) => {
    const escorzo = r.dir ? Math.sqrt(Math.max(0, 1 - dot3(norm3(r.dir), b.w) ** 2)) : 1;
    const px = cam.k * r.tamanoMm * escorzo;
    const minPx = r.minPx ?? minGlobal;
    const ok = px >= minPx;
    const v: VeredictoRasgo = {
      nombre: r.nombre, tamanoMm: r.tamanoMm, escorzo, px, minPx, ok,
      queSeJuzga: r.queSeJuzga ?? 'la forma del rasgo',
    };
    if (!ok) {
      const zoom = Math.ceil((minPx / Math.max(px, 1e-9)) * 10) / 10;
      // el recuadro muestra el rasgo más 3× de contexto alrededor, con piso de 120 px
      const lado = Math.max(120, Math.round(px * zoom * 4));
      v.recuadro = {
        centroPx: r.en ? proyectar(cam, r.en, b) : [cam.cx, cam.cy],
        zoom, ladoPx: lado,
        porque: `${r.nombre} mide ${px.toFixed(2)} px y hacen falta ${minPx}: a ese tamaño no se puede juzgar ${v.queSeJuzga}. Recuadro a ${zoom}× (lado ${lado} px) o el criterio pasa a ser numérico.`,
      };
      porque.push(v.recuadro.porque);
    }
    return v;
  });
  const nRec = out.filter((r) => !r.ok).length;
  const peor = out.length ? out.reduce((a, c) => (c.px < a.px ? c : a)).nombre : '—';
  return {
    todosOK: nRec === 0, camara: cam.nombre, kPxPorMm: cam.k, rasgos: out,
    nExigenRecuadro: nRec, peor, porque,
  };
}

/** La escala (px/mm) que hace falta para que un rasgo de `mm` llegue a `minPx`.
 *  Es la respuesta accionable: "esta lámina necesita 40 px/mm, tiene 5". */
export function escalaNecesaria(tamanoMm: number, minPx = MIN_PX_DEFECTO): number {
  return minPx / Math.max(tamanoMm, 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────────
// §7 · DIBUJO DEL FIDUCIAL — la ayuda visual que va en la esquina de cada vista
// ─────────────────────────────────────────────────────────────────────────────

const ESC = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const F = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '∞');

/** Paleta: convención CAD para los ejes (cualquier ingeniero la lee sin leyenda)
 *  sobre el fondo del proyecto. El oro es el color de la anotación, como en las láminas. */
export const COLOR_EJE = { X: '#ff6b6b', Y: '#59d98c', Z: '#6aa9ff' } as const;

/**
 * Dibuja el fiducial como un grupo SVG (sin envoltorio `<svg>`), listo para pegarse
 * en la esquina de cualquier vista 3D del entregable. Es el MISMO objeto que
 * `verificarFiducial` mide: si el dibujo y los números se separan, uno de los dos
 * miente y el residuo lo dice.
 */
export function dibujarFiducial(
  f: Fiducial, cam: CamaraOrto,
  o?: { cotas?: boolean; opacidad?: number; grosor?: number; rotulo?: number },
): string {
  const b = baseCamara(cam);
  const g = o?.grosor ?? 2.4;
  const e = o?.rotulo ?? 1;      // escala de flechas y rótulos (para el fiducial mini)
  const op = o?.opacidad ?? 1;
  const O = proyectar(cam, f.origen, b);
  const T = puntasTriada(f).map((p) => proyectar(cam, p, b));
  const V = verticesCubo(f);
  const Vp = V.map((p) => proyectar(cam, p, b));
  const C = formaCerradaFiducial(f, cam);
  const s: string[] = [`<g class="fid" opacity="${op}">`];

  // — ESFERA: círculo de radio kR. Se dibuja SOLO como contorno para no tapar nada;
  //   su centro tiene que caer exactamente en el origen proyectado (invariante visual).
  s.push(`<circle cx="${F(O[0], 3)}" cy="${F(O[1], 3)}" r="${F(C.rEsfera, 3)}" fill="#c9a227" opacity="0.05"/>`);
  s.push(`<circle cx="${F(O[0], 3)}" cy="${F(O[1], 3)}" r="${F(C.rEsfera, 3)}" fill="none" stroke="#c9a227" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.95"/>`);

  // — CUBO: caras frontales con relleno tenue (para que se lea como sólido) y aristas
  //   ocultas punteadas. Una arista está oculta si sus DOS caras miran para el otro
  //   lado (el cubo es convexo, así que el criterio es exacto, sin heurística).
  const frontal = (ax: number, positiva: boolean) => (positiva ? b.w[ax] : -b.w[ax]) < 0;
  const nomEje = ['X', 'Y', 'Z'] as const;
  for (let ax = 0; ax < 3; ax++) for (const pos of [false, true]) {
    if (!frontal(ax, pos)) continue;
    // los 4 vértices de la cara: los que tienen el bit `ax` en el valor `pos`
    const idx = [0, 1, 2, 3].map((q) => {
      const o1 = (ax + 1) % 3, o2 = (ax + 2) % 3;
      return (pos ? 1 << ax : 0) | ((q === 1 || q === 2 ? 1 : 0) << o1) | ((q >= 2 ? 1 : 0) << o2);
    });
    s.push(`<polygon points="${idx.map((q) => `${F(Vp[q][0], 2)},${F(Vp[q][1], 2)}`).join(' ')}" fill="${COLOR_EJE[nomEje[ax]]}" opacity="0.085"/>`);
  }
  for (const [i, j] of ARISTAS_CUBO) {
    const dif = i ^ j;
    const ax = dif === 1 ? 0 : dif === 2 ? 1 : 2;
    let visible = false;
    for (let m = 0; m < 3; m++) { if (m === ax) continue; if (frontal(m, !!(i & (1 << m)))) visible = true; }
    s.push(`<line x1="${F(Vp[i][0], 2)}" y1="${F(Vp[i][1], 2)}" x2="${F(Vp[j][0], 2)}" y2="${F(Vp[j][1], 2)}" stroke="#8fa3bd" stroke-width="${visible ? 1.5 : 1}" ${visible ? '' : 'stroke-dasharray="3 4"'} opacity="${visible ? 0.85 : 0.34}"/>`);
  }

  // — TRIADA: la única pieza QUIRAL. Flecha + rótulo por eje.
  const nom = ['X', 'Y', 'Z'] as const;
  for (let i = 0; i < 3; i++) {
    const col = COLOR_EJE[nom[i]];
    const dx = T[i][0] - O[0], dy = T[i][1] - O[1], L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const pB = [T[i][0] - ux * 13 * e, T[i][1] - uy * 13 * e];
    const nx = -uy, ny = ux;
    s.push(`<line x1="${F(O[0], 2)}" y1="${F(O[1], 2)}" x2="${F(pB[0], 2)}" y2="${F(pB[1], 2)}" stroke="${col}" stroke-width="${g}" stroke-linecap="round"/>`);
    s.push(`<polygon points="${F(T[i][0], 2)},${F(T[i][1], 2)} ${F(pB[0] + nx * 4.6 * e, 2)},${F(pB[1] + ny * 4.6 * e, 2)} ${F(pB[0] - nx * 4.6 * e, 2)},${F(pB[1] - ny * 4.6 * e, 2)}" fill="${col}"/>`);
    s.push(`<circle cx="${F(T[i][0] + ux * 18 * e, 2)}" cy="${F(T[i][1] + uy * 18 * e, 2)}" r="${F(10.5 * e, 1)}" fill="#0b0f16" stroke="${col}" stroke-width="1.3"/>`);
    s.push(`<text x="${F(T[i][0] + ux * 18 * e, 2)}" y="${F(T[i][1] + uy * 18 * e + 4.4 * e, 2)}" text-anchor="middle" style="font:700 ${F(12.5 * e, 1)}px 'JetBrains Mono',monospace;fill:${col}">${nom[i]}</text>`);
    if (o?.cotas) {
      const lado = (T[i][0] - O[0]) * (T[i][1] - O[1]) >= 0 ? 1 : -1;
      s.push(`<text x="${F(O[0] + dx * 0.55 + nx * 30 * lado, 2)}" y="${F(O[1] + dy * 0.55 + ny * 30 * lado + 3.5, 2)}" text-anchor="middle" style="font:400 10px 'JetBrains Mono',monospace;fill:${col};opacity:0.85">${F(C.largoEje[i], 1)} px</text>`);
    }
  }
  s.push(`<circle cx="${F(O[0], 3)}" cy="${F(O[1], 3)}" r="${F(3.4 * e, 1)}" fill="#e9eef5"/>`);
  s.push('</g>');
  return s.join('\n');
}

const CSS_FID = `
  .bg{fill:#0b0f16}
  .tit{fill:#e9eef5;font:700 20px 'JetBrains Mono',monospace}
  .sub{fill:#8fa3bd;font:400 12.5px 'JetBrains Mono',monospace}
  .cita{fill:#c9a227;font:700 12.5px 'JetBrains Mono',monospace}
  .lbl{fill:#c3d0e0;font:400 12px 'JetBrains Mono',monospace}
  .lblSm{fill:#8fa3bd;font:400 10.5px 'JetBrains Mono',monospace}
  .num{fill:#e9eef5;font:700 12px 'JetBrains Mono',monospace}
  .ok{fill:#59d98c} .mal{fill:#ff5c5c} .warn{fill:#ffb347}
  .panel{fill:#111825;stroke:#243247;stroke-width:1}
`;

export interface FilaVeredicto { que: string; valor: string; estado: 'OK' | 'MAL' | 'AVISO' | 'DATO' }

/**
 * LA LÁMINA DEL ARNÉS: el fiducial dibujado (ayuda visual para el cliente) al lado
 * del panel de veredictos NUMÉRICOS. Las dos mitades tienen que contar lo mismo:
 * el dibujo es para que un humano vea el objeto de calibración; los números son los
 * que mandan.
 */
export function laminaFiducial(o: {
  fiducial?: Fiducial;
  camara?: CamaraOrto;
  veredicto: VeredictoFiducial;
  filas?: FilaVeredicto[];
  nombre?: string;
  notas?: string[];
}): { svg: string; titulo: string; queMirar: string } {
  const W = 1080, H = 760;
  const f = o.fiducial ?? fiducialPorDefecto(40);
  const cam: CamaraOrto = o.camara ?? {
    nombre: 'isométrica (−1,−1,−1)', dir: [-1, -1, -1], arriba: [0, 0, 1],
    k: 5.2, cx: 312, cy: 396, mira: f.origen,
  };
  const C = formaCerradaFiducial(f, cam);
  const v = o.veredicto;
  const est = (b: boolean) => (b ? 'OK' : 'MAL');
  const filas: FilaVeredicto[] = [
    { que: 'ESCALA (esfera, sin orientación)', valor: `${F(v.kEsfera, 6)} px/mm vs ${F(v.kDeclarada, 6)} declarada`, estado: est(v.escalaOK) },
    { que: 'ESCALA (triada, AAᵀ = k²I)', valor: `${F(v.kTriada, 6)} px/mm · defecto orto ${v.defectoOrto.toExponential(1)}`, estado: est(v.escalaOK) },
    { que: 'PÍXEL CUADRADO (rMax/rMin esfera)', valor: `${F(v.ovaloEsfera, 6)}`, estado: est(v.ovaloEsfera < 1 + 1e-6) },
    { que: 'EJES (mejor rotación de imagen)', valor: `residuo ${v.resRotPx.toExponential(2)} px`, estado: est(v.ejesOK) },
    { que: 'EJES (mejor reflexión de imagen)', valor: `residuo ${v.resReflPx.toExponential(2)} px`, estado: 'DATO' },
    { que: 'MANO (área firmada de la triada)', valor: `${F(v.areaTriadaMedida, 1)} px² vs ${F(v.areaTriadaCerrada, 1)} cerrada`, estado: v.manoMedible ? est(v.manoOK) : 'AVISO' },
    { que: 'PODER DE MANO |w·(1,1,1)|', valor: `${F(v.poderMano, 4)} de √3 máx · umbral ${UMBRAL_PODER_MANO}`, estado: v.manoMedible ? 'OK' : 'AVISO' },
    { que: 'SILUETA DEL CUBO a²k²Σ|wᵢ|', valor: `${F(v.areaCuboMedida, 1)} px² vs ${F(v.areaCuboCerrada, 1)} cerrada`, estado: est(Math.abs(v.areaCuboMedida - v.areaCuboCerrada) < 1e-6 * Math.max(1, v.areaCuboCerrada)) },
    { que: 'RESIDUO MAESTRO (sin alinear)', valor: `${v.residuoPx.toExponential(3)} px`, estado: est(v.residuoPx < TOL_FIDUCIAL_PX) },
    ...(o.filas ?? []),
  ];

  const PX = 612, PY = 94, PW = 436, PH = H - PY - 36;
  const filaH = Math.min(30, (PH - 66) / Math.max(filas.length, 1));
  const rows = filas.map((r, i) => {
    const y = PY + 46 + i * filaH;
    const col = r.estado === 'OK' ? '#59d98c' : r.estado === 'MAL' ? '#ff5c5c' : r.estado === 'AVISO' ? '#ffb347' : '#8fa3bd';
    const gl = r.estado === 'OK' ? '✓' : r.estado === 'MAL' ? '✗' : r.estado === 'AVISO' ? '!' : '·';
    return `<text x="${PX + 14}" y="${y}" style="font:700 12px 'JetBrains Mono',monospace;fill:${col}">${gl}</text>`
      + `<text class="lbl" x="${PX + 32}" y="${y}">${ESC(r.que)}</text>`
      + `<text class="lblSm" x="${PX + 32}" y="${y + 13}" style="fill:${col}">${ESC(r.valor)}</text>`;
  }).join('\n');

  // LA TIRA DEL CONTROL NEGATIVO: el mismo fiducial dibujado MAL a propósito, con el
  // diagnóstico que le saca `verificarFiducial`. Es la mitad visual de la regla: se ve
  // que las tres imágenes son distintas Y se lee el número que las separa.
  const kT = 0.85, cyT = PY + 500;
  const tira = ([
    { et: 'CORRECTO', mapa: (q: P3) => q, cam2: (c: CamaraOrto) => c, cx: 130 },
    { et: 'ESPEJO DE IMAGEN', mapa: (q: P3) => q, cam2: (c: CamaraOrto) => ({ ...c, espejoX: true }), cx: 312 },
    { et: 'ROLL DE 12°', mapa: (q: P3) => q, cam2: (c: CamaraOrto) => ({ ...c, arriba: [Math.sin(0.2094), 0, Math.cos(0.2094)] as P3 }), cx: 494 },
  ]).map((t) => {
    const cBase: CamaraOrto = { ...cam, k: kT, cx: t.cx, cy: cyT, mira: f.origen };
    const ver = verificarFiducial(proyectarFiducial(f, t.cam2(cBase), { mapa: t.mapa, declarar: cBase }));
    return {
      ...t, diag: ver.diagnostico, col: ver.diagnostico === 'OK' ? '#59d98c' : '#ff5c5c',
      g: dibujarFiducial(f, t.cam2(cBase), { grosor: 1.6, opacidad: 0.95, rotulo: 0.72 }),
    };
  });

  const diagCol = v.diagnostico === 'OK' ? '#59d98c' : v.diagnostico === 'MANO-NO-MEDIBLE' ? '#ffb347' : '#ff5c5c';
  const notas = (o.notas ?? []).concat(v.porque).slice(0, 3);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS_FID}</style>
<rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="32" y="36">ARNÉS DE RENDER 3D · FIDUCIAL DE CALIBRACIÓN</text>
<text class="sub" x="32" y="57">${ESC(o.nombre ?? 'triada + cubo unitario + esfera — proyección en FORMA CERRADA, verificable en números')}</text>
<text class="cita" x="32" y="77">si la versión CORRUPTA no se distingue de la correcta, esa imagen NO ES EVIDENCIA y el criterio tiene que ser numérico</text>

<rect class="panel" x="32" y="${PY}" width="560" height="${PH}" rx="4"/>
<text class="lblSm" x="46" y="${PY + 20}">EL FIDUCIAL DIBUJADO · cámara ${ESC(cam.nombre)} · ${F(cam.k, 2)} px/mm · ortográfica</text>
${dibujarFiducial(f, cam, { cotas: true })}
<line x1="46" y1="${PY + 425}" x2="${32 + 560 - 14}" y2="${PY + 451}" stroke="#243247"/>
<text class="lblSm" x="46" y="${PY + 441}">EL CONTROL NEGATIVO, DIBUJADO — el mismo fiducial renderizado MAL a propósito:</text>
${tira.map((t) => t.g).join('\n')}
${tira.map((t) => `<text class="lblSm" x="${t.cx}" y="${PY + 552}" text-anchor="middle" style="font:700 10.5px 'JetBrains Mono',monospace;fill:${t.col}">${ESC(t.et)}</text>`
    + `<text class="lblSm" x="${t.cx}" y="${PY + 565}" text-anchor="middle" style="fill:${t.col};opacity:0.9">→ ${ESC(t.diag)}</text>`).join('\n')}
<text class="lblSm" x="46" y="${PY + 592}" style="fill:#c9a227">ESFERA R=${F(f.R, 1)} → círculo de ${F(C.rEsfera, 1)} px SIEMPRE (si sale ELIPSE, el píxel no es cuadrado)</text>
<text class="lblSm" x="46" y="${PY + 609}" style="fill:#c3d0e0">CUBO a=${F(f.a, 1)} → silueta ${F(C.areaCubo, 0)} px² = a²k²Σ|wᵢ| · confirma la DIRECCIÓN de vista</text>
<text class="lblSm" x="46" y="${PY + 626}" style="fill:#e9eef5">TRIADA L=${F(f.L, 1)} → área firmada ${F(C.areaTriada, 0)} px² · única pieza QUIRAL: caza el ESPEJO</text>

<rect class="panel" x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="4"/>
<text class="lblSm" x="${PX + 14}" y="${PY + 20}">VEREDICTOS NUMÉRICOS · medido contra forma cerrada</text>
<line x1="${PX + 14}" y1="${PY + 28}" x2="${PX + PW - 14}" y2="${PY + 28}" stroke="#243247"/>
${rows}
<line x1="${PX + 14}" y1="${PY + PH - 58}" x2="${PX + PW - 14}" y2="${PY + PH - 58}" stroke="#243247"/>
<text x="${PX + 14}" y="${PY + PH - 36}" style="font:700 15px 'JetBrains Mono',monospace;fill:${diagCol}">DIAGNÓSTICO: ${ESC(v.diagnostico)}</text>
<text class="lblSm" x="${PX + 14}" y="${PY + PH - 18}">${ESC((notas[0] ?? 'proyección medida = forma cerrada dentro de 1e-9 px').slice(0, 62))}</text>
</svg>`;

  return {
    svg,
    titulo: 'Arnés de render 3D · fiducial de calibración',
    queMirar: 'El círculo punteado tiene que estar CENTRADO en el origen y ser un círculo (no elipse). Los tres ejes rotulados X/Y/Z tienen que salir del mismo punto y el cubo colgar de ese mismo origen hacia +X+Y+Z. Y sobre todo: el panel derecho manda — si el residuo maestro no es ~0, el dibujo miente aunque se vea bien.',
  };
}
