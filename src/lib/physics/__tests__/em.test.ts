/**
 * Motor de campos v2 (orden 2026-11-05-campos-reales-banco-v2): contra fórmulas cerradas, no contra sí mismo.
 */
import { describe, it, expect } from 'vitest';
import { fieldB, campoB, empacarSegmentos, segmentosDePolilineas, trazarLineaB, trazarLineasB, semillasAlrededor, type Vec3 } from '../em';

const MU0 = 4e-7 * Math.PI;
const B3 = () => new Float64Array(3);
const largo = (I: number, unidad = 1, k = 1) => empacarSegmentos([{ a: [0, 0, -1000 * k], b: [0, 0, 1000 * k], I }], unidad);

describe('motor de campos v2', () => {
  it('alambre recto «infinito»: B = µ0·I/2πr, dirección por la mano derecha', () => {
    const b = campoB(largo(10), 0.01, 0, 0, B3());
    const esperado = MU0 * 10 / (2 * Math.PI * 0.01);
    expect(Math.abs(b[1] - esperado) / esperado).toBeLessThan(1e-3);
    expect(Math.abs(b[0]) + Math.abs(b[2])).toBeLessThan(1e-12);
  });
  it('mismas cuentas en mm (unidad 1e-3): B sigue en tesla', () => {
    const bm = campoB(largo(10), 0.01, 0, 0, B3());
    const bmm = campoB(largo(10, 1e-3, 1000), 10, 0, 0, B3());
    expect(Math.abs(bmm[1] - bm[1]) / bm[1]).toBeLessThan(1e-9);
  });
  it('espira circular: en el centro B = µ0·I/2R', () => {
    const N = 720, R = 0.1, p: Vec3[] = [];
    for (let i = 0; i <= N; i++) p.push([R * Math.cos((2 * Math.PI * i) / N), R * Math.sin((2 * Math.PI * i) / N), 0]);
    const b = campoB(segmentosDePolilineas([p], 1), 0, 0, 0, B3());
    const esperado = MU0 / (2 * R);
    expect(Math.abs(b[2] - esperado) / esperado).toBeLessThan(1e-4);
  });
  it('Ampère: la circulación de B alrededor del conductor es µ0·I', () => {
    const S = largo(7), r = 0.05, N = 720, b = B3(); let circ = 0;
    for (let i = 0; i < N; i++) {
      const th = (2 * Math.PI * (i + 0.5)) / N;
      campoB(S, r * Math.cos(th), r * Math.sin(th), 0, b);
      circ += (b[0] * -Math.sin(th) + b[1] * Math.cos(th)) * ((2 * Math.PI * r) / N);
    }
    expect(Math.abs(circ - MU0 * 7) / (MU0 * 7)).toBeLessThan(1e-3);
  });
  it('la API vieja (fieldB) da lo mismo que la ruta rápida', () => {
    const segs = [{ id: 'a', I: 3, r1: [0.1, -0.2, 0] as Vec3, r2: [0.3, 0.4, 0.2] as Vec3 }, { id: 'b', I: -2, r1: [0, 0, 0] as Vec3, r2: [0, 0.5, 0.1] as Vec3 }];
    const S = empacarSegmentos(segs.map((s) => ({ a: s.r1, b: s.r2, I: s.I })));
    for (const p of [[0.05, 0.1, 0.3], [-0.2, 0.3, -0.1], [0.4, -0.1, 0.05]] as Vec3[]) {
      const v = fieldB(p, segs), w = campoB(S, p[0], p[1], p[2], B3(), 1e-6);
      for (let k = 0; k < 3; k++) expect(Math.abs(v[k] - w[k])).toBeLessThan(1e-12 * Math.max(1e-9, Math.hypot(...v)) + 1e-18);
    }
  });
  it('una línea de B alrededor de un cable recto se CIERRA en un círculo de su radio, con |B| correcto', () => {
    const S = largo(40, 1e-3, 1000);
    const L = trazarLineaB(S, [20, 0, 0], { hMin: 0.01, hMax: 10, maxPasos: 2000 });
    expect(L.cerrada).toBe(true);
    let peor = 0;
    for (let i = 0; i < L.n; i++) peor = Math.max(peor, Math.abs(Math.hypot(L.pos[3 * i], L.pos[3 * i + 1]) - 20) / 20);
    expect(peor).toBeLessThan(5e-3);
    const esperado = MU0 * 40 / (2 * Math.PI * 0.02);
    expect(Math.abs(L.mag[0] - esperado) / esperado).toBeLessThan(2e-3);
  });
  it('rendimiento: evaluaciones de B por segundo y un paquete de líneas', () => {
    const N = 120, p: Vec3[] = [];
    for (let i = 0; i <= N; i++) p.push([300 * Math.cos((2 * Math.PI * i) / N), 200 * Math.sin((2 * Math.PI * i) / N), 20 * Math.sin((6 * Math.PI * i) / N)]);
    const S = segmentosDePolilineas([p], 1, 1e-3), b = B3();
    const t0 = performance.now(); let n = 0;
    while (performance.now() - t0 < 300) { for (let k = 0; k < 200; k++) campoB(S, 10 + k, 5, 3, b); n += 200; }
    const ptsS = n / ((performance.now() - t0) / 1000);
    // ANTES: el código viejo de em.ts (arreglos nuevos en cada sub/cross/scale), copiado aquí tal cual para medirlo
    const sub = (u: Vec3, w: Vec3): Vec3 => [u[0] - w[0], u[1] - w[1], u[2] - w[2]];
    const cross = (u: Vec3, w: Vec3): Vec3 => [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const scale = (u: Vec3, k: number): Vec3 => [u[0] * k, u[1] * k, u[2] * k];
    const norm = (u: Vec3) => Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
    const viejo = (r: Vec3, r1: Vec3, r2: Vec3, I: number, eps = 1e-6): Vec3 => {
      const L = sub(r2, r1), Ll = norm(L); const Lh: Vec3 = [L[0] / Ll, L[1] / Ll, L[2] / Ll]; const a2 = sub(r, r1);
      const tf = a2[0] * Lh[0] + a2[1] * Lh[1] + a2[2] * Lh[2]; const foot: Vec3 = [r1[0] + tf * Lh[0], r1[1] + tf * Lh[1], r1[2] + tf * Lh[2]];
      const perp = sub(r, foot); const d = Math.sqrt(perp[0] ** 2 + perp[1] ** 2 + perp[2] ** 2 + eps * eps);
      const s1 = -tf / Math.sqrt(tf * tf + d * d + eps * eps), s2 = (Ll - tf) / Math.sqrt((Ll - tf) ** 2 + d * d + eps * eps);
      return scale(cross(Lh, scale(perp, 1 / d)), (MU0 * I / (4 * Math.PI * d)) * (s2 - s1));
    };
    const t1 = performance.now(); let m = 0;
    while (performance.now() - t1 < 300) {
      for (let k = 0; k < 50; k++) { let acc: Vec3 = [0, 0, 0]; const r: Vec3 = [0.01 + k * 1e-3, 0.005, 0.003];
        for (let i = 1; i <= N; i++) { const q = viejo(r, [p[i - 1][0] * 1e-3, p[i - 1][1] * 1e-3, p[i - 1][2] * 1e-3], [p[i][0] * 1e-3, p[i][1] * 1e-3, p[i][2] * 1e-3], 1); acc = [acc[0] + q[0], acc[1] + q[1], acc[2] + q[2]]; } }
      m += 50;
    }
    const ptsViejo = m / ((performance.now() - t1) / 1000);
    const sem = semillasAlrededor([p], 60, [9, 18, 36]);
    const pq = trazarLineasB(S, sem, { hMin: 0.5, hMax: 25, maxPasos: 500, rDentro: 3 });
    console.log(`[motor v2] lazo de ${N} segmentos · puntos/s: viejo ${(ptsViejo / 1e3).toFixed(0)} k → nuevo ${(ptsS / 1e3).toFixed(0)} k (×${(ptsS / ptsViejo).toFixed(1)}) = ${(ptsS * N / 1e6).toFixed(1)} M segmento·punto/s · ${sem.length / 3} semillas → ${pq.inicio.length} líneas (${pq.cerradas} cerradas), ${pq.mag.length} vértices en ${pq.ms.toFixed(0)} ms`);
    expect(pq.inicio.length).toBeGreaterThan(0);
  });
});
