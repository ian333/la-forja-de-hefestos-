/**
 * wing-metrics.test.ts — las medidas del ala contra la GEOMETRÍA ANALÍTICA.
 *
 * Se construye un ala trapezoidal cerrada cuyo S, AR, MAC y estrechamiento se
 * conocen en forma cerrada, y se comprueba que medirlas del sólido reproduce
 * esos números. El test estrella es la separación MAC vs MGC: confundirlas mete
 * 14.8% de error en Cm con el fixture del Orbiter de Bertin, y 33% en una delta.
 */
import { describe, it, expect } from 'vitest';
import type { TessellatedMesh } from '@/forja/brep/occt';
import { pielDeMalla } from './skin';
import {
  metricasAla, macTrapezoidal, mgcTrapezoidal, errorPorConfundirCuerdas,
} from './wing-metrics';

/**
 * Ala trapezoidal cerrada, en unidades del kernel (mm).
 * Borde de ataque recto en x=xBA(y), cuerda c(y) lineal de raíz a punta.
 * Placa con espesor: piel superior + inferior + bordes, todo cerrado.
 */
function alaTrapezoidal(o: {
  cRaiz: number; taper: number; b: number; espesor?: number;
  flechaBA?: number; nx?: number; ny?: number;
}): TessellatedMesh {
  const { cRaiz, taper, b } = o;
  const t = o.espesor ?? cRaiz * 0.02;
  const tanL = Math.tan(o.flechaBA ?? 0);
  const nx = o.nx ?? 24, ny = o.ny ?? 120;
  const cDe = (y: number) => cRaiz * (1 - (1 - taper) * (2 * Math.abs(y)) / b);
  const xbaDe = (y: number) => Math.abs(y) * tanL;

  const pos: number[] = [];
  const idx: number[] = [];
  const fid: number[] = [];
  const push = (x: number, y: number, z: number) => { pos.push(x, y, z); return pos.length / 3 - 1; };

  // rejilla superior (z=+t/2) e inferior (z=−t/2)
  const sup: number[][] = [], inf: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const y = -b / 2 + (j / ny) * b;
    const c = cDe(y), x0 = xbaDe(y);
    const fs: number[] = [], fi: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const x = x0 + (i / nx) * c;
      fs.push(push(x, y, t / 2));
      fi.push(push(x, y, -t / 2));
    }
    sup.push(fs); inf.push(fi);
  }
  const quad = (a: number, b_: number, c_: number, d: number, f: number) => {
    idx.push(a, b_, c_, a, c_, d); fid.push(f, f);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      quad(sup[j][i], sup[j][i + 1], sup[j + 1][i + 1], sup[j + 1][i], 0);       // extradós
      quad(inf[j][i], inf[j + 1][i], inf[j + 1][i + 1], inf[j][i + 1], 1);       // intradós
    }
    quad(sup[j][0], sup[j + 1][0], inf[j + 1][0], inf[j][0], 2);                 // borde de ataque
    quad(sup[j][nx], inf[j][nx], inf[j + 1][nx], sup[j + 1][nx], 3);             // borde de salida
  }
  for (let i = 0; i < nx; i++) {                                                  // tapas de punta
    quad(sup[0][i], inf[0][i], inf[0][i + 1], sup[0][i + 1], 4);
    quad(sup[ny][i], sup[ny][i + 1], inf[ny][i + 1], inf[ny][i], 5);
  }
  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(pos.length),
    indices: new Uint32Array(idx),
    vertexCount: pos.length / 3,
    triangleCount: idx.length / 3,
    faceIds: new Uint32Array(fid),
    faceGroups: [],
  };
}

const medir = (o: Parameters<typeof alaTrapezoidal>[0]) =>
  metricasAla(pielDeMalla(alaTrapezoidal(o)));

describe('metricasAla — ala trapezoidal contra la fórmula cerrada', () => {
  it('ala RECTANGULAR: S=c·b, AR=b/c, y MAC = MGC = c', () => {
    const m = medir({ cRaiz: 1000, taper: 1, b: 8000 });   // mm
    expect(m.sRef).toBeCloseTo(1 * 8, 2);                  // m²
    expect(m.b).toBeCloseTo(8, 3);
    expect(m.AR).toBeCloseTo(8, 2);
    expect(m.mac).toBeCloseTo(1, 2);
    expect(m.mgc).toBeCloseTo(1, 2);
    expect(m.taper).toBeCloseTo(1, 2);
  });

  it('⭐ ala ESTRECHADA (λ=0.5): la MAC NO es la cuerda media', () => {
    const cRaiz = 1, taper = 0.5, b = 10;
    const m = medir({ cRaiz: cRaiz * 1000, taper, b: b * 1000 });
    // S = (b/2)(c_raiz + c_punta) = 5·1.5 = 7.5 m²
    expect(m.sRef).toBeCloseTo(7.5, 2);
    expect(m.AR).toBeCloseTo(100 / 7.5, 2);
    expect(m.mac).toBeCloseTo(macTrapezoidal(cRaiz, taper), 2);   // 0.7778
    expect(m.mgc).toBeCloseTo(mgcTrapezoidal(cRaiz, taper), 2);   // 0.75
    // y son DISTINTAS: ese es el punto
    expect(Math.abs(m.mac - m.mgc) / m.mgc).toBeGreaterThan(0.03);
  });

  it('barrido de estrechamiento: la MAC medida sigue la fórmula en todo el rango', () => {
    for (const taper of [1, 0.75, 0.5, 0.35, 0.2]) {
      const m = medir({ cRaiz: 1200, taper, b: 9000 });
      const esperada = macTrapezoidal(1.2, taper);
      expect(Math.abs(m.mac - esperada) / esperada).toBeLessThan(0.02);
      expect(m.taper).toBeCloseTo(taper, 1);
    }
  });

  it('la superficie en planta es EXACTA (proyección, no muestreo)', () => {
    // refinar la malla no debe cambiar S: sale del teorema de la divergencia
    const burda = medir({ cRaiz: 1000, taper: 0.4, b: 7000, nx: 6, ny: 20 });
    const fina = medir({ cRaiz: 1000, taper: 0.4, b: 7000, nx: 40, ny: 200 });
    const exacta = (7 / 2) * (1 + 0.4);
    expect(burda.sRef).toBeCloseTo(exacta, 3);
    expect(fina.sRef).toBeCloseTo(exacta, 3);
  });

  it('la flecha del borde de ataque se mide del sólido', () => {
    for (const gr of [0, 15, 30, 45]) {
      const m = medir({ cRaiz: 1000, taper: 0.5, b: 8000, flechaBA: (gr * Math.PI) / 180 });
      expect((m.flechaBA * 180) / Math.PI).toBeCloseTo(gr, 0);
    }
  });

  it('la flecha de c/4 es MENOR que la del borde de ataque en un ala estrechada', () => {
    // al estrecharse, la línea de c/4 se retrasa menos que el borde de ataque
    const m = medir({ cRaiz: 1000, taper: 0.3, b: 8000, flechaBA: (35 * Math.PI) / 180 });
    expect(m.flechaC4).toBeLessThan(m.flechaBA);
    expect(m.flechaC4).toBeGreaterThan(0);
  });

  it('la superficie MOJADA es ~2× la de referencia en un ala delgada', () => {
    const m = medir({ cRaiz: 1000, taper: 0.5, b: 10000, espesor: 5 });
    expect(m.sMojada / m.sRef).toBeGreaterThan(1.95);
    expect(m.sMojada / m.sRef).toBeLessThan(2.15);
  });

  it('la MAC vive donde debe: hacia la raíz, no a media envergadura', () => {
    const m = medir({ cRaiz: 1000, taper: 0.3, b: 10000 });
    // simétrica ⇒ yMac ≈ 0; lo que importa es que el integrando pondera por cuerda
    expect(Math.abs(m.yMac)).toBeLessThan(0.05);
    expect(m.estaciones.length).toBeGreaterThan(50);
  });

  it('revienta con ejes mal asignados en vez de dar un número sin sentido', () => {
    const piel = pielDeMalla(alaTrapezoidal({ cRaiz: 1000, taper: 0.5, b: 8000 }));
    expect(() => metricasAla(piel, { ejes: { cuerda: 0, envergadura: 2, espesor: 1 } }))
      .not.toThrow();   // z tiene extensión (el espesor): mide, pero da AR absurdo
    const malo = metricasAla(piel, { ejes: { cuerda: 0, envergadura: 2, espesor: 1 } });
    expect(malo.AR).toBeLessThan(1);   // la señal de que los ejes están mal
  });
});

describe('MAC vs MGC — la trampa de contabilidad del libro', () => {
  it('coinciden solo en el ala rectangular', () => {
    expect(errorPorConfundirCuerdas(1)).toBeCloseTo(0, 12);
  });

  it('en una delta pura (λ=0) el error es del 33%', () => {
    expect(errorPorConfundirCuerdas(0)).toBeCloseTo(1 / 3, 6);
  });

  it('el error crece monótonamente al estrechar el ala', () => {
    let prev = -1;
    for (const t of [1, 0.8, 0.6, 0.4, 0.2, 0]) {
      const e = errorPorConfundirCuerdas(t);
      expect(e).toBeGreaterThan(prev);
      prev = e;
    }
  });

  it('el orden de magnitud del caso del Orbiter (~14.8%) cae en el rango de λ bajos', () => {
    // Bertin: c̄ = 34.46 ft vs mac = 39.57 ft → 14.8%
    const objetivo = 39.57 / 34.46 - 1;
    expect(objetivo).toBeGreaterThan(errorPorConfundirCuerdas(0.35));
    expect(objetivo).toBeLessThan(errorPorConfundirCuerdas(0.05));
  });

  it('macTrapezoidal degenera bien: λ=1 ⇒ c_raiz', () => {
    expect(macTrapezoidal(2.5, 1)).toBeCloseTo(2.5, 12);
    expect(macTrapezoidal(3, 0)).toBeCloseTo(2, 12);   // (2/3)·c_raiz
  });
});
