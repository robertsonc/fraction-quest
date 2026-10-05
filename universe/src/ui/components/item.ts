/**
 * One item on screen: prompt, picture, split tool, answer widget, feedback and hints.
 * Grades through the engine; reports elapsed time measured from when the item was fully shown and
 * any read-aloud finished (DESIGN.md R4).
 */
import { h, replace, equationEl, fracEl } from '../dom';
import { renderScene } from './scene';
import { boolWidget, fracWidget, intWidget, type AnswerWidget } from './answer';
import { grade } from '../../engine/grade';
import { hint as hintText, MAX_HINT } from '../../engine/hints';
import { scale, format } from '../../engine/rational';
import type { Answer, Item, Scene } from '../../engine/types';
import { t, sayFrac } from '../../content/strings';
import { misconceptions } from '../../content';
import type { App } from '../app';
import { animate } from '../../a11y/motion';

export type ItemMode = 'guided' | 'independent' | 'check' | 'quick' | 'review' | 'return' | 'easywin' | 'practice';

export interface SubmitResult {
  answer: Answer;
  answerText: string;
  correct: boolean;
  elapsedMs: number;
  misconceptionId: string | null;
  hintsShown: number;
}

export interface ItemViewOpts {
  item: Item;
  mode: ItemMode;
  app: App;
  onSubmit: (r: SubmitResult) => void;
  /** Shown above the item (return breadcrumb, quick-check title). */
  lead?: HTMLElement | null;
}

export function promptFor(item: Item): string {
  const g = item.given;
  switch (g.kind) {
    case 'missing-part': return t(g.missing === 'numerator' ? 'item.missing-part.numerator' : 'item.missing-part.denominator');
    case 'is-equivalent': return t('item.is-equivalent');
    case 'find-pair': return t('item.find-pair', { a_over_b: format(g.from) });
    case 'name-fraction': return t('item.name-fraction');
    case 'mult-fact': return t('item.mult-fact', { a: g.a, b: g.b });
  }
}

function spoken(item: Item): string {
  const g = item.given;
  const p = promptFor(item);
  switch (g.kind) {
    case 'missing-part': {
      const to = scale(g.from, g.k);
      return `${p} ${sayFrac(g.from.n, g.from.d)} equals ${g.missing === 'numerator' ? `what over ${to.d}` : `${to.n} over what`}.`;
    }
    case 'is-equivalent': return `${p} ${sayFrac(g.a.n, g.a.d)} and ${sayFrac(g.b.n, g.b.d)}.`;
    case 'find-pair': return `Write a fraction equal to ${sayFrac(g.from.n, g.from.d)} that has a bigger bottom number.`;
    default: return p;
  }
}

/** The starting picture for an item: the given fraction, unsplit. */
function baseScene(item: Item, k: number): { scenes: Scene[]; grids: ({ cols: number; rows: number } | undefined)[] } {
  const g = item.given;
  switch (g.kind) {
    case 'missing-part':
    case 'find-pair': {
      const from = g.from;
      const sc: Scene = { rep: item.rep, d: from.d * k, shaded: from.n * k, wholes: 1, equation: [] };
      if (item.rep === 'set') sc.groups = { count: from.d, perGroup: k };
      return { scenes: [sc], grids: [{ cols: from.d, rows: k }] };
    }
    case 'is-equivalent':
      return {
        scenes: [
          { rep: item.rep, d: g.a.d, shaded: g.a.n, wholes: 1, equation: [] },
          { rep: item.rep, d: g.b.d, shaded: g.b.n, wholes: 1, equation: [] },
        ],
        grids: [{ cols: g.a.d, rows: 1 }, g.b.d % g.a.d === 0 ? { cols: g.a.d, rows: g.b.d / g.a.d } : { cols: g.b.d, rows: 1 }],
      };
    case 'name-fraction':
      return { scenes: [{ rep: item.rep, d: g.d, shaded: g.shaded, wholes: 1, equation: [] }], grids: [{ cols: g.d, rows: 1 }] };
    case 'mult-fact':
      return { scenes: [{ rep: 'set', d: g.a * g.b, shaded: g.a * g.b, wholes: 1, groups: { count: g.a, perGroup: g.b }, equation: [] }], grids: [undefined] };
  }
}

function equationFor(item: Item): string[] {
  const g = item.given;
  switch (g.kind) {
    case 'missing-part': {
      const to = scale(g.from, g.k);
      return [format(g.from), '=', g.missing === 'numerator' ? `?/${to.d}` : `${to.n}/?`];
    }
    case 'is-equivalent': return [format(g.a), '?', format(g.b)];
    case 'find-pair': return [format(g.from), '=', '?/?'];
    case 'name-fraction': return ['?/?'];
    case 'mult-fact': return [String(g.a), '×', String(g.b), '=', '?'];
  }
}

export class ItemView {
  readonly el: HTMLElement;
  private readonly picture: HTMLElement;
  private readonly note: HTMLElement;
  private readonly hintBox: HTMLElement;
  private readonly widget: AnswerWidget;
  private readonly checkBtn: HTMLButtonElement;
  private readonly hintBtn: HTMLButtonElement | null;
  private t0 = 0;
  private hintsShown = 0;
  private locked = false;
  private splitK = 1;

  constructor(private readonly opts: ItemViewOpts) {
    const { item, mode, app } = opts;
    const prompt = promptFor(item);
    const speaker = h('button', { type: 'button', class: 'icon-btn chip speak no-print', 'aria-label': 'Read aloud', title: 'Read aloud' }, '\u{1F50A}');
    speaker.addEventListener('click', () => void app.speech.speak(spoken(item)));
    if (!app.speech.available()) speaker.hidden = true;

    this.picture = h('div', { class: 'item-picture' });
    this.note = h('div', { class: 'note', role: 'status', 'aria-live': 'polite', hidden: true });
    this.hintBox = h('div', { class: 'hintbox', role: 'note', hidden: true });

    const submit = () => this.submit();
    switch (item.answer.kind) {
      case 'int': this.widget = intWidget(submit); break;
      case 'bool': this.widget = boolWidget(() => { /* pick, then Check */ }); break;
      case 'frac': {
        const g = item.given;
        this.widget = fracWidget(submit, g.kind === 'find-pair' ? {} : {});
        break;
      }
    }
    this.checkBtn = h('button', { type: 'button', class: 'btn primary big', 'data-action': 'check' }, t('nav.check'));
    this.checkBtn.addEventListener('click', submit);

    const canHint = mode === 'guided' || mode === 'practice' || mode === 'independent' || mode === 'return';
    this.hintBtn = canHint && mode === 'guided' ? h('button', { type: 'button', class: 'btn', 'data-action': 'hint' }, t('hint.level1')) : null;
    this.hintBtn?.addEventListener('click', () => this.showHint());

    // The scaffold: guided items start with the picture already cut the right way.
    if (mode === 'guided' && (item.given.kind === 'missing-part')) this.splitK = item.given.k;

    const tools = this.buildTools();
    const eq = h('div', { class: 'item-eq' }, equationEl(equationFor(item)));

    this.el = h('section', { class: 'item', 'data-item-id': item.id, 'data-kind': item.kind, 'data-rep': item.rep, 'data-mode': mode },
      opts.lead ?? null,
      h('div', { class: 'row' }, h('p', { class: 'item-prompt', id: 'item-prompt' }, prompt), speaker),
      this.picture,
      tools,
      eq,
      h('div', { class: 'item-actions' }, this.widget.el, this.checkBtn, this.hintBtn),
      this.hintBox,
      this.note,
    );
    this.drawPicture();
  }

  /** Call after the element is in the document: speaks the prompt, then starts the clock. */
  async start(): Promise<void> {
    this.widget.focus();
    await this.opts.app.say(spoken(this.opts.item));
    this.t0 = this.opts.app.clock.now();
  }

  get hints(): number {
    return this.hintsShown;
  }

  private buildTools(): HTMLElement | null {
    const { item, mode } = this.opts;
    const g = item.given;
    const splittable = (g.kind === 'missing-part' || g.kind === 'find-pair') && item.rep !== 'symbol' && mode !== 'check' && mode !== 'review';
    if (!splittable) return null;
    const label = item.rep === 'set' ? 'Make groups of' : item.rep === 'line' ? 'Cut each jump into' : 'Cut each piece into';
    const tools = h('div', { class: 'item-tools', role: 'group', 'aria-label': label }, h('span', { class: 'lbl' }, label));
    for (const k of [1, 2, 3, 4, 5, 6]) {
      const b = h('button', { type: 'button', class: 'chip split', 'data-k': k, 'aria-pressed': String(k === this.splitK) }, k === 1 ? 'Undo cuts' : String(k));
      b.addEventListener('click', () => {
        this.splitK = k;
        tools.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        this.drawPicture(true);
      });
      tools.append(b);
    }
    return tools;
  }

  private drawPicture(animateIn = false): void {
    const { scenes, grids } = baseScene(this.opts.item, this.splitK);
    const nodes = scenes.map((sc, i) => {
      const grid = grids[i];
      const svg = renderScene(sc, grid ? { grid } : {});
      return h('div', { class: 'scene-wrap' }, svg);
    });
    replace(this.picture, h('div', { class: scenes.length > 1 ? 'row pair' : 'single' }, ...nodes));
    if (animateIn) for (const n of nodes) void animate(n, [{ opacity: 0.4 }, { opacity: 1 }], { duration: 300 });
  }

  showHint(): void {
    if (this.hintsShown >= MAX_HINT) return;
    this.hintsShown += 1;
    const level = this.hintsShown as 1 | 2;
    const text = hintText(this.opts.item, level);
    replace(this.hintBox, h('span', { class: 'lead' }, `${t(`hint.level${level}`)}: `), text);
    this.hintBox.hidden = false;
    if (this.hintBtn) this.hintBtn.textContent = this.hintsShown < MAX_HINT ? t('hint.level2') : t('hint.level2');
    if (this.hintBtn && this.hintsShown >= MAX_HINT) this.hintBtn.disabled = true;
    void this.opts.app.say(text);
  }

  private submit(): void {
    if (this.locked) return;
    const read = this.widget.read();
    if (read === null) { this.setNote('bad', this.opts.item.answer.kind === 'bool' ? t('feedback.invalid.pick') : t('feedback.invalid.empty')); return; }
    if (typeof read === 'string') { this.setNote('bad', read); return; }
    const g = grade(this.opts.item, read);
    if (g.invalid) { this.setNote('bad', g.invalid); return; }
    const elapsedMs = Math.max(0, this.opts.app.clock.now() - this.t0);
    this.t0 = this.opts.app.clock.now();
    this.opts.onSubmit({ answer: read, answerText: this.widget.text(), correct: g.correct, elapsedMs, misconceptionId: g.misconceptionId, hintsShown: this.hintsShown });
  }

  /** Feedback after grading. Right: what was right. Wrong: the one thing to fix. Guess: slow down. */
  feedback(kind: 'right' | 'wrong' | 'guess', misconceptionId: string | null, showFix: boolean): void {
    const item = this.opts.item;
    if (kind === 'right') {
      this.setNote('good', t('feedback.right', { detail: this.rightDetail() }));
      this.opts.app.sound.play('good');
      return;
    }
    this.opts.app.sound.play('bad');
    const box = this.el.querySelector('.item-actions');
    if (box) { box.classList.remove('shake'); void (box as HTMLElement).offsetWidth; box.classList.add('shake'); }
    if (kind === 'guess') { this.setNote('bad', t('feedback.quick')); return; }
    const mis = misconceptionId ? misconceptions.get(misconceptionId) : undefined;
    if (showFix && mis) this.setNote('bad', t('feedback.wrong.generic', { fix: t(mis.fixKey) }));
    else this.setNote('bad', t('feedback.wrong.again'));
    void item;
  }

  private rightDetail(): string {
    const g = this.opts.item.given;
    switch (g.kind) {
      case 'missing-part': { const to = scale(g.from, g.k); return `${format(g.from)} = ${format(to)}.`; }
      case 'is-equivalent': return g.distractor === 'equal' ? `${format(g.a)} and ${format(g.b)} are the same amount.` : `${format(g.a)} and ${format(g.b)} are different amounts.`;
      case 'find-pair': return `That equals ${format(g.from)}.`;
      case 'name-fraction': return `${g.shaded} of ${g.d} pieces are shaded.`;
      case 'mult-fact': return `${g.a} groups of ${g.b} make ${g.a * g.b}.`;
    }
  }

  setNote(tone: 'good' | 'bad', text: string): void {
    replace(this.note, text);
    this.note.className = `note ${tone}`;
    this.note.hidden = false;
    void this.opts.app.say(text);
  }

  lock(): void {
    this.locked = true;
    this.widget.disable();
    this.checkBtn.disabled = true;
    if (this.hintBtn) this.hintBtn.disabled = true;
    this.el.querySelectorAll<HTMLButtonElement>('.split').forEach((b) => { b.disabled = true; });
  }

  /** Lets the learner try the same item again (after a hint). */
  retry(): void {
    this.locked = false;
    this.widget.reset();
    this.widget.focus();
  }

  static fractionLabel(n: number, d: number): HTMLElement {
    return fracEl(n, d);
  }
}
