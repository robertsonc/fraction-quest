import { describe, it, expect } from 'vitest';
import { isMastered, pushAttempt, type AttemptSummary } from '../../src/engine/mastery';
import { freshProgress, isReviewDue, onMastered, onReviewResult, reviewPassed } from '../../src/engine/review';

const ok = (rep: AttemptSummary['rep'] = 'area'): AttemptSummary => ({ correct: true, aided: false, guess: false, rep });
const miss = (): AttemptSummary => ({ correct: false, aided: false, guess: false, rep: 'area' });
const aided = (): AttemptSummary => ({ correct: true, aided: true, guess: false, rep: 'bar' });

describe('mastery window', () => {
  it('needs five items', () => {
    expect(isMastered([ok(), ok('bar'), ok(), ok('bar')])).toBe(false);
  });
  it('4 of 5 unaided across two reps is mastered', () => {
    expect(isMastered([ok(), ok('bar'), miss(), ok(), ok('bar')])).toBe(true);
  });
  it('one representation only is not mastered', () => {
    expect(isMastered([ok(), ok(), ok(), ok(), ok()])).toBe(false);
  });
  it('hinted answers do not count toward the four', () => {
    expect(isMastered([ok(), aided(), aided(), ok('line'), ok()])).toBe(false);
    expect(isMastered([ok(), aided(), ok('line'), ok('line'), ok()])).toBe(true);
  });
  it('a guess never counts', () => {
    const g: AttemptSummary = { correct: true, aided: false, guess: true, rep: 'line' };
    expect(isMastered([ok(), g, g, ok('bar'), ok()])).toBe(false);
  });
  it('the window keeps the last five', () => {
    let w: AttemptSummary[] = [];
    for (let i = 0; i < 7; i++) w = pushAttempt(w, i < 2 ? miss() : ok(i % 2 ? 'bar' : 'area'));
    expect(w).toHaveLength(5);
    expect(isMastered(w)).toBe(true);
  });
});

describe('spaced review', () => {
  it('schedules +1, +3, +7 sessions after mastery and ends retained', () => {
    let p = onMastered(freshProgress(), 10);
    expect(p.status).toBe('mastered');
    expect(p.reviewDueSession).toBe(11);
    expect(isReviewDue(p, 10)).toBe(false);
    expect(isReviewDue(p, 11)).toBe(true);
    p = onReviewResult(p, true, 11);
    expect(p.status).toBe('review');
    expect(p.reviewDueSession).toBe(13);
    p = onReviewResult(p, true, 13);
    expect(p.reviewDueSession).toBe(17);
    p = onReviewResult(p, true, 17);
    expect(p.status).toBe('retained');
    expect(p.reviewDueSession).toBeNull();
  });

  it('a late review still lands at least one session ahead', () => {
    let p = onMastered(freshProgress(), 10);
    p = onReviewResult(p, true, 20); // due at 11, done at 20
    expect(p.reviewDueSession).toBe(21);
  });

  it('a failed review demotes to practice, not fresh, and clears the window', () => {
    let p = onMastered({ ...freshProgress(), window: [{ correct: true, aided: false, guess: false, rep: 'area' }] }, 10);
    p = onReviewResult(p, false, 11);
    expect(p.status).toBe('practice');
    expect(p.window).toEqual([]);
    expect(p.reviewStage).toBe(0);
    expect(p.reviewDueSession).toBeNull();
  });

  it('review passes at 2 of 3', () => {
    expect(reviewPassed([true, false, true])).toBe(true);
    expect(reviewPassed([false, true, false])).toBe(false);
  });
});
