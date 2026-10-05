import './ui/tokens.css';
import './ui/app.css';
import { h, replace } from './ui/dom';
import { App } from './ui/app';
import { openStore } from './store/db';
import { Repo } from './store/repo';
import { CONSTANTS, lintContent, skills } from './content';
import { parseRoute, navigate, type Route } from './ui/router';
import { renderProfiles, avatarGlyph } from './ui/screens/profiles';
import { renderMap } from './ui/screens/map';
import { renderSkill } from './ui/screens/skill';
import { LessonScreen } from './ui/screens/lesson';
import { ReviewScreen } from './ui/screens/review';
import { renderCoach } from './ui/screens/coach';
import { openSettings } from './ui/screens/settings';
import { Keypad } from './ui/components/answer';
import { lumenSvg } from './ui/components/lumen';
import { ItemSource } from './ui/items';
import { t } from './content/strings';
import type { Answer, Item } from './engine/types';
import { detect } from './engine/misconceptions/detect';
import { produce } from './engine/misconceptions/produce';
import { grade } from './engine/grade';

const params = new URLSearchParams(location.search);
const TEST = params.get('test') === '1';
const SEED = params.get('seed');

async function boot(): Promise<void> {
  const log = (m: string, e?: unknown) => console.debug(`[fqu] ${m}`, e ?? '');
  const opened = await openStore(undefined, undefined, log);
  const repo = new Repo(opened.db, { now: () => Date.now() }, CONSTANTS.sessionIdleMinutes * 60 * 1000, CONSTANTS.reviewCountsDistinctDaysOnly);
  const app = new App(repo, opened.persistent, TEST);
  if (import.meta.env.DEV) {
    const problems = lintContent();
    if (problems.length) console.warn('[fqu] content problems', problems);
  }

  const root = document.getElementById('app')!;
  const main = h('main', { id: 'main' });
  const who = h('span', { class: 'who' });
  const settingsBtn = h('button', { type: 'button', class: 'icon-btn chip', 'aria-label': t('nav.settings'), 'data-action': 'settings' }, '⚙');
  settingsBtn.addEventListener('click', () => openSettings(app, () => { void render(); }));
  const coachBtn = h('button', { type: 'button', class: 'icon-btn chip hold', 'aria-label': t('nav.hold'), title: t('nav.hold'), 'data-action': 'coach' }, lumenSvg('neutral', 30), h('span', { class: 'ring', 'aria-hidden': 'true' }));
  bindHold(coachBtn, () => navigate({ name: 'coach' }));
  const topbar = h('header', { class: 'topbar glass' }, h('a', { href: '#/map', class: 'row', style: 'text-decoration:none;color:inherit' }, h('h1', {}, t('app.name'))), h('span', { class: 'spacer' }), who, settingsBtn, coachBtn);
  const keypad = new Keypad();
  replace(root, topbar, main, app.toastEl, keypad.el);
  if (opened.recovered) app.toast(t('store.recovered'));

  let active: { stop(): void } | null = null;
  let currentItem: Item | null = null;
  let source = new ItemSource(SEED !== null ? Number(SEED) : null);

  async function render(): Promise<void> {
    active?.stop();
    active = null;
    app.speech.cancel();
    // A new screen starts at the top with the keypad down, whatever the last one left behind.
    keypad.hide();
    window.scrollTo(0, 0);
    const route: Route = parseRoute(location.hash);
    if (route.name !== 'profiles' && !app.profile) {
      // Deep link without a chosen profile: pick the most recent one so the link still works.
      const [first] = await repo.profiles();
      if (first) await app.setProfile(first);
      else { navigate({ name: 'profiles' }); return; }
    }
    replace(who, app.profile ? [h('span', { class: 'avatar', 'aria-hidden': 'true' }, avatarGlyph(app.profile.avatarId)), h('span', {}, app.profile.nickname), h('a', { class: 'chip', href: '#/profiles', 'data-action': 'switch' }, t('profile.switch'))] : null);
    topbar.hidden = route.name === 'profiles';
    switch (route.name) {
      case 'profiles': await app.setProfile(null); await renderProfiles(main, app); break;
      case 'map': await renderMap(main, app); break;
      case 'skill': await renderSkill(main, app, route.skillId); break;
      case 'coach': await renderCoach(main, app); break;
      case 'lesson':
      case 'practice': {
        if (!skills.has(route.skillId)) { navigate({ name: 'map' }); return; }
        const screen = new LessonScreen({ app, skillId: route.skillId, mode: route.name, source, onItem: (i) => { currentItem = i; } });
        active = screen;
        replace(main, screen.el);
        await screen.start();
        break;
      }
      case 'review': {
        const screen = new ReviewScreen(app, route.skillId, source, (i) => { currentItem = i; });
        active = screen;
        replace(main, screen.el);
        screen.start();
        break;
      }
    }
    main.focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', () => void render());
  if (!location.hash) location.hash = '#/profiles';
  else await render();

  if (TEST) {
    // Test hooks (only with ?test=1): deterministic items, a clock the e2e suite can advance, the current item.
    (window as unknown as { __fqu: unknown }).__fqu = {
      app, repo,
      current: () => currentItem,
      advance: (ms: number) => app.advanceClock(ms),
      reseed: (n: number) => { source = new ItemSource(n); },
      lint: lintContent,
      /** A wrong answer that no misconception predicate claims, or null when every wrong answer is classified. */
      plainWrong: (): Answer | null => (currentItem ? plainWrong(currentItem) : null),
      misconceptionAnswer: (id: string): Answer | null => (currentItem ? produce(id, currentItem) : null),
    };
  }

  if ('serviceWorker' in navigator && window.isSecureContext && !TEST) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/world/sw.js', { scope: '/world/' }).catch((err) => console.debug('[fqu] offline cache unavailable', err));
    });
  }
}

/** Test helper: a wrong answer with no misconception match. Yes-or-no items only have one wrong answer, which is always classified. */
function plainWrong(item: Item): Answer | null {
  const a = item.answer;
  const candidates: Answer[] = [];
  if (a.kind === 'int') for (let dlt = 1; dlt < 60; dlt++) { candidates.push({ kind: 'int', value: a.value + dlt }); if (a.value - dlt > 0) candidates.push({ kind: 'int', value: a.value - dlt }); }
  if (a.kind === 'frac') for (let dlt = 1; dlt < 30; dlt++) { candidates.push({ kind: 'frac', n: a.n + dlt, d: a.d + 2 * dlt + 1 }); candidates.push({ kind: 'frac', n: a.n + 2 * dlt + 1, d: a.d + dlt }); }
  if (a.kind === 'bool') return { kind: 'bool', value: !a.value };
  for (const c of candidates) {
    const g = grade(item, c);
    if (!g.correct && !g.invalid && detect(item, c) === null) return c;
  }
  return null;
}

/** Press and hold for 3 seconds (pointer or Enter key) to open the coach view. */
function bindHold(btn: HTMLElement, fire: () => void): void {
  let timer = 0;
  const start = () => { btn.classList.add('holding'); timer = window.setTimeout(() => { btn.classList.remove('holding'); fire(); }, 3000); };
  const cancel = () => { btn.classList.remove('holding'); clearTimeout(timer); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // Capture the pointer so a small finger drift during the hold does not count as leaving the button.
    try { btn.setPointerCapture(e.pointerId); } catch { /* not all pointers can be captured */ }
    start();
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, cancel);
  btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.repeat) start(); });
  btn.addEventListener('keyup', (e) => { if (e.key === 'Enter') cancel(); });
  btn.addEventListener('click', (e) => e.preventDefault());
}

void boot();
