/**
 * Hint ladder (DESIGN.md rule H1, H2). Level 1 restates with the picture, level 2 points at the step.
 * Level 3 is guided mode, handled by the UI from the trace. Hints never state the key value: for
 * equivalent fractions the key value is the scale factor k, so hints may name b and bk but never k.
 */
import { scale, format } from './rational';
import type { Item } from './types';
import { t } from '../content/strings';

export const MAX_HINT = 2;

export function hint(item: Item, level: 1 | 2): string {
  const g = item.given;
  switch (g.kind) {
    case 'missing-part': {
      if (level === 1) return t('hint.equiv.missing-part.1');
      const to = scale(g.from, g.k);
      return g.missing === 'numerator'
        ? t('hint.equiv.missing-part.2.numerator', { b: g.from.d, bk: to.d })
        : t('hint.equiv.missing-part.2.denominator', { a: g.from.n, ak: to.n });
    }
    case 'is-equivalent':
      return level === 1 ? t('hint.equiv.is-equivalent.1') : t('hint.equiv.is-equivalent.2');
    case 'find-pair':
      return level === 1 ? t('hint.equiv.find-pair.1', { a_over_b: format(g.from) }) : t('hint.equiv.find-pair.2');
    case 'name-fraction':
      return level === 1 ? t('hint.meaning.name-fraction.1') : t('hint.meaning.name-fraction.2');
    case 'mult-fact':
      return level === 1 ? t('hint.ops.mult-fact.1', { a: g.a, b: g.b }) : t('hint.ops.mult-fact.2', { a: g.a, b: g.b });
  }
}

/** The value a hint must never contain, as text, for the hint tests. */
export function keyValue(item: Item): string | null {
  const g = item.given;
  if (g.kind === 'missing-part') return String(g.k);
  return null;
}
