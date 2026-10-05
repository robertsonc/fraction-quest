import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import templates from '../../../content/templates/nf.equiv.json';
import { generate } from '../../src/engine/generators';
import { grade } from '../../src/engine/grade';
import { detect, detectAll, PREDICATES } from '../../src/engine/misconceptions/detect';
import { produce } from '../../src/engine/misconceptions/produce';
import { hint, keyValue } from '../../src/engine/hints';
import { equals, frac, scale } from '../../src/engine/rational';
import type { Item, TemplateSpec } from '../../src/engine/types';
import { bigEqual, oracleAnswer } from './oracle';

const RUNS = Number(process.env.FQU_RUNS ?? 2000);
const SPECS = templates as TemplateSpec[];
const seedArb = fc.integer({ min: 0, max: 0xffffffff });

function sameAnswer(a: Item['answer'], b: NonNullable<ReturnType<typeof oracleAnswer>>): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'int' && b.kind === 'int') return a.value === b.value;
  if (a.kind === 'bool' && b.kind === 'bool') return a.value === b.value;
  if (a.kind === 'frac' && b.kind === 'frac') return a.n === b.n && a.d === b.d;
  return false;
}

describe.each(SPECS.map((s) => [s.id, s] as const))('template %s', (_id, spec) => {
  it('is deterministic for a seed', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const a = generate(spec, seed);
      const b = generate(spec, seed);
      expect(b).toEqual(a);
    }), { numRuns: 200 });
  });

  it('agrees with the oracle and grades its own answer correct', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const item = generate(spec, seed);
      const oracle = oracleAnswer(item);
      expect(oracle).not.toBeNull();
      expect(sameAnswer(item.answer, oracle!)).toBe(true);
      expect(grade(item, item.answer).correct).toBe(true);
      if (item.given.kind === 'find-pair') {
        // Every scaling with a bigger bottom (within maxD) is accepted; the given fraction itself is not.
        for (let k = 2; item.given.from.d * k <= item.given.maxD; k++) {
          const s = scale(item.given.from, k);
          expect(grade(item, { kind: 'frac', n: s.n, d: s.d }).correct).toBe(true);
        }
        expect(grade(item, { kind: 'frac', n: item.given.from.n, d: item.given.from.d }).correct).toBe(false);
      }
      if (item.given.kind === 'is-equivalent') {
        // The engine's verdict matches BigInt cross-multiplication.
        expect(item.answer).toEqual({ kind: 'bool', value: bigEqual(item.given.a.n, item.given.a.d, item.given.b.n, item.given.b.d) });
      }
    }), { numRuns: RUNS });
  });

  it('never fires a misconception on the correct answer', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const item = generate(spec, seed);
      for (const id of item.misconceptions) {
        expect(PREDICATES[id]!(item, item.answer)).toBe(false);
      }
    }), { numRuns: RUNS });
  });

  describe.each(spec.misconceptions.map((m) => [m] as const))('misconception %s', (mis) => {
    it('produces a wrong answer that differs from the correct one and is detected', () => {
      let applied = 0;
      let overlaps = 0;
      fc.assert(fc.property(seedArb, (seed) => {
        const item = generate(spec, seed);
        const wrong = produce(mis, item);
        if (wrong === null) return; // the misconception cannot apply to this item shape
        applied++;
        const g = grade(item, wrong);
        expect(g.invalid).toBeUndefined();
        expect(g.correct).toBe(false);
        if (wrong.kind === 'frac' && item.answer.kind === 'frac') {
          expect(equals(frac(wrong.n, wrong.d), frac(item.answer.n, item.answer.d)) && item.given.kind !== 'find-pair').toBe(false);
        }
        const all = detectAll(item, wrong);
        expect(all).toContain(mis);
        if (all.length > 1) overlaps++;
        // Whatever detect reports must be one of the matching predicates (priority order decides).
        expect(all).toContain(detect(item, wrong));
      }), { numRuns: RUNS });
      // Coverage is checked on a fixed sweep of seeds, not on fast-check's random sample, so a rare
      // misconception (one that only applies to some item shapes) cannot make a low-run local pass flaky.
      const applies = Array.from({ length: 2000 }, (_, i) => i * 7919 + 1).some((seed) => produce(mis, generate(spec, seed)) !== null);
      expect(applies, `${mis} never applies to ${spec.id}`).toBe(true);
      if (applied === 0) console.warn(`[coverage] ${spec.id} / ${mis}: no application in ${RUNS} random runs`);
      if (overlaps > 0) {
        // Deliberate ambiguity: reported, not failed (DESIGN.md 3.2).
        console.warn(`[collision] ${spec.id} / ${mis}: ${overlaps} of ${applied} wrong answers also match another misconception`);
      }
    });
  });

  it('has a trace whose final scene equals the answer and whose steps chain', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const item = generate(spec, seed);
      expect(item.trace.length).toBeGreaterThan(0);
      for (let i = 0; i + 1 < item.trace.length; i++) {
        expect(item.trace[i + 1]!.before).toEqual(item.trace[i]!.after);
      }
      const last = item.trace[item.trace.length - 1]!.after;
      const g = item.given;
      switch (g.kind) {
        case 'missing-part': {
          const to = scale(g.from, g.k);
          expect(last.shaded).toBe(to.n);
          expect(last.d).toBe(to.d);
          expect(last.equation).toEqual([`${g.from.n}/${g.from.d}`, '=', `${to.n}/${to.d}`]);
          const v = g.missing === 'numerator' ? last.shaded : last.d;
          expect(item.answer).toEqual({ kind: 'int', value: v });
          break;
        }
        case 'is-equivalent': {
          const sign = last.equation[1];
          expect(sign === '=').toBe(item.answer.kind === 'bool' && item.answer.value);
          expect(equals(frac(last.shaded, last.d), g.b)).toBe(true);
          break;
        }
        case 'find-pair': {
          expect(item.answer.kind).toBe('frac');
          if (item.answer.kind === 'frac') {
            expect(last.shaded).toBe(item.answer.n);
            expect(last.d).toBe(item.answer.d);
          }
          break;
        }
        case 'name-fraction':
          expect(last.equation).toEqual([`${g.shaded}/${g.d}`]);
          expect(last.shaded).toBe(g.shaded);
          expect(last.d).toBe(g.d);
          break;
        case 'mult-fact':
          expect(last.shaded).toBe(g.a * g.b);
          expect(last.equation[last.equation.length - 1]).toBe(String(g.a * g.b));
          break;
      }
      for (const s of item.trace) {
        expect(s.say).not.toMatch(/[–—]/);
      }
    }), { numRuns: RUNS });
  });

  it('hints never state the key value and contain no dashes', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const item = generate(spec, seed);
      const key = keyValue(item);
      for (const level of [1, 2] as const) {
        const h = hint(item, level);
        expect(h).not.toMatch(/[–—]/);
        if (key !== null && item.given.kind === 'missing-part') {
          // The factor may only appear if it coincides with a number the hint is allowed to name.
          const g = item.given;
          const to = scale(g.from, g.k);
          const allowed = new Set([g.from.n, g.from.d, to.n, to.d].map(String));
          const numbers = h.match(/\d+/g) ?? [];
          for (const num of numbers) {
            if (num === key) expect(allowed.has(num)).toBe(true);
          }
        }
      }
    }), { numRuns: 300 });
  });
});
