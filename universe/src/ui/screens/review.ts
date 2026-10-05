/** Spaced review: three items, no hints, pass at 2 of 3. A fail demotes to practice (DESIGN.md M3). */
import { h, replace } from '../dom';
import type { App } from '../app';
import { skill } from '../../content';
import { ItemView } from '../components/item';
import { ItemSource } from '../items';
import { lumenSays } from '../components/lumen';
import { onReviewResult, reviewPassed, REVIEW_ITEMS, REVIEW_PASS } from '../../engine/review';
import { isGuess } from '../../engine/adaptive';
import { navigate } from '../router';
import { t } from '../../content/strings';
import type { Item } from '../../engine/types';

export class ReviewScreen {
  readonly el: HTMLElement;
  private readonly left = h('div', { class: 'panel glass' });
  private readonly right = h('div', { class: 'panel glass work' });
  private results: boolean[] = [];
  private view: ItemView | null = null;

  constructor(private readonly app: App, private readonly skillId: string, private readonly source: ItemSource, private readonly onItem?: (i: Item | null) => void) {
    this.el = h('div', { class: 'stack' },
      h('nav', { class: 'rail glass' }, h('a', { class: 'btn', href: '#/map' }, '← ', t('nav.map')), h('span', { class: 'stage-pill', 'aria-current': 'step' }, t('skill.review'))),
      h('div', { class: 'lesson' }, this.left, this.right));
  }

  start(): void {
    if (!this.app.profile) { navigate({ name: 'profiles' }); return; }
    this.next();
  }

  stop(): void {
    this.onItem?.(null);
  }

  private next(): void {
    const item = this.source.forSkill(this.skillId);
    this.onItem?.(item);
    this.view = new ItemView({
      item, mode: 'review', app: this.app,
      lead: h('p', { class: 'muted' }, `${t('skill.review')} ${this.results.length + 1} of ${REVIEW_ITEMS}`),
      onSubmit: (r) => void (async () => {
        const guess = isGuess(r.correct, r.elapsedMs);
        const session = await this.app.refreshSession();
        await this.app.repo.addAttempt({
          profileId: this.app.profile!.id, skillId: item.skillId, templateId: item.templateId, seed: item.seed, rep: item.rep,
          correct: r.correct, aided: false, guess, misconceptionId: r.correct ? null : r.misconceptionId, answerText: r.answerText,
          elapsedMs: Math.round(r.elapsedMs), phase: 'review', sessionId: session.id,
        });
        this.results.push(r.correct && !guess);
        this.view?.lock();
        this.view?.feedback(r.correct ? 'right' : guess ? 'guess' : 'wrong', r.misconceptionId, true);
        const btn = h('button', { type: 'button', class: 'btn primary', 'data-action': 'next' }, t('nav.continue'));
        // Finish as soon as the outcome is decided (2 right passes, 2 wrong fails), like the quick check.
        const right = this.results.filter(Boolean).length;
        const wrong = this.results.length - right;
        const decided = right >= REVIEW_PASS || wrong > REVIEW_ITEMS - REVIEW_PASS || this.results.length >= REVIEW_ITEMS;
        btn.addEventListener('click', () => (decided ? void this.finish() : this.next()));
        this.view?.el.append(h('div', { class: 'item-actions' }, btn));
        btn.focus();
      })(),
    });
    replace(this.left, lumenSays(t('review.intro', { skill: skill(this.skillId).title }), 'neutral'));
    replace(this.right, this.view.el);
    void this.view.start();
  }

  private async finish(): Promise<void> {
    const passed = reviewPassed(this.results);
    const st = await this.app.repo.skillState(this.app.profile!.id, this.skillId);
    const session = await this.app.refreshSession();
    await this.app.repo.putSkillState({ ...st, ...onReviewResult(st, passed, this.app.repo.reviewIndex(session)) });
    const text = passed ? t('review.pass') : t('review.fail');
    replace(this.left, lumenSays(text, passed ? 'cheer' : 'happy'));
    replace(this.right, h('div', { class: 'stack', 'data-stage': 'review-done', 'data-passed': String(passed) }, h('p', { class: 'result-big' }, text), h('a', { class: 'btn primary big', href: '#/map' }, t('nav.map'))));
    this.onItem?.(null);
    void this.app.say(text);
    if (passed) this.app.sound.play('win');
  }
}
