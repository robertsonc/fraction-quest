/** Tiny DOM builder. No framework; the engine is pure and the UI is plain TypeScript. */

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

function applyAttrs(el: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'class') {
      el.setAttribute('class', String(v));
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
}

function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) { append(el, c); continue; }
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function replace(el: Element, ...children: Child[]): void {
  clear(el);
  append(el, children);
}

/** Stacked fraction markup with an accessible label. */
export function fracEl(n: number | string, d: number | string, cls = ''): HTMLElement {
  return h('span', { class: `frac ${cls}`.trim(), role: 'img', 'aria-label': `${n} over ${d}` },
    h('span', { 'aria-hidden': 'true' }, String(n)), h('i', { 'aria-hidden': 'true' }), h('span', { 'aria-hidden': 'true' }, String(d)));
}

/** Renders "2/3" tokens as stacked fractions, other tokens as text. */
export function equationEl(tokens: readonly string[], cls = 'equation'): HTMLElement {
  const out = h('span', { class: cls });
  for (const tok of tokens) {
    const m = /^(\?|\d+)\/(\?|\d+)$/.exec(tok);
    if (m) out.append(fracEl(m[1]!, m[2]!));
    else out.append(h('span', { class: tok === '=' || tok === '≠' || tok === '?' ? 'sign' : 'tok' }, tok));
  }
  return out;
}

export function focusFirst(root: Element): void {
  const el = root.querySelector<HTMLElement>('input, button, [tabindex="0"]');
  el?.focus({ preventScroll: true });
}
