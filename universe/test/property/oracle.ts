/**
 * Independent oracle for the property tests. Written on purpose in a different style from
 * src/engine: BigInt cross-multiplication, trial division, brute-force search. Shares no code
 * with the engine (DESIGN.md 9.3).
 */
import type { Item } from '../../src/engine/types';

export function bigEqual(an: number, ad: number, bn: number, bd: number): boolean {
  return BigInt(an) * BigInt(bd) === BigInt(bn) * BigInt(ad);
}

export function bruteGcd(a: number, b: number): number {
  let g = 1;
  const lim = Math.min(Math.abs(a), Math.abs(b));
  for (let i = 1; i <= lim; i++) if (a % i === 0 && b % i === 0) g = i;
  return g;
}

/** Brute-force: the unique v in 1..bound with from == v/known (or known/v). */
export function oracleMissingPart(fromN: number, fromD: number, missing: 'numerator' | 'denominator', known: number, bound = 10000): number | null {
  let found: number | null = null;
  for (let v = 1; v <= bound; v++) {
    const ok = missing === 'numerator' ? bigEqual(fromN, fromD, v, known) : bigEqual(fromN, fromD, known, v);
    if (ok) {
      if (found !== null) return null; // not unique, which would be a generator bug
      found = v;
    }
  }
  return found;
}

export function oracleMultiply(a: number, b: number): number {
  let total = 0;
  for (let i = 0; i < a; i++) total += b;
  return total;
}

/** Solves any Phase 1 item with the oracle. Returns a value comparable to item.answer. */
export function oracleAnswer(item: Item): { kind: 'int'; value: number } | { kind: 'bool'; value: boolean } | { kind: 'frac'; n: number; d: number } | null {
  const g = item.given;
  switch (g.kind) {
    case 'missing-part': {
      const v = oracleMissingPart(g.from.n, g.from.d, g.missing, g.known);
      return v === null ? null : { kind: 'int', value: v };
    }
    case 'is-equivalent':
      return { kind: 'bool', value: bigEqual(g.a.n, g.a.d, g.b.n, g.b.d) };
    case 'find-pair':
      // Canonical answer is the first scaling with a bigger bottom: by 2.
      return { kind: 'frac', n: g.from.n + g.from.n, d: g.from.d + g.from.d };
    case 'name-fraction':
      return { kind: 'frac', n: g.shaded, d: g.d };
    case 'mult-fact':
      return { kind: 'int', value: oracleMultiply(g.a, g.b) };
  }
}
