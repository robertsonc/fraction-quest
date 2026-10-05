/**
 * Equivalent fractions (skill nf.equiv). Three item kinds, each with a step trace that solves it.
 * All numbers are exact integers. Captions come from content strings.
 */
import { frac, scale, equals, format, type Frac } from '../rational';
import type { Rng } from '../rng';
import type { Item, Rep, Scene, Step, Distractor, TemplateSpec } from '../types';
import { t, sayFrac } from '../../content/strings';
import { intParam, strParam, listParam } from './params';

function scene(rep: Rep, d: number, shaded: number, equation: string[], extra: Partial<Scene> = {}): Scene {
  return { rep, d, shaded, wholes: 1, equation, ...extra };
}

/** Steps that scale a/b up by k in one representation, ending with the written equation. */
export function traceScaleUp(from: Frac, k: number, rep: Rep, unknown: 'numerator' | 'denominator' | null): Step[] {
  const to = scale(from, k);
  const target = unknown === 'numerator' ? `?/${to.d}` : unknown === 'denominator' ? `${to.n}/?` : format(to);
  const s0 = scene(rep, from.d, from.n, [format(from), '=', target]);
  const s1 = scene(rep, to.d, to.n, [format(from), '=', target], { highlight: [] });
  const s2 = scene(rep, to.d, to.n, [format(from), '=', format(to)]);
  return [
    { kind: 'show', say: t('trace.show.frac', { frac: sayFrac(from.n, from.d) }), before: s0, after: s0 },
    { kind: 'split', say: t('trace.split', { k, d: to.d }), before: s0, after: s1 },
    { kind: 'count', say: t('trace.count.shaded', { shaded: to.n, d: to.d }), before: s1, after: s1 },
    { kind: 'write', say: t('trace.write.equiv', { left: sayFrac(from.n, from.d), right: sayFrac(to.n, to.d) }), before: s1, after: s2 },
  ];
}

/** a/b = ?/bk or a/b = ak/? */
export function genMissingPart(spec: TemplateSpec, seed: number, rng: Rng): Item {
  const dRange = intParam(spec.params, 'd', 2, 12);
  const kRange = intParam(spec.params, 'k', 2, 6);
  const missingParam = strParam(spec.params, 'missing', 'either');
  const d = rng.int(dRange.min, dRange.max);
  const n = rng.int(1, d - 1);
  const k = rng.int(kRange.min, kRange.max);
  const missing = missingParam === 'either' ? (rng.chance(0.5) ? 'numerator' : 'denominator') : (missingParam as 'numerator' | 'denominator');
  const from = frac(n, d);
  const to = scale(from, k);
  const known = missing === 'numerator' ? to.d : to.n;
  const answer = missing === 'numerator' ? to.n : to.d;
  return {
    id: `${spec.id}:${seed}`,
    templateId: spec.id,
    skillId: spec.skillId,
    kind: 'missing-part',
    rep: spec.rep,
    seed,
    given: { kind: 'missing-part', from, missing, known, k },
    answer: { kind: 'int', value: answer },
    trace: traceScaleUp(from, k, spec.rep, missing),
    misconceptions: spec.misconceptions,
  };
}

/** Yes or no: are a and b the same amount? The wrong pair is built from a named misconception. */
export function genIsEquivalent(spec: TemplateSpec, seed: number, rng: Rng): Item {
  const dRange = intParam(spec.params, 'd', 2, 8);
  const kRange = intParam(spec.params, 'k', 2, 4);
  const distractors = listParam(spec.params, 'distractors', ['equal', 'adds-to-both', 'scales-numerator-only', 'scales-denominator-only', 'different-scale-factors']) as Distractor[];
  const d = rng.int(dRange.min, dRange.max);
  const n = rng.int(1, d - 1);
  const k = rng.int(kRange.min, kRange.max);
  const a = frac(n, d);
  // Half the items are true pairs so "no" is never a safe default.
  let distractor: Distractor = rng.chance(0.5) ? 'equal' : rng.pick(distractors.filter((x) => x !== 'equal'));
  // Phase 1 pictures show one whole, so a distractor that would reach 1 or more falls back to the
  // bottom-only scaling, which is always a proper fraction.
  if ((distractor === 'scales-numerator-only' && n * k >= d) || (distractor === 'different-scale-factors' && n * k >= d * (k === kRange.max ? k - 1 : k + 1))) {
    distractor = 'scales-denominator-only';
  }
  let b: Frac;
  switch (distractor) {
    case 'equal': b = scale(a, k); break;
    case 'adds-to-both': b = frac(n + k, d + k); break;
    case 'scales-numerator-only': b = frac(n * k, d); break;
    case 'scales-denominator-only': b = frac(n, d * k); break;
    case 'different-scale-factors': {
      const k2 = k === kRange.max ? k - 1 : k + 1;
      b = frac(n * k, d * k2);
      break;
    }
  }
  // A distractor must never be equal in value (the collision tests prove this for every seed).
  if (distractor !== 'equal' && equals(a, b)) throw new Error(`distractor ${distractor} collided on ${format(a)}`);
  const same = distractor === 'equal';
  const trace = same ? traceCompareSame(a, b, spec.rep, k) : traceCompareDiff(a, b, spec.rep);
  return {
    id: `${spec.id}:${seed}`,
    templateId: spec.id,
    skillId: spec.skillId,
    kind: 'is-equivalent',
    rep: spec.rep,
    seed,
    given: { kind: 'is-equivalent', a, b, distractor },
    answer: { kind: 'bool', value: same },
    trace,
    misconceptions: spec.misconceptions,
  };
}

function traceCompareSame(a: Frac, b: Frac, rep: Rep, k: number): Step[] {
  const eq = [format(a), '?', format(b)];
  const s0 = scene(rep, a.d, a.n, eq);
  const s1 = scene(rep, b.d, b.n, eq);
  const s2 = scene(rep, b.d, b.n, [format(a), '=', format(b)]);
  return [
    { kind: 'show', say: t('trace.show.pair', { left: sayFrac(a.n, a.d), right: sayFrac(b.n, b.d) }), before: s0, after: s0 },
    { kind: 'split', say: t('trace.split', { k, d: b.d }), before: s0, after: s1 },
    { kind: 'compare', say: t('trace.compare.same'), before: s1, after: s1 },
    { kind: 'write', say: t('trace.write.equiv', { left: sayFrac(a.n, a.d), right: sayFrac(b.n, b.d) }), before: s1, after: s2 },
  ];
}

function traceCompareDiff(a: Frac, b: Frac, rep: Rep): Step[] {
  // Draw both on a common denominator so the difference is visible, then write the verdict.
  const l = a.d * b.d;
  const an = a.n * b.d;
  const bn = b.n * a.d;
  const eq = [format(a), '?', format(b)];
  const s0 = scene(rep, a.d, a.n, eq);
  const s1 = scene(rep, l, an, eq);
  const s2 = scene(rep, l, bn, eq);
  const s3 = scene(rep, l, bn, [format(a), '≠', format(b)]);
  return [
    { kind: 'show', say: t('trace.show.pair', { left: sayFrac(a.n, a.d), right: sayFrac(b.n, b.d) }), before: s0, after: s0 },
    { kind: 'split', say: t('trace.split', { k: b.d, d: l }), before: s0, after: s1 },
    { kind: 'compare', say: t('trace.compare.diff'), before: s1, after: s2 },
    { kind: 'write', say: t('trace.write.notequiv', { left: sayFrac(a.n, a.d), right: sayFrac(b.n, b.d) }), before: s2, after: s3 },
  ];
}

/** "Write a fraction equal to a/b with a bigger bottom." Any correct pair is accepted. */
export function genFindPair(spec: TemplateSpec, seed: number, rng: Rng): Item {
  const dRange = intParam(spec.params, 'd', 2, 10);
  const maxD = intParam(spec.params, 'maxD', 60, 60).max;
  const d = rng.int(dRange.min, dRange.max);
  const n = rng.int(1, d - 1);
  const from = frac(n, d);
  // The canonical answer (used by the walkthrough and the final-state test) scales by 2; any k works for grading.
  const k = 2;
  return {
    id: `${spec.id}:${seed}`,
    templateId: spec.id,
    skillId: spec.skillId,
    kind: 'find-pair',
    rep: spec.rep,
    seed,
    given: { kind: 'find-pair', from, maxD },
    answer: { kind: 'frac', n: from.n * k, d: from.d * k },
    trace: traceScaleUp(from, k, spec.rep, null),
    misconceptions: spec.misconceptions,
  };
}
