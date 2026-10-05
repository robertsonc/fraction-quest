/**
 * For tests: the wrong answer each misconception would produce on an item, or null when that
 * misconception cannot apply. The collision suite proves produce() differs from the correct answer
 * and that detect() recognizes it.
 */
import { scale } from '../rational';
import type { Answer, Item } from '../types';

export function produce(id: string, item: Item): Answer | null {
  const g = item.given;
  switch (id) {
    case 'scales-numerator-only':
      if (g.kind === 'missing-part') return g.missing === 'denominator' ? { kind: 'int', value: g.from.d } : null;
      if (g.kind === 'find-pair') return { kind: 'frac', n: g.from.n * 2, d: g.from.d };
      if (g.kind === 'is-equivalent') return g.distractor === id ? { kind: 'bool', value: true } : null;
      return null;
    case 'scales-denominator-only':
      if (g.kind === 'missing-part') return g.missing === 'numerator' ? { kind: 'int', value: g.from.n } : null;
      if (g.kind === 'find-pair') return { kind: 'frac', n: g.from.n, d: g.from.d * 2 };
      if (g.kind === 'is-equivalent') return g.distractor === id ? { kind: 'bool', value: true } : null;
      return null;
    case 'adds-to-both':
      if (g.kind === 'missing-part') {
        const delta = g.missing === 'numerator' ? g.known - g.from.d : g.known - g.from.n;
        const own = g.missing === 'numerator' ? g.from.n : g.from.d;
        return { kind: 'int', value: own + delta };
      }
      if (g.kind === 'find-pair') return { kind: 'frac', n: g.from.n + 1, d: g.from.d + 1 };
      if (g.kind === 'is-equivalent') return g.distractor === id ? { kind: 'bool', value: true } : null;
      return null;
    case 'different-scale-factors':
      if (g.kind === 'missing-part') {
        const own = g.missing === 'numerator' ? g.from.n : g.from.d;
        const k2 = g.k === 2 ? 3 : g.k - 1;
        return { kind: 'int', value: own * k2 };
      }
      if (g.kind === 'find-pair') return { kind: 'frac', n: g.from.n * 2, d: g.from.d * 3 };
      if (g.kind === 'is-equivalent') return g.distractor === id ? { kind: 'bool', value: true } : null;
      return null;
    case 'whole-number-bias':
      if (g.kind === 'is-equivalent') return g.distractor === 'equal' ? { kind: 'bool', value: false } : null;
      return null;
    case 'copies-fraction':
      if (g.kind === 'find-pair') return { kind: 'frac', n: g.from.n, d: g.from.d };
      return null;
    case 'counts-ticks-not-gaps':
      if (item.rep !== 'line') return null;
      if (g.kind === 'missing-part') return g.missing === 'numerator' ? { kind: 'int', value: scale(g.from, g.k).n + 1 } : null;
      if (g.kind === 'name-fraction') return { kind: 'frac', n: g.shaded + 1, d: g.d };
      return null;
    case 'arith-slip':
      if (g.kind === 'missing-part') {
        const correct = g.missing === 'numerator' ? scale(g.from, g.k).n : scale(g.from, g.k).d;
        return { kind: 'int', value: correct + 1 };
      }
      if (g.kind === 'mult-fact') return { kind: 'int', value: g.a * g.b + 1 };
      return null;
    case 'part-over-part':
      if (g.kind === 'name-fraction') return g.d - g.shaded > 0 ? { kind: 'frac', n: g.shaded, d: g.d - g.shaded } : null;
      return null;
    case 'inverted-fraction':
      if (g.kind === 'name-fraction') return { kind: 'frac', n: g.d, d: g.shaded };
      return null;
    case 'adds-instead':
      if (g.kind === 'mult-fact') return { kind: 'int', value: g.a + g.b };
      return null;
    case 'off-by-one-group':
      if (g.kind === 'mult-fact') return { kind: 'int', value: g.a * g.b + g.b };
      return null;
    default:
      return null;
  }
}
