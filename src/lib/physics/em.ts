/**
 * Electromagnetism — static & quasi-static fields from point charges and
 * straight current segments. Real SI units, real Coulomb / Biot-Savart.
 *
 * No shortcuts: a 1 C charge produces ~9e9 V/m at 1 m, and that's what
 * the functions return. The UI rescales for visuals.
 */

import { kCoulomb, eps0, mu0 } from './constants';

export type Vec3 = [number, number, number];

export interface PointCharge {
  id: string;
  q: number;              // C
  pos: Vec3;              // m
  color?: string;
}

export interface CurrentSegment {
  id: string;
  I: number;              // A (positive = direction r1 → r2)
  r1: Vec3;
  r2: Vec3;
  color?: string;
}

function sub(a: Vec3, b: Vec3): Vec3 { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function add(a: Vec3, b: Vec3): Vec3 { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function scale(a: Vec3, s: number): Vec3 { return [a[0]*s, a[1]*s, a[2]*s]; }
function norm(a: Vec3): number { return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]); }

/** E field at point r from a set of point charges: E = k Σ q_i (r - r_i)/|r - r_i|³ */
export function fieldE(r: Vec3, charges: PointCharge[], eps = 1e-6): Vec3 {
  let ex = 0, ey = 0, ez = 0;
  for (const c of charges) {
    const dx = r[0] - c.pos[0];
    const dy = r[1] - c.pos[1];
    const dz = r[2] - c.pos[2];
    const r2 = dx*dx + dy*dy + dz*dz + eps*eps;
    const invR3 = 1 / (r2 * Math.sqrt(r2));
    const k = kCoulomb * c.q * invR3;
    ex += k * dx; ey += k * dy; ez += k * dz;
  }
  return [ex, ey, ez];
}

/** Electric potential V (scalar) at point r from charges: V = k Σ q_i / |r - r_i| */
export function potentialV(r: Vec3, charges: PointCharge[], eps = 1e-6): number {
  let V = 0;
  for (const c of charges) {
    const dx = r[0] - c.pos[0];
    const dy = r[1] - c.pos[1];
    const dz = r[2] - c.pos[2];
    const R = Math.sqrt(dx*dx + dy*dy + dz*dz + eps*eps);
    V += kCoulomb * c.q / R;
  }
  return V;
}

/**
 * B field from a finite straight current segment (Biot-Savart, closed form):
 *   B = (μ₀ I / 4π) * (sin θ₂ - sin θ₁) / d  in azimuthal direction around wire
 * where d is perpendicular distance from r to the infinite line extending the segment,
 * and θ₁, θ₂ are angles from r's foot to the segment endpoints.
 *
 * Ref: Griffiths, Intro to Electrodynamics, 4th ed., Eq. 5.36.
 */
export function fieldBFromSegment(r: Vec3, seg: CurrentSegment, eps = 1e-6): Vec3 {
  // misma fórmula de siempre (Griffiths 5.36), ahora en escalares: cero arreglos por llamada (orden 2026-11-05)
  const out = new Float64Array(3);
  sumaSegmentoB(r[0], r[1], r[2], seg.r1[0], seg.r1[1], seg.r1[2], seg.r2[0], seg.r2[1], seg.r2[2], seg.I, eps, 1, out);
  return [out[0], out[1], out[2]];
}

/** Total B from all segments. */
export function fieldB(r: Vec3, segs: CurrentSegment[], eps = 1e-6): Vec3 {
  const out = new Float64Array(3);
  for (const s of segs) sumaSegmentoB(r[0], r[1], r[2], s.r1[0], s.r1[1], s.r1[2], s.r2[0], s.r2[1], s.r2[2], s.I, eps, 1, out);
  return [out[0], out[1], out[2]];
}

/**
 * EL NÚCLEO (escalar, sin memoria): suma a `out` el B de UN segmento recto finito.
 *   B = (µ0·I / 4π) · (sinθ₂ − sinθ₁) / d · (L̂ × r̂⊥)        (Griffiths 5.36, forma cerrada)
 * `unidad` = metros por unidad de las coordenadas (1 si van en m; 1e-3 si van en mm): B sale SIEMPRE en tesla.
 */
function sumaSegmentoB(px: number, py: number, pz: number, ax: number, ay: number, az: number,
  bx: number, by: number, bz: number, I: number, eps: number, unidad: number, out: Float64Array): void {
  let lx = bx - ax, ly = by - ay, lz = bz - az;
  const L = Math.sqrt(lx * lx + ly * ly + lz * lz);
  if (L < eps) return;
  lx /= L; ly /= L; lz /= L;
  const rx = px - ax, ry = py - ay, rz = pz - az;
  const t = rx * lx + ry * ly + rz * lz;
  const qx = rx - t * lx, qy = ry - t * ly, qz = rz - t * lz;          // r⊥ (del pie a r)
  const d2 = qx * qx + qy * qy + qz * qz + eps * eps;
  const s1 = -t / Math.sqrt(t * t + d2), s2 = (L - t) / Math.sqrt((L - t) * (L - t) + d2);
  const k = (mu0 * I / (4 * Math.PI)) * (s2 - s1) / (d2 * unidad);     // |L̂ × r⊥| = d → B = k·(L̂ × r⊥)
  out[0] += k * (ly * qz - lz * qy);
  out[1] += k * (lz * qx - lx * qz);
  out[2] += k * (lx * qy - ly * qx);
}

/**
 * Trace a field line through the E field, walking with adaptive steps.
 * Forward and backward integrate so the line passes through the seed.
 */
export function traceFieldLine(
  seed: Vec3,
  charges: PointCharge[],
  opts: { stepLen?: number; maxSteps?: number; stopRadius?: number } = {},
): Vec3[] {
  const stepLen = opts.stepLen ?? 0.05;
  const maxSteps = opts.maxSteps ?? 400;
  const stopR    = opts.stopRadius ?? 0.02;
  const points: Vec3[] = [seed];
  // Walk in both +E and -E directions
  for (const sign of [1, -1] as const) {
    let p = seed;
    for (let i = 0; i < maxSteps; i++) {
      const E = fieldE(p, charges);
      const e = norm(E);
      if (e < 1e-10) break;
      p = [
        p[0] + sign * stepLen * E[0] / e,
        p[1] + sign * stepLen * E[1] / e,
        p[2] + sign * stepLen * E[2] / e,
      ];
      let tooClose = false;
      for (const c of charges) {
        if (norm(sub(p, c.pos)) < stopR) { tooClose = true; break; }
      }
      if (sign === 1) points.push(p);
      else points.unshift(p);
      if (tooClose) break;
    }
  }
  return points;
}

/** Lorentz force F = q(E + v × B) → advance a test particle with RK4 sub-steps. */
export interface TestParticle {
  q: number;            // C
  m: number;            // kg
  pos: Vec3;
  vel: Vec3;
}

export function lorentzStep(
  p: TestParticle,
  charges: PointCharge[],
  segs: CurrentSegment[],
  dt: number,
  bgB: Vec3 = [0, 0, 0],
): void {
  // Leapfrog/Boris would be ideal; RK4 is adequate for short demos.
  const accel = (pos: Vec3, vel: Vec3): Vec3 => {
    const E = fieldE(pos, charges);
    const Bseg = fieldB(pos, segs);
    const B: Vec3 = [Bseg[0] + bgB[0], Bseg[1] + bgB[1], Bseg[2] + bgB[2]];
    const vxB = cross(vel, B);
    return [
      (p.q / p.m) * (E[0] + vxB[0]),
      (p.q / p.m) * (E[1] + vxB[1]),
      (p.q / p.m) * (E[2] + vxB[2]),
    ];
  };
  const x0 = p.pos, v0 = p.vel;
  const a1 = accel(x0, v0);
  const x1 = add(x0, scale(v0, dt/2));
  const v1 = add(v0, scale(a1, dt/2));
  const a2 = accel(x1, v1);
  const x2 = add(x0, scale(v1, dt/2));
  const v2 = add(v0, scale(a2, dt/2));
  const a3 = accel(x2, v2);
  const x3 = add(x0, scale(v2, dt));
  const v3 = add(v0, scale(a3, dt));
  const a4 = accel(x3, v3);

  p.pos = [
    x0[0] + dt * (v0[0] + 2*v1[0] + 2*v2[0] + v3[0]) / 6,
    x0[1] + dt * (v0[1] + 2*v1[1] + 2*v2[1] + v3[1]) / 6,
    x0[2] + dt * (v0[2] + 2*v1[2] + 2*v2[2] + v3[2]) / 6,
  ];
  p.vel = [
    v0[0] + dt * (a1[0] + 2*a2[0] + 2*a3[0] + a4[0]) / 6,
    v0[1] + dt * (a1[1] + 2*a2[1] + 2*a3[1] + a4[1]) / 6,
    v0[2] + dt * (a1[2] + 2*a2[2] + 2*a3[2] + a4[2]) / 6,
  ];
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// MOTOR DE CAMPOS v2 (orden 2026-11-05-campos-reales-banco-v2) — campos REALES de una geometría de
// corriente, rápidos: segmentos empacados en un Float64Array (8 números c/u), cero memoria por evaluación,
// y LÍNEAS DE B trazadas con RK4 de paso adaptado a la curvatura, con |B| real en cada vértice.
// Clave para que sea liviano: en un circuito en serie TODA la corriente es la misma, así que B = I·B₁(r):
// las líneas se trazan UNA vez con I = 1 A y el visor solo multiplica por I(t).
// ════════════════════════════════════════════════════════════════════════════════════════════════

/** Segmentos empacados: por segmento [ax, ay, az, bx, by, bz, I, 0]; coordenadas en `unidad` metros. */
export interface SegmentosB { n: number; d: Float64Array; unidad: number }

export function empacarSegmentos(segs: Array<{ a: Vec3; b: Vec3; I: number }>, unidad = 1): SegmentosB {
  const d = new Float64Array(segs.length * 8);
  segs.forEach((s, i) => { d.set([s.a[0], s.a[1], s.a[2], s.b[0], s.b[1], s.b[2], s.I, 0], i * 8); });
  return { n: segs.length, d, unidad };
}
/** Polilíneas → segmentos con la misma corriente (un lazo en serie). */
export function segmentosDePolilineas(polis: Vec3[][], I = 1, unidad = 1): SegmentosB {
  const segs: Array<{ a: Vec3; b: Vec3; I: number }> = [];
  for (const p of polis) for (let i = 1; i < p.length; i++) segs.push({ a: p[i - 1], b: p[i], I });
  return empacarSegmentos(segs, unidad);
}

/** B (T) en (x, y, z) — escribe en `out` (largo ≥ 3). La ruta rápida: sin arreglos nuevos. */
export function campoB(S: SegmentosB, x: number, y: number, z: number, out: Float64Array, eps = 1e-9): Float64Array {
  out[0] = 0; out[1] = 0; out[2] = 0;
  const d = S.d;
  for (let i = 0, o = 0; i < S.n; i++, o += 8)
    sumaSegmentoB(x, y, z, d[o], d[o + 1], d[o + 2], d[o + 3], d[o + 4], d[o + 5], d[o + 6], eps * (S.unidad === 1 ? 1 : 1 / S.unidad), S.unidad, out);
  return out;
}

export interface OpcionesLineaB {
  hMin?: number; hMax?: number;      // paso mínimo / máximo (unidades de las coordenadas)
  maxPasos?: number;
  caja?: [Vec3, Vec3];               // se corta al salir
  rDentro?: number;                  // se corta si se acerca más que esto a un conductor (unidades)
}
export interface LineaB { pos: Float32Array; mag: Float32Array; n: number; cerrada: boolean }

/** Distancia mínima del punto a los segmentos (para no meterse en el cobre). */
function distConductor(S: SegmentosB, x: number, y: number, z: number): number {
  let m = Infinity; const d = S.d;
  for (let i = 0, o = 0; i < S.n; i++, o += 8) {
    const ax = d[o], ay = d[o + 1], az = d[o + 2], lx = d[o + 3] - ax, ly = d[o + 4] - ay, lz = d[o + 5] - az;
    const LL = lx * lx + ly * ly + lz * lz || 1e-30;
    let t = ((x - ax) * lx + (y - ay) * ly + (z - az) * lz) / LL; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - ax - t * lx, dy = y - ay - t * ly, dz = z - az - t * lz;
    const q = dx * dx + dy * dy + dz * dz; if (q < m) m = q;
  }
  return Math.sqrt(m);
}

/**
 * Traza UNA línea de B desde `semilla` en el sentido de B. RK4 sobre el campo de dirección (B/|B|) con paso
 * adaptado: el paso es ~1/12 de la distancia al conductor más cercano (alrededor de un cable recto la línea es
 * un círculo de ese radio → ~75 pasos por vuelta). Se detiene al CERRARSE (vuelve a la semilla), al salir de la
 * caja, al acercarse al cobre o al agotar pasos. Guarda |B| (T) en cada vértice.
 */
export function trazarLineaB(S: SegmentosB, semilla: Vec3, o: OpcionesLineaB = {}): LineaB {
  const hMin = o.hMin ?? 1e-4, hMax = o.hMax ?? 0.05, maxP = o.maxPasos ?? 600;
  const caja = o.caja, rIn = o.rDentro ?? 0;
  const pos = new Float32Array((maxP + 1) * 3), mag = new Float32Array(maxP + 1);
  const b = new Float64Array(3);
  let x = semilla[0], y = semilla[1], z = semilla[2];
  const dir = (px: number, py: number, pz: number, k: Float64Array) => {
    campoB(S, px, py, pz, b);
    const m = Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]) || 1e-30;
    k[0] = b[0] / m; k[1] = b[1] / m; k[2] = b[2] / m; return m;
  };
  const k1 = new Float64Array(3), k2 = new Float64Array(3), k3 = new Float64Array(3), k4 = new Float64Array(3);
  let n = 0, recorrido = 0, cerrada = false;
  pos[0] = x; pos[1] = y; pos[2] = z; mag[0] = dir(x, y, z, k1); n = 1;
  for (let i = 0; i < maxP; i++) {
    const dc = distConductor(S, x, y, z);
    if (rIn > 0 && dc < rIn) break;
    const h = Math.min(hMax, Math.max(hMin, dc / 12));
    dir(x, y, z, k1);
    dir(x + 0.5 * h * k1[0], y + 0.5 * h * k1[1], z + 0.5 * h * k1[2], k2);
    dir(x + 0.5 * h * k2[0], y + 0.5 * h * k2[1], z + 0.5 * h * k2[2], k3);
    dir(x + h * k3[0], y + h * k3[1], z + h * k3[2], k4);
    x += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    z += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    recorrido += h;
    pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; mag[n] = dir(x, y, z, k1); n++;
    if (caja && (x < caja[0][0] || y < caja[0][1] || z < caja[0][2] || x > caja[1][0] || y > caja[1][1] || z > caja[1][2])) break;
    // se cerró: volvió a la semilla tras recorrer más de 8 pasos
    const ds = Math.hypot(x - semilla[0], y - semilla[1], z - semilla[2]);
    if (recorrido > 8 * h && ds < 0.75 * h) { pos[n * 3] = semilla[0]; pos[n * 3 + 1] = semilla[1]; pos[n * 3 + 2] = semilla[2]; mag[n] = mag[0]; n++; cerrada = true; break; }
  }
  return { pos: pos.subarray(0, n * 3), mag: mag.subarray(0, n), n, cerrada };
}

/**
 * Semillas alrededor de conductores: estaciones cada `cada` a lo largo de las polilíneas y, en cada una, un punto
 * a cada radio de `radios`, girando por el ángulo áureo (reparto parejo sin patrón). Devuelve Float64Array xyz.
 */
export function semillasAlrededor(polis: Vec3[][], cada: number, radios: number[]): Float64Array {
  const out: number[] = []; let k = 0; const AUREO = Math.PI * (3 - Math.sqrt(5));
  for (const p of polis) {
    let falta = cada / 2;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b2 = p[i];
      const tx = b2[0] - a[0], ty = b2[1] - a[1], tz = b2[2] - a[2], L = Math.hypot(tx, ty, tz);
      if (L < 1e-12) continue;
      const ux = tx / L, uy = ty / L, uz = tz / L;
      // base ortonormal del plano perpendicular al tramo
      let vx = -uy, vy = ux, vz = 0; if (Math.abs(uz) > 0.9) { vx = 0; vy = -uz; vz = uy; }
      const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
      const wx = uy * vz - uz * vy, wy = uz * vx - ux * vz, wz = ux * vy - uy * vx;
      let s = falta;
      while (s <= L) {
        const cx = a[0] + ux * s, cy = a[1] + uy * s, cz = a[2] + uz * s;
        for (const r of radios) {
          const th = (k++) * AUREO;
          out.push(cx + r * (Math.cos(th) * vx + Math.sin(th) * wx), cy + r * (Math.cos(th) * vy + Math.sin(th) * wy), cz + r * (Math.cos(th) * vz + Math.sin(th) * wz));
        }
        s += cada;
      }
      falta = s - L;
    }
  }
  return Float64Array.from(out);
}

/** Muchas líneas de una vez (lo que corre el worker): todo concatenado, listo para un solo draw call. */
export interface PaqueteLineasB { pos: Float32Array; mag: Float32Array; inicio: Uint32Array; cuenta: Uint32Array; cerradas: number; ms: number }
export function trazarLineasB(S: SegmentosB, semillas: Float64Array, o: OpcionesLineaB = {}): PaqueteLineasB {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const lineas: LineaB[] = []; let total = 0, cerradas = 0;
  for (let i = 0; i < semillas.length; i += 3) {
    const L = trazarLineaB(S, [semillas[i], semillas[i + 1], semillas[i + 2]], o);
    if (L.n < 4) continue;
    lineas.push(L); total += L.n; if (L.cerrada) cerradas++;
  }
  const pos = new Float32Array(total * 3), mag = new Float32Array(total);
  const inicio = new Uint32Array(lineas.length), cuenta = new Uint32Array(lineas.length);
  let v = 0;
  lineas.forEach((L, j) => { inicio[j] = v; cuenta[j] = L.n; pos.set(L.pos, v * 3); mag.set(L.mag, v); v += L.n; });
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { pos, mag, inicio, cuenta, cerradas, ms };
}
