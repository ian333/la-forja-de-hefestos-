/**
 * printSim — SIMULACION de impresion 3D de metal por capas (gota a gota).
 *
 * Pipeline real, todo numerico:
 *   toolpath (estilo G-code, por capa) → deposita gotas a una tasa → cada gota
 *   ADHIERE a la de abajo SOLO si esa sigue caliente (T_vecino > T_bond); si ya
 *   se enfrió, la unión es DÉBIL (defecto). Mientras, TODO el cuerpo se enfría
 *   (Newton). Cada gota = un desprendimiento resonante (motor metalDrop).
 *
 * La lección clave emerge sola: rápido = vecino caliente = buena fusión pero
 * acumula calor; lento/dwell largo = se enfría = uniones débiles. Hay un punto.
 */

const T0 = 25;

export interface PrintParams {
  shape: 'pared' | 'tubo' | 'cilindro';
  rate: number;     // gotas/s depositadas
  tauCool: number;  // s, constante de enfriamiento de una gota
  Tdep: number;     // C, temperatura de depósito (~liquidus)
  Tbond: number;    // C, mínimo del vecino para fusión sana
  Tamb: number;     // C, asíntota de enfriamiento = PRECALENTAMIENTO (cama/cámara)
  dwell: number;    // s de espera entre capas
  beadW: number;    // mm, paso entre gotas
  beadH: number;    // mm, altura de capa
  nLayers: number;
}

export interface PrintState {
  t: number; n: number; acc: number; layer: number; dwellLeft: number;
  weakCount: number; total: number; perLayer: number;
  pts: Float32Array; temps: Float32Array; weak: Uint8Array;
}

export const PRINT_DEFAULTS: PrintParams = {
  shape: 'tubo', rate: 70, tauCool: 6, Tdep: 1540, Tbond: 900, Tamb: 25,
  dwell: 0, beadW: 1.0, beadH: 0.8, nLayers: 26,
};

function buildPath(p: PrintParams) {
  const bw = p.beadW;
  const layer: [number, number][] = [];
  if (p.shape === 'pared') {
    const L = 26; for (let i = 0; i < L; i++) layer.push([(i - (L - 1) / 2) * bw, 0]);
  } else if (p.shape === 'tubo') {
    const side = 11, a = (side - 1) * bw / 2;
    for (let i = 0; i < side; i++) layer.push([-a + i * bw, -a]);
    for (let i = 1; i < side; i++) layer.push([a, -a + i * bw]);
    for (let i = 1; i < side; i++) layer.push([a - i * bw, a]);
    for (let i = 1; i < side - 1; i++) layer.push([-a, a - i * bw]);
  } else {
    const R = 6.5 * bw, per = Math.max(10, Math.round(2 * Math.PI * R / bw));
    for (let i = 0; i < per; i++) { const th = 2 * Math.PI * i / per; layer.push([R * Math.cos(th), R * Math.sin(th)]); }
  }
  const per = layer.length, total = per * p.nLayers, pts = new Float32Array(total * 3);
  for (let l = 0; l < p.nLayers; l++) {
    for (let k = 0; k < per; k++) {
      const idx = l * per + k;
      const src = (l % 2 === 0) ? k : (per - 1 - k);  // raster alterna dirección por capa
      pts[idx * 3] = layer[src][0];
      pts[idx * 3 + 1] = l * p.beadH;                  // y = altura
      pts[idx * 3 + 2] = layer[src][1];
    }
  }
  return { pts, per, total };
}

export function printReset(p: PrintParams): PrintState {
  const { pts, per, total } = buildPath(p);
  return {
    t: 0, n: 0, acc: 0, layer: 0, dwellLeft: 0, weakCount: 0,
    total, perLayer: per, pts, temps: new Float32Array(total), weak: new Uint8Array(total),
  };
}

export function printStep(s: PrintState, p: PrintParams, dt: number): PrintState {
  // enfriar todo lo depositado (Newton, Euler)
  const k = Math.min(dt / p.tauCool, 1);
  for (let j = 0; j < s.n; j++) s.temps[j] -= (s.temps[j] - p.Tamb) * k;  // enfría hacia el PRECALENTAMIENTO, no a 25°C
  s.t += dt;
  if (s.dwellLeft > 0) { s.dwellLeft -= dt; return s; }
  s.acc += p.rate * dt;
  while (s.acc >= 1 && s.n < s.total) {
    s.acc -= 1;
    const i = s.n;
    s.temps[i] = p.Tdep;
    const below = i - s.perLayer;                 // gota directamente abajo
    const w = (below >= 0 && s.temps[below] < p.Tbond) ? 1 : 0;  // ¿vecino frío? unión débil
    s.weak[i] = w; if (w) s.weakCount++;
    s.n++;
    const newLayer = Math.floor(i / s.perLayer);
    if (newLayer !== s.layer) { s.layer = newLayer; s.dwellLeft = p.dwell; }
  }
  return s;
}

export function done(s: PrintState) { return s.n >= s.total; }
