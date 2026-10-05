// @vitest-environment jsdom
/**
 * Every walkthrough's final drawn state equals the engine's answer (DESIGN.md 10.3), checked through the
 * real player and scene renderer in jsdom: the SVG drawn after the last step has exactly answer.n shaded
 * pieces out of answer.d (or the equation shows the answer), for every lesson and micro-lesson walkthrough
 * and for every representation, over hundreds of random parameterizations.
 */
import { describe, it, expect } from 'vitest';
import { content, template } from '../../src/content';
import { generate } from '../../src/engine/generators';
import { scale } from '../../src/engine/rational';
import { WalkthroughPlayer } from '../../src/walkthrough/player';
import { gridHintFor } from '../../src/ui/screens/lesson';
import type { Rep, Step } from '../../src/engine/types';

const RUNS = Number(process.env.FQU_WT_RUNS ?? 150);
const REPS: Rep[] = ['area', 'bar', 'line', 'set'];

function drawnValue(root: HTMLElement, rep: Rep): { shaded: number; total: number } | null {
  const svg = root.querySelector('.wt-stage svg:not(.overlay)');
  if (!svg) return null;
  if (rep === 'line') {
    const ticks = svg.querySelectorAll('.tick').length;
    return { shaded: svg.querySelectorAll('.jump').length, total: ticks - 1 };
  }
  const pieces = svg.querySelectorAll('.piece');
  if (pieces.length === 0) return null;
  return { shaded: svg.querySelectorAll('.piece.shaded').length, total: pieces.length };
}

/** Reads the equation back as text, with stacked fractions as n/d. */
function equationText(root: HTMLElement): string {
  const eq = root.querySelector('.wt-eq .equation');
  if (!eq) return '';
  return [...eq.children].map((c) => {
    if (c.classList.contains('frac')) { const spans = c.querySelectorAll('span'); return `${spans[0]?.textContent}/${spans[1]?.textContent}`; }
    return c.textContent ?? '';
  }).join('');
}

function withRep(steps: Step[], rep: Rep): Step[] {
  return steps.map((s) => ({ ...s, before: { ...s.before, rep }, after: { ...s.after, rep } }));
}

const walkthroughTemplates = [
  ...content.lessons.map((l) => ({ id: l.id, templateId: l.walkthrough.templateId })),
  ...content.lessons.map((l) => ({ id: `${l.id}.hook`, templateId: l.hook.templateId })),
  ...content.microLessons.map((m) => ({ id: m.id, templateId: m.walkthrough.templateId })),
];

describe.each(walkthroughTemplates.map((w) => [w.id, w.templateId] as const))('walkthrough %s', (_id, templateId) => {
  it('ends on the engine answer in every representation', async () => {
    document.documentElement.dataset['motion'] = 'reduce'; // stills: the final frame is drawn synchronously
    for (let run = 0; run < RUNS; run++) {
      const item = generate(template(templateId), run * 7919 + 13);
      const reps = item.given.kind === 'mult-fact' ? (['set'] as Rep[]) : REPS;
      for (const rep of reps) {
        const steps = withRep(item.trace, rep);
        const player = new WalkthroughPlayer(steps, { gridHint: gridHintFor(item) });
        document.body.append(player.el);
        await player.start();
        // Step through to the end by clicking the dots (replay any step must land on that step's after scene).
        const dots = player.el.querySelectorAll<HTMLButtonElement>('.wt-dot');
        dots[dots.length - 1]!.click();
        await new Promise((r) => setTimeout(r, 0));
        const last = player.currentScene();
        const drawn = drawnValue(player.el, rep);
        const g = item.given;
        switch (g.kind) {
          case 'missing-part': {
            const to = scale(g.from, g.k);
            expect(drawn).toEqual({ shaded: to.n, total: to.d });
            expect(equationText(player.el)).toBe(`${g.from.n}/${g.from.d}=${to.n}/${to.d}`);
            break;
          }
          case 'is-equivalent': {
            expect(drawn).toEqual({ shaded: last.shaded, total: last.d });
            const sign = player.el.querySelector('.wt-eq .sign')!.textContent;
            expect(sign === '=').toBe(item.answer.kind === 'bool' && item.answer.value);
            break;
          }
          case 'name-fraction':
            expect(drawn).toEqual({ shaded: g.shaded, total: g.d });
            break;
          case 'mult-fact':
            expect(drawn).toEqual({ shaded: g.a * g.b, total: g.a * g.b });
            break;
          case 'find-pair':
            expect(item.answer.kind).toBe('frac');
            if (item.answer.kind === 'frac') expect(drawn).toEqual({ shaded: item.answer.n, total: item.answer.d });
            break;
        }
        player.el.remove();
      }
    }
  });
});
