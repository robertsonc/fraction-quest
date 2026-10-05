/**
 * The adaptive engine as a pure reducer: (state, event) -> { state, effects }.
 * Implements the state machine in DESIGN.md 5.1 exactly, with the refinements in 5.2:
 *   R1 a guess plays the guided replay of the same item as its micro-lesson,
 *   R2 Prerequisite is a micro-lesson plus quick check one level down,
 *   D1 depth is capped at 2 and a skill with no prerequisite left goes to CoachFlag.
 * No DOM, no timers: elapsed time arrives on the answer event.
 */

export const GUESS_MS = 3500;
export const MAX_DEPTH = 2;
export const QUICK_CHECK_ITEMS = 3;
export const QUICK_CHECK_PASS = 2;
/** Lesson id meaning "replay this item's own trace step by step" (refinement R1). */
export const GUIDED_REPLAY = 'guided-replay';

export type Cause = { kind: 'miss2' } | { kind: 'misconception'; id: string } | { kind: 'guess' } | { kind: 'prereq' };

export interface Frame {
  skillId: string;
  lessonId: string;
  cause: Cause;
  /** Quick-check results so far at this level. */
  results: boolean[];
}

export type Phase =
  | { t: 'practice' }
  | { t: 'hint'; level: 1 | 2 }
  | { t: 'microLesson' }
  | { t: 'quickCheck' }
  | { t: 'returnItem' }
  | { t: 'coachFlag' }
  | { t: 'easyWin' }
  | { t: 'done' };

export interface EngineState {
  skillId: string;
  phase: Phase;
  /** Wrong answers on the item currently in play. */
  misses: number;
  /** Remediation frames. stack[0] is always the practiced skill; depth = stack.length - 1. */
  stack: Frame[];
  /** Template of the item that sent the learner into remediation; the return item uses it. */
  returnTemplateId: string | null;
  /** Skills visited on this side trip, for the breadcrumb. */
  path: string[];
  coachFlagged: boolean;
}

export type Event =
  | { type: 'answer'; correct: boolean; elapsedMs: number; misconceptionId: string | null; templateId: string }
  | { type: 'microLessonDone' }
  | { type: 'quickAnswer'; correct: boolean; misconceptionId: string | null }
  | { type: 'easyWinDone' }
  | { type: 'break' };

export type Effect =
  | { type: 'feedback'; kind: 'right' | 'wrong' | 'guess' }
  | { type: 'nextItem'; skillId: string }
  | { type: 'showHint'; level: 1 | 2 }
  | { type: 'playMicroLesson'; skillId: string; lessonId: string; cause: Cause; depth: number }
  | { type: 'quickItem'; skillId: string; index: number }
  | { type: 'returnItem'; skillId: string; templateId: string; path: string[] }
  | { type: 'flagCoach'; skillId: string; path: string[] }
  | { type: 'offerEasyWin' }
  | { type: 'exit' };

/** What the reducer needs to know about content. Supplied by the content module; faked in tests. */
export interface Graph {
  prereqsOf(skillId: string): string[];
  /** The skill's general micro-lesson, used for a second miss and for prerequisite drops. */
  skillMicroLesson(skillId: string): string;
  /** The targeted micro-lesson for a misconception, if the catalog has one. */
  misconceptionMicroLesson(misconceptionId: string): string | null;
}

export function initialState(skillId: string): EngineState {
  return {
    skillId,
    phase: { t: 'practice' },
    misses: 0,
    stack: [{ skillId, lessonId: '', cause: { kind: 'miss2' }, results: [] }],
    returnTemplateId: null,
    path: [],
    coachFlagged: false,
  };
}

export function depthOf(state: EngineState): number {
  return state.stack.length - 1;
}

export function isGuess(correct: boolean, elapsedMs: number): boolean {
  return !correct && elapsedMs < GUESS_MS;
}

interface Result {
  state: EngineState;
  effects: Effect[];
}

function top(state: EngineState): Frame {
  const f = state.stack[state.stack.length - 1];
  if (!f) throw new Error('empty remediation stack');
  return f;
}

function enterMicroLesson(state: EngineState, cause: Cause, lessonId: string, templateId: string): Result {
  const frame: Frame = { ...top(state), lessonId, cause, results: [] };
  const stack = [...state.stack.slice(0, -1), frame];
  const next: EngineState = { ...state, phase: { t: 'microLesson' }, misses: 0, stack, returnTemplateId: state.returnTemplateId ?? templateId };
  return { state: next, effects: [{ type: 'playMicroLesson', skillId: frame.skillId, lessonId, cause, depth: depthOf(next) }] };
}

function onWrongInPractice(state: EngineState, ev: Extract<Event, { type: 'answer' }>, graph: Graph): Result {
  const misses = state.misses + 1;
  const guess = isGuess(ev.correct, ev.elapsedMs);
  const base: EngineState = { ...state, misses };
  if (guess) {
    const r = enterMicroLesson(base, { kind: 'guess' }, GUIDED_REPLAY, ev.templateId);
    return { state: r.state, effects: [{ type: 'feedback', kind: 'guess' }, ...r.effects] };
  }
  if (ev.misconceptionId) {
    const lesson = graph.misconceptionMicroLesson(ev.misconceptionId) ?? graph.skillMicroLesson(top(state).skillId);
    const r = enterMicroLesson(base, { kind: 'misconception', id: ev.misconceptionId }, lesson, ev.templateId);
    return { state: r.state, effects: [{ type: 'feedback', kind: 'wrong' }, ...r.effects] };
  }
  if (misses >= 2) {
    const r = enterMicroLesson(base, { kind: 'miss2' }, graph.skillMicroLesson(top(state).skillId), ev.templateId);
    return { state: r.state, effects: [{ type: 'feedback', kind: 'wrong' }, ...r.effects] };
  }
  return { state: { ...base, phase: { t: 'hint', level: 1 } }, effects: [{ type: 'feedback', kind: 'wrong' }, { type: 'showHint', level: 1 }] };
}

function onCorrectInPractice(state: EngineState): Result {
  return {
    state: { ...state, phase: { t: 'practice' }, misses: 0, returnTemplateId: null, path: [] },
    effects: [{ type: 'feedback', kind: 'right' }, { type: 'nextItem', skillId: state.skillId }],
  };
}

function quickCheckDecide(state: EngineState, graph: Graph): Result {
  const frame = top(state);
  const right = frame.results.filter(Boolean).length;
  const wrong = frame.results.length - right;
  const depth = depthOf(state);
  if (right >= QUICK_CHECK_PASS) {
    if (depth === 0) {
      const templateId = state.returnTemplateId ?? '';
      return {
        state: { ...state, phase: { t: 'returnItem' }, misses: 0 },
        effects: [{ type: 'returnItem', skillId: state.skillId, templateId, path: state.path }],
      };
    }
    // Prerequisite passed: pop and re-run the parent's quick check with fresh items.
    const stack = state.stack.slice(0, -1);
    const parent = stack[stack.length - 1];
    if (!parent) throw new Error('remediation stack underflow');
    stack[stack.length - 1] = { ...parent, results: [] };
    const next: EngineState = { ...state, stack, phase: { t: 'quickCheck' } };
    return { state: next, effects: [{ type: 'quickItem', skillId: parent.skillId, index: 0 }] };
  }
  if (wrong > QUICK_CHECK_ITEMS - QUICK_CHECK_PASS) {
    if (depth < MAX_DEPTH) {
      const visited = new Set([state.skillId, ...state.path]);
      // The failed skill's own prerequisites first; when it has none left (a root skill), the next
      // unvisited prerequisite of the skills above it on the stack, so a second weak prerequisite is
      // still found before the coach is called.
      let prereq: string | undefined;
      for (let i = state.stack.length - 1; i >= 0 && prereq === undefined; i--) {
        prereq = graph.prereqsOf(state.stack[i]!.skillId).find((p) => !visited.has(p));
      }
      if (prereq !== undefined) {
        const lessonId = graph.skillMicroLesson(prereq);
        const newFrame: Frame = { skillId: prereq, lessonId, cause: { kind: 'prereq' }, results: [] };
        const next: EngineState = { ...state, stack: [...state.stack, newFrame], phase: { t: 'microLesson' }, path: [...state.path, prereq] };
        return { state: next, effects: [{ type: 'playMicroLesson', skillId: prereq, lessonId, cause: { kind: 'prereq' }, depth: depthOf(next) }] };
      }
      // Nothing left to drop to: the only non-trapping option is the coach flag (rule D1).
    }
    const next: EngineState = { ...state, phase: { t: 'easyWin' }, coachFlagged: true };
    return { state: next, effects: [{ type: 'flagCoach', skillId: state.skillId, path: state.path }, { type: 'offerEasyWin' }] };
  }
  return { state, effects: [{ type: 'quickItem', skillId: frame.skillId, index: frame.results.length }] };
}

export function step(state: EngineState, event: Event, graph: Graph): Result {
  const phase = state.phase;
  switch (event.type) {
    case 'answer': {
      if (phase.t === 'practice' || phase.t === 'returnItem') {
        return event.correct ? onCorrectInPractice(state) : onWrongInPractice(state, event, graph);
      }
      if (phase.t === 'hint') {
        if (event.correct) return onCorrectInPractice(state);
        // Any miss while hinted is miss 2 (the hint was shown after miss 1).
        const guess = isGuess(event.correct, event.elapsedMs);
        const cause: Cause = guess ? { kind: 'guess' } : event.misconceptionId ? { kind: 'misconception', id: event.misconceptionId } : { kind: 'miss2' };
        const lesson = cause.kind === 'guess' ? GUIDED_REPLAY
          : cause.kind === 'misconception' ? (graph.misconceptionMicroLesson(cause.id) ?? graph.skillMicroLesson(top(state).skillId))
          : graph.skillMicroLesson(top(state).skillId);
        const r = enterMicroLesson({ ...state, misses: state.misses + 1 }, cause, lesson, event.templateId);
        return { state: r.state, effects: [{ type: 'feedback', kind: guess ? 'guess' : 'wrong' }, ...r.effects] };
      }
      if (phase.t === 'easyWin') {
        return { state: { ...state, phase: { t: 'done' } }, effects: [{ type: 'feedback', kind: event.correct ? 'right' : 'wrong' }, { type: 'exit' }] };
      }
      return { state, effects: [] };
    }
    case 'microLessonDone': {
      if (phase.t !== 'microLesson') return { state, effects: [] };
      const frame = top(state);
      const next: EngineState = { ...state, phase: { t: 'quickCheck' }, stack: [...state.stack.slice(0, -1), { ...frame, results: [] }] };
      return { state: next, effects: [{ type: 'quickItem', skillId: frame.skillId, index: 0 }] };
    }
    case 'quickAnswer': {
      if (phase.t !== 'quickCheck') return { state, effects: [] };
      const frame = top(state);
      const results = [...frame.results, event.correct];
      const next: EngineState = { ...state, stack: [...state.stack.slice(0, -1), { ...frame, results }] };
      const r = quickCheckDecide(next, graph);
      return { state: r.state, effects: [{ type: 'feedback', kind: event.correct ? 'right' : 'wrong' }, ...r.effects] };
    }
    case 'easyWinDone':
    case 'break': {
      if (phase.t !== 'easyWin' && phase.t !== 'coachFlag') return { state, effects: [] };
      return { state: { ...state, phase: { t: 'done' } }, effects: [{ type: 'exit' }] };
    }
  }
}
