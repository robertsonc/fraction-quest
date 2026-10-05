/**
 * Skill status and spaced review (DESIGN.md 5.3 M3, 5.4).
 * fresh -> learning -> practice -> mastered -> review(1) -> review(3) -> review(7) -> retained
 * A failed review demotes to practice (the window is cleared), never to fresh.
 */
import type { AttemptSummary } from './mastery';

export type SkillStatus = 'fresh' | 'learning' | 'practice' | 'mastered' | 'review' | 'retained';

export const REVIEW_OFFSETS: readonly number[] = [1, 3, 7];
export const REVIEW_ITEMS = 3;
export const REVIEW_PASS = 2;

export interface SkillProgress {
  status: SkillStatus;
  window: AttemptSummary[];
  /** 0..3: how many reviews have been passed since mastery. */
  reviewStage: number;
  masteredAtSession: number | null;
  reviewDueSession: number | null;
  /** How many times the learner has been coach-flagged on this skill. */
  coachFlags: number;
  /** Set when the learner has started the lesson at least once. */
  lessonSeen: boolean;
}

export function freshProgress(): SkillProgress {
  return { status: 'fresh', window: [], reviewStage: 0, masteredAtSession: null, reviewDueSession: null, coachFlags: 0, lessonSeen: false };
}

export function onMastered(p: SkillProgress, session: number): SkillProgress {
  return { ...p, status: 'mastered', reviewStage: 0, masteredAtSession: session, reviewDueSession: session + (REVIEW_OFFSETS[0] ?? 1) };
}

export function isReviewDue(p: SkillProgress, session: number): boolean {
  return (p.status === 'mastered' || p.status === 'review') && p.reviewDueSession !== null && session >= p.reviewDueSession;
}

export function onReviewResult(p: SkillProgress, passed: boolean, session: number): SkillProgress {
  if (!passed) {
    return { ...p, status: 'practice', window: [], reviewStage: 0, reviewDueSession: null };
  }
  const stage = p.reviewStage + 1;
  if (stage >= REVIEW_OFFSETS.length) {
    return { ...p, status: 'retained', reviewStage: stage, reviewDueSession: null };
  }
  const base = p.masteredAtSession ?? session;
  const due = Math.max(base + (REVIEW_OFFSETS[stage] ?? 0), session + 1);
  return { ...p, status: 'review', reviewStage: stage, reviewDueSession: due };
}

export function reviewPassed(results: readonly boolean[]): boolean {
  return results.filter(Boolean).length >= REVIEW_PASS;
}
