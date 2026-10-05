/**
 * The Glass Isles: one SVG, five islands on the light table. Fraction Falls is open and shows its
 * skill nodes; the others are frosted and marked coming soon (DESIGN.md 7.2).
 */
import { h, s, replace } from '../dom';
import type { App } from '../app';
import { content, skills } from '../../content';
import type { SkillSpec } from '../../content/types';
import { isReviewDue } from '../../engine/review';
import { navigate } from '../router';
import { t } from '../../content/strings';
import type { SkillState } from '../../store/models';

const ISLAND_W = 380, ISLAND_H = 230;

export async function renderMap(root: HTMLElement, app: App): Promise<void> {
  if (!app.profile) { navigate({ name: 'profiles' }); return; }
  const states = new Map((await app.repo.skillStates(app.profile.id)).map((x) => [x.skillId, x]));
  const session = await app.refreshSession();
  const reviewIdx = app.repo.reviewIndex(session);

  const svg = s('svg', { viewBox: '0 0 1000 600', class: 'map', role: 'group', 'aria-label': t('world.title') });
  svg.append(s('title', {}, t('world.title')));
  for (const w of content.worlds) {
    svg.append(s('ellipse', { cx: w.x, cy: w.y + 16, rx: ISLAND_W * 0.58, ry: ISLAND_H * 0.6, fill: w.tint, class: 'pool' }));
  }
  for (const w of content.worlds) {
    const open = w.status === 'open';
    const g = s('g', { class: `island ${open ? 'open' : 'soon'}`, 'data-world': w.id, tabindex: open ? -1 : 0, role: open ? 'group' : 'img', 'aria-label': `${t(w.titleKey)}${open ? '' : `, ${t('world.soon')}`}` });
    g.append(s('rect', { x: w.x - ISLAND_W / 2, y: w.y - ISLAND_H / 2, width: ISLAND_W, height: ISLAND_H, rx: 36, class: 'plate' }));
    g.append(s('text', { x: w.x, y: w.y - ISLAND_H / 2 + 34, class: 'title' }, t(w.titleKey)));
    if (!open) {
      g.append(s('text', { x: w.x, y: w.y + 12, class: 'sub' }, t('world.soon')));
      svg.append(g);
      continue;
    }
    const nodes = content.skills.filter((sk) => sk.world === w.id);
    const pos = (sk: SkillSpec) => ({ x: w.x - ISLAND_W / 2 + 40 + sk.x * (ISLAND_W - 80), y: w.y - ISLAND_H / 2 + 70 + sk.y * (ISLAND_H - 110) });
    for (const sk of nodes) for (const pre of sk.prereqs) {
      const a = pos(skills.get(pre)!), b = pos(sk);
      const done = ['mastered', 'review', 'retained'].includes(states.get(pre)?.status ?? '');
      g.append(s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `path ${done ? 'done' : ''}`.trim() }));
    }
    for (const sk of nodes) {
      const p = pos(sk);
      const st = states.get(sk.id);
      const status = st?.status ?? 'fresh';
      const due = st ? isReviewDue(st, reviewIdx) : false;
      const cls = due ? 'review' : status === 'mastered' || status === 'retained' || status === 'review' ? 'mastered' : sk.status === 'open' ? 'open' : 'locked';
      const node = s('g', { class: `node ${cls}`, 'data-skill': sk.id, tabindex: 0, role: 'button', 'aria-label': `${sk.title}: ${due ? t('skill.state.review') : t(`skill.state.${status}`)}` });
      node.append(s('circle', { cx: p.x, cy: p.y, r: 24 }));
      node.append(s('text', { x: p.x, y: p.y + 44 }, sk.title));
      if (due) node.append(s('text', { x: p.x, y: p.y + 5, class: 'badge', 'font-size': 16 }, '↻'));
      else if (cls === 'mastered') node.append(s('text', { x: p.x, y: p.y + 6, class: 'badge', 'font-size': 18 }, '✓'));
      const go = () => navigate(due ? { name: 'review', skillId: sk.id } : { name: 'skill', skillId: sk.id });
      node.addEventListener('click', go);
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      g.append(node);
    }
    svg.append(g);
  }

  const dueSkills = [...states.values()].filter((st: SkillState) => isReviewDue(st, reviewIdx));
  const banner = dueSkills.length
    ? h('div', { class: 'banner row', 'data-review-due': dueSkills.map((d) => d.skillId).join(',') },
      h('span', {}, t('review.due', { skill: skills.get(dueSkills[0]!.skillId)?.title ?? '' })),
      h('a', { class: 'btn primary', href: `#/review/${encodeURIComponent(dueSkills[0]!.skillId)}` }, t('skill.review')))
    : null;

  replace(root,
    banner,
    h('section', { class: 'map-wrap glass', 'aria-label': t('world.title') }, svg),
    h('div', { class: 'map-legend' },
      h('span', {}, h('i', { class: 'o' }), t('world.open')),
      h('span', {}, h('i', { class: 'm' }), t('skill.state.mastered')),
      h('span', {}, h('i', { class: 'r' }), t('skill.state.review'))),
  );
}
