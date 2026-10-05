/** Lumen, the lantern guide. Original character: a small glowing lantern with a friendly face. */
import { s, h } from '../dom';

export type Mood = 'neutral' | 'happy' | 'think' | 'cheer';

export function lumenSvg(mood: Mood = 'neutral', size = 72): SVGSVGElement {
  const eyeY = mood === 'happy' || mood === 'cheer' ? 46 : 44;
  const mouth = mood === 'happy' || mood === 'cheer'
    ? 'M40 56 Q50 66 60 56'
    : mood === 'think' ? 'M43 59 Q50 57 57 60' : 'M43 58 Q50 62 57 58';
  const svg = s('svg', { viewBox: '0 0 100 110', width: size, height: size * 1.1, class: `lumen mood-${mood}`, role: 'img', 'aria-label': 'Lumen the lantern' },
    s('defs', {},
      s('radialGradient', { id: 'lumen-glow', cx: '50%', cy: '55%', r: '50%' },
        s('stop', { offset: '0', 'stop-color': '#FFF4C2', 'stop-opacity': '1' }),
        s('stop', { offset: '1', 'stop-color': '#F2C12E', 'stop-opacity': '.85' }))),
    s('ellipse', { class: 'lumen-halo', cx: 50, cy: 56, rx: 44, ry: 46, fill: '#F2C12E', opacity: '.18' }),
    s('rect', { x: 42, y: 8, width: 16, height: 10, rx: 3, fill: '#5C6686' }),
    s('path', { d: 'M50 2 v8', stroke: '#5C6686', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    s('rect', { x: 26, y: 18, width: 48, height: 72, rx: 14, fill: 'url(#lumen-glow)', stroke: '#C98F12', 'stroke-width': 2.5 }),
    s('rect', { x: 30, y: 22, width: 40, height: 64, rx: 11, fill: 'none', stroke: 'rgba(255,255,255,.7)', 'stroke-width': 1.5 }),
    s('circle', { class: 'lumen-eye', cx: 41, cy: eyeY, r: 3.2, fill: '#2A2204' }),
    s('circle', { class: 'lumen-eye', cx: 59, cy: eyeY, r: 3.2, fill: '#2A2204' }),
    s('path', { d: mouth, stroke: '#2A2204', 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }),
    s('rect', { x: 36, y: 90, width: 28, height: 8, rx: 3, fill: '#5C6686' }),
  );
  if (mood === 'cheer') {
    for (const [x, y] of [[14, 30], [86, 28], [10, 72], [90, 76]] as const) {
      svg.append(s('path', { d: `M${x} ${y - 6} v12 M${x - 6} ${y} h12`, stroke: '#F2C12E', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    }
  }
  return svg;
}

/** A speech bubble next to Lumen. */
export function lumenSays(text: string, mood: Mood = 'neutral'): HTMLElement {
  return h('div', { class: 'lumen-row' }, lumenSvg(mood, 64), h('p', { class: 'bubble', role: 'status', 'aria-live': 'polite' }, text));
}
