import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openStore, MemoryStore, MIGRATIONS, STORE_NAMES } from '../../src/store/db';
import { Repo, dayKeyOf } from '../../src/store/repo';
import { SCHEMA_VERSION, type MetaRecord } from '../../src/store/models';

function fakeClock(start: number) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

beforeEach(() => {
  // A clean IndexedDB per test.
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('openStore', () => {
  it('creates every store and the schema record on first open', async () => {
    const o = await openStore('t1');
    expect(o.persistent).toBe(true);
    expect(o.recovered).toBe(false);
    const meta = await o.db.get<MetaRecord>('meta', 'schema');
    expect(meta?.version).toBe(SCHEMA_VERSION);
    for (const s of STORE_NAMES.filter((n) => n !== 'meta')) await expect(o.db.getAll(s)).resolves.toEqual([]);
    o.db.close();
  });

  it('reopens an existing database without data loss', async () => {
    const a = await openStore('t2');
    await a.db.put('profiles', { id: 'p1', nickname: 'Maya', avatarId: 1, createdAt: 1, lastSeenAt: 1, settings: {} });
    a.db.close();
    const b = await openStore('t2');
    expect(b.recovered).toBe(false);
    expect(await b.db.getAll('profiles')).toHaveLength(1);
    b.db.close();
  });

  it('recovers from a corrupted schema record by starting fresh', async () => {
    const a = await openStore('t3');
    await a.db.put('profiles', { id: 'p1', nickname: 'Maya', avatarId: 1, createdAt: 1, lastSeenAt: 1, settings: {} });
    await a.db.put('meta', { key: 'schema', version: 'garbage' });
    a.db.close();
    const b = await openStore('t3');
    expect(b.recovered).toBe(true);
    expect(b.persistent).toBe(true);
    expect(await b.db.getAll('profiles')).toEqual([]);
    b.db.close();
  });

  it('recovers from a database with a missing store (a foreign or broken schema at the same version)', async () => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open('t4', SCHEMA_VERSION);
      r.onupgradeneeded = () => { r.result.createObjectStore('meta', { keyPath: 'key' }); };
      r.onsuccess = () => { r.result.close(); resolve(); };
      r.onerror = () => reject(r.error);
    });
    const b = await openStore('t4');
    expect(b.recovered).toBe(true);
    for (const s of STORE_NAMES.filter((n) => n !== 'meta')) await expect(b.db.getAll(s)).resolves.toEqual([]);
    b.db.close();
  });

  it('recovers from a database at a newer version than this build understands', async () => {
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open('t5', SCHEMA_VERSION + 5);
      r.onupgradeneeded = () => { r.result.createObjectStore('meta', { keyPath: 'key' }); };
      r.onsuccess = () => { r.result.close(); resolve(); };
      r.onerror = () => reject(r.error);
    });
    const b = await openStore('t5');
    expect(b.recovered).toBe(true);
    expect(b.persistent).toBe(true);
    b.db.close();
  });

  it('falls back to memory when IndexedDB is missing', async () => {
    (globalThis as unknown as { indexedDB: unknown }).indexedDB = undefined;
    const o = await openStore('t6');
    expect(o.persistent).toBe(false);
    expect(o.db).toBeInstanceOf(MemoryStore);
  });

  it('has one migration per schema version', () => {
    expect(MIGRATIONS).toHaveLength(SCHEMA_VERSION);
  });
});

describe('Repo', () => {
  it('creates profiles up to the limit and removes them with their data', async () => {
    const repo = new Repo(new MemoryStore());
    const p = await repo.createProfile('  Maya  ', 2);
    expect(p.nickname).toBe('Maya');
    for (let i = 0; i < 7; i++) await repo.createProfile(`K${i}`, 1);
    await expect(repo.createProfile('Nine', 1)).rejects.toThrow('profile limit');
    const s = await repo.currentSession(p.id);
    await repo.addAttempt({ profileId: p.id, skillId: 'nf.equiv', templateId: 't', seed: 1, rep: 'area', correct: true, aided: false, guess: false, misconceptionId: null, answerText: '4', elapsedMs: 5000, phase: 'practice', sessionId: s.id });
    await repo.removeProfile(p.id);
    expect(await repo.profile(p.id)).toBeUndefined();
    expect(await repo.attempts(p.id)).toEqual([]);
    expect(await repo.sessions(p.id)).toEqual([]);
  });

  it('sessions roll over after 30 idle minutes and dayIndex only advances on a new day', async () => {
    const clock = fakeClock(new Date(2026, 9, 5, 15, 0).getTime());
    const repo = new Repo(new MemoryStore(), clock);
    const p = await repo.createProfile('Theo', 1);
    const s1 = await repo.currentSession(p.id);
    clock.advance(10 * 60 * 1000);
    expect((await repo.currentSession(p.id)).id).toBe(s1.id);
    clock.advance(31 * 60 * 1000);
    const s2 = await repo.currentSession(p.id);
    expect(s2.index).toBe(2);
    expect(s2.dayIndex).toBe(1); // same day
    clock.advance(24 * 60 * 60 * 1000);
    const s3 = await repo.currentSession(p.id);
    expect(s3.index).toBe(3);
    expect(s3.dayIndex).toBe(2);
    expect(dayKeyOf(clock.now())).not.toBe(s1.dayKey);
  });

  it('skill state defaults to fresh and round-trips', async () => {
    const repo = new Repo(new MemoryStore());
    const p = await repo.createProfile('Priya', 3);
    const s = await repo.skillState(p.id, 'nf.equiv');
    expect(s.status).toBe('fresh');
    await repo.putSkillState({ ...s, status: 'practice' });
    expect((await repo.skillState(p.id, 'nf.equiv')).status).toBe('practice');
  });

  it('export and import round-trip and reject junk', async () => {
    const repo = new Repo(new MemoryStore());
    const p = await repo.createProfile('Jun', 1);
    await repo.updateSettings(p.id, { readAloud: true });
    const bundle = await repo.exportAll();
    const other = new Repo(new MemoryStore());
    await other.importAll(JSON.parse(JSON.stringify(bundle)));
    expect((await other.profile(p.id))?.settings.readAloud).toBe(true);
    await expect(other.importAll({ nope: true })).rejects.toThrow('not an export file');
  });
});
