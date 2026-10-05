import { h, replace } from '../dom';
import type { App } from '../app';
import { skill, lessonFor } from '../../content';
import { isReviewDue } from '../../engine/review';
import { repsCovered, unaidedCorrect } from '../../engine/mastery';
import { navigate } from '../router';
import { t } from '../../content/strings';
import { lumenSays } from '../components/lumen';

export async function renderSkill(root: HTMLElement, app: App, skillId: string): Promise<void> {
  if (!app.profile) { navigate({ name: 'profiles' }); return; }
  const sk = skill(skillId);
  const st = await app.repo.skillState(app.profile.id, skillId);
  const session = await app.refreshSession();
  const due = isReviewDue(st, app.repo.reviewIndex(session));
  const good = st.window.filter(unaidedCorrect).length;
  const reps = repsCovered(st.window);
  const open = sk.status === 'open' && lessonFor(skillId) !== null;

  const actions: HTMLElement[] = [];
  if (due) actions.push(h('a', { class: 'btn primary big', href: `#/review/${encodeURIComponent(skillId)}`, 'data-action': 'review' }, t('skill.review')));
  if (open) {
    if (st.status === 'fresh' || st.status === 'learning') actions.push(h('a', { class: 'btn primary big', href: `#/lesson/${encodeURIComponent(skillId)}`, 'data-action': 'lesson' }, st.status === 'fresh' ? t('skill.start') : t('skill.resume')));
    else actions.push(h('a', { class: 'btn big', href: `#/lesson/${encodeURIComponent(skillId)}`, 'data-action': 'lesson' }, t('lesson.walkthrough')));
    actions.push(h('a', { class: `btn big ${st.status === 'fresh' ? '' : 'primary'}`, href: `#/practice/${encodeURIComponent(skillId)}`, 'data-action': 'practice' }, t('skill.practice')));
  }

  replace(root, h('section', { class: 'skill glass', 'aria-labelledby': 'skill-title' },
    h('a', { class: 'btn', href: '#/map' }, '← ', t('nav.map')),
    h('h2', { id: 'skill-title', style: 'margin-top:14px' }, sk.title),
    h('p', {}, h('span', { class: `state-pill ${st.status}`, 'data-status': st.status }, due ? t('skill.state.review') : t(`skill.state.${st.status}`)), ' ', h('span', { class: 'muted' }, sk.ccss.join(', '))),
    open ? null : h('p', { class: 'banner' }, t('skill.locked')),
    h('div', { class: 'meter', 'aria-hidden': 'true' }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: i < good ? 'on' : '' }))),
    h('p', { class: 'muted' }, t('skill.meter', { n: good })),
    reps.length ? h('div', { class: 'reps' }, ...reps.map((r) => h('span', { class: 'chip' }, t(`rep.${r}`)))) : null,
    lumenSays(open ? t('app.tagline') : t('skill.locked'), 'neutral'),
    h('div', { class: 'row', style: 'margin-top:12px' }, ...actions),
  ));
}
