// fraction.ts — Aritmetica racional EXACTA con BigInt.
// Cero dependencias externas. Cada operacion es inspeccionable y precisa:
// nada de floats en Gauss-Jordan / determinante.

function absBig(a: bigint): bigint {
  return a < 0n ? -a : a;
}

function gcdBig(a: bigint, b: bigint): bigint {
  a = absBig(a);
  b = absBig(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export type FractionLike = Fraction | number | bigint;

export class Fraction {
  readonly num: bigint; // numerador (lleva el signo)
  readonly den: bigint; // denominador (siempre > 0)

  constructor(num: bigint, den: bigint = 1n) {
    if (den === 0n) {
      throw new Error('Fraction: denominador cero');
    }
    if (den < 0n) {
      num = -num;
      den = -den;
    }
    const g = gcdBig(num, den);
    if (g > 1n) {
      num /= g;
      den /= g;
    }
    this.num = num;
    this.den = den;
  }

  // ---- Constructores de conveniencia -------------------------------------

  static fromNumber(n: number): Fraction {
    if (!Number.isFinite(n)) throw new Error('Fraction.fromNumber: valor no finito');
    if (Number.isInteger(n)) return new Fraction(BigInt(n), 1n);
    // Descomposicion exacta del double via su representacion decimal corta.
    const s = String(n);
    if (s.includes('e') || s.includes('E')) {
      // Notacion cientifica: reconstruir mantisa/exponente.
      const [mant, expRaw] = s.split(/[eE]/);
      const exp = parseInt(expRaw, 10);
      const base = Fraction.fromDecimalString(mant);
      const pow = Fraction.pow10(exp);
      return base.mul(pow);
    }
    return Fraction.fromDecimalString(s);
  }

  private static pow10(exp: number): Fraction {
    let p = 1n;
    const e = Math.abs(exp);
    for (let i = 0; i < e; i++) p *= 10n;
    return exp >= 0 ? new Fraction(p, 1n) : new Fraction(1n, p);
  }

  private static fromDecimalString(s: string): Fraction {
    const neg = s.startsWith('-');
    if (neg || s.startsWith('+')) s = s.slice(1);
    const dot = s.indexOf('.');
    if (dot < 0) {
      const v = BigInt(s);
      return new Fraction(neg ? -v : v, 1n);
    }
    const intPart = s.slice(0, dot) || '0';
    const fracPart = s.slice(dot + 1);
    let den = 1n;
    for (let i = 0; i < fracPart.length; i++) den *= 10n;
    const numAbs = BigInt(intPart + fracPart);
    return new Fraction(neg ? -numAbs : numAbs, den);
  }

  static from(x: FractionLike): Fraction {
    if (x instanceof Fraction) return x;
    if (typeof x === 'bigint') return new Fraction(x, 1n);
    return Fraction.fromNumber(x);
  }

  static zero(): Fraction {
    return new Fraction(0n, 1n);
  }

  static one(): Fraction {
    return new Fraction(1n, 1n);
  }

  // ---- Aritmetica --------------------------------------------------------

  add(o: FractionLike): Fraction {
    const b = Fraction.from(o);
    return new Fraction(this.num * b.den + b.num * this.den, this.den * b.den);
  }

  sub(o: FractionLike): Fraction {
    const b = Fraction.from(o);
    return new Fraction(this.num * b.den - b.num * this.den, this.den * b.den);
  }

  mul(o: FractionLike): Fraction {
    const b = Fraction.from(o);
    return new Fraction(this.num * b.num, this.den * b.den);
  }

  div(o: FractionLike): Fraction {
    const b = Fraction.from(o);
    if (b.num === 0n) throw new Error('Fraction.div: division entre cero');
    return new Fraction(this.num * b.den, this.den * b.num);
  }

  neg(): Fraction {
    return new Fraction(-this.num, this.den);
  }

  abs(): Fraction {
    return new Fraction(absBig(this.num), this.den);
  }

  inverse(): Fraction {
    if (this.num === 0n) throw new Error('Fraction.inverse: de cero');
    return new Fraction(this.den, this.num);
  }

  // ---- Predicados / comparacion ------------------------------------------

  isZero(): boolean {
    return this.num === 0n;
  }

  isOne(): boolean {
    return this.num === this.den;
  }

  isInteger(): boolean {
    return this.den === 1n;
  }

  isNegative(): boolean {
    return this.num < 0n;
  }

  equals(o: FractionLike): boolean {
    const b = Fraction.from(o);
    return this.num === b.num && this.den === b.den;
  }

  // Devuelve -1, 0, 1 comparando this con o.
  compare(o: FractionLike): number {
    const b = Fraction.from(o);
    const left = this.num * b.den;
    const right = b.num * this.den;
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }

  // ---- Salidas -----------------------------------------------------------

  toNumber(): number {
    return Number(this.num) / Number(this.den);
  }

  toString(): string {
    if (this.den === 1n) return this.num.toString();
    return `${this.num}/${this.den}`;
  }

  // LaTeX: usa \frac para no enteros; signo afuera para verse natural.
  toLatex(): string {
    if (this.den === 1n) return this.num.toString();
    if (this.num < 0n) {
      return `-\\frac{${-this.num}}{${this.den}}`;
    }
    return `\\frac{${this.num}}{${this.den}}`;
  }
}
