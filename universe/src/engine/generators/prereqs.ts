/**
 * Prerequisite skills used by remediation in Phase 1: meaning of a fraction (nf.meaning) and
 * multiplication facts (ops.multfacts). Full lessons for these are Phase 2; here they carry
 * micro-lesson walkthroughs and quick-check items.
 */
import type { Rng } from '../rng';
import type { Item, Scene, Step, TemplateSpec } from '../types';
import { t, pieceName, sayFrac } from '../../content/strings';
import { intParam } from './params';

export function genNameFraction(spec: TemplateSpec, seed: number, rng: Rng): Item {
  const dRange = intParam(spec.params, 'd', 2, 12);
  const d = rng.int(dRange.min, dRange.max);
  const shaded = rng.int(1, d - 1);
  const s0: Scene = { rep: spec.rep, d, shaded, wholes: 1, equation: ['?'] };
  const s1: Scene = { ...s0, highlight: Array.from({ length: d }, (_, i) => i) };
  const s2: Scene = { ...s0, highlight: Array.from({ length: shaded }, (_, i) => i), equation: [`${shaded}/${d}`] };
  const trace: Step[] = [
    { kind: 'show', say: t('trace.name.pieces', { d, piece: pieceName(d, 1) }), before: s0, after: s1 },
    { kind: 'count', say: t('trace.name.shaded', { shaded, frac: sayFrac(shaded, d) }), before: s1, after: s2 },
  ];
  return {
    id: `${spec.id}:${seed}`,
    templateId: spec.id,
    skillId: spec.skillId,
    kind: 'name-fraction',
    rep: spec.rep,
    seed,
    given: { kind: 'name-fraction', shaded, d },
    answer: { kind: 'frac', n: shaded, d },
    trace,
    misconceptions: spec.misconceptions,
  };
}

export function genMultFact(spec: TemplateSpec, seed: number, rng: Rng): Item {
  const aRange = intParam(spec.params, 'a', 2, 9);
  const bRange = intParam(spec.params, 'b', 2, 9);
  const a = rng.int(aRange.min, aRange.max);
  let b = rng.int(bRange.min, bRange.max);
  // 2 + 2 = 2 x 2, so "adds instead of multiplying" would collide with the right answer. Exclude it.
  if (a === 2 && b === 2) b = 3;
  const product = a * b;
  // Array model: a groups of b, drawn as a set of a*b pieces grouped by b.
  const s0: Scene = { rep: 'set', d: product, shaded: 0, wholes: 1, groups: { count: a, perGroup: b }, equation: [`${a}`, '×', `${b}`, '=', '?'] };
  const s1: Scene = { ...s0, shaded: product };
  const s2: Scene = { ...s1, equation: [`${a}`, '×', `${b}`, '=', `${product}`] };
  const trace: Step[] = [
    { kind: 'show', say: t('trace.mult.groups', { a, b }), before: s0, after: s0 },
    { kind: 'shade', say: t('trace.mult.count', { product }), before: s0, after: s1 },
    { kind: 'write', say: t('trace.mult.write', { a, b, product }), before: s1, after: s2 },
  ];
  return {
    id: `${spec.id}:${seed}`,
    templateId: spec.id,
    skillId: spec.skillId,
    kind: 'mult-fact',
    rep: spec.rep,
    seed,
    given: { kind: 'mult-fact', a, b },
    answer: { kind: 'int', value: product },
    trace,
    misconceptions: spec.misconceptions,
  };
}
