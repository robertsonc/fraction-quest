/**
 * Answer widgets: whole number, stacked fraction, yes or no. Digits only, three characters max,
 * on-screen keypad on coarse pointers with inputmode=none so the iOS keyboard stays down (FQ2).
 */
import { h } from '../dom';
import type { Answer } from '../../engine/types';
import { t } from '../../content/strings';
import { coarsePointer } from '../../a11y/motion';

export interface AnswerWidget {
  el: HTMLElement;
  /** null when nothing has been typed; invalid shapes come back as a message string. */
  read(): Answer | string | null;
  /** For the coach example. */
  text(): string;
  focus(): void;
  disable(): void;
  reset(): void;
}

function numInput(label: string, key: string): HTMLInputElement {
  const inp = h('input', {
    class: 'mini kp well', type: 'text', inputmode: coarsePointer() ? 'none' : 'numeric', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    'aria-label': label, 'data-k': key, maxlength: 3,
  });
  inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 3); });
  return inp;
}

function readInt(inp: HTMLInputElement): number | null {
  const v = inp.value.trim();
  return v === '' ? null : parseInt(v, 10);
}

export function intWidget(onEnter: () => void): AnswerWidget {
  const inp = numInput('Answer', 'v');
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } });
  const el = h('div', { class: 'answer kp-group' }, inp);
  return {
    el,
    read: () => { const v = readInt(inp); return v === null ? null : { kind: 'int', value: v }; },
    text: () => inp.value,
    focus: () => inp.focus({ preventScroll: true }),
    disable: () => { inp.readOnly = true; inp.tabIndex = -1; },
    reset: () => { inp.value = ''; inp.readOnly = false; inp.tabIndex = 0; },
  };
}

export function fracWidget(onEnter: () => void, fixed?: { n?: number; d?: number }): AnswerWidget {
  const top = numInput('Top number', 'n');
  const bottom = numInput('Bottom number', 'd');
  for (const inp of [top, bottom]) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } });
  if (fixed?.n !== undefined) { top.value = String(fixed.n); top.readOnly = true; top.tabIndex = -1; top.classList.add('fixed'); }
  if (fixed?.d !== undefined) { bottom.value = String(fixed.d); bottom.readOnly = true; bottom.tabIndex = -1; bottom.classList.add('fixed'); }
  const el = h('div', { class: 'answer kp-group' }, h('span', { class: 'mini-frac' }, top, h('i', { 'aria-hidden': 'true' }), bottom));
  return {
    el,
    read: () => {
      const n = readInt(top), d = readInt(bottom);
      if (n === null && d === null) return null;
      if (n === null || d === null) return t('feedback.invalid.both');
      if (d === 0) return t('feedback.invalid.zero');
      return { kind: 'frac', n, d };
    },
    text: () => `${top.value}/${bottom.value}`,
    focus: () => (top.readOnly ? bottom : top).focus({ preventScroll: true }),
    disable: () => { for (const i of [top, bottom]) { i.readOnly = true; i.tabIndex = -1; } },
    reset: () => { for (const i of [top, bottom]) if (!i.classList.contains('fixed')) { i.value = ''; i.readOnly = false; i.tabIndex = 0; } },
  };
}

export function boolWidget(onPick: () => void): AnswerWidget {
  let value: boolean | null = null;
  const yes = h('button', { type: 'button', class: 'opt', 'aria-pressed': 'false', 'data-v': 'yes' }, t('item.is-equivalent.yes'));
  const no = h('button', { type: 'button', class: 'opt', 'aria-pressed': 'false', 'data-v': 'no' }, t('item.is-equivalent.no'));
  const set = (v: boolean) => {
    value = v;
    yes.setAttribute('aria-pressed', String(v));
    no.setAttribute('aria-pressed', String(!v));
    onPick();
  };
  yes.addEventListener('click', () => set(true));
  no.addEventListener('click', () => set(false));
  const el = h('div', { class: 'answer opts', role: 'group', 'aria-label': t('item.is-equivalent') }, yes, no);
  return {
    el,
    read: () => (value === null ? null : { kind: 'bool', value }),
    text: () => (value === null ? '' : value ? 'yes' : 'no'),
    focus: () => yes.focus({ preventScroll: true }),
    disable: () => { yes.disabled = true; no.disabled = true; },
    reset: () => { value = null; yes.disabled = false; no.disabled = false; yes.setAttribute('aria-pressed', 'false'); no.setAttribute('aria-pressed', 'false'); },
  };
}

/* ---------------- on-screen keypad (level 3 glass) ---------------- */
export class Keypad {
  readonly el: HTMLElement;
  private target: HTMLInputElement | null = null;

  constructor() {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'next', 'enter'];
    this.el = h('div', { id: 'keypad', class: 'keypad glass held', 'aria-hidden': 'true', role: 'group', 'aria-label': 'Number pad' },
      ...keys.map((k) => h('button', { type: 'button', class: `k-${k}`, 'data-k': k, 'aria-label': k === 'del' ? 'Delete' : k === 'next' ? 'Next box' : k === 'enter' ? 'Check' : k },
        k === 'del' ? '⌫' : k === 'next' ? '⇥' : k === 'enter' ? t('nav.check') : k)));
    this.el.addEventListener('pointerdown', (e) => e.preventDefault());
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-k]');
      if (b) this.press(b.dataset['k'] ?? '');
    });
    document.addEventListener('focusin', (e) => {
      const el = e.target as HTMLElement;
      if (coarsePointer() && el instanceof HTMLInputElement && el.matches('input.kp') && !el.readOnly) { this.target = el; this.show(); }
    });
    document.addEventListener('focusout', () => {
      setTimeout(() => {
        const a = document.activeElement;
        if (!(a instanceof HTMLInputElement && a.matches('input.kp'))) this.hide();
      }, 140);
    });
  }

  show(): void {
    this.el.classList.add('on');
    this.el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('kp-on');
    requestAnimationFrame(() => this.reveal());
  }
  /** Brings the whole prompt (picture, boxes, Check button) above the keypad, never pushing the box off the top (FQ2). */
  private reveal(): void {
    const tgt = this.target;
    if (!tgt) return;
    const box = tgt.closest('.item-actions') ?? tgt.closest('.kp-group') ?? tgt;
    const r = box.getBoundingClientRect();
    const ti = tgt.getBoundingClientRect();
    const kh = this.el.getBoundingClientRect().height || 140;
    const limit = window.innerHeight - kh - 16;
    if (r.bottom <= limit && ti.top >= 8) return;
    let dy = r.bottom - limit;
    dy = Math.min(dy, ti.top - 12);
    if (ti.top < 8) dy = ti.top - 24;
    if (Math.abs(dy) > 2) window.scrollBy({ top: dy, behavior: 'auto' });
  }
  hide(): void {
    this.el.classList.remove('on');
    this.el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('kp-on');
    this.target = null;
  }
  press(k: string): void {
    const tgt = this.target;
    if (!tgt || tgt.readOnly) return;
    if (/^\d$/.test(k)) {
      if (tgt.value.length < 3) { tgt.value += k; tgt.dispatchEvent(new Event('input', { bubbles: true })); }
    } else if (k === 'del') {
      tgt.value = tgt.value.slice(0, -1);
      tgt.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (k === 'next') {
      const group = tgt.closest('.kp-group') ?? document;
      const list = [...group.querySelectorAll<HTMLInputElement>('input.kp')].filter((i) => !i.readOnly && !i.disabled);
      const nx = list[(list.indexOf(tgt) + 1) % list.length];
      nx?.focus({ preventScroll: true });
    } else if (k === 'enter') {
      tgt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
  }
}
