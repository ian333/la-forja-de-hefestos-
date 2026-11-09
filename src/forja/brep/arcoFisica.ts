/**
 * ARCO FÍSICA — la gota, el arco y sus campos para la simulación EN VIVO del BANCO DEL ARCO
 * =========================================================================================
 * Orden 2026-11-04-banco-arco-vivo. Es el MISMO modelo y los MISMOS números que el canon en Python
 * (scripts/canon/canon_gota.py, modelo de junio): aquí solo se porta para que corra en el navegador.
 *
 *   LA GOTA COMO CAMPANA (modo l=2 de Rayleigh):  q'' + (ω/Q)·q' + ω²·q = ω²·empuje,   ω² = 8σ/(ρa³)
 *     empuje = (I/I_crit)²  +  peso/tensión         (pellizco µ0I²/4π contra tensión 2π·r_w·σ → I_crit = 194 A)
 *     se suelta cuando q ≥ 1  (q = 1: el empuje vence a la tensión superficial)
 *   EL ARCO: V = 14 V + 10 V/mm · largo   (medido por ian; el «oído» del canon)
 *   EL CAMPANAZO: cuando la gota llega al tamaño pedido, la corriente lleva una onda a SU frecuencia f₂
 *     (la que el oído mide); en el modelo la frecuencia es la verdadera — el error del oído no se simula aquí.
 *   EL CAMPO E: método de cargas simuladas (cargas puntuales sobre el eje dentro del alambre y la gota) más
 *     sus IMÁGENES en la placa (plano a 0 V). Es el campo ELECTROSTÁTICO del hueco: el de antes de prender o
 *     el que guía la columna. Con el arco prendido el plasma conduce: la columna tiene ~1–2 V/mm y casi toda la
 *     caída (~10 V) está en las capas del cátodo y del ánodo. Se dice así en el tablero; no se disimula.
 *   EL CAMPO B: alrededor de un conductor recto con corriente I, B = µ0·I/(2π·r) (fuera del conductor).
 *
 * SI adentro de la gota (m, s, A, V, T); los campos y el dibujo trabajan en mm.
 */

// ── constantes del canon ──
export const SIGMA = 1.5;                 // N/m   tensión superficial del acero fundido
export const RHO = 7000;                  // kg/m³ acero líquido
export const ICRIT = 194;                 // A     pellizco = tensión
export const MU0 = 4e-7 * Math.PI;        // T·m/A
export const RW = 0.4e-3;                 // m     radio del alambre (0.8 mm, Truper MICRO-1)
export const G = 9.81;                    // m/s²
export const V_ARCO0 = 14;                // V     voltaje del arco a largo 0 (caídas de cátodo + ánodo)
export const KV = 10;                     // V/mm  pendiente con el largo del arco (medido por ian)
export const F_TENSION = 2 * Math.PI * RW * SIGMA;   // 3.77 mN — lo que sostiene a la gota
export const A_RESTO = 0.6 * RW;          // m     lo que queda fundido en la punta al soltarse una gota

export const w2 = (a: number) => Math.sqrt((8 * SIGMA) / (RHO * a * a * a));
export const f2Hz = (a: number) => w2(a) / (2 * Math.PI);
export const volEsfera = (a: number) => (4 / 3) * Math.PI * a * a * a;
export const radioDeVol = (v: number) => Math.cbrt((3 * v) / (4 * Math.PI));
/** B fuera de un conductor recto (T) a la distancia r (m). */
export const bRecto = (I: number, r: number) => (MU0 * Math.abs(I)) / (2 * Math.PI * r);
/** radio (m) al que el campo de un conductor recto vale B (T). */
export const radioDeB = (I: number, B: number) => (MU0 * Math.abs(I)) / (2 * Math.PI * B);
/** pellizco / tensión superficial = (I/I_crit)². */
export const pellizco = (I: number) => (I / ICRIT) ** 2;

// ── parámetros y estado ──
export type ModoArco = 'cc' | 'campanazo';
export interface ArcoParams {
  modo: ModoArco;
  I0: number;          // A   corriente base (la que calienta)
  I1: number;          // A   la onda del campanazo (la que hace sonar la gota)
  vf: number;          // m/min alambre
  aObj: number;        // mm  radio de gota pedido (campanazo)
  Q: number;           // calidad del modo l=2 (el canon usa 30 como realista)
  gap: number;         // mm  de la punta del alambre a la superficie del cordón, sin gota
  ciclosMax: number;   // ciclos de onda como máximo por gota
  avance: number;      // mm/s la placa avanza bajo la antorcha (el cordón)
}
export const PARAMS_ARCO: ArcoParams = { modo: 'campanazo', I0: 40, I1: 30, vf: 3, aObj: 0.46, Q: 30, gap: 4, ciclosMax: 12, avance: 4 };

export interface GotaVuela { z: number; vz: number; a: number }   // mm sobre la placa, mm/s, mm
export interface Muestra { t: number; I: number; V: number; q: number }
export interface ArcoEstado {
  t: number;           // s
  a: number;           // m   radio de lo fundido en la punta
  q: number; v: number;// amplitud del modo l=2 y su rapidez (1/s)
  I: number; V: number;// A, V  (I = la corriente REAL: la ideal, o la que da el circuito de La Pluma)
  Iref: number;        // A   lo que pide el firmware (base + onda)
  L: number;           // mm  largo del arco
  corto: boolean; cortoHasta: number;
  fase: number; onda: boolean; ciclos: number; ciclosUltima: number;
  gotas: number; cortos: number;
  tamanos: number[];   // mm  radio de la gota COMPLETA al soltarse (la que oscila: la definición del canon)
  vuelan: GotaVuela[];
  cordon: { x: number; a: number }[];   // gotas ya depositadas: x se aleja con el avance de la placa
  hist: Muestra[];     // osciloscopio: una muestra cada HIST_DT de tiempo simulado
  histT: number;
  sueltas: number[];   // s  instantes en que se soltó cada gota (las últimas 80)
}
export const HIST_DT = 20e-6;   // s
export const HIST_N = 3000;     // 60 ms de osciloscopio

export function nuevoArco(): ArcoEstado {
  return {
    t: 0, a: A_RESTO, q: 0, v: 0, I: 0, Iref: 0, V: V_ARCO0, L: 0, corto: false, cortoHasta: 0,
    fase: 0, onda: false, ciclos: 0, ciclosUltima: 0, gotas: 0, cortos: 0, tamanos: [], vuelan: [], cordon: [], hist: [], histT: 0, sueltas: [],
  };
}

/** alto del cordón bajo el arco (mm): sección = caudal de alambre / avance, media luna aplastada por el mojado. */
export function altoCordon(p: ArcoParams): number {
  const caudal = (p.vf / 60) * 1000 * Math.PI * (RW * 1e3) ** 2;   // mm³/s
  const area = caudal / Math.max(0.5, p.avance);                    // mm²
  return 0.55 * Math.sqrt((2 * area) / Math.PI);
}
/** estiramiento axial de la gota por el modo l=2 (volumen constante: el radio lateral es 1/√sz). */
export const estiramiento = (q: number) => 1 + 0.5 * Math.max(-0.6, Math.min(1.2, q));

/** Avanza la gota y el arco dt segundos (dt ≤ ~5 µs para que la campana a 2 kHz no se desestabilice).
 *  `Ireal` = la corriente que de verdad entrega el circuito (La Pluma simulada); sin ella, la corriente es la ideal. */
export function pasoArco(s: ArcoEstado, p: ArcoParams, dt: number, Ireal?: number): void {
  s.t += dt;
  const W = w2(s.a);
  // 1) LA CORRIENTE: base + (en campanazo) una onda a la frecuencia de la gota, que nunca apaga el arco
  //    EL DISPARO SE ADELANTA: mientras suena, la gota sigue creciendo. El control aprende de la gota anterior
  //    cuántos ciclos tardó en soltarse y dispara cuando la gota llegará al tamaño pedido justo al soltarse.
  const caudal = (p.vf / 60) * Math.PI * RW * RW;   // m³/s
  if (p.modo === 'campanazo') {
    if (!s.onda) {
      const nSonar = (s.ciclosUltima > 0 ? s.ciclosUltima : 6) + 0.5;
      const aAlSoltar = s.a + (caudal / (4 * Math.PI * s.a * s.a)) * (nSonar / f2Hz(s.a));
      if (aAlSoltar * 1e3 >= p.aObj) { s.onda = true; s.ciclos = 0; s.fase = 0; }
    }
  } else s.onda = false;
  const I1 = Math.max(0, Math.min(p.I1, p.I0 - 5));
  s.Iref = p.I0 + (s.onda ? I1 * Math.sin(s.fase) : 0);
  s.I = Ireal ?? s.Iref;
  if (s.onda) {
    s.fase += W * dt;
    while (s.fase >= 2 * Math.PI) { s.fase -= 2 * Math.PI; s.ciclos++; }
    if (s.ciclos >= p.ciclosMax) s.onda = false;   // no sonó: se deja crecer (la rescata el peso o el corto)
  }
  // 2) CRECE con el alambre que entra (en estado estable todo lo que entra se funde)
  s.a = radioDeVol(volEsfera(s.a) + caudal * dt);
  // 3) LA CAMPANA: el pellizco (I/I_crit)² y el peso empujan; la tensión superficial regresa
  const empuje = pellizco(s.I) + (RHO * G * volEsfera(s.a)) / F_TENSION;
  const acc = W * W * (empuje - s.q) - (W / p.Q) * s.v;
  s.v += acc * dt; s.q += s.v * dt;
  // 4) EL ARCO: de la punta de la gota al cordón; si la gota lo toca, CORTO (V≈2 V) y la gota pasa al charco
  const hC = altoCordon(p);
  const largo = 2 * s.a * 1e3 * estiramiento(s.q);
  s.L = p.gap - largo;
  if (s.corto && s.t >= s.cortoHasta) s.corto = false;
  const toca = s.L <= 0.05;
  // 5) SE SUELTA: q ≥ 1 (vuelo libre) o toca el cordón (corto circuito)
  if (s.q >= 1 || toca) {
    const aSuelta = radioDeVol(Math.max(volEsfera(s.a) - volEsfera(A_RESTO), 1e-15)) * 1e3;
    s.gotas++; s.ciclosUltima = s.ciclos;
    s.sueltas.push(s.t); if (s.sueltas.length > 80) s.sueltas.shift();
    s.tamanos.push(s.a * 1e3); if (s.tamanos.length > 40) s.tamanos.shift();   // lo que vuela es aSuelta (queda A_RESTO)
    if (toca) { s.cortos++; s.corto = true; s.cortoHasta = s.t + 0.6e-3; s.cordon.push({ x: 0, a: aSuelta }); }
    else s.vuelan.push({ z: hC + p.gap - largo / 2, vz: -Math.max(150, Math.abs(s.v) * s.a * 1e3), a: aSuelta });
    s.a = A_RESTO; s.q = 0; s.v = 0; s.onda = false;
  }
  s.V = s.corto ? 2 : V_ARCO0 + KV * Math.max(0, s.L);
  // 6) LAS QUE VUELAN caen (peso + empuje del plasma ≈ 3 g) y se vuelven cordón
  for (let i = s.vuelan.length - 1; i >= 0; i--) {
    const g = s.vuelan[i];
    g.vz -= 3 * G * 1e3 * dt; g.z += g.vz * dt;
    if (g.z - g.a <= hC) { s.cordon.push({ x: 0, a: g.a }); s.vuelan.splice(i, 1); }
  }
  // 7) la placa avanza: el cordón se aleja
  for (const c of s.cordon) c.x += p.avance * dt;
  while (s.cordon.length > 60) s.cordon.shift();
  // 8) el osciloscopio
  if (s.t - s.histT >= HIST_DT) {
    s.histT = s.t;
    s.hist.push({ t: s.t, I: s.I, V: s.V, q: s.q });
    if (s.hist.length > HIST_N) s.hist.splice(0, s.hist.length - HIST_N);
  }
}

/** Avanza T segundos en pasos de ≤ dtMax. */
export function correrArco(s: ArcoEstado, p: ArcoParams, T: number, dtMax = 2e-6): void {
  const n = Math.max(1, Math.ceil(T / dtMax));
  const dt = T / n;
  for (let k = 0; k < n; k++) pasoArco(s, p, dt);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// EL CAMPO E del hueco — método de cargas simuladas con imágenes (mm, V)
// ════════════════════════════════════════════════════════════════════════════════════════════
/** El electrodo en el plano (r, z) con z hacia arriba desde la superficie (0 V):
 *  alambre de radio rw desde zw hacia arriba, gota de radio a estirada sz colgando de zw, todo a −V (DCEN). */
export interface Electrodo { zw: number; a: number; sz: number; V: number; rw?: number; largoAlambre?: number }
export interface CampoE { z: Float64Array; q: Float64Array; V: number; e: Electrodo; errMax: number }

function resolverLineal(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((f, i) => [...f, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let f = c + 1; f < n; f++) if (Math.abs(M[f][c]) > Math.abs(M[piv][c])) piv = f;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-30;
    for (let f = c + 1; f < n; f++) {
      const k = M[f][c] / d;
      if (k) for (let j = c; j <= n; j++) M[f][j] -= k * M[c][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let f = n - 1; f >= 0; f--) {
    let s = M[f][n];
    for (let j = f + 1; j < n; j++) s -= M[f][j] * x[j];
    x[f] = s / (M[f][f] || 1e-30);
  }
  return x;
}

const nucleo = (r: number, z: number, zj: number) =>
  1 / Math.sqrt(r * r + (z - zj) * (z - zj)) - 1 / Math.sqrt(r * r + (z + zj) * (z + zj));

/** Resuelve las cargas para que alambre y gota queden a −V y la placa a 0 V. */
export function resolverCampoE(e: Electrodo): CampoE {
  const rw = e.rw ?? RW * 1e3, largo = e.largoAlambre ?? 8;
  const sxy = 1 / Math.sqrt(e.sz);
  const cz = e.zw - e.a * e.sz;   // centro de la gota
  const zs: number[] = [], col: [number, number][] = [];
  // gota: 6 cargas sobre el eje dentro de ella y 6 puntos de su superficie
  const ths = [Math.PI, 0.88 * Math.PI, 0.76 * Math.PI, 0.64 * Math.PI, 0.52 * Math.PI, 0.4 * Math.PI];
  const fr = [-0.72, -0.48, -0.24, 0.02, 0.26, 0.5];
  ths.forEach((th, i) => {
    zs.push(cz + fr[i] * e.a * e.sz);
    col.push([e.a * sxy * Math.sin(th), cz + e.a * e.sz * Math.cos(th)]);
  });
  // alambre: cargas cada 0.3 mm sobre el eje, colocación en su superficie a la misma altura
  for (let z = e.zw + 0.15; z <= e.zw + largo; z += 0.3) { zs.push(z); col.push([rw, z]); }
  const A = col.map(([r, z]) => zs.map((zj) => nucleo(r, z, zj)));
  const q = resolverLineal(A, col.map(() => -e.V));
  const campo: CampoE = { z: Float64Array.from(zs), q: Float64Array.from(q), V: e.V, e, errMax: 0 };
  // error: el potencial ENTRE puntos de colocación (donde el método no fue obligado), en la zona que se dibuja
  let err = 0;
  for (let k = 0; k < col.length - 1; k++) {
    const [r0, z0] = col[k], [r1, z1] = col[k + 1];
    if (z1 > e.zw + largo - 2) continue;   // el extremo de arriba del alambre truncado no se dibuja
    err = Math.max(err, Math.abs(potencial(campo, (r0 + r1) / 2, (z0 + z1) / 2) + e.V) / e.V);
  }
  campo.errMax = err;
  return campo;
}

export function potencial(c: CampoE, r: number, z: number): number {
  let s = 0;
  for (let j = 0; j < c.z.length; j++) s += c.q[j] * nucleo(r, z, c.z[j]);
  return s;
}
/** ∇φ en (r, z) — E = −∇φ (V/mm). */
export function gradiente(c: CampoE, r: number, z: number): [number, number] {
  let gr = 0, gz = 0;
  for (let j = 0; j < c.z.length; j++) {
    const zj = c.z[j], d1z = z - zj, d2z = z + zj;
    const d1 = Math.pow(r * r + d1z * d1z, 1.5), d2 = Math.pow(r * r + d2z * d2z, 1.5);
    gr += c.q[j] * (-r / d1 + r / d2);
    gz += c.q[j] * (-d1z / d1 + d2z / d2);
  }
  return [gr, gz];
}
export const magE = (c: CampoE, r: number, z: number) => Math.hypot(...gradiente(c, r, z));

/** ¿el punto está dentro del electrodo? */
function dentro(e: Electrodo, r: number, z: number): boolean {
  const rw = e.rw ?? RW * 1e3, sxy = 1 / Math.sqrt(e.sz), cz = e.zw - e.a * e.sz;
  if (z >= e.zw && r <= rw) return true;
  const u = r / (e.a * sxy), w = (z - cz) / (e.a * e.sz);
  return u * u + w * w <= 1;
}

/** Líneas de E en el semiplano r ≥ 0: nacen en el electrodo y siguen el campo hasta la placa (o salen del cuadro). */
export function lineasE(c: CampoE, rMax = 6, zMax?: number, densidad = 1): Array<Array<[number, number]>> {
  const e = c.e, rw = e.rw ?? RW * 1e3, sxy = 1 / Math.sqrt(e.sz), cz = e.zw - e.a * e.sz;
  const zTop = zMax ?? e.zw + 5;
  const semillas: [number, number][] = [];
  const nG = Math.round(7 * densidad), nW = Math.round(3 * densidad);
  for (let k = 0; k < nG; k++) {   // de la punta (θ = π) al cuello (θ = 0.4π)
    const th = Math.PI - (0.6 * Math.PI * k) / Math.max(1, nG - 1);
    semillas.push([e.a * sxy * Math.sin(th) + 0.02, cz + e.a * e.sz * Math.cos(th) - (th > 0.95 * Math.PI ? 0.03 : 0)]);
  }
  for (let k = 0; k < nW; k++) semillas.push([rw + 0.03, e.zw + 0.4 + (2.4 * k) / Math.max(1, nW - 1)]);
  const lineas: Array<Array<[number, number]>> = [];
  for (const [r0, z0] of semillas) {
    let r = r0, z = z0;
    const pts: Array<[number, number]> = [[r, z]];
    for (let n = 0; n < 900; n++) {
      // RK2 sobre la dirección de ∇φ (de −V hacia 0 V: del electrodo a la placa)
      const h = 0.025 + 0.05 * Math.min(1, Math.hypot(r, z - cz) / 3);
      const [g1r, g1z] = gradiente(c, r, z); const m1 = Math.hypot(g1r, g1z) || 1;
      const rm = r + (h / 2) * (g1r / m1), zm = z + (h / 2) * (g1z / m1);
      const [g2r, g2z] = gradiente(c, Math.abs(rm), zm); const m2 = Math.hypot(g2r, g2z) || 1;
      r = Math.abs(r + h * (g2r / m2)); z = z + h * (g2z / m2);
      if (z <= 0) { pts.push([r, 0]); break; }
      pts.push([r, z]);
      if (r > rMax || z > zTop || dentro(e, r, z)) break;
    }
    lineas.push(pts);
  }
  return lineas;
}

/** Equipotenciales por cuadrados marchantes en r ∈ [0, rMax], z ∈ [0, zMax]: segmentos [r1, z1, r2, z2]. */
export function equipotenciales(c: CampoE, niveles: number[], rMax = 6, zMax?: number, paso = 0.12): number[] {
  const e = c.e, zTop = zMax ?? e.zw + 3;
  const nr = Math.ceil(rMax / paso) + 1, nz = Math.ceil(zTop / paso) + 1;
  const phi = new Float64Array(nr * nz), fuera = new Uint8Array(nr * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
    const r = i * paso, z = j * paso;
    phi[j * nr + i] = potencial(c, r, z);
    fuera[j * nr + i] = dentro(e, r, z) ? 0 : 1;
  }
  const seg: number[] = [];
  const interp = (i0: number, j0: number, i1: number, j1: number, lv: number): [number, number] => {
    const p0 = phi[j0 * nr + i0], p1 = phi[j1 * nr + i1];
    const t = Math.abs(p1 - p0) < 1e-12 ? 0.5 : (lv - p0) / (p1 - p0);
    return [(i0 + t * (i1 - i0)) * paso, (j0 + t * (j1 - j0)) * paso];
  };
  for (const lv of niveles) {
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nr - 1; i++) {
      if (!(fuera[j * nr + i] && fuera[j * nr + i + 1] && fuera[(j + 1) * nr + i] && fuera[(j + 1) * nr + i + 1])) continue;
      const a = phi[j * nr + i] > lv ? 1 : 0, b = phi[j * nr + i + 1] > lv ? 2 : 0;
      const cc = phi[(j + 1) * nr + i + 1] > lv ? 4 : 0, d = phi[(j + 1) * nr + i] > lv ? 8 : 0;
      const k = a | b | cc | d;
      if (k === 0 || k === 15) continue;
      // bordes: 0 abajo (i,j)-(i+1,j) · 1 derecha (i+1,j)-(i+1,j+1) · 2 arriba (i,j+1)-(i+1,j+1) · 3 izquierda (i,j)-(i,j+1)
      const borde = (n: number) => n === 0 ? interp(i, j, i + 1, j, lv) : n === 1 ? interp(i + 1, j, i + 1, j + 1, lv)
        : n === 2 ? interp(i, j + 1, i + 1, j + 1, lv) : interp(i, j, i, j + 1, lv);
      const pares: Record<number, number[][]> = {
        1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 2], [0, 1]], 6: [[0, 2]], 7: [[3, 2]],
        8: [[2, 3]], 9: [[0, 2]], 10: [[0, 3], [1, 2]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[0, 3]],
      };
      for (const [u, w] of pares[k]) { const p = borde(u), q2 = borde(w); seg.push(p[0], p[1], q2[0], q2[1]); }
    }
  }
  return seg;
}
