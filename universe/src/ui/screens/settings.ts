import { h } from '../dom';
import type { App } from '../app';
import { t } from '../../content/strings';
import type { Settings } from '../../store/models';

export function openSettings(app: App, onClose: () => void): void {
  const s = app.settings;
  const scrim = h('div', { class: 'scrim' });
  const close = h('button', { type: 'button', class: 'icon-btn chip close', 'aria-label': t('nav.close') }, '×');
  const dialog = h('div', { class: 'dialog glass held', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title' }, close, h('h2', { id: 'settings-title' }, t('settings.title')));

  const toggle = (key: keyof Settings, label: string, help: string | null, value: boolean, apply: (v: boolean) => Partial<Settings>) => {
    const input = h('input', { type: 'checkbox', id: `set-${key}` });
    input.checked = value;
    input.addEventListener('change', () => void app.updateSettings(apply(input.checked)));
    return h('label', { class: 'toggle chip', for: `set-${key}` }, h('span', {}, label, help ? h('span', { class: 'help' }, help) : null), input);
  };
  dialog.append(
    toggle('readAloud', t('settings.readaloud'), t('settings.readaloud.help'), s.readAloud, (v) => ({ readAloud: v })),
    toggle('dyslexiaFont', t('settings.font'), t('settings.font.help'), s.dyslexiaFont, (v) => ({ dyslexiaFont: v })),
    toggle('reducedTransparency', t('settings.transparency'), t('settings.transparency.help'), s.reducedTransparency, (v) => ({ reducedTransparency: v })),
    toggle('reducedMotion', t('settings.motion'), t('settings.motion.help'), s.reducedMotion === 'on', (v) => ({ reducedMotion: v ? 'on' : 'auto' })),
    toggle('sound', t('settings.sound'), null, s.sound, (v) => ({ sound: v })),
  );
  const theme = h('select', { id: 'set-theme', 'aria-label': t('settings.theme') },
    h('option', { value: 'auto' }, t('settings.theme.auto')), h('option', { value: 'light' }, t('settings.theme.light')), h('option', { value: 'dark' }, t('settings.theme.dark')));
  theme.value = s.theme;
  theme.addEventListener('change', () => void app.updateSettings({ theme: theme.value as Settings['theme'] }));
  dialog.append(h('div', { class: 'toggle chip' }, h('label', { for: 'set-theme' }, t('settings.theme')), theme));

  const done = () => { scrim.remove(); dialog.remove(); onClose(); };
  close.addEventListener('click', done);
  scrim.addEventListener('click', done);
  dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(); });
  document.body.append(scrim, dialog);
  close.focus();
}
