import { clear, createStore, del, entries, getMany, setMany, type UseStore } from 'idb-keyval';
import { hashString } from './html';
import type { LangCode, TextFormat } from './types';

export class LruCache<V> {
  private readonly map = new Map<string, V>();

  constructor(private readonly max: number) {}

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Refresh recency.
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      this.map.delete(this.map.keys().next().value as string);
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export interface CacheKeyInput {
  from: LangCode;
  to: LangCode;
  format: TextFormat;
  /** `general` for literal results, otherwise style id + prompt hash. */
  styleKey: string;
  text: string;
}

export function cacheKey({ from, to, format, styleKey, text }: CacheKeyInput): string {
  return `${to}|${from}|${format}|${styleKey}|${text.length}|${hashString(text)}`;
}

export interface PersistentStore {
  getMany(keys: string[]): Promise<(string | undefined)[]>;
  setMany(pairs: [string, string][]): Promise<void>;
  clear(): Promise<void>;
}

interface StoredEntry {
  v: string;
  t: number;
}

const TTL_MS = 7 * 24 * 3600 * 1000;

/** IndexedDB-backed store with a 7-day TTL. */
export function createIdbStore(): PersistentStore {
  let store: UseStore | undefined;
  const db = () => {
    store ??= createStore('tpc-cache', 'translations');
    return store;
  };
  return {
    async getMany(keys) {
      const values = await getMany<StoredEntry | undefined>(keys, db());
      const now = Date.now();
      return values.map((entry) => (entry && now - entry.t < TTL_MS ? entry.v : undefined));
    },
    async setMany(pairs) {
      const t = Date.now();
      await setMany(
        pairs.map(([key, v]) => [key, { v, t } satisfies StoredEntry]),
        db(),
      );
    },
    async clear() {
      await clear(db());
    },
  };
}

/** Deletes expired entries; called at most once per browser session. */
export async function pruneIdbStore(): Promise<number> {
  const store = createStore('tpc-cache', 'translations');
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of await entries<string, StoredEntry>(store)) {
    if (!entry || now - entry.t >= TTL_MS) {
      await del(key, store);
      removed += 1;
    }
  }
  return removed;
}

/** Two-level cache: in-memory LRU in front of an optional persistent store. */
export class TranslationCache {
  private readonly memory: LruCache<string>;

  constructor(
    memorySize = 5000,
    private readonly persistent?: PersistentStore,
  ) {
    this.memory = new LruCache(memorySize);
  }

  async getMany(keys: string[]): Promise<(string | undefined)[]> {
    const result = keys.map((key) => this.memory.get(key));
    const missing = result.flatMap((value, i) => (value === undefined ? [i] : []));
    if (missing.length > 0 && this.persistent) {
      try {
        const stored = await this.persistent.getMany(missing.map((i) => keys[i] as string));
        missing.forEach((i, j) => {
          const value = stored[j];
          if (value !== undefined) {
            result[i] = value;
            this.memory.set(keys[i] as string, value);
          }
        });
      } catch {
        // IndexedDB can be unavailable (private mode, quota); memory cache still works.
      }
    }
    return result;
  }

  async setMany(pairs: [string, string][]): Promise<void> {
    for (const [key, value] of pairs) this.memory.set(key, value);
    if (this.persistent && pairs.length > 0) {
      try {
        await this.persistent.setMany(pairs);
      } catch {
        // ignore persistence failures
      }
    }
  }

  async clear(): Promise<void> {
    this.memory.clear();
    await this.persistent?.clear();
  }
}
