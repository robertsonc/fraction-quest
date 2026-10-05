import { h, replace } from '../dom';
import type { App } from '../app';
import { navigate } from '../router';
import { t } from '../../content/strings';
import { MAX_PROFILES } from '../../store/models';
import { lumenSvg } from '../components/lumen';

export const AVATARS = ['\u{1F3EE}', '\u{1F526}', '\u{1F56F}️', '\u{1F4A1}', '⭐', '\u{1F31F}', '\u{1F319}', '☀️'];
export const avatarGlyph = (id: number): string => AVATARS[Math.abs(id) % AVATARS.length] ?? AVATARS[0]!;

export async function renderProfiles(root: HTMLElement, app: App): Promise<void> {
  const list = await app.repo.profiles();
  let avatar = 0;
  const name = h('input', { type: 'text', maxlength: 16, 'aria-label': t('profile.nickname'), placeholder: t('profile.nickname'), autocomplete: 'off' });
  const avatars = h('div', { class: 'avatars', role: 'group', 'aria-label': t('profile.pick') },
    ...AVATARS.map((g, i) => {
      const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(i === avatar), 'aria-label': `${t('profile.pick')} ${i + 1}` }, g);
      b.addEventListener('click', () => { avatar = i; avatars.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
      return b;
    }));
  const start = h('button', { type: 'button', class: 'btn primary', 'data-action': 'create' }, t('profile.start'));
  const create = async () => {
    if (!name.value.trim()) { name.focus(); return; }
    const p = await app.repo.createProfile(name.value, avatar);
    await app.setProfile(p);
    navigate({ name: 'map' });
  };
  start.addEventListener('click', () => void create());
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') void create(); });

  const cards = list.map((p) => {
    const card = h('button', { type: 'button', class: 'profile-card chip', 'data-profile': p.id }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, avatarGlyph(p.avatarId)), h('span', {}, p.nickname));
    card.addEventListener('click', async () => { await app.setProfile(p); navigate({ name: 'map' }); });
    return card;
  });

  replace(root, h('section', { class: 'profiles glass', 'aria-labelledby': 'profiles-title' },
    h('div', { class: 'row' }, lumenSvg('happy', 64), h('div', {}, h('h1', { id: 'profiles-title' }, t('profile.title')), h('p', { class: 'muted' }, t('app.tagline')))),
    cards.length ? h('div', { class: 'profile-grid' }, ...cards) : null,
    list.length < MAX_PROFILES
      ? h('div', { class: 'newprofile' }, h('div', { class: 'stack' }, h('label', { class: 'muted', for: 'nick' }, t('profile.new')), name), avatars, start)
      : h('p', { class: 'muted' }, t('profile.limit')),
  ));
  name.id = 'nick';
  if (!app.persistent) app.toast(t('store.memory'));
}
