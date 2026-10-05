import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { add, compare, equals, frac, gcd, lcm, mul, reduce, scale, sub, toMixed, fromMixed, RationalError } from '../../src/engine/rational';
import { bigEqual, bruteGcd } from '../property/oracle';

const small = fc.integer({ min: -500, max: 500 });
const pos = fc.integer({ min: 1, max: 500 });

describe('rational', () => {
  it('rejects a zero denominator and non-integers', () => {
    expect(() => frac(1, 0)).toThrow(RationalError);
    expect(() => frac(1.5, 2)).toThrow(RationalError);
    expect(() => frac(1, Number.MAX_SAFE_INTEGER + 2)).toThrow(RationalError);
  });

  it('normalizes the sign to the numerator', () => {
    expect(frac(1, -2)).toEqual({ n: -1, d: 2 });
  });

  it('gcd matches trial division', () => {
    fc.assert(fc.property(pos, pos, (a, b) => { expect(gcd(a, b)).toBe(bruteGcd(a, b)); }));
  });

  it('lcm times gcd is the product', () => {
    fc.assert(fc.property(pos, pos, (a, b) => { expect(lcm(a, b) * gcd(a, b)).toBe(a * b); }));
  });

  it('reduce keeps the value and yields coprime parts', () => {
    fc.assert(fc.property(small, pos, (n, d) => {
      const r = reduce(frac(n, d));
      expect(bigEqual(n, d, r.n, r.d)).toBe(true);
      expect(gcd(r.n, r.d) === 1 || r.n === 0).toBe(true);
    }));
  });

  it('equals and compare agree with BigInt cross multiplication', () => {
    fc.assert(fc.property(small, pos, small, pos, (an, ad, bn, bd) => {
      const a = frac(an, ad), b = frac(bn, bd);
      expect(equals(a, b)).toBe(bigEqual(an, ad, bn, bd));
      const diff = BigInt(an) * BigInt(bd) - BigInt(bn) * BigInt(ad);
      expect(compare(a, b)).toBe(diff < 0n ? -1 : diff > 0n ? 1 : 0);
    }));
  });

  it('add, sub, mul match BigInt arithmetic', () => {
    fc.assert(fc.property(small, pos, small, pos, (an, ad, bn, bd) => {
      const a = frac(an, ad), b = frac(bn, bd);
      const s = add(a, b);
      expect(BigInt(s.n) * BigInt(ad) * BigInt(bd)).toBe((BigInt(an) * BigInt(bd) + BigInt(bn) * BigInt(ad)) * BigInt(s.d));
      const m = mul(a, b);
      expect(bigEqual(m.n, m.d, an * bn, ad * bd)).toBe(true);
      const t = sub(a, b);
      expect(equals(add(t, b), a)).toBe(true);
    }));
  });

  it('scale keeps the value', () => {
    fc.assert(fc.property(pos, pos, fc.integer({ min: 1, max: 20 }), (n, d, k) => {
      expect(equals(scale(frac(n, d), k), frac(n, d))).toBe(true);
    }));
  });

  it('mixed round trips', () => {
    fc.assert(fc.property(small, pos, (n, d) => {
      const f = frac(n, d);
      expect(equals(fromMixed(toMixed(f)), f)).toBe(true);
    }));
    expect(toMixed(frac(7, 3))).toEqual({ whole: 2, n: 1, d: 3 });
  });
});
