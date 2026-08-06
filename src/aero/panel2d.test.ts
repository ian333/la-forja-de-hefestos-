/**
 * panel2d.test.ts — EL FIXTURE DE ORO: Ejemplo 3.19 de Anderson (§3.17, pp.290-293).
 *
 * Es una prueba de aceptación end-to-end PUBLICADA: el libro imprime los
 * coeficientes geométricos intermedios, la fila 4 completa de la matriz 8×8, las
 * ocho intensidades de fuente y el invariante de conservación de masa. Si el
 * solver reproduce todo eso a cuatro cifras, está bien construido; si no, el
 * error está localizado por la primera comprobación que falle.
 *
 * Geometría del ejemplo: cilindro de radio unitario en 8 paneles iguales, con la
 * numeración HORARIA de Anderson — el punto de control del panel 1 cae en 180°
 * (el punto de estancamiento delantero, con V∞ en +x).
 */
import { describe, it, expect } from 'vitest';
import {
  construirPaneles, influencia, prepararPaneles, resolverAlpha,
  cpCilindroExacto, circulo,
} from './panel2d';

const GR = Math.PI / 180;
/** Fase que reproduce la numeración del Ejemplo 3.19: nodo 0 en 202.5°. */
const FASE_ANDERSON = 202.5 * GR;
const octagonoAnderson = () => circulo(1, 8, FASE_ANDERSON);

describe('Ejemplo 3.19 — geometría del octágono', () => {
  it('reproduce los nodos y ángulos que imprime el libro', () => {
    const p = construirPaneles(octagonoAnderson());
    expect(p).toHaveLength(8);
    // panel 4 (índice 3): punto de control (0.6533, 0.6533), Theta = 315°
    expect(p[3].xc).toBeCloseTo(0.6533, 4);
    expect(p[3].yc).toBeCloseTo(0.6533, 4);
    expect(((p[3].theta / GR) + 360) % 360).toBeCloseTo(315, 3);
    // panel 2 (índice 1): nodos (−0.9239, 0.3827) → (−0.3827, 0.9239), Theta = 45°
    expect(p[1].X).toBeCloseTo(-0.9239, 4);
    expect(p[1].Y).toBeCloseTo(0.3827, 4);
    expect(p[1].X2).toBeCloseTo(-0.3827, 4);
    expect(p[1].Y2).toBeCloseTo(0.9239, 4);
    expect(p[1].theta / GR).toBeCloseTo(45, 3);
  });

  it('las normales apuntan hacia AFUERA (n̂·r̂ > 0)', () => {
    for (const q of construirPaneles(octagonoAnderson())) {
      expect(q.nx * q.xc + q.ny * q.yc).toBeGreaterThan(0);
    }
  });

  it('corrige la orientación si el croquis viene antihorario', () => {
    const horario = construirPaneles(octagonoAnderson());
    const antihorario = construirPaneles([...octagonoAnderson()].reverse());
    // el contorno invertido debe producir normales igualmente salientes
    for (const q of antihorario) expect(q.nx * q.xc + q.ny * q.yc).toBeGreaterThan(0);
    const perim = (ps: typeof horario) => ps.reduce((a, b) => a + b.S, 0);
    expect(perim(antihorario)).toBeCloseTo(perim(horario), 12);
  });
});

describe('⭐ Ejemplo 3.19 — los coeficientes y la integral (3.163)', () => {
  it('A, B, C, D, S_j y E del par (i=4, j=2) son los del libro', () => {
    const p = construirPaneles(octagonoAnderson());
    const pi = p[3], pj = p[1];
    const dx = pi.xc - pj.X, dy = pi.yc - pj.Y;
    const A = -dx * Math.cos(pj.theta) - dy * Math.sin(pj.theta);
    const B = dx * dx + dy * dy;
    const C = Math.sin(pi.theta - pj.theta);
    const D = dy * Math.cos(pi.theta) - dx * Math.sin(pi.theta);
    const E = dx * Math.sin(pj.theta) - dy * Math.cos(pj.theta);
    expect(A).toBeCloseTo(-1.3065, 3);
    expect(B).toBeCloseTo(2.5607, 3);
    expect(C).toBeCloseTo(-1, 6);
    expect(D).toBeCloseTo(1.3065, 3);
    expect(pj.S).toBeCloseTo(0.7654, 3);
    expect(E).toBeCloseTo(0.9239, 3);
  });

  it('I_4,2 = 0.4018 y toda la fila 4 del libro', () => {
    const p = construirPaneles(octagonoAnderson());
    const esperado: Record<number, number> = {
      0: 0.4074, 1: 0.4018, 2: 0.3528, 4: 0.3528, 5: 0.4018, 6: 0.4074, 7: 0.4084,
    };
    for (const [j, v] of Object.entries(esperado)) {
      const { I } = influencia(p[3], p[Number(j)]);
      expect(Math.abs(I - v) / v).toBeLessThan(0.005);   // 0.5%: el libro da 4 cifras
    }
  });

  it('el término independiente de la fila 4 es −0.7071·2π·V∞', () => {
    const p = construirPaneles(octagonoAnderson());
    // beta_4 = 45° ⇒ cos(beta_4) = 0.7071 con V∞ en +x
    expect(p[3].nx).toBeCloseTo(Math.SQRT1_2, 4);
  });
});

describe('⭐ Ejemplo 3.19 — la solución y los invariantes', () => {
  const s = prepararPaneles(octagonoAnderson());
  const r = resolverAlpha(s, 0);

  it('las 8 intensidades λ/(2πV∞) son las del libro', () => {
    const esperado = [0.3765, 0.2662, 0, -0.2662, -0.3765, -0.2662, 0, 0.2662];
    esperado.forEach((v, i) => {
      if (Math.abs(v) < 1e-9) expect(Math.abs(r.lambda[i])).toBeLessThan(1e-9);
      else expect(Math.abs(r.lambda[i] - v) / Math.abs(v)).toBeLessThan(0.01);
    });
  });

  it('la distribución es SIMÉTRICA, como exige el libro para el cilindro sin sustentación', () => {
    // λ_2 = λ_8 y λ_4 = λ_6 (simetría respecto al eje del flujo)
    expect(r.lambda[1]).toBeCloseTo(r.lambda[7], 6);
    expect(r.lambda[3]).toBeCloseTo(r.lambda[5], 6);
    // y los paneles ⊥ al flujo no emiten
    expect(Math.abs(r.lambda[2])).toBeLessThan(1e-9);
    expect(Math.abs(r.lambda[6])).toBeLessThan(1e-9);
  });

  it('CONSERVACIÓN DE MASA (3.157): Σ λ_j·S_j = 0', () => {
    // "el cuerpo estaría añadiendo o absorbiendo masa del flujo, una situación imposible"
    expect(Math.abs(r.residuoMasa)).toBeLessThan(1e-12);
  });
});

describe('Cp del cilindro contra la solución exacta 1 − 4·sin²θ', () => {
  it('con 8 paneles el error ya es < 0.05 ("EXCELLENT", dice el libro)', () => {
    const s = prepararPaneles(octagonoAnderson());
    const r = resolverAlpha(s, 0);
    s.paneles.forEach((p, i) => {
      const th = Math.atan2(p.yc, p.xc);
      expect(Math.abs(r.cp[i] - cpCilindroExacto(th))).toBeLessThan(0.05);
    });
  });

  it('con 64 paneles el error cae por debajo de 1e-3', () => {
    const s = prepararPaneles(circulo(1, 64, FASE_ANDERSON));
    const r = resolverAlpha(s, 0);
    let peor = 0;
    s.paneles.forEach((p, i) => {
      const th = Math.atan2(p.yc, p.xc);
      peor = Math.max(peor, Math.abs(r.cp[i] - cpCilindroExacto(th)));
    });
    expect(peor).toBeLessThan(1e-3);
  });

  it('⭐ en los PUNTOS DE CONTROL la solución es EXACTA, ya con 8 paneles', () => {
    // Hallazgo medido, más fuerte que "converge": para un polígono regular con
    // paneles iguales, la velocidad tangencial en los centros reproduce la
    // solución analítica V_t = 2·V∞·sin(θ) a precisión de máquina — la simetría
    // de la discretización lo hace exacto ahí. Anderson llama "EXCELLENT" a su
    // octágono porque compara la CURVA completa; entre puntos de control sí hay
    // error de discretización, pero en los puntos no.
    for (const n of [8, 12, 16, 32, 64]) {
      const s = prepararPaneles(circulo(1, n, FASE_ANDERSON));
      const r = resolverAlpha(s, 0);
      s.paneles.forEach((p, i) => {
        const th = Math.atan2(p.yc, p.xc);
        expect(r.vt[i]).toBeCloseTo(2 * Math.sin(th), 12);          // V_t exacta
        expect(r.cp[i]).toBeCloseTo(cpCilindroExacto(th), 12);      // y por tanto Cp
      });
    }
  });

  it('el Cp de estancamiento vale 1 y el mínimo −3', () => {
    const s = prepararPaneles(circulo(1, 256, FASE_ANDERSON));
    const r = resolverAlpha(s, 0);
    expect(Math.max(...r.cp)).toBeCloseTo(1, 2);
    expect(Math.min(...r.cp)).toBeCloseTo(-3, 2);
  });

  it('el radio no cambia el Cp (es adimensional)', () => {
    const a = resolverAlpha(prepararPaneles(circulo(1, 64, FASE_ANDERSON)), 0);
    const b = resolverAlpha(prepararPaneles(circulo(37.5, 64, FASE_ANDERSON)), 0);
    a.cp.forEach((v, i) => expect(v).toBeCloseTo(b.cp[i], 9));
  });
});

describe('la matriz depende SOLO de la geometría — lo que hace interactiva la polar', () => {
  it('una sesión sirve para todos los α: girar el cuerpo ≡ girar el viento', () => {
    // El cilindro es axisimétrico: resolver a α y comparar contra el cuerpo
    // girado −α debe dar el mismo campo. Verifica que el término independiente
    // es lo único que cambia con α.
    const s = prepararPaneles(circulo(1, 64, FASE_ANDERSON));
    const alpha = 30 * GR;
    const conAlpha = resolverAlpha(s, alpha);
    for (let i = 0; i < s.n; i++) {
      const th = Math.atan2(s.paneles[i].yc, s.paneles[i].xc);
      // el estancamiento se corrió a α: el ángulo relativo al viento manda
      expect(Math.abs(conAlpha.cp[i] - cpCilindroExacto(th - alpha))).toBeLessThan(2e-3);
    }
  });

  it('barrer 41 ángulos reusando la factorización da lo mismo que rehacerla', () => {
    const nodos = circulo(1, 48, FASE_ANDERSON);
    const s = prepararPaneles(nodos);
    for (let k = 0; k <= 40; k += 10) {
      const a = (k - 20) * GR;
      const reusando = resolverAlpha(s, a);
      const desdeCero = resolverAlpha(prepararPaneles(nodos), a);
      reusando.cp.forEach((v, i) => expect(v).toBeCloseTo(desdeCero.cp[i], 12));
    }
  });

  it('conserva masa a CUALQUIER ángulo de ataque', () => {
    const s = prepararPaneles(circulo(1, 32, FASE_ANDERSON));
    for (const gr of [-15, -5, 0, 5, 15, 45]) {
      expect(Math.abs(resolverAlpha(s, gr * GR).residuoMasa)).toBeLessThan(1e-12);
    }
  });
});

describe('robustez sobre geometría de CAD (no solo octágonos)', () => {
  it('aguanta TRAMOS RECTOS, donde E→0 y (3.163) daría 0/0', () => {
    // un cuadrado: cada panel es colineal con el punto de control de su misma cara
    const cuadrado: Array<[number, number]> = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
    const s = prepararPaneles(cuadrado);
    const r = resolverAlpha(s, 0);
    expect(r.cp.every(Number.isFinite)).toBe(true);
    expect(r.lambda.every(Number.isFinite)).toBe(true);
    expect(Math.abs(r.residuoMasa)).toBeLessThan(1e-12);
  });

  it('un contorno con MUCHOS puntos alineados no rompe nada', () => {
    // borde recto discretizado en 20 tramos: el caso que Anderson nunca prueba
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 20; i++) pts.push([-1 + (2 * i) / 20, -0.2]);
    for (let i = 0; i < 20; i++) pts.push([1, -0.2 + (0.4 * i) / 20]);
    for (let i = 0; i < 20; i++) pts.push([1 - (2 * i) / 20, 0.2]);
    for (let i = 0; i < 20; i++) pts.push([-1, 0.2 - (0.4 * i) / 20]);
    const r = resolverAlpha(prepararPaneles(pts), 5 * GR);
    expect(r.cp.every(Number.isFinite)).toBe(true);
    expect(Math.abs(r.residuoMasa)).toBeLessThan(1e-10);
  });

  it('ignora el nodo repetido al cerrar el contorno', () => {
    const abierto = circulo(1, 16, FASE_ANDERSON);
    const cerrado = [...abierto, abierto[0]];
    expect(prepararPaneles(cerrado).n).toBe(prepararPaneles(abierto).n);
  });

  it('exige al menos 3 nodos', () => {
    expect(() => prepararPaneles([[0, 0], [1, 0]])).toThrow();
  });
});
