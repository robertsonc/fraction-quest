/**
 * IndexedDB access with a versioned schema, forward migrations, and recovery (DESIGN.md 6.2).
 * Any failure to open or validate the database deletes it and starts fresh, reporting `recovered`.
 * When IndexedDB is unavailable (private mode, some embedded views) a memory store with the same
 * interface is used and `persistent` is false.
 */
import { DB_NAME, SCHEMA_VERSION, type MetaRecord } from './models';

export type StoreName = 'meta' | 'profiles' | 'skillState' | 'attempts' | 'sessions' | 'remediation';
export const STORE_NAMES: readonly StoreName[] = ['meta', 'profiles', 'skillState', 'attempts', 'sessions', 'remediation'];

export interface KvStore {
  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined>;
  put<T>(store: StoreName, value: T): Promise<IDBValidKey>;
  delete(store: StoreName, key: IDBValidKey): Promise<void>;
  getAll<T>(store: StoreName): Promise<T[]>;
  /** All records whose index value equals `value`. Indexes: byProfile on every store but meta. */
  getAllBy<T>(store: StoreName, index: 'byProfile', value: IDBValidKey): Promise<T[]>;
  clear(store: StoreName): Promise<void>;
  close(): void;
}

export interface OpenedStore {
  db: KvStore;
  persistent: boolean;
  recovered: boolean;
}

type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

/** MIGRATIONS[i] upgrades from version i to i + 1. Append, never edit. */
export const MIGRATIONS: Migration[] = [
  (db) => {
    db.createObjectStore('meta', { keyPath: 'key' });
    const profiles = db.createObjectStore('profiles', { keyPath: 'id' });
    profiles.createIndex('byProfile', 'id');
    const skill = db.createObjectStore('skillState', { keyPath: ['profileId', 'skillId'] });
    skill.createIndex('byProfile', 'profileId');
    const attempts = db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true });
    attempts.createIndex('byProfile', 'profileId');
    const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
    sessions.createIndex('byProfile', 'profileId');
    const rem = db.createObjectStore('remediation', { keyPath: 'id', autoIncrement: true });
    rem.createIndex('byProfile', 'profileId');
  },
];

if (MIGRATIONS.length !== SCHEMA_VERSION) throw new Error('SCHEMA_VERSION must equal the number of migrations');

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

class IdbStore implements KvStore {
  constructor(private readonly db: IDBDatabase) {}
  private tx(store: StoreName, mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(store, mode).objectStore(store);
  }
  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> { return req(this.tx(store, 'readonly').get(key)) as Promise<T | undefined>; }
  put<T>(store: StoreName, value: T): Promise<IDBValidKey> { return req(this.tx(store, 'readwrite').put(value)); }
  async delete(store: StoreName, key: IDBValidKey): Promise<void> { await req(this.tx(store, 'readwrite').delete(key)); }
  getAll<T>(store: StoreName): Promise<T[]> { return req(this.tx(store, 'readonly').getAll()) as Promise<T[]>; }
  getAllBy<T>(store: StoreName, index: 'byProfile', value: IDBValidKey): Promise<T[]> {
    return req(this.tx(store, 'readonly').index(index).getAll(value)) as Promise<T[]>;
  }
  async clear(store: StoreName): Promise<void> { await req(this.tx(store, 'readwrite').clear()); }
  close(): void { this.db.close(); }
}

/** Same interface, nothing saved. */
export class MemoryStore implements KvStore {
  private readonly data = new Map<StoreName, Map<string, unknown>>();
  private counter = 1;
  private keyOf(store: StoreName, value: Record<string, unknown>): IDBValidKey {
    switch (store) {
      case 'meta': return value['key'] as string;
      case 'skillState': return [value['profileId'] as string, value['skillId'] as string];
      case 'attempts':
      case 'remediation': {
        if (value['id'] === undefined) value['id'] = this.counter++;
        return value['id'] as number;
      }
      default: return value['id'] as string;
    }
  }
  private map(store: StoreName): Map<string, unknown> {
    let m = this.data.get(store);
    if (!m) { m = new Map(); this.data.set(store, m); }
    return m;
  }
  async get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> { return this.map(store).get(JSON.stringify(key)) as T | undefined; }
  async put<T>(store: StoreName, value: T): Promise<IDBValidKey> {
    const copy = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    const key = this.keyOf(store, copy);
    this.map(store).set(JSON.stringify(key), copy);
    return key;
  }
  async delete(store: StoreName, key: IDBValidKey): Promise<void> { this.map(store).delete(JSON.stringify(key)); }
  async getAll<T>(store: StoreName): Promise<T[]> { return [...this.map(store).values()] as T[]; }
  async getAllBy<T>(store: StoreName, _index: 'byProfile', value: IDBValidKey): Promise<T[]> {
    const field = store === 'profiles' ? 'id' : 'profileId';
    return [...this.map(store).values()].filter((v) => (v as Record<string, unknown>)[field] === value) as T[];
  }
  async clear(store: StoreName): Promise<void> { this.map(store).clear(); }
  close(): void { /* nothing to release */ }
}

export function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openRaw(name: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, version);
    r.onupgradeneeded = (ev) => {
      const db = r.result;
      const tx = r.transaction;
      if (!tx) { reject(new Error('no upgrade transaction')); return; }
      for (let v = ev.oldVersion; v < version; v++) {
        const m = MIGRATIONS[v];
        if (!m) { reject(new Error(`no migration from version ${v}`)); return; }
        m(db, tx);
      }
    };
    r.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
    r.onerror = () => reject(r.error ?? new Error('IndexedDB open failed'));
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function deleteRaw(name: string): Promise<void> {
  return new Promise((resolve) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = () => resolve();
    r.onerror = () => resolve();
    r.onblocked = () => resolve();
  });
}

function validMeta(m: unknown): m is MetaRecord {
  return !!m && typeof m === 'object' && (m as MetaRecord).key === 'schema'
    && Number.isSafeInteger((m as MetaRecord).version) && (m as MetaRecord).version === SCHEMA_VERSION;
}

async function openValidated(name: string, version: number): Promise<KvStore> {
  const raw = await openRaw(name, version);
  for (const s of STORE_NAMES) if (!raw.objectStoreNames.contains(s)) { raw.close(); throw new Error(`store ${s} missing`); }
  const db = new IdbStore(raw);
  const meta = await db.get<MetaRecord>('meta', 'schema');
  if (meta === undefined) {
    await db.put<MetaRecord>('meta', { key: 'schema', version, createdAt: Date.now(), lastOpenedAt: Date.now() });
  } else if (!validMeta(meta)) {
    db.close();
    throw new Error('schema record invalid');
  } else {
    await db.put<MetaRecord>('meta', { ...meta, lastOpenedAt: Date.now() });
  }
  return db;
}

/**
 * Opens the store. Order: IndexedDB at the current version; on any failure delete and recreate once
 * (recovered = true); if that also fails, memory (persistent = false). Never throws.
 */
export async function openStore(name = DB_NAME, version = SCHEMA_VERSION, log: (m: string, e?: unknown) => void = () => {}): Promise<OpenedStore> {
  if (!hasIndexedDb()) {
    log('IndexedDB unavailable, using memory');
    return { db: new MemoryStore(), persistent: false, recovered: false };
  }
  try {
    return { db: await openValidated(name, version), persistent: true, recovered: false };
  } catch (err) {
    log('store open failed, recreating', err);
  }
  try {
    await deleteRaw(name);
    return { db: await openValidated(name, version), persistent: true, recovered: true };
  } catch (err) {
    log('store recreate failed, using memory', err);
    return { db: new MemoryStore(), persistent: false, recovered: true };
  }
}
