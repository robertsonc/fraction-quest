/**
 * Typed repository over the KvStore. All app reads and writes go through here.
 */
import type { KvStore } from './db';
import {
  DEFAULT_SETTINGS, MAX_PROFILES, SCHEMA_VERSION,
  type Attempt, type ExportBundle, type Profile, type Remediation, type Session, type Settings, type SkillState,
} from './models';
import { freshProgress } from '../engine/review';

export interface Clock {
  now(): number;
}

function uid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function dayKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class Repo {
  constructor(
    private readonly db: KvStore,
    private readonly clock: Clock = { now: () => Date.now() },
    private readonly idleMs = 30 * 60 * 1000,
    private readonly distinctDays = true,
  ) {}

  /* ---------------- profiles ---------------- */
  async profiles(): Promise<Profile[]> {
    const all = await this.db.getAll<Profile>('profiles');
    return all.filter(isProfile).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }
  async profile(id: string): Promise<Profile | undefined> {
    const p = await this.db.get<Profile>('profiles', id);
    return p && isProfile(p) ? p : undefined;
  }
  async createProfile(nickname: string, avatarId: number): Promise<Profile> {
    const name = nickname.trim().slice(0, 16);
    if (!name) throw new Error('nickname required');
    if ((await this.profiles()).length >= MAX_PROFILES) throw new Error('profile limit');
    const now = this.clock.now();
    const p: Profile = { id: uid(), nickname: name, avatarId, createdAt: now, lastSeenAt: now, settings: { ...DEFAULT_SETTINGS } };
    await this.db.put('profiles', p);
    return p;
  }
  async touchProfile(id: string): Promise<void> {
    const p = await this.profile(id);
    if (p) await this.db.put('profiles', { ...p, lastSeenAt: this.clock.now() });
  }
  async updateSettings(id: string, patch: Partial<Settings>): Promise<Settings> {
    const p = await this.profile(id);
    if (!p) throw new Error('no such profile');
    const settings = { ...DEFAULT_SETTINGS, ...p.settings, ...patch };
    await this.db.put('profiles', { ...p, settings });
    return settings;
  }
  async removeProfile(id: string): Promise<void> {
    await this.db.delete('profiles', id);
    for (const s of await this.db.getAllBy<SkillState>('skillState', 'byProfile', id)) await this.db.delete('skillState', [s.profileId, s.skillId]);
    for (const a of await this.db.getAllBy<Attempt>('attempts', 'byProfile', id)) if (a.id !== undefined) await this.db.delete('attempts', a.id);
    for (const s of await this.db.getAllBy<Session>('sessions', 'byProfile', id)) await this.db.delete('sessions', s.id);
    for (const r of await this.db.getAllBy<Remediation>('remediation', 'byProfile', id)) if (r.id !== undefined) await this.db.delete('remediation', r.id);
  }
  async clearStats(profileId: string): Promise<void> {
    for (const s of await this.db.getAllBy<SkillState>('skillState', 'byProfile', profileId)) await this.db.delete('skillState', [s.profileId, s.skillId]);
    for (const a of await this.db.getAllBy<Attempt>('attempts', 'byProfile', profileId)) if (a.id !== undefined) await this.db.delete('attempts', a.id);
    for (const r of await this.db.getAllBy<Remediation>('remediation', 'byProfile', profileId)) if (r.id !== undefined) await this.db.delete('remediation', r.id);
  }

  /* ---------------- skill state ---------------- */
  async skillState(profileId: string, skillId: string): Promise<SkillState> {
    const s = await this.db.get<SkillState>('skillState', [profileId, skillId]);
    if (s && isSkillState(s)) return s;
    return { ...freshProgress(), profileId, skillId, updatedAt: this.clock.now() };
  }
  async skillStates(profileId: string): Promise<SkillState[]> {
    return (await this.db.getAllBy<SkillState>('skillState', 'byProfile', profileId)).filter(isSkillState);
  }
  async putSkillState(s: SkillState): Promise<void> {
    await this.db.put('skillState', { ...s, updatedAt: this.clock.now() });
  }

  /* ---------------- attempts ---------------- */
  async addAttempt(a: Omit<Attempt, 'id' | 'at'>): Promise<void> {
    await this.db.put<Attempt>('attempts', { ...a, at: this.clock.now() });
    const session = await this.db.get<Session>('sessions', a.sessionId);
    if (session) await this.db.put<Session>('sessions', { ...session, attempts: session.attempts + 1, lastActivityAt: this.clock.now() });
  }
  async attempts(profileId: string): Promise<Attempt[]> {
    return (await this.db.getAllBy<Attempt>('attempts', 'byProfile', profileId)).sort((a, b) => a.at - b.at);
  }

  /* ---------------- sessions ---------------- */
  /**
   * Returns the current session, starting a new one when the last ended more than idleMs ago
   * (DESIGN.md S1). dayIndex only advances when the calendar day changed.
   */
  async currentSession(profileId: string): Promise<Session> {
    const now = this.clock.now();
    const all = (await this.db.getAllBy<Session>('sessions', 'byProfile', profileId)).sort((a, b) => a.index - b.index);
    const last = all[all.length - 1];
    if (last && now - last.lastActivityAt < this.idleMs) {
      const touched = { ...last, lastActivityAt: now };
      await this.db.put('sessions', touched);
      return touched;
    }
    const dayKey = dayKeyOf(now);
    const s: Session = {
      id: uid(),
      profileId,
      index: (last?.index ?? 0) + 1,
      dayIndex: (last?.dayIndex ?? 0) + (last && last.dayKey === dayKey ? 0 : 1),
      dayKey,
      startedAt: now,
      lastActivityAt: now,
      attempts: 0,
    };
    await this.db.put('sessions', s);
    return s;
  }
  /** The session number used for review scheduling: distinct days when the content flag says so. */
  reviewIndex(session: Session): number {
    return this.distinctDays ? session.dayIndex : session.index;
  }
  async sessions(profileId: string): Promise<Session[]> {
    return (await this.db.getAllBy<Session>('sessions', 'byProfile', profileId)).sort((a, b) => a.index - b.index);
  }

  /* ---------------- remediation ---------------- */
  async addRemediation(r: Omit<Remediation, 'id' | 'at'>): Promise<void> {
    await this.db.put<Remediation>('remediation', { ...r, at: this.clock.now() });
  }
  async remediations(profileId: string): Promise<Remediation[]> {
    return (await this.db.getAllBy<Remediation>('remediation', 'byProfile', profileId)).sort((a, b) => a.at - b.at);
  }

  /* ---------------- export / import ---------------- */
  async exportAll(): Promise<ExportBundle> {
    return {
      app: 'fqu',
      schema: SCHEMA_VERSION,
      exportedAt: this.clock.now(),
      profiles: await this.db.getAll<Profile>('profiles'),
      skillState: await this.db.getAll<SkillState>('skillState'),
      attempts: await this.db.getAll<Attempt>('attempts'),
      sessions: await this.db.getAll<Session>('sessions'),
      remediation: await this.db.getAll<Remediation>('remediation'),
    };
  }
  /** Validates and merges a bundle. Records with the same key replace existing ones. */
  async importAll(raw: unknown): Promise<{ profiles: number }> {
    if (!isBundle(raw)) throw new Error('not an export file');
    const b = raw;
    for (const p of b.profiles.filter(isProfile)) await this.db.put('profiles', p);
    for (const s of b.skillState.filter(isSkillState)) await this.db.put('skillState', s);
    for (const a of b.attempts) { const { id: _drop, ...rest } = a; await this.db.put('attempts', rest); }
    for (const s of b.sessions) await this.db.put('sessions', s);
    for (const r of b.remediation) { const { id: _drop, ...rest } = r; await this.db.put('remediation', rest); }
    return { profiles: b.profiles.length };
  }
}

/* ---------------- validation (corrupt records are skipped, never thrown) ---------------- */
function isProfile(p: unknown): p is Profile {
  const x = p as Profile;
  return !!x && typeof x.id === 'string' && typeof x.nickname === 'string' && Number.isFinite(x.avatarId) && !!x.settings && typeof x.settings === 'object';
}
function isSkillState(s: unknown): s is SkillState {
  const x = s as SkillState;
  return !!x && typeof x.profileId === 'string' && typeof x.skillId === 'string' && typeof x.status === 'string' && Array.isArray(x.window);
}
function isBundle(b: unknown): b is ExportBundle {
  const x = b as ExportBundle;
  return !!x && x.app === 'fqu' && Number.isSafeInteger(x.schema) && x.schema <= SCHEMA_VERSION
    && Array.isArray(x.profiles) && Array.isArray(x.skillState) && Array.isArray(x.attempts) && Array.isArray(x.sessions) && Array.isArray(x.remediation);
}
