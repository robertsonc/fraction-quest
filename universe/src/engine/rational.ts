/**
 * Exact rational arithmetic on safe integers. No floats anywhere in the engine.
 * Every constructor and operation asserts Number.isSafeInteger so an overflow is a thrown error,
 * never a silently wrong grade (DESIGN.md 9.3).
 */

export interface Frac {
  readonly n: number;
  readonly d: number;
}

export class RationalError extends Error {
  override readonly name = 'RationalError';
}

export function assertInt(x: number, what = 'value'): number {
  if (!Number.isSafeInteger(x)) throw new RationalError(`${what} must be a safe integer, got ${String(x)}`);
  return x;
}

/** Builds a fraction with a positive denominator. Does not reduce. */
export function frac(n: number, d: number): Frac {
  assertInt(n, 'numerator');
  assertInt(d, 'denominator');
  if (d === 0) throw new RationalError('denominator must not be 0');
  return d < 0 ? { n: -n, d: -d } : { n, d };
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(assertInt(a, 'gcd a'));
  let y = Math.abs(assertInt(b, 'gcd b'));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return assertInt(Math.abs(a / gcd(a, b) * b), 'lcm');
}

export function reduce(f: Frac): Frac {
  const g = gcd(f.n, f.d);
  return g <= 1 ? frac(f.n, f.d) : frac(f.n / g, f.d / g);
}

export function isReduced(f: Frac): boolean {
  return gcd(f.n, f.d) === 1;
}

function cross(a: Frac, b: Frac): [number, number] {
  return [assertInt(a.n * b.d, 'cross product'), assertInt(b.n * a.d, 'cross product')];
}

export function equals(a: Frac, b: Frac): boolean {
  const [x, y] = cross(a, b);
  return x === y;
}

export function compare(a: Frac, b: Frac): -1 | 0 | 1 {
  const [x, y] = cross(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function add(a: Frac, b: Frac): Frac {
  const d = lcm(a.d, b.d);
  return frac(assertInt(a.n * (d / a.d) + b.n * (d / b.d), 'sum'), d);
}

export function sub(a: Frac, b: Frac): Frac {
  return add(a, frac(-b.n, b.d));
}

export function mul(a: Frac, b: Frac): Frac {
  return frac(assertInt(a.n * b.n, 'product'), assertInt(a.d * b.d, 'product'));
}

/** Scales a fraction by k on top and bottom. The equivalent-fractions move. */
export function scale(f: Frac, k: number): Frac {
  assertInt(k, 'scale factor');
  if (k <= 0) throw new RationalError('scale factor must be positive');
  return frac(f.n * k, f.d * k);
}

export interface Mixed {
  readonly whole: number;
  readonly n: number;
  readonly d: number;
}

/** Negative values carry the sign on the whole, or on n when the whole is 0. */
export function toMixed(f: Frac): Mixed {
  const r = reduce(f);
  const sign = r.n < 0 ? -1 : 1;
  const an = Math.abs(r.n);
  const whole = Math.floor(an / r.d);
  const rem = an % r.d;
  return { whole: sign * whole, n: whole === 0 ? sign * rem : rem, d: r.d };
}

export function fromMixed(m: Mixed): Frac {
  assertInt(m.whole, 'whole');
  assertInt(m.n, 'mixed numerator');
  const negative = m.whole < 0 || m.n < 0;
  const magnitude = Math.abs(m.whole) * m.d + Math.abs(m.n);
  return frac(negative ? -magnitude : magnitude, m.d);
}

export function isZero(f: Frac): boolean {
  return f.n === 0;
}

export function isWhole(f: Frac): boolean {
  return f.n % f.d === 0;
}

/** "2/3" or "4" for a whole number. Not for user display; use the strings module for that. */
export function format(f: Frac): string {
  return isWhole(f) ? String(f.n / f.d) : `${f.n}/${f.d}`;
}

/** All k such that f scaled by k has denominator at most maxD. */
export function scaleFactorsUpTo(f: Frac, maxD: number): number[] {
  const out: number[] = [];
  for (let k = 1; f.d * k <= maxD; k++) out.push(k);
  return out;
}

export function divisors(n: number): number[] {
  assertInt(n, 'divisors');
  const out: number[] = [];
  for (let i = 1; i <= Math.abs(n); i++) if (n % i === 0) out.push(i);
  return out;
}
