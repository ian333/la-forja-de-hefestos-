/**
 * potencial.test.ts — el campo de Joukowski contra la FÍSICA, no contra sí mismo.
 * El test estrella: ∮u·dl en un lazo lejano = Γ de Kutta (teorema de Stokes).
 * Si el campo tuviera un error de signo, rama o jacobiano, esa integral truena.
 */
import { describe, it, expect } from 'vitest';
import {
  JOUKOWSKI_A, U_INF, kuttaGamma, flowVelocity, cpValue,
  integrateStreamline, integrateParcel, circulationIntegral, seedField,
} from './potencial';

const DEG = Math.PI / 180;

describe('flujo potencial de Joukowski', () => {
  it('∮u·dl alrededor del ala = −Γ_Kutta (vórtice ligado HORARIO), error < 1%', () => {
    // El lazo se recorre antihorario; el vórtice que acelera el aire POR
    // ENCIMA gira horario → la integral da −Γ. (Este test cazó el bug del
    // signo del vórtice del lab original: daba ~0.)
    const G = kuttaGamma(8 * DEG);
    const loop = circulationIntegral(8 * DEG, 2.5, 4000);
    expect(Math.abs(loop + G) / G).toBeLessThan(0.01);
  });

  it('con Γ=0 la circulación del lazo es ~0 (flujo sin sustentación)', () => {
    const loop = circulationIntegral(8 * DEG, 2.5, 4000, { gamma: 0 });
    expect(Math.abs(loop)).toBeLessThan(0.01);
  });

  it('condición de Kutta: velocidad FINITA en el borde de salida; con Γ=0 explota ∝ε^(−1/2)', () => {
    const TE = 2 * JOUKOWSKI_A; // borde de salida de la placa (cuerda 4a)
    const probe: [number, number] = [TE + 0.001, 0.0005];
    const [uk, vk] = flowVelocity(probe[0], probe[1], 8 * DEG);
    const [u0, v0] = flowVelocity(probe[0], probe[1], 8 * DEG, { gamma: 0 });
    const magK = Math.hypot(uk, vk), mag0 = Math.hypot(u0, v0);
    expect(magK).toBeLessThan(3 * U_INF);      // Kutta: finita y moderada
    expect(mag0).toBeGreaterThan(2 * magK);    // sin Kutta: el borde dispara |u|
  });

  it('campo lejano → U·e^{+iα} (el freestream SUBE a +α; el marco de la escena rota −α)', () => {
    const [u, v] = flowVelocity(-6, 3, 8 * DEG);
    expect(Math.hypot(u - U_INF * Math.cos(8 * DEG), v - U_INF * Math.sin(8 * DEG))).toBeLessThan(0.04);
  });

  it('sustentación POSITIVA: más rápido por ENCIMA que por debajo (succión arriba)', () => {
    const [x1, y1] = seedField(0, 0.4, 8 * DEG);
    const [x2, y2] = seedField(0, -0.4, 8 * DEG);
    const [ua, va] = flowVelocity(x1, y1, 8 * DEG);
    const [ub, vb] = flowVelocity(x2, y2, 8 * DEG);
    expect(Math.hypot(ua, va)).toBeGreaterThan(Math.hypot(ub, vb) + 0.1);
  });

  it('α=0: simetría arriba/abajo (u par, v impar) y Γ=0', () => {
    const [uT, vT] = flowVelocity(0.3, 0.4, 0);
    const [uB, vB] = flowVelocity(0.3, -0.4, 0);
    expect(uT).toBeCloseTo(uB, 10);
    expect(vT).toBeCloseTo(-vB, 10);
    expect(kuttaGamma(0)).toBeCloseTo(0, 12);
  });

  it('Bernoulli: Cp ≤ 1 en todo el campo muestreado (máx en estancamiento)', () => {
    for (let ix = 0; ix < 20; ix++) {
      for (let iy = 0; iy < 20; iy++) {
        const px = -2 + ix * 0.21, py = -2 + iy * 0.21;
        const [u, v] = flowVelocity(px, py, 10 * DEG);
        if (u === 0 && v === 0) continue; // dentro del cuerpo
        expect(cpValue(u, v)).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('EL MITO, medido: la parcela de ARRIBA llega antes — no se reencuentran', () => {
    // dos parcelas sueltas al mismo tiempo (entrada en coords de PANTALLA,
    // una sobre y una bajo la línea divisoria), convertidas al marco del campo
    const [ux0, uy0] = seedField(-2.5, 0.25, 8 * DEG);
    const [dx0, dy0] = seedField(-2.5, -0.25, 8 * DEG);
    const up = integrateParcel(ux0, uy0, 8 * DEG, 900, 0.01);
    const dn = integrateParcel(dx0, dy0, 8 * DEG, 900, 0.01);
    const cross = (p: { x: number }[]) => p.findIndex(q => q.x > 1.3);
    const iUp = cross(up), iDn = cross(dn);
    expect(iUp).toBeGreaterThan(-1);
    expect(iDn).toBeGreaterThan(-1);
    // la de arriba cruza el borde de salida ANTES (menos pasos = menos tiempo)
    expect(iUp).toBeLessThan(iDn);
    // y cuando la de arriba ya cruzó, la de abajo sigue atrás por una brecha real
    expect(up[iUp].x - dn[iUp].x).toBeGreaterThan(0.1);
  });

  it('línea de corriente: rodea el cuerpo sin morir dentro (>50 puntos, sale del dominio)', () => {
    const line = integrateStreamline(-2.5, 0.3, 8 * DEG, 140, 0.04);
    expect(line.length).toBeGreaterThan(50);
    const last = line[line.length - 1];
    expect(Math.abs(last.x) > 4 || Math.abs(last.y) > 3 || line.length === 140).toBe(true);
  });
});
