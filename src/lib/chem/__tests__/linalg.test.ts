import { describe, it, expect } from 'vitest';
import { identity, identityMinus, luFactor, luSolve, vec } from '../linalg';

describe('identity', () => {
  it('n=3 produce matriz 3x3 con 1 en la diagonal', () => {
    const I = identity(3);
    expect(I).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });
});

describe('identityMinus', () => {
  it('I − 0·B = I', () => {
    const B = [[2, 3], [4, 5]];
    expect(identityMinus(0, B)).toEqual([[1, 0], [0, 1]]);
  });
  it('I − 1·I = 0', () => {
    expect(identityMinus(1, identity(2))).toEqual([[0, 0], [0, 0]]);
  });
});

describe('LU solve', () => {
  it('resuelve sistema 2x2 simple', () => {
    // A = [[2,1],[1,3]] · [x,y] = [5,10] → x=1, y=3
    const A = [[2, 1], [1, 3]];
    const lu = luFactor(A);
    const x = luSolve(lu, [5, 10]);
    expect(x[0]).toBeCloseTo(1, 10);
    expect(x[1]).toBeCloseTo(3, 10);
  });

  it('resuelve 3x3 con pivoteo necesario', () => {
    // Matriz que requiere pivoteo para estabilidad numérica
    const A = [
      [0,  2, 1],
      [1,  1, 2],
      [2, -1, 1],
    ];
    const lu = luFactor(A);
    const b = [3, 4, 2];
    const x = luSolve(lu, b);
    // Verificar A·x = b
    for (let i = 0; i < 3; i++) {
      let s = 0;
      for (let j = 0; j < 3; j++) s += A[i][j] * x[j];
      expect(s).toBeCloseTo(b[i], 10);
    }
  });

  it('detecta matriz singular', () => {
    const A = [[1, 2], [2, 4]];
    const lu = luFactor(A);
    expect(lu.singular).toBe(true);
  });

  it('matriz diagonal: x_i = b_i / A_ii', () => {
    const A = [[5, 0, 0], [0, 2, 0], [0, 0, 7]];
    const lu = luFactor(A);
    const x = luSolve(lu, [10, 6, 14]);
    expect(x).toEqual([2, 3, 2]);
  });
});

describe('operaciones vectoriales', () => {
  it('vec.add con escala', () => {
    expect(vec.add([1, 2, 3], [4, 5, 6], 2)).toEqual([9, 12, 15]);
  });

  it('vec.norm2', () => {
    expect(vec.norm2([3, 4])).toBeCloseTo(5, 10);
  });

  it('vec.normInf', () => {
    expect(vec.normInf([1, -3, 2])).toBe(3);
  });

  it('vec.wrmsNorm', () => {
    // norm(y/sc) RMS: y=[2,4], sc=[1,2] → [2,2] → sqrt(mean(4+4)) = 2
    const n = vec.wrmsNorm([2, 4], [1, 2]);
    expect(n).toBeCloseTo(2, 10);
  });
});
