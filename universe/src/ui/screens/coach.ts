/**
 * Coach view (DESIGN.md 8): per skill, mastery state, unaided accuracy, misconceptions with a regenerated
 * example item, guess rate, time on task, remediation history. Print and export.
 */
import { h, replace } from '../dom';
import type { App } from '../app';
import { content, misconceptions, skills, template } from '../../content';
import { generate } from '../../engine/generators';
import { promptFor } from '../components/item';
import { format, scale } from '../../engine/rational';
import { t } from '../../content/strings';
import type { Attempt } from '../../store/models';
import { navigate } from '../router';

function describe(a: Attempt): string {
  try {
    const item = generate(template(a.templateId), a.seed);
    const g = item.given;
    let q = promptFor(item);
    if (g.kind === 'missing-part') q = `${format(g.from)} = ${g.missing === 'numerator' ? `?/${scale(g.from, g.k).d}` : `${scale(g.from, g.k).n}/?`}`;
    if (g.kind === 'is-equivalent') q = `${format(g.a)} and ${format(g.b)}`;
    if (g.kind === 'find-pair') q = `equal to ${format(g.from)}`;
    if (g.kind === 'name-fraction') q = `${g.shaded} of ${g.d} shaded`;
    if (g.kind === 'mult-fact') q = `${g.a} × ${g.b}`;
    return t('coach.example', { item: q, answer: a.answerText || '(blank)' });
  } catch {
    return a.templateId;
  }
}

function minutes(ms: number): string {
  const m = Math.round(ms / 60000);
  return m < 1 ? '< 1 min' : `${m} min`;
}

export async function renderCoach(root: HTMLElement, app: App): Promise<void> {
  if (!app.profile) { navigate({ name: 'profiles' }); return; }
  const profile = app.profile;
  const attempts = await app.repo.attempts(profile.id);
  const states = new Map((await app.repo.skillStates(profile.id)).map((x) => [x.skillId, x]));
  const rems = await app.repo.remediations(profile.id);

  const rows = content.skills.map((sk) => {
    const mine = attempts.filter((a) => a.skillId === sk.id);
    const counted = mine.filter((a) => !a.aided && a.phase !== 'quick' && a.phase !== 'easywin');
    const acc = counted.length ? Math.round((counted.filter((a) => a.correct && !a.guess).length / counted.length) * 100) : null;
    const wrong = mine.filter((a) => !a.correct);
    const guessRate = wrong.length ? Math.round((wrong.filter((a) => a.guess).length / wrong.length) * 100) : null;
    const time = mine.reduce((sum, a) => sum + a.elapsedMs, 0);
    const byMis = new Map<string, Attempt[]>();
    for (const a of wrong) if (a.misconceptionId) byMis.set(a.misconceptionId, [...(byMis.get(a.misconceptionId) ?? []), a]);
    const st = states.get(sk.id);
    const myRems = rems.filter((r) => r.skillId === sk.id);
    return h('tr', { 'data-skill': sk.id },
      h('td', {}, h('strong', {}, sk.title), h('br'), h('span', { class: 'muted' }, sk.ccss.join(', '))),
      h('td', {}, t(`skill.state.${st?.status ?? 'fresh'}`), st?.coachFlags ? h('div', { class: 'flag' }, t('coach.flagged')) : null),
      h('td', {}, acc === null ? '-' : `${acc}%`, h('br'), h('span', { class: 'muted' }, `${t('coach.attempts')}: ${mine.length}`)),
      h('td', {}, guessRate === null ? '-' : `${guessRate}%`),
      h('td', {}, minutes(time)),
      h('td', {}, byMis.size ? h('ul', {}, ...[...byMis.entries()].map(([id, list]) => h('li', {}, `${t(misconceptions.get(id)?.labelKey ?? '')} (${list.length}). `, h('span', { class: 'muted' }, describe(list[list.length - 1]!))))) : h('span', { class: 'muted' }, '-')),
      h('td', {}, myRems.length ? h('ul', {}, ...myRems.slice(-5).map((r) => h('li', {}, `${r.cause}: ${[sk.title, ...r.path.map((p) => skills.get(p)?.title ?? p)].join(' → ')} (${r.outcome})`))) : h('span', { class: 'muted' }, t('coach.remediation.none'))),
    );
  });

  const print = h('button', { type: 'button', class: 'btn no-print' }, t('coach.print'));
  print.addEventListener('click', () => window.print());
  const exp = h('button', { type: 'button', class: 'btn no-print', 'data-action': 'export' }, t('coach.export'));
  exp.addEventListener('click', async () => {
    const bundle = await app.repo.exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `fraction-quest-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  const file = h('input', { type: 'file', accept: 'application/json', class: 'sr', 'aria-label': t('coach.import') });
  const imp = h('button', { type: 'button', class: 'btn no-print' }, t('coach.import'));
  imp.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      await app.repo.importAll(JSON.parse(await f.text()));
      app.toast(t('store.imported'));
      await renderCoach(root, app);
    } catch {
      app.toast(t('store.import.bad'));
    }
  });
  const reset = h('button', { type: 'button', class: 'btn no-print', 'data-action': 'reset' }, t('coach.reset'));
  let armed = false;
  reset.addEventListener('click', async () => {
    if (!armed) { armed = true; reset.textContent = t('coach.reset.confirm'); setTimeout(() => { armed = false; reset.textContent = t('coach.reset'); }, 3000); return; }
    await app.repo.clearStats(profile.id);
    await renderCoach(root, app);
  });

  replace(root, h('section', { class: 'coach glass', 'aria-labelledby': 'coach-title' },
    h('div', { class: 'row no-print' }, h('a', { class: 'btn', href: '#/map' }, '← ', t('nav.map')), h('span', { class: 'spacer' }), print, exp, imp, file, reset),
    h('h2', { id: 'coach-title', style: 'margin-top:12px' }, t('coach.title')),
    h('p', { class: 'muted' }, t('coach.for', { name: profile.nickname }), ` · ${new Date().toLocaleDateString()}`),
    attempts.length === 0 ? h('p', {}, t('coach.empty')) : null,
    h('table', {},
      h('thead', {}, h('tr', {}, ...[t('coach.skill'), t('coach.state'), t('coach.accuracy'), t('coach.guess'), t('coach.time'), t('coach.misconceptions'), t('coach.remediation')].map((x) => h('th', { scope: 'col' }, x)))),
      h('tbody', {}, ...rows)),
  ));
}
