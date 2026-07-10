/**
 * tool-stress.test.ts — el estudio de esfuerzo REPRODUCE la saga CNC real
 * (2026-07-09: Hurco '98, 304L, muesca a 90°). PURO: sin OCCT ni three.
 * Cada corte que tronó una herramienta debe salir señalado ANTES de cortar;
 * la receta que "se lo llevó como mantequilla" debe salir limpia.
 * Más invariantes de la física (unidades, monotonía, ley del voladizo al cubo).
 */
import { describe, it, expect } from 'vitest';
import { toolStress, cutKinematics, MATERIALES, type Herramienta, type Corte } from './tool-stress';

const inox = MATERIALES['inox-304'];

// Las herramientas de la saga
const insertos1in: Herramienta = { d: 25.4, z: 2, voladizo: 45, tipo: 'insertos' };
const fresa10: Herramienta = { d: 10, z: 4, voladizo: 35, tipo: 'entera' };
const nacro12: Herramienta = { d: 12.7, z: 4, voladizo: 25, tipo: 'entera' };

describe('cinemática exacta (las fórmulas del pizarrón)', () => {
  it('Vc = π·D·n/1000', () => {
    expect(cutKinematics(insertos1in, { rpm: 1500, vf: 300, ap: 2, ae: 5 }).vc).toBeCloseTo((Math.PI * 25.4 * 1500) / 1000, 6);
  });
  it('fz = vf/(z·n) y adelgazamiento hm = fz·√(ae/D)', () => {
    const k = cutKinematics(fresa10, { rpm: 2800, vf: 450, ap: 3, ae: 2.5 }, );
    expect(k.fz).toBeCloseTo(450 / (4 * 2800), 6);
    expect(k.hm).toBeCloseTo(k.fz * Math.sqrt(2.5 / 10), 6);
  });
});

describe('LA SAGA — cada muerte era predecible', () => {
  it('preset default de Fusion (1 rpm, fz=12.7mm): PELIGRO bocado-gordo', () => {
    const e = toolStress(insertos1in, { rpm: 1, vf: 25.4, ap: 0.6, ae: 12 }, inox);
    expect(e.fz).toBeCloseTo(12.7, 3);
    expect(e.ok).toBe(false);
    expect(e.veredictos.some((v) => v.clave === 'bocado-gordo' && v.nivel === 'peligro')).toBe(true);
    expect(e.veredictos.some((v) => v.clave === 'vc-baja')).toBe(true); // 0.08 m/min: pegado garantizado
  });

  it('fresa 10mm que TRONÓ (2800/450, OL 2): chip real 18µm = roza en 304L', () => {
    const e = toolStress(fresa10, { rpm: 2800, vf: 450, ap: 3, ae: 2 }, inox);
    expect(e.hm).toBeLessThan(0.02);            // el bocado que "se veía pequeño"
    expect(e.veredictos.some((v) => v.clave === 'roza')).toBe(true); // el aviso que faltó
  });

  it('la MISMA fresa con OL 4 (el fix): sale del rango de roce fuerte', () => {
    const e = toolStress(fresa10, { rpm: 2800, vf: 450, ap: 3, ae: 4 }, inox);
    expect(e.hm).toBeGreaterThan(0.02);
    expect(e.veredictos.filter((v) => v.clave === 'roza' && v.nivel === 'peligro')).toHaveLength(0);
  });

  it('insertos 2 dientes en 304L: aviso de GRADO (la lección cara del día)', () => {
    const e = toolStress(insertos1in, { rpm: 1200, vf: 310, ap: 2, ae: 5 }, inox);
    expect(e.veredictos.some((v) => v.clave === 'grado-interrumpido')).toBe(true);
    // pero los PARÁMETROS en sí están sanos (por eso "medio aguantó"):
    expect(e.veredictos.filter((v) => v.nivel === 'peligro')).toHaveLength(0);
  });

  it('la receta nACRo que corta MANTEQUILLA (2500/550, ap4, ae4): LIMPIA', () => {
    const e = toolStress(nacro12, { rpm: 2500, vf: 550, ap: 4, ae: 4 }, inox);
    expect(e.ok).toBe(true);
    expect(e.hm).toBeGreaterThan(0.025);         // muerde
    expect(e.vc).toBeGreaterThan(inox.vcMin);
    expect(e.vc).toBeLessThan(inox.vcMax);
    expect(e.fs).toBeGreaterThan(3);             // ni cerca de romperse
    expect(e.deflexionMm).toBeLessThan(0.02);    // ni chatter
  });

  it('PROFUNDO + ANCHO (la regla prohibida): ap 15 × ae 11 en Ø12.7 → truena', () => {
    const largo: Herramienta = { ...nacro12, voladizo: 40 };
    const e = toolStress(largo, { rpm: 2500, vf: 550, ap: 15, ae: 11 }, inox, { potenciaMaxKW: 3.7 });
    expect(e.ok).toBe(false);
    expect(e.veredictos.some((v) => v.clave === 'potencia' && v.nivel === 'peligro')).toBe(true); // pide >3.7kW
    expect(e.veredictos.some((v) => v.clave === 'rompe' || v.clave === 'flexion')).toBe(true);
  });
});

describe('leyes físicas del voladizo (MIT 2.080: viga empotrada)', () => {
  const corte: Corte = { rpm: 2500, vf: 550, ap: 4, ae: 4 };
  it('esfuerzo LINEAL en L, deflexión AL CUBO (doble voladizo = 2× σ, 8× δ)', () => {
    const c = toolStress({ ...nacro12, voladizo: 25 }, corte, inox);
    const l = toolStress({ ...nacro12, voladizo: 50 }, corte, inox);
    expect(l.sigmaMPa / c.sigmaMPa).toBeCloseTo(2, 5);
    expect(l.deflexionMm / c.deflexionMm).toBeCloseTo(8, 5);
  });
  it('kc crece al adelgazar el chip (el castigo de Kienzle por rozar)', () => {
    const gordo = toolStress(fresa10, { rpm: 2800, vf: 600, ap: 3, ae: 5 }, inox);
    const flaco = toolStress(fresa10, { rpm: 2800, vf: 300, ap: 3, ae: 1.5 }, inox);
    expect(flaco.kc).toBeGreaterThan(gordo.kc);
  });
  it('potencia Sandvik: Pc = ap·ae·vf·kc/60e6 (spot check a mano)', () => {
    const e = toolStress(nacro12, corte, inox);
    expect(e.potenciaKW).toBeCloseTo((4 * 4 * 550 * e.kc) / 60e6, 9);
    expect(e.torqueNm).toBeCloseTo((30000 * e.potenciaKW) / (Math.PI * 2500), 9);
  });
  it('el acero del molde (4140/P20) NO endurece: chip marginal solo avisa en inox', () => {
    const corteFlaco: Corte = { rpm: 2800, vf: 450, ap: 3, ae: 2 };
    const enInox = toolStress(fresa10, corteFlaco, inox);
    const en4140 = toolStress(fresa10, { ...corteFlaco, rpm: 2200, vf: 350 }, MATERIALES['acero-4140']);
    expect(enInox.veredictos.some((v) => v.clave === 'roza')).toBe(true);
    expect(en4140.veredictos.some((v) => v.clave === 'roza' && v.nivel === 'peligro')).toBe(false);
  });
});
