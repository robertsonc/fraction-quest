import { equals, frac } from './rational';
import type { Answer, Grade, Item } from './types';
import { detect } from './misconceptions/detect';
import { t } from '../content/strings';

/**
 * Grades an answer. Shape problems (zero denominator, wrong answer kind) return `invalid` and are not
 * attempts, matching FQ2's toVal. Wrong answers are classified by the misconception predicates.
 */
export function grade(item: Item, answer: Answer): Grade {
  if (answer.kind !== item.answer.kind) return { correct: false, invalid: t('feedback.invalid.empty'), misconceptionId: null };
  if (answer.kind === 'frac' && answer.d === 0) return { correct: false, invalid: t('feedback.invalid.zero'), misconceptionId: null };

  let correct: boolean;
  switch (item.answer.kind) {
    case 'int':
      correct = answer.kind === 'int' && answer.value === item.answer.value;
      break;
    case 'bool':
      correct = answer.kind === 'bool' && answer.value === item.answer.value;
      break;
    case 'frac': {
      if (answer.kind !== 'frac') { correct = false; break; }
      const g = item.given;
      if (g.kind === 'find-pair') {
        // Any equivalent fraction with a bigger bottom is right; the canonical answer is only for the walkthrough.
        const same = equals(frac(answer.n, answer.d), g.from);
        if (same && answer.d <= g.from.d) return { correct: false, misconceptionId: answer.d === g.from.d && answer.n === g.from.n ? detect(item, answer) : null };
        correct = same && answer.d > g.from.d && answer.d <= g.maxD;
      } else {
        correct = equals(frac(answer.n, answer.d), frac(item.answer.n, item.answer.d)) && answer.n === item.answer.n && answer.d === item.answer.d;
      }
      break;
    }
  }
  if (correct) return { correct: true, misconceptionId: null };
  return { correct: false, misconceptionId: detect(item, answer) };
}

/** True when the item's rep is a picture the learner can read the answer from (used by mastery's rep rule). */
export function isPictureRep(item: Item): boolean {
  return item.rep !== 'symbol';
}
