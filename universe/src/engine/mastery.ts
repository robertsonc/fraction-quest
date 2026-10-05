/**
 * Mastery (DESIGN.md rules M1, M2): 4 of the last 5 counted items correct, unaided, not guesses,
 * and those good answers span at least two representations.
 */
import type { Rep } from './types';

export interface AttemptSummary {
  correct: boolean;
  aided: boolean;
  guess: boolean;
  rep: Rep;
}

export const WINDOW = 5;
export const NEEDED = 4;
export const REPS_NEEDED = 2;

export function pushAttempt(window: readonly AttemptSummary[], a: AttemptSummary): AttemptSummary[] {
  const next = [...window, a];
  return next.length > WINDOW ? next.slice(next.length - WINDOW) : next;
}

export function unaidedCorrect(a: AttemptSummary): boolean {
  return a.correct && !a.aided && !a.guess;
}

export function goodCount(window: readonly AttemptSummary[]): number {
  return window.filter(unaidedCorrect).length;
}

export function repsCovered(window: readonly AttemptSummary[]): Rep[] {
  return [...new Set(window.filter(unaidedCorrect).map((a) => a.rep))];
}

export function isMastered(window: readonly AttemptSummary[]): boolean {
  if (window.length < WINDOW) return false;
  return goodCount(window) >= NEEDED && repsCovered(window).length >= REPS_NEEDED;
}
