import { TranslationCache } from '@/core/cache';
import { ProviderError, type TranslationProvider } from '@/core/providers/types';
import { aiChain, standardChain, TranslationRouter } from '@/core/router';
import { defaultSettings, type Secrets, type Settings } from '@/utils/settings';

function fakeProvider(id: string, kind: 'standard' | 'ai', impl?: (texts: string[]) => string[] | Promise<string[]>): TranslationProvider {
  return {
    id,
    label: id,
    kind,
    maxBatchChars: 1000,
    maxBatchItems: 10,
    concurrency: 2,
    isAvailable: () => true,
    translate: vi.fn(async (texts: string[]) => ({
      texts: impl ? await impl(texts) : texts.map((t) => `${id}:${t}`),
      detected: texts.map(() => 'en'),
    })),
  };
}

function makeRouter(providers: TranslationProvider[], settings: Partial<Settings> = {}, secrets: Partial<Secrets> = {}) {
  return new TranslationRouter({
    providers,
    cache: new TranslationCache(100),
    getSettings: async () => ({ ...defaultSettings('en'), ...settings }),
    getSecrets: async () => ({ geminiKey: '', openaiKey: '', ...secrets }),
  });
}

const request = { from: 'auto', to: 'vi', format: 'html' as const };

describe('provider chains', () => {
  it('orders standard and AI engines by preference', () => {
    expect(standardChain('google')[0]).toBe('google');
    expect(standardChain('bing').slice(0, 2)).toEqual(['bing', 'google']);
    expect(aiChain('auto')).toEqual(['chrome-ai', 'gemini', 'openai']);
    expect(aiChain('gemini')).toEqual(['gemini', 'chrome-ai', 'openai']);
  });
});

describe('TranslationRouter', () => {
  it('translates literally with the standard engine and reports detection', async () => {
    const google = fakeProvider('google', 'standard');
    const router = makeRouter([google]);
    const res = await router.translate({ ...request, texts: ['Hello', '  ', 'World'] });
    expect(res.texts).toEqual(['google:Hello', '  ', 'google:World']);
    expect(res.provider).toBe('google');
    expect(res.detected).toBe('en');
    // whitespace-only items are not sent
    expect((google.translate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toEqual(['Hello', 'World']);
  });

  it('serves repeats from cache', async () => {
    const google = fakeProvider('google', 'standard');
    const router = makeRouter([google]);
    await router.translate({ ...request, texts: ['Hello'] });
    const res = await router.translate({ ...request, texts: ['Hello'] });
    expect(res.texts).toEqual(['google:Hello']);
    expect(res.provider).toBe('cache');
    expect(google.translate).toHaveBeenCalledTimes(1);
  });

  it('falls back to the next engine on a rate limit and cools the first one down', async () => {
    const google = fakeProvider('google', 'standard', () => {
      throw new ProviderError('slow down', 429, 60_000);
    });
    const bing = fakeProvider('bing', 'standard');
    const router = makeRouter([google, bing]);
    const res = await router.translate({ ...request, texts: ['Hi'] });
    expect(res.provider).toBe('bing');
    await router.translate({ ...request, texts: ['Again'] });
    expect(google.translate).toHaveBeenCalledTimes(1);
  });

  it('uses an AI engine for styles and falls back to literal when none is usable', async () => {
    const google = fakeProvider('google', 'standard');
    const gemini = fakeProvider('gemini', 'ai');
    gemini.isAvailable = ({ secrets }) => Boolean(secrets.geminiKey);

    const withKey = makeRouter([google, gemini], {}, { geminiKey: 'k' });
    const styled = await withKey.translate({ ...request, texts: ['Dose'], style: 'medical' });
    expect(styled).toMatchObject({ texts: ['gemini:Dose'], provider: 'gemini' });
    expect(styled.styleFallback).toBeUndefined();

    const withoutKey = makeRouter([google, gemini]);
    const literal = await withoutKey.translate({ ...request, texts: ['Dose'], style: 'medical' });
    expect(literal).toMatchObject({ texts: ['google:Dose'], provider: 'google', styleFallback: true });
  });

  it('splits batches when an LLM returns the wrong number of items', async () => {
    const google = fakeProvider('google', 'standard');
    const gemini = fakeProvider('gemini', 'ai', (texts) => {
      if (texts.length > 1) throw new ProviderError('bad count', undefined, undefined, true);
      return texts.map((t) => `ai:${t}`);
    });
    const router = makeRouter([google, gemini]);
    const res = await router.translate({ ...request, texts: ['a', 'b', 'c'], style: 'technology' });
    expect(res.texts).toEqual(['ai:a', 'ai:b', 'ai:c']);
  });

  it('skips a provider whose availability check never settles', async () => {
    const hanging = fakeProvider('chrome-ai', 'ai');
    hanging.isAvailable = () => new Promise<boolean>(() => {});
    const gemini = fakeProvider('gemini', 'ai');
    const router = new TranslationRouter({
      providers: [fakeProvider('google', 'standard'), hanging, gemini],
      cache: new TranslationCache(100),
      getSettings: async () => defaultSettings('en'),
      getSecrets: async () => ({ geminiKey: 'k', openaiKey: '' }),
      availabilityTimeoutMs: 50,
    });
    const res = await router.translate({ ...request, texts: ['Hi'], style: 'medical' });
    expect(res.provider).toBe('gemini');
    expect(hanging.translate).not.toHaveBeenCalled();
  });

  it('throws when every engine fails', async () => {
    const google = fakeProvider('google', 'standard', () => {
      throw new Error('offline');
    });
    await expect(makeRouter([google]).translate({ ...request, texts: ['x'] })).rejects.toThrow('offline');
  });
});
