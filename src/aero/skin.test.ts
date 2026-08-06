/**
 * skin.test.ts — la piel contra la GEOMETRÍA EXACTA y contra los teoremas.
 *
 * Sin OCCT: se construyen mallas sintéticas cuyo volumen y área se conocen en
 * forma cerrada, y se comprueban los dos invariantes que hacen utilizable una
 * piel para integrar fuerzas:
 *   1. ∮n̂ dS = 0 en un cuerpo cerrado (divergencia de un campo constante)
 *   2. ⅓∮r·n̂ dS = V (teorema de la divergencia) — se cruza contra el volumen exacto
 * Y el corolario que más importa: con Cp CONSTANTE la fuerza es CERO. Un cuerpo
 * no siente la presión ambiente; solo sus diferencias.
 */
import { describe, it, expect } from 'vitest';
import type { TessellatedMesh } from '@/forja/brep/occt';
import {
  pielDeMalla, integrarPresion, porCara, direccionViento, MM_A_M, TOL_CIERRE,
  type ReferenciaAero,
} from './skin';

/** Malla sintética: los quads se dan en orden CCW visto DESDE FUERA. */
function malla(verts: number[][], quads: Array<[number, number, number, number, number]>): TessellatedMesh {
  const positions = new Float32Array(verts.flat());
  const indices: number[] = [];
  const faceIds: number[] = [];
  for (const [a, b, c, d, face] of quads) {
    indices.push(a, b, c, a, c, d);
    faceIds.push(face, face);
  }
  return {
    positions,
    normals: new Float32Array(positions.length),
    indices: new Uint32Array(indices),
    vertexCount: verts.length,
    triangleCount: indices.length / 3,
    faceIds: new Uint32Array(faceIds),
    faceGroups: [],
  };
}

/** Cubo de lado L (unidades del kernel = mm) centrado en el origen. */
function cubo(L = 100): TessellatedMesh {
  const h = L / 2;
  const v = [
    [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], // z = −h
    [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h],     // z = +h
  ];
  return malla(v, [
    [4, 5, 6, 7, 0],  // +z
    [1, 0, 3, 2, 1],  // −z
    [0, 1, 5, 4, 2],  // −y
    [2, 3, 7, 6, 3],  // +y
    [1, 2, 6, 5, 4],  // +x
    [0, 4, 7, 3, 5],  // −x
  ]);
}

/** Esfera de radio R por subdivisión de un octaedro (n niveles). */
function esfera(R = 50, niveles = 4): TessellatedMesh {
  let tris: number[][][] = [];
  const o = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const sx of [0, 1]) for (const sy of [2, 3]) for (const sz of [4, 5]) {
    const t = [o[sx], o[sy], o[sz]];
    // orienta CCW visto desde fuera: el triple producto debe ser positivo
    const d = t[0][0] * (t[1][1] * t[2][2] - t[1][2] * t[2][1])
      - t[0][1] * (t[1][0] * t[2][2] - t[1][2] * t[2][0])
      + t[0][2] * (t[1][0] * t[2][1] - t[1][1] * t[2][0]);
    tris.push(d > 0 ? t : [t[0], t[2], t[1]]);
  }
  const mid = (a: number[], b: number[]) => {
    const m = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const n = Math.hypot(m[0], m[1], m[2]);
    return [m[0] / n, m[1] / n, m[2] / n];
  };
  for (let k = 0; k < niveles; k++) {
    const out: number[][][] = [];
    for (const [a, b, c] of tris) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      out.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    tris = out;
  }
  const positions: number[] = [], indices: number[] = [], faceIds: number[] = [];
  tris.forEach((t, i) => {
    for (const p of t) positions.push(p[0] * R, p[1] * R, p[2] * R);
    indices.push(3 * i, 3 * i + 1, 3 * i + 2);
    faceIds.push(0);
  });
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(positions.length),
    indices: new Uint32Array(indices),
    vertexCount: positions.length / 3,
    triangleCount: tris.length,
    faceIds: new Uint32Array(faceIds),
    faceGroups: [],
  };
}

const REF = (sRef: number): ReferenciaAero =>
  ({ sRef, cRef: 0.1, puntoMomento: [0, 0, 0], alpha: 0 });

describe('pielDeMalla — geometría exacta', () => {
  it('cubo de 100 mm: área 6L², volumen L³, y CIERRA', () => {
    const p = pielDeMalla(cubo(100));
    const L = 0.1; // 100 mm en metros
    expect(p.paneles).toHaveLength(12);
    expect(p.areaTotal).toBeCloseTo(6 * L * L, 12);
    expect(p.volumen).toBeCloseTo(L ** 3, 12);
    expect(p.cerrada).toBe(true);
    expect(p.cierreRelativo).toBeLessThan(1e-12);
  });

  it('las 6 normales del cubo son los ejes, unitarias y SALIENTES', () => {
    const p = pielDeMalla(cubo(100));
    for (const pan of p.paneles) {
      expect(Math.hypot(...pan.n)).toBeCloseTo(1, 12);
      // saliente: apunta en el mismo sentido que el centroide desde el centro
      const s = pan.n[0] * pan.c[0] + pan.n[1] * pan.c[1] + pan.n[2] * pan.c[2];
      expect(s).toBeGreaterThan(0);
    }
  });

  it('esfera: converge al volumen y área analíticos con ORDEN 2', () => {
    const R = 0.05; // 50 mm
    const Vexacto = (4 / 3) * Math.PI * R ** 3;
    const Aexacto = 4 * Math.PI * R * R;
    const errV: number[] = [], errA: number[] = [];
    for (const niv of [2, 3, 4, 5]) {
      const p = pielDeMalla(esfera(50, niv));
      expect(p.cerrada).toBe(true);
      expect(p.volumen).toBeLessThan(Vexacto);      // un poliedro INSCRITO subestima
      expect(p.areaTotal).toBeLessThan(Aexacto);
      errV.push(Math.abs(p.volumen - Vexacto) / Vexacto);
      errA.push(Math.abs(p.areaTotal - Aexacto) / Aexacto);
    }
    // al partir cada arista a la mitad el error debe caer ~4× (O(h²)).
    // Es un test MUCHO más fuerte que una tolerancia elegida a ojo: verifica que
    // la discretización es correcta, no solo que el número quedó cerca.
    for (let i = 1; i < errV.length; i++) {
      expect(errV[i - 1] / errV[i]).toBeGreaterThan(3.5);
      expect(errA[i - 1] / errA[i]).toBeGreaterThan(3.5);
    }
    expect(errV.at(-1)!).toBeLessThan(2e-3);
  });

  it('la escala es respetada: en unidades del kernel el volumen sale en esas unidades', () => {
    const p = pielDeMalla(cubo(100), { escala: 1 });
    expect(p.volumen).toBeCloseTo(1e6, 6);   // 100³ mm³
  });

  it('un cubo SIN TAPA no cierra, y se declara', () => {
    const c = cubo(100);
    // quita los 2 triángulos de la cara +z
    const sinTapa: TessellatedMesh = {
      ...c,
      indices: c.indices.slice(6),
      faceIds: c.faceIds.slice(2),
      triangleCount: c.triangleCount - 2,
    };
    const p = pielDeMalla(sinTapa);
    expect(p.cerrada).toBe(false);
    expect(p.cierreRelativo).toBeGreaterThan(TOL_CIERRE);
    // el defecto de cierre es exactamente el área que falta, en −z
    expect(p.cierre[2]).toBeCloseTo(-0.01, 9);
  });

  it('descarta triángulos degenerados sin ensuciar la normal', () => {
    const c = cubo(100);
    const conDegenerado: TessellatedMesh = {
      ...c,
      indices: new Uint32Array([...c.indices, 0, 0, 1]),   // área cero
      faceIds: new Uint32Array([...c.faceIds, 9]),
      triangleCount: c.triangleCount + 1,
    };
    const p = pielDeMalla(conDegenerado);
    expect(p.paneles).toHaveLength(12);
    expect(p.paneles.every((x) => Number.isFinite(x.n[0]))).toBe(true);
  });
});

describe('integrarPresion — los teoremas, no la aritmética', () => {
  it('⭐ Cp CONSTANTE sobre un cuerpo cerrado ⇒ FUERZA CERO', () => {
    // El cuerpo no siente la presión ambiente, solo sus DIFERENCIAS. Es el
    // mismo ∮n̂dS=0 y la razón por la que se trabaja en Cp y no en p.
    const p = pielDeMalla(esfera(50, 4));
    const cp = new Array(p.paneles.length).fill(-0.73);
    const r = integrarPresion(p, cp, 1e5, REF(0.01));
    const F = Math.hypot(...r.F);
    expect(F / (1e5 * p.areaTotal)).toBeLessThan(1e-12);
    expect(r.aviso).toBeNull();
  });

  it('cara frontal a Cp=1 y el resto a 0: el arrastre es q·A_frontal', () => {
    const p = pielDeMalla(cubo(100));
    // faceId 4 = cara +x (la de barlovento con el viento en +x)
    const cp = p.paneles.map((pan) => (pan.faceId === 4 ? 1 : 0));
    const q = 1000;
    const r = integrarPresion(p, cp, q, REF(0.01));
    // F = −Cp·q·n̂·A sobre +x ⇒ empuja en −x con magnitud q·A
    expect(r.F[0]).toBeCloseTo(-q * 0.01, 9);
    expect(r.CD).toBeCloseTo(-1, 9);   // el viento va en +x: aquí el cuerpo es empujado en −x
  });

  it('un cuerpo simétrico con Cp simétrico no genera sustentación', () => {
    const p = pielDeMalla(esfera(50, 4));
    // Cp que solo depende de x (eje del viento) ⇒ simétrico en z
    const cp = p.paneles.map((pan) => 1 - 2.25 * (1 - (pan.c[0] / 0.05) ** 2));
    const r = integrarPresion(p, cp, 1e4, REF(0.01));
    expect(Math.abs(r.CL)).toBeLessThan(1e-9);
  });

  it('AVISA cuando la piel no cierra en vez de dar un número bonito', () => {
    const c = cubo(100);
    const sinTapa: TessellatedMesh = {
      ...c, indices: c.indices.slice(6), faceIds: c.faceIds.slice(2), triangleCount: c.triangleCount - 2,
    };
    const p = pielDeMalla(sinTapa);
    const r = integrarPresion(p, new Array(p.paneles.length).fill(-0.5), 1e5, REF(0.01));
    expect(r.aviso).toMatch(/NO cierra/);
  });

  it('las cantidades de referencia viajan CON el resultado', () => {
    const p = pielDeMalla(cubo(100));
    const ref = REF(0.02);
    const r = integrarPresion(p, new Array(12).fill(0), 1e4, ref);
    expect(r.ref.sRef).toBe(0.02);
    expect(r.ref.cRef).toBe(0.1);
  });

  it('revienta si el número de Cp no cuadra con los paneles', () => {
    const p = pielDeMalla(cubo(100));
    expect(() => integrarPresion(p, [1, 2, 3], 1e4, REF(0.01))).toThrow(/paneles/);
  });
});

describe('utilidades', () => {
  it('porCara agrupa los 12 triángulos del cubo en 6 caras de 2', () => {
    const m = porCara(pielDeMalla(cubo(100)));
    expect(m.size).toBe(6);
    for (const idx of m.values()) expect(idx).toHaveLength(2);
  });

  it('direccionViento es unitaria y a α=0 apunta en +x', () => {
    expect(direccionViento(0)).toEqual([1, 0, 0]);
    for (const a of [0, 0.1, 0.5, 1.2]) {
      expect(Math.hypot(...direccionViento(a, 0.2))).toBeCloseTo(1, 12);
    }
  });

  it('MM_A_M convierte milímetros del kernel a metros', () => {
    expect(MM_A_M).toBe(1e-3);
  });
});
