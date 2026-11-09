/**
 * EL CONTRATO SE REVISA A SÍ MISMO (orden 2026-11-06-laboratorio-ronda2)
 * Antes de lanzar a los tres agentes: cada puerto donde su dueño lo puede poner, las bahías sin encimarse, cada
 * conexión a puertos que existen, y los cambios de la ronda 2 de verdad aplicados.
 */
import { describe, it, expect } from 'vitest';
import {
  BAHIAS, PUERTOS, CONEXIONES, REGLAS, RIEL, CAMBIOS_R2, DECISIONES, CONTRATO_RONDA,
  bahia, puerto, dentro, enBahia, traslape, type Caja, type Puerto, type Bahia,
} from '../laboratorio-contrato';

const EPS = 1e-6;
/** caras de la caja donde cae p, con su normal hacia afuera */
function caras(p: Puerto['pos'], c: Caja): [number, number, number][] {
  const n: [number, number, number][] = [];
  if (!dentro(p, c, EPS)) return n;
  if (Math.abs(p[0] - c.x0) < EPS) n.push([-1, 0, 0]);
  if (Math.abs(p[0] - c.x1) < EPS) n.push([1, 0, 0]);
  if (Math.abs(p[1] - c.y0) < EPS) n.push([0, -1, 0]);
  if (Math.abs(p[1] - c.y1) < EPS) n.push([0, 1, 0]);
  if (Math.abs(p[2] - c.z0) < EPS) n.push([0, 0, -1]);
  if (Math.abs(p[2] - c.z1) < EPS) n.push([0, 0, 1]);
  return n;
}
const igual = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);
const cedido = (b: Bahia) => (b.cede ?? []).reduce((s, c) => s + traslape(c, b.caja), 0);

describe('el contrato del laboratorio (ronda 2)', () => {
  it('es la ronda 2', () => {
    expect(CONTRATO_RONDA).toBe(2);
  });

  it('cada puerto vive donde su dueño lo puede poner, mirando hacia afuera', () => {
    const malos: string[] = [];
    for (const p of PUERTOS) {
      const b = BAHIAS.find((x) => x.id === p.modulo);
      if (!b) { malos.push(`${p.id}: no hay bahía ${p.modulo}`); continue; }
      if (!enBahia(p.pos, b, EPS)) { malos.push(`${p.id}: fuera de ${b.id} o dentro de lo que cede`); continue; }
      // B rutea: un componente suyo puede tener su puerto adentro. Entre dueños distintos, en una cara y hacia afuera.
      if (b.duenio === 'B' && caras(p.pos, b.caja).length === 0) continue;
      if (!caras(p.pos, b.caja).some((n) => igual(n, p.dir))) malos.push(`${p.id}: dir ${p.dir} no es la normal de una cara de ${b.id}`);
    }
    expect(malos).toEqual([]);
  });

  it('las bahías no se enciman (la BASE es el envolvente; lo cedido no cuenta)', () => {
    const malos: string[] = [];
    const resto = BAHIAS.filter((b) => b.id !== 'BASE');
    for (let i = 0; i < resto.length; i++) for (let j = i + 1; j < resto.length; j++) {
      const [a, b] = [resto[i], resto[j]];
      let v = traslape(a.caja, b.caja);
      for (const c of [...(a.cede ?? []), ...(b.cede ?? [])]) v -= Math.min(traslape(c, a.caja), traslape(c, b.caja));
      if (v > EPS) malos.push(`${a.id} × ${b.id}: ${v.toFixed(0)} mm³`);
    }
    expect(malos).toEqual([]);
  });

  it('lo de adentro de la base cabe en la base', () => {
    const base = bahia('BASE').caja;
    for (const id of ['LRS', 'PLACA_PCB', 'DIFUSOR', 'VENTILADOR', 'IEC', 'PARO']) {
      const c = bahia(id).caja;
      expect(dentro([c.x0, c.y0, c.z0], base) && dentro([c.x1, c.y1, c.z1], base), id).toBe(true);
    }
  });

  it('lo que una bahía cede está dentro de ella y otra bahía lo toma', () => {
    for (const b of BAHIAS) for (const c of b.cede ?? []) {
      expect(traslape(c, b.caja)).toBeCloseTo((c.x1 - c.x0) * (c.y1 - c.y0) * (c.z1 - c.z0), 6);
      expect(BAHIAS.some((o) => o.id !== b.id && traslape(o.caja, c) > 0), `${b.id} cede a nadie`).toBe(true);
    }
    expect(cedido(bahia('PLACA_PCB'))).toBe(23 * 110 * 95);
  });

  it('cada conexión va de un puerto que existe a otro; los puentes son cortos', () => {
    for (const k of CONEXIONES) {
      expect(() => puerto(k.de), `${k.id}.de`).not.toThrow();
      expect(() => puerto(k.a), `${k.id}.a`).not.toThrow();
      if (k.puente) {
        const [a, b] = [puerto(k.de).pos, puerto(k.a).pos];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), `${k.id} puente`).toBeLessThan(150);
      }
    }
    expect(new Set(CONEXIONES.map((k) => k.id)).size).toBe(CONEXIONES.length);
    expect(new Set(PUERTOS.map((p) => p.id)).size).toBe(PUERTOS.length);
  });

  it('el lazo del arco: K05 y K06 salen juntos y viven en el mismo plano x', () => {
    const [p, n, m, a] = ['C.OUTP', 'C.OUTN', 'MARCO', 'A.POT'].map((id) => puerto(id).pos);
    expect(Math.hypot(p[0] - n[0], p[1] - n[1], p[2] - n[2])).toBeLessThanOrEqual(REGLAS.lazoArco.sepMaxMm);
    expect(igual(puerto('C.OUTP').dir, puerto('C.OUTN').dir)).toBe(true);
    expect(m[0]).toBe(p[0]);
    expect(a[0]).toBe(p[0]);
  });

  it('los cambios de la ronda 2 están aplicados', () => {
    expect(bahia('COLUMNA').caja.y1 - bahia('COLUMNA').caja.y0).toBe(80);                     // P3
    expect(bahia('BASE').caja.y1).toBe(bahia('COLUMNA').caja.y1);                              // O1: el pie apoya completo
    expect(bahia('IEC').caja.y1).toBe(bahia('BASE').caja.y1);                                  // O1: el IEC en la pared
    expect(puerto('A.POT').pos[2]).toBe(210);                                                  // A1
    expect(puerto('C.PARO').pos).toEqual([85, -85, -50]);                                      // P4
    expect(CONEXIONES.find((k) => k.id === 'K09')!.puente).toBe(true);                         // P2
    expect(bahia('PLACA_PCB').caja.z1).toBe(-26);                                              // P7
    expect(CONEXIONES.find((k) => k.id === 'K07')!.V).toBe(12);                                // C1
    for (const id of ['K11', 'K12', 'K13', 'K14']) expect(CONEXIONES.some((k) => k.id === id), id).toBe(true);  // P6 · A2
    expect(REGLAS.capturaHumoMin).toBe(0.5);                                                   // P5
    // la campana: más cerca del arco que la boca al pie de la columna
    const c = bahia('CAMPANA').caja;
    expect(c.y0).toBeLessThan(bahia('COLUMNA').caja.y0);
    expect(new Set(CAMBIOS_R2.map((x) => x.id)).size).toBe(CAMBIOS_R2.length);
    expect(DECISIONES.length).toBeGreaterThan(0);
  });

  it('la campana no se mete a la mesa ni al módulo del alambre', () => {
    const c = bahia('CAMPANA').caja;
    expect(c.z1).toBeLessThanOrEqual(bahia('ALAMBRE').caja.z0);
    expect(c.y0).toBeGreaterThanOrEqual(96);      // paredes del ducto de la mesa en y = ±92…96 (cuerpo.ts MESA_G.lado + 4)
  });

  it('las ventanas del riel caben en la cara de la columna', () => {
    const col = bahia('COLUMNA').caja;
    for (const w of RIEL.ventanas) {
      const p = puerto(w.puerto).pos;
      expect(p[0] - w.ancho / 2, w.puerto).toBeGreaterThanOrEqual(col.x0);
      expect(p[0] + w.ancho / 2, w.puerto).toBeLessThanOrEqual(col.x1);
      expect(p[2] + w.alto / 2, w.puerto).toBeLessThanOrEqual(col.z1);
      expect(p[1]).toBe(col.y0);
    }
  });

  it('caza un contrato sembrado con errores', () => {
    const mal: Puerto = { id: 'X', modulo: 'PLACA_PCB', pos: [-110, -40, -60], dir: [-1, 0, 0] };   // dentro de lo cedido al difusor
    expect(enBahia(mal.pos, bahia('PLACA_PCB'))).toBe(false);
    const encimada: Caja = { x0: 80, y0: -100, z0: -60, x1: 100, y1: -80, z1: -30 };              // PLACA_PCB × PARO
    expect(traslape(encimada, bahia('PARO').caja)).toBeGreaterThan(0);
  });
});
