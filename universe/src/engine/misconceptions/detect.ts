/**
 * Misconception predicates. Each returns true when the answer is exactly what that misconception
 * produces on this item. Detection is computed from the answer value, never guessed (DESIGN.md 3).
 * The predicates are code; labels, fixes and micro-lesson links are content (misconceptions.json).
 */
import { equals, frac, scale } from '../rational';
import type { Answer, Item } from '../types';

export type Predicate = (item: Item, answer: Answer) => boolean;

function intAns(a: Answer): number | null {
  return a.kind === 'int' ? a.value : null;
}
function fracAns(a: Answer): { n: number; d: number } | null {
  return a.kind === 'frac' ? { n: a.n, d: a.d } : null;
}

export const PREDICATES: Record<string, Predicate> = {
  'scales-numerator-only': (item, answer) => {
    const g = item.given;
    if (g.kind === 'missing-part') {
      // a/b = ak/?  answered with b (bottom left alone)
      return g.missing === 'denominator' && intAns(answer) === g.from.d;
    }
    if (g.kind === 'find-pair') {
      const f = fracAns(answer);
      return !!f && f.d === g.from.d && f.n !== g.from.n && f.n % g.from.n === 0;
    }
    if (g.kind === 'is-equivalent') return answer.kind === 'bool' && answer.value === true && g.distractor === 'scales-numerator-only';
    return false;
  },
  'scales-denominator-only': (item, answer) => {
    const g = item.given;
    if (g.kind === 'missing-part') {
      // a/b = ?/bk  answered with a (top left alone)
      return g.missing === 'numerator' && intAns(answer) === g.from.n;
    }
    if (g.kind === 'find-pair') {
      const f = fracAns(answer);
      return !!f && f.n === g.from.n && f.d !== g.from.d && f.d % g.from.d === 0;
    }
    if (g.kind === 'is-equivalent') return answer.kind === 'bool' && answer.value === true && g.distractor === 'scales-denominator-only';
    return false;
  },
  'adds-to-both': (item, answer) => {
    const g = item.given;
    if (g.kind === 'missing-part') {
      const v = intAns(answer);
      if (v === null) return false;
      const delta = g.missing === 'numerator' ? g.known - g.from.d : g.known - g.from.n;
      const own = g.missing === 'numerator' ? g.from.n : g.from.d;
      return delta > 0 && v === own + delta;
    }
    if (g.kind === 'find-pair') {
      const f = fracAns(answer);
      if (!f) return false;
      const delta = f.d - g.from.d;
      return delta > 0 && f.n - g.from.n === delta && !equals(frac(f.n, f.d), g.from);
    }
    if (g.kind === 'is-equivalent') return answer.kind === 'bool' && answer.value === true && g.distractor === 'adds-to-both';
    return false;
  },
  'different-scale-factors': (item, answer) => {
    const g = item.given;
    if (g.kind === 'missing-part') {
      const v = intAns(answer);
      if (v === null) return false;
      const own = g.missing === 'numerator' ? g.from.n : g.from.d;
      const correct = own * g.k;
      // A multiple of the known part by some other factor at least 2.
      return v !== correct && v > own && v % own === 0 && v / own >= 2;
    }
    if (g.kind === 'find-pair') {
      const f = fracAns(answer);
      if (!f || f.d <= 0) return false;
      return f.n % g.from.n === 0 && f.d % g.from.d === 0 && f.n / g.from.n !== f.d / g.from.d && f.n / g.from.n >= 2 && f.d / g.from.d >= 2;
    }
    if (g.kind === 'is-equivalent') return answer.kind === 'bool' && answer.value === true && g.distractor === 'different-scale-factors';
    return false;
  },
  'whole-number-bias': (item, answer) => {
    const g = item.given;
    // A true pair rejected: the numbers differ, so the learner says the amounts differ.
    return g.kind === 'is-equivalent' && g.distractor === 'equal' && answer.kind === 'bool' && answer.value === false;
  },
  'copies-fraction': (item, answer) => {
    const g = item.given;
    if (g.kind !== 'find-pair') return false;
    const f = fracAns(answer);
    return !!f && f.n === g.from.n && f.d === g.from.d;
  },
  'counts-ticks-not-gaps': (item, answer) => {
    const g = item.given;
    if (item.rep !== 'line') return false;
    if (g.kind === 'missing-part' && g.missing === 'numerator') {
      // Counts the zero tick as a piece: one more than the right count.
      return intAns(answer) === scale(g.from, g.k).n + 1;
    }
    if (g.kind === 'name-fraction') {
      const f = fracAns(answer);
      return !!f && f.n === g.shaded + 1 && f.d === g.d;
    }
    return false;
  },
  'arith-slip': (item, answer) => {
    const g = item.given;
    if (g.kind === 'missing-part') {
      const v = intAns(answer);
      if (v === null) return false;
      const correct = g.missing === 'numerator' ? scale(g.from, g.k).n : scale(g.from, g.k).d;
      return Math.abs(v - correct) === 1;
    }
    if (g.kind === 'mult-fact') {
      const v = intAns(answer);
      return v !== null && Math.abs(v - g.a * g.b) === 1;
    }
    return false;
  },
  'part-over-part': (item, answer) => {
    const g = item.given;
    if (g.kind !== 'name-fraction') return false;
    const f = fracAns(answer);
    return !!f && f.n === g.shaded && f.d === g.d - g.shaded;
  },
  'inverted-fraction': (item, answer) => {
    const g = item.given;
    if (g.kind !== 'name-fraction') return false;
    const f = fracAns(answer);
    return !!f && f.n === g.d && f.d === g.shaded;
  },
  'adds-instead': (item, answer) => {
    const g = item.given;
    return g.kind === 'mult-fact' && intAns(answer) === g.a + g.b;
  },
  'off-by-one-group': (item, answer) => {
    const g = item.given;
    if (g.kind !== 'mult-fact') return false;
    const v = intAns(answer);
    if (v === null) return false;
    const p = g.a * g.b;
    return v === p + g.b || v === p - g.b || v === p + g.a || v === p - g.a;
  },
};

export function misconceptionIds(): string[] {
  return Object.keys(PREDICATES);
}

/** First matching misconception in the item's priority list, or null. Never called on a correct answer. */
export function detect(item: Item, answer: Answer): string | null {
  for (const id of item.misconceptions) {
    const p = PREDICATES[id];
    if (!p) throw new Error(`unknown misconception ${id} on template ${item.templateId}`);
    if (p(item, answer)) return id;
  }
  return null;
}

/** Every misconception in the item's list that matches. Used by the collision tests. */
export function detectAll(item: Item, answer: Answer): string[] {
  return item.misconceptions.filter((id) => {
    const p = PREDICATES[id];
    return p ? p(item, answer) : false;
  });
}
