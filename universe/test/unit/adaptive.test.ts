import { describe, it, expect } from 'vitest';
import {
  initialState, step, depthOf, GUIDED_REPLAY, GUESS_MS,
  type EngineState, type Event, type Effect, type Graph,
} from '../../src/engine/adaptive';

/** A two-level chain for the depth-2 tests: top -> mid -> root (DESIGN.md 2.2 note). */
const graph: Graph = {
  prereqsOf: (id) => ({ top: ['mid', 'alt'], mid: ['root'], root: [], alt: [] }[id] ?? []),
  skillMicroLesson: (id) => `micro.${id}`,
  misconceptionMicroLesson: (id) => (id === 'known-mis' ? 'micro.known-mis' : null),
};

const answer = (correct: boolean, over: Partial<Extract<Event, { type: 'answer' }>> = {}): Event => ({
  type: 'answer', correct, elapsedMs: 8000, misconceptionId: null, templateId: 'tpl.a', ...over,
});
const types = (effects: Effect[]) => effects.map((e) => e.type);

function run(state: EngineState, events: Event[]): { state: EngineState; effects: Effect[] } {
  let s = state;
  let all: Effect[] = [];
  for (const e of events) {
    const r = step(s, e, graph);
    s = r.state;
    all = [...all, ...r.effects];
  }
  return { state: s, effects: all };
}

describe('adaptive reducer', () => {
  it('Practice -> Practice on correct', () => {
    const r = step(initialState('top'), answer(true), graph);
    expect(r.state.phase).toEqual({ t: 'practice' });
    expect(types(r.effects)).toEqual(['feedback', 'nextItem']);
  });

  it('Practice -> Hint on miss 1 without a misconception', () => {
    const r = step(initialState('top'), answer(false), graph);
    expect(r.state.phase).toEqual({ t: 'hint', level: 1 });
    expect(r.effects).toContainEqual({ type: 'showHint', level: 1 });
  });

  it('Hint -> Practice on correct', () => {
    const r = run(initialState('top'), [answer(false), answer(true)]);
    expect(r.state.phase).toEqual({ t: 'practice' });
  });

  it('Hint -> MicroLesson on miss 2 with the skill lesson', () => {
    const r = run(initialState('top'), [answer(false), answer(false)]);
    expect(r.state.phase).toEqual({ t: 'microLesson' });
    expect(r.effects.at(-1)).toMatchObject({ type: 'playMicroLesson', lessonId: 'micro.top', cause: { kind: 'miss2' }, depth: 0 });
  });

  it('Practice -> MicroLesson when a misconception matches on miss 1', () => {
    const r = step(initialState('top'), answer(false, { misconceptionId: 'known-mis' }), graph);
    expect(r.state.phase).toEqual({ t: 'microLesson' });
    expect(r.effects.at(-1)).toMatchObject({ type: 'playMicroLesson', lessonId: 'micro.known-mis', cause: { kind: 'misconception', id: 'known-mis' } });
  });

  it('a misconception without its own micro-lesson falls back to the skill lesson', () => {
    const r = step(initialState('top'), answer(false, { misconceptionId: 'other-mis' }), graph);
    expect(r.effects.at(-1)).toMatchObject({ type: 'playMicroLesson', lessonId: 'micro.top' });
  });

  it('a fast wrong answer is a guess: never praised, routed to the guided replay', () => {
    const r = step(initialState('top'), answer(false, { elapsedMs: GUESS_MS - 1 }), graph);
    expect(r.effects[0]).toEqual({ type: 'feedback', kind: 'guess' });
    expect(r.effects.at(-1)).toMatchObject({ type: 'playMicroLesson', lessonId: GUIDED_REPLAY, cause: { kind: 'guess' } });
    expect(r.state.phase).toEqual({ t: 'microLesson' });
  });

  it('a slow wrong answer at exactly the threshold is not a guess', () => {
    const r = step(initialState('top'), answer(false, { elapsedMs: GUESS_MS }), graph);
    expect(r.state.phase).toEqual({ t: 'hint', level: 1 });
  });

  it('MicroLesson -> QuickCheck -> ReturnItem on 2 of 3, then Practice', () => {
    const r = run(initialState('top'), [
      answer(false), answer(false),
      { type: 'microLessonDone' },
      { type: 'quickAnswer', correct: true, misconceptionId: null },
      { type: 'quickAnswer', correct: false, misconceptionId: null },
      { type: 'quickAnswer', correct: true, misconceptionId: null },
    ]);
    expect(r.state.phase).toEqual({ t: 'returnItem' });
    expect(r.effects.at(-1)).toMatchObject({ type: 'returnItem', skillId: 'top', templateId: 'tpl.a' });
    const back = step(r.state, answer(true), graph);
    expect(back.state.phase).toEqual({ t: 'practice' });
    expect(back.state.returnTemplateId).toBeNull();
  });

  it('quick check passes early on 2 correct', () => {
    const r = run(initialState('top'), [
      answer(false), answer(false), { type: 'microLessonDone' },
      { type: 'quickAnswer', correct: true, misconceptionId: null },
      { type: 'quickAnswer', correct: true, misconceptionId: null },
    ]);
    expect(r.state.phase).toEqual({ t: 'returnItem' });
  });

  it('QuickCheck fail at depth 0 drops to the first unvisited prerequisite', () => {
    const r = run(initialState('top'), [
      answer(false), answer(false), { type: 'microLessonDone' },
      { type: 'quickAnswer', correct: false, misconceptionId: null },
      { type: 'quickAnswer', correct: false, misconceptionId: null },
    ]);
    expect(r.state.phase).toEqual({ t: 'microLesson' });
    expect(depthOf(r.state)).toBe(1);
    expect(r.state.path).toEqual(['mid']);
    expect(r.effects.at(-1)).toMatchObject({ type: 'playMicroLesson', skillId: 'mid', lessonId: 'micro.mid', cause: { kind: 'prereq' }, depth: 1 });
  });

  it('prerequisite passed re-runs the parent quick check; passing that returns to the original item', () => {
    const r = run(initialState('top'), [
      answer(false), answer(false), { type: 'microLessonDone' },
      { type: 'quickAnswer', correct: false, misconceptionId: null },
      { type: 'quickAnswer', correct: false, misconceptionId: null },
      { type: 'microLessonDone' }, // mid micro-lesson
      { type: 'quickAnswer', correct: true, misconceptionId: null },
      { type: 'quickAnswer', correct: true, misconceptionId: null },
    ]);
    expect(depthOf(r.state)).toBe(0);
    expect(r.state.phase).toEqual({ t: 'quickCheck' });
    expect(r.effects.at(-1)).toMatchObject({ type: 'quickItem', skillId: 'top', index: 0 });
    const done = run(r.state, [
      { type: 'quickAnswer', correct: true, misconceptionId: null },
      { type: 'quickAnswer', correct: true, misconceptionId: null },
    ]);
    expect(done.state.phase).toEqual({ t: 'returnItem' });
    expect(done.effects.at(-1)).toMatchObject({ type: 'returnItem', path: ['mid'] });
  });

  it('depth is capped at 2: failing there flags the coach and offers an easy win, then exits', () => {
    const fail2: Event[] = [
      { type: 'quickAnswer', correct: false, misconceptionId: null },
      { type: 'quickAnswer', correct: false, misconceptionId: null },
    ];
    const r = run(initialState('top'), [
      answer(false), answer(false), { type: 'microLessonDone' }, ...fail2, // -> mid (depth 1)
      { type: 'microLessonDone' }, ...fail2,                                // -> root (depth 2)
      { type: 'microLessonDone' }, ...fail2,                                // depth 2 fails -> coach flag
    ]);
    expect(depthOf(r.state)).toBe(2);
    expect(r.state.coachFlagged).toBe(true);
    expect(r.state.phase).toEqual({ t: 'easyWin' });
    expect(types(r.effects).slice(-2)).toEqual(['flagCoach', 'offerEasyWin']);
    expect(r.effects.at(-2)).toMatchObject({ type: 'flagCoach', skillId: 'top', path: ['mid', 'root'] });
    const end = step(r.state, answer(true), graph);
    expect(end.state.phase).toEqual({ t: 'done' });
    expect(end.effects.at(-1)).toEqual({ type: 'exit' });
  });

  it('a root prerequisite that fails falls back to the next unvisited prerequisite above it', () => {
    const fail2: Event[] = [
      { type: 'quickAnswer', correct: false, misconceptionId: null },
      { type: 'quickAnswer', correct: false, misconceptionId: null },
    ];
    const r = run(initialState('top'), [
      answer(false), answer(false), { type: 'microLessonDone' }, ...fail2, // -> mid (depth 1)
      { type: 'microLessonDone' }, ...fail2,                                // -> root (depth 2)
    ]);
    expect(r.state.path).toEqual(['mid', 'root']);
    // Same chain but mid's own prerequisite already visited: alt (top's other prerequisite) is next.
    const g2: Graph = { ...graph, prereqsOf: (id) => ({ top: ['mid', 'alt'], mid: [], root: [], alt: [] }[id] ?? []) };
    let s = initialState('top');
    for (const e of [answer(false), answer(false), { type: 'microLessonDone' } as Event, ...fail2, { type: 'microLessonDone' } as Event, ...fail2]) s = step(s, e, g2).state;
    expect(s.path).toEqual(['mid', 'alt']);
    expect(depthOf(s)).toBe(2);
  });

  it('a skill with no prerequisite left goes to the coach flag even below depth 2 (never trap)', () => {
    const r = run(initialState('alt'), [
      answer(false), answer(false), { type: 'microLessonDone' },
      { type: 'quickAnswer', correct: false, misconceptionId: null },
      { type: 'quickAnswer', correct: false, misconceptionId: null },
    ]);
    expect(r.state.coachFlagged).toBe(true);
    expect(r.state.phase).toEqual({ t: 'easyWin' });
  });

  it('break during the easy win exits', () => {
    const fail2: Event[] = [
      { type: 'quickAnswer', correct: false, misconceptionId: null },
      { type: 'quickAnswer', correct: false, misconceptionId: null },
    ];
    const r = run(initialState('alt'), [answer(false), answer(false), { type: 'microLessonDone' }, ...fail2, { type: 'break' }]);
    expect(r.state.phase).toEqual({ t: 'done' });
  });

  it('ignores events that do not belong to the current phase', () => {
    const s = initialState('top');
    expect(step(s, { type: 'microLessonDone' }, graph)).toEqual({ state: s, effects: [] });
    expect(step(s, { type: 'quickAnswer', correct: true, misconceptionId: null }, graph)).toEqual({ state: s, effects: [] });
  });
});
