import { parseBingPage } from '@/core/providers/bing';
import { geminiProvider } from '@/core/providers/gemini';
import { googleProvider, parseGoogleResponse } from '@/core/providers/google';
import { chatCompletionsUrl, openaiProvider } from '@/core/providers/openai-compatible';
import { ProviderError } from '@/core/providers/types';
import { findStyle } from '@/core/styles/presets';
import { defaultSettings } from '@/utils/settings';

const ctx = { settings: defaultSettings('en'), secrets: { geminiKey: 'test-key', openaiKey: '' } };
const req = { from: 'auto', to: 'vi', format: 'html' as const, style: findStyle('general') };

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
}

describe('Google', () => {
  it('parses auto-detect and explicit-source shapes', () => {
    expect(
      parseGoogleResponse(
        [
          ['Xin chào', 'en'],
          ['Thế giới', 'en'],
        ],
        2,
      ),
    ).toEqual({ texts: ['Xin chào', 'Thế giới'], detected: ['en', 'en'] });
    expect(parseGoogleResponse(['Xin chào'], 1)).toEqual({ texts: ['Xin chào'], detected: undefined });
    expect(parseGoogleResponse('Xin chào', 1).texts).toEqual(['Xin chào']);
    expect(() => parseGoogleResponse([], 1)).toThrow(ProviderError);
  });

  it('POSTs every segment as a q parameter', async () => {
    const fetchMock = mockFetch([
      ['A', 'en'],
      ['B', 'en'],
    ]);
    const res = await googleProvider.translate(['a', 'b'], req, ctx);
    expect(res.texts).toEqual(['A', 'B']);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('tl=vi');
    expect(url).toContain('format=html');
    expect(String(init.body)).toBe('q=a&q=b');
  });

  it('surfaces 429 as a rate limit', async () => {
    mockFetch('Too many', 429);
    await expect(googleProvider.translate(['a'], req, ctx)).rejects.toMatchObject({ isRateLimit: true });
  });
});

describe('Bing', () => {
  it('extracts the session token from the translator page', () => {
    const html = 'foo IG:"ABC123" bar data-iid="translator.5023" var params_AbusePreventionHelper = [1700000000000,"tok-en",3600000];';
    expect(parseBingPage(html)).toMatchObject({ ig: 'ABC123', iid: 'translator.5023', key: '1700000000000', token: 'tok-en' });
    expect(() => parseBingPage('<html></html>')).toThrow();
  });
});

describe('Gemini', () => {
  it('sends a structured request and parses the JSON array reply', async () => {
    const fetchMock = mockFetch({ candidates: [{ content: { parts: [{ text: '["Liều dùng"]' }] } }] });
    const res = await geminiProvider.translate(['Dose'], { ...req, style: findStyle('medical') }, ctx);
    expect(res.texts).toEqual(['Liều dùng']);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(':generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.systemInstruction.parts[0].text).toContain('medicine');
  });

  it('reads the retry delay from quota errors', async () => {
    mockFetch({ error: { details: [{ retryDelay: '23s' }] } }, 429);
    await expect(geminiProvider.translate(['x'], req, ctx)).rejects.toMatchObject({ status: 429, retryAfterMs: 23_000 });
  });

  it('flags a wrong item count as malformed', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: '["a"]' }] } }] });
    await expect(geminiProvider.translate(['x', 'y'], req, ctx)).rejects.toMatchObject({ malformed: true });
  });

  it('is only available with a key', () => {
    expect(geminiProvider.isAvailable({ ...ctx, secrets: { geminiKey: '', openaiKey: '' } })).toBe(false);
  });
});

describe('OpenAI-compatible', () => {
  it('normalizes the endpoint URL', () => {
    expect(chatCompletionsUrl('https://api.groq.com/openai/v1/')).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('parses chat completion content', async () => {
    mockFetch({ choices: [{ message: { content: '```json\n["Xin chào"]\n```' } }] });
    const settings = { ...ctx.settings, openaiBaseUrl: 'http://localhost:11434/v1', openaiModel: 'qwen' };
    const res = await openaiProvider.translate(['Hello'], req, { ...ctx, settings });
    expect(res.texts).toEqual(['Xin chào']);
  });
});
