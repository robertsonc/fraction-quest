/**
 * Plays a step trace as an animated walkthrough: each step's `before` scene is drawn, then the
 * picture animates to `after` with the Web Animations API. Tap to advance, dots to replay any
 * step. With reduced motion every step is a still. The scenes come from the engine, so the final
 * picture is the graded answer by construction (DESIGN.md 4.1).
 */
import { h, replace, equationEl } from '../ui/dom';
import { renderScene, gridFor } from '../ui/components/scene';
import { animate, reducedMotion } from '../a11y/motion';
import type { Scene, Step } from '../engine/types';
import { t } from '../content/strings';

export interface PlayerOpts {
  /** Called with each step's caption so read-aloud can speak it. */
  onStep?: (step: Step, index: number) => void;
  onDone?: () => void;
  /** Hide the Next control and advance automatically (hook mode). */
  auto?: { stepMs: number };
  /** Grid hints for area scenes, keyed by piece count. The equiv trace sets cols = b. */
  gridHint?: (scene: Scene) => { cols: number; rows: number } | undefined;
}

export class WalkthroughPlayer {
  readonly el: HTMLElement;
  private index = 0;
  private readonly stage: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly eq: HTMLElement;
  private readonly dots: HTMLElement;
  private readonly next: HTMLButtonElement;
  private timer = 0;
  private busy = false;

  constructor(private readonly steps: Step[], private readonly opts: PlayerOpts = {}) {
    this.stage = h('div', { class: 'wt-stage' });
    this.caption = h('p', { class: 'wt-caption', 'aria-live': 'polite' });
    this.eq = h('div', { class: 'wt-eq' });
    this.dots = h('div', { class: 'wt-dots', role: 'tablist', 'aria-label': 'Steps' });
    this.next = h('button', { type: 'button', class: 'btn primary wt-next' }, t('nav.next'));
    this.next.addEventListener('click', () => void this.advance());
    const replay = h('button', { type: 'button', class: 'btn wt-replay' }, t('nav.replay'));
    replay.addEventListener('click', () => void this.go(this.index, true));
    this.el = h('section', { class: 'walkthrough' }, this.stage, this.eq, this.caption, h('div', { class: 'wt-controls' }, this.dots, opts.auto ? null : h('span', { class: 'wt-btns' }, replay, this.next)));
    this.steps.forEach((_, i) => {
      const dot = h('button', { type: 'button', class: 'wt-dot', role: 'tab', 'aria-label': `Step ${i + 1}`, 'aria-selected': 'false' });
      dot.addEventListener('click', () => void this.go(i, true));
      this.dots.append(dot);
    });
    this.stage.addEventListener('click', () => { if (!opts.auto) void this.advance(); });
  }

  get current(): number {
    return this.index;
  }

  async start(): Promise<void> {
    await this.go(0, true);
  }

  stop(): void {
    clearTimeout(this.timer);
  }

  /** The scene currently drawn; the final-state test reads this after the last step. */
  currentScene(): Scene {
    const step = this.steps[this.index];
    if (!step) throw new Error('no step');
    return step.after;
  }

  private draw(scene: Scene): SVGSVGElement {
    const grid = this.opts.gridHint?.(scene) ?? (scene.rep === 'area' ? gridFor(scene.d) : undefined);
    const opts = grid ? { grid } : {};
    const svg = renderScene(scene, opts);
    replace(this.stage, svg);
    replace(this.eq, equationEl(scene.equation));
    return svg;
  }

  private async go(i: number, play: boolean): Promise<void> {
    if (this.busy) return;
    const step = this.steps[i];
    if (!step) return;
    this.busy = true;
    clearTimeout(this.timer);
    this.index = i;
    [...this.dots.children].forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
    this.caption.textContent = step.say;
    this.opts.onStep?.(step, i);
    const still = reducedMotion() || !play;
    if (still) {
      this.draw(step.after);
    } else {
      const before = this.draw(step.before);
      await this.transition(before, step);
      this.draw(step.after);
    }
    this.next.textContent = i === this.steps.length - 1 ? t('nav.done') : t('nav.next');
    this.busy = false;
    if (this.opts.auto) {
      this.timer = window.setTimeout(() => void this.advance(), this.opts.auto.stepMs);
    }
  }

  private async advance(): Promise<void> {
    if (this.busy) return;
    if (this.index >= this.steps.length - 1) {
      this.stop();
      this.opts.onDone?.();
      return;
    }
    await this.go(this.index + 1, true);
  }

  /** Animates the before picture toward the after picture for the step kind. */
  private async transition(before: SVGSVGElement, step: Step): Promise<void> {
    const dur = 650;
    switch (step.kind) {
      case 'split': {
        // Fade the new cuts in over the old picture: draw `after` on top at 0 opacity and raise it.
        const grid = this.opts.gridHint?.(step.after) ?? (step.after.rep === 'area' ? gridFor(step.after.d) : undefined);
        const after = renderScene(step.after, grid ? { grid } : {});
        after.classList.add('overlay');
        this.stage.append(after);
        await animate(after, [{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing: 'ease-out' });
        break;
      }
      case 'shade':
      case 'count': {
        const pieces = before.querySelectorAll<SVGElement>('.piece, .jump');
        const targets = [...pieces].slice(0, step.after.shaded);
        await Promise.all(targets.map((p, k) => animate(p, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 420, delay: Math.min(k * 45, 900), easing: 'ease-in-out' })));
        break;
      }
      case 'compare':
      case 'write':
      case 'show':
      default: {
        await animate(this.eq, [{ opacity: 0.4 }, { opacity: 1 }], { duration: 400 });
        break;
      }
    }
  }
}
