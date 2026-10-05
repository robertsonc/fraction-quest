/**
 * The lesson flow and practice loop (DESIGN.md 4, 5). Hook -> walkthrough -> guided -> independent ->
 * knowledge check -> summary, then practice until mastery. Guided, independent and practice items run
 * through the adaptive reducer; its effects are rendered here. Everything the learner does is recorded
 * as attempts for the coach view.
 */
import { h, replace } from '../dom';
import type { App } from '../app';
import { ItemView, type ItemMode, type SubmitResult } from '../components/item';
import { WalkthroughPlayer } from '../../walkthrough/player';
import { lumenSays, type Mood } from '../components/lumen';
import { ItemSource } from '../items';
import { navigate } from '../router';
import { graph, lessonFor, microLesson, skill, template } from '../../content';
import { GUIDED_REPLAY, initialState, isGuess, step as engineStep, type EngineState, type Effect, type Event as EngineEvent } from '../../engine/adaptive';
import { isMastered, pushAttempt, repsCovered } from '../../engine/mastery';
import { onMastered } from '../../engine/review';
import type { Item, Rep, Step } from '../../engine/types';
import type { AttemptPhase, SkillState } from '../../store/models';
import { t } from '../../content/strings';

type Stage = 'hook' | 'walkthrough' | 'guided' | 'independent' | 'check' | 'summary' | 'practice' | 'micro' | 'quick' | 'return' | 'coachflag' | 'easywin' | 'done';

const COUNTED: ReadonlySet<ItemMode> = new Set<ItemMode>(['independent', 'practice', 'return', 'check']);

export interface LessonOpts {
  app: App;
  skillId: string;
  /** 'lesson' plays the whole flow; 'practice' goes straight to the practice loop. */
  mode: 'lesson' | 'practice';
  source: ItemSource;
  /** Test hook: the item currently on screen. */
  onItem?: (item: Item | null) => void;
}

export class LessonScreen {
  readonly el: HTMLElement;
  private readonly rail: HTMLElement;
  private readonly left: HTMLElement;
  private readonly right: HTMLElement;
  private stage: Stage = 'hook';
  private engine: EngineState;
  private skillState!: SkillState;
  private item: Item | null = null;
  private view: ItemView | null = null;
  private player: WalkthroughPlayer | null = null;
  private counter = 0;
  private checkResults: boolean[] = [];
  private checkMiss: { templateId: string; misconceptionId: string | null } | null = null;
  private pendingMisconception: string | null = null;
  private lastResult: SubmitResult | null = null;
  private remediationCause = '';
  private readonly lesson: ReturnType<typeof lessonFor>;

  constructor(private readonly opts: LessonOpts) {
    this.lesson = lessonFor(opts.skillId);
    this.engine = initialState(opts.skillId);
    this.rail = h('nav', { class: 'rail glass', 'aria-label': 'Lesson steps' });
    this.left = h('div', { class: 'panel glass' });
    this.right = h('div', { class: 'panel glass work' });
    this.el = h('div', { class: 'stack' }, this.rail, h('div', { class: 'lesson' }, this.left, this.right));
  }

  async start(): Promise<void> {
    const { app, skillId } = this.opts;
    if (!app.profile) { navigate({ name: 'profiles' }); return; }
    this.skillState = await app.repo.skillState(app.profile.id, skillId);
    if (this.opts.mode === 'lesson' && this.lesson) {
      if (this.skillState.status === 'fresh') await this.saveSkill({ status: 'learning', lessonSeen: true });
      this.stage = 'hook';
      this.renderHook();
    } else {
      if (this.skillState.status === 'fresh' || this.skillState.status === 'learning') await this.saveSkill({ status: 'practice' });
      this.stage = 'practice';
      this.renderRail();
      this.nextItem('practice');
    }
  }

  stop(): void {
    this.player?.stop();
    this.opts.app.speech.cancel();
    this.opts.onItem?.(null);
  }

  /* ---------------- rail ---------------- */
  private renderRail(): void {
    const stages: [Stage, string][] = this.opts.mode === 'lesson'
      ? [['hook', t('lesson.hook')], ['walkthrough', t('lesson.walkthrough')], ['guided', t('lesson.guided')], ['independent', t('lesson.independent')], ['check', t('lesson.check')]]
      : [['practice', t('skill.practice')]];
    const current = (['micro', 'quick', 'return', 'coachflag', 'easywin'] as Stage[]).includes(this.stage) ? this.returnStage() : this.stage;
    const back = h('a', { class: 'btn', href: `#/skill/${encodeURIComponent(this.opts.skillId)}` }, '← ', skill(this.opts.skillId).title);
    replace(this.rail, back, ...stages.map(([id, label]) => h('span', { class: 'stage-pill', 'aria-current': id === current ? 'step' : null }, label)),
      this.engine.path.length ? h('span', { class: 'crumb' }, t('lesson.returnpath', { path: this.engine.path.map((p) => skill(p).title).join(' → ') })) : null);
  }

  /** The stage the learner returns to after a remediation side trip. */
  private returnStage(): Stage {
    return this.opts.mode === 'lesson' && this.stage !== 'practice' && this.counter <= this.totalBeforeCheck() ? (this.counter <= (this.lesson?.guided.count ?? 0) ? 'guided' : 'independent') : 'practice';
  }
  private totalBeforeCheck(): number {
    return (this.lesson?.guided.count ?? 0) + (this.lesson?.independent.count ?? 0);
  }

  /* ---------------- hook and walkthrough ---------------- */
  private renderHook(): void {
    const lesson = this.lesson!;
    this.renderRail();
    const item = this.opts.source.fromTemplate(lesson.hook.templateId);
    const stepMs = Math.max(2200, Math.floor(lesson.hook.durationMs / item.trace.length));
    this.player = new WalkthroughPlayer(item.trace, { auto: { stepMs }, gridHint: gridHintFor(item), onDone: () => this.renderWalkthrough() });
    const skipBtn = h('button', { type: 'button', class: 'btn' }, t('nav.skip'));
    skipBtn.addEventListener('click', () => { this.player?.stop(); this.renderWalkthrough(); });
    replace(this.left, lumenSays(t(lesson.hook.captionKey), 'happy'));
    replace(this.right, h('div', { class: 'hook' }, this.player.el, h('div', { class: 'row', style: 'justify-content:center;margin-top:12px' }, skipBtn)));
    void this.opts.app.say(t(lesson.hook.captionKey));
    void this.player.start();
  }

  private renderWalkthrough(): void {
    const lesson = this.lesson!;
    this.stage = 'walkthrough';
    this.renderRail();
    const item = this.opts.source.fromTemplate(lesson.walkthrough.templateId);
    // The same numbers in every representation the lesson lists, one after another.
    const steps: Step[] = [];
    for (const rep of lesson.walkthrough.reps) for (const s of item.trace) steps.push({ ...s, before: { ...s.before, rep }, after: { ...s.after, rep } });
    this.player = new WalkthroughPlayer(steps, {
      gridHint: gridHintFor(item),
      onStep: (s) => void this.opts.app.say(s.say),
      onDone: () => { this.stage = 'guided'; this.counter = 0; this.renderRail(); this.nextItem('guided'); },
    });
    replace(this.left, lumenSays(t('lesson.tap'), 'neutral'));
    replace(this.right, this.player.el);
    void this.player.start();
  }

  /* ---------------- items ---------------- */
  private templatesFor(mode: ItemMode): string[] {
    const l = this.lesson;
    if (mode === 'guided' && l) return l.guided.templates;
    if (mode === 'independent' && l) return l.independent.templates;
    if (mode === 'check' && l) return l.check.templates;
    return skill(this.opts.skillId).itemTemplates;
  }

  private nextItem(mode: ItemMode, templateId?: string, lead?: HTMLElement): void {
    const covered = new Set<Rep>(repsCovered(this.skillState.window));
    const item = templateId ? this.opts.source.fromTemplate(templateId)
      : mode === 'check' ? this.opts.source.fromTemplate(this.templatesFor('check')[this.checkResults.length % this.templatesFor('check').length]!)
      : this.opts.source.fromTemplates(this.templatesFor(mode), covered);
    this.showItem(item, mode, lead);
  }

  private showItem(item: Item, mode: ItemMode, lead?: HTMLElement): void {
    this.item = item;
    this.opts.onItem?.(item);
    this.view = new ItemView({ item, mode, app: this.opts.app, lead: lead ?? null, onSubmit: (r) => void this.onSubmit(r, mode) });
    const mood: Mood = mode === 'check' ? 'neutral' : 'think';
    const side = mode === 'check' ? lumenSays(t('lesson.check.intro'), mood)
      : mode === 'quick' ? lumenSays(t('micro.quickcheck'), mood)
      : mode === 'return' ? lumenSays(t('lesson.return', { skill: skill(this.opts.skillId).title }), 'happy')
      : lumenSays(this.sideText(), mood);
    replace(this.left, side, this.progressEl());
    replace(this.right, this.view.el);
    this.renderRail();
    void this.view.start();
  }

  private sideText(): string {
    if (this.stage === 'guided') return t('lesson.guided');
    if (this.stage === 'independent') return t('lesson.independent');
    return t('skill.practice');
  }

  private progressEl(): HTMLElement {
    const good = this.skillState.window.filter((a) => a.correct && !a.aided && !a.guess).length;
    const dots = h('div', { class: 'meter', 'aria-hidden': 'true' }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: i < good ? 'on' : '' })));
    const reps = repsCovered(this.skillState.window);
    return h('div', { class: 'stack', style: 'margin-top:14px' },
      dots,
      h('p', { class: 'muted' }, t('skill.meter', { n: good })),
      reps.length ? h('p', { class: 'muted' }, t('skill.reps', { list: reps.map((r) => t(`rep.${r}`)).join(', ') })) : null);
  }

  private async onSubmit(r: SubmitResult, mode: ItemMode): Promise<void> {
    const { app } = this.opts;
    const item = this.item!;
    const view = this.view!;
    const guess = isGuess(r.correct, r.elapsedMs);
    const aided = mode === 'guided' || r.hintsShown > 0 || this.engine.phase.t === 'hint';
    const phase: AttemptPhase = mode === 'guided' ? 'guided' : mode === 'independent' ? 'independent' : mode === 'check' ? 'check' : mode === 'quick' ? 'quick' : mode === 'return' ? 'return' : mode === 'easywin' ? 'easywin' : 'practice';
    await this.record(item, r, aided, guess, phase);

    if (mode === 'check') {
      this.checkResults.push(r.correct && !guess);
      if (COUNTED.has(mode)) await this.pushWindow({ correct: r.correct, aided, guess, rep: item.rep });
      view.lock();
      // Knowledge check: no hints, no fix shown; remediation waits until the check ends (R5).
      view.feedback(r.correct ? 'right' : guess ? 'guess' : 'wrong', null, false);
      if (!r.correct && r.misconceptionId && !this.checkMiss) this.checkMiss = { templateId: item.templateId, misconceptionId: r.misconceptionId };
      this.after(() => (this.checkResults.length >= (this.lesson?.check.count ?? 4) ? this.renderSummary() : this.nextItem('check')));
      return;
    }

    // Every other mode: the adaptive engine decides; its feedback effect draws the note.
    this.lastResult = r;
    if (mode === 'quick') {
      this.dispatch({ type: 'quickAnswer', correct: r.correct, misconceptionId: r.misconceptionId });
      return;
    }
    if (mode === 'easywin') {
      this.dispatch({ type: 'answer', correct: r.correct, elapsedMs: r.elapsedMs, misconceptionId: null, templateId: item.templateId });
      return;
    }
    if (COUNTED.has(mode)) await this.pushWindow({ correct: r.correct, aided, guess, rep: item.rep });
    if (r.correct) this.counter += 1;
    this.dispatch({ type: 'answer', correct: r.correct, elapsedMs: r.elapsedMs, misconceptionId: r.misconceptionId, templateId: item.templateId });
  }

  private after(fn: () => void, ms = 1300): void {
    const btn = h('button', { type: 'button', class: 'btn primary', 'data-action': 'next' }, t('nav.continue'));
    let done = false;
    const go = () => { if (done) return; done = true; fn(); };
    btn.addEventListener('click', go);
    this.view?.el.append(h('div', { class: 'item-actions' }, btn));
    btn.focus({ preventScroll: true });
    if (!this.opts.app.testMode) window.setTimeout(go, ms + 2600);
  }

  /* ---------------- engine wiring ---------------- */
  private dispatch(ev: EngineEvent): void {
    const r = engineStep(this.engine, ev, graph);
    this.engine = r.state;
    void this.runEffects(r.effects);
  }

  private async runEffects(effects: Effect[]): Promise<void> {
    for (const e of effects) {
      switch (e.type) {
        case 'feedback': {
          const view = this.view;
          if (!view) break;
          const hinting = this.engine.phase.t === 'hint';
          const mis = hinting ? null : (this.lastResult?.misconceptionId ?? this.lastMisconception(effects));
          view.feedback(e.kind, mis, e.kind === 'wrong' && !hinting && this.stage !== 'easywin');
          if (!hinting) view.lock();
          break;
        }
        case 'showHint': {
          this.view?.showHint();
          this.view?.retry();
          break;
        }
        case 'nextItem': {
          await this.afterCorrect();
          break;
        }
        case 'playMicroLesson': {
          this.remediationCause = e.cause.kind === 'misconception' ? e.cause.id : e.cause.kind;
          this.after(() => this.renderMicroLesson(e.lessonId, e.skillId, e.depth));
          break;
        }
        case 'quickItem': {
          const frame = this.engine.stack[this.engine.stack.length - 1]!;
          const ml = microLesson(frame.lessonId === GUIDED_REPLAY ? skill(frame.skillId).microLesson : frame.lessonId);
          const tplId = ml.quickCheck.templates[e.index % ml.quickCheck.templates.length]!;
          const show = () => { this.stage = 'quick'; this.nextItem('quick', tplId, h('p', { class: 'muted' }, `${t('micro.quickcheck')} ${e.index + 1} of 3`)); };
          // Right after an answered quick item, wait for Continue; straight after a micro-lesson, show it now.
          if (this.stage === 'quick') this.after(show); else show();
          break;
        }
        case 'returnItem': {
          await this.recordRemediation('returned');
          const lead = h('p', { class: 'banner' }, t('lesson.returnpath', { path: [skill(this.opts.skillId).title, ...e.path.map((p) => skill(p).title)].join(' → ') }));
          const tpl = e.templateId && template(e.templateId).skillId === this.opts.skillId ? e.templateId : undefined;
          const show = () => { this.stage = 'return'; this.nextItem('return', tpl, lead); };
          if (this.stage === 'quick') this.after(show); else show();
          break;
        }
        case 'flagCoach': {
          await this.recordRemediation('coach-flag');
          await this.saveSkill({ coachFlags: this.skillState.coachFlags + 1 });
          break;
        }
        case 'offerEasyWin': {
          if (this.stage === 'quick') this.after(() => this.renderCoachFlag()); else this.renderCoachFlag();
          break;
        }
        case 'exit': {
          const onItem = this.stage === 'easywin' && this.view !== null;
          this.stage = 'done';
          if (onItem) this.after(() => navigate({ name: 'map' }), 600); else navigate({ name: 'map' });
          break;
        }
      }
    }
  }

  private lastMisconception(effects: Effect[]): string | null {
    const ml = effects.find((x) => x.type === 'playMicroLesson');
    if (ml && ml.type === 'playMicroLesson' && ml.cause.kind === 'misconception') return ml.cause.id;
    return this.pendingMisconception;
  }

  /** After a correct answer in guided, independent, practice or return mode: advance the flow. */
  private async afterCorrect(): Promise<void> {
    const l = this.lesson;
    if (this.stage === 'return') this.stage = this.returnStage();
    if (isMastered(this.skillState.window) && this.skillState.status !== 'mastered' && this.skillState.status !== 'review' && this.skillState.status !== 'retained') {
      await this.markMastered();
      this.after(() => this.renderSummary(true));
      return;
    }
    if (this.opts.mode === 'lesson' && l && this.stage === 'guided') {
      this.after(() => { if (this.counter >= l.guided.count) { this.stage = 'independent'; this.nextItem('independent'); } else this.nextItem('guided'); });
      return;
    }
    if (this.opts.mode === 'lesson' && l && this.stage === 'independent') {
      this.after(() => { if (this.counter >= l.guided.count + l.independent.count) { this.stage = 'check'; this.checkResults = []; this.nextItem('check'); } else this.nextItem('independent'); });
      return;
    }
    this.stage = 'practice';
    this.after(() => this.nextItem('practice'));
  }

  /* ---------------- micro-lesson, quick check, coach flag ---------------- */
  private renderMicroLesson(lessonId: string, skillId: string, depth: number): void {
    this.stage = 'micro';
    this.renderRail();
    let steps: Step[];
    let title: string;
    if (lessonId === GUIDED_REPLAY && this.item) {
      steps = this.item.trace;
      title = t('micro.title', { topic: skill(skillId).title.toLowerCase() });
    } else {
      const ml = microLesson(lessonId);
      const item = this.opts.source.fromTemplate(ml.walkthrough.templateId);
      steps = [];
      for (const rep of ml.walkthrough.reps) for (const s of item.trace) steps.push({ ...s, before: { ...s.before, rep }, after: { ...s.after, rep } });
      title = depth > 0 ? t('micro.prereq', { skill: skill(skillId).title }) : t('micro.title', { topic: t(ml.titleKey) });
    }
    const item = this.item;
    this.player = new WalkthroughPlayer(steps, {
      ...(item ? { gridHint: gridHintFor(item) } : {}),
      onStep: (s) => void this.opts.app.say(s.say),
      onDone: () => this.dispatch({ type: 'microLessonDone' }),
    });
    replace(this.left, lumenSays(title, 'think'));
    replace(this.right, h('div', { class: 'stack', 'data-stage': 'micro' }, h('h2', {}, title), this.player.el));
    void this.opts.app.say(title);
    void this.player.start();
  }

  private renderCoachFlag(): void {
    this.stage = 'coachflag';
    this.renderRail();
    const easy = h('button', { type: 'button', class: 'btn primary big', 'data-action': 'easywin' }, t('coachflag.easywin'));
    const rest = h('button', { type: 'button', class: 'btn big', 'data-action': 'break' }, t('coachflag.break'));
    easy.addEventListener('click', () => void this.renderEasyWin());
    rest.addEventListener('click', () => this.dispatch({ type: 'break' }));
    replace(this.left, lumenSays(t('coachflag.body'), 'happy'));
    replace(this.right, h('div', { class: 'stack', 'data-stage': 'coachflag' }, h('h2', {}, t('coachflag.title')), h('div', { class: 'row' }, easy, rest)));
    void this.opts.app.say(t('coachflag.title'));
  }

  /** One item the learner already owns: a mastered skill, or naming a shaded fraction. */
  private async renderEasyWin(): Promise<void> {
    this.stage = 'easywin';
    const states = await this.opts.app.repo.skillStates(this.opts.app.profile!.id);
    const mastered = states.find((s) => (s.status === 'mastered' || s.status === 'retained' || s.status === 'review') && s.skillId !== this.opts.skillId);
    const item = mastered ? this.opts.source.forSkill(mastered.skillId) : this.opts.source.fromTemplate('meaning.name-fraction.area');
    this.showItem(item, 'easywin', h('p', { class: 'banner' }, t('coachflag.easywin')));
  }

  /* ---------------- check summary ---------------- */
  private async renderSummary(mastered = false): Promise<void> {
    this.stage = 'summary';
    this.renderRail();
    const right = this.checkResults.filter(Boolean).length;
    const total = this.checkResults.length;
    const nowMastered = mastered || isMastered(this.skillState.window);
    if (nowMastered && this.skillState.status !== 'mastered' && this.skillState.status !== 'review' && this.skillState.status !== 'retained') await this.markMastered();
    if (!nowMastered && this.skillState.status === 'learning') await this.saveSkill({ status: 'practice' });
    const name = skill(this.opts.skillId).title;
    const toMap = h('a', { class: 'btn primary big', href: '#/map', 'data-action': 'map' }, t('nav.map'));
    const keep = h('button', { type: 'button', class: 'btn big', 'data-action': 'practice' }, t('nav.continue'));
    keep.addEventListener('click', () => {
      this.stage = 'practice';
      this.renderRail();
      if (this.checkMiss) {
        // A misconception seen during the check: start practice with its micro-lesson (R5).
        const miss = this.checkMiss;
        this.checkMiss = null;
        this.pendingMisconception = miss.misconceptionId;
        const item = this.opts.source.fromTemplate(miss.templateId);
        this.showItem(item, 'practice');
        this.dispatch({ type: 'answer', correct: false, elapsedMs: 10000, misconceptionId: miss.misconceptionId, templateId: miss.templateId });
      } else {
        this.nextItem('practice');
      }
    });
    const mood: Mood = nowMastered ? 'cheer' : 'happy';
    const headline = nowMastered ? t('lesson.mastered', { skill: name }) : t('lesson.notyet');
    replace(this.left, lumenSays(headline, mood), this.progressEl());
    replace(this.right, h('div', { class: 'stack', 'data-stage': 'summary' },
      total ? h('p', { class: 'result-big' }, t('lesson.check.result', { right, total })) : null,
      h('p', {}, headline),
      h('div', { class: 'row' }, toMap, nowMastered ? null : keep)));
    if (nowMastered) this.opts.app.sound.play('win');
    void this.opts.app.say(headline);
  }

  /* ---------------- persistence ---------------- */
  private async record(item: Item, r: SubmitResult, aided: boolean, guess: boolean, phase: AttemptPhase): Promise<void> {
    const { app } = this.opts;
    const session = await app.refreshSession();
    await app.repo.addAttempt({
      profileId: app.profile!.id, skillId: item.skillId, templateId: item.templateId, seed: item.seed, rep: item.rep,
      correct: r.correct, aided, guess, misconceptionId: r.correct ? null : r.misconceptionId, answerText: r.answerText,
      elapsedMs: Math.round(r.elapsedMs), phase, sessionId: session.id,
    });
  }

  private async pushWindow(a: { correct: boolean; aided: boolean; guess: boolean; rep: Rep }): Promise<void> {
    await this.saveSkill({ window: pushAttempt(this.skillState.window, a) });
  }

  private async saveSkill(patch: Partial<SkillState>): Promise<void> {
    this.skillState = { ...this.skillState, ...patch };
    await this.opts.app.repo.putSkillState(this.skillState);
  }

  private async markMastered(): Promise<void> {
    const session = await this.opts.app.refreshSession();
    const idx = this.opts.app.repo.reviewIndex(session);
    await this.saveSkill(onMastered(this.skillState, idx));
  }

  private async recordRemediation(outcome: 'returned' | 'coach-flag'): Promise<void> {
    const { app, skillId } = this.opts;
    await app.repo.addRemediation({ profileId: app.profile!.id, skillId, path: [...this.engine.path], cause: this.remediationCause, outcome });
  }
}

/** Area grids follow the given denominator so a split reads as rows added to the same columns. */
export function gridHintFor(item: Item): (scene: { d: number; rep: Rep }) => { cols: number; rows: number } | undefined {
  const g = item.given;
  const base = g.kind === 'missing-part' || g.kind === 'find-pair' ? g.from.d : g.kind === 'is-equivalent' ? g.a.d : g.kind === 'name-fraction' ? g.d : 1;
  return (scene) => (scene.rep === 'area' && scene.d % base === 0 ? { cols: base, rows: scene.d / base } : undefined);
}
