/**
 * App context shared by every screen: store, current profile and session, settings applied to the
 * document, read-aloud, sound, toast, and the clock (injectable in test mode so the e2e suite can
 * advance time across the 3.5 s guess threshold without waiting).
 */
import type { Repo } from '../store/repo';
import type { Profile, Session, Settings } from '../store/models';
import { DEFAULT_SETTINGS } from '../store/models';
import { Speech } from '../a11y/speech';
import { Sound } from './sound';
import { h } from './dom';

export interface Clock {
  /** Monotonic milliseconds for elapsed-time measurement. */
  now(): number;
}

export class App {
  profile: Profile | null = null;
  session: Session | null = null;
  readonly speech = new Speech();
  readonly sound = new Sound();
  readonly toastEl: HTMLElement;
  private toastTimer = 0;
  private offset = 0;
  readonly clock: Clock = { now: () => performance.now() + this.offset };

  constructor(readonly repo: Repo, readonly persistent: boolean, readonly testMode: boolean) {
    this.toastEl = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
  }

  /** Test mode only: shifts the clock forward. */
  advanceClock(ms: number): void {
    if (this.testMode) this.offset += ms;
  }

  get settings(): Settings {
    return { ...DEFAULT_SETTINGS, ...(this.profile?.settings ?? {}) };
  }

  async setProfile(p: Profile | null): Promise<void> {
    this.profile = p;
    this.session = null;
    if (p) {
      await this.repo.touchProfile(p.id);
      this.session = await this.repo.currentSession(p.id);
    }
    this.applySettings();
  }

  async refreshSession(): Promise<Session> {
    if (!this.profile) throw new Error('no profile');
    this.session = await this.repo.currentSession(this.profile.id);
    return this.session;
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    if (!this.profile) return;
    const settings = await this.repo.updateSettings(this.profile.id, patch);
    this.profile = { ...this.profile, settings };
    this.applySettings();
  }

  applySettings(): void {
    const s = this.settings;
    const root = document.documentElement;
    if (s.theme === 'auto') delete root.dataset['theme']; else root.dataset['theme'] = s.theme;
    if (s.dyslexiaFont) root.dataset['font'] = 'dyslexic'; else delete root.dataset['font'];
    if (s.reducedTransparency) root.dataset['transparency'] = 'reduce'; else delete root.dataset['transparency'];
    if (s.reducedMotion === 'on') root.dataset['motion'] = 'reduce'; else delete root.dataset['motion'];
    this.speech.enabled = s.readAloud;
    this.sound.enabled = s.sound;
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 3400);
  }

  /** Speaks when read-aloud is on; resolves when done (or at once when off). */
  say(text: string): Promise<void> {
    return this.speech.speak(text);
  }
}
