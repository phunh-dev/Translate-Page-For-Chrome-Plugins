import { makeBatches } from '@/core/batcher';
import { cacheKey, LruCache, type PersistentStore, TranslationCache } from '@/core/cache';
import { Cooldowns, Limiter } from '@/core/rate-limit';

describe('makeBatches', () => {
  it('respects item and character limits, keeping order', () => {
    const lengths = [10, 10, 10, 50, 10];
    expect(makeBatches(lengths, [0, 1, 2, 3, 4], 30, 10)).toEqual([[0, 1, 2], [3], [4]]);
    expect(makeBatches(lengths, [0, 1, 2, 4], 1000, 2)).toEqual([
      [0, 1],
      [2, 4],
    ]);
  });
});

describe('LruCache', () => {
  it('evicts the least recently used entry', () => {
    const lru = new LruCache<string>(2);
    lru.set('a', '1');
    lru.set('b', '2');
    lru.get('a');
    lru.set('c', '3');
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('a')).toBe('1');
  });
});

describe('TranslationCache', () => {
  it('reads through to the persistent store and warms memory', async () => {
    const backing = new Map<string, string>([['k2', 'v2']]);
    const store: PersistentStore = {
      getMany: vi.fn(async (keys: string[]) => keys.map((k) => backing.get(k))),
      setMany: vi.fn(async (pairs: [string, string][]) => {
        for (const [k, v] of pairs) backing.set(k, v);
      }),
      clear: vi.fn(async () => backing.clear()),
    };
    const cache = new TranslationCache(10, store);
    await cache.setMany([['k1', 'v1']]);
    expect(await cache.getMany(['k1', 'k2', 'k3'])).toEqual(['v1', 'v2', undefined]);
    expect(store.getMany).toHaveBeenLastCalledWith(['k2', 'k3']);
    await cache.getMany(['k2']);
    expect(store.getMany).toHaveBeenCalledTimes(1);
  });

  it('builds keys that separate languages, styles and formats', () => {
    const base = { from: 'auto', to: 'vi', format: 'html' as const, styleKey: 'general', text: 'Hello' };
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, to: 'ja' }));
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, styleKey: 'medical:abc' }));
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, format: 'text' }));
  });
});

describe('rate limiting', () => {
  it('caps concurrency', async () => {
    const limiter = new Limiter(2);
    let running = 0;
    let peak = 0;
    const task = () =>
      limiter.schedule(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
      });
    await Promise.all([task(), task(), task(), task(), task()]);
    expect(peak).toBe(2);
  });

  it('expires cooldowns', () => {
    let now = 1000;
    const cooldowns = new Cooldowns(() => now);
    cooldowns.mark('gemini', 500);
    expect(cooldowns.isCoolingDown('gemini')).toBe(true);
    now = 1600;
    expect(cooldowns.isCoolingDown('gemini')).toBe(false);
  });
});
